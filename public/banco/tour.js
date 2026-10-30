// Guía paso a paso del Banco.
window.addEventListener('load', () => SintegraTour.init({ app: 'banco', steps: [
  { element: '#demo-login', title: 'Ingresá', text: 'Usá el usuario de prueba que figura abajo.' },
  { element: '.demo-credentials', title: 'Usuario de prueba', text: 'Copiá el correo y la contraseña de acá.' },
  { element: '#btn-abrir', title: '1. Abrir una cuenta', text: 'Escribí el CUIT del titular. Tiene que estar inscripto en ARCA. El banco asigna CBU y alias.' },
  { element: '#search', title: '2. Elegí una cuenta', text: 'Buscá por titular, CUIT o alias y tocá la cuenta en la lista para ver su detalle.' },
  { element: '.balance-card', title: 'Saldo, alias y CBU', text: 'Es el saldo real que usan el TPV, la Billetera y Municipio.' },
  { element: '#ops', title: '3. Operar', text: 'Depositar o extraer efectivo, o transferir a otra cuenta por alias o CBU.' },
  { element: '.movement-heading', title: 'Movimientos', text: 'Cada venta, cobro, depósito o transferencia queda registrada acá.' },
  { element: '#wallet-panel h2', title: 'Billetera virtual', text: 'El banco crea la billetera del cliente. Comparte el saldo de esta cuenta.' },
]}));
