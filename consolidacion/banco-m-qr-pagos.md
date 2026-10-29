# banco-m — Módulo de Pagos por QR y Webhooks
## Prompt de implementación para Codex / Claude Code

Agregá esta funcionalidad al módulo `banco-m` ya existente dentro del monorepo `i26sintegra`.
No modificar nada fuera de `banco-m/`. Solo agregar archivos nuevos y actualizar los indicados.

---

## Concepto de negocio

Un cliente escanea el QR de un comercio (o de un organismo como ARCA/ARBA/Municipalidad).
Desde su billetera paga el monto. El dinero se debita de su cuenta y se acredita en la del comercio.
El TPPV (terminal punto de pago virtual) confirma la transacción mediante un webhook entrante.
Los organismos también pueden generar QR de cobro para impuestos, tasas y multas.

Flujo completo:
1. Comercio/organismo genera un `PagoQR` con monto, descripcion y cuentaDestinoId
2. Se devuelve un `qrCode` (string base64 o URL) + `pagoId` único
3. Cliente escanea el QR desde su app → llama a `POST /api/pagos/qr/pagar`
4. banco-m ejecuta la transferencia atómica (Prisma transaction)
5. El TPPV o sistema externo confirma via webhook → `POST /api/webhooks/pago-confirmado`
6. El `PagoQR` queda en estado COMPLETADO; ambas cuentas actualizadas

---

## Archivos NUEVOS a crear

### 1. prisma/schema.prisma — agregar modelos al schema existente

```prisma
// Agregar al final del schema.prisma existente

model Comercio {
  id            String    @id @default(cuid())
  cuit          String    @unique
  razonSocial   String
  rubro         String?
  cuentaId      String    @unique
  activo        Boolean   @default(true)
  creadoEn      DateTime  @default(now())
  actualizadoEn DateTime  @updatedAt

  cuenta  Cuenta    @relation(fields: [cuentaId], references: [id])
  pagosQR PagoQR[]
}

model PagoQR {
  id             String        @id @default(cuid())
  comercioId     String?       // null si el cobrador es un organismo
  cuentaDestinoId String
  monto          Decimal       @db.Decimal(15, 2)
  descripcion    String?
  referencia     String?       // ID externo (ej: cuota ARBA nro X)
  tipoOrigen     TipoOrigen    @default(COMERCIO)
  estado         EstadoPagoQR  @default(PENDIENTE)
  qrPayload      String        // JSON que se encodea en el QR
  cuentaOrigenId String?       // se llena cuando el cliente escanea y paga
  transferenciaId String?      // FK a Transferencia creada al pagar
  expiresAt      DateTime      // QR vence (default: now + 15 min)
  creadoEn       DateTime      @default(now())
  confirmadoEn   DateTime?

  comercio      Comercio?    @relation(fields: [comercioId],      references: [id])
  cuentaDestino Cuenta       @relation("QRDestino", fields: [cuentaDestinoId], references: [id])
  cuentaOrigen  Cuenta?      @relation("QRPagador", fields: [cuentaOrigenId], references: [id])
}

model WebhookLog {
  id          String   @id @default(cuid())
  evento      String
  payload     Json
  origen      String   // TPPV | ARCA | ARBA | MUNICIPALIDAD
  procesado   Boolean  @default(false)
  error       String?
  creadoEn    DateTime @default(now())
}

enum TipoOrigen {
  COMERCIO
  ARCA
  ARBA
  MUNICIPALIDAD
}

enum EstadoPagoQR {
  PENDIENTE
  PAGADO
  EXPIRADO
  CANCELADO
}
```

También agregar estas relaciones al modelo `Cuenta` existente:
```prisma
// Dentro del model Cuenta — agregar líneas:
comercio          Comercio?
pagosQRDestino    PagoQR[]  @relation("QRDestino")
pagosQRPagador    PagoQR[]  @relation("QRPagador")
```

---

### 2. src/modules/comercios/ — CRUD de comercios

#### `src/modules/comercios/comercios.schema.ts`
```typescript
import { z } from 'zod'

export const crearComercioSchema = z.object({
  cuit:        z.string().min(11).max(13),
  razonSocial: z.string().min(2).max(200),
  rubro:       z.string().optional(),
  // Se crea automáticamente una Cuenta bancaria para el comercio
  // si no existe ya una para ese CUIT
})

export type CrearComercioDTO = z.infer<typeof crearComercioSchema>
```

