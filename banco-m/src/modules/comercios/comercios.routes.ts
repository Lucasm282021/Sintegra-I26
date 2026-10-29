import { Router } from 'express'
import * as controller from './comercios.controller'

const router = Router()
router.post('/',        controller.crearComercio)
router.get('/',         controller.listar)
router.get('/:cuit',    controller.obtenerPorCuit)
export default router
