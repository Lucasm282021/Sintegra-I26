import * as assert from 'assert/strict';
import { execSync } from 'child_process';
import * as fs from 'fs';
import axios, { AxiosRequestConfig } from 'axios';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const DB_PATH = '/tmp/opencode/tpv-e2e.db';
const PORT = 3011;
const BASE_URL = `http://127.0.0.1:${PORT}`;

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = `file:${DB_PATH}`;
process.env.JWT_SECRET = 'test-secret-etapa1-no-usar-en-produccion';
process.env.MUNICIPIO_MOCK = 'true';
process.env.BANCO_MOCK = 'true';
process.env.BILLETERA_MOCK = 'true';
process.env.ARBA_MOCK = 'true';
process.env.ARCA_MOCK = 'true';
// Mantiene el lock de la primera solicitud el tiempo suficiente para que la
// segunda llegue mientras la venta todavía se está procesando.
process.env.MUNICIPIO_MOCK_DELAY_MS = '500';

const prisma = new PrismaClient();

function api(method: string, url: string, data?: any, token?: string) {
  const config: AxiosRequestConfig = {
    method,
    url,
    baseURL: BASE_URL,
    data,
    validateStatus: () => true,
  };
  if (token) {
    config.headers = { Authorization: `Bearer ${token}` };
  }
  return axios.request(config);
}

async function login(email: string, password: string) {
  return api('POST', '/auth/login', { email, password });
}

