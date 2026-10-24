/* ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
   Kickstil – Übersicht am PC (2026-10-18, nur PC-Version)
   Nur in der PC-App (window.FcmPc aus pc_app/preload.js) und ab 1200 px Fensterbreite. App und Browser bleiben
   unverändert; zum Testen im Browser localStorage „pcs-test“ = „an“ (wie kickstil_pc_spieltag.js).
   · Navigation links statt der Reiterleiste oben, Tasten 1–0 für die Bereiche, dazu Speichern (Strg+S) und Verwaltung.
   · Übersicht als Schreibtisch: oben Verein, Moral und Woche (Leertaste = Woche weiter); Mitte Stadt, nächstes Spiel,
     Tabellenplatz/Budget/Vorstand/Aufgaben, unten Kalender und Tabellenausschnitt um den eigenen Platz; rechts das Postfach.
   Die vorhandenen Teile der Übersicht werden nur per CSS-Raster umgestellt (display: contents) – Inhalte und Logik
   bleiben die der App. Neu ist nur der Tabellenausschnitt (#pcu-tabelle, aus computeTable wie die Liga-Ansicht).
   Tasten wirken nur, wenn nichts über der Ansicht liegt (kein Blatt, kein Ticker, kein Vollbild).
   ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const W = window;
  const CFG = { breite: 1200, takt: 1000, umPlatz: 2, oben: 2 };
  // Kickdraft (2026-10-19, Nutzer: PC-Raster „auf alles ausrollen“): dieselbe Datei läuft dort als gesamt/pc_uebersicht.js
  // (gesamt_app/bauen.sh) – Navigation, Tasten und Raster gleich, die Übersicht mit eigener Anordnung, ohne Tabellenausschnitt
  const KD = /\/kickdraft\//.test(location.pathname);
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const istPc = () => { if (W.FcmPc) return true; try { return localStorage.getItem('pcs-test') === 'an'; } catch (e) { return false; } };
  const mq = W.matchMedia ? W.matchMedia(`(min-width: ${CFG.breite}px)`) : null;
  const breit = () => istPc() && !!(mq && mq.matches);
  // Tasten 1 … 9, 0 = sichtbare Reiter in ihrer Reihenfolge (ausgeblendete wie Europa ohne Teilnahme zählen nicht)
  let bereiche = [];

  const CSS = `
body.pcu-an .app { display: grid; grid-template-columns: 216px minmax(0, 1fr); overflow: visible; border-radius: 0; }
body.pcu-an .app > * { grid-column: 2; min-width: 0; }
body.pcu-an .app > .appnav { grid-column: 1; grid-row: 1 / span 40; align-self: start; position: sticky; top: 0; z-index: 5;
  flex-direction: column; flex-wrap: nowrap; gap: 4px; overflow: visible; padding: 14px 0 14px 14px; scroll-snap-type: none; }
body.pcu-an .appnav-btn { justify-content: flex-start; width: 100%; border-radius: 12px; padding: 9px 12px; font-size: 14.5px; white-space: normal; text-align: left; line-height: 1.15; }
body.pcu-an .appnav-btn:hover { transform: none; }

.pcu-taste { margin-left: auto; flex: none; font-family: var(--font-text, system-ui), sans-serif; font-size: 10.5px; font-weight: 800; min-width: 20px; text-align: center;
  padding: 1px 5px; border-radius: 6px; border: 1px solid var(--k-linie, var(--border)); border-bottom-width: 2px; color: var(--text3); background: var(--bg, transparent); line-height: 1.4; }
.appnav-btn.active .pcu-taste { color: inherit; background: rgba(255,255,255,.2); border-color: rgba(255,255,255,.4); }
.pcu-taste, .pcu-extra, #pcu-tabelle { display: none; }
/* Tipp-Kärtchen (kickstil_neu.js) am PC unten rechts statt über dem Kopf der Übersicht */
body.pcu-an #ks-tipp { top: auto; bottom: 18px; left: auto; right: 18px; margin: 0; width: 460px; max-width: calc(100vw - 36px); transform: translateY(160%); }
body.pcu-an #ks-tipp.auf { transform: none; }
body.pcu-an .pcu-taste { display: inline-block; }
body.pcu-an .pcu-extra { display: flex; box-shadow: none; background: transparent; font-size: 13.5px; }
body.pcu-an .pcu-trenner { display: block; height: 0; border-top: 1px dashed var(--k-linie, var(--border)); margin: 6px 8px 2px; }


