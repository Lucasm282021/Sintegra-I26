import { prisma } from '../../db/client'
import { Decimal } from '@prisma/client/runtime/library'
import type { TransferenciaDTO } from './transferencias.schema'

async function resolverDestino(dto: TransferenciaDTO) {
  if ('destinoCuit' in dto) return prisma.cuenta.findUnique({ where: { cuit: dto.destinoCuit } })
  if ('destinoCBU' in dto)  return prisma.cuenta.findUnique({ where: { cbu: dto.destinoCBU } })
  if ('destinoAlias' in dto) return prisma.cuenta.findUnique({ where: { alias: dto.destinoAlias.toUpperCase() } })
  return null
}

export async function crearTransferencia(dto: TransferenciaDTO) {
  return prisma.$transaction(async (tx) => {
    const origen = await tx.cuenta.findUnique({ where: { cuit: dto.origenCuit } })
    if (!origen) throw new Error('Cuenta origen no encontrada')
    if (!origen.activa) throw new Error('Cuenta origen inactiva')

    const destino = await resolverDestino(dto)
    if (!destino) throw new Error('Cuenta destino no encontrada')
    if (!destino.activa) throw new Error('Cuenta destino inactiva')
    if (origen.id === destino.id) throw new Error('No podés transferir a tu propia cuenta')

    const saldoOrigen = new Decimal(origen.saldo)
    if (saldoOrigen.lessThan(dto.monto)) throw new Error('Saldo insuficiente')

    const nuevoSaldoOrigen = saldoOrigen.minus(dto.monto)
    const nuevoSaldoDestino = new Decimal(destino.saldo).plus(dto.monto)

    // Actualizar saldos
    await tx.cuenta.update({ where: { id: origen.id }, data: { saldo: nuevoSaldoOrigen } })
    await tx.cuenta.update({ where: { id: destino.id }, data: { saldo: nuevoSaldoDestino } })

    // Crear registro de transferencia
    const transferencia = await tx.transferencia.create({
      data: {
        origenId: origen.id,
        destinoId: destino.id,
        monto: dto.monto,
        descripcion: dto.descripcion,
        estado: 'COMPLETADA',
      },
    })

    // Crear movimientos en ambas cuentas
    await tx.movimiento.createMany({
      data: [
        {
          cuentaId: origen.id,
          tipo: 'DEBITO',
          monto: dto.monto,
          descripcion: dto.descripcion || `Transferencia a ${destino.titularNombre}`,
          origen: 'TRANSFERENCIA',
          referencia: transferencia.id,
          saldoAntes: origen.saldo,
          saldoDespues: nuevoSaldoOrigen,
        },
        {
          cuentaId: destino.id,
          tipo: 'CREDITO',
          monto: dto.monto,
          descripcion: dto.descripcion || `Transferencia de ${origen.titularNombre}`,
          origen: 'TRANSFERENCIA',
          referencia: transferencia.id,
          saldoAntes: destino.saldo,
          saldoDespues: nuevoSaldoDestino,
        },
      ],
    })

    return transferencia
  })
}

export async function listarTransferencias(cuentaId: string) {
  return prisma.transferencia.findMany({
    where: {
      OR: [{ origenId: cuentaId }, { destinoId: cuentaId }],
    },
    include: {
      origen: { select: { cuit: true, titularNombre: true, alias: true } },
      destino: { select: { cuit: true, titularNombre: true, alias: true } },
    },
    orderBy: { creadaEn: 'desc' },
  })
}
