import { Module } from '@nestjs/common';
import { ComerciosService } from './comercios.service';
import { ComerciosController } from './comercios.controller';

@Module({
  controllers: [ComerciosController],
  providers: [ComerciosService],
  exports: [ComerciosService],
})
export class ComerciosModule {}
