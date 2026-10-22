# Informe técnico — Módulo ARBA de Nehemías

**Proyecto:** Sintegra I26  
**Autor:** Nehemías Luque  
**Tipo de entrega:** Parcial académico  
**Estado:** Versión de demostración; no es una integración fiscal oficial.

## 1. Objetivo

Implementar de forma individual un módulo web para consultar un padrón ficticio de Ingresos Brutos, administrar comercios de prueba y calcular percepciones asociadas a ventas. El frontend y el backend están juntos dentro de `arba-nehemías`, pero se ejecutan como dos aplicaciones separadas.

## 2. Tecnologías y ejecución

- **Backend:** Node.js y Express, puerto `3003`.
- **Frontend:** React y Vite, puerto `5173`.
- **Persistencia de esta versión:** archivo local `backend/data/db.json` (se crea al primer inicio).
- **Inicio local:** en la carpeta del backend, `npm ci` y `npm start`; en otra terminal, dentro de `frontend`, `npm install` y `npm run dev`; abrir `http://localhost:5173`.
- Vite reenvía las solicitudes del navegador al backend local.

## 3. Alcance funcional

- Consultar el padrón ficticio y buscar un CUIT.
- Crear, actualizar y dar de baja comercios de prueba desde la pantalla administrativa.
- Calcular percepciones en el servidor usando el importe en centavos y la alícuota vigente de demostración.
- Consultar el historial de percepciones por CUIT.
- Evitar duplicados por `sale_id`: la primera operación devuelve `201`, el mismo reintento devuelve `200` y una repetición con contenido diferente devuelve `409`.
- Mantener las rutas antiguas mientras la interfaz individual migra al contrato nuevo.

## 4. Contrato API

Las rutas versionadas se publican bajo `/api/v1/arba`:

| Método y ruta | Función |
|---|---|
| `GET /health` | Estado del servicio |
| `GET /padron?page&limit` | Consulta paginada del padrón |
| `GET /padron/:cuit` | Consulta de inscripción y tasa aplicable |
| `GET /inscripciones-iibb/:cuit` | Consulta explícita de inscripción IIBB |
| `GET/POST /comercios` | Consulta y alta de perfil comercial |
| `PUT/DELETE /comercios/:cuit` | Edición y baja del perfil comercial |
| `POST /inscripciones-iibb` | Alta de inscripción de demostración separada del perfil |
| `PUT/DELETE /inscripciones-iibb/:cuit` | Modificación o baja lógica de inscripción simulada |
| `POST /percepciones` | Cálculo de percepción con tasa resuelta por el backend |
| `GET /percepciones/:cuit` | Historial por CUIT |

Para una percepción se envían `sale_id`, `cuit` (o `commerce_id`), `base_amount_minor` y `currency`. Los centavos se representan como enteros; por ejemplo, `$10.000,00` se envía como `1000000` con `currency: "ARS"`. La respuesta conserva la venta, el comercio, la tasa aplicada, la versión de tasa, su fecha de vigencia, la fuente, la base y el importe calculado.

## 5. Modelo de datos

La persistencia separa cuatro colecciones:

- `comercios`: perfil e identificador comercial.
- `inscripciones_iibb`: jurisdicción, estado, actividad y condición de demostración.
- `alicuotas`: valores versionados con fechas de vigencia y fuente.
- `percepciones`: operación única por venta, montos enteros en centavos, tasa aplicada y referencia de versión.

El archivo previo se migra automáticamente al nuevo esquema cuando se inicia el backend. Se conservan las percepciones anteriores y los datos migrados se identifican como heredados de demostración cuando no tenían una fuente disponible.

## 6. Datos académicos

El padrón inicial contiene cinco filas ficticias. `AR-B` se usa como código de jurisdicción de Buenos Aires; las actividades `DEMO-01` a `DEMO-05`, los CUIT, las razones sociales y las tasas son datos inventados para la simulación, no códigos ni tasas oficiales. La fecha inicial de vigencia de la semilla es `2026-01-01`. La aplicación informa que guardar un comercio no certifica una inscripción ante ARBA.

## 7. Pruebas y límites

Las rutas antiguas conservaron los escenarios manuales de la versión individual: salud, consulta, cálculo, reintento, conflicto, CUIT inexistente y administración de registros. La interfaz usa ahora las rutas versionadas para consulta, cálculo e historial. El cambio de contrato y la nueva presentación todavía requieren una ejecución manual en la máquina de entrega antes de incorporarlos a la solicitud de revisión.

Pendiente: autenticación y permisos por rol, integración con TPV, pruebas de Docker e integración con la implementación elegida por el equipo. Docker Desktop no estuvo disponible en el entorno de entrega. Esta persistencia JSON es local y no debe convertirse en padrón compartido de producción.

## 8. Referencia de integración

El documento `AJUSTE-ARBA.md` del repositorio del equipo recomienda `arba-tomi` como implementación de referencia común. Este módulo conserva una implementación separada para el parcial de Nehemías y sigue el contrato propuesto en lo posible, pero su desarrollo no significa que se haya elegido como padrón principal del ecosistema. Las dos versiones no deben operar como dueñas del mismo padrón compartido.
