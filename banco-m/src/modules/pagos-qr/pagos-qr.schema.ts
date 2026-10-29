import { z } from 'zod'

export const generarQRSchema = z.object({
  // Quién cobra: puede ser un comercio por CUIT o una cuenta directa
  cuitDestino:  z.string().min(11).max(13).optional(),
  cbuDestino:   z.string().length(22).optional(),
  // Para organismos: tipo explícito
  tipoOrigen:   z.enum(['COMERCIO', 'ARCA', 'ARBA', 'MUNICIPALIDAD']).default('COMERCIO'),
  monto:        z.number().positive().multipleOf(0.01),
  descripcion:  z.string().optional(),
  referencia:   z.string().optional(), // ID externo del organismo
  ttlMinutos:   z.number().int().min(1).max(60).default(15),
}).refine(d => Boolean(d.cuitDestino) !== Boolean(d.cbuDestino), {
  message: 'Debe indicar cuitDestino o cbuDestino, pero no ambos',
})

export const pagarQRSchema = z.object({
  pagoId:      z.string(),      // ID del PagoQR a pagar
  cuitPagador: z.string().min(11).max(13),
})

export type GenerarQRDTO = z.infer<typeof generarQRSchema>
export type PagarQRDTO   = z.infer<typeof pagarQRSchema>
