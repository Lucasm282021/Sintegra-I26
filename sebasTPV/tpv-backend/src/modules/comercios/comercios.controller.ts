import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ComerciosService } from './comercios.service';
import { CreateComercioDto } from './dto/create-comercio.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Modulo } from '../../common/decorators/modulo.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UsuarioAutenticado } from '../../common/auth/authenticated-user.interface';

@ApiTags('Comercios')
@Controller('tpv/comercios')
@Roles('ADMIN')
@Modulo('comercios')
export class ComerciosController {
  constructor(private readonly comerciosService: ComerciosService) {}

  @Get()
  @ApiOperation({ summary: 'Obtiene los comercios de la empresa autenticada' })
  findAll(@CurrentUser() user: UsuarioAutenticado) {
    return this.comerciosService.findAll(user.empresaId);
  }

  @Get(':cuit')
  @ApiOperation({ summary: 'Obtiene un comercio de la empresa autenticada por CUIT' })
  findByCuit(@CurrentUser() user: UsuarioAutenticado, @Param('cuit') cuit: string) {
    return this.comerciosService.findByCuit(user.empresaId, cuit);
  }

  @Post()
  @ApiOperation({ summary: 'Registra un comercio dentro de la empresa autenticada' })
  create(@CurrentUser() user: UsuarioAutenticado, @Body() dto: CreateComercioDto) {
    return this.comerciosService.create(user.empresaId, dto);
  }
}
