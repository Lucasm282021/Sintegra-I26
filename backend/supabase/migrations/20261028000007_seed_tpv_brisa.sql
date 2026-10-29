-- Semilla acotada de Brisa: reutiliza únicamente el CUIT demo ya presente
-- en el padrón central. No crea identidades ni cuentas nuevas.
insert into tpv.comercios(terminal_id,cuit,rubro,cuenta_destino)
select 'brisa',c.cuit,'Alimentos',b.id
from padron.contribuyentes c join banco.cuentas b using(cuit)
where c.cuit='30712345678'
on conflict(terminal_id,cuit) do nothing;

insert into tpv.productos(terminal_id,comercio_cuit,codigo,nombre,categoria,precio,stock)
select 'brisa','30712345678',p.codigo,p.nombre,p.categoria,p.precio,p.stock
from (values
 ('BRI-001','Alfajor de maicena','Golosinas',1200.00,40),
 ('BRI-002','Agua mineral 500 ml','Bebidas',1100.00,36),
 ('BRI-003','Gaseosa lima limón 1,5 L','Bebidas',2800.00,18),
 ('BRI-004','Galletitas de agua','Almacén',1500.00,25),
 ('BRI-005','Yerba mate 1 kg','Almacén',5200.00,12),
 ('BRI-006','Turrón de maní','Golosinas',600.00,60),
 ('BRI-007','Medialunas x 6','Panadería',3300.00,10),
 ('BRI-008','Leche entera 1 L','Lácteos',1600.00,20)
) as p(codigo,nombre,categoria,precio,stock)
where exists(select 1 from padron.contribuyentes where cuit='30712345678')
on conflict(terminal_id,comercio_cuit,codigo) do nothing;
