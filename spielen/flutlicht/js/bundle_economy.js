/* ===== BUNDLE: bundles/bundle_economy.js ===== */
/* Enthält (in dieser Reihenfolge): contract_wage_patch.js budget_system_patch.js morale_system_patch.js events_patch.js transfer_plausibility.js youth_development_patch.js */

/* ---------- js/contract_wage_patch.js ---------- */
/* ===== contract_wage_patch.js ===== */
/* ═══════════════════════════════════════════════════════════════════════════
   VERTRAGS- & GEHALTS-PATCH  ·  v1
   ─────────────────────────────────────────────────────────────────────────
   Laden NACH app_main.js / engine_main.js (am besten als eines der letzten Skripte).
   Ersetzt bei Bedarf den älteren ContractWage-Teil aus dem RealMarket-Patch.

   Vier Wünsche:
   1) Bei Kauf ODER Verlängerung verlangt der Spieler 10–20% Gehalts-Aufschlag.
      Dieser Aufschlag DARF das Gehaltsbudget-Limit überschreiten (keine Blockade).
   2) Gehälter generell +10% (Sockel).
   3) Starspieler (hohes Potenzial/OVR) verlangen beim Kauf zusätzlich mehr.
   4) Längerer Vertrag = etwas mehr Gehalt, aber nur kleine Schritte (2–5%/Jahr).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {

  // ── STELLSCHRAUBEN ────────────────────────────────────────────────────────
  const CFG = {
    baseWageBoost: 1.10,        // (2) alle Gehälter ×1.10

    signingPremiumMin: 0.10,    // (1) Aufschlag bei Kauf/Verlängerung: 10–20%
    signingPremiumMax: 0.20,

    // (4) Vertragslängen-Bonus pro Jahr ÜBER 1 hinaus (klein: 2–5%/Jahr).
    //     Wir nehmen einen festen Wert in diesem Bereich.
    wagePerExtraYear: 0.035,    // 3,5%/Jahr → 5 Jahre = +14%

    // (3) Star-Aufschlag beim KAUF zusätzlich, abhängig von OVR/Potenzial.
    star: {
      ovr80: 0.15,   // OVR ≥ 80 → +15 % (2026-10-22, Nutzer: Topgehälter „ein paar Prozente nerven“; vorher +20 %)
      ovr75: 0.12,   // OVR ≥ 75 → +12%
      ovr70: 0.06,   // OVR ≥ 70 → +6%
      // Potenzial-Zuschlag (Wonderkids wollen auch mehr)
      potGap10: 0.10, // truePotential - ovr ≥ 10 → +10%
      potGap6:  0.05, // ≥ 6 → +5%
    },

    allowExceedWageCap: false,  // (1) 2026-10-21 (Fehleranalyse M2, Nutzer „Sperre wie beim Kauf“): Verlängerung und Kauf über dem Deckel gehen nicht mehr
  };

  const ovrOf = (p) => (p && (p.ovr || 0)) || 0;
  const potOf = (p) => (p && (p.truePotential || p.ovr || 0)) || 0;

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function rw(v) { return (typeof roundWage === 'function') ? roundWage(v) : Math.round(v); }

  // ── (2)+(3) GRUND-GEHALT: +10% Sockel, Star-Aufschlag ─────────────────────
  const _origWageFor = window.weeklyWageFor;
  if (typeof _origWageFor === 'function') {
    window.weeklyWageFor = function (player) {
      let wage = _origWageFor(player);          // Original (inkl. Alters-/Pos-/Potenzial-Logik)
      wage *= CFG.baseWageBoost;                // (2) +10%
      // (3) Star-Aufschlag nach OVR
      const o = ovrOf(player);
      let starF = 1;
      if (o >= 80) starF += CFG.star.ovr80;
      else if (o >= 75) starF += CFG.star.ovr75;
      else if (o >= 70) starF += CFG.star.ovr70;
      // Potenzial-Zuschlag
      const gap = potOf(player) - o;
      if (gap >= 10) starF += CFG.star.potGap10;
      else if (gap >= 6) starF += CFG.star.potGap6;
      wage *= starF;
      return rw(wage);
    };
    try { weeklyWageFor = window.weeklyWageFor; } catch (e) {}
    console.log('[ContractWage v1] weeklyWageFor: +' + Math.round((CFG.baseWageBoost - 1) * 100) + '% Sockel + Star-Aufschlag');
  } else {
    console.warn('[ContractWage v1] weeklyWageFor nicht gefunden');
  }

  // ── (1)+(4) FORDERUNG BEI KAUF/VERLÄNGERUNG ───────────────────────────────
  // minWageDemand kennt die Vertragslänge nicht direkt. Wir setzen vor dem Aufruf
  // von buyPlayer/renewContract zwei Werte, die hier ausgelesen werden:
  //   _signMult  = 1 + Signing-Premium (10–20%, einmal pro Vorgang gewürfelt)
  //   _yearsMult = 1 + (years-1)*wagePerExtraYear  (Vertragslängen-Bonus)
  let _signMult = 1;
  let _yearsMult = 1;

  const _origMinWage = window.minWageDemand;
  if (typeof _origMinWage === 'function') {
    window.minWageDemand = function (player) {
      const base = _origMinWage(player);        // fair vs. aktuelles Gehalt ×1.05
      return rw(base * _signMult * _yearsMult);
    };
    try { minWageDemand = window.minWageDemand; } catch (e) {}
  }

  function yearsMultFor(years) {
    const maxY = (typeof MAX_CONTRACT_YEARS !== 'undefined') ? MAX_CONTRACT_YEARS : 5;
    const y = Math.max(1, Math.min(maxY, years | 0));
    return 1 + (y - 1) * CFG.wagePerExtraYear;
  }

  // buyPlayer wrappen: Signing-Premium + Längen-Bonus setzen, Cap-Sperre umgehen
  const _origBuy = window.buyPlayer;
  if (typeof _origBuy === 'function') {
    window.buyPlayer = function (marketId, years) {
      if (years == null) return _origBuy.call(this, marketId, years); // Dialog öffnet sich zuerst
      _signMult  = 1 + rnd(CFG.signingPremiumMin, CFG.signingPremiumMax);
      _yearsMult = yearsMultFor(years);
      // (1) Cap darf überschritten werden → wageBudget temporär „unendlich" stellen
      let savedBudget = null;
      if (CFG.allowExceedWageCap && typeof CLUB !== 'undefined') {
        savedBudget = CLUB.wageBudget;
        CLUB.wageBudget = Number.MAX_SAFE_INTEGER;
      }
      try {
        return _origBuy.call(this, marketId, years);
      } finally {
        _signMult = 1; _yearsMult = 1;
        // wageBudget korrekt neu berechnen: Cap minus laufende Gehälter (darf negativ werden)
        if (savedBudget !== null && typeof CLUB !== 'undefined') {
          const cap = CLUB.wageCap || 0;
          const used = (typeof totalWeeklyWages === 'function') ? totalWeeklyWages(SQUAD) : 0;
          CLUB.wageBudget = cap - used;   // kann jetzt negativ sein = Limit überschritten
          if (typeof renderClubTab === 'function') { try { renderClubTab(); } catch (e) {} }
        }
      }
    };
    try { buyPlayer = window.buyPlayer; } catch (e) {}
  }

  // renewContract wrappen: gleiche Logik
  const _origRenew = window.renewContract;
  if (typeof _origRenew === 'function') {
    window.renewContract = function (squadId, years) {
      if (years == null) return _origRenew.call(this, squadId, years);
      _signMult  = 1 + rnd(CFG.signingPremiumMin, CFG.signingPremiumMax);
      _yearsMult = yearsMultFor(years);
      let savedBudget = null;
      if (CFG.allowExceedWageCap && typeof CLUB !== 'undefined') {
        savedBudget = CLUB.wageBudget;
        CLUB.wageBudget = Number.MAX_SAFE_INTEGER;
      }
      try {
        return _origRenew.call(this, squadId, years);
      } finally {
        _signMult = 1; _yearsMult = 1;
        if (savedBudget !== null && typeof CLUB !== 'undefined') {
          const cap = CLUB.wageCap || 0;
          const used = (typeof totalWeeklyWages === 'function') ? totalWeeklyWages(SQUAD) : 0;
          CLUB.wageBudget = cap - used;
          if (typeof renderClubTab === 'function') { try { renderClubTab(); } catch (e) {} }
        }
      }
    };
    try { renewContract = window.renewContract; } catch (e) {}
  }

  console.log('%c[ContractWage v1] aktiv', 'color:#3fb950;font-weight:bold',
    '— Sockel +' + Math.round((CFG.baseWageBoost-1)*100) + '%, Signing +' +
    Math.round(CFG.signingPremiumMin*100) + '–' + Math.round(CFG.signingPremiumMax*100) +
    '%, +' + (CFG.wagePerExtraYear*100).toFixed(1) + '%/Vertragsjahr, Cap überschreitbar');

})();


/* ---------- js/budget_system_patch.js ---------- */
/* ===== budget_system_patch.js ===== */
/* ═══════════════════════════════════════════════════════════════════════════
   FM-BUDGET-SYSTEM  ·  v1
   ─────────────────────────────────────────────────────────────────────────
   Laden NACH app_main.js / engine_main.js und NACH contract_wage_patch.js
   (am besten als eines der letzten Skripte).

   Modell (vereinfacht, ohne Eigenkapital — der Verein spart nichts an):
   • Zu Saisonbeginn legt der Vorstand fest:
       TRANSFERBUDGET = fixe Einnahmen − fixe Kosten  (reine Fixbilanz)
       GEHALTSBUDGET  = Wochengehalts-Limit
   • Fixe Einnahmen: TV-Gelder, Sponsoren, Dauerkarten, Spieltag, Banner.
   • Fixe Kosten: Personal (Gehälter × staffCostFactor) + Betriebskosten als
     ANTEIL DER EINNAHMEN (opsShareOfIncome, ~30-33 %) + Abschreibungen auf
     laufende Transfer-Raten. Der Betriebssockel hängt bewusst am Umsatz, nicht
     am Gehalt — sonst hätte ein Verein mit billigem Kader gar keine Kosten.
   • Der Gehaltsdeckel kommt ebenfalls aus den Einnahmen (wageShareOfIncome).
   • Ablösen werden ÜBER DIE VERTRAGSLAUFZEIT abgeschrieben (20M/5J = 4M/Jahr).
   • Das Transferbudget DARF ins Minus (Verschuldung für einen Star).
     Ist es am Saisonende negativ → Vorstandswarnung, das Defizit wird in die
     neue Saison übertragen und muss ausgeglichen werden (Verkäufe etc.).
   • Schwankende Einnahmen (Tageskarten, Merch, Prämien) tauchen NICHT als
     tickende UI-Zahl auf — das Budget ist die planbare Fixbilanz.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {

  // ── ZIEL-BUDGETS & FAKTOREN ───────────────────────────────────────────────
  const CFG = {
    // Personalkosten-Faktor: Spielergehälter × Faktor (Stab, med. Personal, SV-Beiträge)
    staffCostFactor: 1.10,

    // Betriebskosten als Anteil der EINNAHMEN — NICHT der Gehaltssumme.
    // Vorher hingen die gesamten Kosten am Spielergehalt (`opsShareOfTotal`).
    // Damit hatte ein Verein mit billigem Kader praktisch keine Kosten und die
    // kompletten Einnahmen wurden Transferbudget: in der Bundesliga gemessen
    // 52,6 Mio Einnahmen gegen 2,0 Mio Kosten = 50,6 Mio Transferbudget.
    // Stadionbetrieb, Nachwuchs, Verwaltung, Reisen und Marketing hängen aber an
    // der GRÖSSE des Vereins, nicht daran, was er seinen Spielern zahlt.
    // Unten ist der Anteil höher, weil dort weniger TV-Geld den Sockel verdünnt.
    // 2026-10-15 angehoben (Nutzer freigegeben): mit 0,33 blieben Gehälter + Betrieb bei ~72 % der Einnahmen, ein
    // passiver Zweitligist machte +14 Mio Planüberschuss je Saison (gemessen 1,5 → 91 Mio in drei Saisons). Echte Vereine
    // liegen bei 95–100 %. Jetzt: wer den Gehaltsdeckel ausschöpft, hat kaum Transferbudget; wer günstig spielt, kauft ein.
    opsShareOfIncome: { bundesliga: 0.45, bundesliga2: 0.48, liga3: 0.42, regionalliga: 0.36 },

    // Gehaltsdeckel als Anteil der Einnahmen (inkl. Stab-Faktor gerechnet).
    // Real geben Vereine 50–60 % vom Umsatz für Personal aus, unten mehr, weil
    // die Fixkosten dort relativ schwerer wiegen.
    wageShareOfIncome: { bundesliga: 0.53, bundesliga2: 0.55, liga3: 0.58, regionalliga: 0.63 },   // 2026-10-21 (Nutzer freigegeben): +3 Punkte, damit ab Saison 2 etwas Gehaltsluft bleibt

    // Mindest-Transferbudget je Liga (greift NICHT bei selbstverschuldetem Minus,
    // nur als kleine Starthilfe wenn die Fixbilanz knapp positiv/leicht negativ ist).
    // Kleiner Boden je Liga, damit der Transfermarkt auch unten lebt (2026-08-07):
    // eine knapp ausgeglichene Fixbilanz ergab sonst dauerhaft 0 Transferbudget.
    minTransferBudget: { bundesliga: 6_000_000, bundesliga2: 1_200_000, liga3: 350_000, regionalliga: 120_000 },

    // Untergrenze des Gehaltsdeckels je Liga (Wochen-Obergrenze). Greift nur,
    // wenn der einnahmenbasierte Deckel darunter läge — etwa bei einem Aufsteiger
    // mit sehr kleinem Stadion. Der eigentliche Deckel kommt aus wageShareOfIncome.
    wageCapFloor: { bundesliga: 250_000, bundesliga2: 70_000, liga3: 25_000, regionalliga: 10_000 },

    // Wie viel vom Saisonüberschuss darf der Verein mit in die neue Saison
    // nehmen? 1.0 = alles. Kleiner stellen, wenn Horten zu stark werden sollte
    // (der Vorstand würde den Rest dann in Rücklagen/Infrastruktur stecken).
    carryOverShare: 1.0,
    // Obergrenze der Rücklage als Vielfaches des eigenen Saison-Transferbudgets.
    // Ohne Deckel häuft ein Verein, der wenig ausgibt, unbegrenzt an: gemessen
    // 58 Mio Transferbudget bei 4,6 Mio Einnahmen in der Regionalliga nach zehn
    // Saisons. Drei Jahresbudgets reichen für einen echten Königstransfer und
    // halten das Sparen sinnvoll — was darüber liegt, steckt der Vorstand in
    // Infrastruktur und Rücklagen des Vereins.
    fallschirm: 0.35,       // 2026-10-16: Deckel-Basis fällt je Saison höchstens auf diesen Anteil (Absteiger behalten Rücklagen); 2026-10-21 (Nutzer freigegeben) 0,5 → 0,35: ein Drittligist stand nach dem Abstieg mit 13 Mio Transferbudget da
    carryOverMax: 2.0,      // 2026-10-15: 3 → 2 Jahresbudgets (Nutzer freigegeben)

    // Wie vorsichtig plant der Vorstand die Zuschauereinnahmen? 0.92 = er rechnet
    // mit 8 % weniger als der Erwartungswert. Vor der Saison weiß niemand, wie
    // viele Leute kommen — deshalb wird nicht auf Kante geplant. Läuft es gut,
    // gibt es Geld obendrauf; läuft es schlecht, fehlt es.
    planVorsicht: 0.92,

    licenseWarnOnly: true,   // negatives Budget am Saisonende → nur Warnung (kein Saison-Aus)
  };

  // ── EINNAHMEN-/KOSTEN-FAKTOREN (aus price_balance & running_costs) ─────────
  const INCOME = 1.4;
  const TV_POOL = { bundesliga: [630_000_000, 0.50, 18], bundesliga2: [130_000_000, 0.50, 18],
                    liga3: [26_000_000, 0.90, 20], regionalliga: [4_000_000, 0.95, 18] };
  const SPONSOR = { bundesliga: [12_000_000, 6_000_000], bundesliga2: [3_500_000, 2_000_000],
                    liga3: [900_000, 500_000], regionalliga: [250_000, 120_000] };
  const BANNER_SLOT = { bundesliga: 120_000, bundesliga2: 45_000, liga3: 16_000, regionalliga: 6_000 };
  const CAP_LEVEL = [6000, 9000, 13000, 18000, 25000, 33000, 42000, 52000, 62000, 75000];
  const RUN_WEEK  = [1730, 4870, 4870, 12125, 12125, 29350, 29350, 29350, 112500, 112500];

  const fmt = (v) => (typeof formatEuro === 'function' ? formatEuro(Math.round(v)) : Math.round(v) + '€');

  // ── HILFEN ────────────────────────────────────────────────────────────────
  function myTierKey() {
    try { return findFcmGroup(LEAGUE).tierKey; } catch (e) { return 'bundesliga2'; }
  }
  function myRank() {
    try {
      const fg = findFcmGroup(LEAGUE);
      const tbl = computeTable(fg.group.teams);
      const i = tbl.findIndex(t => t.id === 'fcm');
      return i >= 0 ? i + 1 : 10;
    } catch (e) { return 10; }
  }
  function stadiumLevel() { return (CLUB.facilities && CLUB.facilities.stadium) || 1; }

  function weeklyWageSum() {
    return (typeof totalWeeklyWages === 'function' && typeof SQUAD !== 'undefined')
      ? totalWeeklyWages(SQUAD) : 0;
  }

  // ── ABSCHREIBUNGEN: Ablöse über Vertragslaufzeit verteilt ──────────────────
  // CLUB._amortizations: [{ remainingYears, perYear }]
  function annualAmortization() {
    if (!CLUB._amortizations) CLUB._amortizations = [];
    return CLUB._amortizations.reduce((s, a) => s + (a.remainingYears > 0 ? a.perYear : 0), 0);
  }
  function addAmortization(fee, years) {
    if (!CLUB._amortizations) CLUB._amortizations = [];
    const y = Math.max(1, years | 0);
    CLUB._amortizations.push({ perYear: fee / y, remainingYears: y, fee, years: y });
  }
  function tickAmortizationsOneSeason() {
    if (!CLUB._amortizations) return;
    CLUB._amortizations.forEach(a => a.remainingYears = Math.max(0, a.remainingYears - 1));
    CLUB._amortizations = CLUB._amortizations.filter(a => a.remainingYears > 0);
  }

  // ── EUROPA-STUFE ───────────────────────────────────────────────────────────
  // Die Bundesliga ist keine flache Ebene: ein Europapokal-Teilnehmer verdient
  // deutlich mehr als ein Abstiegskandidat derselben Liga. Die Stufe richtet
  // sich nach der Platzierung der VORSAISON und hebt Sponsoren und Klauseln an.
  // Damit geht die Treppe nach dem Aufstieg weiter, statt oben aufzuhören.
  const EUROPA_STUFEN = [
    { bis: 3, faktor: 1.60, label: 'Champions League' },
    { bis: 6, faktor: 1.30, label: 'Europapokal' }
  ];
  function europaFaktor() {
    try {
      if (myTierKey() !== 'bundesliga') return 1;
      const rank = myRank();
      for (let i = 0; i < EUROPA_STUFEN.length; i++) {
        if (rank <= EUROPA_STUFEN[i].bis) return EUROPA_STUFEN[i].faktor;
      }
    } catch (e) {}
    return 1;
  }
  function europaLabel() {
    try {
      if (myTierKey() !== 'bundesliga') return null;
      const rank = myRank();
      for (let i = 0; i < EUROPA_STUFEN.length; i++) {
        if (rank <= EUROPA_STUFEN[i].bis) return EUROPA_STUFEN[i].label;
      }
    } catch (e) {}
    return null;
  }
  window.europaFaktor = europaFaktor;
  window.europaLabel = europaLabel;

  // ── SPONSORENKLAUSEL: BASIS IST PLANBAR ────────────────────────────────────
  // Die Wochenbasis der gewählten Klausel floss bisher NUR während der Saison
  // direkt aufs Konto — an der Vorstandsplanung vorbei. Gemessen: allein der
  // Risiko-Wettanbieter brachte 612.000 € in der Regionalliga, also 30 % des
  // gesamten geplanten Umsatzes, als Überraschung obendrauf (in der Bundesliga
  // 24,5 Mio bzw. 40 %). Die Basis gehört deshalb in die Einnahmen; nur Bonus
  // und Strafe bleiben Abweichung — und genau die sollen ja erspielbar sein.
  const KLAUSEL_FAKTOR = { bundesliga: 40, bundesliga2: 12, liga3: 3, regionalliga: 1 };
  // Abschlag auf jede Klausel, ausgedrückt als Anteil des ÜBRIGEN Umsatzes.
  // So verliert jede Klausel gleich viele Prozentpunkte, unabhängig von Liga und
  // Größe — nach oben wirkt das absolut am stärksten, genau wo es zu viel wurde
  // (Bundesliga: Wettanbieter 40 % → 37 %, also gut 2 Mio weniger).
  const KLAUSEL_ABZUG = 0.03;
  // …aber höchstens ein Viertel der Klausel selbst. Ohne diesen Deckel traf der
  // absolute Abzug die kleinen Klauseln unverhältnismäßig: die Traditions-
  // Brauerei verlor in der Regionalliga 102k → 29k, also fast drei Viertel,
  // während der Wettanbieter nur ein Achtel abgab. Die Großen zahlen weiterhin
  // die vollen 3 % des Umsatzes, die Kleinen anteilig.
  const KLAUSEL_ABZUG_MAX_ANTEIL = 0.25;
  function klauselBasisSaison(tierKey, umsatzOhneKlausel) {
    try {
      const e = (typeof EXP !== 'undefined' && EXP.state) ? EXP.state() : null;
      const id = e && e.sponsorClauseId;
      if (!id || typeof EXP === 'undefined' || !EXP.SPONSOR_CLAUSES[id]) return 0;
      const basis = EXP.SPONSOR_CLAUSES[id].base || 0;
      const roh = basis * (KLAUSEL_FAKTOR[tierKey] || 1) * 34 * europaFaktor();
      const abzug = Math.min((umsatzOhneKlausel || 0) * KLAUSEL_ABZUG, roh * KLAUSEL_ABZUG_MAX_ANTEIL);
      return Math.max(0, roh - abzug);
    } catch (e) { return 0; }
  }
  window.klauselBasisSaison = klauselBasisSaison;
  window.KLAUSEL_ABZUG = KLAUSEL_ABZUG;

  // ── FIXE EINNAHMEN / KOSTEN ────────────────────────────────────────────────
  function fixIncome(tierKey, rank, lvl) {
    const [pool, split, n] = TV_POOL[tierKey] || TV_POOL.bundesliga2;
    const pts = Math.round(82 - (82 - 26) * (rank - 1) / (n - 1));
    let total = 0; for (let r = 1; r <= n; r++) total += Math.round(82 - (82 - 26) * (r - 1) / (n - 1));
    const tv = pool * split / n + pool * (1 - split) * pts / total;
    const cap = CAP_LEVEL[lvl - 1];
    // Dauerkarten. Der Preis staffelt sich nach Ausbaustufe des Stadions — ein
    // Viertligist verlangt keine Bundesliga-Preise. Vorher pauschal 620 €, was
    // allein 2,3 Mio Einnahmen für einen Regionalligisten ergab (real 0,3–0,6 Mio).
    // PREISE AUS DEM SPIEL, nicht aus einer eigenen Tabelle. Vorher rechnete die
    // Planung mit einer stadionabhängigen Reihe, während das Spiel die vom
    // Nutzer eingestellte Preisstufe (−2…+2 je Liga) verwendete — Plan und
    // Wirklichkeit liefen also mit zwei verschiedenen Preisen.
    const dauerPreis = (typeof currentSeasonTicketPrice === 'function')
      ? currentSeasonTicketPrice() : 260;
    const tagesPreis = (typeof currentTicketPrice === 'function')
      ? currentTicketPrice() : 15;
    // Verkaufte Dauerkarten hängen am Preis: teuer = weniger Abnehmer.
    const anteil = (typeof dauerkartenAnteil === 'function') ? dauerkartenAnteil() : 0.45;
    // 2026-10-15: Zuschauereinnahmen OHNE den Faktor INCOME (1,4) planen. Das Spiel bucht die echten Einnahmen
    // (matchAttendanceIncome) ohne ihn – mit Faktor lag der Plan je Heimspiel bis zu 40 % über der Wirklichkeit, und
    // jedes Heimspiel zog als „Abweichung“ Geld ab (Zweite Liga: −0,2 bis −0,75 Mio je Spiel, Budget fiel in der
    // Saison 19 → 6 Mio). Die Betriebskosten rechnen weiter mit der alten Basis (opsBasisZuschlag, siehe fixCost),
    // damit sich am Geld über die Saison nichts ändert – nur der Plan stimmt jetzt.
    const seasonTickets = cap * anteil * dauerPreis;
    // ERWARTETE AUSLASTUNG statt fester 60 %. Ohne das entstand ein Unsinn:
    // weniger Dauerkarten hießen automatisch mehr Tageskarten-PLÄTZE, und die
    // galten als verkauft — die teuerste Preisstufe war dadurch immer die beste,
    // egal wie sehr sie die Nachfrage drückt. Jetzt begrenzt die Nachfrage die
    // Zuschauerzahl, und die Dauerkarten sind nur der garantierte Block darin.
    // Dieselbe Dämpfung wie in `stadiumFillRate` — Plan und Wirklichkeit müssen
    // mit derselben Nachfragekurve rechnen.
    // WICHTIG: Der Vorstand plant VORSICHTIG. Wie viele Zuschauer wirklich
    // kommen, weiß vor der Saison niemand — das hängt am sportlichen Verlauf.
    // Der Plan geht deshalb von einer mäßigen Saison aus; läuft es gut, kommt
    // Geld obendrauf (das landet als Abweichung auf dem Konto), läuft es
    // schlecht, fehlt es. Die Spanne wird in der Vorstandsmeldung ausgewiesen.
    const tl = (CLUB.ticketLevel || 0), sl = (CLUB.seasonTicketLevel || 0);
    let nachfrage = Math.max(0.30, Math.min(1, 0.72 - tl * 0.09 - sl * 0.05));
    let vorsicht = CFG.planVorsicht;
    // 2026-10-15 (Nutzer freigegeben): Gibt es aus der Vorsaison echte Heimspiele IN DERSELBEN LIGA mit denselben
    // Ticketpreisen, plant der Vorstand mit deren Auslastung. Die feste Annahme (72 % × 0,92) lag in der Zweiten Liga bei
    // 66 % gegen gemessene ~88 % – jede Saison kamen so ~4,5 Mio „überraschend“ dazu.
    try {
      const vor = (CLUB._attendanceLog || []).filter(x => x.s === LEAGUE.season - 1 && x.t === tierKey && x.f > 0 && x.p === tl + '|' + sl);
      if (vor.length >= 5) { nachfrage = Math.max(0.30, Math.min(1, vor.reduce((s, x) => s + x.f, 0) / vor.length)); vorsicht = 0.97; }
    } catch (e) { /* ohne Vorsaison: feste Annahme */ }
    const auslastung = nachfrage * vorsicht;
    const zuschauer = cap * auslastung;
    const tagesPlaetze = Math.max(0, zuschauer - cap * anteil);
    // Spanne für die Anzeige: von schwacher bis starker Saison.
    const tagesPlaetzeMin = Math.max(0, cap * nachfrage * 0.80 - cap * anteil);
    const tagesPlaetzeMax = Math.max(0, cap * Math.min(1, nachfrage * 1.30) - cap * anteil);
    // Sponsoren: die TATSÄCHLICH abgeschlossenen Verträge, wenn es welche gibt.
    // Vorher stand hier immer nur die Liga-Schätzung — und die echten Zahlungen
    // wurden am Saisonende ZUSÄTZLICH aufs Budget gebucht. Dasselbe Geld war
    // damit doppelt drin: geplant und noch einmal als Bargeld.
    let sponsors = 0;
    try {
      ['shirt', 'sleeve', 'stadium'].forEach(function (t) {
        const s = CLUB.sponsors && CLUB.sponsors[t];
        if (s && s.yearsLeft > 0 && s.perYear) sponsors += s.perYear;
      });
    } catch (e) { sponsors = 0; }
    if (!sponsors) {
      const [shirt, stad] = SPONSOR[tierKey] || SPONSOR.bundesliga2;
      sponsors = shirt * INCOME + (lvl >= 4 ? stad * INCOME : 0);
    }
    // Banner ebenso: echte verkaufte Plätze statt Pauschale.
    let banner = 0;
    try { if (typeof bannerIncomePerSeason === 'function') banner = bannerIncomePerSeason(); } catch (e) {}
    if (!banner) banner = (lvl < 4 ? 8 : 14) * (BANNER_SLOT[tierKey] || 16000) * INCOME;
    // SPIELTAGSEINNAHMEN. Fehlten in der Saisonbilanz komplett: Dauerkarten decken
    // nur 45 % der Kapazität ab, die restlichen Tageskarten flossen zwar während
    // der Saison aufs Budget, wurden vom Vorstand aber nie eingeplant. Dadurch
    // war die Fixbilanz strukturell negativ. 17 Heimspiele, ~60 % Auslastung der
    // freien Plätze, Tageskarte ≈ 1/18 des Dauerkartenpreises.
    // Tageskarten: 17 Heimspiele, nur die tatsächlich erwarteten Besucher über
    // dem Dauerkartenblock, zum eingestellten Tagespreis.
    const matchday = 17 * tagesPlaetze * tagesPreis;
    const matchdayMin = 17 * tagesPlaetzeMin * tagesPreis;
    const matchdayMax = 17 * tagesPlaetzeMax * tagesPreis;
    // MERCHANDISING. Fehlte in der Planung komplett, obwohl es der zweitgrößte
    // Posten ist: 17.664 € je Heimspiel plus der Wochenumsatz sind zusammen rund
    // 355.000 € pro Saison — 18 % der Einnahmen eines Regionalligisten. Weil es
    // ungeplant aufs Konto floss, wuchs das Budget jede Saison „aus dem Nichts".
    let merch = 0;
    try {
      if (typeof merchIncomePerMatch === 'function') merch += 17 * merchIncomePerMatch();
      if (typeof window.merchandisingIncome === 'function') merch += 52 * window.merchandisingIncome();
    } catch (e) {}
    // Europapokal-Teilnahme hebt Sponsoren und Banner an — dieselbe Marke ist
    // international mehr wert.
    const eF = europaFaktor();
    const sponsorsE = sponsors * eF, bannerE = banner * eF;
    // Der Klausel-Abschlag bemisst sich am Umsatz OHNE die Klausel selbst —
    // sonst würde er sich rekursiv auf seine eigene Grundlage beziehen.
    const ohneKlausel = tv + seasonTickets + matchday + merch + sponsorsE + bannerE;
    const klausel = klauselBasisSaison(tierKey, ohneKlausel);
    return { tv, seasonTickets, matchday, merch, sponsors: sponsorsE, banner: bannerE, klausel,
             europaFaktor: eF, total: ohneKlausel + klausel,
             opsBasisZuschlag: (seasonTickets + matchday) * (INCOME - 1),
             // Bandbreite der Zuschauereinnahmen (Dauerkarten sind sicher,
             // die Tageskarten hängen am sportlichen Verlauf)
             matchdayMin, matchdayMax,
             zuschauerMin: Math.round(cap * nachfrage * 0.80),
             zuschauerMax: Math.round(cap * Math.min(1, nachfrage * 1.30)) };
  }
  function fixCost(tierKey, lvl, income) {
    // Personalkosten = Spielergehälter × Stab-Faktor (Stab, med. Personal, SV-Beiträge)
    const personal = weeklyWageSum() * 52 * CFG.staffCostFactor;
    // Betriebskosten = fester Sockel aus den Einnahmen. Der Verein hat sie auch
    // dann, wenn er nur Eigengewächse für den Mindestlohn spielen lässt.
    const anteil = CFG.opsShareOfIncome[tierKey] != null ? CFG.opsShareOfIncome[tierKey] : 0.32;
    const running = ((income && income.total ? income.total : 0) + ((income && income.opsBasisZuschlag) || 0)) * anteil;
    // Anlagenunterhalt (Stadion, Training, Jugend, Scouting, Merchandising) wird
    // von bundle_finance WÖCHENTLICH abgebucht. Er muss hier mit in die Planung,
    // sonst überrascht er den Vorstand — steckt aber schon im Betriebsanteil
    // oben drin, darf also nicht zusätzlich obendrauf.
    let anlagen = 0;
    try {
      if (window.RunningCosts && typeof window.RunningCosts.total === 'function') anlagen = window.RunningCosts.total() * 52;
    } catch (e) {}
    const betrieb = Math.max(anlagen, running);
    const amort = annualAmortization();
    return { wages: personal, running: betrieb, anlagen, amort, total: personal + betrieb + amort };
  }
  // Wöchentlicher Gehaltsdeckel aus den Einnahmen. Der alte feste Deckel je Liga
  // passte nicht zum Einnahmemodell: 1,4 Mio/Woche in der Bundesliga wären
  // 72,8 Mio im Jahr bei 52,6 Mio Einnahmen gewesen.
  function wageCapFromIncome(tierKey, income) {
    const anteil = CFG.wageShareOfIncome[tierKey] != null ? CFG.wageShareOfIncome[tierKey] : 0.52;
    // Gehaltsdeckel auf derselben Basis wie bisher (inkl. opsBasisZuschlag), sonst würde die Plankorrektur ihn senken.
    const jahr = ((income && income.total ? income.total : 0) + ((income && income.opsBasisZuschlag) || 0)) * anteil;
    return Math.round(jahr / 52 / CFG.staffCostFactor);
  }

  // ── BUDGET ZU SAISONBEGINN SETZEN ──────────────────────────────────────────
  function computeSeasonBudget() {
    const tierKey = myTierKey();
    const rank = myRank();
    const lvl = stadiumLevel();
    const inc = fixIncome(tierKey, rank, lvl);
    const cost = fixCost(tierKey, lvl, inc);
    const fixBalance = inc.total - cost.total;     // Transferbudget = Einnahmen − Kosten

    // Transferbudget = reine Fixbilanz. Kann negativ sein (muss dann ausgeglichen werden).
    let transfer = Math.round(fixBalance);
    const minB = CFG.minTransferBudget[tierKey] || 0;
    if (transfer < minB) transfer = minB;   // optionale Mini-Starthilfe (Standard: 0)

    // Gehaltsbudget-Limit aus den Einnahmen. Der feste Deckel je Liga bleibt als
    // Untergrenze stehen, damit ein Verein mit kleinem Stadion nicht handlungs-
    // unfähig wird; die 1,15 × laufende Gehälter verhindern, dass ein bestehender
    // Kader plötzlich über dem Deckel liegt.
    // Der Deckel darf nicht unter die laufenden Gehälter fallen (sonst wäre der
    // Zustand rechnerisch unmöglich) — aber auch NICHT darüber: früher stand
    // hier `weeklyWageSum() * 1.15`, wodurch ein Absteiger seinen zu teuren
    // Kader behalten UND weiter einkaufen durfte. Gemessen: nach dem Abstieg
    // aus der 3. Liga blieb der Deckel bei 47k statt der zur Regionalliga
    // passenden 18k, Ergebnis −1,2 Mio Bilanz Saison für Saison.
    // Jetzt bleibt das Gehaltsbudget bei 0, bis der Kader abgespeckt ist.
    const wageCap = Math.max(wageCapFromIncome(tierKey, inc),
                             CFG.wageCapFloor[tierKey] || 12000,
                             Math.round(weeklyWageSum()));

    CLUB.budget = transfer;
    CLUB.wageCap = wageCap;
    CLUB.wageBudget = Math.max(0, wageCap - weeklyWageSum());

    // Für UI/Transparenz ablegen
    CLUB._budgetBreakdown = { tierKey, rank, lvl, income: inc, cost, fixBalance, transfer, wageCap };
    return CLUB._budgetBreakdown;
  }

  // (Kein Eigenkapital mehr — der Verein spart nichts an. Transferbudget = Fixbilanz.)

  // ── KAUF: Budget darf ins Minus + Ablöse als Abschreibung verbuchen ───────
  // EIN sauberer Wrap: hebt die Budget-Sperre auf (Budget darf negativ werden)
  // und registriert die gezahlte Ablöse als Abschreibung über die Vertragsjahre.
  const _origBuy = window.buyPlayer;
  if (typeof _origBuy === 'function') {
    window.buyPlayer = function (marketId, years) {
      if (years == null || typeof CLUB === 'undefined') return _origBuy.apply(this, arguments);
      const realBudget = CLUB.budget;
      CLUB.budget = Number.MAX_SAFE_INTEGER;   // Sperre umgehen
      let r, spent = 0;
      try {
        r = _origBuy.apply(this, arguments);
      } finally {
        spent = Number.MAX_SAFE_INTEGER - CLUB.budget;   // tatsächlich gezahlte Ablöse
        CLUB.budget = realBudget - spent;                // darf jetzt negativ sein
        if (spent > 0) addAmortization(spent, years);    // Abschreibung registrieren
        if (typeof renderClubTab === 'function') { try { renderClubTab(); } catch (e) {} }
        if (typeof renderTransferTab === 'function') { try { renderTransferTab(); } catch (e) {} }
      }
      return r;
    };
    try { buyPlayer = window.buyPlayer; } catch (e) {}
  }

  // ── SAISONÜBERGANG (ein Wrap): Lizenz-Check → Original → neues Budget ──────
  const _origStartSeason = window.startNewSeason;
  if (typeof _origStartSeason === 'function') {
    window.startNewSeason = function () {
      // 0) LIZENZ-CHECK auf dem Stand, mit dem die Saison beendet wurde
      let carryOverDeficit = 0;
      let ruecklage = 0;
      // ÜBERSCHUSS MITNEHMEN. Bisher wanderte nur ein DEFIZIT in die neue Saison,
      // ein Plus verfiel — wer sparsam wirtschaftete, stand im Folgejahr exakt so
      // da wie einer, der alles verpulvert hat. Damit war Haushalten sinnlos.
      // Jetzt bleibt das übrige Geld auf dem Konto; der Vorstand legt sein
      // Saisonbudget obendrauf.
      if (typeof CLUB !== 'undefined' && CLUB.budget > 0) {
        ruecklage = Math.round(CLUB.budget * CFG.carryOverShare);
      }
      if (typeof CLUB !== 'undefined' && CLUB.budget < 0) {
        carryOverDeficit = CLUB.budget;
        if (typeof addNews === 'function') {
          addNews('club', '\u26A0\uFE0F Lizenz-Auflage: Budget im Minus',
            'Dein Transferbudget war mit ' + fmt(CLUB.budget) + ' negativ (Defizit ' + fmt(-CLUB.budget) + '). Der Vorstand verlangt einen Ausgleich \u2014 durch Verk\u00e4ufe oder eine g\u00fcnstigere Kaderstruktur. Das Defizit wird ins neue Budget \u00fcbertragen.');
        }
      }

      // 1) Original-Saisonwechsel (Auf-/Abstieg etc.)
      const result = _origStartSeason.apply(this, arguments);

      // 2) Abschreibungen eine Saison weiterticken
      try { tickAmortizationsOneSeason(); } catch (e) {}

      // 3) Neues Saison-Budget = Fixbilanz (+ ggf. \u00fcbertragenes Defizit)
      let bd = null;
      try {
        bd = computeSeasonBudget();
        if (carryOverDeficit < 0 && typeof CLUB !== 'undefined') {
          CLUB.budget += carryOverDeficit;
          bd.transfer = CLUB.budget;
          bd.carryOverDeficit = carryOverDeficit;
        }
        if (ruecklage > 0 && typeof CLUB !== 'undefined') {
          CLUB.budget += ruecklage;
          bd.transfer = CLUB.budget;
          bd.ruecklage = ruecklage;
          // Deckel: mehr als carryOverMax Jahresbudgets hortet der Verein nicht.
          // Basis wie vor der Plankorrektur (fixIncome, 2026-10-15): Überschuss + opsBasisZuschlag. Sonst schrumpft der
          // Deckel mit dem ehrlicheren Zuschauerplan, und Geld, das jetzt erst in der Saison hereinkommt, würde
          // am Saisonende abgeschöpft (Test: 14,1 → 0,7 Mio.).
          const deckelBasis = (bd.fixBalance || 0) + ((bd.income && bd.income.opsBasisZuschlag) || 0);
          // 2026-10-16: tierKey war hier nicht definiert → ReferenceError, sobald die Fixbilanz ≤ 0 war (Budget-Schritt fiel aus)
          const tierKey = (() => { try { return findFcmGroup(LEAGUE).tierKey; } catch (e) { return 'liga3'; } })();
          // FALLSCHIRM (2026-10-16, 10-Saisons-Lauf): Nach einem Abstieg brach die Basis auf das Mindestbudget der neuen Liga
          // ein – ein Absteiger mit 72 Mio. auf dem Konto stand plötzlich bei 2,4 Mio. Jetzt zählt mindestens die Hälfte der
          // Vorjahres-Basis; sie halbiert sich jede Saison weiter, wenn die neue Liga weniger hergibt.
          const basisJetzt = deckelBasis > 0 ? deckelBasis : (CFG.minTransferBudget[tierKey] || 120000);
          const basisFallschirm = Math.round((CLUB._deckelBasis || 0) * CFG.fallschirm);
          const basis = Math.max(basisJetzt, basisFallschirm);
          if (basisFallschirm > basisJetzt) bd.fallschirm = true;
          CLUB._deckelBasis = basis;
          const deckel = Math.round(basis * CFG.carryOverMax);
          if (CLUB.budget > deckel) {
            bd.abgeschoepft = CLUB.budget - deckel;
            CLUB.budget = deckel;
            bd.transfer = deckel;
          }
        }
      } catch (e) { console.warn('[Budget] compute', e); }

      // 4) Vorstands-News mit Aufschl\u00fcsselung
      if (bd && typeof addNews === 'function') {
        const c = bd.cost, inc = bd.income;
        let msg = 'Transferbudget: ' + fmt(bd.transfer) + ' \u00b7 Gehaltslimit: ' + fmt(bd.wageCap) + '/Woche.\n';
        msg += 'Einnahmen ' + fmt(inc.total) + ' (TV ' + fmt(inc.tv) + ', Dauerk. ' + fmt(inc.seasonTickets)
             + ', Spieltag ' + fmt(inc.matchday) + ', Merch ' + fmt(inc.merch || 0)
             + ', Sponsoren ' + fmt(inc.sponsors)
             + (inc.klausel ? ', Sponsorklausel ' + fmt(inc.klausel) : '')
             + ', Banner ' + fmt(inc.banner) + ')\n';
        if (inc.matchdayMin != null && inc.matchdayMax != null) {
          msg += '🎟️ Die Spieltagseinnahmen sind eine SCHÄTZUNG: je nach Verlauf ' +
                 fmt(inc.matchdayMin) + ' bis ' + fmt(inc.matchdayMax) +
                 ' (' + (inc.zuschauerMin || 0).toLocaleString('de-DE') + '–' +
                 (inc.zuschauerMax || 0).toLocaleString('de-DE') + ' Zuschauer). ' +
                 'Geplant wird vorsichtig — was mehr reinkommt, landet während der Saison auf dem Konto.\n';
        }
        if (inc.europaFaktor && inc.europaFaktor > 1) {
          const lbl = (typeof europaLabel === 'function' && europaLabel()) || 'Europapokal';
          msg += '🌍 ' + lbl + '-Teilnahme: Sponsoren und Klausel +' +
                 Math.round((inc.europaFaktor - 1) * 100) + ' %.\n';
        }
        // Anteile aus den tats\u00e4chlichen Zahlen, nicht mehr fest verdrahtet \u2014
        // der Betrieb h\u00e4ngt jetzt an den Einnahmen, das Personal am Kader.
        const pAnt = c.total ? Math.round(c.wages / c.total * 100) : 0;
        const bAnt = c.total ? Math.round(c.running / c.total * 100) : 0;
        msg += '\u2212 Kosten ' + fmt(c.total) + ' (Personal ' + fmt(c.wages) + ' = ' + pAnt + '%, Betrieb ' + fmt(c.running) + ' = ' + bAnt + '%' + (c.amort ? ', Abschreib. ' + fmt(c.amort) : '') + ')';
        if (bd.carryOverDeficit) msg += '\n\u26A0\uFE0F \u00dcbertragenes Defizit aus Vorsaison: ' + fmt(bd.carryOverDeficit);
        if (bd.ruecklage) msg += '\n\uD83D\uDCB0 R\u00FCcklage aus der Vorsaison: ' + fmt(bd.ruecklage) + ' \u2014 gut gewirtschaftet, das Geld bleibt dir.';
        if (bd.fallschirm) msg += '\nFallschirm: Die Rücklagen-Obergrenze sinkt nach dem Abstieg nur schrittweise.';
        if (bd.abgeschoepft) msg += '\n\uD83C\uDFE6 ' + fmt(bd.abgeschoepft) + ' \u00FCber der R\u00FCcklagen-Obergrenze (' +
          CFG.carryOverMax + ' Jahresbudgets) \u2014 der Vorstand steckt den \u00DCberhang in Infrastruktur und Vereinsr\u00FCcklagen.';
        addNews('club', '\uD83D\uDCBC Saison-Budget vom Vorstand', msg);
      }
      return result;
    };
    try { startNewSeason = window.startNewSeason; } catch (e) {}
  }

  // ── INITIALES BUDGET BEIM LADEN ───────────────────────────────────────────
  // 2026-10-16 (Fehlersuche): Beim Laden eines Spielstands steht CLUB hier schon mit dem gespeicherten Budget da. Früher wurde
  // trotzdem neu gerechnet – jedes Neuladen setzte das Transferbudget auf den Saisonanfang zurück (gemessen 400.000 → 922.150):
  // Einkäufe waren nach einem Neustart der App wieder „bezahlt“. Jetzt nur noch, wenn es noch keine Budgetrechnung gibt.
  if (typeof CLUB !== 'undefined' && typeof LEAGUE !== 'undefined' && LEAGUE) {
    const gespeichert = CLUB._budgetBreakdown && Number.isFinite(CLUB.budget) && Number.isFinite(CLUB.wageCap);
    if (!gespeichert) { try { computeSeasonBudget(); } catch (e) { console.warn('[Budget] init', e); } }
  }

  // ── ÖFFENTLICHE API ────────────────────────────────────────────────────────
  window.BudgetSystem = {
    config: CFG,
    recompute: computeSeasonBudget,
    breakdown: () => CLUB._budgetBreakdown,
    amortizations: () => CLUB._amortizations,
    annualAmortization,
  };

  console.log('%c[BudgetSystem v1] aktiv', 'color:#3fb950;font-weight:bold',
    '\u2014 Transferbudget = Einnahmen \u2212 Kosten (Betrieb 30%), Abschreibungen, Lizenz-Check, kein Eigenkapital');

})();


