import { Injectable, Logger, ServiceUnavailableException, BadRequestException } from '@nestjs/common';
import axios from 'axios';
import { PagoIndeterminadoError, PagoRechazadoError } from './pago-errors';

@Injectable()
export class IntegracionesService {
  private readonly logger = new Logger(IntegracionesService.name);

  private readonly municipioUrl = process.env.MUNICIPIO_URL || 'http://municipio:3005';
  private readonly bancoUrl = process.env.BANCO_URL || 'http://banco:3002';
  private readonly billeteraUrl = process.env.BILLETERA_URL || 'http://billetera:3006';
  private readonly arbaUrl = process.env.ARBA_URL || 'http://arba:3003';
  private readonly arcaUrl = process.env.ARCA_URL || 'http://arca:3004';

  private readonly municipioMock = process.env.MUNICIPIO_MOCK === 'true';
  private readonly bancoMock = process.env.BANCO_MOCK === 'true';
  private readonly billeteraMock = process.env.BILLETERA_MOCK === 'true';
  private readonly arbaMock = process.env.ARBA_MOCK === 'true';
  private readonly arcaMock = process.env.ARCA_MOCK === 'true';

  /**
   * Solo para pruebas de concurrencia: permite que la primera solicitud
   * mantenga el bloqueo persistido mientras llega la segunda.
   */
  private async esperarDelayMockMunicipio() {
    const delayMs = Number(process.env.MUNICIPIO_MOCK_DELAY_MS || 0);
    if (this.municipioMock && Number.isFinite(delayMs) && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  /**
   * Validar comercio ante MUNICIPIO: GET /municipio/comercios/{cuit}
   * Respuesta confirmada: { cuit, razon_social, rubro, fecha_habilitacion, estado }
   */
  async validarComercioMunicipio(cuit: string) {
    if (this.municipioMock) {
      await this.esperarDelayMockMunicipio();
      this.logger.log(`[MOCK EXPLÍCITO] MUNICIPIO_MOCK=true -> Comercio CUIT ${cuit} habilitado`);
      return { cuit, estado: 'activo', razon_social: `Comercio CUIT ${cuit}` };
    }

    const url = `${this.municipioUrl}/municipio/comercios/${cuit}`;
    this.logger.log(`Llamando a MUNICIPIO: GET ${url}`);
    try {
      const res = await axios.get(url, { timeout: 3000 });
      const estado = (res.data?.estado || '').toString().toLowerCase();
      if (estado !== 'activo' && estado !== 'habilitado') {
        throw new BadRequestException(`El comercio CUIT ${cuit} no está habilitado en Municipio (estado: ${res.data?.estado || 'inactivo'})`);
      }
      return {
        cuit: res.data?.cuit || cuit,
        razonSocial: res.data?.razon_social || res.data?.razonSocial || `Comercio CUIT ${cuit}`,
        estado: res.data?.estado || 'activo',
      };
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      if (err.response?.status === 404) {
        throw new BadRequestException(`Comercio CUIT ${cuit} no encontrado ni habilitado en Municipio`);
      }
      this.logger.error(`Error al consultar MUNICIPIO (${url}): ${err.message}`);
      throw new ServiceUnavailableException(`Servicio MUNICIPIO no disponible: ${err.message}`);
    }
  }

  /**
   * Consulta Percepción de IIBB a ARBA: POST /arba/percepciones
   * Parámetros confirmados: { cuit, monto_venta, id_venta }
   * Respuesta confirmada: { id, id_venta, cuit, monto_venta, alicuota_aplicada, monto_percepcion, fecha }
   */
  async calcularPercepcionArba(params: { cuit: string; montoVenta: number; idVenta: string }) {
    if (this.arbaMock) {
      const alicuota = 0.03;
      const montoPercepcion = Math.round(params.montoVenta * alicuota * 100) / 100;
      this.logger.log(`[MOCK EXPLÍCITO] ARBA_MOCK=true -> Percepción: $${montoPercepcion}`);
      return {
        percepcionId: `ARB-MOCK-${params.idVenta}`,
        alicuota,
        montoPercepcion,
      };
    }

    const url = `${this.arbaUrl}/arba/percepciones`;
    this.logger.log(`Llamando a ARBA: POST ${url} - CUIT: ${params.cuit}, Monto: ${params.montoVenta}, ID: ${params.idVenta}`);
    try {
      const res = await axios.post(
        url,
        {
          cuit: params.cuit,
          monto_venta: params.montoVenta,
          id_venta: String(params.idVenta),
        },
        { timeout: 4000 }
      );

      const montoPercepcion = Number(res.data?.monto_percepcion ?? res.data?.montoPercepcion ?? 0);
      const percepcionId = String(res.data?.id || res.data?.percepcionId || `ARB-${params.idVenta}`);
      const alicuota = Number(res.data?.alicuota_aplicada ?? res.data?.alicuota ?? 0.03);

      return {
        percepcionId,
        alicuota,
        montoPercepcion: Math.round(montoPercepcion * 100) / 100,
      };
    } catch (err: any) {
      this.logger.error(`Error al consultar ARBA (${url}): ${err.message}`);
      if (err.response?.data?.error) {
        throw new BadRequestException(`ARBA rechazó la percepción: ${err.response.data.error}`);
      }
      throw new ServiceUnavailableException(`Servicio ARBA no disponible: ${err.message}`);
    }
  }

  /**
   * Cobro por BANCO: POST /banco/pagos
   * Parámetros confirmados: { cuenta_origen, cuenta_destino, monto, id_venta }
   * Respuesta confirmada: { success: true, data: { id_movimiento, origen, destino, monto, estado: "confirmado" } }
   */
  async procesarPagoBanco(params: { cuit: string; monto: number; cuentaOrigen: string; cuentaDestino: string; idVenta: string }) {
    if (this.bancoMock) {
      this.logger.log(`[MOCK EXPLÍCITO] BANCO_MOCK=true -> Pago $${params.monto} aprobado`);
      return {
        transaccionId: `BNC-MOCK-${params.idVenta}`,
        estado: 'confirmado',
      };
    }

    const url = `${this.bancoUrl}/banco/pagos`;
    this.logger.log(`Llamando a BANCO: POST ${url} - Origen: ${params.cuentaOrigen}, Destino: ${params.cuentaDestino}, Monto: $${params.monto}`);
    try {
      const res = await axios.post(
        url,
        {
          cuenta_origen: params.cuentaOrigen,
          cuenta_destino: params.cuentaDestino,
          monto: params.monto,
          id_venta: params.idVenta,
        },
        { timeout: 4000 }
      );

      if (res.data?.success === false) {
        const errorMsg = res.data?.errors?.[0]?.message || 'Error en pago bancario';
        throw new PagoRechazadoError(`BANCO rechazó el pago: ${errorMsg}`);
      }

      // No se inventa una referencia: sin id_movimiento/transaccionId el
      // resultado es indeterminado y requiere conciliación manual.
      const transId = res.data?.data?.id_movimiento ?? res.data?.transaccionId;
      if (!transId) {
        throw new PagoIndeterminadoError(
          'BANCO respondió de forma exitosa pero sin id_movimiento/transaccionId; el cobro no puede confirmarse automáticamente',
        );
      }

      const estado = String(res.data?.data?.estado || 'confirmado').toLowerCase();
      if (!['confirmado', 'aprobado', 'success', 'ok'].includes(estado)) {
        throw new PagoIndeterminadoError(
          `BANCO devolvió el estado "${estado}" sin una confirmación definitiva del cobro`,
        );
      }

      return {
        transaccionId: String(transId),
        estado,
      };
    } catch (err: any) {
      if (err instanceof PagoRechazadoError || err instanceof PagoIndeterminadoError) {
        throw err;
      }

      this.logger.error(`Error al procesar pago en BANCO (${url}): ${err.message}`);
      const status = err.response?.status as number | undefined;
      const apiErr = err.response?.data?.errors?.[0]?.message || err.response?.data?.error;

      // Timeout, error de red, 5xx, 408 o 429: el pago pudo haberse cobrado.
      if (!err.response || status === 408 || status === 429 || (status && status >= 500)) {
        throw new PagoIndeterminadoError(
          `No se pudo confirmar el pago en BANCO: ${apiErr || err.message}`,
        );
      }

      // El proveedor respondió con un rechazo explícito (4xx).
      if (status && status >= 400) {
        throw new PagoRechazadoError(
          `BANCO rechazó el pago: ${apiErr || `HTTP ${status}`}`,
        );
      }

      throw new PagoIndeterminadoError(
        `No se pudo confirmar el pago en BANCO: ${apiErr || err.message}`,
      );
    }
  }

  /**
   * Cobro por BILLETERA: POST /billetera/pagos
   * Parámetros confirmados: { cuit, monto, comercio_cuit, id_venta }
   * Respuesta confirmada: { id, titular, cuit, alias, saldo, fecha_alta }
   */
  async procesarPagoBilletera(params: { cuitComercio: string; monto: number; cuitPagador: string; idVenta: string }) {
    if (this.billeteraMock) {
      this.logger.log(`[MOCK EXPLÍCITO] BILLETERA_MOCK=true -> Pago $${params.monto} aprobado para CUIT ${params.cuitPagador}`);
      return {
        transaccionId: `BILL-MOCK-${params.idVenta}`,
        estado: 'APROBADO',
      };
    }

    const url = `${this.billeteraUrl}/billetera/pagos`;
    this.logger.log(`Llamando a BILLETERA: POST ${url} - Pagador: ${params.cuitPagador}, Comercio: ${params.cuitComercio}, Monto: $${params.monto}`);
    try {
      const res = await axios.post(
        url,
        {
          cuit: params.cuitPagador,
          comercio_cuit: params.cuitComercio,
          monto: params.monto,
          id_venta: params.idVenta,
        },
        { timeout: 4000 }
      );

      // No se inventa una referencia: sin id/transaccionId el resultado es indeterminado.
      const transId = res.data?.id ?? res.data?.transaccionId;
      if (!transId) {
        throw new PagoIndeterminadoError(
          'BILLETERA respondió de forma exitosa pero sin id/transaccionId; el cobro no puede confirmarse automáticamente',
        );
      }

      const estado = String(res.data?.estado || 'APROBADO');
      const estadoNormalizado = estado.toLowerCase();
      if (['rechazado', 'rechazada', 'fallido', 'fallida', 'error'].includes(estadoNormalizado)) {
        throw new PagoRechazadoError(`BILLETERA rechazó el pago: ${estado}`);
      }
      if (
        res.data?.estado &&
        !['aprobado', 'confirmado', 'success', 'ok'].includes(estadoNormalizado)
      ) {
        throw new PagoIndeterminadoError(
          `BILLETERA devolvió el estado "${estado}" sin una confirmación definitiva del cobro`,
        );
      }

      return {
        transaccionId: String(transId),
        estado,
      };
    } catch (err: any) {
      if (err instanceof PagoRechazadoError || err instanceof PagoIndeterminadoError) {
        throw err;
      }

      this.logger.error(`Error al procesar pago en BILLETERA (${url}): ${err.message}`);
      const status = err.response?.status as number | undefined;
      const apiErr = err.response?.data?.error;

      if (!err.response || status === 408 || status === 429 || (status && status >= 500)) {
        throw new PagoIndeterminadoError(
          `No se pudo confirmar el pago en BILLETERA: ${apiErr || err.message}`,
        );
      }

      if (status && status >= 400) {
        throw new PagoRechazadoError(
          `BILLETERA rechazó el pago: ${apiErr || `HTTP ${status}`}`,
        );
      }

      throw new PagoIndeterminadoError(
        `No se pudo confirmar el pago en BILLETERA: ${apiErr || err.message}`,
      );
    }
  }

  /**
   * Emitir Factura Electrónica ARCA: POST /arca/comprobantes
   * Parámetros confirmados: { cuit, total, punto_venta, tipo_comprobante, cantItems, id_venta }
   * Respuesta confirmada: { cae, numeroComprobante, fecha, tipo_comprobante }
   */
  async emitirFacturaArca(params: { cuit: string; total: number; cantItems: number; idVenta: string }) {
    if (this.arcaMock) {
      const caeSimulado = Array.from({ length: 14 }, () => Math.floor(Math.random() * 10)).join('');
      const nroComp = `0001-${String(Math.floor(Math.random() * 900000) + 100000).padStart(8, '0')}`;
      const venc = new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0];
      this.logger.log(`[MOCK EXPLÍCITO] ARCA_MOCK=true -> Factura CAE: ${caeSimulado}`);
      return {
        cae: caeSimulado,
        numeroComprobante: nroComp,
        fechaVencimientoCae: venc,
        tipoComprobante: 'FACTURA_B',
        estado: 'APROBADO',
      };
    }

    const url = `${this.arcaUrl}/arca/comprobantes`;
    this.logger.log(`Llamando a ARCA: POST ${url} - CUIT: ${params.cuit}, Total: $${params.total}, ID: ${params.idVenta}`);
    try {
      const res = await axios.post(
        url,
        {
          cuit: params.cuit,
          total: params.total,
          punto_venta: 1,
          tipo_comprobante: 'FACTURA_B',
          cantItems: params.cantItems,
          id_venta: String(params.idVenta),
        },
        { timeout: 4000 }
      );

      return {
        cae: String(res.data?.cae || ''),
        numeroComprobante: String(res.data?.numeroComprobante || res.data?.numero_comprobante || res.data?.numero || ''),
        fechaVencimientoCae: String(res.data?.fechaVencimientoCae || res.data?.fecha || ''),
        tipoComprobante: String(res.data?.tipo_comprobante || res.data?.tipoComprobante || 'FACTURA_B'),
        estado: res.data?.estado || 'APROBADO',
      };
    } catch (err: any) {
      this.logger.error(`Error al emitir factura en ARCA (${url}): ${err.message}`);
      if (err.response?.data?.error) {
        throw new BadRequestException(`ARCA rechazó la facturación: ${err.response.data.error}`);
      }
      throw new ServiceUnavailableException(`Servicio ARCA no disponible: ${err.message}`);
    }
  }
}


