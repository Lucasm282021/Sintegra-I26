using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Tpv.Api.Integraciones;
using Xunit;

namespace Tpv.Api.Tests;

/// <summary>
/// Levanta el TPV en memoria y lo conecta a los servicios simulados (también en memoria).
/// Todas las llamadas HTTP del TPV a Municipio, ARBA, Banco, Billetera y ARCA llegan a los simuladores.
/// </summary>
public sealed class Entorno : IDisposable
{
    public WebApplicationFactory<Simuladores.Program> Simuladores { get; }
    public WebApplicationFactory<Program> Tpv { get; }
    public HttpClient Cliente { get; }
    public HttpClient ControlSimuladores { get; }
    private readonly string _carpeta;

    public Entorno()
    {
        _carpeta = Path.Combine(Path.GetTempPath(), "tpv-pruebas-" + Guid.NewGuid().ToString("N"));
        Simuladores = new WebApplicationFactory<Simuladores.Program>();
        var manejador = Simuladores.Server.CreateHandler();

        Tpv = new WebApplicationFactory<Program>().WithWebHostBuilder(b =>
        {
            b.UseSetting("DB_PATH", Path.Combine(_carpeta, "tpv.db"));
            b.UseSetting("MUNICIPIO_URL", "http://municipio:3005");
            b.UseSetting("ARBA_URL", "http://arba:3003");
            b.UseSetting("BANCO_URL", "http://banco:3002");
            b.UseSetting("BILLETERA_URL", "http://billetera:3006");
            b.UseSetting("ARCA_URL", "http://arca:3004");
            b.UseSetting("HTTP_TIMEOUT_MS", "3000");
            b.ConfigureTestServices(s =>
                s.AddHttpClient(ServiciosExternos.NombreCliente).ConfigurePrimaryHttpMessageHandler(() => manejador));
        });

        Cliente = Tpv.CreateClient();
        ControlSimuladores = Simuladores.CreateClient();
    }

    public Task CaerServicio(string servicio, bool caido) =>
        ControlSimuladores.PostAsJsonAsync("/_simulador/caidas", new { servicio, caido });

    public async Task<JsonElement> EstadoSimuladores() =>
        await ControlSimuladores.GetFromJsonAsync<JsonElement>("/_simulador/estado");

    public void Dispose()
    {
        Cliente.Dispose();
        Tpv.Dispose();
        Simuladores.Dispose();
        try { Directory.Delete(_carpeta, recursive: true); } catch { /* temporal */ }
    }
}

public sealed class VentasTests : IClassFixture<Entorno>
{
    private readonly Entorno _e;
    public VentasTests(Entorno e) => _e = e;

    private static object VentaBanco(string id, string producto = "prod-1", int cantidad = 2, string cuenta = "cuenta-cliente-1") => new
    {
        id_venta = id,
        comercio_cuit = "30712345678",
        items = new[] { new { producto_id = producto, cantidad } },
        medio_pago = "banco",
        cuenta_origen = cuenta
    };

    private async Task<(HttpStatusCode Status, JsonElement Json)> Post(object cuerpo)
    {
        var r = await _e.Cliente.PostAsJsonAsync("/tpv/ventas", cuerpo);
        return (r.StatusCode, await r.Content.ReadFromJsonAsync<JsonElement>());
    }

    [Fact]
    public async Task Health_responde_ok()
    {
        var json = await _e.Cliente.GetFromJsonAsync<JsonElement>("/health");
        Assert.Equal("ok", json.GetProperty("status").GetString());
        Assert.Equal("tpv", json.GetProperty("servicio").GetString());
    }

