/* Satu-satunya tempat angka diubah menjadi teks.
   Aturan yang ditegakkan di sini:
   - null/undefined  -> EMPTY_MARK ("—"), TIDAK PERNAH "Rp 0".
   - Rupiah tanpa desimal, pemisah ribuan titik (id-ID).
   - Waktu selalu WIB dan selalu diberi label "WIB". */

export const EMPTY_MARK = '—';

const idr = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
const dec1 = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const isMissing = (v) => v === null || v === undefined || v === '';

export function formatIDR(value) {
  if (isMissing(value)) return EMPTY_MARK;
  const n = Number(value);
  if (!Number.isFinite(n)) return EMPTY_MARK;
  return `${n < 0 ? '−' : ''}Rp ${idr.format(Math.abs(n))}`;
}

/** Angka tanpa prefiks Rp — untuk kolom tabel yang judulnya sudah menyebut rupiah. */
export function formatAmount(value) {
  if (isMissing(value)) return EMPTY_MARK;
  const n = Number(value);
  if (!Number.isFinite(n)) return EMPTY_MARK;
  return `${n < 0 ? '−' : ''}${idr.format(Math.abs(n))}`;
}

export function formatCount(value) {
  return isMissing(value) ? EMPTY_MARK : idr.format(Number(value));
}

export function formatPercent(value) {
  return isMissing(value) ? EMPTY_MARK : `${dec1.format(Number(value))}%`;
}

/** Ringkas untuk kartu KPI. Tabel dan export tetap angka penuh. */
export function formatCompactIDR(value) {
  if (isMissing(value)) return EMPTY_MARK;
  const n = Number(value);
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (abs >= 1e12) return `${sign}Rp ${dec1.format(abs / 1e12)} T`;
  if (abs >= 1e9) return `${sign}Rp ${dec1.format(abs / 1e9)} M`;
  if (abs >= 1e6) return `${sign}Rp ${dec1.format(abs / 1e6)} jt`;
  return formatIDR(n);
}

const WIB = 'Asia/Jakarta';

export function formatDateTimeWIB(iso) {
  if (isMissing(iso)) return EMPTY_MARK;
  const s = new Date(iso).toLocaleString('id-ID', {
    timeZone: WIB, day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  return `${s} WIB`;
}

export function formatDateWIB(iso) {
  if (isMissing(iso)) return EMPTY_MARK;
  return new Date(iso).toLocaleDateString('id-ID', {
    timeZone: WIB, day: '2-digit', month: 'short', year: 'numeric',
  });
}

export function relativeFromNow(iso) {
  if (isMissing(iso)) return EMPTY_MARK;
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'baru saja';
  if (mins < 60) return `${mins} mnt lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.floor(hours / 24)} hari lalu`;
}
