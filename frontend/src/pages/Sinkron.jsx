import { api } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { Async } from '../components/states.jsx';
import { Card, Badge, Icon, Notice } from '../components/primitives.jsx';
import { formatCount, formatDateTimeWIB, relativeFromNow } from '../lib/format.js';

export default function Sinkron() {
  const jobs = useApi(api.syncJobs, {});
  const recon = useApi(api.reconciliation, {});

  return (
    <div className="page">
      <Async query={jobs} loadingRows={4}>
        {(d) => (
          <>
            <Card>
              <div className="card-head">
                <div style={{ flex: 1 }}>
                  <h2>Otorisasi toko</h2>
                  <span className="card-note">
                    Token berlaku sampai <span className="mono">{formatDateTimeWIB(d.token.expires_at)}</span> ·
                    refresh token sampai <span className="mono">{formatDateTimeWIB(d.token.refresh_expires_at)}</span>
                  </span>
                </div>
                <button className="btn"><Icon name="key" size={16} /> Otorisasi ulang toko</button>
              </div>
            </Card>

            <Card>
              <div className="card-head"><h2 style={{ flex: 1 }}>Pekerjaan sinkronisasi</h2></div>
              <div className="tblwrap">
                <table className="data" style={{ minWidth: 760 }}>
                  <thead>
                    <tr><th>Data</th><th>Terakhir sukses</th><th>Status</th><th /></tr>
                  </thead>
                  <tbody>
                    {d.rows.map((r) => (
                      <tr key={r.resource}>
                        <td>{r.label}</td>
                        <td className="mono">{relativeFromNow(r.last_success_at)}</td>
                        <td>
                          {r.status === 'ok'
                            ? <Badge tone="success">Normal</Badge>
                            : <Badge tone="danger">Gagal {r.consecutive_failures}×</Badge>}
                          {/* Pesan error ditampilkan apa adanya: admin membutuhkannya
                              untuk melapor ke Shopee. */}
                          {r.last_error && (
                            <div className="mono" style={{ marginTop: 6, fontSize: 11.5, color: 'var(--danger)' }}>
                              {r.last_error}
                            </div>
                          )}
                        </td>
                        <td><button className="btn">{r.status === 'ok' ? 'Sinkron sekarang' : 'Coba lagi'}</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="card-foot">
                <span>Panggilan API 24 jam: <span className="mono">{formatCount(d.api_calls_24h)}</span></span>
                <span>· Antrean: <span className="mono">{formatCount(d.queue_depth)}</span></span>
                <span>· Job gagal: <span className="mono" style={{ color: 'var(--danger)' }}>{formatCount(d.failed_jobs)}</span></span>
              </div>
            </Card>
          </>
        )}
      </Async>

      <Async query={recon} isEmpty={(dd) => dd.rows.length === 0} loadingRows={3}>
        {(d) => {
          const bad = d.rows.filter((r) => !r.is_match);
          return (
            <>
              {bad.length > 0 && (
                <Notice tone="danger" icon="rule" title={`Selisih rekonsiliasi pada ${bad.length} tanggal`}>
                  Jumlah order lokal berbeda dari Shopee. Proses ulang tanggal terkait — langkah ini
                  menjalankan kembali tahap parse dari data mentah dan tidak memanggil API Shopee.
                </Notice>
              )}
              <Card>
                <div className="card-head"><h2 style={{ flex: 1 }}>Rekonsiliasi 7 hari terakhir</h2></div>
                <div className="tblwrap">
                  <table className="data" style={{ minWidth: 620 }}>
                    <thead>
                      <tr><th>Tanggal</th><th className="n">Lokal</th><th className="n">Shopee</th><th>Hasil</th><th /></tr>
                    </thead>
                    <tbody>
                      {d.rows.map((r) => (
                        <tr key={r.check_date}>
                          <td className="mono">{r.check_date}</td>
                          <td className="n mono">{formatCount(r.local_count)}</td>
                          <td className="n mono">{formatCount(r.remote_count)}</td>
                          <td>
                            {r.is_match
                              ? <Badge tone="success">Cocok</Badge>
                              : <Badge tone="danger">Selisih {Math.abs(r.remote_count - r.local_count)} order</Badge>}
                          </td>
                          <td>{!r.is_match && <button className="btn">Proses ulang</button>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          );
        }}
      </Async>
    </div>
  );
}
