import React from 'react';
import { Activity, ClipboardList, FilePlus2, LayoutDashboard, LogOut, ShieldCheck, Users, WalletCards } from 'lucide-react';

const adminItems = [
  { id: 'panel', label: 'Inicio', icon: LayoutDashboard },
  { id: 'sujetos', label: 'Gestión de sujetos', icon: Users },
  { id: 'usuarios', label: 'Usuarios', icon: ShieldCheck },
  { id: 'auditoria', label: 'Auditoría', icon: ClipboardList },
  { id: 'percepciones', label: 'Percepciones', icon: WalletCards },
  { id: 'padron', label: 'Consulta de padrón', icon: Activity },
];

// Menú lateral común de Sintegra (consolidacion/UNIFICACION-DISENO.md). Usa
// colores explícitos porque la escala "slate" de Tailwind está invertida para
// el tema claro y dentro del menú azul el texto tiene que seguir blanco.
export function Header({ activeView, onViewChange, user, onLogout }) {
  const items = user?.rol === 'admin'
    ? adminItems
    : [{ id: 'altas', label: 'Mis altas', icon: FilePlus2 }];

  return (
    <>
      <aside className={`dashboard-sidebar hidden lg:flex ${user ? '' : 'login-sidebar'}`} aria-label="Menú principal">
        <div className="px-3.5 pt-5">
          <div className="brand-logo"><img src="/logo-arba.png" alt="i26 ARBA · Impuestos Provinciales" /></div>
          <p className="mx-2 mt-1.5 text-[13px] text-[#C9CEDC]">ARBA · Panel de gestión</p>
        </div>

        {user && <>
          <p className="sidebar-caption">MENÚ PRINCIPAL</p>
          <nav aria-label="Secciones de ARBA">
            <ul className="space-y-1 px-3.5">
              {items.map(({ id, label, icon: Icon }) => (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => onViewChange(id)}
                    aria-current={activeView === id ? 'page' : undefined}
                    className={`sidebar-link ${activeView === id ? 'sidebar-link-active' : ''}`}
                  >
                    <Icon className="h-5 w-5 shrink-0" aria-hidden="true" /><span>{label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <div className="mt-auto border-t border-[rgb(255_255_255/0.14)] p-3.5">
            <div className="sidebar-user">
              <div className="user-avatar" aria-hidden="true">{user.nombre?.trim()?.[0]?.toUpperCase() || 'U'}</div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{user.nombre}</p>
                <p className="rol text-xs capitalize">{user.rol}</p>
              </div>
            </div>
            <button type="button" onClick={onLogout} className="sidebar-link">
              <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" /><span>Cerrar sesión</span>
            </button>
          </div>
        </>}
      </aside>

      <header className="dashboard-mobile-header lg:hidden">
        <div className="brand-logo"><img src="/logo-arba.png" alt="i26 ARBA · Impuestos Provinciales" /></div>
        {user && (
          <div className="flex items-center gap-2">
            <span className="hidden max-w-32 truncate text-sm text-[#ffffff] sm:inline">{user.nombre}</span>
            <button type="button" onClick={onLogout} aria-label="Cerrar sesión" className="icon-button"><LogOut className="h-5 w-5" aria-hidden="true" /></button>
          </div>
        )}
      </header>
      {user && (
        <nav className="mobile-nav lg:hidden" aria-label="Secciones de ARBA">
          {items.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => onViewChange(id)}
              aria-current={activeView === id ? 'page' : undefined}
              className={`mobile-nav-item ${activeView === id ? 'mobile-nav-active' : ''}`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" /><span>{label}</span>
            </button>
          ))}
        </nav>
      )}
    </>
  );
}
