// Entrega firmada de eventos de pago a cada terminal TPV.
const crypto = require('node:crypto');
const dns = require('node:dns').promises;
const net = require('node:net');
const express = require('express');
const { query } = require('../db');
const { falla, idValido, ruta } = require('../http');

const router = express.Router();
const tokenAdmin = () => process.env.SINTEGRA_WEBHOOK_ADMIN_TOKEN?.trim();
const privado = (ip) => {
  if (net.isIPv4(ip)) {
    const [a,b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
  }
  if (net.isIPv6(ip)) return ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80:');
  return true;
};

async function validarDestino(value) {
  let u;
  try { u = new URL(value); } catch { throw falla(400, 'endpoint_url inválida'); }
  if (u.username || u.password || u.hash) throw falla(400, 'endpoint_url no puede incluir usuario, contraseña ni fragmento');
  const local = ['localhost','127.0.0.1','::1'].includes(u.hostname);
  if (u.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && local && u.protocol === 'http:')) {
    throw falla(400, 'endpoint_url debe usar HTTPS');
  }
  if (local) return u;
  if (u.hostname.endsWith('.localhost') || u.hostname.endsWith('.local')) throw falla(400, 'endpoint_url debe ser pública');
  let ips;
  try { ips = await dns.lookup(u.hostname, { all: true }); } catch { throw falla(400, 'no se pudo resolver endpoint_url'); }
  if (!ips.length || ips.some((entry) => privado(entry.address))) throw falla(400, 'endpoint_url debe resolver a una dirección pública');
  return u;
}

async function registrarEvento(c, { terminal_id, id_venta, payload }) {
  if (!terminal_id) return null;
  if (!idValido(terminal_id)) throw falla(400, 'terminal_id inválido');
  const exists = (await c.query('select 1 from tpv.terminales where id=$1', [terminal_id])).rows[0];
  if (!exists) throw falla(404, 'terminal TPV no encontrada para notificar');
  const { rows } = await c.query(`insert into tpv.webhook_eventos(terminal_id,id_venta,evento,payload)
    values($1,$2,'payment.confirmed',$3::jsonb)
    on conflict(terminal_id,id_venta,evento) do update set id_venta=excluded.id_venta
    returning id,estado`, [terminal_id,id_venta,JSON.stringify(payload)]);
  return rows[0].id;
}

async function entregarEvento(eventId) {
  if (!eventId) return { estado: 'sin_webhook' };
  const { rows } = await query(`select e.*,c.endpoint_url,c.secret,c.activo from tpv.webhook_eventos e
    left join tpv.webhook_config c using(terminal_id) where e.id=$1`, [eventId]);
  const event = rows[0];
  if (!event) return { estado: 'no_encontrado' };
  if (event.estado === 'entregado') return { estado: 'entregado', event_id: eventId, repetido: true };
  if (!event.activo || !event.endpoint_url || !event.secret) return { estado: 'pendiente_configuracion', event_id: eventId };
  const body = JSON.stringify(event.payload);
  const signature = crypto.createHmac('sha256', event.secret).update(body).digest('hex');
  const nextIntent = Number(event.intentos) + 1;
  try {
    const response = await fetch(event.endpoint_url, {
      method: 'POST', headers: { 'content-type': 'application/json',
        'x-sintegra-event-id': eventId, 'x-sintegra-event': event.evento,
        'x-sintegra-signature': `sha256=${signature}` }, body,
      signal: AbortSignal.timeout(5000),
    });
    const error = response.ok ? null : `El receptor respondió HTTP ${response.status}`;
    await query(`update tpv.webhook_eventos set intentos=$2,ultimo_http_status=$3,ultimo_error=$4,
      estado=case when $5 then 'entregado' else 'pendiente' end,
      entregado_en=case when $5 then now() else null end where id=$1`,
      [eventId,nextIntent,response.status,error,response.ok]);
    return { estado: response.ok ? 'entregado' : 'pendiente', event_id: eventId, http_status: response.status, intentos: nextIntent };
  } catch (err) {
    await query(`update tpv.webhook_eventos set intentos=$2,ultimo_error=$3,estado='pendiente',entregado_en=null where id=$1`,
      [eventId,nextIntent,String(err.message).slice(0,500)]);
    return { estado: 'pendiente', event_id: eventId, intentos: nextIntent, error: 'no se pudo contactar al terminal' };
  }
}

router.put('/terminales/:id/webhook', ruta(async (req) => {
  const token = tokenAdmin();
  if (!token) throw falla(503, 'webhooks sin configurar: falta SINTEGRA_WEBHOOK_ADMIN_TOKEN');
  if (req.get('x-sintegra-admin-token') !== token) throw falla(401, 'token de administración inválido');
  const terminal = req.params.id;
  const { endpoint_url, secret, activo = true } = req.body || {};
  if (!idValido(terminal)) throw falla(400, 'terminal inválida');
  if (typeof secret !== 'string' || secret.length < 32) throw falla(400, 'secret debe tener al menos 32 caracteres');
  if (typeof activo !== 'boolean') throw falla(400, 'activo debe ser booleano');
  const endpoint = await validarDestino(endpoint_url);
  const { rows } = await query(`insert into tpv.webhook_config(terminal_id,endpoint_url,secret,activo)
    select id,$2,$3,$4 from tpv.terminales where id=$1
    on conflict(terminal_id) do update set endpoint_url=excluded.endpoint_url,secret=excluded.secret,
      activo=excluded.activo,actualizado_en=now()
    returning terminal_id,endpoint_url,activo,actualizado_en`, [terminal,endpoint.toString(),secret,activo]);
  if (!rows[0]) throw falla(404, 'terminal TPV no encontrada');
  return { status: 200, body: rows[0] };
}));

module.exports = { router, registrarEvento, entregarEvento, validarDestino };
