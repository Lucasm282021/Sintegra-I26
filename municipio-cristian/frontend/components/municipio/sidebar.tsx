import { Building2, CreditCard, FileText, House, type LucideIcon } from 'lucide-react'

type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  active?: boolean
}

const navItems: NavItem[] = [
  { label: 'Inicio', href: '#', icon: House },
  { label: 'Habilitaciones', href: '#', icon: FileText, active: true },
  { label: 'Pagos TSyH', href: '#', icon: CreditCard },
]

export function Sidebar() {
  return (
    <aside className="flex w-full flex-col border-b border-slate-200 bg-white shadow-sm md:min-h-screen md:w-64 md:border-r md:border-b-0 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-3 border-b border-slate-200 p-6 text-indigo-700 dark:border-slate-800 dark:text-indigo-400">
        <Building2 size={28} strokeWidth={2.5} aria-hidden="true" />
        <span className="text-xl font-bold tracking-tight">Muni | i26</span>
      </div>
      <nav aria-label="Navegación principal" className="flex gap-2 overflow-x-auto p-4 md:flex-1 md:flex-col">
        {navItems.map(({ label, href, icon: Icon, active }) => (
          <a
            key={label}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={
              active
                ? 'flex shrink-0 items-center gap-3 rounded-lg border border-indigo-100 bg-indigo-50 p-3 font-semibold text-indigo-700 shadow-sm transition-colors dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-300'
                : 'flex shrink-0 items-center gap-3 rounded-lg border border-transparent p-3 font-medium text-slate-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700 dark:text-slate-400 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300'
            }
          >
            <Icon size={20} aria-hidden="true" />
            {label}
          </a>
        ))}
      </nav>
    </aside>
  )
}
