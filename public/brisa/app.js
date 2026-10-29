"use strict";

/* Mostrador · pantallas del TPV.
   Sin frameworks ni dependencias: habla con la API del mismo servidor (/tpv/...).
   Los precios y totales que se muestran antes de cobrar son orientativos:
   el servidor los recalcula con su catálogo al registrar la venta. */

const estado = {
  comercios: [],
  comercioCuit: null,
  productos: [],
  categoria: "Todas",
  busqueda: "",
  tickets: new Map(),      // cuit -> Map(productoId -> cantidad)
  resultado: null,         // venta mostrada en la columna del ticket después de cobrar
  ventaEnCurso: null,      // { cuerpo } de la última venta enviada, para reintentar con el mismo id_venta
};

const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
const vista = $("#vista");
const API_BASE = "https://sintegra-backend.vercel.app";

// ---------- Utilidades ----------

const formatoPesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 });
const pesos = (n) => (n == null ? "—" : formatoPesos.format(n));
const formatoFecha = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" });
const fechaHora = (iso) => (iso ? formatoFecha.format(new Date(iso)) : "—");

function esc(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function guardarPreferencia(clave, valor) {
  try { localStorage.setItem("mostrador." + clave, valor); } catch { /* sin almacenamiento: no pasa nada */ }
}
function leerPreferencia(clave) {
  try { return localStorage.getItem("mostrador." + clave); } catch { return null; }
}

async function api(ruta, opciones = {}) {
  const init = { method: opciones.method || "GET", headers: { Accept: "application/json" } };
  if (opciones.body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(opciones.body);
  }
  let resp;
  try {
    resp = await fetch(`${API_BASE}${ruta}`, init);
  } catch {
    return { ok: false, status: 0, data: { error: "No se pudo conectar con el TPV. Revisá que el servidor esté encendido." } };
  }
  let data = null;
  try { data = await resp.json(); } catch { data = null; }
  return { ok: resp.ok, status: resp.status, data };
}

let temporizadorAviso;
function avisar(texto) {
  const aviso = $("#aviso");
  aviso.textContent = texto;
  aviso.classList.add("visible");
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => aviso.classList.remove("visible"), 2600);
}

function nuevoIdVenta() {
  const d = new Date();
  const fecha = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const azar = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(16).slice(2)).replace(/-/g, "").slice(0, 8);
  return `venta-${fecha}-${azar}`;
}

