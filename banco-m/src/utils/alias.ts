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
