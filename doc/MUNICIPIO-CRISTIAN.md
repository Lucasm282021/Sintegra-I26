# Documentación del Módulo: Municipio
**Responsable:** Cristian Fernando Mendiburu

## 1. Propósito del Módulo
El módulo "Municipio" es el encargado de gestionar el padrón de comercios y la cobranza de tributos dentro del Ecosistema Fintech (Sintegra i26). Actúa como la entidad gubernamental que habilita a los comercios (identificados por su CUIT) para operar, gestiona las cuentas corrientes y permite registrar el pago de la Tasa de Seguridad e Higiene (TISH) y Conservación de la Vía Pública, además de emitir Certificados de Libre Deuda.

## 2. Estado Actual (Frontend y Backend)
- **Backend (API):** Desarrollado en Node.js con Express y SQLite. Se ejecuta en el puerto `3005` y expone las rutas base. Pendiente de ajuste a la API Unificada v1.
- **Frontend (Dashboard Profesional):** Proyecto completo generado con IA Studio (React + Vite + TypeScript + Tailwind CSS).
  - Incluye Mock Store en memoria (`municipioService.ts`) que simula la API REST completa con latencia.
  - Implementa 4 vistas: Padrón de Comercios, Cuentas Corrientes y Tasas, Comprobantes/Certificados, e Inspector de Tráfico API en tiempo real.
  - Datos Semilla (Seed Data) configurados para pruebas inmediatas sin necesidad de carga manual.
- **Despliegue:** Preparado para contenedor Docker.

## 3. Endpoints Simulados en el Frontend (Mock Store)
El frontend actualmente simula el contrato de la API unificada de la siguiente manera:
- `GET /health`: Estado del servicio (Status 200).
- `POST /municipio/comercios`: Alta de comercio. Si es exitosa (201), genera 3 períodos de deuda automática. Valida CUIT repetido (409).
- `GET /municipio/comercios/{cuit}`: Datos y estado de habilitación.
- `GET /municipio/tributos/{cuit}`: Desglose de deuda por período.
- `POST /municipio/tributos/pagos`: Registro de pago. Si el período ya está pago, retorna 409. Si es exitoso, genera comprobante.
- `GET /municipio/certificados/libre-deuda/{cuit}`: Emite certificado solo si la deuda total es $0.

## 4. Estructura de la Carpeta (`municipio-cristian`)
- `/frontend`: Proyecto React/Vite completo con TypeScript y Tailwind.
- `server.js`: Lógica principal de la API backend.
- `municipio.db`: Base de datos SQLite.
- `Dockerfile` y `compose.yaml`: Configuración de contenerización.
- `PROXIMOS-PASOS.md`: Checklist de avance.