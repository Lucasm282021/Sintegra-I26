import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  CreditCard,
  Building2,
  Search,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  Receipt,
  FileText,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  Printer
} from 'lucide-react';

const configuredApiBase =
  window.__TPV_CONFIG__?.apiBaseUrl ||
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? 'http://localhost:3001' : 'https://sintegra-backend.vercel.app');
const API_BASE = configuredApiBase
  ? `${configuredApiBase.replace(/\/+$/, '')}/tpv`
  : null;

function apiUrl(path) {
  if (!API_BASE) {
    throw new Error('La URL de la API no está configurada (API_BASE_URL).');
  }
  return `${API_BASE}${path}`;
}

function TpvApp() {
  const [cuit, setCuit] = useState('27401260264');
  const [comercios, setComercios] = useState([]);
  const [productos, setProductos] = useState([]);
  const [categoriaSel, setCategoriaSel] = useState('Todos');
  const [busqueda, setBusqueda] = useState('');
  const [carrito, setCarrito] = useState([]);
  const [medioPago, setMedioPago] = useState('BANCO');
  const [cuentaOrigen, setCuentaOrigen] = useState('cuenta-mostrador');
  const [cuitPagador, setCuitPagador] = useState('30000000001');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [ventaCompletada, setVentaCompletada] = useState(null);
  const [historialVentas, setHistorialVentas] = useState([]);
  const [verHistorial, setVerHistorial] = useState(false);
  const [backendConectado, setBackendConectado] = useState(false);
  const [pendingSale, setPendingSale] = useState(null);

  // Un terminal puede operar solo con comercios que Banco vinculó a una cuenta.
  const cargarComercios = async () => {
    try {
      const res = await fetch(apiUrl('/comercios?terminal_id=sebastian'));
      if (!res.ok) throw new Error('No se pudieron consultar los comercios del terminal');
      const data = (await res.json()).filter((item) => item.activo);
      setComercios(data);
      const preferido = localStorage.getItem('tpv-sebastian-comercio');
      const selected = data.find((item) => item.cuit === preferido) || data[0];
      if (!selected) { setCuit(''); setProductos([]); return; }
      setCuit(selected.cuit);
      await cargarProductos(selected.cuit);
    } catch (err) {
      setBackendConectado(false);
      setErrorMsg(err.message || 'No se pudo conectar con Banco M');
    }
  };

  // Cargar catálogo del comercio asociado a la terminal.
  const cargarProductos = async (cuitComercio = cuit) => {
    if (!cuitComercio) { setProductos([]); return; }
    try {
      const res = await fetch(apiUrl('/productos?terminal_id=sebastian&cuit=' + encodeURIComponent(cuitComercio.trim())));
      if (res.ok) {
        const data = await res.json();
        setProductos(data);
        setBackendConectado(true);
      } else {
        throw new Error('Error al conectar con la API de TPV');
      }
    } catch (err) {
      console.warn('No se pudo cargar el catálogo del backend:', err);
      setBackendConectado(false);
      setProductos(import.meta.env.DEV ? [
        { id: 1, nombre: 'Café Molido 500g', descripcion: 'Café de tueste natural', precio: 4500, stock: 50, categoria: 'Almacén' },
        { id: 2, nombre: 'Leche Entera 1L', descripcion: 'Leche fresca fortificada', precio: 1200, stock: 100, categoria: 'Lácteos' },
        { id: 3, nombre: 'Pan Lactal Integración 500g', descripcion: 'Pan tajado de mesa', precio: 2300, stock: 40, categoria: 'Panadería' },
        { id: 4, nombre: 'Agua Mineral 1.5L', descripcion: 'Agua sin gas', precio: 950, stock: 80, categoria: 'Bebidas' },
        { id: 5, nombre: 'Queso Crema 290g', descripcion: 'Queso untable familiar', precio: 3100, stock: 35, categoria: 'Lácteos' },
        { id: 6, nombre: 'Galletitas Dobladas 200g', descripcion: 'Galletitas dulces surtidas', precio: 1500, stock: 60, categoria: 'Almacén' }
      ] : []);
    }
  };

  const cargarHistorial = async () => {
    try {
      const res = await fetch(apiUrl('/ventas?terminal_id=sebastian'));
      if (res.ok) {
        const data = await res.json();
        setHistorialVentas(data);
      }
    } catch (err) {
      console.warn('Error al cargar historial:', err);
    }
  };

  useEffect(() => {
    cargarComercios();
  }, []);

  const comercioActual = comercios.find((item) => item.cuit === cuit) || null;

  // Agregar item al carrito
  const agregarAlCarrito = (prod) => {
    setCarrito((prev) => {
      const existe = prev.find((item) => item.productoId === prod.id);
      if (existe) {
        return prev.map((item) =>
          item.productoId === prod.id
            ? { ...item, cantidad: item.cantidad + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          productoId: prod.id,
          nombre: prod.nombre,
          precioUnitario: prod.precio,
          cantidad: 1,
        },
      ];
    });
  };

  // Modificar cantidad
  const cambiarCantidad = (productoId, delta) => {
    setCarrito((prev) =>
      prev
        .map((item) => {
          if (item.productoId === productoId) {
            const nuevaCant = item.cantidad + delta;
            return nuevaCant > 0 ? { ...item, cantidad: nuevaCant } : null;
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  // Totales
  const subtotal = carrito.reduce(
    (acc, item) => acc + item.precioUnitario * item.cantidad,
    0
  );
  // La percepción la decide ARBA al cobrar (agente, padrón del comprador y mínimo):
  // no se estima con una alícuota fija. Ver doc/IMPUESTOS-Y-PERCEPCIONES.md.
  const totalEstimado = subtotal;

  // Procesar venta en POST /tpv/ventas
  const procesarCobro = async () => {
    if (carrito.length === 0) return;
    setLoading(true);
    setErrorMsg(null);

    const payload = pendingSale || {
      id_venta: `vta-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      terminal_id: 'sebastian',
      comercio_cuit: cuit.trim(),
      cuenta_destino: comercioActual?.cuenta_destino,
      items: carrito.map((item) => ({
        producto_id: String(item.productoId),
        cantidad: item.cantidad,
      })),
      medio_pago: medioPago.toLowerCase(),
      ...(medioPago === 'BANCO'
        ? { cuenta_origen: cuentaOrigen }
        : medioPago === 'EFECTIVO'
          ? (/^\d{11}$/.test(cuitPagador.trim()) ? { cuit_cliente: cuitPagador.trim() } : {})
          : { cuit_pagador: cuitPagador }),
    };
    if (!pendingSale) setPendingSale(payload);

    try {
      const res = await fetch(apiUrl('/ventas'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Fallo al procesar la venta');
      }

      const detailRes = await fetch(apiUrl('/ventas/' + encodeURIComponent(data.id_venta || payload.id_venta)));
      const detalle = detailRes.ok ? await detailRes.json() : data;
      setVentaCompletada(detalle);
      setCarrito([]);
      setPendingSale(null);
      cargarProductos(); // Refrescar stock
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const categorias = ['Todos', 'Almacén', 'Lácteos', 'Panadería', 'Bebidas'];

  const productosFiltrados = productos.filter((p) => {
    const coincideCat = categoriaSel === 'Todos' || p.categoria === categoriaSel;
    const coincideBusq = p.nombre.toLowerCase().includes(busqueda.toLowerCase());
    return coincideCat && coincideBusq;
  });

  return (
    <div className="app-container">
      {/* HEADER BAR */}
      <header className="tpv-header">
        <div className="brand">
          <div className="brand-icon">TPV</div>
          <div className="brand-text">
            <h1>Terminal Punto de Venta</h1>
            <span>Banco · ARBA · ARCA · base compartida</span>
          </div>
        </div>

        <div className="header-status">
          <div className="cuit-selector">
            <Building2 size={16} className="text-cyan-400" />
            <label htmlFor="merchant-select">Comercio asociado:</label>
            <select
              id="merchant-select"
              value={cuit}
              disabled={Boolean(pendingSale) || !comercios.length}
              onChange={async (e) => {
                const next = e.target.value;
                setCuit(next);
                localStorage.setItem('tpv-sebastian-comercio', next);
                setCarrito([]);
                setErrorMsg(null);
                await cargarProductos(next);
              }}
            >
              {comercios.length ? comercios.map((item) => <option key={item.cuit} value={item.cuit}>{item.razon_social} · {item.cuit}</option>) : <option value="">Sin comercio vinculado</option>}
            </select>
            {comercioActual && <small className="merchant-bank-link">Banco M · {comercioActual.cuenta_alias || 'Cuenta asociada'} · CBU {comercioActual.cuenta_cbu || 'pendiente'}</small>}
          </div>

          <div
            className="badge-status"
            style={{
              borderColor: backendConectado ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)',
              color: backendConectado ? '#10b981' : '#f59e0b',
            }}
          >
            <div className="dot" />
            {backendConectado ? 'API común conectada' : 'API sin conexión'}
          </div>

          <button
            onClick={() => {
              cargarHistorial();
              setVerHistorial(true);
            }}
            className="pill-btn"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Receipt size={14} /> Historial Ventas
          </button>
        </div>
      </header>

      {/* MAIN GRID */}
      <div className="main-layout">
        {/* CATÁLOGO DE PRODUCTOS */}
        <div className="catalog-section">
          <div className="catalog-bar">
            <div className="search-box">
              <Search size={18} color="#9ca3af" />
              <input
                type="text"
                placeholder="Buscar producto por nombre..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>

            <div className="categories-pills">
              {categorias.map((cat) => (
                <button
                  key={cat}
                  className={`pill-btn ${categoriaSel === cat ? 'active' : ''}`}
                  onClick={() => setCategoriaSel(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* GRID PRODUCTOS */}
          <div className="product-grid">
            {productosFiltrados.map((prod) => (
              <div
                key={prod.id}
                className="glass-card product-card"
                onClick={() => {
                  if (!pendingSale) agregarAlCarrito(prod);
                }}
              >
                <div>
                  <div className="product-category">{prod.categoria || 'General'}</div>
                  <div className="product-name">{prod.nombre}</div>
                  <div className="product-stock">Stock disponible: {prod.stock} u.</div>
                </div>
                <div className="product-footer">
                  <div className="product-price">
                    ${prod.precio.toLocaleString('es-AR')}
                  </div>
                  <button
                    className="btn-add"
                onClick={(e) => {
                      e.stopPropagation();
                      agregarAlCarrito(prod);
                    }}
                disabled={Boolean(pendingSale)}
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* PANEL DE CARRITO / VENTA */}
        <div className="glass-panel cart-panel">
          <div className="cart-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShoppingBag size={20} color="#38bdf8" />
              <h2>Venta Actual</h2>
            </div>
            <span style={{ fontSize: 13, color: '#9ca3af' }}>
              {carrito.reduce((a, b) => a + b.cantidad, 0)} ítems
            </span>
          </div>

          {/* LISTA CARRITO */}
          <div className="cart-items-list">
            {carrito.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  color: '#6b7280',
                  marginTop: 60,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <ShoppingBag size={48} opacity={0.3} />
                <p>El carrito está vacío.</p>
                <span style={{ fontSize: 12 }}>Haz clic en un producto para agregarlo.</span>
              </div>
            ) : (
              carrito.map((item) => (
                <div key={item.productoId} className="cart-item">
                  <div className="cart-item-info">
                    <h4>{item.nombre}</h4>
                    <span>
                      ${item.precioUnitario.toLocaleString('es-AR')} x {item.cantidad} = ${' '}
                      {(item.precioUnitario * item.cantidad).toLocaleString('es-AR')}
                    </span>
                  </div>
                  <div className="cart-item-controls">
                    <button
                      className="qty-btn"
                      onClick={() => cambiarCantidad(item.productoId, -1)}
                      disabled={Boolean(pendingSale)}
                    >
                      <Minus size={14} />
                    </button>
                    <span className="qty-count">{item.cantidad}</span>
                    <button
                      className="qty-btn"
                      onClick={() => cambiarCantidad(item.productoId, 1)}
                      disabled={Boolean(pendingSale)}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* MENSAJE DE ERROR */}
          {errorMsg && (
            <div
              style={{
                background: 'rgba(244, 63, 94, 0.15)',
                border: '1px solid rgba(244, 63, 94, 0.3)',
                color: '#f43f5e',
                padding: '10px 14px',
                borderRadius: 8,
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 12,
              }}
            >
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* RESUMEN Y TOTALES */}
          <div className="cart-summary">
            <div className="summary-row">
              <span>Productos (IVA incluido)</span>
              <span>${subtotal.toLocaleString('es-AR')}</span>
            </div>
            <div className="summary-row">
              <span>Percepción IIBB</span>
              <span>se calcula al cobrar</span>
            </div>
            <div className="summary-row total">
              <span>TOTAL (sin percepción)</span>
              <span className="total-price">${totalEstimado.toLocaleString('es-AR')}</span>
            </div>

            {/* SELECTOR DE MEDIO DE PAGO */}
            <div style={{ marginTop: 8 }}>
              <label style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600 }}>
                MEDIO DE PAGO:
              </label>
              <div className="payment-methods">
                {['BANCO', 'BILLETERA', 'EFECTIVO'].map((pm) => (
                  <button
                    key={pm}
                    className={`pm-btn ${medioPago === pm ? 'active' : ''}`}
                    onClick={() => setMedioPago(pm)}
                    disabled={Boolean(pendingSale)}
                  >
                    <CreditCard size={16} />
                    {pm}
                  </button>
                ))}
              </div>

              {medioPago === 'BANCO' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, fontSize: 11 }}>
                  <input
                    type="text"
                    value={cuentaOrigen}
                    disabled={Boolean(pendingSale)}
                    onChange={(e) => setCuentaOrigen(e.target.value)}
                    placeholder="Alias o CBU de quien paga"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid #374151', padding: '6px 8px', borderRadius: 4, color: '#fff' }}
                  />
                  <small className="merchant-bank-link">El cobro se acredita en {comercioActual?.cuenta_alias || 'la cuenta bancaria vinculada'} · CBU {comercioActual?.cuenta_cbu || 'pendiente'}</small>
                </div>
              )}

              {medioPago === 'EFECTIVO' && (
                <div style={{ marginTop: 8, fontSize: 11 }}>
                  <input
                    type="text"
                    value={cuitPagador}
                    disabled={Boolean(pendingSale)}
                    onChange={(e) => setCuitPagador(e.target.value)}
                    placeholder="CUIT del cliente (opcional)"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid #374151', padding: '6px 8px', borderRadius: 4, color: '#fff', width: '100%' }}
                  />
                  <small className="merchant-bank-link">El efectivo queda en la caja del comercio. La factura y la percepción se registran igual.</small>
                </div>
              )}

              {medioPago === 'BILLETERA' && (
                <div style={{ marginTop: 8, fontSize: 11 }}>
                  <input
                    type="text"
                    value={cuitPagador}
                    disabled={Boolean(pendingSale)}
                    onChange={(e) => setCuitPagador(e.target.value)}
                    placeholder="CUIT Pagador Billetera"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid #374151', padding: '6px 8px', borderRadius: 4, color: '#fff', width: '100%' }}
                  />
                </div>
              )}
            </div>

            {/* BOTÓN PROCESAR COBRO */}
            <button
              className="btn-checkout"
              disabled={carrito.length === 0 || loading || !comercioActual?.cuenta_destino}
              onClick={procesarCobro}
            >
              {loading ? (
                <>
                  <RefreshCw className="animate-spin" size={18} />
                  Procesando cobro y comprobante...
                </>
              ) : (
                <>
                  {pendingSale ? 'Reintentar venta pendiente' : 'Procesar cobro y facturar'}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* MODAL IMPRESIÓN COMPROBANTE / FACTURA CON CAE */}
      {ventaCompletada && (
        <div className="modal-overlay" onClick={() => setVentaCompletada(null)}>
          <div className="receipt-card" onClick={(e) => e.stopPropagation()}>
            <div className="receipt-header">
              <div style={{ color: '#047857', marginBottom: 4 }}>
                <CheckCircle2 size={36} style={{ margin: '0 auto' }} />
              </div>
              <h3>COMPROBANTE ELECTRÓNICO</h3>
              <p style={{ fontSize: 12, color: '#6b7280' }}>ORIGINAL — FACTURA B</p>
              <div className="receipt-badge">
                ESTADO: {ventaCompletada.estado || 'COMPLETADA'}
              </div>
            </div>

            <div className="receipt-details">
              <div><strong>Comercio CUIT:</strong> {ventaCompletada.comercio_cuit}</div>
              <div><strong>Comprobante N°:</strong> {ventaCompletada.comprobante?.numero || 'Pendiente'}</div>
              <div><strong>Fecha:</strong> {new Date(ventaCompletada.createdAt || Date.now()).toLocaleString('es-AR')}</div>
              <div><strong>Medio Pago:</strong> {ventaCompletada.pago?.medio_pago}</div>
              {ventaCompletada.pago?.transaccion_id && <div><strong>Transacción:</strong> {ventaCompletada.pago.transaccion_id}</div>}
            </div>

            <table className="receipt-table">
              <thead>
                <tr>
                  <th>Cant x Producto</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {ventaCompletada.lineas?.map((it, idx) => (
                  <tr key={idx}>
                    <td>
                      {it.cantidad}x {it.descripcion || `Producto ${it.producto_id}`}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      ${it.subtotal?.toLocaleString('es-AR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="receipt-details" style={{ borderTop: '1px solid #e5e7eb', paddingTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Subtotal:</span>
                <span>${ventaCompletada.subtotal?.toLocaleString('es-AR')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Percepción IIBB (ARBA):</span>
                <span>${ventaCompletada.percepcion?.toLocaleString('es-AR')}</span>
              </div>
            </div>

            <div className="receipt-total">
              TOTAL: ${ventaCompletada.total?.toLocaleString('es-AR')}
            </div>

            <div className="cae-box">
              <div style={{ color: '#6b7280', fontSize: 11 }}>C.A.E. de ARCA:</div>
              <div className="cae-code">{ventaCompletada.comprobante?.cae || 'Pendiente'}</div>
            </div>

            <button className="btn-close-modal" onClick={() => setVentaCompletada(null)}>
              Cerrar Ticket
            </button>
          </div>
        </div>
      )}

      {/* MODAL HISTORIAL DE VENTAS */}
      {verHistorial && (
        <div className="modal-overlay" onClick={() => setVerHistorial(false)}>
          <div
            className="receipt-card"
            style={{ maxWidth: 650, maxHeight: '80vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="receipt-header">
              <h3>Historial de Ventas Registradas</h3>
              <p style={{ fontSize: 12, color: '#6b7280' }}>Consultado desde GET /tpv/ventas</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {historialVentas.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#6b7280', padding: 20 }}>
                  No se registran ventas previas.
                </p>
              ) : (
                historialVentas.map((v) => (
                  <div
                    key={v.id}
                    style={{
                      border: '1px solid #e5e7eb',
                      padding: 12,
                      borderRadius: 8,
                      fontSize: 13,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                      <span>Venta #{v.id_venta} — CUIT {v.comercio_cuit}</span>
                      <span style={{ color: '#047857' }}>${v.total?.toLocaleString('es-AR')}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                      Fecha: {new Date(v.createdAt).toLocaleString('es-AR')} | Medio: {v.medio_pago} | CAE: {v.comprobante?.cae || 'N/A'}
                    </div>
                  </div>
                ))
              )}
            </div>

            <button className="btn-close-modal" onClick={() => setVerHistorial(false)}>
              Volver a la Terminal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const DEMO_LOGIN = { email: 'demo.tpv.sebastian.i26@gmail.com', password: 'TpvSebas2026' };

function DemoLogin() {
  const [ok, setOk] = useState(() => sessionStorage.getItem('demo-auth-tpv-sebastian') === 'ok');
  const [error, setError] = useState('');
  function submit(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (String(data.get('email')).trim().toLowerCase() !== DEMO_LOGIN.email || data.get('password') !== DEMO_LOGIN.password) {
      setError('El correo o la contraseña no coinciden con el usuario demo.'); return;
    }
    sessionStorage.setItem('demo-auth-tpv-sebastian', 'ok'); setOk(true);
  }
  if (ok) return <TpvApp />;
  return <main className="demo-login-page"><style>{`.demo-login-page{min-height:100vh;display:grid;place-items:center;padding:24px;background:#f5f6fa;color:#14214f;font-family:system-ui,sans-serif}.demo-login-card{width:min(100%,516px);padding:44px 42px 36px;background:#fff;border:1px solid #e0e5ef;border-radius:16px;box-shadow:0 4px 16px #14214f12}.demo-login-shield{margin-bottom:28px}.demo-login-eyebrow{margin:0 0 12px;color:#89743a;font-size:14px;letter-spacing:.06em}.demo-login-card h1{margin:0;font-size:30px;letter-spacing:-.03em}.demo-login-subtitle{margin:12px 0 34px;color:#4b5470}.demo-login-card form{display:grid;gap:22px}.demo-login-card label{display:grid;gap:8px;font-size:14px;font-weight:600;text-transform:uppercase}.demo-login-card input{width:100%;height:54px;padding:0 15px;border:1px solid #c4cde0;border-radius:10px;background:#fff;color:#14214f;font:inherit;font-weight:400;text-transform:none}.demo-login-card input:focus{outline:3px solid #3f78b633;border-color:#3f78b6}.demo-login-card form button{height:54px;border:0;border-radius:10px;background:#14214f;color:#fff;font:600 16px system-ui;cursor:pointer}.demo-login-credentials{display:grid;gap:8px;margin-top:24px;padding:15px;border:1px dashed #af9b63;border-radius:10px;background:#faf8f1;font-size:14px}.demo-login-card footer{margin-top:26px;text-align:center;color:#596887;font-size:13px}.demo-login-error{color:#a72e2e}@media(max-width:540px){.demo-login-page{padding:16px}.demo-login-card{padding:32px 24px}.demo-login-card h1{font-size:26px}}`}</style>
    <section className="demo-login-card"><div className="demo-login-shield" aria-hidden="true">◇</div><p className="demo-login-eyebrow">BIENVENIDO · I26 TPV SEBASTIÁN</p><h1>Ingresá a tu cuenta</h1><p className="demo-login-subtitle">Accedé al punto de venta y a la gestión de tu comercio.</p>
      <form onSubmit={submit}><label>Correo electrónico<input name="email" type="email" autoComplete="username" placeholder="nombre@correo.com" required /></label><label>Contraseña<input name="password" type="password" autoComplete="current-password" placeholder="Ingresá tu contraseña" required /></label>{error && <p className="demo-login-error" role="alert">{error}</p>}<button type="submit">Iniciar sesión</button></form>
      <aside className="demo-login-credentials"><strong>Usuario de prueba (ayuda memoria)</strong><span>Correo: <b>{DEMO_LOGIN.email}</b></span><span>Contraseña: <b>{DEMO_LOGIN.password}</b></span></aside><footer>Entorno académico · Información de ejemplo</footer></section></main>;
}

export default function App() { return <DemoLogin />; }
