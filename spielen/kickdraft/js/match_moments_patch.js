/* ===== match_moments_patch.js =====
   HALBZEIT-ANSPRACHE + SCHLÜSSELMOMENT-GOVERNANCE
   ─────────────────────────────────────────────────────────────────────────────
   Baut auf dem vorhandenen In-Match-Entscheidungssystem (triggerDecision) auf:

   1. HALBZEIT-ANSPRACHE — in der Pause eines LIVE gespielten Spiels. Vier
      situative Optionen (ruhig/anpeitschen/umstellen/laufen lassen) mit Wirkung
      auf Momentum, Teamstärke, Risiko und Moral. „Anpeitschen" kann bei mieser
      Moral nach hinten losgehen — der Kniff, damit man nicht immer dasselbe klickt.

   2. GOVERNANCE — damit die Schlüsselmomente nicht nerven:
      · abschaltbar (Verwaltungs-Menü / toggleMatchMoments), Default AN
      · max. 3 „weiche" Momente pro Spiel, mind. 15 Minuten Abstand
      (Rote Karte / Ausgleich bleiben immer, das sind echte Großereignisse.)

   Lädt NACH app_main.js (wrappt triggerDecision, triggerHalftime, resetMatchState).
   ============================================================================= */
(function () {
  'use strict';

  const CFG = { softTypes: ['pressure', 'pressure_goal'], maxPerMatch: 3, minGapMin: 15 };

  function settings() { if (typeof CLUB !== 'undefined' && CLUB) { if (!CLUB.settings) CLUB.settings = {}; return CLUB.settings; } return {}; }
  function momentsEnabled() { return settings().matchMoments !== false; }

  // ── Aus-Schalter im Verwaltungs-Menü ───────────────────────────────────────
  function refreshMomentsBtn() {
    const b = document.getElementById('mgmt-moments-btn');
    if (b) b.innerHTML = '<i class="ti ti-ball-football" aria-hidden="true"></i> Spielmomente: ' + (momentsEnabled() ? 'an' : 'aus');
  }
  window.toggleMatchMoments = function () {
    const s = settings(); s.matchMoments = (s.matchMoments === false);   // false→an, sonst aus
    refreshMomentsBtn();
    if (typeof showToast === 'function') showToast('Spielmomente ' + (momentsEnabled() ? 'aktiviert' : 'deaktiviert') + '.', 'info');
    try { if (typeof saveGameState === 'function') saveGameState(); } catch (e) {}
  };

  // ── GOVERNANCE: triggerDecision wrappen ─────────────────────────────────────
  if (typeof window.triggerDecision === 'function') {
    const _td = window.triggerDecision;
    window.triggerDecision = function (type, team, player) {
      if (!momentsEnabled()) return;   // Passiv-Modus: keine Dialoge, Match läuft weiter
      const soft = CFG.softTypes.indexOf(type) !== -1;
      if (soft && typeof G !== 'undefined' && G) {
        if ((G._momentCount || 0) >= CFG.maxPerMatch) return;
        if (typeof G._lastMomentMin === 'number' && (G.min - G._lastMomentMin) < CFG.minGapMin) return;
      }
      const r = _td.apply(this, arguments);
      if (soft && typeof G !== 'undefined' && G) { G._momentCount = (G._momentCount || 0) + 1; G._lastMomentMin = G.min; }
      return r;
    };
    try { triggerDecision = window.triggerDecision; } catch (e) {}
  }

  // ── HALBZEIT-ANSPRACHE ──────────────────────────────────────────────────────
  function lineupPlayers() {
    try { return getLineupIds().map(getPlayer).filter(Boolean); } catch (e) { return []; }
  }
  function avgMorale() {
    try { if (typeof teamMorale === 'function') return teamMorale(); } catch (e) {}
    const l = lineupPlayers(); if (!l.length) return 70;
    return Math.round(l.reduce((a, p) => a + (typeof p.morale === 'number' ? p.morale : 70), 0) / l.length);
  }
  function addMorale(delta) { try { if (window.MoraleSystem) window.MoraleSystem.addMorale(lineupPlayers(), delta); } catch (e) {} }
  function chips(arr) { return arr.map(c => `<span class="ev-chip">${c}</span>`).join(' '); }

  function showHalftimeAddress() {
    if (typeof G === 'undefined' || !G || G._htAddressDone) return;
    if (document.querySelector('.ht-dialog')) return;     // nicht doppelt zeigen
    G._htAddressDone = true;
    const diff = G.homeGoals - G.awayGoals;        // FCM = homeGoals (Engine-Konvention)
    const mor = avgMorale();
    const lead = diff > 0, behind = diff < 0;
    const situation = behind ? `Ihr lauft einem ${G.homeGoals}:${G.awayGoals} hinterher.`
      : lead ? `Ihr führt ${G.homeGoals}:${G.awayGoals} — jetzt clever bleiben.`
        : `Es steht ${G.homeGoals}:${G.awayGoals} — die Partie ist offen.`;
    const moodTxt = mor >= 62 ? 'Die Mannschaft ist griffig.' : mor >= 48 ? 'Die Köpfe sind noch dabei.' : 'Die Köpfe hängen etwas.';

    const btn = document.getElementById('ko-btn');
    if (btn) btn.disabled = true;

    const opts = [
      {
        label: 'Ruhig bleiben — Fokus halten',
        chips: chips(['<i class="ti ti-mood-happy"></i> Moral ↑', '<i class="ti ti-shield"></i> stabile Ordnung']),
        run: () => { G.momentum = Math.min(90, G.momentum + 5); addMorale(2); addEv('info', -1, clubShort() + ' bleibt in der Kabine ruhig und konzentriert.'); }
      },
      {
        label: 'Anpeitschen',
        chips: chips(['<i class="ti ti-flame"></i> Schub 2. HZ ↑', '<i class="ti ti-cards"></i> mehr Härte (Kartenrisiko)', '<i class="ti ti-mood-sad"></i> riskant bei mieser Moral']),
        run: () => {
          if (mor >= 55) { G.momentum = Math.min(93, G.momentum + 11); addMorale(2); }
          else { G.momentum = Math.max(8, G.momentum - 6); addMorale(-2); addEv('info', -1, 'Die harte Ansprache verunsichert die angeschlagene Truppe eher.'); }
          G.riskLevel = Math.max((G.riskLevel || 0), 1);
          addEv('info', -1, clubShort() + ' wird lautstark eingeschworen — volle Attacke in Halbzeit zwei!');
        }
      },
      {
        label: 'Offensiv umstellen',
        chips: chips(['<i class="ti ti-arrow-up-right"></i> Offensive ↑', '<i class="ti ti-alert-triangle"></i> Abwehr anfälliger']),
        run: () => { try { TEAMS.home.attack += 5; TEAMS.home.defense = Math.max(30, TEAMS.home.defense - 4); } catch (e) {} G.momentum = Math.min(90, G.momentum + 8); G.riskLevel = Math.max((G.riskLevel || 0), 1); addEv('info', -1, clubShort() + ' stellt offensiver um — mehr Zug zum Tor, dafür hinten offener.'); }
      },
      {
        label: 'Laufen lassen',
        chips: chips(['<i class="ti ti-minus"></i> kein Eingriff']),
        run: () => { addEv('info', -1, clubShort() + ' lässt in Halbzeit zwei unverändert weiterspielen.'); }
      }
    ];

    const ov = document.createElement('div');
    ov.className = 'exp-overlay';
    ov.innerHTML = `<div class="exp-dialog ht-dialog">
      <div class="ht-head"><div><div class="ht-kicker"><i class="ti ti-microphone"></i> Kabine · Halbzeit</div>
        <div class="ht-title">Deine Ansprache</div></div>
        <div class="ht-score">${G.homeGoals}:${G.awayGoals}</div></div>
      <div class="ht-sub">${situation} ${moodTxt}</div>
      <div class="ht-opts">${opts.map((o, i) => `<button class="ht-opt" data-i="${i}">
        <div class="ht-opt-label">${o.label}</div>
        <div class="ev-outcome"><span class="ev-outcome-lbl">Mögliche Folgen:</span> ${o.chips}</div>
      </button>`).join('')}</div>
    </div>`;
    document.body.appendChild(ov);
    ov.querySelectorAll('.ht-opt').forEach(b => b.addEventListener('click', () => {
      const i = +b.getAttribute('data-i');
      try { opts[i].run(); } catch (e) { console.warn('[Moments] ht', e); }
      G.decisions = G.decisions || []; G.decisions.push({ min: 45, type: 'halftime_' + i });
      ov.remove();
      const kb = document.getElementById('ko-btn'); if (kb) kb.disabled = false;
      try { if (typeof updateUI === 'function') updateUI(); } catch (e) {}
    }));
  }
  window.showHalftimeAddress = showHalftimeAddress;

  if (typeof window.triggerHalftime === 'function') {
    const _th = window.triggerHalftime;
    window.triggerHalftime = function () {
      const r = _th.apply(this, arguments);
      try { if (momentsEnabled()) showHalftimeAddress(); } catch (e) { console.warn('[Moments] halftime', e); }
      return r;
    };
    try { triggerHalftime = window.triggerHalftime; } catch (e) {}
  }

  // ── Pro-Match-Zustand zurücksetzen ─────────────────────────────────────────
  if (typeof window.resetMatchState === 'function') {
    const _rms = window.resetMatchState;
    window.resetMatchState = function () {
      const r = _rms.apply(this, arguments);
      try { if (typeof G !== 'undefined' && G) { G._momentCount = 0; G._lastMomentMin = undefined; G._htAddressDone = false; } } catch (e) {}
      return r;
    };
    try { resetMatchState = window.resetMatchState; } catch (e) {}
  }

  try { refreshMomentsBtn(); } catch (e) {}
  console.log('[MatchMoments] aktiv — Halbzeit-Ansprache + Schlüsselmoment-Governance');
})();