function parsearPrecio(texto) {
  let t = String(texto || "").trim().replace(/\s|\$/g, "");
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

const comercioActual = () => estado.comercios.find((c) => c.cuit === estado.comercioCuit) || null;

function ticketActual() {
  if (!estado.tickets.has(estado.comercioCuit)) estado.tickets.set(estado.comercioCuit, new Map());
  return estado.tickets.get(estado.comercioCuit);
}

const ETIQUETA_ESTADO = { COMPLETADA: "Completada", PENDIENTE: "Pendiente", ERROR: "Con error" };
const CLASE_ESTADO = { COMPLETADA: "completada", PENDIENTE: "pendiente", ERROR: "error" };
const etiquetaEstado = (e) => `<span class="etiqueta ${CLASE_ESTADO[e] || "neutra"}">${esc(ETIQUETA_ESTADO[e] || e)}</span>`;
const nombreMedio = (m) => (m === "billetera" ? "Billetera" : "Banco");

// ---------- Datos base ----------

async function cargarComercios() {
  const r = await api("/tpv/comercios");
  estado.comercios = r.ok ? r.data : [];
  const activos = estado.comercios.filter((c) => c.activo);
  const preferido = leerPreferencia("comercio");
  if (!activos.some((c) => c.cuit === estado.comercioCuit)) {
    estado.comercioCuit = (activos.find((c) => c.cuit === preferido) || activos[0] || {}).cuit || null;
  }
  const select = $("#comercio");
  select.innerHTML = activos.length
    ? activos.map((c) => `<option value="${esc(c.cuit)}">${esc(c.razon_social)}</option>`).join("")
    : `<option value="">Sin comercios activos</option>`;
  select.value = estado.comercioCuit || "";
}

async function cargarProductos() {
  if (!estado.comercioCuit) { estado.productos = []; return; }
  const r = await api(`/tpv/productos?terminal_id=brisa&comercio_cuit=${encodeURIComponent(estado.comercioCuit)}&incluir_inactivos=true`);
  estado.productos = r.ok ? r.data : [];
}

$("#comercio").addEventListener("change", async (e) => {
  estado.comercioCuit = e.target.value;
  guardarPreferencia("comercio", estado.comercioCuit);
  estado.categoria = "Todas";
  estado.busqueda = "";
  estado.resultado = null;
  await cargarProductos();
  enrutar();
});

// ---------- Conexiones ----------

async function revisarConexiones() {
  const r = await api("/tpv/integraciones");
  const punto = $("#conexiones-punto");
  const lista = $("#lista-conexiones");
  if (!r.ok) {
    punto.className = "punto mal";
    lista.innerHTML = `<li>No se pudo consultar el estado.</li>`;
    return;
  }
  const ok = r.data.filter((s) => s.estado === "ok").length;
  punto.className = "punto " + (ok === r.data.length ? "ok" : ok > 0 ? "parcial" : "mal");
  $("#conexiones").title = `${ok} de ${r.data.length} servicios responden`;
  const textos = { ok: "Responde", sin_respuesta: "No responde", sin_configurar: "Sin configurar" };
  const clases = { ok: "ok", sin_respuesta: "mal", sin_configurar: "" };
  lista.innerHTML = r.data.map((s) =>
    `<li><span class="punto ${clases[s.estado]}"></span>${esc(s.nombre)}<span class="estado-texto">${textos[s.estado] || esc(s.estado)}</span></li>`
  ).join("");
}

$("#conexiones").addEventListener("click", async () => {
  await revisarConexiones();
  $("#dialogo-conexiones").showModal();
});

// ---------- Router ----------

function enrutar() {
  const partes = (location.hash.replace(/^#\/?/, "") || "vender").split("/");
  const [ruta, param] = partes;
  $$(".navegacion a").forEach((a) => {
    const activa = a.dataset.ruta === ruta || (ruta === "venta" && a.dataset.ruta === "ventas");
    if (activa) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  switch (ruta) {
    case "ventas": return vistaVentas();
    case "venta": return vistaDetalleVenta(decodeURIComponent(param || ""));
    case "productos": return vistaProductos();
    case "comercios": return vistaComercios();
    default: return vistaVender();
  }
}
window.addEventListener("hashchange", () => { enrutar(); vista.focus({ preventScroll: true }); window.scrollTo(0, 0); });

// =====================================================================
// VENDER
// =====================================================================

function vistaVender() {
  document.title = "Vender | Mostrador";
  const comercio = comercioActual();
  if (!comercio) {
    vista.innerHTML = `<div class="pagina"><div class="vacio"><h3>Todavía no hay comercios activos</h3>
      <p>Cargá uno para empezar a vender.</p><p style="margin-top:14px"><a class="boton boton-primario" href="#/comercios">Ir a Comercios</a></p></div></div>`;
    return;
  }

  vista.innerHTML = `
    <div class="vender">
      <section class="catalogo" aria-label="Catálogo">
        <div class="catalogo-cabecera">
          <div class="buscador">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
            <input id="buscar" type="search" placeholder="Buscar producto" autocomplete="off" aria-label="Buscar producto" value="${esc(estado.busqueda)}">
            <kbd title="Atajo de teclado">/</kbd>
          </div>
        </div>
        <div class="categorias" id="categorias-filtro" role="group" aria-label="Filtrar por categoría"></div>
        <ul class="productos" id="productos"></ul>
      </section>
      <aside class="columna-ticket" aria-label="Ticket">
        <div class="ticket-envoltura" id="ticket"></div>
      </aside>
    </div>`;

  const buscar = $("#buscar");
  buscar.addEventListener("input", () => { estado.busqueda = buscar.value; pintarProductos(); });
  buscar.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const primero = productosVisibles().find((p) => p.activo && p.stock > 0);
      if (primero) { agregar(primero.id); buscar.select(); }
    } else if (e.key === "Escape") {
      buscar.value = ""; estado.busqueda = ""; pintarProductos();
    }
  });

  pintarCategorias();
  pintarProductos();
  pintarTicket();
}

function productosVisibles() {
  const q = estado.busqueda.trim().toLowerCase();
  return estado.productos.filter((p) =>
    p.activo
    && (estado.categoria === "Todas" || p.categoria === estado.categoria)
    && (!q || p.nombre.toLowerCase().includes(q) || p.categoria.toLowerCase().includes(q) || p.id.toLowerCase() === q));
}

function pintarCategorias() {
  const cont = $("#categorias-filtro");
  if (!cont) return;
  const categorias = ["Todas", ...new Set(estado.productos.filter((p) => p.activo).map((p) => p.categoria))];
  cont.innerHTML = categorias.map((c) =>
    `<button type="button" class="categoria" aria-pressed="${c === estado.categoria}" data-categoria="${esc(c)}">${esc(c)}</button>`).join("");
  cont.onclick = (e) => {
    const b = e.target.closest("[data-categoria]");
    if (!b) return;
    estado.categoria = b.dataset.categoria;
    pintarCategorias();
    pintarProductos();
  };
}

function pintarProductos() {
  const lista = $("#productos");
  if (!lista) return;
  const visibles = productosVisibles();
  const ticket = ticketActual();

  if (visibles.length === 0) {
    lista.innerHTML = estado.productos.some((p) => p.activo)
      ? `<li class="vacio" style="grid-column:1/-1"><h3>No hay productos que coincidan</h3><p>Probá con otra palabra o elegí “Todas”.</p></li>`
      : `<li class="vacio" style="grid-column:1/-1"><h3>Este comercio todavía no tiene productos</h3><p><a href="#/productos">Cargá el primero</a> para empezar a vender.</p></li>`;
    return;
  }

  lista.innerHTML = visibles.map((p) => {
    const enTicket = ticket.get(p.id) || 0;
    const sinStock = p.stock - enTicket <= 0;
    const stockTexto = p.stock === 0 ? "Sin stock" : `${p.stock} en stock`;
    return `<li>
      <button type="button" class="producto" data-id="${esc(p.id)}" ${p.stock === 0 ? "disabled" : ""}
        aria-label="Agregar ${esc(p.nombre)}, ${pesos(p.precio)}${enTicket ? `, ${enTicket} en el ticket` : ""}">
        ${enTicket ? `<span class="producto-en-ticket">${enTicket}</span>` : ""}
        <span class="producto-categoria">${esc(p.categoria)}</span>
        <span class="producto-nombre">${esc(p.nombre)}</span>
        <span class="producto-pie">
          <span class="producto-precio">${pesos(p.precio)}</span>
          <span class="producto-stock ${p.stock <= 5 || sinStock ? "bajo" : ""}">${stockTexto}</span>
        </span>
      </button></li>`;
  }).join("");

  lista.onclick = (e) => {
    const b = e.target.closest(".producto");
    if (b && !b.disabled) agregar(b.dataset.id);
  };
}

function agregar(id) {
  if (estado.resultado) { avisar("Terminá o descartá la venta anterior para empezar otra"); return; }
  const p = estado.productos.find((x) => x.id === id);
  if (!p) return;
  const ticket = ticketActual();
  const actual = ticket.get(id) || 0;
  if (actual >= p.stock) { avisar(`No hay más stock de ${p.nombre}`); return; }
  ticket.set(id, actual + 1);
  pintarProductos();
  pintarTicket();
}

function cambiarCantidad(id, cantidad) {
  const p = estado.productos.find((x) => x.id === id);
  const ticket = ticketActual();
  if (!p) return;
  const nueva = Math.max(0, Math.min(Number(cantidad) || 0, p.stock, 999));
  if (nueva === 0) ticket.delete(id); else ticket.set(id, nueva);
  if (Number(cantidad) > p.stock) avisar(`Solo hay ${p.stock} de ${p.nombre}`);
  pintarProductos();
  pintarTicket();
}

function lineasDelTicket() {
  const ticket = ticketActual();
  return [...ticket.entries()]
    .map(([id, cantidad]) => {
      const p = estado.productos.find((x) => x.id === id);
      return p ? { producto: p, cantidad, subtotal: Math.round(p.precio * cantidad * 100) / 100 } : null;
    })
    .filter(Boolean);
}

function pintarTicket() {
  const cont = $("#ticket");
  if (!cont) return;
  if (estado.resultado) { pintarResultado(cont, estado.resultado); return; }

  const comercio = comercioActual();
  const lineas = lineasDelTicket();
  const subtotal = lineas.reduce((s, l) => s + l.subtotal, 0);
  const unidades = lineas.reduce((s, l) => s + l.cantidad, 0);

  cont.innerHTML = `
    <div class="ticket">
      <div class="ticket-cabecera">
        <h2>Ticket</h2>
        <span class="ticket-comercio">${esc(comercio?.razon_social)}</span>
      </div>
      ${lineas.length === 0
        ? `<p class="ticket-vacio">Tocá un producto para sumarlo.</p>`
        : `<ul class="ticket-lineas">${lineas.map((l) => `
          <li class="linea" data-id="${esc(l.producto.id)}">
            <div>
              <div class="linea-nombre">${esc(l.producto.nombre)}</div>
              <div class="linea-unitario num">${pesos(l.producto.precio)} c/u</div>
            </div>
            <div class="linea-importe">${pesos(l.subtotal)}</div>
            <div class="linea-controles">
              <div class="cantidad">
                <button type="button" data-accion="menos" aria-label="Restar uno">−</button>
                <input type="number" min="0" max="${l.producto.stock}" value="${l.cantidad}" aria-label="Cantidad de ${esc(l.producto.nombre)}">
                <button type="button" data-accion="mas" aria-label="Sumar uno" ${l.cantidad >= l.producto.stock ? "disabled" : ""}>+</button>
              </div>
              <button type="button" class="quitar" data-accion="quitar">Quitar</button>
            </div>
          </li>`).join("")}</ul>`}
      <div class="ticket-totales">
        <div class="fila-total"><span>${unidades} ${unidades === 1 ? "artículo" : "artículos"}</span><span class="num">${pesos(subtotal)}</span></div>
        <div class="fila-total"><span>Percepción IIBB</span><span class="tenue">al cobrar</span></div>
        <div class="fila-total grande"><span>Subtotal</span><span class="num">${pesos(subtotal)}</span></div>
      </div>
    </div>
    <div class="ticket-acciones">
      <button type="button" class="boton boton-primario" id="cobrar" ${lineas.length ? "" : "disabled"}>Cobrar ${lineas.length ? pesos(subtotal) : ""}</button>
      ${lineas.length ? `<button type="button" class="boton boton-texto" id="vaciar">Vaciar ticket</button>` : ""}
    </div>`;

  const lista = $(".ticket-lineas", cont);
  if (lista) {
    lista.addEventListener("click", (e) => {
      const b = e.target.closest("[data-accion]");
      if (!b) return;
      const id = b.closest(".linea").dataset.id;
      const actual = ticketActual().get(id) || 0;
      if (b.dataset.accion === "mas") cambiarCantidad(id, actual + 1);
      if (b.dataset.accion === "menos") cambiarCantidad(id, actual - 1);
      if (b.dataset.accion === "quitar") cambiarCantidad(id, 0);
    });
    lista.addEventListener("change", (e) => {
      if (e.target.matches("input")) cambiarCantidad(e.target.closest(".linea").dataset.id, e.target.value);
    });
  }
  $("#cobrar", cont)?.addEventListener("click", abrirCobro);
  $("#vaciar", cont)?.addEventListener("click", () => { ticketActual().clear(); pintarProductos(); pintarTicket(); });
}

// ---------- Etapas de una venta ----------

const ETAPAS = [
  { clave: "comercio_validado", titulo: () => "Municipio valida el comercio" },
  { clave: "percepcion_calculada", titulo: () => "ARBA calcula la percepción" },
  { clave: "pago_confirmado", titulo: (v) => `${nombreMedio(v.pago.medio)} cobra el total` },
  { clave: "comprobante_emitido", titulo: () => "ARCA emite el comprobante" },
];

function detalleEtapa(clave, v) {
  switch (clave) {
    case "comercio_validado": return "Verificado";
    case "percepcion_calculada": return `${pesos(v.percepcion)}${v.alicuota_percepcion != null ? ` (${(v.alicuota_percepcion * 100).toLocaleString("es-AR")} %)` : ""}`;
    case "pago_confirmado": return `Movimiento ${v.pago.id_movimiento}`;
    case "comprobante_emitido": return `N° ${v.comprobante?.numero_comprobante || v.comprobante?.id}`;
  }
  return "";
}

function etapasHtml(v) {
  const indicePendiente = v.etapa_pendiente ? ETAPAS.findIndex((e) => e.clave === v.etapa_pendiente) : ETAPAS.length;
  return `<ol class="etapas">${ETAPAS.map((e, i) => {
    let clase = "", marca = "", detalle = "";
    if (i < indicePendiente) { clase = "hecha"; marca = "✓"; detalle = detalleEtapa(e.clave, v); }
    else if (i === indicePendiente && v.estado !== "COMPLETADA") {
      clase = "fallida" + (v.estado === "ERROR" ? " error" : ""); marca = "!"; detalle = v.ultimo_error || "Sin confirmar";
    } else { detalle = "En espera"; }
    return `<li class="etapa ${clase}"><span class="etapa-marca" aria-hidden="true">${marca}</span>
      <div><div>${esc(e.titulo(v))}</div><div class="etapa-detalle">${esc(detalle)}</div></div></li>`;
  }).join("")}</ol>`;
}

function cuerpoReintento(v) {
  const cuerpo = {
    id_venta: v.id_venta,
    comercio_cuit: v.comercio_cuit,
    items: v.lineas.map((l) => ({ producto_id: l.producto_id, cantidad: l.cantidad })),
    medio_pago: v.pago.medio,
  };
  if (v.pago.medio === "banco") cuerpo.cuenta_origen = v.pago.cuenta_origen;
  else cuerpo.cuit_pagador = v.pago.cuit_pagador;
  return cuerpo;
}

// ---------- Resultado en la columna del ticket ----------

function pintarResultado(cont, v) {
  const completa = v.estado === "COMPLETADA";
  const sello = completa ? "ok" : v.estado === "ERROR" ? "error" : "pendiente";
  const titulo = completa ? "Venta cobrada" : v.estado === "ERROR" ? "La venta no se completó" : "Venta pendiente";
  const subtitulo = completa
    ? `Comprobante ${esc(v.comprobante?.numero_comprobante || "")}`
    : "Quedó guardada. Podés reintentar sin cobrar dos veces.";

  cont.innerHTML = `
    <div class="ticket comprobante">
      <div class="comprobante-estado">
        <span class="sello ${sello}" aria-hidden="true">${completa ? "✓" : "!"}</span>
        <div><h2>${titulo}</h2><p class="tenue" style="font-size:.86rem">${subtitulo}</p></div>
      </div>
      <ul class="ticket-lineas" style="min-height:0">${v.lineas.map((l) => `
        <li class="linea"><div><div class="linea-nombre">${esc(l.nombre)}</div>
          <div class="linea-unitario num">${l.cantidad} × ${pesos(l.precio_unitario)}</div></div>
          <div class="linea-importe">${pesos(l.subtotal)}</div></li>`).join("")}
      </ul>
      <div class="ticket-totales">
        <div class="fila-total"><span>Subtotal</span><span class="num">${pesos(v.subtotal)}</span></div>
        <div class="fila-total"><span>Percepción IIBB</span><span class="num">${v.percepcion == null ? "—" : pesos(v.percepcion)}</span></div>
        <div class="fila-total grande"><span>Total</span><span class="num">${pesos(v.total ?? v.subtotal)}</span></div>
      </div>
      ${completa ? `<dl>
        <div><dt>Pagó con</dt><dd>${nombreMedio(v.pago.medio)}</dd></div>
        <div><dt>Comprobante</dt><dd>${esc((v.comprobante.tipo_comprobante || "").replace("_", " "))} ${esc(v.comprobante.numero_comprobante || "")}</dd></div>
        <div><dt>CAE</dt><dd class="cae">${esc(v.comprobante.cae || "—")}</dd></div>
        <div><dt>Venta</dt><dd class="codigo">${esc(v.id_venta)}</dd></div>
      </dl>` : etapasHtml(v)}
      <div style="height:12px"></div>
    </div>
    <div class="ticket-acciones">
      ${completa
        ? `<button type="button" class="boton boton-primario" id="nueva-venta">Nueva venta</button>
           <button type="button" class="boton boton-secundario" id="imprimir">Imprimir comprobante</button>`
        : `<button type="button" class="boton boton-primario" id="reintentar">Reintentar cobro</button>
           <a class="boton boton-secundario" href="#/venta/${encodeURIComponent(v.id_venta)}">Ver detalle</a>
           <button type="button" class="boton boton-texto" id="descartar">Volver al ticket</button>`}
    </div>`;

  $("#nueva-venta", cont)?.addEventListener("click", terminarVenta);
  $("#imprimir", cont)?.addEventListener("click", () => window.print());
  $("#descartar", cont)?.addEventListener("click", () => {
    avisar("La venta anterior quedó guardada en Ventas");
    terminarVenta();
  });
  $("#reintentar", cont)?.addEventListener("click", async (e) => {
    e.currentTarget.disabled = true;
    e.currentTarget.textContent = "Reintentando…";
    const r = await enviarVenta(cuerpoReintento(v));
    if (r.venta) { estado.resultado = r.venta; if (r.venta.estado === "COMPLETADA") await despuesDeCobrar(); pintarTicket(); }
    else { avisar(r.error); pintarTicket(); }
  });
}

async function terminarVenta() {
  estado.resultado = null;
  estado.ventaEnCurso = null;
  await cargarProductos();
  pintarCategorias();
  pintarProductos();
  pintarTicket();
  $("#buscar")?.focus();
}

async function despuesDeCobrar() {
  ticketActual().clear();
  estado.ventaEnCurso = null;
  await cargarProductos();
  avisar("Venta cobrada");
}

// ---------- Cobro ----------

const dialogoCobro = $("#dialogo-cobro");
const cuerpoCobroOriginal = $("#cobro-cuerpo").innerHTML;

function abrirCobro() {
  const lineas = lineasDelTicket();
  if (!lineas.length) return;
  $("#cobro-cuerpo").innerHTML = cuerpoCobroOriginal;
  const pie = $(".dialogo-pie", dialogoCobro);
  pie.hidden = false;

  const medio = leerPreferencia("medio") || "banco";
  $$('input[name="medio"]', dialogoCobro).forEach((r) => { r.checked = r.value === medio; });
  $("#cuenta-origen").value = leerPreferencia("cuenta") || "";
  $("#cuit-pagador").value = leerPreferencia("cuit") || "";
  $("#cobro-subtotal").textContent = pesos(lineas.reduce((s, l) => s + l.subtotal, 0));
  actualizarMedio();
  $$('input[name="medio"]', dialogoCobro).forEach((r) => r.addEventListener("change", actualizarMedio));

  dialogoCobro.showModal();
  (medio === "banco" ? $("#cuenta-origen") : $("#cuit-pagador")).focus();
}

function actualizarMedio() {
  const medio = $('input[name="medio"]:checked', dialogoCobro).value;
  $("#campo-cuenta").hidden = medio !== "banco";
  $("#campo-cuit").hidden = medio !== "billetera";
  $("#cobro-error").hidden = true;
}

function errorCobro(texto, campo) {
  const p = $("#cobro-error");
  p.textContent = texto;
  p.hidden = false;
  $$("#cobro-cuerpo input").forEach((i) => i.removeAttribute("aria-invalid"));
  if (campo) { campo.setAttribute("aria-invalid", "true"); campo.focus(); }
}

$("#form-cobro").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!$("#cobro-error")) return; // está procesando
  const medio = $('input[name="medio"]:checked', dialogoCobro).value;
  const cuerpo = {
    id_venta: null,
    comercio_cuit: estado.comercioCuit,
    terminal_id: "brisa",
    items: lineasDelTicket().map((l) => ({ producto_id: l.producto.id, cantidad: l.cantidad })),
    medio_pago: medio,
  };

  if (medio === "banco") {
    const cuenta = $("#cuenta-origen").value.trim();
    if (!cuenta) return errorCobro("Escribí la cuenta de quien paga.", $("#cuenta-origen"));
    cuerpo.cuenta_origen = cuenta;
    guardarPreferencia("cuenta", cuenta);
  } else {
    const cuit = $("#cuit-pagador").value.replace(/\D/g, "");
    if (cuit.length !== 11) return errorCobro("El CUIT tiene que tener 11 números.", $("#cuit-pagador"));
    cuerpo.cuit_pagador = cuit;
    guardarPreferencia("cuit", cuit);
  }
  guardarPreferencia("medio", medio);

  // Mismo contenido que el intento anterior → misma clave, para no duplicar.
  const huella = JSON.stringify({ ...cuerpo, id_venta: null });
  cuerpo.id_venta = estado.ventaEnCurso?.huella === huella ? estado.ventaEnCurso.id : nuevoIdVenta();
  estado.ventaEnCurso = { id: cuerpo.id_venta, huella };

  const cuerpoHtml = $("#cobro-cuerpo").innerHTML;
  $("#cobro-cuerpo").innerHTML = `<div class="procesando" role="status">
      <p>Cobrando con ${nombreMedio(medio)}. Se valida el comercio, se calcula la percepción y se emite el comprobante.</p>
      <div class="barra-progreso"></div></div>`;
  $(".dialogo-pie", dialogoCobro).hidden = true;

  const r = await enviarVenta(cuerpo);

  if (r.venta) {
    dialogoCobro.close();
    estado.resultado = r.venta;
    if (r.venta.estado === "COMPLETADA") await despuesDeCobrar();
    pintarProductos();
    pintarTicket();
    return;
  }

  // Error de validación (no se guardó nada): volver al formulario.
  $("#cobro-cuerpo").innerHTML = cuerpoHtml;
  $(".dialogo-pie", dialogoCobro).hidden = false;
  $$('input[name="medio"]', dialogoCobro).forEach((x) => x.addEventListener("change", actualizarMedio));
  estado.ventaEnCurso = null;
  errorCobro(r.error);
  await cargarProductos();
  pintarProductos();
});

