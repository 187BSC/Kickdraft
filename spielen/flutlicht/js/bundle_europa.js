/* ===== BUNDLE: bundles/bundle_europa.js ===== */
/* Enthält (in dieser Reihenfolge): npc_development_patch.js euro_competitions_patch.js euro_ui_patch.js euro_integration_patch.js euro_matchday_patch.js league_browser_patch.js */

/* ---------- js/npc_development_patch.js ---------- */
/* ===== npc_development_patch.js ===== */
/* ═══════════════════════════════════════════════════════════════════════════
   NPC-VEREINS-ENTWICKLUNG  ·  v1
   ───────────────────────────────────────────────────────────────────────────
   Andere Vereine entwickeln sich jetzt über die Saisons — MIT Alterung:
   - Jeder NPC-Verein hat ein simuliertes Kader-Durchschnittsalter (npcAge),
     das pro Saison um 1 steigt und beim Über-/Unterschreiten von Schwellen
     die Stärke driften lässt:
       · junges Team (Ø < 24,5): wächst tendenziell (Talente reifen)
       · Prime (24,5–28,5):       stabil, kleine Schwankungen
       · alterndes Team (> 28,5): baut tendenziell ab
   - Zusätzlich etwas Zufall (Transfers, Form), damit die Liga lebendig bleibt.
   - Vereine "verjüngen" sich gelegentlich (simulierter Kaderumbruch), damit
     kein Team dauerhaft vergreist.
   - Werte bleiben in plausiblen Grenzen je Spielniveau.

   Hängt sich an runEndOfSeason an (läuft beim Saisonwechsel, nach Auf/Abstieg).
   Lädt nach engine_main.js und app_main.js.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const CFG = {
    // Altersdrift PROPORTIONAL statt in drei Stufen. Früher: unter 24,5 wachsen
    // (Zufall 0…+3, im Mittel IMMER +1,5), über 28,5 abbauen, dazwischen ±0,75.
    // Diese Bänder lagen nicht symmetrisch zum Gleichgewichtsalter der Kader —
    // je nachdem, wo die Kader tatsächlich liegen, kippt die Bilanz in eine
    // Richtung und die ganze Fußballwelt driftet mit. Gemessen: mit der alten,
    // kaputten Alterung stauten sich alle Teams über 28,5 und die unteren Ligen
    // sackten weg (3. Liga −3,3 OVR in 7 Saisons); nach der Alterungskorrektur
    // lagen sie unter 24,5 und alles inflationierte (Regionalliga +8,2 in 25).
    // Proportional ist die Drift von selbst im Mittel null, solange die
    // Altersverteilung stabil ist — und das ist sie jetzt.
    altersMitte:  25.5,   // Alter ohne Drift
    driftProJahr: 0.85,   // OVR-Änderung je Jahr Abstand zur Mitte
    noise:        1.2,    // zufällige Schwankung (±)
    // Kaderverjüngung. Die Kader altern jede Saison um +1, im Mittel muss die
    // Verjüngung genauso viel wegnehmen — bei rejuvDrop [2,4] (Mittel 3) wäre
    // das eine Chance von 1/3. Eine FESTE Chance reicht aber nicht: der Boden
    // `Math.max(22, …)` frisst bei jungen Teams einen Teil des Abzugs, und ein
    // Team, das die Würfel jahrelang nicht trifft, altert ungebremst weiter
    // (gemessen: das älteste Team +1,0 Jahr pro Saison bis 39,3).
    // Deshalb steigt die Chance mit dem Alter — ein überalterter Kader wird
    // umgebaut. Gleichgewicht dort, wo chance × 3 = 1 ist, also bei ~26 Jahren;
    // ab ~29 ist die Verjüngung sicher und kein Team kann davonlaufen.
    rejuvChance:   0.30,  // Grundchance
    rejuvVonAlter: 26,    // ab diesem Alter steigt sie
    rejuvSteigung: 0.22,  // je Jahr darüber
    rejuvDrop:    [2, 4], // Alters-Reduktion bei Verjüngung (zufällig in Spanne)
    // Plausible OVR-Grenzen je Spielklasse (per Team-Stärke geschätzt)
    clamp: { hardLo: 42, hardHi: 92 },
    // Mean-Reversion: zieht jedes Team sanft zu seinem EIGENEN Niveau zurück
    // (Team-Mittelwert, nicht Ligamittel), damit kurzfristige Ausreißer wieder
    // eingefangen werden.
    reversionPull: 0.28,  // Anteil der Abweichung, der pro Saison zurückgeholt wird
    // Adaptives Eigen-Niveau: der Anker zieht langsam mit der tatsächlichen
    // Stärke mit. → Nachhaltige Entwicklung (mehrere Saisons stark) wird ein
    // dauerhaft höheres Niveau ("man kann aufsteigen"), ein einzelner Ausreißer
    // wird von der Reversion wieder auf das alte Niveau zurückgeholt.
    baselineAdapt: 0.12,
    // …und nach unten, bewusst langsamer: ein schlechtes Jahr soll ein Team
    // nicht dauerhaft abstempeln, aber ein jahrelanger Abbau muss ankommen.
    // Ohne diesen Gegenpart inflationiert die ganze Liga über die Saisons.
    baselineAdaptDown: 0.07,
    // Talent-Drain: Klubs ÜBER ihrem Eigen-Niveau werden bevorzugt geplündert
    // (ihr bester Mann wird nach oben weggekauft) → Regression zum Eigen-Mittel.
    overpoachWeight: 0.6,   // wie stark Überperformer als Verkäufer bevorzugt werden
    overpoachDrain: 0.5,    // zusätzlicher Verkäufer-Malus je OVR über dem Eigen-Niveau
  };

  // Deterministischer Pseudo-Zufall aus String (stabil pro Team)
  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0) / 4294967295;
  }

  // Start-Durchschnittsalter eines Teams (einmalig bestimmt, dann fortgeschrieben)
  function initNpcAge(team) {
    if (typeof team.npcAge === 'number') return team.npcAge;
    // 23–29 je nach Team-Hash; stärkere Teams minimal jünger (bessere Akademien)
    const base = 23 + hashStr(team.id || team.name || 'x') * 6; // 23..29
    team.npcAge = Math.round(base * 10) / 10;
    return team.npcAge;
  }

  // Merkt sich das Ausgangs-Niveau eines Teams (Anker für die Mean-Reversion).
  function baselineOvr(team) {
    if (typeof team.baselineOvr !== 'number') {
      team.baselineOvr = team.ovr;
    }
    return team.baselineOvr;
  }

  function clampOvr(v) {
    return Math.max(CFG.clamp.hardLo, Math.min(CFG.clamp.hardHi, Math.round(v)));
  }

  // Entwickelt ein einzelnes Team um eine Saison weiter.
  function developTeam(team) {
    if (!team || typeof team.ovr !== 'number') return;
    let age = initNpcAge(team);
    const anchor = baselineOvr(team);

    // Verjüngung? (Kaderumbruch) — je älter der Kader, desto wahrscheinlicher.
    const rejuv = CFG.rejuvChance + Math.max(0, age - CFG.rejuvVonAlter) * CFG.rejuvSteigung;
    if (Math.random() < rejuv) {
      const drop = CFG.rejuvDrop[0] + Math.random() * (CFG.rejuvDrop[1] - CFG.rejuvDrop[0]);
      age = Math.max(22, age - drop);
    }

    // Alter der KOMMENDEN Saison festschreiben, BEVOR die Drift daraus entsteht.
    // Vorher lief die Drift auf dem Alter vor dem Jahreswechsel — ein gerade
    // verjüngtes Team kassierte den Jugendbonus damit doppelt und die Liga
    // gewann im Mittel +0,7 OVR pro Saison.
    age = Math.round((age + 1) * 10) / 10;
    team.npcAge = age;

    // Drift nach Alter: jünger als die Mitte → Talente reifen, älter → Abbau.
    // Proportional, damit die Bilanz über die ganze Liga von selbst aufgeht.
    let drift = (CFG.altersMitte - age) * CFG.driftProJahr;
    // Zufallsrauschen
    drift += (Math.random() - 0.5) * 2 * CFG.noise;

    // Mean-Reversion: zieht das Team anteilig zu seinem Ausgangs-Niveau zurück.
    // Verhindert, dass die Liga über viele Saisons nach oben oder unten wegläuft.
    const reversion = (anchor - team.ovr) * CFG.reversionPull;
    drift += reversion;

    // Auf die drei Mannschaftsteile anwenden (leicht unterschiedlich)
    const apply = (val) => clampOvr(val + drift + (Math.random() - 0.5));
    team.def = apply(team.def);
    team.mid = apply(team.mid);
    team.att = apply(team.att);
    team.ovr = Math.round((team.def + team.mid + team.att) / 3);

    // Adaptives Eigen-Niveau. Wer sich über mehrere Saisons wirklich steigert,
    // etabliert ein dauerhaft höheres Niveau (echter Aufstieg) — und wer über
    // Jahre abbaut, sinkt auch dauerhaft ab, nur langsamer.
    // Früher lief die Ratsche NUR nach oben, damit die Ligen nicht absacken.
    // Der Grund dafür war die kaputte Alterung (alle Teams hingen dauerhaft in
    // der Abbauphase); seit die behoben ist, sorgt die Einweg-Ratsche für das
    // umgekehrte Problem: die gesamte Fußballwelt inflationierte, gemessen
    // Regionalliga 53,2 → 59,8 OVR in 20 Saisons.
    if (team.ovr > anchor) {
      team.baselineOvr = Math.min(CFG.clamp.hardHi, anchor + (team.ovr - anchor) * CFG.baselineAdapt);
    } else if (team.ovr < anchor) {
      team.baselineOvr = Math.max(CFG.clamp.hardLo, anchor + (team.ovr - anchor) * CFG.baselineAdaptDown);
    }

    // (team.npcAge ist oben bereits fortgeschrieben — die Drift braucht das
    // Alter der kommenden Saison.)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AUSLÄNDISCHE VEREINE
  // ───────────────────────────────────────────────────────────────────────────
  // Top-Klubs der großen europäischen Ligen als eigenständige Entitäten. Sie
  // greifen NICHT ins deutsche Liga-System ein (Tabellen bleiben unberührt),
  // nehmen aber am Transfermarkt teil — und bilden die Grundlage für einen
  // späteren Europapokal / Champions League.
  // Persistent in CLUB.foreignClubs gespeichert (Entwicklung über Saisons).
  // ═══════════════════════════════════════════════════════════════════════════
  const FOREIGN_SEED = [
    // England
    { id: 'mancity', name: 'Manchester City',   country: 'England',     flag: '🏴',  def: 89, mid: 90, att: 90 },
    { id: 'liverpool', name: 'FC Liverpool',     country: 'England',     flag: '🏴',  def: 86, mid: 87, att: 88 },
    { id: 'arsenal', name: 'FC Arsenal',         country: 'England',     flag: '🏴',  def: 85, mid: 86, att: 85 },
    { id: 'chelsea', name: 'FC Chelsea',         country: 'England',     flag: '🏴',  def: 82, mid: 83, att: 83 },
    { id: 'mancutd', name: 'Manchester United',  country: 'England',     flag: '🏴',  def: 81, mid: 82, att: 83 },
    { id: 'tottenham', name: 'Tottenham Hotspur',country: 'England',     flag: '🏴',  def: 80, mid: 82, att: 84 },
    // Spanien
    { id: 'realmadrid', name: 'Real Madrid',     country: 'Spanien',     flag: '🇪🇸', def: 88, mid: 90, att: 91 },
    { id: 'barcelona', name: 'FC Barcelona',     country: 'Spanien',     flag: '🇪🇸', def: 85, mid: 88, att: 88 },
    { id: 'atletico', name: 'Atlético Madrid',   country: 'Spanien',     flag: '🇪🇸', def: 87, mid: 84, att: 83 },
    { id: 'sevilla', name: 'FC Sevilla',         country: 'Spanien',     flag: '🇪🇸', def: 78, mid: 78, att: 77 },
    // Italien
    { id: 'inter', name: 'Inter Mailand',        country: 'Italien',     flag: '🇮🇹', def: 87, mid: 86, att: 86 },
    { id: 'juventus', name: 'Juventus Turin',    country: 'Italien',     flag: '🇮🇹', def: 85, mid: 84, att: 83 },
    { id: 'milan', name: 'AC Mailand',           country: 'Italien',     flag: '🇮🇹', def: 84, mid: 84, att: 84 },
    { id: 'napoli', name: 'SSC Neapel',          country: 'Italien',     flag: '🇮🇹', def: 83, mid: 84, att: 85 },
    // Frankreich
    { id: 'psg', name: 'Paris Saint-Germain',    country: 'Frankreich',  flag: '🇫🇷', def: 85, mid: 87, att: 90 },
    { id: 'monaco', name: 'AS Monaco',           country: 'Frankreich',  flag: '🇫🇷', def: 78, mid: 79, att: 80 },
    { id: 'marseille', name: 'Olympique Marseille',country: 'Frankreich',flag: '🇫🇷', def: 77, mid: 77, att: 78 },
    // Portugal / Niederlande / weitere
    { id: 'benfica', name: 'Benfica Lissabon',   country: 'Portugal',    flag: '🇵🇹', def: 80, mid: 81, att: 82 },
    { id: 'porto', name: 'FC Porto',             country: 'Portugal',    flag: '🇵🇹', def: 79, mid: 79, att: 79 },
    { id: 'ajax', name: 'Ajax Amsterdam',        country: 'Niederlande', flag: '🇳🇱', def: 77, mid: 79, att: 80 },
    { id: 'psv', name: 'PSV Eindhoven',          country: 'Niederlande', flag: '🇳🇱', def: 76, mid: 78, att: 80 },
  ];

  // Liefert (und initialisiert) die persistente Liste ausländischer Vereine.
  function foreignClubs() {
    if (typeof CLUB === 'undefined') return [];
    if (!Array.isArray(CLUB.foreignClubs) || !CLUB.foreignClubs.length) {
      CLUB.foreignClubs = FOREIGN_SEED.map(c => ({
        id: c.id, name: c.name, country: c.country, flag: c.flag,
        def: c.def, mid: c.mid, att: c.att,
        ovr: Math.round((c.def + c.mid + c.att) / 3),
        foreign: true,
      }));
    }
    return CLUB.foreignClubs;
  }
  window.getForeignClubs = foreignClubs;

  // Läuft über ALLE Teams aller Ligen (außer dem eigenen Verein 'fcm').
  function developAllNpcs(league) {
    if (!league || !league.tiers) return 0;
    let count = 0;
    Object.keys(league.tiers).forEach(tierKey => {
      (league.tiers[tierKey].groups || []).forEach(grp => {
        (grp.teams || []).forEach(team => {
          if (team.id === 'fcm') return;   // eigener Verein wird separat behandelt
          developTeam(team);
          count++;
        });
      });
    });
    // Ausländische Vereine entwickeln sich ebenfalls mit (Alterung etc.)
    foreignClubs().forEach(team => { developTeam(team); count++; });
    return count;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NPC-TRANSFERMARKT — Bewegung zwischen den Vereinen
  // ───────────────────────────────────────────────────────────────────────────
  // Simuliert pro Saison eine Handvoll Transfers: stärkere Klubs holen sich
  // Verstärkung von (meist schwächeren) Vereinen. Der Käufer wird leicht stärker,
  // der Verkäufer leicht schwächer. Erzeugt glaubwürdige Transfer-News.
  // ═══════════════════════════════════════════════════════════════════════════
  const TCFG = {
    transfersPerSeason: [7, 12],  // Spanne der simulierten Transfers pro Saison
    maxShift:           2,        // max. OVR-Verschiebung pro Transfer
    feeByOvr:           true,     // Ablöse grob aus Spielerstärke
    newsMax:            7,        // so viele Transfers landen als News im Feed
  };

  // Realistisches Transferbudget eines NPC-Vereins — nach DEMSELBEN Modell wie
  // beim eigenen Verein: TV-Gelder (Liga-Pool × Platzierung) + Dauerkarten
  // (Stadionkapazität) + Sponsoren + Banner, minus geschätzte Fixkosten.
  // Das Stadion-/Fan-Niveau wird aus der Vereinsstärke abgeleitet.
  const NPC_TV_POOL = {
    // [Gesamtpool, Sockel-Anteil, Teams] — wie im Budget-System des Spielers
    1: [630000000, 0.50, 18],   // Bundesliga
    2: [130000000, 0.50, 18],   // 2. Bundesliga
    3: [26000000, 0.90, 20],    // 3. Liga
    4: [4000000, 0.95, 18],     // Regionalliga
  };
  const NPC_SPONSOR = { 1: [12000000, 6000000], 2: [3500000, 2000000], 3: [900000, 500000], 4: [250000, 120000] };
  const NPC_BANNER  = { 1: 120000, 2: 45000, 3: 16000, 4: 6000 };
  const NPC_CAP_LEVEL = [6000, 9000, 13000, 18000, 25000, 33000, 42000, 52000, 62000, 75000];
  const NPC_INCOME_MUL = 1.4;   // = INCOME-Faktor des Spielersystems

  function npcTransferBudget(entry) {
    const t = entry.team;
    const ovr = t.ovr || 65;

    if (entry.foreign) {
      // Euro-Clubs nach realistischen europäischen Verhältnissen.
      // Top-Klubs (Real, City, PSG, Bayern-Niveau) machen dreistellige Angebote,
      // starke Klubs zweistellig, kleine wenig. Steil progressiv mit der Stärke.
      return euroClubBudget(ovr);
    }

    const tier = t.tier || 4;
    const pool = NPC_TV_POOL[tier] || NPC_TV_POOL[4];
    const [poolSum, split, n] = pool;
    const rank = estimateRankFromOvr(ovr, tier);

    // TV-Geld (Sockel + leistungsabhängiger Teil), wie beim Spieler
    const pts = Math.round(82 - (82 - 26) * (rank - 1) / (n - 1));
    let ptsTotal = 0; for (let r = 1; r <= n; r++) ptsTotal += Math.round(82 - (82 - 26) * (r - 1) / (n - 1));
    const tv = poolSum * split / n + poolSum * (1 - split) * pts / ptsTotal;

    // Stadion-/Fan-Niveau aus Stärke
    const stadLvl = npcStadiumLevel(ovr, tier);
    const cap = NPC_CAP_LEVEL[stadLvl - 1];
    // VOLLE Zuschauereinnahmen: Dauerkarten + Tageskarten über ~17 Heimspiele
    const seasonTickets = cap * 0.45 * 620 * NPC_INCOME_MUL;               // Dauerkarten
    const matchdayGate = cap * 0.55 * 32 * 17 * NPC_INCOME_MUL;            // Tageskarten (17 Heimspiele)

    const [shirt, stad] = NPC_SPONSOR[tier] || NPC_SPONSOR[4];
    const sponsors = shirt * NPC_INCOME_MUL + (stadLvl >= 4 ? stad * NPC_INCOME_MUL : 0);
    const banner = (stadLvl < 4 ? 8 : 14) * (NPC_BANNER[tier] || 16000) * NPC_INCOME_MUL;

    // Merchandising ~ Fanbase (Stadiongröße)
    const merch = cap * 95 * NPC_INCOME_MUL;

    // EUROPAPOKAL-Gelder: nur für Spitzenteams der Bundesliga (CL/EL-Teilnahme
    // sehr wahrscheinlich bei Top-Platzierung). Grob nach geschätztem Rang.
    let euroMoney = 0;
    if (tier === 1) {
      if (rank <= 4) euroMoney = 55000000 - (rank - 1) * 8000000;   // CL: ~55/47/39/31 Mio
      else if (rank <= 6) euroMoney = 22000000;                      // EL
      else if (rank <= 7) euroMoney = 12000000;                      // Conference
    }

    const income = tv + seasonTickets + matchdayGate + sponsors + banner + merch + euroMoney;

    // Transfer-Anteil: Spitzenklubs reinvestieren einen größeren Teil aggressiv in
    // Transfers (plus Rücklagen/Investoren). Skaliert mit der Stärke.
    const mean = tierMeanOvr(tier);
    const transferShare = 0.28 + Math.max(0, (ovr - mean)) * 0.012;   // stärker = größerer Anteil
    const budget = income * Math.min(0.55, transferShare);

    return Math.max(50000, Math.round(budget));
  }

  // Realistisches Transferbudget europäischer Klubs — steil progressiv.
  // OVR 90 (Real/City): ~150-200 Mio · 85 (Top): ~80 Mio · 78: ~25 Mio · 65: ~3 Mio · 58: <1 Mio
  function euroClubBudget(ovr) {
    const base = Math.pow(Math.max(0, ovr - 52), 3.05) * 62;
    return Math.round(base * (0.75 + Math.random() * 0.5));
  }

  // Schätzt die Tabellenplatzierung eines NPC aus seiner Stärke (1 = Spitze).
  function estimateRankFromOvr(ovr, tier) {
    const mean = tierMeanOvr(tier);
    // ovr deutlich über Mittel → oberes Tabellendrittel, darunter → unteres.
    const spread = 10;
    const rel = Math.max(-1, Math.min(1, (ovr - mean) / spread));  // -1..1
    const n = (NPC_TV_POOL[tier] || NPC_TV_POOL[4])[2];
    // rel=1 → Platz 1, rel=-1 → Platz n
    return Math.max(1, Math.min(n, Math.round((n + 1) / 2 - rel * (n - 1) / 2)));
  }

  // Stadion-Level (1-10) aus Stärke + Liga ableiten.
  function npcStadiumLevel(ovr, tier) {
    const tierBase = { 1: 6, 2: 4, 3: 2, 4: 1 }[tier] || 1;
    const mean = tierMeanOvr(tier);
    const bonus = Math.round((ovr - mean) / 6);   // stärker = größeres Stadion
    return Math.max(1, Math.min(10, tierBase + bonus));
  }
  function tierMeanOvr(tier) { return { 1: 78, 2: 70, 3: 63, 4: 57 }[tier] || 60; }

  // Namenspool aus echten Spielerdaten (für realistische Transfer-Meldungen).
  let NAME_POOL = null;
  function namePool() {
    if (NAME_POOL) return NAME_POOL;
    const src = (typeof window !== 'undefined' && window.EMBEDDED_PLAYERS) || [];
    NAME_POOL = src.map(p => ({
      name: (p.firstName ? p.firstName + ' ' : '') + (p.name || ''),
      pos: (Array.isArray(p.positions) && p.positions[0]) || 'ZM',
      ovr: Math.round((p.def + p.mid + p.att) / 3) || 65,
      flag: p.flag || '',
    })).filter(x => x.name.trim());
    return NAME_POOL;
  }

  function pickName(targetOvr) {
    const pool = namePool();
    if (!pool.length) return { name: 'Ein Neuzugang', pos: 'ZM', flag: '' };
    // bevorzugt Namen mit ähnlichem OVR (±6), sonst irgendeinen
    const near = pool.filter(p => Math.abs(p.ovr - targetOvr) <= 6);
    const arr = near.length ? near : pool;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function feeFor(ovr) {
    // Realistische Ablöse, steil progressiv (kalibriert an zwei Ankerpunkten:
    // OVR 90 ≈ 120 Mio, OVR 70 ≈ 5 Mio):
    //  85 ≈ 64 Mio · 80 ≈ 31 Mio · 75 ≈ 14 Mio · 65 ≈ 1,4 Mio · 60 ≈ 0,3 Mio
    const base = Math.max(0, ovr - 48);
    const m = Math.round(Math.pow(base, 4.91) * 1.26 / 1000) * 1000;
    // Marktwert-Streuung
    return Math.max(20000, Math.round(m * (0.78 + Math.random() * 0.44)));
  }

  function fmtFee(v) {
    return (typeof formatEuro === 'function') ? formatEuro(v) : (v.toLocaleString('de-DE') + ' €');
  }

  // Sammelt alle NPC-Teams mit Tier-Rang (0 = stärkste Liga).
  function allNpcTeams(league) {
    const tierRank = { bundesliga: 0, bundesliga2: 1, liga3: 2, regionalliga: 3 };
    const out = [];
    Object.keys(league.tiers).forEach(tierKey => {
      (league.tiers[tierKey].groups || []).forEach(grp => {
        (grp.teams || []).forEach(team => {
          if (team.id === 'fcm') return;
          out.push({ team, tier: tierRank[tierKey] != null ? tierRank[tierKey] : 3 });
        });
      });
    });
    // Ausländische Top-Klubs: als Tier 0 (Spitzenniveau) am Markt aktiv.
    foreignClubs().forEach(team => out.push({ team, tier: 0, foreign: true }));
    return out;
  }

  function simulateNpcTransfers(league) {
    if (!league || !league.tiers) return [];
    const teams = allNpcTeams(league);
    if (teams.length < 4) return [];

    const nT = TCFG.transfersPerSeason[0] +
      Math.floor(Math.random() * (TCFG.transfersPerSeason[1] - TCFG.transfersPerSeason[0] + 1));

    const log = [];
    // Jeder NPC-Verein bekommt für diese Transferperiode ein Budget zugewiesen.
    const budgets = {};
    teams.forEach(t => { budgets[t.team.id] = npcTransferBudget(t); });

    for (let i = 0; i < nT; i++) {
      // Käufer: tendenziell stärkeres Team (kleinerer Tier-Wert, höherer OVR)
      const buyer = weightedPick(teams, t => (4 - t.tier) * 2 + t.team.ovr / 20);
      // Verkäufer: schwächer als oder ähnlich stark wie der Käufer, anderer Verein.
      // Auch gleichstarke Topklubs können untereinander handeln (Real kauft von City).
      const sellerCandidates = teams.filter(t =>
        t.team.id !== buyer.team.id && t.team.ovr <= buyer.team.ovr + 3);
      if (!sellerCandidates.length) continue;
      // Gewichtung: leichter Abstand bevorzugt, aber gleichstarke Transfers bleiben
      // gut möglich (flachere Kurve → mehr Topklub-zu-Topklub-Wechsel).
      const seller = weightedPick(sellerCandidates, t => {
        const gap = buyer.team.ovr - t.team.ovr;        // >0: Käufer stärker
        // Optimum bei ~2-3 OVR Abstand, aber auch gap=0 hat gutes Gewicht
        let w = Math.max(0.5, 3.5 - Math.abs(gap - 2.5) * 0.35);
        // Talent-Drain: Klubs ÜBER ihrem Eigen-Niveau werden bevorzugt geplündert
        // (regression zum Team-Mittel). baselineOvr wird von developTeam gepflegt.
        const over = t.team.ovr - (t.team.baselineOvr != null ? t.team.baselineOvr : t.team.ovr);
        if (over > 0) w *= (1 + over * CFG.overpoachWeight);
        return w;
      });

      // Transfer-Stärke orientiert sich am Verkäufer-Niveau
      const playerOvr = clampOvr(seller.team.ovr + (Math.random() * 6 - 2));
      const who = pickName(playerOvr);
      const fee = feeFor(playerOvr);

      // VERTRAGSVERLÄNGERUNG: Starke Vereine halten ihre Leistungsträger.
      // Je stärker der verkaufende Verein und je wertvoller der Spieler relativ
      // zum Team, desto eher lehnt er den Verkauf ab (verlängert stattdessen).
      // Ausnahme: Wenn der Käufer klar stärker ist (echter Aufstieg für den Spieler),
      // sinkt die Halte-Wahrscheinlichkeit (Wechsel zu größerem Klub reizt).
      const sellerStrength = seller.team.ovr;
      const isStarForSeller = playerOvr >= sellerStrength - 1;    // Leistungsträger?
      let keepChance = 0;
      if (isStarForSeller) {
        // Grund-Haltewahrscheinlichkeit steigt mit Vereinsstärke, aber gedeckelt,
        // damit der Transfermarkt lebendig bleibt.
        keepChance = Math.max(0, (sellerStrength - 72) / 40);     // OVR 72→0, 92→0.5
        keepChance = Math.min(0.55, keepChance);
        // Lockt ein deutlich stärkerer Käufer, sinkt die Haltechance
        const buyerPull = Math.max(0, buyer.team.ovr - sellerStrength);
        keepChance *= Math.max(0.3, 1 - buyerPull * 0.08);
      }
      if (Math.random() < keepChance) {
        // Verein verlängert mit dem Spieler statt zu verkaufen
        log.push({
          renewal: true,
          playerName: who.name, pos: who.pos, flag: who.flag, ovr: playerOvr,
          club: seller.team.name, clubFlag: seller.team.flag || '',
        });
        continue;
      }

      // REALISMUS-GATE: Käufer muss sich die Ablöse leisten können.
      // Havelse (Tier 2/3, kleines Budget) kann keine 40-Mio-Transfers stemmen.
      if (fee > (budgets[buyer.team.id] || 0)) {
        continue;   // Transfer platzt — kein Geld
      }
      budgets[buyer.team.id] -= fee;                    // Budget aufbrauchen
      budgets[seller.team.id] = (budgets[seller.team.id] || 0) + Math.round(fee * 0.85);  // Verkäufer reinvestiert Teil

      // Wirkung: Käufer +, Verkäufer − (klein, in Grenzen)
      const shift = 0.4 + Math.random() * TCFG.maxShift;
      const beforeB = buyer.team.ovr, beforeS = seller.team.ovr;
      // auf die Mannschaftsteile passend zur Position verteilen
      bumpTeamByPos(buyer.team, who.pos, +shift);
      // Verkäufer: Grund-Malus + Extra-Drain, wenn er über seinem Eigen-Niveau steht
      const sellerOver = Math.max(0, seller.team.ovr - (seller.team.baselineOvr != null ? seller.team.baselineOvr : seller.team.ovr));
      bumpTeamByPos(seller.team, who.pos, -(shift * 0.8 + sellerOver * CFG.overpoachDrain));

      log.push({
        playerName: who.name, pos: who.pos, flag: who.flag, ovr: playerOvr,
        from: seller.team.name, to: buyer.team.name, fee,
        fromFlag: seller.team.flag || '', toFlag: buyer.team.flag || '',
        international: !!(seller.foreign) !== !!(buyer.foreign),
      });
    }
    return log;
  }

  // Verstärkt/schwächt das zur Position passende Mannschaftsteil eines Teams.
  function bumpTeamByPos(team, pos, delta) {
    const p = (pos || 'ZM').toUpperCase();
    let key = 'mid';
    if (['TW', 'IV', 'AV', 'LV', 'RV'].some(x => p.includes(x))) key = 'def';
    else if (['ST', 'MS', 'LA', 'RA', 'OM', 'FL', 'LF', 'RF'].some(x => p.includes(x))) key = 'att';
    team[key] = clampOvr((team[key] || 60) + delta);
    team.ovr = Math.round((team.def + team.mid + team.att) / 3);
  }

  // Gewichtete Zufallsauswahl
  function weightedPick(arr, weightFn) {
    const weights = arr.map(weightFn);
    const sum = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * sum;
    for (let i = 0; i < arr.length; i++) { r -= weights[i]; if (r <= 0) return arr[i]; }
    return arr[arr.length - 1];
  }

  // Schreibt die markantesten Transfers als News in den Feed.
  function reportTransfers(log) {
    if (!log || !log.length || typeof addNews !== 'function') return;
    // Nur die EIGENEN, abstrakten Einträge melden. Seit der Hook über window
    // läuft, hängt npc_real_transfers_patch.js seine namentlichen Transfers mit
    // in dieselbe Liste — die melden sich dort selbst und haben eine andere
    // Struktur (t.player statt t.playerName), hier kämen sie als „undefined
    // wechselt von undefined" heraus.
    const eigene = log.filter(t => typeof t.playerName === 'string');
    if (!eigene.length) return;
    const transfers = eigene.filter(t => !t.renewal);
    const renewals = eigene.filter(t => t.renewal);

    // Transfers melden (nach Ablöse sortiert)
    if (transfers.length) {
      const top = transfers.slice().sort((a, b) => b.fee - a.fee).slice(0, TCFG.newsMax);
      const lines = top.map(t => {
        const fromTag = (t.fromFlag ? t.fromFlag + ' ' : '') + t.from;
        const toTag = (t.toFlag ? t.toFlag + ' ' : '') + t.to;
        const intl = t.international ? ' 🌍' : '';
        return `${t.flag ? t.flag + ' ' : ''}${t.playerName} (${t.pos}) wechselt von ${fromTag} zu ${toTag} — ${fmtFee(t.fee)}${intl}`;
      });
      const intlCount = transfers.filter(t => t.international).length;
      const subtitle = intlCount ? ` (davon ${intlCount} international)` : '';
      addNews('transfer', `🔄 Transfermarkt: ${transfers.length} Wechsel${subtitle}`,
        'Die wichtigsten Transfers:\n• ' + lines.join('\n• '));
    }

    // Vertragsverlängerungen melden (die wichtigsten, nach Spielerstärke)
    if (renewals.length) {
      const topR = renewals.slice().sort((a, b) => b.ovr - a.ovr).slice(0, 5);
      const rlines = topR.map(t =>
        `${t.clubFlag ? t.clubFlag + ' ' : ''}${t.club} verlängert mit ${t.flag ? t.flag + ' ' : ''}${t.playerName} (${t.pos})`);
      addNews('transfer', `✍️ ${renewals.length} Vertragsverlängerung${renewals.length !== 1 ? 'en' : ''}`,
        'Leistungsträger bleiben:\n• ' + rlines.join('\n• '));
    }
  }

  // ── HOOK: an runEndOfSeason anhängen ───────────────────────────────────────
  function install() {
    if (typeof window.runEndOfSeason !== 'function') return false;
    const _orig = window.runEndOfSeason;
    window.runEndOfSeason = function (league) {
      const result = _orig.apply(this, arguments);
      try {
        const lg = league || (typeof LEAGUE !== 'undefined' ? LEAGUE : null);
        developAllNpcs(lg);
        // ÜBER window aufrufen, nicht über die lokale Funktion! Spätere Module
        // (npc_real_transfers_patch.js) hängen sich an
        // window.NpcDevelopment.simulateNpcTransfers — ein direkter Aufruf der
        // lokalen Funktion läuft an diesem Wrapper vorbei und die echten,
        // namentlichen NPC-Transfers fanden nie statt (CLUB.npcSquads wurde
        // über 13 Saisons nicht ein einziges Mal angelegt).
        const fn = (window.NpcDevelopment && typeof window.NpcDevelopment.simulateNpcTransfers === 'function')
                 ? window.NpcDevelopment.simulateNpcTransfers : simulateNpcTransfers;
        const transfers = fn.call(window.NpcDevelopment || null, lg);
        reportTransfers(transfers);
      } catch (e) { console.warn('[NpcDev] Fehler', e); }
      return result;
    };
    try { runEndOfSeason = window.runEndOfSeason; } catch (e) {}
    console.log('[NpcDev] aktiv — NPC-Vereine altern & entwickeln sich pro Saison');
    return true;
  }

  // engine_main definiert runEndOfSeason als Funktions-Deklaration → global vorhanden.
  if (!install()) {
    // Falls Reihenfolge unerwartet: kurz später erneut versuchen
    let tries = 0;
    const iv = setInterval(() => { tries++; if (install() || tries > 20) clearInterval(iv); }, 50);
  }

  window.NpcDevelopment = { developAllNpcs, developTeam, simulateNpcTransfers, reportTransfers, foreignClubs, CFG, TCFG };
})();


/* ---------- js/euro_competitions_patch.js ---------- */
/* ===== euro_competitions_patch.js =====
   Internationale Wettbewerbe: Champions League / Europa League / Conference League
   ────────────────────────────────────────────────────────────────────────────
   ETAPPE 1 — Qualifikation (dynamisch pro Saison)
   - Pro Land werden die Vereine nach aktueller Stärke + Zufall sortiert und auf
     die Slots (CL/EL/CO) verteilt. Reservevereine rücken nach.
   - Felder werden auf je 36 aufgefüllt (CL +Titelverteidiger, EL +CL-Quali-
     Verlierer, CO +Qualirunde der schwächsten).
   - FCM qualifiziert sich über die Bundesliga-Platzierung (oder Pokalsieg).
   Speicherung: CLUB.euro (persistent).
   Lädt nach euro_clubs.js, engine_main.js, app_main.js, npc_development_patch.js.
   ============================================================================= */
