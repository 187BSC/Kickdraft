/* ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
   Kickstil – Transfermarkt am PC (2026-10-20, nur PC-Version, Flutlicht – Kickdraft hat stattdessen Trades/FA)
   Nutzer: „Tabelle + Spieler rechts“ (gegen „Karten lassen, nur Angebote kompakt“). Gilt nur mit body.pcu-an.
   · Angebote für deine Spieler (#tr-bids, kickstil_transfer_karten.js) als kompakte Zeilen: Karte links, Knöpfe rechts daneben.
   · Transfersuche (#tr-sub-markt, kickstil_transfersuche.js) als Tabelle #pctr (Name, Pos, Alter, Verein, Stärke, Pot., Elf+,
     Preis; Spaltenkopf sortiert ab/auf/zurück, Pfeiltasten). Quelle bleiben die versteckten .kts-z-Zeilen (Filter, Schnellwahl,
     „Weitere anzeigen“). Rechts der Spieler mit Kaufen/Leihen/Merken bzw. Verpflichten und „Alle Details“ (Spieler-Blatt).
   ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const W = window;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const an = () => document.body.classList.contains('pcu-an');
  const geld = v => (typeof formatEuro === 'function' ? formatEuro(v || 0) : Math.round(v || 0) + ' €');
  const ico = n => `<i class="ti ti-${n}" aria-hidden="true"></i>`;
  const dn = p => (typeof displayName === 'function' ? displayName(p) : p.name);
  const offen = () => (typeof isTransferWindowOpen === 'function' ? isTransferWindowOpen() : true);
  const POSRANG = ['TW', 'IV', 'LV', 'RV', 'AV', 'ZDM', 'DM', 'ZM', 'LM', 'RM', 'AM', 'ZOM', 'OM', 'LF', 'RF', 'FL', 'ST'];
  const rang = pos => { const r = POSRANG.indexOf(pos); return r < 0 ? 99 : r; };
  const zahlen = t => (String(t || '').match(/\d+/g) || []).map(Number);
  const mitte = a => (a.length ? (a[0] + a[a.length - 1]) / 2 : -1);

  const STIL = `
/* Angebote kompakt */
body.pcu-an #tr-bids .ks-angebot-zeile { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; align-items: center; margin-bottom: 8px; }
body.pcu-an #tr-bids .ks-angebot { padding: 8px 12px !important; display: grid; grid-template-columns: minmax(0, 1fr) minmax(200px, 300px); gap: 12px; align-items: center; }
body.pcu-an #tr-bids .ks-ang-seiten { margin: 0 !important; }
body.pcu-an #tr-bids .ks-waage { margin: 0 !important; font-size: 12px; }
body.pcu-an #tr-bids .ks-ang-knoepfe { display: flex; flex-direction: column; gap: 5px; margin: 0 !important; min-width: 130px; }
body.pcu-an #tr-bids .ks-ang-knoepfe > * { min-height: 30px; padding: 4px 12px; font-size: 12px; }
/* Suche als Tabelle */
body.pcu-an #tr-sub-markt.pctr-an > .kts-z { display: none !important; }
body.pcu-an #pctr { display: grid; grid-template-columns: minmax(0, 1fr) minmax(320px, 380px); gap: 14px; align-items: start; margin: 6px 0 10px; }
body.pcu-an #pctr-tab { min-width: 0; border: 2px solid var(--tz-linie, var(--border)); border-radius: 14px; background: var(--bg2); overflow: hidden; }
body.pcu-an #pctr-tab table { width: 100%; border-collapse: collapse; font-size: 13px; }
body.pcu-an #pctr-tab th { background: var(--bg3); text-align: left; font-size: 10.5px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase;
  color: var(--text3); padding: 8px; cursor: pointer; white-space: nowrap; user-select: none; border-bottom: 2px solid var(--tz-linie, var(--border)); }
