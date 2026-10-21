export type EstadoHabilitacion = 'Aprobada' | 'Observada' | 'Borrador'

export type Comercio = {
  cuit: string
  razonSocial: string
  rubro: string
  estado: EstadoHabilitacion
}

const estadoStyles: Record<EstadoHabilitacion, string> = {
  Aprobada:
    'bg-green-100 text-green-800 border-green-200 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/30',
  Observada:
    'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-500/15 dark:text-yellow-300 dark:border-yellow-500/30',
  Borrador:
    'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/30',
}

const columns = ['CUIT', 'Razón Social', 'Rubro', 'Estado']

export function ComerciosTable({ comercios }: { comercios: Comercio[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Listado de comercios y estado de su habilitación</caption>
          <thead className="border-b border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-800/50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column}
                  scope="col"
                  className="whitespace-nowrap p-4 text-sm font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {comercios.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-8 text-center text-slate-500 dark:text-slate-400">
                  No se encontraron comercios que coincidan con la búsqueda.
                </td>
              </tr>
            ) : (
              comercios.map((comercio) => (
                <tr key={comercio.cuit} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="whitespace-nowrap p-4 font-mono text-sm font-medium text-slate-800 dark:text-slate-200">
                    {comercio.cuit}
                  </td>
                  <td className="p-4 text-slate-700 dark:text-slate-300">{comercio.razonSocial}</td>
                  <td className="p-4 text-slate-600 dark:text-slate-400">{comercio.rubro}</td>
                  <td className="p-4">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-bold ${estadoStyles[comercio.estado]}`}
                    >
                      {comercio.estado}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
