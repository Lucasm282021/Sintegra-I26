/**
 * Vercel Serverless Function — punto de entrada de la API ARBA (Lucas P).
 *
 * Reutiliza exactamente la misma app Express que el servidor local (src/index.js),
 * por lo que los contratos /arba/... y /api/v1/arba/... son idénticos en ambos entornos.
 *
 * En Vercel la variable VERCEL está definida y src/db.js usa almacenamiento en memoria
 * (el filesystem de las funciones es de solo lectura). Los datos vuelven a la semilla
 * cuando la instancia se recicla: es una demo en la nube, no un registro persistente.
 * Para persistencia real, desplegar el Dockerfile con un volumen en /data.
 */
module.exports = require('../src/index.js');
