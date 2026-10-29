namespace Tpv.Api;

/// <summary>
/// Toda la configuración sale de variables de entorno (ver .env.example).
/// Dentro de Docker Compose las URLs usan el nombre del servicio, por ejemplo http://banco:3002.
/// </summary>
public sealed class ConfiguracionTpv
{
    public string RutaBaseDatos { get; init; } = "data/tpv.db";
    public int TimeoutMs { get; init; } = 5000;
    public string TipoComprobante { get; init; } = "FACTURA_B";
    public IReadOnlyDictionary<string, string?> Urls { get; init; } = new Dictionary<string, string?>();

    public static readonly string[] Servicios = { "municipio", "arba", "banco", "billetera", "arca" };

    public string? Url(string servicio) => Urls.TryGetValue(servicio, out var url) ? url : null;

    public static ConfiguracionTpv Desde(IConfiguration c)
    {
        var urls = Servicios.ToDictionary(
            s => s,
            s => c[$"{s.ToUpperInvariant()}_URL"] is { Length: > 0 } u ? u.TrimEnd('/') : null);

        return new ConfiguracionTpv
        {
            RutaBaseDatos = c["DB_PATH"] is { Length: > 0 } ruta ? ruta : "data/tpv.db",
            TimeoutMs = int.TryParse(c["HTTP_TIMEOUT_MS"], out var t) && t > 0 ? t : 5000,
            TipoComprobante = c["TIPO_COMPROBANTE"] is { Length: > 0 } tipo ? tipo : "FACTURA_B",
            Urls = urls
        };
    }
}
