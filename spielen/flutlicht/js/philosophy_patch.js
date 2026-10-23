/* ===== philosophy_patch.js =====
   VEREINS-DNA v1 — Philosophie bleibt, Ziele skalieren mit der Lage
   ─────────────────────────────────────────────────────────────────────────────
   Vorher wurde die Philosophie JEDE Saison neu gewürfelt (`hookSeasonStart` setzt
   `philosophyId = null` und bietet drei zufällige an). Der Verein erfand sich
   damit jährlich neu und hatte keine Identität.

   Dieses Modul macht daraus eine Vereins-DNA:
     1. Einmal gewählt, bleibt sie — neu gewählt nur bei ZWEI Aufstiegen seit der
        letzten Wahl, bei einem Abstieg, oder wenn das Vorstandsvertrauen unter 25
        fällt. „Kurs beibehalten" ist dabei immer eine Option.
     2. Die Saisonziele sind ein Dreier-Paket (sportlich / wirtschaftlich /
        strukturell) und rechnen sich AUS DER AKTUELLEN LAGE — Anteile am Umsatz,
        am Transferbudget, an der eigenen Ausbaustufe. Keine festen Euro-Beträge,
        damit sie beim Aufstieg automatisch mitwachsen.
     3. Vorstandsprojekte: einmal pro Saison ein Angebot mit Preis und
        Gegenleistung (Aufstiegspflicht, Stadionausbau, Investor, Sparkurs,
        Nachwuchsoffensive).

   Lädt NACH engine_main.js/app_main.js und VOR init_bootstrap.js.
   ============================================================================= */