#pcu-tabelle { background: var(--bg2); border: 2px solid var(--k-linie, var(--border)); border-radius: 14px; overflow: hidden; }
#pcu-tabelle .pcu-t-kopf { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; padding: 9px 12px 6px; }
#pcu-tabelle .pcu-t-kopf b { font-family: var(--font-display, inherit); font-size: 15px; }
#pcu-tabelle .pcu-t-kopf small { font-size: 11px; font-weight: 700; color: var(--text3); }
#pcu-tabelle table { width: 100%; border-collapse: collapse; font-size: 13px; font-variant-numeric: tabular-nums; }
#pcu-tabelle th { font-size: 10.5px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--text3); text-align: right; padding: 2px 8px; }
#pcu-tabelle th:nth-child(2) { text-align: left; }
#pcu-tabelle td { padding: 4px 8px; text-align: right; white-space: nowrap; }
#pcu-tabelle td.pcu-t-name { text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 0; width: 100%; }
#pcu-tabelle td.pcu-t-platz { color: var(--text3); font-weight: 800; width: 52px; text-align: left; white-space: nowrap; }
#pcu-tabelle .pcu-pf { margin-left: 4px; font-size: 10px; } #pcu-tabelle .pcu-pf.auf { color: var(--app-gut, #2e9e4f); } #pcu-tabelle .pcu-pf.ab { color: var(--app-schlecht, #d0402f); }
#pcu-tabelle td.pcu-t-pkt { font-weight: 800; }
#pcu-tabelle tr[data-team] { cursor: pointer; } #pcu-tabelle tr[data-team]:hover td { background: var(--bg3, rgba(0,0,0,.04)); }
#pcu-tabelle tr.pcu-t-wir td { background: color-mix(in srgb, var(--accent) 16%, transparent); font-weight: 800; }
#pcu-tabelle tr.pcu-t-luecke td { color: var(--text3); text-align: center; padding: 0; font-size: 11px; line-height: 1.1; }
#pcu-tabelle .pcu-t-fuss { display: flex; justify-content: flex-end; padding: 6px 10px 9px; border-top: 1px dashed var(--k-linie, var(--border)); }
#pcu-tabelle .pcu-t-fuss button { all: unset; cursor: pointer; font-size: 12.5px; font-weight: 800; color: var(--text2); display: inline-flex; gap: 6px; align-items: center; }
#pcu-tabelle .pcu-t-fuss button:hover { color: var(--text); }
#pcu-tabelle button:focus-visible, body.pcu-an .appnav-btn:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
#pcu-toast { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); z-index: 9999; background: var(--bg2); color: var(--text);
  border: 2px solid var(--k-linie, var(--border)); border-radius: 12px; padding: 8px 16px; font-weight: 800; box-shadow: 0 4px 0 var(--k-linie, var(--border)); }
/* doppelt: Training steckt im Kader (Taste 2, dann T) – beide Spiele (Kickdraft seit 2026-10-20, Nutzer: „wie Flutlicht“) */
body.pcu-an .app > .appnav > #nav-training { display: none; }
/* Weiter-Knopf (Nutzer 2026-10-24, Vorschau A: „der hässliche Button oben passt nicht in unser Design und es läuft dadurch auch nicht“):
   statt „Woche weiter“ des Kalenders ein Knopf im Spiel-Look, der genau das macht, was die Leertaste macht (DFLAppShell.ctaZustand:
   zum Spiel, Testspiel, Draft, Kader auffüllen … sonst Woche weiter). Der alte Kalender-Knopf bleibt versteckt im DOM (andere Module klicken ihn). */
body.pcu-an #view-home .cal-head .cal-next { display: none !important; }
body.pcu-an #view-home .cal-head { display: flex; align-items: center; gap: 8px; }
#pcu-weiter { margin-left: auto; display: inline-flex; align-items: center; gap: 12px; padding: 7px 10px 7px 14px; border-radius: 12px; cursor: pointer; font: inherit; text-align: left;
  min-width: 0; max-width: 100%; background: #2e9b57; color: #fff; border: 2px solid #1f7a42; box-shadow: 0 4px 0 #17603a; transition: transform .08s, box-shadow .08s; }
