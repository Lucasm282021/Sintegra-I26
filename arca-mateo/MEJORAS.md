# Mejoras — ARCA de Teo y Keving: que funcione como la ARCA de verdad

## Qué hay hoy

ARCA está publicada en <https://arca-mateo.vercel.app> y ya tiene el diseño unificado del ecosistema. Hoy hace cuatro cosas:

- **Consultar contribuyente**: busca un CUIT en un padrón que tiene solo 2 CUIT escritos en el código.
- **Emitir comprobante**: Factura A, B o C con número correlativo y CAE ficticio. El `id_venta` evita duplicados.
- **Consultar comprobante** por número, tipo y punto de venta.
- **Usuarios y roles** (superadmin, admin, usuario), con ingreso propio de ARCA.

Está muy bien resuelto el ingreso, los roles y la emisión idempotente. Lo que falta es todo lo que pasa **antes** de facturar: en la ARCA real nadie puede emitir una factura sin estar inscripto.

## El cambio de fondo: ARCA es la dueña del padrón **fiscal**

> **Actualización 29/10:** este documento se corrigió para alinearlo con el [prompt maestro del ecosistema](../doc/PROMPT-MAESTRO-ECOSISTEMA.md). Antes decía que ARCA daba de alta a los comercios: no es así.

Hay que separar dos cosas:

- **La identidad del comercio** (quién es, sus sucursales, sus usuarios) la registra **una sola vez** el **CORE de comercios** del ecosistema, en el portal: <https://sintegrai26.vercel.app/comercios/>. ARCA **no** tiene que tener un formulario de alta de comercios: eso crearía una identidad paralela.
- **La situación fiscal** (CUIT, condición frente al IVA, régimen, actividades, puntos de venta, comprobantes) es de **ARCA**. Eso es lo que ustedes construyen.

El CORE le pregunta a ARCA por cada comercio y muestra el resultado (verificado, observado, no disponible) con fecha y evidencia. Los demás sistemas también dependen del padrón fiscal de ARCA:

- **ARBA** inscribe en Ingresos Brutos a quien ya tiene CUIT.
- **Banco** abre cuentas solo a CUIT existentes.
- **Municipio** habilita comercios con CUIT.
- **TPV** elige el tipo de factura según la condición frente al IVA del comercio y del cliente.

Por eso el padrón no puede vivir dentro de la app de ARCA. Vive en la base compartida del backend único (`padron.contribuyentes` y el esquema `arca` en Supabase). Ustedes construyen las pantallas; la cátedra agrega al backend los endpoints que figuran más abajo.

## Qué falta, sección por sección

### 1. Inscripción de contribuyente (CUIT)

Es la pantalla principal que falta. Es la **inscripción fiscal** ante ARCA, no el alta del comercio: un comercio registrado en el CORE que todavía no figura en ARCA aparece como "observado" hasta que ARCA lo inscribe. Pide:

| Persona humana | Persona jurídica |
|---|---|
| Apellido y nombres | Razón social |
| DNI | Tipo de sociedad (SA, SRL, SAS, cooperativa…) |
| Fecha de nacimiento | Fecha del contrato social |
| Sexo registral (para el prefijo del CUIT) | Datos de registro (IGJ / DPPJ) |

Y para los dos: domicilio fiscal, actividad principal (código y descripción), fecha de inicio de actividades y correo para el Domicilio Fiscal Electrónico.

**Generación del CUIT** (como la real):

- Prefijo: `20` (masculino), `27` (femenino), `23` (cuando hace falta, por ejemplo sin sexo registral), `30` (sociedades), `33` (casos especiales de sociedades).
- Luego el DNI de 8 dígitos (con ceros a la izquierda). Para las sociedades, ARCA asigna un número.
- Al final, el dígito verificador por **módulo 11**: se multiplican los 10 dígitos por `5 4 3 2 7 6 5 4 3 2`, se suma y se calcula `11 − (suma % 11)`. Si da 11, el dígito es 0. Si da 10, el prefijo cambia a `23` y se recalcula.
- La pantalla tiene que **validar el dígito verificador** en todos los campos de CUIT del sistema, no solo que tenga 11 números.

### 2. Inscripción en impuestos (régimen)

Después del alta, el contribuyente elige su régimen:

- **Monotributo**: se elige la categoría (A a K) según la facturación anual estimada. Usen una tabla de categorías **ficticia**, con montos de ejemplo definidos por ustedes, y aclárenlo en pantalla.
- **Responsable Inscripto**: se inscribe en IVA y Ganancias.
- **Exento** (IVA).

Tiene que haber **recategorización** (cambiar de categoría de monotributo), **cambio de régimen** (de Monotributo a Responsable Inscripto) e **historial** de los cambios con fecha.

