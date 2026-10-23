/* =====================================================================
   MATCHDAY FX PATCH v1 — TV-Lower-Thirds bei Toren
   Umhüllt scoreGoal(team) und lässt unten im Spieltag-View eine
   Broadcast-Grafik (Team · Spielstand · Torschütze · Minute) einfahren.
   Lädt NACH bundle_match (scoreGoal-Wrapper).
   ===================================================================== */
(function () {
  'use strict';

  function ensureBar() {
    var host = document.getElementById('view-match') || document.body;
    var el = document.getElementById('lower-third');
    if (!el) { el = document.createElement('div'); el.id = 'lower-third'; el.className = 'lower-third'; host.appendChild(el); }
    return el;
  }
  var hideTimer = null;
  window.showLowerThird = function (kind, title, sub) {
    var el = ensureBar();
    var badge = kind === 'goal' ? '<i class="ti ti-ball-football"></i> TOR' : kind === 'card' ? '<i class="ti ti-square-filled" style="color:#f2c14e"></i> KARTE' : '<i class="ti ti-info-circle"></i>';
    el.className = 'lower-third lt-' + (kind || 'goal');
    el.innerHTML = '<span class="lt-badge">' + badge + '</span>' +
      '<span class="lt-title">' + title + '</span>' +
      (sub ? '<span class="lt-sub">' + sub + '</span>' : '');
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); // Animation neu starten
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(function () { el.classList.remove('show'); }, 3500);
  };

  if (typeof window.scoreGoal === 'function') {
    var _sg = window.scoreGoal;
    window.scoreGoal = function (team) {
      var r = _sg.apply(this, arguments);
      try {
        var last = (typeof G !== 'undefined' && G.scorers && G.scorers.length) ? G.scorers[G.scorers.length - 1] : null;
        var isHome = (team === 0);
        var teamName = isHome
          ? (typeof clubShort === 'function' ? clubShort() : 'FCM')
          : ((typeof TEAMS !== 'undefined' && TEAMS.away) ? TEAMS.away.name : 'Gegner');
        var scorer = last && last.name ? last.name : '';
        var min = last && last.min != null ? last.min : (typeof G !== 'undefined' ? G.min : '');
        var score = (typeof G !== 'undefined') ? (G.homeGoals + ':' + G.awayGoals) : '';
        window.showLowerThird('goal', teamName + '  ' + score, (scorer ? scorer + ' · ' : '') + min + "'");
      } catch (e) {}
      return r;
    };
    try { scoreGoal = window.scoreGoal; } catch (e) {}
    console.log('[MatchdayFX v1] aktiv — TV-Lower-Thirds bei Toren');
  } else {
    console.warn('[MatchdayFX v1] scoreGoal nicht gefunden — Lower-Thirds inaktiv');
  }
})();
