-- Precios desde el costo, cuentas corrientes y cheques (doc/BANCO-Y-CHEQUES.md,
-- doc/IMPUESTOS-Y-PERCEPCIONES.md). Solo agrega.

-- TPV: costo y margen de ganancia (el precio de venta se calcula en la API).
alter table tpv.productos
  add column if not exists costo  padron.importe,
  add column if not exists margen numeric(6,4) check (margen is null or (margen >= 0 and margen < 10));

-- Banco: tipo de cuenta. Las cuentas corrientes pueden librar cheques.
alter table banco.cuentas
  add column if not exists tipo text not null default 'caja_ahorro'
  check (tipo in ('caja_ahorro', 'cuenta_corriente'));

alter table banco.movimientos drop constraint if exists movimientos_tipo_check;
alter table banco.movimientos add constraint movimientos_tipo_check
  check (tipo in ('venta', 'carga_billetera', 'transferencia', 'deposito', 'extraccion', 'cheque'));

create table if not exists banco.cheques (
  id               uuid primary key default gen_random_uuid(),
  numero           text not null unique,
  cuenta_librador  text not null references banco.cuentas (id),
  beneficiario     text not null,
  monto            padron.importe not null check (monto > 0),
  fecha_emision    date not null default current_date,
  fecha_pago       date not null default current_date,
  estado           text not null default 'emitido'
                   check (estado in ('emitido', 'depositado', 'acreditado', 'rechazado', 'anulado')),
  cuenta_deposito  text references banco.cuentas (id),
  movimiento_id    uuid references banco.movimientos (id),
  motivo_rechazo   text,
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),
  check (fecha_pago >= fecha_emision)
);
create index if not exists cheques_librador on banco.cheques (cuenta_librador);
create index if not exists cheques_deposito on banco.cheques (cuenta_deposito);
alter table banco.cheques enable row level security;

-- TPV: proveedores, compras y cuenta corriente de proveedores.
create table if not exists tpv.proveedores (
  comercio_cuit   padron.cuit not null references padron.contribuyentes (cuit),
  proveedor_cuit  padron.cuit not null references padron.contribuyentes (cuit),
  rubro           text,
  plazo_dias      integer not null default 30 check (plazo_dias between 0 and 365),
  activo          boolean not null default true,
  creado_en       timestamptz not null default now(),
  primary key (comercio_cuit, proveedor_cuit),
  check (comercio_cuit <> proveedor_cuit)
);

create table if not exists tpv.compras (
  id               uuid primary key default gen_random_uuid(),
  id_compra        text not null unique,
  comercio_cuit    padron.cuit not null,
  proveedor_cuit   padron.cuit not null,
  tipo_comprobante text not null check (tipo_comprobante in ('FACTURA_A', 'FACTURA_B', 'FACTURA_C')),
  numero_factura   text not null,
  fecha            date not null default current_date,
  vencimiento      date not null,
  neto             padron.importe not null,
  iva              padron.importe not null default 0,
  total            padron.importe not null check (total > 0),
  creado_en        timestamptz not null default now(),
  foreign key (comercio_cuit, proveedor_cuit) references tpv.proveedores (comercio_cuit, proveedor_cuit),
  unique (comercio_cuit, proveedor_cuit, tipo_comprobante, numero_factura)
);

create table if not exists tpv.compra_items (
  compra_id      uuid not null references tpv.compras (id) on delete cascade,
  linea          integer not null check (linea > 0),
  producto_id    uuid not null references tpv.productos (id),
  cantidad       integer not null check (cantidad > 0),
  costo_unitario padron.importe not null,
  primary key (compra_id, linea)
);

create table if not exists tpv.pagos_proveedor (
  id                  uuid primary key default gen_random_uuid(),
  id_pago             text not null unique,
  comercio_cuit       padron.cuit not null,
  proveedor_cuit      padron.cuit not null,
  medio               text not null check (medio in ('transferencia', 'cheque', 'efectivo')),
  monto               padron.importe not null check (monto > 0),
  banco_movimiento_id uuid references banco.movimientos (id),
  cheque_id           uuid references banco.cheques (id),
  creado_en           timestamptz not null default now(),
  foreign key (comercio_cuit, proveedor_cuit) references tpv.proveedores (comercio_cuit, proveedor_cuit)
);

alter table tpv.proveedores     enable row level security;
alter table tpv.compras         enable row level security;
alter table tpv.compra_items    enable row level security;
alter table tpv.pagos_proveedor enable row level security;
