// Datos de prueba ficticios para la demo de banco-m. Se puede correr varias
// veces: no duplica cuentas ni usuarios (npm run db:seed).
import 'dotenv/config'
import { PrismaClient, RolUsuario } from '@prisma/client'
import { generarCBU } from '../src/utils/cbu'
import { generarAlias } from '../src/utils/alias'
import { hashPassword } from '../src/modules/auth/auth.service'

const prisma = new PrismaClient()
const PASSWORD = process.env.DEMO_PASSWORD || 'banco1234'

type Alta = { cuit: string; nombre: string; rol: RolUsuario; saldo: number; rubro?: string }

const ALTAS: Alta[] = [
  { cuit: '20111111112', nombre: 'Administración Banco M', rol: 'ADMIN', saldo: 0 },
  { cuit: '20268326074', nombre: 'Cátedra I26 (Demo)', rol: 'CLIENTE', saldo: 200000 },
  { cuit: '27123456789', nombre: 'María Gómez', rol: 'CLIENTE', saldo: 150000 },
  { cuit: '20345678901', nombre: 'Juan Pérez', rol: 'CLIENTE', saldo: 80000 },
  { cuit: '30712345678', nombre: 'Almacén Don Mateo SRL', rol: 'COMERCIO', saldo: 50000, rubro: 'Almacén' },
  { cuit: '30987654321', nombre: 'Kiosco La Esquina SA', rol: 'COMERCIO', saldo: 30000, rubro: 'Kiosco' },
  { cuit: '30000000007', nombre: 'ARCA (Demo)', rol: 'ORGANISMO', saldo: 0 },
  { cuit: '30000000008', nombre: 'ARBA (Demo)', rol: 'ORGANISMO', saldo: 0 },
  { cuit: '30000000009', nombre: 'Municipalidad (Demo)', rol: 'ORGANISMO', saldo: 0 },
]

async function main() {
  for (const a of ALTAS) {
    let cuenta = await prisma.cuenta.findUnique({ where: { cuit: a.cuit } })
    if (!cuenta) {
      cuenta = await prisma.cuenta.create({
        data: { cuit: a.cuit, cbu: generarCBU(a.cuit), alias: generarAlias(a.cuit), titularNombre: a.nombre, saldo: a.saldo },
      })
      if (a.saldo > 0) {
        await prisma.movimiento.create({
          data: {
            cuentaId: cuenta.id, tipo: 'CREDITO', monto: a.saldo, descripcion: 'Saldo inicial de prueba',
            origen: 'DEPOSITO', saldoAntes: 0, saldoDespues: a.saldo,
          },
        })
      }
    }
    if (a.rol === 'COMERCIO') {
      await prisma.comercio.upsert({
        where: { cuit: a.cuit }, update: {},
        create: { cuit: a.cuit, razonSocial: a.nombre, rubro: a.rubro, cuentaId: cuenta.id },
      })
    }
    await prisma.usuario.upsert({
      where: { cuit: a.cuit },
      update: { nombre: a.nombre, rol: a.rol },
      create: { cuit: a.cuit, nombre: a.nombre, rol: a.rol, passwordHash: hashPassword(PASSWORD) },
    })
    console.log(`${a.rol.padEnd(9)} ${a.cuit}  ${cuenta.alias}`)
  }
}

main().finally(() => prisma.$disconnect())
