import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const EMPRESA_INICIAL_ID =
  process.env.EMPRESA_INICIAL_ID || '00000000-0000-4000-8000-000000000001';
const EMPRESA_INICIAL_NOMBRE = 'Supermercado Central S.A.';
const MODULOS = ['caja', 'productos', 'ventas', 'comercios'];

async function main() {
  console.log('🌱 Inicializando datos de prueba para TPV multiempresa...');

  const empresa = await prisma.empresa.upsert({
    where: { id: EMPRESA_INICIAL_ID },
    update: {},
    create: {
      id: EMPRESA_INICIAL_ID,
      nombre: EMPRESA_INICIAL_NOMBRE,
      estado: 'ACTIVA',
    },
  });

  for (const modulo of MODULOS) {
    await prisma.empresaModulo.upsert({
      where: { empresaId_modulo: { empresaId: empresa.id, modulo } },
      update: {},
      create: { empresaId: empresa.id, modulo, habilitado: true },
    });
  }

  const comercio = await prisma.comercio.upsert({
    where: { cuit: '30712345678' },
    update: {},
    create: {
      empresaId: empresa.id,
      cuit: '30712345678',
      razonSocial: 'Supermercado Central S.A.',
      direccion: 'Av. San Martín 1234, Buenos Aires',
      rubro: 'Supermercado / Almacén',
    },
  });

  console.log(`✅ Empresa inicial: ${empresa.nombre} (${empresa.id})`);
  console.log(`✅ Comercio: ${comercio.razonSocial} (CUIT: ${comercio.cuit})`);

  const productosData = [
    { codigo: 'TPV-CAFE-500', nombre: 'Café Molido 500g', descripcion: 'Café de tueste natural', precio: 4500.0, stock: 50, categoria: 'Almacén' },
    { codigo: 'TPV-LECHE-1L', nombre: 'Leche Entera 1L', descripcion: 'Leche fresca fortificada', precio: 1200.0, stock: 100, categoria: 'Lácteos' },
    { codigo: 'TPV-PAN-LACTAL-500', nombre: 'Pan Lactal Integración 500g', descripcion: 'Pan tajado de mesa', precio: 2300.0, stock: 40, categoria: 'Panadería' },
    { codigo: 'TPV-AGUA-1500', nombre: 'Agua Mineral 1.5L', descripcion: 'Agua sin gas', precio: 950.0, stock: 80, categoria: 'Bebidas' },
    { codigo: 'TPV-QUESO-CREMA-290', nombre: 'Queso Crema 290g', descripcion: 'Queso untable familiar', precio: 3100.0, stock: 35, categoria: 'Lácteos' },
    { codigo: 'TPV-GALLETITAS-DOBLADAS-200', nombre: 'Galletitas Dobladas 200g', descripcion: 'Galletitas dulces surtidas', precio: 1500.0, stock: 60, categoria: 'Almacén' },
  ];

  for (const prod of productosData) {
    // Idempotente dentro de la empresa inicial: no toca productos de otras empresas.
    // Para los registros legados sin código se usa el nombre dentro de la misma empresa.
    const existing = await prisma.producto.findFirst({
      where: {
        empresaId: empresa.id,
        OR: [{ codigo: prod.codigo }, { nombre: prod.nombre }],
      },
    });

    if (existing) {
      console.log(`  ↪ Producto ya presente: ${existing.nombre}`);
      continue;
    }

    const created = await prisma.producto.create({
      data: { ...prod, empresaId: empresa.id },
    });
    console.log(`  📦 Producto cargado: ${created.nombre} - $${created.precio}`);
  }

  console.log('✨ Datos iniciales cargados con éxito.');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
