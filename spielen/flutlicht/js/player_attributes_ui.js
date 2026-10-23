/* ===== player_attributes_ui.js =====
   ZEIGT DIE FEINEN SPIELERWERTE IN DER SPIELERKARTE
   ─────────────────────────────────────────────────────────────────────────────
   player_attributes.js berechnet für jeden Spieler 14–15 Detailwerte, sichtbar
   waren sie bisher nirgends. Dieses Modul hängt sich per Wrapper an
   renderPlayerCard() und ergänzt die Karte um ein Werte-Panel.

   Torhüter bekommen ihre eigenen fünf Werte, Feldspieler die elf Feldwerte —
   plus die drei allgemeinen. Farbe nach Niveau, damit man Stärken auf einen
   Blick sieht statt Zahlen lesen zu müssen.
   Lädt NACH player_attributes.js und app_main.js.
   ============================================================================= */
(function () {
  'use strict';

  function stil() {
    if (document.getElementById('pattr-css')) return;
    const s = document.createElement('style');
    s.id = 'pattr-css';
    s.textContent = `
.pcard-attr{margin-top:12px;border-top:1px solid var(--border,#243244);padding-top:10px}
.pcard-attr-head{font-size:10px;letter-spacing:1px;text-transform:uppercase;
  color:var(--text3,#6b7d8f);font-weight:800;margin-bottom:8px;display:flex;
  align-items:center;gap:6px}
.pattr-grp{font-size:9.5px;letter-spacing:.8px;text-transform:uppercase;
  color:var(--text3,#6b7d8f);font-weight:800;margin:9px 0 5px}
.pattr-grid{display:grid;grid-template-columns:1fr;gap:4px}
.pattr-row{display:flex;align-items:center;gap:7px;font-size:11.5px}
.pattr-name{flex:1;color:var(--text2,#9fb0c0);white-space:nowrap;overflow:hidden;
  text-overflow:ellipsis}
.pattr-bar{width:72px;height:4px;border-radius:2px;background:#1d2836;overflow:hidden;flex:0 0 auto}
.pattr-bar i{display:block;height:100%}
.pattr-val{width:20px;text-align:right;font-weight:800;font-variant-numeric:tabular-nums}
/* einspaltig: die Spielerkarte ist immer eine schmale Seitenleiste — zwei
   Spalten wurden dort rechts abgeschnitten */`;
    document.head.appendChild(s);
  }

  // Farbe nach Stärke — dieselbe Logik wie sonst im Spiel: grün stark, rot schwach
  function farbe(v) {
    if (v >= 80) return '#25c065';
    if (v >= 70) return '#7ac943';
    if (v >= 60) return '#f2c14e';
    if (v >= 50) return '#e8913c';
    return '#e15252';
  }

  function zeile(name, v) {
    return '<div class="pattr-row"><span class="pattr-name">' + name + '</span>' +
           '<span class="pattr-bar"><i style="width:' + Math.max(3, Math.min(100, v)) +
           '%;background:' + farbe(v) + '"></i></span>' +
           '<span class="pattr-val" style="color:' + farbe(v) + '">' + v + '</span></div>';
  }

  function block(titel, liste, w) {
    return '<div class="pattr-grp">' + titel + '</div><div class="pattr-grid">' +
           liste.map(e => zeile(e.n, w[e.k])).join('') + '</div>';
  }

  function panelHTML(p) {
    if (typeof window.spielerWerte !== 'function') return '';
    const w = window.spielerWerte(p);
    if (!w || typeof SpielerAttribute === 'undefined') return '';
    let h = '<div class="pcard-attr"><div class="pcard-attr-head">' +
            '<i class="ti ti-chart-radar"></i> Spielerwerte</div>';
    h += block('Allgemein', SpielerAttribute.allgemein, w);
    h += w._torwart ? block('Torwart', SpielerAttribute.torwart, w)
                    : block('Feldspiel', SpielerAttribute.feld, w);
    h += '</div>';
    return h;
  }

  // ── An die Spielerkarte hängen ────────────────────────────────────────────
  if (typeof window.renderPlayerCard === 'function') {
    const _orig = window.renderPlayerCard;
    window.renderPlayerCard = function (p) {
      const r = _orig.apply(this, arguments);
      try {
        stil();
        const el = document.getElementById('playercard-sec');
        if (el && p && el.style.display !== 'none') {
          const alt = el.querySelector('.pcard-attr');
          if (alt) alt.remove();
          const html = panelHTML(p);
          if (html) el.insertAdjacentHTML('beforeend', html);
        }
      } catch (e) { console.warn('[SpielerwerteUI]', e); }
      return r;
    };
    try { renderPlayerCard = window.renderPlayerCard; } catch (e) {}
  }

  console.log('[SpielerwerteUI v1] aktiv — Detailwerte in der Spielerkarte');
})();
