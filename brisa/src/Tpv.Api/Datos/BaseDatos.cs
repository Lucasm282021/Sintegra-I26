using Microsoft.Data.Sqlite;

namespace Tpv.Api.Datos;

/// <summary>
/// Base SQLite propia del TPV: un solo archivo, sin servidor ni instalación aparte.
/// Ningún otro módulo la consulta; todo lo externo se integra por HTTP.
/// </summary>
public sealed class BaseDatos
{
    private readonly string _cadena;

    public BaseDatos(ConfiguracionTpv config)
    {
        var ruta = Path.GetFullPath(config.RutaBaseDatos);
        var carpeta = Path.GetDirectoryName(ruta);
        if (!string.IsNullOrEmpty(carpeta))
            Directory.CreateDirectory(carpeta);

        _cadena = new SqliteConnectionStringBuilder
        {
            DataSource = ruta,
            Mode = SqliteOpenMode.ReadWriteCreate,
            Pooling = false
        }.ToString();
    }

    public SqliteConnection Abrir()
    {
        var conexion = new SqliteConnection(_cadena);
        conexion.Open();
        using var pragma = conexion.CreateCommand();
        pragma.CommandText = "PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;";
        pragma.ExecuteNonQuery();
        return conexion;
    }

    public void Inicializar()
    {
        using var conexion = Abrir();
        using var comando = conexion.CreateCommand();
        comando.CommandText = Esquema;
        comando.ExecuteNonQuery();
        DatosDeEjemplo.CargarSiEstaVacia(conexion);
    }

    private const string Esquema = """
        CREATE TABLE IF NOT EXISTS comercios (
            cuit            TEXT PRIMARY KEY,
            razon_social    TEXT NOT NULL,
            rubro           TEXT NOT NULL,
            cuenta_destino  TEXT,
            activo          INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS productos (
            id               TEXT PRIMARY KEY,
            comercio_cuit    TEXT NOT NULL REFERENCES comercios(cuit),
            nombre           TEXT NOT NULL,
            categoria        TEXT NOT NULL,
            precio_centavos  INTEGER NOT NULL CHECK (precio_centavos > 0),
            stock            INTEGER NOT NULL CHECK (stock >= 0),
            activo           INTEGER NOT NULL DEFAULT 1
        );
        CREATE INDEX IF NOT EXISTS ix_productos_comercio ON productos(comercio_cuit);

        CREATE TABLE IF NOT EXISTS ventas (
            id_venta            TEXT PRIMARY KEY,
            comercio_cuit       TEXT NOT NULL REFERENCES comercios(cuit),
            medio_pago          TEXT NOT NULL CHECK (medio_pago IN ('banco','billetera')),
            cuenta_origen       TEXT,
            cuit_pagador        TEXT,
            huella              TEXT NOT NULL,
            subtotal_centavos   INTEGER NOT NULL,
            percepcion_centavos INTEGER,
            alicuota            TEXT,
            total_centavos      INTEGER,
            estado              TEXT NOT NULL,
            etapa               TEXT NOT NULL,
            ultimo_error        TEXT,
            intentos            INTEGER NOT NULL DEFAULT 0,
            comercio_validado   INTEGER NOT NULL DEFAULT 0,
            percepcion_id       TEXT,
            pago_id             TEXT,
            pago_estado         TEXT,
            comprobante_id      TEXT,
            comprobante_numero  TEXT,
            comprobante_tipo    TEXT,
            cae                 TEXT,
            comprobante_fecha   TEXT,
            creada              TEXT NOT NULL,
            actualizada         TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS ix_ventas_creada ON ventas(creada);

        CREATE TABLE IF NOT EXISTS venta_lineas (
            id_venta                 TEXT NOT NULL REFERENCES ventas(id_venta),
            nro                      INTEGER NOT NULL,
            producto_id              TEXT NOT NULL,
            nombre                   TEXT NOT NULL,
            precio_unitario_centavos INTEGER NOT NULL,
            cantidad                 INTEGER NOT NULL CHECK (cantidad > 0),
            PRIMARY KEY (id_venta, nro)
        );
        """;
}
