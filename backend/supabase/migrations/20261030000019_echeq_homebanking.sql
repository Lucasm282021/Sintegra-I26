-- eCheq y homebanking (doc/BANCO-Y-CHEQUES.md). Solo agrega.

-- Un cheque puede ser físico (lo deposita el banco) o eCheq (lo emite y lo cobra
-- el titular desde la billetera o el homebanking). El eCheq se libra a un CUIT.
alter table banco.cheques
  add column if not exists canal text not null default 'fisico' check (canal in ('fisico', 'echeq')),
  add column if not exists beneficiario_cuit padron.cuit;
create index if not exists cheques_beneficiario on banco.cheques (beneficiario_cuit);

-- Homebanking: cada cliente del banco entra con su CUIT y una clave.
-- Simulación: la clave inicial de todos es demo1234 (se ve en la pantalla de ingreso).
create table if not exists banco.homebanking (
  cuit            padron.cuit primary key references padron.contribuyentes (cuit),
  password_hash   text not null,
  ultimo_ingreso  timestamptz,
  creado_en       timestamptz not null default now()
);
alter table banco.homebanking enable row level security;

insert into banco.homebanking (cuit, password_hash)
select distinct cuit, extensions.crypt('demo1234', extensions.gen_salt('bf'))
from banco.cuentas
where cuit not in ('20000000001', '30000000097', '30000000098', '30000000099')
on conflict (cuit) do nothing;
