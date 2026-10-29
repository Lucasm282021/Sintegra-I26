-- Usuario demo de la cátedra (datos ficticios, credencial visible en el portal)
-- como titular de los comercios importados, para poder administrarlos en clase.
insert into core.usuarios (email, nombre, password_hash)
values ('demo.comercios.i26@gmail.com', 'Cátedra I26 (demo)',
        extensions.crypt('ComerciosDemo2026', extensions.gen_salt('bf')))
on conflict (email) do nothing;

insert into core.membresias (comercio_id, usuario_id, rol, estado)
select k.id, u.id, 'titular', 'activa'
from core.comercios k
cross join core.usuarios u
where u.email = 'demo.comercios.i26@gmail.com' and k.origen = 'importado'
on conflict (comercio_id, usuario_id) do nothing;
