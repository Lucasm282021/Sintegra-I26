-- Usuarios de la billetera: ingreso con CUIT y contraseña.
-- La contraseña se guarda como hash bcrypt (pgcrypto), nunca en texto plano.
-- En Supabase pgcrypto vive en el esquema "extensions".

create extension if not exists pgcrypto with schema extensions;

create table billetera.usuarios (
  cuenta_id       uuid primary key references billetera.cuentas (id) on delete cascade,
  password_hash   text not null,
  ultimo_ingreso  timestamptz,
  creado_en       timestamptz not null default now()
);

alter table billetera.usuarios enable row level security;