#pcu-weiter:hover { filter: brightness(1.06); }
#pcu-weiter:active { transform: translateY(3px); box-shadow: 0 1px 0 #17603a; }
#pcu-weiter.warn { background: #d9822b; border-color: #b0651c; box-shadow: 0 4px 0 #8c4f14; }
#pcu-weiter > .ti { font-size: 20px; flex: none; }
#pcu-weiter .pcu-w-txt { display: flex; flex-direction: column; line-height: 1.15; min-width: 0; }
#pcu-weiter .pcu-w-txt b { font: 800 16px/1.1 var(--font-titel, var(--font-display, system-ui)); white-space: nowrap; }
#pcu-weiter .pcu-w-txt small { font-size: 11px; opacity: .88; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#pcu-weiter kbd { font: 800 10px/1 var(--font-text, system-ui); padding: 3px 7px; border-radius: 6px; border: 1px solid rgba(255,255,255,.5); background: rgba(255,255,255,.18); flex: none; }
body.pcu-an #view-home .cal-head #dfl-sim-pc { flex: none; width: 44px; height: 44px; padding: 0; margin: 0; display: grid; place-items: center; font-size: 0; border-radius: 12px; cursor: pointer;
  color: var(--text); background: var(--bg2); border: 2px solid var(--k-rand, #c99a62); box-shadow: 0 4px 0 var(--k-rand, #c99a62); }
body.pcu-an #view-home .cal-head #dfl-sim-pc[hidden] { display: none; }
body.pcu-an #view-home .cal-head #dfl-sim-pc .ti { font-size: 19px; }
body.pcu-an #view-home .cal-head #dfl-sim-pc:active { transform: translateY(3px); box-shadow: 0 1px 0 var(--k-rand, #c99a62); }
@media (max-width: 1450px) { #pcu-weiter kbd { display: none; } #pcu-weiter .pcu-w-txt b { font-size: 15px; } }
/* Münze des Ladens (Erfolge, „W 0“): steht ohne Vereinsgelände (Kickdraft am PC) oben rechts auf der Übersicht und lag über dem
   Vorspul-Knopf – am PC in die Wochen-Karte vor den Weiter-Knopf (weiterKnopf hängt sie um) */
body.pcu-an #view-home .cal-head .ef-chip { position: static; margin-left: auto; flex: none; }
body.pcu-an #view-home .cal-head .ef-chip + #pcu-weiter { margin-left: 4px; }
/* Postfach-Karten (Angebot, Trade-Anfrage): ihr Raster hat drei Spalten (Zeichen, Titel, Knopf); in der schmalen PC-Spalte
   stand „Ansehen“ dadurch über dem Titel – hier Zeichen + Titel, Karte, Zeile darunter, Knöpfe ganz unten */
body.pcu-an #view-home .postfach-section .pf-item:has(.pfk), body.pcu-an #view-home .postfach-section .pf-item:has(.ks-angebot) {
  grid-template-columns: 34px minmax(0, 1fr); grid-template-areas: "ico titel" "karte karte" "meta meta" "akt akt"; align-items: center; }
body.pcu-an #view-home .postfach-section .pf-item:has(.pfk) .pf-actions, body.pcu-an #view-home .postfach-section .pf-item:has(.ks-angebot) .pf-actions { grid-area: akt; margin-top: 8px; }
/* Transferangebot (Vereinskarriere): Karte nicht mehr unter das Zeichen ziehen (am Handy -51 px), sondern eigene Zeile über die ganze Breite */
body.pcu-an #view-home .postfach-section .pf-item:has(.ks-angebot) .pf-ico { grid-area: ico; }
body.pcu-an #view-home .postfach-section .pf-item:has(.ks-angebot) .pf-body { display: contents; }
body.pcu-an #view-home .postfach-section .pf-item:has(.ks-angebot) .pf-title { grid-area: titel; min-width: 0; }
body.pcu-an #view-home .postfach-section .pf-item:has(.ks-angebot) .pf-text { grid-area: karte; margin-left: 0; width: auto; overflow: visible; display: block; -webkit-line-clamp: unset; }
body.pcu-an #view-home .postfach-section .pf-item:has(.ks-angebot) .pf-meta { grid-area: meta; }
`;

  // Übersicht als Schreibtisch – Vereinskarriere
  const CSS_FL = `
body.pcu-an #view-home.active { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)) minmax(280px, 340px); gap: 14px; padding: 14px; align-items: start; }
body.pcu-an #view-home .home-wrap, body.pcu-an #view-home .home-grid, body.pcu-an #view-home #calendar-widget { display: contents; }
body.pcu-an #view-home .home-wrap > *, body.pcu-an #view-home .home-grid > *, body.pcu-an #view-home > * { grid-column: 1 / 5; margin: 0; min-width: 0; }
body.pcu-an #view-home .home-grid > .home-club { grid-area: 1 / 1 / 2 / 3; align-self: stretch; }
body.pcu-an #view-home > .k-moral { grid-area: 1 / 3 / 2 / 4; align-self: stretch; padding: 8px 12px; }
body.pcu-an #view-home > .k-moral .k-skala-text { display: none; }
body.pcu-an #view-home > .k-moral .k-moral-kopf { margin-bottom: 6px; }
body.pcu-an #view-home #calendar-widget > .cal-head { grid-area: 1 / 4 / 2 / 6; align-self: stretch; margin: 0; padding: 10px 16px; align-items: center;
  background: var(--bg2); border: 2px solid var(--k-linie, var(--border)); border-radius: 14px; }
