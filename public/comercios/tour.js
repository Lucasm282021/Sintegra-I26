// Guía paso a paso de Comercios (alta única). Se muestran solo los pasos de la pantalla abierta.
window.addEventListener('load', () => SintegraTour.init({ app: 'comercios', steps: [
  { element: '#f-login', title: 'Ingresá', text: 'Entrá con tu correo y contraseña. Si es la primera vez, usá "Crear usuario".' },
  { element: '.ayuda', title: 'Usuario de prueba', text: 'Para practicar, tocá "Completar con el usuario de prueba" y después Ingresar.' },
  { element: '#btn-nuevo', title: 'Dar de alta tu comercio', text: 'Un comercio se registra una sola vez. Después cada organismo informa su estado.' },
  { element: '#lista-comercios .item', title: 'Tus comercios', text: 'Tocá "Ver estado" para abrir el panel de un comercio.' },
  { element: '#v-mis details', title: '¿Ya existe?', text: 'Si el comercio ya está registrado, pedí acceso. Lo aprueba su titular.' },
  { element: '.pasos', title: 'Alta en 3 pasos', text: 'Comercio, sucursal y confirmación. Los datos se cargan una sola vez.' },
  { element: '#c-cuit', title: 'CUIT', text: 'Escribí los 11 números. Te avisamos al instante si el dígito verificador es correcto.' },
  { element: '#btn-siguiente', title: 'Seguir', text: 'Pasá al próximo paso. Al final confirmás y declarás que representás al comercio.' },
  { element: '#tarjetas .sis', title: 'Estado de cada sistema', text: 'Identidad, ARCA, ARBA, Municipio, Banco y TPV. Verde = listo; amarillo = pendiente; rojo = a revisar.' },
  { element: '[data-tramite]', title: 'Hacer los trámites', text: 'Los botones "Simular…" hacen el trámite en el organismo (inscripción en ARCA, IIBB, habilitación municipal).' },
  { element: '#b-vincular', title: 'Cuenta bancaria', text: 'Abre la cuenta del comercio en el Banco para poder cobrar.' },
  { element: '#b-tpv', title: 'Activar el TPV', text: 'Con ARCA verificado y la cuenta vinculada, elegí la caja y ya podés vender.' },
  { element: '#p-tabs', title: 'Más opciones', text: 'Sucursales, usuarios que pueden operar y el historial de cada verificación.' },
]}));