#### `src/modules/comercios/comercios.service.ts`
```typescript
import { prisma } from '../../db/client'
import { crearCuenta } from '../cuentas/cuentas.service'
import type { CrearComercioDTO } from './comercios.schema'

export async function crearComercio(data: CrearComercioDTO) {
  // 1. Verificar que no exista
  const existe = await prisma.comercio.findUnique({ where: { cuit: data.cuit } })
  if (existe) throw new Error('Ya existe un comercio con ese CUIT')

  // 2. Crear o reutilizar la cuenta bancaria del comercio
  let cuenta = await prisma.cuenta.findUnique({ where: { cuit: data.cuit } })
  if (!cuenta) {
    cuenta = await crearCuenta({ cuit: data.cuit, titularNombre: data.razonSocial })
  }

  // 3. Crear el comercio vinculado a la cuenta
  return prisma.comercio.create({
    data: {
      cuit:       data.cuit,
      razonSocial: data.razonSocial,
      rubro:      data.rubro,
      cuentaId:   cuenta.id,
    },
    include: { cuenta: true },
  })
}

export async function obtenerComercioPorCuit(cuit: string) {
  return prisma.comercio.findUnique({
    where: { cuit },
    include: { cuenta: { select: { cbu: true, alias: true, saldo: true } } },
  })
}

export async function listarComercios(page = 1, limit = 20) {
  const skip = (page - 1) * limit
  const [total, items] = await Promise.all([
    prisma.comercio.count(),
    prisma.comercio.findMany({ skip, take: limit, include: { cuenta: true } }),
  ])
  return { total, page, limit, items }
}
```

#### `src/modules/comercios/comercios.controller.ts`
```typescript
import { Request, Response } from 'express'
import * as service from './comercios.service'
import { crearComercioSchema } from './comercios.schema'

export async function crearComercio(req: Request, res: Response) {
  try {
    const data     = crearComercioSchema.parse(req.body)
    const comercio = await service.crearComercio(data)
    res.status(201).json({ ok: true, data: comercio })
  } catch (e: any) { res.status(400).json({ ok: false, error: e.message }) }
}

export async function obtenerPorCuit(req: Request, res: Response) {
  try {
    const comercio = await service.obtenerComercioPorCuit(req.params.cuit)
    if (!comercio) return res.status(404).json({ ok: false, error: 'Comercio no encontrado' })
    res.json({ ok: true, data: comercio })
  } catch (e: any) { res.status(500).json({ ok: false, error: e.message }) }
}

export async function listar(req: Request, res: Response) {
  try {
    const page   = parseInt(req.query.page  as string) || 1
    const limit  = parseInt(req.query.limit as string) || 20
    res.json({ ok: true, data: await service.listarComercios(page, limit) })
  } catch (e: any) { res.status(500).json({ ok: false, error: e.message }) }
}
```

#### `src/modules/comercios/comercios.routes.ts`
```typescript
import { Router } from 'express'
import * as controller from './comercios.controller'

const router = Router()
router.post('/',        controller.crearComercio)
router.get('/',         controller.listar)
router.get('/:cuit',    controller.obtenerPorCuit)
export default router
```

---

### 3. src/modules/pagos-qr/ — Generación y procesamiento de QR

#### `src/modules/pagos-qr/pagos-qr.schema.ts`
```typescript
import { z } from 'zod'

export const generarQRSchema = z.object({
  // Quién cobra: puede ser un comercio por CUIT o una cuenta directa
  cuitDestino:  z.string().min(11).max(13).optional(),
  cbuDestino:   z.string().length(22).optional(),
  // Para organismos: tipo explícito
  tipoOrigen:   z.enum(['COMERCIO', 'ARCA', 'ARBA', 'MUNICIPALIDAD']).default('COMERCIO'),
  monto:        z.number().positive(),
  descripcion:  z.string().optional(),
  referencia:   z.string().optional(), // ID externo del organismo
  ttlMinutos:   z.number().int().min(1).max(60).default(15),
}).refine(d => d.cuitDestino || d.cbuDestino, {
  message: 'Debe indicar cuitDestino o cbuDestino',
})

export const pagarQRSchema = z.object({
  pagoId:      z.string(),      // ID del PagoQR a pagar
  cuitPagador: z.string().min(11).max(13),
})

export type GenerarQRDTO = z.infer<typeof generarQRSchema>
export type PagarQRDTO   = z.infer<typeof pagarQRSchema>
```

