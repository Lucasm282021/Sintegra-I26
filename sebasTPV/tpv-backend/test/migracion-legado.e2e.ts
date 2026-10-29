import * as assert from 'assert/strict';
import { execSync } from 'child_process';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

const ORIGEN = path.resolve('prisma/dev.db');
const DB_PATH = '/tmp/opencode/tpv-migracion-legado.db';
const CUIT = '30712345678';
const EMPRESA_ID = '00000000-0000-4000-8000-000000000001';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = `file:${DB_PATH}`;

function hashArchivo(filePath: string) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function limpiarTemporales() {
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    const filePath = `${DB_PATH}${suffix}`;
    if (fs.existsSync(filePath)) {
      fs.rmSync(filePath);
    }
  }
}

function dbExecute(sql: string) {
  execSync('npx prisma db execute --stdin', {
    input: sql,
    stdio: ['pipe', 'inherit', 'inherit'],
    env: { ...process.env, DATABASE_URL: `file:${DB_PATH}` },
  });
}

async function main() {
  console.log('🧪 Preparando copia aislada de una base legada...');
  assert.ok(fs.existsSync(ORIGEN), `No existe la base de origen: ${ORIGEN}`);
  const hashInicial = hashArchivo(ORIGEN);

  limpiarTemporales();
  fs.copyFileSync(ORIGEN, DB_PATH);

  dbExecute('DROP TABLE IF EXISTS "_prisma_migrations";');

  const filas = [
    {
      id: 'LEGACY-AMBIGUO-PERCIBIDO',
      estado: 'PERCIBIDO_ARBA',
      arba: 'ARB-PERCIBIDO',
      banco: null,
      billetera: null,
      cae: null,
    },
    {
      id: 'LEGACY-ERROR-SIN-ARBA',
      estado: 'ERROR_RECUPERABLE',
      arba: null,
      banco: null,
      billetera: null,
      cae: null,
    },
    {
      id: 'LEGACY-ERROR-CON-ARBA',
      estado: 'ERROR_RECUPERABLE',
      arba: 'ARB-ERROR',
      banco: null,
      billetera: null,
      cae: null,
    },
    {
      id: 'LEGACY-COBRADO-SIN-REF',
      estado: 'COBRADO',
      arba: 'ARB-COBRADO',
      banco: null,
      billetera: null,
      cae: null,
    },
    {
      id: 'LEGACY-ERROR-CON-PAGO',
      estado: 'ERROR_RECUPERABLE',
      arba: 'ARB-PAGO',
      banco: 'BNC-PAGO',
      billetera: null,
      cae: null,
    },
    {
      id: 'LEGACY-FACTURADO-COMPLETO',
      estado: 'FACTURADO_ARCA',
      arba: 'ARB-FACT',
      banco: 'BNC-FACT',
      billetera: null,
      cae: 'CAE-FACT',
    },
    {
      id: 'LEGACY-FACTURADO-SIN-REF',
      estado: 'FACTURADO_ARCA',
      arba: 'ARB-FACT-SIN-REF',
      banco: null,
      billetera: null,
      cae: 'CAE-FACT-SIN-REF',
    },
    {
      id: 'LEGACY-DESCONOCIDO',
      estado: 'ESTADO_RARO',
      arba: null,
      banco: null,
      billetera: null,
      cae: null,
    },
    {
      id: 'LEGACY-BORRADOR',
      estado: 'BORRADOR',
      arba: null,
      banco: null,
      billetera: null,
      cae: null,
    },
    {
      id: 'LEGACY-VALIDADO',
      estado: 'VALIDADO_MUNICIPIO',
      arba: null,
      banco: null,
      billetera: null,
      cae: null,
    },
  ];

  const valores = filas
    .map((fila) => {
      const sqlString = (value: string | null) =>
        value === null ? 'NULL' : `'${value.replace(/'/g, "''")}'`;
      return `(
        ${sqlString(fila.id)}, ${sqlString(CUIT)}, 'BANCO', 100, 0, 100,
        ${sqlString(fila.estado)}, ${sqlString(fila.arba)}, ${sqlString(fila.banco)},
        ${sqlString(fila.billetera)}, ${sqlString(fila.cae)}, CURRENT_TIMESTAMP
      )`;
    })
    .join(',\n');

  dbExecute(`
    INSERT INTO "Venta" (
      "idVentaExternal", "cuit", "medioPago", "subtotal", "percepcionArba",
      "montoTotal", "estado", "arbaPercepcionId", "bancoTransaccionId",
      "billeteraTransaccionId", "cae", "updatedAt"
    ) VALUES ${valores};
  `);

  // La base legada no tiene historial de Prisma: se marca la migración inicial
  // como aplicada y luego se ejecuta únicamente la migración multiempresa.
  execSync('npx prisma migrate resolve --applied 20261020120000_init', {
    stdio: 'inherit',
    env: process.env,
  });
  execSync('npx prisma migrate deploy', { stdio: 'inherit', env: process.env });

  const prisma = new PrismaClient();
  try {
    const ventas = await prisma.venta.findMany({
      where: { idVentaExternal: { startsWith: 'LEGACY-' } },
    });
    const porId = new Map(
      ventas
        .filter((venta) => venta.idVentaExternal)
        .map((venta) => [venta.idVentaExternal as string, venta]),
    );

    const esperado = new Map<
      string,
      { estado: string; etapa: string | null; empresaId?: string }
    >([
      [
        'LEGACY-AMBIGUO-PERCIBIDO',
        { estado: 'PENDIENTE', etapa: 'conciliacion_pago' },
      ],
      [
        'LEGACY-ERROR-SIN-ARBA',
        { estado: 'ERROR_RECUPERABLE', etapa: 'arba' },
      ],
      [
        'LEGACY-ERROR-CON-ARBA',
        { estado: 'PENDIENTE', etapa: 'conciliacion_pago' },
      ],
      [
        'LEGACY-COBRADO-SIN-REF',
        { estado: 'PENDIENTE', etapa: 'conciliacion_pago' },
      ],
      ['LEGACY-ERROR-CON-PAGO', { estado: 'PENDIENTE', etapa: 'arca' }],
      [
        'LEGACY-FACTURADO-COMPLETO',
        { estado: 'COMPLETADA', etapa: null },
      ],
      [
        'LEGACY-FACTURADO-SIN-REF',
        { estado: 'PENDIENTE', etapa: 'conciliacion_pago' },
      ],
      [
        'LEGACY-DESCONOCIDO',
        { estado: 'PENDIENTE', etapa: 'conciliacion_pago' },
      ],
      ['LEGACY-BORRADOR', { estado: 'PENDIENTE', etapa: 'municipio' }],
      ['LEGACY-VALIDADO', { estado: 'PENDIENTE', etapa: 'arba' }],
    ]);

    for (const [idVenta, valoresEsperados] of esperado) {
      const venta = porId.get(idVenta);
      assert.ok(venta, `No se migró la venta ${idVenta}`);
      assert.equal(venta.estado, valoresEsperados.estado, `${idVenta} estado`);
      assert.equal(venta.etapaPendiente, valoresEsperados.etapa, `${idVenta} etapa`);
      assert.equal(venta.empresaId, EMPRESA_ID, `${idVenta} empresa`);
      if (valoresEsperados.etapa === 'conciliacion_pago') {
        assert.match(
          venta.errorDetalle || '',
          /conciliación manual/i,
          `${idVenta} debe explicar la conciliación manual`,
        );
      }
    }

    // Ninguna venta ambigua puede quedar apuntando a una etapa que reintente
    // el pago automáticamente.
    for (const idVenta of [
      'LEGACY-AMBIGUO-PERCIBIDO',
      'LEGACY-ERROR-CON-ARBA',
      'LEGACY-COBRADO-SIN-REF',
      'LEGACY-FACTURADO-SIN-REF',
      'LEGACY-DESCONOCIDO',
    ]) {
      const venta = porId.get(idVenta)!;
      assert.notEqual(venta.etapaPendiente, 'pago');
      assert.notEqual(venta.etapaPendiente, 'pago_en_curso');
      assert.equal(venta.estado, 'PENDIENTE');
    }

    const columnasAuditoria = await prisma.$queryRawUnsafe<
      Array<{ name: string }>
    >('PRAGMA table_info("AuditoriaAcceso")');
    assert.ok(
      columnasAuditoria.some((columna) => columna.name === 'resultado'),
      'AuditoriaAcceso debe tener la columna resultado',
    );
    assert.ok(
      columnasAuditoria.some((columna) => columna.name === 'detalle'),
      'AuditoriaAcceso debe tener la columna detalle',
    );

    const columnasVenta = await prisma.$queryRawUnsafe<
      Array<{ name: string }>
    >('PRAGMA table_info("Venta")');
    assert.ok(
      columnasVenta.some(
        (columna) => columna.name === 'observacionConciliacion',
      ),
      'Venta debe tener la columna observacionConciliacion',
    );
    assert.ok(
      ventas.every((venta) => venta.observacionConciliacion === null),
      'Las ventas legadas deben conservar observacionConciliacion en null',
    );

    console.log('✅ Migración legada: ambiguas bloqueadas y filas seguras conservadas');
    console.log(`✅ Filas legadas verificadas: ${ventas.length}`);
  } finally {
    await prisma.$disconnect();
  }

  const hashFinal = hashArchivo(ORIGEN);
  assert.equal(hashFinal, hashInicial, 'La base original no debe cambiar');
  console.log(`✅ Base original intacta (SHA-256 ${hashFinal.slice(0, 16)}…)`);

  limpiarTemporales();
  console.log('\n🎉 Prueba de migración legada completada.');
}

main().catch(async (error) => {
  console.error('❌ Falló la prueba de migración legada:', error);
  process.exit(1);
});