/* ---------- js/morale_system_patch.js ---------- */
/* ===== morale_system_patch.js ===== */
/* ═══════════════════════════════════════════════════════════════════════════
   MORAL-SYSTEM  ·  v1   (Fundament für das spätere Random-Event-System)
   ─────────────────────────────────────────────────────────────────────────
   Laden NACH engine_main.js und app_main.js (eines der letzten Skripte).

   Enthält:
   1) p.morale (0–100, Start 70) für alle Spieler + Backfill alter Stände
   2) teamMorale() = Live-Durchschnitt der Startelf
   3) Wöchentliche Drift Richtung 70 (±1) — im Wochen-Tick
   4) Match-Kopplung: Sieg +2..+4, Niederlage −2..−4, Remis ~0 (Startelf)
   5) Moral → Stärke: Faktor in computeTeamRatings() (max ±6 %)
   6) EXP.applyDelta öffentlich machen (für spätere Event-Reputation)
   7) Anzeige: Moral-Balken auf der Spielerkarte + Teammoral im Home-Tab

   NOCH KEINE EVENTS — die kommen als separater Patch obendrauf.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {

  const CFG = {
    start: 70,
    min: 0,
    max: 100,
    driftPerWeek: 1,        // Schritt Richtung 70 pro Woche
    matchWin:  [2, 4],      // zufälliger Bonus bei Sieg
    matchLoss: [2, 4],      // zufälliger Malus bei Niederlage
    matchDraw: 0,
    strengthMaxPct: 0.06,   // ±6 % bei Moral 100 / 40
    strengthFloor: 0.91,    // Deckel nach unten (zerrüttet)
    strengthCeil: 1.06,     // Deckel nach oben
    neutral: 70,
    span: 30,               // 70 ± 30 spannt den linearen Bereich
  };

  const clampM = (v) => Math.max(CFG.min, Math.min(CFG.max, Math.round(v)));
  const rndInt = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));

  // ── 1) MORAL-INIT / MIGRATION ──────────────────────────────────────────────
  function ensureMorale(p) {
    if (!p) return;
    if (typeof p.morale !== 'number' || isNaN(p.morale)) p.morale = CFG.start;
    p.morale = clampM(p.morale);
  }
  function ensureAllMorale() {
    if (typeof SQUAD !== 'undefined' && Array.isArray(SQUAD)) SQUAD.forEach(ensureMorale);
  }
  // Direkt beim Laden backfillen
  ensureAllMorale();

  // ── 2) TEAMMORAL (Live-Schnitt der Startelf) ───────────────────────────────
  function lineupPlayers() {
    try { return getLineupIds().map(getPlayer).filter(Boolean); }
    catch (e) { return []; }
  }
  function teamMorale() {
    const xi = lineupPlayers();
    if (!xi.length) return CFG.start;
    let s = 0, n = 0;
    xi.forEach(p => { ensureMorale(p); s += p.morale; n++; });
    return n ? Math.round(s / n) : CFG.start;
  }
  window.teamMorale = teamMorale;

  // Moral einer Spielergruppe verändern (für Events & Match)
  function addMorale(players, delta) {
    (players || []).forEach(p => { if (p) { ensureMorale(p); p.morale = clampM(p.morale + delta); } });
  }
  window.addMorale = addMorale;
  window.addTeamMorale = (delta) => addMorale(lineupPlayers(), delta);

  // ── 3) WÖCHENTLICHE DRIFT RICHTUNG 70 ──────────────────────────────────────
  function driftMoraleOneWeek() {
    if (typeof SQUAD === 'undefined' || !Array.isArray(SQUAD)) return;
    SQUAD.forEach(p => {
      ensureMorale(p);
      if (p.morale > CFG.neutral) p.morale = clampM(p.morale - CFG.driftPerWeek);
      else if (p.morale < CFG.neutral) p.morale = clampM(p.morale + CFG.driftPerWeek);
    });
  }
  // In den Wochen-Heartbeat einklinken: advanceCalendarWeek() wrappen
  if (typeof window.advanceCalendarWeek === 'function') {
    const _origAdvance = window.advanceCalendarWeek;
    window.advanceCalendarWeek = function () {
      const r = _origAdvance.apply(this, arguments);
      // Nur wenn die Woche wirklich fortgeschritten ist (kein Saisonende)
      if (r !== false) {
        try { ensureAllMorale(); driftMoraleOneWeek(); } catch (e) { console.warn('[Morale] drift', e); }
      }
      return r;
    };
    try { advanceCalendarWeek = window.advanceCalendarWeek; } catch (e) {}
  }

  // ── 4) MATCH-KOPPLUNG (Sieg/Niederlage → Startelf-Moral) ───────────────────
  // processFixtureResult() wrappen: nach dem Spiel die Moral der Startelf anpassen.
  if (typeof window.processFixtureResult === 'function') {
    const _origProcess = window.processFixtureResult;
    window.processFixtureResult = function () {
      // Startelf VOR dem Original merken (danach könnten Wechsel passieren)
      const xi = lineupPlayers();
      let goalsFor = null, goalsAgainst = null;
      try { if (typeof G !== 'undefined') { goalsFor = G.homeGoals; goalsAgainst = G.awayGoals; } } catch (e) {}
      const isFriendly = (typeof CURRENT_FIXTURE !== 'undefined' && CURRENT_FIXTURE && CURRENT_FIXTURE.type === 'friendly');

      const r = _origProcess.apply(this, arguments);

      // Moral nur bei Pflichtspielen koppeln
      if (!isFriendly && goalsFor != null && goalsAgainst != null && xi.length) {
        let delta = 0, label = '';
        if (goalsFor > goalsAgainst)      { delta = +rndInt(CFG.matchWin[0],  CFG.matchWin[1]);  label = 'Sieg'; }
        else if (goalsFor < goalsAgainst) { delta = -rndInt(CFG.matchLoss[0], CFG.matchLoss[1]); label = 'Niederlage'; }
        else                              { delta = CFG.matchDraw; label = 'Remis'; }
        if (delta !== 0) {
          addMorale(xi, delta);
          try {
            if (typeof addNews === 'function') {
              const tm = teamMorale();
              addNews('club', delta > 0 ? '😃 Stimmung steigt' : '😟 Stimmung gedämpft',
                `${label}: Die Moral der Startelf ${delta > 0 ? 'steigt' : 'sinkt'} um ${Math.abs(delta)}. Teammoral jetzt ${tm}.`);
            }
          } catch (e) {}
        }
      }
      return r;
    };
    try { processFixtureResult = window.processFixtureResult; } catch (e) {}
  }

  // ── 5) MORAL → STÄRKE (Faktor in computeTeamRatings) ───────────────────────
  // Kennlinie: faktor = clamp(1 + (teamMoral−70)/30 × 0.06, 0.91, 1.06)
  function moraleStrengthFactor() {
    const tm = teamMorale();
    const f = 1 + (tm - CFG.neutral) / CFG.span * CFG.strengthMaxPct;
    return Math.max(CFG.strengthFloor, Math.min(CFG.strengthCeil, f));
  }
  window.moraleStrengthFactor = moraleStrengthFactor;

  if (typeof window.computeTeamRatings === 'function') {
    const _origRatings = window.computeTeamRatings;
    window.computeTeamRatings = function () {
      const r = _origRatings.apply(this, arguments);
      try {
        const f = moraleStrengthFactor();
        // attack/defense/overall skalieren (mental bleibt — Kapitäns-Bonus dort).
        if (r && typeof r === 'object') {
          const cap = (v) => Math.round(Math.max(30, Math.min(95, v)));
          r.attack  = cap(r.attack  * f);
          r.defense = cap(r.defense * f);
          r.overall = cap(r.overall * f);
        }
      } catch (e) { console.warn('[Morale] ratings', e); }
      return r;
    };
    try { computeTeamRatings = window.computeTeamRatings; } catch (e) {}
  }

  // ── 6) EXP.applyDelta ÖFFENTLICH MACHEN ────────────────────────────────────
  // Das EXP-Modul hat applyDelta intern, exponiert es aber nicht. Für die späteren
  // Events brauchen wir Board/Ultras/EventFans-Deltas. Wir ergänzen einen sicheren
  // öffentlichen Zugriff über die vorhandenen Strukturen.
  if (typeof EXP !== 'undefined' && typeof EXP.applyDelta !== 'function') {
    try {
      EXP.applyDelta = function (d, reason) {
        const e = (typeof EXP.state === 'function') ? EXP.state() : (CLUB && CLUB.expectations);
        if (!e || !d) return;
        const clampSat = (v) => Math.max(0, Math.min(100, Math.round(v)));
        if (d.board != null)     e.boardSatisfaction = clampSat((e.boardSatisfaction || 50) + d.board);
        if (e.fanFactions) {
          if (d.ultras != null)    e.fanFactions.ultras    = clampSat((e.fanFactions.ultras || 50) + d.ultras);
          if (d.eventFans != null) e.fanFactions.eventFans = clampSat((e.fanFactions.eventFans || 50) + d.eventFans);
          // Fan-Gesamtwert neu mitteln (wie recomputeFan intern)
          if (typeof e.fanSatisfaction === 'number') {
            e.fanSatisfaction = clampSat(e.fanFactions.ultras * 0.5 + e.fanFactions.eventFans * 0.5);
          }
        }
      };
      console.log('[Morale] EXP.applyDelta öffentlich gemacht');
    } catch (e) { console.warn('[Morale] applyDelta expose', e); }
  }

  // ── 7) ANZEIGE ─────────────────────────────────────────────────────────────
  // Moral-Label/Farbe
  function moraleMeta(m) {
    m = clampM(m);
    if (m >= 85) return { label: 'euphorisch', color: '#3fb950', emoji: '🤩' };
    if (m >= 70) return { label: 'gut',         color: '#56d364', emoji: '🙂' };
    if (m >= 55) return { label: 'neutral',     color: '#d29922', emoji: '😐' };
    if (m >= 40) return { label: 'angespannt',  color: '#e3873c', emoji: '😟' };
    return            { label: 'zerrüttet',   color: '#f85149', emoji: '😠' };
  }
  function moraleBarHtml(m, opts) {
    m = clampM(m); const meta = moraleMeta(m); opts = opts || {};
    const w = opts.width || 120;
    return `<div class="morale-wrap" style="display:flex;align-items:center;gap:8px;${opts.style||''}">
      <div style="flex:1;min-width:${w*0.5}px;max-width:${w}px;height:8px;border-radius:5px;background:var(--bg3,#21262d);overflow:hidden">
        <div style="width:${m}%;height:100%;background:${meta.color};border-radius:5px;transition:width .3s"></div>
      </div>
      <span style="font-size:11px;color:var(--text2,#8b949e);white-space:nowrap">${meta.emoji} ${m} · ${meta.label}</span>
    </div>`;
  }
  window.moraleBarHtml = moraleBarHtml;
  window.moraleMeta = moraleMeta;

  // 7a) Spielerkarte: Moral-Zeile injizieren (renderPlayerCard wrappen)
  if (typeof window.renderPlayerCard === 'function') {
    const _origCard = window.renderPlayerCard;
    window.renderPlayerCard = function (p) {
      _origCard.apply(this, arguments);
      try {
        if (!p) return;
        ensureMorale(p);
        const el = document.getElementById('playercard-sec');
        if (!el || el.style.display === 'none') return;
        // Nur für eigene Spieler anzeigen
        if (!(typeof SQUAD !== 'undefined' && SQUAD.some(x => x.id === p.id))) return;
        if (el.querySelector('.pcard-morale')) return; // schon da
        // Nach der Mentalitäts-Zeile einfügen (oder ans Ende der rows)
        const row = document.createElement('div');
        row.className = 'pcard-row pcard-morale';
        row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px';
        row.innerHTML = `<span>Moral</span><span style="flex:1;max-width:160px">${moraleBarHtml(p.morale, {width:110})}</span>`;
        // Möglichst nach "Mentalität" platzieren
        const rows = el.querySelectorAll('.pcard-row');
        let after = null;
        rows.forEach(r => { if (r.textContent.includes('Mentalität')) after = r; });
        if (after && after.parentNode) after.parentNode.insertBefore(row, after.nextSibling);
        else el.appendChild(row);
      } catch (e) { console.warn('[Morale] card', e); }
    };
    try { renderPlayerCard = window.renderPlayerCard; } catch (e) {}
  }

  // 7b) Home-Tab: Teammoral-Kachel (renderHomeTab wrappen)
  if (typeof window.renderHomeTab === 'function') {
    const _origHome = window.renderHomeTab;
    window.renderHomeTab = function () {
      _origHome.apply(this, arguments);
      try {
        ensureAllMorale();
        const tm = teamMorale();
        const meta = moraleMeta(tm);
        const factor = moraleStrengthFactor();
        const pct = Math.round((factor - 1) * 100);
        const pctTxt = (pct > 0 ? '+' : '') + pct + '%';
        // Ziel-Container suchen (Home-Tab Wurzel)
        const home = document.getElementById('tab-home') || document.getElementById('home') ||
                     document.querySelector('[data-tab="home"]') || document.querySelector('.home-tab');
        const host = home || document.getElementById('view-home');
        if (!host) return;
        // Vorhandene Kachel entfernen, damit der Wert bei jedem Rendern aktualisiert wird
        const existing = host.querySelector('.team-morale-card');
        if (existing) existing.remove();
        const card = document.createElement('div');
        card.className = 'team-morale-card';
        card.style.cssText = 'margin:10px 0;padding:12px 14px;background:var(--bg2,#161b22);border:1px solid var(--border,#30363d);border-radius:12px';
        card.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <div style="font-weight:700;font-size:14px">${meta.emoji} Teammoral</div>
            <div style="font-size:12px;color:var(--text2,#8b949e)">Stärke-Effekt: <b style="color:${meta.color}">${pctTxt}</b></div>
          </div>
          ${moraleBarHtml(tm, {width:240})}
        `;
        // Möglichst oben einfügen
        host.insertBefore(card, host.firstChild);
      } catch (e) { console.warn('[Morale] home', e); }
    };
    try { renderHomeTab = window.renderHomeTab; } catch (e) {}
  }

  // ── ÖFFENTLICHE API ────────────────────────────────────────────────────────
  window.MoraleSystem = {
    CFG,
    ensureMorale, ensureAllMorale,
    teamMorale, addMorale,
    driftMoraleOneWeek, moraleStrengthFactor,
    moraleMeta, moraleBarHtml,
  };

  console.log('%c[MoraleSystem v1] aktiv', 'color:#3fb950;font-weight:bold',
    '— p.morale, Drift, Match-Kopplung, Moral→Stärke (±6%), Anzeige. (Events folgen separat.)');

})();


/* ---------- js/events_patch.js ---------- */
/* ===== events_patch.js ===== */
/* ═══════════════════════════════════════════════════════════════════════════
   RANDOM-EVENT-SYSTEM  ·  v1
   ─────────────────────────────────────────────────────────────────────────
   Laden NACH morale_system_patch.js (braucht MoraleSystem + EXP.applyDelta).
   Liest events_config.json (oder window.EVENTS_CONFIG als eingebetteten Spiegel).

   • Wochen-Wurf in advanceCalendarWeek(): 25 % Chance, 2 Wochen Cooldown.
   • Trigger-Prüfung + gewichtete Auswahl.
   • Effekte: Moral (Spieler/Team/Talent/Star), Geld (€/€€/€€€ rel. Liga-Budget),
     Reputation (Board/Ultras/EventFans), Pseudo-Verletzung, Match-Modifikatoren.
   • Risiko-Wetten (p → win/lose).
   • Entscheidungs-Dialog (Wiederverwendung des .exp-overlay-Musters).
   • Flavor-Events laufen direkt als News.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {

  // ── CONFIG laden (eingebettet oder via fetch) ──────────────────────────────
  let CONFIG = window.EVENTS_CONFIG || null;

  const DEFAULTS = {
    frequency: { baseChance: 0.25, cooldownWeeks: 2, skipBusyWeeks: false },
    money: { e: 0.02, ee: 0.06, eee: 0.15 },
    repStrength: { 1: 4, 2: 8, 3: 15 }
  };

  function cfg() { return CONFIG || DEFAULTS; }

  // ── HILFEN: Liga-Kontext, Geld, Spielerauswahl ─────────────────────────────
  function tierKey() {
    try { return findFcmGroup(LEAGUE).tierKey; } catch (e) { return 'bundesliga2'; }
  }
  function leagueStartBudget() {
    try { return defaultBudgetForTier(tierKey()); } catch (e) { return 1_500_000; }
  }
  function moneyAmount(tier) {
    const pct = (cfg().money || DEFAULTS.money)[tier] || 0.02;
    return Math.round(leagueStartBudget() * pct);
  }
  function repPoints(strength) {
    return (cfg().repStrength || DEFAULTS.repStrength)[Math.abs(strength)] || 4;
  }

  function squad() { return (typeof SQUAD !== 'undefined' && Array.isArray(SQUAD)) ? SQUAD : []; }
  function fitPlayers() { return squad().filter(p => p && !(typeof isInjured === 'function' && isInjured(p))); }
  function lineup() { try { return getLineupIds().map(getPlayer).filter(Boolean); } catch (e) { return []; } }

  function isTalent(p) { return p && p.age <= 21 && ((p.truePotential || p.ovr) - p.ovr) >= 8; }
  function isStarP(p) { return p && p.ovr >= 78; }
  function bestPlayer() { const s = squad(); return s.length ? s.slice().sort((a, b) => b.ovr - a.ovr)[0] : null; }
  function randomOf(arr, n) {
    const a = arr.slice(); const out = [];
    while (a.length && out.length < n) out.push(a.splice(Math.floor(Math.random() * a.length), 1)[0]);
    return out;
  }

  // ── SPIELER-KONTEXT & TEXT-PLATZHALTER ─────────────────────────────────────
  // Ein Event benennt konkrete Spieler ({star}, {talent}, {veteran}, {key}, {p1},
  // {p2}). Diese werden EINMAL vorab gewählt (buildEventCtx), im Text ersetzt UND
  // von applyEffect als Zielspieler wiederverwendet — so ist der genannte Spieler
  // auch wirklich der betroffene.
  function pname(p) {
    if (!p) return 'einer deiner Spieler';
    try { if (typeof displayName === 'function') return displayName(p); } catch (e) {}
    return (((p.firstName ? p.firstName + ' ' : '') + (p.name || '')).trim()) || 'ein Spieler';
  }
  function ppos(p) { return p ? ((p.positions && p.positions[0]) || p.pos || '') : ''; }
  function pickTalentP() { const t = squad().filter(isTalent); return t.length ? randomOf(t, 1)[0] : null; }
  function pickVeteranP() { const v = squad().filter(p => p && p.age >= 30); return v.length ? randomOf(v, 1)[0] : bestPlayer(); }
  function pickKeyP() { const k = squad().filter(p => p && (p.ovr >= 74 || isStarP(p))); return k.length ? k.slice().sort((a, b) => b.ovr - a.ovr)[0] : bestPlayer(); }
  function buildEventCtx() {
    return { star: bestPlayer(), talent: pickTalentP(), veteran: pickVeteranP(), key: pickKeyP(), pair: randomOf(squad(), 2) };
  }
  // Zielspieler für einen Effekt aus dem Kontext (eff.who = 'star'|'talent'|'veteran'|'key').
  function ctxPlayer(eff, ctx, fallback) {
    if (eff && eff.who && ctx && ctx[eff.who]) return ctx[eff.who];
    return fallback;
  }
  function tmpl(text, ctx) {
    if (!text) return text || '';
    if (!ctx) return String(text);
    const pr = ctx.pair || [];
    const map = {
      star: pname(ctx.star), talent: pname(ctx.talent), veteran: pname(ctx.veteran), key: pname(ctx.key),
      p1: pname(pr[0]), p2: pname(pr[1]),
      starPos: ppos(ctx.star), starOvr: ctx.star ? ctx.star.ovr : '', starAge: ctx.star ? ctx.star.age : '',
      keyPos: ppos(ctx.key), keyOvr: ctx.key ? ctx.key.ovr : '', keyAge: ctx.key ? ctx.key.age : '',
      talentAge: ctx.talent ? ctx.talent.age : '', talentPos: ppos(ctx.talent),
      veteranAge: ctx.veteran ? ctx.veteran.age : ''
    };
    return String(text).replace(/\{(\w+)\}/g, (m, k) => (map[k] != null && map[k] !== '') ? map[k] : m);
  }

  // ── TRIGGER ────────────────────────────────────────────────────────────────
  function nextFixture() { try { return fcmNextFixture(LEAGUE); } catch (e) { return null; } }
  function homeMatchNextWeek() {
    try { return matchdayDueThisWeek(LEAGUE) !== -1 && (nextFixture() || {}).isHome === true; }
    catch (e) { return false; }
  }
  function matchNextWeek() { try { return matchdayDueThisWeek(LEAGUE) !== -1; } catch (e) { return false; } }
  function windowOpen() { try { return isTransferWindowOpen(); } catch (e) { return false; } }

  const TRIGGERS = {
    always: () => true,
    squadMin14: () => squad().length >= 14,
    hasTalent: () => squad().some(isTalent),
    hasStar: () => squad().some(isStarP),
    noFixtureDensity: () => true,           // vereinfachte Annahme: keine 2-Spiele-Woche
    teamMoraleBelow75: () => (typeof teamMorale === 'function' ? teamMorale() : 70) < 75,
    veteranAndTalent: () => squad().some(p => p && p.age >= 30) && squad().some(isTalent),
    budgetAtLeastEE: () => (typeof CLUB !== 'undefined' && (CLUB.budget || 0) >= moneyAmount('ee')),
    homeMatchWithin2: () => { const f = nextFixture(); return !!(f && f.isHome); },
    hasOvr74OrStar: () => squad().some(p => p && (p.ovr >= 74 || isStarP(p))),
    homeMatchNextWeek: homeMatchNextWeek,
    matchNextWeek: matchNextWeek,
    thinSquadOrCongestion: () => squad().length <= 18,
    streak3: () => Math.abs(streakValue()) >= 3,
    freeWeek: () => !matchNextWeek(),
  };
  function triggerOk(ev) {
    const fn = TRIGGERS[ev.trigger]; return fn ? !!fn() : true;
  }

  // ── SIEGES-/NIEDERLAGEN-SERIE (für D5) ─────────────────────────────────────
  // Wird selbst getrackt, da die Engine keine Serie speichert.
  function ensureStreakStore() {
    if (typeof CLUB === 'undefined') return null;
    if (!CLUB._eventStreak) CLUB._eventStreak = { value: 0 };  // +N Siege / −N Niederlagen
    return CLUB._eventStreak;
  }
  function streakValue() { const s = ensureStreakStore(); return s ? s.value : 0; }
  function pushResult(win, loss) {
    const s = ensureStreakStore(); if (!s) return;
    if (win) s.value = s.value >= 0 ? s.value + 1 : 1;
    else if (loss) s.value = s.value <= 0 ? s.value - 1 : -1;
    else s.value = 0;
  }

  // ── EFFEKT-AUSFÜHRUNG ──────────────────────────────────────────────────────
  function applyEffect(eff, ctx) {
    if (!eff || !eff.type) return '';
    const M = window.MoraleSystem;
    switch (eff.type) {
      case 'moralePlayers': {
        // Bei count 2 bevorzugt das im Text genannte Paar {p1}/{p2}
        const ps = (eff.count === 2 && ctx && ctx.pair && ctx.pair.length === 2)
          ? ctx.pair.slice() : randomOf(squad(), eff.count || 1);
        if (M) M.addMorale(ps, eff.delta);
        return '';
      }
      case 'moraleTalent': {
        const chosen = ctxPlayer(eff, ctx, null) || (ctx && ctx.talent) || (squad().filter(isTalent)[0]);
        const pick = chosen ? [chosen] : [];
        if (M && pick.length) M.addMorale(pick, eff.delta);
        return '';
      }
      case 'moraleTalents': {
        const t = randomOf(squad().filter(isTalent), eff.count || 2);
        // das genannte Talent sicher einschließen
        if (ctx && ctx.talent && !t.includes(ctx.talent)) { t.pop(); t.unshift(ctx.talent); }
        if (M) M.addMorale(t, eff.delta);
        return '';
      }
      case 'moraleStar': {
        const s = ctxPlayer(eff, ctx, (ctx && ctx.star)) || bestPlayer();
        if (M && s) M.addMorale([s], eff.delta);
        return '';
      }
      case 'moraleVeteran': {
        const chosen = ctxPlayer(eff, ctx, null) || (ctx && ctx.veteran) || squad().filter(p => p && p.age >= 30)[0];
        const pick = chosen ? [chosen] : [];
        if (M && pick.length) M.addMorale(pick, eff.delta);
        return '';
      }
      case 'teamMorale': {
        if (M) M.addMorale(lineup(), eff.delta);
        return '';
      }
      case 'money': {
        const amt = moneyAmount(eff.tier) * (eff.sign || 1);
        if (typeof CLUB !== 'undefined') CLUB.budget = (CLUB.budget || 0) + amt;
        return (amt >= 0 ? '+' : '') + fmtMoney(amt);
      }
      case 'moneyRange': {
        const lo = moneyAmount(eff.min), hi = moneyAmount(eff.max);
        const amt = Math.round((lo + Math.random() * (hi - lo)) * (eff.sign || 1));
        if (typeof CLUB !== 'undefined') CLUB.budget = (CLUB.budget || 0) + amt;
        return (amt >= 0 ? '+' : '') + fmtMoney(amt);
      }
      case 'wage': {
        // Dauerhafte Gehaltsbelastung: senkt das freie Gehaltsbudget
        const amt = moneyAmount(eff.tier) * (eff.sign || -1);
        if (typeof CLUB !== 'undefined' && CLUB.wageBudget != null) CLUB.wageBudget += amt;
        return '';
      }
      case 'rep': {
        const d = {};
        if (eff.board != null)     d.board     = repPoints(eff.board)     * Math.sign(eff.board);
        if (eff.ultras != null)    d.ultras    = repPoints(eff.ultras)    * Math.sign(eff.ultras);
        if (eff.eventFans != null) d.eventFans = repPoints(eff.eventFans) * Math.sign(eff.eventFans);
        try { if (typeof EXP !== 'undefined' && EXP.applyDelta) EXP.applyDelta(d, 'event'); } catch (e) {}
        return '';
      }
      case 'mentalRandom': {
        randomOf(squad(), eff.count || 3).forEach(p => { if (p) p.mental = Math.min(95, (p.mental || 60) + (eff.delta || 1)); });
        return '';
      }
      case 'boostWeakestAttr': {
        const cnt = eff.count || 2;
        let targets = randomOf(squad().filter(isTalent), cnt);
        // das genannte Talent sicher einschließen
        if (ctx && ctx.talent && !targets.includes(ctx.talent)) { if (targets.length >= cnt) targets.pop(); targets.unshift(ctx.talent); }
        targets.forEach(p => {
          if (!p) return;
          const areas = [['def', p.def], ['mid', p.mid], ['att', p.att]].sort((a, b) => a[1] - b[1]);
          const key = areas[0][0]; p[key] = Math.min(95, p[key] + (eff.delta || 1));
          if (typeof recomputeOvr === 'function') try { recomputeOvr(p); } catch (e) {}
        });
        return '';
      }
      case 'injury': {
        // eff.who → benannter Spieler (z.B. der überlastete {key}) wird verletzt
        const named = ctxPlayer(eff, ctx, null);
        const targets = (named && !(typeof isInjured === 'function' && isInjured(named)))
          ? [named] : randomOf(fitPlayers(), eff.count || 1);
        targets.forEach(p => {
          if (!p) return;
          p.injuryWeeks = eff.weeks || 1;
          p.injuryType = eff.label || 'Blessur';
        });
        return '';
      }
      case 'nextMatchModifier': {
        if (typeof CLUB !== 'undefined') CLUB._nextMatchMod = { pct: eff.pct || 0, scope: eff.scope || 'any', label: eff.label || 'Sondereinfluss' };
        return '';
      }
      case 'nextMatchRandomSwing': {
        const pct = (Math.random() < 0.5 ? -1 : 1) * (eff.pct || 3);
        if (typeof CLUB !== 'undefined') CLUB._nextMatchMod = { pct, scope: 'any', label: pct > 0 ? 'Glückssträhne' : 'Pechsträhne' };
        return (pct > 0 ? '+' : '') + pct + '%';
      }
      case 'streakMorale': {
        const v = streakValue();
        const delta = v >= 3 ? Math.abs(eff.delta) : v <= -3 ? -Math.abs(eff.delta) : 0;
        if (M && delta) M.addMorale(lineup(), delta);
        return v >= 3 ? 'Euphorie' : v <= -3 ? 'Krise' : '';
      }
      case 'injuryRiskMod': {
        if (typeof CLUB !== 'undefined') CLUB._injuryRiskMod = { weeks: eff.weeks || 3, factor: eff.factor || 1 };
        return '';
      }
      case 'trainingPause': {
        if (typeof CLUB !== 'undefined') CLUB._trainingPause = { weeks: eff.weeks || 3 };
        return '';
      }
      default: return '';
    }
  }
  function applyEffects(list, ctx) {
    let notes = [];
    (list || []).forEach(e => { const n = applyEffect(e, ctx); if (n) notes.push(n); });
    return notes;
  }

  function fmtMoney(v) {
    try { return (typeof formatEuro === 'function') ? formatEuro(Math.abs(v)) : (Math.abs(v) + '€'); }
    catch (e) { return Math.abs(v) + '€'; }
  }

  // ── OPTION AUSWERTEN (sicher + Wette) ──────────────────────────────────────
  function resolveOption(opt, ctx) {
    let text = tmpl(opt.resultText || '', ctx);
    // Sichere Effekte zuerst
    if (opt.effects) applyEffects(opt.effects, ctx);
    // Wette
    if (opt.bet) {
      const win = Math.random() < (opt.bet.p || 0.5);
      const branch = win ? opt.bet.win : opt.bet.lose;
      if (branch) {
        applyEffects(branch.effects, ctx);
        text = (text ? text + ' ' : '') + tmpl(branch.text || '', ctx);
      }
    }
    return text || 'Erledigt.';
  }

  // ── EFFEKT → KLARTEXT (qualitativ, OHNE Zahlen & OHNE Wahrscheinlichkeit) ───
  // Übersetzt einen Effekt in einen kurzen "was kann passieren"-Chip. Bewusst
  // ohne konkrete Werte/Prozente, damit Spannung bleibt (Nutzerwunsch).
  function effChip(eff) {
    if (!eff || !eff.type) return null;
    const up = '↑', down = '↓', d = eff.delta || 0;
    const ic = n => `<i class="ti ti-${n}"></i>`;
    switch (eff.type) {
      case 'teamMorale':    return d >= 0 ? [ic('mood-happy'), 'Teammoral ' + up]    : [ic('mood-sad'), 'Teammoral ' + down];
      case 'moralePlayers': return d >= 0 ? [ic('mood-happy'), 'Spielermoral ' + up] : [ic('mood-sad'), 'Spielermoral ' + down];
      case 'moraleTalent':
      case 'moraleTalents': return d >= 0 ? [ic('mood-happy'), 'Talent motiviert']   : [ic('mood-sad'), 'Talent verstimmt'];
      case 'moraleStar':    return d >= 0 ? [ic('mood-happy'), 'Star motiviert']      : [ic('mood-sad'), 'Star verstimmt'];
      case 'moraleVeteran': return d >= 0 ? [ic('mood-happy'), 'Routinier motiviert'] : [ic('mood-sad'), 'Routinier verstimmt'];
      case 'money': {
        const amt = moneyAmount(eff.tier);
        return (eff.sign > 0) ? [ic('coin'), 'ca. +' + fmtMoney(amt)] : [ic('cash-off'), 'ca. −' + fmtMoney(amt)];
      }
      case 'moneyRange': {
        const lo = moneyAmount(eff.min), hi = moneyAmount(eff.max);
        const range = fmtMoney(lo) + '–' + fmtMoney(hi);
        return (eff.sign > 0) ? [ic('coin'), 'ca. +' + range] : [ic('cash-off'), 'ca. −' + range];
      }
      case 'wage':          return [ic('cash-off'), 'ca. −' + fmtMoney(moneyAmount(eff.tier)) + ' Gehalt'];
      case 'rep': {
        const keys = [['board', 'Vorstand'], ['ultras', 'Ultras'], ['eventFans', 'Fans']];
        for (const [k, lbl] of keys) if (eff[k] != null) return eff[k] >= 0 ? [ic('thumb-up'), 'Ruf bei ' + lbl + ' ' + up] : [ic('alert-triangle'), 'Ruf bei ' + lbl + ' ' + down];
        return [ic('thumb-up'), 'Reputation'];
      }
      case 'mentalRandom':        return [ic('brain'), 'Mentalität ' + (d >= 0 ? up : down)];
      case 'boostWeakestAttr':    return [ic('trending-up'), 'Spieler verbessert sich'];
      case 'injury':              return [ic('bandage'), 'Verletzungsgefahr'];
      case 'nextMatchModifier':   return (eff.pct >= 0) ? [ic('bolt'), 'Schub fürs nächste Spiel'] : [ic('snowflake'), 'Dämpfer fürs nächste Spiel'];
      case 'nextMatchRandomSwing':return [ic('dice'), 'Formschwankung im nächsten Spiel'];
      case 'streakMorale':        return [ic('chart-bar'), 'Moral je nach Lauf'];
      case 'injuryRiskMod':       return (eff.factor > 1) ? [ic('alert-triangle'), 'höheres Verletzungsrisiko'] : [ic('shield'), 'weniger Verletzungsrisiko'];
      case 'trainingPause':       return [ic('player-pause'), 'Trainingspause'];
      default: return null;
    }
  }
  function collectChips(effects) {
    if (!Array.isArray(effects)) return [];
    const seen = new Set(), out = [];
    effects.forEach(e => {
      const c = effChip(e); if (!c || seen.has(c[1])) return;
      seen.add(c[1]); out.push(`<span class="ev-chip">${c[0]} ${c[1]}</span>`);
    });
    return out.slice(0, 3);
  }
  // Baut die "Mögliche Folgen"-Zeile für eine Option (deterministisch vs. Wette).
  function outcomeHint(opt) {
    const safe = collectChips(opt.effects);
    if (opt.bet) {
      const win  = collectChips(opt.bet.win  && opt.bet.win.effects);
      const lose = collectChips(opt.bet.lose && opt.bet.lose.effects);
      const branches = [];
      if (win.length)  branches.push(win.join(' '));
      if (lose.length) branches.push(lose.join(' '));
      const body = branches.length ? branches.join(' <span class="ev-or">oder</span> ') : 'Der Ausgang ist offen.';
      return `<div class="ev-outcome"><span class="ev-outcome-lbl">Ausgang ungewiss:</span> ${safe.length ? safe.join(' ') + ' · ' : ''}${body}</div>`;
    }
    if (safe.length) return `<div class="ev-outcome"><span class="ev-outcome-lbl">Mögliche Folgen:</span> ${safe.join(' ')}</div>`;
    return '';
  }

  // ── DIALOG-UI (Wiederverwendung des exp-overlay-Musters) ───────────────────
  // Rückmeldung 18.10.: Wer an einem Ereignis beteiligt ist (Streit, Streik, Wunsch …), steht mit Gesicht im Fenster
  function beteiligteHtml(ev, ctx) {
    const texte = [ev.flavor || ''].concat((ev.options || []).map(o => o.label || '')).join(' ');
    const pr = (ctx && ctx.pair) || [], wer = [];
    const dazu = p => { if (p && wer.indexOf(p) < 0) wer.push(p); };
    if (/\{p1\}/.test(texte)) dazu(pr[0]);
    if (/\{p2\}/.test(texte)) dazu(pr[1]);
    ['star', 'key', 'talent', 'veteran'].forEach(k => { if (new RegExp('\\{' + k + '(Pos|Ovr|Age)?\\}').test(texte)) dazu(ctx && ctx[k]); });
    if (!wer.length) return '';
    const gesicht = p => {
      try {
        if (window.KSVerein && KSVerein.gesicht) return KSVerein.gesicht(p, 'fcm');
        if (window.DFLIdentitaet && DFLIdentitaet.gesichtSvg) {
          const f = window.DFLSpiel && DFLSpiel.franchise ? DFLSpiel.franchise('fcm') : null;
          return DFLIdentitaet.gesichtSvg(p, f ? { farben: f.farben } : null);
        }
      } catch (e) { /* ohne Gesicht */ }
      return '';
    };
    if (!document.getElementById('exp-wer-stil')) {
      const st = document.createElement('style'); st.id = 'exp-wer-stil';
      st.textContent = '.exp-wer{display:flex;gap:8px;flex-wrap:wrap;margin:-6px 0 14px}.exp-wer-sp{display:flex;align-items:center;gap:8px;padding:6px 10px 6px 6px;border-radius:12px;background:var(--bg3,rgba(127,127,127,.12));min-width:0}' +
        '.exp-wer-g{width:40px;height:40px;border-radius:10px;overflow:hidden;flex:none;background:var(--bg2,#fff)}.exp-wer-g svg{width:100%;height:100%;display:block}' +
        '.exp-wer-sp b{display:block;font-size:13px}.exp-wer-sp small{display:block;font-size:11px;color:var(--text2)}';
      document.head.appendChild(st);
    }
    return '<div class="exp-wer">' + wer.map(p => '<div class="exp-wer-sp"><span class="exp-wer-g">' + gesicht(p) + '</span><span><b>' + pname(p) + '</b><small>' +
      ppos(p) + ' · ' + (p.age || '') + ' J. · Stärke ' + (p.ovr || '') + '</small></span></div>').join('') + '</div>';
  }
  function showEventDialog(ev) {
    if (document.querySelector('.exp-overlay')) return false; // nicht überlagern
    const ctx = buildEventCtx();                 // Spieler EINMAL wählen (Text == betroffener Spieler)
    const optionsHtml = ev.options.map((opt, i) => {
      const hint = outcomeHint(opt);
      return `<div class="exp-offer">
        <div class="exp-offer-name">${tmpl(opt.label, ctx)}</div>
        ${hint}
        <button class="exp-offer-btn" onclick="window.__resolveEvent(${i})">Wählen</button>
      </div>`;
    }).join('');

    const ov = document.createElement('div');
    ov.className = 'exp-overlay';
    ov.innerHTML = `<div class="exp-dialog">
      <div class="exp-dialog-title"><i class="ti ti-dice"></i> ${ev.title}</div>
      ${beteiligteHtml(ev, ctx)}
      <div class="exp-dialog-sub">${tmpl(ev.flavor, ctx)}</div>
      <div class="exp-offer-grid">${optionsHtml}</div>
    </div>`;
    document.body.appendChild(ov);

    window.__resolveEvent = function (idx) {
      const opt = ev.options[idx];
      const resultText = resolveOption(opt, ctx);
      const o = document.querySelector('.exp-overlay'); if (o) o.remove();
      try {
        if (typeof addNews === 'function') addNews('club', `🎲 ${ev.title}`, `${tmpl(opt.label, ctx)}: ${resultText}`);
      } catch (e) {}
      try { if (typeof saveGameState === 'function') saveGameState(); } catch (e) {}
      try {
        if (typeof renderHomeTab === 'function') renderHomeTab();
        if (typeof renderClubTab === 'function') renderClubTab();
        if (typeof renderSquadList === 'function') renderSquadList();
      } catch (e) {}
      window.__resolveEvent = null;
    };
    return true;
  }

  // ── FLAVOR-EVENT direkt ausführen (keine Entscheidung) ─────────────────────
  function runFlavorEvent(ev) {
    const ctx = buildEventCtx();
    const notes = applyEffects(ev.flavorEffect, ctx);
    let extra = notes.length ? ` (${notes.join(', ')})` : '';
    try { if (typeof addNews === 'function') addNews('club', `🎲 ${ev.title}`, `${tmpl(ev.flavor, ctx)}${extra}`); } catch (e) {}
    try { if (typeof renderHomeTab === 'function') renderHomeTab(); } catch (e) {}
  }

  // ── GEWICHTETE AUSWAHL ─────────────────────────────────────────────────────
  function pickEvent() {
    const pool = (cfg().events || []).filter(triggerOk);
    if (!pool.length) return null;
    const total = pool.reduce((s, e) => s + (e.weight || 1), 0);
    let r = Math.random() * total;
    for (const e of pool) { r -= (e.weight || 1); if (r <= 0) return e; }
    return pool[pool.length - 1];
  }

  // ── WOCHEN-WURF ────────────────────────────────────────────────────────────
  function ensureEventStore() {
    if (typeof CLUB === 'undefined') return null;
    if (!CLUB._events) CLUB._events = { lastWeek: -99 };
    return CLUB._events;
  }
  // Saison × 100 + Woche: die Pause zwischen zwei Ereignissen muss über den Saisonwechsel tragen (2026-10-21 – mit der nackten Woche
  // kamen nach dem Saisonwechsel bis zur alten Woche + 2 keine Ereignisse mehr; alte Stände mit kleinem lastWeek passen weiter)
  function weekNow() { try { return LEAGUE ? (LEAGUE.season || 1) * 100 + LEAGUE.week : 0; } catch (e) { return 0; } }

  function maybeRollEvent() {
    const store = ensureEventStore(); if (!store) return;
    const f = cfg().frequency || DEFAULTS.frequency;
    const wk = weekNow();
    // Cooldown
    if (wk - store.lastWeek < f.cooldownWeeks) return;
    // Chance
    if (Math.random() >= f.baseChance) return;
    const ev = pickEvent();
    if (!ev) return;
    store.lastWeek = wk;
    // NICHT sofort anzeigen, sondern für die Anzeige am Wochenbeginn (auf dem Hub) vormerken.
    store.pending = ev.id;
  }

  // Zeigt ein vorgemerktes Event — wird beim Rendern des Home-Tabs (Hub) aufgerufen,
  // also nachdem der Spieler nach Spiel/Wochenwechsel auf der Übersicht landet.
  function flushPendingEvent() {
    const store = ensureEventStore(); if (!store || !store.pending) return;
    // Nicht über einen offenen Dialog (z.B. Philosophie/Sponsoren) legen
    try { if (document.querySelector('.exp-overlay')) return; } catch (e) { return; }
    const ev = (cfg().events || []).find(x => x.id === store.pending);
    store.pending = null;
    if (!ev) return;
    if (ev.decision === false || ev.flavorEffect) runFlavorEvent(ev);
    else showEventDialog(ev);
  }
  window.__flushPendingEvent = flushPendingEvent;

  // ── WOCHEN-HEARTBEAT: advanceCalendarWeek() wrappen ────────────────────────
  // Der Wurf entscheidet nur, OB ein Event kommt — angezeigt wird es erst auf dem
  // Hub (Home-Tab), also nachdem der Spieler nach Spiel/Wochenwechsel dort landet.
  if (typeof window.advanceCalendarWeek === 'function') {
    const _orig = window.advanceCalendarWeek;
    window.advanceCalendarWeek = function () {
      const r = _orig.apply(this, arguments);
      if (r !== false) {
        try { maybeRollEvent(); } catch (e) { console.warn('[Events] roll', e); }
      }
      return r;
    };
    try { advanceCalendarWeek = window.advanceCalendarWeek; } catch (e) {}
  }

  // ── ANZEIGE AM WOCHENBEGINN: an renderHomeTab (Hub) koppeln ────────────────
  // Sobald der Spieler nach dem Spiel / Wochenwechsel auf der Übersicht landet,
  // ploppt das vorgemerkte Event auf.
  if (typeof window.renderHomeTab === 'function') {
    const _origHome = window.renderHomeTab;
    window.renderHomeTab = function () {
      _origHome.apply(this, arguments);
      // Kurz verzögern, damit der Hub erst fertig rendert, dann der Dialog erscheint.
      try { setTimeout(function () { try { flushPendingEvent(); } catch (e) {} }, 350); } catch (e) {}
    };
    try { renderHomeTab = window.renderHomeTab; } catch (e) {}
  }

  // ── MATCH-ERGEBNIS: Serie tracken (für D5) ─────────────────────────────────
  if (typeof window.processFixtureResult === 'function') {
    const _orig = window.processFixtureResult;
    window.processFixtureResult = function () {
      let gf = null, ga = null, friendly = false;
      try { if (typeof G !== 'undefined') { gf = G.homeGoals; ga = G.awayGoals; } } catch (e) {}
      try { friendly = (typeof CURRENT_FIXTURE !== 'undefined' && CURRENT_FIXTURE && CURRENT_FIXTURE.type === 'friendly'); } catch (e) {}
      const r = _orig.apply(this, arguments);
      if (!friendly && gf != null && ga != null) {
        try { pushResult(gf > ga, gf < ga); } catch (e) {}
      }
      return r;
    };
    try { processFixtureResult = window.processFixtureResult; } catch (e) {}
  }

  // ── MATCH-MODIFIKATOR anwenden (D1/D2/D3): in computeTeamRatings ───────────
  // Einmaliger Bonus/Malus fürs nächste Spiel.
  if (typeof window.computeTeamRatings === 'function') {
    const _orig = window.computeTeamRatings;
    window.computeTeamRatings = function () {
      const r = _orig.apply(this, arguments);
      try {
        const mod = (typeof CLUB !== 'undefined') ? CLUB._nextMatchMod : null;
        if (mod && r && typeof r === 'object') {
          const isHome = (typeof FCM_IS_HOME !== 'undefined') ? FCM_IS_HOME : true;
          const applies = mod.scope === 'any' || (mod.scope === 'home' && isHome);
          if (applies) {
            const f = 1 + (mod.pct || 0) / 100;
            const cap = (v) => Math.round(Math.max(30, Math.min(95, v)));
            r.attack = cap(r.attack * f); r.defense = cap(r.defense * f); r.overall = cap(r.overall * f);
          }
        }
      } catch (e) {}
      return r;
    };
    try { computeTeamRatings = window.computeTeamRatings; } catch (e) {}
  }
  // Modifikator nach dem Spiel verbrauchen
  if (typeof window.processFixtureResult === 'function') {
    const _orig2 = window.processFixtureResult;
    window.processFixtureResult = function () {
      const r = _orig2.apply(this, arguments);
      try { if (typeof CLUB !== 'undefined' && CLUB._nextMatchMod) CLUB._nextMatchMod = null; } catch (e) {}
      return r;
    };
    try { processFixtureResult = window.processFixtureResult; } catch (e) {}
  }

  // ── ÖFFENTLICHE API (auch zum Testen) ──────────────────────────────────────
  window.EventSystem = {
    loadConfig: (c) => { CONFIG = c; },
    config: () => CONFIG,
    forceRoll: maybeRollEvent,
    forceEvent: (id) => { const e = (cfg().events || []).find(x => x.id === id); if (e) { (e.decision === false ? runFlavorEvent : showEventDialog)(e); } },
    pickEvent, triggerOk, streakValue,
    _triggers: TRIGGERS,
  };

  // Config nachladen, falls nicht eingebettet (aufgeteilte Struktur)
  if (!CONFIG && typeof fetch === 'function') {
    fetch('events_config.json').then(r => r.json()).then(c => { CONFIG = c; console.log('[EventSystem] Config geladen:', (c.events || []).length, 'Events'); }).catch(() => {
      console.warn('[EventSystem] events_config.json nicht ladbar — eingebetteten Spiegel nutzen oder Single-File verwenden.');
    });
  }

  console.log('%c[EventSystem v1] aktiv', 'color:#3fb950;font-weight:bold',
    '— ' + ((cfg().events||[]).length) + ' Events, Wochen-Wurf 25%/2W-Cooldown, Trigger, Wetten, Dialog. Test: EventSystem.forceEvent("A1")');

})();


