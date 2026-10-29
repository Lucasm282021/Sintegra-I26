import * as assert from 'assert/strict';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as http from 'http';
import { PrismaClient } from '@prisma/client';
import { VentasService } from '../src/modules/ventas/ventas.service';
import { IntegracionesService } from '../src/modules/integraciones/integraciones.service';
import { AuditoriaService } from '../src/modules/auditoria/auditoria.service';
import { CreateVentaDto, ItemVentaDto } from '../src/modules/ventas/dto/create-venta.dto';
import {
  PagoIndeterminadoError,
  PagoRechazadoError,
} from '../src/modules/integraciones/pago-errors';

const DB_PATH = '/tmp/opencode/tpv-pago-incierto.db';
const EMPRESA_ID = '00000000-0000-4000-8000-000000000001';
const CUIT = '30712345678';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = `file:${DB_PATH}`;
process.env.VENTA_LOCK_TTL_MS = '30000';

type ModoPago = 'OK' | 'TIMEOUT' | 'SIN_REFERENCIA';

const prisma = new PrismaClient();

class IntegracionesFake {
  modoPago: ModoPago = 'OK';
  pagosLlamados: string[] = [];
  municipioLlamados = 0;
  arbaLlamados = 0;
  arcaLlamados = 0;

  async validarComercioMunicipio(cuit: string) {
    this.municipioLlamados += 1;
    return { cuit, estado: 'activo' };
  }

  async calcularPercepcionArba(params: { cuit: string; montoVenta: number; idVenta: string }) {
    this.arbaLlamados += 1;
    return {
      percepcionId: `ARB-${params.idVenta}`,
      montoPercepcion: 0,
    };
  }

  async procesarPagoBanco(params: { idVenta: string }) {
    this.pagosLlamados.push(params.idVenta);
    if (this.modoPago === 'TIMEOUT') {
      throw new PagoIndeterminadoError('timeout simulado del proveedor de pago');
    }
    if (this.modoPago === 'SIN_REFERENCIA') {
      return { transaccionId: '', estado: 'confirmado' };
    }
    return { transaccionId: `BNC-${params.idVenta}`, estado: 'confirmado' };
  }

  async procesarPagoBilletera(params: { idVenta: string }) {
    return this.procesarPagoBanco(params);
  }

  async emitirFacturaArca(params: { idVenta: string }) {
    this.arcaLlamados += 1;
    return {
      cae: `CAE-${params.idVenta}`,
      numeroComprobante: `FAC-${params.idVenta}`,
      fechaVencimientoCae: '2030-12-31',
      tipoComprobante: 'FACTURA_B',
    };
  }
}

class AuditoriaFake {
  fallarEnConfirmado = false;
  llamadas: any[] = [];

  async registrar(input: any) {
    this.llamadas.push(input);
    if (this.fallarEnConfirmado && input.resultado === 'CONFIRMADO') {
      throw new Error('fallo simulado de auditoría');
    }
  }
}

async function crearVentaIncierta(idVenta: string, medioPago = 'BANCO') {
  return prisma.venta.create({
    data: {
      idVentaExternal: idVenta,
      empresaId: EMPRESA_ID,
      cuit: CUIT,
      medioPago,
      cuentaOrigen: medioPago === 'BANCO' ? '0000000000000000000001' : null,
      cuentaDestino: medioPago === 'BANCO' ? '0000000000000000000002' : null,
      cuitPagador: medioPago === 'BILLETERA' ? '20345678901' : null,
      subtotal: 1000,
      montoTotal: 1000,
      estado: 'PENDIENTE',
      etapaPendiente: 'conciliacion_pago',
      errorDetalle: 'Pago no confirmado; requiere conciliación manual',
    },
  });
}

function crearDto(
  idVenta: string,
  productoId: number,
  cantidad = 1,
  medioPago = 'BANCO',
): CreateVentaDto {
  const dto = new CreateVentaDto();
  dto.id_venta = idVenta;
  dto.comercio_cuit = CUIT;
  dto.medio_pago = medioPago;
  if (medioPago === 'BANCO') {
    dto.cuenta_origen = '0000000000000000000001';
    dto.cuenta_destino = '0000000000000000000002';
  } else {
    dto.cuit_pagador = '20345678901';
  }

  const item = new ItemVentaDto();
  item.producto_id = String(productoId);
  item.cantidad = cantidad;
  dto.items = [item];
  return dto;
}