### 3. Constancia de inscripción

Es la consulta pública más usada de ARCA. Al ingresar un CUIT, muestra razón social, condición frente al IVA, régimen, categoría de monotributo, actividades, domicilio fiscal y estado. Necesita un botón de **imprimir/descargar** con el aviso de simulación académica y una fecha de emisión.

### 4. Gestión del padrón

- Listado con buscador por CUIT o nombre y filtros por estado y régimen.
- Ficha de cada contribuyente con todos sus datos y su historial.
- **Modificación de datos**: domicilio, actividades, correo.
- **Estados**: activo, suspendido, baja. Un contribuyente dado de baja no puede facturar.
- Auditoría: quién cambió qué y cuándo. Ya tienen roles, úsenlos para esto.

### 5. Puntos de venta

En la ARCA real, cada contribuyente da de alta sus puntos de venta antes de facturar (el número de PV, el sistema de emisión y el domicilio). Hoy el punto de venta es fijo para toda la instancia (`ARCA_PUNTO_VENTA=00001`). Tiene que pasar a ser **por contribuyente**:

- Alta, baja y listado de puntos de venta de cada CUIT.
- Al emitir, se elige el punto de venta. La numeración es correlativa por CUIT, punto de venta y tipo de comprobante.

### 6. Facturación como la real

- **Tipo de comprobante automático** según emisor y receptor:

  | Emisor | Receptor | Comprobante |
  |---|---|---|
  | Responsable Inscripto | Responsable Inscripto | Factura A (IVA discriminado) |
  | Responsable Inscripto | Monotributista, Exento o Consumidor Final | Factura B |
  | Monotributista | Cualquiera | Factura C |

- **Receptor**: CUIT (validado contra el padrón) o DNI para consumidor final.
- **Ítems** con cantidad, precio unitario y alícuota de IVA (21 %, 10,5 %, 27 %, 0 %). En la Factura A, el IVA se muestra discriminado.
- **Notas de crédito y de débito** asociadas a una factura (para anular o corregir).
- **CAE** de 14 dígitos con **fecha de vencimiento** (10 días). Mantengan el prefijo `FICTICIO-` visible.
- **Código QR** en el comprobante, como el que exige ARCA, con los datos del comprobante y marcado como ficticio.
- Vista **imprimible** del comprobante.
- Bloquear la emisión si el emisor no está activo o no tiene el punto de venta dado de alta.

### 7. Mis comprobantes

Como el servicio real: listado de comprobantes **emitidos** y **recibidos** por CUIT, con filtros por fecha, tipo y punto de venta, y totales por período.

### 8. Panel de inicio

Resumen para el administrador: altas del mes, contribuyentes por régimen, comprobantes emitidos hoy, total facturado y últimas operaciones.

## Contrato con el backend único

Estos endpoints **ya existen** en <https://sintegra-backend.vercel.app> y leen la base compartida:

- `GET /arca/contribuyentes/{cuit}` → condición fiscal
- `POST /arca/contribuyentes` → inscripción en el padrón fiscal sandbox (`cuit` con dígito verificador válido, `razon_social`, `condicion_iva`, `tipo_persona`, `domicilio_fiscal`). Recibe el CUIT ya calculado: la generación del CUIT la hace la pantalla de ustedes.
- `GET /arca/puntos-venta?cuit=` y `POST /arca/puntos-venta` → listar y dar de alta puntos de venta (`cuit`, `punto_venta`, `tipos_comprobante` opcional)
- `POST /arca/comprobantes` → emite (acepta `id_venta`, `cuit` emisor, `monto_total`, `tipo_comprobante`, `receptor_cuit`, `punto_venta`)
- `GET /arca/comprobantes?cuit=` → comprobantes de un emisor
- `GET /padron/contribuyentes/{cuit}` → ficha con lo que sabe cada sistema (ARBA, Banco, Municipio, Billetera)

Estos son los que **faltan** y va a agregar la cátedra. Si necesitan otros campos, propónganlos en un issue antes de construir la pantalla:

| Método y ruta | Para qué |
|---|---|
| `GET /arca/contribuyentes?buscar=&estado=&regimen=&page=` | Listado del padrón |
| `PATCH /arca/contribuyentes/{cuit}` | Modificar datos |
| `POST /arca/contribuyentes/{cuit}/estado` | Suspender, dar de baja o reactivar |
| `POST /arca/contribuyentes/{cuit}/regimen` | Inscripción, recategorización o cambio de régimen |
| `GET /arca/contribuyentes/{cuit}/constancia` | Datos de la constancia de inscripción |
| `DELETE /arca/puntos-venta/{cuit}/{pv}` | Baja de un punto de venta |
| `POST /arca/comprobantes/{id}/nota-credito` | Nota de crédito sobre una factura |
| `GET /arca/comprobantes?receptor=` | Comprobantes recibidos |

