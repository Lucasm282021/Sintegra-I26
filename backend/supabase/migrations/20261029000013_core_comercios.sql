-- CORE de comercios (doc/ARQUITECTURA-COMERCIOS.md).
-- Solo agrega: no modifica ni borra tablas de otros esquemas.
-- Reversión: drop schema core cascade.

create schema if not exists core;

-- Dígito verificador de CUIT/CUIL (módulo 11). Valida la estructura, no que
-- ARCA lo haya emitido.
create or replace function core.cuit_dv_valido(c text) returns boolean
language sql immutable as $$
  select case
    when c is null or c !~ '^[0-9]{11}$' then false
    else (
      select (case 11 - (sum(substr(c, i::int, 1)::int * w) % 11)
                when 11 then 0 when 10 then 9
                else 11 - (sum(substr(c, i::int, 1)::int * w) % 11) end)
             = substr(c, 11, 1)::int
      from unnest(array[5,4,3,2,7,6,5,4,3,2]) with ordinality as t(w, i)
    )
  end
$$;

create table core.comercios (
  id                uuid primary key default gen_random_uuid(),   -- commerce_id
  cuit              padron.cuit not null unique,
  razon_social      text not null,
  nombre_fantasia   text,
  tipo_persona      text check (tipo_persona in ('fisica', 'juridica')),
  email_contacto    text,
  telefono_contacto text,
  domicilio_fiscal  text,
  estado_registro   text not null default 'registrado'
                    check (estado_registro in ('registrado', 'observado', 'suspendido', 'baja')),
  origen            text not null default 'alta' check (origen in ('alta', 'importado')),
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now()
);
create trigger comercios_actualizado_en before update on core.comercios
  for each row execute function padron.set_actualizado_en();

create table core.sucursales (
  id                  uuid primary key default gen_random_uuid(),
  comercio_id         uuid not null references core.comercios (id),
  nombre              text not null,
  domicilio_comercial text not null,
  localidad           text,
  provincia           text,
  codigo_postal       text,
  municipio           text,
  estado              text not null default 'activa' check (estado in ('activa', 'inactiva')),
  creado_en           timestamptz not null default now()
);
create index sucursales_comercio on core.sucursales (comercio_id);

create table core.usuarios (
  id             uuid primary key default gen_random_uuid(),
  email          text not null unique check (email = lower(email)),
  nombre         text not null,
  password_hash  text not null,
  estado         text not null default 'activo' check (estado in ('activo', 'bloqueado')),
  ultimo_ingreso timestamptz,
  creado_en      timestamptz not null default now()
);

create table core.membresias (
  id             uuid primary key default gen_random_uuid(),
  comercio_id    uuid not null references core.comercios (id),
  usuario_id     uuid not null references core.usuarios (id),
  rol            text not null check (rol in ('titular', 'administrador', 'operador')),
  estado         text not null check (estado in ('activa', 'pendiente', 'rechazada', 'revocada')),
  motivo         text,
  resuelta_por   uuid references core.usuarios (id),
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (comercio_id, usuario_id)
);
create trigger membresias_actualizado_en before update on core.membresias
  for each row execute function padron.set_actualizado_en();

-- Referencias a otros sistemas (solo identificadores).
create table core.integraciones (
  id                    uuid primary key default gen_random_uuid(),
  comercio_id           uuid not null references core.comercios (id),
  sistema               text not null check (sistema in ('arca', 'arba', 'municipio', 'banco', 'billetera', 'tpv')),
  referencia_externa    text not null,
  estado                text not null,
  detalle               jsonb not null default '{}',
  ultima_sincronizacion timestamptz not null default now(),
  unique (comercio_id, sistema, referencia_externa)
);

-- Historial de verificaciones: solo se agregan filas. El estado vigente de un
-- sistema es su última fila.
create table core.verificaciones (
  id                   uuid primary key default gen_random_uuid(),
  comercio_id          uuid not null references core.comercios (id),
  sucursal_id          uuid references core.sucursales (id),
  sistema              text not null check (sistema in ('identidad', 'arca', 'arba', 'municipio', 'banco', 'tpv')),
  resultado            text not null check (resultado in (
                         'registrado', 'declarado', 'verificado', 'pendiente', 'observado', 'no_aplicable',
                         'no_disponible', 'habilitado', 'en_tramite', 'vinculado', 'rechazado', 'configurado', 'activo')),
  origen               text not null check (origen in ('sandbox', 'manual', 'oficial', 'declaracion', 'sistema')),
  referencia_evidencia text,
  detalle              jsonb not null default '{}',
  error                text,
  vigencia_hasta       date,
  verificado_por       uuid references core.usuarios (id),
  creado_en            timestamptz not null default now()
);
create index verificaciones_vigentes on core.verificaciones (comercio_id, sistema, creado_en desc);

-- Bandeja de salida de eventos de dominio (datos mínimos).
create table core.eventos (
  id           uuid primary key default gen_random_uuid(),
  comercio_id  uuid references core.comercios (id),
  tipo         text not null,
  datos        jsonb not null default '{}',
  actor        uuid references core.usuarios (id),
  creado_en    timestamptz not null default now(),
  publicado_en timestamptz
);
create index eventos_pendientes on core.eventos (creado_en) where publicado_en is null;

alter table core.comercios      enable row level security;
alter table core.sucursales     enable row level security;
alter table core.usuarios       enable row level security;
alter table core.membresias     enable row level security;
alter table core.integraciones  enable row level security;
alter table core.verificaciones enable row level security;
alter table core.eventos        enable row level security;

-- Importación de los comercios que ya operan en algún dominio. Lee tablas de
-- dominio y escribe solo en core. Los CUIT demo sin dígito verificador válido
-- quedan "observado" para no bloquear las apps existentes.
with operan as (
  select cuit from municipio.habilitaciones
  union select cuit from arba.inscripciones
  union select emisor_cuit from arca.puntos_venta
  union select cuit from tpv.comercios
)
insert into core.comercios (cuit, razon_social, tipo_persona, domicilio_fiscal, estado_registro, origen)
select c.cuit, c.razon_social, c.tipo_persona, c.domicilio_fiscal,
       case when core.cuit_dv_valido(c.cuit) then 'registrado' else 'observado' end, 'importado'
from padron.contribuyentes c join operan o on o.cuit = c.cuit
on conflict (cuit) do nothing;

insert into core.sucursales (comercio_id, nombre, domicilio_comercial)
select k.id, 'Casa central', coalesce(h.domicilio, k.domicilio_fiscal, 'Sin informar')
from core.comercios k left join municipio.habilitaciones h on h.cuit = k.cuit
where k.origen = 'importado'
  and not exists (select 1 from core.sucursales s where s.comercio_id = k.id);

insert into core.verificaciones (comercio_id, sistema, resultado, origen, referencia_evidencia, detalle)
select id, 'identidad',
       case when estado_registro = 'registrado' then 'registrado' else 'observado' end,
       'sistema', 'core.comercios:' || cuit,
       case when estado_registro = 'registrado'
            then '{"motivo":"importado desde los dominios existentes"}'::jsonb
            else '{"motivo":"CUIT demo heredado con dígito verificador inválido"}'::jsonb end
from core.comercios where origen = 'importado';

insert into core.eventos (comercio_id, tipo, datos)
select id, 'commerce.created', jsonb_build_object('origen', 'importado', 'cuit', cuit)
from core.comercios where origen = 'importado';
