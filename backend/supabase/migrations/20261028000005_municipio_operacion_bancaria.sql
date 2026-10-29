-- Conserva la referencia al movimiento bancario de cada tasa pagada.
alter table municipio.tasas add column if not exists id_operacion_banco text;
