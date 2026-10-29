// Asistente de alta única y panel de estado del CORE de comercios.
// API: /core del backend único (doc/CONTRATOS-INTEGRACION.md).
const params = new URLSearchParams(location.search);
const API = params.get('api') || (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? 'http://localhost:3010' : 'https://sintegra-backend.vercel.app');
const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fecha = (iso) => (iso ? new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '—');

const store = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch { /* sin almacenamiento */ } },
};
let token = store.get('core_token');
let usuario = null;
let comercio = null;   // ficha abierta
let miRol = null;

async function api(metodo, ruta, body) {
  const headers = { Accept: 'application/json' };
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  let r;
  try {
    r = await fetch(API + ruta, { method: metodo, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw Object.assign(new Error('No se pudo conectar con el backend'), { status: 0 });
  }
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && token) { salir(); }
  if (!r.ok) throw Object.assign(new Error(data.error || `Error ${r.status}`), { status: r.status, data });
  return data;
}

function aviso(msg, mal = false) {
  const t = $('toast'); t.textContent = msg; t.className = `toast${mal ? ' mal' : ''}`; t.hidden = false;
  clearTimeout(aviso.t); aviso.t = setTimeout(() => { t.hidden = true; }, 4500);
}
function mostrar(vista) {
  document.querySelectorAll('.vista').forEach((v) => { v.hidden = v.id !== vista; });
  $('sesion').hidden = !token;
  $('principal').focus();
}
// Deshabilita el botón mientras corre la acción (si el envío no tiene botón, igual funciona).
async function conBoton(btn, fn) {
  if (btn) btn.disabled = true;
  try { await fn(); } catch (e) { aviso(e.message, true); } finally { if (btn) btn.disabled = false; }
}
const boton = (ev) => ev.submitter || ev.target.querySelector('[type="submit"]');

// ---------- Estados ----------
const ETIQUETA = {
  registrado: 'Registrado', declarado: 'Declarado', verificado: 'Verificado', pendiente: 'Pendiente', observado: 'Observado',
  no_aplicable: 'No aplica', no_disponible: 'No disponible', habilitado: 'Habilitado', en_tramite: 'En trámite',
  vinculado: 'Vinculado', rechazado: 'Rechazado', configurado: 'Configurado', activo: 'Activo',
};
const TONO = {
  verificado: 'ok', habilitado: 'ok', vinculado: 'ok', configurado: 'ok', activo: 'ok', registrado: 'ok',
  declarado: 'info', no_aplicable: 'info', pendiente: 'alerta', en_tramite: 'alerta',
  observado: 'error', rechazado: 'error', no_disponible: 'error',
};
const ORIGEN = { sandbox: 'Sandbox', manual: 'Manual', oficial: 'Oficial', declaracion: 'Declaración', sistema: 'Sistema' };
const chip = (r) => `<span class="chip ${TONO[r] || ''}">${esc(ETIQUETA[r] || 'Sin verificar')}</span>`;
const DETALLE = {
  razon_social: 'Razón social', condicion_iva: 'Condición IVA', estado_cuit: 'Estado CUIT', puntos_venta: 'Puntos de venta',
  regimen: 'Régimen', actividad: 'Actividad', alicuota_prueba: 'Alícuota de prueba', rubro: 'Rubro',
  domicilio_habilitado: 'Domicilio habilitado', estado_municipal: 'Estado municipal', cuenta_id: 'Cuenta', cbu: 'CBU', alias: 'Alias',
  terminales: 'Terminales', ventas_completadas: 'Ventas', motivo: 'Motivo', faltantes: 'Faltan', representacion: 'Representación',
};
function detalles(v) {
  if (!v) return '';
  const filas = Object.entries(v.detalle || {}).filter(([k]) => DETALLE[k])
    .map(([k, val]) => `<dt>${DETALLE[k]}</dt><dd>${esc(Array.isArray(val) ? val.join(', ') : val)}</dd>`);
  if (v.error) filas.push(`<dt>Error</dt><dd>${esc(v.error)}</dd>`);
  filas.push(`<dt>Fecha</dt><dd>${fecha(v.fecha)}</dd>`);
  if (v.evidencia) filas.push(`<dt>Evidencia</dt><dd>${esc(v.evidencia)}</dd>`);
  if (v.vigencia_hasta) filas.push(`<dt>Vigencia</dt><dd>${esc(String(v.vigencia_hasta).slice(0, 10))}</dd>`);
  return `<dl>${filas.join('')}</dl>`;
}
const esAdmin = () => miRol === 'titular' || miRol === 'administrador';

function tarjeta(sistema, titulo, v, extras = '') {
  const manual = esAdmin() && ['arca', 'arba', 'banco'].includes(sistema)
    ? `<button class="btn btn-borde btn-chico" data-manual="${sistema}" type="button">Registrar manual</button>` : '';
  const reverif = sistema !== 'identidad'
    ? `<button class="btn btn-borde btn-chico" data-reverificar="${sistema}" type="button">Reverificar</button>` : '';
  return `<article class="card sis" aria-label="${esc(titulo)}">
    <header><h2>${esc(titulo)}</h2>${chip(v?.resultado)}</header>
    ${v?.origen ? `<span class="origen">Origen: ${ORIGEN[v.origen] || esc(v.origen)}</span>` : ''}
    ${detalles(v)}
    ${v?.accion ? `<p class="accion">${esc(v.accion)}</p>` : ''}
    <div class="botones">${extras}${reverif}${manual}</div>
  </article>`;
}

function renderEstado(e) {
  const sim = (tramite, texto, extra = '') => (esAdmin()
    ? `<button class="btn btn-prim btn-chico" data-tramite="${tramite}"${extra} type="button" title="Simula el trámite en el sistema del organismo (sandbox)">${texto}</button>` : '');
  const muni = (e.municipio || []).map((m, i) => `<div class="suc"><strong>${esc(m.sucursal)}</strong> ${chip(m.resultado)}
      ${m.origen ? `<span class="origen">${ORIGEN[m.origen] || ''}</span>` : ''}${detalles(m.resultado ? m : null)}
      ${m.accion ? `<p class="accion">${esc(m.accion)}</p>` : ''}
      ${esAdmin() ? `<div class="botones">${i === 0 && m.resultado === 'pendiente' ? sim('municipio-solicitud', 'Simular solicitud de habilitación') : ''}${i === 0 && m.resultado === 'en_tramite' ? sim('municipio-resolucion', 'Simular resolución municipal') : ''}<button class="btn btn-borde btn-chico" data-manual="municipio" data-sucursal="${m.sucursal_id}" type="button">Registrar manual</button></div>` : ''}
    </div>`).join('');
  const banco = esAdmin() && e.banco?.resultado !== 'vinculado' ? '<button class="btn btn-prim btn-chico" id="b-vincular" type="button">Vincular banco</button>' : '';
  const tpv = esAdmin() ? '<button class="btn btn-prim btn-chico" id="b-tpv" type="button">Activar TPV</button>' : '';
  $('tarjetas').innerHTML = [
    tarjeta('identidad', 'Identidad', e.identidad),
    tarjeta('arca', 'ARCA · situación fiscal', e.arca, e.arca?.resultado === 'observado' ? sim('arca', 'Simular inscripción en ARCA')
      : e.arca?.resultado === 'verificado' && !e.arca?.detalle?.puntos_venta ? sim('arca-pv', 'Simular alta de punto de venta') : ''),
    tarjeta('arba', 'ARBA · Ingresos Brutos', e.arba, e.arba?.resultado === 'pendiente' ? sim('arba', 'Simular inscripción en IIBB') : ''),
    `<article class="card sis" aria-label="Municipio"><header><h2>Municipio · habilitación</h2></header>${muni || '<p class="nota">Sin sucursales.</p>'}
      <div class="botones"><button class="btn btn-borde btn-chico" data-reverificar="municipio" type="button">Reverificar</button></div></article>`,
    tarjeta('banco', 'Banco · cuenta de cobro', e.banco, banco),
    tarjeta('tpv', 'TPV · punto de venta', e.tpv, tpv),
  ].join('');
  const id = e.identidad?.resultado;
  $('p-identidad').innerHTML = `Identidad: ${chip(id)}`;
}

// ---------- Ingreso ----------
document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('[data-tab]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
  $('f-login').hidden = b.dataset.tab !== 'login'; $('f-registro').hidden = b.dataset.tab !== 'registro';
}));
$('btn-usar-demo').addEventListener('click', () => {
  $('l-email').value = 'demo.comercios.i26@gmail.com'; $('l-pass').value = 'ComerciosDemo2026'; $('l-pass').focus();
});
function iniciar(datos) {
  token = datos.token; store.set('core_token', token); usuario = datos.usuario;
  $('usuario-nombre').textContent = usuario.nombre; cargarMis();
}
$('f-login').addEventListener('submit', (ev) => {
  ev.preventDefault();
  conBoton(boton(ev), async () => iniciar(await api('POST', '/core/sesiones', { email: $('l-email').value, password: $('l-pass').value })));
});
$('f-registro').addEventListener('submit', (ev) => {
  ev.preventDefault();
  conBoton(boton(ev), async () => {
    iniciar(await api('POST', '/core/usuarios', { nombre: $('r-nombre').value, email: $('r-email').value, password: $('r-pass').value }));
    aviso('Usuario creado');
  });
});
function salir() {
  token = null; store.set('core_token', null); usuario = null; comercio = null; mostrar('v-ingreso');
}
$('btn-salir').addEventListener('click', salir);
$('btn-mis').addEventListener('click', () => cargarMis());