body.pcu-an #pctr-tab th.r, body.pcu-an #pctr-tab td.r { text-align: right; }
body.pcu-an #pctr-tab th[aria-sort] { color: var(--text); }
body.pcu-an #pctr-tab th i { font-size: 11px; vertical-align: -1px; }
body.pcu-an #pctr-tab td { padding: 6px 8px; border-bottom: 1px solid var(--border); white-space: nowrap; vertical-align: middle; }
body.pcu-an #pctr-tab tr.pctr-z { cursor: pointer; }
body.pcu-an #pctr-tab tr.pctr-z:hover td { background: var(--bg3); }
body.pcu-an #pctr-tab tr.pctr-z.an td { background: var(--k-info-bg, #dcebf7); }
body.pcu-an #pctr-tab tr.pctr-z.an td:first-child { box-shadow: inset 4px 0 0 var(--k-blau-knopf, #2c7cb5); }
body.pcu-an #pctr-tab td.pctr-n { font-weight: 800; }
body.pcu-an #pctr-tab td.pctr-n .kts-merk { color: var(--k-gold, #c9a227); margin-left: 4px; }
body.pcu-an #pctr-tab td.pctr-her { max-width: 190px; overflow: hidden; text-overflow: ellipsis; color: var(--text2); }
body.pcu-an #pctr-tab td.pctr-her .kts-w { display: inline-block; width: 16px; height: 16px; vertical-align: -3px; margin-right: 4px; }
body.pcu-an #pctr-tab td.pctr-her .kts-w svg, body.pcu-an #pctr-tab td.pctr-her .kts-w .lg-crest { width: 16px; height: 16px; }
body.pcu-an #pctr-tab td .pos-badge-sm { margin: 0 2px 0 0; font-size: 10.5px; padding: 2px 6px; line-height: 1.2; }
body.pcu-an #pctr-tab td.pctr-st { font: 800 14px/1 var(--font-zahl, system-ui); }
body.pcu-an #pctr-tab td.pctr-elf { color: var(--k-gut-fg, #2f6b1f); font-weight: 800; font-size: 12px; }
body.pcu-an #pctr-tab td.pctr-preis em { font-style: normal; font-weight: 800; color: var(--gold, #b7791f); }
body.pcu-an #pctr-tab td.pctr-preis em.frei { color: var(--k-blau-knopf, #2c7cb5); }
body.pcu-an #pctr-tab td.pctr-preis em.teuer { color: var(--k-schlecht-fg, #a52a1e); }
body.pcu-an #pctr-tab .pctr-tal { font-size: 10px; font-weight: 800; color: #7b3fb5; margin-left: 5px; }
body.pcu-an #pctr-tab .pctr-leer { padding: 16px; color: var(--text3); }
body.pcu-an #pctr-detail { position: sticky; top: 8px; max-height: calc(100vh - 24px); overflow-y: auto; scrollbar-width: thin;
  border: 2px solid var(--tz-linie, var(--border)); border-radius: 14px; background: var(--bg2); padding: 12px; }
