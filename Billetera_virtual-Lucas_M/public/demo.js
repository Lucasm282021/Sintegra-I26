const list = document.getElementById('client-list');
const form = document.getElementById('demo-login-form');
const cuilInput = document.getElementById('demo-cuil');
const passwordInput = document.getElementById('demo-password');
const errorMessage = document.getElementById('demo-error');
const money = (amount) => `$ ${Number(amount || 0).toLocaleString('es-AR')}`;

async function request(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'No se pudo completar el acceso');
  return data;
}

function chooseProfile(client, card) {
  document.querySelectorAll('.client-card').forEach((item) => item.classList.remove('selected'));
  card.classList.add('selected');
  cuilInput.value = client.cuil;
  passwordInput.value = 'demo1234';
  errorMessage.hidden = true;
  passwordInput.focus();
}

function renderClient(client) {
  const card = document.createElement('article');
  card.className = 'client-card';

  const details = document.createElement('div');
  const name = document.createElement('p');
  name.className = 'client-name';
  name.textContent = client.titular;
  const profile = document.createElement('p');
  profile.className = 'client-profile';
  profile.textContent = client.perfil;
  const cuil = document.createElement('p');
  cuil.className = 'client-cuil';
  cuil.textContent = `CUIL ${client.cuil}`;
  const balance = document.createElement('strong');
  balance.className = 'client-balance';
  balance.textContent = money(client.saldo_inicial);

  details.append(name, profile, cuil, balance);
  const button = document.createElement('button');
  button.className = 'choose-client';
  button.type = 'button';
  button.textContent = 'Usar perfil';
  button.addEventListener('click', () => chooseProfile(client, card));
  card.append(details, button);
  return card;
}

async function loadClients() {
  try {
    const clients = await request('/billetera/demo/clientes');
    list.replaceChildren(...clients.map(renderClient));
  } catch (error) {
    const message = document.createElement('p');
    message.className = 'demo-error';
    message.textContent = error.message;
    list.replaceChildren(message);
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorMessage.hidden = true;
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  submit.textContent = 'Ingresando…';

  try {
    const result = await request('/billetera/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cuil: cuilInput.value, contrasena: passwordInput.value }),
    });
    sessionStorage.setItem('billeteraDemoAccount', JSON.stringify(result.billetera));
    window.location.assign('/');
  } catch (error) {
    errorMessage.textContent = error.message;
    errorMessage.hidden = false;
    submit.disabled = false;
    submit.innerHTML = 'Abrir billetera <span aria-hidden="true">→</span>';
  }
});

loadClients();
