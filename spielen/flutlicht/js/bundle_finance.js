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
    youth:    [ 800, 1700, 3200, 5600,  9500, 15500, 25000, 39000, 61000,  95000],
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
         + costForFacility('youth')
         + costForFacility('scouting')
         + costForFacility('merchandising');
  }

  window.facilityRunningCostBreakdown = function () {
    return {
      stadium:  costForFacility('stadium'),
      training: costForFacility('training'),
      youth:    costForFacility('youth'),
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

    // Akademie: überzählige Talente entlassen falls Kapazität sinkt
    if (key === 'youth' && CLUB.youthProspects) {
      const newCap = youthCapacityForLevel(newLvl);
      while (CLUB.youthProspects.length > newCap) {
        const released = CLUB.youthProspects.pop();
        if (typeof addNews === 'function') {
          addNews('club', 'Talent entlassen (Kapazität)', `Durch den Rückbau der Akademie musste ${released.firstName || ''} ${released.name} die Jugendabteilung verlassen.`);
        }
      }
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

      // Button vor dem schließenden </div> der facility-card einfügen
      html = html.replace('</div>', btn + '</div>');
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
    if (!values || values.length < 2) return '<div class="fin-spark-empty">Noch keine Verlaufsdaten</div>';
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


/* ---------- js/transfer_youth_patches.js ---------- */
/* ===== transfer_youth_patches.js ===== */
/* ═══════════════════════════════════════════════════════════════════════════
   TRANSFER & NACHWUCHS-PATCHES
   ─────────────────────────────────────────────────────────────────────────
   Laden NACH app_main.js und training_patches.js (letztes Script).

   Enthält:
   1. Konfig aus transfer_youth_config.json (inline, kein extra Fetch nötig)
   2. Patch: maybeGenerateTransferBid → Overpay 20-30% Sommer / 30-40% Winter
              + Deadline-Day-Aufschlag + bis zu 5 gleichzeitige Gebote
   3. Patch: acceptTransferBid → Spieler-Verkauf mit 10% Rabatt auf das Gebot
   4. Patch: weeklyTrainingTick → Akademie-Spieler entwickeln sich 4-7 OVR/Saison
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {

  // ── 0. KONFIG (spiegelt transfer_youth_config.json) ──────────────────────
  //   Passe hier ODER in der JSON-Datei an – beide müssen synchron bleiben.
  const CFG = {
    transfer: {
      // Aufschläge kleiner und gedeckelt (2026-10-24, Nutzer: „Bayern hat 100 % overpayed … 75 Mille wenn der Spieler 81 hat und 19
      // ist“ – vorher stapelten sich Fenster 20–40 %, Talent 15–35 %, Top-Klub 10–25 %, Ausland 12–28 %, Deadline 10–20 % bis +148 %)
      summer:      { overpayMin: 0.05, overpayMax: 0.15 },
      winter:      { overpayMin: 0.10, overpayMax: 0.20 },
      deadlineDay: { overpayExtraMin: 0.05, overpayExtraMax: 0.10 },
      auslandExtraMin: 0.03, auslandExtraMax: 0.08,
      overpayDeckel: 0.40,                       // zusammen höchstens +40 % über Marktwert
      maxConcurrentBids: 5,
      bidChancePerWeek:  0.75,
      playerSellDiscount: 0.10,
      // Rivalen-Gebote: Top-Klubs jagen Talente
      talentMagnet: { ovrThreshold: 74, potentialGap: 8, maxAlter: 23, targetWeightTalent: 3.0, targetWeightNormal: 1.0 },
      talentExtraMin: 0.05, talentExtraMax: 0.10,
      topClubExtraMin: 0.05, topClubExtraMax: 0.10,
      // maxFee = maximale Ablöse, die ein Klub dieses Tiers realistisch stemmen
      // kann (Transfermarkt-Größenordnungen). Verhindert, dass Kleinstvereine
      // Millionengebote abgeben — Tier wird nach OVR UND Finanzkraft gewählt,
      // das Angebot zusätzlich am Tier-Deckel gekappt.
      tiers: {
        elite:         { ovrMin: 80, maxFee: 150000000, clubs: ['FC Bayern München','Real Madrid','Manchester City','FC Barcelona','Paris Saint-Germain','FC Liverpool'] },
        topBundesliga: { ovrMin: 75, maxFee: 55000000,  clubs: ['Borussia Dortmund','RB Leipzig','Bayer 04 Leverkusen','VfB Stuttgart','Eintracht Frankfurt','AC Mailand','Atlético Madrid'] },
        bundesliga:    { ovrMin: 70, maxFee: 20000000,  clubs: ['SC Freiburg','1. FC Union Berlin','VfL Wolfsburg','1. FSV Mainz 05','Borussia Mönchengladbach','SV Werder Bremen','TSG 1899 Hoffenheim'] },
        zweiteLiga:    { ovrMin: 64, maxFee: 4500000,   clubs: ['Hamburger SV','FC Schalke 04','Hertha BSC','1. FC Köln','Fortuna Düsseldorf','1. FC Kaiserslautern','Hannover 96'] },
        lower:         { ovrMin: 0,  maxFee: 1500000,   clubs: ['VfL Steinbach','SC Marienburg','1. FC Eichenfeld','Borussia Falkenau','SV Rheinfeld','TuS Hohenfels'] }
      }
    },
    youth: {
      ovrGainPerSeasonMin: 4,
      ovrGainPerSeasonMax: 7,
      weeklyTickChanceBase: 0.18,
      academyLevelBonusPerLevel: 0.015
    }
  };

  // ── Hilfsfunktionen ───────────────────────────────────────────────────────
  function rnd(min, max) { return min + Math.random() * (max - min); }
  function roundMV(v) { return typeof roundMarketValue === 'function' ? roundMarketValue(v) : Math.round(v / 1000) * 1000; }
  function rint(n) { return Math.floor(Math.random() * n); }
  function pick(arr) { return (typeof pickRnd === 'function') ? pickRnd(arr) : arr[rint(arr.length)]; }
  function potGap(p) { return ((p.truePotential != null ? p.truePotential : p.ovr) || 0) - (p.ovr || 0); }
  // Talent nur bis tm.maxAlter (2026-10-24, Nutzer: „Top Club und Talent bei einem 29-Jährigen stimmt nicht“ – vorher galt jeder ab
  // Stärke 74 als Talent, egal wie alt, samt Talent-Aufschlag und Marke „Talent“ auf der Angebotskarte)
  function isTalent(p) {
    const tm = CFG.transfer.talentMagnet;
    if ((p.age || 25) > tm.maxAlter) return false;
    return (p.ovr >= tm.ovrThreshold) || (potGap(p) >= tm.potentialGap);
  }
  // Ab welchem Marktwert ist ein Spieler für andere Vereine interessant?
  // Muss zur eigenen Liga passen: ein Regionalligist hat keinen 60.000-€-Mann,
  // seine Leistungsträger sind für andere Viertligisten aber sehr wohl attraktiv.
  const WERT_SCHWELLE = { bundesliga: 400000, bundesliga2: 120000, liga3: 40000, regionalliga: 12000 };
  function ligaWertSchwelle() {
    let key = 'regionalliga';
    try { key = findFcmGroup(LEAGUE).tierKey || key; } catch (e) {}
    return WERT_SCHWELLE[key] != null ? WERT_SCHWELLE[key] : 60000;
  }
  // Gewichtete Index-Auswahl aus { idx: weight }
  function weightedPick(weightMap) {
    let total = 0; for (const k in weightMap) total += weightMap[k];
    let r = Math.random() * total;
    for (const k in weightMap) { r -= weightMap[k]; if (r <= 0) return k; }
    const keys = Object.keys(weightMap); return keys[keys.length - 1];
  }
  // Bieter-Klub passend zur Spielerstärke. Talente ziehen bevorzugt das höchste
  // zulässige Tier an (damit Bayern & Co. wirklich anklopfen). Bei Talenten zählt
  // das Potenzial für die Tier-Einstufung — so jagen Top-Klubs auch Wonderkids,
  // deren aktueller OVR noch niedrig ist.
  // AUSLÄNDISCHE BIETER aus der echten Klubdatenbank. Vorher standen in den
  // Stufen acht fest verdrahtete Namen (Real, City, Barça …). EURO_CLUBS kennt
  // hunderte Vereine mit Land, Stärke und Koeffizient — daraus wird der Kreis
  // der Interessenten gezogen, passend zur Stufe.
  const EURO_STUFEN = {
    elite:         [84, 99],
    topBundesliga: [79, 84],
    bundesliga:    [74, 79],
    zweiteLiga:    [69, 74],
    lower:         [0,  69]
  };
  function auslandsKlubs(stufenKey) {
    const alle = (typeof window !== 'undefined' && window.EURO_CLUBS) || [];
    if (!alle.length) return [];
    const [lo, hi] = EURO_STUFEN[stufenKey] || [0, 99];
    return alle.filter(c => c && c.name && c.ovr >= lo && c.ovr < hi &&
                            c.country !== 'Deutschland');
  }
  // Wie oft kommt das Angebot aus dem Ausland? Für Toptalente deutlich öfter —
  // die großen Klubs sammeln europaweit.
  function auslandsAnteil(stufenKey, talent) {
    const basis = stufenKey === 'elite' ? 0.60 : stufenKey === 'topBundesliga' ? 0.42
                : stufenKey === 'bundesliga' ? 0.26 : 0.12;
    return talent ? Math.min(0.80, basis + 0.15) : basis;
  }

  function pickBidderFor(p, mv) {
    const tiers = CFG.transfer.tiers;
    const talent = isTalent(p);
    const tierOvr = talent ? Math.max(p.ovr || 50, ((p.truePotential != null ? p.truePotential : p.ovr) || 50) - 3) : (p.ovr || 50);
    let eligible = [];
    for (const key in tiers) { if (tierOvr >= tiers[key].ovrMin) eligible.push({ key, t: tiers[key] }); }
    if (!eligible.length) {
      const fb = (typeof BIDDER_CLUBS !== 'undefined' && BIDDER_CLUBS.length) ? BIDDER_CLUBS : ['FC Unbekannt'];
      return { club: pick(fb), isTop: false, maxFee: (tiers.lower && tiers.lower.maxFee) || 1500000 };
    }
    // Finanzkraft-Filter: nur Tiers, die den Marktwert stemmen können —
    // kein Kleinstverein bietet mehr 40 Mio. Kann sich KEIN zulässiges Tier
    // den Spieler leisten, bietet das finanzstärkste (Angebot wird gedeckelt).
    if (mv != null) {
      const affordable = eligible.filter(e => (e.t.maxFee || Infinity) >= mv);
      eligible = affordable.length ? affordable
        : [eligible.slice().sort((a, b) => (b.t.maxFee || 0) - (a.t.maxFee || 0))[0]];
    }
    let chosen;
    if (talent) {
      const sorted = eligible.slice().sort((a, b) => b.t.ovrMin - a.t.ovrMin);
      chosen = (Math.random() < 0.65) ? sorted[0] : sorted[Math.min(sorted.length - 1, rint(Math.min(2, sorted.length)))];
    } else {
      chosen = eligible[rint(eligible.length)];
    }
    const isTop = (chosen.key === 'elite' || chosen.key === 'topBundesliga');
    // Mit einer stufenabhängigen Wahrscheinlichkeit meldet sich ein
    // ausländischer Verein statt eines deutschen.
    const ausland = auslandsKlubs(chosen.key);
    if (ausland.length && Math.random() < auslandsAnteil(chosen.key, talent)) {
      const k = ausland[rint(ausland.length)];
      return { club: k.name, land: k.country, ausland: true, isTop,
               maxFee: chosen.t.maxFee || Infinity };
    }
    return { club: pick(chosen.t.clubs), isTop, maxFee: chosen.t.maxFee || Infinity };
  }

  // ── 1. TRANSFER-BID PATCH ─────────────────────────────────────────────────
  //    Ersetzt maybeGenerateTransferBid vollständig.
  //    Neu: Top-Klubs (Bayern & Co.) jagen Toptalente, Talent-/Top-Klub-Overpay.
  window.maybeGenerateTransferBid = function () {
    if (!LEAGUE || !isTransferWindowOpen()) return null;
    if (!CLUB.transferBids) CLUB.transferBids = [];

    // Bis zu maxConcurrentBids gleichzeitige Gebote erlaubt
    if (CLUB.transferBids.length >= CFG.transfer.maxConcurrentBids) return null;

    // Erhöhte Wahrscheinlichkeit (75 % statt 50 %)
    if (Math.random() > CFG.transfer.bidChancePerWeek) return null;

    // Der Kader darf durch einen Verkauf nicht zu klein werden — das prüft die
    // KADERGRÖSSE, nicht die Zahl der begehrten Spieler. Die alte Fassung
    // verlangte 13 Spieler mit Marktwert über 60.000 €; in der 2. Bundesliga
    // waren das 4 von 13, in der Regionalliga praktisch nie. Ergebnis: über
    // 13 gemessene Saisons kam KEIN EINZIGES Angebot — Spielerverkauf war
    // unterhalb der Bundesliga faktisch abgeschaltet.
    const imKader = SQUAD.filter(p => !p.onLoanFrom && !p.onLoanAt);
    if (imKader.length < 14) return null;

    // Interessant ist ein Spieler ab einem Marktwert, der zur Liga passt:
    // ein Regionalligist hat keinen Spieler für 60.000 €, seine Leistungsträger
    // sind trotzdem für andere Viertligisten attraktiv.
    const schwelle = ligaWertSchwelle();
    // Saison-Neuzugänge sind gesperrt → kein Gebot für sie erzeugen
    const sellable = imKader.filter(p => computeMarketValue(p) > schwelle
      && (typeof window.canSellPlayer !== 'function' || window.canSellPlayer(p)));
    if (!sellable.length) return null;

    // Kandidaten (noch kein offenes Gebot) — Talente werden bevorzugt anvisiert
    const candidates = sellable.filter(p => !CLUB.transferBids.some(b => b.playerId === p.id));
    if (!candidates.length) return null;
    const tm = CFG.transfer.talentMagnet;
    const weightMap = {};
    candidates.forEach((p, i) => { weightMap[i] = isTalent(p) ? tm.targetWeightTalent : tm.targetWeightNormal; });
    const target = candidates[parseInt(weightedPick(weightMap), 10)] || candidates[0];
    const talent = isTalent(target);

    const mv = computeMarketValue(target);
    const win = currentWindowInfo();                  // { type:'Sommer'|'Winter', deadline:bool }

    // Overpay-Range je Fenster
    const rangeCfg = win.type === 'Winter' ? CFG.transfer.winter : CFG.transfer.summer;
    let overpayFactor = 1 + rnd(rangeCfg.overpayMin, rangeCfg.overpayMax);

    // Talent-Aufschlag on top
    if (talent) overpayFactor += rnd(CFG.transfer.talentExtraMin, CFG.transfer.talentExtraMax);

    // Bieter-Klub nach Stärke UND Finanzkraft wählen (Talente → Top-Klubs)
    const bidder = pickBidderFor(target, mv);

    // Top-Klub zahlt drauf
    if (bidder.isTop) overpayFactor += rnd(CFG.transfer.topClubExtraMin, CFG.transfer.topClubExtraMax);

    // AUSLANDSZUSCHLAG: Ein Wechsel ins Ausland ist für den Spieler ein größerer
    // Schritt — und der Verein muss den abgebenden Klub überzeugen, obwohl er
    // ihn nicht in der eigenen Liga stärkt. Beides macht das Angebot höher.
    if (bidder.ausland) overpayFactor += rnd(CFG.transfer.auslandExtraMin, CFG.transfer.auslandExtraMax);

    // Deadline-Day-Aufschlag on top
    if (win.deadline) {
      overpayFactor += rnd(CFG.transfer.deadlineDay.overpayExtraMin, CFG.transfer.deadlineDay.overpayExtraMax);
    }

    overpayFactor = Math.min(overpayFactor, 1 + CFG.transfer.overpayDeckel);
    // Finanzkraft-Deckel des Bieter-Tiers (Sicherheitsnetz gegen Mondgebote)
    let rawOffer = mv * overpayFactor;
    if (bidder.maxFee && isFinite(bidder.maxFee) && rawOffer > bidder.maxFee) rawOffer = bidder.maxFee;
    const offer = roundMV(rawOffer);
    const bid = {
      id:         'bid_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      playerId:   target.id,
      playerName: target.name,
      club:       bidder.club,
      land:       bidder.land || null,
      ausland:    !!bidder.ausland,
      amount:     offer,
      week:       LEAGUE.week,
      windowType: win.type || 'Sommer',
      isDeadline: !!win.deadline,
      isTopClub:  !!bidder.isTop,
      forTalent:  !!talent,
      newsShown:  true   // wir erzeugen unten eine reichhaltige News; verhindert Doppel-News im Aufrufer
    };
    CLUB.transferBids.push(bid);

    // News-Meldung (reichhaltig, mit Talent-/Top-Klub-/Deadline-Label)
    if (typeof addNews === 'function') {
      const fmt = (typeof formatEuro === 'function') ? formatEuro : v => v + '€';
      const fullName = ((target.firstName || '') + ' ' + target.name).trim();
      let label = '💰 Kaufangebot';
      if (bidder.isTop && talent) label = '🌟 Top-Klub will dein Juwel';
      else if (bidder.isTop)      label = '⭐ Top-Klub-Angebot';
      else if (win.deadline)      label = '🔥 Deadline-Day-Angebot';
      if (bidder.ausland) label = talent ? '🌍 Ausland will dein Juwel' : '🌍 Angebot aus dem Ausland';
      const extras = [];
      if (win.deadline) extras.push('Deadline-Day');
      if (talent)       extras.push('Talent-Aufschlag');
      if (bidder.ausland) extras.push('Auslandszuschlag');
      const extra = extras.length ? ' (' + extras.join(', ') + '!)' : '';
      const herkunft = bidder.ausland && bidder.land ? ` aus ${bidder.land}` : '';
      addNews('transfer', `${label}: ${fullName}`,
        `${bidder.club}${herkunft} bietet ${fmt(offer)} für ${fullName} (MV: ${fmt(mv)})${extra}. Entscheide im Transfer-Tab.`);
    }

    return bid;
  };

  // ── 2. AKTIV-VERKAUF MIT RABATT ──────────────────────────────────────────
  //    Wenn der Spieler einen Spieler aktiv verkauft (acceptTransferBid),
  //    bekommt er das gebotene Angebot minus 10% Verkäufer-Rabatt.
  //    Hintergrund: Du gehst proaktiv auf die Anfrage ein → leichter Abzug.
  //
  //    Nur aktiv-verkaufte Bids bekommen den Rabatt; wird durch bid.playerInitiated markiert.
  //    Falls du den Mechanismus für ALLE Verkäufe willst: Kommentar im Code unten anpassen.
  const _origAccept = window.acceptTransferBid;
  window.acceptTransferBid = function (bidId) {
    if (!CLUB.transferBids) return null;
    const bid = CLUB.transferBids.find(b => b.id === bidId);
    if (!bid) return typeof _origAccept === 'function' ? _origAccept(bidId) : null;

    // Verkaufs-Preis mit Rabatt (nur wenn playerInitiated = true)
    // Setze bid.playerInitiated = true bevor du acceptTransferBid aufrufst,
    // um den Rabatt auszulösen. KI-generierte Gebote die der Nutzer annimmt = kein Rabatt.
    // Der Rabatt war doppelt: offerPlayerForSale zieht ihn beim Erstellen des
    // Gebots bereits ab, hier wurde er ein zweites Mal abgezogen (0,9 × 0,9 =
    // 81 % statt 90 %). Damit lag das Anbieten kaum über dem Schnellverkauf.
    if (bid.playerInitiated && !bid._rabattDrin) {
      bid.amount = roundMV(bid.amount * (1 - CFG.transfer.playerSellDiscount));
      bid._rabattDrin = true;
    }

    return typeof _origAccept === 'function' ? _origAccept(bidId) : null;
  };

  // Neue Hilfsfunktion: Spieler aktiv zum Kauf anbieten (erzeugt ein Gebot mit Rabatt)
  window.offerPlayerForSale = function (playerId) {
    if (!CLUB.transferBids) CLUB.transferBids = [];
    const p = SQUAD.find(x => x.id === playerId);
    if (!p) return null;
    if (CLUB.transferBids.some(b => b.playerId === playerId)) {
      alert(`Für ${p.firstName || ''} ${p.name} liegt bereits ein Angebot vor.`);
      return null;
    }
    const mv = computeMarketValue(p);
    // Verkäufer bietet mit 10% Abschlag an (signalisiert Verkaufswillen)
    const offer = roundMV(mv * (1 - CFG.transfer.playerSellDiscount));
    const bid = {
      id: 'bid_sale_' + Date.now(),
      playerId:        p.id,
      playerName:      p.name,
      club:            pickBidderFor(p, mv).club,  // Interessent passend zu Stärke + Finanzkraft
      amount:          offer,
      week:            LEAGUE.week,
      playerInitiated: true,
      _rabattDrin:     true,        // Abschlag steckt schon in `offer`
      windowType:      (currentWindowInfo().type || 'Sommer')
    };
    CLUB.transferBids.push(bid);
    if (typeof addNews === 'function') {
      addNews('transfer', `📤 Verkaufsangebot: ${p.firstName || ''} ${p.name}`,
        `Du hast ${p.firstName || ''} ${p.name} für ${typeof formatEuro === 'function' ? formatEuro(offer) : offer + '€'} (10% unter MV) auf den Markt gestellt. Ein Interessent hat sich gemeldet.`);
    }
    if (typeof renderTransferTab === 'function') renderTransferTab();
    if (typeof saveGameState === 'function') saveGameState();
    return bid;
  };

  // ── 3. AKADEMIE-ENTWICKLUNG PATCH ────────────────────────────────────────
  //    Hängt sich in den bestehenden weeklyTrainingTick ein und fügt danach
  //    einen separaten Tick für youthProspects hinzu.
  //    Ziel: 4-7 OVR-Punkte pro Saison (34 Wochen) → ~0.15 OVR/Woche im Schnitt.
  //
  //    Akademie-Stufe erhöht die Chance leicht (bessere Infrastruktur = schnellere Entwicklung).

  const _origTick = window.TrainingSystem && window.TrainingSystem.weeklyTrainingTick
    ? window.TrainingSystem.weeklyTrainingTick.bind(window.TrainingSystem)
    : null;

  function academyWeeklyTick() {
    if (!CLUB.youthProspects || !CLUB.youthProspects.length) return;
    const academyLvl = (CLUB.facilities && CLUB.facilities.youth) || 1;
    const tickChance = CFG.youth.weeklyTickChanceBase
                     + (academyLvl - 1) * CFG.youth.academyLevelBonusPerLevel;

    CLUB.youthProspects.forEach(p => {
      // Entwicklung nur bis zum Potenzial
      const pot = p.truePotential || (p.ovr + 10);
      if (p.ovr >= pot) return;

      if (Math.random() < tickChance) {
        // Entwickelt das schwächste der drei Kern-Attribute (realistischer als Random)
        const areas = [['def', p.def], ['mid', p.mid], ['att', p.att]]
          .sort((a, b) => a[1] - b[1]); // aufsteigend: schwächstes zuerst
        const [attr] = areas[0];
        p[attr] = Math.min(99, (p[attr] || 50) + 1);

        // Pace leicht mitziehen (alle 3 Wochen in ~50% der Fälle)
        if (Math.random() < 0.35 && (p.pace || 50) < 95) {
          p.pace = Math.min(95, (p.pace || 50) + 1);
        }

        // OVR neu berechnen
        if (typeof computeOvrFromAreas === 'function') {
          p.ovr = computeOvrFromAreas(p);
        } else {
          // Fallback: Durchschnitt der drei Bereiche
          p.ovr = Math.round((p.def + p.mid + p.att) / 3);
        }
        // Marktwert aktualisieren
        if (typeof computeMarketValue === 'function') {
          p.value = computeMarketValue(p);
        }
      }
    });
  }

  // Patch: weeklyTrainingTick erweitern
  if (window.TrainingSystem) {
    const _origWT = window.TrainingSystem.weeklyTrainingTick;
    window.TrainingSystem.weeklyTrainingTick = function () {
      if (typeof _origWT === 'function') _origWT.call(this);
      try { academyWeeklyTick(); } catch (e) { console.warn('[TransferYouthPatches] academyWeeklyTick Fehler', e); }
    };
    console.log('[TransferYouthPatches] TrainingSystem.weeklyTrainingTick erweitert (Akademie-Tick)');
  } else {
    // Fallback: direkt in advanceCalendarWeek einhängen falls TrainingSystem nicht verfügbar
    const _origAdv = window.advanceCalendarWeek;
    if (typeof _origAdv === 'function') {
      window.advanceCalendarWeek = function () {
        const r = _origAdv.call(this);
        if (r) { try { academyWeeklyTick(); } catch (e) {} }
        return r;
      };
    }
  }

  console.log('[TransferYouthPatches] aktiv — Transfer-Overpay Sommer 20-30%, Winter 30-40%, Deadline +10-20%, max', CFG.transfer.maxConcurrentBids, 'Gebote, Akademie-Tick aktiv');

})();