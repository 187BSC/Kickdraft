/* ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
   Kickstil – Kader am PC (2026-10-18, nur PC-Version; Vorschau vom Nutzer freigegeben: „ja mach das mal“)
   Gilt nur mit body.pcu-an (kickstil_pc_uebersicht.js: PC-App + Fenster ≥ 1200 px). Handy und Browser unverändert.
   · Tote Seitenspalte (Gesamtstärke/Mannschaftswerte) weg – die Werte stehen klein im Kopf des Kaders (#pck-werte).
   · Aufstellung mit Feld links, Startelf und Ersatz rechts: links Formation/Stil und Gegner-Karte mit Warnungen, Mitte das Feld groß, rechts alle
     übrigen Spieler (die Bank aus kickstil_kader_ui.js mit Gesicht, Kraft, Filter nach Mannschaftsteil). Ziehen und
     Antippen zum Tauschen bleiben die der App. Die Startelf-Liste unter dem Feld entfällt (steht auf dem Feld).
   · Spieler als Tabelle (#pck-spieler, alle Spalten sortierbar, Filter) mit Zusammenfassung rechts (Werte, Vertrag,
     Knöpfe Vertrag/Verkaufen/Alle Details → vorhandene Funktionen renewContract, sellPlayer, DFLAppShell.spielerBlatt).
   · Training in zwei Spalten. Tasten A/S/T = Aufstellung/Spieler/Training.
   ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const W = window;
  const CFG = { takt: 800, muede: 70 };
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const an = () => document.body.classList.contains('pcu-an');
  const spiel = () => typeof SQUAD !== 'undefined' && Array.isArray(SQUAD) && typeof CLUB !== 'undefined' && CLUB && typeof LEAGUE !== 'undefined' && LEAGUE;
  const eigen = () => SQUAD.filter(p => !p.onLoanAt);
  const getP = id => SQUAD.find(p => p.id === id);
  const dn = p => (typeof displayName === 'function' ? displayName(p) : p.name);
  const voll = p => ((p.firstName ? p.firstName + ' ' : '') + p.name).trim();
  const basis = p => (W.KSSaisonPlus ? KSSaisonPlus.basis(p) : typeof ovrBase === 'function' ? ovrBase(p) : p.ovr);
  const verletzt = p => (typeof isInjured === 'function' ? isInjured(p) : (p.injuryWeeks || 0) > 0);
  const gesperrt = p => (typeof isSuspended === 'function' ? isSuspended(p) : false);
  const geld = v => (typeof formatEuro === 'function' ? formatEuro(v || 0) : Math.round(v || 0) + ' €');
  const wert = p => (typeof computeMarketValue === 'function' ? computeMarketValue(p) : p.value || 0);
  // Kickdraft kennt keinen Marktwert (Nutzer 2026-10-22: „macht keinen Sinn mit 400 Mio“) – dort steht der Cap Hit wie in der App
  const KD = /\/kickdraft\//.test(location.pathname) || !!W.DFLSpiel;
  const capHit = p => (W.DFLKader && DFLKader.capHitJahr ? DFLKader.capHitJahr(p) : 0);
  const geldWert = p => (KD ? capHit(p) : wert(p));
  const jahr = p => (LEAGUE.startYear || 2026) + (p.contractUntil || 0);
  const laeuftAus = p => p.contractUntil != null && p.contractUntil <= LEAGUE.season && !p.vertragFolge;
  const vertragTxt = p => p.vertragFolge ? 'verlängert' : laeuftAus(p) ? 'läuft aus' : 'bis ' + jahr(p);
  function potR(p) {
    try { const sc = (CLUB.facilities && CLUB.facilities.scouting) || 1, r = potentialRange(p, sc); return { lo: r.lo, hi: r.hi }; }
    catch (e) { return { lo: p.truePotential || p.ovr, hi: p.truePotential || p.ovr }; }
  }
  const potTxt = r => r.lo === r.hi ? String(r.hi) : r.lo + '–' + r.hi;
  const TEIL = pos => /^(TW|GK)$/.test(pos) ? 'tw' : /^(IV|LV|RV|AV|LIB)$/.test(pos) ? 'abw' : /^(ST|LF|RF|FL|MS|HS|LA|RA)$/.test(pos) ? 'ang' : 'mit';
  const TEILNAME = { tw: 'Tor', abw: 'Abwehr', mit: 'Mittelfeld', ang: 'Angriff' };
  const POSRANG = ['TW', 'IV', 'LV', 'RV', 'AV', 'ZDM', 'DM', 'ZM', 'LM', 'RM', 'AM', 'ZOM', 'OM', 'LF', 'RF', 'FL', 'ST'];
  const fitKl = f => f < 50 ? 'platt' : f < CFG.muede ? 'muede' : '';
  // Flutlicht: KSVerein; Kickdraft (als gesamt/pc_kader.js eingehängt): DFLIdentitaet mit Franchise-Farben
  function gesicht(p) {
    try {
      if (W.KSVerein) return KSVerein.gesicht(p, 'fcm');
      if (W.DFLIdentitaet && DFLIdentitaet.gesichtSvg) { let f = null; try { f = DFLSpiel.franchise('fcm'); } catch (e) {} return DFLIdentitaet.gesichtSvg(p, f ? { farben: f.farben } : null); }
    } catch (e) {}
    return '';
  }
  const imElf = () => new Set(Object.values(CLUB.lineup || {}));

  const CSS = `
body.pcu-an #view-squad .squad-layout { display: block; }
body.pcu-an #view-squad .squad-layout > .sidebar { display: none; }
body.pcu-an #view-squad .sb-tabhead { gap: 18px; }
#pck-werte { display: none; }
body.pcu-an #pck-werte { display: flex; gap: 18px; align-items: center; margin-left: auto; flex-wrap: wrap; justify-content: flex-end; }
#pck-werte .pck-w { display: grid; gap: 3px; min-width: 84px; }
#pck-werte .pck-z { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; font-weight: 800; color: var(--text2); }
#pck-werte .pck-z b { color: var(--text); font-variant-numeric: tabular-nums; }
#pck-werte .pck-b { height: 6px; border-radius: 3px; background: var(--k-linie, var(--border)); overflow: hidden; }
#pck-werte .pck-b i { display: block; height: 100%; }
#pck-werte .pck-ges { display: flex; align-items: baseline; gap: 6px; }
#pck-werte .pck-ges b { font-family: var(--font-display, inherit); font-size: 30px; line-height: 1; }
#pck-werte .pck-ges span { font-size: 11px; font-weight: 800; color: var(--text3); text-transform: uppercase; letter-spacing: .06em; }
body.pcu-an #view-squad .sb-tabhead .sb-pill { display: none; }
body.pcu-an #view-squad .ksk-tabs .subtab .pck-taste { margin-left: 8px; }
.pck-taste { display: none; }
body.pcu-an .pck-taste { display: inline-block; font-size: 10px; font-weight: 800; min-width: 18px; text-align: center; padding: 1px 5px; border-radius: 6px;
  border: 1px solid var(--k-linie, var(--border)); border-bottom-width: 2px; color: var(--text3); line-height: 1.4; }
body.pcu-an .subtab.active .pck-taste { color: inherit; background: rgba(255,255,255,.2); border-color: rgba(255,255,255,.4); }

/* Aufstellung wie im FM: großes Feld links, rechts Plan oben, darunter Startelf | Ersatz (Nutzer 2026-10-20) */
body.pcu-an #sub-lineup.active { display: grid; grid-template-columns: auto minmax(0, 1fr) minmax(0, 1fr); grid-template-rows: auto auto 1fr; gap: 12px 14px; align-items: start; }
body.pcu-an #sub-lineup > * { grid-column: 2 / 4; min-width: 0; margin: 0; }
body.pcu-an #sub-lineup > .formation-row { grid-row: 1; flex-direction: row; align-items: stretch; flex-wrap: nowrap; gap: 10px; }
body.pcu-an #sub-lineup > .formation-row > * { flex: 1 1 0 !important; min-width: 0; margin: 0; }
body.pcu-an #sub-lineup > .formation-row > button.auswahl-knopf.auswahl-formation { width: auto !important; max-width: none !important; min-width: 0; height: auto; min-height: 0; aspect-ratio: auto; display: flex; flex-direction: row; align-items: center; gap: 10px; padding: 6px 10px; text-align: left; }
body.pcu-an #sub-lineup > .formation-row .auswahl-formation svg { width: 44px; height: 44px; flex: none; }
body.pcu-an #sub-lineup > .formation-row .auswahl-formation .ak-text b { font-size: 19px; }
body.pcu-an #sub-lineup > .formation-row .auswahl-formation .pfeil { margin-left: auto; display: inline-block !important; }
body.pcu-an #sub-lineup > .formation-row > button.beste-elf.ksk-elf { width: auto !important; min-height: 44px; margin-left: 0; display: flex; gap: 8px; justify-content: center; align-items: center; }
body.pcu-an #sub-lineup > .formation-row > button.beste-elf.ksk-elf::after { content: 'Beste Elf aufstellen'; font-weight: 800; font-size: 14px; display: inline; }
body.pcu-an #sub-lineup > .ksk-gegnerkarte { grid-row: 2; }
body.pcu-an #sub-lineup > .bk-reihe { display: contents; }
/* Feld so hoch wie der Bildschirm erlaubt, etwas breiter als 68:100, damit es größer wird */
body.pcu-an #sub-lineup #pitch { grid-column: 1; grid-row: 1 / span 3; position: sticky; top: 10px; aspect-ratio: 74 / 100;
  width: calc((100vh - 168px) * .74); min-width: 380px; max-width: 720px; margin: 0; }
