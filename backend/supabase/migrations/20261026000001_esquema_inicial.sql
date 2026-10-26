-- Sintegra I26 — base de datos única del ecosistema.
--
-- Un esquema por sistema (municipio, arba, arca, banco, billetera, tpv), cada
-- uno dueño de sus tablas. Lo que se comparte vive en el esquema "padron":
-- los contribuyentes por CUIT y la vista ficha_contribuyente, que es la única
-- consulta que cruza datos de varios sistemas.
--
-- Regla: un sistema escribe solo en su esquema. Para saber algo de otro
-- sistema usa el padrón o la vista, nunca las tablas internas del otro.
--
-- Contrato (guía fundacional): CUIT texto de 11 dígitos, importes en pesos con
-- 2 decimales (numeric exacto, sin errores de redondeo de float), id_venta
-- como clave de idempotencia, fechas en UTC.

create schema if not exists padron;
create schema if not exists municipio;
create schema if not exists arba;
create schema if not exists arca;
create schema if not exists banco;
create schema if not exists billetera;
create schema if not exists tpv;

create domain padron.cuit as text
  check (value ~ '^[0-9]{11}$');

create domain padron.importe as numeric(14,2)
  check (value >= 0);

create domain padron.periodo as text
  check (value ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

create function padron.set_actualizado_en() returns trigger
language plpgsql as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- PADRÓN COMPARTIDO (lo mantiene ARCA; lo leen todos)
-- ---------------------------------------------------------------------------

create table padron.contribuyentes (
  cuit            padron.cuit primary key,
  razon_social    text not null,
  tipo_persona    text not null check (tipo_persona in ('fisica', 'juridica')),
  condicion_iva   text not null check (condicion_iva in
                    ('responsable_inscripto', 'monotributo', 'exento', 'consumidor_final')),
  domicilio_fiscal text,
  estado          text not null default 'activo' check (estado in ('activo', 'inactivo')),
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);

create trigger contribuyentes_actualizado_en
  before update on padron.contribuyentes
  for each row execute function padron.set_actualizado_en();

-- ---------------------------------------------------------------------------
-- MUNICIPIO — habilitaciones comerciales y tasas por período
-- ---------------------------------------------------------------------------

create table municipio.habilitaciones (
  cuit        padron.cuit primary key references padron.contribuyentes (cuit),
  rubro       text not null,
  domicilio   text,
  estado      text not null default 'activa' check (estado in ('activa', 'suspendida', 'baja')),
  fecha_alta  date not null default current_date
);

create table municipio.tasas (
  id            uuid primary key default gen_random_uuid(),
  id_tributo    text not null unique,
  cuit          padron.cuit not null references municipio.habilitaciones (cuit),
  periodo       padron.periodo not null,
  tipo          text not null default 'TSYH',
  monto         padron.importe not null check (monto > 0),
  estado        text not null default 'pendiente' check (estado in ('pendiente', 'pagada')),
  pagada_en     timestamptz,
  payload_hash  text,
  creado_en     timestamptz not null default now(),
  unique (cuit, periodo, tipo),
  check ((estado = 'pagada') = (pagada_en is not null))
);

-- ---------------------------------------------------------------------------
-- ARBA — inscripción en IIBB y percepciones por venta
-- ---------------------------------------------------------------------------

create table arba.inscripciones (
  cuit           padron.cuit primary key references padron.contribuyentes (cuit),
  actividad      text not null,
  alicuota       numeric(6,5) not null check (alicuota >= 0 and alicuota < 1),
  estado         text not null default 'activa' check (estado in ('activa', 'baja')),
  vigente_desde  date not null default current_date
);

create table arba.percepciones (
  id                 uuid primary key default gen_random_uuid(),
  id_venta           text not null unique,
  cuit               padron.cuit not null references arba.inscripciones (cuit),
  monto_venta        padron.importe not null check (monto_venta > 0),
  alicuota_aplicada  numeric(6,5) not null,
  monto_percepcion   padron.importe not null,
  payload_hash       text not null,
  creado_en          timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- ARCA — comprobantes con CAE simulado y numeración correlativa
-- ---------------------------------------------------------------------------

create table arca.puntos_venta (
  emisor_cuit       padron.cuit not null references padron.contribuyentes (cuit),
  punto_venta       integer not null check (punto_venta between 1 and 99999),
  tipo_comprobante  text not null check (tipo_comprobante in ('FACTURA_A', 'FACTURA_B', 'FACTURA_C')),
  ultimo_numero     integer not null default 0 check (ultimo_numero >= 0),
  primary key (emisor_cuit, punto_venta, tipo_comprobante)
);

create table arca.comprobantes (
  id                uuid primary key default gen_random_uuid(),
  id_venta          text not null unique,
  emisor_cuit       padron.cuit not null,
  receptor_cuit     padron.cuit,
  punto_venta       integer not null,
  tipo_comprobante  text not null,
  numero            integer not null check (numero > 0),
  subtotal          padron.importe not null,
  percepcion        padron.importe not null default 0,
  monto_total       padron.importe not null check (monto_total > 0),
  cae               text not null check (cae ~ '^[0-9]{14}$'),
  cae_vencimiento   date not null,
  estado            text not null default 'emitido' check (estado in ('emitido', 'anulado')),
  payload_hash      text not null,
  emitido_en        timestamptz not null default now(),
  foreign key (emisor_cuit, punto_venta, tipo_comprobante)
    references arca.puntos_venta (emisor_cuit, punto_venta, tipo_comprobante),
  unique (emisor_cuit, punto_venta, tipo_comprobante, numero),
  check (monto_total = subtotal + percepcion)
);

-- ---------------------------------------------------------------------------
-- BANCO — cuentas y transferencias
-- ---------------------------------------------------------------------------

create table banco.cuentas (
  id         text primary key,
  cuit       padron.cuit not null references padron.contribuyentes (cuit),
  titular    text not null,
  cbu        text unique check (cbu ~ '^[0-9]{22}$'),
  alias      text unique,
  saldo      padron.importe not null default 0,
  creado_en  timestamptz not null default now()
);

-- id_operacion es la clave de idempotencia: el id_venta cuando el TPV cobra,
-- o el id de la carga cuando la billetera se fondea desde el banco.
create table banco.movimientos (
  id              uuid primary key default gen_random_uuid(),
  id_operacion    text not null unique,
  tipo            text not null check (tipo in ('venta', 'carga_billetera', 'transferencia')),
  cuenta_origen   text not null references banco.cuentas (id),
  cuenta_destino  text not null references banco.cuentas (id),
  monto           padron.importe not null check (monto > 0),
  estado          text not null default 'confirmado' check (estado in ('confirmado', 'revertido')),
  payload_hash    text not null,
  creado_en       timestamptz not null default now(),
  check (cuenta_origen <> cuenta_destino)
);

-- ---------------------------------------------------------------------------
-- BILLETERA — billeteras virtuales, cargas y pagos
-- ---------------------------------------------------------------------------

-- Cada billetera puede estar asociada a una cuenta del banco, desde donde se
-- fondean las cargas. Mientras el banco no esté operativo queda en null.
create table billetera.cuentas (
  id               uuid primary key default gen_random_uuid(),
  cuit             padron.cuit not null unique references padron.contribuyentes (cuit),
  titular          text not null,
  alias            text not null unique,
  saldo            padron.importe not null default 0,
  banco_cuenta_id  text references banco.cuentas (id),
  creado_en        timestamptz not null default now()
);

-- Un pago genera dos movimientos con el mismo id_operacion: el débito de quien
-- paga ("pago") y el crédito del comercio ("cobro"). Una carga fondeada desde
-- el banco guarda el movimiento bancario que la respalda.
create table billetera.movimientos (
  id                     uuid primary key default gen_random_uuid(),
  id_operacion           text not null,
  cuenta_id              uuid not null references billetera.cuentas (id),
  tipo                   text not null check (tipo in ('carga', 'pago', 'cobro')),
  monto                  padron.importe not null check (monto > 0),
  contraparte_cuit       padron.cuit,
  saldo_resultante       padron.importe not null,
  banco_movimiento_id    uuid references banco.movimientos (id),
  payload_hash           text not null,
  creado_en              timestamptz not null default now(),
  unique (id_operacion, cuenta_id),
  check (banco_movimiento_id is null or tipo = 'carga')
);

create index billetera_movimientos_cuenta_fecha
  on billetera.movimientos (cuenta_id, creado_en desc);

-- ---------------------------------------------------------------------------
-- TPV — catálogo y ventas (orquesta a los demás sistemas por API)
-- ---------------------------------------------------------------------------

-- Cada TPV del curso es una terminal independiente: tiene su propio catálogo
-- y sus propias ventas, y no ve los datos de la otra.
create table tpv.terminales (
  id         text primary key check (id ~ '^[a-z0-9-]+$'),
  nombre     text not null,
  creado_en  timestamptz not null default now()
);

create table tpv.productos (
  id             uuid primary key default gen_random_uuid(),
  terminal_id    text not null references tpv.terminales (id),
  comercio_cuit  padron.cuit not null references padron.contribuyentes (cuit),
  codigo         text,
  nombre         text not null,
  precio         padron.importe not null check (precio > 0),
  stock          integer check (stock >= 0),
  activo         boolean not null default true,
  creado_en      timestamptz not null default now(),
  unique (terminal_id, comercio_cuit, codigo)
);

-- Las referencias a percepción, pago y comprobante son los IDs que devolvió
-- cada sistema. No son claves foráneas: el TPV no lee tablas ajenas.
create table tpv.ventas (
  id_venta         text primary key,
  terminal_id      text not null references tpv.terminales (id),
  comercio_cuit    padron.cuit not null references padron.contribuyentes (cuit),
  medio_pago       text not null check (medio_pago in ('banco', 'billetera')),
  estado           text not null default 'pendiente' check (estado in
                     ('pendiente', 'percibida', 'cobrada', 'completada', 'error')),
  subtotal         padron.importe not null,
  percepcion       padron.importe,
  total            padron.importe,
  ref_percepcion   text,
  ref_pago         text,
  ref_comprobante  text,
  etapa_error      text check (etapa_error in ('municipio', 'arba', 'pago', 'arca')),
  detalle_error    text,
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now()
);

create trigger ventas_actualizado_en
  before update on tpv.ventas
  for each row execute function padron.set_actualizado_en();

create table tpv.venta_items (
  id_venta         text not null references tpv.ventas (id_venta) on delete cascade,
  linea            integer not null check (linea > 0),
  producto_id      uuid not null references tpv.productos (id),
  cantidad         integer not null check (cantidad > 0),
  precio_unitario  padron.importe not null,
  primary key (id_venta, linea)
);

create index ventas_terminal_fecha on tpv.ventas (terminal_id, creado_en desc);
create index productos_terminal on tpv.productos (terminal_id);

-- ---------------------------------------------------------------------------
-- CONSULTA COMPARTIDA POR CUIT
-- ---------------------------------------------------------------------------

-- Ficha de un contribuyente con lo que cada sistema sabe de él. Es la forma
-- acordada de compartir información entre sistemas.
create view padron.ficha_contribuyente as
select
  c.cuit,
  c.razon_social,
  c.tipo_persona,
  c.condicion_iva,
  c.estado                           as estado_padron,
  ai.actividad                       as arba_actividad,
  ai.alicuota                        as arba_alicuota,
  ai.estado                          as arba_estado,
  mh.rubro                           as municipio_rubro,
  mh.estado                          as municipio_estado,
  (select count(*) from municipio.tasas t
     where t.cuit = c.cuit and t.estado = 'pendiente') as municipio_tasas_pendientes,
  exists (select 1 from banco.cuentas b where b.cuit = c.cuit)         as tiene_cuenta_banco,
  exists (select 1 from billetera.cuentas w where w.cuit = c.cuit)     as tiene_billetera
from padron.contribuyentes c
left join arba.inscripciones ai on ai.cuit = c.cuit
left join municipio.habilitaciones mh on mh.cuit = c.cuit;

-- ---------------------------------------------------------------------------
-- SEGURIDAD
-- ---------------------------------------------------------------------------

-- RLS activado sin políticas: la API pública de Supabase (anon/authenticated)
-- no puede leer ni escribir. El backend se conecta con el usuario dueño de las
-- tablas y no queda limitado por RLS.
alter table padron.contribuyentes   enable row level security;
alter table municipio.habilitaciones enable row level security;
alter table municipio.tasas          enable row level security;
alter table arba.inscripciones       enable row level security;
alter table arba.percepciones        enable row level security;
alter table arca.puntos_venta        enable row level security;
alter table arca.comprobantes        enable row level security;
alter table banco.cuentas            enable row level security;
alter table banco.movimientos        enable row level security;
alter table billetera.cuentas        enable row level security;
alter table billetera.movimientos    enable row level security;
alter table tpv.terminales           enable row level security;
alter table tpv.productos            enable row level security;
alter table tpv.ventas               enable row level security;
alter table tpv.venta_items          enable row level security;

-- La vista corre con los permisos de quien consulta, no de su dueño.
alter view padron.ficha_contribuyente set (security_invoker = true);