$$("[data-cerrar]").forEach((b) => b.addEventListener("click", () => b.closest("dialog").close()));

/** Envía la venta. Devuelve { venta } si quedó registrada (completa o no) o { error } si fue rechazada antes de guardarse. */
async function enviarVenta(cuerpo) {
  const r = await api("/tpv/ventas", { method: "POST", body: cuerpo });
  if (r.ok) {
    const detalle = await api(`/tpv/ventas/${encodeURIComponent(r.data.id_venta || cuerpo.id_venta)}`);
    if (detalle.ok) return { venta: detalle.data };
    return { venta: { ...r.data, estado: String(r.data.estado || "completada").toUpperCase(), lineas: [] } };
  }
  if (r.data?.id_venta) {
    const detalle = await api(`/tpv/ventas/${encodeURIComponent(r.data.id_venta)}`);
    if (detalle.ok) return { venta: detalle.data };
  }
  return { error: r.data?.error || `No se pudo registrar la venta (HTTP ${r.status})` };
}

// Atajo: "/" enfoca el buscador.
document.addEventListener("keydown", (e) => {
  if (e.key === "/" && !e.target.closest("input, textarea, select, dialog")) {
    const b = $("#buscar");
    if (b) { e.preventDefault(); b.focus(); }
  }
});

