-- Medio de pago tal como lo elige la caja (efectivo, tarjeta, transferencia,
-- billetera). La columna medio_pago sigue indicando el circuito (banco o billetera).
alter table tpv.ventas add column if not exists medio_detalle text;