#### `src/modules/pagos-qr/pagos-qr.service.ts`
```typescript
import { prisma } from '../../db/client'
import { Decimal } from '@prisma/client/runtime/library'
import type { GenerarQRDTO, PagarQRDTO } from './pagos-qr.schema'

// Genera el payload del QR (en producción esto se pasa a una lib de QR)
function buildQRPayload(pagoId: string, monto: number, destino: string, descripcion?: string) {
  return JSON.stringify({
    sistema: 'banco-m',
    version: '1',
    pagoId,
    monto,
    destino,  // alias o CBU del destino
    descripcion,
    ts: Date.now(),
  })
}

export async function generarQR(dto: GenerarQRDTO) {
  // 1. Resolver cuenta destino
  let cuentaDestino
  if (dto.cuitDestino) {
    cuentaDestino = await prisma.cuenta.findUnique({ where: { cuit: dto.cuitDestino } })
  } else if (dto.cbuDestino) {
    cuentaDestino = await prisma.cuenta.findUnique({ where: { cbu: dto.cbuDestino } })
  }
  if (!cuentaDestino) throw new Error('Cuenta destino no encontrada')
  if (!cuentaDestino.activa) throw new Error('Cuenta destino inactiva')

  // 2. Resolver comercio si aplica
  let comercioId: string | undefined
  if (dto.tipoOrigen === 'COMERCIO' && dto.cuitDestino) {
    const comercio = await prisma.comercio.findUnique({ where: { cuit: dto.cuitDestino } })
    if (comercio) comercioId = comercio.id
  }

  // 3. Crear PagoQR
  const expiresAt = new Date(Date.now() + dto.ttlMinutos * 60 * 1000)
  const pagoId    = `pqr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
  const payload   = buildQRPayload(pagoId, dto.monto, cuentaDestino.alias, dto.descripcion)

  const pago = await prisma.pagoQR.create({
    data: {
      id:              pagoId,
      comercioId,
      cuentaDestinoId: cuentaDestino.id,
      monto:           dto.monto,
      descripcion:     dto.descripcion,
      referencia:      dto.referencia,
      tipoOrigen:      dto.tipoOrigen,
      qrPayload:       payload,
      expiresAt,
    },
  })

  return {
    pagoId:   pago.id,
    qrPayload: payload,
    // En producción: usar una lib como `qrcode` para generar el base64
    // qrBase64: await QRCode.toDataURL(payload)
    monto:    pago.monto,
    destino:  cuentaDestino.alias,
    expiresAt: pago.expiresAt,
  }
}

