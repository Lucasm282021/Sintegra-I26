import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { EmpresasService } from './empresas.service';
import { CreateEmpresaDto } from './dto/create-empresa.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateEstadoDto } from './dto/update-estado.dto';
import { UpdateModulosDto } from './dto/update-modulos.dto';
import { QueryVentasDto } from './dto/query-ventas.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UsuarioAutenticado } from '../../common/auth/authenticated-user.interface';
import { AuditoriaService } from '../auditoria/auditoria.service';

@ApiTags('Admin - Empresas')
@Controller('admin/empresas')
@Roles('SUPERADMIN')
export class EmpresasController {
  constructor(
    private readonly empresasService: EmpresasService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lista todas las empresas' })
  findAll() {
    return this.empresasService.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Crea una empresa, su comercio fiscal y su admin' })
  create(@Body() dto: CreateEmpresaDto) {
    return this.empresasService.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una empresa' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: UsuarioAutenticado,
    @Req() req: Request,
  ) {
    await this.audit(user, id, 'CONSULTA_SUPERADMIN', 'empresa', id, req);
    return this.empresasService.findOne(id);
  }

  @Patch(':id/estado')
  @ApiOperation({ summary: 'Activa o suspende una empresa' })
  updateEstado(@Param('id') id: string, @Body() dto: UpdateEstadoDto) {
    return this.empresasService.updateEstado(id, dto);
  }

  @Put(':id/modulos')
  @ApiOperation({ summary: 'Configura los módulos habilitados de una empresa' })
  updateModulos(@Param('id') id: string, @Body() dto: UpdateModulosDto) {
    return this.empresasService.updateModulos(id, dto);
  }

  @Post(':id/admins')
  @ApiOperation({ summary: 'Crea un administrador para la empresa' })
  createAdmin(@Param('id') id: string, @Body() dto: CreateAdminDto) {
    return this.empresasService.createAdmin(id, dto);
  }

  @Post(':id/admins/:adminId/reset-password')
  @ApiOperation({ summary: 'Asigna una contraseña temporal a un admin de la empresa' })
  resetAdminPassword(
    @Param('id') id: string,
    @Param('adminId') adminId: string,
    @Body() dto: ResetPasswordDto,
  ) {
    return this.empresasService.resetAdminPassword(id, adminId, dto);
  }

  @Get(':id/resumen')
  @ApiOperation({ summary: 'Métricas agregadas de la empresa, solo lectura' })
  async resumen(
    @Param('id') id: string,
    @CurrentUser() user: UsuarioAutenticado,
    @Req() req: Request,
  ) {
    await this.audit(user, id, 'CONSULTA_SUPERADMIN', 'resumen', id, req);
    return this.empresasService.resumen(id);
  }

  @Get(':id/ventas')
  @ApiOperation({ summary: 'Ventas de la empresa, solo lectura y auditadas' })
  async findVentas(
    @Param('id') id: string,
    @Query() query: QueryVentasDto,
    @CurrentUser() user: UsuarioAutenticado,
    @Req() req: Request,
  ) {
    await this.audit(user, id, 'CONSULTA_SUPERADMIN', 'ventas', id, req);
    return this.empresasService.findVentas(id, query);
  }

  @Get(':id/ventas/:ventaId')
  @ApiOperation({ summary: 'Detalle de una venta de la empresa, solo lectura y auditado' })
  async findVenta(
    @Param('id') id: string,
    @Param('ventaId') ventaId: string,
    @CurrentUser() user: UsuarioAutenticado,
    @Req() req: Request,
  ) {
    await this.audit(user, id, 'CONSULTA_SUPERADMIN', 'venta', ventaId, req);
    return this.empresasService.findVenta(id, ventaId);
  }

  @Get(':id/productos')
  @ApiOperation({ summary: 'Productos de la empresa, solo lectura y auditados' })
  async findProductos(
    @Param('id') id: string,
    @CurrentUser() user: UsuarioAutenticado,
    @Req() req: Request,
  ) {
    await this.audit(user, id, 'CONSULTA_SUPERADMIN', 'productos', id, req);
    return this.empresasService.findProductos(id);
  }

  @Get(':id/comercios')
  @ApiOperation({ summary: 'Comercios de la empresa, solo lectura y auditados' })
  async findComercios(
    @Param('id') id: string,
    @CurrentUser() user: UsuarioAutenticado,
    @Req() req: Request,
  ) {
    await this.audit(user, id, 'CONSULTA_SUPERADMIN', 'comercios', id, req);
    return this.empresasService.findComercios(id);
  }

  private audit(
    user: UsuarioAutenticado,
    empresaId: string,
    accion: string,
    recurso: string,
    recursoId: string | null,
    req: Request,
  ) {
    return this.auditoriaService.registrar({
      usuarioId: user.id,
      empresaId,
      accion,
      recurso,
      recursoId,
      ip: req.ip,
      userAgent: req.headers['user-agent'] || null,
    });
  }
}
