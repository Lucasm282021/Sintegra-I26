import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PasswordService } from '../auth/password.service';
import { CreateEmpresaDto, MODULOS_DISPONIBLES } from './dto/create-empresa.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateEstadoDto } from './dto/update-estado.dto';
import { UpdateModulosDto } from './dto/update-modulos.dto';
import { QueryVentasDto } from './dto/query-ventas.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { formatVentaAnalitica } from '../ventas/venta.mapper';

@Injectable()
export class EmpresasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
  ) {}

  async create(dto: CreateEmpresaDto) {
    const adminEmail = dto.admin_email.trim().toLowerCase();
    const [cuitExistente, emailExistente] = await Promise.all([
      this.prisma.comercio.findUnique({ where: { cuit: dto.cuit } }),
      this.prisma.usuario.findUnique({ where: { email: adminEmail } }),
    ]);

    if (cuitExistente) {
      throw new ConflictException('Ya existe un comercio registrado con ese CUIT');
    }
    if (emailExistente) {
      throw new ConflictException('Ya existe un usuario registrado con ese email');
    }

    const modulos = dto.modulos && dto.modulos.length > 0 ? dto.modulos : [...MODULOS_DISPONIBLES];
    const passwordHash = await this.passwordService.hash(dto.admin_password);

    const resultado = await this.prisma.$transaction(async (tx) => {
      const empresa = await tx.empresa.create({
        data: {
          nombre: dto.nombre.trim(),
          modulos: {
            create: modulos.map((modulo) => ({ modulo })),
          },
        },
        include: { modulos: true },
      });

      const comercio = await tx.comercio.create({
        data: {
          empresaId: empresa.id,
          cuit: dto.cuit,
          razonSocial: dto.razon_social.trim(),
          direccion: dto.direccion?.trim() || null,
          rubro: dto.rubro?.trim() || null,
        },
      });

      const admin = await tx.usuario.create({
        data: {
          empresaId: empresa.id,
          email: adminEmail,
          passwordHash,
          nombre: dto.admin_nombre?.trim() || null,
          rol: 'ADMIN',
          mustChangePassword: true,
        },
      });

      return { empresa, comercio, admin };
    });

    return {
      empresa: this.safeEmpresa(resultado.empresa),
      comercio: resultado.comercio,
      admin: this.safeUser(resultado.admin),
    };
  }

  async findAll() {
    const empresas = await this.prisma.empresa.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        modulos: true,
        comercios: { select: { id: true, cuit: true, razonSocial: true, activo: true } },
        _count: { select: { usuarios: true, productos: true, ventas: true } },
      },
    });

    return empresas.map((empresa) => ({
      ...this.safeEmpresa(empresa),
      comercios: empresa.comercios,
      cantidad_usuarios: empresa._count.usuarios,
      cantidad_productos: empresa._count.productos,
      cantidad_ventas: empresa._count.ventas,
    }));
  }

  async findOne(id: string) {
    const empresa = await this.prisma.empresa.findUnique({
      where: { id },
      include: {
        modulos: true,
        comercios: true,
        usuarios: {
          select: {
            id: true,
            email: true,
            nombre: true,
            rol: true,
            activo: true,
            mustChangePassword: true,
            ultimoAcceso: true,
            createdAt: true,
          },
        },
        _count: { select: { productos: true, ventas: true } },
      },
    });

    if (!empresa) {
      throw new NotFoundException(`Empresa ${id} no encontrada`);
    }

    return {
      ...this.safeEmpresa(empresa),
      comercios: empresa.comercios,
      usuarios: empresa.usuarios.map((usuario) => ({
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        rol: usuario.rol,
        activo: usuario.activo,
        must_change_password: usuario.mustChangePassword,
        ultimo_acceso: usuario.ultimoAcceso,
        creado_en: usuario.createdAt,
      })),
      cantidad_productos: empresa._count.productos,
      cantidad_ventas: empresa._count.ventas,
    };
  }

  async updateEstado(id: string, dto: UpdateEstadoDto) {
    await this.ensureEmpresa(id);

    const empresa = await this.prisma.empresa.update({
      where: { id },
      data: { estado: dto.estado },
      include: { modulos: true },
    });

    if (dto.estado === 'SUSPENDIDA') {
      await this.prisma.usuario.updateMany({
        where: { empresaId: id, rol: 'ADMIN' },
        data: { tokenVersion: { increment: 1 } },
      });
    }

    return this.safeEmpresa(empresa);
  }

  async updateModulos(id: string, dto: UpdateModulosDto) {
    await this.ensureEmpresa(id);

    await this.prisma.$transaction(
      MODULOS_DISPONIBLES.map((modulo) =>
        this.prisma.empresaModulo.upsert({
          where: { empresaId_modulo: { empresaId: id, modulo } },
          update: { habilitado: dto.modulos.includes(modulo) },
          create: {
            empresaId: id,
            modulo,
            habilitado: dto.modulos.includes(modulo),
          },
        }),
      ),
    );

    const empresa = await this.prisma.empresa.findUniqueOrThrow({
      where: { id },
      include: { modulos: true },
    });

    return this.safeEmpresa(empresa);
  }

  async createAdmin(empresaId: string, dto: CreateAdminDto) {
    await this.ensureEmpresa(empresaId);

    const email = dto.email.trim().toLowerCase();
    const existente = await this.prisma.usuario.findUnique({ where: { email } });
    if (existente) {
      throw new ConflictException('Ya existe un usuario registrado con ese email');
    }

    const passwordHash = await this.passwordService.hash(dto.password);
    const admin = await this.prisma.usuario.create({
      data: {
        empresaId,
        email,
        passwordHash,
        nombre: dto.nombre?.trim() || null,
        rol: 'ADMIN',
        mustChangePassword: true,
      },
    });

    return this.safeUser(admin);
  }

  async resetAdminPassword(empresaId: string, adminId: string, dto: ResetPasswordDto) {
    await this.ensureEmpresa(empresaId);

    const admin = await this.prisma.usuario.findFirst({
      where: { id: adminId, empresaId, rol: 'ADMIN' },
    });
    if (!admin) {
      throw new NotFoundException(`Administrador ${adminId} no encontrado en la empresa`);
    }

    const passwordHash = await this.passwordService.hash(dto.password);
    const actualizado = await this.prisma.usuario.update({
      where: { id: admin.id },
      data: {
        passwordHash,
        mustChangePassword: true,
        tokenVersion: { increment: 1 },
      },
    });

    return this.safeUser(actualizado);
  }

  async resumen(empresaId: string) {
    const empresa = await this.ensureEmpresa(empresaId);

    const [
      cantidadVentas,
      sumaVentas,
      ventasPorEstado,
      cantidadProductos,
      cantidadComercios,
      ultimaVenta,
    ] = await Promise.all([
      this.prisma.venta.count({ where: { empresaId } }),
      this.prisma.venta.aggregate({
        where: { empresaId },
        _sum: { montoTotal: true },
      }),
      this.prisma.venta.groupBy({
        by: ['estado'],
        where: { empresaId },
        _count: { _all: true },
      }),
      this.prisma.producto.count({ where: { empresaId } }),
      this.prisma.comercio.count({ where: { empresaId } }),
      this.prisma.venta.findFirst({
        where: { empresaId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, idVentaExternal: true, estado: true, montoTotal: true, createdAt: true },
      }),
    ]);

    return {
      empresa: { id: empresa.id, nombre: empresa.nombre, estado: empresa.estado },
      cantidad_ventas: cantidadVentas,
      total_vendido: sumaVentas._sum.montoTotal || 0,
      ventas_por_estado: ventasPorEstado.map((item) => ({
        estado: item.estado,
        cantidad: item._count._all,
      })),
      cantidad_productos: cantidadProductos,
      cantidad_comercios: cantidadComercios,
      ultima_venta: ultimaVenta
        ? {
            id: ultimaVenta.idVentaExternal || String(ultimaVenta.id),
            estado: ultimaVenta.estado,
            total: ultimaVenta.montoTotal,
            fecha: ultimaVenta.createdAt,
          }
        : null,
    };
  }

  async findVentas(empresaId: string, query: QueryVentasDto) {
    await this.ensureEmpresa(empresaId);

    const page = query.page || 1;
    const limit = query.limit || 20;
    const where: any = { empresaId };

    if (query.estado) {
      where.estado = query.estado.toUpperCase();
    }
    if (query.medio_pago) {
      where.medioPago = query.medio_pago.toUpperCase();
    }
    if (query.desde || query.hasta) {
      where.createdAt = {};
      if (query.desde) {
        where.createdAt.gte = new Date(`${query.desde}T00:00:00.000Z`);
      }
      if (query.hasta) {
        where.createdAt.lte = new Date(`${query.hasta}T23:59:59.999Z`);
      }
    }

    const [total, ventas] = await Promise.all([
      this.prisma.venta.count({ where }),
      this.prisma.venta.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          comercio: true,
          items: { include: { producto: true } },
        },
      }),
    ]);

    return {
      items: ventas.map((venta) => formatVentaAnalitica(venta)),
      total,
      page,
      limit,
    };
  }

  async findVenta(empresaId: string, idOrExternal: string) {
    await this.ensureEmpresa(empresaId);

    let venta = null;
    if (!isNaN(Number(idOrExternal))) {
      venta = await this.prisma.venta.findFirst({
        where: { id: Number(idOrExternal), empresaId },
        include: { comercio: true, items: { include: { producto: true } } },
      });
    }

    if (!venta) {
      venta = await this.prisma.venta.findFirst({
        where: { idVentaExternal: idOrExternal, empresaId },
        include: { comercio: true, items: { include: { producto: true } } },
      });
    }

    if (!venta) {
      throw new NotFoundException(`Venta "${idOrExternal}" no encontrada en esta empresa`);
    }

    return formatVentaAnalitica(venta);
  }

  async findProductos(empresaId: string) {
    await this.ensureEmpresa(empresaId);
    return this.prisma.producto.findMany({
      where: { empresaId },
      orderBy: { id: 'asc' },
    });
  }

  async findComercios(empresaId: string) {
    await this.ensureEmpresa(empresaId);
    return this.prisma.comercio.findMany({
      where: { empresaId },
      orderBy: { id: 'asc' },
    });
  }

  private async ensureEmpresa(id: string) {
    const empresa = await this.prisma.empresa.findUnique({ where: { id } });
    if (!empresa) {
      throw new NotFoundException(`Empresa ${id} no encontrada`);
    }
    return empresa;
  }

  private safeUser(usuario: any) {
    return {
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol,
      empresa_id: usuario.empresaId,
      activo: usuario.activo,
      must_change_password: usuario.mustChangePassword,
      ultimo_acceso: usuario.ultimoAcceso,
    };
  }

  private safeEmpresa(empresa: any) {
    const modulos = (empresa.modulos || [])
      .filter((modulo: any) => modulo.habilitado)
      .map((modulo: any) => modulo.modulo);

    return {
      id: empresa.id,
      nombre: empresa.nombre,
      estado: empresa.estado,
      modulos,
      creada_en: empresa.createdAt,
      actualizada_en: empresa.updatedAt,
    };
  }
}
