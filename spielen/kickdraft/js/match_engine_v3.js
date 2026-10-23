/* ===== match_engine_v3.js =====
   RÄUMLICHE MATCH-ENGINE (Prototyp)
   ─────────────────────────────────────────────────────────────────────────────
   Unterschied zu v2: KEINE abstrakten Zonen mehr. Jeder Spieler hat echte
   Koordinaten auf einem 105×68-Feld und trifft EIGENE Entscheidungen aus der
   tatsächlichen Geometrie:
     · Wer ist frei? (Abstand, Deckung, Passweg durch Gegner blockiert?)
     · Habe ich Raum vor mir? (Dribbling)
     · Lohnt der Abschluss? (echte Distanz + Winkel → xG)
   Dadurch ENTSTEHT das Ergebnis aus der Bewegung — und eine 2D-Ansicht muss
   nichts mehr rekonstruieren, sie zeigt einfach die Wahrheit.

   Läuft headless und schnell (ein Spiel in wenigen Millisekunden), damit
   Schnellsimulation und Textmodus unverändert nutzbar bleiben.

   Taktisches Verhalten (Nutzer-Vorgabe):
     · ohne Ball  → Zentrum verdichten, ballferner Flügel wird freigelassen,
                    Viererkette hält die Linie, 1–2 Spieler pressen
     · mit Ball   → Flügel halten Breite, Spieler starten in den Rücken der Kette

   TORVERTEILUNG (D66, 2026-10-10, Schalter in CFG): Tiefenläufe der zweiten Reihe (Zehner, Achter, Außen, Schienen,
   Flügelstürmer von vor der Linie) mit Gegenbewegung des Mittelstürmers, Mittelfeldspieler nehmen sie auf; Steckpass in
   den Lauf statt in den Fuß an der Linie; Außen ziehen nach innen; Flanken gestreut, Kopfbälle kaum geblockt; Schienen
   spielen mit Ball wie Außenspieler und ohne Ball in der Fünferkette; Abschlussfaktor hält die Tore je Spiel.
   Gemessen (rohe Engine, 4 Vereine × 11 Formationen × 31 Gegner × Heim/Auswärts): Stürmer 63 → 46 % der eigenen Tore
   (bester Schütze je Verein 46–55 → 29–45 %), Kopfballtore 5 → 13 %, Tore je Spiel gleich (1,41).
   Nach Änderungen hier: CFG.bruecke.modell in dfl_engine_patch.js neu eichen (docs/notizen/dfl-engine-fairness.md).
   ============================================================================= */
