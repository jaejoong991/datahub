import { useState } from 'react';
import { api } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { Async } from '../components/states.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { Card, KpiCard, Icon } from '../components/primitives.jsx';
import Chart from '../components/Chart.jsx';
import DateRangePicker from '../components/DateRangePicker.jsx';
import { formatCompactIDR, formatCount } from '../lib/format.js';

export default function Ringkasan({ role }) {
  const [dateRange, setDateRange] = useState(null);
  const [topPage, setTopPage] = useState(1);
  const [topPageSize, setTopPageSize] = useState(50);

  const params = dateRange ?? {};
  const summary = useApi(api.salesSummary, params);
  const trend = useApi(api.salesTrend, params);
  const top = useApi(api.topProducts, { page: topPage, limit: topPageSize, ...params });
  const showMoney = role !== 'warehouse';

  return (
    <div className="page">
      <div className="toolbar">
        <span className="kicker">Periode</span>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      <Async query={summary} loadingRows={3}>
        {(d) => (
          <div className="kpis">
            <KpiCard icon="payments" color="var(--info)" label="Bruto penjualan"
                     value={showMoney ? formatCompactIDR(d.gross) : '—'} sub="periode berjalan" delta={d.deltas.gross} />
            <KpiCard icon="receipt_long" color="var(--warning)" label="Jumlah order"
                     value={formatCount(d.order_count)} sub="periode berjalan" delta={d.deltas.order_count} />
            <KpiCard icon="shopping_bag" color="var(--primary)" label="Rata-rata nilai order"
                     value={showMoney ? formatCompactIDR(d.average_order_value) : '—'} delta={d.deltas.average_order_value} />
            <KpiCard icon="inventory" color="var(--success)" label="Item terjual"
                     value={formatCount(d.items_sold)} delta={d.deltas.items_sold} />
          </div>
        )}
      </Async>

      <div className="grid-2">
        <Card>
          <div className="card-head">
            <div style={{ flex: 1 }}>
              <h2>Tren penjualan harian</h2>
              <span className="card-note">Bruto per hari (WIB).</span>
            </div>
          </div>
          <Async query={trend} isEmpty={(d) => d.rows.length === 0}>
            {(d) => (
              <div style={{ padding: '0 8px 8px' }}>
                <Chart
                  type="bar"
                  data={d.rows}
                  xKey="report_date"
                  series={[{ key: 'gross', name: 'Bruto' }]}
                  height={260}
                  dateKey
                  loading={trend.status === 'loading'}
                />
              </div>
            )}
          </Async>
        </Card>

        <Card>
          <div className="card-head">
            <div style={{ flex: 1 }}>
              <h2>Produk terlaris</h2>
              <span className="card-note">Berdasarkan qty terjual.</span>
            </div>
          </div>
          <Async query={top} isEmpty={(d) => d.rows.length === 0}>
            {(d) => (
              <DataTable
                columns={d.columns} rows={d.rows} minWidth={420} rowKey="sku"
                page={topPage} pageSize={topPageSize} total={d.meta?.total ?? d.total}
                onPageChange={setTopPage} onPageSizeChange={(s) => { setTopPageSize(s); setTopPage(1); }}
              />
            )}
          </Async>
        </Card>
      </div>

      <div className="legend">
        <Icon name="info" size={15} />
        <span>
          Bruto berasal dari tabel order. Payout bersih hanya boleh dibaca dari halaman Keuangan,
          karena sumbernya data settlement yang datang belakangan.
        </span>
      </div>
    </div>
  );
}
