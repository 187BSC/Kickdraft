/* ═══════════════════════════════════════════════════════════════════════════
   SPIELZEIT-ENTWICKLUNG (eigenes Team) · v1 · Kickdraft und Unter Flutlicht (gleiche Datei in beiden Spielen)
   Nutzer 2026-10-22: „junge Spieler sollen schneller an Potenzial verlieren, wenn sie nicht spielen … je älter desto mehr die
   Stärke … ab 29 deutlich größerer Decline, ab 30 ruhig −2 oder −3 auf der Bank … die 80–90 sollen durch die Athletik sehr viel
   abbauen, entweder spielen oder nicht … kann sich wieder ändern, wenn sie viel spielen, gut sind und in einem System, das ihnen
   liegt“ – „bitte das alles auch für die Vereinskarriere“.
   ─────────────────────────────────────────────────────────────────────────
   Am Saisonende (TrainingSystem.snapshotSquad, vor dem Altern) je Spieler nach Einsatzanteil der Saison
   (Spiele mit Note / meiste Spiele im Kader): Bank < 20 %, Rotation 20–60 %, Stamm ≥ 60 %.
     · Junge: bis 20 auf der Bank Potenzial −2…−4, 21–23 auf der Bank −1…−3 (70 %), bis 23 in der Rotation −1 (30 %)
     · Ältere: ab 29 auf der Bank Stärke −1…−2, ab 30 −2…−3, ab 32 −2…−4; ab 30 in der Rotation −1
     · Athletik: Stärke ab 80 und ab 30 Jahren −1 (Tempo zuerst), ob er spielt oder nicht (kein Torwart)
     · Stil: Stammspieler bis 25, deren Typ zum eigenen Stil passt (Passung ≥ 65 %), legen mit 50 % +1 zu
   Die alte Stagnationsregel (bis 24, unter 7 Spielen) ist damit ersetzt (bundle_match.js potentialBySeason.stagChance = 0).
   Gleiche Zahlen wie die KI-Welt in Kickdraft (dfl_saisonlauf.js CFG.spielzeit).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const TS = window.TrainingSystem;
  if (!TS || typeof TS.snapshotSquad !== 'function') { console.warn('[Spielzeit-Entwicklung] TrainingSystem fehlt – Patch inaktiv'); return; }
  const CFG = {
    aus: false,
    bank: 0.2, stamm: 0.6, minSpiele: 6,                  // Einsatzanteile; ohne so viele Vereinsspiele kein Urteil
    jungBank: [[20, 2, 4, 1], [23, 1, 3, 0.7]],
    jungRotation: { bis: 23, minus: 1, chance: 0.3 },
    altBank: [[29, 1, 2], [30, 2, 3], [32, 2, 4]],
    altRotation: [[30, 1, 1]],
    athletik: { ovrAb: 80, alterAb: 30, minus: 1 },
    stil: { bis: 25, passungAb: 65, chance: 0.5 }
  };
  const zufall = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const liste = p => (p && p.matchRatings && Array.isArray(p.matchRatings.list) && p.matchRatings.season === ((window.LEAGUE && LEAGUE.season) || 1)) ? p.matchRatings.list : [];
  const name = p => ((p.firstName || '') + ' ' + p.name).trim();
  const nachricht = (t, x) => { try { if (typeof addNews === 'function') addNews('squad', t, x); } catch (e) { /* ohne Postfach */ } };
  // Stärke um n senken: Athletik (Tempo) zuerst, dann der Bereich, der seine Stärke trägt
  function senke(p, n, athletik) {
    if (typeof computeOvrFromAreas !== 'function' || n <= 0) return 0;
    const vorher = p.ovr, ziel = vorher - n;
    for (let i = 0; i < n * 8 && p.ovr > ziel; i++) {
      const reihe = [['def', p.def], ['mid', p.mid], ['att', p.att]].sort((a, b) => (b[1] || 0) - (a[1] || 0));
      const k = athletik && (p.pace || 0) > 35 && i % 2 === 0 ? 'pace' : reihe[0][0];
      p[k] = Math.max(30, (p[k] || 50) - 1);
      p.ovr = computeOvrFromAreas(p);
    }
    if (typeof computeMarketValue === 'function') p.value = computeMarketValue(p);
    return vorher - p.ovr;
  }
  function hebe(p) {
    if (typeof computeOvrFromAreas !== 'function') return 0;
    const vorher = p.ovr, reihe = [['def', p.def], ['mid', p.mid], ['att', p.att]].sort((a, b) => (b[1] || 0) - (a[1] || 0));
    for (let i = 0; i < 6 && p.ovr <= vorher; i++) { p[reihe[0][0]] = Math.min(99, (p[reihe[0][0]] || 50) + 1); p.ovr = computeOvrFromAreas(p); }
    if (typeof computeMarketValue === 'function') p.value = computeMarketValue(p);
    return p.ovr - vorher;
  }
  function passung(p) {
    try { const S = window.DFLScouting; const x = S && typeof S.passung === 'function' ? S.passung(p) : null; return x && x.relevant ? x.pct : null; } catch (e) { return null; }
  }
  const stufe = (l, a) => l.reduce((x, s) => (a >= s[0] ? s : x), null);
  function saisonende() {
    if (CFG.aus || typeof SQUAD === 'undefined' || !SQUAD.length || typeof CLUB === 'undefined') return;
    const saison = (window.LEAGUE && LEAGUE.season) || 1;
    if (!CLUB.training) CLUB.training = {};
    if (CLUB.training.spielzeitSaison === saison) return;          // einmal je Saison
    CLUB.training.spielzeitSaison = saison;
    const meiste = Math.max(0, ...SQUAD.map(p => liste(p).length));
    if (meiste < CFG.minSpiele) return;
    const verlust = [], abbau = [];
    SQUAD.forEach(p => {
      if (!p || p.perspektiv) return;
      const n = liste(p).length, anteil = n / meiste, a = p.age || 25;
      const rolle = anteil >= CFG.stamm ? 'stamm' : anteil >= CFG.bank ? 'rotation' : 'bank';
      const pot = p.truePotential || p.ovr;
      if (rolle !== 'stamm') {
        const jb = rolle === 'bank' && CFG.jungBank.find(([bis]) => a <= bis);
        const v = jb ? (Math.random() < jb[3] ? zufall(jb[1], jb[2]) : 0) : (rolle === 'rotation' && a <= CFG.jungRotation.bis && Math.random() < CFG.jungRotation.chance ? CFG.jungRotation.minus : 0);
        if (v) { p.truePotential = Math.max(p.ovr + 1, pot - v); if (p.truePotential < pot) verlust.push(`${name(p)} (${a}, −${pot - p.truePotential})`); }
      }
      let minus = 0;
      const ab = rolle === 'bank' ? stufe(CFG.altBank, a) : rolle === 'rotation' ? stufe(CFG.altRotation, a) : null;
      if (ab) minus += zufall(ab[1], ab[2]);
      const ath = p.ovr >= CFG.athletik.ovrAb && a >= CFG.athletik.alterAb && p.pos !== 'TW';
      if (ath) minus += CFG.athletik.minus;
      if (minus) { const d = senke(p, minus, ath); if (d) abbau.push(`${name(p)} (${a}, −${d})`); }
      if (rolle === 'stamm' && a <= CFG.stil.bis && p.ovr < (p.truePotential || 0)) {
        const pa = passung(p);
        if (pa != null && pa >= CFG.stil.passungAb && Math.random() < CFG.stil.chance) hebe(p);
      }
      if (p.truePotential != null) p.truePotential = Math.max(p.ovr, p.truePotential);
    });
    if (verlust.length) nachricht('Verlorenes Jahr', `Ohne Spielzeit stagniert die Entwicklung – Potenzial gesunken: ${verlust.join(', ')}. Mit Einsätzen ist es wieder aufholbar.`);
    if (abbau.length) nachricht('Abbau im Alter', `Wer nicht spielt oder die Athletik verliert, baut ab: ${abbau.join(', ')}.`);
  }
  // vor der Potenzial-Revision und dem Altern (bundle_squad.js ruft snapshotSquad vor startNewSeason)
  const _orig = TS.snapshotSquad.bind(TS);
  TS.snapshotSquad = function () {
    try { saisonende(); } catch (e) { console.warn('[Spielzeit-Entwicklung] Saisonende', e); }
    return _orig.apply(this, arguments);
  };
  window.SpielzeitEntwicklung = { CFG, saisonende };
  console.log('[Spielzeit-Entwicklung v1] aktiv — Potenzial/Stärke nach Einsatzanteil, Athletik ab 80/30, Stil-Bonus');
})();
