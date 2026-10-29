import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { RequestWithUser } from '../auth/request-with-user.interface';

@Injectable()
export class EmpresaActivaGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    if (!user) {
      return true;
    }

    if (user.rol === 'ADMIN') {
      if (!user.empresa || user.empresa.estado !== 'ACTIVA') {
        throw new ForbiddenException('El acceso de la empresa está suspendido');
      }
    }

    return true;
  }
}
