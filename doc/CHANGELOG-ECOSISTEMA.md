# Changelog del ecosistema Sintegra I26

Qué se conserva, modifica, reemplaza, depreca o elimina en cada entrega. Lo anterior al 2026-10-29 está en [AVANCES-UNIFICACION.md](AVANCES-UNIFICACION.md).

## 2026-10-30 — Prueba real: padrón general, compras, cheques, eCheq y homebanking

### Agregado
- Migraciones `20261030000018_precios_efectivo_cheques.sql` y `20261030000019_echeq_homebanking.sql` (solo agregan; aplicadas en Supabase).
- **Padrón general** `GET /padron/general?buscar=` y `/padron/general/:cuit`: ARCA + comercios del CORE pendientes de inscripción, con estado en ARBA, Municipio, Banco y Billetera. Lo usan ARCA (Mateo, pestaña «Padrón general»), ARBA (Lucas, alta), Municipio (Cristian, alta y pendientes), Banco (apertura de cuenta) y TPV Brisa (proveedores).
- **TPV**: precio desde costo + % de ganancia + IVA (`costo`, `margen`, `iva`); cobro en **efectivo** (factura y percepción sin movimiento bancario).
- **Compras a proveedores** (`backend/src/modulos/compras.js`) y pantalla «Compras» en TPV Brisa. Ver [COMPRAS-Y-PROVEEDORES.md](COMPRAS-Y-PROVEEDORES.md).
- **Banco**: caja de ahorro y cuenta corriente; cheques (emitir, depositar, clearing, rechazo por fondos, pago diferido, anular). Ver [BANCO-Y-CHEQUES.md](BANCO-Y-CHEQUES.md).
- **Billetera**: transferir por CUIT, alias o CBU y **eCheq** (emitir, cobrar, anular).
- **Homebanking** (`public/homebanking/`): cada cliente entra con su CUIT y la clave demo `demo1234`.
- Scripts: `respaldar.js`, `limpiar-prueba-real.js` (con simulacro) y `sembrar-prueba-real.js`.
- Suite: 48/48.

### Modificado
- Municipio exige que el CUIT esté inscripto en ARCA (409 si no).
- ARBA (Tomi) con `ARBA_BACKEND_URL`: rechaza CUIT no inscriptos en ARCA y sincroniza el padrón IIBB común.
- TPV David: comercio por defecto 20268326074 (Comercio i26).
- Banco y Homebanking: diálogos con colores legibles; el botón Cancelar cierra sin enviar.

### Datos de producción
- Respaldo completo fuera del repo: `C:/PROYECTOS 2026/fintech segundo/respaldos/2026-10-30-antes-prueba-real` (436 filas). Se borraron los datos de prueba (incluidos «Lucina», «Vanina» y el QA).
- Quedan **Mauricio Sistisisti · Comercio i26 · 20268326074** (Responsable Inscripto, agente ARBA, TPV Brisa y David) y **Kiosco Ficticio Monotributo · 27401260264** (TPV Sebastián); clientes demo Ana, Marcos y Laura (30000000001-3) con caja de ahorro.
- Verificado en producción: venta Brisa por banco (Factura B + percepción), Sebastián en efectivo (Factura C), David con billetera, transferencia de billetera, eCheq acreditado y homebanking.

## 2026-10-29 (cierre) — Integración real de TPV David y ARCA de Mateo

### Agregado
- Migración `20261029000017_tpv_medio_detalle.sql`: medio de pago real de cada venta. Solo agrega.
- `GET /tpv/ventas?detalle=1` (líneas, comprobante, percepción y cliente) y `GET /arca/comprobantes/:numero`.
- La venta acepta la cuenta de quien paga por id, CBU o alias; su titular queda como comprador.
- `backend/scripts/e2e-integracion.js`: recorrido completo; 20/20 en local y en producción.
- [MAPA-INTEGRACION.md](MAPA-INTEGRACION.md): qué usa cada app y dónde quedan sus datos.

### Modificado
- **TPV David**: con `TPV_BACKEND_URL`, su catálogo, comercios y ventas viven en la base común y la venta usa el motor común (IVA, percepción, factura). Se respetaron sus interfaces de repositorio; sin la variable funciona como antes. La pantalla pide el CUIT del cliente como opcional.
- **ARCA (Mateo)**: con `ARCA_BACKEND_URL`, consulta el padrón fiscal común y emite/busca comprobantes en el ARCA común (numeración compartida con los TPV). Usuarios y sesiones siguen siendo suyos.
- **TPV Brisa**: la cuenta de quien paga se indica por alias o CBU.
- **TPV Sebastián**: deja de mostrar una percepción estimada fija del 3 %; se calcula al cobrar.
- Suite: 40/40.
- TPV David limpia espacios y saltos de línea en `TPV_TERMINAL_ID` y otras variables: la cargada en Vercel tenía `david
` y el backend no reconocía la terminal.
- Publicado y verificado en producción: venta en TPV David (Factura A, percepción 3 %, medio transferencia) y emisión en ARCA de Mateo con numeración compartida.

## 2026-10-29 (noche) — Gestión de cuentas en el Banco y visitas guiadas

### Agregado
- Migración `20261029000016_banco_operaciones.sql`: tipos de movimiento `deposito` y `extraccion`, y la caja de efectivo del banco (`cuenta-caja`). Solo amplía.
- Banco: `POST /banco/cuentas/:id/depositos`, `POST /banco/cuentas/:id/extracciones` y `POST /banco/transferencias` (destino por id, CBU o alias), idempotentes por `id_operacion`. 3 pruebas nuevas; suite 38/38.
- Panel del Banco (`public/banco/`): botón "Abrir cuenta" y, en cada cuenta, Depositar, Extraer y Transferir.
- Visitas guiadas con Driver.js en las 12 pantallas del ecosistema (botón "¿Cómo se usa?"). Ver [VISITAS-GUIADAS.md](VISITAS-GUIADAS.md).

