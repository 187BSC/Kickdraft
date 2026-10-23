/* ===== engine_v2_adapter.js =====
   ADAPTER: Ballbesitz-Ketten-Engine (v2) → bestehende Spiel-Pipeline
   ─────────────────────────────────────────────────────────────────────────────
   Hängt MatchEngineV2 an „Spiel simulieren" an, OHNE die alte Engine anzufassen.
   Alles Nachgelagerte (Abpfiff-Modal, Tabelle, Noten, Sperren, Prämien, Statistik)
   funktioniert weiter, weil der Adapter dieselben Strukturen befüllt:
     G.homeGoals/awayGoals (FCM ist IMMER homeGoals — Engine-Konvention des Spiels),
     G.shots/corners/fouls/poss/passAcc, G.cards, G.goalLog, G.scorers,
     addPlayerGoal/addPlayerAssist, addEv(...) und zum Schluss processFixtureResult().

   Umschalter: CLUB.settings.engineV2 (Standard AUS) — Knopf im Verwaltungs-Menü.
   Lädt NACH match_engine_v2.js, match_simulation_patch.js und cohesion_patch.js.
   ============================================================================= */
(function () {
  'use strict';

  function on() { try { return !!(CLUB.settings && CLUB.settings.engineV2); } catch (e) { return false; } }
  function settings() { if (!CLUB.settings) CLUB.settings = {}; return CLUB.settings; }

  function refreshBtn() {
    const b = document.getElementById('mgmt-engine-btn');
    if (b) b.innerHTML = '<i class="ti ti-cpu" aria-hidden="true"></i> Match-Engine: ' + (on() ? 'neu (v2)' : 'klassisch');
  }
  window.toggleEngineV2 = function () {
    const s = settings(); s.engineV2 = !s.engineV2;
    refreshBtn();
    if (typeof showToast === 'function') {
      showToast(on() ? 'Neue Ketten-Engine aktiv — Taktik und Eingespieltheit wirken jetzt direkt.'
                     : 'Zurück auf die klassische Engine.', 'info');
    }
    try { if (typeof saveGameState === 'function') saveGameState(); } catch (e) {}
  };

  // ── Liga-Profil aus der aktuellen Spielklasse ──────────────────────────────
  function levelKey() {
    try { return (findFcmGroup(LEAGUE) || {}).tierKey || 'bundesliga2'; } catch (e) { return 'bundesliga2'; }
  }

  // ── Eigenes Team aus der echten Startelf bauen ─────────────────────────────
  // Engine-Koordinaten: px 0..100 längs (0 = eigenes Tor), py 0..100 quer.
  // Formations-Slots liefern x (quer) und y (0 = Angriff, 100 = eigenes Tor).
  function buildOwnTeam() {
    const slots = (typeof FORMATIONS !== 'undefined' && FORMATIONS[CLUB.formation]) || [];
    const players = [];
    slots.forEach(s => {
      const pid = CLUB.lineup && CLUB.lineup[s.id];
      const p = pid ? getPlayer(pid) : null;
      if (!p) return;
      players.push({
        name: p.name, num: p.number || 0,
        pos: (window.TacticsSystem && TacticsSystem.slotToPos) ? TacticsSystem.slotToPos(s) : (s.label || p.pos),
        px: Math.max(2, Math.min(98, 100 - (s.y != null ? s.y : 50))),
        py: Math.max(2, Math.min(98, s.x != null ? s.x : 50)),
        ovr: p.ovr || 60, att: p.att || 55, mid: p.mid || 55, def: p.def || 55,
        pace: p.pace || 55, technik: (p.technik != null ? p.technik : p.mid) || 55,
        _ref: p                                  // Rückverweis auf den echten Spieler
      });
    });
    let coh = 0.5;
    try { const c = window.computeCohesion && window.computeCohesion(); if (c) coh = c.value; } catch (e) {}
    return { name: (typeof clubName === 'function' ? clubName() : 'FCM'), players,
             tactics6: CLUB.tactics6 || {}, cohesion: coh, press: 0.5 };
  }

  // ── Gegner synthetisieren (das Spiel führt Gegner nur abstrakt) ────────────
  // Gegner-Aufstellung MUSS aus derselben Quelle kommen wie die eigene, sonst
  // spielt man gegen eine anders geformte Mannschaft. Vorher stand hier eine
  // eigene Koordinatentabelle mit px 6…68, während die eigene Elf über
  // `100 - s.y` auf 10…84 kam. Nach der Spiegelung standen die eigenen Stürmer
  // 17 m vor dem gegnerischen Tor, die gegnerischen aber 34 m vor unserem —
  // ein struktureller Vorteil, der jede Bewertung der Spielstärke aushebelte
  // (gemessen: 2,4:0,3 gegen einen GLEICH starken Gegner, 99:12 über die Saison).
  function oppSlots(base) {
    // Etwas Abwechslung nach Spielstärke, aber immer aus FORMATIONS.
    const wahl = base >= 74 ? '4-3-3' : base >= 62 ? '4-2-3-1' : '4-4-2';
    const F = (typeof FORMATIONS !== 'undefined') ? FORMATIONS : null;
    return (F && (F[wahl] || F['4-4-2'])) || null;
  }
  // Deterministische Saat aus dem Vereinsnamen — derselbe Gegner spielt nicht
  // jede Woche mit anderen Spielertypen.
  function saatVon(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0) || 1;
  }
  function buildOppTeam() {
    const t = (typeof TEAMS !== 'undefined' && TEAMS.away) ? TEAMS.away : { name: 'Gegner', str: 65, attack: 65, defense: 65 };
    const base = t.str || 65, att = t.attack || base, def = t.defense || base;
    const slots = oppSlots(base);
    const saat = saatVon(String(t.name || 'Gegner'));
    const players = (slots || []).slice(0, 11).map((s, i) => {
      const pos = (window.TacticsSystem && TacticsSystem.slotToPos) ? TacticsSystem.slotToPos(s) : (s.label || 'ZM');
      const isAtt = pos === 'ST' || pos === 'FL' || pos === 'OM';
      const isDef = pos === 'IV' || pos === 'AV' || pos === 'TW';
      // ±2 um die Teamstärke, aber stabil je Gegner. `>>>` statt `>>`: mit dem
      // vorzeichenbehafteten Shift wurde der Rest negativ und die ganze Elf lag
      // im Schnitt 4 Punkte unter ihrer eigentlichen Stärke.
      const v = base + ((((saat >>> (i * 2)) % 5) + 5) % 5) - 2;
      // Bereichs- und Grundwerte MIT DERSELBEN Spezialisierung wie echte Spieler.
      // Vorher standen hier pauschale Aufschläge (att+4 / def+4 / überall ≈ v).
      // Dadurch war der Gegner bei gleichem OVR ÜBERALL gleich gut, während eine
      // echte Elf spezialisiert ist (Stürmer viel att, wenig def). Gemessen lag
      // er so 5 bis 9 Punkte über der eigenen Mannschaft in att, mid, def und
      // Technik — bei identischer Zahl im Tabellenkopf.
      // Nebenpositionen wie bei echten Spielern: `generateAreaRatings` gibt nur
      // für die abgedeckten Bereiche den vollen Wert, sonst −18. Mit nur EINER
      // Position lag der Gegner dadurch 6 Punkte unter einer echten Elf.
      let posListe = [pos];
      try { if (typeof generatePositions === 'function') posListe = generatePositions(pos) || [pos]; } catch (e) {}
      let ar = null, pm = null;
      try { if (typeof generateAreaRatings === 'function') ar = generateAreaRatings(posListe, v); } catch (e) {}
      try { if (typeof genAttributes === 'function') pm = genAttributes(pos, v); } catch (e) {}
      if (!ar) {
        ar = { def: isDef ? v : v - 18, att: isAtt ? v : v - 18,
               mid: (pos === 'ZM' || pos === 'ZDM' || pos === 'AM' || pos === 'OM') ? v : v - 18 };
      }
      const oPos = ar.att, dPos = ar.def, mPos = ar.mid;
      const paceV = pm ? pm.pace : v;
      const mentalV = pm ? pm.mental : v;
      const tecV = (mPos + oPos) / 2;
      // Der Gegner bekommt einen eigenen Datensatz mit id und seed. Damit läuft
      // er in der Engine durch DIESELBE Wertelogik (spielerWerte, 17 Feinwerte)
      // wie die eigene Elf — vorher fiel er auf den gröberen Ersatzsatz zurück.
      const ref = {
        id: 'opp_' + i, name: (t.shortTag || 'G') + '-' + (i + 1),
        seed: (saat + i * 7919) % 100000, age: 26,
        pos: pos, positions: posListe,
        ovr: Math.round(v), def: Math.round(dPos), mid: Math.round(mPos),
        att: Math.round(oPos), pace: Math.round(paceV), mental: Math.round(mentalV)
      };
      return { name: ref.name, num: i + 1, pos: pos,
               px: Math.max(2, Math.min(98, 100 - (s.y != null ? s.y : 50))),
               py: Math.max(2, Math.min(98, s.x != null ? s.x : 50)),
               ovr: v, att: oPos, mid: mPos, def: dPos, pace: paceV, technik: tecV,
               _ref: ref };
    });
    // Gegner-Eingespieltheit: an die Teamstärke gekoppelt statt pauschal hoch.
    // WICHTIG: Ein fester Wert (z.B. 0,62) benachteiligt den Spieler systematisch,
    // weil ein frischer Kader bei ~0,35 startet. Bandbreite bewusst moderat.
    const rel = Math.max(-1, Math.min(1, (base - 62) / 22));      // schwach … stark
    const coh = Math.max(0.38, Math.min(0.62, 0.46 + rel * 0.12));
    return { name: t.name, players, tactics6: {}, cohesion: coh, press: 0.5 };
  }

  // ── Karten einem plausiblen eigenen Spieler zuordnen (für Sperren) ─────────
  function pickCardPlayer() {
    const ids = (typeof getLineupIds === 'function') ? getLineupIds() : [];
    const ps = ids.map(getPlayer).filter(Boolean);
    if (!ps.length) return null;
    // Verteidiger und Sechser foulen häufiger
    const w = ps.map(p => {
      const pos = (p.positions && p.positions[0]) || p.pos;
      return { p, w: ['IV', 'AV', 'ZDM', 'ZM'].includes(pos) ? 3 : 1 };
    });
    let tot = w.reduce((a, b) => a + b.w, 0), r = Math.random() * tot;
    for (const x of w) { r -= x.w; if (r <= 0) return x.p; }
    return ps[0];
  }

  // ── Hauptlauf ──────────────────────────────────────────────────────────────
  function runV2() {
    // Sicherheitsnetz: vollständige Elf erzwingen (der Aufstellungs-Schutz hängt an
    // simulateCurrentFixture und würde sonst übersprungen, wenn v2 vorher abbricht).
    try { if (typeof window.autoFillLineup === 'function') window.autoFillLineup(); } catch (e) {}
    const H = buildOwnTeam(), A = buildOppTeam();
    if (H.players.length < 7) return false;               // zu wenig Aufstellung → alte Engine
    const homeAdv = (typeof FCM_IS_HOME !== 'undefined' && FCM_IS_HOME) ? 'H' : 'A';
    const res = MatchEngineV2.simulateMatch(H, A, { level: levelKey(), homeAdv });
    const sh = res.stats.home, sa = res.stats.away;
    const season = (typeof LEAGUE !== 'undefined' && LEAGUE) ? LEAGUE.season : 1;
    const friendly = (typeof CURRENT_FIXTURE !== 'undefined' && CURRENT_FIXTURE && CURRENT_FIXTURE.type === 'friendly');

    // Ergebnis + Statistik in G spiegeln (FCM = home, Spielkonvention)
    G.homeGoals = sh.goals; G.awayGoals = sa.goals;
    G.min = 90; G.running = false; G.halfDone = true; G.ended = true;
    G.shots = [sh.shots, sa.shots];
    G.corners = [sh.corners, sa.corners];
    G.fouls = [sh.fouls, sa.fouls];
    G.poss = [sh.possPct, sa.possPct];
    G.passAcc = [Math.round(sh.passAcc / Math.max(1, sh.passes) * 100),
                 Math.round(sa.passAcc / Math.max(1, sa.passes) * 100)];
    G.goalLog = G.goalLog || []; G.scorers = G.scorers || []; G.cards = G.cards || [];

    // Ereignisse übernehmen: Tore/Vorlagen gutschreiben + Feed füllen
    res.events.forEach(ev => {
      const min = Math.max(1, Math.min(90, Math.round(ev.t / 60)));   // auch als Minute der Tickerzeile (addEv, D77)
      const own = ev.side === 'home';
      if (ev.type === 'goal') {
        G.goalLog.push({ min, team: own ? 'home' : 'away', momentumAtTime: G.momentum });
        if (own) {
          const real = ev.player && ev.player._ref;
          const nm = real ? ((real.firstName ? real.firstName + ' ' : '') + real.name) : (ev.player ? ev.player.name : 'Unbekannt');
          // Vorlage VOR dem Protokolleintrag ermitteln — sonst greift der Zugriff
          // auf `as` in die temporale Todeszone der const-Deklaration.
          const as = ev.assist && ev.assist._ref;
          G.scorers.push({ min, name: nm, id: (real && real.id != null) ? real.id : null,
                           assistId: (as && as.id != null && as !== real) ? as.id : null });
          if (!friendly && real && typeof addPlayerGoal === 'function') addPlayerGoal(real, season);
          if (!friendly && as && as !== real && typeof addPlayerAssist === 'function') addPlayerAssist(as, season);
          addEv('goal', 0, `⚽ TOR für ${clubShort()}! ${nm} trifft${ev.setPiece ? ' nach Ecke' : ''}.`, null, min);
        } else {
          addEv('goal', 1, `⚽ Tor für ${TEAMS.away.name}.`, null, min);
        }
      } else if (ev.type === 'save' && ev.xg >= 0.10) {
        addEv('save', own ? 1 : 0, own
          ? `Große Chance für ${clubShort()} — der Torhüter pariert!`
          : `${clubShort()} klärt in höchster Not.`, null, min);
      } else if (ev.type === 'miss' && ev.xg >= 0.14 && own) {
        addEv('chance', 0, `Riesenchance vergeben! ${ev.player ? ev.player.name : ''} zielt zu ungenau.`, null, min);
      } else if (ev.type === 'corner' && own) {
        addEv('corner', 0, `Ecke für ${clubShort()}.`, null, min);
      } else if (ev.type === 'yellow' || ev.type === 'red') {
        if (own) {
          const p = pickCardPlayer();
          const nm = p ? ((p.firstName ? p.firstName + ' ' : '') + p.name) : 'Ein Spieler';
          G.cards.push({ type: ev.type, player: nm, playerId: p ? p.id : null, team: 'home', min });
          if (!friendly && p) {
            if (ev.type === 'yellow' && typeof addPlayerYellow === 'function') addPlayerYellow(p, season);
            if (ev.type === 'red' && typeof addPlayerRed === 'function') addPlayerRed(p, season);
          }
          addEv(ev.type, 0, `${nm} sieht ${ev.type === 'yellow' ? 'Gelb' : 'ROT'}.`, null, min);
        } else {
          G.cards.push({ type: ev.type, player: TEAMS.away.shortTag || 'Gegner', playerId: null, team: 'away', min });
          addEv(ev.type, 1, `${TEAMS.away.name}: ${ev.type === 'yellow' ? 'Gelbe' : 'Rote'} Karte.`, null, min);
        }
      }
    });

    addEv('info', -1, `Abpfiff (neue Engine): ${G.homeGoals}:${G.awayGoals} · Ballbesitz ${sh.possPct}% · ` +
      `Schüsse ${sh.shots}:${sa.shots} · xG ${sh.xg.toFixed(2)}:${sa.xg.toFixed(2)}`);

    const tb = document.getElementById('time-badge');
    if (tb) { tb.textContent = 'FT'; tb.className = 'time-badge ft'; }

    if (typeof processFixtureResult === 'function') processFixtureResult();
    if (typeof updateUI === 'function') updateUI();
    if (typeof setupPostMatchButton === 'function') setupPostMatchButton();
    const sb = document.getElementById('sim-btn'); if (sb) sb.style.display = 'none';
    if (window.PostMatchModal && typeof window.PostMatchModal.show === 'function') {
      try { window.PostMatchModal.show(); } catch (e) {}
    }
    return true;
  }

  // ── An „Spiel simulieren" hängen ───────────────────────────────────────────
  // WICHTIG: NICHT runQuickSimulation wrappen! simulateCurrentFixture ruft die
  // LOKALE Funktion aus seiner eigenen IIFE auf — ein Wrapper auf window.* würde
  // nie greifen (Closure-Falle). Deshalb hier simulateCurrentFixture selbst.
  if (typeof window.simulateCurrentFixture === 'function') {
    const _orig = window.simulateCurrentFixture;
    window.simulateCurrentFixture = function () {
      if (on() && window.MatchEngineV2) {
        if (typeof CURRENT_FIXTURE === 'undefined' || !CURRENT_FIXTURE) {
          if (typeof ensureFixtureLoaded === 'function') ensureFixtureLoaded();
        }
        if (typeof CURRENT_FIXTURE === 'undefined' || !CURRENT_FIXTURE) { alert('Kein Spiel geladen.'); return; }
        if (typeof G !== 'undefined' && (G.running || G.ended)) return;
        try { if (runV2()) return; } catch (e) { console.warn('[EngineV2] Fehler, falle auf klassische Engine zurück', e); }
      }
      return _orig.apply(this, arguments);
    };
    try { simulateCurrentFixture = window.simulateCurrentFixture; } catch (e) {}
  }

  window.EngineV2Adapter = { runV2, buildOwnTeam, buildOppTeam, levelKey };
  try { refreshBtn(); } catch (e) {}
  console.log('[EngineV2Adapter] aktiv — Umschalter im Verwaltungs-Menü');
})();