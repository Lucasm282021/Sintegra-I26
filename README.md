# Sintegra I26

Sistema Integral Fiscal para coordinar ventas, servicios tributarios, habilitaciones y pagos dentro del ecosistema fintech simulado.

Consulta la [documentación del sistema](doc/sistema.md) para conocer el alcance, los módulos y el flujo de una venta.

El portal de acceso está en [`public/index.html`](public/index.html). Para desplegarlo y publicar los frontends del monorepo en Vercel, seguí la [guía de despliegue](doc/VERCEL-MONOREPO.md).

Consulta la [documentación del frontend ARBA Tomi](doc/FRONTEND-ARBA-TOMI.md) para conocer su interfaz y contrato de integración.

## Sumar una app al ecosistema

- Conservá cada app en una carpeta propia de primer nivel con su `package.json`, lockfile, `README.md` y `.env.example`.
- No muevas una carpeta sin actualizar el **Root Directory** de su proyecto Vercel.
- Publicá cada frontend como proyecto independiente y agregá su dominio y logo a `public/index.html`.
- Documentá por separado dónde vive la API y qué almacenamiento persistente necesita; Vercel no guarda bases SQLite o JSON en disco entre ejecuciones.
- Para conocer las raíces, comandos y variables actuales, consultá [la guía del monorepo](doc/VERCEL-MONOREPO.md).
