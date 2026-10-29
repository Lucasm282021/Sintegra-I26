using System.Text.RegularExpressions;
using Tpv.Api.Datos;
using Tpv.Api.Dominio;
using Tpv.Api.Integraciones;

namespace Tpv.Api.Ventas;

public sealed class PedidoVenta
{
    public string? IdVenta { get; set; }
    public string? ComercioCuit { get; set; }
    public List<PedidoItem>? Items { get; set; }
    public string? MedioPago { get; set; }
    /// <summary>Solo para medio_pago = "banco".</summary>
    public string? CuentaOrigen { get; set; }
    /// <summary>Solo para medio_pago = "billetera": CUIT de quien paga.</summary>
    public string? CuitPagador { get; set; }
}

public sealed class PedidoItem
{
    public string? ProductoId { get; set; }
    public int? Cantidad { get; set; }
}

public sealed record ResultadoVenta(Venta Venta, bool Creada);

/// <summary>
/// Coordina una venta: Municipio → ARBA → Banco o Billetera → ARCA.
/// Cada etapa completada se guarda antes de pasar a la siguiente; si una falla,
/// la venta queda PENDIENTE o ERROR y un reintento con el mismo id_venta
/// continúa desde la etapa que faltaba, sin volver a cobrar.
/// </summary>
public sealed partial class CoordinadorVentas
{
    // Una venta a la vez: alcanza para un mostrador y evita carreras con el mismo id_venta.
    private static readonly SemaphoreSlim Turno = new(1, 1);

    private readonly Repositorio _repo;
    private readonly ServiciosExternos _servicios;
    private readonly ConfiguracionTpv _config;

    public CoordinadorVentas(Repositorio repo, ServiciosExternos servicios, ConfiguracionTpv config)
    {
        _repo = repo;
        _servicios = servicios;
        _config = config;
    }

    public async Task<ResultadoVenta> Registrar(PedidoVenta? pedido, CancellationToken ct)
    {
        var datos = ValidarPedido(pedido);

        await Turno.WaitAsync(ct);
        try
        {
            var existente = _repo.ObtenerVenta(datos.IdVenta);
            if (existente is not null)
            {
                if (existente.Huella != datos.Huella)
                    throw ErrorApi.Conflicto($"El id_venta {datos.IdVenta} ya se usó con otros datos");
                if (existente.Estado == EstadoVenta.Completada)
                    return new ResultadoVenta(existente, Creada: false);

                await Avanzar(existente, ct);
                return new ResultadoVenta(existente, Creada: false);
            }

            var venta = CrearVenta(datos);
            _repo.InsertarVenta(venta);
            await Avanzar(venta, ct);
            return new ResultadoVenta(venta, Creada: true);
        }
        finally
        {
            Turno.Release();
        }
    }

    // ---------- Validación y armado ----------

    private sealed record DatosVenta(
        string IdVenta, string ComercioCuit, string MedioPago, string? CuentaOrigen, string? CuitPagador,
        List<(string ProductoId, int Cantidad)> Items, string Huella);

    [GeneratedRegex("^[A-Za-z0-9._-]{1,64}$")]
    private static partial Regex CuentaRegex();

    private static DatosVenta ValidarPedido(PedidoVenta? p)
    {
        if (p is null) throw ErrorApi.Invalido("El cuerpo de la venta es obligatorio");

        var id = Validar.Id(p.IdVenta, "id_venta");
        var cuit = Validar.Cuit(p.ComercioCuit, "comercio_cuit");

        var medio = p.MedioPago?.Trim().ToLowerInvariant();
        if (medio is not (MedioPago.Banco or MedioPago.Billetera))
            throw ErrorApi.Invalido("medio_pago debe ser \"banco\" o \"billetera\"");

        string? cuentaOrigen = null, cuitPagador = null;
        if (medio == MedioPago.Banco)
        {
            if (!string.IsNullOrEmpty(p.CuitPagador))
                throw ErrorApi.Invalido("Con medio_pago \"banco\" no se envía cuit_pagador: se cobra por un solo medio");
            cuentaOrigen = p.CuentaOrigen?.Trim();
            if (string.IsNullOrEmpty(cuentaOrigen))
                throw ErrorApi.Invalido("cuenta_origen es obligatoria para pagar con banco");
            if (!CuentaRegex().IsMatch(cuentaOrigen))
                throw ErrorApi.Invalido("cuenta_origen tiene un formato inválido");
        }
        else
        {
            if (!string.IsNullOrEmpty(p.CuentaOrigen))
                throw ErrorApi.Invalido("Con medio_pago \"billetera\" no se envía cuenta_origen: se cobra por un solo medio");
            cuitPagador = Validar.Cuit(p.CuitPagador, "cuit_pagador");
        }

        if (p.Items is null || p.Items.Count == 0)
            throw ErrorApi.Invalido("items debe tener al menos un producto");
        if (p.Items.Count > 100)
            throw ErrorApi.Invalido("Una venta admite hasta 100 líneas");

        // Si el mismo producto viene dos veces se suma en una sola línea.
        var items = new List<(string, int)>();
        var indice = new Dictionary<string, int>();
        foreach (var it in p.Items)
        {
            if (it is null) throw ErrorApi.Invalido("items contiene un elemento vacío");
            var prod = Validar.Id(it.ProductoId, "producto_id");
            if (it.Cantidad is null or < 1 or > 999)
                throw ErrorApi.Invalido($"La cantidad de {prod} debe ser un entero entre 1 y 999");

            if (indice.TryGetValue(prod, out var i))
                items[i] = (prod, items[i].Item2 + it.Cantidad.Value);
            else
            {
                indice[prod] = items.Count;
                items.Add((prod, it.Cantidad.Value));
            }
        }

        var huella = string.Join("|",
            cuit, medio, cuentaOrigen ?? "", cuitPagador ?? "",
            string.Join(",", items.OrderBy(x => x.Item1, StringComparer.Ordinal).Select(x => $"{x.Item1}:{x.Item2}")));

        return new DatosVenta(id, cuit, medio, cuentaOrigen, cuitPagador, items, huella);
    }

