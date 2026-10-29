# banco-m — Prompt de Implementación Completo

> **Proyecto:** i26sintegra · Módulo bancario / billetera virtual  
> **Stack:** Node.js · TypeScript · Express · Prisma · PostgreSQL · Zod  
> **Fecha:** 2026-10-28

---

## INSTRUCCIONES PARA CODEX / CLAUDE CODE

Sos el agente de desarrollo del módulo `banco-m` dentro del monorepo `i26sintegra`.

Tu tarea es crear desde cero la app `banco-m` completa con toda su estructura de archivos, modelos de base de datos, lógica de negocio y endpoints REST. **No modifiques ningún archivo existente del proyecto**, solo creá todo dentro de la carpeta `banco-m/`.

---

## PASO 1 — Estructura de carpetas

Crear exactamente esta estructura:

```
banco-m/
├── README.md
├── package.json
├── tsconfig.json
├── .env.example
├── prisma/
│   └── schema.prisma
└── src/
    ├── index.ts
    ├── config/
    │   └── env.ts
    ├── db/
    │   └── client.ts
    ├── modules/
    │   ├── cuentas/
    │   │   ├── cuentas.routes.ts
    │   │   ├── cuentas.controller.ts
    │   │   ├── cuentas.service.ts
    │   │   └── cuentas.schema.ts
    │   ├── movimientos/
    │   │   ├── movimientos.routes.ts
    │   │   ├── movimientos.controller.ts
    │   │   ├── movimientos.service.ts
    │   │   └── movimientos.schema.ts
    │   └── transferencias/
    │       ├── transferencias.routes.ts
    │       ├── transferencias.controller.ts
    │       ├── transferencias.service.ts
    │       └── transferencias.schema.ts
    └── utils/
        ├── cbu.ts
        └── alias.ts
```

---

## PASO 2 — Contenido de cada archivo

### `package.json`

```json
{
  "name": "banco-m",
  "version": "0.1.0",
  "description": "Módulo bancario / billetera virtual — i26sintegra",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "db:push": "prisma db push",
    "db:studio": "prisma studio",
    "db:generate": "prisma generate"
  },
  "dependencies": {
    "@prisma/client": "^5.14.0",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/node": "^20.14.0",
    "prisma": "^5.14.0",
    "tsx": "^4.15.7",
    "typescript": "^5.4.5"
  }
}
```

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### `.env.example`

```
DATABASE_URL="postgresql://usuario:password@localhost:5432/banco_m"
PORT=3001
NODE_ENV=development
```

### `prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Cuenta {
  id             String   @id @default(cuid())
  cuit           String   @unique
  cbu            String   @unique
  alias          String   @unique
  titularNombre  String
  saldo          Decimal  @default(0) @db.Decimal(15, 2)
  activa         Boolean  @default(true)
  creadaEn       DateTime @default(now())
  actualizadaEn  DateTime @updatedAt

  movimientos             Movimiento[]
  transferenciasEnviadas  Transferencia[] @relation("Origen")
  transferenciasRecibidas Transferencia[] @relation("Destino")
}

model Movimiento {
  id            String         @id @default(cuid())
  cuentaId      String
  tipo          TipoMovimiento
  monto         Decimal        @db.Decimal(15, 2)
  descripcion   String?
  referencia    String?
  origen        String?
  saldoAntes    Decimal        @db.Decimal(15, 2)
  saldoDespues  Decimal        @db.Decimal(15, 2)
  creadoEn      DateTime       @default(now())

  cuenta Cuenta @relation(fields: [cuentaId], references: [id])
}

model Transferencia {
  id          String              @id @default(cuid())
  origenId    String
  destinoId   String
  monto       Decimal             @db.Decimal(15, 2)
  descripcion String?
  estado      EstadoTransferencia @default(PENDIENTE)
  creadaEn    DateTime            @default(now())

  origen  Cuenta @relation("Origen",  fields: [origenId],  references: [id])
  destino Cuenta @relation("Destino", fields: [destinoId], references: [id])
}

enum TipoMovimiento {
  CREDITO
  DEBITO
}

enum EstadoTransferencia {
  PENDIENTE
  COMPLETADA
  RECHAZADA
}
```

### `src/config/env.ts`

```typescript
import dotenv from 'dotenv'
dotenv.config()

