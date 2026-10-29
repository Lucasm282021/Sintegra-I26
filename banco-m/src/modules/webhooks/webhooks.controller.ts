import { Request, Response } from 'express'
import * as service from './webhooks.service'
import { webhookPagoSchema } from './webhooks.schema'

export async function pagoConfirmado(req: Request, res: Response) {
  try {
    // Validar firma/secret del webhook (simple header check)
    const secret = req.headers['x-webhook-secret']
    if (process.env.WEBHOOK_SECRET && secret !== process.env.WEBHOOK_SECRET) {
      return res.status(401).json({ ok: false, error: 'Firma inválida' })
    }
    const data = webhookPagoSchema.parse(req.body)
    const idempotencyKey = req.header('x-idempotency-key') ?? undefined
    const result = await service.procesarWebhookPago(data, idempotencyKey)
    res.json({ ok: true, data: result })
  } catch (e: any) {
    // Siempre responder 200 a webhooks externos (para evitar reintentos)
    res.status(200).json({ ok: false, logged: true, error: e.message })
  }
}
