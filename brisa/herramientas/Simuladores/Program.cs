using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Simuladores;

/// <summary>
/// DOBLES DE PRUEBA, solo para desarrollo y demo local del TPV.
/// Imitan los contratos de la guía fundacional para Municipio, ARBA, Banco, Billetera y ARCA,
/// en memoria y con datos ficticios. No reemplazan a los módulos de los otros equipos:
/// en la integración real el TPV apunta a sus servicios con las variables *_URL.
///
/// Un solo proceso escucha en 3002 a 3006; como las rutas tienen prefijo
/// (/banco, /arba, ...) cada puerto atiende el servicio que le corresponde.
/// </summary>
public class Program
{
    public static void Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);
        if (string.IsNullOrEmpty(builder.Configuration["ASPNETCORE_URLS"]))
            builder.WebHost.UseUrls(Enumerable.Range(3002, 5).Select(p => $"http://0.0.0.0:{p}").ToArray());
        Configurar(builder).Run();
    }

    public static WebApplication Configurar(WebApplicationBuilder builder)
    {
        builder.Services.AddSingleton<Estado>();
        var app = builder.Build();
        var estado = app.Services.GetRequiredService<Estado>();

        // Servicio "caído" a pedido, para demostrar fallos parciales y reintentos.
        app.Use(async (ctx, next) =>
        {
            var primerSegmento = ctx.Request.Path.Value?.Split('/', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault();
            if (primerSegmento is not null && estado.EstaCaido(primerSegmento))
            {
                ctx.Response.StatusCode = 503;
                await ctx.Response.WriteAsJsonAsync(new { error = $"{primerSegmento} simulado fuera de línea" });
                return;
            }
            await next();
        });

        app.MapGet("/health", () => Results.Ok(new { status = "ok", servicio = "simuladores" }));

        // ---- Control de la demo ----
        app.MapGet("/_simulador/estado", () => Results.Ok(estado.Resumen()));
        app.MapPost("/_simulador/caidas", async (HttpRequest req) =>
        {
            var json = await JsonNode.ParseAsync(req.Body);
            var servicio = json?["servicio"]?.GetValue<string>();
            var caido = json?["caido"]?.GetValue<bool>() ?? true;
            if (string.IsNullOrEmpty(servicio)) return Error(400, "servicio es obligatorio");
            estado.MarcarCaido(servicio, caido);
            return Results.Ok(estado.Resumen());
        });

        // ---- Municipio ----
        app.MapGet("/municipio/comercios/{cuit}", (string cuit) =>
            estado.Comercios.TryGetValue(cuit, out var c)
                ? Results.Ok(c)
                : Error(404, "Comercio no encontrado o no habilitado"));

        // ---- ARBA ----
        app.MapPost("/arba/percepciones", async (HttpRequest req) =>
        {
            var b = await Leer(req);
            var idVenta = Str(b, "id_venta"); var cuit = Str(b, "cuit"); var monto = Num(b, "monto_venta");
            if (idVenta is null || cuit is null || monto is null or <= 0)
                return Error(400, "id_venta, cuit y monto_venta son obligatorios");
            lock (estado)
            {
                if (estado.Percepciones.TryGetValue(idVenta, out var previa))
                    return Num(previa, "monto_venta") == monto && Str(previa, "cuit") == cuit
                        ? Results.Ok(previa)
                        : Error(409, "id_venta ya usado con otros datos");
                if (!estado.Padron.TryGetValue(cuit, out var alicuota))
                    return Error(404, "CUIT no encontrado en el padrón");
                var nueva = new JsonObject
                {
                    ["id"] = $"percepcion-{estado.Siguiente():D4}",
                    ["id_venta"] = idVenta,
                    ["cuit"] = cuit,
                    ["monto_venta"] = monto,
                    ["alicuota_aplicada"] = alicuota,
                    ["monto_percepcion"] = Math.Round(monto.Value * alicuota, 2, MidpointRounding.AwayFromZero),
                    ["fecha"] = Ahora()
                };
                estado.Percepciones[idVenta] = nueva;
                return Results.Json(nueva, statusCode: 201);
            }
        });

        // ---- Banco ----
        app.MapGet("/banco/cuentas/{id}/saldo", (string id) =>
            estado.CuentasBanco.TryGetValue(id, out var saldo)
                ? Results.Ok(new { cuenta_id = id, titular = "Titular ficticio", saldo })
                : Error(404, "Cuenta no encontrada"));

        app.MapPost("/banco/pagos", async (HttpRequest req) =>
        {
            var b = await Leer(req);
            var idVenta = Str(b, "id_venta"); var origen = Str(b, "cuenta_origen"); var destino = Str(b, "cuenta_destino"); var monto = Num(b, "monto");
            if (idVenta is null || origen is null || destino is null || monto is null or <= 0)
                return Error(400, "id_venta, cuenta_origen, cuenta_destino y monto son obligatorios");
            lock (estado)
            {
                if (estado.PagosBanco.TryGetValue(idVenta, out var previo))
                    return Num(previo, "monto") == monto && Str(previo, "cuenta_origen") == origen
                        ? Results.Ok(previo)
                        : Error(409, "id_venta ya usado con otros datos");
                if (!estado.CuentasBanco.TryGetValue(origen, out var saldoOrigen)) return Error(404, "Cuenta origen no encontrada");
                if (!estado.CuentasBanco.ContainsKey(destino)) return Error(404, "Cuenta destino no encontrada");
                if (saldoOrigen < monto) return Error(400, "Saldo insuficiente para realizar el pago");

                estado.CuentasBanco[origen] -= monto.Value;
                estado.CuentasBanco[destino] += monto.Value;
                var mov = new JsonObject
                {
                    ["id_movimiento"] = $"mov-{estado.Siguiente():D4}",
                    ["id_venta"] = idVenta,
                    ["cuenta_origen"] = origen,
                    ["cuenta_destino"] = destino,
                    ["monto"] = monto,
                    ["estado"] = "confirmado"
                };
                estado.PagosBanco[idVenta] = mov;
                return Results.Json(mov, statusCode: 201);
            }
        });

        // ---- Billetera ----
        app.MapPost("/billetera/pagos", async (HttpRequest req) =>
        {
            var b = await Leer(req);
            var idVenta = Str(b, "id_venta"); var cuit = Str(b, "cuit"); var comercio = Str(b, "comercio_cuit"); var monto = Num(b, "monto");
            if (idVenta is null || cuit is null || comercio is null || monto is null or <= 0)
                return Error(400, "id_venta, cuit, comercio_cuit y monto son obligatorios");
            lock (estado)
            {
                if (estado.PagosBilletera.TryGetValue(idVenta, out var previo))
                    return Num(previo, "monto") == monto && Str(previo, "cuit") == cuit
                        ? Results.Ok(previo)
                        : Error(409, "id_venta ya usado con otros datos");
                if (!estado.Billeteras.TryGetValue(cuit, out var saldo)) return Error(404, "No existe billetera para ese cuit");
                if (saldo < monto) return Error(400, "Saldo insuficiente");

                estado.Billeteras[cuit] -= monto.Value;
                var mov = new JsonObject
                {
                    ["id_movimiento"] = $"bmov-{estado.Siguiente():D4}",
                    ["id_venta"] = idVenta,
                    ["cuit"] = cuit,
                    ["comercio_cuit"] = comercio,
                    ["monto"] = monto,
                    ["saldo_resultante"] = estado.Billeteras[cuit],
                    ["estado"] = "confirmado"
                };
                estado.PagosBilletera[idVenta] = mov;
                return Results.Json(mov, statusCode: 201);
            }
        });

        // ---- ARCA ----
        app.MapPost("/arca/comprobantes", async (HttpRequest req) =>
        {
            var b = await Leer(req);
            var idVenta = Str(b, "id_venta"); var cuit = Str(b, "cuit"); var monto = Num(b, "monto_total"); var tipo = Str(b, "tipo_comprobante");
            if (idVenta is null || cuit is null || monto is null or <= 0 || tipo is null)
                return Error(400, "id_venta, cuit, monto_total y tipo_comprobante son obligatorios");
            if (tipo is not ("FACTURA_A" or "FACTURA_B" or "FACTURA_C"))
                return Error(400, "tipo_comprobante debe ser FACTURA_A, FACTURA_B o FACTURA_C");
            lock (estado)
            {
                if (estado.Comprobantes.TryGetValue(idVenta, out var previo))
                    return Num(previo, "monto_total") == monto
                        ? Results.Ok(previo)
                        : Error(409, "id_venta ya usado con otros datos");
                var numero = ++estado.UltimoComprobante;
                var comp = new JsonObject
                {
                    ["id"] = $"comprobante-{numero:D4}",
                    ["id_venta"] = idVenta,
                    ["cuit"] = cuit,
                    ["numero_comprobante"] = $"00001-{numero:D8}",
                    ["tipo_comprobante"] = tipo,
                    ["monto_total"] = monto,
                    ["cae"] = $"FICTICIO-{Random.Shared.NextInt64(10_000_000_000_000, 99_999_999_999_999)}",
                    ["fecha_emision"] = Ahora(),
                    ["estado"] = "emitido"
                };
                estado.Comprobantes[idVenta] = comp;
                return Results.Json(comp, statusCode: 201);
            }
        });

        return app;
    }

    private static IResult Error(int status, string mensaje) => Results.Json(new { error = mensaje }, statusCode: status);

    private static string Ahora() => DateTime.UtcNow.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'", CultureInfo.InvariantCulture);

    private static async Task<JsonObject> Leer(HttpRequest req)
    {
        try { return (await JsonNode.ParseAsync(req.Body)) as JsonObject ?? new JsonObject(); }
        catch (JsonException) { return new JsonObject(); }
    }

    private static string? Str(JsonObject o, string campo) =>
        o[campo] is JsonValue v && v.TryGetValue<string>(out var s) && s.Length > 0 ? s : null;

    private static decimal? Num(JsonObject o, string campo) =>
        o[campo] is JsonValue v && v.TryGetValue<decimal>(out var d) ? d : null;
}

