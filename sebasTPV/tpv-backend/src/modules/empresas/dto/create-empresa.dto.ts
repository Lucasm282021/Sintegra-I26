import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const MODULOS_DISPONIBLES = ['caja', 'productos', 'ventas', 'comercios'] as const;

export class CreateEmpresaDto {
  @ApiProperty({ example: 'Supermercado Central S.A.' })
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiProperty({ example: '30712345678', description: 'CUIT del comercio fiscal' })
  @IsString()
  @Matches(/^\d{11}$/, { message: 'El CUIT debe contener exactamente 11 dígitos numéricos' })
  cuit: string;

  @ApiProperty({ example: 'Supermercado Central S.A.' })
  @IsString()
  @IsNotEmpty()
  razon_social: string;

  @ApiPropertyOptional({ example: 'Av. San Martín 1234' })
  @IsOptional()
  @IsString()
  direccion?: string;

  @ApiPropertyOptional({ example: 'Supermercado' })
  @IsOptional()
  @IsString()
  rubro?: string;

  @ApiProperty({ example: 'admin@supermercadocentral.com' })
  @IsEmail()
  admin_email: string;

  @ApiProperty({ example: 'ContraseñaTemporal123' })
  @IsString()
  @MinLength(8)
  admin_password: string;

  @ApiPropertyOptional({ example: 'Administrador Central' })
  @IsOptional()
  @IsString()
  admin_nombre?: string;

  @ApiPropertyOptional({ example: ['caja', 'productos', 'ventas', 'comercios'] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(MODULOS_DISPONIBLES, { each: true })
  modulos?: string[];
}
