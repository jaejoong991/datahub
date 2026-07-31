import { api } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { Async } from '../components/states.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { Card, KpiCard, Badge, Icon } from '../components/primitives.jsx';
import { formatCount, formatDateTimeWIB } from '../lib/format.js';

export default function Stok() {
  const summary = useApi(api.stockSummary, {});
  const rows = useApi(api.products, {});

  return (
    <div className="page">
      <Async query={summary} loadingRows={2}>
        {(d) => (
          <div className="kpis">
            <KpiCard icon="inventory_2" color="var(--primary)" label="SKU aktif" value={formatCount(d.sku_active)} />
            <KpiCard icon="warning" color="var(--warning)" label="Stok rendah" value={formatCount(d.sku_low)} sub="di bawah ambang" />
            <KpiCard icon="do_not_disturb_on" color="var(--danger)" label="Stok habis" value={formatCount(d.sku_out)} />
          </div>
        )}
      </Async>

      <Card>
        <div className="card-head">
          <h2 style={{ flex: 1 }}>Produk &amp; varian</h2>
          {/* Label jenis stok wajib: mencegah salah banding dengan Seller Centre. */}
          <Badge tone="neutral" icon="inventory">{summary.data?.stock_type_label ?? 'Stok'}</Badge>
          {summary.data && (
            <span className="card-note">
              Snapshot harian terakhir <span className="mono">{formatDateTimeWIB(summary.data.snapshot_at)}</span>
            </span>
          )}
        </div>
        <Async query={rows} isEmpty={(d) => d.rows.length === 0}
               empty={<div className="empty"><strong>Belum ada produk tersinkron</strong>
                      <p>Sinkronisasi produk berjalan setiap 6 jam.</p></div>}>
          {(d) => <DataTable columns={d.columns} rows={d.rows} minWidth={820} rowKey="sku" />}
        </Async>
        <div className="card-foot">
          <Icon name="help" size={16} style={{ color: 'var(--ink-3)' }} />
          <span>
            Angka yang ditampilkan adalah jenis stok yang tertulis pada label di atas — pastikan
            membandingkannya dengan kolom yang sama di Seller Centre.
          </span>
        </div>
      </Card>
    </div>
  );
}
