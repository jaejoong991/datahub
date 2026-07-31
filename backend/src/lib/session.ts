import crypto from 'node:crypto';
import { getDb } from './db.js';

const SESSION_TTL_MS = 24 * 3600_000;

export interface SessionData {
  id: string;
  userId: number;
  shopId: number | null;
  expiresAt: Date;
}

export async function createSession(userId: number, shopId?: number): Promise<string> {
  const id = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await getDb().insertInto('user_session').values({
    id, user_id: userId, shop_id: shopId ?? null, expires_at: expiresAt,
  }).execute();
  return id;
}

export async function getSession(sessionId: string): Promise<SessionData | null> {
  const row = await getDb().selectFrom('user_session')
    .selectAll()
    .where('id', '=', sessionId)
    .where('expires_at', '>', new Date())
    .executeTakeFirst();
  if (!row) return null;
  return { id: row.id, userId: row.user_id, shopId: row.shop_id, expiresAt: row.expires_at };
}

export async function setActiveShop(sessionId: string, shopId: number): Promise<void> {
  await getDb().updateTable('user_session')
    .set({ shop_id: shopId })
    .where('id', '=', sessionId)
    .execute();
}

export async function deleteSession(sessionId: string): Promise<void> {
  await getDb().deleteFrom('user_session').where('id', '=', sessionId).execute();
}

export async function cleanupExpiredSessions(): Promise<void> {
  await getDb().deleteFrom('user_session').where('expires_at', '<=', new Date()).execute();
}
