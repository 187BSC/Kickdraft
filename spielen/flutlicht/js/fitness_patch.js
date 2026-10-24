/* =====================================================================
   FITNESS PATCH v1 — Kondition/Fitness pro Spieler
   - p.fitness (0–100), Start ~95, Backfill alter Stände
   - sinkt bei der Startelf nach jedem Pflichtspiel, erholt sich pro Woche
     (Trainings-Level beschleunigt die Erholung)
   - leichter Stärke-Malus bei müder Mannschaft (nie Bonus)
   Koppelt an dieselben Hooks wie das Moral-System (advanceCalendarWeek,
   processFixtureResult, computeTeamRatings). Lädt NACH bundle_economy.
   ===================================================================== */
(function () {
  'use strict';
  var CFG = {
    start: 95, recoverPerWeek: 12, matchDrop: [15, 22], friendlyFactor: 0.6,
    strengthFloorFit: 55, strengthMinPct: 0.10,
    intensitaet: { leicht: 5, normal: 0, intensiv: -5 }
  };
  function clampF(v) { return Math.max(0, Math.min(100, Math.round(v))); }
  function rndInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }

  function ensureFitness(p) {
    if (!p) return;
    if (typeof p.fitness !== 'number' || isNaN(p.fitness)) p.fitness = CFG.start;
    p.fitness = clampF(p.fitness);
  }
  function ensureAll() { if (typeof SQUAD !== 'undefined' && Array.isArray(SQUAD)) SQUAD.forEach(ensureFitness); }
  window.ensureFitness = ensureFitness;
  ensureAll();

  function lineupPlayers() {
    try {
      if (typeof getLineupIds === 'function' && typeof getPlayer === 'function')
        return getLineupIds().map(getPlayer).filter(Boolean);
    } catch (e) {}
    return [];
  }
  function teamFitness() {
    var xi = lineupPlayers();
    if (!xi.length) return CFG.start;
    var s = 0, n = 0;
    xi.forEach(function (p) { ensureFitness(p); s += p.fitness; n++; });
    return n ? Math.round(s / n) : CFG.start;
  }
  window.teamFitness = teamFitness;

  /* Farbe & Label für Anzeige */
  window.fitnessColor = function (v) { v = v || 0; return v >= 80 ? '#25c065' : v >= 55 ? '#f2c14e' : '#ff4d4d'; };
  window.fitnessLabel = function (v) { v = v || 0; return v >= 90 ? 'Topfit' : v >= 75 ? 'Fit' : v >= 55 ? 'Angeschlagen' : 'Müde'; };

  /* ── Fitness-Puffer (Trainingslager) ──────────────────────────────────────
     Ein Camp füllt die Fitness auf (bis 100, NIE darüber) und legt einen
     temporären Puffer an: für N Wochen sinkt die Fitness pro Spiel langsamer
     (drainFactor < 1) und die Wochen-Erholung ist höher (recoverBonus). So
     bleibt das Team länger frisch, ohne den 100er-Deckel zu sprengen. */
  function refillFitness(target) {
    target = (target == null) ? 100 : target;
    if (typeof SQUAD === 'undefined' || !Array.isArray(SQUAD)) return;
    SQUAD.forEach(function (p) { ensureFitness(p); p.fitness = clampF(Math.max(p.fitness, target)); });
  }
  function applyFitnessBuffer(weeks, drainFactor, recoverBonus) {
    if (typeof CLUB === 'undefined') return;
    CLUB._fitnessBuffer = { weeks: weeks || 0, drainFactor: (drainFactor != null ? drainFactor : 1), recoverBonus: recoverBonus || 0 };
  }
  window.refillFitness = refillFitness;
  window.applyFitnessBuffer = applyFitnessBuffer;

  /* Wöchentliche Erholung (Trainings-Level beschleunigt) */
  function recoverOneWeek() {
    if (typeof SQUAD === 'undefined' || !Array.isArray(SQUAD)) return;
    var lvl = (typeof CLUB !== 'undefined' && CLUB.facilities && CLUB.facilities.training) ? CLUB.facilities.training : 1;
    var buf = (typeof CLUB !== 'undefined') ? CLUB._fitnessBuffer : null;
    var bonus = (buf && buf.weeks > 0) ? (buf.recoverBonus || 0) : 0;
    // Intensität wirkt auf die Erholung (2026-10-24, Nutzer: „Senkt die Intensität im Training die Fitness oder steigert sie, wenn
    // man mehr chillt?“ – vorher gar nicht): leicht +5, intensiv −5 je Woche
    var intens = (typeof CLUB !== 'undefined' && CLUB.training && CLUB.training.intensity) || 'normal';
    var rec = CFG.recoverPerWeek + (lvl - 1) * 2 + bonus + (CFG.intensitaet[intens] || 0);
    SQUAD.forEach(function (p) { ensureFitness(p); p.fitness = clampF(p.fitness + rec); });
    // Puffer eine Woche altern lassen
    if (buf && buf.weeks > 0) { buf.weeks--; if (buf.weeks <= 0) CLUB._fitnessBuffer = null; }
  }
  if (typeof window.advanceCalendarWeek === 'function') {
    var _adv = window.advanceCalendarWeek;
    window.advanceCalendarWeek = function () {
      var r = _adv.apply(this, arguments);
      if (r !== false) { try { ensureAll(); recoverOneWeek(); } catch (e) { console.warn('[Fitness] recover', e); } }
      return r;
    };
    try { advanceCalendarWeek = window.advanceCalendarWeek; } catch (e) {}
  }

  /* Match: Startelf verliert Kondition (Freundschaftsspiel weniger) */
  if (typeof window.processFixtureResult === 'function') {
    var _proc = window.processFixtureResult;
    window.processFixtureResult = function () {
      var xi = lineupPlayers();
      var isFriendly = (typeof CURRENT_FIXTURE !== 'undefined' && CURRENT_FIXTURE && CURRENT_FIXTURE.type === 'friendly');
      var r = _proc.apply(this, arguments);
      try {
        var buf = (typeof CLUB !== 'undefined') ? CLUB._fitnessBuffer : null;
        var drainF = (buf && buf.weeks > 0) ? (buf.drainFactor || 1) : 1;
        xi.forEach(function (p) {
          ensureFitness(p);
          var drop = rndInt(CFG.matchDrop[0], CFG.matchDrop[1]);
          if (isFriendly) drop = Math.round(drop * CFG.friendlyFactor);
          drop = Math.round(drop * drainF);
          p.fitness = clampF(p.fitness - drop);
        });
      } catch (e) { console.warn('[Fitness] match', e); }
      return r;
    };
    try { processFixtureResult = window.processFixtureResult; } catch (e) {}
  }

  /* Fitness → Stärke: nur Malus bei Müdigkeit (90+ = 1.0, darunter bis −10%) */
  function fitnessStrengthFactor() {
    var tf = teamFitness();
    if (tf >= 90) return 1;
    var lo = CFG.strengthFloorFit;
    var f = 1 - CFG.strengthMinPct * (1 - Math.max(0, (tf - lo)) / (90 - lo));
    return Math.max(1 - CFG.strengthMinPct, Math.min(1, f));
  }
  window.fitnessStrengthFactor = fitnessStrengthFactor;
  if (typeof window.computeTeamRatings === 'function') {
    var _rat = window.computeTeamRatings;
    window.computeTeamRatings = function () {
      var r = _rat.apply(this, arguments);
      try {
        var f = fitnessStrengthFactor();
        if (r && typeof r === 'object' && f < 1) {
          var cap = function (v) { return Math.round(Math.max(30, Math.min(95, v))); };
          if (typeof r.attack === 'number') r.attack = cap(r.attack * f);
          if (typeof r.defense === 'number') r.defense = cap(r.defense * f);
          if (typeof r.overall === 'number') r.overall = cap(r.overall * f);
        }
      } catch (e) { console.warn('[Fitness] ratings', e); }
      return r;
    };
    try { computeTeamRatings = window.computeTeamRatings; } catch (e) {}
  }

  console.log('[Fitness v1] aktiv — Kondition sinkt pro Spiel, erholt sich pro Woche (Malus bei Müdigkeit)');
})();
