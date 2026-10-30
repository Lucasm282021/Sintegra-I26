# Visitas guiadas (botón "¿Cómo se usa?")

**Fecha:** 2026-10-29 · Librería: [Driver.js](https://driverjs.com/) 1.3.1 (MIT), cargada desde jsDelivr.

Cada app tiene abajo a la derecha un botón **"¿Cómo se usa?"**. Abre un recorrido paso a paso por la pantalla que se está viendo: solo muestra los pasos cuyos elementos están visibles, así sirve tanto en el ingreso como dentro de la app. La primera vez que se entra, el botón tiene un punto naranja.

## Cómo está armado

- `public/tour/sintegra-tour.js` (portal): carga Driver.js, agrega el botón, aplica el estilo del ecosistema y arma los pasos. Es el mismo archivo para todas las apps; las que están fuera del portal lo cargan desde `https://sintegrai26.vercel.app/tour/sintegra-tour.js`.
- Cada app declara solo sus pasos:

```html
<script src="https://sintegrai26.vercel.app/tour/sintegra-tour.js" defer></script>
<script>
  window.addEventListener('load', () => SintegraTour.init({ app: 'mi-app', steps: [
    { element: '#buscar', title: '1. Buscá productos', text: 'Escribí el nombre y tocá el producto.' },
    { title: 'Listo', text: 'Un paso sin elemento se muestra en el centro.' },
  ]}));
</script>
```

- `element` es un selector CSS. Conviene usar `id` o `aria-label` estables y elementos chicos (un botón, un buscador, un título), no listas largas.
- Textos cortos, en segunda persona y en el orden en que se usa la pantalla.

## Dónde están los pasos

| App | Archivo |
|---|---|
| Portal (inicio) | `public/tour-portal.js` |
| Comercios | `public/comercios/tour.js` |
| Configuración fiscal | `public/fiscal/tour.js` |
| Banco M | `public/banco/tour.js` |
| TPV Brisa | `public/brisa/tour.js` |
| ARCA (Mateo) | `arca-mateo/public/tour.js` |
| Billetera (Lucas M) | `Billetera_virtual-Lucas_M/public/tour.js` |
| TPV David | `tpv-david/public/index.html` (al final) |
| TPV Sebastián | `sebasTPV/tpv-frontend/index.html` (al final) |
| ARBA Lucas | `arba-lucas/frontend/index.html` (al final) |
| ARBA Tomi | `arba-tomi/index.html` (al final) |
| Municipio (Cristian) | `municipio-cristian/frontend/index.html` (al final) |

Si un alumno cambia su pantalla, tiene que revisar que los selectores de sus pasos sigan existiendo; si no, ese paso se saltea solo.