// ---------- Mis comercios ----------
async function cargarMis() {
  try {
    const yo = await api('GET', '/core/yo');
    usuario = yo.usuario; $('usuario-nombre').textContent = usuario.nombre;
    $('lista-comercios').innerHTML = yo.comercios.length
      ? yo.comercios.map((k) => `<div class="item"><div><strong>${esc(k.nombre_fantasia || k.razon_social)}</strong>
          <small>CUIT ${esc(k.cuit)} · ${esc(k.razon_social)} · rol ${esc(k.rol)}</small></div>
          ${k.membresia === 'activa' ? `<button class="btn btn-borde" data-abrir="${k.id}" type="button">Ver estado</button>` : '<span class="chip alerta">Acceso pendiente</span>'}</div>`).join('')
      : '<p class="card vacio">Todavía no tenés comercios. Dá de alta uno o solicitá acceso.</p>';
    mostrar('v-mis');
  } catch (e) { if (e.status !== 401) aviso(e.message, true); }
}
$('lista-comercios').addEventListener('click', (ev) => { const id = ev.target.dataset.abrir; if (id) abrirComercio(id); });
$('f-acceso').addEventListener('submit', (ev) => {
  ev.preventDefault();
  conBoton(boton(ev), async () => {
    await api('POST', '/core/comercios/acceso', { cuit: $('a-cuit').value.replace(/\D/g, ''), motivo: $('a-motivo').value });
    aviso('Solicitud enviada. La tiene que aprobar el titular.'); ev.target.reset(); cargarMis();
  });
});

