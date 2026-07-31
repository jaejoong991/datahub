import { useState } from 'react';
import { api } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { Async } from '../components/states.jsx';
import { Card, KpiCard, Icon, Badge, Notice } from '../components/primitives.jsx';
import { formatAmount, formatCount } from '../lib/format.js';
import DateRangePicker from '../components/DateRangePicker.jsx';

export default function Exports() {
  const exports = useApi(api.exports, {});
  const [date, setDate] = useState(null);

  return (
    <div className="page">
      <div className="toolbar">
        <span className="kicker">Export</span>
        <DateRangePicker value={date} onChange={setDate} />
        <button className="btn btn-primary"><Icon name="add" size={16} /> Export Baru</button>
      </div>

      <Async query={exports} isEmpty={d => d.rows.length === 0}
        empty={<div className="empty"><strong>Belum ada export</strong><p>Buat export CSV pertama.</p></div>}>
        {d => (
          <div className="tblwrap">
            <table className="data" style={{ minWidth: 600 }}>
              <thead><tr><th>Tanggal</th><th>Modul</th><th>Filter</th><th>Baris</th><th>Status</th><th /></tr></thead>
              <tbody>
                {d.rows.map(r => (
                  <tr key={r.id}>
                    <td className="mono">{r.created_at}</td>
                    <td>{r.module}</td>
                    <td style={{ color: 'var(--ink-2)', fontSize: 11 }}>{r.filters}</td>
                    <td className="n mono">{formatCount(r.row_count)}</td>
                    <td>{r.status === 'done' ? <Badge tone="success">Selesai</Badge> : r.status === 'running' ? <Badge tone="warning">Diproses</Badge> : <Badge tone="danger">Gagal</Badge>}</td>
                    <td>{r.status === 'done' && <button className="btn" style={{ padding: '4px 10px' }}><Icon name="download" size={15} /> Unduh</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Async>
    </div>
  );
}
