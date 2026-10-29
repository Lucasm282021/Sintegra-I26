-- Habilita la operación de Municipio y TPV en el backend común.
-- Solo agrega columnas y una cuenta recaudadora; conserva las filas existentes.

alter table municipio.tasas
  add column if not exists concepto text not null default 'Tasa de Seguridad e Higiene (TISH)',
  add column if not exists desglose jsonb not null default '[]'::jsonb,
  add column if not exists vencimiento date,
  add column if not exists id_comprobante text;

update municipio.tasas
set desglose = jsonb_build_array(jsonb_build_object('concepto', concepto, 'importe', monto))
where desglose = '[]'::jsonb;

update municipio.tasas
set vencimiento = (date_trunc('month', (periodo || '-01')::date) + interval '1 month - 1 day')::date
where vencimiento is null;

update municipio.tasas
set id_comprobante = 'MUN-' || replace(periodo, '-', '') || '-' || right(cuit, 4) || '-' || left(md5(id_tributo), 8)
where estado = 'pagada' and id_comprobante is null;

alter table tpv.ventas add column if not exists payload_hash text;
update tpv.ventas set payload_hash = md5(id_venta || ':' || comercio_cuit || ':' || subtotal::text)
where payload_hash is null;

insert into padron.contribuyentes (cuit, razon_social, tipo_persona, condicion_iva)
values ('30000000098', 'Tesorería Municipal (Demo)', 'juridica', 'responsable_inscripto')
on conflict (cuit) do nothing;

insert into banco.cuentas (id, cuit, titular, cbu, alias, saldo)
values ('cuenta-municipio', '30000000098', 'Tesorería Municipal (Demo)', '0000003100030000000098', 'tesoreria.municipal', 0)
on conflict (id) do nothing;
