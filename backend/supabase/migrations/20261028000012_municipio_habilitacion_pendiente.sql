-- El alta de datos no equivale a una resolución municipal.
-- Conserva los estados existentes y habilita registrar solicitudes pendientes.
alter table municipio.habilitaciones
  drop constraint if exists habilitaciones_estado_check;

alter table municipio.habilitaciones
  add constraint habilitaciones_estado_check
  check (estado in ('pendiente', 'activa', 'suspendida', 'baja'));
