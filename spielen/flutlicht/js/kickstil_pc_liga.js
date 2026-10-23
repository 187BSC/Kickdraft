/* ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
   Kickstil – Liga am PC nachgeschärft (2026-10-20, nur PC-Version, beide Spiele)
   Nutzer: „FM-artig nachschärfen“ (gegen „so lassen“). Gilt nur mit body.pcu-an; Handy unverändert.
   · Tabellen dichter (mehr Zeilen auf einen Blick), Zeilen-Hover, eigener Verein deutlich.
   · Zonen farbig als Balken links an der Zeile (Flutlicht: Europapokal, Aufstieg, Abstieg – .lg-zone z-cl/el/promo/rel aus
     bundle_europa.js; der Kenney-Stil hatte sie unsichtbar gemacht) mit Legende unter der Tabelle.
   · Form als farbige Punkte (form-dot f-w/f-d/f-l), Spielplan kompakt (Flutlicht .fixture-row, Kickdraft .kf-zeile).
   · Klick auf einen Verein öffnet wie bisher das Vereinsblatt – am PC als Spalte rechts (kickstil_pc_raster.js).
   ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const an = () => document.body.classList.contains('pcu-an');
  const V = 'body.pcu-an #view-liga';
  const ZONEN = [['cl', 'Champions Cup', '#1f9d55'], ['el', 'Europacup', '#2c7cb5'], ['promo', 'Aufstieg', '#25c065'], ['rel', 'Abstieg', '#c0392b']];
  const STIL = `
${V} .lg-table td, ${V} .dfl-tabelle td, ${V} .sim-tab td { padding-top: 4px !important; padding-bottom: 4px !important; }
${V} .lg-table tbody tr:hover td, ${V} .sim-tab tbody tr:hover td { background: var(--bg3); }
${V} .lg-table .lg-crest { width: 20px !important; height: 20px !important; }
${V} .lg-table tr.fcm-row td { font-weight: 800; background: var(--k-info-bg, #dcebf7); }
${V} .lg-table td.lg-pos { position: relative; }
${V} .lg-zone { position: absolute !important; left: 0; top: 2px; bottom: 2px; width: 4px; border-radius: 2px; transform: none !important; height: auto !important; }
${ZONEN.map(([k, , f]) => `${V} .lg-zone.z-${k} { background: ${f} !important; }`).join('\n')}
${V} .pcl-legende { display: flex; flex-wrap: wrap; gap: 6px 14px; margin: 8px 4px 0; font-size: 11.5px; font-weight: 700; color: var(--text3); }
${V} .pcl-legende i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 5px; vertical-align: -1px; }
${V} .form-dots { display: inline-flex; gap: 3px; }
${V} .form-dot { width: 16px; height: 16px; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; font-size: 9.5px; font-weight: 800; color: #fff; }
${V} .form-dot.f-w { background: #1f9d55; } ${V} .form-dot.f-d { background: #c99a12; } ${V} .form-dot.f-l { background: #c0392b; }
/* Spielplan kompakt */
${V} .fixture-row { padding-top: 5px !important; padding-bottom: 5px !important; min-height: 0 !important; }
${V} .fixture-row.next { box-shadow: inset 4px 0 0 var(--k-gold, #c9a227); }
${V} .kf-zeile { min-height: 0 !important; padding-top: 4px !important; padding-bottom: 4px !important; }
${V} .kf-zeile .lg-crest, ${V} .kf-zeile svg { max-width: 24px; max-height: 24px; }
${V} .kf-liste { gap: 4px !important; }
`;
  function legende() {
    const t = document.querySelector('#lg-sub-tabelle .lg-table');
    if (!t) return;
    const da = ZONEN.filter(([k]) => t.querySelector('.lg-zone.z-' + k));
    let l = t.nextElementSibling && t.nextElementSibling.classList.contains('pcl-legende') ? t.nextElementSibling : null;
    const html = da.map(([, n, f]) => `<span><i style="background:${f}"></i>${n}</span>`).join('');
    if (!an() || !da.length) { if (l) l.remove(); return; }
    if (!l) { l = document.createElement('div'); l.className = 'pcl-legende'; t.after(l); }
    if (l._sig !== html) { l._sig = html; l.innerHTML = html; }   // nicht mit innerHTML vergleichen – der Kenney-Stil färbt um
  }
  function start() {
    if (document.getElementById('pcl-css')) return;
    const st = document.createElement('style'); st.id = 'pcl-css'; st.textContent = STIL; document.head.appendChild(st);
    setInterval(legende, 800);
    console.log('[Kickstil-PC-Liga v1] aktiv — Liga dichter, Zonen mit Legende, Form als Punkte, Spielplan kompakt (nur PC ≥ 1200 px, beide Spiele)');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
