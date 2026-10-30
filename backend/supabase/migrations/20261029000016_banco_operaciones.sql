-- Banco: operaciones de ventanilla (depósito y extracción) y transferencias
-- iniciadas por el cliente. Solo amplía los tipos permitidos y agrega la caja.

alter table banco.movimientos drop constraint if exists movimientos_tipo_check;
alter table banco.movimientos add constraint movimientos_tipo_check
  check (tipo in ('venta', 'carga_billetera', 'transferencia', 'deposito', 'extraccion'));

-- Caja del banco: contraparte de depósitos y extracciones en efectivo (ficticia).
insert into padron.contribuyentes (cuit, razon_social, tipo_persona, condicion_iva)
values ('30000000097', 'Banco M (caja de efectivo)', 'juridica', 'responsable_inscripto')
on conflict (cuit) do nothing;
insert into banco.cuentas (id, cuit, titular, cbu, alias, saldo)
values ('cuenta-caja', '30000000097', 'Banco M · caja de efectivo', '0000003100030000000097', 'caja.banco.m', 1000000000)
on conflict (id) do nothing;
