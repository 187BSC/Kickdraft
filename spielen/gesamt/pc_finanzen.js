/* ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
   Kickstil – Finanzen am PC als Dashboard (2026-10-20, nur PC-Version, beide Spiele)
   Nutzer: Vorschau A „Dashboard“ gewählt (gegen B „nur aufräumen“). Gilt nur mit body.pcu-an; Handy unverändert.
   Reines Umordnen der vorhandenen Teile in #view-club .club-wrap (Klasse pcf-an), solange die Finanzen offen sind:
   Flutlicht Front Office → Finanzen (body.ksfo-finanzen), Kickdraft Verein → Geld (.vt-reiter [data-vt="geld"].an).
   · Kennzahlen (.fin-balance) groß oben in der Finanzübersicht, darunter Einnahmen/Ausgaben, Verlauf, Prognose.
   · Rechts eine Spalte: Budgets (#club-facilities) bzw. Trikots (#kt-trikots), darunter die Sponsoren untereinander.
   · Kickdraft: Ticketpreise breit, Bannerwerbung und Merchandise nebeneinander unter der Übersicht.
   ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const an = () => document.body.classList.contains('pcu-an');
  const W = 'body.pcu-an #view-club .club-wrap.pcf-an';
  const CSS = `
${W} { display: grid; grid-template-columns: minmax(0, 1fr) 390px; gap: 14px; align-items: start; }
${W} > * { margin: 0 !important; min-width: 0; }
${W} > #club-banner { grid-column: 1 / -1; grid-row: 1; }
${W} > .vt-reiter { grid-column: 1 / -1; grid-row: 2; }
${W} > #finance-dash { grid-column: 1; grid-row: 3 / span 2; display: flex; flex-direction: column; gap: 12px; }
${W} #finance-dash .fin-balance { order: -1; }
${W} #finance-dash .fin-balance > * { padding: 14px 10px !important; }
${W} #finance-dash .fin-balance b, ${W} #finance-dash .fin-balance strong, ${W} #finance-dash .fin-balance [class*=val] { font-size: 26px !important; }
${W} #finance-dash .fin-row { padding: 5px 0; border-bottom: 1px solid var(--border); font-size: 13.5px; }
${W} #finance-dash .fin-spark svg, ${W} #finance-dash .fin-spark canvas { height: 150px !important; }
${W} > #club-facilities { grid-column: 2; grid-row: 3; display: block; }
${W} > #club-facilities > div { width: auto !important; }
${W} > #kt-trikots { grid-column: 2; grid-row: 3; }
${W} > #kt-trikots svg { width: 90px !important; height: auto !important; }
${W} > .sponsor-section { display: contents; }
${W} > .sponsor-section > .news-header { display: none; }
${W} #sponsor-grid { grid-column: 2; grid-row: 4 / span 3; display: flex !important; flex-direction: column; gap: 10px; }
${W} #sponsor-grid .sponsor-card { width: auto !important; }
${W} #sponsor-grid .fc-desc { display: none; }
${W} #finance-panel { grid-column: 1; grid-row: 5; display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
${W} #finance-panel .facility-card { margin: 0 !important; }
${W} #finance-panel .facility-card:first-child { grid-column: 1 / -1; }
@media (max-width: 1450px) { ${W} { grid-template-columns: minmax(0, 1fr) 340px; } }
`;
  function offen() {
    if (document.body.classList.contains('ksfo-finanzen')) return true;
    return !!document.querySelector('#view-club .vt-reiter [data-vt="geld"].an');
  }
  function tick() {
    const w = document.querySelector('#view-club .club-wrap');
    if (!w) return;
    const soll = an() && offen();
    if (w.classList.contains('pcf-an') !== soll) w.classList.toggle('pcf-an', soll);
  }
  function start() {
    if (document.getElementById('pcf-css')) return;
    const st = document.createElement('style'); st.id = 'pcf-css'; st.textContent = CSS; document.head.appendChild(st);
    // Reiterwechsel per Klick sofort, sonst im Takt (Neuzeichnen des Vereins, Fensterbreite)
    document.addEventListener('click', () => setTimeout(tick, 0));
    setInterval(tick, 500);
    tick();
    console.log('[Kickstil-PC-Finanzen v1] aktiv — Finanzen als Dashboard: Kennzahlen oben, Budgets und Sponsoren rechts (nur PC ≥ 1200 px, beide Spiele)');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.KSPcFinanzen = { tick };
})();
