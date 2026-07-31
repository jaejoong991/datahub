import type { FastifyRequest, FastifyReply } from 'fastify';
import { getDb } from './db.js';

const MONEY_COLUMN_IDS = new Set([
  'gross', 'commission_fee', 'service_fee', 'admin_fee',
  'seller_voucher', 'refund_amount', 'net_payout', 'price',
]);

export interface ColumnDef {
  id: string;
  label: string;
  align: 'left' | 'right';
  mono?: boolean;
  strong?: boolean;
  wrap?: boolean;
}

export function filterColumnsForRole(role: string, columns: ColumnDef[]): ColumnDef[] {
  if (role !== 'warehouse') return columns;
  return columns.filter(c => !MONEY_COLUMN_IDS.has(c.id));
}

export function filterRowsForRole<T extends Record<string, unknown>>(role: string, rows: T[]): T[] {
  if (role !== 'warehouse') return rows;
  return rows.map(row => {
    const filtered = { ...row };
    for (const key of Object.keys(filtered)) {
      if (MONEY_COLUMN_IDS.has(key)) delete filtered[key];
    }
    return filtered;
  });
}

/**
 * Cek role punya fitur (app_role.features) DAN shop subscription punya fitur.
 * Admin bypass semua.
 */
export function requireFeature(features: string[]) {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (req.user?.role === 'admin') return;

    // 1. Cek role features
    const roleRow = await getDb().selectFrom('app_role')
      .select('features').where('name','=',req.user!.role).executeTakeFirst();
    const roleFeatures: string[] = (roleRow?.features ?? []) as string[];
    if (!features.some(f => roleFeatures.includes(f))) {
      await reply.status(403).send({ message: 'Halaman ini di luar wewenang akun Anda.', code: 'forbidden' });
      return;
    }

    // 2. Cek shop features
    const shopId = req.shopId;
    if (!shopId) return;
    const sub = await getDb().selectFrom('shop_subscription')
      .innerJoin('subscription_plan', 'subscription_plan.id', 'shop_subscription.plan_id')
      .select(['subscription_plan.features', 'shop_subscription.features as override'])
      .where('shop_subscription.shop_id', '=', shopId)
      .executeTakeFirst();

    const raw: unknown = sub?.override ?? sub?.features ?? ['reader'];
    const shopFeatures: string[] = raw as string[];
    if (!features.some(f => shopFeatures.includes(f))) {
      await reply.status(403).send({
        message: 'Modul ini tidak tersedia di paket langganan Anda.',
        code: 'feature_not_enabled',
        required_features: features,
        current_features: shopFeatures,
      });
    }
  };
}

export function requireRole(roles: string[]) {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!req.user) {
      await reply.status(401).send({ message: 'Belum login.', code: 'unauthenticated' });
    } else if (!roles.includes(req.user.role)) {
      await reply.status(403).send({ message: 'Halaman ini di luar wewenang akun Anda.', code: 'forbidden' });
    }
  };
}
