import type { FastifyInstance } from 'fastify';
import { sql } from 'kysely';
import { getDb } from '../../lib/db.js';
import { authPreHandler, resolveActiveShopId } from '../../lib/auth.js';
import { requireFeature, type ColumnDef } from '../../lib/rbac.js';
import { paginatedResponse } from '../serializer.js';
import { parsePagination } from '../../lib/pagination.js';

const RELEASED_COLUMNS: ColumnDef[] = [
  { id: 'external_order_id', label: 'Nomor order', align: 'left', mono: true },
  { id: 'payout_date',       label: 'Tgl pelepasan', align: 'left', mono: true },
  { id: 'gross',             label: 'Bruto', align: 'right' },
  { id: 'commission_fee',    label: 'Komisi', align: 'right' },
  { id: 'service_fee',       label: 'Biaya layanan', align: 'right' },
  { id: 'admin_fee',         label: 'Biaya admin', align: 'right' },
  { id: 'seller_voucher',    label: 'Voucher penjual', align: 'right' },
  { id: 'refund_amount',     label: 'Refund', align: 'right' },
  { id: 'net_payout',        label: 'Payout bersih', align: 'right', strong: true },
  { id: 'status',            label: 'Status', align: 'left' },
];

const PENDING_COLUMNS: ColumnDef[] = [
  { id: 'external_order_id', label: 'Nomor order', align: 'left', mono: true },
  { id: 'eta',               label: 'Perkiraan pelepasan', align: 'left', mono: true },
  { id: 'gross',             label: 'Bruto order', align: 'right' },
  { id: 'commission_fee',    label: 'Komisi', align: 'right' },
  { id: 'service_fee',       label: 'Biaya layanan', align: 'right' },
  { id: 'admin_fee',         label: 'Biaya admin', align: 'right' },
  { id: 'seller_voucher',    label: 'Voucher penjual', align: 'right' },
  { id: 'net_payout',        label: 'Payout bersih', align: 'right', strong: true },
  { id: 'status',            label: 'Status', align: 'left' },
];

