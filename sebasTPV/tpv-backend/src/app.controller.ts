import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from './common/decorators/public.decorator';

@ApiTags('Health')
@Controller()
export class AppController {
  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Verifica la salud del servicio TPV' })
  getHealth() {
    return {
      status: 'ok',
      modulo: 'tpv',
      timestamp: new Date().toISOString(),
    };
  }
}
