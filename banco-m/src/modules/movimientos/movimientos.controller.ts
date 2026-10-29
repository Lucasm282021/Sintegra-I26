import { Request, Response } from 'express'
import * as service from './movimientos.service'
import { depositoSchema, debitoSchema } from './movimientos.schema'

export async function deposito(req: Request, res: Response) {
  try {
    const data = depositoSchema.parse(req.body)
    const mov = await service.registrarDeposito(data)
    res.status(201).json({ ok: true, data: mov })
  } catch (e: any) { res.status(400).json({ ok: false, error: e.message }) }
}

export async function debito(req: Request, res: Response) {
  try {
    const data = debitoSchema.parse(req.body)
    const mov = await service.registrarDebito(data)
    res.status(201).json({ ok: true, data: mov })
  } catch (e: any) { res.status(400).json({ ok: false, error: e.message }) }
}

export async function listar(req: Request, res: Response) {
  try {
    const page  = parseInt(req.query.page  as string) || 1
    const limit = parseInt(req.query.limit as string) || 20
    const result = await service.listarMovimientos(req.params.cuentaId, page, limit)
    res.json({ ok: true, data: result })
  } catch (e: any) { res.status(500).json({ ok: false, error: e.message }) }
}
