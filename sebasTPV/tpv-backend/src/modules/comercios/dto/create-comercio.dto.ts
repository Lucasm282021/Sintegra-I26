import { IsString, IsNotEmpty, Matches, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateComercioDto {
  @ApiProperty({ example: '30712345678', description: 'CUIT como string de 11 dígitos sin puntos ni guiones' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{11}$/, { message: 'El CUIT debe contener exactamente 11 dígitos numéricos sin puntos ni guiones' })
  cuit: string;

  @ApiProperty({ example: 'Supermercado Central S.A.' })
  @IsString()
  @IsNotEmpty()
  razonSocial: string;

  @ApiPropertyOptional({ example: 'Av. San Martín 1234' })
  @IsString()
  @IsOptional()
  direccion?: string;

  @ApiPropertyOptional({ example: 'Supermercado' })
  @IsString()
  @IsOptional()
  rubro?: string;
}