// =====================================================================
// VENTAS
// =====================================================================

const filtrosVentas = { estado: "", fecha: "", q: "" };

async function vistaVentas() {
  document.title = "Ventas | Mostrador";
  vista.innerHTML = `
    <div class="pagina">
      <div class="pagina-cabecera">
        <div><h1>Ventas</h1><p>Todas las ventas registradas por este TPV.</p></div>
      </div>
      <div class="filtros">
        <input type="search" id="f-q" placeholder="Buscar por número de venta" value="${esc(filtrosVentas.q)}" aria-label="Buscar por número de venta">
        <select id="f-estado" aria-label="Estado">
          <option value="">Todos los estados</option>
          <option value="COMPLETADA">Completadas</option>
          <option value="PENDIENTE">Pendientes</option>
          <option value="ERROR">Con error</option>
        </select>
        <input type="date" id="f-fecha" value="${esc(filtrosVentas.fecha)}" aria-label="Fecha">
      </div>
      <div id="tabla-ventas"><p class="tenue">Cargando…</p></div>
    </div>`;
  $("#f-estado").value = filtrosVentas.estado;

  let espera;
  const recargar = () => { clearTimeout(espera); espera = setTimeout(pintarTablaVentas, 200); };
  $("#f-q").addEventListener("input", (e) => { filtrosVentas.q = e.target.value; recargar(); });
  $("#f-estado").addEventListener("change", (e) => { filtrosVentas.estado = e.target.value; pintarTablaVentas(); });
  $("#f-fecha").addEventListener("change", (e) => { filtrosVentas.fecha = e.target.value; pintarTablaVentas(); });
  await pintarTablaVentas();
}