body.pcu-an #view-home > #app-office-kopf { grid-area: 2 / 1 / 3 / 5; }
body.pcu-an #app-office-kopf.ks-pc-kopf .gel-buehne { height: clamp(200px, 15.5vw, 290px); }
body.pcu-an #view-home .home-grid > .home-match { grid-area: 3 / 1 / 4 / 5; display: grid; grid-template-columns: minmax(0, 1fr) auto; column-gap: 18px; align-items: center; padding-block: 10px; }
body.pcu-an #view-home .home-match > .hc-label { grid-column: 1 / 3; margin-bottom: 4px; }
body.pcu-an #view-home .home-match > .hm-teams { grid-column: 1; margin: 0; }
body.pcu-an #view-home .home-match > .hc-action { grid-column: 2; margin: 0; white-space: nowrap; }
body.pcu-an #view-home .home-grid > .home-card { min-height: 0; }
body.pcu-an #view-home .home-grid > .home-card .hc-big { font-size: 28px; }
body.pcu-an #view-home .home-match .hm-name { white-space: normal; overflow: visible; text-overflow: clip; }
@media (max-width: 1450px) {
  body.pcu-an .app { grid-template-columns: 188px minmax(0, 1fr); }
  body.pcu-an .appnav-btn { font-size: 13.5px; padding: 8px 10px; }
  body.pcu-an #view-home.active { grid-template-columns: repeat(4, minmax(0, 1fr)) minmax(250px, 290px); gap: 12px; padding: 12px; }
  body.pcu-an #view-home .home-grid > .home-card .hc-big { font-size: 23px; }
  body.pcu-an #view-home > .k-moral .k-moral-effekt { display: none; }
}
body.pcu-an #view-home .home-grid > .home-card:has(#hc-position) { grid-area: 4 / 1 / 5 / 2; align-self: stretch; }
body.pcu-an #view-home .home-grid > .home-card:has(#hc-budget) { grid-area: 4 / 2 / 5 / 3; align-self: stretch; }
body.pcu-an #view-home .home-grid > .home-card:has(#exp-home-card) { grid-area: 4 / 3 / 5 / 4; align-self: stretch; }
body.pcu-an #view-home .home-grid > .home-tasks { grid-area: 4 / 4 / 5 / 5; align-self: stretch; }
body.pcu-an #view-home .home-tasks .tasks-chips { flex-wrap: wrap; }
body.pcu-an #view-home #calendar-widget > .cal-schedule { grid-area: 5 / 1 / 6 / 3; margin: 0; padding: 8px 10px; max-height: none;
  background: var(--bg2); border: 2px solid var(--k-linie, var(--border)); border-radius: 14px; }
body.pcu-an #view-home .home-wrap > #pcu-tabelle { display: block; grid-area: 5 / 3 / 6 / 5; }
body.pcu-an #view-home .home-wrap > .mgmt-details { grid-area: 6 / 1 / 7 / 5; }
body.pcu-an #view-home .home-wrap > .postfach-section { grid-area: 1 / 5 / 8 / 6; grid-row: 2 / span 6; position: sticky; top: 14px;
  max-height: calc(100vh - 28px); overflow: auto; overscroll-behavior: contain; }
body.pcu-an #view-home .postfach-section .pf-head { flex-direction: column; align-items: stretch; gap: 8px; }
body.pcu-an #view-home .postfach-section #pf-filters.pf-filters { display: flex; flex-wrap: nowrap; gap: 3px; padding: 3px; margin-top: 6px; width: auto; overflow: visible; }
body.pcu-an #view-home .postfach-section #pf-filters .pf-chip { position: relative; flex: 1 1 auto; width: auto; min-width: 0; min-height: 30px; padding: 3px 5px; font-size: 11.5px; white-space: nowrap; overflow: visible; }
/* Zähler als kleines Abzeichen an der Ecke statt im Knopf – so passen alle Filter in eine Zeile */
body.pcu-an #view-home .postfach-section #pf-filters .pf-cnt { position: absolute; top: -6px; right: -3px; min-width: 15px; height: 15px; padding: 0 3px; margin: 0; font-size: 9.5px; line-height: 15px;
  background: var(--k-rot, #c0392b); color: #fff; box-shadow: 0 0 0 2px var(--bg2, #fff); z-index: 1; }
/* „Leeren“ nur als Papierkorb – sonst bricht die Leiste in der schmalen Spalte in zwei Zeilen (Nutzer 2026-10-24: „die Leisten sind nicht dafür gemacht“) */
body.pcu-an #view-home .postfach-section #pf-filters .pf-chip.pf-leeren { flex: 0 0 32px; font-size: 0; padding: 0; margin-left: 2px; }
body.pcu-an #view-home .postfach-section #pf-filters .pf-chip.pf-leeren > .ti { display: inline-block; font-size: 16px; }
body.pcu-an #view-home .postfach-section .pf-item { display: grid; grid-template-columns: 34px minmax(0, 1fr); column-gap: 10px; align-items: start; }
body.pcu-an #view-home .postfach-section .pf-actions { grid-column: 2; flex-direction: row; flex-wrap: wrap; justify-content: flex-start; gap: 6px; margin-top: 8px; }
`;
  // Übersicht – Kickdraft wie die Vereinskarriere (Nutzer 2026-10-22: „sieht terrible aus“ → Rückfrage „Wie Flutlicht“): fünf Spalten,
  // oben Verein · Moral · Woche, darunter die Wochenleiste, das nächste Spiel als Streifen, vier Karten (Tabellenplatz, Kasse,
  // Eigentümer & Fans, Aufgaben), unten Spielvorschau und erste Schritte; rechts durchgehend das Postfach. Inhalte und Logik bleiben.
  const CSS_KD = `
body.pcu-an #view-home.active { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)) minmax(280px, 340px); gap: 14px; padding: 14px; align-items: start; }
body.pcu-an #view-home .home-wrap, body.pcu-an #view-home .home-grid, body.pcu-an #view-home #calendar-widget { display: contents; }
body.pcu-an #view-home > *, body.pcu-an #view-home .home-wrap > *, body.pcu-an #view-home .home-grid > *, body.pcu-an #view-home #calendar-widget > * { grid-column: 1 / 5; margin: 0 !important; min-width: 0; }
body.pcu-an #view-home .home-grid > .home-club { grid-area: 1 / 1 / 2 / 3; align-self: stretch; }
body.pcu-an #view-home > .k-moral { grid-area: 1 / 3 / 2 / 4; align-self: stretch; padding: 8px 12px; }
body.pcu-an #view-home > .k-moral .k-skala-text { display: none; }
body.pcu-an #view-home > .k-moral .k-moral-kopf { margin-bottom: 6px; }
body.pcu-an #view-home #calendar-widget > .cal-head { grid-area: 1 / 4 / 2 / 6; align-self: stretch; padding: 10px 16px; align-items: center; flex-wrap: wrap; gap: 8px;
  background: var(--bg2); border: 2px solid var(--k-linie, var(--border)); border-radius: 14px; }
