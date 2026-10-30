// Consola de configuración fiscal (cátedra). Usa la API del backend único:
// ARBA (/arba/agentes, /arba/config-percepcion, /arba/padron), TPV (/tpv/productos)
// y Municipio (/municipio/alicuotas, /municipio/tributos/liquidar).
const params = new URLSearchParams(location.search);
const API = params.get('api') || (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? 'http://localhost:3010' : 'https://sintegra-backend.vercel.app');
const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pesos = (n) => Number(n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
const pct = (f) => `${(Number(f) * 100).toLocaleString('es-AR', { maximumFractionDigits: 3 })} %`;
const IVAS = { 21: 0.21, '10.5': 0.105, 27: 0.27, 0: 0 };

async function api(metodo, ruta, body) {
  const r = await fetch(API + ruta, { method: metodo, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `Error ${r.status}`);
  return data;
}
function aviso(msg, mal = false) {
  const t = $('toast'); t.textContent = msg; t.className = `toast${mal ? ' mal' : ''}`; t.hidden = false;
  clearTimeout(aviso.t); aviso.t = setTimeout(() => { t.hidden = true; }, 4000);
}
const intentar = (fn) => async (ev) => { ev?.preventDefault?.(); try { await fn(ev); } catch (e) { aviso(e.message, true); } };

let padron = [];

// ---------- Pestañas ----------
$('tabs').addEventListener('click', (ev) => {
  const t = ev.target.dataset.tab; if (!t) return;
  document.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
  document.querySelectorAll('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== t; });
  ({ arba: cargarArba, arca: cargarProductos, municipio: cargarMunicipio })[t]?.();
});

// ---------- Datos comunes ----------
async function cargarPadron() {
  padron = (await api('GET', '/arba/padron?page=1&limit=100')).items || [];
  const opciones = padron.map((p) => `<option value="${p.cuit}">${esc(p.razon_social)} · ${p.cuit}</option>`).join('');
  $('s-comercio').innerHTML = opciones; $('a-cuit').innerHTML = opciones;
}

// ---------- Simulador ----------
$('f-sim').addEventListener('submit', intentar(async () => {
  const comercio = $('s-comercio').value;
  const cliente = $('s-cliente').value.replace(/\D/g, '');
  if (cliente && cliente.length !== 11) throw new Error('El CUIT del cliente tiene que tener 11 dígitos');
  const precio = Number($('s-monto').value);
  const iva = $('s-iva').value;
  const [emisor, receptor] = await Promise.all([
    api('GET', `/arca/contribuyentes/${comercio}`),
    cliente ? api('GET', `/arca/contribuyentes/${cliente}`).catch(() => null) : null,
  ]);
  const ri = emisor.condicion_iva === 'responsable_inscripto';
  const tasa = IVAS[iva];
  const neto = ri && iva !== 'exento' ? Math.round(precio / (1 + tasa) * 100) / 100 : precio;
  const ivaMonto = Math.round((precio - neto) * 100) / 100;
  const tipo = !ri ? 'Factura C' : receptor?.condicion_iva === 'responsable_inscripto' ? 'Factura A' : 'Factura B';
  const perc = await api('GET', `/arba/percepciones/simular?agente=${comercio}&base=${neto}${cliente ? `&sujeto=${cliente}` : ''}`);
  $('sim-resultado').innerHTML = `<h2>${tipo}${tipo === 'Factura A' ? ' (IVA discriminado)' : ''}</h2>
    <dl class="resultado">
      <dt>Neto gravado${iva === 'exento' ? ' (exento)' : ''}</dt><dd>${pesos(neto)}</dd>
      ${ri && iva !== 'exento' ? `<dt>IVA ${iva} %</dt><dd>${pesos(ivaMonto)}</dd>` : ''}
      <dt>Precio de los productos</dt><dd>${pesos(precio)}</dd>
      <dt>Percepción IIBB ${perc.alicuota ? pct(perc.alicuota) : ''}</dt><dd>${pesos(perc.monto)}</dd>
      <dt class="total">Total a cobrar</dt><dd class="total">${pesos(precio + perc.monto)}</dd>
    </dl>
    <p class="nota" style="margin-top:.6rem">Emisor: ${esc(emisor.condicion_fiscal)} · Cliente: ${esc(receptor?.condicion_fiscal || 'Consumidor final')}<br>
    Percepción: ${esc(perc.motivo)}</p>`;
}));

// ---------- ARBA ----------
async function cargarArba() {
  try {
    const [cfg, agentes] = await Promise.all([api('GET', '/arba/config-percepcion'), api('GET', '/arba/agentes'), cargarPadron()]);
    $('p-noinsc').value = (cfg.alicuota_no_inscriptos * 100).toFixed(2);
    $('p-min').value = cfg.monto_minimo;
    $('agentes').innerHTML = agentes.length ? agentes.map((a) => `<div class="item"><div><strong>${esc(a.razon_social)}</strong>
      <small>${a.cuit} · desde ${String(a.vigente_desde).slice(0, 10)}${a.vigente_hasta ? ` hasta ${String(a.vigente_hasta).slice(0, 10)}` : ''}</small></div>
      <div class="botones"><span class="chip ${a.vigente ? 'ok' : 'error'}">${a.vigente ? 'Vigente' : 'Sin efecto'}</span>
      <button class="btn btn-borde btn-chico" data-agente="${a.cuit}" data-activo="${!a.activo}" type="button">${a.activo ? 'Dar de baja' : 'Reactivar'}</button></div></div>`).join('')
      : '<p class="nota">Ningún comercio está designado: no se percibe en ninguna venta.</p>';
    $('padron').innerHTML = padron.map((p) => `<tr><td>${p.cuit}</td><td>${esc(p.razon_social)}</td><td>${esc(p.actividad)}</td>
      <td><input type="number" min="0" max="99" step="0.01" value="${(p.alicuota * 100).toFixed(2)}" aria-label="Alícuota de ${esc(p.razon_social)}" data-ali="${p.cuit}"></td>
      <td><button class="btn btn-borde btn-chico" data-guardar-ali="${p.cuit}" type="button">Guardar</button></td></tr>`).join('');
  } catch (e) { aviso(e.message, true); }
}
$('f-param').addEventListener('submit', intentar(async () => {
  await api('PUT', '/arba/config-percepcion', { alicuota_no_inscriptos: Number($('p-noinsc').value) / 100, monto_minimo: Number($('p-min').value) });
  aviso('Parámetros guardados. Las próximas ventas los usan.');
}));
$('f-agente').addEventListener('submit', intentar(async () => {
  await api('PUT', `/arba/agentes/${$('a-cuit').value}`, { activo: true, vigente_hasta: $('a-hasta').value || null });
  aviso('Agente designado'); cargarArba();
}));
$('agentes').addEventListener('click', intentar(async (ev) => {
  const b = ev.target.closest('[data-agente]'); if (!b) return;
  await api('PUT', `/arba/agentes/${b.dataset.agente}`, { activo: b.dataset.activo === 'true' });
  aviso('Agente actualizado'); cargarArba();
}));
$('padron').addEventListener('click', intentar(async (ev) => {
  const cuit = ev.target.dataset.guardarAli; if (!cuit) return;
  const v = Number(document.querySelector(`[data-ali="${cuit}"]`).value) / 100;
  await api('PUT', `/arba/padron/${cuit}`, { alicuota: v });
  aviso(`Alícuota de ${cuit} actualizada a ${pct(v)}`);
}));

// ---------- ARCA · IVA por producto ----------
async function cargarProductos() {
  try {
    if (!$('t-terminal').options.length) {
      const ts = await api('GET', '/tpv/terminales');
      $('t-terminal').innerHTML = ts.map((t) => `<option value="${esc(t.id)}">${esc(t.nombre)}</option>`).join('');
    }
    const ps = await api('GET', `/tpv/productos?terminal_id=${encodeURIComponent($('t-terminal').value)}`);
    const opts = (sel) => ['21', '10.5', '27', '0', 'exento'].map((v) => `<option value="${v}"${v === sel ? ' selected' : ''}>${v === 'exento' ? 'Exento' : `${v.replace('.', ',')} %`}</option>`).join('');
    $('productos').innerHTML = ps.length ? ps.map((p) => `<tr><td>${esc(p.nombre)}</td><td>${p.comercio_cuit}</td><td>${pesos(p.precio)}</td>
      <td><select data-iva="${p.id}" aria-label="IVA de ${esc(p.nombre)}">${opts(p.iva || '21')}</select></td></tr>`).join('')
      : '<tr><td colspan="4" class="nota">La terminal no tiene productos.</td></tr>';
    cargarProductos.lista = ps;
  } catch (e) { aviso(e.message, true); }
}
$('t-terminal').addEventListener('change', cargarProductos);
$('productos').addEventListener('change', intentar(async (ev) => {
  const id = ev.target.dataset.iva; if (!id) return;
  const p = cargarProductos.lista.find((x) => x.id === id);
  await api('PUT', `/tpv/productos/${id}`, { nombre: p.nombre, categoria: p.categoria, precio: p.precio, stock: p.stock, activo: p.activo, iva: ev.target.value });
  aviso(`IVA de “${p.nombre}” actualizado`);
}));

// ---------- Municipio ----------
async function cargarMunicipio() {
  try {
    const [alis, comercios] = await Promise.all([api('GET', '/municipio/alicuotas'), api('GET', '/municipio/comercios')]);
    $('alicuotas').innerHTML = alis.map((a) => `<tr><td>${esc(a.rubro)}</td>
      <td><input type="number" min="0" max="99" step="0.001" value="${(a.alicuota * 100).toFixed(3)}" data-rubro-ali="${esc(a.rubro)}" aria-label="Alícuota ${esc(a.rubro)}"></td>
      <td><input type="number" min="0" step="1" value="${a.minimo}" data-rubro-min="${esc(a.rubro)}" aria-label="Mínimo ${esc(a.rubro)}"></td>
      <td><button class="btn btn-borde btn-chico" data-guardar-rubro="${esc(a.rubro)}" type="button">Guardar</button></td></tr>`).join('');
    const lista = Array.isArray(comercios) ? comercios : comercios.items || comercios.comercios || [];
    $('l-cuit').innerHTML = lista.map((c) => `<option value="${c.cuit}">${esc(c.razon_social)} · ${esc(c.rubro_principal || c.rubro || '')}</option>`).join('');
    if (!$('l-periodo').value) $('l-periodo').value = new Date().toISOString().slice(0, 7);
  } catch (e) { aviso(e.message, true); }
}
$('alicuotas').addEventListener('click', intentar(async (ev) => {
  const rubro = ev.target.dataset.guardarRubro; if (!rubro) return;
  const ali = Number(document.querySelector(`[data-rubro-ali="${CSS.escape(rubro)}"]`).value) / 100;
  const min = Number(document.querySelector(`[data-rubro-min="${CSS.escape(rubro)}"]`).value);
  await api('PUT', `/municipio/alicuotas/${encodeURIComponent(rubro)}`, { alicuota: ali, minimo: min });
  aviso(`Rubro “${rubro}” actualizado`);
}));
$('f-rubro').addEventListener('submit', intentar(async (ev) => {
  await api('PUT', `/municipio/alicuotas/${encodeURIComponent($('r-rubro').value.trim())}`, { alicuota: Number($('r-ali').value) / 100 });
  ev.target.reset(); aviso('Rubro agregado'); cargarMunicipio();
}));
$('f-liq').addEventListener('submit', intentar(async () => {
  const r = await api('POST', '/municipio/tributos/liquidar', { cuit: $('l-cuit').value, periodo: $('l-periodo').value });
  $('liq-resultado').innerHTML = `<dl class="resultado" style="margin-top:.8rem">${(r.desglose || []).map((d) => `<dt>${esc(d.concepto)}</dt><dd>${pesos(d.importe)}</dd>`).join('')}
    <dt class="total">Tasa a pagar</dt><dd class="total">${pesos(r.importe)}</dd></dl>
    <p class="nota">Vence el ${esc(r.vencimiento || '—')}. Queda pendiente de pago en Municipio.</p>`;
}));

cargarPadron().catch((e) => aviso(e.message, true));
