/* ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
   Kickstil – Scouting am PC (2026-10-20, nur PC-Version, beide Spiele)
   Nutzer: „Restliche Ansichten FM-artig“ → per Rückfrage „Scouting zuerst“, „Tabelle + Bericht rechts“.
   Gilt nur mit body.pcu-an (kickstil_pc_uebersicht.js: PC-App + Fenster ≥ 1200 px). Handy und Browser unverändert.
   · Kopf der Scouting-Abteilung (Chefscout, Bereiche, Positionen, Filter) bleibt, die Liste darunter wird zur Tabelle #pcsc
     (Name, Pos, Alter, Verein/Herkunft, Stärke, Pot., Note, Status; Spaltenkopf sortiert, Pfeiltasten wechseln die Zeile).
   · Rechts der Bericht: Kickdraft DFLScouting.berichtHtml (Knöpfe laufen über dessen data-sc-Klicks), Flutlicht eine
     Zusammenfassung aus KSScouting (sicht, Note, Satz des Chefscouts) mit Ansehen, Vereinsblatt bzw. Kaufen.
   · Quelle bleiben die versteckten Zeilen der App (Reihenfolge, Filter); Flutlichts Zeilen tragen dafür data-kss-key.
   ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const W = window;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const an = () => document.body.classList.contains('pcu-an');
  const geld = v => (typeof formatEuro === 'function' ? formatEuro(v || 0) : Math.round(v || 0) + ' €');
  const POSRANG = ['TW', 'IV', 'LV', 'RV', 'AV', 'ZDM', 'DM', 'ZM', 'LM', 'RM', 'AM', 'ZOM', 'OM', 'LF', 'RF', 'FL', 'ST'];
  const rang = pos => { const r = POSRANG.indexOf(pos); return r < 0 ? 99 : r; };
  const spanne = r => (r ? (r.lo === r.hi ? String(r.lo) : r.lo + '–' + r.hi) : '?');
  const ico = n => `<i class="ti ti-${n}" aria-hidden="true"></i>`;

  const CSS = `
body.pcu-an .pcsc-an .kss-liste, body.pcu-an .pcsc-an .sc-liste, body.pcu-an .pcsc-an .sc-fuss:not(:last-child) { display: none !important; }
/* Nutzer 2026-10-22: alle drei Tabellen (Draft, Liga, Free Agents) auf derselben Höhe – „Dein Pick“ steht im Draft rechts in der Filterzeile statt in einer eigenen Zeile */
body.pcu-an .pcsc-an .sc-pick { width: max-content; margin: -44px 4px 0 auto; height: 34px; position: relative; z-index: 1; }
body.pcu-an #pcsc { display: grid; grid-template-columns: minmax(0, 1fr) minmax(340px, 400px); gap: 14px; align-items: start; margin: 10px auto; }
body.pcu-an #pcsc-tab { min-width: 0; border: 2px solid var(--tz-linie, var(--border)); border-radius: 14px; background: var(--bg2); overflow: hidden; }
body.pcu-an #pcsc-tab table { width: 100%; border-collapse: collapse; font-size: 13px; }
body.pcu-an #pcsc-tab th { background: var(--bg3); text-align: left; font-size: 10.5px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase;
  color: var(--text3); padding: 8px; cursor: pointer; white-space: nowrap; user-select: none; border-bottom: 2px solid var(--tz-linie, var(--border)); }
