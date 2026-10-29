import { Router } from 'express'
import * as controller from './pagos-qr.controller'

const router = Router()
router.post('/generar',       controller.generar)       // Comercio/organismo genera QR
router.post('/pagar',         controller.pagar)         // Cliente paga escaneando QR
router.get('/estado/:pagoId', controller.estado)        // Consultar estado del QR
export default router