export async function pagarQR(dto: PagarQRDTO) {
  return prisma.$transaction(async (tx) => {
    // 1. Obtener el PagoQR
    const pago = await tx.pagoQR.findUnique({ where: { id: dto.pagoId } })
    if (!pago)                          throw new Error('QR no encontrado')
    if (pago.estado !== 'PENDIENTE')    throw new Error(`El QR ya fue ${pago.estado.toLowerCase()}`)
    if (new Date() > pago.expiresAt)    throw new Error('El QR expiró')

    // 2. Obtener cuentas
    const pagador = await tx.cuenta.findUnique({ where: { cuit: dto.cuitPagador } })
    if (!pagador)        throw new Error('Cuenta del pagador no encontrada')
    if (!pagador.activa) throw new Error('Cuenta del pagador inactiva')

    const destino = await tx.cuenta.findUnique({ where: { id: pago.cuentaDestinoId } })
    if (!destino) throw new Error('Cuenta destino no encontrada')

    if (pagador.id === destino.id) throw new Error('No podés pagarle a tu propia cuenta')

    // 3. Verificar saldo
    const saldoPagador = new Decimal(pagador.saldo)
    if (saldoPagador.lessThan(pago.monto)) throw new Error('Saldo insuficiente')

    // 4. Calcular nuevos saldos
    const nuevoSaldoPagador = saldoPagador.minus(pago.monto)
    const nuevoSaldoDestino = new Decimal(destino.saldo).plus(pago.monto)

    // 5. Actualizar saldos
    await tx.cuenta.update({ where: { id: pagador.id }, data: { saldo: nuevoSaldoPagador } })
    await tx.cuenta.update({ where: { id: destino.id }, data: { saldo: nuevoSaldoDestino } })

    // 6. Crear Transferencia
    const transferencia = await tx.transferencia.create({
      data: {
        origenId:   pagador.id,
        destinoId:  destino.id,
        monto:      pago.monto,
        descripcion: pago.descripcion || `Pago QR ${pago.tipoOrigen}`,
        estado:     'COMPLETADA',
      },
    })

    // 7. Crear Movimientos (auditoría completa)
    const descripDebito  = pago.descripcion || `Pago QR a ${destino.titularNombre}`
    const descripCredito = pago.descripcion || `Cobro QR de ${pagador.titularNombre}`
    await tx.movimiento.createMany({
      data: [
        {
          cuentaId: pagador.id, tipo: 'DEBITO', monto: pago.monto,
          descripcion: descripDebito, origen: pago.tipoOrigen,
          referencia: pago.referencia || transferencia.id,
          saldoAntes: pagador.saldo, saldoDespues: nuevoSaldoPagador,
        },
        {
          cuentaId: destino.id, tipo: 'CREDITO', monto: pago.monto,
          descripcion: descripCredito, origen: pago.tipoOrigen,
          referencia: pago.referencia || transferencia.id,
          saldoAntes: destino.saldo, saldoDespues: nuevoSaldoDestino,
        },
      ],
    })

    // 8. Marcar QR como PAGADO
    await tx.pagoQR.update({
      where: { id: pago.id },
      data: {
        estado:         'PAGADO',
        cuentaOrigenId: pagador.id,
        transferenciaId: transferencia.id,
        confirmadoEn:   new Date(),
      },
    })

    return { transferenciaId: transferencia.id, monto: pago.monto }
  })
}

export async function obtenerEstadoQR(pagoId: string) {
  const pago = await prisma.pagoQR.findUnique({
    where: { id: pagoId },
    include: {
      cuentaDestino: { select: { alias: true, titularNombre: true } },
      cuentaOrigen:  { select: { alias: true, titularNombre: true } },
    },
  })
  if (!pago) throw new Error('QR no encontrado')
  // Auto-expirar si venció
  if (pago.estado === 'PENDIENTE' && new Date() > pago.expiresAt) {
    await prisma.pagoQR.update({ where: { id: pagoId }, data: { estado: 'EXPIRADO' } })
    return { ...pago, estado: 'EXPIRADO' }
  }
  return pago
}
```

#### `src/modules/pagos-qr/pagos-qr.controller.ts`
```typescript
import { Request, Response } from 'express'
import * as service from './pagos-qr.service'
import { generarQRSchema, pagarQRSchema } from './pagos-qr.schema'

export async function generar(req: Request, res: Response) {
  try {
    const data   = generarQRSchema.parse(req.body)
    const result = await service.generarQR(data)
    res.status(201).json({ ok: true, data: result })
  } catch (e: any) { res.status(400).json({ ok: false, error: e.message }) }
}

export async function pagar(req: Request, res: Response) {
  try {
    const data   = pagarQRSchema.parse(req.body)
    const result = await service.pagarQR(data)
    res.status(200).json({ ok: true, data: result })
  } catch (e: any) { res.status(400).json({ ok: false, error: e.message }) }
}

export async function estado(req: Request, res: Response) {
  try {
    const result = await service.obtenerEstadoQR(req.params.pagoId)
    res.json({ ok: true, data: result })
  } catch (e: any) { res.status(404).json({ ok: false, error: e.message }) }
}
```

#### `src/modules/pagos-qr/pagos-qr.routes.ts`
```typescript
import { Router } from 'express'
import * as controller from './pagos-qr.controller'

const router = Router()
router.post('/generar',       controller.generar)       // Comercio/organismo genera QR
router.post('/pagar',         controller.pagar)         // Cliente paga escaneando QR
router.get('/estado/:pagoId', controller.estado)        // Consultar estado del QR
export default router
```

---

### 4. src/modules/webhooks/ — Receptor de confirmaciones externas (TPPV / ARCA / ARBA / Municipalidad)

#### `src/modules/webhooks/webhooks.schema.ts`
```typescript
import { z } from 'zod'