async function pintarTablaVentas() {
  const p = new URLSearchParams();
  if (filtrosVentas.estado) p.set("estado", filtrosVentas.estado);
  if (filtrosVentas.q.trim()) p.set("q", filtrosVentas.q.trim());
  if (filtrosVentas.fecha) {
    // La fecha elegida es local: se convierte al rango UTC equivalente.
    const desde = new Date(filtrosVentas.fecha + "T00:00:00");
    p.set("desde", desde.toISOString().slice(0, 10));
    const hasta = new Date(desde.getTime() + 86400000);
    p.set("hasta", hasta.toISOString().slice(0, 10));
  }
  p.set("terminal_id", "brisa");
  const r = await api("/tpv/ventas?" + p);
  const cont = $("#tabla-ventas");
  if (!cont) return;
  if (!r.ok) { cont.innerHTML = `<p class="mensaje-error">${esc(r.data?.error || "No se pudieron cargar las ventas")}</p>`; return; }

  let ventas = r.data;
  if (filtrosVentas.fecha) ventas = ventas.filter((v) => new Date(v.creada).toLocaleDateString("sv") === filtrosVentas.fecha);

  if (ventas.length === 0) {
    const hayFiltros = filtrosVentas.estado || filtrosVentas.fecha || filtrosVentas.q;
    cont.innerHTML = `<div class="vacio"><h3>${hayFiltros ? "No hay ventas con esos filtros" : "Todavía no hay ventas"}</h3>
      <p>${hayFiltros ? "Probá cambiando el estado o la fecha." : `Las ventas aparecen acá apenas se cobran. <a href="#/vender">Ir a vender</a>`}</p></div>`;
    return;
  }

  cont.innerHTML = `<div class="tabla-envoltura"><table>
    <thead><tr><th>Fecha y hora</th><th>Venta</th><th>Comercio</th><th>Medio</th><th class="derecha">Total</th><th>Estado</th></tr></thead>
    <tbody>${ventas.map((v) => `
      <tr class="clicable" data-id="${esc(v.id_venta)}" tabindex="0">
        <td class="num">${fechaHora(v.creada)}</td>
        <td class="codigo">${esc(v.id_venta)}</td>
        <td>${esc(v.razon_social)}</td>
        <td>${nombreMedio(v.medio_pago)}</td>
        <td class="derecha num">${pesos(v.total ?? v.subtotal)}</td>
        <td>${etiquetaEstado(v.estado)}</td>
      </tr>`).join("")}</tbody></table></div>`;

  const abrir = (tr) => { location.hash = `#/venta/${encodeURIComponent(tr.dataset.id)}`; };
  $$("tbody tr", cont).forEach((tr) => {
    tr.addEventListener("click", () => abrir(tr));
    tr.addEventListener("keydown", (e) => { if (e.key === "Enter") abrir(tr); });
  });
}

