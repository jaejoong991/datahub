import { Icon } from './primitives.jsx';
import { relativeFromNow } from '../lib/format.js';
import { navFor } from '../lib/nav.js';

export function FreshnessPill({ sync }) {
  if (!sync) return null;
  const stale = sync.is_stale;
  return (
    <div className={`pill${stale ? ' warn' : ''}`} title={stale ? 'Sinkronisasi tertunda' : 'Sinkronisasi normal'}>
      <Icon name={stale ? 'sync_problem' : 'cloud_done'} size={16}
            color={stale ? 'var(--warning)' : 'var(--success)'} />
      <span>Sinkron <span className="mono">{relativeFromNow(sync.last_success_at)}</span></span>
    </div>
  );
}

export function Sidebar({ role, user, shops, activeShopId, features, page, onNavigate, onShopChange, onLogout }) {
  const activeShop = shops?.find(s => s.id === activeShopId) ?? shops?.[0];

  return (
    <aside className="side">
      <div className="side-head">
        <div className="side-logo"><Icon name="hub" size={21} /></div>
        <div style={{ minWidth: 0 }}>
          <span className="side-title">Data Hub</span>
          {shops?.length > 1 ? (
            <label className="shop-switch">
              <select value={activeShopId ?? ''} onChange={(e) => onShopChange?.(Number(e.target.value))}>
                {shops.map(s => (
                  <option key={s.id} value={s.id}>{s.channel} · {s.name}</option>
                ))}
              </select>
            </label>
          ) : (
            <span className="side-sub">{activeShop?.channel ?? '—'} · {activeShop?.name ?? '—'}</span>
          )}
        </div>
      </div>

      <div className="side-user">
        <span className="av">{user?.initials}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>{user?.name}</div>
          <div className="side-sub">{user?.role_label}</div>
        </div>
      </div>

      <nav className="side-nav">
        {navFor(role, user?.role_features ?? [], features ?? ['reader']).map((g) => (
          <div key={g.group}>
            <div className="side-group">{g.group}</div>
            {g.items.map((item) => (
              <button
                key={item.id}
                className="side-item"
                aria-current={page === item.id ? 'page' : undefined}
                onClick={() => onNavigate(item.id)}
              >
                <span className="chip"><Icon name={item.icon} size={17} /></span>
                <span style={{ flex: 1 }}>{item.name}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="side-foot">
        <span>Data Hub © 2026</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="mono">v0.3</span>
          {onLogout && (
            <button className="side-logout" onClick={onLogout} title="Keluar" aria-label="Keluar">
              <Icon name="logout" size={15} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

export function Topbar({ kicker, title, sync, onExport }) {
  return (
    <header className="topbar">
      <div style={{ minWidth: 0 }}>
        <div className="kicker">{kicker}</div>
        <h1>{title}</h1>
      </div>
      <div className="right">
        <FreshnessPill sync={sync} />
        <button className="btn" disabled style={{ opacity: 0.4, cursor: 'not-allowed' }} title="Export CSV — akan datang">
          <Icon name="download" size={16} /> Export CSV
        </button>
      </div>
    </header>
  );
}