    [Fact]
    public async Task Venta_con_banco_se_completa_y_calcula_importes_con_el_catalogo()
    {
        // El pedido no trae precios: el TPV los toma de su catálogo (alfajor $1.200).
        var (status, v) = await Post(VentaBanco("t-banco-ok"));

        Assert.Equal(HttpStatusCode.Created, status);
        Assert.Equal("COMPLETADA", v.GetProperty("estado").GetString());
        Assert.Equal(2400m, v.GetProperty("subtotal").GetDecimal());
        Assert.Equal(72m, v.GetProperty("percepcion").GetDecimal());   // 3 % del padrón simulado
        Assert.Equal(2472m, v.GetProperty("total").GetDecimal());
        Assert.Equal("confirmado", v.GetProperty("pago").GetProperty("estado").GetString());
        Assert.StartsWith("FICTICIO-", v.GetProperty("comprobante").GetProperty("cae").GetString());
    }

    [Fact]
    public async Task Venta_con_billetera_se_completa()
    {
        var (status, v) = await Post(new
        {
            id_venta = "t-billetera-ok",
            comercio_cuit = "30722222225",
            items = new[] { new { producto_id = "prod-12", cantidad = 3 } },
            medio_pago = "billetera",
            cuit_pagador = "27123456789"
        });

        Assert.Equal(HttpStatusCode.Created, status);
        Assert.Equal("COMPLETADA", v.GetProperty("estado").GetString());
        Assert.Equal("billetera", v.GetProperty("pago").GetProperty("medio").GetString());
    }

    [Fact]
    public async Task Repetir_la_misma_venta_devuelve_200_y_no_cobra_dos_veces()
    {
        var (s1, v1) = await Post(VentaBanco("t-idempotente"));
        var pagosAntes = (await _e.EstadoSimuladores()).GetProperty("pagos_banco").GetInt32();

        var (s2, v2) = await Post(VentaBanco("t-idempotente"));
        var pagosDespues = (await _e.EstadoSimuladores()).GetProperty("pagos_banco").GetInt32();

        Assert.Equal(HttpStatusCode.Created, s1);
        Assert.Equal(HttpStatusCode.OK, s2);
        Assert.Equal(pagosAntes, pagosDespues);
        Assert.Equal(
            v1.GetProperty("comprobante").GetProperty("id").GetString(),
            v2.GetProperty("comprobante").GetProperty("id").GetString());
    }

    [Fact]
    public async Task Misma_clave_con_otros_datos_devuelve_409()
    {
        await Post(VentaBanco("t-conflicto", cantidad: 1));
        var (status, json) = await Post(VentaBanco("t-conflicto", cantidad: 5));

        Assert.Equal(HttpStatusCode.Conflict, status);
        Assert.True(json.TryGetProperty("error", out _));
    }

    [Fact]
    public async Task Si_ARCA_se_cae_la_venta_queda_pendiente_y_el_reintento_no_vuelve_a_cobrar()
    {
        await _e.CaerServicio("arca", true);
        try
        {
            var (s1, error) = await Post(VentaBanco("t-arca-caida", producto: "prod-4", cantidad: 1));
            Assert.Equal(HttpStatusCode.ServiceUnavailable, s1);
            Assert.Equal("PENDIENTE", error.GetProperty("estado").GetString());
            Assert.Equal("comprobante_emitido", error.GetProperty("etapa_pendiente").GetString());

            // El pago ya quedó confirmado y guardado; no hay CAE inventado.
            var guardada = await _e.Cliente.GetFromJsonAsync<JsonElement>("/tpv/ventas/t-arca-caida");
            Assert.NotEqual(JsonValueKind.Null, guardada.GetProperty("pago").GetProperty("id_movimiento").ValueKind);
            Assert.Equal(JsonValueKind.Null, guardada.GetProperty("comprobante").ValueKind);
        }
        finally
        {
            await _e.CaerServicio("arca", false);
        }

        var pagosAntes = (await _e.EstadoSimuladores()).GetProperty("pagos_banco").GetInt32();
        var (s2, v) = await Post(VentaBanco("t-arca-caida", producto: "prod-4", cantidad: 1));
        var pagosDespues = (await _e.EstadoSimuladores()).GetProperty("pagos_banco").GetInt32();

        Assert.Equal(HttpStatusCode.OK, s2);
        Assert.Equal("COMPLETADA", v.GetProperty("estado").GetString());
        Assert.Equal(2, v.GetProperty("intentos").GetInt32());
        Assert.Equal(pagosAntes, pagosDespues);
    }

