-- Impuestos configurables que afectan las ventas (doc/IMPUESTOS-Y-PERCEPCIONES.md).
-- Valores de PRUEBA: no corresponden a normas vigentes. Solo agrega.

-- ARCA · IVA por producto. El precio del catálogo es el precio final.
alter table tpv.productos
  add column if not exists iva text not null default '21'
  check (iva in ('21', '10.5', '27', '0', 'exento'));

-- ARCA · comprobante con neto, IVA y receptor.
alter table arca.comprobantes
  add column if not exists receptor_condicion text,
  add column if not exists neto padron.importe,
  add column if not exists iva_total padron.importe,
  add column if not exists exento padron.importe,
  add column if not exists iva_detalle jsonb not null default '[]';

-- ARBA · agentes de percepción designados (el comercio que percibe).
create table if not exists arba.agentes (
  cuit           padron.cuit primary key references padron.contribuyentes (cuit),
  activo         boolean not null default true,
  vigente_desde  date not null default current_date,
  vigente_hasta  date,
  designado_en   timestamptz not null default now(),
  check (vigente_hasta is null or vigente_hasta >= vigente_desde)
);

-- ARBA · parámetros generales del régimen de percepción (una sola fila).
create table if not exists arba.config_percepcion (
  id                      integer primary key default 1 check (id = 1),
  alicuota_no_inscriptos  numeric(6,5) not null default 0.05 check (alicuota_no_inscriptos >= 0 and alicuota_no_inscriptos < 1),
  monto_minimo            padron.importe not null default 500,
  actualizado_en          timestamptz not null default now()
);
insert into arba.config_percepcion (id) values (1) on conflict (id) do nothing;

-- ARBA · cada percepción guarda a quién se percibió, sobre qué base y de dónde salió la alícuota.
alter table arba.percepciones
  add column if not exists sujeto_cuit padron.cuit,
  add column if not exists base_imponible padron.importe,
  add column if not exists origen_alicuota text check (origen_alicuota in ('padron', 'no_inscripto', 'legado'));

-- Municipio · alícuota de la Tasa de Seguridad e Higiene por rubro ('*' = general).
create table if not exists municipio.alicuotas_rubro (
  rubro           text primary key,
  alicuota        numeric(6,5) not null check (alicuota >= 0 and alicuota < 1),
  minimo          padron.importe not null default 0,
  actualizado_en  timestamptz not null default now()
);
insert into municipio.alicuotas_rubro (rubro, alicuota, minimo) values
  ('*', 0.006, 3000),
  ('Almacén / autoservicio', 0.005, 3000),
  ('Kiosco', 0.007, 2000)
on conflict (rubro) do nothing;

alter table arba.agentes                enable row level security;
alter table arba.config_percepcion      enable row level security;
alter table municipio.alicuotas_rubro   enable row level security;

-- Demo: el Almacén Don Mateo es agente de percepción (sus ventas a clientes
-- identificados con CUIT llevan percepción). Ningún otro comercio lo es.
insert into arba.agentes (cuit)
select cuit from padron.contribuyentes where cuit = '30712345678'
on conflict (cuit) do nothing;
