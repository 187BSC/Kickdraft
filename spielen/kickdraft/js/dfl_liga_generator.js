/* ═══════════════════════════════════════════════════════════════════════════
   DFL-LIGA-GENERATOR  ·  v1
   ─────────────────────────────────────────────────────────────────────────
   Erzeugt den Startzustand der DFL: 32 Kader (28 + 6 Development Squad) mit
   zufälligen Spielern, Verträgen im NFL-Stil, Verhandlungsprofil je Spieler
   und den ersten Draft-Jahrgang aus frei erfundenen Colleges samt
   Medien-Draftliste (Rangliste + Mock-Draft).

   Grundlagen (siehe docs/konzept-saison-offseason-draft.md):
     · Startstärke je Verein = Ø der Startelf (4.1), Spannweite 72–92
     · Gehälter wie in der NFL, auf 28er-Kader und 120-Mio-Cap übertragen
     · Cap Hit nach Spec: base_salary + signing_bonus_total / years_total
       + guaranteed_bonuses
     · Verhandlungscharakter baut auf den vorhandenen Traits auf
       (geldgierig, titelhungrig, vereinstreu, heimatverbunden, bescheiden,
       wechselfreudig) – traits.js liefert die Eigenschaften, dieses Modul
       gibt ihnen eine Wirkung auf Forderung und Vertragsstaffelung.

   Reine Logik ohne DOM. Alles hängt an einem Seed und ist damit
   reproduzierbar. Noch NICHT in index.html eingehängt (erst nach Freigabe).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const CFG = {
    anlagenAngleichen: 0.5,          // Stadion zum Start: Hälfte echt, Hälfte nach Stärke (Nutzer 2026-10-22: „dann angleichen“, Test analyse/kd_anlagen_test.js)
    cap: 120000000,
    // NFL: Mindestgehalt 0,3 % des Caps bei 53 Spielern. Im 28er-Kader fallen die
    // billigen Ergänzungsspieler weg → 0,5 % des Caps.
    mindestgehalt: 600000,
    prestigeRabatt: 0.075,             // höchstens so viel Gehaltsverzicht für einen erfolgreichen Verein (D101: halbiert)
    perspektivGehalt: 250000,          // Development Squad: Vertrag für Neuzugänge, zählt gegen den Cap (D45, statt C3)
    mindestAnteil: 0.005,              // beide wachsen mit dem Cap (setzeCap)
    perspektivAnteil: 0.0021,
    perspektivAnzahl: 6,
    // D103 (Nutzer 2026-10-10: „manche in Runde 3 und 4 haben nicht das nötige Talent, es überhaupt zu schaffen“):
    // verborgene Nieten je Draft-Runde; ihr echtes Potenzial liegt nur 2–6 über der Stärke beim Draft. Scouting, Medien,
    // Wertliste und KI sehen die alte Hoffnung, die mit jeder Saison schwindet (nach 3 Saisons sieht es jeder);
    // Scouting über Stufe 5 erkennt bis zur Hälfte früher (Stufe 10: halbe Lücke)
    niete: { anteil: [0.05, 0.12, 0.22, 0.30], luft: [2, 6], jahre: 3, scoutingAb: 5, scoutingMax: 0.5 },
    // Rohdiamanten (Rückmeldung 17.10. (11), Nutzer: „auch für 60er und 70er Spieler, ganz selten, MÜSSEN gescoutet werden – vllt alle
    // paar Seasons sieht man einen überhaupt; Gegner haben auch welche und das sind dann ihre Starspieler, die sie für immer halten
    // wollen“): Talente mit Stärke 58–74, deren echtes Potenzial 8–14 über dem liegt, was alle sehen. Je Draft-Jahrgang ~1 (je Talent
    // 0,5 %), beim Ligastart 6 bei KI-Vereinen. Sichtbar wird es nur über einen Scout-Bericht (Chance 30 % + 4,5 % je Scouting-Stufe)
    // oder nach 3 Jahren für alle. Fest je Spieler (eigener Zufall aus ID und Seed) – der Ligazufall bleibt unberührt.
    diamant: { anteil: 0.005, ovr: [58, 74], plus: [8, 14], jahre: 3, start: 6, entdeckt: [0.30, 0.045] },
    // Restmarkt (2026-10-10, Folge von D101): wer in einer Free-Agency-Welle kein Angebot bekommt, geht mit der Forderung
    // runter – je Welle 10 %, höchstens auf 60 %. Ohne das blieben mit dem vollen Cap über 100 Spieler mit 80+ vereinslos.
    restmarkt: { jeRunde: 0.10, min: 0.6 },
    // 28er-Kader und Startelf (4-2-3-1). D95 (Positionen mit Seite, freigegeben 2026-10-10): je Seite zwei Außenverteidiger und
    // zwei Flügel, LM/RM je einer – braucht die Formation des Vereins LM/RM, je zwei davon und nur ein Flügel je Seite (kaderSoll).
    // Bis D95: TW 3, IV 5, AV 4, ZDM 3, ZM 3, OM 2, FL 5, ST 3 (ohne Seite)
    kader:    { TW:3, IV:4, LV:2, RV:2, ZDM:3, ZM:3, LM:1, RM:1, OM:2, LF:2, RF:2, ST:3 },
    startelf: { TW:1, IV:2, LV:1, RV:1, ZDM:2, OM:1, LF:1, RF:1, ST:1 },
    // D110 (Teamlage, freigegeben 2026-10-11 „Zu 2 ja das passt“, Vorschau spiel/dfl_lage_vorschau.html): Kaderziel nach Lage der KI –
    // Titel jetzt 28, Mittelfeld 26, Neuaufbau 25 (der eigene Verein bleibt frei, 21–28). Das Soll je Position kommt aus den Formationen
    // (kaderSoll): je gebrauchter Position Startplätze + 1, Torhüter 3 ab Ziel 27 (sonst 2), dann der größte Überhang zuerst weg
    kaderZiel: { titel: 28, mittelfeld: 26, neuaufbau: 25 },
    // Draft nach Lage (D110): Anteil der Stärke im Urteil, der Rest ist Potenzial – Titel jetzt 60 %, Neuaufbau 30 % (70 % Potenzial)
    draftLage: { titel: 0.6, mittelfeld: 0.45, neuaufbau: 0.3 },
    // Draft-Jahrgänge und erzeugte Free Agents ziehen LM/RM so oft wie LF/RF, damit der Markt sie hat (Vorschau D95)
    nachwuchs: { TW:3, IV:4, LV:2, RV:2, ZDM:3, ZM:3, LM:2, RM:2, OM:2, LF:2, RF:2, ST:3 },
    // Nebenpositionen (2./3. Position): Nachbarn auf dem Feld oder dieselbe Position auf der anderen Seite (Vorschau D95);
    // [a, b] = eins von beiden (zentrale Spieler lernen nur eine Seite). Wie bisher 40 % keine, 45 % eine, 15 % zwei
    neben: { TW: [], IV: ['ZDM', ['LV', 'RV']], LV: ['RV', 'LM', 'IV'], RV: ['LV', 'RM', 'IV'], ZDM: ['IV', 'ZM'],
             ZM: ['ZDM', 'OM', ['LM', 'RM']], LM: ['LV', 'LF', 'ZM', 'RM'], RM: ['RV', 'RF', 'ZM', 'LM'], OM: ['ZM', 'ST', ['LF', 'RF']],
             LF: ['LM', 'ST', 'OM', 'RF'], RF: ['RM', 'ST', 'OM', 'LF'], ST: ['OM', ['LF', 'RF']] },
    // Welt-Paket L3 (Nutzer 2026-10-11 zu D95: „mehr Spieler mit der anderen Seite als Nebenposition – das können einige ja auch, nur
    // eben nicht so perfekt“): Außenspieler (LV/RV, LM/RM, LF/RF) lernen mit dieser Chance zusätzlich die andere Seite (−2 wie jede
    // gelernte Position). Bis dahin nur über `neben` (≈ 20 % der Außenspieler)
    andereSeite: 0.3,
    // L3: jeder Verein startet mit einem Stil (Zufall aus Seed und Verein) und einer Formation seines Stils (Gewichte in der Reihenfolge
    // von DFLSaison.CFG.stilFormationen); Startelf und Kader werden dafür gebaut (Kader-Soll aus allen Formationen des Stils), die
    // Startstärke (teamOvr) gilt in der besten Formation des Stils. aktiv: false = wie bis D95 (Startelf im 4-2-3-1, Stil erst über
    // DFLHandel.taktikenSetzen nach der Passung)
    startStil: { aktiv: true, formation: [0.5, 0.3, 0.2] },
    // Nebenwerte relativ zum Hauptwert (Hauptbereich = POS_BEREICH); Schlüssel = Gruppe ohne Seite (grund: LV/RV → AV, LF/RF → FL,
    // LM/RM → AM). D95: LM/RM arbeiten mehr nach hinten als ein Zehner und sind offensiver als ein ZM
    abstaende: {
      TW:  { mid:-40, att:-50 }, IV: { mid:-22, att:-42 }, AV: { mid:-10, att:-25 },
      ZDM: { def:-5,  att:-25 }, ZM: { def:-12, att:-15 }, AM: { def:-20, att:-8 }, OM: { def:-30, att:-8 },
      FL:  { def:-30, mid:-10 }, ST: { def:-45, mid:-20 }
    },
    tempoBasis: { TW:45, IV:62, AV:78, ZDM:66, ZM:70, AM:80, OM:76, FL:84, ST:80 },
    // Marktgehalt (Jahr) als Anteil am Cap. Form wie in der NFL (Ergänzungsspieler nahe am
    // Minimum, Stars bis 20 %), der Mittelbau aber 30 % höher: Im 28er-Kader teilen sich weniger
    // Spieler den Cap. Mit der NFL-Kurve 1:1 nutzten die Teams im Langzeitlauf nur 74 % des Caps,
    // so 88 % (docs/konzept-saison-offseason-draft.md, Abschnitt 9). D101: alle Stützen +15 % –
    // sonst lag der Cap 2–4 Jahre nach dem Start nur zu 77–82 % belegt (neue Verträge unter Markt,
    // laufende fallen durch Cap-Wachstum zurück). Logarithmisch interpoliert, gedeckelt bei 21 % des Caps.
    markt: { stuetzen: [[62, 0.007475], [66, 0.012075], [70, 0.0207], [74, 0.032775], [78, 0.04945], [82, 0.069],
                        [86, 0.092], [90, 0.12075], [93, 0.1495], [96, 0.18975], [99, 0.23]],
             deckelAnteil: 0.21, topRabatt: [[86, 0.95], [90, 0.92]] },   // topRabatt: 2026-10-22, siehe marktgehalt
    posFaktor: { TW:0.80, IV:0.95, AV:0.90, ZDM:0.95, ZM:1.00, AM:1.00, OM:1.10, FL:1.05, ST:1.15 },
    // Rookie-Skala in % des Caps (NFL 2025: Pick 1 = 4,4 %, Pick 32 ≈ 1,2 %)
    rookie: { pick1: 0.044, pick32: 0.012, r2von: 0.009, r2bis: 0.0065, r3: 0.0055,
              handgeld: [0.66, 0.40, 0.25, 0.10], jahre: 4 },
    // Bestandsverträge zum Start: Die Gehaltssumme zum Marktpreis wird in dieses Band
    // gebracht. Starke Kader sind zum Marktpreis teurer als der Cap und laufen daher mit
    // Altverträgen unter Wert; schwache Kader liegen weit darunter, haben teils überbezahlte
    // Veteranen und trotzdem viel Cap-Platz. Faktor auf Veteranenverträge begrenzt.
    // Wunsch 2026-10-07: Start-Belegung nach Stärke statt nach Marktpreis – schwache Teams
    // ~86 %, starke bis ~106 % (müssen sich vor Spieltag 1 Platz schaffen: tauschen/entlassen).
    payroll: { min: 0.86, max: 1.06, ovrVon: 72, ovrBis: 92, streuung: 0.015, faktorMax: 3.5 },
    // Verborgener Entwicklungstyp (Konzept 6.2)
    entwicklung: [['normal', 0.70], ['schnell', 0.12], ['star', 0.14], ['ausnahme', 0.04]],
    // Draft-Jahrgang
    // Draft 17–21 (Wunsch 2026-10-07): je jünger, desto roher und desto mehr Potenzial – und desto
    // schwerer einzuschätzen. ovrMittel gilt für 21-Jährige, je Jahr jünger −ovrJeJahr.
    draft: { anzahl: 200, runden: 4, alter: [[17, 0.12], [18, 0.22], [19, 0.26], [20, 0.22], [21, 0.18]],
             ovrMittel: 64, ovrJeJahr: 2.5, ovrStreuung: 6, potJeJahr: [1, 3], luecke: [6, 16],   // 2026-10-22: vorher [2, 4] und 8–20 (Ø Pot 90 → 85)
             // 2026-10-22 (Nutzer: „im Draft paar richtige Bomben … jüngere 17–19 Yamals mit 78–83 als First Pick … 21-Jährige mit ~80,
             // kein 99-Potenzial für alle … immer variabel, sodass es auch Sinn macht nach unten zu traden“): Jahrgangsform
             form: [['schwach', 0.25], ['normal', 0.5], ['stark', 0.25]],
             wunder: { schwach: [0, 1], normal: [1, 2], stark: [3, 4], alter: [17, 19], ovr: [78, 83], pot: [93, 98], jeJahrVoraus: 2 },
             fertige: { anzahl: [4, 6], alter: [21, 21], ovr: [78, 82], plus: [3, 7], potMax: 88 },   // 21: älter kommt niemand in den Draft
             pot99: 1,                                      // höchstens so viele Talente mit Potenzial 99 je Jahrgang
             medienRauschen: 2.0, medienRauschenJeJahr: 0.6, medienVorausFaktor: 0.6 },
    // Development Squad (D45, ersetzt Spec C3): höchstens 21 Jahre, keine Stärkegrenze mehr, zählt gegen den Cap.
    // reifAb: ab hier zieht die KI ihre Spieler in den Kader hoch (der Nutzer entscheidet selbst)
    perspektiv: { alterMax: 21, ovrMax: 100, reifAb: 70, abwerbenAb: 82, abwerbenChance: 0.2 }
  };

  // ── Positionen mit Seite (D95, Nutzer 2026-10-10: „LF und RF, LV und RV und LM und RM als Positionen für die Formationen als
  // auch für die Spieler“) ── zwölf Positionen, Welt-Kürzel (OM heißt im Spiel ZOM). Bis D95 gab es acht ohne Seite (AV, FL);
  // sie bleiben als Altbestand gültig (alte Spielstände bis zur Umstellung, dfl_position_patch.js): ein AV deckt LV und RV ab,
  // ein FL LF und RF und – wie bis D95, als LM/RM-Plätze Flügelplätze waren – LM und RM; „AM“ (Basisspiel) LM und RM.
  const POS12 = ['TW', 'IV', 'LV', 'RV', 'ZDM', 'ZM', 'LM', 'RM', 'OM', 'LF', 'RF', 'ST'];
  const POS_BEREICH = { TW:'DEF', IV:'DEF', LV:'DEF', RV:'DEF', AV:'DEF', ZDM:'MID', ZM:'MID', LM:'MID', RM:'MID', AM:'MID', OM:'MID',
                        LF:'ATT', RF:'ATT', FL:'ATT', ST:'ATT' };
  // Gruppe ohne Seite für Gewichtstabellen (Stil, Torgewichte, Gehalt, Tempo …): LV/RV wie AV, LF/RF wie FL, LM/RM = AM
  const GRUND = { TW:'TW', IV:'IV', LV:'AV', RV:'AV', AV:'AV', ZDM:'ZDM', ZM:'ZM', LM:'AM', RM:'AM', AM:'AM', OM:'OM', LF:'FL', RF:'FL', FL:'FL', ST:'ST' };
  const SEITE = { LV:'L', LM:'L', LF:'L', RV:'R', RM:'R', RF:'R' };
  const MIT_SEITE = { AV: ['LV', 'RV'], AM: ['LM', 'RM'], FL: ['LF', 'RF'] };
  const ALT = { AV: ['LV', 'RV'], AM: ['LM', 'RM'], FL: ['LF', 'RF', 'LM', 'RM'] };
  // Kürzel des Basisspiels auf die DFL-Positionen (ohne Abbildung fehlten Abstände und Bereich, die Offseason der Welt brach ab,
  // Prüfung 2026-10-09); Unbekanntes wird ZM
  const POS_DFL = { ZOM: 'OM', DM: 'ZDM', LA: 'LF', RA: 'RF', MS: 'ST', HS: 'ST' };
  const dflPos = pos => (GRUND[pos] ? pos : (POS_DFL[pos] || 'ZM'));
  const grund = pos => GRUND[dflPos(pos)];
  const seiteVon = pos => SEITE[dflPos(pos)] || null;
  // Position einer Gruppe auf einer Seite: mitSeite('FL', 'L') = LF, mitSeite('RV', 'L') = LV; ohne Seite unverändert
  const mitSeite = (pos, s) => { const g = MIT_SEITE[grund(pos)]; return g ? g[s === 'R' ? 1 : 0] : dflPos(pos); };
  const andereSeite = pos => { const s = seiteVon(pos); return s ? mitSeite(pos, s === 'L' ? 'R' : 'L') : dflPos(pos); };
  const altbestand = pos => !!ALT[dflPos(pos)];
  // Wege über das Feld (Vorschau D95): andere Seite = zwei Schritte (LV–IV–RV, LM–ZM–RM, LF–ST–RF), eine Reihe weiter auf
  // derselben Seite und LV/RV ↔ IV = ein Schritt. Daraus der Abzug nach D81 (Stufen in ABZUG bzw. DFLSaison.CFG.staerke).
  const KANTEN = [['IV', 'LV'], ['IV', 'RV'], ['IV', 'ZDM'], ['LV', 'LM'], ['RV', 'RM'], ['ZDM', 'ZM'], ['ZM', 'LM'], ['ZM', 'RM'], ['ZM', 'OM'],
    ['LM', 'LF'], ['RM', 'RF'], ['OM', 'LF'], ['OM', 'RF'], ['OM', 'ST'], ['LF', 'ST'], ['RF', 'ST']];
  const SCHRITTE = {};
  {
    const nb = {}; POS12.forEach(p => { nb[p] = []; }); KANTEN.forEach(([a, b]) => { nb[a].push(b); nb[b].push(a); });
    POS12.forEach(a => { const d = { [a]: 0 }, q = [a]; while (q.length) { const x = q.shift(); nb[x].forEach(y => { if (d[y] == null) { d[y] = d[x] + 1; q.push(y); } }); } SCHRITTE[a] = d; });
  }
  const ABZUG = { gelernt: 2, abstand: [0, 8, 12, 18], torwart: 24 };
  // Abzug eines Spielers auf einem Platz – eine Rechnung für Welt (DFLSaison.abzugPos) und Spiel (DFLPosition.info).
  // liste: Positionen des Spielers (Stamm zuerst; Welt- oder Spiel-Kürzel), ziel: Platz; K: Stufen { gelernt, abstand, torwart }.
  // Rückgabe { abzug, art: 'stamm' | 'gelernt' | 'fremd' | 'torwart', platz, rang (gelernt: 2 = zweite Position), schritte + von (fremd), feldImTor }
  function positionsAbzug(liste, ziel, K) {
    K = K || ABZUG;
    ziel = ziel ? dflPos(ziel) : null;
    const ps = [];
    (liste || []).forEach(x => { if (x) { const n = dflPos(x); if (ps.indexOf(n) < 0) ps.push(n); } });
    if (!ziel || !ps.length) return { abzug: 0, art: 'stamm', platz: ziel };
    // Platz ohne Seite (Altbestand): die günstigere Seite zählt
    if (ALT[ziel]) return ALT[ziel].map(z => positionsAbzug(ps, z, K)).sort((a, b) => a.abzug - b.abzug)[0];
    let i = -1;
    for (let k = 0; k < ps.length && i < 0; k++) if (ps[k] === ziel || (ALT[ps[k]] && ALT[ps[k]].indexOf(ziel) >= 0)) i = k;
    if (i === 0) return { abzug: 0, art: 'stamm', platz: ziel };
    if (i > 0) return { abzug: K.gelernt, art: 'gelernt', platz: ziel, rang: i + 1 };
    if (ziel === 'TW' || ps.every(x => x === 'TW')) return { abzug: K.torwart, art: 'torwart', platz: ziel, feldImTor: ziel === 'TW' };
    let best = Infinity, von = ps[0];
    ps.forEach(x => (ALT[x] || [x]).forEach(y => { const d = SCHRITTE[y] && SCHRITTE[y][ziel]; if (d != null && d < best) { best = d; von = x; } }));
    const st = isFinite(best) ? best : K.abstand.length - 1;
    return { abzug: K.abstand[Math.min(st, K.abstand.length - 1)], art: 'fremd', platz: ziel, schritte: st, von };
  }
  const positionenVon = p => (p && p.positions && p.positions.length ? p.positions : (p && p.pos ? [p.pos] : []));
  const abzugAuf = (p, ziel, K) => positionsAbzug(positionenVon(p), ziel, K).abzug;

  // Allgemeine Namen (keine echten Spielernamen, Regel 6). Deutschland ist vielfältig (Nutzer 2026-10-13):
  // fünf Namensgruppen mit Anteil; Vor- und Nachname kommen aus derselben Gruppe.
  const VORNAMEN = ['Lukas','Maximilian','Felix','Leon','Ben','Jonas','Noah','Elias','Julian','Tim','Finn','Paul',
    'Moritz','Jan','Niklas','Erik','Luca','David','Simon','Fabian','Tobias','Philipp','Florian','Sebastian','Dominik',
    'Marcel','Kevin','Dennis','Patrick','Sascha','Jannik','Lennart','Malte','Hendrik','Ole','Till','Bastian','Robin',
    'Marvin','Nils','Henrik','Mats','Joel','Luis','Emil','Anton','Theo','Jakob','Carl','Vincent','Mika','Levin',
    'Johannes','Steffen','Christoph','Benedikt','Konstantin','Valentin','Aaron','Yannick','Timo','Kai','Leo','Hannes'];
  const NACHNAMEN = ['Müller','Schmidt','Schneider','Fischer','Weber','Meyer','Wagner','Becker','Schulz','Hoffmann',
    'Koch','Bauer','Richter','Klein','Wolf','Neumann','Krüger','Braun','Zimmermann','Hartmann','Schröder','Lange',
    'Schmitz','Krause','Lehmann','Köhler','Herrmann','König','Walter','Mayer','Huber','Kaiser','Fuchs','Peters','Lang',
    'Scholz','Möller','Weiß','Jung','Hahn','Schubert','Vogel','Friedrich','Keller','Günther','Frank','Berger','Winkler',
    'Roth','Beck','Lorenz','Baumann','Franke','Albrecht','Schuster','Simon','Ludwig','Böhm','Winter','Kraus','Martin',
    'Schumacher','Vogt','Stein','Jäger','Otto','Sommer','Groß','Seidel','Heinrich','Brandt','Haas','Schreiber',
    'Graf','Schulte','Dietrich','Ziegler','Kuhn','Engel','Pohl','Horn','Busch','Bergmann','Thomas','Voigt','Sauer',
    'Arnold','Wolff','Pfeiffer','Ernst','Kühn','Brinkmann','Lindner','Hesse','Rieger','Marx','Dreyer','Wendt',
    'Kessler','Hauser','Buchholz','Brenner','Thiele','Ebert','Kurz','Reuter','Bock','Walther','Nolte','Hermann',
    'Wilke','Stark','Kühne','Rademacher','Sander','Hagemann','Witt','Behrens','Dittmann','Petersen','Jansen','Evers',
    'Wiese','Rühl','Steffens','Ahrens','Lück','Gerdes','Janssen','Brockmann','Thies','Harms','Ostermann','Lammers'];
  const GRUPPEN = [
    { key: 'deutsch', anteil: 0.64, vor: VORNAMEN, nach: NACHNAMEN },
    { key: 'tuerkisch', anteil: 0.12,
      vor: ['Burak','Mert','Kaan','Deniz','Yusuf','Efe','Arda','Berkay','Cem','Onur','Serkan','Tolga','Volkan','Baran','Eren',
        'Kerem','Ömer','Mehmet','Ali','Hakan','Batuhan','Furkan','Okan','Umut','Selim','Taner','Levent','Emre','Can','Oğuz'],
      nach: ['Yılmaz','Kaya','Demir','Şahin','Çelik','Yıldız','Yıldırım','Öztürk','Aydın','Özdemir','Arslan','Doğan','Kılıç',
        'Aslan','Çetin','Kara','Koç','Kurt','Özkan','Şimşek','Polat','Korkmaz','Erdem','Güler','Aksoy','Tekin','Ünal','Bulut',
        'Keskin','Avcı','Karaca','Uçar'] },
    { key: 'arabisch', anteil: 0.08,
      vor: ['Karim','Amir','Omar','Yassin','Bilal','Hamza','Samir','Tarek','Nabil','Malik','Rami','Jamal','Adam','Ilias','Ayoub',
        'Anas','Khalid','Mahmoud','Yousef','Zakaria','Said','Mohamed','Ibrahim','Nassim'],
      nach: ['Haddad','Khalil','Mansour','Nasser','Saleh','Hamdan','Aziz','El Amrani','Bakkali','Benali','Chahid','Darwish',
        'Farouk','Haidar','Jaber','Karimi','Mourad','Rahmani','Sabri','Tahiri','Bouzid','El Idrissi','Nouri','Fakhri','Saadi','Hamidi'] },
    { key: 'englisch', anteil: 0.08,
      vor: ['Jack','Harry','Oliver','George','Charlie','Jamie','Ryan','Liam','Connor','Callum','Kieran','Mason','Tyler','Josh',
        'Sam','Luke','Nathan','Dylan','Owen','Ethan','Jordan','Aiden'],
      nach: ['Smith','Taylor','Brown','Wilson','Evans','Walker','Wright','Hughes','Edwards','Green','Hall','Wood','Clarke','Turner',
        'Hill','Cooper','Ward','Morris','Baker','Harris','Bennett','Mitchell','Carter','Phillips','Parker','Collins','Murphy',
        'Doyle','Fletcher','Holt'] },
    { key: 'spanisch', anteil: 0.08,
      vor: ['Alejandro','Carlos','Diego','Javier','Pablo','Sergio','Daniel','Adrián','Álvaro','Mario','Raúl','Rubén','Iván','Hugo',
        'Marcos','Andrés','Gonzalo','Nicolás','Mateo','Santiago','Tomás','Joaquín','Rodrigo','Iker'],
      nach: ['García','Fernández','González','Rodríguez','López','Martínez','Sánchez','Pérez','Gómez','Díaz','Moreno','Álvarez',
        'Romero','Navarro','Torres','Domínguez','Vázquez','Ramos','Gil','Serrano','Molina','Ortega','Delgado','Castro','Ortiz',
        'Rubio','Marín','Sanz','Iglesias','Medina'] }
  ];
  // Herkunft eines Namens (für passende Gesichter in dfl_identitaet.js); Vornamen sind je Gruppe eindeutig
  const HERKUNFT = new Map();
  GRUPPEN.slice().reverse().forEach(g => g.vor.forEach(v => HERKUNFT.set(v, g.key)));
  const herkunftVon = p => (p && HERKUNFT.get(p.firstName)) || 'deutsch';
  // Ein Zug wählt Gruppe und Vornamen, ein zweiter den Nachnamen – gleich viele Zufallszüge wie vorher (der Rest der Welt bleibt)
  function nameAus(r) {
    let u = r(), g = GRUPPEN[GRUPPEN.length - 1];
    for (const x of GRUPPEN) { if (u < x.anteil) { g = x; break; } u -= x.anteil; }
    const vn = g.vor[Math.min(g.vor.length - 1, Math.floor(u / g.anteil * g.vor.length))];
    return { vn, nn: r.pick(g.nach) };
  }
  // Kombinationen, die nach echten (Ex-)Nationalspielern klingen, werden nie vergeben
  // Sperrliste: echte Spieler, die sich aus VORNAMEN × NACHNAMEN bilden lassen – abgeglichen mit dem früheren data/game_data.js
  // (46 Treffer, 2026-10-09) plus bekannte Ex-Profis; neue Namen in den Listen → Abgleich wiederholen.
  // Gespeichert nur als Prüfsumme (FNV-1a über Kleinbuchstaben, UTF-8), damit keine echten Namen im Spiel stehen (2026-10-13)
  const SPERR_HASH = new Set([1802299,96823242,105674849,157089737,264135859,310151033,318322768,478757488,579210978,593394990,628861297,642640218,651834116,677754804,720281637,754963237,782749357,811977877,869852305,897290578,907428762,965810198,978109344,987858852,1070742055,1093446024,1120196400,1146186533,1164517164,1251030423,1265785073,1280212223,1290378102,1304845580,1308258787,1353391730,1468907046,1500828630,1501841347,1528318299,1567160868,1583476665,1599030884,1614378421,1724832880,1743179081,1786149655,1841218877,1842288564,1868378820,1886138142,1902272276,1919836585,1952739014,2000418318,2073486213,2094333882,2099733364,2107097869,2140230394,2168193967,2170466021,2187637041,2189630673,2218363454,2244629365,2252701529,2267080427,2299147058,2350036199,2369522022,2385046967,2399987563,2403405153,2419675110,2447449598,2475570328,2501074729,2509631298,2509758404,2531651596,2558472780,2572931203,2624315439,2636949565,2639916049,2668448400,2692540687,2752621223,2783550409,2828924768,2832018318,2883730821,2884068147,2908293716,2916874438,3020869490,3067935262,3196189118,3231602673,3301855783,3302804106,3318897711,3388654901,3409857753,3445749023,3452858523,3468641760,3527199512,3581422493,3611948176,3643416596,3707104172,3744666352,3756689336,3833316505,3846366150,3866420969,3892132582,3904802072,3950887114,3985307623,4002033494,4070312235,4113900216,4134592378,4219574153,4240181120,4266491989]);
  function sperrHash(t) {
    let h = 0x811c9dc5;
    const u = unescape(encodeURIComponent(String(t).toLowerCase()));          // UTF-8-Bytes, auch ohne TextEncoder (Prüflauf in node:vm)
    for (let i = 0; i < u.length; i++) { h ^= u.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h;
  }

  const COLLEGES = ['Universität Rheinaue','TH Nordheide','Hochschule Alpenvorland','Universität Falkenried',
    'TH Lindenhain','Hochschule Eichenfels','Universität Silberbach','TH Tannenhöhe','Hochschule Mühlental',
    'Universität Hirschwald','TH Seewinkel','Hochschule Sonnenhang','Universität Kranichsee','TH Elbhang',
    'Hochschule Moorland','Universität Fichtenau','TH Rebenhang','Hochschule Ostwind','Universität Weidental',
    'TH Kupferberg','Hochschule Nebelhorn','Universität Lerchenfeld','TH Sandhafen','Hochschule Wiesengrund',
    'Universität Möwenkap','TH Erlenbruch','Hochschule Auenwald','Universität Schwanenteich','TH Bernsteinküste',
    'Hochschule Heidekamm','Universität Goldenau','TH Ahornfeld'];

  // ── Zufall mit Seed (mulberry32) ─────────────────────────────────────────
  function rngAus(seed) {
    let a = (seed >>> 0) || 1;
    const r = function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
    r.pick = arr => arr[Math.floor(r() * arr.length)];
    r.normal = (m, s) => {
      const u = Math.max(1e-9, r()), v = r();
      return m + s * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };
    r.gewichtet = paare => {
      let x = r() * paare.reduce((s, p) => s + p[1], 0);
      for (const [wert, g] of paare) { x -= g; if (x <= 0) return wert; }
      return paare[paare.length - 1][0];
    };
    return r;
  }
  const klemme = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const rund = (x, auf) => Math.round(x / auf) * auf;

  // ── Spielerwerte ─────────────────────────────────────────────────────────
  // OVR-Formel des Spiels (computeOvrFromAreas): Hauptwert × 0,7 + Ø(def,mid,att) × 0,3.
  // Mit zwei Nebenwerten H+a und H+b ergibt das OVR = H + 0,1·(a+b) → H = OVR − 0,1·(a+b).
  function bereicheFuer(pos, ovr) {
    pos = dflPos(pos);
    const ab = CFG.abstaende[grund(pos)] || CFG.abstaende.ZM;
    const bereich = POS_BEREICH[pos];
    const nebenSumme = Object.values(ab).reduce((s, x) => s + x, 0);
    let haupt = ovr - 0.1 * nebenSumme;
    let faktor = 1;
    if (haupt > 99) {                    // Spitzenwerte: Abstände schrumpfen, damit die Formel aufgeht
      haupt = 99;
      faktor = (10 * (ovr - 99)) / nebenSumme;
    }
    const w = { def: haupt, mid: haupt, att: haupt };
    for (const k of Object.keys(ab)) w[k] = haupt + ab[k] * faktor;
    w[bereich === 'DEF' ? 'def' : bereich === 'MID' ? 'mid' : 'att'] = haupt;
    for (const k of ['def', 'mid', 'att']) w[k] = klemme(Math.round(w[k]), 20, 99);
    return w;
  }
  function ovrAus(p) {
    const b = POS_BEREICH[dflPos(p.pos)];
    const haupt = b === 'DEF' ? p.def : b === 'MID' ? p.mid : p.att;
    return klemme(Math.round(haupt * 0.7 + (p.def + p.mid + p.att) / 3 * 0.3), 20, 99);
  }
  function setzeOvr(p, ovr) {
    Object.assign(p, bereicheFuer(p.pos, ovr));
    p.ovr = ovrAus(p);
  }

  function potenzialFuer(r, ovr, alter, typ) {
    let luecke = 0;
    if (alter <= 20) luecke = r.int(6, 16);
    else if (alter <= 22) luecke = r.int(4, 12);
    else if (alter <= 24) luecke = r.int(2, 8);
    else if (alter <= 26) luecke = r.int(0, 4);
    if (luecke > 0) luecke += ({ normal: 0, schnell: -2, star: 3, ausnahme: 6 })[typ] || 0;
    return klemme(ovr + Math.max(0, luecke), ovr, 99);
  }

  function nameZiehen(r, vergeben) {
    for (let i = 0; i < 200; i++) {
      const { vn, nn } = nameAus(r), voll = vn + ' ' + nn;
      if (SPERR_HASH.has(sperrHash(voll)) || vergeben.has(voll)) continue;
      vergeben.add(voll);
      return { firstName: vn, name: nn };
    }
    const { vn, nn } = nameAus(r);
    return { firstName: vn, name: nn };
  }

  // 2./3. Position (D95: Nachbarn mit Seite, CFG.neben; [a, b] = eine Seite davon)
  function positionenFuer(r, pos) {
    pos = dflPos(pos);
    if (pos === 'TW') return ['TW'];
    const liste = [pos], kand = (CFG.neben[pos] || CFG.neben[mitSeite(grund(pos), 'L')] || []).slice();
    const extra = r() < 0.4 ? 0 : (r() < 0.75 ? 1 : 2);
    for (let i = 0; i < extra && kand.length; i++) {
      const k = kand.splice(Math.floor(r() * kand.length), 1)[0];
      liste.push(Array.isArray(k) ? k[Math.floor(r() * k.length)] : k);
    }
    // L3: die andere Seite zusätzlich (nicht so perfekt wie die eigene: gelernt −2)
    if (CFG.andereSeite > 0 && seiteVon(pos)) {
      const a = andereSeite(pos);
      if (r() < CFG.andereSeite && liste.indexOf(a) < 0) liste.push(a);
    }
    return liste;
  }

  // Charakter über traits.js vergeben. Dessen Vergabe würfelt mit Math.random;
  // für einen reproduzierbaren Start wird für die Dauer des Aufrufs der Seed-Zufall
  // untergeschoben. traits.js selbst bleibt unverändert.
  function traitsVergeben(r, p) {
    const vergib = (typeof window !== 'undefined') && window.traitsVergeben;
    if (typeof vergib !== 'function') { p.traits = []; p.traitsBekannt = []; return; }
    const orig = Math.random;
    Math.random = r;
    try { vergib(p); } finally { Math.random = orig; }
  }
  const hat = (p, k) => !!(p.traits && p.traits.indexOf(k) >= 0);

  // ── Verhandlungsprofil (Geld · Titel · Treue · Sicherheit, je 0–100) ─────
  // Jeder Spieler hat eine Haltung; die Traits markieren die Extreme.
  function vertragsprofilFuer(r, p) {
    const w = () => klemme(Math.round(r.normal(50, 17)), 5, 95);
    const v = { geld: w(), titel: w(), treue: w(), sicherheit: w() };
    if (p.age >= 30) { v.titel += 15; v.sicherheit += 10; }
    if (p.age <= 23) v.geld += 6;
    if (hat(p, 'geldgierig'))      { v.geld = r.int(82, 100); v.treue = Math.min(v.treue, 30); }
    if (hat(p, 'bescheiden'))      v.geld = Math.min(v.geld, 30);
    if (hat(p, 'titelhungrig'))    v.titel = r.int(82, 100);
    if (hat(p, 'vereinstreu'))     v.treue = r.int(82, 100);
    if (hat(p, 'heimatverbunden')) v.treue = Math.max(v.treue, 65);
    if (hat(p, 'wechselfreudig'))  v.treue = Math.min(v.treue, 20);
    for (const k of Object.keys(v)) v[k] = klemme(v[k], 0, 100);
    return v;
  }
  function verhandlungstyp(p) {
    const v = p.vertragsprofil || {};
    const top = [['geld', 'Geldorientiert'], ['titel', 'Titeljäger'], ['treue', 'Vereinstreu'],
                 ['sicherheit', 'Sicherheitsdenker']].sort((a, b) => (v[b[0]] || 0) - (v[a[0]] || 0))[0];
    return (v[top[0]] || 0) >= 70 ? top[1] : 'Ausgeglichen';
  }

  // ── Gehälter ─────────────────────────────────────────────────────────────
  function alterFaktor(alter) {
    if (alter <= 23) return 0.90;     // noch unbewiesen
    if (alter <= 29) return 1.00;
    return ({ 30: 0.90, 31: 0.80, 32: 0.70 })[alter] || 0.55;
  }
  // Jahresgehalt, das ein Spieler auf dem freien Markt wert ist
  function marktAnteil(ovr) {
    const st = CFG.markt.stuetzen;
    if (ovr <= st[0][0]) return st[0][1];
    for (let i = 1; i < st.length; i++) {
      if (ovr <= st[i][0]) {
        const [o0, a0] = st[i - 1], [o1, a1] = st[i];
        return Math.exp(Math.log(a0) + (Math.log(a1) - Math.log(a0)) * (ovr - o0) / (o1 - o0));
      }
    }
    return st[st.length - 1][1];
  }
  function marktgehalt(p) {
    // 2026-10-22 (Nutzer: „Gehaltsstruktur von sehr guten Spielern um ein paar Prozente nerven“ – Stars sind künftig jünger):
    // ab 86 Stärke −5 %, ab 90 −8 % (CFG.markt.topRabatt)
    const top = (CFG.markt.topRabatt || []).reduce((f, [ab, x]) => (p.ovr >= ab ? x : f), 1);
    const roh = CFG.cap * marktAnteil(p.ovr) * (CFG.posFaktor[grund(p.pos)] || 1) * alterFaktor(p.age) * top;
    return rund(klemme(roh, CFG.mindestgehalt, CFG.cap * CFG.markt.deckelAnteil), 10000);
  }
  // Rookie-Skala: Jahresdurchschnitt nach Pick-Nummer (1 … 128)
  function rookieGehalt(pick) {
    const k = CFG.rookie, c = CFG.cap;
    let anteil;
    if (pick <= 32) anteil = k.pick1 * Math.pow(k.pick32 / k.pick1, (pick - 1) / 31);
    else if (pick <= 64) anteil = k.r2von + (k.r2bis - k.r2von) * (pick - 33) / 31;
    else if (pick <= 96) anteil = k.r3;
    else anteil = CFG.mindestgehalt / c;
    return rund(Math.max(CFG.mindestgehalt, anteil * c), 10000);
  }
  // Cap Hit eines Rookie-Vertrags im ersten Jahr, so wie er unterschrieben wird (Skala, 4 Jahre steigend, Handgeld je Runde):
  // rookieGehalt ist der Jahresdurchschnitt – im ersten Jahr liegt der Cap Hit darunter (Anzeige im Draft = Buchung)
  function rookieCapHit(pick) {
    const runde = Math.max(1, Math.min(4, Math.ceil(pick / 32)));
    const c = baueVertrag({ jahresWert: rookieGehalt(pick), jahre: CFG.rookie.jahre, rest: CFG.rookie.jahre, staffelung: 'steigend',
      handgeldAnteil: CFG.rookie.handgeld[runde - 1] || 0.1, art: 'rookie' });
    return c.base_salary + c.signing_bonus_total / c.years_total + (c.guaranteed_bonuses || 0);
  }
  function staffelGewichte(art, jahre) {
    if (jahre <= 1 || art === 'gleich') return Array(jahre).fill(1);
    return Array.from({ length: jahre }, (_, i) => {
      const t = i / (jahre - 1);                     // 0 … 1
      return art === 'steigend' ? 0.75 + 0.5 * t : 1.25 - 0.5 * t;
    });
  }
  // Baut einen Vertrag im Spec-Format; base_salary_by_year ist die Erweiterung für die Staffelung (D18)
  function baueVertrag(o) {
    const gesamt = o.jahresWert * o.jahre;
    const handgeld = rund(gesamt * o.handgeldAnteil, 10000);
    const gew = staffelGewichte(o.staffelung, o.jahre), gs = gew.reduce((a, b) => a + b, 0);
    // Mindestgehalt gilt nicht für Development-Squad-Verträge (D45: 0,21 % des Caps, zählt gegen den Cap)
    const boden = o.art === 'perspektiv' ? 0 : CFG.mindestgehalt;
    const proJahr = gew.map(g => Math.max(boden - handgeld / o.jahre, (gesamt - handgeld) * g / gs));
    const byYear = proJahr.map(x => rund(Math.max(0, x), 10000));
    const jetzt = o.jahre - o.rest;                   // Index des laufenden Vertragsjahres
    return {
      years_total: o.jahre, years_remaining: o.rest,
      base_salary: byYear[jetzt],
      base_salary_by_year: byYear,
      signing_bonus_total: handgeld,
      guaranteed_bonuses: o.garantiert || 0,
      staffelung: o.staffelung, art: o.art
    };
  }
  // Spec 3.1: Player Cap Hit
  function capHitSpieler(p) {
    const c = p.contract;
    if (!c) return 0;
    return c.base_salary + c.signing_bonus_total / c.years_total + (c.guaranteed_bonuses || 0);
  }
  // Spec 3.1: Team Cap Hit
  function capHitTeam(team) {
    // Development Squad zählt mit (D45)
    return team.roster.reduce((s, p) => s + capHitSpieler(p), 0) + (team.practice_squad || []).reduce((s, p) => s + capHitSpieler(p), 0) +
      (team.dead_cap_total || 0);
  }

  // Was ein Spieler von einem Team fordert – hier wirkt der Charakter.
  // ctx.titelkandidat: Team gilt als Titelkandidat · ctx.eigenerVerein: Verlängerung beim jetzigen Verein
  function forderung(p, team, ctx) {
    ctx = ctx || {};
    const v = p.vertragsprofil || { geld: 50, titel: 50, treue: 50, sicherheit: 50 };
    const gruende = [];
    let faktor = 0.90 + 0.25 * v.geld / 100;                         // 0,90 … 1,15
    if (v.geld >= 70) gruende.push('will das Maximum herausholen');
    if (ctx.titelkandidat && v.titel >= 50) {
      const r = 0.075 * (v.titel - 50) / 50;                         // bis −7,5 % (D101: halbiert)
      faktor *= 1 - r;
      if (Math.round(r * 100) >= 1) gruende.push('Titelrabatt −' + Math.round(r * 100) + ' %');
    }
    if (ctx.eigenerVerein && v.treue >= 50) {
      const r = 0.05 * (v.treue - 50) / 50;                          // bis −5 % (D101: halbiert)
      faktor *= 1 - r;
      if (Math.round(r * 100) >= 1) gruende.push('Treuerabatt −' + Math.round(r * 100) + ' %');
    }
    // Prestige (Erfolg der letzten Jahre, 0–1): für einen großen Verein verzichten Spieler auf Geld –
    // Titeljäger mehr als Geldorientierte (bis −9 %)
    if (ctx.prestige) {
      const r = CFG.prestigeRabatt * ctx.prestige * (0.4 + 0.6 * v.titel / 100) * (1.2 - 0.4 * v.geld / 100);
      faktor *= 1 - r;
      if (Math.round(r * 100) >= 1) gruende.push('Prestige −' + Math.round(r * 100) + ' %');
    }
    // Restmarkt: lange ohne Angebot (p.faRunden = Wellen ohne Unterschrift) → billiger
    if (!p.teamId && p.faRunden > 0) {
      const r = Math.min(1 - CFG.restmarkt.min, CFG.restmarkt.jeRunde * p.faRunden);
      faktor *= 1 - r;
      gruende.push('ohne Angebot −' + Math.round(r * 100) + ' %');
    }
    if (hat(p, 'heimatverbunden') && team && p.heimat === team.city) {
      faktor *= 0.92; gruende.push('Heimatrabatt −8 %');
    }
    if (hat(p, 'bescheiden')) { faktor *= 0.95; gruende.push('bescheiden'); }
    if (hat(p, 'wechselfreudig')) { faktor *= 1.05; gruende.push('will kurze Laufzeit'); }
    // Staffelung: Titeljäger lassen ihr Gehalt nach hinten verschieben, damit der
    // Verein jetzt Cap-Platz hat; Geldorientierte wollen das Geld früh.
    let staffelung = 'gleich';
    if (ctx.titelkandidat && v.titel >= 70) { staffelung = 'steigend'; gruende.push('akzeptiert steigendes Gehalt'); }
    else if (v.geld >= 75) staffelung = 'fallend';
    const handgeldAnteil = klemme(0.10 + 0.35 * v.sicherheit / 100, 0.05, 0.45);
    let jahre = p.age <= 26 ? 4 : p.age <= 30 ? 3 : 2;
    if (v.sicherheit >= 70) jahre += 1;
    if (hat(p, 'wechselfreudig')) jahre = Math.max(1, jahre - 2);
    return {
      jahresWert: rund(Math.max(CFG.mindestgehalt, marktgehalt(p) * faktor), 10000),
      jahre: klemme(jahre, 1, 5), handgeldAnteil, staffelung, gruende
    };
  }

  // ── Spieler & Kader ──────────────────────────────────────────────────────
  function neuerSpieler(r, team, pos, ovr, alter, nr, namen) {
    const p = Object.assign({ id: 'dfl_' + team.id + '_' + nr, teamId: team.id, pos,
      positions: positionenFuer(r, pos), age: alter, flag: '', country: 'Deutschland',
      gamesPlayed: 0, seed: r() }, nameZiehen(r, namen));
    setzeOvr(p, ovr);
    p.pace = klemme(Math.round((CFG.tempoBasis[grund(pos)] || 70) + r.normal(0, 4) + (p.ovr - 75) * 0.25), 30, 99);
    p.mental = klemme(Math.round(p.ovr + r.normal(0, 3)), 30, 99);
    p.entwicklungstyp = r.gewichtet(CFG.entwicklung);
    p.entwicklungstypBekannt = alter >= 23;            // Veteranen: bekannt; Junge: verdeckt (6.2)
    p.truePotential = potenzialFuer(r, p.ovr, alter, p.entwicklungstyp);
    p.heimat = r() < 0.35 ? team.city : null;          // gut ein Drittel stammt aus der Vereinsstadt
    traitsVergeben(r, p);
    p.vertragsprofil = vertragsprofilFuer(r, p);
    return p;
  }

  function erzeugeKader(r, team, namen) {
    const T = team.start_ovr;
    const kader = [];
    let nr = 0;
    // Startelf: die Plätze der Formation des Vereins (L3, team.formation aus startStilFuer), sonst das 4-2-3-1
    const F = formationenDerSaison(), mitFormation = !!(team.formation && F && F[team.formation]);
    const elfPlaetze = mitFormation ? F[team.formation].map(dflPos) : startelfPlaetze();
    const elfZahl = {};
    elfPlaetze.forEach(pos => {
      elfZahl[pos] = (elfZahl[pos] || 0) + 1;
      const ovr = Math.round(klemme(r.normal(T, 3.5), 55, 99));
      kader.push(neuerSpieler(r, team, pos, ovr, r.int(23, 32), nr++, namen));
      kader[kader.length - 1]._start = true;
    });
    // Rest des 28er-Kaders nach dem Soll (L3: aus allen Formationen des Stils, kaderSoll), erst Rotation, dann Breite
    const soll = mitFormation ? kaderSoll(team, kaderVoll()) : CFG.kader;
    const rest = [];
    for (const [pos, n] of Object.entries(soll)) for (let i = 0; i < n - (elfZahl[pos] || 0); i++) rest.push(pos);
    rest.sort(() => r() - 0.5);
    rest.forEach((pos, i) => {
      const rotation = i < 6;
      const jung = !rotation && r() < 0.55;
      const alter = rotation ? r.int(21, 33) : (jung ? r.int(19, 23) : r.int(24, 34));
      const ovr = Math.round(klemme(rotation ? r.normal(T - 7, 3) : r.normal(jung ? T - 19 : T - 14, 5), 45, 95));
      kader.push(neuerSpieler(r, team, pos, ovr, alter, nr++, namen));
    });
    // Startelf exakt auf den Zielwert ziehen (Ø der Startelf = Startstärke, wirksam wie teamOvr – L3: in der besten Formation des Stils)
    for (let runde = 0; runde < 6; runde++) {
      const e = staerkeElf({ roster: kader, taktik: team.taktik });
      const diff = T - e.wert;
      if (Math.abs(diff) < 0.5) break;
      e.elf.forEach(p => setzeOvr(p, klemme(Math.round(p.ovr + diff), 45, 99)));
    }
    kader.forEach(p => { p.truePotential = Math.max(p.truePotential, p.ovr); delete p._start; });
    // Development Squad: jung, roh
    const pk = [];
    for (let i = 0; i < CFG.perspektivAnzahl; i++) {
      const pos = r.pick(Object.keys(CFG.kader).filter(x => x !== 'TW'));
      pk.push(neuerSpieler(r, team, pos, Math.round(klemme(r.normal(T - 20, 4), 42, 64)), r.int(17, 21), nr++, namen));
    }
    return { kader, pk };
  }

  // ── Startelf im 4-2-3-1 (Startstärke, Ränge, Lage, Zielwert D42) ──────────────────────────────────────────────
  // D95: beste Zuordnung auf die Plätze mit Positionsabzug (größte Summe aus Stärke − Abzug, wie DFLSaison.besetze und
  // DFLPosition.zuordnen) – mit Seiten fehlt sonst schnell ein RV oder LF und die Elf hatte nur zehn. Bis D95 je Position die
  // Stärksten nach Stammposition. Gemerkt je Kaderstand (Ränge, Lage und Bedarf fragen sie sehr oft); nominal (ohne Ausfälle).
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
  const startelfPlaetze = () => [].concat(...Object.entries(CFG.startelf).map(([pos, n]) => Array(n).fill(pos)));
  let elfMerk = new Map();
  const kaderSig = kader => kader.map(p => (p.id || '') + ':' + p.ovr + ':' + positionenVon(p).join('/')).join('|');
  // { plaetze, idx (je Platz Index im Kader oder −1), abzug (je Platz) } – plaetze: Plätze einer Formation (L3), sonst das 4-2-3-1;
  // ks: Signatur des Kaders (spart sie bei mehreren Formationen)
  function startelfZuordnung(kader, plaetze, ks) {
    plaetze = plaetze || startelfPlaetze();
    const sig = plaetze.join() + '#' + (ks || kaderSig(kader));
    let z = elfMerk.get(sig);
    if (!z) {
      const VERBOTEN = 1e6, n = plaetze.length, m = kader.length;
      z = { idx: plaetze.map(() => -1), abzug: plaetze.map(() => 0) };
      if (m) {
        const ab = plaetze.map(pl => kader.map(p => abzugAuf(p, pl)));
        const kosten = plaetze.map((pl, i) => {
          const zeile = kader.map((p, j) => { const a = ab[i][j], o = p.ovr || 50; return a >= ABZUG.torwart ? VERBOTEN : -(o - a) + a * o / 10000; });
          for (let k = 0; k < n; k++) zeile.push(0);
          return zeile;
        });
        ungarisch(kosten).forEach((j, i) => { if (j >= 0 && j < m && kosten[i][j] < VERBOTEN) { z.idx[i] = j; z.abzug[i] = ab[i][j]; } });
      }
      if (elfMerk.size > 4000) elfMerk = new Map();
      elfMerk.set(sig, z);
    }
    return { plaetze, idx: z.idx, abzug: z.abzug };
  }
  // Startelf eines Kaders: im 4-2-3-1 – mit `team` (L3) die Elf der besten Formation seines Stils (Stammspieler, Rolle, Schutz im Handel)
  function startelfVon(kader, team) {
    if (team && staerkeMitStil(team)) return staerkeElf({ roster: kader, taktik: team.taktik }).elf;
    const z = startelfZuordnung(kader);
    return z.idx.filter(i => i >= 0).map(i => kader[i]);
  }
  // L3 (Welt-Paket, Nutzer 2026-10-11: „Startstärke nach der Formation des Stils“): Formationen der Welt (DFLSaison.CFG) und die des Stils
  // eines Vereins; ohne Stil, ohne DFLSaison oder mit startStil.aktiv = false das 4-2-3-1 wie bis D95
  function formationenDerSaison() {
    const S = typeof window !== 'undefined' && window.DFLSaison;
    if (!S || !S.CFG || !S.CFG.formationen || (S.CFG.staerke && S.CFG.staerke.formation === false)) return null;
    return S.CFG.formationen;
  }
  function stilFormationen(stil) {
    const S = typeof window !== 'undefined' && window.DFLSaison, F = formationenDerSaison();
    if (!F || !stil || !S.CFG.stilFormationen) return [];
    return (S.CFG.stilFormationen[stil] || []).filter(f => F[f]);
  }
  const staerkeMitStil = team => !!(CFG.startStil && CFG.startStil.aktiv && team && team.taktik && team.taktik.stil && stilFormationen(team.taktik.stil).length);
  // Stärke-Elf: beste Formation des Stils (größter Ø aus Stärke − Abzug), sonst das 4-2-3-1 – { wert, elf, plaetze, formation }
  // 2026-10-21 (Fehleranalyse M4): Stärke-Elf je Kader merken – teamOvr/staerkeElf laufen je Woche vielhundertfach über dieselben 32 Kader
  // (Profil: staerkeElf + startelfZuordnung + teamOvr ≈ 30 % einer Woche). Schlüssel: Zahl aus Kadergröße, Stärke-Summe, IDs, Positionen, Stil.
  let staerkeMerk = new Map();
  function zahlSig(kader) {
    let h = kader.length | 0, summe = 0;
    for (let i = 0; i < kader.length; i++) {
      const p = kader[i], id = String(p.id || ''); let k = 0;
      for (let j = 0; j < id.length; j++) k = (k * 31 + id.charCodeAt(j)) | 0;
      const pos = positionenVon(p).join('/');
      for (let j = 0; j < pos.length; j++) k = (k * 31 + pos.charCodeAt(j)) | 0;   // alle Positionen vollständig (nur der Anfangsbuchstabe reichte nicht: LV/LM und LV/LF fielen zusammen)
      h = (h * 1000003 + k + (p.ovr || 0) * 7919) | 0;
      summe += p.ovr || 0;
    }
    return kader.length + ':' + summe + ':' + h + ':' + (kader[0] ? kader[0].id : '') + ':' + (kader[kader.length - 1] ? kader[kader.length - 1].id : '');
  }
  function staerkeElf(team) {
    const kader = team.roster || [];
    const stilKey = staerkeMitStil(team) ? team.taktik.stil : '';
    const schluessel = zahlSig(kader) + '#' + stilKey;
    // gemerkt werden nur Indizes in den Kader – die Elf wird aus dem aktuellen Kader gebaut (zwei Ligen mit gleichem Seed teilen sonst Spielerobjekte)
    const gemerkt = staerkeMerk.get(schluessel);
    if (gemerkt) return { wert: gemerkt.wert, elf: gemerkt.idx.map(i => kader[i]), plaetze: gemerkt.plaetze.slice(), formation: gemerkt.formation };
    const forms = staerkeMitStil(team) ? stilFormationen(team.taktik.stil) : [null], F = formationenDerSaison();
    const ks = forms.length > 1 ? kaderSig(kader) : null;
    let best = null;
    forms.forEach(f => {
      const pl = f ? F[f].map(dflPos) : startelfPlaetze(), z = startelfZuordnung(kader, pl, ks);
      let s = 0, n = 0; const elf = [], idx = [];
      z.idx.forEach((i, k) => { if (i >= 0) { s += kader[i].ovr - z.abzug[k]; n++; elf.push(kader[i]); idx.push(i); } });
      const wert = n ? s / n : 0;
      if (!best || wert > best.wert + 1e-9) best = { wert, elf, plaetze: pl, formation: f || '4-2-3-1', _idx: idx };
    });
    if (staerkeMerk.size > 3000) staerkeMerk = new Map();
    staerkeMerk.set(schluessel, { wert: best.wert, idx: best._idx, plaetze: best.plaetze.slice(), formation: best.formation });
    delete best._idx;
    return best;
  }
  // Stärke = Ø der Startelf (Stärke − Abzug auf ihrem Platz); L3: in der besten Formation des Stils
  function teamOvr(team) {
    return staerkeElf(team).wert;
  }
  // L3: Stil und Formation zum Start – Zufall aus Seed und Verein (der Ligazufall bleibt davon unberührt), Formation nach Gewicht
  const START_STILE = ['pressing', 'ballbesitz', 'fluegel', 'direkt'];
  function startStilFuer(seed, team) {
    const C = CFG.startStil;
    if (!C || !C.aktiv) return null;
    const rs = rngAus((((seed >>> 0) ^ hashText('stil:' + team.id)) >>> 0) || 1);
    const stil = START_STILE[Math.floor(rs() * START_STILE.length)], liste = stilFormationen(stil);
    if (!liste.length) return null;
    return { stil, formation: rs.gewichtet(liste.map((f, i) => [f, (C.formation && C.formation[i]) || 0.1])) };
  }

  // Verträge zum Start. Junge Spieler stecken oft noch im Rookie-Vertrag;
  // alle anderen haben einen Veteranenvertrag, der zum Marktwert bei Unterschrift
  // geschlossen wurde. Danach wird die Gehaltssumme auf das Ziel des Vereins
  // gebracht: starke Kader nah am Cap, schwache mit Platz für die Free Agency.
  function vertraegeVergeben(r, team) {
    const roster = team.roster;
    roster.forEach(p => {
      if (p.age <= 24 && r() < 0.7) {
        // Pick grob aus der Stärke ableiten: wer heute stark ist, ging früh weg
        const pick = klemme(Math.round(128 - (p.ovr - 50) * 3.6 + r.normal(0, 12)), 1, 128);
        const rest = klemme(4 - (p.age - 21), 1, 4);
        const jahresWert = rookieGehalt(pick);
        p.rookieVertrag = { pick, runde: Math.ceil(pick / 32) };
        p.contract = baueVertrag({ jahresWert, jahre: CFG.rookie.jahre, rest, staffelung: 'steigend',
          handgeldAnteil: CFG.rookie.handgeld[p.rookieVertrag.runde - 1], art: 'rookie' });
      } else {
        const f = forderung(p, team, { eigenerVerein: true });
        const jahre = f.jahre, rest = r.int(1, jahre);
        const garantiert = p.vertragsprofil.sicherheit >= 75 ? rund(f.jahresWert * 0.05, 10000) : 0;
        p.contract = baueVertrag({ jahresWert: rund(f.jahresWert * (0.85 + 0.3 * r()), 10000), jahre, rest,
          staffelung: f.staffelung, handgeldAnteil: f.handgeldAnteil, garantiert,
          art: f.jahresWert <= CFG.mindestgehalt ? 'minimum' : 'veteran' });
      }
    });
    // Development Squad zuerst: sein Vertrag zählt gegen den Cap (D45) und gehört in die Start-Belegung
    team.practice_squad.forEach(p => {
      p.contract = baueVertrag({ jahresWert: CFG.perspektivGehalt, jahre: 1, rest: 1, staffelung: 'gleich',
        handgeldAnteil: 0, art: 'perspektiv' });
      p.wage = Math.round(CFG.perspektivGehalt / 52); p.contractUntil = 1;
    });
    // Kalibrieren: Faktor immer auf die ursprünglichen Beträge (kein Aufschaukeln)
    const P = CFG.payroll;
    const vet = roster.filter(p => p.contract.art === 'veteran');
    vet.forEach(p => { p._roh = { b: p.contract.signing_bonus_total, j: p.contract.base_salary_by_year.slice(),
                                   g: p.contract.guaranteed_bonuses }; });
    const markt = roster.reduce((s, p) => s + capHitSpieler(p), 0);
    const anteil = P.min + (P.max - P.min) * klemme((team.start_ovr - P.ovrVon) / (P.ovrBis - P.ovrVon), 0, 1);
    const ziel = CFG.cap * klemme(anteil + r.normal(0, P.streuung), P.min - 0.02, P.max + 0.02);
    let f = 1;
    for (let i = 0; i < 6; i++) {
      const fix = roster.filter(p => p.contract.art !== 'veteran').reduce((s, p) => s + capHitSpieler(p), 0)
        + team.practice_squad.reduce((s, p) => s + capHitSpieler(p), 0);
      const vetRoh = vet.reduce((s, p) => s + p._roh.j[p.contract.years_total - p.contract.years_remaining]
        + p._roh.b / p.contract.years_total + p._roh.g, 0);
      if (!vetRoh) break;
      f = Math.min(P.faktorMax, (ziel - fix) / vetRoh);
      vet.forEach(p => {
        const c = p.contract;
        c.signing_bonus_total = rund(p._roh.b * f, 10000);
        c.base_salary_by_year = p._roh.j.map(x => rund(x * f, 10000));
        c.guaranteed_bonuses = rund(p._roh.g * f, 10000);
        c.base_salary = c.base_salary_by_year[c.years_total - c.years_remaining];
        if (capHitSpieler(p) < CFG.mindestgehalt) c.base_salary += CFG.mindestgehalt - capHitSpieler(p);
      });
      if (Math.abs(capHitTeam(team) - ziel) < CFG.cap * 0.004) break;
    }
    vet.forEach(p => { delete p._roh; });
    team.markt_payroll = Math.round(markt);
    team.bestandsfaktor = +f.toFixed(2);
    team.payroll_ziel = Math.round(ziel);
    // Wochenlohn fürs bestehende Spiel (p.wage ist dort pro Woche, D4)
    roster.forEach(p => { p.wage = Math.round(p.contract.base_salary / 52); p.contractUntil = p.contract.years_remaining; });
  }

  // ── Liga ─────────────────────────────────────────────────────────────────
  // liga: Inhalt von data/league.json · opts: { seed, saisonJahr }
  function erzeugeLiga(liga, opts) {
    opts = opts || {};
    const seed = opts.seed != null ? opts.seed : 20262027;
    const r = rngAus(seed);
    const namen = new Set();
    const jahr = opts.saisonJahr || 2026;
    // 2026-10-22 (Nutzer: Stärke und Stadion/Merch „dann angleichen“): Stadion zum Start zwischen echtem Stadion und dem Stadion,
    // das zur Stärke passt (gleicher Rang in der Liste aller Stadien); Anteil CFG.anlagenAngleichen (0 = wie bisher, 1 = ganz nach Stärke)
    const angl = CFG.anlagenAngleichen || 0, stadionVon = f => Math.max(20000, (f.anlagen && f.anlagen.stadion) || 20000);
    const stadienSortiert = liga.franchises.map(stadionVon).sort((x, y) => y - x);
    const nachStaerke = liga.franchises.slice().sort((x, y) => (y.start_ovr || 0) - (x.start_ovr || 0) || stadionVon(y) - stadionVon(x));
    const stadionZiel = new Map(nachStaerke.map((f, i) => [f.id, Math.round((stadionVon(f) * (1 - angl) + stadienSortiert[i] * angl) / 100) * 100]));
    const teams = liga.franchises.map(f => {
      const team = { id: f.id, name: f.name, city: f.city, kurz: f.kurz, conference: f.conference,
        division: f.division, start_ovr: f.start_ovr, farben: f.farben, wappen_figur: f.wappen_figur, wappen_icon: f.wappen_icon, anlagen: Object.assign({ training: 5, scouting: 5 }, f.anlagen, { stadion: Math.max(20000, (f.anlagen && f.anlagen.stadion) || 20000) }),   // D37: mindestens 20.000 Plätze
        salary_cap_limit: CFG.cap, dead_cap_total: 0,
        roster: [], practice_squad: [], draft_picks: [] };
      // L3: Stil und Formation vor dem Kader (der Kader wird dafür gebaut; DFLHandel.taktikenSetzen behält den Stil, marke 0)
      const st = startStilFuer(seed, team);
      if (st) { team.taktik = { stil: st.stil, marke: 0, start: true }; team.formation = st.formation; }
      if (angl) team.anlagen.stadion = stadionZiel.get(f.id) || team.anlagen.stadion;
      const { kader, pk } = erzeugeKader(r, team, namen);
      team.roster = kader; team.practice_squad = pk;
      // D53: Fanshop zum Start nach Vereinsgröße (DFLFinanzen lädt nach dem Generator, gerufen wird erst im Spiel)
      const F = (typeof window !== 'undefined') && window.DFLFinanzen;
      if (F && F.fanshopStart && team.anlagen.merchandising == null) team.anlagen.merchandising = F.fanshopStart(team.anlagen);
      // D75: Zustand der Anlagen und Eigentümer-Profil zum Start (eigener Zufall aus Seed und Verein, Ligazufall bleibt gleich)
      if (F && F.anlagenStart && F.anlagenAktiv && F.anlagenAktiv()) F.anlagenStart(team, seed);
      vertraegeVergeben(r, team);
      for (let j = 1; j <= 3; j++) for (let rd = 1; rd <= CFG.draft.runden; rd++) {
        team.draft_picks.push({ year: jahr + j, round: rd, original_owner_id: team.id, current_owner_id: team.id });
      }
      return team;
    });
    // Rohdiamanten beim Ligastart: unscheinbare junge Spieler (wenig sichtbares Potenzial) bei KI-Vereinen (eigener Zufall)
    {
      const kand = [].concat(...teams.map(t => t.roster)).filter(p => p.age <= 22 && p.ovr >= CFG.diamant.ovr[0] && p.ovr <= CFG.diamant.ovr[1] && (p.truePotential || p.ovr) - p.ovr <= 8)
        .sort((a, b) => hashText(a.id + 'dm' + seed) - hashText(b.id + 'dm' + seed));
      kand.slice(0, CFG.diamant.start).forEach(p => diamantWuerfeln(p, { immer: true }));
    }
    const draft = erzeugeDraftJahrgang(r, teams, { jahr: jahr + 1, namen });
    // Übernächster Jahrgang schon sichtbar (Wunsch 2026-10-08), unschärfer und noch in Entwicklung
    const draftNaechste = erzeugeDraftJahrgang(r, teams, { jahr: jahr + 2, namen, voraus: 1 });
    const L = { seed, saisonJahr: jahr, cap: CFG.cap, teams, draft, draftNaechste };
    Object.defineProperty(L, 'namen', { value: namen, enumerable: false });   // für spätere Jahrgänge
    return L;
  }

  // ── Kaderanalyse: Welche Position wird vakant, was braucht das Team? ─────
  // Das Team sieht seine Spieler nur so genau, wie sein Scouting es erlaubt (Stufe 1–10):
  // Stärke ±(11−Stufe)·0,5, Potenzial ±(11−Stufe)·1,1 (fest je Team, Spieler und Saat).
  const hashText = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
  function sichtAuf(p, scouting, saat) {
    const r = rngAus((hashText(p.id) ^ (saat >>> 0)) >>> 0), u = 11 - klemme(scouting || 5, 1, 10);
    // Schätzung nie über 99 (Prüfung 2026-10-10: „Pot. ~101“ in der Trade-Zentrale); Nieten mit der alten Hoffnung (D103)
    return { ovr: klemme(Math.round(p.ovr + r.normal(0, u * 0.5)), 1, 99), pot: klemme(Math.round(Math.max(p.ovr, potSichtbar(p, scouting) + r.normal(0, u * 1.1))), 1, 99) };
  }
  // D103: verborgene Nieten – je Draft-Runde 5 / 12 / 22 / 30 % der Gezogenen (CFG.niete). Fest je Spieler (aus ID und
  // Seed), damit Welt und Spiel gleich würfeln. Gibt true zurück, wenn der Spieler eine Niete ist.
  function nieteWuerfeln(p, runde) {
    const N = CFG.niete, r = rngAus((hashText(p.id + '|' + p.seed) ^ 0x6e1e7e) >>> 0);
    if (p.niete || r() >= (N.anteil[(runde || 1) - 1] || 0)) return false;
    const decke = p.ovr + N.luft[0] + Math.floor(r() * (N.luft[1] - N.luft[0] + 1));
    if (decke >= (p.truePotential || 0)) return false;
    p.niete = { schein: p.truePotential, alter: p.age };
    p.truePotential = decke;
    return true;
  }
  // Rohdiamant würfeln (fest je Spieler); opt.immer: ohne Zufall (Ligastart), opt.alter: seit wann (Ligastart: schon ein Jahr)
  function diamantWuerfeln(p, opt) {
    opt = opt || {};
    const R = CFG.diamant, r = rngAus((hashText(p.id + '|' + p.seed) ^ 0xd1a3a7) >>> 0);
    if (p.diamant || p.niete || p.ovr < R.ovr[0] || p.ovr > R.ovr[1] || (p.age || 30) > 22) return false;
    if (!opt.immer && r() >= R.anteil) return false;
    const plus = R.plus[0] + Math.floor(r() * (R.plus[1] - R.plus[0] + 1)), tp = p.truePotential != null ? p.truePotential : p.ovr;
    p.diamant = { schein: tp, alter: opt.alter != null ? opt.alter : p.age };
    p.truePotential = Math.min(99, tp + plus);
    if (p.entwicklungstyp === 'normal' || p.entwicklungstyp === 'schnell') p.entwicklungstyp = 'star';
    return true;
  }
  // Scout-Bericht: erkennt den Rohdiamanten mit Chance nach Scouting-Stufe (fest je Spieler und Stufe); true = jetzt entdeckt
  function diamantEntdecken(p, scouting) {
    if (!p || !p.diamant || p.diamant.entdeckt) return false;
    const R = CFG.diamant, r = rngAus((hashText(p.id + '|e' + (scouting || 5)) ^ 0x5c0e7) >>> 0);
    if (r() >= R.entdeckt[0] + R.entdeckt[1] * (scouting || 5)) return false;
    p.diamant.entdeckt = true;
    return true;
  }
  // Sichtbares Potenzial (D103): bei einer Niete die alte Hoffnung, die mit den Jahren nach dem Draft schwindet; gutes
  // Scouting sieht früher durch. Entwickelt wird immer nach truePotential. Rohdiamant: umgekehrt – sichtbar ist die alte, zu
  // niedrige Einschätzung, das echte Potenzial zeigt sich über 3 Jahre (oder sofort, wenn ein Scout ihn entdeckt hat).
  function potSichtbar(p, scouting) {
    const tp = p.truePotential != null ? p.truePotential : p.ovr, n = p.niete;
    const dm = p.diamant;
    if (dm && !dm.entdeckt && dm.schein < tp) {
      const jahre = Math.max(0, (p.age || 0) - (dm.alter != null ? dm.alter : p.age || 0));
      return Math.max(p.ovr, Math.round(dm.schein + (tp - dm.schein) * klemme(jahre / CFG.diamant.jahre, 0, 1)));
    }
    if (!n || !(n.schein > tp)) return tp;
    const N = CFG.niete, jahre = Math.max(0, (p.age || 0) - (n.alter != null ? n.alter : p.age || 0));
    const zeit = klemme(1 - jahre / N.jahre, 0, 1), blick = klemme(((scouting || 5) - N.scoutingAb) / 10, 0, N.scoutingMax);
    return Math.max(tp, Math.round(tp + (n.schein - tp) * zeit * (1 - blick)));
  }
  // Startelf-Soll je Position: die Formation des Teams (DFLSaison setzt team.formation aus der Formation seines Stils, 2026-10-10),
  // sonst das 4-2-3-1 – so sucht ein Verein im 4-3-3 Zentrale Mittelfeldspieler statt Sechser und Zehner
  // Schlüssel eines Platzes im Kader-Soll: die Position selbst; kennt das Soll sie nicht (Altbestand ohne Seite), ihre Gruppe
  // (LM/RM ohne eigene Gruppe zählen dann wie bis D95 als Flügel)
  const sollSchluessel = z => { z = dflPos(z); if (CFG.kader[z] != null) return z; const g = grund(z); return CFG.kader[g] != null ? g : g === 'AM' && CFG.kader.FL != null ? 'FL' : z; };
  function startSoll(team) {
    const S = typeof window !== 'undefined' && window.DFLSaison, f = team && team.formation;
    const plaetze = f && S && S.CFG && S.CFG.formationen && S.CFG.formationen[f];
    if (!plaetze || (S.CFG.staerke && S.CFG.staerke.formation === false)) return CFG.startelf;
    const o = {};
    plaetze.forEach(z => { const k = sollSchluessel(z); o[k] = (o[k] || 0) + 1; });
    return o;
  }
  // Kaderziel eines Vereins (D110): nach seiner Lage (team.lage, DFLHandel.lagenSetzen zum Saisonwechsel); der eigene Verein (team.eigen,
  // DFLSpiel.eigenSync) und Vereine ohne Lage planen mit dem vollen Kader (28)
  const kaderVoll = () => Object.values(CFG.kader).reduce((s, x) => s + x, 0);
  function kaderZiel(team) {
    const k = team && !team.eigen && team.lage && team.lage.key;
    return (k && CFG.kaderZiel[k]) || kaderVoll();
  }
  // Formationen, aus denen ein Verein seinen Kader plant: L3 (Nutzer 2026-10-11: „KI plant den Kader aus allen Formationen ihres Stils“ –
  // nach einem Formationswechsel waren ZM und LM/RM zu knapp) alle Formationen seines Stils, ohne Stil seine Formation (team.formation),
  // sonst keine (Grundsoll CFG.kader). Mit startStil.aktiv = false wie bis dahin nur die Formation
  function sollFormationen(team) {
    const S = typeof window !== 'undefined' && window.DFLSaison, F = S && S.CFG && S.CFG.formationen;
    if (!F || !team || (S.CFG.staerke && S.CFG.staerke.formation === false)) return [];
    if (CFG.startStil && CFG.startStil.aktiv && team.taktik && team.taktik.stil) {
      const liste = stilFormationen(team.taktik.stil);
      if (liste.length) return liste;
    }
    return team.formation && F[team.formation] ? [team.formation] : [];
  }
  // Kader-Soll eines Vereins für `ziel` Spieler (D95 + D110). Ohne Formation das Grundsoll (CFG.kader, 28). Mit Formationen: je Position
  // höchstens so viele Startplätze wie die Formationen brauchen (need) + 1 Ersatz, mindestens das Grundsoll; Torhüter 3 ab Ziel 27, sonst 2.
  // Ist das mehr als das Ziel, fällt der größte Überhang (Soll − Startplätze) zuerst weg – bei Gleichstand eine Position, die keine Formation
  // braucht, dann die weniger gespielte; Seitenpaare (LV/RV, LM/RM, LF/RF) nur gemeinsam. D95 bis 2026-10-11: CFG.kader, bei LM/RM in der
  // Formation LM/RM 2 und LF/RF 1 – das ergibt die Rechnung für 28 genauso (4-4-2, 4-2-3-1, 4-3-3 wie vorher bis auf ZDM/ZM).
  const PAARE = [['LV', 'RV'], ['LM', 'RM'], ['LF', 'RF']];
  const SOLL_REIHE = ['ZDM', 'OM', 'ZM', 'ST', 'IV', 'LM', 'LF', 'LV'];
  let sollMerk = new Map();
  function kaderSoll(team, ziel) {
    ziel = ziel || kaderZiel(team);
    const forms = sollFormationen(team), schluessel = forms.join(',') + '#' + ziel;
    const gemerkt = sollMerk.get(schluessel);
    if (gemerkt) return Object.assign({}, gemerkt);
    const S = typeof window !== 'undefined' && window.DFLSaison, F = S && S.CFG && S.CFG.formationen;
    const o = Object.assign({}, CFG.kader);
    if (!forms.length || !F) {
      // Grundsoll ohne Formation; kleineres Ziel: Torhüter, dann ZM/OM/ZDM/ST/IV (je einer, nie unter 1)
      if (ziel < kaderVoll()) {
        if (ziel <= 26) o.TW = 2;
        const reihe = ['ZM', 'OM', 'ZDM', 'ST', 'IV'];
        for (let i = 0, summe = Object.values(o).reduce((s, x) => s + x, 0); summe > ziel && i < 40; i++) { const k = reihe[i % reihe.length]; if (o[k] > 1) { o[k]--; summe--; } }
      }
      sollMerk.set(schluessel, Object.assign({}, o));
      return o;
    }
    const need = {}, use = {};
    POS12.forEach(p => { need[p] = 0; use[p] = 0; });
    forms.forEach(f => {
      const c = {};
      F[f].forEach(z => { const k = dflPos(z); c[k] = (c[k] || 0) + 1; });
      Object.keys(c).forEach(k => { need[k] = Math.max(need[k] || 0, c[k]); use[k] = (use[k] || 0) + c[k] / forms.length; });
    });
    POS12.forEach(p => { o[p] = Math.max(o[p] || 0, need[p] > 0 ? need[p] + 1 : 0); });
    // D95: braucht keine Formation LF/RF, aber eine LM/RM, sind LM/RM die Flügel (je 2) und LF/RF nur Ersatz (je 1)
    if ((need.LM || need.RM) && !(need.LF || need.RF)) { o.LF = Math.min(o.LF, 1); o.RF = Math.min(o.RF, 1); }
    o.TW = ziel >= 27 ? 3 : 2;
    let summe = POS12.reduce((s, p) => s + (o[p] || 0), 0);
    const uber = p => (o[p] || 0) - (need[p] || 0);
    const rang = p => SOLL_REIHE.indexOf(p) < 0 ? 99 : SOLL_REIHE.indexOf(p);
    for (let i = 0; summe > ziel && i < 60; i++) {
      // Einheiten: einzelne zentrale Positionen, Seitenpaare (Überhang des Paares = kleinerer Überhang einer Seite)
      const einheiten = ['IV', 'ZDM', 'ZM', 'OM', 'ST'].map(p => ({ ps: [p], u: uber(p), n: need[p], use: use[p] || 0, r: rang(p) }))
        .concat(PAARE.map(ps => ({ ps, u: Math.min(uber(ps[0]), uber(ps[1])), n: need[ps[0]] + need[ps[1]], use: (use[ps[0]] || 0) + (use[ps[1]] || 0), r: rang(ps[0]) })))
        .filter(e => e.u > 0 && e.ps.every(p => o[p] > (need[p] || 0)) && summe - e.ps.length >= ziel)
        .sort((a, b) => b.u - a.u || (a.n > 0) - (b.n > 0) || a.use - b.use || a.r - b.r);
      if (!einheiten.length) break;
      einheiten[0].ps.forEach(p => { o[p]--; summe--; });
    }
    sollMerk.set(schluessel, Object.assign({}, o));
    if (sollMerk.size > 200) sollMerk = new Map();
    return o;
  }
  function kaderAnalyse(team, o) {
    o = o || {};
    const sc = o.scouting || (team.anlagen && team.anlagen.scouting) || 5, saat = hashText(team.id) + (o.saat || 0);
    const T = teamOvr(team), aus = {}, sollElf = startSoll(team);
    const alle = team.roster.concat(team.practice_squad || []).map(p => Object.assign({ p }, sichtAuf(p, sc, saat)));
    const geht = x => (x.p.contract && x.p.contract.years_remaining <= 1) || x.p.age >= 32;
    for (const [pos, soll] of Object.entries(kaderSoll(team))) {
      const hier = alle.filter(x => x.p.pos === pos).sort((a, b) => b.ovr - a.ovr);
      const kader = hier.filter(x => team.roster.indexOf(x.p) >= 0), bleiben = kader.filter(x => !geht(x));
      const start = sollElf[pos] || 0, gruende = [];
      let stamm = 0, breite = 0, talent = 0;
      if (start) {
        const elf = kader.slice(0, start);
        elf.filter(geht).forEach(x => gruende.push(x.p.name + ': ' + (x.p.age >= 32 ? x.p.age + ' Jahre' : 'Vertrag endet')));
        const luecke = elf.length ? T - elf.reduce((s, x) => s + x.ovr, 0) / elf.length : 8;
        if (luecke > 3) gruende.push('Startelf ' + Math.round(luecke) + ' unter Teamniveau');
        const sicher = bleiben.slice(0, start).filter(x => x.ovr >= T - 6).length;
        stamm = klemme((start - sicher) * 1.2 + Math.max(0, luecke - 2) / 3, 0, 3);
      }
      if (bleiben.length < soll) { breite = klemme((soll - bleiben.length) * 0.8, 0, 2); gruende.push('nur ' + bleiben.length + ' von ' + soll + ' sicher'); }
      if (soll >= 2 && !hier.some(x => x.p.age <= 23 && x.pot >= T - 2)) { talent = 1.2; gruende.push('kein Nachfolger in Sicht'); }
      const w = Math.max(stamm, breite, talent);
      aus[pos] = { bedarf: Math.round(w * 10) / 10, gruende,
        art: !w ? null : stamm >= breite && stamm >= talent ? 'Stammspieler' : talent > breite ? 'Talent' : 'Backup' };
    }
    return aus;
  }
  // Wie ein Team ein Draft-Talent sieht (Scouting) und wie gut es zum Bedarf passt
  function draftUrteil(team, t, analyse, scouting, saat) {
    const s = sichtAuf(t, scouting, saat), T = teamOvr(team), b = analyse[t.pos] || { bedarf: 0 };
    let passt = 0;
    if (b.art === 'Stammspieler' && s.ovr >= T - 9) passt = b.bedarf;
    else if (b.art === 'Talent' && s.pot >= T) passt = b.bedarf;
    else if (b.art === 'Backup') passt = b.bedarf * 0.6;
    // D110: Titel jetzt sieht fertige Spieler lieber (60 % Stärke), Neuaufbau das Potenzial (70 %); der eigene Verein wie bisher
    const k = team && !team.eigen && team.lage && team.lage.key, a = (k && CFG.draftLage[k] != null) ? CFG.draftLage[k] : 0.45;
    return { sicht: s, wert: a * s.ovr + (1 - a) * s.pot, passt };
  }

  // ── Draft-Jahrgang + Medien-Draftliste ───────────────────────────────────
  // Draft-Reihenfolge vor Saison 1: umgekehrte Startstärke (Medien-Prognose).
  function prognoseReihenfolge(teams, ids) {
    if (ids && ids.length) return ids.map(id => teams.find(t => t.id === id)).filter(Boolean);
    return teams.slice().sort((a, b) => a.start_ovr - b.start_ovr || a.name.localeCompare(b.name));
  }
  // Bedarf je Position: wie weit die Stammkräfte unter dem Teamniveau liegen
  function bedarf(team) {
    const T = teamOvr(team), b = {}, soll = startSoll(team);
    for (const [pos, n] of Object.entries(soll)) {
      const beste = team.roster.filter(p => p.pos === pos).sort((a, c) => c.ovr - a.ovr).slice(0, n);
      const schnitt = beste.reduce((s, p) => s + p.ovr, 0) / Math.max(1, beste.length);
      const alt = beste.filter(p => p.age >= 31).length;
      b[pos] = klemme((T - schnitt) / 2 + alt * 0.8, 0, 3);
    }
    if (!soll.ZM && b.ZDM != null) b.ZM = b.ZDM * 0.7; // ZM wird im 4-2-3-1 nicht gestartet, zählt halb über ZDM
    return b;
  }
  function kombineFuer(r, p) {
    const tempo = p.pace;
    return {
      sprint30: +(4.55 - (tempo - 50) * 0.012 + r.normal(0, 0.05)).toFixed(2),
      antritt10: +(1.95 - (tempo - 50) * 0.006 + r.normal(0, 0.03)).toFixed(2),
      yoyo: +(klemme(r.normal(19, 1.1) + (['AV', 'ZM', 'ZDM', 'FL', 'AM'].indexOf(grund(p.pos)) >= 0 ? 0.6 : 0), 15.5, 22)).toFixed(1),
      sprung: Math.round(klemme(r.normal(56, 6) + (['IV', 'ST', 'TW'].indexOf(p.pos) >= 0 ? 4 : 0), 38, 78)),
      nimmtTeil: r() > 0.12                    // manche Top-Talente verweigern die Kombine (Pro Day)
    };
  }
  // Medien-Satz zum Talent: je Position eigene Stärken und Schwächen (Nutzer 2026-10-22: „das ist ein Torhüter, der Text passt
  // nicht – positionsgerechte Aussagen“). Fest aus den Werten und p.seed gebildet (kein Zufallsgenerator), daher auch für alte
  // Spielstände beim Anzeigen neu gerechnet (DFLGenerator.medienText).
  const MT = {
    TW:  { gut: ['starke Reflexe auf der Linie', 'pariert auch aus kurzer Distanz', 'sicher im Eins gegen Eins'],
           roh: ['auf der Linie solide, bei hohen Bällen noch unsicher', 'im Herauslaufen noch zu zögerlich', 'muss bei Flanken mutiger werden'],
           tempo: 'schnell aus dem Tor', kopf: 'strahlt Ruhe im Strafraum aus', wackel: 'nach Fehlern leicht verunsichert' },
    IV:  { gut: ['zweikampfstark', 'kopfballstark in beiden Strafräumen', 'liest das Spiel früh'],
           roh: ['im Stellungsspiel noch roh', 'verliert im Kopfball noch zu viele Duelle', 'unter Druck im Aufbau fehleranfällig'],
           tempo: 'schnell für einen Innenverteidiger', kopf: 'organisiert die Abwehr', wackel: 'lässt sich zu leicht herauslocken' },
    AV:  { gut: ['stark im Eins gegen Eins', 'gute Flanken von der Grundlinie', 'schaltet sich klug ins Angriffsspiel ein'],
           roh: ['defensiv noch zu offen', 'Flanken landen oft beim Gegner', 'rückt zu spät ein'],
           tempo: 'läuft die Außenbahn rauf und runter', kopf: 'diszipliniert in der Viererkette', wackel: 'verliert hinten schnell den Mann' },
    ZDM: { gut: ['räumt vor der Abwehr ab', 'fängt viele Pässe ab', 'verteilt den Ball sauber aus der Tiefe'],
           roh: ['unter Druck im Passspiel wackelig', 'kommt in den Zweikämpfen oft zu spät', 'noch zu viele Fouls'],
           tempo: 'deckt viel Raum ab', kopf: 'hält die Ordnung im Zentrum', wackel: 'verliert im Gegenpressing die Linie' },
    ZM:  { gut: ['klares Passspiel', 'gute Spielübersicht', 'treibt den Ball von Strafraum zu Strafraum'],
           roh: ['Passspiel unter Druck wackelig', 'taucht in großen Spielen noch ab', 'zu wenig Tiefe in den Pässen'],
           tempo: 'starke Laufwege', kopf: 'denkt einen Zug voraus', wackel: 'versteckt sich, wenn es nicht läuft' },
    AM:  { gut: ['dribbelstark auf engem Raum', 'gefährliche Hereingaben', 'zieht gern nach innen und schließt ab'],
           roh: ['Flanken noch zu ungenau', 'verliert im Dribbling zu oft den Ball', 'arbeitet kaum nach hinten'],
           tempo: 'enorm antrittsschnell', kopf: 'trifft unter Druck die richtige Wahl', wackel: 'zu verspielt in der eigenen Hälfte' },
    OM:  { gut: ['spielt den tödlichen Pass', 'torgefährlich aus der zweiten Reihe', 'findet die Lücken zwischen den Linien'],
           roh: ['schließt zu überhastet ab', 'verliert im Gedränge oft den Ball', 'arbeitet kaum nach hinten'],
           tempo: 'schnell im Kopf und in den Beinen', kopf: 'übernimmt Verantwortung bei Standards', wackel: 'verschwindet, wenn es eng wird' },
    FL:  { gut: ['starkes Eins gegen Eins am Flügel', 'gefährlich mit dem Zug zum Tor', 'zieht nach innen und schließt ab'],
           roh: ['Abschluss ausbaufähig', 'verliert im Dribbling zu oft den Ball', 'arbeitet kaum nach hinten'],
           tempo: 'enorm schnell', kopf: 'behält vor dem Kasten die Nerven', wackel: 'lässt nach Fehlversuchen den Kopf hängen' },
    ST:  { gut: ['starker Abschluss', 'eiskalt im Strafraum', 'kopfballstark und robust im Rücken der Verteidiger'],
           roh: ['Abschluss ausbaufähig', 'lässt zu viele Chancen liegen', 'tut sich mit dem Rücken zum Tor schwer'],
           tempo: 'gefährlich mit Tempo in die Tiefe', kopf: 'riecht die Chancen', wackel: 'hadert schnell mit sich' }
  };
  function medienText(p) {
    const g = MT[grund(p.pos)] || MT.ZM, seed = Math.floor((p.seed || 0.5) * 1e6);
    const wahl = (l, k) => l[(seed + k) % l.length];
    const st = [];
    const stark = p.ovr >= 68;
    st.push(wahl(stark ? g.gut : g.roh, 0));
    const tempoGrenze = grund(p.pos) === 'TW' || grund(p.pos) === 'IV' ? 74 : 82;
    if (p.pace >= tempoGrenze) st.push(g.tempo);
    if ((p.mental || p.ovr) >= p.ovr + 4) st.push(g.kopf);
    else if ((p.mental || p.ovr) <= p.ovr - 5) st.push(g.wackel);
    if (st.length < 2) st.push(wahl(stark ? g.roh : g.gut, 1));      // ein Satz mit Licht und Schatten
    if (p.fruehmelder) st.push(p.age + ' Jahre jung – großes Potenzial, aber Risiko');
    if (hat(p, 'fuehrungsspieler')) st.push('Kapitän seines Colleges');
    if (hat(p, 'hitzkopf')) st.push('hitzköpfig');
    const satz = st.filter((x, i) => st.indexOf(x) === i).slice(0, 3);
    return satz.map((x, i) => i ? x : x.charAt(0).toUpperCase() + x.slice(1)).join(', ') + '.';
  }
  function medienNote(rang) {
    const noten = [[5, 'A+'], [12, 'A'], [24, 'A-'], [40, 'B+'], [64, 'B'], [96, 'B-'], [128, 'C+'], [170, 'C']];
    for (const [bis, n] of noten) if (rang <= bis) return n;
    return 'C-';
  }

  function neuesTalent(r, opts, i, namen) {
    const D = CFG.draft, positionen = [];
    for (const [pos, n] of Object.entries(CFG.nachwuchs || CFG.kader)) for (let k = 0; k < n; k++) positionen.push(pos);
    const alter = r.gewichtet(D.alter), jung = 21 - alter;
    const pos = r.pick(positionen);
    const p = Object.assign({ id: 'draft' + opts.jahr + '_' + i, pos, positions: positionenFuer(r, pos), age: alter,
      flag: '', country: 'Deutschland', college: r.pick(COLLEGES), fruehmelder: alter <= 18, seed: r() }, nameZiehen(r, namen));
    setzeOvr(p, Math.round(klemme(r.normal(D.ovrMittel - jung * D.ovrJeJahr, D.ovrStreuung), 42, 80)));
    p.pace = klemme(Math.round((CFG.tempoBasis[grund(pos)] || 70) + r.normal(0, 5)), 30, 99);
    p.mental = klemme(Math.round(p.ovr + r.normal(0, 4)), 30, 99);
    p.entwicklungstyp = r.gewichtet(CFG.entwicklung);
    p.entwicklungstypBekannt = false;
    // Profis wachsen deutlich: Lücke 8–20, je Jahr jünger 2–4 mehr, Entwicklungstyp obendrauf
    let luecke = r.int(D.luecke[0], D.luecke[1]) + ({ normal: 0, schnell: -2, star: 3, ausnahme: 6 })[p.entwicklungstyp];
    for (let j = 0; j < jung; j++) luecke += r.int(D.potJeJahr[0], D.potJeJahr[1]);
    p.truePotential = klemme(p.ovr + luecke, p.ovr, 99);
    diamantWuerfeln(p);                                // Rohdiamant (eigener Zufall, Ligazufall unberührt)
    traitsVergeben(r, p);
    p.vertragsprofil = vertragsprofilFuer(r, p);
    p.kombine = kombineFuer(r, p);
    return p;
  }
  function erzeugeDraftJahrgang(r, teams, opts) {
    const namen = opts.namen || new Set(), talente = [];
    for (let i = 0; i < (opts.anzahl || CFG.draft.anzahl); i++) talente.push(neuesTalent(r, opts, i, namen));
    const form = jahrgangFormen(r, talente, opts.voraus || 0);
    return Object.assign(jahrgangBewerten(r, talente, teams, opts), { form });
  }
  // Jahrgangsform: Wunderkinder (jung, schon stark, riesiges Potenzial) und Fertige (21–22, sofort Stammspieler, wenig Luft);
  // vor dem Draft wachsen die Talente noch (jahrgangEntwickeln) – darum je Jahr Vorlauf etwas tiefer ansetzen
  function jahrgangFormen(r, talente, voraus) {
    const D = CFG.draft, W = D.wunder, F = D.fertige, form = r.gewichtet(D.form);
    const frei = talente.slice(), nimm = filter => { const l = frei.filter(filter); if (!l.length) return null; const p = r.pick(l); frei.splice(frei.indexOf(p), 1); return p; };
    const n = r.int(W[form][0], W[form][1]);
    for (let i = 0; i < n; i++) {
      const p = nimm(x => x.age <= W.alter[1] && x.pos !== 'TW'); if (!p) break;
      p.age = klemme(p.age, W.alter[0], W.alter[1]); p.fruehmelder = p.age <= 18;
      setzeOvr(p, r.int(W.ovr[0], W.ovr[1]) - voraus * W.jeJahrVoraus);
      p.truePotential = klemme(r.int(W.pot[0], W.pot[1]) + (form === 'stark' && i === 0 && r() < 0.5 ? 2 : 0), p.ovr, 99);
      p.entwicklungstyp = r() < 0.5 ? 'star' : 'ausnahme'; p.wunderkind = true;
    }
    const m = r.int(F.anzahl[0], F.anzahl[1]);
    for (let i = 0; i < m; i++) {
      const p = nimm(x => x.age >= 20 && x.pos !== 'TW'); if (!p) break;
      p.age = r.int(F.alter[0], F.alter[1]); p.fruehmelder = false;
      setzeOvr(p, r.int(F.ovr[0], F.ovr[1]) - voraus);
      p.truePotential = klemme(p.ovr + r.int(F.plus[0], F.plus[1]), p.ovr, F.potMax);
      p.entwicklungstyp = 'normal'; p.fertig = true;
    }
    // 99 nur für wenige: alle weiteren auf 98
    talente.filter(p => p.truePotential >= 99).sort((a, b) => b.ovr - a.ovr).slice(D.pot99).forEach(p => { p.truePotential = 98; });
    return form;
  }
  // Medienliste (neu) bewerten: Wahrer Draft-Wert = heute + Zukunft (Entwicklungstyp für alle verdeckt).
  // Die Medien liegen je Talent mit einer festen Tendenz daneben, die mit dem Draft näher rückt kleiner
  // wird (opts.voraus = Jahre bis zum Draft, 0 = kommender Draft; opts.schaerfe < 1 nach dem Halbzeit-Update).
  function jahrgangBewerten(r, talente, teams, opts) {
    const D = CFG.draft, voraus = opts.voraus || 0, schaerfe = opts.schaerfe || 1;
    talente.forEach(p => {
      p._wert = 0.45 * p.ovr + 0.55 * potSichtbar(p, 5);                    // Rohdiamanten: die Medien sehen die alte Einschätzung
      if (p._bias == null) p._bias = r.normal(0, 1);
      const rausch = (D.medienRauschen + (21 - p.age) * D.medienRauschenJeJahr) * (1 + voraus * D.medienVorausFaktor) * schaerfe;
      p._medienWert = p._wert + p._bias * rausch;
    });
    talente.sort((a, b) => b._medienWert - a._medienWert);
    talente.forEach((p, i) => {
      const vorher = p.medien && p.medien.rang;
      p.medien = { rang: i + 1, note: medienNote(i + 1), text: medienText(p), vorher: vorher || null };
    });
    const reihenfolge = prognoseReihenfolge(teams, opts.reihenfolge);
    const mock = [];
    if (!voraus) {
      // Mock-Draft der Medien: Reihenfolge nach Prognose, je Pick das beste Talent nach Medienwert + Bedarf
      const bedarfJeTeam = {};
      teams.forEach(t => { bedarfJeTeam[t.id] = bedarf(t); });
      const frei = talente.slice();
      for (let runde = 1; runde <= D.runden; runde++) {
        reihenfolge.forEach((t, idx) => {
          if (!frei.length) return;
          const pick = (runde - 1) * teams.length + idx + 1;
          let best = null, bestScore = -1e9;
          for (const p of frei.slice(0, 8)) {
            const score = p._medienWert + (bedarfJeTeam[t.id][p.pos] || 0);
            if (score > bestScore) { bestScore = score; best = p; }
          }
          frei.splice(frei.indexOf(best), 1);
          bedarfJeTeam[t.id][best.pos] = Math.max(0, (bedarfJeTeam[t.id][best.pos] || 0) - 1.5);
          const unsicher = Math.round(2 + pick * 0.12 + (best.fruehmelder ? 3 : 0));
          best.medien.prognose = { pick, runde, teamId: t.id, team: t.name,
            spanne: [Math.max(1, pick - unsicher), Math.min(D.runden * teams.length, pick + unsicher)] };
          mock.push({ pick, runde, teamId: t.id, talentId: best.id });
        });
      }
    }
    talente.forEach(p => { if (!p.medien.prognose) p.medien.prognose = { pick: null, runde: null, teamId: null, team: null, spanne: null }; });
    return { jahr: opts.jahr, talente, mock, reihenfolge: reihenfolge.map(t => t.id), voraus };
  }
  // Talente entwickeln sich bis zum Draft weiter (staerke 1 = ein Jahr, 0,5 = halbes Jahr): Stärke steigt,
  // das Potenzial schwankt – manche explodieren (Spätzünder), manche stagnieren
  function jahrgangEntwickeln(r, jg, staerke) {
    jg.talente.forEach(p => {
      const plus = Math.round((r.int(0, 2) + (p.age <= 18 ? 1 : 0)) * staerke);
      let pot = p.truePotential + Math.round(r.normal(0, 1.2 * staerke));
      const w = r();
      if (w < 0.05 * staerke) pot += r.int(3, 6);
      else if (w > 1 - 0.05 * staerke) pot -= r.int(3, 6);
      setzeOvr(p, klemme(p.ovr + Math.min(plus, Math.max(0, pot - p.ovr)), 35, 99));
      const vorher = p.truePotential;
      p.truePotential = klemme(pot, p.ovr, 99);
      if (p.diamant) p.diamant.schein = klemme(p.diamant.schein + (p.truePotential - vorher), p.ovr, 99);
    });
    return jg;
  }



  // ── Alte Spielstände: Positionen mit Seite (D95, Bestandsschutz) ─────────
  // Einmal je Kader (Verein, Free Agents, Draft-Jahrgang): AV → LV/RV, FL → LF/RF (+ LM/RM derselben Seite gelernt – bis D95 waren
  // LM/RM-Plätze Flügelplätze), AM → LM/RM. Je Gruppe ausgeglichen: wer AV oder FL als Stammposition hat, nach Stärke – der Stärkste
  // nach Seed, dann immer die Seite, die weniger hat; opt.vorgabe (Map Spieler → 'L'/'R', z. B. Platz in der Aufstellung) geht vor.
  // Nebenpositionen ohne Seite folgen der Seite der Stammposition, sonst der Seite, auf der der Verein dünner besetzt ist.
  // Gibt die Zahl umgestellter Spieler zurück; ändert pos und positions am Spieler (Spiel- wie Welt-Kürzel bleiben, wie sie sind).
  function seitenUmstellen(liste, opt) {
    opt = opt || {};
    const vorgabe = opt.vorgabe || new Map(), saat = String(opt.saat || '');
    const hat = (p, g) => (p.positions && p.positions.length ? p.positions : [p.pos]).some(x => dflPos(x) === g);
    const seiteVonSaat = p => (hashText(String(p.id || p.name) + '|' + saat) & 1 ? 'R' : 'L');
    const seite = new Map();                                    // Spieler → { g: 'L'/'R' } je Gruppe
    const setze = (p, g, s) => { const m = seite.get(p) || {}; m[g] = s; seite.set(p, m); };
    const GR = ['AV', 'FL', 'AM'], zahl = {}, stamm = {};
    // 1) Stammpositionen ohne Seite, je Gruppe ausgeglichen
    GR.forEach(g => {
      zahl[g] = { L: 0, R: 0 };
      stamm[g] = liste.filter(p => p && dflPos((p.positions && p.positions[0]) || p.pos) === g).sort((a, b) => (b.ovr || 0) - (a.ovr || 0));
      stamm[g].forEach(p => { if (vorgabe.has(p)) { setze(p, g, vorgabe.get(p)); zahl[g][vorgabe.get(p)]++; } });
      let naechste = null;
      stamm[g].forEach(p => {
        if (vorgabe.has(p)) return;
        const z = zahl[g], s = z.L !== z.R ? (z.L < z.R ? 'L' : 'R') : (naechste || seiteVonSaat(p));
        setze(p, g, s); z[s]++; naechste = s === 'L' ? 'R' : 'L';
      });
    });
    // 2) Nebenpositionen ohne Seite: Seite der Stammposition (auch der eben umgestellten), sonst wo der Verein dünner ist
    GR.forEach(g => {
      liste.filter(p => p && stamm[g].indexOf(p) < 0 && hat(p, g)).sort((a, b) => (b.ovr || 0) - (a.ovr || 0)).forEach(p => {
        const ps = p.positions && p.positions.length ? p.positions : [p.pos];
        const z = zahl[g], m = seite.get(p);
        const eigeneSeite = seiteVon(ps[0]) || (m && Object.values(m)[0]) || (vorgabe.has(p) ? vorgabe.get(p) : null);
        const s = eigeneSeite || (z.L !== z.R ? (z.L < z.R ? 'L' : 'R') : seiteVonSaat(p));
        setze(p, g, s); z[s] += 0.5;
      });
    });
    let n = 0;
    seite.forEach((m, p) => {
      const alt = p.positions && p.positions.length ? p.positions.slice() : [p.pos], neu = [];
      const dazu = x => { if (x && neu.indexOf(x) < 0) neu.push(x); };
      alt.forEach(x => { const g = dflPos(x); dazu(m[g] ? mitSeite(g, m[g]) : x); });
      if (m.FL) dazu(mitSeite('AM', m.FL));                    // Flügel lernen LM/RM ihrer Seite
      if (neu.join() !== alt.join()) { p.positions = neu; p.pos = neu[0]; n++; }
    });
    return n;
  }

  // ── Auswertung (für Prüfung und Vorschau) ────────────────────────────────
  function verteilung(teams) {
    const baender = [['90–99', 90, 99], ['80–89', 80, 89], ['70–79', 70, 79], ['60–69', 60, 69], ['unter 60', 0, 59]];
    const alle = [].concat(...teams.map(t => t.roster));
    return baender.map(([name, lo, hi]) => {
      const n = alle.filter(p => p.ovr >= lo && p.ovr <= hi).length;
      return { band: name, anzahl: n, anteil: n / alle.length };
    });
  }

  // Liga-Cap setzen (wächst jährlich, D23). Mindest- und Perspektivgehalt wachsen mit,
  // laufende Verträge bleiben in Euro.
  function setzeCap(cap) {
    CFG.cap = Math.round(cap);
    CFG.mindestgehalt = rund(CFG.cap * CFG.mindestAnteil, 10000);
    CFG.perspektivGehalt = rund(CFG.cap * CFG.perspektivAnteil, 10000);
  }
  // Einzelnen Spieler erzeugen (Free Agents, Ersatz); team braucht nur { id, city }
  function erzeugeSpieler(r, team, pos, ovr, alter, kennung, namen) {
    return neuerSpieler(r, team, pos, ovr, alter, kennung, namen || new Set());
  }

  window.DFLGenerator = { medienText,
    CFG, erzeugeLiga, erzeugeDraftJahrgang, jahrgangBewerten, jahrgangEntwickeln, capHitSpieler, capHitTeam, marktgehalt, rookieGehalt, rookieCapHit,
    forderung, verhandlungstyp, startelfVon, teamOvr, staerkeElf, startStilFuer, stilFormationen, startSoll, verteilung, rngAus, kaderAnalyse, draftUrteil, sichtAuf, hashText, nieteWuerfeln, potSichtbar, diamantWuerfeln, diamantEntdecken,
    setzeCap, setzeOvr, ovrAus, erzeugeSpieler, baueVertrag, bedarf, POS_BEREICH, dflPos,
    // D95: Positionen mit Seite
    GRUPPEN, herkunftVon, POS12, GRUND, KANTEN, ABZUG, grund, seiteVon, mitSeite, andereSeite, altbestand, positionsAbzug, abzugAuf, positionenVon,
    kaderSoll, startelfZuordnung, positionenFuer, ungarisch, seitenUmstellen,
    // D110: Kaderziel nach Lage; L3: Stil und Formation
    kaderZiel, kaderVoll, sollFormationen
  };
  console.log('%c[DFL-Generator v1] aktiv', 'color:#3fb950;font-weight:bold',
    '— 32 Kader (28 + 6), NFL-Gehälter, Verhandlungsprofil, Draft-Jahrgang mit Medienliste');
})();