(function () {
  'use strict';

  const L = 105, B = 68, TICK = 0.28;         // Feldmaße (m), Simulationsschritt (s)

  const CFG = {
    matchSeconds: 5400, nachspielzeit: 60,
    // Laufgeschwindigkeiten (m/s) — visuell getunt, nicht physikalisch exakt
    speed: { walk: 2.2, jog: 4.4, run: 6.2, sprint: 7.6 },
    ballSpeed: { pass: 17, through: 20, long: 24, cross: 19, shot: 27, clear: 22 },
    decideEvery: [1.75, 3.9],                  // wie lange der Ballführende den Ball hält
    controlRadius: 1.6,                       // Ballannahme
    pressRadius: 9,                           // ab hier läuft ein Verteidiger an
    hoheLinieLockt: 2.0,                      // PC-Coaching: Zuschlag je Meter hoher Linie des Gegners auf Steilpässe in den Lauf (× 1 + Tempovorteil)
    hoheLinieTempo: 0.06,                     // PC-Coaching: Erfolg eines Passes in den Lauf je Meter hoher Linie × Tempovorteil des Empfängers
    kettUmdrehen: 0.6,                        // PC-Coaching: Kette muss sich umdrehen – Sekunden halbes Tempo je Meter hoher Linie × Tempovorteil
    pressDruck: 2.0,                          // PC-Coaching: aggressives Pressing – Druck auf den Passgeber zählt (1 + (press−1)·x)
    pressLuecke: 0.8,                         // PC-Coaching: aggressives Pressing reißt Lücken – zugestellte Wege zählen (1 − (press−1)·x)
    pressFoul: 1.2,                           // PC-Coaching: aggressives Pressing foult öfter – Foulchance × (1 + (press−1)·x)
    tackleRadius: 1.6,                        // Zweikampf am Ball
    // WICHTIG: Das ist eine RATE pro Tick. Zu hoch → der Ball ist sofort weg und
    // es kommt nie zum Passspiel (Erfahrung: 0,115 ergab 453 Fouls pro Spiel).
    tacklePerTick: 0.016,
    foulOnTackle: 0.30,                      // Anteil der Zweikämpfe, die Foul sind
    interceptRadius: 2.0,                     // Passweg abfangen
    // Bewegung/Ordnung: Antrittszeit, persönliche Positionsneigung, Planungsphasen
    traegheit: 0.28, eigenart: 1, phasen: 2,
    // Gegenpressing: Fenster in Sekunden, Zweikampf-Zuschlag, Stärke der Gegnerbindung
    sardSekunden: 5, sardBiss: 1.9, binden: 0.45,
    // Ballbesitzuhr aus dem Spielmodell + Mindestqualität für einen Abschluss
    zuendenSek: 4.5, zuendenAb: 62, auftankenSek: 14,
    // Abschluss-Schwelle: ab welchem xG ein Schuss überhaupt zur Option wird.
    // 0,104 passte zur alten Passquote; mit realistischem Passspiel kommen
    // weniger Angriffe durch, entsprechend niedriger die Schwelle.
    // Mit den Spielprinzipien und korrekten Abseitspositionen (2026-09-16) neu
    // kalibriert. Das Verhältnis schwelle/xgFaktor bestimmt die Schussreichweite:
    // ~0,073 ergibt gut 15 m zentral. (0,13/1,3 schnitt sie auf 13 m — zwischen
    // 13 und 16 m wurde dann gar nicht mehr geschossen, und Mannschaften mit
    // offensiven Mittelfeldspielern verloren die Hälfte ihrer Abschlüsse.)
    schwelle: 0.215,
    // Konditionsverbrauch je gelaufenem Meter (kalibriert auf ~0,70 nach 90 min)
    kondVerbrauch: 0.0000225, wechselMax: 3, totzone: 2.0,
    qualityPer: 0.007,                      // Attributwirkung je Punkt über 70
    // Können in den entscheidenden Zweikämpfen (Pass, Abfangen). Verankert am
    // tatsächlichen Mittel des Spiels statt an 70, und deutlich steiler — sonst
    // schlägt Kaderqualität nicht auf die Tabelle durch.
    koennenMitte: 55, koennenSteil: 0.016,
    // Passgenauigkeit: Grundwert bei Können 55, Steigung je Könnenspunkt und
    // Extra-Abzug für Flanken. Kalibriert auf reale Werte (siehe passBall).
    passBasis: 1.075, passSteil: 0.005, flankenAbzug: 0.30,
    // Grundwahrscheinlichkeit, einen Pass im Laufweg abzufangen. Vorher griff
    // JEDER Gegner im Radius zu 100 % zu — Abfangen (114 pro Spiel!) war damit
    // die häufigste Aktion des Spiels ganz ohne Können.
    abfangBasis: 0.78,
    // Heimvorteil. v3 hatte GAR KEINEN — v2 kannte opt.homeAdv, v3 nicht, und
    // der Adapter reichte es auch nicht durch: gleiche Seeds ergaben Heim wie
    // Auswärts exakt dasselbe Ergebnis. Wirkt auf Abschlussqualität und
    // Reaktionsschnelligkeit; kalibriert auf real ~45 % Heimsiege.
    heimVorteil: 0.05,
    // ── SPIELPRINZIPIEN ──────────────────────────────────────────────────────
    // Vorlage: „Vom Prinzip zum Zuruf" v0.3 und „Ein Jahr bis zur B-Bundesliga"
    // (Spielmodell des Nutzers). Die Schlüssel sind die Zurufe aus dem Dokument.
    // Jedes Prinzip ist einzeln schaltbar, damit sich seine Wirkung mit dem
    // Zählbogen (tools/engine_zaehlbogen.js) vorher/nachher messen lässt.
    prinzipien: {
      ballhoehe: true,         // Flugbahn mit Höhe: flach, halbhoch, hoch
      schraegDrauf: true,      // „schräg drauf!" — diagonal anlaufen, Mitte zu
      deckungsschatten: true,  // der Ballführer spielt nicht durch den Anläufer hindurch
      werSichert: true,        // „wer sichert?" — der Zweite sichert, der Dritte stellt den Passweg zu
      ballnahKompakt: true,    // Block verschiebt stärker zum Ball
      nachruecken: true,       // „nachrücken!" — Rückpass und Klärung lösen Rausschieben aus
      tiefeBegleiten: true,    // Ball offen → Kette fällt, Tiefenläufe werden begleitet
      absichern: true,         // „absichern!" — Restverteidigung steht bei den Konterspielern
      timingStart: true,       // „jetzt!" — Start beim vorletzten Kontakt, Ball in den Lauf
      weiter: true,            // „weiter!" — nach dem Pass weiterbewegen
      versetzt: true,          // „versetzt!" — nie zwei auf einer Höhe in derselben Bahn
      geschlossen: true,       // „der ist zu!" — kein Ball in den zugestellten Spieler, sonst klatsch
      breite: true,            // „bleib draußen!" — Außenbahnspieler halten Breite
      zeitAmBall: true,        // unter Druck bleibt weniger Zeit für die Entscheidung
      sofortUmschalten: true,  // „sofort!" — nach Ballverlust zurück hinter den Ball laufen
      balldruck: true,         // „Balldruck" — vor dem eigenen Strafraum früher drauf
      distanzschuss: true,     // Abschluss aus 16–26 m bei freier Schussbahn
      rueckraum: true,         // von der Grundlinie zurück in den Rückraum spielen
      zwischenLinien: true     // Zehner und offensive Außen bieten sich vor der Kette an
    },
    // Ballflug: Schwerkraft und Reichweiten (m). Reichweite = bis zu welcher Höhe
    // ein Feldspieler einen Ball im Flug noch erreicht (Fuß/Körper bzw. Kopf).
    schwerkraft: 9.81, reichFuss: 1.05, reichKopf: 2.35, reichTorwart: 2.7,
    // Ausgleich für „Zeit am Ball" (siehe Zweikampf in step)
    zweikampfUnterDruck: 1.6,
    // „Ballnah kompakt" im Gegenpressing: wie stark die Kette mit zusammenrückt (0–1)
    verdichtenKette: 1,
    // Seitliches Verschieben des Blocks je Meter Ballversatz (mit „ballnahKompakt")
    verschiebenSeite: 0.22,
    // Passabzug nach Zielzone (Strafraum / letztes Drittel) — der Hebel für die
    // Chancenzahl. Ohne Spielprinzipien kalibriert: 0,06 / 0,02.
    zoneStrafraum: 0.06, zoneDrittel: 0.02,
    // Skalierung der Chancenqualität (xG). 1,0 = alte Kalibrierung.
    xgFaktor: 2.95,
    // Grundbewertung des Distanzschusses (gegen die Passoptionen, Größenordnung 5–15)
    // und wie oft ein Spieler überhaupt an den Abschluss aus der Distanz denkt
    // (D66: 0,35 → 0,5 – aus der zweiten Reihe wird öfter geschossen, nicht nur der Mittelstürmer schließt ab)
    distanzBasis: 10, distanzNeigung: 0.5,
    // ABSEITS: Angreifer warten nicht mehr hinter der Abwehr (vorher im Schnitt
    // 22 m tief, in 60 % der Spielzeit mehr als 10 m). Spielraum in Metern über
    // der Linie: bei weit entferntem Ball bzw. in Ballnähe (negativ = davor).
    abseitsSpielraum: 2, abseitsSpielraumNah: -0.6,
    abseitsDeckel: true,
    // ── REGELN (2026-09-16) ──────────────────────────────────────────────────
    // abseitsEcht:   gepfiffen wird nach der echten Lage beim Abspiel (vorletzter
    //                Gegner, Ball, Mittellinie) — nicht mehr per Zufall beim Steckpass
    // foulsEcht:     Foul hängt an der Situation (von hinten, müde, Konter
    //                unterbinden), mit Täter und Opfer, Vorteil, Karten, Platzverweis
    // freistossEcht: Freistöße mit Aufstellung — Mauer, direkter Schuss, Flanke
    // Einzeln schaltbar, damit der Zählbogen vorher/nachher messen kann.
    regeln: { abseitsEcht: true, foulsEcht: true, freistossEcht: true },
    // Standards (D118, Standardtrainer): eine Ecke oder ein Freistoß (außer „kurz“) startet eine Standardphase des ausführenden
    // Teams; sie endet mit dem Ballverlust oder `standardNach` Sekunden nach dem Freigeben des Balls. Abschlüsse darin und direkte
    // Freistöße zählen als Standard (Elfmeter nie). opt.standard = [Team 0, Team 1] skaliert nur deren Ausgang (1 = ohne Wirkung).
    standardNach: 20,
    // Wie genau sieht der Passgeber die Linie? Toleranz in Metern, wenn der
    // Empfänger steht bzw. gerade losläuft. Der Linienrichter irrt nur knapp (±m).
    // Im Zweifel für den Angreifer: gleiche Höhe ist kein Abseits (Vorgabe an die
    // Linienrichter) — gewunken wird erst ab abseitsZweifel Metern, ± Irrtum.
    abseitsBlick: [0.3, 0.8], abseitsIrrtum: 0.25, abseitsZweifel: 0.2,
    // Kalibrierhebel für Fouls, Karten und Elfmeter (1 = Grundwert)
    // Kalibriert 2026-09-16 (je Spiel): 23–28 Fouls, ~4 Gelbe, 0,1–0,2 Rote,
    // 0,2–0,4 Elfmeter, 3,5–4,5 Abseits, ~1 direkter Freistoß, ~2 Vorteil.
    foulKorrektur: 0.5, kartenKorrektur: 1.05, strafraumVorsicht: 0.15, schwalbeQuote: 0.012,
    // ── TORVERTEILUNG (D66, 2026-10-10) ──────────────────────────────────────
    // Gemessen vorher (rohe Engine, 4 Vereine × 5 Formationen gegen alle 31 Gegner): der Mittelstürmer gab 6,6 von
    // 10,9 Schüssen je Spiel ab und traf 45–75 % der eigenen Tore. Gut die Hälfte aller Tore kam aus Steckpässen –
    // ein Drittel davon in den Fuß des Stürmers, der an der Abseitslinie stand –, Zehner bekamen fast nie einen Ball
    // in den Lauf, Flanken brachten 5 % (70 % der Kopfbälle blieben in der Schussblock-Prüfung hängen), und die
    // Schienen einer Dreier-/Fünferkette spielten wie Außenverteidiger (3-5-2 = 5-3-2). Alles einzeln schaltbar.
    // zweiteReihe: Zehner, Achter, offensive Außen und Schienen starten Tiefenläufe auch aus bis zu `tiefe` m hinter
    //   der Linie (`tiefeDrittel` im letzten Drittel), auch etwas hinter dem Ball, mit bis zu `vorlauf` s Vorlauf.
    //   `max` Tiefenläufer gleichzeitig, je Angriff will ein Spieler der zweiten Reihe mit Wahrscheinlichkeit `quote`;
    //   `uebernehmen`: so nah (m) muss ein Mittelfeldspieler des Gegners sein, um den Läufer mitzunehmen (0 = nur die Kette).
    //   `gegenbewegung`: so oft kommt der Mittelstürmer dabei kurz (zieht seinen Verteidiger mit, legt ab) – gemessen über
    //   4 Vereine: 4-3-3 Mittelstürmer 0,6 → 50 %, 1 → 42 % der eigenen Tore bei gleicher Torzahl.
    //   `achter`: die äußeren Achter (4-3-3, 3-5-2) wären für Tiefenläufe immer bereit wie Zehner und Außen (sonst 25/75 %) –
    //   aus: im 4-3-3 +28 % Tore, ohne dass sich der Stürmeranteil weiter bessert als mit voller Gegenbewegung.
    zweiteReihe: { an: true, tiefe: 18, tiefeDrittel: 22, hinterBall: 6, vorlauf: 3.2, max: 2, quote: 0.8, uebernehmen: 10, gegenbewegung: 1, achter: false },
    // steilpass: Zuschlag für den Steckpass [Brechen, Zünden] – in den Fuß an der Linie / in den Lauf, dazu für
    //   Läufer aus der Tiefe. Vorher 7/11 in den Fuß und 4/7 in den Lauf: der Ball ging an die Linie statt in den Lauf.
    //   `torwart`: der Torwart läuft einem Ball in den Strafraum entgegen, wenn sein Weg kürzer ist als der des Empfängers × Faktor;
    //   `laufVorteil`: Vorsprung des gemeinten Läufers im Laufduell an der Landestelle (beides vorher fest 0,8 / 0,14).
    steilpass: { fuss: [2, 3], lauf: [5, 8], tief: 2, torwart: 0.8, laufVorteil: 0.14 },
    // fluegelInnen: offensive Außen und Schienen ziehen im letzten Drittel mit dem Ball nach innen (in `quote` der
    //   Entscheidungen eine eigene Option: Grundwert `zuschlag` + xG-Gewinn × `gewinn`), statt nur zur Grundlinie zu laufen.
    //   `invertiert`: Anteil der Angriffe, in denen der ballnahe Flügelstürmer im letzten Drittel in den Halbraum einrückt.
    //   `diagonal`: so weit (m, + bis 5 m Zufall) laufen Außen beim Tiefenlauf nach innen (vorher 4).
    //   `vorLinie`: so viele Meter (+ bis 3) vor der Abseitslinie warten Flügelstürmer vor dem letzten Drittel (zählen als zweite Reihe).
    fluegelInnen: { an: true, quote: 0.65, zuschlag: 3, gewinn: 90, invertiert: 0.5, diagonal: 9, vorLinie: 6 },
    // rueckpass: Rückpass von der Grundlinie in den Rückraum – ab dieser Höhe (m) und mit diesem Zuschlag (vorher 89 / 6)
    rueckpass: { ab: 86, zuschlag: 8 },
    // flanke: Ziel nach Kopfball, Lage und Einlauf (Zuschlag für Einläufer), gestreut mit `streu` (0 = immer der
    //   beste Kopfballspieler); `kopfBlock` = Anteil der Block-Wahrscheinlichkeit beim Kopfball (der Ball ist in der Luft).
    //   `rueckraum`: Abstand (m) des vierten Einlaufpunkts vor dem Tor (vorher 18 – außerhalb der Rückpass-Zone 6–17 m).
    //   `twFang`: Grundwert, mit dem der Torwart eine Flanke in seiner Nähe fängt (vorher fest 0,42).
    flanke: { streu: 7, einlauf: 4, kopfBlock: 0.25, rueckraum: 15, twFang: 0.42 },
    // schiene: Außenverteidiger in einer Dreierkette (Schienenspieler) spielen mit Ball wie Außenspieler – breit,
    //   `vor` m höher, im letzten Drittel ballnah an der Linie, ballfern zum zweiten Pfosten – und gehen ohne Ball
    //   zurück in die Fünferkette.
    schiene: { an: true, vor: 10 },
    // abschluss: Faktor auf die Torwahrscheinlichkeit aller Abschlüsse außer Elfmetern (nur der Ausgang, nicht die
    //   Entscheidung zu schießen). Hält die Tore je Spiel der rohen Engine auf dem Stand vor D66: gemessen 4 Vereine ×
    //   11 Formationen × 31 Gegner, Heim/Auswärts – vorher 2,58 Tore je Spiel, mit allen D66-Teilen ohne Faktor ≈ 3,3
    //   (aus 0,8 → 2,70 hochgerechnet), mit 0,78 wie vorher.
    abschluss: 0.78,
    // Prüfhilfe für tools/engine_zaehlbogen.js: ein Objekt zählt Entscheidungen mit
    _zaehler: null
  };

  // Rollen: wie stark folgt der Spieler dem Ball (längs/quer), Grundbreite
  const ROLE = {
    TW: { fx: 0.06, fy: 0.16, press: 0 },
    IV: { fx: 0.46, fy: 0.34, press: 0.7 },
    AV: { fx: 0.58, fy: 0.46, press: 0.9 },
    ZM: { fx: 0.60, fy: 0.50, press: 1.0 },
    FL: { fx: 0.56, fy: 0.54, press: 0.8 },
    ST: { fx: 0.44, fy: 0.40, press: 0.6 }
  };

  function rngFrom(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // sqrt statt Math.hypot: hypot ist deutlich langsamer und steckt hier im heißen Pfad
  const dist = (a, b) => { const dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); };
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const q = (v) => 1 + ((v || 60) - 70) * CFG.qualityPer;
  // Zweikampf-Können: eigener, STEILERER Faktor für die Entscheidungen, die ein
  // Spiel tatsächlich drehen (Pass, Abfangen). `q()` ist bei 70 verankert und
  // flach — in einer Regionalliga, wo alle zwischen 40 und 60 liegen, bekommt
  // JEDER einen Abschlag und die Unterschiede verschwinden: gemessen erzeugte
  // ein Vorsprung von 6 OVR nur 1,7 Prozentpunkte Passquote und damit ganze
  // 3 Tabellenpunkte über eine Saison. `qs()` ist am tatsächlichen Mittel des
  // Spiels (55) verankert und doppelt so steil.
  const qs = (v) => 1 + ((v || 55) - CFG.koennenMitte) * CFG.koennenSteil;

  // ── Aufbau ─────────────────────────────────────────────────────────────────
  // team.players: [{name,num,pos,px,py,ovr,att,mid,def,pace,technik}]
  // px/py in 0..100 (px 0 = eigenes Tor). dir = +1 (spielt nach rechts) / -1
  // ── Feine Spielerwerte beschaffen ───────────────────────────────────────────
  // Reihenfolge: direkt mitgeliefert → aus dem Attribut-Modul über den echten
  // Kaderspieler → Notbehelf aus den Grobwerten. Der letzte Weg hält die Engine
  // eigenständig lauffähig (Prototyp-Seite, Tests) und ist der Grund, warum
  // hier nicht einfach spielerWerte() aufgerufen wird.
  // Tagesform eines Spielers. Der Kader speichert sie als `fitness`, die Engine
  // fragte bisher nur `fit` ab — die Fitness kam damit NIE in der Simulation an
  // und fiel still auf den Standardwert zurück. Beide Namen werden akzeptiert.
  function fitnessVon(p, standard) {
    if (!p) return standard;
    if (p.fit != null && isFinite(p.fit)) return p.fit;
    if (p.fitness != null && isFinite(p.fitness)) return p.fitness;
    return standard;
  }

  function werteVon(p) {
    if (p.werte) return p.werte;
    try {
      if (typeof window !== 'undefined' && window.spielerWerte) {
        const roh = (p._ref && p._ref.id != null) ? p._ref : (p.id != null ? p : null);
        // WICHTIG: die Position MIT übergeben. Ohne sie liefert das Modul immer
        // das Profil der Stammposition — ein Torwart im Feld bekam dadurch den
        // Torwartsatz ohne passen/dribbling/schiessen und die Elf konnte nicht
        // mehr spielen (33 statt 495 Pässe, gemessen).
        // Positionen mit Seite: der Platz (LV, RF …) statt der Rolle, damit der Abzug für die falsche Seite greift
        if (roh) return window.spielerWerte(roh, p.platz || p.pos);
      }
    } catch (e) { /* Notbehelf unten */ }
    const d = p.def || 55, m = p.mid || 55, a = p.att || 55,
          pc = p.pace || 55, tc = (p.technik != null ? p.technik : m) || 55;
    const tw = p.pos === 'TW';
    return {
      ausdauer: Math.round((m + d) / 2), schnelligkeit: pc, kraft: d,
      paraden: d, reflexe: d, einsGegenEins: d, spielaufbau: m, abwurf: m,
      defStellung: d, tackling: d, defEinsGegenEins: d, kopfball: Math.round((d + a) / 2),
      passen: m, spielintelligenz: Math.round((m + d) / 2), dribbling: tc,
      flanken: m, schiessen: a, offStellung: a, offEinsGegenEins: Math.round((pc + tc) / 2),
      _torwart: tw
    };
  }

  function buildSide(team, teamIdx, dir) {
    return team.players.slice(0, 11).map((p, i) => {
      const hx = dir > 0 ? (p.px / 100) * L : L - (p.px / 100) * L;
      const hy = dir > 0 ? (p.py / 100) * B : B - (p.py / 100) * B;
      const w = werteVon(p);
      return {
        id: teamIdx + '_' + i, num: p.num || (i + 1), name: p.name || ('Sp' + i),
        team: teamIdx, dir, role: ROLE[p.pos] ? p.pos : (p.pos === 'TW' ? 'TW' : 'ZM'),
        pos: p.pos, _platz: p.platz,
        x: hx, y: hy, hx, hy,
        att: p.att || 55, mid: p.mid || 55, def: p.def || 55,
        pace: p.pace || 55, tec: (p.technik != null ? p.technik : p.mid) || 55,
        ovr: p.ovr || 60, _ref: p, w: w
      };
    });
  }

  // ── Hilfsgrößen aus echter Geometrie ───────────────────────────────────────
  // Wer ist dem freien Ball am nächsten? (linear statt sort — heißer Pfad)
  function nearestToBall(S) {
    let best = S.players[0], bd = 1e9;
    for (let i = 0; i < S.players.length; i++) {
      const d = dist(S.players[i], S.ball);
      if (d < bd) { bd = d; best = S.players[i]; }
    }
    return best;
  }
  // Alle drei Helfer laufen NUR über die Gegner (S.teams) und mit klassischen
  // for-Schleifen — sie stecken im heißen Pfad und werden Millionen Mal gerufen.
  function pressureOn(S, p) {
    const opp = S.teams[1 - p.team];
    let s = 0;
    for (let i = 0; i < opp.length; i++) {
      const o = opp[i], ox = o.x - p.x, oy = o.y - p.y;
      const q2 = ox * ox + oy * oy;
      if (q2 < 144) s += 1 - Math.sqrt(q2) / 12;
    }
    return s > 2.2 ? 2.2 : s;
  }
  // Steht jemand im Passweg? (Abstand Gegner ↔ Strecke)
  // ohneTw: für die Schussblock-Prüfung MUSS der Torwart ausgenommen werden.
  // Er steht fast immer knapp vor der Torlinie und damit auf der Linie
  // Schütze → Tor; ohne diese Ausnahme wurde jeder Abschluss aus kurzer Distanz
  // als „geblockt" gewertet statt als Parade oder Tor — Elfmeter kamen so auf
  // 40 % statt 76 % Verwertung.
  function laneBlocked(S, from, to, ohneTw) {
    const opp = S.teams[1 - from.team];
    const dx = to.x - from.x, dy = to.y - from.y;
    const len2 = dx * dx + dy * dy || 1;
    const schatten = CFG.prinzipien.deckungsschatten && !ohneTw;
    // Bei Pässen zählt der Gegenspieler direkt am Empfänger nicht als
    // zugestellter Weg — er steckt schon im Druck auf den Empfänger und in
    // „der ist zu". Dreifach gezählt wurde fast jeder Ball nach vorn verworfen
    // (im letzten Drittel 91 Rückpässe gegen 29 Pässe nach vorn je Team).
    const tEnde = (CFG.abseitsDeckel && !ohneTw) ? 0.85 : 0.95;
    let worst = 0;
    for (let i = 0; i < opp.length; i++) {
      const o = opp[i];
      if (ohneTw && o.role === 'TW') continue;
      const ox = o.x - from.x, oy = o.y - from.y;
      // DECKUNGSSCHATTEN: Ein Gegner direkt am Passgeber sperrt nicht jeden Weg
      // nach vorn, sondern nur den Kegel hinter sich (~30°). Mit dem alten
      // Abstands-Test (4,5 m quer zur Linie) blockierte ein Anläufer auf 1,5 m
      // praktisch ALLE Passwege — deshalb war es egal, ob frontal oder schräg
      // angelaufen wurde (Zählbogen: 61 % gegen 58 % nach innen gespielt).
      if (schatten) {
        const od2 = ox * ox + oy * oy;
        if (od2 < 12.25) {                                   // näher als 3,5 m
          const od = Math.sqrt(od2), ll = Math.sqrt(len2);
          if (od >= ll) continue;
          const cosW = (ox * dx + oy * dy) / (od * ll || 1);
          if (cosW > 0.866) {                                // innerhalb von 30°
            const w = (cosW - 0.866) / 0.134 * 0.6 + 0.4;
            if (w > worst) worst = w;
          }
          continue;
        }
      }
      const t = (ox * dx + oy * dy) / len2;
      if (t <= 0.05 || t >= tEnde) continue;
      const ex = o.x - (from.x + dx * t), ey = o.y - (from.y + dy * t);
      const q2 = ex * ex + ey * ey;
      if (q2 < 20.25) { const w = 1 - Math.sqrt(q2) / 4.5; if (w > worst) worst = w; }
    }
    return worst;
  }
  // Nächster Gegner VOR dem Ballführenden — der Mann, den man überspielen kann
  function naechsterGegnerVorn(S, p) {
    const opp = S.teams[1 - p.team];
    let best = null, bd = 1e9;
    for (let i = 0; i < opp.length; i++) {
      const o = opp[i];
      if (o.role === 'TW') continue;
      if ((o.x - p.x) * p.dir < -1) continue;        // schon überspielt
      const d = dist(o, p);
      if (d < bd) { bd = d; best = o; }
    }
    return best ? { p: best, d: bd } : null;
  }
  function spaceAhead(S, p) {
    const opp = S.teams[1 - p.team];
    let best = 900;
    for (let i = 0; i < opp.length; i++) {
      const o = opp[i];
      if ((o.x - p.x) * p.dir <= 0) continue;         // nur vor dem Spieler
      const ox = o.x - p.x, oy = o.y - p.y;
      const q2 = ox * ox + oy * oy;
      if (q2 < best) best = q2;
    }
    const d = Math.sqrt(best);
    return d > 25 ? 25 : d;
  }
  // xG an einem anderen Punkt ohne Druck (D66: lohnt sich der Weg nach innen?)
  function xgPunkt(S, p, x, y) {
    const gx = p.dir > 0 ? L : 0, gy = B / 2;
    const d = Math.hypot(gx - x, gy - y);
    let xg = 0.66 * Math.exp(-d / 7.0) * Math.max(0.12, 1 - Math.abs(y - gy) / 30) * CFG.xgFaktor * q(p.w.schiessen);
    if (S.heim && S.heim[p.team]) xg *= (1 + CFG.heimVorteil);
    if (S.stil) xg *= S.stil[p.team];
    return xg;
  }
  // xG aus echter Distanz und Winkel
  function xgAt(S, p) {
    const gx = p.dir > 0 ? L : 0, gy = B / 2;
    const d = Math.hypot(gx - p.x, gy - p.y);
    const off = Math.abs(p.y - gy);
    const winkel = Math.max(0.12, 1 - off / 30);
    // Kalibriert an echten xG-Modellen: 6 m ≈ 0,26 · 11 m ≈ 0,13 · 16 m ≈ 0,06 · 25 m ≈ 0,02
    let xg = 0.66 * Math.exp(-d / 7.0) * winkel * CFG.xgFaktor;
    xg *= q(p.w.schiessen);
    xg *= (1 - Math.min(0.45, pressureOn(S, p) * 0.20));
    // Heimvorteil: zu Hause fällt der Abschluss etwas leichter (Publikum, Platz).
    if (S.heim && S.heim[p.team]) xg *= (1 + CFG.heimVorteil);
    // Spielstil (D55): Faktor je Team aus Kreis, Formation, Spielerpassung und Eingewöhnung – wie der Heimvorteil
    if (S.stil) xg *= S.stil[p.team];
    return clamp(xg, 0.004, 0.68);
  }
  // Wie weit die Elf ihre Grundordnung verschiebt — in Metern Richtung
  // gegnerisches Tor. Negativ heißt: tiefer stehen und verwalten.
  // ── Anweisungen je Team (PC-Live-Coaching, 2026-10-20, Nutzer: „mehr coachen wie im FM“) ──────────────
  // S.anw = [Team 0, Team 1] oder null. Ohne Eintrag gilt ANW0 (alles neutral) – KI-Spiele und Handy rechnen wie vorher.
  // linie: Meter, um die die Kette OHNE Ball höher (+) / tiefer (−) steht · press: Reichweite des Anlaufens ·
  // tempo: Ball schneller (> 1) oder ruhiger (< 1) abspielen · breite: Abstand der Grundordnung zur Mitte mit Ball ·
  // risiko: Zuschlag aufs Gewicht für Raumgewinn beim Pass · lang: Zuschlag für weite Bälle · fluegel: über außen (+) /
  // durch die Mitte (−) · schuss: Schussneigung · haerte: Foul- und Zweikampfneigung · zeit: Sekunden mehr bei eigenen
  // Standards (Zeit schinden) · lauf, fehler, zweikampf: Wirkung der Zurufe (Tempo, Passfehler, Zweikampf) ·
  // kraft: Kraftverbrauch (hohes Pressing, Tempo und hohe Linie kosten Kraft – sonst wäre „immer Vollgas“ die beste Wahl)
  const ANW0 = Object.freeze({ linie: 0, press: 1, tempo: 1, breite: 1, risiko: 0, lang: 0, fluegel: 0, schuss: 1, haerte: 1,
                               zeit: 0, lauf: 1, fehler: 1, zweikampf: 1, kraft: 1 });
  const anw = (S, t) => (S.anw && S.anw[t]) || ANW0;
  // Tempovorteil eines Angreifers gegen den langsamsten Verteidiger des Gegners (10 Punkte = 1), für die hohe Linie
  function tempoVorteil(S, c) {
    const hinten = S.backs && S.backs[1 - c.team];
    if (!hinten || !hinten.length) return 0;
    let lahm = 99;
    for (const q of hinten) if (q.w && q.w.schnelligkeit < lahm) lahm = q.w.schnelligkeit;
    return clamp(((c.w && c.w.schnelligkeit || 60) - lahm - 10) / 10, -0.5, 1.5);   // erst über die üblichen 10 Punkte Stürmer-gegen-Innenverteidiger hinaus
  }
  // Aggressives Pressing des Gegners lässt Lücken: zugestellte Wege wiegen weniger
  const pressDruck = (S, t) => { const pr = anw(S, 1 - t).press; return pr > 1 ? 1 + (pr - 1) * CFG.pressDruck : 1; };
  const pressLuecke = (S, t) => { const pr = anw(S, 1 - t).press; return pr > 1 ? Math.max(0.5, 1 - (pr - 1) * CFG.pressLuecke) : 1; };

  function spielstandsSchub(S, team) {
    const min = S.clock / 60;
    if (min < 55) return 0;
    const diff = S.stats[team].goals - S.stats[1 - team].goals;
    if (!diff) return 0;
    const dringlich = Math.min(1, (min - 55) / 30);      // 0 bei 55', 1 ab 85'
    if (diff < 0) return dringlich * Math.min(2, -diff) * 4.0;   // Rückstand: aufrücken
    return -dringlich * Math.min(2, diff) * 2.6;                 // Führung: absichern
  }

  // Letzte Linie des Gegners (für Läufe in den Rücken)
  // Letzte Linie des GEGNERS von teamIdx aus gesehen. Wird einmal pro Tick
  // vorberechnet (S._line), nicht pro Spieler — sonst kostet es zu viel.
  function computeLines(S) {
    // S._line[t] = hinterste Position der gegnerischen Feldspieler (aus Sicht von t)
    let mx = -1e9, mn = 1e9;
    for (let i = 0; i < S.players.length; i++) {
      const p = S.players[i];
      if (p.role === 'TW') continue;
      if (p.team === 1) { if (p.x > mx) mx = p.x; }   // Team1 verteidigt gegen Team0 (nach +x)
      else { if (p.x < mn) mn = p.x; }
    }
    // Die Kette steht nie auf der Torlinie — sonst wandert die Abseitslinie in den
    // Fünfmeterraum und beide Sturmreihen campen dort (gemessen: mehr Ereignisse
    // im Strafraum als im gesamten Mittelfeld).
    // Seit Angreifer grundsätzlich nicht mehr hinter der Abseitslinie warten
    // (target), reicht die Grenze am Fünfmeterraum — mit 13 m hielt sie die
    // Stürmer künstlich aus der gefährlichen Zone heraus.
    const RAND = CFG.abseitsDeckel ? 9 : 13;
    if (mx > L - RAND) mx = L - RAND;
    if (mn < RAND) mn = RAND;
    S._line = [mx === -1e9 ? L - 20 : mx, mn === 1e9 ? 20 : mn];
  }
  function lastLine(S, teamIdx) { return S._line[teamIdx]; }

  // ── ABSEITS NACH DER REGEL ─────────────────────────────────────────────────
  // Im Abseits steht, wer beim Abspiel in der gegnerischen Hälfte näher an der
  // Torlinie ist als der Ball UND als der vorletzte Gegenspieler (meist der
  // letzte Feldspieler, weil der Torwart dahinter steht). Gemessen wird die
  // echte Lage — ohne die Begrenzung aus computeLines, die nur der Aufstellung dient.
  // Rückgabe: ueber = Meter jenseits der Linie (> 0 = Abseits), linie = x der Linie.
  // x der Abseitslinie für die Angreifer von teamIdx (Ball und Mittellinie eingerechnet)
  function abseitsLinie(S, teamIdx, ballX) {
    const geg = S.teams[1 - teamIdx], dir = teamIdx === 0 ? 1 : -1;
    let t1 = 1e9, t2 = 1e9;                        // die zwei tiefsten Gegner
    for (let i = 0; i < geg.length; i++) {
      const tief = dir > 0 ? L - geg[i].x : geg[i].x;
      if (tief < t1) { t2 = t1; t1 = tief; } else if (tief < t2) t2 = tief;
    }
    const tiefBall = dir > 0 ? L - ballX : ballX;
    const tiefLinie = Math.min(t2, tiefBall, L / 2);
    return dir > 0 ? L - tiefLinie : tiefLinie;
  }
  function abseitsLage(S, empf, ballX) {
    const linie = abseitsLinie(S, empf.team, ballX);
    return { ueber: (empf.x - linie) * empf.dir, linie: linie };
  }
  // Der vorletzte Gegenspieler selbst (für die Darstellung der Abseitsszene)
  function vorletzterGegner(S, teamIdx) {
    const geg = S.teams[1 - teamIdx], dir = teamIdx === 0 ? 1 : -1;
    let a = null, b = null, ta = 1e9, tb = 1e9;
    for (let i = 0; i < geg.length; i++) {
      const tief = dir > 0 ? L - geg[i].x : geg[i].x;
      if (tief < ta) { b = a; tb = ta; a = geg[i]; ta = tief; } else if (tief < tb) { b = geg[i]; tb = tief; }
    }
    return b;
  }

  // ── Kondition ───────────────────────────────────────────────────────────────
  // Verbraucht wird nach GELAUFENER STRECKE, nicht nach Spielminute: wer presst
  // und Läufe macht, ist am Ende platt — wer hinten steht, hat noch Körner.
  // Sprints kosten überproportional (der Faktor an der Geschwindigkeit).
  function zehre(p, strecke, v, f) {
    if (strecke <= 0) return;
    p.kond -= strecke * (0.55 + v * 0.10) * p._kondK * (f || 1);
    if (p.kond < 0.30) p.kond = 0.30;             // niemand fällt komplett aus
  }

  // ── Auswechslungen ──────────────────────────────────────────────────────────
  // Der müdeste Feldspieler geht runter, von der Bank kommt der beste passende
  // Ersatz. WICHTIG: der Austausch passiert AM PLATZ im selben Spielerobjekt —
  // der Index bleibt erhalten, sonst zeigt die Aufzeichnung (feste 22 Plätze in
  // jedem Bild) plötzlich auf den falschen Spieler.
  // Beim Wechsel wird das Spielerobjekt überschrieben (fester Platz in der
  // Aufzeichnung). Frühere Ereignisse sollen aber den Spieler behalten, der
  // damals auf dem Platz stand — sonst bekam der Eingewechselte nachträglich die
  // Tore, Vorlagen und Karten seines Vorgängers (Adapter und Ticker lesen
  // ev.player erst nach dem Spiel). Die alten Verweise zeigen deshalb auf eine
  // eingefrorene Kopie.
  function eventsEinfrieren(S, p) {
    const kopie = Object.assign({}, p);
    for (let i = S.ev.length - 1; i >= 0; i--) {
      const e = S.ev[i];
      if (e.player === p) e.player = kopie;
      if (e.assist === p) e.assist = kopie;
      if (e.gegen === p) e.gegen = kopie;
    }
  }

  function wechseln(S, teamIdx) {
    const bank = S.bank[teamIdx];
    if (!bank || !bank.length) return false;
    const arr = S.teams[teamIdx];
    let raus = null, kmin = 9;
    for (let i = 0; i < arr.length; i++) {
      const p = arr[i];
      if (p.role === 'TW') continue;
      if (p.kond < kmin) { kmin = p.kond; raus = p; }
    }
    if (!raus) return false;
    // Ersatz wählen: gleiche Position bevorzugt, sonst der stärkste
    let bi = 0, best = -1e9;
    for (let i = 0; i < bank.length; i++) {
      const w = (bank[i].ovr || 60) + (bank[i].pos === raus.pos ? 14 : 0);
      if (w > best) { best = w; bi = i; }
    }
    const rein = bank.splice(bi, 1)[0];
    eventsEinfrieren(S, raus);
    const alt = raus.name, vorherRef = raus._ref;
    raus.name = rein.name || alt;
    if (rein.num) raus.num = rein.num;
    raus.att = rein.att || 55; raus.mid = rein.mid || 55; raus.def = rein.def || 55;
    raus.pace = rein.pace || 55;
    raus.tec = (rein.technik != null ? rein.technik : rein.mid) || 55;
    raus.ovr = rein.ovr || 60; raus._ref = rein;
    raus.w = werteVon(rein);                       // Feinwerte des Eingewechselten
    raus._gelb = false; raus._fouls = 0;           // Karten gehören dem Ausgewechselten
    // Frisch von der Bank: volle Körner
    raus.kond = clamp(fitnessVon(rein, 97) / 100, 0.7, 1);
    raus._kondK = CFG.kondVerbrauch * (1.16 - (raus.w.ausdauer - 60) * 0.004);
    raus._k = CFG.traegheit ? 1 - Math.exp(-TICK / (CFG.traegheit - (raus.w.schnelligkeit - 60) * 0.0013)) : 1;
    S.ev.push({ t: S.clock, type: 'wechsel', side: teamIdx ? 'away' : 'home',
                player: raus, ein: raus.name, aus: alt, x: raus.x, y: raus.y,
                // refAus hält den Spieler fest, der den Platz verlässt — sonst
                // ließen sich seine Aktionen aus der Aufzeichnung nicht mehr
                // zuordnen, weil das Objekt danach überschrieben ist.
                refAus: vorherRef, slot: raus._i });
    return true;
  }

  // Planungstakt alle 2 Ticks (0,56 s), pro Takt plant die HÄLFTE der Spieler
  // (2 Phasen). Jeder Einzelne orientiert sich damit alle 1,12 s neu — exakt so
  // oft wie vorher, aber nie mehr die ganze Elf im selben Moment.
  // ACHTUNG: mehr Phasen strecken den Abstand und kosten sofort Chancen
  // (mit 3 Phasen = 1,7 s fielen die Schüsse von 10 auf 3,4).
  const PLAN_EVERY = 4, PHASEN = 2;
  // Geschwindigkeiten als Zahlen: p._v statt String-Lookup in CFG.speed —
  // das sind 400.000 Wörterbuchzugriffe pro Spiel weniger.
  const SPD = CFG.speed;

  // Staffelung im Abwehrblock: Meter vor der eigenen Kette
  const LINIE = { IV: 0, AV: 2, ZM: 11, FL: 15, ST: 26 };

  // Tortseitig vom Ball bleiben: die Kette mindestens 6 m, das Mittelfeld 2 m
  // zwischen Ball und eigenem Tor. Gibt das angepasste Längsziel zurück.
  function hinterDenBall(S, p, tx) {
    // Kette 4 m, Mittelfeld auf Ballhöhe. Mit 6 m / 2 m stand die ganze Elf
    // bei einem Ball an der Strafraumkante im Fünfmeterraum und blockte jeden
    // Schuss (Zählbogen: 12 von 14 Abschlüssen geblockt).
    const abstand = (p.role === 'IV' || p.role === 'AV') ? 4 : 0;
    const grenze = clamp(S.ball.x - p.dir * abstand, 3, L - 3);
    // Erst ab 3 m falscher Seite eingreifen — eine Abwehr, die jeden Meter sofort
    // korrigiert, ist unüberwindbar (gemessen: 0,3 xG je Team)
    return (tx - grenze) * p.dir > 3 ? grenze : tx;
  }

  // ── GEGEN DEN BALL: Anlaufen, Sichern, Passweg zustellen ─────────────────────
  // Wie oft gelingt das schräge Anlaufen? Stellungsspiel und Spielintelligenz
  // entscheiden. Ein 55er erwischt den Winkel gut jedes zweite Mal, ein 80er
  // fast immer — das Ziel aus dem Anwendungsfall („8 von 10") ist also etwas,
  // das eine Mannschaft erreichen kann, nicht etwas, das sie geschenkt bekommt.
  function schraegQuote(p) {
    const k = p.w.defStellung * 0.5 + p.w.spielintelligenz * 0.5;
    return clamp(0.5 + (k - 55) * 0.014, 0.25, 0.92);
  }
  // Anlaufpunkt: tortseitig vor dem Ballführer, um ~40° zur Mitte gedreht.
  // Steht der Ballführer mittig, bleibt der Anläufer auf seiner Seite und lenkt
  // ihn zur anderen.
  function anlaufPunkt(p, c, abstand) {
    const torX = p.dir > 0 ? 0 : L, torY = B / 2;
    let gx = torX - c.x, gy = torY - c.y;
    const gl = Math.sqrt(gx * gx + gy * gy) || 1; gx /= gl; gy /= gl;
    let seite = Math.abs(c.y - B / 2) > 5 ? (c.y < B / 2 ? 1 : -1) : (p.y >= c.y ? 1 : -1);
    // Normale zur Torrichtung, die zur gewünschten Seite (y) zeigt
    let nx = -gy, ny = gx;
    if (Math.sign(ny || 1) !== seite) { nx = -nx; ny = -ny; }
    const W = 0.70, cw = Math.cos(W), sw = Math.sin(W);
    return { x: clamp(c.x + (gx * cw + nx * sw) * abstand, 1, L - 1),
             y: clamp(c.y + (gy * cw + ny * sw) * abstand, 1, B - 1) };
  }
  // Sicherungspunkt: auf der Linie Ball → eigenes Tor, einige Meter hinter dem
  // Anläufer, leicht zur Mitte versetzt.
  function sicherungsPunkt(p, c, abstand) {
    const torX = p.dir > 0 ? 0 : L;
    let gx = torX - c.x, gy = B / 2 - c.y;
    const gl = Math.sqrt(gx * gx + gy * gy) || 1; gx /= gl; gy /= gl;
    const zurMitte = c.y < B / 2 ? 1.5 : -1.5;
    return { x: clamp(c.x + gx * abstand, 1, L - 1), y: clamp(c.y + gy * abstand + zurMitte, 1, B - 1) };
  }
  // „Mitte zu!": den gefährlichsten Mitspieler des Ballführers suchen (vorn,
  // zentral, erreichbar) und sich in den Passweg stellen — näher am Empfänger
  // als am Ballführer, damit der Pass nicht einfach vorbeigeht.
  function passwegZu(S, p, c) {
    const mates = S.teams[c.team];
    let best = null, bs = -1e9;
    for (let i = 0; i < mates.length; i++) {
      const m = mates[i];
      if (m === c || m.role === 'TW') continue;
      const d = dist(c, m);
      if (d < 6 || d > 32) continue;
      const vor = (m.x - c.x) * c.dir;
      const mittig = 1 - Math.min(1, Math.abs(m.y - B / 2) / 30);
      const s = vor * 0.6 + mittig * 8 - d * 0.2;
      if (s > bs) { bs = s; best = m; }
    }
    if (!best || bs < 2) return null;
    return { x: c.x + (best.x - c.x) * 0.62, y: c.y + (best.y - c.y) * 0.62 };
  }

  // ── Taktische Zielposition je Spieler ──────────────────────────────────────
  function target(S, p) {
    const inPoss = (S.possession === p.team);
    const R = ROLE[p.role] || ROLE.ZM;
    const PR = CFG.prinzipien;
    let schieb = false, begleitet = false;       // gesetzt im Abschnitt „ohne Ball"
    let weiterLauf = false;                      // gesetzt im Abschnitt „mit Ball"

    // ELFMETER: alle außer Schütze und Torwart stehen an der Strafraumgrenze
    const el = S.elfmeter;
    if (el && S.clock < el.bis) {
      if (p === el.schuetze) {
        // Mit ruhendem Ball (neue Regeln): Anlauf aus gut drei Metern kurz vor dem Pfiff
        const zur = S.ball.ruht ? (S.deadUntil - S.clock > 0.9 ? 3.2 : 0.5) : 1.2;
        p._tx = S.ball.x - p.dir * zur; p._ty = B / 2 + (zur > 1 && S.ball.ruht ? 0.8 : 0);
        p._v = S.ball.ruht && zur < 1 ? SPD.run : SPD.walk; return;
      }
      if (p.role === 'TW') {
        const eig = p.dir > 0 ? 0 : L;
        p._tx = eig + p.dir * 0.8; p._ty = B / 2; p._v = SPD.walk; return;
      }
      const torX = el.schuetze.dir > 0 ? L : 0, zur = torX === 0 ? 1 : -1;
      const idx = p._num6 != null ? p._num6 : (p._num6 = p.num % 6);
      p._tx = torX + zur * (19 + idx * 1.6);
      p._ty = clamp(B / 2 + (idx - 2.5) * 5.5, 8, B - 8);
      p._v = SPD.jog; return;
    }

    // RUHENDER BALL: der Schütze geht zum Ball — er wird nicht mehr hingebeamt
    const ru = S.ball.ruht;
    if (ru && p === ru.taker) {
      // Bei Standards in Tornähe erst ein paar Schritte zurück, dann Anlauf
      const standard = (S.freistoss && S.freistoss.art !== 'kurz') || S.elfmeter;
      const zurueck = standard && S.deadUntil - S.clock > 0.9 ? 3.2 : 0.5;
      p._tx = clamp(S.ball.x - p.dir * zurueck, 0.5, L - 0.5);
      p._ty = clamp(S.ball.y + (zurueck > 1 ? (S.ball.y < B / 2 ? -1.2 : 1.2) : 0), 0.5, B - 0.5);
      p._v = SPD.run; return;
    }
    // FREISTOSS: die verteidigende Elf stellt eine Mauer zwischen Ball und Tor
    const fs = S.freistoss;
    if (fs && CFG.regeln.freistossEcht) {
      if (freistossZiel(S, p, fs)) return;
    } else if (fs && S.clock < fs.bis && p.team !== fs.team && p.role !== 'TW') {
      const idx = p._num6 != null ? p._num6 : (p._num6 = p.num % 6);
      if (idx < 4) {                                   // vier Mann in die Mauer
        const eig = p.dir > 0 ? 0 : L;                 // eigenes Tor
        const dx = eig - fs.x, dy = B / 2 - fs.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        // 9,15 m vom Ball entfernt auf der Linie Ball → eigenes Tor
        p._tx = clamp(fs.x + dx / len * 9.15, 1.5, L - 1.5);
        p._ty = clamp(fs.y + dy / len * 9.15 + (idx - 1.5) * 1.0, 2, B - 2);
        p._v = SPD.run; return;
      }
    }

    // Ecke: alles rückt in den Strafraum, nur der Schütze bleibt an der Fahne
    const sp = S.setPiece;
    if (sp) {
      if (p === sp.taker) { p._tx = sp.x; p._ty = sp.y; p._v = SPD.jog; return; }
      const angreifer = p.team === sp.team;
      const torX = sp.x < L / 2 ? 0 : L;                   // Ecke liegt an diesem Tor
      const zurTorlinie = torX === 0 ? 1 : -1;
      if (p.role === 'TW') {
        // NUR der Torwart, dessen Tor die Ecke gilt, geht auf die Linie. Ohne
        // diese Prüfung lief auch der Keeper der angreifenden Elf mit in den
        // gegnerischen Strafraum — gemessen bis x = 100,5 m.
        if (angreifer) {
          const eigenes = p.dir > 0 ? 0 : L;
          p._tx = eigenes + p.dir * 6; p._ty = B / 2; p._v = SPD.jog; return;
        }
        p._tx = torX + zurTorlinie * 4.5; p._ty = B / 2; p._v = SPD.jog; return;
      }
      // Echte Ecken-Staffelung statt Diagonale: kurzer Pfosten, Elfmeterpunkt,
      // langer Pfosten, Rückraum — Verteidiger jeweils einen Schritt davor.
      const idx = p._num6 != null ? p._num6 : (p._num6 = p.num % 6);
      const ECK_X = [5.5, 9, 11, 13, 16, 22];                // Meter vor der Torlinie
      const ECK_Y = [-5, 1, 6, -9, 11, 0];                   // Versatz zur Mitte
      p._tx = torX + zurTorlinie * (ECK_X[idx] + (angreifer ? 0 : -1.6));
      p._ty = clamp(B / 2 + ECK_Y[idx] * (angreifer ? 1 : 0.8), 14, B - 14);
      p._v = SPD.run;
      return;
    }
    // ANNAHME: Wer einen hohen Ball oder einen Pass in den Lauf erwartet (oder
    // ihn in der Landezone bestreiten will), läuft zur Landestelle.
    const ann = p._annahme;
    if (ann) {
      if (S.clock < ann.bis && S.ball.flight) {
        p._tx = clamp(ann.x, 1.5, L - 1.5); p._ty = clamp(ann.y, 2, B - 2); p._v = SPD.run;
        return;
      }
      p._annahme = null;
    }
    // Läuft gerade ein Tiefenlauf („jetzt!"), führt step() ihn jeden Tick —
    // der Planungstakt darf ihn nicht mit der Grundordnung überschreiben.
    if (inPoss && p._lauf && S.clock < p._lauf.bis && S.ball.owner !== p) return;

    // SPIELSTAND UND UHR. Bisher spielte eine Elf beim 0:2 in der 85. genauso
    // wie beim 2:0 in der 20. — kein Aufrücken, kein Verwalten. Jetzt verschiebt
    // sich die Grundordnung: Wer hinten liegt, schiebt die Kette nach vorn, wer
    // führt, fällt zurück. Beides erst ab der Schlussphase und gedeckelt, damit
    // die Formation nicht zerfällt.
    let tx = p.hx + spielstandsSchub(S, p.team) * p.dir + (S.ball.x - L / 2) * R.fx;
    let ty = p.hy + (S.ball.y - B / 2) * R.fy;
    if (inPoss) { const br = anw(S, p.team).breite; if (br !== 1) ty = B / 2 + (ty - B / 2) * br; }   // Anweisung Breite

    if (p.role === 'TW') {
      // SCHUSSREAKTION: fliegt ein Ball auf mein Tor, gehe ich auf den Einschlag zu.
      // Bei einer Parade reicht es, bei einem Tor komme ich zu spät — die Ecke
      // liegt zu weit weg. Erst dadurch sieht ein Abschluss aus wie Fußball.
      const fl = S.ball.flight;
      if (fl && fl.schuss && fl.schuss.team !== p.team) {
        const eigenes = p.dir > 0 ? 0 : L;
        p._tx = eigenes + p.dir * 1.2;
        p._ty = clamp(fl.y1, B / 2 - 8, B / 2 + 8);
        p._v = SPD.sprint;
        return;
      }
      p._tx = p.dir > 0 ? clamp(2 + (S.ball.x - L / 2) * 0.06, 1.5, 14) : clamp(L - 2 + (S.ball.x - L / 2) * 0.06, L - 14, L - 1.5);
      p._ty = clamp(B / 2 + (S.ball.y - B / 2) * 0.28, 24, B - 24);
      p._v = SPD.jog;
      return;
    }

    if (inPoss) {
      // MIT BALL: Breite herstellen, Läufe in den Rücken der Kette
      // Breite herstellen: Flügel an die Linie, Außenverteidiger schieben nach.
      // Ohne das steht die Elf im Ballbesitz wie ein Block (gemessen: 49 m breit
      // statt der realen 55–62 m) und es entsteht nie eine Verlagerung.
      // POSITIONSROTATION: der Außenverteidiger überläuft außen, der Flügel rückt
      // dafür in den Halbraum ein. Ohne so etwas steht jeder immer auf derselben
      // Spur und das Angriffsspiel wirkt statisch.
      // „bleib draußen!": Außenbahnspieler halten Breite, bis der Ball kommt. Die
      // Engine kennt nur die Rolle FL — ein Linksaußen im 4-4-2 (LM) oder ein
      // offensiver Flügel im 4-2-3-1 lief deshalb als zentraler Mittelfeldspieler
      // und stand nie an der Linie.
      const aussenMF = PR.breite && p.role === 'ZM' && (p.pos === 'AM' || p.pos === 'ZOM') && Math.abs(p.hy - B / 2) > 18;
      // Im letzten Drittel ziehen offensive Außen in den Halbraum („bis der Ball
      // kommt" — dann geht es Richtung Tor), statt weiter an der Linie zu kleben.
      const imLetztenDrittel = (p.dir > 0 ? S.ball.x : L - S.ball.x) > 70;
      if (aussenMF && imLetztenDrittel && !p._rot) ty = p.hy < B / 2 ? 19 : B - 19;
      // Flügelstürmer: auf der Ballseite bleibt er breit, der ballferne zieht im
      // letzten Drittel Richtung zweiter Pfosten — sonst stand im 4-3-3 nur der
      // Mittelstürmer im Strafraum (8 Schüsse je Team gegen 10 im 4-4-2).
      const flBallfern = PR.breite && p.role === 'FL' && imLetztenDrittel && !p._rot &&
                         ((p.hy < B / 2) !== (S.ball.y < B / 2));
      // SCHIENE (D66): der Außenverteidiger einer Dreierkette ist mit Ball ein Außenspieler – breit und höher, im
      // letzten Drittel ballnah an der Linie (Flanke, Hinterlaufen), ballfern zum zweiten Pfosten. Vorher spielte er wie
      // ein Außenverteidiger (nie im Strafraum, im Aufbau auf Kettenhöhe gezogen): 3-5-2 und 5-3-2 waren dieselbe Elf.
      const schiene = CFG.schiene.an && p._schiene;
      const schieneFern = schiene && PR.breite && imLetztenDrittel && !p._rot && ((p.hy < B / 2) !== (S.ball.y < B / 2));
      if (flBallfern || schieneFern) ty = p.hy < B / 2 ? B / 2 - 7 : B / 2 + 7;
      // INVERTIERT (D66): in einem Teil der Angriffe rückt auch der ballnahe Flügelstürmer im letzten Drittel in den
      // Halbraum ein (der Außenverteidiger schiebt dort ohnehin bis 12 m hinter den Ball auf und gibt die Breite). Vorher
      // klebte er an der Linie, und aus diesem Winkel schoss er kaum (Flügel 1,4 Schüsse je Spiel, Mittelstürmer 6,6).
      if (p.role === 'FL' && p._invFuer !== S.possSince) { p._invFuer = S.possSince; p._inv = CFG.fluegelInnen.an && S.rnd() < CFG.fluegelInnen.invertiert; }
      const flInnen = PR.breite && p.role === 'FL' && imLetztenDrittel && !p._rot && !flBallfern && p._inv;
      if (flInnen) ty = p.hy < B / 2 ? 18 : B - 18;
      // Der zentrale Zehner rückt im letzten Drittel als zweite Spitze an die Linie
      const zweiteSpitze = PR.zwischenLinien && p.pos === 'ZOM' && Math.abs(p.hy - B / 2) <= 18 && imLetztenDrittel;
      const breitRolle = (p.role === 'FL' && !flBallfern && !flInnen) || (aussenMF && !imLetztenDrittel) || (schiene && !schieneFern);
      if (p._rot && p.role === 'AV') {
        // Echtes Überlaufen: am Ball vorbei, nicht nur „etwas weiter vorn".
        // Mit einem festen +9 m blieb er immer hinter seinem Flügel und die
        // Rotation war in den Positionsdaten gar nicht zu erkennen.
        ty = p.hy < B / 2 ? 5 : B - 5;
        const vorbei = S.ball.x + p.dir * 8;
        tx = p.dir > 0 ? Math.max(tx, vorbei) : Math.min(tx, vorbei);
      } else if (p._rot && breitRolle) {
        ty = p.hy < B / 2 ? 21 : B - 21;             // in den Halbraum einrücken
      } else if (breitRolle) ty = p.hy < B / 2 ? 5.5 : B - 5.5;
      else if (p.role === 'AV' && !schiene) ty = p.hy < B / 2 ? 12 : B - 12;
      // „Zwischen den Linien anbieten": Zehner und offensive Außen stehen im
      // Aufbau nicht auf Mittelfeldhöhe, sondern im Raum vor der gegnerischen
      // Kette — dort sind sie anspielbar, ohne dass ein Verteidiger direkt am
      // Mann steht. Ohne das kam ein 4-2-3-1 mit korrekten Abseitspositionen nur
      // halb so oft ins letzte Drittel wie ein 4-4-2.
      if (PR.zwischenLinien && (p.pos === 'ZOM' || p.pos === 'AM') && !p._rest && !zweiteSpitze) {
        const linieZ = lastLine(S, p.team);
        const zwischen = linieZ - p.dir * (7 + p._staffel * 1.5);
        if ((S.ball.x - zwischen) * p.dir < -3) tx = p.dir > 0 ? Math.max(tx, zwischen) : Math.min(tx, zwischen);
      }
      if (p.role === 'ST' && p._kurz > S.clock) {
        // Gegenbewegung (D66): zwischen die Linien, leicht zur Ballseite – Platz für den Läufer aus der Tiefe
        tx = lastLine(S, p.team) - p.dir * (p._kurzTief || 9);
        ty = B / 2 + (S.ball.y - B / 2) * 0.35;
      } else if (p.role === 'ST' || p.role === 'FL' || zweiteSpitze) {
        // An der Abseitslinie lauern, NICHT dahinter — sonst steht der Stürmer
        // dauernd im Abseits und das Spiel wird zur Schießbude.
        const line = lastLine(S, p.team);
        if ((S.ball.x - p.x) * p.dir > -8) {
          // Offensives Stellungsspiel: wer es beherrscht, lauert enger an der
          // Abseitslinie, ohne sie zu überschreiten.
          const puffer = clamp(1.8 - (p.w.offStellung - 70) * 0.016, 0.4, 2.6);
          let want = line - p.dir * (0.3 + S.rnd() * puffer);
          // D66: Flügelstürmer warten vor dem letzten Drittel nicht an der Abseitslinie, sondern ein paar Meter davor (auf Höhe
          // des Außenverteidigers) und starten von dort diagonal in den Rücken – wie die zweite Reihe. An der Linie waren sie
          // im 4-3-3 nur Flankengeber, der Mittelstürmer traf 55–70 % der Tore.
          if (p.role === 'FL' && CFG.fluegelInnen.an && !imLetztenDrittel) want = line - p.dir * (CFG.fluegelInnen.vorLinie + S.rnd() * 3);
          // Anschluss halten: nie mehr als 16 m vor dem Ball wegstarten
          const grenze = S.ball.x + p.dir * 16;
          tx = p.dir > 0 ? Math.min(want, grenze) : Math.max(want, grenze);
        } else tx += p.dir * 5;
        if (zweiteSpitze) ty = B / 2 + (p.hy < B / 2 ? -5 : 5) * 0.4 + (S.ball.y - B / 2) * 0.2;
      } else if (p.role === 'ZM') tx += p.dir * 3;
      else if (schiene) tx += p.dir * CFG.schiene.vor;                  // Schiene: auf Höhe der Außenspieler
      else tx += p.dir * 1.5;                                           // Abwehr schiebt auf
      // Außenverteidiger schieben im letzten Drittel mit auf (höchstens 12 m
      // hinter dem Ball) und geben die Breite, wenn die Flügel nach innen
      // ziehen. Vorher standen sie dabei 50 m vor dem gegnerischen Tor.
      // Die ballnahe Schiene geht bis kurz hinter den Ball mit (Flanke, Hinterlaufen); die ballferne läuft ein (oben).
      if (PR.breite && p.role === 'AV' && !p._rot && imLetztenDrittel && !schieneFern) {
        const hoch = S.ball.x - p.dir * (schiene ? 5 : 12);
        tx = p.dir > 0 ? Math.max(tx, hoch) : Math.min(tx, hoch);
        ty = p.hy < B / 2 ? (schiene ? 6 : 7) : B - (schiene ? 6 : 7);
      }

      // ── ZÜNDEN: die vier Einlaufpositionen ─────────────────────────────────
      // Sobald der Ball in Strafraumnähe ist, wird der Strafraum besetzt statt
      // ihn zu umspielen: kurzer Pfosten, Elfmeterpunkt, zweiter Pfosten,
      // Rückraum. Vorher standen im letzten Drittel nur 1,6 Mann vor dem Ball —
      // das ist die „Flanke in die Unterzahl" aus dem Spielmodell.
      const tiefBall = p.dir > 0 ? S.ball.x : L - S.ball.x;
      if (tiefBall > 76 && !p._rest && (p.role !== 'AV' || schieneFern) && !(p._kurz > S.clock)) {
        const torX = p.dir > 0 ? L : 0;
        const nah = S.ball.y < B / 2 ? 1 : -1;          // Seite des nahen Pfostens
        // D66: der Rückraum-Punkt lag bei 18 m – knapp außerhalb der Zone, in die der Rückpass von der Grundlinie
        // überhaupt gespielt wird (6–17 m, decide); jetzt CFG.flanke.rueckraum
        const EIN = [[5.5, 6.5], [11, 0], [6.5, -8], [CFG.flanke.rueckraum, 3]];
        const e = EIN[p._staffel];
        tx = torX - p.dir * e[0];
        ty = B / 2 + e[1] * nah;
      }

      // ── BALLLINIE (Spielmodell) ────────────────────────────────────────────
      // Der wichtigste Bezugspunkt: nicht die Position entscheidet, sondern ob
      // ich vor oder hinter dem Ball bin. Ersetzt die starre Rollenstaffelung.
      const vorBall = (tx - S.ball.x) * p.dir > 0;
      if (p._rest) {
        // RESTVERTEIDIGUNG: die beiden Innenverteidiger und der tiefste Sechser
        // bleiben hinter dem Ball — organisiert WÄHREND wir angreifen, nicht
        // danach. Verhindert „acht Mann im Strafraum, Konter ins offene Feld".
        const grenze = S.ball.x - p.dir * (7 + p._staffel * 2.2);
        tx = p.dir > 0 ? Math.min(tx, grenze) : Math.max(tx, grenze);
        if (PR.absichern) {
          // „absichern!": die Restverteidigung steht nicht irgendwo hinter dem
          // Ball, sondern bei den Konterspielern des Gegners — tortseitig und
          // auf Reichweite. Vorher kam in 30 % der Ballverluste der erste Pass
          // des Gegners nach vorn an (Zählbogen).
          const gg = S.teams[1 - p.team];
          let ziel = null, zd = 24;
          for (let i = 0; i < gg.length; i++) {
            const o = gg[i];
            if (o.role === 'TW') continue;
            if (o._bewacht && o._bewacht.von !== p && S.clock - o._bewacht.t < 1.3) continue;
            const d = Math.hypot(o.x - tx, o.y - ty);
            if (d < zd) { zd = d; ziel = o; }
          }
          if (ziel) {
            ziel._bewacht = { von: p, t: S.clock };
            const sx = ziel.x - p.dir * 3.5;
            tx = p.dir > 0 ? Math.min(tx, sx) : Math.max(tx, sx);
            ty += (ziel.y - ty) * 0.5;
          }
        }
      } else if (!vorBall) {
        // HINTER DER BALLLINIE: anbieten als Klatsch-Empfänger — und zwar
        // GESTAFFELT, nicht auf einer Linie. Nur so ist der Rückpass diagonal
        // spielbar. Genau diese Staffelung fehlte und ließ alles starr wirken.
        tx -= p.dir * (p._staffel * 1.8);
        ty += (p.hy < B / 2 ? -1 : 1) * p._staffel * 1.6;
      }
      // „weiter!": wer gerade abgespielt hat, geht in den nächsten Raum, statt
      // stehen zu bleiben und zuzuschauen (vorher 71 % der Passgeber, Zählbogen).
      if (p._weiter) {
        if (S.clock < p._weiter.bis && S.ball.owner !== p && !p._rest) {
          tx = p._weiter.x; ty = p._weiter.y; weiterLauf = true;
        } else if (S.clock >= p._weiter.bis) p._weiter = null;
      }
      // ABSEITS: Niemand wartet hinter der Abseitslinie (letzter Feldspieler des
      // Gegners oder der Ball — was näher am Tor ist). Bisher galt das nur, wenn
      // der Ball nah war; sonst ging der Stürmer auf Grundposition + 5 m. Mit den
      // Formationen des Spiels (Sturm bei 86 % der Feldlänge) stand er damit
      // tief im Strafraum hinter der Abwehr, und jeder freie oder abgeprallte
      // Ball landete bei ihm — gemessen 5 Tore je Spiel, sobald ein 4-3-3 mitspielte.
      // STAND 2026-09-15: vorerst AUS (CFG.abseitsDeckel). Gemessen entsteht der
      // Großteil der Torchancen der Engine genau aus diesen Positionen — mit
      // Deckel fielen 0,5 statt 2,8 Tore je Spiel. Erst wenn die Angriffslogik
      // (Strafraumläufe statt Warten) ausgebaut ist, wird er eingeschaltet.
      if (CFG.abseitsDeckel && p.role !== 'IV') {
        const linie = lastLine(S, p.team);
        const offLinie = p.dir > 0 ? Math.max(linie, S.ball.x) : Math.min(linie, S.ball.x);
        // Ist der Ball weit weg (Aufbau), darf ein Angreifer ein paar Meter über
        // der Linie stehen — er kommt zurück, bevor ein Pass nach vorn möglich
        // ist. Nah am Ball steht er auf der Linie. (Ganz ohne Spielraum halbierten
        // sich die Torschüsse: der Angriff hat sonst nicht genug Tiefe.)
        const ballWeit = (offLinie - S.ball.x) * p.dir > 25;
        const spiel = ballWeit ? CFG.abseitsSpielraum : CFG.abseitsSpielraumNah;
        if ((tx - offLinie) * p.dir > spiel) tx = offLinie + p.dir * spiel;
      }
    } else {
      // OHNE BALL: kompakter Block, der mit dem Ball verschiebt. Die Kette steht
      // etwa 14 m tortseitig vom Ball, davor gestaffelt Mittelfeld und Sturm —
      // rund 26 m zwischen erster und letzter Linie.
      // WICHTIG: der Block orientiert sich am VERZÖGERTEN Ballort (S.slow), nicht
      // am echten. Eine Abwehr verschiebt nicht in Nullzeit — schnelle
      // Verlagerungen reißen dadurch echte Lücken auf. Ohne diese Trägheit ist
      // der Block unüberwindbar (gemessen: 1,7 Schüsse pro Spiel).
      // Im Gegenpressing bleibt die Elf HOCH und orientiert sich am echten Ball
      // statt am verzögerten — sonst presst sie vorn an, während die Kette schon
      // zurückfällt, und genau daraus entstehen die Löcher.
      const sard = S.gp && S.gp.team === p.team && S.clock < S.gp.bis;
      // „nachrücken!": nach einem Rückpass des Gegners orientiert sich die Elf
      // am ECHTEN Ball und schiebt geschlossen heraus, statt auf das verzögerte
      // Ballbild zu warten.
      const sch = S.schieben[p.team];
      // Rausschieben nur, wenn vorn jemand Druck auf den Empfänger machen kann —
      // sonst schiebt die Elf auseinander und öffnet den Raum zwischen den Linien.
      schieb = PR.nachruecken && !!sch && S.clock < sch.bis && sch.druck;
      const sb = (sard || schieb) ? S.ball : S.slow[p.team];
      let abstand = sard ? 8 : 14;
      // BALL OFFEN / BALL ZU: Hat der Ballführende Zeit (kein Gegner nah), kann
      // er in die Tiefe spielen — die Kette fällt ein paar Meter. Steht er unter
      // Druck, kann er es nicht — die Kette schiebt heran und verkürzt.
      if (PR.tiefeBegleiten && !sard && S.ball.owner && S.ball.owner.team !== p.team) {
        const dr = S._druckBall || 0;
        // Am eigenen Strafraum wird nicht mehr zurückgewichen — dort fehlt der
        // Raum dafür, jeder Meter zurück ist ein Meter Schussposition mehr.
        const tiefB = p.dir > 0 ? S.ball.x : L - S.ball.x;
        abstand += (dr < 0.35 && tiefB > 35) ? 4 : (dr > 1.0 ? -3 : 0);
      }
      if (schieb) abstand -= 2;
      let kette = sb.x - p.dir * abstand;
      if (schieb) {
        // Geschlossen nachrücken heißt: die Abstände halten, nicht mit einem Satz
        // 12 m höher stehen. Höchstens 6 m vor die bisherige Linie — sonst lag
        // hinter der Kette plötzlich das halbe Feld frei (Zählbogen: +7 Schüsse
        // je Team allein durch dieses Prinzip).
        const bisher = S.slow[p.team].x - p.dir * (abstand + 2);
        kette = p.dir > 0 ? Math.min(kette, bisher + 6) : Math.max(kette, bisher - 6);
      }
      // Anweisung Linie / Pressing-Höhe (S.anw): die ganze Ordnung ohne Ball höher oder tiefer
      // Nur im Mittelfeld voll: steht der Ball 30 m oder näher vor dem eigenen Tor, verteidigt jede Ordnung den Strafraum
      // (vorher rückte „tief“ die Kette bis in den eigenen Strafraum – der Gegner kam doppelt so oft zum Schuss)
      const anwL = anw(S, p.team).linie;
      if (anwL) { const vorTor = p.dir > 0 ? S.ball.x : L - S.ball.x; kette += p.dir * anwL * clamp((vorTor - 30) / 25, 0, 1); }
      const kMax = 64 + Math.max(0, anwL);
      kette = p.dir > 0 ? clamp(kette, 12, kMax) : clamp(kette, L - kMax, L - 12);
      tx = kette + p.dir * (LINIE[p.role] != null ? LINIE[p.role] : 11);
      // HINTER DEN BALL: Die Grundordnung hängt am verzögerten Ballbild — bei
      // einem schnellen Angriff stand die Kette dadurch VOR dem Ball, gemessen
      // 13 m, während drei Angreifer allein auf den Torwart zuliefen. Wer
      // verteidigt (außer dem Stürmer), steht tortseitig vom echten Ball.
      if (PR.sofortUmschalten && p.role !== 'ST') tx = hinterDenBall(S, p, tx);
      // Zentrum verdichten, ballfernen Flügel bewusst freilassen
      ty = ty * 0.58 + (B / 2) * 0.42;
      // „Ballnah kompakt": der Block verschiebt deutlich zur Ballseite (vorher
      // 0,40 des Ballversatzes, gemessen) — im Gegenpressing rückt zusätzlich
      // zusammen, wer in Ballnähe ist, damit dort Überzahl entsteht (vorher
      // 3,6 eigene gegen 3,9 Gegner im 15-m-Umkreis).
      ty += (sb.y - B / 2) * (PR.ballnahKompakt ? CFG.verschiebenSeite : 0.18);
      // Die ganze Elf rückt zusammen — die Kette mit (CFG.verdichtenKette).
      // Rückte nur Mittelfeld und Sturm heran, riss zwischen den Linien ein Loch
      // (gemessen: +2,4 Schüsse je Team gegenüber gemeinsamem Verdichten).
      if (PR.ballnahKompakt && sard) {
        const dxb = S.ball.x - tx, dyb = S.ball.y - ty, db = Math.sqrt(dxb * dxb + dyb * dyb);
        const kf = (p.role === 'IV' || p.role === 'AV') ? CFG.verdichtenKette : 1;
        if (db < 30) { const zu = 0.24 * kf * (1 - db / 30); tx += dxb * zu; ty += dyb * zu; }
      }

      // BINDEN / Gegner zuordnen: der nächste Angreifer in meiner Zone zieht mich
      // torseitig an sich. Vorher kannten die Verteidiger überhaupt keine
      // Gegenspieler — nur Zonen. Dadurch hatte Breite keinen Zweck: der Flügel
      // stand außen und niemand ging mit.
      if (CFG.binden > 0) {
        const gg = S.teams[1 - p.team];
        let ziel = null, gd = 1e9;
        for (let i = 0; i < gg.length; i++) {
          const o = gg[i]; if (o.role === 'TW') continue;
          const ox = o.x - tx, oy = o.y - ty;
          const q2 = ox * ox + oy * oy;
          if (q2 < gd) { gd = q2; ziel = o; }
        }
        gd = Math.sqrt(gd);
        if (ziel && gd < 15) {
          const zug = CFG.binden * (1 - gd / 15);
          tx += (ziel.x - p.dir * 2 - tx) * zug;       // torseitig bleiben
          ty += (ziel.y - ty) * zug;
        }
      }
      // TIEFENLÄUFE BEGLEITEN: startet ein Angreifer in meiner Nähe hinter die
      // Kette, gehe ich mit — tortseitig, statt auf meiner Linie stehen zu bleiben.
      if (PR.tiefeBegleiten && (p.role === 'IV' || p.role === 'AV' || p.role === 'ZM')) {   // ZM: Läufer aus der Tiefe (D66)
        const o = p._begleitet;
        // reagiert erst nach seiner Reaktionszeit — die Bewegung selbst wird in
        // step() jeden Tick nachgeführt, hier nur für den Planungstakt
        if (o && o._lauf && o._lauf.begleiter === p && S.clock < o._lauf.bis && S.clock >= o._lauf.reaktion) {
          tx = o.x - p.dir * 1.3; ty = o.y + (o.y < B / 2 ? 0.8 : -0.8);
          begleitet = true;
        }
      }
    }
    // Direkt in den Spieler schreiben statt ein Objekt je Spieler und Tick zu
    // erzeugen (das waren 424.000 Allokationen pro Spiel).
    // Persönliche Positionsneigung: der eine steht etwas höher, der andere
    // enger. Ohne das stehen alle Spieler einer Rolle auf demselben Formelwert
    // und beide Mannschaften sind exakte Spiegelbilder.
    p._tx = clamp(tx + p._bx, 1.5, L - 1.5);
    p._ty = clamp(ty + p._by, 2, B - 2);
    // Im Ballbesitz zwischen Trab und Lauf: sonst erreichen Flügel und
    // Außenverteidiger ihre Breite nie, weil der Ball schneller ist als sie.
    // Im ZÜNDEN geht die Sturmreihe ins Sprinttempo — „so schnell wie möglich,
    // sobald die Tiefe offen ist; davor bewusst ruhig".
    if (inPoss) {
      const hoch = (p.dir > 0 ? S.ball.x : L - S.ball.x) > CFG.zuendenAb;
      const zuend = hoch && (S.clock - (S.possSince || 0)) < CFG.zuendenSek;
      const vorn = p.role === 'ST' || p.role === 'FL';
      p._v = weiterLauf ? SPD.run
           : zuend && vorn ? SPD.run
           : (p.role === 'FL' || p.role === 'AV' ? SPD.run : SPD.jog);
    } else {
      // OHNE BALL nur traben. Vorher stand hier SPD.run — damit rannte die
      // komplette verteidigende Elf permanent, auch wenn sie nur die Ordnung
      // hielt. Das war der Hauptgrund für 15,6 km Laufleistung je Spieler.
      // Wer wirklich anlaufen muss, bekommt sein Tempo ohnehin vom Pressing.
      // Ausnahmen: Wer einen Tiefenlauf begleitet, sprintet; beim Rausschieben
      // nach einem Rückpass läuft die Elf, damit die Kette als Einheit vorrückt.
      // „sofort!" — UMSCHALTEN: Wer schon überspielt ist (der Ball ist zwischen
      // ihm und dem eigenen Tor) oder weit weg von seinem Platz steht, trabt
      // nicht zurück, sondern läuft. Vorher trabte die ganze Abwehr bei einem
      // Konter mit 4,4 m/s hinter einem dribbelnden Angreifer her (6,2 m/s).
      const ueberspielt = (p.x - S.ball.x) * p.dir > 2;
      const weitWeg = Math.hypot(tx - p.x, ty - p.y) > 12;
      const umschalten = PR.sofortUmschalten && (ueberspielt || weitWeg);
      p._v = begleitet ? SPD.sprint
           : umschalten ? (p.role === 'ST' ? SPD.run : (ueberspielt ? SPD.sprint : SPD.run))
           : (schieb && p.role !== 'ST' ? SPD.run : SPD.jog);
    }
  }

  // Kette begradigen: Innen-/Außenverteidiger auf gemeinsame Höhe
  function alignLine(S, teamIdx) {
    const back = S.backs[teamIdx];               // einmal vorberechnet
    if (back.length < 2) return;
    // Ein überlaufender Außenverteidiger gehört NICHT mehr in die Kette — sonst
    // zieht alignLine ihn sofort wieder auf Kettenhöhe zurück und die Rotation
    // ist in den Positionsdaten überhaupt nicht zu sehen.
    // Ebenso ein Verteidiger, der gerade einen Tiefenlauf begleitet — er soll
    // mit dem Läufer gehen, nicht zurück auf die Linie gezogen werden.
    const fsA = S.freistoss;
    const begleitet = function (p) {
      // Wer beim Freistoß eine feste Aufgabe hat (Mauer, Deckung, Strafraum),
      // wird nicht auf Kettenhöhe gezogen.
      if (fsA && fsA.auftrag && fsA.auftrag[p._i] && (S.ball.ruht || S.clock < (fsA.laufBis || 0))) return true;
      const m = p._begleitet;
      return !!(m && m._lauf && m._lauf.begleiter === p && S.clock < m._lauf.bis && S.clock >= m._lauf.reaktion);
    };
    // Schienen (D66) gehören nur ohne Ball in die Kette – mit Ball zog alignLine sie auf die Höhe der Innenverteidiger
    const frei = S.possession === teamIdx && CFG.schiene.an;
    let sum = 0, n = 0;
    for (let i = 0; i < back.length; i++) {
      if (back[i]._rot || begleitet(back[i]) || back[i]._annahme || (frei && back[i]._schiene)) continue;
      sum += back[i]._tx; n++;
    }
    if (n < 2) return;
    const avg = sum / n;
    for (let i = 0; i < back.length; i++) {
      const p = back[i];
      if (p._rot || begleitet(p) || p._annahme || (frei && p._schiene)) continue;
      // Kein Mischen mit dem alten _tx: alignLine läuft in JEDEM Planungstakt,
      // auch für Spieler, die sich gar nicht neu orientiert haben — ein
      // gleitender Mittelwert schaukelt sich dadurch auf und die Kette wandert.
      // Die Staffelung kommt stattdessen aus der festen Eigenneigung _bx.
      p._tx = avg + (p.role === 'AV' ? p.dir * 1.2 : 0) + p._bx * 0.8;
    }
  }

  // ── „jetzt!" — TIMING DES STARTENS ────────────────────────────────────────────
  // Vorher warteten Stürmer an der Abseitslinie, und der Steilpass ging dorthin,
  // wo sie gerade standen: in 52 % der Steilpässe stand der Empfänger, nur in
  // 4 % lief er schon (Zählbogen). Jetzt startet ein Angreifer so, dass er die
  // Linie genau beim Abspiel erreicht — gute Spieler treffen den Moment, schwache
  // starten zu früh (Abseits) oder zu spät (Verteidiger ist wieder dran).
  // Steht ein Verteidiger eng, gibt es erst die kurze Bewegung zum Ball
  // („erst kurz!"), dann den Lauf in den Rücken.
  // ZWEITE REIHE (D66): Zehner, offensive Außen, Achter (nicht der Sechser der Restverteidigung) und Schienen
  function zweiteReihe(m) {
    return m.pos === 'ZOM' || m.pos === 'AM' || (m.pos === 'ZM' && !m._rest) || (m._schiene && CFG.schiene.an)
        || (m.role === 'FL' && CFG.fluegelInnen.an);              // Flügelstürmer starten von vor der Linie (target)
  }
  function laeufeStarten(S, c) {
    const hoehe = c.dir > 0 ? c.x : L - c.x;
    if (hoehe < 35) return;
    const zeitBisPass = S.nextDecide - S.clock;
    const ZR = CFG.zweiteReihe;
    // Tiefenläufe brauchen Vorlauf: wer 18 m hinter der Linie startet, ist 2,5–3 s unterwegs
    if (zeitBisPass > (ZR.an ? ZR.vorlauf : 1.6) || S.clock < S.deadUntil) return;
    const line = lastLine(S, c.team);
    const mates = S.teams[c.team];
    // „Den Strafraum besetzen": ist der Ball im letzten Drittel, laufen bis zu
    // drei Spieler in den Strafraum — getimt aus erlaubter Position, statt dort
    // (wie bisher) im Abseits auf den Ball zu warten.
    const letztesDrittel = hoehe > 68;
    const maxLaeufer = letztesDrittel ? 3 : 2;
    let laufend = 0, tiefLaufend = 0;
    for (let i = 0; i < mates.length; i++) if (mates[i]._lauf && S.clock < mates[i]._lauf.bis) { laufend++; if (mates[i]._lauf.tief) tiefLaufend++; }
    if (laufend >= maxLaeufer) return;
    if (pressureOn(S, c) > 1.3) return;                             // Ball zu — kein Pass in die Tiefe
    for (let i = 0; i < mates.length && laufend < maxLaeufer; i++) {
      const m = mates[i];
      if (m === c || m._rest || m.role === 'TW' || m.role === 'IV') continue;
      if (m._kurz > S.clock) continue;                              // kommt gerade kurz (Gegenbewegung, D66)
      if (m._lauf && S.clock < m._lauf.bis + 1.5) continue;        // gerade gelaufen, erst wieder sortieren
      const zurLinie = (line - m.x) * c.dir;                        // > 0: noch diesseits (nicht im Abseits)
      // Die zweite Reihe kommt aus der Tiefe – auch von etwas hinter dem Ball (D66). Vorher durfte nur starten, wer
      // höchstens 10 m (letztes Drittel 16 m) vor der Linie und vor dem Ball stand: fast immer nur der Stürmer.
      const ausTiefe = ZR.an && zweiteReihe(m);
      if (zurLinie < -0.3 || zurLinie > (ausTiefe ? (letztesDrittel ? ZR.tiefeDrittel : ZR.tiefe) : (letztesDrittel ? 16 : 10))) continue;
      if ((m.x - c.x) * c.dir < (ausTiefe ? -ZR.hinterBall : (letztesDrittel ? -2 : 5))) continue; // muss (fast) vor dem Ball sein
      if (zeitBisPass > 1.6 && !(ausTiefe && zurLinie > 10)) continue;   // Vorlauf nur für den weiten Weg
      // Timing: Fehler in Sekunden, einmal je Angriff und Spieler gezogen.
      // Außenverteidiger und Mittelfeldspieler stoßen nur gelegentlich mit nach —
      // im letzten Drittel öfter („Strafraum besetzen").
      if (m._timingFuer !== S.possSince) {
        const k = m.w.offStellung * 0.6 + m.w.spielintelligenz * 0.4;
        m._timingFehler = (S.rnd() - 0.5) * clamp(1.3 - (k - 55) * 0.02, 0.25, 1.5);
        // Offensive Mittelfeldspieler (ZOM, AM) laufen ein wie Stürmer — sonst
        // hatte ein 4-2-3-1 nur einen einzigen Einläufer und verlor gegen ein
        // gleich starkes 4-4-2 im Schnitt mit einem Tor Differenz.
        const offensiv = m.role === 'ST' || m.role === 'FL' || m.pos === 'ZOM' || m.pos === 'AM' || (m._schiene && CFG.schiene.an);
        // Die äußeren Achter (z. B. im 4-3-3) stoßen öfter in den Strafraum nach
        // als die zentralen Mittelfeldspieler eines 4-4-2
        const achter = m.role === 'ZM' && Math.abs(m.hy - B / 2) > 10;
        // D66: Achter der zweiten Reihe (z. B. im 4-3-3) wollen in jedem Angriff mit – der Tiefenlauf bleibt über `quote` begrenzt
        m._laufWillig = offensiv || (ausTiefe && achter && ZR.achter) ? true : S.rnd() < (letztesDrittel ? (achter ? 0.75 : 0.45) : 0.25);
        // Tiefenlauf (D66) nur in einem Teil der Angriffe – sonst kamen sie zusätzlich zu allen anderen Läufen (+40 %)
        m._tiefWillig = ausTiefe && S.rnd() < ZR.quote;
        m._timingFuer = S.possSince;
      }
      if (!m._laufWillig) continue;
      // Aus mehr als 6 m hinter der Linie: höchstens `max` Tiefenläufer gleichzeitig, und nur wer in diesem Angriff will
      const tiefLauf = ausTiefe && zurLinie > 6;
      if (tiefLauf && (tiefLaufend >= ZR.max || !m._tiefWillig)) continue;
      const vLauf = SPD.sprint * (0.86 + (m.w.schnelligkeit - 60) * 0.004);
      const ideal = zurLinie / vLauf;
      if (zeitBisPass > ideal + m._timingFehler) continue;          // noch nicht der Moment
      // Verteidiger direkt am Mann? Dann erst kurz entgegen
      const gg = S.teams[1 - c.team];
      let eng = null, ed = 3.2, beg = null, bd = 14, mfBeg = null, mfd = ZR.uebernehmen || 0;
      for (let j = 0; j < gg.length; j++) {
        const o = gg[j];
        if (o.role === 'TW') continue;
        const d = dist(o, m);
        if (d < ed && (o.x - m.x) * c.dir > -0.5) { ed = d; eng = o; }
        if ((o.role === 'IV' || o.role === 'AV') && d < bd) { bd = d; beg = o; }
        if (o.role === 'ZM' && d < mfd) { mfd = d; mfBeg = o; }
      }
      // LÄUFER ÜBERNEHMEN (D66): einen Läufer aus der Tiefe nimmt der nächste Mittelfeldspieler mit, nicht der
      // Verteidiger auf der Linie – ohne Gegenstück waren die neuen Läufe fast immer frei (+0,3 Tore je Team).
      if (tiefLauf && mfBeg) beg = mfBeg;
      const tiefe = 9 + S.rnd() * 7;
      const aussen = Math.abs(m.y - B / 2) > 15;
      let zx = clamp(line + c.dir * tiefe, 4, L - 4);
      // D66: vom Flügel richtig diagonal in den Halbraum (vorher 4–9 m nach innen – der Läufer blieb am Flügel und flankte)
      let zy = aussen ? m.y + (m.y < B / 2 ? 1 : -1) * (CFG.fluegelInnen.an ? CFG.fluegelInnen.diagonal : 4) + (m.y < B / 2 ? 1 : -1) * S.rnd() * 5
                      : m.y + (S.rnd() < 0.5 ? -1 : 1) * (3 + S.rnd() * 4);       // aus der Mitte schräg in die Schnittstelle
      if (letztesDrittel) {
        // In den Strafraum: zwischen Fünfer und Elfmeterpunkt, verteilt auf
        // kurzen Pfosten, Mitte und zweiten Pfosten
        const torX = c.dir > 0 ? L : 0;
        zx = torX - c.dir * (6.5 + S.rnd() * 6);
        zy = B / 2 + ((laufend % 3) - 1) * (4 + S.rnd() * 3) + (S.rnd() - 0.5) * 2;
      }
      // Reaktionszeit des begleitenden Verteidigers: Stellungsspiel und Intelligenz
      const reakt = beg ? clamp(0.8 - (beg.w.defStellung * 0.5 + beg.w.spielintelligenz * 0.5 - 55) * 0.012, 0.35, 1.3) : 0;
      // Wer aus der Tiefe kommt, ist länger unterwegs – der Lauf endet nicht, bevor er die Linie erreicht hat
      const dauer = (letztesDrittel ? 2.6 : 2.9) + (tiefLauf ? (zurLinie - 6) / vLauf : 0);
      m._lauf = { start: S.clock, bis: S.clock + dauer, kurzBis: eng && !tiefLauf ? S.clock + 0.45 : 0,
                  x: zx, y: clamp(zy, 4, B - 4), tief: tiefLauf,
                  begleiter: CFG.prinzipien.tiefeBegleiten ? beg : null, reaktion: S.clock + reakt };
      // Mit echten Abseitsregeln: Kommt der Pass später als gedacht, läuft ein guter
      // Stürmer einen Bogen an der Linie entlang, statt ins Abseits zu laufen.
      // Wer das Stellungsspiel nicht beherrscht, läuft durch.
      if (CFG.regeln.abseitsEcht) m._lauf.bremst = S.rnd() < clamp(0.55 + (m.w.offStellung - 55) * 0.012, 0.4, 0.95);
      if (CFG._zaehler) { const k = 'lauf' + (tiefLauf ? 'Tief_' : '_') + (m._schiene ? 'Schiene' : m.pos); CFG._zaehler[k] = (CFG._zaehler[k] || 0) + 1; }
      if (beg && CFG.prinzipien.tiefeBegleiten) beg._begleitet = m;
      laufend++; if (tiefLauf) tiefLaufend++;
      // GEGENBEWEGUNG (D66): startet einer aus der Tiefe, kommt der Mittelstürmer kurz – er zieht seinen Verteidiger
      // mit, macht dem Läufer Platz und wird Ableger statt Abnehmer. Ohne das blieb er an der Linie das erste Ziel.
      if (tiefLauf && ZR.gegenbewegung > 0) {
        for (let j = 0; j < mates.length; j++) {
          const st = mates[j];
          if (st.role !== 'ST' || st === c || (st._lauf && S.clock < st._lauf.bis) || Math.abs(st.y - B / 2) > 12) continue;
          if (S.rnd() < ZR.gegenbewegung) { st._kurz = S.clock + 2.2; st._kurzTief = 8 + S.rnd() * 4; }
        }
      }
    }
  }
  // Druck an einem Punkt (für den Treffpunkt eines Passes in den Lauf)
  function druckAmPunkt(S, teamIdx, x, y) {
    const opp = S.teams[1 - teamIdx];
    let s = 0;
    for (let i = 0; i < opp.length; i++) {
      const ox = opp[i].x - x, oy = opp[i].y - y, q2 = ox * ox + oy * oy;
      if (q2 < 144) s += 1 - Math.sqrt(q2) / 12;
    }
    return s > 2.2 ? 2.2 : s;
  }

  // Treffpunkt für einen Pass in den Lauf: wo ist der Läufer, wenn der Ball ankommt?
  function treffpunkt(c, m, vBall) {
    // Aus dem LAUFWEG, nicht aus dem momentanen Tempo: beim Abspiel ist der
    // Läufer oft gerade erst losgelaufen — mit seiner Geschwindigkeit gerechnet
    // landete der Ball kurz hinter der Linie, direkt beim Verteidiger.
    const lf = m._lauf;
    let rx = (m._vx || 0), ry = (m._vy || 0), vMax = Math.hypot(rx, ry);
    if (lf) {
      const dx = lf.x - m.x, dy = lf.y - m.y, dl = Math.hypot(dx, dy) || 1;
      vMax = SPD.sprint * (0.86 + (m.w.schnelligkeit - 60) * 0.004) * 0.9;
      rx = dx / dl * vMax; ry = dy / dl * vMax;
    }
    let px = m.x, py = m.y;
    for (let k = 0; k < 3; k++) {
      const T = Math.hypot(px - c.x, py - c.y) / vBall;
      px = m.x + rx * T; py = m.y + ry * T;
      if (lf) {                                    // nicht über das Laufziel hinaus
        const weit = Math.hypot(px - m.x, py - m.y), bisZiel = Math.hypot(lf.x - m.x, lf.y - m.y);
        if (weit > bisZiel) { px = lf.x; py = lf.y; }
      }
    }
    const torX = m.dir > 0 ? L : 0;
    // nicht bis in den Fünfmeterraum — dort kommt der Torwart heraus
    px = m.dir > 0 ? Math.min(px, L - 7) : Math.max(px, 7);
    return { x: clamp(px, 2, L - 2), y: clamp(py, 2, B - 2), torX };
  }

  // „versetzt!": nie zwei auf gleicher Höhe in derselben Bahn — sonst deckt ein
  // Gegner beide. Der Offensivere rückt vor, der andere bleibt zurück.
  const OFFENSIV = { IV: 0, AV: 1, ZM: 2, FL: 3, ST: 4 };
  function versetzen(S, teamIdx) {
    const arr = S.teams[teamIdx];
    for (let i = 0; i < arr.length; i++) {
      const a = arr[i];
      if (a.role === 'TW' || a === S.ball.owner || a._annahme || (a._lauf && S.clock < a._lauf.bis)) continue;
      for (let j = i + 1; j < arr.length; j++) {
        const b = arr[j];
        if (b.role === 'TW' || b === S.ball.owner || b._annahme || (b._lauf && S.clock < b._lauf.bis)) continue;
        const dx = Math.abs(a._tx - b._tx), dy = Math.abs(a._ty - b._ty);
        if (dx >= 3 || dy >= 14) continue;
        const vorn = (OFFENSIV[a.role] || 2) >= (OFFENSIV[b.role] || 2) ? a : b;
        const hinten = vorn === a ? b : a;
        const schub = (3 - dx) / 2 + 1;
        vorn._tx = clamp(vorn._tx + vorn.dir * schub, 1.5, L - 1.5);
        hinten._tx = clamp(hinten._tx - hinten.dir * schub, 1.5, L - 1.5);
      }
    }
  }

  // ── Entscheidung des Ballführenden ─────────────────────────────────────────
  function decide(S, c) {
    const rnd = S.rnd, mates = S.teams[c.team];
    const opts = [];
    const line = lastLine(S, c.team);

    // ── Ballbesitzuhr: welches Teamziel gilt gerade? ────────────────────────
    //  ZÜNDEN (0–4 s)   direkt abschließen, solange der Gegner unsortiert ist
    //  BRECHEN (ab 5 s) die Ordnung öffnen statt sie zu überrennen
    //  AUFTANKEN        bewusste Entscheidung, wenn beides nicht trägt:
    //                   Ballbesitz sichern und den Angriff neu aufbauen
    // WICHTIG: Zünden gilt NICHT allein nach der Uhr. Bei ~450 Ballwechseln pro
    // Spiel ist fast jeder Ballbesitz jünger als 4,5 s — dann wäre dauernd
    // Zünden und das Spiel explodiert (gemessen: 20,7 Schüsse). Es braucht
    // zusätzlich die Höhe: tief in der eigenen Hälfte wird aufgebaut, nicht gezündet.
    const seit = S.clock - (S.possSince || 0);
    const hoehe = c.dir > 0 ? S.ball.x : L - S.ball.x;
    const zuenden = seit < CFG.zuendenSek && hoehe > CFG.zuendenAb;
    const auftanken = seit > CFG.auftankenSek;
    const brechen = !zuenden && !auftanken;
    // Gehetzt (Gegner auf unter 2 m, Zeit am Ball): keine Zeit, das Feld zu
    // lesen — der Blick geht zum sicheren Ball, und die Wahl streut stärker.
    const gehetzt = CFG.prinzipien.zeitAmBall && c._gehetzt > S.clock;
    const AWc = anw(S, c.team);
    const vorGew = (gehetzt ? 0.30 : (zuenden ? 0.61 : (auftanken ? 0.34 : 0.52))) + AWc.risiko;
    const streu = gehetzt ? 9.5 : 6;
    // Für Ereignisstrom und Taktikansicht: 2 = Zünden, 1 = Brechen, 0 = Auftanken
    S.modus = zuenden ? 2 : (auftanken ? 0 : 1);

    // Nur die aussichtsreichsten Anspielstationen prüfen (Rechenzeit im heißen Pfad)
    const cand = [];
    for (let i = 0; i < mates.length; i++) {
      const m = mates[i]; if (m === c) continue;
      const d = dist(c, m);
      if (d < 3.5 || d > 46) continue;
      cand.push({ m, d, vor: (m.x - c.x) * c.dir });
    }
    // Vier vielversprechende nach vorn PLUS die zwei nächsten als Ausweg — ohne
    // den Rückpass schießt jeder aus 25 m, weil er keine Alternative kennt.
    cand.sort((a, b) => (b.vor - b.d * 0.35) - (a.vor - a.d * 0.35));
    const pick = cand.slice(0, 4);
    cand.slice(4).sort((a, b) => a.d - b.d).slice(0, 2).forEach(o => pick.push(o));
    const PR = CFG.prinzipien;
    // Wer gerade in die Tiefe läuft, wird immer mitgeprüft — das ist der Ball,
    // für den der Lauf gemacht wird.
    if (PR.timingStart) {
      for (let i = 4; i < cand.length; i++) {
        const o = cand[i];
        if (o.m._lauf && S.clock < o.m._lauf.bis && pick.indexOf(o) < 0) pick.push(o);
      }
    }
    const klatschAuftrag = PR.geschlossen && c._klatsch > S.clock;
    const tmpZiel = { x: 0, y: 0 };
    // Die Abseitslinie, wie sie JETZT steht (nicht die im Ordnungstakt gemerkte)
    const echteLinie = CFG.regeln.abseitsEcht ? abseitsLinie(S, c.team, S.ball.x) : line;
    pick.forEach(o => {
      const m = o.m;
      // ABSEITS: ein Zuspiel hinter die letzte Linie ist ungültig. Mit den echten
      // Regeln sieht der Passgeber die Linie nicht perfekt — wer gerade über die
      // Linie zieht, ist schwer einzuschätzen. Gepfiffen wird nach der echten Lage.
      let blick = 0.4, sichtLinie = line;
      if (CFG.regeln.abseitsEcht) {
        const laeuftGerade = m._lauf && S.clock < m._lauf.bis;
        // Schätzfehler: meist knapp, manchmal übersehen (positiv) oder übervorsichtig (negativ)
        blick = CFG.abseitsBlick[laeuftGerade ? 1 : 0] * (rnd() - 0.25) * clamp(1.3 - (c.w.spielintelligenz - 55) * 0.012, 0.5, 1.5);
        sichtLinie = echteLinie;
      }
      const abseits = ((m.x - sichtLinie) * c.dir) > blick && ((m.x - c.x) * c.dir) > 0;
      if (abseits) return;
      // PASS IN DEN LAUF: Ziel ist der Treffpunkt, nicht die Position beim Abspiel
      const laeuft = PR.timingStart && m._lauf && S.clock < m._lauf.bis && S.clock >= (m._lauf.kurzBis || 0);
      let ziel = null;
      if (laeuft) ziel = treffpunkt(c, m, CFG.ballSpeed.through);
      const zx = ziel ? ziel.x : m.x, zy = ziel ? ziel.y : m.y;
      tmpZiel.x = zx; tmpZiel.y = zy;
      const dZ = ziel ? Math.hypot(zx - c.x, zy - c.y) : o.d;
      const vorZ = ziel ? (zx - c.x) * c.dir : o.vor;
      let block = laneBlocked(S, c, tmpZiel);
      // ÜBER DIE KETTE: ist der flache Weg zu, geht der Ball über die Köpfe —
      // gestört nur noch in der Landezone, dafür schwerer genau zu spielen.
      // Nur wenn der flache Weg wirklich zu ist und der Ball Raum gewinnt — ein
      // Chip ist langsamer und schwerer, die Abwehr stellt sich in der Zeit.
      // (Ohne diese Bremse gingen 44 % aller Pässe hoch, real sind es rund 12 %.)
      let bahn = null;
      if (PR.ballhoehe && block > 0.55 && dZ > 16 && (vorZ > 10 || laeuft) &&
          rnd() < clamp(0.30 + (c.w.passen - 60) * 0.01, 0.1, 0.6)) {
        const luft = landezoneBlockiert(S, c, tmpZiel) + 0.30;
        if (luft < block - 0.1) { block = luft; bahn = 'hoch'; }
      }
      const druck = ziel ? druckAmPunkt(S, c.team, zx, zy) : pressureOn(S, m);
      // Steckpass: Empfänger genau AN der Linie, Weg frei → hoher Wert.
      // In den Lauf: der Ball landet hinter der Kette.
      const hinter = ((zx - line) * c.dir) > 0.5;
      const steck = laeuft ? (hinter && block < 0.45) : (Math.abs(m.x - line) < 3.5 && block < 0.35);
      // Raumgewinn zählt, aber die Entfernung muss gegenhalten — sonst spielt
      // jeder nur noch den weiten Ball nach vorn (Passquote fiel auf 59 %).
      // Das Gewicht hängt jetzt an der Ballbesitzuhr (Zünden / Brechen / Auftanken).
      let sc = 9 + vorZ * vorGew - dZ * 0.26 - block * 17 * pressLuecke(S, c.team) - druck * 6.5;
      if (AWc.lang && vorZ > 0) sc += AWc.lang * Math.max(0, dZ - 22) * 0.15;   // Anweisung lange Bälle
      // Hohe Linie des Gegners (S.anw): der Raum hinter der Kette lockt – Steilpässe dorthin werden öfter gesucht
      if (steck && laeuft && S.anw) { const gl = anw(S, 1 - c.team).linie; if (gl > 0) sc += gl * CFG.hoheLinieLockt * (1 + Math.max(0, tempoVorteil(S, c))); }
      // KÖNIGSPASS (1. Blick): der Ball, der sofort die Entscheidung bringt —
      // hinter die letzte Kette. Wird immer zuerst gesucht, im Zünden noch stärker.
      // In den Lauf etwas weniger Zuschlag als in den Fuß: der Ball ist schwerer,
      // dafür ist er gefährlicher, wenn er ankommt (Treffpunkt hinter der Kette).
      // D66: der Königspass geht in den Lauf, nicht in den Fuß des Stürmers, der an der Linie wartet – vorher 7/11 in
      // den Fuß gegen 4/7 in den Lauf, gut die Hälfte aller Tore kam so über den Mittelstürmer. Läufer aus der Tiefe
      // (zweite Reihe) sind schwer aufzunehmen und bekommen noch etwas dazu.
      const SP = CFG.steilpass;
      if (steck) sc += laeuft ? (zuenden ? SP.lauf[1] : SP.lauf[0]) + (m._lauf && m._lauf.tief ? SP.tief : 0)
                              : (zuenden ? SP.fuss[1] : SP.fuss[0]);
      // SCHLÜSSELPASS (2. Blick): der Ball, der den entscheidenden erst ermöglicht.
      // Näherung: der Empfänger hat selbst Raum vor sich und kann dann steil spielen.
      else if (brechen && spaceAhead(S, m) > 12) sc += 3.6;
      if (bahn === 'hoch') sc -= 5;
      // „der ist zu!": kein Ball in den Spieler, dem ein Gegner im Rücken steht —
      // außer er kann direkt klatschen lassen („klatsch!").
      let klatsch = false;
      // Gilt für den TIEFEN Ball: angespielt nach vorn, mit dem Rücken zum Tor.
      if (PR.geschlossen && !laeuft && m.role !== 'TW' && vorZ > 4) {
        const gg = S.teams[1 - c.team];
        // „im Nacken": eng dran UND deutlich tortseitig — ein Verteidiger auf
        // gleicher Höhe (typisch an der Abseitslinie) macht den Ball nicht zu
        const eng = CFG.abseitsDeckel ? 1.9 : 2.4, hinten = CFG.abseitsDeckel ? 0.8 : 0.3;
        let nahG = null, nd = eng;
        for (let j = 0; j < gg.length; j++) {
          const q2 = dist(gg[j], m);
          if (q2 < nd && (gg[j].x - m.x) * c.dir > hinten) { nd = q2; nahG = gg[j]; }
        }
        if (nahG) {
          for (let j = 0; j < mates.length && !klatsch; j++) {
            const k = mates[j];
            if (k === m || k === c || k.role === 'TW') continue;
            if (dist(k, m) < 14 && (k.x - m.x) * c.dir < 3 && pressureOn(S, k) < 0.9) klatsch = true;
          }
          sc -= klatsch ? 2 : 7;
        }
      }
      // Klatsch-Auftrag: selbst zugestellt angespielt → kurz ablegen, nicht aufdrehen
      if (klatschAuftrag && vorZ <= 3 && dZ < 18) sc += 7;
      // RÜCKRAUM: von der Grundlinie zurück Richtung Elfmeterpunkt. Die
      // Verteidiger laufen zum eigenen Tor und kommen an diesen Ball schlecht heran.
      let rueckraum = false;
      if (PR.rueckraum && hoehe > CFG.rueckpass.ab && Math.abs(c.y - B / 2) > 8 && vorZ < 2 && m.role !== 'TW') {
        const zumTor = c.dir > 0 ? L - m.x : m.x;
        if (zumTor >= 6 && zumTor <= 17 && Math.abs(m.y - B / 2) < 11) { sc += CFG.rueckpass.zuschlag; rueckraum = true; }
      }
      if (m.role === 'TW') sc -= 14;
      sc += (rnd() - 0.5) * streu;
      // Steckpass (Engine-Art „through“) heißt seit D66 nur noch der Ball in den Lauf hinter die Kette; der Ball in den Fuß
      // eines Spielers, der an der Linie steht, ist ein Anspiel in die Spitze (gleiche Mechanik, `anLinie`)
      opts.push({ t: 'pass', to: m, sc, through: steck && !!laeuft, anLinie: steck && !laeuft, long: dZ > 32, bahn: bahn,
                  ziel: ziel ? { x: zx, y: zy } : null, klatsch: klatsch, rueckraum: rueckraum });
    });

    const raum = spaceAhead(S, c), druckC = pressureOn(S, c);
    // Dribbling: entweder in freien Raum ODER als Zweikampf gegen einen konkreten
    // Gegenspieler. Letzteres fehlte komplett — ein Dribbling hat bisher niemanden
    // überwunden, es war nur eine Bewegung.
    const geg = naechsterGegnerVorn(S, c);
    const zumUeberwinden = geg && geg.d < 4.2;
    // „klatsch!" statt aufdrehen; gehetzt ist auch das Dribbling keine Ruhe-Lösung
    const nichtAufdrehen = (klatschAuftrag ? 8 : 0) + (gehetzt ? 4 : 0);
    // NACH INNEN ZIEHEN (D66): offensive Außen und Schienen gehen im letzten Drittel von der Linie aus diagonal
    // Richtung Strafraum – dort wird aus einem Flügelspieler ein Torschütze. Vorher ging jedes Dribbling geradeaus
    // oder zufällig zur Seite, und Außen schossen kaum (1,4 Schüsse je Spiel gegen 6,6 des Mittelstürmers).
    const FI = CFG.fluegelInnen;
    const aussenSpieler = c.role === 'FL' || c.pos === 'AM' || (c._schiene && CFG.schiene.an);
    if (raum > 9) {
      opts.push({ t: 'dribble', sc: -9 + Math.min(raum, 14) * 0.38 - druckC * 9 + (c.tec - 60) * 0.12 + (rnd() - 0.5) * 5 - nichtAufdrehen });
    }
    if (FI.an && aussenSpieler && hoehe > 66 && Math.abs(c.y - B / 2) > 9 && druckC < 1.4 && rnd() < FI.quote * (1 - 0.5 * AWc.fluegel)) {
      // Bewertet nach dem, was der Weg bringt: xG 3 m weiter vorn und 6 m weiter innen gegen jetzt
      const zurMitte = c.y < B / 2 ? 1 : -1;
      const gewinn = xgPunkt(S, c, c.x + c.dir * 3, c.y + zurMitte * 6) - xgPunkt(S, c, c.x, c.y);
      opts.push({ t: 'dribble', innen: true, sc: FI.zuschlag + gewinn * FI.gewinn + (c.w.dribbling - 60) * 0.15 - druckC * 5
                                                 + (rnd() - 0.5) * 5 - nichtAufdrehen });
    }
    if (zumUeberwinden) {
      // Je besser die Technik gegenüber dem Verteidiger, desto lohnender
      const kante = ((c.w.offEinsGegenEins + c.w.dribbling) / 2 - (geg.p.w.defEinsGegenEins + geg.p.w.tackling) / 2) * 0.28;
      opts.push({ t: 'takeon', geg: geg.p,
                  sc: -11 + kante + (hoehe > 60 ? 3 : 0) - druckC * 4 + (rnd() - 0.5) * 6 - nichtAufdrehen });
    }

    // Flanke: außen und tief → Ball in den Strafraum auf den besten Kopfballspieler.
    const tiefC = c.dir > 0 ? c.x : L - c.x;
    const aussen = c.y < 17 || c.y > B - 17;
    if (aussen && tiefC > 82 - 6 * Math.max(0, AWc.fluegel)) {
      let ziel = null, bz = -1e9;
      // D66: nicht immer der beste Kopfballspieler – gezielt wird nach Kopfball, Lage und Einlauf (wer gerade in den
      // Strafraum läuft, greift den Ball an), mit Streuung. Vorher landete fast jede Flanke beim Mittelstürmer.
      const FZ = CFG.flanke, kandF = FZ.streu > 0 ? [] : null;
      for (let i = 0; i < mates.length; i++) {
        const m = mates[i]; if (m === c || m.role === 'TW') continue;
        const mt = c.dir > 0 ? m.x : L - m.x;
        if (mt < 78) continue;                              // muss im Strafraumbereich sein
        let w = m.w.kopfball - Math.abs(m.y - B / 2) * 0.8;
        if (FZ.einlauf && m._lauf && S.clock < m._lauf.bis) w += FZ.einlauf;
        if (kandF) kandF.push(m, w);
        if (w > bz) { bz = w; ziel = m; }
      }
      if (kandF && kandF.length > 2) {
        let summe = 0;
        for (let i = 1; i < kandF.length; i += 2) { kandF[i] = Math.exp((kandF[i] - bz) / FZ.streu); summe += kandF[i]; }
        let r = rnd() * summe;
        for (let i = 0; i < kandF.length; i += 2) { r -= kandF[i + 1]; if (r <= 0) { ziel = kandF[i]; break; } }
      }
      if (ziel) {
        // „Den Strafraum besetzen": die Flanke geht nicht dahin, wo der Stürmer
        // beim Abspiel steht (an der Abseitslinie), sondern auf seinen
        // Einlaufpunkt zwischen Fünfer und Elfmeterpunkt — er startet mit der Flanke.
        let einlauf = null;
        if (PR.timingStart) {
          const torX = c.dir > 0 ? L : 0;
          const nahPfosten = c.y < B / 2 ? -1 : 1;
          const tiefe = 6 + rnd() * 5.5;
          einlauf = { x: torX - c.dir * tiefe, y: B / 2 + (rnd() < 0.5 ? nahPfosten * (1 + rnd() * 4) : -nahPfosten * (rnd() * 5)) };
          // Nur, wenn der Stürmer es in der Flugzeit schaffen kann
          if (Math.hypot(einlauf.x - ziel.x, einlauf.y - ziel.y) > 16) einlauf = null;
        }
        opts.push({ t: 'cross', to: ziel, ziel: einlauf, sc: (tiefC - 82) * 0.40 + AWc.fluegel * 2.5 - druckC * 4 + (rnd() - 0.5) * 6 });
      }
    }

    // Abschluss: erst ab brauchbarer Lage überhaupt eine Option. Ohne diese
    // Schwelle wird aus jeder Halbchance ein Schuss (gemessen: 148 Schüsse/Spiel).
    const xg = xgAt(S, c);
    if (xg > CFG.schwelle * (zuenden ? 0.97 : 1) / AWc.schuss) {
      // Der Abschluss muss den Pass schlagen können: eine 15-%-Chance ist mehr
      // wert als jedes Anspiel. Vorher passte der Stürmer aus 8 m quer.
      // Wer spät hinten liegt, zieht eher ab, statt noch einmal quer zu spielen.
      const eile = spielstandsSchub(S, c.team) > 0 ? 3.5 : 0;
      opts.push({ t: 'shoot', sc: -3 + eile + (AWc.schuss - 1) * 12 + xg * 330 - druckC * 2 + (rnd() - 0.5) * 5, xg });

    } else if (PR.distanzschuss) {
      // DISTANZSCHUSS: aus 16–26 m, einigermaßen zentral und mit freier
      // Schussbahn. Real kommen gut ein Drittel aller Abschlüsse von außerhalb
      // des Strafraums — in der Engine gab es sie überhaupt nicht, deshalb
      // schossen fast nur die Stürmer (Mittelfeld: 0,4 Schüsse je Spiel).
      const gx = c.dir > 0 ? L : 0;
      const dTor = Math.hypot(gx - c.x, B / 2 - c.y);
      // Nicht bei jeder Gelegenheit: ohne diese Bremse kamen 13 Distanzschüsse
      // je Team dazu (real 4–5) — sobald kein Pass frei war, wurde geschossen.
      // Real wird auch durch Beine hindurch geschossen — die Bahn muss nicht
      // völlig frei sein (geblockt wird danach wie bei jedem Schuss). Und es
      // zählt, ob der NÄCHSTE Gegner schon am Mann ist, nicht wie viele im
      // 12-m-Umkreis stehen — vor dem Strafraum sind das fast immer mehrere.
      const naechsterGeg = geg ? geg.d : 99;
      const Zd = CFG._zaehler;                        // Prüfhilfe (Zählbogen), sonst null
      // (Gemessen: vor dem Strafraum steht in vier von fünf Fällen ein Gegner
      // näher als 2,2 m — geschossen wird trotzdem, geblockt wird danach.)
      if (Zd && dTor >= 16 && dTor <= 26) { Zd.zone = (Zd.zone || 0) + 1; if (Math.abs(c.y - B / 2) < 15) Zd.zentral = (Zd.zentral || 0) + 1; if (naechsterGeg > 1.4) Zd.frei = (Zd.frei || 0) + 1; }
      if (dTor >= 16 && dTor <= 26 && Math.abs(c.y - B / 2) < 15 && naechsterGeg > 1.4 &&
          rnd() < CFG.distanzNeigung * AWc.schuss * (0.6 + (c.w.schiessen - 50) * 0.02)) {
        S._tor.x = gx; S._tor.y = B / 2;
        const bahnZu = laneBlocked(S, c, S._tor, true);
        if (Zd) { Zd.gate = (Zd.gate || 0) + 1; if (bahnZu < 0.6) Zd.bahnFrei = (Zd.bahnFrei || 0) + 1; }
        if (bahnZu < 0.6) {
          const eile = spielstandsSchub(S, c.team) > 0 ? 3 : 0;
          opts.push({ t: 'shoot', xg: xg, sc: CFG.distanzBasis + eile + (c.w.schiessen - 60) * 0.22 - (dTor - 16) * 0.35
                                                  - bahnZu * 10 - druckC * 3 + (rnd() - 0.5) * 6 });
        }
      }
    }

    // Mit den Spielprinzipien steht der Gegner öfter eng am eigenen Strafraum —
    // mit der alten Zone (26 m) kamen 45–60 Befreiungsschläge je Team zusammen
    // (real 20–25), zwei Drittel davon zwischen 18 und 26 m. Jeder davon ist mit
    // Ballhöhe ein Kopfballduell. Geklärt wird jetzt nur im Strafraum.
    const tief = (c.dir > 0 ? c.x : L - c.x) < (CFG.prinzipien.ballhoehe ? 18 : 26);
    const klaerAb = CFG.prinzipien.ballhoehe ? 1.2 : 1.1;
    if (tief && druckC > klaerAb) opts.push({ t: 'clear', sc: 1 + druckC * 7 + (rnd() - 0.5) * 4 });

    // NOTLÖSUNG: Es kann vorkommen, dass gar nichts zur Verfügung steht — alle
    // Anspielstationen im Abseits oder zugestellt, kein Raum, Abschluss unter der
    // Schwelle. Ohne diesen Ausweg liefert decide() undefined und die Simulation
    // stürzt ab (trat erst nach dem Anheben der Schuss-Schwelle zutage).
    if (!opts.length) {
      const xgN = xgAt(S, c);
      return (c.dir > 0 ? c.x : L - c.x) > 82 ? { t: 'shoot', xg: xgN } : { t: 'clear' };
    }
    opts.sort((a, b) => b.sc - a.sc);
    if (CFG._zaehler && opts[0].t === 'shoot' && opts[0].xg <= CFG.schwelle) CFG._zaehler.distanzGewaehlt = (CFG._zaehler.distanzGewaehlt || 0) + 1;
    return opts[0];
  }

  function shoot(S, c, xg) {
    const st = S.stats[c.team];
    st.shots++;
    const gx = c.dir > 0 ? L : 0;
    const rnd = S.rnd;
    // Standard-Abschluss? Direkter Freistoß (Mauer schon geprüft) oder Elfmeter
    const fk = S._freistossSchuss || null; S._freistossSchuss = null;
    const elfQuote = S._elfmeterSchuss, elf = !!elfQuote; S._elfmeterSchuss = false;
    const schussArt = fk ? 'freistoss' : (elf ? 'elfmeter' : undefined);
    // D118: Abschluss aus einer Standardphase des eigenen Teams (Ecke, Freistoß) oder direkter Freistoß
    const ausStandard = !elf && (!!fk || !!(S._std && S._std.team === c.team && S.clock <= S._std.bis));
    // VORLAGE (Prüfung Spielbericht 2026-10-10: 92 % aller Tore hatten eine, auch Elfmeter, direkte Freistöße und Tore
    // nach Ballverlust): nur der letzte Pass eines Mitspielers im selben Ballbesitz, nie bei Standards. Der Abschluss
    // verbraucht sie – ein Abpraller nach Parade oder Block ist keine Vorlage mehr.
    const vorlage = (!fk && !elf && S.lastPasser && S.lastPasser.team === c.team && S.lastPasser !== c) ? S.lastPasser : null;
    S.lastPasser = null;
    // Kopfball? Gleich hier lesen und zurücksetzen – nach einem geblockten Kopfball hing der Merker sonst am nächsten Schuss.
    const kopf = !!S._kopfSchuss; S._kopfSchuss = false;

    // Schussblock: steht ein Verteidiger im Weg? Real wird rund ein Viertel aller
    // Schüsse geblockt — daraus entstehen die meisten Ecken.
    S._tor.x = gx; S._tor.y = B / 2;
    const block = laneBlocked(S, c, S._tor, true);
    // Blocken kann nur, wer nah an der Schusslinie steht. Mit dem alten Wert
    // (ab 4 m Abstand) wurden 43 % der Schüsse geblockt, real gut ein Viertel —
    // die alten Werte gelten weiter, solange Stürmer im Abseits warten dürfen.
    const blockAb = CFG.abseitsDeckel ? 0.35 : 0.15, blockK = CFG.abseitsDeckel ? 1.6 : 1.15;
    // D66: ein Kopfball fliegt über die Beine – im vollen Strafraum blieben sonst 70 % aller Kopfbälle hängen
    const blockF = kopf ? CFG.flanke.kopfBlock : 1;
    if (!fk && !elf && block > blockAb && rnd() < (block - (CFG.abseitsDeckel ? blockAb : 0)) * blockK * blockF) {
      S.ev.push({ t: S.clock, type: 'blocked', side: c.team ? 'away' : 'home', player: c, x: c.x, y: c.y, xg });
      // 0,80 war zu hoch: fast jeder Block ging direkt ins Toraus. Real prallt
      // gut ein Drittel im Strafraum ab und wird zum zweiten Ball.
      if (rnd() < 0.66) { outOfPlay(S, gx, rnd() < 0.5 ? -1 : B + 1, 1 - c.team); return; }
      S.ball.x = c.x + c.dir * (1 + rnd() * 4);
      S.ball.y = clamp(c.y + (rnd() - 0.5) * 10, 2, B - 2);
      S.ball.flight = null;
      giveBall(S, nearestToBall(S));
      S.nextDecide = S.clock + 0.25;
      return;
    }
    // Torfaktor (DFL, Gleichbehandlung mit der KI-Formel): skaliert NUR den Ausgang des Abschlusses, nicht die
    // Entscheidung zu schießen – in xgAt hob er auch die Schusslust (gemessen ≈ 25 % mehr Tore als gewollt).
    // Elfmeter bleiben unverändert.
    if (S.tor && !elf) xg = clamp(xg * S.tor[c.team], 0.003, 0.9);
    // D118: Standardtrainer (eigener Angriff × gegnerische Abwehr) – nur Abschlüsse aus Standards
    if (S.standard && ausStandard) xg = clamp(xg * S.standard[c.team], 0.003, 0.9);
    // Abschlussquote (D66): die zweite Reihe, Schienen und Kopfbälle schaffen mehr Chancen – damit die rohe Engine so
    // viele Tore schießt wie vorher, wird der Ausgang aller Abschlüsse außer Elfmetern gleichmäßig skaliert (wie die Brücke)
    if (!elf && CFG.abschluss !== 1) xg = clamp(xg * CFG.abschluss, 0.003, 0.9);
    // xG erst hier buchen: ein geblockter Schuss kann nie fallen, sonst laufen
    // Tore und xG dauerhaft auseinander.
    st.xg += xg;

    // Ausgang wird hier entschieden (das hält die Kalibrierung), aber NICHT sofort
    // ausgeführt: der Ball fliegt jetzt wirklich zum Tor, und der Torwart bewegt
    // sich dorthin. Vorher verschwand der Ball und tauchte beim Keeper wieder auf.
    const gk = S.teams[1 - c.team].find(p => p.role === 'TW');
    const gkY = gk ? gk.y : B / 2;

    // TORWARTGÜTE. Vorher kam der Keeper in dieser Entscheidung überhaupt nicht
    // vor — gemessen kassierte ein 90er exakt so viel wie ein 45er. Aus der Nähe
    // zählt das 1-gegen-1, aus der Distanz Paraden und Reflexe.
    const entf = Math.hypot(gx - c.x, B / 2 - c.y);
    let guete = 70;
    if (gk) {
      guete = entf < 11
        ? gk.w.einsGegenEins * 0.55 + gk.w.reflexe * 0.30 + gk.w.paraden * 0.15
        : gk.w.paraden * 0.55 + gk.w.reflexe * 0.30 + gk.w.einsGegenEins * 0.15;
      guete *= 0.80 + 0.20 * gk.kond;                 // müder Keeper hält schlechter
    }
    // Bei Ligadurchschnitt (70) bleibt der Faktor 1 — die Kalibrierung wackelt
    // also nur, wenn die Torhüter wirklich über- oder unterdurchschnittlich sind.
    const twFaktor = clamp(1 - (guete - 70) * 0.011, 0.62, 1.42);
    const pTor = elf && typeof elfQuote === 'number' ? elfQuote : clamp(xg * twFaktor, 0.003, 0.93);
    const ausgang = rnd() < pTor ? 'goal' : (rnd() < 0.42 + (guete - 70) * 0.004 ? 'save' : 'miss');
    let zy;
    if (ausgang === 'goal') {
      // In die Ecke, die vom Torwart weg liegt — dann kommt er zu spät
      const weg = gkY > B / 2 ? -1 : 1;
      zy = B / 2 + weg * (2.4 + rnd() * 1.1);
    } else if (ausgang === 'save') {
      zy = clamp(gkY + (rnd() - 0.5) * 2.4, B / 2 - 3.5, B / 2 + 3.5);
    } else {
      zy = B / 2 + (rnd() < 0.5 ? -1 : 1) * (4.4 + rnd() * 2.6);   // knapp bis klar daneben
    }
    const dz = Math.hypot(gx - c.x, zy - c.y);
    S.ball.owner = null;
    S.ball.flight = {
      x0: c.x, y0: c.y, x1: gx, y1: clamp(zy, 0.6, B - 0.6), t: 0,
      // MINDESTFLUGZEIT 0,8 s: ein Abschluss aus 4 m bräuchte physikalisch nur
      // 0,2 s — das ist kürzer als ein Simulationsschritt (0,28 s), der Ball wäre
      // nie zu sehen. Bewusste Darstellungsentscheidung zugunsten der Ansicht;
      // der Torwart bekommt damit auch eine faire Reaktionszeit.
      dur: Math.max(0.8, dz / CFG.ballSpeed.shot), to: null, kind: 'shot',
      team: c.team, schuss: { team: c.team, xg: xg, ausgang: ausgang, schuetze: c, art: schussArt, vorlage: vorlage, standard: ausStandard }
    };
    // HÖHE DES ABSCHLUSSES. Der Ausgang steht fest (Kalibrierung), die Höhe
    // passt dazu: ein Tor schlägt unter der Latte ein, ein Fehlschuss geht gut
    // zur Hälfte drüber statt immer nur seitlich vorbei. Die Schwerkraft ist für
    // den Abschluss reduziert — wegen der Mindestflugzeit von 0,8 s sähe ein
    // Schuss mit voller Schwerkraft sonst aus wie ein Heber.
    const fS = S.ball.flight;
    if (CFG.prinzipien.ballhoehe) {
      let zTor;
      if (ausgang === 'goal') zTor = rnd() < 0.55 ? 0.15 + rnd() * 0.7 : 1.2 + rnd() * 1.05;
      else if (ausgang === 'save') zTor = 0.2 + rnd() * 1.7;
      else if (rnd() < 0.5) {                          // drüber — dann aber zwischen den Pfosten
        zTor = 2.6 + rnd() * 2.2;
        fS.y1 = clamp(B / 2 + (rnd() - 0.5) * 6.4, 0.6, B - 0.6);
      } else zTor = 0.2 + rnd() * 1.6;
      fS.bahn = 'schuss'; fS.z0 = kopf ? 2.0 : 0.15; fS.g = 3.2; fS.zEnd = zTor;
      fS.vz = (zTor - fS.z0 + 0.5 * fS.g * fS.dur * fS.dur) / fS.dur;
      if (fk) {
        // ÜBER DIE MAUER: an der Mauer (9,15 m) gut 2,4 m hoch, dann senkt sich
        // der Ball ins Ziel. Parabel über den Fluganteil u: z = z0 + A·u − Bq·u².
        const uw = clamp(9.15 / Math.max(10, dz), 0.15, 0.8);
        const zW = 2.35 + rnd() * 0.5, z0 = 0.11;
        const Bq = (zW - z0 - (zTor - z0) * uw) / (uw * (1 - uw));
        const Aq = (zTor - z0) + Bq;
        fS.bahn = 'freistoss'; fS.z0 = z0;
        fS.vz = Aq / fS.dur; fS.g = 2 * Bq / (fS.dur * fS.dur);
      }
      S.ball.z = fS.z0;
    }
  }

  // Läuft gerade ein Angriff? (für die Nachspielzeit — nicht mitten in einer
  // Szene abpfeifen). Ball muss laufen und im vorderen Bereich der ballführenden
  // Elf sein.
  function imAngriff(S) {
    if (S.clock < S.deadUntil) return false;
    const c = S.ball.owner;
    const team = c ? c.team : S.possession;
    const dir = team === 0 ? 1 : -1;
    const tief = dir > 0 ? S.ball.x : L - S.ball.x;
    return tief > 62;
  }

  // Kopfball nach Flanke: eigener Abschluss mit eigener Chancenqualität.
  // Ein Kopfball ist schwerer zu platzieren als ein Schuss — die Grundchance liegt
  // niedriger, dafür entscheidet `kopfball` sehr direkt mit.
  function kopfball(S, p) {
    const roh = xgAt(S, p);
    const anteil = 0.62 + (p.w.kopfball - 70) * 0.010;      // Kopfballstärke schlägt durch
    p._kopfballXg = clamp(roh * clamp(anteil, 0.30, 1.15), 0.004, 0.55);
    S.ev.push({ t: S.clock, type: 'kopfball', side: p.team ? 'away' : 'home',
                player: p, x: p.x, y: p.y });
    S._kopfSchuss = true;
    shoot(S, p, p._kopfballXg);
  }

  // Einschlag des Schusses — erst hier fällt das Tor
  function schussTrifft(S, f) {
    const s = f.schuss, c = s.schuetze, st = S.stats[c.team];
    const torX = c.dir > 0 ? L : 0;
    S.ball.flight = null; S.ball.owner = null;
    if (s.ausgang === 'goal') {
      st.goals++; st.onTarget++;
      S.ev.push({ t: S.clock, type: 'goal', side: c.team ? 'away' : 'home', player: c,
                  assist: s.vorlage || null, x: c.x, y: c.y, xg: s.xg, art: s.art, standard: !!s.standard });
      kickoff(S, c.team ? 0 : 1);
      return;
    }
    if (s.ausgang === 'save') {
      st.onTarget++;
      S.ev.push({ t: S.clock, type: 'save', side: c.team ? 'away' : 'home', player: c, x: c.x, y: c.y, xg: s.xg, art: s.art });
      // Der Torwart faustet gut ein Drittel der Bälle zur Ecke ab
      if (S.rnd() < 0.44) { outOfPlay(S, torX, S.rnd() < 0.5 ? -1 : B + 1, 1 - c.team); return; }
      // ABPRALLER. Bisher hatte der Keeper jeden nicht abgefausteten Ball sicher
      // — es gab keine zweiten Bälle im Strafraum. Real entsteht daraus ein
      // spürbarer Teil aller Tore. Wer am nächsten steht, kommt dran; das ist
      // meist ein Verteidiger, manchmal aber der nachrückende Stürmer.
      if (S.rnd() < 0.34) {
        S.ball.x = torX - c.dir * (4 + S.rnd() * 6);
        S.ball.y = clamp(B / 2 + (S.rnd() - 0.5) * 16, 2, B - 2);
        S.ball.flight = null;
        const naechster = nearestToBall(S);
        if (naechster && naechster.role !== 'TW') {
          giveBall(S, naechster);
          S.nextDecide = S.clock + 0.25;          // sofort weiterspielen
          return;
        }
      }
      giveBall(S, S.teams[1 - c.team].find(p => p.role === 'TW'));
      S.deadUntil = S.clock + 12 + S.rnd() * 14;
      return;
    }
    S.ev.push({ t: S.clock, type: 'miss', side: c.team ? 'away' : 'home', player: c, x: c.x, y: c.y, xg: s.xg, art: s.art });
    outOfPlay(S, torX, B / 2, c.team);                     // daneben → Abstoß
  }

  // ── BALLFLUG MIT HÖHE ───────────────────────────────────────────────────────
  // Bisher kannte die Engine nur x und y: jeder Ball flog über den Rasen. Ein
  // langer Ball konnte deshalb von jedem Verteidiger unterwegs abgefangen werden,
  // ein Chip über die Kette war unmöglich, und Flanke, Klärung und Steilpass
  // unterschieden sich nur im Tempo.
  // Jetzt hat jede Flugbahn eine Höhe:
  //   flach     rollt — überall im Weg abfangbar
  //   halbhoch  Scheitel 1,4–2,3 m — nur am Anfang und am Ende erreichbar
  //   hoch      fliegt über Köpfe — umkämpft wird erst in der Landezone
  // Die Scheitelhöhe ergibt sich aus Art und Weite, die Flugzeit aus der
  // Physik (Schwerkraft), das Tempo über Grund daraus. So kommt ein hoher Ball
  // realistisch später an als ein flacher — Zeit, in der sich die Abwehr stellt.
  function bahnStandard(S, kind, d, frei) {
    if (kind === 'clear') return 'hoch';
    // Langer Ball: ist der Weg frei, wird er scharf und halbhoch gespielt (die
    // Seitenverlagerung) — hoch nur, wenn er über Gegner hinweg muss. Vorher
    // ging jeder lange Ball hoch: 60–70 hohe Bälle je Team.
    if (kind === 'long') return frei ? 'halbhoch' : 'hoch';
    if (kind === 'cross') return S.rnd() < 0.7 ? 'hoch' : 'halbhoch';
    if (d < 21) return 'flach';
    if (d < 32) return S.rnd() < 0.72 ? 'flach' : 'halbhoch';
    return 'hoch';
  }
  // Setzt die Höhenwerte einer Flugbahn (Startgeschwindigkeit nach oben, Dauer)
  function flugHoehe(S, f, kind, bahn, dFlug, z0) {
    f.bahn = bahn; f.z0 = z0; f.g = CFG.schwerkraft; f.vz = 0; f.zEnd = 0;
    if (bahn === 'flach') return;
    const g = CFG.schwerkraft;
    const h = bahn === 'halbhoch' ? 1.4 + S.rnd() * 0.9
            : kind === 'clear' ? 9 + S.rnd() * 7
            : kind === 'cross' ? 3.2 + S.rnd() * 2.6
            : kind === 'through' ? 2.6 + dFlug * 0.05
            : 2.8 + dFlug * 0.10;
    // Ankunftshöhe: Flanken kommen auf Kopf- bzw. Hüfthöhe. Lange Bälle und
    // Klärungen landen gut zur Hälfte auf Kopfhöhe — dort gibt es das typische
    // Kopfballduell im Mittelfeld —, sonst auf Brust oder Fuß.
    if (kind === 'cross') f.zEnd = bahn === 'hoch' ? 1.9 : 0.7;
    else if (bahn === 'hoch' && (kind === 'clear' || kind === 'long' || dFlug > 30)) f.zEnd = S.rnd() < 0.5 ? 1.6 + S.rnd() * 0.5 : 0.35;
    else f.zEnd = 0.35;
    const vz0 = Math.sqrt(2 * g * Math.max(0.3, h - z0));
    const tLuft = (vz0 + Math.sqrt(Math.max(0, vz0 * vz0 - 2 * g * (f.zEnd - z0)))) / g;
    const vh = clamp(dFlug / Math.max(0.2, tLuft), 8.5, 27);
    f.dur = Math.max(0.3, dFlug / vh);
    f.vz = (f.zEnd - z0 + 0.5 * g * f.dur * f.dur) / f.dur;
  }
  function hoeheImFlug(f) {
    if (!f || !f.vz) return 0;
    const t = f.t < f.dur ? f.t : f.dur;
    const z = f.z0 + f.vz * t - 0.5 * f.g * t * t;
    return z > 0 ? z : 0;
  }
  // Im eigenen Strafraum darf der Torwart die Hände nehmen
  function imEigenenStrafraum(p) {
    const tief = p.dir > 0 ? p.x : L - p.x;
    return tief < 16.5 && Math.abs(p.y - B / 2) < 20.2;
  }
  // Bis zu welcher Höhe erreicht ein Spieler einen Ball im Flug?
  function reichweite(p) {
    if (p.role === 'TW' && imEigenenStrafraum(p)) return CFG.reichTorwart;
    return CFG.reichKopf + (p.w.kopfball - 60) * 0.004;
  }

  // LANDUNG eines hohen Balls (oder eines Passes in den Lauf): wer kommt an der
  // Landestelle zuerst an den Ball? Ohne Gegner nimmt der Empfänger an — mit
  // Risiko beim ersten Kontakt. Mit Gegner in der Nähe gibt es ein Duell, in der
  // Luft per Kopf, am Boden per Körper. Kommt der Empfänger gar nicht hin (Lauf
  // falsch getimt, Ball zu weit), gewinnt der Schnellere das Laufduell.
  function landung(S, f) {
    const ball = S.ball, team = f.team;
    const z = f.zEnd || 0;
    let mit = null, md = 1e9, geg = null, gd = 1e9;
    for (let i = 0; i < S.players.length; i++) {
      const p = S.players[i];
      const d = dist(p, ball);
      if (p.team === team) {
        if (p.role === 'TW') continue;
        const bevorzugt = p === f.to ? -1.2 : 0;      // der gemeinte Empfänger hat Vorrang
        if (d + bevorzugt < md) { md = d + bevorzugt; mit = p; }
      } else {
        // Der Torwart kommt nur im eigenen Strafraum heraus — dort aber für
        // hohe Bälle UND für Bälle in den Lauf (Herauslaufen, „Libero-Torwart")
        if (p.role === 'TW') {
          const tiefBall = p.dir > 0 ? ball.x : L - ball.x;
          if (!(imEigenenStrafraum(p) && tiefBall < 16.5 && Math.abs(ball.y - B / 2) < 20.2)) continue;
        }
        if (d < gd) { gd = d; geg = p; }
      }
    }
    if (mit) md = dist(mit, ball);
    // Niemand in Reichweite: der Ball springt ein paar Meter weiter und bleibt
    // liegen — wer zuerst dort ist, hat ihn (freier Ball, siehe step)
    if ((!mit || md > 3.5) && (!geg || gd > 3.5)) {
      const dx0 = f.x1 - f.x0, dy0 = f.y1 - f.y0, l0 = Math.sqrt(dx0 * dx0 + dy0 * dy0) || 1;
      const sprung = 2 + S.rnd() * 3;
      freierBall(S, ball.x + dx0 / l0 * sprung, ball.y + dy0 / l0 * sprung);
      return true;
    }
    const kopf = z >= 1.2;
    // Ein Befreiungsschlag ist kein Pass: der Stürmer steht mit dem Rücken zum
    // Tor zwischen den Verteidigern, die den Ball vor sich haben. Ohne diesen
    // Unterschied wurde jede Klärung zum Konter (Zählbogen: 2,3 Schüsse je Team
    // direkt nach einem Befreiungsschlag).
    const klaerung = f.kind === 'clear';
    const freiAb = klaerung ? 5 : 2.6;
    if (mit && md <= 3.5 && (!geg || gd > freiAb || (!klaerung && gd > md + 1.8))) {
      // Freie Annahme. Hohe Bälle sind schwerer zu verarbeiten als flache.
      const tech = mit.w.dribbling * 0.6 + mit.w.passen * 0.4;
      const pFehl = clamp((kopf ? 0.16 : 0.09) + (md > 2 ? 0.05 : 0) + (klaerung ? 0.12 : 0) - (tech - 60) * 0.004, 0.02, 0.45);
      if (S.rnd() < pFehl) {
        // Verspringt — rollt ein paar Meter in Flugrichtung, dann Laufduell
        const dx = f.x1 - f.x0, dy = f.y1 - f.y0, len = Math.sqrt(dx * dx + dy * dy) || 1;
        S.ev.push({ t: S.clock, type: 'annahme', side: team ? 'away' : 'home', player: mit, x: ball.x, y: ball.y, ok: false });
        freierBall(S, ball.x + dx / len * (2 + S.rnd() * 3), ball.y + dy / len * (2 + S.rnd() * 3));
        return true;
      }
      giveBall(S, mit);
      return true;
    }
    if (!mit || md > 3.5) { torwartOderGeben(S, geg); return true; }   // Gegner steht allein da
    // DUELL an der Landestelle
    let pMit;
    if (kopf) {
      const angriff = mit.w.kopfball * 0.6 + mit.w.kraft * 0.4;
      const abwehr = geg.role === 'TW' ? (geg.w.reflexe * 0.5 + geg.w.einsGegenEins * 0.5 + 8)
                                        : (geg.w.kopfball * 0.5 + geg.w.kraft * 0.25 + geg.w.defStellung * 0.25);
      pMit = clamp((klaerung ? 0.30 : 0.44) + (angriff - abwehr) * 0.014 - (md - gd) * 0.08, 0.08, 0.80);
    } else {
      const angriff = mit.w.dribbling * 0.5 + mit.w.kraft * 0.5;
      // Torwart am Boden: Herauslaufen entscheidet das 1 gegen 1 (er hat keine
      // Tackling-Werte — ohne diese Unterscheidung wurde die Rechnung NaN)
      const abwehr = geg.role === 'TW' ? (geg.w.einsGegenEins * 0.7 + geg.w.reflexe * 0.3 + 6)
                                        : (geg.w.tackling * 0.5 + geg.w.defStellung * 0.5);
      // Pass in den Lauf: der Läufer kommt mit Tempo, der Verteidiger muss sich
      // erst drehen — das Gelingensbild „der Verteidiger muss sich drehen, bevor
      // der Ball gespielt ist". Ohne diesen Vorsprung verlor der Läufer fast jedes Duell.
      const laufVorteil = f.lauf && mit === f.to ? CFG.steilpass.laufVorteil : 0;
      pMit = clamp((klaerung ? 0.36 : 0.50) + laufVorteil + (angriff - abwehr) * 0.012 - (md - gd) * 0.06, 0.12, 0.85);
    }
    const gewinner = S.rnd() < pMit ? mit : geg;
    S.ev.push({ t: S.clock, type: kopf ? 'luftduell' : 'annahme', side: gewinner.team ? 'away' : 'home',
                player: gewinner, gegen: gewinner === mit ? geg : mit, x: ball.x, y: ball.y, ok: gewinner === mit });
    if (gewinner === geg && kopf && geg.role !== 'TW') {
      // Weggeköpft: der Ball fällt 6–14 m entfernt herunter — zweiter Ball
      const weg = 6 + S.rnd() * 8, rw = geg.dir;
      freierBall(S, ball.x + rw * weg * (0.6 + S.rnd() * 0.4), ball.y + (S.rnd() - 0.5) * weg);
      return true;
    }
    torwartOderGeben(S, gewinner);
    return true;
  }
  // FREIER BALL: liegt auf dem Rasen, niemand führt ihn. Bisher bekam ihn in so
  // einem Moment sofort der nächststehende Spieler — auch aus 15 m Entfernung,
  // ohne hinlaufen zu müssen. Ein 60-m-Befreiungsschlag landete so direkt beim
  // eigenen Stürmer (Zählbogen: fast 2 Schüsse je Team genau aus diesem Muster).
  // Jetzt laufen die Nächsten beider Teams hin, und wer zuerst ankommt, hat ihn.
  function freierBall(S, x, y) {
    S.ball.owner = null; S.ball.flight = null;
    S.ball.x = clamp(x, 1, L - 1); S.ball.y = clamp(y, 1, B - 1); S.ball.z = 0;
    S.ball.frei = { bis: S.clock + 5 };
  }
  // Fängt der Torwart einen hohen Ball, hält er ihn fest — kurze Ruhepause wie
  // beim Abfangen einer Flanke, statt sofort weiterzuspielen.
  function torwartOderGeben(S, p) {
    if (p && p.role === 'TW') {
      S.ev.push({ t: S.clock, type: 'twfang', side: p.team ? 'away' : 'home', player: p, x: S.ball.x, y: S.ball.y });
      giveBall(S, p);
      S.deadUntil = S.clock + 4 + S.rnd() * 6;
      return;
    }
    giveBall(S, p);
  }

  function passBall(S, from, to, kind, wahl) {
    // ABSEITS NACH DER REGEL: Lage des Empfängers im Moment des Abspiels. Aus
    // Einwurf, Ecke und Abstoß gibt es kein Abseits. Gepfiffen wird erst, wenn
    // der Ball ihn erreicht (siehe step). Der Linienrichter irrt nur knapp.
    let abseitsStand = null;
    if (CFG.regeln.abseitsEcht) {
      const ohne = S._ohneAbseits === from;
      S._ohneAbseits = null;
      if (!ohne && to.role !== 'TW') {
        const lage = abseitsLage(S, to, S.ball.x);
        const irrtum = (S.rnd() - 0.5) * 2 * CFG.abseitsIrrtum;
        if (lage.ueber - CFG.abseitsZweifel + irrtum > 0) {
          const vd = vorletzterGegner(S, to.team);
          abseitsStand = { spieler: to, linie: lage.linie, ueber: lage.ueber, px: to.x, py: to.y, t: S.clock,
                           vx: vd ? vd.x : null, vy: vd ? vd.y : null, bx: S.ball.x, by: S.ball.y };
        }
      }
    // ABSEITS (alt). Bisher wurde es nur bei der Passwahl vermieden, gepfiffen wurde nie
    // (0 pro Spiel statt real 2–4). Beim Steckpass startet der Läufer manchmal zu
    // früh — wer sein offensives Stellungsspiel beherrscht, seltener.
    } else if (kind === 'through' && to.role !== 'TW') {
      const linie = lastLine(S, from.team);
      const ueber = (to.x - linie) * from.dir;         // >0 = schon jenseits
      // Grundwert kleiner, seit Läufe getimt starten und niemand mehr im Abseits
      // wartet — sonst 4,3 Abseits je Team (real ~2)
      const p = clamp((CFG.abseitsDeckel ? 0.03 : 0.065) - (to.w.offStellung - 70) * 0.0018 + ueber * 0.045, 0.008, 0.30);
      if (S.rnd() < p) {
        S.stats[from.team].abseits = (S.stats[from.team].abseits || 0) + 1;
        S.ev.push({ t: S.clock, type: 'abseits', side: from.team ? 'away' : 'home',
                    player: to, x: to.x, y: to.y });
        S.ball.flight = null; S.ball.owner = null;
        S.ball.x = clamp(to.x, 2, L - 2); S.ball.y = clamp(to.y, 2, B - 2);
        const geg = S.teams[1 - from.team];
        let aus = geg[0], bd = 1e9;
        for (let i = 0; i < geg.length; i++) {
          const d = dist(geg[i], S.ball); if (d < bd) { bd = d; aus = geg[i]; }
        }
        aus.x = S.ball.x; aus.y = S.ball.y;
        giveBall(S, aus);
        S.deadUntil = S.clock + 10 + S.rnd() * 10;
        return;
      }
    }
    const st = S.stats[from.team];
    st.passes++;
    const PR = CFG.prinzipien;
    // Mechanik wie ein Steckpass (Tempo, Flughöhe, Können, Schwierigkeit), auch für das Anspiel an die Linie (D66: nur die
    // Benennung im Ereignis ist dort „pass“/„long“)
    const art = wahl && wahl.anLinie ? 'through' : kind;
    // Zielpunkt: in den Fuß (Position des Empfängers) oder in den Lauf (Treffpunkt)
    const zielX = wahl && wahl.ziel ? wahl.ziel.x : to.x, zielY = wahl && wahl.ziel ? wahl.ziel.y : to.y;
    const d = Math.hypot(zielX - from.x, zielY - from.y);
    const v = CFG.ballSpeed[art] || CFG.ballSpeed.pass;
    let bahn = 'flach';
    if (PR.ballhoehe) {
      if (wahl && wahl.bahn) bahn = wahl.bahn;
      else {
        let frei = false;
        if (art === 'long') { const zp = S._tor; zp.x = zielX; zp.y = zielY; frei = laneBlocked(S, from, zp) < 0.3; }
        bahn = bahnStandard(S, art, d, frei);
      }
    }
    // Genauigkeit aus Technik/Pass, Druck und Schwierigkeit
    // Je näher am gegnerischen Tor, desto seltener kommt der Pass an. Das ist der
    // entscheidende Hebel für die Chancenzahl (gleiche Erfahrung wie in Engine v2:
    // an der Schussneigung zu drehen bringt fast nichts).
    const tief = from.dir > 0 ? zielX : L - zielX;
    // NACHKALIBRIERT zusammen mit der Passformel. Der Abzug von 0,26 war auf die
    // alte, gesättigte Passquote von 97 % ausgelegt — er sollte dort die
    // Chancenzahl bremsen. Mit realistischen 83 % bremste er doppelt: Angriffe
    // starben im letzten Drittel, die erzeugten xG lagen bei 1,9 statt real 2,9.
    // Werte jetzt in CFG (zoneStrafraum/zoneDrittel), mit den Spielprinzipien neu kalibriert.
    const zone = tief > 88 ? CFG.zoneStrafraum : tief > 72 ? CFG.zoneDrittel : 0;
    // Passgenauigkeit aus dem passenden Können: eine Flanke ist keine Passfrage.
    const koennen = kind === 'cross' ? from.w.flanken
                  : (art === 'through' ? (from.w.passen * 0.6 + from.w.spielintelligenz * 0.4)
                                        : from.w.passen);
    // Grundwert 1.10 → 1.24 und der steilere Können-Faktor: die Passquote lag
    // bei 62 % (Zielkorridor 70–86) und der Abstand zwischen einer guten und
    // einer schwachen Elf bei mageren 1,7 Punkten. Beides hing daran, dass die
    // Abzüge unten den flachen Qualitätsterm erdrückt haben.
    // NEU KALIBRIERT. Vorher stand hier 1.24 * qs(koennen). qs() liefert bei
    // Können 70 bereits 1,24 — der Term lag also bei 1,54 und damit weit über
    // dem Deckel von 0,985. Sämtliche Abzüge für Distanz, Druck, zugestellte
    // Passwege und Zone mussten erst diesen Überhang aufbrauchen, bevor sie
    // überhaupt wirkten. Folge: 97 % Passquote (real 76–86 %), Flanken kamen zu
    // 95 % an (real ~25 %), und zwischen Können 74 und 90 lagen 1,3 Punkte.
    // Jetzt additiv in der Wahrscheinlichkeits-Domäne, damit die Abzüge greifen.
    const basis = CFG.passBasis + (koennen - 55) * CFG.passSteil;
    // Zugestellter Weg: flach zählt der ganze Passweg, über die Köpfe hinweg nur
    // die Landezone — genau dafür spielt man den hohen Ball.
    const _ziel = S._tor; _ziel.x = zielX; _ziel.y = zielY;
    const gesperrt = bahn === 'hoch' ? landezoneBlockiert(S, from, _ziel) : laneBlocked(S, from, _ziel);
    // Ein hoher Ball ist schwerer genau zu spielen als ein flacher
    const hochAbzug = bahn === 'hoch' && kind !== 'cross' && kind !== 'clear' ? 0.05 : (bahn === 'halbhoch' ? 0.02 : 0);
    // Unter Druck gehetzt entschieden (Zeit am Ball): der Pass wird ungenauer
    const gehetzt = PR.zeitAmBall && from._gehetzt > S.clock ? 0.07 : 0;
    from._gehetzt = 0;
    // In den Lauf braucht Timing auf beiden Seiten — schwerer als in den Fuß
    // (Flanken auf den Einlaufpunkt haben ihren eigenen Flankenabzug)
    const inDenLauf = wahl && wahl.ziel && kind !== 'cross' ? 0.12 : 0;
    // Hohe Linie des Gegners (S.anw): ein schneller Stürmer in den Lauf entwischt der Kette öfter
    let hinterKette = 0;
    if (inDenLauf && S.anw && to) { const gl = anw(S, 1 - from.team).linie; if (gl > 0) hinterKette = gl * CFG.hoheLinieTempo * Math.max(0, tempoVorteil(S, to)); }
    const p = clamp(basis
      - d * 0.0045 - (1 - from.kond) * 0.16 - (anw(S, from.team).fehler - 1) * 0.5 - pressureOn(S, from) * 0.09 * pressDruck(S, from.team) - gesperrt * 0.30 * pressLuecke(S, from.team) - zone - hochAbzug - gehetzt - inDenLauf + hinterKette
      - (art === 'through' ? 0.10 : 0) - (kind === 'cross' ? CFG.flankenAbzug : 0), 0.05, 0.97);
    const ok = S.rnd() < p;
    // Zielpunkt: bei Fehlpass daneben
    const tx = zielX + (ok ? 0 : (S.rnd() - 0.5) * 20), ty = zielY + (ok ? 0 : (S.rnd() - 0.5) * 24);
    S.ball.owner = null;
    // Fehlpässe dürfen ins Aus gehen — nicht ans Feld klemmen.
    const x1 = clamp(tx, -6, L + 6), y1 = clamp(ty, -6, B + 6);
    const f = { x0: from.x, y0: from.y, x1: x1, y1: y1, t: 0,
                dur: Math.max(0.12, d / v), to: ok ? to : null, kind: art, team: from.team,
                from: from,              // Flankengeber, für das Luftduell
                lauf: !!(wahl && wahl.ziel) && kind !== 'cross', rueckraum: !!(wahl && wahl.rueckraum) };
    flugHoehe(S, f, art, bahn, Math.hypot(x1 - from.x, y1 - from.y), 0.1);
    if (abseitsStand) f.abseits = abseitsStand;
    S.ball.flight = f; S.ball.frei = null;
    S.ball.z = f.z0 || 0;
    S.lastPasser = from;
    if (ok) st.passAcc++;
    // Hohe Linie überlaufen: die Kette muss sich erst umdrehen, der schnelle Stürmer ist weg
    if (ok && hinterKette > 0) { const bis = S.clock + f.dur + CFG.kettUmdrehen * hinterKette / CFG.hoheLinieTempo; for (const q of S.backs[1 - from.team]) q._umdrehBis = bis; }

    if (PR.ballhoehe && (bahn === 'hoch' || (ok && (f.lauf || (kind === 'cross' && wahl && wahl.ziel))))) {
      // Der Empfänger läuft zur Landestelle, statt dort stehen zu bleiben, wo er
      // beim Abspiel war — und der nächste Gegner geht mit ins Duell. Auch bei
      // einem verunglückten hohen Ball: dann eben der Nächste jedes Teams.
      // Sofort umsetzen, nicht erst im nächsten Planungstakt (bis zu 1,1 s später)
      const bis = S.clock + f.dur + 0.2;
      if (ok) {
        to._annahme = { bis: bis, x: x1, y: y1 };
        to._tx = clamp(x1, 1.5, L - 1.5); to._ty = clamp(y1, 2, B - 2); to._v = SPD.run;
      }
      if (bahn === 'hoch') {
        for (let tm = 0; tm < 2; tm++) {
          if (tm === from.team && ok) continue;         // der gemeinte Empfänger läuft schon
          const arr = S.teams[tm];
          let n = null, nd = 15;
          for (let i = 0; i < arr.length; i++) {
            const o = arr[i];
            if (o === from || (o.role === 'TW' && !imEigenenStrafraum(o))) continue;
            const dd = Math.hypot(o.x - x1, o.y - y1);
            if (dd < nd) { nd = dd; n = o; }
          }
          if (n) {
            const vx = tm !== from.team ? x1 - n.dir * 0.8 : x1;
            n._annahme = { bis: bis, x: vx, y: y1 };
            n._tx = clamp(vx, 1.5, L - 1.5); n._ty = clamp(y1, 2, B - 2); n._v = SPD.run;
          }
        }
      }
      // Landet der Ball im Strafraum des Gegners, kommt dessen Torwart heraus,
      // wenn er es rechtzeitig schaffen kann.
      const tw = S.teams[1 - from.team].find(q => q.role === 'TW');
      if (tw) {
        const tiefZ = tw.dir > 0 ? x1 : L - x1;
        // Herauslaufen nur, wenn er vor dem Empfänger dort sein kann — sonst
        // bleibt er im Tor (vorher fing er 12 Bälle je Spiel im Strafraum ab)
        const twWeg = Math.hypot(tw.x - x1, tw.y - y1), empfWeg = Math.hypot(to.x - x1, to.y - y1);
        if (tiefZ < 16.5 && Math.abs(y1 - B / 2) < 20.2 && twWeg < 17 && twWeg < empfWeg * CFG.steilpass.torwart) {
          tw._annahme = { bis: S.clock + f.dur + 0.2, x: x1, y: y1 };
          tw._tx = clamp(x1, 1.5, L - 1.5); tw._ty = clamp(y1, 2, B - 2); tw._v = SPD.sprint;
        }
      }
    }
    // „klatsch!": der zugestellte Empfänger soll direkt ablegen, nicht aufdrehen
    if (ok && wahl && wahl.klatsch) to._klatsch = S.clock + f.dur + 1.4;
    // „weiter!": wer abgespielt hat, bleibt nicht stehen
    // Nicht nach jedem Pass und nicht nach Rückpässen — der Mittelfeldspieler
    // geht meistens mit, der Außenverteidiger seltener.
    const willig = from.role === 'AV' && !(from._schiene && CFG.schiene.an) ? 0.4 : 0.7;
    if (PR.weiter && ok && from.role !== 'TW' && !from._rest && kind !== 'clear' && kind !== 'cross' &&
        (x1 - from.x) * from.dir > -3 && S.rnd() < willig) {
      const zurMitte = from.y < B / 2 ? 1 : -1;
      from._weiter = { bis: S.clock + 2.0,
                       x: clamp(from.x + from.dir * (5 + S.rnd() * 3.5), 3, L - 3),
                       y: clamp(from.y + zurMitte * (2 + S.rnd() * 3), 3, B - 3) };
      from._tx = from._weiter.x; from._ty = from._weiter.y; from._v = SPD.run;
    }
    // „nachrücken!": Rückpass (oder Pass zum Torwart) ist das Signal für den
    // Gegner, die Kette nach vorn zu schieben. Vorher rückte die Kette bei einem
    // 16-m-Rückpass in zwei Sekunden um 0,1 m nach (Zählbogen).
    if (PR.nachruecken && ok && ((x1 - from.x) * from.dir < -7 || to.role === 'TW')) {
      // Die Kette schiebt nur mit heraus, wenn vorn jemand den Empfänger auch
      // unter Druck setzen kann. Sonst hat der alle Zeit für den langen Ball
      // hinter die hohe Kette — gemessen erzeugte das blinde Rausschieben
      // 60 % mehr Torschüsse für den Gegner.
      const wir = S.teams[1 - from.team];
      let druck = false;
      for (let i = 0; i < wir.length; i++) {
        const r = wir[i].role;
        if (r === 'TW' || r === 'IV' || r === 'AV') continue;       // Druck machen die vorderen Reihen
        if (Math.hypot(wir[i].x - x1, wir[i].y - y1) < 13) { druck = true; break; }
      }
      if (druck) {
        S.schieben[1 - from.team] = { bis: S.clock + 2.0, x: x1, y: y1, druck: true };
        S._neuPlanen = 1 - from.team;
      }
    }
    S.ev.push({ t: S.clock, type: kind === 'cross' ? 'cross' : 'pass', side: from.team ? 'away' : 'home',
                player: from, x: from.x, y: from.y, tx: zielX, ty: zielY, kind, ok, modus: S.modus,
                bahn: bahn, lauf: f.lauf || undefined, empf: to._i, anLinie: (wahl && wahl.anLinie) || undefined });
  }

  // Für hohe Bälle: nur wer in der Landezone steht, stört den Pass
  function landezoneBlockiert(S, from, to) {
    const opp = S.teams[1 - from.team];
    const dx = to.x - from.x, dy = to.y - from.y;
    const len2 = dx * dx + dy * dy || 1;
    let worst = 0;
    for (let i = 0; i < opp.length; i++) {
      const o = opp[i];
      const t = ((o.x - from.x) * dx + (o.y - from.y) * dy) / len2;
      if (t < 0.82 || t > 1.08) continue;
      const ex = o.x - (from.x + dx * t), ey = o.y - (from.y + dy * t);
      const q2 = ex * ex + ey * ey;
      if (q2 < 12.25) { const w = 1 - Math.sqrt(q2) / 3.5; if (w > worst) worst = w; }
    }
    return worst;
  }

  function giveBall(S, p) {
    if (!p) return;
    // Standard beenden, sobald der Ball bei jemand anderem ist — sonst bleiben
    // alle 22 Spieler für den Rest des Spiels im Strafraum stehen.
    if (S.setPiece && p !== S.setPiece.taker) S.setPiece = null;
    // Ebenso der Freistoß (neue Aufstellung) und das „kein Abseits"-Merkmal
    if (S.freistoss && S.freistoss.auftrag && p !== S.freistoss.taker) S.freistoss = null;
    if (S._ohneAbseits && p !== S._ohneAbseits) S._ohneAbseits = null;
    if (S._std && p.team !== S._std.team) S._std = null;           // D118: Ballverlust beendet die Standardphase
    S.ball.ruht = null;
    // SARD — Sprinten, Alle, Reingehen, Dazukommen. Der Auslöser ist der Moment
    // des Ballverlusts im laufenden Spiel (nicht bei Einwurf/Abstoß). Die Elf,
    // die den Ball verloren hat, presst für ein paar Sekunden mit mehr Leuten
    // und weiterem Zugriff — danach löst sie bewusst auf und fällt zurück.
    if (S.possession !== p.team && S.clock >= S.deadUntil && !S.setPiece) {
      S.gp = { team: S.possession, bis: S.clock + CFG.sardSekunden };
      S.ev.push({ t: S.clock, type: 'ballverlust', side: S.possession ? 'away' : 'home',
                  x: S.ball.x, y: S.ball.y });
    }
    // BALLBESITZUHR: Startpunkt der Angriffsphase. Daraus ergibt sich, ob gerade
    // ZÜNDEN (direkt, 0–4 s) oder BRECHEN (geduldig öffnen, ab 5 s) gilt.
    if (S.possession !== p.team) {
      S.possSince = S.clock;
      S.lastPasser = null;                 // neuer Ballbesitz: die Vorlage des alten Angriffs verfällt
      // Rotation endet mit dem Ballbesitz — jede Elf beginnt neu in Grundordnung
      if (S.rotAktiv) {
        for (let i = 0; i < S.players.length; i++) S.players[i]._rot = false;
        S.rotAktiv = false;
      }
      // Läufe, Anschlussbewegungen und Klatsch-Aufträge gehören zum alten Angriff
      for (let i = 0; i < S.players.length; i++) {
        const q = S.players[i];
        if (q._lauf) q._lauf.bis = Math.min(q._lauf.bis, S.clock);
        q._weiter = null; q._klatsch = 0;
      }
      S.schieben[0] = null; S.schieben[1] = null;
    }
    // KOPFBALL: Wer eine Flanke im Strafraum bekommt, nimmt sie nicht in Ruhe an —
    // er geht sofort zum Abschluss. Vorher kontrollierte er den Ball und entschied
    // erst zwei Sekunden später neu; deshalb führten nur 1 % der Flanken zu einem
    // Abschluss (real 15–20 %) und `kopfball` hatte keinerlei Wirkung.
    const ausFlanke = S.ball.flight && S.ball.flight.kind === 'cross';
    S.ball.owner = p; S.ball.flight = null; S.ball.frei = null;
    S.ball.x = p.x; S.ball.y = p.y; S.ball.z = 0;
    S.possession = p.team;
    if (ausFlanke && p.role !== 'TW') {
      const tief = p.dir > 0 ? p.x : L - p.x;
      if (tief > 84) { kopfball(S, p); return; }
    }
    // Im Zünden wird der Ball kürzer gehalten — „so schnell wie möglich".
    const eil = (S.clock - S.possSince) < CFG.zuendenSek ? 0.88 : 1;
    S.nextDecide = S.clock + (CFG.decideEvery[0] + S.rnd() * (CFG.decideEvery[1] - CFG.decideEvery[0])) * eil / anw(S, p.team).tempo;
    // „klatsch!": ein zugestellter Empfänger legt direkt ab
    if (CFG.prinzipien.geschlossen && p._klatsch > S.clock) S.nextDecide = S.clock + 0.3 + S.rnd() * 0.25;
    // ABSCHLUSS IN GUTER POSITION: Wer dort den Ball bekommt, schießt direkt oder
    // nach einem Kontakt. Bisher hatte er 1,75–3,9 s Bedenkzeit — im Strafraum
    // war bis dahin jeder Verteidiger da, und ohne Abseits-Warten fielen kaum Tore.
    if (CFG.prinzipien.zeitAmBall && p.role !== 'TW' && xgAt(S, p) > CFG.schwelle * 0.8) {
      S.nextDecide = Math.min(S.nextDecide, S.clock + 0.25 + S.rnd() * 0.45);
    }
  }
  // Ball im Aus: Einwurf, Abstoß oder Ecke. Bringt echte Unterbrechungen ins
  // Spiel (ohne sie läuft der Ball 90 Minuten durch → 836 Pässe pro Team).
  function outOfPlay(S, x, y, letzterTeam) {
    const gegner = 1 - letzterTeam;
    let art = 'einwurf', ballX = clamp(x, 1, L - 1), ballY = clamp(y, 0.5, B - 0.5), zuTeam = gegner;
    if (x <= 0 || x >= L) {
      // Über die Torlinie: Ecke, wenn der Verteidiger zuletzt dran war
      const verteidigtLinks = x <= 0;                    // Team0 verteidigt bei x=0
      const heimatTeam = verteidigtLinks ? 0 : 1;
      if (letzterTeam === heimatTeam) {
        art = 'ecke'; zuTeam = gegner;
        S.stats[gegner].corners++;
        ballX = verteidigtLinks ? 1 : L - 1;
        ballY = y < B / 2 ? 0.5 : B - 0.5;
      } else {
        art = 'abstoss'; zuTeam = heimatTeam;
        ballX = verteidigtLinks ? 5 : L - 5; ballY = B / 2;
      }
    }
    S.ball.flight = null; S.ball.owner = null; S.ball.frei = null;
    S.ball.x = ballX; S.ball.y = ballY; S.ball.z = 0;
    // Nächstliegender Spieler des berechtigten Teams führt aus
    const arr = S.teams[zuTeam];
    let best = arr[0], bd = 1e9;
    for (let i = 0; i < arr.length; i++) {
      if (art === 'abstoss' && arr[i].role !== 'TW') continue;
      if (art !== 'abstoss' && arr[i].role === 'TW') continue;
      const d = dist(arr[i], S.ball);
      if (d < bd) { bd = d; best = arr[i]; }
    }
    best.x = ballX; best.y = clamp(ballY, 1, B - 1);
    giveBall(S, best);
    // Aus Einwurf, Ecke und Abstoß gibt es kein Abseits
    if (CFG.regeln.abseitsEcht) S._ohneAbseits = best;
    // Bei der Ecke rücken beide Mannschaften in den Strafraum (siehe target()).
    S.setPiece = art === 'ecke' ? { team: zuTeam, taker: best, x: ballX, y: ballY } : null;
    S.deadUntil = S.clock + (art === 'einwurf' ? 6 + S.rnd() * 8 : 14 + S.rnd() * 12) + anw(S, zuTeam).zeit;
    S.nextDecide = S.deadUntil + 0.4;
    if (art === 'ecke') S._std = { team: zuTeam, bis: S.deadUntil + CFG.standardNach };   // D118: Standardphase
    S.ev.push({ t: S.clock, type: art, side: zuTeam ? 'away' : 'home', player: best, x: ballX, y: ballY });
  }

  // ── Freistoß und Elfmeter ───────────────────────────────────────────────────
  // Vorher stoppte ein Foul nur die Uhr und dieselbe Elf spielte irgendwo weiter.
  // Jetzt gibt es einen echten Ruhepunkt: Ball liegt am Tatort, der gefoulte
  // Verein führt aus, bei Fouls im Strafraum gibt es Elfmeter.
  function freistoss(S, opfer, foulTeam) {
    const fuer = opfer.team;                       // der gefoulte Verein führt aus
    const dir = opfer.dir;
    const torX = dir > 0 ? L : 0;
    const tief = dir > 0 ? opfer.x : L - opfer.x;
    const imRaum = tief > 88.5 && opfer.y > 13.8 && opfer.y < B - 13.8;

    // Nicht jeder Kontakt im Strafraum ist ein Elfmeter — sonst gäbe es 0,8 pro
    // Spiel statt der realen 0,25. Der Rest wird als Freistoß an der Kante gewertet.
    if (imRaum && S.rnd() < 0.32) {
      // ELFMETER — es gab bisher keinen einzigen, obwohl rund ein Foul pro Spiel
      // im Strafraum passiert.
      S.stats[fuer].elfmeter = (S.stats[fuer].elfmeter || 0) + 1;
      S.ball.flight = null; S.ball.owner = null;
      S.ball.x = torX - dir * 11; S.ball.y = B / 2;
      const arr = S.teams[fuer];
      let schuetze = arr[0], best = -1;
      for (let i = 0; i < arr.length; i++) {
        if (arr[i].role === 'TW') continue;
        const w = arr[i].w.schiessen; if (w > best) { best = w; schuetze = arr[i]; }
      }
      schuetze.x = S.ball.x - dir * 1.2; schuetze.y = B / 2;
      giveBall(S, schuetze);
      S.setPiece = null;
      S.deadUntil = S.clock + 16 + S.rnd() * 8;
      S.elfmeter = { schuetze: schuetze, bis: S.deadUntil };
      S.ev.push({ t: S.clock, type: 'elfmeter', side: fuer ? 'away' : 'home',
                  player: schuetze, x: S.ball.x, y: S.ball.y });
      return;
    }

    // Neue Aufstellung (Mauer, direkter Schuss, Flanke), auch ohne die neuen Fouls
    if (CFG.regeln.freistossEcht) { freistossAufbauen(S, opfer); return; }
    // Normaler Freistoß: Ball bleibt am Tatort, nächstliegender Mitspieler führt aus
    S.ball.flight = null; S.ball.owner = null;
    S.ball.x = clamp(opfer.x, 2, L - 2); S.ball.y = clamp(opfer.y, 2, B - 2);
    const arr = S.teams[fuer];
    let sch = null, bd = 1e9;
    for (let i = 0; i < arr.length; i++) {
      const p = arr[i]; if (p.role === 'TW') continue;
      const d = dist(p, S.ball); if (d < bd) { bd = d; sch = p; }
    }
    if (sch) { sch.x = S.ball.x - dir * 1.0; sch.y = S.ball.y; giveBall(S, sch); }
    S.deadUntil = S.clock + 12 + S.rnd() * 14;
    // Mauer nur bei Freistößen in Schussweite
    S.freistoss = (tief > 66) ? { team: fuer, x: S.ball.x, y: S.ball.y, bis: S.deadUntil } : null;
    S.ev.push({ t: S.clock, type: 'freistoss', side: fuer ? 'away' : 'home',
                x: S.ball.x, y: S.ball.y, mauer: !!S.freistoss });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // REGELN (CFG.regeln): Foul, Karte, Platzverweis, Elfmeter, Freistoß, Abseits
  // ════════════════════════════════════════════════════════════════════════════

  // ── FOUL ODER SAUBER? ──────────────────────────────────────────────────────
  // Bisher war jeder dritte gewonnene Zweikampf ein Foul — egal wie, wo und von
  // wem, und niemand wusste hinterher, wer wen gefoult hatte. Jetzt entscheidet
  // die Lage: von hinten, müde, schwacher Zweikämpfer, Konter unterbinden. Im
  // eigenen Strafraum gehen Verteidiger vorsichtiger rein — dort ist jedes Foul
  // ein Elfmeter.
  function zweikampfEntscheiden(S, tackler, c, dribbelt) {
    const rnd = S.rnd;
    const tiefC = c.dir > 0 ? c.x : L - c.x;            // Höhe des Ballführers (0 = eigenes Tor)
    const imRaum = tiefC > 88.5 && Math.abs(c.y - B / 2) < 20.16;
    const rueck = (tackler.x - c.x) * c.dir;            // < 0: der Verteidiger kommt von hinten
    const vonHinten = rueck < -0.4;
    // Wie viele Feldspieler des Verteidigers stehen noch zwischen Ball und Tor?
    const abw = S.teams[tackler.team];
    let dahinter = 0;
    for (let i = 0; i < abw.length; i++) {
      const q = abw[i];
      if (q === tackler || q.role === 'TW') continue;
      if ((q.x - c.x) * c.dir > 0.5) dahinter++;
    }
    // TAKTISCHES FOUL: frischer Ballbesitz, Raum vor dem Ballführer, kaum noch
    // jemand hinten — der Konter wird mit einem Foul gestoppt.
    const taktisch = S.clock - S.possSince < 6 && tiefC > 35 && tiefC < 78 && dahinter <= 3 && spaceAhead(S, c) > 12;
    // NOTBREMSE: letzter Mann, der Angreifer zentral vor dem Tor, der Verteidiger
    // kommt nicht mehr von vorn an den Ball
    const notbremse = tiefC > 80 && Math.abs(c.y - B / 2) < 12 && dahinter === 0 && rueck < 0.4;
    let pf = CFG.foulOnTackle * CFG.foulKorrektur;
    pf *= vonHinten ? 1.5 : (rueck < 0.4 ? 1.1 : 0.8);                    // von hinten / seitlich / frontal
    pf *= clamp(1.35 - (tackler.w.tackling - 55) * 0.012, 0.7, 1.5);      // schwacher Zweikämpfer
    pf *= 1 + (1 - tackler.kond) * 0.9;                                   // müde Beine
    if (dribbelt) pf *= 1.15;                                             // wer dribbelt, wird öfter gelegt
    if (taktisch) pf *= 1.6;
    if (imRaum) pf *= CFG.strafraumVorsicht;
    if (tackler._gelb) pf *= 0.3;                                         // vorbelastet: deutlich vorsichtiger
    pf *= anw(S, tackler.team).haerte;                                    // Anweisung Härte
    { const pr = anw(S, tackler.team).press; if (pr > 1) pf *= 1 + (pr - 1) * CFG.pressFoul; }   // aggressives Pressing foult öfter
    pf = clamp(pf, 0.03, 0.85);

    if (rnd() >= pf) {
      // Sauberer Zweikampf. Ganz selten lässt sich der Angreifer im Strafraum fallen.
      if (imRaum && rnd() < CFG.schwalbeQuote) {
        S.ev.push({ t: S.clock, type: 'schwalbe', side: c.team ? 'away' : 'home', player: c, x: c.x, y: c.y });
        const ort = { team: tackler.team, dir: tackler.dir, x: c.x, y: c.y };
        S.ball.owner = null;
        karteZeigen(S, c, 'gelb', 'schwalbe');
        freistossAufbauen(S, ort, 'kurz', true);
        return;
      }
      S.ev.push({ t: S.clock, type: 'tackle', side: tackler.team ? 'away' : 'home', player: tackler, x: c.x, y: c.y });
      giveBall(S, tackler);
      return;
    }

    const art = notbremse ? 'notbremse' : (taktisch ? 'taktisch' : (vonHinten ? 'vonHinten' : 'normal'));
    S.stats[tackler.team].fouls++;
    tackler._fouls = (tackler._fouls || 0) + 1;
    S.ev.push({ t: S.clock, type: 'foul', side: tackler.team ? 'away' : 'home', player: tackler,
                opfer: c._i, art: art, x: c.x, y: c.y });

    // KARTE: taktisches Foul und Notbremse fast immer, von hinten oft, sonst selten.
    // Wer schon dreimal gefoult hat, sieht eher Gelb (wiederholtes Foulspiel).
    let karte = null;
    const r = rnd();
    if (notbremse) karte = imRaum ? 'gelb' : (r < 0.5 ? 'rot' : 'gelb');    // im Strafraum: Elfmeter + Gelb
    else {
      let pg = art === 'taktisch' ? 0.60 : (art === 'vonHinten' ? 0.20 : 0.06);
      if (tackler._gelb) pg *= 0.35;                  // die zweite Gelbe gibt es nicht so leicht
      else if (tackler._fouls >= 3) pg += 0.10;       // wiederholtes Foulspiel
      pg *= CFG.kartenKorrektur;
      if (vonHinten && r < 0.002) karte = 'rot';        // grobes Foulspiel
      else if (r < pg) karte = 'gelb';
    }
    if (karte === 'rot' && tackler.role === 'TW') karte = 'gelb';   // ohne Ersatzkeeper bleibt er drin

    // VORTEIL: In der gegnerischen Hälfte, wenn vorne Mitspieler frei stehen,
    // läuft das Spiel weiter — die Karte gibt es trotzdem.
    if (!imRaum && !notbremse && karte !== 'rot' && tiefC > 45) {
      const mit = S.teams[c.team];
      let frei = 0;
      for (let i = 0; i < mit.length; i++) {
        const m = mit[i];
        if (m === c || m.role === 'TW') continue;
        if ((m.x - c.x) * c.dir > -3 && dist(m, c) < 18 && pressureOn(S, m) < 0.8) frei++;
      }
      if (frei >= 1 && rnd() < 0.65) {
        S.ev.push({ t: S.clock, type: 'vorteil', side: c.team ? 'away' : 'home', player: c, x: c.x, y: c.y });
        tackler._ausgespielt = S.clock + 1.8;          // liegt am Boden, kein Zugriff
        tackler._liegtBis = S.clock + 1.0;
        c._dribUntil = 0;
        S.nextDecide = S.clock + 0.35 + rnd() * 0.4;
        if (karte) karteZeigen(S, tackler, karte, art);
        return;
      }
    }

    // Pfiff: der Gefoulte bleibt kurz liegen, die ersten Sekunden laufen in Echtzeit
    // (mit Karte länger — der Schiedsrichter geht hin und zeigt sie)
    c._liegtBis = S.clock + 1.3 + rnd() * 1.2;
    if (vonHinten) tackler._liegtBis = S.clock + 0.7;
    S.echtzeitBis = S.clock + (karte ? 4.5 : 1.8);
    if (karte) karteZeigen(S, tackler, karte, art);
    if (imRaum) elfmeterGeben(S, c);
    else freistossAufbauen(S, c, null, false, !!karte);
  }

  // ── KARTEN ─────────────────────────────────────────────────────────────────
  // Die zweite Gelbe bedeutet Gelb-Rot. Im Protokoll stehen dann zwei Gelbe plus
  // ein 'gelbrot' — die Sperrenlogik des Spiels zählt zwei Gelbe als Gelb-Rot.
  function karteZeigen(S, p, farbe, grund) {
    const side = p.team ? 'away' : 'home';
    if (farbe === 'gelb') {
      S.stats[p.team].yellow++;
      S.ev.push({ t: S.clock, type: 'yellow', side: side, player: p, grund: grund, x: p.x, y: p.y });
      if (!p._gelb) { p._gelb = true; return; }
      S.stats[p.team].red++;
      S.ev.push({ t: S.clock, type: 'gelbrot', side: side, player: p, grund: grund, x: p.x, y: p.y });
      platzverweis(S, p);
      return;
    }
    S.stats[p.team].red++;
    S.ev.push({ t: S.clock, type: 'red', side: side, player: p, grund: grund, x: p.x, y: p.y });
    platzverweis(S, p);
  }

  // ── PLATZVERWEIS ───────────────────────────────────────────────────────────
  // Der Spieler verlässt das Feld: raus aus allen Listen, die die Simulation
  // durchläuft. Die Aufzeichnung behält seinen festen Platz (S.alle) und zeigt
  // ihn neben dem Feld. Fehlt ein Verteidiger, rückt der defensivste
  // Mittelfeldspieler nach hinten, und die Elf steht etwas tiefer.
  function platzverweis(S, p) {
    const t = p.team;
    p._runter = true;
    S.teams[t] = S.teams[t].filter(q => q !== p);
    S.backs[t] = S.backs[t].filter(q => q !== p);
    S.players = S.players.filter(q => q !== p);
    if (S.ball.owner === p) S.ball.owner = null;
    p._lauf = null; p._press = false; p._annahme = null; p._weiter = null;
    for (let i = 0; i < S.players.length; i++) {
      const q = S.players[i];
      if (q._begleitet === p) q._begleitet = null;
      if (q._bewacht === p) q._bewacht = null;
    }
    // an der Seitenlinie Richtung Kabine
    p.x = L / 2 + (t ? 5 : -5); p.y = -2.5; p._tx = p.x; p._ty = p.y; p._vx = 0; p._vy = 0;
    if (p.role === 'IV' || p.role === 'AV') {
      let ers = null, best = -1e9;
      const arr = S.teams[t];
      for (let i = 0; i < arr.length; i++) {
        const q = arr[i];
        if (q.role !== 'ZM') continue;
        const w = q.w.defStellung - (q.dir > 0 ? q.hx : L - q.hx) * 0.5;   // defensiv und tief
        if (w > best) { best = w; ers = q; }
      }
      if (ers) {
        ers.role = p.role; ers.hx = p.hx; ers.hy = p.hy; ers._rest = ers._rest || p._rest;
        S.backs[t].push(ers);
      }
    }
    blockVerschieben(S, t, -3);
  }

  // ── ELFMETER ───────────────────────────────────────────────────────────────
  // Der Ball liegt auf dem Punkt, der Schütze geht hin (nicht mehr hingebeamt).
  function elfmeterGeben(S, opfer) {
    const fuer = opfer.team, dir = opfer.dir, torX = dir > 0 ? L : 0;
    S.stats[fuer].elfmeter = (S.stats[fuer].elfmeter || 0) + 1;
    S.ball.flight = null; S.ball.owner = null; S.ball.frei = null; S.ball.z = 0;
    S.ball.x = torX - dir * 11; S.ball.y = B / 2;
    const arr = S.teams[fuer];
    let schuetze = null, best = -1;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i].role === 'TW') continue;
      const w = arr[i].w.schiessen; if (w > best) { best = w; schuetze = arr[i]; }
    }
    if (!schuetze) schuetze = arr[0];
    laeufeAbbrechen(S);
    S.possession = fuer; S.possSince = S.clock; S.gp = null;
    S.setPiece = null; S.freistoss = null;
    S.ball.ruht = { taker: schuetze };
    S.deadUntil = S.clock + 30 + S.rnd() * 25;
    S.nextDecide = S.deadUntil + 0.3;
    S.elfmeter = { schuetze: schuetze, bis: S.deadUntil };
    S.ev.push({ t: S.clock, type: 'elfmeter', side: fuer ? 'away' : 'home',
                player: schuetze, x: S.ball.x, y: S.ball.y });
  }

  // Unterbrechung: laufende Läufe, Ballannahmen und Aufträge gehören dem alten Spielzug
  function laeufeAbbrechen(S) {
    for (let i = 0; i < S.players.length; i++) {
      const q = S.players[i];
      if (q._lauf) q._lauf.bis = Math.min(q._lauf.bis, S.clock);
      q._weiter = null; q._klatsch = 0; q._annahme = null;
    }
    S.schieben[0] = null; S.schieben[1] = null;
  }

  // ── FREISTOSS MIT AUFSTELLUNG ──────────────────────────────────────────────
  // In Schussweite und zentral: direkt über die Mauer. Seitlich im letzten
  // Drittel: Flanke — die Angreifer warten auf Höhe der Abwehrlinie und laufen
  // mit dem Schuss ein. Sonst schnell ausgeführt (auch nach Abseits).
  // Der Ball bleibt liegen, bis der Schütze bei ihm ist (S.ball.ruht).
  function freistossAufbauen(S, opfer, artVorgabe, stumm, mitKarte) {
    const fuer = opfer.team, dirA = opfer.dir;
    const torX = dirA > 0 ? L : 0;
    const bx = clamp(opfer.x, 2, L - 2), by = clamp(opfer.y, 2, B - 2);
    const tiefZumTor = Math.abs(torX - bx);
    const dTor = Math.hypot(torX - bx, B / 2 - by);
    const seitlich = Math.abs(by - B / 2);
    let art = artVorgabe || 'kurz';
    if (!artVorgabe) {
      if (dTor < 32 && tiefZumTor > 15 && seitlich < tiefZumTor * 1.05 + 4) {
        art = (dTor < 25 || S.rnd() < 0.35) ? 'direkt' : 'flanke';
        if (art === 'direkt' && S.rnd() < 0.15) art = 'flanke';          // Variante
      } else if (tiefZumTor < 38 && seitlich > 9) art = 'flanke';
    }
    const gefaehrlich = art !== 'kurz';

    // Schütze: bei Standards der Spezialist, sonst der Nächste (tief hinten der Torwart)
    const arr = S.teams[fuer];
    const tiefEigen = dirA > 0 ? bx : L - bx;
    let sch = null, bw = -1e9, zweit = null, zw = -1e9;
    for (let i = 0; i < arr.length; i++) {
      const p = arr[i];
      let w;
      if (!gefaehrlich) {
        if (p.role === 'TW' && tiefEigen > 18) continue;
        w = -Math.hypot(p.x - bx, p.y - by) + (p.role === 'TW' ? 25 : 0);
      } else {
        if (p.role === 'TW') continue;
        w = art === 'direkt' ? p.w.schiessen * 0.75 + p.w.passen * 0.25 : p.w.flanken * 0.8 + p.w.passen * 0.2;
        w -= Math.hypot(p.x - bx, p.y - by) * 0.05;
      }
      if (w > bw) { zweit = sch; zw = bw; sch = p; bw = w; } else if (w > zw) { zweit = p; zw = w; }
    }
    if (!sch) sch = arr[0];

    laeufeAbbrechen(S);
    S.ball.flight = null; S.ball.owner = null; S.ball.frei = null; S.ball.z = 0;
    S.ball.x = bx; S.ball.y = by;
    S.ball.ruht = { taker: sch };
    S.possession = fuer; S.possSince = S.clock; S.gp = null;
    S.setPiece = null; S.elfmeter = null;
    S.deadUntil = S.clock + (gefaehrlich ? 24 + S.rnd() * 14 : 7 + S.rnd() * 11) + (mitKarte ? 7 : 0) + anw(S, fuer).zeit;
    S.nextDecide = S.deadUntil + 0.4;
    const fs = { team: fuer, art: art, x: bx, y: by, torX: torX, dTor: dTor, taker: sch,
                 bis: S.deadUntil, laufBis: 0, auftrag: {}, mauer: 0, ausgefuehrt: false };
    S.freistoss = fs;
    S._std = art !== 'kurz' ? { team: fuer, bis: S.deadUntil + CFG.standardNach } : null;   // D118: Standardphase

    if (gefaehrlich) {
      const geg = S.teams[1 - fuer];
      const nahPfosten = by < B / 2 ? -1 : 1;
      // MAUER: 9,15 m vom Ball auf der Linie zum kurzen Pfosten hin, Schulter an Schulter
      const mauer = art === 'direkt' ? (dTor < 22 ? 5 : dTor < 27 ? 4 : 3) : (seitlich > 22 ? 1 : 2);
      const zyM = B / 2 + nahPfosten * 1.5;
      const ux0 = torX - bx, uy0 = zyM - by, ul = Math.hypot(ux0, uy0) || 1;
      const ux = ux0 / ul, uy = uy0 / ul;
      const mx = bx + ux * 9.15, my = by + uy * 9.15;
      const kand = [];
      for (let i = 0; i < geg.length; i++) {
        const q = geg[i]; if (q.role === 'TW') continue;
        const vorn = q.role === 'ST' || q.role === 'FL' ? 8 : (q.role === 'ZM' ? 4 : 0);
        kand.push({ q: q, w: Math.hypot(q.x - mx, q.y - my) - vorn });
      }
      kand.sort((a, b) => a.w - b.w);
      const zahl = Math.min(mauer, kand.length);
      for (let k = 0; k < zahl; k++) {
        const off = (k - (zahl - 1) / 2) * 0.75;
        fs.auftrag[kand[k].q._i] = { typ: 'mauer', x: clamp(mx - uy * off, 0.5, L - 0.5), y: clamp(my + ux * off, 0.5, B - 0.5) };
      }
      fs.mauer = zahl; fs.mauerX = mx; fs.mauerY = my;
      // TORWART: beim direkten Freistoß zum langen Pfosten (den kurzen deckt die Mauer)
      const tw = geg.find(q => q.role === 'TW');
      if (tw) {
        const weit = art === 'direkt' ? 0.9 : 3.5;
        fs.auftrag[tw._i] = { typ: 'tw', x: torX - dirA * weit, y: B / 2 - nahPfosten * (art === 'direkt' ? 1.1 : 1.6) };
      }
      // KONTERSPIELER: ein Stürmer bleibt an der Mittellinie
      const konter = geg.find(q => q.role === 'ST' && !fs.auftrag[q._i]);
      if (konter) fs.auftrag[konter._i] = { typ: 'konter', x: L / 2 + dirA * 2, y: clamp(konter.hy, 14, B - 14) };

      // ANGREIFER IN DEN STRAFRAUM: die besten Kopfballspieler, dazu ein
      // Innenverteidiger bei der Flanke. Die Restverteidigung bleibt hinten.
      const linieTief = art === 'direkt' ? clamp(tiefZumTor - 7, 9, 16) : clamp(tiefZumTor - 9, 11, 18);
      const linieX = torX - dirA * linieTief;
      let ivDabei = false;
      const kandA = [];
      for (let i = 0; i < arr.length; i++) {
        const q = arr[i];
        if (q === sch || q.role === 'TW' || q.role === 'AV') continue;
        let w = q.w.kopfball + (q.role === 'ST' ? 12 : q.role === 'FL' ? 4 : 0) + (q.pos === 'ZOM' || q.pos === 'AM' ? 4 : 0);
        if (q.role === 'IV') { if (art !== 'flanke') continue; w += 6; }
        else if (q._rest) continue;
        kandA.push({ q: q, w: w });
      }
      kandA.sort((a, b) => b.w - a.w);
      const boxLeute = [];
      for (let k = 0; k < kandA.length && boxLeute.length < (art === 'flanke' ? 5 : 3); k++) {
        const q = kandA[k].q;
        if (q.role === 'IV') { if (ivDabei) continue; ivDabei = true; }
        boxLeute.push(q);
      }
      const YS = art === 'flanke' ? [-9, -4.5, 0, 4.5, 9] : [-6, 0, 6];
      const LY = [3.5, 0.5, -2.5, -5.5, 1.5];           // Einlauf: kurzer Pfosten, Mitte, langer Pfosten …
      boxLeute.forEach((q, k) => {
        const a = { typ: 'box',
                    x: clamp(linieX - dirA * (0.4 + S.rnd() * 0.6), 1, L - 1),
                    y: clamp(B / 2 + YS[k] + (S.rnd() - 0.5) * 1.6, 3, B - 3),
                    lx: torX - dirA * (5.5 + k * 1.1 + S.rnd() * 1.5),
                    ly: clamp(B / 2 + nahPfosten * LY[k] + (S.rnd() - 0.5), 3, B - 3) };
        if (art === 'direkt' && k < 2) {
          // zwei stellen sich an das Mauerende (Abpraller, Sicht des Torwarts)
          const ende = ((zahl + 1) / 2) * 0.75 + 0.7;
          const s = k === 0 ? 1 : -1;
          a.x = clamp(mx - uy * ende * s, 1, L - 1); a.y = clamp(my + ux * ende * s, 1, B - 1);
        }
        fs.auftrag[q._i] = a;
      });
      // Beim direkten Freistoß steht ein Zweiter mit am Ball (Finte)
      if (art === 'direkt' && zweit && zweit !== sch && !fs.auftrag[zweit._i]) {
        fs.auftrag[zweit._i] = { typ: 'finte', x: bx - dirA * 1.0, y: clamp(by - nahPfosten * 1.3, 1, B - 1) };
      }
      // DECKUNG: jeder Einläufer bekommt den nächsten freien Verteidiger, der
      // Rest verteidigt den Raum vor dem Tor und den Rückraum.
      const frei = geg.filter(q => q.role !== 'TW' && !fs.auftrag[q._i]);
      boxLeute.forEach(m => {
        const am = fs.auftrag[m._i];
        let best = null, bd = 1e9;
        for (let i = 0; i < frei.length; i++) {
          const q = frei[i];
          if (fs.auftrag[q._i]) continue;
          const d = Math.hypot(q.x - am.x, q.y - am.y) - (q.role === 'IV' ? 6 : 0);
          if (d < bd) { bd = d; best = q; }
        }
        if (best) fs.auftrag[best._i] = { typ: 'decker', gegen: m, x: am.x + dirA * 0.9, y: am.y };
      });
      const ZONE = [[6.5, -3], [6.5, 3], [17, nahPfosten * -5]];
      let z = 0;
      for (let i = 0; i < frei.length && z < ZONE.length; i++) {
        const q = frei[i];
        if (fs.auftrag[q._i]) continue;
        fs.auftrag[q._i] = { typ: 'zone', x: torX - dirA * ZONE[z][0], y: B / 2 + ZONE[z][1] };
        z++;
      }
    }

    if (!stumm) {
      S.ev.push({ t: S.clock, type: 'freistoss', side: fuer ? 'away' : 'home', player: sch,
                  x: bx, y: by, art: art, mauer: fs.mauer > 0, mauerZahl: fs.mauer });
    }
  }

  // Wer hat beim Freistoß eine feste Aufgabe? true = Ziel gesetzt.
  function freistossZiel(S, p, fs) {
    if (!fs.auftrag) return false;
    const ruhend = !!S.ball.ruht;
    const imFlug = S.clock < (fs.laufBis || 0);
    if (!ruhend && !imFlug) return false;
    const a = fs.auftrag[p._i];
    if (!a) return false;
    const zumTor = fs.torX > L / 2 ? 1 : -1;
    switch (a.typ) {
      case 'mauer':
        if (!ruhend) return false;                     // nach dem Schuss wieder frei
        p._tx = a.x; p._ty = a.y; p._v = SPD.run; return true;
      case 'finte':
        if (!ruhend) return false;
        p._tx = a.x; p._ty = a.y; p._v = SPD.jog; return true;
      case 'tw': case 'konter':
        p._tx = a.x; p._ty = a.y; p._v = SPD.jog; return true;
      case 'box':
        if (imFlug) { p._tx = a.lx; p._ty = a.ly; p._v = SPD.sprint; }
        else { p._tx = a.x; p._ty = a.y; p._v = SPD.jog; }
        return true;
      case 'decker': {
        const m = a.gegen;
        if (m && !m._runter) {
          p._tx = clamp(m.x + zumTor * 0.9, 1, L - 1);
          p._ty = m.y + (m.y < B / 2 ? 0.5 : -0.5);
          p._v = imFlug ? SPD.sprint : SPD.jog;
          return true;
        }
        p._tx = a.x; p._ty = a.y; p._v = SPD.jog; return true;
      }
      case 'zone':
        p._tx = a.x; p._ty = a.y; p._v = imFlug ? SPD.run : SPD.jog; return true;
    }
    return false;
  }

  // ── AUSFÜHRUNG ─────────────────────────────────────────────────────────────
  // Direkter Freistoß: real fällt gut jeder 14. (≈ 7 %) — aus 18 m etwa jeder
  // zehnte, aus 30 m kaum einer. Die Mauer blockt knapp ein Fünftel.
  function freistossSchuss(S, c, fs) {
    const basis = clamp(0.135 - (fs.dTor - 17) * 0.0075, 0.025, 0.13);
    const xg = clamp(basis * (0.7 + (c.w.schiessen - 55) * 0.014), 0.015, 0.18);
    fs.laufBis = S.clock + 1.6;                          // Nachsetzen zum Abpraller
    if (S.rnd() < 0.17 + fs.mauer * 0.012) {
      S.stats[c.team].shots++;
      S.ev.push({ t: S.clock, type: 'blocked', side: c.team ? 'away' : 'home', player: c,
                  x: c.x, y: c.y, xg: xg, art: 'freistoss' });
      if (S.rnd() < 0.25) { outOfPlay(S, fs.torX, S.rnd() < 0.5 ? -1 : B + 1, 1 - c.team); return; }
      const ux = fs.torX - fs.x, uy = B / 2 - fs.y, ul = Math.hypot(ux, uy) || 1;
      const zp = 3 + S.rnd() * 6;
      freierBall(S, fs.x + ux / ul * zp, fs.y + uy / ul * zp + (S.rnd() - 0.5) * 6);
      return;
    }
    S._freistossSchuss = fs;
    shoot(S, c, xg);
  }
  // Freistoßflanke auf den besten Kopfballspieler, Ziel ist sein Einlaufpunkt.
  function freistossFlanke(S, c, fs) {
    let ziel = null, bw = -1e9, zp = null;
    for (const k in fs.auftrag) {
      const a = fs.auftrag[k];
      if (a.typ !== 'box') continue;
      const m = S.alle[k];
      if (!m || m._runter || m.team !== c.team) continue;
      const w = m.w.kopfball + (S.rnd() - 0.5) * 22;
      if (w > bw) { bw = w; ziel = m; zp = a; }
    }
    if (!ziel) return false;
    fs.laufBis = S.clock + 2.8;
    passBall(S, c, ziel, 'cross', { ziel: { x: zp.lx, y: zp.ly }, bahn: 'hoch' });
    // Einläufer und Decker starten jetzt, nicht erst im nächsten Planungstakt
    for (let i = 0; i < S.players.length; i++) {
      const q = S.players[i];
      if (q !== c && !q._annahme) target(S, q);
    }
    return true;
  }

  // ── ABSEITSPFIFF ───────────────────────────────────────────────────────────
  // Gepfiffen wird, wenn der Spieler, der beim Abspiel im Abseits stand, an den
  // Ball kommt — vorher nicht. Fängt die Abwehr den Ball ab, läuft das Spiel.
  // Indirekter Freistoß für den Gegner an dieser Stelle.
  function abseitsPfiff(S, f) {
    const off = f.abseits, sp = off.spieler, team = sp.team;
    S.stats[team].abseits = (S.stats[team].abseits || 0) + 1;
    S.ev.push({ t: S.clock, type: 'abseits', side: team ? 'away' : 'home', player: sp,
                x: sp.x, y: sp.y, linie: +off.linie.toFixed(2), ueber: +off.ueber.toFixed(2),
                px: +off.px.toFixed(2), py: +off.py.toFixed(2), tPass: off.t,
                // Lage beim Abspiel: vorletzter Verteidiger und Ball (für die Einblendung)
                vx: off.vx != null ? +off.vx.toFixed(2) : null, vy: off.vy != null ? +off.vy.toFixed(2) : null,
                bx: +off.bx.toFixed(2), by: +off.by.toFixed(2) });
    S.echtzeitBis = S.clock + 1.2;
    freistossAufbauen(S, { team: 1 - team, dir: -sp.dir, x: S.ball.x, y: S.ball.y }, 'kurz', true);
  }

  function kickoff(S, teamIdx) {
    S.players.forEach(p => { p.x = p.hx; p.y = p.hy; });
    const arr = (S.teams && S.teams[teamIdx]) || S.players.filter(p => p.team === teamIdx);
    const mid = arr.find(p => p.role === 'ZM') || arr[6];
    S.ball.x = L / 2; S.ball.y = B / 2;
    giveBall(S, mid);
    S.deadUntil = S.clock + 18;
  }

  // ── Ein Simulationsschritt ─────────────────────────────────────────────────
  function step(S) {
    // Spielunterbrechungen im Zeitraffer: bei Einwurf/Abstoß/Foul passiert nichts
    // außer Neuaufstellen — das in 0,28-s-Schritten zu rechnen ist reine
    // Rechenzeit. Ein großer Schritt setzt alle direkt an ihre Position.
    const rest = S.deadUntil - S.clock;
    // Die ersten Sekunden nach einem Pfiff laufen in Echtzeit (der Gefoulte liegt,
    // alle bremsen ab) — sonst sieht man in der Aufzeichnung nur einen Sprung.
    const echtzeit = S.clock < (S.echtzeitBis || 0);
    // Vor einem Standard (Freistoß in Tornähe, Elfmeter) laufen die letzten drei
    // Sekunden ebenfalls in Echtzeit: Pfiff, Anlauf, Schuss.
    const vorStandard = S.ball.ruht && ((S.freistoss && S.freistoss.art !== 'kurz') || S.elfmeter) ? 3 : 0;
    const dt = (rest > TICK * 2 + vorStandard && !S.ball.flight && !echtzeit)
      ? Math.min(rest - TICK - vorStandard, 5) : TICK;
    S.clock += dt;

    // Auswechslungen: nur während einer Unterbrechung, wie im echten Spiel
    if (rest > 0) {
      for (let t = 0; t < 2; t++) {
        const plan = S.wPlan[t];
        while (plan.length && plan[0] <= S.clock) { plan.shift(); wechseln(S, t); }
      }
    }

    // 1) Zielpositionen + Pressing — NICHT jeden Tick. Ein Spieler orientiert sich
    //    etwa einmal pro Sekunde neu, nicht 3,6-mal. Bewegung läuft weiter jeden
    //    Tick, damit die Darstellung flüssig bleibt.
    // ZWEI getrennte Takte, das ist wichtig:
    //  · ORDNUNG (Linien, Kette, Pressingzuweisung) alle 4 Ticks = 1,12 s —
    //    genau der Wert, gegen den die Engine kalibriert ist. Lief das öfter,
    //    presste die Abwehr doppelt so scharf und die Schüsse fielen auf 2,8.
    //  · EIGENE ORIENTIERUNG jedes Spielers ebenfalls alle 1,12 s, aber
    //    phasenversetzt (halbe Elf bei Takt 0, andere Hälfte bei Takt 2), damit
    //    nicht die ganze Mannschaft im selben Moment zuckt.
    S._plan = (S._plan + 1) % PLAN_EVERY;
    const ordnen = S._plan === 0 || dt > TICK;      // im Zeitraffer immer neu ordnen
    const planen = (S._plan % (PLAN_EVERY / CFG.phasen)) === 0 || dt > TICK;
    if (ordnen) computeLines(S);
    // Verzögerte Ballwahrnehmung je Team (Reaktionszeit der Abwehrordnung)
    for (let t = 0; t < 2; t++) {
      // k MUSS ≤ 1 bleiben: im Zeitraffer (dt bis 5 s) würde die Glättung sonst
      // über das Ziel hinausschießen und aufschaukeln → NaN-Positionen.
      // Heimmannschaft reagiert eine Spur schneller (vertrauter Platz).
      const heimK = (S.heim && S.heim[t] ? (1 + CFG.heimVorteil) : 1) * (S.stil ? S.stil[t] : 1);
      const s = S.slow[t], k = Math.min(1, S.reakt[t] * heimK * dt);
      s.x += (S.ball.x - s.x) * k; s.y += (S.ball.y - s.y) * k;
    }
    const ballP = S.ball.owner || S.ball;
    // Druck auf den Ballführenden einmal je Takt — „Ball offen / Ball zu" für die Kette
    if (planen || S._neuPlanen != null) S._druckBall = S.ball.owner ? pressureOn(S, S.ball.owner) : 1;
    if (planen) {
    // Jeder Spieler orientiert sich in SEINEM eigenen Takt neu (Phasenversatz
    // über _ph). Planten alle im selben Tick, zuckte die komplette Elf
    // gleichzeitig — das ist der Hauptgrund, warum es nach Schachfiguren aussah.
    S._phase = (S._phase + 1) % CFG.phasen;
    for (let i = 0; i < S.players.length; i++) {
      const p = S.players[i];
      if (dt === TICK && p._ph !== S._phase) continue;
      target(S, p);
    }
    // „versetzt!" direkt nach der Planung — im Ordnungstakt wurde die Korrektur
    // vom nächsten Planungstakt gleich wieder überschrieben (Zählbogen: keine Wirkung)
    if (CFG.prinzipien.versetzt && S.ball.owner) versetzen(S, S.possession);
    }
    // Sofort neu planen, wenn ein Auslöser kam (Rückpass, Tiefenlauf) — sonst
    // reagierte die halbe Elf erst gut eine Sekunde später.
    if (S._neuPlanen != null) {
      const arr = S.teams[S._neuPlanen];
      S._neuPlanen = null;
      for (let i = 0; i < arr.length; i++) if (!arr[i]._press) target(S, arr[i]);   // Pressende behalten ihren Auftrag
      alignLine(S, arr[0].team);
    }
    if (ordnen) {
    // ROTATION anstoßen: hat die ballführende Elf den Ball ein paar Sekunden und
    // ist im Vorwärtsgang, überläuft der ballnahe Außenverteidiger und der Flügel
    // rückt ein. Gilt bis zum Ballverlust.
    if (S.clock - S.possSince > 3 && !S.rotAktiv && S.rnd() < 0.06) {
      const arr = S.teams[S.possession];
      const obenRum = S.ball.y < B / 2;
      for (let i = 0; i < arr.length; i++) {
        const p = arr[i];
        if ((p.role === 'AV' || p.role === 'FL') && (p.hy < B / 2) === obenRum) p._rot = true;
      }
      S.rotAktiv = true;
      S.ev.push({ t: S.clock, type: 'rotation', side: S.possession ? 'away' : 'home',
                  x: S.ball.x, y: S.ball.y });
    }
    // Pressing-Markierung im selben Takt zurücksetzen, in dem sie vergeben wird —
    // sonst bleibt sie an Spielern hängen, die längst nicht mehr anlaufen (und die
    // Taktikansicht würde das falsch anzeigen).
    for (let i = 0; i < S.players.length; i++) S.players[i]._press = false;
    for (let ti = 0; ti < 2; ti++) {
      alignLine(S, ti);
      if (S.possession === ti) continue;
      if (S.ball.ruht) continue;            // ruhender Ball (Freistoß, Elfmeter): niemand läuft an
      // die zwei nächsten Feldspieler anlaufen lassen — ohne sort/filter (heißer Pfad)
      let a = null, b = null, c3 = null, da = 1e9, db = 1e9, dc = 1e9;
      const arr = S.teams[ti];
      for (let i = 0; i < arr.length; i++) {
        const p = arr[i]; if (p.role === 'TW') continue;
        if (S.clock < (p._ausgespielt || 0)) continue;   // wurde gerade überspielt
        const d = dist(p, ballP);
        if (d < da) { c3 = b; dc = db; b = a; db = da; a = p; da = d; }
        else if (d < db) { c3 = b; dc = db; b = p; db = d; }
        else if (d < dc) { c3 = p; dc = d; }
      }
      const sard = S.gp && S.gp.team === ti && S.clock < S.gp.bis;
      const PR = CFG.prinzipien;
      // Rückpass als Pressingauslöser: wer nah genug ist, geht auf den Empfänger
      const schTrigger = PR.nachruecken && S.schieben[ti] && S.clock < S.schieben[ti].bis && S.schieben[ti].druck;
      // BALLDRUCK VOR DEM STRAFRAUM: kommt der Ball auf 32 m ans eigene Tor, geht
      // der Nächste früher drauf. Vorher wartete die Kette am Strafraum, bis der
      // Angreifer auf 9 m heran war — ein Mittelstürmer im 4-3-3 dribbelte so
      // zweimal hintereinander frei aufs Tor (Zählbogen: 7 Schüsse je Team).
      const ballTief = ti === 0 ? ballP.x : L - ballP.x;
      const druckZone = PR.balldruck && ballTief < 32 ? 5 : 0;
      const reich = ((sard ? CFG.pressRadius + 7 : CFG.pressRadius) + (schTrigger ? 4 : 0) + druckZone) * anw(S, ti).press;
      if (a && da <= reich) {
        // „schräg drauf!": von der Innenseite anlaufen, sodass der Ballführer
        // nach außen oder zurück muss. Frontal angelaufen kann er zu beiden
        // Seiten heraus (Fehlerbild). Ob es gelingt, hängt am Stellungsspiel.
        if (PR.schraegDrauf && a._pressStart !== true) a._schraeg = S.rnd() < schraegQuote(a);
        a._pressStart = true;
        if (PR.schraegDrauf && a._schraeg) {
          // Abstand innerhalb der Zweikampfreichweite (1,6 m) — mit 1,6 m kam
          // der schräge Anläufer kaum noch zum Zweikampf (Zählbogen: −12 %).
          const pk = anlaufPunkt(a, ballP, sard ? 0.9 : 1.1);
          a._tx = pk.x; a._ty = pk.y;
        } else { a._tx = ballP.x - a.dir * 0.8; a._ty = ballP.y; }
        a._v = SPD.sprint; a._press = true;
      }
      if (PR.werSichert) {
        // „wer sichert?": der Zweite geht NICHT mit an den Ball, sondern stellt
        // sich tortseitig hinter den Anläufer, leicht zur Mitte versetzt — wird
        // der Erste überspielt, ist er der Nächste. Vorher standen im
        // Gegenpressing beide auf 1,6 m am Ball, dahinter niemand.
        if (b && db <= reich + 8) {
          const sp = sicherungsPunkt(b, ballP, sard ? 4.5 : 6);
          b._tx = sp.x; b._ty = sp.y;
          b._v = sard ? SPD.sprint : SPD.run; b._press = true;
        }
        // „Mitte zu!": der Dritte stellt den gefährlichsten Passweg nach vorn zu —
        // nur im Gegenpressing. In der organisierten Abwehr riss ein dritter
        // Herausrückender Löcher in den Block (mehr Pässe zwischen die Linien).
        if (sard && c3 && dc <= reich + 12 && S.ball.owner) {
          const z = passwegZu(S, c3, S.ball.owner);
          if (z) { c3._tx = z.x; c3._ty = z.y; c3._v = SPD.run; c3._press = true; }
        }
      } else {
        // Der Absichernde deckt ZUR MITTE, nicht fix nach unten. Ein fester
        // Versatz (+3) bevorzugt dauerhaft eine Seite — gemessen: der Ball lag im
        // Schnitt bei y=21 statt 34, das ganze Spiel driftete an eine Linie.
        if (b && db <= reich + 6) {
          b._tx = ballP.x - b.dir * (sard ? 1.6 : 4);
          b._ty = ballP.y + (ballP.y < B / 2 ? 3 : -3);
          b._v = sard ? SPD.sprint : SPD.run; b._press = true;
        }
        // „Dazukommen": im Gegenpressing geht ein dritter Mann mit — allein
        // anzulaufen reißt nur Löcher, das steht so auch im Spielmodell.
        if (sard && c3 && dc <= reich + 10) {
          c3._tx = ballP.x - c3.dir * 6; c3._ty = ballP.y + (ballP.y < B / 2 ? -4 : 4);
          c3._v = SPD.run; c3._press = true;
        }
      }
    }
    // Wer in diesem Takt nicht mehr presst, beginnt beim nächsten Anlaufen neu
    for (let i = 0; i < S.players.length; i++) if (!S.players[i]._press) S.players[i]._pressStart = false;
    }

    // FREIER BALL: die zwei Nächsten jedes Teams laufen hin — jeden Tick
    if (S.ball.frei && !S.ball.owner && !S.ball.flight) {
      const imRaum = function (p) {
        const tief = p.dir > 0 ? S.ball.x : L - S.ball.x;
        return tief < 16.5 && Math.abs(S.ball.y - B / 2) < 20.2;
      };
      for (let t = 0; t < 2; t++) {
        const arr = S.teams[t];
        let a = null, b = null, da = 1e9, db = 1e9;
        for (let i = 0; i < arr.length; i++) {
          const p = arr[i];
          if (p.role === 'TW' && !imRaum(p)) continue;
          const d = dist(p, S.ball);
          if (d < da) { b = a; db = da; a = p; da = d; } else if (d < db) { b = p; db = d; }
        }
        if (a) { a._tx = S.ball.x; a._ty = S.ball.y; a._v = SPD.sprint; }
        if (b && db < 20) { b._tx = S.ball.x; b._ty = S.ball.y; b._v = SPD.run; }
      }
    }

    // 2) Bewegung
    // Aktuelle Abseitslinie der ballführenden Elf — nur, wenn der Ball in der
    // Nähe der Linie ist (weit weg dürfen Stürmer wie bisher etwas drüber stehen)
    let abX = null, abLauf = null;
    if (CFG.regeln.abseitsEcht && S.clock >= S.deadUntil) {
      const lx = abseitsLinie(S, S.possession, S.ball.x);
      abLauf = lx;
      if (Math.abs(lx - S.ball.x) <= 25) abX = lx;
    }
    for (let i = 0; i < S.players.length; i++) {
      const p = S.players[i];
      // Ballführender: NUR während eines laufenden Dribblings vorwärts. Sonst
      // hält er den Ball und sucht die Anspielstation. (Ohne das rennt jeder
      // Ballbesitzer bis in den Fünfmeterraum — gemessen: Median-Schuss aus 1 m.)
      if (S.ball.owner === p) {
        if (S.clock < (p._dribUntil || 0)) {
          p._tx = p._dtx; p._ty = p._dty; p._v = SPD.run;
        } else {
          p._tx = p.x + p.dir * 0.4; p._ty = p.y; p._v = SPD.walk;
        }
      }
      // TIEFENLAUF und sein BEGLEITER: jeden Tick nachführen, sonst kämen Start
      // und Reaktion erst im nächsten Planungstakt (bis zu 1,1 s später).
      const lf = p._lauf;
      if (lf && S.clock < lf.bis && S.possession === p.team && S.ball.owner !== p) {
        if (S.clock < lf.kurzBis) { p._tx = clamp(p.x - p.dir * 1.5, 1.5, L - 1.5); p._ty = p.y; p._v = SPD.run; }
        else { p._tx = lf.x; p._ty = lf.y; p._v = SPD.sprint; }
        // BOGEN AN DER LINIE: Solange der Ball noch am Fuß des Mitspielers ist,
        // bleibt der Läufer diesseits — er zieht quer, bis der Pass kommt.
        if (lf.bremst && abLauf !== null && S.ball.owner && S.ball.owner.team === p.team) {
          const grenze = abLauf - p.dir * 0.3;
          if ((p._tx - grenze) * p.dir > 0) {
            p._tx = grenze;
            // „JETZT!": Der Läufer ist an der Linie — das ist der Moment für den
            // Pass. Der Ballführende spielt, statt ihn dort verhungern zu lassen.
            if (!lf.signal && (p.x - grenze) * p.dir > -1.2) {
              lf.signal = true;
              if (S.nextDecide - S.clock > 0.35) S.nextDecide = S.clock + 0.15 + S.rnd() * 0.2;
            }
          }
        }
      }
      const bm = p._begleitet;
      if (bm && S.possession !== p.team && bm._lauf && bm._lauf.begleiter === p && S.clock < bm._lauf.bis && S.clock >= bm._lauf.reaktion) {
        p._tx = clamp(bm.x - p.dir * 1.3, 1.5, L - 1.5); p._ty = bm.y + (bm.y < B / 2 ? 0.8 : -0.8); p._v = SPD.sprint;
      }
      // RAUS AUS DEM ABSEITS: Steht ein Angreifer über der Linie und läuft gerade
      // keinen Tiefenlauf, geht er zügig zurück — nicht im Schritttempo, sonst
      // steht er sichtbar sekundenlang im Abseits, wenn die Abwehr herausrückt.
      if (CFG.abseitsDeckel && S.possession === p.team && p.role !== 'TW' && S.ball.owner !== p &&
          !(lf && S.clock < lf.bis) && !p._annahme) {
        const linie = lastLine(S, p.team);
        const offL = p.dir > 0 ? Math.max(linie, S.ball.x) : Math.min(linie, S.ball.x);
        if ((p.x - offL) * p.dir > 1 && p._v < SPD.run) p._v = SPD.run;
      }
      // LINIE HALTEN: Wer keinen Lauf macht, bleibt einen halben Meter vor der
      // Linie, wie sie gerade steht — rückt die Abwehr heraus, geht er mit zurück.
      if (abX !== null && S.possession === p.team && p.role !== 'TW' && S.ball.owner !== p &&
          !(lf && S.clock < lf.bis) && !p._annahme) {
        const grenze = abX - p.dir * 0.5;
        if ((p._tx - grenze) * p.dir > 0) p._tx = grenze;
        if ((p.x - grenze) * p.dir > 0 && p._v < SPD.run) p._v = SPD.run;
      }
      // Überspielt? Sofort zurück hinter den Ball — jeden Tick, nicht erst im
      // nächsten Planungstakt (bis zu 1,1 s später). Pressende sind ausgenommen.
      if (CFG.prinzipien.sofortUmschalten && S.possession !== p.team && p.role !== 'TW' && p.role !== 'ST' &&
          !p._press && !p._annahme && S.clock >= S.deadUntil) {
        const neu = hinterDenBall(S, p, p._tx);
        if (neu !== p._tx) { p._tx = neu; p._v = SPD.sprint; }
      }
      // Torwart bei einem Schuss auf sein Tor: JEDEN Tick nachführen. Über den
      // normalen Planungstakt (1,12 s) würde er gar nicht reagieren — ein Schuss
      // ist nach 0,3 s eingeschlagen.
      const flS = S.ball.flight;
      if (p.role === 'TW' && flS && flS.schuss && flS.schuss.team !== p.team) {
        const eigenes = p.dir > 0 ? 0 : L;
        p._tx = eigenes + p.dir * 1.2;
        p._ty = clamp(flS.y1, B / 2 - 8, B / 2 + 8);
        p._v = SPD.sprint;
      }
      // 9,15 m: beim ruhenden Ball hält die verteidigende Elf Abstand
      if (S.ball.ruht && p.team !== S.possession && !(S.elfmeter && p.role === 'TW')) {
        const ex = p._tx - S.ball.x, ey = p._ty - S.ball.y, ed = Math.sqrt(ex * ex + ey * ey);
        if (ed < 9.1) {
          if (ed > 0.1) { p._tx = S.ball.x + ex / ed * 9.2; p._ty = S.ball.y + ey / ed * 9.2; }
          else p._tx = S.ball.x - p.dir * 9.2;
          p._tx = clamp(p._tx, 0.5, L - 0.5); p._ty = clamp(p._ty, 0.5, B - 0.5);
        }
      }
      // Gefoult am Boden: bleibt kurz liegen
      if (p._liegtBis > S.clock) { p._vx = 0; p._vy = 0; continue; }
      const umdrehen = p._umdrehBis > S.clock;      // hohe Linie überlaufen (S.anw)
      const dx = p._tx - p.x, dy = p._ty - p.y, d = Math.sqrt(dx * dx + dy * dy);
      // Im Zeitraffer (Unterbrechung) direkt hinstellen — dort gibt es keine Physik
      if (dt > TICK) { p.x = p._tx; p.y = p._ty; p._vx = 0; p._vy = 0; continue; }
      let v = p._v || SPD.jog;
      v *= 0.86 + (p.w.schnelligkeit - 60) * 0.004;
      // KONDITION wirkt auf das Tempo: ein müder Spieler läuft die gleichen Wege
      // langsamer. Deshalb fällt der Block spät im Spiel und die Wege werden weiter.
      v *= (0.74 + 0.26 * p.kond) * anw(S, p.team).lauf;   // Zuruf: Laufbereitschaft
      if (umdrehen) v *= 0.55;

      // ENTFERNUNGSABHÄNGIGES TEMPO. Vorher lief jeder immer mindestens im Trab,
      // auch für eine Korrektur um einen halben Meter — Ergebnis: 14–18 km pro
      // Spieler statt realer 10–12 km, und optisch ein ständiges Hin und Her.
      // Echte Spieler stehen und gehen den größten Teil des Spiels.
      // NICHT zu verwechseln mit der früheren Dämpfung (v *= d/2), die JEDEN
      // dauerhaft ausbremste und die Ordnung zerstörte: hier gibt es eine
      // Totzone (auf Position = stehen bleiben) und Eilige sind ausgenommen.
      const eilig = p._press || p._v >= SPD.run || S.ball.owner === p;
      if (!eilig) {
        if (d < CFG.totzone) { p._vx *= 0.45; p._vy *= 0.45; continue; }
        if (d < 7) v = Math.min(v, SPD.walk);
        else if (d < 13) v = Math.min(v, SPD.jog * 0.66);
      }
      // Ohne Trägheit exakt das kalibrierte Verhalten: geradlinig, ohne Überschwingen
      if (p._k >= 1) {
        if (d < 0.05) continue;
        const s = Math.min(d, v * dt);
        p.x = clamp(p.x + dx / d * s, 0.5, L - 0.5);
        p.y = clamp(p.y + dy / d * s, 0.5, B - 0.5);
        zehre(p, s, v, anw(S, p.team).kraft);
        continue;
      }
      // KEINE Dämpfung in Zielnähe: sie bremst jeden Spieler dauerhaft aus, weil
      // ständig nachjustiert wird (gemessen: Schüsse 12,8 → 5,1). Das weiche
      // Anhalten übernimmt die Überschwing-Begrenzung weiter unten.
      const wx = d > 0.001 ? dx / d * v : 0, wy = d > 0.001 ? dy / d * v : 0;
      // TRÄGHEIT: Richtungs- und Tempowechsel brauchen Zeit. Ohne das läuft jeder
      // schnurgerade und dreht verzögerungsfrei — der Hauptgrund für den
      // "Schachfiguren"-Eindruck. Der Antrittsfaktor hängt nur von Tick und
      // Schnelligkeit ab, ist also einmalig vorberechnet (Math.exp im heißen
      // Pfad kostete glatt die doppelte Rechenzeit).
      p._vx += (wx - p._vx) * p._k;
      p._vy += (wy - p._vy) * p._k;
      let sx = p._vx * dt, sy = p._vy * dt;
      // NIE über das Ziel hinaus: ohne diese Begrenzung pendeln die Spieler um
      // ihre Position, die Ordnung setzt sich nie — das hat die Schusszahl
      // glatt gedrittelt (9,9 → 3,3), bis ich es gefunden hatte.
      const schritt = Math.sqrt(sx * sx + sy * sy);
      if (schritt > d) { const f = d / schritt; sx *= f; sy *= f; p._vx *= 0.4; p._vy *= 0.4; }
      p.x = clamp(p.x + sx, 0.5, L - 0.5);
      p.y = clamp(p.y + sy, 0.5, B - 0.5);
      zehre(p, Math.min(schritt, d), v, anw(S, p.team).kraft);
    }

    // 3) Ball
    if (S.ball.flight) {
      const f = S.ball.flight; f.t += dt;
      const u = Math.min(1, f.t / f.dur);
      S.ball.x = f.x0 + (f.x1 - f.x0) * u;
      S.ball.y = f.y0 + (f.y1 - f.y0) * u;
      S.ball.z = hoeheImFlug(f);
      if (f.schuss) {
        // Ein Schuss wird NICHT unterwegs abgefangen (das erledigt der Block
        // vorher) und läuft immer bis zum Einschlag durch.
        if (u >= 1) schussTrifft(S, f);
        return;
      }
      if (S.ball.x <= 0 || S.ball.x >= L || S.ball.y <= 0 || S.ball.y >= B) {
        outOfPlay(S, S.ball.x, S.ball.y, f.team != null ? f.team : S.possession);
        return;
      }
      // Abfangen unterwegs
      if (u < 0.92) {
        const foe = S.teams[1 - (f.to ? f.to.team : S.possession)];
        let grab = null;
        // Abfangen ist eine KÖNNENSFRAGE, nicht nur eine Entfernungsfrage.
        // Vorher schnappte sich der erste Gegner im Radius den Ball zu 100 % —
        // bei 114 Abfangaktionen pro Spiel war das die häufigste Aktion
        // überhaupt, und ein Weltklasse-Verteidiger fing genauso oft ab wie ein
        // Kreisligist. Stellungsspiel und Spielintelligenz entscheiden.
        // BALLHÖHE: Über Kopfhöhe kommt kein Feldspieler an den Ball, der
        // Torwart im eigenen Strafraum mit den Händen etwas höher. Per Kopf
        // wird seltener sauber abgefangen als mit dem Fuß.
        const zB = S.ball.z || 0;
        for (let i = 0; i < foe.length; i++) {
          if (dist(foe[i], S.ball) >= CFG.interceptRadius) continue;
          if (zB > CFG.reichFuss && zB > reichweite(foe[i])) continue;
          // AM ENDE DES PASSWEGS ist der Empfänger zuerst am Ball: wer hinter ihm
          // steht (weiter in Passrichtung), kann nicht abfangen, nur danach
          // angreifen — und wer neben ihm steht, kommt seltener dazwischen.
          // Vorher schnappte der Verteidiger direkt am Stürmer fast jeden Ball
          // weg (73 abgefangene Pässe je Team, sobald niemand mehr im Abseits wartete).
          let endeFaktor = 1;
          if (CFG.abseitsDeckel && f.to && u > 0.6) {
            const dxP = f.x1 - f.x0, dyP = f.y1 - f.y0, l2 = dxP * dxP + dyP * dyP || 1;
            const proj = ((foe[i].x - f.x0) * dxP + (foe[i].y - f.y0) * dyP) / l2;
            if (proj > 0.9) continue;
            endeFaktor = 0.55;
          }
          const kk = foe[i].w.defStellung * 0.5 + foe[i].w.spielintelligenz * 0.5;
          const kopfFaktor = zB > CFG.reichFuss && !(foe[i].role === 'TW' && imEigenenStrafraum(foe[i])) ? 0.55 : 1;
          const rueckFaktor = f.rueckraum ? 0.5 : 1;      // Verteidiger laufen zum eigenen Tor
          if (S.rnd() < clamp(CFG.abfangBasis * qs(kk) * kopfFaktor * rueckFaktor * endeFaktor, 0.05, 0.98)) { grab = foe[i]; break; }
        }
        if (grab) { S.ev.push({ t: S.clock, type: 'intercept', side: grab.team ? 'away' : 'home', player: grab, x: S.ball.x, y: S.ball.y });
                    giveBall(S, grab); return; }
      }
      if (u >= 1) {
        // ABSEITS: Der Ball erreicht den Spieler, der beim Abspiel im Abseits stand
        // — jetzt greift er ins Spiel ein, jetzt wird gepfiffen.
        if (f.abseits) {
          const sp = f.abseits.spieler;
          if (!sp._runter && Math.hypot(sp.x - S.ball.x, sp.y - S.ball.y) < 4) { abseitsPfiff(S, f); return; }
        }
        const ziel = f.to || nearestToBall(S);
        // ── FLANKE IM STRAFRAUM ────────────────────────────────────────────
        // Bisher landete jede Flanke einfach beim Zielspieler und der schoss
        // dann irgendwann. Weder der Torwart noch die Innenverteidiger kamen
        // je zum Kopfball — Ecken waren dadurch harmlos, obwohl es 9,5 pro
        // Spiel gibt, und der Standardspezialist-Wert lag brach.
        if (f.kind === 'cross' && ziel && ziel.role !== 'TW') {
          const flanke = flankenDuell(S, ziel, f.from, f);
          if (flanke) return;
        }
        // Hoher Ball oder Pass in den Lauf: an der Landestelle entscheidet sich,
        // wer ihn bekommt (Annahme, Kopfballduell, Laufduell).
        if (CFG.prinzipien.ballhoehe && (f.bahn === 'hoch' || f.lauf) && f.kind !== 'cross') {
          S.ball.z = 0;
          if (landung(S, f)) return;
        }
        giveBall(S, ziel);
      }
      return;
    }

    // Wer gewinnt den Ball in der Luft — Torwart, Verteidiger oder Angreifer?
    function flankenDuell(S, ziel, geber, f) {
      const teamIdx = ziel.team;
      const torX = ziel.dir > 0 ? L : 0;
      const zumTor = Math.abs(ziel.x - torX);
      if (zumTor > 20) return false;                 // zu weit draußen für ein Luftduell
      // FLACHE, SCHARFE HEREINGABE (halbhoch): kein Kopfball und kein Herauslaufen
      // des Torwarts — der Ball kommt auf Hüfthöhe, es entscheidet der erste Kontakt.
      if (CFG.prinzipien.ballhoehe && f && f.bahn === 'halbhoch') {
        const foesF = S.teams[1 - teamIdx];
        let gegF = null, gdF = 1e9;
        for (let i = 0; i < foesF.length; i++) {
          if (foesF[i].role === 'TW') continue;
          const d = dist(foesF[i], ziel);
          if (d < gdF) { gdF = d; gegF = foesF[i]; }
        }
        const naeheF = gegF ? clamp(1 - gdF / 6, 0, 1) : 0;
        const pAbschluss = clamp(0.52 + (ziel.w.schiessen - (gegF ? gegF.w.defStellung : 50)) * 0.010 - naeheF * 0.30, 0.10, 0.78);
        if (S.rnd() >= pAbschluss) {
          if (gegF) { S.ev.push({ t: S.clock, type: 'klaerung', side: gegF.team ? 'away' : 'home', player: gegF, x: S.ball.x, y: S.ball.y }); giveBall(S, gegF); }
          else giveBall(S, nearestToBall(S));
          return true;
        }
        const xgF = clamp(xgAt(S, ziel) * 0.95, 0.02, 0.60);
        shoot(S, ziel, xgF);
        return true;
      }

      // 1) TORWART: Er kann herauskommen und die Flanke abfangen. Bisher blieb
      //    er grundsätzlich auf der Linie. Nähe zum Ball, Strafraumbeherrschung
      //    und Ruhe entscheiden.
      const tw = S.teams[1 - teamIdx].find(p => p.role === 'TW');
      if (tw) {
        const twDist = dist(tw, S.ball);
        if (twDist < 11) {
          const guete = (tw.w.reflexe * 0.35 + tw.w.spielintelligenz * 0.35 + tw.w.kopfball * 0.30);
          const p = clamp(CFG.flanke.twFang * qs(guete) - twDist * 0.030 - S.rnd() * 0.10, 0.05, 0.72);
          if (S.rnd() < p) {
            S.ev.push({ t: S.clock, type: 'twfang', side: tw.team ? 'away' : 'home',
                        player: tw, x: S.ball.x, y: S.ball.y });
            giveBall(S, tw);
            S.deadUntil = S.clock + 8 + S.rnd() * 10;
            return true;
          }
        }
      }

      // 2) KOPFBALLDUELL gegen den nächsten Verteidiger
      const foes = S.teams[1 - teamIdx];
      let geg = null, gd = 1e9;
      for (let i = 0; i < foes.length; i++) {
        if (foes[i].role === 'TW') continue;
        const d = dist(foes[i], ziel);
        if (d < gd) { gd = d; geg = foes[i]; }
      }
      // `sprungkraft` gibt es im Attributsatz NICHT — mit ihr wurde die ganze
      // Rechnung NaN, jeder Vergleich fiel durch und der Angreifer gewann jedes
      // Luftduell: 12 Kopfbälle pro Spiel, null Klärungen.
      const angriff = ziel.w.kopfball * 0.7 + ziel.w.kraft * 0.3;
      const abwehr = geg ? (geg.w.kopfball * 0.5 + geg.w.kraft * 0.2 + geg.w.defStellung * 0.3) : 40;
      const naehe = geg ? clamp(1 - gd / 8, 0, 1) : 0;       // eng am Mann = schwerer
      // Grundwert 0,34: In der Luft ist der Verteidiger im Vorteil, er darf
      // klären, der Angreifer muss treffen.
      const gewinnt = clamp(0.42 + (angriff - abwehr) * 0.016 - naehe * 0.20, 0.05, 0.82);

      if (S.rnd() >= gewinnt) {
        // Verteidiger kommt zuerst an den Ball — aber ein geklärter Kopfball
        // fliegt selten sauber ins Aus. In gut einem Drittel der Fälle fällt er
        // im Strafraum herunter und der Angriff geht weiter. Ohne diesen zweiten
        // Ball erstickte jede Flanke sofort: Tore fielen von 2,21 auf 1,46,
        // Schüsse von 24,8 auf 15,0.
        if (geg) {
          S.ev.push({ t: S.clock, type: 'klaerung', side: geg.team ? 'away' : 'home',
                      player: geg, x: S.ball.x, y: S.ball.y });
        }
        if (S.rnd() < 0.38) {
          S.ball.x = clamp(ziel.x - ziel.dir * (2 + S.rnd() * 7), 2, L - 2);
          S.ball.y = clamp(ziel.y + (S.rnd() - 0.5) * 14, 2, B - 2);
          S.ball.flight = null;
          giveBall(S, nearestToBall(S));
          S.nextDecide = S.clock + 0.25;
        } else if (geg) giveBall(S, geg);
        else giveBall(S, nearestToBall(S));
        return true;
      }

      // 3) KOPFBALL AUFS TOR. Qualität aus Position und Kopfballstärke.
      const basisXg = xgAt(S, ziel) * 0.85;                  // Kopfball etwas schwerer
      const xg = clamp(basisXg * (0.75 + (ziel.w.kopfball - 60) * 0.008), 0.02, 0.55);
      S.ev.push({ t: S.clock, type: 'kopfball', side: teamIdx ? 'away' : 'home',
                  player: ziel, x: ziel.x, y: ziel.y, xg: xg });
      S._kopfSchuss = true;                          // Abschluss startet auf Kopfhöhe
      shoot(S, ziel, xg);
      return true;
    }

    // 4) Ball am Fuß: Zweikampf und Entscheidung
    const c = S.ball.owner;
    if (!c) {
      // RUHENDER BALL: freigegeben wird erst, wenn die Unterbrechung vorbei ist
      // UND der Schütze am Ball steht. Bis dahin liegt der Ball still.
      if (S.ball.ruht) {
        const r = S.ball.ruht;
        if (r.taker._runter) {                       // Schütze vom Platz gestellt: der Nächste übernimmt
          const arr = S.teams[r.taker.team];
          let nb = arr[0], nd = 1e9;
          for (let i = 0; i < arr.length; i++) { const d = dist(arr[i], S.ball); if (arr[i].role !== 'TW' && d < nd) { nd = d; nb = arr[i]; } }
          r.taker = nb;
          if (S.freistoss) S.freistoss.taker = nb;
          if (S.elfmeter) S.elfmeter.schuetze = nb;
        }
        if (S.clock >= S.deadUntil) {
          const tk = r.taker;
          // wartet auf den Schützen (höchstens gut 4 s, dann wird freigegeben)
          if (dist(tk, S.ball) > 1.3 && (r.warten = (r.warten || 0) + 1) < 15) { S.deadUntil = S.clock + TICK; return; }
          tk.x = S.ball.x - tk.dir * 0.6; tk.y = S.ball.y;
          const bx = S.ball.x, by = S.ball.y;
          giveBall(S, tk);
          S.ball.x = bx; S.ball.y = by;
          S.nextDecide = S.clock + 0.3 + S.rnd() * 0.4;
        }
        return;
      }
      if (S.ball.frei && S.clock < S.ball.frei.bis) {
        // Freier Ball: wer nah genug dran ist, nimmt ihn
        let best = null, bd = 1e9;
        for (let i = 0; i < S.players.length; i++) {
          const d = dist(S.players[i], S.ball);
          if (d < bd) { bd = d; best = S.players[i]; }
        }
        if (bd <= CFG.controlRadius + 0.3) { S.ball.frei = null; giveBall(S, best); }
        return;
      }
      S.ball.frei = null;
      giveBall(S, nearestToBall(S)); return;
    }
    S.ball.x = c.x + c.dir * 0.6; S.ball.y = c.y; S.ball.z = 0;
    if (S.clock < S.deadUntil) return;                       // Spielunterbrechung
    S.stats[c.team].poss += dt;

    // Zweikampf — erst wenn der Ball wieder läuft
    const foes = S.teams[1 - c.team];
    let tackler = null;
    for (let i = 0; i < foes.length; i++) {
      if (S.clock < (foes[i]._ausgespielt || 0)) continue;   // ausgespielt = kein Zugriff
      if (dist(foes[i], c) < CFG.tackleRadius) { tackler = foes[i]; break; }
    }
    if (tackler) {
      // Wer dribbelt, ist angreifbarer als wer den Ball abschirmt.
      const drib = S.clock < (c._dribUntil || 0) ? 1.7 : 1;
      // Im Gegenpressing wird reingegangen statt abgewartet („Reingehen, blocken,
      // dazukommen, drinbleiben"). Ohne diesen Zuschlag stellt SARD nur Körper
      // in Ballnähe und die Rückeroberungsquote bewegt sich kaum (26,0 → 26,8 %).
      const sard = S.gp && S.gp.team === tackler.team && S.clock < S.gp.bis ? CFG.sardBiss : 1;
      // Mit „Zeit am Ball" spielt der Bedrängte schneller ab und steht damit
      // kürzer im Zweikampf — ohne Ausgleich fielen die Zweikämpfe um die Hälfte
      // (Zählbogen: 29 → 13 je Team). Wer drankommt, geht deshalb entschlossener rein.
      const zeitFaktor = CFG.prinzipien.zeitAmBall ? CFG.zweikampfUnterDruck : 1;
      const AWt = anw(S, tackler.team);
      const pWin = CFG.tacklePerTick * zeitFaktor * drib * sard * AWt.zweikampf * (0.9 + 0.1 * AWt.haerte) * tackler.kond * q(tackler.w.tackling * 0.7 + tackler.w.defEinsGegenEins * 0.3) / q(c.w.dribbling * 0.6 + c.w.kraft * 0.4);
      if (S.rnd() < pWin) {
        if (CFG.regeln.foulsEcht) { zweikampfEntscheiden(S, tackler, c, drib > 1); return; }
        if (S.rnd() < CFG.foulOnTackle) {                   // Foul
          S.stats[tackler.team].fouls++;
          S.ev.push({ t: S.clock, type: 'foul', side: tackler.team ? 'away' : 'home', x: c.x, y: c.y });
          if (S.rnd() < 0.17) { S.stats[tackler.team].yellow++;
            S.ev.push({ t: S.clock, type: 'yellow', side: tackler.team ? 'away' : 'home', player: tackler, x: c.x, y: c.y }); }
          freistoss(S, c, tackler.team);
        } else {
          S.ev.push({ t: S.clock, type: 'tackle', side: tackler.team ? 'away' : 'home', player: tackler, x: c.x, y: c.y });
          giveBall(S, tackler);
        }
        return;
      }
    }

    // ELFMETER ausführen, sobald der Ball freigegeben ist. Ein Elfmeter hat IMMER
    // xG 0,80 (Vorgabe Nutzer 2026-10-09). Die Trefferquote schwankt nur leicht um
    // 0,80: Schießen des Schützen gegen die Güte des Torwarts. Der Torwart zählt nur
    // hier – vorher rechnete shoot() ihn ein zweites Mal ein (gemessen 65 % Treffer).
    if (S.elfmeter && S.clock >= S.elfmeter.bis) {
      const sch = S.elfmeter.schuetze; S.elfmeter = null;
      if (S.ball.owner === sch) {
        const gk = S.teams[1 - sch.team].find(p => p.role === 'TW');
        const guete = gk ? (gk.w.reflexe * 0.6 + gk.w.paraden * 0.4) : 70;
        S._elfmeterSchuss = clamp(0.80 + (sch.w.schiessen - guete) * 0.004, 0.68, 0.90);   // Trefferquote
        if (CFG.regeln.freistossEcht) S.ev.push({ t: S.clock, type: 'ausfuehrung', side: sch.team ? 'away' : 'home', player: sch, art: 'elfmeter', x: S.ball.x, y: S.ball.y });
        shoot(S, sch, 0.80);
        return;
      }
    }
    // ZEIT AM BALL: Kommt ein Gegner auf unter 2 m heran, bleibt keine Zeit
    // mehr, in Ruhe die beste Anspielstation zu suchen — bisher hielt der
    // Ballführende den Ball immer 1,75–3,9 s, egal wie eng es war. Wer gut
    // dribbelt und kräftig ist, behauptet ihn etwas länger.
    if (CFG.prinzipien.zeitAmBall && S.nextDecide - S.clock > 0.6 && S._gekuerzt !== S.nextDecide) {
      for (let i = 0; i < foes.length; i++) {
        if (S.clock < (foes[i]._ausgespielt || 0) || foes[i].role === 'TW') continue;
        if (dist(foes[i], c) < 2.0) {
          const halten = clamp(0.30 + S.rnd() * 0.35 + (c.w.dribbling * 0.5 + c.w.kraft * 0.5 - 60) * 0.008, 0.2, 0.9);
          S.nextDecide = Math.min(S.nextDecide, S.clock + halten);
          S._gekuerzt = S.nextDecide;
          c._gehetzt = S.nextDecide + 0.1;          // gehetzte Entscheidung: ungenauer (passBall)
          break;
        }
      }
    }
    // „jetzt!": Läufe in die Tiefe starten, BEVOR der Ball gespielt wird
    if (CFG.prinzipien.timingStart) laeufeStarten(S, c);
    if (S.clock < S.nextDecide) return;

    // FREISTOSS-AUSFÜHRUNG: direkt aufs Tor oder Flanke in den Strafraum.
    // Kurze Freistöße spielt der Schütze wie jeden anderen Ball (decide).
    const fsA = S.freistoss;
    if (fsA && fsA.auftrag && fsA.taker === c && !fsA.ausgefuehrt) {
      fsA.ausgefuehrt = true;
      // Moment der Ausführung — für die Darstellung (Mauer springt, Anlauf)
      if (fsA.art !== 'kurz') {
        const mauerIdx = [];
        for (const k in fsA.auftrag) if (fsA.auftrag[k].typ === 'mauer') mauerIdx.push(+k);
        S.ev.push({ t: S.clock, type: 'ausfuehrung', side: c.team ? 'away' : 'home', player: c,
                    art: fsA.art, mauerIdx: mauerIdx, x: S.ball.x, y: S.ball.y });
      }
      if (fsA.art === 'direkt') { freistossSchuss(S, c, fsA); return; }
      if (fsA.art === 'flanke' && freistossFlanke(S, c, fsA)) return;
    }

    const d = decide(S, c);
    if (d.t === 'shoot') shoot(S, c, d.xg);
    else if (d.t === 'cross') passBall(S, c, d.to, 'cross', d);
    else if (d.t === 'pass') passBall(S, c, d.to, d.through ? 'through' : (d.long ? 'long' : 'pass'), d);
    else if (d.t === 'clear') {
      const mine = S.teams[c.team];
      let far = c, bestX = -1e9;
      for (let i = 0; i < mine.length; i++) {
        const p = mine[i]; if (p.role === 'TW') continue;
        const v = p.x * c.dir; if (v > bestX) { bestX = v; far = p; }
      }
      // Geklärt wird unter Druck — je enger es wird und je näher am eigenen Tor,
      // desto eher fliegt der Ball über die eigene Grundlinie. Das war bisher
      // gar nicht möglich; Ecken entstanden nur aus geblockten Schüssen und
      // abgefausteten Bällen (6,4 statt real 9–11 pro Spiel).
      const eigenesTor = c.dir > 0 ? 0 : L;
      const zumTor = Math.abs(c.x - eigenesTor);
      // Auf 0,09 kalibriert: bei 0,30 sprangen die Ecken auf 22 pro Spiel.
      // Mit den Spielprinzipien steht öfter jemand unter Druck am eigenen Tor —
      // Grundwert deshalb 0,07 statt 0,09, sonst 6,5 statt ~5 Ecken je Team.
      const pAus = clamp(0.07 - zumTor * 0.004 + pressureOn(S, c) * 0.025
                         - (c.w.defStellung - 70) * 0.002, 0.01, 0.20);
      if (S.rnd() < pAus) {
        S.ev.push({ t: S.clock, type: 'clear', side: c.team ? 'away' : 'home', player: c, x: c.x, y: c.y });
        outOfPlay(S, eigenesTor, S.rnd() < 0.5 ? -1 : B + 1, c.team);
        return;
      }
      passBall(S, c, far, 'clear');
      S.ev.push({ t: S.clock, type: 'clear', side: c.team ? 'away' : 'home', player: c, x: c.x, y: c.y });
    } else if (d.t === 'takeon') {
      // ECHTES DRIBBLING GEGEN EINEN MANN: gelingt es, ist der Gegenspieler
      // ausgespielt und für kurze Zeit aus dem Spiel — misslingt es, ist der
      // Ball weg. Vorher konnte ein Dribbling niemanden überwinden.
      const g = d.geg;
      let winkel = 0;
      if (CFG.prinzipien.schraegDrauf) {
        // Frontal angelaufen kann der Ballführer zu beiden Seiten heraus; wer
        // schräg von innen kommt, lässt nur noch den Weg nach außen offen.
        const vx = g.x - c.x, vy = g.y - c.y;
        const th = Math.atan2(Math.abs(vy), vx * c.dir);
        const innen = Math.abs(c.y - B / 2) < 5 || Math.sign(vy) === Math.sign(B / 2 - c.y);
        if (th < 0.44) winkel = 0.05;
        else if (th < 1.22 && innen) winkel = -0.05;
      }
      if (CFG.prinzipien.werSichert) {
        // „wer sichert?": steht hinter dem Anläufer ein Absichernder, ist der
        // Weg nach dem Dribbling gleich wieder zu.
        const gg = S.teams[1 - c.team];
        for (let i = 0; i < gg.length; i++) {
          const o = gg[i];
          if (o === g || o.role === 'TW') continue;
          const tief = (o.x - c.x) * c.dir;
          if (tief > 2 && tief < 9 && Math.abs(o.y - c.y) < 7) { winkel -= 0.08; break; }
        }
      }
      const p = clamp(0.42 + winkel + ((c.w.offEinsGegenEins * 0.6 + c.w.dribbling * 0.4) - (g.w.defEinsGegenEins * 0.7 + g.w.tackling * 0.3)) * 0.011, 0.16, 0.80);
      const seit = 0.7 + S.rnd() * 0.6;
      if (S.rnd() < p) {
        g._ausgespielt = S.clock + 1.8;              // steht kurz falsch, presst nicht
        c._dribUntil = S.clock + seit;
        c._dtx = clamp(g.x + c.dir * 5.5, 1.5, L - 1.5);
        c._dty = clamp(c.y + (c.y < g.y ? -3.5 : 3.5), 2, B - 2);
        S.nextDecide = S.clock + seit;
        S.ev.push({ t: S.clock, type: 'dribble', side: c.team ? 'away' : 'home',
                    player: c, gegen: g, x: c.x, y: c.y, ok: true });
      } else {
        S.ev.push({ t: S.clock, type: 'dribble', side: c.team ? 'away' : 'home',
                    player: c, gegen: g, x: c.x, y: c.y, ok: false });
        giveBall(S, g);
      }
    } else {
      // Dribbling: begrenzter Antritt in den freien Raum, danach wird neu entschieden.
      const raum = Math.min(spaceAhead(S, c), 9);
      const seit = 0.5 + S.rnd() * 0.7;
      c._dribUntil = S.clock + seit;
      c._dtx = clamp(c.x + c.dir * raum, 1.5, L - 1.5);
      c._dty = clamp(c.y + (S.rnd() - 0.5) * 8, 2, B - 2);
      if (CFG.prinzipien.schraegDrauf) {
        // Das Dribbling geht WEG vom nächsten Gegner — steht der schräg innen,
        // bleibt nur der Weg nach außen. Vorher war die Richtung reiner Zufall.
        const gg = S.teams[1 - c.team];
        let n = null, nd = 5;
        for (let i = 0; i < gg.length; i++) { const d2 = dist(gg[i], c); if (d2 < nd) { nd = d2; n = gg[i]; } }
        if (n) c._dty = clamp(c.y + (c.y >= n.y ? 1 : -1) * (2 + S.rnd() * 3), 2, B - 2);
      }
      // NACH INNEN (D66): diagonal Richtung Strafraum statt geradeaus an der Linie entlang
      if (d.innen) {
        const zurMitte = c.y < B / 2 ? 1 : -1;
        c._dty = clamp(c.y + zurMitte * (4 + S.rnd() * 4), 2, B - 2);
        c._dtx = clamp(c.x + c.dir * Math.max(1.5, raum * 0.5), 1.5, L - 1.5);
      }
      S.ev.push({ t: S.clock, type: 'dribble', side: c.team ? 'away' : 'home', player: c, x: c.x, y: c.y, ok: true, innen: d.innen || undefined });
      S.nextDecide = S.clock + seit;
    }
  }

  // ── Spiel ──────────────────────────────────────────────────────────────────
  function simulateMatch(home, away, opt) {
    opt = opt || {};
    // PC-Live (kickstil_pc_spieltag.js): das Spiel wurde schon Stück für Stück gerechnet – zum Buchen nur noch zurückgeben
    if (opt.vorgerechnet && opt.vorgerechnet._S) return opt.vorgerechnet;
    const S = {
      rnd: rngFrom(opt.seed != null ? opt.seed : (Math.random() * 1e9) | 0),
      clock: 0, ev: [], deadUntil: 0, nextDecide: 0, lastPasser: null,
      ball: { x: L / 2, y: B / 2, z: 0, owner: null, flight: null },
      possession: 0, gp: null, possSince: 0, freistoss: null, elfmeter: null,
      // „nachrücken!": je Team ein laufendes Rausschieben { bis, x, y } oder null
      schieben: [null, null],
      // Verzögerte Ballwahrnehmung + Reaktionsrate je Team (1/s)
      slow: [{ x: L / 2, y: B / 2 }, { x: L / 2, y: B / 2 }],
      reakt: [0.55, 0.55], _plan: -1, _phase: 0,   // −1 → im allerersten Tick wird geplant
      // Heimvorteil: opt.homeAdv 'H' = Team 0 spielt zu Hause, 'A' = Team 1,
      // null/neutral = keiner (Finale auf neutralem Platz). Standard 'H', weil
      // der Aufrufer die Heimmannschaft konventionsgemäß zuerst übergibt.
      heim: (opt.homeAdv === null || opt.homeAdv === 'neutral') ? [0, 0]
          : (opt.homeAdv === 'A') ? [0, 1] : [1, 0],
      // Spielstil (D55): opt.stilFaktor = [Team 0, Team 1] als Faktor (1 = ohne Wirkung), sonst keiner
      stil: Array.isArray(opt.stilFaktor) && opt.stilFaktor.length === 2 && opt.stilFaktor.every(x => typeof x === 'number' && x > 0.5 && x < 1.5)
        ? opt.stilFaktor.slice() : null,
      // Torfaktor: opt.torFaktor = [Team 0, Team 1] wirkt nur auf den Ausgang der Abschlüsse (Brücke zur KI-Formel, dfl_engine_patch.js)
      tor: Array.isArray(opt.torFaktor) && opt.torFaktor.length === 2 && opt.torFaktor.every(x => typeof x === 'number' && x > 0.1 && x < 4)
        ? opt.torFaktor.slice() : null,
      // Anweisungen je Team (PC-Live-Coaching, siehe ANW0): opt.anw = [Team 0, Team 1], Einträge dürfen null sein
      anw: Array.isArray(opt.anw) && opt.anw.length === 2 ? opt.anw.map(a => a ? Object.assign({}, ANW0, a) : null) : null,
      _tor: { x: 0, y: 0 }, setPiece: null,    // wiederverwendetes Hilfsziel, Standardsituation
      // D118: opt.standard = [Team 0, Team 1] – Faktor auf Abschlüsse aus Standards (Standardtrainer), sonst keiner
      standard: Array.isArray(opt.standard) && opt.standard.length === 2 && opt.standard.every(x => typeof x === 'number' && x > 0.5 && x < 1.5)
        ? opt.standard.slice() : null, _std: null,
      stats: [mkStats(), mkStats()]
    };
    S.players = buildSide(home, 0, +1).concat(buildSide(away, 1, -1));
    // Alle 22 in fester Reihenfolge — für Aufzeichnung und Ergebnis. S.players
    // verliert bei einem Platzverweis den Spieler, S.alle nie.
    S.alle = S.players.slice();
    // Vorberechnete Listen für den heißen Pfad (keine Allokationen im Tick)
    S.teams = [S.players.filter(p => p.team === 0), S.players.filter(p => p.team === 1)];
    S.backs = [S.teams[0].filter(p => p.role === 'IV' || p.role === 'AV'),
               S.teams[1].filter(p => p.role === 'IV' || p.role === 'AV')];
    // SCHIENEN (D66): Außenverteidiger einer Elf mit drei Innenverteidigern (3-5-2, 5-3-2, 5-4-1, 5-2-3)
    for (let t = 0; t < 2; t++) {
      const drei = S.teams[t].filter(p => p.role === 'IV').length >= 3;
      S.teams[t].forEach(p => { p._schiene = drei && p.role === 'AV'; });
    }
    S._line = [L - 20, 20];
    for (let i = 0; i < S.players.length; i++) {
      const p = S.players[i];
      p._i = i;
      p._ph = i % CFG.phasen;                                   // eigener Planungstakt
      p._vx = 0; p._vy = 0;                            // Laufgeschwindigkeit (Trägheit)
      // Persönliche Positionsabweichung — je besser das Stellungsspiel, desto
      // kleiner. Ein 85er-Innenverteidiger steht dichter am Ideal als ein 55er.
      const stell = p.role === 'TW' ? 70
        : (p.role === 'ST' || p.role === 'FL' ? p.w.offStellung : p.w.defStellung);
      const genau = clamp(1 - (stell - 70) * 0.012, 0.45, 1.6);
      p._bx = (S.rnd() - 0.5) * 3.0 * CFG.eigenart * genau;
      p._by = (S.rnd() - 0.5) * 3.4 * CFG.eigenart * genau;
      p._tx = p.hx; p._ty = p.hy; p._v = SPD.jog;      // Startziel, sonst NaN im ersten Takt
      p._k = CFG.traegheit ? 1 - Math.exp(-TICK / (CFG.traegheit - (p.w.schnelligkeit - 60) * 0.0013)) : 1;   // Antritt
      // Staffelung + Einlaufposition. MUSS über den Index INNERHALB der Elf
      // laufen: mit dem globalen Index (0…21) bekäme Team 2 eine um drei
      // verschobene Zuteilung und damit eine andere Strafraumbesetzung —
      // gemessen als 2,03:1,37 bei eigentlich gleich starken Mannschaften.
      // Kondition: Startwert aus der Fitness des echten Spielers (falls vorhanden),
      // Verbrauchsrate leicht nach Qualität gestaffelt — bessere Spieler halten länger.
      const roh = fitnessVon(p._ref, 92);
      p.kond = clamp(roh / 100, 0.55, 1);
      p.kond0 = p.kond;
      // Laufwunder und Konditionsschwache verbrauchen unterschiedlich viel —
      // im Halbzeit-Panel sieht man das direkt am Kraftwert.
      const kondT = (typeof window.traitKondFaktor === 'function') ? window.traitKondFaktor(p._ref) : 1;
      p._kondK = CFG.kondVerbrauch * (1.16 - (p.w.ausdauer - 60) * 0.004) * kondT;
      p._staffel = (i % 11) % 4;
      p._rest = false;
    }
    // Restverteidigung festlegen: beide Innenverteidiger plus der tiefste
    // zentrale Mittelfeldspieler (der Sechser) bleiben hinter dem Ball.
    for (let t = 0; t < 2; t++) {
      const arr = S.teams[t];
      let sechser = null, tiefstes = 1e9;
      for (let i = 0; i < arr.length; i++) {
        const p = arr[i];
        if (p.role === 'IV') p._rest = true;
        if (p.role === 'ZM') {
          const tief = p.dir > 0 ? p.hx : L - p.hx;    // Abstand zum eigenen Tor
          if (tief < tiefstes) { tiefstes = tief; sechser = p; }
        }
      }
      if (sechser) sechser._rest = true;
    }
    // Ersatzbank + Wechselzeiten (nur in Unterbrechungen ausgeführt)
    S.bank = [(home.bench || []).slice(0, 9), (away.bench || []).slice(0, 9)];
    S.wPlan = [[], []];
    for (let t = 0; t < 2; t++) {
      const n = Math.min(CFG.wechselMax, S.bank[t].length);
      for (let i = 0; i < n; i++) {
        S.wPlan[t].push(3250 + i * 620 + S.rnd() * 380);      // ca. 55., 65., 76. Minute
      }
      S.wPlan[t].sort((a, b) => a - b);
    }
    if (opt.record) {
      S.rec = new Float32Array((Math.ceil((CFG.matchSeconds + CFG.nachspielzeit + 24) / TICK) + 8) * STRIDE);
      S.recN = 0;
    }
    kickoff(S, 0);
    S._guard = 0;
    // HALBZEIT: Mit opt.stopBei hält die Simulation bei der angegebenen
    // Spielsekunde an und gibt den Zustand mit zurück. fortsetzen(S) rechnet
    // später in DIESELBE Aufzeichnung weiter — der Film bleibt dadurch
    // lückenlos, und dazwischen kann eingewechselt und umgestellt werden.
    // Ohne stopBei läuft alles wie bisher in einem Zug durch.
    if (opt.stopBei > 0) {
      laufeBis(S, opt.stopBei);
      return zwischenstand(S);
    }
    return zuEnde(S);
  }

  function laufeBis(S, bis) {
    while (S.clock < bis && S._guard++ < 60000) { step(S); if (S.rec) writeFrame(S); }
  }
  function ergebnisAus(S, fertig) {
    return { score: [S.stats[0].goals, S.stats[1].goals],
             stats: { home: S.stats[0], away: S.stats[1] }, events: S.ev, players: S.alle || S.players,
             frames: S.rec || null, frameCount: S.recN || 0, stride: STRIDE,
             fertig: !!fertig, _S: S };
  }
  function zwischenstand(S) { return ergebnisAus(S, false); }
  // PC-Live (kickstil_pc_spieltag.js, 2026-10-18): Stück für Stück weiterrechnen – bis zur Sekunde `bis`, dann wieder halten.
  function weiterBis(S, bis) { laufeBis(S, bis); return zwischenstand(S); }

  // NACHSPIELZEIT: nach 90 Minuten wird nicht hart abgeschnitten. Es läuft eine
  // Minute weiter, und wenn dann noch ein Angriff läuft, wird er zu Ende
  // gespielt (max. 20 s Zugabe) — sonst endet das Spiel mitten in einer Szene.
  function zuEnde(S) {
    const ende = CFG.matchSeconds + CFG.nachspielzeit;
    laufeBis(S, ende);
    const spaetestens = ende + 20;
    while (S.clock < spaetestens && S._guard++ < 60000 && imAngriff(S)) {
      step(S); if (S.rec) writeFrame(S);
    }
    S.nachspielzeit = CFG.nachspielzeit;
    const p0 = S.stats[0].poss, p1 = S.stats[1].poss, tp = Math.max(1, p0 + p1);
    S.stats[0].possPct = Math.round(p0 / tp * 100);
    S.stats[1].possPct = 100 - S.stats[0].possPct;
    return ergebnisAus(S, true);
  }

  // ── Eingriffe in der Pause ────────────────────────────────────────────────
  // Wer auf dem Platz steht (mit Kondition, damit man sieht, wem die Luft ausgeht)
  function aufstellungVon(S, teamIdx) {
    return (S.teams[teamIdx] || []).map(function (p) {
      return { i: p._i, name: p.name, num: p.num, pos: p.pos, role: p.role,
               ovr: p.ovr, kond: Math.round((p.kond || 0) * 100) };
    });
  }
  function bankVon(S, teamIdx) {
    return (S.bank[teamIdx] || []).map(function (p, i) {
      return { i: i, name: p.name, num: p.num, pos: p.pos, ovr: p.ovr || 60 };
    });
  }
  // Gezielter Wechsel. Nutzt denselben Weg wie die Engine selbst: der Spieler
  // auf dem Platz wird ÜBERSCHRIEBEN, sein Index bleibt. Der muss stabil sein,
  // weil die Aufzeichnung 22 feste Plätze hat.
  function wechselAusfuehren(S, teamIdx, spielerIndex, bankIndex) {
    const arr = S.teams[teamIdx], bank = S.bank[teamIdx];
    if (!arr || !bank || !bank[bankIndex]) return false;
    const raus = arr.filter(function (p) { return p._i === spielerIndex; })[0];
    if (!raus || raus.role === 'TW') return false;
    const rein = bank.splice(bankIndex, 1)[0];
    eventsEinfrieren(S, raus);
    const alt = raus.name, vorherRef = raus._ref;
    raus.name = rein.name || alt;
    if (rein.num) raus.num = rein.num;
    raus.att = rein.att || 55; raus.mid = rein.mid || 55; raus.def = rein.def || 55;
    raus.pace = rein.pace || 55;
    raus.tec = (rein.technik != null ? rein.technik : rein.mid) || 55;
    raus.ovr = rein.ovr || 60; raus._ref = rein;
    raus.w = werteVon(rein);
    raus._gelb = false; raus._fouls = 0;
    raus.kond = clamp(fitnessVon(rein, 97) / 100, 0.7, 1);
    raus._kondK = CFG.kondVerbrauch * (1.16 - (raus.w.ausdauer - 60) * 0.004);
    raus._k = CFG.traegheit ? 1 - Math.exp(-TICK / (CFG.traegheit - (raus.w.schnelligkeit - 60) * 0.0013)) : 1;
    S.ev.push({ t: S.clock, type: 'wechsel', side: teamIdx ? 'away' : 'home',
                player: raus, ein: raus.name, aus: alt, x: raus.x, y: raus.y,
                // refAus hält den Spieler fest, der den Platz verlässt — sonst
                // ließen sich seine Aktionen aus der Aufzeichnung nicht mehr
                // zuordnen, weil das Objekt danach überschrieben ist.
                refAus: vorherRef, slot: raus._i });
    // Ein Wechsel ist ein Wechsel: das nimmt der Engine eines ihrer geplanten
    // Kontingente weg, sonst stünden am Ende mehr als drei im Protokoll.
    if (S.wPlan && S.wPlan[teamIdx] && S.wPlan[teamIdx].length) S.wPlan[teamIdx].shift();
    return true;
  }
  // FORMATION IM SPIEL UMSTELLEN (PC-Live-Coaching, 2026-10-20): plaetze[k] = { pos, platz, px, py } für S.teams[t][k]
  // (Reihenfolge wie aufstellungVon, null = bleibt). Neue Grundposition, Rolle und Detailwerte für den neuen Platz, danach
  // Kette, Schienen und Restverteidigung neu wie beim Anpfiff (Vorbild: Umstellung nach einem Platzverweis). Torhüter bleiben,
  // _i bleibt (feste Plätze in der Aufzeichnung).
  function formationSetzen(S, t, plaetze) {
    const arr = S.teams[t]; if (!arr || !Array.isArray(plaetze)) return false;
    let n = 0;
    arr.forEach(function (p, k) {
      const z = plaetze[k];
      if (!z || p.role === 'TW' || z.pos === 'TW' || typeof z.px !== 'number' || typeof z.py !== 'number') return;
      p.hx = p.dir > 0 ? (z.px / 100) * L : L - (z.px / 100) * L;
      p.hy = p.dir > 0 ? (z.py / 100) * B : B - (z.py / 100) * B;
      p.role = ROLE[z.pos] ? z.pos : 'ZM'; p.pos = z.pos; p._platz = z.platz;
      if (p._ref && typeof window !== 'undefined' && window.spielerWerte) { const w = werteVon({ _ref: p._ref, platz: z.platz, pos: z.pos }); if (w) p.w = w; }
      n++;
    });
    S.backs[t] = arr.filter(function (p) { return p.role === 'IV' || p.role === 'AV'; });
    const drei = arr.filter(function (p) { return p.role === 'IV'; }).length >= 3;
    let sechser = null, tiefstes = 1e9;
    arr.forEach(function (p) {
      p._schiene = drei && p.role === 'AV';
      p._rest = p.role === 'IV';
      if (p.role === 'ZM') { const tief = p.dir > 0 ? p.hx : L - p.hx; if (tief < tiefstes) { tiefstes = tief; sechser = p; } }
    });
    if (sechser) sechser._rest = true;
    return n > 0;
  }
  // Blockhöhe verschieben: die Grundposition jedes Feldspielers wandert um
  // `meter` Richtung gegnerisches Tor (positiv) oder eigenes (negativ). Genau
  // das meint „offensiver" bzw. „defensiver" räumlich — und die Engine rechnet
  // ab dem nächsten Takt damit weiter.
  function blockVerschieben(S, teamIdx, meter) {
    const arr = S.teams[teamIdx] || [];
    for (let i = 0; i < arr.length; i++) {
      const p = arr[i];
      if (p.role === 'TW') continue;
      p.hx = clamp(p.hx + p.dir * meter, 6, L - 6);
    }
    return true;
  }
  // ── Positionsaufzeichnung für die 2D-Ansicht ───────────────────────────────
  // Die Ansicht soll NICHTS rekonstruieren müssen: sie spielt exakt die
  // Positionen ab, mit denen die Engine gerechnet hat.
  // Aufbau je Bild: 22×(x,y) · Ball(x,y) · Ballführender(Index oder −1) · Uhr ·
  //                 Gegenpressing-Team(−1/0/1) · Bitmaske der Pressenden
  // Die letzten beiden Felder machen SARD in der 2D-Ansicht sichtbar, ohne dass
  // sie etwas nachbilden müsste — sie zeigt, was die Engine wirklich getan hat.
  //                 Gegenpressing-Team · Pressing-Bitmaske · Spielphase · Rotation
  // Feld 52: BALLHÖHE in Metern (0 = am Boden oder am Fuß). Alle Leser nehmen
  // die Schrittweite aus `res.stride` und lesen feste Felder davor — ein Feld
  // mehr am Ende bricht also nichts.
  const STRIDE = 53;
  function writeFrame(S) {
    const o = S.recN * STRIDE;
    if (o + STRIDE > S.rec.length) return;
    const r = S.rec, ps = S.alle || S.players;
    let maske = 0;
    for (let i = 0; i < 22; i++) {
      const p = ps[i];
      r[o + i * 2] = p.x; r[o + i * 2 + 1] = p.y;
      if (p._press) maske += (1 << i);           // 22 Bit passen exakt in Float32
    }
    r[o + 44] = S.ball.x; r[o + 45] = S.ball.y;
    r[o + 46] = S.ball.owner ? S.ball.owner._i : -1;
    r[o + 47] = S.clock;
    r[o + 48] = (S.gp && S.clock < S.gp.bis) ? S.gp.team : -1;
    r[o + 49] = maske;
    // Spielphase der ballführenden Elf: 2 = Zünden, 1 = Brechen, 0 = Auftanken.
    // Wird in decide() gesetzt und gilt bis zur nächsten Entscheidung.
    r[o + 50] = S.modus != null ? S.modus : 1;
    r[o + 51] = S.rotAktiv ? 1 : 0;
    r[o + 52] = S.ball.flight ? (S.ball.z || 0) : 0;
    S.recN++;
  }

  function mkStats() {
    return { goals: 0, shots: 0, onTarget: 0, xg: 0, passes: 0, passAcc: 0, corners: 0, fouls: 0, yellow: 0, red: 0, elfmeter: 0, abseits: 0, poss: 0 };
  }

  function batch(n, home, away) {
    const k = ['goals', 'shots', 'onTarget', 'xg', 'passes', 'corners', 'fouls', 'yellow'];
    const acc = {}; k.forEach(x => acc[x] = 0);
    let pq = 0, tore = 0;
    for (let i = 0; i < n; i++) {
      const r = simulateMatch(home, away, { seed: i + 1 });
      ['home', 'away'].forEach(s => {
        k.forEach(x => acc[x] += r.stats[s][x]);
        pq += r.stats[s].passes ? r.stats[s].passAcc / r.stats[s].passes : 0;
      });
      tore += r.score[0] + r.score[1];
    }
    const o = {}; k.forEach(x => o[x] = +(acc[x] / (n * 2)).toFixed(2));
    o.passQuote = +(pq / (n * 2) * 100).toFixed(1);
    o.toreProSpiel = +(tore / n).toFixed(2);
    return o;
  }

  window.MatchEngineV3 = { simulateMatch, batch, CFG, L, B, TICK, STRIDE,
                          fortsetzen: zuEnde, weiterBis, aufstellungVon, bankVon,
                          wechselAusfuehren, blockVerschieben, formationSetzen };
  console.log('[MatchEngineV3] räumliche Engine geladen');
})();