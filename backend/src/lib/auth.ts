import type { FastifyRequest, FastifyReply } from 'fastify';
import { getSession, deleteSession } from './session.js';
import { getDb } from './db.js';

export interface AuthUser {
  id: number;
  email: string;
  fullName: string;
  role: string;
  initials: string;
  roleLabel: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
    shopId?: number | null;
  }
}

const ROLE_LABELS: Record<string, string> = {
  sales: 'Sales · Baca saja',
  finance: 'Finance · Baca saja',
  warehouse: 'Gudang · Baca saja',
  admin: 'Admin',
};

function makeInitials(name: string): string {
  return name.split(' ').map(w => w[0]).filter(Boolean).join('').toUpperCase().slice(0, 2);
}

export async function authPreHandler(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const sessionId = req.cookies?.session_id;
  if (!sessionId) {
    reply.status(401).send({ message: 'Sesi berakhir. Masuk kembali.', code: 'unauthenticated' });
    return;
  }
  const session = await getSession(sessionId);
  if (!session) {
    reply.clearCookie('session_id', { path: '/' });
    reply.status(401).send({ message: 'Sesi berakhir. Masuk kembali.', code: 'unauthenticated' });
    return;
  }
  const user = await getDb().selectFrom('app_user')
    .selectAll()
    .where('id', '=', session.userId)
    .executeTakeFirst();
  if (!user || !user.is_active) {
    await deleteSession(sessionId);
    reply.status(401).send({ message: 'Akun tidak aktif.', code: 'account_disabled' });
    return;
  }
  req.user = {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    role: user.role,
    initials: makeInitials(user.full_name),
    roleLabel: ROLE_LABELS[user.role] ?? user.role,
  };
  req.shopId = session.shopId;
}
