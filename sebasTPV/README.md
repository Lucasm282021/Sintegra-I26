# sebasTPV

Esta carpeta reúne archivos de despliegue para servir el frontend del sistema TPV con Nginx dentro de Docker. No contiene el código fuente de la aplicación: el `Dockerfile` espera encontrar `package.json`, `package-lock.json` y el código del frontend en su contexto de build.

## Contenido

- `frontend/Dockerfile`: construye la aplicación con Node.js 24 (`npm ci` y `npm run build`) y copia el resultado de `dist/` a una imagen de Nginx Alpine. Expone el puerto 8080. Usa el contexto de build adicional llamado `deploy` para copiar los archivos de configuración desde `/docker/frontend/`.
- `frontend/40-tpv-config.sh`: script de inicio de Nginx. Requiere `API_BASE_URL`, valida que use `http://` o `https://` y genera `/usr/share/nginx/html/config.js` con la URL del backend.
- `frontend/default.conf.template`: configuración de Nginx. Escucha en el puerto indicado por `PORT`, responde `ok` en `/health` y redirige rutas de la aplicación al `index.html` para permitir navegación del lado del cliente.
- `frontend/Dockerfile.dockerignore`: excluye del contexto Git, dependencias instaladas, archivos generados, variables de entorno y cachés de TypeScript.

## Configuración requerida

Al iniciar el contenedor, define `API_BASE_URL` con la dirección pública del backend. Debe comenzar con `http://` o `https://` y solo puede contener letras, números, puntos, barras, dos puntos, guiones bajos y guiones. Define también `PORT` para indicar el puerto en el que Nginx debe escuchar.

El `Dockerfile` debe construirse usando como contexto principal la raíz del proyecto frontend (donde están `package.json` y el código fuente), y un contexto adicional llamado `deploy` cuya raíz contenga `docker/frontend/40-tpv-config.sh` y `docker/frontend/default.conf.template`.
