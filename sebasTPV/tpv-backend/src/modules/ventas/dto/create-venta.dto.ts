import { IsString, IsArray, ValidateNested, IsNumber, Min, IsOptional } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ItemVentaDto {
  @ApiPropertyOptional({ example: 'prod-1' })
  @IsOptional()
  @Transform(({ value, obj }) => String(value ?? obj.producto_id ?? ''))
  productoId?: string;

  @ApiPropertyOptional({ example: 'prod-1' })
  @IsOptional()
  @Transform(({ value, obj }) => String(value ?? obj.productoId ?? ''))
  producto_id?: string;

  @ApiProperty({ example: 2 })
  @IsNumber()
  @Min(1)
  cantidad: number;

  getResolvedProductoRef(): string {
    const ref = this.productoId || this.producto_id || '';
    return String(ref).trim();
  }
}

export class CreateVentaDto {
  @ApiProperty({ example: 'vta-1001', description: 'ID de la venta asignado por la terminal (obligatorio para idempotencia)' })
  @IsOptional()
  @IsString()
  @Transform(({ value, obj }) => value ?? obj.id_venta)
  idVenta?: string;

  @ApiPropertyOptional({ example: 'vta-1001' })
  @IsOptional()
  @IsString()
  id_venta?: string;

  @ApiProperty({ example: '30712345678', description: 'CUIT del comercio (11 dígitos sin puntos ni guiones)' })
  @IsOptional()
  @IsString()
  @Transform(({ value, obj }) => value ?? obj.comercio_cuit)
  cuit?: string;

  @ApiPropertyOptional({ example: '30712345678' })
  @IsOptional()
  @IsString()
  comercio_cuit?: string;

  @ApiProperty({ example: 'BANCO', description: 'Medio de pago: BANCO o BILLETERA' })
  @IsOptional()
  @IsString()
  @Transform(({ value, obj }) => (value ?? obj.medio_pago ?? '').toString().toUpperCase())
  medioPago?: string;

  @ApiPropertyOptional({ example: 'BANCO' })
  @IsOptional()
  @IsString()
  medio_pago?: string;

  @ApiPropertyOptional({ example: '1234567890123456789012', description: 'Cuenta origen (CBU/Alias) para BANCO' })
  @IsOptional()
  @IsString()
  @Transform(({ value, obj }) => value ?? obj.cuenta_origen)
  cuentaOrigen?: string;

  @ApiPropertyOptional({ example: '1234567890123456789012' })
  @IsOptional()
  @IsString()
  cuenta_origen?: string;

  @ApiPropertyOptional({ example: '9876543210987654321098', description: 'Cuenta destino (CBU/Alias) para BANCO' })
  @IsOptional()
  @IsString()
  @Transform(({ value, obj }) => value ?? obj.cuenta_destino)
  cuentaDestino?: string;

  @ApiPropertyOptional({ example: '9876543210987654321098' })
  @IsOptional()
  @IsString()
  cuenta_destino?: string;

  @ApiPropertyOptional({ example: '20345678901', description: 'CUIT pagador registrado en Billetera' })
  @IsOptional()
  @IsString()
  @Transform(({ value, obj }) => value ?? obj.cuit_pagador)
  cuitPagador?: string;

  @ApiPropertyOptional({ example: '20345678901' })
  @IsOptional()
  @IsString()
  cuit_pagador?: string;

  @ApiProperty({ type: [ItemVentaDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemVentaDto)
  items: ItemVentaDto[];

  getCuit(): string {
    const raw = this.cuit || this.comercio_cuit || '';
    return raw.replace(/\D/g, '');
  }

  getIdVenta(): string {
    return (this.idVenta || this.id_venta || '').trim();
  }

  getMedioPago(): string {
    const raw = (this.medioPago || this.medio_pago || 'BANCO').toString().toUpperCase();
    return raw;
  }

  getCuentaOrigen(): string | undefined {
    const raw = this.cuentaOrigen || this.cuenta_origen;
    return raw ? raw.trim() : undefined;
  }

  getCuentaDestino(): string | undefined {
    const raw = this.cuentaDestino || this.cuenta_destino;
    return raw ? raw.trim() : undefined;
  }

  getCuitPagador(): string | undefined {
    const raw = this.cuitPagador || this.cuit_pagador || '';
    return raw ? raw.replace(/\D/g, '') : undefined;
  }
}


