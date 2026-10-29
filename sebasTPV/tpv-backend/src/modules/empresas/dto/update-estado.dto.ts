import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateEstadoDto {
  @ApiProperty({ example: 'SUSPENDIDA', enum: ['ACTIVA', 'SUSPENDIDA'] })
  @IsIn(['ACTIVA', 'SUSPENDIDA'])
  estado: 'ACTIVA' | 'SUSPENDIDA';
}
