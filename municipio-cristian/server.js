const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const app = express();

app.use(express.json()); // Para poder recibir JSON en los POST

function cuitChecksumValido(value) {
    if (typeof value !== 'string' || !/^\d{11}$/.test(value)) return false;
    const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    const suma = pesos.reduce((total, peso, i) => total + Number(value[i]) * peso, 0);
    const resto = suma % 11;
    const verificador = resto === 0 ? 0 : resto === 1 ? 9 : 11 - resto;
    return Number(value[10]) === verificador;
}

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
    const cuit = String(req.body?.cuit || '');
    const razon_social = String(req.body?.razon_social || '').trim();
    const rubro = String(req.body?.rubro || req.body?.rubro_principal || '').trim();
    if (!cuitChecksumValido(cuit)) {
        return res.status(400).json({ error: 'CUIT inválido: se requieren 11 dígitos y un dígito verificador correcto.' });
    }
    if (!razon_social || !rubro) {
        return res.status(400).json({ error: 'razon_social y rubro son obligatorios.' });
    }
    const fecha_solicitud = new Date().toISOString().split('T')[0];
    const estado = 'pendiente';

    const sql = `INSERT INTO comercios_habilitados (cuit, razon_social, rubro, fecha_habilitacion, estado) VALUES (?, ?, ?, ?, ?)`;
    
    db.run(sql, [cuit, razon_social, rubro, fecha_habilitacion, estado], function(err) {
        if (err) {
            return res.status(err.code === 'SQLITE_CONSTRAINT' ? 409 : 500).json({ error: "No se pudo registrar la solicitud municipal." });
        }
        res.status(201).json({ 
            mensaje: "Solicitud registrada. La habilitación requiere revisión y resolución municipal.",
            comercio: { cuit, razon_social, rubro, fecha_solicitud, estado },
            tributos_generados: []
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
    const { cuit, periodo, monto } = req.body || {};
    if (typeof cuit !== 'string' || !/^\d{11}$/.test(cuit)) {
        return res.status(400).json({ error: 'CUIT debe contener 11 dígitos.' });
    }
    if (typeof periodo !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo)) {
        return res.status(400).json({ error: 'periodo debe tener formato YYYY-MM.' });
    }
    if (typeof monto !== 'number' || !Number.isFinite(monto) || monto <= 0 || Math.round(monto * 100) !== monto * 100) {
        return res.status(400).json({ error: 'monto debe ser positivo y tener hasta dos decimales.' });
    }

    db.get(`SELECT cuit FROM comercios_habilitados WHERE cuit = ? AND estado IN ('activo','habilitado')`, [cuit], (err, row) => {
        if (err) return res.status(500).json({ error: "Error en la base de datos" });
        if (!row) return res.status(409).json({ error: "El comercio no tiene una habilitación vigente en este municipio." });

        db.get(`SELECT * FROM tasas_municipales WHERE cuit_comercio = ? AND periodo = ?`, [cuit, periodo], (error, tasa) => {
            if (error) return res.status(500).json({ error: "Error en la base de datos" });
            if (!tasa) return res.status(404).json({ error: "No existe una obligación municipal emitida para ese período." });
            if (Number(tasa.monto) !== monto) return res.status(400).json({ error: "El monto no coincide con la obligación emitida." });
            if (tasa.estado_pago === 'pagado') {
                return res.status(200).json({ mensaje: "El pago ya estaba registrado.", periodo, monto, repetido: true });
            }
            if (tasa.estado_pago !== 'pendiente') {
                return res.status(409).json({ error: "La obligación no está disponible para el pago." });
            }

            db.run(`UPDATE tasas_municipales SET estado_pago = 'pagado' WHERE id = ? AND estado_pago = 'pendiente'`, [tasa.id], function(updateError) {
                if (updateError) return res.status(500).json({ error: "Error al registrar el pago de la tasa" });
                if (this.changes !== 1) return res.status(409).json({ error: "La obligación cambió de estado; consultá nuevamente." });
                res.status(201).json({ mensaje: "Pago de la obligación municipal registrado en modo demo.", periodo, monto, repetido: false });
            });
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
