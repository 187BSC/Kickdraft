/* ===== BUNDLE: bundles/bundle_finance.js ===== */
/* Enthält (in dieser Reihenfolge): running_costs_patches.js finance_dashboard_patch.js transfer_youth_patches.js */

/* ---------- js/running_costs_patches.js ---------- */
/* ===== running_costs_patches.js ===== */
/* ═══════════════════════════════════════════════════════════════════════════
   INFRASTRUKTUR-BETRIEBSKOSTEN-PATCH  v2
   ─────────────────────────────────────────────────────────────────────────
   Laden NACH app_main.js und training_patches.js.

   Änderungen v2:
   - Stadionkosten +35% (Mitte des gewünschten 30-40%-Aufschlags)
   - Downgrade-Funktion: jederzeit möglich, 10% Abbaugebühr des Upgrade-Preises
   - renderFacilityCard gepacht: Downgrade-Button erscheint neben Upgrade-Button
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {

  // ── 0. KONFIG ────────────────────────────────────────────────────────────
  // Index 0 = Stufe 1 … Index 9 = Stufe 10 | Werte in €/Woche
  // Stadion: Basiswerte ×1.35 gegenüber v1 (30-40%-Aufschlag, Mitte = 35%)
  const RUNNING_COSTS = {
    stadium:  [1400, 2600, 4200, 6800, 11000, 17500, 27500, 43000, 68000, 108000],
    training: [ 900, 1900, 3600, 6200, 10500, 17000, 27000, 42000, 65000, 100000],
    scouting: [ 700, 1500, 2900, 5100,  8800, 14500, 23500, 37000, 58000,  90000],
    merchandising: [0, 1200, 2600, 4600, 7800, 12500, 20000, 31000, 48000, 74000]
  };

  // Merchandising-EINNAHMEN pro Woche (der Geldhebel). Skaliert mit Stufe und
  // Fanbase/Stadiongröße — ein größeres Stadion = mehr Fans = mehr Verkäufe.
  const MERCH_INCOME = [1500, 4000, 9000, 17000, 31000, 53000, 86000, 136000, 206000, 311000];
  function merchandisingIncome() {
    if (!CLUB.facilities) return 0;
    const lvl = CLUB.facilities.merchandising || 1;
    const base = MERCH_INCOME[Math.max(0, Math.min(9, lvl - 1))] || 0;
    // Fanbase-Faktor über Stadiongröße: Stufe 1 → 0.7, Stufe 10 → ~1.6
    const stadLvl = CLUB.facilities.stadium || 1;
    const fanFactor = 0.7 + (stadLvl - 1) * 0.1;
    return Math.round(base * fanFactor);
  }
  window.merchandisingIncome = merchandisingIncome;

  // Abbaugebühr: 10% des ursprünglichen Upgrade-Preises der aktuellen Stufe
  const DOWNGRADE_FEE_FACTOR = 0.10;

  // Budget-Warnschwelle und max. Warnungen pro Saison
  const WARN_WEEKS = 8;
  const MAX_WARNINGS_PER_SEASON = 2;

  // ── Hilfsfunktionen ───────────────────────────────────────────────────────
  function costForFacility(key) {
    const lvl = (CLUB.facilities && CLUB.facilities[key]) || 1;
    const idx = Math.max(0, Math.min(9, lvl - 1));
    return (RUNNING_COSTS[key] && RUNNING_COSTS[key][idx]) || 0;
  }

  function totalWeeklyRunningCosts() {
    return costForFacility('stadium')
         + costForFacility('training')
         + costForFacility('scouting')
         + costForFacility('merchandising');
  }

  window.facilityRunningCostBreakdown = function () {
    return {
      stadium:  costForFacility('stadium'),
      training: costForFacility('training'),
      scouting: costForFacility('scouting'),
      merchandising: costForFacility('merchandising'),
      merchIncome: window.merchandisingIncome(),   // window: merch_flach.js (2026-10-22) hängt sich dort ein
      total:    totalWeeklyRunningCosts()
    };
  };

  // ── 1. DOWNGRADE-FUNKTION ─────────────────────────────────────────────────
  window.downgradeFacility = function (key) {
    const def = FACILITY_DEFS[key];
    if (!def) return;
    const cur = CLUB.facilities[key];
    if (cur <= 1) {
      alert('Stufe 1 ist bereits die niedrigste Stufe — kein weiterer Rückbau möglich.');
      return;
    }

    // Abbaugebühr = 10% des Preises für das aktuelle Level (das, was der Aufstieg auf cur gekostet hat)
    // FACILITY_DEFS.cost[cur-1] ist der Preis für den Schritt von (cur-1) auf cur
    const upgradeCostPaid = def.cost[cur - 1];
    const fee = Math.round(upgradeCostPaid * DOWNGRADE_FEE_FACTOR);
    const fmt = typeof formatEuro === 'function' ? formatEuro : v => v + '€';
    const newLvl = cur - 1;

    if (!confirm(
      `${def.name} von Stufe ${cur} auf Stufe ${newLvl} (${def.levelDesc[newLvl - 1]}) zurückstufen?\n\n` +
      `Abbaugebühr: ${fmt(fee)} (10% des Ausbaupreises)\n\n` +
      `Die laufenden Betriebskosten sinken sofort von ${fmt(RUNNING_COSTS[key][cur-1])}/Wo auf ${fmt(RUNNING_COSTS[key][newLvl-1])}/Wo.`
    )) return;

    if (CLUB.budget < fee) {
      alert(`Nicht genug Budget für die Abbaugebühr (${fmt(fee)}). Verfügbar: ${fmt(CLUB.budget)}.`);
      return;
    }

    CLUB.budget -= fee;
    CLUB.facilities[key] = newLvl;

    // Stadionkapazität anpassen
    if (key === 'stadium') {
      CLUB.stadiumCapacity = stadiumCapacityForLevel(newLvl);
    }

    if (typeof addNews === 'function') {
      addNews('club',
        `🔧 ${def.name} zurückgestuft`,
        `Die ${def.name} wurde auf Stufe ${newLvl} (${def.levelDesc[newLvl - 1]}) reduziert. Abbaugebühr: ${fmt(fee)}. Neue Betriebskosten: ${fmt(RUNNING_COSTS[key][newLvl - 1])}/Wo.`
      );
    }

    if (typeof renderClubTab  === 'function') renderClubTab();
    if (typeof renderScoutTab === 'function') renderScoutTab();
    if (typeof saveGameState  === 'function') saveGameState();
  };

  // ── 2. renderFacilityCard PATCHEN ─────────────────────────────────────────
  // Hängt den Downgrade-Button neben den bestehenden Upgrade-Button.
  const _origRenderCard = window.renderFacilityCard;
  if (typeof _origRenderCard === 'function') {
    window.renderFacilityCard = function (key) {
      let html = _origRenderCard(key);
      const def = FACILITY_DEFS[key];
      if (!def) return html;
      const cur = CLUB.facilities[key];
      if (cur <= 1) return html; // Stufe 1: kein Downgrade möglich

      const fmt = typeof formatEuro === 'function' ? formatEuro : v => v + '€';
      const fee = Math.round(def.cost[cur - 1] * DOWNGRADE_FEE_FACTOR);
      const weeklySaving = RUNNING_COSTS[key][cur - 1] - RUNNING_COSTS[key][cur - 2];

      const btn = `<button
        class="fc-upgrade"
        style="background:var(--bg3);color:var(--text2);border:1px solid var(--border);margin-top:6px"
        onclick="downgradeFacility('${key}')"
        title="Abbaugebühr: ${fmt(fee)} · spart ${fmt(weeklySaving)}/Wo Betriebskosten">
        ▼ Zurückstufen — Gebühr ${fmt(fee)}
      </button>`;

      // Button vor dem schließenden </div> der facility-card einfügen (dem letzten – das erste gehört zum Kopf)
      const ende = html.lastIndexOf('</div>');
      html = ende >= 0 ? html.slice(0, ende) + btn + html.slice(ende) : html + btn;
      return html;
    };
    console.log('[RunningCosts] renderFacilityCard gepatcht — Downgrade-Button aktiv');
  } else {
    console.warn('[RunningCosts] renderFacilityCard nicht gefunden — Downgrade-Button fehlt im UI');
  }

  // ── 3. WÖCHENTLICHER ABZUG ───────────────────────────────────────────────
  function weeklyRunningCostTick() {
    if (typeof CLUB === 'undefined' || typeof LEAGUE === 'undefined') return;
    if (CLUB.facilities && !CLUB.facilities.merchandising) CLUB.facilities.merchandising = 1;

    const total = totalWeeklyRunningCosts();
    const income = window.merchandisingIncome();   // Merchandising-Einnahmen (Hebel); window: merch_flach.js
    const net = total - income;                    // negativ = Wochengewinn

    // NICHT mehr abbuchen: Anlagenunterhalt und Merchandising stehen jetzt beide
    // in der Saisonplanung des Vorstands (fixIncome.merch / fixCost.anlagen).
    // Vorher lief beides zusätzlich hier durch — dieselbe Doppelbuchung wie
    // damals bei Tickets, Sponsoren und Bannern. Die Warnung unten bleibt, sie
    // stützt sich auf `net` als laufende Belastung.

    if (!CLUB._runningCostWarnings) CLUB._runningCostWarnings = {};
    const seasonKey = LEAGUE.season || 1;
    const warnings  = CLUB._runningCostWarnings[seasonKey] || 0;

    if (net > 0 && warnings < MAX_WARNINGS_PER_SEASON && CLUB.budget < net * WARN_WEEKS) {
      CLUB._runningCostWarnings[seasonKey] = warnings + 1;
      const weeksLeft = CLUB.budget > 0 ? Math.floor(CLUB.budget / net) : 0;
      const fmt = typeof formatEuro === 'function' ? formatEuro : v => v + '€';
      if (typeof addNews === 'function') {
        addNews('club',
          '⚠️ Betriebskosten-Warnung',
          `Freies Budget: ${fmt(CLUB.budget)} — reicht noch ca. ${weeksLeft} Woche${weeksLeft !== 1 ? 'n' : ''} (${fmt(net)}/Wo netto nach Merchandising). Erwäge mehr Merchandising oder eine Rückstufung.`
        );
      }
    }

    updateCostDisplay();
  }

  // ── 4. UI-KOSTENANZEIGE ──────────────────────────────────────────────────
  function updateCostDisplay() {
    const el = document.getElementById('facility-cost-display');
    if (!el) return;
    const b = window.facilityRunningCostBreakdown();
    const fmt = typeof formatEuro === 'function' ? formatEuro : v => v + '€';
    el.innerHTML = `
      <div style="font-size:11px;color:var(--text3);margin-bottom:4px">🏗️ Betriebskosten/Woche</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;font-size:11px">
        <span>🏟️ ${fmt(b.stadium)}</span>
        <span>🏃 ${fmt(b.training)}</span>
        <span>🌱 ${fmt(b.youth)}</span>
        <span>🔭 ${fmt(b.scouting)}</span>
        <span>🛍️ ${fmt(b.merchandising)}</span>
        <span style="font-weight:700;color:var(--text)">∑ ${fmt(b.total)}/Wo</span>
        <span style="color:var(--green,#3fb950)">🛍️+ ${fmt(b.merchIncome)}/Wo</span>
      </div>`;
  }

  // ── 5. PATCH: advanceCalendarWeek ────────────────────────────────────────
  const _prevAdvance = window.advanceCalendarWeek;
  if (typeof _prevAdvance === 'function') {
    window.advanceCalendarWeek = function () {
      const result = _prevAdvance.apply(this, arguments);
      if (result) {
        try { weeklyRunningCostTick(); } catch (e) { console.warn('[RunningCosts] Tick-Fehler', e); }
        try { if (typeof tickFacilityBuilds === 'function') tickFacilityBuilds(); } catch (e) { console.warn('[FacilityBuild] Tick-Fehler', e); }
      }
      return result;
    };
    console.log('[RunningCosts] advanceCalendarWeek gepatcht');
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  if (typeof CLUB !== 'undefined') {
    if (!CLUB._runningCostWarnings) CLUB._runningCostWarnings = {};
    updateCostDisplay();
  }

  window.RunningCosts = {
    breakdown: window.facilityRunningCostBreakdown,
    total:     totalWeeklyRunningCosts,
    RUNNING_COSTS,
    DOWNGRADE_FEE_FACTOR
  };

  console.log('[RunningCosts v2] geladen —',
    typeof formatEuro === 'function' ? formatEuro(totalWeeklyRunningCosts()) : totalWeeklyRunningCosts() + '€', '/Woche');

})();


/* ---------- js/finance_dashboard_patch.js ---------- */
/* ===== finance_dashboard_patch.js ===== */
/* ═══════════════════════════════════════════════════════════════════════════
   FINANZ-DASHBOARD  ·  v1
   ───────────────────────────────────────────────────────────────────────────
   Fasst alle Geldflüsse sichtbar zusammen und stellt sie als Übersicht in den
   Verein-Tab:
     EINNAHMEN  · Zuschauer (Tickets) · Merchandise · Sponsoren · TV-Geld
     AUSGABEN   · Spielergehälter · laufende Kosten (Anlagen)
     BILANZ     · pro Woche · Hochrechnung bis Saisonende (Kontostand-Prognose)

   Nutzt vorhandene Engine-Funktionen (keine Doppel-Logik):
     totalWeeklyWages(SQUAD), RunningCosts.total(), matchAttendanceIncome(),
     merchIncomePerMatch(), CLUB.sponsors[*].perYear, computeFcmTvMoney().
   Lädt nach app_main.js & running_costs_patches.js.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function euro(v) {
    return (typeof formatEuro === 'function') ? formatEuro(Math.round(v)) : (Math.round(v).toLocaleString('de-DE') + ' €');
  }
  function num(v) { return typeof v === 'number' && !isNaN(v) ? v : 0; }

  // Heimspiele, die in der aktuellen Saison noch kommen (für Einnahmen-Hochrechnung).
  function remainingHomeMatches() {
    try {
      const total = (typeof HOME_MATCHDAYS_PER_SEASON === 'number') ? HOME_MATCHDAYS_PER_SEASON : 17;
      // grob: Anteil der noch ausstehenden Spieltage * Heimspielquote (50%)
      const md = LEAGUE ? LEAGUE.matchday : 0;
      const maxMd = (typeof maxMatchday === 'function' && LEAGUE) ? maxMatchday(LEAGUE) : 34;
      const playedHome = Math.round((md / Math.max(1, maxMd)) * total);
      return Math.max(0, total - playedHome);
    } catch (e) { return 8; }
  }

  // Verbleibende Wochen der Saison (für laufende Kosten/Gehälter-Hochrechnung).
  function remainingWeeks() {
    try {
      const sw = (typeof SEASON_WEEKS === 'number') ? SEASON_WEEKS : 52;
      return Math.max(0, sw - (LEAGUE ? LEAGUE.week : 1));
    } catch (e) { return 20; }
  }

  // Sammelt alle Finanzkennzahlen.
  function computeFinances() {
    const squad = (typeof SQUAD !== 'undefined') ? SQUAD : [];
    const wagesWk = (typeof totalWeeklyWages === 'function') ? totalWeeklyWages(squad) : 0;
    const runWk = (window.RunningCosts && typeof RunningCosts.total === 'function') ? RunningCosts.total() : 0;

    // Einnahmen pro Heimspiel
    let gatePerMatch = 0, merchPerMatch = 0;
    try { const g = matchAttendanceIncome(); gatePerMatch = num(g && g.total); } catch (e) {}
    try { merchPerMatch = num(merchIncomePerMatch()); } catch (e) {}

    // Sponsoren (jährliche Auszahlung → auf Woche umgelegt)
    let sponsorPerYear = 0;
    try {
      ['shirt', 'sleeve', 'stadium'].forEach(t => {
        const s = CLUB.sponsors && CLUB.sponsors[t];
        if (s && s.yearsLeft > 0) sponsorPerYear += num(s.perYear);
      });
    } catch (e) {}
    const sw = (typeof SEASON_WEEKS === 'number') ? SEASON_WEEKS : 52;
    const sponsorPerWeek = sponsorPerYear / sw;

    // TV-Geld (Saisonende, Schätzung auf Basis aktueller Tabelle)
    let tvSeason = 0;
    try { const tv = computeFcmTvMoney(LEAGUE); tvSeason = num(tv && tv.amount); } catch (e) {}

    const homeLeft = remainingHomeMatches();
    const weeksLeft = remainingWeeks();

    // Wöchentliche Sicht (Heimspiel-Einnahmen auf die Wochen verteilt)
    const matchIncomeSeason = (gatePerMatch + merchPerMatch) * homeLeft;
    const matchIncomePerWeek = weeksLeft > 0 ? matchIncomeSeason / weeksLeft : 0;

    const incomeWk = matchIncomePerWeek + sponsorPerWeek;
    const expenseWk = wagesWk + runWk;
    const balanceWk = incomeWk - expenseWk;

    // Saison-Hochrechnung bis Saisonende
    const incomeRest = matchIncomeSeason + sponsorPerWeek * weeksLeft + tvSeason;
    const expenseRest = (wagesWk + runWk) * weeksLeft;
    const netRest = incomeRest - expenseRest;
    const projectedBudget = num(CLUB.budget) + netRest;

    return {
      wagesWk, runWk,
      gatePerMatch, merchPerMatch, sponsorPerWeek, sponsorPerYear,
      tvSeason, homeLeft, weeksLeft,
      matchIncomePerWeek, incomeWk, expenseWk, balanceWk,
      incomeRest, expenseRest, netRest, projectedBudget,
      currentBudget: num(CLUB.budget),
    };
  }

  function row(label, value, opts) {
    opts = opts || {};
    const col = opts.color || 'var(--text)';
    const sub = opts.sub ? `<span style="color:var(--text3);font-size:9px;margin-left:4px">${opts.sub}</span>` : '';
    return `<div class="fin-row">
      <span class="fin-label">${label}${sub}</span>
      <span class="fin-val" style="color:${col}">${value}</span>
    </div>`;
  }

  // Mini-Sparkline (Kontostand-Verlauf) als SVG.
  function sparklineSvg(values, w, h) {
    w = w || 280; h = h || 46;
    if (!values || values.length < 2) return '<div class="fin-spark-empty">Noch keine Verlaufsdaten — spiele ein paar Wochen weiter.</div>';
    const min = Math.min.apply(null, values), max = Math.max.apply(null, values);
    const range = (max - min) || 1, pad = 4;
    const pts = values.map((v, i) => {
      const x = pad + i * (w - 2 * pad) / (values.length - 1);
      const y = h - pad - ((v - min) / range) * (h - 2 * pad);
      return x.toFixed(1) + ',' + y.toFixed(1);
    });
    const up = values[values.length - 1] >= values[0];
    const col = up ? '#25c065' : '#f85149';
    const area = 'M' + pad + ',' + (h - pad) + ' L' + pts.join(' L') + ' L' + (w - pad) + ',' + (h - pad) + ' Z';
    const lastXY = pts[pts.length - 1].split(',');
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="' + h + '" preserveAspectRatio="none" style="display:block">'
      + '<path d="' + area + '" fill="' + col + '" opacity="0.13"/>'
      + '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + col + '" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>'
      + '<circle cx="' + lastXY[0] + '" cy="' + lastXY[1] + '" r="2.6" fill="' + col + '"/></svg>';
  }

  function buildDashboardHtml() {
    const f = computeFinances();
    const hist = (typeof CLUB !== 'undefined' && Array.isArray(CLUB._budgetHistory)) ? CLUB._budgetHistory : [];
    const histVals = hist.map(x => x.b);
    const histFirst = histVals.length ? histVals[0] : 0;
    const histLast = histVals.length ? histVals[histVals.length - 1] : 0;
    const histDelta = histLast - histFirst;
    const histCol = histDelta >= 0 ? '#3fb950' : '#f85149';
    const pos = '#3fb950', neg = '#f85149';
    const balCol = f.balanceWk >= 0 ? pos : neg;
    const projCol = f.projectedBudget >= 0 ? pos : neg;
    const netCol = f.netRest >= 0 ? pos : neg;

    return `<div class="finance-dash" id="finance-dash">
      <div class="fin-title"><i class="ti ti-coin"></i> Finanzübersicht${typeof infoBtn === 'function' ? infoBtn('finanzen') : ''}</div>

      <div class="fin-grid">
        <div class="fin-col">
          <div class="fin-col-head fin-in">Einnahmen / Woche</div>
          ${row('Zuschauer (Ø Heimspiel)', euro(f.gatePerMatch), { color: pos, sub: `${f.homeLeft} Heimsp. offen` })}
          ${row('Merchandise (Ø Heimspiel)', euro(f.merchPerMatch), { color: pos })}
          ${row('Sponsoren', euro(f.sponsorPerWeek) + '/Wo', { color: pos, sub: f.sponsorPerYear ? euro(f.sponsorPerYear) + '/Jahr' : 'kein Vertrag' })}
          ${row('Spieltag-Mittel', euro(f.matchIncomePerWeek) + '/Wo', { color: pos })}
        </div>
        <div class="fin-col">
          <div class="fin-col-head fin-out">Ausgaben / Woche</div>
          ${row('Spielergehälter', euro(f.wagesWk), { color: neg })}
          ${row('Laufende Kosten', euro(f.runWk), { color: neg, sub: 'Anlagen' })}
          ${row('Summe Ausgaben', euro(f.expenseWk), { color: neg })}
        </div>
      </div>

      <div class="fin-balance">
        <div class="fin-bal-item">
          <div class="fin-bal-label">Wochenbilanz</div>
          <div class="fin-bal-val" style="color:${balCol}">${f.balanceWk >= 0 ? '+' : ''}${euro(f.balanceWk)}</div>
        </div>
        <div class="fin-bal-item">
          <div class="fin-bal-label">Kontostand</div>
          <div class="fin-bal-val">${euro(f.currentBudget)}</div>
        </div>
        <div class="fin-bal-item">
          <div class="fin-bal-label">Prognose Saisonende</div>
          <div class="fin-bal-val" style="color:${projCol}">${euro(f.projectedBudget)}</div>
        </div>
      </div>

      <div class="fin-spark">
        <div class="fin-spark-head">
          <span><i class="ti ti-trending-up"></i> Kontostand-Verlauf</span>
          ${histVals.length >= 2 ? `<span style="color:${histCol};font-variant-numeric:tabular-nums">${histDelta >= 0 ? '+' : ''}${euro(histDelta)} über ${histVals.length} Wochen</span>` : ''}
        </div>
        ${sparklineSvg(histVals)}
      </div>

      <div class="fin-forecast">
        <div class="fin-fc-line">
          <i class="ti ti-chart-bar"></i> Bis Saisonende (${f.weeksLeft} Wochen): Einnahmen <b style="color:${pos}">${euro(f.incomeRest)}</b>
          <span style="color:var(--text3)">(inkl. TV-Geld ${euro(f.tvSeason)})</span>,
          Ausgaben <b style="color:${neg}">${euro(f.expenseRest)}</b>,
          Netto <b style="color:${netCol}">${f.netRest >= 0 ? '+' : ''}${euro(f.netRest)}</b>.
        </div>
        ${f.projectedBudget < 0
          ? `<div class="fin-warn"><i class="ti ti-alert-triangle"></i> Achtung: Bei gleichbleibenden Finanzen rutscht das Konto bis Saisonende ins Minus. Gehälter senken oder Einnahmen erhöhen.</div>`
          : `<div class="fin-ok"><i class="ti ti-circle-check"></i> Die Finanzen sind bis Saisonende voraussichtlich stabil.</div>`}
      </div>
    </div>`;
  }

  // In den Verein-Tab einhängen (oben, vor den Anlagen).
  function injectDashboard() {
    const host = document.getElementById('view-club');
    if (!host) return;
    const inner = host.querySelector('.club-facilities') ? host.querySelector('.club-facilities').parentElement : host;
    const old = document.getElementById('finance-dash');
    if (old) old.remove();
    // bevorzugt direkt nach dem Banner, sonst an den Anfang
    const banner = document.getElementById('club-banner');
    const html = buildDashboardHtml();
    if (banner && banner.parentElement) {
      banner.insertAdjacentHTML('afterend', html);
    } else {
      inner.insertAdjacentHTML('afterbegin', html);
    }
  }

  // ── CSS ────────────────────────────────────────────────────────────────────
  if (!document.getElementById('finance-dash-style')) {
    const s = document.createElement('style');
    s.id = 'finance-dash-style';
    s.textContent = `
      .finance-dash{ background:var(--bg2,#161b22); border:1px solid var(--border,#30363d);
        border-radius:12px; padding:14px 16px; margin:12px 0; }
      .fin-title{ font-size:14px; font-weight:700; margin-bottom:12px; }
      .fin-grid{ display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:12px; }
      .fin-col-head{ font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.5px;
        margin-bottom:6px; padding-bottom:4px; border-bottom:1px solid var(--border,#30363d); }
      .fin-col-head.fin-in{ color:#3fb950; }
      .fin-col-head.fin-out{ color:#f85149; }
      .fin-row{ display:flex; justify-content:space-between; align-items:baseline; padding:3px 0; font-size:11px; }
      .fin-label{ color:var(--text2,#8b949e); }
      .fin-val{ font-weight:700; font-variant-numeric:tabular-nums; }
      .fin-balance{ display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:12px; }
      .fin-bal-item{ background:var(--bg3,#0d1117); border-radius:8px; padding:8px 10px; text-align:center; }
      .fin-bal-label{ font-size:9px; color:var(--text3,#6e7681); text-transform:uppercase; letter-spacing:.4px; margin-bottom:3px; }
      .fin-bal-val{ font-size:15px; font-weight:800; font-variant-numeric:tabular-nums; }
      .fin-forecast{ font-size:11px; color:var(--text2,#8b949e); line-height:1.5; }
      .fin-fc-line{ margin-bottom:6px; }
      .fin-warn{ background:#3a1e1e; border:1px solid #c0392b; border-radius:7px; padding:7px 10px; color:#f5b7b1; font-size:10px; }
      .fin-ok{ background:#1a3a1e; border:1px solid #2ecc71; border-radius:7px; padding:7px 10px; color:#a9dfbf; font-size:10px; }
      .fin-spark{ background:var(--bg3,#0d1117); border-radius:8px; padding:8px 10px 6px; margin-bottom:12px; }
      .fin-spark-head{ display:flex; justify-content:space-between; align-items:baseline; font-size:10px; font-weight:700; color:var(--text2,#8b949e); margin-bottom:4px; }
      .fin-spark-empty{ font-size:10px; color:var(--text3,#6e7681); padding:6px 0; }
      @media (max-width:680px){ .fin-grid{ grid-template-columns:1fr; } .fin-balance{ grid-template-columns:1fr; } }
    `;
    document.head.appendChild(s);
  }

  // ── HOOK: bei jedem Render des Verein-Tabs aktualisieren ────────────────────
  if (typeof window.renderClubTab === 'function') {
    const _orig = window.renderClubTab;
    window.renderClubTab = function () {
      _orig.apply(this, arguments);
      try { injectDashboard(); } catch (e) { console.warn('[Finance] inject', e); }
    };
    try { renderClubTab = window.renderClubTab; } catch (e) {}
  }

  window.FinanceDashboard = { computeFinances, injectDashboard, buildDashboardHtml };
  console.log('[FinanceDashboard] aktiv — Einnahmen/Ausgaben/Prognose im Verein-Tab');
})();
