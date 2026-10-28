import { z } from 'zod'

export const crearCuentaSchema = z.object({
  cuit: z.string().min(11).max(13),
  titularNombre: z.string().min(2).max(200),
})

export const buscarPorCuitSchema = z.object({
  cuit: z.string().min(11).max(13),
})

export type CrearCuentaDTO = z.infer<typeof crearCuentaSchema>
