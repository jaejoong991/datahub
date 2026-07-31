import type { FastifyInstance, FastifyReply } from 'fastify';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { getDb } from '../../lib/db.js';
import { verifyPassword } from '../../lib/crypto.js';
import { createSession, deleteSession, setActiveShop } from '../../lib/session.js';
import { authPreHandler } from '../../lib/auth.js';
import { requireRole } from '../../lib/rbac.js';
import { getEnv } from '../../lib/env.js';
import { getAuthorizationUrl, exchangeCodeForTokens, clearShopTokens } from '../../shopee/token.js';
import { logInfo } from '../../lib/logger.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const OAUTH_STATE_COOKIE = 'shopee_oauth_state';

/* Mulai flow OAuth Shopee: generate state CSRF, simpan di cookie, kembalikan URL
   otorisasi. Dipakai /authorize DAN /reauthorize — dua-duanya mendarat di
   /callback yang sama, jadi dua-duanya wajib set cookie state. */
async function beginShopeeAuth(reply: FastifyReply, shopId: number): Promise<string> {
  const env = getEnv();
  const state = randomBytes(32).toString('hex');
  reply.setCookie(OAUTH_STATE_COOKIE, `${state}.${shopId}`, {
    path: '/', httpOnly: true, sameSite: 'lax', maxAge: 600, secure: env.NODE_ENV === 'production',
  });
  // redirect_uri harus nunjuk ke backend sendiri (bukan origin frontend) —
  // handler callback-nya hidup di sini.
  return getAuthorizationUrl(shopId, `${env.APP_URL}/auth/shopee/callback`, state);
}

