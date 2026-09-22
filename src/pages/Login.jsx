import React, { useState } from 'react';
import { api } from '../api.js';
import Icon from '../components/Icon.jsx';
import TextSizeControl from '../components/TextSizeControl.jsx';

export default function Login({ session, textSize, onDone, onCancel }) {
  const [form, setForm] = useState({
    baseUrl: session?.baseUrl || 'http://localhost:4000',
    username: session?.username || '',
    password: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // La dirección del servidor solo importa la primera vez; después se esconde para no confundir.
  const [showServer, setShowServer] = useState(!session?.baseUrl);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onDone(await api.login(form));
    } catch (err) {
      setError(err.message);
      setShowServer(true); // si falla por la dirección, que la persona la vea
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-tools"><TextSizeControl textSize={textSize} /></div>

      <form className="login-card" onSubmit={submit}>
        <div className="login-head">
          <span className="brand-mark brand-mark-lg"><Icon name="box" size="2em" /></span>
          <h1>Inventario Venova</h1>
          <p>Ingresa con tu usuario para ver y registrar tu inventario.</p>
        </div>

        <div className="field">
          <label htmlFor="login-user">Usuario</label>
          <input id="login-user" value={form.username} onChange={set('username')} autoFocus autoComplete="username" required />
        </div>

        <div className="field">
          <label htmlFor="login-pass">Contraseña</label>
          <div className="input-group">
            <input
              id="login-pass"
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={set('password')}
              autoComplete="current-password"
              required
            />
            <button type="button" className="btn" onClick={() => setShowPassword(!showPassword)} aria-pressed={showPassword}>
              <Icon name={showPassword ? 'eyeOff' : 'eye'} /> {showPassword ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
        </div>

        {error && (
          <p className="alert alert-err" role="alert"><Icon name="alert" size="1.4em" /> <span>{error}</span></p>
        )}

        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
          {busy ? <><Icon name="refresh" className="spin" /> Entrando…</> : <>Entrar <Icon name="arrowRight" /></>}
        </button>
        {onCancel && <button type="button" className="btn btn-lg btn-block" onClick={onCancel}>Cancelar</button>}

        <div className="server-box">
          <button type="button" className="link-btn" onClick={() => setShowServer(!showServer)} aria-expanded={showServer}>
            <Icon name="server" /> Dirección del servidor <Icon name={showServer ? 'chevronDown' : 'chevronRight'} />
          </button>
          {showServer ? (
            <div className="field">
              <input
                id="login-server"
                aria-label="Dirección del servidor"
                value={form.baseUrl}
                onChange={set('baseUrl')}
                placeholder="https://api.tudominio.com"
                required
              />
              <span className="hint">Normalmente no necesitas cambiarla. Si no estás seguro, déjala como está.</span>
            </div>
          ) : (
            <span className="hint">{form.baseUrl}</span>
          )}
        </div>
      </form>
    </div>
  );
}
