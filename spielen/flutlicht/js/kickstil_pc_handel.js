/* ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
   Kickstil – Trades und Free Agency am PC (2026-10-20, nur PC-Version, nur Kickdraft – Trades/FA sind Kickdraft-Inhalte)
   Nutzer: „dann mach mal die Trade und FA Liste“; per Rückfrage „Drei Spalten“ und „Tabelle + Bericht rechts“.
   Gilt nur mit body.pcu-an (kickstil_pc_uebersicht.js: PC-App + Fenster ≥ 1200 px). Handy und Browser unverändert.
   · Trade-Zentrale (#tr-sub-trades, dfl_trade_patch.js) in drei Spalten: links deine Spieler und Picks als Liste, Mitte der
     Deal (Du gibst / Du bekommst, Waage, Cap, Knöpfe, Trading Block, letzte Trades), rechts der Partner mit Reitern
     „Kader“ und „Zu haben“. Die Knoten der App werden nur umgehängt – Klicks, aktualisieren() und zuHabenZeichnen()
     finden sie weiter über querySelector/getElementById im Reiter.
   · FA-Liste (#tr-sub-frei, transfermarkt_balance.js renderFrei) als Tabelle mit sortierbaren Spalten; die Zeilen der App
     bleiben versteckt die Quelle (Reihenfolge, Filter, Knöpfe). Rechts der Scout-Bericht (DFLScouting.berichtHtml) mit
     den Knöpfen der Zeile (Ansehen, Verpflichten).
   ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const W = window;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const an = () => document.body.classList.contains('pcu-an');
  const SC = () => (W.DFLScouting && DFLScouting.aktiv && DFLScouting.aktiv() ? DFLScouting : null);
  const POSRANG = ['TW', 'IV', 'LV', 'RV', 'AV', 'ZDM', 'DM', 'ZM', 'LM', 'RM', 'AM', 'ZOM', 'OM', 'LF', 'RF', 'FL', 'ST'];
  const geld = v => (typeof formatEuro === 'function' ? formatEuro(v || 0) : Math.round(v || 0) + ' €');

  const CSS = `
/* ── Trade-Zentrale in drei Spalten ── */
body.pcu-an #tr-sub-trades .tz.pch-drei { display: grid; grid-template-columns: minmax(0, 1fr) minmax(400px, 1.12fr) minmax(0, 1fr); gap: 14px; align-items: start; }
body.pcu-an .tz.pch-drei > .tz-kopf { grid-column: 1 / -1; }
body.pcu-an .tz.pch-drei > .tz-vorrat { display: none; }
body.pcu-an .pch-sp { position: sticky; top: 8px; max-height: calc(100vh - 24px); overflow-y: auto; scrollbar-width: thin; display: flex; flex-direction: column; gap: 10px;
  min-width: 0; padding: 10px; border: 2px solid var(--tz-linie, var(--border)); border-radius: 14px; background: var(--bg2); }
body.pcu-an .pch-sp2 { background: transparent; border: 0; padding: 0 2px; }
body.pcu-an .pch-sp-titel { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; font-size: 11.5px; font-weight: 800; letter-spacing: .06em;
  text-transform: uppercase; color: var(--text3); }
body.pcu-an .pch-sp1 .pch-sp-titel { color: var(--tz-ich); }
body.pcu-an .pch-sp .tz-vorrat-teil h5:first-child { display: none; }
body.pcu-an .pch-sp .tz-vorrat-teil { gap: 2px; }
body.pcu-an .pch-sp .dfl-tr-partner { margin: 0; }
body.pcu-an .pch-sp .tz-lage { font-size: 12px; }
body.pcu-an .pch-sp .lage-partner { margin: 0; }
/* Mitte: Du gibst über Du bekommst, Knöpfe nicht mehr am Bildschirmrand */
body.pcu-an .pch-sp2 .tz-seiten { grid-template-columns: minmax(0, 1fr); }
body.pcu-an .pch-sp2 .tz-unten.fest { position: static; }
body.pcu-an .pch-sp2 .tz-knoepfe .app-knopf { flex: 1 1 auto; }
body.pcu-an .pch-sp2 .tz-knoepfe .app-knopf.haupt { flex: 1 1 100%; }
/* Reiter rechts */
body.pcu-an .pch-reiter { display: flex; gap: 6px; }
body.pcu-an .pch-reiter button { flex: 1; font: inherit; font-size: 12.5px; font-weight: 800; padding: 7px 10px; border-radius: 10px; cursor: pointer;
  border: 2px solid var(--tz-linie, var(--border)); background: var(--bg3); color: var(--text2); }
