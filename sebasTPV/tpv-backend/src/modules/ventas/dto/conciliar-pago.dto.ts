import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type ResultadoConciliacion = 'CONFIRMADO' | 'NO_COBRADO' | 'RECHAZADO';

export class ConciliarPagoDto {
  @ApiProperty({
    example: 'CONFIRMADO',
    enum: ['CONFIRMADO', 'NO_COBRADO', 'RECHAZADO'],
    description: 'Resultado verificado manualmente contra BANCO o BILLETERA',
  })
  @IsIn(['CONFIRMADO', 'NO_COBRADO', 'RECHAZADO'])
  resultado: ResultadoConciliacion;

  @ApiPropertyOptional({
    example: 'BNC-171182736',
    description: 'Obligatorio cuando resultado es CONFIRMADO; prohibido para los demás resultados',
  })
  @IsOptional()
  @IsString()
  transaccion_id?: string;

  @ApiProperty({
    example: 'Verificado en el portal del proveedor por id_venta',
    description: 'Justificación del operador. Obligatoria, no vacía y de hasta 500 caracteres.',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  observacion: string;
}
