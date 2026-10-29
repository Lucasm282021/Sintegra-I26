using System.Text.Json;
using Tpv.Api;
using Tpv.Api.Api;
using Tpv.Api.Datos;
using Tpv.Api.Dominio;
using Tpv.Api.Integraciones;
using Tpv.Api.Ventas;

var builder = WebApplication.CreateBuilder(args);

// Puerto del contrato: 3001 (configurable con PORT).
var puerto = builder.Configuration["PORT"] is { Length: > 0 } p ? p : "3001";
builder.WebHost.UseUrls($"http://0.0.0.0:{puerto}");

builder.Services.ConfigureHttpJsonOptions(o =>
{
    o.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower;
    o.SerializerOptions.DictionaryKeyPolicy = JsonNamingPolicy.SnakeCaseLower;
});

builder.Services.AddSingleton(sp => ConfiguracionTpv.Desde(sp.GetRequiredService<IConfiguration>()));
builder.Services.AddSingleton<BaseDatos>();
builder.Services.AddSingleton<Repositorio>();
builder.Services.AddHttpClient(ServiciosExternos.NombreCliente);
builder.Services.AddSingleton<ServiciosExternos>();
builder.Services.AddSingleton<CoordinadorVentas>();

var app = builder.Build();

app.Services.GetRequiredService<BaseDatos>().Inicializar();

// Errores de la API siempre con el formato común {"error":"mensaje"}.
app.Use(async (ctx, next) =>
{
    try
    {
        await next();
    }
    catch (ErrorApi ex)
    {
        await EscribirError(ctx, ex.Status, ex.Message);
    }
    catch (Exception ex) when (!ctx.Response.HasStarted)
    {
        app.Logger.LogError(ex, "Error no controlado en {Ruta}", ctx.Request.Path);
        await EscribirError(ctx, 500, "Error interno del TPV");
    }
});

// Rutas de API inexistentes → 404 en JSON (nunca una página HTML).
app.UseStatusCodePages(async ctx =>
{
    var http = ctx.HttpContext;
    if (EsApi(http.Request.Path) && !http.Response.HasStarted)
    {
        var mensaje = http.Response.StatusCode switch
        {
            404 => "Ruta no encontrada",
            405 => "Método no permitido para esta ruta",
            _ => "Solicitud no válida"
        };
        await EscribirError(http, http.Response.StatusCode, mensaje);
    }
});

// Pantallas de caja (HTML, CSS y JS sin dependencias) servidas desde wwwroot.
app.UseDefaultFiles();
app.UseStaticFiles();

Endpoints.Mapear(app);

app.Run();

static bool EsApi(PathString ruta) =>
    ruta.StartsWithSegments("/tpv") || ruta.StartsWithSegments("/health");

static Task EscribirError(HttpContext ctx, int status, string mensaje)
{
    ctx.Response.Clear();
    ctx.Response.StatusCode = status;
    return ctx.Response.WriteAsJsonAsync(new { error = mensaje });
}

/// <summary>Visible para las pruebas de integración.</summary>
public partial class Program;
