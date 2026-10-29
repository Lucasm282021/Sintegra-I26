-- QR de pago con vencimiento e idempotencia. El payload no contiene datos
-- fiscales: solo un identificador opaco que se resuelve en el backend.
create table if not exists billetera.solicitudes_qr (
  id uuid primary key default gen_random_uuid(),
  id_venta text not null unique,
  payload text not null unique,
  cuit_destino padron.cuit not null references padron.contribuyentes(cuit),
  monto padron.importe not null check (monto > 0),
  payload_hash text not null,
  estado text not null default 'pendiente' check (estado in ('pendiente','pagada','vencida','cancelada')),
  cuit_origen padron.cuit references padron.contribuyentes(cuit),
  billetera_movimiento_id uuid references billetera.movimientos(id),
  banco_movimiento_id uuid references banco.movimientos(id),
  vence_en timestamptz not null,
  creado_en timestamptz not null default now(),
  pagado_en timestamptz,
  check ((estado = 'pagada') = (pagado_en is not null))
);
create index if not exists solicitudes_qr_estado_vence
  on billetera.solicitudes_qr(estado, vence_en);
alter table billetera.solicitudes_qr enable row level security;

-- Un pago de billetera puede liquidarse a Banco cuando el comercio no tiene
-- billetera: el movimiento de pago conserva la referencia a esa liquidación.
alter table billetera.movimientos drop constraint if exists movimientos_check;
do $$
declare restriccion text;
begin
  for restriccion in
    select conname from pg_constraint
    where conrelid = 'billetera.movimientos'::regclass
      and pg_get_constraintdef(oid) ilike '%banco_movimiento_id%'
  loop
    execute format('alter table billetera.movimientos drop constraint %I', restriccion);
  end loop;
end $$;
alter table billetera.movimientos
  add constraint billetera_movimientos_banco_link_check
  check (banco_movimiento_id is null or tipo in ('carga','pago'));
