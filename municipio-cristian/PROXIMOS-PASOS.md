# Próximos pasos — Cristian Mendiburu (módulo Municipio)

## Estado actual
Servicio MUNICIPIO implementado con Node.js, Express y SQLite. Expone los cuatro endpoints del contrato en el puerto 3005. Tiene Dockerfile y configuración de Docker Compose para construir, iniciar, vigilar y reiniciar el contenedor, con persistencia de SQLite en un volumen.

Nota: la carpeta original de este proyecto se llamaba `: cristian_mendiburu` (con dos puntos al inicio), una ruta inválida en Windows. Ya se corrigió a `alumnos/cristian-mendiburu/` y se arregló también un problema de encoding en las tildes del README.

## Tareas concretas
- [X] Definir la estructura de la base de datos (Comercio habilitado, Tributo).
- [X] Levantar el servicio en el puerto **3005**.
- [X] Implementar `POST /municipio/comercios` — da de alta la habilitación comercial de un comercio.
- [X] Implementar `GET /municipio/comercios/{cuit}` — verifica si un comercio está habilitado.
- [X] Implementar `POST /municipio/tributos/pagos` — registra el pago de una tasa municipal (TSyH).
- [X] Implementar `GET /municipio/tributos/{cuit}` — consulta la deuda de un comercio.
- [X] Agregar Dockerfile y documentar variables de entorno en el README.
- [X] Configurar Docker Compose, chequeo de salud y volumen persistente para SQLite.
- [X] Construir y levantar la imagen localmente con Docker Desktop activo.
- [X] Probar los endpoints desde otro módulo y completar validación de entradas.

## Contrato común a respetar
- JSON en request y response.
- `cuit` siempre como string, sin puntos ni guiones.
- Errores: `{"error": "mensaje"}` con status 4xx/5xx.
- A diferencia de ARBA (que percibe por venta), Municipio cobra tasas **por período**, no por operación.

## Prompt para tu agente de IA

```
Estoy construyendo el módulo MUNICIPIO de un ecosistema fintech simulado para
una materia de la Tecnicatura Superior en Desarrollo de Software. El
ecosistema tiene 6 módulos que se integran por API REST: TPV, BANCO, ARBA,
ARCA, MUNICIPIO y BILLETERA, cada uno con su propia base de datos.

Mi módulo (MUNICIPIO) representa al gobierno local. Antes de poder vender, un
comercio tiene que darse de alta ante el municipio (habilitación comercial) y,
después, pagar periódicamente sus tasas municipales — a diferencia de ARBA,
que percibe IIBB por cada venta, yo cobro tasas por período, no por operación.

Entidades:
- Comercio habilitado: cuit, rubro, domicilio, fecha de alta
- Tributo: tipo (TSyH — Tasa de Seguridad e Higiene), período (ej. "2026-09"),
  monto, estado (pagado / pendiente)

Endpoints que tengo que exponer:
- POST /municipio/comercios — da de alta la habilitación de un comercio
- GET /municipio/comercios/{cuit} — verifica si está habilitado
- POST /municipio/tributos/pagos — registra el pago de una tasa
- GET /municipio/tributos/{cuit} — consulta la deuda pendiente

Reglas del contrato común del ecosistema:
- JSON en request y response.
- El cuit siempre viaja como string, sin puntos ni guiones.
- Errores: {"error": "mensaje"} con status HTTP 4xx/5xx.
- Mi puerto asignado es el 3005.

Todavía no tengo código, solo el diseño de arriba. Ayudame a levantar el
servicio (Node.js + Express + SQLite es una buena opción simple para
arrancar) con los 4 endpoints, una base de datos con las dos tablas, datos
de prueba (2 o 3 comercios habilitados con tasas pagadas y pendientes), y el
Dockerfile. Empecemos por POST /municipio/comercios y GET /municipio/comercios/{cuit}
funcionando standalone.
```
