# Sintegra I26

Sistema Integral Fiscal para coordinar ventas, servicios tributarios, habilitaciones y pagos dentro del ecosistema fintech simulado.

Consulta la [documentación del sistema](doc/sistema.md) para conocer el alcance, los módulos y el flujo de una venta.

Para operar o recorrer la plataforma, abrí el [manual de usuario HTML](doc/MANUAL-USUARIO-SINTEGRA.html). Es una guía autocontenida y distingue las funciones simuladas de las integraciones oficiales.

El portal de acceso está en [`public/index.html`](public/index.html). Para desplegarlo y publicar los frontends del monorepo en Vercel, seguí la [guía de despliegue](doc/VERCEL-MONOREPO.md).

Consulta la [documentación del frontend ARBA Tomi](doc/FRONTEND-ARBA-TOMI.md) para conocer su interfaz y contrato de integración.

## Sumar una app al ecosistema

Cada alumno sube acá el **frontend** de su módulo. El backend común lo construimos después desde la cátedra, siguiendo la [propuesta de unificación](doc/INFORME-UNIFICACION-APPS.md). Mientras tanto cada frontend puede funcionar en modo demo, pero debe leer la URL de su API desde una variable de entorno (por ejemplo `VITE_API_BASE_URL`) para conectarse al backend cuando exista.

- Conservá cada app en una carpeta propia de primer nivel con su `package.json`, lockfile, `README.md` y `.env.example`.
- No muevas una carpeta sin actualizar el **Root Directory** de su proyecto Vercel.
- Publicá cada frontend como proyecto independiente y agregá su dominio y logo a `public/index.html`.
- Documentá por separado dónde vive la API y qué almacenamiento persistente necesita; Vercel no guarda bases SQLite o JSON en disco entre ejecuciones.
- Para conocer las raíces, comandos y variables actuales, consultá [la guía del monorepo](doc/VERCEL-MONOREPO.md).
