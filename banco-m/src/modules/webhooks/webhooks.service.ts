import { createHash } from 'node:crypto'
import { Decimal } from '@prisma/client/runtime/library'
import { Prisma } from '@prisma/client'
import { prisma } from '../../db/client'
import type { WebhookPagoDTO } from './webhooks.schema'

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function idempotencyKey(dto: WebhookPagoDTO, providedKey?: string) {
  if (providedKey) return providedKey
  return createHash('sha256').update(stableJson(dto)).digest('hex')
}

export async function procesarWebhookPago(dto: WebhookPagoDTO, providedKey?: string) {
  const key = idempotencyKey(dto, providedKey)
  let log = await prisma.webhookLog.findUnique({ where: { idempotencyKey: key } })

  if (!log) {
    try {
      log = await prisma.webhookLog.create({
        data: {
          idempotencyKey: key,
          evento: dto.evento,
          payload: JSON.parse(stableJson(dto)),
          origen: dto.origen,
        },
      })
    } catch (error) {
      // Dos entregas simultáneas con la misma clave crean un solo log.
      log = await prisma.webhookLog.findUnique({ where: { idempotencyKey: key } })
      if (!log) throw error
    }
  }

  if (stableJson(log.payload) !== stableJson(dto)) {
    throw new Error('La clave de idempotencia ya fue usada con otro contenido')
  }
  if (log.procesado) return { recibido: true, duplicado: true, logId: log.id }

  try {
    await prisma.$transaction(async (tx) => {
      if (dto.pagoId) {
        const pago = await tx.pagoQR.findUnique({ where: { id: dto.pagoId } })
        if (!pago) throw new Error('Pago QR no encontrado')

        if (dto.estado === 'CONFIRMADO') {
          if (pago.estado !== 'PAGADO' && pago.estado !== 'COMPLETADO') {
            throw new Error('El QR todavía no fue pagado desde la billetera')
          }
          await tx.pagoQR.update({
            where: { id: pago.id },
            data: { estado: 'COMPLETADO', confirmadoEn: pago.confirmadoEn ?? new Date() },
          })
        } else {
          if (pago.estado !== 'EXPIRADO') {
            // El contrato del TPPV cancela el QR; revertir los fondos queda fuera de este alcance.
            await tx.pagoQR.update({ where: { id: pago.id }, data: { estado: 'CANCELADO' } })
          }
        }
      } else {
        if (!dto.referencia || !dto.monto) {
          throw new Error('El webhook externo requiere referencia y monto')
        }
        if (dto.estado === 'CONFIRMADO') {
          const cuitOrganismo = process.env[`CUIT_${dto.origen}`]
          if (!cuitOrganismo) throw new Error(`Falta configurar CUIT_${dto.origen}`)

          const cuenta = await tx.cuenta.findUnique({ where: { cuit: cuitOrganismo } })
          if (!cuenta) throw new Error(`No existe una cuenta configurada para ${dto.origen}`)

          const saldoAntes = new Decimal(cuenta.saldo)
          const saldoDespues = saldoAntes.plus(dto.monto)
          await tx.cuenta.update({ where: { id: cuenta.id }, data: { saldo: saldoDespues } })
          await tx.movimiento.create({
            data: {
              cuentaId: cuenta.id,
              tipo: 'CREDITO',
              monto: new Decimal(dto.monto.toFixed(2)),
              descripcion: `Pago externo confirmado por ${dto.origen}`,
              origen: dto.origen,
              referencia: dto.referencia,
              saldoAntes,
              saldoDespues,
            },
          })
        }
      }

      await tx.webhookLog.update({ where: { id: log.id }, data: { procesado: true, error: null } })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    return { recibido: true, duplicado: false, logId: log.id }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al procesar webhook'
    await prisma.webhookLog.update({ where: { id: log.id }, data: { error: message } })
    throw error
  }
}