    [Fact]
    public async Task Saldo_insuficiente_deja_la_venta_en_error_y_no_descuenta_stock()
    {
        var antes = await _e.Cliente.GetFromJsonAsync<JsonElement>("/tpv/productos/prod-5");
        var (status, json) = await Post(VentaBanco("t-sin-saldo", producto: "prod-5", cantidad: 1, cuenta: "cuenta-cliente-2"));
        var despues = await _e.Cliente.GetFromJsonAsync<JsonElement>("/tpv/productos/prod-5");

        Assert.Equal(HttpStatusCode.BadRequest, status);
        Assert.Equal("ERROR", json.GetProperty("estado").GetString());
        Assert.Contains("insuficiente", json.GetProperty("error").GetString(), StringComparison.OrdinalIgnoreCase);
        Assert.Equal(antes.GetProperty("stock").GetInt32(), despues.GetProperty("stock").GetInt32());
    }

    [Fact]
    public async Task Una_venta_completada_descuenta_stock()
    {
        var antes = (await _e.Cliente.GetFromJsonAsync<JsonElement>("/tpv/productos/prod-8")).GetProperty("stock").GetInt32();
        await Post(VentaBanco("t-stock", producto: "prod-8", cantidad: 3));
        var despues = (await _e.Cliente.GetFromJsonAsync<JsonElement>("/tpv/productos/prod-8")).GetProperty("stock").GetInt32();

        Assert.Equal(antes - 3, despues);
    }

    [Theory]
    [InlineData("""{"id_venta":"x1","comercio_cuit":"30-71234567-8","items":[{"producto_id":"prod-1","cantidad":1}],"medio_pago":"banco","cuenta_origen":"cuenta-cliente-1"}""")]
    [InlineData("""{"id_venta":"x2","comercio_cuit":"30712345678","items":[],"medio_pago":"banco","cuenta_origen":"cuenta-cliente-1"}""")]
    [InlineData("""{"id_venta":"x3","comercio_cuit":"30712345678","items":[{"producto_id":"prod-1","cantidad":1}],"medio_pago":"efectivo"}""")]
    [InlineData("""{"id_venta":"x4","comercio_cuit":"30712345678","items":[{"producto_id":"prod-1","cantidad":1}],"medio_pago":"banco","cuenta_origen":"cuenta-cliente-1","cuit_pagador":"27123456789"}""")]
    [InlineData("""{"id_venta":"x5","comercio_cuit":"30712345678","items":[{"producto_id":"prod-1","cantidad":0}],"medio_pago":"banco","cuenta_origen":"cuenta-cliente-1"}""")]
    [InlineData("""{"id_venta":"x6","comercio_cuit":"30712345678","items":[{"producto_id":"prod-1","cantidad":"dos"}],"medio_pago":"banco","cuenta_origen":"cuenta-cliente-1"}""")]
    public async Task Datos_invalidos_devuelven_400_con_formato_de_error_comun(string cuerpo)
    {
        var r = await _e.Cliente.PostAsync("/tpv/ventas", new StringContent(cuerpo, System.Text.Encoding.UTF8, "application/json"));
        var json = await r.Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        Assert.Equal(JsonValueKind.String, json.GetProperty("error").ValueKind);
        Assert.Single(json.EnumerateObject());
    }

    [Fact]
    public async Task Producto_de_otro_comercio_o_inexistente_devuelve_404()
    {
        var (status, _) = await Post(VentaBanco("t-404", producto: "prod-21"));  // prod-21 es de Ropero Urbano
        Assert.Equal(HttpStatusCode.NotFound, status);
    }

    [Fact]
    public async Task Consultar_venta_inexistente_devuelve_404_en_json()
    {
        var r = await _e.Cliente.GetAsync("/tpv/ventas/no-existe");
        Assert.Equal(HttpStatusCode.NotFound, r.StatusCode);
        Assert.Equal("application/json", r.Content.Headers.ContentType?.MediaType);
    }
}