// ---------- Alta ----------
let paso = 1;
function irPaso(n) {
  paso = n;
  document.querySelectorAll('#f-alta fieldset').forEach((f) => { f.hidden = Number(f.dataset.paso) !== n; });
  document.querySelectorAll('.pasos li').forEach((li) => {
    const p = Number(li.dataset.paso); li.className = p === n ? 'actual' : p < n ? 'hecho' : '';
    if (p === n) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
  });
  $('btn-atras').hidden = n === 1;
  $('btn-siguiente').textContent = n === 3 ? 'Dar de alta' : 'Siguiente';
  $('alta-error').textContent = '';
  if (n === 3) resumen();
}
$('btn-nuevo').addEventListener('click', () => { $('f-alta').reset(); $('c-cuit-msg').textContent = ''; irPaso(1); mostrar('v-alta'); });
let cuitOk = false;
$('c-cuit').addEventListener('input', async (ev) => {
  const v = ev.target.value.replace(/\D/g, ''); ev.target.value = v; cuitOk = false;
  const msg = $('c-cuit-msg');
  if (v.length < 11) { msg.textContent = v ? `${v.length} de 11 dígitos` : ''; return; }
  try {
    const r = await api('POST', '/core/cuit/validar', { cuit: v });
    cuitOk = r.valido; msg.textContent = r.valido ? 'CUIT válido (dígito verificador correcto)' : `CUIT inválido: ${r.motivo}`;
    msg.style.color = r.valido ? 'var(--ok)' : 'var(--error)';
  } catch (e) { msg.textContent = e.message; }
});
const val = (id) => $(id).value.trim();
function resumen() {
  const filas = [['CUIT', val('c-cuit')], ['Razón social', val('c-razon')], ['Nombre de fantasía', val('c-fantasia') || '—'],
    ['Contacto', `${val('c-email')} ${val('c-tel')}`], ['Domicilio fiscal', val('c-dom') || '—'],
    ['Sucursal', `${val('s-nombre')} · ${val('s-dom')} · ${val('s-loc')} (${val('s-mun') || 'municipio sin indicar'})`]];
  $('resumen').innerHTML = filas.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('');
}
$('btn-atras').addEventListener('click', () => irPaso(Math.max(1, paso - 1)));
$('btn-siguiente').addEventListener('click', (ev) => {
  const err = $('alta-error');
  if (paso === 1) {
    if (!cuitOk) { err.textContent = 'Revisá el CUIT: tiene que tener 11 dígitos y el dígito verificador correcto.'; $('c-cuit').focus(); return; }
    if (!val('c-razon')) { err.textContent = 'Falta la razón social.'; $('c-razon').focus(); return; }
    if (!$('c-email').checkValidity() || !val('c-email')) { err.textContent = 'Revisá el correo de contacto.'; $('c-email').focus(); return; }
    irPaso(2); return;
  }
  if (paso === 2) {
    if (!val('s-dom')) { err.textContent = 'Falta el domicilio comercial de la sucursal.'; $('s-dom').focus(); return; }
    irPaso(3); return;
  }
  if (!$('c-acepta').checked || !$('c-declara').checked) { err.textContent = 'Tenés que aceptar las condiciones y declarar la representación.'; return; }
  conBoton(ev.target, async () => {
    try {
      const ficha = await api('POST', '/core/comercios', {
        cuit: val('c-cuit'), razon_social: val('c-razon'), nombre_fantasia: val('c-fantasia'), tipo_persona: val('c-tipo') || undefined,
        email_contacto: val('c-email'), telefono_contacto: val('c-tel'), domicilio_fiscal: val('c-dom'),
        sucursal: { nombre: val('s-nombre'), domicilio_comercial: val('s-dom'), localidad: val('s-loc'), municipio: val('s-mun'), provincia: val('s-prov'), codigo_postal: val('s-cp') },
        acepta_condiciones: true, declara_representacion: true,
      });
      aviso('Comercio registrado. Cada sistema ya informó su estado.');
      miRol = 'titular'; pintarFicha(ficha); mostrar('v-panel');
    } catch (e) {
      err.textContent = e.status === 409 ? `${e.message}. Usá “Solicitar acceso” en Mis comercios.` : e.message;
      throw e;
    }
  });
});

