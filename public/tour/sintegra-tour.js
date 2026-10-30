/*
 * Visita guiada del ecosistema Sintegra I26 (Driver.js, licencia MIT).
 * Uso en cualquier app (HTML simple o React):
 *   <script src="https://sintegrai26.vercel.app/tour/sintegra-tour.js" defer></script>
 *   <script>
 *     window.addEventListener('load', () => SintegraTour.init({ app: 'banco', steps: [
 *       { element: '#btn-abrir', title: 'Abrir una cuenta', text: 'Tocá acá para…' },
 *       { title: 'Listo', text: 'Paso sin elemento: se muestra en el centro.' },
 *     ]}));
 *   </script>
 * Cada paso puede tener `when: () => boolean` para mostrarse solo en ciertas pantallas.
 * Si el elemento de un paso no está visible en ese momento, el paso se saltea.
 */
(function () {
  const VERSION = '1.3.1';
  const CDN = `https://cdn.jsdelivr.net/npm/driver.js@${VERSION}/dist`;
  let cargando = null;

  function cargarDriver() {
    if (window.driver?.js?.driver) return Promise.resolve();
    if (cargando) return cargando;
    cargando = new Promise((ok, mal) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet'; css.href = `${CDN}/driver.css`;
      document.head.appendChild(css);
      const js = document.createElement('script');
      js.src = `${CDN}/driver.js.iife.js`; js.onload = ok; js.onerror = () => mal(new Error('No se pudo cargar la guía'));
      document.head.appendChild(js);
    });
    return cargando;
  }

  const estilo = `
    .sintegra-tour-btn{position:fixed;right:16px;bottom:16px;z-index:9998;display:flex;align-items:center;gap:.45rem;
      min-height:44px;padding:.55rem 1rem;border-radius:999px;border:2px solid #89743A;background:#14214F;color:#fff;
      font:600 .92rem/1.2 Inter,system-ui,sans-serif;cursor:pointer;box-shadow:0 6px 20px rgb(20 33 79 / .25)}
    .sintegra-tour-btn:hover{background:#0E1838}
    .sintegra-tour-btn:focus-visible{outline:3px solid #3F78B6;outline-offset:3px}
    .sintegra-tour-btn .q{display:grid;place-items:center;width:22px;height:22px;border-radius:50%;background:#AF9B63;color:#14214F;font-weight:800}
    .sintegra-tour-btn.nuevo::after{content:"";position:absolute;top:-3px;right:-3px;width:12px;height:12px;border-radius:50%;background:#F59E0B;border:2px solid #fff}
    .driver-popover.sintegra{font-family:Inter,system-ui,sans-serif;color:#14214F;border-radius:12px;max-width:340px}
    .driver-popover.sintegra .driver-popover-title{font-size:1.02rem;font-weight:700}
    .driver-popover.sintegra .driver-popover-description{font-size:.92rem;line-height:1.45;color:#4B5470}
    .driver-popover.sintegra .driver-popover-footer button{min-height:36px;border-radius:8px;font-weight:600;text-shadow:none}
    .driver-popover.sintegra .driver-popover-next-btn{background:#14214F;color:#fff;border-color:#14214F}
    @media print{.sintegra-tour-btn{display:none}}`;

  const visible = (el) => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';

  function armarPasos(steps) {
    return steps
      .filter((s) => !s.when || s.when())
      .map((s) => {
        const el = s.element ? document.querySelector(s.element) : null;
        if (s.element && !visible(el)) return null;
        return { element: el || undefined, popover: { title: s.title, description: s.text, side: s.side, align: s.align } };
      })
      .filter(Boolean);
  }

  async function iniciar(cfg) {
    try { await cargarDriver(); } catch (e) { alert(e.message); return; }
    const pasos = armarPasos(cfg.steps);
    if (!pasos.length) return;
    const d = window.driver.js.driver({
      showProgress: true, allowClose: true, smoothScroll: false, popoverClass: 'sintegra',
      // Lleva la pantalla hasta el elemento antes de resaltarlo (aunque la página esté scrolleada).
      // Los elementos altos se alinean arriba para que se vea su comienzo.
      onHighlightStarted: (el) => {
        if (!el || !el.scrollIntoView) return;
        const alto = el.getBoundingClientRect().height > window.innerHeight * 0.6;
        el.scrollIntoView({ block: alto ? 'start' : 'center', inline: 'nearest' });
      },
      nextBtnText: 'Siguiente →', prevBtnText: '← Anterior', doneBtnText: 'Listo', progressText: 'Paso {{current}} de {{total}}',
      steps: pasos,
    });
    d.drive();
  }

  function init(cfg) {
    if (!cfg || !Array.isArray(cfg.steps)) return;
    if (!document.getElementById('sintegra-tour-css')) {
      const st = document.createElement('style'); st.id = 'sintegra-tour-css'; st.textContent = estilo;
      document.head.appendChild(st);
    }
    let btn = document.getElementById('sintegra-tour-btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'sintegra-tour-btn'; btn.type = 'button'; btn.className = 'sintegra-tour-btn';
      btn.innerHTML = '<span class="q" aria-hidden="true">?</span><span>¿Cómo se usa?</span>';
      btn.setAttribute('aria-label', 'Ver la guía paso a paso de esta pantalla');
      document.body.appendChild(btn);
    }
    const clave = `sintegra-tour-visto:${cfg.app || location.pathname}`;
    let visto = false;
    try { visto = localStorage.getItem(clave) === '1'; } catch { /* sin almacenamiento */ }
    if (!visto) btn.classList.add('nuevo');
    btn.onclick = () => {
      btn.classList.remove('nuevo');
      try { localStorage.setItem(clave, '1'); } catch { /* sin almacenamiento */ }
      iniciar(cfg);
    };
  }

  window.SintegraTour = { init, start: iniciar };
})();
