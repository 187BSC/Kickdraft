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
  // DFL: kein Pokal, kein Aufstieg – stattdessen das Playoff-Ergebnis (gemäß D36)
  const dfl = () => typeof CLUB !== 'undefined' && CLUB && CLUB.dfl && CLUB.dfl.aktiv;
  const DFL_RUNDE = ['verpasst', 'Aus in der Wildcard-Runde', 'Aus in der Divisional-Runde', 'Aus im Conference-Finale', 'Finale verloren', 'DKL-Meister'];
  function nm(p) { try { return (typeof displayName === 'function') ? displayName(p) : ((p.firstName ? p.firstName + ' ' : '') + p.name); } catch (e) { return p && p.name || '?'; } }

  // ── Saison erfassen (VOR dem Reset aufrufen) ───────────────────────────────
  let _kaderVorher = null;
  function merkeKader() { _kaderVorher = (typeof SQUAD !== 'undefined' && SQUAD) ? SQUAD.slice() : null; }
  function captureSeason() {
    if (typeof LEAGUE === 'undefined' || !LEAGUE || typeof CLUB === 'undefined' || !CLUB) return null;
    const season = LEAGUE.season;
    let fg = null, row = null, pos = 0, leagueName = '', tierKey = '';
    try {
      fg = findFcmGroup(LEAGUE);
      leagueName = fg.group.name === 'DFL' ? 'DKL' : fg.group.name; tierKey = fg.tierKey;
      const tbl = computeTable(fg.group.teams);
      const idx = tbl.findIndex(t => t.id === 'fcm');
      pos = idx + 1; row = tbl[idx] || null;
    } catch (e) {}

    // Absicherung: Nur echte, gespielte Saisons in die Chronik (verhindert
    // Leer-Einträge, falls startNewSeason auf einer frisch gestarteten Saison läuft).
    if (!row || !row.played) return null;

    // Kader der abgelaufenen Saison: dfl_kader_patch.js nimmt auslaufende Verträge vor diesem Erfassen heraus und merkt
    // den Kader vorher (merkeKader) – sonst fehlten Abgänge wie der beste Torschütze im Rückblick (Spieltest 2026-10-13)
    const jetzt = (typeof SQUAD !== 'undefined' && SQUAD) ? SQUAD : [];
    const squad = _kaderVorher ? _kaderVorher.concat(jetzt.filter(p => _kaderVorher.indexOf(p) < 0)) : jetzt;
    _kaderVorher = null;
    // Torjäger / Vorlagengeber der Saison (nur Zahlen dieser Saison)
    let topScorer = null, topAssist = null;
    squad.forEach(p => {
      const st = p.stats && (p.stats.season == null || p.stats.season === season) ? p.stats : null;
      const g = (st && st.goals) || 0, a = (st && st.assists) || 0;
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
      const po = LEAGUE.dflPlayoffs;
      if (dfl()) cup = po && po.saison === season ? DFL_RUNDE[po.meister === 'fcm' ? 5 : (po.eigeneRunde || 0)] || 'verpasst' : 'verpasst';
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
    high += line('trophy', `<b>${dfl() ? 'Playoffs' : 'Pokal'}:</b> ${esc(e.cup)}`);
    if (e.att) high += line('friends', `<b>Zuschauerschnitt:</b> ${e.att.toLocaleString('de-DE')}`);
    high += line('refresh', `<b>Transfers:</b> ${e.tIn} Zugänge · ${e.tOut} Abgänge`);
    if (tv) high += line('coin', `<b>TV-Gelder:</b> ${euro(tv.amount)}`);

    // DFL: Meister oben mit Wappen und Finale (Wunsch 2026-10-10: „sehen, wer am Ende gewonnen hat“); die Meister-Zeile
    // fällt dann aus dem Protokoll
    const po = dfl() && result && result.dfl && result.dfl.meister ? result.dfl : null;
    let meisterHtml = '';
    if (po) {
      const tn = id => { if (id === 'fcm') return CLUB.name;
        try { const t = (LEAGUE.tiers.bundesliga.groups[0].teams || []).find(x => x.id === id); if (t) return t.name; } catch (e) { /* unten */ }
        return id; };
      const fin = Array.isArray(po.spiele) ? po.spiele.find(s => s.runde === 4) : null;
      const erg = fin ? `${fin.gh}:${fin.ga}${fin.art === 'Verlängerung' ? ' n. V.' : fin.art === 'Elfmeterschießen' && fin.elfer ? ` n. V., ${fin.elfer[0]}:${fin.elfer[1]} i. E.` : ''}` : '';
      meisterHtml = `<div class="cr-meister"><span class="lg-crest" style="${typeof crestStyle === 'function' ? crestStyle(po.meister) : ''}" aria-hidden="true">${typeof crestInitials === 'function' ? crestInitials(tn(po.meister)) : ''}</span>` +
        `<div><div class="cr-kicker"><i class="ti ti-trophy"></i> DKL-Meister</div><b>${esc(tn(po.meister))}</b>` +
        (fin ? `<small>Finale ${esc(tn(fin.heim))} – ${esc(tn(fin.gast))} ${esc(erg)}${po.finalort ? ' · ' + esc(po.finalort) : ''}</small>` : '') + `</div></div>`;
    }
    const logZeilen = (result && result.log ? result.log : []).filter(l => !(po && /^D[FK]L-Meister:/.test(l)));
    const logHtml = logZeilen.length
      ? `<div class="cr-log">${logZeilen.slice(0, 6).map(l => `<div>${esc(l)}</div>`).join('')}</div>` : '';

    const ov = document.createElement('div');
    ov.className = 'exp-overlay';
    ov.innerHTML = `<div class="exp-dialog cr-dialog">
      <div class="cr-head"><div><div class="cr-kicker">Saison ${esc(e.label)} · ${esc(e.leagueName === 'DFL' ? 'DKL' : e.leagueName)}</div>
        <div class="cr-title">Saison-Rückblick</div></div>
        ${up ? (dfl() ? '<span class="cr-badge"><i class="ti ti-trophy"></i> Meister</span>' : '<span class="cr-badge"><i class="ti ti-arrow-up"></i> Aufgestiegen</span>') : ''}</div>
      ${meisterHtml}
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
  // openSponsorChoiceDialog bricht ab, wenn noch ein .exp-overlay offen ist —
  // deshalb wird die Sponsorenwahl erst NACH dem Schließen angestoßen.
  window.__closeSeasonRecap = function (btn) {
    try { const ov = btn && btn.closest('.exp-overlay'); if (ov) ov.remove(); } catch (e) {}
    try {
      if (typeof openSponsorChoiceDialog === 'function') openSponsorChoiceDialog();
    } catch (e) { console.warn('[Chronicle] continue', e); }
  };

  // ── Chronik-Overlay ────────────────────────────────────────────────────────
  window.openChronicle = function () {
    const rows = (CLUB && Array.isArray(CLUB.chronicle)) ? CLUB.chronicle.slice().reverse() : [];
    const body = rows.length ? rows.map(e => `<tr>
        <td>${esc(e.label)}</td><td class="cr-lg">${esc(e.leagueName === 'DFL' ? 'DKL' : e.leagueName)}</td>
        <td>${e.pos || '–'}</td><td>${e.pts}</td><td>${e.gf}:${e.ga}</td>
        <td>${e.topScorer ? esc(e.topScorer.name) + ' (' + e.topScorer.goals + ')' : '–'}</td>
        <td>${esc(e.cup)}</td></tr>`).join('')
      : `<tr><td colspan="7" style="color:var(--text3)">Noch keine abgeschlossene Saison.</td></tr>`;
    const ov = document.createElement('div');
    ov.className = 'exp-overlay';
    ov.addEventListener('click', ev => { if (ev.target === ov) ov.remove(); });
    ov.innerHTML = `<div class="exp-dialog cr-dialog cr-wide">
      <div class="cr-head"><div><div class="cr-kicker">${esc((typeof clubName === 'function') ? clubName() : 'Verein')}</div>
        <div class="cr-title">Vereinschronik</div></div>
        <span class="cr-badge">${rows.length} Saison${rows.length === 1 ? '' : 's'}</span></div>
      <div class="cr-tablewrap"><table class="cr-table">
        <thead><tr><th>Saison</th><th>Liga</th><th>Platz</th><th>Pkt</th><th>Tore</th><th>Torjäger</th><th>${dfl() ? 'Playoffs' : 'Pokal'}</th></tr></thead>
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
        <span class="cc-lg">${esc(e.leagueName === 'DFL' ? 'DKL' : e.leagueName)}</span>
        <span class="cc-pos">${e.pos ? e.pos + '.' : '–'}</span>
        <span class="cc-pts">${e.pts} Pkt</span>
        <span class="cc-top">${e.topScorer ? esc(e.topScorer.name) + ' (' + e.topScorer.goals + ')' : '–'}</span>
      </div>`).join('')
      : `<div class="cc-empty">Noch keine abgeschlossene Saison.</div>`;
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
      const r = _orig.apply(this, arguments);
      // DFL: das Playoff-Ergebnis steht erst nach dem Abschluss in LEAGUE.dflPlayoffs (beim Erfassen gehörte es noch zur
      // Vorsaison – im Rückblick stand deshalb immer „verpasst“, Prüfung 2026-10-10)
      try {
        const po = dfl() && LEAGUE.dflPlayoffs;
        if (_lastEntry && po && po.saison === _lastEntry.season) _lastEntry.cup = DFL_RUNDE[po.meister === 'fcm' ? 5 : (po.eigeneRunde || 0)] || 'verpasst';
      } catch (e) { /* Rückblick bleibt wie erfasst */ }
      return r;
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

  window.Chronicle = { captureSeason, showSeasonRecap, merkeKader };
  console.log('[Chronicle] aktiv — Saison-Rückblick & Vereinschronik');
})();