// ---------- Panel ----------
async function abrirComercio(id) {
  try {
    const [ficha, yo] = await Promise.all([api('GET', `/core/comercios/${id}`), api('GET', '/core/yo')]);
    miRol = yo.comercios.find((k) => k.id === id)?.rol || null;
    pintarFicha(ficha); tabPanel('estado'); mostrar('v-panel');
  } catch (e) { aviso(e.message, true); }
}
function pintarFicha(f) {
  comercio = f.comercio;
  $('p-nombre').textContent = comercio.nombre_fantasia || comercio.razon_social;
  $('p-sub').textContent = `CUIT ${comercio.cuit} · ${comercio.razon_social} · commerce_id ${comercio.id}`;
  renderEstado(f.estado);
  $('lista-sucursales').innerHTML = f.sucursales.map((s) => `<div class="item"><div><strong>${esc(s.nombre)}</strong>
    <small>${esc(s.domicilio_comercial)}${s.localidad ? ` · ${esc(s.localidad)}` : ''}${s.municipio ? ` · Municipio: ${esc(s.municipio)}` : ''}</small></div>
    <span class="chip">${esc(s.estado)}</span></div>`).join('');
  $('f-sucursal').hidden = !esAdmin();
  document.querySelector('[data-ptab="usuarios"]').hidden = !esAdmin();
}
function tabPanel(nombre) {
  document.querySelectorAll('[data-ptab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.ptab === nombre)));
  document.querySelectorAll('[data-ppanel]').forEach((p) => { p.hidden = p.dataset.ppanel !== nombre; });
  if (nombre === 'usuarios') cargarUsuarios();
  if (nombre === 'historial') cargarHistorial();
}
$('p-tabs').addEventListener('click', (ev) => { if (ev.target.dataset.ptab) tabPanel(ev.target.dataset.ptab); });

$('tarjetas').addEventListener('click', (ev) => {
  const b = ev.target.closest('button'); if (!b) return;
  if (b.dataset.reverificar) {
    conBoton(b, async () => { renderEstado(await api('POST', `/core/comercios/${comercio.id}/verificaciones/${b.dataset.reverificar}`)); aviso('Verificación actualizada'); });
  } else if (b.dataset.manual) {
    abrirManual(b.dataset.manual, b.dataset.sucursal);
  } else if (b.id === 'b-vincular') {
    conBoton(b, async () => { renderEstado(await api('POST', `/core/comercios/${comercio.id}/banco/vincular`)); aviso('Cuenta bancaria vinculada'); });
  } else if (b.id === 'b-tpv') {
    abrirTpv();
  } else if (b.dataset.tramite) {
    abrirTramite(b.dataset.tramite);
  }
});

const MANUALES = {
  arca: ['verificado', 'observado', 'pendiente'], arba: ['verificado', 'observado', 'pendiente', 'no_aplicable'],
  municipio: ['habilitado', 'en_tramite', 'observado', 'no_aplicable'], banco: ['vinculado', 'pendiente', 'rechazado'],
};
let manualActual = null;
function abrirManual(sistema, sucursalId) {
  manualActual = { sistema, sucursalId };
  $('dm-titulo').textContent = `Verificación manual · ${sistema.toUpperCase()}`;
  $('m-resultado').innerHTML = MANUALES[sistema].map((r) => `<option value="${r}">${ETIQUETA[r]}</option>`).join('');
  $('f-manual').reset(); $('m-error').textContent = ''; $('d-manual').showModal();
}
$('f-manual').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  try {
    renderEstado(await api('POST', `/core/comercios/${comercio.id}/verificaciones/${manualActual.sistema}/manual`, {
      resultado: $('m-resultado').value, motivo: $('m-motivo').value, referencia_evidencia: $('m-evidencia').value,
      vigencia_hasta: $('m-vigencia').value || undefined, sucursal_id: manualActual.sucursalId,
    }));
    $('d-manual').close(); aviso('Verificación manual registrada');
  } catch (e) { $('m-error').textContent = e.message; }
});

