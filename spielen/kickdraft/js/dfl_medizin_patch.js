/* ═══════════════════════════════════════════════════════════════════════════
   DFL · VERLETZUNGEN UND MEDIZIN  ·  v1   (D102, Nutzer 2026-10-10: „Mit 21 Spielern mindestens hat man fast zu viele, oder man
   muss mehr Verletzungen und längere reinbringen. Dafür dynamischer mit Verbesserungen nach Verletzungen arbeiten …“ und „Bitte
   noch eine medizinische Abteilung reinbringen …“; freigegeben mit „arbeite alles in die App ein“, Vorschau dfl_medizin_vorschau.html)
   ─────────────────────────────────────────────────────────────────────────
   Gleiche Regeln für alle 32 Vereine – alle Zahlen in DFLSaison.CFG.verletzung (dfl_saisonlauf.js), dort rechnet auch die Welt:
   • Eigener Verein: 5 % je Startelf-Spieler und Pflichtspiel (Testspiele 60 %), Training 1,4 % je Woche (Vorbereitung 1,7 %,
     Intensität leicht ×0,5, intensiv ×2), 15 Arten (Ø 4,8 Wochen), Bremse ab 5 Verletzten, Körperalter über 29 erhöht Risiko
     und Dauer, müde Spieler (Fitness unter 80) verletzen sich eher. Statt der 18-%-Regel in processFixtureResult (app_main.js) und
     der Trainingsblessuren (bundle_squad.js, bundle_match.js): beide laufen weiter, ihr Risiko ist während des Aufrufs 0.
   • Eine Spielverletzung zählt ab dem nächsten Spiel – „1 Woche“ = 1 verpasstes Spiel (bis D102 heilte sie vorher aus).
   • Rückkehr mit Rückstand (p.reha): halbe Ausfallwochen ab 3 Wochen, höchstens −8; je Woche −1, je Einsatz in der Startelf −0,5
     zusätzlich (bis 23 ×1,2, ab Körperalter 31 ×0,8, Medizin +6 % je Stufe). Zählt wie ein Positionsabzug (DFLPosition: Anzeige,
     Teamstärke, Beste Elf, Detailwerte in der Engine). Bleibender Rest nur nach mindestens 12 Wochen.
   • Sommerpause heilt 12 Wochen, der Rest läuft in die neue Saison (vorher heilte applyEndOfSeasonClubEffects alles).
   • Medizinische Abteilung Stufe 1–10 als Anlage (FACILITY_DEFS.medizin, CLUB.facilities.medizin; Start: Ø Training/Scouting − 1):
     Preise 75 % des Trainingsgeländes, Bauzeit wie Training; Karte unter Verein & Stadion, Office-Kachel „Medizin“ mit Blatt.
   • KI im Spiel (Welt): jede Woche heilen, Training, Testspiele (Woche 2–4), Playoff-Spiele; je Spieltag die Stärke aus der
     verfügbaren Elf (vor den KI-Spielen), danach Spielverletzungen; ab 8 Wochen Verletztenliste + Ersatz aus den Vereinslosen.
   • Meldungen mit Art, Dauer, verpassten Spieltagen, Rückkehr, Rückstand und dem, was die Medizin ausgemacht hat.
   • Kaderliste: „einsatzfähig x von 28“ mit 21er-Marke, Reha-Marke (Filter „Verletzt“ kommt von den Ampeln, dfl_blick_patch.js);
     Spieler-Blatt mit Prognose und Kurve.
   API: DFLMedizin.stufe() · .rueckstand(p) · .prognose(p) · .blatt() · .kachel() · .blattHtml(p) · .verletze(p, quelle)
        · .kiWoche() · .statistik() · .CFG
   Lädt nach dfl_textspiel_patch.js (außen um processFixtureResult, advanceMatchday, advanceCalendarWeek, healInjuriesOneWeek,
   applyEndOfSeasonClubEffects, TrainingSystem.weeklyTrainingTick, renderClubTab, renderSquadOverview, spielerWerte), vor init_bootstrap.js.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const S = window.DFLSaison, Gen = window.DFLGenerator, D = window.DFLSpiel, F = window.DFLFinanzen;
  if (!S || !S.CFG || !S.CFG.verletzung || !S.wuerfleVerletzung || !Gen || !D || !F) { console.warn('[DFL-Medizin] DFL-Module fehlen – Patch inaktiv'); return; }
  // D118: Athletik & Physio des eigenen Trainerteams (Risiko, Reha) – ohne Modul 0
  const phys = () => { try { return window.DFLTrainerteam ? DFLTrainerteam.sterne('physio') : 0; } catch (e) { return 0; } };
  const C = () => S.CFG.verletzung;
  const CFG = {
    intensitaet: { leicht: 0.5, normal: 1, intensiv: 2 },   // Trainingsrisiko je Intensität (bis D102: 0,2 / 0,6 / 2,0 % + Überlastung)
    fitness: { ab: 80, je: 0.018 },                         // wie verletzungsRisikoFaktor: bei Fitness 40 rund ×1,7
    vlAb: 4,                                                // Verletztenliste ab 4 Wochen (DFLTraining)
    kiMeldungAb: 8,                                         // KI: Langzeitausfall eines ihrer 3 Besten als Meldung
    stufen: ['Mannschaftsarzt', 'Physio-Raum', 'Reha-Raum', 'Medizinisches Team', 'Reha-Zentrum', 'Sportmedizinisches Zentrum',
      'Diagnostik-Zentrum', 'Präventionslabor', 'Leistungsdiagnostik-Campus', 'Medizinisches Hochleistungszentrum']
  };
  const dfl = () => typeof CLUB !== 'undefined' && CLUB && CLUB.dfl && CLUB.dfl.aktiv && typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.dfl;
  const aktiv = () => !!dfl() && !!C().aktiv;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const name = p => (typeof displayName === 'function' ? displayName(p) : ((p.firstName ? p.firstName.charAt(0) + '. ' : '') + p.name));
  const voll = p => ((p.firstName ? p.firstName + ' ' : '') + (p.name || '')).trim();
  const geld = x => (typeof formatEuro === 'function' ? formatEuro(x) : (Math.round((x || 0) / 1e5) / 10).toLocaleString('de-DE') + ' Mio €');
  const zahl = (x, d) => Number(x).toLocaleString('de-DE', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  const wo = n => n + ' Woche' + (n === 1 ? '' : 'n');
  const zufall = Object.assign(() => Math.random(), { int: (a, b) => a + Math.floor(Math.random() * (b - a + 1)) });
  const kader = () => (typeof SQUAD !== 'undefined' && Array.isArray(SQUAD) ? SQUAD : []);
  const verletzt = p => !!(p && p.injuryWeeks > 0);
  const mittel = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;

  // ── Formationen und Stile der Welt = die des Spiels (Plätze wie DFLPosition, Zahlen wie D81) ───────────────
  function abgleichen() {
    try {
      const P = window.DFLPosition;
      if (typeof FORMATIONS !== 'undefined' && P && P.platz) {
        Object.keys(FORMATIONS).forEach(f => {
          const plaetze = (FORMATIONS[f] || []).map(s => Gen.dflPos(P.platz(s) || 'ZM'));
          if (plaetze.length === 11) S.CFG.formationen[f] = plaetze;
        });
      }
      const T = window.DFLTaktik;
      if (T && T.STILE) Object.keys(T.STILE).forEach(st => {
        const liste = (T.STILE[st].formationen || []).filter(f => S.CFG.formationen[f]);
        if (liste.length) S.CFG.stilFormationen[st] = liste;
      });
      if (P && P.CFG) Object.assign(S.CFG.staerke, { gelernt: P.CFG.gelernt, abstand: P.CFG.abstand.slice(), torwart: P.CFG.torwart });
    } catch (e) { console.warn('[DFL-Medizin] Formationen abgleichen', e); }
  }
  abgleichen();

  // ── Medizinische Abteilung als Anlage ────────────────────────────────────
  if (typeof FACILITY_DEFS !== 'undefined' && FACILITY_DEFS && !FACILITY_DEFS.medizin) {
    FACILITY_DEFS.medizin = { name: 'Medizinische Abteilung', icon: '<i class="ti ti-first-aid-kit" aria-hidden="true"></i>', iconClass: 'medizin', maxLevel: 10,
      desc: 'Weniger, kürzere und leichtere Verletzungen.',
      levelDesc: CFG.stufen.slice(), cost: F.ausbauPreise('medizin') };
  }
  function startStufe() {
    let a = null;
    try { const f = D.franchise('fcm'); a = f && f.anlagen; } catch (e) { a = null; }
    return S.medizinStart(a || (typeof CLUB !== 'undefined' && CLUB && CLUB.facilities) || {});
  }
  function stufe() {
    if (typeof CLUB === 'undefined' || !CLUB) return 1;
    CLUB.facilities = CLUB.facilities || {};
    if (!(CLUB.facilities.medizin >= 1)) CLUB.facilities.medizin = startStufe();
    return Math.max(1, Math.min(10, CLUB.facilities.medizin));
  }
  // Wirkung einer Stufe gegenüber Stufe 1 in Prozent
  function wirkung(s) {
    const M = C().med, k = Math.max(0, s - 1);
    return { risiko: Math.round(M.risiko * k * 100), dauer: Math.round(M.dauer * k * 1000) / 10, schwer: Math.round(M.schwer * k * 100),
      reha: Math.round(M.reha * k * 100), rest: Math.round(M.rest * k * 100) };
  }
  const faktorStufe = k => (1 - C().med.risiko * (k - 1)) * (1 - C().med.dauer * (k - 1));

  // ── Saisonzähler des eigenen Vereins ─────────────────────────────────────
  function statistik() {
    const s = LEAGUE.season;
    let z = CLUB.dfl.medizin;
    if (!z || z.saison !== s) {
      const vor = z ? (z.saison === s - 1 ? { n: z.n, wochen: z.wochen } : z.vorjahr || null) : null;
      z = CLUB.dfl.medizin = { saison: s, n: 0, wochen: 0, lang: 0, rest: 0, gespart: 0, gemildert: 0, vorjahr: vor };
    }
    return z;
  }
  // Ausfallwochen im Liga-Schnitt (KI, laufende Saison) und je Saison (für die erwartete Wirkung des Ausbaus)
  function ligaSchnitt() {
    try {
      const L = D.liga(), e = D.eigeneDflId(), ts = L.teams.filter(t => t.id !== e);
      const verlauf = [].concat(...ts.map(t => t.ausfallVerlauf || []));
      return { wochen: mittel(ts.map(t => (t.verl && t.verl.wochen) || 0)), n: mittel(ts.map(t => (t.verl && t.verl.n) || 0)), jeSaison: verlauf.length ? mittel(verlauf) : null };
    } catch (e) { return null; }
  }
  function wochenJeSaison() {
    const z = statistik(), l = ligaSchnitt();
    return (z.vorjahr && z.vorjahr.wochen) || (l && l.jeSaison) || 110;
  }
  const ersparnis = s => s >= 10 ? 0 : Math.round(wochenJeSaison() * (1 - faktorStufe(s + 1) / faktorStufe(s)));

  // ── Risiko und Verletzung (eigener Verein) ───────────────────────────────
  let stumm = 0;          // > 0: die alten Regeln (18 % je Spiel, Trainingsblessuren, Überlastung) würfeln ins Leere
  const offen = () => kader().filter(p => !p.perspektiv && !p.onLoanAt && verletzt(p)).length;
  function risiko(p) {
    let f = S.risikoFaktor(p, stufe(), offen(), phys());
    const fit = typeof p.fitness === 'number' ? p.fitness : 95;
    if (fit < CFG.fitness.ab) f *= 1 + (CFG.fitness.ab - fit) * CFG.fitness.je;
    return f;
  }
  {
    const _orig = window.verletzungsRisikoFaktor;
    if (typeof _orig === 'function') window.verletzungsRisikoFaktor = function (p) {
      if (!aktiv()) return _orig.apply(this, arguments);
      return stumm > 0 ? 0 : risiko(p);
    };
  }
  // Welche Ligaspieltage verpasst ein Verletzter? Training: ab dieser Woche; Spiel: ab der nächsten (zählt ab dem nächsten Spiel)
  function verpasst(p) {
    const w = p.injuryWeeks || 0, ab = (LEAGUE.week || 1) + (p.injuryFrisch ? 1 : 0), bis = ab + w - 1;
    const mw = Array.isArray(LEAGUE.matchWeeks) ? LEAGUE.matchWeeks : [], tage = [];
    mw.forEach((wk, i) => { if (i >= (LEAGUE.matchday || 0) && wk >= ab && wk <= bis) tage.push(i + 1); });
    const naechster = mw.findIndex((wk, i) => i >= (LEAGUE.matchday || 0) && wk > bis);
    return { tage, zurueck: naechster >= 0 ? naechster + 1 : null, zurueckWoche: bis + 1 };
  }
  const tageText = t => t.length ? 'Spieltag ' + t[0] + (t.length > 1 ? '–' + t[t.length - 1] : '') : '';
  function melden(p, v, quelle) {
    if (typeof addNews !== 'function') return;
    const vp = verpasst(p), med = stufe(), R = S.rehaStartWert(v.wochen);
    const wann = { spiel: 'Im Spiel', test: 'Im Testspiel', training: 'Im Training' }[quelle] || 'Erneut';
    const teile = [`${wann} verletzt. Fällt ${wo(v.wochen)} aus${vp.tage.length ? ' und verpasst ' + tageText(vp.tage) : ''}.`];
    const zurueck = !vp.tage.length ? 'Verpasst kein Ligaspiel' : vp.zurueck ? `Zurück zu Spieltag ${vp.zurueck}`
      : (LEAGUE.matchday || 0) >= ((LEAGUE.matchWeeks || []).length || 26) ? 'Zurück nach der Sommerpause' : 'Zurück nach dem letzten Spieltag';
    if (R > 0) {
      const mit = Math.max(1, Math.ceil(R / (S.rehaTempo(p, med, phys()) * (1 + C().reha.spiel)) - 1e-9));
      teile.push(`${zurueck}, danach Rückstand −${R}: mit Einsatz etwa ${wo(mit)} bis ${p.ovr}.`);
    } else teile.push(zurueck + '.');
    if (v.gemildert) teile.push(`Medizin Stufe ${med}: Der Verdacht auf ${v.gemildert} hat sich nicht bestätigt.`);
    else if (v.ohneMedizin > v.wochen) { const d = v.ohneMedizin - v.wochen; teile.push(`Medizin Stufe ${med}: ${d === 1 ? 'eine Woche' : d + ' Wochen'} kürzer.`); }
    if (v.wochen >= C().rest.ab) teile.push('Nach so langer Pause kann etwas zurückbleiben.');
    if (v.wochen >= CFG.vlAb && window.DFLTraining && DFLTraining.aufVerletztenliste) teile.push('Ab 4 Wochen ist die Verletztenliste möglich (Kaderplatz frei).');
    addNews(quelle === 'training' ? 'training' : 'match', `${v.wochen >= 10 ? 'Schwere Verletzung' : 'Verletzung'}: ${name(p)} · ${v.typ}`, teile.join(' '));
  }
  function verletze(p, quelle) {
    if (!p) return null;
    const med = stufe(), v = S.wuerfleVerletzung(zufall, p, med);
    p.injuryWeeks = v.wochen; p.injuryType = v.typ; p.injuryTotal = v.wochen;
    if (quelle === 'spiel' || quelle === 'test') p.injuryFrisch = true; else delete p.injuryFrisch;
    // Verletzungsanfälligkeit zeigt sich erst beim zweiten Mal (wie injurePlayer); nach langer Pause ist niemand bei Kräften
    p._verletzungen = (p._verletzungen || 0) + 1;
    if (p._verletzungen >= 2 && typeof window.traitAufdecken === 'function') {
      window.traitAufdecken(p, 'verletzungsanfaellig', 'Schon die ' + p._verletzungen + '. Verletzung — das ist kein Zufall mehr.');
    }
    if (v.wochen >= 10 && typeof p.fitness === 'number') p.fitness = Math.min(p.fitness, 55);
    const z = statistik();
    z.n++; z.wochen += v.wochen; if (v.wochen >= 10) z.lang++; z.gespart += Math.max(0, v.ohneMedizin - v.wochen); if (v.gemildert) z.gemildert++;
    melden(p, v, quelle);
    // Rückmeldung 17.10.: ab 11 Wochen Diagnose-Karte mit dem Angebot der Wunderheilung (dfl_wunder_patch.js)
    try { if (window.DFLWunder) DFLWunder.anbieten(p, v); } catch (e) { /* optional */ }
    return v;
  }
  // Rückkehr: Rückstand setzen, bleibender Rest nach langen Ausfällen, Meldung
  function rueckkehr(p, still) {
    const w = p.injuryTotal || 0, med = stufe();
    const R = Math.max(S.rehaStartWert(w), p.reha || 0);
    delete p.injuryTotal; delete p.injuryFrisch;
    if (R > 0) { p.reha = R; p.rehaStart = Math.max(R, p.rehaStart || 0); } else { delete p.reha; delete p.rehaStart; }
    const rest = S.bleibenderRest(zufall, p, w, med);
    if (rest) {
      ['def', 'mid', 'att'].forEach(k => { p[k] = Math.max(20, (p[k] || 50) - rest.ovr); });
      if (typeof computeOvrFromAreas === 'function') p.ovr = computeOvrFromAreas(p);
      p.truePotential = Math.max(p.ovr, (p.truePotential || p.ovr) - rest.pot);
      statistik().rest++;
    }
    if (!still && (R > 0 || rest) && typeof addNews === 'function') {
      const mit = R > 0 ? Math.max(1, Math.ceil(R / (S.rehaTempo(p, med, phys()) * (1 + C().reha.spiel)) - 1e-9)) : 0;
      addNews('training', `Zurück: ${name(p)}`, `${voll(p)} ist wieder einsatzfähig` + (R > 0 ? `, aber noch nicht bei 100 %: Rückstand −${zahl(R)}, mit Einsatz in etwa ${wo(mit)} wieder bei ${p.ovr}.` : '.') +
        (rest ? ` Ein Rest bleibt: −${rest.ovr} Stärke${rest.pot !== rest.ovr ? `, Potenzial −${rest.pot}` : ''}.` : ''));
    }
    return { R, rest };
  }
  {
    const _orig = window.injurePlayer;
    if (typeof _orig === 'function') window.injurePlayer = function (p) {
      if (!aktiv() || !p) return _orig.apply(this, arguments);
      const v = verletze(p, 'sonst');
      return v ? { name: name(p), type: v.typ, weeks: v.wochen, schwer: v.wochen >= 10 } : null;
    };
  }
  // Rückstand eines eigenen Spielers (für DFLPosition: zählt wie ein Abzug)
  const rueckstand = p => (aktiv() && p && p.reha > 0 && !verletzt(p) ? p.reha : 0);

  // ── Woche: heilen (Spielverletzung erst nach dem nächsten Spiel), Rückkehr, Rückstand ──────────────────
  {
    const _orig = window.healInjuriesOneWeek;
    if (typeof _orig === 'function') window.healInjuriesOneWeek = function () {
      if (!aktiv()) return _orig.apply(this, arguments);
      const K = kader();
      K.forEach(p => { if (p.injuryFrisch) { if (p.injuryWeeks > 0) p.injuryWeeks++; delete p.injuryFrisch; } });
      const vorher = K.filter(verletzt), reha = K.filter(p => !verletzt(p) && p.reha > 0);
      const zurueck = _orig.apply(this, arguments) || [];
      const med = stufe(), eigeneMeldung = new Set();
      vorher.forEach(p => { if (!verletzt(p)) { const z = rueckkehr(p); if (z.R > 0 || z.rest) eigeneMeldung.add(name(p)); } });
      reha.forEach(p => S.rehaSchritt(p, S.rehaTempo(p, med, phys())));
      return zurueck.filter(n => !eigeneMeldung.has(n));
    };
  }

  // ── Spiel: Verletzungen je Startelf-Spieler (statt 18 % für einen zufälligen) ─────────────────────────
  function spielVerletzungen(elf, art) {
    const med = stufe(), faktor = art === 'test' ? C().test : 1;
    let n = 0;
    elf.forEach(p => {
      if (!p || verletzt(p) || p.perspektiv) return;
      if (p.reha > 0) S.rehaSchritt(p, C().reha.spiel * S.rehaTempo(p, med, phys()));
      if (Math.random() < C().spiel * faktor * risiko(p)) { verletze(p, art === 'test' ? 'test' : 'spiel'); n++; }
    });
    return n;
  }
  {
    const _orig = window.processFixtureResult;
    if (typeof _orig === 'function') window.processFixtureResult = function () {
      const fx = typeof CURRENT_FIXTURE !== 'undefined' ? CURRENT_FIXTURE : null;
      if (!aktiv() || !fx) return _orig.apply(this, arguments);
      const art = fx.type === 'friendly' ? 'test' : 'liga';
      const elf = (typeof getLineupIds === 'function' ? getLineupIds() : []).map(id => getPlayer(id)).filter(Boolean);
      stumm++;
      let r;
      try { r = _orig.apply(this, arguments); } finally { stumm--; }
      try { if (spielVerletzungen(elf, art) && typeof saveGameState === 'function') saveGameState(); } catch (e) { console.warn('[DFL-Medizin] Spielverletzungen', e); }
      return r;
    };
  }

  // ── Training: eigener Durchgang mit der neuen Liste ──────────────────────
  function trainingVerletzungen() {
    const woche = LEAGUE.week || 1, basis = woche <= C().vorbereitungBis ? C().vorbereitung : C().training;
    const f = CFG.intensitaet[(CLUB.training && CLUB.training.intensity) || 'normal'] || 1;
    kader().forEach(p => {
      if (!p || p.onLoanAt || p.verletztenliste || verletzt(p)) return;
      if (Math.random() < basis * f * risiko(p)) verletze(p, 'training');
    });
  }
  {
    const TS = window.TrainingSystem;
    if (TS && typeof TS.weeklyTrainingTick === 'function') {
      const _orig = TS.weeklyTrainingTick;
      TS.weeklyTrainingTick = function () {
        if (!aktiv()) return _orig.apply(this, arguments);
        stumm++;
        let r;
        try { r = _orig.apply(this, arguments); } finally { stumm--; }
        try { trainingVerletzungen(); } catch (e) { console.warn('[DFL-Medizin] Training', e); }
        return r;
      };
    }
  }

  // ── Sommerpause: 12 Wochen Heilung statt alles (applyEndOfSeasonClubEffects setzte jede Verletzung auf 0) ──────────
  {
    const _orig = window.applyEndOfSeasonClubEffects;
    if (typeof _orig === 'function') window.applyEndOfSeasonClubEffects = function () {
      if (!aktiv()) return _orig.apply(this, arguments);
      const merk = kader().map(p => ({ p, w: p.injuryWeeks || 0, typ: p.injuryType, ges: p.injuryTotal }));
      const r = _orig.apply(this, arguments);
      const sommer = C().sommer, med = stufe();
      merk.forEach(({ p, w, typ, ges }) => {
        delete p.injuryFrisch;
        if (w > sommer) { p.injuryWeeks = w - sommer; p.injuryType = typ; p.injuryTotal = ges || w; }
        else if (w > 0) { p.injuryTotal = ges || w; rueckkehr(p, true); S.rehaSchritt(p, (sommer - w) * S.rehaTempo(p, med, phys())); }
        else if (p.reha > 0) S.rehaSchritt(p, sommer * S.rehaTempo(p, med, phys()));
      });
      const noch = merk.filter(x => x.w > sommer);
      if (noch.length && typeof addNews === 'function') addNews('training', 'Verletzt in die neue Saison',
        noch.map(x => `${name(x.p)} (${x.p.injuryType}, noch ${wo(x.p.injuryWeeks)})`).join(' · ') + '. Die Sommerpause hat 12 Wochen geheilt.');
      return r;
    };
  }

  // ── KI-Vereine im Spiel (Welt): Woche, Spieltag, Playoffs ────────────────
  const rng = n => Gen.rngAus((((CLUB.dfl.seed || 1) * n + (LEAGUE.season || 1) * 7919 + (LEAGUE.week || 0) * 104729 + (LEAGUE.matchday || 0) * 31) >>> 0) || 1);
  const capSetzen = L => { if (L && L.cap) Gen.setzeCap(L.cap); };
  const teamName = id => { try { const f = D.franchise(D.spielId(id)); return (f && f.name) || id; } catch (e) { return id; } };
  function kiMelden(neu) {
    if (!neu.length || typeof addNews !== 'function') return;
    const L = D.liga();
    const wichtig = neu.filter(v => {
      if (v.wochen < CFG.kiMeldungAb || !v.t) return false;
      const t = L.teams.find(x => x.id === v.t); if (!t) return false;
      return t.roster.slice().sort((a, b) => b.ovr - a.ovr).slice(0, 3).indexOf(v.p) >= 0;
    });
    if (!wichtig.length) return;
    addNews('match', wichtig.length === 1 ? `Langer Ausfall bei ${teamName(wichtig[0].t)}` : 'Lange Ausfälle in der Liga',
      wichtig.map(v => `${voll(v.p)} (${teamName(v.t)}, ${v.p.pos}, ${v.p.ovr}): ${v.typ}, ${wo(v.wochen)}`).join(' · ') + '.');
  }
  // KI-Playoff-Spiele (Formel, dfl_playoffs_patch.js): Verletzungen für die Elfen beider Teams, einmal je Spiel
  function poVerletzungen(L, r) {
    const po = LEAGUE.dflPO, eigen = D.eigeneDflId(), neu = [];
    if (!po || !Array.isArray(po.spiele)) return neu;
    po.spiele.forEach(s => {
      if (!s.sieger || s.verl) return;
      s.verl = 1;
      // D166: Hin und Rück = zwei Spiele
      for (let n = s.zwei && s.hin ? 2 : 1; n > 0; n--) [s.heim, s.gast].forEach(id => {
        const t = L.teams.find(x => x.id === D.dflIdVon(id));
        if (t && t.id !== eigen) neu.push(...S.spielVerletzungen(L, r, t, S.teamWerte(t).elf, 'playoff'));
      });
    });
    return neu;
  }
  function kiWoche() {
    const L = D.liga(), ohne = new Set([D.eigeneDflId()]), r = rng(101), neu = [];
    capSetzen(L);
    neu.push(...poVerletzungen(L, r));
    const aus = S.verletzungWoche(L, r, LEAGUE.week || 1, { ohne });
    neu.push(...aus.neu);
    if (typeof FRIENDLY_WEEKS !== 'undefined' && FRIENDLY_WEEKS.indexOf(LEAGUE.week) >= 0) {
      L.teams.forEach(t => { if (!ohne.has(t.id)) neu.push(...S.spielVerletzungen(L, r, t, S.teamWerte(t).elf, 'test')); });
    }
    const ersatz = [];
    L.teams.forEach(t => { if (!ohne.has(t.id)) ersatz.push(...S.ersatzPruefen(L, t)); });
    if (S.formationenSetzen) S.formationenSetzen(L);     // Bedarf der KI nach der Formation ihres Stils
    kiMelden(neu);
    if ((ersatz.length || aus.entlassen.length) && window.DFLKader && DFLKader.faSpiegel) DFLKader.faSpiegel();
    D.weltGeaendert();
    return { neu: neu.length, zurueck: aus.zurueck.length, ersatz: ersatz.length };
  }
  {
    const _orig = window.advanceCalendarWeek;
    if (typeof _orig === 'function') window.advanceCalendarWeek = function () {
      const ok = _orig.apply(this, arguments);
      if (ok && aktiv()) { try { kiWoche(); } catch (e) { console.warn('[DFL-Medizin] Woche der KI', e); } }
      return ok;
    };
  }
  // Spieltag: vorher die Stärke der KI aus der verfügbaren Elf (quickSimResult liest sie), danach ihre Spielverletzungen
  {
    const _orig = window.advanceMatchday;
    if (typeof _orig === 'function') window.advanceMatchday = function (league) {
      if (!aktiv() || !league || !league.dfl || (typeof maxMatchday === 'function' && league.matchday >= maxMatchday(league))) return _orig.apply(this, arguments);
      let L = null, elfen = null;
      try {
        D.staerkeAktualisieren();
        L = D.liga(); elfen = {};
        const eigen = D.eigeneDflId(), spielen = D.spielendeTeams ? D.spielendeTeams(league, league.matchday) : null;
        L.teams.forEach(t => {
          if (t.id === eigen || (spielen && !spielen.has(t.id))) return;      // Bye Week: kein Spiel, keine Spielverletzung
          elfen[t.id] = S.teamWerte(t).elf;
          const z = t.verl = t.verl || S.neuerZaehler();
          z.anpfiff += t.roster.filter(p => p.aus > 0).length; z.spiele++;
        });
      } catch (e) { console.warn('[DFL-Medizin] vor dem Spieltag', e); }
      const r = _orig.apply(this, arguments);
      try {
        if (L && elfen) {
          capSetzen(L);
          const rr = rng(211), neu = [], ersatz = [];
          L.teams.forEach(t => { if (elfen[t.id]) { neu.push(...S.spielVerletzungen(L, rr, t, elfen[t.id], 'liga')); ersatz.push(...S.ersatzPruefen(L, t)); } });
          kiMelden(neu);
          if (ersatz.length && window.DFLKader && DFLKader.faSpiegel) DFLKader.faSpiegel();
          D.weltGeaendert();
        }
      } catch (e) { console.warn('[DFL-Medizin] Spieltag der KI', e); }
      return r;
    };
  }

  // ── Detailwerte: Rückstand ändert sich jede Woche → Werte-Cache des Spielers neu (DFLPosition rechnet ihn als Abzug) ─────
  {
    const _orig = window.spielerWerte;
    const versteckt = (o, k, v) => { try { Object.defineProperty(o, k, { value: v, enumerable: false, writable: true, configurable: true }); } catch (e) { o[k] = v; } };
    if (typeof _orig === 'function') window.spielerWerte = function (p) {
      if (p && typeof p === 'object') {
        const sig = rueckstand(p);
        if ((p._d102 || 0) !== sig) {
          try { delete p._werte; delete p._werteAlt; } catch (e) { p._werte = null; p._werteAlt = null; }
          versteckt(p, '_d102', sig);
        }
      }
      return _orig.apply(this, arguments);
    };
  }

  // ── Prognose eines eigenen Spielers ──────────────────────────────────────
  function prognose(p) {
    if (!p) return null;
    const med = stufe(), tempo = S.rehaTempo(p, med, phys()), mit = 1 + C().reha.spiel;
    if (verletzt(p)) {
      const vp = verpasst(p), R = Math.max(S.rehaStartWert(p.injuryTotal || p.injuryWeeks), p.reha || 0);
      return { verletzt: true, wochen: p.injuryWeeks, typ: p.injuryType || 'Verletzung', tage: vp.tage, zurueck: vp.zurueck, R,
        ohne: R ? Math.ceil(R / tempo - 1e-9) : 0, mit: R ? Math.max(1, Math.ceil(R / (tempo * mit) - 1e-9)) : 0, tempo };
    }
    if (p.reha > 0) return { verletzt: false, R: p.reha, ohne: Math.ceil(p.reha / tempo - 1e-9), mit: Math.max(1, Math.ceil(p.reha / (tempo * mit) - 1e-9)), tempo };
    return null;
  }
  // Kurve: Stärke Woche für Woche bis zum alten Niveau, mit und ohne Einsatz (SVG, Farben aus den Tokens)
  function kurve(p, pr) {
    const B = 260, H = 70, aus = pr.verletzt ? pr.wochen : 0, ohne = aus + pr.ohne, n = Math.max(ohne + 1, 4);
    const x = w => 8 + (B - 16) * w / n, lo = p.ovr - Math.max(4, Math.ceil(pr.R) + 1), y = v => 14 + (H - 30) * (p.ovr - v) / (p.ovr - lo);
    const reihe = f => { const pts = []; let r = pr.R; for (let w = aus; w <= n; w++) { pts.push(`${x(w).toFixed(1)},${y(p.ovr - Math.max(0, r)).toFixed(1)}`); r -= pr.tempo * f; } return pts.join(' '); };
    return `<svg class="med-kurve" viewBox="0 0 ${B} ${H}" role="img" aria-label="Rückstand bis zum alten Niveau: mit Einsatz ${wo(pr.mit)}, ohne ${wo(pr.ohne)}">
      ${aus ? `<rect x="${x(0).toFixed(1)}" y="12" width="${(x(aus) - x(0)).toFixed(1)}" height="${H - 26}" class="med-k-aus"/><text x="${((x(0) + x(aus)) / 2).toFixed(1)}" y="${(H / 2).toFixed(0)}" text-anchor="middle" class="med-k-txt">verletzt</text>` : ''}
      <line x1="8" x2="${B - 8}" y1="${y(p.ovr).toFixed(1)}" y2="${y(p.ovr).toFixed(1)}" class="med-k-linie"/>
      <polyline points="${reihe(1)}" class="med-k-ohne"/><polyline points="${reihe(1 + C().reha.spiel)}" class="med-k-mit"/>
      <text x="${B - 8}" y="${(y(p.ovr) - 4).toFixed(1)}" text-anchor="end" class="med-k-txt">${p.ovr}</text>
      <text x="8" y="${H - 3}" class="med-k-txt">heute</text><text x="${B - 8}" y="${H - 3}" text-anchor="end" class="med-k-txt">+${n} Wo.</text></svg>`;
  }
  // Block im Spieler-Blatt (dfl_app_shell.js): Verletzung bzw. Aufbau mit Prognose
  function blattHtml(p) {
    if (!aktiv() || !p || !kader().some(q => q.id === p.id)) return '';
    const pr = prognose(p); if (!pr) return '';
    const kopf = pr.verletzt
      ? `<div class="med-zeile"><i class="ti ti-bandage" aria-hidden="true"></i><span><b>${esc(pr.typ)}</b> · noch ${wo(pr.wochen)}${pr.tage.length ? ' · verpasst ' + tageText(pr.tage) : ''}${pr.zurueck ? ' · zurück zu Spieltag ' + pr.zurueck : ''}</span></div>`
      : `<div class="med-zeile"><i class="ti ti-activity-heartbeat" aria-hidden="true"></i><span><b>Im Aufbau</b> · ${ovrMitReha(p)}</span></div>`;
    const reha = pr.R > 0 ? `<div class="med-zeile leise"><span>${pr.verletzt ? `Danach Rückstand −${zahl(pr.R)}: ` : ''}mit Einsatz etwa ${wo(pr.mit)}, ohne ${wo(pr.ohne)} bis ${p.ovr}</span></div>${kurve(p, pr)}
      <div class="med-legende"><span class="mit">mit Einsatz</span><span class="ohne">ohne Einsatz</span></div>` : '';
    return `<div class="med-blatt">${kopf}${reha}</div>`;
  }
  const ovrMitReha = p => { const r = Math.round(p.reha * 10) / 10; return `${p.ovr} <em class="med-reha-t">−${zahl(r, r % 1 ? 1 : 0)}</em> → <b>${zahl(Math.max(0, p.ovr - p.reha), 0)}</b>`; };

  // ── Office-Kachel und Blatt ──────────────────────────────────────────────
  function kachel() {
    if (!aktiv()) return null;
    const K = kader().filter(p => !p.perspektiv && !p.onLoanAt), nAus = K.filter(verletzt).length, nReha = K.filter(p => !verletzt(p) && p.reha > 0).length;
    return { ic: 'ti-first-aid-kit', z: nAus >= 5 ? 'schlecht' : nAus >= 3 ? 'mittel' : 'gut', gross: `${nAus}<small> verletzt</small>`,
      unten: `${nReha} im Aufbau · Medizin ${stufe()}`, go: () => blatt() };
  }
  function ausbauHtml(s, knopfKlasse) {
    const def = typeof FACILITY_DEFS !== 'undefined' && FACILITY_DEFS.medizin, bau = CLUB.facilityBuilds && CLUB.facilityBuilds.medizin;
    if (bau) {
      const pct = Math.round((bau.totalWeeks - bau.weeksLeft) / Math.max(1, bau.totalWeeks) * 100);
      return `<div class="med-bau"><span>Ausbau auf Stufe ${bau.targetLevel} läuft · noch ${wo(bau.weeksLeft)}</span><span class="med-bau-bahn"><i style="width:${pct}%"></i></span></div>`;
    }
    if (s >= 10 || !def) return '<div class="med-bau fertig"><i class="ti ti-check" aria-hidden="true"></i> Höchste Stufe</div>';
    const preis = def.cost[s], w1 = wirkung(s + 1), wochen = typeof facilityBuildWeeks === 'function' ? facilityBuildWeeks('medizin', s + 1) : null;
    return `<div class="med-naechste"><b>Stufe ${s + 1} · ${esc(CFG.stufen[s])}</b><span>Risiko −${w1.risiko} %, Dauer −${zahl(w1.dauer, 1)} %, Reha +${w1.reha} % · etwa ${ersparnis(s)} Ausfallwochen weniger je Saison${wochen ? ' · Bauzeit ' + wo(wochen) : ''}</span></div>
      <button type="button" class="${knopfKlasse}" data-a="med-ausbau" ${(CLUB.budget || 0) < preis ? 'disabled' : ''} onclick="upgradeFacility('medizin')">Ausbauen — ${geld(preis)}</button>`;
  }
  function listeHtml() {
    const K = kader().filter(p => !p.onLoanAt);
    const aus = K.filter(verletzt).sort((a, b) => b.injuryWeeks - a.injuryWeeks), reha = K.filter(p => !verletzt(p) && p.reha > 0).sort((a, b) => b.reha - a.reha);
    const zeile = (p, txt, klasse) => `<button type="button" class="med-spieler ${klasse}" data-id="${esc(p.id)}"><span class="pos-badge-sm pos-${esc(p.pos)}">${esc(p.pos)}</span>
      <span class="med-name">${esc(name(p))}</span><span class="med-info">${txt}</span></button>`;
    const woK = n => n + ' Wo.';
    const a = aus.map(p => { const pr = prognose(p); return zeile(p, `${esc(p.injuryType || 'Verletzung')} · ${woK(p.injuryWeeks)}${pr && pr.zurueck ? ' · ab Spieltag ' + pr.zurueck : ''}`, 'aus'); }).join('');
    const b = reha.map(p => { const pr = prognose(p), r = Math.round(p.reha * 10) / 10; return zeile(p, `Reha −${zahl(r, r % 1 ? 1 : 0)} · etwa ${woK(pr.mit)}`, 'reha'); }).join('');
    return (a || b) ? `<div class="med-liste">${a}${b}</div>` : '<p class="med-leer">Niemand verletzt, niemand im Aufbau.</p>';
  }
  function blattInhalt() {
    const s = stufe(), w = wirkung(s), z = statistik(), l = ligaSchnitt();
    const K = kader().filter(p => !p.perspektiv && !p.onLoanAt), fit = K.filter(p => !verletzt(p) && !(p.suspendedGames > 0) && !p.verletztenliste).length;
    return `<div class="app-griff"></div><button class="app-blatt-zu" aria-label="Schließen"><i class="ti ti-x" aria-hidden="true"></i></button>
      <div class="app-sheet-titel">Medizinische Abteilung</div>
      <div class="med-kopf"><span class="med-symbol"><i class="ti ti-first-aid-kit" aria-hidden="true"></i></span>
        <div><b>Stufe ${s} · ${esc(CFG.stufen[s - 1])}</b><small>${s > 1 ? `Risiko −${w.risiko} % · Dauer −${zahl(w.dauer, 1)} % · Reha +${w.reha} %` : 'Grundversorgung'}</small></div></div>
      <div class="med-zahlen"><div><b>${K.filter(verletzt).length}</b><span>verletzt</span></div><div><b>${K.filter(p => !verletzt(p) && p.reha > 0).length}</b><span>im Aufbau</span></div>
        <div><b>${fit}<small>/${K.length}</small></b><span>einsatzfähig</span></div></div>
      <div class="med-saison">Saison bisher: <b>${z.n}</b> Verletzungen · <b>${z.wochen}</b> Ausfallwochen${l && l.wochen > 0 ? ` · Liga Ø ${zahl(l.wochen)}` : ''}${z.gespart ? ` · Medizin sparte ${wo(z.gespart)}` : ''}</div>
      ${listeHtml()}
      <div class="med-ausbau">${ausbauHtml(s, 'app-knopf haupt')}</div>`;
  }
  function blatt() {
    const box = document.querySelector('#app-blatt .app-blatt-box'); if (!box) return;
    box.innerHTML = blattInhalt();
    box.onclick = ev => {
      const sp = ev.target.closest('.med-spieler');
      if (sp) { const p = getPlayer(sp.getAttribute('data-id')); if (p && window.DFLAppShell && DFLAppShell.spielerBlatt) DFLAppShell.spielerBlatt(p, null); return; }
      if (ev.target.closest('[data-a="med-ausbau"]')) setTimeout(() => { const b = document.getElementById('app-blatt'); if (b && b.classList.contains('auf')) blatt(); }, 0);
    };
    document.getElementById('app-blatt').classList.add('auf'); document.body.classList.add('app-gesperrt');
    if (window.DFLAppShell && DFLAppShell.cta) DFLAppShell.cta();
  }

  // ── Karte unter Verein & Stadion ─────────────────────────────────────────
  function karteHtml() {
    const s = stufe(), w = wirkung(s), z = statistik(), def = FACILITY_DEFS.medizin;
    const bar = typeof levelBar === 'function' ? levelBar(s, 10) : '';
    return `<div class="facility-card med-karte">
      <div class="fc-head"><div class="fc-icon medizin">${def.icon}</div><div style="flex:1"><div class="fc-name">${def.name}</div><div class="fc-level">Stufe ${s}/10 · ${esc(CFG.stufen[s - 1])}</div></div></div>
      ${bar}<div class="fc-desc">${def.desc}</div>
      <div class="fc-stat"><span>Risiko · Dauer · Reha</span><b>${s > 1 ? `−${w.risiko} % · −${zahl(w.dauer, 1)} % · +${w.reha} %` : 'Grundversorgung'}</b></div>
      <div class="fc-stat"><span>Saison bisher</span><b>${z.n} Verletzungen · ${wo(z.wochen)}</b></div>
      ${ausbauHtml(s, 'fc-upgrade')}</div>`;
  }
  {
    const _orig = window.renderClubTab;
    if (typeof _orig === 'function') window.renderClubTab = function () {
      const r = _orig.apply(this, arguments);
      try {
        const el = document.getElementById('club-facilities');
        if (aktiv() && el && !el.querySelector('.med-karte')) el.insertAdjacentHTML('beforeend', karteHtml());
      } catch (e) { console.warn('[DFL-Medizin] Karte', e); }
      return r;
    };
  }

  // ── Kaderliste: einsatzfähig x von 28 (21er-Marke), Reha-Marke ─────────────────────────────────────
  function kaderlisteErgaenzen() {
    const host = document.getElementById('sub-squadlist'); if (!host) return;
    const K = kader().filter(p => !p.perspektiv && !p.onLoanAt);
    const fit = K.filter(p => !verletzt(p) && !(p.suspendedGames > 0) && !p.verletztenliste && !p.onStrike).length;
    const min = (window.DFLKader && DFLKader.MIN) ? DFLKader.MIN() : 21, max = 28;
    if (!host.querySelector('.med-einsatz')) {
      const ziel = host.querySelector('.sqo-count');
      const html = `<div class="med-einsatz" title="Einsatzfähig: nicht verletzt, nicht gesperrt, nicht auf der Verletztenliste">
        <div class="med-einsatz-kopf"><span><b>${fit}</b> von ${K.length} einsatzfähig</span><small>${min} Spieler: Mindestkader</small></div>
        <div class="med-balken ${fit < min ? 'knapp' : ''}"><i style="width:${Math.min(100, fit / max * 100).toFixed(1)}%"></i><em style="left:${(min / max * 100).toFixed(1)}%" title="${min} Spieler"></em></div></div>`;
      if (ziel) ziel.insertAdjacentHTML('beforebegin', html); else host.insertAdjacentHTML('afterbegin', html);
    }
    host.querySelectorAll('.sqo-row').forEach(row => {
      const m = /showSquadPlayerCard\('([^']+)'\)/.exec(row.getAttribute('onclick') || ''), p = m && getPlayer(m[1]);
      if (!p) return;
      row.classList.toggle('med-betroffen', verletzt(p) || p.reha > 0);
      // Rückstand wie der Positionsabzug (D81) als Marke an der Stärke – die Namenszeile ist mit den Ampeln (D62) schon voll
      if (p.reha > 0 && !verletzt(p) && !row.querySelector('.med-reha-abz')) {
        const ovr = row.querySelector('.squad-ovr'), pr = prognose(p), r = Math.round(p.reha * 10) / 10;
        const html = `<span class="med-reha-abz" title="Rückstand nach Verletzung: ${p.ovr} −${zahl(r, r % 1 ? 1 : 0)} → ${zahl(Math.max(0, p.ovr - p.reha))}, mit Einsatz etwa ${wo(pr.mit)} bis ${p.ovr}"><i class="ti ti-activity-heartbeat" aria-hidden="true"></i>−${zahl(Math.ceil(p.reha - 1e-9))}</span>`;
        const pot = ovr && ovr.querySelector('.squad-pot');
        if (pot) pot.insertAdjacentHTML('beforebegin', html); else if (ovr) ovr.insertAdjacentHTML('beforeend', html);
      }
    });
  }
  {
    const _orig = window.renderSquadOverview;
    if (typeof _orig === 'function') window.renderSquadOverview = function () {
      const r = _orig.apply(this, arguments);
      try { if (aktiv()) kaderlisteErgaenzen(); } catch (e) { console.warn('[DFL-Medizin] Kaderliste', e); }
      return r;
    };
  }

  window.DFLMedizin = { CFG, stufe, startStufe, wirkung, rueckstand, prognose, blatt, kachel, blattHtml, karteHtml, verletze, rueckkehr, kiWoche,
    statistik, ligaSchnitt, ersparnis, risiko, abgleichen, verpasst };

  // Spielstand schon geladen (initGame lädt vor den Patches): Stufe setzen, Stärke der KI aus der verfügbaren Elf
  try { if (aktiv()) { stufe(); D.staerkeAktualisieren(); } } catch (e) { console.warn('[DFL-Medizin] Laden', e); }
  console.log('[DFL-Medizin v1] aktiv — Verletzungen für alle 32 (D102): 5 % je Startelf-Spieler und Spiel, Training 1,4 %, 15 Arten, Rückstand nach der Rückkehr, Sommerpause 12 Wochen, medizinische Abteilung Stufe 1–10, KI mit Ausfällen und Ersatz');
})();
