import { z } from 'zod'

export const transferenciaSchema = z.object({
  origenCuit: z.string().min(11).max(13),
  monto: z.number().positive(),
  descripcion: z.string().optional(),
}).and(
  z.union([
    z.object({ destinoCuit: z.string().min(11).max(13) }),
    z.object({ destinoCBU: z.string().length(22) }),
    z.object({ destinoAlias: z.string().min(3) }),
  ])
)

export type TransferenciaDTO = z.infer<typeof transferenciaSchema>
