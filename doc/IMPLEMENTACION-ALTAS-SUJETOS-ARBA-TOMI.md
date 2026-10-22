# Sincronización de altas de sujetos — ARBA-TOMI

**Alumno:** Tomás Díaz (`tomasdiaz2007`)
**Proyecto:** Sintegra I26 · módulo ARBA-TOMI
**Fecha:** 21 de octubre de 2026

## Alcance

Se sincronizó la implementación de la carpeta principal `arba` con el módulo `arba-tomi` integrado en Sintegra-I26. La sincronización conserva el prototipo y los documentos existentes dentro de `arba-tomi/docs`.

## Cambios incluidos

- Separación entre usuarios del panel (`admin`, `convencional`) y sujetos del padrón (`persona_humana`, `persona_juridica`).
- Inicio y cierre de sesión con cookie firmada; contraseñas almacenadas con scrypt.
- Alta guiada, borradores, envío a revisión, aprobación, observación y configuración operativa.
- Rutas protegidas por sesión y rol para sujetos, usuarios y auditoría.
- Persistencia Demo de cuentas ficticias, sujetos y auditoría.
- Bloqueo de percepciones para altas sin aprobación/activación y aplicación `arba_iibb` habilitada.
- Migraciones aditivas de SQLite, variables de entorno de desarrollo y pruebas nuevas.

La aplicación sigue siendo educativa: no consulta organismos fiscales ni formaliza inscripciones. Las alícuotas y cuentas Demo son ficticias.

## Actualización de interfaz

- Se simplificó el panel con navegación lateral y vistas diferenciadas por rol: inicio, gestión de sujetos, usuarios, auditoría, percepciones y consulta del padrón.
- Se centró el inicio de sesión en la pantalla completa, sin reservar espacio para la navegación lateral.
- Se retiraron de las vistas de usuario las rutas, respuestas HTTP, JSON y detalles de conexión. Se conservaron los flujos de alta, revisión, administración, consulta y simulación.
- El flujo de alta continúa en tres pasos y el administrador conserva la configuración operativa de sujetos aprobados.
- La compilación de producción se verificó con `npm run build`.

## Ramas

- Carpeta principal `arba`: rama `master` del repositorio `arba_tomi_fintech`.
- Módulo integrado `Sintegra-I26/arba-tomi`: rama `main` del repositorio Sintegra-I26.

## Verificación

En el módulo sincronizado, `npm test` pasó con 13/13 pruebas y `npm run build` completó correctamente. La revisión de whitespace con `git diff --check` no encontró errores.

## Autoría

Trabajo realizado por **Tomás Díaz (`tomasdiaz2007`)** para reconocimiento académico.
