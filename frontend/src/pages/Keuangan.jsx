import { useState } from 'react';
import { api } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { Async } from '../components/states.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { Card, KpiCard, Badge, Icon, Money, Notice } from '../components/primitives.jsx';
import { formatCompactIDR, formatCount, formatPercent, EMPTY_MARK } from '../lib/format.js';

/* Layar inti produk. Dua panel sengaja TIDAK pernah dijumlahkan:
   nilai gabungan tidak bisa dicocokkan dengan mutasi bank, dan itu
   penyebab paling umum hilangnya kepercayaan Finance. Tidak ada satu pun
   baris kode di bawah yang menambahkan released + pending. */

export default function Keuangan({ role }) {
  const [basis, setBasis] = useState('payout_date');
  const [query, setQuery] = useState('');

  const summary = useApi(api.settlementSummary, { basis });
  const released = useApi(api.settlementReleased, { basis, q: query });
  const pending = useApi(api.settlementPending, { basis, q: query });
  const fees = useApi(api.feeBreakdown, { basis });

  return (
    <div className="page">
      <div className="toolbar">
        <span className="kicker">Dasar tanggal</span>
        <div className="tabs" role="group" aria-label="Dasar tanggal">
          <button aria-pressed={basis === 'ordered_at'} onClick={() => setBasis('ordered_at')}>Tanggal order</button>
          <button aria-pressed={basis === 'payout_date'} onClick={() => setBasis('payout_date')}>Tanggal dana dilepas</button>
        </div>
        <div className="pill">
          <Icon name="calendar_month" size={16} style={{ color: 'var(--ink-3)' }} />
          <span className="mono">01–27 Jul 2026</span>
        </div>
        <input
          className="input" style={{ width: 230 }} value={query} placeholder="Cari nomor order"
          onChange={(e) => setQuery(e.target.value)} aria-label="Cari nomor order"
        />
        <div className="legend" style={{ marginLeft: 'auto' }}>
          <span className="mono" style={{ color: 'var(--ink-2)', fontSize: 13 }}>{EMPTY_MARK}</span>
          <span>berarti nilai belum tersedia dari Shopee — bukan nol.</span>
        </div>
      </div>

      {basis === 'ordered_at' && (
        <Notice tone="warning" icon="info" title="Dasar tanggal order tidak untuk rekonsiliasi bank">
          Untuk mencocokkan dengan mutasi rekening, gunakan tanggal dana dilepas.
        </Notice>
      )}

      {role === 'warehouse' && (
        <Notice icon="visibility_off" title="Kolom nilai uang tidak dikirim untuk peran Gudang">
          Penyaringan dilakukan di server — nilainya tidak pernah sampai ke browser.
        </Notice>
      )}

      {/* ---------- panel 1: dana sudah dilepas ---------- */}
      <Card>
        <div className="card-head">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 260 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
              <Icon name="task_alt" size={21} color="var(--success)" />
              <h2>Dana sudah dilepas</h2>
              {summary.data && <Badge tone="success">{formatCount(summary.data.released.order_count)} order</Badge>}
            </div>
            <span className="card-note">
              Nilai final dari data settlement. Angka di panel ini boleh dicocokkan dengan mutasi bank.
            </span>
          </div>
          {summary.status === 'ready' && (
            <div className="kpis" style={{ flex: '1 1 420px' }}>
              <KpiCard icon="receipt_long" color="var(--info)" label="Total bruto"
                       value={formatCompactIDR(summary.data.released.gross)} />
              <KpiCard icon="remove_circle" color="var(--danger)" label="Biaya & potongan"
                       value={formatCompactIDR(summary.data.released.total_fee)} />
              <KpiCard icon="account_balance" color="var(--success)" label="Payout bersih"
                       value={formatCompactIDR(summary.data.released.net_payout)} />
            </div>
          )}
        </div>

        <Async query={released} isEmpty={(d) => d.rows.length === 0}
               empty={<div className="empty"><strong>Tidak ada order pada rentang ini</strong>
                      <p>Coba perluas rentang tanggal atau hapus kata kunci pencarian.</p></div>}>
          {(d) => <DataTable columns={d.columns} rows={d.rows} minWidth={1180} />}
        </Async>

        <div className="card-foot">
          <Icon name="rule" size={16} style={{ color: 'var(--ink-3)' }} />
          <span>
            {summary.data?.identity_balanced
              ? <>Identitas keuangan seimbang untuk seluruh order pada periode ini — selisih <span className="mono">Rp 0</span>.</>
              : <>Ada order yang identitas keuangannya tidak seimbang. Periksa pemetaan komponen biaya.</>}
          </span>
        </div>
      </Card>

      {/* ---------- pemisah tegas antar panel ---------- */}
      <div className="divider">
        <span className="line" />
        <span className="lbl">TIDAK DIHITUNG DALAM TOTAL DI ATAS</span>
        <span className="line" />
      </div>

      {/* ---------- panel 2: menunggu pelepasan ---------- */}
      <Card dashed>
        <div className="card-head">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 260 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
              <Icon name="hourglass_top" size={21} color="var(--ink-2)" />
              <h2>Menunggu pelepasan dana</h2>
              {summary.data && <Badge tone="neutral" icon="schedule">{formatCount(summary.data.pending.order_count)} order</Badge>}
            </div>
            <span className="card-note">
              Rincian biaya baru dikirim Shopee setelah dana dilepas. Sampai saat itu nilainya
              ditulis <span className="mono">{EMPTY_MARK}</span> — jangan dianggap nol dan jangan dijumlahkan.
            </span>
          </div>
          {summary.status === 'ready' && (
            <div className="kpis" style={{ flex: '1 1 300px' }}>
              <KpiCard icon="pending" label="Perkiraan bruto" value={formatCompactIDR(summary.data.pending.gross)} />
              {/* null -> Money merender "—". Tidak ada jalan untuk menampilkan Rp 0. */}
              <KpiCard icon="account_balance" label="Payout bersih"
                       value={<Money value={summary.data.pending.net_payout} />} sub="belum tersedia" />
            </div>
          )}
        </div>

        <Async query={pending} isEmpty={(d) => d.rows.length === 0}
               empty={<div className="empty"><strong>Tidak ada order yang menunggu pelepasan</strong>
                      <p>Semua order pada periode ini sudah dilepas dananya.</p></div>}>
          {(d) => <DataTable columns={d.columns} rows={d.rows} minWidth={1180} />}
        </Async>

        <div className="card-foot">
          <Icon name="info" size={16} style={{ color: 'var(--ink-3)' }} />
          <span>Order di panel ini tidak masuk ke total payout dan tidak diekspor ke jurnal harian.</span>
        </div>
      </Card>

      {/* ---------- rincian biaya ---------- */}
      {role !== 'warehouse' && (
        <Card>
          <div className="card-head">
            <h2 style={{ flex: 1 }}>Rincian biaya periode ini</h2>
            <span className="card-note">Persentase dihitung terhadap bruto.</span>
          </div>
          <Async query={fees} isEmpty={(d) => d.rows.length === 0} loadingRows={4}>
            {(d) => (
              <div className="tblwrap">
                <table className="data" style={{ minWidth: 560 }}>
                  <thead>
                    <tr><th>Komponen</th><th className="n">Nilai</th><th className="n">%</th><th /></tr>
                  </thead>
                  <tbody>
                    {d.rows.map((r) => (
                      <tr key={r.id}>
                        <td>{r.label}</td>
                        <td className="n"><Money value={r.amount} /></td>
                        <td className="n mono">{formatPercent(r.pct)}</td>
                        <td>{r.flagged && <Badge tone="warning">Periksa pemetaan</Badge>}</td>
                      </tr>
                    ))}
                    <tr>
                      <td className="strong">Total biaya</td>
                      <td className="n"><Money value={d.total.amount} strong /></td>
                      <td className="n mono strong">{formatPercent(d.total.pct)}</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </Async>
          <div className="card-foot">
            <Icon name="troubleshoot" size={16} style={{ color: 'var(--ink-3)' }} />
            <span>
              “Biaya lain” menampung komponen yang belum dipetakan eksplisit. Bila porsinya membesar,
              ada jenis biaya baru dari Shopee yang perlu ditambahkan ke pemetaan.
            </span>
          </div>
        </Card>
      )}
    </div>
  );
}
