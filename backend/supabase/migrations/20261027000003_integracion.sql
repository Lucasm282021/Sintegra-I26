-- Integración entre sistemas (Banco ↔ Billetera ↔ TPV ↔ ARBA ↔ ARCA).
-- Datos ficticios para la simulación académica.

-- Texto descriptivo del movimiento, como lo muestra la Billetera ("Pago QR a ...").
alter table billetera.movimientos add column if not exists contraparte text;

-- Cuentas del sistema:
--  * custodia de la Billetera: adonde va la plata cuando alguien carga saldo desde su banco.
--  * mostrador: paga las ventas del TPV cuando no se informa la cuenta del cliente.
insert into padron.contribuyentes (cuit, razon_social, tipo_persona, condicion_iva) values
  ('30000000099', 'Sintegra Billetera SA',         'juridica', 'responsable_inscripto'),
  ('20000000001', 'Consumidor Final (Mostrador)',  'fisica',   'consumidor_final'),
  ('20301234567', 'Comercio Demo ARCA',            'fisica',   'monotributo')
on conflict (cuit) do nothing;

insert into banco.cuentas (id, cuit, titular, cbu, alias, saldo) values
  ('cuenta-billetera', '30000000099', 'Sintegra Billetera SA (custodia)', '0000003100030000000099', 'custodia.billetera', 0),
  ('cuenta-mostrador', '20000000001', 'Consumidor Final (Mostrador)',     '0000003100020000000001', 'mostrador.banco',    10000000)
on conflict (id) do nothing;

-- La Billetera exige 8 caracteres: el usuario de la cátedra pasa a usar demo1234.
update billetera.usuarios
set password_hash = extensions.crypt('demo1234', extensions.gen_salt('bf'))
where cuenta_id = (select id from billetera.cuentas where cuit = '20268326074');

-- Registro de migraciones aplicadas por scripts/migrar.js.
create table if not exists public.sintegra_migraciones (
  nombre      text primary key,
  aplicada_en timestamptz not null default now()
);
alter table public.sintegra_migraciones enable row level security;
