/**
 * Frontend ARCA - Facturación Electrónica Simulada
 * Conexión nativa con backend HTTP sin dependencias externas.
 */

// Si el frontend corre en el mismo puerto que el backend (3004), usamos rutas relativas.
// Para Live Server u otro servidor local, el backend permite CORS solo desde localhost.
const API_BASE_URL = (window.location.port === '3004' || window.location.port === '') ? '' : `http://${window.location.hostname || 'localhost'}:3004`;
let currentUser = null;
let userAdminInitialized = false;
let resettingUserId = null;

document.addEventListener('DOMContentLoaded', () => {
  initIntro();
  initAuth();
  initTabs();
  initHealthCheck();
  initContribuyenteModule();
  initEmisionModule();
  initConsultaModule();
});

function initIntro() {
  const screen = document.getElementById('introScreen');
  const video = document.getElementById('introVideo');
  const skipButton = document.getElementById('skipIntroButton');
  let finished = false;

  const finish = () => {
    if (finished) return;
    finished = true;
    video.pause();
    screen.classList.add('is-leaving');
    window.setTimeout(() => {
      screen.hidden = true;
      screen.setAttribute('aria-hidden', 'true');
    }, 700);
  };

  skipButton.addEventListener('click', finish);
  video.addEventListener('ended', finish, { once: true });
  video.addEventListener('error', finish, { once: true });

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    finish();
    return;
  }

  video.play().catch(finish);
}

function initAuth() {
  document.getElementById('loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    await submitAuth('/auth/login', {
      email: document.getElementById('loginEmail').value.trim(),
      password: document.getElementById('loginPassword').value
    });
  });
  document.getElementById('setupForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const setupToken = document.getElementById('setupToken').value;
    await submitAuth('/auth/setup', {
      email: document.getElementById('setupEmail').value.trim(),
      password: document.getElementById('setupPassword').value,
      ...(setupToken ? { setup_token: setupToken } : {})
    });
  });
  document.getElementById('logoutButton').addEventListener('click', async () => {
    try { await fetch(`${API_BASE_URL}/auth/logout`, { method: 'POST', credentials: 'include' }); } catch { /* La sesión local expira igualmente. */ }
    currentUser = null;
    document.getElementById('appShell').hidden = true;
    await showAuthGate(true);
  });
  document.getElementById('changePasswordButton').addEventListener('click', () => openPasswordDialog(currentUser.id, currentUser.email, true));
  bootstrapAuth();
}

