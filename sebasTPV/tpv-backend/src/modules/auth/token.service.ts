import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { JwtPayload, Rol } from '../../common/auth/authenticated-user.interface';

interface SignPayload {
  sub: string;
  email: string;
  rol: Rol;
  empresa_id: string | null;
  token_version: number;
}

function base64UrlJson(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly secret: string;
  private readonly ttlSeconds: number;

  constructor() {
    const configuredSecret = process.env.JWT_SECRET;
    if (!configuredSecret && process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET es obligatorio en producción');
    }

    this.secret = configuredSecret || 'dev-insecure-secret-change-me';
    if (!configuredSecret) {
      this.logger.warn('JWT_SECRET no está definido; se usa un secreto inseguro solo para desarrollo local');
    }

    const configuredTtl = Number(process.env.AUTH_TOKEN_TTL_SECONDS || 7200);
    this.ttlSeconds = Number.isFinite(configuredTtl) && configuredTtl > 0 ? configuredTtl : 7200;
  }

  sign(payload: SignPayload): { token: string; expiresIn: number } {
    const now = Math.floor(Date.now() / 1000);
    const fullPayload: JwtPayload = {
      ...payload,
      iat: now,
      exp: now + this.ttlSeconds,
    };

    const header = base64UrlJson({ alg: 'HS256', typ: 'JWT' });
    const body = base64UrlJson(fullPayload);
    const signature = createHmac('sha256', this.secret)
      .update(`${header}.${body}`)
      .digest('base64url');

    return {
      token: `${header}.${body}.${signature}`,
      expiresIn: this.ttlSeconds,
    };
  }

  verify(token: string): JwtPayload {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new UnauthorizedException('Token inválido');
    }

    const [header, body, signature] = parts;
    const expectedSignature = createHmac('sha256', this.secret)
      .update(`${header}.${body}`)
      .digest('base64url');

    const received = Buffer.from(signature);
    const expected = Buffer.from(expectedSignature);
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
      throw new UnauthorizedException('Token inválido');
    }

    let payload: JwtPayload;
    try {
      payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as JwtPayload;
    } catch {
      throw new UnauthorizedException('Token inválido');
    }

    if (!payload || typeof payload.sub !== 'string' || typeof payload.exp !== 'number') {
      throw new UnauthorizedException('Token inválido');
    }

    if (payload.exp <= Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException('Token expirado');
    }

    return payload;
  }
}
