using System.Globalization;
using Microsoft.Data.Sqlite;
using Tpv.Api.Dominio;

namespace Tpv.Api.Datos;

/// <summary>Acceso a la base propia del TPV con SQL parametrizado.</summary>
public sealed class Repositorio
{
    private readonly BaseDatos _db;

    public Repositorio(BaseDatos db) => _db = db;

    // ---------- Comercios ----------

    public List<Comercio> ListarComercios()
    {
        using var cn = _db.Abrir();
        using var cmd = cn.CreateCommand();
        cmd.CommandText = "SELECT cuit, razon_social, rubro, cuenta_destino, activo FROM comercios ORDER BY razon_social";
        using var r = cmd.ExecuteReader();
        var lista = new List<Comercio>();
        while (r.Read()) lista.Add(LeerComercio(r));
        return lista;
    }

    public Comercio? ObtenerComercio(string cuit)
    {
        using var cn = _db.Abrir();
        using var cmd = cn.CreateCommand();
        cmd.CommandText = "SELECT cuit, razon_social, rubro, cuenta_destino, activo FROM comercios WHERE cuit = $c";
        cmd.Parameters.AddWithValue("$c", cuit);
        using var r = cmd.ExecuteReader();
        return r.Read() ? LeerComercio(r) : null;
    }

