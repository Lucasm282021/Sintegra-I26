const http = require('http');
// Las pruebas usan almacenamiento en memoria para no modificar data/db.json
process.env.DB_PATH = ':memory:';
const app = require('./src/index.js');

const PORT = 3099; // Puerto aislado para ejecución de pruebas
const server = app.listen(PORT, async () => {
  console.log(`[Tests ARBA] Servidor de prueba levantado en puerto ${PORT}`);

  function request(path, method = 'GET', body = null, extraHeaders = {}) {
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
            ...extraHeaders,
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
  let total = 0;

  function assert(condition, testName) {
    total++;
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

    console.log('\n--- Contrato unificado /api/v1/arba ---');

    // 11. Consulta de inscripción v1 con tasa versionada
    const r11 = await request('/api/v1/arba/padron/30712345678');
    assert(
      r11.status === 200 &&
        r11.data.data.rate === 0.03 &&
        r11.data.data.jurisdiccion === 'PBA' &&
        typeof r11.data.data.valid_from === 'string' &&
        r11.data.data.source,
      'GET /api/v1/arba/padron/:cuit devuelve { data } con rate, jurisdicción y vigencia'
    );

    // 12. Percepción v1 en centavos con Idempotency-Key
    const saleId = `VENTA-V1-${Date.now()}`;
    const v1Body = { cuit: '30712345678', base_amount_minor: 1020000, currency: 'ARS' };
    const r12 = await request('/api/v1/arba/percepciones', 'POST', v1Body, { 'Idempotency-Key': saleId });
    assert(
      r12.status === 201 &&
        r12.data.data.sale_id === saleId &&
        r12.data.data.tax_amount_minor === 30600 &&
        r12.data.data.base_amount_minor === 1020000 &&
        r12.data.data.status === 'calculated' &&
        r12.data.data.idempotent_replay === false,
      'POST /api/v1/arba/percepciones calcula en centavos (1020000 → 30600) con 201'
    );

    // 13. Reintento v1 idéntico usando sale_id en el body
    const r13 = await request('/api/v1/arba/percepciones', 'POST', { ...v1Body, sale_id: saleId });
    assert(
      r13.status === 200 && r13.data.data.idempotent_replay === true && r13.data.data.perception_id === r12.data.data.perception_id,
      'POST /api/v1/arba/percepciones reintento idéntico devuelve 200 sin duplicar'
    );

    // 14. Conflicto v1 con distinto importe
    const r14 = await request('/api/v1/arba/percepciones', 'POST', { ...v1Body, sale_id: saleId, base_amount_minor: 999 });
    assert(r14.status === 409 && r14.data.error, 'POST /api/v1/arba/percepciones mismo sale_id con otro importe devuelve 409');

    // 15. Compatibilidad cruzada: una venta legada es visible e idempotente en v1
    const r15 = await request('/api/v1/arba/percepciones', 'POST', {
      sale_id: testIdVenta,
      cuit: '30712345678',
      base_amount_minor: 1020000,
    });
    assert(r15.status === 200 && r15.data.data.sale_id === testIdVenta, 'id_venta legado y sale_id v1 comparten la misma idempotencia');

    // 16. Validaciones v1
    const r16 = await request('/api/v1/arba/percepciones', 'POST', { sale_id: 'x', cuit: '30712345678', base_amount_minor: 10.5 });
    const r16b = await request('/api/v1/arba/percepciones', 'POST', { sale_id: 'a', id_venta: 'b', cuit: '30712345678', monto_venta: 10 });
    assert(r16.status === 400 && r16b.status === 400, 'v1 rechaza importes no enteros y sale_id/id_venta contradictorios (400)');

    // 17. Historial por CUIT
    const r17 = await request('/arba/percepciones/30712345678');
    assert(r17.status === 200 && r17.data.total >= 2, 'GET /arba/percepciones/:cuit devuelve el historial del contribuyente');

    console.log('\n--- Autenticación y Usuarios (/auth) ---');

    // 18. Login exitoso con usuario semilla
    const r18 = await request('/auth/login', 'POST', {
      email: 'admin@arba.demo',
      password: 'admin123',
    });
    assert(
      r18.status === 200 && r18.data.user?.rol === 'admin' && typeof r18.data.token === 'string',
      'POST /auth/login con credenciales válidas devuelve 200, usuario y token'
    );

    // 19. Login fallido por contraseña incorrecta
    const r19 = await request('/auth/login', 'POST', {
      email: 'admin@arba.demo',
      password: 'clave-incorrecta',
    });
    assert(r19.status === 401 && r19.data.error, 'POST /auth/login con clave incorrecta devuelve 401 Unauthorized');

    // 20. Registro de nuevo usuario con rol
    const testEmail = `nuevo-${Date.now()}@arba.demo`;
    const r20 = await request('/auth/register', 'POST', {
      nombre: 'Profesor Evaluador',
      email: testEmail,
      password: 'password123',
      rol: 'admin',
    });
    assert(
      r20.status === 201 &&
        r20.data.user?.email === testEmail &&
        r20.data.user?.rol === 'admin' &&
        typeof r20.data.token === 'string',
      'POST /auth/register crea nuevo usuario con 201 y token'
    );

    // 21. Registro duplicado
    const r21 = await request('/auth/register', 'POST', {
      nombre: 'Intento Duplicado',
      email: testEmail,
      password: 'password123',
      rol: 'operador',
    });
    assert(r21.status === 409 && r21.data.error, 'POST /auth/register con email ya existente devuelve 409 Conflict');

    // 22. Perfil autenticado GET /auth/me
    const r22 = await request('/auth/me', 'GET', null, { Authorization: `Bearer ${r20.data.token}` });
    assert(
      r22.status === 200 && r22.data.user?.email === testEmail,
      'GET /auth/me con Bearer token devuelve los datos del usuario autenticado'
    );

    console.log('\n--- Resumen de pruebas ---');
    if (failures === 0) {
      console.log(`✓ ${total}/${total} pruebas pasaron exitosamente.\n`);
    } else {
      console.error(`✗ ${failures}/${total} pruebas fallaron.\n`);
    }
  } catch (error) {
    console.error('Error fatal durante la prueba:', error);
    failures++;
  } finally {
    server.close();
    process.exit(failures > 0 ? 1 : 0);
  }
});
