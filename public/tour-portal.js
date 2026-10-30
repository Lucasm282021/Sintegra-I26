// Guía de la página de inicio del portal.
window.addEventListener('load', () => SintegraTour.init({ app: 'portal', steps: [
  { title: 'Sintegra I26', text: 'Un comercio, una identidad y varios sistemas conectados: ARCA, ARBA, Municipio, Banco y TPV.' },
  { element: '.card-core', title: '1. Empezá por acá', text: 'Comercios: dalo de alta una sola vez y seguí el estado de cada trámite.' },
  { element: 'a[href="./fiscal/"]', title: '2. Impuestos', text: 'Configurá IVA, percepciones y tasas, y simulá cuánto paga el cliente.' },
  { element: '.card-banco', title: '3. Banco', text: 'Abrí cuentas, depositá, transferí y mirá los movimientos.' },
  { element: '.card-tpv', title: '4. Vender', text: 'Los TPV cobran, perciben y facturan contra todos los sistemas.' },
  { element: '.card-arba', title: 'Organismos', text: 'ARBA, ARCA y Municipio tienen su propia app para sus trámites.' },
]}));
