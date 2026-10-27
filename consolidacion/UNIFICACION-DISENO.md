# Unificación de diseño — Sintegra I26

Todas las aplicaciones del ecosistema (TPV, ARBA, ARCA, Municipio, Banco) comparten el mismo **menú** y la misma **estructura de panel (dashboard)**, para que quien pasa de una app a otra no tenga que volver a aprender dónde está cada cosa.

**Excepción: la Billetera.** Es una app de uso personal pensada para el celular, así que conserva su propia interfaz. Igual usa la paleta y los logos oficiales y cumple la lista de accesibilidad del final.

## Fuentes

- **Identidad:** [Manual de Marca del ISFDyT N° 26](https://manualdemarca-i26.vercel.app/), sección *Sistema cromático* (pág. 16), *Sistema tipográfico* (pág. 17) y *Usos incorrectos* (pág. 18).
- **Criterios de UI/UX:** [UI UX Pro Max](https://uupm.cc/) ([repositorio](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)), de donde salen el estilo recomendado, los antipatrones, la lista de verificación previa a la entrega y las reglas de accesibilidad.

### Qué recomienda UI UX Pro Max para este producto

Sintegra combina servicios públicos (ARBA, ARCA, Municipio) con operaciones financieras (Banco, Billetera, TPV). Para esas categorías, la base de reglas de la skill (`products.csv` y `ui-reasoning.csv`) indica:

| Categoría en la skill | Estilo recomendado | Paleta | Reglas obligatorias | Antipatrones |
|---|---|---|---|---|
| Banca / finanzas tradicionales | Minimalismo suizo + Accesible y ético | Azul marino + azul de confianza + dorado | Seguridad primero, accesibilidad | Diseño "juguetón", degradados violeta/rosa, mala UX de seguridad |
| Gobierno / servicio público | Accesible y ético + Minimalismo suizo | Azul profesional + alto contraste | Navegación completa con teclado, foco visible de 3–4px, enlace "saltar al contenido" | Decoración recargada, bajo contraste, animaciones de adorno |

La paleta que recomienda la skill (azul marino, azul de confianza y dorado) es la misma del manual del instituto: azul institucional, azul cielo y dorado ocre. Por eso el estilo elegido para todas las apps es **minimalismo suizo, accesible y ético**: superficies claras, mucha jerarquía tipográfica, grillas ordenadas, poca decoración y animaciones solo para indicar carga o cambios de estado.

**Prohibido en todas las apps:** degradados violeta/rosa, efectos de vidrio esmerilado (glassmorphism) en paneles de trabajo, animaciones decorativas, emojis como íconos, y texto gris claro sobre fondo gris.

## 1. Colores

### Paleta oficial (manual, pág. 16)

| Token | Color | Rol en el manual | Uso en las apps |
|---|---|---|---|
| `--brand-navy` | `#14214F` Azul Institucional | Principal | Menú lateral, botón principal, títulos, texto fuerte |
| `--brand-gold` | `#89743A` Dorado Ocre | Principal | Acentos y destacados. Como texto, solo sobre blanco |
| `--brand-gold-sand` | `#AF9B63` Arena Dorada | Secundario | Indicador del ítem activo del menú y detalles sobre azul. **Nunca como texto sobre blanco** |
| `--brand-blue` | `#3F78B6` Azul Cielo | Secundario | Enlaces, estados activos, gráficos. Como texto, solo sobre blanco |
| — | `#FFFFFF` / `#000000` | Neutros | Superficies y texto |

### Contraste medido (WCAG; texto chico necesita 4.5:1)

| Color | Sobre blanco | Sobre fondo `#F5F6FA` | Sobre azul institucional |
|---|---|---|---|
| Azul institucional | 15.4 ✅ | 14.3 ✅ | — |
| Dorado ocre | 4.5 ✅ | 4.2 ❌ | 3.4 ❌ |
| Arena dorada | 2.7 ❌ | 2.5 ❌ | 5.7 ✅ |
| Azul cielo | 4.6 ✅ | 4.3 ❌ | 3.4 ❌ |

Consecuencia: el texto en azul cielo o dorado va siempre sobre tarjetas blancas, nunca sobre el gris de fondo de la página. En el menú lateral azul, el texto es blanco y el acento es arena.

### Neutros y estados

Los colores de estado son independientes de la marca y nunca se usan solos: siempre van con un texto o ícono que diga el estado.

```css
:root {
  /* Marca (manual, pág. 16) */
  --brand-navy:      #14214F;
  --brand-gold:      #89743A;
  --brand-gold-sand: #AF9B63;
  --brand-blue:      #3F78B6;

  /* Superficies */
  --bg-page:     #F5F6FA;   /* fondo detrás de las tarjetas */
  --bg-surface:  #FFFFFF;   /* tarjetas, tablas, formularios */
  --bg-muted:    #F0F2F7;   /* encabezado de tablas, filas alternas */
  --border:      #E3E6EF;
  --text:        #14214F;
  --text-muted:  #4B5470;   /* 7.6:1 sobre blanco */

  /* Estados (todos ≥ 4.5:1 sobre blanco) */
  --ok:     #1E7B4F;
  --alerta: #9A6700;
  --error:  #B42318;
  --info:   #3F78B6;

  /* Tipografía (manual, pág. 17) */
  --font-heading: "Cocomat Pro", "Segoe UI", system-ui, sans-serif;
  --font-body:    "Segoe UI", system-ui, -apple-system, Roboto, sans-serif;
  --font-logo:    "Dubai", "Segoe UI", sans-serif;

  /* Forma */
  --radius:    12px;
  --radius-sm: 8px;
  --shadow:    0 1px 2px rgb(20 33 79 / 6%), 0 4px 12px rgb(20 33 79 / 6%);
}
```

El degradado institucional del manual (`#14214F → #AF9B63`) se reserva para portadas y pantallas de bienvenida, no para paneles de trabajo.

## 2. Tipografía

El manual define **Cocomat Pro** (500–700) para títulos, **Hussar Bold** para texto y **Dubai** solo para el logotipo.

- **Títulos:** Cocomat Pro si el equipo tiene el archivo de la fuente; si no, la pila de respaldo de `--font-heading`.
- **Texto de interfaz, formularios y tablas:** pila de sistema (`--font-body`). Hussar Bold es una fuente en negrita pensada para piezas gráficas; en tablas y formularios largos cansa la lectura.
- **Números** (importes, CUIT, cantidades): `font-variant-numeric: tabular-nums`, para que las columnas queden alineadas.
- **Dubai:** solo dentro del logo. No se usa para textos de la app.

Escala adaptada a pantallas de trabajo (la del manual es para afiches):

| Uso | Tamaño | Peso |
|---|---|---|
| Título de pantalla | 24px | 700 |
| Título de tarjeta o sección | 18px | 600 |
| Texto | 15px | 400 |
| Etiqueta / encabezado de tabla | 13px | 600, mayúsculas con 0.04em de espaciado |
| Leyenda | 12px | 400 |
| Valor de KPI | 28px | 700, `tabular-nums` |

## 3. Estructura común: menú y panel

```
┌────────────┬──────────────────────────────────────────────────┐
│  LOGO i26  │  Título de la pantalla        [● API conectada]  │  ← barra superior blanca
│  Módulo    ├──────────────────────────────────────────────────┤
│            │                                                  │
│ ▸ Resumen  │  [KPI]   [KPI]   [KPI]   [KPI]                   │
│   Ventas   │                                                  │
│   …        │  ┌ Tarjeta / tabla ─────────────────────────┐    │
│            │  │                                          │    │
│  ────────  │  └──────────────────────────────────────────┘    │
│  Conexión  │                                                  │
└────────────┴──────────────────────────────────────────────────┘
  menú lateral azul institucional       fondo --bg-page
```

### Menú lateral

- Ancho 248px, fondo `--brand-navy`, texto blanco.
- Arriba: el logo i26 del módulo (variante sobre fondo oscuro) y el nombre de la app.
- Cada ítem: ícono de 20px + texto, alto mínimo 44px.
- Ítem activo: fondo blanco al 10% y borde izquierdo de 3px en `--brand-gold-sand`.
- Abajo, separado: el estado de conexión con la API y la salida.
- **Por debajo de 1024px** el menú se oculta y se abre con un botón en la barra superior. Por debajo de 640px ocupa toda la pantalla al abrirse.

### Barra superior

- Fondo blanco, borde inferior `--border`, alto 64px.
- A la izquierda el título de la pantalla actual; a la derecha el **chip de estado de la API** y, si corresponde, el usuario.
- Chip de API, siempre con texto: `● API conectada` (`--ok`), `● Modo demo` (`--alerta`) o `● Sin conexión` (`--error`).

### Panel (dashboard)

- **Primera fila: KPI.** Tarjetas de indicadores, 4 columnas desde 1280px, 2 desde 768px, 1 en celular. Cada tarjeta: etiqueta arriba, valor grande, y debajo una línea de contexto (por ejemplo "hoy", "vs. ayer").
- **Después: tarjetas de contenido** con título, acción a la derecha si hay, y cuerpo.
- Separación de 24px entre bloques y 16px dentro de las tarjetas.
- Ancho máximo del contenido: 1280px.

### Tablas

- Encabezado `--bg-muted`, filas de 48px de alto, separador `--border`, resaltado al pasar el mouse.
- Importes alineados a la derecha con `tabular-nums`.
- El estado de una fila va en un **chip con texto** (por ejemplo "Completada", "Error"), nunca solo con color.
- En celular, la tabla se desplaza horizontalmente dentro de su tarjeta; la página no.

### Botones y formularios

| Tipo | Estilo | Uso |
|---|---|---|
| Principal | Fondo `--brand-navy`, texto blanco | Una acción principal por pantalla |
| Secundario | Borde `--brand-navy`, fondo blanco | Acciones alternativas |
| Destructivo | Fondo `--error`, texto blanco, pide confirmación | Borrar, anular |
| Texto | Solo texto `--brand-blue` | Acciones menores, enlaces |

- Alto mínimo 40px (44px en celular), radio `--radius-sm`.
- Etiqueta visible arriba de cada campo; el error se muestra debajo del campo que falló, en `--error` y con texto.

### Estados de pantalla

Toda pantalla que carga datos tiene los cuatro estados:

1. **Cargando:** esqueletos grises con la forma del contenido.
2. **Vacío:** mensaje que explica qué falta y la acción para resolverlo ("Todavía no hay productos. Cargá el primero").
3. **Error:** qué pasó y qué hacer. Nunca se muestran datos de ejemplo como si fueran reales.
4. **Con datos.**

### Íconos

Íconos SVG de una sola familia: **Lucide** (`lucide-react` en React, o los SVG sueltos en HTML). **No usar emojis como íconos.**

## 4. Accesibilidad y verificación antes de entregar

Lista basada en la lista de verificación de UI UX Pro Max (`references/pro-rules.md` y la tabla de prioridades de su `SKILL.md`). Cada app la cumple antes de publicarse:

**Accesibilidad**
- [ ] Contraste de texto de al menos 4.5:1 (ver la tabla de la sección 1); íconos y bordes que transmiten información, al menos 3:1.
- [ ] Foco visible en todos los elementos con teclado: contorno de 3px `--brand-blue` con 2px de separación. Nunca quitar el foco.
- [ ] Enlace "Saltar al contenido" como primer elemento enfocable.
- [ ] Toda la app se puede usar solo con teclado, en el mismo orden en que se ve.
- [ ] Los botones que son solo un ícono tienen nombre accesible (`aria-label`).
- [ ] Ningún estado se comunica solo con color: siempre hay texto o ícono.
- [ ] Toda imagen con significado tiene texto alternativo; el logo del módulo también.

**Interacción**
- [ ] Zonas tocables de al menos 44×44px, con 8px o más de separación.
- [ ] `cursor: pointer` en todo lo que se puede tocar; los elementos deshabilitados se ven y se comportan como deshabilitados.
- [ ] Toda acción que tarda muestra que está cargando, y el botón no se puede apretar dos veces.
- [ ] Al pasar el mouse o presionar, cambia color u opacidad, nunca el tamaño (nada se mueve de lugar).
- [ ] Se respeta `prefers-reduced-motion` (sin animaciones si el usuario lo pidió).

**Diseño y adaptación**
- [ ] Funciona en 375px, 768px, 1024px y 1440px de ancho, sin desplazamiento horizontal de la página.
- [ ] Textos, chips y etiquetas se acomodan sin cortarse al achicar la pantalla o aumentar el zoom.
- [ ] Espaciado en múltiplos de 4/8px (8, 16, 24, 32).
- [ ] Colores solo a través de los tokens de la sección 1, nunca hexadecimales sueltos en los componentes.
- [ ] Una sola familia de íconos (Lucide), con el mismo grosor de trazo, y sin emojis como íconos.
- [ ] Logos oficiales, sin deformar y con su espacio de respeto.

## 5. Usos incorrectos de la marca (manual, pág. 18)

- No deformar ni estirar los logos.
- No cambiar las tipografías del logo.
- No poner el logo sobre fondos de bajo contraste.
- No alterar los colores oficiales ni inventar variantes de la paleta.

## 6. Aplicación por app

| App | Menú y panel común | Estado |
|---|---|---|
| TPV David | Sí | Aplicado y publicado (piloto aprobado) — [tpv-david.vercel.app](https://tpv-david.vercel.app) |
| TPV Sebastián | Sí | Aplicado y publicado — [tpv-sebastian.vercel.app](https://tpv-sebastian.vercel.app). Código en la rama `diseno-unificado-tpv-sebastian` del repo Ecosistema-Fintech-simulado |
| ARBA Tomi | Sí | Aplicado y publicado — [arba-tomi.vercel.app](https://arba-tomi.vercel.app) |
| ARBA Lucas | Sí | Aplicado y publicado — [arba-lucas.vercel.app](https://arba-lucas.vercel.app) |
| Municipio Cristian | Sí | Aplicado y publicado — [municipio-cristian.vercel.app](https://municipio-cristian.vercel.app) |
| ARCA Mateo | Sí (barra superior y menú lateral en escritorio; pestañas en móvil) | Aplicado y publicado — [arca-mateo.vercel.app](https://arca-mateo.vercel.app) |
| Billetera Lucas-M | **No** (interfaz propia; solo paleta, logos y accesibilidad) | Pendiente |

El orden fue aplicar el patrón primero en una app (TPV David), revisarlo, y después replicarlo en las demás.

Las apps que nacieron con tema oscuro (ARBA Tomi y TPV Sebastián) pasaron al tema claro sin reescribir cada componente: en ARBA Tomi se invirtió la escala de grises de Tailwind, y en TPV Sebastián se reemplazaron sus variables de color, que además eliminó el efecto vidrio (glassmorphism) que la guía prohíbe en paneles de trabajo. Los logos de cada módulo se usan como vienen, sin recolorear.
