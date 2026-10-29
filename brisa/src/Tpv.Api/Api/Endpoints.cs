using System.Globalization;
using System.Text.Json;
using Tpv.Api.Datos;
using Tpv.Api.Dominio;
using Tpv.Api.Integraciones;
using Tpv.Api.Ventas;

namespace Tpv.Api.Api;

public static class Endpoints
{
    public static void Mapear(WebApplication app)
    {
        app.MapGet("/health", () => Results.Ok(new { status = "ok", servicio = "tpv" }));

        MapearVentas(app);
        MapearProductos(app);
        MapearComercios(app);

        // Estado de las conexiones para la pantalla de caja. No expone URLs ni secretos.
        app.MapGet("/tpv/integraciones", async (ServiciosExternos servicios, ConfiguracionTpv config, CancellationToken ct) =>
        {
            var chequeos = ConfiguracionTpv.Servicios.Select(async s =>
            {
                if (config.Url(s) is null)
                    return new { servicio = s, nombre = ServiciosExternos.Nombre(s), estado = "sin_configurar" };
                // Algunos módulos todavía no exponen /health: si el servidor contesta
                // (aunque sea 404), está en línea.
                var r = await servicios.Get(s, "/health", ct);
                return new { servicio = s, nombre = ServiciosExternos.Nombre(s), estado = r.Ok || !r.NoDisponible ? "ok" : "sin_respuesta" };
            });
            return Results.Ok(await Task.WhenAll(chequeos));
        });
    }

    // ---------- Ventas ----------

    private static void MapearVentas(WebApplication app)
    {
        app.MapPost("/tpv/ventas", async (HttpRequest req, CoordinadorVentas coordinador, CancellationToken ct) =>
        {
            var pedido = await LeerJson<PedidoVenta>(req);
            var resultado = await coordinador.Registrar(pedido, ct);
            var venta = resultado.Venta;

            if (venta.Estado == EstadoVenta.Completada)
            {
                var dto = VentaDto.De(venta);
                return resultado.Creada
                    ? Results.Created($"/tpv/ventas/{venta.IdVenta}", dto)
                    : Results.Ok(dto);
            }

            // La venta quedó guardada pero incompleta: se informa con el formato de error común
            // más los datos necesarios para consultarla o reintentarla.
            var status = venta.Estado == EstadoVenta.Pendiente ? 503 : 400;
            return Results.Json(new
            {
                error = venta.UltimoError,
                id_venta = venta.IdVenta,
                estado = venta.Estado,
                etapa_pendiente = venta.EtapaPendiente
            }, statusCode: status);
        });

        app.MapGet("/tpv/ventas/{id}", (string id, Repositorio repo) =>
        {
            var venta = repo.ObtenerVenta(id) ?? throw ErrorApi.NoEncontrado($"No existe la venta {id}");
            return Results.Ok(VentaDto.De(venta));
        });

        app.MapGet("/tpv/ventas", (HttpRequest req, Repositorio repo) =>
        {
            var q = req.Query;
            var estado = q["estado"].ToString().ToUpperInvariant();
            if (estado.Length > 0 && estado is not (EstadoVenta.Pendiente or EstadoVenta.Error or EstadoVenta.Completada))
                throw ErrorApi.Invalido("estado debe ser PENDIENTE, ERROR o COMPLETADA");

            var desde = Fecha(q["desde"], "desde", 0);
            var hasta = Fecha(q["hasta"], "hasta", 1);
            var limite = int.TryParse(q["limit"], out var l) ? Math.Clamp(l, 1, 500) : 200;

            var ventas = repo.ListarVentas(Nulo(q["comercio_cuit"]), Nulo(estado), desde, hasta, Nulo(q["q"]), limite);
            return Results.Ok(ventas.Select(VentaResumenDto.De));
        });
    }

    private static string? Fecha(string? valor, string campo, int diasExtra)
    {
        if (string.IsNullOrEmpty(valor)) return null;
        if (!DateTime.TryParseExact(valor, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var d))
            throw ErrorApi.Invalido($"{campo} debe tener formato YYYY-MM-DD");
        return d.AddDays(diasExtra).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
    }

    // ---------- Productos ----------

