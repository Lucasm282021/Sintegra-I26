import { Router } from 'express'
import * as controller from './movimientos.controller'

const router = Router()

router.get('/:cuentaId',        controller.listar)
router.post('/deposito',        controller.deposito)
router.post('/debito',          controller.debito)

export default router
