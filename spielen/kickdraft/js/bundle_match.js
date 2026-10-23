/* ===== BUNDLE: bundles/bundle_match.js ===== */
/* Enthält (in dieser Reihenfolge): postmatch_modal_patch.js player_ratings_patch.js player_development_patch.js price_balance_patch.js real_market_and_career_patch.js away_scorers_patch.js ingame_tactics_patch.js postmatch_summary_patch.js */

/* ---------- js/postmatch_modal_patch.js ---------- */
/* ===== postmatch_modal_patch.js ===== */
/* ═══════════════════════════════════════════════════════════════════════════
   POST-MATCH-ZUSAMMENFASSUNG  ·  Modal nach Spielende
   ─────────────────────────────────────────────────────────────────────────
   Laden NACH app_main.js, training_patches.js, running_costs_patches.js.

   Was es tut:
   - Patcht triggerFulltime → zeigt nach dem Abpfiff automatisch ein Modal
   - Modal zeigt: Ergebnis, Tore (Torschützen), Statistiken, neue Verletzungen
     und aktuelle Sperren — alles was man für die nächste Woche braucht
   - „Nächste Woche → Vereinshub"-Button schließt das Modal UND ruft
     postMatchContinue() auf (genau wie der bisherige Button unter dem Spielfeld)
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {

  // ── CSS ─────────────────────────────────────────────────────────────────
  const STYLE = `
  /* ── Overlay ─────────────────────────────────────────────────────────── */
  #pm-overlay {
    position: fixed; inset: 0; z-index: 9000;
    background: rgba(0,0,0,.72);
    display: flex; align-items: center; justify-content: center;
    animation: pm-fadein .2s ease;
  }
  @keyframes pm-fadein { from { opacity:0 } to { opacity:1 } }

  /* ── Dialog ──────────────────────────────────────────────────────────── */
  #pm-dialog {
    background: var(--bg2, #161b22);
    border: 1px solid var(--border, #30363d);
    border-radius: 14px;
    width: min(520px, 95vw);
    max-height: 88vh;
    overflow-y: auto;
    padding: 0 0 20px 0;
    box-shadow: 0 8px 40px rgba(0,0,0,.6);
    font-family: inherit;
  }

  /* ── Scoreboard-Header ────────────────────────────────────────────────── */
  #pm-header {
    border-radius: 14px 14px 0 0;
    padding: 22px 24px 18px;
    text-align: center;
  }
  #pm-header.win  { background: linear-gradient(135deg, #0d3320 0%, #1a4d30 100%); }
  #pm-header.draw { background: linear-gradient(135deg, #2a2a0d 0%, #3d3a1a 100%); }
  #pm-header.loss { background: linear-gradient(135deg, #3d0d0d 0%, #4d1a1a 100%); }

  #pm-result-emoji { font-size: 32px; line-height: 1; margin-bottom: 4px; }
  #pm-result-label {
    font-size: 11px; font-weight: 700; letter-spacing: .12em;
    text-transform: uppercase; opacity: .7; color: var(--text2, #8b949e);
    margin-bottom: 6px;
  }
  #pm-score {
    font-size: 48px; font-weight: 800; line-height: 1;
    color: var(--text, #e6edf3); margin-bottom: 6px;
  }
  #pm-teams {
    font-size: 13px; color: var(--text2, #8b949e);
  }
  #pm-match-type {
    display: inline-block; margin-top: 8px;
    background: rgba(255,255,255,.08); border-radius: 20px;
    font-size: 11px; padding: 2px 10px; color: var(--text2, #8b949e);
  }

  /* ── Inhalt ──────────────────────────────────────────────────────────── */
  #pm-body { padding: 0 20px; }

  .pm-section {
    margin-top: 18px;
  }
  .pm-section-title {
    font-size: 11px; font-weight: 700; letter-spacing: .1em;
    text-transform: uppercase; color: var(--text3, #6e7681);
    margin-bottom: 8px; padding-bottom: 5px;
    border-bottom: 1px solid var(--border, #30363d);
  }

  /* Statistik-Raster */
  .pm-stats-grid {
    display: grid; grid-template-columns: 1fr 1fr 1fr;
    gap: 8px;
  }
  .pm-stat {
    background: var(--bg3, #0d1117);
    border: 1px solid var(--border, #30363d);
    border-radius: 8px; padding: 8px 6px; text-align: center;
  }
  .pm-stat-val { font-size: 18px; font-weight: 700; color: var(--text, #e6edf3); }
  .pm-stat-lbl { font-size: 10px; color: var(--text3, #6e7681); margin-top: 2px; }

  /* Torschützen */
  .pm-goals-list { display: flex; flex-direction: column; gap: 5px; }
  .pm-goal-row {
    display: flex; align-items: center; gap: 8px;
    font-size: 12px; color: var(--text, #e6edf3);
    background: var(--bg3, #0d1117);
    border-radius: 6px; padding: 5px 10px;
  }
  .pm-goal-min { color: var(--text3, #6e7681); min-width: 30px; font-size: 11px; }
  .pm-goal-name { flex: 1; font-weight: 600; }
  .pm-goal-type { font-size: 10px; color: var(--text3, #6e7681); }
  .pm-goal-gegner { opacity: .72; }
  .pm-goal-gegner .pm-goal-name i { color: var(--text3, #6e7681); }
  .pm-mvp { margin-bottom: 6px; border: 2px solid var(--k-gold, #d4a72c); border-radius: 10px; padding: 4px 8px; }

  /* Verletzt / Gesperrt */
  .pm-alert-list { display: flex; flex-direction: column; gap: 6px; }
  .pm-alert-row {
    display: flex; align-items: flex-start; gap: 10px;
    border-radius: 8px; padding: 8px 12px;
    font-size: 12px;
  }
  .pm-alert-row.injured  { background: rgba(248,81,73,.1);  border: 1px solid rgba(248,81,73,.3); }
  .pm-alert-row.suspended { background: rgba(210,153,34,.1); border: 1px solid rgba(210,153,34,.3); }
  .pm-alert-row.yellow-warn { background: rgba(210,153,34,.07); border: 1px solid rgba(210,153,34,.2); }
  .pm-alert-icon { font-size: 16px; flex-shrink: 0; margin-top: 1px; }
  .pm-alert-name { font-weight: 700; color: var(--text, #e6edf3); }
  .pm-alert-detail { color: var(--text2, #8b949e); font-size: 11px; margin-top: 2px; }

  /* Karten-Zeile */
  .pm-cards-row {
    display: flex; gap: 8px; flex-wrap: wrap;
  }
  .pm-card-chip {
    display: inline-flex; align-items: center; gap: 5px;
    border-radius: 6px; padding: 4px 9px;
    font-size: 11px; font-weight: 600;
    background: var(--bg3, #0d1117);
    border: 1px solid var(--border, #30363d);
    color: var(--text2, #8b949e);
  }
  .pm-card-chip.yellow { border-color: rgba(210,153,34,.5); color: #d29922; }
  .pm-card-chip.red    { border-color: rgba(248,81,73,.5);  color: #f85149; }

  /* Nichts-melden-Placeholder */
  .pm-empty {
    text-align: center; color: var(--text3, #6e7681);
    font-size: 12px; padding: 10px 0;
  }

  /* ── Footer-Button ───────────────────────────────────────────────────── */
  #pm-footer { padding: 18px 20px 0; }
  #pm-continue-btn {
    width: 100%; padding: 13px;
    background: var(--accent, #238636);
    color: #fff; border: none; border-radius: 8px;
    font-size: 14px; font-weight: 700; cursor: pointer;
    transition: filter .15s;
  }
  #pm-continue-btn:hover { filter: brightness(1.12); }
  `;

  // CSS einmalig injizieren
  if (!document.getElementById('pm-style')) {
    const s = document.createElement('style');
    s.id = 'pm-style'; s.textContent = STYLE;
    document.head.appendChild(s);
  }

  // ── Hilfsfunktionen ──────────────────────────────────────────────────────
  function fmt(v) { return typeof formatEuro === 'function' ? formatEuro(v) : v + '€'; }
  function dname(p) { return typeof displayName === 'function' ? displayName(p) : ((p.firstName||'') + ' ' + p.name).trim(); }

  // Alle verletzten + gesperrten Kader-Spieler
  function getUnavailable() {
    if (typeof SQUAD === 'undefined') return { injured: [], suspended: [] };
    const injured   = SQUAD.filter(p => typeof isInjured    === 'function' && isInjured(p));
    const suspended = SQUAD.filter(p => typeof isSuspended  === 'function' && isSuspended(p));
    return { injured, suspended };
  }

  // Spieler mit 4+ gelben (Sperre droht)
  function getYellowWarnings() {
    if (typeof SQUAD === 'undefined') return [];
    return SQUAD.filter(p => !isSuspended(p) && (p.yellowAccum || 0) >= 4);
  }

  // Sammelt Karteninfos aus G.cards (nur eigene Mannschaft)
  // Prüfung Spielbericht 2026-10-10: Gelb-Rot steht als eigener Eintrag (engine_v3_adapter.js) – die zweite Gelbe desselben
  // Spielers fällt im Bericht weg; Platzverweise des Gegners kommen dazu
  function getCardsThisMatch() {
    const cards = (typeof G !== 'undefined' && G.cards) ? G.cards : [];
    const own    = cards.filter(c => c.team === 'home');
    const gelbrot = own.filter(c => c.type === 'gelbrot');
    const zweite = new Set();
    gelbrot.forEach(gr => {
      const y = own.filter(c => c.type === 'yellow' && c.player === gr.player && c.min <= gr.min).pop();
      if (y) zweite.add(y);
    });
    const yellow = own.filter(c => c.type === 'yellow' && !zweite.has(c));
    const red    = own.filter(c => c.type === 'red' || c.type === 'gelbrot');
    const gegner = cards.filter(c => c.team === 'away' && (c.type === 'red' || c.type === 'gelbrot'));
    return { yellow, red, gegner };
  }

  // ── Modal bauen & zeigen ──────────────────────────────────────────────────
  function showPostMatchModal() {
    // Doppel-Modal verhindern
    if (document.getElementById('pm-overlay')) return;

    const score  = typeof G !== 'undefined' ? `${G.homeGoals}:${G.awayGoals}` : '?:?';
    const hG     = typeof G !== 'undefined' ? G.homeGoals : 0;
    const aG     = typeof G !== 'undefined' ? G.awayGoals : 0;
    const won    = hG > aG, drew = hG === aG;
    const resultClass = won ? 'win' : drew ? 'draw' : 'loss';
    const resultEmoji = won ? '<i class="ti ti-trophy" style="color:#f2c14e"></i>' : drew ? '<i class="ti ti-equal" style="color:#8ea2b8"></i>' : '<i class="ti ti-mood-sad" style="color:#e24b4a"></i>';
    const resultLabel = won ? 'Sieg' : drew ? 'Unentschieden' : 'Niederlage';

    const homeTeam = typeof clubName === 'function' ? clubName() : (typeof CLUB !== 'undefined' ? CLUB.name : '?');
    const awayTeam = typeof TEAMS !== 'undefined' ? TEAMS.away.name : '?';

    // Match-Typ
    let matchTypeLabel = '';
    // Engine v3 leert CURRENT_FIXTURE vor dem Bericht (processFixtureResult) – dann gilt der gemerkte Stand
    const fxBericht = (typeof CURRENT_FIXTURE !== 'undefined' && CURRENT_FIXTURE) || window.LAST_FIXTURE || null;
    if (fxBericht) {
      if (fxBericht.type === 'liga')     matchTypeLabel = '<i class="ti ti-building"></i> Ligaspiel';
      else if (fxBericht.type === 'cup') matchTypeLabel = '<i class="ti ti-trophy"></i> Pokal';
      else if (fxBericht.type === 'friendly') matchTypeLabel = '<i class="ti ti-friends"></i> Testspiel';
    }

    // Stats
    const avgMom = typeof G !== 'undefined' && G.momentumLog && G.momentumLog.length
      ? Math.round(G.momentumLog.reduce((a,b)=>a+b.value,0)/G.momentumLog.length) : '–';
    const shots    = typeof G !== 'undefined' ? G.shots    : [0,0];
    const passes   = typeof G !== 'undefined' ? G.passAcc  : [0,0];
    const duels    = typeof G !== 'undefined' ? G.duelQuote: [0,0];
    const corners  = typeof G !== 'undefined' ? G.corners  : [0,0];
    const poss     = typeof G !== 'undefined' ? G.poss     : [50,50];
    const fouls    = typeof G !== 'undefined' ? G.fouls    : [0,0];

    // Torschützen aus G.scorers (wird in processMinute bei Eigentor via G.scorers.push befüllt)
    const goalEvents = (typeof G !== 'undefined' && G.scorers) ? G.scorers : [];

    // Verletzte / Gesperrte
    const { injured, suspended } = getUnavailable();
    const yellowWarn = getYellowWarnings();
    const { yellow: yCards, red: rCards, gegner: gCards } = getCardsThisMatch();

    // ── HTML ──────────────────────────────────────────────────────────────

    // Torschützen
    // Minute mit Nachspielzeit (90+1'), Elfmeter/Freistoß markiert; Gegentore mit Schütze darunter (Prüfung 2026-10-10)
    const minTxt = e => e.min + (e.nach ? '+' + e.nach : '') + "'";
    const artTxt = e => e.art === 'elfmeter' ? ' <span class="pm-goal-type">Elfmeter</span>' : e.art === 'freistoss' ? ' <span class="pm-goal-type">Freistoß</span>' : '';
    const gegTore = (typeof G !== 'undefined' && Array.isArray(G.gegnerTore)) ? G.gegnerTore : [];
    const gegKurz = typeof TEAMS !== 'undefined' ? (TEAMS.away.shortTag || '') : '';
    let goalsHtml = '<div class="pm-empty">Keine eigenen Tore</div>';
    if (goalEvents.length || gegTore.length) {
      goalsHtml = `${goalEvents.length ? '' : '<div class="pm-empty">Keine eigenen Tore</div>'}<div class="pm-goals-list">${goalEvents.map(e =>
        `<div class="pm-goal-row">
          <span class="pm-goal-min">${minTxt(e)}</span>
          <span class="pm-goal-name"><i class="ti ti-ball-football"></i> ${e.name || '–'}${artTxt(e)}</span>
        </div>`
      ).join('')}${gegTore.map(e =>
        `<div class="pm-goal-row pm-goal-gegner">
          <span class="pm-goal-min">${minTxt(e)}</span>
          <span class="pm-goal-name"><i class="ti ti-ball-football"></i> ${e.name || '–'}${gegKurz ? ` <span class="pm-goal-type">${gegKurz}</span>` : ''}${artTxt(e)}</span>
        </div>`
      ).join('')}</div>`;
    }

    // Statistiken
    // TV-Vergleichsbalken (Heim vs. Auswärts) aus den echten Match-Daten
    const statRow = (label, h, a, suf) => {
      suf = suf || '';
      const tot = (Number(h) + Number(a)) || 1;
      const hpct = Math.max(4, Math.min(96, Math.round(Number(h) / tot * 100)));
      return `<div class="pm-sb-row">
        <span class="pm-sb-v home">${h}${suf}</span>
        <div class="pm-sb-mid"><div class="pm-sb-label">${label}</div>
          <div class="pm-sb-track"><div class="pm-sb-fill" style="width:${hpct}%"></div></div></div>
        <span class="pm-sb-v away">${a}${suf}</span>
      </div>`;
    };
    const statsHtml = `<div class="pm-statbars">
      ${statRow('Ballbesitz', poss[0], poss[1], '%')}
      ${statRow('Schüsse', shots[0], shots[1])}
      ${statRow('Passquote', passes[0], passes[1], '%')}
      ${statRow('Zweikämpfe', duels[0], duels[1], '%')}
      ${statRow('Ecken', corners[0], corners[1])}
      ${statRow('Fouls', fouls[0], fouls[1])}
    </div>`;

    // Karten dieses Spiels
    let cardsHtml = '';
    if (yCards.length || rCards.length || gCards.length) {
      const rot = (c, kl) => `<span class="pm-card-chip red${kl ? ' ' + kl : ''}"><i class="ti ti-square-filled" style="color:#e24b4a"></i> ${c.type === 'gelbrot' ? 'Gelb-Rot · ' : ''}${c.player || '–'} ${c.min}'</span>`;
      const chips = [
        ...yCards.map(c => `<span class="pm-card-chip yellow"><i class="ti ti-square-filled" style="color:#f2c14e"></i> ${c.player || '–'} ${c.min}'</span>`),
        ...rCards.map(c => rot(c)),
        ...gCards.map(c => rot(Object.assign({}, c, { player: (gegKurz ? gegKurz + ' · ' : '') + (c.player || 'Gegner') }), 'gegner'))
      ].join('');
      cardsHtml = `
        <div class="pm-section">
          <div class="pm-section-title">Karten</div>
          <div class="pm-cards-row">${chips}</div>
        </div>`;
    }

    // Verletzte + Gesperrte (alle aktuellen, nicht nur neue)
    let alertsHtml = '';
    const alertRows = [
      ...injured.map(p => `
        <div class="pm-alert-row injured">
          <div class="pm-alert-icon"><i class="ti ti-bandage"></i></div>
          <div>
            <div class="pm-alert-name">${dname(p)}</div>
            <div class="pm-alert-detail">${p.injuryType || 'Verletzung'} · fällt noch ${p.injuryWeeks} Woche${p.injuryWeeks !== 1 ? 'n' : ''} aus</div>
          </div>
        </div>`),
      ...suspended.map(p => `
        <div class="pm-alert-row suspended">
          <div class="pm-alert-icon"><i class="ti ti-ban"></i></div>
          <div>
            <div class="pm-alert-name">${dname(p)}</div>
            <div class="pm-alert-detail">Gesperrt für ${p.suspendedGames} Spiel${p.suspendedGames !== 1 ? 'e' : ''}</div>
          </div>
        </div>`),
      ...yellowWarn.map(p => `
        <div class="pm-alert-row yellow-warn">
          <div class="pm-alert-icon"><i class="ti ti-square-filled" style="color:#f2c14e"></i></div>
          <div>
            <div class="pm-alert-name">${dname(p)}</div>
            <div class="pm-alert-detail">${p.yellowAccum}/5 Gelbe — nächste Karte = Sperre!</div>
          </div>
        </div>`)
    ];

    if (alertRows.length) {
      alertsHtml = `
        <div class="pm-section">
          <div class="pm-section-title"><i class="ti ti-alert-triangle"></i> Ausfall & Sperren — nächste Woche</div>
          <div class="pm-alert-list">${alertRows.join('')}</div>
        </div>`;
    }

    // Button-Label
    const isSeasondone = typeof fcmSeasonOver === 'function' && fcmSeasonOver();
    const btnLabel = isSeasondone
      ? '<i class="ti ti-trophy"></i> Saison abschließen → Office'
      : '<i class="ti ti-arrow-right" aria-hidden="true"></i> Nächste Woche → Office';   // DFL: das Office ist der Hub (Spieltest 2026-10-14)

    // ── Overlay ───────────────────────────────────────────────────────────
    const ov = document.createElement('div');
    ov.id = 'pm-overlay';
    ov.innerHTML = `
      <div id="pm-dialog">
        <div id="pm-header" class="${resultClass}">
          <div id="pm-result-emoji">${resultEmoji}</div>
          <div id="pm-result-label">${resultLabel}</div>
          <div id="pm-score">${score}</div>
          <div id="pm-teams">${homeTeam} vs. ${awayTeam}</div>
          ${matchTypeLabel ? `<div id="pm-match-type">${matchTypeLabel}</div>` : ''}
        </div>

        <div id="pm-body">

          <div class="pm-section">
            <div class="pm-section-title">Torschützen</div>
            ${goalsHtml}
          </div>

          <div class="pm-section">
            <div class="pm-section-title">Statistiken</div>
            ${statsHtml}
          </div>

          ${cardsHtml}
          ${alertsHtml}

        </div>

        <div id="pm-footer">
          <button id="pm-continue-btn">${btnLabel}</button>
        </div>
      </div>`;

    document.body.appendChild(ov);

    document.getElementById('pm-continue-btn').addEventListener('click', function () {
      ov.remove();
      if (typeof postMatchContinue === 'function') postMatchContinue();
    });
  }

  // ── triggerFulltime patchen ───────────────────────────────────────────────
  const _origFulltime = window.triggerFulltime;
  if (typeof _origFulltime === 'function') {
    window.triggerFulltime = function () {
      _origFulltime.apply(this, arguments);
      // Nach kurzem Delay (Media baut sich auf + Abpfiff-Event wird geloggt)
      setTimeout(showPostMatchModal, 900);
    };
    console.log('[PostMatchModal] triggerFulltime gepatcht — Modal aktiv');
  } else {
    console.warn('[PostMatchModal] triggerFulltime nicht gefunden — Patch fehlgeschlagen');
  }

  // ── Globaler Zugriff (Debug) ──────────────────────────────────────────────
  window.PostMatchModal = { show: showPostMatchModal };

})();


/* ---------- js/player_ratings_patch.js ---------- */
/* ===== player_ratings_patch.js ===== */
/* ═══════════════════════════════════════════════════════════════════════════
   SPIELER-BEWERTUNGS-PATCH  ·  v1 — Note 1,0–10,0 pro Spiel + Saison-Ø
   ─────────────────────────────────────────────────────────────────────────
   Laden NACH app_main.js und postmatch_modal_patch.js (möglichst spät, jedenfalls
   nach allem, was processFixtureResult / showPostMatchModal / renderPlayerCard
   definiert oder patcht). Empfehlung: direkt VOR price_balance_patch.js, oder
   ganz ans Ende — Hauptsache nach postmatch_modal_patch.js.

   ───────────────────────────────────────────────────────────────────────────
   NOTEN-SKALA (wie gewünscht):
     5,0–5,9   Rabenschwarzer Tag / schlechtes Spiel
     6,0–6,1   schlecht
     6,2–6,6   schwächeres Spiel
     6,7       normales, durchschnittliches Spiel  ← Ankerpunkt
     7,0–7,9   gutes Spiel
     8,0–8,9   außerordentlich gut (Tor/Vorlage, fast alle Zweikämpfe,
               Elfmeter gehalten, viele Paraden)
     9,0–10,0  Bestnote — eines der besten Spiele überhaupt

   ───────────────────────────────────────────────────────────────────────────
   WAS DER PATCH TUT
     1. Nach jedem Spiel (Patch auf processFixtureResult) bekommt JEDER
        eingesetzte Startelf-Spieler eine Note. Tore, Vorlagen, Karten, das
        Mannschaftsergebnis, Gegentore (für Abwehr/TW), Pass-/Zweikampfquote
        sowie etwas Zufall fließen ein.
     2. Die Note wird in p.matchRatings (laufende Saison) gesammelt; daraus
        ergibt sich der Saison-Durchschnitt p.stats.avgRating.
     3. Der Saison-Ø landet als eigene Box auf der Playercard.
     4. Das Post-Match-Modal zeigt die Einzelnoten der Startelf (Notenspiegel),
        farbcodiert.
     5. G.lastRatings hält die Noten des zuletzt gespielten Spiels (für das Modal
        und für spätere Spielerentwicklungs-Logik — kommt in einem nächsten Schritt).

   Die berechnete Note pro Spieler steht außerdem in p.lastMatchRating bereit
   (für den späteren Entwicklungs-Schritt).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {

  // ── STELLSCHRAUBEN ───────────────────────────────────────────────────────
  const ANCHOR      = 6.7;   // Durchschnittliches Spiel
  const MIN_RATING  = 1.0;
  const MAX_RATING  = 10.0;

  // Punkt-Beiträge (in Notenpunkten) für einzelne Ereignisse
  const GOAL_BONUS         = 1.10;   // pro erzieltem Tor
  const ASSIST_BONUS       = 0.75;   // pro Vorlage
  const YELLOW_PENALTY     = 0.30;   // pro Gelber Karte
  const RED_PENALTY        = 1.80;   // Rote Karte
  const WIN_BONUS          = 0.45;   // Mannschaft gewinnt
  const DRAW_BONUS         = 0.05;   // Unentschieden
  const LOSS_PENALTY       = 0.40;   // Niederlage
  const CLEAN_SHEET_BONUS  = 0.55;   // Zu-Null (extra für TW & Abwehr)
  const PER_GOAL_CONCEDED  = 0.28;   // Abzug je Gegentor (TW & Abwehr, skaliert n. Position)

  // Wie stark Team-Pass-/Zweikampfquote die Note formt (in Notenpunkten, ±)
  const TEAM_FORM_WEIGHT   = 0.9;

  // ── EINZELLEISTUNG ────────────────────────────────────────────────────────
  // Bis hierher kannte die Note keine individuelle Fehlleistung: keine
  // vergebene Großchance, keinen Ballverlust, keinen Fehler vor dem Gegentor.
  // Ein Stürmer kam deshalb nie unter 5,1. Die räumliche Engine liefert diese
  // Werte jetzt in window.LAST_MATCH_PERF.
  // Kalibriert an gemessenen Verteilungen: rund 1 vergebene Großchance je Spiel,
  // Ballverluste über Plan liegen im Median bei 0,3 und im 90. Perzentil bei 5,1.
  const CHANCE_VERGEBEN    = 0.55;   // je liegen gelassener Großchance
  const CHANCE_VERGEBEN_MAX= 1.40;
  const VERLUST_FREI       = 1.5;    // so viele Verluste über Plan sind noch normal
  const VERLUST_PRO_STUECK = 0.16;   // jeder weitere kostet
  const VERLUST_MAX        = 1.30;
  const PATZER             = 0.70;   // letzter Ballführender vor dem Gegentor
  const PATZER_MAX         = 1.60;
  // DEFENSIVARBEIT: Abfangen und gewonnene Zweikämpfe, gemessen am Soll der
  // Position. Ohne diesen Term war ein Innenverteidiger überhaupt nicht
  // bewertbar — gemessen lag ein 90er bei derselben Ø-Note wie ein 58er (6,84
  // gegen 6,53, reines Rauschen). Über die Aktionen trennen sich beide
  // deutlich: 9,3 gegen 6,9 Aktionen je Spiel.
  const DEF_PRO_AKTION     = 0.16;   // je Aktion über bzw. unter dem Soll
  const DEF_MAX            = 0.95;   // Deckel in beide Richtungen
  // PASSQUOTE: trennt sauber — gemessen 92,0 % bei OVR 58, 99,0 % bei OVR 90.
  const PASS_REFERENZ      = 96;
  const PASS_PRO_PROZENT   = 0.085;
  const PASS_MAX           = 0.50;
  // DRIBBLING: gewonnene minus verlorene Zweikämpfe am Ball.
  // Bilanz −0,2 bei OVR 58, +2,0 bei OVR 90.
  const DRIBBEL_PRO_STUECK = 0.13;
  const DRIBBEL_MAX        = 0.45;
  // TORE NACH POSITION: Ein Treffer des Innenverteidigers ist die Ausnahme und
  // wiegt schwerer als der zwölfte Saisontreffer des Mittelstürmers.
  const TOR_FAKTOR = { TW: 1.7, IV: 1.45, AV: 1.30, ZDM: 1.25, ZM: 1.15,
                       ZOM: 1.05, OM: 1.0, AM: 1.0, FL: 1.0, ST: 1.0,
                       LV: 1.30, RV: 1.30, LM: 1.0, RM: 1.0, LF: 1.0, RF: 1.0 };   // DFL D95: mit Seite wie die Gruppe

  // Zufalls-Streuung (Tagesform) — Gauß-ähnlich, ±
  const RANDOM_SPREAD      = 0.55;

  // ── Hilfen ────────────────────────────────────────────────────────────────
  function clampR(v) { return Math.max(MIN_RATING, Math.min(MAX_RATING, v)); }
  function round1(v) { return Math.round(v * 10) / 10; }

  // angenäherte Normalverteilung (Mittelwert 0), via 2er-Mittel zweier Uniform
  function gauss() { return ((Math.random() + Math.random()) - 1); }

  // Positionsgruppe eines Spielers grob bestimmen (TW / DEF / MID / ATT)
  function posBucket(p) {
    const pos = (p && (p.pos || (p.positions && p.positions[0]))) || 'ZM';
    if (pos === 'TW') return 'TW';
    if (pos === 'IV' || pos === 'AV' || pos === 'LV' || pos === 'RV') return 'DEF';
    if (pos === 'ST' || pos === 'OM' || pos === 'LA' || pos === 'RA') return 'ATT';
    return 'MID';
  }

  // ── KERN: Note für einen Spieler dieses Spiels berechnen ───────────────────
  // ctx = { goalsFor, goalsAgainst, outcome:'Sieg'|'Niederlage'|'Unentschieden' }
  function computeMatchRating(p, perPlayer, ctx) {
    let r = ANCHOR;
    const bucket = posBucket(p);

    // — Offensiv-Beiträge (für alle, Stürmer profitieren am meisten via Häufigkeit) —
    r += (perPlayer.goals   || 0) * GOAL_BONUS * (TOR_FAKTOR[p.pos] || 1);
    r += (perPlayer.assists || 0) * ASSIST_BONUS;

    // — Karten —
    r -= (perPlayer.yellow || 0) * YELLOW_PENALTY;
    r -= (perPlayer.red    || 0) * RED_PENALTY;

    // — Mannschaftsergebnis —
    if (ctx.outcome === 'Sieg')              r += WIN_BONUS;
    else if (ctx.outcome === 'Unentschieden') r += DRAW_BONUS;
    else                                      r -= LOSS_PENALTY;

    // — Defensive Verantwortung (TW & Abwehr stärker, MID leicht) —
    let defWeight = 0;
    if (bucket === 'TW')      defWeight = 1.0;
    else if (bucket === 'DEF') defWeight = 0.8;
    else if (bucket === 'MID') defWeight = 0.3;
    else                       defWeight = 0.0;

    if (defWeight > 0) {
      if (ctx.goalsAgainst === 0) r += CLEAN_SHEET_BONUS * defWeight;
      else r -= ctx.goalsAgainst * PER_GOAL_CONCEDED * defWeight;
    }

    // — Torwart-Paraden-Simulation —
    // Es gibt keine echten Paraden-Events; wir leiten sie aus gegnerischen
    // Schüssen minus Gegentore ab. Ein TW, der viele Schüsse hält, wird belohnt.
    if (bucket === 'TW') {
      const shotsAgainst = (typeof G !== 'undefined' && G.shots) ? (G.shots[1] || 0) : 0;
      const saves = Math.max(0, shotsAgainst - (ctx.goalsAgainst || 0));
      // Jede Parade ~0,12 Punkte, gedeckelt — viele Paraden = außerordentliches Spiel.
      // ABER: bei vielen Gegentoren wird der Paraden-Bonus gedämpft, damit ein TW
      // mit 4 Gegentoren trotz Paraden einen rabenschwarzen Tag bekommt.
      const concededDamp = 1 / (1 + (ctx.goalsAgainst || 0) * 0.6);
      r += Math.min(1.6, saves * 0.12) * concededDamp;
    }

    // — Team-Form (Pass- & Zweikampfquote der eigenen Mannschaft) —
    // G.passAcc[0] / G.duelQuote[0] sind Heim = eigene Werte. Über/unter 50/75
    // hebt bzw. senkt die Note leicht. Wirkt auf MID am stärksten.
    if (typeof G !== 'undefined') {
      const passAcc = (G.passAcc && G.passAcc[0]) || 75;
      const duelQ   = (G.duelQuote && G.duelQuote[0]) || 50;
      // normiert: Passquote relativ zu 75 %, Zweikampf relativ zu 50 %
      const passN = (passAcc - 75) / 25;   // −? .. +? (etwa −1..+0.8)
      const duelN = (duelQ - 50) / 50;     // −1 .. +1
      let formWeight = bucket === 'MID' ? 1.0 : bucket === 'TW' ? 0.3 : 0.6;
      r += (passN * 0.5 + duelN * 0.5) * TEAM_FORM_WEIGHT * formWeight;
    }

    // — Einzelleistung aus der Aufzeichnung —
    const perf = (window.LAST_MATCH_PERF && window.LAST_MATCH_PERF.spieler)
      ? window.LAST_MATCH_PERF.spieler[p.id] : null;
    if (perf) {
      if (perf.vergeben) r -= Math.min(CHANCE_VERGEBEN_MAX, perf.vergeben * CHANCE_VERGEBEN);
      if (perf.ueber > VERLUST_FREI) {
        r -= Math.min(VERLUST_MAX, (perf.ueber - VERLUST_FREI) * VERLUST_PRO_STUECK);
      }
      if (perf.patzer)   r -= Math.min(PATZER_MAX, perf.patzer * PATZER);
      if (typeof perf.defDelta === 'number') {
        r += Math.max(-DEF_MAX, Math.min(DEF_MAX, perf.defDelta * DEF_PRO_AKTION));
      }
      if (perf.passquote != null) {
        const dp = perf.passquote * 100 - PASS_REFERENZ;
        r += Math.max(-PASS_MAX, Math.min(PASS_MAX, dp * PASS_PRO_PROZENT));
      }
      if (perf.dribbelDelta) {
        r += Math.max(-DRIBBEL_MAX, Math.min(DRIBBEL_MAX, perf.dribbelDelta * DRIBBEL_PRO_STUECK));
      }
    }

    // — Tagesform (Zufall) —
    r += gauss() * RANDOM_SPREAD;

    return clampR(round1(r));
  }

  // ── Note in Spieler-Statistik einbuchen ────────────────────────────────────
  function recordRating(p, rating, season) {
    if (!p) return;
    // laufende Saison-Sammlung
    if (!p.matchRatings || p.matchRatings.season !== season) {
      p.matchRatings = { season: season, list: [] };
    }
    p.matchRatings.list.push(rating);
    p.lastMatchRating = rating;

    // Durchschnitt in p.stats.avgRating spiegeln (für Playercard)
    if (typeof ensurePlayerStats === 'function') {
      const st = ensurePlayerStats(p, season);
      const list = p.matchRatings.list;
      const avg = list.reduce((a, b) => a + b, 0) / list.length;
      st.avgRating = round1(avg);
      st.ratingsCount = list.length;
    }
  }

  // Saison-Durchschnitt eines Spielers (oder null wenn keine Spiele)
  window.seasonAvgRating = function (p, season) {
    const s = season != null ? season : (typeof LEAGUE !== 'undefined' && LEAGUE ? LEAGUE.season : 1);
    if (p && p.matchRatings && p.matchRatings.season === s && p.matchRatings.list.length) {
      const list = p.matchRatings.list;
      return round1(list.reduce((a, b) => a + b, 0) / list.length);
    }
    if (p && p.stats && p.stats.season === s && p.stats.avgRating != null) return p.stats.avgRating;
    return null;
  };

  // ── 0. PATCH: handleKO → beim Anpfiff Tore/Vorlagen-Snapshot der Startelf ──
  // Tore und Vorlagen werden WÄHREND des Spiels via addPlayerGoal/addPlayerAssist
  // direkt in p.stats geschrieben. Tore haben in G.scorers eine ID, Vorlagen NICHT.
  // Damit wir die pro-Spiel-Vorlagen jedes Spielers kennen, sichern wir beim
  // Anpfiff den Saison-Stand und bilden nach dem Spiel die Differenz.
  const _origHandleKO = window.handleKO;
  if (typeof _origHandleKO === 'function') {
    window.handleKO = function () {
      // Nur beim echten Anpfiff (Spielbeginn) snapshotten
      const atKickoff = (typeof G !== 'undefined') && !G.running && !G.halfDone && G.min === 0;
      if (atKickoff) {
        try {
          const season = (typeof LEAGUE !== 'undefined' && LEAGUE) ? LEAGUE.season : 1;
          const snap = {};
          (typeof getLineupIds === 'function' ? getLineupIds().map(getPlayer) : []).forEach(p => {
            if (!p) return;
            const st = (p.stats && p.stats.season === season) ? p.stats : null;
            snap[p.id] = {
              goals:   st ? (st.goals   || 0) : 0,
              assists: st ? (st.assists || 0) : 0
            };
          });
          window._preMatchStatSnapshot = { season, snap };
        } catch (e) { window._preMatchStatSnapshot = null; }
      }
      return _origHandleKO.apply(this, arguments);
    };
    console.log('[PlayerRatings] handleKO gepatcht — Vorlagen-Snapshot bei Anpfiff');
  }

  // ── 1. PATCH: processFixtureResult → Noten nach jedem Spiel vergeben ───────
  const _origProcess = window.processFixtureResult;
  if (typeof _origProcess === 'function') {
    window.processFixtureResult = function () {
      // WICHTIG: Vor dem Original lesen, welche Spieler in der Startelf standen
      // (das Original zählt apps hoch; die Lineup-Objekte sind hier noch gültig).
      let starters = [];
      try {
        starters = (typeof getLineupIds === 'function')
          ? getLineupIds().map(getPlayer).filter(Boolean) : [];
      } catch (e) { starters = []; }

      // Match-Kontext aus G (Engine stellt FCM immer als home dar)
      const goalsFor     = (typeof G !== 'undefined') ? G.homeGoals : 0;
      const goalsAgainst = (typeof G !== 'undefined') ? G.awayGoals : 0;
      const outcome = goalsFor > goalsAgainst ? 'Sieg'
                    : goalsFor < goalsAgainst ? 'Niederlage' : 'Unentschieden';
      const ctx = { goalsFor, goalsAgainst, outcome };
      const season = (typeof LEAGUE !== 'undefined' && LEAGUE) ? LEAGUE.season : 1;

      // Pro-Spieler-Events aus diesem Spiel sammeln (Tore/Vorlagen/Karten)
      // Tore: G.scorers = [{id, name, min}]
      // Vorlagen: nicht separat in G; wir leiten sie aus dem Stat-Delta ab —
      //   einfacher: wir lesen Tore aus G.scorers, Karten aus G.cards.
      const perPlayer = {};
      function bucketFor(id) {
        if (!perPlayer[id]) perPlayer[id] = { goals: 0, assists: 0, yellow: 0, red: 0 };
        return perPlayer[id];
      }
      // Tore
      if (typeof G !== 'undefined' && Array.isArray(G.scorers)) {
        G.scorers.forEach(s => { if (s && s.id) bucketFor(s.id).goals++; });
      }
      // Karten (nur eigenes Team)
      if (typeof G !== 'undefined' && Array.isArray(G.cards)) {
        G.cards.forEach(c => {
          if (c && c.team === 'home' && c.playerId) {
            if (c.type === 'yellow') bucketFor(c.playerId).yellow++;
            if (c.type === 'red' || c.type === 'gelbrot') bucketFor(c.playerId).red++;
          }
        });
      }
      // Vorlagen & Tore pro Spiel aus dem Pre-Match-Snapshot ableiten.
      // (Tore sind zusätzlich über G.scorers mit ID bekannt — wir nehmen das
      //  Maximum aus beiden Quellen, falls eine mal leer ist.)
      // Vorlagen direkt aus dem Torprotokoll — die räumliche Engine liefert sie
      // dort jetzt mit.
      if (typeof G !== 'undefined' && Array.isArray(G.scorers)) {
        G.scorers.forEach(s2 => { if (s2 && s2.assistId) bucketFor(s2.assistId).assists++; });
      }

      // FEHLER BEHOBEN: Der Delta-Abgleich gegen den Anpfiff-Snapshot lief ohne
      // Absicherung. Der Snapshot entsteht aber nur in handleKO() — also nur bei
      // der Textsimulation. Mit der räumlichen Engine gab es ihn nie, `before`
      // war 0, und als „Tore in diesem Spiel" wurde die SAISONBILANZ gelesen:
      // Ein Stürmer mit 12 Saisontoren bekam +13,2 Notenpunkte und stand
      // dauerhaft bei 10,0. Der Abgleich läuft jetzt nur noch mit gültigem
      // Snapshot; ohne ihn zählt allein das Torprotokoll dieses Spiels.
      const snapObj = (window._preMatchStatSnapshot && window._preMatchStatSnapshot.season === season)
        ? window._preMatchStatSnapshot.snap : null;
      if (snapObj) {
        starters.forEach(p => {
          const st = (p.stats && p.stats.season === season) ? p.stats : null;
          const before = snapObj[p.id];
          if (!st || !before) return;
          const goalsDelta   = Math.max(0, (st.goals   || 0) - before.goals);
          const assistsDelta = Math.max(0, (st.assists || 0) - before.assists);
          if (!goalsDelta && !assistsDelta) return;
          const b = bucketFor(p.id);
          if (b.goals   < goalsDelta)   b.goals   = goalsDelta;     // Protokoll hat Vorrang
          if (b.assists < assistsDelta) b.assists = assistsDelta;
        });
      }
      window._preMatchStatSnapshot = null;      // verbraucht — nie zweimal nutzen

      // Original ausführen (zählt apps, Sperren, Einnahmen, Tabelle …)
      const result = _origProcess.apply(this, arguments);

      // Noten berechnen & einbuchen
      const ratings = [];
      starters.forEach(p => {
        const pp = perPlayer[p.id] || { goals: 0, assists: 0, yellow: 0, red: 0 };
        const rating = computeMatchRating(p, pp, ctx);
        recordRating(p, rating, season);
        ratings.push({
          id: p.id,
          name: (typeof displayName === 'function') ? displayName(p) : p.name,
          pos: p.pos || (p.positions && p.positions[0]) || '',
          rating: rating,
          goals: pp.goals, assists: pp.assists,
          // für den Notenspiegel: woran lag die Note?
          perf: (window.LAST_MATCH_PERF && window.LAST_MATCH_PERF.spieler)
                ? window.LAST_MATCH_PERF.spieler[p.id] : null
        });
      });
      // Für das Modal & spätere Entwicklung verfügbar machen
      if (typeof G !== 'undefined') G.lastRatings = ratings;
      window.LAST_MATCH_RATINGS = ratings;

      return result;
    };
    console.log('[PlayerRatings] processFixtureResult gepatcht — Noten aktiv');
  } else {
    console.warn('[PlayerRatings] processFixtureResult nicht gefunden — Noten inaktiv');
  }

  // ── 2. PATCH: renderPlayerCard → Saison-Ø-Note anzeigen ───────────────────
  const _origRenderCard = window.renderPlayerCard;
  if (typeof _origRenderCard === 'function') {
    window.renderPlayerCard = function (p) {
      _origRenderCard.apply(this, arguments);
      if (!p) return;
      const el = document.getElementById('playercard-sec');
      if (!el) return;

      const season = (typeof LEAGUE !== 'undefined' && LEAGUE) ? LEAGUE.season : 1;
      const avg = window.seasonAvgRating(p, season);
      const count = (p.matchRatings && p.matchRatings.season === season) ? p.matchRatings.list.length
                  : (p.stats && p.stats.ratingsCount) || 0;

      const valTxt = (avg != null) ? avg.toFixed(1).replace('.', ',') : '–';
      const color  = ratingColor(avg);

      // In die Statistik-Zeile (pcard-statrow) als 5. Kachel einfügen.
      const statRow = el.querySelector('.pcard-statrow');
      const cardHtml = `
        <div class="pcard-stat" title="Durchschnittsnote dieser Saison über ${count} Spiel${count !== 1 ? 'e' : ''}">
          <div class="v" style="color:${color}">${valTxt}</div>
          <div class="l">Ø Note</div>
        </div>`;
      if (statRow) {
        statRow.insertAdjacentHTML('beforeend', cardHtml);
      } else {
        // Fallback: als eigene Zeile anhängen
        el.insertAdjacentHTML('beforeend',
          `<div class="pcard-row"><span>Ø Note (Saison)</span><b style="color:${color}">${valTxt}</b></div>`);
      }

      // Letzte Note als Zeile (falls vorhanden)
      if (p.lastMatchRating != null) {
        el.insertAdjacentHTML('beforeend',
          `<div class="pcard-row"><span>Letzte Note</span><b style="color:${ratingColor(p.lastMatchRating)}">${p.lastMatchRating.toFixed(1).replace('.', ',')}</b></div>`);
      }
    };
    console.log('[PlayerRatings] renderPlayerCard gepatcht — Ø-Note auf der Card');
  }

  // ── Farbskala für Noten ────────────────────────────────────────────────────
  // Farben aus den Tokens des Stils: Kenney Tag/Nacht lesbar auf Beige und Dunkel (Prüfung 2026-10-10: die festen
  // GitHub-Farben hatten auf Beige nur 1,6 : 1); die Werte nach dem Komma gelten für die alten Stile
  window.ratingColor = function (r) {
    if (r == null) return 'var(--text2, #8b949e)';
    if (r >= 9.0) return 'var(--blue, #a371f7)';         // Bestnote
    if (r >= 7.0) return 'var(--k-gut-fg, #3fb950)';     // gut bis außerordentlich
    if (r >= 6.7) return 'var(--text, #e6edf3)';         // Durchschnitt
    if (r >= 6.0) return 'var(--k-mittel-fg, #d29922)';  // schwächer
    return 'var(--k-schlecht-fg, #f85149)';              // rabenschwarz
  };

  // ── 3. POST-MATCH-MODAL: Notenspiegel einfügen ────────────────────────────
  // Wir hängen uns an showPostMatchModal: kurz NACH dem Aufbau injizieren wir
  // eine neue Sektion mit den Einzelnoten in den Modal-Body.
  function injectRatingsIntoModal() {
    const body = document.getElementById('pm-body');
    if (!body || document.getElementById('pm-ratings-section')) return;

    const ratings = (typeof G !== 'undefined' && G.lastRatings) ? G.lastRatings
                  : (window.LAST_MATCH_RATINGS || []);
    if (!ratings.length) return;

    // Mannschafts-Durchschnitt dieses Spiels
    const teamAvg = round1(ratings.reduce((a, b) => a + b.rating, 0) / ratings.length);

    // nach Note absteigend sortieren
    const sorted = ratings.slice().sort((a, b) => b.rating - a.rating);

    const rows = sorted.map(r => {
      const col = window.ratingColor(r.rating);
      const extra = [];
      if (r.goals)   extra.push(r.goals > 3 ? '⚽×' + r.goals : '⚽'.repeat(r.goals));
      if (r.assists) extra.push(r.assists > 3 ? '🅰️×' + r.assists : '🅰️'.repeat(r.assists));
      const extraTxt = extra.length ? ` <span style="font-size:10px">${extra.join(' ')}</span>` : '';
      return `<div class="pm-rating-row">
        <span class="pm-rating-pos">${r.pos || ''}</span>
        <span class="pm-rating-name">${r.name}${extraTxt}</span>
        <span class="pm-rating-val" style="color:${col}">${r.rating.toFixed(1).replace('.', ',')}</span>
      </div>`;
    }).join('');

    // Spieler des Spiels (Prüfung 2026-10-10: fehlte in allen Berichten – der alte Aufhänger lief nur mit der Minuten-Engine)
    const top = sorted[0];
    const mvp = top ? `<div class="pm-rating-row pm-mvp"><span class="pm-rating-pos">⭐</span>
        <span class="pm-rating-name">Spieler des Spiels: <b>${top.name}</b></span>
        <span class="pm-rating-val" style="color:${window.ratingColor(top.rating)}">${top.rating.toFixed(1).replace('.', ',')}</span></div>` : '';
    const html = `
      <div class="pm-section" id="pm-ratings-section">
        <div class="pm-section-title">Spielernoten · Ø ${teamAvg.toFixed(1).replace('.', ',')}</div>
        ${mvp}
        <div class="pm-ratings-list">${rows}</div>
      </div>`;

    // Vor dem Footer einfügen — also ans Ende des Body
    body.insertAdjacentHTML('beforeend', html);
  }

  // CSS für die Modal-Noten
  if (!document.getElementById('pm-ratings-style')) {
    const s = document.createElement('style');
    s.id = 'pm-ratings-style';
    s.textContent = `
      .pm-ratings-list { display:flex; flex-direction:column; gap:4px; }
      .pm-rating-row {
        display:flex; align-items:center; gap:10px;
        background: var(--bg3, #0d1117);
        border-radius:6px; padding:5px 10px; font-size:12px;
        color: var(--text, #e6edf3);
      }
      .pm-rating-pos {
        min-width:34px; font-size:10px; font-weight:700;
        color: var(--text3, #6e7681); text-align:center;
        background: var(--bg2, #161b22); border-radius:4px; padding:2px 0;
      }
      .pm-rating-name { flex:1; font-weight:600; }
      .pm-rating-val  { font-weight:800; font-size:14px; min-width:34px; text-align:right; }
    `;
    document.head.appendChild(s);
  }

  // showPostMatchModal patchen (falls vorhanden), sonst PostMatchModal.show
  function patchModal() {
    const target = (window.PostMatchModal && typeof window.PostMatchModal.show === 'function')
      ? window.PostMatchModal : null;

    // Variante A: PostMatchModal.show existiert
    if (target) {
      const _origShow = target.show;
      target.show = function () {
        _origShow.apply(this, arguments);
        // Modal-DOM ist nach show synchron vorhanden → injizieren
        setTimeout(injectRatingsIntoModal, 0);
      };
      console.log('[PlayerRatings] PostMatchModal.show gepatcht — Notenspiegel im Modal');
      return true;
    }
    return false;
  }

  if (!patchModal()) {
    // Falls das Modal-Patch später lädt: kurz nachfassen.
    let tries = 0;
    const iv = setInterval(() => {
      tries++;
      if (patchModal() || tries > 20) clearInterval(iv);
    }, 100);
  }

  // ── Global / Debug ──────────────────────────────────────────────────────────
  window.PlayerRatings = {
    computeMatchRating,
    seasonAvg: window.seasonAvgRating,
    color: window.ratingColor,
    lastMatch: () => (typeof G !== 'undefined' ? G.lastRatings : null)
  };

  console.log('[PlayerRatings v1] geladen — Anker 6,7 · Note 1,0–10,0 · Ø auf Playercard · Notenspiegel im Modal');

})();


/* ---------- js/player_development_patch.js ---------- */
/* ===== player_development_patch.js ===== */
/* ═══════════════════════════════════════════════════════════════════════════
   SPIELER-ENTWICKLUNGS-PATCH  v4 — mit Noten-gekoppelter Entwicklung
   ─────────────────────────────────────────────────────────────────────────
   Laden NACH player_ratings_patch.js (das die Spielnoten liefert) und
   training_patches.js.

   NEU in v4 — die Durchschnittsnote beeinflusst die Entwicklung:

   #1 FORM-FAKTOR (wöchentlich)
      Multiplikator ×0,60–1,35 auf die Entwicklungschance, abgeleitet aus dem
      Ø der letzten 5 Spielnoten. Anker = 6,7 → ×1,0.
      Wirkung pro Saison (Talent 19J, Stammspieler, Gelände 1, Normaltraining):
        Krise Ø5,0   → ΔOVR ±0   (Entwicklung eingefroren)
        Normal Ø6,7  → +3,6 OVR  (unverändert zur alten Logik)
        Stark Ø8,2   → +6,2 OVR

   #2 POTENZIAL-REVISION an Saison-Ø (am Saisonende)
      Junge Spieler (≤23) mit starker Saison → Potenzial +2..4 (45–75% Chance).
      Jeder Spieler mit schwacher Saison (Ø≤5,8) → Potenzial −2..4 (55% Chance),
      aber nie unter ovr+8. Eine spätere starke Saison hebt es wieder.
      → dynamisches Potenzial: Spieler können alle Erwartungen über- ODER
        untertreffen, und sich davon wieder erholen.

   #3 SERIEN-EVENTS (nach jedem Spiel, mit 6-Spiele-Cooldown)
      Rausch: 3 Spiele ≥8,0 in Folge → +1 Schwerpunkt-Attribut + News.
      Krise:  4 Spiele ≤5,5 in Folge → −1 akut (regenerierbar) + News.
              Der akute Verlust (p._formScar) wird bei guter Form (Ø≥6,7)
              automatisch wieder aufgeholt.

   #4 VETERANEN-ABBAU notenabhängig (30+)
      Gute Form (Ø≥7,0) bremst den altersbedingten Abbau (×0,45),
      schlechte Form (Ø≤6,0) verstärkt ihn (×1,40).
      Beispiel Veteran 33J: gute Form ΔOVR −0,1 vs. schlechte Form −1,1.

   Form-Indikator + 🔥/❄️ erscheinen im Training-Hub neben jedem Spieler.
   ─────────────────────────────────────────────────────────────────────────
   Entwicklung pro Saison (Erwartungswert, Normal-Training, Stufe-1-Gelände):
   ┌─────────┬──────┬──────┬──────┬──────┬──────┬──────┐
   │  Alter  │ 100% │  80% │  60% │  40% │  20% │   0% │
   ├─────────┼──────┼──────┼──────┼──────┼──────┼──────┤
   │  ≤22    │ +4.5 │ +3.7 │ +3.0 │ +2.2 │ +1.4 │ +0.7 │
   │  23–25  │ +3.5 │ +2.9 │ +2.3 │ +1.7 │ +1.1 │ +0.5 │
   │  26–29  │ +1.5 │ +1.2 │ +1.0 │ +0.7 │ +0.5 │ +0.2 │
   │  30–32  │ +0.5 │ +0.4 │ +0.3 │ ≈0   │ ≈0   │ ≈0   │
   │  ≥33    │  —   │  —   │  —   │  —   │ Abbau│  —   │
   └─────────┴──────┴──────┴──────┴──────┴──────┴──────┘
   (Diese Tabelle gilt für Form = Ø6,7. Der Form-Faktor skaliert sie ×0,6–1,35.)
   Spielzeit = Anteil der letzten 5 Spiele (Rolling Window).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  const TS = window.TrainingSystem;
  if (!TS) { console.error('[DevPatch] TrainingSystem fehlt'); return; }

  // ── KONFIG ─────────────────────────────────────────────────────────────────
  const CFG = {
    baseTickNormal: 0.14,

    ageFactor: [
      { maxAge: 22, devFactor: 2.84, decayChance: 0.000 },
      { maxAge: 25, devFactor: 2.21, decayChance: 0.000 },
      { maxAge: 29, devFactor: 0.95, decayChance: 0.000 },
      { maxAge: 32, devFactor: 0.25, decayChance: 0.018 },
      { maxAge: 99, devFactor: 0.00, decayChance: 0.038 },
    ],

    playtimeMinFactor: 0.15, // Minimum auch ohne Einsatz (Training zählt)

    intensityScale: { leicht: 0.57, normal: 1.00, intensiv: 1.57 },

    // Verletzungsrisiko pro Spieler pro Woche (Intensiv-Training)
    injuryRisk: {
      normal:       0.006, // Basis (aus training_system.js übernommen)
      preseason:    0.012, // Vorbereitung: doppelt
      matchfree:    0.020, // Spielfreie Woche: höchstes Risiko
    },

    // Trainingsgelände: max +20% bei Stufe 10
    facilityMaxBonus: 0.20,

    // Vorbereitung = Wochen 1–5 (FRIENDLY_WEEKS = [2,3,4], Liga ab Wo 6)
    preseasonMaxWeek: 5,

    dynPotential: {
      maxAge: 21, minRecentApps: 3, revChance: 0.30, maxGain: 3,
    },

    // ── NOTEN-GEKOPPELTE ENTWICKLUNG (neu) ───────────────────────────────────
    // #1 FORM-FAKTOR: Multiplikator auf die wöchentliche Entwicklungschance,
    //    abgeleitet aus dem Ø der letzten ~5 Spielnoten. Anker = 6,7 → ×1,0.
    //    Lineare Interpolation zwischen den Stützpunkten, gedeckelt auf [min,max].
    form: {
      anchor: 6.7,           // Note für Faktor 1,0 (Durchschnittsspiel)
      minMul: 0.60,          // bei Ø 5,0 (Krise)
      maxMul: 1.35,          // bei Ø 8,5 (Topform)
      lowNote: 5.0,          // Note, ab der minMul gilt
      highNote: 8.5,         // Note, ab der maxMul gilt
      window: 5,             // Anzahl letzter Spiele für den Form-Ø
      minGames: 2,           // erst ab so vielen Spielen wirkt der Form-Faktor
    },

    // #2 POTENZIAL-REVISION an Saison-Ø koppeln (am Saisonende, snapshotSquad)
    //    Positiv: junge Spieler mit starker Saison → Potenzial rauf.
    //    Negativ: anhaltend schwache Saison → Potenzial runter (2–4 Punkte).
    potentialBySeason: {
      // ÜBERARBEITET: Aufwärts-Revisionen endeten hart bei 23 Jahren, Abwärts-
      // Revisionen galten für alle. Ein 29-Jähriger konnte also nur verlieren,
      // egal wie er spielte. Jetzt ist beides nach Alter gestaffelt: je älter,
      // desto besser muss die Saison sein und desto kleiner ist der Sprung —
      // aber die Tür bleibt offen. Spätentwickler gibt es im Fußball wirklich.
      badNote: 5.8,          // Saison-Ø darunter = "schwache Saison"
      minGames: 8,           // Mindestspiele, damit die Saison-Ø zählt
      // [bis Alter, nötige Ø-Note, Chance, Gewinn min, Gewinn max]
      aufwaerts: [
        { bisAlter: 21, note: 7.2, chance: 0.55, min: 2, max: 4 },
        { bisAlter: 25, note: 7.4, chance: 0.45, min: 2, max: 3 },
        { bisAlter: 28, note: 7.7, chance: 0.32, min: 1, max: 3 },
        { bisAlter: 31, note: 8.0, chance: 0.22, min: 1, max: 2 },
        { bisAlter: 99, note: 8.3, chance: 0.12, min: 1, max: 1 }
      ],
      // Wer 30 Spiele auf hohem Niveau macht, hat es bewiesen; acht Spiele sind
      // eine Stichprobe. Der Einsatz skaliert die Chance mit.
      einsatzVoll: 22,       // ab so vielen Spielen zählt die Saison voll
      einsatzMin: 0.55,      // Anteil der Chance bei gerade eben minGames
      // BREMSE NACH OBEN: Ohne sie stapelten sich die Revisionen — ein
      // Wunderkind mit Potenzial 84 landete über neun Saisons bei 92, womit der
      // Potenzialwert bei Toptalenten bedeutungslos wurde. Je höher das
      // Potenzial schon ist, desto seltener geht es noch weiter hoch.
      bremseAb: 82,          // ab hier greift die Bremse
      bremseProPunkt: 0.09,  // Chance sinkt je Punkt darüber
      bremseMin: 0.10,       // aber nie unter diesen Anteil
      // STAGNATION: Wer in seinen Entwicklungsjahren kaum spielt, schöpft sein
      // Potenzial nicht aus. Ohne diese Regel erreichte der Ergänzungsspieler
      // exakt denselben Endwert wie der Stammspieler — nur zwei Jahre später.
      stagAlter: 24,         // bis zu diesem Alter zählt fehlende Spielpraxis
      stagSpiele: 7,         // weniger Saisonspiele = verlorenes Jahr
      stagChance: 0,         // 2026-10-22: ersetzt durch spielzeit_entwicklung.js (Einsatzanteil, Bank −2…−4); vorher 0.50
      stagVerlustMin: 1, stagVerlustMax: 2,
      downChance: 0.55,      // Chance auf −Potenzial bei schwacher Saison
      downLossMin: 2, downLossMax: 4,
      potentialFloor: 8,     // Potenzial nie unter ovr + diesen Wert senken
    },

    // #3 SERIEN-EVENTS (Rausch / Krise) — werden nach jedem Spiel geprüft
    streak: {
      hotCount: 3, hotNote: 8.0,    // 3 Spiele ≥ 8,0 in Folge = Rausch
      coldCount: 4, coldNote: 5.5,  // 4 Spiele ≤ 5,5 in Folge = Krise
      hotAttrGain: 1,               // Rausch: +1 auf ein Schwerpunkt-Attribut
      coldOvrLoss: 1,               // Krise: −1 OVR akut (regenerierbar)
      coldAttrFloor: 30,            // Attribute nie unter diesen Wert senken
      cooldown: 6,                  // nach einem Event: erst nach so vielen Spielen wieder möglich
    },

    // #4 VETERANEN: gute Note bremst den altersbedingten Abbau, schlechte verstärkt ihn.
    veteranDecay: {
      goodNote: 7.0,         // ab hier Abbau gebremst
      badNote: 6.0,          // darunter Abbau leicht verstärkt
      slowFactor: 0.45,      // decayChance × diesem Faktor bei guter Note
      fastFactor: 1.40,      // decayChance × diesem Faktor bei schlechter Note
    },
  };

  // ── HILFSFUNKTIONEN ────────────────────────────────────────────────────────
  function getAgeCfg(age) {
    for (const c of CFG.ageFactor) if (age <= c.maxAge) return c;
    return CFG.ageFactor[CFG.ageFactor.length - 1];
  }

  function playtimeFactor(p) {
    const buf = p._recentApps || [];
    const ratio = buf.length ? buf.reduce((s, v) => s + v, 0) / 5 : 0;
    const spiel = CFG.playtimeMinFactor + ratio * (1 - CFG.playtimeMinFactor);
    // DFL-Trainingsgruppe (D38): Training ersetzt einen Teil der fehlenden Spielpraxis
    const gruppe = (typeof window.trainingsgruppeFaktor === 'function') ? window.trainingsgruppeFaktor(p) : 0;
    return Math.max(spiel, gruppe || 0);
  }

  // Positionsgruppe (TW / DEF / MID / ATT) für die Auswahl des Schwerpunkt-Attributs
  function posBucketDev(p) {
    const pos = (p && (p.pos || (p.positions && p.positions[0]))) || 'ZM';
    if (pos === 'TW') return 'TW';
    if (pos === 'IV' || pos === 'AV' || pos === 'LV' || pos === 'RV') return 'DEF';
    if (pos === 'ST' || pos === 'OM' || pos === 'LA' || pos === 'RA') return 'ATT';
    return 'MID';
  }

  // ── NOTEN-HELFER ───────────────────────────────────────────────────────────
  // Liste der Saison-Noten eines Spielers (aus dem Ratings-Patch), oder [].
  function ratingList(p) {
    const season = (window.LEAGUE && LEAGUE.season) || 1;
    if (p && p.matchRatings && p.matchRatings.season === season && Array.isArray(p.matchRatings.list)) {
      return p.matchRatings.list;
    }
    return [];
  }

  // Ø der letzten N Noten (Form). null wenn zu wenige Spiele.
  function formAvg(p) {
    const list = ratingList(p);
    if (list.length < CFG.form.minGames) return null;
    const recent = list.slice(-CFG.form.window);
    return recent.reduce((a, b) => a + b, 0) / recent.length;
  }

  // Saison-Ø aller bisherigen Noten. null wenn keine.
  function seasonAvg(p) {
    const list = ratingList(p);
    if (!list.length) return null;
    return list.reduce((a, b) => a + b, 0) / list.length;
  }

  // #1 Form-Multiplikator aus dem Form-Ø (lineare Interpolation, gedeckelt).
  function formMultiplier(p) {
    const f = formAvg(p);
    if (f == null) return 1.0;                 // zu wenige Spiele → neutral
    const { anchor, minMul, maxMul, lowNote, highNote } = CFG.form;
    if (f >= anchor) {
      // anchor..highNote → 1.0..maxMul
      const t = Math.min(1, (f - anchor) / (highNote - anchor));
      return 1.0 + t * (maxMul - 1.0);
    } else {
      // lowNote..anchor → minMul..1.0
      const t = Math.min(1, (anchor - f) / (anchor - lowNote));
      return 1.0 - t * (1.0 - minMul);
    }
  }

  // Prüft eine Note-Serie am Ende der Liste: gibt true wenn die letzten `count`
  // Noten alle >= note (dir='hot') bzw. <= note (dir='cold') sind.
  function hasStreak(p, count, note, dir) {
    const list = ratingList(p);
    if (list.length < count) return false;
    const tail = list.slice(-count);
    return dir === 'hot'
      ? tail.every(r => r >= note)
      : tail.every(r => r <= note);
  }

  // Wochenstatus: 'preseason' | 'matchfree' | 'matchweek'
  function weekStatus() {
    if (!window.LEAGUE) return 'matchweek';
    const w = LEAGUE.week || 1;
    if (w <= CFG.preseasonMaxWeek) return 'preseason';
    // matchdayDueThisWeek gibt -1 wenn spielfrei
    if (typeof matchdayDueThisWeek === 'function' && matchdayDueThisWeek(LEAGUE) === -1) return 'matchfree';
    return 'matchweek';
  }

  // Prüft ob Intensiv gerade erlaubt ist; korrigiert ggf. + zeigt Banner
  function enforceIntensityRule() {
    if (!window.CLUB || !CLUB.training) return;
    if (CLUB.training.intensity !== 'intensiv') return;
    const status = weekStatus();
    if (status === 'preseason' || status === 'matchfree') return; // erlaubt

    // Nicht erlaubt → auf Normal zurücksetzen
    CLUB.training.intensity = 'normal';
    CLUB.training._intensivBlocked = true; // Flag für Banner
    if (typeof addNews === 'function') {
      addNews('club', '🏋️ Training angepasst',
        'Intensivtraining ist nur in der Vorbereitung oder spielfreien Wochen möglich. ' +
        'Das Training wurde automatisch auf Normal zurückgesetzt.');
    }
  }

  function effectiveTickChance(p) {
    const age    = p.age || 25;
    const ageCfg = getAgeCfg(age);
    const intKey = (CLUB.training && CLUB.training.intensity) || 'normal';
    const intMul = CFG.intensityScale[intKey] || 1.0;
    const facLvl = (CLUB.facilities && CLUB.facilities.training) || 1;
    // Gelände: linearer Bonus von 0 (Stufe 1) bis facilityMaxBonus (Stufe 10)
    const facMul = 1 + ((facLvl - 1) / 9) * CFG.facilityMaxBonus;
    // #1 Form-Faktor: gute Noten beschleunigen, schlechte bremsen die Entwicklung
    const formMul = formMultiplier(p);
    // Charaktereigenschaften: Trainingsfleiß und Reifetyp verschieben das Tempo
    const traitMul = (typeof window.traitDevFaktor === 'function') ? window.traitDevFaktor(p) : 1;
    return CFG.baseTickNormal * ageCfg.devFactor * playtimeFactor(p) * intMul * facMul * formMul * traitMul;
  }

  // Anzeige: sichtbares Potenzial – in der DFL zeigen verborgene Nieten die alte Hoffnung (D103), entwickelt wird
  // weiter nach truePotential (sonst verriete „Potenzial erreicht“ die Niete nach einer Saison)
  const potAnzeige = p => (p.niete && window.DFLGenerator && DFLGenerator.potSichtbar)
    ? DFLGenerator.potSichtbar(p, (typeof CLUB !== 'undefined' && CLUB && CLUB.facilities && CLUB.facilities.scouting) || 5)
    : (p.truePotential || (p.ovr + 5));
  function devSpeedLabel(p) {
    const age    = p.age || 25;
    const ageCfg = getAgeCfg(age);
    const pot    = potAnzeige(p);
    if (p.ovr >= pot)              return { icon: '🔒', label: 'Potenzial erreicht',  color: 'var(--text3,#6e7681)', decay: false };
    if (ageCfg.decayChance > 0.02) return { icon: '📉', label: 'Abbau-Gefahr',        color: 'var(--red,#f85149)',   decay: true  };
    if (ageCfg.decayChance > 0)    return { icon: '⚠️', label: 'Abbau möglich',       color: '#e09637',              decay: false };
    const ovrPerSeason = effectiveTickChance(p) * 34 / 3;
    const proSaison = `+${ovrPerSeason.toFixed(1).replace('.', ',')} OVR/Sai.`;     // deutsch mit Komma (Prüfung 2026-10-10)
    if (ovrPerSeason >= 3.5) return { icon: '🚀', label: proSaison, color: 'var(--green,#3fb950)' };
    if (ovrPerSeason >= 2.0) return { icon: '📈', label: proSaison, color: '#58a6ff' };
    if (ovrPerSeason >= 0.8) return { icon: '➡️', label: proSaison, color: 'var(--text2,#8b949e)' };
    if (ovrPerSeason >= 0.2) return { icon: '🐢', label: proSaison, color: '#e09637' };
    return { icon: '💤', label: 'Kaum Entwicklung', color: 'var(--text3,#6e7681)' };
  }

  // ── 1. Rolling Window + Serien-Events (#3): processFixtureResult patchen ───
  const _origProcess = window.processFixtureResult;
  if (typeof _origProcess === 'function') {
    window.processFixtureResult = function () {
      const result = _origProcess.apply(this, arguments);
      if (typeof SQUAD === 'undefined' || typeof getLineupIds !== 'function') return result;
      const starterIds = new Set(getLineupIds());
      SQUAD.forEach(p => {
        if (!p._recentApps) p._recentApps = [0, 0, 0, 0, 0];
        p._recentApps.push(starterIds.has(p.id) ? 1 : 0);
        p._recentApps = p._recentApps.slice(-5);
      });

      // #3 Serien-Events nur für Spieler prüfen, die GERADE gespielt haben
      // (sonst würde eine alte Serie mehrfach auslösen).
      const st = CFG.streak;
      starterIds.forEach(id => {
        const p = (typeof getPlayer === 'function') ? getPlayer(id) : SQUAD.find(x => x.id === id);
        if (!p) return;
        const name = ((p.firstName || '') + ' ' + p.name).trim();

        const gamesPlayed = ratingList(p).length;

        // RAUSCH: hotCount Spiele in Folge ≥ hotNote → einmaliger Attribut-Boost
        const hotReady = (p._lastHotStreakGame == null) || (gamesPlayed - p._lastHotStreakGame >= st.cooldown);
        if (hotReady && hasStreak(p, st.hotCount, st.hotNote, 'hot')) {
          p._lastHotStreakGame = gamesPlayed;          // Cooldown starten
          // Schwerpunkt-Attribut nach Position wählen
          const bucket = posBucketDev(p);
          const attr = bucket === 'ATT' ? 'att' : bucket === 'DEF' ? 'def' : bucket === 'TW' ? 'def' : 'mid';
          const pot = p.truePotential || (p.ovr + 5);
          if ((p[attr] || 50) < 98 && p.ovr < pot + 1) {   // kleiner Puffer über Potenzial erlaubt
            p[attr] = Math.min(98, (p[attr] || 50) + st.hotAttrGain);
            if (typeof computeOvrFromAreas === 'function') p.ovr = computeOvrFromAreas(p);
            if (typeof computeMarketValue  === 'function') p.value = computeMarketValue(p);
            if (typeof addNews === 'function') {
              addNews('squad', `🔥 Lauf der Form: ${name}`,
                `${name} spielt sich in einen Rausch — ${st.hotCount} starke Spiele in Folge! ${attr.toUpperCase()} +${st.hotAttrGain}.`);
            }
          }
        }

        // KRISE: coldCount Spiele in Folge ≤ coldNote → akuter OVR-Verlust (regenerierbar)
        const coldReady = (p._lastColdStreakGame == null) || (gamesPlayed - p._lastColdStreakGame >= st.cooldown);
        if (coldReady && hasStreak(p, st.coldCount, st.coldNote, 'cold')) {
          p._lastColdStreakGame = gamesPlayed;          // Cooldown starten
          // schwächstes Attribut senken (außer es liegt schon am Boden)
          const areas = [['def', p.def], ['mid', p.mid], ['att', p.att]]
            .filter(([, v]) => (v || 0) > st.coldAttrFloor)
            .sort((a, b) => a[1] - b[1]);
          if (areas.length) {
            const [attr] = areas[0];
            p[attr] = Math.max(st.coldAttrFloor, (p[attr] || 50) - st.coldOvrLoss);
            // Merke akut verlorene Punkte, damit gute Form sie zurückbringen kann
            p._formScar = (p._formScar || 0) + st.coldOvrLoss;
            if (typeof computeOvrFromAreas === 'function') p.ovr = computeOvrFromAreas(p);
            if (typeof computeMarketValue  === 'function') p.value = computeMarketValue(p);
            if (typeof addNews === 'function') {
              addNews('squad', `❄️ Formkrise: ${name}`,
                `${name} steckt in einer Krise — ${st.coldCount} schwache Spiele in Folge. ${attr.toUpperCase()} −${st.coldOvrLoss} (durch gute Leistungen wieder aufholbar).`);
            }
          }
        }
      });

      return result;
    };
    console.log('[DevPatch] processFixtureResult gepatcht — Rolling Window + Serien-Events aktiv');
  }

  // ── 2. weeklyTrainingTick patchen ──────────────────────────────────────────
  const _origTick = TS.weeklyTrainingTick.bind(TS);
  // Ab hier ist DIESES Modul für die Entwicklung zuständig — der ältere Tick
  // überspringt seine eigene Logik (er fragte nicht nach Einsatzzeit).
  TS.entwicklungExtern = true;

  TS.weeklyTrainingTick = function () {
    // Intensiv-Regel prüfen BEVOR der Original-Tick läuft
    enforceIntensityRule();

    // Original-Tick (Verletzungsrisiko, Moral, weekLog) — wir überschreiben
    // nur die Entwicklungs-Logik, nicht den Rest
    _origTick();

    if (typeof SQUAD === 'undefined' || !SQUAD.length) return;
    const t      = CLUB.training;
    const status = weekStatus();

    // Erhöhtes Verletzungsrisiko bei erlaubtem Intensivtraining
    if (t.intensity === 'intensiv') {
      const riskKey = status === 'preseason' ? 'preseason' : 'matchfree';
      const risk    = CFG.injuryRisk[riskKey] - CFG.injuryRisk.normal; // Delta zum Basis-Risiko
      SQUAD.forEach(p => {
        if (typeof isInjured === 'function' ? isInjured(p) : p.injuryWeeks > 0) return;
        const rf = (typeof verletzungsRisikoFaktor === 'function') ? verletzungsRisikoFaktor(p) : 1;
        if (Math.random() < risk * rf) {
          const weeks = 1 + Math.floor(Math.random() * (status === 'matchfree' ? 4 : 2));
          p.injuryWeeks = weeks;
          p.injuryType = 'Überlastung';
          if (typeof addNews === 'function') {
            const name = ((p.firstName || '') + ' ' + p.name).trim();
            addNews('squad', `🤕 Intensivtraining-Verletzung: ${p.name}`,
              `${name} zog sich beim Intensivtraining eine Verletzung zu und fällt ${weeks} Woche${weeks > 1 ? 'n' : ''} aus.`);
          }
        }
      });
    }

    // Entwicklungs- und Abbau-Pass
    const focWeights = {
      ausgewogen: { def: 1,   mid: 1,   att: 1,   pace: 0.5 },
      defensive:  { def: 2,   mid: 1,   att: 0.5, pace: 0.5 },
      offensive:  { def: 0.5, mid: 1,   att: 2,   pace: 0.7 },
      fitness:    { def: 0.5, mid: 0.5, att: 0.5, pace: 2   },
    };
    const foc = focWeights[t.focus] || focWeights.ausgewogen;

    SQUAD.forEach(p => {
      if (typeof isInjured === 'function' ? isInjured(p) : p.injuryWeeks > 0) return;
      const age    = p.age || 25;
      const ageCfg = getAgeCfg(age);
      const pot    = p.truePotential || (p.ovr + 5);

      // Abbau für Ältere — #4: gute Noten bremsen, schlechte verstärken den Abbau
      let decayChance = ageCfg.decayChance;
      if (decayChance > 0) {
        const f = formAvg(p);
        if (f != null) {
          if (f >= CFG.veteranDecay.goodNote)      decayChance *= CFG.veteranDecay.slowFactor;
          else if (f <= CFG.veteranDecay.badNote)  decayChance *= CFG.veteranDecay.fastFactor;
        }
      }
      if (decayChance > 0 && Math.random() < decayChance) {
        const areas = [['def', p.def], ['mid', p.mid], ['att', p.att], ['pace', p.pace]]
          .filter(([, v]) => (v || 0) > 30)
          .sort((a, b) => a[1] - b[1]);
        if (areas.length) {
          const [attr] = areas[0];
          p[attr] = Math.max(30, (p[attr] || 50) - 1);
          if (typeof computeOvrFromAreas === 'function') p.ovr = computeOvrFromAreas(p);
          if (typeof computeMarketValue  === 'function') p.value = computeMarketValue(p);
        }
      }

      // Entwicklung
      if (ageCfg.devFactor === 0 || p.ovr >= pot) return;

      if (Math.random() > effectiveTickChance(p)) return;

      // #3-Regeneration: Wer durch eine Krise akut Punkte verloren hat (_formScar),
      // holt sie bei guter Form (Form-Ø ≥ Anker) zuerst zurück, bevor er echtes
      // Neuwachstum macht. So ist der Krisen-Malus voll regenerierbar.
      if ((p._formScar || 0) > 0) {
        const f = formAvg(p);
        if (f != null && f >= CFG.form.anchor) {
          // schwächstes der drei Kern-Attribute anheben (heilt die Narbe)
          const areas = [['def', p.def], ['mid', p.mid], ['att', p.att]]
            .sort((a, b) => a[1] - b[1]);
          const [attr] = areas[0];
          p[attr] = Math.min(98, (p[attr] || 50) + 1);
          p._formScar -= 1;
          if (typeof computeOvrFromAreas === 'function') p.ovr = computeOvrFromAreas(p);
          if (typeof computeMarketValue  === 'function') p.value = computeMarketValue(p);
          return; // dieser Tick war Regeneration, kein Neuwachstum
        }
      }

      // Einzeltraining in der Trainingsgruppe (D38) überschreibt den Mannschafts-Schwerpunkt
      const fw = (typeof window.einzelSchwerpunkt === 'function' && window.einzelSchwerpunkt(p)) || foc;
      const candidates = [
        { attr: 'def',  w: fw.def  * (1 + (pot - (p.def  || 50)) / 50) },
        { attr: 'mid',  w: fw.mid  * (1 + (pot - (p.mid  || 50)) / 50) },
        { attr: 'att',  w: fw.att  * (1 + (pot - (p.att  || 50)) / 50) },
        { attr: 'pace', w: fw.pace * (1 + (pot - (p.pace || 50)) / 50) },
      ].filter(c => (p[c.attr] || 0) < 98);
      if (!candidates.length) return;

      const total = candidates.reduce((s, c) => s + c.w, 0);
      let r = Math.random() * total, chosen = candidates[candidates.length - 1];
      for (const c of candidates) { r -= c.w; if (r <= 0) { chosen = c; break; } }

      p[chosen.attr] = Math.min(98, (p[chosen.attr] || 50) + 1);
      if (typeof computeOvrFromAreas === 'function') p.ovr = computeOvrFromAreas(p);
      if (typeof computeMarketValue  === 'function') p.value = computeMarketValue(p);
      if (!t.totalGains[p.id]) t.totalGains[p.id] = 0;
      t.totalGains[p.id]++;
    });
  };

  // ── 3. Dynamisches Potenzial am Saisonende — an Saison-Ø-Note gekoppelt (#2) ─
  //    Aufwärts: junge Spieler mit starker/überragender Saison → Potenzial rauf.
  //    Abwärts:  anhaltend schwache Saison → Potenzial runter (2–4 Punkte),
  //              in einer späteren starken Saison wieder erreichbar.
  const _origSnap = TS.snapshotSquad.bind(TS);
  TS.snapshotSquad = function () {
    // WICHTIG: VOR dem Original lesen — der Saisonübergang könnte matchRatings leeren.
    if (typeof SQUAD !== 'undefined') {
      const c = CFG.potentialBySeason;
      SQUAD.forEach(p => {
        const list = ratingList(p);
        // Zuerst der Sonderfall: junger Spieler ohne Spielpraxis. Er bekommt gar
        // kein Leistungsurteil — aber ein verlorenes Jahr kostet ihn Potenzial.
        if ((p.age || 99) <= c.stagAlter && list.length < c.stagSpiele) {
          if (Math.random() < c.stagChance) {
            const v = c.stagVerlustMin + Math.floor(Math.random() * (c.stagVerlustMax - c.stagVerlustMin + 1));
            const boden = (p.ovr || 50) + 1;
            const neu = Math.max(boden, (p.truePotential || p.ovr) - v);
            if (neu < (p.truePotential || p.ovr)) {
              p.truePotential = neu;
              if (typeof addNews === 'function') {
                const nm = ((p.firstName || '') + ' ' + p.name).trim();
                addNews('squad', `📉 Verlorenes Jahr: ${nm}`,
                  `${nm} (${p.age}J.) kam auf nur ${list.length} Einsätze. Ohne Spielpraxis stagniert die Entwicklung — Potenzial auf ${neu} korrigiert. Mit Einsatzzeit ist das wieder aufholbar.`);
              }
            }
          }
          return;
        }
        if (list.length < c.minGames) return;       // zu wenige Spiele für ein Urteil
        const avg = list.reduce((a, b) => a + b, 0) / list.length;
        const age = p.age || 99;
        const old = p.truePotential || (p.ovr + 5);
        const name = ((p.firstName || '') + ' ' + p.name).trim();

        // ── AUFWÄRTS (jede Altersklasse, aber gestaffelt) ──
        const stufe = c.aufwaerts.find(x => age <= x.bisAlter) || c.aufwaerts[c.aufwaerts.length - 1];
        if (avg >= stufe.note) {
          // Einsatzgewicht: viele Spiele auf dem Niveau wiegen schwerer
          const einsatz = Math.min(1, list.length / c.einsatzVoll);
          let chance = stufe.chance * (c.einsatzMin + (1 - c.einsatzMin) * einsatz);
          if (old > c.bremseAb) {
            chance *= Math.max(c.bremseMin, 1 - (old - c.bremseAb) * c.bremseProPunkt);
          }
          if (Math.random() < chance) {
            const gain = stufe.min + Math.floor(Math.random() * (stufe.max - stufe.min + 1));
            const newP = Math.min(98, old + gain);
            if (newP > old) {
              p.truePotential = newP;
              if (typeof addNews === 'function') {
                const wie = age >= 29
                  ? `spielt mit ${age} die beste Saison seiner Laufbahn`
                  : `überzeugte mit einer ${avg >= 8 ? 'überragenden' : 'starken'} Saison`;
                addNews('squad', `🌟 Potenzial-Revision: ${name}`,
                  `${name} (${age}J.) ${wie} (Ø ${avg.toFixed(1).replace('.', ',')} aus ${list.length} Spielen) — Potenzial auf ${newP} revidiert.`);
              }
            }
          }
        }
        // ── ABWÄRTS (alle Altersklassen) ──
        else if (avg <= c.badNote) {
          if (Math.random() < c.downChance) {
            const loss = c.downLossMin + Math.floor(Math.random() * (c.downLossMax - c.downLossMin + 1));
            const floor = (p.ovr || 50) + c.potentialFloor;   // Potenzial bleibt über aktuellem OVR
            const newP = Math.max(floor, old - loss);
            if (newP < old) {
              p.truePotential = newP;
              if (typeof addNews === 'function') {
                addNews('squad', `📉 Potenzial-Revision: ${name}`,
                  `${name} (${age}J.) blieb über die Saison hinweg unter den Erwartungen (Ø ${avg.toFixed(1).replace('.', ',')}) — Potenzial auf ${newP} gesenkt. Eine starke Saison kann das wieder korrigieren.`);
              }
            }
          }
        }
      });
    }
    // Original-Snapshot (speichert Attribut-Stand für Saisonbericht)
    _origSnap();
  };

  // ── 4. renderTrainingTab ───────────────────────────────────────────────────
  TS.renderTrainingTab = function () {
    TS.ensureState();
    const el = document.getElementById('training-content');
    if (!el) return;

    const t       = CLUB.training;
    const facLvl  = (CLUB.facilities && CLUB.facilities.training) || 1;
    const status  = weekStatus();
    const intCfg  = {
      leicht:   { label: 'Leicht',   tickChance: 0.08, moralBonus:  2, always: true  },
      normal:   { label: 'Normal',   tickChance: 0.14, moralBonus:  0, always: true  },
      intensiv: { label: 'Intensiv', tickChance: 0.22, moralBonus: -4, always: false },
    };
    const focCfg  = { ausgewogen: 'Ausgewogen', defensive: 'Defensive', offensive: 'Offensive', fitness: 'Fitness' };
    const log         = t.weekLog || [];
    const totalTicks  = log.reduce((s, w) => s + w.gains, 0);
    const avgPerWeek  = log.length ? (totalTicks / log.length).toFixed(1) : '0';
    const intensivOk  = status === 'preseason' || status === 'matchfree';
    const facBonus    = Math.round(((1 + ((facLvl - 1) / 9) * CFG.facilityMaxBonus) - 1) * 100);

    // Info-Banner wenn Intensiv gerade gesperrt wurde
    const blockedBanner = t._intensivBlocked
      ? `<div style="background:#5a2d0c;border:1px solid #e09637;border-radius:7px;padding:9px 12px;margin-bottom:10px;font-size:11px;color:#e09637">
          ⚠️ <b>Intensivtraining gesperrt:</b> Nur in der Vorbereitung oder spielfreien Wochen erlaubt.
          Training wurde automatisch auf <b>Normal</b> zurückgesetzt.
          <button onclick="CLUB.training._intensivBlocked=false; TrainingSystem.renderTrainingTab();"
            style="float:right;background:none;border:none;color:#e09637;cursor:pointer;font-size:11px">✕</button>
        </div>`
      : '';
    t._intensivBlocked = false; // einmalig anzeigen

    // Hinweis wenn Intensiv gerade verfügbar ist
    const intensivHint = intensivOk
      ? `<div style="background:#0d2a1a;border:1px solid var(--green,#3fb950);border-radius:7px;padding:7px 12px;margin-bottom:10px;font-size:11px;color:var(--green,#3fb950)">
          ✅ <b>${status === 'preseason' ? 'Vorbereitung' : 'Spielfreie Woche'}:</b>
          Intensivtraining verfügbar — erhöhtes Verletzungsrisiko beachten
          (${status === 'preseason' ? '1.2%' : '2.0%'}/Spieler/Woche).
        </div>`
      : '';

    // Spieler-Karten
    let playerRows = '';
    if (typeof SQUAD !== 'undefined') {
      SQUAD.slice().sort((a, b) => (b.ovr || 0) - (a.ovr || 0)).forEach(p => {
        const age   = p.age || 25;
        const pot   = potAnzeige(p);
        const speed = devSpeedLabel(p);
        const snap  = t.seasonSnapshot && t.seasonSnapshot[p.id];
        const delta = snap ? (p.ovr - snap.ovr) : 0;

        const potMin        = Math.max(40, pot - 20);
        const potPct        = pot > potMin ? Math.round(((p.ovr - potMin) / (pot - potMin)) * 100) : 100;
        const potPctClamped = Math.max(2, Math.min(100, potPct));

        const recentSum = (p._recentApps || []).reduce((s, v) => s + v, 0);
        const recentLen = (p._recentApps || []).length;
        const ptPct     = recentLen ? Math.round((recentSum / 5) * 100) : null;
        const ptBar     = recentLen === 5
          ? '■'.repeat(recentSum) + '□'.repeat(5 - recentSum)
          : recentLen > 0 ? '■'.repeat(recentSum) + '□'.repeat(recentLen - recentSum) : '—';
        const ptColor   = ptPct === null ? 'var(--text3,#6e7681)'
          : ptPct >= 80 ? 'var(--green,#3fb950)'
          : ptPct >= 60 ? '#58a6ff'
          : ptPct >= 40 ? '#e09637'
          : 'var(--text3,#6e7681)';

        // Form-Indikator: Ø der letzten Spiele + Multiplikator-Wirkung
        const fAvg = formAvg(p);
        const fMul = formMultiplier(p);
        const formColor = (typeof window.ratingColor === 'function') ? window.ratingColor(fAvg) : 'var(--text2,#8b949e)';
        const inCrisis = hasStreak(p, CFG.streak.coldCount, CFG.streak.coldNote, 'cold');
        const onFire   = hasStreak(p, CFG.streak.hotCount, CFG.streak.hotNote, 'hot');
        const scar     = p._formScar || 0;
        const formBadge = fAvg == null
          ? `<span style="font-size:10px;color:var(--text3,#6e7681)" title="Noch zu wenige Spiele für eine Form-Wertung">Ø –</span>`
          : `<span style="font-size:10px;color:${formColor};font-weight:700" title="Form-Ø letzte Spiele · Entwicklung ×${fMul.toFixed(2).replace('.', ',')}${scar>0?` · ${scar} Punkt(e) durch Krise verloren, bei guter Form aufholbar`:''}">${onFire?'🔥':inCrisis?'❄️':''}Ø ${fAvg.toFixed(1).replace('.', ',')} ×${fMul.toFixed(2).replace('.', ',')}</span>`;

        const barColor = speed.decay ? 'var(--red,#f85149)'
          : p.ovr >= pot ? 'var(--text3,#6e7681)'
          : age <= 22    ? 'var(--green,#3fb950)'
          : age <= 25    ? '#58a6ff'
          : age <= 29    ? 'var(--text2,#8b949e)'
          : '#e09637';

        const deltaHtml = delta > 0
          ? `<span style="color:var(--green,#3fb950);font-size:10px;font-weight:700">+${delta}</span>`
          : delta < 0
          ? `<span style="color:var(--red,#f85149);font-size:10px;font-weight:700">${delta}</span>`
          : '';
        const injBadge = (typeof isInjured === 'function' ? isInjured(p) : p.injuryWeeks > 0)
          ? `<span style="color:var(--red,#f85149);font-size:9px;margin-left:3px"><i class="ti ti-bandage"></i>${p.injuryWeeks}W</span>`
          : '';

        playerRows += `
          <div style="padding:9px 12px;border-bottom:1px solid var(--border,#30363d)">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <div style="display:flex;align-items:center;gap:5px;min-width:0;overflow:hidden">
                <span style="font-size:10px;color:var(--text3,#6e7681);flex-shrink:0">${p.pos||'?'}</span>
                <span style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                  ${p.flag ? p.flag + ' ' : ''}${((p.firstName || '') + ' ' + p.name).trim()}${injBadge}
                </span>
                <span style="font-size:10px;color:var(--text3,#6e7681);flex-shrink:0">${age}J.</span>
              </div>
              <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;margin-left:8px">
                <span style="font-size:10px;color:${ptColor};letter-spacing:1px" title="Letzte 5 Spiele">${ptBar}</span>
                ${formBadge}
                ${deltaHtml}
                <span style="font-size:13px;font-weight:700">${p.ovr}</span>
                <span style="font-size:10px;color:var(--text3,#6e7681)">→${pot}</span>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">
              <div style="flex:1;background:var(--bg,#0d1117);border-radius:3px;height:5px;overflow:hidden">
                <div style="width:${potPctClamped}%;height:100%;background:${barColor};border-radius:3px;transition:width .4s"></div>
              </div>
              <span style="font-size:10px;color:${speed.color};white-space:nowrap;flex-shrink:0">${speed.icon} ${speed.label}</span>
            </div>
            <div style="display:flex;gap:4px">
              ${['def','mid','att','pace'].map(a => {
                const v = p[a] || 0;
                return `<div style="flex:1;font-size:9px;color:var(--text3,#6e7681)">
                  <div style="background:var(--bg,#0d1117);border-radius:2px;height:3px;margin-bottom:1px">
                    <div style="width:${v}%;height:100%;background:var(--text3,#6e7681);border-radius:2px;opacity:.5"></div>
                  </div>${a.toUpperCase()} ${v}
                </div>`;
              }).join('')}
            </div>
          </div>`;
      });
    }

    el.innerHTML = `
      <div style="padding:14px 14px 0;max-width:640px">
        <h2 style="font-size:14px;font-weight:700;margin:0 0 12px">🏋️ Trainingssteuerung</h2>

        ${blockedBanner}
        ${intensivHint}

        <!-- Intensität -->
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
          ${Object.entries(intCfg).map(([k, v]) => {
            const locked = k === 'intensiv' && !intensivOk;
            return `<button
              onclick="${locked ? `alert('Intensivtraining ist nur in der Vorbereitung oder spielfreien Wochen verfügbar.')` : `CLUB.training.intensity='${k}'; TrainingSystem.renderTrainingTab();`}"
              style="flex:1;min-width:80px;padding:7px 8px;border-radius:7px;font-size:11px;font-weight:600;cursor:${locked ? 'not-allowed' : 'pointer'};
                     opacity:${locked ? '0.45' : '1'};
                     border:2px solid ${t.intensity===k ? 'var(--accent,#238636)' : 'var(--border,#30363d)'};
                     background:${t.intensity===k ? 'var(--accent,#238636)' : 'var(--bg3,#21262d)'};
                     color:${t.intensity===k ? '#fff' : 'var(--text2,#8b949e)'}">
              ${locked ? '🔒 ' : ''}${v.label}
              <span style="display:block;font-size:9px;font-weight:400;opacity:.8">
                ×${CFG.intensityScale[k].toFixed(2).replace('.', ',')} Entwicklung${locked ? ' — gesperrt' : ''}
              </span>
            </button>`;
          }).join('')}
        </div>

        <!-- Fokus -->
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
          ${Object.entries(focCfg).map(([k, v]) => `
            <button onclick="CLUB.training.focus='${k}'; TrainingSystem.renderTrainingTab();"
              style="flex:1;min-width:80px;padding:6px 8px;border-radius:7px;font-size:11px;font-weight:600;cursor:pointer;
                     border:2px solid ${t.focus===k ? 'var(--accent,#238636)' : 'var(--border,#30363d)'};
                     background:${t.focus===k ? 'var(--accent,#238636)' : 'var(--bg3,#21262d)'};
                     color:${t.focus===k ? '#fff' : 'var(--text2,#8b949e)'}">
              ${v}
            </button>`).join('')}
        </div>

        <!-- Stats -->
        <div style="background:var(--bg3,#21262d);border-radius:8px;padding:10px 12px;margin-bottom:12px;font-size:11px;display:flex;gap:14px;flex-wrap:wrap;align-items:center">
          <div><span style="color:var(--text3,#6e7681)">Gelände</span><br><b>Stufe ${facLvl} (+${facBonus}% Entwicklung)</b></div>
          <div><span style="color:var(--text3,#6e7681)">Ø Fortschritte</span><br><b>${avgPerWeek}/Woche</b></div>
          <div style="font-size:10px;color:var(--text3,#6e7681);margin-left:auto;line-height:1.7">■■■■■ letzte 5 Spiele · 🔥 Lauf · ❄️ Krise</div>
        </div>

        <h3 style="font-size:11px;font-weight:700;color:var(--text3,#6e7681);text-transform:uppercase;letter-spacing:.5px;margin:0 0 6px">
          📊 Spieler-Entwicklung
        </h3>
      </div>

      <div style="overflow-y:auto;border:1px solid var(--border,#30363d);border-radius:8px;margin:0 14px 14px">
        ${playerRows || '<div style="padding:16px;font-size:12px;color:var(--text3)">Keine Spieler im Kader.</div>'}
      </div>`;
  };

  console.log('[DevPatch v4] aktiv — Form-Faktor ×0,6–1,35, Potenzial-Revision (Note), Serien-Events 🔥/❄️, Veteranen-Abbau notenabhängig');
})();


/* ---------- js/price_balance_patch.js ---------- */
/* ===== price_balance_patch.js ===== */
/* ═══════════════════════════════════════════════════════════════════════════
   PREIS-BALANCE-PATCH  ·  v3 — Altersabhängige Marktwert-Skalierung + Generationstalent
   ─────────────────────────────────────────────────────────────────────────
   Laden NACH allen anderen Skripten (letztes Script, nach transfer_youth_patches.js).

   Logik:
     Schritt 1 — Grundverdopplung (×2.0) für alle Spieler: Basispreise generell anheben.
     Schritt 2 — Alters-Multiplikator ON TOP:
       ≤ 23  Nachwuchs/Talent  × 2.0  → eff. ×4.0  vom Rohwert
       24–29 Prime             × 1.4  → eff. ×2.8
       30–32 Routinier         × 0.7  → eff. ×1.4
       ≥ 33  Veteran           × 0.4  → eff. ×0.8
     Schritt 3 — Generationstalent-Bonus (truePotential ≥ 88): × 2.0 zusätzlich
       → Nachwuchs-Generationstalent: ×4.0 × 2.0 = eff. ×8.0 vom Rohwert
       → Prime-Generationstalent:     ×2.8 × 2.0 = eff. ×5.6 vom Rohwert

   Einnahmen (Tickets, Sponsoren, Budget) bleiben bei ×1.4 — unverändert zu v1.

   Gehälter (weeklyWageFor):
     30–32: Routinier-Aufschlag  ×1.10 → ×1.30  (+18%)
     33+:   Veteran-Aufschlag    ×1.20 → ×1.60  (+33%)
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {

  // ── STELLSCHRAUBEN ───────────────────────────────────────────────────────
  const BASE_FACTOR  = 2.0;   // Grundverdopplung für alle Spieler
  const INCOME_FACTOR = 1.4;  // Ticket, Sponsoren, Banner, Budget (unverändert)

  // Generationstalent: truePotential ab diesem Wert → Wert nochmal verdoppelt
  const GENERATIONAL_POTENTIAL_THRESHOLD = 88;
  const GENERATIONAL_FACTOR = 2.0;

  // Alters-Multiplikatoren (werden auf BASE_FACTOR × Rohwert angewendet)
  const AGE_FACTORS = [
    { maxAge: 23, factor: 2.0, label: 'Nachwuchs' },  // eff. ×4.0
    { maxAge: 29, factor: 1.4, label: 'Prime'     },  // eff. ×2.8
    { maxAge: 32, factor: 0.7, label: 'Routinier' },  // eff. ×1.4
    { maxAge: 99, factor: 0.4, label: 'Veteran'   },  // eff. ×0.8
  ];

  function ageMvFactor(age) {
    const a = age || 24;
    for (const entry of AGE_FACTORS) {
      if (a <= entry.maxAge) return entry.factor;
    }
    return AGE_FACTORS[AGE_FACTORS.length - 1].factor;
  }

  // ── 1. MARKTWERT: GRUNDVERDOPPLUNG + ALTERS-FAKTOR ───────────────────────
  // Greift nach allen anderen Patches (inkl. eventueller früherer computeMarketValue-Wraps).
  // Ersetzt das pauschale ×2.0 durch das altersabhängige Schema.
  const _origComputeMV = window.computeMarketValue;
  if (typeof _origComputeMV === 'function') {
    window.computeMarketValue = function (player) {
      const raw = _origComputeMV(player);   // Rohwert aus Engine (inkl. Potenzial, Pos etc.)
      const age = player && (player.age || 24);
      const tp  = player && (player.truePotential || player.ovr || 0);
      const isGenerational = tp >= GENERATIONAL_POTENTIAL_THRESHOLD;
      const mv  = raw * BASE_FACTOR * ageMvFactor(age) * (isGenerational ? GENERATIONAL_FACTOR : 1);
      return roundMarketValue(mv);
    };
    try { computeMarketValue = window.computeMarketValue; } catch (e) {}
    console.log('[PriceBalance v3] computeMarketValue: ×' + BASE_FACTOR + ' Basis + Alters-Faktor + Generationstalent ≥' + GENERATIONAL_POTENTIAL_THRESHOLD + ' ×' + GENERATIONAL_FACTOR + ' aktiv');
  } else {
    console.warn('[PriceBalance v3] computeMarketValue nicht gefunden — Preis-Patch inaktiv');
  }

  // ── 2. GEHALT: ROUTINIER & VETERAN TEURER ────────────────────────────────
  // weeklyWageFor in engine_main.js hat Alters-Faktoren. Wir patchen sie heraus
  // und setzen höhere Werte für 30+. Der Rest (Potenzial-Aufschlag, Pos-Faktor etc.)
  // bleibt unberührt.
  const _origWageFor = window.weeklyWageFor;
  if (typeof _origWageFor === 'function') {
    window.weeklyWageFor = function (player) {
      const base = _origWageFor(player);  // bereits mit alten Alters-Aufschlägen (×1.10 / ×1.20)
      const age  = player && (player.age || 24);

      // Korrektur-Faktoren: Original hatte ×1.10 für 30–32 und ×1.20 für 33+.
      // Wir wollen ×1.30 (30–32) und ×1.60 (33+), also:
      //   30–32: base enthält bereits ×1.10  → Korrekturfaktor = 1.30 / 1.10 ≈ 1.182
      //   33+:   base enthält bereits ×1.20  → Korrekturfaktor = 1.60 / 1.20 ≈ 1.333
      // (Unter 30 ändert sich nichts — kein Korrekturfaktor nötig)
      if (age >= 33) return roundWage(base * (1.60 / 1.20));
      if (age >= 30) return roundWage(base * (1.30 / 1.10));
      return base;
    };
    try { weeklyWageFor = window.weeklyWageFor; } catch (e) {}
    console.log('[PriceBalance v3] weeklyWageFor gepatcht — Routinier ×1.30, Veteran ×1.60');
  }

  // ── 3. START-/AUFSTIEGS-BUDGET MODERAT ANHEBEN ───────────────────────────
  const _origDefaultBudget = window.defaultBudgetForTier;
  if (typeof _origDefaultBudget === 'function') {
    window.defaultBudgetForTier = function (tierKey) {
      return Math.round(_origDefaultBudget(tierKey) * INCOME_FACTOR);
    };
    try { defaultBudgetForTier = window.defaultBudgetForTier; } catch (e) {}
    console.log('[PriceBalance v3] defaultBudgetForTier ×' + INCOME_FACTOR);
  }

  // ── 4. TICKET-PREISE MODERAT ANHEBEN ─────────────────────────────────────
  if (typeof TICKET_PRICING === 'object') {
    Object.keys(TICKET_PRICING).forEach(tier => {
      const t = TICKET_PRICING[tier];
      t.ticket = t.ticket.map(v => Math.round(v * INCOME_FACTOR));
      t.season = t.season.map(v => Math.round(v * INCOME_FACTOR));
    });
    console.log('[PriceBalance v3] TICKET_PRICING ×' + INCOME_FACTOR);
  }

  // ── 5. BANNERWERBUNG MODERAT ANHEBEN ─────────────────────────────────────
  if (typeof BANNER_VALUE_PER_TIER === 'object') {
    Object.keys(BANNER_VALUE_PER_TIER).forEach(tier => {
      BANNER_VALUE_PER_TIER[tier] = Math.round(BANNER_VALUE_PER_TIER[tier] * INCOME_FACTOR);
    });
    console.log('[PriceBalance v3] BANNER_VALUE_PER_TIER ×' + INCOME_FACTOR);
  }

  // ── 6. SPONSOREN-BASISWERTE MODERAT ANHEBEN ──────────────────────────────
  if (typeof TIER_SPONSOR_BASE === 'object') {
    Object.keys(TIER_SPONSOR_BASE).forEach(tier => {
      const s = TIER_SPONSOR_BASE[tier];
      s.shirt   = Math.round(s.shirt   * INCOME_FACTOR);
      s.stadium = Math.round(s.stadium * INCOME_FACTOR);
    });
    console.log('[PriceBalance v3] TIER_SPONSOR_BASE ×' + INCOME_FACTOR);
  }

  // ── 7. BESTEHENDE KADERWERTE NEU BERECHNEN ───────────────────────────────
  // Aktualisiert alle .value- und .wage-Felder im geladenen Spielstand.
  // DFL: Gehälter sind Vertragsgehälter (Cap) und dürfen beim Laden nicht neu berechnet werden.
  const dflVertraege = typeof CLUB !== 'undefined' && CLUB && CLUB.dfl && CLUB.dfl.aktiv;
  if (typeof SQUAD !== 'undefined' && Array.isArray(SQUAD)) {
    SQUAD.forEach(p => {
      p.value = computeMarketValue(p);
      if (!dflVertraege) p.wage = typeof weeklyWageFor === 'function' ? weeklyWageFor(p) : p.wage;
    });
    console.log('[PriceBalance v3] SQUAD neu berechnet (' + SQUAD.length + ' Spieler) — Werte & Gehälter');
  }

  // ── Debug-Tabelle in der Konsole ─────────────────────────────────────────
  console.log(
    '[PriceBalance v3] Effektive Gesamt-Faktoren:\n' +
    '  ≤23 Nachwuchs              : ×' + (BASE_FACTOR * 2.0).toFixed(1) + ' (vom Rohwert)\n' +
    '  ≤23 Nachwuchs Generationstalent (Pot≥88): ×' + (BASE_FACTOR * 2.0 * GENERATIONAL_FACTOR).toFixed(1) + '\n' +
    '  24–29 Prime                : ×' + (BASE_FACTOR * 1.4).toFixed(1) + '\n' +
    '  24–29 Prime Generationstalent (Pot≥88): ×' + (BASE_FACTOR * 1.4 * GENERATIONAL_FACTOR).toFixed(1) + '\n' +
    '  30–32 Routinier            : ×' + (BASE_FACTOR * 0.7).toFixed(1) + '\n' +
    '  ≥33 Veteran                : ×' + (BASE_FACTOR * 0.4).toFixed(1) + '\n' +
    '  Einnahmen/Budget           : ×' + INCOME_FACTOR
  );

})();


/* ---------- js/real_market_and_career_patch.js ---------- */
/* ===== real_market_and_career_patch.js ===== */
/* ═══════════════════════════════════════════════════════════════════════════
   VERTRAGSLÄNGE & KARRIEREENDE  ·  v2
   ─────────────────────────────────────────────────────────────────────────
   1) VERTRAGSLÄNGE KOSTET MEHR GEHALT: längere Laufzeit = höheres Wochengehalt.
   2) KARRIEREENDE AB 33: Rücktritte am Saisonende, mit 40 sind praktisch alle weg.
   Der Markt mit echten Spielern und die Geldgebote anderer Vereine sind in der
   DFL entfernt (D36): neue Spieler nur über Draft, Free Agency und Trades.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {

  const CFG = {
    // (3) Vertragslänge → Gehaltsaufschlag
    contract: {
      // Aufschlag aufs Wochengehalt je Vertragsjahr ÜBER 1 Jahr hinaus.
      // 1 Jahr = +0%, 2 = +6%, 3 = +12%, 4 = +18%, 5 = +24%
      wagePremiumPerExtraYear: 0.06,
    },
    // (4) Karriereende ab 33
    retirement: {
      startAge: 33,
      // Rücktritts-Wahrscheinlichkeit je Alter am Saisonende.
      // Steigt steil an, sodass mit 40 praktisch niemand mehr aktiv ist.
      chanceByAge: {
        33: 0.08, 34: 0.14, 35: 0.22, 36: 0.34, 37: 0.50,
        38: 0.68, 39: 0.85, 40: 0.97
      },
      hardCapAge: 41,   // ab hier 100% Rücktritt (Sicherheitsnetz)
      affectOwnSquad: true,  // auch deine eigenen Spieler treten zurück
    }
  };

  const fmt = (v) => (typeof formatEuro === 'function' ? formatEuro(v) : v + '€');

  // ══════════════════════════════════════════════════════════════════════════
  //  (3) VERTRAGSLÄNGE → GEHALTSAUFSCHLAG
  // ══════════════════════════════════════════════════════════════════════════
  // renewContract(squadId, years) berechnet das Gehalt über minWageDemand(player),
  // das die Vertragslänge NICHT kennt. Wir wrappen es so, dass das geforderte
  // Gehalt mit der Laufzeit steigt.
  //
  // Trick: Wir setzen vor dem Aufruf einen Multiplikator, den unser gewrapptes
  // minWageDemand ausliest. So bleibt die restliche Logik (Budgetprüfung etc.) intakt.
  let _wageLengthMult = 1;
  const _origMinWage = window.minWageDemand;
  if (typeof _origMinWage === 'function') {
    window.minWageDemand = function (player) {
      const base = _origMinWage(player);
      return (typeof roundWage === 'function' ? roundWage(base * _wageLengthMult) : Math.round(base * _wageLengthMult));
    };
    try { minWageDemand = window.minWageDemand; } catch (e) {}

    function lengthMultFor(years) {
      const y = Math.max(1, Math.min((typeof MAX_CONTRACT_YEARS !== 'undefined' ? MAX_CONTRACT_YEARS : 5), years | 0));
      return 1 + (y - 1) * CFG.contract.wagePremiumPerExtraYear;
    }

    const _origRenew = window.renewContract;
    if (typeof _origRenew === 'function') {
      window.renewContract = function (squadId, years) {
        if (years == null) return _origRenew.call(this, squadId, years);
        _wageLengthMult = lengthMultFor(years);
        try { return _origRenew.call(this, squadId, years); }
        finally { _wageLengthMult = 1; }
      };
      try { renewContract = window.renewContract; } catch (e) {}
    }
    console.log('[ContractWage] Vertragslängen-Aufschlag aktiv (+' + Math.round(CFG.contract.wagePremiumPerExtraYear * 100) + '%/Jahr)');
  } else {
    console.warn('[ContractWage] minWageDemand nicht gefunden');
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  (4) KARRIEREENDE AB 33
  // ══════════════════════════════════════════════════════════════════════════
  function retirementChance(age) {
    if (age >= CFG.retirement.hardCapAge) return 1;
    if (age < CFG.retirement.startAge) return 0;
    return CFG.retirement.chanceByAge[age] || 0;
  }

  function processRetirements() {
    if (typeof SQUAD === 'undefined' || !Array.isArray(SQUAD)) return;
    if (!CFG.retirement.affectOwnSquad) return;
    const retired = [];
    for (let i = SQUAD.length - 1; i >= 0; i--) {
      const p = SQUAD[i];
      if (p.onLoanFrom) continue; // reine Leihspieler nicht
      const age = p.age || 0;
      if (age < CFG.retirement.startAge) continue;
      if (Math.random() < retirementChance(age)) {
        // Aufstellung bereinigen, Gehaltsbudget freigeben
        if (typeof clearFromLineup === 'function') clearFromLineup(p.id);
        if (typeof CLUB !== 'undefined') {
          CLUB.wageBudget = Math.min(CLUB.wageCap || 0, (CLUB.wageBudget || 0) + (p.wage || 0));
        }
        retired.push(p);
        SQUAD.splice(i, 1);
      }
    }
    if (retired.length && typeof addNews === 'function') {
      retired.forEach(p => {
        const full = ((p.firstName || '') + ' ' + p.name).trim();
        addNews('club', `🎖️ Karriereende: ${full}`,
          `${full} beendet mit ${p.age} Jahren seine aktive Karriere. Danke für den Einsatz! Das Gehalt (${fmt(p.wage || 0)}/Wo) wird wieder frei.`);
      });
    }
    return retired.length;
  }

  // An den Saisonübergang hängen: startNewSeason() ruft intern
  // applyEndOfSeasonClubEffects(); wir lassen Rücktritte danach laufen.
  const _origStartSeason = window.startNewSeason;
  if (typeof _origStartSeason === 'function') {
    window.startNewSeason = function () {
      const result = _origStartSeason.apply(this, arguments);
      try {
        const n = processRetirements();
        if (n && typeof CLUB !== 'undefined') {
          CLUB.wageBudget = Math.max(0, (CLUB.wageCap || 0) -
            (typeof totalWeeklyWages === 'function' ? totalWeeklyWages(SQUAD) : 0));
        }
      } catch (e) { console.warn('[Retirement] Fehler', e); }
      return result;
    };
    try { startNewSeason = window.startNewSeason; } catch (e) {}
    console.log('[Retirement] an startNewSeason gehängt — Rücktritte ab', CFG.retirement.startAge);
  } else {
    console.warn('[Retirement] startNewSeason nicht gefunden');
  }

  window.RealMarket = { config: CFG, retirementChance };
  console.log('%c[Vertrag+Karriereende v2] geladen.', 'color:#3fb950;font-weight:bold');
})();


/* ---------- js/away_scorers_patch.js ---------- */
/* ===== away_scorers_patch.js ===== */
/* ═══════════════════════════════════════════════════════════════════════════
   GEGNER-TORSCHÜTZEN AUS ECHTEM KADER  ·  v1
   ─────────────────────────────────────────────────────────────────────────
   Laden NACH app_main.js und engine_main.js (am besten als letztes Script,
   nach den anderen Patches).

   Zweck:
     Bisher trifft beim Gegentor nur ein Platzhalter-Name ("awayPlayers[zufall]").
     Dieser Patch wählt den Torschützen (und Vorlagengeber) des Gegners aus dessen
     ECHTEM Kader — positionsgewichtet wie bei deinem Team (Stürmer treffen öfter).

   Voraussetzung:
     Du baust gerade eine zentrale Zuordnung  clubId/Name → Kader.
     Dieser Patch ruft dafür EINE Funktion auf:  resolveAwaySquad(team)
     → Passe NUR den Inhalt von resolveAwaySquad() unten an deine Struktur an.
       Alles andere greift automatisch.

   Was der Patch automatisch erledigt:
     • Beim Spielstart die Gegner-Startelf ermitteln (11 Feldspieler inkl. TW).
     • Beim Gegentor echten Torschützen + Assist wählen (pickScorer/pickAssist).
     • Den Torschützen sauber in G.scorers eintragen (für das Post-Match-Modal),
       jetzt MIT team-Markierung, damit Heim/Gast unterscheidbar bleibt.
     • Optional: Gegentore in die Liga-Torschützenliste einfließen lassen
       (über ein leichtgewichtiges Live-Tor-Register pro Saison).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {

  // ══════════════════════════════════════════════════════════════════════════
  //  ⚙️  HIER ANPASSEN — deine clubId/Name → Kader-Zuordnung
  // ══════════════════════════════════════════════════════════════════════════
  //  Gib für ein Gegner-Team-Objekt das Kader-ARRAY zurück (Liste von Spielern).
  //  Jeder Spieler sollte mindestens { name, pos } haben; ideal zusätzlich
  //  { firstName, positions, ovr, id }. pos/positions[0] steuert die Trefferquote.
  //
  //  Das `team`-Objekt ist dasselbe, das setOpponent(team) bekommt — also der
  //  Eintrag aus der Liga-Gruppe (hat u.a. team.name und team.id).
  //
  //  Beispiele (kommentiert) — wähle/ergänze passend zu deiner Struktur:
  function resolveAwaySquad(team) {
    if (!team) return null;

    // (A) Kader hängt direkt am Team-Objekt:
    //     return team.squad || team.players || team.kader || null;

    // (B) Zentrale Map clubId → Kader (z.B. window.AI_SQUADS):
    //     if (window.AI_SQUADS) {
    //       return window.AI_SQUADS[team.id]
    //           || window.AI_SQUADS[team.clubId]
    //           || window.AI_SQUADS[team.name]
    //           || null;
    //     }

    // (C) Map nach Name, mit Normalisierung (falls Namen leicht abweichen):
    //     if (window.AI_SQUADS) {
    //       const key = normalizeClubKey(team.name);
    //       return window.AI_SQUADS[key] || null;
    //     }

    // ── Standard-Versuch (deckt die häufigsten Fälle ab): ──
    const m = window.AI_SQUADS || window.OPPONENT_SQUADS || window.LEAGUE_SQUADS || null;
    if (m) {
      let hit = m[team.id] || m[team.clubId] || m[team.name] || m[team.dataId] || m[team.dataClubId] || null;
      if (!hit && window.CLUB_NAME_TO_ID && team.name) {
        const cid = window.CLUB_NAME_TO_ID[team.name] || window.CLUB_NAME_TO_ID[(team.name||'').toLowerCase()];
        if (cid) hit = m[cid];
      }
      if (!hit && typeof normalizeClubKey === 'function') hit = m[normalizeClubKey(team.name)];
      if (hit) return hit;
    }
    // Fallback: Kader direkt am Team-Objekt
    return team.squad || team.players || team.kader || null;
  }

  // Optionaler Helfer zur Namens-Normalisierung (falls du Variante C nutzt).
  // Passe die Ersetzungen an deine clubId-Konvention an oder lösche ihn.
  window.normalizeClubKey = window.normalizeClubKey || function (name) {
    if (!name) return '';
    return String(name).toLowerCase()
      .replace(/^\s*(1\.|fc|sc|sv|vfb|vfl|tsg|sg|spvgg)\s+/g, '')
      .replace(/\s+(04|05|07|96|98|1899|1846)\b/g, '')
      .replace(/münchen|munchen/g, '')
      .replace(/[^a-zäöü]/g, '')
      .trim();
  };

  // ── Wie viele Spieler aus dem Kader bilden die "Startelf"? ────────────────
  const STARTING_XI = 11;

  // Positions-Verwandtschaft: wenn kein exakter Spieler für einen Slot da ist,
  // wird in dieser Reihenfolge nach Ersatz gesucht (Hauptpos → verwandte Pos).
  const POS_NEIGHBORS = {
    TW:  ['TW'],
    IV:  ['IV','AV','ZDM'],
    AV:  ['AV','IV','AM','ZDM'],
    ZDM: ['ZDM','ZM','IV','AV'],
    ZM:  ['ZM','ZDM','ZOM','AM'],
    AM:  ['AM','ZM','FL','ZOM'],
    ZOM: ['ZOM','ZM','AM','ST'],
    FL:  ['FL','AM','ST','AV'],
    ST:  ['ST','ZOM','FL'],
  };

  // ── Sollen Gegentore in die Liga-Torschützenliste einfließen? ─────────────
  // true  → echte Gegentore werden pro Saison gezählt und im Torjäger-Tab gezeigt
  //         (zusätzlich zur bestehenden aiScorers-Hochrechnung).
  // false → nur Anzeige im Spiel/Post-Match, keine Liga-Statistik.
  const COUNT_OPPONENT_GOALS_IN_LEAGUE = true;

  // ══════════════════════════════════════════════════════════════════════════
  //  AB HIER: Mechanik — normalerweise nichts mehr anzupassen
  // ══════════════════════════════════════════════════════════════════════════

  // Aktuelle Gegner-Startelf (Spieler-Objekte), parallel zu homeLineupPlayers.
  let awayLineupPlayers = [];
  window.getAwayLineupPlayers = () => awayLineupPlayers;

  // Normalisiert einen rohen Kader-Spieler in ein einheitliches Objekt mit .pos.
  function normalizePlayer(p) {
    if (!p) return null;
    const pos = p.pos || (Array.isArray(p.positions) && p.positions[0]) || 'ZM';
    const full = ((p.firstName ? p.firstName + ' ' : '') + (p.name || p.lastName || '')).trim();
    return {
      id: p.id != null ? p.id : ('ai_' + Math.random().toString(36).slice(2, 9)),
      name: full || p.name || '—',
      pos,
      positions: p.positions || [pos],
      ovr: p.ovr != null ? p.ovr : null,
      _ai: true
    };
  }

  // Liefert die Slot-Liste der Gegner-Formation und je Slot die Zielposition.
  // Nutzt die Engine-Formationen + slotToPos aus dem Taktik-System.
  function awayFormationSlots(team) {
    const T = window.TacticsSystem;
    let formationKey = '4-4-2';
    // Bevorzugt die Formation, die der Gegner ohnehin zugewiesen bekommt.
    if (typeof window.assignOpponentFormation === 'function') {
      try { formationKey = window.assignOpponentFormation(team) || formationKey; } catch (e) {}
    } else if (team && team.formation) {
      formationKey = team.formation;
    }
    const slots = (typeof FORMATIONS !== 'undefined' && FORMATIONS[formationKey])
                ? FORMATIONS[formationKey]
                : (typeof FORMATIONS !== 'undefined' ? FORMATIONS['4-4-2'] : null);
    if (!slots) return { formationKey, list: null };
    // Je Slot die echte Zielposition ableiten (TW/IV/AV/ZDM/ZM/AM/ZOM/FL/ST)
    const list = slots.map(s => ({
      id: s.id,
      pos: (T && typeof T.slotToPos === 'function') ? T.slotToPos(s) : (s.group || 'ZM'),
      x: s.x, y: s.y
    }));
    return { formationKey, list };
  }

  // Ob ein Spieler eine bestimmte Position spielen kann (Haupt- oder Nebenposition).
  function playsPos(player, pos) {
    if (!player) return false;
    if (player.pos === pos) return true;
    return Array.isArray(player.positions) && player.positions.includes(pos);
  }

  // Baut die Gegner-Startelf FORMATIONSGERECHT:
  //   Für jeden Slot wird der beste noch freie Spieler gewählt, der die Position
  //   spielt (exakt → verwandt → bester Rest). OVR entscheidet bei Gleichstand.
  function buildAwayLineup(squad, team) {
    if (!Array.isArray(squad) || !squad.length) return [];
    const pool = squad.map(normalizePlayer).filter(Boolean)
                      .sort((a, b) => (b.ovr || 0) - (a.ovr || 0)); // stärkste zuerst
    const { list: slots } = awayFormationSlots(team);

    // Ohne Formationsinfo: einfacher OVR-Fallback (TW + 10 stärkste)
    if (!slots || !slots.length) {
      const gk = pool.find(p => p.pos === 'TW');
      const others = pool.filter(p => p.pos !== 'TW');
      return gk ? [gk, ...others.slice(0, 10)] : others.slice(0, 11);
    }

    const taken = new Set();
    const lineupBySlot = {};

    // DFL (D95): Plätze mit Seite und dieselbe Zuordnung wie Beste Elf und Engine-Gegner (DFLPosition.zuordnen)
    const Pos = window.DFLPosition;
    if (Pos && Pos.aktiv && Pos.aktiv() && typeof Pos.zuordnen === 'function') {
      try {
        Pos.zuordnen(slots.map(s => Pos.platz(s)), pool).forEach((j, i) => {
          if (j >= 0 && !taken.has(pool[j].id)) { lineupBySlot[slots[i].id] = pool[j]; taken.add(pool[j].id); }
        });
      } catch (e) { /* Ersatz: Suche nach Positionslisten wie bisher */ }
    }

    // Hilfsfunktion: besten freien Spieler für eine Positionsliste finden
    function pickFor(posList) {
      for (const pos of posList) {
        const cand = pool.find(p => !taken.has(p.id) && playsPos(p, pos));
        if (cand) return cand;
      }
      return null;
    }

    // 1) TW-Slots zuerst (wichtigste Sonderposition)
    slots.forEach(slot => {
      if (slot.pos !== 'TW') return;
      const pick = pickFor(['TW']) || pool.find(p => !taken.has(p.id)); // Notnagel
      if (pick) { lineupBySlot[slot.id] = pick; taken.add(pick.id); }
    });

    // 2) Übrige Slots: exakte Position, dann Nachbarpositionen
    slots.forEach(slot => {
      if (slot.pos === 'TW' || lineupBySlot[slot.id]) return;
      const neighbors = POS_NEIGHBORS[slot.pos] || [slot.pos];
      const pick = pickFor(neighbors);
      if (pick) { lineupBySlot[slot.id] = pick; taken.add(pick.id); }
    });

    // 3) Falls Slots leer blieben (Kader unausgewogen): mit bestem Rest auffüllen
    slots.forEach(slot => {
      if (lineupBySlot[slot.id]) return;
      const pick = pool.find(p => !taken.has(p.id));
      if (pick) { lineupBySlot[slot.id] = pick; taken.add(pick.id); }
    });

    // Reihenfolge: TW (Index 0) zuerst, dann in Slot-Reihenfolge — analog homeLineupPlayers.
    const ordered = [];
    const gkSlot = slots.find(s => s.pos === 'TW' && lineupBySlot[s.id]);
    if (gkSlot) ordered.push(lineupBySlot[gkSlot.id]);
    slots.forEach(slot => {
      if (gkSlot && slot.id === gkSlot.id) return;
      if (lineupBySlot[slot.id]) ordered.push(lineupBySlot[slot.id]);
    });
    return ordered.slice(0, STARTING_XI);
  }

  // setOpponent(team) wrappen: Gegner-Startelf laden, sobald der Gegner feststeht.
  const _origSetOpponent = window.setOpponent;
  if (typeof _origSetOpponent === 'function') {
    window.setOpponent = function (team) {
      const r = _origSetOpponent.apply(this, arguments);
      try {
        const squad = resolveAwaySquad(team);
        awayLineupPlayers = buildAwayLineup(squad, team);
        // Für Debug/andere Patches am TEAMS.away ablegen
        if (typeof TEAMS !== 'undefined' && TEAMS.away) {
          TEAMS.away.lineupPlayers = awayLineupPlayers;
          TEAMS.away._team = team;
        }
        if (awayLineupPlayers.length) {
          console.log('[AwayScorers] Gegner-Startelf geladen:', awayLineupPlayers.length, 'Spieler für', team && team.name);
        } else {
          console.log('[AwayScorers] Kein Kader für', team && team.name, '— Platzhalter werden genutzt. resolveAwaySquad() prüfen.');
        }
      } catch (e) {
        console.warn('[AwayScorers] resolveAwaySquad/buildAwayLineup Fehler:', e);
        awayLineupPlayers = [];
      }
      return r;
    };
    try { setOpponent = window.setOpponent; } catch (e) {}
    console.log('[AwayScorers] setOpponent gepatcht');
  } else {
    console.warn('[AwayScorers] setOpponent nicht gefunden — Gegner-Startelf wird nicht geladen');
  }

  // ── Leichtgewichtiges Live-Tor-Register für Gegentore (Liga-Statistik) ────
  // Struktur: LEAGUE._oppGoals[season] = { "Teamname|Spielername": {goals,assists,teamName,name} }
  function registerOpponentGoal(scorerObj, assistObj) {
    if (!COUNT_OPPONENT_GOALS_IN_LEAGUE) return;
    if (typeof LEAGUE === 'undefined' || !LEAGUE) return;
    if (!LEAGUE._oppGoals) LEAGUE._oppGoals = {};
    const season = LEAGUE.season || 1;
    if (!LEAGUE._oppGoals[season]) LEAGUE._oppGoals[season] = {};
    const reg = LEAGUE._oppGoals[season];
    const teamName = (typeof TEAMS !== 'undefined' && TEAMS.away) ? TEAMS.away.name : 'Gegner';
    function bump(obj, isGoal) {
      if (!obj) return;
      const key = teamName + '|' + obj.name;
      if (!reg[key]) reg[key] = { name: obj.name, teamName, goals: 0, assists: 0 };
      if (isGoal) reg[key].goals++; else reg[key].assists++;
    }
    bump(scorerObj, true);
    if (assistObj && assistObj !== scorerObj) bump(assistObj, false);
  }

  // ── scoreGoal wrappen: beim Gegentor echten Torschützen wählen ────────────
  // Wir können scoreGoal nicht teilweise überschreiben, daher ersetzen wir die
  // Funktion und replizieren die Away-Logik mit echtem Scorer. Die Home-Logik
  // delegieren wir ans Original.
  const _origScoreGoal = window.scoreGoal;
  if (typeof _origScoreGoal === 'function' &&
      typeof pickScorer === 'function' && typeof pickAssist === 'function') {

    window.scoreGoal = function (team) {
      // Heim-Tore: Original übernimmt (echte eigene Spieler sind dort schon korrekt)
      if (team === 0) return _origScoreGoal.apply(this, arguments);

      // Kein echter Kader geladen → Original-Verhalten (Platzhalter)
      if (!awayLineupPlayers || !awayLineupPlayers.length) {
        return _origScoreGoal.apply(this, arguments);
      }

      // ── Away-Tor mit echtem Torschützen (repliziert die Engine-Logik) ──
      const wasUpset = (G.momentum > 60);
      if (wasUpset) G.upsets = (G.upsets || 0) + 1;
      G.goalLog = G.goalLog || [];
      G.goalLog.push({ min: G.min, team: 1, momentum: Math.round(G.momentum), upset: wasUpset });

      G.awayGoals++;

      const scorerObj = pickScorer(awayLineupPlayers);
      let assistObj  = pickAssist(awayLineupPlayers, scorerObj);
      const scorer = scorerObj ? scorerObj.name
                   : (typeof awayPlayers !== 'undefined' ? awayPlayers[Math.floor(Math.random() * 10) + 1] : 'Gegner');

      // In G.scorers eintragen (Post-Match-Modal). team:1 = Gast.
      G.scorers = G.scorers || [];
      G.scorers.push({ id: scorerObj ? scorerObj.id : null, name: scorer, min: G.min, team: 1 });

      // Optional: Liga-Torschützenliste
      try { registerOpponentGoal(scorerObj, assistObj); } catch (e) {}

      const assistTxt = assistObj && assistObj !== scorerObj ? ` Vorlage: ${assistObj.name}.` : '';
      if (typeof addEv === 'function') {
        addEv('goal', 1, `Gegentor! ${scorer} trifft für ${TEAMS.away.name}${wasUpset ? ' — völlig gegen den Spielverlauf!' : '.'}${assistTxt}`);
      }
      G.momentum = Math.max(10, G.momentum - 12);

      if (G.homeGoals <= G.awayGoals && G.min > 60) {
        setTimeout(() => {
          if (typeof updateScore === 'function') updateScore();
          if (typeof triggerDecision === 'function') triggerDecision('pressure_goal', 1, scorer);
        }, 400);
        return;
      }

      if (typeof updateScore === 'function') updateScore();
      if (typeof updateUI === 'function') updateUI();
    };
    try { scoreGoal = window.scoreGoal; } catch (e) {}
    console.log('[AwayScorers] scoreGoal gepatcht — Gegentore nutzen echten Kader');
  } else {
    console.warn('[AwayScorers] scoreGoal/pickScorer/pickAssist nicht gefunden — Gegner-Tor-Patch inaktiv');
  }

  // ── buildTopScorers erweitern: echte Gegentore mit aufnehmen ──────────────
  if (COUNT_OPPONENT_GOALS_IN_LEAGUE && typeof window.buildTopScorers === 'function') {
    const _origBuildTop = window.buildTopScorers;
    window.buildTopScorers = function (league, limit) {
      const list = _origBuildTop(league, limit ? limit * 2 : undefined) || [];
      try {
        const season = league ? league.season : 1;
        const reg = league && league._oppGoals && league._oppGoals[season];
        if (reg) {
          // Vorhandene aiScorers-Einträge desselben Teams nicht doppelt zählen:
          // wir fügen unsere echten Gegentore als eigene Einträge hinzu.
          Object.values(reg).forEach(e => {
            if (e.goals > 0 || e.assists > 0) {
              list.push({ name: e.name, teamName: e.teamName, goals: e.goals, assists: e.assists, own: false, _live: true });
            }
          });
          list.sort((a, b) => b.goals - a.goals || b.assists - a.assists);
        }
      } catch (e) { console.warn('[AwayScorers] buildTopScorers-Erweiterung Fehler', e); }
      return limit ? list.slice(0, limit) : list;
    };
    try { buildTopScorers = window.buildTopScorers; } catch (e) {}
    console.log('[AwayScorers] buildTopScorers erweitert — echte Gegentore in der Torschützenliste');
  }

  // ── Öffentliche API ───────────────────────────────────────────────────────
  window.AwayScorers = {
    resolveAwaySquad,            // damit du sie zum Testen aufrufen kannst
    buildAwayLineup,
    getLineup: () => awayLineupPlayers,
    reloadLineup: function () {
      const team = (typeof TEAMS !== 'undefined' && TEAMS.away) ? TEAMS.away._team : null;
      if (team) { awayLineupPlayers = buildAwayLineup(resolveAwaySquad(team), team); }
      return awayLineupPlayers;
    },
    config: { STARTING_XI, COUNT_OPPONENT_GOALS_IN_LEAGUE }
  };

  console.log('%c[AwayScorers v1] geladen.', 'color:#3fb950;font-weight:bold');
  console.log('%cWICHTIG:%c Passe resolveAwaySquad(team) oben an deine clubId/Name→Kader-Zuordnung an. ' +
              'Test im Spiel: AwayScorers.resolveAwaySquad(TEAMS.away._team) sollte ein Kader-Array liefern.',
              'color:#f0883e;font-weight:bold', 'color:inherit');

})();


/* ---------- js/ingame_tactics_patch.js ---------- */
/* ===== ingame_tactics_patch.js ===== */
/* ═══════════════════════════════════════════════════════════════════════════
   TAKTIK IM SPIEL  ·  v1
   ───────────────────────────────────────────────────────────────────────────
   - Taktik-Panel in der Match-Sidebar (links neben der Statistik):
       · Formationswechsel zwischen Haupt- und Seitenformationen (Repertoire)
       · Spielweise-Wahl (risikoarm / ausgeglichen / offensiv) mit
         WAHRSCHEINLICHKEITS-Effekt — kann auch nach hinten losgehen
   - Eingriffe sind nur an 3 Zeitpunkten möglich: 45., 60., 75. Minute.
     Das Fenster ist NICHT blockierend (Spiel läuft weiter), aber jeder
     Zeitpunkt erlaubt nur EINEN Eingriff.
     Ausnahme: Verletzung/Rote Karte (nutzt das bestehende Decision-Overlay).
   - Gegner-Anzeige: Formation + Gesamt-OVR + Startelf-Namen, inkl. Wechsel.
   - Keine konkreten Zahlen mehr in den Entscheidungstexten — der Effekt ist
     nur am Momentum-Balken ablesbar.

   Laden NACH app_main.js, engine_main.js, tactics_ui.js und away_scorers_patch.js
   (eines der letzten Skripte).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // Zeitpunkte, an denen taktische Eingriffe erlaubt sind
  const WINDOWS = [45, 60, 75];

  // Laufzeit-Status für das aktuelle Spiel
  const IT = {
    usedWindows: {},        // { 45:true, ... } — pro Zeitpunkt nur ein Eingriff
    lastOppFormation: null,  // zum Erkennen von Gegnerwechseln
    oppSubDone: false,       // hat der Gegner schon (simuliert) gewechselt?
  };
  window.INGAME_TAC = IT;

  function byId(id) { return document.getElementById(id); }
  function clubShortSafe() { return (typeof clubShort === 'function') ? clubShort() : 'Wir'; }

  // Spielweise-Definitionen. Der Effekt ist wahrscheinlichkeitsbasiert:
  //   p_good = Chance auf den gewünschten Effekt, sonst tritt der Nachteil ein.
  // Es werden bewusst KEINE Zahlen an den Spieler kommuniziert.
  const STYLES = {
    safe: {
      label: '🛡️ Risikoarm',
      desc: 'Kompakter, weniger Risiko. Weniger eigene Chancen — aber der Gegner kommt auch seltener durch.',
      apply(success) {
        if (success) { nudgeMomentum(-3); G.riskLevel = -2; ev('Wir ziehen uns kompakter zurück — Sicherheit zuerst.'); }
        else         { nudgeMomentum(-8); G.riskLevel = -2; ev('Der Rückzug wirkt zu passiv — wir verlieren die Spielkontrolle.'); }
      },
      pGood: 0.78,
    },
    balanced: {
      label: '⚖️ Ausgeglichen',
      desc: 'Geordnetes Spiel ohne große Risiken. Stabil in beide Richtungen.',
      apply(success) {
        if (success) { nudgeMomentum(+3); G.riskLevel = 0; ev('Wir stabilisieren das Spiel und finden unseren Rhythmus.'); }
        else         { nudgeMomentum(-2); G.riskLevel = 0; ev('Die Umstellung braucht Zeit — noch kein klarer Effekt.'); }
      },
      pGood: 0.82,
    },
    offensive: {
      label: '⚔️ Offensiv',
      desc: 'Mehr Druck nach vorne — aber hinten anfälliger für Konter.',
      apply(success) {
        if (success) { nudgeMomentum(+10); G.riskLevel = 1; bumpAttack(+4); ev('Wir erhöhen den Druck — der Gegner kommt unter Stress!'); }
        else         { nudgeMomentum(-4); G.riskLevel = 1; bumpAttack(+4); bumpAwayAttack(+5); ev('Wir öffnen uns zu weit — der Gegner findet Konterräume.'); }
      },
      pGood: 0.6,
    },
    allin: {
      label: '🔥 Volles Risiko',
      desc: 'Alles nach vorne. Große Chance auf Druck — aber hohes Konterrisiko.',
      apply(success) {
        if (success) { nudgeMomentum(+16); G.riskLevel = 2; bumpAttack(+8); ev('Wir werfen alles nach vorne — totale Offensive!'); }
        else         { nudgeMomentum(-6); G.riskLevel = 2; bumpAttack(+6); bumpAwayAttack(+9); ev('Das volle Risiko reißt hinten Lücken — brandgefährlich!'); }
      },
      pGood: 0.5,
    },
  };

  // ── kleine Helfer, die die bestehende Engine respektieren ──────────────────
  function nudgeMomentum(delta) {
    if (typeof G === 'undefined') return;
    G.momentum = Math.max(5, Math.min(95, (G.momentum || 50) + delta));
  }
  function bumpAttack(d)     { if (typeof TEAMS !== 'undefined' && TEAMS.home) TEAMS.home.attack += d; }
  function bumpAwayAttack(d) { if (typeof TEAMS !== 'undefined' && TEAMS.away) TEAMS.away.attack += d; }
  function ev(text) {
    if (typeof addEv === 'function') addEv('info', -1, clubShortSafe() + ': ' + text);
  }
  function logDecision(kind) {
    if (typeof G !== 'undefined' && Array.isArray(G.decisions)) {
      G.decisions.push({ min: G.min, type: kind, momentumBefore: Math.round(G.momentum), momentumAfter: Math.round(G.momentum) });
    }
    if (typeof renderDecisionLog === 'function') renderDecisionLog();
  }

  // Wahrscheinlichkeits-Roll für eine Spielweise
  function applyStyle(key) {
    const st = STYLES[key];
    if (!st) return;
    const success = Math.random() < st.pGood;
    st.apply(success);
    logDecision('style_' + key);
    if (typeof updateUI === 'function') updateUI();
  }

  window.applyIngameStyle = applyStyle;

  // ── FORMATIONSWECHSEL IM SPIEL ─────────────────────────────────────────────
  // Nutzt die bestehende changeFormation (verteilt Spieler positionsgerecht).
  function switchFormationInGame(formation) {
    if (typeof CLUB === 'undefined' || CLUB.formation === formation) return;
    if (typeof changeFormation === 'function') {
      changeFormation(formation);              // verteilt Aufstellung sinnvoll neu
    } else {
      CLUB.formation = formation;
    }
    ev('Formationswechsel auf ' + formation + '.');
    logDecision('formation_' + formation);
    // Ein Formationswechsel wirkt sich leicht aufs Momentum aus (unsicher!)
    const success = Math.random() < 0.7;
    nudgeMomentum(success ? +4 : -3);
    if (typeof updateUI === 'function') updateUI();
    renderIngamePanel();
  }
  window.switchFormationInGame = switchFormationInGame;

  // ── PANEL-RENDERING ────────────────────────────────────────────────────────
  function currentWindow() {
    if (typeof G === 'undefined') return null;
    // Eingriff erlaubt im 2-Minuten-Fenster ab dem Zeitpunkt
    return WINDOWS.find(w => G.min >= w && G.min <= w + 2) || null;
  }

  function renderIngamePanel() {
    const sec = byId('ingame-tac-sec');
    const box = byId('ingame-tac');
    if (!sec || !box) return;

    const running = (typeof G !== 'undefined') && (G.running || G.halfDone) && !G.ended && G.min > 0;
    sec.style.display = running ? 'block' : 'none';
    if (!running) return;

    const win = currentWindow();
    const used = win && IT.usedWindows[win];

    // Repertoire = Hauptformation + bis zu 2 Seitenformationen
    const rep = (CLUB.repertoire && CLUB.repertoire.length)
      ? CLUB.repertoire.slice()
      : [CLUB.formation];
    if (!rep.includes(CLUB.formation)) rep.unshift(CLUB.formation);

    let html = '';

    if (!win) {
      const next = WINDOWS.find(w => w > G.min);
      html += `<div style="margin-bottom:8px;color:var(--text3)">Eingriffe möglich in der 45./60./75. Minute.` +
              (next ? ` Nächstes Fenster: ${next}'.` : '') + `</div>`;
    } else if (used) {
      html += `<div style="margin-bottom:8px;color:var(--text3)">In dieser Minute hast du bereits angepasst. Nächstes Fenster später.</div>`;
    } else {
      html += `<div style="margin-bottom:6px;color:var(--gold);font-weight:700">⏱️ ${win}. Minute — Anpassung möglich</div>`;
    }

    // Formationen
    html += `<div style="margin:6px 0 3px;color:var(--text2);font-weight:600">Formation</div>`;
    html += `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px">`;
    rep.forEach(f => {
      const active = f === CLUB.formation;
      const disabled = !win || used || active;
      html += `<button class="it-btn${active ? ' it-active' : ''}" ${disabled ? 'disabled' : ''} ` +
              `onclick="__itFormation('${f}')">${f}${active ? ' ✓' : ''}</button>`;
    });
    html += `</div>`;

    // Spielweise
    html += `<div style="margin:6px 0 3px;color:var(--text2);font-weight:600">Spielweise</div>`;
    html += `<div style="display:flex;flex-direction:column;gap:4px">`;
    Object.keys(STYLES).forEach(key => {
      const st = STYLES[key];
      const disabled = !win || used;
      html += `<button class="it-style" ${disabled ? 'disabled' : ''} onclick="__itStyle('${key}')" title="${st.desc.replace(/"/g,'')}">` +
              `<span class="it-style-l">${st.label}</span>` +
              `<span class="it-style-d">${st.desc}</span></button>`;
    });
    html += `</div>`;

    box.innerHTML = html;
  }
  window.renderIngamePanel = renderIngamePanel;

  // Wrapper, die nach der Aktion das Fenster als "benutzt" markieren
  window.__itFormation = function (f) {
    const win = currentWindow();
    if (!win || IT.usedWindows[win]) return;
    IT.usedWindows[win] = true;
    switchFormationInGame(f);
    renderIngamePanel();
  };
  window.__itStyle = function (key) {
    const win = currentWindow();
    if (!win || IT.usedWindows[win]) return;
    IT.usedWindows[win] = true;
    applyStyle(key);
    renderIngamePanel();
  };

  // ── AUFSTELLUNGEN VISUELL (eigene + Gegner) ────────────────────────────────
  let lineupViewMode = 'own';   // 'own' | 'opp'
  window.showLineupView = function (mode) {
    lineupViewMode = mode;
    const a = byId('lv-tab-own'), b = byId('lv-tab-opp');
    if (a) a.classList.toggle('active', mode === 'own');
    if (b) b.classList.toggle('active', mode === 'opp');
    renderLineupView();
  };

  function oppOvr() {
    if (typeof TEAMS === 'undefined' || !TEAMS.away) return null;
    const lp = TEAMS.away.lineupPlayers;
    if (Array.isArray(lp) && lp.length) {
      const s = lp.reduce((a, p) => a + (p.ovr || 0), 0) / lp.length;
      if (s > 0) return Math.round(s);
    }
    return Math.round(TEAMS.away.str || 0) || null;
  }
  function ownOvr() {
    try {
      const ids = (typeof getLineupIds === 'function') ? getLineupIds() : [];
      const ps = ids.map(getPlayer).filter(Boolean);
      if (!ps.length) return null;
      return Math.round(ps.reduce((a, p) => a + (p.ovr || 0), 0) / ps.length);
    } catch (e) { return null; }
  }
  function oppFormationName() {
    return (typeof MATCH_TAC !== 'undefined' && MATCH_TAC.oppFormation) ? MATCH_TAC.oppFormation : null;
  }

  function shortName(p) {
    if (!p) return '';
    const fn = p.firstName ? p.firstName[0] + '. ' : '';
    return fn + (p.name || '');
  }

  // Zeichnet eine Aufstellung auf die Mini-Pitch.
  //  slots:   Array aus FORMATIONS[...] (mit x,y,label/group)
  //  players: paralleles Array (gleiche Reihenfolge wie slots) oder null
  //  opp:     true → rote Tokens + Feld gespiegelt (Gegner greift "nach unten" an)
  function paintPitch(slots, players, opp) {
    const pitch = byId('mini-pitch');
    if (!pitch || !slots) return;
    pitch.querySelectorAll('.p-slot').forEach(el => el.remove());
    slots.forEach((slot, i) => {
      const p = players ? players[i] : null;
      // Gegner spiegeln: y → 100 - y (Tor unten/oben tauschen)
      const x = opp ? (100 - slot.x) : slot.x;
      const y = opp ? (100 - slot.y) : slot.y;
      // DFL (D95): Platz mit Seite aus der Lage (LV/RV, LM/RM, LF/RF), sonst die Rolle des Basisspiels
      const posLabel = (window.DFLPosition && DFLPosition.aktiv && DFLPosition.aktiv()) ? DFLPosition.platz(slot)
        : (window.TacticsSystem && typeof TacticsSystem.slotToPos === 'function')
        ? TacticsSystem.slotToPos(slot) : (slot.label || slot.group || '');
      const div = document.createElement('div');
      div.className = 'p-slot';
      div.style.left = x + '%';
      div.style.top = y + '%';
      const nm = p ? shortName(p) : posLabel;
      const ovr = p && p.ovr ? `<div class="p-ovr">${p.ovr}</div>` : '';
      div.innerHTML =
        `<div class="p-token ${opp ? 'opp' : ''}">${posLabel}</div>` +
        `<div class="p-name">${nm}</div>` + ovr;
      pitch.appendChild(div);
    });
  }

  function renderOwnPitch() {
    if (typeof CLUB === 'undefined' || typeof FORMATIONS === 'undefined') return;
    const slots = FORMATIONS[CLUB.formation];
    if (!slots) return;
    const players = slots.map(s => {
      const pid = CLUB.lineup ? CLUB.lineup[s.id] : null;
      return pid && typeof getPlayer === 'function' ? getPlayer(pid) : null;
    });
    paintPitch(slots, players, false);
  }

  function renderOppPitch() {
    const form = oppFormationName();
    const slots = (typeof FORMATIONS !== 'undefined' && form && FORMATIONS[form]) ? FORMATIONS[form] : null;
    const lp = (typeof TEAMS !== 'undefined' && TEAMS.away) ? TEAMS.away.lineupPlayers : null;
    if (!slots) { byId('mini-pitch').querySelectorAll('.p-slot').forEach(el => el.remove()); return; }
    // lineupPlayers ist bereits in Slot-Reihenfolge (buildAwayLineup liefert TW zuerst)
    const players = Array.isArray(lp) ? slots.map((s, i) => lp[i] || null) : null;
    paintPitch(slots, players, true);
  }

  function renderLineupView() {
    const sec = byId('lineup-view-sec');
    if (!sec) return;
    const running = (typeof G !== 'undefined') && (G.running || G.halfDone) && !G.ended && G.min > 0;
    sec.style.display = running ? 'block' : 'none';
    // Idle-Platzhalter nur zeigen, wenn (noch) kein Spiel läuft
    const idle = byId('tactics-col-idle');
    if (idle) idle.style.display = running ? 'none' : 'block';
    if (!running) return;

    const meta = byId('lv-meta');
    if (lineupViewMode === 'opp') {
      const revealed = (typeof MATCH_TAC === 'undefined') || MATCH_TAC.oppRevealed || G.min >= (MATCH_TAC.revealMin || 0);
      const name = (typeof TEAMS !== 'undefined' && TEAMS.away) ? (TEAMS.away.name || 'Gegner') : 'Gegner';
      if (!revealed) {
        if (meta) meta.innerHTML = `<b style="color:var(--text)">${name}</b> — Aufstellung wird noch beobachtet …`;
        byId('mini-pitch').querySelectorAll('.p-slot').forEach(el => el.remove());
        return;
      }
      const ovr = oppOvr();
      if (meta) meta.innerHTML = `<b style="color:var(--text)">${name}</b> · ` +
        `Formation <b style="color:var(--gold)">${oppFormationName() || '—'}</b>` +
        (ovr != null ? ` · OVR <b>${ovr}</b>` : '');
      renderOppPitch();
    } else {
      const ovr = ownOvr();
      const name = (typeof clubShort === 'function') ? clubShort() : 'Wir';
      if (meta) meta.innerHTML = `<b style="color:var(--text)">${name}</b> · ` +
        `Formation <b style="color:var(--gold)">${CLUB.formation}</b>` +
        (ovr != null ? ` · OVR <b>${ovr}</b>` : '');
      renderOwnPitch();
    }
  }
  window.renderLineupView = renderLineupView;
  // Rückwärtskompatibler Name (wird an anderer Stelle aufgerufen)
  window.renderOppInfo = renderLineupView;

  // Simulierter Gegnerwechsel: einmal pro Spiel kann der Gegner reagieren,
  // wenn er hinten liegt (drückt) — wird im Feed gemeldet.
  function maybeOpponentSub() {
    if (IT.oppSubDone || typeof G === 'undefined') return;
    if (G.min < 60 || G.min > 78) return;
    const oppBehind = G.awayGoals < G.homeGoals;
    const chance = oppBehind ? 0.06 : 0.02;
    if (Math.random() < chance) {
      IT.oppSubDone = true;
      // Gegner stellt offensiver — leichter Momentum-Push zu seinen Gunsten
      nudgeMomentum(-6);
      bumpAwayAttack(+4);
      // evtl. Formationswechsel des Gegners anzeigen
      const forms = ['4-3-3', '4-2-3-1', '3-5-2', '4-4-2'];
      if (typeof MATCH_TAC !== 'undefined') {
        const cur = MATCH_TAC.oppFormation;
        const next = forms.filter(f => f !== cur)[Math.floor(Math.random() * 3)] || cur;
        MATCH_TAC.oppFormation = next;
        if (typeof updateOppFormationBadge === 'function') updateOppFormationBadge();
        ev2((TEAMS.away.name || 'Der Gegner') + ' stellt offensiver um (' + next + ') und drückt auf den Ausgleich.');
      } else {
        ev2((TEAMS.away.name || 'Der Gegner') + ' wechselt offensiv.');
      }
      renderOppInfo();
    }
  }
  function ev2(text) { if (typeof addEv === 'function') addEv('info', 1, text); }

  // ── EINHÄNGEN IN DIE ENGINE ────────────────────────────────────────────────
  // updateUI umhüllen: Panels mit aktualisieren
  if (typeof window.updateUI === 'function') {
    const _origUpdate = window.updateUI;
    window.updateUI = function () {
      _origUpdate.apply(this, arguments);
      try { renderOppInfo(); renderIngamePanel(); } catch (e) {}
    };
    try { updateUI = window.updateUI; } catch (e) {}
  }

  // processMinute umhüllen: Fenster-Hinweis + Gegnerwechsel
  if (typeof window.processMinute === 'function') {
    const _origMinute = window.processMinute;
    window.processMinute = function () {
      _origMinute.apply(this, arguments);
      try {
        maybeOpponentSub();
        // dezenter Feed-Hinweis genau beim Start eines Fensters
        if (WINDOWS.includes(G.min) && !IT.usedWindows[G.min]) {
          if (typeof addEv === 'function') {
            addEv('info', -1, '⏱️ ' + G.min + '. Minute — taktische Anpassung jetzt möglich (Panel links).');
          }
        }
      } catch (e) {}
    };
    try { processMinute = window.processMinute; } catch (e) {}
  }

  // handleKO umhüllen: bei Anpfiff den In-Game-Status zurücksetzen
  if (typeof window.handleKO === 'function') {
    const _origKO = window.handleKO;
    window.handleKO = function () {
      const r = _origKO.apply(this, arguments);
      try {
        if (G && G.min === 0) {
          IT.usedWindows = {};
          IT.oppSubDone = false;
          IT.lastOppFormation = oppFormationName();
        }
        renderOppInfo(); renderIngamePanel();
      } catch (e) {}
      return r;
    };
    try { handleKO = window.handleKO; } catch (e) {}
  }

  console.log('[IngameTactics] aktiv — Formationswechsel & Spielweise an 45./60./75. Min, Gegner-Info, Ecken-Label');

  window.__ingameTacInit = function () {};
})();


/* ---------- js/postmatch_summary_patch.js ---------- */
/* ===== postmatch_summary_patch.js ===== */
/* ═══════════════════════════════════════════════════════════════════════════
   POST-MATCH-ZUSAMMENFASSUNG+  ·  v1
   ───────────────────────────────────────────────────────────────────────────
   - Startelf-Notenübersicht im Football-Manager-Stil (nach Mannschaftsteilen
     gruppiert: TW / Abwehr / Mittelfeld / Angriff) zusätzlich zur Liste.
   - Medien-Fazit (Kicker / Social / Lokalblatt): erklärt in Worten, WARUM das
     Spiel so ausging — abgeleitet aus Schüssen, Ballbesitz, Zweikämpfen, roten
     Karten und Spielverlauf. Ohne konkrete Prozentzahlen.

   Laden NACH player_ratings_patch.js, postmatch_modal_patch.js und app_main.js.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function byId(id) { return document.getElementById(id); }
  function r1(v) { return Math.round(v * 10) / 10; }

  // ── Mannschaftsteil aus Position ableiten ──────────────────────────────────
  function lineFor(pos) {
    pos = (pos || '').toUpperCase();
    if (pos === 'TW') return 'TW';
    if (['IV', 'AV', 'LV', 'RV'].some(x => pos.includes(x))) return 'ABW';
    if (['ZDM', 'ZM', 'ZOM', 'LM', 'RM', 'AM'].some(x => pos.includes(x))) return 'MIT';
    if (['ST', 'MS', 'FL', 'LA', 'RA'].some(x => pos.includes(x))) return 'ANG';
    return 'MIT';
  }
  const LINE_LABEL = { TW: 'Tor', ABW: 'Abwehr', MIT: 'Mittelfeld', ANG: 'Angriff' };
  const LINE_ORDER = ['TW', 'ABW', 'MIT', 'ANG'];

  // ── Startelf-Noten als Gruppen-Ansicht ─────────────────────────────────────
  function buildLineupRatingsHtml(ratings) {
    if (!ratings || !ratings.length) return '';
    const colFn = (typeof window.ratingColor === 'function') ? window.ratingColor : () => 'var(--text)';

    const groups = { TW: [], ABW: [], MIT: [], ANG: [] };
    ratings.forEach(r => { groups[lineFor(r.pos)].push(r); });

    const teamAvg = r1(ratings.reduce((a, b) => a + b.rating, 0) / ratings.length);

    // Spieler des Spiels = höchste Note
    const motm = ratings.slice().sort((a, b) => b.rating - a.rating)[0];

    let html = `<div class="pm-section" id="pm-lineup-ratings">
      <div class="pm-section-title">Aufstellung &amp; Noten · Ø ${teamAvg.toFixed(1).replace('.', ',')}</div>`;

    if (motm) {
      html += `<div class="pm-motm">⭐ Spieler des Spiels: <b>${motm.name}</b> ` +
              `<span style="color:${colFn(motm.rating)}">${motm.rating.toFixed(1).replace('.', ',')}</span></div>`;
    }

    LINE_ORDER.forEach(line => {
      const arr = groups[line];
      if (!arr.length) return;
      arr.sort((a, b) => b.rating - a.rating);
      html += `<div class="pm-line"><div class="pm-line-label">${LINE_LABEL[line]}</div><div class="pm-line-players">`;
      arr.forEach(r => {
        const col = colFn(r.rating);
        const goals = r.goals ? ' ⚽'.repeat(Math.min(3, r.goals)).trim() : '';
        const ass = r.assists ? ' 🅰️'.repeat(Math.min(3, r.assists)).trim() : '';
        html += `<div class="pm-pl">
          <span class="pm-pl-badge" style="border-color:${col};color:${col}">${r.rating.toFixed(1).replace('.', ',')}</span>
          <span class="pm-pl-name">${r.name}${goals}${ass}</span>
          <span class="pm-pl-pos">${r.pos || ''}</span>
        </div>`;
      });
      html += `</div></div>`;
    });

    html += `</div>`;
    return html;
  }

  // ── MATCH-FAZIT: warum ging das Spiel so aus? ──────────────────────────────
  // Liefert { headline, reasons:[...] } in Worten, ohne Prozentzahlen.
  function buildVerdict() {
    if (typeof G === 'undefined') return null;
    const gf = G.homeGoals, ga = G.awayGoals;
    const win = gf > ga, draw = gf === ga;
    const shots = G.shots || [0, 0];
    const poss = G.poss || [50, 50];
    const duel = G.duelQuote || [50, 50];
    const corners = G.corners || [0, 0];
    const reds = (typeof TEAMS !== 'undefined') ? [TEAMS.home.redCards || 0, TEAMS.away.redCards || 0] : [0, 0];
    const avgMom = (Array.isArray(G.momentumLog) && G.momentumLog.length)
      ? Math.round(G.momentumLog.reduce((a, b) => a + b.value, 0) / G.momentumLog.length) : 50;
    const upsets = G.upsets || 0;

    const reasons = [];

    // Chancenverwertung
    const shotDiff = shots[0] - shots[1];
    if (win && shotDiff < 0) reasons.push('Trotz weniger Abschlüssen die Chancen eiskalt genutzt — Effizienz vor Dominanz.');
    else if (!win && !draw && shotDiff > 2) reasons.push('Viele Abschlüsse, aber zu wenig daraus gemacht — die Chancenverwertung war das Problem.');
    else if (win && shotDiff > 2) reasons.push('Klares Chancenplus, das am Ende auch verdient zum Sieg führte.');

    // Ballbesitz/Spielkontrolle
    if (poss[0] >= 58 && !win) reasons.push('Viel Ballbesitz, aber zu wenig Durchschlagskraft — Kontrolle allein reicht nicht.');
    else if (poss[0] <= 42 && win) reasons.push('Wenig Ball, dafür effektiv über Konter und Umschaltmomente gefährlich.');

    // Zweikämpfe
    if (duel[0] < 45 && !win) reasons.push('In den Zweikämpfen oft zweiter Sieger — die Mannschaft wirkte körperlich unterlegen.');
    else if (duel[0] >= 55 && win) reasons.push('Die Zweikampfstärke bildete das Fundament für den Erfolg.');

    // Rote Karten
    if (reds[0] > 0 && !win) reasons.push('Die Rote Karte hat das Spiel gekippt — in Unterzahl fehlten die Mittel.');
    else if (reds[1] > 0 && win) reasons.push('Die Überzahl nach dem Platzverweis des Gegners wurde konsequent genutzt.');
    else if (reds[0] > 0 && draw) reasons.push('Trotz Unterzahl einen Punkt gerettet — kämpferisch stark.');

    // Momentum-Verlauf
    if (avgMom < 45 && win) reasons.push('Über weite Strecken unter Druck, aber in den entscheidenden Momenten da.');
    else if (avgMom > 58 && !win && !draw) reasons.push('Das Spiel wurde dominiert, doch am Ende fehlte die Belohnung.');

    // Tore gegen den Lauf
    if (upsets > 0 && !win && !draw) reasons.push('Gegentore gegen den Spielverlauf haben den Faden zerrissen.');

    // Fallback, falls nichts Markantes
    if (!reasons.length) {
      if (win) reasons.push('Ein insgesamt ausgeglichenes Spiel, in dem die eigene Mannschaft die wichtigen Szenen für sich entschied.');
      else if (draw) reasons.push('Ein ausgeglichenes Remis ohne klaren Sieger — beide Teams auf Augenhöhe.');
      else reasons.push('Ein enges Spiel, das durch Kleinigkeiten in die falsche Richtung kippte.');
    }

    const headline = win ? 'Warum es zum Sieg reichte'
                   : draw ? 'Warum es beim Remis blieb'
                   : 'Warum das Spiel verloren ging';

    return { headline, reasons: reasons.slice(0, 3) };
  }

  // verdict in die Medien-Feeds einbauen (oben anfügen)
  function injectVerdict() {
    const v = buildVerdict();
    if (!v) return;
    const block = `<div class="media-post pm-verdict">
        <div class="media-author">📋 ${v.headline}</div>
        <ul class="pm-verdict-list">${v.reasons.map(r => `<li>${r}</li>`).join('')}</ul>
      </div>`;

    ['media-kicker', 'media-local', 'media-twitter'].forEach(id => {
      const el = byId(id);
      if (el && !el.querySelector('.pm-verdict')) {
        el.insertAdjacentHTML('afterbegin', block);
      }
    });
  }

  // ── Medien-Reaktionen ins Modal übernehmen ─────────────────────────────────
  // Die Feeds media-twitter/kicker/local werden von buildMedia() im Spieltag
  // befüllt. Wir spiegeln ihren Inhalt ins Modal, damit er nach dem Spiel
  // lesbar bleibt (der Vereinshub-Button kann so bleiben).
  function grabFeed(id) {
    const el = byId(id);
    return el ? el.innerHTML : '';
  }
  function buildModalMedia() {
    const tw = grabFeed('media-twitter');
    const ki = grabFeed('media-kicker');
    const lo = grabFeed('media-local');
    if (!tw && !ki && !lo) return '';   // noch nichts da

    // Verdict zusätzlich oben in jeden Feed (falls noch nicht drin)
    const v = buildVerdict();
    const verdictBlock = v ? `<div class="media-post pm-verdict">
        <div class="media-author">📋 ${v.headline}</div>
        <ul class="pm-verdict-list">${v.reasons.map(r => `<li>${r}</li>`).join('')}</ul>
      </div>` : '';

    return `<div class="pm-section" id="pm-media-section">
      <div class="pm-section-title">Reaktionen</div>
      <div class="pm-media-tabs">
        <button class="pm-media-tab active" data-f="tw" onclick="__pmMediaTab(this,'tw')">𝕏 Social</button>
        <button class="pm-media-tab" data-f="ki" onclick="__pmMediaTab(this,'ki')">📰 Kicker</button>
        <button class="pm-media-tab" data-f="lo" onclick="__pmMediaTab(this,'lo')">🗞 Lokalblatt</button>
      </div>
      <div class="pm-media-feed active" id="pm-mfeed-tw">${verdictBlock}${tw}</div>
      <div class="pm-media-feed" id="pm-mfeed-ki">${verdictBlock}${ki}</div>
      <div class="pm-media-feed" id="pm-mfeed-lo">${verdictBlock}${lo}</div>
    </div>`;
  }

  window.__pmMediaTab = function (btn, which) {
    const sec = byId('pm-media-section');
    if (!sec) return;
    sec.querySelectorAll('.pm-media-tab').forEach(b => b.classList.remove('active'));
    sec.querySelectorAll('.pm-media-feed').forEach(f => f.classList.remove('active'));
    btn.classList.add('active');
    const feed = byId('pm-mfeed-' + which);
    if (feed) feed.classList.add('active');
  };

  function injectModalMedia() {
    const body = byId('pm-body');
    if (!body || byId('pm-media-section')) return;
    const html = buildModalMedia();
    if (!html) return false;
    body.insertAdjacentHTML('beforeend', html);   // unten ans Modal
    return true;
  }

  // ── Modal-Injektion (Gruppen-Noten zusätzlich zur Liste) ───────────────────
  function injectLineupRatings() {
    const body = byId('pm-body');
    if (!body || byId('pm-lineup-ratings')) return;
    const ratings = (typeof G !== 'undefined' && G.lastRatings) ? G.lastRatings
                  : (window.LAST_MATCH_RATINGS || []);
    if (!ratings.length) return;
    const html = buildLineupRatingsHtml(ratings);
    if (!html) return;
    // ganz oben im Body (vor der bestehenden Notenliste/anderen Sektionen)
    body.insertAdjacentHTML('afterbegin', html);
  }

  // ── CSS ────────────────────────────────────────────────────────────────────
  if (!byId('pm-summary-style')) {
    const s = document.createElement('style');
    s.id = 'pm-summary-style';
    s.textContent = `
      .pm-motm{ font-size:12px; margin-bottom:8px; }
      .pm-line{ display:flex; gap:8px; margin-bottom:7px; align-items:flex-start; }
      .pm-line-label{ min-width:64px; font-size:10px; font-weight:700; color:var(--text3,#6e7681);
        text-transform:uppercase; letter-spacing:.4px; padding-top:4px; }
      .pm-line-players{ flex:1; display:flex; flex-direction:column; gap:3px; }
      .pm-pl{ display:flex; align-items:center; gap:8px; background:var(--bg3,#0d1117);
        border-radius:6px; padding:4px 8px; font-size:12px; }
      .pm-pl-badge{ min-width:30px; text-align:center; font-weight:800; font-size:12px;
        border:1.5px solid; border-radius:5px; padding:1px 0; }
      .pm-pl-name{ flex:1; font-weight:600; color:var(--text,#e6edf3); }
      .pm-pl-pos{ font-size:9px; color:var(--text3,#6e7681); font-weight:700; }
      .pm-verdict-list{ margin:6px 0 0; padding-left:16px; font-size:11px; line-height:1.6; color:var(--text2,#c9d1d9); }
      .pm-verdict-list li{ margin-bottom:3px; }
      .pm-media-tabs{ display:flex; gap:4px; margin-bottom:8px; }
      .pm-media-tab{ flex:1; background:var(--bg4,#21262d); color:var(--text2,#c9d1d9);
        border:1px solid var(--border,#30363d); border-radius:6px; padding:5px 0;
        font-size:11px; font-weight:700; cursor:pointer; }
      .pm-media-tab.active{ border-color:var(--gold,#d4af37); color:var(--gold,#d4af37); background:rgba(212,175,55,.12); }
      .pm-media-feed{ display:none; flex-direction:column; gap:6px; }
      .pm-media-feed.active{ display:flex; }
      .pm-media-feed .media-post{ background:var(--bg3,#0d1117); border-radius:6px; padding:8px 10px; font-size:11px; }
      .pm-media-feed .media-author{ font-weight:700; font-size:11px; margin-bottom:3px; color:var(--text,#e6edf3); }
      .pm-media-feed .media-text{ color:var(--text2,#c9d1d9); line-height:1.5; }
      .pm-media-feed .media-meta{ font-size:9px; color:var(--text3,#6e7681); margin-top:3px; }
    `;
    document.head.appendChild(s);
  }

  // ── HOOKS ────────────────────────────────────────────────────────────────
  // Nach Abpfiff: Medien-Verdict anhängen + Modal-Noten injizieren (gepollt,
  // da das Modal nach triggerFulltime asynchron erscheinen kann).
  function watchModal() {
    let tries = 0;
    const iv = setInterval(() => {
      tries++;
      if (byId('pm-body')) {
        injectLineupRatings();   // Modal ist da → Noten rein
        injectModalMedia();      // Medien-Reaktionen ins Modal
      }
      injectVerdict();           // auch die Spieltag-Feeds bekommen das Fazit
      const done = byId('pm-lineup-ratings') && byId('pm-media-section');
      if (done || tries > 60) clearInterval(iv);
    }, 80);
  }

  if (typeof window.triggerFulltime === 'function') {
    const _origFT = window.triggerFulltime;
    window.triggerFulltime = function () {
      const r = _origFT.apply(this, arguments);
      setTimeout(injectVerdict, 30);
      watchModal();
      return r;
    };
    try { triggerFulltime = window.triggerFulltime; } catch (e) {}
  }

  window.PostMatchSummary = { buildVerdict, injectLineupRatings, injectVerdict, injectModalMedia, buildModalMedia };
  console.log('[PostMatchSummary] aktiv — Aufstellungs-Noten + Match-Fazit');
})();