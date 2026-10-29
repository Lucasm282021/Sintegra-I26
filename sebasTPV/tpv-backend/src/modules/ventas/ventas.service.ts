import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { IntegracionesService } from '../integraciones/integraciones.service';
import { PagoRechazadoError } from '../integraciones/pago-errors';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { CreateVentaDto } from './dto/create-venta.dto';
import {
  ConciliarPagoDto,
  ResultadoConciliacion,
} from './dto/conciliar-pago.dto';
import { formatVentaResponse } from './venta.mapper';
import {
  ESTADO_COMPLETADA,
  ESTADO_ERROR_RECUPERABLE,
  ESTADO_PENDIENTE,
  ETAPA_ARBA,
  ETAPA_ARCA,
  ETAPA_CONCILIACION_PAGO,
  ETAPA_MUNICIPIO,
  ETAPA_PAGO,
  ETAPA_PAGO_EN_CURSO,
  esVentaEnConciliacionPago,
} from './venta-estados';

export interface ContextoAuditoriaConciliacion {
  usuarioId: string;
  empresaId: string;
  ip?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class VentasService {
  private readonly logger = new Logger(VentasService.name);
  private readonly lockTtlMs: number;

  private readonly includeVenta = {
    comercio: true,
    items: { include: { producto: true } },
  } as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly integracionesService: IntegracionesService,
    private readonly auditoriaService: AuditoriaService,
  ) {
    const configuredTtl = Number(process.env.VENTA_LOCK_TTL_MS || 30000);
    this.lockTtlMs = Number.isFinite(configuredTtl) && configuredTtl > 0 ? configuredTtl : 30000;
  }

  async create(empresaId: string, dto: CreateVentaDto) {
    this.requireEmpresa(empresaId);

    // 1. Validar id_venta OBLIGATORIO
    const idVentaExternal = dto.getIdVenta();
    if (!idVentaExternal) {
      throw new BadRequestException(
        'id_venta es obligatorio y debe ser un identificador único asignado por la terminal',
      );
    }

    // 2. Validar CUIT del comercio
    const cuit = dto.getCuit();
    if (!cuit || cuit.length !== 11) {
      throw new BadRequestException(
        'comercio_cuit debe ser un string de 11 dígitos numéricos sin puntos ni guiones',
      );
    }

    // 3. Si la venta ya existe, se usan exclusivamente sus datos persistidos.
    // No se recalculan precios ni se modifican líneas con el request repetido.
    const ventaExistente = await this.buscarVentaPorIdExterno(idVentaExternal);
    if (ventaExistente) {
      return this.ejecutarVentaExistente(ventaExistente, empresaId, cuit);
    }

    // 4. Venta nueva: validar comercio, medio de pago, productos y stock.
    const medioPago = dto.getMedioPago();
    await this.validarComercioDeEmpresa(empresaId, cuit);
    this.validarDatosPago(medioPago, dto);

    const { subtotal, detalles } = await this.calcularDetalles(empresaId, dto.items);

    let venta: any;
    try {
      venta = await this.prisma.venta.create({
        data: {
          idVentaExternal,
          empresaId,
          cuit,
          medioPago,
          cuentaOrigen: dto.getCuentaOrigen() || null,
          cuentaDestino: dto.getCuentaDestino() || null,
          cuitPagador: dto.getCuitPagador() || null,
          subtotal,
          percepcionArba: 0,
          montoTotal: subtotal,
          estado: ESTADO_PENDIENTE,
          etapaPendiente: ETAPA_MUNICIPIO,
          items: { create: detalles },
        },
        include: this.includeVenta,
      });
    } catch (error) {
      // Carrera entre dos procesos: otro creó la venta con el mismo id_venta.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const concurrente = await this.buscarVentaPorIdExterno(idVentaExternal);
        if (!concurrente) {
          throw error;
        }
        return this.ejecutarVentaExistente(concurrente, empresaId, cuit);
      }
      throw error;
    }