async function bootstrapAuth() {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/me`, { credentials: 'include', headers: { 'Accept': 'application/json' } });
    const data = await parseJsonResponse(response);
    if (response.ok) return enterApp(data.usuario);
  } catch { /* Se consulta el estado inicial para mostrar el formulario apropiado. */ }
  await showAuthGate(true);
}

async function showAuthGate(loadStatus) {
  document.getElementById('authGate').hidden = false;
  document.getElementById('appShell').hidden = true;
  const message = document.getElementById('authMessage');
  if (!loadStatus) return;
  try {
    const response = await fetch(`${API_BASE_URL}/auth/status`, { headers: { 'Accept': 'application/json' } });
    const data = await parseJsonResponse(response);
    if (!response.ok) throw new Error(data?.error || `Error HTTP ${response.status}`);
    document.getElementById('setupPanel').hidden = !data.setup_required;
    document.getElementById('loginPanel').hidden = data.setup_required;
    message.textContent = data.setup_required ? '' : 'Ingresá con tu cuenta de ARCA.';
    message.className = 'result-area';
  } catch (error) {
    document.getElementById('setupPanel').hidden = true;
    document.getElementById('loginPanel').hidden = false;
    renderError(message, `No se pudo conectar con el backend: ${error.message}. Iniciá el servicio en el puerto 3004.`);
  }
}

async function submitAuth(path, payload) {
  const result = document.getElementById('authMessage');
  result.textContent = 'Verificando acceso…';
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await parseJsonResponse(response);
    if (!response.ok) throw new Error(data?.error || `Error HTTP ${response.status}`);
    document.getElementById('loginPassword').value = '';
    document.getElementById('setupPassword').value = '';
    enterApp(data.usuario);
  } catch (error) {
    renderError(result, error.message);
  }
}

function enterApp(user) {
  currentUser = user;
  document.getElementById('authGate').hidden = true;
  document.getElementById('appShell').hidden = false;
  document.getElementById('accountName').textContent = user.email;
  const roleLabels = { superadmin: 'Superadmin', admin: 'Admin', usuario: 'Usuario' };
  document.getElementById('accountRole').textContent = roleLabels[user.rol] || user.rol;
  const canManageUsers = user.rol === 'superadmin' || user.rol === 'admin';
  document.querySelectorAll('.admin-only').forEach((element) => { element.hidden = !canManageUsers; });
  document.getElementById('newRoleGroup').hidden = user.rol !== 'superadmin';
  const usersTab = document.getElementById('tab-usuarios');
  usersTab.hidden = !canManageUsers;
  if (canManageUsers) initUserAdmin();
}

function initUserAdmin() {
  if (userAdminInitialized) { loadUsers(); return; }
  userAdminInitialized = true;
  document.getElementById('cancelPasswordReset').addEventListener('click', () => document.getElementById('passwordDialog').close());
  document.getElementById('resetPasswordForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = document.getElementById('resetPasswordValue').value;
    try {
      const changingOwn = resettingUserId === currentUser.id;
      const payload = changingOwn
        ? { current_password: document.getElementById('currentPasswordValue').value, password }
        : { password };
      const endpoint = changingOwn ? '/auth/password' : `/admin/users/${encodeURIComponent(resettingUserId)}/password`;
      const { response, data } = await apiJson(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error(data?.error || `Error HTTP ${response.status}`);
      document.getElementById('passwordDialog').close();
      event.currentTarget.reset();
      document.getElementById('currentPasswordGroup').hidden = true;
      if (changingOwn) {
        const notice = document.getElementById('globalNotice');
        notice.textContent = 'Tu contraseña de ARCA se actualizó.';
        notice.hidden = false;
      }
      else renderSuccess(document.getElementById('userAdminResult'), `Contraseña restablecida para ${data.usuario.email}. La cuenta debe iniciar sesión nuevamente.`);
    } catch (error) { renderError(document.getElementById(resettingUserId === currentUser.id ? 'authMessage' : 'userAdminResult'), error.message); }
  });
  document.getElementById('createUserForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = {
      email: document.getElementById('newUserEmail').value.trim(),
      password: document.getElementById('newUserPassword').value
    };
    if (currentUser.rol === 'superadmin') payload.rol = document.getElementById('newUserRole').value;
    try {
      const { response, data } = await apiJson('/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error(data?.error || `Error HTTP ${response.status}`);
      form.reset();
      renderSuccess(document.getElementById('userAdminResult'), `Cuenta ${data.usuario.email} creada con rol ${data.usuario.rol}.`);
      await loadUsers();
    } catch (error) { renderError(document.getElementById('userAdminResult'), error.message); }
  });
  loadUsers();
}

async function loadUsers() {
  const table = document.getElementById('usersTable');
  try {
    const { response, data } = await apiJson('/admin/users');
    if (!response.ok) throw new Error(data?.error || `Error HTTP ${response.status}`);
    const roleOptions = ['usuario', 'admin', 'superadmin'];
    const rows = data.usuarios.map((user) => {
      const safeId = escapeHtml(user.id);
      const roleCell = currentUser.rol === 'superadmin'
        ? `<select class="user-role" data-id="${safeId}" aria-label="Rol de ${escapeHtml(user.email)}">${roleOptions.map((role) => `<option value="${role}" ${user.rol === role ? 'selected' : ''}>${role}</option>`).join('')}</select>`
        : `<span class="role-badge">${escapeHtml(user.rol)}</span>`;
      const canToggle = user.id !== currentUser.id && (currentUser.rol === 'superadmin' || user.rol === 'usuario');
      const button = canToggle ? `<button class="btn-sm toggle-user" data-id="${safeId}" data-active="${user.activo}" type="button">${user.activo ? 'Desactivar' : 'Activar'}</button>` : '';
      const canReset = user.id !== currentUser.id && (currentUser.rol === 'superadmin' || user.rol === 'usuario');
      const resetButton = canReset ? `<button class="btn-sm reset-user-password" data-id="${safeId}" data-email="${escapeHtml(user.email)}" type="button">Restablecer clave</button>` : '';
      const roleSave = currentUser.rol === 'superadmin' ? `<button class="btn-sm save-role" data-id="${safeId}" type="button">Guardar rol</button>` : '';
      return `<tr><td>${escapeHtml(user.email)}</td><td>${roleCell}</td><td>${user.activo ? 'Activa' : 'Inactiva'}</td><td><div class="user-actions">${roleSave}${button}${resetButton}</div></td></tr>`;
    }).join('');
    table.innerHTML = `<table class="users-table"><thead><tr><th>Correo</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${rows || '<tr><td colspan="4">No hay cuentas todavía.</td></tr>'}</tbody></table>`;
    table.querySelectorAll('.toggle-user').forEach((button) => button.addEventListener('click', () => updateUser(button.dataset.id, { activo: button.dataset.active !== 'true' })));
    table.querySelectorAll('.save-role').forEach((button) => button.addEventListener('click', () => {
      const select = table.querySelector(`.user-role[data-id="${CSS.escape(button.dataset.id)}"]`);
      updateUser(button.dataset.id, { rol: select.value });
    }));
    table.querySelectorAll('.reset-user-password').forEach((button) => button.addEventListener('click', () => {
      openPasswordDialog(button.dataset.id, button.dataset.email, false);
    }));
  } catch (error) { table.textContent = error.message; }
}

function openPasswordDialog(id, email, ownAccount) {
  resettingUserId = id;
  document.getElementById('resetPasswordTarget').textContent = `${ownAccount ? 'Actualizar tu contraseña' : 'Nueva clave para'} ${ownAccount ? '' : email}`;
  document.getElementById('currentPasswordGroup').hidden = !ownAccount;
  document.getElementById('resetPasswordForm').reset();
  document.getElementById('passwordDialog').showModal();
  document.getElementById(ownAccount ? 'currentPasswordValue' : 'resetPasswordValue').focus();
}

async function updateUser(id, changes) {
  try {
    const { response, data } = await apiJson(`/admin/users/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(changes) });
    if (!response.ok) throw new Error(data?.error || `Error HTTP ${response.status}`);
    if (data.usuario.id === currentUser.id) {
      enterApp(data.usuario);
      if (!['superadmin', 'admin'].includes(data.usuario.rol)) document.querySelector('.tab-btn[data-tab="tab-contribuyente"]').click();
    }
    renderSuccess(document.getElementById('userAdminResult'), `Cambios guardados para ${data.usuario.email}.`);
    await loadUsers();
  } catch (error) { renderError(document.getElementById('userAdminResult'), error.message); }
}

