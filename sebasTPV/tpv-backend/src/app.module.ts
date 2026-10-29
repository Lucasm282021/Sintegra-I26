import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProductosModule } from './modules/productos/productos.module';
import { ComerciosModule } from './modules/comercios/comercios.module';
import { VentasModule } from './modules/ventas/ventas.module';
import { IntegracionesModule } from './modules/integraciones/integraciones.module';
import { EmpresasModule } from './modules/empresas/empresas.module';
import { AuditoriaModule } from './modules/auditoria/auditoria.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { EmpresaActivaGuard } from './common/guards/empresa-activa.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { ModuloGuard } from './common/guards/modulo.guard';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    EmpresasModule,
    AuditoriaModule,
    ProductosModule,
    ComerciosModule,
    VentasModule,
    IntegracionesModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: EmpresaActivaGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ModuloGuard },
  ],
})
export class AppModule {}
