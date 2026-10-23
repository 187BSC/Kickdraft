/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · POSITIONEN MIT SEITE  ·  v1   (Nutzer 2026-10-18: „wir spielen mit LV und RV und LM und RM und LF und RF …
   das muss in beiden Spielen dasselbe sein“ – „ja ZOM bitte, ja wir nehmen −2, −8 und −12“)
   ─────────────────────────────────────────────────────────────────────────
   Wie Kickdraft (D95, dfl_position_patch.js + DFLGenerator): zwölf Positionen
     TW · IV · LV · RV · ZDM · ZM · LM · RM · ZOM · LF · RF · ST
   (vorher neun ohne Seite: AV, AM, FL, dazu OM/ZOM gemischt).
   · Abzug je Spieler und Platz – eine Zahl für Beste Elf, Teamstärke und Engine-Detailwerte:
     Stammposition 0 · gelernte 2./3. Position −2 · nicht gelernt nach Schritten über das Feld: benachbart −8,
     zwei Schritte −12 (z. B. andere Seite: LV–IV–RV), drei −18 · Torwart ↔ Feld −24.
   · Seite eines Platzes aus seiner Lage (Formations-Slot: Gruppe + x/y), wie Kickdraft.
   · Die Engine bekommt weiter ihre Rollen ohne Seite (AV, AM, FL, ZOM …) – die Seite kennt sie über die Koordinaten.
   · Kehrbesen: jeder Spieler ohne Seite (alte Spielstände, alte Erzeuger) bekommt eine – je Kader ausgeglichen, fest aus
     dem Spieler gesät; Flügel lernen LM/RM ihrer Seite (vorher zählten LM/RM-Plätze fast wie Flügel). Läuft beim Laden,
     jede Woche und vor dem Speichern.
   · Tabellen des Basisspiels (POS_INFO, Marktwert, Alterung, Taktik-Positionen …) kennen die neuen Kürzel wie ihre Gruppe.
   API: KSPos.POS12 · .grund(k) · .seiteVon(k) · .mitSeite(k, s) · .rolle(k) · .platz(slot) · .ausRolle(rolle, quer)
        · .abzug(p, platz) · .info(p, platz) · .wirksam(p, platz) · .zuordnen(plaetze, spieler) · .spieler(p, seite)
        · .kehren() · .elf()
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const POS12 = ['TW', 'IV', 'LV', 'RV', 'ZDM', 'ZM', 'LM', 'RM', 'ZOM', 'LF', 'RF', 'ST'];
  // Gruppe ohne Seite für die Tabellen des Basisspiels (Werte, Alterung, Preise …)
  const GRUND = { TW: 'TW', IV: 'IV', LV: 'AV', RV: 'AV', AV: 'AV', ZDM: 'ZDM', ZM: 'ZM', LM: 'AM', RM: 'AM', AM: 'AM',
    ZOM: 'ZOM', OM: 'ZOM', LF: 'FL', RF: 'FL', FL: 'FL', ST: 'ST' };
  const NORM = { DM: 'ZDM', OM: 'ZOM', LA: 'LF', RA: 'RF', MS: 'ST', HS: 'ST', LIB: 'IV' };
  const SEITE = { LV: 'L', LM: 'L', LF: 'L', RV: 'R', RM: 'R', RF: 'R' };
  const MIT_SEITE = { AV: ['LV', 'RV'], AM: ['LM', 'RM'], FL: ['LF', 'RF'] };
  // Altbestand ohne Seite: zählt bis zur Umstellung als beide Seiten (FL auch LM/RM wie bisher)
  const ALT = { AV: ['LV', 'RV'], AM: ['LM', 'RM'], FL: ['LF', 'RF', 'LM', 'RM'] };
  const norm = k => { if (!k) return null; k = String(k).toUpperCase(); return GRUND[k] ? (k === 'OM' ? 'ZOM' : k) : (NORM[k] || 'ZM'); };
  const grund = k => GRUND[norm(k)] || 'ZM';
  const seiteVon = k => SEITE[norm(k)] || null;
  const mitSeite = (k, s) => { const g = MIT_SEITE[grund(k)]; return g ? g[s === 'R' ? 1 : 0] : norm(k); };
  const ohneSeite = k => !!MIT_SEITE[norm(k)];
  // Rolle für die Engine (wie vor der Umstellung): AV, AM, FL, ZOM …
  const rolle = k => grund(k);

  // Wege über das Feld (wie Kickdraft D95)
  const KANTEN = [['IV', 'LV'], ['IV', 'RV'], ['IV', 'ZDM'], ['LV', 'LM'], ['RV', 'RM'], ['ZDM', 'ZM'], ['ZM', 'LM'], ['ZM', 'RM'], ['ZM', 'ZOM'],
    ['LM', 'LF'], ['RM', 'RF'], ['ZOM', 'LF'], ['ZOM', 'RF'], ['ZOM', 'ST'], ['LF', 'ST'], ['RF', 'ST']];
  const SCHRITTE = {};
  {
    const nb = {}; POS12.forEach(p => { nb[p] = []; }); KANTEN.forEach(([a, b]) => { nb[a].push(b); nb[b].push(a); });
    POS12.forEach(a => { const d = { [a]: 0 }, q = [a]; while (q.length) { const x = q.shift(); nb[x].forEach(y => { if (d[y] == null) { d[y] = d[x] + 1; q.push(y); } }); } SCHRITTE[a] = d; });
  }
  const CFG = { gelernt: 2, abstand: [0, 8, 12, 18], torwart: 24, aussenAb: 25, fluegelBisY: 36, gleichstand: 10000 };

  // ── Abzug (gleiche Rechnung wie DFLGenerator.positionsAbzug) ───────────────
  function positionsAbzug(liste, ziel) {
    ziel = ziel ? norm(ziel) : null;
    const ps = [];
    (liste || []).forEach(x => { if (x) { const n = norm(x); if (ps.indexOf(n) < 0) ps.push(n); } });
    if (!ziel || !ps.length) return { abzug: 0, art: 'stamm', platz: ziel };
    if (ALT[ziel]) return ALT[ziel].map(z => positionsAbzug(ps, z)).sort((a, b) => a.abzug - b.abzug)[0];
    let i = -1;
    for (let k = 0; k < ps.length && i < 0; k++) if (ps[k] === ziel || (ALT[ps[k]] && ALT[ps[k]].indexOf(ziel) >= 0)) i = k;
    if (i === 0) return { abzug: 0, art: 'stamm', platz: ziel };
    if (i > 0) return { abzug: CFG.gelernt, art: 'gelernt', platz: ziel, rang: i + 1 };
    if (ziel === 'TW' || ps.every(x => x === 'TW')) return { abzug: CFG.torwart, art: 'torwart', platz: ziel, feldImTor: ziel === 'TW' };
    let best = Infinity, von = ps[0];
    ps.forEach(x => (ALT[x] || [x]).forEach(y => { const d = SCHRITTE[y] && SCHRITTE[y][ziel]; if (d != null && d < best) { best = d; von = x; } }));
    const st = isFinite(best) ? best : CFG.abstand.length - 1;
    return { abzug: CFG.abstand[Math.min(st, CFG.abstand.length - 1)], art: 'fremd', platz: ziel, schritte: st, von };
  }
  const positionen = p => (p && p.positions && p.positions.length ? p.positions : (p && p.pos ? [p.pos] : []));

  // ── Platz eines Formations-Slots (Seite aus der Lage) ──────────────────────
  function platzAusSlot(s) {
    if (!s) return null;
    const g = String(s.group || '').toUpperCase(), l = String(s.label || '').toUpperCase();
    const x = isFinite(s.x) ? s.x : 50, y = isFinite(s.y) ? s.y : 50, aussen = Math.abs(x - 50) >= CFG.aussenAb;
    const seite = (li, re) => (x < 50 ? li : re);
    const breit = () => (y <= CFG.fluegelBisY ? seite('LF', 'RF') : seite('LM', 'RM'));
    if (g === 'TW') return 'TW';
    if (g === 'IV') return 'IV';
    if (g === 'AV') return seite('LV', 'RV');
    if (g === 'ST') return aussen ? seite('LF', 'RF') : 'ST';
    if (g === 'OM') return aussen ? breit() : 'ZOM';
    if (g === 'ZM') return l.indexOf('DM') >= 0 ? 'ZDM' : (aussen || l === 'LM' || l === 'RM') ? breit() : 'ZM';
    const r = window.TacticsSystem && TacticsSystem.slotToPos ? TacticsSystem.slotToPos(s) : (g || l);
    return MIT_SEITE[grund(r)] ? mitSeite(r, x < 50 ? 'L' : 'R') : norm(r);
  }
  const platz = z => (z && typeof z === 'object' ? platzAusSlot(z) : norm(z));
  // Rolle der Engine + Querlage (0 = links … 100 = rechts) → Platz mit Seite
  const ausRolle = (r, quer) => (MIT_SEITE[grund(r)] ? mitSeite(r, (isFinite(quer) ? quer : 50) < 50 ? 'L' : 'R') : norm(r));

  function info(p, ziel) { return positionsAbzug(positionen(p), platz(ziel)); }
  const abzug = (p, ziel) => info(p, ziel).abzug;
  const wirksam = (p, ziel) => Math.max(0, ((p && p.ovr) || 0) - abzug(p, ziel));

  // ── Beste Zuordnung (ungarische Methode, wie Kickdraft) ────────────────────
  function ungarisch(k) {
    const n = k.length, m = k[0].length, INF = 1e15;
    const u = new Array(n + 1).fill(0), v = new Array(m + 1).fill(0), p = new Array(m + 1).fill(0), weg = new Array(m + 1).fill(0);
    for (let i = 1; i <= n; i++) {
      p[0] = i; let j0 = 0;
      const minv = new Array(m + 1).fill(INF), benutzt = new Array(m + 1).fill(false);
      do {
        benutzt[j0] = true; const i0 = p[j0]; let delta = INF, j1 = 0;
        for (let j = 1; j <= m; j++) if (!benutzt[j]) {
          const c = k[i0 - 1][j - 1] - u[i0] - v[j];
          if (c < minv[j]) { minv[j] = c; weg[j] = j0; }
          if (minv[j] < delta) { delta = minv[j]; j1 = j; }
        }
        for (let j = 0; j <= m; j++) if (benutzt[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta;
        j0 = j1;
      } while (p[j0] !== 0);
      do { const j1 = weg[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
    }
    const aus = new Array(n).fill(-1);
    for (let j = 1; j <= m; j++) if (p[j]) aus[p[j] - 1] = j - 1;
    return aus;
  }
  const VERBOTEN = 1e6;
  // Je Platz der Index in `spieler` oder −1: größte Summe der wirksamen Stärke; Torwart ↔ Feld nie
  function zuordnen(plaetze, spieler) {
    const n = plaetze.length, m = spieler.length;
    if (!n) return [];
    if (!m) return plaetze.map(() => -1);
    const kosten = plaetze.map(z => {
      const zeile = spieler.map(q => { const a = abzug(q, z), o = (q && q.ovr) || 50; return a >= CFG.torwart ? VERBOTEN : -(o - a) + a * o / CFG.gleichstand; });
      for (let i = 0; i < n; i++) zeile.push(0);
      return zeile;
    });
    return ungarisch(kosten).map((j, i) => j >= 0 && j < m && kosten[i][j] < VERBOTEN ? j : -1);
  }
  const slots = () => (typeof FORMATIONS !== 'undefined' && typeof CLUB !== 'undefined' && CLUB && FORMATIONS[CLUB.formation]) || [];
  function elf() {
    return slots().map(s => { const id = CLUB.lineup && CLUB.lineup[s.id], p = id && typeof getPlayer === 'function' ? getPlayer(id) : null; return p ? { p, s, platz: platz(s) } : null; }).filter(Boolean);
  }

  // ── Kehrbesen: Spieler ohne Seite bekommen eine (je Kader ausgeglichen) ────
  function hash(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  const schluessel = p => String(p.id != null ? p.id : '') + '|' + (p.name || '') + '|' + (p.firstName || '') + '|' + (p.age || '');
  function brauchtSeite(p) {
    if (!p || typeof p !== 'object') return false;
    const l = positionen(p);
    return l.some(k => ohneSeite(k) || NORM[String(k).toUpperCase()]) || (p.pos && (ohneSeite(p.pos) || NORM[String(p.pos).toUpperCase()]));
  }
  // Einen Spieler auf Seite `s` stellen ('L'/'R'): alle Kürzel ohne Seite bekommen dieselbe Seite; Flügel lernen LM/RM der Seite
  function spieler(p, s, schlank) {
    // schlank (Auslandskader ohne positions-Feld, siehe euro_kader.js): nur pos mit Seite
    if (schlank && !Array.isArray(p.positions)) { p.pos = ohneSeite(p.pos) ? mitSeite(p.pos, s) : norm(p.pos); return p; }
    const alt = positionen(p).map(k => String(k).toUpperCase());
    const neu = [];
    alt.forEach(k => { const n = ohneSeite(k) ? mitSeite(k, s) : norm(k); if (neu.indexOf(n) < 0) neu.push(n); });
    if (!neu.length) neu.push(norm(p.pos) || 'ZM');
    const g0 = grund(neu[0]);
    if (g0 === 'FL' && neu.length < 3) { const lm = mitSeite('AM', s); if (neu.indexOf(lm) < 0) neu.push(lm); }
    if (g0 === 'AM' && neu.length < 3) { const lf = mitSeite('FL', s); if (neu.indexOf(lf) < 0) neu.push(lf); }
    p.positions = neu.slice(0, 3);
    p.pos = p.positions[0];
    try { delete p._werte; delete p._werteAlt; } catch (e) { /* Cache der Detailwerte */ }
    return p;
  }
  // Ein Kader (Array): je Gruppe (AV/AM/FL) nach Stärke abwechselnd links/rechts, Start fest aus dem Kader gesät
  function kaderKehren(liste, saat, schlank) {
    if (!Array.isArray(liste)) return 0;
    const offen = liste.filter(brauchtSeite);
    if (!offen.length) return 0;
    const zaehler = {};
    liste.forEach(p => { if (p && !brauchtSeite(p)) { const s = seiteVon(positionen(p)[0]), g = grund(positionen(p)[0]); if (s) { zaehler[g] = zaehler[g] || { L: 0, R: 0 }; zaehler[g][s]++; } } });
    offen.slice().sort((a, b) => (b.ovr || 0) - (a.ovr || 0)).forEach(p => {
      const k0 = positionen(p)[0] || p.pos, g = grund(k0);
      let s;
      if (MIT_SEITE[g]) {
        const z = zaehler[g] = zaehler[g] || { L: 0, R: 0 };
        s = z.L < z.R ? 'L' : z.R < z.L ? 'R' : ((hash(schluessel(p) + (saat || '')) & 1) ? 'R' : 'L');
        z[s]++;
      } else s = (hash(schluessel(p) + (saat || '')) & 1) ? 'R' : 'L';
      spieler(p, s, schlank);
    });
    return offen.length;
  }
  // Alle Spieler-Behälter des Spiels
  function kehren() {
    let n = 0;
    try {
      if (typeof SQUAD !== 'undefined' && Array.isArray(SQUAD)) {
        // Wer schon in der Elf steht, bekommt die Seite seines Platzes (LV-Platz → LV), der Rest ausgeglichen
        slots().forEach(sl => {
          const id = CLUB.lineup && CLUB.lineup[sl.id], p = id ? SQUAD.find(q => q && q.id === id) : null, z = platzAusSlot(sl), si = seiteVon(z);
          if (p && si && brauchtSeite(p) && MIT_SEITE[grund(positionen(p)[0])]) { spieler(p, si); n++; }
        });
        n += kaderKehren(SQUAD, 'eigen');
      }
      if (typeof MARKET !== 'undefined' && MARKET && Array.isArray(MARKET.players)) n += kaderKehren(MARKET.players, 'markt');
      if (typeof CLUB !== 'undefined' && CLUB) {
        if (CLUB.npcSquads) Object.keys(CLUB.npcSquads).forEach(k => { n += kaderKehren(CLUB.npcSquads[k], k); });
        if (CLUB.euroKader) Object.keys(CLUB.euroKader).forEach(k => { n += kaderKehren(CLUB.euroKader[k], k, true); });
        ['youthProspects', 'freeAgents', 'scoutedPlayers'].forEach(k => { if (Array.isArray(CLUB[k])) n += kaderKehren(CLUB[k], k); });
        const ak = CLUB.welt && CLUB.welt.akademien;
        if (ak) Object.keys(ak).forEach(k => { if (ak[k] && Array.isArray(ak[k].talente)) n += kaderKehren(ak[k].talente, 'ak' + k); });
        // Scouting-Fokus alter Stände (AV/OM/FL) auf die Gruppen mit Seite
        const sc = CLUB.welt && CLUB.welt.ksScout, FOKUS = { AV: 'LV/RV', OM: 'ZOM', FL: 'LF/RF' };
        if (sc && Array.isArray(sc.fokus)) sc.fokus = sc.fokus.map(k => FOKUS[k] || k).filter((k, i, a) => a.indexOf(k) === i);
        if (Array.isArray(CLUB.watchlist)) CLUB.watchlist.forEach(w => { if (w && ohneSeite(w.pos)) w.pos = mitSeite(w.pos, (hash(w.id) & 1) ? 'R' : 'L'); });
      }
      if (window.FreeAgents && typeof FreeAgents.pool === 'function') { const pl = FreeAgents.pool(); if (Array.isArray(pl)) n += kaderKehren(pl, 'fa'); }
    } catch (e) { console.warn('[KS-Positionen] Kehren', e); }
    return n;
  }

  // ── Tabellen des Basisspiels um die neuen Kürzel ergänzen ──────────────────
  function tabellen() {
    const alias = (t, aus) => { if (!t) return; Object.keys(GRUND).forEach(k => { if (t[k] == null) { const g = GRUND[k], q = aus ? aus(k, g) : g; if (t[q] != null) t[k] = t[q]; } }); };
    try {
      if (typeof POS_LIST !== 'undefined' && Array.isArray(POS_LIST)) POS_LIST.splice(0, POS_LIST.length, ...POS12);
      if (typeof POS_INFO !== 'undefined') {
        const N = { IV: ['LV', 'RV', 'ZDM', 'ZM'], LV: ['IV', 'LM', 'ZDM'], RV: ['IV', 'RM', 'ZDM'], ZDM: ['IV', 'ZM', 'LV', 'RV'], ZM: ['ZDM', 'ZOM', 'LM', 'RM'],
          LM: ['LV', 'ZM', 'LF'], RM: ['RV', 'ZM', 'RF'], ZOM: ['ZM', 'ST', 'LF', 'RF'], LF: ['LM', 'ZOM', 'ST'], RF: ['RM', 'ZOM', 'ST'], ST: ['ZOM', 'LF', 'RF'] };
        Object.keys(GRUND).forEach(k => { if (!POS_INFO[k] && POS_INFO[GRUND[k]]) POS_INFO[k] = { area: POS_INFO[GRUND[k]].area, neighbors: [] }; });
        Object.keys(N).forEach(k => { if (POS_INFO[k] && !(POS_INFO[k].neighbors || []).some(x => POS12.indexOf(x) >= 0 && SEITE[x])) POS_INFO[k].neighbors = N[k].slice(); });
      }
      if (typeof POS_VALUE_FACTOR !== 'undefined') alias(POS_VALUE_FACTOR);
      if (typeof ALTERUNG !== 'undefined') alias(ALTERUNG);
      const T = window.TacticsSystem;
      if (T && T.POSITIONS) {
        const NAMEN = { LV: 'Linker Verteidiger', RV: 'Rechter Verteidiger', LM: 'Linkes Mittelfeld', RM: 'Rechtes Mittelfeld', LF: 'Linker Flügel', RF: 'Rechter Flügel' };
        Object.keys(NAMEN).forEach(k => { if (!T.POSITIONS[k]) { const g = T.POSITIONS[GRUND[k]] || {}; T.POSITIONS[k] = { label: k, name: NAMEN[k], area: g.area || 'MID', row: g.row != null ? g.row : 2 }; } });
        if (T.POS_NEIGHBORS) {
          const NB = { LV: ['IV', 'ZDM', 'LM'], RV: ['IV', 'ZDM', 'RM'], LM: ['LV', 'ZM', 'LF', 'ZOM'], RM: ['RV', 'ZM', 'RF', 'ZOM'], LF: ['LM', 'ZOM', 'ST'], RF: ['RM', 'ZOM', 'ST'] };
          Object.keys(NB).forEach(k => { if (!T.POS_NEIGHBORS[k]) T.POS_NEIGHBORS[k] = NB[k]; });
        }
        if (Array.isArray(T.POS_KEYS)) POS12.forEach(k => { if (T.POS_KEYS.indexOf(k) < 0) T.POS_KEYS.push(k); });
      }
    } catch (e) { console.warn('[KS-Positionen] Tabellen', e); }
  }
  tabellen();

  // ── Funktionen des Basisspiels, die nach Positionskürzel verzweigen: Gruppe übergeben ─────────
  // (alte Zweige: AV, OM, ST …; AM/FL fallen dort wie bisher in den Angreifer-Zweig)
  const fuerAlt = k => { const g = grund(k); return g === 'ZOM' ? 'OM' : g; };
  ['genAttributes', 'areasForPos', 'paceForPos'].forEach(n => {
    const _o = window[n]; if (typeof _o !== 'function') return;
    window[n] = function (pos) { const a = Array.prototype.slice.call(arguments); a[0] = fuerAlt(pos); return _o.apply(this, a); };
    try { if (n === 'genAttributes') genAttributes = window[n]; else if (n === 'areasForPos') areasForPos = window[n]; else paceForPos = window[n]; } catch (e) { /* window reicht */ }
  });

  // ── Teamstärke: wirksame Stärke (Stärke − Abzug) wie Kickdraft ─────────────
  {
    const _orig = window.computeTeamRatings;
    if (typeof _orig === 'function') {
      window.computeTeamRatings = function () {
        const r = _orig.apply(this, arguments);
        try {
          if (!r || typeof r !== 'object') return r;
          const e = elf(); if (!e.length) return r;
          const s = { o: 0, ow: 0, a: 0, aw: 0, d: 0, dw: 0 };
          e.forEach(x => { const z = abzug(x.p, x.platz); s.o += x.p.ovr || 0; s.ow += Math.max(0, (x.p.ovr || 0) - z); s.a += x.p.att || 0; s.aw += Math.max(0, (x.p.att || 0) - z); s.d += x.p.def || 0; s.dw += Math.max(0, (x.p.def || 0) - z); });
          const cap = v => Math.round(Math.max(30, Math.min(95, v)));
          if (s.o > 0 && typeof r.overall === 'number') r.overall = cap(r.overall * s.ow / s.o);
          if (s.a > 0 && typeof r.attack === 'number') r.attack = cap(r.attack * s.aw / s.a);
          if (s.d > 0 && typeof r.defense === 'number') r.defense = cap(r.defense * s.dw / s.d);
        } catch (err) { console.warn('[KS-Positionen] Teamstärke', err); }
        return r;
      };
      try { computeTeamRatings = window.computeTeamRatings; } catch (e) { /* window reicht */ }
    }
  }

  // ── Detailwerte der Engine (player_attributes.js): derselbe Abzug wie Teamstärke und Beste Elf ──
  if (window.SpielerAttribute) window.SpielerAttribute.abzugHaken = (p, pos) => abzug(p, pos);

  // ── Anzeige (wie Kickdraft DFLPosition): Marke „−2“ auf dem Feld, in der Startelf-Liste und im Spieler-Blatt ──
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const basisOvr = p => (typeof ovrBase === 'function' ? ovrBase(p) : (p && p.ovr) || 0);
  const klasse = a => a <= CFG.gelernt ? 'gelernt' : a >= CFG.torwart ? 'torwart' : 'fremd';
  const spielerVon = id => (id && typeof getPlayer === 'function' ? getPlayer(id) : null);
  function warum(i) {
    if (i.art === 'gelernt') return i.rang === 2 ? '2. Position' : i.rang === 3 ? '3. Position' : 'gelernte Position';
    if (i.art === 'torwart') return i.feldImTor ? 'Feldspieler im Tor' : 'Torwart im Feld';
    if (i.art === 'fremd') return i.schritte === 1 ? `nicht gelernt, neben ${i.von}` : `nicht gelernt, ${i.schritte} Schritte von ${i.von}`;
    return 'Stammposition';
  }
  function badge(p, ziel) {
    if (!p) return '';
    const i = info(p, ziel); if (!i.abzug) return '';
    const o = basisOvr(p);
    return `<em class="dfl-abz ${klasse(i.abzug)}" title="Als ${esc(i.platz)}: ${o} (−${i.abzug}) → ${o - i.abzug} · ${esc(warum(i))}">−${i.abzug}</em>`;
  }
  const slotVon = id => slots().find(s => CLUB.lineup && CLUB.lineup[s.id] === id) || null;
  function blattHtml(p, kontext) {
    if (!p || p.perspektiv || typeof CLUB === 'undefined' || !CLUB.lineup) return '';
    const s = kontext && kontext.typ === 'slot' ? slots().find(x => x.id === kontext.key) : slotVon(p.id);
    if (!s || CLUB.lineup[s.id] !== p.id) return '';
    const i = info(p, platz(s)), o = basisOvr(p);
    if (!i.abzug) return `<div class="dfl-abz-zeile">In der Elf als <b>${esc(i.platz)}</b> · Stammposition</div>`;
    return `<div class="dfl-abz-zeile">In der Elf als <b>${esc(i.platz)}</b>: ${o} (<em class="dfl-abz-t ${klasse(i.abzug)}">−${i.abzug}</em>) → <b>${o - i.abzug}</b> · ${esc(warum(i))}</div>`;
  }
  function markeSetzen(ovrEl, html) {
    if (!ovrEl || !html || ovrEl.querySelector('.dfl-abz')) return;
    const pot = ovrEl.querySelector('.squad-pot');
    if (pot) pot.insertAdjacentHTML('beforebegin', html); else ovrEl.insertAdjacentHTML('beforeend', html);
  }
  function feldZeichnen() {
    const els = document.querySelectorAll('#pitch .p-slot');
    slots().forEach((s, i) => {
      const el = els[i], p = el && spielerVon(CLUB.lineup[s.id]); if (!p) return;
      const ov = el.querySelector('.p-ovr');
      if (ov && !ov.querySelector('.dfl-abz')) ov.insertAdjacentHTML('beforeend', badge(p, platz(s)));
    });
  }
  function startelfListe() {
    document.querySelectorAll('#squad-list .squad-row').forEach(row => {
      const m = /clickSlot\('([^']+)'\)/.exec(row.getAttribute('onclick') || '');
      const s = m && slots().find(x => x.id === m[1]); if (!s) return;
      const p = spielerVon(CLUB.lineup[s.id]);
      if (p) markeSetzen(row.querySelector('.squad-ovr'), badge(p, platz(s)));
    });
  }
  [['renderPitch', feldZeichnen], ['renderSquadList', startelfListe]].forEach(([fn, nach]) => {
    const _o = window[fn]; if (typeof _o !== 'function') return;
    window[fn] = function () { const r = _o.apply(this, arguments); try { nach(); } catch (e) { console.warn('[KS-Positionen] Anzeige', fn, e); } return r; };
    try { if (fn === 'renderPitch') renderPitch = window[fn]; else renderSquadList = window[fn]; } catch (e) { /* window reicht */ }
  });

  // ── Kehren: beim Laden, je Woche, vor dem Speichern ────────────────────────
  const nachLaden = () => { const n = kehren(); if (n) console.log(`[KS-Positionen] ${n} Spieler auf Positionen mit Seite umgestellt`); return n; };
  {
    const _a = window.applyLoadedState;
    if (typeof _a === 'function') { window.applyLoadedState = function () { const r = _a.apply(this, arguments); try { nachLaden(); } catch (e) { /* später */ } return r; }; try { applyLoadedState = window.applyLoadedState; } catch (e) { /* window */ } }
    const _w = window.advanceCalendarWeek;
    if (typeof _w === 'function') { window.advanceCalendarWeek = function () { const r = _w.apply(this, arguments); try { kehren(); } catch (e) { /* später */ } return r; }; try { advanceCalendarWeek = window.advanceCalendarWeek; } catch (e) { /* window */ } }
    const _s = window.saveGameState;
    if (typeof _s === 'function') { window.saveGameState = function () { try { kehren(); } catch (e) { /* trotzdem speichern */ } return _s.apply(this, arguments); }; try { saveGameState = window.saveGameState; } catch (e) { /* window */ } }
  }
  setTimeout(nachLaden, 0); setTimeout(nachLaden, 2500);

  window.KSPos = { POS12, CFG, GRUND, norm, grund, seiteVon, mitSeite, ohneSeite, rolle, platz, platzAusSlot, ausRolle, positionsAbzug, positionen,
    info, abzug, wirksam, zuordnen, ungarisch, elf, spieler, kaderKehren, kehren, badge, blattHtml, aktiv: () => true };
  // Gemeinsame Bausteine aus Kickdraft fragen DFLPosition (Spieler-Blatt, Feldfarben in dfl_auswahl.js): in Flutlicht dasselbe Modul
  if (!window.DFLPosition) window.DFLPosition = window.KSPos;
  console.log('[KS-Positionen v1] aktiv — zwölf Positionen mit Seite (LV/RV, LM/RM, LF/RF, ZOM), Abzug −2/−8/−12, Kehrbesen für alte Stände');
})();
