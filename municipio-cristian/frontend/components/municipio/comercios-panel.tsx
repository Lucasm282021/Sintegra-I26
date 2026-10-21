'use client'

import { Plus } from 'lucide-react'
import { useState } from 'react'
import { ComerciosTable, type Comercio } from './comercios-table'
import { NuevaHabilitacionModal } from './nueva-habilitacion-modal'
import { SearchBar } from './search-bar'
import { ThemeToggle } from './theme-toggle'

export function ComerciosPanel({ initialComercios }: { initialComercios: Comercio[] }) {
  const [comercios, setComercios] = useState(initialComercios)
  const [query, setQuery] = useState('')
  const [modalOpen, setModalOpen] = useState(false)

  const normalized = query.trim().toLowerCase()
  const filtered = normalized
    ? comercios.filter(
        (c) => c.cuit.includes(normalized.replace(/\D/g, '') || normalized) || c.razonSocial.toLowerCase().includes(normalized),
      )
    : comercios

  return (
    <>
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-balance text-3xl font-bold text-slate-800 dark:text-slate-100">Gestión de Comercios</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">Panel de control de habilitaciones municipales</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 sm:flex-none"
          >
            <Plus size={20} aria-hidden="true" /> Nueva Habilitación
          </button>
          <ThemeToggle />
        </div>
      </header>

      <div className="mb-4">
        <SearchBar value={query} onChange={setQuery} />
      </div>

      <ComerciosTable comercios={filtered} />

      <NuevaHabilitacionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={(data) => {
          setComercios((prev) => [{ ...data, estado: 'Borrador' }, ...prev.filter((c) => c.cuit !== data.cuit)])
          setModalOpen(false)
        }}
      />
    </>
  )
}