body.pcu-an #sub-lineup .bk-reihe #pitch .p-slot { transform: translate(-50%, -50%) scale(1.08); }
body.pcu-an #sub-lineup #squad-list { display: none; }
body.pcu-an #pck-elf, body.pcu-an #dfl-bank { position: static; grid-row: 3; width: auto; max-height: calc(100vh - 300px); min-height: 260px; display: flex; flex-direction: column;
  background: var(--bg2); border: 2px solid var(--border); border-radius: 14px; overflow: hidden; }
body.pcu-an #pck-elf { grid-column: 2; }
body.pcu-an #dfl-bank { grid-column: 2 / 4; }
body.pcu-an #dfl-bank .bk-liste { display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)); align-content: start; }
body.pcu-an #dfl-bank .bk-spieler .bk-pos { display: none; }
body.pcu-an #dfl-bank .pck-posn { display: inline-flex; flex-wrap: wrap; gap: 3px; margin-right: 6px; vertical-align: 1px; }
body.pcu-an #dfl-bank .pck-posn .pos-badge-sm { font-size: 10px; padding: 1px 5px; }
#pck-elf { display: none; }
body.pcu-an #pck-elf .bk-liste { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 0 8px 8px; display: flex; flex-direction: column; gap: 4px; }
body.pcu-an #pck-elf .pck-ez { all: unset; box-sizing: border-box; cursor: pointer; display: grid; grid-template-columns: 38px 34px minmax(0, 1fr) auto; column-gap: 9px; align-items: center;
  padding: 5px 8px; border-radius: 9px; background: var(--bg3); }
