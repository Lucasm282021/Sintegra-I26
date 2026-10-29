import { Module } from '@nestjs/common';
import { IntegracionesService } from './integraciones.service';

@Module({
  providers: [IntegracionesService],
  exports: [IntegracionesService],
})
export class IntegracionesModule {}
