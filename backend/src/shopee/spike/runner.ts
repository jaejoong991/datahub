/**
 * Runner generik satu probe: panggil endpoint, simpan raw response (atau raw
 * error) ke disk, cek field yang diminta Lampiran A, dan catat hasilnya ke
 * ProbeContext. Semua probe modul (auth/order/finance/product/reliability)
 * pakai fungsi ini supaya perilakunya konsisten.
 *
 * Sengaja tidak melempar (throw) kalau satu probe gagal — satu endpoint yang
 * bermasalah tidak boleh menghentikan probe lain, karena tujuan spike adalah
 * mengumpulkan bukti selengkap mungkin dalam satu jalan, bukan berhenti di
 * kegagalan pertama (kecuali A.3 gagal total — itu ditandai khusus, lihat
 * report.ts).
 */
import { checkFields, describeError, saveRaw, serializeError, sleep } from './util.js';
import type { FieldCheck, ProbeContext, ProbeModule, ProbeResult } from './types.js';

/* Jeda antar-panggilan — sopan ke rate limit sandbox. Bukan pengganti queue
   produksi (lihat F-nonfunctional "Batasan platform"), cuma cukup untuk spike
   manual 20-30 panggilan. */
const PROBE_DELAY_MS = 300;

export interface ProbeDef {
  id: string;
  checklistRef: string;
  module: ProbeModule;
  label: string;
  /** Field yang wajib dicek di raw response, sesuai istilah Lampiran A. */
  fields?: { label: string; path: string }[];
  call: () => Promise<unknown>;
}

export async function runProbe(ctx: ProbeContext, def: ProbeDef): Promise<unknown> {
  await sleep(PROBE_DELAY_MS);
  try {
    const raw = await def.call();
    const fields: FieldCheck[] | undefined = def.fields ? checkFields(raw, def.fields) : undefined;
    const savedAs = await saveRaw(def.id, raw);
    const result: ProbeResult = {
      id: def.id,
      checklistRef: def.checklistRef,
      module: def.module,
      label: def.label,
      status: 'ok',
      detail: 'Panggilan berhasil.',
      fields,
      savedAs,
    };
    ctx.results.push(result);
    return raw;
  } catch (err) {
    const detail = describeError(err);
    const savedAs = await saveRaw(`${def.id}-error`, serializeError(err));
    ctx.results.push({
      id: def.id,
      checklistRef: def.checklistRef,
      module: def.module,
      label: def.label,
      status: 'fail',
      detail,
      savedAs,
    });
    return undefined;
  }
}

/** Catat item checklist yang sengaja dilewati (mis. tidak ada sample order/return). */
export function skipProbe(ctx: ProbeContext, def: Pick<ProbeDef, 'id' | 'checklistRef' | 'module' | 'label'>, reason: string): void {
  ctx.results.push({ id: def.id, checklistRef: def.checklistRef, module: def.module, label: def.label, status: 'skipped', detail: reason });
}

/**
 * Cek field pada raw response yang SUDAH diambil oleh probe lain (tidak
 * memanggil API lagi) — dipakai saat satu checklist item Lampiran A adalah
 * "pastikan tersedia field X, Y, Z" atas hasil panggilan yang sama dengan
 * item sebelumnya (mis. A.2.2 ambil detail order, A.2.3 verifikasi fieldnya).
 */
export function recordFieldCheck(
  ctx: ProbeContext,
  def: Pick<ProbeDef, 'id' | 'checklistRef' | 'module' | 'label'>,
  raw: unknown,
  fields: { label: string; path: string }[],
): void {
  if (raw === undefined) {
    skipProbe(ctx, def, 'Panggilan sumber datanya gagal/tidak ada — lihat probe sebelumnya.');
    return;
  }
  const checked = checkFields(raw, fields);
  const allPresent = checked.every((f) => f.present);
  ctx.results.push({
    ...def,
    status: allPresent ? 'ok' : 'fail',
    detail: allPresent ? 'Semua field yang diminta Lampiran A tersedia.' : `Field hilang: ${checked.filter((f) => !f.present).map((f) => f.label).join(', ')}.`,
    fields: checked,
  });
}

/** Catat hasil yang tidak lewat runProbe (mis. derived/computed, bukan panggilan API). */
export function recordDerived(
  ctx: ProbeContext,
  def: Pick<ProbeDef, 'id' | 'checklistRef' | 'module' | 'label'>,
  status: ProbeResult['status'],
  detail: string,
  meta?: Record<string, unknown>,
): void {
  ctx.results.push({ id: def.id, checklistRef: def.checklistRef, module: def.module, label: def.label, status, detail, meta });
}
