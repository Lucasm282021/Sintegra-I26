import { FormEvent, ReactNode, useState } from 'react';
import { ShieldCheck } from 'lucide-react';

const DEMO = { email: 'demo.municipio.i26@gmail.com', password: 'MuniDemo2026' };

export function DemoLoginGate({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(() => sessionStorage.getItem('demo-auth-municipio') === 'ok');
  const [error, setError] = useState('');
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (String(data.get('email')).trim().toLowerCase() !== DEMO.email || data.get('password') !== DEMO.password) {
      setError('El correo o la contraseña no coinciden con el usuario demo.'); return;
    }
    sessionStorage.setItem('demo-auth-municipio', 'ok'); setAuthenticated(true);
  }
  if (authenticated) return <>{children}</>;
  return <main className="demo-login-page"><section className="demo-login-card" aria-labelledby="demo-login-title">
    <ShieldCheck className="demo-login-shield" size={25} aria-hidden="true" />
    <p className="demo-login-eyebrow">BIENVENIDO · MUNICIPIO I26</p><h1 id="demo-login-title">Ingresá a tu cuenta</h1>
    <p className="demo-login-subtitle">Accedé al sistema de gestión tributaria municipal.</p>
    <form onSubmit={submit}><label>Correo electrónico<input name="email" type="email" autoComplete="username" placeholder="nombre@correo.com" required /></label>
      <label>Contraseña<input name="password" type="password" autoComplete="current-password" placeholder="Ingresá tu contraseña" required /></label>
      {error && <p className="demo-login-error" role="alert">{error}</p>}<button type="submit">Iniciar sesión</button>
    </form>
    <aside className="demo-login-credentials"><strong>Usuario de prueba (ayuda memoria)</strong><span>Correo: <b>{DEMO.email}</b></span><span>Contraseña: <b>{DEMO.password}</b></span></aside>
    <footer>Entorno académico · Información de ejemplo</footer>
  </section></main>;
}