async function main() {
  console.log('🧪 Preparando base aislada de prueba...');
  if (fs.existsSync(DB_PATH)) {
    fs.rmSync(DB_PATH);
  }

  execSync('npx prisma migrate deploy', { stdio: 'inherit', env: process.env });
  execSync('npx ts-node prisma/seed.ts', { stdio: 'inherit', env: process.env });
  execSync('npx ts-node prisma/bootstrap-superadmin.ts', {
    stdio: 'inherit',
    env: {
      ...process.env,
      SUPERADMIN_EMAIL: 'root@tpv.local',
      SUPERADMIN_PASSWORD: 'RootTemporal123!',
      SUPERADMIN_NOMBRE: 'Root TPV',
    },
  });

  const { AppModule } = await import('../src/app.module');
  const { HttpExceptionFilter } = await import('../src/common/filters/http-exception.filter');

  const app = await NestFactory.create(AppModule, { logger: false });
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(PORT, '127.0.0.1');

  try {
    // 1. Health público
    const health = await api('GET', '/health');
    assert.equal(health.status, 200);
    assert.equal(health.data.status, 'ok');
    console.log('✅ /health público');

    // 2. Ruta protegida sin token
    const sinToken = await api('GET', '/tpv/productos');
    assert.equal(sinToken.status, 401);
    console.log('✅ Ruta de empresa sin token devuelve 401');

    // 3. Superadmin con contraseña temporal: debe cambiarla
    const rootLogin = await login('root@tpv.local', 'RootTemporal123!');
    assert.equal(rootLogin.status, 201);
    const rootTempToken = rootLogin.data.access_token;
    const rootBlocked = await api('GET', '/admin/empresas', undefined, rootTempToken);
    assert.equal(rootBlocked.status, 403);
    assert.match(rootBlocked.data.error, /contraseña temporal/i);
    console.log('✅ Superadmin con contraseña temporal queda bloqueado hasta cambiarla');

    const rootChange = await api(
      'POST',
      '/auth/change-password',
      { current_password: 'RootTemporal123!', new_password: 'RootNueva123!' },
      rootTempToken,
    );
    assert.equal(rootChange.status, 201);

    const rootLogin2 = await login('root@tpv.local', 'RootNueva123!');
    assert.equal(rootLogin2.status, 201);
    const rootToken = rootLogin2.data.access_token;
    console.log('✅ Cambio de contraseña y nuevo login del superadmin');

    // 4. Crear dos empresas
    const empresaA = await api(
      'POST',
      '/admin/empresas',
      {
        nombre: 'Empresa A',
        cuit: '30700000001',
        razon_social: 'Empresa A S.A.',
        admin_email: 'admin-a@test.local',
        admin_password: 'AdminATemporal1!',
        admin_nombre: 'Admin A',
      },
      rootToken,
    );
    assert.equal(empresaA.status, 201, JSON.stringify(empresaA.data));

    const empresaB = await api(
      'POST',
      '/admin/empresas',
      {
        nombre: 'Empresa B',
        cuit: '30700000002',
        razon_social: 'Empresa B S.A.',
        admin_email: 'admin-b@test.local',
        admin_password: 'AdminBTemporal1!',
        admin_nombre: 'Admin B',
      },
      rootToken,
    );
    assert.equal(empresaB.status, 201, JSON.stringify(empresaB.data));

    const empresaAId = empresaA.data.empresa.id;
    const empresaBId = empresaB.data.empresa.id;
    console.log(`✅ Empresas creadas: A=${empresaAId} B=${empresaBId}`);

    // 5. Admin con contraseña temporal: bloqueado hasta cambiarla
    const adminALoginTemp = await login('admin-a@test.local', 'AdminATemporal1!');
    assert.equal(adminALoginTemp.status, 201);
    const adminATempToken = adminALoginTemp.data.access_token;

    const adminABlocked = await api('GET', '/tpv/productos', undefined, adminATempToken);
    assert.equal(adminABlocked.status, 403);
    assert.match(adminABlocked.data.error, /contraseña temporal/i);

    const adminAChange = await api(
      'POST',
      '/auth/change-password',
      { current_password: 'AdminATemporal1!', new_password: 'AdminANueva1!' },
      adminATempToken,
    );
    assert.equal(adminAChange.status, 201);

    const adminBChangeLogin = await login('admin-b@test.local', 'AdminBTemporal1!');
    assert.equal(adminBChangeLogin.status, 201);
    const adminBChange = await api(
      'POST',
      '/auth/change-password',
      { current_password: 'AdminBTemporal1!', new_password: 'AdminBNueva1!' },
      adminBChangeLogin.data.access_token,
    );
    assert.equal(adminBChange.status, 201);

    const adminALogin = await login('admin-a@test.local', 'AdminANueva1!');
    const adminBLogin = await login('admin-b@test.local', 'AdminBNueva1!');
    assert.equal(adminALogin.status, 201);
    assert.equal(adminBLogin.status, 201);
    const adminAToken = adminALogin.data.access_token;
    const adminBToken = adminBLogin.data.access_token;
    console.log('✅ Admins cambiaron contraseña y pudieron ingresar');

    // 6. Admin no puede usar rutas de superadmin; superadmin no puede usar caja de empresa
    const adminAEnAdmin = await api('GET', '/admin/empresas', undefined, adminAToken);
    assert.equal(adminAEnAdmin.status, 403);
    const rootEnCaja = await api('GET', '/tpv/productos', undefined, rootToken);
    assert.equal(rootEnCaja.status, 403);
    console.log('✅ Separación de roles ADMIN / SUPERADMIN');

    // 7. Mismo código de producto permitido en empresas distintas
    const productoA = await api(
      'POST',
      '/tpv/productos',
      { codigo: 'P-COMPARTIDO', nombre: 'Producto A', precio: 1000, stock: 10 },
      adminAToken,
    );
    assert.equal(productoA.status, 201, JSON.stringify(productoA.data));

    const productoB = await api(
      'POST',
      '/tpv/productos',
      { codigo: 'P-COMPARTIDO', nombre: 'Producto B', precio: 2000, stock: 10 },
      adminBToken,
    );
    assert.equal(productoB.status, 201, JSON.stringify(productoB.data));

    const duplicadoA = await api(
      'POST',
      '/tpv/productos',
      { codigo: 'P-COMPARTIDO', nombre: 'Duplicado A', precio: 1000, stock: 1 },
      adminAToken,
    );
    assert.equal(duplicadoA.status, 409);
    console.log('✅ Código de producto único por empresa');

    // 8. Aislamiento de productos
    const bLeeProductoA = await api('GET', `/tpv/productos/${productoA.data.id}`, undefined, adminBToken);
    assert.equal(bLeeProductoA.status, 404);
    const bVendeProductoA = await api(
      'POST',
      '/tpv/ventas',
      {
        id_venta: 'VENTA-CRUZADA-1',
        comercio_cuit: '30700000002',
        items: [{ producto_id: String(productoA.data.id), cantidad: 1 }],
        medio_pago: 'EFECTIVO',
      },
      adminBToken,
    );
    assert.equal(bVendeProductoA.status, 404, JSON.stringify(bVendeProductoA.data));
    console.log('✅ Aislamiento de productos entre empresas');

    // 9. Venta A completa
    const ventaA = await api(
      'POST',
      '/tpv/ventas',
      {
        id_venta: 'VENTA-COMPARTIDA-1',
        comercio_cuit: '30700000001',
        items: [{ producto_id: String(productoA.data.id), cantidad: 1 }],
        medio_pago: 'BANCO',
        cuenta_origen: '0000000000000000000001',
        cuenta_destino: '0000000000000000000002',
      },
      adminAToken,
    );
    assert.equal(ventaA.status, 201, JSON.stringify(ventaA.data));
    assert.equal(ventaA.data.estado, 'completada');

    // Reintento del mismo id en la misma empresa: devuelve la venta guardada
    const ventaARetry = await api(
      'POST',
      '/tpv/ventas',
      {
        id_venta: 'VENTA-COMPARTIDA-1',
        comercio_cuit: '30700000001',
        items: [{ producto_id: String(productoA.data.id), cantidad: 1 }],
        medio_pago: 'BANCO',
        cuenta_origen: '0000000000000000000001',
        cuenta_destino: '0000000000000000000002',
      },
      adminAToken,
    );
    assert.equal(ventaARetry.status, 201);
    assert.equal(ventaARetry.data.id, ventaA.data.id);
    console.log('✅ Venta A completada e idempotente dentro de la empresa');

    // 9b. Dos solicitudes simultáneas con el mismo id_venta.
    // El lock persistido debe impedir que ambas ejecuten las etapas a la vez.
    const stockAntesConcurrente = await prisma.producto.findUnique({
      where: { id: productoA.data.id },
    });
    const payloadConcurrente = {
      id_venta: 'VENTA-CONCURRENTE-1',
      comercio_cuit: '30700000001',
      items: [{ producto_id: String(productoA.data.id), cantidad: 1 }],
      medio_pago: 'BANCO',
      cuenta_origen: '0000000000000000000001',
      cuenta_destino: '0000000000000000000002',
    };

    const [concurrente1, concurrente2] = await Promise.all([
      api('POST', '/tpv/ventas', payloadConcurrente, adminAToken),
      api('POST', '/tpv/ventas', payloadConcurrente, adminAToken),
    ]);
    const estadosConcurrentes = [concurrente1.status, concurrente2.status].sort();
    assert.deepEqual(estadosConcurrentes, [201, 409], JSON.stringify({
      primera: concurrente1.data,
      segunda: concurrente2.data,
    }));

    const ventasConcurrentes = await prisma.venta.count({
      where: { idVentaExternal: 'VENTA-CONCURRENTE-1', empresaId: empresaAId },
    });
    assert.equal(ventasConcurrentes, 1);

    const ventaConcurrente = await prisma.venta.findUniqueOrThrow({
      where: { idVentaExternal: 'VENTA-CONCURRENTE-1' },
    });
    assert.equal(ventaConcurrente.lockToken, null);
    assert.equal(ventaConcurrente.lockExpiresAt, null);
    assert.ok(ventaConcurrente.intentos >= 1);

    const stockDespuesConcurrente = await prisma.producto.findUnique({
      where: { id: productoA.data.id },
    });
    assert.equal(
      stockDespuesConcurrente?.stock,
      (stockAntesConcurrente?.stock || 0) - 1,
      'El stock debe descontarse una sola vez',
    );
    console.log('✅ Solicitudes simultáneas: una procesa y la otra recibe 409 sin duplicar la venta');

    // 10. id_venta global: B no puede reutilizar el de A
    const ventaBMismoId = await api(
      'POST',
      '/tpv/ventas',
      {
        id_venta: 'VENTA-COMPARTIDA-1',
        comercio_cuit: '30700000002',
        items: [{ producto_id: String(productoB.data.id), cantidad: 1 }],
        medio_pago: 'EFECTIVO',
      },
      adminBToken,
    );
    assert.equal(ventaBMismoId.status, 409);
    console.log('✅ id_venta permanece globalmente único');

    // 11. B no puede leer la venta de A
    const bLeeVentaA = await api('GET', `/tpv/ventas/${ventaA.data.id_venta}`, undefined, adminBToken);
    assert.equal(bLeeVentaA.status, 404);
    console.log('✅ Aislamiento de ventas entre empresas');

    // 12. Venta B con id propio
    const ventaB = await api(
      'POST',
      '/tpv/ventas',
      {
        id_venta: 'VENTA-B-1',
        comercio_cuit: '30700000002',
        items: [{ producto_id: String(productoB.data.id), cantidad: 1 }],
        medio_pago: 'EFECTIVO',
      },
      adminBToken,
    );
    assert.equal(ventaB.status, 201, JSON.stringify(ventaB.data));
    console.log('✅ Venta B completada');

    // 13. Suspensión de B: token existente y login nuevo deben fallar
    const suspenderB = await api(
      'PATCH',
      `/admin/empresas/${empresaBId}/estado`,
      { estado: 'SUSPENDIDA' },
      rootToken,
    );
    assert.equal(suspenderB.status, 200);

    const bConTokenSuspendido = await api('GET', '/tpv/productos', undefined, adminBToken);
    assert.ok([401, 403].includes(bConTokenSuspendido.status), JSON.stringify(bConTokenSuspendido.data));
    if (bConTokenSuspendido.status === 403) {
      assert.match(bConTokenSuspendido.data.error, /suspendido/i);
    }

    const bLoginSuspendido = await login('admin-b@test.local', 'AdminBNueva1!');
    assert.equal(bLoginSuspendido.status, 403);
    console.log('✅ Empresa suspendida bloqueada en backend');

    const reactivarB = await api(
      'PATCH',
      `/admin/empresas/${empresaBId}/estado`,
      { estado: 'ACTIVA' },
      rootToken,
    );
    assert.equal(reactivarB.status, 200);

    // 14. Módulos: deshabilitar productos en A
    const modulosA = await api(
      'PUT',
      `/admin/empresas/${empresaAId}/modulos`,
      { modulos: ['caja', 'ventas', 'comercios'] },
      rootToken,
    );
    assert.equal(modulosA.status, 200);

    const aProductosBloqueados = await api('GET', '/tpv/productos', undefined, adminAToken);
    assert.equal(aProductosBloqueados.status, 403);
    assert.match(aProductosBloqueados.data.error, /productos/i);

    const restaurarModulosA = await api(
      'PUT',
      `/admin/empresas/${empresaAId}/modulos`,
      { modulos: ['caja', 'productos', 'ventas', 'comercios'] },
      rootToken,
    );
    assert.equal(restaurarModulosA.status, 200);
    console.log('✅ Módulos aplicados en backend');

    // 15. Superadmin consulta datos en solo lectura y con auditoría
    const resumen = await api('GET', `/admin/empresas/${empresaAId}/resumen`, undefined, rootToken);
    assert.equal(resumen.status, 200);
    assert.equal(resumen.data.cantidad_ventas, 2);

    const ventasAAdmin = await api('GET', `/admin/empresas/${empresaAId}/ventas`, undefined, rootToken);
    assert.equal(ventasAAdmin.status, 200);
    assert.equal(ventasAAdmin.data.total, 2);

    const productosAAdmin = await api('GET', `/admin/empresas/${empresaAId}/productos`, undefined, rootToken);
    assert.equal(productosAAdmin.status, 200);

    const comerciosAAdmin = await api('GET', `/admin/empresas/${empresaAId}/comercios`, undefined, rootToken);
    assert.equal(comerciosAAdmin.status, 200);

    const serializado = JSON.stringify([
      resumen.data,
      ventasAAdmin.data,
      productosAAdmin.data,
      comerciosAAdmin.data,
    ]);
    assert.doesNotMatch(serializado, /passwordHash|password_hash|access_token|token_version/i);

    const auditorias = await prisma.auditoriaAcceso.count({
      where: { usuarioId: rootLogin2.data.usuario.id, empresaId: empresaAId },
    });
    assert.ok(auditorias >= 4, `Auditorías insuficientes: ${auditorias}`);
    console.log(`✅ Superadmin consultó datos en solo lectura con ${auditorias} registros de auditoría`);

    // 16. No se expusieron secretos en usuarios de la empresa
    const detalleA = await api('GET', `/admin/empresas/${empresaAId}`, undefined, rootToken);
    assert.equal(detalleA.status, 200);
    const detalleSerializado = JSON.stringify(detalleA.data);
    assert.doesNotMatch(detalleSerializado, /passwordHash|password_hash|tokenVersion|token_version/i);
    console.log('✅ Sin hashes ni versiones de token en respuestas de administración');

    // 17. Contrato HTTP de conciliación de pagos inciertos.
    const crearVentaConciliacion = (
      idVenta: string,
      medioPago = 'BANCO',
    ) =>
      prisma.venta.create({
        data: {
          idVentaExternal: idVenta,
          empresaId: empresaAId,
          cuit: '30700000001',
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

    const ventaPorConfirmar = await crearVentaConciliacion('HTTP-CONCILIACION-CONFIRMADA');
    const ventaNoCobrada = await crearVentaConciliacion('HTTP-CONCILIACION-NO-COBRADA');
    const ventaRechazada = await crearVentaConciliacion('HTTP-CONCILIACION-RECHAZADA');
    const ventaEfectivo = await crearVentaConciliacion('HTTP-CONCILIACION-EFECTIVO', 'EFECTIVO');

    const rootConcilia = await api(
      'POST',
      `/tpv/ventas/${ventaPorConfirmar.idVentaExternal}/conciliar-pago`,
      {
        resultado: 'CONFIRMADO',
        transaccion_id: 'ROOT-NO-PERMITIDO',
        observacion: 'Intento de superadmin',
      },
      rootToken,
    );
    assert.equal(rootConcilia.status, 403);

    const adminBLoginFinal = await login('admin-b@test.local', 'AdminBNueva1!');
    assert.equal(adminBLoginFinal.status, 201);
    const adminBTokenFinal = adminBLoginFinal.data.access_token;

    const bConciliaVentaA = await api(
      'POST',
      `/tpv/ventas/${ventaPorConfirmar.idVentaExternal}/conciliar-pago`,
      {
        resultado: 'CONFIRMADO',
        transaccion_id: 'B-NO-PERMITIDO',
        observacion: 'Venta de otra empresa',
      },
      adminBTokenFinal,
    );
    assert.equal(bConciliaVentaA.status, 404);

    const observacionVacia = await api(
      'POST',
      `/tpv/ventas/${ventaNoCobrada.idVentaExternal}/conciliar-pago`,
      { resultado: 'NO_COBRADO', observacion: '   ' },
      adminAToken,
    );
    assert.equal(observacionVacia.status, 400);

    for (const transaccion of ['NO-DEBE-ACEPTARSE', '   ', '', null]) {
      const transaccionNoPermitida = await api(
        'POST',
        `/tpv/ventas/${ventaNoCobrada.idVentaExternal}/conciliar-pago`,
        {
          resultado: 'NO_COBRADO',
          transaccion_id: transaccion,
          observacion: 'El proveedor no registra el cobro',
        },
        adminAToken,
      );
      assert.equal(
        transaccionNoPermitida.status,
        400,
        `NO_COBRADO debe rechazar transaccion_id=${JSON.stringify(transaccion)}`,
      );
    }

    const transaccionRechazadaConEspacios = await api(
      'POST',
      `/tpv/ventas/${ventaRechazada.idVentaExternal}/conciliar-pago`,
      {
        resultado: 'RECHAZADO',
        transaccion_id: '   ',
        observacion: 'El proveedor confirmó el rechazo',
      },
      adminAToken,
    );
    assert.equal(transaccionRechazadaConEspacios.status, 400);

    for (const transaccion of ['   ', '', null]) {
      const confirmadaSinReferencia = await api(
        'POST',
        `/tpv/ventas/${ventaPorConfirmar.idVentaExternal}/conciliar-pago`,
        {
          resultado: 'CONFIRMADO',
          transaccion_id: transaccion,
          observacion: 'Intento con referencia vacía',
        },
        adminAToken,
      );
      assert.equal(
        confirmadaSinReferencia.status,
        400,
        `CONFIRMADO debe rechazar transaccion_id=${JSON.stringify(transaccion)}`,
      );
    }

    const conciliacionConfirmada = await api(
      'POST',
      `/tpv/ventas/${ventaPorConfirmar.idVentaExternal}/conciliar-pago`,
      {
        resultado: 'CONFIRMADO',
        transaccion_id: 'HTTP-BNC-1',
        observacion:
          'Verificado en el portal con cuentas 0000-0000-0000-0001 y 0000.0000.0000.0002, referencia HTTP BNC 1 y otra 1234-5678-9012',
      },
      adminAToken,
    );
    assert.equal(conciliacionConfirmada.status, 200, JSON.stringify(conciliacionConfirmada.data));
    assert.equal(conciliacionConfirmada.data.estado, 'pendiente');
    assert.equal(conciliacionConfirmada.data.etapa_pendiente, 'arca');
    assert.equal(conciliacionConfirmada.data.requiere_conciliacion, false);
    assert.equal(conciliacionConfirmada.data.pago.transaccion_id, 'HTTP-BNC-1');
    const observacionHttp = String(
      conciliacionConfirmada.data.observacion_conciliacion || '',
    );
    const segmentosSensiblesHttp = [
      '0000',
      '0001',
      '0002',
      'HTTP',
      'BNC',
      '1234',
      '5678',
      '9012',
    ];
    assert.match(observacionHttp, /Verificado en el portal/);
    for (const segmento of segmentosSensiblesHttp) {
      assert.doesNotMatch(
        observacionHttp,
        new RegExp(segmento),
        `La respuesta HTTP no debe exponer el segmento ${segmento}`,
      );
    }
    assert.doesNotMatch(
      String(conciliacionConfirmada.data.error_detalle || ''),
      new RegExp(
        ['Verificado en el portal', ...segmentosSensiblesHttp].join('|'),
      ),
    );

    const ventaConfirmadaDb = await prisma.venta.findUniqueOrThrow({
      where: { idVentaExternal: ventaPorConfirmar.idVentaExternal },
    });
    assert.equal(
      ventaConfirmadaDb.observacionConciliacion,
      conciliacionConfirmada.data.observacion_conciliacion,
    );
    for (const segmento of segmentosSensiblesHttp) {
      assert.doesNotMatch(
        String(ventaConfirmadaDb.observacionConciliacion || ''),
        new RegExp(segmento),
        `El valor persistido no debe exponer el segmento ${segmento}`,
      );
    }
    const detalleVentaConfirmada = await api(
      'GET',
      `/tpv/ventas/${ventaPorConfirmar.idVentaExternal}`,
      undefined,
      adminAToken,
    );
    assert.equal(detalleVentaConfirmada.status, 200);
    assert.equal(
      detalleVentaConfirmada.data.observacion_conciliacion,
      conciliacionConfirmada.data.observacion_conciliacion,
    );

    const conciliacionNoCobrada = await api(
      'POST',
      `/tpv/ventas/${ventaNoCobrada.idVentaExternal}/conciliar-pago`,
      {
        resultado: 'NO_COBRADO',
        observacion: 'El proveedor no registra el cobro',
      },
      adminAToken,
    );
    assert.equal(conciliacionNoCobrada.status, 200, JSON.stringify(conciliacionNoCobrada.data));
    assert.equal(conciliacionNoCobrada.data.estado, 'pendiente');
    assert.equal(conciliacionNoCobrada.data.etapa_pendiente, 'pago');
    assert.equal(conciliacionNoCobrada.data.pago.transaccion_id, null);

    const conciliacionRechazada = await api(
      'POST',
      `/tpv/ventas/${ventaRechazada.idVentaExternal}/conciliar-pago`,
      {
        resultado: 'RECHAZADO',
        observacion: 'El proveedor confirmó el rechazo de la operación',
      },
      adminAToken,
    );
    assert.equal(conciliacionRechazada.status, 200, JSON.stringify(conciliacionRechazada.data));
    assert.equal(conciliacionRechazada.data.estado, 'error_recuperable');
    assert.equal(conciliacionRechazada.data.etapa_pendiente, 'pago');
    assert.equal(conciliacionRechazada.data.pago.transaccion_id, null);

    const conciliacionEfectivo = await api(
      'POST',
      `/tpv/ventas/${ventaEfectivo.idVentaExternal}/conciliar-pago`,
      { resultado: 'NO_COBRADO', observacion: 'No aplica a efectivo' },
      adminAToken,
    );
    assert.equal(conciliacionEfectivo.status, 400);

    const auditoriaConfirmada = await prisma.auditoriaAcceso.findFirstOrThrow({
      where: {
        usuarioId: adminALogin.data.usuario.id,
        accion: 'CONCILIACION_PAGO',
        recursoId: ventaPorConfirmar.idVentaExternal,
      },
      orderBy: { id: 'desc' },
    });
    assert.equal(auditoriaConfirmada.resultado, 'CONFIRMADO');
    assert.doesNotMatch(
      JSON.stringify(auditoriaConfirmada),
      /Verificado en el portal|0000-0000-0000-0001|0000\.0000\.0000\.0002|HTTP BNC 1|1234-5678-9012|HTTP-BNC-1/,
    );

    const auditoriaFallidaB = await prisma.auditoriaAcceso.findFirstOrThrow({
      where: {
        usuarioId: adminBLogin.data.usuario.id,
        accion: 'CONCILIACION_PAGO',
        recursoId: ventaPorConfirmar.idVentaExternal,
      },
      orderBy: { id: 'desc' },
    });
    assert.equal(auditoriaFallidaB.resultado, 'FALLIDO');
    assert.doesNotMatch(
      JSON.stringify(auditoriaFallidaB),
      /Venta de otra empresa/,
    );

    console.log('✅ Contrato HTTP de conciliación, permisos, aislamiento y auditoría verificados');

    console.log('\n🎉 Todas las pruebas de la Etapa 1 pasaron.');
  } finally {
    await app.close();
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error('❌ Falló la prueba:', error);
  await prisma.$disconnect();
  process.exit(1);
});
