# Accesos demo por aplicación

Referencia para el entorno académico Sintegra I26. Los usuarios y datos listados son ficticios. Las credenciales visibles en interfaces sirven para facilitar demostraciones y **no deben usarse en producción**.

## Aplicaciones con acceso demo agregado

| Aplicación | Usuario demo | Clave demo | Tipo de acceso |
| --- | --- | --- | --- |
| Municipio · Cristian | `demo.municipio.i26@gmail.com` | `MuniDemo2026` | Puerta de acceso de interfaz; sesión limitada a la pestaña del navegador. |
| TPV · Sebastián | `demo.tpv.sebastian.i26@gmail.com` | `TpvSebas2026` | Puerta de acceso de interfaz; sesión limitada a la pestaña del navegador. |
| TPV · Brisa | `demo.tpv.brisa.i26@gmail.com` | `BrisaDemo2026` | Puerta de acceso de interfaz; bloquea la carga del módulo hasta ingresar. |
| Banco M · Rodrigo (panel del portal) | `demo.banco.rodrigo.i26@gmail.com` | `BancoDemo2026` | Puerta de acceso de interfaz; bloquea la consulta de cuentas hasta ingresar. |
| Banco M · Rodrigo (frontend React) | `demo.banco.rodrigo.i26@gmail.com` | `BancoDemo2026` | Puerta demo de interfaz antes del identificador CUIT de la cuenta. |

Las cuatro claves se definieron por aplicación, son fáciles de identificar durante una clase y no se reutilizan entre módulos (Banco M representa una sola app con dos interfaces). La pantalla replica el patrón visual de la referencia: fondo claro, tarjeta blanca, encabezado de bienvenida, campos de correo y clave, acción principal y recordatorio de credenciales.

## Aplicaciones que ya tenían inicio de sesión

No se agregó una segunda puerta a estos módulos:

| Aplicación | Acceso de referencia | Nota |
| --- | --- | --- |
| ARBA · Tomi | `demo.arba.i26@gmail.com` / `ArbaDemo2026` | Acceso demo declarado en el motor local. En el backend desplegado, la cuenta administradora se aprovisiona con `ADMIN_EMAIL` y `ADMIN_PASSWORD`; revisar que esté creada allí. |
| ARBA · Lucas | `admin@arba.demo` / `admin123` (administración); `operador@arba.demo` / `operador123` (operación) | Autenticación simulada del frontend, almacenada en el navegador. |
| ARCA · Mateo | `demo.arca.i26@gmail.com` / `ArcaDemo2026` | Cuenta demo del servicio académico; mantenerla fuera de servicios fiscales reales. |
| Billetera · Lucas | CUIL `20268326074` / `demo1234` (Cátedra); CUIL `30000000001`, `30000000002` o `30000000003` / `demo1234` (clientes demo) | Login de billetera por identificador fiscal y contraseña. No es acceso por correo. |

## Alcance y seguridad

- Los accesos agregados a Municipio, TPV Sebastián, Brisa y Banco M son puertas de interfaz para las demos. Sus credenciales están en el JavaScript del cliente, por lo que cualquier usuario técnico puede inspeccionarlas o eludirlas.
- La sesión demo usa `sessionStorage`: se conserva al recargar la pestaña y se cierra al terminar esa sesión del navegador.
- En Banco M y Brisa, el frontend espera el ingreso para empezar a consultar datos. Esto mejora el flujo de demo, pero **no protege la API**: los endpoints compartidos siguen siendo accesibles según sus propias reglas.
- En Banco M React, el CUIT sigue identificando la cuenta que muestra la app. El ingreso demo no constituye autenticación bancaria ni limita autorización por titular.
- No guardar información real, claves personales ni datos productivos en este entorno. Para producción hacen falta autenticación y autorización en backend, sesiones seguras, usuarios aprovisionados y políticas de acceso por rol/CUIT.

## Proyectos sin pantalla web de usuario

`tpv-david` ofrece principalmente el servicio/API TPV y no se identificó una aplicación de usuario final que requiera un formulario de acceso. La API debe protegerse desde el backend cuando se defina su modelo de autenticación. Los archivos comprimidos o repositorios que no contienen una interfaz ejecutable no reciben usuarios hasta confirmar su aplicación.

## Archivos modificados para la puerta demo

- Municipio: `municipio-cristian/frontend/src/components/DemoLoginGate.tsx`, `src/main.tsx`, `src/index.css`.
- TPV Sebastián: `sebasTPV/tpv-frontend/src/App.jsx`.
- Banco M React: `banco-m/frontend/src/screens/LoginScreen.tsx`.
- Brisa: `brisa/src/Tpv.Api/wwwroot/` y copia publicada `public/brisa/`.
- Banco M del portal: `public/banco/`.
