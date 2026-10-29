namespace Tpv.Api.Dominio;

/// <summary>
/// El dinero se guarda como centavos enteros y se expone en pesos con hasta dos decimales,
/// como pide el contrato común.
/// </summary>
public static class Dinero
{
    public static decimal APesos(long centavos) => centavos / 100m;

    public static decimal? APesos(long? centavos) => centavos is null ? null : centavos.Value / 100m;

    public static long ACentavos(decimal pesos) =>
        (long)Math.Round(pesos * 100m, 0, MidpointRounding.AwayFromZero);

    public static decimal Redondear(decimal pesos) =>
        Math.Round(pesos, 2, MidpointRounding.AwayFromZero);

    public static bool TieneMasDeDosDecimales(decimal pesos) => Redondear(pesos) != pesos;
}
