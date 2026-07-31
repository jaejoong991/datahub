/**
 * Util kecil untuk spike API: simpan raw response ke disk, baca field
 * bertingkat lewat path string, dan bentuk pesan error yang bisa dibaca
 * manusia dari error SDK Shopee.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ShopeeApiError, ShopeeSdkError } from '../../../vendor/shopee-sdk/lib/errors.js';
import type { FieldCheck } from './types.js';

export const OUTPUT_DIR = path.resolve(process.cwd(), 'spike-output');

export async function ensureOutputDir(): Promise<void> {
  await mkdir(OUTPUT_DIR, { recursive: true });
}

/** Simpan data mentah sebagai bukti (fixture) — dipakai testing & lampiran laporan klien. */
export async function saveRaw(id: string, data: unknown): Promise<string> {
  const filename = `${id.replace(/\./g, '-')}.json`;
  await writeFile(path.join(OUTPUT_DIR, filename), JSON.stringify(data, null, 2), 'utf-8');
  return filename;
}

/** Ambil nilai dari path bertitik, mendukung indeks array: "response.order_list[0].order_sn". */
export function getByPath(obj: unknown, fieldPath: string): unknown {
  const parts = fieldPath.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

/** Cocokkan raw response terhadap daftar field yang diminta Lampiran A. */
export function checkFields(raw: unknown, fields: { label: string; path: string }[]): FieldCheck[] {
  return fields.map((f) => {
    const value = getByPath(raw, f.path);
    return { label: f.label, path: f.path, present: value !== undefined && value !== null, value };
  });
}

export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Ubah error dari SDK Shopee jadi pesan + bentuk mentah yang bisa disimpan.
 * ShopeeApiError = respons error asli dari Shopee (status HTTP + body) — ini
 * PERSIS bukti "bentuk respons error" yang diminta A.5.2, jadi jangan dibuang.
 */
export function describeError(err: unknown): string {
  if (err instanceof ShopeeApiError) {
    return `ShopeeApiError (HTTP ${err.status}): ${JSON.stringify(err.data)}`;
  }
  if (err instanceof ShopeeSdkError) {
    return `ShopeeSdkError: ${err.message}`;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

export function serializeError(err: unknown): unknown {
  if (err instanceof ShopeeApiError) {
    return { kind: 'ShopeeApiError', status: err.status, data: err.data };
  }
  if (err instanceof ShopeeSdkError) {
    return { kind: 'ShopeeSdkError', message: err.message };
  }
  if (err instanceof Error) {
    return { kind: err.name, message: err.message, stack: err.stack };
  }
  return { kind: 'unknown', value: err };
}
