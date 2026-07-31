import { Money, Num, Badge } from './primitives.jsx';
import Pagination from './Pagination.jsx';

/* Kolom datang DARI SERVER, bukan dari daftar tetap di frontend.
   Kalau server tidak mengirim kolom uang (peran gudang), kolom itu memang
   tidak ada — bukan disembunyikan dengan CSS. Frontend hanya merender
   apa yang diberikan. */

const MONEY_FIELDS = new Set([
  'gross', 'commission_fee', 'service_fee', 'admin_fee',
  'seller_voucher', 'refund_amount', 'net_payout', 'price',
]);

const COUNT_FIELDS = new Set(['qty', 'stock', 'threshold', 'order_count', 'items_sold']);

const CONDITION = {
  ok:  { tone: 'success', icon: 'check_circle', label: 'Aman' },
  low: { tone: 'warning', icon: 'warning',      label: 'Perlu restock' },
  out: { tone: 'danger',  icon: 'do_not_disturb_on', label: 'Habis' },
};

function defaultCell(row, col) {
  const value = row[col.id];

  if (col.id === 'status') {
    if (row.has_refund) return <Badge tone="warning" icon="undo">Retur sebagian</Badge>;
    if (row.is_released) return <Badge tone="success">Selesai</Badge>;
    return <Badge tone="neutral" icon="hourglass_top">{row.channel_status ?? 'Menunggu'}</Badge>;
  }
  if (col.id === 'condition') {
    const c = CONDITION[value] ?? CONDITION.ok;
    return <Badge tone={c.tone} icon={c.icon}>{c.label}</Badge>;
  }
  if (MONEY_FIELDS.has(col.id)) return <Money value={value} strong={col.strong} />;
  if (COUNT_FIELDS.has(col.id)) return <Num value={value} />;
  if (col.mono) return <span className="mono">{value}</span>;
  return value;
}

/**
 * DataTable — tabel server-driven dengan pagination opsional.
 *
 * Props tambahan (opsional):
 *   page, pageSize, total, onPageChange, onPageSizeChange: pagination
 *   onRowClick: (row) => void — klik baris
 */
export function DataTable({
  columns, rows, minWidth = 900, renderCell, rowKey = 'external_order_id',
  page, pageSize, total, onPageChange, onPageSizeChange, onRowClick,
}) {
  return (
    <>
      <div className="tblwrap">
        <table className="data" style={{ minWidth }}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.id} className={c.align === 'right' ? 'n' : undefined}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row[rowKey] ?? i}
                className={onRowClick ? 'clickable' : undefined}
                onClick={() => onRowClick?.(row)}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter') onRowClick(row); } : undefined}
              >
                {columns.map((c) => (
                  <td
                    key={c.id}
                    className={[c.align === 'right' ? 'n' : '', c.strong ? 'strong' : ''].filter(Boolean).join(' ')}
                    style={c.wrap ? { whiteSpace: 'normal' } : undefined}
                  >
                    {(renderCell?.(row, c) ?? defaultCell(row, c))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {page !== undefined && (
        <Pagination
          page={page}
          pageSize={pageSize ?? 50}
          total={total ?? 0}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </>
  );
}