export async function authRoutes(app: FastifyInstance) {
  const env = getEnv();

  app.post('/login', { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(422).send({ message: 'Email dan password wajib diisi.', code: 'validation_error' });
    }
    const { email, password } = parsed.data;
    const user = await getDb().selectFrom('app_user')
      .selectAll().where('email', '=', email).executeTakeFirst();
    if (!user || !(await verifyPassword(user.password_hash, password))) {
      return reply.status(422).send({ message: 'Email atau password salah.', code: 'invalid_credentials' });
    }
    if (!user.is_active) {
      return reply.status(403).send({ message: 'Akun tidak aktif.', code: 'account_disabled' });
    }
    // Auto-select first active shop
    const firstShop = await getDb().selectFrom('shop')
      .select('id').where('is_active', '=', true).orderBy('id', 'asc').executeTakeFirst();

    const sessionId = await createSession(user.id, firstShop?.id);
    reply.setCookie('session_id', sessionId, {
      path: '/', httpOnly: true, sameSite: 'lax', maxAge: 86400, secure: env.NODE_ENV === 'production',
    });
    await getDb().insertInto('activity_log').values({
      user_id: user.id, action: 'login', detail: null, ip: req.ip,
    } as any).execute();
    return { success: true };
  });

  app.post('/logout', async (req, reply) => {
    const sid = req.cookies?.session_id;
    if (sid) { await deleteSession(sid); reply.clearCookie('session_id', { path: '/' }); }
    return { success: true };
  });

  app.get('/me', { preHandler: [authPreHandler] }, async (req) => {
    const user = req.user!;
    const shops = await getDb().selectFrom('shop')
      .select(['id', 'name', 'channel'])
      .where('is_active', '=', true)
      .orderBy('id', 'asc')
      .execute();

    const activeShopId = req.shopId ?? shops[0]?.id ?? null;

    // Ambil features per shop dari subscription
    const subs = await getDb().selectFrom('shop_subscription')
      .innerJoin('subscription_plan', 'subscription_plan.id', 'shop_subscription.plan_id')
      .select(['shop_subscription.shop_id', 'subscription_plan.features', 'shop_subscription.features as override'])
      .execute();

    const featuresByShop = new Map<number, string[]>();
    for (const s of subs) {
      const f = (s.override ?? s.features) as string[];
      featuresByShop.set(s.shop_id, Array.isArray(f) ? f : ['reader']);
    }

    /* Label ikut app_role supaya role kustom tampil rapi, bukan nama mentah. */
    const roleRow = await getDb().selectFrom('app_role').select(['features', 'label'])
      .where('name', '=', user.role).executeTakeFirst();
    const roleFeatures: string[] = Array.isArray(roleRow?.features) ? roleRow!.features as string[] : ['reader'];

    /* id sudah number: parser INT8 di lib/db.ts yang menjamin, bukan cast di sini. */
    return {
      user: {
        name: user.fullName,
        initials: user.initials,
        role: user.role,
        role_label: roleRow?.label ?? user.roleLabel,
        role_features: roleFeatures,
      },
      active_shop_id: activeShopId,
      shops: shops.map(s => ({
        id: s.id, name: s.name, channel: s.channel,
        features: featuresByShop.get(s.id) ?? ['reader'],
      })),
    };
  });

  /* Switch active shop */
  app.post('/me/shop', { preHandler: [authPreHandler] }, async (req, reply) => {
    const { shop_id } = (req.body as any) ?? {};
    if (!shop_id) return reply.status(422).send({ message: 'shop_id wajib.' });

    const shop = await getDb().selectFrom('shop')
      .select('id').where('id', '=', Number(shop_id)).where('is_active', '=', true)
      .executeTakeFirst();
    if (!shop) return reply.status(404).send({ message: 'Toko tidak ditemukan.' });

    const sid = req.cookies?.session_id;
    if (sid) await setActiveShop(sid, Number(shop_id));

    return { active_shop_id: Number(shop_id) };
  });

  // ─── Shopee OAuth ───

  /* Admin masuk ke halaman ini → redirect ke Shopee OAuth. */
  app.get('/auth/shopee/authorize', { preHandler: [authPreHandler, requireRole(['admin'])] }, async (req, reply) => {
    const url = await beginShopeeAuth(reply, req.shopId ?? 1);
    logInfo(`Shopee authorize redirect`, { url });
    return reply.redirect(url);
  });

  /* Callback dari Shopee setelah user menyetujui. */
  app.get('/auth/shopee/callback', async (req, reply) => {
    const { code, state } = req.query as { code?: string; state?: string };
    const cookieVal = req.cookies?.[OAUTH_STATE_COOKIE];
    reply.clearCookie(OAUTH_STATE_COOKIE, { path: '/' });

    if (!code) {
      return reply.status(400).send({ message: 'Missing code from Shopee.' });
    }

    const separatorIdx = cookieVal?.indexOf('.') ?? -1;
    if (!cookieVal || !state || separatorIdx === -1) {
      return reply.status(400).send({ message: 'Invalid OAuth state.' });
    }

    // Bandingkan state dengan timing-safe compare — cek panjang dulu supaya
    // timingSafeEqual tidak throw pada buffer berbeda ukuran.
    const cookieState = cookieVal.slice(0, separatorIdx);
    const stateBuf = Buffer.from(state);
    const cookieStateBuf = Buffer.from(cookieState);
    if (stateBuf.length !== cookieStateBuf.length || !timingSafeEqual(stateBuf, cookieStateBuf)) {
      return reply.status(400).send({ message: 'Invalid OAuth state.' });
    }

    // shopId selalu dari cookie (server-signed session), bukan dari query — query
    // bisa dipalsukan siapa saja.
    const shopId = Number(cookieVal.slice(separatorIdx + 1));
    if (!Number.isInteger(shopId)) {
      return reply.status(400).send({ message: 'Invalid OAuth state.' });
    }

    try {
      await exchangeCodeForTokens(shopId, code);
      return reply.redirect(`${env.CORS_ORIGIN}/sinkron`); // Redirect ke halaman status di frontend
    } catch (err) {
      logInfo('Shopee auth callback failed', { error: (err as Error).message });
      return reply.status(500).send({ message: 'Otorisasi Shopee gagal.', error: (err as Error).message });
    }
  });

  /* Force re-authorize — hapus token, redirect ke authorize. */
  app.post('/auth/shopee/reauthorize', { preHandler: [authPreHandler, requireRole(['admin'])] }, async (req, reply) => {
    const shopId = req.shopId ?? 1;
    await clearShopTokens(shopId);
    const url = await beginShopeeAuth(reply, shopId);
    return { url };
  });
}
