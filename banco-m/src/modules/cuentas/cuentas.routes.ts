import { Router } from 'express'
import * as controller from './cuentas.controller'

const router = Router()
router.post('/',               controller.crearCuenta)
router.get('/:cuit',           controller.obtenerPorCuit)
router.get('/cbu/:cbu',        controller.obtenerPorCBU)
router.get('/alias/:alias',    controller.obtenerPorAlias)
router.get('/:cuit/saldo',     controller.obtenerSaldo)
router.patch('/:cuit/activar', controller.toggleActivar)
export default router
