import { Request, Response } from 'express'
import * as service from './pagos-qr.service'
import { generarQRSchema, pagarQRSchema } from './pagos-qr.schema'

export async function generar(req: Request, res: Response) {
  try {
    const data   = generarQRSchema.parse(req.body)
    const result = await service.generarQR(data)
    res.status(201).json({ ok: true, data: result })
  } catch (e: any) { res.status(400).json({ ok: false, error: e.message }) }
}

export async function pagar(req: Request, res: Response) {
  try {
    const data   = pagarQRSchema.parse(req.body)
    const result = await service.pagarQR(data)
    res.status(200).json({ ok: true, data: result })
  } catch (e: any) { res.status(400).json({ ok: false, error: e.message }) }
}

export async function estado(req: Request, res: Response) {
  try {
    const result = await service.obtenerEstadoQR(req.params.pagoId)
    res.json({ ok: true, data: result })
  } catch (e: any) { res.status(404).json({ ok: false, error: e.message }) }
}
