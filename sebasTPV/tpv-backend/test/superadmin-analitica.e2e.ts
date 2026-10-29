import * as assert from 'assert/strict';
import { execSync } from 'child_process';
import * as fs from 'fs';
import axios, { AxiosRequestConfig } from 'axios';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const DB_PATH = '/tmp/opencode/tpv-admin-test.db';
const PORT = 3012;
const BASE_URL = `http://127.0.0.1:${PORT}`;

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = `file:${DB_PATH}`;
process.env.JWT_SECRET = 'test-secret-admin-etapa1-no-usar-en-produccion';
process.env.MUNICIPIO_MOCK = 'true';
process.env.BANCO_MOCK = 'true';
process.env.BILLETERA_MOCK = 'true';
process.env.ARBA_MOCK = 'true';
process.env.ARCA_MOCK = 'true';

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
  console.log('🧪 Preparando prueba de analítica del superadmin...');
  if (fs.existsSync(DB_PATH)) {
    fs.rmSync(DB_PATH);
  }

  execSync('npx prisma migrate deploy', { stdio: 'inherit', env: process.env });
  execSync('npx ts-node prisma/seed.ts', { stdio: 'inherit', env: process.env });
  execSync('npx ts-node prisma/bootstrap-superadmin.ts', {
    stdio: 'inherit',
    env: {
      ...process.env,
      SUPERADMIN_EMAIL: 'root-analitica@test.local',
      SUPERADMIN_PASSWORD: 'RootTemporal123!',
      SUPERADMIN_NOMBRE: 'Root Analítica',
    },
  });

  const { AppModule } = await import('../src/app.module');
  const { HttpExceptionFilter } = await import('../src/common/filters/http-exception.filter');
  const app = await NestFactory.create(AppModule, { logger: false });
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(PORT, '127.0.0.1');

  try {
    const rootTemp = await login('root-analitica@test.local', 'RootTemporal123!');
    assert.equal(rootTemp.status, 201);
    const change = await api(
      'POST',
      '/auth/change-password',
      { current_password: 'RootTemporal123!', new_password: 'RootNueva123!' },
      rootTemp.data.access_token,
    );
    assert.equal(change.status, 201);
    const rootLogin = await login('root-analitica@test.local', 'RootNueva123!');
    assert.equal(rootLogin.status, 201);
    const rootToken = rootLogin.data.access_token;

    const empresa = await api(
      'POST',
      '/admin/empresas',
      {
        nombre: 'Empresa Analítica',
        cuit: '30700000003',
        razon_social: 'Empresa Analítica S.A.',
        admin_email: 'admin-analitica@test.local',
        admin_password: 'AdminTemporal1!',
        admin_nombre: 'Admin Analítica',
      },
      rootToken,
    );
    assert.equal(empresa.status, 201, JSON.stringify(empresa.data));
    const empresaId = empresa.data.empresa.id;

    const adminTemp = await login('admin-analitica@test.local', 'AdminTemporal1!');
    assert.equal(adminTemp.status, 201);
    const adminChange = await api(
      'POST',
      '/auth/change-password',
      { current_password: 'AdminTemporal1!', new_password: 'AdminNueva1!' },
      adminTemp.data.access_token,
    );
    assert.equal(adminChange.status, 201);
    const adminLogin = await login('admin-analitica@test.local', 'AdminNueva1!');
    assert.equal(adminLogin.status, 201);
    const adminToken = adminLogin.data.access_token;

    const producto = await api(
      'POST',
      '/tpv/productos',
      { codigo: 'ANALITICA-1', nombre: 'Producto analítica', precio: 500, stock: 10 },
      adminToken,
    );
    assert.equal(producto.status, 201, JSON.stringify(producto.data));

    const venta = await api(
      'POST',
      '/tpv/ventas',
      {
        id_venta: 'VENTA-ANALITICA-1',
        comercio_cuit: '30700000003',
        items: [{ producto_id: String(producto.data.id), cantidad: 2 }],
        medio_pago: 'BANCO',
        cuenta_origen: '1234567890123456789012',
        cuenta_destino: '9876543210987654321098',
      },
      adminToken,
    );
    assert.equal(venta.status, 201, JSON.stringify(venta.data));

    const resumen = await api('GET', `/admin/empresas/${empresaId}/resumen`, undefined, rootToken);
    assert.equal(resumen.status, 200);

    const ventas = await api('GET', `/admin/empresas/${empresaId}/ventas`, undefined, rootToken);
    assert.equal(ventas.status, 200);
    assert.equal(ventas.data.total, 1);

    const detalle = await api('GET', `/admin/empresas/${empresaId}/ventas/${venta.data.id_venta}`, undefined, rootToken);
    assert.equal(detalle.status, 200);

    const productos = await api('GET', `/admin/empresas/${empresaId}/productos`, undefined, rootToken);
    assert.equal(productos.status, 200);

    const comercios = await api('GET', `/admin/empresas/${empresaId}/comercios`, undefined, rootToken);
    assert.equal(comercios.status, 200);

    const serializado = JSON.stringify([resumen.data, ventas.data, detalle.data, productos.data, comercios.data]);
    assert.doesNotMatch(serializado, /passwordHash|password_hash|tokenVersion|token_version|access_token/i);
    assert.doesNotMatch(serializado, /1234567890123456789012|9876543210987654321098/);
    assert.match(detalle.data.pago.cuenta_origen, /\*\*\*\*/);
    assert.match(detalle.data.pago.cuenta_destino, /\*\*\*\*/);

    const auditorias = await prisma.auditoriaAcceso.findMany({
      where: { empresaId, usuarioId: rootLogin.data.usuario.id },
      orderBy: { id: 'asc' },
    });
    assert.ok(auditorias.length >= 5, `Auditorías insuficientes: ${auditorias.length}`);
    assert.ok(auditorias.every((item) => item.accion === 'CONSULTA_SUPERADMIN'));
    assert.ok(auditorias.some((item) => item.recurso === 'venta'));
    assert.ok(auditorias.some((item) => item.recurso === 'productos'));

    // El superadmin no puede escribir datos operativos de la empresa.
    const rootEscribeProducto = await api(
      'POST',
      '/tpv/productos',
      { nombre: 'No permitido', precio: 1, stock: 1 },
      rootToken,
    );
    assert.equal(rootEscribeProducto.status, 403);

    console.log(`✅ Analítica de solo lectura y enmascarada con ${auditorias.length} auditorías`);
    console.log('🎉 Prueba de superadmin y auditoría pasó.');
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