async function abrirTpv() {
  $('t-error').textContent = '';
  try {
    const terminales = await api('GET', '/tpv/terminales');
    $('t-terminal').innerHTML = terminales.map((t) => `<option value="${esc(t.id)}">${esc(t.nombre)}</option>`).join('');
  } catch (e) { $('t-error').textContent = e.message; }
  $('d-tpv').showModal();
}
$('f-tpv').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  try {
    const r = await api('POST', `/core/comercios/${comercio.id}/tpv/activar`, { terminal_id: $('t-terminal').value, rubro: $('t-rubro').value });
    renderEstado(r.estado); $('d-tpv').close();
    aviso(r.advertencias.length ? `TPV activado. Atención: ${r.advertencias.join(' · ')}` : 'TPV activado');
  } catch (e) {
    $('t-error').innerHTML = esc(e.message) + (e.data?.faltantes ? `<br>• ${e.data.faltantes.map(esc).join('<br>• ')}` : '');
    if (e.status === 409) api('GET', `/core/comercios/${comercio.id}/estado`).then(renderEstado).catch(() => {});
  }
});

$('f-sucursal').addEventListener('submit', (ev) => {
  ev.preventDefault();
  conBoton(boton(ev), async () => {
    await api('POST', `/core/comercios/${comercio.id}/sucursales`, { nombre: val('ns-nombre'), domicilio_comercial: val('ns-dom'), localidad: val('ns-loc'), municipio: val('ns-mun') });
    ev.target.reset(); aviso('Sucursal agregada'); pintarFicha(await api('GET', `/core/comercios/${comercio.id}`)); tabPanel('sucursales');
  });
});

