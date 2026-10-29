import { Router } from 'express'
import * as controller from './webhooks.controller'

const router = Router()
router.post('/pago-confirmado', controller.pagoConfirmado)
export default router
