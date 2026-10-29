import { ArrayUnique, IsArray, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MODULOS_DISPONIBLES } from './create-empresa.dto';

export class UpdateModulosDto {
  @ApiProperty({ example: ['caja', 'productos', 'ventas'] })
  @IsArray()
  @ArrayUnique()
  @IsIn(MODULOS_DISPONIBLES, { each: true })
  modulos: string[];
}
