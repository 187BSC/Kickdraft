/* ===== substitution_stats_patch.js =====
   EINWECHSLUNGEN ZÄHLEN v1
   ─────────────────────────────────────────────────────────────────────────────
   Die Engine wechselt längst korrekt: `CFG.wechselMax = 3`, geplant auf etwa die
   55., 65. und 76. Minute, heraus geht jeweils der unfitteste Feldspieler, herein
   kommt positionsgerechter Ersatz (gleiche Position bekommt +14 Bonus).

   Gebucht wurde davon aber nichts. `app_main.js` schreibt die Einsätze so:
       getLineupIds().map(getPlayer).forEach(p => { p.gamesPlayed++; addPlayerApp(p); });
   — also ausschließlich für die STARTELF. Gemessen über eine komplette Saison mit
   der Schnellsimulation: 11 Spieler mit je 34 Einsätzen, die sieben Ersatzleute
   bei null, obwohl sie laut Spielereignissen mehrfach eingewechselt worden waren.
   Für sie lief damit auch nichts weiter: keine Einsatzprämie, keine Einsatzzeit-
   Zufriedenheit, kein U21-Nachweis für Jugendwahn oder Nachwuchsoffensive.

   Dieses Modul liest die Wechsel-Ereignisse des eigenen Teams aus und trägt die
   Einsätze nach.

   Lädt NACH engine_v3_adapter.js und app_main.js, VOR init_bootstrap.js.
   ============================================================================= */
(function () {
  'use strict';

  // Vom Engine-Ereignis auf den echten Kaderspieler: Der Engine-Spieler trägt
  // _ref auf den Eingabe-Datensatz, der wiederum _ref auf den Kaderspieler.
  function echterSpieler(ev) {
    let r = ev && ev.player && ev.player._ref;
    if (r && r._ref) r = r._ref;
    return (r && r.id != null) ? r : null;
  }

  // Welche Seite ist der eigene Verein in diesem Spiel?
  function eigeneSeite() {
    try {
      if (typeof CURRENT_FIXTURE !== 'undefined' && CURRENT_FIXTURE)
        return CURRENT_FIXTURE.isHome ? 'home' : 'away';
    } catch (e) {}
    return 'home';
  }

  // Die Wechsel des letzten Spiels — von simulateMatch eingesammelt.
  let letzteWechsel = [];

  if (window.MatchEngineV3 && typeof window.MatchEngineV3.simulateMatch === 'function') {
    const _sim = window.MatchEngineV3.simulateMatch;
    window.MatchEngineV3.simulateMatch = function () {
      const res = _sim.apply(this, arguments);
      try {
        const evs = (res && (res.events || res.ev)) || [];
        letzteWechsel = evs.filter(function (x) { return x && x.type === 'wechsel'; });
      } catch (e) { letzteWechsel = []; }
      return res;
    };
  }

  function bucheEinwechslungen() {
    if (!letzteWechsel.length) return 0;
    const seite = eigeneSeite();
    const saison = (typeof LEAGUE !== 'undefined' && LEAGUE) ? LEAGUE.season : 1;
    // Startelf ausschließen: die ist über app_main.js bereits gebucht, und ein
    // Spieler kann pro Partie nur einen Einsatz bekommen.
    const schonGebucht = {};
    try {
      (typeof getLineupIds === 'function' ? getLineupIds() : []).forEach(function (id) { schonGebucht[id] = 1; });
    } catch (e) {}

    let n = 0;
    letzteWechsel.forEach(function (ev) {
      if (ev.side !== seite) return;                  // nur der eigene Verein
      const p = echterSpieler(ev);
      if (!p || schonGebucht[p.id]) return;
      schonGebucht[p.id] = 1;
      p.gamesPlayed = (p.gamesPlayed || 0) + 1;
      try { if (typeof addPlayerApp === 'function') addPlayerApp(p, saison); } catch (e) {}
      // Note für den Kurzeinsatz: die Engine vergibt für Eingewechselte keine
      // eigene, deshalb eine zurückhaltende Bewertung knapp unter Durchschnitt —
      // ohne sie fiele der Spieler aus jeder Notenauswertung heraus.
      try {
        if (!p.matchRatings || p.matchRatings.season !== saison) p.matchRatings = { season: saison, list: [] };
        const note = Math.round((6.4 + Math.random() * 0.8) * 10) / 10;
        p.matchRatings.list.push(note);
        p.lastMatchRating = note;
        if (p.stats && p.stats.season === saison) {
          const c = (p.stats.ratingsCount || 0) + 1;
          p.stats.avgRating = Math.round((((p.stats.avgRating || note) * (c - 1) + note) / c) * 10) / 10;
          p.stats.ratingsCount = c;
        }
      } catch (e) {}
      n++;
    });
    letzteWechsel = [];
    return n;
  }

  // Nach dem regulären Abschluss buchen — dort läuft die Startelf-Zählung.
  if (typeof window.processFixtureResult === 'function') {
    const _pfr = window.processFixtureResult;
    window.processFixtureResult = function () {
      const r = _pfr.apply(this, arguments);
      try {
        const n = bucheEinwechslungen();
        if (n) console.log('[Einwechslungen] ' + n + ' Kurzeinsatz(e) nachgetragen');
      } catch (e) { console.warn('[Einwechslungen] Fehler', e); }
      return r;
    };
    try { processFixtureResult = window.processFixtureResult; } catch (e) {}
  }

  window.EinwechslungsStatistik = { bucheEinwechslungen: bucheEinwechslungen,
                                    letzteWechsel: function () { return letzteWechsel; } };
  console.log('[Einwechslungen v1] aktiv — Kurzeinsätze zählen in die Statistik');
})();
