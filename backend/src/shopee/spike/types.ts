/**
 * Tipe bersama untuk spike API Fase 0.5 (Lampiran A PRD).
 *
 * `id` setiap probe mengikuti nomor urut baris checkbox di Lampiran A,
 * mis. "A.3.2c" = sub-item ketiga ("biaya layanan") dari item kedua
 * ("Pastikan komponen berikut terpisah...") seksi A.3. Ini supaya report.ts
 * bisa dicocokkan balik ke PRD baris per baris tanpa tebak-tebakan.
 */

export type ProbeModule = 'Auth' | 'Order' | 'Finance' | 'Product' | 'Reliability';

export type ProbeStatus = 'ok' | 'fail' | 'skipped';

/** Hasil pengecekan satu field spesifik yang diminta Lampiran A (mis. "komisi"). */
export interface FieldCheck {
  /** Label field dalam Bahasa Indonesia, persis istilah di Lampiran A. */
  label: string;
  /** Path ke field itu di raw response (mis. "response.order_income.commission_fee"). */
  path: string;
  present: boolean;
  value?: unknown;
}

export interface ProbeResult {
  /** Nomor Lampiran A, mis. "A.3.2c". */
  id: string;
  /** Kutipan literal (atau parafrase dekat) baris checklist terkait. */
  checklistRef: string;
  module: ProbeModule;
  label: string;
  status: ProbeStatus;
  /** Penjelasan singkat hasil — untuk fail, ini pesan error asli. */
  detail: string;
  fields?: FieldCheck[];
  /** Nama file JSON mentah di spike-output/, kalau ada panggilan API yang tersimpan. */
  savedAs?: string;
  /** Angka/catatan tambahan (mis. estimasi panggilan per hari). */
  meta?: Record<string, unknown>;
}

/** State yang dibagi antar-probe dalam satu run (id sample dari probe sebelumnya). */
export interface ProbeContext {
  shopId: number;
  results: ProbeResult[];
  sampleOrderSn?: string;
  sampleItemId?: number;
  sampleReturnSn?: string;
}

export type ModuleVerdict = 'CONFIRMED' | 'NOT_POSSIBLE' | 'NEEDS_SCOPE_CHANGE' | 'UNVERIFIED';
