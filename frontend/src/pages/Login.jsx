import { useState } from 'react';
import { login as apiLogin } from '../lib/api.js';
import { Icon } from '../components/primitives.jsx';

/**
 * Login page — email + password, center screen.
 *
 * Props:
 *   onLogin: () => void — dipanggil setelah login berhasil
 *   onSkip: () => void — (mock mode) lewati login
 */
export default function Login({ onLogin, onSkip }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email || !password) {
      setError('Email dan password wajib diisi.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await apiLogin(email, password);
      onLogin?.();
    } catch (err) {
      if (err.status === 422) {
        setError('Email atau password salah.');
      } else {
        setError(err.message || 'Gagal masuk. Coba lagi.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <Icon name="hub" size={32} />
        </div>
        <h1 className="login-title">Ecommerce Data Hub</h1>
        <p className="login-sub">Masuk dengan akun yang telah didaftarkan admin.</p>

        <form onSubmit={handleSubmit} noValidate>
          {error && (
            <div className="login-error" role="alert">
              <Icon name="error" size={16} />
              <span>{error}</span>
            </div>
          )}

          <label className="login-field">
            <span className="login-label">Email</span>
            <input
              className="input login-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@perusahaan.com"
              autoComplete="email"
              autoFocus
              disabled={loading}
              aria-label="Email"
            />
          </label>

          <label className="login-field">
            <span className="login-label">Password</span>
            <input
              className="input login-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              disabled={loading}
              aria-label="Password"
            />
          </label>

          <button className="btn btn-primary login-btn" type="submit" disabled={loading}>
            {loading ? (
              <><span className="login-spinner" /> Memproses…</>
            ) : (
              'Masuk'
            )}
          </button>
        </form>

        {onSkip && (
          <div className="login-skip">
            <span className="login-skip-hr">Mode contoh</span>
            <button className="btn" onClick={onSkip} type="button">
              Lewati login (data contoh)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
