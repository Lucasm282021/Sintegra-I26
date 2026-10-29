export type Rol = 'SUPERADMIN' | 'ADMIN';

export interface EmpresaAutenticada {
  id: string;
  nombre: string;
  estado: string;
  modulos: string[];
}

export interface UsuarioAutenticado {
  id: string;
  email: string;
  nombre: string | null;
  rol: Rol;
  empresaId: string | null;
  mustChangePassword: boolean;
  tokenVersion: number;
  empresa: EmpresaAutenticada | null;
}

export interface JwtPayload {
  sub: string;
  email: string;
  rol: Rol;
  empresa_id: string | null;
  token_version: number;
  iat: number;
  exp: number;
}
