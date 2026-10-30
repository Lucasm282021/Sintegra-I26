// Guía paso a paso del TPV Brisa.
window.addEventListener('load', () => SintegraTour.init({ app: 'tpv-brisa', steps: [
  { element: '#demo-login', title: 'Ingresá', text: 'Usá el usuario de prueba que aparece en la pantalla.' },
  { element: '#comercio', title: '1. Elegí el comercio', text: 'Las ventas se cobran en la cuenta bancaria de este comercio.' },
  { element: '.navegacion', title: 'Secciones', text: 'Vender, ver las ventas, cargar productos y administrar comercios.' },
  { element: '#buscar', title: '2. Buscá productos', text: 'Escribí el nombre o filtrá por categoría. Tocá un producto para sumarlo al ticket.' },
  { element: '#ticket', title: '3. El ticket', text: 'Revisá cantidades y el subtotal. La percepción de IIBB se calcula al cobrar.' },
  { element: '#cobrar', title: '4. Cobrar', text: 'Elegí el medio de pago. Si el cliente da su CUIT, se aplica la percepción y la factura que corresponde.' },
  { element: '#conexiones', title: 'Conexiones', text: 'Muestra si Banco, ARBA y ARCA están respondiendo.' },
  { element: 'a[data-ruta="compras"]', title: 'Compras', text: 'Proveedores, facturas de compra y cuenta corriente. La compra suma stock y actualiza el costo.' },
]}));
