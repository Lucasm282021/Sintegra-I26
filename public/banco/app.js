const API = new URLSearchParams(location.search).get('api') || (/^(localhost|127.0.0.1)$/.test(location.hostname) ? 'http://localhost:3010' : 'https://sintegra-backend.vercel.app');
const fmt = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });
const accountsNode = document.querySelector('#accounts');
const searchNode = document.querySelector('#search');
const errorNode = document.querySelector('#error');
let accounts = [];
let selectedId = null;

async function getJson(path) {
  const response = await fetch(`${API}${path}`, { headers: { Accept: 'application/json' } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Error al consultar el banco (${response.status})`);
  return payload;
}

async function postJson(path, body) {
  const response = await fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Error al guardar (' + response.status + ')');
  return payload;
}

function showError(message) {
  errorNode.textContent = message;
  errorNode.hidden = false;
}

function renderAccounts() {
  const term = searchNode.value.trim().toLocaleLowerCase('es-AR');
  const visible = accounts.filter((a) => `${a.titular} ${a.cuit} ${a.alias} ${a.cbu}`.toLocaleLowerCase('es-AR').includes(term));
  document.querySelector('#account-count').textContent = String(visible.length).padStart(2, '0');
  if (!visible.length) {
    accountsNode.innerHTML = '<p class="muted">No hay cuentas que coincidan con esa búsqueda.</p>';
    return;
  }
  accountsNode.innerHTML = visible.map((a) => `<button class="account ${a.id === selectedId ? 'selected' : ''}" type="button" data-id="${a.id}">
    <span class="account-mark" aria-hidden="true">B</span><span class="account-content"><strong>${escapeHtml(a.titular)}</strong><small>${a.tipo === 'cuenta_corriente' ? 'Cta. cte.' : 'Caja ahorro'} · ${a.cuit} · ${escapeHtml(a.alias || 'Sin alias')}</small></span>
    <span class="account-balance">${fmt.format(Number(a.saldo))}</span></button>`).join('');
  accountsNode.querySelectorAll('[data-id]').forEach((button) => button.addEventListener('click', () => selectAccount(button.dataset.id)));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

async function selectAccount(id) {
  selectedId = id;
  renderAccounts();
  errorNode.hidden = true;
  document.querySelector('#empty').hidden = true;
  document.querySelector('#detail').hidden = false;
  const account = accounts.find((a) => a.id === id);
  if (!account) return;
  document.querySelector('#holder').textContent = account.titular;
  document.querySelector('#balance').textContent = fmt.format(Number(account.saldo));
  document.querySelector('#alias').textContent = `Alias: ${account.alias || '—'}`;
  document.querySelector('#cbu').textContent = `CBU: ${account.cbu || '—'}`;
  renderCheques(account);
  const movementsNode = document.querySelector('#movements');
  movementsNode.innerHTML = '<p class="muted">Cargando movimientos…</p>';
  try {
    const movements = await getJson(`/banco/cuentas/${encodeURIComponent(id)}/movimientos`);
    if (selectedId !== id) return;
    document.querySelector('#movement-count').textContent = `${movements.length} registros`;
    movementsNode.innerHTML = movements.length ? movements.map((m) => {
      const incoming = m.cuenta_destino === id;
      const date = new Date(m.fecha);
      return `<article class="movement ${incoming ? 'in' : 'out'}"><span class="movement-icon">${incoming ? '↓' : '↑'}</span>
        <span><strong>${incoming ? 'Acreditación' : 'Débito'} · ${escapeHtml(m.tipo)}</strong><small>${date.toLocaleString('es-AR')} · ${escapeHtml(m.id_operacion)}</small></span>
        <span class="movement-amount">${incoming ? '+' : '−'}${fmt.format(Number(m.monto))}</span></article>`;
    }).join('') : '<p class="muted">Todavía no hay movimientos en esta cuenta.</p>';
  } catch (error) {
    showError(error instanceof Error ? error.message : 'No se pudieron cargar los movimientos.');
    movementsNode.innerHTML = '<p class="muted">No se pudo consultar el historial.</p>';
  }
  try {
    const data = await getJson('/banco/clientes/' + encodeURIComponent(account.cuit));
    if (selectedId === id) renderWallet(data);
  } catch (error) {
    document.querySelector('#wallet-panel').innerHTML = '<p class="error">' + escapeHtml(error instanceof Error ? error.message : 'No se pudo consultar la billetera.') + '</p>';
  }
}

function renderWallet(data) {
  const node = document.querySelector('#wallet-panel');
  const w = data.billetera;
  if (!w) {
    node.innerHTML = '<div class="wallet-heading"><div><p class="eyebrow">BILLETERA VIRTUAL</p><h2>Sin billetera asociada</h2></div><span class="wallet-mark">W</span></div>' +
      '<p class="muted">El Banco crea una billetera por CUIT. Va a compartir el saldo y el CBU de la cuenta bancaria seleccionada.</p>' +
      '<form id="wallet-create" class="wallet-form"><label>Alias<input name="alias" required minlength="3" placeholder="cliente.alias"></label><label>Clave de acceso<input name="password" type="password" required minlength="8" autocomplete="new-password" placeholder="Mínimo 8 caracteres"></label><button class="button secondary" type="submit">Crear billetera</button></form>';
    node.querySelector('#wallet-create').addEventListener('submit', async (e) => {
      e.preventDefault(); const f=e.currentTarget; const account=accounts.find(a=>a.id===selectedId); if(!account)return;
      const submit=f.querySelector('button'); submit.disabled=true;
      try { await postJson('/banco/clientes/'+encodeURIComponent(data.cliente.cuit)+'/billetera',{alias:f.alias.value.trim(),contrasena:f.password.value}); await selectAccount(account.id); }
      catch(error) { showError(error instanceof Error?error.message:'No se pudo crear la billetera.'); submit.disabled=false; }
    });
    return;
  }
  const movements=w.movimientos||[];
  node.innerHTML = '<div class="wallet-heading"><div><p class="eyebrow">BILLETERA VIRTUAL · CUIT ' + escapeHtml(w.cuit) + '</p><h2>' + escapeHtml(w.titular) + '</h2></div><span class="wallet-mark">W</span></div>' +
    '<div class="wallet-balance"><span>Saldo compartido · ARS</span><strong>' + fmt.format(Number(w.saldo)) + '</strong><small>Alias: ' + escapeHtml(w.alias) + ' · CBU: ' + escapeHtml(w.cbu||'pendiente') + ' · Cuenta: ' + escapeHtml(w.banco_cuenta_id||'sin cuenta bancaria') + '</small></div>' +
    '<div class="wallet-actions"><a class="button secondary" href="https://billetera-virtual-lucas-m.vercel.app" target="_blank" rel="noopener noreferrer">Abrir Billetera</a></div>' +
    (w.banco_cuenta_id ? '<form id="wallet-load" class="wallet-form"><label>Cargar desde la cuenta bancaria<input name="amount" type="number" min="0.01" step="0.01" required placeholder="Importe en ARS"></label><button class="button secondary" type="submit">Cargar saldo</button></form>' : '<p class="muted">Esta billetera no tiene una cuenta bancaria vinculada; no se habilita la carga desde Banco.</p>') +
    '<div class="wallet-movements"><div class="section-title"><div><p class="eyebrow">ACTIVIDAD</p><h3>Movimientos de billetera</h3></div><span class="muted">' + movements.length + '</span></div>' +
    (movements.length ? movements.slice(0,6).map(m=>'<article class="wallet-movement"><span><strong>' + escapeHtml(m.tipo) + '</strong><small>' + new Date(m.fecha).toLocaleString('es-AR') + ' · ' + escapeHtml(m.contraparte||'Sintegra') + '</small></span><span>' + fmt.format(Number(m.monto)) + '</span></article>').join('') : '<p class="muted">Todavía no hay movimientos.</p>') + '</div>';
  node.querySelector('#wallet-load')?.addEventListener('submit', async (e) => {
    e.preventDefault(); const f=e.currentTarget; const submit=f.querySelector('button'); const account=accounts.find(a=>a.id===selectedId); if(!account)return; submit.disabled=true;
    try { await postJson('/billetera/cargas',{id_venta:'banco-m-'+crypto.randomUUID(),cuit:w.cuit,monto:Number(f.amount.value)}); await loadAccounts(); await selectAccount(account.id); }
    catch(error) { showError(error instanceof Error?error.message:'No se pudo cargar la billetera.'); submit.disabled=false; }
  });
}

async function loadAccounts() {
  const refresh = document.querySelector('#refresh');
  refresh.disabled = true;
  errorNode.hidden = true;
  try {
    accounts = (await getJson('/banco/cuentas')).filter((account) =>
      !['cuenta-billetera', 'cuenta-mostrador', 'cuenta-municipio', 'cuenta-caja'].includes(account.id),
    );
    renderAccounts();
    if (selectedId && accounts.some((a) => a.id === selectedId)) await selectAccount(selectedId);
    else if (accounts.length) await selectAccount(accounts[0].id);
  } catch (error) {
    accountsNode.innerHTML = '';
    showError(error instanceof Error ? error.message : 'No se pudieron cargar las cuentas.');
  } finally {
    refresh.disabled = false;
  }
}

// ---------- Gestión de cuentas ----------
const OPS = {
  deposito: { titulo: 'Depositar efectivo', nota: 'El dinero entra por ventanilla y se acredita en la cuenta.', ruta: (id) => `/banco/cuentas/${encodeURIComponent(id)}/depositos` },
  extraccion: { titulo: 'Extraer efectivo', nota: 'Se debita de la cuenta. No puede superar el saldo disponible.', ruta: (id) => `/banco/cuentas/${encodeURIComponent(id)}/extracciones` },
  transferencia: { titulo: 'Transferir', nota: 'A otra cuenta del banco, por alias o CBU. Se debita de esta cuenta.', ruta: () => '/banco/transferencias' },
};
let opActual = null;
function errorEn(id, msg) { const n = document.getElementById(id); n.textContent = msg; n.hidden = !msg; }

document.querySelector('#btn-abrir').addEventListener('click', () => {
  document.querySelector('#f-abrir').reset(); errorEn('ab-error', ''); document.querySelector('#ab-ficha').hidden = true;
  document.querySelector('#d-abrir').showModal();
});
// Al completar el CUIT, el banco consulta el padrón general y muestra la ficha.
document.querySelector('#ab-cuit').addEventListener('input', async (e) => {
  const cuit = e.target.value.replace(/\D/g, ''); const ficha = document.querySelector('#ab-ficha');
  if (cuit.length !== 11) { ficha.hidden = true; return; }
  try {
    const f = await getJson('/padron/general/' + cuit);
    const cuentas = (f.banco || []).map((c) => c.tipo === 'cuenta_corriente' ? 'cuenta corriente' : 'caja de ahorro');
    ficha.innerHTML = `<strong>${escapeHtml(f.razon_social)}</strong><span>${escapeHtml(f.condicion_fiscal)} · ${f.tipo_persona === 'juridica' ? 'Persona jurídica' : 'Persona humana'}</span>` +
      `<span>${escapeHtml(f.domicilio_fiscal || 'Sin domicilio cargado')}</span>` +
      `<span>ARCA: ${f.arca.inscripto ? 'inscripto' : 'NO inscripto (no se puede abrir cuenta)'}${cuentas.length ? ' · Ya tiene: ' + cuentas.join(', ') : ''}</span>`;
    ficha.className = 'ficha' + (f.arca.inscripto ? '' : ' mal');
  } catch (error) { ficha.innerHTML = `<span>${escapeHtml(error.message)}</span>`; ficha.className = 'ficha mal'; }
  ficha.hidden = false;
});

// ---------- Cheques de la cuenta ----------
const ESTADO_CHEQUE = { emitido: 'Emitido', depositado: 'Depositado (en clearing)', acreditado: 'Acreditado', rechazado: 'Rechazado', anulado: 'Anulado' };
async function renderCheques(account) {
  const panel = document.querySelector('#cheques-panel');
  const cc = account.tipo === 'cuenta_corriente';
  document.querySelector('#btn-cheque').hidden = !cc;
  document.querySelector('#cheques-nota').textContent = cc
    ? 'Emití cheques contra esta cuenta. El beneficiario lo deposita y el banco lo acredita en el clearing si hay fondos y llegó la fecha.'
    : 'Cheques depositados en esta caja de ahorro. Para emitir cheques hace falta una cuenta corriente.';
  let lista = [];
  try { lista = await getJson('/banco/cheques?cuenta=' + encodeURIComponent(account.id)); } catch { lista = []; }
  if (selectedId !== account.id) return;
  panel.hidden = !cc && !lista.length;
  document.querySelector('#cheques').innerHTML = lista.length ? lista.map((q) => {
    const propio = q.cuenta_librador === account.id;
    const acciones = [
      propio && q.estado === 'emitido' ? `<button class="button secondary" data-ch="depositar" data-n="${q.numero}">Depositar</button><button class="button secondary" data-ch="anular" data-n="${q.numero}">Anular</button>` : '',
      q.estado === 'depositado' ? `<button class="button secondary" data-ch="acreditar" data-n="${q.numero}">Acreditar (clearing)</button>` : '',
    ].join('');
    return `<article class="movement ${propio ? 'out' : 'in'}"><span class="movement-icon">${q.canal === 'echeq' ? 'e' : '✎'}</span>
      <span><strong>${q.canal === 'echeq' ? 'eCheq' : 'Cheque'} N° ${q.numero} · ${escapeHtml(ESTADO_CHEQUE[q.estado] || q.estado)}</strong>
      <small>${propio ? 'A favor de ' + escapeHtml(q.beneficiario) : 'Depositado en esta cuenta'} · pago ${q.fecha_pago}${q.motivo_rechazo ? ' · ' + escapeHtml(q.motivo_rechazo) : ''}</small>
      <span class="ch-acciones">${acciones}</span></span>
      <span class="movement-amount">${fmt.format(q.monto)}</span></article>`;
  }).join('') : '<p class="muted">Todavía no hay cheques en esta cuenta.</p>';
}
document.querySelector('#cheques').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-ch]'); if (!b) return;
  const n = b.dataset.n; const accion = b.dataset.ch; let body = {};
  if (accion === 'depositar') {
    const cuenta = prompt('¿En qué cuenta lo deposita el beneficiario? (alias o CBU)');
    if (!cuenta) return; body = { cuenta: cuenta.trim() };
  }
  if (accion === 'anular' && !confirm('¿Anular el cheque N° ' + n + '?')) return;
  b.disabled = true;
  try {
    const r = await postJson(`/banco/cheques/${n}/${accion}`, body);
    if (r.estado === 'rechazado') alert('Cheque rechazado: ' + r.motivo_rechazo);
    await loadAccounts();
  } catch (error) { showError(error.message); b.disabled = false; }
});
document.querySelector('#btn-cheque').addEventListener('click', () => {
  document.querySelector('#f-cheque').reset(); errorEn('ch-error', '');
  document.querySelector('#ch-fecha').value = new Date().toISOString().slice(0, 10);
  document.querySelector('#d-cheque').showModal();
});
document.querySelector('#f-cheque').addEventListener('submit', async (e) => {
  e.preventDefault(); const btn = e.currentTarget.querySelector('[type=submit]'); btn.disabled = true;
  try {
    const q = await postJson('/banco/cheques', { cuenta_librador: selectedId, beneficiario: document.querySelector('#ch-benef').value.trim(),
      monto: Number(document.querySelector('#ch-monto').value), fecha_pago: document.querySelector('#ch-fecha').value || undefined });
    document.querySelector('#d-cheque').close(); alert('Cheque N° ' + q.numero + ' emitido.');
    await loadAccounts();
  } catch (error) { errorEn('ch-error', error.message); } finally { btn.disabled = false; }
});
document.querySelector('#f-abrir').addEventListener('submit', async (e) => {
  e.preventDefault();
  const cuit = document.querySelector('#ab-cuit').value.replace(/\D/g, '');
  const btn = e.currentTarget.querySelector('[type=submit]'); btn.disabled = true;
  try {
    const cuenta = await postJson('/banco/cuentas', { cuit, tipo: document.querySelector('#ab-tipo').value });
    document.querySelector('#d-abrir').close();
    selectedId = cuenta.id; await loadAccounts();
  } catch (error) { errorEn('ab-error', error.message); } finally { btn.disabled = false; }
});

document.querySelector('#ops').addEventListener('click', (e) => {
  const tipo = e.target.closest('[data-op]')?.dataset.op; if (!tipo || !selectedId) return;
  // Un identificador por operación: si se reintenta el envío, el banco no la duplica.
  opActual = { tipo, id_operacion: crypto.randomUUID() };
  const o = OPS[tipo];
  document.querySelector('#f-op').reset(); errorEn('do-error', '');
  document.querySelector('#do-titulo').textContent = o.titulo;
  document.querySelector('#do-nota').textContent = o.nota;
  document.querySelector('#do-destino-label').hidden = tipo !== 'transferencia';
  document.querySelector('#do-destino').required = tipo === 'transferencia';
  document.querySelector('#d-op').showModal();
});
document.querySelector('#f-op').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.querySelector('#do-ok'); btn.disabled = true;
  const body = { id_operacion: opActual.id_operacion, monto: Number(document.querySelector('#do-monto').value),
    concepto: document.querySelector('#do-concepto').value.trim() || undefined };
  if (opActual.tipo === 'transferencia') Object.assign(body, { origen: selectedId, destino: document.querySelector('#do-destino').value.trim() });
  try {
    await postJson(OPS[opActual.tipo].ruta(selectedId), body);
    document.querySelector('#d-op').close();
    await loadAccounts();
  } catch (error) { errorEn('do-error', error.message); } finally { btn.disabled = false; }
});

searchNode.addEventListener('input', renderAccounts);
document.querySelector('#refresh').addEventListener('click', loadAccounts);

const bancoDemoKey = 'demo-auth-banco-rodrigo';
const activateBanco = () => {
  document.body.classList.add('demo-auth-ok');
  document.querySelector('#demo-access').hidden = true;
  loadAccounts();
};
if (sessionStorage.getItem(bancoDemoKey) === 'ok') activateBanco();
document.querySelector('#demo-login').addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  if (String(data.get('email')).trim().toLowerCase() !== 'demo.banco.rodrigo.i26@gmail.com' || data.get('password') !== 'BancoDemo2026') {
    const error = document.querySelector('#demo-error');
    error.textContent = 'El correo o la contraseña no coinciden con el usuario demo.'; error.hidden = false; return;
  }
  sessionStorage.setItem(bancoDemoKey, 'ok'); activateBanco();
});

// Los botones Cancelar cierran el diálogo sin pasar por el envío del formulario.
document.querySelectorAll('dialog [value="cancel"]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); b.closest('dialog').close(); }));
