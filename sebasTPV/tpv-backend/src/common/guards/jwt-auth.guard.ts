import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenService } from '../../modules/auth/token.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { UsuarioAutenticado } from '../auth/authenticated-user.interface';
import { RequestWithUser } from '../auth/request-with-user.interface';

const RUTAS_CAMBIO_PASSWORD = ['/auth/me', '/auth/change-password'];

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokenService: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const authorization = request.headers.authorization;
    if (!authorization || !authorization.startsWith('Bearer ')) {
      throw new UnauthorizedException('Se requiere autenticación');
    }

    const token = authorization.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException('Se requiere autenticación');
    }

    const payload = this.tokenService.verify(token);
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: payload.sub },
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

    if (usuario.tokenVersion !== payload.token_version) {
      throw new UnauthorizedException('La sesión fue invalidada');
    }

    if (usuario.rol !== 'SUPERADMIN' && usuario.rol !== 'ADMIN') {
      throw new UnauthorizedException('Rol no válido');
    }

    if (usuario.rol === 'ADMIN' && (!usuario.empresaId || !usuario.empresa)) {
      throw new ForbiddenException('La cuenta no tiene una empresa asociada');
    }

    if (usuario.empresa && usuario.empresa.estado !== 'ACTIVA') {
      throw new ForbiddenException('El acceso de la empresa está suspendido');
    }

    const user: UsuarioAutenticado = {
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol as 'SUPERADMIN' | 'ADMIN',
      empresaId: usuario.empresaId,
      mustChangePassword: usuario.mustChangePassword,
      tokenVersion: usuario.tokenVersion,
      empresa: usuario.empresa
        ? {
            id: usuario.empresa.id,
            nombre: usuario.empresa.nombre,
            estado: usuario.empresa.estado,
            modulos: (usuario.empresa.modulos || []).map((m) => m.modulo),
          }
        : null,
    };

    if (
      user.mustChangePassword &&
      !RUTAS_CAMBIO_PASSWORD.includes(request.path) &&
      !request.path.startsWith('/auth/change-password')
    ) {
      throw new ForbiddenException('Debe cambiar la contraseña temporal antes de continuar');
    }

    request.user = user;
    return true;
  }
}
