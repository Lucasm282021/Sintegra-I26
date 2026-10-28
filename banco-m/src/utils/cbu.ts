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
  const timestamp = Date.now().toString().substring(5, 7) // 2 dígitos variables
  const numeroCuenta = (cuitNumerico + timestamp).substring(0, 13).padStart(13, '0')
  const dv2 = calcularDigitoVerificador(numeroCuenta, [3, 9, 7, 1, 3, 9, 7, 1, 3, 9, 7, 1, 3])
  const bloque2 = numeroCuenta + dv2

  return bloque1 + bloque2
}
