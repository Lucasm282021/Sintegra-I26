-- Vincula el terminal TPV David a la cuenta de Banco del comercio de demo
-- ya existente. No crea CUIT ni cuenta bancaria y no modifica saldos.
insert into tpv.comercios(terminal_id,cuit,rubro,cuenta_destino)
select 'david',c.cuit,'Almacén / autoservicio',b.id
from padron.contribuyentes c
join banco.cuentas b using(cuit)
where c.cuit='30712345678'
  and exists(select 1 from tpv.terminales where id='david')
on conflict(terminal_id,cuit) do update
set cuenta_destino=excluded.cuenta_destino,activo=true;