async function cargarUsuarios() {
  try {
    const lista = await api('GET', `/core/comercios/${comercio.id}/membresias`);
    $('lista-usuarios').innerHTML = lista.map((m) => `<div class="item"><div><strong>${esc(m.nombre)}</strong>
      <small>${esc(m.email)} · ${esc(m.rol)}${m.motivo ? ` · “${esc(m.motivo)}”` : ''}</small></div>
      ${m.estado === 'pendiente' ? `<div class="botones"><button class="btn btn-prim btn-chico" data-resolver="aprobar" data-mid="${m.id}" type="button">Aprobar</button>
        <button class="btn btn-borde btn-chico" data-resolver="rechazar" data-mid="${m.id}" type="button">Rechazar</button></div>` : `<span class="chip ${m.estado === 'activa' ? 'ok' : ''}">${esc(m.estado)}</span>`}</div>`).join('');
  } catch (e) { $('lista-usuarios').innerHTML = `<p class="card vacio">${esc(e.message)}</p>`; }
}
$('lista-usuarios').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-resolver]'); if (!b) return;
  conBoton(b, async () => { await api('POST', `/core/comercios/${comercio.id}/membresias/${b.dataset.mid}/resolver`, { decision: b.dataset.resolver }); aviso('Solicitud resuelta'); cargarUsuarios(); });
});
async function cargarHistorial() {
  try {
    const h = await api('GET', `/core/comercios/${comercio.id}/verificaciones`);
    $('historial').innerHTML = h.map((v) => `<tr><td>${fecha(v.fecha)}</td><td>${esc(v.sistema)}</td><td>${chip(v.resultado)}</td>
      <td>${ORIGEN[v.origen] || esc(v.origen)}</td><td>${esc(v.evidencia || v.error || '')}</td></tr>`).join('');
  } catch (e) { aviso(e.message, true); }
}

