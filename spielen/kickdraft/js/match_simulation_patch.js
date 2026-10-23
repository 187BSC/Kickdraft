/* ===== match_simulation_patch.js =====
   "Spiel simulieren" — schneller durch die Saison kommen.
   Berechnet das eigene Spiel über die gleiche Schnellsimulation, die auch für
   NPC-Partien genutzt wird (quickSimResult), füllt plausible Statistiken und
   Torschützen, und übergibt an die normale processFixtureResult()-Logik — so
   bleiben Sperren, Verletzungen, Moral, News etc. exakt wie bei einem echten
   Spiel, nur ohne die minutengenaue Animation.
   Lädt nach app_main.js (braucht ratingsOf, quickSimResult, processFixtureResult,
   CURRENT_FIXTURE, TEAMS, G, addEv, getLineupIds, getPlayer).
   ============================================================================= */
(function () {
  'use strict';

  function simulateCurrentFixture() {
    // WICHTIG: CURRENT_FIXTURE/G sind top-level let/const (globale LEXIKALISCHE
    // Bindings) und existieren NICHT als window-Properties — daher bare Zugriffe
    // mit typeof-Guards statt window.* (window.CURRENT_FIXTURE wäre immer undefined).
    if (typeof CURRENT_FIXTURE === 'undefined' || !CURRENT_FIXTURE) {
      if (typeof ensureFixtureLoaded === 'function') ensureFixtureLoaded();
    }
    if (typeof CURRENT_FIXTURE === 'undefined' || !CURRENT_FIXTURE) { alert('Kein Spiel geladen.'); return; }
    if (typeof G !== 'undefined' && G.running) { alert('Das Spiel läuft bereits — bitte zuerst beenden oder pausieren.'); return; }
    if (typeof G !== 'undefined' && G.ended) { return; }   // schon vorbei

    const btn = document.getElementById('sim-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader-2" aria-hidden="true"></i> Simuliere…'; }

    try {
      runQuickSimulation();
    } catch (e) {
      console.error('[MatchSim] Fehler bei der Simulation', e);
      alert('Simulation fehlgeschlagen — bitte normal anpfeifen.');
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-player-track-next" aria-hidden="true"></i> Spiel simulieren'; }
      return;
    }
  }

  function runQuickSimulation() {
    // Team-Stärken wie im echten Spiel synchronisieren (Taktik, Aufstellung etc.
    // sind über syncClubToTeams bereits in TEAMS eingeflossen, sobald das Fixture
    // geladen wurde — wir nutzen die aktuellen TEAMS-Werte direkt).
    const home = { def: TEAMS.home.defense, mid: (TEAMS.home.str || TEAMS.home.attack), att: TEAMS.home.attack, ovr: TEAMS.home.str };
    const away = { def: TEAMS.away.defense, mid: (TEAMS.away.str || TEAMS.away.attack), att: TEAMS.away.attack, ovr: TEAMS.away.str };

    const [gh, ga] = (typeof quickSimResult === 'function') ? quickSimResult(home, away) : [1, 1];

    G.homeGoals = gh; G.awayGoals = ga;
    G.min = 90;
    G.running = false; G.halfDone = true; G.ended = true;

    // Plausible Statistiken passend zum Ergebnis erzeugen (fürs Nachspiel-Feed)
    fillPlausibleStats(gh, ga);

    // Torschützen fürs Log + spätere Auswertung (Torschützenliste etc., falls
    // vorhanden) — einfache Zuordnung auf Feldspieler der jeweiligen Startelf.
    assignQuickGoalScorers(gh, ga);

    addEv('info', -1, `⏩ Spiel simuliert: Endstand ${gh}:${ga}`);

    // Zeit-Badge auf Abpfiff setzen (wie beim normalen Spielende).
    const tb = document.getElementById('time-badge');
    if (tb) { tb.textContent = 'FT'; tb.className = 'time-badge ft'; }

    // Genau denselben Abschluss-Pfad nutzen wie ein normal zu Ende gespieltes Spiel.
    if (typeof processFixtureResult === 'function') processFixtureResult();
    if (typeof updateUI === 'function') updateUI();

    // WICHTIG (Bugfix): Wie triggerFulltime den „Nächste Woche → Hub"-Knopf
    // einblenden. Ohne diesen Schritt blieben G.min=90 und G.ended=true stehen,
    // sodass switchAppView('match') das nächste Fixture NICHT lud (Bedingung
    // G.min===0) — der Nutzer musste nach jedem Spiel Strg+F5 drücken.
    if (typeof setupPostMatchButton === 'function') setupPostMatchButton();

    const btn = document.getElementById('sim-btn');
    if (btn) { btn.style.display = 'none'; }

    // Abpfiff-Modal wie beim normal gespielten Match zeigen (Ergebnis + Statistik).
    if (window.PostMatchModal && typeof window.PostMatchModal.show === 'function') {
      try { window.PostMatchModal.show(); } catch (e) { console.warn('[MatchSim] Modal', e); }
    }
  }

  function fillPlausibleStats(gh, ga) {
    // Schüsse/Ballbesitz/Ecken grob am Ergebnis orientiert, mit etwas Zufall —
    // rein kosmetisch fürs Nachspiel-Feed, beeinflusst keine Werte.
    const dom = Math.max(0.3, Math.min(0.7, 0.5 + (gh - ga) * 0.04));
    G.poss = [Math.round(dom * 100), Math.round((1 - dom) * 100)];
    G.shots = [Math.max(gh + 2, Math.round(8 + (gh - ga) * 1.5 + Math.random() * 4)),
               Math.max(ga + 2, Math.round(8 - (gh - ga) * 1.5 + Math.random() * 4))];
    G.corners = [Math.round(3 + Math.random() * 5), Math.round(3 + Math.random() * 5)];
    G.fouls = [Math.round(6 + Math.random() * 8), Math.round(6 + Math.random() * 8)];
    G.passAcc = [Math.round(72 + dom * 15), Math.round(72 + (1 - dom) * 15)];
  }

  function assignQuickGoalScorers(gh, ga) {
    G.goalLog = G.goalLog || [];
    G.scorers = G.scorers || [];   // fürs Abpfiff-Modal (eigene Torschützen)
    const season = (typeof LEAGUE !== 'undefined' && LEAGUE) ? LEAGUE.season : 1;
    // In Testspielen keine Saison-Statistik/Prämien gutschreiben.
    const competitive = !(typeof CURRENT_FIXTURE !== 'undefined' && CURRENT_FIXTURE && CURRENT_FIXTURE.type === 'friendly');
    // ENGINE-KONVENTION: G.homeGoals sind IMMER FCMs Tore, TEAMS.away IMMER der
    // Gegner — FCM_IS_HOME ist nur Label/Momentum (siehe processFixtureResult).
    const fcmScorers = pickScorers('home', gh);   // Spielerobjekte aus der eigenen Elf
    const oppScorers = pickScorers('away', ga);    // generische Gegner-Namen
    const oppName = TEAMS.away.name;

    // Tore (und ~55% eine Vorlage) den EIGENEN Spielern gutschreiben — nur in
    // Pflichtspielen. addPlayerGoal zahlt via contracts_patch auch die Tor-Prämie.
    const lineup = (typeof getLineupIds === 'function' && typeof getPlayer === 'function')
      ? getLineupIds().map(getPlayer).filter(Boolean) : [];
    fcmScorers.forEach(s => {
      if (!competitive || !s.player) return;
      if (typeof addPlayerGoal === 'function') addPlayerGoal(s.player, season);
      if (lineup.length > 1 && Math.random() < 0.55 && typeof addPlayerAssist === 'function') {
        const others = lineup.filter(p => p !== s.player);
        const a = others[Math.floor(Math.random() * others.length)];
        if (a) { addPlayerAssist(a, season); s.assistPlayer = a; }
      }
    });

    // Feed-Events chronologisch (FCM = Seite 0/'home' laut Engine-Konvention).
    let min = 3;
    const evs = [];
    fcmScorers.forEach(s => evs.push({ fcm: true, name: s.name, spieler: s.player, vorlage: s.assistPlayer,
                                       min: (min += 6 + Math.floor(Math.random() * 12)) }));
    oppScorers.forEach(s => evs.push({ fcm: false, name: s.name, min: (min += 6 + Math.floor(Math.random() * 12)) }));
    evs.sort((a, b) => a.min - b.min);
    evs.forEach(e => {
      const m = Math.min(90, e.min);
      G.goalLog.push({ min: m, team: e.fcm ? 'home' : 'away', momentumAtTime: G.momentum });
      // id und assistId mitschreiben, sonst kennt die Notenvergabe den
      // Torschützen dieses Spiels nicht.
      if (e.fcm) G.scorers.push({ min: m, name: e.name,
        id: (e.spieler && e.spieler.id != null) ? e.spieler.id : null,
        assistId: (e.vorlage && e.vorlage.id != null) ? e.vorlage.id : null });
      addEv('goal', e.fcm ? 0 : 1,
        `⚽ Tor für ${e.fcm ? clubShort() : oppName}! ${e.name} trifft (${m}').`);
    });
  }

  // Wählt plausible Torschützen aus der eigenen Startelf (offensive Positionen
  // bevorzugt) als SPIELEROBJEKTE, bzw. generische Namen für den Gegner.
  // Rückgabe: [{ player, name }] — player=null für Gegner/Eigentor.
  function pickScorers(side, n) {
    const out = [];
    if (side === 'home' && typeof getLineupIds === 'function' && typeof getPlayer === 'function') {
      const lineup = getLineupIds().map(getPlayer).filter(Boolean);
      const weighted = lineup.map(p => {
        const pos = (p.positions && p.positions[0]) || p.pos;
        const w = { ST: 5, MS: 5, HS: 5, FL: 3, LF: 3, RF: 3, LA: 3, RA: 3, OM: 3, ZOM: 3, AM: 2, LM: 2, RM: 2, ZM: 1 }[pos] || 0.3;   // LF/RF: DFL D95
        return { p, w };
      });
      for (let i = 0; i < n; i++) {
        if (!weighted.length) { out.push({ player: null, name: 'Eigentor' }); continue; }
        const total = weighted.reduce((a, b) => a + b.w, 0);
        let r = Math.random() * total, pick = weighted[0];
        for (const w of weighted) { r -= w.w; if (r <= 0) { pick = w; break; } }
        out.push({ player: pick.p, name: (pick.p.firstName ? pick.p.firstName + ' ' : '') + pick.p.name });
      }
    } else {
      const generic = ['Müller', 'Schmidt', 'Weber', 'Fischer', 'Wagner', 'Becker'];
      for (let i = 0; i < n; i++) out.push({ player: null, name: generic[Math.floor(Math.random() * generic.length)] });
    }
    return out;
  }

  window.simulateCurrentFixture = simulateCurrentFixture;

  // Simulieren-Button nur zeigen, wenn ein Spiel bereit/nicht gestartet ist —
  // an ensureFixtureLoaded und resetMatchState anhängen, um ihn zurückzusetzen.
  function refreshSimButtonVisibility() {
    const btn = document.getElementById('sim-btn');
    if (!btn) return;
    const canSim = typeof CURRENT_FIXTURE !== 'undefined' && CURRENT_FIXTURE &&
      typeof G !== 'undefined' && !(G.running || G.ended);
    btn.style.display = canSim ? '' : 'none';
    btn.disabled = false;
    btn.innerHTML = '<i class="ti ti-player-track-next" aria-hidden="true"></i> Spiel simulieren';
  }
  if (typeof window.goToFixture === 'function') {
    const _orig = window.goToFixture;
    window.goToFixture = function () { const r = _orig.apply(this, arguments); try { refreshSimButtonVisibility(); } catch (e) {} return r; };
    try { goToFixture = window.goToFixture; } catch (e) {}
  }
  if (typeof window.handleKO === 'function') {
    const _origKO = window.handleKO;
    window.handleKO = function () { const r = _origKO.apply(this, arguments); try { refreshSimButtonVisibility(); } catch (e) {} return r; };
    try { handleKO = window.handleKO; } catch (e) {}
  }

  console.log('[MatchSimulation] aktiv — "Spiel simulieren"-Button verfügbar');
})();