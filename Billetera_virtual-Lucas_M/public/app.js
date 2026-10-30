const state = { account: null };
let qrCameraStream = null;
let qrScanFrame = 0;

const byId = (id) => document.getElementById(id);
function idVentaDeReintento(tipo) {
  const key = `billetera:id-venta:${tipo}`;
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = globalThis.crypto?.randomUUID?.() || `${tipo}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(key, id);
  }
  return { id, clear: () => sessionStorage.removeItem(key) };
}
const money = (value) => `$ ${Number(value || 0).toLocaleString('es-AR')}`;
const icon = (name) => {
  const paths = {
    payment: '<path d="M7 17 17 7M7 7h10v10"/>',
    charge: '<path d="M12 3v12m-5-5 5 5 5-5M5 20h14"/>',
    received: '<path d="M7 7 17 17M7 17h10V7"/>',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.received}</svg>`;
};

const introScreen = byId('intro-screen');
const introVideo = byId('intro-video');
const finishIntro = () => {
  if (!introScreen || introScreen.classList.contains('is-finished')) return;
  introScreen.classList.add('is-finished');
  window.setTimeout(() => introScreen.remove(), 750);
};

introVideo?.addEventListener('ended', finishIntro, { once: true });
introVideo?.addEventListener('error', finishIntro, { once: true });
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) finishIntro();
else introVideo?.play().catch(finishIntro);

function notify(message) {
  const toast = byId('toast');
  toast.textContent = message;
  toast.classList.add('visible');
  window.setTimeout(() => toast.classList.remove('visible'), 3200);
}

function closeModal(modal) {
  if (modal?.id === 'qr-modal') stopQrCamera();
  if (modal?.open) modal.close();
}

function renderAccount(account) {
  state.account = account;
  byId('welcome-name').textContent = (account.titular || 'Tu billetera').trim().split(/\s+/)[0];
  byId('balance').textContent = money(account.saldo);
  byId('account-label').textContent = 'Cuenta en pesos · ARS';
  byId('account-holder').textContent = `${account.titular} · ${account.alias}`;
  byId('account-alias').textContent = account.alias || 'Sin alias asignado';
  byId('detail-holder').textContent = account.titular || '—';
  byId('detail-cuit').textContent = account.cuit || '—';
  byId('detail-cbu').textContent = account.cbu || 'CBU pendiente de asignación por Banco M';
  byId('detail-bank').textContent = account.banco_cuenta_id ? `Vinculada · ${account.banco_cuenta_id}` : 'Sin cuenta bancaria vinculada';
  byId('detail-date').textContent = account.fecha_alta
    ? new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' }).format(new Date(account.fecha_alta))
    : '—';
  loadMovements(account.id);
}

function stopQrCamera() {
  if (qrScanFrame) cancelAnimationFrame(qrScanFrame);
  qrScanFrame = 0;
  qrCameraStream?.getTracks().forEach((track) => track.stop());
  qrCameraStream = null;
  byId('qr-camera').srcObject = null;
  byId('qr-camera').hidden = true;
}

function showWallet(account) {
  byId('auth-screen').hidden = true;
  byId('wallet-app').hidden = false;
  renderAccount(account);
}

function showLogin() {
  state.account = null;
  byId('wallet-app').hidden = true;
  byId('auth-screen').hidden = false;
  byId('login-form').hidden = false;
  byId('login-form').reset();
}

async function request(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'No se pudo completar la operación');
  return data;
}

async function loadMovements(id) {
  const list = byId('activity-list');
  try {
    const movements = await request(`/billetera/cuentas/${id}/movimientos`);
    if (!movements.length) {
      list.innerHTML = `<div class="empty-state"><span class="empty-icon">${icon('received')}</span><strong>Aún no hay movimientos</strong><p>Las cargas, pagos y cobros de tu cuenta aparecerán aquí.</p></div>`;
      return;
    }
    list.innerHTML = movements.map((movement) => {
      const isPayment = movement.tipo === 'pago';
      const isCharge = movement.tipo === 'carga';
      const title = isPayment ? 'Pago realizado' : isCharge ? 'Carga de saldo' : 'Cobro recibido';
      const movementIcon = icon(isPayment ? 'payment' : isCharge ? 'charge' : 'received');
      return `
        <div class="movement">
          <div class="movement-info">
            <span class="movement-icon ${isPayment ? 'payment' : ''} ${isCharge ? 'charge' : 'received'}">${movementIcon}</span>
            <span><strong>${title}</strong><small>${movement.contraparte || 'Sin detalle'}</small></span>
          </div>
          <span class="movement-amount">${isPayment ? '-' : '+'}${money(movement.monto)}</span>
        </div>`;
    }).join('');
  } catch (error) {
    list.innerHTML = `<div class="empty-state"><strong>${error.message}</strong></div>`;
  }
}