async function vistaDetalleVenta(id) {
  document.title = "Venta | Mostrador";
  const r = await api(`/tpv/ventas/${encodeURIComponent(id)}`);
  if (!r.ok) {
    vista.innerHTML = `<div class="pagina"><a class="volver" href="#/ventas">← Ventas</a>
      <div class="vacio"><h3>No encontramos esa venta</h3><p>${esc(r.data?.error || "")}</p></div></div>`;
    return;
  }
  const v = r.data;
  const completa = v.estado === "COMPLETADA";

  vista.innerHTML = `
    <div class="pagina">
      <a class="volver" href="#/ventas">← Ventas</a>
      <div class="pagina-cabecera">
        <div><h1>Venta <span class="codigo" style="font-size:1rem">${esc(v.id_venta)}</span></h1>
          <p>${esc(v.razon_social)}, ${fechaHora(v.creada)}</p></div>
        <div style="display:flex;gap:8px;align-items:center">
          ${etiquetaEstado(v.estado)}
          ${completa ? `<button type="button" class="boton boton-secundario" id="imprimir-detalle">Imprimir</button>`
                     : `<button type="button" class="boton boton-primario" id="reintentar-detalle">Reintentar</button>`}
        </div>
      </div>
      <div class="detalle">
        <div>
          <section class="panel">
            <h2>Productos</h2>
            <div class="tabla-envoltura"><table style="min-width:0">
              <thead><tr><th>Producto</th><th class="derecha">Cant.</th><th class="derecha">Precio</th><th class="derecha">Subtotal</th></tr></thead>
              <tbody>${v.lineas.map((l) => `<tr><td>${esc(l.nombre)}</td><td class="derecha num">${l.cantidad}</td>
                <td class="derecha num">${pesos(l.precio_unitario)}</td><td class="derecha num">${pesos(l.subtotal)}</td></tr>`).join("")}</tbody>
            </table></div>
            <div class="totales-detalle">
              <div class="fila-total"><span>Subtotal</span><span class="num">${pesos(v.subtotal)}</span></div>
              <div class="fila-total"><span>Percepción IIBB</span><span class="num">${v.percepcion == null ? "Sin calcular" : pesos(v.percepcion)}</span></div>
              <div class="fila-total grande"><span>Total</span><span class="num">${v.total == null ? "—" : pesos(v.total)}</span></div>
            </div>
          </section>
          <section class="panel">
            <h2>Datos</h2>
            <dl class="datos">
              <div><dt>Comercio</dt><dd>${esc(v.razon_social)}<br><span class="codigo">CUIT ${esc(v.comercio_cuit)}</span></dd></div>
              <div><dt>Medio de pago</dt><dd>${nombreMedio(v.pago.medio)}</dd></div>
              <div><dt>${v.pago.medio === "banco" ? "Cuenta de origen" : "CUIT de quien pagó"}</dt><dd class="codigo">${esc(v.pago.cuenta_origen || v.pago.cuit_pagador)}</dd></div>
              <div><dt>Comprobante</dt><dd>${v.comprobante ? `${esc((v.comprobante.tipo_comprobante || "").replace("_", " "))} ${esc(v.comprobante.numero_comprobante || "")}` : "Sin emitir"}</dd></div>
              <div><dt>CAE</dt><dd class="cae">${esc(v.comprobante?.cae || "—")}</dd></div>
              <div><dt>Intentos</dt><dd>${v.intentos}</dd></div>
            </dl>
          </section>
        </div>
        <section class="panel">
          <h2>Recorrido</h2>
          ${etapasHtml(v)}
          ${completa ? "" : `<div class="aviso-pendiente ${v.estado === "ERROR" ? "error" : ""}">
            <strong>${v.estado === "ERROR" ? "Un servicio rechazó la operación" : "Un servicio no respondió"}</strong>
            Al reintentar se continúa desde la etapa marcada. Lo que ya se confirmó no se repite.</div>`}
        </section>
      </div>
    </div>`;

  $("#imprimir-detalle")?.addEventListener("click", () => window.print());
  $("#reintentar-detalle")?.addEventListener("click", async (e) => {
    e.currentTarget.disabled = true;
    e.currentTarget.textContent = "Reintentando…";
    const res = await enviarVenta(cuerpoReintento(v));
    if (res.venta?.estado === "COMPLETADA") avisar("Venta completada");
    else if (res.error) avisar(res.error);
    else avisar("Sigue pendiente: revisá el recorrido");
    vistaDetalleVenta(id);
  });
}

