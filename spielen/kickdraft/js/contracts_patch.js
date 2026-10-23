/* ===== contracts_patch.js =====
   Vertragsverhandlungen + Kaderrollen + Einsatzzeit-Zufriedenheit.
   - Kaderrolle wird aus dem OVR im Verhältnis zum eigenen Kader abgeleitet
     (Star = deutlich über dem Kader, spielt immer, fordert am meisten).
   - Verhandlung mit Hebeln: Gehalt, Laufzeit, Handgeld, Kaderrolle, Ausstiegsklausel.
     Der Berater nimmt an / macht ein Gegenangebot / lehnt ab.
   - Zufriedenheit (Moral) steigt/fällt je nach Einsatzzeit vs. Rollenerwartung:
     ein Star auf der Bank wird unzufrieden, eine Ergänzung freut sich über Spielzeit.
   Lädt SPÄT (nach app_main + bundle_economy/MoraleSystem). Wrappt renewContract
   (öffnet die Verhandlung) und processFixtureResult (Einsatzzeit-Auswertung).
   ============================================================================= */
(function () {
  'use strict';

  const ROLES = {
    star:       { key: 'star',       label: 'Starspieler',  wageMult: 1.30, expShare: 0.95, rank: 3 },
    stamm:      { key: 'stamm',      label: 'Stammspieler', wageMult: 1.10, expShare: 0.75, rank: 2 },
    rotation:   { key: 'rotation',   label: 'Rotation',     wageMult: 1.00, expShare: 0.50, rank: 1 },
    talent:     { key: 'talent',     label: 'Talent',       wageMult: 0.95, expShare: 0.40, rank: 1 },
    ergaenzung: { key: 'ergaenzung', label: 'Ergänzung',    wageMult: 0.90, expShare: 0.20, rank: 0 }
  };
  const OFFER_ROLE_ORDER = ['ergaenzung', 'rotation', 'stamm', 'star']; // wählbare Zusagen

  function own() { return (typeof SQUAD !== 'undefined' ? SQUAD : []).filter(p => !p.onLoanFrom); }

  // Natürliche Kaderrolle aus OVR relativ zum Median des eigenen Kaders.
  function squadRoleFor(p) {
    if (!p) return ROLES.rotation;
    const ovrs = own().map(x => x.ovr).sort((a, b) => a - b);
    const median = ovrs.length ? ovrs[Math.floor(ovrs.length / 2)] : 60;
    const diff = p.ovr - median;
    const strongerThan = own().filter(x => x.ovr > p.ovr).length; // 0 = stärkster
    let key;
    if (p.age <= 20) key = (diff >= 6 || strongerThan === 0) ? 'star' : 'talent';
    else if (diff >= 7 || strongerThan === 0) key = 'star';
    else if (diff >= 3 || strongerThan <= 2) key = 'stamm';
    else if (diff >= -2) key = 'rotation';
    else key = 'ergaenzung';
    return ROLES[key];
  }
  window.squadRoleFor = squadRoleFor;

  // ── Einsatzzeit-Zufriedenheit ──────────────────────────────────────────────
  // Nach jedem Pflichtspiel: wer über/unter seiner Rollenerwartung spielt, dessen
  // Moral wird leicht angepasst (Star auf Bank → unzufrieden usw.).
  // Eskalations-Kalibrierung (Tempo „Realistisch"). Bench-Malus [Basis, pro Serie, Deckel].
  const DISCONTENT = {
    benchMalus: { star: [2.5, 0.5, 5], stamm: [1.2, 0.3, 3], talent: [1.0, 0.3, 2.5], rotation: [0.5, 0.2, 1.5], ergaenzung: [0, 0, 0] },
    playBonus:  { ergaenzung: 2, rotation: 1, talent: 1, stamm: 1, star: 1 },
    discount:   { ok: 1.0, unhappy: 0.90, wants_out: 0.75, strike: 0.60 },
    enter: { strike: 30, wants_out: 45, unhappy: 62 },
    exit:  { strike: 40, wants_out: 53, unhappy: 68 }
  };
  const STAGE_ORDER = ['ok', 'unhappy', 'wants_out', 'strike'];
  window.discontentDiscount = function (p) { return (p && p._dcStage && DISCONTENT.discount[p._dcStage]) || 1; };

  // Neue Stufe mit Hysterese (Verschlechtern sofort, Erholen erst über Exit-Schwelle).
  function resolveStage(p) {
    const m = (typeof p.morale === 'number') ? p.morale : 70;
    const cur = p._dcStage || 'ok';
    let target = 'ok';
    if (m < DISCONTENT.enter.strike) target = 'strike';
    else if (m < DISCONTENT.enter.wants_out) target = 'wants_out';
    else if (m < DISCONTENT.enter.unhappy) target = 'unhappy';
    const ci = STAGE_ORDER.indexOf(cur), ti = STAGE_ORDER.indexOf(target);
    if (ti > ci) return target;                       // wird schlechter → sofort
    if (ti < ci) { const need = DISCONTENT.exit[cur] || 0; return (m >= need) ? target : cur; }
    return cur;
  }

  function applyStageTransition(p, from, to) {
    p._dcStage = to;
    const nm = displayName(p);
    const worse = STAGE_ORDER.indexOf(to) > STAGE_ORDER.indexOf(from);
    if (to === 'strike') {
      p.onStrike = true; p.wantsOut = p.wantsOut || 'transfer';
      if (typeof clearFromLineup === 'function') { try { clearFromLineup(p.id); } catch (e) {} }
      if (window.MoraleSystem) { try { MoraleSystem.addMorale(own().filter(x => x.id !== p.id && !x.onStrike), -3); } catch (e) {} }
      if (typeof addNews === 'function') addNews('club', `✊ Streik: ${p.name}`, `${nm} verweigert die Mitarbeit und ist nicht mehr aufstellbar. Trade ihn oder finde eine Lösung — die Kabinenstimmung leidet.`);
    } else if (to === 'wants_out') {
      p.wantsOut = 'transfer';   // DFL: keine Leihen (D36) – wer raus will, will getradet werden
      delete p.onStrike;
      if (typeof addNews === 'function') addNews('club', `✈️ Trade-Wunsch: ${p.name}`, `${nm} will den Verein verlassen. Sein Wert sinkt, solange er unzufrieden ist — spiele ihn wieder regelmäßig oder trade ihn.`);
    } else if (to === 'unhappy') {
      delete p.onStrike; delete p.wantsOut;
      if (worse && typeof addNews === 'function') addNews('club', `😟 Unzufrieden: ${p.name}`, `${nm} ist unzufrieden mit seiner Einsatzzeit. Spiele ihn mehr, sonst droht ein Trade-Wunsch.`);
    } else {
      const wasBad = from !== 'ok';
      delete p.onStrike; delete p.wantsOut;
      if (wasBad && typeof addNews === 'function') addNews('club', `😌 Beruhigt: ${p.name}`, `${nm} ist wieder zufrieden — die Sache ist vom Tisch.`);
    }
    try { if (typeof computeMarketValue === 'function') p.value = computeMarketValue(p); } catch (e) {}
  }
  function updateDiscontentStage(p) {
    const from = p._dcStage || 'ok';
    const to = resolveStage(p);
    if (to !== from) applyStageTransition(p, from, to);
  }

  // dabeiIds: alle eigenen Spieler, die gespielt haben (Startelf + Eingewechselte, aus Engine v3 über DFLStatistik)
  function updatePlayingTimeSatisfaction(starterIds, dabeiIds) {
    if (!window.MoraleSystem || typeof MoraleSystem.addMorale !== 'function') return;
    const started = new Set(starterIds || []);
    const eingewechselt = new Set((dabeiIds || []).filter(id => !started.has(id)));
    let anyStriker = false;
    own().forEach(p => {
      if (p.onStrike) { anyStriker = true; return; }                         // Streikende: kein Bench-Malus (Erholung via Wochendrift)
      if ((typeof isInjured === 'function' && isInjured(p)) || (typeof isSuspended === 'function' && isSuspended(p))) return;
      // Development Squad (D45) darf nicht spielen – kein Bank-Malus (Prüfung 2026-10-10: Talente wurden Woche für Woche unzufrieden)
      if (p.perspektiv) { p.benchStreak = 0; return; }
      const roleKey = squadRoleFor(p).key;
      if (started.has(p.id)) {
        p.benchStreak = 0;
        const b = DISCONTENT.playBonus[roleKey] || 0;
        if (b) { try { MoraleSystem.addMorale([p], b); } catch (e) {} }
      } else if (eingewechselt.has(p.id)) {
        // Eingewechselt = eingesetzt: Serie auf der Bank endet, Ergänzungsspieler freuen sich (vorher zählte nur die Startelf,
        // obwohl die Engine in jedem Spiel einwechselt – Prüfung 2026-10-10)
        p.benchStreak = 0;
        if (roleKey === 'ergaenzung') { try { MoraleSystem.addMorale([p], 1); } catch (e) {} }
      } else {
        p.benchStreak = (p.benchStreak || 0) + 1;                             // fit, aber nicht (ein)gewechselt
        const cfg = DISCONTENT.benchMalus[roleKey] || [0, 0, 0];
        const m = Math.min(cfg[2], cfg[0] + cfg[1] * (p.benchStreak - 1));
        if (m > 0) { try { MoraleSystem.addMorale([p], -m); } catch (e) {} }
      }
    });
    if (anyStriker) { try { MoraleSystem.addMorale(own().filter(p => !p.onStrike), -1); } catch (e) {} }  // Kabinenunruhe
    own().forEach(updateDiscontentStage);
  }

  if (typeof window.processFixtureResult === 'function') {
    const _proc = window.processFixtureResult;
    window.processFixtureResult = function () {
      const isFriendly = (typeof CURRENT_FIXTURE !== 'undefined' && CURRENT_FIXTURE && CURRENT_FIXTURE.type === 'friendly');
      const starters = (typeof getLineupIds === 'function') ? getLineupIds().slice() : [];
      const r = _proc.apply(this, arguments);
      const dabei = window.DFLStatistik && DFLStatistik.eigeneTeilnehmer ? DFLStatistik.eigeneTeilnehmer(true) : null;
      if (!isFriendly) { try { updatePlayingTimeSatisfaction(starters, dabei); } catch (e) { console.warn('[Contracts] playtime', e); } }
      return r;
    };
    try { processFixtureResult = window.processFixtureResult; } catch (e) {}
  }

  // ── Forderung des Beraters ─────────────────────────────────────────────────
  function contractDemand(p) {
    const role = squadRoleFor(p);
    // DFL (D40): Forderung wie bei der KI (DFLGenerator.forderung + Stimmung), Wochenwert inkl. Handgeld-Anteil
    const dfl = (typeof window.dflVertragsForderung === 'function') ? window.dflVertragsForderung(p) : null;
    if (dfl) {
      const rw = (typeof roundWage === 'function') ? roundWage : Math.round;
      return { role, wage: rw(dfl.wochenlohn), years: Math.min(dfl.jahre, 5), wantsClause: false, naturalRank: role.rank, dfl };
    }
    const base = (typeof weeklyWageFor === 'function') ? weeklyWageFor(p) : (p.wage || 1000);
    const morale = (typeof p.morale === 'number') ? p.morale : 70;
    const moraleMult = 1 + (70 - morale) / 300;                         // unzufrieden → fordert mehr
    const potBonus = (p.truePotential && p.age <= 23) ? 1 + Math.min(0.15, (p.truePotential - p.ovr) * 0.02) : 1;
    let wage = base * role.wageMult * moraleMult * potBonus;
    wage = Math.max(wage, (p.wage || 0) * 1.03);
    const years = p.age <= 23 ? 4 : p.age <= 29 ? 3 : p.age <= 32 ? 2 : 1;
    const rw = (typeof roundWage === 'function') ? roundWage : Math.round;
    return { role, wage: rw(wage), years, wantsClause: role.key === 'star', naturalRank: role.rank };
  }

  // ── Angebot bewerten ───────────────────────────────────────────────────────
  // ── WAHRSCHEINLICHKEITEN beim Vertrag ─────────────────────────────────────
  // Wie bei der Vereinsverhandlung entscheidet ein Wurf statt einer festen
  // Schwelle — hier aber deutlich MILDER: wer die Forderung im Wesentlichen
  // trifft, bekommt die Unterschrift auch. Stützpunkte Zufriedenheit → Chance,
  // dazwischen linear. 90 % Zufriedenheit = 90 % Chance, 95 % = so gut wie sicher.
  const VERTRAG_KURVE = [[40, 2], [50, 5], [60, 11], [70, 23], [75, 33], [80, 46],
                         [85, 66], [88, 80], [90, 90], [93, 96], [95, 99], [100, 100]];
  const VERTRAG = {
    kurve: VERTRAG_KURVE,
    maxRunden: 4,          // eine Runde mehr als früher — es kann ja Pech sein
    aufschlagRunde: 0.03,  // gescheiterte Runde verteuert die Forderung leicht
    konterZiel: 92,        // Zufriedenheit, die die Gegenforderung abdeckt
    konterMaxLohn: 1.75    // darüber ist es keine Gehalts-, sondern eine Rollenfrage
  };
  window.Vertragsverhandlung = VERTRAG;

  function chanceFuerSat(sat) {
    const K = VERTRAG.kurve;
    if (sat <= K[0][0]) return Math.max(0, K[0][1] * (sat / Math.max(1, K[0][0])));
    if (sat >= K[K.length - 1][0]) return K[K.length - 1][1];
    for (let i = 0; i < K.length - 1; i++) {
      const a = K[i], b = K[i + 1];
      if (sat >= a[0] && sat <= b[0]) return a[1] + (b[1] - a[1]) * ((sat - a[0]) / (b[0] - a[0]));
    }
    return 0;
  }

  // Zuschläge, die NICHT am Gehalt hängen (Rolle, Klausel, Alter/Laufzeit).
  // Ausgelagert, damit sich ausrechnen lässt, welches Gehalt eine bestimmte
  // Zufriedenheit erreicht — die alte Gegenforderung war blind „+10 %".
  function negoExtras(s, dem, p) {
    let e = 0;
    const offerRank = ROLES[s.role] ? ROLES[s.role].rank : 1;
    if (offerRank >= dem.naturalRank) e += 6;
    else if (offerRank === dem.naturalRank - 1) e -= 18;
    else e -= 45;
    // EUROPAPOKAL: das stärkste nicht-monetäre Argument im Gespräch. Bisher
    // spielte die Teilnahme im Transfergeschäft gar keine Rolle — ein
    // Champions-League-Starter war so attraktiv wie ein Tabellenzwölfter.
    const eu = (typeof europaStufe === 'function') ? europaStufe() : 0;
    if (eu) e += eu === 3 ? 8 : eu === 2 ? 5 : 3;
    if (p.age <= 23) e += (s.years >= 3 ? 5 : s.years <= 1 ? -10 : 0);
    else if (p.age >= 30) e += (s.years >= 3 ? -6 : 3);
    return e;
  }
  function premWeeklyOf(s) {
    const prem = s.premPresets ? (s.premPresets[s.premIdx] || {}) : {};
    return (prem.perApp || 0) * 0.7 + (prem.perGoal || 0) * 0.25;      // Prämien erhöhen den gefühlten Lohn
  }
  // Höchste Zufriedenheit, die mit der aktuellen Rolle/Laufzeit überhaupt
  // erreichbar ist. Der Gehaltsanteil ist bei 100 gedeckelt — wer eine Stufe zu
  // klein anbietet, kommt also nie über 82, egal wie viel Geld fließt.
  function maxSatMoeglich(s, dem, p) {
    return Math.max(0, Math.min(100, 100 + negoExtras(s, dem, p)));
  }
  // Wochengehalt, das die gewünschte Zufriedenheit erreicht (oder null, wenn das
  // Ziel am Gehalt gar nicht hängt bzw. unerreichbar ist).
  function wageFuerSat(s, dem, p, ziel) {
    const extras = negoExtras(s, dem, p);
    const gehaltsAnteil = ziel - extras;
    if (gehaltsAnteil > 100) return null;      // mit dieser Rolle nicht erreichbar
    const w = (gehaltsAnteil / 85) * dem.wage - (s.bonus / Math.max(1, s.years * 46)) - premWeeklyOf(s);
    if (!isFinite(w) || w > dem.wage * VERTRAG.konterMaxLohn) return null;
    const gerundet = (typeof roundWage === 'function') ? roundWage(Math.max(0, w)) : Math.round(Math.max(0, w));
    return Math.max(s.wage, gerundet);
  }

  function negoEvaluate(s, dem, p) {
    const perceivedWage = s.wage + (s.bonus / Math.max(1, s.years * 46)) + premWeeklyOf(s);
    const ratio = perceivedWage / Math.max(1, dem.wage);
    const sat = Math.max(0, Math.min(100,
      Math.round(Math.max(0, Math.min(100, ratio * 85)) + negoExtras(s, dem, p))));
    const offerRank = ROLES[s.role] ? ROLES[s.role].rank : 1;
    const rolleZuKlein = offerRank < dem.naturalRank;
    return { sat, chance: chanceFuerSat(sat), rolleZuKlein };
  }

  // ── Verhandlungs-Dialog ────────────────────────────────────────────────────
  function euro(v) { return (typeof formatEuro === 'function') ? formatEuro(v) : (Math.round(v) + ' €'); }

  // Spieler auflösen: bei Kauf ist es ein Marktspieler (ctx.player), sonst ein Kaderspieler.
  function negoPlayer(s) { return (s && s.player) ? s.player : ((typeof getPlayer === 'function') ? getPlayer(s.pid) : null); }

  // ctx (optional, für Kauf): { player, onAccept(deal)→{ok:false,msg}|undefined }
  window.openNegotiation = function (pid, ctx) {
    const p = (ctx && ctx.player) ? ctx.player : ((typeof getPlayer === 'function') ? getPlayer(pid) : null);
    if (!p || typeof LEAGUE === 'undefined' || !LEAGUE) return;
    const dem = contractDemand(p);
    const val = p.value || (typeof computeMarketValue === 'function' ? computeMarketValue(p) : p.ovr * 100000);
    const rm = (typeof roundMoney === 'function') ? roundMoney : Math.round;
    window._nego = {
      pid, dem, val, player: (ctx && ctx.player) || null, buyCtx: ctx || null,
      wage: ctx ? dem.wage : (p.wage || dem.wage),
      years: Math.min((typeof MAX_CONTRACT_YEARS !== 'undefined' ? MAX_CONTRACT_YEARS : 5), dem.years),
      bonus: 0,
      role: dem.role.key === 'talent' ? 'rotation' : dem.role.key,
      clauseIdx: 0,
      clausePresets: [0],                 // DFL: keine Ausstiegsklauseln (D36)
      premIdx: 0,
      premPresets: (function () {
        const pg = Math.max(2000, rm(dem.wage * 1.5)), pa = Math.max(300, rm(dem.wage * 0.15));
        return [
          { perGoal: 0, perApp: 0, label: 'keine' },
          { perGoal: pg, perApp: 0, label: euro(pg) + '/Tor' },
          { perGoal: 0, perApp: pa, label: euro(pa) + '/Einsatz' },
          { perGoal: pg, perApp: pa, label: 'Tor + Einsatz' }
        ];
      })(),
      rounds: 0, counterWage: null, counterSat: null, msg: null, done: false,
      wStep: Math.max(500, (typeof roundWage === 'function' ? roundWage(dem.wage * 0.05) : 500)),
      bStep: Math.max(5000, rm(dem.wage * 4))
    };
    renderNegotiation();
  };

  window.negoAdjust = function (field, dir) {
    const s = window._nego; if (!s || s.done) return;
    const MAXY = (typeof MAX_CONTRACT_YEARS !== 'undefined') ? MAX_CONTRACT_YEARS : 5;
    if (field === 'wage') s.wage = Math.max(0, s.wage + dir * s.wStep);
    else if (field === 'years') s.years = Math.max(1, Math.min(MAXY, s.years + dir));
    else if (field === 'bonus') s.bonus = Math.max(0, s.bonus + dir * s.bStep);
    s.msg = null;
    renderNegotiation();
  };
  window.negoCycleRole = function () {
    const s = window._nego; if (!s || s.done) return;
    const i = OFFER_ROLE_ORDER.indexOf(s.role);
    s.role = OFFER_ROLE_ORDER[(i + 1) % OFFER_ROLE_ORDER.length];
    s.msg = null; s.counterWage = null; renderNegotiation();
  };
  window.negoCyclePrem = function () {
    const s = window._nego; if (!s || s.done) return;
    s.premIdx = (s.premIdx + 1) % s.premPresets.length;
    s.msg = null; s.counterWage = null; renderNegotiation();
  };
  window.negoClose = function () {
    const ov = document.getElementById('nego-overlay'); if (ov) ov.remove();
    window._nego = null;
  };

  window.negoMakeOffer = function () {
    const s = window._nego; if (!s || s.done) return;
    const p = negoPlayer(s); if (!p) return;
    s.clause = s.clausePresets[s.clauseIdx] || 0;
    const ev = negoEvaluate(s, s.dem, p);

    // Wer die Gegenforderung erfüllt, bekommt die Unterschrift sicher.
    if (s.counterSat && ev.sat >= s.counterSat) { negoAccept(); return; }

    s.rounds++;
    if (Math.random() * 100 < ev.chance) { negoAccept(); return; }

    // Abgelehnt — die Forderung zieht leicht an.
    s.dem.wage = (typeof roundWage === 'function')
      ? roundWage(s.dem.wage * (1 + VERTRAG.aufschlagRunde))
      : Math.round(s.dem.wage * (1 + VERTRAG.aufschlagRunde));

    if (s.rounds >= VERTRAG.maxRunden) {
      s.counterWage = null; s.counterSat = null; s.done = true;
      s.msg = { type: 'reject', text: '„Wir kommen nicht zusammen."' };
      if (!s.buyCtx && window.MoraleSystem) { try { MoraleSystem.addMorale([p], -6); } catch (e) {} }
      if (typeof addNews === 'function') addNews('club', `Verhandlung gescheitert: ${p.name}`,
        s.buyCtx ? `${displayName(p)} und sein Berater konnten sich mit dir nicht einigen — der Transfer platzt.` : `${displayName(p)} ist mit den Angeboten unzufrieden — die Gespräche sind vorerst beendet.`);
      if (typeof saveGameState === 'function') saveGameState();
      renderNegotiation(); return;
    }

    const konter = wageFuerSat(s, s.dem, p, VERTRAG.konterZiel);
    if (konter == null) {
      // Am Gehalt allein ist die Zusage nicht mehr zu holen — es ist die Rolle.
      // Ehrlich benennen statt eine Gegenforderung zu versprechen, die nichts
      // bringt: mit einer zu kleinen Rolle ist die Zufriedenheit gedeckelt.
      const deckel = Math.round(maxSatMoeglich(s, s.dem, p));
      s.counterWage = null; s.counterSat = null;
      s.msg = { type: 'reject', text: ev.rolleZuKlein
        ? `„So eine Nebenrolle kommt nicht infrage." Mehr Gehalt allein reicht nicht — damit sind höchstens ${deckel} % Zufriedenheit drin. Biete ihm eine größere Rolle an.`
        : '„Das passt für uns hinten und vorne nicht."' };
    } else {
      s.counterWage = konter; s.counterSat = VERTRAG.konterZiel;
      s.msg = { type: 'counter', text: (ev.rolleZuKlein
        ? '„Mit dieser Rolle unter Wert — dann muss beim Gehalt mehr kommen." '
        : '„Da geht noch was." ') + `Gegenforderung: ${euro(konter)}/Woche.` };
    }
    renderNegotiation();
  };
  window.negoAcceptCounter = function () {
    const s = window._nego; if (!s || !s.counterWage) return;
    s.wage = s.counterWage; s.msg = null;      // counterSat bleibt → Zusage sicher
    window.negoMakeOffer();
  };

  function negoAccept() {
    const s = window._nego; const p = negoPlayer(s); if (!p) return;
    // Kauf: der Kauf-Callback erledigt Ablöse/Gehalt/Kaderaufnahme und validiert das Budget.
    const prem = (s.premPresets && s.premPresets[s.premIdx]) || {};
    if (s.buyCtx && typeof s.buyCtx.onAccept === 'function') {
      const res = s.buyCtx.onAccept({ wage: s.wage, years: s.years, role: s.role, bonus: s.bonus, clause: s.clause, prem: { perGoal: prem.perGoal || 0, perApp: prem.perApp || 0 } });
      if (res && res.ok === false) { s.msg = { type: 'reject', text: res.msg }; renderNegotiation(); return; }
      s.done = true; window.negoClose();
      if (typeof renderAll === 'function') renderAll();
      if (typeof renderTransferTab === 'function') renderTransferTab();
      if (typeof saveGameState === 'function') saveGameState();
      return;
    }
    const wageDelta = s.wage - (p.wage || 0);
    // DFL (D40/D41): Cap-Prüfung mit vollem Cap Hit, Handgeld in Raten statt aus der Kasse
    const dflPruefung = (typeof window.dflVertragPruefen === 'function') ? window.dflVertragPruefen(p, s) : undefined;
    if (typeof dflPruefung === 'string') { s.msg = { type: 'reject', text: dflPruefung }; renderNegotiation(); return; }
    if (dflPruefung === undefined) {
      if (wageDelta > 0 && (CLUB.wageBudget || 0) < wageDelta) {
        s.msg = { type: 'reject', text: `Nicht genug freies Gehaltsbudget (+${euro(wageDelta)}/Wo nötig, frei ${euro(CLUB.wageBudget || 0)}/Wo).` };
        renderNegotiation(); return;
      }
      if (s.bonus > 0 && (CLUB.budget || 0) < s.bonus) {
        s.msg = { type: 'reject', text: `Handgeld ${euro(s.bonus)} übersteigt das Transferbudget (${euro(CLUB.budget || 0)}).` };
        renderNegotiation(); return;
      }
      if (s.bonus > 0) CLUB.budget -= s.bonus;
    }
    // DFL (D92): Verlängerung = Folgevertrag ab dem alten Vertragsende – laufendes Gehalt und Vertragsende bleiben
    // (dfl_saisonwechsel_patch.js); ohne das Modul ersetzt dflVertragAbschliessen den laufenden Vertrag wie bisher
    const folge = dflPruefung === null && typeof window.dflFolgevertrag === 'function' ? window.dflFolgevertrag(p, s) : null;
    if (!folge) {
      CLUB.wageBudget = Math.max(0, Math.min(CLUB.wageCap || 0, (CLUB.wageBudget || 0) - wageDelta));
      p.wage = s.wage;
      p.contractUntil = LEAGUE.season + s.years;
    }
    p.squadRole = s.role;
    delete p.releaseClause;
    if (prem.perGoal || prem.perApp) p.contractBonuses = { perGoal: prem.perGoal || 0, perApp: prem.perApp || 0 }; else delete p.contractBonuses;
    delete p.expiring;
    if (!folge && typeof window.dflVertragAbschliessen === 'function') window.dflVertragAbschliessen(p, s);
    if (window.MoraleSystem) { try { MoraleSystem.addMorale([p], 5); } catch (e) {} }
    const untilLbl = folge ? folge.bis : (typeof seasonEndYear === 'function') ? seasonEndYear(p.contractUntil) : p.contractUntil;
    if (typeof addNews === 'function') addNews('club', `✍️ Vertrag verlängert: ${p.name}`, folge
      ? `${displayName(p)} unterschreibt einen Folgevertrag ab ${folge.ab} bis ${untilLbl} — ${euro(folge.gesamt)} insgesamt, Rolle ${ROLES[s.role].label}. Bis dahin gilt sein alter Vertrag.`
      : `${displayName(p)} unterschreibt bis ${untilLbl} — ${euro(p.wage)}/Woche, Rolle ${ROLES[s.role].label}${s.bonus ? `, Handgeld ${euro(s.bonus)}` : ''}.`);
    window.negoClose();
    if (typeof renderAll === 'function') renderAll();
    if (typeof renderClubTab === 'function') renderClubTab();
    if (typeof renderScoutTab === 'function') renderScoutTab();
    if (typeof renderVertraegeFallsOffen === 'function') renderVertraegeFallsOffen();
    if (typeof saveGameState === 'function') saveGameState();
  }

  function satColor(c) { return c >= 70 ? 'var(--accent)' : c >= 35 ? 'var(--gold)' : 'var(--red)'; }

  function renderNegotiation() {
    const s = window._nego; if (!s) return;
    const p = negoPlayer(s); if (!p) { window.negoClose(); return; }
    s.clause = s.clausePresets[s.clauseIdx] || 0;
    const ev = negoEvaluate(s, s.dem, p);
    const sicher = !!(s.counterSat && ev.sat >= s.counterSat);
    const dem = s.dem;
    const role = ROLES[s.role];
    const stepper = (field, valHtml) => `<div class="nego-row"><span class="nego-label">${field.lbl}</span>
      <span class="nego-stepper"><button class="nego-step-btn" onclick="negoAdjust('${field.k}',-1)">−</button>
        <span class="nego-val">${valHtml}</span>
        <button class="nego-step-btn" onclick="negoAdjust('${field.k}',1)">+</button></span></div>`;

    let ov = document.getElementById('nego-overlay');
    if (!ov) { ov = document.createElement('div'); ov.id = 'nego-overlay'; ov.className = 'exp-overlay'; document.body.appendChild(ov); }

    const msgHtml = s.msg
      ? `<div class="nego-msg nego-${s.msg.type}">💬 ${s.msg.text}</div>` : '';
    const counterBtn = s.counterWage
      ? `<button class="nego-btn ghost" onclick="negoAcceptCounter()">Gegenforderung übernehmen</button>` : '';
    const actions = s.done
      ? `<button class="nego-btn primary" onclick="negoClose()">Schließen</button>`
      : `<button class="nego-btn ghost" onclick="negoClose()">Abbrechen</button>${counterBtn}<button class="nego-btn primary" onclick="negoMakeOffer()">Angebot machen</button>`;

    ov.innerHTML = `<div class="nego-card">
      <div class="nego-head">
        <div>
          <div class="nego-name">${p.flag ? p.flag + ' ' : ''}${displayName(p)} <span class="nego-role-badge">${dem.role.label}</span>${s.buyCtx ? ' <span class="nego-step-tag">Dialog 2/2 · Spielervertrag</span>' : ''}${typeof infoBtn === 'function' ? infoBtn('vertrag') : ''}</div>
          <div class="nego-sub">${s.buyCtx
            ? `${p.age} J · ${(p.positions && p.positions[0]) || p.pos} · OVR ${p.ovr} · Marktwert ${euro(s.val)} · von ${p.fromClub || '—'}`
            : `${p.age} J · ${(p.positions && p.positions[0]) || p.pos} · OVR ${p.ovr} · Vertrag bis ${(typeof seasonEndYear === 'function') ? seasonEndYear(p.contractUntil) : p.contractUntil} · aktuell ${euro(p.wage || 0)}/Wo · Moral ${Math.round(p.morale != null ? p.morale : 70)}`}</div>
        </div>
      </div>
      <div class="nego-demand">Forderung: <b>${euro(dem.wage)}/Woche</b> · ${dem.years} Jahre · Rolle ${dem.role.label}${dem.wantsClause ? ' · Ausstiegsklausel erwünscht' : ''}</div>
      <div class="nego-ctrls">
        ${stepper({ k: 'wage', lbl: 'Gehalt / Woche' }, euro(s.wage))}
        ${stepper({ k: 'years', lbl: 'Laufzeit' }, s.years + (s.years === 1 ? ' Jahr' : ' Jahre'))}
        ${stepper({ k: 'bonus', lbl: 'Handgeld (über die Laufzeit)' }, s.bonus ? euro(s.bonus) : '—')}
        <div class="nego-row"><span class="nego-label">Kaderrolle</span>
          <button class="nego-pick" onclick="negoCycleRole()">${role.label} ▾</button></div>
        <div class="nego-row"><span class="nego-label">Prämien (Tor / Einsatz)</span>
          <button class="nego-pick" onclick="negoCyclePrem()">${s.premPresets[s.premIdx].label} ▾</button></div>
      </div>
      <div class="nego-sat">
        <div class="nego-sat-lbl"><span>Erfolgschance</span><span style="color:${satColor(ev.chance)};font-weight:800">${Math.round(ev.chance)} %</span></div>
        <div class="nego-sat-track"><div class="nego-sat-fill" style="width:${Math.round(ev.chance)}%;background:${satColor(ev.chance)}"></div></div>
        <div style="font-size:10.5px;color:var(--text3);margin-top:5px">
          Zufriedenheit des Beraters: ${ev.sat} %${sicher ? ' · Gegenforderung erfüllt: Zusage sicher' : ''}${(typeof europaLabel === 'function' && europaLabel()) ? ' · <span style="color:var(--accent,#3fb950)">' + europaLabel() + ' zählt mit</span>' : ''}<br>
          Versuch ${Math.min(s.rounds + 1, VERTRAG.maxRunden)} von ${VERTRAG.maxRunden}
        </div>
      </div>
      ${msgHtml}
      <div class="nego-actions">${actions}</div>
    </div>`;
  }

  // Streikende beim Spiel-Laden aus der Aufstellung entfernen (nicht aufstellbar).
  if (typeof window.goToFixture === 'function') {
    const _gtf = window.goToFixture;
    window.goToFixture = function () {
      const r = _gtf.apply(this, arguments);
      try { own().forEach(p => { if (p.onStrike && typeof clearFromLineup === 'function') clearFromLineup(p.id); }); } catch (e) {}
      return r;
    };
    try { goToFixture = window.goToFixture; } catch (e) {}
  }

  // Marktwert-Abschlag bei Unzufriedenheit (wirkt auf Anzeige UND Verkaufspreis).
  if (typeof window.computeMarketValue === 'function') {
    const _cmv = window.computeMarketValue;
    window.computeMarketValue = function (p) {
      let v = _cmv.apply(this, arguments);
      try { if (p && p._dcStage && !p.onLoanFrom) v = Math.round(v * (DISCONTENT.discount[p._dcStage] || 1)); } catch (e) {}
      return v;
    };
    try { computeMarketValue = window.computeMarketValue; } catch (e) {}
  }

  // Verlängerung ohne Jahres-Argument öffnet jetzt die Verhandlung.
  if (typeof window.renewContract === 'function') {
    const _renew = window.renewContract;
    window.renewContract = function (squadId, years) {
      if (years == null) { window.openNegotiation(squadId); return; }
      return _renew.apply(this, arguments);
    };
    try { renewContract = window.renewContract; } catch (e) {}
  }

  // Vertrags-Prämien auszahlen: Tor-/Einsatzbonus, wenn ein EIGENER Spieler mit
  // contractBonuses trifft bzw. in einem Pflichtspiel eingesetzt wird.
  function payContractBonus(p, key) {
    if (!p || !p.contractBonuses || !p.contractBonuses[key] || typeof CLUB === 'undefined') return;
    if (typeof CURRENT_FIXTURE !== 'undefined' && CURRENT_FIXTURE && CURRENT_FIXTURE.type === 'friendly') return; // Testspiele zählen nicht
    const amt = p.contractBonuses[key];
    CLUB.budget -= amt;
    if (key === 'perGoal' && typeof showToast === 'function') { try { showToast(`${displayName(p)}: Torprämie ${(typeof formatEuro === 'function' ? formatEuro(amt) : amt)} fällig`, 'money'); } catch (e) {} }
  }
  if (typeof window.addPlayerGoal === 'function') {
    const _apg = window.addPlayerGoal;
    window.addPlayerGoal = function (p, season) { const r = _apg.apply(this, arguments); try { payContractBonus(p, 'perGoal'); } catch (e) {} return r; };
    try { addPlayerGoal = window.addPlayerGoal; } catch (e) {}
  }
  if (typeof window.addPlayerApp === 'function') {
    const _apa = window.addPlayerApp;
    window.addPlayerApp = function (p, season) { const r = _apa.apply(this, arguments); try { payContractBonus(p, 'perApp'); } catch (e) {} return r; };
    try { addPlayerApp = window.addPlayerApp; } catch (e) {}
  }

  console.log('[Contracts v1] aktiv — Verhandlung, Kaderrollen (OVR-basiert), Einsatzzeit-Zufriedenheit, Vertragsprämien');
})();