## 2026-10-29 (tarde) — Impuestos configurables y solo modo real

### Agregado
- Migración `20261029000015_impuestos_configurables.sql`: IVA por producto, comprobante con neto/IVA/receptor, agentes de percepción, parámetros del régimen, datos de la percepción (sujeto, base, origen) y alícuotas municipales por rubro. Solo agrega.
- Motor `backend/src/modulos/impuestos.js` y su uso en `POST /tpv/ventas`: IVA, tipo A/B/C según emisor y receptor, percepción con agente + padrón del comprador + mínimo.
- ARBA: `/arba/agentes`, `/arba/config-percepcion`, `/arba/percepciones/simular`. Municipio: `/municipio/alicuotas`, `/municipio/tributos/liquidar`. TPV: `iva` en productos.
- Consola `public/fiscal/` (simulador de venta y configuración de ARBA, ARCA y Municipio) y [IMPUESTOS-Y-PERCEPCIONES.md](IMPUESTOS-Y-PERCEPCIONES.md).
- `backend/test/impuestos.test.js` (7 pruebas). Suite: 35/35.

### Modificado
- **La percepción ya no se aplica a todas las ventas con la alícuota del vendedor.** Ahora solo si el comercio es agente vigente y el comprador se identifica con CUIT. Una venta a consumidor final sin CUIT no lleva percepción.
- Las pruebas de venta existentes se ajustaron a esta regla.
- ARBA Lucas y ARBA Tomi: se quitó el modo "Demo" (motor en el navegador); trabajan siempre contra la API. ARBA Lucas se volvió a publicar: la versión anterior no respondía su API.

## 2026-10-29 — CORE de comercios (Fases B y C del prompt maestro)

### Agregado
- **Esquema `core`** (migración `20261029000013_core_comercios.sql`): comercios con `commerce_id`, sucursales, usuarios, membresías, integraciones, verificaciones con evidencia y eventos. Función `core.cuit_dv_valido`.
- **Importación** de los comercios que ya operaban en Municipio, ARBA, ARCA o TPV, con una sucursal “Casa central”. Los CUIT demo con dígito verificador inválido quedan `observado`.
- **Usuario demo de la cátedra** (migración `…014`): `demo.comercios.i26@gmail.com`, titular de los comercios importados.
- **Módulo `/core`** en el backend: usuarios y sesiones, alta única, solicitud y aprobación de acceso, panel de estado, verificaciones sandbox y manuales, sucursales, vínculo con Banco y activación del TPV con requisitos.
- **Asistente web** `public/comercios/`: ingreso, alta en 3 pasos, panel de estado y botones para simular cada trámite en su organismo.
- `POST /arca/contribuyentes` (inscripción sandbox), `POST /banco/cuentas` (apertura de cuenta), `POST /municipio/comercios/:cuit/resolucion` (resolución simulada).
- `npm run dev:memoria`: backend local sobre PGlite.
- Documentos: arquitectura, flujo de alta, contratos, matriz de propiedad de datos, plan de migración y pruebas.
- 14 pruebas nuevas (`backend/test/core.test.js`); suite total 28/28.

### Modificado (compatible)
- `POST /municipio/comercios`: si el CUIT ya existe en el padrón fiscal se reutiliza sin pisarlo; `409` solo si ya hay trámite.
- `tpv.js`: la vinculación de comercio se extrajo a `vincularComercio()`; la ruta `POST /tpv/comercios` responde igual.
- `banco.js`: nueva función `abrirCuenta()`.
- `app.js`: CORS admite `Authorization` y `PATCH`; los errores pueden incluir detalle (por ejemplo, `faltantes`).

### Deprecado
- Crear un CUIT desde Municipio. Lo hace ARCA; la identidad del comercio la registra el CORE.

### Conservado
- Todos los esquemas, tablas y datos existentes. Ninguna migración borra datos.

### Validado antes de esta entrega
- Trabajo de Codex sin guardar (PV obligatorio, CAE ficticio, altas municipales pendientes, billetera provista por Banco, TPV Sebastián con cuenta de cobro, ARBA Lucas contra el backend único): 14/14 pruebas y builds correctos; guardado en 6 commits.
- Limpieza de `banco-m`: se quitó un panel HTML incompleto y módulos de ingreso sin uso.

### Publicado (2026-10-29, con OK del docente)
- Migraciones `…011` a `…014` aplicadas en Supabase con `npm run migrar`. El CORE importó 4 comercios (Almacén Don Mateo, Kiosco La Esquina, Juan Pérez y Taller El Rayo), cada uno con el titular demo; 3 quedaron `observado` por CUIT demo con DV inválido.
- Backend publicado en <https://sintegra-backend.vercel.app> con `CORE_AUTH_SECRET` en Vercel. Verificado: `/health` lista `core`, ingreso demo, `/core/yo` y `401` sin sesión.
- Portal publicado: <https://sintegrai26.vercel.app/comercios/> y tarjeta "Comercios · Alta única" en la página de inicio. Verificado en el navegador con el usuario demo.

### Pendiente
- Banco Boreal (`banco-m`, React + Prisma) no se publicó: usa una base propia (`banco_m`) paralela al Banco del backend único. Según el [plan de migración](PLAN-MIGRACION.md) (etapa 3), primero tiene que operar sobre `banco.*`; si no, habría dos libros de saldos distintos.
