import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateComercioDto } from './dto/create-comercio.dto';

@Injectable()
export class ComerciosService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(empresaId: string) {
    this.requireEmpresa(empresaId);
    return this.prisma.comercio.findMany({
      where: { empresaId },
      orderBy: { id: 'asc' },
    });
  }

  async findByCuit(empresaId: string, cuit: string) {
    this.requireEmpresa(empresaId);
    const comercio = await this.prisma.comercio.findFirst({
      where: { cuit, empresaId },
    });
    if (!comercio) {
      throw new NotFoundException(`Comercio con CUIT ${cuit} no encontrado`);
    }
    return comercio;
  }

  async create(empresaId: string, dto: CreateComercioDto) {
    this.requireEmpresa(empresaId);

    const existe = await this.prisma.comercio.findUnique({
      where: { cuit: dto.cuit },
    });
    if (existe) {
      throw new ConflictException(`Ya existe un comercio registrado con el CUIT ${dto.cuit}`);
    }

    return this.prisma.comercio.create({
      data: {
        empresaId,
        cuit: dto.cuit,
        razonSocial: dto.razonSocial,
        direccion: dto.direccion?.trim() || null,
        rubro: dto.rubro?.trim() || null,
      },
    });
  }

  private requireEmpresa(empresaId: string) {
    if (!empresaId) {
      throw new ForbiddenException('La cuenta no tiene una empresa asociada');
    }
  }
}