body.pcu-an #view-home #calendar-widget > .kw-leiste { grid-area: 2 / 1 / 3 / 5; background: var(--bg2); border: 2px solid var(--k-linie, var(--border)); border-radius: 14px; padding: 8px; }
body.pcu-an #view-home .home-grid > .home-match { grid-area: 3 / 1 / 4 / 5; display: grid; grid-template-columns: minmax(0, 1fr) auto; column-gap: 18px; align-items: center; padding-block: 10px; }
body.pcu-an #view-home .home-match > .hc-label { grid-column: 1 / 3; margin-bottom: 4px; }
body.pcu-an #view-home .home-match > .hm-teams { grid-column: 1; margin: 0; }
body.pcu-an #view-home .home-match > .hc-action { grid-column: 2; margin: 0; white-space: nowrap; }
body.pcu-an #view-home .home-match .hm-name { white-space: normal; overflow: visible; text-overflow: clip; }
body.pcu-an #view-home .home-grid > .home-card:not(.home-club):not(.home-match):not(.home-tasks) { grid-row: 4; grid-column: auto; align-self: stretch; min-height: 0; }
body.pcu-an #view-home .home-grid > .home-card .hc-big { font-size: 28px; }
body.pcu-an #view-home .home-grid > .home-tasks { grid-area: 4 / 4 / 5 / 5; align-self: stretch; }
body.pcu-an #view-home .home-tasks .tasks-chips { flex-wrap: wrap; }
body.pcu-an #view-home > #sim-office-vorschau { grid-area: 5 / 1 / 6 / 3; }
body.pcu-an #view-home > #sim-office-vorschau .sim-tafel { width: auto; max-width: none; }
body.pcu-an #view-home > #dfl-erste-schritte { grid-area: 5 / 3 / 6 / 5; }
body.pcu-an #view-home .home-wrap > .mgmt-details { grid-area: 6 / 1 / 7 / 5; }
body.pcu-an #view-home .home-wrap > .postfach-section { grid-area: 1 / 5 / 8 / 6; grid-row: 2 / span 6; position: sticky; top: 14px;
  max-height: calc(100vh - 28px); overflow: auto; overscroll-behavior: contain; }
