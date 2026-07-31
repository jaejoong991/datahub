import { useState, useCallback, useRef } from 'react';
import { api, API_MODE, apiPost, apiPut } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { Async } from '../components/states.jsx';
import { Icon, Badge } from '../components/primitives.jsx';
import { formatAmount } from '../lib/format.js';
import { mockSession } from '../mocks/index.js';

const ALL_FEATURES = [
  // Data
  { key: 'reader', label: 'Data Viewer', group: 'Dasar' },
  { key: 'export', label: 'Export CSV', group: 'Dasar' },
  // Order & Payment
  { key: 'order', label: 'Order (Pesanan)', group: 'Transaksi' },
  { key: 'finance', label: 'Keuangan & Escrow', group: 'Transaksi' },
  { key: 'returns', label: 'Retur & Refund', group: 'Transaksi' },
  // Produk
  { key: 'product', label: 'Produk & Varian', group: 'Katalog' },
  { key: 'media', label: 'Media (Gambar/Video)', group: 'Katalog' },
  { key: 'category', label: 'Kategori Toko', group: 'Katalog' },
  // Gudang
  { key: 'warehouse', label: 'Stok & Gudang', group: 'Operasional' },
  { key: 'logistics', label: 'Logistik & Kirim', group: 'Operasional' },
  { key: 'tiered_wh', label: 'Multi-Warehouse (Merchant)', group: 'Operasional' },
  { key: 'fbs', label: 'Fulfillment Shopee (FBS)', group: 'Operasional' },
  { key: 'firstmile', label: 'First Mile Pickup', group: 'Operasional' },
  // Promosi
  { key: 'voucher', label: 'Voucher Diskon', group: 'Promosi' },
  { key: 'discount', label: 'Diskon Produk', group: 'Promosi' },
  { key: 'bundle', label: 'Bundle Deal', group: 'Promosi' },
  { key: 'addon', label: 'Add-On Deal', group: 'Promosi' },
  { key: 'flashsale', label: 'Flash Sale', group: 'Promosi' },
  { key: 'toppicks', label: 'Top Picks Koleksi', group: 'Promosi' },
  { key: 'livestream', label: 'Live Streaming', group: 'Promosi' },
  { key: 'video', label: 'Video Produk', group: 'Promosi' },
  // Iklan
  { key: 'ads', label: 'Iklan Shopee (Ads)', group: 'Iklan' },
  { key: 'ams', label: 'Affiliate (AMS)', group: 'Iklan' },
  // Tambahan
  { key: 'account_health', label: 'Kesehatan Toko', group: 'Laporan' },
  { key: 'global_product', label: 'Cross-Border', group: 'Khusus' },
  { key: 'erp', label: 'Integrasi Accurate', group: 'Integrasi' },
];

