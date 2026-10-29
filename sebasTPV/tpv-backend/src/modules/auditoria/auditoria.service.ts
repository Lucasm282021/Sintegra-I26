import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface RegistrarAuditoriaInput {
  usuarioId: string;
  empresaId: string;
  accion: string;
  recurso: string;
  recursoId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  resultado?: string | null;
  detalle?: string | null;
}

@Injectable()
export class AuditoriaService {
  private readonly logger = new Logger(AuditoriaService.name);

  constructor(private readonly prisma: PrismaService) {}

  async registrar(
    input: RegistrarAuditoriaInput,
    tx?: Prisma.TransactionClient,
  ) {
    try {
      const client = tx || this.prisma;
      return await client.auditoriaAcceso.create({
        data: {
          usuarioId: input.usuarioId,
          empresaId: input.empresaId,
          accion: input.accion,
          recurso: input.recurso,
          recursoId: input.recursoId || null,
          ip: input.ip || null,
          userAgent: input.userAgent || null,
          resultado: input.resultado || null,
          detalle: input.detalle || null,
        },
      });
    } catch (error: any) {
      this.logger.error(`No se pudo registrar la auditoría: ${error?.message || error}`);
      throw error;
    }
  }
}