body.pcu-an #pck-elf .pck-ez:hover { background: var(--bg4); }
body.pcu-an #pck-elf .pck-ez.gew { outline: 3px solid var(--accent); }
body.pcu-an #pck-elf .pck-ez:focus-visible { outline: 3px solid var(--accent); outline-offset: 1px; }
body.pcu-an #pck-elf .pck-ez .bk-pos { text-align: center; font-size: 11px; padding: 2px 0; }
body.pcu-an #pck-elf .pck-ez .pck-g { width: 34px; height: 34px; border-radius: 9px; overflow: hidden; background: var(--bg4); }
body.pcu-an #pck-elf .pck-ez .pck-g svg { width: 100%; height: 100%; display: block; }
body.pcu-an #pck-elf .pck-ez .bk-name { font-size: 13px; }
body.pcu-an #pck-elf .pck-ez .bk-zeile { font-size: 11.5px; }
body.pcu-an #pck-elf .pck-ez .pck-rechts { display: flex; align-items: center; gap: 8px; }
body.pcu-an #pck-elf .pck-ez.leer { color: var(--text3); font-style: italic; }
body.pcu-an #sub-lineup > .formation-row > button.pck-brett { width: auto !important; min-height: 44px; margin-left: 0; display: flex; gap: 8px; justify-content: center; align-items: center; font-weight: 800; font-size: 14px; }
body.pcu-an #sub-lineup > .formation-row > button.pck-brett i { font-size: 20px; }
@media (max-width: 1450px) {
  body.pcu-an #sub-lineup > .formation-row { flex-wrap: wrap; }
  body.pcu-an #sub-lineup > .formation-row > button.beste-elf.ksk-elf, body.pcu-an #sub-lineup > .formation-row > button.pck-brett { flex-basis: calc(50% - 5px) !important; }
  body.pcu-an #pck-elf .pck-ez { grid-template-columns: 36px 30px minmax(0, 1fr) auto; column-gap: 7px; }
  body.pcu-an #pck-elf .pck-ez .pck-g { width: 30px; height: 30px; }
  body.pcu-an #pck-elf, body.pcu-an #dfl-bank { max-height: calc(100vh - 345px); }
}
}
body.pcu-an #dfl-bank .bk-kopf, body.pcu-an #pck-elf .bk-kopf { display: flex !important; justify-content: space-between !important; align-items: baseline; padding: 9px 12px 4px; text-align: left; font-size: 13px; }
body.pcu-an #dfl-bank .bk-kopf small, body.pcu-an #pck-elf .bk-kopf small { font-family: var(--font-text, system-ui); font-size: 11px; text-transform: none; letter-spacing: 0; color: var(--text3); }
.pck-filter { display: none; }
body.pcu-an .pck-filter { display: flex; gap: 4px; flex-wrap: wrap; padding: 2px 10px 8px; }
.pck-filter button { all: unset; cursor: pointer; font-size: 12px; font-weight: 800; padding: 2px 9px; border-radius: 7px; color: var(--text2); border: 1px solid var(--k-linie, var(--border)); }
.pck-filter button.an { background: var(--k-blau-knopf, #2f6fca); border-color: transparent; color: #fff; }
.pck-filter button:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
body.pcu-an #dfl-bank .bk-liste { padding: 0 8px 8px; gap: 4px; }
body.pcu-an #dfl-bank .bk-spieler { display: grid; grid-template-columns: 34px minmax(0, 1fr) auto; grid-template-rows: auto auto; column-gap: 9px; align-items: center; padding: 5px 8px; }
body.pcu-an #dfl-bank .bk-spieler .pck-g { grid-row: 1 / 3; width: 34px; height: 34px; border-radius: 9px; overflow: hidden; background: var(--bg4); }
body.pcu-an #dfl-bank .bk-spieler .pck-g svg { width: 100%; height: 100%; display: block; }
body.pcu-an #dfl-bank .bk-spieler .bk-name { grid-column: 2; font-size: 13px; }
body.pcu-an #dfl-bank .bk-spieler .bk-zeile { grid-column: 2; font-size: 11.5px; }
body.pcu-an #dfl-bank .bk-spieler .pck-rechts { grid-column: 3; grid-row: 1 / 3; display: flex; align-items: center; gap: 8px; }
body.pcu-an #dfl-bank .bk-spieler.pck-weg { display: none; }
.pck-fit { display: inline-block; width: 42px; height: 5px; border-radius: 3px; background: var(--k-linie, var(--border)); overflow: hidden; vertical-align: middle; }
.pck-fit i { display: block; height: 100%; background: #4f9a3a; } .pck-fit i.muede { background: #d69a1e; } .pck-fit i.platt { background: #c0392b; }

/* Spieler-Tabelle */
#pck-spieler { display: none; }
body.pcu-an #ksk-spieler > :not(#pck-spieler) { display: none !important; }
body.pcu-an #pck-spieler { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 14px; align-items: start; }
#pck-spieler .pck-box { background: var(--bg2); border: 2px solid var(--k-linie, var(--border)); border-radius: 14px; overflow: hidden; min-width: 0; }
#pck-spieler .pck-tw { overflow: auto; max-height: calc(100vh - 230px); }
#pck-spieler table { width: 100%; border-collapse: collapse; font-size: 13px; font-variant-numeric: tabular-nums; }
#pck-spieler th { position: sticky; top: 0; z-index: 1; background: var(--bg3, var(--bg2)); font-size: 10.5px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase;
  color: var(--text3); text-align: right; padding: 7px 8px; cursor: pointer; white-space: nowrap; border-bottom: 1px solid var(--k-linie, var(--border)); user-select: none; }
#pck-spieler th.l, #pck-spieler td.l { text-align: left; }
#pck-spieler th.sort { color: var(--text); } #pck-spieler th.sort::after { content: ' ▾'; } #pck-spieler th.sort.auf::after { content: ' ▴'; }
#pck-spieler td { padding: 4px 8px; text-align: right; white-space: nowrap; border-bottom: 1px solid color-mix(in srgb, var(--k-linie, #dcc39a) 55%, transparent); }
#pck-spieler tbody tr { cursor: pointer; } #pck-spieler tbody tr:hover td { background: var(--bg3, rgba(0,0,0,.04)); }
#pck-spieler tr.gewaehlt td { background: color-mix(in srgb, var(--k-blau-knopf, #2f6fca) 13%, transparent); }
#pck-spieler .pck-wer { display: flex; align-items: center; gap: 8px; }
#pck-spieler .pck-wer .pck-g { width: 28px; height: 28px; border-radius: 7px; overflow: hidden; background: var(--bg4); flex: none; }
#pck-spieler .pck-g svg { width: 100%; height: 100%; display: block; }
#pck-spieler .pck-elf { font-size: 9.5px; font-weight: 800; color: #3f8a2c; border: 1px solid currentColor; border-radius: 4px; padding: 0 3px; }
#pck-spieler .pck-rot { color: #c0392b; font-weight: 800; }
#pck-spieler .pck-ovr { font-family: var(--font-display, inherit); font-weight: 800; font-size: 16px; }
#pck-spieler .pck-plus { color: #3f8a2c; font-size: 11px; font-weight: 800; margin-left: 3px; } #pck-spieler .pck-minus { color: #c0392b; font-size: 11px; font-weight: 800; margin-left: 3px; }
#pck-spieler td .pck-fit { margin-left: 6px; }
#pck-spieler .pck-chips { display: flex; gap: 4px; flex-wrap: wrap; padding: 8px 10px; border-bottom: 1px solid var(--k-linie, var(--border)); }
#pck-spieler .pck-chips button { all: unset; cursor: pointer; font-size: 12px; font-weight: 800; padding: 2px 9px; border-radius: 7px; color: var(--text2); border: 1px solid var(--k-linie, var(--border)); }
#pck-spieler .pck-chips button.an { background: var(--k-blau-knopf, #2f6fca); border-color: transparent; color: #fff; }
#pck-spieler .pck-chips button:focus-visible, #pck-spieler th:focus-visible, #pck-spieler tr:focus-visible { outline: 3px solid var(--accent); outline-offset: -2px; }
#pck-blatt { padding: 14px; display: flex; flex-direction: column; gap: 10px; position: sticky; top: 12px; }
#pck-blatt .pck-oben { display: flex; gap: 12px; align-items: center; }
#pck-blatt .pck-oben .pck-g { width: 68px; height: 68px; border-radius: 14px; overflow: hidden; background: var(--bg4); flex: none; }
#pck-blatt h3 { font-family: var(--font-display, inherit); font-size: 19px; margin: 0; line-height: 1.1; }
#pck-blatt .pck-unter { font-size: 12.5px; color: var(--text2); margin-top: 2px; }
#pck-blatt .pck-gross { margin-left: auto; text-align: right; } #pck-blatt .pck-gross b { font-family: var(--font-display, inherit); font-size: 32px; line-height: 1; display: block; }
#pck-blatt .pck-gross small { font-size: 11px; color: var(--text3); font-weight: 800; }
#pck-blatt .pck-attr { display: grid; grid-template-columns: 86px minmax(0, 1fr) 26px; gap: 5px 8px; align-items: center; font-size: 12.5px; font-weight: 700; }
#pck-blatt .pck-attr .pck-b { height: 7px; border-radius: 4px; background: var(--k-linie, var(--border)); overflow: hidden; } #pck-blatt .pck-attr .pck-b i { display: block; height: 100%; background: var(--k-blau-knopf, #2f6fca); }
#pck-blatt .pck-attr b { text-align: right; font-variant-numeric: tabular-nums; }
#pck-blatt .pck-fakten { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
#pck-blatt .pck-fakten div { background: var(--bg3, var(--bg)); border-radius: 9px; padding: 6px 9px; }
#pck-blatt .pck-fakten small { display: block; font-size: 10.5px; font-weight: 800; color: var(--text3); text-transform: uppercase; letter-spacing: .06em; }
#pck-blatt .pck-fakten b { font-size: 14px; }
#pck-blatt .pck-akt { display: flex; flex-wrap: wrap; gap: 6px; }
#pck-blatt .pck-akt button { flex: 1 1 auto; }

@media (max-width: 1450px) { body.pcu-an #pck-spieler { grid-template-columns: minmax(0, 1fr) 270px; } }

/* Training in zwei Spalten: links Einstellung + Talente, rechts der ganze Kader (Gruppen offen) */
body.pcu-an #ksk-training .training-wrap, body.pcu-an #ksk-training #training-content { max-width: none; width: 100%; }
body.pcu-an #ksk-training .ksk-tr-neu { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); column-gap: 16px; align-items: start; }
body.pcu-an #ksk-training .ksk-tr-neu > * { grid-column: 1; min-width: 0; }
body.pcu-an #ksk-training .ksk-tr-neu > .pck-tr-rechts { grid-column: 2; grid-row: 1 / span 30; }
body.pcu-an #ksk-training .pck-tr-rechts .ksk-zeile { padding: 4px 8px; margin-bottom: 5px; border-width: 1px; }
body.pcu-an #ksk-training .pck-tr-rechts .ksk-zeile .dfl-portrait.klein { width: 28px; height: 32px; }
body.pcu-an #ksk-training .pck-tr-rechts .ksk-o { font-size: 16px; }
`;

  // ── Kopf mit Teamwerten (statt der Seitenspalte) ──────────────────────────────────────────────────────────────
  let werteSig = '';
  function werte() {
    const kopf = document.querySelector('#view-squad .sb-tabhead'); if (!kopf) return;
    let el = $('pck-werte'); if (!el) { el = document.createElement('div'); el.id = 'pck-werte'; kopf.appendChild(el); werteSig = ''; }
    let tr = null; try { tr = typeof computeTeamRatings === 'function' ? computeTeamRatings() : null; } catch (e) { tr = null; }
    const k = eigen(), alter = k.length ? k.reduce((s, p) => s + (p.age || 0), 0) / k.length : 0;
    // Nutzer 2026-10-22: „welchen Durchschnitt? … für die erste 11“ – Anzeige je Mannschaftsteil der Startelf (Platz auf dem Feld):
    // Angriff = Angriffswert der Angreifer, Mittelfeld = Mittelfeldwert, Abwehr = Abwehrwert der Abwehr (Torwart mit seiner Stärke),
    // Mentalität und Fitness der Elf. Vorher lief Angriff/Abwehr über alle elf (Torwart im Angriff) – nur Anzeige, die Engine rechnet wie bisher.
    const xi = [], platzVon = sl => (W.KSPos ? KSPos.platz(sl) : sl.label);
    try { (FORMATIONS[CLUB.formation] || []).forEach(sl => { const p = getP((CLUB.lineup || {})[sl.id]); if (p) xi.push({ p, teil: TEIL(platzVon(sl)) }); }); } catch (e) { /* ohne Elf */ }
    const schnitt = (l, f) => l.length ? l.reduce((x, e) => x + f(e), 0) / l.length : null;
    const wert = (e, k) => (typeof e.p[k] === 'number' ? e.p[k] : basis(e.p));
    const ang = schnitt(xi.filter(e => e.teil === 'ang'), e => wert(e, 'att')), mit = schnitt(xi.filter(e => e.teil === 'mit'), e => wert(e, 'mid'));
    const abw = schnitt(xi.filter(e => e.teil === 'abw' || e.teil === 'tw'), e => e.teil === 'tw' ? basis(e.p) : wert(e, 'def'));
    const men = schnitt(xi, e => e.p.mental || 0) + (CLUB.captainId && xi.some(e => e.p.id === CLUB.captainId) ? 3 : 0), fit = schnitt(xi, e => (e.p.fitness == null ? 100 : e.p.fitness));
    const sig = JSON.stringify(tr) + k.length + alter.toFixed(1) + [ang, mit, abw, men, fit].map(v => Math.round(v || 0)).join(','); if (sig === werteSig) return; werteSig = sig;
    const B = [['Angriff', ang, '#c0392b'], ['Mittelfeld', mit, '#2e9b57'], ['Abwehr', abw, '#2f6fca'], ['Mentalität', men, '#b7791f'], ['Fitness', fit, '#5aa63a']].filter(x => x[1] != null);
    el.innerHTML = B.map(([n, v, c]) => `<div class="pck-w" title="Schnitt der Startelf"><div class="pck-z"><span>${n}</span><b>${Math.round(v)}${n === 'Fitness' ? ' %' : ''}</b></div><div class="pck-b"><i style="width:${Math.max(0, Math.min(100, v))}%;background:${c}"></i></div></div>`).join('')
      + `<div class="pck-w"><div class="pck-z"><span>Kader</span><b>${k.length}</b></div><div class="pck-z"><span>Ø Alter</span><b>${alter.toFixed(1).replace('.', ',')}</b></div></div>`
      + (tr ? `<div class="pck-ges"><b>${Math.round(tr.overall)}</b><span>Gesamt</span></div>` : '');
  }
  function reiterTasten() {
    const T = { aufstellung: 'A', spieler: 'S', training: 'T' };
    document.querySelectorAll('#view-squad .ksk-tabs .subtab[data-k]').forEach(b => {
      const t = T[b.getAttribute('data-k')]; if (!t || b.querySelector('.pck-taste')) return;
      b.insertAdjacentHTML('beforeend', `<kbd class="pck-taste" aria-hidden="true">${t}</kbd>`); b.setAttribute('aria-keyshortcuts', t);
    });
  }

  // ── Aufstellung: übrige Spieler mit Gesicht, Kraft, Filter ────────────────────────────────────────────────────
  let bankFilter = '';
  function bankAusbauen() {
    const bank = $('dfl-bank'); if (!bank) return;
    const kopf = bank.querySelector('.bk-kopf'), zeilen = [...bank.querySelectorAll('.bk-spieler[data-bk]')];
    if (kopf && !kopf.querySelector('small')) kopf.innerHTML = `Ersatz <small>${zeilen.length} Spieler</small>`;
    if (!bank.querySelector('.pck-filter') && kopf) {
      kopf.insertAdjacentHTML('afterend', `<div class="pck-filter" role="group" aria-label="Mannschaftsteil">${[['', 'Alle'], ['tw', 'Tor'], ['abw', 'Abwehr'], ['mit', 'Mittelfeld'], ['ang', 'Angriff']]
        .map(([k, t]) => `<button type="button" data-pck-bf="${k}" class="${k === bankFilter ? 'an' : ''}">${t}</button>`).join('')}</div>`);
    }
    zeilen.forEach(z => {
      const p = getP(z.getAttribute('data-bk')); if (!p) return;
      z.classList.toggle('pck-weg', !!bankFilter && TEIL(p.pos) !== bankFilter);
      if (z.querySelector('.pck-g')) return;
      z.insertAdjacentHTML('afterbegin', `<span class="pck-g" aria-hidden="true">${gesicht(p)}</span>`);
      const f = Math.round(p.fitness == null ? 100 : p.fitness);
      z.insertAdjacentHTML('beforeend', `<span class="pck-rechts"><span class="pck-fit" title="Fitness ${f} %"><i class="${fitKl(f)}" style="width:${f}%"></i></span></span>`);
      // alle Positionen, die er spielen kann (Nutzer 2026-10-22), nicht nur die Hauptposition
      const pos = [...new Set([p.pos].concat(p.positions || []).filter(Boolean))];
      const zeile = z.querySelector('.bk-zeile');
      if (zeile) zeile.insertAdjacentHTML('afterbegin', `<span class="pck-posn">${pos.map(x => `<span class="pos-badge-sm pos-${esc(x)}">${esc(x)}</span>`).join('')}</span>`);
    });
  }

  // ── Aufstellung: Startelf als Liste neben der Ersatzbank (wie im FM) ──────────────────────────────────────────
  // Klick auf eine Zeile wählt den Platz wie ein Klick aufs Feld; danach tauscht ein Klick auf einen Ersatzspieler
  let elfSig = '';
  function elfListe() {
    const bank = $('dfl-bank'); if (!bank || typeof FORMATIONS === 'undefined') return;
    let box = $('pck-elf');
    if (!box) {
      box = document.createElement('div'); box.id = 'pck-elf';
      box.innerHTML = '<div class="bk-kopf"></div><div class="bk-liste" role="list"></div>';
      bank.parentNode.insertBefore(box, bank); elfSig = '';
    }
    const slots = FORMATIONS[CLUB.formation] || [], lu = CLUB.lineup || {}, sel = CLUB.selected;
    const sig = CLUB.formation + '|' + slots.map(sl => sl.id + ':' + (lu[sl.id] || '') + '.' + Math.round((getP(lu[sl.id]) || {}).fitness || 0)).join(',') + '|' + (sel ? sel.type + sel.key : '');
    if (sig === elfSig) return; elfSig = sig;
    const platz = sl => W.KSPos ? KSPos.platz(sl) : sl.label;
    const zeilen = slots.map(sl => ({ sl, pos: platz(sl), p: getP(lu[sl.id]) }))
      .sort((a, b) => { const i = POSRANG.indexOf(a.pos.replace(/^[LR](?=[A-Z]{2})/, '')), j = POSRANG.indexOf(b.pos.replace(/^[LR](?=[A-Z]{2})/, '')); return (i < 0 ? 99 : i) - (j < 0 ? 99 : j); });
    const besetzt = zeilen.filter(z => z.p).length;
    box.querySelector('.bk-kopf').innerHTML = `Startelf <small>${besetzt}/${slots.length}</small>`;
    box.querySelector('.bk-liste').innerHTML = zeilen.map(({ sl, pos, p }) => {
      const gew = sel && sel.type === 'slot' && sel.key === sl.id ? ' gew' : '';
      if (!p) return `<button type="button" class="pck-ez leer${gew}" data-pck-slot="${sl.id}" role="listitem"><span class="bk-pos">${pos}</span><span></span><span>Platz frei</span><span></span></button>`;
      const f = Math.round(p.fitness == null ? 100 : p.fitness), b = basis(p);
      return `<button type="button" class="pck-ez${gew}" data-pck-slot="${sl.id}" role="listitem" title="${voll(p)}">
        <span class="bk-pos">${pos}</span><span class="pck-g" aria-hidden="true">${gesicht(p)}</span>
        <span><span class="bk-name">${dn(p)}</span><span class="bk-zeile"><span class="bk-pos">${p.pos}</span> <b>${b}</b>${verletzt(p) ? ' <small>verletzt</small>' : gesperrt(p) ? ' <small>gesperrt</small>' : ''}</span></span>
        <span class="pck-rechts"><span class="pck-fit" title="Fitness ${f} %"><i class="${fitKl(f)}" style="width:${f}%"></i></span></span></button>`;
    }).join('');
  }

  // ── Spieler-Tabelle ───────────────────────────────────────────────────────────────────────────────────────────
  const SPALTEN = [
    ['pos', 'Pos', 'l', p => { const i = POSRANG.indexOf(p.pos); return i < 0 ? 99 : i; }],
    ['name', 'Name', 'l', p => dn(p)],
    ['alter', 'Alter', '', p => p.age],
    ['ovr', 'Stärke', '', p => p.ovr],
    ['pot', 'Potenzial', '', p => potR(p).hi],
    ['fit', 'Fitness', '', p => p.fitness == null ? 100 : p.fitness],
    ['moral', 'Moral', '', p => p.morale == null ? 50 : p.morale],
    ['spiele', 'Spiele', '', p => p.gamesPlayed || 0],
    ['vertrag', 'Vertrag', '', p => laeuftAus(p) ? 0 : (p.contractUntil || 0)],
    ['lohn', 'Gehalt/Wo', '', p => p.wage || 0],
    ['wert', KD ? 'Cap Hit' : 'Marktwert', '', p => geldWert(p)]
  ];
  const FILTER = [['', 'Alle'], ['tw', 'Tor'], ['abw', 'Abwehr'], ['mit', 'Mittelfeld'], ['ang', 'Angriff'], ['aus', 'Verträge laufen aus'], ['verletzt', 'Verletzt'], ['u21', 'U21']];
  let sortK = 'ovr', ab = true, filt = '', gew = null, splSig = '';
  function splSignatur() { return sortK + ab + filt + gew + '|' + eigen().map(p => p.id + p.ovr + '.' + Math.round(p.fitness || 0) + '.' + p.morale + '.' + p.contractUntil + '.' + (p.injuryWeeks || 0) + '.' + (p.gamesPlayed || 0)).join(',') + '|' + Object.values(CLUB.lineup || {}).join(','); }
  function spielerTabelle(erzwingen) {
    const v = $('ksk-spieler'); if (!v || !spiel()) return;
    let box = $('pck-spieler');
    if (!box || box.parentNode !== v) { if (box) box.remove(); box = document.createElement('div'); box.id = 'pck-spieler'; v.appendChild(box); erzwingen = true; }
    const sig = splSignatur(); if (!erzwingen && sig === splSig) return; splSig = sig;
    const alle = eigen(), e = imElf();
    const f = SPALTEN.find(x => x[0] === sortK)[3];
    const liste = alle.filter(p => !filt || (filt === 'aus' ? laeuftAus(p) : filt === 'verletzt' ? verletzt(p) || gesperrt(p) : filt === 'u21' ? p.age <= 21 : TEIL(p.pos) === filt))
      .sort((a, b) => { const x = f(a), y = f(b); const r = typeof x === 'string' ? x.localeCompare(y, 'de') : x - y; return (ab ? -r : r) || b.ovr - a.ovr; });
    if (!gew || !getP(gew)) gew = (liste[0] || alle[0] || {}).id || null;
    const zahl = k => k === 'aus' ? alle.filter(laeuftAus).length : k === 'verletzt' ? alle.filter(p => verletzt(p) || gesperrt(p)).length : null;
    const zeilen = liste.map(p => {
      const r = potR(p), fit = Math.round(p.fitness == null ? 100 : p.fitness), d = p.ovr - basis(p);
      return `<tr data-pck="${esc(p.id)}" class="${p.id === gew ? 'gewaehlt' : ''}" tabindex="0">
        <td class="l"><span class="pos-badge-sm pos-${esc(p.pos)}">${esc(p.pos)}</span></td>
        <td class="l"><span class="pck-wer"><span class="pck-g" aria-hidden="true">${gesicht(p)}</span><b>${esc(dn(p))}</b>${e.has(p.id) ? '<span class="pck-elf">ELF</span>' : ''}${verletzt(p) ? ' <span class="pck-rot">verletzt</span>' : gesperrt(p) ? ' <span class="pck-rot">gesperrt</span>' : ''}</span></td>
        <td>${p.age}</td><td><span class="pck-ovr">${basis(p)}</span>${d > 0 ? `<span class="pck-plus">+${d}</span>` : d < 0 ? `<span class="pck-minus">${d}</span>` : ''}</td>
        <td>${potTxt(r)}</td><td>${fit} %<span class="pck-fit"><i class="${fitKl(fit)}" style="width:${fit}%"></i></span></td>
        <td>${p.morale == null ? '–' : Math.round(p.morale)}</td><td>${p.gamesPlayed || 0}</td>
        <td class="${laeuftAus(p) ? 'pck-rot' : ''}">${vertragTxt(p)}</td><td>${geld(p.wage)}</td><td>${geld(geldWert(p))}</td></tr>`;
    }).join('');
    const y = box.querySelector('.pck-tw') ? box.querySelector('.pck-tw').scrollTop : 0;
    box.innerHTML = `<section class="pck-box"><div class="pck-chips" role="group" aria-label="Filter">${FILTER.map(([k, t]) => { const z = zahl(k); return `<button type="button" data-pck-f="${k}" class="${k === filt ? 'an' : ''}">${t}${z ? ' ' + z : ''}</button>`; }).join('')}</div>
      <div class="pck-tw"><table><thead><tr>${SPALTEN.map(([k, t, c]) => `<th class="${c}${k === sortK ? ' sort' + (ab ? '' : ' auf') : ''}" data-pck-s="${k}" tabindex="0" scope="col">${t}</th>`).join('')}</tr></thead>
      <tbody>${zeilen || '<tr><td colspan="11" class="l">Keine Spieler.</td></tr>'}</tbody></table></div></section>
      <aside class="pck-box" id="pck-blatt" aria-live="polite">${blattHtml(getP(gew))}</aside>`;
    box.querySelector('.pck-tw').scrollTop = y;
  }
  function blattHtml(p) {
    if (!p) return '';
    const r = potR(p), fit = Math.round(p.fitness == null ? 100 : p.fitness);
    const A = [['Abwehr', p.def], ['Mittelfeld', p.mid], ['Angriff', p.att], ['Tempo', p.pace], ['Mentalität', p.mental], ['Technik', p.technik]].filter(x => x[1] != null);
    const pos = (p.positions && p.positions.length ? p.positions : [p.pos]);
    return `<div class="pck-oben"><span class="pck-g" aria-hidden="true">${gesicht(p)}</span><div><h3>${esc(voll(p))}</h3>
        <div class="pck-unter">${esc(p.flag || '')} ${esc(p.country || '')} · ${p.age} Jahre</div>
        <div class="pck-unter">${pos.map(x => `<span class="pos-badge-sm pos-${esc(x)}">${esc(x)}</span>`).join(' ')}</div></div>
        <div class="pck-gross"><b>${basis(p)}</b><small>POT ${potTxt(r)}</small></div></div>
      <div class="pck-attr">${A.map(([n, v]) => `<span>${n}</span><span class="pck-b"><i style="width:${Math.max(0, Math.min(100, v))}%"></i></span><b>${Math.round(v)}</b>`).join('')}</div>
      <div class="pck-fakten"><div><small>Vertrag</small><b class="${laeuftAus(p) ? 'pck-rot' : ''}">${vertragTxt(p)}</b></div><div><small>Gehalt</small><b>${geld(p.wage)}/Wo</b></div>
        <div><small>${KD ? 'Cap Hit' : 'Marktwert'}</small><b>${geld(geldWert(p))}</b></div><div><small>Fitness · Moral</small><b>${fit} % · ${p.morale == null ? '–' : Math.round(p.morale)}</b></div></div>
      <div class="pck-akt">${typeof W.renewContract === 'function' ? `<button type="button" class="app-knopf" data-pck-a="vertrag">Vertrag</button>` : ''}
        ${typeof W.sellPlayer === 'function' ? `<button type="button" class="app-knopf rot" data-pck-a="verkauf">Verkaufen</button>` : ''}
        ${W.DFLAppShell && DFLAppShell.spielerBlatt ? `<button type="button" class="app-knopf" data-pck-a="blatt">Alle Details</button>` : ''}</div>`;
  }
  function klick(ev) {
    if (!an()) return;
    const t = ev.target;
    const bf = t.closest('[data-pck-bf]');
    if (bf) { bankFilter = bf.getAttribute('data-pck-bf'); bf.parentNode.querySelectorAll('button').forEach(b => b.classList.toggle('an', b === bf)); bankAusbauen(); return; }
    if (t.closest('.pck-brett')) { KSPcTaktik.vorOeffnen(); return; }
    const ez = t.closest('[data-pck-slot]');
    if (ez && typeof clickSlot === 'function') { clickSlot(ez.getAttribute('data-pck-slot')); elfListe(); return; }
    if (!t.closest('#pck-spieler')) return;
    const fb = t.closest('[data-pck-f]'); if (fb) { filt = fb.getAttribute('data-pck-f'); spielerTabelle(true); return; }
    const th = t.closest('[data-pck-s]');
    if (th) { const k = th.getAttribute('data-pck-s'); if (k === sortK) ab = !ab; else { sortK = k; ab = !['name', 'pos', 'vertrag'].includes(k); } spielerTabelle(true); return; }
    const a = t.closest('[data-pck-a]');
    if (a) {
      const p = getP(gew); if (!p) return; const was = a.getAttribute('data-pck-a');
      if (was === 'vertrag') W.renewContract(p.id); else if (was === 'verkauf') W.sellPlayer(p.id); else if (was === 'blatt') DFLAppShell.spielerBlatt(p);
      return;
    }
    const tr = t.closest('tr[data-pck]');
    if (tr) {
      gew = tr.getAttribute('data-pck');
      tr.parentNode.querySelectorAll('tr').forEach(x => x.classList.toggle('gewaehlt', x === tr));
      const bl = $('pck-blatt'); if (bl) bl.innerHTML = blattHtml(getP(gew));
      if (ev.detail >= 2 && W.DFLAppShell && DFLAppShell.spielerBlatt) DFLAppShell.spielerBlatt(getP(gew));
    }
  }

  // ── Training: Gruppen am PC offen (einmal je neu gebauter Gruppe) ──────────────────────────────────────────────
  // „Ganzer Kader“ und die Gruppen in einen eigenen Block (rechte Spalte), sonst ziehen die langen Gruppen die Zeilen links auseinander
  function training() {
    const w = document.querySelector('#ksk-training .ksk-tr-neu'); if (!w || w.querySelector(':scope > .pck-tr-rechts')) return;
    const gr = [...w.querySelectorAll(':scope > details.ksk-gruppe')]; if (!gr.length) return;
    const r = document.createElement('div'); r.className = 'pck-tr-rechts';
    const kopf = gr[0].previousElementSibling; if (kopf && kopf.classList.contains('ksk-ab')) r.appendChild(kopf);
    gr.forEach(d => { d.open = true; r.appendChild(d); });
    w.appendChild(r);
  }

  // ── Tasten A/S/T ──────────────────────────────────────────────────────────────────────────────────────────────
  function frei() {
    if (document.body.classList.contains('app-gesperrt')) return false;
    const el = document.elementFromPoint(W.innerWidth / 2, W.innerHeight / 2);
    return !!(el && el.closest('.app'));
  }
  function taste(ev) {
    if (!an() || ev.ctrlKey || ev.metaKey || ev.altKey || ev.defaultPrevented) return;
    const z = ev.target || {}; if (/^(INPUT|TEXTAREA|SELECT)$/.test(z.tagName || '') || z.isContentEditable) return;
    const v = $('view-squad'); if (!v || !v.classList.contains('active') || !frei()) return;
    const t = { a: 'aufstellung', s: 'spieler', t: 'training' }[String(ev.key).toLowerCase()];
    if (t && W.KSKader && KSKader.zeige) { ev.preventDefault(); KSKader.zeige(t); }
    if (ev.key === 'Enter' && z.matches && z.matches('#pck-spieler tr[data-pck]') && W.DFLAppShell && DFLAppShell.spielerBlatt) DFLAppShell.spielerBlatt(getP(z.getAttribute('data-pck')));
  }

  function klickZiel(el) {
    if (!el || !el.closest || !$('sub-lineup') || !$('sub-lineup').classList.contains('active')) return null;
    const ez = el.closest('#pck-elf [data-pck-slot]'); if (ez) return 'slot:' + ez.getAttribute('data-pck-slot');
    const ps = el.closest('#pitch .p-slot');
    if (ps) { const i = [...ps.parentNode.querySelectorAll('.p-slot')].indexOf(ps), sl = (FORMATIONS[CLUB.formation] || [])[i]; return sl ? 'slot:' + sl.id : null; }
    const bk = el.closest('#sub-lineup [data-bk]'); if (bk) return 'p:' + bk.getAttribute('data-bk');
    return null;
  }
  function klickSpieler(k) { const [art, id] = [k.slice(0, k.indexOf(':')), k.slice(k.indexOf(':') + 1)]; return art === 'slot' ? getP((CLUB.lineup || {})[id]) : getP(id); }
  // Taktikbrett auch in der Aufstellung (Nutzer 2026-10-22) – dasselbe Brett wie vor dem Spiel, Anweisungen in CLUB.pcAnw (Spielstand)
  function brettKnopf() {
    const row = document.querySelector('#sub-lineup > .formation-row'); if (!row || !W.KSPcTaktik || !KSPcTaktik.vorOeffnen) return;
    const da = row.querySelector('.pck-brett');
    if (da) { const elf = row.querySelector('.beste-elf'); if (elf && da.previousElementSibling !== elf) elf.after(da); return; }   // neben „Beste Elf aufstellen“
    row.insertAdjacentHTML('beforeend', '<button type="button" class="app-knopf pck-brett" title="Mannschaftsanweisungen für die nächsten Spiele"><i class="ti ti-clipboard-list" aria-hidden="true"></i><span>Taktikbrett</span></button>');
  }
  function tick() {
    if (!an() || !spiel()) return;
    const v = $('view-squad'); if (!v || !v.classList.contains('active')) return;
    werte(); reiterTasten();
    // Startelf-Liste entfällt (Nutzer 2026-10-22: „die erste 11 sieht man ja auf dem Feld“) – die Ersatzbank bekommt die Breite
    if ($('sub-lineup') && $('sub-lineup').classList.contains('active')) { bankAusbauen(); brettKnopf(); const alt = $('pck-elf'); if (alt) alt.remove(); }
    if ($('ksk-spieler') && $('ksk-spieler').classList.contains('active')) spielerTabelle(false);
    if ($('ksk-training') && $('ksk-training').classList.contains('active')) training();
  }
  function start() {
    if ($('pck-css')) return;
    const st = document.createElement('style'); st.id = 'pck-css'; st.textContent = CSS; document.head.appendChild(st);
    document.addEventListener('click', klick);
    // Doppelklick auf einen Spieler (Feld, Startelf-Liste, Ersatz) öffnet das Spielerprofil rechts (Nutzer 2026-10-22). Eigene
    // Erkennung über zwei Klicks, weil das Feld nach dem ersten Klick (Auswahl zum Tauschen) neu gezeichnet wird.
    let letzt = null;
    document.addEventListener('click', ev => {
      if (!an() || !spiel()) return;
      const k = klickZiel(ev.target); if (!k) { letzt = null; return; }
      const t = performance.now();
      // gleiche Stelle statt gleiches Element: die Ersatzliste sortiert sich nach dem ersten Klick um (Auswahl) – es zählt der erste Spieler
      if (letzt && t - letzt.t < 450 && Math.hypot(ev.clientX - letzt.x, ev.clientY - letzt.y) < 8) {
        const p = klickSpieler(letzt.k); letzt = null;
        if (p && W.DFLAppShell && DFLAppShell.spielerBlatt) setTimeout(() => { if (typeof clickSlot === 'function' && CLUB.selected) { CLUB.selected = null; if (typeof renderPitch === 'function') renderPitch(); } DFLAppShell.spielerBlatt(p, true); }, 0);
      } else letzt = { k, t, x: ev.clientX, y: ev.clientY };
    }, true);
    document.addEventListener('keydown', taste);
    // Neu zeichnen, sobald der Kader seine Teile neu baut (Bank, Spielerliste, Training)
    const mo = new MutationObserver(() => { clearTimeout(start.t); start.t = setTimeout(tick, 30); });
    const beob = () => { const v = $('view-squad'); if (v) mo.observe(v, { childList: true, subtree: true }); else setTimeout(beob, 500); };
    beob();
    setInterval(tick, CFG.takt);
    console.log('[Kickstil-PC-Kader v1] aktiv — Kader am PC: Werte im Kopf, Aufstellung mit Feld links, Startelf und Ersatz rechts, Spieler als Tabelle (nur PC ≥ 1200 px)');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  W.KSPcKader = { CFG, tick, spielerTabelle };
})();
