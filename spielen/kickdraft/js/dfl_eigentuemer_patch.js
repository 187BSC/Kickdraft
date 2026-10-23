/* ═══════════════════════════════════════════════════════════════════════════
   DFL · EIGENTÜMER & FINANZEN  ·  v1   (D35, D20; ersetzt den Vorstand)
   ─────────────────────────────────────────────────────────────────────────
   • Eigentümer mit zufälligem Profil (Investor, Traditionsverein, Mäzen). Er bewertet
     am Saisonende Gewinn, Erfolg und Fans – gewichtet nach Profil – und misst dich an
     den Möglichkeiten des Vereins: Gewinn gegen den Saisonplan (+ Profil-Zuschlag),
     Erfolg gegen den Stärke-Rang vor der Saison. Begeistert → Zuschuss, verärgert →
     Kürzung; zwei verärgerte Saisons → Ultimatum, die dritte → Entlassung.
   • Preisindex = Cap / 120 Mio für Tickets, Dauerkarten, Banden, Sponsorangebote, Merch.
   • Merch-Preisstufe −2 … +2 (Absatz, Marge, Fanstimmung).
   • Fanstimmung: Merch-Preise und volles Stadion wirken am Saisonende auf die Fans.
   • Cap-Untergrenze (D20) für den eigenen Verein: 89 % der Caps über 4 Saisons in bar
     (Gehälter + Handgelder), Fehlbetrag geht am Fensterende an die Spieler.
   • Sponsorboni: Titel / Playoffs / Conference-Finale statt Aufstieg / Top 3 / Pokal.

   Buchungen am Saisonwechsel: Das BudgetSystem setzt das Saisonbudget neu und nimmt nur
   den Kassenstand VOR dem Wechsel mit. Deshalb bucht dieses Modul vor dem Wechsel
   (Nachzahlung, Hauptsponsor) und nach dem Wechsel (Eigentümer-Folgen, Sponsorboni).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const CFG = {
    // 2026-10-21 (Fehleranalyse M6/F11, Nutzer „Entnahme auch für dich“): was über entnahme.ab Jahreseinnahmen liegt, nimmt der Eigentümer
    // am Saisonende – wie bei der KI (dfl_finanzen.js kasseMax); Rücklage und offene Untergrenze bleiben
    entnahme: { ab: 1.5, reserve: 0.15 },
    profile: {
      investor:  { name: 'Investor', g: 0.40, e: 0.40, f: 0.20, plus: 3e6,
                   text: 'Will Rendite und Titel. Ein volles Stadion ist ihm weniger wichtig als die Bilanz.' },
      tradition: { name: 'Traditionsverein', g: 0.20, e: 0.40, f: 0.40, plus: 0,
                   text: 'Gehört im Kern den Mitgliedern. Erwartet eine schwarze Null und eine Kurve, die mitzieht.' },
      maezen:    { name: 'Mäzen', g: 0.15, e: 0.60, f: 0.25, plus: -5e6,
                   text: 'Ein reicher Gönner. Nimmt Verluste in Kauf, solange es sportlich vorangeht.' }
    },
    namen: {
      investor: ['Nordlicht Capital', 'Rheintal Holding', 'Atlas Sports Group', 'Weserbank Invest', 'Kompass Beteiligungen'],
      tradition: ['Mitgliederversammlung des e. V.'],
      maezen: ['Gerhard Lindemann', 'Ursula Brenner', 'Konrad Wilms', 'Helga Sanders', 'Dietmar Kessel']
    },
    gewinnJeMio: 1.5,                 // ±33 Mio gegen die Erwartung = ±50 Punkte
    erfolg: { basis: 55, jePlatz: 2.5, min: 5, max: 85, playoffs: [0, 8, 12, 16, 22, 30] },
    stufen: [[70, 'Begeistert', 'gut'], [45, 'Zufrieden', 'gut'], [30, 'Unruhig', 'warn'], [0, 'Verärgert', 'schlecht']],
    zuschuss: 3e6, kuerzung: 2e6,     // × Preisindex
    // Erlös je Stufe ×0,78 / 0,92 / 1,00 / 1,06 / 1,11 – teurer bringt mehr, kostet aber Fanstimmung (vorher war „sehr teuer“ ×0,91)
    merch: { absatz: [1.30, 1.15, 1.00, 0.88, 0.79], marge: [0.6, 0.8, 1.0, 1.2, 1.4], fans: [6, 3, 0, -3, -6], trikot: [69, 79, 89, 99, 119] },
    stadionFans: { voll: 0.95, leer: 0.60, plus: 3, minus: -3 },
    untergrenze: { anteil: 0.89, jahre: 4 }
  };

  const dfl = () => typeof CLUB !== 'undefined' && CLUB && CLUB.dfl && CLUB.dfl.aktiv;
  const mio = x => (Math.round(x / 1e5) / 10).toLocaleString('de-DE') + ' Mio €';
  const vz = x => (x >= 0 ? '+' : '−') + mio(Math.abs(x));
  const klemme = (x, a, b) => Math.max(a, Math.min(b, x));
  // Liga-Cap ohne Rollover und ohne Werbe-Bonus (D56): Preisindex und Untergrenze rechnen wie bei der KI mit L.cap
  // (vorher zählte der Rollover mit – Untergrenze zu hoch, Prüfung 2026-10-09)
  const capLimit = () => (window.DFLKader && DFLKader.cap ? DFLKader.cap() : 120e6);
  const preisIndex = () => (dfl() ? capLimit() / 120e6 : 1);
  const nachricht = (t, x) => { if (typeof addNews === 'function') addNews('club', t, x); };

  // ── Zustand ───────────────────────────────────────────────────────────────
  function zustand() {
    if (!dfl()) return null;
    const d = CLUB.dfl;
    if (!d.eigner) {
      const keys = Object.keys(CFG.profile), profil = keys[Math.floor(Math.random() * keys.length)];
      const namen = CFG.namen[profil];
      d.eigner = { profil, name: namen[Math.floor(Math.random() * namen.length)], serie: 0, historie: [], ultimatum: false };
    }
    if (!d.untergrenze) d.untergrenze = { jahre: [], lohn: 0, wochen: 0, handgeld: 0, nachgezahlt: 0 };
    if (d.merchStufe == null) d.merchStufe = 0;
    return d;
  }
  function eigeneGruppe() { try { return findFcmGroup(LEAGUE).group; } catch (e) { return null; } }
  // Eigene Stärke wie bei den KI-Teams = Ø OVR der Startelf. Der Ligawert des eigenen Vereins bleibt auf dem
  // Startwert stehen (dfl_liga_patch.js rechnet nur die KI-Teams nach) – gemessen: 93 nach 9 Entlassungen bei Startelf 83.
  function eigenerOvr() {
    const G = window.DFLGenerator;
    if (!G || !G.startelfVon) return null;
    const elf = G.startelfVon(SQUAD.filter(p => !p.perspektiv && !p.verletztenliste).map(p => ({ pos: p.pos, ovr: p.ovr, def: p.def, mid: p.mid, att: p.att })));
    return elf.length ? elf.reduce((s, p) => s + p.ovr, 0) / elf.length : null;
  }
  function staerkeRang() {
    const g = eigeneGruppe(); if (!g) return 16;
    const ich = eigenerOvr(), wert = t => (t.id === 'fcm' && ich != null ? ich : t.ovr || 0);
    const sort = g.teams.slice().sort((a, b) => wert(b) - wert(a));
    return Math.max(1, sort.findIndex(t => t.id === 'fcm') + 1);
  }
  function tabellenRang() {
    const g = eigeneGruppe(); if (!g || typeof computeTable !== 'function') return 16;
    const ich = g.teams.find(t => t.id === 'fcm');
    if (ich && !ich.played) return staerkeRang();            // vor dem 1. Spieltag sagt die Tabelle nichts
    return Math.max(1, computeTable(g.teams).findIndex(t => t.id === 'fcm') + 1);
  }
  function saisonStartMerken() {
    const d = zustand(); if (!d) return;
    const bd = CLUB._budgetBreakdown || {};
    d.eigner.start = { saison: LEAGUE.season, kasse: CLUB.budget || 0, plan: bd.fixBalance || 0, investiert: 0, erwRang: staerkeRang() };
    try { CLUB._merchPlanJeSpiel = typeof merchIncomePerMatch === 'function' ? merchIncomePerMatch() : null; } catch (e) { /* nur im Spiel */ }
    if (typeof EXP !== 'undefined') EXP.state().boardSatisfaction = 60;    // Ereignisse verschieben die Stimmung ab hier
  }

  // ── Bewertung ─────────────────────────────────────────────────────────────
  function urteilFuer(wert) { return CFG.stufen.find(([ab]) => wert >= ab); }
  // Plan, gerechnet mit dem aktuellen Kader (Kaderkosten = Cap Hits × Stabfaktor, wie dfl_finanz_patch.js)
  function planMitKader(s) {
    const bd = CLUB._budgetBreakdown;
    if (!bd || bd.dflKader == null || !window.DFLKader || !window.DFLFinanzen) return s.plan;
    return s.plan - (DFLKader.capBelegt() - bd.dflKader) * DFLFinanzen.CFG.stab;
  }
  function bewertung(o) {
    const d = zustand(), E = d.eigner, p = CFG.profile[E.profil], s = E.start || { kasse: CLUB.budget, plan: 0, investiert: 0, erwRang: 16 };
    const ergebnis = s.plan + ((o.kasse != null ? o.kasse : CLUB.budget) - s.kasse) + (s.investiert || 0);
    // Erwartet wird das Ergebnis mit dem Kader, der in die Saison geht (zum 1. Spieltag festgeschrieben) –
    // sonst würde jeder Neuzugang aus Draft und Free Agency als Verfehlung zählen
    const erwartung = (s.festgelegt && s.planKader != null ? s.planKader : planMitKader(s)) + p.plus * preisIndex();
    const g = klemme(Math.round(50 + (ergebnis - erwartung) / 1e6 * CFG.gewinnJeMio), 0, 100);
    const rang = o.rang != null ? o.rang : tabellenRang(), runde = o.runde || 0;
    const erwRang = s.festgelegt ? s.erwRang : staerkeRang();      // bis zum 1. Spieltag zählt der aktuelle Kader
    const e = klemme(Math.round(klemme(CFG.erfolg.basis + (erwRang - rang) * CFG.erfolg.jePlatz, CFG.erfolg.min, CFG.erfolg.max) + CFG.erfolg.playoffs[runde]), 0, 100);
    const f = typeof EXP !== 'undefined' ? EXP.state().fanSatisfaction : 50;
    const mod = typeof EXP !== 'undefined' ? Math.round((EXP.state().boardSatisfaction - 60) * 0.5) : 0;
    const wert = klemme(Math.round(p.g * g + p.e * e + p.f * f + mod), 0, 100);
    const u = urteilFuer(wert);
    return { ergebnis, erwartung, g, e, f, mod, wert, urteil: u[1], klasse: u[2], rang, erwRang, runde };
  }
  // Live-Stand für Anzeigen (Prognose während der Saison)
  function stand() {
    const d = zustand(); if (!d) return null;
    if (!d.eigner.start) saisonStartMerken();
    const b = bewertung({});
    const p = CFG.profile[d.eigner.profil];
    return Object.assign(b, { profilName: p.name, name: d.eigner.name, profil: d.eigner.profil });
  }

  // ── Untergrenze (D20) ────────────────────────────────────────────────────
  // Barausgaben je Saison = Ø (Wochenlohn + Handgeld-Anteil der Altverträge) × 52 + neue Handgelder.
  // Die Ökonomie rechnet Gehälter als Jahreslohn (Wochenlohn × 52), der Kalender endet aber nach dem letzten Spiel
  // (~33 Wochen) – reine Wochensummen wären zu klein. Altverträge (Startkader, Draft) haben ihr Handgeld vor bzw.
  // bei Unterschrift außerhalb dieser Zählung bekommen; es zählt anteilig wie im Cap Hit (sonst ~25 % zu wenig).
  // Seit D41 kostet genau der Cap Hit Geld (Gehalt + Handgeld in Raten + Dead Cap) – dieselbe Zahl zählt hier
  function wochenlohn() {
    if (window.DFLKader && DFLKader.capBelegt) return DFLKader.capBelegt() / 52;
    return typeof totalWeeklyWages === 'function' ? totalWeeklyWages(SQUAD.filter(p => !p.perspektiv)) : 0;
  }
  function saisonBar(U) { return (U.handgeld || 0) + (U.wochen ? U.lohn / U.wochen : wochenlohn()) * 52; }
  function untergrenzeFenster() {
    const d = zustand(), U = d.untergrenze, J = CFG.untergrenze.jahre, n = U.jahre.length % J;
    const fenster = U.jahre.slice(U.jahre.length - n);
    const caps = fenster.map(j => j.cap).concat([capLimit()]);
    while (caps.length < J) caps.push(capLimit());          // Prognose: Cap bleibt
    const soll = CFG.untergrenze.anteil * caps.reduce((s, x) => s + x, 0);
    const ist = fenster.reduce((s, j) => s + j.bar, 0) + saisonBar(U);
    const prognose = ist + (J - n - 1) * wochenlohn() * 52;  // restliche Saisons mit dem heutigen Kader
    const startSaison = (LEAGUE.season || 1) - n;
    return { soll, ist, prognose, n: n + 1, startSaison, jahre: fenster };
  }
  function untergrenzeAbrechnen() {
    const d = zustand(), U = d.untergrenze;
    U.jahre.push({ saison: LEAGUE.season, bar: Math.round(saisonBar(U)), cap: capLimit() });
    U.lohn = 0; U.wochen = 0; U.handgeld = 0;
    if (U.jahre.length % CFG.untergrenze.jahre !== 0) return 0;
    const fenster = U.jahre.slice(-CFG.untergrenze.jahre);
    const soll = CFG.untergrenze.anteil * fenster.reduce((s, j) => s + j.cap, 0), ist = fenster.reduce((s, j) => s + j.bar, 0);
    if (ist >= soll) { nachricht('✅ Cap-Untergrenze erfüllt', `In den letzten vier Saisons flossen ${mio(ist)} an die Spieler – Soll waren ${mio(soll)}.`); return 0; }
    const fehl = Math.round(soll - ist);
    CLUB.budget -= fehl; U.nachgezahlt += fehl;
    const kader = SQUAD.filter(p => !p.perspektiv);
    if (window.MoraleSystem && MoraleSystem.addMorale) { try { MoraleSystem.addMorale(kader, 5); } catch (e) { /* nur im Spiel */ } }
    nachricht('💶 Nachzahlung Cap-Untergrenze', `In vier Saisons flossen nur ${mio(ist)} an die Spieler, Soll waren ${mio(soll)} (89 % der Caps). ` +
      `Der Fehlbetrag von ${mio(fehl)} geht an die ${kader.length} Spieler im Kader (≈ ${mio(fehl / Math.max(1, kader.length))} je Spieler).`);
    return fehl;
  }

  // ── Saisonende: vor dem Wechsel (Kasse steht noch) ──────────────────────
  function vorSaisonwechsel() {
    const d = zustand(); if (!d) return null;
    if (!d.eigner.start) saisonStartMerken();
    const rang = tabellenRang();
    // Fanstimmung: Merch-Preise und Auslastung
    try {
      const fans = CFG.merch.fans[d.merchStufe + 2] || 0;
      const fill = typeof stadiumFillRate === 'function' ? stadiumFillRate() : 0.8;
      const voll = fill >= CFG.stadionFans.voll ? CFG.stadionFans.plus : fill < CFG.stadionFans.leer ? CFG.stadionFans.minus : 0;
      if (fans + voll && EXP.applyDelta) EXP.applyDelta({ ultras: fans + voll, eventFans: fans + voll });
    } catch (e) { console.warn('[DFL-Eigentümer] Fans', e); }
    const nachzahlung = untergrenzeAbrechnen();
    return { rang, kasse: CLUB.budget, nachzahlung };
  }
  // ── Saisonende: nach dem Wechsel (neues Budget steht) ───────────────────
  function nachSaisonwechsel(vor) {
    const d = zustand(); if (!d || !vor) return;
    const po = LEAGUE.dflPlayoffs || {};
    const b = bewertung({ kasse: vor.kasse, rang: vor.rang, runde: po.eigeneRunde || 0 });
    const E = d.eigner, p = CFG.profile[E.profil], idx = preisIndex();
    let folge = '';
    if (b.wert >= CFG.stufen[0][0]) {
      const z = Math.round(CFG.zuschuss * idx); CLUB.budget += z; E.serie = 0; E.ultimatum = false;
      folge = `Der Eigentümer schießt ${mio(z)} für den Ausbau zu.`;
    } else if (b.wert < CFG.stufen[2][0]) {
      const k = Math.round(CFG.kuerzung * idx); CLUB.budget -= k; E.serie++;
      folge = `Der Eigentümer zieht ${mio(k)} aus der Kasse ab.`;
    } else { E.serie = 0; E.ultimatum = false; folge = b.wert < CFG.stufen[1][0] ? 'Er erwartet eine Steigerung.' : 'Alles bleibt, wie es ist.'; }
    E.historie.push({ saison: E.start ? E.start.saison : LEAGUE.season - 1, wert: b.wert, urteil: b.urteil, g: b.g, e: b.e, f: b.f,
      ergebnis: Math.round(b.ergebnis), erwartung: Math.round(b.erwartung), rang: b.rang, erwRang: b.erwRang, runde: b.runde });
    if (E.historie.length > 30) E.historie.shift();
    nachricht(`🏛️ Eigentümer: ${b.urteil} (${b.wert}/100)`,
      `${E.name} (${p.name}) zieht Bilanz: Gewinn ${b.g}, Erfolg ${b.e}, Fans ${b.f}. Ergebnis ${vz(b.ergebnis)} bei erwarteten ${vz(b.erwartung)}, ` +
      `Platz ${b.rang} bei Stärke-Rang ${b.erwRang}. ${folge}`);
    if (E.serie === 2) {
      E.ultimatum = true;
      nachricht('⚠️ Ultimatum des Eigentümers', `Zweite verärgerte Saison in Folge. Verfehlst du auch die nächste, ist deine Zeit bei ${CLUB.name} vorbei.`);
    }
    // Neues Saisonbudget steht: Sponsorboni aus dem Wechsel nachbuchen, Start merken
    if (d._sponsorNachtrag) { CLUB.budget += d._sponsorNachtrag; d._sponsorNachtrag = 0; }
    // Entnahme des Eigentümers (M6): Kasse über ab × Jahreseinnahmen (+ Rücklage + offene Untergrenze) fließt ab
    try {
      const ein = (CLUB._budgetBreakdown && CLUB._budgetBreakdown.income && CLUB._budgetBreakdown.income.total) || 0;
      if (ein > 0) {
        const uf = untergrenzeFenster(); const offen = Math.max(0, (uf.soll || 0) - (uf.prognose || 0));
        const grenze = Math.round(CFG.entnahme.ab * ein + CFG.entnahme.reserve * ein + offen);
        if (CLUB.budget > grenze) {
          const w = Math.round(CLUB.budget - grenze); CLUB.budget = grenze; E.entnommen = (E.entnommen || 0) + w;
          nachricht('🏛️ Eigentümer entnimmt Gewinn', `${E.name} nimmt ${mio(w)} aus der Kasse – mehr als ${CFG.entnahme.ab} Jahreseinnahmen (${mio(ein)}) hortet der Verein nicht. Es bleiben ${mio(CLUB.budget)}.`);
        }
      }
    } catch (e) { console.warn('[DFL-Eigentümer] Entnahme', e); }
    saisonStartMerken();
    if (E.serie >= 3) {
      nachricht('🚪 ENTLASSUNG', `Dritte verärgerte Saison in Folge: ${E.name} trennt sich von dir.`);
      if (typeof onExpectationsGameOver === 'function') onExpectationsGameOver({ grund: `Der Eigentümer (${p.name}) war drei Saisons in Folge verärgert und hat dich entlassen.` });
    }
  }

  // ── Einhängen ─────────────────────────────────────────────────────────────
  // Saisonwechsel: vorher abrechnen, nachher bewerten
  {
    const _orig = window.startNewSeason;
    if (typeof _orig === 'function') window.startNewSeason = function () {
      let vor = null;
      if (dfl()) { try { vor = vorSaisonwechsel(); } catch (e) { console.warn('[DFL-Eigentümer] vor dem Wechsel', e); } }
      const r = _orig.apply(this, arguments);
      planMarkieren();
      if (dfl()) { try { nachSaisonwechsel(vor); } catch (e) { console.warn('[DFL-Eigentümer] nach dem Wechsel', e); } }
      return r;
    };
    try { startNewSeason = window.startNewSeason; } catch (e) { /* nur im Spiel */ }
  }
  // Karrierestart: Eigentümer ziehen, Saison merken
  {
    const _orig = window.startNewGameState;
    if (typeof _orig === 'function') window.startNewGameState = async function () {
      const r = await _orig.apply(this, arguments);
      if (dfl()) {
        // Saisonplan für Saison 1 rechnet dfl_finanz_patch.js (inkl. Startguthaben) – hier nur den Start merken
        zustand(); saisonStartMerken();          // CLUB.dfl ist beim Karrierestart frisch (dfl_liga_patch.js)
        const E = CLUB.dfl.eigner, p = CFG.profile[E.profil];
        nachricht(`🏛️ Neuer Eigentümer: ${E.name}`, `${p.name}: ${p.text} Er bewertet jede Saison Gewinn (${Math.round(p.g * 100)} %), Erfolg (${Math.round(p.e * 100)} %) und Fans (${Math.round(p.f * 100)} %).`);
        if (typeof saveGameState === 'function') await saveGameState();
      }
      return r;
    };
  }
  // Sponsorboni: Titel / Playoffs / Conference-Finale; Betrag nach dem Budget-Neustart nachbuchen
  {
    const _orig = window.processSponsorsEndOfSeason;
    if (typeof _orig === 'function') window.processSponsorsEndOfSeason = function () {
      if (!dfl()) return _orig.apply(this, arguments);
      const runde = (LEAGUE.dflPlayoffs && LEAGUE.dflPlayoffs.eigeneRunde) || 0;
      CLUB._seasonAchievements = { promotion: runde === 5, top3: runde >= 1, cupSemi: runde >= 3, rank: tabellenRang() };
      const vorher = CLUB.budget;
      const r = _orig.apply(this, arguments);
      const d = zustand(); if (d) d._sponsorNachtrag = (d._sponsorNachtrag || 0) + (CLUB.budget - vorher);
      return r;
    };
    try { processSponsorsEndOfSeason = window.processSponsorsEndOfSeason; } catch (e) { /* nur im Spiel */ }
  }
  // Ausbau zählt als Investition, nicht als Verlust
  {
    const _orig = window.upgradeFacility;
    if (typeof _orig === 'function') window.upgradeFacility = function () {
      const vorher = CLUB.budget;
      const r = _orig.apply(this, arguments);
      const d = zustand(); if (d && d.eigner.start && CLUB.budget < vorher) d.eigner.start.investiert += vorher - CLUB.budget;
      return r;
    };
    try { upgradeFacility = window.upgradeFacility; } catch (e) { /* nur im Spiel */ }
  }
  // Untergrenze: Gehälter jede Woche, Handgelder bei Unterschrift
  {
    const _orig = window.advanceCalendarWeek;
    if (typeof _orig === 'function') window.advanceCalendarWeek = function () {
      const r = _orig.apply(this, arguments);
      const d = zustand();
      if (d && r !== false) { d.untergrenze.lohn += wochenlohn(); d.untergrenze.wochen++; }
      // Erwartung zum 1. Spieltag festschreiben: Draft, Free Agency und Kaderschnitt sind dann gelaufen
      const st = d && d.eigner.start;
      if (st && !st.festgelegt && LEAGUE.matchday >= 1) { st.erwRang = staerkeRang(); st.planKader = planMitKader(st); st.festgelegt = true; }
      return r;
    };
    try { advanceCalendarWeek = window.advanceCalendarWeek; } catch (e) { /* nur im Spiel */ }
  }
  ['signFreeAgent', 'negoMakeOffer'].forEach(fn => {
    const _orig = window[fn];
    if (typeof _orig !== 'function') return;
    window[fn] = function () {
      const vorher = CLUB.budget;
      const r = _orig.apply(this, arguments);
      const d = zustand(); if (d && CLUB.budget < vorher) d.untergrenze.handgeld += vorher - CLUB.budget;   // Handgeld
      return r;
    };
  });
  // Preisindex: Tickets, Dauerkarten, Banden, Sponsorangebote
  ['currentTicketPrice', 'currentSeasonTicketPrice', 'bannerValuePerSlot'].forEach(fn => {
    const _orig = window[fn];
    if (typeof _orig !== 'function') return;
    window[fn] = function () { return Math.round(_orig.apply(this, arguments) * preisIndex()); };
    try { if (fn === 'currentTicketPrice') currentTicketPrice = window[fn]; else if (fn === 'currentSeasonTicketPrice') currentSeasonTicketPrice = window[fn]; else bannerValuePerSlot = window[fn]; } catch (e) { /* nur im Spiel */ }
  });
  {
    const _orig = window.generateSponsorOffers;
    if (typeof _orig === 'function') window.generateSponsorOffers = function () {
      const offers = _orig.apply(this, arguments), i = preisIndex();
      if (i !== 1) offers.forEach(o => {
        o.perYear = Math.round(o.perYear * i / 1000) * 1000; o.total = o.perYear * o.duration;
        Object.keys(o.bonuses || {}).forEach(k => { o.bonuses[k] = Math.round(o.bonuses[k] * i / 1000) * 1000; });
      });
      return offers;
    };
    try { generateSponsorOffers = window.generateSponsorOffers; } catch (e) { /* nur im Spiel */ }
  }
  // Merchandising: Preisindex × Preisstufe (Absatz × Marge) × Fanstimmung (±10 % Absatz)
  function merchFaktor() {
    const d = zustand(); if (!d) return 1;
    const i = d.merchStufe + 2;
    const fans = typeof EXP !== 'undefined' ? EXP.state().fanSatisfaction : 50;
    return preisIndex() * CFG.merch.absatz[i] * CFG.merch.marge[i] * (1 + (fans - 50) / 50 * 0.10);
  }
  ['merchIncomePerMatch', 'merchandisingIncome'].forEach(fn => {
    const _orig = window[fn];
    if (typeof _orig !== 'function') return;
    window[fn] = function () { return Math.round(_orig.apply(this, arguments) * merchFaktor()); };
    try { if (fn === 'merchIncomePerMatch') merchIncomePerMatch = window[fn]; } catch (e) { /* nur im Spiel */ }
  });
  // Neues Saisonbudget → geplanten Merch je Heimspiel merken (Abweichung zählt pro Heimspiel)
  if (window.BudgetSystem && typeof BudgetSystem.recompute === 'function') {
    const _orig = BudgetSystem.recompute;
    BudgetSystem.recompute = function () {
      const r = _orig.apply(this, arguments);
      try { CLUB._merchPlanJeSpiel = merchIncomePerMatch(); } catch (e) { /* nur im Spiel */ }
      planMarkieren();
      return r;
    };
  }
  // Ein Plan, der mit allen DFL-Patches gerechnet wurde, trägt eine Marke. Fehlt sie (Spielstand aus einer
  // älteren Version: Saison 1 ohne Plan, oder Plan beim Laden vor den Patches gerechnet), wird er nachgeholt –
  // ohne die Kasse anzufassen.
  function planMarkieren() { if (dfl() && CLUB._budgetBreakdown) CLUB._budgetBreakdown.dflPlan = true; }
  function planNachholen() {
    if (!dfl() || (CLUB._budgetBreakdown && CLUB._budgetBreakdown.dflPlan) || !window.BudgetSystem) return;
    const kasse = CLUB.budget;
    try { BudgetSystem.recompute(); } catch (e) { console.warn('[DFL-Eigentümer] Plan nachholen', e); }
    if (typeof kasse === 'number') CLUB.budget = kasse;
  }

  // ── Anzeige ──────────────────────────────────────────────────────────────
  const farbe = k => k === 'gut' ? 'var(--green,#3fb950)' : k === 'warn' ? 'var(--gold,#d29922)' : 'var(--red,#f85149)';
  function panelHtml() {
    const s = stand(); if (!s) return '';
    const p = CFG.profile[s.profil], d = zustand(), U = untergrenzeFenster();
    const teile = [['Gewinn', s.g, p.g], ['Erfolg', s.e, p.e], ['Fans', s.f, p.f]].map(([t, w, gw]) =>
      `<div class="eig-teil"><span>${t} · ${Math.round(gw * 100)} %</span><b>${w}</b></div>`).join('');
    const hist = d.eigner.historie.slice(-4).map(h => `${h.saison}: ${h.urteil} (${h.wert})`).join(' · ');
    const pct = U.soll > 0 ? Math.min(100, Math.round(U.prognose / U.soll * 100)) : 0;
    const merch = CFG.merch, mi = d.merchStufe + 2;
    const stufen = [-2, -1, 0, 1, 2].map((st, i) => `<button class="eig-stufe${st === d.merchStufe ? ' aktiv' : ''}" onclick="DFLEigner.merchStufe(${st})">${Math.round(merch.trikot[i] * preisIndex())} €<small>${['sehr günstig', 'günstig', 'normal', 'teuer', 'sehr teuer'][i]}</small></button>`).join('');
    return `<div class="exp-section eig">
      <div class="exp-section-title"><i class="ti ti-building-bank"></i> Eigentümer</div>
      <div class="eig-kopf"><b>${s.name}</b><span>${p.name}</span></div>
      <p class="eig-text">${p.text}</p>
      ${expMeterHtml('Zufriedenheit (Prognose) · ' + s.urteil, s.wert, false)}
      <div class="eig-teile">${teile}</div>
      <p class="eig-klein">Erwartet ${vz(s.erwartung)}, bisher ${vz(s.ergebnis)} · Stärke-Rang ${s.erwRang}, Platz ${s.rang} · ab 70 Zuschuss, unter 30 Kürzung</p>
      ${d.eigner.serie ? `<p class="eig-warn">⚠️ ${d.eigner.serie === 1 ? 'Letzte Saison war er verärgert.' : 'Ultimatum: noch eine verärgerte Saison und du bist entlassen.'}</p>` : ''}
      ${hist ? `<p class="eig-klein">Bisher: ${hist}</p>` : ''}
    </div>
    <div class="exp-section eig">
      <div class="exp-section-title"><i class="ti ti-shirt"></i> Fanshop-Preise (Heimtrikot)</div>
      <div class="eig-stufen">${stufen}</div>
      <p class="eig-klein">Absatz ${Math.round(merch.absatz[mi] * 100)} % · Marge ${Math.round(merch.marge[mi] * 100)} % · Fanstimmung zum Saisonende ${merch.fans[mi] > 0 ? '+' : ''}${merch.fans[mi]} ·
        Merch je Heimspiel ${typeof merchIncomePerMatch === 'function' ? mio(merchIncomePerMatch()) : '–'}. Preisindex ${preisIndex().toLocaleString('de-DE', { maximumFractionDigits: 2 })} (Cap ÷ 120 Mio).</p>
    </div>
    <div class="exp-section eig">
      <div class="exp-section-title"><i class="ti ti-scale"></i> Cap-Untergrenze</div>
      <p class="eig-klein">In vier Saisons müssen 89 % der Caps an die Spieler fließen – sonst wird nachgezahlt.</p>
      <div class="exp-bar"><div class="exp-bar-fill" style="width:${pct}%;background:${pct >= 100 ? 'var(--green,#3fb950)' : 'var(--gold,#d29922)'}"></div></div>
      <p class="eig-klein">Fenster ${U.startSaison}–${U.startSaison + CFG.untergrenze.jahre - 1} (Saison ${U.n} von 4): bis Saisonende <b>${mio(U.ist)}</b>,
        mit dem heutigen Kader bis Fensterende ${mio(U.prognose)} – Soll ${mio(U.soll)}${U.prognose < U.soll ? ` (es fehlen ≈ ${mio(U.soll - U.prognose)})` : ' ✓'}.
        ${d.untergrenze.nachgezahlt ? 'Bisher nachgezahlt: ' + mio(d.untergrenze.nachgezahlt) + '.' : ''}</p>
    </div>`;
  }
  function fanHinweisHtml() {
    return `<p class="eig-klein">Preise, Ergebnisse und volle Ränge bewegen die Fans – gute Stimmung bringt mehr Einnahmen.</p>`;
  }
  function merchStufe(st) {
    const d = zustand(); if (!d) return;
    d.merchStufe = klemme(st | 0, -2, 2);
    if (typeof renderClubTab === 'function') renderClubTab();
    if (typeof saveGameState === 'function') saveGameState();
  }
  // Ladeschritt nachholen (Spielstand lädt vor den Patches, siehe docs/notizen/dfl-laden-vor-patches.md)
  {
    const _orig = window._afterLoad;
    if (typeof _orig === 'function') window._afterLoad = function () {
      const r = _orig.apply(this, arguments);
      if (dfl()) { planNachholen(); zustand(); if (!CLUB.dfl.eigner.start) saisonStartMerken(); }
      return r;
    };
  }
  if (dfl()) { planNachholen(); zustand(); if (!CLUB.dfl.eigner.start) saisonStartMerken(); }

  window.DFLEigner = { CFG, stand, panelHtml, fanHinweisHtml, merchStufe, preisIndex, untergrenzeFenster, bewertung,
    _test: { untergrenzeAbrechnen, vorSaisonwechsel, nachSaisonwechsel, staerkeRang } };
  console.log('%c[DFL-Eigentümer v1] aktiv', 'color:#3fb950;font-weight:bold',
    '— Eigentümer (zufällig, darf entlassen), Preisindex, Merch-Preisstufe, Fanstimmung, Cap-Untergrenze');
})();
