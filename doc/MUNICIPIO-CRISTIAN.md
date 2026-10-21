# Documentación del Módulo: Municipio
**Responsable:** Cristian Fernando Mendiburu

## 1. Propósito del Módulo
El módulo "Municipio" es el encargado de gestionar las habilitaciones comerciales dentro del Ecosistema Fintech (Sintegra i26). Actúa como la entidad gubernamental local que valida si un comercio (identificado por su CUIT) está legalmente habilitado para operar y permite registrar el pago de la Tasa de Seguridad e Higiene (TSyH).

## 2. Estado Actual (Frontend y Backend)
- **Backend (API):** Desarrollado en Node.js con Express y SQLite. Se ejecuta en el puerto `3005` y cumple estrictamente con el contrato fundacional (Idempotencia, validación de CUIT de 11 dígitos, formato YYYY-MM).
- **Frontend (Dashboard):** Maquetado generado con IA (v0.dev / React + Tailwind CSS). Incluye panel de gestión de comercios, barra de búsqueda, modo claro/oscuro y formulario modal para nuevas habilitaciones.
- **Despliegue:** Preparado para contenedor Docker y probado en Vercel.

## 3. Endpoints Expuestos (Contrato)
El módulo respeta el contrato común y expone las siguientes rutas en `http://localhost:3005`:
- `POST /municipio/comercios`: Alta de habilitación comercial.
- `GET /municipio/comercios/{cuit}`: Verifica habilitación.
- `POST /municipio/tributos/pagos`: Registra pago de Tasa (TSyH).
- `GET /municipio/tributos/{cuit}`: Consulta de deuda de TSyH.
- `GET /health`: Chequeo de salud del servicio (`{"status": "ok", "servicio": "municipio"}`).

## 4. Estructura de la Carpeta (`municipio-cristian`)
- `/frontend`: Código del panel de administración en React (Next.js).
- `server.js`: Lógica principal de la API y base de datos en memoria/SQLite.
- `Dockerfile` y `compose.yaml`: Configuración de contenerización.
- `PROXIMOS-PASOS.md`: Checklist de progreso del alumno.