document.querySelectorAll('[data-open-modal]').forEach((button) => {
  button.addEventListener('click', () => {
    if (state.account && button.dataset.openModal === 'payment-modal') byId('payment-cuit').value = state.account.cuit;
    if (button.dataset.openModal === 'qr-modal') selectQrMode('pay');
    if (button.dataset.openModal === 'transfer-modal') { byId('transfer-form').reset(); byId('transfer-ficha').textContent = ''; }
    if (button.dataset.openModal === 'echeq-modal') loadEcheqs();
    byId(button.dataset.openModal).showModal();
  });
});
document.querySelectorAll('[data-close-modal]').forEach((button) => {
  button.addEventListener('click', () => closeModal(button.closest('dialog')));
});
byId('refresh-button').addEventListener('click', () => state.account && loadMovements(state.account.id));
const copyAlias = async () => {
  if (!state.account?.alias) return notify('Primero seleccioná una billetera');
  try {
    await navigator.clipboard.writeText(state.account.alias);
    notify(`Alias copiado: ${state.account.alias}`);
  } catch {
    notify(`Tu alias: ${state.account.alias}`);
  }
};
byId('copy-alias').addEventListener('click', copyAlias);
byId('copy-alias-detail').addEventListener('click', copyAlias);

function selectQrMode(mode) {
  stopQrCamera();
  if (mode === 'pay') {
    byId('qr-pay-form').hidden = true;
    byId('qr-recipient').hidden = true;
    byId('qr-code-input').value = '';
    byId('qr-pay-amount').readOnly = false;
  }
  document.querySelectorAll('[data-qr-mode]').forEach((button) => {
    const selected = button.dataset.qrMode === mode;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-selected', String(selected));
  });
  byId('qr-pay-panel').hidden = mode !== 'pay';
  byId('qr-charge-panel').hidden = mode !== 'charge';
}

async function readQrPayload(value) {
  byId('qr-pay-form').hidden = true;
  byId('qr-recipient').hidden = true;
  byId('qr-pay-amount').readOnly = false;
  const match = String(value || '').trim().match(/^SINTEGRA\|1\|(\d{11})(?:\|(\d{1,8}))?$/i);
  if (!match) return notify('El código no es un QR de cobro Sintegra válido');
  if (!state.account) return notify('Ingresá a tu billetera para poder pagar');
  if (match[1] === state.account.cuit) return notify('Ese QR pertenece a tu propia billetera');
  if (match[2] && Number(match[2]) < 1) return notify('El monto del QR no es válido');

  try {
    const recipient = await request(`/billetera/qr/${match[1]}`);
    byId('qr-recipient-cuil').value = recipient.cuit;
    byId('qr-pay-amount').value = match[2] || '';
    byId('qr-pay-amount').readOnly = Boolean(match[2]);
    byId('qr-recipient').textContent = `Vas a pagar a ${recipient.titular} · ${recipient.alias}`;
    byId('qr-recipient').hidden = false;
    byId('qr-pay-form').hidden = false;
  } catch (error) {
    byId('qr-recipient').hidden = true;
    byId('qr-pay-form').hidden = true;
    notify(error.message);
  }
}

document.querySelectorAll('[data-qr-mode]').forEach((button) => {
  button.addEventListener('click', () => selectQrMode(button.dataset.qrMode));
});
byId('qr-read-code').addEventListener('click', () => readQrPayload(byId('qr-code-input').value));
byId('qr-image-select').addEventListener('click', () => byId('qr-image-file').click());
byId('qr-image-file').addEventListener('change', async (event) => {
  const file = event.currentTarget.files?.[0];
  if (!file) return;
  try {
    const bitmap = await createImageBitmap(file);
    const maxSide = 1400;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    bitmap.close();
    const result = window.jsQR(pixels.data, pixels.width, pixels.height, { inversionAttempts: 'attemptBoth' });
    if (!result) return notify('No se encontró un código QR en la imagen');
    byId('qr-code-input').value = result.data;
    readQrPayload(result.data);
  } catch {
    notify('No se pudo leer la imagen. Pegá el código QR manualmente.');
  } finally {
    event.currentTarget.value = '';
  }
});

