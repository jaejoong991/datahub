import { Icon } from './primitives.jsx';

/** Keadaan memuat: kerangka, bukan spinner layar penuh. Filter tetap dapat dipakai. */
export function Loading({ rows = 5, label = 'Memuat data' }) {
  return (
    <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: 10 }} aria-busy="true">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skel" style={{ width: `${92 - i * 7}%` }} />
      ))}
    </div>
  );
}

export function Empty({ title, description, actionLabel, onAction }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {description && <p>{description}</p>}
      {actionLabel && <button className="btn" onClick={onAction}>{actionLabel}</button>}
    </div>
  );
}

/** Error tidak minta maaf dan tidak kabur: apa yang terjadi, lalu apa yang bisa dilakukan. */
export function ErrorState({ error, onRetry }) {
  const forbidden = error?.status === 403;
  return (
    <div className="empty">
      <Icon name={forbidden ? 'lock' : 'cloud_off'} size={26} style={{ color: 'var(--ink-4)' }} />
      <strong style={{ marginTop: 8 }}>
        {forbidden ? 'Halaman ini di luar wewenang akun Anda' : 'Data tidak dapat dimuat'}
      </strong>
      <p>
        {error?.message ?? 'Terjadi gangguan saat mengambil data.'}
        {error?.code && <> <span className="mono">({error.code})</span></>}
      </p>
      {!forbidden && onRetry && <button className="btn" onClick={onRetry}>Coba lagi</button>}
    </div>
  );
}

/** Pembungkus: satu tempat untuk memetakan status query ke tampilan. */
export function Async({ query, isEmpty, empty, loadingRows, children }) {
  if (query.status === 'loading') return <Loading rows={loadingRows} />;
  if (query.status === 'error') return <ErrorState error={query.error} onRetry={query.reload} />;
  if (isEmpty?.(query.data)) return empty ?? <Empty title="Belum ada data" />;
  return children(query.data);
}
