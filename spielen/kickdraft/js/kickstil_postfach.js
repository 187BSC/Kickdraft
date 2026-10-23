/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · POSTFACH KURZ  ·  v1   (Rückmeldung 2026-10-18: „Postfach auf 3 Nachrichten reduzieren und einen einfach
   zugänglichen Reset-Knopf finden“)
   ─────────────────────────────────────────────────────────────────────────
   Gleiche Datei für beide Spiele (Quelle flutlicht_manager/js, nach kickdraft/spiel/js kopieren).
   Das Postfach zeigt höchstens 3 Einträge (Angebote und Warnungen zuerst, wie bisher sortiert). „Leeren“ in der Filterleiste
   löscht alle Nachrichten (CLUB.news); offene Angebote und Warnungen bleiben, solange es sie gibt.
   Hängt an: renderPostfach (app_main.js).  API: KSPostfach.leeren() · .MAX
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const MAX = 3;
  function leeren() {
    if (typeof CLUB === 'undefined' || !CLUB) return;
    if (!confirm('Postfach leeren?\nAlle Nachrichten werden gelöscht. Offene Angebote bleiben.')) return;
    CLUB.news = [];
    try { if (typeof saveGameState === 'function') saveGameState(); } catch (e) { /* ohne Speichern */ }
    try { if (typeof renderPostfach === 'function') renderPostfach(); } catch (e) { /* ohne Postfach */ }
    try { if (typeof renderHomeTab === 'function') renderHomeTab(); } catch (e) { /* ohne Office */ }
  }
  function kuerzen() {
    const el = document.getElementById('postfach-list'); if (!el) return;
    const items = [...el.querySelectorAll(':scope > .pf-item')];
    items.slice(MAX).forEach(x => x.remove());
    const fl = document.getElementById('pf-filters');
    const news = typeof CLUB !== 'undefined' && CLUB && (CLUB.news || []).length;
    if (fl && news && !fl.querySelector('.pf-leeren')) {
      fl.insertAdjacentHTML('beforeend', '<button type="button" class="pf-chip pf-leeren" onclick="KSPostfach.leeren()"><i class="ti ti-trash" aria-hidden="true"></i> Leeren</button>');
    }
  }
  // Die Liste selbst auf 3 kürzen (Angebote/Warnungen zuerst, dann die neuesten Nachrichten) – so stimmen auch die Zähler
  const _bauen = window.buildPostfachItems;
  if (typeof _bauen === 'function') {
    window.buildPostfachItems = function () {
      const items = _bauen.apply(this, arguments);
      if (!Array.isArray(items) || items.length <= MAX) return items;
      return items.slice().sort((a, b) => ((b.prio || 0) - (a.prio || 0)) || ((b.ts || 0) - (a.ts || 0))).slice(0, MAX);
    };
    try { buildPostfachItems = window.buildPostfachItems; } catch (e) { /* window reicht */ }
  }
  const _orig = window.renderPostfach;
  if (typeof _orig === 'function') {
    window.renderPostfach = function () {
      const r = _orig.apply(this, arguments);
      try { kuerzen(); } catch (e) { console.warn('[KS-Postfach]', e); }
      return r;
    };
    try { renderPostfach = window.renderPostfach; } catch (e) { /* window reicht */ }
  }
  const st = document.createElement('style');
  st.textContent = '.pf-chip.pf-leeren{margin-left:auto;color:var(--k-rot,#c0392b)}';
  document.head.appendChild(st);
  window.KSPostfach = { leeren, MAX };
  console.log('[KS-Postfach v1] aktiv — höchstens 3 Einträge, Leeren-Knopf');
})();
