const state = { account: null };

const byId = (id) => document.getElementById(id);
const money = (value) => `$ ${Number(value || 0).toLocaleString('es-AR')}`;

function notify(message) {
  const toast = byId('toast');
  toast.textContent = message;
  toast.classList.add('visible');
  window.setTimeout(() => toast.classList.remove('visible'), 3200);
}

function closeModal(modal) {
  if (modal?.open) modal.close();
}

function renderAccount(account) {
  state.account = account;
  byId('balance').textContent = money(account.saldo);
  byId('account-label').textContent = `Cuenta #${account.id}`;
  byId('account-holder').textContent = `${account.titular} · ${account.alias}`;
  byId('account-id').value = account.id;
  loadMovements(account.id);
}

async function request(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'No se pudo completar la operación');
  return data;
}

async function loadAccount() {
  const id = byId('account-id').value;
  if (!id) return notify('Ingresá el ID de una cuenta');
  try {
    renderAccount(await request(`/billetera/cuentas/${id}`));
    notify('Cuenta cargada');
  } catch (error) {
    notify(error.message);
  }
}

async function loadMovements(id) {
  const list = byId('activity-list');
  try {
    const movements = await request(`/billetera/cuentas/${id}/movimientos`);
    if (!movements.length) {
      list.innerHTML = '<div class="empty-state"><span class="empty-icon">↗</span><strong>Aún no hay movimientos</strong><p>Las cargas y pagos de tu cuenta aparecerán aquí.</p></div>';
      return;
    }
    list.innerHTML = movements.map((movement) => `
      <div class="movement">
        <div class="movement-info">
          <span class="movement-icon ${movement.tipo === 'pago' ? 'payment' : ''}">${movement.tipo === 'pago' ? '↗' : '↙'}</span>
          <span><strong>${movement.tipo === 'pago' ? 'Pago realizado' : 'Carga de saldo'}</strong><small>${movement.contraparte || 'Sin detalle'}</small></span>
        </div>
        <span class="movement-amount">${movement.tipo === 'pago' ? '-' : '+'}${money(movement.monto)}</span>
      </div>`).join('');
  } catch (error) {
    list.innerHTML = `<div class="empty-state"><strong>${error.message}</strong></div>`;
  }
}

document.querySelectorAll('[data-open-modal]').forEach((button) => {
  button.addEventListener('click', () => byId(button.dataset.openModal).showModal());
});
document.querySelectorAll('[data-close-modal]').forEach((button) => {
  button.addEventListener('click', () => closeModal(button.closest('dialog')));
});
byId('load-account').addEventListener('click', loadAccount);
byId('refresh-button').addEventListener('click', () => state.account && loadMovements(state.account.id));

byId('account-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    const account = await request('/billetera/cuentas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(form)) });
    closeModal(event.currentTarget.closest('dialog'));
    event.currentTarget.reset();
    renderAccount(account);
    notify(`Cuenta #${account.id} creada`);
  } catch (error) { notify(error.message); }
});

byId('deposit-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const body = Object.fromEntries(form);
  body.monto = Number(body.monto);
  try {
    const account = await request('/billetera/cargas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    closeModal(event.currentTarget.closest('dialog'));
    event.currentTarget.reset();
    renderAccount(account);
    notify('Saldo cargado correctamente');
  } catch (error) { notify(error.message); }
});

byId('payment-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const body = Object.fromEntries(form);
  body.monto = Number(body.monto);
  if (!body.comercio_cuit) delete body.comercio_cuit;
  try {
    const account = await request('/billetera/pagos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    closeModal(event.currentTarget.closest('dialog'));
    event.currentTarget.reset();
    renderAccount(account);
    notify('Pago realizado correctamente');
  } catch (error) { notify(error.message); }
});