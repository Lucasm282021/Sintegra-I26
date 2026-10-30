// Guía paso a paso del homebanking.
window.addEventListener('load', () => SintegraTour.init({ app: 'homebanking', steps: [
  { element: '#f-login', title: 'Ingresá', text: 'Escribí tu CUIT y tu clave. En la simulación la clave es demo1234.' },
  { element: '#cuentas', title: 'Tus cuentas', text: 'Ves el saldo de tu caja de ahorro y, si tenés, de tu cuenta corriente.' },
  { element: '#btn-transferir', title: 'Transferir', text: 'Mandá plata a otra cuenta por alias o CBU.' },
  { element: '#btn-echeq', title: 'eCheq', text: 'Con cuenta corriente podés emitir un eCheq a un CUIT. Elegí la fecha de pago.' },
  { element: '#cheques', title: 'Cobrar eCheq', text: 'Los eCheq que te mandan aparecen acá. Tocá Cobrar y se acreditan en tu caja de ahorro.' },
  { element: '#movimientos', title: 'Movimientos', text: 'Ventas cobradas, transferencias, cheques y depósitos quedan registrados.' },
]}));