export async function financeRoutes(app: FastifyInstance) {
  app.get('/finance/summary', { preHandler: [authPreHandler, requireFeature(['finance', 'order'])] }, async (req, reply) => {
    const role = req.user!.role;
    const shopId = resolveActiveShopId(req, reply);
    if (shopId === null) return;
    const released = await sql<{ order_count: number; gross: string; total_fee: string | null; net_payout: string | null }>`
      SELECT count(*)::int as order_count, coalesce(sum(s.gross),0) as gross,
             coalesce(sum(s.commission_fee + s.service_fee + s.admin_fee),0) as total_fee,
             coalesce(sum(s.net_payout),0) as net_payout
      FROM sales_order o JOIN settlement s ON s.order_id = o.id
      WHERE o.shop_id = ${shopId} AND s.is_released = true
    `.execute(getDb());
    const releasedRow = released.rows[0] ?? { order_count: 0, gross: '0', total_fee: '0', net_payout: '0' };
    const pending = await sql<{ order_count: number; gross: string }>`
      SELECT count(*)::int as order_count, coalesce(sum(o.gross_amount),0) as gross
      FROM sales_order o LEFT JOIN settlement s ON s.order_id = o.id
      WHERE o.shop_id = ${shopId} AND (s.order_id IS NULL OR s.is_released = false)
    `.execute(getDb());
    const pendingRow = pending.rows[0] ?? { order_count: 0, gross: '0' };
    return {
      period: { from: null, to: null, basis: 'payout_date' },
      released: { order_count: releasedRow.order_count, gross: Number(releasedRow.gross), total_fee: Number(releasedRow.total_fee), net_payout: Number(releasedRow.net_payout) },
      pending: { order_count: pendingRow.order_count, gross: Number(pendingRow.gross), total_fee: null, net_payout: null },
      identity_balanced: true,
    };
  });

  app.get<{ Querystring: { page?: string; limit?: string } }>('/finance/released', { preHandler: [authPreHandler, requireFeature(['finance', 'order'])] }, async (req, reply) => {
    const role = req.user!.role;
    const shopId = resolveActiveShopId(req, reply);
    if (shopId === null) return;
    const pagination = parsePagination(req.query, reply);
    if (!pagination) return;
    const { page, limit, offset } = pagination;
    const rows = await sql<any>`
      SELECT o.external_order_id, s.payout_date, s.gross, s.commission_fee, s.service_fee,
             s.admin_fee, s.seller_voucher, s.refund_amount, s.net_payout,
             CASE WHEN s.refund_amount > 0 THEN 'retur' ELSE 'completed' END as status
      FROM sales_order o JOIN settlement s ON s.order_id = o.id
      WHERE o.shop_id = ${shopId} AND s.is_released = true
      ORDER BY s.payout_date DESC NULLS LAST LIMIT ${limit} OFFSET ${offset}
    `.execute(getDb());
    const countResult = await sql<{ count: number }>`
      SELECT count(*)::int as count FROM sales_order o JOIN settlement s ON s.order_id = o.id
      WHERE o.shop_id = ${shopId} AND s.is_released = true
    `.execute(getDb());
    return paginatedResponse(RELEASED_COLUMNS, rows.rows, countResult.rows[0]?.count ?? 0, page, limit, role);
  });

  app.get<{ Querystring: { page?: string; limit?: string } }>('/finance/pending', { preHandler: [authPreHandler, requireFeature(['finance', 'order'])] }, async (req, reply) => {
    const role = req.user!.role;
    const shopId = resolveActiveShopId(req, reply);
    if (shopId === null) return;
    const pagination = parsePagination(req.query, reply);
    if (!pagination) return;
    const { page, limit, offset } = pagination;
    const rows = await sql<any>`
      SELECT o.external_order_id, s.payout_date as eta, o.gross_amount as gross,
             NULL as commission_fee, NULL as service_fee, NULL as admin_fee,
             NULL as seller_voucher, NULL as refund_amount, NULL as net_payout,
             o.channel_status, false as is_released
      FROM sales_order o LEFT JOIN settlement s ON s.order_id = o.id
      WHERE o.shop_id = ${shopId} AND (s.order_id IS NULL OR s.is_released = false)
      ORDER BY o.ordered_at DESC LIMIT ${limit} OFFSET ${offset}
    `.execute(getDb());
    const countResult = await sql<{ count: number }>`
      SELECT count(*)::int as count FROM sales_order o LEFT JOIN settlement s ON s.order_id = o.id
      WHERE o.shop_id = ${shopId} AND (s.order_id IS NULL OR s.is_released = false)
    `.execute(getDb());
    return paginatedResponse(PENDING_COLUMNS, rows.rows, countResult.rows[0]?.count ?? 0, page, limit, role);
  });

  app.get('/finance/fees', { preHandler: [authPreHandler, requireFeature(['finance'])] }, async (req, reply) => {
    const shopId = resolveActiveShopId(req, reply);
    if (shopId === null) return;
    const feeRow = await sql<{ gross: string; comm: string; serv: string; adm: string; voucher: string; other: string }>`
      SELECT coalesce(sum(s.gross),0) as gross, coalesce(sum(s.commission_fee),0) as comm,
             coalesce(sum(s.service_fee),0) as serv, coalesce(sum(s.admin_fee),0) as adm,
             coalesce(sum(s.seller_voucher),0) as voucher, coalesce(sum(s.other_fee),0) as other
      FROM settlement s JOIN sales_order o ON o.id = s.order_id
      WHERE o.shop_id = ${shopId} AND s.is_released = true
    `.execute(getDb());
    const f = feeRow.rows[0] ?? { gross: '0', comm: '0', serv: '0', adm: '0', voucher: '0', other: '0' };
    const gross = Number(f.gross);
    const pct = (n: number) => gross > 0 ? Math.round((n / gross) * 1000) / 10 : 0;
    const rows = [
      { id: 'commission_fee', label: 'Komisi', amount: Number(f.comm), pct: pct(Number(f.comm)), flagged: false },
      { id: 'service_fee', label: 'Biaya layanan', amount: Number(f.serv), pct: pct(Number(f.serv)), flagged: false },
      { id: 'admin_fee', label: 'Biaya administrasi', amount: Number(f.adm), pct: pct(Number(f.adm)), flagged: false },
      { id: 'seller_voucher', label: 'Voucher penjual', amount: Number(f.voucher), pct: pct(Number(f.voucher)), flagged: false },
      { id: 'other_fee', label: 'Biaya lain', amount: Number(f.other), pct: pct(Number(f.other)), flagged: Number(f.other) > gross * 0.005 },
    ];
    const totalAmt = rows.reduce((s, r) => s + r.amount, 0);
    return { gross, rows, total: { amount: totalAmt, pct: pct(totalAmt) } };
  });
}
