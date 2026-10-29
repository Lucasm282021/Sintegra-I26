import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProductoDto } from './dto/create-producto.dto';

@Injectable()
export class ProductosService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(empresaId: string) {
    this.requireEmpresa(empresaId);
    return this.prisma.producto.findMany({
      where: { empresaId },
      orderBy: { id: 'asc' },
    });
  }

  async findOne(empresaId: string, id: number) {
    this.requireEmpresa(empresaId);
    const producto = await this.prisma.producto.findFirst({
      where: { id, empresaId },
    });
    if (!producto) {
      throw new NotFoundException(`Producto con ID ${id} no encontrado`);
    }
    return producto;
  }

  async create(empresaId: string, dto: CreateProductoDto) {
    this.requireEmpresa(empresaId);

    const codigo = dto.codigo?.trim() || null;
    if (codigo) {
      const existente = await this.prisma.producto.findFirst({
        where: { empresaId, codigo },
      });
      if (existente) {
        throw new ConflictException(`Ya existe un producto con el código ${codigo} en esta empresa`);
      }
    }

    try {
      return await this.prisma.producto.create({
        data: {
          empresaId,
          codigo,
          nombre: dto.nombre.trim(),
          descripcion: dto.descripcion?.trim() || null,
          precio: dto.precio,
          stock: dto.stock ?? 100,
          categoria: dto.categoria?.trim() || 'General',
          imagenUrl: dto.imagenUrl?.trim() || null,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ya existe un producto con ese código en esta empresa');
      }
      throw error;
    }
  }

  async remove(empresaId: string, id: number) {
    this.requireEmpresa(empresaId);
    await this.findOne(empresaId, id);

    try {
      return await this.prisma.producto.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new ConflictException('No se puede eliminar un producto con ventas asociadas');
      }
      throw error;
    }
  }

  private requireEmpresa(empresaId: string) {
    if (!empresaId) {
      throw new ForbiddenException('La cuenta no tiene una empresa asociada');
    }
  }
}
