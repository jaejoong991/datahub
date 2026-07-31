// src/lib/pagination.ts
import { z } from 'zod';
import type { FastifyReply } from 'fastify';

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

/* Skema query pagination bersama utk semua rute list (sales/finance/products).
   page & limit dari query string selalu string|undefined → pakai coerce.
   SENGAJA tidak ada .max() di sini: limit kegedean di-CLAMP di parsePagination()
   bawah, bukan ditolak — biar client yang lupa kasih limit tetap dapat respons
   valid. Yang ditolak (422) cuma non-numeric / bukan integer / < 1. */
const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).default(DEFAULT_LIMIT),
});

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

/* Parse & validasi query pagination. Kalau invalid, langsung kirim 422 dan
   balikin null — pemanggil tinggal `if (!pagination) return;`. Limit kegedean
   di-clamp ke MAX_LIMIT supaya `?limit=999999999` tidak bikin LIMIT tanpa
   batas di SQL. */
export function parsePagination(query: unknown, reply: FastifyReply): PaginationParams | null {
  const parsed = paginationQuerySchema.safeParse(query);
  if (!parsed.success) {
    reply.status(422).send({ message: 'Parameter page/limit tidak valid.', code: 'validation_error' });
    return null;
  }
  const { page } = parsed.data;
  const limit = Math.min(parsed.data.limit, MAX_LIMIT);
  return { page, limit, offset: (page - 1) * limit };
}
