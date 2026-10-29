import React, { useState } from 'react';
import { authApi } from './services/authApi';

export default function AuthScreen({ setupRequired, onAuthenticated }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (setupRequired && password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setLoading(true);
    try {
      const result = setupRequired
        ? await authApi.bootstrap({ name, email, password })
        : await authApi.login({ email, password });
      onAuthenticated(result.data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="brand-title">Sintegra I26 — ARBA</div>
        <h1>{setupRequired ? 'Configuración inicial' : 'Iniciar sesión'}</h1>
        <p className="auth-intro">
          {setupRequired
            ? 'Creá la primera cuenta. Tendrá el rol superadmin y podrá dar de alta las demás cuentas.'
            : 'Ingresá con el correo y la contraseña que te asignó el superadmin.'}
        </p>
        {error && <div className="alert alert-danger">{error}</div>}
        <form onSubmit={submit} className="auth-form">
          {setupRequired && (
            <label>Nombre
              <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required minLength={2} maxLength={100} />
            </label>
          )}
          <label>Gmail o correo electrónico
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
          </label>
          <label>Contraseña
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={setupRequired ? 'new-password' : 'current-password'} required minLength={8} maxLength={128} />
            <span className="field-hint">Usá al menos 8 caracteres.</span>
          </label>
          {setupRequired && (
            <label>Repetir contraseña
              <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" required minLength={8} maxLength={128} />
            </label>
          )}
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Un momento…' : setupRequired ? 'Crear superadmin' : 'Ingresar'}
          </button>
        </form>
        <p className="auth-note">Acceso académico de demostración. No uses una contraseña que ya utilices en otras cuentas.</p>
      </div>
    </div>
  );
}
