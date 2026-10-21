# Módulo Billetera Virtual — Lucas-M

Módulo del ecosistema fintech simulado que administra **billeteras virtuales**:
cuentas de dinero digital para personas/comercios, con carga de saldo, pagos
hacia comercios y registro de movimientos. Es el **6° módulo** del ecosistema
y corre en el **puerto 3006**, respetando el contrato común definido en
`docs/handbook-ecosistema-fintech.html`.

## Stack tecnológico

Decisión tomada buscando coherencia con los demás módulos del ecosistema
(la integración es por HTTP REST + JSON, pero se prioriza unificar el
ecosistema de herramientas con lo que ya eligieron otros equipos):

| Capa | Elección |
|---|---|
| Runtime | Node.js 24 (LTS) |
| Framework HTTP | Express |
| Base de datos | SQLite (node:sqlite, built-in de Node), archivo propio del módulo |
| Contenedor | Docker, imagen `node:24-alpine` |
| Puerto | 3006 |

## Entidades

- **Billetera**: id, titular, cuit, alias, saldo (entero, en pesos), fecha de alta.
- **Movimiento**: id, tipo (`carga` / `pago` / `cobro`), monto, contraparte, saldo resultante, fecha.

## Endpoints

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/billetera/cuentas` | Crea una billetera (201) |
| GET | `/billetera/cuentas/{id}` | Datos y saldo de una billetera |
| GET | `/billetera/cuentas/{id}/movimientos` | Últimos 50 movimientos |
| POST | `/billetera/cargas` | Acredita saldo (por cuit + monto) |
| POST | `/billetera/pagos` | Debita saldo hacia un comercio (por cuit + monto) |

Contrato común: `application/json`, cuit como string de 11 dígitos sin puntos
ni guiones, éxito con 200/201 + recurso, errores con `{"error": "mensaje"}`
y status 4xx/5xx.

## Cómo ejecutar (local)

```bash
npm install
npm start          # escucha en http://localhost:3006
```

## Cómo ejecutar (Docker)

```bash
docker build -t billetera-virtual .
docker run -p 3006:3006 billetera-virtual
```

## Variables de entorno

| Variable | Default | Descripción |
|---|---|---|
| `PORT` | `3006` | Puerto HTTP del servicio |
| `DB_PATH` | `./billetera.db` | Ruta del archivo SQLite |

## Ejemplos con curl

```bash
# Crear billetera
curl -X POST localhost:3006/billetera/cuentas -H "Content-Type: application/json" \
  -d '{"titular":"Almacén Don Mateo","cuit":"30712345679","alias":"almacen.mateo.mp"}'

# Cargar saldo
curl -X POST localhost:3006/billetera/cargas -H "Content-Type: application/json" \
  -d '{"cuit":"30712345679","monto":50000}'

# Pagar a un comercio
curl -X POST localhost:3006/billetera/pagos -H "Content-Type: application/json" \
  -d '{"cuit":"30712345679","monto":9000,"comercio_cuit":"30112233445"}'

# Consultar saldo y movimientos
curl localhost:3006/billetera/cuentas/1
curl localhost:3006/billetera/cuentas/1/movimientos
```

## Pendiente

- [ ] Integración con `BANCO /banco/pagos` (puerto 3002) para respaldar la billetera en una cuenta bancaria real del ecosistema
- [ ] Integración con `TPV` para pagar ventas directamente desde la billetera
- [ ] Pruebas cruzadas con los otros módulos
- [ ] Sumarse al `docker-compose.yml` de la integración final
