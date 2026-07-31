import { formatAmount, formatCount, isMissing, EMPTY_MARK } from '../lib/format.js';

export const Icon = ({ name, size = 18, color, style }) => (
  <span className="ms" aria-hidden="true" style={{ fontSize: size, color, ...style }}>{name}</span>
);

/**
 * Satu-satunya cara merender nilai uang di aplikasi ini.
 * Nilai null/undefined SELALU menjadi "—", tidak pernah "Rp 0".
 * Jangan pernah menulis {row.net_payout} langsung di JSX.
 */
export function Money({ value, strong = false, withPrefix = false }) {
  if (isMissing(value)) {
    return (
      <span className="mono miss" title="Belum tersedia dari Shopee — bukan nol">
        {EMPTY_MARK}
      </span>
    );
  }
  const n = Number(value);
  const text = withPrefix ? `Rp ${formatAmount(n)}` : formatAmount(n);
  return (
    <span className={`mono${n < 0 ? ' neg' : ''}`} style={strong ? { fontWeight: 700 } : undefined}>
      {text}
    </span>
  );
}

export const Num = ({ value }) => <span className="mono">{formatCount(value)}</span>;

/* Setiap badge punya ikon + teks, tidak pernah warna saja (aksesibilitas). */
const TONE_ICON = { success: 'check_circle', warning: 'warning', danger: 'error', info: 'info', neutral: 'circle' };

export function Badge({ tone = 'neutral', icon, children }) {
  return (
    <span className={`badge badge-${tone}`}>
      <Icon name={icon ?? TONE_ICON[tone]} size={13} />
      {children}
    </span>
  );
}

export function Card({ children, dashed = false, style }) {
  return <section className={`card${dashed ? ' dashed' : ''}`} style={style}>{children}</section>;
}

export function KpiCard({ label, value, sub, icon, color, delta }) {
  return (
    <div className="kpi">
      <span className="lbl">
        {icon && <Icon name={icon} size={15} color={color} />}
        {label}
      </span>
      <div className="val">{value}</div>
      {(sub || delta !== undefined) && (
        <div className="sub">
          {delta !== undefined && delta !== null && (
            <span style={{ color: delta >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
              {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%{' '}
            </span>
          )}
          {sub}
        </div>
      )}
    </div>
  );
}

export function Notice({ tone = 'neutral', icon, title, children }) {
  return (
    <div className={`notice${tone === 'neutral' ? '' : ` ${tone}`}`}>
      <Icon name={icon ?? 'info'} size={19} />
      <div>
        <strong>{title}</strong>
        {children && <p>{children}</p>}
      </div>
    </div>
  );
}
