import { prisma } from '../../db/client'
import { generarCBU } from '../../utils/cbu'
import { generarAlias } from '../../utils/alias'
import type { CrearComercioDTO } from './comercios.schema'

export async function crearComercio(data: CrearComercioDTO) {
  return prisma.$transaction(async (tx) => {
    const existe = await tx.comercio.findUnique({ where: { cuit: data.cuit } })
    if (existe) throw new Error('Ya existe un comercio con ese CUIT')

    let cuenta = await tx.cuenta.findUnique({ where: { cuit: data.cuit } })
    if (!cuenta) {
      cuenta = await tx.cuenta.create({
        data: {
          cuit: data.cuit,
          cbu: generarCBU(data.cuit),
          alias: generarAlias(data.cuit),
          titularNombre: data.razonSocial,
          saldo: 0,
        },
      })
    }

    return tx.comercio.create({
      data: {
        cuit: data.cuit,
        razonSocial: data.razonSocial,
        rubro: data.rubro,
        cuentaId: cuenta.id,
      },
      include: { cuenta: true },
    })
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
