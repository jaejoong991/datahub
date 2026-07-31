import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getDb } from '../../lib/db.js';
import { hashPassword } from '../../lib/crypto.js';
import { authPreHandler } from '../../lib/auth.js';
import { requireRole } from '../../lib/rbac.js';

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(1),
  role: z.string().min(1),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(1).optional(),
  role: z.string().min(1).optional(),
});

export async function adminRoutes(app: FastifyInstance) {
  app.get('/admin/users', { preHandler: [authPreHandler, requireRole(['admin'])] }, async () => {
    const users = await getDb().selectFrom('app_user')
      .select(['id', 'email', 'full_name as name', 'role', 'is_active', 'created_at'])
      .orderBy('created_at', 'asc').execute();
    return { rows: users, total: users.length };
  });

  app.post('/admin/users', { preHandler: [authPreHandler, requireRole(['admin'])] }, async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(422).send({ message: 'Data tidak valid.' });
    const { name, email, password, role } = parsed.data;
    const existing = await getDb().selectFrom('app_user').select('id')
      .where('email', '=', email).executeTakeFirst();
    if (existing) return reply.status(422).send({ message: 'Email sudah terdaftar.', code: 'duplicate_email' });
    const passwordHash = await hashPassword(password);
    const user = await getDb().insertInto('app_user').values({
      email, password_hash: passwordHash, full_name: name, role, is_active: true,
    } as any).returning(['id', 'email', 'full_name as name', 'role', 'is_active', 'created_at'])
      .executeTakeFirstOrThrow();
    return user;
  });

  app.put('/admin/users/:id', { preHandler: [authPreHandler, requireRole(['admin'])] }, async (req, reply) => {
    const { id } = (req.params as any);
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(422).send({ message: 'Data tidak valid.' });
    const { name, email, password, role } = parsed.data;
    if (email) {
      const dupe = await getDb().selectFrom('app_user').select('id')
        .where('email', '=', email).where('id', '!=', Number(id)).executeTakeFirst();
      if (dupe) return reply.status(422).send({ message: 'Email sudah terdaftar.' });
    }
    const update: Record<string, any> = {};
    if (name) update.full_name = name;
    if (email) update.email = email;
    if (role) update.role = role;
    if (password) update.password_hash = await hashPassword(password);
    if (Object.keys(update).length === 0) return reply.status(422).send({ message: 'Tidak ada data yang diubah.' });
    return getDb().updateTable('app_user').set(update).where('id', '=', Number(id))
      .returning(['id', 'email', 'full_name as name', 'role', 'is_active', 'created_at'])
      .executeTakeFirstOrThrow();
  });

  app.post('/admin/users/:id/toggle', { preHandler: [authPreHandler, requireRole(['admin'])] }, async (req) => {
    const { id } = (req.params as any);
    const user = await getDb().selectFrom('app_user').select('is_active')
      .where('id', '=', Number(id)).executeTakeFirst();
    if (!user) throw new Error('User tidak ditemukan.');
    return getDb().updateTable('app_user').set({ is_active: !user.is_active })
      .where('id', '=', Number(id))
      .returning(['id', 'email', 'full_name as name', 'role', 'is_active', 'created_at'])
      .executeTakeFirstOrThrow();
  });
}
