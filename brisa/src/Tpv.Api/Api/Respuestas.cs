using Tpv.Api.Dominio;

namespace Tpv.Api.Api;

// Respuestas públicas. Los nombres se serializan en snake_case (IdVenta → id_venta).

public sealed record ComercioDto(string Cuit, string RazonSocial, string Rubro, string? CuentaDestino, bool Activo)
{
    public static ComercioDto De(Comercio c) => new(c.Cuit, c.RazonSocial, c.Rubro, c.CuentaDestino, c.Activo);
}

public sealed record ProductoDto(string Id, string ComercioCuit, string Nombre, string Categoria, decimal Precio, int Stock, bool Activo)
{
    public static ProductoDto De(Producto p) =>
        new(p.Id, p.ComercioCuit, p.Nombre, p.Categoria, Dinero.APesos(p.PrecioCentavos), p.Stock, p.Activo);
}

public sealed record LineaDto(string ProductoId, string Nombre, decimal PrecioUnitario, int Cantidad, decimal Subtotal);

public sealed record PagoDto(string Medio, string? CuentaOrigen, string? CuitPagador, string? IdMovimiento, string? Estado);

public sealed record ComprobanteDto(string Id, string? NumeroComprobante, string? TipoComprobante, string? Cae, string? FechaEmision);

public sealed record VentaDto(
    string IdVenta,
    string ComercioCuit,
    string RazonSocial,
    string Estado,
    string Etapa,
    string? EtapaPendiente,
    string? UltimoError,
    int Intentos,
    List<LineaDto> Lineas,
    decimal Subtotal,
    decimal? AlicuotaPercepcion,
    decimal? Percepcion,
    decimal? Total,
    string? PercepcionId,
    PagoDto Pago,
    ComprobanteDto? Comprobante,
    string Creada,
    string Actualizada)
{
    public static VentaDto De(Venta v) => new(
        v.IdVenta,
        v.ComercioCuit,
        v.RazonSocial,
        v.Estado,
        v.Etapa,
        v.EtapaPendiente,
        v.UltimoError,
        v.Intentos,
        v.Lineas.Select(l => new LineaDto(
            l.ProductoId, l.Nombre, Dinero.APesos(l.PrecioUnitarioCentavos), l.Cantidad, Dinero.APesos(l.SubtotalCentavos))).ToList(),
        Dinero.APesos(v.SubtotalCentavos),
        v.Alicuota,
        Dinero.APesos(v.PercepcionCentavos),
        Dinero.APesos(v.TotalCentavos),
        v.PercepcionId,
        new PagoDto(v.MedioPago, v.CuentaOrigen, v.CuitPagador, v.PagoId, v.PagoEstado),
        v.ComprobanteId is null ? null
            : new ComprobanteDto(v.ComprobanteId, v.ComprobanteNumero, v.ComprobanteTipo, v.Cae, v.ComprobanteFecha),
        v.Creada,
        v.Actualizada);
}

/// <summary>Versión liviana para el historial.</summary>
public sealed record VentaResumenDto(
    string IdVenta, string ComercioCuit, string RazonSocial, string Estado, string Etapa, string MedioPago,
    decimal Subtotal, decimal? Total, string? NumeroComprobante, string Creada)
{
    public static VentaResumenDto De(Venta v) => new(
        v.IdVenta, v.ComercioCuit, v.RazonSocial, v.Estado, v.Etapa, v.MedioPago,
        Dinero.APesos(v.SubtotalCentavos), Dinero.APesos(v.TotalCentavos), v.ComprobanteNumero, v.Creada);
}

// Cuerpos de entrada para el catálogo.

public sealed class ComercioEntrada
{
    public string? Cuit { get; set; }
    public string? RazonSocial { get; set; }
    public string? Rubro { get; set; }
    public string? CuentaDestino { get; set; }
    public bool? Activo { get; set; }
}

public sealed class ProductoEntrada
{
    public string? ComercioCuit { get; set; }
    public string? Nombre { get; set; }
    public string? Categoria { get; set; }
    public decimal? Precio { get; set; }
    public int? Stock { get; set; }
    public bool? Activo { get; set; }
}
