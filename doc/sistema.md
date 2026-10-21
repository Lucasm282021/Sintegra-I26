# Sintegra I26

## Qué es

Sintegra I26 es la propuesta de un sistema integral para coordinar una venta de comercio con los servicios fiscales, municipales y de pago del ecosistema fintech del curso. El punto de venta (TPV) inicia la operación y se comunica con los módulos mediante API HTTP y JSON.

El sistema busca reunir el circuito en una operación trazable: validar el comercio, calcular la percepción de Ingresos Brutos, cobrar por un medio elegido y emitir un comprobante simulado.

> **Alcance académico:** los datos, alícuotas, pagos y comprobantes pertenecen a una simulación. No representan una liquidación fiscal ni reemplazan servicios oficiales de ARBA, ARCA, bancos o municipios.

## Qué resuelve

- Centraliza el inicio de una venta desde el TPV.
- Mantiene un catálogo de productos y sus precios para calcular los importes en el servidor.
- Coordina la habilitación comercial, la percepción provincial, el cobro y la emisión del comprobante.
- Registra el estado y las referencias de cada etapa para consultar el resultado y recuperar operaciones incompletas.
- Permite integrar cada módulo por API sin que un servicio acceda directamente a la base de datos de otro.

## Módulos del ecosistema

| Módulo | Responsabilidad prevista |
|---|---|
| **TPV** | Administra el catálogo y coordina la venta de punta a punta. Calcula los importes a partir de sus precios. |
| **Municipio** | Informa si el comercio está habilitado. La gestión de tasas se realiza por período, no como un cargo adicional en cada venta. |
| **ARBA** | Consulta el padrón de ejemplo y calcula la percepción de IIBB para la venta. Las alícuotas de prueba son configurables y ficticias. |
| **Banco** | Procesa el pago simulado entre la cuenta del cliente y la del comercio. |
| **Billetera** | Ofrece un medio de pago alternativo al Banco. Se usa uno solo por venta. |
| **ARCA** | Emite un comprobante de prueba con CAE ficticio. No se conecta a servicios fiscales reales. |

Cada servicio mantiene sus propios datos y expone las rutas acordadas en el contrato común del curso.

## Cómo funciona una venta

1. El operador carga los productos y cantidades en el TPV.
2. El TPV busca los precios vigentes en su catálogo y calcula el subtotal. No toma como confiables los precios ni el total que pudiera enviar la interfaz.
3. El TPV valida con Municipio que el comercio esté habilitado.
4. Solicita a ARBA el cálculo de la percepción usando el identificador de venta.
5. Cobra el total mediante **Banco o Billetera**, según la opción elegida.
6. Cuando el pago está confirmado, solicita a ARCA el comprobante con el total y el desglose acordados.
7. Guarda el resultado y los identificadores devueltos por los servicios, y muestra el estado de la venta.

El monto total incluye el subtotal más la percepción aplicable. Los importes se expresan en pesos con hasta dos decimales.

## Usuarios

- **Operador/a de caja:** registra la venta, selecciona el medio de pago y consulta el resultado.
- **Responsable del comercio:** puede mantener el catálogo si esa función se incluye en la entrega del TPV.
- **Servicios del ecosistema:** consumen las APIs para intercambiar datos de la operación.
- **Cliente:** participa del pago y recibe el comprobante; no requiere un panel propio en el alcance inicial.

La autenticación y los permisos no forman parte del contrato mínimo del TPV. Se agregan solo si la cátedra los solicita.

## Componentes del TPV

1. **Interfaz de caja:** búsqueda de productos, carrito, confirmación y resultado.
2. **API del TPV:** registra y consulta ventas.
3. **Catálogo:** conserva productos, precios y disponibilidad.
4. **Coordinador:** llama a Municipio, ARBA, Banco o Billetera y ARCA.
5. **Persistencia propia:** guarda ventas, estados, líneas e identificadores externos.
6. **Clientes HTTP:** configuran las direcciones de los otros servicios mediante variables de entorno.

## Estados y recuperación

La venta debe conservar un identificador único (`id_venta`) para evitar duplicados al reintentar. Si una integración falla, el TPV registra la etapa alcanzada y deja la operación pendiente o con error recuperable. Un nuevo intento continúa desde la etapa pendiente y reutiliza los resultados ya confirmados.

Un servicio caído o con timeout nunca debe convertirse en un pago, percepción o comprobante exitoso inventado por el TPV. La interfaz debe mostrar con claridad que la operación está pendiente o necesita revisión.

## Contrato de integración del TPV

- `GET /health`: indica que el servicio está disponible.
- `POST /tpv/ventas`: inicia una venta con `id_venta`, `comercio_cuit`, productos (`producto_id` y `cantidad`) y un `medio_pago`.
- `GET /tpv/ventas/{id}`: devuelve el estado y el detalle de una venta, incluyendo líneas, subtotal, percepción, total, pago y comprobante.
- Las respuestas usan JSON. Los errores siguen el formato `{"error":"mensaje"}` y un estado HTTP adecuado.
- El servicio corre en el puerto interno `3001`; la configuración local puede mapear cada implementación a un puerto de host distinto.

Los nombres y campos concretos de cada servicio externo deben seguir el contrato fundacional del curso. Un cambio incompatible requiere acuerdo antes de implementarse.

## Estado actual del repositorio

Este documento describe la arquitectura objetivo; no es un inventario actualizado de implementaciones. En el checkout actual hay servicios y frontends de ARBA, Municipio y Billetera, además de archivos de despliegue de TPV. Banco y ARCA todavía no tienen backend en este repositorio. El estado, las diferencias entre contratos y las tareas por aplicación están en el [informe de unificación](INFORME-UNIFICACION-APPS.md) y sus [ajustes por módulo](#ajustes-de-contrato-por-aplicacion).

## Ajustes de contrato por aplicación

- [ARBA](AJUSTE-ARBA.md)
- [Municipio](AJUSTE-MUNICIPIO.md)
- [Billetera](AJUSTE-BILLETERA.md)
- [TPV](AJUSTE-TPV.md)
- [Banco](AJUSTE-BANCO.md)
- [ARCA](AJUSTE-ARCA.md)
