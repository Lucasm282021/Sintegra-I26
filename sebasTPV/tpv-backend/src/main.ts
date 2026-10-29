import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

// Node 24 permite cargar .env sin dependencias adicionales.
try {
  if (typeof process.loadEnvFile === 'function') {
    process.loadEnvFile();
  }
} catch {
  // Si no existe .env, se usan las variables del entorno.
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  const isProduction = process.env.NODE_ENV === 'production';
  const configuredOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowedOrigins = isProduction
    ? configuredOrigins
    : [...new Set([...configuredOrigins, 'http://localhost:3000'])];

  app.enableCors({
    origin: allowedOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  });
  app.enableShutdownHooks();

  if (isProduction && allowedOrigins.length === 0) {
    throw new Error('CORS_ORIGINS debe incluir el origen público del frontend en producción');
  }

  for (const [name, value] of Object.entries(process.env)) {
    if (name.endsWith('_MOCK') && value === 'true') {
      logger.warn(`${name}=true: se usará una respuesta simulada para esa integración`);
    }
  }

  // Filtro global de excepciones según contrato: {"error": "mensaje"}
  app.useGlobalFilters(new HttpExceptionFilter());

  // Validación global de DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // Configuración de Swagger / OpenAPI
  const config = new DocumentBuilder()
    .setTitle('TPV API — Terminal Punto de Venta')
    .setDescription('Servicio REST del Módulo TPV para el Ecosistema Fintech Simulado. Integrado con BANCO (3002), ARBA (3003) y ARCA (3004).')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Ventas')
    .addTag('Productos')
    .addTag('Comercios')
    .addTag('Auth')
    .addTag('Admin - Empresas')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 TPV Backend ejecutándose en: http://0.0.0.0:${port}`);
  logger.log(`📚 Documentación Swagger disponible en: http://0.0.0.0:${port}/api/docs`);
}

bootstrap();
