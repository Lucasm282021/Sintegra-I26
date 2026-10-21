# Alta simplificada de contribuyentes y comercios

Material de referencia para el agente de desarrollo de Tomás. Incluye el análisis del formulario actual y el prototipo navegable `alta-comercio-simplificada.html`.

## Propósito

Registrar una ficha inicial clara para persona humana o jurídica, con datos que permitan identificar al sujeto, su actividad y su alcance territorial. El alta en este sistema académico no equivale a una inscripción efectiva en ARBA o ARCA.

## Cambios propuestos frente al formulario actual

- Preguntar primero si el titular es persona humana o jurídica y adaptar etiquetas/campos.
- Separar identidad o denominación legal del nombre de fantasía.
- Mantener CUIT como texto de 11 dígitos y validar formato. La validación visual del prototipo no confirma que la CUIT exista ni que pertenezca a la persona declarada.
- Elegir actividad desde un nomenclador y guardar su código; distinguir actividad principal y secundarias.
- Registrar fecha de inicio, domicilio fiscal y domicilios donde se desarrolla la actividad.
- Preguntar provincias de operación para identificar cuándo revisar Convenio Multilateral.
- No permitir que una carga común determine una alícuota arbitraria. La tasa debe provenir de configuración fiscal vigente y validada; este prototipo deja explícito que requiere consulta.
- Distinguir estado operativo interno de inscripción fiscal confirmada. Guardar para cada estado la fuente y fecha de consulta cuando exista integración.
- Añadir información de contacto y, para sociedades, forma jurídica, representante y datos registrales como etapa ampliada.

## Flujo sugerido

1. **Identificación:** tipo de titular, CUIT y nombre legal.
2. **Actividad y alcance:** actividad principal, inicio y jurisdicciones.
3. **Domicilio:** domicilio fiscal y al menos un domicilio de actividad en Provincia de Buenos Aires; partido y partida cuando corresponda al trámite.
4. **Revisión:** mostrar resumen, advertencias y datos aún pendientes de validar antes de crear o enviar el alta.

La carga inicial puede ser corta y dejar datos jurídicos ampliados en una sección posterior. No marcar automáticamente ARBA/IIBB o ARCA/Facturación como activos por el solo hecho de guardar el formulario.

## Campos ampliados a considerar

### Persona humana

Apellido y nombre legal, tipo y número de documento cuando el trámite lo requiera, domicilio real/fiscal, contacto y representante/apoderado si corresponde.

### Persona jurídica

Forma jurídica, denominación legal, fecha de constitución, vigencia, objeto, jurisdicción, domicilio legal/fiscal, fecha de cierre, representante y acreditación, datos registrales y composición societaria cuando aplique.

## Alcance del prototipo

El HTML es una maqueta interactiva e independiente: adapta algunos campos al tipo de titular, valida datos básicos en el navegador y genera una vista de revisión. **No persiste información, no consulta padrones, no asigna alícuotas ni se conecta con organismos.** Para integrarlo a la aplicación hay que ampliar el contrato de API y el esquema de persistencia; actualmente el servicio guarda CUIT, razón social, actividad, alícuota, estado y aplicaciones.

## Referencias oficiales consultadas

- [ARBA: inscripción directa en Ingresos Brutos](https://www.arba.gov.ar/GuiaTramites/TramiteSeleccionado.asp?tramite=232) — identificación, actividad y domicilios; partido/partida para actividad y sucursales.
- [ARBA: quién debe inscribirse](https://web.arba.gov.ar/preguntas-frecuentes/que-grava-el-impuesto-sobre-los-ingresos-brutos-quien-le-corresponde) — actividad gravada y Convenio Multilateral cuando opera en más de una jurisdicción.
- [ARCA: inscripción de personas jurídicas](https://arca.gob.ar/regimenGeneral/inscripcion/personas-juridicas/) — forma, constitución, objeto, domicilios, contacto y composición societaria.
- [ARCA: inscripción de personas humanas](https://arca.gob.ar/regimenGeneral/inscripcion/personas-humanas/procedimiento.asp).

Los requisitos pueden variar según la situación del sujeto y el trámite; esta guía orienta el diseño del producto, no reemplaza la validación fiscal o legal de una inscripción real.
