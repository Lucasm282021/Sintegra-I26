import React from 'react';
import { Activity, ClipboardList, FilePlus2, LayoutDashboard, LogOut, ShieldCheck, Users, WalletCards, X } from 'lucide-react';

const adminItems = [
  { id: 'panel', label: 'Inicio', icon: LayoutDashboard },
  { id: 'sujetos', label: 'Gestión de sujetos', icon: Users },
  { id: 'usuarios', label: 'Usuarios', icon: ShieldCheck },
  { id: 'auditoria', label: 'Auditoría', icon: ClipboardList },
  { id: 'percepciones', label: 'Percepciones', icon: WalletCards },
  { id: 'padron', label: 'Consulta de padrón', icon: Activity },
];

export function Header({ activeView, onViewChange, user, onLogout }) {
  const items = user?.rol === 'admin'
    ? adminItems
    : [{ id: 'altas', label: 'Mis altas', icon: FilePlus2 }];

  return (
    <>
      <aside className={`dashboard-sidebar hidden lg:flex ${user ? '' : 'login-sidebar'}`}>
        <div className="flex items-center gap-3 px-5 py-6">
          <div className="brand-mark"><ShieldCheck className="h-5 w-5" /></div>
          <div><p className="text-base font-bold tracking-wide text-white">ARBA</p><p className="text-xs text-slate-400">Panel de gestión</p></div>
        </div>

        {user && <>
          <p className="sidebar-caption">MENÚ PRINCIPAL</p>
          <nav className="space-y-1 px-3">
            {items.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" onClick={() => onViewChange(id)} className={`sidebar-link ${activeView === id ? 'sidebar-link-active' : ''}`}>
                <Icon className="h-[18px] w-[18px]" /><span>{label}</span>
              </button>
            ))}
          </nav>
          <div className="mt-auto border-t border-slate-800 p-4">
            <div className="mb-3 flex items-center gap-3 rounded-xl bg-slate-900/80 p-3">
              <div className="user-avatar">{user.nombre?.trim()?.[0]?.toUpperCase() || 'U'}</div>
              <div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{user.nombre}</p><p className="text-xs capitalize text-slate-400">{user.rol}</p></div>
            </div>
            <button type="button" onClick={onLogout} className="sidebar-link w-full text-slate-400 hover:text-white"><LogOut className="h-[18px] w-[18px]" /><span>Cerrar sesión</span></button>
          </div>
        </>}
      </aside>

      <header className="dashboard-mobile-header lg:hidden">
        <div className="flex items-center gap-3"><div className="brand-mark"><ShieldCheck className="h-5 w-5" /></div><div><p className="font-bold text-white">ARBA</p><p className="text-[11px] text-slate-400">Panel de gestión</p></div></div>
        {user && <div className="flex items-center gap-2"><span className="max-w-32 truncate text-xs text-slate-300">{user.nombre}</span><button type="button" onClick={onLogout} aria-label="Cerrar sesión" className="icon-button"><LogOut className="h-4 w-4" /></button></div>}
      </header>
      {user && <nav className="mobile-nav lg:hidden">
        {items.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => onViewChange(id)} className={`mobile-nav-item ${activeView === id ? 'mobile-nav-active' : ''}`}><Icon className="h-4 w-4"/><span>{label}</span></button>)}
      </nav>}
    </>
  );
}
