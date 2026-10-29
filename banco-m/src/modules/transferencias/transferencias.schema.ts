import { z } from 'zod'

export const transferenciaSchema = z.object({
  origenCuit:  z.string().min(11).max(13),
  monto:       z.number().positive().multipleOf(0.01),
  descripcion: z.string().optional(),
  destinoCuit: z.string().min(11).max(13).optional(),
  destinoCBU: z.string().length(22).optional(),
  destinoAlias: z.string().min(3).optional(),
}).refine((data) => [data.destinoCuit, data.destinoCBU, data.destinoAlias].filter(Boolean).length === 1, {
  message: 'Indica un solo identificador de destino',
})

export type TransferenciaDTO = z.infer<typeof transferenciaSchema>
