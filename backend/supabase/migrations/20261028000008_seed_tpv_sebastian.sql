-- Catálogo inicial del TPV Sebastián en el padrón compartido.
insert into tpv.terminales(id,nombre) values ('sebastian','TPV Sebastián') on conflict(id) do nothing;
insert into tpv.comercios(terminal_id,cuit,rubro,cuenta_destino)
select 'sebastian',c.cuit,'Comercio minorista',b.id from padron.contribuyentes c
join banco.cuentas b using(cuit) where c.cuit='30712345678'
on conflict(terminal_id,cuit) do nothing;
insert into tpv.productos(terminal_id,comercio_cuit,codigo,nombre,categoria,precio,stock)
select 'sebastian','30712345678',p.codigo,p.nombre,p.categoria,p.precio,p.stock
from (values
 ('SEB-001','Café Molido 500g','Almacén',4500.00,50),
 ('SEB-002','Leche Entera 1L','Lácteos',1200.00,100),
 ('SEB-003','Pan Lactal Integración 500g','Panadería',2300.00,40),
 ('SEB-004','Agua Mineral 1,5L','Bebidas',950.00,80),
 ('SEB-005','Queso Crema 290g','Lácteos',3100.00,35),
 ('SEB-006','Galletitas Dobladas 200g','Almacén',1500.00,60)
) as p(codigo,nombre,categoria,precio,stock)
where exists(select 1 from padron.contribuyentes where cuit='30712345678')
on conflict(terminal_id,comercio_cuit,codigo) do nothing;
