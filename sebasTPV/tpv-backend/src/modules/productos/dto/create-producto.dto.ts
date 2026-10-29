import { IsString, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductoDto {
  @ApiPropertyOptional({ example: 'TPV-CAFE-500', description: 'Código local dentro de la empresa' })
  @IsOptional()
  @IsString()
  codigo?: string;

  @ApiProperty({ example: 'Café Molido 500g' })
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiPropertyOptional({ example: 'Café de tueste natural' })
  @IsString()
  @IsOptional()
  descripcion?: string;

  @ApiProperty({ example: 4500.0 })
  @IsNumber()
  @Min(0)
  precio: number;

  @ApiPropertyOptional({ example: 50 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  stock?: number;

  @ApiPropertyOptional({ example: 'Almacén' })
  @IsString()
  @IsOptional()
  categoria?: string;

  @ApiPropertyOptional({ example: 'https://example.com/foto.jpg' })
  @IsString()
  @IsOptional()
  imagenUrl?: string;
}