export default function AdminPlans({ onPlanChange }) {
  const plans = useApi(api.adminPlans, {});
  const shopPlans = useApi(api.adminShopPlans, {});
  const [tab, setTab] = useState('plans');
  const [editPlan, setEditPlan] = useState(null);
  const [assignShop, setAssignShop] = useState(null);
  const [editShop, setEditShop] = useState(null);
  const [savingMsg, setSavingMsg] = useState(null);

  async function savePlan(plan, isNew, reload) {
    setSavingMsg('Menyimpan…');
    if (API_MODE === 'mock') {
      const { rows } = await api.adminPlans({});
      const idx = rows.findIndex(p => p.id === plan.id);
      if (idx >= 0) Object.assign(rows[idx], { ...plan, features: [...plan.features] });
      else rows.push({ ...plan, id: rows.length + 1, features: [...plan.features] });
      reload(); setEditPlan(null); setSavingMsg(null);
      return;
    }
    const body = { name: plan.name, description: plan.description || '', monthly_price: plan.monthly_price || 0, features: plan.features || ['reader'] };
    try {
      if (isNew) await apiPost('/admin/subscription-plans', body);
      else await apiPut(`/admin/subscription-plans/${plan.id}`, body);
      reload(); setEditPlan(null);
    } catch (err) { alert(err.message); }
    setSavingMsg(null);
  }

  async function saveAssign(shop, planId, expiresAt, reload) {
    setSavingMsg('Menyimpan…');
    if (API_MODE === 'mock') {
      const { rows } = await api.adminPlans({});
      const plan = rows.find(p => p.id === Number(planId));
      if (plan) {
        mockSession.shopFeatures = mockSession.shopFeatures ?? {};
        mockSession.shopFeatures[shop.id] = [...plan.features];
      }
      setTimeout(() => { reload(); setAssignShop(null); setSavingMsg(null); onPlanChange?.(); }, 200);
      return;
    }
    try {
      await apiPost(`/admin/shop-plans/${shop.id}`, { plan_id: Number(planId), expires_at: expiresAt || undefined });
      reload(); setAssignShop(null); onPlanChange?.();
    } catch (err) { alert(err.message); }
    setSavingMsg(null);
  }

  return (
    <div className="page">
      <div className="toolbar">
        <span className="kicker">Admin</span>
        <div className="tabs">
          <button aria-pressed={tab === 'plans'} onClick={() => setTab('plans')}>Paket</button>
          <button aria-pressed={tab === 'shops'} onClick={() => setTab('shops')}>Toko</button>
        </div>
      </div>

      {tab === 'plans' && (
        <Async query={plans} isEmpty={(d) => d.rows.length === 0}>
          {(d) => (
            <>
              <div className="toolbar">
                <span style={{ fontSize: 13, fontWeight: 600 }}>Paket Berlangganan</span>
                <button className="btn btn-primary" onClick={() => setEditPlan({ name: '', monthly_price: 0, features: ['reader'], is_active: true })}>
                  <Icon name="add" size={16} /> Tambah Paket
                </button>
              </div>
              <div className="tblwrap">
                <table className="data" style={{ minWidth: 680 }}>
                  <thead><tr><th>Nama</th><th>Harga</th><th>Fitur</th><th>Status</th><th /></tr></thead>
                  <tbody>
                    {d.rows.map(p => (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 700 }}>{p.name}</td>
                        <td className="mono">{Number(p.monthly_price) === 0 ? 'Gratis' : formatAmount(p.monthly_price) + '/bln'}</td>
                        <td style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {(p.features || []).map(f => <Badge key={f} tone="info">{ALL_FEATURES.find(x => x.key === f)?.label || f}</Badge>)}
                        </td>
                        <td>{p.is_active ? <Badge tone="success">Aktif</Badge> : <Badge tone="neutral">Nonaktif</Badge>}</td>
                        <td><button className="btn" style={{ padding: '4px 10px' }} onClick={() => setEditPlan(p)}><Icon name="edit" size={15} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {editPlan && <PlanModal plan={editPlan} saving={!!savingMsg} onSave={(p, isNew) => savePlan(p, isNew, plans.reload)} onClose={() => setEditPlan(null)} />}
            </>
          )}
        </Async>
      )}

      {tab === 'shops' && (
        <Async query={shopPlans} isEmpty={(d) => d.rows.length === 0}>
          {(d) => (
            <>
              <div className="toolbar">
                <span style={{ fontSize: 13, fontWeight: 600 }}>Toko</span>
                <button className="btn btn-primary" onClick={() => setEditShop({ name: '', channel: 'shopee', external_shop_id: '' })}>
                  <Icon name="add" size={16} /> Tambah Toko
                </button>
              </div>
              <div className="tblwrap">
                <table className="data" style={{ minWidth: 680 }}>
                  <thead><tr><th>Toko</th><th>Channel</th><th>Paket</th><th>Status</th><th>Masa Berlaku</th><th /></tr></thead>
                  <tbody>
                    {d.rows.map(s => (
                      <tr key={s.id}>
                        <td style={{ fontWeight: 700 }}>{s.shop_name}</td>
                        <td><span className="mono">{s.channel}</span></td>
                        <td><Badge tone={s.plan_name ? 'success' : 'neutral'}>{s.plan_name || 'Belum dipilih'}</Badge></td>
                        <td>{s.is_trial ? <Badge tone="warning">Trial</Badge> : <Badge tone="success">Aktif</Badge>}</td>
                        <td className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>{s.expires_at ? `Sampai ${s.expires_at}` : 'Tak terbatas'}</td>
                        <td><button className="btn" style={{ padding: '4px 10px' }} onClick={() => setAssignShop(s)}><Icon name="edit" size={15} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {assignShop && <AssignModal shop={assignShop} plans={plans.data?.rows || []} saving={!!savingMsg} onSave={(shopId, planId, expiresAt) => saveAssign(shopId, planId, expiresAt, shopPlans.reload)} onClose={() => setAssignShop(null)} />}
              {editShop && <ShopForm shop={editShop} onClose={() => { setEditShop(null); shopPlans.reload(); }} />}
            </>
          )}
        </Async>
      )}
    </div>
  );
}

function PlanModal({ plan, saving, onSave, onClose }) {
  const [form, setForm] = useState(plan);
  const isNew = !plan.id;

  function toggleFeature(key) {
    const f = form.features || [];
    setForm({ ...form, features: f.includes(key) ? f.filter(x => x !== key) : [...f, key] });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{isNew ? 'Tambah Paket' : 'Edit Paket'}</h2>
          <button className="modal-close" onClick={onClose}><Icon name="close" size={20} /></button>
        </div>
        <div style={{ padding: '0 20px 20px' }}>
          <label className="login-field">
            <span className="login-label">Nama</span>
            <input className="input login-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} disabled={saving} />
          </label>
          <label className="login-field">
            <span className="login-label">Harga/bulan (Rp)</span>
            <input className="input login-input" type="number" value={form.monthly_price} onChange={e => setForm({...form, monthly_price: Number(e.target.value)})} disabled={saving} />
          </label>
          <label className="login-field">
            <span className="login-label">Fitur</span>
            {[...new Set(ALL_FEATURES.map(f => f.group))].map(group => (
              <div key={group} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 4, letterSpacing: 0.3 }}>{group}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {ALL_FEATURES.filter(f => f.group === group).map(f => (
                    <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11.5, cursor: 'pointer', padding: '2px 0' }}>
                      <input type="checkbox" checked={(form.features||[]).includes(f.key)} onChange={() => toggleFeature(f.key)} disabled={saving} />
                      {f.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </label>
          <div className="modal-actions">
            <button className="btn" onClick={onClose} disabled={saving}>Batal</button>
            <button className="btn btn-primary" onClick={() => onSave(form, isNew)} disabled={saving || !form.name}>{saving ? 'Menyimpan…' : 'Simpan'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ShopForm({ shop, onClose }) {
  const [form, setForm] = useState(shop);
  const [saving, setSaving] = useState(false);

  async function handleSave(e) {
    e.preventDefault();
    if (!form.name || !form.channel) return alert('Nama dan channel wajib.');
    setSaving(true);
    if (API_MODE === 'mock') { setTimeout(() => { onClose(); }, 200); return; }
    try {
      await apiPost('/admin/shops', { name: form.name, channel: form.channel, external_shop_id: form.external_shop_id });
      onClose();
    } catch (err) { alert(err.message); }
    setSaving(false);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Tambah Toko</h2>
          <button className="modal-close" onClick={onClose}><Icon name="close" size={20} /></button>
        </div>
        <form onSubmit={handleSave} style={{ padding: '0 20px 20px' }}>
          <label className="login-field">
            <span className="login-label">Nama Toko</span>
            <input className="input login-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Toko Cabang 2" disabled={saving} />
          </label>
          <label className="login-field">
            <span className="login-label">Channel</span>
            <select className="input login-input" value={form.channel} onChange={e => setForm({...form, channel: e.target.value})} disabled={saving}>
              <option value="shopee">Shopee</option>
              <option value="tokopedia">Tokopedia</option>
              <option value="lazada">Lazada</option>
              <option value="tiktok">TikTok Shop</option>
            </select>
          </label>
          <label className="login-field">
            <span className="login-label">External Shop ID (dari channel)</span>
            <input className="input login-input" value={form.external_shop_id} onChange={e => setForm({...form, external_shop_id: e.target.value})} placeholder="shop-002 / tp-002" disabled={saving} />
          </label>
          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose} disabled={saving}>Batal</button>
            <button type="submit" className="btn btn-primary" disabled={saving || !form.name}>{saving ? 'Menyimpan…' : 'Tambah'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AssignModal({ shop, plans, saving, onSave, onClose }) {
  const [planId, setPlanId] = useState(shop.plan_id || '');
  const [expiresAt, setExpiresAt] = useState(shop.expires_at || '');

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Paket: {shop.shop_name}</h2>
          <button className="modal-close" onClick={onClose}><Icon name="close" size={20} /></button>
        </div>
        <div style={{ padding: '0 20px 20px' }}>
          <label className="login-field">
            <span className="login-label">Paket</span>
            <select className="input login-input" value={planId} onChange={e => setPlanId(e.target.value)} disabled={saving}>
              <option value="">— Pilih paket —</option>
              {plans.map(p => (
                <option key={p.id} value={p.id}>{p.name} — {Number(p.monthly_price) === 0 ? 'Gratis' : `Rp ${Number(p.monthly_price).toLocaleString()}/bln`}</option>
              ))}
            </select>
          </label>
          <label className="login-field">
            <span className="login-label">Masa aktif sampai (kosongi = tak terbatas)</span>
            <input className="input login-input" type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} disabled={saving} />
          </label>
          <div className="modal-actions">
            <button className="btn" onClick={onClose} disabled={saving}>Batal</button>
            <button className="btn btn-primary" onClick={() => onSave(shop, planId, expiresAt)} disabled={saving || !planId}>{saving ? 'Menyimpan…' : 'Simpan'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