    return this.ejecutarConLock(venta);
  }

  /**
   * Reintento de una venta existente. La única validación que se hace contra
   * el request es que el CUIT coincida. Los importes, líneas, cuentas y
   * referencias salen de la base.
   */
  private async ejecutarVentaExistente(venta: any, empresaId: string, cuit: string) {
    this.validarVentaExistente(venta, empresaId, cuit);

    if (venta.estado === ESTADO_COMPLETADA) {
      this.logger.log(
        `[IDEMPOTENCIA] Venta "${venta.idVentaExternal}" ya fue COMPLETADA anteriormente.`,
      );
      return formatVentaResponse(venta);
    }

    if (esVentaEnConciliacionPago(venta)) {
      throw new ConflictException(
        'La venta está pendiente de conciliación de pago. No se reintenta automáticamente; use la conciliación de pago.',
      );
    }

    return this.ejecutarConLock(venta);
  }

  private async ejecutarConLock(ventaInicial: any) {
    const lockToken = await this.adquirirLock(ventaInicial.id);

    try {
      let venta = await this.obtenerVenta(ventaInicial.id);

      if (venta.estado === ESTADO_COMPLETADA) {
        return formatVentaResponse(venta);
      }

      if (esVentaEnConciliacionPago(venta)) {
        throw new ConflictException(
          'La venta está pendiente de conciliación de pago. No se reintenta automáticamente; use la conciliación de pago.',
        );
      }

      // Si el proceso anterior murió mientras intentaba cobrar, no sabemos si
      // el proveedor alcanzó a cobrar. Se bloquea para conciliación manual.
      if (venta.etapaPendiente === ETAPA_PAGO_EN_CURSO) {
        const detalle = this.mensajePagoIndeterminado(
          venta,
          'El proceso anterior se interrumpió mientras se intentaba cobrar',
        );
        await this.actualizarVenta(venta.id, {
          estado: ESTADO_PENDIENTE,
          etapaPendiente: ETAPA_CONCILIACION_PAGO,
          errorDetalle: detalle,
        });
        throw new ConflictException(
          'El pago quedó pendiente de conciliación porque no pudo confirmarse. No se volverá a cobrar automáticamente.',
        );
      }

      venta = await this.procesarEtapas(venta);
      return formatVentaResponse(venta);
    } finally {
      await this.liberarLock(ventaInicial.id, lockToken);
    }
  }

  private async procesarEtapas(venta: any): Promise<any> {
    if (venta.etapaPendiente === ETAPA_MUNICIPIO) {
      try {
        await this.integracionesService.validarComercioMunicipio(venta.cuit);
      } catch (error) {
        await this.marcarErrorEtapa(venta.id, ETAPA_MUNICIPIO, error);
        throw this.normalizarError(error);
      }

      venta = await this.actualizarVenta(venta.id, {
        estado: ESTADO_PENDIENTE,
        etapaPendiente: ETAPA_ARBA,
        errorDetalle: null,
      });
    }

    if (venta.etapaPendiente === ETAPA_ARBA) {
      // No repetir una etapa ya completada: si ya hay percepción persistida,
      // solo se avanza a pago usando los importes guardados.
      if (venta.arbaPercepcionId) {
        venta = await this.actualizarVenta(venta.id, {
          estado: ESTADO_PENDIENTE,
          etapaPendiente: ETAPA_PAGO,
          errorDetalle: null,
        });
      } else {
        try {
          const resArba = await this.integracionesService.calcularPercepcionArba({
            cuit: venta.cuit,
            montoVenta: venta.subtotal,
            idVenta: venta.idVentaExternal || String(venta.id),
          });

          const percepcionArba = resArba.montoPercepcion || 0;
          const totalConPercepcion =
            Math.round((venta.subtotal + percepcionArba) * 100) / 100;

          venta = await this.actualizarVenta(venta.id, {
            arbaPercepcionId: resArba.percepcionId,
            percepcionArba,
            montoTotal: totalConPercepcion,
            estado: ESTADO_PENDIENTE,
            etapaPendiente: ETAPA_PAGO,
            errorDetalle: null,
          });
        } catch (error) {
          await this.marcarErrorEtapa(venta.id, ETAPA_ARBA, error);
          throw this.normalizarError(error);
        }
      }
    }

    if (venta.etapaPendiente === ETAPA_PAGO) {
      venta = await this.procesarPago(venta);
    }

    if (venta.etapaPendiente === ETAPA_ARCA) {
      venta = await this.procesarArca(venta);
    }

    if (venta.estado === ESTADO_COMPLETADA) {
      return venta;
    }

    throw new ConflictException(
      `La venta quedó en un estado no procesable (${venta.estado}/${venta.etapaPendiente || 'sin etapa'})`,
    );
  }

  private async procesarPago(venta: any): Promise<any> {
    // Si ya hay una referencia persistida, el cobro está confirmado. Se
    // continúa con ARCA sin volver a llamar al proveedor de pago.
    if (venta.bancoTransaccionId || venta.billeteraTransaccionId) {
      return this.actualizarVenta(venta.id, {
        estado: ESTADO_PENDIENTE,
        etapaPendiente: ETAPA_ARCA,
        errorDetalle: null,
      });
    }

    // El efectivo no se cobra a través de un proveedor externo. Se avanza a
    // ARCA sin inventar una referencia bancaria ni llamar a BANCO/BILLETERA.
    if (venta.medioPago === 'EFECTIVO') {
      return this.actualizarVenta(venta.id, {
        estado: ESTADO_PENDIENTE,
        etapaPendiente: ETAPA_ARCA,
        errorDetalle: null,
      });
    }

    if (venta.medioPago === 'BILLETERA' && !venta.cuitPagador) {
      const mensaje = 'La venta no tiene cuit_pagador persistido para reintentar el cobro por BILLETERA';
      await this.marcarErrorEtapa(venta.id, ETAPA_PAGO, new Error(mensaje));
      throw new BadRequestException(mensaje);
    }

    if (venta.medioPago !== 'BILLETERA' && (!venta.cuentaOrigen || !venta.cuentaDestino)) {
      const mensaje =
        'La venta no tiene cuenta_origen y cuenta_destino persistidas para reintentar el cobro por BANCO';
      await this.marcarErrorEtapa(venta.id, ETAPA_PAGO, new Error(mensaje));
      throw new BadRequestException(mensaje);
    }

    // Marca persistida ANTES de llamar al proveedor. Si el proceso se cae
    // durante el cobro, el reintento verá este estado y no volverá a cobrar.
    await this.actualizarVenta(venta.id, {
      etapaPendiente: ETAPA_PAGO_EN_CURSO,
      errorDetalle: null,
    });

    let resPago: { transaccionId: string; estado?: string };
    try {
      if (venta.medioPago === 'BILLETERA') {
        resPago = await this.integracionesService.procesarPagoBilletera({
          cuitComercio: venta.cuit,
          monto: venta.montoTotal,
          cuitPagador: venta.cuitPagador,
          idVenta: venta.idVentaExternal || String(venta.id),
        });
      } else {
        resPago = await this.integracionesService.procesarPagoBanco({
          cuit: venta.cuit,
          monto: venta.montoTotal,
          cuentaOrigen: venta.cuentaOrigen,
          cuentaDestino: venta.cuentaDestino,
          idVenta: venta.idVentaExternal || String(venta.id),
        });
      }
    } catch (error: any) {
      if (error instanceof PagoRechazadoError) {
        await this.actualizarVenta(venta.id, {
          estado: ESTADO_ERROR_RECUPERABLE,
          etapaPendiente: ETAPA_PAGO,
          errorDetalle: error.message,
        });
        throw new BadRequestException(error.message);
      }

      // PagoIndeterminadoError o cualquier error no clasificado durante el
      // cobro: es inseguro reintentar. Queda bloqueado para conciliación.
      const detalle = this.mensajePagoIndeterminado(
        venta,
        error?.message || 'Error desconocido durante el cobro',
      );
      await this.actualizarVenta(venta.id, {
        estado: ESTADO_PENDIENTE,
        etapaPendiente: ETAPA_CONCILIACION_PAGO,
        errorDetalle: detalle,
      });
      this.logger.error(
        `Pago indeterminado para venta "${venta.idVentaExternal || venta.id}": ${detalle}`,
      );
      throw new ConflictException(
        'El pago quedó pendiente de conciliación porque no pudo confirmarse. No se volverá a cobrar automáticamente.',
      );
    }

    const transaccionId = String(resPago.transaccionId || '').trim();
    if (!transaccionId) {
      const detalle = this.mensajePagoIndeterminado(
        venta,
        'El proveedor respondió sin una referencia de pago',
      );
      await this.actualizarVenta(venta.id, {
        estado: ESTADO_PENDIENTE,
        etapaPendiente: ETAPA_CONCILIACION_PAGO,
        errorDetalle: detalle,
      });
      throw new ConflictException(
        'El pago quedó pendiente de conciliación porque no pudo confirmarse. No se volverá a cobrar automáticamente.',
      );
    }

    const dataPago: any = {
      estado: ESTADO_PENDIENTE,
      etapaPendiente: ETAPA_ARCA,
      errorDetalle: null,
    };
    if (venta.medioPago === 'BILLETERA') {
      dataPago.billeteraTransaccionId = transaccionId;
    } else {
      dataPago.bancoTransaccionId = transaccionId;
    }

    return this.actualizarVenta(venta.id, dataPago);
  }

  private async procesarArca(venta: any): Promise<any> {
    // Si el CAE ya está persistido, la factura ya se emitió. No se repite ARCA
    // ni se vuelve a descontar stock.
    if (venta.cae) {
      return this.actualizarVenta(venta.id, {
        estado: ESTADO_COMPLETADA,
        etapaPendiente: null,
        errorDetalle: null,
      });
    }

    try {
      const resArca = await this.integracionesService.emitirFacturaArca({
        cuit: venta.cuit,
        total: venta.montoTotal,
        cantItems: venta.items.length,
        idVenta: venta.idVentaExternal || String(venta.id),
      });

      if (!resArca.cae) {
        throw new Error('ARCA no devolvió un CAE; la facturación no puede confirmarse');
      }

      await this.prisma.$transaction(async (tx) => {
        for (const item of venta.items) {
          await tx.producto.update({
            where: { id: item.productoId },
            data: { stock: { decrement: item.cantidad } },
          });
        }

        await tx.venta.update({
          where: { id: venta.id },
          data: {
            estado: ESTADO_COMPLETADA,
            etapaPendiente: null,
            cae: resArca.cae,
            comprobanteNumero: resArca.numeroComprobante,
            fechaVencimientoCae: resArca.fechaVencimientoCae,
            tipoComprobante: resArca.tipoComprobante || 'FACTURA_B',
            arcaComprobanteId: resArca.numeroComprobante,
            errorDetalle: null,
          },
        });
      });

      return this.obtenerVenta(venta.id);
    } catch (error) {
      await this.marcarErrorEtapa(venta.id, ETAPA_ARCA, error);
      throw this.normalizarError(error);
    }
  }

  async conciliarPago(
    empresaId: string,
    idOrExternal: string | number,
    dto: ConciliarPagoDto,
    contexto: ContextoAuditoriaConciliacion,
  ) {
    try {
      return await this.conciliarPagoInterno(empresaId, idOrExternal, dto, contexto);
    } catch (error) {
      await this.auditarConciliacionFallida(
        empresaId,
        idOrExternal,
        contexto,
        error,
      );
      throw error;
    }
  }

  private async conciliarPagoInterno(
    empresaId: string,
    idOrExternal: string | number,
    dto: ConciliarPagoDto,
    contexto: ContextoAuditoriaConciliacion,
  ) {
    this.requireEmpresa(empresaId);

    const resultado = dto?.resultado;
    const resultadosValidos: ResultadoConciliacion[] = [
      'CONFIRMADO',
      'NO_COBRADO',
      'RECHAZADO',
    ];
    if (!resultado || !resultadosValidos.includes(resultado)) {
      throw new BadRequestException(
        'resultado debe ser CONFIRMADO, NO_COBRADO o RECHAZADO',
      );
    }

    const observacion = typeof dto.observacion === 'string' ? dto.observacion.trim() : '';
    if (!observacion) {
      throw new BadRequestException('observacion es obligatoria');
    }
    if (observacion.length > 500) {
      throw new BadRequestException('observacion no puede superar los 500 caracteres');
    }

    // Se valida la presencia de la propiedad, no solo el valor recortado:
    // null, cadena vacía o solo espacios también cuentan como envío.
    const transaccionEnviada = dto.transaccion_id !== undefined;
    const transaccionId =
      typeof dto.transaccion_id === 'string' ? dto.transaccion_id.trim() : '';
    if (resultado === 'CONFIRMADO') {
      if (!transaccionEnviada || !transaccionId) {
        throw new BadRequestException(
          'transaccion_id debe ser un string no vacío cuando el resultado es CONFIRMADO',
        );
      }
    } else if (transaccionEnviada) {
      throw new BadRequestException(
        'transaccion_id solo se permite cuando el resultado es CONFIRMADO',
      );
    }

    const venta = await this.buscarVentaPorIdOrExternal(empresaId, idOrExternal);
    if (!venta) {
      throw new NotFoundException(`Venta "${idOrExternal}" no encontrada`);
    }
    if (!esVentaEnConciliacionPago(venta)) {
      throw new BadRequestException('La venta no está pendiente de conciliación de pago');
    }
    if (!['BANCO', 'BILLETERA'].includes(venta.medioPago)) {
      throw new BadRequestException(
        'Solo se pueden conciliar ventas pagadas por BANCO o BILLETERA',
      );
    }

    const lockToken = await this.adquirirLock(venta.id);
    try {
      const actual = await this.obtenerVenta(venta.id);
      if (!esVentaEnConciliacionPago(actual)) {
        throw new ConflictException('La venta ya fue conciliada por otra solicitud');
      }
      if (!['BANCO', 'BILLETERA'].includes(actual.medioPago)) {
        throw new BadRequestException(
          'Solo se pueden conciliar ventas pagadas por BANCO o BILLETERA',
        );
      }

      const observacionSanitizada = this.sanitizarObservacionConciliacion(
        observacion,
        [
          actual.cuentaOrigen,
          actual.cuentaDestino,
          actual.cuitPagador,
          transaccionId,
        ],
      );

      const data: Prisma.VentaUpdateInput = {
        estado:
          resultado === 'RECHAZADO'
            ? ESTADO_ERROR_RECUPERABLE
            : ESTADO_PENDIENTE,
        etapaPendiente: resultado === 'CONFIRMADO' ? ETAPA_ARCA : ETAPA_PAGO,
        errorDetalle: this.detalleConciliacion(resultado),
        observacionConciliacion: observacionSanitizada,
        bancoTransaccionId: null,
        billeteraTransaccionId: null,
      };

      if (resultado === 'CONFIRMADO') {
        if (actual.medioPago === 'BILLETERA') {
          data.billeteraTransaccionId = transaccionId;
        } else {
          data.bancoTransaccionId = transaccionId;
        }
      }

      const actualizada = await this.prisma.$transaction(async (tx) => {
        const ventaActualizada = await tx.venta.update({
          where: { id: actual.id },
          data,
          include: this.includeVenta,
        });

        // La auditoría exitosa comparte la transacción con el cambio de venta.
        await this.auditoriaService.registrar(
          {
            usuarioId: contexto.usuarioId,
            empresaId,
            accion: 'CONCILIACION_PAGO',
            recurso: 'venta',
            recursoId: actual.idVentaExternal || String(actual.id),
            ip: contexto.ip || null,
            userAgent: contexto.userAgent || null,
            resultado,
            detalle: this.detalleConciliacion(resultado),
          },
          tx,
        );

        return ventaActualizada;
      });

      return formatVentaResponse(actualizada);
    } finally {
      await this.liberarLock(venta.id, lockToken);
    }
  }

  private sanitizarObservacionConciliacion(
    observacion: string,
    valoresSensibles: Array<string | null | undefined>,
  ): string {
    let sanitizada = observacion.trim();

    for (const valor of valoresSensibles) {
      const patron = this.crearPatronValorSensible(valor);
      if (patron) {
        sanitizada = sanitizada.replace(patron, '[dato oculto]');
      }
    }

    // Enmascara secuencias numéricas largas aunque estén formateadas con
    // espacios, guiones o puntos (cuentas, CBU, referencias numéricas).
    sanitizada = sanitizada.replace(
      /(^|[^\d])((?:\d[\s.\-]*){7,}\d)/g,
      (_coincidencia, prefijo: string) => `${prefijo}[dato oculto]`,
    );

    // Enmascara tokens alfanuméricos largos que contengan dígitos.
    sanitizada = sanitizada.replace(/\b[A-Za-z0-9_-]{8,}\b/g, (token) =>
      /\d/.test(token) ? '[referencia oculta]' : token,
    );

    return sanitizada;
  }

  private crearPatronValorSensible(
    valor: string | null | undefined,
  ): RegExp | null {
    if (typeof valor !== 'string') {
      return null;
    }

    const caracteres = Array.from(valor.replace(/[\s.\-]/g, ''));
    if (caracteres.length < 4) {
      return null;
    }

    const cuerpo = caracteres
      .map((caracter) => caracter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('[\\s.\\-]*');

    return new RegExp(cuerpo, 'gi');
  }

  private detalleConciliacion(resultado: ResultadoConciliacion): string {
    if (resultado === 'CONFIRMADO') {
      return 'Conciliación manual: pago confirmado';
    }
    if (resultado === 'RECHAZADO') {
      return 'Conciliación manual: rechazo confirmado por el proveedor';
    }
    return 'Conciliación manual: no se registró cobro';
  }

  private async auditarConciliacionFallida(
    empresaId: string,
    idOrExternal: string | number,
    contexto: ContextoAuditoriaConciliacion,
    error: any,
  ) {
    if (!empresaId || !contexto?.usuarioId) {
      return;
    }

    try {
      await this.auditoriaService.registrar({
        usuarioId: contexto.usuarioId,
        empresaId,
        accion: 'CONCILIACION_PAGO',
        recurso: 'venta',
        recursoId: String(idOrExternal),
        ip: contexto.ip || null,
        userAgent: contexto.userAgent || null,
        resultado: 'FALLIDO',
        detalle: this.detalleErrorConciliacion(error),
      });
    } catch (auditoriaError: any) {
      // La auditoría de fallos es best-effort: no debe ocultar el error original.
      this.logger.error(
        `No se pudo auditar el intento fallido de conciliación: ${
          auditoriaError?.message || auditoriaError
        }`,
      );
    }
  }

  private detalleErrorConciliacion(error: any): string {
    const status = error instanceof HttpException ? error.getStatus() : 500;
    if (status === 400) {
      return 'Solicitud de conciliación rechazada';
    }
    if (status === 404) {
      return 'Venta no encontrada para la empresa autenticada';
    }
    if (status === 409) {
      return 'Conflicto al conciliar la venta';
    }
    return 'Error interno al conciliar la venta';
  }

  async findAll(empresaId: string) {
    this.requireEmpresa(empresaId);
    const ventas = await this.prisma.venta.findMany({
      where: { empresaId },
      orderBy: { id: 'desc' },
      include: this.includeVenta,
    });

    return ventas.map((venta) => formatVentaResponse(venta));
  }

  async findOne(empresaId: string, idOrExternal: string | number) {
    this.requireEmpresa(empresaId);

    const venta = await this.buscarVentaPorIdOrExternal(empresaId, idOrExternal);
    if (!venta) {
      throw new NotFoundException(`Venta "${idOrExternal}" no encontrada`);
    }

    return formatVentaResponse(venta);
  }

  private async buscarVentaPorIdExterno(idVentaExternal: string) {
    return this.prisma.venta.findUnique({
      where: { idVentaExternal },
      include: this.includeVenta,
    });
  }

  private async buscarVentaPorIdOrExternal(
    empresaId: string,
    idOrExternal: string | number,
  ) {
    let venta = null;

    if (typeof idOrExternal === 'number' || !isNaN(Number(idOrExternal))) {
      venta = await this.prisma.venta.findFirst({
        where: { id: Number(idOrExternal), empresaId },
        include: this.includeVenta,
      });
    }

    if (!venta && typeof idOrExternal === 'string') {
      venta = await this.prisma.venta.findFirst({
        where: { idVentaExternal: idOrExternal, empresaId },
        include: this.includeVenta,
      });
    }

    return venta;
  }

  private async obtenerVenta(id: number) {
    const venta = await this.prisma.venta.findUnique({
      where: { id },
      include: this.includeVenta,
    });
    if (!venta) {
      throw new NotFoundException(`Venta con ID ${id} no encontrada`);
    }
    return venta;
  }

  /**
   * Bloqueo atómico persistido en SQLite.
   * Solo un proceso puede pasar de 0 a 1 fila actualizada. El vencimiento
   * permite recuperar bloqueos dejados por un proceso caído.
   */
  private async adquirirLock(ventaId: number): Promise<string> {
    const lockToken = randomUUID();
    const ahora = new Date();
    const expira = new Date(ahora.getTime() + this.lockTtlMs);

    const resultado = await this.prisma.venta.updateMany({
      where: {
        id: ventaId,
        OR: [{ lockToken: null }, { lockExpiresAt: { lt: ahora } }],
      },
      data: {
        lockToken,
        lockExpiresAt: expira,
        intentos: { increment: 1 },
      },
    });

    if (resultado.count !== 1) {
      throw new ConflictException(
        'La venta ya está siendo procesada por otra solicitud. Reintente cuando termine.',
      );
    }

    return lockToken;
  }

  private async liberarLock(ventaId: number, lockToken: string) {
    try {
      await this.prisma.venta.updateMany({
        where: { id: ventaId, lockToken },
        data: { lockToken: null, lockExpiresAt: null },
      });
    } catch (error: any) {
      this.logger.warn(
        `No se pudo liberar el lock de la venta ${ventaId}: ${error?.message || error}`,
      );
    }
  }

  private async actualizarVenta(id: number, data: Prisma.VentaUpdateInput) {
    return this.prisma.venta.update({
      where: { id },
      data,
      include: this.includeVenta,
    });
  }

  private async marcarErrorEtapa(id: number, etapa: string, error: any) {
    await this.actualizarVenta(id, {
      estado: ESTADO_ERROR_RECUPERABLE,
      etapaPendiente: etapa,
      errorDetalle: error?.message || 'Error en el flujo de venta',
    });
  }

  private mensajePagoIndeterminado(venta: any, detalle: string) {
    const referencia = venta.idVentaExternal || String(venta.id);
    return [
      `Pago no confirmado: ${detalle}.`,
      'No reintentar automáticamente.',
      `Verifique en BANCO/BILLETERA usando id_venta "${referencia}" y concilie con POST /tpv/ventas/${referencia}/conciliar-pago.`,
    ].join(' ');
  }

  private normalizarError(error: any): Error {
    if (error instanceof HttpException) {
      return error;
    }
    return new ServiceUnavailableException(
      error?.message || 'Servicio externo no disponible',
    );
  }

  private validarVentaExistente(venta: any, empresaId: string, cuit: string) {
    if (venta.empresaId !== empresaId) {
      // No revelar a qué empresa pertenece el id_venta.
      throw new ConflictException('Ya existe una venta con ese id_venta');
    }
    if (venta.cuit !== cuit) {
      throw new ConflictException('El id_venta ya está asociado a otro comercio');
    }
  }

  private async validarComercioDeEmpresa(empresaId: string, cuit: string) {
    const comercio = await this.prisma.comercio.findFirst({
      where: { cuit, empresaId },
    });
    if (!comercio) {
      throw new BadRequestException('El comercio no pertenece a la empresa autenticada');
    }
  }

  private validarDatosPago(medioPago: string, dto: CreateVentaDto) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('La venta debe incluir al menos un ítem');
    }

    if (medioPago === 'BANCO') {
      const origen = dto.getCuentaOrigen();
      const destino = dto.getCuentaDestino();
      if (!origen || !destino) {
        throw new BadRequestException(
          'cuenta_origen y cuenta_destino son obligatorias para pagos por BANCO',
        );
      }
    } else if (medioPago === 'BILLETERA') {
      const pagador = dto.getCuitPagador();
      if (!pagador || pagador.length !== 11) {
        throw new BadRequestException(
          'cuit_pagador (11 dígitos) es obligatorio para pagos por BILLETERA',
        );
      }
    }
  }

  private async calcularDetalles(empresaId: string, items: CreateVentaDto['items']) {
    let subtotal = 0;
    const detalles: {
      productoId: number;
      cantidad: number;
      precioUnitario: number;
      subtotal: number;
    }[] = [];

    for (const item of items) {
      const ref = item.getResolvedProductoRef();
      if (!ref) {
        throw new BadRequestException('Cada ítem debe incluir un producto_id válido');
      }

      let producto = null;
      if (!isNaN(Number(ref))) {
        producto = await this.prisma.producto.findFirst({
          where: { id: Number(ref), empresaId },
        });
      }
      if (!producto) {
        producto = await this.prisma.producto.findFirst({
          where: { codigo: ref, empresaId },
        });
      }

      if (!producto) {
        throw new NotFoundException(
          `Producto "${ref}" no encontrado en el catálogo de la empresa`,
        );
      }

      if (producto.stock < item.cantidad) {
        throw new BadRequestException(
          `Stock insuficiente para el producto "${producto.nombre}". Disponible: ${producto.stock} u.`,
        );
      }

      const itemSubtotal = Math.round(producto.precio * item.cantidad * 100) / 100;
      subtotal += itemSubtotal;

      detalles.push({
        productoId: producto.id,
        cantidad: item.cantidad,
        precioUnitario: producto.precio,
        subtotal: itemSubtotal,
      });
    }

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      detalles,
    };
  }

  private requireEmpresa(empresaId: string) {
    if (!empresaId) {
      throw new ForbiddenException('La cuenta no tiene una empresa asociada');
    }
  }
}
