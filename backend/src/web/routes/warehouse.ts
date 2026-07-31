import type { FastifyInstance } from 'fastify';
import { sql } from 'kysely';
import { getDb } from '../../lib/db.js';
import { authPreHandler, resolveActiveShopId } from '../../lib/auth.js';
import { requireFeature } from '../../lib/rbac.js';

export async function warehouseRoutes(app: FastifyInstance) {
  app.get('/warehouse/picklist', { preHandler: [authPreHandler, requireFeature(['logistics', 'warehouse'])] }, async (req, reply) => {
    const shopId = resolveActiveShopId(req, reply);
    if (shopId === null) return;
    const orders = await sql<any>`
      SELECT o.external_order_id, o.ordered_at, o.channel_status
      FROM sales_order o
      WHERE o.shop_id = ${shopId} AND o.status IN ('processing', 'shipped')
      ORDER BY o.ordered_at ASC LIMIT 50
    `.execute(getDb());
    const rows = [];
    for (const order of orders.rows) {
      const items = await sql<any>`
        SELECT i.sku, i.product_name as name, i.qty
        FROM sales_order_item i JOIN sales_order o ON o.id = i.order_id
        WHERE o.external_order_id = ${order.external_order_id}
      `.execute(getDb());
      const isUrgent = Date.now() - new Date(order.ordered_at).getTime() > 86400_000;
      rows.push({
        external_order_id: order.external_order_id,
        cutoff: isUrgent ? 'Kirim hari ini' : 'Terjadwal',
        urgent: isUrgent,
        items: items.rows.map((i: any) => ({ sku: i.sku, name: i.name, qty: i.qty })),
      });
    }
    return { rows };
  });
}
