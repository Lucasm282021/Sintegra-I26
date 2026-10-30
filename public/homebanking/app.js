// Homebanking de Banco M: el cliente entra con CUIT y clave y opera sus cuentas.
const API = new URLSearchParams(location.search).get('api') || (/^(localhost|127.0.0.1)$/.test(location.hostname) ? 'http://localhost:3010' : 'https://sintegra-backend.vercel.app');
const fmt = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });
const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const CLAVE_SESION = 'hb-banco-m-cuit';
let datos = null;

async function api(metodo, ruta, body) {
  const r = await fetch(API + ruta, { method: metodo, headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Error ${r.status}`);
  return j;
}
function error(id, msg) { const n = $(id); n.textContent = msg || ''; n.hidden = !msg; }
const CONDICION = { responsable_inscripto: 'RESPONSABLE INSCRIPTO', monotributo: 'MONOTRIBUTO', exento: 'EXENTO', consumidor_final: 'CONSUMIDOR FINAL' };
const ESTADO = { emitido: 'Emitido', depositado: 'Depositado', acreditado: 'Acreditado', rechazado: 'Rechazado', anulado: 'Anulado' };

function pintar() {
  const { cliente, cuentas, movimientos, cheques, billetera, echeq_disponible } = datos;
  $('#hb-cliente').textContent = `CUIT ${cliente.cuit}`;
  $('#hb-nombre').textContent = cliente.razon_social;
  $('#hb-condicion').textContent = CONDICION[cliente.condicion_iva] || 'CLIENTE';
  $('#hb-domicilio').textContent = cliente.domicilio_fiscal || '';
  $('#cuentas').innerHTML = cuentas.map((c) => `<div class="account"><span class="account-mark">${c.tipo === 'cuenta_corriente' ? 'CC' : 'CA'}</span>
    <span class="account-content"><strong>${c.tipo === 'cuenta_corriente' ? 'Cuenta corriente' : 'Caja de ahorro'}</strong><small>Alias ${esc(c.alias)} · CBU ${esc(c.cbu)}</small></span>
    <span class="account-balance">${fmt.format(c.saldo)}</span></div>`).join('') || '<p class="muted">No tenés cuentas.</p>';
  $('#billetera').innerHTML = billetera ? `<span>Billetera virtual <b>${esc(billetera.alias)}</b></span><b>${fmt.format(billetera.saldo)}</b>` : '<span class="muted">Sin billetera virtual (se crea desde el banco).</span>';
  $('#btn-echeq').disabled = !echeq_disponible;
  $('#echeq-nota').textContent = echeq_disponible ? 'Tenés cuenta corriente: podés emitir eCheq.' : 'Para emitir eCheq necesitás una cuenta corriente (pedila en el banco). Igual podés recibir y cobrar eCheq.';
  $('#tr-origen').innerHTML = cuentas.map((c) => `<option value="${c.id}">${c.tipo === 'cuenta_corriente' ? 'Cuenta corriente' : 'Caja de ahorro'} · ${fmt.format(c.saldo)}</option>`).join('');
  $('#cheques').innerHTML = cheques.length ? cheques.map((q) => {
    const cobrar = q.rol === 'recibido' && q.canal === 'echeq' && ['emitido', 'depositado'].includes(q.estado);
    const anular = q.rol === 'emitido' && q.estado === 'emitido';
    return `<article class="movement ${q.rol === 'recibido' ? 'in' : 'out'}"><span class="movement-icon">${q.canal === 'echeq' ? 'e' : '✎'}</span>
      <span><strong>${q.canal === 'echeq' ? 'eCheq' : 'Cheque'} N° ${q.numero} · ${q.rol === 'recibido' ? 'Recibido' : 'Emitido a ' + esc(q.beneficiario)}</strong>
      <small>${ESTADO[q.estado] || q.estado} · pago ${q.fecha_pago}${q.motivo_rechazo ? ' · ' + esc(q.motivo_rechazo) : ''}</small>
      <span class="ch-acciones">${cobrar ? `<button class="button primary" data-cobrar="${q.numero}">Cobrar</button>` : ''}${anular && q.canal === 'echeq' ? `<button class="button secondary" data-anular="${q.numero}">Anular</button>` : ''}</span></span>
      <span class="movement-amount">${q.rol === 'recibido' ? '+' : '−'}${fmt.format(q.monto)}</span></article>`;
  }).join('') : '<p class="muted">No tenés cheques ni eCheq.</p>';
  $('#movimientos').innerHTML = movimientos.length ? movimientos.map((m) => `<article class="movement ${m.sentido === 'credito' ? 'in' : 'out'}">
    <span class="movement-icon">${m.sentido === 'credito' ? '↓' : m.sentido === 'debito' ? '↑' : '⇄'}</span>
    <span><strong>${m.sentido === 'credito' ? 'Acreditación' : m.sentido === 'debito' ? 'Débito' : 'Entre mis cuentas'} · ${esc(m.tipo)}</strong><small>${new Date(m.fecha).toLocaleString('es-AR')}</small></span>
    <span class="movement-amount">${m.sentido === 'credito' ? '+' : m.sentido === 'debito' ? '−' : ''}${fmt.format(m.monto)}</span></article>`).join('') : '<p class="muted">Sin movimientos todavía.</p>';
}

async function cargar() {
  const cuit = sessionStorage.getItem(CLAVE_SESION);
  if (!cuit) return;
  try { datos = await api('GET', `/banco/homebanking/${cuit}/resumen`); pintar(); error('#error', ''); }
  catch (e) { error('#error', e.message); }
}
function entrar(d) { datos = d; sessionStorage.setItem(CLAVE_SESION, d.cliente.cuit); document.body.classList.add('demo-auth-ok'); $('#acceso').hidden = true; pintar(); }

$('#f-login').addEventListener('submit', async (e) => {
  e.preventDefault(); const f = new FormData(e.currentTarget); const btn = e.currentTarget.querySelector('button'); btn.disabled = true;
  try { entrar(await api('POST', '/banco/homebanking/login', { cuit: String(f.get('cuit')).replace(/\D/g, ''), clave: String(f.get('clave')) })); error('#login-error', ''); }
  catch (err) { error('#login-error', err.message); } finally { btn.disabled = false; }
});
$('#btn-salir').addEventListener('click', () => { sessionStorage.removeItem(CLAVE_SESION); location.reload(); });
$('#btn-actualizar').addEventListener('click', cargar);

// Ficha del destinatario desde el padrón general (por CUIT) o por alias.
async function fichaDe(ref, nodo) {
  ref = ref.trim(); nodo.textContent = '';
  if (/^\d{11}$/.test(ref)) {
    try { const f = await api('GET', '/padron/general/' + ref); nodo.textContent = `${f.razon_social} · ${f.condicion_fiscal}`; } catch (e) { nodo.textContent = e.message; }
  }
}
$('#ec-destino').addEventListener('input', (e) => fichaDe(e.target.value, $('#ec-ficha')));

let idOperacion = null;
$('#btn-transferir').addEventListener('click', () => { $('#f-transferir').reset(); error('#tr-error'); idOperacion = crypto.randomUUID(); $('#d-transferir').showModal(); });
$('#f-transferir').addEventListener('submit', async (e) => {
  e.preventDefault(); const btn = e.currentTarget.querySelector('[type=submit]'); btn.disabled = true;
  try {
    await api('POST', '/banco/transferencias', { id_operacion: idOperacion, origen: $('#tr-origen').value, destino: $('#tr-destino').value.trim(),
      monto: Number($('#tr-monto').value), concepto: $('#tr-concepto').value.trim() || undefined });
    $('#d-transferir').close(); await cargar();
  } catch (err) { error('#tr-error', err.message); } finally { btn.disabled = false; }
});

$('#btn-echeq').addEventListener('click', () => { $('#f-echeq').reset(); error('#ec-error'); $('#ec-ficha').textContent = ''; $('#ec-fecha').value = new Date().toISOString().slice(0, 10); $('#d-echeq').showModal(); });
$('#f-echeq').addEventListener('submit', async (e) => {
  e.preventDefault(); const btn = e.currentTarget.querySelector('[type=submit]'); btn.disabled = true;
  try {
    const q = await api('POST', '/billetera/echeqs', { cuit_origen: datos.cliente.cuit, destino: $('#ec-destino').value.trim(), monto: Number($('#ec-monto').value), fecha_pago: $('#ec-fecha').value || undefined });
    $('#d-echeq').close(); alert(`eCheq N° ${q.numero} emitido a ${q.beneficiario}.`); await cargar();
  } catch (err) { error('#ec-error', err.message); } finally { btn.disabled = false; }
});

$('#cheques').addEventListener('click', async (e) => {
  const cobrar = e.target.closest('[data-cobrar]'); const anular = e.target.closest('[data-anular]');
  if (!cobrar && !anular) return;
  const n = (cobrar || anular).dataset.cobrar || (cobrar || anular).dataset.anular;
  if (anular && !confirm(`¿Anular el eCheq N° ${n}?`)) return;
  try {
    const r = await api('POST', `/billetera/echeqs/${n}/${cobrar ? 'cobrar' : 'anular'}`, { cuit: datos.cliente.cuit });
    if (r.aviso) alert(r.aviso); else if (r.estado === 'rechazado') alert('eCheq rechazado: ' + r.motivo_rechazo); else if (cobrar) alert('eCheq acreditado en tu caja de ahorro.');
    await cargar();
  } catch (err) { error('#error', err.message); }
});

$('#btn-clave').addEventListener('click', () => { $('#f-clave').reset(); error('#k-error'); $('#d-clave').showModal(); });
$('#f-clave').addEventListener('submit', async (e) => {
  e.preventDefault();
  try { await api('POST', '/banco/homebanking/clave', { cuit: datos.cliente.cuit, clave_actual: $('#k-actual').value, clave_nueva: $('#k-nueva').value }); $('#d-clave').close(); alert('Clave actualizada.'); }
  catch (err) { error('#k-error', err.message); }
});

if (sessionStorage.getItem(CLAVE_SESION)) { document.body.classList.add('demo-auth-ok'); $('#acceso').hidden = true; cargar(); }

// Los botones Cancelar cierran el diálogo sin pasar por el envío del formulario.
document.querySelectorAll('dialog [value="cancel"]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); b.closest('dialog').close(); }));
