# Próximos pasos — Sebastián (módulo TPV)

## Estado actual
Documento de arquitectura muy completo (Clean Architecture, stack NestJS/React, roadmap de 8 sprints) + diseño en Figma (`bar.fig`). Sin código todavía.

## Tareas concretas
- [ ] Coordinar con David (también en TPV) para no construir el mismo módulo por separado — definan juntos quién codea qué.
- [ ] Empezar por el **Sprint 1 de tu propio roadmap**: arquitectura del proyecto + Docker, antes de sumar todas las capas de Clean Architecture de una vez.
- [ ] Implementar primero `POST /tpv/ventas` funcionando standalone, con datos de prueba — recién después sumar la integración con Banco/ARBA/ARCA.
- [ ] Definir el modelo de datos real (Comercio, Venta, DetalleVenta, Producto) en Prisma/PostgreSQL como propusiste.
- [ ] Usar el archivo `bar.fig` como guía visual al construir el frontend en React/Next.js.
- [ ] Ajustar el roadmap de 8 sprints a un cronograma real con fechas.

## Contrato común a respetar
- JSON en request y response.
- `cuit` siempre como string, sin puntos ni guiones.
- Errores: `{"error": "mensaje"}` con status 4xx/5xx.
- Puerto asignado: **3001**.

## Prompt para tu agente de IA

```
Estoy construyendo el módulo TPV de un ecosistema fintech simulado para una
materia de la Tecnicatura Superior en Desarrollo de Software. Ya armé un
documento de arquitectura completo proponiendo Clean Architecture con NestJS +
TypeScript + Prisma + PostgreSQL en el backend, y React + Next.js + Tailwind
en el frontend, con un roadmap de 8 sprints (1. Arquitectura y Docker, 2. Base
de datos, 3. CRUD Productos, 4. CRUD Comercios, 5. Módulo de Ventas, 6.
Integración Banco, 7. Integración ARBA/ARCA, 8. Testing y documentación).

El ecosistema tiene 6 módulos que se integran por API REST: TPV, BANCO, ARBA,
ARCA, MUNICIPIO y BILLETERA. Mi puerto asignado es el 3001.

Reglas del contrato común entre todos los módulos:
- JSON en request y response.
- El cuit siempre viaja como string, sin puntos ni guiones.
- Errores: {"error": "mensaje"} con status HTTP 4xx/5xx.
- Éxito: status 200/201 + el recurso creado o consultado.

Endpoints que tengo que exponer:
- POST /tpv/ventas — registra una venta y dispara el cobro (BANCO), el cálculo
  de percepción (ARBA) y la facturación (ARCA).
- GET /tpv/ventas/{id} — devuelve el detalle de una venta.

Quiero arrancar por el Sprint 1: la arquitectura base del proyecto NestJS con
la estructura de carpetas que definí (modules/ventas, productos, clientes,
comercios, pagos) y el Dockerfile. Ayudame a scaffoldearlo y después a
implementar POST /tpv/ventas funcionando standalone con datos de prueba, antes
de integrar con los otros módulos.
```
