/* ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
   Kickstil – Verein am PC als Dashboard (2026-10-20, nur PC-Version, beide Spiele)
   Nutzer: Vorschau A „Dashboard“ gewählt (gegen B „nur aufgeräumt“). Gilt nur mit body.pcu-an; Handy unverändert.
   Reines Umordnen der vorhandenen Teile in #view-club .club-wrap (Klasse pcve-an), solange der Verein offen ist:
   · Flutlicht (Front Office → Verein, body.ksfo-verein): Vorstand (#exp-panel) links breit, rechts „Dein Trainer“ (#kstr-verein)
     mit kleinem Bild und Werten untereinander, darunter Anlagen, Trainerteam, Trikots und „Spiel neu starten“ nebeneinander.
     Vorher war die Seite 4.860 px lang und das Trainerbild füllte die ganze Breite (am PC fehlte die Größe).
   · Kickdraft (Verein → Anlagen, .vt-reiter [data-vt="anlagen"].an): Kasse & Cap als Leiste oben, die vier Anlagen nebeneinander.
   ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const an = () => document.body.classList.contains('pcu-an');
  const W = 'body.pcu-an #view-club .club-wrap';
  const F = W + '.pcve-an.pcve-fl', K = W + '.pcve-an.pcve-kd';
  const STIL = `
${W}.pcve-an { display: grid !important; gap: 14px; align-items: start; }
${W}.pcve-an > * { margin: 0 !important; min-width: 0; }
/* Flutlicht */
${F} { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 380px; }
${F} > #club-banner { grid-column: 1 / -1; grid-row: 1; }
${F} > #exp-panel { grid-column: 1 / 3; grid-row: 2; }
${F} > #kstr-verein { grid-column: 3; grid-row: 2 / span 3; position: sticky; top: 8px; }
${F} > #club-facilities { grid-column: 1 / 3; grid-row: 3; }
${F} > #ks-trainerteam { grid-column: 1 / 3; grid-row: 4; }
${F} > #kt-trikots { grid-column: 3; grid-row: 5; }
${F} > #kt-trikots svg { width: 80px !important; height: auto !important; }
${F} > #club-danger-zone { grid-column: 1 / 3; grid-row: 5; }
${F} > .club-chronicle { grid-column: 1 / -1; }
${F} #club-facilities { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
/* „Dein Trainer“ als Karte mit kleinem Bild */
${F} > #kstr-verein { background: var(--bg2); border: 2px solid var(--tz-linie, var(--border)); border-radius: 14px; padding: 12px; }
${F} #kstr-verein .kstr-pkopf { display: flex; gap: 12px; align-items: center; margin: 8px 0 10px; }
${F} #kstr-verein .kstr-pkopf small { display: block; }
${F} #kstr-verein .kstr-av { width: 84px !important; height: 84px !important; flex: none; border-radius: 50%; overflow: hidden; background: var(--bg3); }
${F} #kstr-verein .kstr-av svg { width: 84px !important; height: 84px !important; display: block; }
${F} #kstr-verein .kstr-wl { display: grid; grid-template-columns: 1fr; gap: 6px; }
${F} #kstr-verein .kstr-w { display: grid; grid-template-columns: 20px minmax(0, 1fr) auto; gap: 2px 6px; align-items: center; padding: 5px 0; border-bottom: 1px dashed var(--border); }
${F} #kstr-verein .kstr-w .kstr-bar, ${F} #kstr-verein .kstr-w small { grid-column: 2 / -1; }
${F} #kstr-verein .kstr-w small { font-size: 11.5px; color: var(--text3); }
/* Kickdraft: Anlagen */
${K} { grid-template-columns: repeat(4, minmax(0, 1fr)); }
${K} > #club-banner { grid-column: 1 / -1; grid-row: 1; }
${K} > .vt-reiter { grid-column: 1 / -1; grid-row: 2; }
${K} > #club-facilities { grid-column: 1 / -1; grid-row: 3; grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
${K} #club-facilities > div:first-child:not(.facility-card) { grid-column: 1 / -1; display: grid; grid-template-columns: 130px minmax(0, 1fr); gap: 12px; align-items: center; padding: 10px 14px !important; }
${K} #club-facilities > div:first-child:not(.facility-card) > div:nth-child(2) { display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; height: auto !important; }
${K} #club-facilities > div:first-child:not(.facility-card) > div:nth-child(2) > * { margin: 0 !important; }
${K} > #kt-trikots { grid-column: 4; grid-row: 4; }
${K} > #kt-trikots svg { width: 80px !important; height: auto !important; }
${K} > :not(#club-banner):not(.vt-reiter):not(#club-facilities):not(#kt-trikots) { grid-column: 1 / -1; }
@media (max-width: 1450px) { ${F} { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 330px; } }
`;
  function art() {
    if (document.body.classList.contains('ksfo-verein')) return 'fl';
    if (document.querySelector('#view-club .vt-reiter [data-vt="anlagen"].an')) return 'kd';
    return '';
  }
  function tick() {
    const w = document.querySelector('#view-club .club-wrap');
    if (!w) return;
    const a = an() ? art() : '';
    // am Element selbst prüfen – das Spiel setzt className beim Neuzeichnen zurück
    const ist = ['fl', 'kd'].find(k => w.classList.contains('pcve-' + k)) || '';
    if (ist === a && w.classList.contains('pcve-an') === !!a) return;
    w.classList.remove('pcve-an', 'pcve-fl', 'pcve-kd');
    if (a) w.classList.add('pcve-an', 'pcve-' + a);
  }
  function start() {
    if (document.getElementById('pcve-css')) return;
    const st = document.createElement('style'); st.id = 'pcve-css'; st.textContent = STIL; document.head.appendChild(st);
    document.addEventListener('click', () => setTimeout(tick, 0));
    setInterval(tick, 500);
    tick();
    console.log('[Kickstil-PC-Verein v1] aktiv — Verein als Dashboard: Vorstand + Trainer, Anlagen nebeneinander (nur PC ≥ 1200 px, beide Spiele)');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.KSPcVerein = { tick };
})();
