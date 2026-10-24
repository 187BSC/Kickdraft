/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · MARKTWERT FÜR ALTER UND POTENZIAL  ·  v1   (2026-10-24)
   ─────────────────────────────────────────────────────────────────────────
   Nutzer: „Bayern hat 100 % overpayed bei einem 80er mit 81–89 Potenzial“ – „89 ist nicht so hoch, dass du dafür 100 Mille
   ausgibst … so bei 75 Mille, wenn der Spieler schon 81 hat und 19 ist (mit Aufschlag eines Top-Klubs aus dem Ausland)“.
   Vorher stapelten vier Schichten den Wert junger Spieler: Potenzial-Aufschlag + Talent-Stufe (engine_main.js), Juwel-Aufschlag bis
   ×4,2 (transfermarkt_balance.js), Nachwuchs ×2 und Generationstalent ×2 (PriceBalance in bundle_match.js) – für 80/19/89 rund ×20
   auf den Wert eines fertigen Spielers; ältere fielen dafür steil ab (31 J. ×0,7 × 0,65 × …).
   Neu, EINE Rechnung für Alter und Potenzial auf dem „fertigen Wert“ (derselbe Spieler mit 26 Jahren ohne Luft nach oben – die
   übrigen Schichten Stärke, Position, Klasse, Unzufriedenheit bleiben):
     Marktwert = fertig × ALTER[alter] × (1 + Luft × LUFT[alter] + Spitze)
     Spitze = (Potenzial − 84) × CFG.spitze × SPITZE_JUNG[alter], nur ab Potenzial 85
   Lädt nach transfermarkt_balance.js und vor den Modulen, die den Wert noch je Verein/NLZ verändern (kickstil_pc_nlz.js).
   Schalter CFG.aktiv (aus = alte Rechnung), Vergleich KSMarktwert.alt(p).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const W = window;
  const CFG = {
    aktiv: true,
    fertigAlter: 26,
    // Alter → Faktor auf den fertigen Wert (jung etwas mehr, ab 29 schrittweise weniger)
    alter: { 17: 1.15, 18: 1.15, 19: 1.15, 20: 1.15, 21: 1.15, 22: 1.08, 23: 1.08, 24: 1.0, 25: 1.0, 26: 1.0, 27: 1.0, 28: 0.95,
      29: 0.85, 30: 0.72, 31: 0.6, 32: 0.45, 33: 0.35, 34: 0.25 },
    alterSonst: 0.18,
    // Wert je Punkt Luft nach oben (Potenzial − Stärke), je jünger desto mehr
    luft: { 16: 0.10, 17: 0.10, 18: 0.10, 19: 0.10, 20: 0.09, 21: 0.08, 22: 0.065, 23: 0.05, 24: 0.04, 25: 0.025, 26: 0.015 },
    luftMax: 14,
    // Spitzenpotenzial ab 85 (Weltklasse in Reichweite)
    spitze: 0.12, spitzeMax: 0.6,
    // Wer schon Weltklasse ist, ist fertig bezahlt: Luft und Spitze zählen ab Stärke 80 weniger (88: gut die Hälfte)
    schonGut: { ab: 80, jePunkt: 0.06, min: 0.5 },
    // Weltklasse gleitend statt Sprung: PriceBalance verdoppelt ab Potenzial 88 (bundle_match.js GENERATIONAL_FACTOR) – im fertigen Wert
    // (Potenzial = Stärke) trifft das alle ab Stärke 88: 87 → 68 Mio, 88 → 146 Mio. Hier herausgerechnet, dafür ab 85 je Punkt +12 %.
    weltklasse: { ab: 84, jePunkt: 0.12, generationAb: 88, deckelAb: 88, ueberDeckel: 1.08 },
    // Über 88 nicht mehr exponentiell (Grundwert × 1,225 je Punkt): 5-Saison-Test 2026-10-24 zeigte 93/22 = 516 Mio – jetzt × 1,08 je Punkt
    spitzeJung: { 16: 1, 17: 1, 18: 1, 19: 1, 20: 1, 21: 1, 22: 0.6, 23: 0.6, 24: 0.3, 25: 0.3 }
  };
  const vor = W.computeMarketValue;
  if (typeof vor !== 'function') { console.warn('[Kickstil-Marktwert] computeMarketValue fehlt – inaktiv'); return; }
  const rund = v => (typeof roundMarketValue === 'function' ? roundMarketValue(v) : Math.round(v / 1000) * 1000);
  const tabelle = (t, a, sonst) => (t[a] != null ? t[a] : a < 17 ? t[Math.min(...Object.keys(t).map(Number))] : sonst);

  function faktor(p) {
    const alter = p.age || 24, ovr = p.ovr || 0, tp = Math.max(ovr, p.truePotential || ovr);
    const luft = Math.min(CFG.luftMax, tp - ovr);
    const gut = Math.max(CFG.schonGut.min, 1 - Math.max(0, ovr - CFG.schonGut.ab) * CFG.schonGut.jePunkt);
    const spitze = tp >= 85 ? Math.min(CFG.spitzeMax, (tp - 84) * CFG.spitze) * tabelle(CFG.spitzeJung, alter, 0) : 0;
    return tabelle(CFG.alter, alter, CFG.alterSonst) * (1 + (luft * tabelle(CFG.luft, alter, 0) + spitze) * gut);
  }
  function fertig(p) {
    const K = CFG.weltklasse, o = Math.min(p.ovr, K.deckelAb);
    const q = Object.assign({}, p, { ovr: o, age: CFG.fertigAlter, truePotential: o, potential: o });
    let v = vor.call(this, q);
    if (o >= K.generationAb) v /= 2;
    return v * (1 + Math.max(0, o - K.ab) * K.jePunkt) * Math.pow(K.ueberDeckel, Math.max(0, p.ovr - K.deckelAb));
  }
  W.computeMarketValue = function (p) {
    if (!CFG.aktiv || !p || !p.ovr) return vor.apply(this, arguments);
    return rund(Math.max(2500, fertig(p) * faktor(p)));
  };
  try { computeMarketValue = W.computeMarketValue; } catch (e) { /* nur window */ }
  W.KSMarktwert = { CFG, faktor, fertig, alt: p => vor(p) };
  console.log('[Kickstil-Marktwert v1] aktiv — Alter und Potenzial in einer Rechnung (fertiger Wert × Alter × Luft)');
})();