export const env = {
  PORT: parseInt(process.env.PORT || '3001'),
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL || '',
}
```

### `src/db/client.ts`

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query', 'error', 'warn'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

### `src/utils/cbu.ts`

```typescript
/**
 * Generador de CBU virtual — banco-m
 * Prefijo de entidad ficticia: 0000099 (no corresponde a ningún banco real)
 * Algoritmo de dígito verificador estándar argentino
 */

function calcularDigitoVerificador(bloque: string, pesos: number[]): number {
  let suma = 0
  for (let i = 0; i < bloque.length; i++) {
    suma += parseInt(bloque[i]) * pesos[i]
  }
  const resto = suma % 10
  return resto === 0 ? 0 : 10 - resto
}

export function generarCBU(cuit: string): string {
  // Bloque 1: entidad (3) + sucursal (4) + dígito verificador (1)
  const entidad = '000'
  const sucursal = '0099'
  const bloque1Sin = entidad + sucursal
  const dv1 = calcularDigitoVerificador(bloque1Sin, [7, 1, 3, 9, 7, 1, 3])
  const bloque1 = bloque1Sin + dv1

  // Bloque 2: número de cuenta (13) + dígito verificador (1)
  const cuitNumerico = cuit.replace(/\D/g, '').padEnd(11, '0').substring(0, 11)
  const timestamp = Date.now().toString().substring(5, 7)
  const numeroCuenta = (cuitNumerico + timestamp).substring(0, 13).padStart(13, '0')
  const dv2 = calcularDigitoVerificador(numeroCuenta, [3, 9, 7, 1, 3, 9, 7, 1, 3, 9, 7, 1, 3])
  const bloque2 = numeroCuenta + dv2

  return bloque1 + bloque2
}
```

### `src/utils/alias.ts`

```typescript
/**
 * Generador de alias determinístico basado en CUIT
 * Formato: PALABRA.PALABRA.CUIT (ej: MATE.SOL.27123456789)
 */

const PALABRAS = [
  'MATE', 'SOL', 'MAR', 'LUNA', 'RIO', 'CAMPO', 'VIENTO', 'NUBE',
  'PUMA', 'CONDOR', 'GAUCHO', 'PAMPA', 'CEIBO', 'TERO', 'NANDU',
  'PLATA', 'ORO', 'VERDE', 'AZUL', 'ROJO', 'BLANCO', 'NEGRO',
  'MANGO', 'PERA', 'DURAZNO', 'UVA', 'NARANJA', 'LIMON', 'FRUTILLA',
  'TIGRE', 'LEON', 'AGUILA', 'ZORRO', 'LOBO', 'OSO', 'PATO',
  'NORTE', 'SUR', 'ESTE', 'OESTE', 'CENTRO', 'ALTO', 'BAJO',
  'RAPIDO', 'FIRME', 'CLARO', 'LIBRE', 'FUERTE', 'NOBLE', 'JUSTO'
]

function hashCuit(cuit: string): number {
  const numeros = cuit.replace(/\D/g, '')
  let hash = 0
  for (let i = 0; i < numeros.length; i++) {
    hash = (hash * 31 + parseInt(numeros[i])) >>> 0
  }
  return hash
}

export function generarAlias(cuit: string): string {
  const hash = hashCuit(cuit)
  const idx1 = hash % PALABRAS.length
  const idx2 = (hash * 7 + 13) % PALABRAS.length
  const palabra1 = PALABRAS[idx1]
  const palabra2 = PALABRAS[idx2 === idx1 ? (idx2 + 1) % PALABRAS.length : idx2]
  const cuitLimpio = cuit.replace(/\D/g, '')
  return `${palabra1}.${palabra2}.${cuitLimpio}`
}
```

### `src/modules/cuentas/cuentas.schema.ts`

```typescript
import { z } from 'zod'

export const crearCuentaSchema = z.object({
  cuit: z.string().min(11).max(13),
  titularNombre: z.string().min(2).max(200),
})

export type CrearCuentaDTO = z.infer<typeof crearCuentaSchema>
```

### `src/modules/cuentas/cuentas.service.ts`

```typescript
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
    data: { cuit: data.cuit, cbu, alias, titularNombre: data.titularNombre, saldo: 0 },
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
  return prisma.cuenta.update({ where: { cuit }, data: { activa: !cuenta.activa } })
}
```

### `src/modules/cuentas/cuentas.controller.ts`

```typescript
import { Request, Response } from 'express'
import * as service from './cuentas.service'
import { crearCuentaSchema } from './cuentas.schema'

