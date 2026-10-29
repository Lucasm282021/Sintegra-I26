import { prisma } from '../../db/client'
import { Decimal } from '@prisma/client/runtime/library'
import type { DepositoDTO, DebitoDTO } from './movimientos.schema'

export async function registrarDeposito(data: DepositoDTO) {
  return prisma.$transaction(async (tx) => {
    const cuenta = await tx.cuenta.findUnique({ where: { cuit: data.cuit } })
    if (!cuenta) throw new Error('Cuenta no encontrada')
    if (!cuenta.activa) throw new Error('La cuenta está inactiva')
    const saldoAntes    = cuenta.saldo
    const saldoDespues  = new Decimal(cuenta.saldo).plus(data.monto)
    await tx.cuenta.update({ where: { cuit: data.cuit }, data: { saldo: saldoDespues } })
    return tx.movimiento.create({
      data: {
        cuentaId: cuenta.id, tipo: 'CREDITO', monto: data.monto,
        descripcion: data.descripcion, origen: data.origen,
        referencia: data.referencia, saldoAntes, saldoDespues,
      },
    })
  })
}

export async function registrarDebito(data: DebitoDTO) {
  return prisma.$transaction(async (tx) => {
    const cuenta = await tx.cuenta.findUnique({ where: { cuit: data.cuit } })
    if (!cuenta) throw new Error('Cuenta no encontrada')
    if (!cuenta.activa) throw new Error('La cuenta está inactiva')
    const saldoActual = new Decimal(cuenta.saldo)
    if (saldoActual.lessThan(data.monto)) throw new Error('Saldo insuficiente')
    const saldoAntes   = cuenta.saldo
    const saldoDespues = saldoActual.minus(data.monto)
    await tx.cuenta.update({ where: { cuit: data.cuit }, data: { saldo: saldoDespues } })
    return tx.movimiento.create({
      data: {
        cuentaId: cuenta.id, tipo: 'DEBITO', monto: data.monto,
        descripcion: data.descripcion, origen: data.origen,
        referencia: data.referencia, saldoAntes, saldoDespues,
      },
    })
  })
}

export async function listarMovimientos(cuentaId: string, page = 1, limit = 20) {
  const skip = (page - 1) * limit
  const [total, items] = await Promise.all([
    prisma.movimiento.count({ where: { cuentaId } }),
    prisma.movimiento.findMany({
      where: { cuentaId }, orderBy: { creadoEn: 'desc' }, skip, take: limit,
    }),
  ])
  return { total, page, limit, items }
}
