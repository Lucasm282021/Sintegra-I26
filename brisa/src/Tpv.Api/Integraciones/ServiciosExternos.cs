using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json;

namespace Tpv.Api.Integraciones;

/// <summary>Resultado de una llamada a otro módulo del ecosistema.</summary>
public sealed record Respuesta(bool Ok, bool NoDisponible, int Status, JsonElement Cuerpo, string? Error)
{
    public string? Texto(params string[] campos) => Json.Texto(Cuerpo, campos);
    public decimal? Numero(params string[] campos) => Json.Numero(Cuerpo, campos);
}

/// <summary>
/// Cliente HTTP único para Municipio, ARBA, Banco, Billetera y ARCA.
/// Timeout finito y errores explícitos: nunca convierte una falla en un éxito inventado.
/// </summary>
public sealed class ServiciosExternos
{
    public const string NombreCliente = "servicios-ecosistema";

    private static readonly Dictionary<string, string> Nombres = new()
    {
        ["municipio"] = "Municipio",
        ["arba"] = "ARBA",
        ["banco"] = "Banco",
        ["billetera"] = "Billetera",
        ["arca"] = "ARCA",
    };

    private readonly IHttpClientFactory _fabrica;
    private readonly ConfiguracionTpv _config;
    private readonly ILogger<ServiciosExternos> _log;

    public ServiciosExternos(IHttpClientFactory fabrica, ConfiguracionTpv config, ILogger<ServiciosExternos> log)
    {
        _fabrica = fabrica;
        _config = config;
        _log = log;
    }

    public static string Nombre(string servicio) => Nombres.TryGetValue(servicio, out var n) ? n : servicio;

    public Task<Respuesta> Get(string servicio, string ruta, CancellationToken ct = default) =>
        Enviar(servicio, HttpMethod.Get, ruta, null, ct);

    public Task<Respuesta> Post(string servicio, string ruta, object cuerpo, CancellationToken ct = default) =>
        Enviar(servicio, HttpMethod.Post, ruta, cuerpo, ct);

    private async Task<Respuesta> Enviar(string servicio, HttpMethod metodo, string ruta, object? cuerpo, CancellationToken ct)
    {
        var nombre = Nombre(servicio);
        var baseUrl = _config.Url(servicio);
        if (baseUrl is null)
            return new Respuesta(false, true, 0, default, $"{nombre} no está configurado (falta {servicio.ToUpperInvariant()}_URL)");

        var cliente = _fabrica.CreateClient(NombreCliente);
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeout.CancelAfter(_config.TimeoutMs);

        try
        {
            using var pedido = new HttpRequestMessage(metodo, baseUrl + ruta);
            if (cuerpo is not null)
                pedido.Content = JsonContent.Create(cuerpo, options: Json.Opciones);

            using var resp = await cliente.SendAsync(pedido, timeout.Token);
            var texto = await resp.Content.ReadAsStringAsync(timeout.Token);
            var json = Json.Desenvolver(Json.Parsear(texto));
            var status = (int)resp.StatusCode;

            if (status is >= 200 and < 300)
            {
                if (json.ValueKind != JsonValueKind.Object)
                    return new Respuesta(false, true, status, default, $"{nombre} respondió sin un JSON válido");
                return new Respuesta(true, false, status, json, null);
            }

            var mensaje = Json.MensajeDeError(json) ?? $"HTTP {status}";
            if (status >= 500 || status is 408 or 429)
                return new Respuesta(false, true, status, json, $"{nombre} no está disponible: {mensaje}");

            return new Respuesta(false, false, status, json, $"{nombre} rechazó la operación: {mensaje}");
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            _log.LogWarning("{Servicio} no respondió en {Timeout} ms ({Ruta})", nombre, _config.TimeoutMs, ruta);
            return new Respuesta(false, true, 0, default, $"{nombre} no respondió a tiempo");
        }
        catch (HttpRequestException ex)
        {
            _log.LogWarning("No se pudo conectar con {Servicio}: {Mensaje}", nombre, ex.Message);
            return new Respuesta(false, true, 0, default, $"No se pudo conectar con {nombre}");
        }
    }
}

/// <summary>Utilidades para leer respuestas JSON de otros equipos con tolerancia.</summary>
public static class Json
{
    public static readonly JsonSerializerOptions Opciones = new(JsonSerializerDefaults.Web)
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
    };

    public static JsonElement Parsear(string texto)
    {
        if (string.IsNullOrWhiteSpace(texto)) return default;
        try { return JsonDocument.Parse(texto).RootElement.Clone(); }
        catch (JsonException) { return default; }
    }

    /// <summary>
    /// Algunos módulos todavía responden {success, data, errors}. Si llega así, se toma "data".
    /// </summary>
    public static JsonElement Desenvolver(JsonElement json)
    {
        if (json.ValueKind == JsonValueKind.Object
            && json.TryGetProperty("success", out _)
            && json.TryGetProperty("data", out var data)
            && data.ValueKind == JsonValueKind.Object)
            return data;
        return json;
    }

    public static string? MensajeDeError(JsonElement json)
    {
        if (json.ValueKind != JsonValueKind.Object) return null;
        if (Texto(json, "error", "message", "mensaje") is { Length: > 0 } m) return m;
        if (json.TryGetProperty("errors", out var errores) && errores.ValueKind == JsonValueKind.Array)
        {
            foreach (var e in errores.EnumerateArray())
            {
                if (e.ValueKind == JsonValueKind.String) return e.GetString();
                if (e.ValueKind == JsonValueKind.Object && Texto(e, "message", "error", "mensaje") is { } em) return em;
            }
        }
        return null;
    }

    public static string? Texto(JsonElement json, params string[] campos)
    {
        if (json.ValueKind != JsonValueKind.Object) return null;
        foreach (var campo in campos)
        {
            if (!json.TryGetProperty(campo, out var v)) continue;
            switch (v.ValueKind)
            {
                case JsonValueKind.String: return v.GetString();
                case JsonValueKind.Number: return v.GetRawText();
                case JsonValueKind.True: return "true";
                case JsonValueKind.False: return "false";
            }
        }
        return null;
    }

    public static decimal? Numero(JsonElement json, params string[] campos)
    {
        if (json.ValueKind != JsonValueKind.Object) return null;
        foreach (var campo in campos)
        {
            if (!json.TryGetProperty(campo, out var v)) continue;
            if (v.ValueKind == JsonValueKind.Number && v.TryGetDecimal(out var d)) return d;
            if (v.ValueKind == JsonValueKind.String
                && decimal.TryParse(v.GetString(), NumberStyles.Number, CultureInfo.InvariantCulture, out var s)) return s;
        }
        return null;
    }
}
