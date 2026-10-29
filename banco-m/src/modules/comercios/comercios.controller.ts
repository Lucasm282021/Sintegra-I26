import { Request, Response } from 'express'
import * as service from './comercios.service'
import { crearComercioSchema } from './comercios.schema'

export async function crearComercio(req: Request, res: Response) {
  try {
    const data     = crearComercioSchema.parse(req.body)
    const comercio = await service.crearComercio(data)
    res.status(201).json({ ok: true, data: comercio })
  } catch (e: any) { res.status(400).json({ ok: false, error: e.message }) }
}

export async function obtenerPorCuit(req: Request, res: Response) {
  try {
    const comercio = await service.obtenerComercioPorCuit(req.params.cuit)
    if (!comercio) return res.status(404).json({ ok: false, error: 'Comercio no encontrado' })
    res.json({ ok: true, data: comercio })
  } catch (e: any) { res.status(500).json({ ok: false, error: e.message }) }
}

export async function listar(req: Request, res: Response) {
  try {
    const page   = parseInt(req.query.page  as string) || 1
    const limit  = parseInt(req.query.limit as string) || 20
    res.json({ ok: true, data: await service.listarComercios(page, limit) })
  } catch (e: any) { res.status(500).json({ ok: false, error: e.message }) }
}
