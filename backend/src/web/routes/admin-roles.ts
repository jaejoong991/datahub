import type { FastifyInstance } from 'fastify';
import { getDb } from '../../lib/db.js';
import { authPreHandler } from '../../lib/auth.js';
import { requireRole } from '../../lib/rbac.js';

interface RoleBody {
  name?: string;
  label?: string;
  features?: string[];
}

interface RoleParams {
  name: string;
}

export async function adminRoleRoutes(app: FastifyInstance) {
  app.get('/admin/roles', { preHandler: [authPreHandler, requireRole(['admin'])] }, async () => {
    return { rows: await getDb().selectFrom('app_role').selectAll().orderBy('id', 'asc').execute() };
  });

  app.post<{ Body: RoleBody }>('/admin/roles', { preHandler: [authPreHandler, requireRole(['admin'])] }, async (req, reply) => {
    const { name, label, features } = req.body;
    if (!name || !label) return reply.status(422).send({ message: 'Nama dan label wajib.' });
    return getDb().insertInto('app_role').values({
      name, label, features: JSON.stringify(features || []), is_system: false,
    }).returningAll().executeTakeFirstOrThrow();
  });

  app.put<{ Params: RoleParams; Body: RoleBody }>('/admin/roles/:name', { preHandler: [authPreHandler, requireRole(['admin'])] }, async (req, reply) => {
    const { name } = req.params;
    const { label, features } = req.body;
    if (!label) return reply.status(422).send({ message: 'Label wajib.' });
    const update: { label: string; features?: string } = { label };
    if (features) update.features = JSON.stringify(features);
    return getDb().updateTable('app_role').set(update).where('name', '=', name).returningAll().executeTakeFirstOrThrow();
  });

  app.delete<{ Params: RoleParams }>('/admin/roles/:name', { preHandler: [authPreHandler, requireRole(['admin'])] }, async (req, reply) => {
    const { name } = req.params;
    const role = await getDb().selectFrom('app_role').selectAll().where('name', '=', name).executeTakeFirst();
    if (!role) return reply.status(404).send({ message: 'Role tidak ditemukan.' });
    if (role.is_system) return reply.status(400).send({ message: 'System role tidak bisa dihapus.' });
    await getDb().deleteFrom('app_role').where('name', '=', name).execute();
    return { success: true };
  });
}
