import { Request, Response } from 'express'
import * as service from './cuentas.service'
import { crearCuentaSchema } from './cuentas.schema'

export async function crearCuenta(req: Request, res: Response) {
  try {
    const data = crearCuentaSchema.parse(req.body)
    const cuenta = await service.crearCuenta(data)
    res.status(201).json({ ok: true, data: cuenta })
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e.message })
  }
}

export async function obtenerPorCuit(req: Request, res: Response) {
  try {
    const cuenta = await service.obtenerPorCuit(req.params.cuit)
    if (!cuenta) return res.status(404).json({ ok: false, error: 'No encontrada' })
    res.json({ ok: true, data: cuenta })
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message })
  }
}

export async function obtenerPorCBU(req: Request, res: Response) {
  try {
    const cuenta = await service.obtenerPorCBU(req.params.cbu)
    if (!cuenta) return res.status(404).json({ ok: false, error: 'No encontrada' })
    res.json({ ok: true, data: cuenta })
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message })
  }
}

export async function obtenerPorAlias(req: Request, res: Response) {
  try {
    const cuenta = await service.obtenerPorAlias(req.params.alias)
    if (!cuenta) return res.status(404).json({ ok: false, error: 'No encontrada' })
    res.json({ ok: true, data: cuenta })
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message })
  }
}

export async function obtenerSaldo(req: Request, res: Response) {
  try {
    const saldo = await service.obtenerSaldo(req.params.cuit)
    res.json({ ok: true, data: saldo })
  } catch (e: any) {
    res.status(404).json({ ok: false, error: e.message })
  }
}

export async function toggleActivar(req: Request, res: Response) {
  try {
    const cuenta = await service.toggleActivar(req.params.cuit)
    res.json({ ok: true, data: cuenta })
  } catch (e: any) {
    res.status(404).json({ ok: false, error: e.message })
  }
}
