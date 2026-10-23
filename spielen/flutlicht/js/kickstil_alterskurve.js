/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · ALTERSKURVE  ·  v1   (Nutzer 2026-10-15: „Orientiere dich an der realen Welt, dass alte Spieler wirklich auch
   schnell runtergehen“)
   ─────────────────────────────────────────────────────────────────────────
   Eine Kurve für ALLE Spieler (eigener Kader am Saisonende über engine_main.js applyEndOfSeasonClubEffects, KI-Kader über
   kickstil_lebende_welt.js). Vorher verlor ein eigener Flügelspieler ab 30 im Schnitt nur ~0,4 OVR im Jahr (45-%-Münze,
   −1 auf EINEN Bereich) – mit 34 war er fast so gut wie mit 29.
   Wie in echt (Leistungsdaten/Bewertungen): Höhepunkt 26–29, ab ~30 erst langsam, dann immer schneller:
     Jahre über Beginn  0     1     2     3     4     5+
     Ø OVR-Verlust      0,8   1,5   2,2   3,0   3,6   4,2      × Tempo der Position, ± Zufall
   Beginn je Position: Torhüter 33, Innenverteidiger 31, zentrales Mittelfeld 31, offensives Mittelfeld 30, Außenverteidiger 30,
   Flügel 29, Sturm 30 (ALTERUNG in engine_main.js wird angepasst – auch Wachstums-Zweig und Anzeige nutzen sie).
   Gute Saison (Ø-Note ≥ 7,2 bei ≥ 12 Spielen) bremst um 1, eine starke Saison als Oldie (7,8) kann den Abbau aussetzen.
   Tempo verliert immer etwas mehr (Antritt geht zuerst), Erfahrung (mental) hält.
   API: Alterskurve.verlust(p, alter, faktor) · .eigen(p, spiele, note) · .beginn(p) · .CFG
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const CFG = {
    beginn: { TW: 33, IV: 31, ZDM: 31, ZM: 31, ZOM: 30, OM: 30, AM: 30, LM: 30, RM: 30, AV: 30, LV: 30, RV: 30, FL: 29, LF: 29, RF: 29, ST: 30 },
    tempo: { TW: 0.7, IV: 0.85, ZDM: 0.9, ZM: 0.95, ZOM: 1.0, OM: 1.0, AM: 1.1, LM: 1.1, RM: 1.1, AV: 1.1, LV: 1.1, RV: 1.1, FL: 1.15, LF: 1.15, RF: 1.15, ST: 1.0 },
    kurve: [0.8, 1.5, 2.2, 3.0, 3.6, 4.2],
    streuung: 0.4,          // Verlust × (1 ± 0,4)
    guteSaison: { spiele: 12, note: 7.2, bremse: 1 },
    oldie: { note: 7.8, chance: 0.4 },
    tempoExtra: 1           // Tempo (pace) verliert zusätzlich
  };
  const posVon = p => (p && (p.pos || (p.positions && p.positions[0]))) || 'ZM';
  const beginn = p => (CFG.beginn[posVon(p)] || 31) + (typeof window.traitAlterungsVerschiebung === 'function' ? (window.traitAlterungsVerschiebung(p) || 0) : 0);
  const runden = x => Math.floor(x) + (Math.random() < x - Math.floor(x) ? 1 : 0);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // Erwarteter Verlust in OVR-Punkten für ein Alter (ganzzahlig, zufällig gerundet)
  function verlust(p, alter, faktor) {
    const y = Math.floor(alter) - beginn(p);
    if (y < 0) return 0;
    const L = CFG.kurve[Math.min(y, CFG.kurve.length - 1)] * (CFG.tempo[posVon(p)] || 1) * (faktor || 1);
    return Math.max(0, runden(L * (1 - CFG.streuung + Math.random() * 2 * CFG.streuung)));
  }
  // Verlust auf die Bereiche: alle drei gleich, damit die Positionsstärke genau um d fällt
  function anwenden(p, d) {
    if (d <= 0) return;
    ['def', 'mid', 'att'].forEach(k => { p[k] = clamp((+p[k] || 50) - d, 15, 99); });
    if (p.pace != null) p.pace = clamp(p.pace - d - CFG.tempoExtra, 15, 99);
  }
  // Eigener Spieler am Saisonende (engine_main.js, Zweig ab Abbau-Beginn)
  function eigen(p, spiele, note) {
    let d = verlust(p, p.age);
    if (spiele >= CFG.guteSaison.spiele && note >= CFG.guteSaison.note) d = Math.max(0, d - CFG.guteSaison.bremse);
    if (spiele >= CFG.guteSaison.spiele && note >= CFG.oldie.note && Math.random() < CFG.oldie.chance) d = 0;
    anwenden(p, d);
    if (d > 0 && p.mental != null && Math.random() < 0.3) p.mental = clamp(p.mental + 1, 20, 99);
    if (typeof computeOvrFromAreas === 'function') p.ovr = computeOvrFromAreas(p);
    p.truePotential = Math.min(p.truePotential || p.ovr, Math.max(p.ovr, (p.truePotential || p.ovr) - d));
    return d;
  }
  // ALTERUNG (engine_main.js) angleichen: Beginn des Abbaus und Tempo (Wachstumszweig bis zum Beginn, Anzeige)
  try {
    if (typeof ALTERUNG !== 'undefined') Object.keys(CFG.beginn).forEach(k => {
      ALTERUNG[k] = Object.assign({}, ALTERUNG[k] || {}, { ab: CFG.beginn[k], tempo: CFG.tempo[k] });
    });
  } catch (e) { /* ohne Tabelle */ }

  window.Alterskurve = { CFG, verlust, eigen, beginn, anwenden };
  console.log('[Kickstil-Alterskurve v1] aktiv — Abbau wie in echt: ab ~30 erst langsam, dann 2–4 Punkte im Jahr');
})();
