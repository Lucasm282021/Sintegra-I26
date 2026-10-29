import { z } from 'zod'

export const crearComercioSchema = z.object({
  cuit:        z.string().min(11).max(13),
  razonSocial: z.string().min(2).max(200),
  rubro:       z.string().optional(),
  // Se crea automáticamente una Cuenta bancaria para el comercio
  // si no existe ya una para ese CUIT
})

export type CrearComercioDTO = z.infer<typeof crearComercioSchema>
