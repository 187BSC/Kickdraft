/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · EUROPAPOKAL-TICKER  ·  v1   (Nutzer 2026-10-15: „Für die CL, Europa League und Conference League jeweils andere
   Ticker vom Design“) – MUSTER zum Absegnen
   ─────────────────────────────────────────────────────────────────────────
   Der Live-Ticker (dfl_textspiel_patch.js, #dfl-ts) bekommt je Wettbewerb ein eigenes Kleid – wie die Playoffs in Kickdraft
   ein Flutlicht-Look, aber jeweils mit eigener Farbe und Marke:
     · Champions Cup  (cl)  Nachtblau mit Silber und Sternen          – die Königsklasse
     · Europacup      (el)  Anthrazit mit Orange                       – Donnerstagabend unter Flutlicht
     · Kontinentalcup (co)  Tiefgrün mit Türkis                        – der junge Wettbewerb
   Kopf: Marke mit Symbol und Name des Wettbewerbs. Farben über CSS-Variablen (--wb-*), leicht anzupassen.
   Erkennung: CURRENT_FIXTURE (type 'euro', comp cl/el/co) beim Öffnen des Tickers.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const WB = {
    cl: { name: 'Champions Cup', icon: 'ti-stars' },
    el: { name: 'Europacup', icon: 'ti-trophy' },
    co: { name: 'Kontinentalcup', icon: 'ti-world' }
  };
  function wettbewerb() {
    try {
      const fx = typeof CURRENT_FIXTURE !== 'undefined' ? CURRENT_FIXTURE : null;
      if (!fx || fx.type !== 'euro') return null;
      const k = String(fx.comp || '').toLowerCase();
      return WB[k] ? k : (k === 'ecl' ? 'co' : null);
    } catch (e) { return null; }
  }
  // Einmal je Ticker festlegen (beim Sichtbarwerden) – später ändert sich CURRENT_FIXTURE (Abpfiff), das Kleid bleibt
  function kleiden(r, neu) {
    if (!r) return;
    if (neu || !r.dataset.wb) r.dataset.wb = wettbewerb() || '-';
    const k = WB[r.dataset.wb] ? r.dataset.wb : null;
    ['cl', 'el', 'co'].forEach(x => r.classList.toggle('ts-wb-' + x, x === k));
    r.classList.toggle('ts-wb', !!k);
    const kopf = r.querySelector('.ts-kopf'), alt = kopf && kopf.querySelector('.ts-wb-marke');
    if (alt && (!k || alt.dataset.k !== k)) alt.remove();
    if (k && kopf && !kopf.querySelector('.ts-wb-marke')) {
      const m = document.createElement('span');
      m.className = 'ts-wb-marke'; m.dataset.k = k;
      m.innerHTML = `<i class="ti ${WB[k].icon}" aria-hidden="true"></i>${WB[k].name}`;
      kopf.appendChild(m);
    }
    // Sternchen, die herunterrieseln (Nutzer 2026-10-16) – Farbe je Wettbewerb, hinter Klicks unsichtbar
    const box = r.querySelector('.ts-box'), sterne = box && box.querySelector('.ts-wb-sterne');
    if (sterne && (!k || sterne.dataset.k !== k)) sterne.remove();
    if (k && box && !box.querySelector('.ts-wb-sterne')) {
      const s = document.createElement('div');
      s.className = 'ts-wb-sterne'; s.dataset.k = k; s.setAttribute('aria-hidden', 'true');
      let html = '';
      for (let i = 0; i < STERNE; i++) {
        const gr = 5 + Math.random() * 7, dauer = 7 + Math.random() * 9, start = -Math.random() * dauer;
        const links = Math.random() * 100, wind = (Math.random() * 40 - 20).toFixed(0), dreh = Math.random() < 0.5 ? -1 : 1;
        html += `<i style="left:${links.toFixed(1)}%;width:${gr.toFixed(1)}px;height:${gr.toFixed(1)}px;animation-duration:${dauer.toFixed(1)}s;animation-delay:${start.toFixed(1)}s;--wind:${wind}px;--dreh:${dreh * 360}deg;opacity:${(0.35 + Math.random() * 0.45).toFixed(2)}"></i>`;
      }
      s.innerHTML = html;
      box.insertBefore(s, box.firstChild);
    }
  }
  const STERNE = 22;
  const los = () => {
    new MutationObserver(() => {
      const r = document.getElementById('dfl-ts');
      if (!r) return;
      if (r.hidden) { delete r.dataset.wb; return; }
      kleiden(r);
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
  };
  if (document.body) los(); else document.addEventListener('DOMContentLoaded', los);

  const css = document.createElement('style');
  css.textContent = `
.dfl-ts.ts-wb-cl{--wb-1:#0b1736;--wb-2:#15254f;--wb-3:#22356a;--wb-fg:#eef2fb;--wb-leise:#a9b6d6;--wb-akzent:#d9e2f2;--wb-akzent-tief:#8f9bb8;--wb-marke-fg:#0b1736}
.dfl-ts.ts-wb-el{--wb-1:#17140f;--wb-2:#262019;--wb-3:#352b20;--wb-fg:#fbf3ea;--wb-leise:#d1bca3;--wb-akzent:#ff8a1f;--wb-akzent-tief:#b85c0c;--wb-marke-fg:#1c0f02}
.dfl-ts.ts-wb-co{--wb-1:#062a24;--wb-2:#0b3b33;--wb-3:#124d43;--wb-fg:#e9fbf6;--wb-leise:#9fd6c8;--wb-akzent:#3ee6b4;--wb-akzent-tief:#1a9c78;--wb-marke-fg:#032018}
.ts-wb .ts-box{background-color:var(--wb-1);background-image:radial-gradient(circle at 50% -10%,var(--wb-3),transparent 60%);color:var(--wb-fg)}
@media (min-width:560px){.ts-wb .ts-box{border-color:var(--wb-akzent-tief);box-shadow:0 6px 0 var(--wb-akzent-tief)}}
.ts-wb .ts-kopf{background:var(--wb-1);color:var(--wb-fg)}
.ts-wb .ts-art{background:color-mix(in srgb,var(--wb-akzent) 18%,transparent);color:var(--wb-akzent)}
.ts-wb .ts-anzeige{background:var(--wb-2);color:var(--wb-fg);border-top:3px solid var(--wb-akzent);border-bottom:3px solid var(--wb-akzent)}
.ts-wb .ts-stand{background:var(--wb-1);color:var(--wb-fg);border-color:var(--wb-akzent);box-shadow:0 0 0 3px color-mix(in srgb,var(--wb-akzent) 22%,transparent)}
.ts-wb .ts-uhr{background:var(--wb-3);color:var(--wb-fg)}
.ts-wb .ts-tore,.ts-wb .ts-team small{color:var(--wb-leise)}
.ts-wb .ts-druck,.ts-wb .ts-lagebild,.ts-wb .ts-steuer,.ts-wb .ts-ticker{background:var(--wb-1)}
.ts-wb .ts-z{background:var(--wb-2);color:var(--wb-fg);border-color:var(--wb-3)}
.ts-wb .ts-z small,.ts-wb .ts-z .ts-ic{color:var(--wb-leise)}
.ts-wb .ts-z.tor{background:color-mix(in srgb,var(--wb-akzent) 16%,var(--wb-2));border-color:var(--wb-akzent);box-shadow:0 3px 0 var(--wb-akzent-tief)}
.ts-wb .ts-z.tor .ts-tor-kopf>b,.ts-wb .ts-z.tor .ts-tor-stand{color:var(--wb-akzent)}
.ts-wb .ts-live div{background:var(--wb-2);border-color:var(--wb-3);color:var(--wb-fg)}
.ts-wb .ts-live dt{color:var(--wb-leise)}
.ts-wb .ts-steuer{border-top-color:var(--wb-akzent-tief)}
.ts-wb .ts-b-blatt{color:var(--text,#2c3e50)}
.ts-wb-sterne{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:3}
.ts-wb-sterne i{position:absolute;top:-14px;display:block;background:var(--wb-stern,var(--wb-akzent));
  clip-path:polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%);
  filter:drop-shadow(0 0 3px var(--wb-stern,var(--wb-akzent)));animation:ts-wb-rieseln linear infinite}
.dfl-ts.ts-wb-cl{--wb-stern:#f4f7ff}
@keyframes ts-wb-rieseln{0%{transform:translate(0,0) rotate(0)}50%{transform:translate(var(--wind),50vh) rotate(calc(var(--dreh)/2))}
  100%{transform:translate(0,105vh) rotate(var(--dreh))}}
@media (prefers-reduced-motion:reduce){.ts-wb-sterne{display:none}}
.ts-wb-marke{margin-left:auto;display:inline-flex;align-items:center;gap:5px;font:800 11.5px/1 var(--font-titel,Fredoka,system-ui);
  letter-spacing:.06em;text-transform:uppercase;padding:6px 10px;border-radius:999px;background:var(--wb-akzent);color:var(--wb-marke-fg);white-space:nowrap}
.ts-wb-marke i{font-size:15px}
.ts-wb-cl .ts-wb-marke{background:linear-gradient(135deg,#f4f7fd,#b9c4dc)}`;
  document.head.appendChild(css);

  window.KSEuroTicker = { WB, kleiden, wettbewerb };
  console.log('[Kickstil-EuroTicker v1] aktiv — eigenes Ticker-Kleid für Champions Cup, Europacup, Kontinentalcup (Muster)');
})();