byId('qr-camera-start').addEventListener('click', async () => {
  try {
    qrCameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    const video = byId('qr-camera');
    video.srcObject = qrCameraStream;
    video.hidden = false;
    await video.play();
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    let lastScanAt = 0;
    const scan = async (timestamp = performance.now()) => {
      if (!qrCameraStream) return;
      if (timestamp - lastScanAt < 120) {
        qrScanFrame = requestAnimationFrame(scan);
        return;
      }
      lastScanAt = timestamp;
      try {
        const width = video.videoWidth;
        const height = video.videoHeight;
        if (width && height) {
          const scale = Math.min(1, 720 / width);
          canvas.width = Math.round(width * scale);
          canvas.height = Math.round(height * scale);
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
        }
        const pixels = canvas.width && canvas.height ? context.getImageData(0, 0, canvas.width, canvas.height) : null;
        const result = pixels && window.jsQR(pixels.data, pixels.width, pixels.height, { inversionAttempts: 'dontInvert' });
        if (result) {
          byId('qr-code-input').value = result.data;
          stopQrCamera();
          readQrPayload(result.data);
          return;
        }
      } catch { /* Espera el siguiente cuadro mientras enfoca el QR. */ }
      if (qrCameraStream) qrScanFrame = requestAnimationFrame(scan);
    };
    qrScanFrame = requestAnimationFrame(scan);
  } catch {
    stopQrCamera();
    notify('No se pudo abrir la cámara. Podés leer una imagen o pegar el código.');
  }
});

byId('qr-generate').addEventListener('click', () => {
  if (!state.account?.cuit) return notify('Primero ingresá a una billetera');
  const amountText = byId('qr-charge-amount').value.trim();
  const amount = amountText ? Number(amountText) : null;
  if (amountText && (!Number.isInteger(amount) || amount < 1 || amount > 99999999)) {
    return notify('Ingresá un monto entero entre 1 y 99.999.999');
  }
  const payload = `SINTEGRA|1|${state.account.cuit}${amount ? `|${amount}` : ''}`;
  try {
    byId('qr-art').innerHTML = window.createSintegraQr(payload);
    byId('qr-owner-name').textContent = state.account.titular;
    byId('qr-owner-alias').textContent = state.account.alias;
    byId('qr-charge-total').textContent = amount ? `Importe: ${money(amount)}` : 'Importe a ingresar por quien paga';
    byId('qr-copy-code').dataset.payload = payload;
    byId('qr-generated').hidden = false;
  } catch (error) {
    notify(error.message || 'No se pudo generar el QR');
  }
});

byId('qr-copy-code').addEventListener('click', async (event) => {
  const payload = event.currentTarget.dataset.payload;
  try {
    await navigator.clipboard.writeText(payload);
    notify('Código de cobro copiado');
  } catch {
    notify('No se pudo copiar el código; podés mostrar el QR en pantalla');
  }
});

byId('qr-pay-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!state.account) return notify('Ingresá a tu billetera para poder pagar');
  const body = {
    id_venta: idVentaDeReintento('qr-pago').id,
    cuit_origen: state.account.cuit,
    cuit_destino: byId('qr-recipient-cuil').value,
    monto: Number(byId('qr-pay-amount').value),
  };
  try {
    const result = await request('/billetera/qr/pagos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    closeModal(byId('qr-modal'));
    byId('qr-code-input').value = '';
    byId('qr-pay-form').reset();
    byId('qr-pay-amount').readOnly = false;
    byId('qr-pay-form').hidden = true;
    byId('qr-recipient').hidden = true;
    sessionStorage.removeItem('billetera:id-venta:qr-pago');
    renderAccount(result);
    notify('Pago QR realizado correctamente');
  } catch (error) { notify(error.message); }
});
byId('qr-modal').addEventListener('close', stopQrCamera);

byId('login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const body = Object.fromEntries(form);
  try {
    const result = await request('/billetera/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    showWallet(result.billetera);
    notify(`Hola, ${result.billetera.titular}`);
  } catch (error) { notify(error.message); }
});
document.querySelectorAll('[data-toggle-password]').forEach((button) => {
  button.addEventListener('click', () => {
    const input = byId(button.dataset.togglePassword);
    input.type = input.type === 'password' ? 'text' : 'password';
    button.textContent = input.type === 'password' ? 'Ver' : 'Ocultar';
  });
});
byId('logout-button').addEventListener('click', showLogin);

byId('payment-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const body = Object.fromEntries(form);
  body.monto = Number(body.monto);
  const idempotencia = idVentaDeReintento('pago');
  body.id_venta = idempotencia.id;
  try {
    const account = await request('/billetera/pagos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    closeModal(event.currentTarget.closest('dialog'));
    event.currentTarget.reset();
    renderAccount(account);
    idempotencia.clear();
    notify('Pago realizado correctamente');
  } catch (error) { notify(error.message); }
});

