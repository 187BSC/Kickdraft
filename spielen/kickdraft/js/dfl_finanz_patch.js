/* ═══════════════════════════════════════════════════════════════════════════
   DFL-FINANZEN IM SPIEL  ·  v2
   ─────────────────────────────────────────────────────────────────────────
   Hängt den eigenen Verein an dasselbe Finanzmodell wie die KI (dfl_finanzen.js, D41):
     · Saisonplan: Kaderkosten = Cap Hits × 1,1 (Gehalt + Handgeld in Raten + Dead Cap),
       TV-Topf 92 % des Caps, Ticketteilung (34 % an den Gast), Betrieb 20 % der Einnahmen
     · Kaderänderungen nach dem Plan (Draft, Free Agency, Trades, Entlassungen) kosten bzw.
       sparen Woche für Woche – vorher waren Neuzugänge im ersten Jahr umsonst
     · keine 6-Mio-Mindestkasse mehr (die füllte jedes geplante Minus auf), dafür
       6 Mio Startguthaben zum Karrierestart
     · Finanzübersicht im Verein-Reiter als Saisonplan (die alte Prognose zählte
       Einnahmen und Gehälter doppelt)
   v2 (D75, 2026-10-11):
     · Unterhalt der Anlagen als eigene Zeile im Saisonplan (DFLFinanzen.unterhalt, Stadion
       60 € je Platz); Ausbau oder Rückbau mitten in der Saison wirkt Woche für Woche
     · Ausbaupreise mit dem Preisindex (Cap ÷ 120 Mio) wie bei der KI
     · marodes Stadion (Zustand unter 100 %) kostet bis 10 % Zuschauer – Plan und Abrechnung gleich
     · Heimspiele „gleich gerechnet“ (eigener Punkt zu D75): der Plan ist der Erwartungswert
       (mittlere Saison, Ø-Gegner der eigenen Heimspiele, Fanstimmung zum Saisonstart, ohne
       Vorsichtsabschlag), je Heimspiel wird nur die Abweichung davon gebucht – und wie jede
       Ticketeinnahme gehen 34 % davon an den Gast; die Fanstimmung bewegt die Tickets um ±5 %
       (D35, wie das Prestige der KI; vorher −20 … +25 %). Vorher brachte jedes Heimspiel Ø 2,1 Mio mehr als geplant.
   Lädt nach dfl_trainingsgruppe_patch.js und vor dfl_eigentuemer_patch.js (der Eigentümer
   merkt sich den korrigierten Plan).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const F = window.DFLFinanzen;
  if (!F) { console.warn('[DFL-Finanzen im Spiel] DFLFinanzen fehlt'); return; }

  const dfl = () => typeof CLUB !== 'undefined' && CLUB && CLUB.dfl && CLUB.dfl.aktiv;
  const cap = () => (window.DFLKader && DFLKader.cap ? DFLKader.cap() : F.CFG.startCap);
  const kaderKosten = () => (window.DFLKader && DFLKader.capBelegt ? DFLKader.capBelegt() : 0);
  const mio = x => (Math.round(x / 1e5) / 10).toLocaleString('de-DE') + ' Mio €';
  const vz = x => (x >= 0 ? '+' : '−') + mio(Math.abs(x));
  const START_GUTHABEN = 6000000;

  // ── 1) BudgetSystem auf DFL-Regeln ───────────────────────────────────────
  function konfigurieren() {
    if (!window.BudgetSystem || !BudgetSystem.config) return;
    const C = BudgetSystem.config;
    C.opsShareOfIncome.bundesliga = F.betriebAnteil ? F.betriebAnteil() : F.CFG.betrieb;   // D75: 20 % (Anlagen kosten einzeln)
    C.staffCostFactor = F.CFG.stab;
    // Keine Mindestkasse: ein geplantes Minus bleibt ein Minus (vorher gab es jedes Jahr bis zu 6 Mio geschenkt)
    C.minTransferBudget.bundesliga = -1e12;
    // Die Kasse bleibt ganz stehen wie bei der KI (D41) – der alte Deckel (3 Jahresbudgets) schöpfte still ab,
    // gemessen am alten Plan (Prüfung 2026-10-09: 120 Mio ohne Meldung weg)
    C.carryOverShare = 1; C.carryOverMax = Infinity;
  }
  konfigurieren();
  // Ausbaupreise auf DFL-Niveau (× 4, siehe DFLFinanzen.CFG.ausbauFaktor) – gleiche Preise wie für die KI.
  // D75: alle Preise wachsen mit dem Preisindex (Cap ÷ 120 Mio), auch das Stadion (Grundpreise wie bisher, ohne × 4).
  // Die Medizin (D102) legt dfl_medizin_patch.js später an – preiseSetzen() läuft deshalb auch beim Saisonwechsel und Laden.
  let stadionBasis = null;
  try { if (FACILITY_DEFS.stadium) stadionBasis = FACILITY_DEFS.stadium.cost.slice(); } catch (e) { /* ohne Spiel */ }
  function preiseSetzen() {
    if (typeof FACILITY_DEFS === 'undefined' || !FACILITY_DEFS) return;
    const pi = dfl() && F.anlagenAktiv && F.anlagenAktiv() ? F.preisIndex(cap()) : 1;
    ['training', 'scouting', 'merchandising', 'medizin'].forEach(art => {
      if (FACILITY_DEFS[art] && F.CFG.ausbau[art]) FACILITY_DEFS[art].cost = F.ausbauPreise(art).map(x => Math.round(x * pi));
    });
    if (FACILITY_DEFS.stadium && stadionBasis) FACILITY_DEFS.stadium.cost = stadionBasis.map(x => Math.round(x * pi));
  }
  try { preiseSetzen(); } catch (e) { /* ohne Spiel */ }

  // ── 1b) Erfolg vor dem 1. Spieltag neutral (0,5) ────────────────────────
  // Die leere Tabelle sortiert nach Namen – der Merch-Plan hing am Alphabet (München Platz 28: −5,4 Mio je Saison,
  // Prüfung 2026-10-09). Tickets planen schon mit 0,5.
  {
    const _orig = window.fcmSuccessFactor;
    if (typeof _orig === 'function') {
      window.fcmSuccessFactor = function () {
        try { if (dfl() && typeof LEAGUE !== 'undefined' && LEAGUE && !(LEAGUE.matchday >= 1)) return 0.5; } catch (e) { /* wie bisher */ }
        return _orig.apply(this, arguments);
      };
      try { fcmSuccessFactor = window.fcmSuccessFactor; } catch (e) { /* nicht global gebunden */ }
    }
  }

  // ── 2) TV-Topf = 92 % des Caps ───────────────────────────────────────────
  {
    const _orig = window.tvGemeinsamJeVerein;
    window.tvGemeinsamJeVerein = function () {
      const alt = typeof _orig === 'function' ? _orig.apply(this, arguments) : null;
      return alt == null ? null : F.tv(cap());
    };
    const _tvGruppe = window.computeTvMoneyForGroup;
    if (typeof _tvGruppe === 'function') window.computeTvMoneyForGroup = function (teams) {
      const out = _tvGruppe.apply(this, arguments);
      if (dfl() && out) Object.keys(out).forEach(id => { out[id] = F.tv(cap()); });
      return out;
    };
  }

  // ── 2b) Tickets (D44, Wunsch 2026-10-08): wie in der NFL meist ausverkauft ──
  // Starke Saison + hohe Preise → trotzdem voll; schwache Saison + hohe Preise → leer. Der Erfolg dämpft den
  // Preiseffekt (vorher wirkte er immer voll, und die Grundnachfrage lag bei 55 %). Gemessen, 42.000 Plätze,
  // Preise +2/+2: Platz 8 62 % → 87 %, Platz 16 54 % → 69 %, Platz 32 38 % → 39 %; normale Preise Mitte 82 % → 92 %.
  // Die Fanstimmung reagiert weiter auf die Preise (engine_main.js), der Plan rechnet mit derselben Kurve.
  const klemme = (x, a, b) => Math.max(a, Math.min(b, x));
  const komfort = () => { try { return ((CLUB.facilities.stadium || 1) - 1) * 0.006; } catch (e) { return 0; } };
  // D75: Zustand des eigenen Stadions (dfl_anlagen_patch.js); ein marodes Stadion kostet bis 10 % Zuschauer
  // (vor dem ersten Speichern – Karrierestart – gilt der Startzustand der Welt, wie ihn dfl_anlagen_patch.js übernimmt)
  function stadionZustand() {
    try {
      const a = CLUB.dfl.anlagen;
      if (a && a.zustand && a.zustand.stadium != null) return a.zustand.stadium;
      const D = window.DFLSpiel, L = D.liga(), t = L.teams.find(x => x.id === D.eigeneDflId());
      if (F.anlagenStart) F.anlagenStart(t, L.seed);
      return t.zustand && t.zustand.stadion != null ? t.zustand.stadion : 100;
    } catch (e) { return 100; }
  }
  function ticketNachfrage(erfolg, tl, sl, gegnerBonus) {
    const druck = (tl * 0.09 + sl * 0.05) * klemme(1.6 * (1 - erfolg), 0.15, 1.2);
    return klemme(0.86 + 0.5 * (erfolg - 0.5) - druck + gegnerBonus + komfort(), 0.30, 1) * F.komfort(stadionZustand());
  }
  const gegnerBonus = ovr => (typeof ovr === 'number' ? klemme((ovr - 65) / 250, 0, 0.08) : 0);
  // Ø-Gegner der eigenen Heimspiele (D75: Plan und Abrechnung mit demselben Gegner; vorher fest 0,04 = Stärke 75)
  function gegnerBonusPlan() {
    try {
      const plan = (LEAGUE.fixtures && window.DFLSpiel && LEAGUE.fixtures[DFLSpiel.KEY]) || [];
      const teams = LEAGUE.tiers.bundesliga.groups[0].teams;
      const ovr = id => { const t = teams.find(x => x.id === id); return t && typeof t.ovr === 'number' ? t.ovr : null; };
      const b = [];
      plan.forEach(tag => tag.forEach(([h, g]) => { if (h === 'fcm' && ovr(g) != null) b.push(gegnerBonus(ovr(g))); }));
      if (!b.length) teams.forEach(t => { if (t.id !== 'fcm' && typeof t.ovr === 'number') b.push(gegnerBonus(t.ovr)); });
      return b.length ? b.reduce((s, x) => s + x, 0) / b.length : 0.04;
    } catch (e) { return 0.04; }
  }
  // D75 · eigener Punkt (D35 Vorschlag 4): die Fanstimmung bewegt die Tickets um ±5 % – wie das Prestige der KI (DFLFinanzen.nachfrage).
  // Vorher −20 … +25 % (Erwartungs-System des alten Spiels): mit zufriedenen Fans brachte jedes Heimspiel bis ein Viertel mehr als bei
  // der KI. Merch bleibt bei ±10 % (dfl_eigentuemer_patch.js).
  const FANS_TICKETS = 0.05;
  try {
    if (typeof EXP !== 'undefined' && EXP && typeof EXP.ticketSatisfactionMult === 'function') {
      const _orig = EXP.ticketSatisfactionMult;
      EXP.ticketSatisfactionMult = function () {
        if (!dfl() || !F.anlagenAktiv || !F.anlagenAktiv()) return _orig.apply(this, arguments);
        const f = EXP.state ? EXP.state().fanSatisfaction : 50;
        return 1 + FANS_TICKETS * (klemme(f == null ? 50 : f, 0, 100) - 50) / 50;
      };
    }
  } catch (e) { /* ohne Erwartungs-System */ }
  // Saisonplan (bundle_economy.js fixIncome) und Ticket-Blatt: mittlere Saison, Ø-Gegner der eigenen Heimspiele
  window.dflTicketNachfrage = function (erfolg, tl, sl) { return dfl() ? ticketNachfrage(erfolg, tl, sl, gegnerBonusPlan()) : null; };
  {
    const _orig = window.stadiumFillRate;
    if (typeof _orig === 'function') window.stadiumFillRate = function (opponentOvr) {
      if (!dfl() || typeof fcmSuccessFactor !== 'function') return _orig.apply(this, arguments);
      return ticketNachfrage(fcmSuccessFactor(), CLUB.ticketLevel || 0, CLUB.seasonTicketLevel || 0, gegnerBonus(opponentOvr));
    };
  }
  // Ticketeinnahme eines Heimspiels – dieselbe Rechnung wie matchAttendanceIncome (engine_main.js), aber mit wählbaren
  // Bedingungen: erfolg 0…1, Gegner-Bonus, Fan-Faktor (EXP.ticketSatisfactionMult; neutral = 1)
  function ticketsJeSpiel(erfolg, bonus, fans) {
    const plaetze = stadiumCapacityForLevel(CLUB.facilities.stadium);
    const fill = ticketNachfrage(erfolg, CLUB.ticketLevel || 0, CLUB.seasonTicketLevel || 0, bonus);
    const block = Math.round(plaetze * dauerkartenAnteil());
    const tages = Math.max(0, Math.round(plaetze * fill) - block) * currentTicketPrice();
    const dauer = Math.round(block * currentSeasonTicketPrice() / HOME_MATCHDAYS_PER_SEASON);
    return Math.round(tages * fans) + Math.round(dauer * fans);
  }
  // D75 · eigener Punkt: Abweichung eines Heimspiels vom Plan (Haken in processFixtureResult, app_main.js).
  // Plan je Heimspiel = Tickets in einer mittleren Saison mit der Fanstimmung zum Saisonstart (bd.dflTicketBasis); gebucht wird die
  // Abweichung des echten Spiels davon – 34 % gehen wie jede Ticketeinnahme an den Gast. Merch wie bisher gegen den Plan vom Saisonbeginn.
  window.dflHeimAbweichung = function (gate, geplantGate, merchIst, geplantMerch) {
    if (!dfl() || !gate) return null;
    const bd = CLUB._budgetBreakdown || {};
    let basis = bd.dflTicketBasis;
    if (basis == null) { try { basis = ticketsJeSpiel(0.5, gegnerBonusPlan(), fanFaktor()); } catch (e) { basis = geplantGate; } }
    const tickets = (1 - F.CFG.gastAnteil) * ((gate.total || 0) - basis);
    const merch = (merchIst || 0) - (geplantMerch || 0);
    bd.dflHeimAbw = (bd.dflHeimAbw || 0) + tickets; bd.dflHeimMerch = (bd.dflHeimMerch || 0) + merch; bd.dflHeimSpiele = (bd.dflHeimSpiele || 0) + 1;
    return tickets + merch;
  };

  // ── 3) Saisonplan nachrechnen ────────────────────────────────────────────
  // Ticketteilung: 34 % der eigenen Tickets an die Gäste, 34 % der Gegner-Tickets bei Auswärtsspielen
  function gastEinnahmen() {
    if (typeof LEAGUE === 'undefined' || !LEAGUE || !window.DFLSpiel) return 0;
    const plan = (LEAGUE.fixtures && LEAGUE.fixtures[DFLSpiel.KEY]) || [];
    const L = DFLSpiel.liga(), c = cap();
    let summe = 0;
    plan.forEach(tag => tag.forEach(([h, g]) => {
      if (g !== 'fcm') return;
      const t = L.teams.find(x => x.id === DFLSpiel.dflIdVon(h));
      if (t) summe += F.ticketsHeim(t, c) / F.CFG.heimspiele;
    }));
    return summe;
  }
  function planKorrigieren() {
    if (!dfl()) return;
    const bd = CLUB._budgetBreakdown;
    if (!bd || !bd.income || !bd.cost || bd.dflKorrigiert === LEAGUE.season + ':' + Math.round(bd.fixBalance)) return;
    const inc = bd.income, cost = bd.cost, G = F.CFG;
    const tvNeu = F.tv(cap());
    // Tickets wie die Abrechnung je Heimspiel (matchAttendanceIncome) – fixIncome rechnete × 1,4 (INCOME, Altlast)
    // und lag damit gemessen 4 Mio (alte Kurve) bzw. 11 Mio (D44) je Saison über dem, was hereinkam
    const tp = ticketPlan(), dTickets = tp ? (tp.dauer + tp.tages) - ((inc.seasonTickets || 0) + (inc.matchday || 0)) : 0;
    if (tp) { inc.seasonTickets = tp.dauer; inc.matchday = tp.tages; }          // dTickets zählt unten in dEin (vorher doppelt in der Anzeige)
    const eigeneTickets = (inc.seasonTickets || 0) + (inc.matchday || 0);
    const teilung = G.gastAnteil * (gastEinnahmen() - eigeneTickets);
    const dEin = (tvNeu - (inc.tv || 0)) + teilung + dTickets;
    inc.tv = tvNeu; inc.teilung = teilung; inc.total += dEin;
    // Kosten neu zusammensetzen: Kader (Cap Hits × 1,1) + Betrieb (Anteil der Einnahmen) + D75 Unterhalt der Anlagen + Abschreibungen.
    // Vorher war der Betrieb max(alter Anlagen-Wochenunterhalt, Anteil) – den alten Unterhalt ersetzt die eigene Zeile.
    const altTotal = cost.total || 0;
    const personal = kaderKosten() * G.stab;
    const betrieb = inc.total * (F.betriebAnteil ? F.betriebAnteil() : G.betrieb);
    const unterhalt = unterhaltSaison();
    const trainer = trainerSaison();                    // D118: Trainerteam außerhalb des Caps, wie Betriebskosten
    cost.wages = personal; cost.running = betrieb; cost.anlagen = unterhalt; cost.dflUnterhalt = unterhalt; cost.trainer = trainer;
    cost.total = personal + betrieb + unterhalt + trainer + (cost.amort || 0);
    const dFix = dEin - (cost.total - altTotal);
    bd.fixBalance += dFix; bd.transfer = (bd.transfer || 0) + dFix;
    CLUB.budget += dFix;
    bd.dflKader = kaderKosten();                       // Basis für die wöchentliche Abweichung
    bd.dflUnterhalt = unterhalt;                       // D75: Basis für Ausbau/Rückbau mitten in der Saison
    bd.dflWochen = Math.max(1, letzteSpielwoche() - 1);
    bd.dflAbweichung = 0; bd.dflAnlagenAbw = 0;
    bd.dflTrainer = trainer; bd.dflTrainerAbw = 0;       // D118: Basis für Einstellungen/Abwerbungen mitten in der Saison
    // D75 · eigener Punkt: Ticketeinnahme je Heimspiel in einer mittleren Saison = Plan je Heimspiel (Abrechnung bucht nur die Abweichung)
    try { bd.dflTicketBasis = tp ? Math.round((tp.dauer + tp.tages) / HOME_MATCHDAYS_PER_SEASON) : null; bd.dflGegnerBonus = gegnerBonusPlan(); } catch (e) { bd.dflTicketBasis = null; }
    bd.dflKorrigiert = LEAGUE.season + ':' + Math.round(bd.fixBalance);
  }
  // Geplante Tickets: mittlere Saison (Erfolg 0,5), Ø-Gegner der eigenen Heimspiele, Fanstimmung zum Saisonstart; Dauerkarten-Block + Tageskarten.
  // D75 · eigener Punkt: ohne Vorsichtsabschlag (vorher × 0,92) und mit der Fanstimmung (vorher ohne, bis +25 %) – der Plan ist der
  // Erwartungswert, die Abrechnung bucht nur die Abweichung; vorher brachte jedes Heimspiel systematisch mehr als geplant.
  // Rechnung wie ticketsJeSpiel/matchAttendanceIncome.
  const fanFaktor = () => { try { return typeof EXP !== 'undefined' && EXP.ticketSatisfactionMult ? EXP.ticketSatisfactionMult() : 1; } catch (e) { return 1; } };
  function ticketPlan() {
    try {
      const heim = HOME_MATCHDAYS_PER_SEASON;
      const d75 = dfl() && F.anlagenAktiv && F.anlagenAktiv();
      if (d75) {
        const plaetze = stadiumCapacityForLevel(CLUB.facilities.stadium), block = Math.round(plaetze * dauerkartenAnteil());
        const jeSpiel = ticketsJeSpiel(0.5, gegnerBonusPlan(), fanFaktor());
        const dauer = Math.round(block * currentSeasonTicketPrice() / heim) * heim;
        return { dauer, tages: jeSpiel * heim - dauer };
      }
      const plaetze = stadiumCapacityForLevel(CLUB.facilities.stadium);
      const vorsicht = (window.BudgetSystem && BudgetSystem.config && BudgetSystem.config.planVorsicht) || 0.92;
      const fuellung = ticketNachfrage(0.5, CLUB.ticketLevel || 0, CLUB.seasonTicketLevel || 0, 0.04) * vorsicht;
      const block = Math.round(plaetze * dauerkartenAnteil());
      const tages = Math.max(0, plaetze * fuellung - block);
      return { dauer: block * currentSeasonTicketPrice(), tages: heim * tages * currentTicketPrice() };
    } catch (e) { return null; }
  }
  // ── D75: Unterhalt der eigenen Anlagen (gleiche Zahlen wie die KI: DFLFinanzen.unterhalt, Stadion je Platz) ──
  const medStufe = () => (window.DFLMedizin && DFLMedizin.stufe ? DFLMedizin.stufe() : ((CLUB.facilities && CLUB.facilities.medizin) || 1));
  const plaetzeJetzt = () => (typeof stadiumCapacityForLevel === 'function' ? stadiumCapacityForLevel((CLUB.facilities && CLUB.facilities.stadium) || 1) : 20000);
  function anlagenJe() {
    const f = CLUB.facilities || {}, c = cap(), je = {};
    ['training', 'scouting', 'merchandising', 'medizin'].forEach(art => { je[art] = F.unterhalt(art, art === 'medizin' ? medStufe() : (f[art] || 1), c); });
    je.stadium = F.stadionUnterhalt(plaetzeJetzt(), c);
    return je;
  }
  // D118: Gehälter des Trainerteams in dieser Saison (Entlassene zählen bis zum Saisonende weiter: Restgehalt)
  function trainerSaison() {
    try { return dfl() && window.DFLTrainerteam ? DFLTrainerteam.saisonKosten() : 0; } catch (e) { return 0; }
  }
  function unterhaltSaison() {
    if (!dfl() || !F.anlagenAktiv || !F.anlagenAktiv()) return 0;
    const je = anlagenJe();
    return Object.keys(je).reduce((s, k) => s + je[k], 0);
  }
  function letzteSpielwoche() {
    const w = (typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.matchWeeks) || [];
    return w.length ? w[w.length - 1] : 34;
  }
  if (window.BudgetSystem && typeof BudgetSystem.recompute === 'function') {
    const _orig = BudgetSystem.recompute;
    BudgetSystem.recompute = function () {
      const r = _orig.apply(this, arguments);
      planKorrigieren();
      // computeSeasonBudget setzt das Gehaltsbudget aus den Einnahmen – in der DFL ist es der freie Cap-Platz
      if (dfl() && window.DFLKader && DFLKader.capSetzen) DFLKader.capSetzen();
      return r;
    };
  }
  {
    const _orig = window.startNewSeason;
    if (typeof _orig === 'function') window.startNewSeason = function () {
      const r = _orig.apply(this, arguments);
      try { preiseSetzen(); } catch (e) { console.warn('[DFL-Finanzen] Preise', e); }      // D75: neuer Cap → neue Ausbaupreise
      try { planKorrigieren(); saisonMeldung(); } catch (e) { console.warn('[DFL-Finanzen] Saisonplan', e); }
      return r;
    };
    try { startNewSeason = window.startNewSeason; } catch (e) { /* nur im Spiel */ }
  }
  // Karrierestart: Plan schon für Saison 1 (sonst zählte jede Ticketeinnahme als Mehreinnahme), dazu Startguthaben
  {
    const _orig = window.startNewGameState;
    if (typeof _orig === 'function') window.startNewGameState = async function () {
      const r = await _orig.apply(this, arguments);
      try { preiseSetzen(); } catch (e) { /* ohne Anlagen */ }
      if (dfl() && window.BudgetSystem) {
        try {
          BudgetSystem.recompute();
          // D143: beim Vereinswechsel übernimmst du die Kasse des neuen Vereins aus der Welt, sonst das Startguthaben
          const W = window.DFL_WECHSEL, t = W && window.DFLSpiel ? DFLSpiel.liga().teams.find(x => x.id === DFLSpiel.eigeneDflId()) : null;
          // Nutzer 2026-10-14: „Startkasse immer positiv“ – mindestens das Startguthaben eines neuen Spiels (D146)
          if (t && typeof t.kasse === 'number') CLUB.budget = Math.round(Math.max(t.kasse, START_GUTHABEN * F.preisIndex(cap())));
          else CLUB.budget += START_GUTHABEN * F.preisIndex(cap());
        } catch (e) { console.warn('[DFL-Finanzen] Start', e); }
      }
      return r;
    };
  }
  // Die Saisonbudget-Meldung des alten Systems rechnet mit den Zahlen vor der Korrektur → eigene Meldung
  {
    const _orig = window.addNews;
    if (typeof _orig === 'function') window.addNews = function (kat, titel) {
      if (dfl() && /Saisonbudget/.test(String(titel || ''))) return;
      return _orig.apply(this, arguments);
    };
    try { addNews = window.addNews; } catch (e) { /* nur im Spiel */ }
  }
  function saisonMeldung() {
    const bd = CLUB._budgetBreakdown; if (!bd || !bd.income) return;
    const i = bd.income, c = bd.cost;
    addNews('club', '💼 Saisonplan steht', `Einnahmen ${mio(i.total)} (TV ${mio(i.tv)}, Tickets ${mio((i.seasonTickets || 0) + (i.matchday || 0))}, ` +
      `Ticketteilung ${vz(i.teilung || 0)}, Merch ${mio(i.merch || 0)}, Sponsoren ${mio((i.sponsors || 0) + (i.banner || 0) + (i.klausel || 0))}). ` +
      `Kader ${mio(c.wages)} (Cap Hits × 1,1), Betrieb ${mio(c.running)}. Geplantes Ergebnis ${vz(bd.fixBalance)}. Kasse jetzt ${mio(CLUB.budget)}.`);
  }

  // ── 4) Kaderänderungen kosten Woche für Woche ────────────────────────────
  {
    const _orig = window.advanceCalendarWeek;
    if (typeof _orig === 'function') window.advanceCalendarWeek = function () {
      const r = _orig.apply(this, arguments);
      const bd = dfl() && CLUB._budgetBreakdown;
      if (r !== false && bd && bd.dflKader != null && LEAGUE.week <= letzteSpielwoche()) {
        const d = (kaderKosten() - bd.dflKader) * F.CFG.stab / (bd.dflWochen || 30);
        CLUB.budget -= d; bd.dflAbweichung = (bd.dflAbweichung || 0) + d;
        // D75: Ausbau (fertig) oder Rückbau mitten in der Saison ändert den Unterhalt ab dieser Woche
        if (bd.dflUnterhalt != null) {
          const u = (unterhaltSaison() - bd.dflUnterhalt) / (bd.dflWochen || 30);
          if (u) { CLUB.budget -= u; bd.dflAnlagenAbw = (bd.dflAnlagenAbw || 0) + u; }
        }
        // D118: Trainerteam – wer mitten in der Saison kommt, kostet ab dieser Woche (Entlassene zählen weiter)
        if (bd.dflTrainer != null) {
          const u = (trainerSaison() - bd.dflTrainer) / (bd.dflWochen || 30);
          if (u) { CLUB.budget -= u; bd.dflTrainerAbw = (bd.dflTrainerAbw || 0) + u; }
        }
      }
      return r;
    };
    try { advanceCalendarWeek = window.advanceCalendarWeek; } catch (e) { /* nur im Spiel */ }
  }

  // ── 5) Finanzübersicht: Saisonplan statt Wochenrechnung ──────────────────
  function zeile(text, wert, farbe, klein) {
    return `<div class="fin-row"><span class="fin-label">${text}${klein ? `<span style="color:var(--text3);font-size:9px;margin-left:4px">${klein}</span>` : ''}</span>` +
      `<span class="fin-val" style="color:${farbe || 'var(--text)'}">${wert}</span></div>`;
  }
  function uebersichtHtml() {
    const bd = CLUB._budgetBreakdown; if (!bd || !bd.income) return '';
    const i = bd.income, c = bd.cost, pos = 'var(--green,#3fb950)', neg = 'var(--red,#f85149)';
    const tickets = (i.seasonTickets || 0) + (i.matchday || 0);
    const rest = Math.max(0, letzteSpielwoche() - LEAGUE.week);
    const offenAnlagen = bd.dflUnterhalt != null ? (unterhaltSaison() - bd.dflUnterhalt) * rest / (bd.dflWochen || 30) : 0;
    const offenTrainer = bd.dflTrainer != null ? (trainerSaison() - bd.dflTrainer) * rest / (bd.dflWochen || 30) : 0;
    const offen = (bd.dflKader != null ? (kaderKosten() - bd.dflKader) * F.CFG.stab * rest / (bd.dflWochen || 30) : 0) + offenAnlagen + offenTrainer;
    const prognose = CLUB.budget - offen;
    const d75 = F.anlagenAktiv && F.anlagenAktiv(), anteil = Math.round((F.betriebAnteil ? F.betriebAnteil() : F.CFG.betrieb) * 100);
    const heim = bd.dflHeimSpiele ? ` · Heimspiele gegen Plan ${vz(bd.dflHeimAbw || 0)} (${bd.dflHeimSpiele})` : '';
    const anlagenAbw = bd.dflAnlagenAbw ? ` · Anlagen-Unterhalt seit Plan ${vz(-(bd.dflAnlagenAbw || 0))}` : '';
    const capQuote = kaderKosten() / ((window.DFLKader && DFLKader.capLimit()) || cap());
    return `<div class="finance-dash" id="finance-dash">
      <div class="fin-title"><i class="ti ti-coin"></i> Finanzen: Saisonplan${typeof infoBtn === 'function' ? infoBtn('finanzen') : ''}</div>
      <div class="fin-grid">
        <div class="fin-col">
          <div class="fin-col-head fin-in">Einnahmen (Saison)</div>
          ${zeile('TV-Topf', mio(i.tv), pos, '92 % des Caps, gleich für alle')}
          ${zeile('Tickets', mio(tickets), pos, 'Dauer- und Tageskarten')}
          ${zeile('Ticketteilung', vz(i.teilung || 0), (i.teilung || 0) >= 0 ? pos : neg, '34 % an den Gast, 34 % von Gegnern')}
          ${zeile('Merchandise', mio(i.merch || 0), pos)}
          ${zeile('Sponsoren & Banden', mio((i.sponsors || 0) + (i.banner || 0) + (i.klausel || 0)), pos)}
          ${zeile('Summe', mio(i.total), pos)}
        </div>
        <div class="fin-col">
          <div class="fin-col-head fin-out">Ausgaben (Saison)</div>
          ${zeile('Kader', mio(c.wages), neg, 'Cap Hits × 1,1')}
          ${d75 ? zeile('Betrieb', mio(c.running), neg, `${anteil} % der Einnahmen`) : zeile('Betrieb & Anlagen', mio(c.running), neg, `${anteil} % der Einnahmen`)}
          ${d75 ? zeile('Anlagen-Unterhalt', mio(c.dflUnterhalt != null ? c.dflUnterhalt : (c.anlagen || 0)), neg, 'je Stufe, Stadion je Platz') : ''}
          ${c.trainer ? zeile('Trainerteam', mio(c.trainer), neg) : ''}
          ${c.amort ? zeile('Abschreibungen', mio(c.amort), neg) : ''}
          ${zeile('Summe', mio(c.total), neg)}
        </div>
      </div>
      <div class="fin-balance">
        <div class="fin-bal-item"><div class="fin-bal-label">Geplantes Ergebnis</div><div class="fin-bal-val" style="color:${bd.fixBalance >= 0 ? pos : neg}">${vz(bd.fixBalance)}</div></div>
        <div class="fin-bal-item"><div class="fin-bal-label">Kasse jetzt</div><div class="fin-bal-val">${mio(CLUB.budget)}</div></div>
        <div class="fin-bal-item"><div class="fin-bal-label">Kasse Saisonende (Prognose)</div><div class="fin-bal-val" style="color:${prognose >= 0 ? pos : neg}">${mio(prognose)}</div></div>
      </div>
      <div class="fin-foot" style="font-size:11px;color:var(--text2);line-height:1.5;margin-top:8px">
        Plan schon in der Kasse · Kaderänderungen bisher ${vz(-(bd.dflAbweichung || 0))}${anlagenAbw}${heim} · <b>1 % Cap = ${mio(cap() * 0.01 * F.CFG.stab)} im Jahr</b> · Cap belegt ${Math.round(capQuote * 100)} %
      </div>
    </div>`;
  }
  {
    const _orig = window.renderClubTab;
    if (typeof _orig === 'function') window.renderClubTab = function () {
      const r = _orig.apply(this, arguments);
      if (dfl()) {
        try {
          const alt = document.getElementById('finance-dash'), html = uebersichtHtml();
          if (alt && html) alt.outerHTML = html;
        } catch (e) { console.warn('[DFL-Finanzen] Übersicht', e); }
      }
      return r;
    };
    try { renderClubTab = window.renderClubTab; } catch (e) { /* nur im Spiel */ }
  }

  // Ladeschritt nachholen (Spielstand lädt vor den Patches): Konfiguration steht schon, Plan ggf. korrigieren
  if (dfl()) { try { planKorrigieren(); } catch (e) { /* Plan fehlt noch */ } }

  window.DFLFinanzSpiel = { planKorrigieren, trainerSaison, gastEinnahmen, uebersichtHtml, START_GUTHABEN,
    // D75: Anlagen und Heimspiele gleich gerechnet
    anlagenJe, unterhaltSaison, preiseSetzen, ticketsJeSpiel, ticketPlan, gegnerBonusPlan, gegnerBonus, ticketNachfrage, stadionZustand };
  console.log('%c[DFL-Finanzen im Spiel v2] aktiv', 'color:#3fb950;font-weight:bold',
    '— Kader = Cap Hits × 1,1, TV 92 % des Caps, Ticketteilung 34 %, Kaderänderungen wöchentlich, keine Mindestkasse; D75: Betrieb 20 % + Anlagen-Unterhalt, Preisindex auf Ausbau, Heimspiele gleich gerechnet');
})();