    public void GuardarComercio(Comercio c, bool nuevo)
    {
        using var cn = _db.Abrir();
        using var cmd = cn.CreateCommand();
        cmd.CommandText = nuevo
            ? "INSERT INTO comercios (cuit, razon_social, rubro, cuenta_destino, activo) VALUES ($c, $r, $ru, $cu, $a)"
            : "UPDATE comercios SET razon_social = $r, rubro = $ru, cuenta_destino = $cu, activo = $a WHERE cuit = $c";
        cmd.Parameters.AddWithValue("$c", c.Cuit);
        cmd.Parameters.AddWithValue("$r", c.RazonSocial);
        cmd.Parameters.AddWithValue("$ru", c.Rubro);
        cmd.Parameters.AddWithValue("$cu", (object?)c.CuentaDestino ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$a", c.Activo ? 1 : 0);
        cmd.ExecuteNonQuery();
    }

    private static Comercio LeerComercio(SqliteDataReader r) => new()
    {
        Cuit = r.GetString(0),
        RazonSocial = r.GetString(1),
        Rubro = r.GetString(2),
        CuentaDestino = r.IsDBNull(3) ? null : r.GetString(3),
        Activo = r.GetInt64(4) == 1
    };

    // ---------- Productos ----------

    public List<Producto> ListarProductos(string? comercioCuit, string? busqueda, bool incluirInactivos)
    {
        using var cn = _db.Abrir();
        using var cmd = cn.CreateCommand();
        var filtros = new List<string>();
        if (!string.IsNullOrEmpty(comercioCuit))
        {
            filtros.Add("comercio_cuit = $c");
            cmd.Parameters.AddWithValue("$c", comercioCuit);
        }
        if (!string.IsNullOrWhiteSpace(busqueda))
        {
            filtros.Add("(nombre LIKE $q OR categoria LIKE $q OR id LIKE $q)");
            cmd.Parameters.AddWithValue("$q", $"%{busqueda.Trim()}%");
        }
        if (!incluirInactivos) filtros.Add("activo = 1");

        cmd.CommandText = "SELECT id, comercio_cuit, nombre, categoria, precio_centavos, stock, activo FROM productos"
            + (filtros.Count > 0 ? " WHERE " + string.Join(" AND ", filtros) : "")
            + " ORDER BY categoria, nombre";
        using var r = cmd.ExecuteReader();
        var lista = new List<Producto>();
        while (r.Read()) lista.Add(LeerProducto(r));
        return lista;
    }

    public Producto? ObtenerProducto(string id)
    {
        using var cn = _db.Abrir();
        return ObtenerProducto(cn, null, id);
    }

    private static Producto? ObtenerProducto(SqliteConnection cn, SqliteTransaction? tx, string id)
    {
        using var cmd = cn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = "SELECT id, comercio_cuit, nombre, categoria, precio_centavos, stock, activo FROM productos WHERE id = $id";
        cmd.Parameters.AddWithValue("$id", id);
        using var r = cmd.ExecuteReader();
        return r.Read() ? LeerProducto(r) : null;
    }

    public void GuardarProducto(Producto p, bool nuevo)
    {
        using var cn = _db.Abrir();
        using var cmd = cn.CreateCommand();
        cmd.CommandText = nuevo
            ? """
              INSERT INTO productos (id, comercio_cuit, nombre, categoria, precio_centavos, stock, activo)
              VALUES ($id, $c, $n, $cat, $p, $s, $a)
              """
            : """
              UPDATE productos SET nombre = $n, categoria = $cat, precio_centavos = $p, stock = $s, activo = $a
              WHERE id = $id
              """;
        cmd.Parameters.AddWithValue("$id", p.Id);
        cmd.Parameters.AddWithValue("$c", p.ComercioCuit);
        cmd.Parameters.AddWithValue("$n", p.Nombre);
        cmd.Parameters.AddWithValue("$cat", p.Categoria);
        cmd.Parameters.AddWithValue("$p", p.PrecioCentavos);
        cmd.Parameters.AddWithValue("$s", p.Stock);
        cmd.Parameters.AddWithValue("$a", p.Activo ? 1 : 0);
        cmd.ExecuteNonQuery();
    }

    private static Producto LeerProducto(SqliteDataReader r) => new()
    {
        Id = r.GetString(0),
        ComercioCuit = r.GetString(1),
        Nombre = r.GetString(2),
        Categoria = r.GetString(3),
        PrecioCentavos = r.GetInt64(4),
        Stock = (int)r.GetInt64(5),
        Activo = r.GetInt64(6) == 1
    };

    // ---------- Ventas ----------

    public void InsertarVenta(Venta v)
    {
        using var cn = _db.Abrir();
        using var tx = cn.BeginTransaction();
        using (var cmd = cn.CreateCommand())
        {
            cmd.Transaction = tx;
            cmd.CommandText = """
                INSERT INTO ventas (id_venta, comercio_cuit, medio_pago, cuenta_origen, cuit_pagador, huella,
                    subtotal_centavos, estado, etapa, intentos, creada, actualizada)
                VALUES ($id, $c, $m, $co, $cp, $h, $s, $e, $et, 0, $cr, $cr)
                """;
            cmd.Parameters.AddWithValue("$id", v.IdVenta);
            cmd.Parameters.AddWithValue("$c", v.ComercioCuit);
            cmd.Parameters.AddWithValue("$m", v.MedioPago);
            cmd.Parameters.AddWithValue("$co", (object?)v.CuentaOrigen ?? DBNull.Value);
            cmd.Parameters.AddWithValue("$cp", (object?)v.CuitPagador ?? DBNull.Value);
            cmd.Parameters.AddWithValue("$h", v.Huella);
            cmd.Parameters.AddWithValue("$s", v.SubtotalCentavos);
            cmd.Parameters.AddWithValue("$e", v.Estado);
            cmd.Parameters.AddWithValue("$et", v.Etapa);
            cmd.Parameters.AddWithValue("$cr", v.Creada);
            cmd.ExecuteNonQuery();
        }

        var nro = 1;
        foreach (var l in v.Lineas)
        {
            using var cmd = cn.CreateCommand();
            cmd.Transaction = tx;
            cmd.CommandText = """
                INSERT INTO venta_lineas (id_venta, nro, producto_id, nombre, precio_unitario_centavos, cantidad)
                VALUES ($id, $n, $p, $nom, $pu, $c)
                """;
            cmd.Parameters.AddWithValue("$id", v.IdVenta);
            cmd.Parameters.AddWithValue("$n", nro++);
            cmd.Parameters.AddWithValue("$p", l.ProductoId);
            cmd.Parameters.AddWithValue("$nom", l.Nombre);
            cmd.Parameters.AddWithValue("$pu", l.PrecioUnitarioCentavos);
            cmd.Parameters.AddWithValue("$c", l.Cantidad);
            cmd.ExecuteNonQuery();
        }
        tx.Commit();
    }

    /// <summary>Guarda el avance de la venta (estado, etapa e IDs externos).</summary>
    public void ActualizarVenta(Venta v)
    {
        using var cn = _db.Abrir();
        using var cmd = cn.CreateCommand();
        ActualizarVenta(cmd, v);
    }

    /// <summary>
    /// Registra el pago confirmado y descuenta el stock en una sola transacción,
    /// así nunca queda un pago guardado sin su descuento de stock (ni al revés).
    /// </summary>
    public void ConfirmarPagoYDescontarStock(Venta v)
    {
        using var cn = _db.Abrir();
        using var tx = cn.BeginTransaction();
        foreach (var l in v.Lineas)
        {
            using var cmd = cn.CreateCommand();
            cmd.Transaction = tx;
            // MAX(..., 0): el pago ya se cobró, el stock no puede bloquear el registro.
            cmd.CommandText = "UPDATE productos SET stock = MAX(stock - $c, 0) WHERE id = $id";
            cmd.Parameters.AddWithValue("$c", l.Cantidad);
            cmd.Parameters.AddWithValue("$id", l.ProductoId);
            cmd.ExecuteNonQuery();
        }
        using (var cmd = cn.CreateCommand())
        {
            cmd.Transaction = tx;
            ActualizarVenta(cmd, v);
        }
        tx.Commit();
    }

    private static void ActualizarVenta(SqliteCommand cmd, Venta v)
    {
        v.Actualizada = Reloj.Ahora();
        cmd.CommandText = """
            UPDATE ventas SET
                percepcion_centavos = $pc, alicuota = $al, total_centavos = $tc,
                estado = $e, etapa = $et, ultimo_error = $err, intentos = $in,
                comercio_validado = $cv, percepcion_id = $pid, pago_id = $pgid, pago_estado = $pge,
                comprobante_id = $cid, comprobante_numero = $cn, comprobante_tipo = $ct, cae = $cae,
                comprobante_fecha = $cf, actualizada = $act
            WHERE id_venta = $id
            """;
        cmd.Parameters.AddWithValue("$id", v.IdVenta);
        cmd.Parameters.AddWithValue("$pc", (object?)v.PercepcionCentavos ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$al", v.Alicuota is null ? DBNull.Value : v.Alicuota.Value.ToString(CultureInfo.InvariantCulture));
        cmd.Parameters.AddWithValue("$tc", (object?)v.TotalCentavos ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$e", v.Estado);
        cmd.Parameters.AddWithValue("$et", v.Etapa);
        cmd.Parameters.AddWithValue("$err", (object?)v.UltimoError ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$in", v.Intentos);
        cmd.Parameters.AddWithValue("$cv", v.ComercioValidado ? 1 : 0);
        cmd.Parameters.AddWithValue("$pid", (object?)v.PercepcionId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$pgid", (object?)v.PagoId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$pge", (object?)v.PagoEstado ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$cid", (object?)v.ComprobanteId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$cn", (object?)v.ComprobanteNumero ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$ct", (object?)v.ComprobanteTipo ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$cae", (object?)v.Cae ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$cf", (object?)v.ComprobanteFecha ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$act", v.Actualizada);
        cmd.ExecuteNonQuery();
    }

    private const string SelectVenta = """
        SELECT v.id_venta, v.comercio_cuit, COALESCE(c.razon_social, ''), v.medio_pago, v.cuenta_origen, v.cuit_pagador,
               v.huella, v.subtotal_centavos, v.percepcion_centavos, v.alicuota, v.total_centavos, v.estado, v.etapa,
               v.ultimo_error, v.intentos, v.comercio_validado, v.percepcion_id, v.pago_id, v.pago_estado,
               v.comprobante_id, v.comprobante_numero, v.comprobante_tipo, v.cae, v.comprobante_fecha,
               v.creada, v.actualizada
        FROM ventas v LEFT JOIN comercios c ON c.cuit = v.comercio_cuit
        """;

    public Venta? ObtenerVenta(string idVenta)
    {
        using var cn = _db.Abrir();
        Venta? venta;
        using (var cmd = cn.CreateCommand())
        {
            cmd.CommandText = SelectVenta + " WHERE v.id_venta = $id";
            cmd.Parameters.AddWithValue("$id", idVenta);
            using var r = cmd.ExecuteReader();
            venta = r.Read() ? LeerVenta(r) : null;
        }
        if (venta is null) return null;

        using (var cmd = cn.CreateCommand())
        {
            cmd.CommandText = """
                SELECT producto_id, nombre, precio_unitario_centavos, cantidad
                FROM venta_lineas WHERE id_venta = $id ORDER BY nro
                """;
            cmd.Parameters.AddWithValue("$id", idVenta);
            using var r = cmd.ExecuteReader();
            while (r.Read())
            {
                venta.Lineas.Add(new LineaVenta
                {
                    ProductoId = r.GetString(0),
                    Nombre = r.GetString(1),
                    PrecioUnitarioCentavos = r.GetInt64(2),
                    Cantidad = (int)r.GetInt64(3)
                });
            }
        }
        return venta;
    }

    public List<Venta> ListarVentas(string? comercioCuit, string? estado, string? desde, string? hasta, string? busqueda, int limite)
    {
        using var cn = _db.Abrir();
        using var cmd = cn.CreateCommand();
        var filtros = new List<string>();
        if (!string.IsNullOrEmpty(comercioCuit)) { filtros.Add("v.comercio_cuit = $c"); cmd.Parameters.AddWithValue("$c", comercioCuit); }
        if (!string.IsNullOrEmpty(estado)) { filtros.Add("v.estado = $e"); cmd.Parameters.AddWithValue("$e", estado); }
        if (!string.IsNullOrEmpty(desde)) { filtros.Add("v.creada >= $d"); cmd.Parameters.AddWithValue("$d", desde); }
        if (!string.IsNullOrEmpty(hasta)) { filtros.Add("v.creada < $h"); cmd.Parameters.AddWithValue("$h", hasta); }
        if (!string.IsNullOrWhiteSpace(busqueda)) { filtros.Add("v.id_venta LIKE $q"); cmd.Parameters.AddWithValue("$q", $"%{busqueda.Trim()}%"); }

        cmd.CommandText = SelectVenta
            + (filtros.Count > 0 ? " WHERE " + string.Join(" AND ", filtros) : "")
            + " ORDER BY v.creada DESC LIMIT $lim";
        cmd.Parameters.AddWithValue("$lim", limite);
        using var r = cmd.ExecuteReader();
        var lista = new List<Venta>();
        while (r.Read()) lista.Add(LeerVenta(r));
        return lista;
    }

    private static Venta LeerVenta(SqliteDataReader r)
    {
        string? S(int i) => r.IsDBNull(i) ? null : r.GetString(i);
        long? L(int i) => r.IsDBNull(i) ? null : r.GetInt64(i);
        return new Venta
        {
            IdVenta = r.GetString(0),
            ComercioCuit = r.GetString(1),
            RazonSocial = r.GetString(2),
            MedioPago = r.GetString(3),
            CuentaOrigen = S(4),
            CuitPagador = S(5),
            Huella = r.GetString(6),
            SubtotalCentavos = r.GetInt64(7),
            PercepcionCentavos = L(8),
            Alicuota = S(9) is { } a ? decimal.Parse(a, CultureInfo.InvariantCulture) : null,
            TotalCentavos = L(10),
            Estado = r.GetString(11),
            Etapa = r.GetString(12),
            UltimoError = S(13),
            Intentos = (int)r.GetInt64(14),
            ComercioValidado = r.GetInt64(15) == 1,
            PercepcionId = S(16),
            PagoId = S(17),
            PagoEstado = S(18),
            ComprobanteId = S(19),
            ComprobanteNumero = S(20),
            ComprobanteTipo = S(21),
            Cae = S(22),
            ComprobanteFecha = S(23),
            Creada = r.GetString(24),
            Actualizada = r.GetString(25)
        };
    }
}

public static class Reloj
{
    /// <summary>Instante actual en ISO 8601 UTC con milisegundos, como pide el contrato.</summary>
    public static string Ahora() => DateTime.UtcNow.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'", CultureInfo.InvariantCulture);
}