// Webhook genérico — cada sistema externo puede enviar su formato
export const webhookPagoSchema = z.object({
  evento:     z.string(),           // ej: "pago.confirmado" | "pago.rechazado"
  pagoId:     z.string().optional(),// ID de PagoQR en banco-m (si lo conoce)
  referencia: z.string().optional(),// ID externo del sistema pagador
  monto:      z.number().positive().optional(),
  origen:     z.enum(['TPPV', 'ARCA', 'ARBA', 'MUNICIPALIDAD']),
  estado:     z.enum(['CONFIRMADO', 'RECHAZADO']),
  payload:    z.record(z.unknown()).optional(), // datos extras del sistema
})

export type WebhookPagoDTO = z.infer<typeof webhookPagoSchema>
```

#### `src/modules/webhooks/webhooks.service.ts`
```typescript
import { prisma } from '../../db/client'
import type { WebhookPagoDTO } from './webhooks.schema'

export async function procesarWebhookPago(dto: WebhookPagoDTO) {
  // 1. Loguear siempre (idempotente)
  const log = await prisma.webhookLog.create({
    data: {
      evento:   dto.evento,
      payload:  dto.payload ?? dto as any,
      origen:   dto.origen,
      procesado: false,
    },
  })

  try {
    // 2. Si viene con pagoId → actualizar el QR correspondiente
    if (dto.pagoId) {
      const pago = await prisma.pagoQR.findUnique({ where: { id: dto.pagoId } })
      
      if (pago && pago.estado === 'PENDIENTE') {
        if (dto.estado === 'CONFIRMADO') {
          // El TPPV confirma: el pago ya fue procesado internamente,
          // solo actualizamos el registro de confirmación externa
          await prisma.pagoQR.update({
            where: { id: dto.pagoId },
            data: { confirmadoEn: new Date() },
          })
        } else if (dto.estado === 'RECHAZADO') {
          await prisma.pagoQR.update({
            where: { id: dto.pagoId },
            data: { estado: 'CANCELADO' },
          })
        }
      }
    }

    // 3. Si viene por referencia (organismo informa pago externo) → registrar crédito
    if (!dto.pagoId && dto.referencia && dto.monto && dto.estado === 'CONFIRMADO') {
      // Buscar cuenta del organismo por origen
      // Convenio: cada organismo tiene su CUIT fijo en .env
      const cuitOrganismo = process.env[`CUIT_${dto.origen}`]
      if (cuitOrganismo) {
        const cuentaOrg = await prisma.cuenta.findUnique({ where: { cuit: cuitOrganismo } })
        if (cuentaOrg) {
          const { Decimal } = await import('@prisma/client/runtime/library')
          const saldoAntes   = cuentaOrg.saldo
          const saldoDespues = new Decimal(cuentaOrg.saldo).plus(dto.monto)
          await prisma.$transaction([
            prisma.cuenta.update({
              where: { id: cuentaOrg.id },
              data: { saldo: saldoDespues },
            }),
            prisma.movimiento.create({
              data: {
                cuentaId: cuentaOrg.id, tipo: 'CREDITO', monto: dto.monto,
                descripcion: `Pago confirmado por webhook ${dto.origen}`,
                origen: dto.origen, referencia: dto.referencia,
                saldoAntes, saldoDespues,
              },
            }),
          ])
        }
      }
    }

    // 4. Marcar log como procesado
    await prisma.webhookLog.update({ where: { id: log.id }, data: { procesado: true } })
    return { recibido: true, logId: log.id }
  } catch (err: any) {
    await prisma.webhookLog.update({
      where: { id: log.id },
      data: { error: err.message },
    })
    throw err
  }
}
```

#### `src/modules/webhooks/webhooks.controller.ts`
```typescript
import { Request, Response } from 'express'
import * as service from './webhooks.service'
import { webhookPagoSchema } from './webhooks.schema'

export async function pagoConfirmado(req: Request, res: Response) {
  try {
    // Validar firma/secret del webhook (simple header check)
    const secret = req.headers['x-webhook-secret']
    if (process.env.WEBHOOK_SECRET && secret !== process.env.WEBHOOK_SECRET) {
      return res.status(401).json({ ok: false, error: 'Firma inválida' })
    }
    const data   = webhookPagoSchema.parse(req.body)
    const result = await service.procesarWebhookPago(data)
    res.json({ ok: true, data: result })
  } catch (e: any) {
    // Siempre responder 200 a webhooks externos (para evitar reintentos)
    res.status(200).json({ ok: false, logged: true, error: e.message })
  }
}
```

#### `src/modules/webhooks/webhooks.routes.ts`
```typescript
import { Router } from 'express'
import * as controller from './webhooks.controller'

