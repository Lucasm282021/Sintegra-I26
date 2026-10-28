import { Request, Response } from 'express'
import * as service from './transferencias.service'
import { transferenciaSchema } from './transferencias.schema'

export async function crear(req: Request, res: Response) {
  try {
    const data = transferenciaSchema.parse(req.body)
    const transferencia = await service.crearTransferencia(data)
    res.status(201).json({ ok: true, data: transferencia })
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e.message })
  }
}

export async function listar(req: Request, res: Response) {
  try {
    const result = await service.listarTransferencias(req.params.cuentaId)
    res.json({ ok: true, data: result })
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message })
  }
}