// =====================================================================
// PRODUCTOS
// =====================================================================

let busquedaProductos = "";

async function vistaProductos() {
  document.title = "Productos | Mostrador";
  const comercio = comercioActual();
  if (!comercio) { location.hash = "#/comercios"; return; }
  await cargarProductos();

  vista.innerHTML = `
    <div class="pagina">
      <div class="pagina-cabecera">
        <div><h1>Productos</h1><p>Catálogo de ${esc(comercio.razon_social)}. Los precios de acá son los que cobra el TPV.</p></div>
        <button type="button" class="boton boton-primario" id="nuevo-producto">Nuevo producto</button>
      </div>
      <div class="filtros">
        <input type="search" id="buscar-producto" placeholder="Buscar por nombre o categoría" value="${esc(busquedaProductos)}" aria-label="Buscar producto">
      </div>
      <div id="tabla-productos"></div>
    </div>`;

  $("#nuevo-producto").addEventListener("click", () => abrirProducto(null));
  $("#buscar-producto").addEventListener("input", (e) => { busquedaProductos = e.target.value; pintarTablaProductos(); });
  pintarTablaProductos();
}

function pintarTablaProductos() {
  const cont = $("#tabla-productos");
  if (!cont) return;
  const q = busquedaProductos.trim().toLowerCase();
  const lista = estado.productos.filter((p) => !q || p.nombre.toLowerCase().includes(q) || p.categoria.toLowerCase().includes(q));

  if (lista.length === 0) {
    cont.innerHTML = `<div class="vacio"><h3>${q ? "No hay productos con ese nombre" : "Todavía no hay productos"}</h3>
      <p>${q ? "Revisá cómo está escrito." : "Tocá “Nuevo producto” para cargar el primero."}</p></div>`;
    return;
  }

  cont.innerHTML = `<div class="tabla-envoltura"><table>
    <thead><tr><th>Producto</th><th>Categoría</th><th class="derecha">Precio</th><th class="derecha">Stock</th><th>Estado</th><th><span class="sr-only">Acciones</span></th></tr></thead>
    <tbody>${lista.map((p) => `
      <tr class="${p.activo ? "" : "inactivo"}">
        <td><strong>${esc(p.nombre)}</strong><br><span class="codigo">${esc(p.id)}</span></td>
        <td>${esc(p.categoria)}</td>
        <td class="derecha num">${pesos(p.precio)}</td>
        <td class="derecha num" ${p.stock <= 5 ? 'style="color:var(--pendiente);font-weight:600"' : ""}>${p.stock}</td>
        <td>${p.activo ? '<span class="etiqueta completada">Disponible</span>' : '<span class="etiqueta neutra">Pausado</span>'}</td>
        <td class="derecha"><button type="button" class="boton boton-texto" data-editar="${esc(p.id)}">Editar</button></td>
      </tr>`).join("")}</tbody></table></div>`;

  cont.onclick = (e) => {
    const b = e.target.closest("[data-editar]");
    if (b) abrirProducto(estado.productos.find((p) => p.id === b.dataset.editar));
  };
}

const dialogoProducto = $("#dialogo-producto");
let productoEditado = null;

function abrirProducto(p) {
  productoEditado = p;
  const f = $("#form-producto");
  f.reset();
  $("#producto-error").hidden = true;
  $("#producto-titulo").textContent = p ? "Editar producto" : "Nuevo producto";
  $("#categorias").innerHTML = [...new Set(estado.productos.map((x) => x.categoria))].map((c) => `<option value="${esc(c)}">`).join("");
  f.nombre.value = p?.nombre || "";
  f.categoria.value = p?.categoria || "";
  f.precio.value = p ? String(p.precio).replace(".", ",") : "";
  f.stock.value = p?.stock ?? "";
  f.activo.checked = p ? p.activo : true;
  dialogoProducto.showModal();
  f.nombre.focus();
}

$("#form-producto").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const error = $("#producto-error");
  const precio = parsearPrecio(f.precio.value);
  const stock = Number(f.stock.value);
  const mostrar = (t, campo) => { error.textContent = t; error.hidden = false; campo?.focus(); };

  if (!f.nombre.value.trim()) return mostrar("Escribí el nombre del producto.", f.nombre);
  if (!f.categoria.value.trim()) return mostrar("Elegí o escribí una categoría.", f.categoria);
  if (!(precio > 0)) return mostrar("El precio tiene que ser mayor a 0.", f.precio);
  if (f.stock.value === "" || !Number.isInteger(stock) || stock < 0) return mostrar("El stock tiene que ser un número entero, 0 o más.", f.stock);

  const cuerpo = { terminal_id: "brisa", nombre: f.nombre.value.trim(), categoria: f.categoria.value.trim(), precio, stock, activo: f.activo.checked };
  const r = productoEditado
    ? await api(`/tpv/productos/${encodeURIComponent(productoEditado.id)}`, { method: "PUT", body: cuerpo })
    : await api("/tpv/productos", { method: "POST", body: { ...cuerpo, comercio_cuit: estado.comercioCuit } });

  if (!r.ok) return mostrar(r.data?.error || "No se pudo guardar el producto.");
  dialogoProducto.close();
  avisar(productoEditado ? "Producto guardado" : "Producto creado");
  await cargarProductos();
  pintarTablaProductos();
});

