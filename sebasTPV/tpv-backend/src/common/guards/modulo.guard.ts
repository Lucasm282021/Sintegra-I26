import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MODULO_KEY } from '../decorators/modulo.decorator';
import { RequestWithUser } from '../auth/request-with-user.interface';

@Injectable()
export class ModuloGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const modulo = this.reflector.getAllAndOverride<string>(MODULO_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!modulo) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Se requiere autenticación');
    }

    if (user.rol === 'SUPERADMIN') {
      return true;
    }

    if (!user.empresa || !user.empresa.modulos.includes(modulo)) {
      throw new ForbiddenException(`El módulo "${modulo}" no está habilitado para esta empresa`);
    }

    return true;
  }
}
