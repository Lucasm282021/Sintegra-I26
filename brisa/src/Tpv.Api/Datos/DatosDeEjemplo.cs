using Microsoft.Data.Sqlite;

namespace Tpv.Api.Datos;

/// <summary>
/// Datos ficticios y deterministas para la feria: tres comercios de rubros distintos
/// con su catálogo. Los CUIT son de prueba; ninguno corresponde a una empresa real.
/// </summary>
internal static class DatosDeEjemplo
{
    private static readonly (string Cuit, string RazonSocial, string Rubro, string Cuenta)[] Comercios =
    {
        ("30712345678", "Almacén de la Feria", "Alimentos", "cuenta-comercio-9"),
        ("30722222225", "Librería Punto y Coma", "Librería", "cuenta-comercio-2"),
        ("30733333336", "Ropero Urbano", "Indumentaria", "cuenta-comercio-3"),
    };

    private static readonly (string Id, string Cuit, string Nombre, string Categoria, long Centavos, int Stock)[] Productos =
    {
        ("prod-1",  "30712345678", "Alfajor de maicena",        "Golosinas",   120000, 40),
        ("prod-2",  "30712345678", "Agua mineral 500 ml",       "Bebidas",     110000, 36),
        ("prod-3",  "30712345678", "Gaseosa lima limón 1,5 L",  "Bebidas",     280000, 18),
        ("prod-4",  "30712345678", "Galletitas de agua",        "Almacén",     150000, 25),
        ("prod-5",  "30712345678", "Yerba mate 1 kg",           "Almacén",     520000, 12),
        ("prod-6",  "30712345678", "Turrón de maní",            "Golosinas",    60000, 60),
        ("prod-7",  "30712345678", "Medialunas x 6",            "Panadería",   330000, 10),
        ("prod-8",  "30712345678", "Leche entera 1 L",          "Lácteos",     160000, 20),

        ("prod-11", "30722222225", "Cuaderno tapa dura A4",     "Cuadernos",   480000, 15),
        ("prod-12", "30722222225", "Birome azul",               "Escritura",    70000, 80),
        ("prod-13", "30722222225", "Lápiz negro HB",            "Escritura",    50000, 70),
        ("prod-14", "30722222225", "Resaltador amarillo",       "Escritura",    90000, 30),
        ("prod-15", "30722222225", "Repuesto hojas rayadas",    "Cuadernos",   350000, 22),
        ("prod-16", "30722222225", "Calculadora científica",    "Tecnología", 2450000,  5),
        ("prod-17", "30722222225", "Regla 30 cm",               "Geometría",    80000, 25),

        ("prod-21", "30733333336", "Remera de algodón",         "Remeras",    1500000, 14),
        ("prod-22", "30733333336", "Buzo con capucha",          "Abrigo",     3200000,  8),
        ("prod-23", "30733333336", "Medias deportivas",         "Accesorios",  450000, 30),
        ("prod-24", "30733333336", "Gorra",                     "Accesorios",  900000, 12),
        ("prod-25", "30733333336", "Jean recto",                "Pantalones", 3800000,  6),
    };

    public static void CargarSiEstaVacia(SqliteConnection conexion)
    {
        using (var contar = conexion.CreateCommand())
        {
            contar.CommandText = "SELECT COUNT(*) FROM comercios";
            if (Convert.ToInt64(contar.ExecuteScalar()) > 0)
                return;
        }

        using var tx = conexion.BeginTransaction();

        foreach (var c in Comercios)
        {
            using var cmd = conexion.CreateCommand();
            cmd.Transaction = tx;
            cmd.CommandText = "INSERT INTO comercios (cuit, razon_social, rubro, cuenta_destino, activo) VALUES ($c, $r, $ru, $cu, 1)";
            cmd.Parameters.AddWithValue("$c", c.Cuit);
            cmd.Parameters.AddWithValue("$r", c.RazonSocial);
            cmd.Parameters.AddWithValue("$ru", c.Rubro);
            cmd.Parameters.AddWithValue("$cu", c.Cuenta);
            cmd.ExecuteNonQuery();
        }

        foreach (var p in Productos)
        {
            using var cmd = conexion.CreateCommand();
            cmd.Transaction = tx;
            cmd.CommandText = """
                INSERT INTO productos (id, comercio_cuit, nombre, categoria, precio_centavos, stock, activo)
                VALUES ($id, $c, $n, $cat, $p, $s, 1)
                """;
            cmd.Parameters.AddWithValue("$id", p.Id);
            cmd.Parameters.AddWithValue("$c", p.Cuit);
            cmd.Parameters.AddWithValue("$n", p.Nombre);
            cmd.Parameters.AddWithValue("$cat", p.Categoria);
            cmd.Parameters.AddWithValue("$p", p.Centavos);
            cmd.Parameters.AddWithValue("$s", p.Stock);
            cmd.ExecuteNonQuery();
        }

        tx.Commit();
    }
}