(function () {
  'use strict';

  if (typeof EXP === 'undefined' || !EXP || !EXP.PHILOSOPHIES) {
    console.warn('[VereinsDNA] EXP nicht gefunden — Modul inaktiv');
    return;
  }

  const CFG = {
    // Wirtschaftsziel: so viel vom Transferbudget muss am Saisonende übrig sein.
    ruecklageAnteil: 0.30,
    // Strukturziel: der Vorstand fordert die nächste Ausbaustufe nur alle N Saisons,
    // sonst wäre das Stadion nach acht Jahren fertig und das Ziel tot.
    ausbauAlleNSaisons: 2,
    // Philosophie-Wechsel
    wechselNachAufstiegen: 2,
    wechselUnterVertrauen: 25,
    // Aufstiegspflicht: bis Platz 4 überlebt man, danach ist Schluss.
    aufstiegspflichtNochOk: 4
  };

  // ── STADION-DECKEL JE LIGA ─────────────────────────────────────────────────
  // Gemessen: nach acht Saisons in der Regionalliga stand das Stadion auf Stufe 7
  // (42.000 Plätze) bei 20.731 Zuschauerschnitt — Bundesliga-Maße in der vierten
  // Liga. Weder das Vorstandsprojekt (`stadium < 9`) noch der manuelle Ausbau
  // (`cur >= def.maxLevel`) kannten einen Ligabezug.
  // Neue Regel: gebaut wird nur bis zu der Größe, die die aktuelle Liga trägt.
  // Bezug sind die realen Größenordnungen im deutschen Fußball —
  //   Regionalliga  Stufe 3 → 13.000 (Liga-4-Neubauten liegen bei 5–13k;
  //                 RW Essen 20k und Aachen 32k sind Erbe aus besseren Zeiten)
  //   3. Liga       Stufe 5 → 25.000 (Median 10–15k, Dresden 32k als Ausreißer)
  //   2. Bundesliga Stufe 7 → 42.000 (Median 25–30k, Schalke 62k ist BL-Erbe)
  //   Bundesliga    Stufe 10 → 75.000 (Dortmund 81k)
  // WICHTIG: Der Deckel BREMST nur den Neubau, er reißt nichts ab. Wer mit einem
  // Stufe-8-Stadion absteigt, behält es — genau das ist der Aachen-Effekt und
  // zugleich die Voraussetzung dafür, dass „Stufe 7–8" ein erreichbares
  // Karriereziel über mehrere Aufstiege bleibt.
  const STADION_DECKEL = { regionalliga: 3, liga3: 5, bundesliga2: 7, bundesliga: 10 };
  function stadionDeckel() {
    const jetzt = (CLUB.facilities && CLUB.facilities.stadium) || 1;
    return Math.max(jetzt, STADION_DECKEL[tierKey()] || 3);
  }
  function deckelPlaetze(stufe) {
    try { return stadiumCapacityForLevel(stufe).toLocaleString('de-DE') + ' Plätze'; }
    catch (e) { return 'Stufe ' + stufe; }
  }

  // ── Bezugsgrößen aus der aktuellen Lage ────────────────────────────────────
  // Bezugsgrößen IMMER frisch rechnen. `CLUB._budgetBreakdown` kann von der
  // vorigen Liga oder gar der vorigen Karriere stammen — dann stand in der
  // Regionalliga plötzlich „Rücklage ≥ 1,82 Mio" oder ein Umsatz von 4,5 Mio
  // bei Stadion-Stufe 1.
  // WICHTIG: `computeSeasonBudget` SETZT nebenbei Kontostand und Gehaltsdeckel.
  // Mitten in der Saison aufgerufen würde das dem Spieler sein Geld wegnehmen —
  // deshalb sichern und danach zurückschreiben.
  function frischeAufschluesselung() {
    if (!(window.BudgetSystem && window.BudgetSystem.recompute)) return null;
    const b0 = CLUB.budget, c0 = CLUB.wageCap, w0 = CLUB.wageBudget;
    let bd = null;
    try { bd = window.BudgetSystem.recompute(); } catch (e) { return null; }
    CLUB.budget = b0; CLUB.wageCap = c0; CLUB.wageBudget = w0;
    return bd;
  }
  function lage() {
    let bd = frischeAufschluesselung();
    if (!bd) bd = (typeof CLUB !== 'undefined' && CLUB._budgetBreakdown) ? CLUB._budgetBreakdown : null;
    return {
      umsatz: bd && bd.income ? bd.income.total : 0,
      budget: bd ? (bd.transfer || 0) : (CLUB.budget || 0),
      deckel: bd ? (bd.wageCap || 0) : (CLUB.wageCap || 0),
      tier: bd ? bd.tierKey : tierKey()
    };
  }
  function tierKey() {
    try { return findFcmGroup(LEAGUE).tierKey || 'regionalliga'; } catch (e) { return 'regionalliga'; }
  }
  function euro(v) { return (typeof formatEuro === 'function') ? formatEuro(Math.round(v)) : Math.round(v) + ' €'; }
  function wochenlohn() {
    try { return SQUAD.filter(p => !p.onLoanAt).reduce((s, p) => s + (p.wage || 0), 0); } catch (e) { return 0; }
  }

  // ── Zustand dieses Moduls (im Spielstand) ──────────────────────────────────
  function dna() {
    const e = EXP.state();
    if (!e._dna) {
      e._dna = { seitSaison: (typeof LEAGUE !== 'undefined' && LEAGUE) ? LEAGUE.season : 1,
                 aufstiege: 0, letzteTier: tierKey(), letzterAusbau: 0,
                 projekt: null, projektAngebot: null };
    }
    return e._dna;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1) PHILOSOPHIE BLEIBT
  // ═══════════════════════════════════════════════════════════════════════════
  // Gründe, aus denen der Vorstand neu ausrichtet. Ohne Grund wird die bestehende
  // Philosophie beibehalten und nur ihre Ziele neu gerechnet.
  function wechselGrund(e, d) {
    if (!e.philosophyId) return 'erstwahl';
    if (d.aufstiege >= CFG.wechselNachAufstiegen) return 'aufstiege';
    if (d.letzteTier !== tierKey()) {
      const rang = { regionalliga: 3, liga3: 2, bundesliga2: 1, bundesliga: 0 };
      if (rang[tierKey()] > rang[d.letzteTier]) return 'abstieg';
    }
    if ((e.boardSatisfaction || 60) < CFG.wechselUnterVertrauen) return 'vertrauen';
    return null;
  }
  const GRUND_TEXT = {
    erstwahl:  'Der Vorstand legt die Ausrichtung für deine Amtszeit fest.',
    aufstiege: 'Zwei Aufstiege — der Verein hat eine neue Größe erreicht und richtet sich neu aus.',
    abstieg:   'Nach dem Abstieg verlangt der Vorstand eine Kurskorrektur.',
    vertrauen: 'Das Vertrauen ist angeschlagen. Der Vorstand stellt die Ausrichtung zur Debatte.'
  };

  const _hookSeasonStart = EXP.hookSeasonStart;
  EXP.hookSeasonStart = function () {
    const e = EXP.state();
    const alteId = e.philosophyId;
    const d = dna();
    // Aufstieg mitzählen, BEVOR das Original den Zustand überschreibt
    try {
      const jetzt = tierKey();
      const rang = { regionalliga: 3, liga3: 2, bundesliga2: 1, bundesliga: 0 };
      if (d.letzteTier && rang[jetzt] < rang[d.letzteTier]) d.aufstiege++;
    } catch (err) {}

    const r = _hookSeasonStart.apply(this, arguments);

    const e2 = EXP.state();
    if (!e2._dna) e2._dna = d; else Object.assign(e2._dna, d);
    const dd = dna();
    const grund = wechselGrund({ philosophyId: alteId, boardSatisfaction: e2.boardSatisfaction }, dd);

    if (!grund && alteId && EXP.PHILOSOPHIES[alteId]) {
      // KEIN Wechsel: Kurs beibehalten, nur Ziele neu rechnen.
      e2.pendingPhilosophyOffers = null;
      EXP.choosePhilosophy(alteId);
    } else {
      // Wechsel steht an — die bestehende Philosophie kommt mit zur Auswahl.
      dd.aufstiege = 0;
      dd.seitSaison = LEAGUE ? LEAGUE.season : 1;
      const angebote = e2.pendingPhilosophyOffers || [];
      if (alteId && angebote.indexOf(alteId) === -1) {
        e2.pendingPhilosophyOffers = [alteId].concat(angebote.slice(0, 2));
      }
      if (typeof addNews === 'function' && grund && grund !== 'erstwahl') {
        addNews('club', '🏛️ Neuausrichtung', GRUND_TEXT[grund]);
      }
    }
    dd.letzteTier = tierKey();
    // Projektangebot für die neue Saison würfeln
    try { wuerfleProjekt(); } catch (err) { console.warn('[VereinsDNA] Projekt', err); }
    return r;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 2) ZIELE AUS DER LAGE
  // ═══════════════════════════════════════════════════════════════════════════
  // Anteil des Gehaltsdeckels, den die Philosophie höchstens ausgeschöpft sehen will.
  const LOHNQUOTE = { sparfuchs: 0.75, minimalisten: 0.85, jugendwahn: 0.80,
                      cantera: 0.85, traditionsbewahrer: 0.90, kaufrausch: 1.00 };

  function ausbauZiel(d) {
    const s = LEAGUE ? LEAGUE.season : 1;
    // In der ersten Saison gibt es immer eines (letzterAusbau ist dann 0 und der
    // Abstand damit rechnerisch zu klein — deshalb der Sonderfall).
    if (d.letzterAusbau && s - d.letzterAusbau < CFG.ausbauAlleNSaisons) return null;
    const f = (CLUB.facilities || {});
    // Abwechselnd Stadion und Akademie, je nachdem was weiter zurück ist.
    // WICHTIG: Das Stadion nur fordern, solange der LIGA-DECKEL es zulässt —
    // sonst verlangt der Vorstand eine Stufe, die `upgradeFacility` selbst
    // blockiert, und das Saisonziel wäre nicht erfüllbar.
    const stad = f.stadium || 1, jug = f.youth || 1;
    const stadionOffen = stad < stadionDeckel() && stad < 10;
    const jugendOffen = jug < 10;
    let key = null;
    if (stadionOffen && jugendOffen) key = (jug <= stad) ? 'youth' : 'stadium';
    else if (stadionOffen) key = 'stadium';
    else if (jugendOffen) key = 'youth';
    else {
      // Beides am Anschlag: auf Training/Scouting ausweichen, damit das
      // Dreier-Paket vollständig bleibt statt ein Ziel ersatzlos wegfällt.
      const rest = ['training', 'scouting'].filter(function (k) { return (f[k] || 1) < 10; });
      if (!rest.length) return null;
      rest.sort(function (a, b) { return (f[a] || 1) - (f[b] || 1); });
      key = rest[0];
    }
    const LABEL = { youth: 'Jugendakademie', stadium: 'Stadion',
                    training: 'Trainingsgelände', scouting: 'Scouting-Abteilung' };
    const jetzt = f[key] || 1;
    return { key: key, ziel: jetzt + 1, label: LABEL[key] || key };
  }

  const _choose = EXP.choosePhilosophy;
  EXP.choosePhilosophy = function (id) {
    const r = _choose.apply(this, arguments);
    try {
      const e = EXP.state(), g = e.seasonGoals, d = dna();
      if (!g) return r;
      const L = lage();
      // — wirtschaftlich: Rücklage als Anteil des Transferbudgets —
      g.minRuecklage = Math.round(L.budget * CFG.ruecklageAnteil);
      // — wirtschaftlich: Lohnquote als Anteil des Gehaltsdeckels —
      g.maxLohnquote = LOHNQUOTE[id] != null ? LOHNQUOTE[id] : 0.90;
      g.maxLohnWoche = Math.round(L.deckel * g.maxLohnquote);
      // — strukturell: nächste Ausbaustufe —
      const ab = ausbauZiel(d);
      // Merken, WANN gefordert wurde — sonst stünde dieselbe Stufe jede Saison
      // wieder auf der Liste und `ausbauAlleNSaisons` hätte keine Wirkung.
      if (ab) { g.ausbau = ab; d.letzterAusbau = LEAGUE ? LEAGUE.season : 1; }
      const teile = ['Rücklage ≥ ' + euro(g.minRuecklage),
                     'Gehälter ≤ ' + euro(g.maxLohnWoche) + '/Wo'];
      if (ab) teile.push(ab.label + ' auf Stufe ' + ab.ziel);
      g.paketNote = teile.join(' · ');
      if (typeof addNews === 'function') {
        addNews('club', '📋 Vorstands-Vorgaben', 'Neben dem Tabellenziel erwartet der Vorstand: ' + g.paketNote + '.');
      }
    } catch (err) { console.warn('[VereinsDNA] Ziele', err); }
    return r;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 3) JUGENDWAHN & TRADITIONS-BEWAHRER REPARIEREN
  // ═══════════════════════════════════════════════════════════════════════════
  // Alt: „in 17 Spielen mindestens ein U21 in der Startelf" — das erfüllt ein
  // einziges durchspielendes Talent. Neu: mehrere VERSCHIEDENE U21 mit je
  // mindestens fünf Startelf-Einsätzen. Dafür muss man wirklich eine Jugend
  // aufbauen statt ein Alibi-Talent zu parken.
  // Zielzahl am Ende des Aufbaus. Sie wird NICHT sofort verlangt — siehe Rampe.
  const JW_SPIELER = { regionalliga: 6, liga3: 6, bundesliga2: 7, bundesliga: 7 };
  const JW_START = 3;   // im ersten Jahr der Philosophie

  // Wie viele U21-Spieler fordert der Vorstand DIESE Saison?
  // Ein geerbter Kader hat typischerweise zwei U21-Spieler und drei Talente in
  // einer Akademie mit drei Plätzen — sechs Stammkräfte sind im ersten Jahr
  // schlicht nicht aufzutreiben. Deshalb eine Rampe: Start bei drei, jede Saison
  // einer mehr, bis das volle Maß erreicht ist. Wer die Philosophie durchhält,
  // wächst also in die Vorgabe hinein.
  function jwSollSpieler() {
    const ziel = JW_SPIELER[tierKey()] || 6;
    const d = dna();
    const jahre = Math.max(0, (LEAGUE ? LEAGUE.season : 1) - (d.seitSaison || 1));
    return Math.min(ziel, JW_START + jahre);
  }
  // Zahl der U21-Spieler im aktuellen Kader — Grundlage für die Nachwuchsoffensive.
  function u21ImKader() {
    try { return SQUAD.filter(function (p) { return !p.onLoanAt && EXP.isU21(p); }).length; }
    catch (e) { return 0; }
  }
  function nwSoll() {
    return Math.min(JW_SPIELER[tierKey()] || 6, Math.max(3, u21ImKader()));
  }
  // 20 statt 5 Startelf-Einsätze je Spieler. Mit fünf war die Vorgabe zu leicht:
  // sechs Talente, die je fünfmal auflaufen, sind 30 von 374 Startelf-Plätzen
  // einer Saison — das erfüllt man nebenbei. Zwanzig bedeuten 120 Plätze und
  // damit rund ein Drittel der Elf in jedem Spiel: eine echte Jugendmannschaft.
  const JW_EINSAETZE = 20;

  (function repariereJugendwahn() {
    const P = EXP.PHILOSOPHIES.jugendwahn;
    if (!P) return;
    P.computeGoals = function (prev) {
      const n = jwSollSpieler();
      const ziel = JW_SPIELER[tierKey()] || 6;
      const platz = Math.max(1, (prev && prev.pos ? prev.pos : 8) - 1);
      return { tablePosition: platz,
               minU21Spieler: n, minU21Einsaetze: JW_EINSAETZE,
               note: 'Tabellenplatz ≤ ' + platz + ' und mindestens ' + n +
                     ' verschiedene U21-Spieler mit je ' + JW_EINSAETZE + ' Startelf-Einsätzen' +
                     (n < ziel ? ' (Ausbau bis ' + ziel + ')' : '') + '.' };
    };
    P.matchTracking = function (ctx, t) {
      if (!t._u21) t._u21 = {};
      try {
        // Je Spiel EINMAL pro Spieler zählen. Steht jemand (durch einen Fehler
        // in der Aufstellung) auf zwei Positionen, käme er sonst auf 68 Einsätze
        // in einer 34-Spiele-Saison — gemessen genau so passiert.
        const gezaehlt = {};
        (ctx.lineupIds || []).map(getPlayer).filter(Boolean).forEach(function (p) {
          if (gezaehlt[p.id]) return;
          gezaehlt[p.id] = 1;
          if (EXP.isU21(p)) t._u21[p.id] = (t._u21[p.id] || 0) + 1;
        });
      } catch (e) {}
      if (ctx.u21InLineup) t.u21Starts++;
    };
    P.seasonReview = function (t, g) {
      const noetig = (g && g.minU21Spieler) || 6, minE = (g && g.minU21Einsaetze) || JW_EINSAETZE;
      const zaehler = t._u21 || {};
      const erfuellt = Object.keys(zaehler).filter(function (k) { return zaehler[k] >= minE; }).length;
      if (erfuellt < noetig) {
        return { board: -20, msg: 'Nur ' + erfuellt + ' von ' + noetig + ' geforderten U21-Spielern kamen auf ' +
                                  minE + ' Startelf-Einsätze. Die Jugend-Doktrin wurde verfehlt.' };
      }
      return { board: +8, msg: erfuellt + ' junge Spieler fest etabliert — vorbildliche Nachwuchsarbeit.' };
    };
  })();

  // „Urgestein" hieß `joinedSeason === 1` — nach ein paar Saisons gibt es keine
  // mehr und die Philosophie ist zahnlos. Jetzt: lange dabei ODER Eigengewächs.
  (function repariereTradition() {
    const P = EXP.PHILOSOPHIES.traditionsbewahrer;
    if (!P) return;
    const URGESTEIN_JAHRE = 4;
    function istUrgestein(p) {
      if (!p) return false;
      if (p.fromYouth) return true;
      const s = LEAGUE ? LEAGUE.season : 1;
      return (p.joinedSeason != null) && (s - p.joinedSeason) >= URGESTEIN_JAHRE;
    }
    P.checkTransfer = function (p, kind) {
      if (kind === 'sell' && istUrgestein(p)) {
        return { board: -12, ultras: -20,
                 msg: 'Verkauf von Urgestein ' + p.name + '! Die Ultras sind fassungslos.' };
      }
      return null;
    };
    P.seasonReview = function () {
      let n = 0;
      try { n = SQUAD.filter(function (p) { return !p.onLoanAt && istUrgestein(p); }).length; } catch (e) {}
      if (n === 0) return { board: -8, ultras: -10, msg: 'Kein einziges Urgestein mehr im Kader — die Vereinsseele ist verloren.' };
      return { board: +4, msg: n + ' Identifikationsfiguren im Kader — die Vereinsseele lebt.' };
    };
    P.urgestein = istUrgestein;
  })();

  // ═══════════════════════════════════════════════════════════════════════════
  // 4) VORSTANDSPROJEKTE
  // ═══════════════════════════════════════════════════════════════════════════
  // Jedes Projekt rechnet seinen Preis aus der aktuellen Lage. Bezug ist bewusst
  // der UMSATZ und nicht das Transferbudget: Letzteres wächst nach oben zu steil
  // (Bundesliga 40 Mio gegen 12 Mio Umsatzanteil).
  const PROJEKTE = {
    aufstiegspflicht: {
      label: 'Aufstiegspflicht',
      // Bezug ist der KONTOSTAND, nicht die Vorstandsplanung — sonst wird aus
      // „mal 1,8" je nach Zeitpunkt ein Faktor 3,6, weil beide Größen
      // auseinanderlaufen (Plan 495k gegen Konto 168k zu Saisonbeginn).
      text: function () { return 'Der Vorstand erhöht dein Transferbudget auf ' + euro((CLUB.budget || 0) * 1.8) +
        ' — dafür ist der Aufstieg Pflicht. Platz 4 wäre gerade noch verzeihlich, danach trennen wir uns.'; },
      gilt: function (L) { return L.tier !== 'bundesliga'; },
      annehmen: function () { CLUB.budget = Math.round((CLUB.budget || 0) * 1.8); },
      pruefe: function (platz) {
        if (platz <= 2) return { board: +25, msg: 'Aufstieg geschafft — der Vorstand ist begeistert.' };
        if (platz <= CFG.aufstiegspflichtNochOk) return { board: -20, msg: 'Aufstieg knapp verpasst (Platz ' + platz + '). Der Vorstand hält still — gerade noch.' };
        return { entlassung: true, msg: 'Aufstiegspflicht klar verfehlt (Platz ' + platz + ').' };
      }
    },
    stadionausbau: {
      label: 'Stadionausbau',
      text: function (L) {
        const jetzt = (CLUB.facilities && CLUB.facilities.stadium) || 1;
        const ziel = Math.min(10, stadionDeckel(), jetzt + 2);
        const stufen = ziel - jetzt;
        return 'Der Vorstand finanziert ' + (stufen >= 2 ? 'zwei Ausbaustufen' : 'eine Ausbaustufe') +
          ' des Stadions (Stufe ' + ziel + ', ' + deckelPlaetze(ziel) + '). Im Gegenzug musst du ' +
          euro(L.umsatz * 0.20) + ' aus Spielerverkäufen erlösen.';
      },
      gilt: function () { return (CLUB.facilities && (CLUB.facilities.stadium || 1) < stadionDeckel()); },
      annehmen: function (L) {
        // Nie über den Liga-Deckel hinaus — sonst schenkt das Projekt einem
        // Viertligisten zwei Stufen, die seine Liga gar nicht füllen kann.
        CLUB.facilities.stadium = Math.min(10, stadionDeckel(), (CLUB.facilities.stadium || 1) + 2);
        try { if (typeof stadiumCapacityForLevel === 'function') CLUB.stadiumCapacity = stadiumCapacityForLevel(CLUB.facilities.stadium); } catch (e) {}
      },
      soll: function (L) { return Math.round(L.umsatz * 0.20); },
      pruefeVerkauf: true
    },
    investor: {
      label: 'Investoreneinstieg',
      text: function (L) { return 'Ein Investor legt ' + euro(L.umsatz * 0.30) + ' auf den Tisch. Dafür bleibt der ' +
        'Gehaltsdeckel zwei Saisons eingefroren.'; },
      gilt: function () { return true; },
      annehmen: function (L) { CLUB.budget = Math.round(CLUB.budget + L.umsatz * 0.30); dna().deckelFrostBis = (LEAGUE.season || 1) + 2; }
    },
    sparkurs: {
      label: 'Sparkurs',
      text: function () { return 'Der Vorstand verlangt 20 % weniger Kadergehalt bis zur Winterpause. ' +
        'Gelingt es, steigt das Vertrauen deutlich.'; },
      gilt: function (L) { return wochenlohn() > L.deckel * 0.6; },
      annehmen: function (L) { dna().sparziel = Math.round(wochenlohn() * 0.80); },
      pruefeSparen: true
    },
    nachwuchsoffensive: {
      label: 'Nachwuchsoffensive',
      // Die Forderung richtet sich nach dem KADER, den du jetzt hast. Die zwei
      // neuen Akademiestufen bringen erst am Saisonende Talente — das volle Maß
      // von sechs Stammkräften wäre in derselben Saison unmöglich zu liefern.
      text: function () { return 'Der Vorstand baut die Jugendakademie um zwei Stufen aus. Dafür sollen ' +
        nwSoll() + ' verschiedene U21-Spieler auf je ' + JW_EINSAETZE + ' Startelf-Einsätze kommen.'; },
      gilt: function () { return (CLUB.facilities && (CLUB.facilities.youth || 1) < 9) && nwSoll() >= 3; },
      annehmen: function () {
        dna().nwSoll = nwSoll();                       // Forderung bei Annahme festschreiben
        CLUB.facilities.youth = Math.min(10, (CLUB.facilities.youth || 1) + 2);
      },
      pruefeU21: true
    }
  };

  function wuerfleProjekt() {
    const d = dna(), L = lage();
    d.projekt = null;
    const moeglich = Object.keys(PROJEKTE).filter(function (k) {
      try { return PROJEKTE[k].gilt(L); } catch (e) { return false; }
    });
    if (!moeglich.length || Math.random() > 0.55) { d.projektAngebot = null; return; }
    d.projektAngebot = moeglich[Math.floor(Math.random() * moeglich.length)];
    const p = PROJEKTE[d.projektAngebot];
    if (typeof addNews === 'function') {
      addNews('club', '🏛️ Vorstandsprojekt: ' + p.label, p.text(L) +
        '\n\nAnnehmen im Vereins-Tab. Ablehnen kostet etwas Vertrauen.');
    }
  }

  window.projektAnnehmen = function () {
    const d = dna();
    if (!d.projektAngebot) return;
    const p = PROJEKTE[d.projektAngebot], L = lage();
    try { p.annehmen(L); } catch (e) { console.warn('[VereinsDNA] annehmen', e); }
    d.projekt = { id: d.projektAngebot, soll: p.soll ? p.soll(L) : 0, erloes: 0, saison: LEAGUE.season };
    d.projektAngebot = null;
    if (typeof addNews === 'function') addNews('club', '✅ Projekt angenommen: ' + p.label, p.text(L));
    // renderAll() fasst den Verein-Tab nicht an — ohne diesen Aufruf blieb das
    // Angebot mit seinen Knöpfen nach dem Klick stehen.
    try { if (typeof renderAll === 'function') renderAll(); } catch (e) {}
    try { if (typeof renderClubTab === 'function') renderClubTab(); } catch (e) {}
    try { if (typeof renderHomeTab === 'function') renderHomeTab(); } catch (e) {}
    try { if (typeof saveGameState === 'function') saveGameState(); } catch (e) {}
  };
  window.projektAblehnen = function () {
    const d = dna();
    if (!d.projektAngebot) return;
    const p = PROJEKTE[d.projektAngebot];
    d.projektAngebot = null;
    const e = EXP.state();
    e.boardSatisfaction = Math.max(0, (e.boardSatisfaction || 60) - 5);
    if (typeof addNews === 'function') addNews('club', '❌ Projekt abgelehnt: ' + p.label, 'Der Vorstand nimmt es zur Kenntnis (−5 Vertrauen).');
    try { if (typeof renderAll === 'function') renderAll(); } catch (e2) {}
    try { if (typeof renderClubTab === 'function') renderClubTab(); } catch (e2) {}
    try { if (typeof renderHomeTab === 'function') renderHomeTab(); } catch (e2) {}
    try { if (typeof saveGameState === 'function') saveGameState(); } catch (e2) {}
  };

  // ── Ins Postfach einhängen ─────────────────────────────────────────────────
  // Ein offenes Vorstandsprojekt gehört zu den Entscheidungen, nicht in den
  // Nachrichtenstrom — es kommt deshalb als Eintrag mit Knöpfen ganz nach oben.
  if (typeof window.buildPostfachItems === 'function') {
    const _build = window.buildPostfachItems;
    window.buildPostfachItems = function () {
      const items = _build.apply(this, arguments) || [];
      try {
        const d = dna();
        if (d.projektAngebot && PROJEKTE[d.projektAngebot]) {
          const p = PROJEKTE[d.projektAngebot], L = lage();
          items.push({
            cat: 'offer', icon: '<i class="ti ti-building-bank"></i>',
            title: 'Vorstandsprojekt: ' + p.label, text: p.text(L),
            actions: '<button class="pf-btn ok" onclick="projektAnnehmen()">Annehmen</button>' +
                     '<button class="pf-btn no" onclick="projektAblehnen()">Ablehnen</button>',
            prio: 9
          });
        }
        // Laufendes Projekt als Fortschrittsanzeige
        if (d.projekt && PROJEKTE[d.projekt.id]) {
          const p = PROJEKTE[d.projekt.id];
          let stand = '';
          if (p.pruefeVerkauf) stand = 'Verkaufserlöse: ' + euro(d.projekt.erloes || 0) + ' von ' + euro(d.projekt.soll || 0);
          else if (p.pruefeSparen) stand = 'Gehalt aktuell ' + euro(wochenlohn()) + '/Wo, Ziel ' + euro(d.sparziel || 0) + '/Wo';
          else if (p.id === 'aufstiegspflicht' || d.projekt.id === 'aufstiegspflicht') stand = 'Aufstieg ist Pflicht — bis Platz 4 verzeiht der Vorstand.';
          else stand = 'Läuft bis Saisonende.';
          items.push({ cat: 'warn', icon: '<i class="ti ti-building-bank"></i>',
                       title: 'Laufendes Projekt: ' + p.label, text: stand, prio: 7 });
        }
      } catch (err) {}
      return items;
    };
    try { buildPostfachItems = window.buildPostfachItems; } catch (e) {}
  }

  // Verkaufserlöse für das Stadionprojekt mitschreiben
  if (typeof window.acceptTransferBid === 'function') {
    const _acc = window.acceptTransferBid;
    window.acceptTransferBid = function () {
      const r = _acc.apply(this, arguments);
      try {
        const d = dna();
        if (r && d.projekt && PROJEKTE[d.projekt.id] && PROJEKTE[d.projekt.id].pruefeVerkauf) {
          d.projekt.erloes += (r.amount || 0);
        }
      } catch (e) {}
      return r;
    };
    try { acceptTransferBid = window.acceptTransferBid; } catch (e) {}
  }

  // ── Projekt abrechnen (am Saisonende, VOR dem Zurücksetzen) ────────────────
  function rechneProjektAb() {
    const d = dna();
    if (!d.projekt) return null;
    const p = PROJEKTE[d.projekt.id];
    if (!p) { d.projekt = null; return null; }
    const e = EXP.state();
    let res = null;

    if (p.pruefe) {
      // Aufstiegspflicht: Platzierung entscheidet
      let platz = 99;
      try {
        const grp = findFcmGroup(LEAGUE).group;
        const tbl = (typeof computeTable === 'function') ? computeTable(grp.teams) : grp.teams;
        platz = tbl.findIndex(function (t) { return t.id === 'fcm'; }) + 1 || 99;
      } catch (err) {}
      res = p.pruefe(platz);
    } else if (p.pruefeVerkauf) {
      const soll = d.projekt.soll || 0, ist = d.projekt.erloes || 0;
      res = ist >= soll
        ? { board: +15, msg: 'Stadionausbau gegenfinanziert: ' + euro(ist) + ' aus Verkäufen erlöst.' }
        : { board: -22, msg: 'Nur ' + euro(ist) + ' von ' + euro(soll) + ' aus Verkäufen erlöst — der Ausbau reißt ein Loch in die Kasse.' };
    } else if (p.pruefeSparen) {
      const ziel = d.sparziel || 0, ist = wochenlohn();
      res = (ziel && ist <= ziel)
        ? { board: +30, msg: 'Sparkurs eingehalten (' + euro(ist) + '/Wo). Der Vorstand ist beeindruckt.' }
        : { board: -15, msg: 'Sparkurs verfehlt: ' + euro(ist) + '/Wo statt ' + euro(ziel) + '/Wo.' };
      d.sparziel = null;
    } else if (p.pruefeU21) {
      const t = e.tracking || {}, zaehler = t._u21 || {};
      // Bei ANNAHME festgeschriebene Forderung, nicht neu berechnen — sonst
      // ändert sie sich, während man sie zu erfüllen versucht.
      const noetig = d.nwSoll || nwSoll();
      const erfuellt = Object.keys(zaehler).filter(function (k) { return zaehler[k] >= JW_EINSAETZE; }).length;
      res = erfuellt >= noetig
        ? { board: +18, msg: 'Nachwuchsoffensive erfüllt: ' + erfuellt + ' junge Spieler etabliert.' }
        : { board: -18, msg: 'Nachwuchsoffensive verfehlt: nur ' + erfuellt + ' von ' + noetig + ' U21-Spielern mit ' + JW_EINSAETZE + ' Einsätzen.' };
    } else {
      // Investor: keine sportliche Gegenleistung, der Deckel bleibt einfach eingefroren
      res = { board: 0, msg: null };
    }

    if (res) {
      if (res.entlassung) {
        if (typeof addNews === 'function') addNews('club', '🚪 Vorstandsprojekt gescheitert', res.msg + ' Der Verein trennt sich von dir.');
        try { EXP._gameOver(); } catch (err) {}
      } else {
        if (res.board) e.boardSatisfaction = Math.max(0, Math.min(100, (e.boardSatisfaction || 60) + res.board));
        if (res.msg && typeof addNews === 'function') {
          addNews('club', (res.board >= 0 ? '✅ ' : '⚠️ ') + 'Projekt abgerechnet: ' + p.label, res.msg);
        }
      }
    }
    d.projekt = null;
    return res;
  }

  // Vorzeitige Entlassung bei Aufstiegspflicht: sobald der Aufstieg rechnerisch
  // praktisch weg ist, wartet der Vorstand nicht bis zum Saisonende.
  const _weekTick = EXP.hookWeekTick;
  EXP.hookWeekTick = function () {
    try {
      const d = dna();
      if (d.projekt && d.projekt.id === 'aufstiegspflicht' && LEAGUE) {
        const grp = findFcmGroup(LEAGUE).group;
        const tbl = (typeof computeTable === 'function') ? computeTable(grp.teams) : null;
        if (tbl && tbl.length) {
          const meIdx = tbl.findIndex(function (t) { return t.id === 'fcm'; });
          const me = tbl[meIdx], zweiter = tbl[1];
          if (me && zweiter && me.played >= 12) {
            const spieltage = (grp.teams.length - 1) * 2;
            const offen = Math.max(0, spieltage - (me.played || 0));
            const rueckstand = (zweiter.pts || 0) - (me.pts || 0);
            // Aussichtslos: selbst mit allen Restsiegen reicht es nicht mehr
            if (meIdx > 1 && rueckstand > offen * 3) {
              if (typeof addNews === 'function') {
                addNews('club', '🚪 Aufstiegspflicht aussichtslos',
                  'Der Rückstand auf Platz 2 beträgt ' + rueckstand + ' Punkte bei nur noch ' + offen +
                  ' Spielen. Der Aufstieg ist rechnerisch nicht mehr zu schaffen — der Vorstand zieht die Reißleine.');
              }
              d.projekt = null;
              EXP._gameOver();
              return;
            }
          }
        }
      }
    } catch (err) {}
    return _weekTick.apply(this, arguments);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 5) ABRECHNUNG DES DREIER-PAKETS
  // ═══════════════════════════════════════════════════════════════════════════
  // Gemessen: `settlePreviousSeason` bewertet Tabellenplatz, Tore, Gegentore,
  // Kader-OVR und Verjüngung — die drei Vorgaben aus diesem Modul (Rücklage,
  // Lohnquote, Ausbaustufe) aber NICHT. Gegenprobe: alle drei krachend verfehlt
  // (Konto 0 statt 232k, Lohn 58k statt 24k/Wo, Akademie Stufe 1 statt 2) und
  // das Vorstandsvertrauen blieb exakt auf 60. Der Vorstand forderte etwas, das
  // folgenlos blieb.
  const ZIEL_PUNKTE = {
    ruecklage: { erfuellt: +6, knapp: -4, klar: -10, minus: -16, knappAb: 0.70 },
    lohn:      { erfuellt: +4, knapp: -5, klar: -12, knappBis: 1.10 },
    // „Bau läuft" ist bewusst NEUTRAL: `facilityBuildWeeks` deckelt erst bei 46
    // Wochen. Wer spät in der Saison anfängt, KANN nicht fertig werden — dafür
    // Vertrauen abzuziehen wäre eine Strafe für die Bauzeit, nicht für Versagen.
    ausbau:    { erfuellt: +8, imBau: 0, garNicht: -10 }
  };
  const PAKET_DECKEL = -20;   // Summe der drei Ziele kostet nie mehr als das …
  const PAKET_BONUS  = +5;    // … und alle drei erfüllt gibt es obendrauf.
  // Deckel AUCH nach oben, sonst kauft man sich vom sportlichen Misserfolg frei:
  // gemessen ergab das volle Paket +23 (6+4+8+5) und damit MEHR als die härteste
  // sportliche Strafe (−20). Ein Verein wurde 16. bei Zielplatz 7 und das
  // Vertrauen STIEG von 60 auf 64; in einer anderen Saison Platz 10 statt 6 und
  // es stieg von 78 auf 95. Mit +10 bleibt solide Vereinsführung wertvoll (mehr
  // als die +8 fürs erreichte Tabellenziel), federt eine schlechte Saison aber
  // nur ab, statt sie umzukehren. Fußball bleibt ein Ergebnissport.
  const PAKET_DECKEL_OBEN = +10;

  function vertrauenAendern(punkte) {
    const e = EXP.state();
    if (!e || !punkte) return;
    e.boardSatisfaction = Math.max(0, Math.min(100, e.boardSatisfaction + punkte));
  }

  function bewerteDreierPaket() {
    const e = EXP.state();
    if (!e || !e.philosophyId || !e.seasonGoals) return null;
    const g = e.seasonGoals;
    let summe = 0, alleErfuellt = true, hatZiel = false;
    const zeilen = [];

    // — Rücklage —
    if (g.minRuecklage != null) {
      hatZiel = true;
      const ist = CLUB.budget || 0, soll = g.minRuecklage, K = ZIEL_PUNKTE.ruecklage;
      let p, txt;
      if (ist >= soll) { p = K.erfuellt; txt = 'Rücklage ' + euro(ist) + ' — Ziel erreicht'; }
      else if (ist < 0) { p = K.minus; alleErfuellt = false; txt = 'Konto im Minus (' + euro(ist) + ')'; }
      else if (ist >= soll * K.knappAb) { p = K.knapp; alleErfuellt = false;
        txt = 'Rücklage ' + euro(ist) + ' statt ' + euro(soll) + ' — knapp verfehlt'; }
      else { p = K.klar; alleErfuellt = false;
        txt = 'Rücklage nur ' + euro(ist) + ' statt ' + euro(soll); }
      summe += p; zeilen.push((p >= 0 ? '✅ ' : '❌ ') + txt + ' (' + (p > 0 ? '+' : '') + p + ')');
    }

    // — Lohnquote —
    if (g.maxLohnWoche != null) {
      hatZiel = true;
      const ist = wochenlohn(), soll = g.maxLohnWoche, K = ZIEL_PUNKTE.lohn;
      let p, txt;
      if (ist <= soll) { p = K.erfuellt; txt = 'Gehälter ' + euro(ist) + '/Wo — im Rahmen'; }
      else if (ist <= soll * K.knappBis) { p = K.knapp; alleErfuellt = false;
        txt = 'Gehälter ' + euro(ist) + '/Wo statt ' + euro(soll) + ' — leicht drüber'; }
      else { p = K.klar; alleErfuellt = false;
        txt = 'Gehälter ' + euro(ist) + '/Wo weit über der Grenze von ' + euro(soll); }
      summe += p; zeilen.push((p >= 0 ? '✅ ' : '❌ ') + txt + ' (' + (p > 0 ? '+' : '') + p + ')');
    }

    // — Ausbaustufe —
    if (g.ausbau) {
      hatZiel = true;
      const key = g.ausbau.key, jetzt = (CLUB.facilities && CLUB.facilities[key]) || 1;
      const imBau = !!(CLUB.facilityBuilds && CLUB.facilityBuilds[key]);
      const K = ZIEL_PUNKTE.ausbau;
      let p, txt;
      if (jetzt >= g.ausbau.ziel) { p = K.erfuellt; txt = g.ausbau.label + ' auf Stufe ' + jetzt + ' — erledigt'; }
      else if (imBau) { p = K.imBau; alleErfuellt = false;
        txt = g.ausbau.label + ': Bau läuft noch (' + CLUB.facilityBuilds[key].weeksLeft + ' Wo) — der Vorstand wartet ab'; }
      else { p = K.garNicht; alleErfuellt = false;
        txt = g.ausbau.label + ' nicht ausgebaut (Stufe ' + jetzt + ' statt ' + g.ausbau.ziel + ')'; }
      summe += p; zeilen.push((p > 0 ? '✅ ' : p === 0 ? '⏳ ' : '❌ ') + txt + ' (' + (p > 0 ? '+' : '') + p + ')');
    }

    if (!hatZiel) return null;

    // Deckel NUR nach unten: schlechte Buchführung allein soll keine Karriere
    // beenden. Bei −20 plus verfehltem Tabellenziel (−20) sind 40 Punkte weg —
    // eine Saison tut weh, zwei kosten den Job.
    if (alleErfuellt) { summe += PAKET_BONUS; zeilen.push('🏅 Alle Vorgaben erfüllt (+' + PAKET_BONUS + ')'); }
    let gedeckelt = null;
    if (summe < PAKET_DECKEL) { summe = PAKET_DECKEL; gedeckelt = 'unten'; }
    else if (summe > PAKET_DECKEL_OBEN) { summe = PAKET_DECKEL_OBEN; gedeckelt = 'oben'; }

    vertrauenAendern(summe);
    if (typeof addNews === 'function') {
      const hinweis = gedeckelt === 'unten' ? ' (nach unten auf ' + PAKET_DECKEL + ' begrenzt).'
                    : gedeckelt === 'oben'  ? ' (nach oben auf +' + PAKET_DECKEL_OBEN + ' begrenzt — ' +
                                              'die sportliche Bilanz bleibt der Hauptmaßstab).'
                    : '.';
      addNews('club', '📋 Vorstands-Vorgaben abgerechnet',
        zeilen.join('\n') + '\n\nVertrauen ' + (summe >= 0 ? '+' : '') + summe + ' Punkte' + hinweis);
    }
    return { summe: summe, zeilen: zeilen, alleErfuellt: alleErfuellt, gedeckelt: gedeckelt };
  }

  // Abrechnung an den Saisonwechsel hängen — VOR hookSeasonStart, weil das
  // Tracking dort zurückgesetzt wird und `seasonGoals` auf null geht.
  // ── U21-Zählung für ALLE Philosophien ──────────────────────────────────────
  // `matchTracking` ist eine Methode der Philosophie und läuft deshalb nur bei
  // Jugendwahn und Cantera. Das Vorstandsprojekt „Nachwuchsoffensive" liest aber
  // dieselbe Zählung (`tracking._u21`) und lässt sich mit JEDER Philosophie
  // annehmen — gemessen mit Sparfuchs: Albers (19) stand die ganze Saison in der
  // Startelf, `u21Starts` blieb bei 0 und `_u21` wurde nie angelegt. Das Projekt
  // wäre damit garantiert verfehlt gewesen (−18 Vertrauen), egal wie viele
  // Talente man aufstellt. Derselbe Fehlertyp wie ein Ausbauziel über dem
  // Liga-Deckel: eine Vorgabe, die man nicht erfüllen KANN.
  if (typeof EXP.hookMatchResult === 'function') {
    const _hmr = EXP.hookMatchResult;
    EXP.hookMatchResult = function (ctx) {
      const r = _hmr.apply(this, arguments);
      try {
        const phil = (typeof EXP.philosophy === 'function') ? EXP.philosophy() : null;
        // Zählt die Philosophie schon selbst, nicht doppelt zählen.
        if (phil && typeof phil.matchTracking === 'function') return r;
        const t = (EXP.state() || {}).tracking;
        if (!t) return r;
        if (!t._u21) t._u21 = {};
        const gezaehlt = {};
        (ctx && ctx.lineupIds ? ctx.lineupIds : []).map(getPlayer).filter(Boolean).forEach(function (p) {
          if (gezaehlt[p.id]) return;          // ein Spieler zählt je Spiel einmal
          gezaehlt[p.id] = 1;
          if (EXP.isU21(p)) t._u21[p.id] = (t._u21[p.id] || 0) + 1;
        });
        if (ctx && ctx.u21InLineup) t.u21Starts = (t.u21Starts || 0) + 1;
      } catch (e) { console.warn('[VereinsDNA] U21-Zählung', e); }
      return r;
    };
  }

  const _hss2 = EXP.hookSeasonStart;
  EXP.hookSeasonStart = function () {
    try { bewerteDreierPaket(); } catch (err) { console.warn('[VereinsDNA] Zielabrechnung', err); }
    try { rechneProjektAb(); } catch (err) { console.warn('[VereinsDNA] Projektabrechnung', err); }
    return _hss2.apply(this, arguments);
  };

  // ── FCM-Tabelleneintrag aus dem echten Kader nachführen ────────────────────
  // `developAllNpcs` überspringt den eigenen Verein mit dem Kommentar „wird
  // separat behandelt" — nur passierte das nirgends. Der Stärkewert blieb über
  // zehn Saisons auf dem Startwert stehen (gemessen 56, während die Startelf bei
  // 59,5 lag). Im Vereinsprofil steht damit dauerhaft eine falsche Zahl, und
  // andere Vereine haben keinen Anhaltspunkt, wie stark man geworden ist.
  function fuehreEigenenWertNach() {
    try {
      const grp = findFcmGroup(LEAGUE).group;
      const me = grp.teams.find(function (t) { return t.id === 'fcm'; });
      if (!me) return;
      const H = (window.EngineV2Adapter && EngineV2Adapter.buildOwnTeam) ? EngineV2Adapter.buildOwnTeam() : null;
      let ovr = null;
      if (H && H.players.length >= 7) {
        ovr = Math.round(H.players.reduce(function (s, p) { return s + (p.ovr || 0); }, 0) / H.players.length);
      } else if (typeof SQUAD !== 'undefined' && SQUAD.length) {
        const akt = SQUAD.filter(function (p) { return !p.onLoanAt; })
                         .sort(function (a, b) { return (b.ovr || 0) - (a.ovr || 0); }).slice(0, 11);
        if (akt.length) ovr = Math.round(akt.reduce(function (s, p) { return s + (p.ovr || 0); }, 0) / akt.length);
      }
      if (ovr == null || !isFinite(ovr)) return;
      me.ovr = ovr; me.str = ovr;
      // Mannschaftsteile mitziehen, damit `ratingsOf` stimmige Werte bekommt
      if (typeof computeTeamRatings === 'function') {
        const r = computeTeamRatings();
        if (r) { me.def = r.defense || ovr; me.mid = r.overall || ovr; me.att = r.attack || ovr; }
      } else { me.def = ovr; me.mid = ovr; me.att = ovr; }
    } catch (e) { /* stiller Ersatz: Wert bleibt wie er ist */ }
  }
  const _hss3 = EXP.hookSeasonStart;
  EXP.hookSeasonStart = function () {
    const r = _hss3.apply(this, arguments);
    try { fuehreEigenenWertNach(); } catch (e) {}
    return r;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 4b) SPONSORENKLAUSELN ZUR PHILOSOPHIE
  // ═══════════════════════════════════════════════════════════════════════════
  // Bisher wurden drei Klauseln blind gewürfelt — und die konnten der Philosophie
  // direkt widersprechen: Jugendwahn verlangt U21 in der Elf, der Social-Media-
  // Konzern zahlt nur, wenn der Star spielt. Jetzt bietet der Vorstand eine
  // PASSENDE Klausel, eine neutrale und eine gegensätzliche an. Die gegensätzliche
  // zahlt mehr Fixgeld — wer sie nimmt, zieht bewusst in zwei Richtungen.
  const KLAUSEL_PASST = {
    jugendwahn:         { passt: 'nachwuchsfoerderer', gegen: 'socialmedia' },
    cantera:            { passt: 'mobilitaet',         gegen: 'wettanbieter' },
    kaufrausch:         { passt: 'socialmedia',        gegen: 'nachwuchsfoerderer' },
    sparfuchs:          { passt: 'versicherung',       gegen: 'wettanbieter' },
    traditionsbewahrer: { passt: 'brauerei',           gegen: 'socialmedia' },
    minimalisten:       { passt: 'versicherung',       gegen: 'brauerei' }
  };
  function klauselAngebote(philId) {
    const alle = Object.keys(EXP.SPONSOR_CLAUSES);
    const m = KLAUSEL_PASST[philId];
    if (!m) return alle.slice().sort(function () { return Math.random() - 0.5; }).slice(0, 3);
    const rest = alle.filter(function (k) { return k !== m.passt && k !== m.gegen; });
    const neutral = rest[Math.floor(Math.random() * rest.length)];
    return [m.passt, neutral, m.gegen].filter(Boolean);
  }
  window.klauselAngebote = klauselAngebote;

  const _hss4 = EXP.hookSeasonStart;
  EXP.hookSeasonStart = function () {
    const r = _hss4.apply(this, arguments);
    try {
      const e = EXP.state();
      // Die Philosophie steht an dieser Stelle bereits (siehe Abschnitt 1),
      // wenn der Kurs gehalten wurde — dann passend anbieten.
      if (e.philosophyId && Array.isArray(e.pendingSponsorOffers)) {
        e.pendingSponsorOffers = klauselAngebote(e.philosophyId);
      }
    } catch (err) { console.warn('[VereinsDNA] Klauselangebote', err); }
    return r;
  };
  // Auch bei der Philosophie-Wahl selbst nachziehen: wer den Kurs wechselt,
  // soll sofort die dazu passenden Klauseln sehen.
  const _choose2 = EXP.choosePhilosophy;
  EXP.choosePhilosophy = function (id) {
    const r = _choose2.apply(this, arguments);
    try {
      const e = EXP.state();
      if (!e.sponsorClauseId && Array.isArray(e.pendingSponsorOffers)) {
        e.pendingSponsorOffers = klauselAngebote(id);
      }
    } catch (err) {}
    return r;
  };

  // Die Klausel wird NACH der Budgetberechnung gewählt — `hookSeasonStart` leert
  // sie und bietet neue an, `computeSeasonBudget` läuft davor. Ohne diesen Nachzug
  // stand die Klausel mit 0 in der Planung, obwohl sie aktiv war (gemessen: in
  // 5 von 10 Saisons fehlten so 272.000 €). Statt das ganze Budget neu zu rechnen
  // — das würde den Kontostand überschreiben — wird der Betrag gezielt ergänzt.
  const _chooseSp = EXP.chooseSponsor;
  EXP.chooseSponsor = function (id) {
    const vorher = EXP.state().sponsorClauseId;
    const r = _chooseSp.apply(this, arguments);
    try {
      const e = EXP.state();
      if (!vorher && e.sponsorClauseId && CLUB._budgetBreakdown && !CLUB._budgetBreakdown.income.klausel) {
        const c = EXP.SPONSOR_CLAUSES[e.sponsorClauseId];
        const fak = { bundesliga: 40, bundesliga2: 12, liga3: 3, regionalliga: 1 }[tierKey()] || 1;
        const eF = (typeof window.europaFaktor === 'function') ? window.europaFaktor() : 1;
        const summe = Math.round((c.base || 0) * fak * 34 * eF);
        if (summe > 0) {
          CLUB._budgetBreakdown.income.klausel = summe;
          CLUB._budgetBreakdown.income.total += summe;
          CLUB._budgetBreakdown.fixBalance += summe;
          CLUB._budgetBreakdown.transfer += summe;
          CLUB.budget += summe;
          if (typeof addNews === 'function') {
            addNews('club', '💼 Sponsorklausel im Budget', c.label + ': ' + euro(summe) +
              ' Grundzahlung für die Saison sind eingeplant. Boni kommen während der Saison obendrauf.');
          }
        }
      }
    } catch (err) { console.warn('[VereinsDNA] Klausel-Budget', err); }
    return r;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 5) ANZEIGE IM VEREINS-TAB
  // ═══════════════════════════════════════════════════════════════════════════
  // Das bestehende Erwartungs-Panel zeigt Philosophie und Tabellenziel, kennt
  // aber weder das neue Dreier-Paket noch die Rampe noch die Projekte. Statt es
  // zu ersetzen, hängen wir einen eigenen Abschnitt an.
  function balken(ist, soll, umgekehrt) {
    const q = soll > 0 ? Math.max(0, Math.min(1, ist / soll)) : 0;
    const gut = umgekehrt ? (ist <= soll) : (ist >= soll);
    const farbe = gut ? 'var(--accent,#3fb950)' : (q >= 0.6 ? 'var(--gold,#f2c14e)' : 'var(--red,#da3633)');
    return '<div style="height:5px;border-radius:3px;background:var(--bg3,#21262d);overflow:hidden;margin-top:3px">' +
           '<div style="height:100%;width:' + Math.round(q * 100) + '%;background:' + farbe + '"></div></div>';
  }
  function zeile(titel, istText, sollText, ist, soll, umgekehrt) {
    const gut = umgekehrt ? (ist <= soll) : (ist >= soll);
    return '<div style="margin-bottom:9px">' +
      '<div style="display:flex;justify-content:space-between;font-size:11px">' +
        '<span style="color:var(--text2,#8b949e)">' + (gut ? '✓ ' : '') + titel + '</span>' +
        '<span style="color:var(--text,#e6edf3);font-variant-numeric:tabular-nums">' + istText +
        ' <span style="color:var(--text3,#6e7681)">/ ' + sollText + '</span></span>' +
      '</div>' + balken(ist, soll, umgekehrt) + '</div>';
  }

  function dnaAbschnitt() {
    const e = EXP.state(), g = e.seasonGoals, d = dna();
    if (!e.philosophyId || !g) return '';
    const phil = EXP.PHILOSOPHIES[e.philosophyId];
    const teile = [];

    // — Wirtschaftliche und strukturelle Ziele mit Fortschritt —
    if (g.minRuecklage != null) {
      teile.push(zeile('Rücklage am Saisonende', euro(CLUB.budget || 0), euro(g.minRuecklage),
                       CLUB.budget || 0, g.minRuecklage, false));
    }
    if (g.maxLohnWoche != null) {
      const lohn = wochenlohn();
      teile.push(zeile('Wochengehälter (Obergrenze)', euro(lohn), euro(g.maxLohnWoche), lohn, g.maxLohnWoche, true));
    }
    if (g.ausbau) {
      const jetzt = (CLUB.facilities && CLUB.facilities[g.ausbau.key]) || 1;
      teile.push(zeile(g.ausbau.label + ' ausbauen', 'Stufe ' + jetzt, 'Stufe ' + g.ausbau.ziel,
                       jetzt, g.ausbau.ziel, false));
    }
    // — U21-Rampe des Jugendwahns —
    if (g.minU21Spieler != null) {
      const z = (e.tracking && e.tracking._u21) || {};
      const erfuellt = Object.keys(z).filter(function (k) { return z[k] >= g.minU21Einsaetze; }).length;
      teile.push(zeile('U21 mit je ' + g.minU21Einsaetze + ' Einsätzen', erfuellt + ' Spieler',
                       g.minU21Spieler + ' Spieler', erfuellt, g.minU21Spieler, false));
    }

    // — Wie lange gilt der Kurs noch? —
    const seit = d.seitSaison || 1;
    const jahre = (LEAGUE ? LEAGUE.season : 1) - seit;
    const wechselText = 'Kurs seit ' + (jahre <= 0 ? 'dieser Saison' : jahre + ' Saison' + (jahre === 1 ? '' : 'en')) +
      '. Neu ausgerichtet wird nach zwei Aufstiegen (aktuell ' + (d.aufstiege || 0) + '/' +
      CFG.wechselNachAufstiegen + '), nach einem Abstieg, oder wenn das Vertrauen unter ' +
      CFG.wechselUnterVertrauen + ' % fällt.';

    // — Laufendes oder angebotenes Projekt —
    let projekt = '';
    if (d.projekt && PROJEKTE[d.projekt.id]) {
      const p = PROJEKTE[d.projekt.id];
      let stand = 'Läuft bis Saisonende.';
      if (p.pruefeVerkauf) stand = zeile('Verkaufserlöse', euro(d.projekt.erloes || 0), euro(d.projekt.soll || 0),
                                         d.projekt.erloes || 0, d.projekt.soll || 0, false);
      else if (p.pruefeSparen) stand = zeile('Wochengehälter senken', euro(wochenlohn()), euro(d.sparziel || 0),
                                             wochenlohn(), d.sparziel || 0, true);
      else if (d.projekt.id === 'aufstiegspflicht') stand = '<div style="font-size:11px;color:var(--gold,#f2c14e)">Aufstieg ist Pflicht — bis Platz ' +
        CFG.aufstiegspflichtNochOk + ' verzeiht der Vorstand, danach folgt die Trennung.</div>';
      projekt = '<div style="margin-top:12px;padding:10px;border-radius:8px;background:var(--bg3,#21262d)">' +
        '<div style="font-size:11px;font-weight:700;color:var(--gold,#f2c14e);margin-bottom:6px">🏛️ Laufendes Projekt: ' +
        p.label + '</div>' + stand + '</div>';
    } else if (d.projektAngebot && PROJEKTE[d.projektAngebot]) {
      const p = PROJEKTE[d.projektAngebot];
      projekt = '<div style="margin-top:12px;padding:10px;border-radius:8px;background:var(--bg3,#21262d)">' +
        '<div style="font-size:11px;font-weight:700;color:var(--accent,#3fb950);margin-bottom:4px">🏛️ Angebot: ' + p.label + '</div>' +
        '<div style="font-size:11px;color:var(--text2,#8b949e);margin-bottom:8px">' + p.text(lage()) + '</div>' +
        '<button class="fc-upgrade" onclick="projektAnnehmen()">Annehmen</button> ' +
        '<button class="fc-upgrade" style="background:var(--bg2,#161b22)" onclick="projektAblehnen()">Ablehnen</button></div>';
    }

    return '<div class="exp-section">' +
      '<div class="exp-section-title"><i class="ti ti-target"></i> Vorstands-Vorgaben</div>' +
      (teile.length ? teile.join('') : '<div style="font-size:11px;color:var(--text2)">Für diese Saison stehen keine Zusatzziele an.</div>') +
      '<div style="margin-top:8px;font-size:10px;color:var(--text3,#6e7681);line-height:1.5">' + wechselText + '</div>' +
      projekt + '</div>';
  }

  if (typeof window.renderExpectationsPanel === 'function') {
    const _rep = window.renderExpectationsPanel;
    window.renderExpectationsPanel = function () {
      const r = _rep.apply(this, arguments);
      try {
        const el = document.getElementById('exp-panel');
        const html = dnaAbschnitt();
        if (el && html) {
          // Direkt hinter die Philosophie, nicht ans Ende: die Vorgaben gehören
          // zum Kurs, nicht hinter den Sponsor.
          const secs = el.querySelectorAll('.exp-section');
          const philSec = secs.length > 1 ? secs[1] : null;
          if (philSec) philSec.insertAdjacentHTML('afterend', html);
          else el.insertAdjacentHTML('beforeend', html);
        }
      } catch (e) { console.warn('[VereinsDNA] Panel', e); }
      return r;
    };
    try { renderExpectationsPanel = window.renderExpectationsPanel; } catch (e) {}
  }

  // ── Manueller Stadionausbau ebenfalls am Liga-Deckel ───────────────────────
  // Ohne diesen Wrapper wäre der Deckel wirkungslos: ein Viertligist mit vollem
  // Konto (gemessen: 15,3 Mio nach acht Saisons) kauft sich die Stufen sonst
  // einfach über den Vereins-Tab. Die anderen Anlagen bleiben unberührt —
  // Akademie, Training und Scouting kann jede Liga sinnvoll ausbauen.
  if (typeof window.upgradeFacility === 'function') {
    const _up = window.upgradeFacility;
    window.upgradeFacility = function (key) {
      if (key === 'stadium') {
        const jetzt = (CLUB.facilities && CLUB.facilities.stadium) || 1;
        if (jetzt >= stadionDeckel()) {
          const txt = 'Der Ausbau ist gestoppt: ' + (CLUB.leagueName || 'diese Liga') +
            ' trägt kein größeres Stadion als Stufe ' + stadionDeckel() +
            ' (' + deckelPlaetze(stadionDeckel()) + ').\n\n' +
            'Mit dem nächsten Aufstieg gibt der Vorstand den Ausbau wieder frei.';
          if (typeof alert === 'function') alert(txt);
          try { addNews('club', '🏟️ Ausbau abgelehnt', txt); } catch (e) {}
          return;
        }
      }
      return _up.apply(this, arguments);
    };
    try { upgradeFacility = window.upgradeFacility; } catch (e) {}
  }

  // Der Spieler soll den Deckel SEHEN, bevor er auf den Knopf drückt — nicht
  // erst im Fehlerdialog danach.
  if (typeof window.facilityRoi === 'function') {
    const _roi = window.facilityRoi;
    window.facilityRoi = function (key, cur, def) {
      try {
        // Am Deckel den Grenzhinweis STATT der Ausbau-Werbung: beides zusammen
        // („+5.000 Plätze" und „geht nicht") widerspricht sich.
        if (key === 'stadium' && (cur || 1) >= stadionDeckel()) {
          return '<div class="fc-roi"><span class="fc-roi-ico">🏟️</span>Höchststufe der Liga: Stufe ' + stadionDeckel() +
                 ' · ' + deckelPlaetze(stadionDeckel()) + '</div>';
        }
      } catch (e) {}
      return _roi.apply(this, arguments) || '';
    };
    try { facilityRoi = window.facilityRoi; } catch (e) {}
  }

  window.VereinsDNA = { CFG, PROJEKTE, lage, dna, wuerfleProjekt, rechneProjektAb,
                        fuehreEigenenWertNach, dnaAbschnitt,
                        STADION_DECKEL, stadionDeckel,
                        ZIEL_PUNKTE, PAKET_DECKEL, PAKET_DECKEL_OBEN, PAKET_BONUS,
                        bewerteDreierPaket };
  console.log('[VereinsDNA v1] aktiv — Philosophie bleibt, Ziele skalieren mit Liga und Budget');
})();
