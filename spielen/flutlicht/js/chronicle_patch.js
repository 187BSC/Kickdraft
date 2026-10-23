/* ===== chronicle_patch.js =====
   SAISON-RÜCKBLICK + VEREINSCHRONIK
   ─────────────────────────────────────────────────────────────────────────────
   Macht die vorhandene Tiefe sichtbar: Am Saisonende wird eine Zusammenfassung
   erfasst (Platz, Punkte, Torjäger, Durchbruch, Pokal, Transfers, Zuschauer) und
   dauerhaft in CLUB.chronicle abgelegt. Daraus:
     · Saison-Rückblick als Modal (ersetzt das alte alert() in showSeasonEndSummary)
     · Chronik-Sektion im Verein-Reiter (alle Saisons untereinander)

   WICHTIG: Die Erfassung läuft in einem Wrapper VOR startNewSeason — dort stehen
   Abschlusstabelle, p.stats der Saison und der Trainings-Snapshot noch. Danach
   resettet runEndOfSeason die Tabellen und applyEndOfSeasonClubEffects die Stats.
   Lädt NACH app_main.js.
   ============================================================================= */
(function () {
  'use strict';

  function lbl(s) { try { return (typeof seasonYearLabel === 'function') ? seasonYearLabel(s) : ('Saison ' + s); } catch (e) { return 'Saison ' + s; } }
  function euro(v) { try { return (typeof formatEuro === 'function') ? formatEuro(v) : Math.round(v) + ' €'; } catch (e) { return v + ' €'; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])); }
  function nm(p) { try { return (typeof displayName === 'function') ? displayName(p) : ((p.firstName ? p.firstName + ' ' : '') + p.name); } catch (e) { return p && p.name || '?'; } }

  // ── Saison erfassen (VOR dem Reset aufrufen) ───────────────────────────────
  function captureSeason() {
    if (typeof LEAGUE === 'undefined' || !LEAGUE || typeof CLUB === 'undefined' || !CLUB) return null;
    const season = LEAGUE.season;
    let fg = null, row = null, pos = 0, leagueName = '', tierKey = '';
    try {
      fg = findFcmGroup(LEAGUE);
      leagueName = fg.group.name; tierKey = fg.tierKey;
      const tbl = computeTable(fg.group.teams);
      const idx = tbl.findIndex(t => t.id === 'fcm');
      pos = idx + 1; row = tbl[idx] || null;
    } catch (e) {}

    // Absicherung: Nur echte, gespielte Saisons in die Chronik (verhindert
    // Leer-Einträge, falls startNewSeason auf einer frisch gestarteten Saison läuft).
    if (!row || !row.played) return null;

    const squad = (typeof SQUAD !== 'undefined' && SQUAD) ? SQUAD : [];
    // Torjäger / Vorlagengeber der Saison
    let topScorer = null, topAssist = null;
    squad.forEach(p => {
      const g = (p.stats && p.stats.goals) || 0, a = (p.stats && p.stats.assists) || 0;
      if (g > 0 && (!topScorer || g > topScorer.goals)) topScorer = { name: nm(p), goals: g };
      if (a > 0 && (!topAssist || a > topAssist.assists)) topAssist = { name: nm(p), assists: a };
    });
    // Durchbruch: größter OVR-Zuwachs gegenüber Saisonbeginn
    let breakout = null;
    try {
      const snap = (CLUB.training && CLUB.training.seasonSnapshot) || {};
      squad.forEach(p => {
        const s = snap[p.id];
        if (!s || typeof s.ovr !== 'number') return;
        const gain = (p.ovr || 0) - s.ovr;
        if (gain > 0 && (!breakout || gain > breakout.gain)) breakout = { name: nm(p), gain, from: s.ovr, to: p.ovr };
      });
    } catch (e) {}
    // Pokal
    let cup = 'nicht dabei';
    try {
      if (typeof CUP !== 'undefined' && CUP) {
        if (CUP.winnerId === 'fcm') cup = 'Pokalsieger';
        else if (CUP.fcmEliminatedRound) cup = 'Aus im ' + CUP.fcmEliminatedRound;
        else if (CUP.winnerId) cup = 'ausgeschieden';
      }
    } catch (e) {}
    // Transfers dieser Saison
    let tIn = 0, tOut = 0;
    try {
      (CLUB.transferHistory || []).forEach(t => {
        if (t.season !== season) return;
        if (t.type === 'buy') tIn++; else if (t.type === 'sell') tOut++;
      });
    } catch (e) {}
    // Zuschauerschnitt
    let att = 0;
    try {
      const log = (CLUB._attendanceLog || []).filter(x => x.s === season);
      if (log.length) att = Math.round(log.reduce((a, x) => a + x.a, 0) / log.length);
    } catch (e) {}

    const entry = {
      season, label: lbl(season), leagueName, tierKey, pos,
      played: row ? row.played : 0, w: row ? row.w : 0, d: row ? row.d : 0, l: row ? row.l : 0,
      gf: row ? row.gf : 0, ga: row ? row.ga : 0, pts: row ? row.pts : 0,
      topScorer, topAssist, breakout, cup, tIn, tOut, att, budget: Math.round(CLUB.budget || 0)
    };
    if (!Array.isArray(CLUB.chronicle)) CLUB.chronicle = [];
    CLUB.chronicle.push(entry);
    if (CLUB.chronicle.length > 60) CLUB.chronicle.shift();
    return entry;
  }

  // ── Saison-Rückblick-Modal ─────────────────────────────────────────────────
  function showSeasonRecap(e, result) {
    if (!e) return;
    const up = result && result.fcmWasChampion;
    const tv = result && result.tvMoney && result.tvMoney.amount > 0 ? result.tvMoney : null;
    const stat = (l, v) => `<div class="cr-stat"><div class="cr-stat-v">${v}</div><div class="cr-stat-l">${l}</div></div>`;
    const line = (icon, t) => `<div class="cr-line"><i class="ti ti-${icon}"></i> ${t}</div>`;
    let high = '';
    if (e.topScorer) high += line('target', `<b>Torjäger:</b> ${esc(e.topScorer.name)} — ${e.topScorer.goals} Tore`);
    if (e.topAssist) high += line('users', `<b>Meiste Vorlagen:</b> ${esc(e.topAssist.name)} — ${e.topAssist.assists}`);
    if (e.breakout) high += line('trending-up', `<b>Durchbruch:</b> ${esc(e.breakout.name)} — ${e.breakout.from} → ${e.breakout.to} OVR (+${e.breakout.gain})`);
    high += line('trophy', `<b>Pokal:</b> ${esc(e.cup)}`);
    if (e.att) high += line('friends', `<b>Zuschauerschnitt:</b> ${e.att.toLocaleString('de-DE')}`);
    high += line('refresh', `<b>Transfers:</b> ${e.tIn} Zugänge · ${e.tOut} Abgänge`);
    if (tv) high += line('coin', `<b>TV-Gelder:</b> ${euro(tv.amount)}`);

    const logHtml = (result && result.log && result.log.length)
      ? `<div class="cr-log">${result.log.slice(0, 6).map(l => `<div>${esc(l)}</div>`).join('')}</div>` : '';

    const ov = document.createElement('div');
    ov.className = 'exp-overlay';
    ov.innerHTML = `<div class="exp-dialog cr-dialog">
      <div class="cr-head"><div><div class="cr-kicker">Saison ${esc(e.label)} · ${esc(e.leagueName)}</div>
        <div class="cr-title">Saison-Rückblick</div></div>
        ${up ? '<span class="cr-badge"><i class="ti ti-arrow-up"></i> Aufgestiegen</span>' : ''}</div>
      <div class="cr-stats">
        ${stat('Platz', e.pos || '–')}${stat('Punkte', e.pts)}${stat('Bilanz', e.w + '-' + e.d + '-' + e.l)}${stat('Tore', e.gf + ':' + e.ga)}
      </div>
      <div class="cr-lines">${high}</div>
      ${logHtml}
      <div class="nego-actions" style="margin-top:14px">
        <button class="nego-btn ghost" onclick="openChronicle()">Chronik ansehen</button>
        <button class="nego-btn primary" onclick="__closeSeasonRecap(this)">Weiter</button>
      </div>
    </div>`;
    document.body.appendChild(ov);
  }

  // Rückblick schließen und den Saisonstart-Ablauf fortsetzen. WICHTIG:
  // openPhilosophyChoiceDialog bricht ab, wenn noch ein .exp-overlay offen ist —
  // deshalb wird die Philosophiewahl erst NACH dem Schließen angestoßen.
  window.__closeSeasonRecap = function (btn) {
    try { const ov = btn && btn.closest('.exp-overlay'); if (ov) ov.remove(); } catch (e) {}
    try {
      if (typeof openPhilosophyChoiceDialog === 'function') openPhilosophyChoiceDialog();
      else if (typeof openSponsorChoiceDialog === 'function') openSponsorChoiceDialog();
    } catch (e) { console.warn('[Chronicle] continue', e); }
  };

  // ── Chronik-Overlay ────────────────────────────────────────────────────────
  window.openChronicle = function () {
    const rows = (CLUB && Array.isArray(CLUB.chronicle)) ? CLUB.chronicle.slice().reverse() : [];
    const body = rows.length ? rows.map(e => `<tr>
        <td>${esc(e.label)}</td><td class="cr-lg">${esc(e.leagueName)}</td>
        <td>${e.pos || '–'}</td><td>${e.pts}</td><td>${e.gf}:${e.ga}</td>
        <td>${e.topScorer ? esc(e.topScorer.name) + ' (' + e.topScorer.goals + ')' : '–'}</td>
        <td>${esc(e.cup)}</td></tr>`).join('')
      : `<tr><td colspan="7" style="color:var(--text3)">Noch keine abgeschlossene Saison — die Chronik füllt sich ab dem ersten Saisonende.</td></tr>`;
    const ov = document.createElement('div');
    ov.className = 'exp-overlay';
    ov.addEventListener('click', ev => { if (ev.target === ov) ov.remove(); });
    ov.innerHTML = `<div class="exp-dialog cr-dialog cr-wide">
      <div class="cr-head"><div><div class="cr-kicker">${esc((typeof clubName === 'function') ? clubName() : 'Verein')}</div>
        <div class="cr-title">Vereinschronik</div></div>
        <span class="cr-badge">${rows.length} Saison${rows.length === 1 ? '' : 's'}</span></div>
      <div class="cr-tablewrap"><table class="cr-table">
        <thead><tr><th>Saison</th><th>Liga</th><th>Platz</th><th>Pkt</th><th>Tore</th><th>Torjäger</th><th>Pokal</th></tr></thead>
        <tbody>${body}</tbody></table></div>
      <div class="nego-actions" style="margin-top:12px">
        <button class="nego-btn primary" onclick="this.closest('.exp-overlay').remove()">Schließen</button>
      </div>
    </div>`;
    document.body.appendChild(ov);
  };

  // ── Chronik-Sektion im Verein-Reiter ───────────────────────────────────────
  function mountClubChronicle() {
    const host = document.getElementById('view-club');
    if (!host) return;
    const rows = (CLUB && Array.isArray(CLUB.chronicle)) ? CLUB.chronicle.slice().reverse().slice(0, 5) : [];
    let sec = host.querySelector(':scope > .club-chronicle');
    if (!sec) { sec = document.createElement('div'); sec.className = 'club-chronicle'; host.appendChild(sec); }
    const list = rows.length ? rows.map(e => `<div class="cc-row">
        <span class="cc-season">${esc(e.label)}</span>
        <span class="cc-lg">${esc(e.leagueName)}</span>
        <span class="cc-pos">${e.pos ? e.pos + '.' : '–'}</span>
        <span class="cc-pts">${e.pts} Pkt</span>
        <span class="cc-top">${e.topScorer ? esc(e.topScorer.name) + ' (' + e.topScorer.goals + ')' : '–'}</span>
      </div>`).join('')
      : `<div class="cc-empty">Noch keine abgeschlossene Saison</div>`;
    sec.innerHTML = `<div class="exp-section-title"><i class="ti ti-history"></i> Chronik</div>${list}
      <button class="nego-btn ghost" style="margin-top:8px" onclick="openChronicle()">Ganze Chronik</button>`;
  }

  // ── HOOKS ──────────────────────────────────────────────────────────────────
  // 1) VOR startNewSeason erfassen (Tabelle/Stats stehen dort noch).
  let _lastEntry = null;
  if (typeof window.startNewSeason === 'function') {
    const _orig = window.startNewSeason;
    window.startNewSeason = function () {
      try { _lastEntry = captureSeason(); } catch (e) { console.warn('[Chronicle] capture', e); }
      return _orig.apply(this, arguments);
    };
    try { startNewSeason = window.startNewSeason; } catch (e) {}
  }
  // 2) Saisonende-Anzeige durch den Rückblick ersetzen (war ein alert()).
  if (typeof window.showSeasonEndSummary === 'function') {
    window.showSeasonEndSummary = function (result) {
      try { showSeasonRecap(_lastEntry, result); } catch (e) { console.warn('[Chronicle] recap', e); }
    };
    try { showSeasonEndSummary = window.showSeasonEndSummary; } catch (e) {}
  }
  // 3) Chronik-Sektion im Verein-Reiter mitrendern.
  if (typeof window.renderClubTab === 'function') {
    const _o = window.renderClubTab;
    window.renderClubTab = function () { const r = _o.apply(this, arguments); try { mountClubChronicle(); } catch (e) {} return r; };
  }

  window.Chronicle = { captureSeason, showSeasonRecap };
  console.log('[Chronicle] aktiv — Saison-Rückblick & Vereinschronik');
})();