// ---------- Transferir por CUIT, alias o CBU ----------
const jsonPost = (url, body) => request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
byId('transfer-dest').addEventListener('input', async (event) => {
  const ref = event.target.value.trim();
  byId('transfer-ficha').textContent = '';
  if (/^\d{11}$/.test(ref)) {
    try { const r = await request(`/billetera/qr/${ref}`); byId('transfer-ficha').textContent = `Destinatario: ${r.titular} · ${r.alias}`; }
    catch { byId('transfer-ficha').textContent = 'Sin billetera: se acredita en su cuenta bancaria si la tiene.'; }
  }
});
byId('transfer-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!state.account) return notify('Ingresá a tu billetera');
  const idem = idVentaDeReintento('transferencia');
  try {
    const result = await jsonPost('/billetera/transferencias', { id_venta: idem.id, cuit_origen: state.account.cuit,
      destino: byId('transfer-dest').value.trim(), monto: Number(byId('transfer-amount').value) });
    idem.clear();
    closeModal(byId('transfer-modal'));
    renderAccount(result);
    notify('Transferencia realizada');
  } catch (error) { notify(error.message); }
});

// ---------- eCheq ----------
const ESTADO_ECHEQ = { emitido: 'Emitido', depositado: 'Depositado', acreditado: 'Acreditado', rechazado: 'Rechazado', anulado: 'Anulado' };
async function loadEcheqs() {
  if (!state.account) return;
  try {
    const e = await request(`/billetera/echeqs?cuit=${state.account.cuit}`);
    byId('echeq-estado').textContent = e.disponible
      ? `Disponible: tenés cuenta corriente (saldo ${money(e.cuenta_corriente.saldo)}).`
      : e.motivo;
    byId('echeq-form').hidden = !e.disponible;
    byId('echeq-date').value = new Date().toISOString().slice(0, 10);
    const fila = (q, recibido) => `<div class="echeq-item"><span><strong>N° ${q.numero} · ${money(q.monto)}</strong>
      <small>${recibido ? 'Recibido' : 'A ' + q.beneficiario} · ${ESTADO_ECHEQ[q.estado] || q.estado} · pago ${q.fecha_pago}</small></span>
      ${recibido && ['emitido', 'depositado'].includes(q.estado) ? `<button class="button button-small" data-cobrar="${q.numero}" type="button">Cobrar</button>` : ''}
      ${!recibido && q.estado === 'emitido' ? `<button class="text-button" data-anular="${q.numero}" type="button">Anular</button>` : ''}</div>`;
    byId('echeq-recibidos').innerHTML = e.recibidos.map((q) => fila(q, true)).join('') || '<p class="helper-text">No recibiste eCheq.</p>';
    byId('echeq-emitidos').innerHTML = e.emitidos.map((q) => fila(q, false)).join('') || '<p class="helper-text">No emitiste eCheq.</p>';
  } catch (error) { byId('echeq-estado').textContent = error.message; }
}
byId('echeq-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const q = await jsonPost('/billetera/echeqs', { cuit_origen: state.account.cuit, destino: byId('echeq-dest').value.trim(),
      monto: Number(byId('echeq-amount').value), fecha_pago: byId('echeq-date').value || undefined });
    event.currentTarget.reset();
    notify(`eCheq N° ${q.numero} emitido a ${q.beneficiario}`);
    loadEcheqs();
  } catch (error) { notify(error.message); }
});
byId('echeq-modal').addEventListener('click', async (event) => {
  const cobrar = event.target.closest('[data-cobrar]'); const anular = event.target.closest('[data-anular]');
  if (!cobrar && !anular) return;
  const numero = cobrar ? cobrar.dataset.cobrar : anular.dataset.anular;
  try {
    const r = await jsonPost(`/billetera/echeqs/${numero}/${cobrar ? 'cobrar' : 'anular'}`, { cuit: state.account.cuit });
    notify(r.aviso || (r.estado === 'rechazado' ? `eCheq rechazado: ${r.motivo_rechazo}` : cobrar ? 'eCheq acreditado en tu cuenta' : 'eCheq anulado'));
    loadEcheqs();
    const cuenta = await request(`/billetera/cuentas/${state.account.id}`).catch(() => null);
    if (cuenta) renderAccount(cuenta);
  } catch (error) { notify(error.message); }
});

const demoHandoff = sessionStorage.getItem('billeteraDemoAccount');
if (demoHandoff) {
  sessionStorage.removeItem('billeteraDemoAccount');
  try {
    showWallet(JSON.parse(demoHandoff));
  } catch {
    showLogin();
  }
}
