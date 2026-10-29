using System.Text.RegularExpressions;

namespace Tpv.Api.Dominio;

/// <summary>Error que se devuelve al cliente con el formato común {"error":"mensaje"}.</summary>
public sealed class ErrorApi : Exception
{
    public int Status { get; }
    public IDictionary<string, object?>? Extra { get; }

    public ErrorApi(int status, string mensaje, IDictionary<string, object?>? extra = null) : base(mensaje)
    {
        Status = status;
        Extra = extra;
    }

    public static ErrorApi Invalido(string mensaje) => new(400, mensaje);
    public static ErrorApi NoEncontrado(string mensaje) => new(404, mensaje);
    public static ErrorApi Conflicto(string mensaje) => new(409, mensaje);
}

public static partial class Validar
{
    [GeneratedRegex("^[0-9]{11}$")]
    private static partial Regex CuitRegex();

    [GeneratedRegex("^[A-Za-z0-9._-]{1,64}$")]
    private static partial Regex IdRegex();

    public static string Cuit(string? valor, string campo)
    {
        if (string.IsNullOrWhiteSpace(valor))
            throw ErrorApi.Invalido($"{campo} es obligatorio");
        if (!CuitRegex().IsMatch(valor))
            throw ErrorApi.Invalido($"{campo} debe ser un string de 11 dígitos, sin puntos ni guiones");
        return valor;
    }

    public static string Id(string? valor, string campo)
    {
        if (string.IsNullOrWhiteSpace(valor))
            throw ErrorApi.Invalido($"{campo} es obligatorio");
        if (!IdRegex().IsMatch(valor))
            throw ErrorApi.Invalido($"{campo} admite hasta 64 caracteres: letras, números, punto, guion o guion bajo");
        return valor;
    }

    public static string Texto(string? valor, string campo, int max = 120)
    {
        var limpio = valor?.Trim();
        if (string.IsNullOrEmpty(limpio))
            throw ErrorApi.Invalido($"{campo} es obligatorio");
        if (limpio.Length > max)
            throw ErrorApi.Invalido($"{campo} admite hasta {max} caracteres");
        return limpio;
    }

    public static decimal Precio(decimal? valor, string campo)
    {
        if (valor is null)
            throw ErrorApi.Invalido($"{campo} es obligatorio");
        if (valor <= 0)
            throw ErrorApi.Invalido($"{campo} debe ser mayor a 0");
        if (Dinero.TieneMasDeDosDecimales(valor.Value))
            throw ErrorApi.Invalido($"{campo} admite hasta dos decimales");
        if (valor > 100_000_000m)
            throw ErrorApi.Invalido($"{campo} es demasiado alto");
        return valor.Value;
    }

    public static int Stock(int? valor, string campo)
    {
        if (valor is null)
            throw ErrorApi.Invalido($"{campo} es obligatorio");
        if (valor < 0 || valor > 1_000_000)
            throw ErrorApi.Invalido($"{campo} debe estar entre 0 y 1000000");
        return valor.Value;
    }
}
