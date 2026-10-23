/* ===== tab_headers_patch.js =====
   Broadcast-Scorebug-Kopf oben auf den Haupt-Reitern (Kader/Verein/Transfer).
   Grüner Akzentbalken + Kapitälchen-Kicker + Titel + Info-Pille rechts — wie im
   abgesegneten Mockup (mockup_broadcast_tabs.html). Spieltag hat bereits die
   Scorebug-Topbar, Liga/Europa eigene Header → hier nur die drei ohne.
   Lädt NACH app_main.js; hängt sich an switchAppView an.
   ============================================================================= */
(function () {
  'use strict';

  function clubNm() { try { return (typeof clubName === 'function') ? clubName() : 'Verein'; } catch (e) { return 'Verein'; } }

  // Kopf-Inhalt je Reiter: { kicker, title, pill }.
  function headSpec(view) {
    switch (view) {
      case 'squad': {
        const n = (typeof SQUAD !== 'undefined' && SQUAD) ? SQUAD.length : 0;
        return { kicker: clubNm(), title: 'Kader & Taktik', pill: n ? n + ' Spieler' : '' };
      }
      case 'club': {
        const lg = (typeof CLUB !== 'undefined' && CLUB && CLUB.leagueName) ? CLUB.leagueName : '';
        return { kicker: clubNm(), title: 'Verein', pill: lg };
      }
      case 'transfer': {
        let pill = '';
        try {
          if (typeof transferWindowInfo === 'function' && typeof LEAGUE !== 'undefined' && LEAGUE) {
            const w = transferWindowInfo(LEAGUE.week);
            pill = w.open ? ('Fenster offen · ' + w.type) : 'Fenster geschlossen';
          }
        } catch (e) {}
        return { kicker: 'Transfermarkt', title: 'Transfers', pill };
      }
      default: return null;
    }
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])); }

  function mountHead(view) {
    const host = document.getElementById('view-' + view);
    if (!host) return;
    const spec = headSpec(view);
    if (!spec) return;
    let hd = host.querySelector(':scope > .sb-tabhead');
    if (!hd) { hd = document.createElement('div'); hd.className = 'sb-tabhead'; host.insertBefore(hd, host.firstChild); }
    hd.innerHTML =
      '<span class="sb-bar"></span>' +
      '<span class="sb-txt"><span class="sb-kicker">' + esc(spec.kicker) + '</span>' +
      '<span class="sb-title">' + esc(spec.title) + '</span></span>' +
      (spec.pill ? '<span class="sb-pill">' + esc(spec.pill) + '</span>' : '');
  }

  function mountAll() { ['squad', 'club', 'transfer'].forEach(mountHead); }

  // An switchAppView anhängen (aktualisiert Pillen bei jedem Reiterwechsel).
  if (typeof window.switchAppView === 'function') {
    const _orig = window.switchAppView;
    window.switchAppView = function () {
      const r = _orig.apply(this, arguments);
      try { mountAll(); } catch (e) {}
      return r;
    };
    try { switchAppView = window.switchAppView; } catch (e) {}
  }

  // Auch bei relevanten Re-Renders auffrischen (Kadergröße/Budget ändern sich).
  ['renderClubTab', 'renderTransferTab', 'renderSquadList'].forEach(fn => {
    if (typeof window[fn] === 'function') {
      const _o = window[fn];
      const v = fn === 'renderClubTab' ? 'club' : fn === 'renderTransferTab' ? 'transfer' : 'squad';
      window[fn] = function () { const r = _o.apply(this, arguments); try { mountHead(v); } catch (e) {} return r; };
    }
  });

  try { mountAll(); } catch (e) {}
  console.log('[TabHeaders] aktiv — Broadcast-Scorebug-Kopf auf Kader/Verein/Transfer');
})();
