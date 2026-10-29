-- Compatibilidad de catálogo para la UI de Brisa en el TPV compartido.
-- El alta de comercios usa el padrón central; no duplica CUITs.
alter table tpv.productos add column if not exists categoria text not null default 'General';
insert into tpv.terminales(id,nombre) values ('brisa','TPV Brisa') on conflict(id) do nothing;
create table if not exists tpv.comercios (
  terminal_id text not null references tpv.terminales(id),
  cuit padron.cuit not null references padron.contribuyentes(cuit),
  rubro text not null default 'Comercio',
  cuenta_destino text references banco.cuentas(id),
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  primary key(terminal_id,cuit)
);
alter table tpv.comercios enable row level security;