body.pcu-an #pctr-detail .pctr-kopf { display: flex; gap: 12px; align-items: center; margin-bottom: 10px; }
body.pcu-an #pctr-detail .pctr-kopf .dfl-portrait { width: 64px; height: 64px; flex: none; border-radius: 50%; overflow: hidden; background: var(--bg3); display: block; }
body.pcu-an #pctr-detail .pctr-kopf .dfl-portrait svg { width: 64px; height: 64px; display: block; }
body.pcu-an #pctr-detail .pctr-kopf h4 { margin: 0 0 3px; font: 700 19px/1.15 var(--font-titel, system-ui); }
body.pcu-an #pctr-detail .pctr-kopf small { display: block; color: var(--text3); font-size: 12px; }
body.pcu-an #pctr-detail .pctr-kacheln { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; margin: 8px 0; }
body.pcu-an #pctr-detail .pctr-kachel { background: var(--bg3); border-radius: 10px; padding: 7px 8px; }
body.pcu-an #pctr-detail .pctr-kachel small { display: block; font-size: 10px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; color: var(--text3); }
body.pcu-an #pctr-detail .pctr-kachel b { display: block; font: 800 17px/1.3 var(--font-zahl, system-ui); }
body.pcu-an #pctr-detail .pctr-zeilen { font-size: 12.5px; margin: 8px 0 0; }
body.pcu-an #pctr-detail .pctr-zeilen div { display: flex; justify-content: space-between; gap: 10px; padding: 4px 0; border-bottom: 1px dashed var(--border); }
body.pcu-an #pctr-detail .pctr-zeilen span { color: var(--text3); }
body.pcu-an #pctr-detail .pctr-knoepfe { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
body.pcu-an #pctr-detail .pctr-knoepfe .app-knopf { flex: 1 1 auto; }
body.pcu-an #pctr-detail .pctr-hinweis { font-size: 12px; color: var(--text3); margin: 8px 0 0; }
body.pcu-an #pctr-detail .pctr-leer { padding: 12px; color: var(--text3); }
@media (max-width: 1450px) {
  body.pcu-an #pctr { grid-template-columns: minmax(0, 1fr) 320px; }
  body.pcu-an #pctr-tab td, body.pcu-an #pctr-tab th { padding-left: 6px; padding-right: 6px; }
  body.pcu-an #pctr-tab td.pctr-her { max-width: 120px; }
  body.pcu-an #tr-bids .ks-angebot { grid-template-columns: minmax(0, 1fr); }
}
`;

  // Daten je Zeile aus der versteckten Liste der Transfersuche
  function zeilen(box) {
    const K = W.KSTransfersuche; if (!K || !K.liste) return [];
    const kat = new Map(K.liste().map(x => [x.p.id + '|' + (x.frei ? 1 : 0), x]));
    return [...box.querySelectorAll(':scope > .kts-z[data-kts]')].map((row, i) => {
      const id = row.getAttribute('data-kts'), frei = row.getAttribute('data-frei') === '1', x = kat.get(id + '|' + (frei ? 1 : 0));
      if (!x) return null;
      const p = x.p, r = row.querySelector('.kts-r'), st = zahlen(r && r.querySelector('b') && r.querySelector('b').textContent);
      const pot = zahlen(r && r.querySelector('small') && r.querySelector('small').textContent);
      const elf = row.querySelector('.kts-chip.gut'), elfZ = elf ? zahlen(elf.textContent) : [];
      const w = row.querySelector('.kts-w');
      return {
        i, id, frei, p, x,
        name: esc(dn(p)) + (row.querySelector('.kts-merk') ? ` ${ico('star-filled').replace('class="', 'class="kts-merk ')}` : '') + (row.querySelector('.kts-chip.tal') ? '<span class="pctr-tal">Talent</span>' : ''),
        pos: (p.positions && p.positions.length ? p.positions : [p.pos]).slice(0, 2).map(q => `<span class="pos-badge-sm pos-${esc(q)}">${esc(q)}</span>`).join(''),
        posWert: rang(p.pos), alter: p.age,
        her: p.fromClub || 'vereinslos', wappen: w ? w.innerHTML : '',
        st: (r && r.querySelector('b') || {}).textContent || '', stWert: mitte(st),
        pot: (pot.length ? (pot[0] === pot[pot.length - 1] ? String(pot[0]) : pot[0] + '–' + pot[pot.length - 1]) : '?'), potWert: mitte(pot),
        elf: elf ? elf.textContent.replace(/^\s*Elf\s*/, '').trim() : '', elfWert: elfZ.length ? elfZ[0] : -99,
        preis: r && r.querySelector('em') ? r.querySelector('em').outerHTML : '', preisWert: frei ? 0 : x.preis
      };
    }).filter(Boolean);
  }
  const SPALTEN = [
    ['name', 'Name', z => String(z.p.name || '').toLowerCase()], ['pos', 'Pos', z => z.posWert], ['alter', 'Alter', z => z.alter, 'r'],
    ['her', 'Verein', z => String(z.her).toLowerCase()], ['st', 'Stärke', z => z.stWert], ['pot', 'Pot.', z => z.potWert],
    ['elf', 'Elf', z => z.elfWert], ['preis', 'Preis', z => z.preisWert, 'r']
  ];
  let sort = { k: '', ab: true }, wahl = null, bau = false;

  function detail(z) {
    if (!z) return '<div class="pctr-leer"></div>';   // Nutzer 2026-10-22: überflüssiger Text raus („Spieler antippen“)
    const p = z.p, o = offen(), merk = (CLUB.watchlist || []).some(w => w.id === p.id);
    let gesicht = ''; try { gesicht = `<span class="dfl-portrait">${KSVerein.gesicht(p)}</span>`; } catch (e) { gesicht = ''; }
    let note = null; try { const s = W.KSScouting && KSScouting.sicht(p); note = s && s.note; } catch (e) { note = null; }
    const kachel = (t, w) => `<div class="pctr-kachel"><small>${t}</small><b>${w}</b></div>`;
    const zl = [['Verein', esc(z.her)], ['Preis', z.frei ? 'ablösefrei' : esc(geld(z.x.preis))]];
    if (!z.frei && p.loanFee) zl.push(['Leihgebühr', esc(geld(p.loanFee))]);
    if (p.wage) zl.push(['Gehalt', esc(geld(p.wage)) + '/Wo']);
    if (z.elf) zl.push(['In deiner Elf', esc(z.elf)]);
    let k = '';
    if (z.frei) k = `<button type="button" class="app-knopf haupt" data-pctr-akt="frei"${o ? '' : ' disabled'}>${ico('signature')}Verpflichten</button>`;
    else {
      const anz = typeof mindestAnzahlung === 'function' ? mindestAnzahlung(p.value) : p.value;
      k = `<button type="button" class="app-knopf haupt" data-pctr-akt="kaufen"${p.nurLeihe || (CLUB.budget || 0) < anz || !o ? ' disabled' : ''}>${ico('shopping-cart')}Kaufen · ${esc(geld(p.value))}</button>
        <button type="button" class="app-knopf" data-pctr-akt="leihe"${(CLUB.budget || 0) < (p.loanFee || 0) || !o ? ' disabled' : ''}>${ico('arrows-exchange')}Leihen</button>`;
    }
    k += `<button type="button" class="app-knopf" data-pctr-akt="merk">${ico(merk ? 'star-filled' : 'star')}${merk ? 'Gemerkt' : 'Merken'}</button>
      <button type="button" class="app-knopf" data-pctr-akt="blatt">${ico('id')}Alle Details</button>`;
    return `<div class="pctr-kopf">${gesicht}<div><h4>${esc((p.firstName ? p.firstName + ' ' : '') + p.name)}</h4>
        <small>${esc(p.flag || '')} ${p.age} Jahre · ${esc((p.positions || [p.pos]).join(', '))}</small></div></div>
      <div class="pctr-kacheln">${kachel('Stärke', esc(z.st))}${kachel('Potenzial', esc(z.pot))}${kachel('Note', note ? esc(note.note) + (note.steal ? ' ' + ico('diamond') : '') : '?')}</div>
      <div class="pctr-zeilen">${zl.map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('')}</div>
      <div class="pctr-knoepfe">${k}</div>${o ? '' : '<p class="pctr-hinweis">Kaufen und Leihen im Transferfenster.</p>'}`;
  }
  function zeichne() {
    const box = $('tr-sub-markt');
    if (!box) return;
    if (!an()) { box.classList.remove('pctr-an'); const c = $('pctr'); if (c) c.remove(); return; }
    if (!box.querySelector('.kts-info')) return;
    bau = true;
    try {
      box.classList.add('pctr-an');
      let L = zeilen(box);
      const sp = SPALTEN.find(s => s[0] === sort.k);
      if (sp) L = L.slice().sort((a, b) => { const x = sp[2](a), y = sp[2](b); return (x < y ? -1 : x > y ? 1 : a.i - b.i) * (sort.ab ? -1 : 1); });
      const key = z => z.id + '|' + (z.frei ? 1 : 0);
      if (!wahl || !L.some(z => key(z) === wahl)) wahl = L.length ? key(L[0]) : null;
      let c = $('pctr');
      if (!c) { c = document.createElement('div'); c.id = 'pctr'; c.innerHTML = '<div id="pctr-tab"></div><div id="pctr-detail"></div>'; }
      const info = box.querySelector('.kts-info');
      if (c.previousElementSibling !== info) info.after(c);
      const kopf = SPALTEN.map(([k, t, , r]) => `<th data-pctr-sort="${k}" class="${r || ''}"${sort.k === k ? ` aria-sort="${sort.ab ? 'descending' : 'ascending'}"` : ''}>${t}${sort.k === k ? ` ${ico('chevron-' + (sort.ab ? 'down' : 'up'))}` : ''}</th>`).join('');
      $('pctr-tab').innerHTML = L.length ? `<table><thead><tr>${kopf}</tr></thead><tbody>${L.map(z => `<tr class="pctr-z${key(z) === wahl ? ' an' : ''}" data-pctr="${esc(key(z))}">
          <td class="pctr-n">${z.name}</td><td>${z.pos}</td><td class="r">${z.alter}</td><td class="pctr-her" title="${esc(z.her)}"><span class="kts-w">${z.wappen}</span>${esc(z.her)}</td>
          <td class="pctr-st">${esc(z.st)}</td><td>${esc(z.pot)}</td><td class="pctr-elf">${esc(z.elf)}</td><td class="r pctr-preis">${z.preis}</td></tr>`).join('')}</tbody></table>`
        : `<div class="pctr-leer">${esc((box.querySelector('.kts-leer') || {}).textContent || 'Keine Spieler zu dieser Suche.')}</div>`;
      $('pctr-detail').innerHTML = detail(L.find(z => key(z) === wahl));
      box._pctr = box.querySelectorAll(':scope > .kts-z').length + '|' + (box.querySelector(':scope > .kts-z') || {}).outerHTML;
    } catch (e) { console.warn('[KS-PC-Transfer]', e); }
    finally { bau = false; }
  }
  function tick() {
    const box = $('tr-sub-markt');
    if (!box) return;
    if (!an()) { if (box.classList.contains('pctr-an')) zeichne(); return; }
    if (!box.classList.contains('active') && !box.offsetParent) return;
    const sig = box.querySelectorAll(':scope > .kts-z').length + '|' + (box.querySelector(':scope > .kts-z') || {}).outerHTML;
    if (!$('pctr') || !box.contains($('pctr')) || box._pctr !== sig) zeichne();
  }
  function aktion(a) {
    const [id, f] = String(wahl || '').split('|'), frei = f === '1';
    if (!id) return;
    if (a === 'blatt') { const row = document.querySelector(`#tr-sub-markt > .kts-z[data-kts="${CSS.escape(id)}"][data-frei="${frei ? 1 : 0}"]`); if (row) row.click(); return; }
    if (a === 'merk') {
      if (!Array.isArray(CLUB.watchlist)) CLUB.watchlist = [];
      const i = CLUB.watchlist.findIndex(w => w.id === id);
      if (frei) {                                       // die alte Merkliste kennt nur Marktspieler (wie kickstil_transfersuche.js)
        if (i >= 0) CLUB.watchlist.splice(i, 1);
        else { const z = zeilen($('tr-sub-markt')).find(y => y.id === id && y.frei); if (z) CLUB.watchlist.push({ id, name: dn(z.p), flag: z.p.flag, pos: z.p.pos, value: 0, frei: true }); }
        if (typeof saveGameState === 'function') { try { saveGameState(); } catch (e) { /* später */ } }
      } else if (typeof toggleWatch === 'function') toggleWatch(id);
    } else if (a === 'kaufen' && typeof buyPlayer === 'function') buyPlayer(id);
    else if (a === 'leihe' && typeof loanInPlayer === 'function') loanInPlayer(id);
    else if (a === 'frei' && typeof W.signFreeAgent === 'function') W.signFreeAgent(id);
    setTimeout(() => { if (W.KSTransfersuche) KSTransfersuche.zeichne(); zeichne(); }, 300);
  }
  function klick(ev) {
    if (!an()) return;
    const th = ev.target.closest('#pctr th[data-pctr-sort]');
    if (th) { const k = th.getAttribute('data-pctr-sort'); sort = sort.k === k ? (sort.ab ? { k, ab: false } : { k: '', ab: true }) : { k, ab: k !== 'name' && k !== 'pos' && k !== 'her' && k !== 'alter' && k !== 'preis' }; zeichne(); return; }
    const b = ev.target.closest('#pctr-detail [data-pctr-akt]');
    if (b) { if (!b.disabled) aktion(b.getAttribute('data-pctr-akt')); return; }
    const z = ev.target.closest('#pctr tr.pctr-z');
    if (z) { wahl = z.getAttribute('data-pctr'); zeichne(); }
  }
  function taste(ev) {
    if (!an() || ev.ctrlKey || ev.altKey || ev.metaKey || /INPUT|TEXTAREA|SELECT/.test((ev.target && ev.target.tagName) || '')) return;
    if ((ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp') || !$('pctr') || !$('pctr').offsetParent) return;
    const rows = [...document.querySelectorAll('#pctr tr.pctr-z')], i = rows.findIndex(r => r.classList.contains('an'));
    const n = rows[Math.max(0, Math.min(rows.length - 1, i + (ev.key === 'ArrowDown' ? 1 : -1)))];
    if (!n) return;
    ev.preventDefault(); wahl = n.getAttribute('data-pctr'); zeichne();
    const neu = document.querySelector('#pctr tr.pctr-z.an'); if (neu) neu.scrollIntoView({ block: 'nearest' });
  }
  function start() {
    if ($('pctr-css')) return;
    const st = document.createElement('style'); st.id = 'pctr-css'; st.textContent = STIL; document.head.appendChild(st);
    document.addEventListener('click', klick);
    document.addEventListener('keydown', taste);
    const mo = new MutationObserver(ms => {
      if (bau || ms.every(m => m.target.closest && m.target.closest('#pctr'))) return;
      clearTimeout(start.t); start.t = setTimeout(tick, 20);
    });
    const beob = () => { const v = $('view-transfer'); if (v) mo.observe(v, { childList: true, subtree: true }); else setTimeout(beob, 500); };
    beob();
    setInterval(tick, 1000);
    console.log('[Kickstil-PC-Transfer v1] aktiv — Transfersuche als Tabelle mit Spieler rechts, Angebote kompakt (nur PC ≥ 1200 px, Flutlicht)');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  W.KSPcTransfer = { zeichne, tick };
})();
