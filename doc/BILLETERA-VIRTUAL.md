# Documentación de la Billetera Virtual

## Propósito y alcance

La Billetera Virtual es un módulo del ecosistema fintech simulado. Permite crear billeteras para personas o comercios, consultar saldo y movimientos, cargar saldo y realizar pagos a comercios. También incluye una interfaz web para administrar una cuenta y un flujo de pago mediante QR.

El módulo es académico: los saldos, cargas, pagos e integraciones son simulados y no representan dinero real ni se conectan con servicios financieros oficiales.

## Tecnologías y ejecución

- Node.js 24, Express 4 y SQLite mediante `node:sqlite` (`DatabaseSync`).
- La aplicación web usa HTML, CSS y JavaScript nativo, servidos por Express desde `public/`.
- El servicio escucha en el puerto `3006` por defecto. Desde `Billetera - Lucas M`, ejecutar `npm start`.
- `PORT` permite cambiar el puerto y `DB_PATH` la ruta del archivo SQLite. La base predeterminada es `billetera.db` en la raíz del módulo.
- El `Dockerfile` usa `node:24-alpine` y expone el puerto `3006`.

## Organización del código

```text
Billetera - Lucas M/
├── src/
│   ├── server.js       # API REST, validaciones e integración opcional con Banco
│   └── db.js           # Apertura de SQLite y creación de tablas
├── public/
│   ├── index.html      # Interfaz de la billetera
│   ├── app.js          # Navegación, formularios, movimientos y pagos QR
│   └── styles.css      # Estilos adaptables
├── Dockerfile
└── package.json
```

## Interfaz y recorridos

La pantalla de acceso solicita el ID de una billetera existente; también permite crear una nueva. Una vez seleccionada la cuenta, el panel muestra saldo, titular, alias, CUIT y fecha de alta, además de los últimos movimientos. La interfaz permite cambiar de cuenta, cargar saldo, pagar a un comercio y pagar con QR. El ID de la última cuenta activa se conserva en `localStorage` (`billeteraCuentaActiva`).

La selección de cuenta se hace por ID porque la API no ofrece un endpoint para listar billeteras. El acceso por ID es una facilidad de demostración, no autenticación ni control de identidad.

## API implementada

Todas las solicitudes y respuestas usan JSON. El CUIT se envía como string de 11 dígitos sin puntos ni guiones; los montos deben ser enteros positivos en pesos. Los errores tienen el formato `{"error":"mensaje"}`.

| Operación | Ruta | Comportamiento |
| --- | --- | --- |
| Crear billetera | `POST /billetera/cuentas` | Recibe `{ titular, cuit, alias }`; devuelve la cuenta con `201`. CUIT o alias duplicados producen `409`. |
| Consultar billetera | `GET /billetera/cuentas/{id}` | Devuelve datos y saldo; responde `404` si no existe. |
| Consultar movimientos | `GET /billetera/cuentas/{id}/movimientos` | Devuelve hasta los últimos 50 movimientos, del más reciente al más antiguo. |
| Cargar saldo | `POST /billetera/cargas` | Recibe `{ cuit, monto }`; acredita y registra una carga. Devuelve la billetera actualizada con `201`. |
| Pagar | `POST /billetera/pagos` | Recibe `{ cuit, monto, comercio_cuit?, descripcion? }`; debita saldo y registra el movimiento. Devuelve la billetera actualizada con `201`. |

Las cargas y pagos requieren una billetera asociada al CUIT (`404` si no existe). Si el saldo es insuficiente, el pago responde `400`. Una referencia enviada como `descripcion` requiere `comercio_cuit` válido y no puede reutilizarse: un duplicado responde `409`.

## Persistencia

SQLite mantiene tres tablas:

- `billeteras`: titular, CUIT único, alias único, saldo entero y fecha de alta.
- `movimientos`: tipo (`carga`, `pago` o `cobro`), monto, contraparte, saldo resultante y fecha.
- `pagos_referencias`: referencia única, billetera, monto y CUIT del comercio para impedir repetir pagos identificados.

SQLite opera con journal en modo WAL. La base y sus archivos WAL son locales al módulo y están excluidos del control de versiones.

## Integración opcional con Banco

Si se configura `BANCO_URL`, al solicitar una carga la Billetera primero envía `POST {BANCO_URL}/banco/pagos` con `{ cuit, monto, tipo: "carga_billetera", billetera_id, alias }`. Solo después de una respuesta HTTP exitosa acredita el saldo local y registra el movimiento. Si el Banco rechaza la operación o no responde, la API de Billetera devuelve `502` y no acredita el saldo.

Sin `BANCO_URL`, la carga se acredita directamente en la base local como operación de demostración. La carga no usa una transacción distribuida ni una clave de idempotencia compartida con Banco; el contrato del endpoint bancario debe acordarse con el módulo Banco antes de integrar ambos servicios.

## Pago con QR

La interfaz acepta un QR por cámara cuando el navegador ofrece `getUserMedia` y `BarcodeDetector`, o permite pegar su contenido como JSON. El formato v1 esperado es:

```json
{
  "version": 1,
  "tipo": "pago_billetera",
  "comercio_cuit": "30112233445",
  "comercio": "Almacén Don Mateo",
  "monto": 9000,
  "referencia": "VENTA-123"
}
```

La interfaz valida versión, tipo, CUIT del comercio, nombre, monto entero positivo y referencia. Luego muestra un resumen y espera confirmación explícita. Al confirmar, llama a `POST /billetera/pagos`, usando el CUIT de la cuenta activa y la referencia como `descripcion`. La API evita referencias repetidas. El QR no inicia un débito sin confirmación.

## Estado y consideraciones para cambios

- El servidor expone los endpoints descritos y sirve la interfaz estática en ejecución local.
- `npm start` requiere Node.js 24 por el uso de `node:sqlite` y de `fetch` global.
- El `Dockerfile` actual copia `src/`, pero no copia `public/`; por eso el contenedor no incluye los archivos de la interfaz aunque Express intente servirlos. Para desplegar la UI en Docker, hay que incluir `public/` en la imagen.
- El README de la aplicación describe QR e integración con Banco como pendientes en algunas secciones; el código actual ya implementa la validación/confirmación del QR y la llamada opcional a Banco descritas arriba.
- Mantener los montos como enteros positivos y el CUIT como string para evitar pérdida de ceros iniciales.
- Al cambiar los contratos de pago con QR o Banco, coordinar los campos y respuestas con TPV y Banco, respectivamente.
- Esta aplicación no implementa autenticación: el ID de billetera no debe tratarse como credencial segura.