(function () {
  'use strict';

  const FIELD = (typeof window !== 'undefined' && window.EURO_FIELD_SIZE) || 36;

  // ── Persistenter Zustand ───────────────────────────────────────────────────
  function euroState() {
    if (typeof CLUB === 'undefined') return null;
    if (!CLUB.euro) CLUB.euro = { season: 0, competitions: null, fcmComp: null };
    return CLUB.euro;
  }

  // Aktuelle Stärke eines Euro-Clubs (entwickelt sich über NPC-System mit).
  // Wir spiegeln EURO_CLUBS in CLUB.euroClubs, damit sich Werte über Saisons ändern.
  function euroClubs() {
    if (!CLUB.euroClubs || !CLUB.euroClubs.length) {
      const seed = (typeof window !== 'undefined' && window.EURO_CLUBS) || [];
      CLUB.euroClubs = seed.map(c => ({ ...c }));
    }
    return CLUB.euroClubs;
  }

  // Deutsche Teilnehmer aus der echten Bundesliga (Top-Plätze) + FCM.
  function germanEntrants() {
    // Bundesliga-Teams aus dem Liga-System holen (aktuelle Stärke)
    const out = [];
    try {
      const tiers = LEAGUE && LEAGUE.tiers;
      if (tiers && tiers.bundesliga) {
        tiers.bundesliga.groups.forEach(g => {
          (g.teams || []).forEach(t => {
            out.push({ id: t.id, name: t.name, country: 'Deutschland', flag: '🇩🇪',
                       ovr: t.ovr || Math.round((t.def + t.mid + t.att) / 3), coeff: 1, def: t.def, mid: t.mid, att: t.att });
          });
        });
      }
    } catch (e) {}
    return out;
  }

  // ── Deutsche Starter nach der ABSCHLUSSTABELLE (Fix 2026-10-16) ──────────────
  // Vorher: die eigene Platzierung wurde erst NACH runEndOfSeason gelesen – alle Tabellen standen auf 0,
  // der „Rang“ war praktisch alphabetisch; der Pokalsieg (CLUB._wonCupLastSeason) wurde nie gesetzt;
  // deutsche KI-Vereine kamen nach Stärke + Zufall statt nach Platz, der eigene Verein zusätzlich (bis 8 Starter).
  // Jetzt: abschlussMerken() hält Erste-Liga-Reihenfolge, Pokalsieger und eigene Liga fest, BEVOR
  // startNewSeason die Tabellen leert. Vergabe wie in echt: Plätze 1–4 Champions Cup, 5 + Pokalsieger
  // Europacup (ist der Pokalsieger schon dabei, rückt Platz 6 nach), nächster Platz Kontinentalcup.
  // Ohne Vorsaison (Spielstart) gilt die Stärke-Reihenfolge der Ersten Liga.
  function ersteLigaTeams() {
    const out = [];
    try { LEAGUE.tiers.bundesliga.groups.forEach(g => (g.teams || []).forEach(t => out.push(t))); } catch (e) {}
    return out;
  }
  function teamOvr(t) { return t.ovr || Math.round(((t.def || 60) + (t.mid || 60) + (t.att || 60)) / 3); }
  function abschlussMerken() {
    const st = euroState(); if (!st) return null;
    try {
      const teams = ersteLigaTeams();
      const reihe = (typeof computeTable === 'function' ? computeTable(teams) : teams).map(t => t.id);
      const gespielt = teams.some(t => (t.played || 0) > 0);
      const fg = (typeof findFcmGroup === 'function') ? findFcmGroup(LEAGUE) : null;
      st.abschluss = {
        saison: LEAGUE.season, gespielt, erste: gespielt ? reihe : null,
        pokalsieger: (typeof CUP !== 'undefined' && CUP && CUP.winnerId) || null,
        fcmTier: fg ? fg.tierKey : null
      };
    } catch (e) { console.warn('[EuroCompetitions] Abschluss merken', e); }
    return st.abschluss;
  }
  function teamNachId(id) {
    try {
      for (const k of Object.keys(LEAGUE.tiers)) for (const g of LEAGUE.tiers[k].groups || []) {
        const t = (g.teams || []).find(x => x.id === id); if (t) return t;
      }
    } catch (e) {}
    return null;
  }
  function deutscheStarter() {
    const s = ((typeof window !== 'undefined' && window.EURO_COUNTRY_SLOTS) || {})['Deutschland'] || { cl: 4, el: 2, co: 1 };
    const st = euroState() || {};
    const ab = st.abschluss && st.abschluss.saison === (LEAGUE.season - 1) ? st.abschluss : null;
    let reihe = ab && ab.erste;
    if (!reihe) reihe = ersteLigaTeams().slice().sort((a, b) => teamOvr(b) - teamOvr(a)).map(t => t.id);
    const pokal = ab ? ab.pokalsieger : null;
    const vergeben = new Set(), out = { cl: [], el: [], co: [] };
    const nimm = (k, id) => { if (!id || vergeben.has(id)) return false; vergeben.add(id); out[k].push(id); return true; };
    reihe.slice(0, s.cl).forEach(id => nimm('cl', id));
    if (pokal && s.el > 0) nimm('el', pokal);
    for (const id of reihe) { if (out.el.length >= s.el) break; nimm('el', id); }
    for (const id of reihe) { if (out.co.length >= s.co) break; nimm('co', id); }
    let fcmComp = null;
    const teams = {};
    ['cl', 'el', 'co'].forEach(k => {
      teams[k] = out[k].map(id => {
        if (id === 'fcm') fcmComp = k;
        const t = teamNachId(id);
        if (id === 'fcm') return { id: 'fcm', name: (CLUB.name || 'FCM'), country: 'Deutschland', flag: '🇩🇪', ovr: fcmOvr(), isFcm: true };
        return t ? { id: t.id, name: t.name, country: 'Deutschland', flag: '🇩🇪', ovr: teamOvr(t) } : null;
      }).filter(Boolean);
    });
    return { teams, fcmComp };
  }
  // Gibt 'cl' | 'el' | 'co' | null zurück (API wie bisher).
  function fcmQualification() {
    try { return deutscheStarter().fcmComp; } catch (e) { return null; }
  }

  // ── Qualifikation aufbauen: 3 Felder à 36 Teams ────────────────────────────
  function buildQualification() {
    const slots = (typeof window !== 'undefined' && window.EURO_COUNTRY_SLOTS) || {};
    const clubs = euroClubs();
    const german = germanEntrants();

    // Vereine nach Land gruppieren (Ausland + deutsche aus Liga-System)
    const byCountry = {};
    clubs.forEach(c => { (byCountry[c.country] = byCountry[c.country] || []).push(c); });
    byCountry['Deutschland'] = german;

    const comp = { cl: [], el: [], co: [] };
    const overflowCL = [], overflowEL = [];

    // Deutsche Starter nach Abschlusstabelle + Pokalsieger (inkl. eigenem Verein)
    const de = deutscheStarter();
    const fcmComp = de.fcmComp;

    Object.keys(slots).forEach(country => {
      const s = slots[country];
      if (country === 'Deutschland') {
        ['cl', 'el', 'co'].forEach(k => de.teams[k].forEach(t => comp[k].push(tagComp(t, k, country))));
        return;
      }
      let pool = (byCountry[country] || []).slice();
      // Sortierung: Stärke + spürbarer Zufall (so wechseln Teilnehmer pro Saison,
      // v.a. wenn mehrere Vereine eines Landes ähnlich stark sind)
      pool.forEach(c => { c._q = (c.ovr || 60) + (Math.random() * 16 - 8); });
      pool.sort((a, b) => b._q - a._q);

      // FCM nicht doppelt: aus deutschem Pool entfernen, separat einsortieren
      if (country === 'Deutschland') {
        pool = pool.filter(c => c.id !== 'fcm');
      }

      let idx = 0;
      for (let i = 0; i < s.cl && idx < pool.length; i++) comp.cl.push(tagComp(pool[idx++], 'cl', country));
      for (let i = 0; i < s.el && idx < pool.length; i++) comp.el.push(tagComp(pool[idx++], 'el', country));
      for (let i = 0; i < s.co && idx < pool.length; i++) comp.co.push(tagComp(pool[idx++], 'co', country));
      // Reserve (für Auffüllung)
      while (idx < pool.length) { overflowEL.push(pool[idx]); idx++; }
    });


    // Auf je FIELD (36) bringen: zu viele kappen (schwächste raus), zu wenige auffüllen
    overflowEL.sort((a, b) => (b.ovr || 0) - (a.ovr || 0));
    ['cl', 'el', 'co'].forEach(k => {
      if (comp[k].length > FIELD) {
        // schwächste über FIELD hinaus zurück in den Reservepool (außer FCM)
        comp[k].sort((a, b) => {
          if (a.isFcm) return -1; if (b.isFcm) return 1;     // FCM nie kappen
          return (b.ovr || 0) - (a.ovr || 0);
        });
        const removed = comp[k].splice(FIELD);
        removed.forEach(t => overflowEL.push(t));
      }
    });
    fillTo(comp.cl, FIELD, overflowEL, 'cl');
    fillTo(comp.el, FIELD, overflowEL, 'el');
    fillTo(comp.co, FIELD, overflowEL, 'co');

    return { comp, fcmComp };
  }

  function tagComp(team, competition, country) {
    return { id: team.id, name: team.name, flag: team.flag, country: country || team.country,
             ovr: team.ovr || 60, isFcm: !!team.isFcm, competition };
  }
  function fillTo(arr, size, pool, comp) {
    while (arr.length < size && pool.length) {
      const t = pool.shift();
      arr.push(tagComp(t, comp));
    }
    // Falls immer noch zu wenig: generische Auffüll-Teams (sollte selten sein)
    let n = 1;
    while (arr.length < size) {
      arr.push({ id: 'eu_fill_' + comp + '_' + n, name: 'Qualifikant ' + n, flag: '🏳️',
                 country: '—', ovr: 60, competition: comp });
      n++;
    }
  }

  function fcmOvr() {
    try {
      const fg = findFcmGroup(LEAGUE);
      const t = fg && fg.group.teams.find(x => x.id === 'fcm');
      return t ? (t.ovr || Math.round((t.def + t.mid + t.att) / 3)) : 70;
    } catch (e) { return 70; }
  }

  // ── Öffentliche API ─────────────────────────────────────────────────────────
  function qualifyForSeason() {
    const st = euroState();
    if (!st) return null;
    const { comp, fcmComp } = buildQualification();
    st.competitions = comp;
    st.fcmComp = fcmComp;
    st.season = (typeof LEAGUE !== 'undefined' ? LEAGUE.season : (st.season + 1));
    return st;
  }

  window.EuroCompetitions = {
    qualifyForSeason,
    state: euroState,
    euroClubs,
    fcmQualification,
    abschlussMerken,
    deutscheStarter,
    buildQualification,
    // Etappe 2:
    buildLeaguePhase,
    simulateLeagueMatchday,
    leaguePhaseTable,
    fcmEuroFixtureForMatchday,
  };

  // ════════════════════════════════════════════════════════════════════════════
  // ETAPPE 2 — LIGAPHASE (modernes Format: 36 Teams, 8 Spiele, eine Tabelle)
  // ════════════════════════════════════════════════════════════════════════════

  // Initialisiert die Tabellen-Felder eines Teams.
  function initStanding(t) {
    return { id: t.id, name: t.name, flag: t.flag, country: t.country, ovr: t.ovr,
             isFcm: !!t.isFcm, def: t.def, mid: t.mid, att: t.att,
             played: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
  }

  // Baut für jeden Wettbewerb 8 Spieltage (jeder Verein 4 Heim / 4 Auswärts gegen
  // unterschiedliche Gegner). Vereinfachtes Schweizer-System: pro Spieltag werden
  // die Teams zufällig gepaart, ohne Wiederholung, mit Heim/Auswärts-Balance.
  function buildLeaguePhase() {
    const st = euroState();
    if (!st || !st.competitions) qualifyForSeason();
    const comps = euroState().competitions;
    const phase = {};
    ['cl', 'el', 'co'].forEach(key => {
      const teams = comps[key].map(initStanding);
      const fixtures = makeSwissFixtures(teams, 8);
      phase[key] = { standings: teams, fixtures, nextMatchday: 0, done: false };
    });
    euroState().leaguePhase = phase;
    return phase;
  }

  // Erzeugt 8 Spieltage à 18 Partien (36 Teams). Achtet auf:
  // keine Wiederholung von Paarungen, Heim/Auswärts möglichst 4/4.
  function makeSwissFixtures(teams, rounds) {
    const ids = teams.map(t => t.id);
    const played = new Set();          // "a|b" Paarungen
    const homeCount = {}; ids.forEach(id => homeCount[id] = 0);
    const matchdays = [];

    for (let r = 0; r < rounds; r++) {
      const pool = shuffle(ids.slice());
      const used = new Set();
      const md = [];
      for (let i = 0; i < pool.length; i++) {
        const a = pool[i];
        if (used.has(a)) continue;
        // passenden Gegner suchen
        let partner = null;
        for (let j = i + 1; j < pool.length; j++) {
          const b = pool[j];
          if (used.has(b)) continue;
          const key = a < b ? a + '|' + b : b + '|' + a;
          if (!played.has(key)) { partner = b; break; }
        }
        if (!partner) {
          // Fallback: irgendeinen freien nehmen
          for (let j = i + 1; j < pool.length; j++) { if (!used.has(pool[j])) { partner = pool[j]; break; } }
        }
        if (!partner) continue;
        used.add(a); used.add(partner);
        const key = a < partner ? a + '|' + partner : partner + '|' + a;
        played.add(key);
        // Heim/Auswärts nach bisheriger Heimbilanz
        let home = a, away = partner;
        if (homeCount[a] > homeCount[partner]) { home = partner; away = a; }
        homeCount[home]++;
        md.push({ home, away, played: false, gh: null, ga: null });
      }
      matchdays.push(md);
    }
    return matchdays;
  }

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  // Simuliert einen kompletten Spieltag eines Wettbewerbs (alle Nicht-FCM-Spiele).
  // FCM-Spiel wird übersprungen, wenn fcmResult==null (wird interaktiv gespielt);
  // sonst wird das übergebene Ergebnis eingetragen.
  function simulateLeagueMatchday(key, fcmResult) {
    const phase = euroState().leaguePhase;
    if (!phase || !phase[key]) return null;
    const comp = phase[key];
    if (comp.nextMatchday >= comp.fixtures.length) { comp.done = true; return null; }
    const md = comp.fixtures[comp.nextMatchday];
    const byId = {}; comp.standings.forEach(t => byId[t.id] = t);

    md.forEach(m => {
      if (m.played) return;
      const home = byId[m.home], away = byId[m.away];
      if (!home || !away) return;
      let gh, ga;
      if ((home.isFcm || away.isFcm) && fcmResult) {
        // Ergebnis aus dem echten Spiel übernehmen (Perspektive korrigieren)
        if (home.isFcm) { gh = fcmResult.fcm; ga = fcmResult.opp; }
        else { gh = fcmResult.opp; ga = fcmResult.fcm; }
      } else if (home.isFcm || away.isFcm) {
        // FCM-Spiel ohne Ergebnis → nicht simulieren (wird interaktiv gespielt)
        return;
      } else {
        const res = quickSimResult(home, away);
        gh = res[0]; ga = res[1];
      }
      m.gh = gh; m.ga = ga; m.played = true;
      recordResult(comp.standings, m.home, m.away, gh, ga);
    });

    // Spieltag abgeschlossen?
    if (md.every(m => m.played)) comp.nextMatchday++;
    if (comp.nextMatchday >= comp.fixtures.length) comp.done = true;
    return comp;
  }

  // Aktuelle Tabelle eines Wettbewerbs (1-36).
  function leaguePhaseTable(key) {
    const phase = euroState().leaguePhase;
    if (!phase || !phase[key]) return [];
    return computeTable(phase[key].standings);
  }

  // FCMs nächstes Europa-Spiel im aktuellen Spieltag (oder null).
  function fcmEuroFixtureForMatchday(key) {
    const phase = euroState().leaguePhase;
    if (!phase || !phase[key]) return null;
    const comp = phase[key];
    if (comp.nextMatchday >= comp.fixtures.length) return null;
    const md = comp.fixtures[comp.nextMatchday];
    const m = md.find(x => (x.home === 'fcm' || x.away === 'fcm') && !x.played);
    if (!m) return null;
    const byId = {}; comp.standings.forEach(t => byId[t.id] = t);
    const isHome = m.home === 'fcm';
    const opp = byId[isHome ? m.away : m.home];
    return { isHome, opponent: opp, matchday: comp.nextMatchday + 1 };
  }

  console.log('[EuroCompetitions] Etappe 2 aktiv — Ligaphase (36er-Tabelle, 8 Spiele)');

  // ════════════════════════════════════════════════════════════════════════════
  // ETAPPE 3 — K.-O.-PHASE
  // Platz 1-8 → direkt Achtelfinale · 9-24 → Playoff · 25-36 → ausgeschieden
  // Playoff → Achtel → Viertel → Halb → Finale. Hin/Rück bis HF, Finale einzeln.
  // ════════════════════════════════════════════════════════════════════════════

  const KO_ROUNDS = ['playoff', 'achtelfinale', 'viertelfinale', 'halbfinale', 'finale'];
  const KO_LABEL = { playoff: 'Playoff', achtelfinale: 'Achtelfinale',
                     viertelfinale: 'Viertelfinale', halbfinale: 'Halbfinale', finale: 'Finale' };

  // Initialisiert die K.-o.-Phase eines Wettbewerbs aus der Ligaphasen-Tabelle.
  function buildKnockout(key) {
    const tbl = leaguePhaseTable(key);
    if (tbl.length < 36) return null;
    const top8 = tbl.slice(0, 8);          // direkt Achtelfinale
    const playoffTeams = tbl.slice(8, 24); // 16 Teams → 8 Playoff-Paarungen
    // Playoff-Paarungen: 9vs24, 10vs23, ... (gesetzt vs ungesetzt)
    const playoffPairs = [];
    for (let i = 0; i < 8; i++) {
      playoffPairs.push(makeTie(playoffTeams[i], playoffTeams[15 - i], 'playoff'));
    }
    const ko = {
      key,
      seeds: { top8, playoffTeams },
      rounds: { playoff: playoffPairs },
      currentRound: 'playoff',
      results: {},
      done: false,
      winner: null,
    };
    euroState().knockout = euroState().knockout || {};
    euroState().knockout[key] = ko;
    return ko;
  }

  function makeTie(a, b, round, single) {
    return {
      round,
      teamA: a ? { id: a.id, name: a.name, flag: a.flag, ovr: a.ovr, isFcm: a.isFcm, def: a.def, mid: a.mid, att: a.att } : null,
      teamB: b ? { id: b.id, name: b.name, flag: b.flag, ovr: b.ovr, isFcm: b.isFcm, def: b.def, mid: b.mid, att: b.att } : null,
      single: !!single,
      legs: [],        // {gh,ga} je Leg
      winner: null,
    };
  }

  // Spielt eine K.-o.-Runde (alle Ties). FCM-Tie wird mit fcmResult versorgt,
  // sonst (für FCM ohne Ergebnis) wird der Tie offengelassen.
  // legResult: {leg:1|2, fcm, opp} für FCM, oder null für reine Simulation.
  // autoSim=true simuliert auch FCM-Ties (für Wettbewerbe ohne FCM-Beteiligung
  // oder zum kompletten Durchrechnen).
  function playKnockoutRound(key, fcmLegResult, autoSim) {
    const ko = euroState().knockout && euroState().knockout[key];
    if (!ko || ko.done) return null;
    const round = ko.currentRound;
    const ties = ko.rounds[round];
    const single = (round === 'finale');

    ties.forEach(tie => {
      if (tie.winner) return;
      if (!tie.teamA || !tie.teamB) { tie.winner = tie.teamA || tie.teamB; return; }
      const isFcmTie = tie.teamA.isFcm || tie.teamB.isFcm;
      if (isFcmTie && !fcmLegResult && !autoSim) return;   // FCM interaktiv → offen lassen

      if (single) {
        // Finale: ein Spiel, ggf. Verlängerung/Elfmeter → kein Unentschieden
        let gh, ga;
        if (isFcmTie && fcmLegResult) {
          if (tie.teamA.isFcm) { gh = fcmLegResult.fcm; ga = fcmLegResult.opp; }
          else { gh = fcmLegResult.opp; ga = fcmLegResult.fcm; }
        } else {
          const r = quickSimResult(tie.teamA, tie.teamB); gh = r[0]; ga = r[1];
        }        tie.legs = [{ gh, ga }];
        let wA = gh > ga;
        if (gh === ga) wA = penaltyShootout(tie.teamA, tie.teamB);  // Elfmeter
        tie.winner = wA ? tie.teamA : tie.teamB;
      } else {
        // Hin- und Rückspiel
        const r1 = quickSimResult(tie.teamA, tie.teamB);
        const r2 = quickSimResult(tie.teamB, tie.teamA);
        tie.legs = [{ gh: r1[0], ga: r1[1] }, { gh: r2[0], ga: r2[1] }];
        const aggA = r1[0] + r2[1];   // A: heim Hin + auswärts Rück
        const aggB = r1[1] + r2[0];
        let wA = aggA > aggB;
        if (aggA === aggB) wA = penaltyShootout(tie.teamA, tie.teamB);
        tie.winner = wA ? tie.teamA : tie.teamB;
      }
    });

    // Runde fertig?
    if (ties.every(t => t.winner)) {
      advanceKnockoutRound(ko);
    }
    return ko;
  }

  function penaltyShootout(a, b) {
    // leicht stärkeabhängig, sonst Münzwurf
    const pa = 0.5 + ((a.ovr || 70) - (b.ovr || 70)) / 100;
    return Math.random() < Math.max(0.3, Math.min(0.7, pa));
  }

  // Baut die nächste Runde aus den Siegern.
  function advanceKnockoutRound(ko) {
    const order = KO_ROUNDS;
    const idx = order.indexOf(ko.currentRound);
    const winners = ko.rounds[ko.currentRound].map(t => t.winner);

    if (ko.currentRound === 'playoff') {
      // 8 Playoff-Sieger + Top8 → 16er-Feld fürs Achtelfinale
      const af = ko.seeds.top8.concat(winners);
      const pairs = [];
      // gesetzt (Top8) vs Playoff-Sieger
      for (let i = 0; i < 8; i++) pairs.push(makeTie(af[i], af[8 + i], 'achtelfinale'));
      ko.rounds.achtelfinale = pairs;
      ko.currentRound = 'achtelfinale';
      return;
    }
    if (ko.currentRound === 'finale') {
      ko.winner = winners[0];
      ko.done = true;
      return;
    }
    // generisch: Sieger paarweise weiter
    const nextRound = order[idx + 1];
    const pairs = [];
    for (let i = 0; i < winners.length; i += 2) {
      pairs.push(makeTie(winners[i], winners[i + 1], nextRound, nextRound === 'finale'));
    }
    ko.rounds[nextRound] = pairs;
    ko.currentRound = nextRound;
  }

  // FCMs aktueller K.-o.-Gegner (oder null).
  function fcmKnockoutTie(key) {
    const ko = euroState().knockout && euroState().knockout[key];
    if (!ko || ko.done) return null;
    const tie = (ko.rounds[ko.currentRound] || []).find(t =>
      !t.winner && t.teamA && t.teamB && (t.teamA.isFcm || t.teamB.isFcm));
    if (!tie) return null;
    const fcmIsA = tie.teamA.isFcm;
    return { round: ko.currentRound, label: KO_LABEL[ko.currentRound],
             opponent: fcmIsA ? tie.teamB : tie.teamA, single: tie.single, tie };
  }

  // Simuliert den kompletten Wettbewerb bis zum Sieger (ohne FCM-Interaktion).
  // Praktisch für Testzwecke und für Wettbewerbe, in denen FCM nicht spielt.
  function autoCompleteKnockout(key) {
    let ko = euroState().knockout && euroState().knockout[key];
    if (!ko) ko = buildKnockout(key);
    let guard = 0;
    while (ko && !ko.done && guard < 10) { playKnockoutRound(key, null, true); guard++; }
    return ko;
  }

  Object.assign(window.EuroCompetitions, {
    buildKnockout, playKnockoutRound, fcmKnockoutTie, autoCompleteKnockout,
    KO_ROUNDS, KO_LABEL,
  });

  console.log('[EuroCompetitions] Etappe 3 aktiv — K.-o.-Phase (Playoff → Finale)');
})();


/* ---------- js/euro_ui_patch.js ---------- */
/* ===== euro_ui_patch.js =====
   ETAPPE 4 (UI) — Darstellung der internationalen Wettbewerbe
   - "Europa"-Reiter: pro Wettbewerb (CL/EL/CO) Tabelle + K.-o.-Baum
   - Tabelle mit Zonen: Platz 1-8 (grün, Achtelfinale), 9-24 (gelb, Playoff),
     25-36 (rot, ausgeschieden). FCM hervorgehoben.
   - Zeigt FCMs aktuellen Wettbewerb und nächstes Europa-Spiel.
   Lädt nach euro_competitions_patch.js und app_main.js.
   ============================================================================= */
(function () {
  'use strict';

  let CUR_COMP = 'cl';     // aktuell angezeigter Wettbewerb
  let CUR_PHASE = 'tabelle';

  const COMP_NAME = { cl: 'Champions League', el: 'Europa League', co: 'Conference League' };
  const COMP_ICON = { cl: '🏆', el: '🥈', co: '🥉' };

  function EC() { return window.EuroCompetitions; }
  function euro() { return (typeof CLUB !== 'undefined' && CLUB.euro) ? CLUB.euro : null; }

  // ── Haupt-Render ────────────────────────────────────────────────────────────
  function renderEuropaTab() {
    const st = euro();
    const header = document.getElementById('eu-header');
    if (!header) return;

    if (!st || !st.competitions) {
      header.innerHTML = `<div class="eu-empty">
        <div style="font-size:15px;font-weight:700;margin-bottom:6px"><i class="ti ti-world"></i> Internationale Wettbewerbe</div>
        <div style="color:var(--text2);font-size:12px">Die europäische Saison startet nach der Qualifikation.</div></div>`;
      ['tabelle','ko'].forEach(p => { const el = document.getElementById('eu-sub-'+p); if (el) el.innerHTML = ''; });
      return;
    }

    // FCM-Wettbewerb hervorheben
    const fcmComp = st.fcmComp;
    let fcmInfo = '';
    if (fcmComp) {
      const fx = EC().fcmEuroFixtureForMatchday ? EC().fcmEuroFixtureForMatchday(fcmComp) : null;
      const tie = EC().fcmKnockoutTie ? EC().fcmKnockoutTie(fcmComp) : null;
      let nextTxt = '';
      if (fx) {
        nextTxt = `Nächstes Spiel (Ligaphase, Spieltag ${fx.matchday}): ${fx.isHome ? 'gegen' : 'bei'} ${fx.opponent.flag || ''} ${fx.opponent.name}`;
      } else if (tie) {
        nextTxt = `${tie.label}: ${tie.opponent.flag || ''} ${tie.opponent.name}`;
      }
      fcmInfo = `<div class="eu-fcm-badge">
        <span style="font-size:18px">${COMP_ICON[fcmComp]}</span>
        <div><b>${CLUB.name || 'Dein Verein'}</b> spielt in der <b>${COMP_NAME[fcmComp]}</b>
        ${nextTxt ? `<div style="font-size:11px;color:var(--text2);margin-top:2px">${nextTxt}</div>` : ''}</div>
      </div>`;
    } else {
      // Rückmeldung 18.10.: kein Erklärsatz, gut lesbar
      fcmInfo = `<div class="eu-nicht-dabei"><i class="ti ti-world-off" aria-hidden="true"></i> Diese Saison nicht international dabei</div>`;
    }

    header.innerHTML = `<div style="font-size:15px;font-weight:700;margin-bottom:8px"><i class="ti ti-world"></i> Internationale Wettbewerbe · Saison ${seasonYearLabel(st.season || LEAGUE.season)}</div>${fcmInfo}`;

    // Falls FCM in einem Wettbewerb ist, diesen als Default zeigen
    if (fcmComp && CUR_COMP !== fcmComp && !st._userPickedComp) CUR_COMP = fcmComp;
    syncCompTabs();
    renderEuroPhase();
  }

  // ── Tabelle eines Wettbewerbs ───────────────────────────────────────────────
  function renderEuroTable() {
    const el = document.getElementById('eu-sub-tabelle');
    if (!el) return;
    const st = euro();
    if (!st || !st.leaguePhase || !st.leaguePhase[CUR_COMP]) {
      el.innerHTML = `<div style="color:var(--text3);font-size:12px;padding:12px">
        Die Ligaphase der ${COMP_NAME[CUR_COMP]} hat noch nicht begonnen.</div>`;
      return;
    }
    const table = EC().leaguePhaseTable(CUR_COMP);
    const rows = table.map((t, i) => {
      const pos = i + 1;
      let zone = '';
      if (pos <= 8) zone = 'eu-zone-af';        // Achtelfinale direkt
      else if (pos <= 24) zone = 'eu-zone-po';  // Playoff
      else zone = 'eu-zone-out';                // raus
      const fcm = t.isFcm ? 'eu-row-fcm' : '';
      return `<tr class="${zone} ${fcm} eu-clickrow" onclick="showEuroTeamProfile('${t.id}')">
        <td class="eu-pos">${pos}</td>
        <td class="eu-team">${t.flag || ''} ${t.name}${t.isFcm ? ' <b>(du)</b>' : ''}</td>
        <td>${t.played}</td>
        <td>${t.w}</td><td>${t.d}</td><td>${t.l}</td>
        <td>${t.gf}:${t.ga}</td>
        <td class="eu-gd">${t.gf - t.ga >= 0 ? '+' : ''}${t.gf - t.ga}</td>
        <td class="eu-pts"><b>${t.pts}</b></td>
        <td>${typeof teamFormDots === 'function' ? teamFormDots(t) : ''}</td>
      </tr>`;
    }).join('');

    el.innerHTML = `
      <div class="eu-legend">
        <span><span class="eu-dot eu-dot-af"></span>Platz 1-8: Achtelfinale</span>
        <span><span class="eu-dot eu-dot-po"></span>9-24: Playoff</span>
        <span><span class="eu-dot eu-dot-out"></span>25-36: ausgeschieden</span>
      </div>
      <table class="eu-table">
        <thead><tr><th>#</th><th style="text-align:left">Verein</th><th>Sp</th><th>S</th><th>U</th><th>N</th><th>Tore</th><th>Diff</th><th>Pkt</th><th>Form</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  // Mini-Vereinsprofil für Europapokal-Teams (Klick auf Tabellenzeile) — nutzt die
  // gleichen .tp-*-Styles wie die Liga.
  window.showEuroTeamProfile = function (teamId) {
    const st = euro();
    if (!st || !st.leaguePhase || !st.leaguePhase[CUR_COMP]) return;
    const tbl = EC().leaguePhaseTable(CUR_COMP);
    const idx = tbl.findIndex(t => t.id === teamId); if (idx < 0) return;
    const t = tbl[idx], pos = idx + 1;
    const ovr = t.ovr != null ? t.ovr : (t.str != null ? t.str : Math.round(((t.def || 60) + (t.mid || 60) + (t.att || 60)) / 3));
    const initials = (t.name || '?').replace(/[0-9.]/g, ' ').split(/[\s\-]+/).filter(Boolean).slice(0, 3).map(w => w[0]).join('').toUpperCase();
    const formHtml = (typeof teamFormDots === 'function') ? teamFormDots(t) : '';
    let ov = document.getElementById('team-profile-ov');
    if (!ov) { ov = document.createElement('div'); ov.id = 'team-profile-ov'; ov.className = 'tp-overlay'; ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); }); document.body.appendChild(ov); }
    ov.innerHTML = `<div class="tp-card">
      <div class="tp-head"><div class="tp-crest" style="${typeof crestStyle === 'function' ? crestStyle(t.id) : ''}">${initials}</div>
        <div class="tp-headmain"><div class="tp-name">${t.flag || ''} ${t.name}${t.isFcm ? ' <span style="color:var(--accent)">(du)</span>' : ''}</div>
        <div class="tp-sub">${pos}. Platz · ${COMP_NAME[CUR_COMP]}</div></div>
        <button class="tp-x" onclick="document.getElementById('team-profile-ov').remove()">✕</button></div>
      <div class="tp-stats">
        <div class="tp-stat"><div class="v">${ovr}</div><div class="l">Stärke</div></div>
        <div class="tp-stat"><div class="v">${t.pts}</div><div class="l">Punkte</div></div>
        <div class="tp-stat"><div class="v">${t.w}·${t.d}·${t.l}</div><div class="l">S·U·N</div></div>
        <div class="tp-stat"><div class="v">${t.gf}:${t.ga}</div><div class="l">Tore</div></div>
      </div>
      <div class="tp-formrow"><span class="tp-form-lbl">Form</span>${formHtml}</div>
    </div>`;
  };

  // ── K.-o.-Baum ──────────────────────────────────────────────────────────────
  function renderEuroKnockout() {
    const el = document.getElementById('eu-sub-ko');
    if (!el) return;
    const st = euro();
    const ko = st && st.knockout && st.knockout[CUR_COMP];
    if (!ko) {
      el.innerHTML = `<div style="color:var(--text3);font-size:12px;padding:12px">
        Die K.-o.-Phase der ${COMP_NAME[CUR_COMP]} beginnt nach der Ligaphase
        (Platz 1-8 direkt im Achtelfinale, 9-24 über die Playoffs).</div>`;
      return;
    }
    const order = EC().KO_ROUNDS;
    const cols = order.filter(r => ko.rounds[r]).map(round => {
      const ties = ko.rounds[round];
      const tieHtml = ties.map(tie => {
        const a = tie.teamA, b = tie.teamB;
        if (!a || !b) return '';
        const aWin = tie.winner && tie.winner.id === a.id;
        const bWin = tie.winner && tie.winner.id === b.id;
        let score = '';
        if (tie.legs && tie.legs.length) {
          if (tie.single) score = `${tie.legs[0].gh}:${tie.legs[0].ga}`;
          else {
            const aggA = tie.legs[0].gh + (tie.legs[1] ? tie.legs[1].ga : 0);
            const aggB = tie.legs[0].ga + (tie.legs[1] ? tie.legs[1].gh : 0);
            score = `${aggA}:${aggB}`;
          }
        }
        const fcmA = a.isFcm ? 'eu-ko-fcm' : '', fcmB = b.isFcm ? 'eu-ko-fcm' : '';
        return `<div class="eu-tie">
          <div class="eu-tie-team ${aWin ? 'eu-win' : ''} ${fcmA}">${a.flag || ''} ${shortName(a.name)}</div>
          <div class="eu-tie-score">${score || 'vs'}</div>
          <div class="eu-tie-team ${bWin ? 'eu-win' : ''} ${fcmB}">${b.flag || ''} ${shortName(b.name)}</div>
        </div>`;
      }).join('');
      return `<div class="eu-ko-col">
        <div class="eu-ko-title">${EC().KO_LABEL[round]}</div>
        ${tieHtml}
      </div>`;
    }).join('');

    let winnerBanner = '';
    if (ko.done && ko.winner) {
      winnerBanner = `<div class="eu-winner">${COMP_ICON[CUR_COMP]} Sieger: <b>${ko.winner.flag || ''} ${ko.winner.name}</b> ${COMP_ICON[CUR_COMP]}</div>`;
    }

    el.innerHTML = `${winnerBanner}<div class="eu-ko-wrap">${cols}</div>`;
  }

  function shortName(n) {
    if (!n) return '';
    if (window.KSVereinsnamen) n = KSVereinsnamen.text(n);   // erst neuer Name, dann kürzen (sonst bleibt „Borussia Möncheng…“ stehen)
    return n.length > 18 ? n.slice(0, 17) + '…' : n;
  }

  // ── Subtab-Umschaltung ──────────────────────────────────────────────────────
  function switchEuroComp(key, btn) {
    CUR_COMP = key;
    if (euro()) euro()._userPickedComp = true;
    if (btn) { document.querySelectorAll('#eu-comp-tabs .subtab').forEach(b => b.classList.remove('active')); btn.classList.add('active'); }
    renderEuroPhase();
  }
  function switchEuroPhase(phase, btn) {
    CUR_PHASE = phase;
    if (btn) { document.querySelectorAll('#eu-phase-tabs .subtab').forEach(b => b.classList.remove('active')); btn.classList.add('active'); }
    document.getElementById('eu-sub-tabelle').classList.toggle('active', phase === 'tabelle');
    document.getElementById('eu-sub-ko').classList.toggle('active', phase === 'ko');
    renderEuroPhase();
  }
  function syncCompTabs() {
    ['cl','el','co'].forEach(k => {
      const b = document.getElementById('eu-tab-'+k);
      if (b) b.classList.toggle('active', k === CUR_COMP);
    });
  }
  function renderEuroPhase() {
    if (CUR_PHASE === 'tabelle') renderEuroTable();
    else renderEuroKnockout();
    // beide rendern, damit Umschalten ohne Neuladen geht
    renderEuroTable(); renderEuroKnockout();
  }

  window.renderEuropaTab = renderEuropaTab;
  window.switchEuroComp = switchEuroComp;
  window.switchEuroPhase = switchEuroPhase;

  console.log('[EuroUI] aktiv — Europa-Reiter mit Tabelle & K.-o.-Baum');
})();


/* ---------- js/euro_integration_patch.js ---------- */
/* ===== euro_integration_patch.js =====
   ETAPPE 4 (Integration) — Europapokal in den Saisonablauf einhängen
   - Kalender-Konstanten aus dem Plan (BREAK/EURO/POKAL-Wochen)
   - Qualifikation beim Saisonstart
   - Zu den Europa-Kalenderwochen automatisch Ligaphase-Spieltage & K.-o.-Runden
     abwickeln, News dazu schreiben
   - (FCM-Spiele werden vorerst automatisch simuliert; die interaktive Anbindung
     an die Match-Engine folgt separat.)
   Lädt nach euro_competitions_patch.js, euro_ui_patch.js, app_main.js.
   ============================================================================= */
(function () {
  'use strict';

  // ── Kalender-Konstanten (aus dem finalen Plan) ──────────────────────────────
  const EURO_LEAGUE_WEEKS = [10, 12, 14, 16, 23, 24, 30, 31];      // 8 Ligaphase-Spieltage
  const EURO_KO_WEEKS = [32, 33, 36, 37, 40, 41, 44, 46, 49];       // Playoff h/r, AF h/r, VF h/r, HF h/r, Finale
  window.EURO_LEAGUE_WEEKS = EURO_LEAGUE_WEEKS;
  window.EURO_KO_WEEKS = EURO_KO_WEEKS;
  window.POKAL_WEEKS = [8, 15, 21, 29, 43, 48];
  window.BREAK_WEEKS = [1, 2, 3, 4, 5, 18, 26, 27, 34, 42];

  // K.-o.-Ablauf: welche Kalenderwoche löst welchen Schritt aus.
  // [Woche, Wettbewerbsrunde, leg] — leg 1=Hinspiel, 2=Rückspiel/Entscheidung
  const KO_SCHEDULE = [
    { week: 32, round: 'playoff', leg: 1 },
    { week: 33, round: 'playoff', leg: 2 },
    { week: 36, round: 'achtelfinale', leg: 1 },
    { week: 37, round: 'achtelfinale', leg: 2 },
    { week: 40, round: 'viertelfinale', leg: 1 },
    { week: 41, round: 'viertelfinale', leg: 2 },
    { week: 44, round: 'halbfinale', leg: 1 },
    { week: 46, round: 'halbfinale', leg: 2 },
    { week: 49, round: 'finale', leg: 1 },
  ];

  function EC() { return window.EuroCompetitions; }
  function euro() { return (typeof CLUB !== 'undefined' && CLUB.euro) ? CLUB.euro : null; }
  const COMP_NAME = { cl: 'Champions League', el: 'Europa League', co: 'Conference League' };
  const COMP_ICON = { cl: '🏆', el: '🥈', co: '🥉' };

  // ── PRÄMIEN (CL > EL > CO) ──────────────────────────────────────────────────
  // Antritt, pro Ligaphase-Punkt, und je erreichter K.-o.-Runde.
  const PRIZE = {
    cl: { entry: 15000000, win: 2800000, draw: 900000,
          ko: { playoff: 1000000, achtelfinale: 9500000, viertelfinale: 11000000,
                halbfinale: 12500000, finale: 15500000, titel: 25000000 } },
    el: { entry: 4300000, win: 450000, draw: 150000,
          ko: { playoff: 300000, achtelfinale: 1200000, viertelfinale: 1800000,
                halbfinale: 2500000, finale: 4600000, titel: 6000000 } },
    co: { entry: 3170000, win: 400000, draw: 133000,
          ko: { playoff: 200000, achtelfinale: 800000, viertelfinale: 1300000,
                halbfinale: 2000000, finale: 3000000, titel: 5000000 } },
  };

  function creditPrize(amount, label) {
    if (!amount || typeof CLUB === 'undefined') return;
    CLUB.budget = (CLUB.budget || 0) + amount;
    if (typeof addNews === 'function') {
      addNews('cup', '💰 Europapokal-Prämie', `${label}: ${formatEuro(amount)} fließen in die Vereinskasse.`);
    }
  }

  // ── isBreakWeek an den Plan angleichen ──────────────────────────────────────
  // (KW10 ist im neuen Plan KEINE Pause mehr — dort startet die Europa-Ligaphase.)
  if (typeof window.isBreakWeek === 'function') {
    window.isBreakWeek = function (week) { return window.BREAK_WEEKS.includes(week); };
    try { isBreakWeek = window.isBreakWeek; } catch (e) {}
  }

  // ── Qualifikation + Aufbau beim Saisonstart ─────────────────────────────────
  function setupEuroSeason() {
    if (!EC()) return;
    try {
      EC().qualifyForSeason();
      EC().buildLeaguePhase();
      // K.-o. wird erst nach der Ligaphase gebaut (in Woche 31 Abschluss)
      const st = euro();
      if (st) { st.leaguePhaseMatchdayIndex = 0; st.koBuilt = false; }
      const fcmComp = st ? st.fcmComp : null;
      if (typeof addNews === 'function') {
        if (fcmComp) {
          addNews('cup', `${COMP_ICON[fcmComp]} Europapokal: Qualifiziert!`,
            `${CLUB.name || 'Dein Verein'} spielt diese Saison in der ${COMP_NAME[fcmComp]}. Die Auslosung der Ligaphase steht — sieh im Europa-Reiter nach.`);
        } else {
          addNews('cup', '🌍 Europapokal', `${CLUB.name || 'Dein Verein'} ist diese Saison nicht international dabei.`);
        }
      }
      // Antrittsprämie
      if (fcmComp && PRIZE[fcmComp]) {
        creditPrize(PRIZE[fcmComp].entry, `Teilnahme an der ${COMP_NAME[fcmComp]}`);
      }
    } catch (e) { console.warn('[EuroInt] setup', e); }
  }

  // ── Einen Ligaphase-Spieltag in allen 3 Wettbewerben abwickeln ──────────────
  // Wenn FCM sein Spiel interaktiv spielt (euro_matchday_patch), wird dieser
  // Spieltag dort abgewickelt — hier dann NICHT automatisch simulieren.
  function runEuroLeagueMatchday() {
    const st = euro();
    if (!st || !st.leaguePhase) return;
    const fcmComp = st.fcmComp;
    // Interaktiv? Dann übernimmt das Matchday-Modul FCMs Wettbewerb komplett.
    if (window.EuroMatchdayActive && fcmComp) return;

    ['cl', 'el', 'co'].forEach(key => {
      // FCM-Spiel automatisch simulieren (interaktive Anbindung folgt separat)
      let fcmResult = null;
      if (key === fcmComp) {
        const fx = EC().fcmEuroFixtureForMatchday(key);
        if (fx) fcmResult = simulateFcmEuroGame(fx);
      }
      EC().simulateLeagueMatchday(key, fcmResult);
    });

    st.leaguePhaseMatchdayIndex = (st.leaguePhaseMatchdayIndex || 0) + 1;

    // FCM-Ergebnis als News
    if (fcmComp) reportFcmEuroLeagueResult(fcmComp);

    // Nach dem 8. Spieltag: K.-o. aufbauen
    if (st.leaguePhaseMatchdayIndex >= 8 && !st.koBuilt) {
      ['cl', 'el', 'co'].forEach(key => EC().buildKnockout(key));
      st.koBuilt = true;
      if (typeof addNews === 'function') {
        const tbl = fcmComp ? EC().leaguePhaseTable(fcmComp) : null;
        const rank = tbl ? (tbl.findIndex(t => t.isFcm) + 1) : 0;
        let msg = 'Die Ligaphasen sind abgeschlossen. Die K.-o.-Runden beginnen.';
        if (rank) {
          if (rank <= 8) msg = `Platz ${rank} in der Ligaphase — direkt im Achtelfinale! 🎉`;
          else if (rank <= 24) msg = `Platz ${rank} — ${CLUB.name || 'dein Verein'} muss in die Playoffs.`;
          else msg = `Platz ${rank} — leider in der Ligaphase ausgeschieden.`;
        }
        addNews('cup', '🌍 Ligaphase beendet', msg);
      }
    }
  }

  // ── Eine K.-o.-Runde abwickeln (für den jeweiligen Kalender-Schritt) ─────────
  function runEuroKnockout(step) {
    const st = euro();
    if (!st || !st.knockout) return;
    const fcmComp = st.fcmComp;
    // FCM spielt interaktiv? Dann FCMs Wettbewerb in dieser Runde nicht auto-auflösen.
    let fcmInteractiveThisStep = false;
    if (window.EuroMatchdayActive && fcmComp) {
      const ko = st.knockout[fcmComp];
      if (ko && !ko.done && ko.currentRound === step.round && EC().fcmKnockoutTie(fcmComp)) {
        fcmInteractiveThisStep = true;
      }
    }

    ['cl', 'el', 'co'].forEach(key => {
      if (key === fcmComp && fcmInteractiveThisStep) return;
      const ko = st.knockout[key];
      if (!ko || ko.done) return;
      if (ko.currentRound !== step.round) return;   // nur die passende Runde
      // Bei Hin/Rück: erst im 2. Leg (bzw. Finale) auflösen. Wir lösen die Runde
      // beim Rückspiel-Schritt komplett auf (leg 2), Hinspiel-Schritt = nur News.
      const isDecisive = step.leg === 2 || step.round === 'finale';
      if (!isDecisive) {
        if (key === fcmComp) reportFcmKoLeg(key, step, 1);
        return;
      }
      // FCM automatisch simulieren
      EC().playKnockoutRound(key, null, true);
      if (key === fcmComp) reportFcmKoResult(key, step);
    });

    // Finale-Sieger feiern
    if (step.round === 'finale') {
      ['cl', 'el', 'co'].forEach(key => {
        const ko = st.knockout[key];
        if (ko && ko.done && ko.winner && typeof addNews === 'function') {
          const won = ko.winner.isFcm;
          addNews('cup', `${COMP_ICON[key]} ${COMP_NAME[key]} — Finale`,
            won ? `SENSATION! ${CLUB.name || 'Dein Verein'} gewinnt die ${COMP_NAME[key]}! 🏆🎉`
                : `${ko.winner.flag || ''} ${ko.winner.name} gewinnt die ${COMP_NAME[key]}.`);
        }
      });
    }
  }

  // ── FCM-Spiel simulieren (Platzhalter bis interaktive Anbindung) ────────────
  function simulateFcmEuroGame(fx) {
    const fcmStr = fcmStrength();
    const oppStr = fx.opponent.ovr || 70;
    const res = (typeof quickSimResult === 'function')
      ? quickSimResult(
          fx.isHome ? { ovr: fcmStr, def: fcmStr, mid: fcmStr, att: fcmStr } : { ovr: oppStr, def: oppStr, mid: oppStr, att: oppStr },
          fx.isHome ? { ovr: oppStr, def: oppStr, mid: oppStr, att: oppStr } : { ovr: fcmStr, def: fcmStr, mid: fcmStr, att: fcmStr })
      : [1, 1];
    return fx.isHome ? { fcm: res[0], opp: res[1] } : { fcm: res[1], opp: res[0] };
  }

  function fcmStrength() {
    try {
      const fg = findFcmGroup(LEAGUE);
      const t = fg && fg.group.teams.find(x => x.id === 'fcm');
      return t ? (t.ovr || Math.round((t.def + t.mid + t.att) / 3)) : 72;
    } catch (e) { return 72; }
  }

  // ── News-Helfer ─────────────────────────────────────────────────────────────
  function reportFcmEuroLeagueResult(comp) {
    const st = euro();
    const phase = st.leaguePhase[comp];
    if (!phase) return;
    const lastMd = phase.fixtures[phase.nextMatchday - 1];
    if (!lastMd) return;
    const m = lastMd.find(x => x.home === 'fcm' || x.away === 'fcm');
    if (!m || !m.played) return;
    const home = m.home === 'fcm';
    const gf = home ? m.gh : m.ga, ga = home ? m.ga : m.gh;
    const oppId = home ? m.away : m.home;
    const opp = phase.standings.find(t => t.id === oppId);
    const outcome = gf > ga ? 'Sieg' : gf < ga ? 'Niederlage' : 'Remis';
    if (typeof addNews === 'function') {
      addNews('cup', `${COMP_ICON[comp]} ${outcome} in der ${COMP_NAME[comp]}`,
        `${CLUB.name || 'FCM'} ${home ? 'gegen' : 'bei'} ${opp ? (opp.flag || '') + ' ' + opp.name : 'Gegner'}: ${gf}:${ga}.`);
    }
    // Leistungsprämie (Sieg/Remis)
    const pr = PRIZE[comp];
    if (pr) {
      if (gf > ga) creditPrize(pr.win, `Sieg in der ${COMP_NAME[comp]}`);
      else if (gf === ga) creditPrize(pr.draw, `Remis in der ${COMP_NAME[comp]}`);
    }
  }

  function reportFcmKoLeg(comp, step, leg) {
    if (typeof addNews !== 'function') return;
    const tie = EC().fcmKnockoutTie(comp);
    if (!tie) return;
    addNews('cup', `${COMP_ICON[comp]} ${tie.label} (Hinspiel)`,
      `${CLUB.name || 'FCM'} trifft im ${tie.label} auf ${tie.opponent.flag || ''} ${tie.opponent.name}. Das Rückspiel entscheidet.`);
  }

  function reportFcmKoResult(comp, step) {
    if (typeof addNews !== 'function') return;
    const st = euro();
    const ko = st.knockout[comp];
    if (!ko) return;
    // die gerade abgeschlossene Runde finden (die, in der FCM war)
    const rounds = Object.keys(ko.rounds);
    for (const r of rounds) {
      const tie = ko.rounds[r].find(t => t.winner && (
        (t.teamA && t.teamA.isFcm) || (t.teamB && t.teamB.isFcm)));
      if (tie && (tie.teamA.isFcm || tie.teamB.isFcm)) {
        const fcmWon = tie.winner.isFcm;
        const opp = tie.teamA.isFcm ? tie.teamB : tie.teamA;
        if (r === ko.currentRound || fcmWon || ko.done) {
          addNews('cup', `${COMP_ICON[comp]} ${EC().KO_LABEL[r]}`,
            fcmWon ? `${CLUB.name || 'FCM'} setzt sich gegen ${opp.flag || ''} ${opp.name} durch und steht in der nächsten Runde! 🎉`
                   : `Aus im ${EC().KO_LABEL[r]}: ${CLUB.name || 'FCM'} scheidet gegen ${opp.flag || ''} ${opp.name} aus.`);
          // Rundenprämie fürs Erreichen der nächsten Stufe (nur bei Sieg)
          const pr = PRIZE[comp];
          if (fcmWon && pr && pr.ko) {
            const order = EC().KO_ROUNDS;
            const idx = order.indexOf(r);
            const nextRound = order[idx + 1];
            if (r === 'finale') {
              creditPrize(pr.ko.titel, `${COMP_NAME[comp]}-TITEL! 🏆`);
            } else if (nextRound && pr.ko[nextRound]) {
              creditPrize(pr.ko[nextRound], `Einzug ins ${EC().KO_LABEL[nextRound]} (${COMP_NAME[comp]})`);
            }
          }
        }
        break;
      }
    }
  }

  // ── HOOKS ────────────────────────────────────────────────────────────────
  // Saisonstart: Qualifikation
  if (typeof window.startNewSeason === 'function') {
    const _origSeason = window.startNewSeason;
    window.startNewSeason = function () {
      try { if (EC() && EC().abschlussMerken) EC().abschlussMerken(); } catch (e) { console.warn('[EuroInt] Abschluss', e); }
      const r = _origSeason.apply(this, arguments);
      setupEuroSeason();
      return r;
    };
    try { startNewSeason = window.startNewSeason; } catch (e) {}
  }

  // Wochen-Tick: Europa-Spieltage/Runden abwickeln
  if (typeof window.advanceCalendarWeek === 'function') {
    const _origAdvance = window.advanceCalendarWeek;
    window.advanceCalendarWeek = function () {
      const week = (typeof LEAGUE !== 'undefined') ? LEAGUE.week : 0;
      const ok = _origAdvance.apply(this, arguments);
      if (ok !== false) {
        try {
          const newWeek = LEAGUE.week;
          if (EURO_LEAGUE_WEEKS.includes(newWeek)) runEuroLeagueMatchday();
          const koStep = KO_SCHEDULE.find(s => s.week === newWeek);
          if (koStep) runEuroKnockout(koStep);
        } catch (e) { console.warn('[EuroInt] week', e); }
      }
      return ok;
    };
    try { advanceCalendarWeek = window.advanceCalendarWeek; } catch (e) {}
  }

  // Beim ersten Laden (falls schon eine Saison läuft, aber noch kein Euro existiert)
  function initIfNeeded() {
    if (typeof CLUB !== 'undefined' && CLUB && typeof LEAGUE !== 'undefined' && LEAGUE && !CLUB.euro) {
      setupEuroSeason();
    }
  }
  if (typeof window !== 'undefined') {
    const _origAfter = window._afterLoad;
    if (typeof _origAfter === 'function') {
      window._afterLoad = function () { const r = _origAfter.apply(this, arguments); try { initIfNeeded(); } catch (e) {} return r; };
      try { _afterLoad = window._afterLoad; } catch (e) {}
    }
  }

  window.EuroIntegration = { setupEuroSeason, runEuroLeagueMatchday, runEuroKnockout,
    EURO_LEAGUE_WEEKS, EURO_KO_WEEKS, KO_SCHEDULE };
  console.log('[EuroIntegration] aktiv — Europapokal in den Saisonablauf integriert');
})();


/* ---------- js/euro_matchday_patch.js ---------- */
/* ===== euro_matchday_patch.js =====
   ETAPPE 6 — Internationale Spiele interaktiv spielbar machen
   - In Europa-Kalenderwochen wird FCMs Europa-Gegner als Spiel geladen
     (Vorrang-Logik: Europa-Woche → Europa-Spiel).
   - Nach dem Spiel wird das Ergebnis an das Euro-System zurückgemeldet
     (Ligaphase-Spieltag oder K.-o.-Leg), statt automatisch zu simulieren.
   - Die restlichen Partien des Spieltags werden weiterhin simuliert.
   Lädt nach euro_integration_patch.js und app_main.js.
   ============================================================================= */
(function () {
  'use strict';

  function EC() { return window.EuroCompetitions; }
  function euro() { return (typeof CLUB !== 'undefined' && CLUB.euro) ? CLUB.euro : null; }
  const COMP_NAME = { cl: 'Champions League', el: 'Europa League', co: 'Conference League' };

  const LEAGUE_WEEKS = () => window.EURO_LEAGUE_WEEKS || [10, 12, 14, 16, 23, 24, 30, 31];
  const KO_SCHEDULE = () => (window.EuroIntegration && window.EuroIntegration.KO_SCHEDULE) || [];

  // Steht diese Woche ein FCM-Europaspiel an? Liefert {kind, comp, ...} oder null.
  function fcmEuroThisWeek() {
    const st = euro();
    if (!st || !st.fcmComp) return null;
    const week = (typeof LEAGUE !== 'undefined') ? LEAGUE.week : 0;
    const comp = st.fcmComp;
    // Kickstil-Fix Doppelwoche: nach dem Europaspiel liefert fcmEuroFixtureForMatchday schon die NÄCHSTE Partie –
    // in derselben Woche also kein zweites Europaspiel (danach kommt das Ligaspiel dieser Woche)
    if (st.ksGespielt && st.ksGespielt.w === week && st.ksGespielt.s === LEAGUE.season) return null;

    // Ligaphase-Woche?
    if (LEAGUE_WEEKS().includes(week)) {
      const fx = EC().fcmEuroFixtureForMatchday(comp);
      if (fx) return { kind: 'league', comp, fx };
    }
    // K.-o.-Woche?
    const step = KO_SCHEDULE().find(s => s.week === week);
    if (step) {
      const tie = EC().fcmKnockoutTie(comp);
      if (tie && tie.round === step.round) return { kind: 'ko', comp, tie, step };
    }
    return null;
  }

  // Baut aus dem Euro-Gegner ein Fixture-Spec für die Match-Engine.
  function euroFixtureSpec() {
    const info = fcmEuroThisWeek();
    if (!info) return null;
    if (info.kind === 'league') {
      return {
        type: 'euro', euroKind: 'league', comp: info.comp,
        opponentId: info.fx.opponent.id, isHome: info.fx.isHome,
        opponentTeam: info.fx.opponent,
        label: `${COMP_NAME[info.comp]} · Spieltag ${info.fx.matchday}`,
      };
    }
    // K.-o.: Hin-/Rückspiel. Heimrecht: Hinspiel FCM auswärts oder heim je Zufall,
    // wir setzen Leg 1 = Heim, Leg 2 = Auswärts (einfach & nachvollziehbar);
    // Finale = neutral (isHome leicht bevorzugt).
    const leg = info.step.leg;
    const single = (info.step.round === 'finale');
    return {
      type: 'euro', euroKind: 'ko', comp: info.comp, round: info.step.round, leg, single,
      opponentId: info.tie.opponent.id, isHome: single ? true : (leg === 1),
      opponentTeam: info.tie.opponent,
      label: `${COMP_NAME[info.comp]} · ${info.tie.label}${single ? '' : (leg === 1 ? ' (Hinspiel)' : ' (Rückspiel)')}`,
    };
  }

  // Ist FCM diese Saison noch im Europapokal (auch wenn das nächste Spiel/Finale
  // erst in einer späteren Woche ansteht)? → Saison darf dann nicht enden, sonst
  // fällt das Europa-Finale (Woche 49, nach Liga-Ende) weg. Analog zum Pokal.
  // Kickstil: Europaspiel dieser Woche (null, wenn keins ansteht oder schon gespielt) – für Haupt-Button und „Simulieren bis …“
  window.fcmEuroDieseWoche = function () { try { return fcmEuroThisWeek(); } catch (e) { return null; } };
  window.fcmInEuro = function () {
    try {
      const st = euro();
      if (!st || !st.fcmComp) return false;
      if (!st.koBuilt) return true;                     // Ligaphase läuft noch
      const tie = EC().fcmKnockoutTie ? EC().fcmKnockoutTie(st.fcmComp) : null;
      return !!tie;                                     // in der K.-o.-Phase noch drin?
    } catch (e) { return false; }
  };

  // ── Hook: ensureFixtureLoaded — Europa-Spiele haben in ihren Wochen Vorrang ──
  if (typeof window.ensureFixtureLoaded === 'function') {
    const _orig = window.ensureFixtureLoaded;
    window.ensureFixtureLoaded = function () {
      try {
        const spec = euroFixtureSpec();
        if (spec && typeof goToFixture === 'function') {
          goToFixture(spec);
          return;
        }
      } catch (e) { console.warn('[EuroMatch] load', e); }
      return _orig.apply(this, arguments);
    };
    try { ensureFixtureLoaded = window.ensureFixtureLoaded; } catch (e) {}
  }

  // ── Hook: goToFixture — Europa-Gegner setzen (setOpponent braucht {name,ovr}) ─
  if (typeof window.goToFixture === 'function') {
    const _origGo = window.goToFixture;
    window.goToFixture = function (spec) {
      if (spec && spec.type === 'euro') {
        const team = spec.opponentTeam || (EC() && findEuroTeam(spec.opponentId));
        if (!team) { console.warn('[EuroMatch] kein Gegner', spec); return _origGo.apply(this, arguments); }
        // Kickstil-Fix: CURRENT_FIXTURE/FCM_IS_HOME sind `let` (engine_main.js) und hängen NICHT an window – window.* legte
        // eine zweite, unsichtbare Variable an; der Anpfiff (Engine v3) fand kein Spiel („Kein Spiel geladen“).
        CURRENT_FIXTURE = spec; FCM_IS_HOME = spec.isHome;
        if (typeof window.resetMatchState === 'function') window.resetMatchState();
        if (typeof window.setOpponent === 'function') window.setOpponent({ name: team.name, ovr: team.ovr || 72 });
        if (typeof window.syncClubToTeams === 'function') window.syncClubToTeams();
        document.querySelectorAll('.appnav-btn').forEach(b => b.classList.remove('active'));
        const nm = document.getElementById('nav-match'); if (nm) nm.classList.add('active');
        ['view-squad', 'view-liga', 'view-europa'].forEach(id => { const el = document.getElementById(id); if (el) el.classList.remove('active'); });
        const vm = document.getElementById('view-match'); if (vm) vm.classList.add('active');
        const flag = team.flag ? team.flag + ' ' : '';
        const cs = (typeof window.clubShort === 'function') ? window.clubShort() : 'FCM';
        if (typeof window.addEv === 'function') window.addEv('info', -1, `🌍 ${spec.label}: ${spec.isHome ? cs + ' vs ' + flag + team.name : flag + team.name + ' vs ' + cs}!`);
        return;
      }
      return _origGo.apply(this, arguments);
    };
    try { goToFixture = window.goToFixture; } catch (e) {}
  }

  function findEuroTeam(id) {
    const clubs = EC() && EC().euroClubs ? EC().euroClubs() : [];
    return clubs.find(c => c.id === id) || null;
  }

  // ── Hook: Spielende — Europa-Ergebnis zurückmelden ──────────────────────────
  // processFixtureResult verarbeitet das Ergebnis; wir umhüllen es und fangen 'euro' ab.
  if (typeof window.processFixtureResult === 'function') {
    const _origFinish = window.processFixtureResult;
    window.processFixtureResult = function () {
      const fx = (typeof CURRENT_FIXTURE !== 'undefined') ? CURRENT_FIXTURE : null;
      if (fx && fx.type === 'euro') {
        try { handleEuroResult(fx); } catch (e) { console.warn('[EuroMatch] finish', e); }
        try { const st = euro(); if (st) st.ksGespielt = { w: LEAGUE.week, s: LEAGUE.season }; } catch (e) { /* Merker optional */ }
        CURRENT_FIXTURE = null;
        if (typeof renderAll === 'function') renderAll();
        if (typeof renderEuropaTab === 'function') renderEuropaTab();
        return;
      }
      return _origFinish.apply(this, arguments);
    };
    try { processFixtureResult = window.processFixtureResult; } catch (e) {}
  }

  // Verarbeitet das FCM-Europaergebnis und wickelt den Rest des Spieltags ab.
  // WICHTIG: Die Engine stellt FCM IMMER als G.homeGoals dar (FCM_IS_HOME ist nur
  // Label/Momentum) — daher fcmGoals = G.homeGoals, oppGoals = G.awayGoals.
  function handleEuroResult(fx) {
    const fcmGoals = (typeof G !== 'undefined' && G) ? G.homeGoals : 0;
    const oppGoals = (typeof G !== 'undefined' && G) ? G.awayGoals : 0;
    const scoreStr = `${fcmGoals}:${oppGoals}`;
    const team = fx.opponentTeam || {};
    const oppName = (team.flag ? team.flag + ' ' : '') + (team.name || 'Gegner');

    if (fx.euroKind === 'league') {
      // Nur FCMs Wettbewerb hier abwickeln (FCM-Ergebnis + restliche Partien).
      // Die anderen beiden Wettbewerbe übernimmt das Integrationsmodul.
      EC().simulateLeagueMatchday(fx.comp, { fcm: fcmGoals, opp: oppGoals });
      runOtherEuroLeagues(fx.comp);
      const st = euro();
      st.leaguePhaseMatchdayIndex = (st.leaguePhaseMatchdayIndex || 0) + 1;
      const outcome = fcmGoals > oppGoals ? 'Sieg' : fcmGoals < oppGoals ? 'Niederlage' : 'Remis';
      addNews('cup', `🌍 ${outcome}: ${clubShort()} ${scoreStr} ${team.name || ''}`,
        `${COMP_NAME[fx.comp]}, Ligaphase: ${fx.isHome ? 'gegen' : 'bei'} ${oppName} gab es ein ${scoreStr}.`);
      payEuroLeaguePrize(fx.comp, fcmGoals, oppGoals);
      // Nach 8 Spieltagen K.-o. aufbauen
      if (st.leaguePhaseMatchdayIndex >= 8 && !st.koBuilt) {
        ['cl', 'el', 'co'].forEach(k => EC().buildKnockout(k));
        st.koBuilt = true;
        announceLeaguePhaseEnd(fx.comp);
      }
    } else if (fx.euroKind === 'ko') {
      handleEuroKoResult(fx, fcmGoals, oppGoals, oppName, scoreStr);
    }
  }

  // K.-o.-Ergebnis: Leg speichern; bei entscheidendem Leg Tie auflösen.
  // Alle Tore aus FCM-Sicht (fcmGoals/oppGoals), da die Engine FCM immer als
  // homeGoals darstellt. Aggregat über beide Legs.
  function handleEuroKoResult(fx, fcmGoals, oppGoals, oppName, scoreStr) {
    const st = euro();
    const ko = st.knockout[fx.comp];
    if (!ko) return;
    const tieObj = (ko.rounds[fx.round] || []).find(t =>
      !t.winner && ((t.teamA && t.teamA.isFcm) || (t.teamB && t.teamB.isFcm)));
    if (!tieObj) return;

    const fcmIsA = tieObj.teamA.isFcm;
    // Leg immer aus FCM-Sicht speichern: {fcm, opp}
    tieObj.fcmLegs = tieObj.fcmLegs || [];
    tieObj.fcmLegs.push({ fcm: fcmGoals, opp: oppGoals });
    // Für die Anzeige im K.-o.-Baum auch legs (Gastgeber-Sicht) füllen
    tieObj.legs = tieObj.legs || [];
    tieObj.legs.push(fx.isHome ? { gh: fcmGoals, ga: oppGoals } : { gh: oppGoals, ga: fcmGoals });

    const decisive = fx.single || fx.leg === 2;
    if (!decisive) {
      addNews('cup', `🌍 ${COMP_NAME[fx.comp]} · Hinspiel ${scoreStr}`,
        `${clubShort()} ${fx.isHome ? 'gegen' : 'bei'} ${oppName}: ${scoreStr}. Das Rückspiel entscheidet.`);
      // Die anderen Wettbewerbe laufen bei Hinspiel-Wochen NICHT weiter (ihre
      // Legs werden im entscheidenden Schritt vom Integrationsmodul abgewickelt).
      return;
    }

    // Entscheidung: Aggregat über alle FCM-Legs
    let fcmAgg = 0, oppAgg = 0;
    tieObj.fcmLegs.forEach(l => { fcmAgg += l.fcm; oppAgg += l.opp; });
    let fcmWon = fcmAgg > oppAgg;
    if (fcmAgg === oppAgg) fcmWon = Math.random() < 0.5;   // Elfmeter
    tieObj.winner = fcmWon ? (fcmIsA ? tieObj.teamA : tieObj.teamB)
                           : (fcmIsA ? tieObj.teamB : tieObj.teamA);

    // Restliche Ties dieser Runde (ohne FCM) simulieren
    EC().playKnockoutRound(fx.comp, null, true);
    // die anderen Wettbewerbe für dieselbe Runde ebenfalls
    ['cl', 'el', 'co'].forEach(k => {
      if (k === fx.comp) return;
      const oko = st.knockout[k];
      if (oko && !oko.done && oko.currentRound === fx.round) EC().playKnockoutRound(k, null, true);
    });

    const opp = fcmIsA ? tieObj.teamB : tieObj.teamA;
    if (fcmWon) {
      addNews('cup', `🌍 ${COMP_NAME[fx.comp]}: Weiter!`,
        `${clubShort()} setzt sich gegen ${(opp.flag || '') + ' ' + opp.name} durch (Gesamt ${fcmAgg}:${oppAgg}) und steht in der nächsten Runde! 🎉`);
      payEuroKoPrize(fx.comp, fx.round);
      if (fx.round === 'finale') {
        addNews('cup', `🏆 ${COMP_NAME[fx.comp]}-SIEGER!`, `SENSATION! ${CLUB.name || 'Dein Verein'} gewinnt die ${COMP_NAME[fx.comp]}! 🏆🎉`);
      }
    } else {
      addNews('cup', `🌍 ${COMP_NAME[fx.comp]}: Aus`,
        `${clubShort()} scheidet gegen ${(opp.flag || '') + ' ' + opp.name} aus (Gesamt ${fcmAgg}:${oppAgg}).`);
    }
  }

  // ── Prämien (spiegelt die Sätze aus euro_integration) ───────────────────────
  function prizeTable() {
    return (window.EuroIntegration && window.EuroIntegration._PRIZE) || null;
  }
  function payEuroLeaguePrize(comp, gf, ga) {
    // greift auf dieselbe Logik zu, falls exportiert; sonst simple Beträge
    const P = { cl: { win: 2800000, draw: 900000 }, el: { win: 450000, draw: 150000 }, co: { win: 400000, draw: 133000 } }[comp];
    if (!P) return;
    if (gf > ga) creditEuro(P.win, `Sieg in der ${COMP_NAME[comp]}`);
    else if (gf === ga) creditEuro(P.draw, `Remis in der ${COMP_NAME[comp]}`);
  }
  function payEuroKoPrize(comp, round) {
    const KO = {
      cl: { achtelfinale: 9500000, viertelfinale: 11000000, halbfinale: 12500000, finale: 15500000, titel: 25000000 },
      el: { achtelfinale: 1200000, viertelfinale: 1800000, halbfinale: 2500000, finale: 4600000, titel: 6000000 },
      co: { achtelfinale: 800000, viertelfinale: 1300000, halbfinale: 2000000, finale: 3000000, titel: 5000000 },
    }[comp];
    if (!KO) return;
    const order = ['playoff', 'achtelfinale', 'viertelfinale', 'halbfinale', 'finale'];
    const idx = order.indexOf(round);
    if (round === 'finale') { creditEuro(KO.titel, `${COMP_NAME[comp]}-TITEL! 🏆`); return; }
    const next = order[idx + 1];
    if (next && KO[next]) creditEuro(KO[next], `Einzug ins ${labelOf(next)} (${COMP_NAME[comp]})`);
  }
  function labelOf(r) { return (EC() && EC().KO_LABEL[r]) || r; }
  function creditEuro(amount, label) {
    if (!amount) return;
    CLUB.budget = (CLUB.budget || 0) + amount;
    addNews('cup', '💰 Europapokal-Prämie', `${label}: ${formatEuro(amount)} für die Vereinskasse.`);
  }

  function announceLeaguePhaseEnd(comp) {
    const tbl = EC().leaguePhaseTable(comp);
    const rank = tbl.findIndex(t => t.isFcm) + 1;
    let msg = 'Die Ligaphase ist abgeschlossen.';
    if (rank >= 1 && rank <= 8) msg = `Platz ${rank} — direkt im Achtelfinale! 🎉`;
    else if (rank <= 24) msg = `Platz ${rank} — auf in die Playoffs.`;
    else if (rank) msg = `Platz ${rank} — leider ausgeschieden.`;
    addNews('cup', '🌍 Ligaphase beendet', msg);
  }

  // Wickelt die anderen beiden Wettbewerbe (nicht FCMs) um einen Spieltag ab.
  function runOtherEuroLeagues(fcmComp) {
    ['cl', 'el', 'co'].forEach(k => { if (k !== fcmComp) EC().simulateLeagueMatchday(k, null); });
  }

  console.log('[EuroMatchday] aktiv — internationale Spiele interaktiv spielbar');
  window.EuroMatchdayActive = true;
})();


/* ---------- js/league_browser_patch.js ---------- */
/* ===== league_browser_patch.js =====
   Ermöglicht, im Liga-Reiter zwischen allen deutschen Ligen zu wechseln und die
   fremden Tabellen (2. Liga, 3. Liga, Regionalliga …) einzusehen — nicht nur die
   eigene. Fügt eine Liga-Auswahl über der Tabelle ein.
   Lädt nach app_main.js.
   ============================================================================= */
(function () {
  'use strict';

  let SELECTED = null;   // null = FCMs eigene Liga; sonst {key, groupIndex}

  const TIER_LABEL = {
    bundesliga: 'Bundesliga', bundesliga2: '2. Bundesliga',
    liga3: '3. Liga', regionalliga: 'Regionalliga',
  };

  function groupsOfTier(tierKey) {
    if (!LEAGUE || !LEAGUE.tiers || !LEAGUE.tiers[tierKey]) return [];
    return LEAGUE.tiers[tierKey].groups || [];
  }

  // Baut die Auswahlleiste (Chips) für alle Ligen.
  function buildSelector() {
    if (!LEAGUE || !LEAGUE.tiers) return '';
    const fg = findFcmGroup(LEAGUE);
    const chips = [];
    // Rückmeldung 18.10.: Regionalligen nicht mehr zeigen (nur Unterbau, dort spielt man nie)
    Object.keys(LEAGUE.tiers).filter(k => k !== 'regionalliga').forEach(tierKey => {
      const groups = groupsOfTier(tierKey);
      groups.forEach((g, gi) => {
        const isFcmGroup = g.teams.some(t => t.id === 'fcm');
        const active = SELECTED
          ? (SELECTED.key === tierKey && SELECTED.groupIndex === gi)
          : isFcmGroup;
        const label = groups.length > 1 ? `${TIER_LABEL[tierKey] || tierKey} · ${g.name}` : (TIER_LABEL[tierKey] || tierKey);
        chips.push(`<button class="lgb-chip ${active ? 'active' : ''}" onclick="selectBrowseLeague('${tierKey}',${gi})">${isFcmGroup ? '<i class="ti ti-star-filled" aria-hidden="true"></i> ' : ''}${label}</button>`);
      });
    });
    return `<div class="lgb-selector">${chips.join('')}</div>`;
  }

  // Rendert die Tabelle der aktuell gewählten Liga.
  function renderSelectedTable() {
    const el = document.getElementById('lg-sub-tabelle');
    if (!el || !LEAGUE) return;

    let group, tierKey;
    if (SELECTED) {
      const groups = groupsOfTier(SELECTED.key);
      group = groups[SELECTED.groupIndex];
      tierKey = SELECTED.key;
    } else {
      const fg = findFcmGroup(LEAGUE);
      group = fg.group; tierKey = fg.tierKey;
    }
    if (!group) { const fg = findFcmGroup(LEAGUE); group = fg.group; tierKey = fg.tierKey; }

    const tbl = computeTable(group.teams);
    const selector = buildSelector();
    const hasFcm = group.teams.some(t => t.id === 'fcm');
    const total = tbl.length;
    // Auf-/Abstiegs-/Europa-Zonen je Liga (spiegelt runEndOfSeason wider)
    const zoneOf = (pos) => {
      if (tierKey === 'bundesliga')  return pos <= 4 ? 'cl' : pos <= 6 ? 'el' : pos >= total - 1 ? 'rel' : '';
      if (tierKey === 'bundesliga2') return pos <= 2 ? 'promo' : pos >= total - 1 ? 'rel' : '';
      if (tierKey === 'liga3')       return pos <= 2 ? 'promo' : pos >= total - 3 ? 'rel' : '';
      if (tierKey === 'regionalliga')return pos === 1 ? 'promo' : '';
      return '';
    };

    el.innerHTML = selector +
      `<div class="lg-header" style="margin:8px 0"><h3 style="font-size:13px;font-weight:700">${group.name}</h3>` +
      `<span style="font-size:10px;color:var(--text2)">${TIER_LABEL[tierKey] || tierKey}</span></div>` +
      `<table class="lg-table"><thead><tr><th>#</th><th>Team</th><th class="num">Sp</th><th class="num">S</th><th class="num">U</th><th class="num">N</th><th class="num">Tore</th><th class="num">Diff</th><th class="num">Pkt</th><th>Form</th></tr></thead><tbody>` +
      tbl.map((t, i) => `<tr class="lg-clickrow ${t.id === 'fcm' ? 'fcm-row' : ''}" onclick="showTeamProfile('${t.id}')"><td class="lg-pos"><span class="lg-zone z-${zoneOf(i + 1)}"></span>${i + 1}</td><td><span class="lg-club"><span class="lg-crest" style="${typeof crestStyle === 'function' ? crestStyle(t.id) : ''}">${typeof crestInitials === 'function' ? crestInitials(t.name) : ''}</span><span class="lg-name">${t.name}</span></span></td><td class="num">${t.played}</td><td class="num">${t.w}</td><td class="num">${t.d}</td><td class="num">${t.l}</td><td class="num">${t.gf}:${t.ga}</td><td class="num">${t.gd > 0 ? '+' : ''}${t.gd}</td><td class="num">${t.pts}</td><td>${typeof teamFormDots === 'function' ? teamFormDots(t) : ''}</td></tr>`).join('') +
      `</tbody></table>`;
  }

  window.selectBrowseLeague = function (tierKey, groupIndex) {
    const fg = findFcmGroup(LEAGUE);
    // Wenn die gewählte Liga FCMs Liga ist → SELECTED zurücksetzen (eigene Ansicht)
    const groups = groupsOfTier(tierKey);
    const g = groups[groupIndex];
    if (g && g.teams.some(t => t.id === 'fcm')) SELECTED = null;
    else SELECTED = { key: tierKey, groupIndex };
    renderSelectedTable();
  };

  // Hook: renderLeagueTab neu rendern lassen (mit Auswahl)
  if (typeof window.renderLeagueTab === 'function') {
    const _orig = window.renderLeagueTab;
    window.renderLeagueTab = function () {
      _orig.apply(this, arguments);
      try { renderSelectedTable(); } catch (e) { console.warn('[LeagueBrowser]', e); }
    };
    try { renderLeagueTab = window.renderLeagueTab; } catch (e) {}
  }

  // CSS
  if (!document.getElementById('lgb-style')) {
    const s = document.createElement('style');
    s.id = 'lgb-style';
    s.textContent = `
      .lgb-selector { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:4px; }
      .lgb-chip { font-size:10px; padding:4px 10px; border-radius:14px; border:1px solid var(--border,#30363d);
        background:var(--bg3,#21262d); color:var(--text2,#8b949e); cursor:pointer; white-space:nowrap; transition:all .12s; }
      .lgb-chip:hover { border-color:var(--blue,#388bfd); color:var(--text,#e6edf3); }
      .lgb-chip.active { background:var(--blue,#388bfd); color:#fff; border-color:var(--blue,#388bfd); font-weight:600; }
    `;
    document.head.appendChild(s);
  }

  console.log('[LeagueBrowser] aktiv — andere Ligen im Liga-Reiter einsehbar');
})();

