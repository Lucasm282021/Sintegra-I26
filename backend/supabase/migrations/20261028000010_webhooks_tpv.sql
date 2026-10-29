-- Eventos de pago durables y configuracion de callback por terminal.
-- No guarda tokens en la respuesta ni modifica saldos existentes.
create table if not exists tpv.webhook_config (
  terminal_id text primary key references tpv.terminales(id) on delete cascade,
  endpoint_url text not null,
  secret text not null,
  activo boolean not null default true,
  actualizado_en timestamptz not null default now(),
  check (length(secret) >= 32)
);
alter table tpv.webhook_config enable row level security;

create table if not exists tpv.webhook_eventos (
  id uuid primary key default gen_random_uuid(),
  terminal_id text not null references tpv.terminales(id),
  id_venta text not null,
  evento text not null check (evento = 'payment.confirmed'),
  payload jsonb not null,
  estado text not null default 'pendiente' check (estado in ('pendiente','entregado')),
  intentos integer not null default 0 check (intentos >= 0),
  ultimo_http_status integer,
  ultimo_error text,
  creado_en timestamptz not null default now(),
  entregado_en timestamptz,
  unique (terminal_id,id_venta,evento),
  check ((estado = 'entregado') = (entregado_en is not null))
);
create index if not exists webhook_eventos_pendientes
  on tpv.webhook_eventos(estado,creado_en) where estado='pendiente';
alter table tpv.webhook_eventos enable row level security;

alter table billetera.solicitudes_qr
  add column if not exists terminal_id text references tpv.terminales(id);
