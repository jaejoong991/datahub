import type { FastifyInstance } from 'fastify';
import { sql } from 'kysely';
import { getDb } from '../../lib/db.js';
import { authPreHandler, resolveActiveShopId } from '../../lib/auth.js';
import { requireFeature, type ColumnDef } from '../../lib/rbac.js';
import { paginatedResponse } from '../serializer.js';
import { parsePagination } from '../../lib/pagination.js';

const TOP_COLUMNS: ColumnDef[] = [
  { id: 'sku', label: 'SKU', align: 'left', mono: true },
  { id: 'name', label: 'Produk', align: 'left', wrap: true },
  { id: 'qty', label: 'Qty', align: 'right' },
  { id: 'gross', label: 'Nilai', align: 'right' },
];

export async function salesRoutes(app: FastifyInstance) {
  app.get('/sales/summary', { preHandler: [authPreHandler, requireFeature(['order', 'sales'])] }, async (req, reply) => {
    const shopId = resolveActiveShopId(req, reply);
    if (shopId === null) return;
    const row = await sql<{ gross: string; order_count: number; items_sold: number; aov: string }>`
      SELECT coalesce(sum(o.gross_amount),0) as gross, count(*)::int as order_count,
             coalesce(sum(i.qty),0)::int as items_sold,
             CASE WHEN count(*) > 0 THEN sum(o.gross_amount) / count(*) ELSE 0 END as aov
      FROM sales_order o LEFT JOIN sales_order_item i ON i.order_id = o.id
      WHERE o.shop_id = ${shopId}
    `.execute(getDb());
    const d = row.rows[0] ?? { gross: '0', order_count: 0, items_sold: 0, aov: '0' };
    return {
      period: { from: null, to: null },
      gross: Number(d.gross), order_count: d.order_count, average_order_value: Number(d.aov),
      items_sold: d.items_sold, net_payout: 0,
      deltas: { gross: 0, order_count: 0, average_order_value: 0, items_sold: 0 },
    };
  });

  app.get('/sales/trend', { preHandler: [authPreHandler, requireFeature(['order', 'sales'])] }, async (req, reply) => {
    const shopId = resolveActiveShopId(req, reply);
    if (shopId === null) return;
    const rows = await sql<{ report_date: string; gross: string }>`
      SELECT report_date, sum(gross_amount) as gross
      FROM sales_order WHERE shop_id = ${shopId}
      GROUP BY report_date ORDER BY report_date DESC LIMIT 30
    `.execute(getDb());
    if (rows.rows.length === 0) return { max: 0, rows: [] };
    const max = rows.rows.reduce((m, r) => Math.max(m, Number(r.gross)), 0);
    return { max, rows: rows.rows.map(r => ({ report_date: r.report_date, gross: Number(r.gross) })).reverse() };
  });

  app.get<{ Querystring: { page?: string; limit?: string } }>('/sales/top-products', { preHandler: [authPreHandler, requireFeature(['order', 'sales'])] }, async (req, reply) => {
    const role = req.user!.role;
    const shopId = resolveActiveShopId(req, reply);
    if (shopId === null) return;
    const pagination = parsePagination(req.query, reply);
    if (!pagination) return;
    const { page, limit, offset } = pagination;
    const rows = await sql<any>`
      SELECT i.sku, max(i.product_name) as name, sum(i.qty)::int as qty, sum(i.line_total) as gross
      FROM sales_order_item i JOIN sales_order o ON o.id = i.order_id
      WHERE o.shop_id = ${shopId} AND i.sku IS NOT NULL
      GROUP BY i.sku ORDER BY qty DESC LIMIT ${limit} OFFSET ${offset}
    `.execute(getDb());
    const countResult = await sql<{ count: number }>`
      SELECT count(distinct i.sku)::int as count
      FROM sales_order_item i JOIN sales_order o ON o.id = i.order_id
      WHERE o.shop_id = ${shopId} AND i.sku IS NOT NULL
    `.execute(getDb());
    return paginatedResponse(TOP_COLUMNS, rows.rows, countResult.rows[0]?.count ?? 0, page, limit, role);
  });
}
