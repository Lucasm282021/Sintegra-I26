const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const app = express();

app.use(express.json()); // Para poder recibir JSON en los POST

app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', servicio: 'municipio' });
});

const PORT = process.env.PORT || 3005;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'municipio.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

// Inicializamos la Base de Datos SQLite (se crea un archivo local)
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error al conectar con la base de datos:', err.message);
    } else {
        console.log('Conectado a la base de datos SQLite del Municipio.');
        crearTablas();
    }
});

// Función para crear la estructura (Multi-tenant básico por CUIT)
function crearTablas() {
    db.serialize(() => {
        // Tabla de Comercios Habilitados
        db.run(`CREATE TABLE IF NOT EXISTS comercios_habilitados (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cuit TEXT UNIQUE NOT NULL,
            razon_social TEXT NOT NULL,
            rubro TEXT NOT NULL,
            fecha_habilitacion TEXT NOT NULL,
            estado TEXT NOT NULL
        )`);

        // Tabla de Tasas Municipales (TSyH)
        db.run(`CREATE TABLE IF NOT EXISTS tasas_municipales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cuit_comercio TEXT NOT NULL,
            periodo TEXT NOT NULL,
            monto REAL NOT NULL,
            estado_pago TEXT NOT NULL,
            FOREIGN KEY(cuit_comercio) REFERENCES comercios_habilitados(cuit)
        )`);
    });
}

// ==========================================
// ENDPOINTS DEL CONTRATO (API REST)
// ==========================================

// 1. Alta de Comercio en el Municipio
app.post('/municipio/comercios', (req, res) => {
    const { cuit, razon_social, rubro } = req.body;
    const fecha_habilitacion = new Date().toISOString().split('T')[0];
    const estado = 'activo';

    const sql = `INSERT INTO comercios_habilitados (cuit, razon_social, rubro, fecha_habilitacion, estado) VALUES (?, ?, ?, ?, ?)`;
    
    db.run(sql, [cuit, razon_social, rubro, fecha_habilitacion, estado], function(err) {
        if (err) {
            return res.status(400).json({ error: "Error al registrar o el CUIT ya existe." });
        }
        res.status(201).json({ 
            mensaje: "Comercio habilitado con éxito", 
            comercio: { cuit, razon_social, rubro, fecha_habilitacion, estado }
        });
    });
});

// 2. Verificar estado de habilitación de un comercio
app.get('/municipio/comercios/:cuit', (req, res) => {
    const { cuit } = req.params;
    db.get(`SELECT * FROM comercios_habilitados WHERE cuit = ?`, [cuit], (err, row) => {
        if (err) return res.status(500).json({ error: "Error en la base de datos" });
        if (!row) return res.status(404).json({ error: "Comercio no encontrado o no habilitado" });
        
        res.status(200).json(row);
    });
});

// 3. Generar pago de Tasa Municipal (TSyH)
app.post('/municipio/tributos/pagos', (req, res) => {
    const { cuit, periodo, monto } = req.body;
    
    // Primero verificamos que el comercio exista
    db.get(`SELECT cuit FROM comercios_habilitados WHERE cuit = ?`, [cuit], (err, row) => {
        if (err) return res.status(500).json({ error: "Error en la base de datos" });
        if (!row) return res.status(404).json({ error: "El comercio no está habilitado en este municipio." });

        const sql = `INSERT INTO tasas_municipales (cuit_comercio, periodo, monto, estado_pago) VALUES (?, ?, ?, 'pagado')`;
        db.run(sql, [cuit, periodo, monto], function(err) {
            if (err) return res.status(500).json({ error: "Error al registrar el pago de la tasa" });
            res.status(201).json({ mensaje: "Pago de TSyH registrado correctamente", periodo, monto });
        });
    });
});

// 4. Ver historial de tasas de un comercio
app.get('/municipio/tributos/:cuit', (req, res) => {
    const { cuit } = req.params;
    db.all(`SELECT * FROM tasas_municipales WHERE cuit_comercio = ?`, [cuit], (err, rows) => {
        if (err) return res.status(500).json({ error: "Error en la base de datos" });
        res.status(200).json({ tributos: rows });
    });
});

// Levantar el servidor
app.listen(PORT, () => {
    console.log(`✅ Módulo MUNICIPIO corriendo en http://localhost:${PORT}`);
});
