import { api } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { Async } from '../components/states.jsx';
import { Card, Badge, Icon, Notice } from '../components/primitives.jsx';
import { formatCount } from '../lib/format.js';

/* Daftar kirim: sengaja tanpa nilai uang sama sekali. */
export default function Gudang() {
  const list = useApi(api.pickList, {});

  return (
    <div className="page">
      <Notice icon="visibility_off" title="Tampilan tanpa nilai uang">
        Peran Gudang tidak menerima kolom harga, biaya, maupun payout — disaring di server.
      </Notice>

      <Async query={list} isEmpty={(d) => d.rows.length === 0}
             empty={<Card><div className="empty"><strong>Tidak ada order yang perlu dikirim</strong>
                    <p>Semua order pada antrean hari ini sudah diproses.</p></div></Card>}>
        {(d) => (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
            {d.rows.map((o) => (
              <Card key={o.external_order_id}>
                <div className="card-head" style={{ alignItems: 'center', paddingBottom: 14, borderBottom: '1px solid var(--line)' }}>
                  <span className="mono" style={{ fontSize: 13, fontWeight: 700 }}>{o.external_order_id}</span>
                  <span className="card-note" style={{ margin: 0 }}>{o.cutoff}</span>
                  <span style={{ marginLeft: 'auto' }}>
                    {o.urgent
                      ? <Badge tone="danger" icon="bolt">Kirim hari ini</Badge>
                      : <Badge tone="neutral" icon="schedule">Terjadwal</Badge>}
                  </span>
                </div>
                <ul style={{ listStyle: 'none', margin: 0, padding: '10px 18px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {o.items.map((it) => (
                    <li key={it.sku} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                      <span className="mono" style={{ color: 'var(--ink-3)', width: 78, flexShrink: 0 }}>{it.sku}</span>
                      <span style={{ flex: 1 }}>{it.name}</span>
                      <span className="mono" style={{ fontWeight: 700 }}>{formatCount(it.qty)}×</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        )}
      </Async>

      <div className="legend">
        <Icon name="info" size={15} />
        <span>Daftar ini mengikuti status order di Shopee dan diperbarui setiap 15 menit.</span>
      </div>
    </div>
  );
}
