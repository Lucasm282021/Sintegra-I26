import { prisma } from '../../db/client'
import { generarCBU } from '../../utils/cbu'
import { generarAlias } from '../../utils/alias'
import type { CrearCuentaDTO } from './cuentas.schema'

export async function crearCuenta(data: CrearCuentaDTO) {
  const existe = await prisma.cuenta.findUnique({ where: { cuit: data.cuit } })
  if (existe) throw new Error('Ya existe una cuenta para ese CUIT')

  const cbu = generarCBU(data.cuit)
  const alias = generarAlias(data.cuit)

  return prisma.cuenta.create({
    data: {
      cuit: data.cuit,
      cbu,
      alias,
      titularNombre: data.titularNombre,
      saldo: 0,
    },
  })
}

export async function obtenerPorCuit(cuit: string) {
  return prisma.cuenta.findUnique({ where: { cuit } })
}

export async function obtenerPorCBU(cbu: string) {
  return prisma.cuenta.findUnique({ where: { cbu } })
}

export async function obtenerPorAlias(alias: string) {
  return prisma.cuenta.findUnique({ where: { alias: alias.toUpperCase() } })
}

export async function obtenerSaldo(cuit: string) {
  const cuenta = await prisma.cuenta.findUnique({
    where: { cuit },
    select: { saldo: true, cbu: true, alias: true, titularNombre: true },
  })
  if (!cuenta) throw new Error('Cuenta no encontrada')
  return cuenta
}

export async function toggleActivar(cuit: string) {
  const cuenta = await prisma.cuenta.findUnique({ where: { cuit } })
  if (!cuenta) throw new Error('Cuenta no encontrada')
  return prisma.cuenta.update({
    where: { cuit },
    data: { activa: !cuenta.activa },
  })
}
