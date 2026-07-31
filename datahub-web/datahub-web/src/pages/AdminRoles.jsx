import { useState } from 'react';
import { api, API_MODE, apiPut, apiPost, apiDelete } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { Async } from '../components/states.jsx';
import { Icon, Badge, Notice } from '../components/primitives.jsx';

const ALL_FEATURES = [
  { key: 'reader', label: 'Dashboard & Status', group: 'Dasar' },
  { key: 'export', label: 'Export CSV', group: 'Dasar' },
  { key: 'order', label: 'Order (Pesanan)', group: 'Transaksi' },
  { key: 'finance', label: 'Keuangan & Escrow', group: 'Transaksi' },
  { key: 'returns', label: 'Retur & Refund', group: 'Transaksi' },
  { key: 'product', label: 'Produk & Varian', group: 'Katalog' },
  { key: 'media', label: 'Media (Gambar/Video)', group: 'Katalog' },
  { key: 'category', label: 'Kategori Toko', group: 'Katalog' },
  { key: 'warehouse', label: 'Stok & Gudang', group: 'Operasional' },
  { key: 'logistics', label: 'Logistik & Kirim', group: 'Operasional' },
  { key: 'tiered_wh', label: 'Multi-Warehouse', group: 'Operasional' },
  { key: 'fbs', label: 'Fulfillment Shopee', group: 'Operasional' },
  { key: 'firstmile', label: 'First Mile Pickup', group: 'Operasional' },
  { key: 'voucher', label: 'Voucher Diskon', group: 'Promosi' },
  { key: 'discount', label: 'Diskon Produk', group: 'Promosi' },
  { key: 'bundle', label: 'Bundle Deal', group: 'Promosi' },
  { key: 'addon', label: 'Add-On Deal', group: 'Promosi' },
  { key: 'flashsale', label: 'Flash Sale', group: 'Promosi' },
  { key: 'toppicks', label: 'Top Picks', group: 'Promosi' },
  { key: 'livestream', label: 'Live Streaming', group: 'Promosi' },
  { key: 'video', label: 'Video Produk', group: 'Promosi' },
  { key: 'ads', label: 'Iklan Shopee', group: 'Iklan' },
  { key: 'ams', label: 'Affiliate AMS', group: 'Iklan' },
  { key: 'account_health', label: 'Kesehatan Toko', group: 'Laporan' },
  { key: 'global_product', label: 'Cross-Border', group: 'Khusus' },
  { key: 'sales', label: 'Sales (Legacy)', group: 'Khusus' },
  { key: 'erp', label: 'Integrasi Accurate', group: 'Integrasi' },
];

const SYSTEM_ROLES = ['admin', 'sales', 'finance', 'warehouse'];