body.pcu-an .pch-reiter button[aria-pressed="true"] { background: var(--k-blau-knopf, #2c7cb5); border-color: var(--k-blau-knopf, #2c7cb5); color: #fff; }
body.pcu-an .pch-sp3[data-pch-reiter="kader"] #tz-zh-box,
body.pcu-an .pch-sp3[data-pch-reiter="zh"] .tz-vorrat-teil.er { display: none; }
body.pcu-an .pch-sp3 .tz-zh { margin: 0; border: 0; padding: 0; background: none; }
/* Spieler als Liste statt Kacheln */
body.pcu-an .pch-sp .tz-leiste:not(:has(.pk)) { flex-direction: column; flex-wrap: nowrap; gap: 3px; overflow: visible; padding: 2px 0 6px; }
body.pcu-an .pch-sp .tz-mini:not(.pk) { width: auto; display: grid; grid-template-columns: 26px 40px 34px minmax(0, 1fr) 34px 22px; align-items: center; gap: 8px;
  text-align: left; padding: 2px 8px 2px 6px; border-radius: 10px; border-width: 2px; min-height: 34px; }
body.pcu-an .pch-sp .tz-mini:not(.pk) .tz-gesicht { width: 26px; height: 30px; border-radius: 7px; grid-column: 1; }
body.pcu-an .pch-sp .tz-mini:not(.pk) .tz-mini-ovr { display: contents; }
body.pcu-an .pch-sp .tz-mini:not(.pk) .tz-mini-ovr b { grid-column: 2; font-size: 13.5px; text-align: center; }
body.pcu-an .pch-sp .tz-mini:not(.pk) .tz-mini-ovr .pos-badge-sm { grid-column: 3; justify-self: start; font-size: 10px; }
body.pcu-an .pch-sp .tz-mini:not(.pk) .tz-mini-name { grid-column: 4; max-width: none; font-size: 13px; font-weight: 700; color: var(--text); }
body.pcu-an .pch-sp .tz-mini:not(.pk) .pch-alter { grid-column: 5; grid-row: 1; font-size: 12px; color: var(--text2); text-align: right; }
body.pcu-an .pch-sp .tz-mini:not(.pk) .tz-ecke { position: static; grid-column: 6; grid-row: 1; justify-self: center; }
body.pcu-an .pch-sp .tz-mini:not(.pk) .tz-mini-stil { position: absolute; left: 152px; top: 50%; transform: translateY(-50%); display: none; }
body.pcu-an .pch-sp .tz-mini:not(.pk) .tz-haken { top: 50%; left: auto; right: -8px; transform: translateY(-50%); }
body.pcu-an .pch-sp .tz-mini:not(.pk):hover:not([disabled]) { border-color: var(--text3); }
body.pcu-an .pch-sp .tz-leiste:has(.pk) { gap: 5px; padding: 2px 0 4px; }
body.pcu-an .pch-sp .tz-mini.pk { width: 62px; min-height: 66px; padding: 3px 2px; }
body.pcu-an .pch-sp .tz-mini.pk > .ti-ticket { font-size: 15px; }
body.pcu-an .pch-sp-kopfzeile { display: grid; grid-template-columns: 26px 40px 34px minmax(0, 1fr) 34px 22px; gap: 8px; padding: 0 8px 0 6px; font-size: 10.5px;
  font-weight: 800; letter-spacing: .05em; text-transform: uppercase; color: var(--text3); }
body.pcu-an .pch-sp-kopfzeile span:nth-child(5) { text-align: right; }

/* ── FA-Liste als Tabelle mit Bericht rechts ── */
body.pcu-an #tr-sub-frei.active.pch-fa-an { display: grid; grid-template-columns: minmax(0, 1fr) minmax(340px, 400px); gap: 14px; align-items: start; }
body.pcu-an #tr-sub-frei.pch-fa-an > .fa-kopf { grid-column: 1 / -1; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
body.pcu-an #tr-sub-frei.pch-fa-an > .market-list { display: none; }
body.pcu-an #pch-fa { grid-column: 1; min-width: 0; border: 2px solid var(--tz-linie, var(--border)); border-radius: 14px; background: var(--bg2); overflow: hidden; }
body.pcu-an #pch-fa table { width: 100%; border-collapse: collapse; font-size: 13px; }
body.pcu-an #pch-fa th { position: sticky; top: 0; z-index: 1; background: var(--bg3); text-align: left; font-size: 10.5px; font-weight: 800; letter-spacing: .05em;
  text-transform: uppercase; color: var(--text3); padding: 8px 8px; cursor: pointer; white-space: nowrap; user-select: none; border-bottom: 2px solid var(--tz-linie, var(--border)); }
body.pcu-an #pch-fa th.r, body.pcu-an #pch-fa td.r { text-align: right; }
body.pcu-an #pch-fa th[aria-sort] { color: var(--text); }
body.pcu-an #pch-fa th i { font-size: 11px; vertical-align: -1px; }
body.pcu-an #pch-fa td { padding: 6px 8px; border-bottom: 1px solid var(--border); white-space: nowrap; vertical-align: middle; }
body.pcu-an #pch-fa tr.pch-z { cursor: pointer; }
body.pcu-an #pch-fa tr.pch-z:hover td { background: var(--bg3); }
body.pcu-an #pch-fa tr.pch-z.an td { background: var(--k-info-bg, #dcebf7); }
body.pcu-an #pch-fa tr.pch-z.an td:first-child { box-shadow: inset 4px 0 0 var(--k-blau-knopf, #2c7cb5); }
body.pcu-an #pch-fa td.pch-n { font-weight: 800; white-space: normal; }
body.pcu-an #pch-fa td.pch-n small { display: block; font-weight: 600; font-size: 11px; color: var(--text3); }
body.pcu-an #pch-fa td .pos-badge-sm { margin: 0 2px 0 0; }
body.pcu-an #pch-fa td.pch-geld { font-weight: 800; color: var(--gold, #b7791f); }
body.pcu-an #pch-fa td.pch-nein { color: var(--k-schlecht-fg, #a52a1e); font-weight: 700; }
body.pcu-an #pch-fa .pch-leer { padding: 16px; color: var(--text3); }
body.pcu-an #pch-fa-detail { grid-column: 2; position: sticky; top: 8px; max-height: calc(100vh - 24px); overflow-y: auto; scrollbar-width: thin;
  border: 2px solid var(--tz-linie, var(--border)); border-radius: 14px; background: var(--bg2); padding: 12px; }
