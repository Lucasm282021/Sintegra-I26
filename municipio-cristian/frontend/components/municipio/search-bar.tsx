import { Search } from 'lucide-react'

type SearchBarProps = {
  value: string
  onChange: (value: string) => void
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="relative w-full sm:max-w-sm">
      <label htmlFor="buscar-comercio" className="sr-only">
        Buscar por CUIT o Razón Social
      </label>
      <Search
        size={18}
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400 dark:text-slate-500"
      />
      <input
        id="buscar-comercio"
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Buscar por CUIT o Razón Social..."
        autoComplete="off"
        className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pr-4 pl-10 text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
      />
    </div>
  )
}