/* ---------- js/transfer_plausibility.js ---------- */
/* ===== transfer_plausibility.js ===== */
/* ═══════════════════════════════════════════════════════════════════════════
   TRANSFER-PLAUSIBILITÄT  ·  v1   (OVR-Niveau-Sperre beim Kauf)
   ─────────────────────────────────────────────────────────────────────────
   Laden NACH contract_wage_patch.js und budget_system_patch.js
   (diese heben die Budget-/Gehaltssperren auf — hier kommt die Niveau-Bremse).

   Problem: Ein Viertligist konnte einen 85er-Star (z.B. Neuer) kaufen, weil es
   KEINE Niveau-Prüfung gab. Diese Datei ergänzt sie:

   • Je Liga ein realistisches Maximal-OVR für Neuzugänge.
   • HART darüber  → Spieler lehnt den Wechsel ab (kein Kauf möglich).
   • WEICH darüber → Kauf möglich, aber mit deutlichem Gehalts-/Ablöseaufschlag
     („Überzeugungsprämie"), weil der Star eigentlich zu gut für die Liga ist.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {

  const CFG = {
    // Realistisches „Komfort"-OVR je Liga (bis hier ganz normaler Transfer).
    softCapByTier: { bundesliga: 99, bundesliga2: 76, liga3: 69, regionalliga: 62 },
    // Hartes Maximum: darüber lehnt der Spieler grundsätzlich ab.
    // NACHGEZOGEN: bundesliga2 stand auf 84 — ein 80er-Bundesligaspieler konnte
    // damit problemlos in die 2. Liga wechseln. Jetzt ist bei 78 Schluss, die
    // Leiter darunter zieht mit (72 / 66).
    hardCapByTier: { bundesliga: 99, bundesliga2: 78, liga3: 72, regionalliga: 66 },
    // Aufschlag pro OVR-Punkt über dem Soft-Cap (auf Gehalt UND Ablöse).
    premiumPerOvrOverSoft: 0.18,   // +18 % je Punkt über Komfortzone
  };

  function ownTierKey() {
    try { return findFcmGroup(LEAGUE).tierKey; } catch (e) { return 'regionalliga'; }
  }
  function tierLabel(tk) {
    return ({ bundesliga: 'Bundesliga', bundesliga2: '2. Bundesliga', liga3: '3. Liga', regionalliga: 'Regionalliga' })[tk] || tk;
  }

  // Prüft, ob ein Spieler zum Liga-Niveau passt.
  //   → { ok:true }                          : normaler Transfer
  //   → { ok:true, premium:Faktor>1, over }  : machbar, aber teuer (weiche Zone)
  //   → { ok:false, reason }                 : abgelehnt (harte Zone)
  function checkTransferLevel(player) {
    const tk = ownTierKey();
    // Wer international spielt, bekommt Spieler ans Telefon, die sonst abwinken.
    const eu = (typeof europaStufe === 'function') ? europaStufe() : 0;
    const euBonus = eu === 3 ? 4 : eu === 2 ? 2 : eu === 1 ? 1 : 0;
    const soft = (CFG.softCapByTier[tk] ?? 99) + euBonus;
    const hard = (CFG.hardCapByTier[tk] ?? 99) + euBonus;
    const ovr = player.ovr || 0;
    if (ovr <= soft) return { ok: true, premium: 1, over: 0 };
    if (ovr > hard) {
      return { ok: false,
        reason: `${player.name} (OVR ${ovr}) ist zu hochklassig für die ${tierLabel(tk)}. ` +
                `Ein Spieler dieser Klasse wechselt nicht zu einem ${tierLabel(tk)}-Verein.` };
    }
    // Weiche Zone: machbar, aber mit Aufschlag
    const over = ovr - soft;
    const premium = 1 + over * CFG.premiumPerOvrOverSoft;
    return { ok: true, premium, over };
  }
  window.checkTransferLevel = checkTransferLevel;

  // ── buyPlayer umschließen: VOR allen anderen Wraps die Niveau-Prüfung ──────
  // Da contract_wage/budget die Budget-Sperren aufheben, ist dies die einzige
  // verbleibende „Kann ich diesen Spieler überhaupt holen?"-Bremse.
  const _origBuy = window.buyPlayer;
  if (typeof _origBuy === 'function') {
    window.buyPlayer = function (marketId, years) {
      // Nur beim echten Kaufabschluss prüfen (years gesetzt), nicht beim Dialog-Öffnen
      if (years != null && typeof MARKET !== 'undefined' && MARKET.players) {
        const p = MARKET.players.find(x => x.id === marketId);
        if (p) {
          const chk = checkTransferLevel(p);
          if (!chk.ok) {
            try { if (typeof alert === 'function') alert('🚫 ' + chk.reason); } catch (e) {}
            return; // Kauf blockiert
          }
          // Weiche Zone: Aufschlag auf value (Ablöse) und Gehalt anwenden.
          if (chk.premium > 1) {
            if (!p._origValue) p._origValue = p.value;
            p.value = Math.round(p._origValue * chk.premium);
            p._levelPremium = chk.premium;   // wird von Gehaltslogik mitgenommen (s.u.)
          }
        }
      }
      return _origBuy.apply(this, arguments);
    };
    try { buyPlayer = window.buyPlayer; } catch (e) {}
  }

  // ── Gehaltsforderung in der weichen Zone erhöhen ───────────────────────────
  // minWageDemand zusätzlich um den Level-Aufschlag anheben (nur für den Spieler,
  // der gerade gekauft wird — erkennbar an p._levelPremium).
  const _origWageDemand = window.minWageDemand;
  if (typeof _origWageDemand === 'function') {
    window.minWageDemand = function (player) {
      let w = _origWageDemand(player);
      if (player && player._levelPremium && player._levelPremium > 1) {
        w = Math.round(w * player._levelPremium);
      }
      return w;
    };
    try { minWageDemand = window.minWageDemand; } catch (e) {}
  }

  console.log('%c[TransferPlausibility v1] aktiv', 'color:#3fb950;font-weight:bold',
    '— OVR-Niveau-Sperre: ' + JSON.stringify(CFG.hardCapByTier));

})();


/* ---------- js/youth_development_patch.js ---------- */
/* ===== youth_development_patch.js ===== */
/* ═══════════════════════════════════════════════════════════════════════════
   NACHWUCHS-ENTWICKLUNG  ·  v1
   ─────────────────────────────────────────────────────────────────────────
   Laden NACH engine_main.js / app_main.js.

   Problem: Nachwuchsspieler (CLUB.youthProspects) alterten NIE und entwickelten
   sich NIE — ein 16-jähriges Talent blieb ewig 16 mit gleichem OVR.

   Fix (am Saisonende, gekoppelt an generateYouthProspects):
   • Jedes Talent wird +1 Jahr älter.
   • Talente entwickeln sich Richtung Potenzial — SCHNELLER als Profis,
     zusätzlich beschleunigt durch die Akademie-Stufe (youth-Facility).
   • Zu alte Talente (> maxAge) ohne Hochzug verlassen die Akademie.
   • Erst danach wird mit neuen Talenten aufgefüllt (Originalverhalten).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {

  const CFG = {
    maxAge: 20,            // älter als das → verlässt die Akademie (wenn nicht hochgezogen)
    // Entwicklung: Talente sind "schneller als Profis". Profis: ~0.25 Basis-Chance.
    baseGrowChance: 0.55,  // Grundchance auf Wachstum pro Jahr
    perPotGapChance: 0.03, // + je Punkt Abstand zum Potenzial
    academyPerLevel: 0.04, // + je Akademie-Stufe (Stufe 10 = +0.40)
    bigJumpChance: 0.45,   // Chance, dass bei großem Potenzial-Abstand +2 statt +1 kommt
    bigJumpGapMin: 5,      // ab so viel Abstand möglich
  };

  function clamp2(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function ovrFromAreas(p) {
    return (typeof computeOvrFromAreas === 'function') ? computeOvrFromAreas(p)
      : Math.round((p.def + p.mid + p.att) / 3);
  }

  // Entwickelt EIN Talent um ein Jahr (Alter + Wachstum).
  function developProspect(p, academyLvl) {
    if (!p) return;
    // 1) Altern
    p.age = (p.age || 16) + 1;

    // 2) Entwicklung Richtung Potenzial (deutlich schneller als Profis)
    const pot = p.truePotential || (p.ovr + 6);
    if (p.ovr < pot) {
      const gap = pot - p.ovr;
      // Erwartetes Wachstum pro Jahr: wächst mit Potenzial-Abstand UND Akademie-Stufe.
      // Junge Talente mit viel Luft nach oben springen kräftig (rasant).
      const lvl = academyLvl || 1;
      let expectedGain = gap * (0.28 + lvl * 0.025);   // Stufe 1 ≈ 30% des Abstands, Stufe 10 ≈ 53%
      // Jüngere entwickeln sich schneller
      if (p.age <= 17) expectedGain *= 1.25;
      else if (p.age >= 20) expectedGain *= 0.7;
      // In ganzzahlige Schritte umsetzen, mit etwas Zufall
      let gain = Math.floor(expectedGain);
      if (Math.random() < (expectedGain - gain)) gain += 1;   // Nachkommarest als Chance
      gain = Math.max(0, Math.min(gain, gap));                 // nie über Potenzial
      if (gain > 0) {
        // Wachstum auf die zwei stärksten Bereiche verteilen
        const areas = [['def', p.def], ['mid', p.mid], ['att', p.att]].sort((a, b) => b[1] - a[1]);
        let remaining = gain;
        const toMain = Math.ceil(remaining * 0.6);
        const toSecond = remaining - toMain;
        p[areas[0][0]] = clamp2(p[areas[0][0]] + toMain, 20, 99);
        p[areas[1][0]] = clamp2(p[areas[1][0]] + toSecond, 20, 99);
        p.mental = clamp2((p.mental || 55) + Math.ceil(gain / 2), 20, 99);
        if (p.pace != null) p.pace = clamp2(p.pace + Math.floor(gain / 2), 20, 99);
        p.ovr = clamp2(ovrFromAreas(p), 20, 99);
        if (p.ovr > pot) p.ovr = pot;
      }
    }
    // Marktwert aktualisieren
    try { if (typeof computeMarketValue === 'function') p.value = computeMarketValue(p); } catch (e) {}
  }

  // Wrappt generateYouthProspects: ERST bestehende Talente entwickeln/altern/abgehen,
  // DANN das Original (füllt mit neuen Talenten auf).
  if (typeof window.generateYouthProspects === 'function') {
    const _origGen = window.generateYouthProspects;
    window.generateYouthProspects = function () {
      try {
        if (typeof CLUB !== 'undefined' && Array.isArray(CLUB.youthProspects) && CLUB.youthProspects.length) {
          const academyLvl = (CLUB.facilities && CLUB.facilities.youth) ? CLUB.facilities.youth : 1;
          // a) Entwickeln + altern
          CLUB.youthProspects.forEach(p => developProspect(p, academyLvl));
          // b) Zu alte Talente verlassen die Akademie
          const before = CLUB.youthProspects.length;
          const leaving = CLUB.youthProspects.filter(p => p.age > CFG.maxAge);
          if (leaving.length) {
            CLUB.youthProspects = CLUB.youthProspects.filter(p => p.age <= CFG.maxAge);
            try {
              if (typeof addNews === 'function') {
                const names = leaving.map(p => `${p.firstName ? p.firstName + ' ' : ''}${p.name} (${p.age}, OVR ${p.ovr})`).join(', ');
                addNews('club', '👋 Talente verlassen die Akademie',
                  `${leaving.length} Talent${leaving.length === 1 ? '' : 'e'} ${leaving.length === 1 ? 'ist' : 'sind'} zu alt für die Jugend und ${leaving.length === 1 ? 'hat' : 'haben'} den Verein verlassen: ${names}. Ziehe Talente rechtzeitig hoch!`);
              }
            } catch (e) {}
          }
        }
      } catch (e) { console.warn('[YouthDev] develop', e); }
      // c) Original: mit neuen Talenten auffüllen
      return _origGen.apply(this, arguments);
    };
    try { generateYouthProspects = window.generateYouthProspects; } catch (e) {}
  }

  window.YouthDevelopment = { CFG, developProspect };

  console.log('%c[YouthDevelopment v1] aktiv', 'color:#3fb950;font-weight:bold',
    '— Nachwuchs altert + entwickelt sich (schneller als Profis, Akademie-Stufe beschleunigt), Abgang ab Alter > ' + CFG.maxAge);

})();