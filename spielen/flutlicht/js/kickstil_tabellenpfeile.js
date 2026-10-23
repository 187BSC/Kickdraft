/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · TABELLENPFEILE · v1  (2026-10-22, Nutzer: „Tabelle und die Veränderungspfeile … bei der Platzierung“ – in Kickdraft
   umgesetzt, „bitte das alles auch für die Vereinskarriere“)
   ─────────────────────────────────────────────────────────────────────────
   Vor jedem Spieltag (advanceMatchday) merkt sich das Spiel die Plätze aller Gruppen; die Ligatabelle (#lg-sub-tabelle,
   bundle_europa.js renderSelectedTable) zeigt danach neben dem Platz ▲n / ▼n gegenüber dem Spieltag davor.
   Zustand: LEAGUE.ksPlatzVorher = { saison, md, plaetze: { Gruppenname: { teamId: Platz } } }
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const hatLiga = () => { try { return typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.tiers && typeof computeTable === 'function'; } catch (e) { return false; } };
  function merken() {
    if (!hatLiga() || typeof allGroups !== 'function') return;
    const plaetze = {};
    allGroups(LEAGUE).forEach(({ group }) => {
      if (!group || !group.teams || !group.name) return;
      const m = {}; computeTable(group.teams).forEach((t, i) => { m[t.id] = i + 1; }); plaetze[group.name] = m;
    });
    LEAGUE.ksPlatzVorher = { saison: LEAGUE.season, md: LEAGUE.matchday, plaetze };
  }
  const _orig = window.advanceMatchday;
  if (typeof _orig === 'function') {
    window.advanceMatchday = function (league) {
      try { if (league === LEAGUE && (league.matchday || 0) > 0) merken(); } catch (e) { console.warn('[Kickstil-Tabellenpfeile] merken', e); }
      return _orig.apply(this, arguments);
    };
    try { advanceMatchday = window.advanceMatchday; } catch (e) { /* nur im Spiel */ }
  }
  // Pfeile in die gezeichnete Tabelle (Zeile → Team über showTeamProfile('id'), Gruppe über die Überschrift)
  function pfeile(el) {
    const V = hatLiga() && LEAGUE.ksPlatzVorher;
    if (!V || V.saison !== LEAGUE.season || !el || el.querySelector('.ks-pf')) return;
    // Gruppe über die Vereine der Tabelle finden – die Überschrift zeigt den Anzeigenamen („Dritte Liga“), gespeichert ist der
    // Gruppenname („3. Liga“); ohne diese Zuordnung kamen in der Vereinskarriere nie Pfeile (2026-10-22, PC-Abgleich)
    const zeilen = [...el.querySelectorAll('table.lg-table tbody tr')];
    const ids = zeilen.map(tr => (/showTeamProfile\('([^']+)'\)/.exec(tr.getAttribute('onclick') || '') || [])[1]).filter(Boolean);
    const h = el.querySelector('.lg-header h3');
    const vor = (h && V.plaetze[h.textContent.trim()]) || Object.values(V.plaetze).find(m => ids.length && ids.every(id => m[id] != null));
    if (!vor) return;
    zeilen.forEach((tr, i) => {
      const m = /showTeamProfile\('([^']+)'\)/.exec(tr.getAttribute('onclick') || ''), td = tr.querySelector('td.lg-pos');
      if (!m || !td || vor[m[1]] == null) return;
      const d = vor[m[1]] - (i + 1);
      td.insertAdjacentHTML('beforeend', `<span class="ks-pf${d > 0 ? ' auf' : d < 0 ? ' ab' : ''}"${d ? ` aria-label="${Math.abs(d)} Plätze ${d > 0 ? 'besser' : 'schlechter'}"` : ''}>${d > 0 ? '▲' + d : d < 0 ? '▼' + -d : ''}</span>`);
    });
  }
  function beobachten() {
    const el = document.getElementById('lg-sub-tabelle'); if (!el || el._ksPf) return;
    el._ksPf = true;
    new MutationObserver(() => { try { pfeile(el); } catch (e) { /* nur Anzeige */ } }).observe(el, { childList: true });
    pfeile(el);
  }
  const st = document.createElement('style');
  st.textContent = `.lg-table td.lg-pos{white-space:nowrap}.ks-pf{display:inline-block;min-width:18px;margin-left:3px;font-size:10px;font-weight:800;line-height:1;text-align:left}
    .ks-pf.auf{color:var(--app-gut,#2e9e4f)}.ks-pf.ab{color:var(--app-schlecht,#d0402f)}`;
  document.head.appendChild(st);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', beobachten); else beobachten();
  setInterval(beobachten, 2000);                 // die Ligaansicht entsteht erst beim ersten Öffnen
  window.KSTabellenpfeile = { merken, pfeile };
  console.log('[Kickstil-Tabellenpfeile v1] aktiv — ▲/▼ neben dem Platz');
})();