const router = Router()
router.post('/pago-confirmado', controller.pagoConfirmado)
export default router
```

---

### 5. src/index.ts — actualizar para montar las nuevas rutas

Agregar estas importaciones y `app.use()` al `src/index.ts` existente:

```typescript
// Agregar imports:
import comerciosRouter  from './modules/comercios/comercios.routes'
import pagosQRRouter    from './modules/pagos-qr/pagos-qr.routes'
import webhooksRouter   from './modules/webhooks/webhooks.routes'

// Agregar después de las rutas existentes:
app.use('/api/comercios',  comerciosRouter)
app.use('/api/pagos/qr',   pagosQRRouter)
app.use('/api/webhooks',   webhooksRouter)
```

---

### 6. .env.example — agregar variables nuevas

```env
# Variables existentes...
DATABASE_URL="postgresql://usuario:password@localhost:5432/banco_m"
PORT=3001
NODE_ENV=development

# Webhook
WEBHOOK_SECRET="un-secret-largo-y-seguro-para-validar-webhooks"

# CUIT de cada organismo (para acreditar pagos externos)
CUIT_ARCA="30000000007"
CUIT_ARBA="30000000008"
CUIT_MUNICIPALIDAD="30000000009"
```

---

## Árbol final de archivos NUEVOS

```
banco-m/src/modules/
├── comercios/
│   ├── comercios.schema.ts
│   ├── comercios.service.ts
│   ├── comercios.controller.ts
│   └── comercios.routes.ts
├── pagos-qr/
│   ├── pagos-qr.schema.ts
│   ├── pagos-qr.service.ts
│   ├── pagos-qr.controller.ts
│   └── pagos-qr.routes.ts
└── webhooks/
    ├── webhooks.schema.ts
    ├── webhooks.service.ts
    ├── webhooks.controller.ts
    └── webhooks.routes.ts
```

Archivos a MODIFICAR (no reemplazar, solo agregar líneas):
- `prisma/schema.prisma` — nuevos modelos y relaciones
- `src/index.ts` — montar 3 nuevas rutas
- `.env.example` — nuevas variables

---

## Endpoints nuevos

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | /api/comercios | Dar de alta un comercio (crea cuenta automáticamente) |
| GET  | /api/comercios | Listar comercios |
| GET  | /api/comercios/:cuit | Obtener comercio por CUIT |
| POST | /api/pagos/qr/generar | Comercio/organismo genera QR de cobro |
| POST | /api/pagos/qr/pagar | Cliente paga escaneando el QR |
| GET  | /api/pagos/qr/estado/:pagoId | Consultar estado de un QR |
| POST | /api/webhooks/pago-confirmado | TPPV / ARCA / ARBA / Municipalidad confirma pago |

---

## Pasos a ejecutar al terminar

```bash
cd banco-m
npx prisma generate
npx tsc --noEmit
```

⚠️ NO ejecutar `prisma db push` ni `npm run dev` — lo hace el usuario cuando configure el .env.

Reportar: lista de archivos creados/modificados + resultado del tsc.

---

## Notas de diseño

- **Idempotencia de webhooks**: Siempre se loguea en `WebhookLog` antes de procesar. Si el mismo webhook llega dos veces, el segundo no vuelve a mover saldo porque el `PagoQR` ya no estará en estado PENDIENTE.
- **QR con TTL**: Los QR vencen (default 15 min). El endpoint de estado los marca como EXPIRADO automáticamente al consultarlos vencidos.
- **Organismos como cuentas**: ARCA, ARBA y Municipalidad tienen sus propias cuentas en banco-m identificadas por CUIT en `.env`. Cuando un ciudadano paga un impuesto desde su billetera, el dinero va a esa cuenta del organismo. Cuando el organismo confirma un pago externo via webhook, también se acredita ahí.
- **TPPV**: El TPPV puede confirmar o rechazar un pago que ya se procesó internamente. La confirmación es informativa; el rechazo cancela el QR (pero la transferencia ya ejecutada requeriría una lógica de reversión separada — no incluida en esta versión).
- **Seguridad básica**: `WEBHOOK_SECRET` en header `x-webhook-secret`. En producción agregar HMAC-SHA256.
