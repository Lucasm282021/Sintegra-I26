import { z } from 'zod'

// Webhook genérico — cada sistema externo puede enviar su formato
export const webhookPagoSchema = z.object({
  evento:     z.string(),           // ej: "pago.confirmado" | "pago.rechazado"
  pagoId:     z.string().optional(),// ID de PagoQR en banco-m (si lo conoce)
  referencia: z.string().optional(),// ID externo del sistema pagador
  monto:      z.number().positive().optional(),
  origen:     z.enum(['TPPV', 'ARCA', 'ARBA', 'MUNICIPALIDAD']),
  estado:     z.enum(['CONFIRMADO', 'RECHAZADO']),
  payload:    z.record(z.unknown()).optional(), // datos extras del sistema
})

export type WebhookPagoDTO = z.infer<typeof webhookPagoSchema>