    private Venta CrearVenta(DatosVenta d)
    {
        var comercio = _repo.ObtenerComercio(d.ComercioCuit)
            ?? throw ErrorApi.NoEncontrado($"El comercio {d.ComercioCuit} no está registrado en el TPV");
        if (!comercio.Activo)
            throw ErrorApi.Invalido($"El comercio {comercio.RazonSocial} está dado de baja en el TPV");
        if (d.MedioPago == MedioPago.Banco && string.IsNullOrEmpty(comercio.CuentaDestino))
            throw ErrorApi.Invalido($"{comercio.RazonSocial} no tiene cuenta bancaria de destino configurada");

        var lineas = new List<LineaVenta>();
        foreach (var (productoId, cantidad) in d.Items)
        {
            var prod = _repo.ObtenerProducto(productoId);
            if (prod is null || prod.ComercioCuit != comercio.Cuit)
                throw ErrorApi.NoEncontrado($"El producto {productoId} no existe en el catálogo de {comercio.RazonSocial}");
            if (!prod.Activo)
                throw ErrorApi.Invalido($"{prod.Nombre} no está disponible para la venta");
            if (prod.Stock < cantidad)
                throw ErrorApi.Invalido($"No hay stock suficiente de {prod.Nombre} (quedan {prod.Stock})");

            // El precio sale del catálogo del TPV, nunca del pedido.
            lineas.Add(new LineaVenta
            {
                ProductoId = prod.Id,
                Nombre = prod.Nombre,
                PrecioUnitarioCentavos = prod.PrecioCentavos,
                Cantidad = cantidad
            });
        }

        var ahora = Reloj.Ahora();
        return new Venta
        {
            IdVenta = d.IdVenta,
            ComercioCuit = comercio.Cuit,
            RazonSocial = comercio.RazonSocial,
            MedioPago = d.MedioPago,
            CuentaOrigen = d.CuentaOrigen,
            CuitPagador = d.CuitPagador,
            Huella = d.Huella,
            Lineas = lineas,
            SubtotalCentavos = lineas.Sum(l => l.SubtotalCentavos),
            Estado = EstadoVenta.Pendiente,
            Etapa = Etapa.Registrada,
            Creada = ahora,
            Actualizada = ahora
        };
    }

    // ---------- Etapas ----------

    private async Task Avanzar(Venta v, CancellationToken ct)
    {
        v.Intentos++;
        v.UltimoError = null;

        if (!v.ComercioValidado && !await ValidarComercio(v, ct)) return;
        if (v.PercepcionId is null && !await CalcularPercepcion(v, ct)) return;
        if (v.PagoId is null && !await Cobrar(v, ct)) return;
        if (v.ComprobanteId is null && !await EmitirComprobante(v, ct)) return;

        v.Estado = EstadoVenta.Completada;
        v.UltimoError = null;
        _repo.ActualizarVenta(v);
    }

    private async Task<bool> ValidarComercio(Venta v, CancellationToken ct)
    {
        var r = await _servicios.Get("municipio", $"/municipio/comercios/{v.ComercioCuit}", ct);
        if (!r.Ok)
        {
            var mensaje = r.Status == 404 ? "El comercio no está habilitado en Municipio" : r.Error;
            return Fallar(v, r, mensaje);
        }

        var estado = r.Texto("estado")?.ToLowerInvariant();
        var habilitado = r.Texto("habilitado", "activo");
        if (habilitado == "false" || estado is "inactivo" or "baja" or "suspendido" or "clausurado" or "deshabilitado")
            return Fallar(v, r with { NoDisponible = false }, "El comercio no está habilitado en Municipio");

        v.ComercioValidado = true;
        v.Etapa = Etapa.ComercioValidado;
        _repo.ActualizarVenta(v);
        return true;
    }

