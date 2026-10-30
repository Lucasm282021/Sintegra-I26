// Guía paso a paso de ARCA.
window.addEventListener('load', () => SintegraTour.init({ app: 'arca', steps: [
  { element: '#loginForm', title: 'Ingresá', text: 'Usá el usuario de prueba que figura debajo del formulario.' },
  { element: '.nav-tabs', title: 'Qué podés hacer', text: 'Consultar un contribuyente, emitir un comprobante y buscar comprobantes emitidos.' },
  { element: '#formContribuyente', title: '1. Consultar contribuyente', text: 'Escribí un CUIT de 11 números para ver su condición frente al IVA.' },
  { element: '[data-tab="tab-emision"]', title: '2. Emitir comprobante', text: 'Factura A, B o C con número correlativo y CAE de prueba. El ID de venta evita duplicados.' },
  { element: '[data-tab="tab-consulta"]', title: '3. Consultar comprobante', text: 'Buscá por número, tipo y punto de venta.' },
  { element: '#backendStatusCard', title: 'Conexión', text: 'Indica si el servicio responde. Si no, tocá Reintentar.' },
]}));