// ---------- Trámites simulados en cada organismo (sandbox) ----------
// Cada botón llama al sistema dueño (ARCA, ARBA, Municipio) y después el CORE
// reverifica. El CORE nunca escribe esos datos por su cuenta.
const TRAMITES = {
  arca: {
    titulo: 'Simular inscripción en ARCA', sistema: 'arca',
    nota: 'ARCA registra el CUIT en su padrón fiscal sandbox con la condición frente al IVA.',
    campos: `<label for="tr-iva">Condición frente al IVA</label><select id="tr-iva">
      <option value="responsable_inscripto">Responsable Inscripto</option><option value="monotributo">Monotributo</option>
      <option value="exento">Exento</option></select>`,
    enviar: () => api('POST', '/arca/contribuyentes', { cuit: comercio.cuit, razon_social: comercio.razon_social,
      tipo_persona: comercio.tipo_persona || undefined, condicion_iva: $('tr-iva').value, domicilio_fiscal: comercio.domicilio_fiscal || undefined }),
  },
  'arca-pv': {
    titulo: 'Simular alta de punto de venta', sistema: 'arca',
    nota: 'ARCA habilita un punto de venta para facturar. Los tipos de comprobante salen de la condición frente al IVA.',
    campos: '<label for="tr-pv">Número de punto de venta</label><input id="tr-pv" type="number" min="1" max="99999" value="1" required>',
    enviar: () => api('POST', '/arca/puntos-venta', { cuit: comercio.cuit, punto_venta: Number($('tr-pv').value) }),
  },
  arba: {
    titulo: 'Simular inscripción en Ingresos Brutos', sistema: 'arba',
    nota: 'ARBA registra la actividad. La alícuota es de prueba: no corresponde a ninguna norma vigente.',
    campos: `<label for="tr-act">Actividad</label><input id="tr-act" value="Comercio minorista" required>
      <label for="tr-ali">Alícuota de prueba (%)</label><input id="tr-ali" type="number" min="0" max="10" step="0.1" value="3" required>`,
    enviar: () => api('POST', '/arba/padron', { cuit: comercio.cuit, actividad: $('tr-act').value.trim(), alicuota: Number($('tr-ali').value) / 100 }),
  },
  'municipio-solicitud': {
    titulo: 'Simular solicitud de habilitación', sistema: 'municipio',
    nota: 'El Municipio registra el trámite como pendiente. La aprobación la resuelve el municipio.',
    campos: `<label for="tr-rubro">Rubro</label><input id="tr-rubro" value="Comercio minorista" required>`,
    enviar: async () => {
      const suc = (await api('GET', `/core/comercios/${comercio.id}/sucursales`))[0];
      const arca = (await api('GET', `/core/comercios/${comercio.id}/estado`)).arca;
      return api('POST', '/municipio/comercios', { cuit: comercio.cuit, razon_social: comercio.razon_social,
        condicion_fiscal: arca?.detalle?.condicion_iva || 'Responsable Inscripto', direccion: suc.domicilio_comercial, rubro_principal: $('tr-rubro').value.trim() });
    },
  },
  'municipio-resolucion': {
    titulo: 'Simular resolución municipal', sistema: 'municipio',
    nota: 'Simula la decisión del municipio. Queda registrado el número de expediente.',
    campos: `<label for="tr-res">Resolución</label><select id="tr-res"><option value="activa">Aprobar habilitación</option>
      <option value="suspendida">Suspender</option><option value="baja">Dar de baja</option></select>
      <label for="tr-exp">Número de expediente</label><input id="tr-exp" required minlength="3" placeholder="Ej.: EXP-2026-0001">`,
    enviar: () => api('POST', `/municipio/comercios/${comercio.cuit}/resolucion`, { estado: $('tr-res').value, expediente: $('tr-exp').value.trim() }),
  },
};
let tramiteActual = null;
function abrirTramite(clave) {
  tramiteActual = TRAMITES[clave];
  $('dr-titulo').textContent = tramiteActual.titulo;
  $('dr-nota').textContent = tramiteActual.nota;
  $('dr-campos').innerHTML = tramiteActual.campos;
  $('dr-error').textContent = '';
  $('d-tramite').showModal();
}
$('f-tramite').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const btn = boton(ev); if (btn) btn.disabled = true;
  try {
    await tramiteActual.enviar();
    renderEstado(await api('POST', `/core/comercios/${comercio.id}/verificaciones/${tramiteActual.sistema}`));
    $('d-tramite').close(); aviso('Trámite simulado y verificación actualizada');
  } catch (e) { $('dr-error').textContent = e.message; } finally { if (btn) btn.disabled = false; }
});

// ---------- Inicio ----------
if (token) cargarMis(); else mostrar('v-ingreso');
