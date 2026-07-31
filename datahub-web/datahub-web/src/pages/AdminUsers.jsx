import { useState, useCallback } from 'react';
import { api, createUser, updateUser, toggleUserStatus } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { Async } from '../components/states.jsx';
import { Icon, Badge } from '../components/primitives.jsx';
import { formatDateTimeWIB } from '../lib/format.js';

const FALLBACK_ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'sales', label: 'Sales' },
  { value: 'finance', label: 'Finance' },
  { value: 'warehouse', label: 'Gudang' },
];

const ROLE_COLORS = {
  sales:     'info',
  finance:   'success',
  warehouse: 'warning',
  admin:     'neutral',
};

const EMPTY_FORM = { name: '', email: '', password: '', role: 'sales' };

export default function AdminUsers() {
  const users = useApi(api.adminUsers, {});
  const rolesApi = useApi(api.adminRoles, {});
  const allRoles = rolesApi.data?.rows ?? FALLBACK_ROLES;
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState(null);

  const openNew = useCallback(() => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  }, []);

  const openEdit = useCallback((user) => {
    setEditing(user);
    setForm({ name: user.name, email: user.email, password: '', role: user.role });
    setFormError(null);
    setShowForm(true);
  }, []);

  const closeForm = useCallback(() => {
    setShowForm(false);
    setEditing(null);
    setFormError(null);
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    if (!form.name || !form.email || (!editing && !form.password)) {
      setFormError('Nama, email, dan password wajib diisi.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (editing) {
        const payload = { name: form.name, email: form.email, role: form.role };
        if (form.password) payload.password = form.password;
        await updateUser(editing.id, payload);
      } else {
        await createUser(form);
      }
      closeForm();
      users.reload();
    } catch (err) {
      setFormError(err.message || 'Gagal menyimpan.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(user) {
    setConfirmDeactivate(null);
    try {
      await toggleUserStatus(user.id);
      users.reload();
    } catch (err) {
      alert(err.message || 'Gagal mengubah status.');
    }
  }

  return (
    <div className="page">
      <div className="toolbar">
        <span className="kicker">Admin</span>
        <button className="btn btn-primary" onClick={openNew}>
          <Icon name="add" size={16} /> Tambah pengguna
        </button>
      </div>

      <Async query={users} isEmpty={(d) => d.rows.length === 0}
             empty={
               <div className="empty">
                 <strong>Belum ada pengguna</strong>
                 <p>Tambah pengguna pertama untuk mulai menggunakan aplikasi.</p>
               </div>
             }>
        {(d) => (
          <div className="tblwrap">
            <table className="data" style={{ minWidth: 680 }}>
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Email</th>
                  <th>Peran</th>
                  <th>Status</th>
                  <th>Dibuat</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {d.rows.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 700 }}>{u.name}</td>
                    <td className="mono" style={{ color: 'var(--ink-2)' }}>{u.email}</td>
                    <td><Badge tone="info">{allRoles.find((r) => r.name === u.role || r.value === u.role)?.label ?? u.role}</Badge></td>
                    <td>
                      {u.is_active
                        ? <Badge tone="success" icon="check_circle">Aktif</Badge>
                        : <Badge tone="neutral" icon="block">Nonaktif</Badge>}
                    </td>
                    <td className="mono" style={{ color: 'var(--ink-3)', fontSize: 11.5 }}>{formatDateTimeWIB(u.created_at)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn" style={{ padding: '4px 10px' }} onClick={() => openEdit(u)} aria-label={`Edit ${u.name}`}>
                        <Icon name="edit" size={15} />
                      </button>
                      <button
                        className="btn"
                        style={{ padding: '4px 10px', marginLeft: 4 }}
                        onClick={() => setConfirmDeactivate(u)}
                        aria-label={u.is_active ? `Nonaktifkan ${u.name}` : `Aktifkan ${u.name}`}
                      >
                        <Icon name={u.is_active ? 'block' : 'check_circle'} size={15} color={u.is_active ? 'var(--danger)' : 'var(--success)'} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Async>

      {/* Modal form tambah/edit */}
      {showForm && (
        <div className="modal-backdrop" onClick={closeForm}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>{editing ? 'Edit pengguna' : 'Tambah pengguna'}</h2>
              <button className="modal-close" onClick={closeForm} aria-label="Tutup"><Icon name="close" size={20} /></button>
            </div>

            <form onSubmit={handleSave} noValidate style={{ padding: '0 20px 20px' }}>
              {formError && (
                <div className="login-error" role="alert" style={{ marginBottom: 14 }}>
                  <Icon name="error" size={16} />
                  <span>{formError}</span>
                </div>
              )}

              <label className="login-field">
                <span className="login-label">Nama lengkap</span>
                <input className="input login-input" type="text" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Nama pengguna" disabled={saving} />
              </label>

              <label className="login-field">
                <span className="login-label">Email</span>
                <input className="input login-input" type="email" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="email@perusahaan.com" disabled={saving} />
              </label>

              <label className="login-field">
                <span className="login-label">{editing ? 'Password baru (kosongi jika tidak diubah)' : 'Password'}</span>
                <input className="input login-input" type="password" value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder={editing ? 'Kosongi jika tidak diubah' : 'Password'} disabled={saving} />
              </label>

              <label className="login-field">
                <span className="login-label">Peran</span>
                <select className="input login-input" value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })} disabled={saving}>
                  {allRoles.map((r) => <option key={r.name||r.value} value={r.name||r.value}>{r.label}</option>)}
                </select>
              </label>

              <div className="modal-actions">
                <button type="button" className="btn" onClick={closeForm} disabled={saving}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Menyimpan…' : (editing ? 'Simpan perubahan' : 'Tambah pengguna')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Konfirmasi nonaktifkan */}
      {confirmDeactivate && (
        <div className="modal-backdrop" onClick={() => setConfirmDeactivate(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>{confirmDeactivate.is_active ? 'Nonaktifkan' : 'Aktifkan'} pengguna</h2>
            </div>
            <div style={{ padding: '8px 20px 20px', fontSize: 13, color: 'var(--ink-2)' }}>
              {confirmDeactivate.is_active
                ? <>Nonaktifkan <strong>{confirmDeactivate.name}</strong>? Pengguna tidak bisa login.</>
                : <>Aktifkan kembali <strong>{confirmDeactivate.name}</strong>?</>}
            </div>
            <div className="modal-actions" style={{ padding: '0 20px 16px' }}>
              <button className="btn" onClick={() => setConfirmDeactivate(null)}>Batal</button>
              <button className="btn btn-primary" onClick={() => handleToggle(confirmDeactivate)}>
                {confirmDeactivate.is_active ? 'Nonaktifkan' : 'Aktifkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
