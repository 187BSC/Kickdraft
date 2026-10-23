/* ═══════════════════════════════════════════════════════════════════════════
   DFL-HANDEL  ·  v1   (Trade-KI nach Football GM, analyse-football-gm.md G4)
   ─────────────────────────────────────────────────────────────────────────
     · Teamlage: Titel jetzt · Mittelfeld · Neuaufbau (aus Stärke-Rang und Alter)
     · Handelswert eines Spielers: Stärke (überproportional), Zukunft (Potenzial),
       Alter, Vertrag (günstig = wertvoll); gewichtet nach der Lage des Teams
     · Draft-Picks: Wert über den erwarteten Platz (Stärke-Rang des Teams),
       spätere Jahrgänge abgezinst
     · Bewertung eines Tauschs: Spec-Regel (Cap beider Teams danach ≤ Limit,
       sonst abgelehnt), Gegenwert mit kleiner Marge für die KI, Zurückhaltung
       bei Pick-Paketen, Hinweise zur Kadergröße
     · „Was müsste ich dazugeben?“ und Angebote für Spieler auf dem Trading Block
     · Ausführen: nicht amortisierter Signing Bonus bleibt beim abgebenden Team
       als Dead Cap (gemäß C4, Vorschlag)
     · D50 (Nutzer 2026-10-09): Taktik je Verein (vier Spielstile wie TacticsSystem),
       Schutzstufen (nicht zu haben / nur teuer), „Kein Bedarf“, Wunschliste je
       KI-Verein, Anfrage-Pakete an den Nutzer (Spieler und Picks nach unten),
       Interessenzuschlag für Wunschspieler
     · D99 (2026-10-11): Spieler wollen weg (Stimmung unter −2,0, Zustand p.weg), Vereine geben
       ab (Cap-Not, Neuaufbau, Stil, Überschuss); Preis 85 % / 90 % des Werts in jedem Tausch,
       KI-Tausche nehmen diese Spieler zuerst, Angebote an den Nutzer (angebotFuer)
     · D156 (2026-10-14): Torhüter zählen in jedem Stil – Torwart-Typ (Weitschläger, Mitspieler, Strafraumherr,
       Mitspielender Libero) aus den Detailwerten, angeglichen an die Feldspieler-Skala (CFG.torwart, stilWertTw)

   Braucht: js/dfl_liga_generator.js. Noch NICHT in index.html eingehängt.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const G = window.DFLGenerator;
  if (!G) { console.warn('[DFL-Handel] DFLGenerator fehlt'); return; }

  // Angelehnt an die Mechanik von Football GM (Recherche: analyse-football-gm.md), eigene Umsetzung
  const CFG = {
    marge: 0.05,               // die KI will etwas gewinnen
    // Pick-Bremse: ab dem 3. Erstrundenpick, den die KI abgibt, zählt jeder ×(1 + (n−2)/2,5), spätere Runden milder
    pickBremse: { ab: 3, erste: 2.5, spaeter: 5 },
    nutzerPickSkepsis: 4,      // Picks des Nutzers: erwarteter Platz um 4 schlechter (Nutzer gewinnen meist)
    gesichtAufschlag: 0.2,     // bester Spieler eines Teams: Aufschlag je Lage (LAGEN.*.gesicht), sonst 20 %
    capNot: 1.5,               // Teams über dem Cap: jede Million Entlastung ist ihnen so viele Punkte wert
    titelKern: 0.7,            // Titelteams geben Stammspieler nur gegen Spieler mit ≥ 70 % des Werts ab
    wertExponent: 2.3,         // Stars sind überproportional wertvoll (98er ≈ 3 × 81er)
    // Pick-Werte (D96, Nutzer 2026-10-10: „Pick und Spieler immer in Relation sehen – wenn ein Erstrundenpick 40 kostet,
    // die Spieler daraus aber 70 wert sind, geht etwas nicht auf“): Grundwert des Spielers, den man an diesem Platz im Schnitt
    // zieht (gemessen 2026-10-10: 2.304 Rookies, 3 Ligen × 6 Saisons, direkt nach dem Draft, ±2 Plätze geglättet), mal Abschlag
    // für die Unsicherheit (wer es wird, wie gut das eigene Scouting ist). Bis 2026-10-10: 72·e^(−0,045·(n−1)) + 1 – Pick 32
    // war 19 wert, der Spieler dahinter 67; Pick 128 war 1,2 wert, der Spieler 33.
    // 2026-10-22 (Nutzer: „Angebote deutlich besser“, Messung dfl_pickwert.js: Pick 1–4 als Spieler ~165 mit Talent-Aufschlag, als
    // Pick nur 99): Spitze steiler, ab Pick 32 wie bisher; vorher [1, 117], [4, 104], [8, 93], [16, 80], [24, 73]
    pickStuetzen: [[1, 170], [2, 155], [3, 142], [4, 130], [8, 105], [16, 84], [24, 74], [32, 67], [48, 57], [64, 51], [96, 37], [128, 33], [200, 25]],
    jahrgangFaktor: { bisPick: 5, stark: 1.15, schwach: 0.85 },   // Top-Picks im starken/schwachen Jahrgang (L.draft.form)
    pickAbschlag: 0.9,
    // Qualität vor Menge (D97/D96, 2026-10-10): mehrere Teile für einen besseren sind weniger wert als ihre Summe – Kaderplätze
    // und Draft-Slots sind begrenzt. Das wertvollste Teil zählt voll, das zweite 70 %, das dritte 50 %, jedes weitere 40 %.
    // Gilt beim Empfänger mehrerer Teile (KI ↔ KI, KI ↔ Nutzer, Anfragen an dich, Hochtauschen im Draft); wer abgibt, rechnet
    // voll (die KI gibt nichts billig her, die Pick-Bremse bleibt). Ohne diese Regel wären mit den geeichten Pick-Werten zwei
    // spätere Picks fast immer mehr wert als ein früher – und zwei Ergänzungsspieler so viel wie ein Star.
    paketGewichte: [1, 0.7, 0.5, 0.4],
    pickAbzinsung: 0.85,       // je Jahr in der Zukunft
    vertragGewicht: 150,       // Überschuss (Marktwert − Cap Hit) × Jahre, in Cap-Anteil × 150 …
    vertragBonusMax: 0.15,     // … günstige Verträge höchstens +15 %, teure voll negativ
    deadlineSpieltag: 19,      // Trade-Deadline nach ~60 % der Saison (31 Wochen mit Bye Weeks; vorher 16 von 26)
    pickJahre: 4,              // handelbar: Picks des kommenden Drafts und der drei Jahre danach (Wunsch 2026-10-08)
    bedarfAufschlag: 0.12,     // KI-Käufer: Stammspieler-Bedarf (0–3) macht den Spieler bis +36 % wertvoller
    stilPasstZ: 0.8,                        // Spieler passt zum Stil: z ≥ 0,8 (stärkebereinigt, spielerPassung)
    // höchstens 28 wie der eigene Verein (Prüfung 2026-10-09: KI kam per Trade auf 29–30); D110: Untergrenze 26 → 24, damit ein Verein mit
    // Kaderziel 25/26 (DFLGenerator.kaderZiel) noch 2-gegen-1 tauschen kann
    kaderMin: 24, kaderMax: 28,
    // D110 (Vorschlag der Vorschau, Frage 3): ein Eigentümer mit Geduld (Traditionsverein, D75-Profil) geht früher in den Neuaufbau –
    // ab Rang 20 statt 23, mit alter Elf (Ø ab 29,5) ab Rang 13 statt 15
    lage: { titelBis: 8, neuAb: 23, altAb: 15, alter: 29.5, geduld: { profil: 'tradition', neuAb: 20, altAb: 13 } },
    // Zielwert (D42, DFLSaison.zielDruck): klug geführte KI-Vereine handeln härter, fragwürdig geführte geben
    // Spieler billiger ab und zahlen beim Einkauf drauf – dort kann man günstig zuschlagen
    zielGeschick: 0.15,
    // D50: nicht jeder ist zu haben (Gesicht eines Titelteams, Schlüsselspieler der Taktik, frisch geholt = gesperrt)
    schutz: { stilKern: 2, top: 3, teuerTop: 2.5, talentAlter: 23, talentPot: 85,
      // D96 (Nutzer 2026-10-10: „Wenn jemand nur 64 OVR hat, brauche ich nicht 2× zu bezahlen – dynamisch mit Alter, Talent und
      // aktuellem OVR“): Aufschlag = 1 + max × Talent × Stärke heute × Jugend, je 0…1; Schild erst ab ×1,15 (bis dahin normal)
      talent: { max: 1.0, potAb: 82, potSpanne: 12, ovrAb: 62, ovrSpanne: 20, ovrMin: 0.15, alterBis: 24, alterSpanne: 5, schild: 1.15 } },
    keinBedarf: 0.55,          // Spieler ohne Bedarf und ohne Stil-Passung sind der KI nur gut die Hälfte wert
    stilBonus: 0.10,           // passt klar zur eigenen Taktik: +10 %
    interesse: { grund: 0.10, jeBedarf: 0.08, stil: 0.07, max: 0.35 },   // Zuschlag für Spieler auf der Wunschliste
    wunsch: { max: 3, kaufkraft: 0.7, capPuffer: 6e6, alter: { titel: 31, mittelfeld: 29, neuaufbau: 26 } },
    // D99 (Vorschau spiel/dfl_scout_vorschau.html, freigegeben 2026-10-10, eingebaut 2026-10-11): Spieler wollen weg, Vereine
    // geben Spieler ab. Will weg: Stimmung im eigenen Verein (DFLStimmung) unter −2,0, endet über −1,5 oder mit dem Vereinswechsel;
    // nie im Rookie-Vertrag bis 22. Abgabe (nur Schutzstufe „normal“ – nie gesperrt, Top 3, große Talente): Cap-Not (unter 2 Mio
    // frei, Cap Hit über 1,2 × Marktgehalt und über 3 Mio), Neuaufbau (ab 29, noch ≥ 2 Jahre, ab 74), Stil passt nicht (Bank, ab 72,
    // Passung ≤ −1,2), Überschuss (mehr als Soll + 1 auf der Position, der Schwächste ab 70). Preis 85 % bzw. 90 % des Werts – für
    // die KI unter sich gleich. Angebote an dich: Lücke (Bedarf ≥ 1,2), Stil (Passung ≥ −0,5), ab 74, günstigstes Paket aus 1–2 Teilen.
    // Welt-Paket L3 (Nutzer 2026-10-11: „KI darf Stil und Formation nach jeder Saison wechseln, um passend zu draften und zu traden“):
    // zum Saisonwechsel wechselt ein KI-Verein den Stil, wenn ein anderer klar besser passt – Wert je Stil = stärkebereinigte Passung (z)
    // + Trainer-Vorliebe + formation × (Stärke in der besten Formation des Stils − Stärke heute); Wechsel ab `ab` Vorsprung (Hysterese),
    // Eingewöhnung wie bisher (D55). aktiv: false = Wechsel nur mit neuem Zielwert
    stilWechsel: { aktiv: true, ab: 1.5, formation: 0.3 },
    zuHaben: { aktiv: true, weg: -1.5, wegEnde: -1.0,   // 2026-10-22 (Nutzer: „es müssen mehr Spieler wechselwillig sein … mehr als einer“): −2,0/−1,5 → −1,5/−1,0
      rookieBis: 22, faktorWeg: 0.85, faktorAb: 0.9,
      cap: { frei: 2e6, ueber: 1.2, hit: 3e6 }, neuaufbau: { alter: 29, jahre: 2, ovr: 74 }, stil: { passung: -1.2, ovr: 72 },
      ueberschuss: { ovr: 70, mehr: 1 }, kiVersuche: 3,
      angebot: { bedarf: 1.2, passung: -0.5, ovr: 74, kandidaten: 4, paare: 24, pruefen: 8 } }
  };
  const geschick = t => (window.DFLSaison && DFLSaison.zielDruck ? DFLSaison.zielDruck(t) : 0);
  const LAGEN = {
    // gesicht: Aufschlag für den besten Spieler – Titelteams geben ihren Star kaum her (Wunsch 2026-10-07)
    titel:      { text: 'Titel jetzt', jetzt: 1.1, zukunft: 0.8, picks: 0.85, alter: 1.0, vertrag: 0.5, gesicht: 0.5 },
    mittelfeld: { text: 'Mittelfeld',  jetzt: 1.0, zukunft: 1.0, picks: 1.0,  alter: 1.0, vertrag: 1.0, gesicht: 0.3 },
    neuaufbau:  { text: 'Neuaufbau',   jetzt: 0.9, zukunft: 1.2, picks: 1.15, alter: 1.5, vertrag: 2.0, gesicht: 0.15 }
  };
  const klemme = (x, a, b) => Math.max(a, Math.min(b, x));
  const mio = x => (x / 1e6).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' Mio';
  const name = p => (p.firstName ? p.firstName + ' ' : '') + p.name;
  // D99: will weg (Zustand am Spieler, nur gültig beim Verein, bei dem der Wunsch entstand)
  const willWeg = (p, t) => !!(CFG.zuHaben.aktiv && p && p.weg && t && p.weg.team === t.id);

  // ── Teamlage ─────────────────────────────────────────────────────────────
  function raenge(L) {
    const m = new Map();
    L.teams.slice().sort((a, b) => G.teamOvr(b) - G.teamOvr(a)).forEach((t, i) => m.set(t.id, i + 1));
    return m;
  }
  // Lage aus Rang und Alter der Elf (D110: Eigentümer mit Geduld früher im Neuaufbau)
  function lageRechnen(t, r, alter) {
    const C = CFG.lage, g = C.geduld && t.profil === C.geduld.profil ? C.geduld : null;
    return r <= C.titelBis ? 'titel' : (r >= (g ? g.neuAb : C.neuAb) || (r >= (g ? g.altAb : C.altAb) && alter >= C.alter)) ? 'neuaufbau' : 'mittelfeld';
  }
  // Lage eines Vereins: festgehalten zum Saisonwechsel (t.lage, lagenSetzen – D110: Kaderziel, Draft, Free Agency und Handel richten sich
  // ein Jahr lang danach), sonst aus dem heutigen Rang. `alter` ist das Alters-Gewicht der Lage (spielerWert), das Ø-Alter der Elf steht in
  // `alterElf` (Nebenbefund D110: das Ø-Alter wurde vom Gewicht überschrieben).
  function lage(L, t, rang) {
    const r = (rang || raenge(L)).get(t.id);
    const elf = G.startelfVon(t.roster, t);
    const alter = elf.reduce((s, p) => s + p.age, 0) / Math.max(1, elf.length);
    const key = t.lage && LAGEN[t.lage.key] ? t.lage.key : lageRechnen(t, r, alter);
    return Object.assign({ key, rang: r, alterElf: Math.round(alter * 10) / 10 }, LAGEN[key]);
  }
  // D110: Lage aller Vereine festhalten (Saisonwechsel der Welt, Startphase, neue Karriere): { key, rang, saison }
  function lagenSetzen(L) {
    const rang = raenge(L);
    L.teams.forEach(t => {
      const elf = G.startelfVon(t.roster, t);
      const alter = elf.reduce((s, p) => s + p.age, 0) / Math.max(1, elf.length);
      t.lage = { key: lageRechnen(t, rang.get(t.id), alter), rang: rang.get(t.id), saison: L.saisonIndex || 0 };
    });
    return L.teams.map(t => t.lage);
  }

  // ── Werte ────────────────────────────────────────────────────────────────
  const basis = ovr => Math.pow(Math.max(0, ovr - 55), CFG.wertExponent) / 25;
  function spielerWert(p, lg, team) {
    lg = lg || LAGEN.mittelfeld;
    let jetzt = basis(p.ovr);
    let zukunft = 0;
    const pot = G.potSichtbar(p);                     // D103: Nieten mit der alten Hoffnung – niemand kennt sie
    if (p.age <= 25 && pot > p.ovr) {
      zukunft = (basis(pot) - jetzt) * (p.age <= 21 ? 0.55 : p.age <= 23 ? 0.45 : 0.3);
    }
    let wert = jetzt * lg.jetzt + zukunft * lg.zukunft;
    if (p.age >= 29) wert *= Math.max(0.3, 1 - 0.07 * (p.age - 28) * lg.alter);
    // Vertrag: günstige Verträge bringen wenig (höchstens +15 %), überbezahlte belasten voll
    if (p.contract) {
      const jahre = Math.min(3, p.contract.years_remaining);
      const ueberschuss = (G.marktgehalt(p) - G.capHitSpieler(p)) * jahre;
      const effekt = ueberschuss / G.CFG.cap * CFG.vertragGewicht * (lg.vertrag || 1);
      wert += effekt > 0 ? Math.min(effekt, wert * CFG.vertragBonusMax) : effekt;
    }
    if (team) {
      const bester = team.roster.slice().sort((a, b) => b.ovr - a.ovr)[0];
      if (bester && bester.id === p.id && p.teamId === team.id) wert *= 1 + (lg.gesicht != null ? lg.gesicht : CFG.gesichtAufschlag);
    }
    return Math.max(0.5, Math.round(wert * 10) / 10);
  }

  // ── Taktik je Verein (D50) ───────────────────────────────────────────────
  // Die vier Spielstile des Spiels (bundle_tactics_core.js, styleScoreFromAttrs) – hier als eigene Kopie,
  // damit die Logik auch ohne Spieloberfläche (Langzeitlauf, Prüflauf) läuft. Positionen der Welt: OM statt ZOM.
  // D95: Gruppen ohne Seite (DFLGenerator.grund: LV/RV → AV, LF/RF → FL, LM/RM → AM), damit Passung und Regressionen nicht
  // in zu kleine Gruppen zerfallen; LM/RM zählen wie im Basisspiel (STYLE_POS) für Flügelspiel und Pressing
  // D156 (Nutzer 2026-10-14: „der Stil sollte auch im Spiel greifen ja“): Torhüter zählen in jedem Stil – als Torwart-Typ (TW_TYP)
  // aus seinen Detailwerten (stilWertTw)
  const STILE = ['direkt', 'ballbesitz', 'fluegel', 'pressing'];
  const STIL_TEXT = { direkt: 'Direktes Spiel', ballbesitz: 'Ballbesitz', fluegel: 'Flügelspiel', pressing: 'Gegenpressing' };
  const STIL_POS = { direkt: ['TW', 'ST', 'OM', 'FL', 'AV'], ballbesitz: ['TW', 'ZM', 'OM', 'ZDM', 'IV'], fluegel: ['TW', 'AV', 'FL', 'ST', 'AM'], pressing: ['TW', 'ZM', 'OM', 'ST', 'FL', 'AM'] };
  // ── D156: Torhüter mit Stil ──────────────────────────────────────────────
  // Torwart-Typ je Stil (Gewichte freigegeben 2026-10-14) aus den Detailwerten von player_attributes.js (spielerWerte: 1 gegen 1,
  // Spielaufbau, Abwurf, Reflexe, Paraden, Schnelligkeit – dieselben Zahlen wie im Spieler-Blatt). Ohne spielerWerte (Langzeitlauf
  // ohne player_attributes.js) dieselbe Ableitung aus den Grundwerten ohne die Streuung je Spieler.
  // Angleich an die Feldspieler-Skala (gemessen 2026-10-14, 6 Ligen × 3 Saisons, alle Kaderspieler): Feldspieler der Stil-Positionen
  // liegen bei gleicher Stärke anders (roh −6 … +6 Punkte) und steigen flacher mit der Stärke (Steigung 0,55–0,90) als der rohe
  // Torwart-Wert (0,89–1,03). Die Abweichung je Torwart (Streuung um die Gerade 1,2–1,4) liegt wie bei Feldspielern einer
  // Position (0,6–2,2) und bleibt unverändert.
  // Deshalb Torwart-Wert = Erwartung eines Feldspielers gleicher Stärke + Abweichung von der Erwartung eines Torwarts gleicher Stärke:
  // stilWert = roh + c + d × (Stärke − 75). Sonst verschöbe die Stärke des Torwarts den Teamschnitt (stilTeam) und er stünde in
  // Listen über alle Stil-Positionen (spielerReg, Wunschliste, Schlüsselspieler) immer oben oder unten.
  const TW_TYP = { direkt: 'Weitschläger', ballbesitz: 'Mitspieler', fluegel: 'Strafraumherr', pressing: 'Mitspielender Libero' };
  const TW_GEWICHT = {
    direkt: { abwurf: 0.60, reflexe: 0.25, spielaufbau: 0.15 },
    ballbesitz: { spielaufbau: 0.60, abwurf: 0.25, paraden: 0.15 },
    fluegel: { paraden: 0.50, abwurf: 0.30, reflexe: 0.20 },
    pressing: { einsGegenEins: 0.50, schnelligkeit: 0.30, spielaufbau: 0.20 }
  };
  CFG.torwart = {
    aktiv: true,
    angleich: { direkt: { c: 6.39, d: -0.471 }, ballbesitz: { c: 4.34, d: -0.127 }, fluegel: { c: -5.81, d: -0.352 }, pressing: { c: 2.04, d: -0.205 } },
    // Rückfall ohne spielerWerte: Detailwert = 0,55 × Stärke + 0,45 × Grundwert + Torwart-Profil (wie player_attributes.js)
    rueckfall: { einsGegenEins: ['def', 5], spielaufbau: ['mid', -2], abwurf: ['mid', 2], reflexe: ['def', 7], paraden: ['def', 8], schnelligkeit: ['pace', -6] }
  };
  const TW_WERTE = Object.keys(CFG.torwart.rueckfall);
  const istTw = p => !!p && G.grund(p.pos) === 'TW';
  // Detailwerte eines Torhüters (Welt- oder Spiel-Spieler). Weltspieler tragen einen Bruchteil als Seed – wie zuSpielSpieler
  // umgerechnet, damit dieselben Werte herauskommen wie im Spieler-Blatt (D68-Form nach Alter inklusive, wenn sie im Spiel aktiv ist)
  function twWerte(p) {
    const f = typeof window !== 'undefined' ? window.spielerWerte : null;
    if (typeof f === 'function') {
      try {
        const ganz = Number.isInteger(p.seed) && p.seed > 1;
        const q = { pos: 'TW', positions: ['TW'], ovr: p.ovr, def: p.def, mid: p.mid, att: p.att, pace: p.pace, mental: p.mental, age: p.age,
          koerper: p.koerper,
          seed: ganz ? p.seed : Math.floor((Number(p.seed) || 0) * 2147483646) + 1, dflSeed: ganz ? p.dflSeed : p.seed };
        const w = f(q);
        if (w && TW_WERTE.every(k => typeof w[k] === 'number' && isFinite(w[k]))) return w;
      } catch (e) { /* Rückfall unten */ }
    }
    const nv = p.ovr || 60, o = {};
    TW_WERTE.forEach(k => { const [g, plus] = CFG.torwart.rueckfall[k]; o[k] = Math.max(20, Math.min(99, nv * 0.55 + (p[g] || 55) * 0.45 + plus)); });
    return o;
  }
  // roher Torwart-Wert je Stil (Skala der Detailwerte) und angeglichen an die Feldspieler-Skala
  function stilWertTwRoh(p, stil) {
    const g = TW_GEWICHT[stil]; if (!g) return 55;
    const w = twWerte(p);
    return Object.keys(g).reduce((s, k) => s + g[k] * w[k], 0);
  }
  function stilWertTw(p, stil) {
    const a = CFG.torwart.angleich[stil] || { c: 0, d: 0 };
    return stilWertTwRoh(p, stil) + a.c + a.d * ((p.ovr || 60) - 75);
  }
  // Torwart-Typ eines Stils („Mitspieler“) – null für Feldspieler oder unbekannte Stile
  const twTyp = (p, stil) => (istTw(p) && TW_TYP[stil]) || null;
  function stilWert(p, stil) {
    if (istTw(p) && CFG.torwart.aktiv) return stilWertTw(p, stil);
    const pace = p.pace || 55, att = p.att || 55, mid = p.mid || 55, mental = p.mental || 55, def = p.def || 55;
    const tec = p.technik != null ? p.technik : (mid + att) / 2;
    switch (stil) {
      case 'direkt': return pace * 0.50 + att * 0.35 + tec * 0.15;
      case 'ballbesitz': return tec * 0.45 + mid * 0.35 + mental * 0.20;
      case 'fluegel': return pace * 0.40 + tec * 0.30 + mid * 0.30;
      case 'pressing': return mental * 0.45 + pace * 0.40 + def * 0.15;
      default: return 55;
    }
  }
  const stilRelevant = (p, stil) => STIL_POS[stil].indexOf(G.grund(p.pos)) >= 0 && (CFG.torwart.aktiv || !istTw(p));
  function stilTeam(t, stil) {
    const rel = G.startelfVon(t.roster, t).filter(p => stilRelevant(p, stil));
    return rel.length ? rel.reduce((s, p) => s + stilWert(p, stil), 0) / rel.length : 50;
  }
  // Ligaschnitt je Stil (Startelf-Spieler der Stil-Positionen) – Maßstab für Taktik und Passung
  function stilSchnitt(L) {
    const k = (L.saisonIndex || 0) + ':' + L.teams.length;
    if (L._stilSchnitt && L._stilSchnitt.k === k) return L._stilSchnitt;
    const o = { k };
    STILE.forEach(s => { o[s] = L.teams.reduce((a, t) => a + stilTeam(t, s), 0) / Math.max(1, L.teams.length); });
    Object.defineProperty(L, '_stilSchnitt', { value: o, writable: true, configurable: true, enumerable: false });
    return o;
  }
  const hashZahl = txt => { let h = 2166136261; for (const c of String(txt)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
  // Stil = wozu die Startelf am besten passt, dazu etwas Trainer-Vorliebe. Neu gewählt, wenn der Verein sich neu
  // ausrichtet (neuer Zielwert, D42) – sonst bleibt er. Seit D55 stärkebereinigt (stilPassung): vorher wählten starke
  // Kader fast immer Ballbesitz (36 % aller Vereine im Langzeitlauf), weil dessen Stilwert am steilsten mit der Stärke steigt.
  function taktikenSetzen(L) {
    L.teams.forEach(t => {
      const marke = t.ziel ? t.ziel.bis : 0;
      if (t.taktik && t.taktik.marke === marke) return;
      // L3: der erste Zielwert (Startstärke) ist keine Neuausrichtung – der Stil vom Start (Generator) bleibt
      if (t.taktik && t.taktik.stil && t.ziel && t.ziel.vorher == null && t.taktik.marke === 0 && CFG.stilWechsel.aktiv) { t.taktik.marke = marke; return; }
      const best = STILE.map(s => ({ s, w: stilPassung(L, t, s) + (hashZahl(t.id + s + marke) - 0.5) * 0.8 })).sort((a, b) => b.w - a.w)[0];
      t.taktik = Object.assign(t.taktik || {}, { stil: best.s, marke });
    });
  }
  const stilVon = t => (t && t.taktik && t.taktik.stil) || null;
  // L3: Stil der KI zum Saisonwechsel prüfen (CFG.stilWechsel) – gibt die Wechsel zurück [{ t, von, nach }]; ohne: Set eigener Vereine
  function stilPruefen(L, ohne) {
    const C = CFG.stilWechsel, S = typeof window !== 'undefined' && window.DFLSaison, aus = [];
    if (!C.aktiv) return aus;
    taktikenSetzen(L);
    L.teams.forEach(t => {
      if (t.eigen || (ohne && ohne.has(t.id)) || !t.roster || t.roster.length < 11) return;
      const cur = stilVon(t); if (!cur) return;
      const heute = G.teamOvr(t), marke = t.taktik.marke || 0;
      const wert = s => stilPassung(L, t, s) + (hashZahl(t.id + s + marke) - 0.5) * 0.8
        + C.formation * (G.teamOvr({ roster: t.roster, taktik: { stil: s } }) - heute);
      const wc = wert(cur), best = STILE.filter(s => s !== cur).map(s => ({ s, w: wert(s) })).sort((a, b) => b.w - a.w)[0];
      if (!best || best.w - wc < C.ab) return;
      t.taktik.stil = best.s;
      t.taktik.eing0 = S && S.wechselKosten ? S.wechselKosten(cur, best.s) : 0.5;
      t.taktik.eingSaison = L.saisonIndex || 0;
      t.taktik.gewechselt = { von: cur, saison: L.saisonIndex || 0 };
      aus.push({ t, von: cur, nach: best.s });
    });
    return aus;
  }
  // D55: stärkebereinigte Stilpassung. Die rohen Stilwerte hängen zu 97 % an der Teamstärke (gemessen 2026-10-09:
  // r = 0,97 gegen die Startelf-Stärke) – sonst „passt“ jeder starke Kader zu jedem Stil. Deshalb das Residuum einer
  // Geraden Stilwert ~ Teamstärke über die Liga (Streuung ≈ 1,3 Punkte), geteilt durch die Streuung des Stils.
  function stilRegression(L) {
    const k = (L.saisonIndex || 0) + ':' + L.teams.reduce((a, t) => a + t.roster.length, 0);
    if (L._stilReg && L._stilReg.k === k) return L._stilReg;
    // nur Teams mit Startelf (im Spiel ist der eigene Kader vor dem ersten Spiegeln leer → Stärke NaN)
    const teams = L.teams.filter(t => t.roster && t.roster.length >= 11 && isFinite(G.teamOvr(t)));
    const o = { k }, xs = teams.map(t => G.teamOvr(t)), mx = xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
    STILE.forEach(s => {
      const ys = teams.map(t => stilTeam(t, s)), my = ys.reduce((a, b) => a + b, 0) / Math.max(1, ys.length);
      let sxy = 0, sxx = 0; xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) ** 2; });
      const b = sxx ? sxy / sxx : 0;
      const sd = Math.sqrt(ys.reduce((a, y, i) => a + (y - (my + b * (xs[i] - mx))) ** 2, 0) / Math.max(1, ys.length));
      o[s] = { b, mx, my, sd: Math.max(0.3, sd) };
    });
    Object.defineProperty(L, '_stilReg', { value: o, writable: true, configurable: true, enumerable: false });
    return o;
  }
  // in Standardabweichungen des Stils (die Stile streuen verschieden stark – roh gewänne der breiteste fast immer)
  function stilPassung(L, t, s) {
    const g = stilRegression(L)[s]; if (!g || !t || !t.roster || t.roster.length < 11) return 0;
    const z = (stilTeam(t, s) - (g.my + g.b * (G.teamOvr(t) - g.mx))) / g.sd;
    return isFinite(z) ? z : 0;
  }
  // 1 Standardabweichung ≈ 2 % auf die Torchancen, höchstens ±4 (D55)
  const stilPassungProzent = (L, t, s) => Math.max(-4, Math.min(4, Math.round(stilPassung(L, t, s) * 2 * 10) / 10));
  // Stil, Passung und Eingewöhnung aller KI-Vereine auffrischen (Saisonbeginn, Laden, Trades). Wechselt ein Verein den Stil
  // (neuer Zielwert, D42), startet die Eingewöhnung nach D55 bei 50 % (Nachbar) bzw. 20 % (Gegenüber) und wächst je Spieltag.
  function stilAktualisieren(L) {
    const S = typeof window !== 'undefined' && window.DFLSaison;
    const alt = new Map(L.teams.map(t => [t.id, stilVon(t)]));
    taktikenSetzen(L);
    L.teams.forEach(t => {
      const vorher = alt.get(t.id), jetzt = stilVon(t);
      if (vorher && jetzt && vorher !== jetzt && S) { t.taktik.eing0 = S.wechselKosten(vorher, jetzt); t.taktik.eingSaison = L.saisonIndex || 0; }
      else if (t.taktik.eingSaison !== (L.saisonIndex || 0)) t.taktik.eing0 = 1;      // aus einer früheren Saison: eingewöhnt
      t.taktik.spieler = stilPassungProzent(L, t, jetzt);
    });
  }
  // ── Spieler-Stilpassung (Nutzer 2026-10-09: „KI-Teams sollen nach Spielern schauen, die der Taktik entsprechend
  // schon ausgebildet wurden“) ── Stilwert gegen die Erwartung für seine Stärke: Gerade Stilwert ~ Stärke über alle
  // Kaderspieler der Stil-Positionen, Residuum ÷ Streuung = z (sonst „passt“ jeder starke Spieler zu jedem Stil, r ≈ 0,97)
  function spielerReg(L) {
    const k = (L.saisonIndex || 0) + ':' + L.teams.reduce((a, t) => a + t.roster.length, 0);
    if (L._spielerReg && L._spielerReg.k === k) return L._spielerReg;
    const alle = [].concat(...L.teams.map(t => t.roster));
    const o = { k };
    STILE.forEach(s => {
      const ps = alle.filter(p => stilRelevant(p, s)), n = Math.max(1, ps.length);
      const xs = ps.map(p => p.ovr || 60), ys = ps.map(p => stilWert(p, s));
      const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
      let sxy = 0, sxx = 0; xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) ** 2; });
      const b = sxx ? sxy / sxx : 0;
      const sd = Math.sqrt(ys.reduce((a, y, i) => a + (y - (my + b * (xs[i] - mx))) ** 2, 0) / n);
      o[s] = { b, mx, my, sd: Math.max(0.5, sd) };
    });
    Object.defineProperty(L, '_spielerReg', { value: o, writable: true, configurable: true, enumerable: false });
    return o;
  }
  function spielerPassung(L, p, stil) {
    if (!p || !stil || !STIL_POS[stil] || !stilRelevant(p, stil)) return 0;
    const R = spielerReg(L)[stil];
    const z = (stilWert(p, stil) - (R.my + R.b * ((p.ovr || 60) - R.mx))) / R.sd;
    return isFinite(z) ? Math.max(-3, Math.min(3, z)) : 0;
  }
  // Bonus für die KI: nur positive Passung zählt (der Spieler ist für den Stil „ausgebildet“), je z-Einheit `je` Punkte
  const stilBonus = (L, t, p, je) => { const s = stilVon(t); return s ? Math.max(0, spielerPassung(L, p, s)) * (je || 1) : 0; };
  // Passt ein Spieler klar zum Stil eines Teams? (Stil-Position, stärkebereinigt ≥ 0,8 Streuungen über der Erwartung)
  function stilPasst(L, t, p) {
    const s = stilVon(t);
    return !!(s && spielerPassung(L, p, s) >= CFG.stilPasstZ);
  }

  // Talent-Aufschlag (D96): Talent (Potenzial über 82), Stärke heute (ab 62, mindestens 0,15) und Jugend (bis 24), je 0…1
  function talentAufschlag(p) {
    const T = CFG.schutz.talent;
    const talent = klemme((G.potSichtbar(p) - T.potAb) / T.potSpanne, 0, 1);
    const heute = klemme((p.ovr - T.ovrAb) / T.ovrSpanne, T.ovrMin, 1);
    const jung = klemme((T.alterBis - p.age) / T.alterSpanne, 0, 1);
    return Math.round((1 + T.max * talent * heute * jung) * 100) / 100;
  }
  // ── Schutzstufen (D50): nicht jeder Spieler ist zu haben ─────────────────
  // gesperrt: frisch geholt (Trade oder Free Agency in dieser Saison), Gesicht eines Titelteams,
  //           die zwei Schlüsselspieler der Taktik · teuer: Top 3 im Kader (×2,5), große Talente (D96: ×1,15 … ×2 nach Alter, Potenzial, Stärke)
  // opt.nutzer (D97): Kader des Nutzers – dieselben Aufschläge wie bei der KI (Top 3 ×2,5, Talente nach D96); sein Gesicht
  // des Vereins ist nicht gesperrt (er entscheidet selbst), kostet aber ebenfalls ×2,5
  function schutzKarte(L, t, rang, opt) {
    const nutzer = !!(opt && opt.nutzer);
    const lg = lage(L, t, rang), C = CFG.schutz, karte = new Map(), stil = stilVon(t);
    const nachWert = t.roster.slice().sort((a, b) => spielerWert(b, lg, t) - spielerWert(a, lg, t));
    const kern = stil ? G.startelfVon(t.roster, t).filter(p => stilRelevant(p, stil))
      .sort((a, b) => stilWert(b, stil) - stilWert(a, stil)).slice(0, C.stilKern).map(p => p.id) : [];
    nachWert.forEach((p, i) => {
      let s = { stufe: 'normal', faktor: 1 };
      if (p.vereinsJahre === 0 && p._exVerein && p._exVerein !== t.id) s = { stufe: 'gesperrt', grund: 'gerade erst geholt' };
      else if (i === 0 && lg.key === 'titel') s = nutzer ? { stufe: 'teuer', grund: 'Gesicht des Vereins', faktor: C.teuerTop } : { stufe: 'gesperrt', grund: 'Gesicht des Vereins' };
      else if (kern.indexOf(p.id) >= 0) s = { stufe: 'gesperrt', grund: 'Schlüsselspieler im ' + STIL_TEXT[stil] };
      // Rückmeldung 17.10. (11): ein Rohdiamant ist der Star der Zukunft – die KI gibt ihn nie her (der Nutzer entscheidet selbst)
      else if (!nutzer && p.diamant) s = { stufe: 'gesperrt', grund: 'Rohdiamant – den gibt der Verein nicht her' };
      else if (i < C.top) s = { stufe: 'teuer', grund: 'Top ' + C.top + ' im Kader', faktor: C.teuerTop };
      else if (p.age <= C.talentAlter && G.potSichtbar(p) >= C.talentPot) {
        const f = talentAufschlag(p);
        if (f >= C.talent.schild) s = { stufe: 'teuer', grund: 'großes Talent', faktor: f };
      }
      // D99: wer weg will, hält der Verein nicht mehr zum Höchstpreis (Top 3, Talent) – er kostet 85 % (zuHabenInfo);
      // gesperrt bleibt gesperrt (gerade erst geholt, Gesicht eines Titelteams, Schlüsselspieler der Taktik)
      if (!nutzer && s.stufe === 'teuer' && willWeg(p, t)) s = { stufe: 'normal', faktor: 1, weg: true };
      karte.set(p.id, s);
    });
    return karte;
  }
  // Will Team B diesen Spieler überhaupt? Bedarf, Startelf-Platz, dünne Position, Neuaufbau mit Jungen, Stil
  function interesse(L, B, p, rang) {
    if ((G.bedarf(B)[p.pos] || 0) > 0) return true;
    const elfPos = G.startelfVon(B.roster, B).filter(x => x.pos === p.pos && x.id !== p.id).sort((a, c) => a.ovr - c.ovr);
    if (!elfPos.length || p.ovr > elfPos[0].ovr) return true;
    const sollB = G.kaderSoll(B)[p.pos];
    if (B.roster.filter(x => x.pos === p.pos && x.id !== p.id).length < (sollB != null ? sollB : 1)) return true;
    if (lage(L, B, rang).key === 'neuaufbau' && p.age <= 23) return true;
    return stilPasst(L, B, p);
  }
  // Zuschlag, den ein Team für einen Spieler seiner Wunschliste zahlt (Bedarf 0–3, Stil-Passung)
  function interessenZuschlag(L, B, p) {
    const I = CFG.interesse;
    return Math.min(I.max, I.grund + I.jeBedarf * (G.bedarf(B)[p.pos] || 0) + (stilPasst(L, B, p) ? I.stil : 0));
  }

  // ── Draft-Picks ──────────────────────────────────────────────────────────
  const pickId = (jahr, runde, von) => jahr + '-' + runde + '-' + von;
  function picks(L) {
    if (!L.picks) L.picks = [];
    const jahr = L.draft ? L.draft.jahr : (L.saisonJahr || 2026) + 1;
    for (let j = jahr; j < jahr + CFG.pickJahre; j++) {
      for (const t of L.teams) for (let r = 1; r <= 4; r++) {
        const id = pickId(j, r, t.id);
        if (!L.picks.some(x => x.id === id)) L.picks.push({ id, jahr: j, runde: r, von: t.id, besitzer: t.id });
      }
    }
    L.picks = L.picks.filter(x => x.jahr >= jahr);
    return L.picks;
  }
  function pickBesitzer(L, jahr, runde, von) {
    const x = (L.picks || []).find(k => k.id === pickId(jahr, runde, von));
    return x ? x.besitzer : von;
  }
  // Paketwert: das wertvollste Teil voll, weitere mit abnehmendem Gewicht (CFG.paketGewichte)
  function paketWert(werte) {
    const g = CFG.paketGewichte;
    return werte.slice().sort((a, b) => b - a).reduce((s, w, i) => s + w * g[Math.min(i, g.length - 1)], 0);
  }
  // Wert des Pick-Platzes n (1 = erster Pick): Stützstellen linear verbunden, mal Unsicherheits-Abschlag
  function pickKurve(n) {
    const st = CFG.pickStuetzen;
    let w = st[st.length - 1][1];
    if (n <= st[0][0]) w = st[0][1];
    else for (let i = 1; i < st.length; i++) {
      if (n <= st[i][0]) { const [n0, w0] = st[i - 1], [n1, w1] = st[i]; w = w0 + (w1 - w0) * (n - n0) / (n1 - n0); break; }
    }
    return w * CFG.pickAbschlag;
  }
  // Erwarteter Platz in der Runde: schwache Teams wählen früh. skepsis: Picks des Nutzers schlechter schätzen
  function pickWert(L, pick, lg, rang, skepsis) {
    rang = rang || raenge(L);
    const jahr0 = L.draft ? L.draft.jahr : pick.jahr;
    const ahead = pick.jahr - jahr0;
    // Nutzer-Skepsis nur für künftige Jahrgänge: im laufenden Draft-Jahr steht die Reihenfolge (fast) fest
    const prognose = Math.min(32, 33 - rang.get(pick.von) + (ahead > 0 ? (skepsis || 0) : 0));
    const platzInRunde = ahead === 0 ? prognose : (prognose + 16.5) / 2;   // Zukunft: unsicherer
    const gesamt = (pick.runde - 1) * 32 + platzInRunde;
    const jf = CFG.jahrgangFaktor, form = ahead === 0 && L.draft ? L.draft.form : (ahead === 1 && L.draftNaechste ? L.draftNaechste.form : null);
    const w = pickKurve(gesamt) * Math.pow(CFG.pickAbzinsung, ahead) * (gesamt <= jf.bisPick && (form === 'stark' || form === 'schwach') ? jf[form] : 1);
    return { wert: Math.round(w * (lg || LAGEN.mittelfeld).picks * 10) / 10, platz: Math.round(gesamt) };
  }
  function pickText(L, pick, rang) {
    const pw = pickWert(L, pick, null, rang);
    const von = L.teams.find(t => t.id === pick.von);
    return `${pick.jahr} · Runde ${pick.runde}${pick.besitzer !== pick.von ? ' (von ' + (von ? von.kurz || von.name : pick.von) + ')' : ''} · erwartet Pick ~${pw.platz}`;
  }

  // ── Bewertung eines Tauschs ──────────────────────────────────────────────
  // deal: { von: Nutzer-Team, an: KI-Team, gibt: {spieler:[ids], picks:[ids]}, bekommt: {spieler:[ids], picks:[ids]} }
  const leer = () => ({ spieler: [], picks: [] });
  function normal(deal) {
    return { von: deal.von, an: deal.an, gibt: Object.assign(leer(), deal.gibt), bekommt: Object.assign(leer(), deal.bekommt) };
  }
  const teamVon = (L, id) => L.teams.find(t => t.id === id);
  const spielerIn = (t, ids) => ids.map(id => t.roster.find(p => p.id === id)).filter(Boolean);
  // Cap nach dem Tausch: abgehende Spieler lassen ihren Rest-Bonus als Dead Cap zurück (C4),
  // ankommende zählen nur mit Grundgehalt + garantierten Boni
  function restBonus(p) {
    const c = p.contract; if (!c || !c.signing_bonus_total) return 0;
    const proJahr = c.signing_bonus_total / c.years_total;
    return c.signing_bonus_total - proJahr * (c.years_total - c.years_remaining);
  }
  const hitNeu = p => p.contract ? p.contract.base_salary + (p.contract.guaranteed_bonuses || 0) : 0;
  function capNach(t, raus, rein) {
    return G.capHitTeam(t) - raus.reduce((s, p) => s + G.capHitSpieler(p) - restBonus(p), 0) + rein.reduce((s, p) => s + hitNeu(p), 0);
  }
  function werteKI(L, d, rang, opt) {
    opt = opt || {};
    const A = teamVon(L, d.von), B = teamVon(L, d.an);
    const lgB = lage(L, B, rang);
    const bedarfB = G.bedarf(B);
    const vonA = spielerIn(A, d.gibt.spieler), vonB = spielerIn(B, d.bekommt.spieler);
    const pk = ids => ids.map(id => (L.picks || []).find(x => x.id === id)).filter(Boolean);
    // D50: Schutzstufen der eigenen Spieler, „Kein Bedarf“ und Stil-Passung bei ankommenden
    taktikenSetzen(L);
    const schutzB = vonB.length ? schutzKarte(L, B, rang) : new Map(), stufe = p => schutzB.get(p.id) || { stufe: 'normal', faktor: 1 };
    const gesperrt = vonB.filter(p => stufe(p).stufe === 'gesperrt'), teuer = vonB.filter(p => stufe(p).stufe === 'teuer');
    const keinBedarf = [];
    const wertRein = p => {
      let w = spielerWert(p, lgB) * (bedarfB[p.pos] > 0 ? 1.1 : 1);
      if (!interesse(L, B, p, rang)) { keinBedarf.push(p); w *= CFG.keinBedarf; } else if (stilPasst(L, B, p)) w *= 1 + CFG.stilBonus;
      return w;
    };
    const erhalt = paketWert(vonA.map(wertRein)
      .concat(pk(d.gibt.picks).map(x => pickWert(L, x, lgB, rang, !opt.ki && x.von === A.id ? CFG.nutzerPickSkepsis : 0).wert)));
    // Pick-Bremse: je mehr Picks die KI abgibt, desto teurer wird jeder weitere
    const eigenePicks = pk(d.bekommt.picks).sort((a, b) => a.runde - b.runde);
    let nErste = 0, nAlle = 0, bremse = 0;
    const pickWerte = eigenePicks.map(x => {
      nAlle++; if (x.runde === 1) nErste++;
      const B_ = CFG.pickBremse, n = x.runde === 1 ? nErste : nAlle;
      const f = n >= B_.ab ? 1 + (n - 2) / (x.runde === 1 ? B_.erste : B_.spaeter) : 1;
      if (f > 1) bremse++;
      return pickWert(L, x, lgB, rang).wert * f;
    });
    // was die KI abgibt, zählt voll (sie gibt nichts billig her, die Pick-Bremse bleibt) – Qualität vor Menge gilt beim Empfänger.
    // D99: wer bei B weg will oder abgegeben wird, kostet 85 % bzw. 90 % seines Werts (statt Schutz-Aufschlag)
    let kB = null;
    const zuH = p => { if (!CFG.zuHaben.aktiv) return null; if (!kB) kB = abgabeKontext(L, B, rang, schutzB); return zuHabenInfo(L, B, p, kB); };
    const zuHaben = vonB.map(p => ({ p, z: zuH(p) })).filter(x => x.z);
    const preisFaktor = p => { const x = zuHaben.find(y => y.p === p); return x ? x.z.faktor : (stufe(p).faktor || 1); };
    const abgabe = vonB.reduce((s, p) => s + spielerWert(p, lgB, B) * preisFaktor(p), 0) + pickWerte.reduce((s, w) => s + w, 0);
    const noetig = abgabe * (1 + CFG.marge) * (1 + CFG.zielGeschick * geschick(B));
    // Über dem Cap: Entlastung ist der KI etwas wert (große Teams müssen sich Platz ertraden)
    const capVor = G.capHitTeam(B), capDanach = capNach(B, vonB, vonA);
    const entlastung = capVor > B.salary_cap_limit && capDanach < capVor ? (capVor - Math.max(capDanach, B.salary_cap_limit * 0.97)) / 1e6 * CFG.capNot : 0;
    // Interessenzuschlag (D50): für einen Spieler auf der eigenen Wunschliste zahlt die KI etwas drauf
    const gesamt = (erhalt + Math.max(0, entlastung)) * (1 + (opt.interesse || 0));
    return { A, B, lgB, vonA, vonB, erhalt: gesamt, abgabe, noetig, extraPicks: bremse, entlastung: Math.max(0, entlastung),
      gesperrt: gesperrt.map(p => ({ p, grund: stufe(p).grund })), teuer, keinBedarf, zuHaben };
  }
  // Startelf muss besetzbar bleiben: kein Deal, nach dem eine Position unter die Startelf-Zahl fällt und dabei
  // noch Spieler verliert (Prüfung 2026-10-09: Schalke gab beide Torhüter ab, Braunschweig beide ZDM).
  // D95: Startelf der eigenen Formation (startSoll); eine Position deckt, wer sie gelernt hat (Stamm oder 2./3. Position)
  function elfLuecke(T, weg, dazu) {
    const ids = new Set(weg.map(p => p.id)), vorher = T.roster.filter(x => !x.ir);
    const nachher = vorher.filter(x => !ids.has(x.id)).concat(dazu);
    const kann = (p, pos) => G.abzugAuf(p, pos) <= G.ABZUG.gelernt;
    for (const [pos, n] of Object.entries(G.startSoll ? G.startSoll(T) : G.CFG.startelf)) {
      const a = vorher.filter(p => kann(p, pos)).length, b = nachher.filter(p => kann(p, pos)).length;
      if (b < n && b < a) return pos;
    }
    return null;
  }
  function bewerte(L, deal, opt) {
    picks(L);
    const d = normal(deal), rang = raenge(L);
    const w = werteKI(L, d, rang, opt);
    const { A, B, vonA, vonB } = w;
    // Alles im Angebot muss noch beim Abgeber sein: Angebote gelten zwei Wochen, inzwischen kann ein Spieler oder Pick
    // weitergetauscht sein – vorher fiel ein fehlender Spieler still heraus und ein fremder Pick wechselte trotzdem
    // den Besitzer (Prüfung 2026-10-10)
    const pickBeim = (ids, t) => ids.every(id => { const x = (L.picks || []).find(k => k.id === id); return x && x.besitzer === t.id; });
    const fehlt = vonA.length !== d.gibt.spieler.length || vonB.length !== d.bekommt.spieler.length || !pickBeim(d.gibt.picks, A) || !pickBeim(d.bekommt.picks, B);
    const cap = {
      a: { vorher: G.capHitTeam(A), nachher: capNach(A, vonA, vonB), limit: A.salary_cap_limit },
      b: { vorher: G.capHitTeam(B), nachher: capNach(B, vonB, vonA), limit: B.salary_cap_limit }
    };
    const hinweise = [];
    // Spieler auf der Verletztenliste (ir) belegen keinen Kaderplatz (D38)
    const platz = T => T.roster.filter(x => !x.ir).length;
    const kaderA = platz(A) - vonA.length + vonB.length, kaderB = platz(B) - vonB.length + vonA.length;
    if (kaderA > 28) hinweise.push(`${A.name} muss danach ${kaderA - 28} Spieler entlassen (Kader ${kaderA})`);
    if (kaderA < 28) hinweise.push(`${A.name} hat danach nur ${kaderA} Spieler`);
    let akzeptiert = false, grund;
    const leerDeal = !vonA.length && !vonB.length && !d.gibt.picks.length && !d.bekommt.picks.length;
    if (leerDeal) grund = 'Noch nichts ausgewählt.';
    else if (fehlt) grund = 'Ein Spieler oder Pick aus dem Angebot gehört nicht mehr zu diesem Verein.';
    // Spec 3.3: über dem Cap nur Tauschgeschäfte, die die Lage nicht verschlechtern
    else if (cap.a.nachher > cap.a.limit && cap.a.nachher > cap.a.vorher) grund = `Cap: ${A.name} läge danach bei ${mio(cap.a.nachher)} (Limit ${mio(cap.a.limit)}).`;
    else if (cap.b.nachher > cap.b.limit && cap.b.nachher > cap.b.vorher) grund = `Cap: ${B.name} läge danach bei ${mio(cap.b.nachher)} (Limit ${mio(cap.b.limit)}).`;
    // unter kaderMin nur sperren, wenn der Tausch den Kader schrumpfen lässt (D74: zum Start haben alle 25 – vorher lehnte die KI
    // in Woche 1 fast jeden Eins-gegen-eins-Tausch ab)
    else if (kaderB > CFG.kaderMax || (kaderB < CFG.kaderMin && kaderB < platz(B))) grund = `Kader: ${B.name} hätte danach ${kaderB} Spieler.`;
    else if (elfLuecke(B, vonB, vonA)) grund = `${B.name} hätte danach zu wenige ${elfLuecke(B, vonB, vonA)} für die Startelf.`;
    else if (w.gesperrt.length) grund = `${name(w.gesperrt[0].p)} ist nicht zu haben (${w.gesperrt[0].grund}).`;
    else if (titelKernVerletzt(L, w)) grund = 'Wir spielen um den Titel – einen Stammspieler geben wir nicht für Picks oder Ergänzungsspieler ab.';
    else if (w.erhalt >= w.noetig) { akzeptiert = true; grund = w.entlastung > 0 ? 'Einverstanden – die Entlastung beim Cap hilft uns.' : 'Einverstanden.'; }
    else {
      const q = w.erhalt / Math.max(0.1, w.noetig);
      grund = q >= 0.9 ? 'Knapp daneben – leg noch etwas drauf.' : q >= 0.65 ? 'Kein gutes Geschäft für uns.' : 'Bist du verrückt?!';
      if (w.extraPicks) grund += ` (Jeder weitere Pick, den wir abgeben, kostet mehr: ${d.bekommt.picks.length} Picks.)`;
      if (w.teuer.length) grund += ` ${w.teuer.map(name).join(', ')}: nur zum Höchstpreis.`;
      if (w.keinBedarf.length) grund += ` Kein Bedarf an ${w.keinBedarf.map(name).join(', ')}.`;
    }
    return {
      akzeptiert, grund, cap, hinweise, lageKI: w.lgB,
      gesperrt: w.gesperrt.map(x => x.p.id), teuer: w.teuer.map(p => p.id), keinBedarf: w.keinBedarf.map(p => p.id),
      // D99: Spieler des Partners, die zu haben sind (will weg 85 %, Abgabe 90 %)
      zuHaben: w.zuHaben.map(x => ({ id: x.p.id, art: x.z.art, faktor: x.z.faktor, gruende: x.z.gruende })),
      kiErhaelt: Math.round(w.erhalt * 10) / 10, kiGibt: Math.round(w.abgabe * 10) / 10, kiBraucht: Math.round(w.noetig * 10) / 10
    };
  }

  // Titelteams: Stammspieler nur gegen einen Spieler, der mindestens 70 % seines Werts hat
  function titelKernVerletzt(L, w) {
    if (w.lgB.key !== 'titel' || !w.vonB.length) return false;
    const elf = new Set(G.startelfVon(w.B.roster, w.B).map(p => p.id));
    const kern = w.vonB.filter(p => elf.has(p.id));
    if (!kern.length) return false;
    const groesster = Math.max(...kern.map(p => spielerWert(p, w.lgB, w.B)));
    const bester = Math.max(0, ...w.vonA.map(p => spielerWert(p, w.lgB)));
    return bester < groesster * CFG.titelKern;
  }
  // Wertkurve der Picks nach Gesamtnummer (1 … 128), für die Wertliste
  function pickWertNr(n, jahreVoraus) {
    return Math.round(pickKurve(n) * Math.pow(CFG.pickAbzinsung, jahreVoraus || 0) * 10) / 10;
  }

  // ── KI-Trades untereinander (Wunsch 2026-10-08) ─────────────────────────
  // Sicht eines KI-Teams auf einen Tausch: Lage, Kaderbedarf aus der eigenen (verrauschten) Analyse
  function sichtTeam(L, T, gibtSp, gibtPk, bekommtSp, bekommtPk, rang, analyse) {
    const lg = lage(L, T, rang);
    const elf = G.startelfVon(T.roster, T);
    const faktor = p => {
      const b = analyse[p.pos];
      if (!b || !b.art) return 1;
      if (b.art !== 'Stammspieler') return 1 + 0.04 * b.bedarf;
      const schwaechster = elf.filter(x => x.pos === p.pos).sort((a, c) => a.ovr - c.ovr)[0];
      return !schwaechster || p.ovr > schwaechster.ovr + 1 ? 1 + CFG.bedarfAufschlag * b.bedarf : 1;
    };
    const rein = paketWert(bekommtSp.map(p => spielerWert(p, lg) * faktor(p) * (stilPasst(L, T, p) ? 1 + CFG.stilBonus : 1)).concat(bekommtPk.map(x => pickWert(L, x, lg, rang).wert)));
    const raus = gibtSp.reduce((s, p) => s + spielerWert(p, lg, T), 0) + gibtPk.reduce((s, x) => s + pickWert(L, x, lg, rang).wert, 0);
    return { rein, raus, lg };
  }
  // Paket des Käufers A für Spieler p von B: was A am wenigsten braucht und B am meisten schätzt
  // (Ergänzungsspieler auf Positionen mit Überschuss, Picks bis 4 Jahre), höchstens 4 Teile
  // info (optional, Messung D99/D110): letzter Ablehnungsgrund; kader = ein Paket hätte vom Wert gereicht, scheiterte aber an der Kadergrenze
  function paketFuer(L, A, B, p, rang, analyseA, info) {
    const lgA = lage(L, A, rang), lgB = lage(L, B, rang), bedB = G.bedarf(B);
    const elf = new Set(G.startelfVon(A.roster, A).map(x => x.id));
    const zaehle = pos => A.roster.filter(x => x.pos === pos).length, sollA = G.kaderSoll(A);
    const teile = [];
    A.roster.filter(x => !elf.has(x.id) && x.pos !== p.pos && zaehle(x.pos) > (sollA[x.pos] || 0) - 1 && !(analyseA[x.pos] && analyseA[x.pos].art === 'Stammspieler'))
      .forEach(x => teile.push({ art: 'spieler', id: x.id, b: spielerWert(x, lgB) * (bedB[x.pos] > 0 ? 1.1 : 1), a: spielerWert(x, lgA, A), cap: G.capHitSpieler(x) - restBonus(x) }));
    L.picks.filter(x => x.besitzer === A.id).forEach(x => teile.push({ art: 'pick', id: x.id, b: pickWert(L, x, lgB, rang).wert, a: pickWert(L, x, lgA, rang).wert }));
    teile.sort((x, y) => (y.b / Math.max(0.5, y.a)) - (x.b / Math.max(0.5, x.a)) || y.b - x.b);
    // Zwei Reihenfolgen: nach Wert (wie bisher) und „erst Gehalt/Kader ausgleichen“ – die ein bis zwei Spieler mit dem
    // größten Cap Hit zuerst. Vorher brach der Bau beim ersten Teil (meist ein Pick) ab, sobald der Käufer über dem Cap
    // oder der Verkäufer unter dem Mindestkader lag: mit vollen Caps (D101) und Kadern von 25 (D74) scheiterten so
    // 98 % der Kandidaten, KI ↔ KI gab es kaum Tausche (Prüfung 2026-10-10: 6 in 21 Offseasons)
    const gehalt = teile.filter(t => t.art === 'spieler' && t.cap > 0).sort((x, y) => y.cap - x.cap).slice(0, 2);
    const reihen = [teile, gehalt.concat(teile.filter(t => gehalt.indexOf(t) < 0))];
    for (const reihe of reihen) {
      const paket = leer(), deal = { von: A.id, an: B.id, gibt: paket, bekommt: { spieler: [p.id], picks: [] } };
      let grund = '';
      for (const t of reihe) {
        if (paket.spieler.length + paket.picks.length >= 4) break;
        (t.art === 'spieler' ? paket.spieler : paket.picks).push(t.id);
        const e = bewerte(L, deal, { ki: true });
        if (e.akzeptiert) return paket;
        if (info) { info.grund = e.grund || ''; if (/^Kader/.test(e.grund) && e.kiErhaelt >= e.kiBraucht) info.kader = true; }
        if (/Titel/.test(e.grund)) return null;                   // grundsätzlich nicht machbar
        grund = e.grund || '';
      }
      if (!/Cap|Kader/.test(grund)) break;                         // am Wert gescheitert: der zweite Weg hilft nicht
    }
    return null;
  }
  // Ein Durchgang: Teams mit klarem Stammspieler-Bedarf suchen eine Verbesserung bei anderen Teams.
  // Beide Seiten müssen gewinnen (aus eigener Sicht), Cap- und Kaderregeln gelten. opt: { ohne, max, saat }
  // opt.stat (Messung D99/D110): Zähler je Kandidat – versuche, ok, kader (Wert hätte gereicht, Kadergrenze), cap, wert, elf,
  // gesperrt, titel, aWill (A will nicht), jeweils auch für D99-Kandidaten (d99, d99ok, d99kader …)
  function kiTrades(L, r, opt) {
    opt = opt || {};
    picks(L);
    const ohne = new Set(opt.ohne || []), max = opt.max || 2, erledigt = [], benutzt = new Set();
    const rang = raenge(L), karten = new Map();
    taktikenSetzen(L);
    // D99: Wechselwünsche auffrischen (Stimmung), dann wer bei anderen Vereinen zu haben ist – diese Spieler zuerst
    if (CFG.zuHaben.aktiv && opt.wuensche !== false) wechselwunschAktualisieren(L, { ohne: [...ohne] });
    const zh = CFG.zuHaben.aktiv ? zuHabenListe(L, { ohne: [...ohne], rang }) : [];
    const st = opt.stat || null, zaehl = (k, d99) => { if (!st) return; st[k] = (st[k] || 0) + 1; if (d99) st['d99' + k] = (st['d99' + k] || 0) + 1; };
    if (st) { st.runden = (st.runden || 0) + 1; st.zuHaben = (st.zuHaben || 0) + zh.length; }
    const teams = L.teams.filter(t => !ohne.has(t.id));
    const reihe = teams.map(t => ({ t, s: r() - 0.3 * geschick(t) })).sort((a, b) => a.s - b.s).map(x => x.t);   // Kluge suchen zuerst
    for (const A of reihe) {
      if (erledigt.length >= max) break;
      if (benutzt.has(A.id)) continue;
      const analyse = G.kaderAnalyse(A, { scouting: (A.anlagen && A.anlagen.scouting) || 5, saat: (L.saisonIndex || 0) * 101 + (opt.saat || 0) });
      const ziel = Object.entries(analyse).filter(([, v]) => v.art === 'Stammspieler' && v.bedarf >= 1.5).sort((x, y) => y[1].bedarf - x[1].bedarf)[0];
      // D99: zuerst, wer bei anderen Vereinen zu haben ist und A verbessert (höchstens kiVersuche, zusätzlich), dann wie bisher
      // (D50, bis zu 6): die Spieler, die A im Auge hat (Bedarf, Taktik, bezahlbar), dann die günstigste Verbesserung
      const d99 = zuHabenFuer(L, A, analyse, zh, rang).filter(x => !benutzt.has(x.B.id)).slice(0, CFG.zuHaben.kiVersuche);
      const kand = [];
      wunschliste(L, A, rang, { ohne: [...ohne], karten, saat: opt.saat }).forEach(w => {
        const B = teamVon(L, w.team), p = B && B.roster.find(q => q.id === w.id);
        if (B && p && !benutzt.has(B.id) && !d99.some(k => k.p === p) && !kand.some(k => k.p === p)) kand.push({ B, p, z: null });
      });
      if (ziel) {
        const pos = ziel[0];
        const start = G.startelfVon(A.roster, A).filter(x => x.pos === pos).sort((a, c) => a.ovr - c.ovr)[0];
        const basis = start ? start.ovr : 0, weitere = [];
        teams.forEach(B => {
          if (B === A || benutzt.has(B.id)) return;
          B.roster.forEach(p => { if (p.pos === pos && p.ovr >= basis + 3 && p.age <= 31 && !kand.some(k => k.p === p) && !d99.some(k => k.p === p)) weitere.push({ B, p, z: null }); });
        });
        weitere.sort((x, y) => spielerWert(x.p) - spielerWert(y.p));        // günstigste Verbesserung
        kand.push(...weitere);
      }
      if (!kand.length && !d99.length) continue;
      for (const { B, p, z } of d99.concat(kand.slice(0, 6))) {
        const pos = p.pos, d99 = !!z;
        zaehl('versuche', d99);
        const info = st ? {} : null;
        const paket = paketFuer(L, A, B, p, rang, analyse, info);
        if (!paket) {
          if (info) { const g = info.grund || ''; zaehl(info.kader ? 'kader' : /^Cap/.test(g) ? 'cap' : /zu wenige/.test(g) ? 'elf' : /nicht zu haben/.test(g) ? 'gesperrt' : /Titel/.test(g) ? 'titel' : /^Kader/.test(g) ? 'kaderWert' : 'wert', d99); }
          continue;
        }
        const gibtSp = spielerIn(A, paket.spieler), gibtPk = paket.picks.map(id => L.picks.find(x => x.id === id));
        const sA = sichtTeam(L, A, gibtSp, gibtPk, [p], [], rang, analyse);
        if (sA.rein < sA.raus * (0.98 + CFG.zielGeschick * geschick(A))) { zaehl('aWill', d99); continue; }   // A muss es auch wollen (Kluge verlangen mehr)
        const kaderA = A.roster.length - gibtSp.length + 1;
        if (kaderA > CFG.kaderMax || (kaderA < CFG.kaderMin && kaderA < A.roster.length)) { zaehl('kader', d99); continue; }   // D74: Start mit 25
        if (elfLuecke(A, gibtSp, [p]) || elfLuecke(B, [p], gibtSp)) { zaehl('elf', d99); continue; }
        const zText = z ? (z.art === 'weg' ? ', wollte weg' : ', abgegeben') : '';
        const texte = { a: gibtSp.map(x => name(x) + ' (' + x.pos + ', ' + x.ovr + ')').concat(gibtPk.map(x => x.jahr + ' Runde ' + x.runde)), b: [name(p) + ' (' + p.pos + ', ' + p.ovr + zText + ')'] };
        const aus = ausfuehren(L, { von: A.id, an: B.id, gibt: paket, bekommt: { spieler: [p.id], picks: [] } }, { ki: true });
        if (!aus.ausgefuehrt) { zaehl('wert', d99); continue; }
        zaehl('ok', d99);
        erledigt.push({ von: A.id, an: B.id, pos, spieler: p, texte, lageA: sA.lg.text, zuHaben: z ? { art: z.art, gruende: z.gruende } : null });
        benutzt.add(A.id); benutzt.add(B.id);
        break;
      }
    }
    return erledigt;
  }
  // Draft-Trade-up: Paket aus Picks des Teams T, das mindestens den Wert des Ziel-Picks hat (Wertkurve).
  // slotNr: Map pickId → Gesamtnummer im laufenden Draft; Picks dieses Drafts zählen nur nach `aktuell`.
  // opt.skepsis: Picks des Nutzers etwas schlechter schätzen (wie in der Trade-Zentrale)
  // Picks des Teams T, die es in einem Draft-Trade abgeben kann, mit Wert (dieser Draft: nur nach `aktuell`)
  function draftPicksVon(L, T, aktuell, slotNr, opt) {
    picks(L);
    const jahr0 = L.draft ? L.draft.jahr : null, rang = raenge(L);
    const wert = x => x.jahr === jahr0 ? (slotNr.has(x.id) ? pickWertNr(slotNr.get(x.id)) : 0)
      : pickWert(L, x, LAGEN.mittelfeld, rang, opt && opt.skepsis ? CFG.nutzerPickSkepsis : 0).wert;
    return L.picks.filter(x => x.besitzer === T.id && (x.jahr !== jahr0 || (slotNr.has(x.id) && slotNr.get(x.id) > aktuell)))
      .map(x => ({ x, w: wert(x) })).filter(a => a.w > 0);
  }
  const draftPickText = (x, jahr0, slotNr) => x.jahr === jahr0 ? `#${slotNr.get(x.id)} (${x.jahr})` : `${x.jahr} Runde ${x.runde}`;
  function hochtradenPaket(L, T, zielNr, aktuell, slotNr, opt) {
    opt = opt || {};
    const jahr0 = L.draft ? L.draft.jahr : null;
    const eigene = draftPicksVon(L, T, aktuell, slotNr, opt);
    const ziel = pickWertNr(zielNr) * (1 + CFG.marge) * (opt.aufschlag || 1);
    // D94: das für den Geber günstigste Paket – der nächste eigene Pick dieses Drafts ist immer dabei, dazu
    // höchstens 3 weitere (ohne eigenen Pick 4). Der Empfänger wertet mit „Qualität vor Menge“ (paketWert),
    // der Geber zahlt die volle Summe (D96). Vorher nahm die KI Zukunftspicks absteigend und bot das
    // 1,26- bis 1,63-Fache des Slots (für Runde 2–3 oft einen ganzen Erstrundenpick).
    const diesJahr = eigene.filter(a => a.x.jahr === jahr0).sort((a, b) => slotNr.get(a.x.id) - slotNr.get(b.x.id));
    const pflicht = diesJahr[0] || null, rest = eigene.filter(a => a !== pflicht);
    const maxDazu = pflicht ? 3 : 4;
    let best = null;
    const pruefe = teile => {
      const alle = pflicht ? [pflicht].concat(teile) : teile;
      if (!alle.length) return;
      const fuerEmpfaenger = paketWert(alle.map(a => a.w)), kosten = alle.reduce((q, a) => q + a.w, 0);
      if (fuerEmpfaenger < ziel) return;
      if (!best || kosten < best.kosten - 1e-9 || (Math.abs(kosten - best.kosten) < 1e-9 && alle.length < best.teile.length)) best = { summe: fuerEmpfaenger, kosten, teile: alle };
    };
    const suche = (ab, teile) => {
      pruefe(teile);
      if (teile.length >= maxDazu) return;
      for (let i = ab; i < rest.length; i++) suche(i + 1, teile.concat([rest[i]]));
    };
    suche(0, []);
    if (!best) return null;
    const paket = best.teile.slice().sort((a, b) => (a.x.jahr - b.x.jahr) || (a.x.jahr === jahr0 ? slotNr.get(a.x.id) - slotNr.get(b.x.id) : a.x.runde - b.x.runde));
    const summe = best.summe;
    return { picks: paket.map(a => a.x.id), wert: Math.round(summe * 10) / 10, ziel: Math.round(ziel * 10) / 10,
      kosten: Math.round(best.kosten * 10) / 10, texte: paket.map(a => draftPickText(a.x, jahr0, slotNr)), werte: paket.map(a => Math.round(a.w * 10) / 10) };
  }
  // D94 Fenster „will deinen Pick unbedingt“: einmal nachbessern – ein weiterer Pick des Gebers, der das Paket
  // für den Empfänger um mindestens `plus` (5 %) hebt, aber nicht über `grenze` (Ziel × 1,12); der billigste davon.
  function hochtradenNachbessern(L, T, paket, aktuell, slotNr, grenze, plus) {
    const jahr0 = L.draft ? L.draft.jahr : null, drin = new Set(paket.picks);
    const eigene = draftPicksVon(L, T, aktuell, slotNr);
    const jetzt = eigene.filter(a => drin.has(a.x.id));
    if (jetzt.length !== paket.picks.length) return null;      // Paket gehört nicht mehr ganz dem Geber
    const vorher = paketWert(jetzt.map(a => a.w)), mind = vorher * (1 + (plus != null ? plus : 0.05));
    const k = eigene.filter(a => !drin.has(a.x.id))
      .map(a => ({ a, fuer: paketWert(jetzt.concat([a]).map(b => b.w)) }))
      .filter(z => z.fuer >= mind && z.fuer <= grenze).sort((p, q) => p.a.w - q.a.w)[0];
    if (!k) return null;
    const teile = jetzt.concat([k.a]).sort((a, b) => (a.x.jahr - b.x.jahr) || (a.x.jahr === jahr0 ? slotNr.get(a.x.id) - slotNr.get(b.x.id) : a.x.runde - b.x.runde));
    return { picks: teile.map(a => a.x.id), wert: Math.round(k.fuer * 10) / 10, ziel: paket.ziel,
      kosten: Math.round(teile.reduce((s, a) => s + a.w, 0) * 10) / 10, texte: teile.map(a => draftPickText(a.x, jahr0, slotNr)),
      werte: teile.map(a => Math.round(a.w * 10) / 10), dazu: draftPickText(k.a.x, jahr0, slotNr) };
  }

  // ── Wunschliste (D50): wen ein KI-Verein im Auge hat ─────────────────────
  // Lücke in der Startelf (Kaderanalyse mit eigenem Scouting), Verbesserung ≥ 2, Alter passend zur Lage,
  // bezahlbar (≤ 70 % der Kaufkraft aus Ergänzungsspielern und Picks), passt in den Cap, nicht gesperrt.
  // Bewertet nach Verbesserung, Stil-Passung, Bedarf und Preis. opt: { ohne, nur (nur dieses Team durchsuchen), sperre, karten, saat, max }
  function wunschliste(L, A, rang, opt) {
    opt = opt || {}; picks(L); taktikenSetzen(L);
    rang = rang || raenge(L);
    const W = CFG.wunsch, lgA = lage(L, A, rang), stil = stilVon(A), sch = stilSchnitt(L);
    const ana = G.kaderAnalyse(A, { scouting: (A.anlagen && A.anlagen.scouting) || 5, saat: (L.saisonIndex || 0) * 101 + (opt.saat || 0) });
    const elf = G.startelfVon(A.roster, A), elfIds = new Set(elf.map(x => x.id));
    const kaufkraft = A.roster.filter(x => !elfIds.has(x.id)).reduce((s, x) => s + spielerWert(x, lgA, A), 0)
      + L.picks.filter(x => x.besitzer === A.id).reduce((s, x) => s + pickWert(L, x, lgA, rang).wert, 0) * 0.6;
    const capFrei = A.salary_cap_limit - G.capHitTeam(A), maxAlter = W.alter[lgA.key] || 30;
    const karten = opt.karten || new Map(), ohne = new Set(opt.ohne || []), sperre = new Set(opt.sperre || []);
    // D99: wer bei B zu haben ist, kostet 85 % / 90 % (Kontext je Verein einmal, nur für Vereine mit Kandidaten)
    const kontexte = opt.kontexte || new Map();
    const kontext = (B, k) => { let c = kontexte.get(B.id); if (!c) { c = abgabeKontext(L, B, rang, k); kontexte.set(B.id, c); } return c; };
    const kand = [];
    Object.entries(ana).filter(([, v]) => v.art === 'Stammspieler' && v.bedarf >= 1).forEach(([pos, v]) => {
      const st = elf.filter(x => x.pos === pos).map(x => x.ovr), basis = st.length ? Math.min(...st) : 0;
      L.teams.forEach(B => {
        if (B === A || ohne.has(B.id) || (opt.nur && B.id !== opt.nur)) return;
        let k = karten.get(B.id); if (!k) { k = schutzKarte(L, B, rang, B.id === opt.nutzer ? { nutzer: true } : null); karten.set(B.id, k); }
        B.roster.forEach(p => {
          if (p.pos !== pos || p.ovr < basis + 2 || p.age > maxAlter || sperre.has(p.id) || p.ir) return;
          const sz = k.get(p.id) || { stufe: 'normal', faktor: 1 };
          if (sz.stufe === 'gesperrt') return;
          const z = CFG.zuHaben.aktiv && B.id !== opt.nutzer ? zuHabenInfo(L, B, p, kontext(B, k)) : null;
          const preis = spielerWert(p, lgA) * (z ? z.faktor : (sz.faktor || 1));
          if (preis > kaufkraft * W.kaufkraft || G.capHitSpieler(p) > capFrei + W.capPuffer) return;
          const fit = stil && stilRelevant(p, stil) ? stilWert(p, stil) - sch[stil] : 0;
          kand.push({ id: p.id, team: B.id, pos, ovr: p.ovr, fit: Math.round(fit),
            score: (p.ovr - basis) * 1.5 + 0.5 * fit + v.bedarf * 2 - preis / Math.max(1, kaufkraft) * 6 });
        });
      });
    });
    return kand.sort((a, b) => b.score - a.score).slice(0, opt.max || W.max);
  }
  // Wunschlisten aller KI-Vereine speichern (für Anfragen an den Nutzer und „Interesse“ in der Anzeige).
  // opt: { nutzer: id des Nutzerteams (bekommt keine Liste), sperre: unverkäufliche Spieler, saat }
  function beobachtungAktualisieren(L, opt) {
    opt = opt || {};
    const rang = raenge(L), karten = new Map();
    L.teams.forEach(A => {
      if (A.id === opt.nutzer) { A.beobachtet = []; return; }
      A.beobachtet = wunschliste(L, A, rang, { sperre: opt.sperre, karten, saat: opt.saat, nutzer: opt.nutzer });
    });
  }

  // ── D99: Spieler wollen weg, Vereine geben Spieler ab ────────────────────
  // Wechselwunsch als Zustand am Spieler: p.weg = { team, seit, summe, gruende: [{ k, t }] }. Entsteht unter −2,0 (Stimmung im eigenen
  // Verein), endet über −1,5 oder mit dem Vereinswechsel; nie im Rookie-Vertrag bis 22. Braucht DFLStimmung (sonst nichts zu tun).
  // opt.ohne: Vereine, die nicht zählen (der eigene Verein im Spiel: dessen Spieler sind SQUAD, ihr Wunsch lebt im Spiel)
  function wechselwunschAktualisieren(L, opt) {
    opt = opt || {};
    const ST = typeof window !== 'undefined' && window.DFLStimmung, Z = CFG.zuHaben, n = { weg: 0, neu: 0, ende: 0 };
    if (!Z.aktiv || !ST || !ST.stimmung) return n;
    const ohne = new Set(opt.ohne || []);
    const ende = p => { if (p.weg) { delete p.weg; n.ende++; } };
    (L.freie || []).forEach(ende);                                   // vereinslos: der Wunsch hat sich erledigt
    L.teams.forEach(t => {
      (t.practice_squad || []).forEach(ende);
      if (ohne.has(t.id)) return;
      const elf = new Set(G.startelfVon(t.roster, t).map(x => x.id));
      const spieltag = new Set(t.roster.slice().sort((x, y) => y.ovr - x.ovr).slice(0, 18).map(x => x.id));
      // D118: Sportpsychologe – der Wunsch entsteht (und endet) 0,1 je Stern später
      const Tr = window.DFLTrainer, psy = Tr && Tr.CFG.aktiv ? Tr.wegVerschiebung(t) : 0;
      t.roster.forEach(p => {
        if (p.weg && p.weg.team !== t.id) ende(p);                    // Vereinswechsel
        if (p.contract && p.contract.art === 'rookie' && p.age <= Z.rookieBis) { ende(p); return; }
        const s = ST.stimmung(p, t, L, { elf, spieltag });
        if (s.summe < Z.weg - psy || (p.weg && s.summe <= Z.wegEnde - psy)) {
          if (!p.weg) { p.weg = { team: t.id, seit: L.saisonJahr || 0 }; n.neu++; }
          p.weg.summe = s.summe;
          p.weg.gruende = s.teile.filter(x => x.wert < 0).slice(0, 3).map(x => ({ k: x.key, t: String(x.text).replace(/ \(.*\)$/, '') }));
          n.weg++;
        } else ende(p);
      });
    });
    return n;
  }
  // Kontext eines Vereins für die Abgabe-Regeln (einmal je Verein und Rechnung): Lage, freier Cap, Stil, Startelf, Schutzstufen
  function abgabeKontext(L, t, rang, karte) {
    rang = rang || raenge(L);
    return { lg: lage(L, t, rang), capFrei: t.salary_cap_limit - G.capHitTeam(t), stil: stilVon(t),
      elf: new Set(G.startelfVon(t.roster, t).map(p => p.id)), karte: karte || schutzKarte(L, t, rang) };
  }
  // Warum gibt Verein t den Spieler p ab? Nur Schutzstufe „normal“ (nie gesperrt, Top 3, große Talente); [] = gibt nicht ab
  function abgabeGruende(L, t, p, k) {
    const Z = CFG.zuHaben;
    if (!Z.aktiv || !p || p.ir) return [];
    k = k || abgabeKontext(L, t);
    const sz = k.karte.get(p.id) || { stufe: 'normal' };
    if (sz.stufe !== 'normal') return [];
    const hit = G.capHitSpieler(p), ueber = hit / Math.max(1, G.marktgehalt(p)), g = [];
    // D110 (Nutzer zu D99): Cap-Not zählt erst ab dem Kaderschnitt der Saison (nach den Free-Agency-Wellen, DFLSaison.phaseKader setzt
    // L.kaderschnitt) – davor lagen viele KI-Kader nur bis zum Kaderschnitt über dem Cap
    if (L.kaderschnitt === L.saisonJahr && k.capFrei < Z.cap.frei && ueber > Z.cap.ueber && hit > Z.cap.hit) g.push('cap');
    if (k.lg.key === 'neuaufbau' && p.age >= Z.neuaufbau.alter && p.contract && p.contract.years_remaining >= Z.neuaufbau.jahre && p.ovr >= Z.neuaufbau.ovr) g.push('neuaufbau');
    if (k.stil && !k.elf.has(p.id) && p.ovr >= Z.stil.ovr && spielerPassung(L, p, k.stil) <= Z.stil.passung) g.push('stil');
    const gleich = t.roster.filter(x => x.pos === p.pos).sort((a, b) => b.ovr - a.ovr), sollT = G.kaderSoll(t)[p.pos];
    if (gleich.length > (sollT != null ? sollT : 1) + Z.ueberschuss.mehr && gleich[gleich.length - 1] === p && p.ovr >= Z.ueberschuss.ovr) g.push('ueberschuss');
    return g;
  }
  // Ist p bei t zu haben? { art: 'weg' | 'ab', faktor (Preis), gruende: ['weg', 'cap', …], weg } oder null (gesperrte nie)
  function zuHabenInfo(L, t, p, k) {
    const Z = CFG.zuHaben;
    if (!Z.aktiv || !t || !p) return null;
    k = k || abgabeKontext(L, t);
    const sz = k.karte.get(p.id) || { stufe: 'normal' };
    if (sz.stufe === 'gesperrt') return null;
    const ab = abgabeGruende(L, t, p, k);
    if (willWeg(p, t)) return { art: 'weg', faktor: Z.faktorWeg, gruende: ['weg'].concat(ab), weg: p.weg };
    return ab.length ? { art: 'ab', faktor: Z.faktorAb, gruende: ab } : null;
  }
  // Alle, die in der Liga zu haben sind: [{ p, team, art, faktor, gruende, weg }] (opt.ohne: Vereine ohne Liste, z. B. der eigene)
  function zuHabenListe(L, opt) {
    opt = opt || {};
    if (!CFG.zuHaben.aktiv) return [];
    const ohne = new Set(opt.ohne || []), rang = opt.rang || raenge(L), aus = [];
    taktikenSetzen(L);
    L.teams.forEach(t => {
      if (ohne.has(t.id)) return;
      const k = abgabeKontext(L, t, rang);
      t.roster.forEach(p => { const z = zuHabenInfo(L, t, p, k); if (z) aus.push(Object.assign({ p, team: t }, z)); });
    });
    return aus;
  }
  // KI-Tausche (D99): wen A aus der Liste holen will – Stammspieler-Bedarf ≥ 1 auf seiner Position, Verbesserung ≥ 2, Alter nach Lage,
  // bezahlbar (Preis mit Rabatt ≤ 70 % der Kaufkraft) und im Cap (wie die Wunschliste); gesund
  function zuHabenFuer(L, A, analyse, liste, rang) {
    if (!liste || !liste.length) return [];
    const W = CFG.wunsch, lgA = lage(L, A, rang), maxAlter = W.alter[lgA.key] || 30;
    const elf = G.startelfVon(A.roster, A), elfIds = new Set(elf.map(x => x.id));
    const kaufkraft = A.roster.filter(x => !elfIds.has(x.id)).reduce((s, x) => s + spielerWert(x, lgA, A), 0)
      + (L.picks || []).filter(x => x.besitzer === A.id).reduce((s, x) => s + pickWert(L, x, lgA, rang).wert, 0) * 0.6;
    const capFrei = A.salary_cap_limit - G.capHitTeam(A), aus = [];
    Object.entries(analyse).filter(([, v]) => v.art === 'Stammspieler' && v.bedarf >= 1).forEach(([pos, v]) => {
      const st = elf.filter(x => x.pos === pos).map(x => x.ovr), basis = st.length ? Math.min(...st) : 0;
      liste.forEach(z => {
        const p = z.p;
        if (z.team.id === A.id || p.pos !== pos || p.ovr < basis + 2 || p.age > maxAlter || p.ir || p.aus > 0) return;
        if (spielerWert(p, lgA) * z.faktor > kaufkraft * W.kaufkraft || G.capHitSpieler(p) > capFrei + W.capPuffer) return;
        aus.push({ B: z.team, p, z, score: (p.ovr - basis) * 1.5 + v.bedarf * 2 + (z.art === 'weg' ? 1 : 0) });
      });
    });
    return aus.sort((a, b) => b.score - a.score);
  }
  // Angebot an den Nutzer (D99): ein KI-Verein bietet dir einen Spieler an, der bei ihm zu haben ist – nur mit Lücke in deiner
  // Kaderanalyse (Bedarf ≥ 1,2), passend zu deinem Stil (Passung ≥ −0,5), ab Stärke 74, gesund. Sie verlangen das für dich günstigste
  // Paket aus 1–2 Teilen (Picks oder Spieler außerhalb deiner Startelf), das sie annehmen (bewerte: Preis 85/90 %, Cap beider Seiten,
  // Kader). opt: { analyse (deine Kaderanalyse), stil (dein Stil), ohneTeams, ohneSpieler (IDs), sperre (deine unverkäuflichen,
  // Welt-IDs), kader { jetzt, max, min, grenze, laeuft } (deine Kadergrenzen im Spiel), liste (zuHabenListe), stat }
  function angebotFuer(L, A, opt) {
    opt = opt || {}; picks(L); taktikenSetzen(L);
    const Z = CFG.zuHaben, AG = Z.angebot, rang = raenge(L), lgA = lage(L, A, rang), st = opt.stat || null;
    const zaehl = k => { if (st) st[k] = (st[k] || 0) + 1; };
    if (!Z.aktiv) return null;
    const ana = opt.analyse || G.kaderAnalyse(A, { scouting: (A.anlagen && A.anlagen.scouting) || 5, saat: (L.saisonIndex || 0) * 101 });
    const ohneT = new Set(opt.ohneTeams || []), ohneS = new Set(opt.ohneSpieler || []), sperre = new Set(opt.sperre || []);
    const liste = opt.liste || zuHabenListe(L, { ohne: [A.id], rang });
    const pass = z => (opt.stil ? spielerPassung(L, z.p, opt.stil) : 0);
    // Titelkandidaten geben Stammspieler nicht für Ergänzungsspieler oder Picks ab (titelKernVerletzt) – solche Kandidaten gar nicht erst
    // nehmen, sonst scheitern alle Pakete an bewerte (Prüflauf 2026-10-14: in manchen Welten wochenlang kein Angebot)
    const elfVon = new Map(), titelKern = z => {
      if (lage(L, z.team, rang).key !== 'titel') return false;
      if (!elfVon.has(z.team.id)) elfVon.set(z.team.id, new Set(G.startelfVon(z.team.roster, z.team).map(x => x.id)));
      return elfVon.get(z.team.id).has(z.p.id);
    };
    const kand = liste.filter(z => !ohneT.has(z.team.id) && !ohneS.has(z.p.id) && !z.p.ir && !(z.p.aus > 0) && z.p.ovr >= AG.ovr
      && ((ana[z.p.pos] && ana[z.p.pos].bedarf) || 0) >= AG.bedarf && pass(z) >= AG.passung && !titelKern(z))
      .map(z => Object.assign({ fit: (ana[z.p.pos].bedarf || 0) + Math.max(0, pass(z)) + z.p.ovr / 8 }, z))
      .sort((a, b) => b.fit - a.fit);
    if (st) st.kandidaten = (st.kandidaten || 0) + kand.length;
    // Deine Teile: Spieler außerhalb der Startelf (nicht verletzt, nicht unverkäuflich) und Picks
    const elfA = new Set(G.startelfVon(A.roster, A).map(x => x.id));
    const eigene = A.roster.filter(q => !elfA.has(q.id) && !q.ir && !sperre.has(q.id)).map(q => ({ art: 'spieler', id: q.id, q, kosten: spielerWert(q, lgA, A) }))
      .concat((L.picks || []).filter(x => x.besitzer === A.id).map(x => ({ art: 'pick', id: x.id, x, kosten: pickWert(L, x, lgA, rang).wert })));
    const K = opt.kader || null;
    for (const z of kand.slice(0, AG.kandidaten)) {
      const B = z.team, p = z.p, lgB = lage(L, B, rang), bedB = G.bedarf(B);
      // Was B für deine Teile gibt – wie werteKI (Bedarf, Interesse/kein Bedarf, Stil); deine Picks mit der Nutzer-Skepsis
      const wB = t => {
        if (t.art === 'pick') return pickWert(L, t.x, lgB, rang, t.x.von === A.id ? CFG.nutzerPickSkepsis : 0).wert;
        let w = spielerWert(t.q, lgB) * (bedB[t.q.pos] > 0 ? 1.1 : 1);
        if (!interesse(L, B, t.q, rang)) w *= CFG.keinBedarf; else if (stilPasst(L, B, t.q)) w *= 1 + CFG.stilBonus;
        return w;
      };
      const teile = eigene.map(t => Object.assign({ w: wB(t) }, t)).filter(t => t.w > 0.5);
      const w0 = werteKI(L, normal({ von: A.id, an: B.id, gibt: leer(), bekommt: { spieler: [p.id], picks: [] } }), rang);
      const preis = w0.noetig;
      // was B bekommt wie in werteKI: Paket (Qualität vor Menge) + Entlastung, wenn B über dem Cap liegt und Gehalt loswird
      const capVor = G.capHitTeam(B);
      const fuerB = k => {
        const sp = k.filter(t => t.art === 'spieler').map(t => t.q), danach = capNach(B, [p], sp);
        const ent = capVor > B.salary_cap_limit && danach < capVor ? (capVor - Math.max(danach, B.salary_cap_limit * 0.97)) / 1e6 * CFG.capNot : 0;
        return paketWert(k.map(t => t.w)) + Math.max(0, ent);
      };
      const kombis = [];
      teile.forEach(t => { if (fuerB([t]) >= preis) kombis.push([t]); });
      const top = teile.slice().sort((a, b) => b.w - a.w).slice(0, AG.paare);
      for (let i = 0; i < top.length; i++) for (let j = i + 1; j < top.length; j++) if (fuerB([top[i], top[j]]) >= preis) kombis.push([top[i], top[j]]);
      kombis.sort((a, b) => (a.reduce((s, t) => s + t.kosten, 0) - b.reduce((s, t) => s + t.kosten, 0)) || (a.length - b.length));
      let gefunden = null, kaderBlock = false;
      for (const k of kombis.slice(0, AG.pruefen)) {
        const sp = k.filter(t => t.art === 'spieler'), deal = { von: A.id, an: B.id, gibt: { spieler: sp.map(t => t.id), picks: k.filter(t => t.art === 'pick').map(t => t.id) },
          bekommt: { spieler: [p.id], picks: [] } };
        // deine Kadergrenzen im Spiel (DFLTrade.ausfuehrenDeal): ab dem Kaderschnitt höchstens 28, in der Saison mindestens 21
        if (K) {
          const nachher = K.jetzt - sp.length + 1;
          if ((K.grenze && nachher > Math.max(K.max, K.jetzt)) || (K.laeuft && nachher < K.min)) { kaderBlock = true; continue; }
        }
        const e = bewerte(L, deal);
        if (!e.akzeptiert) {
          if (st) { st.gruende = st.gruende || {}; const g = String(e.grund || '?').slice(0, 40); st.gruende[g] = (st.gruende[g] || 0) + 1; }   // Prüflauf: warum abgelehnt
          if (/^Kader/.test(e.grund) && e.kiErhaelt >= e.kiBraucht) kaderBlock = true; continue;
        }
        gefunden = { deal, e, teile: k };
        break;
      }
      if (!gefunden) { zaehl(kaderBlock ? 'kader' : kombis.length ? 'abgelehnt' : 'zuTeuer'); continue; }
      zaehl('ok');
      const g = gefunden, kosten = g.teile.reduce((s, t) => s + t.kosten, 0);
      return { B, p, z, deal: g.deal, e: g.e, preis: Math.round(preis * 10) / 10, wertVoll: Math.round(spielerWert(p, lgB, B) * 10) / 10,
        fuerB: Math.round(fuerB(g.teile) * 10) / 10, kosten: Math.round(kosten * 10) / 10,
        // Waage der Tausch-Karte (D76) wie bei Anfragen: was du gibst (deine Sicht, linear) gegen seinen Wert für dich (ohne Abschlag)
        verlust: Math.round(kosten), wertFuerA: Math.round(spielerWert(p, lgA)),
        bedarf: ana[p.pos].bedarf, passung: Math.round(pass(z) * 10) / 10,
        teile: g.teile.map(t => t.art === 'spieler' ? { art: 'spieler', id: t.id, text: name(t.q) + ' (' + t.q.pos + ', ' + t.q.ovr + ', ' + t.q.age + ' J.)', w: Math.round(t.w * 10) / 10 }
          : { art: 'pick', id: t.id, text: 'Pick ' + pickText(L, t.x, rang), w: Math.round(t.w * 10) / 10 }) };
    }
    return null;
  }

  // ── Anfragen an den Nutzer (D50) ─────────────────────────────────────────
  // Spieler: KI-Team B will p von A. Paket aus B-Picks (Runde 1–3, bis 4 Jahre) und Ergänzungsspielern, höchstens 3 Teile,
  // fair für A (95–120 % seines Verlusts aus A-Sicht) und für B annehmbar – mit Interessenzuschlag.
  // D97: der Verlust trägt dieselben Aufschläge, die die KI für ihre eigenen Spieler verlangt (Gesicht des Vereins über
  // spielerWert mit Team, Top 3 ×2,5, Talente nach D96) – sonst bot die KI für deine Stars nur den Grundwert.
  // opt.mindestens: Nachbessern – das neue Paket muss für A mindestens so viel wert sein (B legt dafür +10 % Interesse drauf)
  function anfragePaket(L, B, A, p, opt) {
    opt = opt || {}; picks(L); taktikenSetzen(L);
    const rang = raenge(L), lgA = lage(L, A, rang), zuschlag = interessenZuschlag(L, B, p) + (opt.mindestens ? 0.1 : 0);
    const stA = schutzKarte(L, A, rang, { nutzer: true }).get(p.id) || { stufe: 'normal', faktor: 1 };
    const aufschlag = stA.stufe === 'teuer' ? { faktor: stA.faktor, grund: stA.grund } : null;
    const verlust = Math.max(spielerWert(p, lgA, A) * (aufschlag ? aufschlag.faktor : 1), (opt.mindestens || 0) / 0.95);
    const elf = new Set(G.startelfVon(B.roster, B).map(x => x.id)), sk = schutzKarte(L, B, rang);
    const assets = [];
    B.roster.filter(x => !elf.has(x.id) && !x.ir && (sk.get(x.id) || {}).stufe === 'normal')
      .forEach(x => assets.push({ art: 'spieler', id: x.id, w: spielerWert(x, lgA), cap: G.capHitSpieler(x), text: name(x) + ' (' + x.pos + ', ' + x.ovr + ', ' + x.age + ' J.)' }));
    L.picks.filter(x => x.besitzer === B.id && x.runde <= 3)
      .forEach(x => assets.push({ art: 'pick', id: x.id, w: pickWert(L, x, lgA, rang).wert, text: 'Pick ' + pickText(L, x, rang) }));
    const nurPicks = assets.filter(a => a.art === 'pick');
    const varianten = [{ pflicht: [], liste: nurPicks }, { pflicht: [], liste: assets }];
    // Liegt B mit p über dem Cap: Gehalt zurückschicken (Ergänzungsspieler mit genug Cap Hit, der günstigste), Rest in Picks
    const capUeber = capNach(B, [], [p]) - B.salary_cap_limit;
    if (capUeber > 0) {
      const geh = assets.filter(a => a.art === 'spieler' && a.cap - restBonus(B.roster.find(x => x.id === a.id)) >= capUeber && a.w <= verlust * 1.2).sort((a, b) => a.w - b.w)[0];
      if (geh) varianten.push({ pflicht: [geh], liste: nurPicks });
    }
    let best = null;
    for (const v of varianten) {
      const deal = { von: A.id, an: B.id, gibt: { spieler: [p.id], picks: [] }, bekommt: leer() }, teile = [];
      let summe = 0;
      const pw = liste => paketWert(liste.map(t => t.w));      // Qualität vor Menge: Wert des Pakets für A
      v.pflicht.forEach(a => { deal.bekommt.spieler.push(a.id); teile.push(a); summe = pw(teile); });
      for (const a of v.liste.slice().sort((x, y) => y.w - x.w)) {
        if (summe >= verlust * 0.95 || teile.length >= 3) break;
        if (pw(teile.concat([a])) > verlust * 1.2) continue;
        (a.art === 'spieler' ? deal.bekommt.spieler : deal.bekommt.picks).push(a.id); teile.push(a); summe = pw(teile);
      }
      if (summe < verlust * 0.95) continue;
      const e = bewerte(L, deal, { interesse: zuschlag });
      if (e.akzeptiert && (!best || summe < best.summe)) best = { deal, summe, teile, e };
    }
    return best ? { art: 'spieler', deal: best.deal, interesse: zuschlag, teile: best.teile.map(t => t.text),
      wertFuerA: Math.round(best.summe), verlust: Math.round(verlust), aufschlag, cap: best.e.cap } : null;
  }
  // Pick nach unten (Wunsch 2026-10-09): B will den besseren Erstrundenpick x von A und gibt dafür mindestens zwei
  // schwächere – einer davon aus demselben Jahrgang. Spart A meist Rookie-Cap und bringt einen zweiten Versuch.
  function pickAnfrage(L, B, A, x, opt) {
    opt = opt || {}; picks(L);
    const rang = raenge(L), lgA = lage(L, A, rang), lgB = lage(L, B, rang);
    const ziel = pickWert(L, x, lgA, rang), wertA = Math.max(ziel.wert, (opt.mindestens || 0) / 0.98);
    const eigene = L.picks.filter(k => k.besitzer === B.id && k.runde <= 3).map(k => ({ k, w: pickWert(L, k, lgA, rang), wB: pickWert(L, k, lgB, rang).wert }))
      .filter(a => a.w.platz > ziel.platz);
    const gleich = eigene.filter(a => a.k.jahr === x.jahr).sort((a, b) => a.w.platz - b.w.platz);
    if (!gleich.length) return null;
    // Paket: der nächstbeste Pick desselben Jahrgangs + 1–2 weitere; gesucht wird das für B günstigste (volle Summe aus
    // B-Sicht), das für A reicht (Qualität vor Menge: 98–130 % von A's Pick)
    const pw = liste => paketWert(liste.map(a => a.w.wert));
    const rest = eigene.filter(a => a !== gleich[0]);
    let paket = null, summe = 0, kosten = Infinity;
    const pruefen = liste => {
      const fuerA = pw(liste), fuerB = liste.reduce((s, a) => s + a.wB, 0);
      if (fuerA >= wertA * 0.98 && fuerA <= wertA * 1.3 && fuerB < kosten) { paket = liste; summe = fuerA; kosten = fuerB; }
    };
    rest.forEach((a, i) => { pruefen([gleich[0], a]); rest.slice(i + 1).forEach(b => pruefen([gleich[0], a, b])); });
    if (!paket) return null;
    const deal = { von: A.id, an: B.id, gibt: { spieler: [], picks: [x.id] }, bekommt: { spieler: [], picks: paket.map(a => a.k.id) } };
    const zuschlag = 0.25 + (opt.mindestens ? 0.1 : 0);           // wer hochtauschen will, zahlt einen Aufpreis
    // ki: true – fragt die KI selbst nach dem Pick, schätzt sie ihn nicht schlechter (keine Nutzer-Skepsis)
    const e = bewerte(L, deal, { interesse: zuschlag, ki: true });
    if (!e.akzeptiert) return null;
    const rookie = pl => (G.rookieCapHit || G.rookieGehalt)(Math.max(1, Math.min(128, pl)));      // Cap Hit im ersten Jahr wie gebucht
    return { art: 'pick', deal, interesse: zuschlag, ki: true, teile: paket.map(a => 'Pick ' + pickText(L, a.k, rang)), wertFuerA: Math.round(summe), verlust: Math.round(wertA),
      pick: 'Pick ' + pickText(L, x, rang), rookieVorher: rookie(ziel.platz), rookieNachher: paket.filter(a => a.k.jahr === x.jahr).reduce((s, a) => s + rookie(a.w.platz), 0) };
  }

  // Nachbessern (D50): dem bisherigen Angebot ein Teil hinzufügen – das kleinste, das es für A um mindestens 8 % besser
  // macht und das B (mit etwas mehr Interesse) noch mitträgt. opt: { interesse, ki, plus }
  function paketNachbessern(L, deal, opt) {
    opt = opt || {}; picks(L); taktikenSetzen(L);
    const rang = raenge(L), A = teamVon(L, deal.von), B = teamVon(L, deal.an), lgA = lage(L, A, rang);
    const kopie = d => ({ von: d.von, an: d.an, gibt: { spieler: (d.gibt.spieler || []).slice(), picks: (d.gibt.picks || []).slice() },
      bekommt: { spieler: (d.bekommt.spieler || []).slice(), picks: (d.bekommt.picks || []).slice() } });
    const basis = kopie(deal);
    const pkVon = id => L.picks.find(x => x.id === id);
    const teil = (art, id) => {
      if (art === 'pick') { const x = pkVon(id); return { art, id, w: pickWert(L, x, lgA, rang).wert, text: 'Pick ' + pickText(L, x, rang), x }; }
      const p = B.roster.find(q => q.id === id);
      if (!p) return { art, id, w: null, text: '–' };   // 2026-10-21 (Fehleranalyse G7): Spieler inzwischen weg (getauscht/entlassen) – vorher TypeError im Wochentakt
      return { art, id, w: spielerWert(p, lgA), text: name(p) + ' (' + p.pos + ', ' + p.ovr + ', ' + p.age + ' J.)' };
    };
    const jetzt = basis.bekommt.spieler.map(id => teil('spieler', id)).concat(basis.bekommt.picks.map(id => teil('pick', id))).filter(t => t.w != null);
    const summe = paketWert(jetzt.map(t => t.w));
    const elf = new Set(G.startelfVon(B.roster, B).map(x => x.id)), sk = schutzKarte(L, B, rang);
    const zusatz = B.roster.filter(x => !elf.has(x.id) && !x.ir && (sk.get(x.id) || {}).stufe === 'normal' && basis.bekommt.spieler.indexOf(x.id) < 0).map(x => teil('spieler', x.id))
      .concat(L.picks.filter(x => x.besitzer === B.id && basis.bekommt.picks.indexOf(x.id) < 0).map(x => teil('pick', x.id)))
      .filter(t => t.w >= summe * (opt.plus || 0.08)).sort((a, b) => a.w - b.w);
    for (const t of zusatz.slice(0, 12)) {
      const n = kopie(basis);
      (t.art === 'spieler' ? n.bekommt.spieler : n.bekommt.picks).push(t.id);
      const e = bewerte(L, n, { interesse: opt.interesse, ki: opt.ki });
      if (e.akzeptiert) return { deal: n, teile: jetzt.concat([t]).map(x => x.text), wertFuerA: Math.round(paketWert(jetzt.concat([t]).map(x => x.w))), zusatz: t.text,
        zusatzPick: t.x ? { jahr: t.x.jahr, platz: pickWert(L, t.x, lgA, rang).platz } : null };
    }
    return null;
  }

  // ── „Was müsste ich dazugeben?“ ─────────────────────────────────────────
  // Sucht aus dem Nutzerteam das kleinste Zusatzpaket (1–2 Teile), mit dem die KI annimmt.
  function wasMuessteIchDazugeben(L, deal) {
    picks(L);
    const d = normal(deal), rang = raenge(L);
    const e0 = bewerte(L, d);
    if (e0.akzeptiert) return { schon: true, deal: d };
    const w = werteKI(L, d, rang);
    const A = w.A;
    const kand = [];
    A.roster.filter(p => d.gibt.spieler.indexOf(p.id) < 0).forEach(p => kand.push({ art: 'spieler', id: p.id, text: name(p) + ' (' + p.pos + ', ' + p.ovr + ')', wert: spielerWert(p, w.lgB) }));
    L.picks.filter(x => x.besitzer === A.id && d.gibt.picks.indexOf(x.id) < 0).forEach(x => kand.push({ art: 'pick', id: x.id, text: 'Pick ' + pickText(L, x, rang), wert: pickWert(L, x, w.lgB, rang, x.von === A.id ? CFG.nutzerPickSkepsis : 0).wert }));
    const mit = teile => {
      const n = normal(d);
      teile.forEach(t => (t.art === 'spieler' ? n.gibt.spieler : n.gibt.picks).push(t.id));
      return n;
    };
    const luecke = w.noetig - w.erhalt;
    const sortiert = kand.sort((a, b) => a.wert - b.wert);
    for (const k of sortiert) {
      if (k.wert < luecke) continue;
      const n = mit([k]); if (bewerte(L, n).akzeptiert) return { zusatz: [k], deal: n };
    }
    const top = sortiert.slice(-24);
    let best = null;
    for (let i = 0; i < top.length; i++) for (let j = i + 1; j < top.length; j++) {
      const sum = top[i].wert + top[j].wert;
      if (sum < luecke || (best && sum >= best.sum)) continue;
      const n = mit([top[i], top[j]]);
      if (bewerte(L, n).akzeptiert) best = { sum, zusatz: [top[i], top[j]], deal: n };
    }
    return best ? { zusatz: best.zusatz, deal: best.deal } : null;
  }

  // ── Trading Block: Angebote der KI-Teams für einen Spieler ───────────────
  function angeboteFuer(L, teamId, spielerId, n) {
    picks(L);
    const rang = raenge(L);
    const A = teamVon(L, teamId), p = A.roster.find(x => x.id === spielerId);
    if (!p) return [];
    const lgA = lage(L, A, rang);
    const angebote = [];
    for (const B of L.teams) {
      if (B.id === A.id) continue;
      const lgB = lage(L, B, rang);
      const budget = spielerWert(p, lgB) * (G.bedarf(B)[p.pos] > 0 ? 1.1 : 1) / (1 + CFG.marge);
      const elf = new Set(G.startelfVon(B.roster, B).map(x => x.id));
      // Was B hergeben würde: Neuaufbau-Teams eher Routiniers, Titelteams eher Picks und Junge
      const assets = [];
      B.roster.filter(x => !elf.has(x.id) && x.pos !== 'TW').forEach(x => assets.push({ art: 'spieler', id: x.id, wert: spielerWert(x, lgB, B), p: x }));
      L.picks.filter(x => x.besitzer === B.id).forEach(x => assets.push({ art: 'pick', id: x.id, wert: pickWert(L, x, lgB, rang).wert, pick: x }));
      assets.sort((a, b) => b.wert - a.wert);
      const paket = []; let summe = 0, picksN = 0;
      for (const a of assets) {
        if (paket.length >= 3) break;
        if (a.art === 'pick' && picksN >= 2) continue;
        if (summe + a.wert > budget) continue;
        paket.push(a); summe += a.wert; if (a.art === 'pick') picksN++;
      }
      if (!paket.length || summe < budget * 0.6) continue;
      const deal = { von: A.id, an: B.id, gibt: { spieler: [p.id], picks: [] },
        bekommt: { spieler: paket.filter(a => a.art === 'spieler').map(a => a.id), picks: paket.filter(a => a.art === 'pick').map(a => a.id) } };
      const e = bewerte(L, deal);
      if (!e.akzeptiert) continue;
      // Wert aus Sicht des Nutzerteams
      const fuerA = paketWert(paket.map(a => a.art === 'spieler' ? spielerWert(a.p, lgA) : pickWert(L, a.pick, lgA, rang).wert));   // Qualität vor Menge
      angebote.push({ team: B, lage: lgB, deal, paket: paket.map(a => ({ art: a.art, id: a.id, wert: a.wert,
        text: a.art === 'spieler' ? name(a.p) + ' (' + a.p.pos + ', ' + a.p.ovr + ', ' + a.p.age + ' J.)' : 'Pick ' + pickText(L, a.pick, rang) })),
        wertFuerUns: Math.round(fuerA * 10) / 10, cap: e.cap });
    }
    return angebote.sort((a, b) => b.wertFuerUns - a.wertFuerUns).slice(0, n || 5);
  }

  // ── Ausführen ────────────────────────────────────────────────────────────
  function ausfuehren(L, deal, opt) {
    const e = bewerte(L, deal, opt);
    if (!e.akzeptiert) return e;
    const d = normal(deal), A = teamVon(L, d.von), B = teamVon(L, d.an);
    const wechsel = (von, nach, ids) => spielerIn(von, ids).forEach(p => {
      von.dead_cap_total = (von.dead_cap_total || 0) + restBonus(p);          // C4: Rest-Bonus bleibt beim Abgeber
      p.contract = Object.assign({}, p.contract, { signing_bonus_total: 0 });
      von.roster.splice(von.roster.indexOf(p), 1);
      p.teamId = nach.id; p._exVerein = von.id; p.vereinsJahre = 0;
      delete p.weg;                                                          // D99: der Wechselwunsch hat sich erfüllt
      nach.roster.push(p);
    });
    wechsel(A, B, d.gibt.spieler); wechsel(B, A, d.bekommt.spieler);
    d.gibt.picks.forEach(id => { const x = L.picks.find(k => k.id === id); if (x) x.besitzer = B.id; });
    d.bekommt.picks.forEach(id => { const x = L.picks.find(k => k.id === id); if (x) x.besitzer = A.id; });
    (L.handel = L.handel || []).push({ jahr: L.saisonJahr, von: A.id, an: B.id, gibt: d.gibt, bekommt: d.bekommt });
    return Object.assign({ ausgefuehrt: true }, e);
  }

  window.DFLHandel = { CFG, LAGEN, lage, lagenSetzen, lageRechnen, raenge, spielerWert, picks, pickWert, pickText, pickBesitzer, bewerte,
    wasMuessteIchDazugeben, angeboteFuer, ausfuehren, restBonus, pickWertNr, capNach, kiTrades, sichtTeam, hochtradenPaket,
    // D50
    STILE, STIL_TEXT, STIL_POS, stilWert, stilRelevant, stilVon, stilPasst, stilSchnitt, spielerPassung, stilBonus, taktikenSetzen, schutzKarte, stilTeam, stilPassung, stilPassungProzent, stilAktualisieren, stilPruefen, interesse, interessenZuschlag,
    wunschliste, beobachtungAktualisieren, anfragePaket, pickAnfrage, paketNachbessern,
    // D96
    pickKurve, talentAufschlag, paketWert,
    // D94
    draftPicksVon, hochtradenNachbessern,
    // D156: Torhüter mit Stil
    TW_TYP, TW_GEWICHT, twTyp, twWerte, stilWertTw, stilWertTwRoh,
    // D99
    willWeg, wechselwunschAktualisieren, abgabeKontext, abgabeGruende, zuHabenInfo, zuHabenListe, zuHabenFuer, angebotFuer, paketFuer };
  console.log('%c[DFL-Handel v1] aktiv', 'color:#3fb950;font-weight:bold',
    '— Teamlage, Handelswert, Pick-Bewertung, Cap-Prüfung (Spec), „Was müsste ich dazugeben?“, Trading Block, D99: Wechselwünsche, Abgaben, Angebote');
})();