body.pcu-an #pcsc-tab th.r, body.pcu-an #pcsc-tab td.r { text-align: right; }
body.pcu-an #pcsc-tab th.m, body.pcu-an #pcsc-tab td.m { text-align: center; }
body.pcu-an #pcsc-tab th[aria-sort] { color: var(--text); }
body.pcu-an #pcsc-tab th i { font-size: 11px; vertical-align: -1px; }
body.pcu-an #pcsc-tab td { padding: 5px 8px; border-bottom: 1px solid var(--border); white-space: nowrap; vertical-align: middle; }
body.pcu-an #pcsc-tab tr.pcsc-z { cursor: pointer; }
body.pcu-an #pcsc-tab tr.pcsc-z:hover td { background: var(--bg3); }
body.pcu-an #pcsc-tab tr.pcsc-z.an td { background: var(--k-info-bg, #dcebf7); }
body.pcu-an #pcsc-tab tr.pcsc-z.an td:first-child { box-shadow: inset 4px 0 0 var(--k-blau-knopf, #2c7cb5); }
body.pcu-an #pcsc-tab tr.pcsc-z.neu td:first-child::before { content: ''; display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: var(--k-gruen, #25c065); margin-right: 6px; vertical-align: 1px; }
body.pcu-an #pcsc-tab td.pcsc-n { font-weight: 800; }
body.pcu-an #pcsc-tab td.pcsc-n b { font-weight: 800; }
body.pcu-an #pcsc-tab td.pcsc-her { max-width: 190px; overflow: hidden; text-overflow: ellipsis; color: var(--text2); }
body.pcu-an #pcsc-tab td .pos-badge-sm { margin: 0 2px 0 0; font-size: 10.5px; padding: 2px 6px; line-height: 1.2; }
body.pcu-an #pcsc-tab .kss-zahl, body.pcu-an #pcsc-tab .sc-zahl { font-size: 14px; }
body.pcu-an #pcsc-tab .kss-note, body.pcu-an #pcsc-tab .cs-note { padding: 3px 6px; min-width: 26px; font-size: 12px; }
body.pcu-an #pcsc-tab .kss-ring, body.pcu-an #pcsc-tab .sc-ring { width: 24px; height: 24px; display: inline-grid; }
body.pcu-an #pcsc-tab .pcsc-ok { font-size: 11.5px; font-weight: 800; color: var(--k-gut-fg, #2f6b1f); }
body.pcu-an #pcsc-tab button.pcsc-ansehen { font: 700 11.5px/1 var(--font-titel, system-ui); padding: 6px 9px; border-radius: 9px; border: 0; cursor: pointer;
  background: var(--k-gruen, #25c065); color: #fff; box-shadow: 0 2px 0 var(--k-gruen-tief, #188a46); }
body.pcu-an #pcsc-tab .kss-steal, body.pcu-an #pcsc-tab .cs-steal { margin-left: 5px; }
body.pcu-an #pcsc-tab .pcsc-leer { padding: 16px; color: var(--text3); }
body.pcu-an #pcsc-detail { position: sticky; top: 8px; max-height: calc(100vh - 24px); overflow-y: auto; scrollbar-width: thin;
  border: 2px solid var(--tz-linie, var(--border)); border-radius: 14px; background: var(--bg2); padding: 12px; }
