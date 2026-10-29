import React, { useEffect, useState } from 'react';
import { authApi } from './services/authApi';

const roleLabels = { superadmin: 'Superadmin', admin: 'Administrador', user: 'Usuario' };

export default function UsersView() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'user' });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await authApi.getUsers();
      setUsers(result.data?.items || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const createUser = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      await authApi.createUser(form);
      setMessage(`Cuenta ${form.email} creada con rol ${roleLabels[form.role]}.`);
      setForm({ name: '', email: '', password: '', role: 'user' });
      const result = await authApi.getUsers();
      setUsers(result.data?.items || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="card">
        <h2 className="card-title">Crear una cuenta</h2>
        <p className="auth-intro">El superadmin crea las cuentas admin y user. Compartí la contraseña inicial directamente con cada persona.</p>
        {error && <div className="alert alert-danger">{error}</div>}
        {message && <div className="alert alert-success">{message}</div>}
        <form onSubmit={createUser} className="form-grid form-grid-2">
          <div className="form-group"><label>Nombre</label><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required minLength={2} maxLength={100} /></div>
          <div className="form-group"><label>Gmail o correo electrónico</label><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></div>
          <div className="form-group"><label>Contraseña inicial (8 caracteres o más)</label><input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required minLength={8} maxLength={128} /></div>
          <div className="form-group"><label>Rol</label><select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}><option value="user">Usuario</option><option value="admin">Administrador</option></select></div>
          <div><button className="btn btn-primary" type="submit" disabled={loading}>{loading ? 'Guardando…' : 'Crear cuenta'}</button></div>
        </form>
      </div>
      <div className="card">
        <div className="card-title"><span>Cuentas creadas</span><button className="btn btn-outline" onClick={refresh} disabled={loading}>Actualizar</button></div>
        <div className="table-wrapper"><table>
          <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th></tr></thead>
          <tbody>{users.map((user) => <tr key={user.id}><td>{user.name}</td><td>{user.email}</td><td>{roleLabels[user.role] || user.role}</td></tr>)}
            {!loading && users.length === 0 && <tr><td colSpan="3">No hay cuentas todavía.</td></tr>}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}
