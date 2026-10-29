import { Controller, Get, Post, Body, Param, ParseIntPipe, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ProductosService } from './productos.service';
import { CreateProductoDto } from './dto/create-producto.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Modulo } from '../../common/decorators/modulo.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UsuarioAutenticado } from '../../common/auth/authenticated-user.interface';

@ApiTags('Productos')
@Controller('tpv/productos')
@Roles('ADMIN')
@Modulo('productos')
export class ProductosController {
  constructor(private readonly productosService: ProductosService) {}

  @Get()
  @ApiOperation({ summary: 'Obtiene los productos de la empresa autenticada' })
  findAll(@CurrentUser() user: UsuarioAutenticado) {
    return this.productosService.findAll(this.empresaId(user));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtiene un producto de la empresa autenticada por ID' })
  findOne(@CurrentUser() user: UsuarioAutenticado, @Param('id', ParseIntPipe) id: number) {
    return this.productosService.findOne(this.empresaId(user), id);
  }

  @Post()
  @ApiOperation({ summary: 'Crea un producto en la empresa autenticada' })
  create(@CurrentUser() user: UsuarioAutenticado, @Body() dto: CreateProductoDto) {
    return this.productosService.create(this.empresaId(user), dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Elimina un producto de la empresa autenticada' })
  remove(@CurrentUser() user: UsuarioAutenticado, @Param('id', ParseIntPipe) id: number) {
    return this.productosService.remove(this.empresaId(user), id);
  }

  private empresaId(user: UsuarioAutenticado): string {
    return user.empresaId;
  }
}
