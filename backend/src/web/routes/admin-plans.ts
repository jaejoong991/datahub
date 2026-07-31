import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getDb } from '../../lib/db.js';
import { authPreHandler } from '../../lib/auth.js';
import { requireRole } from '../../lib/rbac.js';

const shopSchema = z.object({
  name: z.string().min(1),
  channel: z.enum(['shopee', 'tokopedia', 'lazada', 'tiktok']),
  external_shop_id: z.string().optional(),
});

const planSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  monthly_price: z.coerce.number().min(0),
  features: z.array(z.string()).min(1),
});

const assignSchema = z.object({
  plan_id: z.coerce.number().int().positive(),
  features: z.array(z.string()).optional(),
  expires_at: z.string().nullable().optional(),
});

export async function adminPlanRoutes(app: FastifyInstance) {
  // ─── Shops ───
  app.get('/admin/shops', { preHandler: [authPreHandler, requireRole(['admin'])] }, async () => {
    return { rows: await getDb().selectFrom('shop').selectAll().orderBy('id', 'asc').execute() };
  });

  app.post('/admin/shops', { preHandler: [authPreHandler, requireRole(['admin'])] }, async (req, reply) => {
    const parsed = shopSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(422).send({ message: 'Data tidak valid.' });
    const shop = await getDb().insertInto('shop').values({
      channel: parsed.data.channel,
      name: parsed.data.name,
      external_shop_id: parsed.data.external_shop_id ?? parsed.data.channel + '-' + Date.now(),
      is_active: true,
    } as any).returningAll().executeTakeFirstOrThrow();
    return shop;
  });
  app.get('/admin/subscription-plans', { preHandler: [authPreHandler, requireRole(['admin'])] }, async () => {
    const plans = await getDb().selectFrom('subscription_plan').selectAll().orderBy('monthly_price', 'asc').execute();
    return { rows: plans };
  });

  app.post('/admin/subscription-plans', { preHandler: [authPreHandler, requireRole(['admin'])] }, async (req, reply) => {
    const parsed = planSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(422).send({ message: 'Data tidak valid.' });
    const plan = await getDb().insertInto('subscription_plan').values({
      name: parsed.data.name,
      description: parsed.data.description ?? '',
      monthly_price: parsed.data.monthly_price.toString(),
      features: JSON.stringify(parsed.data.features),
      is_active: true,
    } as any).returningAll().executeTakeFirstOrThrow();
    return plan;
  });

  app.put('/admin/subscription-plans/:id', { preHandler: [authPreHandler, requireRole(['admin'])] }, async (req, reply) => {
    const { id } = req.params as any;
    const parsed = planSchema.partial().safeParse(req.body);
    if (!parsed.success) return reply.status(422).send({ message: 'Data tidak valid.' });
    const update: any = {};
    if (parsed.data.name !== undefined) update.name = parsed.data.name;
    if (parsed.data.description !== undefined) update.description = parsed.data.description;
    if (parsed.data.monthly_price !== undefined) update.monthly_price = parsed.data.monthly_price.toString();
    if (parsed.data.features !== undefined) update.features = JSON.stringify(parsed.data.features);
    const plan = await getDb().updateTable('subscription_plan').set(update as any)
      .where('id', '=', Number(id)).returningAll().executeTakeFirstOrThrow();
    return plan;
  });

  app.get('/admin/shop-plans', { preHandler: [authPreHandler, requireRole(['admin'])] }, async () => {
    const shops = await getDb().selectFrom('shop')
      .leftJoin('shop_subscription', 'shop_subscription.shop_id', 'shop.id')
      .leftJoin('subscription_plan', 'subscription_plan.id', 'shop_subscription.plan_id')
      .select([
        'shop.id', 'shop.name as shop_name', 'shop.channel',
        'shop_subscription.plan_id', 'subscription_plan.name as plan_name',
        'shop_subscription.features', 'shop_subscription.active_since',
        'shop_subscription.expires_at', 'shop_subscription.is_trial',
      ])
      .orderBy('shop.id', 'asc')
      .execute();
    return { rows: shops };
  });

  app.post('/admin/shop-plans/:shopId', { preHandler: [authPreHandler, requireRole(['admin'])] }, async (req, reply) => {
    const { shopId } = req.params as any;
    const parsed = assignSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(422).send({ message: 'Data tidak valid.' });
    const expiresAt = parsed.data.expires_at ? new Date(parsed.data.expires_at) : null;
    const existing = await getDb().selectFrom('shop_subscription').where('shop_id', '=', Number(shopId)).executeTakeFirst();
    if (existing) {
      await getDb().updateTable('shop_subscription').set({
        plan_id: parsed.data.plan_id,
        features: parsed.data.features ? JSON.stringify(parsed.data.features) : null,
        expires_at: expiresAt,
        is_trial: false,
      } as any).where('shop_id', '=', Number(shopId)).execute();
    } else {
      await getDb().insertInto('shop_subscription').values({
        shop_id: Number(shopId), plan_id: parsed.data.plan_id,
        features: parsed.data.features ? JSON.stringify(parsed.data.features) : null,
        expires_at: expiresAt,
        active_since: new Date().toISOString().slice(0, 10),
      } as any).execute();
    }
    return { success: true };
  });
}
