import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONCEPTOS_MUNICIPALES,
  crearComercio,
  emitirCertificadoLibreDeuda,
  getHealth,
  getTrafficLogs,
  listarComercios,
  obtenerComercioPorCuit,
  obtenerTributosPorCuit,
  registrarPagoTributo,
  resetSeedData,
  setSimulatedLatencyMs,
  validarCuit,
  validarPeriodo,
} from './municipioService';

test('municipioService: validación estricta de CUIT (11 dígitos numéricos sin guiones)', () => {
  assert.equal(validarCuit('30712345678').valido, true);
  assert.equal(validarCuit('30-71234567-8').valido, false);
  assert.equal(validarCuit('3071234567').valido, false);
  assert.equal(validarCuit('307123456789').valido, false);
  assert.equal(validarCuit('3071234567A').valido, false);
});

test('municipioService: validación de períodos municipales YYYY-MM', () => {
  assert.equal(validarPeriodo('2026-07'), true);
  assert.equal(validarPeriodo('2026-09'), true);
  assert.equal(validarPeriodo('2026-13'), false);
  assert.equal(validarPeriodo('09-2026'), false);
});

test('GET /health retorna 200 OK y contrato esperado', async () => {
  setSimulatedLatencyMs(0);
  resetSeedData();

  const res = await getHealth();
  assert.equal(res.status, 200);
  assert.equal(res.data?.status, 'ok');
  assert.equal(res.data?.servicio, 'MUNICIPIO');
});

test('Seed Data inicial incluye 1 comercio sin deuda y 1 comercio con deuda', async () => {
  setSimulatedLatencyMs(0);
  resetSeedData();

  const res = await listarComercios();
  assert.equal(res.status, 200);
  assert.equal(res.data?.length, 2);

  const sinDeuda = res.data?.find((c) => c.cuit === '30712345678');
  const conDeuda = res.data?.find((c) => c.cuit === '30789012345');

  assert.ok(sinDeuda);
  assert.equal(sinDeuda.estado, 'habilitado');
  assert.equal(sinDeuda.deuda_total, 0);
  assert.equal(sinDeuda.periodos_pendientes, 0);

  assert.ok(conDeuda);
  assert.equal(conDeuda.estado, 'habilitado');
  assert.equal(conDeuda.periodos_pendientes, 3);
  assert.ok(conDeuda.deuda_total > 0);
});

test('POST /municipio/comercios crea comercio en 201 Created con 3 períodos pendientes y rechaza duplicado con 409 Conflict', async () => {
  setSimulatedLatencyMs(0);
  resetSeedData();

  const payload = {
    cuit: '30755443322',
    razon_social: 'Panificadora Austral S.A.',
    condicion_fiscal: 'Responsable Inscripto',
    direccion: 'Av. Belgrano 1240',
    rubro_principal: 'Elaboración de Panificados',
    rubro_secundario: 'Cafetería y Confitería',
  };

  const alta = await crearComercio(payload);
  assert.equal(alta.status, 201);
  assert.equal(alta.data?.comercio.estado, 'habilitado');
  assert.equal(alta.data?.tributos_generados.length, 3);

  const periodos = alta.data?.tributos_generados.map((t) => t.periodo);
  assert.deepEqual(periodos, ['2026-07', '2026-08', '2026-09']);

  for (const trib of alta.data!.tributos_generados) {
    assert.equal(trib.estado, 'pendiente');
    const conceptos = trib.desglose.map((d) => d.concepto);
    assert.ok(conceptos.includes(CONCEPTOS_MUNICIPALES.TISH));
    assert.ok(conceptos.includes(CONCEPTOS_MUNICIPALES.VIA_PUBLICA));
  }

  // Intentar registrar el mismo CUIT debe retornar 409 Conflict
  const duplicado = await crearComercio(payload);
  assert.equal(duplicado.status, 409);

  // Obtener comercio por CUIT
  const consulta = await obtenerComercioPorCuit('30755443322');
  assert.equal(consulta.status, 200);
  assert.equal(consulta.data?.razon_social, 'Panificadora Austral S.A.');

  // CUIT inexistente retorna 404 Not Found
  const noExiste = await obtenerComercioPorCuit('30999999999');
  assert.equal(noExiste.status, 404);
});

test('POST /municipio/tributos/pagos procesa pago en 200 OK y rechaza pago duplicado con 409 Conflict', async () => {
  setSimulatedLatencyMs(0);
  resetSeedData();

  const tributosRes = await obtenerTributosPorCuit('30789012345');
  assert.equal(tributosRes.status, 200);
  const periodoJulio = tributosRes.data?.tributos.find((t) => t.periodo === '2026-07');
  assert.ok(periodoJulio);
  assert.equal(periodoJulio.estado, 'pendiente');

  const pagoRes = await registrarPagoTributo({
    cuit: '30789012345',
    periodo: '2026-07',
    monto: periodoJulio.importe,
  });

  assert.equal(pagoRes.status, 200);
  assert.equal(pagoRes.data?.comprobante.estado, 'pagado');
  assert.equal(pagoRes.data?.tributo_actualizado.estado, 'pagado');

  // Reintentar pago del mismo período debe retornar 409 Conflict
  const pagoDuplicado = await registrarPagoTributo({
    cuit: '30789012345',
    periodo: '2026-07',
    monto: periodoJulio.importe,
  });
  assert.equal(pagoDuplicado.status, 409);
});

test('Certificado de Libre Deuda se emite para comercio con $0 deuda (200 OK) y falla con 409 si hay deuda', async () => {
  setSimulatedLatencyMs(0);
  resetSeedData();

  const libreDeudaOk = await emitirCertificadoLibreDeuda('30712345678');
  assert.equal(libreDeudaOk.status, 200);
  assert.equal(libreDeudaOk.data?.deuda_total_ars, 0);
  assert.equal(libreDeudaOk.data?.estado_fiscal, 'LIBRE DE DEUDA');

  const libreDeudaConDeuda = await emitirCertificadoLibreDeuda('30789012345');
  assert.equal(libreDeudaConDeuda.status, 409);

  // Verificar que todas las llamadas hayan sido registradas en el Inspector de Tráfico API
  const logs = getTrafficLogs();
  assert.ok(logs.length >= 2);
});