export default function AdminRoles({ onRoleChange }) {
  const roles = useApi(api.adminRoles, {});
  const [editRole, setEditRole] = useState(null);
  const [notice, setNotice] = useState(null);

  async function saveRole(role, isNew, reload) {
    if (API_MODE === 'mock') {
      const { rows } = await api.adminRoles({});
      if (isNew) rows.push({ ...role, is_system: false });
      else { const i = rows.findIndex(r => r.name===role.name); if (i>=0) Object.assign(rows[i], role); }
      setTimeout(() => { reload(); setEditRole(null); setNotice('Role disimpan. Refresh untuk melihat perubahan menu.'); }, 100);
      return;
    }
    try {
      if (isNew) await apiPost('/admin/roles', role);
      else await apiPut(`/admin/roles/${role.name}`, { label: role.label, features: role.features });
      reload(); setEditRole(null); setNotice(`Role ${isNew?'dibuat':'diperbarui'}.`); onRoleChange?.();
    } catch (err) { alert(err.message); }
  }

  async function deleteRole(role, reload) {
    if (!confirm(`Hapus "${role.label}"?`)) return;
    if (API_MODE === 'mock') {
      const { rows } = await api.adminRoles({});
      const i = rows.findIndex(r => r.name === role.name);
      if (i >= 0) rows.splice(i, 1);
      reload(); onRoleChange?.();
      return;
    }
    try {
      await apiDelete(`/admin/roles/${role.name}`);
      reload(); setNotice('Role dihapus.'); onRoleChange?.();
    } catch (err) {
      if (err.status === 400) { alert('System role tidak bisa dihapus.'); return; }
      alert(err.message);
    }
  }

  return (
    <div className="page">
      <div className="toolbar">
        <span className="kicker">Admin</span>
        <span style={{ fontSize:13, fontWeight:600 }}>Role & Hak Akses</span>
        <button className="btn btn-primary" onClick={() => setEditRole({ name:'', label:'', features:['reader'], is_system:false })}>
          <Icon name="add" size={16} /> Tambah Role
        </button>
      </div>

      {notice && <Notice tone="success" title={notice} />}

      <Async query={roles} isEmpty={d=>d.rows.length===0}>
        {d => (
          <div className="tblwrap">
            <table className="data" style={{ minWidth:680 }}>
              <thead><tr><th>Nama Role</th><th>Label</th><th>Fitur</th><th>Tipe</th><th /></tr></thead>
              <tbody>
                {d.rows.map(r => (
                  <tr key={r.name}>
                    <td style={{ fontFamily:'var(--font-mono)', fontWeight:700, minWidth:100 }}>{r.name}</td>
                    <td style={{ minWidth:80 }}>{r.label}</td>
                    <td style={{ display:'flex', gap:4, flexWrap:'wrap', maxWidth:300 }}>
                      {(r.features||[]).slice(0,4).map(f => <Badge key={f} tone="info">{ALL_FEATURES.find(x=>x.key===f)?.label||f}</Badge>)}
                      {(r.features||[]).length>4 && <Badge tone="neutral">+{(r.features||[]).length-4} lagi</Badge>}
                    </td>
                    <td>{r.is_system ? <Badge tone="neutral">System</Badge> : <Badge tone="success">Kustom</Badge>}</td>
                    <td style={{ display:'flex', gap:4 }}>
                      <button className="btn" style={{ padding:'4px 10px' }} onClick={() => setEditRole(r)}><Icon name="edit" size={15} /></button>
                      {!SYSTEM_ROLES.includes(r.name) && <button className="btn" style={{ padding:'4px 10px' }} onClick={() => deleteRole(r, roles.reload)}><Icon name="delete" size={15} color="var(--danger)" /></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Async>
      {editRole && <RoleModal role={editRole} onSave={(r,isNew) => saveRole(r,isNew,roles.reload)} onClose={() => setEditRole(null)} />}
    </div>
  );
}

function RoleModal({ role, onSave, onClose }) {
  const isNew = !role.name;
  const [form, setForm] = useState({ ...role, features: [...(role.features||[])] });
  const toggle = key => { const f=form.features||[]; setForm({...form, features: f.includes(key)?f.filter(x=>x!==key):[...f,key]}); };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-head">
          <h2>{isNew ? 'Tambah Role Baru' : `Edit: ${role.label}`}</h2>
          <button className="modal-close" onClick={onClose}><Icon name="close" size={20} /></button>
        </div>
        <div style={{ padding:'0 20px 20px' }}>
          {isNew && (
            <label className="login-field">
              <span className="login-label">Nama Role (lowercase, underscore)</span>
              <input className="input login-input" value={form.name} onChange={e => setForm({...form, name: e.target.value.toLowerCase().replace(/\s/g,'_')})} placeholder="marketing_manager" />
            </label>
          )}
          <label className="login-field">
            <span className="login-label">Label Tampilan</span>
            <input className="input login-input" value={form.label} onChange={e => setForm({...form, label: e.target.value})} placeholder="Marketing Manager" />
          </label>
          <label className="login-field">
            <span className="login-label">Fitur</span>
            <div className="note" style={{ marginBottom:12 }}>
              <strong>Aturan:</strong> Role hanya lihat menu yang fiturnya dicentang. Shop subscription juga membatasi. Admin bypass semua.
            </div>
            {[...new Set(ALL_FEATURES.map(f=>f.group))].map(g => (
              <div key={g} style={{ marginBottom:8 }}>
                <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', color:'var(--ink-3)' }}>{g}</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:3 }}>
                  {ALL_FEATURES.filter(f=>f.group===g).map(f => (
                    <label key={f.key} style={{display:'flex',alignItems:'center',gap:3,fontSize:11.5,cursor:'pointer'}}>
                      <input type="checkbox" checked={(form.features||[]).includes(f.key)} onChange={() => toggle(f.key)} />
                      {f.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </label>
          <div className="modal-actions">
            <button className="btn" onClick={onClose}>Batal</button>
            <button className="btn btn-primary" onClick={() => onSave({ name:form.name, label:form.label, features:form.features }, isNew)} disabled={!form.name||!form.label}>{isNew ? 'Buat Role' : 'Simpan'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
