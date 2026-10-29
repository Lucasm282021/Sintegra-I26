import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UsuarioAutenticado } from '../../common/auth/authenticated-user.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
  ) {}

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const usuario = await this.prisma.usuario.findUnique({
      where: { email },
      include: {
        empresa: {
          include: {
            modulos: { where: { habilitado: true }, orderBy: { modulo: 'asc' } },
          },
        },
      },
    });

    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const passwordOk = await this.passwordService.verify(dto.password, usuario.passwordHash);
    if (!passwordOk) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (usuario.rol === 'ADMIN' && (!usuario.empresaId || !usuario.empresa)) {
      throw new ForbiddenException('La cuenta no tiene una empresa asociada');
    }

    if (usuario.empresa && usuario.empresa.estado !== 'ACTIVA') {
      throw new ForbiddenException('El acceso de la empresa está suspendido');
    }

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { ultimoAcceso: new Date() },
    });

    const signed = this.tokenService.sign({
      sub: usuario.id,
      email: usuario.email,
      rol: usuario.rol as 'SUPERADMIN' | 'ADMIN',
      empresa_id: usuario.empresaId,
      token_version: usuario.tokenVersion,
    });

    return {
      access_token: signed.token,
      token_type: 'Bearer',
      expires_in: signed.expiresIn,
      usuario: this.safeUser(usuario),
      empresa: usuario.empresa ? this.safeEmpresa(usuario.empresa) : null,
    };
  }

  async me(user: UsuarioAutenticado) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: user.id },
      include: {
        empresa: {
          include: {
            modulos: { where: { habilitado: true }, orderBy: { modulo: 'asc' } },
          },
        },
      },
    });

    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('Usuario no disponible');
    }

    return {
      usuario: this.safeUser(usuario),
      empresa: usuario.empresa ? this.safeEmpresa(usuario.empresa) : null,
    };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    if (dto.current_password === dto.new_password) {
      throw new BadRequestException('La nueva contraseña debe ser distinta de la actual');
    }

    const usuario = await this.prisma.usuario.findUnique({ where: { id: userId } });
    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('Usuario no disponible');
    }

    const passwordOk = await this.passwordService.verify(dto.current_password, usuario.passwordHash);
    if (!passwordOk) {
      throw new BadRequestException('La contraseña actual no es correcta');
    }

    const passwordHash = await this.passwordService.hash(dto.new_password);
    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        passwordHash,
        mustChangePassword: false,
        tokenVersion: { increment: 1 },
      },
    });

    return { message: 'Contraseña actualizada. Inicie sesión nuevamente.' };
  }

  private safeUser(usuario: any) {
    return {
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol,
      empresa_id: usuario.empresaId,
      must_change_password: usuario.mustChangePassword,
    };
  }

  private safeEmpresa(empresa: any) {
    return {
      id: empresa.id,
      nombre: empresa.nombre,
      estado: empresa.estado,
      modulos: (empresa.modulos || []).filter((m: any) => m.habilitado).map((m: any) => m.modulo),
    };
  }
}
