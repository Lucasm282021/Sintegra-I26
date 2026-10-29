// Ingreso al panel web con CUIT y contraseña. El token es un HMAC sin estado:
// sobrevive a los reinicios de las funciones de Vercel.
import crypto from 'node:crypto'
import { prisma } from '../../db/client'

const secreto = () => process.env.AUTH_SECRET || 'banco-m-secreto-local'
const DURACION_MS = 8 * 60 * 60 * 1000

export function hashPassword(password: string, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

function passwordCorrecta(password: string, guardado: string) {
  const [salt, hash] = guardado.split(':')
  if (!salt || !hash) return false
  const esperado = Buffer.from(hash, 'hex')
  const actual = crypto.scryptSync(password, salt, esperado.length)
  return crypto.timingSafeEqual(esperado, actual)
}

function firmar(payload: object) {
  const datos = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const firma = crypto.createHmac('sha256', secreto()).update(datos).digest('base64url')
  return `${datos}.${firma}`
}

export function verificarToken(token?: string): { cuit: string; rol: string; exp: number } | null {
  if (!token) return null
  const [datos, firma] = token.split('.')
  if (!datos || !firma) return null
  const esperada = crypto.createHmac('sha256', secreto()).update(datos).digest('base64url')
  if (esperada.length !== firma.length || !crypto.timingSafeEqual(Buffer.from(esperada), Buffer.from(firma))) return null
  const payload = JSON.parse(Buffer.from(datos, 'base64url').toString())
  return payload.exp > Date.now() ? payload : null
}

export async function login(cuit: string, password: string) {
  const usuario = await prisma.usuario.findUnique({ where: { cuit } })
  if (!usuario || !passwordCorrecta(password, usuario.passwordHash)) throw new Error('CUIT o contraseña incorrectos')
  const cuenta = await prisma.cuenta.findUnique({ where: { cuit } })
  const token = firmar({ cuit, rol: usuario.rol, exp: Date.now() + DURACION_MS })
  return { token, usuario: { cuit, nombre: usuario.nombre, rol: usuario.rol }, cuenta }
}
