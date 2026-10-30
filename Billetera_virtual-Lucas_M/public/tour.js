// Guía paso a paso de la Billetera.
window.addEventListener('load', () => SintegraTour.init({ app: 'billetera', steps: [
  { element: '#login-form', title: 'Ingresá', text: 'Con tu CUIL y contraseña. El usuario de prueba está debajo del botón.' },
  { element: '#balance', title: '1. Tu saldo', text: 'Es el mismo saldo de tu cuenta del Banco: la billetera no guarda dinero aparte.' },
  { element: '#operaciones', title: '2. Operar', text: 'Pagar a un comercio, copiar tu alias para que te transfieran o usar el QR.' },
  { element: '.quick-action-qr', title: '3. Pagar o cobrar con QR', text: 'Escaneá el QR de un comercio para pagar, o generá el tuyo para cobrar.' },
  { element: '#movimientos', title: 'Actividad', text: 'Tus pagos, cobros y cargas, con fecha y contraparte.' },
  { element: '.bottom-nav', title: 'Menú', text: 'Inicio, actividad, QR y los datos de tu cuenta (alias y CBU).' },
]}));
