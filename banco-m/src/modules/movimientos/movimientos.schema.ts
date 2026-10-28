import { z } from 'zod'

export const depositoSchema = z.object({
  cuit: z.string().min(11).max(13),
  monto: z.number().positive(),
  descripcion: z.string().optional(),
  origen: z.enum(['ARBA', 'ARCA', 'MUNICIPALIDAD', 'DEPOSITO', 'OTRO']).optional(),
  referencia: z.string().optional(),
})

export const debitoSchema = z.object({
  cuit: z.string().min(11).max(13),
  monto: z.number().positive(),
  descripcion: z.string().optional(),
  origen: z.enum(['ARBA', 'ARCA', 'MUNICIPALIDAD', 'DEBITO', 'OTRO']).optional(),
  referencia: z.string().optional(),
})

export type DepositoDTO = z.infer<typeof depositoSchema>
export type DebitoDTO = z.infer<typeof debitoSchema>
