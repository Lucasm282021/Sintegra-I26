import { ComerciosPanel } from '@/components/municipio/comercios-panel'
import type { Comercio } from '@/components/municipio/comercios-table'
import { Sidebar } from '@/components/municipio/sidebar'

const comercios: Comercio[] = [
  { cuit: '30712345678', razonSocial: 'Comercio Demo S.A.', rubro: 'Alimentos', estado: 'Aprobada' },
  { cuit: '20123456789', razonSocial: 'Librería Central', rubro: 'Librería', estado: 'Observada' },
  { cuit: '27876543210', razonSocial: 'Kiosco El Paso', rubro: 'Kiosco', estado: 'Borrador' },
]

export default function MunicipioDashboard() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 font-sans transition-colors md:flex-row dark:bg-slate-950">
      <Sidebar />

      <main className="min-w-0 flex-1 p-6 md:p-10">
        <ComerciosPanel initialComercios={comercios} />
      </main>
    </div>
  )
}
