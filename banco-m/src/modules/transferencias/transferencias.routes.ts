import { Router } from 'express'
import * as controller from './transferencias.controller'

const router = Router()
router.post('/',           controller.crear)
router.get('/:cuentaId',   controller.listar)
export default router