## Reglas que no cambian

- Contrato común: JSON, campos en `snake_case`, CUIT como string de 11 dígitos sin guiones, errores como `{"error": "mensaje"}`.
- `id_venta` sigue siendo la clave de idempotencia de cada comprobante.
- **Nada es real**: los CAE, CUIT y montos son ficticios. El aviso de simulación académica queda visible en todas las pantallas y en lo que se imprime.
- Diseño unificado del ecosistema (`consolidacion/UNIFICACION-DISENO.md` en el repo Sintegra-I26): colores de marca, menú lateral, foco visible y uso desde el celular.
- No se usan contraseñas ni datos personales reales en las pruebas.

## Orden sugerido

1. Validación de CUIT con dígito verificador (sirve para todo lo demás).
2. Inscripción fiscal del CUIT y constancia de inscripción.
3. Gestión del padrón y estados.
4. Régimen: monotributo, responsable inscripto y exento.
5. Puntos de venta por contribuyente.
6. Facturación completa (tipo automático, ítems, IVA, notas de crédito, QR).
7. Mis comprobantes y panel de inicio.

## Prompt para tu agente de IA

```
Trabajo en el módulo ARCA de un ecosistema fintech académico simulado
(ISFDyT N° 26). La app ya está publicada: frontend en HTML, CSS y JS nativos
en public/, servidor Express en src/server.js, ingreso con roles
(superadmin, admin, usuario), emisión de facturas A/B/C con CAE ficticio y
consulta de comprobantes. Ya tiene el diseño unificado del ecosistema.

Quiero que funcione como la ARCA real, en versión simulada. Agregá estas
pantallas sin rehacer lo que ya funciona:

1. Inscripción fiscal (persona humana o jurídica) con generación de CUIT:
   prefijo 20/27/23/30/33 + DNI o número asignado + dígito verificador por
   módulo 11 (pesos 5 4 3 2 7 6 5 4 3 2; 11 → 0; 10 → prefijo 23 y recalcular).
   Validá el dígito verificador en todos los campos de CUIT.
2. Inscripción en régimen: Monotributo (categorías A–K con una tabla de
   montos ficticia), Responsable Inscripto o Exento; recategorización,
   cambio de régimen e historial.
3. Constancia de inscripción imprimible por CUIT.
4. Gestión del padrón: listado con buscador y filtros, ficha, modificación
   de datos, estados (activo/suspendido/baja) y auditoría por usuario.
5. Puntos de venta por contribuyente (alta, baja, listado); la numeración es
   correlativa por CUIT + punto de venta + tipo.
6. Facturación: tipo automático según emisor y receptor (RI→RI: A;
   RI→otros: B; Monotributo: C), receptor por CUIT o DNI, ítems con IVA
   21/10,5/27/0 (discriminado en la A), notas de crédito y débito, CAE de 14
   dígitos con vencimiento a 10 días y prefijo FICTICIO-, QR marcado como
   ficticio y vista imprimible. No se emite si el emisor no está activo.
7. Mis comprobantes (emitidos y recibidos) y panel de inicio con resumen.

Reglas:
- No construyas un alta de comercios: la identidad del comercio la registra
  el CORE del ecosistema (portal /comercios). ARCA hace la inscripción
  fiscal del CUIT y todo lo fiscal.
- El padrón fiscal vive en el backend único de la cátedra
  (https://sintegra-backend.vercel.app), no en esta app. Usá
  GET y POST /arca/contribuyentes, GET y POST /arca/puntos-venta,
  POST y GET /arca/comprobantes y GET /padron/contribuyentes/{cuit}, que ya
  existen. Para lo que falta (listado, modificación, estado, régimen,
  constancia, baja de puntos de venta, notas de crédito, comprobantes
  recibidos), armá la pantalla contra el
  contrato de MEJORAS.md con datos de ejemplo detrás de una sola capa de
  servicios (public/api.js), así después solo cambiamos la URL.
- Contrato común: JSON, snake_case, CUIT string de 11 dígitos, errores
  {"error": "mensaje"}, id_venta idempotente.
- Todo es ficticio; el aviso de simulación queda visible en pantallas e
  impresiones. Nada de datos personales ni contraseñas reales.
- Respetá el diseño actual (colores de marca, menú lateral, foco visible,
  uso en celular).
- Antes de empezar, leé el README y MEJORAS.md y proponeme un plan por
  etapas siguiendo el orden sugerido. Avanzá de a una etapa y mostrame cómo
  probarla.
```