export async function crearCuenta(req: Request, res: Response) {
  try {
    const data = crearCuentaSchema.parse(req.body)
    const cuenta = await service.crearCuenta(data)
    res.status(201).json({ ok: true, data: cuenta })
  } catch (e: any) { res.status(400).json({ ok: false, error: e.message }) }
}

export async function obtenerPorCuit(req: Request, res: Response) {
  try {
    const cuenta = await service.obtenerPorCuit(req.params.cuit)
    if (!cuenta) return res.status(404).json({ ok: false, error: 'No encontrada' })
    res.json({ ok: true, data: cuenta })
  } catch (e: any) { res.status(500).json({ ok: false, error: e.message }) }
}

export async function obtenerPorCBU(req: Request, res: Response) {
  try {
    const cuenta = await service.obtenerPorCBU(req.params.cbu)
    if (!cuenta) return res.status(404).json({ ok: false, error: 'No encontrada' })
    res.json({ ok: true, data: cuenta })
  } catch (e: any) { res.status(500).json({ ok: false, error: e.message }) }
}

export async function obtenerPorAlias(req: Request, res: Response) {
  try {
    const cuenta = await service.obtenerPorAlias(req.params.alias)
    if (!cuenta) return res.status(404).json({ ok: false, error: 'No encontrada' })
    res.json({ ok: true, data: cuenta })
  } catch (e: any) { res.status(500).json({ ok: false, error: e.message }) }
}

export async function obtenerSaldo(req: Request, res: Response) {
  try {
    const saldo = await service.obtenerSaldo(req.params.cuit)
    res.json({ ok: true, data: saldo })
  } catch (e: any) { res.status(404).json({ ok: false, error: e.message }) }
}

export async function toggleActivar(req: Request, res: Response) {
  try {
    const cuenta = await service.toggleActivar(req.params.cuit)
    res.json({ ok: true, data: cuenta })
  } catch (e: any) { res.status(404).json({ ok: false, error: e.message }) }
}
```

### `src/modules/cuentas/cuentas.routes.ts`

```typescript
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
```

### `src/modules/movimientos/movimientos.schema.ts`

```typescript
import { z } from 'zod'

export const depositoSchema = z.object({
  cuit: z.string().min(11).max(13),
  monto: z.number().positive(),
  descripcion: z.string().optional(),
  origen: z.enum(['ARBA', 'ARCA', 'MUNICIPALIDAD', 'DEPOSITO', 'OTRO']).optional(),
  referencia: z.string().optional(),
})

export const debitoSchema = z.object({
  cuit: z.string().min(11).max(13),
  monto: z.number().positive(),
  descripcion: z.string().optional(),
  origen: z.enum(['ARBA', 'ARCA', 'MUNICIPALIDAD', 'DEBITO', 'OTRO']).optional(),
  referencia: z.string().optional(),
})

export type DepositoDTO = z.infer<typeof depositoSchema>
export type DebitoDTO   = z.infer<typeof debitoSchema>
```

### `src/modules/movimientos/movimientos.service.ts`

```typescript
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
```

### `src/modules/movimientos/movimientos.controller.ts`

```typescript
import { Request, Response } from 'express'
import * as service from './movimientos.service'
import { depositoSchema, debitoSchema } from './movimientos.schema'

export async function deposito(req: Request, res: Response) {
  try {
    const data = depositoSchema.parse(req.body)
    const mov = await service.registrarDeposito(data)
    res.status(201).json({ ok: true, data: mov })
  } catch (e: any) { res.status(400).json({ ok: false, error: e.message }) }
}

export async function debito(req: Request, res: Response) {
  try {
    const data = debitoSchema.parse(req.body)
    const mov = await service.registrarDebito(data)
    res.status(201).json({ ok: true, data: mov })
  } catch (e: any) { res.status(400).json({ ok: false, error: e.message }) }
}

export async function listar(req: Request, res: Response) {
  try {
    const page  = parseInt(req.query.page  as string) || 1
    const limit = parseInt(req.query.limit as string) || 20
    const result = await service.listarMovimientos(req.params.cuentaId, page, limit)
    res.json({ ok: true, data: result })
  } catch (e: any) { res.status(500).json({ ok: false, error: e.message }) }
}
```

### `src/modules/movimientos/movimientos.routes.ts`

```typescript
import { Router } from 'express'
import * as controller from './movimientos.controller'