async function probarClasificacionDelProveedor() {
  let modo: '500' | 'SIN_REFERENCIA' | 'TIMEOUT' | 'RECHAZO' = '500';

  const server = http.createServer((req, res) => {
    req.resume();
    req.on('end', () => {
      if (modo === 'TIMEOUT') {
        // Se deja la respuesta abierta para que axios alcance su timeout.
        return;
      }
      if (modo === '500') {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'fallo simulado del banco' }));
        return;
      }
      if (modo === 'SIN_REFERENCIA') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: { estado: 'confirmado' } }));
        return;
      }
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ errors: [{ message: 'pago rechazado' }] }));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));

  const direccion = server.address();
  assert.ok(direccion && typeof direccion !== 'string');
  process.env.BANCO_URL = `http://127.0.0.1:${direccion.port}`;
  const integraciones = new IntegracionesService();
  const params = {
    cuit: CUIT,
    monto: 100,
    cuentaOrigen: '0000000000000000000001',
    cuentaDestino: '0000000000000000000002',
    idVenta: 'CLASIFICACION-PAGO-1',
  };

  try {
    modo = '500';
    await assert.rejects(
      () => integraciones.procesarPagoBanco(params),
      (error: any) => error instanceof PagoIndeterminadoError,
    );

    modo = 'SIN_REFERENCIA';
    await assert.rejects(
      () => integraciones.procesarPagoBanco(params),
      (error: any) => error instanceof PagoIndeterminadoError,
    );

    modo = 'RECHAZO';
    await assert.rejects(
      () => integraciones.procesarPagoBanco(params),
      (error: any) => error instanceof PagoRechazadoError,
    );

    modo = 'TIMEOUT';
    await assert.rejects(
      () => integraciones.procesarPagoBanco(params),
      (error: any) => error instanceof PagoIndeterminadoError,
    );
    console.log('✅ 5xx, sin referencia, rechazo explícito y timeout se clasifican correctamente');
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

async function main() {
  console.log('🧪 Preparando base aislada para pagos inciertos...');
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    const path = `${DB_PATH}${suffix}`;
    if (fs.existsSync(path)) {
      fs.rmSync(path);
    }
  }

  execSync('npx prisma migrate deploy', { stdio: 'inherit', env: process.env });
  execSync('npx ts-node prisma/seed.ts', { stdio: 'inherit', env: process.env });

  const producto = await prisma.producto.findFirstOrThrow({
    where: { empresaId: EMPRESA_ID, codigo: 'TPV-CAFE-500' },
  });
  const productoAlternativo = await prisma.producto.findFirstOrThrow({
    where: { empresaId: EMPRESA_ID, codigo: 'TPV-LECHE-1L' },
  });

  const integraciones = new IntegracionesFake();
  const usuarioAuditor = await prisma.usuario.create({
    data: {
      email: 'auditor-pago@test.local',
      passwordHash: 'no-usado-en-esta-prueba',
      nombre: 'Auditor de pagos',
      rol: 'ADMIN',
      empresaId: EMPRESA_ID,
      mustChangePassword: false,
    },
  });
  const contextoAuditoria = {
    usuarioId: usuarioAuditor.id,
    empresaId: EMPRESA_ID,
    ip: '127.0.0.1',
    userAgent: 'pago-incierto.e2e',
  };
  const auditoriaService = new AuditoriaService(prisma as any);
  const ventas = new VentasService(
    prisma as any,
    integraciones as any,
    auditoriaService,
  );

  await probarClasificacionDelProveedor();

  // 1. Timeout del pago: la venta queda pendiente de conciliación.
  integraciones.modoPago = 'TIMEOUT';
  const idTimeout = 'VENTA-TIMEOUT-1';
  await assert.rejects(
    () => ventas.create(EMPRESA_ID, crearDto(idTimeout, producto.id)),
    (error: any) => error?.status === 409,
  );

  let ventaTimeout = await prisma.venta.findUniqueOrThrow({
    where: { idVentaExternal: idTimeout },
    include: { items: true },
  });
  assert.equal(ventaTimeout.estado, 'PENDIENTE');
  assert.equal(ventaTimeout.etapaPendiente, 'conciliacion_pago');
  assert.equal(ventaTimeout.bancoTransaccionId, null);
  assert.equal(ventaTimeout.billeteraTransaccionId, null);
  assert.equal(ventaTimeout.lockToken, null);
  assert.equal(ventaTimeout.intentos, 1);
  assert.match(ventaTimeout.errorDetalle || '', /No reintentar automáticamente/i);
  assert.equal(integraciones.pagosLlamados.filter((id) => id === idTimeout).length, 1);
  console.log('✅ Timeout de pago deja la venta en PENDIENTE/conciliacion_pago');

  // 2. Reintento directo: se bloquea y NO vuelve a llamar al proveedor.
  await assert.rejects(
    () => ventas.create(EMPRESA_ID, crearDto(idTimeout, producto.id)),
    (error: any) => error?.status === 409,
  );
  assert.equal(
    integraciones.pagosLlamados.filter((id) => id === idTimeout).length,
    1,
    'El reintento no debe volver a cobrar',
  );
  ventaTimeout = await prisma.venta.findUniqueOrThrow({
    where: { idVentaExternal: idTimeout },
    include: { items: true },
  });
  assert.equal(ventaTimeout.estado, 'PENDIENTE');
  assert.equal(ventaTimeout.items.length, 1);
  console.log('✅ Reintento posterior al timeout no vuelve a cobrar');

  // 3. Conciliación manual confirmada: se persiste la referencia y el
  //    siguiente reintento continúa en ARCA, sin repetir el pago.
  const conciliada = await ventas.conciliarPago(
    EMPRESA_ID,
    idTimeout,
    {
      resultado: 'CONFIRMADO',
      transaccion_id: 'MANUAL-BNC-1',
      observacion:
        'Verificado en portal del banco con cuenta 0000 0000 0000 0001, referencia MANUAL.BNC.1 y otra 1234-5678-9012',
    } as any,
    contextoAuditoria,
  );
  assert.equal(conciliada.estado, 'pendiente');
  assert.equal(conciliada.etapa_pendiente, 'arca');
  assert.equal(conciliada.pago.transaccion_id, 'MANUAL-BNC-1');
  assert.equal(conciliada.requiere_conciliacion, false);
  assert.doesNotMatch(String(conciliada.error_detalle || ''), /Verificado en portal/);
  const observacionConciliada = String(
    conciliada.observacion_conciliacion || '',
  );
  assert.match(observacionConciliada, /Verificado en portal/);
  const segmentosSensibles = [
    '0000',
    '0001',
    'MANUAL',
    'BNC',
    '1234',
    '5678',
    '9012',
  ];
  for (const segmento of segmentosSensibles) {
    assert.doesNotMatch(
      observacionConciliada,
      new RegExp(segmento),
      `La respuesta no debe exponer el segmento ${segmento}`,
    );
  }

  const ventaConciliadaDb = await prisma.venta.findUniqueOrThrow({
    where: { idVentaExternal: idTimeout },
  });
  assert.equal(
    ventaConciliadaDb.observacionConciliacion,
    conciliada.observacion_conciliacion,
  );
  for (const segmento of segmentosSensibles) {
    assert.doesNotMatch(
      String(ventaConciliadaDb.observacionConciliacion || ''),
      new RegExp(segmento),
      `El valor persistido no debe exponer el segmento ${segmento}`,
    );
  }

  const auditoriaConfirmada = await prisma.auditoriaAcceso.findFirstOrThrow({
    where: {
      usuarioId: usuarioAuditor.id,
      accion: 'CONCILIACION_PAGO',
      recursoId: idTimeout,
    },
    orderBy: { id: 'desc' },
  });
  assert.equal(auditoriaConfirmada.resultado, 'CONFIRMADO');
  assert.doesNotMatch(
    JSON.stringify(auditoriaConfirmada),
    /Verificado en portal|0000 0000 0000 0001|MANUAL\.BNC\.1|1234-5678-9012|MANUAL-BNC-1/,
  );

  integraciones.modoPago = 'OK';
  const completadaTrasConciliar = await ventas.create(
    EMPRESA_ID,
    crearDto(idTimeout, producto.id),
  );
  assert.equal(completadaTrasConciliar.estado, 'completada');
  assert.equal(
    integraciones.pagosLlamados.filter((id) => id === idTimeout).length,
    1,
    'La conciliación confirmada no debe repetir el cobro',
  );
  const ventaCompletada = await prisma.venta.findUniqueOrThrow({
    where: { idVentaExternal: idTimeout },
  });
  assert.equal(
    ventaCompletada.observacionConciliacion,
    conciliada.observacion_conciliacion,
    'La observación sanitizada debe persistir al completar el reintento',
  );
  for (const segmento of segmentosSensibles) {
    assert.doesNotMatch(
      String(ventaCompletada.observacionConciliacion || ''),
      new RegExp(segmento),
      `La observación persistida no debe exponer el segmento ${segmento}`,
    );
  }
  console.log('✅ Conciliación confirmada continúa en ARCA sin repetir el cobro y conserva la observación');

  // 4. Respuesta 2xx sin referencia: también es indeterminada.
  integraciones.modoPago = 'SIN_REFERENCIA';
  const idSinRef = 'VENTA-SIN-REF-1';
  await assert.rejects(
    () => ventas.create(EMPRESA_ID, crearDto(idSinRef, producto.id)),
    (error: any) => error?.status === 409,
  );
  const ventaSinRef = await prisma.venta.findUniqueOrThrow({
    where: { idVentaExternal: idSinRef },
  });
  assert.equal(ventaSinRef.estado, 'PENDIENTE');
  assert.equal(ventaSinRef.etapaPendiente, 'conciliacion_pago');
  assert.equal(ventaSinRef.bancoTransaccionId, null);
  console.log('✅ Pago exitoso sin referencia queda pendiente de conciliación');

  // 5. Los tres resultados de conciliación y las reglas del request.
  const idNoCobrado = 'VENTA-CONCILIACION-NO-COBRADO-1';
  await crearVentaIncierta(idNoCobrado);
  for (const transaccion of ['NO-DEBE-ENVIARSE', '   ', '', null]) {
    await assert.rejects(
      () =>
        ventas.conciliarPago(
          EMPRESA_ID,
          idNoCobrado,
          {
            resultado: 'NO_COBRADO',
            transaccion_id: transaccion,
            observacion: 'El proveedor no registra el cobro',
          } as any,
          contextoAuditoria,
        ),
      (error: any) => error?.status === 400,
      `NO_COBRADO debe rechazar transaccion_id=${JSON.stringify(transaccion)}`,
    );
  }
  const auditoriaRechazoRequest = await prisma.auditoriaAcceso.findFirstOrThrow({
    where: { usuarioId: usuarioAuditor.id, recursoId: idNoCobrado },
    orderBy: { id: 'desc' },
  });
  assert.equal(auditoriaRechazoRequest.resultado, 'FALLIDO');

  const noCobrada = await ventas.conciliarPago(
    EMPRESA_ID,
    idNoCobrado,
    {
      resultado: 'NO_COBRADO',
      observacion: 'El proveedor no registra el cobro',
    } as any,
    contextoAuditoria,
  );
  assert.equal(noCobrada.estado, 'pendiente');
  assert.equal(noCobrada.etapa_pendiente, 'pago');
  assert.equal(noCobrada.pago.transaccion_id, null);
  assert.equal(noCobrada.requiere_conciliacion, false);
  assert.equal(
    noCobrada.observacion_conciliacion,
    'El proveedor no registra el cobro',
  );

  const idRechazado = 'VENTA-CONCILIACION-RECHAZADO-1';
  await crearVentaIncierta(idRechazado);
  await assert.rejects(
    () =>
      ventas.conciliarPago(
        EMPRESA_ID,
        idRechazado,
        {
          resultado: 'RECHAZADO',
          transaccion_id: '   ',
          observacion: 'El proveedor confirmó el rechazo de la operación',
        } as any,
        contextoAuditoria,
      ),
    (error: any) => error?.status === 400,
  );
  const rechazada = await ventas.conciliarPago(
    EMPRESA_ID,
    idRechazado,
    {
      resultado: 'RECHAZADO',
      observacion: 'El proveedor confirmó el rechazo de la operación',
    } as any,
    contextoAuditoria,
  );
  assert.equal(rechazada.estado, 'error_recuperable');
  assert.equal(rechazada.etapa_pendiente, 'pago');
  assert.equal(rechazada.pago.transaccion_id, null);
  assert.equal(rechazada.requiere_conciliacion, false);
  console.log('✅ NO_COBRADO y RECHAZADO aplican los estados y etapas esperados');

  // 6. BILLETERA usa su propia referencia y la observación no se persiste cruda.
  const idBilletera = 'VENTA-CONCILIACION-BILLETERA-1';
  await crearVentaIncierta(idBilletera, 'BILLETERA');
  for (const transaccion of ['   ', '', null]) {
    await assert.rejects(
      () =>
        ventas.conciliarPago(
          EMPRESA_ID,
          idBilletera,
          {
            resultado: 'CONFIRMADO',
            transaccion_id: transaccion,
            observacion: 'Verificado en la billetera',
          } as any,
          contextoAuditoria,
        ),
      (error: any) => error?.status === 400,
      `CONFIRMADO debe rechazar transaccion_id=${JSON.stringify(transaccion)}`,
    );
  }
  const conciliadaBilletera = await ventas.conciliarPago(
    EMPRESA_ID,
    idBilletera,
    {
      resultado: 'CONFIRMADO',
      transaccion_id: 'MANUAL-BIL-1',
      observacion: 'Verificado en la billetera',
    } as any,
    contextoAuditoria,
  );
  assert.equal(conciliadaBilletera.estado, 'pendiente');
  assert.equal(conciliadaBilletera.etapa_pendiente, 'arca');
  assert.equal(conciliadaBilletera.pago.transaccion_id, 'MANUAL-BIL-1');
  const ventaBilletera = await prisma.venta.findUniqueOrThrow({
    where: { idVentaExternal: idBilletera },
  });
  assert.equal(ventaBilletera.billeteraTransaccionId, 'MANUAL-BIL-1');
  assert.equal(ventaBilletera.bancoTransaccionId, null);

  // 7. Observación obligatoria y máximo de 500 caracteres.
  const idObservacion = 'VENTA-CONCILIACION-OBSERVACION-1';
  await crearVentaIncierta(idObservacion);
  await assert.rejects(
    () =>
      ventas.conciliarPago(
        EMPRESA_ID,
        idObservacion,
        { resultado: 'NO_COBRADO', observacion: '   ' } as any,
        contextoAuditoria,
      ),
    (error: any) => error?.status === 400,
  );
  await assert.rejects(
    () =>
      ventas.conciliarPago(
        EMPRESA_ID,
        idObservacion,
        { resultado: 'NO_COBRADO', observacion: 'x'.repeat(501) } as any,
        contextoAuditoria,
      ),
    (error: any) => error?.status === 400,
  );

  // 8. Solo se concilian ventas BANCO/BILLETERA.
  const idEfectivo = 'VENTA-CONCILIACION-EFECTIVO-1';
  await crearVentaIncierta(idEfectivo, 'EFECTIVO');
  await assert.rejects(
    () =>
      ventas.conciliarPago(
        EMPRESA_ID,
        idEfectivo,
        { resultado: 'NO_COBRADO', observacion: 'No aplica' } as any,
        contextoAuditoria,
      ),
    (error: any) => error?.status === 400,
  );
  console.log('✅ Reglas de observación, transacción y medio de pago verificadas');

  // 9. Atomicidad: si falla la auditoría, no se modifica la venta.
  const idAtomicidad = 'VENTA-CONCILIACION-ATOMICA-1';
  await crearVentaIncierta(idAtomicidad);
  const auditoriaFake = new AuditoriaFake();
  auditoriaFake.fallarEnConfirmado = true;
  const ventasConAuditoriaFallida = new VentasService(
    prisma as any,
    integraciones as any,
    auditoriaFake as any,
  );
  await assert.rejects(
    () =>
      ventasConAuditoriaFallida.conciliarPago(
        EMPRESA_ID,
        idAtomicidad,
        {
          resultado: 'CONFIRMADO',
          transaccion_id: 'NO-DEBE-PERSISTIR',
          observacion: 'Prueba de atomicidad',
        } as any,
        contextoAuditoria,
      ),
    /fallo simulado de auditoría/,
  );
  const ventaAtomica = await prisma.venta.findUniqueOrThrow({
    where: { idVentaExternal: idAtomicidad },
  });
  assert.equal(ventaAtomica.estado, 'PENDIENTE');
  assert.equal(ventaAtomica.etapaPendiente, 'conciliacion_pago');
  assert.equal(ventaAtomica.bancoTransaccionId, null);
  assert.equal(ventaAtomica.lockToken, null);
  assert.equal(auditoriaFake.llamadas[0].resultado, 'CONFIRMADO');
  assert.equal(auditoriaFake.llamadas[1].resultado, 'FALLIDO');
  console.log('✅ Auditoría exitosa y cambio de venta son atómicos');

  // 10. Reintento después de una etapa completada: no recalcula importes ni
  //    cambia líneas, y no vuelve a ejecutar etapas ya terminadas.
  integraciones.modoPago = 'OK';
  const idCompletada = 'VENTA-COMPLETADA-1';
  const completada = await ventas.create(
    EMPRESA_ID,
    crearDto(idCompletada, producto.id, 1),
  );
  assert.equal(completada.estado, 'completada');

  const ventaAntes = await prisma.venta.findUniqueOrThrow({
    where: { idVentaExternal: idCompletada },
    include: { items: true },
  });
  const stockAntes = (await prisma.producto.findUniqueOrThrow({ where: { id: producto.id } }))
    .stock;
  const llamadasAntes = {
    pagos: integraciones.pagosLlamados.length,
    municipio: integraciones.municipioLlamados,
    arba: integraciones.arbaLlamados,
    arca: integraciones.arcaLlamados,
  };

  // El request repetido trae otro producto y cantidad; debe ignorarse.
  const reintento = await ventas.create(
    EMPRESA_ID,
    crearDto(idCompletada, productoAlternativo.id, 5),
  );
  assert.equal(reintento.estado, 'completada');
  assert.equal(reintento.lineas.length, 1);
  assert.equal(reintento.lineas[0].producto_id, producto.codigo);
  assert.equal(reintento.lineas[0].cantidad, 1);
  assert.equal(reintento.subtotal, ventaAntes.subtotal);
  assert.equal(reintento.total, ventaAntes.montoTotal);

  const ventaDespues = await prisma.venta.findUniqueOrThrow({
    where: { idVentaExternal: idCompletada },
    include: { items: true },
  });
  const stockDespues = (await prisma.producto.findUniqueOrThrow({ where: { id: producto.id } }))
    .stock;
  assert.equal(ventaDespues.items.length, 1);
  assert.equal(ventaDespues.items[0].productoId, producto.id);
  assert.equal(ventaDespues.items[0].cantidad, 1);
  assert.equal(ventaDespues.subtotal, ventaAntes.subtotal);
  assert.equal(ventaDespues.montoTotal, ventaAntes.montoTotal);
  assert.equal(stockDespues, stockAntes, 'No debe descontarse stock dos veces');
  assert.deepEqual(
    {
      pagos: integraciones.pagosLlamados.length,
      municipio: integraciones.municipioLlamados,
      arba: integraciones.arbaLlamados,
      arca: integraciones.arcaLlamados,
    },
    llamadasAntes,
    'No debe repetir etapas ya completadas',
  );
  console.log('✅ Reintento de venta completada usa datos persistidos y no repite etapas');

  console.log('\n🎉 Pruebas de pagos inciertos y reintentos completadas.');
}

main()
  .catch(async (error) => {
    console.error('❌ Falló la prueba de pagos inciertos:', error);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
