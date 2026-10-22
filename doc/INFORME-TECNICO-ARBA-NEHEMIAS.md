\# Informe técnico — Módulo ARBA



\*\*Responsable:\*\* Nehemías

\*\*Proyecto:\*\* Sintegra I26

\*\*Estado:\*\* En desarrollo



\## Objetivo



El módulo ARBA simula la consulta de un padrón de comercios y calcula percepciones de Ingresos Brutos (IIBB) sobre ventas, usando la alícuota registrada para cada CUIT.



\## Estructura del módulo



\- `arba-nehemias/backend`: API con Node.js y Express.

\- `arba-nehemias/frontend`: interfaz con React y Vite.

\- `doc/INFORME-TECNICO-ARBA-NEHEMIAS.md`: este informe.



\## Backend



El servidor escucha en el puerto `3003` y ofrece:



\- `GET /health`: consulta el estado del servicio.

\- `GET /arba/padron/:cuit`: consulta un CUIT del padrón.

\- `GET /arba/comercios?page=1\\\\\\\\\\\\\\\&limit=5`: lista comercios con paginación.

\- Rutas para registrar, editar y dar de baja comercios.

\- `POST /arba/percepciones`: calcula y registra una percepción.

\- `GET /arba/percepciones/:cuit`: consulta percepciones de un CUIT.



El cálculo probado fue una venta de `$10.000` con alícuota `0,03` (3%), que da una percepción de `$300`.



Si se repite la misma solicitud con el mismo `id\\\\\\\\\\\\\\\_venta`, el servicio devuelve el registro existente. Si se reutiliza el `id\\\\\\\\\\\\\\\_venta` con datos diferentes, responde con HTTP `409`.



\## Frontend



Interfaz desarrollada con React y Vite. Permite consultar el padrón, administrar comercios, registrar percepciones y revisar el historial.



\## Pruebas manuales realizadas



\- `/health` respondió correctamente.

\- El CUIT `20345678901` devolvió la actividad “Comercio minorista” y alícuota `0,03`.

\- Una venta de `$10.000` calculó `$300` de percepción.

\- El reintento idéntico devolvió el mismo registro.

\- Reutilizar el `id\\\\\\\\\\\\\\\_venta` con otro importe devolvió HTTP `409`.

\- Un CUIT no registrado devolvió HTTP `404`.

\- Se probó desde la interfaz el alta, edición y baja de un comercio.



\## Ejecución local



Backend, desde la carpeta `backend`:



1\. Ejecutar `npm ci`.

2\. Ejecutar `npm start`.



Frontend, desde la carpeta `frontend`:



1\. Ejecutar `npm install`.

2\. Ejecutar `npm run dev`.

3\. Abrir la dirección local que muestra Vite, normalmente `http://localhost:5173/`.



\## Pendiente



\- Implementar el inicio de sesión y los permisos para usuario, administrador y superadministrador.

\- Probar la integración con TPV.

\- Probar Docker cuando la virtualización del equipo esté disponible.

\- Publicar el frontend para compartirlo mediante un enlace.



\## Alcance de los datos



Los CUIT, comercios y alícuotas usados son datos de prueba para una simulación académica. No son información fiscal oficial.

