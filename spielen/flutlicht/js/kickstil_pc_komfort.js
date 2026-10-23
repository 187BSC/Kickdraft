/* ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
   Kickstil – Komfort am PC wie im FM (2026-10-21, nur PC-Ansicht body.pcu-an, beide Spiele)
   Nutzer: Vorschau „Rechtsklick-Menü, Vergleich, Suche, Einstellungen, Tastenübersicht“ → „Ja, so bauen“; fremde Spieler:
   „Profil, Vergleich, Beobachten, Bieten“ (Kickdraft: Trade anbieten).
   · Rechtsklick auf einen Spieler (Kader-Tabelle, Startelf, Bank, Feld, Transfersuche, Scouting, FA-Liste, Spielerblatt, Suche):
     Menü mit Profil · Vergleichen mit … · Beobachten · eigene: Vertrag verlängern, Verkaufen (Flutlicht), Tauschen (Aufstellung) ·
     fremde: Bieten / Verpflichten (Flutlicht, Markt), Trade anbieten (Kickdraft). Tasten im Menü: Enter, V, B, Esc, Pfeile.
   · Vergleich: zwei Spieler nebeneinander (Stärke, Potenzial, sechs Detailwerte, Alter, Gehalt, Marktwert); fremde Spieler ohne
     Scout-Bericht nur mit Stärke-Stufe („70er“), ohne Detailwerte und Potenzial – wie sonst im Spiel.
   · Strg+F: Suche über eigene Spieler, die Welt (Kader aller Vereine, Markt, Kickdraft auch Draft und Vereinslose), Vereine und Bereiche.
     Enter öffnet, Strg+Enter vergleicht, Rechtsklick öffnet das Menü.
   · Strg+, oder Navigation „Einstellungen“: Ticker (Jede Minute/Höhepunkte/Aus), Tempo, „Simulieren bis …“ hält bei Angeboten
     (nur Flutlicht), Tag/Nacht, Zoom, Vollbild (PC-App), Verweise auf Sicherungen/Problem melden und Streamer-Modus.
   · Taste ?: Tastenübersicht.
   ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const W = window;
  const KD = /\/kickdraft\//.test(location.pathname) || !!W.DFLSpiel;
  const an = () => document.body.classList.contains('pcu-an');
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ico = n => `<i class="ti ti-${n}" aria-hidden="true"></i>`;
  const spiel = () => typeof LEAGUE !== 'undefined' && LEAGUE && typeof CLUB !== 'undefined' && CLUB && typeof SQUAD !== 'undefined';
  const voll = p => (p.firstName ? p.firstName + ' ' : '') + p.name;
  const kurz = p => (p.firstName ? p.firstName.charAt(0) + '. ' : '') + p.name;
  const geld = v => { v = +v || 0; return v >= 1e6 ? (Math.round(v / 1e5) / 10).toLocaleString('de-DE') + ' Mio. €' : v >= 1e3 ? Math.round(v / 1e3) + ' T. €' : v + ' €'; };
  const teamName = t => { const c = (t && t.city) || '', n = (t && t.name) || ''; return (c && n.indexOf(c) !== 0 ? c + ' ' + n : n).trim(); };   // Kickdraft: name enthält oft schon die Stadt
  const frei = () => { const a = document.activeElement; return !(a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable)); };

  // ── Spieler finden: Element → { p, eigen, kontext } ───────────────────────────────────────────────────────────────
  const eigenP = id => (SQUAD || []).find(q => q.id === id) || ((typeof CLUB !== 'undefined' && CLUB.youthProspects) || []).find(q => q.id === id) || null;
  const istEigen = p => !!p && ((SQUAD || []).indexOf(p) >= 0 || ((CLUB.youthProspects || []).indexOf(p) >= 0));
  function weltKD(id) {
    try { const f = W.DFLScouting && DFLScouting.finde(String(id)); if (f && f.w) return { p: f.w, team: f.team }; } catch (e) { /* weiter */ }
    try {
      const L = DFLSpiel.liga();
      for (const t of L.teams) { const p = (t.roster || []).concat(t.practice_squad || []).find(x => String(x.id) === String(id)); if (p) return { p, team: t }; }
      const p = (L.freie || []).concat(L.draft ? L.draft.talente : [], L.draftNaechste ? L.draftNaechste.talente : []).find(x => String(x.id) === String(id));
      if (p) return { p, team: null };
    } catch (e) { /* ohne Welt */ }
    return null;
  }
  function ausElement(el) {
    if (!el || !el.closest || !spiel()) return null;
    let x;
    if ((x = el.closest('[data-pkf-p]'))) return treffer.get(x.getAttribute('data-pkf-p')) || null;
    if ((x = el.closest('[data-pck],[data-pid],[data-bk],[data-tausch]'))) {
      const id = x.getAttribute('data-pck') || x.getAttribute('data-pid') || x.getAttribute('data-bk') || x.getAttribute('data-tausch');
      const p = eigenP(id); if (p) return { p, eigen: true, kontext: x.hasAttribute('data-bk') ? { typ: 'bench', key: id } : null };
    }
    if ((x = el.closest('[data-pck-slot]'))) {
      const key = x.getAttribute('data-pck-slot'), p = CLUB.lineup && eigenP(CLUB.lineup[key]);
      if (p) return { p, eigen: true, kontext: { typ: 'slot', key } };
    }
    if ((x = el.closest('#pitch .p-slot'))) {
      const i = [...document.querySelectorAll('#pitch .p-slot')].indexOf(x), sl = ((typeof FORMATIONS !== 'undefined' && FORMATIONS[CLUB.formation]) || [])[i];
      const p = sl && CLUB.lineup && eigenP(CLUB.lineup[sl.id]);
      if (p) return { p, eigen: true, kontext: { typ: 'slot', key: sl.id } };
    }
    if ((x = el.closest('[data-kts]'))) {
      const id = x.getAttribute('data-kts'), fr = x.getAttribute('data-frei') === '1';
      const p = (!fr && typeof MARKET !== 'undefined' && MARKET && (MARKET.players || []).find(q => q.id === id)) || katalogP(id);
      if (p) return { p, eigen: false, markt: !fr, frei: fr };
    }
    if ((x = el.closest('tr[data-pctr]'))) {           // PC-Transfermarkt (kickstil_pc_transfer.js): Schlüssel „id|frei“
      const [id, f] = x.getAttribute('data-pctr').split('|'), fr = f === '1';
      const p = (!fr && typeof MARKET !== 'undefined' && MARKET && (MARKET.players || []).find(q => q.id === id)) || katalogP(id);
      if (p) return { p, eigen: false, markt: !fr, frei: fr };
    }
    if ((x = el.closest('[data-pcsc-id]'))) {
      const key = x.getAttribute('data-pcsc-id');
      if (KD) { const w = weltKD(key); if (w) return { p: w.p, eigen: false, team: w.team }; }
      else { try { const f = KSScouting.finde(key); if (f && f.p) return { p: f.p, eigen: istEigen(f.p), markt: !!f.markt }; } catch (e) { /* weiter */ } }
    }
    if ((x = el.closest('[data-pch-welt]'))) { const w = weltKD(x.getAttribute('data-pch-welt')); if (w) return { p: w.p, eigen: false, team: w.team, frei: !w.team }; }
    if ((x = el.closest('#app-blatt .app-blatt-box[data-spieler]'))) { const p = eigenP(x.dataset.spieler); if (p) return { p, eigen: true }; }
    return null;
  }
  function katalogP(id) {
    try { const l = W.KSTransfersuche && KSTransfersuche.liste ? KSTransfersuche.liste(true) : []; const z = l.find(y => y.p && y.p.id === id); return z ? z.p : null; } catch (e) { return null; }
  }

  // ── Aktionen ────────────────────────────────────────────────────────────────────────────────────────────────────
  function profil(t) {
    const p = t.p;
    if (KD && !t.eigen) { try { if (W.DFLScouting && DFLScouting.blatt) { DFLScouting.blatt(String(p.id)); return; } } catch (e) { /* weiter */ } }
    if (KD && t.eigen === false) return;
    try { DFLAppShell.spielerBlatt(p, t.kontext || null); } catch (e) { console.warn('[Kickstil-PC-Komfort] Profil', e); }
  }
  const gemerkt = p => (CLUB.watchlist || []).some(w => w.id === p.id);
  function merken(t) {
    if (!Array.isArray(CLUB.watchlist)) CLUB.watchlist = [];
    const p = t.p, i = CLUB.watchlist.findIndex(w => w.id === p.id);
    if (i >= 0) CLUB.watchlist.splice(i, 1);
    else CLUB.watchlist.push({ id: p.id, name: kurz(p), flag: p.flag, pos: p.pos, value: p.value || 0, frei: !!t.frei });
    toast(i >= 0 ? `${kurz(p)} von der Beobachtungsliste genommen` : `${kurz(p)} wird beobachtet`);
    try { saveGameState(); } catch (e) { /* später */ }
  }
  function eintraege(t) {
    const p = t.p, l = [];
    l.push({ k: 'profil', t: 'Spielerprofil', i: 'id', kbd: 'Enter' });
    l.push(V && V.p !== p ? { k: 'mit', t: `Mit ${kurz(V.p)} vergleichen`, i: 'arrows-left-right', kbd: 'V' } : { k: 'vergl', t: 'Vergleichen mit …', i: 'arrows-left-right', kbd: 'V' });
    if (!t.eigen && !KD) l.push({ k: 'merk', t: gemerkt(p) ? 'Nicht mehr beobachten' : 'Auf die Beobachtungsliste', i: gemerkt(p) ? 'star-off' : 'star', kbd: 'B' });
    if (t.eigen && (SQUAD || []).indexOf(p) >= 0) {
      l.push({ sep: true });
      if (typeof W.renewContract === 'function') l.push({ k: 'vertrag', t: 'Vertrag verlängern', i: 'writing-sign' });
      if (!KD && typeof W.sellPlayer === 'function') l.push({ k: 'verkauf', t: 'Verkaufen', i: 'coin-euro' });
      if (t.kontext) l.push({ k: 'tausch', t: 'Tauschen …', i: 'arrows-exchange' });
    } else if (!t.eigen) {
      const fl = !KD && (t.markt && typeof W.buyPlayer === 'function' ? { k: 'kauf', t: `Bieten · ${geld(p.value)}`, i: 'shopping-cart' } : t.frei && typeof W.signFreeAgent === 'function' ? { k: 'frei', t: 'Verpflichten (ablösefrei)', i: 'signature' } : null);
      const kd = KD && t.team && W.DFLTrade && DFLTrade.mitSpieler ? { k: 'trade', t: 'Trade anbieten', i: 'arrows-exchange' } : KD && t.frei && typeof W.signFreeAgent === 'function' ? { k: 'fa', t: 'Verpflichten', i: 'signature' } : null;
      if (fl || kd) { l.push({ sep: true }); l.push(fl || kd); }
    }
    return l;
  }
  function ausfuehren(k, t) {
    menuZu(); sucheZu();
    const p = t.p;
    if (k === 'profil') profil(t);
    else if (k === 'vergl') vergleichStarten(t);
    else if (k === 'mit') vergleich(V, t);
    else if (k === 'merk') merken(t);
    else if (k === 'vertrag') W.renewContract(p.id);
    else if (k === 'verkauf') W.sellPlayer(p.id);
    else if (k === 'tausch') {
      CLUB.selected = { type: t.kontext.typ, key: t.kontext.key };
      try { renderPitch(); renderBench(); } catch (e) { /* Ansicht */ }
      toast(`Tauschen: Klicke den Spieler an, der für ${kurz(p)} kommt.`);
    }
    else if (k === 'kauf') W.buyPlayer(p.id);
    else if (k === 'frei') W.signFreeAgent(p.id);
    else if (k === 'fa') W.signFreeAgent('fa_' + p.id);
    else if (k === 'trade') { try { DFLTrade.mitSpieler(t.team.id, String(p.id)); } catch (e) { console.warn('[Kickstil-PC-Komfort] Trade', e); } }
  }

  // ── Menü ────────────────────────────────────────────────────────────────────────────────────────────────────────
  let M = null;
  function menu(t, x, y) {
    menuZu();
    const l = eintraege(t);
    const m = document.createElement('div'); m.id = 'pkf-menu'; m.setAttribute('role', 'menu');
    m.innerHTML = `<div class="pkf-mk">${esc(kurz(t.p))} <small>${esc(t.p.pos || '')} · ${t.p.age || '?'} J.${t.eigen ? '' : t.team ? ' · ' + esc(teamName(t.team)) : ''}</small></div>`
      + l.map((e, i) => e.sep ? '<div class="pkf-sep"></div>' : `<button type="button" role="menuitem" data-pkf-k="${e.k}" class="${i === 0 ? 'an' : ''}">${ico(e.i)}<span>${esc(e.t)}</span>${e.kbd ? `<kbd>${e.kbd}</kbd>` : ''}</button>`).join('');
    document.body.appendChild(m);
    const r = m.getBoundingClientRect();
    m.style.left = Math.min(x, innerWidth - r.width - 8) + 'px'; m.style.top = Math.min(y, innerHeight - r.height - 8) + 'px';
    M = { m, t };
    m.addEventListener('click', ev => { const b = ev.target.closest('[data-pkf-k]'); if (b) ausfuehren(b.getAttribute('data-pkf-k'), t); });
    m.addEventListener('mousemove', ev => { const b = ev.target.closest('[data-pkf-k]'); if (b) markiere(b); });
  }
  function markiere(b) { if (!M) return; M.m.querySelectorAll('[data-pkf-k]').forEach(x => x.classList.toggle('an', x === b)); }
  function menuZu() { if (M) { M.m.remove(); M = null; } }
  function menuTaste(ev) {
    const bs = [...M.m.querySelectorAll('[data-pkf-k]')], i = bs.findIndex(b => b.classList.contains('an'));
    if (ev.key === 'Escape') { menuZu(); }
    else if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') markiere(bs[(i + (ev.key === 'ArrowDown' ? 1 : bs.length - 1)) % bs.length]);
    else if (ev.key === 'Enter') { const b = bs[Math.max(0, i)]; if (b) ausfuehren(b.getAttribute('data-pkf-k'), M.t); }
    else if (/^[vV]$/.test(ev.key)) { const b = M.m.querySelector('[data-pkf-k="vergl"],[data-pkf-k="mit"]'); if (b) ausfuehren(b.getAttribute('data-pkf-k'), M.t); }
    else if (/^[bB]$/.test(ev.key)) { const b = M.m.querySelector('[data-pkf-k="merk"]'); if (b) ausfuehren('merk', M.t); }
    else return;
    ev.preventDefault(); ev.stopPropagation();
  }

  // ── Vergleich ───────────────────────────────────────────────────────────────────────────────────────────────────
  let V = null;   // erster Spieler, der auf seinen Partner wartet
  function vergleichStarten(t) {
    V = t;
    let h = $('pkf-hinweis'); if (!h) { h = document.createElement('div'); h.id = 'pkf-hinweis'; document.body.appendChild(h); }
    h.innerHTML = `${ico('arrows-left-right')}<span>Vergleich mit <b>${esc(kurz(t.p))}</b>: Rechtsklick auf einen zweiten Spieler oder <kbd>Strg</kbd>+<kbd>F</kbd></span><button type="button" aria-label="Abbrechen">${ico('x')}</button>`;
    h.querySelector('button').onclick = () => { V = null; h.remove(); };
  }
  function scoutKlar(t) {
    if (t.eigen) return true;
    try { return KD ? !!(W.DFLScouting && DFLScouting.hatBericht(String(t.p.id))) : !!(W.KSScouting && KSScouting.hatBericht(t.p)); } catch (e) { return false; }
  }
  function werteVon(t) {
    const p = t.p, klar = scoutKlar(t);
    let d = {}; try { d = (W.spielerWerte && spielerWerte(p)) || {}; } catch (e) { d = {}; }
    const tw = p.pos === 'TW';
    const det = tw ? [['Reflexe', d.reflexe], ['Paraden', d.paraden], ['1 gegen 1', d.einsGegenEins], ['Spielaufbau', d.spielaufbau], ['Schnelligkeit', d.schnelligkeit], ['Ausdauer', d.ausdauer]]
      : [['Passen', d.passen], ['Schnelligkeit', d.schnelligkeit], ['Tackling', d.tackling], ['Dribbling', d.dribbling], ['Schießen', d.schiessen], ['Spielintelligenz', d.spielintelligenz]];
    // Ohne Scout-Bericht nur, was beide Spiele auch sonst zeigen: die Stärke-Stufe (z. B. „70er“), keine Detailwerte, kein Potenzial
    let pot = null;
    if (klar) { try { if (typeof potentialRange === 'function') pot = potentialRange(p, (CLUB.facilities && CLUB.facilities.scouting) || 1); } catch (e) { pot = null; } }
    const rund = v => (v == null || !klar ? null : Math.round(v));
    return { klar, ovr: klar ? Math.round(p.ovr) : null, stufe: Math.floor((p.ovr || 0) / 10) * 10, pot, det: det.map(([n, v]) => [n, rund(v)]), alter: p.age, gehalt: p.wage || null, wert: p.value || null };   // Gehalt nur aus p.wage (Spiel-Gehalt je Woche; Kickdrafts Weltspieler rechnen anders)
  }
  function zeile(n, a, b, besserHoch, fmt, txt) {
    const f0 = fmt || (v => v == null ? '–' : v), f = (v, i) => (txt ? txt[i] : f0(v));
    const ok = besserHoch != null && a != null && b != null && a !== b, aB = ok && (besserHoch ? a > b : a < b), bB = ok && !aB;   // null = ohne Wertung
    const pct = v => (typeof v === 'number' ? Math.max(4, Math.min(100, v)) : 0);
    return `<div class="pkf-vz"><span class="w${aB ? ' b' : ''}">${f(a, 0)}</span><div class="bar l"><i class="${aB ? 'b' : ''}" style="width:${typeof a === 'number' && n !== 'Alter' && n !== 'Gehalt / Woche' && n !== 'Marktwert' ? pct(a) : 0}%"></i></div>
      <span class="n">${esc(n)}</span><div class="bar"><i class="${bB ? 'b' : ''}" style="width:${typeof b === 'number' && n !== 'Alter' && n !== 'Gehalt / Woche' && n !== 'Marktwert' ? pct(b) : 0}%"></i></div><span class="w${bB ? ' b' : ''}">${f(b, 1)}</span></div>`;
  }
  function vergleich(a, b) {
    V = null; const h = $('pkf-hinweis'); if (h) h.remove();
    let box = $('pkf-vergleich'); if (box) box.remove();
    box = document.createElement('div'); box.id = 'pkf-vergleich';
    const x = werteVon(a), y = werteVon(b), wer = t => t.eigen ? 'dein Kader' : t.wo ? t.wo : t.team ? teamName(t.team) : t.markt ? 'Transfermarkt' : t.frei ? 'vereinslos' : 'anderer Verein';
    const kopf = (t, w) => `<div class="pkf-vp"><span class="pkf-vg">${gesicht(t.p)}</span><b>${esc(voll(t.p))}</b><small>${esc(t.p.pos || '')} · ${t.p.age || '?'} J. · ${esc(wer(t))}</small>${w.klar ? '' : '<span class="pkf-ung">ohne Scout-Bericht: nur die Stufe</span>'}</div>`;
    const potTxt = r => r ? (r.lo === r.hi ? String(r.lo) : r.lo + '–' + r.hi) : '?';
    const potMitte = r => r ? (r.lo + r.hi) / 2 : null, potB = (r, q) => r && q && potMitte(r) > potMitte(q);   // nur werten, wenn beide bekannt
    const st = w => w.klar ? w.ovr : w.stufe + 5;   // Stufe für Balken und Wertung ungefähr in der Mitte
    const zl = [zeile('Stärke', st(x), st(y), x.klar && y.klar ? true : null, null, [x.klar ? x.ovr : x.stufe + 'er', y.klar ? y.ovr : y.stufe + 'er'])]
      .concat(`<div class="pkf-vz"><span class="w${potB(x.pot, y.pot) ? ' b' : ''}">${potTxt(x.pot)}</span><div class="bar l"><i style="width:${Math.min(100, potMitte(x.pot) || 0)}%"></i></div><span class="n">Potenzial</span><div class="bar"><i style="width:${Math.min(100, potMitte(y.pot) || 0)}%"></i></div><span class="w${potB(y.pot, x.pot) ? ' b' : ''}">${potTxt(y.pot)}</span></div>`)
      .concat(x.det.map((d, i) => zeile(d[0], d[1], y.det[i] ? y.det[i][1] : null, true)))
      .concat(zeile('Alter', x.alter, y.alter, null), zeile('Gehalt / Woche', x.gehalt, y.gehalt, null, v => v == null ? '–' : geld(v)), KD ? [] : zeile('Marktwert', x.wert, y.wert, null, v => v == null ? '–' : geld(v)));   // Kickdraft ohne Marktwert
    box.innerHTML = `<div class="pkf-vk" role="dialog" aria-label="Spielervergleich">
      <button type="button" class="pkf-zu" data-pkf-v="zu" aria-label="Schließen">${ico('x')}</button>
      <h4><span class="pkf-tag">Vergleich</span>${esc(kurz(a.p))} gegen ${esc(kurz(b.p))}</h4>
      <div class="pkf-vkopf">${kopf(a, x)}<div class="pkf-vs">VS</div>${kopf(b, y)}</div>${zl.join('')}
      <div class="pkf-vfuss"><span>Grün = besser${a.p.pos === 'TW' || b.p.pos === 'TW' ? ' · Torhüter mit Torwartwerten' : ''}</span>
        <span><button type="button" class="pkf-k hell" data-pkf-v="tausch">${ico('arrows-left-right')}Seiten tauschen</button><button type="button" class="pkf-k" data-pkf-v="a">Profil ${esc(a.p.name)}</button><button type="button" class="pkf-k" data-pkf-v="b">Profil ${esc(b.p.name)}</button></span></div></div>`;
    box.addEventListener('click', ev => {
      if (ev.target === box) { box.remove(); return; }
      const k = ev.target.closest('[data-pkf-v]'); if (!k) return;
      const v = k.getAttribute('data-pkf-v');
      if (v === 'zu') box.remove(); else if (v === 'tausch') vergleich(b, a); else { box.remove(); profil(v === 'a' ? a : b); }
    });
    document.body.appendChild(box);
  }
  function gesicht(p) {
    try {
      if (W.KSVerein && KSVerein.gesicht) return KSVerein.gesicht(p, istEigen(p) ? 'fcm' : undefined);
      if (W.DFLIdentitaet && DFLIdentitaet.gesichtSvg) return DFLIdentitaet.gesichtSvg(p, null);
    } catch (e) { /* ohne */ }
    return '';
  }

  // ── Suche (Strg+F) ──────────────────────────────────────────────────────────────────────────────────────────────
  const treffer = new Map();
  let IDX = null, idxZeit = 0;
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  function index() {
    if (IDX && Date.now() - idxZeit < 20000) return IDX;
    const sp = [], ver = [], seen = new Set();
    const add = (p, t) => { if (!p || !p.name || seen.has(p)) return; seen.add(p); sp.push(Object.assign({ p, s: norm(voll(p)) }, t)); };
    (SQUAD || []).forEach(p => add(p, { eigen: true, wo: 'dein Kader' }));
    (CLUB.youthProspects || []).forEach(p => add(p, { eigen: true, wo: 'deine Akademie' }));
    if (KD) {
      try {
        const L = DFLSpiel.liga(), eig = DFLSpiel.eigeneDflId();
        L.teams.forEach(t => { if (t.id === eig) return; (t.roster || []).concat(t.practice_squad || []).forEach(p => add(p, { eigen: false, team: t, wo: teamName(t) })); });
        (L.freie || []).forEach(p => add(p, { eigen: false, frei: true, wo: 'vereinslos' }));
        [L.draft, L.draftNaechste].forEach(j => j && (j.talente || []).forEach(p => add(p, { eigen: false, wo: 'Draft ' + j.jahr })));
      } catch (e) { /* ohne Welt */ }
    } else {
      const namen = {};
      try { allGroups(LEAGUE).forEach(g => g.group.teams.forEach(t => { namen[t.dataId || String(t.id).replace(/^club_/, '')] = t.name; })); } catch (e) { /* ohne */ }
      const sq = CLUB.npcSquads || {};
      Object.keys(sq).forEach(k => { if (k === CLUB.dataClubId) return; (sq[k] || []).forEach(p => add(p, { eigen: false, wo: namen[k] || 'anderer Verein' })); });
      if (typeof MARKET !== 'undefined' && MARKET) (MARKET.players || []).forEach(p => add(p, { eigen: false, markt: true, wo: 'Transfermarkt' + (p.club ? ' · ' + p.club : '') }));
    }
    try { allGroups(LEAGUE).forEach(g => g.group.teams.forEach(t => { if (t.id !== 'fcm') ver.push({ t, s: norm(t.name), liga: g.name || '' }); })); } catch (e) { /* ohne */ }
    IDX = { sp, ver }; idxZeit = Date.now();
    return IDX;
  }
  let S = null;
  function suche() {
    if (!spiel()) return;
    menuZu();
    let o = $('pkf-suche');
    if (o) { o.querySelector('input').select(); return; }
    o = document.createElement('div'); o.id = 'pkf-suche';
    o.innerHTML = `<div class="pkf-sk" role="dialog" aria-label="Suche"><div class="pkf-inp">${ico('search')}<input type="text" placeholder="Spieler, Verein oder Bereich …" spellcheck="false" autocomplete="off"><kbd>Esc</kbd></div>
      <div class="pkf-erg"></div><div class="pkf-sfuss"><span><kbd>↑</kbd> <kbd>↓</kbd> wählen</span><span><kbd>Enter</kbd> öffnen</span><span><kbd>Strg</kbd>+<kbd>Enter</kbd> vergleichen</span><span>Rechtsklick: Menü</span></div></div>`;
    document.body.appendChild(o);
    const inp = o.querySelector('input');
    S = { o, inp, wahl: 0, liste: [] };
    inp.addEventListener('input', () => { S.wahl = 0; sucheZeichnen(); });
    inp.addEventListener('keydown', sucheTaste);
    o.addEventListener('click', ev => { if (ev.target === o) { sucheZu(); return; } const z = ev.target.closest('[data-pkf-i]'); if (z) { S.wahl = +z.getAttribute('data-pkf-i'); sucheOeffnen(ev.ctrlKey); } });
    if (V) inp.placeholder = `Zweiten Spieler für den Vergleich mit ${kurz(V.p)} suchen …`;
    sucheZeichnen(); setTimeout(() => inp.focus(), 0);
  }
  function sucheZu() { if (S) { S.o.remove(); S = null; } }
  function sucheZeichnen() {
    const q = norm(S.inp.value.trim()), I = index(), box = S.o.querySelector('.pkf-erg');
    treffer.clear();
    if (q.length < 2) { box.innerHTML = '<p class="pkf-leer">Mindestens zwei Buchstaben – z. B. ein Nachname, ein Verein oder „Finanzen“.</p>'; S.liste = []; return; }
    const sp = I.sp.filter(x => x.s.includes(q)).sort((a, b) => (b.eigen - a.eigen) || (a.s.indexOf(q) - b.s.indexOf(q)) || ((b.p.ovr || 0) - (a.p.ovr || 0))).slice(0, 8);
    const ver = I.ver.filter(x => x.s.includes(q)).slice(0, 4);
    const ber = [...document.querySelectorAll('.app > .appnav .appnav-btn')].filter(b => b.offsetParent !== null && norm(b.textContent).includes(q)).slice(0, 3);
    S.liste = sp.map(x => ({ art: 'sp', x })).concat(ver.map(x => ({ art: 'ver', x })), ber.map(b => ({ art: 'ber', b })));
    if (S.wahl >= S.liste.length) S.wahl = 0;
    let i = 0;
    const z = (inhalt, art) => `<div class="pkf-t${i === S.wahl ? ' an' : ''}" data-pkf-i="${i}"${art ? ` data-pkf-p="${art}"` : ''}>${inhalt}</div>`;
    const teile = [];
    if (sp.length) teile.push('<div class="pkf-gr">Spieler</div>' + sp.map(x => { const k = 's' + i; treffer.set(k, x); const h = z(`<span class="pkf-tg">${gesicht(x.p)}</span><div><b>${esc(voll(x.p))}</b> <span class="pkf-pos">${esc(x.p.pos || '')}</span><small>${x.p.age || '?'} J. · ${esc(x.wo)}</small></div><span class="pkf-r">${x.eigen || scoutKlar(x) ? (x.p.ovr || '') : Math.floor((x.p.ovr || 0) / 10) * 10 + 'er'}</span>`, k); i++; return h; }).join(''));
    if (ver.length) teile.push('<div class="pkf-gr">Vereine</div>' + ver.map(x => { const h = z(`<span class="pkf-tw">${wappen(x.t)}</span><div><b>${esc(x.t.name)}</b><small>${esc(x.liga)}</small></div>`); i++; return h; }).join(''));
    if (ber.length) teile.push('<div class="pkf-gr">Bereiche</div>' + ber.map(b => { const h = z(`<span class="pkf-tw">${ico('layout-sidebar')}</span><div><b>${esc(b.textContent.trim().replace(/\s*\d+$/, ''))}</b></div>`); i++; return h; }).join(''));
    box.innerHTML = teile.join('') || '<p class="pkf-leer">Nichts gefunden.</p>';
    const an_ = box.querySelector('.pkf-t.an'); if (an_ && an_.scrollIntoView) an_.scrollIntoView({ block: 'nearest' });
  }
  function wappen(t) {
    try { if (W.KSVerein && KSVerein.wappen) return KSVerein.wappen(t.dataId || t.id, { groesse: 32 }); } catch (e) { /* weiter */ }
    try { if (W.DFLSpiel && W.DFLIdentitaet && DFLIdentitaet.wappenSvg) { const f = DFLSpiel.franchise(String(t.id).replace(/^dfl_/, '')); if (f) return DFLIdentitaet.wappenSvg(f); } } catch (e) { /* weiter */ }
    return ico('shield');
  }
  function sucheTaste(ev) {
    if (ev.key === 'Escape') { ev.preventDefault(); sucheZu(); return; }
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') { ev.preventDefault(); const n = S.liste.length; if (n) { S.wahl = (S.wahl + (ev.key === 'ArrowDown' ? 1 : n - 1)) % n; sucheZeichnen(); } return; }
    if (ev.key === 'Enter') { ev.preventDefault(); sucheOeffnen(ev.ctrlKey); }
  }
  function sucheOeffnen(vergl) {
    const e = S && S.liste[S.wahl]; if (!e) return;
    if (e.art === 'sp') {
      const t = { p: e.x.p, eigen: e.x.eigen, team: e.x.team, markt: e.x.markt, frei: e.x.frei, wo: e.x.wo };
      sucheZu();
      if (V && V.p !== t.p) vergleich(V, t); else if (vergl) vergleichStarten(t); else profil(t);
    } else if (e.art === 'ver') { sucheZu(); try { showTeamProfile(e.x.t.id); } catch (x) { console.warn('[Kickstil-PC-Komfort] Verein', x); } }
    else if (e.art === 'ber') { sucheZu(); e.b.click(); }
  }

  // ── Einstellungen (Strg+,) ──────────────────────────────────────────────────────────────────────────────────────
  const F = () => W.FcmPc && W.FcmPc.fenster;
  async function einstellungen() {
    menuZu(); sucheZu();
    // Nutzer 2026-10-22: „der Hintergrund flackerte“ – früher wurde das Fenster bei jedem Klick entfernt und (nach dem await) neu
    // angehängt. Jetzt bleibt es stehen, nur der Inhalt wird getauscht.
    const T = W.DFLTextspiel, D = W.DFLDesign, SIM = W.KSSimulieren;
    const fz = F() ? await F().zustand().catch(() => null) : null;
    const seg = (name, wahl, opt) => `<span class="pkf-seg" data-pkf-e="${name}">${opt.map(([w, t]) => `<button type="button" data-w="${w}" class="${String(w) === String(wahl) ? 'an' : ''}">${esc(t)}</button>`).join('')}</span>`;
    const sch = (name, on, text) => `<button type="button" class="pkf-sch${on ? ' an' : ''}" data-pkf-e="${name}" role="switch" aria-checked="${!!on}" aria-label="${esc(text || name)}"></button>`;
    const z = (t, rechts) => `<div class="pkf-ez"><span>${t}</span>${rechts}</div>`;
    const teile = ['<div class="pkf-ab">Spiel</div>'];
    if (T && T.einstellung) teile.push(z('Spiel als Text (Live-Ticker)', seg('ticker', T.einstellung(), (T.WAHLEN || []).map(x => [x.w, x.titel]))));
    if (T && T.setzeTempo) teile.push(z('Ticker-Tempo', seg('tempo', T.tempo(), [[1, 'Normal'], [4, 'Schnell']])));
    if (SIM && SIM.einstellungen) teile.push(z('„Simulieren bis …“ hält bei Angeboten', sch('simAngebot', SIM.einstellungen().angebot, '„Simulieren bis …“ hält bei Angeboten')));
    teile.push(z('Automatisch speichern', '<span class="pkf-leise">jede Woche · Sicherungen der letzten 3 Wochen</span>'));
    teile.push('<div class="pkf-ab">Anzeige</div>');
    if (fz) {
      teile.push(z('Zoom', seg('zoom', fz.zoom, [[0.9, '90 %'], [1, '100 %'], [1.1, '110 %'], [1.25, '125 %']])));
      teile.push(z('Vollbild <kbd>F11</kbd>', sch('vollbild', fz.vollbild, 'Vollbild')));
    }
    if (D && D.stilWahl) teile.push(z('Tag/Nacht', seg('stil', D.stilWahl(), [['auto', 'Automatisch'], ['tag', 'Tag'], ['nacht', 'Nacht']])));
    teile.push('<div class="pkf-ab">Mehr</div>');
    if (W.KSPcSicherheit) teile.push(z('Sicherungen · Problem melden', `<span><button type="button" class="pkf-k hell" data-pkf-a="sicher">Sicherungen</button> <button type="button" class="pkf-k hell" data-pkf-a="melden">Problem melden</button></span>`));
    if (W.KSStream) teile.push(z('Streamer-Modus', '<button type="button" class="pkf-k hell" data-pkf-a="stream">Stream-Blatt</button>'));
    teile.push(z('Tastenkürzel', '<button type="button" class="pkf-k hell" data-pkf-a="tasten">Übersicht <kbd>?</kbd></button>'));
    let o = $('pkf-einst'); const neu = !o;
    if (neu) { o = document.createElement('div'); o.id = 'pkf-einst'; }
    o.innerHTML = `<div class="pkf-ek" role="dialog" aria-label="Einstellungen"><button type="button" class="pkf-zu" data-pkf-a="zu" aria-label="Schließen">${ico('x')}</button>
      <h4>${ico('settings')} Einstellungen</h4>${teile.join('')}</div>`;
    if (neu) o.addEventListener('click', async ev => {
      if (ev.target === o) { o.remove(); return; }
      const a = ev.target.closest('[data-pkf-a]');
      if (a) {
        const k = a.getAttribute('data-pkf-a'); o.remove();
        if (k === 'sicher') KSPcSicherheit.sicherungen(); else if (k === 'melden') KSPcSicherheit.melden(); else if (k === 'stream') KSStream.panel(true); else if (k === 'tasten') tasten();
        return;
      }
      const sg = ev.target.closest('.pkf-seg [data-w]');
      if (sg) {
        const name = sg.parentNode.getAttribute('data-pkf-e'), w = sg.getAttribute('data-w');
        if (name === 'ticker') T.setzeEinstellung(w); else if (name === 'tempo') T.setzeTempo(+w);
        else if (name === 'stil') D.stilSetzen(w); else if (name === 'zoom') await F().zoom(+w);
        einstellungen(); return;
      }
      const s = ev.target.closest('.pkf-sch');
      if (s) {
        const name = s.getAttribute('data-pkf-e'), neu = !s.classList.contains('an');
        if (name === 'simAngebot') { const e = SIM.einstellungen(); e.angebot = neu; try { localStorage.setItem('ks-sim', JSON.stringify(e)); } catch (x) { /* ohne */ } }
        else if (name === 'vollbild') await F().vollbild(neu);
        einstellungen();
      }
    });
    if (neu) document.body.appendChild(o);
  }
  function navKnopf() {
    const nav = document.querySelector('.app > .appnav');
    if (!nav || nav.querySelector('[data-pkf-nav]') || !nav.querySelector('.pcu-extra')) return;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'appnav-btn pcu-extra'; b.setAttribute('data-pkf-nav', '1');
    b.setAttribute('aria-keyshortcuts', 'Control+Comma');
    b.innerHTML = `${ico('adjustments')}Einstellungen<kbd class="pcu-taste" aria-hidden="true">Strg ,</kbd>`;
    b.addEventListener('click', einstellungen);
    const sp = nav.querySelector('[data-pcu="speichern"]'); if (sp) sp.before(b); else nav.appendChild(b);
  }

  // ── Tastenübersicht (?) ─────────────────────────────────────────────────────────────────────────────────────────
  function tasten() {
    let o = $('pkf-tasten'); if (o) { o.remove(); return; }
    o = document.createElement('div'); o.id = 'pkf-tasten';
    const k = (...t) => t.map(x => `<kbd>${x}</kbd>`).join('+');
    const l = [['Bereiche wechseln', k('1') + '–' + k('0')], ['Woche weiter (Übersicht)', k('Leertaste')], ['Suchen', k('Strg', 'F')], ['Speichern', k('Strg', 'S')],
      ['Einstellungen', k('Strg', ',')], ['Blatt schließen / zurück', k('Esc')], ['Spielermenü', 'Rechtsklick'], ['Im Menü: Vergleichen / Beobachten', k('V') + ' ' + k('B')],
      ['Im Spiel: Ausrichtung', k('1') + '–' + k('5')], ['Im Spiel: Weiter / Pause', k('Leertaste')], ['Vollbild', k('F11')], ['Zoom', k('Strg', '+') + ' / ' + k('Strg', '−')], ['Diese Übersicht', k('?')]];
    o.innerHTML = `<div class="pkf-tk" role="dialog" aria-label="Tastenkürzel"><button type="button" class="pkf-zu" aria-label="Schließen">${ico('x')}</button>
      <h4>${ico('keyboard')} Tastenkürzel</h4><div class="pkf-tg2">${l.map(([a, b]) => `<div><span>${esc(a)}</span><span>${b}</span></div>`).join('')}</div></div>`;
    o.addEventListener('click', ev => { if (ev.target === o || ev.target.closest('.pkf-zu')) o.remove(); });
    document.body.appendChild(o);
  }

  // ── Kleinkram ───────────────────────────────────────────────────────────────────────────────────────────────────
  function toast(text) {
    let t = $('pkf-toast'); if (!t) { t = document.createElement('div'); t.id = 'pkf-toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = text; t.hidden = false; clearTimeout(toast.zu); toast.zu = setTimeout(() => { t.hidden = true; }, 2200);
  }
  function rechtsklick(ev) {
    if (!an() || ev.shiftKey) return;   // Umschalt+Rechtsklick = normales Menü des Systems
    const t = ausElement(ev.target); if (!t) return;
    ev.preventDefault();
    if (V && V.p !== t.p) { menuZu(); vergleich(V, t); return; }
    menu(t, ev.clientX, ev.clientY);
  }
  function taste(ev) {
    if (!an()) return;
    if (M) { menuTaste(ev); return; }
    if (ev.ctrlKey && !ev.altKey && (ev.key === 'f' || ev.key === 'F')) { if (spiel()) { ev.preventDefault(); suche(); } return; }
    if (ev.ctrlKey && ev.key === ',') { ev.preventDefault(); einstellungen(); return; }
    if (ev.key === 'Escape') {
      for (const id of ['pkf-tasten', 'pkf-einst', 'pkf-vergleich']) { const o = $(id); if (o) { o.remove(); ev.preventDefault(); ev.stopPropagation(); return; } }
      if (V) { V = null; const h = $('pkf-hinweis'); if (h) h.remove(); }
      return;
    }
    if (ev.key === '?' && frei() && !ev.ctrlKey) { ev.preventDefault(); tasten(); }
  }

  const STIL = `
/* Mindestschrift am PC (Fehleranalyse G2): Tabellenköpfe, Positions-Abzeichen und Hinweise lagen bei 8–9 px */
body.pcu-an th, body.pcu-an .pos-badge, body.pcu-an .pos-badge-sm, body.pcu-an .tk-pos, body.pcu-an .fc-tier-tag, body.pcu-an .fin-bal-label,
body.pcu-an .kpm, body.pcu-an .dfl-abz, body.pcu-an .hbadge, body.pcu-an .abadge { font-size: 11px; }
/* Fenster im Handyformat am PC breiter (Nutzer 2026-10-22: „Alle breiter“, Liste analyse/handyformat_kickdraft.md) – beide Spiele,
   lange Listen in Spalten statt gestreckt; Handy unverändert */
body.pcu-an .tut-blase { max-width: 720px; font-size: 15px; }
body.pcu-an .tut-blatt { max-width: 760px; }
body.pcu-an .vt-box { max-width: 1040px; }
body.pcu-an .vt-box .vt-liste { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
body.pcu-an .ksdp-raster { max-width: 1000px; gap: 14px 12px; }
body.pcu-an .ksdp-zelle, body.pcu-an .ksdp-z-karte { width: 165px; height: 231px; }
body.pcu-an .ksdp-z-karte .pk { transform: scale(.75); }
body.pcu-an .ksdp-gesamt { width: min(92vw, 640px); }
body.pcu-an #dw-moment .dw-box { width: min(560px, 100%); }
body.pcu-an #pm-dialog { max-width: 900px; width: min(900px, 94vw); }
body.pcu-an #pm-dialog #pm-body { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 18px; align-items: start; }
body.pcu-an .spo-blatt { max-width: 960px; }
body.pcu-an .spo-blatt .spo-liste { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
body.pcu-an .sw-dialog { max-width: 860px; }
body.pcu-an .dfl-fenster { max-width: 620px; }
body.pcu-an .dfl-frage-box { max-width: 560px; }
body.pcu-an .po-meister-dialog { max-width: 640px; }
body.pcu-an .vw-box { max-width: 900px; }
body.pcu-an .exp-gameover-box { max-width: 640px; }
body.pcu-an .ma-k { max-width: 900px; }
body.pcu-an .pb-dialog { max-width: 740px; }   /* Pro Bowl (Kickdraft, neu 2026-10-22): beide Elfen auf einem Feld, am PC größer (× 1,22 Zoom der Startfenster ≈ 900 px) */
/* Startfenster (Stolperstein 7): am großen Bildschirm mitwachsen statt als schmale Handy-Spalte */
@media (min-width: 1400px) and (min-height: 820px) {
  body.pcu-an #onboarding-overlay > div, body.pcu-an #kstr-ed .kstr-in, body.pcu-an #intro-overlay .intro-box, body.pcu-an #kstr-gruss .kgr-box,
  body.pcu-an .st-box, body.pcu-an .exp-overlay > .exp-dialog { zoom: 1.22; }
  body.pcu-an .exp-overlay > .exp-dialog { max-height: 73vh; }
}
@media (min-width: 1800px) and (min-height: 1000px) {
  body.pcu-an #onboarding-overlay > div, body.pcu-an #kstr-ed .kstr-in, body.pcu-an #intro-overlay .intro-box, body.pcu-an #kstr-gruss .kgr-box,
  body.pcu-an .st-box, body.pcu-an .exp-overlay > .exp-dialog { zoom: 1.4; }
  body.pcu-an .exp-overlay > .exp-dialog { max-height: 64vh; }
}
#pkf-menu { position: fixed; z-index: 9800; min-width: 250px; background: var(--bg2, #fffaf0); color: var(--text); border: 2px solid var(--k-rahmen, #8b5a2b); border-radius: 14px; padding: 6px;
  box-shadow: 0 4px 0 #5e3b17, 0 14px 30px rgba(0,0,0,.3); font: 600 13.5px system-ui; }
.pkf-mk { padding: 6px 10px 8px; font: 700 14px var(--font-titel, system-ui); border-bottom: 1px solid var(--border); margin-bottom: 4px; }
.pkf-mk small { display: block; font: 600 11.5px system-ui; color: var(--text3); }
#pkf-menu button { display: flex; align-items: center; gap: 10px; width: 100%; border: 0; background: transparent; color: inherit; padding: 8px 10px; border-radius: 9px; cursor: pointer; text-align: left; font: inherit; }
#pkf-menu button.an { background: #2c7cb5; color: #fff; } #pkf-menu button .ti { width: 18px; text-align: center; font-size: 16px; }
#pkf-menu button span { flex: 1; } #pkf-menu kbd, #pkf-suche kbd, #pkf-tasten kbd, #pkf-hinweis kbd, #pkf-einst kbd { font: 700 11px ui-monospace, monospace; background: var(--bg3, #efe2c8);
  border: 1px solid var(--border, #d9c29a); border-bottom-width: 2px; border-radius: 5px; padding: 1px 6px; color: var(--text); }
#pkf-menu button.an kbd { background: #1d5a86; color: #fff; border-color: #1d5a86; }
.pkf-sep { height: 1px; background: var(--border); margin: 4px 6px; }
#pkf-hinweis { position: fixed; left: 50%; top: 14px; transform: translateX(-50%); z-index: 9750; display: flex; align-items: center; gap: 10px; background: #2c7cb5; color: #fff;
  border-radius: 12px; padding: 8px 10px 8px 14px; font: 600 13.5px system-ui; box-shadow: 0 6px 18px rgba(0,0,0,.3); }
#pkf-hinweis button { border: 0; background: transparent; color: #fff; cursor: pointer; font-size: 16px; }
#pkf-vergleich, #pkf-suche, #pkf-einst, #pkf-tasten { position: fixed; inset: 0; z-index: 9760; background: rgba(15,12,8,.42); display: flex; justify-content: center; align-items: flex-start; padding-top: 7vh; }
.pkf-vk, .pkf-sk, .pkf-ek, .pkf-tk { position: relative; background: var(--bg2, #fffaf0); color: var(--text); border: 3px solid var(--k-rahmen, #8b5a2b); border-radius: 18px;
  box-shadow: 0 6px 0 #5e3b17, 0 16px 34px rgba(0,0,0,.35); padding: 16px 18px; max-height: 84vh; overflow-y: auto; }
.pkf-vk { width: min(720px, 94vw); } .pkf-sk { width: min(660px, 94vw); padding: 12px; } .pkf-ek { width: min(580px, 94vw); } .pkf-tk { width: min(660px, 94vw); }
.pkf-vk h4, .pkf-ek h4, .pkf-tk h4 { margin: 0 0 10px; font: 700 18px var(--font-titel, system-ui); display: flex; gap: 8px; align-items: center; }
.pkf-zu { position: absolute; right: 10px; top: 10px; border: 0; background: transparent; color: var(--text3); font-size: 18px; cursor: pointer; }
.pkf-tag { font: 800 10.5px/1 system-ui; letter-spacing: .06em; text-transform: uppercase; background: #2c7cb5; color: #fff; border-radius: 6px; padding: 4px 7px; }
.pkf-vkopf { display: grid; grid-template-columns: 1fr 60px 1fr; align-items: center; text-align: center; margin-bottom: 8px; }
.pkf-vp { display: flex; flex-direction: column; align-items: center; gap: 3px; } .pkf-vp b { font: 700 17px var(--font-titel, system-ui); } .pkf-vp small { color: var(--text3); font-size: 12px; }
.pkf-vg { width: 54px; height: 54px; border-radius: 50%; overflow: hidden; background: var(--bg3); } .pkf-vg svg { width: 54px; height: 54px; display: block; }
.pkf-ung { font: 700 11px system-ui; background: var(--bg3); color: var(--text3); border-radius: 6px; padding: 2px 6px; }
.pkf-vs { font: 800 16px var(--font-titel, system-ui); color: #2c7cb5; }
.pkf-vz { display: grid; grid-template-columns: 74px 1fr 128px 1fr 74px; align-items: center; gap: 8px; padding: 4px 0; font-size: 13.5px; }
.pkf-vz .w { font: 700 15px var(--font-titel, system-ui); text-align: center; } .pkf-vz .w.b { color: #1f9d55; }
.pkf-vz .n { text-align: center; font-weight: 700; font-size: 12.5px; color: var(--text3); }
.pkf-vz .bar { height: 10px; background: var(--bg3, #efe2c8); border-radius: 5px; overflow: hidden; display: flex; } .pkf-vz .bar.l { justify-content: flex-end; }
.pkf-vz .bar i { display: block; height: 100%; background: #9fb7c9; } .pkf-vz .bar i.b { background: #25c065; }
.pkf-vfuss { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-top: 10px; font-size: 12.5px; color: var(--text3); flex-wrap: wrap; }
.pkf-k { font: 700 13px var(--font-titel, system-ui); border: 0; border-radius: 10px; padding: 7px 12px; background: #2c7cb5; color: #fff; box-shadow: 0 3px 0 #1d5a86; cursor: pointer; margin-left: 6px; display: inline-flex; gap: 6px; align-items: center; }
.pkf-k.hell { background: var(--bg3, #efe2c8); color: var(--text); box-shadow: 0 3px 0 #c9b28a; }
.pkf-inp { display: flex; align-items: center; gap: 10px; border: 2px solid #2c7cb5; border-radius: 12px; padding: 8px 12px; background: var(--bg, #fff); }
.pkf-inp input { flex: 1; border: 0; outline: 0; background: transparent; color: inherit; font: 600 17px system-ui; }
.pkf-erg { max-height: 56vh; overflow-y: auto; margin-top: 4px; }
.pkf-gr { font: 800 11px system-ui; letter-spacing: .06em; text-transform: uppercase; color: var(--text3); margin: 12px 6px 4px; }
.pkf-t { display: flex; align-items: center; gap: 10px; padding: 6px 8px; border-radius: 10px; font-size: 14px; cursor: pointer; }
.pkf-t.an, .pkf-t:hover { background: #2c7cb5; color: #fff; } .pkf-t.an small, .pkf-t:hover small { color: #dbe9f5; }
.pkf-t > div { flex: 1; min-width: 0; } .pkf-t small { display: block; color: var(--text3); font-size: 12px; }
.pkf-tg, .pkf-tw { width: 32px; height: 32px; border-radius: 50%; overflow: hidden; background: var(--bg3); flex: none; display: flex; align-items: center; justify-content: center; }
.pkf-tg svg, .pkf-tw svg { width: 32px; height: 32px; display: block; } .pkf-tw { border-radius: 8px; background: transparent; }
.pkf-pos { font: 800 10px system-ui; background: #25c065; color: #fff; border-radius: 5px; padding: 1px 5px; }
.pkf-r { font: 700 15px var(--font-titel, system-ui); }
.pkf-leer { color: var(--text3); font-size: 13px; padding: 12px 8px; margin: 0; }
.pkf-sfuss { display: flex; gap: 14px; flex-wrap: wrap; font-size: 12px; color: var(--text3); margin-top: 10px; padding: 0 4px; }
.pkf-ab { font: 800 11px system-ui; letter-spacing: .06em; text-transform: uppercase; color: var(--text3); margin: 14px 0 6px; }
.pkf-ez { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 7px 0; border-bottom: 1px dashed var(--border); font-size: 14px; }
.pkf-seg { display: inline-flex; background: var(--bg3, #efe2c8); border-radius: 9px; padding: 2px; }
.pkf-seg button { border: 0; background: transparent; color: inherit; font: 700 12px system-ui; padding: 5px 10px; border-radius: 7px; cursor: pointer; } .pkf-seg button.an { background: #2c7cb5; color: #fff; }
.pkf-sch { width: 40px; height: 23px; border-radius: 12px; border: 0; background: #c9b28a; position: relative; cursor: pointer; flex: none; }
.pkf-sch::after { content: ''; position: absolute; left: 3px; top: 3px; width: 17px; height: 17px; border-radius: 50%; background: #fff; transition: left .15s; }
.pkf-sch.an { background: #25c065; } .pkf-sch.an::after { left: 20px; }
.pkf-leise { color: var(--text3); font-size: 12.5px; }
.pkf-tg2 { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; font-size: 13.5px; }
.pkf-tg2 > div { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 4px 0; border-bottom: 1px dashed var(--border); }
#pkf-toast { position: fixed; left: 50%; bottom: 26px; transform: translateX(-50%); z-index: 9790; background: #2c7cb5; color: #fff; border-radius: 10px; padding: 8px 14px;
  font: 600 13.5px system-ui; box-shadow: 0 6px 18px rgba(0,0,0,.3); }
`;
  function start() {
    if ($('pkf-css')) return;
    const st = document.createElement('style'); st.id = 'pkf-css'; st.textContent = STIL; document.head.appendChild(st);
    // Nutzer 2026-10-22: Texte lassen sich nicht mehr mit der Maus markieren („wirkt billig, das geht bei keinem guten Spiel“) –
    // nur in der PC-App (oder pcs-test), Eingabefelder bleiben markierbar; Handy und Browser unverändert
    let pcApp = !!W.FcmPc; try { pcApp = pcApp || localStorage.getItem('pcs-test') === 'an'; } catch (e) { /* ohne Speicher */ }
    if (pcApp) {
      const sel = document.createElement('style'); sel.id = 'pkf-auswahl';
      sel.textContent = `html, body { -webkit-user-select: none; user-select: none; }
input, textarea, select, [contenteditable="true"], [contenteditable="true"] * { -webkit-user-select: text; user-select: text; }
img, svg, a { -webkit-user-drag: none; }
/* Scrollleisten (Nutzer 2026-10-22: „verschwinden oder ins Design übergehen“): schmal, ohne Schiene, Daumen in Holzfarbe */
::-webkit-scrollbar { width: 10px; height: 10px; background: transparent; }
::-webkit-scrollbar-track, ::-webkit-scrollbar-corner { background: transparent; }
::-webkit-scrollbar-thumb { background: rgb(139 90 43 / .32); border-radius: 10px; border: 3px solid transparent; background-clip: padding-box; }
::-webkit-scrollbar-thumb:hover { background-color: rgb(139 90 43 / .55); }
::-webkit-scrollbar-button { display: none; height: 0; width: 0; }`;
      document.head.appendChild(sel);
    }
    document.addEventListener('contextmenu', rechtsklick);
    document.addEventListener('keydown', taste, true);
    document.addEventListener('mousedown', ev => { if (M && !M.m.contains(ev.target)) menuZu(); }, true);
    W.addEventListener('blur', menuZu); W.addEventListener('resize', menuZu);
    setInterval(navKnopf, 1000); navKnopf();
    console.log('[Kickstil-PC-Komfort v1] aktiv — Rechtsklick-Menü, Spielervergleich, Suche (Strg+F), Einstellungen (Strg+,), Tastenübersicht (?) (nur PC)');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  W.KSPcKomfort = { suche, einstellungen, tasten, vergleich, ausElement, menu, index: () => index() };
})();
