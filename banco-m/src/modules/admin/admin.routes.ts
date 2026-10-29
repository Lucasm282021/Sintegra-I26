// Vistas de administración del panel: todas las cuentas y los webhooks recibidos.
import { Router } from 'express'
import { prisma } from '../../db/client'
import { requiereRol } from '../auth/auth.routes'

const router = Router()
router.use(requiereRol('ADMIN'))

router.get('/cuentas', async (_req, res) => {
  const cuentas = await prisma.cuenta.findMany({ orderBy: { creadaEn: 'asc' }, include: { comercio: true } })
  res.json({ ok: true, data: cuentas })
})

router.get('/webhooks', async (_req, res) => {
  const logs = await prisma.webhookLog.findMany({ orderBy: { creadoEn: 'desc' }, take: 50 })
  res.json({ ok: true, data: logs })
})

router.get('/pagos-qr', async (_req, res) => {
  const pagos = await prisma.pagoQR.findMany({
    orderBy: { creadoEn: 'desc' }, take: 50,
    include: { cuentaDestino: { select: { titularNombre: true, alias: true } }, cuentaOrigen: { select: { titularNombre: true, alias: true } } },
  })
  res.json({ ok: true, data: pagos })
})

export default router
