import { Module } from '@nestjs/common';
import { VentasService } from './ventas.service';
import { VentasController } from './ventas.controller';
import { IntegracionesModule } from '../integraciones/integraciones.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';

@Module({
  imports: [IntegracionesModule, AuditoriaModule],
  controllers: [VentasController],
  providers: [VentasService],
})
export class VentasModule {}
