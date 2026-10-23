/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · SCOUTING  ·  v1   (Schritt C, Nutzer 2026-10-15: „das Scouting mag ich auch in Kickdraft richtig gerne, das
   heißt das können wir auch übernehmen“) – nach Kickdraft dfl_scouting_patch.js + dfl_chefscout_patch.js
   ─────────────────────────────────────────────────────────────────────────
   Eine Scouting-Abteilung für alle fremden Spieler (Liga-Kader, Transfermarkt, Akademie-Talente):
     · ÖFFENTLICH nur die Stufe (Bronze/Silber/Gold/Elite) – genau erst mit Bericht (Stärke, Potenzial-Spanne, Chefscout-Note).
     · BERICHTE JE WOCHE = Scouting-Stufe (Vereinsgelände). Zuerst „Ansehen“-Aufträge (1 Woche), der Rest geht automatisch an
       die FOKUS-Positionen (bis zu 2), die interessantesten zuerst. Ein Bericht gilt 52 Wochen.
     · CHEFSCOUT-NOTE A+ … F: was der Spieler gegenüber deiner Elf bringt (jetzt + Potenzial der Jungen − Alter), wie Kickdraft
       (ligaIndex). Sterne des Chefscouts aus der Scouting-Stufe (1–5); je weniger Sterne, desto öfter liegt er eine Note daneben.
     · STEAL: Note mindestens A− und deutlich besser als sein Verein (Kandidat für „Aufstieg der Besten“, wechselwillig).
     · Ein Bericht gilt überall: Vereinsblatt (gleiche Schlüssel dataId:Name), Transfermarkt (genaue Stärke statt Schätzung),
       Beobachtung (beobachtungsFortschritt = 1, Eigenschaften werden sichtbar). Vereins-Scouting und Länder-Scouting bleiben.
   UI: Abschnitt „Scouting-Abteilung“ im Scout-Reiter (nach #scout-banner): Bereiche Liga · Markt · Talente, Fokus-Chips,
   Liste mit Stufe/Note/Ansehen; Antippen öffnet das Vereinsblatt des Vereins.
   Zustand CLUB.welt.ksScout (Weltzustand, Karrierestart leert ihn). API: KSScouting.sicht(p) · .hatBericht(p) · .note(p) ·
   .ansehen(p) · .woche() · .zeichne() · .CFG
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const CFG = { jeStufe: 1, gueltig: 52, fokusMax: 2, liste: 40,
    fehler: [0.45, 0.33, 0.24, 0.15, 0.08, 0.03],     // Note eine Stufe daneben, Index = Sterne
    stealUeber: 3 };                                   // Steal: so viel über dem Niveau seines Vereins
  const NOTEN = ['A+', 'A', 'A−', 'B+', 'B', 'B−', 'C+', 'C', 'C−', 'D', 'F'];
  const LIGA_GRENZEN = [6, 4, 2.5, 1, -0.5, -2, -3.5, -5, -6.5, -9];
  const STUFEN = [{ ab: 90, key: 'elite', name: 'Elite' }, { ab: 80, key: 'gold', name: 'Gold' }, { ab: 70, key: 'silber', name: 'Silber' }, { ab: 0, key: 'bronze', name: 'Bronze' }];
  // Fokus-Gruppen wie Kickdraft (dfl_scouting_patch.js GRUPPEN, Positionen mit Seite 2026-10-18); Altbestand ohne Seite zählt mit
  const POS = ['TW', 'IV', 'LV/RV', 'ZDM', 'ZM', 'LM/RM', 'ZOM', 'LF/RF', 'ST'];
  const GRUPPE = { LV: 'LV/RV', RV: 'LV/RV', AV: 'LV/RV', LM: 'LM/RM', RM: 'LM/RM', AM: 'LM/RM', OM: 'ZOM', LF: 'LF/RF', RF: 'LF/RF', FL: 'LF/RF' };
  const gruppe = pos => GRUPPE[pos] || pos;
  const passtFokus = (p, fokus) => fokus.some(f => gruppe(p.pos) === f || (p.positions || []).some(x => gruppe(x) === f));
  const stufeVon = o => STUFEN.find(s => (o || 0) >= s.ab) || STUFEN[3];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hatSpiel = () => { try { return typeof CLUB !== 'undefined' && CLUB && typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.tiers; } catch (e) { return false; } };
  const posOvr = p => typeof computeOvrFromAreas === 'function' ? computeOvrFromAreas({ pos: p.pos, positions: p.positions || [p.pos], def: +p.def || 50, mid: +p.mid || 50, att: +p.att || 50 }) : (p.ovr || 50);
  function hash(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  const absWoche = () => (LEAGUE.season || 1) * 100 + (LEAGUE.week || 1);
  const scoutStufe = () => (CLUB.facilities && CLUB.facilities.scouting) || 1;
  // Sterne: der Chefscout aus dem Trainerteam (kickstil_trainerteam.js); ohne ihn aus der Scouting-Stufe
  const sterne = () => (window.KSTrainerteam && KSTrainerteam.sterne('scout')) || Math.max(1, Math.min(5, Math.ceil(scoutStufe() / 2)));
  const neuName = n => (window.KSVereinsnamen ? KSVereinsnamen.text(String(n || '')) : String(n || ''));

  function z() {
    if (!CLUB.welt) CLUB.welt = {};
    if (!CLUB.welt.ksScout) CLUB.welt.ksScout = { berichte: {}, auftraege: [], fokus: [], seg: 'liga', neu: [] };
    return CLUB.welt.ksScout;
  }
  // Schlüssel wie im Vereinsblatt (dataId:Vorname Name); Marktspieler ohne Verein über ihre Markt-Id
  const vereinVon = p => p._clubId || p.clubId || p.gekauftVon || null;
  const schluessel = p => p.key || (vereinVon(p) ? vereinVon(p) + ':' + (p.firstName || '') + ' ' + p.name : 'm:' + p.id);

  // ── Wissen ─────────────────────────────────────────────────────────────────
  let _beoOrig = null;
  function hatBericht(p) {
    if (!p || !hatSpiel()) return false;
    const k = schluessel(p), w = z().berichte[k];
    if (w && absWoche() - w <= CFG.gueltig + 50) return true;          // +50: Saisonwechsel springt um 100 statt 52
    try { const vb = CLUB.vereinsScout && CLUB.vereinsScout.berichte[k]; if (vb && absWoche() - vb.w <= CFG.gueltig + 50) return true; } catch (e) { /* ohne Vereinsblatt */ }
    try { if (_beoOrig && p.id && _beoOrig(p) >= 1) return true; } catch (e) { /* ohne Beobachtung */ }
    return false;
  }
  function eigeneElf() {
    try {
      const o = SQUAD.map(x => x.ovr || 0).sort((a, b) => b - a).slice(0, 11);
      return o.length ? o.reduce((a, b) => a + b, 0) / o.length : 65;
    } catch (e) { return 65; }
  }
  // Chefscout-Note (nur mit Bericht), fest je Spieler, Saison und Chefscout-Sterne
  function note(p) {
    if (!hatBericht(p)) return null;
    const o = posOvr(p), pot = Math.max(o, p.truePotential || o);
    const jung = p.age <= 21 ? 0.5 : p.age <= 23 ? 0.35 : p.age <= 25 ? 0.2 : 0;
    const d = o + (pot - o) * jung - Math.max(0, p.age - 30) * 1.2 - eigeneElf();
    let i = LIGA_GRENZEN.findIndex(g => d >= g); if (i < 0) i = NOTEN.length - 1;
    const st = sterne(), zk = schluessel(p) + '|' + LEAGUE.season + '|' + st;
    if ((hash(zk + '|f') / 4294967296) < CFG.fehler[st]) { const r = hash(zk + '|r') % 2 ? 1 : -1; i = i + r >= 0 && i + r < NOTEN.length ? i + r : i - r; }
    const verein = vereinVon(p), niv = verein ? vereinsNiveau(verein) : null;
    // Steal: zu gut für seinen Verein UND für dich erreichbar (ein Bayern-Star ist für einen Drittligisten kein Steal)
    const steal = i <= 2 && niv != null && o >= niv + CFG.stealUeber && o <= eigeneElf() + 12;
    return { note: NOTEN[i], i, steal, art: steal ? 'steal' : p.age <= 22 && pot - o >= 6 ? 'jung' : p.age >= 31 ? 'alt' : 'normal' };
  }
  const nivCache = { k: '', m: {} };
  function vereinsNiveau(id) {
    const k = absWoche(); if (nivCache.k !== k) { nivCache.k = k; nivCache.m = {}; }
    if (nivCache.m[id] != null) return nivCache.m[id];
    const kad = (CLUB.npcSquads && CLUB.npcSquads[id]) || null;
    if (!kad || kad.length < 11) return (nivCache.m[id] = null);
    const top = kad.map(posOvr).sort((a, b) => b - a).slice(0, 11);
    return (nivCache.m[id] = top.reduce((a, b) => a + b, 0) / top.length);
  }
  function sicht(p) {
    const o = posOvr(p), b = hatBericht(p);
    let pot = null;
    if (b) { try { pot = typeof potentialRange === 'function' ? potentialRange(Object.assign({ gamesPlayed: 30 }, p, { ovr: o }), scoutStufe()) : { lo: p.truePotential, hi: p.truePotential }; } catch (e) { pot = null; } }
    return { bericht: b, stufe: stufeVon(o), ovr: b ? o : null, pot, note: b ? note(p) : null };
  }
  const SAETZE = {
    steal: ['Der ist zu gut für seinen Verein – jetzt zuschlagen.', 'Ein Steal: Klasse über seinem Umfeld, und er will mehr.'],
    jung: ['Viel Luft nach oben, wenn er spielt.', 'Roh, aber das Potenzial ist echt.'],
    alt: ['Hilft sofort, aber nicht mehr lange.', 'Erfahrung ja – die Beine werden nicht jünger.'],
    gut: ['Würde deine Elf sofort besser machen.', 'Stammspieler-Material für uns.'],
    mittel: ['Solide Ergänzung für die Breite.', 'Kein Unterschiedsspieler, aber verlässlich.'],
    schwach: ['Bringt uns derzeit nicht weiter.', 'Für unser Niveau zu wenig.']
  };
  function satz(p, n) {
    if (!n) return '';
    const topf = n.art !== 'normal' ? SAETZE[n.art] : n.i <= 3 ? SAETZE.gut : n.i <= 6 ? SAETZE.mittel : SAETZE.schwach;
    return topf[hash(schluessel(p)) % topf.length];
  }

  // ── Kandidaten je Bereich ──────────────────────────────────────────────────
  function teamVon() {
    const m = {};
    try { allGroups(LEAGUE).forEach(g => g.group.teams.forEach(t => { const d = t.dataId || String(t.id).replace(/^club_/, ''); m[d] = { t, tier: g.tierKey }; })); } catch (e) { /* ohne Liga */ }
    return m;
  }
  function kandidaten(seg) {
    const out = [], eig = CLUB.dataClubId, tv = teamVon();
    if (seg === 'markt') {
      ((typeof MARKET !== 'undefined' && MARKET && MARKET.players) || []).forEach(p => out.push({ p, verein: p._clubId || null, vereinName: p.fromClub || 'vereinslos', markt: true }));
    } else if (seg === 'talente') {
      const A = (CLUB.welt && CLUB.welt.akademien) || {};
      Object.keys(A).forEach(d => (A[d].talente || []).forEach(p => out.push({ p, verein: d, vereinName: tv[d] ? tv[d].t.name : d, talent: true })));
    } else {
      const sq = CLUB.npcSquads || {};
      Object.keys(sq).forEach(d => { if (d === eig || !tv[d] || tv[d].tier === 'regionalliga') return; sq[d].forEach(p => out.push({ p, verein: d, vereinName: tv[d].t.name })); });
    }
    return out;
  }
  // Interesse für die Auto-Berichte: wer deine Elf verbessert UND für deinen Verein erreichbar ist (Ziel ≈ Elf + 4, nicht
  // Bayerns Stars für einen Drittligisten), Junge mit Potenzial etwas vorn, Ältere hinten
  const interesse = p => {
    const o = posOvr(p), pot = Math.max(o, p.truePotential || o), elf = eigeneElf();
    const wert = o + (pot - o) * (p.age <= 23 ? 0.5 : 0.15) - Math.max(0, p.age - 29) * 1.5;
    return -Math.abs(wert - (elf + 4)) + (o > elf + 12 ? -10 : 0);
  };

  // ── Woche: Aufträge, dann Fokus ────────────────────────────────────────────
  function berichtAnlegen(p, liste) { const k = schluessel(p); if (z().berichte[k] && absWoche() - z().berichte[k] < CFG.gueltig) return false; z().berichte[k] = absWoche(); liste.push(p); return true; }
  function woche() {
    if (!hatSpiel()) return [];
    const S = z(), kap = scoutStufe() * CFG.jeStufe, neu = [];
    const alle = kandidaten('liga').concat(kandidaten('markt'), kandidaten('talente'));
    const nachKey = new Map(alle.map(x => [schluessel(x.p), x.p]));
    while (S.auftraege.length && neu.length < kap) { const p = nachKey.get(S.auftraege.shift()); if (p) berichtAnlegen(p, neu); }
    if (neu.length < kap && S.fokus.length) {
      const elf = eigeneElf();
      const pool = alle.map(x => x.p).filter(p => !hatBericht(p) && passtFokus(p, S.fokus) && interesse(p) >= -8)
        .sort((a, b) => interesse(b) - interesse(a));
      for (const p of pool) { if (neu.length >= kap) break; berichtAnlegen(p, neu); }
    }
    S.neu = neu.map(schluessel).concat(S.neu || []).slice(0, 30);
    if (neu.length && typeof addNews === 'function') {
      const top = neu.map(p => ({ p, n: note(p) })).sort((a, b) => (a.n ? a.n.i : 9) - (b.n ? b.n.i : 9)).slice(0, 3)
        .map(x => `${(x.p.firstName ? x.p.firstName + ' ' : '') + x.p.name} (${x.p.pos}) – Note ${x.n ? x.n.note : '?'}${x.n && x.n.steal ? ' · Steal' : ''}`);
      addNews('club', `📋 ${neu.length} neue${neu.length === 1 ? 'r' : ''} Scout-Bericht${neu.length === 1 ? '' : 'e'}`, 'Der Chefscout empfiehlt:\n• ' + top.join('\n• '));
    }
    return neu;
  }
  function ansehen(key) {
    const S = z();
    if (S.auftraege.indexOf(key) < 0) S.auftraege.push(key);
    try { if (typeof saveGameState === 'function') saveGameState(); } catch (e) { /* später */ }
    zeichne();
  }

  // ── Abschnitt im Scout-Reiter ──────────────────────────────────────────────
  function gesicht(p, verein) {
    try { const tv = teamVon(); const tid = verein && tv[verein] ? tv[verein].t.id : null;
      return window.KSVerein ? KSVerein.gesicht(Object.assign({ id: 'ks_' + hash(schluessel(p)), seed: hash(schluessel(p)) % 997 }, p), tid) : ''; } catch (e) { return ''; }
  }
  function zeile(x) {
    const p = x.p, s = sicht(p), k = schluessel(p), S = z();
    const wartet = S.auftraege.indexOf(k) >= 0, neu = (S.neu || []).indexOf(k) >= 0;
    const st = s.bericht ? `<span class="kss-zahl">${s.ovr}</span><small>Pot. ${s.pot ? (s.pot.lo === s.pot.hi ? s.pot.lo : s.pot.lo + '–' + s.pot.hi) : '?'}</small>`
      : `<span class="vb-stufe ${s.stufe.key}">${s.stufe.name}</span><small>Pot. ?</small>`;
    const nt = s.note ? `<span class="kss-note n${Math.min(4, Math.floor(s.note.i / 2))}${s.note.steal ? ' steal' : ''}" title="Chefscout-Note">${esc(s.note.note)}</span>` : '';
    const knopf = s.bericht ? '' : wartet ? '<span class="kss-ring" title="Scout ist unterwegs (nächste Woche)"><i class="ti ti-telescope" aria-hidden="true"></i></span>'
      : `<button type="button" class="kss-ansehen" data-kss-ansehen="${esc(k)}">Ansehen</button>`;
    return `<div class="kss-zeile${neu ? ' neu' : ''}" data-kss-verein="${esc(x.verein || '')}" data-kss-key="${esc(k)}">
      <span class="vb-gesicht">${gesicht(p, x.verein)}</span>
      <span class="kss-txt"><b>${esc((p.firstName ? p.firstName.charAt(0) + '. ' : '') + p.name)}${s.note && s.note.steal ? ' <em class="kss-steal">Steal</em>' : ''}</b>
        <small>${esc(p.flag || '')} ${p.age} J · ${esc((p.positions || [p.pos]).slice(0, 2).join('/'))} · ${esc(neuName(x.vereinName || ''))}${x.talent ? ' (Akademie)' : ''}</small>
        ${s.note ? `<small class="kss-satz">${esc(satz(p, s.note))}</small>` : ''}</span>
      <span class="kss-werte">${st}</span>${nt}${knopf}</div>`;
  }
  function zeichne() {
    if (!hatSpiel()) return;
    const view = document.getElementById('view-scout'); if (!view) return;
    let el = document.getElementById('ks-scouting');
    if (!el) {
      el = document.createElement('section'); el.id = 'ks-scouting'; el.className = 'kss';
      const banner = document.getElementById('scout-banner');
      if (banner && banner.parentNode) banner.parentNode.insertBefore(el, banner.nextSibling); else view.insertBefore(el, view.firstChild);
      el.addEventListener('click', klick);
    }
    const S = z(), seg = S.seg || 'liga';
    let liste = kandidaten(seg).filter(x => !S.fokus.length || passtFokus(x.p, S.fokus));
    // Sortierung: Berichte nach Note, dann ohne Bericht nach öffentlicher Stufe
    liste = liste.map(x => ({ x, s: sicht(x.p) })).sort((a, b) => (b.s.bericht - a.s.bericht) || ((a.s.note ? a.s.note.i : 99) - (b.s.note ? b.s.note.i : 99)) || (b.s.stufe.ab - a.s.stufe.ab) || (interesse(b.x.p) - interesse(a.x.p)))
      .slice(0, CFG.liste).map(y => y.x);
    el.innerHTML = `<div class="kss-kopf"><span class="kss-titel"><i class="ti ti-telescope" aria-hidden="true"></i><b>Scouting-Abteilung</b></span>
        <span class="kss-chef">Chefscout ${'★'.repeat(sterne())}${'☆'.repeat(5 - sterne())}</span></div>
      <div class="kss-seg">${[['liga', 'Liga'], ['markt', 'Markt'], ['talente', 'Talente']].map(([k, n]) => `<button type="button" data-kss-seg="${k}" class="${seg === k ? 'an' : ''}">${n}</button>`).join('')}</div>
      <div class="kss-chips">${POS.map(p => `<button type="button" data-kss-fokus="${p}" class="${S.fokus.indexOf(p) >= 0 ? 'an' : ''}">${p}</button>`).join('')}</div>
      <div class="kss-liste">${liste.length ? liste.map(zeile).join('') : '<p class="vb-leer">Keine Spieler in diesem Bereich.</p>'}</div>`;
  }
  function klick(ev) {
    const S = z();
    const a = ev.target.closest('[data-kss-ansehen]'); if (a) { ev.stopPropagation(); ansehen(a.getAttribute('data-kss-ansehen')); return; }
    const sg = ev.target.closest('[data-kss-seg]'); if (sg) { S.seg = sg.getAttribute('data-kss-seg'); zeichne(); return; }
    const f = ev.target.closest('[data-kss-fokus]');
    if (f) { const p = f.getAttribute('data-kss-fokus'), i = S.fokus.indexOf(p); if (i >= 0) S.fokus.splice(i, 1); else { S.fokus.push(p); while (S.fokus.length > CFG.fokusMax) S.fokus.shift(); } zeichne(); return; }
    const r = ev.target.closest('[data-kss-verein]');
    if (r && r.getAttribute('data-kss-verein') && window.KSVereinsblatt) {
      const d = r.getAttribute('data-kss-verein'), tv = teamVon();
      if (tv[d]) KSVereinsblatt.oeffnen(tv[d].t.id); else KSVereinsblatt.oeffnen(d);
    }
  }

  // ── Einhängen ──────────────────────────────────────────────────────────────
  if (typeof window.renderScoutTab === 'function') {
    const _r = window.renderScoutTab;
    window.renderScoutTab = function () { const r = _r.apply(this, arguments); try { zeichne(); } catch (e) { console.warn('[KSScouting]', e); } return r; };
    try { renderScoutTab = window.renderScoutTab; } catch (e) { /* window reicht */ }
  }
  if (typeof window.advanceCalendarWeek === 'function') {
    const _w = window.advanceCalendarWeek;
    window.advanceCalendarWeek = function () {
      const r = _w.apply(this, arguments);
      if (r !== false) { try { woche(); } catch (e) { console.warn('[KSScouting] Woche', e); } }
      return r;
    };
    try { advanceCalendarWeek = window.advanceCalendarWeek; } catch (e) { /* window reicht */ }
  }
  // Beobachtung: ein Bericht zählt als „durchleuchtet“ (Eigenschaften sichtbar, Markt genau)
  if (typeof window.beobachtungsFortschritt === 'function') {
    _beoOrig = window.beobachtungsFortschritt;
    window.beobachtungsFortschritt = function (p) { const f = _beoOrig.apply(this, arguments); if (f >= 1) return f; return hatBericht(p) ? 1 : f; };
  }
  if (typeof window.potentialDisplay === 'function') {
    const _pd = window.potentialDisplay;
    window.potentialDisplay = function (p, scoutLevel) {
      try {
        if (p && hatSpiel() && !(typeof SQUAD !== 'undefined' && SQUAD.some(x => x.id === p.id)) && hatBericht(p)) {
          const r = typeof potentialRange === 'function' ? potentialRange(p, scoutLevel) : { lo: p.truePotential, hi: p.truePotential };
          return p.ovr + ' (' + (r.lo >= r.hi ? r.lo : r.lo + '-' + r.hi) + ')';
        }
      } catch (e) { /* Standard */ }
      return _pd.apply(this, arguments);
    };
    try { potentialDisplay = window.potentialDisplay; } catch (e) { /* window reicht */ }
  }

  const css = document.createElement('style');
  css.textContent = `.kss{background:var(--bg2,#fffaf0);border:3px solid var(--k-rahmen,#8b5a2b);border-radius:18px;padding:12px;margin:10px 0}
  html.dark .kss{background:var(--bg2,#1e2230)}
  .kss-kopf{display:flex;align-items:center;justify-content:space-between;gap:8px}.kss-titel{display:flex;align-items:center;gap:6px}
  .kss-titel b{font:700 18px/1.1 var(--font-titel,Fredoka,system-ui)}.kss-titel i{font-size:22px;color:var(--k-blau,#2c7cb5)}
  .kss-chef{font-size:12px;color:var(--k-gold,#c9a227);font-weight:800;white-space:nowrap}
  .kss-info{font-size:12px;color:var(--text3,#846d52);margin:6px 2px 8px}
  .kss-seg{display:flex;gap:6px;margin-bottom:8px}.kss-seg button{flex:1;font:700 13px/1 var(--font-titel,system-ui);padding:9px;border-radius:12px;border:2px solid var(--k-rand,#d9c29a);background:none;color:inherit;cursor:pointer}
  .kss-seg button.an{background:var(--k-blau,#2c7cb5);border-color:var(--k-blau-tief,#1d5a86);color:#fff}
  .kss-chips{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px}.kss-chips button{font:800 11px/1 system-ui;padding:6px 9px;border-radius:999px;border:2px solid var(--k-rand,#d9c29a);background:none;color:inherit;cursor:pointer}
  .kss-chips button.an{background:var(--k-gruen,#25c065);border-color:var(--k-gruen-tief,#188a46);color:#fff}
  .kss-zeile{display:flex;align-items:center;gap:9px;padding:7px 6px;border-radius:12px;cursor:pointer}
  .kss-zeile:nth-child(odd){background:color-mix(in srgb,var(--bg3,#efe2c8) 55%,transparent)}.kss-zeile.neu{box-shadow:inset 3px 0 0 var(--k-gruen,#25c065)}
  .kss .vb-gesicht{width:38px;height:38px;flex:none;border-radius:50%;overflow:hidden;background:var(--bg3,#efe2c8)}.kss .vb-gesicht svg{width:38px;height:38px;display:block}
  .kss-txt{flex:1;min-width:0;display:flex;flex-direction:column}.kss-txt b{font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .kss-txt small{font-size:11.5px;color:var(--text3,#846d52);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.kss-satz{font-style:italic}
  .kss-werte{display:flex;flex-direction:column;align-items:flex-end;gap:2px;min-width:58px}.kss-werte small{font-size:11px;color:var(--text3,#846d52)}
  .kss-zahl{font:800 17px/1 var(--font-zahl,system-ui)}
  .kss-note{font:800 13px/1 var(--font-zahl,system-ui);min-width:30px;text-align:center;padding:6px 4px;border-radius:8px;color:#fff;background:#6b7a8f}
  .kss-note.n0{background:#1f9d55}.kss-note.n1{background:#5aa83a}.kss-note.n2{background:#c99a12}.kss-note.n3{background:#d0762c}.kss-note.n4{background:#b3453c}
  .kss-note.steal{box-shadow:0 0 0 2px #f0c05a}.kss-steal{font-style:normal;font-size:10px;font-weight:800;background:#f0c05a;color:#2a1c02;padding:1px 5px;border-radius:5px;vertical-align:1px}
  .kss-ansehen{border:0;border-radius:10px;padding:7px 9px;font:700 12px/1 var(--font-titel,system-ui);background:var(--k-gruen,#25c065);color:#fff;box-shadow:0 3px 0 var(--k-gruen-tief,#188a46);cursor:pointer}
  .kss-ring{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;border:2px dashed var(--k-gold,#c9a227);color:var(--k-gold,#c9a227)}`;
  document.head.appendChild(css);

  // Für die PC-Tabelle (kickstil_pc_scouting.js): Schlüssel → Eintrag {p, verein, vereinName, markt?, talent?}, zuerst im offenen Bereich
  function finde(key) {
    if (!hatSpiel() || !key) return null;
    const seg = z().seg || 'liga';
    for (const s of [seg].concat(['liga', 'markt', 'talente'].filter(x => x !== seg))) { const x = kandidaten(s).find(y => schluessel(y.p) === key); if (x) return x; }
    return null;
  }
  const wartet = key => hatSpiel() && z().auftraege.indexOf(key) >= 0;

  window.KSScouting = { CFG, sicht, hatBericht, note, ansehen, woche, zeichne, schluessel, NOTEN, finde, satz, gesicht, wartet, teamVon, sterne, kandidaten, seg: () => (hatSpiel() ? z().seg || 'liga' : 'liga') };
  console.log('[Kickstil-Scouting v1] aktiv — Scouting-Abteilung wie Kickdraft: Stufen, Berichte je Woche, Fokus, Chefscout-Noten, Steals');
})();