async function apiJson(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, credentials: 'include', headers: { 'Accept': 'application/json', ...(options.headers || {}) } });
  if (response.status === 401 && currentUser) {
    currentUser = null;
    await showAuthGate(true);
  }
  return { response, data: await parseJsonResponse(response) };
}

function renderSuccess(container, message) {
  container.className = 'result-area';
  container.textContent = message;
}

/* ==========================================================================
   Gestión de Pestañas (Tabs)
   ========================================================================== */
function initTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  const contents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      contents.forEach(c => c.classList.remove('active'));

      tab.classList.add('active');
      const target = document.getElementById(tab.dataset.tab);
      if (target) target.classList.add('active');
    });
  });
}

/* ==========================================================================
   1. Estado del Servicio (Health Check)
   ========================================================================== */
function initHealthCheck() {
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const btnCheck = document.getElementById('btnCheckHealth');

  async function checkHealth() {
    statusDot.className = 'status-indicator';
    statusText.textContent = 'Consultando estado...';

    try {
      const response = await fetch(`${API_BASE_URL}/health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        statusDot.className = 'status-indicator online';
        statusText.textContent = 'Conectado al backend';
      } else {
        throw new Error(`El servidor respondió con código HTTP ${response.status}`);
      }
    } catch (err) {
      statusDot.className = 'status-indicator offline';
      statusText.textContent = 'Desconectado. Iniciá el backend en http://localhost:3004.';
    }
  }

  btnCheck.addEventListener('click', checkHealth);
  checkHealth();
}

/* ==========================================================================
   2. Consultar Contribuyente
   ========================================================================== */
function initContribuyenteModule() {
  const form = document.getElementById('formContribuyente');
  const cuitInput = document.getElementById('cuitContribuyente');
  const resultArea = document.getElementById('resultadoContribuyente');
  const submitBtn = document.getElementById('btnConsultarContribuyente');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const cuit = cuitInput.value.trim();

    if (!/^\d{11}$/.test(cuit)) {
      renderError(resultArea, 'El CUIT debe tener exactamente 11 dígitos numéricos, sin puntos ni guiones.');
      return;
    }

    setLoading(submitBtn, true);
    renderLoading(resultArea, 'Consultando padrón de contribuyentes...');

    try {
      const response = await fetch(`${API_BASE_URL}/arca/contribuyentes/${encodeURIComponent(cuit)}`, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });

      const data = await parseJsonResponse(response);

      if (response.status === 401) { currentUser = null; await showAuthGate(true); return; }

      if (!response.ok) {
        const errorMsg = data?.error || `Error HTTP ${response.status}: ${response.statusText}`;
        renderError(resultArea, errorMsg);
        return;
      }

      // Renderizar datos del contribuyente
      renderContribuyenteResult(resultArea, data);
    } catch (err) {
      renderError(resultArea, `No se pudo conectar con el servidor: ${err.message}. Verifique que el servicio esté corriendo en el puerto 3004.`);
    } finally {
      setLoading(submitBtn, false);
    }
  });
}

function renderContribuyenteResult(container, data) {
  const cuit = escapeHtml(data.cuit || '-');
  const condicion = escapeHtml(data.condicion_fiscal || data.condicion || 'No informada');
  const nombre = data.nombre_o_razon_social ? escapeHtml(data.nombre_o_razon_social) : null;

  container.innerHTML = `
    <div class="feedback-banner feedback-success">
      ✓ Contribuyente encontrado en el padrón de prueba.
    </div>
    <div class="data-table-container">
      <table class="data-table">
        <tbody>
          <tr>
            <th>CUIT</th>
            <td><code>${cuit}</code></td>
          </tr>
          ${nombre ? `<tr><th>Razón Social</th><td>${nombre}</td></tr>` : ''}
          <tr>
            <th>Condición Fiscal</th>
            <td><strong>${condicion}</strong></td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

/* ==========================================================================
   3. Emitir Comprobante (con Idempotencia y Generador de ID)
   ========================================================================== */
function initEmisionModule() {
  const form = document.getElementById('formEmision');
  const idVentaInput = document.getElementById('idVenta');
  const cuitInput = document.getElementById('cuitEmision');
  const montoInput = document.getElementById('montoTotal');
  const tipoSelect = document.getElementById('tipoComprobante');
  const btnGenerarId = document.getElementById('btnGenerarIdVenta');
  const resultArea = document.getElementById('resultadoEmision');
  const submitBtn = document.getElementById('btnEmitirComprobante');

  // Precargar un ID de venta inicial para facilitar la primera prueba
  idVentaInput.value = generarIdVenta();

  // Botón separado para generar un nuevo id_venta voluntariamente
  btnGenerarId.addEventListener('click', () => {
    idVentaInput.value = generarIdVenta();
    idVentaInput.focus();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const idVenta = idVentaInput.value.trim();
    const cuit = cuitInput.value.trim();
    const montoRaw = montoInput.value.trim();
    const monto = Number(montoRaw);
    const tipo = tipoSelect.value;

    if (!idVenta) {
      renderError(resultArea, 'El campo id_venta es obligatorio.');
      return;
    }

    if (!/^\d{11}$/.test(cuit)) {
      renderError(resultArea, 'El CUIT debe tener exactamente 11 dígitos numéricos.');
      return;
    }

    if (!/^\d+(?:\.\d{1,2})?$/.test(montoRaw) || !Number.isFinite(monto) || monto <= 0) {
      renderError(resultArea, 'El monto total debe ser positivo y tener hasta dos decimales.');
      return;
    }

    const payload = {
      id_venta: idVenta,
      cuit: cuit,
      monto_total: Number(monto.toFixed(2)),
      tipo_comprobante: tipo
    };

    setLoading(submitBtn, true);
    renderLoading(resultArea, 'Enviando comprobante a emisión...');

    try {
      const response = await fetch(`${API_BASE_URL}/arca/comprobantes`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await parseJsonResponse(response);

      if (response.status === 401) { currentUser = null; await showAuthGate(true); return; }

      if (!response.ok) {
        const errorMsg = data?.error || `Error HTTP ${response.status}: ${response.statusText}`;
        renderError(resultArea, errorMsg);
        return;
      }

      // 201: Nueva emisión creada.
      // 200: Respuesta idempotente (ya existía para este id_venta).
      const esIdempotente = (response.status === 200);
      renderComprobanteResult(resultArea, data, esIdempotente);

      // IMPORTANTE: idVentaInput.value NO se modifica aquí para permitir probar idempotencia de inmediato.
    } catch (err) {
      renderError(resultArea, `No se pudo conectar con el servidor: ${err.message}.`);
    } finally {
      setLoading(submitBtn, false);
    }
  });
}

function renderComprobanteResult(container, data, esIdempotente, esConsulta = false) {
  const bannerClass = esIdempotente ? 'feedback-idempotent' : 'feedback-success';
  const bannerMsg = esConsulta
    ? '<strong>HTTP 200 OK — Comprobante encontrado:</strong> Datos recuperados del backend.'
    : esIdempotente
      ? '<strong>HTTP 200 OK — Idempotencia verificada:</strong> Este comprobante ya había sido emitido con este <code>id_venta</code>. Se devuelve el registro existente sin duplicar la operación.'
      : '<strong>HTTP 201 Created — Comprobante emitido con éxito:</strong> Se generó un nuevo registro en el sistema simulado.';

  const numero = escapeHtml(data.numero || data.numero_comprobante || '-');
  const puntoVenta = escapeHtml(data.punto_venta || '00001');
  const cuit = escapeHtml(data.cuit || '-');
  const tipo = escapeHtml(data.tipo_comprobante || '-');
  const monto = data.monto_total !== undefined ? Number(data.monto_total).toFixed(2) : '-';
  const cae = escapeHtml(data.cae || '-');
  const fecha = escapeHtml(data.fecha || data.fecha_emision || '-');
  const estado = escapeHtml(data.estado || '-');
  const idVenta = escapeHtml(data.id_venta || '-');

  container.innerHTML = `
    <div class="feedback-banner ${bannerClass}">
      ${bannerMsg}
    </div>
    <div class="data-table-container">
      <table class="data-table">
        <tbody>
          <tr>
            <th>ID de Venta (Idempotencia)</th>
            <td><code>${idVenta}</code></td>
          </tr>
          <tr>
            <th>Comprobante</th>
            <td><strong>${tipo}</strong> N° ${numero} (Punto de Venta: ${puntoVenta})</td>
          </tr>
          <tr>
            <th>CUIT Receptor</th>
            <td><code>${cuit}</code></td>
          </tr>
          <tr>
            <th>Monto Total</th>
            <td>$ ${monto}</td>
          </tr>
          <tr>
            <th>CAE Simulado</th>
            <td>
              <code>${cae}</code>
              <span class="badge-ficticio">CAE Ficticio — Sin validez fiscal</span>
            </td>
          </tr>
          <tr>
            <th>Fecha de Emisión</th>
            <td>${fecha}</td>
          </tr>
          <tr>
            <th>Estado</th>
            <td><strong>${estado}</strong></td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

/* ==========================================================================
   4. Consultar Comprobante Emitido (con manejo de 409)
   ========================================================================== */
function initConsultaModule() {
  const form = document.getElementById('formConsulta');
  const numInput = document.getElementById('numeroComprobante');
  const tipoSelect = document.getElementById('filtroTipo');
  const pvInput = document.getElementById('filtroPuntoVenta');
  const resultArea = document.getElementById('resultadoConsulta');
  const submitBtn = document.getElementById('btnBuscarComprobante');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const numero = numInput.value.trim();
    if (!/^\d{8}$/.test(numero)) {
      renderError(resultArea, 'El número de comprobante debe tener exactamente 8 dígitos.');
      return;
    }

    const params = new URLSearchParams();
    if (tipoSelect.value) params.append('tipo', tipoSelect.value);
    if (pvInput.value) params.append('pv', pvInput.value.trim());

    const queryString = params.toString() ? `?${params.toString()}` : '';

    setLoading(submitBtn, true);
    renderLoading(resultArea, 'Consultando comprobante...');

    try {
      const response = await fetch(`${API_BASE_URL}/arca/comprobantes/${encodeURIComponent(numero)}${queryString}`, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });

      const data = await parseJsonResponse(response);

      if (response.status === 401) { currentUser = null; await showAuthGate(true); return; }

      if (response.status === 409) {
        // Manejo específico del caso de número ambiguo
        const errorMsg = data?.error || 'Número de comprobante ambiguo. Se encontraron múltiples comprobantes con el mismo número.';
        renderError(resultArea, `HTTP 409 Conflicto: ${errorMsg}. Seleccioná el tipo de comprobante y el punto de venta para desambiguar la búsqueda.`);
        return;
      }

      if (!response.ok) {
        const errorMsg = data?.error || `Error HTTP ${response.status}: ${response.statusText}`;
        renderError(resultArea, errorMsg);
        return;
      }

      renderComprobanteResult(resultArea, data, false, true);
    } catch (err) {
      renderError(resultArea, `No se pudo conectar con el servidor: ${err.message}.`);
    } finally {
      setLoading(submitBtn, false);
    }
  });
}

/* ==========================================================================
   Utilidades auxiliares
   ========================================================================== */
async function parseJsonResponse(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function renderLoading(container, text) {
  container.innerHTML = `
    <div class="feedback-banner feedback-loading">
      ⏳ ${escapeHtml(text)}
    </div>
  `;
}

function renderError(container, message) {
  container.innerHTML = `
    <div class="feedback-banner feedback-error">
      ❌ <span class="error-message"></span>
    </div>
  `;
  container.querySelector('.error-message').textContent = message;
}

function generarIdVenta() {
  const randomId = globalThis.crypto?.randomUUID?.();
  return `venta-${randomId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;
}

function setLoading(button, isLoading) {
  if (isLoading) {
    button.disabled = true;
    button.dataset.originalText = button.innerHTML;
    button.innerHTML = '<span>Procesando...</span>';
  } else {
    button.disabled = false;
    if (button.dataset.originalText) {
      button.innerHTML = button.dataset.originalText;
    }
  }
}

function escapeHtml(str) {
  if (typeof str !== 'string') return String(str);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
