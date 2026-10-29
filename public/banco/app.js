const API = 'https://sintegra-backend.vercel.app';
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
    <span class="account-mark" aria-hidden="true">B</span><span class="account-content"><strong>${escapeHtml(a.titular)}</strong><small>${a.cuit} · ${escapeHtml(a.alias || 'Sin alias')}</small></span>
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
      '<p class="muted">Cliente identificado por CUIT ' + escapeHtml(data.cliente.cuit) + '. Creá una billetera vinculada a su cuenta bancaria.</p>' +
      '<form id="wallet-create" class="wallet-form"><label>Alias<input name="alias" required minlength="3" placeholder="cliente.alias"></label><label>Clave de acceso<input name="password" type="password" required minlength="8" autocomplete="new-password" placeholder="Mínimo 8 caracteres"></label><button class="button secondary" type="submit">Crear billetera</button></form>';
    node.querySelector('#wallet-create').addEventListener('submit', async (e) => {
      e.preventDefault(); const f=e.currentTarget; const account=accounts.find(a=>a.id===selectedId); if(!account)return;
      const submit=f.querySelector('button'); submit.disabled=true;
      try { await postJson('/billetera/cuentas',{titular:data.cliente.razon_social,cuit:data.cliente.cuit,alias:f.alias.value.trim(),contrasena:f.password.value}); await selectAccount(account.id); }
      catch(error) { showError(error instanceof Error?error.message:'No se pudo crear la billetera.'); submit.disabled=false; }
    });
    return;
  }
  const movements=w.movimientos||[];
  node.innerHTML = '<div class="wallet-heading"><div><p class="eyebrow">BILLETERA VIRTUAL · CUIT ' + escapeHtml(w.cuit) + '</p><h2>' + escapeHtml(w.titular) + '</h2></div><span class="wallet-mark">W</span></div>' +
    '<div class="wallet-balance"><span>Saldo disponible · ARS</span><strong>' + fmt.format(Number(w.saldo)) + '</strong><small>Alias: ' + escapeHtml(w.alias) + ' · Vinculada: ' + escapeHtml(w.banco_cuenta_id||'sin cuenta bancaria') + '</small></div>' +
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
      !['cuenta-billetera', 'cuenta-mostrador', 'cuenta-municipio'].includes(account.id),
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