const router = Router()
router.get('/:cuentaId',   controller.listar)
router.post('/deposito',   controller.deposito)
router.post('/debito',     controller.debito)
export default router
```

### `src/modules/transferencias/transferencias.schema.ts`

```typescript
import { z } from 'zod'

export const transferenciaSchema = z.object({
  origenCuit:  z.string().min(11).max(13),
  monto:       z.number().positive(),
  descripcion: z.string().optional(),
}).and(z.union([
  z.object({ destinoCuit:  z.string().min(11).max(13) }),
  z.object({ destinoCBU:   z.string().length(22) }),
  z.object({ destinoAlias: z.string().min(3) }),
]))

export type TransferenciaDTO = z.infer<typeof transferenciaSchema>
```

### `src/modules/transferencias/transferencias.service.ts`

```typescript
import { prisma } from '../../db/client'
import { Decimal } from '@prisma/client/runtime/library'
import type { TransferenciaDTO } from './transferencias.schema'

async function resolverDestino(dto: TransferenciaDTO) {
  if ('destinoCuit'  in dto) return prisma.cuenta.findUnique({ where: { cuit:  dto.destinoCuit } })
  if ('destinoCBU'   in dto) return prisma.cuenta.findUnique({ where: { cbu:   dto.destinoCBU } })
  if ('destinoAlias' in dto) return prisma.cuenta.findUnique({ where: { alias: dto.destinoAlias.toUpperCase() } })
  return null
}

export async function crearTransferencia(dto: TransferenciaDTO) {
  return prisma.$transaction(async (tx) => {
    const origen  = await tx.cuenta.findUnique({ where: { cuit: dto.origenCuit } })
    if (!origen)         throw new Error('Cuenta origen no encontrada')
    if (!origen.activa)  throw new Error('Cuenta origen inactiva')

    const destino = await resolverDestino(dto)
    if (!destino)         throw new Error('Cuenta destino no encontrada')
    if (!destino.activa)  throw new Error('Cuenta destino inactiva')
    if (origen.id === destino.id) throw new Error('No podés transferir a tu propia cuenta')

    const saldoOrigen = new Decimal(origen.saldo)
    if (saldoOrigen.lessThan(dto.monto)) throw new Error('Saldo insuficiente')

    const nuevoSaldoOrigen  = saldoOrigen.minus(dto.monto)
    const nuevoSaldoDestino = new Decimal(destino.saldo).plus(dto.monto)

    await tx.cuenta.update({ where: { id: origen.id  }, data: { saldo: nuevoSaldoOrigen } })
    await tx.cuenta.update({ where: { id: destino.id }, data: { saldo: nuevoSaldoDestino } })

    const transferencia = await tx.transferencia.create({
      data: {
        origenId: origen.id, destinoId: destino.id,
        monto: dto.monto, descripcion: dto.descripcion, estado: 'COMPLETADA',
      },
    })

    await tx.movimiento.createMany({
      data: [
        {
          cuentaId: origen.id, tipo: 'DEBITO', monto: dto.monto,
          descripcion: dto.descripcion || `Transferencia a ${destino.titularNombre}`,
          origen: 'TRANSFERENCIA', referencia: transferencia.id,
          saldoAntes: origen.saldo, saldoDespues: nuevoSaldoOrigen,
        },
        {
          cuentaId: destino.id, tipo: 'CREDITO', monto: dto.monto,
          descripcion: dto.descripcion || `Transferencia de ${origen.titularNombre}`,
          origen: 'TRANSFERENCIA', referencia: transferencia.id,
          saldoAntes: destino.saldo, saldoDespues: nuevoSaldoDestino,
        },
      ],
    })

    return transferencia
  })
}

export async function listarTransferencias(cuentaId: string) {
  return prisma.transferencia.findMany({
    where: { OR: [{ origenId: cuentaId }, { destinoId: cuentaId }] },
    include: {
      origen:  { select: { cuit: true, titularNombre: true, alias: true } },
      destino: { select: { cuit: true, titularNombre: true, alias: true } },
    },
    orderBy: { creadaEn: 'desc' },
  })
}
```

### `src/modules/transferencias/transferencias.controller.ts`

```typescript
import { Request, Response } from 'express'
import * as service from './transferencias.service'
import { transferenciaSchema } from './transferencias.schema'