body.pcu-an #pch-fa td.pch-her { max-width: 200px; overflow: hidden; text-overflow: ellipsis; }
@media (max-width: 1450px) {
  body.pcu-an #tr-sub-frei.active.pch-fa-an { grid-template-columns: minmax(0, 1fr) 320px; }
  body.pcu-an #pch-fa td, body.pcu-an #pch-fa th { padding-left: 6px; padding-right: 6px; }
  body.pcu-an #pch-fa td.pch-her { max-width: 120px; }
  body.pcu-an .pch-sp .tz-mini:not(.pk), body.pcu-an .pch-sp-kopfzeile { grid-template-columns: 40px 34px minmax(0, 1fr) 30px 20px; gap: 6px; }
  body.pcu-an .pch-sp .tz-mini:not(.pk) .tz-gesicht, body.pcu-an .pch-sp-kopfzeile span:first-child { display: none; }
  body.pcu-an .pch-sp .tz-mini:not(.pk) .tz-mini-ovr b { grid-column: 1; }
  body.pcu-an .pch-sp .tz-mini:not(.pk) .tz-mini-ovr .pos-badge-sm { grid-column: 2; }
  body.pcu-an .pch-sp .tz-mini:not(.pk) .tz-mini-name { grid-column: 3; }
  body.pcu-an .pch-sp .tz-mini:not(.pk) .pch-alter { grid-column: 4; }
  body.pcu-an .pch-sp .tz-mini:not(.pk) .tz-ecke { grid-column: 5; }
  body.pcu-an #tr-sub-trades .tz.pch-drei { grid-template-columns: minmax(0, 1fr) minmax(360px, 1.1fr) minmax(0, 1fr); gap: 10px; }
}
body.pcu-an #pch-fa-detail .pch-knoepfe { display: flex; gap: 8px; margin-bottom: 10px; }
body.pcu-an #pch-fa-detail .pch-knoepfe > * { flex: 1 1 auto; }
body.pcu-an #pch-fa-detail .pch-knoepfe .mkt-btn { min-height: 40px; }
`;

  // ── Trade-Zentrale ──────────────────────────────────────────────────────────────────────────────────────────────
  let reiter = 'kader';
  function dreiSpalten() {
    const box = $('tr-sub-trades');
    if (!box || !box.classList.contains('active')) return;
    const tz = box.querySelector('.dfl-tr.tz');
    if (!tz) return;
    if (!an()) return;
    if (!tz.classList.contains('pch-drei')) {
      const q = s => tz.querySelector(':scope > ' + s);
      const ich = tz.querySelector('.tz-vorrat-teil.ich'), er = tz.querySelector('.tz-vorrat-teil.er');
      if (!ich || !er) return;
      const sp = n => { const d = document.createElement('div'); d.className = 'pch-sp pch-sp' + n; return d; };
      const s1 = sp(1), s2 = sp(2), s3 = sp(3);
      s1.innerHTML = '<div class="pch-sp-titel"><span>Deine Spieler</span></div>' + kopfzeile();   // Nutzer 2026-10-22: überflüssiger Text raus („antippen = mitgeben“)
      s1.appendChild(ich);
      ['#tz-oben', '#tz-unten', '#tz-block', '.dfl-tr-log'].forEach(s => { const e = q(s); if (e) s2.appendChild(e); });
      ['.dfl-tr-partner', '.tz-lage', '.lage-partner'].forEach(s => { const e = q(s); if (e) s3.appendChild(e); });
      const r = document.createElement('div'); r.className = 'pch-reiter';
      r.innerHTML = '<button type="button" data-pch-r="kader">Kader</button><button type="button" data-pch-r="zh">Zu haben in der Liga</button>';
      s3.appendChild(r);
      s3.appendChild(er);
      const kz = document.createElement('div'); kz.innerHTML = kopfzeile(); er.insertBefore(kz.firstChild, er.querySelector('.tz-leiste'));
      const zh = q('#tz-zh-box'); if (zh) s3.appendChild(zh);
      tz.appendChild(s1); tz.appendChild(s2); tz.appendChild(s3);
      tz.classList.add('pch-drei');
    }
    const s3 = tz.querySelector('.pch-sp3');
    if (s3) {
      s3.setAttribute('data-pch-reiter', reiter);
      s3.querySelectorAll('[data-pch-r]').forEach(b => b.setAttribute('aria-pressed', String(b.getAttribute('data-pch-r') === reiter)));
      const kz = s3.querySelector('.pch-sp-kopfzeile'); if (kz) kz.style.display = reiter === 'kader' ? '' : 'none';
    }
    // Alter aus dem Titel der Kachel („Name · Position · 25 J · …“) als eigene Spalte
    tz.querySelectorAll('.pch-sp .tz-mini:not(.pk):not(.pch-mit-alter)').forEach(b => {
      const m = / · (\d+) J( ·|$)/.exec(b.getAttribute('title') || '');
      const s = document.createElement('span'); s.className = 'pch-alter'; s.textContent = m ? m[1] : '';
      b.insertBefore(s, b.querySelector('.tz-haken')); b.classList.add('pch-mit-alter');
    });
  }
  const kopfzeile = () => '<div class="pch-sp-kopfzeile"><span></span><span>St.</span><span>Pos</span><span>Name</span><span>Alter</span><span></span></div>';

  // ── FA-Liste ────────────────────────────────────────────────────────────────────────────────────────────────────
  let sort = { k: '', ab: true }, wahl = null, faBau = false;
  function faPool() {
    try { if (W.FreeAgents && FreeAgents.pool) return FreeAgents.pool(); } catch (e) { /* Ersatz */ }
    try { return (CLUB && CLUB.freeAgents) || []; } catch (e) { return []; }
  }
  function faZeilen(box) {
    const sc = SC(), pool = faPool(), nachWelt = new Map();
    pool.forEach(p => nachWelt.set(sc && sc.weltId ? String(sc.weltId(p)) : String(p.id).replace(/^fa_/, ''), p));
    const scout = (typeof CLUB !== 'undefined' && CLUB.facilities && CLUB.facilities.scouting) || 1;
    return [...box.querySelectorAll('.market-list > .market-row[data-welt]')].map((row, i) => {
      const welt = row.getAttribute('data-welt'), p = nachWelt.get(welt);
      if (!p) return null;
      const mitBericht = !sc || sc.hatBericht(p);
      const k2 = typeof W.dflFaKonditionen === 'function' ? W.dflFaKonditionen(p, 2) : null;
      let pot = null;
      if (mitBericht) { try { pot = typeof potentialRange === 'function' ? potentialRange(p, scout) : null; } catch (e) { pot = null; } }
      const knopf = row.querySelector('.mkt-btn');
      return {
        i, welt, p, row, mitBericht,
        posHtml: [...row.querySelectorAll('.pos-badge-sm')].map(b => b.outerHTML).join(''),
        stil: W.DFLEbenen && DFLEbenen.zeichenHtml ? DFLEbenen.zeichenHtml(p) : '',
        stHtml: sc ? sc.staerkeHtml(p, 'kurz') : String(p.ovr),
        stWert: sc ? sc.sortWert(p) : p.ovr,
        potTxt: sc ? sc.potText(p) : (pot ? (pot.lo === pot.hi ? pot.hi : pot.lo + '–' + pot.hi) : '?'),
        potWert: pot ? pot.hi : -1,
        cap: k2 ? k2.capHit : 0,
        nein: !!(knopf && knopf.disabled),
        her: String(p.fromClub || 'vereinslos').replace(/^zuletzt\s+/i, ''),
        rang: (() => { const r = POSRANG.indexOf(p.pos); return r < 0 ? 99 : r; })()
      };
    }).filter(Boolean);
  }
  const SPALTEN = [
    ['pos', 'Pos', z => z.rang], ['name', 'Name', z => String(z.p.name || '').toLowerCase()], ['alter', 'Alter', z => z.p.age, 'r'],
    ['st', 'Stärke', z => z.stWert], ['pot', 'Pot.', z => z.potWert], ['her', 'Zuletzt', z => z.her.toLowerCase()], ['cap', 'Cap Hit', z => z.cap, 'r']
  ];
  function faTabelle() {
    const box = $('tr-sub-frei');
    if (!box || !box.classList.contains('active') || !an()) { if (box) box.classList.remove('pch-fa-an'); return; }
    const liste = box.querySelector(':scope > .market-list');
    if (!liste) return;
    faBau = true;
    try {
      box.classList.add('pch-fa-an');
      let zeilen = faZeilen(box);
      const sp = SPALTEN.find(s => s[0] === sort.k);
      if (sp) zeilen = zeilen.slice().sort((a, b) => { const x = sp[2](a), y = sp[2](b); return (x < y ? -1 : x > y ? 1 : a.i - b.i) * (sort.ab ? -1 : 1); });
      if (!wahl || !zeilen.some(z => z.welt === wahl)) wahl = zeilen.length ? zeilen[0].welt : null;
      const kopf = SPALTEN.map(([k, t, , r]) => `<th data-pch-sort="${k}" class="${r || ''}"${sort.k === k ? ` aria-sort="${sort.ab ? 'descending' : 'ascending'}"` : ''}>${t}${sort.k === k ? ` <i class="ti ti-chevron-${sort.ab ? 'down' : 'up'}"></i>` : ''}</th>`).join('');
      const body = zeilen.map(z => `<tr class="pch-z${z.welt === wahl ? ' an' : ''}" data-pch-welt="${esc(z.welt)}">
        <td>${z.posHtml}</td><td class="pch-n">${(z.p.flag ? z.p.flag + ' ' : '') + esc(typeof zeigeName === 'function' ? zeigeName(z.p) : z.p.name)}${z.stil}</td>
        <td class="r">${z.p.age}</td><td>${z.stHtml}</td><td>${esc(z.potTxt)}</td><td class="pch-her" title="${esc(z.her)}">${esc(z.her)}</td>
        <td class="r ${z.nein ? 'pch-nein' : 'pch-geld'}">${z.nein ? 'lehnt ab' : z.cap ? geld(z.cap) : ''}</td></tr>`).join('');
      let tab = $('pch-fa');
      if (!tab) { tab = document.createElement('div'); tab.id = 'pch-fa'; }
      if (tab.parentNode !== box) box.insertBefore(tab, liste);
      tab.innerHTML = zeilen.length ? `<table><thead><tr>${kopf}</tr></thead><tbody>${body}</tbody></table>`
        : `<div class="pch-leer">${liste.textContent.trim() || 'Keine Free Agents.'}</div>`;
      detail(box, zeilen.find(z => z.welt === wahl));
      liste.classList.add('pch-gesehen');
    } finally { faBau = false; }
  }
  function detail(box, z) {
    let d = $('pch-fa-detail');
    if (!d) { d = document.createElement('div'); d.id = 'pch-fa-detail'; }
    if (d.parentNode !== box) box.appendChild(d);
    if (!z) { d.innerHTML = '<div class="pch-leer"></div>'; return; }   // Nutzer 2026-10-22: überflüssiger Text raus („Spieler antippen“)
    const sc = SC(), knoepfe = z.row.querySelector('.market-btns');
    let bericht = '';
    try { bericht = sc && sc.berichtHtml ? `<div class="sc-blatt">${sc.berichtHtml(z.welt)}</div>` : ''; } catch (e) { bericht = ''; }
    // Nur Verpflichten aus der Zeile – Ansehen/Scouten steht schon im Bericht
    const vk = knoepfe ? [...knoepfe.querySelectorAll('.mkt-btn')].map(b => b.outerHTML).join('') : '';
    d.innerHTML = `<div class="pch-knoepfe">${vk}</div>` + (bericht || `<b>${esc(z.p.name)}</b>`);
  }

  // ── Takt, Klicks ────────────────────────────────────────────────────────────────────────────────────────────────
  function tick() {
    dreiSpalten();
    const box = $('tr-sub-frei');
    if (box && box.classList.contains('active')) {
      const l = box.querySelector(':scope > .market-list');
      if (an() && l && (!l.classList.contains('pch-gesehen') || !$('pch-fa') || $('pch-fa').parentNode !== box)) faTabelle();
      else if (!an()) box.classList.remove('pch-fa-an');
    }
  }
  function klick(ev) {
    if (!an()) return;
    const r = ev.target.closest('[data-pch-r]');
    if (r) { reiter = r.getAttribute('data-pch-r'); dreiSpalten(); return; }
    const th = ev.target.closest('#pch-fa th[data-pch-sort]');
    if (th) { const k = th.getAttribute('data-pch-sort'); sort = sort.k === k ? (sort.ab ? { k, ab: false } : { k: '', ab: true }) : { k, ab: k !== 'pos' && k !== 'name' && k !== 'her' }; faTabelle(); return; }
    const z = ev.target.closest('#pch-fa tr.pch-z');
    if (z) { wahl = z.getAttribute('data-pch-welt'); faTabelle(); return; }
    // Knöpfe im Bericht (Ansehen, Verpflichten) ändern den Zustand – danach frisch zeichnen
    if (ev.target.closest('#pch-fa-detail button')) setTimeout(faTabelle, 60);
  }
  function taste(ev) {
    if (!an() || ev.ctrlKey || ev.altKey || ev.metaKey || /INPUT|TEXTAREA|SELECT/.test((ev.target && ev.target.tagName) || '')) return;
    const box = $('tr-sub-frei');
    if (!box || !box.classList.contains('active') || (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp')) return;
    const rows = [...document.querySelectorAll('#pch-fa tr.pch-z')], i = rows.findIndex(r => r.classList.contains('an'));
    const n = rows[Math.max(0, Math.min(rows.length - 1, i + (ev.key === 'ArrowDown' ? 1 : -1)))];
    if (!n) return;
    ev.preventDefault(); wahl = n.getAttribute('data-pch-welt'); faTabelle();
    const neu = document.querySelector('#pch-fa tr.pch-z.an'); if (neu) neu.scrollIntoView({ block: 'nearest' });
  }
  function start() {
    if ($('pch-css')) return;
    const st = document.createElement('style'); st.id = 'pch-css'; st.textContent = CSS; document.head.appendChild(st);
    document.addEventListener('click', klick);
    document.addEventListener('keydown', taste);
    const mo = new MutationObserver(ms => {
      if (faBau) return;
      if (ms.every(m => m.target.closest && m.target.closest('#pch-fa, #pch-fa-detail'))) return;
      clearTimeout(start.t); start.t = setTimeout(tick, 20);
    });
    const beob = () => { const v = $('view-transfer'); if (v) mo.observe(v, { childList: true, subtree: true }); else setTimeout(beob, 500); };
    beob();
    setInterval(tick, 1000);
    console.log('[Kickstil-PC-Handel v1] aktiv — Trades in drei Spalten, FA-Liste als Tabelle mit Bericht (nur PC ≥ 1200 px, Kickdraft)');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  W.KSPcHandel = { tick, faTabelle, dreiSpalten };
})();