body.pcu-an #view-home .postfach-section .pf-head { flex-direction: column; align-items: stretch; gap: 8px; }
body.pcu-an #view-home .postfach-section #pf-filters.pf-filters { display: flex; flex-wrap: nowrap; gap: 3px; padding: 3px; margin-top: 6px; width: auto; overflow: visible; }
body.pcu-an #view-home .postfach-section #pf-filters .pf-chip { position: relative; flex: 1 1 auto; width: auto; min-width: 0; min-height: 30px; padding: 3px 5px; font-size: 11.5px; white-space: nowrap; overflow: visible; }
/* Zähler als kleines Abzeichen an der Ecke statt im Knopf – so passen alle Filter in eine Zeile */
body.pcu-an #view-home .postfach-section #pf-filters .pf-cnt { position: absolute; top: -6px; right: -3px; min-width: 15px; height: 15px; padding: 0 3px; margin: 0; font-size: 9.5px; line-height: 15px;
  background: var(--k-rot, #c0392b); color: #fff; box-shadow: 0 0 0 2px var(--bg2, #fff); z-index: 1; }
/* „Leeren“ nur als Papierkorb – sonst bricht die Leiste in der schmalen Spalte in zwei Zeilen (Nutzer 2026-10-24: „die Leisten sind nicht dafür gemacht“) */
body.pcu-an #view-home .postfach-section #pf-filters .pf-chip.pf-leeren { flex: 0 0 32px; font-size: 0; padding: 0; margin-left: 2px; }
body.pcu-an #view-home .postfach-section #pf-filters .pf-chip.pf-leeren > .ti { display: inline-block; font-size: 16px; }
body.pcu-an #view-home .postfach-section .pf-item { display: grid; grid-template-columns: 34px minmax(0, 1fr); column-gap: 10px; align-items: start; }
body.pcu-an #view-home .postfach-section .pf-actions { grid-column: 2; flex-direction: row; flex-wrap: wrap; justify-content: flex-start; gap: 6px; margin-top: 8px; }
@media (max-width: 1450px) {
  body.pcu-an #view-home.active { grid-template-columns: repeat(4, minmax(0, 1fr)) minmax(250px, 290px); gap: 12px; padding: 12px; }
  body.pcu-an #view-home .home-grid > .home-card .hc-big { font-size: 23px; }
}
`;

  // ── Navigation ───────────────────────────────────────────────────────────────────────────────────────────────
  function navAusbauen() {
    const nav = document.querySelector('.app > .appnav'); if (!nav) return;
    bereiche = [...nav.querySelectorAll('.appnav-btn:not(.pcu-extra)')].filter(b => getComputedStyle(b).display !== 'none').slice(0, 10);
    bereiche.forEach((b, i) => {
      const z = String((i + 1) % 10); let k = b.querySelector('.pcu-taste');
      if (!k) { k = document.createElement('kbd'); k.className = 'pcu-taste'; k.setAttribute('aria-hidden', 'true'); b.appendChild(k); }
      if (k.textContent !== z) { k.textContent = z; b.setAttribute('aria-keyshortcuts', z); }
    });
    if (!nav.querySelector('.pcu-extra')) {
      nav.insertAdjacentHTML('beforeend', `<span class="pcu-trenner pcu-extra" aria-hidden="true"></span>
        <button type="button" class="appnav-btn pcu-extra" data-pcu="speichern" aria-keyshortcuts="Control+S"><i class="ti ti-device-floppy" aria-hidden="true"></i>Speichern<kbd class="pcu-taste" aria-hidden="true">Strg S</kbd></button>
        <button type="button" class="appnav-btn pcu-extra" data-pcu="verwaltung"><i class="ti ti-settings" aria-hidden="true"></i>Spielstand &amp; Verwaltung</button>`);
      nav.addEventListener('click', ev => {
        const b = ev.target.closest('[data-pcu]'); if (!b) return;
        if (b.getAttribute('data-pcu') === 'speichern') speichern(); else verwaltung();
      });
    }
  }
  function bereich(i) {
    const b = bereiche[i];
    if (b && b.offsetParent !== null && !b.disabled) { b.click(); W.scrollTo({ top: 0 }); }
  }
  function toast(text) {
    let t = $('pcu-toast'); if (!t) { t = document.createElement('div'); t.id = 'pcu-toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = text; t.hidden = false; clearTimeout(toast.zu); toast.zu = setTimeout(() => { t.hidden = true; }, 1800);
  }
  async function speichern() {
    if (typeof saveGameState !== 'function' || typeof LEAGUE === 'undefined' || !LEAGUE) return;
    try { await saveGameState(); toast('Gespeichert'); } catch (e) { console.warn('[Kickstil-PC-Übersicht] Speichern', e); toast('Speichern hat nicht geklappt'); }
  }
  function verwaltung() {
    if (!$('view-home') || !$('view-home').classList.contains('active')) { const h = $('nav-home'); if (h) h.click(); }
    const d = document.querySelector('#view-home .mgmt-details'); if (!d) return;
    d.open = true; d.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // ── Tabellenausschnitt ───────────────────────────────────────────────────────────────────────────────────────
  let zuletzt = '';
  function tabelleZeichnen() {
    const wrap = document.querySelector('#view-home .home-wrap'); if (!wrap) return;
    let box = $('pcu-tabelle');
    if (!box || box.parentNode !== wrap) { if (box) box.remove(); box = document.createElement('section'); box.id = 'pcu-tabelle'; box.setAttribute('aria-label', 'Tabelle'); wrap.appendChild(box); zuletzt = ''; }
    let teams = [];
    try { const g = typeof findFcmGroup === 'function' && typeof LEAGUE !== 'undefined' && LEAGUE ? findFcmGroup(LEAGUE) : null; teams = g && typeof computeTable === 'function' ? computeTable(g.group.teams) : []; } catch (e) { teams = []; }
    const ich = teams.findIndex(t => t.id === 'fcm');
    const ligaEl = $('hc-tier'), liga = ((ligaEl && ligaEl.textContent) || '').split('·')[0].trim() || 'Tabelle';
    const sig = liga + '|' + teams.map(t => t.id + t.pts + t.played + t.gf + t.ga).join(',') + '|' + (((typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.ksPlatzVorher) || {}).md || 0);
    if (sig === zuletzt) return; zuletzt = sig;
    if (ich < 0) { box.innerHTML = ''; return; }
    const zeigen = new Set();
    for (let i = 0; i < Math.min(CFG.oben, teams.length); i++) zeigen.add(i);
    for (let i = Math.max(0, ich - CFG.umPlatz); i <= Math.min(teams.length - 1, ich + CFG.umPlatz); i++) zeigen.add(i);
    zeigen.add(teams.length - 1);
    const liste = [...zeigen].sort((a, b) => a - b);
    // Pfeile wie in der Ligatabelle (kickstil_tabellenpfeile.js, App 2026-10-22): Platz gegenüber dem Spieltag davor
    const V = typeof LEAGUE !== 'undefined' && LEAGUE ? LEAGUE.ksPlatzVorher : null, ids = teams.map(t => t.id);
    const vor = V && V.saison === LEAGUE.season ? Object.values(V.plaetze || {}).find(m => ids.every(id => m[id] != null)) : null;
    const pfeil = (t, i) => { const d = vor ? vor[t.id] - (i + 1) : 0; return d > 0 ? `<span class="pcu-pf auf">▲${d}</span>` : d < 0 ? `<span class="pcu-pf ab">▼${-d}</span>` : ''; };
    let zeilen = '', vorher = -1;
    for (const i of liste) {
      if (vorher >= 0 && i > vorher + 1) zeilen += '<tr class="pcu-t-luecke"><td colspan="5">…</td></tr>';
      const t = teams[i], gd = t.gf - t.ga;
      zeilen += `<tr${t.id === 'fcm' ? ' class="pcu-t-wir"' : ` data-team="${esc(t.id)}"`}><td class="pcu-t-platz">${i + 1}.${pfeil(t, i)}</td><td class="pcu-t-name">${esc(t.name)}</td>
        <td>${t.played}</td><td>${gd > 0 ? '+' : ''}${gd}</td><td class="pcu-t-pkt">${t.pts}</td></tr>`;
      vorher = i;
    }
    const gespielt = teams.some(t => t.played > 0);
    box.innerHTML = `<div class="pcu-t-kopf"><b>${esc(liga)}</b><small>${gespielt ? (ich + 1) + '. von ' + teams.length : 'vor dem 1. Spieltag'}</small></div>
      <table><thead><tr><th></th><th>Verein</th><th>Sp</th><th>TD</th><th>Pkt</th></tr></thead><tbody>${zeilen}</tbody></table>
      <div class="pcu-t-fuss"><button type="button" data-pcu-t="liga">Ganze Tabelle →</button></div>`;
  }
  function tabelleKlick(ev) {
    const box = ev.target.closest('#pcu-tabelle'); if (!box) return;
    if (ev.target.closest('[data-pcu-t="liga"]')) { const l = $('nav-liga'); if (l) l.click(); W.scrollTo({ top: 0 }); return; }
    const z = ev.target.closest('tr[data-team]');
    if (z && W.KSVereinsblatt) W.KSVereinsblatt.oeffnen(z.getAttribute('data-team'));
  }

  // ── Tasten ───────────────────────────────────────────────────────────────────────────────────────────────────
  // Frei = nichts liegt über der Ansicht: die Bildschirmmitte gehört zur App, kein Blatt (app-gesperrt), kein Ticker
  function frei() {
    if (document.body.classList.contains('app-gesperrt')) return false;
    const ts = $('dfl-ts'); if (ts && !ts.hidden && ts.offsetParent !== null) return false;
    const el = document.elementFromPoint(W.innerWidth / 2, W.innerHeight / 2);
    return !!(el && el.closest('.app'));
  }
  // Weiter wie der Haupt-Knopf der App (Leertaste und #pcu-weiter); false, wenn gerade nichts geht
  const ctaJetzt = () => { try { return W.DFLAppShell && DFLAppShell.ctaZustand ? DFLAppShell.ctaZustand() : null; } catch (e) { return null; } };
  function weiter() {
    const c = ctaJetzt();
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    if (c && typeof c.go === 'function') { c.go(); setTimeout(weiterKnopf, 80); return true; }
    const n = document.querySelector('#calendar-widget .cal-next');
    if (n && !n.disabled) { n.click(); setTimeout(weiterKnopf, 80); return true; }
    return false;
  }
  function weiterKnopf() {
    if (!document.body.classList.contains('pcu-an')) return;
    const head = document.querySelector('#view-home #calendar-widget .cal-head'); if (!head) return;
    let k = $('pcu-weiter');
    if (!k || k.parentNode !== head) {
      if (k) k.remove();
      k = document.createElement('button'); k.type = 'button'; k.id = 'pcu-weiter';
      k.addEventListener('click', ev => { ev.preventDefault(); weiter(); });
      const sim = $('dfl-sim-pc');
      if (sim && sim.parentNode === head) head.insertBefore(k, sim); else head.appendChild(k);
    }
    const chip = document.querySelector('#view-home > .ef-chip');
    if (chip) head.insertBefore(chip, k);
    const c = ctaJetzt() || { text: 'Woche weiter', sub: '', icon: 'ti-arrow-right' };
    // Unterzeile nicht doppelt: „KW1 · Juli 2026“ steht schon links in der Karte
    const kw = head.querySelector('.cal-week'), sub = c.sub && !(kw && kw.textContent.trim() === String(c.sub).trim()) ? c.sub : '';
    const html = `<i class="ti ${c.icon || 'ti-arrow-right'}" aria-hidden="true"></i><span class="pcu-w-txt"><b>${c.text}</b>${sub ? `<small>${sub}</small>` : ''}</span><kbd>Leertaste</kbd>`;
    if (k.innerHTML !== html) k.innerHTML = html;
    k.classList.toggle('warn', !!c.warn);
    const sim = $('dfl-sim-pc');
    if (sim) { const t = sim.textContent.trim() === 'weiter' ? 'Simulation fortsetzen' : 'Simulieren bis …'; if (sim.title !== t) { sim.title = t; sim.setAttribute('aria-label', t); } }
  }
  function taste(ev) {
    if (!document.body.classList.contains('pcu-an') || ev.altKey || ev.metaKey || ev.defaultPrevented) return;
    const ziel = ev.target || {};
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(ziel.tagName || '') || ziel.isContentEditable) return;
    if (ev.ctrlKey) {
      if ((ev.key === 's' || ev.key === 'S') && frei()) { ev.preventDefault(); speichern(); }
      return;
    }
    if (!frei()) return;
    if (/^[0-9]$/.test(ev.key)) { ev.preventDefault(); bereich(ev.key === '0' ? 9 : +ev.key - 1); return; }
    if (ev.key === ' ' && $('view-home') && $('view-home').classList.contains('active')) {
      // Nutzer 2026-10-22: „die Leertaste soll mich schnell zum Spieltag bringen, mehr nicht“ – sie macht genau das, was der
      // Haupt-Knopf gerade anbietet (zum Spiel, Playoff-Spiel, Draft, Kader auffüllen … sonst Woche weiter). Der Kalender-Knopf
      // allein kennt Playoffs, Draft und Kaderpflichten nicht.
      if (weiter()) ev.preventDefault();
    }
  }

  // ── Schalter ─────────────────────────────────────────────────────────────────────────────────────────────────
  function anwenden() {
    const an = breit(), war = document.body.classList.contains('pcu-an');
    if (an) { navAusbauen(); if (!KD) tabelleZeichnen(); }
    if (an !== war) {
      document.body.classList.toggle('pcu-an', an);
      // Stadt neu zeichnen, damit die Leinwand die neue Höhe übernimmt
      if (typeof W.renderHomeTab === 'function' && typeof LEAGUE !== 'undefined' && LEAGUE) { try { W.renderHomeTab(); } catch (e) { /* nur Anzeige */ } }
    }
  }
  function start() {
    if (!istPc() || $('pcu-css')) return;
    const st = document.createElement('style'); st.id = 'pcu-css'; st.textContent = CSS + (KD ? CSS_KD : CSS_FL); document.head.appendChild(st);
    document.addEventListener('keydown', taste);
    document.addEventListener('click', tabelleKlick);
    anwenden();
    const _cal = W.renderCalendarWidget;
    if (typeof _cal === 'function') {
      W.renderCalendarWidget = function () { const r = _cal.apply(this, arguments); try { weiterKnopf(); } catch (e) { /* nur Anzeige */ } return r; };
      try { renderCalendarWidget = W.renderCalendarWidget; } catch (e) { /* window reicht */ }
    }
    setInterval(() => { if (!breit()) return; navAusbauen(); weiterKnopf(); if (!KD && $('view-home') && $('view-home').classList.contains('active')) tabelleZeichnen(); }, CFG.takt);
    if (mq) { if (mq.addEventListener) mq.addEventListener('change', anwenden); else if (mq.addListener) mq.addListener(anwenden); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  W.KSPcUebersicht = { CFG, anwenden, tabelleZeichnen, weiter, weiterKnopf, bereiche: () => bereiche.map(b => b.id) };
  console.log('[Kickstil-PC-Übersicht v1] aktiv — Navigation links, Tasten, Übersicht als Schreibtisch (nur PC ≥ 1200 px)');
})();
