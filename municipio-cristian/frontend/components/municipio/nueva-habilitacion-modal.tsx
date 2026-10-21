'use client'

import { X } from 'lucide-react'
import { useEffect, useRef, type FormEvent } from 'react'

type NuevaHabilitacion = { cuit: string; razonSocial: string; rubro: string }

type Props = {
  open: boolean
  onClose: () => void
  onSave: (data: NuevaHabilitacion) => void
}

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500'
const labelClass = 'mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300'

export function NuevaHabilitacionModal({ open, onClose, onSave }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    onSave({
      cuit: String(data.get('cuit')).trim(),
      razonSocial: String(data.get('razonSocial')).trim(),
      rubro: String(data.get('rubro')).trim(),
    })
    formRef.current?.reset()
  }

  function handleCancel() {
    formRef.current?.reset()
    onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && handleCancel()}
      aria-labelledby="nueva-habilitacion-title"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-slate-200 bg-white p-0 text-slate-800 shadow-xl backdrop:bg-slate-900/50 backdrop:backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
    >
      <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <h2 id="nueva-habilitacion-title" className="text-lg font-semibold">
            Nueva Habilitación
          </h2>
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
          >
            <X size={20} aria-hidden="true" />
            <span className="sr-only">Cerrar</span>
          </button>
        </div>

        <div className="flex flex-col gap-4 px-6 py-5">
          <div>
            <label htmlFor="cuit" className={labelClass}>
              CUIT
            </label>
            <input
              id="cuit"
              name="cuit"
              required
              inputMode="numeric"
              pattern="\d{11}"
              maxLength={11}
              title="Ingresá los 11 dígitos sin guiones"
              placeholder="30712345678"
              className={`${inputClass} font-mono`}
            />
          </div>
          <div>
            <label htmlFor="razonSocial" className={labelClass}>
              Razón Social
            </label>
            <input id="razonSocial" name="razonSocial" required placeholder="Comercio Demo S.A." className={inputClass} />
          </div>
          <div>
            <label htmlFor="rubro" className={labelClass}>
              Rubro
            </label>
            <input id="rubro" name="rubro" required placeholder="Alimentos" className={inputClass} />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-700 dark:bg-slate-800/60">
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            Guardar
          </button>
        </div>
      </form>
    </dialog>
  )
}
