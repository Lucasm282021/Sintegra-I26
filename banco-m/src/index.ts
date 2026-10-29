import express from 'express'
import cors from 'cors'
import { env } from './config/env'
import cuentasRouter from './modules/cuentas/cuentas.routes'
import movimientosRouter from './modules/movimientos/movimientos.routes'
import transferenciasRouter from './modules/transferencias/transferencias.routes'
import comerciosRouter from './modules/comercios/comercios.routes'
import pagosQRRouter from './modules/pagos-qr/pagos-qr.routes'
import webhooksRouter from './modules/webhooks/webhooks.routes'

const app = express()
app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, servicio: 'banco-m', timestamp: new Date().toISOString() })
})

app.use('/api/cuentas', cuentasRouter)
app.use('/api/movimientos', movimientosRouter)
app.use('/api/transferencias', transferenciasRouter)
app.use('/api/comercios', comerciosRouter)
app.use('/api/pagos/qr', pagosQRRouter)
app.use('/api/webhooks', webhooksRouter)

app.use((_req, res) => {
  res.status(404).json({ ok: false, error: 'Ruta no encontrada' })
})

app.listen(env.PORT, () => {
  console.log(`✅ banco-m corriendo en http://localhost:${env.PORT}`)
  console.log(`📋 Ambiente: ${env.NODE_ENV}`)
})

export default app
