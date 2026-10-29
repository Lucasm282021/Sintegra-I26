import { Request } from 'express';
import { UsuarioAutenticado } from '../auth/authenticated-user.interface';

export interface RequestWithUser extends Request {
  user?: UsuarioAutenticado;
}