    private async Task<bool> CalcularPercepcion(Venta v, CancellationToken ct)
    {
        var r = await _servicios.Post("arba", "/arba/percepciones", new
        {
            id_venta = v.IdVenta,
            cuit = v.ComercioCuit,
            monto_venta = Dinero.APesos(v.SubtotalCentavos)
        }, ct);
        if (!r.Ok) return Fallar(v, r, r.Error);

        var monto = r.Numero("monto_percepcion", "monto_percibido");
        var id = r.Texto("id", "id_percepcion");
        if (monto is null || monto < 0 || id is null)
            return Fallar(v, r with { NoDisponible = true }, "ARBA respondió sin monto_percepcion o sin id");

        v.PercepcionId = id;
        v.PercepcionCentavos = Dinero.ACentavos(monto.Value);
        v.Alicuota = r.Numero("alicuota_aplicada", "alicuota");
        v.TotalCentavos = v.SubtotalCentavos + v.PercepcionCentavos;
        v.Etapa = Etapa.PercepcionCalculada;
        _repo.ActualizarVenta(v);
        return true;
    }

    private async Task<bool> Cobrar(Venta v, CancellationToken ct)
    {
        var total = Dinero.APesos(v.TotalCentavos!.Value);
        Respuesta r;

        // Exactamente un medio de pago por venta.
        if (v.MedioPago == MedioPago.Banco)
        {
            var comercio = _repo.ObtenerComercio(v.ComercioCuit);
            if (string.IsNullOrEmpty(comercio?.CuentaDestino))
                return Fallar(v, new Respuesta(false, false, 400, default, null),
                    "El comercio no tiene cuenta bancaria de destino configurada");

            r = await _servicios.Post("banco", "/banco/pagos", new
            {
                id_venta = v.IdVenta,
                cuenta_origen = v.CuentaOrigen,
                cuenta_destino = comercio.CuentaDestino,
                monto = total
            }, ct);
        }
        else
        {
            r = await _servicios.Post("billetera", "/billetera/pagos", new
            {
                id_venta = v.IdVenta,
                cuit = v.CuitPagador,
                comercio_cuit = v.ComercioCuit,
                monto = total
            }, ct);
        }

        if (!r.Ok) return Fallar(v, r, r.Error);

        var idPago = r.Texto("id_movimiento", "id", "id_pago");
        var estado = r.Texto("estado")?.ToLowerInvariant();
        if (idPago is null)
            return Fallar(v, r with { NoDisponible = true }, $"{ServiciosExternos.Nombre(v.MedioPago)} respondió sin identificador de movimiento");
        if (estado is not null && estado is not ("confirmado" or "aprobado" or "acreditado" or "completado"))
            return Fallar(v, r with { NoDisponible = true },
                $"{ServiciosExternos.Nombre(v.MedioPago)} informó el pago como \"{estado}\". Reintentá para confirmar.");

        v.PagoId = idPago;
        v.PagoEstado = estado ?? "confirmado";
        v.Etapa = Etapa.PagoConfirmado;
        _repo.ConfirmarPagoYDescontarStock(v);
        return true;
    }

    private async Task<bool> EmitirComprobante(Venta v, CancellationToken ct)
    {
        var r = await _servicios.Post("arca", "/arca/comprobantes", new
        {
            id_venta = v.IdVenta,
            cuit = v.ComercioCuit,
            monto_total = Dinero.APesos(v.TotalCentavos!.Value),
            tipo_comprobante = _config.TipoComprobante
        }, ct);
        if (!r.Ok) return Fallar(v, r, r.Error);

        var id = r.Texto("id", "id_comprobante");
        if (id is null)
            return Fallar(v, r with { NoDisponible = true }, "ARCA respondió sin identificador de comprobante");

        v.ComprobanteId = id;
        v.ComprobanteNumero = r.Texto("numero_comprobante", "numero");
        v.ComprobanteTipo = r.Texto("tipo_comprobante", "tipo") ?? _config.TipoComprobante;
        v.Cae = r.Texto("cae");
        v.ComprobanteFecha = r.Texto("fecha_emision", "fecha");
        v.Etapa = Etapa.ComprobanteEmitido;
        _repo.ActualizarVenta(v);
        return true;
    }

    /// <summary>
    /// Deja la venta en un estado recuperable. Servicio caído o timeout → PENDIENTE;
    /// rechazo de negocio (4xx) → ERROR. En ambos casos se puede reintentar.
    /// </summary>
    private bool Fallar(Venta v, Respuesta r, string? mensaje)
    {
        v.Estado = r.NoDisponible ? EstadoVenta.Pendiente : EstadoVenta.Error;
        v.UltimoError = mensaje ?? "Error al comunicarse con otro servicio";
        _repo.ActualizarVenta(v);
        return false;
    }
}
