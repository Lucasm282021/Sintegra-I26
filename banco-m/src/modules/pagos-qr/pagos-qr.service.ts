import QRCode from 'qrcode'
import { randomUUID } from 'node:crypto'
import { Decimal } from '@prisma/client/runtime/library'
import { Prisma } from '@prisma/client'
import { prisma } from '../../db/client'
import type { GenerarQRDTO, PagarQRDTO } from './pagos-qr.schema'

function buildQRPayload(pagoId: string, monto: number, destino: string, descripcion?: string) {
  return JSON.stringify({
    sistema: 'banco-m',
    version: '1',
    pagoId,
    monto,
    destino,
    descripcion,
  })
}

export async function generarQR(dto: GenerarQRDTO) {
  const cuentaDestino = dto.cuitDestino
    ? await prisma.cuenta.findUnique({ where: { cuit: dto.cuitDestino } })
    : dto.cbuDestino
      ? await prisma.cuenta.findUnique({ where: { cbu: dto.cbuDestino } })
      : null

  if (!cuentaDestino) throw new Error('Cuenta destino no encontrada')
  if (!cuentaDestino.activa) throw new Error('Cuenta destino inactiva')

  let comercioId: string | undefined
  if (dto.tipoOrigen === 'COMERCIO') {
    const comercio = await prisma.comercio.findFirst({
      where: {
        activo: true,
        ...(dto.cuitDestino ? { cuit: dto.cuitDestino } : { cuentaId: cuentaDestino.id }),
      },
    })
    if (!comercio) throw new Error('No existe un comercio activo para la cuenta destino')
    comercioId = comercio.id
  }

  const expiresAt = new Date(Date.now() + dto.ttlMinutos * 60_000)
  const pagoId = `pqr_${randomUUID()}`
  const payload = buildQRPayload(pagoId, dto.monto, cuentaDestino.alias, dto.descripcion)
  const qrCode = await QRCode.toDataURL(payload, { errorCorrectionLevel: 'M' })
  const pago = await prisma.pagoQR.create({
    data: {
      id: pagoId,
      comercioId,
      cuentaDestinoId: cuentaDestino.id,
      monto: new Decimal(dto.monto.toFixed(2)),
      descripcion: dto.descripcion,
      referencia: dto.referencia,
      tipoOrigen: dto.tipoOrigen,
      qrPayload: payload,
      expiresAt,
    },
  })

  return {
    pagoId: pago.id,
    qrCode,
    qrPayload: payload,
    monto: pago.monto,
    destino: cuentaDestino.alias,
    expiresAt: pago.expiresAt,
  }
}

export async function pagarQR(dto: PagarQRDTO) {
  const current = await prisma.pagoQR.findUnique({ where: { id: dto.pagoId } })
  if (!current) throw new Error('QR no encontrado')
  if (current.estado === 'PENDIENTE' && new Date() >= current.expiresAt) {
    await prisma.pagoQR.updateMany({
      where: { id: current.id, estado: 'PENDIENTE' },
      data: { estado: 'EXPIRADO' },
    })
    throw new Error('El QR expiró')
  }

  return prisma.$transaction(async (tx) => {
    const pago = await tx.pagoQR.findUnique({ where: { id: dto.pagoId } })
    if (!pago) throw new Error('QR no encontrado')
    if (pago.estado !== 'PENDIENTE') throw new Error(`El QR ya fue ${pago.estado.toLowerCase()}`)

    const now = new Date()

    const pagador = await tx.cuenta.findUnique({ where: { cuit: dto.cuitPagador } })
    if (!pagador) throw new Error('Cuenta del pagador no encontrada')
    if (!pagador.activa) throw new Error('Cuenta del pagador inactiva')

    const destino = await tx.cuenta.findUnique({ where: { id: pago.cuentaDestinoId } })
    if (!destino) throw new Error('Cuenta destino no encontrada')
    if (!destino.activa) throw new Error('Cuenta destino inactiva')
    if (pagador.id === destino.id) throw new Error('No podés pagarle a tu propia cuenta')

    const saldoPagador = new Decimal(pagador.saldo)
    if (saldoPagador.lessThan(pago.monto)) throw new Error('Saldo insuficiente')

    // El cambio condicional evita que dos pagos concurrentes usen el mismo QR.
    const claim = await tx.pagoQR.updateMany({
      where: { id: pago.id, estado: 'PENDIENTE', expiresAt: { gt: now } },
      data: { estado: 'PROCESANDO' },
    })
    if (claim.count !== 1) throw new Error('El QR ya fue utilizado o expiró')

    const nuevoSaldoPagador = saldoPagador.minus(pago.monto)
    const nuevoSaldoDestino = new Decimal(destino.saldo).plus(pago.monto)
    await tx.cuenta.update({ where: { id: pagador.id }, data: { saldo: nuevoSaldoPagador } })
    await tx.cuenta.update({ where: { id: destino.id }, data: { saldo: nuevoSaldoDestino } })

    const transferencia = await tx.transferencia.create({
      data: {
        origenId: pagador.id,
        destinoId: destino.id,
        monto: pago.monto,
        descripcion: pago.descripcion || `Pago QR ${pago.tipoOrigen}`,
        estado: 'COMPLETADA',
      },
    })

    await tx.movimiento.createMany({
      data: [
        {
          cuentaId: pagador.id,
          tipo: 'DEBITO',
          monto: pago.monto,
          descripcion: pago.descripcion || `Pago QR a ${destino.titularNombre}`,
          origen: pago.tipoOrigen,
          referencia: pago.referencia || transferencia.id,
          saldoAntes: pagador.saldo,
          saldoDespues: nuevoSaldoPagador,
        },
        {
          cuentaId: destino.id,
          tipo: 'CREDITO',
          monto: pago.monto,
          descripcion: pago.descripcion || `Cobro QR de ${pagador.titularNombre}`,
          origen: pago.tipoOrigen,
          referencia: pago.referencia || transferencia.id,
          saldoAntes: destino.saldo,
          saldoDespues: nuevoSaldoDestino,
        },
      ],
    })

    await tx.pagoQR.update({
      where: { id: pago.id },
      data: {
        estado: 'PAGADO',
        cuentaOrigenId: pagador.id,
        transferenciaId: transferencia.id,
      },
    })

    return { pagoId: pago.id, transferenciaId: transferencia.id, monto: pago.monto, estado: 'PAGADO' }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}

export async function obtenerEstadoQR(pagoId: string) {
  const pago = await prisma.pagoQR.findUnique({
    where: { id: pagoId },
    include: {
      cuentaDestino: { select: { alias: true, titularNombre: true } },
      cuentaOrigen: { select: { alias: true, titularNombre: true } },
    },
  })
  if (!pago) throw new Error('QR no encontrado')

  if (pago.estado === 'PENDIENTE' && new Date() >= pago.expiresAt) {
    await prisma.pagoQR.updateMany({
      where: { id: pago.id, estado: 'PENDIENTE' },
      data: { estado: 'EXPIRADO' },
    })
    return { ...pago, estado: 'EXPIRADO' as const }
  }
  return pago
}