export async function crear(req: Request, res: Response) {
  try {
    const data = transferenciaSchema.parse(req.body)
    const transferencia = await service.crearTransferencia(data)
    res.status(201).json({ ok: true, data: transferencia })
  } catch (e: any) { res.status(400).json({ ok: false, error: e.message }) }
}

export async function listar(req: Request, res: Response) {
  try {
    const result = await service.listarTransferencias(req.params.cuentaId)
    res.json({ ok: true, data: result })
  } catch (e: any) { res.status(500).json({ ok: false, error: e.message }) }
}
```

### `src/modules/transferencias/transferencias.routes.ts`

```typescript
import { Router } from 'express'
import * as controller from './transferencias.controller'

const router = Router()
router.post('/',           controller.crear)
router.get('/:cuentaId',   controller.listar)
export default router
```

### `src/index.ts`

```typescript
import express from 'express'
import cors from 'cors'
import { env } from './config/env'
import cuentasRouter       from './modules/cuentas/cuentas.routes'
import movimientosRouter   from './modules/movimientos/movimientos.routes'
import transferenciasRouter from './modules/transferencias/transferencias.routes'

const app = express()
app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, servicio: 'banco-m', timestamp: new Date().toISOString() })
})

app.use('/api/cuentas',        cuentasRouter)
app.use('/api/movimientos',    movimientosRouter)
app.use('/api/transferencias', transferenciasRouter)

app.use((_req, res) => {
  res.status(404).json({ ok: false, error: 'Ruta no encontrada' })
})

app.listen(env.PORT, () => {
  console.log(`✅ banco-m corriendo en http://localhost:${env.PORT}`)
  console.log(`📋 Ambiente: ${env.NODE_ENV}`)
})

export default app
```

### `README.md`

```markdown
# banco-m — Módulo Bancario / Billetera Virtual

Parte del sistema i26sintegra. Gestiona cuentas virtuales vinculadas por CUIT
con CBU y alias propios, movimientos auditados y transferencias entre cuentas.

## Setup

1. Copiar y editar variables de entorno:
   cp .env.example .env

2. Instalar dependencias:
   npm install

3. Crear la base de datos:
   npm run db:push

4. Iniciar en desarrollo:
   npm run dev

## Endpoints

| Método | Ruta                        | Descripción                     |
|--------|-----------------------------|---------------------------------|
| POST   | /api/cuentas                | Crear cuenta por CUIT           |
| GET    | /api/cuentas/:cuit          | Obtener cuenta                  |
| GET    | /api/cuentas/:cuit/saldo    | Consultar saldo                 |
| GET    | /api/cuentas/cbu/:cbu       | Buscar por CBU                  |
| GET    | /api/cuentas/alias/:alias   | Buscar por alias                |
| PATCH  | /api/cuentas/:cuit/activar  | Activar/desactivar              |
| POST   | /api/movimientos/deposito   | Registrar depósito              |
| POST   | /api/movimientos/debito     | Registrar débito                |
| GET    | /api/movimientos/:cuentaId  | Listar movimientos paginados    |
| POST   | /api/transferencias         | Transferir entre cuentas        |
| GET    | /api/transferencias/:id     | Listar transferencias           |
| GET    | /api/health                 | Estado del servicio             |

## Integración con i26sintegra

- Campo `origen` en Movimiento: `ARBA` | `ARCA` | `MUNICIPALIDAD` | `DEPOSITO` | `OTRO`
- Campo `referencia`: guarda el ID externo del sistema origen
- Vinculación por CUIT con el resto del sistema
```

---

## PASO 3 — Comandos a ejecutar al terminar

Desde la carpeta `banco-m/`:

```bash
npm install
npx tsc --noEmit
```

**No ejecutar** `npm run dev` ni `prisma db push` — eso lo hace el usuario cuando configure su `.env`.

---

## RESUMEN DE TAREAS

1. ✅ Crear carpeta `banco-m/` en la raíz del monorepo `i26sintegra`
2. ✅ Crear todos los archivos con el contenido exacto indicado
3. ✅ Ejecutar `npm install` dentro de `banco-m/`
4. ✅ Ejecutar `npx tsc --noEmit` para verificar compilación
5. ✅ Reportar errores y corregirlos
6. ✅ Confirmar con lista de archivos creados