// =====================================================================
// COMERCIOS
// =====================================================================

async function vistaComercios() {
  document.title = "Comercios | Mostrador";
  await cargarComercios();
  vista.innerHTML = `
    <div class="pagina">
      <div class="pagina-cabecera">
        <div><h1>Comercios</h1><p>Cada comercio tiene su rubro, su catálogo y la cuenta donde cobra.</p></div>
        <button type="button" class="boton boton-primario" id="nuevo-comercio">Nuevo comercio</button>
      </div>
      <div id="tabla-comercios"></div>
    </div>`;
  $("#nuevo-comercio").addEventListener("click", () => abrirComercio(null));
  pintarTablaComercios();
}

function pintarTablaComercios() {
  const cont = $("#tabla-comercios");
  if (!estado.comercios.length) {
    cont.innerHTML = `<div class="vacio"><h3>Todavía no hay comercios</h3><p>Tocá “Nuevo comercio” para cargar el primero.</p></div>`;
    return;
  }
  cont.innerHTML = `<div class="tabla-envoltura"><table>
    <thead><tr><th>Comercio</th><th>CUIT</th><th>Rubro</th><th>Cuenta de cobro</th><th>Estado</th><th><span class="sr-only">Acciones</span></th></tr></thead>
    <tbody>${estado.comercios.map((c) => `
      <tr class="${c.activo ? "" : "inactivo"}">
        <td><strong>${esc(c.razon_social)}</strong></td>
        <td class="codigo">${esc(c.cuit)}</td>
        <td><span class="rubro">${esc(c.rubro)}</span></td>
        <td class="codigo">${esc(c.cuenta_destino || "Sin cuenta")}</td>
        <td>${c.activo ? '<span class="etiqueta completada">Activo</span>' : '<span class="etiqueta neutra">De baja</span>'}</td>
        <td class="derecha"><button type="button" class="boton boton-texto" data-editar="${esc(c.cuit)}">Editar</button></td>
      </tr>`).join("")}</tbody></table></div>`;
  cont.onclick = (e) => {
    const b = e.target.closest("[data-editar]");
    if (b) abrirComercio(estado.comercios.find((c) => c.cuit === b.dataset.editar));
  };
}

const dialogoComercio = $("#dialogo-comercio");
let comercioEditado = null;

function abrirComercio(c) {
  comercioEditado = c;
  const f = $("#form-comercio");
  f.reset();
  $("#comercio-error").hidden = true;
  $("#comercio-titulo").textContent = c ? "Editar comercio" : "Nuevo comercio";
  f.cuit.value = c?.cuit || "";
  f.cuit.disabled = !!c;
  f.razon_social.value = c?.razon_social || "";
  f.rubro.value = c?.rubro || "";
  f.cuenta_destino.value = c?.cuenta_destino || "";
  let interruptor = $("#c-activo-campo");
  if (c && !interruptor) {
    f.querySelector(".dialogo-cuerpo").insertAdjacentHTML("beforeend",
      `<label class="interruptor" id="c-activo-campo"><input type="checkbox" name="activo"><span>Comercio activo</span></label>`);
    interruptor = $("#c-activo-campo");
  }
  if (interruptor) { interruptor.hidden = !c; f.activo.checked = c ? c.activo : true; }
  // El mensaje de error queda siempre al final.
  f.querySelector(".dialogo-cuerpo").appendChild($("#comercio-error"));
  dialogoComercio.showModal();
  (c ? f.razon_social : f.cuit).focus();
}

$("#form-comercio").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const error = $("#comercio-error");
  const mostrar = (t, campo) => { error.textContent = t; error.hidden = false; campo?.focus(); };
  const cuit = f.cuit.value.replace(/\D/g, "");

  if (!comercioEditado && cuit.length !== 11) return mostrar("El CUIT tiene que tener 11 números, sin guiones.", f.cuit);
  if (!f.razon_social.value.trim()) return mostrar("Escribí el nombre del comercio.", f.razon_social);
  if (!f.rubro.value.trim()) return mostrar("Elegí o escribí un rubro.", f.rubro);

  const cuerpo = {
    razon_social: f.razon_social.value.trim(),
    rubro: f.rubro.value.trim(),
    cuenta_destino: f.cuenta_destino.value.trim(),
  };
  if (comercioEditado && f.activo) cuerpo.activo = f.activo.checked;

  const r = comercioEditado
    ? await api(`/tpv/comercios/${encodeURIComponent(comercioEditado.cuit)}`, { method: "PUT", body: cuerpo })
    : await api("/tpv/comercios", { method: "POST", body: { ...cuerpo, cuit } });

  if (!r.ok) return mostrar(r.data?.error || "No se pudo guardar el comercio.");
  dialogoComercio.close();
  avisar(comercioEditado ? "Comercio guardado" : "Comercio creado");
  if (!comercioEditado && !estado.comercioCuit) estado.comercioCuit = cuit;
  await cargarComercios();
  await cargarProductos();
  pintarTablaComercios();
});

// =====================================================================
// INICIO
// =====================================================================

let aplicacionIniciada = false;
async function iniciarAplicacion() {
  if (aplicacionIniciada || !window.__DEMO_AUTH_OK__) return;
  aplicacionIniciada = true;
  await cargarComercios();
  await cargarProductos();
  enrutar();
  revisarConexiones();
  setInterval(revisarConexiones, 30000);
}
window.addEventListener('demo-authenticated', iniciarAplicacion);
iniciarAplicacion();
