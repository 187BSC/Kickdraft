/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · TAKTIK WIE KICKDRAFT  ·  v1   (Nutzer 2026-10-18: „Taktik bei Flutlicht genauso wie bei Kickdraft“)
   ─────────────────────────────────────────────────────────────────────────
   Port von Kickdrafts dfl_taktik_patch.js (D55) für die Flutlicht-Welt – gleiche Ansicht, gleiche Zahlen, gleiche API (DFLTaktik),
   damit engine_v3_adapter.js den Stilfaktor genauso abholt (engineFaktoren) und die Handy-Oberfläche „Beste Elf“ (besteElf) nutzt.
   Schere-Stein-Papier der vier Spielstile: Gegenpressing → Ballbesitz → Flügelspiel → Direktes Angriffsspiel → Gegenpressing
   („schlägt“, +6 % Torchancen), gegenüber ausgeglichen. Formation passt zum Stil ±3 %, Spieler passen zum Stil bis ±4 %
   (stärkebereinigt gegen die eigene Liga). Eingewöhnung: Wechsel zum Nachbarn höchstens 50 %, zum Gegenüber 20 %, +12 Punkte je
   eigenem Spiel; positiver Bonus zählt nur anteilig; unter 60 % entwickeln sich die eigenen Spieler 15 % langsamer.
     · Eigener Verein: CLUB.ksTaktik = { stil, eing } – Start mit dem Stil, der am besten zum Kader passt (voll eingewöhnt).
     · KI-Vereine: Stil je Saison aus der Passung ihres Kaders (CLUB.npcSquads) mit etwas Trainer-Vorliebe, eingewöhnt.
     · Wirkung: Engine v3 (eigene Spiele) über engineFaktoren; KI-Spiele unverändert.
     · Ansicht: Kader → Taktik: Kreis, Urteil gegen den nächsten Gegner, Eingewöhnungsring, Stilfaktor, Stilkarten, „Wer passt?“;
       die alten Regler sind ausgeblendet (body.ks-taktik). CSS wie Kickdraft (css/dfl_spiel.css, gleiche Datei).
   API: DFLTaktik.STILE · .KREIS · .eigenerStil() · .stilSetzen(stil) · .stilVon(id) · .stilInfo(id) · .faktor(gegner, opt)
        · .engineFaktoren() · .passung(stil) · .entwicklungsFaktor() · .zeichne() · .besteElf() · .waehle(stil)
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const spiel = () => typeof CLUB !== 'undefined' && CLUB && typeof LEAGUE !== 'undefined' && LEAGUE && typeof SQUAD !== 'undefined' && SQUAD.length >= 11;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const de = (x, d) => Number(x).toLocaleString('de-DE', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  // Zahlen wie Kickdraft (DFLSaison.CFG.stil, D55 freigegeben 2026-10-09)
  const C = { kreis: 6, formation: 3, spieler: 4, jeSpiel: 0.12, nachbar: 0.5, gegenueber: 0.2, entwicklungUnter: 0.6, entwicklung: 0.85 };
  const STILE = {
    pressing: { name: 'Gegenpressing', kurz: 'Pressing', ic: 'ti-run', farbe: '#fb7185', formationen: ['4-2-3-1', '4-3-3', '4-2-2-2'] },
    ballbesitz: { name: 'Geduldiger Ballbesitz', kurz: 'Ballbesitz', ic: 'ti-ball-football', farbe: '#38bdf8', formationen: ['4-3-3', '4-1-4-1', '4-2-3-1'] },
    fluegel: { name: 'Flügelspiel', kurz: 'Flügel', ic: 'ti-flag-3', farbe: '#a3e635', formationen: ['4-3-3', '3-4-3', '5-2-3'] },
    direkt: { name: 'Direktes Angriffsspiel', kurz: 'Direkt', ic: 'ti-shoe', farbe: '#fbbf24', formationen: ['4-4-2', '4-4-1-1', '3-5-2'] }
  };
  const KREIS = ['pressing', 'ballbesitz', 'fluegel', 'direkt'];
  const STIL_POS = { direkt: ['TW', 'ST', 'OM', 'FL', 'AV'], ballbesitz: ['TW', 'ZM', 'OM', 'ZDM', 'IV'], fluegel: ['TW', 'AV', 'FL', 'ST', 'AM'], pressing: ['TW', 'ZM', 'OM', 'ST', 'FL', 'AM'] };
  const GRUND = { LV: 'AV', RV: 'AV', DM: 'ZDM', ZOM: 'OM', LM: 'AM', RM: 'AM', LA: 'FL', RA: 'FL', LF: 'FL', RF: 'FL', MS: 'ST', HS: 'ST' };
  const grund = pos => GRUND[pos] || pos;
  const formationPasst = (stil, f) => !!(STILE[stil] && STILE[stil].formationen.indexOf(f) >= 0);
  function duell(a, b) {
    const i = KREIS.indexOf(a), j = KREIS.indexOf(b);
    if (i < 0 || j < 0 || i === j) return 0;
    return (i + 1) % 4 === j ? 1 : (j + 1) % 4 === i ? -1 : 0;
  }
  const wechselKosten = (von, nach) => (!von || von === nach) ? 1 : Math.abs(KREIS.indexOf(von) - KREIS.indexOf(nach)) === 2 ? C.gegenueber : C.nachbar;
  function stilFaktor(stil, gegner) {
    const kreis = duell(stil.key, gegner && gegner.key) * C.kreis;
    const formation = stil.formPasst === false ? -C.formation : C.formation;
    const spieler = Math.max(-C.spieler, Math.min(C.spieler, stil.spieler || 0));
    const eing = stil.eing != null ? stil.eing : 1;
    const roh = kreis + formation + spieler, summe = roh > 0 ? roh * eing : roh;
    return { kreis, formation, spieler, eing, roh, summe, mult: 1 + summe / 100 };
  }

  // ── Stilwert je Spieler (wie Kickdraft dfl_handel.js stilWert, ohne Torwart-Feinwerte) ──────────────────
  // Alle Spieler gleich behandelt: Werte aus spielerWerte (player_attributes.js – dieselben Zahlen wie im Spieler-Blatt), denn
  // KI-Kader (CLUB.npcSquads) tragen kein pace/mental/technik; Rückfall auf die Grundwerte
  const WERTE = new Map();
  function werte(p) {
    const k = (p.id || p.name) + '|' + p.ovr + '|' + p.pos;
    if (WERTE.has(k)) return WERTE.get(k);
    let w = null;
    try { w = typeof spielerWerte === 'function' ? spielerWerte(p) : null; } catch (e) { w = null; }
    const m = (...x) => { const v = x.map(n => w && w[n]).filter(n => typeof n === 'number'); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
    const o = { pace: m('schnelligkeit') || p.pace || 55, att: m('schiessen', 'offStellung') || p.att || 55, mid: m('passen') || p.mid || 55,
      mental: m('spielintelligenz') || p.mental || 55, def: m('defStellung', 'tackling') || p.def || 55, tec: m('dribbling', 'passen') || ((p.mid || 55) + (p.att || 55)) / 2 };
    if (WERTE.size > 4000) WERTE.clear();
    WERTE.set(k, o);
    return o;
  }
  // Haken für Erweiterungen (PC-NLZ: Eigengewächse im eigenen System passen besser) – window.KSStilHaken(p, stil, wert) → wert
  function stilWert(p, stil) {
    const v = stilWertRoh(p, stil), h = window.KSStilHaken;
    if (typeof h !== 'function') return v;
    try { const x = h(p, stil, v); return typeof x === 'number' && isFinite(x) ? x : v; } catch (e) { return v; }
  }
  function stilWertRoh(p, stil) {
    const w = werte(p), pace = w.pace, att = w.att, mid = w.mid, mental = w.mental, def = w.def, tec = w.tec;
    switch (stil) {
      case 'direkt': return pace * 0.50 + att * 0.35 + tec * 0.15;
      case 'ballbesitz': return tec * 0.45 + mid * 0.35 + mental * 0.20;
      case 'fluegel': return pace * 0.40 + tec * 0.30 + mid * 0.30;
      case 'pressing': return mental * 0.45 + pace * 0.40 + def * 0.15;
      default: return 55;
    }
  }
  const relevant = (p, stil) => grund(p.pos) !== 'TW' && STIL_POS[stil].indexOf(grund(p.pos)) >= 0;
  // Startelf eines Kaders: eigener Verein = Aufstellung, KI = bester Torwart + zehn beste Feldspieler
  function elfVon(kader, eigen) {
    if (eigen && CLUB.lineup) {
      const ids = new Set(Object.values(CLUB.lineup).filter(Boolean));
      const e = SQUAD.filter(p => ids.has(p.id));
      if (e.length >= 10) return e;
    }
    const k = (kader || []).filter(p => p && p.ovr);
    const tw = k.filter(p => grund(p.pos) === 'TW').sort((a, b) => b.ovr - a.ovr)[0];
    return (tw ? [tw] : []).concat(k.filter(p => p !== tw && grund(p.pos) !== 'TW').sort((a, b) => b.ovr - a.ovr).slice(0, 10));
  }
  const schnitt = (l, f) => l.length ? l.reduce((s, p) => s + f(p), 0) / l.length : 0;
  const teamOvr = elf => schnitt(elf, p => p.ovr || 0);
  function stilTeam(elf, stil) { const rel = elf.filter(p => relevant(p, stil)); return rel.length ? schnitt(rel, p => stilWert(p, stil)) : 50; }

  // ── Liga des eigenen Vereins: Kader aller Gegner (CLUB.npcSquads) ─────────────────────────────────────
  function ligaTeams() {
    const fg = typeof findFcmGroup === 'function' ? findFcmGroup(LEAGUE) : null;
    if (!fg) return [];
    const sq = CLUB.npcSquads || {};
    return fg.group.teams.map(t => t.id === 'fcm' ? { id: 'fcm', t, elf: elfVon(SQUAD, true) }
      : { id: t.id, t, elf: elfVon(sq[t.dataId] || sq[t.id] || [], false) }).filter(x => x.elf.length >= 11);
  }
  // Stärkebereinigte Passung (wie Kickdraft stilPassung): Residuum der Geraden Stilwert ~ Teamstärke über die Liga ÷ Streuung
  let REG = { k: '', o: null };
  function regression(teams) {
    const k = LEAGUE.season + ':' + LEAGUE.week + ':' + teams.length + ':' + (CLUB.formation || '');
    if (REG.k === k) return REG.o;
    const xs = teams.map(x => teamOvr(x.elf)), mx = schnitt(xs, x => x), o = {};
    KREIS.forEach(s => {
      const ys = teams.map(x => stilTeam(x.elf, s)), my = schnitt(ys, y => y);
      let sxy = 0, sxx = 0; xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) ** 2; });
      const b = sxx ? sxy / sxx : 0;
      const sd = Math.sqrt(ys.reduce((a, y, i) => a + (y - (my + b * (xs[i] - mx))) ** 2, 0) / Math.max(1, ys.length));
      o[s] = { b, mx, my, sd: Math.max(0.3, sd) };
    });
    REG = { k, o };
    return o;
  }
  function passungZ(teams, elf, s) {
    const g = regression(teams)[s]; if (!g || elf.length < 11) return 0;
    const z = (stilTeam(elf, s) - (g.my + g.b * (teamOvr(elf) - g.mx))) / g.sd;
    return isFinite(z) ? z : 0;
  }
  const prozent = z => Math.max(-4, Math.min(4, Math.round(z * 2 * 10) / 10));
  function passung(stil) { const teams = ligaTeams(); return prozent(passungZ(teams, elfVon(SQUAD, true), stil)); }
  const hashZahl = txt => { let h = 2166136261; for (const c of String(txt)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };

  // ── Zustand ──────────────────────────────────────────────────────────────
  function zustand() {
    if (!spiel()) return null;
    const z = CLUB.ksTaktik;
    if (z && STILE[z.stil]) return z;
    const teams = ligaTeams(), elf = elfVon(SQUAD, true);
    const best = teams.length ? KREIS.slice().sort((a, b) => passungZ(teams, elf, b) - passungZ(teams, elf, a))[0] : 'ballbesitz';
    CLUB.ksTaktik = { stil: best, eing: 1 };
    return CLUB.ksTaktik;
  }
  // KI-Stile je Saison (Passung + Trainer-Vorliebe), zwischengespeichert in CLUB.welt.ksTaktik
  function kiStile() {
    if (!CLUB.welt) CLUB.welt = {};
    const w = CLUB.welt.ksTaktik;
    if (w && w.saison === LEAGUE.season && w.stile) return w.stile;
    const teams = ligaTeams(), stile = {};
    teams.filter(x => x.id !== 'fcm').forEach(x => {
      stile[x.id] = KREIS.map(s => ({ s, w: passungZ(teams, x.elf, s) + (hashZahl(x.id + s + LEAGUE.season) - 0.5) * 0.8 })).sort((a, b) => b.w - a.w)[0].s;
    });
    CLUB.welt.ksTaktik = { saison: LEAGUE.season, stile };
    return stile;
  }
  const eigenerStil = () => { const z = zustand(); return z ? { stil: z.stil, eing: z.eing } : null; };
  function stilSetzen(stil) {
    const z = zustand(); if (!z || !STILE[stil] || stil === z.stil) return eigenerStil();
    z.eing = Math.min(z.eing, wechselKosten(z.stil, stil));
    z.stil = stil;
    if (typeof saveGameState === 'function') saveGameState();
    return eigenerStil();
  }
  function stilVon(id) {
    if (!spiel() || id == null) return null;
    if (id === 'fcm') { const z = zustand(); return z ? z.stil : null; }
    return kiStile()[id] || null;
  }
  function stilInfo(id, opt) {
    if (!spiel() || id == null) return null;
    opt = opt || {};
    if (id === 'fcm') {
      const z = zustand(); if (!z) return null;
      const stil = opt.stil || z.stil;
      return { key: stil, spieler: passung(stil), formPasst: formationPasst(stil, opt.formation || CLUB.formation),
        eing: stil === z.stil ? z.eing : Math.min(z.eing, wechselKosten(z.stil, stil)) };
    }
    const stil = stilVon(id); if (!stil) return null;
    const teams = ligaTeams(), x = teams.find(t => t.id === id);
    return { key: stil, spieler: x ? prozent(passungZ(teams, x.elf, stil)) : 0, formPasst: true, eing: 1 };
  }
  function faktor(gegnerId, opt) {
    const a = stilInfo('fcm', opt), b = stilInfo(gegnerId);
    if (!a) return null;
    return Object.assign(stilFaktor(a, b || { key: null }), { stil: a.key, passt: a.formPasst, gegnerStil: b ? b.key : null });
  }
  // Engine v3 (engine_v3_adapter.js): [eigener Verein, Gegner] des aktuellen Spiels
  function engineFaktoren() {
    try {
      if (!spiel() || typeof CURRENT_FIXTURE === 'undefined' || !CURRENT_FIXTURE) return null;
      const gid = CURRENT_FIXTURE.opponentId || (CURRENT_FIXTURE.opponent && CURRENT_FIXTURE.opponent.id);
      const a = stilInfo('fcm'), b = gid ? stilInfo(gid) : null;
      if (!a) return null;
      return [stilFaktor(a, b || { key: null }).mult, b ? stilFaktor(b, a).mult : 1];
    } catch (e) { return null; }
  }
  const entwicklungsFaktor = () => { const z = spiel() && zustand(); return z && z.eing < C.entwicklungUnter ? C.entwicklung : 1; };

  // ── Beste Elf (Handy „Beste Elf“, Stilwechsel): Formation bleibt, außer sie passt nicht zum Stil ────────
  const abwehr = f => +String(f).split('-')[0] || 4;
  function formationFuer(stil, aktuell) {
    const st = STILE[stil];
    if (!st || typeof FORMATIONS === 'undefined') return aktuell;
    const liste = st.formationen.filter(f => FORMATIONS[f]);
    if (!liste.length || liste.indexOf(aktuell) >= 0) return aktuell;
    const gleich = liste.filter(f => abwehr(f) === abwehr(aktuell || '4-4-2'));
    return (gleich.length ? gleich : liste)[0];
  }
  function besteElf(still, opt) {
    const z = zustand();
    if (z && opt && opt.formationWaehlen) {
      const f = formationFuer(z.stil, CLUB.formation);
      if (f && f !== CLUB.formation && typeof changeFormation === 'function') { try { changeFormation(f); } catch (e) { CLUB.formation = f; } }
    }
    if (typeof window.besteAufstellung === 'function') window.besteAufstellung();
    if (!still) { try { zeichne(); } catch (e) { /* Ansicht optional */ } }
    return CLUB.formation;
  }

  // ── Haken ────────────────────────────────────────────────────────────────
  {   // Eingewöhnung: +12 Punkte je eigenem Spiel
    const _orig = window.postMatchContinue;
    if (typeof _orig === 'function') {
      window.postMatchContinue = function () {
        try { if (spiel()) { const z = zustand(); if (z && z.eing < 1) z.eing = Math.min(1, Math.round((z.eing + C.jeSpiel) * 100) / 100); } } catch (e) { /* ohne Taktik */ }
        return _orig.apply(this, arguments);
      };
      try { postMatchContinue = window.postMatchContinue; } catch (e) { /* window reicht */ }
    }
  }
  {   // Entwicklung: unter 60 % Eingewöhnung 15 % langsamer (nur eigener Kader)
    const _orig = window.traitDevFaktor;
    window.traitDevFaktor = function (p) {
      const f = typeof _orig === 'function' ? _orig.apply(this, arguments) : 1;
      if (!spiel() || !p || SQUAD.indexOf(p) < 0) return f;
      return f * entwicklungsFaktor();
    };
  }
  {   // Formation gewechselt → Ansicht frisch
    const _orig = window.changeFormation;
    if (typeof _orig === 'function') {
      window.changeFormation = function () { const r = _orig.apply(this, arguments); try { if (document.getElementById('dfl-stil-box')) zeichne(); } catch (e) { /* optional */ } return r; };
      try { changeFormation = window.changeFormation; } catch (e) { /* window reicht */ }
    }
  }

  // ── Ansicht: Kader → Taktik (wie Kickdraft) ──────────────────────────────
  let gewaehlt = null, vorher = null;
  function ringSvg(anteil, farbe, text) {
    const r = 26, u = 2 * Math.PI * r;
    return `<svg class="stil-ring" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="${r}" class="stil-ring-grund"/>
      <circle cx="32" cy="32" r="${r}" fill="none" style="stroke:${farbe}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${(u * anteil).toFixed(1)} ${u.toFixed(1)}" transform="rotate(-90 32 32)"/>
      <text x="32" y="37" text-anchor="middle">${text}</text></svg>`;
  }
  function kreisSvg(wahl, gegner, gegnerKurz) {
    const pos = [[150, 64], [262, 172], [150, 280], [38, 172]];
    const pfeile = KREIS.map((s, i) => {
      const [x1, y1] = pos[i], [x2, y2] = pos[(i + 1) % 4], dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l;
      return `<line x1="${(x1 + ux * 40).toFixed(1)}" y1="${(y1 + uy * 40).toFixed(1)}" x2="${(x2 - ux * 42).toFixed(1)}" y2="${(y2 - uy * 42).toFixed(1)}" class="stil-pfeil" marker-end="url(#stil-spitze)"/>`;
    }).join('');
    const knoten = KREIS.map((s, i) => {
      const [x, y] = pos[i], st = STILE[s], ich = s === wahl, er = s === gegner;
      return `<g class="stil-knoten" data-stil="${s}" role="button" tabindex="0" aria-label="${st.name}${ich ? ', gewählt' : ''}${er ? ', Stil des Gegners' : ''}">
        ${er ? `<circle cx="${x}" cy="${y}" r="38" fill="none" class="stil-gegner"/>` : ''}
        <circle cx="${x}" cy="${y}" r="30" style="fill:${ich ? st.farbe : 'var(--bg3, #262a3a)'};stroke:${st.farbe}" stroke-width="3"/>
        <foreignObject x="${x - 14}" y="${y - 14}" width="28" height="28"><i class="ti ${st.ic}" style="font-size:26px;line-height:28px;color:${ich ? '#10161f' : st.farbe}" aria-hidden="true"></i></foreignObject>
        <text x="${x}" y="${y + (i === 0 ? -42 : 50)}" text-anchor="middle">${st.kurz}</text>
        ${er && gegnerKurz ? `<text x="${x}" y="${y + (i === 0 ? -56 : 64)}" text-anchor="middle" class="stil-gegner-name">${esc(gegnerKurz)}</text>` : ''}</g>`;
    }).join('');
    return `<svg class="stil-rad" viewBox="0 -10 300 360" role="group" aria-label="Kreis der Spielstile: Pfeil zeigt auf den Stil, den er schlägt">
      <defs><marker id="stil-spitze" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" class="stil-spitze"/></marker></defs>
      ${pfeile}${knoten}<text x="150" y="177" text-anchor="middle" class="stil-mitte">gegenüber: ausgeglichen</text></svg>`;
  }
  function faktorKarte(f, gegnerKurz) {
    const z = (text, v) => { const w = Math.min(50, Math.abs(v) / 6 * 50);
      return `<div class="stil-fz"><span>${text}</span><span class="stil-bal"><i style="${v >= 0 ? 'left' : 'right'}:50%;width:${w.toFixed(0)}%;background:${v > 0 ? 'var(--app-gut, #2ecc71)' : v < 0 ? 'var(--app-schlecht, #e74c3c)' : 'transparent'}"></i></span><b>${v > 0 ? '+' : v < 0 ? '−' : '±'}${de(Math.abs(v), 1)} %</b></div>`; };
    return `<div class="stil-karte stil-faktor"><div class="stil-titel"><b><i class="ti ti-target-arrow" aria-hidden="true"></i> Stilfaktor</b></div>
      ${f.gegnerStil ? z('Kreis gegen ' + esc(gegnerKurz || 'Gegner'), f.kreis) : ''}${z('Formation ' + esc(CLUB.formation) + (f.passt ? ' passt' : ' passt nicht'), f.formation)}${z('Spieler passen zum Stil', f.spieler)}
      ${f.roh > 0 && f.eing < 1 ? z('Eingewöhnung ' + Math.round(f.eing * 100) + ' % (Bonus anteilig)', -(Math.round((f.roh - f.summe) * 10) / 10)) : ''}
      <div class="stil-summe"><span>Torchancen</span><b class="${f.summe > 0 ? 'plus' : f.summe < 0 ? 'minus' : ''}">×${de(f.mult, 2)}</b></div></div>`;
  }
  function naechsterGegner() {
    try {
      const n = typeof fcmNextFixture === 'function' ? fcmNextFixture(LEAGUE) : null;
      if (!n) return null;
      const id = n.opponentId || (n.opponent && n.opponent.id);
      const fg = findFcmGroup(LEAGUE), t = fg && fg.group.teams.find(x => x.id === id);
      return t ? { id, name: t.name, kurz: t.shortName || t.kurz || t.name.split(' ').pop() } : null;
    } catch (e) { return null; }
  }
  function boxHtml() {
    const z = zustand(); if (!z) return '';
    if (!gewaehlt || !STILE[gewaehlt]) gewaehlt = z.stil;
    const g = naechsterGegner(), gStil = g ? stilVon(g.id) : null, gKurz = g ? g.kurz : '';
    const d = gStil ? duell(gewaehlt, gStil) : 0;
    const eing = gewaehlt === z.stil ? z.eing : Math.min(z.eing, wechselKosten(z.stil, gewaehlt));
    const f = faktor(g ? g.id : null, { stil: gewaehlt });
    let wappen = '';
    try { wappen = g && window.KSVerein && KSVerein.wappen ? KSVerein.wappen(g.id, { klein: true }) : ''; } catch (e) { wappen = ''; }
    const urteil = gStil ? `<div class="stil-karte stil-urteil ${d > 0 ? 'plus' : d < 0 ? 'minus' : ''}">
        <span class="stil-wappen ks-stil-wappen">${wappen}</span>
        <span><b>${d > 0 ? 'Vorteil' : d < 0 ? 'Nachteil' : 'Ausgeglichen'} gegen ${esc(g.name)}</b>
        <small>${d > 0 ? `+${C.kreis} % Torchancen` : d < 0 ? `−${C.kreis} % Torchancen` : 'beide ±0 %'}</small></span></div>` : '';
    const ringFarbe = eing >= 1 ? 'var(--app-gut, #2ecc71)' : eing >= C.entwicklungUnter ? 'var(--app-mittel, #f1c40f)' : 'var(--app-schlecht, #e74c3c)';
    const werPasst = SQUAD.filter(p => relevant(p, gewaehlt) && !p.onLoanAt).map(p => ({ p, w: Math.round(stilWert(p, gewaehlt)) })).sort((a, b) => b.w - a.w).slice(0, 5);
    const teams = ligaTeams(), ligaSchnitt = teams.length ? schnitt(teams, x => stilTeam(x.elf, gewaehlt)) : 60;
    const karten = KREIS.map(s => {
      const st = STILE[s], pa = passung(s), d2 = gStil ? duell(s, gStil) : 0, w = wechselKosten(z.stil, s);
      const pf = Math.max(4, Math.min(100, 50 + pa * 12));
      return `<button type="button" class="stil-wahl-karte" data-stil="${s}" aria-pressed="${s === gewaehlt}">
        <span class="stil-icon" style="background:${st.farbe}"><i class="ti ${st.ic}" aria-hidden="true"></i></span>
        <span class="stil-name">${st.name}${s === z.stil ? ' <span class="stil-chip gut">aktuell</span>' : ''}</span>
        <span class="stil-pass" title="Passung des Kaders ${pa > 0 ? '+' : ''}${de(pa, 1)} %"><i style="width:${pf}%;background:${pa >= 1 ? 'var(--app-gut, #2ecc71)' : pa >= -1 ? 'var(--app-mittel, #f1c40f)' : 'var(--app-schlecht, #e74c3c)'}"></i></span>
        <span class="stil-zeile2">${st.formationen.filter(fm => typeof FORMATIONS === 'undefined' || FORMATIONS[fm]).map(fm => `<span class="stil-chip form${fm === CLUB.formation ? ' an' : ''}">${fm}</span>`).join('')}
          ${gStil ? `<span class="stil-chip ${d2 > 0 ? 'gut' : d2 < 0 ? 'schlecht' : ''}">${d2 > 0 ? '▲' : d2 < 0 ? '▼' : '='} ${esc(gKurz)}</span>` : ''}
          ${s !== z.stil ? `<span class="stil-chip ${w <= C.gegenueber ? 'schlecht' : 'mittel'}">→ ${Math.round(Math.min(z.eing, w) * 100)} %</span>` : ''}</span></button>`;
    }).join('');
    return `<div class="stil-box">
      <div class="stil-titel"><b>Spielstil</b></div>
      ${kreisSvg(gewaehlt, gStil, gKurz)}
      ${urteil}
      <div class="stil-karte stil-eing">${ringSvg(eing, ringFarbe, Math.round(eing * 100) + '%')}
        <span><b>Eingewöhnung</b><small>${eing >= 1 ? 'voll' : `+${Math.round(C.jeSpiel * 100)} % je Spiel`}</small>
          ${eing < C.entwicklungUnter ? `<span class="stil-chip schlecht"><i class="ti ti-clock" aria-hidden="true"></i>Entwicklung −${Math.round((1 - C.entwicklung) * 100)} %</span>` : ''}</span></div>
      ${f ? faktorKarte(f, gKurz) : ''}
      ${vorher && vorher.taktik.stil !== z.stil ? `<button type="button" class="app-knopf stil-zurueck" data-zurueck="1"><i class="ti ti-arrow-back-up" aria-hidden="true"></i>Rückgängig: zurück zu ${STILE[vorher.taktik.stil].name} · ${vorher.formation}</button>` : ''}
      <div class="stil-titel"><b>Stile</b></div>
      ${karten}
      <div class="stil-titel"><b>Wer passt zu ${STILE[gewaehlt].kurz}?</b><small>Liga Ø ${Math.round(ligaSchnitt)}</small></div>
      <div class="stil-wer">${werPasst.map(x => `<div class="stil-wer-zeile"><span class="pos-badge-sm pos-${x.p.pos}">${x.p.pos}</span><span>${esc(typeof displayName === 'function' ? displayName(x.p) : x.p.name)}</span><b>${x.w}</b></div>`).join('')}</div>
    </div>`;
  }
  // Stil gilt sofort beim Antippen (wie Kickdraft), „Rückgängig“ stellt Stil, Eingewöhnung, Formation und Elf wieder her
  function waehle(stil) {
    const z = zustand(); if (!z || !STILE[stil]) return;
    if (stil === z.stil) { gewaehlt = stil; zeichne(); return; }
    const merk = { taktik: Object.assign({}, z), formation: CLUB.formation, lineup: Object.assign({}, CLUB.lineup) };
    const neu = stilSetzen(stil), f = besteElf(true, { formationWaehlen: true });
    vorher = merk; gewaehlt = neu.stil;
    try { if (typeof renderPitch === 'function') renderPitch(); } catch (e) { /* optional */ }
    if (typeof window.showToast === 'function') window.showToast(`${STILE[neu.stil].name} · ${f} · Eingewöhnung ${Math.round(neu.eing * 100)} %`, 'info');
    zeichne();
  }
  function zurueck() {
    if (!vorher) return;
    CLUB.ksTaktik = vorher.taktik; CLUB.formation = vorher.formation; CLUB.lineup = vorher.lineup; CLUB.selected = null;
    vorher = null; gewaehlt = CLUB.ksTaktik.stil;
    if (typeof saveGameState === 'function') saveGameState();
    try { if (typeof renderPitch === 'function') renderPitch(); if (typeof renderFormationOptions === 'function') renderFormationOptions(); } catch (e) { /* optional */ }
    zeichne();
  }
  function zeichne() {
    const host = document.getElementById('sub-tactics'); if (!host || !spiel()) return;
    let box = document.getElementById('dfl-stil-box');
    if (!box) {
      box = document.createElement('div'); box.id = 'dfl-stil-box';
      box.addEventListener('click', ev => {
        if (ev.target.closest('[data-zurueck]')) { zurueck(); return; }
        const k = ev.target.closest('[data-stil]');
        if (k) waehle(k.getAttribute('data-stil'));
      });
      box.addEventListener('keydown', ev => {
        const k = ev.target.closest('.stil-knoten');
        if (k && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); waehle(k.getAttribute('data-stil')); }
      });
    }
    if (host.firstChild !== box) host.insertBefore(box, host.firstChild);
    try { box.innerHTML = boxHtml(); } catch (e) { console.warn('[KS-Taktik] Ansicht', e); }
  }
  {
    const _orig = window.switchSubview;
    if (typeof _orig === 'function') {
      window.switchSubview = function (name) { const r = _orig.apply(this, arguments); if (name === 'tactics') { gewaehlt = null; vorher = null; zeichne(); } return r; };
      try { switchSubview = window.switchSubview; } catch (e) { /* window reicht */ }
    }
  }
  {
    const _orig = window.renderTacticsExtras;
    if (typeof _orig === 'function') window.renderTacticsExtras = function () { const r = _orig.apply(this, arguments); try { zeichne(); } catch (e) { /* optional */ } return r; };
  }
  // body.ks-taktik: alte Regler, Repertoire und Eingespieltheit im Taktik-Reiter ausblenden (css/kickstil.css)
  const klasse = () => { try { if (document.body) document.body.classList.toggle('ks-taktik', true); } catch (e) { /* ohne DOM */ } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', klasse); else klasse();
  // Neue Karriere: Stil gleich festlegen (der am besten passt)
  if (typeof window.startNewGameState === 'function') {
    const _neu = window.startNewGameState;
    window.startNewGameState = async function () {
      const r = await _neu.apply(this, arguments);
      // wie Kickdraft: neue Karriere mit dem passenden Stil, dazu passender Formation und Elf (sonst startet jeder im 4-4-2)
      try { delete CLUB.ksTaktik; if (spiel()) { zustand(); besteElf(true, { formationWaehlen: true }); } } catch (e) { console.warn('[KS-Taktik] Start', e); }
      return r;
    };
    try { startNewGameState = window.startNewGameState; } catch (e) { /* window reicht */ }
  }
  window.DFLTaktik = { STILE, KREIS, eigenerStil, stilSetzen, stilVon, stilInfo, faktor, engineFaktoren, passung, wechselKosten,
    formationPasst, entwicklungsFaktor, zeichne, besteElf, formationFuer, waehle, duell, stilFaktor };
  console.log('[KS-Taktik v1] aktiv — Spielstil-Kreis wie Kickdraft: Stilfaktor in Engine v3, Eingewöhnung, Entwicklung −15 % unter 60 %');
})();
