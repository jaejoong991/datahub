import type { FastifyInstance } from 'fastify';
import { sql } from 'kysely';
import { getDb } from '../../lib/db.js';
import { authPreHandler, resolveActiveShopId } from '../../lib/auth.js';
import { requireFeature, type ColumnDef } from '../../lib/rbac.js';
import { paginatedResponse } from '../serializer.js';
import { parsePagination } from '../../lib/pagination.js';

const PRODUCT_COLUMNS: ColumnDef[] = [
  { id: 'sku', label: 'SKU', align: 'left', mono: true },
  { id: 'name', label: 'Nama produk', align: 'left', wrap: true },
  { id: 'price', label: 'Harga', align: 'right' },
  { id: 'stock', label: 'Stok', align: 'right', strong: true },
  { id: 'threshold', label: 'Ambang', align: 'right' },
  { id: 'condition', label: 'Kondisi', align: 'left' },
];

export async function productsRoutes(app: FastifyInstance) {
  app.get('/products/summary', { preHandler: [authPreHandler, requireFeature(['product', 'warehouse'])] }, async (req, reply) => {
    const shopId = resolveActiveShopId(req, reply);
    if (shopId === null) return;
    const stats = await sql<{ active: number; low: number; out: number }>`
      SELECT count(*)::int as active,
             count(*) filter (where stock < low_stock_threshold)::int as low,
             count(*) filter (where stock = 0)::int as out
      FROM product WHERE shop_id = ${shopId}
    `.execute(getDb());
    const s = stats.rows[0] ?? { active: 0, low: 0, out: 0 };
    return { sku_active: s.active, sku_low: s.low, sku_out: s.out, stock_type_label: 'Stok tersedia', snapshot_at: null };
  });

  app.get<{ Querystring: { page?: string; limit?: string } }>('/products', { preHandler: [authPreHandler, requireFeature(['product', 'warehouse'])] }, async (req, reply) => {
    const role = req.user!.role;
    const shopId = resolveActiveShopId(req, reply);
    if (shopId === null) return;
    const pagination = parsePagination(req.query, reply);
    if (!pagination) return;
    const { page, limit, offset } = pagination;
    const rows = await sql<any>`
      SELECT sku, name || coalesce(' · ' || variant_name, '') as name, price,
             stock, low_stock_threshold as threshold,
             CASE WHEN stock = 0 THEN 'out' WHEN stock < low_stock_threshold THEN 'low' ELSE 'ok' END as condition
      FROM product WHERE shop_id = ${shopId}
      ORDER BY name LIMIT ${limit} OFFSET ${offset}
    `.execute(getDb());
    const countResult = await sql<{ count: number }>`
      SELECT count(*)::int as count FROM product WHERE shop_id = ${shopId}
    `.execute(getDb());
    return paginatedResponse(PRODUCT_COLUMNS, rows.rows, countResult.rows[0]?.count ?? 0, page, limit, role);
  });
}