    private static void MapearProductos(WebApplication app)
    {
        app.MapGet("/tpv/productos", (HttpRequest req, Repositorio repo) =>
        {
            var q = req.Query;
            var incluirInactivos = q["incluir_inactivos"] == "true";
            var cuit = Nulo(q["comercio_cuit"]);
            if (cuit is not null) Validar.Cuit(cuit, "comercio_cuit");
            return Results.Ok(repo.ListarProductos(cuit, Nulo(q["q"]), incluirInactivos).Select(ProductoDto.De));
        });

        app.MapGet("/tpv/productos/{id}", (string id, Repositorio repo) =>
        {
            var p = repo.ObtenerProducto(id) ?? throw ErrorApi.NoEncontrado($"No existe el producto {id}");
            return Results.Ok(ProductoDto.De(p));
        });

        app.MapPost("/tpv/productos", async (HttpRequest req, Repositorio repo) =>
        {
            var e = await LeerJson<ProductoEntrada>(req) ?? throw ErrorApi.Invalido("El cuerpo es obligatorio");
            var cuit = Validar.Cuit(e.ComercioCuit, "comercio_cuit");
            if (repo.ObtenerComercio(cuit) is null)
                throw ErrorApi.NoEncontrado($"El comercio {cuit} no está registrado en el TPV");

            var p = new Producto
            {
                Id = "prod-" + Guid.NewGuid().ToString("N")[..8],
                ComercioCuit = cuit,
                Nombre = Validar.Texto(e.Nombre, "nombre", 80),
                Categoria = Validar.Texto(e.Categoria, "categoria", 40),
                PrecioCentavos = Dinero.ACentavos(Validar.Precio(e.Precio, "precio")),
                Stock = Validar.Stock(e.Stock, "stock"),
                Activo = e.Activo ?? true
            };
            repo.GuardarProducto(p, nuevo: true);
            return Results.Created($"/tpv/productos/{p.Id}", ProductoDto.De(p));
        });

        app.MapPut("/tpv/productos/{id}", async (string id, HttpRequest req, Repositorio repo) =>
        {
            var p = repo.ObtenerProducto(id) ?? throw ErrorApi.NoEncontrado($"No existe el producto {id}");
            var e = await LeerJson<ProductoEntrada>(req) ?? throw ErrorApi.Invalido("El cuerpo es obligatorio");
            if (e.ComercioCuit is not null && e.ComercioCuit != p.ComercioCuit)
                throw ErrorApi.Invalido("Un producto no puede cambiar de comercio");

            if (e.Nombre is not null) p.Nombre = Validar.Texto(e.Nombre, "nombre", 80);
            if (e.Categoria is not null) p.Categoria = Validar.Texto(e.Categoria, "categoria", 40);
            if (e.Precio is not null) p.PrecioCentavos = Dinero.ACentavos(Validar.Precio(e.Precio, "precio"));
            if (e.Stock is not null) p.Stock = Validar.Stock(e.Stock, "stock");
            if (e.Activo is not null) p.Activo = e.Activo.Value;
            repo.GuardarProducto(p, nuevo: false);
            return Results.Ok(ProductoDto.De(p));
        });
    }

    // ---------- Comercios ----------

    private static void MapearComercios(WebApplication app)
    {
        app.MapGet("/tpv/comercios", (Repositorio repo) => Results.Ok(repo.ListarComercios().Select(ComercioDto.De)));

        app.MapGet("/tpv/comercios/{cuit}", (string cuit, Repositorio repo) =>
        {
            Validar.Cuit(cuit, "cuit");
            var c = repo.ObtenerComercio(cuit) ?? throw ErrorApi.NoEncontrado($"El comercio {cuit} no está registrado en el TPV");
            return Results.Ok(ComercioDto.De(c));
        });

        app.MapPost("/tpv/comercios", async (HttpRequest req, Repositorio repo) =>
        {
            var e = await LeerJson<ComercioEntrada>(req) ?? throw ErrorApi.Invalido("El cuerpo es obligatorio");
            var cuit = Validar.Cuit(e.Cuit, "cuit");
            if (repo.ObtenerComercio(cuit) is not null)
                throw ErrorApi.Conflicto($"Ya existe un comercio con CUIT {cuit}");

            var c = new Comercio
            {
                Cuit = cuit,
                RazonSocial = Validar.Texto(e.RazonSocial, "razon_social", 80),
                Rubro = Validar.Texto(e.Rubro, "rubro", 40),
                CuentaDestino = string.IsNullOrWhiteSpace(e.CuentaDestino) ? null : Validar.Id(e.CuentaDestino.Trim(), "cuenta_destino"),
                Activo = e.Activo ?? true
            };
            repo.GuardarComercio(c, nuevo: true);
            return Results.Created($"/tpv/comercios/{c.Cuit}", ComercioDto.De(c));
        });

        app.MapPut("/tpv/comercios/{cuit}", async (string cuit, HttpRequest req, Repositorio repo) =>
        {
            var c = repo.ObtenerComercio(cuit) ?? throw ErrorApi.NoEncontrado($"El comercio {cuit} no está registrado en el TPV");
            var e = await LeerJson<ComercioEntrada>(req) ?? throw ErrorApi.Invalido("El cuerpo es obligatorio");
            if (e.Cuit is not null && e.Cuit != cuit)
                throw ErrorApi.Invalido("El CUIT de un comercio no se puede modificar");

            if (e.RazonSocial is not null) c.RazonSocial = Validar.Texto(e.RazonSocial, "razon_social", 80);
            if (e.Rubro is not null) c.Rubro = Validar.Texto(e.Rubro, "rubro", 40);
            if (e.CuentaDestino is not null)
                c.CuentaDestino = e.CuentaDestino.Trim().Length == 0 ? null : Validar.Id(e.CuentaDestino.Trim(), "cuenta_destino");
            if (e.Activo is not null) c.Activo = e.Activo.Value;
            repo.GuardarComercio(c, nuevo: false);
            return Results.Ok(ComercioDto.De(c));
        });
    }

    // ---------- Utilidades ----------

    private static string? Nulo(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    /// <summary>Lee el cuerpo JSON y convierte cualquier problema de formato en un 400 con el error común.</summary>
    private static async Task<T?> LeerJson<T>(HttpRequest req) where T : class
    {
        if (req.ContentLength == 0) return null;
        try
        {
            return await JsonSerializer.DeserializeAsync<T>(req.Body, Json.Opciones);
        }
        catch (JsonException ex)
        {
            var campo = string.IsNullOrEmpty(ex.Path) || ex.Path == "$" ? "" : $" en {ex.Path.TrimStart('$', '.')}";
            throw ErrorApi.Invalido($"JSON inválido{campo}: revisá tipos y formato");
        }
    }
}
