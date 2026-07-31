import type { FastifyInstance } from 'fastify';
import pg from 'pg';
import { getDb } from '../../lib/db.js';
import { getEnv } from '../../lib/env.js';
import { authPreHandler, resolveActiveShopId } from '../../lib/auth.js';
import { requireRole, requireFeature } from '../../lib/rbac.js';

export async function syncRoutes(app: FastifyInstance) {
  app.get('/sync/state', { preHandler: [authPreHandler] }, async (req, reply) => {
    const shopId = resolveActiveShopId(req, reply);
    if (shopId === null) return;
    const states = await getDb().selectFrom('sync_state').selectAll()
      .where('shop_id', '=', shopId).execute();
    let minSuccess: Date | null = null;
    for (const s of states) {
      if (s.last_success_at && (!minSuccess || s.last_success_at < minSuccess)) minSuccess = s.last_success_at;
    }
    const isStale = !minSuccess || (Date.now() - minSuccess.getTime()) > 30 * 60_000;
    return { last_success_at: minSuccess, stale_threshold_minutes: 30, is_stale: isStale };
  });

  app.get('/sync/jobs', { preHandler: [authPreHandler, requireRole(['admin']), requireFeature(['reader'])] }, async (req, reply) => {
    const shopId = resolveActiveShopId(req, reply);
    if (shopId === null) return;
    const states = await getDb().selectFrom('sync_state').selectAll()
      .where('shop_id', '=', shopId).execute();
    const labelMap: Record<string, string> = {
      order: 'Order', settlement: 'Keuangan', product: 'Produk', stock_snapshot: 'Snapshot stok',
    };
    const rows = states.map(s => ({
      resource: s.resource, label: labelMap[s.resource] ?? s.resource,
      last_success_at: s.last_success_at,
      status: s.consecutive_failures > 0 ? 'failed' as const : 'ok' as const,
      consecutive_failures: s.consecutive_failures, last_error: s.last_error,
    }));
    const shop = await getDb().selectFrom('shop').selectAll()
      .where('id', '=', shopId).executeTakeFirst();
    const apiCalls = 0; // TODO: query count from api_call_log
    return {
      rows, token: { expires_at: shop?.token_expires_at, refresh_expires_at: shop?.refresh_expires_at },
      api_calls_24h: apiCalls, queue_depth: 0, failed_jobs: rows.filter(r => r.status === 'failed').length,
    };
  });

  app.get('/sync/reconciliation', { preHandler: [authPreHandler, requireRole(['admin']), requireFeature(['reader'])] }, async (req, reply) => {
    const shopId = resolveActiveShopId(req, reply);
    if (shopId === null) return;
    const rows = await getDb().selectFrom('reconciliation_check').selectAll()
      .where('shop_id', '=', shopId).orderBy('check_date', 'desc').limit(7).execute();
    return { rows };
  });
}
