const http = require('http');
const app = require('./src/index.js');

const PORT = 3099; // Puerto aislado para ejecución de pruebas
const server = app.listen(PORT, async () => {
  console.log(`[Tests ARBA] Servidor de prueba levantado en puerto ${PORT}`);

  function request(path, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
      const dataStr = body ? JSON.stringify(body) : null;
      const req = http.request(
        {
          hostname: 'localhost',
          port: PORT,
          path,
          method,
          headers: {
            'Content-Type': 'application/json',
            ...(dataStr ? { 'Content-Length': Buffer.byteLength(dataStr) } : {}),
          },
        },
        (res) => {
          let raw = '';
          res.on('data', (chunk) => (raw += chunk));
          res.on('end', () => {
            try {
              resolve({ status: res.statusCode, data: JSON.parse(raw) });
            } catch (e) {
              resolve({ status: res.statusCode, raw });
            }
          });
        }
      );
      req.on('error', reject);
      if (dataStr) req.write(dataStr);
      req.end();
    });
  }

  let failures = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  ✓ ${testName}`);
    } else {
      console.error(`  ✗ FALLÓ: ${testName}`);
      failures++;
    }
  }

  try {
    console.log('\n--- Ejecutando pruebas del módulo ARBA ---');

    // 1. Healthcheck
    const r1 = await request('/health');
    assert(r1.status === 200 && r1.data.status === 'ok', 'GET /health devuelve 200 {status: "ok"}');

    // 2. Padrón existente
    const r2 = await request('/arba/padron/30712345678');
    assert(
      r2.status === 200 &&
        r2.data.cuit === '30712345678' &&
        r2.data.alicuota === 0.03 &&
        r2.data.actividad === 'Comercio minorista',
      'GET /arba/padron/:cuit existente devuelve 200 y datos fiscales simulados'
    );

    // 3. Padrón CUIT no registrado
    const r3 = await request('/arba/padron/99999999999');
    assert(r3.status === 404 && r3.data.error, 'GET /arba/padron/:cuit no existente devuelve 404');

    // 4. Padrón CUIT con formato inválido
    const r4 = await request('/arba/padron/123');
    assert(r4.status === 400 && r4.data.error, 'GET /arba/padron/:cuit inválido devuelve 400');

    // 5. Padrón paginado
    const r5 = await request('/arba/padron?page=1&limit=2');
    assert(
      r5.status === 200 && r5.data.page === 1 && r5.data.limit === 2 && Array.isArray(r5.data.items) && r5.data.items.length === 2,
      'GET /arba/padron?page=1&limit=2 devuelve listado paginado'
    );

    // 6. POST percepción nueva (201)
    const testIdVenta = `venta-test-${Date.now()}`;
    const r6 = await request('/arba/percepciones', 'POST', {
      id_venta: testIdVenta,
      cuit: '30712345678',
      monto_venta: 10200.0,
    });
    assert(
      r6.status === 201 &&
        r6.data.id &&
        r6.data.id_venta === testIdVenta &&
        r6.data.monto_percepcion === 306.0 &&
        r6.data.alicuota_aplicada === 0.03,
      'POST /arba/percepciones registra percepción nueva con 201 Created'
    );

    // 7. POST percepción reintento idéntico (200 - Idempotencia)
    const r7 = await request('/arba/percepciones', 'POST', {
      id_venta: testIdVenta,
      cuit: '30712345678',
      monto_venta: 10200.0,
    });
    assert(
      r7.status === 200 && r7.data.id === r6.data.id,
      'POST /arba/percepciones repetido con id_venta idéntico devuelve 200 sin duplicar'
    );

    // 8. POST percepción mismo id_venta con monto diferente (409 Conflicto)
    const r8 = await request('/arba/percepciones', 'POST', {
      id_venta: testIdVenta,
      cuit: '30712345678',
      monto_venta: 99999.0,
    });
    assert(
      r8.status === 409 && r8.data.error,
      'POST /arba/percepciones con mismo id_venta y monto diferente devuelve 409 Conflict'
    );

    // 9. POST percepción con CUIT que no está en el padrón (404)
    const r9 = await request('/arba/percepciones', 'POST', {
      id_venta: `venta-otro-${Date.now()}`,
      cuit: '99999999999',
      monto_venta: 5000.0,
    });
    assert(r9.status === 404 && r9.data.error, 'POST /arba/percepciones con CUIT inexistente devuelve 404');

    // 10. POST percepción con datos inválidos (400)
    const r10 = await request('/arba/percepciones', 'POST', {
      id_venta: 'venta-inv',
      cuit: 'invalido',
      monto_venta: -100,
    });
    assert(r10.status === 400 && r10.data.error, 'POST /arba/percepciones con payload inválido devuelve 400');

    console.log('\n--- Resumen de pruebas ---');
    if (failures === 0) {
      console.log('✓ 10/10 pruebas pasaron exitosamente.\n');
    } else {
      console.error(`✗ ${failures} pruebas fallaron.\n`);
    }
  } catch (error) {
    console.error('Error fatal durante la prueba:', error);
    failures++;
  } finally {
    server.close();
    process.exit(failures > 0 ? 1 : 0);
  }
});
