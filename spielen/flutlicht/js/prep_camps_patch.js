/* ===== prep_camps_patch.js =====
   Sommer-Vorbereitung + Winter-Kurzcamp.
   Einmal pro Fenster wählt der Spieler aus 4 Optionen (inkl. „Zuhause bleiben"):
   Ein Camp füllt die Fitness auf 100 (NIE darüber — Cap bleibt) und legt einen
   Fitness-Puffer an (weniger Verlust pro Spiel + mehr Wochen-Erholung für N
   Wochen), dazu Moral- und teils Reputationsboost. Die teuerste Option kostet
   spürbar, lohnt sich aber durch den stärksten Puffer + Moral + Ruf.
   Kosten skalieren als % vom Transferbudget der aktuellen Liga.
   Lädt NACH fitness_patch.js (braucht refillFitness/applyFitnessBuffer) und nach
   bundle_economy (MoraleSystem, EXP.applyDelta).
   ============================================================================= */
(function () {
  'use strict';

  // Kosten als Anteil am Liga-Transferbudget (etwas teurer kalibriert).
  var SUMMER = [
    { id: 'home',    name: 'Zuhause bleiben',                 pct: 0.00, fill: false, buffer: null,                                  moral: 0,  rep: null,
      desc: 'Reguläre Vorbereitung im eigenen Trainingszentrum. Kostet nichts — bringt aber auch keinen Extra-Schub.' },
    { id: 'kompakt', name: 'Kompakt-Camp (Inland)',           pct: 0.05, fill: true,  buffer: { weeks: 2, drainFactor: 0.85, recoverBonus: 0 }, moral: 3,  rep: null,
      desc: 'Ein paar intensive Tage im Inland. Solide Grundlage zum kleinen Preis.' },
    { id: 'lager',   name: 'Trainingslager (Alpen-Resort)',   pct: 0.12, fill: true,  buffer: { weeks: 4, drainFactor: 0.75, recoverBonus: 4 }, moral: 6,  rep: { eventFans: 4 },
      desc: 'Eine Woche Höhentraining unter Top-Bedingungen. Team kommt frisch und eingeschworen zurück.' },
    { id: 'ausland', name: 'Auslands-Camp (Belek / Marbella)', pct: 0.24, fill: true, buffer: { weeks: 6, drainFactor: 0.65, recoverBonus: 4 }, moral: 10, rep: { eventFans: 6, ultras: 3 },
      desc: 'Zehn Tage Profi-Camp am Meer inkl. Marketing-Reise. Teuer, aber der Puffer hält die halbe Hinrunde.', featured: true }
  ];
  var WINTER = [
    { id: 'home',    name: 'Zuhause bleiben',                  pct: 0.00, fill: false, buffer: null,                                  moral: 0, rep: null,
      desc: 'Kurze Pause zuhause, danach normal weiter. Kein Extra-Schub für die Rückrunde.' },
    { id: 'refresh', name: 'Kurz-Refresh (Inland)',            pct: 0.03, fill: true,  buffer: { weeks: 2, drainFactor: 0.90, recoverBonus: 0 }, moral: 2, rep: null,
      desc: 'Ein paar Tage, um die ausgelaugte Mannschaft aufzutanken.' },
    { id: 'wlager',  name: 'Winter-Trainingslager (Süden)',    pct: 0.07, fill: true,  buffer: { weeks: 3, drainFactor: 0.80, recoverBonus: 3 }, moral: 4, rep: { eventFans: 3 },
      desc: 'Warmes Wetter, harte Einheiten — bringt Frische und Stimmung für die Rückrunde.' },
    { id: 'warm',    name: 'Warmwetter-Camp (Golf / Spanien)', pct: 0.14, fill: true,  buffer: { weeks: 4, drainFactor: 0.70, recoverBonus: 4 }, moral: 6, rep: { eventFans: 4 },
      desc: 'Top-Bedingungen im Süden. Volle Fitness und ein stabiler Puffer für den Endspurt.', featured: true }
  ];

  function tierKey() { try { return findFcmGroup(LEAGUE).tierKey; } catch (e) { return 'regionalliga'; } }
  function tierBudget() { try { return defaultBudgetForTier(tierKey()); } catch (e) { return 120000; } }
  function costOf(opt) { return Math.round(tierBudget() * (opt.pct || 0)); }
  function euro(v) { return (typeof formatEuro === 'function') ? formatEuro(v) : (v + ' €'); }

  // Qualitative Effekt-Chips für den Dialog.
  function optChips(opt) {
    if (opt.id === 'home') return '<span class="ev-chip"><i class="ti ti-minus"></i> nur reguläre Vorbereitung</span>';
    var c = [];
    if (opt.fill)   c.push('<span class="ev-chip"><i class="ti ti-barbell"></i> Topfit (Fitness 100)</span>');
    if (opt.buffer) c.push('<span class="ev-chip"><i class="ti ti-shield"></i> frisch für ~' + opt.buffer.weeks + ' Wochen</span>');
    if (opt.moral)  c.push('<span class="ev-chip"><i class="ti ti-mood-happy"></i> Moral +' + opt.moral + '</span>');
    if (opt.rep)    c.push('<span class="ev-chip"><i class="ti ti-thumb-up"></i> Ruf steigt</span>');
    return c.join(' ');
  }
  function effectText(opt) {
    if (opt.id === 'home') return 'Das Team bereitet sich regulär zuhause vor.';
    return 'Die Mannschaft ist topfit und bleibt rund ' + opt.buffer.weeks + ' Wochen frischer (Moral +' + opt.moral + ')' + (opt.rep ? ', der Ruf steigt' : '') + '.';
  }

  function overlayOpen() { return !!(document.querySelector('.exp-overlay') || document.getElementById('pm-overlay')); }

  function showCampDialog(kind) {
    if (document.querySelector('.exp-overlay')) return;
    var opts = (kind === 'summer') ? SUMMER : WINTER;
    var title = (kind === 'summer') ? '<i class="ti ti-sun"></i> Sommer-Vorbereitung' : '<i class="ti ti-snowflake"></i> Winter-Vorbereitung';
    var intro = (kind === 'summer')
      ? 'Die Sommervorbereitung steht an. Ein Trainingslager füllt die Fitness auf 100 und hält das Team über die ersten Wochen frischer. Wähle deine Vorbereitung.'
      : 'Winterpause. Ein Camp bringt die ausgelaugte Mannschaft zurück auf 100 und stabilisiert die Fitness für die Rückrunde.';
    var offersHtml = opts.map(function (opt, i) {
      var cost = costOf(opt);
      var afford = cost === 0 || (typeof CLUB !== 'undefined' && CLUB.budget >= cost);
      return '<div class="exp-offer' + (opt.featured ? ' camp-featured' : '') + '">'
        + (opt.featured ? '<div class="camp-badge">Top-Investment</div>' : '')
        + '<div class="exp-offer-name">' + opt.name + '</div>'
        + '<div class="exp-offer-flavor">' + opt.desc + '</div>'
        + '<div class="camp-cost' + (afford ? '' : ' no') + '">' + (cost === 0 ? 'kostenlos' : euro(cost)) + '</div>'
        + '<div class="ev-outcome">' + optChips(opt) + '</div>'
        + '<button class="exp-offer-btn" ' + (afford ? '' : 'disabled') + ' onclick="window.__bookCamp(\'' + kind + '\',' + i + ')">' + (afford ? 'Buchen' : 'Budget reicht nicht') + '</button>'
        + '</div>';
    }).join('');
    var ov = document.createElement('div');
    ov.className = 'exp-overlay';
    ov.innerHTML = '<div class="exp-dialog"><div class="exp-dialog-title">' + title + '</div>'
      + '<div class="exp-dialog-sub">' + intro + '</div>'
      + '<div class="exp-offer-grid camp-grid">' + offersHtml + '</div></div>';
    document.body.appendChild(ov);
  }

  window.__bookCamp = function (kind, idx) {
    var opts = (kind === 'summer') ? SUMMER : WINTER;
    var opt = opts[idx];
    if (!opt) return;
    var cost = costOf(opt);
    if (cost > 0 && (typeof CLUB === 'undefined' || CLUB.budget < cost)) return;
    if (cost > 0) CLUB.budget -= cost;
    if (opt.fill && typeof window.refillFitness === 'function') window.refillFitness(100);
    if (opt.buffer && typeof window.applyFitnessBuffer === 'function') window.applyFitnessBuffer(opt.buffer.weeks, opt.buffer.drainFactor, opt.buffer.recoverBonus);
    if (opt.moral && window.MoraleSystem && MoraleSystem.addMorale) {
      try { MoraleSystem.addMorale(SQUAD.filter(function (p) { return !p.onLoanAt; }), opt.moral); } catch (e) {}
    }
    if (opt.rep && typeof EXP !== 'undefined' && EXP.applyDelta) {
      try { EXP.applyDelta(opt.rep, 'camp'); } catch (e) {}
    }
    if (typeof CLUB !== 'undefined') {
      if (!CLUB._campBooked) CLUB._campBooked = {};
      CLUB._campBooked[kind] = (typeof LEAGUE !== 'undefined') ? LEAGUE.season : 1;
    }
    var lbl = (kind === 'summer') ? 'Sommer-Vorbereitung' : 'Winter-Vorbereitung';
    var txt = (opt.id === 'home')
      ? effectText(opt)
      : ('Gebucht: ' + opt.name + (cost > 0 ? ' für ' + euro(cost) : '') + '. ' + effectText(opt));
    if (typeof addNews === 'function') addNews('club', '🏕️ ' + lbl + ': ' + opt.name, txt);
    var o = document.querySelector('.exp-overlay'); if (o) o.remove();
    if (typeof saveGameState === 'function') saveGameState();
    if (typeof renderHomeTab === 'function') renderHomeTab();
  };

  // Bereits in dieser Saison für dieses Fenster gebucht?
  function booked(kind) {
    var season = (typeof LEAGUE !== 'undefined') ? LEAGUE.season : 1;
    return (typeof CLUB !== 'undefined' && CLUB._campBooked && CLUB._campBooked[kind] === season);
  }
  // Passendes Fenster? Sommer nur vor dem 1. Spieltag, Winter im Winterfenster.
  function maybeOfferCamp() {
    if (typeof LEAGUE === 'undefined' || !LEAGUE) return;
    if (overlayOpen()) return;
    var win;
    try { win = transferWindowInfo(LEAGUE.week); } catch (e) { return; }
    if (!win || !win.open) return;
    if (win.type === 'Sommer' && (LEAGUE.matchday || 0) === 0 && !booked('summer')) { showCampDialog('summer'); return; }
    if (win.type === 'Winter' && !booked('winter')) { showCampDialog('winter'); return; }
  }

  // Auto-Trigger an den Wochen-Tick hängen (nach fitness_patch, das advanceCalendarWeek ebenfalls wrappt).
  if (typeof window.advanceCalendarWeek === 'function') {
    var _adv = window.advanceCalendarWeek;
    window.advanceCalendarWeek = function () {
      var r = _adv.apply(this, arguments);
      try { maybeOfferCamp(); } catch (e) { console.warn('[PrepCamps] offer', e); }
      return r;
    };
    try { advanceCalendarWeek = window.advanceCalendarWeek; } catch (e) {}
  }

  // Zum manuellen Testen/Öffnen aus der Konsole.
  window.PrepCamps = { show: showCampDialog, summer: SUMMER, winter: WINTER, cost: costOf };

  console.log('[PrepCamps v1] aktiv — Sommer-/Winter-Vorbereitung mit Fitness-Puffer, Moral & Ruf');
})();
