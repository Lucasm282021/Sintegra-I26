namespace Tpv.Api.Dominio;

/// <summary>Estados posibles de una venta.</summary>
public static class EstadoVenta
{
    /// <summary>Alguna dependencia no respondió. Se puede reintentar con el mismo id_venta.</summary>
    public const string Pendiente = "PENDIENTE";
    /// <summary>Un servicio rechazó la operación (por ejemplo, saldo insuficiente). Se puede reintentar.</summary>
    public const string Error = "ERROR";
    /// <summary>Todas las etapas se confirmaron con los servicios reales.</summary>
    public const string Completada = "COMPLETADA";
}

/// <summary>Etapas del flujo, en orden. Se guarda la última etapa completada.</summary>
public static class Etapa
{
    public const string Registrada = "registrada";
    public const string ComercioValidado = "comercio_validado";
    public const string PercepcionCalculada = "percepcion_calculada";
    public const string PagoConfirmado = "pago_confirmado";
    public const string ComprobanteEmitido = "comprobante_emitido";
}

public static class MedioPago
{
    public const string Banco = "banco";
    public const string Billetera = "billetera";
}

public sealed class Comercio
{
    public string Cuit { get; set; } = "";
    public string RazonSocial { get; set; } = "";
    public string Rubro { get; set; } = "";
    public string? CuentaDestino { get; set; }
    public bool Activo { get; set; } = true;
}

public sealed class Producto
{
    public string Id { get; set; } = "";
    public string ComercioCuit { get; set; } = "";
    public string Nombre { get; set; } = "";
    public string Categoria { get; set; } = "";
    public long PrecioCentavos { get; set; }
    public int Stock { get; set; }
    public bool Activo { get; set; } = true;
}

public sealed class LineaVenta
{
    public string ProductoId { get; set; } = "";
    public string Nombre { get; set; } = "";
    public long PrecioUnitarioCentavos { get; set; }
    public int Cantidad { get; set; }
    public long SubtotalCentavos => PrecioUnitarioCentavos * Cantidad;
}

/// <summary>Venta persistida por el TPV, con las referencias de cada servicio externo.</summary>
public sealed class Venta
{
    public string IdVenta { get; set; } = "";
    public string ComercioCuit { get; set; } = "";
    public string RazonSocial { get; set; } = "";
    public string MedioPago { get; set; } = "";
    public string? CuentaOrigen { get; set; }
    public string? CuitPagador { get; set; }
    /// <summary>Resumen canónico del pedido. Sirve para detectar la misma clave con otro contenido (409).</summary>
    public string Huella { get; set; } = "";

    public long SubtotalCentavos { get; set; }
    public long? PercepcionCentavos { get; set; }
    public decimal? Alicuota { get; set; }
    public long? TotalCentavos { get; set; }

    public string Estado { get; set; } = EstadoVenta.Pendiente;
    public string Etapa { get; set; } = Dominio.Etapa.Registrada;
    public string? UltimoError { get; set; }
    public int Intentos { get; set; }

    public bool ComercioValidado { get; set; }
    public string? PercepcionId { get; set; }
    public string? PagoId { get; set; }
    public string? PagoEstado { get; set; }
    public string? ComprobanteId { get; set; }
    public string? ComprobanteNumero { get; set; }
    public string? ComprobanteTipo { get; set; }
    public string? Cae { get; set; }
    public string? ComprobanteFecha { get; set; }

    public string Creada { get; set; } = "";
    public string Actualizada { get; set; } = "";

    public List<LineaVenta> Lineas { get; set; } = new();

    /// <summary>Próxima etapa que falta completar, o null si la venta terminó.</summary>
    public string? EtapaPendiente =>
        !ComercioValidado ? Dominio.Etapa.ComercioValidado :
        PercepcionId is null ? Dominio.Etapa.PercepcionCalculada :
        PagoId is null ? Dominio.Etapa.PagoConfirmado :
        ComprobanteId is null ? Dominio.Etapa.ComprobanteEmitido :
        null;
}
