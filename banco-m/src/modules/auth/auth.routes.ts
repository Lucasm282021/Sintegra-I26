import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { prisma } from '../../db/client'
import * as service from './auth.service'

const router = Router()
const loginSchema = z.object({ cuit: z.string().min(11).max(13), password: z.string().min(1) })

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { cuit, password } = loginSchema.parse(req.body)
    res.json({ ok: true, data: await service.login(cuit.replace(/\D/g, ''), password) })
  } catch (e: any) {
    res.status(401).json({ ok: false, error: e.message })
  }
})

// Usuarios de demostración que muestra la pantalla de ingreso (son ficticios).
router.get('/demo', async (_req: Request, res: Response) => {
  const usuarios = await prisma.usuario.findMany({ orderBy: { rol: 'asc' }, select: { cuit: true, nombre: true, rol: true } })
  res.json({ ok: true, data: { password: process.env.DEMO_PASSWORD || 'banco1234', usuarios } })
})

export function requiereRol(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const sesion = service.verificarToken((req.headers.authorization || '').replace(/^Bearer /, ''))
    if (!sesion) return res.status(401).json({ ok: false, error: 'Iniciá sesión' })
    if (roles.length && !roles.includes(sesion.rol)) return res.status(403).json({ ok: false, error: 'Sin permiso' })
    ;(req as any).sesion = sesion
    next()
  }
}

export default router
