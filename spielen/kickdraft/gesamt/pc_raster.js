/* ===== kickstil_pc_raster.js =====
   KICKSTIL · PC-RASTER FÜR DIE ÜBRIGEN BEREICHE  ·  v1   (2026-10-19)
   ─────────────────────────────────────────────────────────────────────────────
   Nutzer 2026-10-19: „hast du das Spiel optisch so angepasst, dass es für den PC gemacht ist?“ → einheitliches PC-Raster
   für alle Bereiche, die noch die gestreckte App-Ansicht zeigen (Transfermarkt, Scouting, Liga & Pokal, Europa, Verein,
   Finanzen). Nur PC-Ansicht (body.pcu-an aus kickstil_pc_uebersicht.js), die Handy-Ansicht bleibt unverändert.
   · Blätter (Spieler, Vereinsblatt, Mehr, Trainerteam …) öffnen als Detailspalte rechts statt von unten.
   · Inhalte mittig auf höchstens 1440 px, Listen in zwei Spalten.
   · Liga: Tabelle und Spielplan nebeneinander.
   Reines CSS über den vorhandenen Teilen; neue Ansichten bei Bedarf hier einordnen.
   ============================================================================= */
(function () {
  'use strict';
  const CSS = `
/* ── Blätter als Detailspalte rechts ─────────────────────────────────────── */
/* Spieler-Blatt und Mehr-Blatt sind sonst nur in der Handy-Ansicht (body.dfl-shell) sichtbar – am PC öffnete ein Klick auf einen
   Spieler im Transfermarkt (kickstil_transfersuche.js) oder „Alle Details“ im Kader nichts (gefunden 2026-10-19) */
body.pcu-an #app-sheet, body.pcu-an #app-blatt { display: block; position: fixed; inset: 0; z-index: 9500; pointer-events: none; }
body.pcu-an #app-sheet.auf, body.pcu-an #app-blatt.auf { pointer-events: auto; }
body.pcu-an .app-blatt-box, body.pcu-an .app-sheet-box, body.pcu-an .vb-box, body.pcu-an .kstb-box {
  left: auto !important; right: 0 !important; top: 0 !important; bottom: 0 !important; margin: 0 !important;
  width: min(560px, 40vw) !important; max-width: none !important; max-height: none !important; height: 100vh;
  border-radius: 18px 0 0 18px !important; border-bottom: 3px solid var(--k-rahmen, #8b5a2b) !important;
  transform: translateX(105%) !important; padding-bottom: 24px !important;
}
body.pcu-an #app-blatt.auf .app-blatt-box, body.pcu-an #app-sheet.auf .app-sheet-box, body.pcu-an #vb-blatt.auf .vb-box,
body.pcu-an #ks-tt-blatt.auf .kstb-box { transform: none !important; }
body.pcu-an .app-blatt-box .app-griff, body.pcu-an .app-sheet-box .app-griff, body.pcu-an .vb-box .vb-griff, body.pcu-an .kstb-box .kstb-griff { display: none; }
body.pcu-an .app-sheet-bg, body.pcu-an .vb-bg, body.pcu-an .kstb-bg { background: rgb(6 6 5 / .38) !important; }

/* ── Kader: Seitenspalte mit Mannschaftswerten aus (wie kickstil_pc_kader.js in der Vereinskarriere; hier für Kickdraft) ── */
body.pcu-an #view-squad .sidebar, body.pcu-an #view-training .sidebar { display: none !important; }

/* ── Inhalte mittig begrenzen ─────────────────────────────────────────────── */
body.pcu-an #view-transfer > *, body.pcu-an #view-club > *, body.pcu-an #view-liga > *, body.pcu-an #view-europa > *, body.pcu-an #view-scout > * {
  max-width: 1440px; margin-left: auto !important; margin-right: auto !important; box-sizing: border-box;
}

/* ── Transfermarkt: Spielerliste zweispaltig ──────────────────────────────── */
body.pcu-an #tr-sub-markt.active { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 12px; align-content: start; }
body.pcu-an #tr-sub-markt > *:not(.kts-z) { grid-column: 1 / -1; }
body.pcu-an #tr-sub-markt > .kts-z { margin: 0 0 8px !important; }

/* ── Scouting: Spielerliste zweispaltig ───────────────────────────────────── */
body.pcu-an #ks-scouting .kss-liste { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 12px; align-content: start; }
body.pcu-an #ks-scouting .kss-liste > :not(.kss-zeile) { grid-column: 1 / -1; }

/* ── Europa: Tabelle nicht über die ganze Breite ──────────────────────────── */
body.pcu-an #view-europa .eu-table, body.pcu-an #view-europa .eu-legend { max-width: 1100px; }

/* ── Finanzen: Sponsoren als Raster ───────────────────────────────────────── */
body.pcu-an #view-club #sponsor-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px; }

/* ── Liga: Tabelle und Spielplan nebeneinander ────────────────────────────── */
body.pcu-an #view-liga .lg-wrap:has(#lg-sub-tabelle.active) { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); column-gap: 18px; align-items: start; }
body.pcu-an #view-liga .lg-wrap:has(#lg-sub-tabelle.active) > :not(#lg-sub-tabelle):not(#lg-sub-spielplan) { grid-column: 1 / -1; }
body.pcu-an #view-liga .lg-wrap:has(#lg-sub-tabelle.active) > #lg-sub-tabelle { grid-column: 1; }
body.pcu-an #view-liga .lg-wrap:has(#lg-sub-tabelle.active) > #lg-sub-spielplan { display: block; grid-column: 2; max-height: calc(100vh - 150px); overflow-y: auto; position: sticky; top: 12px; }

/* ── Verein: Abschnitte als Kacheln ───────────────────────────────────────── */
body.pcu-an #view-club #exp-panel { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; align-items: start; }
body.pcu-an #view-club #club-facilities { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 14px; }
body.pcu-an #view-club #club-facilities .facility-card { width: auto !important; max-width: none !important; margin: 0 !important; }
`;
  // Das Spieler-Blatt baut kickstil_app_shell.js nur, wenn das Spiel in der Handy-Ansicht startet – am PC fehlte es ganz
  function blattAnlegen() {
    if (document.getElementById('app-blatt') || !document.body) return;
    const blatt = document.createElement('div'); blatt.id = 'app-blatt';
    blatt.innerHTML = '<div class="app-sheet-bg"></div><div class="app-blatt-box" role="dialog" aria-modal="true"></div>';
    blatt.addEventListener('click', ev => {
      if (!ev.target.closest('.app-sheet-bg') && !ev.target.closest('.app-blatt-zu')) return;
      if (window.DFLAppShell && DFLAppShell.blattZu) DFLAppShell.blattZu(); else { blatt.classList.remove('auf'); document.body.classList.remove('app-gesperrt'); }
    });
    document.body.appendChild(blatt);
  }
  function einbauen() {
    blattAnlegen();
    if (document.getElementById('pcr-css')) return;
    const st = document.createElement('style'); st.id = 'pcr-css'; st.textContent = CSS; document.head.appendChild(st);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', einbauen); else einbauen();
  console.log('[Kickstil-PC-Raster v1] aktiv — Detailspalte rechts, Listen zweispaltig, Liga nebeneinander (nur PC-Ansicht)');
})();
