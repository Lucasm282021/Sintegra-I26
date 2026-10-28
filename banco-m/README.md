# banco-m — Módulo Bancario / Billetera Virtual

Parte del sistema i26sintegra. Gestiona cuentas virtuales vinculadas por CUIT con CBU y alias propios, movimientos auditados y transferencias entre cuentas.

## Setup

1. Copiar variables de entorno:
   cp .env.example .env
   # Editar .env con tu DATABASE_URL

2. Instalar dependencias:
   npm install

3. Crear la base de datos:
   npm run db:push

4. Iniciar en desarrollo:
   npm run dev

## Endpoints principales

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | /api/cuentas | Crear cuenta por CUIT |
| GET | /api/cuentas/:cuit | Obtener cuenta |
| GET | /api/cuentas/:cuit/saldo | Consultar saldo |
| GET | /api/cuentas/cbu/:cbu | Buscar por CBU |
| GET | /api/cuentas/alias/:alias | Buscar por alias |
| PATCH | /api/cuentas/:cuit/activar | Activar/desactivar |
| POST | /api/movimientos/deposito | Registrar depósito |
| POST | /api/movimientos/debito | Registrar débito |
| GET | /api/movimientos/:cuentaId | Listar movimientos |
| POST | /api/transferencias | Transferir entre cuentas |
| GET | /api/transferencias/:cuentaId | Listar transferencias |
| GET | /api/health | Estado del servicio |

## Integración con i26sintegra

- Los movimientos tienen campo `origen` para identificar si vienen de ARBA, ARCA o Municipalidad
- El campo `referencia` guarda el ID externo del sistema origen
- Se vincula por CUIT con el resto del sistema
