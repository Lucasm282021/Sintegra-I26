import { Controller, Get, Post, Body, Param, Req, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request } from 'express';
import { VentasService } from './ventas.service';
import { CreateVentaDto } from './dto/create-venta.dto';
import { ConciliarPagoDto } from './dto/conciliar-pago.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Modulo } from '../../common/decorators/modulo.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UsuarioAutenticado } from '../../common/auth/authenticated-user.interface';

@ApiTags('Ventas')
@Controller('tpv/ventas')
@Roles('ADMIN')
export class VentasController {
  constructor(private readonly ventasService: VentasService) {}

  @Post()
  @Modulo('caja')
  @ApiOperation({ summary: 'Registra o reintenta una venta idempotente para la empresa autenticada' })
  @ApiResponse({ status: 201, description: 'Venta registrada y facturada con éxito' })
  @ApiResponse({ status: 400, description: 'Datos de venta o stock inválidos {"error": "..."}' })
  @ApiResponse({ status: 409, description: 'id_venta ya utilizado {"error": "..."}' })
  create(@CurrentUser() user: UsuarioAutenticado, @Body() dto: CreateVentaDto) {
    return this.ventasService.create(user.empresaId, dto);
  }

  @Get()
  @Modulo('ventas')
  @ApiOperation({ summary: 'Obtiene las ventas de la empresa autenticada' })
  findAll(@CurrentUser() user: UsuarioAutenticado) {
    return this.ventasService.findAll(user.empresaId);
  }

  @Get(':id')
  @Modulo('ventas')
  @ApiOperation({ summary: 'Obtiene el detalle de una venta de la empresa autenticada' })
  @ApiResponse({ status: 200, description: 'Detalle de la venta' })
  @ApiResponse({ status: 404, description: 'Venta no encontrada {"error": "..."}' })
  findOne(@CurrentUser() user: UsuarioAutenticado, @Param('id') id: string) {
    return this.ventasService.findOne(user.empresaId, id);
  }

  @Post(':id/conciliar-pago')
  @HttpCode(200)
  @Modulo('caja')
  @ApiOperation({
    summary:
      'Resuelve manualmente un pago incierto: confirma el cobro, declara que no hubo cobro o registra un rechazo confirmado',
  })
  @ApiResponse({ status: 200, description: 'Pago conciliado; devuelve la venta actualizada' })
  @ApiResponse({ status: 400, description: 'La venta no requiere conciliación o faltan datos' })
  @ApiResponse({ status: 404, description: 'Venta no encontrada' })
  @ApiResponse({ status: 409, description: 'La venta ya está siendo conciliada o fue conciliada' })
  async conciliarPago(
    @CurrentUser() user: UsuarioAutenticado,
    @Param('id') id: string,
    @Body() dto: ConciliarPagoDto,
    @Req() req: Request,
  ) {
    const empresaId = user.empresaId as string;
    return this.ventasService.conciliarPago(empresaId, id, dto, {
      usuarioId: user.id,
      empresaId,
      ip: req.ip,
      userAgent: req.headers['user-agent'] || null,
    });
  }
}