body.pcu-an #pcsc-detail .pcsc-kopf { display: flex; gap: 12px; align-items: center; margin-bottom: 10px; }
body.pcu-an #pcsc-detail .pcsc-kopf .vb-gesicht { width: 64px; height: 64px; flex: none; border-radius: 50%; overflow: hidden; background: var(--bg3); }
body.pcu-an #pcsc-detail .pcsc-kopf .vb-gesicht svg { width: 64px; height: 64px; display: block; }
body.pcu-an #pcsc-detail .pcsc-kopf h4 { margin: 0 0 3px; font: 700 19px/1.15 var(--font-titel, system-ui); }
body.pcu-an #pcsc-detail .pcsc-kopf small { display: block; color: var(--text3); font-size: 12px; }
body.pcu-an #pcsc-detail .pcsc-kacheln { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; margin: 8px 0; }
body.pcu-an #pcsc-detail .pcsc-kachel { background: var(--bg3); border-radius: 10px; padding: 7px 8px; }
body.pcu-an #pcsc-detail .pcsc-kachel small { display: block; font-size: 10px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; color: var(--text3); }
body.pcu-an #pcsc-detail .pcsc-kachel b { display: block; font: 800 17px/1.3 var(--font-zahl, system-ui); }
body.pcu-an #pcsc-detail .pcsc-kachel span { font-size: 11px; color: var(--text3); }
body.pcu-an #pcsc-detail .pcsc-satz { font-style: italic; font-size: 13px; margin: 8px 0; padding: 8px 10px; border-left: 3px solid var(--k-gold, #c9a227); background: var(--bg3); border-radius: 0 10px 10px 0; }
body.pcu-an #pcsc-detail .pcsc-knoepfe { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
body.pcu-an #pcsc-detail .pcsc-knoepfe .app-knopf { flex: 1 1 auto; }
body.pcu-an #pcsc-detail .pcsc-zeilen { font-size: 12.5px; margin: 8px 0 0; }
body.pcu-an #pcsc-detail .pcsc-zeilen div { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed var(--border); }
body.pcu-an #pcsc-detail .pcsc-zeilen span { color: var(--text3); }
body.pcu-an #pcsc-detail .pcsc-leer { padding: 12px; color: var(--text3); }
@media (max-width: 1450px) {
  body.pcu-an #pcsc { grid-template-columns: minmax(0, 1fr) 320px; }
  body.pcu-an #pcsc-tab td, body.pcu-an #pcsc-tab th { padding-left: 6px; padding-right: 6px; }
  body.pcu-an #pcsc-tab td.pcsc-her { max-width: 120px; }
}
`;

  // ── Flutlicht (kickstil_scouting.js) ────────────────────────────────────────────────────────────────────────────
  const FL = {
    box: () => $('ks-scouting'),
    liste: b => b.querySelector('.kss-liste'),
    zeilen(b) {
      const K = W.KSScouting; if (!K || !K.kandidaten) return [];
      const karte = new Map(K.kandidaten(K.seg()).map(x => [K.schluessel(x.p), x]));
      return [...b.querySelectorAll('.kss-liste > .kss-zeile[data-kss-key]')].map((row, i) => {
        const key = row.getAttribute('data-kss-key'), x = karte.get(key); if (!x) return null;
        const p = x.p, s = K.sicht(p), wartet = K.wartet(key);
        const teile = ((row.querySelector('.kss-txt small') || {}).textContent || '').split(' · ');
        const st = row.querySelector('.kss-werte > :first-child'), nt = row.querySelector('.kss-note');
        return {
          i, id: key, neu: row.classList.contains('neu'), p,
          name: esc((p.firstName ? p.firstName.charAt(0) + '. ' : '') + p.name) + (s.note && s.note.steal ? ' <em class="kss-steal">Steal</em>' : ''),
          pos: (p.positions || [p.pos]).slice(0, 2).map(q => `<span class="pos-badge-sm pos-${esc(q)}">${esc(q)}</span>`).join(''),
          posWert: rang(p.pos), alter: p.age,
          her: teile.slice(2).join(' · ').trim(),
          st: st ? st.outerHTML : '', stWert: s.bericht ? 1000 + (s.ovr || 0) : (s.stufe && s.stufe.ab) || 0,
          pot: spanne(s.pot), potWert: s.pot ? s.pot.hi : -1,
          note: nt ? nt.outerHTML : '', noteWert: s.note ? -s.note.i : -99,
          status: s.bericht ? '<span class="pcsc-ok">Bericht</span>' : wartet ? `<span class="kss-ring" title="Scout ist unterwegs">${ico('telescope')}</span>`
            : `<button type="button" class="pcsc-ansehen" data-pcsc-ansehen="${esc(key)}">Ansehen</button>`,
          statusWert: s.bericht ? 2 : wartet ? 1 : 0
        };
      }).filter(Boolean);
    },
    detail(key) {
      const K = W.KSScouting, x = K && K.finde(key); if (!x) return '<div class="pcsc-leer">Spieler nicht mehr da.</div>';
      const p = x.p, s = K.sicht(p), wartet = K.wartet(key), tv = K.teamVon(), team = x.verein && tv[x.verein] ? tv[x.verein].t : null;
      const verein = team ? team.name : (x.vereinName || 'vereinslos');
      const kachel = (t, w, u) => `<div class="pcsc-kachel"><small>${t}</small><b>${w}</b><span>${u || ''}</span></div>`;
      const knoepfe = [];
      if (!s.bericht) knoepfe.push(wartet ? `<button type="button" class="app-knopf" disabled>${ico('telescope')}Scout unterwegs</button>`
        : `<button type="button" class="app-knopf haupt" data-pcsc-ansehen="${esc(key)}">${ico('eye')}Ansehen</button>`);
      if (team && W.KSVereinsblatt) knoepfe.push(`<button type="button" class="app-knopf" data-pcsc-verein="${esc(team.id)}">${ico('shield')}Vereinsblatt</button>`);
      if (x.markt && typeof W.buyPlayer === 'function') knoepfe.push(`<button type="button" class="app-knopf" data-pcsc-kaufen="${esc(p.id)}">${ico('shopping-cart')}Kaufen · ${esc(geld(p.value))}</button>`);
      const zeilen = [];
      if (x.markt && p.value) zeilen.push(['Ablöse', geld(p.value)]);
      if (s.bericht && p.wage) zeilen.push(['Gehalt', geld(p.wage) + '/Wo']);
      if (s.bericht && p.contractUntil != null && typeof LEAGUE !== 'undefined') zeilen.push(['Vertrag bis', (LEAGUE.startYear || 2026) + p.contractUntil]);
      return `<div class="pcsc-kopf"><span class="vb-gesicht">${K.gesicht(p, x.verein)}</span><div>
          <h4>${esc((p.firstName ? p.firstName + ' ' : '') + p.name)}</h4>
          <small>${esc(p.flag || '')} ${p.age} Jahre · ${esc((p.positions || [p.pos]).join(', '))}</small>
          <small>${esc(verein)}${x.talent ? ' · Akademie' : ''}</small></div></div>
        <div class="pcsc-kacheln">${kachel('Stärke', s.bericht ? s.ovr : `<span class="vb-stufe ${esc(s.stufe.key)}">${esc(s.stufe.name)}</span>`, s.bericht ? 'genau' : 'nur die Stufe')}
          ${kachel('Potenzial', spanne(s.pot), s.bericht ? 'Spanne' : 'erst mit Bericht')}
          ${kachel('Note', s.note ? esc(s.note.note) + (s.note.steal ? ' ' + ico('diamond') : '') : '?', s.note ? (s.note.steal ? 'Steal' : 'Chefscout') : 'erst mit Bericht')}</div>
        ${s.note ? `<div class="pcsc-satz">„${esc(K.satz(p, s.note))}“</div>` : ''}
        ${zeilen.length ? `<div class="pcsc-zeilen">${zeilen.map(([a, b]) => `<div><span>${esc(a)}</span><b>${esc(b)}</b></div>`).join('')}</div>` : ''}
        <div class="pcsc-knoepfe">${knoepfe.join('')}</div>`;
    }
  };

  // ── Kickdraft (dfl_scouting_patch.js + dfl_chefscout_patch.js) ──────────────────────────────────────────────────
  const KD = {
    box: () => $('dfl-scouting'),
    liste: b => b.querySelector('.sc-liste'),
    zeilen(b) {
      const S = W.DFLScouting, C = W.DFLChefscout; if (!S || !S.finde) return [];
      return [...b.querySelectorAll('.sc-liste .sc-zeile[data-sc^="offen:"]')].map((row, i) => {
        const id = row.getAttribute('data-sc').slice(6), f = S.finde(id); if (!f) return null;
        const w = f.w, fertig = row.classList.contains('fertig');
        const klein = row.querySelector('.sc-name small'), badge = klein && klein.querySelector('.pos-badge-sm');
        const txt = (klein ? klein.textContent : '').replace(/^\s*\S+\s+/, '');           // Positionskürzel vorn weg
        const her = txt.split(' · ').slice(1).join(' · ').trim();
        const nt = row.querySelector('.sc-status .cs-note:not(.offen)'), ring = row.querySelector('.sc-status > :not(.cs-note)');
        const pt = S.potText ? S.potText(w) : '?', pz = /(\d+)\D*$/.exec(pt);
        const z1 = row.querySelector('.sc-z1'), steal = row.querySelector('.cs-steal');
        return {
          i, id, neu: row.classList.contains('sc-neu'), p: w,
          name: (z1 ? z1.innerHTML : esc(w.name)) + (steal ? steal.outerHTML : ''),
          pos: badge ? badge.outerHTML : esc(w.pos), posWert: rang(w.pos), alter: w.age, her,
          st: (row.querySelector('.sc-werte') || {}).innerHTML || '', stWert: S.sortWert ? S.sortWert(w) : w.ovr,
          pot: pt, potWert: pz ? +pz[1] : -1,
          note: nt ? nt.outerHTML : '', noteWert: nt && C ? -C.NOTEN.indexOf(nt.textContent.trim()) : -99,
          status: fertig ? '<span class="pcsc-ok">Bericht</span>' : ring ? ring.outerHTML
            : `<button type="button" class="pcsc-ansehen" data-sc="scout:${esc(id)}">Ansehen</button>`,
          statusWert: fertig ? 2 : ring ? 1 : 0
        };
      }).filter(Boolean);
    },
    detail(id) {
      const S = W.DFLScouting, C = W.DFLChefscout, f = S && S.finde(id); if (!f) return '<div class="pcsc-leer">Spieler nicht mehr in der Liga.</div>';
      let satz = '';
      try { const p = C && C.person(), b = S.bericht(id); if (C && b) satz = `<div class="pcsc-satz">${p ? `<b>${esc(p.name)}:</b> ` : ''}„${esc(C.satz(f.w))}“</div>`; } catch (e) { satz = ''; }
      let bericht = ''; try { bericht = S.berichtHtml(id); } catch (e) { bericht = ''; }
      return satz + `<div class="sc-blatt">${bericht}</div>`;
    }
  };

  const SPALTEN = [
    ['name', 'Name', z => String(z.p.name || '').toLowerCase()], ['pos', 'Pos', z => z.posWert], ['alter', 'Alter', z => z.alter, 'r'],
    ['her', 'Verein', z => z.her.toLowerCase()], ['st', 'Stärke', z => z.stWert], ['pot', 'Pot.', z => z.potWert],
    ['note', 'Note', z => z.noteWert, 'm'], ['status', 'Status', z => z.statusWert, 'm']
  ];
  let sort = { k: '', ab: true }, wahl = null, bau = false;
  const spiel = () => (FL.box() ? FL : KD.box() ? KD : null);

  function zeichne() {
    const A = spiel(), box = A && A.box();
    if (!box) return;
    if (!an()) { box.classList.remove('pcsc-an'); const c = $('pcsc'); if (c) c.remove(); return; }
    const liste = A.liste(box);
    if (!liste) return;
    bau = true;
    try {
      box.classList.add('pcsc-an');
      let zeilen = A.zeilen(box);
      const sp = SPALTEN.find(s => s[0] === sort.k);
      if (sp) zeilen = zeilen.slice().sort((a, b) => { const x = sp[2](a), y = sp[2](b); return (x < y ? -1 : x > y ? 1 : a.i - b.i) * (sort.ab ? -1 : 1); });
      if (!wahl || !zeilen.some(z => z.id === wahl)) wahl = zeilen.length ? zeilen[0].id : null;
      let c = $('pcsc');
      if (!c) { c = document.createElement('div'); c.id = 'pcsc'; c.innerHTML = '<div id="pcsc-tab"></div><div id="pcsc-detail"></div>'; }
      if (c.previousElementSibling !== box) box.parentNode.insertBefore(c, box.nextSibling);
      const kopf = SPALTEN.map(([k, t, , r]) => `<th data-pcsc-sort="${k}" class="${r || ''}"${sort.k === k ? ` aria-sort="${sort.ab ? 'descending' : 'ascending'}"` : ''}>${t}${sort.k === k ? ` ${ico('chevron-' + (sort.ab ? 'down' : 'up'))}` : ''}</th>`).join('');
      const body = zeilen.map(z => `<tr class="pcsc-z${z.id === wahl ? ' an' : ''}${z.neu ? ' neu' : ''}" data-pcsc-id="${esc(z.id)}">
        <td class="pcsc-n">${z.name}</td><td>${z.pos}</td><td class="r">${z.alter}</td><td class="pcsc-her" title="${esc(z.her)}">${esc(z.her)}</td>
        <td>${z.st}</td><td>${esc(z.pot)}</td><td class="m">${z.note}</td><td class="m">${z.status}</td></tr>`).join('');
      $('pcsc-tab').innerHTML = zeilen.length ? `<table><thead><tr>${kopf}</tr></thead><tbody>${body}</tbody></table>`
        : `<div class="pcsc-leer">${esc(liste.textContent.trim() || 'Niemand in dieser Liste.')}</div>`;
      $('pcsc-detail').innerHTML = wahl ? A.detail(wahl) : '<div class="pcsc-leer"></div>';   // Nutzer 2026-10-22: überflüssiger Text raus („Spieler antippen“)
      liste._pcsc = true;
    } catch (e) { console.warn('[KS-PC-Scouting]', e); }
    finally { bau = false; }
  }
  function tick() {
    const A = spiel(), box = A && A.box();
    if (!box) return;
    const l = A.liste(box);
    if (an() && l && (!l._pcsc || !$('pcsc') || $('pcsc').previousElementSibling !== box)) zeichne();
    else if (!an() && box.classList.contains('pcsc-an')) zeichne();
  }
  function klick(ev) {
    if (!an()) return;
    const th = ev.target.closest('#pcsc th[data-pcsc-sort]');
    if (th) { const k = th.getAttribute('data-pcsc-sort'); sort = sort.k === k ? (sort.ab ? { k, ab: false } : { k: '', ab: true }) : { k, ab: k !== 'name' && k !== 'pos' && k !== 'her' }; zeichne(); return; }
    const a = ev.target.closest('#pcsc [data-pcsc-ansehen]');
    if (a) { ev.stopPropagation(); wahl = a.getAttribute('data-pcsc-ansehen'); if (W.KSScouting) KSScouting.ansehen(wahl); setTimeout(zeichne, 30); return; }
    const v = ev.target.closest('#pcsc [data-pcsc-verein]');
    if (v) { if (W.KSVereinsblatt) KSVereinsblatt.oeffnen(v.getAttribute('data-pcsc-verein')); return; }
    const k = ev.target.closest('#pcsc [data-pcsc-kaufen]');
    if (k) { if (typeof W.buyPlayer === 'function') W.buyPlayer(k.getAttribute('data-pcsc-kaufen')); setTimeout(zeichne, 300); return; }
    // Ansehen in der Zeile (Kickdraft: data-sc, die App zeichnet neu) – nur die Auswahl mitnehmen
    const sc = ev.target.closest('#pcsc-tab [data-sc]');
    if (sc) { const z = sc.closest('tr.pcsc-z'); if (z) wahl = z.getAttribute('data-pcsc-id'); setTimeout(zeichne, 60); return; }
    const z = ev.target.closest('#pcsc tr.pcsc-z');
    if (z) { wahl = z.getAttribute('data-pcsc-id'); zeichne(); return; }
    if (ev.target.closest('#pcsc-detail button')) setTimeout(zeichne, 80);
  }
  function taste(ev) {
    if (!an() || ev.ctrlKey || ev.altKey || ev.metaKey || /INPUT|TEXTAREA|SELECT/.test((ev.target && ev.target.tagName) || '')) return;
    if ((ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp') || !$('pcsc') || !$('pcsc').offsetParent) return;
    const rows = [...document.querySelectorAll('#pcsc tr.pcsc-z')], i = rows.findIndex(r => r.classList.contains('an'));
    const n = rows[Math.max(0, Math.min(rows.length - 1, i + (ev.key === 'ArrowDown' ? 1 : -1)))];
    if (!n) return;
    ev.preventDefault(); wahl = n.getAttribute('data-pcsc-id'); zeichne();
    const neu = document.querySelector('#pcsc tr.pcsc-z.an'); if (neu) neu.scrollIntoView({ block: 'nearest' });
  }
  function start() {
    if ($('pcsc-css')) return;
    const st = document.createElement('style'); st.id = 'pcsc-css'; st.textContent = CSS; document.head.appendChild(st);
    document.addEventListener('click', klick);
    document.addEventListener('keydown', taste);
    const mo = new MutationObserver(ms => {
      if (bau || ms.every(m => m.target.closest && m.target.closest('#pcsc'))) return;
      // noch vor dem nächsten Bild (Mikrotask) statt 20 ms später – sonst stand die Tabelle beim Reiterwechsel ein paar Bilder leer
      // (Nutzer 2026-10-22: „das dauert ein paar Frames zu lange“)
      if (start.mt) return; start.mt = true;
      queueMicrotask(() => { start.mt = false; tick(); });
    });
    const beob = () => { const v = $('view-scout'); if (v) mo.observe(v, { childList: true, subtree: true }); else setTimeout(beob, 500); };
    beob();
    setInterval(tick, 1000);
    console.log('[Kickstil-PC-Scouting v1] aktiv — Scouting als Tabelle mit Bericht rechts (nur PC ≥ 1200 px, beide Spiele)');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  W.KSPcScouting = { zeichne, tick };
})();
