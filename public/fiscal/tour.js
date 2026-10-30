// Guía paso a paso de la configuración fiscal.
window.addEventListener('load', () => SintegraTour.init({ app: 'fiscal', steps: [
  { title: 'Impuestos de cada venta', text: 'Acá cada organismo configura sus impuestos. El TPV los aplica solo en cada venta.' },
  { element: '#tabs', title: 'Una pestaña por organismo', text: 'ARBA (percepciones), ARCA (IVA de cada producto) y Municipio (tasa del mes).' },
  { element: '#f-sim', title: 'Probá una venta', text: 'Elegí el comercio, el cliente y el precio. Sin CUIT del cliente es consumidor final.' },
  { element: '#sim-resultado', title: 'Resultado', text: 'Ves el tipo de factura, el IVA, la percepción y el total que paga el cliente.' },
  { element: '#f-param', title: 'Parámetros de ARBA', text: 'Alícuota para quien no está en el padrón y monto mínimo para percibir.' },
  { element: '#agentes', title: 'Agentes de percepción', text: 'Solo los comercios designados perciben. Podés darlos de alta o de baja.' },
  { element: '#padron tr', title: 'Padrón de alícuotas', text: 'La alícuota se aplica al comprador. Cambiala y tocá Guardar.' },
  { element: '#productos tr', title: 'IVA por producto', text: 'Elegí 21 %, 10,5 %, 27 %, 0 % o exento. Se guarda al cambiarlo.' },
  { element: '#alicuotas', title: 'Tasa municipal por rubro', text: 'Porcentaje sobre lo vendido en el mes y un mínimo.' },
  { element: '#f-liq', title: 'Liquidar el mes', text: 'Calcula la tasa del período con las ventas facturadas. Queda para pagar en Municipio.' },
]}));
