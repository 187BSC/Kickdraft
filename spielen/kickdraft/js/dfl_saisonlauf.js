/* ═══════════════════════════════════════════════════════════════════════════
   DFL-SAISONLAUF  ·  v1
   ─────────────────────────────────────────────────────────────────────────
   Spielt die DFL Jahr für Jahr durch, ohne Oberfläche – für Langzeittests
   (Arbeitsregel 4) und als Logik-Kern für den späteren Einbau ins Spiel:

     · Spielplan nach Spec: 6 Division + 12 Conference + 8 Inter-Conference,
       26 Spiele in 31 Wochen (5 Bye Weeks je Team), 13 Heim-/13 Auswärtsspiele,
       Inter-Conference-Rotation im 2-Jahres-Zyklus (Konzept 2)
     · Tabelle 3-1-0, Playoffs mit 14 Teams (Konzept 3)
     · Saisonwechsel: Cap-Wachstum + Rollover (D23), Ausgabe-Untergrenze (D20),
       Alterung/Entwicklung/Verletzungsfolgen (4.4), Vertragsende,
       Verlängerungen, Draft mit Rookie-Skala, Free Agency mit
       Verhandlungscharakter (Konzept 10), Kaderschnitt mit Dead Cap (Spec 3.2)
     · Verletzungen für alle 32 (D102): Saison Woche für Woche (Training, Testspiele, Ligaspiele), 15 Arten, Medizin-Stufe
       je Verein, Rückstand nach der Rückkehr (Reha), bleibender Rest erst ab 12 Wochen, Sommerpause heilt 12 Wochen,
       KI holt bei Langzeitausfall Ersatz (Verletztenliste). Stärke = verfügbare Elf in der Formation des Stils.

   NPC-Spiele nutzen dieselbe Formel wie quickSimResult im Spiel (Angriff gegen
   Abwehr, Mittelfeldkontrolle, Heimvorteil als Faktor), aber mit Seed-Zufall (A7).
   Braucht dfl_liga_generator.js. Noch NICHT in index.html eingehängt.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const G = window.DFLGenerator;
  if (!G) { console.warn('[DFL-Saisonlauf] DFLGenerator fehlt'); return; }

  const CFG = {
    // Bye Weeks (Rückmeldung 17.10., Nutzer: „5 Stück in der Regular Season, aber unterschiedlich verteilt“): 26 Spiele in
    // 26 + 5 Wochen, je Team 5 spielfreie Wochen zu eigenen Zeiten; nie in der ersten Woche und den letzten zwei, nie zwei am Stück.
    // je: 0 = alter Spielplan (26 Spieltage, alle spielen)
    bye: { je: 5, ohneAnfang: 1, ohneEnde: 2 },
    // D166: Wildcard und Divisional mit Hin- und Rückspiel in einer Woche; Frische wie dfl_playoffs_patch.js (Abzug in Punkten)
    playoffs: { zweiBeine: [1, 2], frische: { start: 95, spiel: 18, woche: 12, ab: 90, boden: 55, abzug: 4 }, pauseVorFinale: 1 },
    // Heimvorteil als Faktor auf die Torerwartung des Gastgebers (neutraler Platz: 1)
    heimvorteil: 1.2,
    // Spielformel (auch quickSimResult im Spiel, dfl_liga_patch.js), Checkliste des Nutzers 2026-10-09:
    //   Torerwartung = Basis × Heimvorteil × Stilfaktor, Basis = basis + Stärkeunterschied ÷ teiler (mindestens min),
    //   Stärkeunterschied = Angriff − gegnerische Abwehr ± Mittelfeldkante × 6 – für beide Teams gleich gerechnet.
    // star: Anteil, um den der Beste eines Bereichs (Abwehr/Mittelfeld/Angriff) den Bereichsschnitt hebt.
    // D43 (2026-10-08, „Bayern darf dominieren, ein Star soll sich lohnen“): 90 gegen 80 gewinnt 69 %, verliert 12 %.
    // Bis 2026-10-09 war der Heimvorteil ein Zuschlag von 4 Stärkepunkten mit eigenem Grundwert/Teiler je Seite
    // (1,35 + d/16 gegen 1,05 + d/19) – auch auf neutralem Platz hatte der Gastgeber so 44 % Siege gegen 29 %.
    spiel: { basis: 1.21, teiler: 19.7, min: 0.2, star: 0.3 },
    // D55 (freigegeben 2026-10-09): Spielstil als Schere-Stein-Papier. Kreis Gegenpressing → Ballbesitz → Flügel → Direkt →
    // Gegenpressing („schlägt“), gegenüber ausgeglichen. Prozent auf die Torchancen je Team: Kreis ±6, Formation +3 passend /
    // −3 unpassend, Spielerpassung ±4 (stärkebereinigt, DFLHandel.stilPassung); positive Summe × Eingewöhnung, negative voll.
    // Eingewöhnung +12 Punkte je Spiel; Wechsel zum Nachbarn → 50 %, zum Gegenüber → 20 %; unter 60 % Entwicklung × 0,85.
    stil: { aus: false, kreis: 6, formation: 3, spieler: 4, jeSpiel: 0.12, nachbar: 0.5, gegenueber: 0.2, entwicklungUnter: 0.6, entwicklung: 0.85 },
    // Cap-Entwicklung (D23): Wachstum der Ligaeinnahmen pro Jahr
    // NFL 2011–2026: im Schnitt gut 6 % pro Jahr
    cap: { wachstum: 0.045, streuung: 0.02, tvAlle: 4, tvSprung: 0.06, kriseChance: 0.05, krise: -0.05, aktiv: true },
    rollover: 0.05,                    // höchstens 5 % des neuen Caps (D101, vorher 10 %)
    // Ausgabe-Untergrenze (D20) wie NFL: 89 % des Caps über 4 Jahre in bar
    untergrenze: { aktiv: true, anteil: 0.89, jahre: 4, druckAb: 0.80 },
    // Karriereende (Checkliste des Nutzers 2026-10-09: „ab ca. 36–38, positionsabhängig“): Chance je Alter, Torhüter 2 Jahre später
    ruhestand: { 33: 0.06, 34: 0.12, 35: 0.22, 36: 0.40, 37: 0.60, 38: 0.85, 39: 1 }, ruhestandTwPlus: 2,
    // Vereinslose (eine ganze Saison ohne Vertrag) hören doppelt so oft auf – mit Karriereende statt still aus dem Markt
    // zu fallen, damit auch sie für die Hall of Fame zählen (Prüfung 2026-10-09: rund 160 Spieler je Saison verschwanden)
    ruhestandFrei: 2,
    // Abbau (Checkliste: „ab 32/33 jährlich −1 bis −3“): ab 31 (Schnellentwickler 29, Torhüter 34) je Saison −1 … −3
    abbau: { ab: 31, abSchnell: 29, abTw: 34, max: 3 },
    // 2026-10-22 (Nutzer): „junge Spieler sollen schneller an Potenzial verlieren, wenn sie nicht spielen … je älter desto mehr die
    // Stärke … ab 29 deutlich größerer Decline, ab 30 ruhig −2 oder −3 auf der Bank … die 80–90 sollen durch die Athletik sehr viel
    // abbauen, entweder spielen oder nicht … wieder ändern, wenn sie viel spielen, gut sind und in einem System, das ihnen liegt“
    spielzeit: { aktiv: true,
      jungBank: [[20, 2, 4, 1], [23, 1, 3, 0.7]],        // [bis Alter, Potenzial −min, −max, Chance] ohne Spieltagskader
      jungRotation: { bis: 23, minus: 1, chance: 0.3 },   // im Kader, aber nicht in der Startelf
      comeback: { bis: 25, luecke: 2, min: 1, max: 3, chance: 0.5 },   // Startelf und an der Decke: Potenzial wächst mit
      altBank: [[29, 1, 2], [30, 2, 3], [32, 2, 4]],      // [ab Alter, Stärke −min, −max] ohne Spieltagskader (zusätzlich zum Abbau)
      altRotation: [[30, 1, 1]],                          // im Kader, aber nicht in der Startelf
      athletik: { ovrAb: 80, alterAb: 30, minus: 1 },     // Spitzenspieler: Tempo und Athletik gehen zuerst – spielend oder nicht
      stil: { passt: 1.15, anders: 0.9, abstand: 2 } },   // Entwicklungstempo: Stil des Vereins ist sein bester (±2) bzw. sein schlechtester
    // Würfel „schwere Verletzung“ je Spieler und Saison (bis 2026-10-10: 0,04, traf nur KI-Spieler): seit D102 gibt es echte
    // Verletzungen für alle – Dauerschaden nur noch als bleibender Rest nach mindestens 12 Wochen (CFG.verletzung.rest)
    schwereVerletzung: 0,
    // Körperalter (D68, Nutzer 2026-10-10: „wie schnell man sinkt, hängt davon ab, ob man spielt – Verletzungen kommen dazu“):
    // p.koerper in Jahren. Stammspieler (≥ 50 % der Spiele von Beginn) altern körperlich langsamer, Bankspieler (< 20 %)
    // schneller; Verletzungswochen und schwere Verletzungen kosten Jahre – mit dem Alter mehr (27–29 ½, 30–32 1, ab 33 1½).
    // Erst ab 27 (junge Körper erholen sich). Wirkt auf Abbau, Karriereende und körperliche Detailwerte (dfl_werte_alter_patch.js).
    // Mitte so gewählt, dass die Liga im Schnitt altert wie vorher (Langzeitlauf 4 × 10 Saisons: Körperalter ab 28 im Mittel
    // −0,09 statt −0,58 bei −0,3/+0,3; Stärke 83,1 statt 82,8, ab 33 Jahren 4,7 % statt 3,4 %, 30→33 Stamm −0,75, Bank −0,90)
    // D102: rund viermal so viele Ausfallwochen → je Woche 0,012 statt 0,03 Jahre, kein Extra-Halbjahr für schwere Verletzungen
    // (dafür gibt es den bleibenden Rest) – im Langzeitlauf altert die Liga dadurch wie vorher
    koerper: { ab: 27, stamm: 0.5, bank: 0.2, jahrStamm: -0.1, jahrBank: 0.5, jeWoche: 0.012, schwer: 0,
      alter: [[27, 0.5], [30, 1], [33, 1.5]], min: -2, max: 3 },
    kader: 28, perspektiv: 6,
    // Development Squad (D45): Entwicklung über der Bank (1,0), unter Stammspielern (1,2); Mindestkader 21 (D46)
    ds: { entwicklung: 1.05 }, mindestKader: 21,
    // D110 (Teamlage, freigegeben 2026-10-11): die KI plant mit dem Kaderziel ihrer Lage (DFLGenerator.kaderZiel: 28/26/25). Free Agency
    // bis Ziel + 2 (höchstens 30), Kaderschnitt hart auf 28, darunter bis zum Ziel nur, wenn es sich lohnt (Ersparnis nach Dead Cap
    // mindestens `lohnt` × Mindestgehalt) – junge Spieler (bis 21) gehen vorher in den Development Squad (6 Plätze wie bisher).
    // Free Agency nach Lage (Messung der Vorschau, Variante „vorschlag3“): Neuaufbau nimmt Spieler ab 30 nur bei echter Lücke (Nutzen ≥ 2,
    // dann −1), Junge bis 25 lieber (+0,6), bietet ab 30 nur 85 % und gibt ab 29 höchstens 2 Jahre; Titel jetzt nimmt Veteranen ab 29
    // lieber (+0,2), Projekte bis 23 unter Teamniveau − 6 weniger (−0,5), gibt ab 31 höchstens 2 Jahre
    lage: { lohnt: 0.5,
      fa: { neuaufbau: { altAb: 30, luecke: 2, alt: 1, jungBis: 25, jung: 0.6, geld: 0.85, vertragAb: 29, jahre: 2 },
            titel: { altAb: 29, alt: 0.2, jungBis: 23, unter: 6, jung: -0.5, vertragAb: 31, jahre: 2 } } },
    marktTesten: 0.55,                 // Geldorientierte testen mit dieser Chance den Markt
    marktTestenSonst: 0.2,             // alle anderen (außer sehr Vereinstreue)
    kernAbstand: 8,                    // verlängert wird, wer höchstens so weit unter dem Startelf-Ø liegt

    draftKandidaten: 8,
    // Prestige (Wunsch 2026-10-07: Dynastien dürfen wechseln, aber nicht zerfallen): Erfolg macht
    // attraktiv – Free Agents kommen lieber, eigene Spieler testen seltener den Markt.
    prestige: { traegheit: 0.8, fa: 1.0, bleiben: 0.7 },
    // Entwicklungstempo: Stufe 1 ≈ 0,92, Stufe 10 ≈ 1,1 – dieselbe Spanne (+20 %) wie beim eigenen Verein
    // (bundle_match.js facilityMaxBonus 0,20); vorher 0,84 … 1,2
    training: { basis: 0.9, jeStufe: 0.02 },
    // Entwicklungskurve (D48, Wunsch 2026-10-08): je besser ein Spieler, desto langsamer wächst er (90 langsamer als 85
    // als 80 …), und der Jugendschub lässt mit 21/22 nach. Gilt für die KI-Welt (entwicklung) und den eigenen Verein
    // (dfl_trainingsgruppe_patch.js über traitDevFaktor). ovr: Stützpunkte [OVR, Faktor], dazwischen linear.
    // D103 (Nutzer 2026-10-10: „eine Kurve für Schwächere, die steiler ist“): unter 70 steiler (vorher ≤ 60 → 1,15) –
    // Zuwachs bis 20 Jahre bei Stärke 50–64 von 3,7–4,1 auf 4,1–4,5 je Saison
    kurve: { ovr: [[50, 1.7], [55, 1.55], [60, 1.4], [65, 1.2], [70, 1.0], [75, 0.86], [80, 0.7], [85, 0.52], [90, 0.34], [95, 0.18], [99, 0.1]],
             jugend: { 21: 0.85, 22: 0.72 } },
    // Zielwert (Wunsch 2026-10-08, D42): jeder KI-Verein verfolgt intern eine Stärke, alle 5–8 Jahre neu gezogen. Der
    // Abstand zum Ziel („Druck“ −1 … +1, volle Wirkung ab 3 OVR) macht das Management klug (aufwärts) oder fragwürdig
    // (abwärts): Entwicklung und Form der Spieler, Draft-Treffer, Reiz und Preis für Free Agents, Verlängerungen, Trades
    // (dfl_handel.js). Ziele 72–95, weil Vereine ihr Ziel selten ganz erreichen, bevor das nächste kommt: gemessen liegt die
    // Liga damit dauerhaft bei 75–91 (15 Jahre, 6 Ligen, `node spiel/tools/dfl_staerke.js 15 6`).
    ziel: { aktiv: true, min: 72, max: 95, jahre: [5, 8], spanne: 3, groesse: 6,   // groesse: große Stadien zielen höher (D43: 3 → 6)
            entwicklung: 1.0,      // Tempo der Jungen × (1 + 1,0 × Druck)
            form: 1.2,             // Chance je Spieler ab 24 auf ±1 OVR im Jahr (× |Druck|)
            scouting: 7,           // Draft: Scouting-Stufe ± 7 × Druck
            fa: 1.2, rabatt: 0.2,  // Free Agency: Reiz ± 1,2 × Druck, Preis ∓ 20 % (fürs Projekt nehmen Spieler weniger)
            bleiben: 0.9,          // Verlängerung: Marktlust der eigenen Spieler × (1 − 0,9 × Druck)
            vertrag: 0.3,          // Verlängerung: ∓ 30 % (fragwürdige Vereine zahlen drauf und verstopfen den Cap)
            luecke: 0.6,           // kluge Vereine schließen gezielt Lücken in der Startelf
            // Spätphase (Nutzer 2026-10-17: „die KI darf im späteren Spiel ruhig besser werden, dass die besten Teams auch richtig
            // klug sind und eine Challenge darstellen – aber ab Saison 10“): ab Saison spaetAb arbeiten die spitze besten KI-Teams
            // immer klug (Druck mindestens spaetDruck) und bekommen beim nächsten Zielwechsel spaetPlus Punkte mehr
            spaetAb: 10, spitze: 8, spaetDruck: 0.4, spaetPlus: 3 },
    scoutingVeraltet: 3,               // Saisons ohne Investition, bis das Scouting eine Stufe verliert
    freieMax: 220,                     // so viele Vereinslose bleiben im Markt (Rest: Karriereende/Ausland)
    jahrgangMax: 240,                  // Talente je Draft-Jahrgang (200 neue + Wiederanmeldungen)
    // Start mit 25 (D74, Nutzer 2026-10-10: „25 Spieler für alle, deutlich mehr Free-Agency-Spieler … nicht nur alte, sondern
    // von allem was dabei (aber trotzdem mehr Veterans)“). Zum Karrierestart laufen bei jedem Verein Verträge aus (kein Dead Cap):
    // Gewicht = Alter × Restlaufzeit, nie die `schutz` Wertvollsten, nie unter `twMin` Torhüter bzw. die Startelf-Besetzung einer
    // Position. Dazu erzeugte Free Agents in drei Altersgruppen (Stärke wie bisher 70 ± 5, etwas breiter). Danach Free Agency in
    // Wellen wie im Spiel (Wochen 2–5 je 30 %, Vorbereitung den Rest) und der Kaderschnitt (phaseKader). aktiv: false = wie vor D74.
    start: { aktiv: true, kader: 25, schutz: 3, twMin: 2,
      alter: [[23, 0.7], [28, 1], [31, 2], [99, 2.5]], rest: { 1: 2.5, 2: 1.3, sonst: 0.6 },
      pool: { anzahl: 60, gruppen: [{ anteil: 0.20, alter: [20, 23], ovr: [64, 6, 52, 78] },
                                    { anteil: 0.35, alter: [24, 29], ovr: [70, 6, 58, 84] },
                                    { anteil: 0.45, alter: [30, 34], ovr: [71, 6, 58, 86] }] },
      wellen: [0.3, 0.3, 0.3, 0.3, 1],
      // D108 (Nutzer 2026-10-11: „… am besten mit dem Tag, wo die Verträge für die neue Saison beschlossen werden, und danach Draft-Tag“):
      // die Karriere beginnt vor dem ersten Draft. Eine stille Vorsaison (Tabelle, Playoffs) legt die Draft-Reihenfolge fest (echter
      // Pick), bei jedem Verein laufen so viele Verträge aus, dass er mit `kader` (21) + 4 Rookies wieder bei 25 steht wie vor D108,
      // dann zieht die ganze Liga einen eigenen Start-Jahrgang (Draft-Jahr = erstes Saisonjahr). aktiv: false = Start wie D74.
      draft: { aktiv: true, kader: 21 } },
    // Free Agency jeder Offseason in denselben Wellen wie im Spiel (Wochen 2–5 je 30 %, Vorbereitung den Rest) – mit dem
    // Restmarkt (DFLGenerator.CFG.restmarkt) senkt, wer leer ausgeht, von Welle zu Welle die Forderung
    faWellen: [0.3, 0.3, 0.3, 0.3, 1],
    // Markt (Nutzer 2026-10-11 zu Frage 17: „nicht so coden, dass literally nach der ersten Woche so viele gute Spieler weg sind. Ein
    // bisschen sus“; bis dahin unterschrieben die 20 wertvollsten Free Agents zu 83–100 % in Welle 1): gute Free Agents (Spielerwert ab
    // gutAb) sammeln eine Welle Angebote (grund) und testen den Markt nach Profil: geldorientiert (Geld ab geldAb) +1, Titeljäger (Titel ab
    // titelAb) ohne Angebot eines Titelkandidaten +1, Sicherheitsdenker (ab sicherAb) −1, ab altAb Jahren −1, höchstens maxWarten Wellen;
    // ein Angebot ab sofortAb × Marktgehalt nimmt jeder sofort (topAb: optional +1 für die Allerbesten). In den Wellen vor der Vorbereitung
    // schließt jeder KI-Verein je Welle höchstens jeWelle Lücke (Nutzen ab lueckeAb: Startelf oder Soll); die letzte Welle (Vorbereitung)
    // wie bisher. Wer gewartet hat (mit Angebot), bekommt keinen Restmarkt-Abschlag – den gibt es nur ohne Angebot. aktiv: false = wie vorher.
    // Gemessen (2 Ligen × 6 Saisons, gleiche Ligen): Welle 1 der guten (ab 80) 97 → 29 % zum Start, 78 → 32 % je Offseason (Top 20: 100 → 25 %
    // bzw. 100 → 24 %), Abschlüsse gesamt 70 → 74 bzw. 52 → 55 (Varianten: Wartezeit nur für Top-Spieler – Top 20 in Welle 1 nur 15 %)
    markt: { aktiv: true, gutAb: 76, grund: 1, topAb: null, geldAb: 55, titelAb: 65, sicherAb: 70, altAb: 32, maxWarten: 2, sofortAb: 1.12, jeWelle: 1, lueckeAb: 1,
      // Aktivität (Nutzer 2026-10-14: „die Vereine müssen doch nicht alles abgrasen in den ersten Wochen … die Vereine, die improven wollen,
      // weil sie intern höhere Ziel-OVR haben, holen eher Spieler und die anderen verpennen es“): je Welle vor der Vorbereitung bietet ein
      // KI-Verein nur mit Wahrscheinlichkeit grund + druck × Zieldruck (−1 … +1, Ziel über Stärke = positiv) + titel (Titelkandidat)
      // + jeWelle × Welle, mindestens min. Die letzte Welle (Vorbereitung) wie bisher für alle. aktiv: false = alle bieten in jeder Welle.
      // Gemessen (6 Ligen, Start + 2 Offseasons, gute = ab 80): übrig nach Woche 2/3/4/5 zum Start 21/9/1/1 → 27/20/12/7 von 31,
      // je Offseason 23/12/6/5 → 27/22/18/13 von 32; Abschlüsse gesamt 1090 → 1122.
      aktivitaet: { aktiv: true, grund: 0.15, druck: 1, titel: 0.1, jeWelle: 0.08, min: 0.05 } },
    // Stil-Scouting (Nutzer 2026-10-09): KI bevorzugt Spieler, die zu ihrem Stil passen (DFLHandel.spielerPassung, z ≥ 0).
    // Gemessen (3 Ligen × 8 Saisons): Passung der Zugänge z 0,00 → 0,05 (FA/Trade), Rookies 0,22 → 0,29, Kader 0,04 → 0,07.
    stilScout: { draft: 3, faNutzen: 1, faGeld: 0.08, kern: 3 },
    // Positionen lernen (Welt-Paket L3, Nutzer 2026-10-11: „nach x Spielen die Mainposition switch“): Startelf-Einsätze je Platz
    // (p.posEinsaetze { Platz: n }, nur Plätze außer der Hauptposition) – nach `neben` Einsätzen wird ein fremder Platz gelernte
    // Nebenposition (−2), nach `haupt` Einsätzen Hauptposition (die alte wird Nebenposition). Hauptposition nur im selben Mannschaftsteil
    // (Abwehr/Mittelfeld/Angriff), weil Stärke und Werte daran hängen; höchstens `max` Positionen. KI aus der Elf der Welt je Spieltag,
    // eigener Verein aus der Aufstellung je Pflichtspiel (dfl_lernen_patch.js). aktiv: false = wie vorher
    lernen: { aktiv: true, neben: 10, haupt: 25, max: 4 },
    // ── Verletzungen und Medizin (D102, freigegeben 2026-10-10, Vorschau spiel/dfl_medizin_vorschau.html) ──────────────────
    // Gleiche Regeln für alle 32 (eigener Verein: dfl_medizin_patch.js mit denselben Zahlen). Bis 2026-10-10: eigener Verein
    // 18 % je Spiel für einen zufälligen Startelf-Spieler + 0,6 % je Woche im Training (1–3 Wochen), KI-Vereine nie verletzt.
    // Medizin-Stufe 1–10 (Anlage `medizin`): je Stufe über 1 Risiko −3 %, Dauer −2,5 %, schwere Fälle (ab 6 Wochen) werden mit
    // 5 % zu einer leichteren Art, Reha-Tempo +6 %, bleibender Rest −4 % (Chance).
    verletzung: { aktiv: true,
      // 15 Arten: Wochen min–max, Gewicht → Ø 4,8 Wochen, 8 % ab 10 Wochen, Kreuzband 1,5 %
      typen: [
        { name: 'Prellung', min: 1, max: 2, w: 14 }, { name: 'Muskelzerrung', min: 2, max: 3, w: 16 }, { name: 'Gehirnerschütterung', min: 1, max: 3, w: 4 },
        { name: 'Bänderdehnung', min: 2, max: 4, w: 12 }, { name: 'Muskelfaserriss', min: 3, max: 6, w: 15 }, { name: 'Adduktorenzerrung', min: 2, max: 5, w: 7 },
        { name: 'Knöchelverletzung', min: 3, max: 6, w: 7 }, { name: 'Innenbandverletzung', min: 4, max: 8, w: 8 }, { name: 'Muskelbündelriss', min: 6, max: 10, w: 5 },
        { name: 'Schambeinentzündung', min: 6, max: 12, w: 2 }, { name: 'Meniskusriss', min: 6, max: 12, w: 2.4 }, { name: 'Mittelfußbruch', min: 8, max: 14, w: 2.5 },
        { name: 'Syndesmosebandriss', min: 39, max: 52, w: 1.4 }, { name: 'Achillessehnenriss', min: 30, max: 39, w: 0.4 }, { name: 'Kreuzbandriss', min: 39, max: 52, w: 1.7 }],   // 2026-10-22 (Nutzer): Kreuzband und Syndesmose wirklich 9–12 Monate, Achillessehne mit Reha 7–9 Monate
      spiel: 0.05,                     // je Startelf-Spieler und Pflichtspiel (Medizin Stufe 1); Spielverletzung zählt ab dem nächsten Spiel
      test: 0.6,                       // Testspiele: Anteil des Spielrisikos
      training: 0.014,                 // je Spieler und Woche in der Saison …
      vorbereitung: 0.017, vorbereitungBis: 5,   // … in der Vorbereitung (Wochen 1–5)
      schwerAb: 6,                     // Arten ab 6 Wochen Mindestdauer = schwere Fälle (die Medizin macht manche leichter)
      med: { risiko: 0.03, dauer: 0.025, schwer: 0.05, reha: 0.06, rest: 0.04, max: 10 },
      // Rückstand bei der Rückkehr: halbe Ausfallwochen (ab 3 Wochen, höchstens −8); je Woche 1 Punkt zurück, je Einsatz in der
      // Startelf 0,5 dazu (Woche mit Spiel = 1,5); bis 23 Jahre ×1,2, ab Körperalter 31 ×0,8; Medizin +6 % je Stufe
      reha: { ab: 3, faktor: 0.5, max: 8, tempo: 1, spiel: 0.5, jung: 1.2, jungBis: 23, alt: 0.8, altAb: 31 },
      // Bleibender Rest nur nach mindestens 12 Wochen: jeder zweite Fall −1 Stärke (ab 29: −1 bis −2), Junge (bis 24) −1 bis −2 Potenzial
      rest: { ab: 12, chance: 0.5, altAb: 29, jungBis: 24 },
      alter: { ab: 29, risiko: 0.04, heil: 0.03 },          // Körperalter (D68) über 29: je Jahr Risiko +4 %, Dauer +3 %
      deckel: { weichAb: 5, daempfung: 0.6, hartAb: 9 },     // Bremse: ab 5 Verletzten ×0,6 je weiterem, ab 9 keine neuen (bis D102: 3 / 0,45 / 6)
      sommer: 12,                      // die Sommerpause heilt 12 Wochen, der Rest läuft in die neue Saison
      ersatzAb: 8,                     // KI: ab 8 Wochen Ausfall Verletztenliste + Ersatz aus den Vereinslosen (Mindestvertrag, 1 Jahr)
      rendite: 5,                      // KI baut die Medizin aus, wenn sich die Stufe in ≤ 5 Saisons über gesparte Gehälter rechnet
      start: { min: 1, max: 8 },       // Startstufe: Ø aus Training und Scouting minus 1 (Bremen 5)
      // Kalender wie im Spiel (engine_main.js buildMatchWeeks, BREAK_WEEKS der DFL): Testspiele in Woche 2–4, Liga ab Woche 6
      kalender: { start: 6, pausen: [1, 2, 3, 4, 5, 26, 27], test: [2, 3, 4] } },   // Rückmeldung 17.10. (6): keine Länderspielpausen, dafür Bye Weeks
    // KI-Stärke (2026-10-10, Nutzer: „KI-Stärke aus der Formation ihres Stils“): beste Formation des Stils aus den verfügbaren
    // Spielern, je Platz Stärke − Rückstand − Positionsabzug wie D81 (gelernt −2, sonst −8/−12/−18, Torwart ↔ Feld −24).
    // Bis 2026-10-10 immer das 4-2-3-1 (DFLGenerator.CFG.startelf, ohne ZM) aus dem ganzen Kader. formation: false = wie vorher.
    staerke: { formation: true, fest: false, gelernt: 2, abstand: [0, 8, 12, 18], torwart: 24, luecke: 30 },
    // Plätze je Formation in der Reihenfolge der Slots im Spiel (FORMATIONS, Plätze wie DFLPosition.platz, ZOM = OM); D95: die Seite
    // kommt aus der Lage des Platzes (4-2-3-1 außen LF/RF, Schienen der Dreier-/Fünferkette LV/RV, LM/RM im Mittelfeld);
    // im Spiel gleicht dfl_medizin_patch.js beides mit FORMATIONS und DFLTaktik.STILE ab
    formationen: {
      '4-4-2': ['TW', 'LV', 'IV', 'IV', 'RV', 'LM', 'ZM', 'ZM', 'RM', 'ST', 'ST'],
      '4-3-3': ['TW', 'LV', 'IV', 'IV', 'RV', 'ZM', 'ZM', 'ZM', 'LF', 'ST', 'RF'],
      '4-2-3-1': ['TW', 'LV', 'IV', 'IV', 'RV', 'ZDM', 'ZDM', 'LF', 'OM', 'RF', 'ST'],
      '3-5-2': ['TW', 'IV', 'IV', 'IV', 'LV', 'ZM', 'ZM', 'ZM', 'RV', 'ST', 'ST'],
      '5-3-2': ['TW', 'IV', 'IV', 'IV', 'LV', 'ZM', 'ZM', 'ZM', 'RV', 'ST', 'ST'],
      '4-1-4-1': ['TW', 'LV', 'IV', 'IV', 'RV', 'ZDM', 'LM', 'ZM', 'ZM', 'RM', 'ST'],
      '5-4-1': ['TW', 'IV', 'IV', 'IV', 'LV', 'RV', 'LM', 'ZM', 'ZM', 'RM', 'ST'],
      '4-4-1-1': ['TW', 'LV', 'IV', 'IV', 'RV', 'LM', 'ZM', 'ZM', 'RM', 'OM', 'ST'],
      '5-2-3': ['TW', 'IV', 'IV', 'IV', 'LV', 'RV', 'ZM', 'ZM', 'LF', 'ST', 'RF'],
      '3-4-3': ['TW', 'IV', 'IV', 'IV', 'LM', 'ZM', 'ZM', 'RM', 'LF', 'ST', 'RF'],
      '4-2-2-2': ['TW', 'LV', 'IV', 'IV', 'RV', 'ZDM', 'ZDM', 'OM', 'OM', 'ST', 'ST'] },
    // Formationen je Stil (wie DFLTaktik.STILE); ohne Stil das 4-2-3-1
    stilFormationen: { pressing: ['4-2-3-1', '4-3-3', '4-2-2-2'], ballbesitz: ['4-3-3', '4-1-4-1', '4-2-3-1'],
      fluegel: ['4-3-3', '3-4-3', '5-2-3'], direkt: ['4-4-2', '4-4-1-1', '3-5-2'] },
  };

  // ── Zufall ───────────────────────────────────────────────────────────────
  function poisson(r, lambda) {
    const L = Math.exp(-lambda);
    let k = 0, p = 1;
    do { k++; p *= r(); } while (p > L);
    return k - 1;
  }

  // ── Spielplan ────────────────────────────────────────────────────────────
  function divisionen(teams) {
    const out = { SUE_WEST: [], NORD_OST: [] };
    teams.forEach(t => {
      const liste = out[t.conference];
      let d = liste.find(x => x.name === t.division);
      if (!d) liste.push(d = { name: t.division, ids: [] });
      d.ids.push(t.id);
    });
    return out;
  }
  // Vier Runden einer Begegnung Division A gegen Division B (Lateinisches Quadrat);
  // A hat in Runde 0 und 2 Heimrecht, B in 1 und 3 → jedes Team 2 Heim / 2 Auswärts
  function kreuzRunden(a, b, tausch) {
    const runden = [];
    for (let k = 0; k < 4; k++) {
      const spiele = [];
      for (let i = 0; i < 4; i++) {
        const x = a[i], y = b[(i + k) % 4];
        const aHeim = (k % 2 === 0) !== tausch;
        spiele.push(aHeim ? [x, y] : [y, x]);
      }
      runden.push(spiele);
    }
    return runden;
  }
  function spielplan(teams, saisonIndex, r) {
    const D = divisionen(teams);
    const tausch = saisonIndex % 2 === 1;
    const divHin = [[], [], []], divRueck = [[], [], []];
    const paare = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]];
    for (const konf of ['SUE_WEST', 'NORD_OST']) {
      D[konf].forEach(d => {
        paare.forEach((runde, ri) => runde.forEach(([i, j]) => {
          const h = (ri + i) % 2 === 0 ? d.ids[i] : d.ids[j], g = h === d.ids[i] ? d.ids[j] : d.ids[i];
          divHin[ri].push([h, g]); divRueck[ri].push([g, h]);
        }));
      });
    }
    // Conference: drei Paarungen der Divisionen × vier Runden
    const konfRunden = [];
    for (const paarung of paare) {
      const block = [[], [], [], []];
      for (const konf of ['SUE_WEST', 'NORD_OST']) {
        const ds = D[konf];
        paarung.forEach(([i, j]) => kreuzRunden(ds[i].ids, ds[j].ids, tausch).forEach((sp, k) => block[k].push(...sp)));
      }
      konfRunden.push(...block);
    }
    // Inter-Conference: Rotation (Jahr A: Division 0+1 gegen Nord-Ost 0+2, 2+3 gegen 1+3; Jahr B umgekehrt)
    const SW = D.SUE_WEST, NO = D.NORD_OST;
    const jahrA = Math.floor(saisonIndex / 2) % 2 === 0;
    const bloecke = jahrA ? [[0, 2, 1, 3], [2, 0, 3, 1]] : [[1, 3, 0, 2], [3, 1, 2, 0]];
    const interRunden = [];
    bloecke.forEach(ziel => {
      const block = [[], [], [], []];
      ziel.forEach((noIdx, swIdx) => kreuzRunden(SW[swIdx].ids, NO[noIdx].ids, tausch).forEach((sp, k) => block[k].push(...sp)));
      interRunden.push(...block);
    });
    // Reihenfolge: alles gemischt, die Division-Rückspiele bilden das Saisonfinale
    const mitte = [...divHin, ...konfRunden, ...interRunden];
    for (let i = mitte.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [mitte[i], mitte[j]] = [mitte[j], mitte[i]]; }
    const plan = [...mitte, ...divRueck];
    return CFG.bye && CFG.bye.je > 0 ? mitByes(plan, r) : plan;
  }
  // Verteilt die 26 vollen Spieltage auf 26 + je Wochen: Woche für Woche spielfreie Teams wählen (wer am meisten Luft hat),
  // die übrigen paaren (Spiele der früheren Spieltage zuerst, Suche mit dem engsten Team zuerst). Scheitert ein Versuch, neu würfeln.
  function mitByes(plan, r) {
    const je = CFG.bye.je, R = plan.length + je, ids = [...new Set(plan[0].flat())];
    for (let versuch = 0; versuch < 400; versuch++) {
      const offen = new Map(ids.map(id => [id, []]));          // id → [{ spiel, o }]
      plan.forEach((tag, o) => tag.forEach(sp => { const x = { sp, o, weg: false }; offen.get(sp[0]).push(x); offen.get(sp[1]).push(x); }));
      const rest = new Map(ids.map(id => [id, plan.length])), byes = new Map(ids.map(id => [id, 0])), letzt = new Map();
      const wochen = [];
      let ok = true;
      for (let w = 0; w < R && ok; w++) {
        const bleibt = R - w;
        const darf = id => w >= CFG.bye.ohneAnfang && w < R - CFG.bye.ohneEnde && byes.get(id) < je && letzt.get(id) !== w - 1 && rest.get(id) < bleibt;
        // Ziel: so viele spielfreie Teams, dass die übrigen Byes gleichmäßig auf die übrigen Bye-Wochen kommen (gerade Zahl)
        const offeneByes = ids.reduce((a, id) => a + (je - byes.get(id)), 0), byeWochen = Math.max(1, R - CFG.bye.ohneEnde - w);
        let ziel = w < CFG.bye.ohneAnfang ? 0 : 2 * Math.round(offeneByes / byeWochen / 2 + (r() - 0.5) * 0.9);
        const kand = ids.filter(darf).map(id => ({ id, luft: bleibt - rest.get(id) + r() * 1.5 })).sort((a, b) => b.luft - a.luft);
        ziel = Math.max(0, Math.min(ziel, kand.length - (kand.length % 2)));
        let frei = null, paare = null;
        for (let t = 0; t < 30 && !paare; t++) {
          const pool = t === 0 ? kand.slice(0, ziel) : kand.slice().sort(() => r() - 0.5).sort((a, b) => b.luft - a.luft + (r() - 0.5) * 3).slice(0, ziel);
          frei = new Set(pool.map(x => x.id));
          paare = paarung(ids.filter(id => !frei.has(id)), offen, r);
        }
        if (!paare) { ok = false; break; }
        frei.forEach(id => { byes.set(id, byes.get(id) + 1); letzt.set(id, w); });
        paare.forEach(x => { x.weg = true; rest.set(x.sp[0], rest.get(x.sp[0]) - 1); rest.set(x.sp[1], rest.get(x.sp[1]) - 1); });
        wochen.push(paare.map(x => x.sp));
      }
      if (ok && ids.every(id => rest.get(id) === 0 && byes.get(id) === je)) return wochen;
    }
    console.warn('[DFL-Saisonlauf] Bye Weeks: keine Verteilung gefunden – Spielplan ohne Byes');
    return plan;
  }
  // Perfekte Paarung der Teams aus ihren offenen Spielen (Tiefensuche, das Team mit den wenigsten Möglichkeiten zuerst)
  function paarung(teams, offen, r) {
    if (teams.length % 2) return null;
    const frei = new Set(teams), wahl = [];
    let schritte = 0;
    const moegl = id => offen.get(id).filter(x => !x.weg && !x.belegt && frei.has(x.sp[0] === id ? x.sp[1] : x.sp[0]));
    function suche() {
      if (!frei.size) return true;
      if (++schritte > 4000) return false;
      let best = null, bm = null;
      for (const id of frei) { const m = moegl(id); if (!best || m.length < bm.length) { best = id; bm = m; if (!m.length) break; } }
      if (!bm.length) return false;
      bm.sort((a, b) => a.o - b.o + (r() - 0.5) * 2);
      for (const x of bm) {
        const g = x.sp[0] === best ? x.sp[1] : x.sp[0];
        frei.delete(best); frei.delete(g); x.belegt = true; wahl.push(x);
        if (suche()) return true;
        frei.add(best); frei.add(g); x.belegt = false; wahl.pop();
      }
      return false;
    }
    const ok = suche();
    wahl.forEach(x => { x.belegt = false; });
    return ok ? wahl.slice() : null;
  }
  // Prüft die Spec-Regeln des Spielplans; liefert eine Liste von Fehlern
  function pruefeSpielplan(plan, teams) {
    const fehler = [], byId = new Map(teams.map(t => [t.id, t]));
    const je = CFG.bye && CFG.bye.je > 0 ? CFG.bye.je : 0;
    if (plan.length !== 26 + je) fehler.push('Spielplan hat ' + plan.length + ' statt ' + (26 + je) + ' Wochen');
    const byeVon = new Map(teams.map(t => [t.id, []]));
    plan.forEach((tag, i) => {
      const ids = tag.flat();
      if (new Set(ids).size !== ids.length) fehler.push('Woche ' + (i + 1) + ': ein Team spielt doppelt');
      if (!je && ids.length !== 32) fehler.push('Spieltag ' + (i + 1) + ': nicht jedes Team genau einmal');
      teams.forEach(t => { if (ids.indexOf(t.id) < 0) byeVon.get(t.id).push(i); });
    });
    byeVon.forEach((b, id) => {
      if (b.length !== je) fehler.push(id + ': ' + b.length + ' statt ' + je + ' Bye Weeks');
      if (je && (b.some(i => i < CFG.bye.ohneAnfang || i >= plan.length - CFG.bye.ohneEnde) || b.some((i, k) => k && i === b[k - 1] + 1))) fehler.push(id + ': Bye Week an verbotener Stelle ' + b.join(','));
    });
    for (const t of teams) {
      let heim = 0; const gegner = new Map();
      plan.forEach(tag => tag.forEach(([h, g]) => {
        if (h === t.id) { heim++; gegner.set(g, (gegner.get(g) || 0) + 1); }
        if (g === t.id) gegner.set(h, (gegner.get(h) || 0) + 1);
      }));
      if (heim !== 13) fehler.push(t.id + ': ' + heim + ' Heimspiele');
      let div = 0, konf = 0, inter = 0;
      gegner.forEach((n, id) => {
        const o = byId.get(id);
        if (o.division === t.division) { div += n; if (n !== 2) fehler.push(t.id + ': Divisionsgegner ' + id + ' ' + n + '×'); }
        else if (o.conference === t.conference) { konf += n; if (n !== 1) fehler.push(t.id + ': Conferencegegner ' + id + ' ' + n + '×'); }
        else { inter += n; if (n !== 1) fehler.push(t.id + ': Inter-Gegner ' + id + ' ' + n + '×'); }
      });
      if (div !== 6 || konf !== 12 || inter !== 8) fehler.push(t.id + `: ${div}/${konf}/${inter} statt 6/12/8`);
    }
    return fehler;
  }

  // ── Spiele ───────────────────────────────────────────────────────────────
  // Bereich eines Platzes in der Spielformel (D95: LV/RV Abwehr, LM/RM Mittelfeld, LF/RF Angriff; AV/FL/AM = Altbestand)
  const BEREICH_STARTELF = { TW: 'def', IV: 'def', LV: 'def', RV: 'def', AV: 'def', ZDM: 'mid', ZM: 'mid', LM: 'mid', RM: 'mid', AM: 'mid', OM: 'mid',
    LF: 'att', RF: 'att', FL: 'att', ST: 'att' };
  // Wer kann spielen? Nicht verletzt, nicht auf der Verletztenliste, nicht gesperrt, kein Streik (gesperrt/streik nur beim
  // gespiegelten eigenen Kader, DFLSpiel.spielZuDfl)
  const verfuegbar = p => !!p && !(p.aus > 0) && !p.ir && !(p.gesperrt > 0) && !p.streik;
  const rueckstand = p => (p && p.reha > 0 ? p.reha : 0);
  // Bonus einer Sonderkarte (im Spiel: dfl_woche_patch.js setzt CFG.kartenBonus); im Langzeitlauf 0
  const kartenBonus = p => (typeof CFG.kartenBonus === 'function' ? CFG.kartenBonus(p) || 0 : 0);
  // Positionsabzug wie D81 (dfl_position_patch.js): Stammposition 0, gelernte 2./3. Position −2, sonst nach Abstand zur nächsten
  // gelernten Position −8/−12/−18, Torwart ↔ Feld −24. D95: Wege mit Seite aus dem Generator (DFLGenerator.positionsAbzug, dieselbe
  // Rechnung wie im Spiel) – andere Seite −12, eine Reihe weiter auf derselben Seite und LV/RV ↔ IV −8
  const abzugPos = (p, platz) => G.positionsAbzug(G.positionenVon(p), platz, CFG.staerke).abzug;
  // Ungarische Methode (n Zeilen ≤ m Spalten, minimale Kosten) – wie DFLPosition.ungarisch
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
  // Beste Besetzung einer Formation: größte Summe aus Stärke − Rückstand − Positionsabzug (Torwart ↔ Feld nur als Notnagel,
  // wie lineup_auto_patch.js); leere Plätze zählen CFG.staerke.luecke. Rückgabe: Spieler und Wert je Platz, Ø
  function besetze(plaetze, spieler) {
    const K = CFG.staerke, VERBOTEN = 1e6, n = plaetze.length, m = spieler.length;
    const wert = (p, z) => (p.ovr || 50) - rueckstand(p) - abzugPos(p, z) + kartenBonus(p);
    const elf = new Array(n).fill(null), werte = new Array(n).fill(K.luecke);
    if (m) {
      const kosten = plaetze.map(z => {
        const zeile = spieler.map(p => { const a = abzugPos(p, z); return a >= K.torwart ? VERBOTEN : -wert(p, z) + a * (p.ovr || 50) / 10000; });
        for (let i = 0; i < n; i++) zeile.push(0);
        return zeile;
      });
      const benutzt = new Set();
      ungarisch(kosten).forEach((j, i) => { if (j >= 0 && j < m && kosten[i][j] < VERBOTEN) { elf[i] = spieler[j]; werte[i] = wert(spieler[j], plaetze[i]); benutzt.add(j); } });
      // Notnagel: offene Plätze mit den Stärksten der Übrigen (auch ein Feldspieler im Tor)
      const rest = spieler.filter((p, j) => !benutzt.has(j)).sort((a, b) => (b.ovr - rueckstand(b)) - (a.ovr - rueckstand(a)));
      plaetze.forEach((z, i) => { if (!elf[i] && rest.length) { const p = rest.shift(); elf[i] = p; werte[i] = Math.max(K.luecke, wert(p, z)); } });
    }
    return { elf, werte, wert: werte.reduce((s, x) => s + x, 0) / Math.max(1, n), luecken: elf.filter(x => !x).length };
  }
  // Formationen, aus denen ein Team wählt: feste Formation (eigener Verein, opt.formation), sonst die seines Stils – mit
  // CFG.staerke.fest die Formation der Saison (team.formation, nominal gesetzt von formationenSetzen); opt.alle (nominal) wählt frei
  function formationenFuer(team, opt) {
    const F = CFG.formationen;
    if (opt && opt.formation && F[opt.formation]) return [opt.formation];
    const stil = team && team.taktik && team.taktik.stil, liste = (stil && CFG.stilFormationen[stil]) || [];
    const ok = liste.filter(f => F[f]);
    if (CFG.staerke.fest && !(opt && opt.alle) && team && team.formation && ok.indexOf(team.formation) >= 0) return [team.formation];
    return ok.length ? ok : ['4-2-3-1'];
  }
  // Stärke eines Teams für die Spielformel (D43/D58): Abwehr/Mittelfeld/Angriff = Ø je Bereich + Starfaktor.
  // opt.formation: feste Formation · opt.alle: alle Spieler (nominal, ohne Ausfälle und Rückstand)
  function teamWerte(team, opt) {
    opt = opt || {};
    const m = a => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
    // Starfaktor: der Beste eines Bereichs zählt etwas mehr als der Schnitt
    const b = a => { const x = m(a); return a.length ? x + CFG.spiel.star * (Math.max(...a) - x) : x; };
    const t = team.taktik;
    const stil = t && t.stil ? { key: t.stil, spieler: t.spieler || 0, formPasst: t.formPasst !== false, eing0: t.eing0 != null ? t.eing0 : 1 } : null;
    // D118: Trainerteam – Co-Trainer/Chefcoach beschleunigen die Eingewöhnung, Standardtrainer und Psychologe fließen in die Formel
    const Tr = trainer();
    if (stil && Tr) stil.jeSpiel = CFG.stil.jeSpiel + Tr.eingBonus(team);
    const tr = Tr ? { std: Tr.stdSterne(team), elfer: Tr.elferBonus(team) } : {};
    const kader = opt.alle ? team.roster.slice() : team.roster.filter(verfuegbar);
    const w = { def: [], mid: [], att: [] };
    if (!CFG.staerke.formation) {
      // wie bis 2026-10-10: 4-2-3-1 nach Stammposition (DFLGenerator.CFG.startelf), nur mit Ausfällen und Rückstand
      const elf = G.startelfVon(kader), wert = p => p.ovr - (opt.alle ? 0 : rueckstand(p) - kartenBonus(p));
      elf.forEach(p => w[BEREICH_STARTELF[p.pos]].push(wert(p)));
      return Object.assign({ def: b(w.def), mid: b(w.mid), att: b(w.att), ovr: m(elf.map(wert)), elf, stil, formation: '4-2-3-1' }, tr);
    }
    const kopie = opt.alle ? kader.map(p => Object.assign({}, p, { reha: 0 })) : kader;
    let best = null;
    formationenFuer(team, opt).forEach(f => {
      const e = besetze(CFG.formationen[f], kopie);
      if (!best || e.wert > best.wert + 1e-9) best = Object.assign(e, { f });
    });
    const plaetze = CFG.formationen[best.f];
    plaetze.forEach((z, i) => w[BEREICH_STARTELF[z] || 'mid'].push(best.werte[i]));
    const elf = opt.alle ? best.elf.map(q => q && kader[kopie.indexOf(q)]) : best.elf;
    return Object.assign({ def: b(w.def), mid: b(w.mid), att: b(w.att), ovr: best.wert, elf: elf.filter(Boolean), stil, formation: best.f,
      plaetze: elf, werte: best.werte, luecken: best.luecken }, tr);
  }
  // Torerwartung [Gastgeber, Gast] = Basis × Heimvorteil × Stilfaktor. heim: Faktor für den Gastgeber (0 oder 1 = neutral)
  function basis(d) { return Math.max(CFG.spiel.min, CFG.spiel.basis + d / CFG.spiel.teiler); }
  function toreErwartet(H, A, heim, spieltag) {
    const kante = (H.mid - A.mid) / 30 * 6;
    const h = heim > 0 ? heim : 1;
    let lh = basis((H.att - A.def) + kante) * h, la = basis((A.att - H.def) - kante);
    if (H.stil && A.stil && !CFG.stil.aus) { lh *= stilFaktor(H.stil, A.stil, spieltag).mult; la *= stilFaktor(A.stil, H.stil, spieltag).mult; }
    // D118: Standardtrainer – nur der Anteil der Standardtore ändert sich (Engine: Faktor auf Abschlüsse aus Standards)
    const Tr = trainer();
    if (Tr && (H.std || A.std)) { lh *= Tr.formelFaktor(H.std, A.std); la *= Tr.formelFaktor(A.std, H.std); }
    return [lh, la];
  }
  // ── Spielstil (D55) ──────────────────────────────────────────────────────
  const KREIS = ['pressing', 'ballbesitz', 'fluegel', 'direkt'];
  function duell(a, b) {
    const i = KREIS.indexOf(a), j = KREIS.indexOf(b);
    if (i < 0 || j < 0 || i === j) return 0;
    return (i + 1) % 4 === j ? 1 : (j + 1) % 4 === i ? -1 : 0;
  }
  function wechselKosten(von, nach) {
    if (!von || von === nach) return 1;
    return Math.abs(KREIS.indexOf(von) - KREIS.indexOf(nach)) === 2 ? CFG.stil.gegenueber : CFG.stil.nachbar;
  }
  // stil: { key, spieler (± Prozent), formPasst, eing (0–1) oder eing0 + Spieltag }; gegner: dasselbe vom Gegner (nur key zählt)
  function stilFaktor(stil, gegner, spieltag) {
    const C = CFG.stil;
    const eing = stil.eing != null ? stil.eing : Math.min(1, (stil.eing0 != null ? stil.eing0 : 1) + (stil.jeSpiel != null ? stil.jeSpiel : C.jeSpiel) * (spieltag || 0));
    const kreis = duell(stil.key, gegner && gegner.key) * C.kreis;
    const formation = stil.formPasst === false ? -C.formation : C.formation;
    const spieler = Math.max(-C.spieler, Math.min(C.spieler, stil.spieler || 0));
    const roh = kreis + formation + spieler, summe = roh > 0 ? roh * eing : roh;
    return { kreis, formation, spieler, eing, roh, summe, mult: 1 + summe / 100 };
  }
  function spiel(r, H, A, neutral, spieltag) {
    const [lh, la] = toreErwartet(H, A, neutral ? 0 : CFG.heimvorteil, spieltag);
    return [poisson(r, lh), poisson(r, la)];
  }
  // K.-o.-Spiel: Verlängerung, dann Elfmeterschießen (leicht nach Stärke gewichtet)
  function koSpiel(r, H, A, neutral) {
    let [gh, ga] = spiel(r, H, A, neutral, 26);                      // Playoffs: nach 26 Spieltagen eingewöhnt
    let art = 'regulär';
    if (gh === ga) {
      const [lh, la] = toreErwartet(H, A, neutral ? 0 : CFG.heimvorteil, 26);
      gh += poisson(r, lh / 3); ga += poisson(r, la / 3); art = 'Verlängerung';
      // D118: Sportpsychologe +1 Punkt je Stern und Schütze ≈ +1,5 Punkte Siegchance im Schießen
      if (gh === ga) { art = 'Elfmeterschießen'; return { gh, ga, art, heimSiegt: r() < 0.5 + (H.ovr - A.ovr) * 0.005 + ((H.elfer || 0) - (A.elfer || 0)) * 1.5 }; }
    }
    return { gh, ga, art, heimSiegt: gh > ga };
  }

  // ── Verletzungen und Medizin (D102) ──────────────────────────────────────
  // Felder am Weltspieler: aus (Restwochen), ausGes (Wochen der Verletzung), ausTyp, ausFrisch (im Spiel verletzt: verpasst
  // zuerst das nächste Spiel), reha (Rückstand in Stärkepunkten, baut sich ab), rehaStart, ir (Verletztenliste der KI),
  // ersatzFuer (Ersatzspieler), saisonAusW (verletzte Wochen der Saison → Körperalter). Felder fehlen, solange sie 0 sind.
  const V = () => CFG.verletzung;
  // D118: Trainerteam (dfl_trainer.js, optional – ohne das Modul rechnet alles wie vorher)
  const trainer = () => (typeof window !== 'undefined' && window.DFLTrainer && window.DFLTrainer.CFG.aktiv) ? window.DFLTrainer : null;
  const physVon = t => { const Tr = trainer(); return Tr && t ? Tr.physio(t) : 0; };
  const traitF = (fn, p) => (typeof window !== 'undefined' && typeof window[fn] === 'function') ? window[fn](p) : 1;
  function medizinStart(a) {
    const s = V().start;
    return Math.max(s.min, Math.min(s.max, Math.round((((a && a.training) || 5) + ((a && a.scouting) || 5)) / 2) - 1));
  }
  // Medizin-Stufe eines Vereins der Welt (fehlt sie – alte Spielstände, neue Liga –, gilt die Startstufe)
  function medStufe(t) {
    const a = t && t.anlagen;
    if (!a) return 1;
    if (!(a.medizin >= 1)) a.medizin = medizinStart(a);
    return Math.max(1, Math.min(V().med.max, a.medizin));
  }
  function zieheTyp(r, liste) {
    let x = r() * liste.reduce((s, t) => s + t.w, 0);
    for (const t of liste) { x -= t.w; if (x <= 0) return t; }
    return liste[liste.length - 1];
  }
  // Faktor auf das Risiko einer neuen Verletzung: Eigenschaften, Körperalter über 29, Medizin, Bremse (offen = Verletzte im Kader)
  // phys: Sterne Athletik & Physio (D118) – zusammen mit der Medizin höchstens −35 % (DFLTrainer.risikoAbzug)
  function risikoFaktor(p, med, offen, phys) {
    const C = V(), D = C.deckel;
    if (offen >= D.hartAb) return 0;
    let f = traitF('traitVerletzungsFaktor', p);
    const ka = koerperAlter(p);
    if (ka > C.alter.ab) f *= 1 + C.alter.risiko * (ka - C.alter.ab);
    const Tr = trainer(), medAbzug = C.med.risiko * (med - 1);
    f *= 1 - (Tr && phys ? Tr.risikoAbzug(medAbzug, phys) : medAbzug);
    if (offen >= D.weichAb) f *= Math.pow(D.daempfung, offen - D.weichAb + 1);
    return f;
  }
  // Art und Dauer würfeln – für KI und eigenen Verein gleich (der setzt das Ergebnis an seine eigenen Felder).
  // ohneMedizin: Dauer auf Stufe 1 (für die Meldung „Medizin: eine Woche kürzer“), gemildert: die schwere Art vorher
  function wuerfleVerletzung(r, p, med) {
    const C = V();
    let typ = zieheTyp(r, C.typen), gemildert = null;
    if (typ.min >= C.schwerAb && r() < C.med.schwer * (med - 1)) { gemildert = typ.name; typ = zieheTyp(r, C.typen.filter(x => x.min < C.schwerAb)); }
    const ka = koerperAlter(p);
    const roh = (typ.min + r.int(0, typ.max - typ.min)) * traitF('traitHeilFaktor', p) * (1 + C.alter.heil * Math.max(0, ka - C.alter.ab));
    return { typ: typ.name, wochen: Math.max(1, Math.round(roh * (1 - C.med.dauer * (med - 1)))), ohneMedizin: Math.max(1, Math.round(roh)), gemildert };
  }
  // Rückstand bei der Rückkehr nach `wochen` Ausfall; Tempo des Abbaus je Woche (ohne Einsatz)
  function rehaStartWert(wochen) { const R = V().reha; return wochen < R.ab ? 0 : Math.min(R.max, Math.floor(wochen * R.faktor)); }
  function rehaTempo(p, med, phys) {
    const R = V().reha, ka = koerperAlter(p), Tr = trainer();
    return R.tempo * (1 + V().med.reha * ((med || 1) - 1)) * (Tr && phys ? Tr.rehaFaktor(phys) : 1) * (p.age <= R.jungBis ? R.jung : ka >= R.altAb ? R.alt : 1);
  }
  // Bleibender Rest nach mindestens 12 Wochen: { ovr, pot } (Abzüge) oder null
  function bleibenderRest(r, p, wochen, med) {
    const C = V().rest;
    if (wochen < C.ab || r() >= C.chance * (1 - V().med.rest * ((med || 1) - 1))) return null;
    const ovr = p.age >= C.altAb ? r.int(1, 2) : 1;
    return { ovr, pot: p.age <= C.jungBis ? r.int(1, 2) : ovr };
  }
  function rehaSchritt(p, menge) {
    if (!(p.reha > 0)) return;
    p.reha = Math.round((p.reha - menge) * 100) / 100;
    if (!(p.reha > 0.01)) { delete p.reha; delete p.rehaStart; }
  }
  // Saisonzähler je Verein (Medizin-Rendite der KI, Vergleich im Spiel, Messung)
  const neuerZaehler = () => ({ n: 0, wochen: 0, lang: 0, kreuzband: 0, rest: 0, ersatz: 0, anpfiff: 0, spiele: 0 });
  function zaehle(t, v) {
    if (!t) return;
    const z = t.verl = t.verl || neuerZaehler();
    z.n++; z.wochen += v.wochen; if (v.wochen >= 10) z.lang++; if (v.typ === 'Kreuzbandriss') z.kreuzband++;
  }
  function verletzeWelt(r, p, t, quelle) {
    const v = wuerfleVerletzung(r, p, medStufe(t));
    p.aus = v.wochen; p.ausGes = v.wochen; p.ausTyp = v.typ;
    if (quelle === 'spiel') p.ausFrisch = 1; else delete p.ausFrisch;
    zaehle(t, v);
    return Object.assign(v, { p, t: t ? t.id : null, quelle });
  }
  // Rückkehr: Rückstand = halbe Ausfallwochen (ein älterer, größerer Rückstand bleibt), bleibender Rest, Verletztenliste endet
  function rueckkehrWelt(r, p, t) {
    const med = t ? medStufe(t) : 1, w = p.ausGes || 0, typ = p.ausTyp || null;
    delete p.aus; delete p.ausFrisch; delete p.ausGes; delete p.ausTyp; delete p.ir;
    const R = Math.max(rehaStartWert(w), p.reha || 0);
    if (R > 0) { p.reha = R; p.rehaStart = Math.max(R, p.rehaStart || 0); } else { delete p.reha; delete p.rehaStart; }
    const rest = bleibenderRest(r, p, w, med);
    if (rest) {
      G.setzeOvr(p, Math.max(35, p.ovr - rest.ovr));
      p.truePotential = Math.max(p.ovr, (p.truePotential || p.ovr) - rest.pot);
      if (t) (t.verl = t.verl || neuerZaehler()).rest++;
    }
    return { p, t: t ? t.id : null, typ, wochen: w, reha: R, rest };
  }
  // Ein Verein hat nach einer Rückkehr mehr aktive Spieler als sein Kaderziel (D110: 28/26/25 nach Lage): der schwächste Ersatzmann geht
  // wieder (Mindestvertrag ohne Handgeld → kein Dead Cap); sonst regelt der Kaderschnitt der nächsten Offseason den Rest
  function kaderNachRueckkehr(L, t) {
    const weg = [];
    while (t.roster.filter(p => !p.ir).length > G.kaderZiel(t)) {
      const e = t.roster.filter(p => p.ersatzFuer && !p.ir && p.contract).sort((a, b) => a.ovr - b.ovr)[0];
      if (!e) break;
      entlasse(t, e); delete e.ersatzFuer; e._exVerein = t.id;
      (L.freie = L.freie || []).push(e); weg.push({ p: e, t: t.id });
    }
    return weg;
  }
  // Eine Woche: Verletzte heilen (wer im Spiel verletzt wurde, verpasst erst das nächste Spiel), Rückkehr mit Rückstand,
  // Rückstand baut sich ab, Trainingsverletzungen (Vorbereitung bis Woche 5 etwas mehr), Vereinslose heilen mit.
  // opt: { ohne: Set der Vereine, die das Spiel selbst führt · training: false = ohne neue Verletzungen }
  function verletzungWoche(L, r, woche, opt) {
    opt = opt || {};
    const C = V(), aus = { neu: [], zurueck: [], entlassen: [] };
    if (!C.aktiv) return aus;
    L.teams.forEach(t => {
      if (opt.ohne && opt.ohne.has(t.id)) return;
      const med = medStufe(t), alle = t.roster.concat(t.practice_squad || []), ph = physVon(t);
      let zurueck = false;
      alle.forEach(p => {
        if (p.aus > 0) {
          if (p.ausFrisch) delete p.ausFrisch; else p.aus--;
          p.saisonAusW = (p.saisonAusW || 0) + 1;
          if (!(p.aus > 0)) { aus.zurueck.push(rueckkehrWelt(r, p, t)); zurueck = true; }
        } else if (p.reha > 0) rehaSchritt(p, rehaTempo(p, med, ph));
      });
      if (zurueck) aus.entlassen.push(...kaderNachRueckkehr(L, t));
      if (opt.training === false) return;
      const risiko = woche <= C.vorbereitungBis ? C.vorbereitung : C.training;
      let offen = t.roster.filter(p => p.aus > 0).length;
      alle.forEach(p => {
        if (p.aus > 0 || p.ir) return;
        if (r() < risiko * risikoFaktor(p, med, offen, ph)) { aus.neu.push(verletzeWelt(r, p, t, 'training')); if (!p.perspektiv) offen++; }
      });
    });
    (L.freie || []).forEach(p => {
      if (p.aus > 0) { delete p.ausFrisch; p.aus--; if (!(p.aus > 0)) rueckkehrWelt(r, p, null); }
      else if (p.reha > 0) rehaSchritt(p, rehaTempo(p, 1));
    });
    return aus;
  }
  // Verletzungen eines Spiels für eine Elf (art 'liga' | 'playoff' | 'test'); der Einsatz baut Rückstand zusätzlich ab
  function spielVerletzungen(L, r, t, elf, art) {
    const C = V(), neu = [];
    if (!C.aktiv || !t || !elf) return neu;
    const med = medStufe(t), ph = physVon(t);
    let offen = t.roster.filter(p => p.aus > 0).length;
    elf.forEach(p => {
      if (!p || p.aus > 0) return;
      if (p.reha > 0) rehaSchritt(p, C.reha.spiel * rehaTempo(p, med, ph));
      if (r() < C.spiel * (art === 'test' ? C.test : 1) * risikoFaktor(p, med, offen, ph)) { neu.push(verletzeWelt(r, p, t, 'spiel')); offen++; }
    });
    return neu;
  }
  // KI: Langzeitausfall (ab CFG.verletzung.ersatzAb Wochen) → Verletztenliste (zählt nicht gegen die 28) und Ersatz derselben
  // Position aus den Vereinslosen (Mindestvertrag, 1 Jahr), wenn Kaderplatz und Cap es zulassen
  function ersatzPruefen(L, t) {
    const C = V(), neu = [];
    if (!C.aktiv || !t) return neu;
    t.roster.slice().forEach(p => {
      if (p.ir || !(p.aus >= C.ersatzAb)) return;
      p.ir = true;
      if (t.roster.filter(x => !x.ir).length >= G.kaderZiel(t)) return;            // D110: bis zum Kaderziel der Lage
      if (G.capHitTeam(t) + G.CFG.mindestgehalt > t.salary_cap_limit) return;
      // gleiche Position, sonst dieselbe auf der anderen Seite (D95: LV für RV)
      const frei = (L.freie || []).filter(x => x.age <= 33 && verfuegbar(x)).sort((a, b) => b.ovr - a.ovr);
      const kand = frei.find(x => x.pos === p.pos) || frei.find(x => G.grund(x.pos) === G.grund(p.pos) && G.grund(p.pos) !== p.pos);
      if (!kand) return;
      L.freie.splice(L.freie.indexOf(kand), 1);
      unterschreibe(L, t, kand, minVertrag(1));
      kand.ersatzFuer = p.id;
      (t.verl = t.verl || neuerZaehler()).ersatz++;
      neu.push({ t: t.id, fuer: p, p: kand });
    });
    return neu;
  }
  // Sommerpause: heilt CFG.verletzung.sommer Wochen, der Rückstand baut sich weiter ab; die Verletztenliste der KI endet
  function sommerpause(L, r, opt) {
    const C = V();
    if (!C.aktiv) return;
    const heile = (p, t) => {
      delete p.ir; delete p.ausFrisch;
      const med = t ? medStufe(t) : 1, ph = physVon(t);
      if (p.aus > 0) {
        const vorher = p.aus;
        p.aus -= C.sommer;
        if (!(p.aus > 0)) { rueckkehrWelt(r, p, t); rehaSchritt(p, (C.sommer - vorher) * rehaTempo(p, med, ph)); }
      } else if (p.reha > 0) rehaSchritt(p, C.sommer * rehaTempo(p, med, ph));
    };
    L.teams.forEach(t => {
      if (opt && opt.ohne && opt.ohne.has(t.id)) return;
      t.roster.concat(t.practice_squad || []).forEach(p => heile(p, t));
    });
    (L.freie || []).forEach(p => heile(p, null));
  }
  // Saisonende: Ausfallwochen je Verein in den Verlauf (Medizin-Rendite der KI, höchstens 3 Saisons), Zähler neu
  function verletzungSaisonEnde(L) {
    L.teams.forEach(t => {
      const v = t.verl || neuerZaehler();
      if (V().aktiv) { (t.ausfallVerlauf = t.ausfallVerlauf || []).push(v.wochen || 0); if (t.ausfallVerlauf.length > 3) t.ausfallVerlauf.shift(); }
      t.verlVorjahr = v; t.verl = neuerZaehler();
    });
  }
  // Kalender wie im Spiel: Liga-Wochen ab Woche 6 ohne Pausen (26 Spieltage)
  function ligaWochen() {
    const K = V().kalender, w = [];
    const n = 26 + (CFG.bye && CFG.bye.je > 0 ? CFG.bye.je : 0);
    for (let x = K.start; w.length < n && x <= 60; x++) if (K.pausen.indexOf(x) < 0) w.push(x);
    return w;
  }

  // ── Positionen lernen (L3, CFG.lernen) ──────────────────────────────────────────────────────────────────────────────────
  // Ein Startelf-Einsatz von p auf `platz` (Kürzel wie die Positionen des Spielers: Welt OM, Spiel ZOM). Rückgabe { art: 'neben' | 'haupt',
  // pos, alt } bei einer Änderung, sonst null
  function lerneEinsatz(p, platz) {
    const C = CFG.lernen;
    if (!C.aktiv || !p || !platz) return null;
    const z = G.dflPos(platz), liste = G.positionenVon(p).slice(), info = G.positionsAbzug(liste, z);
    if (z === 'TW' || info.art === 'stamm' || info.art === 'torwart') return null;
    const e = p.posEinsaetze = p.posEinsaetze || {};
    e[z] = (e[z] || 0) + 1;
    const haupt = G.dflPos(p.pos);
    if (e[z] >= C.haupt && G.POS_BEREICH[z] && G.POS_BEREICH[z] === G.POS_BEREICH[haupt]) {
      p.positions = [platz].concat(liste.filter(x => G.dflPos(x) !== z));
      p.pos = platz;
      delete e[z];
      return { art: 'haupt', pos: z, alt: haupt };
    }
    if (info.art === 'fremd' && e[z] >= C.neben && liste.length < C.max) {
      p.positions = liste.concat([platz]);
      return { art: 'neben', pos: z };
    }
    return null;
  }
  // KI eines Spieltags: Elf der Welt je Platz (werte[t.id] aus teamWerte); eigener Verein (t.eigen) und `ohne` lernen im Spiel
  function lernenSpieltag(L, werte, ohne) {
    if (!CFG.lernen.aktiv || !werte) return [];
    const aus = [];
    L.teams.forEach(t => {
      if (t.eigen || (ohne && ohne.has && ohne.has(t.id))) return;
      const w = werte[t.id], pl = w && CFG.formationen[w.formation];
      if (!w || !w.plaetze || !pl) return;
      w.plaetze.forEach((p, i) => { const x = p && pl[i] ? lerneEinsatz(p, pl[i]) : null; if (x) aus.push(Object.assign({ t, p }, x)); });
    });
    return aus;
  }

  // Formation je Verein (nominal, alle Spieler): danach richtet die KI ihren Bedarf aus (DFLGenerator.startSoll)
  function formationenSetzen(L) {
    if (!CFG.staerke.formation) return;
    L.teams.forEach(t => { if (t.roster && t.roster.length >= 11 && t.taktik && t.taktik.stil) t.formation = teamWerte(t, { alle: true }).formation; });
  }

  // ── Saison ───────────────────────────────────────────────────────────────
  function leereTabelle(teams) {
    const t = {};
    teams.forEach(x => { t[x.id] = { id: x.id, pts: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0 }; });
    return t;
  }
  function sortiereTabelle(zeilen, los) {
    return zeilen.slice().sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || los[a.id] - los[b.id]);
  }
  // opt.nachSpieltag(L, i, werte, plan): Haken für Messungen (Langzeitlauf, Werkzeuge) · opt.ohneErsatz: Vereine ohne automatischen
  // Ersatz bei Langzeitausfall (wie der eigene Verein im Spiel – Messung des Kaderbedarfs)
  function simuliereSaison(L, r, opt) {
    opt = opt || {};
    const teams = L.teams;
    // D55: Stil, Spielerpassung und Eingewöhnung der KI vor der Saison (DFLHandel ist im Spiel und im Langzeitlauf geladen)
    const Hd = typeof window !== 'undefined' && window.DFLHandel;
    if (Hd && Hd.stilAktualisieren) Hd.stilAktualisieren(L);
    formationenSetzen(L);
    let werte = {};
    const tab = leereTabelle(teams);
    const plan = spielplan(teams, L.saisonIndex || 0, r);
    const ergebnisse = plan.map(() => []);           // je Spieltag [heim, gast, toreHeim, toreGast]
    const frei = i => { const d = new Set(plan[i].flat()); return new Set(teams.filter(t => !d.has(t.id)).map(t => t.id)); };   // Bye Week
    const spieltag = i => plan[i].forEach(([h, g]) => {
      const [gh, ga] = spiel(r, werte[h], werte[g], false, i);
      ergebnisse[i].push([h, g, gh, ga]);
      const H = tab[h], A = tab[g];
      H.gf += gh; H.ga += ga; A.gf += ga; A.ga += gh;
      if (gh > ga) { H.pts += 3; H.w++; A.l++; } else if (gh < ga) { A.pts += 3; A.w++; H.l++; } else { H.pts++; A.pts++; H.d++; A.d++; }
    });
    if (!V().aktiv) {
      teams.forEach(t => { werte[t.id] = teamWerte(t); });
      plan.forEach((tag, i) => { spieltag(i); lernenSpieltag(L, werte, frei(i)); if (opt.nachSpieltag) opt.nachSpieltag(L, i, werte, plan); });
    } else {
      // D102: Woche für Woche wie im Spiel – Training, Testspiele (Woche 2–4), Ligaspiele mit der verfügbaren Elf; Verletzungen
      // mit eigenem Zufall (die Ergebnisse ziehen weiter aus r)
      const r2 = G.rngAus((Math.floor(r() * 4294967296) >>> 0) || 1);
      const wochen = ligaWochen(), einsaetze = new Map(), K = V().kalender;
      for (let w = 1; w <= wochen[wochen.length - 1]; w++) {
        verletzungWoche(L, r2, w);
        if (K.test.indexOf(w) >= 0) teams.forEach(t => spielVerletzungen(L, r2, t, teamWerte(t).elf, 'test'));
        const i = wochen.indexOf(w);
        if (i < 0 || i >= plan.length) continue;
        werte = {};
        const dabei = new Set(plan[i].flat());
        teams.forEach(t => {
          werte[t.id] = teamWerte(t);
          if (!dabei.has(t.id)) return;
          const z = t.verl = t.verl || neuerZaehler();
          z.anpfiff += t.roster.filter(p => p.aus > 0).length; z.spiele++;
        });
        spieltag(i);
        lernenSpieltag(L, werte, frei(i));
        if (opt.nachSpieltag) opt.nachSpieltag(L, i, werte, plan);
        // D118: Winterpause – Trainermarkt (im Spiel: Woche 26, dfl_trainerteam_patch.js)
        if (i === Math.floor(plan.length / 2) - 1) { const Tr = trainer(); if (Tr) Tr.winter(L, Tr.rngVon(L, 'winter'), { ohne: opt.ohneErsatz || [] }); }
        const spielen = new Set(plan[i].flat());
        teams.forEach(t => {
          if (!spielen.has(t.id)) return;                // Bye Week: kein Einsatz, keine Spielverletzung
          werte[t.id].elf.forEach(p => einsaetze.set(p, (einsaetze.get(p) || 0) + 1));
          spielVerletzungen(L, r2, t, werte[t.id].elf, 'liga');
          if (!(opt.ohneErsatz && opt.ohneErsatz.indexOf(t.id) >= 0)) ersatzPruefen(L, t);
        });
      }
      // Playoffs: Stärke am letzten Spieltag; als „Startelf“ (Entwicklung, Körperalter) die 11 mit den meisten Einsätzen
      teams.forEach(t => {
        werte[t.id] = Object.assign({}, werte[t.id], { elf: t.roster.slice().sort((a, b) => (einsaetze.get(b) || 0) - (einsaetze.get(a) || 0)).slice(0, 11) });
      });
    }
    Object.values(tab).forEach(z => { z.gd = z.gf - z.ga; });
    const los = {}; teams.forEach(t => { los[t.id] = r(); });
    return { tabelle: tab, los, werte, plan, ergebnisse };
  }

  // ── Playoffs ─────────────────────────────────────────────────────────────
  function playoffs(L, saison, r) {
    const byId = new Map(L.teams.map(t => [t.id, t]));
    const setzliste = {};
    for (const konf of ['SUE_WEST', 'NORD_OST']) {
      const zeilen = Object.values(saison.tabelle).filter(z => byId.get(z.id).conference === konf);
      const divs = [...new Set(L.teams.filter(t => t.conference === konf).map(t => t.division))];
      const sieger = divs.map(d => sortiereTabelle(zeilen.filter(z => byId.get(z.id).division === d), saison.los)[0]);
      const siegerSort = sortiereTabelle(sieger, saison.los);
      const rest = sortiereTabelle(zeilen.filter(z => sieger.indexOf(z) < 0), saison.los).slice(0, 3);
      setzliste[konf] = [...siegerSort, ...rest].map(z => z.id);
    }
    const ausgeschieden = {};       // teamId → Runde (1–4), Meister = 5
    const runden = [];
    const W = saison.werte, P = CFG.playoffs, F = P.frische, frisch = {};
    // D166: müde aus der englischen Woche – Abzug auf Abwehr, Mitte, Angriff
    const mit = id => {
      const f = frisch[id] != null ? frisch[id] : F.start, m = f >= F.ab ? 0 : F.abzug * Math.min(1, (F.ab - f) / (F.ab - F.boden));
      return m ? Object.assign({}, W[id], { def: W[id].def - m, mid: W[id].mid - m, att: W[id].att - m, ovr: W[id].ovr - m }) : W[id];
    };
    const belasten = (...ids) => ids.forEach(id => { frisch[id] = (frisch[id] != null ? frisch[id] : F.start) - F.spiel; });
    const erholen = wochen => Object.keys(W).forEach(id => { if (frisch[id] != null) frisch[id] = Math.min(100, frisch[id] + F.woche * wochen); });
    const duell = (a, b, neutral, runde) => {
      let e, hin = null;
      if (!neutral && P.zweiBeine.indexOf(runde) >= 0) {
        const [hb, ha] = spiel(r, mit(b), mit(a), false, 26);    // Hinspiel beim schlechteren Seed
        belasten(a, b);
        hin = { gh: ha, ga: hb };
        const H = mit(a), A = mit(b);
        let [gh, ga] = spiel(r, H, A, false, 26), art = 'regulär', heimSiegt;
        if (gh + ha === ga + hb) {
          const [lh, la] = toreErwartet(H, A, CFG.heimvorteil, 26);
          gh += poisson(r, lh / 3); ga += poisson(r, la / 3); art = 'Verlängerung';
          if (gh + ha === ga + hb) { art = 'Elfmeterschießen'; heimSiegt = r() < 0.5 + (H.ovr - A.ovr) * 0.005 + ((H.elfer || 0) - (A.elfer || 0)) * 1.5; }
        }
        if (heimSiegt == null) heimSiegt = gh + ha > ga + hb;
        e = { gh, ga, art, heimSiegt };
      } else e = koSpiel(r, mit(a), mit(b), neutral);
      belasten(a, b);
      const sieger = e.heimSiegt ? a : b, verlierer = e.heimSiegt ? b : a;
      ausgeschieden[verlierer] = runde;
      runden.push(Object.assign({ runde, heim: a, gast: b, gh: e.gh, ga: e.ga, art: e.art, sieger }, hin ? { hin } : {}));
      return sieger;
    };
    // Runde für Runde über beide Conferences (Frische: eine Woche je Runde, Pause vor dem Finale)
    const konfMeister = {}, K = ['SUE_WEST', 'NORD_OST'], seed = (konf, id) => setzliste[konf].indexOf(id), r1 = {}, r2 = {};
    K.forEach(konf => { const s = setzliste[konf]; frisch[s[0]] = F.start; r1[konf] = [duell(s[1], s[6], false, 1), duell(s[2], s[5], false, 1), duell(s[3], s[4], false, 1)]; });
    erholen(1);
    K.forEach(konf => {
      const s = setzliste[konf], uebrig = [s[0], ...r1[konf]].sort((a, b) => seed(konf, a) - seed(konf, b));
      // Setzplatz 1 gegen das schlechteste verbliebene Team (Re-Seeding)
      r2[konf] = [duell(uebrig[0], uebrig[3], false, 2), duell(uebrig[1], uebrig[2], false, 2)].sort((a, b) => seed(konf, a) - seed(konf, b));
    });
    erholen(1);
    K.forEach(konf => { konfMeister[konf] = duell(r2[konf][0], r2[konf][1], false, 3); });
    erholen(1 + P.pauseVorFinale);
    const meister = duell(konfMeister.SUE_WEST, konfMeister.NORD_OST, true, 4);
    ausgeschieden[meister] = 5;
    return { setzliste, runden, meister, finalist: meister === konfMeister.SUE_WEST ? konfMeister.NORD_OST : konfMeister.SUE_WEST, ausgeschieden };
  }

  // Draft-Reihenfolge (Konzept 6.6): Nicht-Playoff-Teams nach Punkten aufsteigend,
  // dann Playoff-Teams nach Ausscheiderunde, Meister zuletzt
  function draftReihenfolge(L, saison, po) {
    const tab = saison.tabelle, los = saison.los;
    const schwaecherZuerst = (a, b) => tab[a].pts - tab[b].pts || tab[a].gd - tab[b].gd || tab[a].gf - tab[b].gf || los[b] - los[a];
    const ohne = L.teams.map(t => t.id).filter(id => !(id in po.ausgeschieden)).sort(schwaecherZuerst);
    const mit = [];
    for (let runde = 1; runde <= 5; runde++) {
      mit.push(...Object.keys(po.ausgeschieden).filter(id => po.ausgeschieden[id] === runde).sort(schwaecherZuerst));
    }
    return [...ohne, ...mit];
  }

  // ── Kader-Hilfen ─────────────────────────────────────────────────────────
  const capHit = p => G.capHitSpieler(p);
  const capTeam = t => G.capHitTeam(t);
  const capFrei = t => t.salary_cap_limit - capTeam(t);
  // D110: Lage eines Vereins (festgehalten zum Saisonwechsel, DFLHandel.lagenSetzen) und Grenze in der Free Agency: Ziel + 2, höchstens 30
  const lageVon = t => (t && t.lage && t.lage.key) || 'mittelfeld';
  const faGrenze = t => Math.min(CFG.kader + 2, G.kaderZiel(t) + 2);
  // Free Agency nach Lage (D110): Nutzen, Gebot und Vertragslänge
  function faNutzenLage(t, p, n) {
    if (n <= 0) return n;
    const k = lageVon(t), C = CFG.lage.fa[k];
    if (!C) return n;
    if (k === 'neuaufbau') {
      if (p.age >= C.altAb) return n >= C.luecke ? n - C.alt : 0;           // ab 30 nur bei echter Lücke
      if (p.age <= C.jungBis) return n + C.jung;
    } else if (k === 'titel') {
      if (p.age >= C.altAb) return n + C.alt;
      if (p.age <= C.jungBis && p.ovr < G.teamOvr(t) - C.unter) return Math.max(0, n + C.jung);
    }
    return n;
  }
  const faGeldLage = (t, p) => { const C = CFG.lage.fa[lageVon(t)]; return C && C.geld && p.age >= C.altAb ? C.geld : 1; };
  function faVertragLage(t, p, f) {
    const C = CFG.lage.fa[lageVon(t)];
    return C && C.vertragAb && p.age >= C.vertragAb && f.jahre > C.jahre ? Object.assign({}, f, { jahre: C.jahre }) : f;
  }
  // Wert eines Spielers für sein Team (Stärke + Zukunft); Potenzial so, wie man es sieht (D103: Nieten mit alter Hoffnung)
  const potS = (p, t) => G.potSichtbar(p, t && t.anlagen ? t.anlagen.scouting : 5);
  function spielerWert(p) {
    const zukunft = p.age <= 24 ? (potS(p) - p.ovr) * 0.5 : 0;
    const alter = p.age >= 31 ? (p.age - 30) * 1.5 : 0;
    return p.ovr + zukunft - alter;
  }
  // Würde der Spieler die Startelf oder die Positionstiefe verbessern?
  function nutzenFuer(team, p) {
    const gleich = team.roster.filter(x => x.pos === p.pos).sort((a, b) => b.ovr - a.ovr);
    // Soll je Verein und Position (D95: LM/RM nach Formation, G.kaderSoll), Startelf nach der Formation des Stils
    // D110: Soll nach Kaderziel der Lage; eine Position mit Soll 0 (keine Formation des Vereins braucht sie) bleibt 0
    const ks = G.kaderSoll ? G.kaderSoll(team) : G.CFG.kader, soll = ks[p.pos] != null ? ks[p.pos] : 1;
    const start = (G.startSoll ? G.startSoll(team) : G.CFG.startelf)[p.pos] || 0;
    if (gleich.length < soll) return 2 + Math.max(0, (p.ovr - (gleich[soll - 1] ? gleich[soll - 1].ovr : 50)) / 4);
    const schwaechsterStammspieler = start ? gleich[start - 1] : null;
    if (schwaechsterStammspieler && p.ovr > schwaechsterStammspieler.ovr + 1) return 1 + (p.ovr - schwaechsterStammspieler.ovr) / 3;
    const schwaechster = gleich[gleich.length - 1];
    return schwaechster && spielerWert(p) > spielerWert(schwaechster) + 3 ? 0.5 : 0;
  }
  function vertragAus(f, kurzRest) {
    const jahre = f.jahre;
    return G.baueVertrag({ jahresWert: f.jahresWert, jahre, rest: kurzRest || jahre, staffelung: f.staffelung,
      handgeldAnteil: f.handgeldAnteil, garantiert: 0, art: f.jahresWert <= G.CFG.mindestgehalt ? 'minimum' : 'veteran' });
  }
  function unterschreibe(L, team, p, contract, bilanz) {
    if (p._exVerein !== team.id) p.vereinsJahre = 0;      // Vereinsjahre (Stimmung: Treue)
    p.contract = contract; p.teamId = team.id; delete p.perspektiv; delete p.faRunden; delete p.ersatzFuer; delete p.ir;
    p.wage = Math.round(contract.base_salary / 52); p.contractUntil = contract.years_remaining;
    team.roster.push(p);
    team._bar = (team._bar || 0) + contract.signing_bonus_total;      // Handgeld wird bei Unterschrift bar bezahlt
    if (bilanz) bilanz.n++;
  }
  // Entlassung nach Spec 3.2: nicht amortisierter Bonus wird sofort Dead Cap
  function entlasse(team, p) {
    const c = p.contract;
    const proJahr = c.signing_bonus_total / c.years_total;
    const erledigt = c.years_total - c.years_remaining;
    const rest = c.signing_bonus_total - proJahr * erledigt;
    team.dead_cap_total = (team.dead_cap_total || 0) + rest;
    team.roster.splice(team.roster.indexOf(p), 1);
    p.teamId = null; p.contract = null;
    return rest;
  }
  const titelkandidaten = L => new Set(L.teams.slice().sort((a, b) => G.teamOvr(b) - G.teamOvr(a)).slice(0, 8).map(t => t.id));


  // ── Saisonwechsel in Phasen ──────────────────────────────────────────────
  // Das Spiel ruft die Phasen einzeln auf (Draft als Dialog, Free Agency in Wellen über das
  // Sommerfenster), der Langzeitlauf alle hintereinander. W.ohne: Teams, die das Spiel selbst
  // verwaltet (eigener Verein) – sie werden in Entwicklung, Verträgen, Draft, Free Agency und
  // Kaderschnitt übersprungen.
  function neuerWechsel(opt) {
    opt = opt || {};
    return { opt, ohne: new Set(opt.ohne || []), analyse: {},
      U: Object.assign({}, CFG.untergrenze, opt.untergrenze || {}), C: Object.assign({}, CFG.cap, opt.cap || {}),
      st: { verlaengert: 0, fa: { n: 0 }, rookies: 0, entlassen: 0, deadCap: 0, ruhestand: 0, ruhestandFrei: 0, ausland: 0, ersatz: 0, nachzahlung: 0,
        nachzahlTeams: 0, ruhestandListe: [], perspektiv: 0, hochgezogen: 0, abgeworben: [], scouting: { auf: 0, ab: 0 } } };
  }
  const aktiv = (L, W) => L.teams.filter(t => !W.ohne.has(t.id));
  const klemme = (x, a, b) => Math.max(a, Math.min(b, x));
  // Zielwert setzen: zum Start die heutige Stärke (die Großen bleiben vorerst groß), Wechsel versetzt in 2–8 Jahren;
  // danach zufällig zwischen 75 und 92, große Stadien leicht höher (± Z.groesse)
  function zielPruefen(L, r, W) {
    const Z = CFG.ziel; if (!Z.aktiv) return;
    const idx = L.saisonIndex || 0;
    const spaet = idx + 1 >= Z.spaetAb;
    const spitze = spaet ? new Set(aktiv(L, W).slice().sort((a, b) => G.teamOvr(b) - G.teamOvr(a)).slice(0, Z.spitze).map(t => t.id)) : null;
    aktiv(L, W).forEach(t => {
      t._spitze = !!(spitze && spitze.has(t.id));
      if (!t.ziel) {
        t.ziel = { wert: klemme(Math.round(t.start_ovr || G.teamOvr(t)), Z.min, Z.max), bis: idx + r.int(2, Z.jahre[1]) };
      } else if (idx >= t.ziel.bis) {
        const groesse = Math.min(1, ((t.anlagen && t.anlagen.stadion) || 20000) / 80000) - 0.5;
        t.ziel = { wert: klemme(Math.round(Z.min + r() * (Z.max - Z.min) + groesse * Z.groesse + (t._spitze ? Z.spaetPlus : 0)), Z.min, Z.max),
          bis: idx + r.int(Z.jahre[0], Z.jahre[1]), vorher: t.ziel.wert };
        W.st.neueZiele = (W.st.neueZiele || 0) + 1;
      }
    });
  }
  // Druck Richtung Ziel: +1 = der Verein arbeitet klug nach oben, −1 = fragwürdige Entscheidungen nach unten
  function zielDruck(t) {
    if (!CFG.ziel.aktiv || !t || !t.ziel) return 0;
    const d = klemme((t.ziel.wert - G.teamOvr(t)) / CFG.ziel.spanne, -1, 1);
    return t._spitze ? Math.max(d, CFG.ziel.spaetDruck) : d;
  }
  const reserve = L => L.cap * 0.035;     // Platz für die eigenen Draft-Picks
  const PK = () => G.CFG.perspektiv;
  const pkTauglich = p => p.age <= PK().alterMax && p.ovr < PK().ovrMax;
  const pkVertrag = () => G.baueVertrag({ jahresWert: G.CFG.perspektivGehalt, jahre: 1, rest: 1, staffelung: 'gleich', handgeldAnteil: 0, art: 'perspektiv' });
  const minVertrag = jahre => G.baueVertrag({ jahresWert: G.CFG.mindestgehalt, jahre, rest: jahre, staffelung: 'gleich', handgeldAnteil: 0, art: 'minimum' });

  // Scouting veraltet ohne Investition (Wunsch 2026-10-07): alle 3 Saisons ohne Ausbau −1 Stufe;
  // Vereine investieren mit 15–30 % je Saison (große Märkte öfter, Neuaufbau-Teams auch)
  function scoutingEntwicklung(L, r, W) {
    const rang = new Map(L.teams.slice().sort((a, b) => G.teamOvr(b) - G.teamOvr(a)).map((t, i) => [t.id, i + 1]));
    aktiv(L, W).forEach(t => {
      const a = t.anlagen;
      a.scoutingAlter = (a.scoutingAlter || 0) + 1;
      // Mit Finanzmodell investiert der Verein selbst (DFLFinanzen.investieren), sonst Zufall wie bisher
      const chance = window.DFLFinanzen ? 0 : 0.15 + 0.1 * Math.min(1, (a.stadion || 20000) / 60000) + (rang.get(t.id) >= 23 ? 0.05 : 0);
      // D75: „veraltet“ geht im Zustand der Anlage auf (DFLFinanzen: leer = eine Stufe weniger)
      const zustand = window.DFLFinanzen && window.DFLFinanzen.anlagenAktiv && window.DFLFinanzen.anlagenAktiv();
      if (r() < chance && (a.scouting || 5) < 10) { a.scouting = (a.scouting || 5) + 1; a.scoutingAlter = 0; W.st.scouting.auf++; }
      else if (!zustand && a.scoutingAlter >= CFG.scoutingVeraltet && (a.scouting || 5) > 1) { a.scouting = (a.scouting || 5) - 1; a.scoutingAlter = 1; W.st.scouting.ab++; }
    });
  }

  // Phase 1: Abrechnung, neuer Cap, Entwicklung, Ruhestand, Abwerben, Vertragsende, Verlängerungen
  function phaseAbschluss(L, saison, r, W) {
    const { U, C, st } = W;
    const jahrAlt = L.saisonJahr;
    // D110: Lage zum Saisonwechsel festhalten (Rang der Stärke am Saisonende) – sie gilt für Kaderziel, Draft, Free Agency und Handel
    // bis zum nächsten Saisonwechsel
    const Hd = typeof window !== 'undefined' && window.DFLHandel;
    if (Hd && Hd.lagenSetzen) Hd.lagenSetzen(L);
    // Ausgaben der abgelaufenen Saison verbuchen. Mit Finanzmodell (D41): Cap Hits = Geld an die Spieler
    // (Handgeld in Raten über die Laufzeit) – wie beim eigenen Verein. Sonst Grundgehalt + Handgeld bei Unterschrift.
    const F = window.DFLFinanzen;
    L.teams.forEach(t => {
      const bar = F ? capTeam(t) : t.roster.reduce((s, p) => s + p.contract.base_salary + (p.contract.guaranteed_bonuses || 0), 0) + (t._bar || 0);
      (t.ausgaben = t.ausgaben || []).push({ jahr: jahrAlt, bar, cap: L.cap });
      if (t.ausgaben.length > 8) t.ausgaben.shift();
      t._bar = 0;
      t._ungenutzt = Math.max(0, t.salary_cap_limit - capTeam(t));
    });
    // Untergrenze alle 4 Jahre abrechnen: Fehlbetrag wird an die Spieler nachgezahlt.
    st.untergrenzeAktiv = U.aktiv;
    if (((L.saisonIndex || 0) + 1) % U.jahre === 0) {
      aktiv(L, W).forEach(t => {
        const fenster = t.ausgaben.slice(-U.jahre);
        const soll = U.anteil * fenster.reduce((s, x) => s + x.cap, 0), ist = fenster.reduce((s, x) => s + x.bar, 0);
        if (ist < soll) { st.nachzahlung += soll - ist; st.nachzahlTeams++; if (F && t.kasse != null) t.kasse -= soll - ist; }
      });
    }
    // D102: Ausfallwochen der Saison je Verein in den Verlauf – die KI baut die Medizin nach gesparten Gehältern aus
    verletzungSaisonEnde(L);
    // L3: KI wechselt den Stil, wenn ein anderer klar besser passt (vor Draft und Free Agency, damit sie danach planen)
    if (Hd && Hd.stilPruefen) st.stilWechsel = Hd.stilPruefen(L, W.ohne).length;
    formationenSetzen(L);                 // Bedarf der KI nach der Formation ihres Stils (Draft, Free Agency, Kaderschnitt)
    // Finanzen der KI-Vereine: Ergebnis der Saison, Kasse, Investitionen (D41; eigener Verein rechnet im Spiel)
    if (F) F.saisonAbschlussKI(L, sortiereTabelle(Object.values(saison.tabelle || {}), saison.los || {}), W.po, W.ohne, st);
    // Neuer Cap (D23) + Rollover; Dead Cap gilt pro Saison (C1)
    let wachstum = 0;
    if (C.aktiv) {
      wachstum = C.wachstum + r.normal(0, C.streuung);
      if (((L.saisonIndex || 0) + 1) % C.tvAlle === 0) wachstum += C.tvSprung;
      if (r() < C.kriseChance) wachstum = C.krise;
    }
    // Im Spiel steht der neue Cap schon fest (dfl_kader_patch.js: capWachstum) – sonst wie bisher mit Wachstum
    L.cap = W.neuerCap || Math.round(L.cap * (1 + wachstum) / 100000) * 100000;
    G.setzeCap(L.cap);
    L.teams.forEach(t => {
      t.salary_cap_limit = L.cap + Math.min(t._ungenutzt, CFG.rollover * L.cap);
      t.dead_cap_total = 0;
    });
    W.wachstum = wachstum;
    // Prestige: Erfolg der Saison (Playoff-Runde, sonst Tabellenplatz) mit Trägheit
    const zeilen = sortiereTabelle(Object.values(saison.tabelle || {}), saison.los || {});
    const rangVon = new Map(zeilen.map((z, i) => [z.id, i + 1])), aus = (W.po && W.po.ausgeschieden) || {};
    L.teams.forEach(t => {
      if (t.prestige == null) t.prestige = Math.max(0, Math.min(1, ((t.start_ovr || G.teamOvr(t)) - 72) / 20));
      const rang = rangVon.get(t.id) || 16;
      const erfolg = aus[t.id] ? 0.5 + aus[t.id] * 0.1 : 0.45 * (1 - (rang - 1) / 31);
      t.prestige = CFG.prestige.traegheit * t.prestige + (1 - CFG.prestige.traegheit) * erfolg;
    });
    L.saisonIndex = (L.saisonIndex || 0) + 1;
    L.saisonJahr = jahrAlt + 1;
    scoutingEntwicklung(L, r, W);
    zielPruefen(L, r, W);

    // Alter, Entwicklung, Verletzungsfolgen, Ruhestand
    const freie = L.freie = L.freie || [];
    const elfIds = new Set(), kaderIds = new Set();
    L.teams.forEach(t => {
      ((saison.werte[t.id] && saison.werte[t.id].elf) || G.startelfVon(t.roster, t)).forEach(p => elfIds.add(p.id));
      t.roster.slice().sort((a, b) => b.ovr - a.ovr).slice(0, 18).forEach(p => kaderIds.add(p.id));   // Spieltagskader
    });
    // Je Spieler abgesichert: ein fehlerhafter Datensatz darf nicht die ganze Offseason der Welt stoppen (Prüfung 2026-10-09)
    const entwickle = (p, training, druck, faktor, stil) => {
      try { entwicklung(r, p, elfIds.has(p.id), kaderIds.has(p.id), training, druck, faktor, stil); }
      catch (e) { if (typeof console !== 'undefined') console.warn('[DFL-Saison] Entwicklung übersprungen', p && p.id, e && e.message); }
    };
    // Karriereende nach Alter (TW zwei Jahre später) oder als schwacher Routinier; faktor > 1 für Vereinslose
    const hoertAuf = (p, faktor) => {
      // nach Körperalter (D68): fitte Stammspieler hören später auf, Bankspieler und oft Verletzte früher
      const alterEff = Math.round(koerperAlter(p)) - (p.pos === 'TW' ? CFG.ruhestandTwPlus : 0), chance = Math.min(1, (CFG.ruhestand[Math.min(39, alterEff)] || 0) * faktor);
      return (alterEff >= 33 && r() < chance) || (p.age >= 30 && p.ovr < 55 && r() < 0.5);
    };
    aktiv(L, W).forEach(t => {
      const druck = zielDruck(t), Tr = trainer(), ef = Tr ? Tr.entwFaktor(t) : 1;     // D118: Co-Trainer/Chefcoach
      t.roster.concat(t.practice_squad).forEach(p => entwickle(p, t.anlagen.training, druck, ef, t.taktik && t.taktik.stil));
      for (const p of t.roster.slice()) {
        if (hoertAuf(p, 1)) {
          // Karriereende: Restvertrag verfällt ohne Dead Cap (vereinfachend)
          t.roster.splice(t.roster.indexOf(p), 1); st.ruhestand++;
          p._exVerein = t.id; p.teamId = null; st.ruhestandListe.push(p);
        }
      }
    });
    freie.forEach(p => entwickle(p, 3));
    for (const p of freie.slice()) {
      if (!hoertAuf(p, CFG.ruhestandFrei)) continue;
      freie.splice(freie.indexOf(p), 1); st.ruhestand++; st.ruhestandFrei = (st.ruhestandFrei || 0) + 1;
      p.teamId = null; st.ruhestandListe.push(p);
    }
    // Abwerben: Talente mit großem Potenzial und Development-Squad-Vertrag locken andere Teams (Risiko des Squads);
    // wer seinen eigenen Vertrag (z. B. Rookie-Vertrag) mitgebracht hat, ist gebunden (D45)
    L.teams.forEach(t => {
      for (const p of t.practice_squad.slice()) {
        if (!p.contract || p.contract.art !== 'perspektiv' || potS(p) < PK().abwerbenAb || r() >= PK().abwerbenChance) continue;
        const kaeufer = aktiv(L, W).filter(x => x !== t && x.roster.length < faGrenze(x) && capFrei(x) > G.CFG.mindestgehalt * 2);
        if (!kaeufer.length) continue;
        const neu = r.pick(kaeufer);
        t.practice_squad.splice(t.practice_squad.indexOf(p), 1);
        p._exVerein = t.id;
        unterschreibe(L, neu, p, minVertrag(2));
        st.abgeworben.push({ p, von: t.id, an: neu.id });
      }
    });

    // Verträge laufen ein Jahr weiter; Auslaufende entscheiden sich
    const kandidaten = titelkandidaten(L);
    const markt = [];
    aktiv(L, W).forEach(t => {
      for (const p of t.roster.slice()) {
        const c = p.contract;
        c.years_remaining -= 1;
        p.vereinsJahre = (p.vereinsJahre || 0) + 1;
        // Wochenlohn mitführen: das Spiel übernimmt ihn bei Trades (zuSpielSpieler) – vorher blieb er beim Lohn des ersten
        // Vertragsjahrs stehen (Prüfung 2026-10-10: nach einer Offseason bei 35 % der Spieler falsch, Ø 0,3–0,8 Mio im Jahr)
        if (c.years_remaining > 0) { c.base_salary = c.base_salary_by_year[c.years_total - c.years_remaining]; p.wage = Math.round(c.base_salary / 52); p.contractUntil = c.years_remaining; continue; }
        t.roster.splice(t.roster.indexOf(p), 1);
        p.teamId = null; p.contract = null; p._exVerein = t.id;
        markt.push({ p, alt: t });
      }
      // Development-Squad-Verträge laufen jährlich und verlängern sich, solange der Spieler tauglich ist;
      // eigene Verträge laufen weiter wie im Kader und werden erst zum Ende zum Squad-Vertrag (D45)
      t.practice_squad.forEach(p => {
        const c = p.contract;
        if (c && c.art !== 'perspektiv' && c.years_remaining > 1) {
          c.years_remaining -= 1; c.base_salary = c.base_salary_by_year[c.years_total - c.years_remaining]; p.wage = Math.round(c.base_salary / 52); p.contractUntil = c.years_remaining; return;
        }
        p.contract = pkVertrag(); p.wage = Math.round(p.contract.base_salary / 52); p.contractUntil = 1;
      });
    });
    // Verlängerungen: Team will ihn (Wert und Rolle), Spieler will bleiben, der Cap reicht
    markt.sort((a, b) => spielerWert(b.p) - spielerWert(a.p));
    const zumMarkt = [];
    for (const { p, alt: t } of markt) {
      const v = p.vertragsprofil;
      const kandidat = kandidaten.has(t.id);
      // Spieler: Geldorientierte und Titeljäger bei Nicht-Favoriten testen gern den Markt, sonst jeder Fünfte
      // erfolgreiche Teams halten ihre Spieler leichter; Zielwert: im Aufwind bleiben Spieler, im Abwind wollen sie weg
      const druck = zielDruck(t);
      const bleibt = (1 - CFG.prestige.bleiben * (t.prestige || 0)) * (1 - CFG.ziel.bleiben * druck);
      const testet = (v.geld >= 70 && r() < CFG.marktTesten * bleibt) || (!kandidat && v.titel >= 70 && r() < 0.6 * bleibt)
        || (v.treue < 70 && r() < CFG.marktTestenSonst * bleibt);
      // Team: verlängert nur, wer zum Kern gehört (Startelf-Niveau oder junges Potenzial)
      const kern = spielerWert(p) + stilBonus(L, t, p, CFG.stilScout.kern) >= G.teamOvr(t) - CFG.kernAbstand && p.age <= 32;
      const f = G.forderung(p, t, { eigenerVerein: true, titelkandidat: kandidat, prestige: t.prestige });
      // Zielwert: kluge Vereine verhandeln günstiger, fragwürdige zahlen drauf (verstopft den Cap)
      f.jahresWert = Math.round(f.jahresWert * (1 - CFG.ziel.vertrag * druck) / 10000) * 10000;
      if (!testet && kern && capFrei(t) - reserve(L) >= f.jahresWert * 1.05 && (!F || F.darfAusgeben(t, f.jahresWert))) {
        unterschreibe(L, t, p, vertragAus(f)); st.verlaengert++;
      } else zumMarkt.push(p);
    }
    zumMarkt.forEach(p => { delete p.ir; delete p.ersatzFuer; });
    freie.push(...zumMarkt);
    // D102: die Sommerpause heilt 12 Wochen (auch Vereinslose), die Verletztenliste der KI endet mit der Saison
    sommerpause(L, r, { ohne: W.ohne });
    // D118: Trainerteam – Entwicklung, Rente, Vertragsende, Chefcoach, Eigenschaften (eigener Zufall: die Welt zieht weiter aus r)
    const Tr = trainer();
    if (Tr) { try { st.trainer = Tr.saisonEnde(L, Tr.rngVon(L, 'saisonende'), W); } catch (e) { if (typeof console !== 'undefined') console.warn('[DFL-Saison] Trainer', e && e.message); } }
    return st;
  }

  // Draft-Entscheidung eines Teams: eigenes Board (Scouting) + Medien + Kaderanalyse
  // Stilbonus der KI (dfl_handel.js lädt später – zur Laufzeit holen)
  const stilBonus = (L, t, p, je) => { const H = typeof window !== 'undefined' && window.DFLHandel; return H && H.stilBonus ? H.stilBonus(L, t, p, je) : 0; };
  function npcWahl(L, t, verfuegbar, r, W) {
    // Zielwert: kluge Vereine treffen im Draft besser (wie mehr Scouting), fragwürdige schlechter
    // D120: der Chefscout der KI – je Stern über bzw. unter 3 eine Scouting-Stufe (schwache greifen öfter daneben)
    const Tr = trainer(), cs = Tr && t.trainer ? (Tr.sterne(t, 'scout') || 1) - 3 : 0;
    const sc = klemme((t.anlagen.scouting || 5) + CFG.ziel.scouting * zielDruck(t) + cs, 1, 10), saat = (L.saisonIndex || 0) * 101;
    const analyse = W.analyse[t.id] = W.analyse[t.id] || G.kaderAnalyse(t, { scouting: sc, saat });
    const genau = Math.min(0.8, sc * 0.08);
    let best = null, bestWert = -1e9;
    for (const p of verfuegbar.slice(0, CFG.draftKandidaten)) {
      const u = G.draftUrteil(t, p, analyse, sc, saat);
      // Stil: passende Talente erkennt die KI so gut wie ihr Scouting (genau)
      const w = p._medienWert * (1 - genau) + u.wert * genau + u.passt + stilBonus(L, t, p, CFG.stilScout.draft) * genau * 2 + r.normal(0, 2.2 - 0.15 * sc);
      if (w > bestWert) { bestWert = w; best = p; }
    }
    if (best && analyse[best.pos]) analyse[best.pos].bedarf = Math.max(0, analyse[best.pos].bedarf - 1.2);
    return best;
  }
  function rookieUnterschreiben(L, t, p, pick, runde, jahr, von) {
    const contract = G.baueVertrag({ jahresWert: G.rookieGehalt(pick), jahre: G.CFG.rookie.jahre, rest: G.CFG.rookie.jahre,
      staffelung: 'steigend', handgeldAnteil: G.CFG.rookie.handgeld[runde - 1], art: 'rookie' });
    p.rookieVertrag = { pick, runde, jahr, von };
    G.nieteWuerfeln(p, runde);                       // D103: verborgene Niete (KI und Nutzer gleich)
    // Draft-Daten (Medien, Kombine) werden nach dem Pick nicht mehr gebraucht – Spielstand bleibt klein
    ['medien', '_wert', '_medienWert', 'college', 'kombine', 'fruehmelder'].forEach(k => delete p[k]);
    unterschreibe(L, t, p, contract);
  }
  // Phase 2: Draft (Konzept 6.6) mit Rookie-Skala (6.7) – im Spiel wählt der Nutzer im Dialog
  function phaseDraft(L, saison, po, r, W) {
    const reihenfolge = draftReihenfolge(L, saison, po);
    const jahrgang = L.draft;
    const verfuegbar = jahrgang.talente.slice().sort((a, b) => a.medien.rang - b.medien.rang);
    for (let runde = 1; runde <= 4; runde++) {
      reihenfolge.forEach((id, idx) => {
        // Getauschte Picks (DFLHandel): es wählt der Besitzer, nicht das ursprüngliche Team
        const besitz = (L.picks || []).find(x => x.id === jahrgang.jahr + '-' + runde + '-' + id);
        const t = L.teams.find(x => x.id === (besitz ? besitz.besitzer : id));
        if (W.ohne.has(t.id)) return;
        const pick = (runde - 1) * 32 + idx + 1;
        const best = npcWahl(L, t, verfuegbar, r, W);
        verfuegbar.splice(verfuegbar.indexOf(best), 1);
        rookieUnterschreiben(L, t, best, pick, runde, jahrgang.jahr, id);
        W.st.rookies++;
      });
    }
    if (L.picks) L.picks = L.picks.filter(x => x.jahr !== jahrgang.jahr);
    nichtGedraftet(L, verfuegbar);
    W.draftJahr = jahrgang.jahr;
  }
  // Nicht gedraftet: Junge (bis 20) melden sich für den nächsten Draft wieder an (Wunsch 2026-10-08),
  // ältere gehen in den freien Markt (Minimumverträge)
  function nichtGedraftet(L, liste) {
    liste.forEach(p => {
      delete p.medien; delete p._wert; delete p._medienWert;
      if (p.age <= 20 && L.draftNaechste) {
        p.age += 1; p.wiederangemeldet = (p.wiederangemeldet || 0) + 1;
        L.draftNaechste.talente.push(p);
      } else {
        ['kombine', 'fruehmelder', '_bias'].forEach(k => delete p[k]);
        p.teamId = null; p.contract = null;
        L.freie.push(p);
      }
    });
  }

  // Markt: wartet ein guter Free Agent auf ein besseres Angebot? (CFG.markt) – Wartezeit in Wellen nach Profil, Welle nr (0 = erste)
  function marktWarten(p, nr, wahl, kandidaten) {
    const M = CFG.markt;
    if (!M.aktiv || spielerWert(p) < M.gutAb) return false;
    const v = p.vertragsprofil || {};
    let w = M.grund || 0;
    if (M.topAb && spielerWert(p) >= M.topAb) w++;                           // die Allerbesten lassen sich Zeit
    if ((v.geld || 0) >= M.geldAb) w++;
    if ((v.titel || 0) >= M.titelAb && !kandidaten.has(wahl.t.id)) w++;
    if ((v.sicherheit || 0) >= M.sicherAb) w--;
    if (p.age >= M.altAb) w--;
    w = klemme(w, 0, M.maxWarten);
    if (nr >= w) return false;
    return wahl.f.jahresWert < M.sofortAb * G.marktgehalt(p);                // ein Angebot klar über Markt nimmt er sofort
  }
  // Phase 3: Free Agency – die Besten zuerst, Teams bieten nach Bedarf und Cap-Platz, der Spieler wählt.
  // anteil < 1: nur eine Welle (das Spiel verteilt die Free Agency über das Sommerfenster)
  function phaseFreeAgency(L, r, W, anteil) {
    const U = W.U, freie = L.freie, M = CFG.markt, letzte = anteil == null || anteil >= 1, vorWelle = M.aktiv && !letzte;
    const ausgabeDruck = t => {
      if (!U.aktiv) return 0;
      const quote = capTeam(t) / t.salary_cap_limit;
      return quote < U.druckAb ? Math.min(0.15, (U.druckAb - quote) * 0.5) : 0;
    };
    const kandidatenNeu = titelkandidaten(L);
    // Welle der Offseason seit dem Saisonwechsel (Markt: gute Free Agents warten nach Profil einige Wellen; im Weltspeicher)
    const fw = L.faWelle && L.faWelle.jahr === L.saisonJahr ? L.faWelle : (L.faWelle = { jahr: L.saisonJahr, nr: 0 });
    const welleNr = fw.nr++;
    const proVerein = new Map(), mitAngebot = new Set();
    freie.sort((a, b) => spielerWert(b) - spielerWert(a));
    const welle = freie.slice(0, Math.ceil(freie.length * (anteil == null ? 1 : anteil)));
    // Aktivität je Verein in dieser Welle (CFG.markt.aktivitaet): wer sein Ziel über der Stärke hat, sucht früh; Zufriedene verpennen
    const AK = M.aktivitaet, wach = new Set();
    if (vorWelle && AK && AK.aktiv) aktiv(L, W).forEach(t => {
      const q = klemme(AK.grund + AK.druck * zielDruck(t) + (kandidatenNeu.has(t.id) ? AK.titel : 0) + AK.jeWelle * welleNr, AK.min, 1);
      if (r() < q) wach.add(t.id);
    });
    const schlaeft = t => vorWelle && AK && AK.aktiv && !wach.has(t.id);
    const unterschrieben = [];
    for (const p of welle) {
      const angebote = [];
      for (const t of aktiv(L, W)) {
        if (t.roster.length >= faGrenze(t)) continue;                       // D110: Kaderziel + 2, höchstens 30
        if (vorWelle && (proVerein.get(t.id) || 0) >= M.jeWelle) continue;   // Markt: je Welle nur die dringendste Lücke
        if (schlaeft(t)) continue;                                             // Aktivität: diese Welle verpennt
        const zStil = stilBonus(L, t, p, 1);                                  // passt zum eigenen Stil (z, nur positiv)
        const n0 = nutzenFuer(t, p);
        const nutzen = faNutzenLage(t, p, n0 + (n0 > 0 ? zStil * CFG.stilScout.faNutzen : 0));
        if (nutzen <= 0 || (vorWelle && nutzen < M.lueckeAb)) continue;
        const f = G.forderung(p, t, { titelkandidat: kandidatenNeu.has(t.id), eigenerVerein: p._exVerein === t.id, prestige: t.prestige });
        const druck = zielDruck(t);
        // Zielwert: im Aufwind nehmen Spieler für das Projekt weniger, beim Chaos-Verein verlangen sie mehr; D110: Neuaufbau zahlt ab 30 nur 85 %
        const wert = Math.round(f.jahresWert * faGeldLage(t, p) * (1 + ausgabeDruck(t)) * (1 - CFG.ziel.rabatt * druck) * (1 + CFG.stilScout.faGeld * Math.min(2, zStil)) / 10000) * 10000;
        if (capFrei(t) - reserve(L) * 0.3 < wert * 1.02) continue;
        if (window.DFLFinanzen && !window.DFLFinanzen.darfAusgeben(t, wert)) continue;      // leere Kasse: Sparmodus (D41)
        // Was dem Spieler das Angebot wert ist: Geld, Titelchance, Treue, große Bühne
        const v = p.vertragsprofil;
        const reiz = (wert / Math.max(1, G.marktgehalt(p))) * (0.6 + v.geld / 100)
          + (kandidatenNeu.has(t.id) ? v.titel / 100 : 0) * 0.6
          + (p._exVerein === t.id ? v.treue / 100 * 0.4 : 0) + nutzen * 0.05 + r() * 0.15
          + Math.min(1, t.anlagen.stadion / 80000) * 0.12 + (t.prestige || 0) * CFG.prestige.fa
          + CFG.ziel.fa * druck                                          // Zielwert: Aufbruchstimmung zieht, Chaos schreckt ab
          + (nutzen >= 1 ? CFG.ziel.luecke * Math.max(0, druck) : 0);     // kluge Vereine schließen gezielt Lücken in der Elf
        angebote.push({ t, f: Object.assign({}, f, { jahresWert: wert }), reiz });
      }
      if (!angebote.length) continue;
      mitAngebot.add(p);
      angebote.sort((a, b) => b.reiz - a.reiz);
      const wahl = angebote[0];
      if (vorWelle && marktWarten(p, welleNr, wahl, kandidatenNeu)) { W.st.faGewartet = (W.st.faGewartet || 0) + 1; continue; }
      freie.splice(freie.indexOf(p), 1);
      unterschreibe(L, wahl.t, p, vertragAus(faVertragLage(wahl.t, p, wahl.f)), W.st.fa);
      proVerein.set(wahl.t.id, (proVerein.get(wahl.t.id) || 0) + 1);
      unterschrieben.push({ p, an: wahl.t.id });
    }
    // Restmarkt: wer in dieser Welle ohne Angebot blieb, fordert in der nächsten weniger (G.forderung über p.faRunden); wer mit Angebot
    // gewartet hat (Markt), nicht
    welle.forEach(p => { if (!p.teamId && freie.indexOf(p) >= 0 && !mitAngebot.has(p)) p.faRunden = (p.faRunden || 0) + 1; });
    return unterschrieben;
  }

  // Phase 4: Development Squad, Kader auffüllen, Kaderschnitt auf 28 und Cap-Einhaltung (Spec)
  function phaseKader(L, r, W) {
    const st = W.st, freie = L.freie = L.freie || [];
    const ersatz = (t, pos, ovrMittel, ovrMax) => {
      const ovr = Math.round(Math.max(48, Math.min(ovrMax, r.normal(ovrMittel, 4))));
      const p = G.erzeugeSpieler(r, { id: 'frei', city: null }, pos, ovr, r.int(23, 31), 'ersatz' + L.saisonJahr + '_' + (L._ersatzNr = (L._ersatzNr || 0) + 1), L.namen);
      st.ersatz++;
      unterschreibe(L, t, p, minVertrag(1));
    };
    aktiv(L, W).forEach(t => {
      const T = G.teamOvr(t);
      // a) Reife Spieler im Development Squad (zu alt oder gut genug): hochziehen, wenn sie helfen, sonst gehen lassen.
      //    Wer seinen eigenen Vertrag mitgebracht hat (D45), kommt mit diesem Vertrag zurück in den Kader.
      for (const p of t.practice_squad.slice()) {
        if (pkTauglich(p) && p.ovr < PK().reifAb) continue;
        t.practice_squad.splice(t.practice_squad.indexOf(p), 1);
        if (p.contract && p.contract.art !== 'perspektiv') { delete p.perspektiv; t.roster.push(p); st.hochgezogen++; }
        else if (potS(p, t) >= T - 4 || nutzenFuer(t, p) > 0) { unterschreibe(L, t, p, minVertrag(2)); st.hochgezogen++; }
        else { p.teamId = null; p.contract = null; p._exVerein = t.id; freie.push(p); }
      }
      // b) Über dem Kaderziel (D110: 28/26/25 nach Lage): rohe Junge in den Development Squad – sie behalten ihren Vertrag (zählt weiter
      //    gegen den Cap, D45), kein Dead Cap
      const zuviel = () => t.roster.length > G.kaderZiel(t) && t.practice_squad.length < CFG.perspektiv;
      const jung = t.roster.filter(p => pkTauglich(p) && p.ovr < T - 8)
        .sort((a, b) => ((b.rookieVertrag && b.rookieVertrag.jahr === W.draftJahr) - (a.rookieVertrag && a.rookieVertrag.jahr === W.draftJahr)) || a.ovr - b.ovr);
      for (const p of jung) {
        if (!zuviel()) break;
        t.roster.splice(t.roster.indexOf(p), 1);
        p.teamId = t.id; p.perspektiv = true;
        t.practice_squad.push(p); st.perspektiv++;
      }
    });
    // c) Kader auffüllen (Minimumverträge aus dem Markt, sonst Ersatzspieler). Fragwürdig geführte Vereine
    //    (Zielwert, Druck < 0) greifen dabei auch mal daneben.
    const auswahl = (t, pos) => {
      const liste = freie.filter(x => x.pos === pos).sort((a, b) => spielerWert(b) - spielerWert(a));
      const d = zielDruck(t);
      return d < -0.3 ? liste[Math.floor(r() * Math.min(liste.length, 1 + 12 * -d))] : liste[0];
    };
    const holen = (t, pos) => {
      const p = auswahl(t, pos);
      if (p) { freie.splice(freie.indexOf(p), 1); unterschreibe(L, t, p, minVertrag(1)); }
      else ersatz(t, pos, 60, 70);
    };
    // Kader-Soll je Verein (D95: zwölf Positionen, LM/RM nach Formation; D110: für das Kaderziel der Lage – DFLGenerator.kaderSoll)
    const sollVon = t => (G.kaderSoll ? G.kaderSoll(t) : G.CFG.kader);
    const zielVon = t => (G.kaderZiel ? G.kaderZiel(t) : CFG.kader);
    aktiv(L, W).forEach(t => {
      // Startelf-Positionen zuerst: Ist eine Position leer (Kader voll mit Überzähligen anderswo), geht der
      // schwächste Überzählige – vorher konnte z. B. der Torwart ganz fehlen und die Elf hatte nur 10 Spieler
      // Torhüter: mindestens 2 (Prüfung 2026-10-10: nach einigen Saisons hatten 1–3 KI-Vereine je Liga nur einen)
      // Startelf-Soll: Formation des Stils und (für die Teamstärke) das 4-2-3-1 – je Position das Größere
      // L3: mit Startstil zählt statt des 4-2-3-1 jede Formation des Stils (die Teamstärke gilt dort)
      const forms = G.CFG.startStil && G.CFG.startStil.aktiv && t.taktik && t.taktik.stil && G.stilFormationen ? G.stilFormationen(t.taktik.stil) : [];
      const soll = forms.length ? {} : Object.assign({}, G.CFG.startelf), kSoll = sollVon(t), ziel = zielVon(t);
      forms.forEach(f => { const c = {}; CFG.formationen[f].forEach(z => { c[z] = (c[z] || 0) + 1; }); Object.keys(c).forEach(k => { soll[k] = Math.max(soll[k] || 0, c[k]); }); });
      if (G.startSoll) Object.entries(G.startSoll(t)).forEach(([pos, n]) => { soll[pos] = Math.max(soll[pos] || 0, n); });
      for (const [pos, n0] of Object.entries(soll)) {
        const n = pos === 'TW' ? Math.max(2, n0) : n0;
        let sicherung = 0;
        while (t.roster.filter(p => p.pos === pos).length < n && sicherung++ < 3) {
          if (t.roster.length >= CFG.kader) {
            const ueber = t.roster.filter(p => t.roster.filter(x => x.pos === p.pos).length > (kSoll[p.pos] || 0)).sort((a, b) => spielerWert(a) - spielerWert(b))[0];
            if (!ueber) break;
            st.deadCap += entlasse(t, ueber); st.entlassen++; ueber._exVerein = t.id; freie.push(ueber);
          }
          holen(t, pos);
        }
      }
      // auffüllen bis zum Kaderziel der Lage (D110), nicht mehr auf 28
      for (const pos of Object.keys(kSoll)) {
        while (t.roster.filter(p => p.pos === pos).length < kSoll[pos] && t.roster.length < ziel) holen(t, pos);
      }
    });
    // d) Kaderschnitt auf 28 und Cap-Einhaltung (Spec: Cap Hit ≤ Limit); D110: zwischen Ziel und 28 nur, wenn es sich lohnt
    // (Ersparnis = Cap Hit − entstehender Dead Cap ≥ CFG.lage.lohnt × Mindestgehalt), nie ein Spieler der Startelf
    const ersparnisVon = p => capHit(p) - (p.contract.signing_bonus_total / p.contract.years_total) * p.contract.years_remaining;
    aktiv(L, W).forEach(t => {
      const schneide = (liste) => {
        const p = liste[0];
        st.deadCap += entlasse(t, p); st.entlassen++;
        p._exVerein = t.id; freie.push(p);
      };
      const kSoll = sollVon(t), ziel = zielVon(t);
      const ueberSoll = p => t.roster.filter(x => x.pos === p.pos).length > (kSoll[p.pos] || 0);
      while (t.roster.length > CFG.kader) {
        // Wer am wenigsten bringt, fliegt – Positionen unter Soll bleiben geschützt
        const kandidaten = t.roster.filter(ueberSoll).sort((a, b) => spielerWert(a) - spielerWert(b));
        schneide(kandidaten.length ? kandidaten : t.roster.slice().sort((a, b) => spielerWert(a) - spielerWert(b)));
      }
      for (let i = 0; t.roster.length > ziel && i < CFG.kader; i++) {
        const elf = new Set(G.startelfVon(t.roster, t).map(p => p.id)), grenze = CFG.lage.lohnt * G.CFG.mindestgehalt;
        const kandidaten = t.roster.filter(p => ueberSoll(p) && !elf.has(p.id) && p.contract && ersparnisVon(p) >= grenze)
          .sort((a, b) => spielerWert(a) - spielerWert(b));
        if (!kandidaten.length) break;
        schneide(kandidaten);
        st.lageSchnitt = (st.lageSchnitt || 0) + 1;
      }
      let sicherung = 0;
      while (capTeam(t) > t.salary_cap_limit && sicherung++ < 40) {
        // Größte Ersparnis zuerst (Cap Hit minus entstehender Dead Cap), Startelf möglichst schonen
        const elf = new Set(G.startelfVon(t.roster, t).map(p => p.id));
        const ersparnis = p => capHit(p) - (p.contract.signing_bonus_total / p.contract.years_total) * p.contract.years_remaining;
        const kand = t.roster.filter(p => !elf.has(p.id) && ersparnis(p) > G.CFG.mindestgehalt).sort((a, b) => ersparnis(b) - ersparnis(a));
        schneide(kand.length ? kand : t.roster.slice().sort((a, b) => ersparnis(b) - ersparnis(a)));
        const pos = Object.keys(kSoll).find(ps => t.roster.filter(p => p.pos === ps).length < kSoll[ps]);
        if (pos) ersatz(t, pos, 58, 68);
      }
    });
    // f) Vereinslose begrenzen (Spielstand bleibt klein): die Wertvollsten + die besten jungen Talente. Wer rausfällt,
    // beendet ab 30 seine Karriere (zählt für die Hall of Fame), Jüngere gehen ins Ausland
    if (freie.length > CFG.freieMax) {
      const jung = freie.filter(p => p.age <= 21).sort((a, b) => potS(b) - potS(a)).slice(0, 60);
      const rest = freie.filter(p => jung.indexOf(p) < 0).sort((a, b) => spielerWert(b) - spielerWert(a)).slice(0, CFG.freieMax - jung.length);
      const bleibt = new Set(rest.concat(jung));
      freie.forEach(p => {
        if (bleibt.has(p)) return;
        if (p.age >= 30) { st.ruhestand++; st.ruhestandFrei = (st.ruhestandFrei || 0) + 1; p.teamId = null; st.ruhestandListe.push(p); }
        else st.ausland++;
      });
      freie.length = 0; freie.push(...rest, ...jung);
    }
    // e) Development Squad auffüllen: die vielversprechendsten jungen Freien (Vertrag zählt gegen den Cap, D45)
    const jungeFreie = freie.filter(pkTauglich).sort((a, b) => potS(b) - potS(a));
    aktiv(L, W).forEach(t => {
      while (t.practice_squad.length < CFG.perspektiv && jungeFreie.length && G.capHitTeam(t) + G.CFG.perspektivGehalt <= t.salary_cap_limit) {
        const p = jungeFreie.shift(); freie.splice(freie.indexOf(p), 1);
        p.teamId = t.id; p.contract = pkVertrag(); p.contractUntil = 1; p.perspektiv = true;
        p.wage = Math.round((p.contract.base_salary || G.CFG.perspektivGehalt) / 52);     // fehlte (Prüfung 2026-10-09)
        t.practice_squad.push(p);
      }
      // Mindestkader (D46): nie unter 21 Spieler im Kader (Sicherheitsnetz, normal sind es 25–28)
      while (t.roster.length < CFG.mindestKader) {
        const kSoll = sollVon(t), pos = Object.keys(kSoll).find(ps => t.roster.filter(p => p.pos === ps).length < kSoll[ps]) || 'ZM';
        ersatz(t, pos, 58, 68);
      }
    });
    // D110 (Nutzer zu D99: „Cap-Not erst nach den Free-Agency-Wellen“): ab dem Kaderschnitt der Saison gilt Cap-Not als Abgabegrund
    // (DFLHandel.abgabeGruende) – vorher lagen viele KI-Kader nur vorübergehend über dem Cap
    L.kaderschnitt = L.saisonJahr;
  }

  // Phase 5: Jahrgänge rücken nach (Prognose: aktuelle Stärke aufsteigend). Der übernächste Jahrgang war schon
  // sichtbar, hat sich ein Jahr entwickelt und wird jetzt schärfer bewertet; dahinter entsteht ein neuer.
  function phaseJahrgang(L, r) {
    const prognose = L.teams.slice().sort((a, b) => G.teamOvr(a) - G.teamOvr(b)).map(t => t.id);
    const jahr = L.saisonJahr + 1;
    if (L.draftNaechste && L.draftNaechste.talente.length && L.draftNaechste.jahr === jahr) {
      G.jahrgangEntwickeln(r, L.draftNaechste, 0.6);
      const talente = L.draftNaechste.talente.filter(p => p.age <= 21);
      const form = L.draftNaechste.form;
      L.draft = G.jahrgangBewerten(r, talente, L.teams, { jahr, reihenfolge: prognose, voraus: 0 });
      if (form) L.draft.form = form;                                       // Jahrgangsform bleibt (Pick-Werte, Chefscout)
      L.draft.talente = L.draft.talente.slice(0, CFG.jahrgangMax);
    } else L.draft = G.erzeugeDraftJahrgang(r, L.teams, { jahr, namen: L.namen, reihenfolge: prognose });
    L.draftNaechste = G.erzeugeDraftJahrgang(r, L.teams, { jahr: jahr + 1, namen: L.namen, reihenfolge: prognose, voraus: 1 });
  }
  // Halbzeit der Saison: Talente entwickeln sich, die Medien sehen genauer hin (Draft-Board ändert sich)
  function jahrgangZwischenstand(L, r) {
    const prognose = L.teams.slice().sort((a, b) => G.teamOvr(a) - G.teamOvr(b)).map(t => t.id);
    const aus = [];
    [[L.draft, 0], [L.draftNaechste, 1]].forEach(([jg, voraus]) => {
      if (!jg || !jg.talente.length) return;
      G.jahrgangEntwickeln(r, jg, 0.4);
      const neu = G.jahrgangBewerten(r, jg.talente, L.teams, { jahr: jg.jahr, reihenfolge: prognose, voraus, schaerfe: voraus ? 1 : 0.8 });
      Object.assign(jg, neu);
      aus.push(jg);
    });
    return aus;
  }

  // ── Start mit 25 (D74) ───────────────────────────────────────────────────
  // Start-Markt einer neuen Liga: bei allen Vereinen laufen Verträge aus (Kader → CFG.start.kader, Vertrag endet regulär, kein
  // Dead Cap), dazu erzeugte Free Agents aller Altersstufen. Spiel (dfl_liga_patch.js, neue Karriere) und Langzeitlauf rufen
  // dasselbe auf; ohne r zieht der Markt seinen Zufall aus L.seed (gleiche Liga → gleicher Markt).
  // opt: Felder von CFG.start überschreiben · herkunftOhne: Vereine, die nicht als letzter Verein erzeugter Spieler gelten
  // halten (D108): Vereine, deren Auslaufende im Kader bleiben (der eigene Verein entscheidet am Tag der Verträge) – ihre IDs stehen
  // in L.startMarkt.halten[teamId]; ohne opt.kader gilt mit Start-Draft dessen Kader (21), sonst CFG.start.kader (25)
  function startMarkt(L, r, opt) {
    const C = Object.assign({}, CFG.start, opt || {});
    if (!(opt && opt.kader != null) && startDraftAn(C)) C.kader = C.draft.kader;
    const halten = new Set(C.halten || []), gehalten = {};
    r = r || G.rngAus((((L.seed || 1) * 7919) + 29) >>> 0);
    const freie = L.freie = L.freie || [];
    const abgaenge = [], pool = [];
    const gewicht = p => {
      const alter = (C.alter.find(([bis]) => p.age <= bis) || C.alter[C.alter.length - 1])[1];
      const rest = p.contract ? (C.rest[p.contract.years_remaining] || C.rest.sonst) : C.rest.sonst;
      return alter * rest;
    };
    // nie den letzten Torhüter (twMin) und nie so viele einer Position, dass die Startelf (4-2-3-1) nicht mehr aufgeht
    const minPos = (pos, t) => pos === 'TW' ? C.twMin : Math.max(1, ((G.startSoll ? G.startSoll(t) : G.CFG.startelf)[pos]) || 0);
    L.teams.forEach(t => {
      const schutz = new Set(t.roster.slice().sort((a, b) => spielerWert(b) - spielerWert(a)).slice(0, C.schutz).map(p => p.id));
      const bleibt = halten.has(t.id), weg = [];
      while (t.roster.length - weg.length > C.kader) {
        const zahl = {};
        t.roster.forEach(p => { if (weg.indexOf(p) < 0) zahl[p.pos] = (zahl[p.pos] || 0) + 1; });
        const kand = t.roster.filter(p => weg.indexOf(p) < 0 && !schutz.has(p.id) && zahl[p.pos] > minPos(p.pos, t));
        if (!kand.length) break;
        const w = kand.map(gewicht);
        let x = r() * w.reduce((s, g) => s + g, 0), i = 0;
        while (i < kand.length - 1 && x >= w[i]) { x -= w[i]; i++; }
        weg.push(kand[i]);
      }
      if (bleibt) { gehalten[t.id] = weg.map(p => p.id); return; }
      weg.forEach(p => {
        t.roster.splice(t.roster.indexOf(p), 1);
        p.teamId = null; p.contract = null; p._exVerein = t.id;      // wie ein Vertragsende in phaseAbschluss
        freie.push(p); abgaenge.push({ p, von: t.id });
      });
    });
    // Erzeugte Free Agents: Position nach Kaderschlüssel, letzter Verein zufällig (wie der bisherige Start-Pool im Spiel)
    const P = C.pool || {}, positionen = [];
    Object.entries(G.CFG.nachwuchs || G.CFG.kader).forEach(([pos, n]) => { for (let i = 0; i < n; i++) positionen.push(pos); });   // D95: LM/RM wie LF/RF
    const ohne = new Set(C.herkunftOhne || []), herkunft = L.teams.filter(t => !ohne.has(t.id));
    let nr = 0;
    (P.gruppen || []).forEach(g => {
      const n = Math.round((P.anzahl || 0) * g.anteil), [m, s, lo, hi] = g.ovr;
      for (let i = 0; i < n; i++) {
        const ex = r.pick(herkunft);
        const p = G.erzeugeSpieler(r, { id: 'fa' + (L.saisonIndex || 0), city: ex.city }, r.pick(positionen),
          Math.round(klemme(r.normal(m, s), lo, hi)), r.int(g.alter[0], g.alter[1]), nr++, L.namen);
        p.teamId = null; p.contract = null; p._exVerein = ex.id;
        freie.push(p); pool.push(p);
      }
    });
    L.startMarkt = { kader: C.kader, abgaenge: abgaenge.length, pool: pool.length, halten: gehalten };
    return { abgaenge, pool, halten: gehalten };
  }

  // ── Start am Tag der Verträge mit erstem Draft (D108) ────────────────────
  const startDraftAn = C => !!(C && C.aktiv && C.draft && C.draft.aktiv);
  // Stille Vorsaison: Tabelle aus 26 Spieltagen und Playoffs mit den Kadern vor dem Vertragsende – nur Ergebnisse, ändert nichts an
  // Spielern oder Vereinen (keine Verletzungen, kein Lernen, kein Stil). Eigener Zufall aus L.seed. Liefert die Draft-Reihenfolge.
  function vorsaison(L, r) {
    r = r || G.rngAus((((L.seed || 1) * 7919) + 37) >>> 0);
    const werte = {};
    L.teams.forEach(t => { werte[t.id] = teamWerte(t); });
    const tab = leereTabelle(L.teams), plan = spielplan(L.teams, 1, r);
    plan.forEach((tag, i) => tag.forEach(([h, g]) => {
      const [gh, ga] = spiel(r, werte[h], werte[g], false, i), H = tab[h], A = tab[g];
      H.gf += gh; H.ga += ga; A.gf += ga; A.ga += gh;
      if (gh > ga) { H.pts += 3; H.w++; A.l++; } else if (gh < ga) { A.pts += 3; A.w++; H.l++; } else { H.pts++; A.pts++; H.d++; A.d++; }
    }));
    Object.values(tab).forEach(z => { z.gd = z.gf - z.ga; });
    const los = {}; L.teams.forEach(t => { los[t.id] = r(); });
    const saison = { tabelle: tab, los, werte };
    const po = playoffs(L, saison, r);
    return { saison, po, reihenfolge: draftReihenfolge(L, saison, po), meister: po.meister, finalist: po.finalist };
  }
  // Start-Jahrgang (Draft-Jahr = erstes Saisonjahr): der Jahrgang des ersten Saisonendes rückt eine Stelle nach hinten
  // (L.draftNaechste), nach dem Start-Draft macht phaseJahrgang daraus wie sonst den kommenden Jahrgang
  function startJahrgang(L, r, reihenfolge) {
    r = r || G.rngAus((((L.seed || 1) * 7919) + 41) >>> 0);
    const jahr = L.saisonJahr;
    if (L.draft && L.draft.jahr === jahr) return L.draft;
    const jg = G.erzeugeDraftJahrgang(r, L.teams, { jahr, namen: L.namen, reihenfolge: reihenfolge || undefined });
    L.draftNaechste = L.draft;
    L.draft = jg;
    return jg;
  }
  // Start-Draft ohne Nutzer (Langzeitlauf, Prüflauf): wie phaseDraft mit der Reihenfolge der Vorsaison, danach der Jahrgang wie sonst
  function startDraft(L, vs, r, W) {
    startJahrgang(L, null, vs.reihenfolge);
    if (typeof window !== 'undefined' && window.DFLHandel && window.DFLHandel.picks) window.DFLHandel.picks(L);
    phaseDraft(L, vs.saison, vs.po, r, W);
    phaseJahrgang(L, r);
  }
  // Startphase vor Saison 1 im Langzeitlauf, wie die erste Vorbereitung im Spiel: Start-Markt, KI-Stile (das Spiel setzt sie zum
  // Start), Lage (D110), Free Agency in Wellen, KI-Trades, Kaderschnitt auf das Kaderziel der Lage (28/26/25) und unter den Cap.
  // Eigener Zufall aus L.seed – mit start.aktiv = false läuft alles danach wie vor D74. (D106–D109 baut den Spielstart darauf auf.)
  function startphase(L, opt) {
    opt = opt || {};
    const C = Object.assign({}, CFG.start, opt.start || {});
    if (!C.aktiv) return null;
    const r = G.rngAus((((L.seed || 1) * 7919) + 31) >>> 0);
    const Hd = typeof window !== 'undefined' && window.DFLHandel;
    if (Hd && Hd.taktikenSetzen) Hd.taktikenSetzen(L);
    formationenSetzen(L);
    if (Hd && Hd.lagenSetzen) Hd.lagenSetzen(L);                          // D110: Lage zum Start (Kaderziel, Draft, Free Agency)
    // D108: stille Vorsaison vor dem Vertragsende (Kader noch voll), dann Start-Markt und der erste Draft der ganzen Liga
    const vs = startDraftAn(C) ? vorsaison(L) : null;
    const markt = startMarkt(L, null, vs ? Object.assign({}, C, { kader: C.draft.kader }) : C);
    const W = neuerWechsel(opt);
    if (vs) { startDraft(L, vs, r, W); W.st.startDraft = { meister: vs.meister, rookies: W.st.rookies }; }
    const kaderStart = L.teams.map(t => t.roster.length);
    // opt.faWelle(L, i, unterschrieben, art): Messhaken je Welle (Werkzeuge)
    const wellen = (C.wellen || [1]).map((a, i) => { const u = phaseFreeAgency(L, r, W, a); if (opt.faWelle) opt.faWelle(L, i, u, 'start'); return u.length; });
    if (opt.kiTrades && Hd) W.st.trades = Hd.kiTrades(L, r, { ohne: [...W.ohne], max: opt.kiTrades, stat: opt.kiStat });
    const kaderWellen = L.teams.map(t => t.roster.length);
    phaseKader(L, r, W);
    W.st.start = { abgaenge: markt.abgaenge.length, pool: markt.pool.length, wellen, markt: markt.abgaenge.length + markt.pool.length,
      kaderStart: [Math.min(...kaderStart), Math.max(...kaderStart)], kaderWellen: [Math.min(...kaderWellen), Math.max(...kaderWellen)],
      freieDanach: L.freie.length };
    return W.st;
  }

  // Ganzer Saisonwechsel (Langzeitlauf, Prüflauf)
  function saisonwechsel(L, saison, po, r, opt) {
    const W = neuerWechsel(opt);
    W.po = po;
    phaseAbschluss(L, saison, r, W);
    phaseDraft(L, saison, po, r, W);
    // D118: Trainermarkt nach dem Draft (im Spiel: DFLAnalysten.draftFertig, dfl_trainerteam_patch.js)
    { const Tr = trainer(); if (Tr) Tr.nachDraft(L, Tr.rngVon(L, 'draft'), { ohne: [...W.ohne] }); }
    (CFG.faWellen || [1]).forEach((a, i) => { const u = phaseFreeAgency(L, r, W, a); if (opt && opt.faWelle) opt.faWelle(L, i, u, 'saison'); });
    // KI-Trades untereinander (opt.kiTrades = Anzahl je Offseason; braucht DFLHandel); opt.kiStat: Zähler (Messung D99/D110)
    if (opt && opt.kiTrades && window.DFLHandel) W.st.trades = window.DFLHandel.kiTrades(L, r, { ohne: [...W.ohne], max: opt.kiTrades, stat: opt.kiStat });
    phaseKader(L, r, W);
    phaseJahrgang(L, r);
    W.st.wachstum = W.wachstum;
    return W.st;
  }

  // Entwicklungskurve (D48): Faktor nach Stärke und Jugendschub nach Alter (bis 20 voll)
  function ovrFaktor(ovr) {
    const k = CFG.kurve.ovr;
    if (ovr <= k[0][0]) return k[0][1];
    for (let i = 1; i < k.length; i++) if (ovr <= k[i][0]) return k[i - 1][1] + (k[i][1] - k[i - 1][1]) * (ovr - k[i - 1][0]) / (k[i][0] - k[i - 1][0]);
    return k[k.length - 1][1];
  }
  const jugendFaktor = age => age <= 20 ? 1 : (CFG.kurve.jugend[age] || 1);
  // Bruchteile per Zufall runden: 0,4 OVR heißt 40 % Chance auf +1 (Math.round machte aus allem unter 0,5 eine Null)
  const zufallsRunden = (r, x) => Math.floor(x) + (r() < x - Math.floor(x) ? 1 : 0);

  // Körperalter (D68): eine Saison verbuchen. anteil = Anteil der Spiele von Beginn (null = nicht werten), wochen = verletzte
  // Wochen, schwer = schwere Verletzung. Gibt die Änderung zurück; p.koerper fehlt, solange es 0 ist (Spielstand bleibt klein).
  const koerperFaktor = alter => CFG.koerper.alter.reduce((f, [ab, x]) => alter >= ab ? x : f, 0);
  function koerperJahr(p, alter, anteil, wochen, schwer) {
    const K = CFG.koerper;
    if (!p || alter == null || alter < K.ab) return 0;
    let d = anteil == null ? 0 : anteil >= K.stamm ? K.jahrStamm : anteil < K.bank ? K.jahrBank : 0;
    d += ((wochen || 0) * K.jeWoche + (schwer ? K.schwer : 0)) * koerperFaktor(alter);
    if (!d) return 0;
    const alt = p.koerper || 0, neu = Math.max(K.min, Math.min(K.max, Math.round((alt + d) * 100) / 100));
    if (neu) p.koerper = neu; else delete p.koerper;
    return neu - alt;
  }
  const koerperAlter = p => p.age + (p.koerper || 0);

  // Jährliche Entwicklung (Langzeit-Vereinfachung des wöchentlichen Trainings, Konzept 4.4)
  // faktor: Tempo-Faktor des Trainerteams (D118, Co-Trainer und Chefcoach; 1 = ohne)
  // Stil-Passung eines Spielers zum Stil seines Vereins (D112-Typen über DFLHandel.stilWert): 'passt' = der Vereinsstil ist sein
  // bester (bis CFG.spielzeit.stil.abstand dahinter), 'anders' = sein schlechtester; null = zählt nicht (Position, ohne Handel)
  function stilPasst(p, stil) {
    const H = typeof window !== 'undefined' ? window.DFLHandel : null;
    if (!H || !H.stilWert || !H.STILE || !stil || (H.stilRelevant && !H.stilRelevant(p, stil))) return null;
    const w = H.STILE.map(s => [s, H.stilWert(p, s)]).sort((a, b) => b[1] - a[1]), eigen = H.stilWert(p, stil);
    if (eigen >= w[0][1] - CFG.spielzeit.stil.abstand) return 'passt';
    return w[w.length - 1][0] === stil ? 'anders' : null;
  }
  function entwicklung(r, p, spielt, imKader, training, druck, faktor, stil) {
    // Körperalter der abgelaufenen Saison: Startelf = Stammspieler, Spieltagskader = Rotation, sonst Bank (auch Vereinslose);
    // dazu die verletzten Wochen der Saison (D102)
    if (!p.perspektiv) koerperJahr(p, p.age, spielt ? 0.8 : imKader ? 0.35 : 0.05, p.saisonAusW || 0, false);
    delete p.saisonAusW;
    p.age += 1;
    druck = druck || 0;
    const typ = p.entwicklungstyp || 'normal';
    // Trainingszentrum (D16) und Zielwert: kluges Umfeld entwickelt schneller, ein unruhiges langsamer
    // Rohdiamant (Rückmeldung 17.10.): sein Verein setzt ihn ein und fördert ihn – schneller, nie ein verlorenes Jahr
    const dia = !!p.diamant;
    const tempo = { normal: 1, schnell: 1.3, star: 1.3, ausnahme: 1.6 }[typ] * (CFG.training.basis + CFG.training.jeStufe * (training || 5))
      * (1 + CFG.ziel.entwicklung * druck) * (faktor || 1) * (dia ? 1.25 : 1) * stilTempo(p, stil);
    const A = CFG.abbau, abbauAb = p.pos === 'TW' ? A.abTw : typ === 'schnell' ? A.abSchnell : A.ab;
    let delta = 0;
    const luecke = p.truePotential - p.ovr;
    if (p.age <= 25 && luecke > 0) {
      // Jugendschub: bis 20 voll, mit 21/22 weniger (D48); 23–25 wie bisher
      const basis = p.age <= 22 ? r.int(2, 5) * jugendFaktor(p.age) : r.int(1, 3);
      // Training wirkt für alle, Spielpraxis beschleunigt (Startelf) bzw. bremst (nicht im Spieltagskader); Bessere wachsen langsamer
      const praxis = spielt || dia ? 1.2 : p.perspektiv ? CFG.ds.entwicklung : imKader ? 1.0 : 0.8;
      delta = Math.min(luecke, zufallsRunden(r, basis * tempo * praxis * ovrFaktor(p.ovr)));
      // Verlorenes Jahr: junge Spieler ohne Spieltagskader verlieren Potenzial (der Development Squad trainiert gezielt)
      if (!CFG.spielzeit.aktiv && !imKader && !p.perspektiv && p.age <= 23 && r() < 0.25 && !dia) p.truePotential = Math.max(p.ovr + delta, p.truePotential - r.int(1, 3));
      // Durchbruch: Stars und Ausnahmetalente mit Spielzeit
      if (spielt && (typ === 'star' || typ === 'ausnahme') && r() < 0.15) p.truePotential = Math.min(99, p.truePotential + r.int(2, 5));
    } else if (koerperAlter(p) < abbauAb) {
      delta = luecke > 0 ? (r() < 0.5 * ovrFaktor(p.ovr) ? 1 : 0) : r.int(-1, 1);
    } else {
      // Abbau nach Körperalter (D68): Stammspieler bauen später ab, Bankspieler und oft Verletzte früher
      delta = -r.int(1, Math.max(1, Math.min(A.max, 1 + Math.floor(koerperAlter(p)) - abbauAb)));
    }
    if (CFG.spielzeit.aktiv && !p.perspektiv) delta += spielzeitFolgen(r, p, spielt, imKader, delta, dia);
    // Form im Umfeld (Zielwert): aufwärts halten Etablierte ihr Niveau oder legen zu, abwärts bauen sie früher ab
    if (p.age >= 24 && druck && r() < CFG.ziel.form * Math.abs(druck)) {
      delta += druck > 0 ? 1 : -1;
      if (druck > 0) p.truePotential = Math.max(p.truePotential, p.ovr + delta);
    }
    // Schwere Verletzung: Chance auf Dauerschaden, Junge erholen sich besser
    if (r() < CFG.schwereVerletzung) {
      const schaden = r.int(0, p.age >= 29 ? 4 : 2);
      delta -= Math.min(2, schaden); p.truePotential -= schaden;
      p._schwereVerletzung = (p._schwereVerletzung || 0) + 1;
      koerperJahr(p, p.age, null, 0, true);
    }
    G.setzeOvr(p, Math.max(35, Math.min(99, p.ovr + delta)));
    p.truePotential = Math.max(p.ovr, Math.min(99, p.truePotential));
    if (!p.entwicklungstypBekannt && p.age >= 21) p.entwicklungstypBekannt = true;
    // D103: Hoffnung ganz geschwunden oder eingeholt → Merker weg (Spielstand bleibt klein)
    if (p.niete && (p.age - p.niete.alter >= G.CFG.niete.jahre || p.niete.schein <= p.truePotential)) delete p.niete;
  }

  const stilTempo = (p, stil) => { if (!CFG.spielzeit.aktiv) return 1; const x = stilPasst(p, stil); return x === 'passt' ? CFG.spielzeit.stil.passt : x === 'anders' ? CFG.spielzeit.stil.anders : 1; };
  // Spielzeit-Folgen (2026-10-22): Potenzial der Jungen, Stärke der Älteren; gibt die zusätzliche Stärke-Änderung zurück
  function spielzeitFolgen(r, p, spielt, imKader, delta, dia) {
    const C = CFG.spielzeit, a = p.age;
    let d = 0;
    if (!dia && !spielt) {
      const jb = !imKader && C.jungBank.find(([bis]) => a <= bis);
      const verlust = jb ? (r() < jb[3] ? r.int(jb[1], jb[2]) : 0) : (imKader && a <= C.jungRotation.bis && r() < C.jungRotation.chance ? C.jungRotation.minus : 0);
      if (verlust) p.truePotential = Math.max(p.ovr + delta, p.truePotential - verlust);
    }
    const cb = C.comeback;
    if (spielt && a <= cb.bis && p.truePotential - (p.ovr + delta) <= cb.luecke && r() < cb.chance) p.truePotential = Math.min(99, p.truePotential + r.int(cb.min, cb.max));
    const stufe = (liste) => liste.reduce((x, s) => (a >= s[0] ? s : x), null);
    const ab = !imKader ? stufe(C.altBank) : !spielt ? stufe(C.altRotation) : null;
    if (ab) d -= r.int(ab[1], ab[2]);
    if (p.ovr >= C.athletik.ovrAb && a >= C.athletik.alterAb && p.pos !== 'TW') d -= C.athletik.minus;
    return d;
  }

  // ── Kennzahlen einer Saison ──────────────────────────────────────────────
  function kennzahlen(L, saison, po, st) {
    const quoten = L.teams.map(t => capTeam(t) / t.salary_cap_limit).sort((a, b) => a - b);
    const staerken = L.teams.map(t => G.teamOvr(t));
    const m = staerken.reduce((s, x) => s + x, 0) / 32;
    const sd = Math.sqrt(staerken.reduce((s, x) => s + (x - m) ** 2, 0) / 32);
    const alle = [].concat(...L.teams.map(t => t.roster));
    const top = Math.max(...alle.map(capHit));
    return {
      jahr: L.saisonJahr, cap: L.cap,
      capQuote: { min: quoten[0], median: quoten[16], max: quoten[31], unter80: quoten.filter(q => q < 0.8).length },
      ligaQuote: L.teams.reduce((s, t) => s + capTeam(t), 0) / (32 * L.cap),
      staerke: { max: Math.max(...staerken), min: Math.min(...staerken), schnitt: m, streuung: sd },
      alter: alle.reduce((s, p) => s + p.age, 0) / alle.length,
      topGehaltAnteil: top / L.cap,
      meister: po ? po.meister : null, finalist: po ? po.finalist : null,
      playoffs: po ? [...po.setzliste.SUE_WEST, ...po.setzliste.NORD_OST] : [],
      wechsel: st || null
    };
  }

  // ── Langzeitlauf ─────────────────────────────────────────────────────────
  // opt: { seed, saisons, untergrenze:{aktiv}, cap:{aktiv}, markt:{stuetzen}, start:{aktiv, kader, pool …} (D74),
  //        nachSaison(L, saison, po) vor dem Saisonwechsel, nachWechsel(L, st) danach }
  // verlauf[0]: Stand vor Saison 1 (nach der Startphase); .vorStart = vor dem Start-Markt, .wechsel = Bilanz der Startphase
  function langzeitlauf(liga, opt) {
    opt = opt || {};
    const stuetzenAlt = G.CFG.markt.stuetzen;
    if (opt.markt && opt.markt.stuetzen) G.CFG.markt.stuetzen = opt.markt.stuetzen;
    G.setzeCap(120000000);
    try {
      const L = G.erzeugeLiga(liga, { seed: opt.seed });
      L.saisonIndex = 0;
      { const Tr = trainer(); if (Tr) Tr.sicherstellen(L); }        // D118: Trainerteams von Anfang an
      const r = G.rngAus((opt.seed || 1) * 7919 + 13);
      const vorStart = kennzahlen(L, null, null, null);
      const stStart = startphase(L, opt);
      const verlauf = [kennzahlen(L, null, null, stStart)];
      if (stStart) verlauf[0].vorStart = vorStart;
      for (let s = 0; s < (opt.saisons || 10); s++) {
        const saison = simuliereSaison(L, r, opt);
        const po = playoffs(L, saison, r);
        const k = kennzahlen(L, saison, po, null);
        if (opt.nachSaison) opt.nachSaison(L, saison, po);
        const st = saisonwechsel(L, saison, po, r, opt);
        if (opt.nachWechsel) opt.nachWechsel(L, st);
        Object.assign(k, { wechsel: st, nachher: kennzahlen(L, null, null, null) });
        verlauf.push(k);
      }
      return { L, verlauf };
    } finally {
      G.CFG.markt.stuetzen = stuetzenAlt;
      G.setzeCap(120000000);
    }
  }

  // Gehaltsvarianten für Vergleiche (Konzept 9): B ist der Standard im Generator
  const NFL_1ZU1 = [[62, 0.005], [66, 0.008], [70, 0.014], [74, 0.022], [78, 0.033], [82, 0.046],
                    [86, 0.063], [90, 0.088], [93, 0.12], [96, 0.16], [99, 0.20]];
  function varianten() {
    const std = G.CFG.markt.stuetzen.map(x => x.slice());
    const flach = std.map(([o, a]) => [o, o >= 90 ? Math.min(a, 0.08 + (o - 90) * 0.0067) : a]);
    return [
      { key: 'B', name: 'B · Mittelbau +30 % (Standard)', opt: {} },
      { key: 'A', name: 'A · NFL-Kurve 1:1', opt: { markt: { stuetzen: NFL_1ZU1 } } },
      { key: 'C', name: 'C · wie B, ohne Untergrenze', opt: { markt: { stuetzen: std }, untergrenze: { aktiv: false } } },
      { key: 'D', name: 'D · wie B, Cap fest 120 Mio (Spec)', opt: { markt: { stuetzen: std }, cap: { aktiv: false } } },
      { key: 'E', name: 'E · wie B, Stars flacher (max. 14 %)', opt: { markt: { stuetzen: flach } } }
    ];
  }

  window.DFLSaison = { CFG, spielplan, pruefeSpielplan, simuliereSaison, playoffs, draftReihenfolge, saisonwechsel,
    neuerWechsel, phaseAbschluss, phaseDraft, phaseFreeAgency, phaseKader, phaseJahrgang, jahrgangZwischenstand, nichtGedraftet, startMarkt, startphase,
    vorsaison, startJahrgang, startDraft, startDraftAn,      // D108: Start am Tag der Verträge mit erstem Draft
    npcWahl, rookieUnterschreiben, zielPruefen, zielDruck,
    unterschreibe, entlasse, spielerWert, nutzenFuer, pkTauglich, pkVertrag, minVertrag,
    teamWerte, toreErwartet, basis, stilFaktor, duell, wechselKosten, KREIS, sortiereTabelle, kennzahlen, langzeitlauf, entwicklung, ovrFaktor, jugendFaktor, varianten,
    koerperJahr, koerperAlter,
    // D102: Verletzungen, Reha, Medizin, verfügbare Elf (auch für den eigenen Verein im Spiel: dfl_medizin_patch.js)
    verfuegbar, rueckstand, kartenBonus, abzugPos, besetze, formationenFuer, medStufe, medizinStart, risikoFaktor, wuerfleVerletzung, rehaStartWert, rehaTempo,
    bleibenderRest, rehaSchritt, verletzungWoche, spielVerletzungen, ersatzPruefen, kaderNachRueckkehr, sommerpause, verletzungSaisonEnde,
    rueckkehrWelt, verletzeWelt, ligaWochen, neuerZaehler, formationenSetzen, lerneEinsatz, lernenSpieltag,
    // D110: Free Agency nach Lage, Grenze in der Free Agency; Markt (gute Free Agents warten nach Profil)
    faNutzenLage, faGeldLage, faVertragLage, faGrenze, marktWarten };
  console.log('%c[DFL-Saisonlauf v1] aktiv', 'color:#3fb950;font-weight:bold',
    '— Spielplan 26 Spieltage, Playoffs, Draft, Free Agency, Cap-Wachstum, Langzeitlauf, Verletzungen für alle 32 (D102)');
})();
