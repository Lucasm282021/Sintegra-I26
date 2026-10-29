-- Datos de prueba del ecosistema. Todos los CUIT, cuentas y montos son
-- ficticios: no cargar información fiscal ni bancaria real.

insert into padron.contribuyentes (cuit, razon_social, tipo_persona, condicion_iva, domicilio_fiscal) values
  ('30712345678', 'Almacén Don Mateo SRL',   'juridica', 'responsable_inscripto', 'Av. Rivadavia 2140, Morón'),
  ('30987654321', 'Kiosco La Esquina SA',    'juridica', 'responsable_inscripto', 'Belgrano 455, Haedo'),
  ('20345678901', 'Juan Pérez',              'fisica',   'monotributo',           'Sarmiento 120, Morón'),
  ('27123456789', 'María Gómez',             'fisica',   'consumidor_final',      'Mitre 980, Castelar'),
  ('23987654321', 'Taller El Rayo',          'fisica',   'monotributo',           'Rivadavia 15000, Ituzaingó');

insert into municipio.habilitaciones (cuit, rubro, domicilio, fecha_alta) values
  ('30712345678', 'Almacén / autoservicio', 'Av. Rivadavia 2140', '2026-03-01'),
  ('30987654321', 'Kiosco',                 'Belgrano 455',       '2026-05-15'),
  ('20345678901', 'Venta ambulante',        'Sarmiento 120',      '2026-07-01');

insert into municipio.tasas (id_tributo, cuit, periodo, monto, estado, pagada_en) values
  ('30712345678-2026-08', '30712345678', '2026-08', 12500.00, 'pagada',    '2026-08-10T13:00:00Z'),
  ('30712345678-2026-09', '30712345678', '2026-09', 12500.00, 'pendiente', null),
  ('30987654321-2026-09', '30987654321', '2026-09',  8400.00, 'pendiente', null);

insert into arba.inscripciones (cuit, actividad, alicuota) values
  ('30712345678', 'Comercio minorista',       0.03),
  ('30987654321', 'Comercio minorista',       0.03),
  ('20345678901', 'Servicios profesionales',  0.02),
  ('23987654321', 'Reparaciones',             0.025);

insert into arca.puntos_venta (emisor_cuit, punto_venta, tipo_comprobante) values
  ('30712345678', 1, 'FACTURA_B'),
  ('30712345678', 1, 'FACTURA_A'),
  ('30987654321', 1, 'FACTURA_B');

insert into banco.cuentas (id, cuit, titular, cbu, alias, saldo) values
  ('cuenta-mateo',    '30712345678', 'Almacén Don Mateo SRL', '0000003100012345678901', 'almacen.mateo.banco',  50000.00),
  ('cuenta-esquina',  '30987654321', 'Kiosco La Esquina SA',  '0000003100098765432101', 'kiosco.esquina.banco', 30000.00),
  ('cuenta-juan',     '20345678901', 'Juan Pérez',            '0000003100034567890101', 'juan.perez.banco',     150000.00),
  ('cuenta-maria',    '27123456789', 'María Gómez',           '0000003100012345678921', 'maria.gomez.banco',     80000.00);

insert into billetera.cuentas (cuit, titular, alias, saldo, banco_cuenta_id) values
  ('27123456789', 'María Gómez',           'maria.billetera',  20000.00, 'cuenta-maria'),
  ('30712345678', 'Almacén Don Mateo SRL', 'mateo.billetera',      0.00, 'cuenta-mateo');

insert into tpv.terminales (id, nombre) values
  ('david',     'TPV David'),
  ('sebastian', 'TPV Sebastián');

insert into tpv.productos (terminal_id, comercio_cuit, codigo, nombre, precio, stock) values
  ('david',     '30712345678', 'YER1K', 'Yerba 1 kg',         4200.00, 40),
  ('david',     '30712345678', 'ACE15', 'Aceite girasol 1,5 L', 2850.00, 25),
  ('david',     '30712345678', 'PAN05', 'Pan lactal',         1950.00, 30),
  ('sebastian', '30987654321', 'CAF05', 'Café molido 500 g',  4500.00, 50),
  ('sebastian', '30987654321', 'LEC1L', 'Leche entera 1 L',   1200.00, 100),
  ('sebastian', '30987654321', 'AGU15', 'Agua mineral 1,5 L',  950.00, 80);

-- Usuarios demo de la billetera (contraseñas de prueba, guardadas como hash).
-- 20268326074 / 1234 es el usuario demo de la cátedra; los otros tres son los
-- clientes demo que ya usa la app de Lucas-M.
insert into padron.contribuyentes (cuit, razon_social, tipo_persona, condicion_iva) values
  ('20268326074', 'Usuario Demo Billetera', 'fisica', 'consumidor_final'),
  ('30000000001', 'Ana Gómez (Demo)',       'fisica', 'consumidor_final'),
  ('30000000002', 'Marcos Ríos (Demo)',     'fisica', 'consumidor_final'),
  ('30000000003', 'Laura Fernández (Demo)', 'fisica', 'consumidor_final');

insert into banco.cuentas (id, cuit, titular, cbu, alias, saldo) values
  ('cuenta-demo', '20268326074', 'Usuario Demo Billetera', '0000003100020268326074', 'demo.banco', 200000.00),
  ('cuenta-ana-demo', '30000000001', 'Ana Gómez (Demo)', '0000003100030000000001', 'ana.demo.banco', 45000.00),
  ('cuenta-marcos-demo', '30000000002', 'Marcos Ríos (Demo)', '0000003100030000000002', 'marcos.demo.banco', 18000.00),
  ('cuenta-laura-demo', '30000000003', 'Laura Fernández (Demo)', '0000003100030000000003', 'laura.demo.banco', 7500.00);

insert into billetera.cuentas (cuit, titular, alias, saldo, banco_cuenta_id) values
  ('20268326074', 'Usuario Demo Billetera', 'demo.billetera', 200000.00, 'cuenta-demo'),
  ('30000000001', 'Ana Gómez (Demo)',       'ana.prueba',      45000.00, 'cuenta-ana-demo'),
  ('30000000002', 'Marcos Ríos (Demo)',     'marcos.prueba',   18000.00, 'cuenta-marcos-demo'),
  ('30000000003', 'Laura Fernández (Demo)', 'laura.prueba',     7500.00, 'cuenta-laura-demo');

insert into billetera.usuarios (cuenta_id, password_hash)
select c.id, extensions.crypt(u.clave, extensions.gen_salt('bf'))
from (values
  ('20268326074', '1234'),
  ('30000000001', 'demo1234'),
  ('30000000002', 'demo1234'),
  ('30000000003', 'demo1234')
) as u (cuit, clave)
join billetera.cuentas c on c.cuit = u.cuit;
