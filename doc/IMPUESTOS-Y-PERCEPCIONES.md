# Impuestos en la venta: IVA, percepción de IIBB y Tasa de Seguridad e Higiene

**Fecha:** 2026-10-29 · **Alcance:** simulación académica. Las alícuotas son **de prueba** y no corresponden a normas vigentes. Ningún comprobante tiene validez fiscal.

Cada organismo configura lo suyo y el TPV calcula la venta con esos valores. La configuración se hace por API o en la consola del portal: <https://sintegrai26.vercel.app/fiscal/>.

## 1. ARCA · IVA y tipo de comprobante

- **El precio del catálogo es el precio final** al público.
- Cada producto tiene su IVA (`iva`): `21`, `10.5`, `27`, `0` o `exento`. Por defecto, `21`.
- **Solo un Responsable Inscripto discrimina IVA.** Neto = precio / (1 + alícuota); IVA = precio − neto. Monotributo y Exento no discriminan.
- **Tipo de comprobante** según quién vende y quién compra:

| Emisor | Receptor | Comprobante |
|---|---|---|
| Responsable Inscripto | Responsable Inscripto | **Factura A** (IVA discriminado) |
| Responsable Inscripto | Monotributo, Exento o Consumidor final | **Factura B** |
| Monotributo o Exento | Cualquiera | **Factura C** |

- El comprobante guarda `neto`, `iva_total`, `exento`, `iva_detalle` (base e importe por alícuota), `receptor_cuit` y `receptor_condicion`.
- El punto de venta tiene que estar dado de alta en ARCA para el tipo que corresponda (un RI necesita A y B).

**Configurar:** `POST /tpv/productos` y `PUT /tpv/productos/:id` con `iva`.

## 2. ARBA · Percepción de Ingresos Brutos

En la realidad, la percepción la aplica un comercio **designado agente** por ARBA, al **comprador**, con la alícuota que ARBA le asigna a ese comprador en su padrón. Así funciona acá:

1. **El comercio tiene que ser agente vigente** (`arba.agentes`): activo, dentro de su vigencia e inscripto en IIBB. Si no lo es, la venta no lleva percepción.
2. **El comprador tiene que estar identificado con su CUIT** (`cuit_cliente` en la venta). Una venta a consumidor final sin CUIT no lleva percepción.
3. **Base imponible = neto sin IVA** (más lo exento).
4. **Monto mínimo:** si la base no lo supera, no se percibe.
5. **Alícuota:** la del comprador en el padrón de ARBA (`arba.inscripciones`). Si el comprador no figura, se usa la **alícuota para no inscriptos**.
6. Cada percepción guarda el agente, el comprador (`sujeto_cuit`), la base, la alícuota y su origen (`padron` o `no_inscripto`). La respuesta de la venta incluye el **motivo** cuando no se percibe.

**Configurar:**

| Qué | Endpoint |
|---|---|
| Designar, dar de baja o cambiar la vigencia de un agente | `PUT /arba/agentes/:cuit` `{activo, vigente_desde, vigente_hasta}` · `GET /arba/agentes` |
| Alícuota para no inscriptos y monto mínimo | `PUT /arba/config-percepcion` `{alicuota_no_inscriptos, monto_minimo}` · `GET` |
| Alícuota de un contribuyente en el padrón | `PUT /arba/padron/:cuit` `{alicuota}` |
| Simular sin registrar | `GET /arba/percepciones/simular?agente=&sujeto=&base=` |

**Valores iniciales (prueba):** agente: Almacén Don Mateo (`30712345678`); no inscriptos: 5 %; mínimo: $500.

## 3. Municipio · Tasa de Seguridad e Higiene

No se cobra venta por venta: **se liquida por período** sobre lo facturado en el mes (neto + exento), con la alícuota del rubro de la habilitación (o la general `*`) y un mínimo.

| Qué | Endpoint |
|---|---|
| Alícuota y mínimo por rubro | `PUT /municipio/alicuotas/:rubro` `{alicuota, minimo}` · `GET /municipio/alicuotas` |
| Liquidar el período | `POST /municipio/tributos/liquidar` `{cuit, periodo: "AAAA-MM"}` → crea o actualiza la tasa pendiente; `409` si ya está pagada |

El pago sigue siendo `POST /municipio/tributos/pagos` (debita la cuenta bancaria del comercio).

## Ejemplo

Almacén Don Mateo (RI, agente) vende $12.100 de productos con IVA 21 % a Juan Pérez (monotributista, padrón ARBA 2 %):

| Concepto | Importe |
|---|---|
| Neto | $10.000,00 |
| IVA 21 % | $2.100,00 |
| Precio de los productos | $12.100,00 |
| Percepción IIBB 2 % (sobre el neto) | $200,00 |
| **Total cobrado** | **$12.300,00** |

Comprobante: **Factura B**. Si el comprador fuera Kiosco La Esquina (RI), sería **Factura A** con IVA discriminado y percepción del 3 %. Sin CUIT de comprador: Factura B, sin percepción, total $12.100.

## Qué tiene que hacer cada TPV

- Enviar `cuit_cliente` cuando el comprador se identifica (es obligatorio si paga con Billetera).
- Mostrar el desglose que devuelve la venta en `impuestos`: tipo de comprobante, neto, IVA, percepción y su motivo.
- Usar `iva` al cargar productos.

## Pruebas

`backend/test/impuestos.test.js`: IVA con alícuotas mixtas y exento, tipo de comprobante, percepción con el padrón del comprador, no inscriptos con configuración cambiada a mano, mínimo, consumidor final, agente dado de baja, IVA por producto y liquidación municipal.