/// <summary>Estado en memoria con datos ficticios. Se reinicia con cada arranque.</summary>
public sealed class Estado
{
    private readonly HashSet<string> _caidos = new(StringComparer.OrdinalIgnoreCase);
    private int _secuencia;

    public int Siguiente() => Interlocked.Increment(ref _secuencia);
    public int UltimoComprobante;

    public Dictionary<string, object> Comercios { get; } = new()
    {
        ["30712345678"] = new { cuit = "30712345678", razon_social = "Almacén de la Feria", rubro = "Alimentos", estado = "activo" },
        ["30722222225"] = new { cuit = "30722222225", razon_social = "Librería Punto y Coma", rubro = "Librería", estado = "activo" },
        ["30733333336"] = new { cuit = "30733333336", razon_social = "Ropero Urbano", rubro = "Indumentaria", estado = "activo" },
    };

    public Dictionary<string, decimal> Padron { get; } = new()
    {
        ["30712345678"] = 0.03m,
        ["30722222225"] = 0.025m,
        ["30733333336"] = 0.035m,
    };

    public Dictionary<string, decimal> CuentasBanco { get; } = new()
    {
        ["cuenta-cliente-1"] = 500_000m,
        ["cuenta-cliente-2"] = 2_000m,
        ["cuenta-comercio-9"] = 0m,
        ["cuenta-comercio-2"] = 0m,
        ["cuenta-comercio-3"] = 0m,
    };

    public Dictionary<string, decimal> Billeteras { get; } = new()
    {
        ["27123456789"] = 250_000m,
        ["20111111112"] = 1_500m,
    };

    public Dictionary<string, JsonObject> Percepciones { get; } = new();
    public Dictionary<string, JsonObject> PagosBanco { get; } = new();
    public Dictionary<string, JsonObject> PagosBilletera { get; } = new();
    public Dictionary<string, JsonObject> Comprobantes { get; } = new();

    public bool EstaCaido(string servicio) { lock (_caidos) return _caidos.Contains(servicio); }

    public void MarcarCaido(string servicio, bool caido)
    {
        lock (_caidos) { if (caido) _caidos.Add(servicio); else _caidos.Remove(servicio); }
    }

    public object Resumen()
    {
        lock (_caidos)
            return new
            {
                caidos = _caidos.ToArray(),
                cuentas_banco = CuentasBanco,
                billeteras = Billeteras,
                pagos_banco = PagosBanco.Count,
                pagos_billetera = PagosBilletera.Count,
                comprobantes = Comprobantes.Count
            };
    }
}
