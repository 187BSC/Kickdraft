/* ===== lineup_guard_patch.js =====
   AUFSTELLUNGS-SCHUTZ
   ─────────────────────────────────────────────────────────────────────────────
   Problem: Verlassen Spieler den Verein (Karriereende am Saisonende, Verkauf,
   auslaufender Vertrag), werden ihre Aufstellungs-Slots geleert — aber nichts
   füllt sie nach. Mit leeren Slots lassen sich Spiele trotzdem simulieren; dann
   werden aber KEINE Einsätze, Tore, Noten, Prämien und keine Einsatzzeit-
   Zufriedenheit gutgeschrieben. Das passiert lautlos und entwertet die gesamte
   Statistik-/Karriere-Tiefe.

   Lösung (3-fach):
     1. Hinweis-Banner im Spieltag-Tab, wenn Plätze frei sind
     2. Knopf „Automatisch aufstellen" (beste verfügbare Spieler)
     3. SICHERHEITSNETZ: vor Anpfiff/Simulation werden leere Slots automatisch
        besetzt — so geht nie wieder eine Saison Statistik verloren.
   Lädt NACH match_simulation_patch.js (wrappt simulateCurrentFixture/handleKO).
   ============================================================================= */
(function () {
  'use strict';

  function formationSlots() {
    try {
      if (typeof FORMATIONS === 'undefined' || typeof CLUB === 'undefined' || !CLUB) return [];
      return FORMATIONS[CLUB.formation] || [];
    } catch (e) { return []; }
  }
  // Ein Slot gilt als "leer", wenn er unbesetzt ist ODER auf einen Spieler zeigt,
  // den es nicht mehr im Kader gibt (abgegangen/zurückgetreten).
  function slotEmpty(id) {
    if (!id) return true;
    try { const p = getPlayer(id); return !p || !(typeof SQUAD !== 'undefined' && SQUAD.some(x => x.id === id)); } catch (e) { return true; }
  }
  function emptySlots() {
    const ln = (typeof CLUB !== 'undefined' && CLUB && CLUB.lineup) ? CLUB.lineup : {};
    return formationSlots().filter(s => slotEmpty(ln[s.id]));
  }
  function posOfSlot(slot) {
    try {
      if (window.TacticsSystem && typeof TacticsSystem.slotToPos === 'function') return TacticsSystem.slotToPos(slot);
    } catch (e) {}
    return slot.label || slot.group || 'ZM';
  }
  // Einsetzbar: im Kader, nicht verletzt/gesperrt/verliehen/streikend, noch nicht aufgestellt.
  function candidates(used) {
    const sq = (typeof SQUAD !== 'undefined' && SQUAD) ? SQUAD : [];
    return sq.filter(p => p && !used.has(p.id) && !p.onLoanAt && !p.onStrike
      && !(typeof isInjured === 'function' && isInjured(p))
      && !(typeof isSuspended === 'function' && isSuspended(p)));
  }

  // Füllt NUR leere Slots mit den besten passenden Spielern. Gibt die Anzahl zurück.
  window.autoFillLineup = function () {
    if (typeof CLUB === 'undefined' || !CLUB) return 0;
    if (!CLUB.lineup) CLUB.lineup = {};
    // Veraltete Slots (Spieler weg) erst leeren, damit sie neu besetzt werden.
    formationSlots().forEach(slot => { if (slotEmpty(CLUB.lineup[slot.id])) CLUB.lineup[slot.id] = null; });
    const used = new Set(Object.values(CLUB.lineup).filter(Boolean));
    let filled = 0;
    formationSlots().forEach(slot => {
      if (CLUB.lineup[slot.id]) return;
      const pos = posOfSlot(slot);
      let best = null, bestScore = -Infinity;
      candidates(used).forEach(p => {
        const list = (p.positions && p.positions.length) ? p.positions : [p.pos];
        // Positions-Treffer wiegt schwer (ein Feldspieler im Tor wäre fatal)
        const score = (p.ovr || 0) + (list.indexOf(pos) === 0 ? 30 : list.includes(pos) ? 22 : 0);
        if (score > bestScore) { bestScore = score; best = p; }
      });
      if (best) { CLUB.lineup[slot.id] = best.id; used.add(best.id); filled++; }
    });
    if (filled) {
      try { if (typeof renderAll === 'function') renderAll(); } catch (e) {}
      try { if (typeof syncClubToTeams === 'function') syncClubToTeams(); } catch (e) {}
      try { if (typeof saveGameState === 'function') saveGameState(); } catch (e) {}
    }
    return filled;
  };

  // Knopf-Handler
  window.autoFillLineupAndRefresh = function () {
    const n = window.autoFillLineup();
    if (typeof showToast === 'function') {
      showToast(n ? `Aufstellung vervollständigt — ${n} Position${n > 1 ? 'en' : ''} besetzt.` : 'Aufstellung ist bereits vollständig.', n ? 'success' : 'info');
    }
    updateLineupWarning();
  };

  // Hinweis-Banner im Spieltag-Tab
  function updateLineupWarning() {
    const host = document.getElementById('view-match');
    if (!host) return;
    let el = host.querySelector(':scope > .lineup-warn');
    const miss = emptySlots().length;
    if (!miss) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.className = 'lineup-warn'; host.insertBefore(el, host.firstChild); }
    el.innerHTML = '<i class="ti ti-alert-triangle"></i>' +
      '<span>Deine Aufstellung ist unvollständig — <b>' + miss + '</b> ' + (miss > 1 ? 'Plätze' : 'Platz') + ' frei. ' +
      'Ohne vollständige Elf zählen Einsätze und Tore nicht.</span>' +
      '<button class="nego-btn primary" onclick="autoFillLineupAndRefresh()">Automatisch aufstellen</button>';
  }
  window.updateLineupWarning = updateLineupWarning;

  // Banner beim Laden eines Spiels aktualisieren
  if (typeof window.goToFixture === 'function') {
    const _o = window.goToFixture;
    window.goToFixture = function () { const r = _o.apply(this, arguments); try { updateLineupWarning(); } catch (e) {} return r; };
    try { goToFixture = window.goToFixture; } catch (e) {}
  }

  // SICHERHEITSNETZ vor Anpfiff/Simulation
  function guardBeforeMatch(still) {
    if (typeof CLUB === 'undefined' || !CLUB || !CLUB.lineup) return;
    const slots = formationSlots();
    // 2026-10-21 (Fehleranalyse F3): Verletzte, Gesperrte und Streikende erst raus – vorher spielten sie beim Simulieren mit voller Stärke
    let raus = 0;
    slots.forEach(slot => {
      const id = CLUB.lineup[slot.id]; const p = id ? getPlayer(id) : null;
      if (p && ((typeof isAvailable === 'function' && !isAvailable(p)) || p.onStrike)) { CLUB.lineup[slot.id] = null; raus++; }
    });
    // Notbremse (F1): weniger Einsatzbereite ohne Streik als Plätze → Streikende dürfen mit Abschlag mit (engine_v2_adapter)
    const frei = (typeof SQUAD !== 'undefined' ? SQUAD : []).filter(p => p && !p.onLoanAt && !p.perspektiv && !p.onStrike && (typeof isAvailable !== 'function' || isAvailable(p)));
    (typeof SQUAD !== 'undefined' ? SQUAD : []).forEach(p => { if (p) delete p._streikNotbremse; });
    if (!emptySlots().length && !raus) return;
    let n = window.autoFillLineup();
    if (frei.length < slots.length) {
      const streik = (typeof SQUAD !== 'undefined' ? SQUAD : []).filter(p => p && p.onStrike && !p.onLoanAt && (typeof isAvailable !== 'function' || isAvailable(p)))
        .sort((a, b) => (b.ovr || 0) - (a.ovr || 0));
      const drin = new Set(Object.values(CLUB.lineup).filter(Boolean));
      slots.forEach(slot => { if (CLUB.lineup[slot.id]) return; const p = streik.find(x => !drin.has(x.id)); if (p) { CLUB.lineup[slot.id] = p.id; drin.add(p.id); p._streikNotbremse = true; n++; } });
      if (n && !still && typeof showToast === 'function') showToast('Zu wenige einsatzbereite Spieler – Streikende spielen mit Abschlag mit.', 'warn');
    }
    if (n && !still && typeof showToast === 'function') {
      showToast(`Aufstellung war unvollständig — ${n} Position${n > 1 ? 'en' : ''} automatisch besetzt.`, 'warn');
    }
    try { updateLineupWarning(); } catch (e) {}
  }
  // Nach jedem Wochenwechsel still nachfüllen, damit die Aufstellung zwischen den Spielen nicht leer bleibt (F1/F3)
  if (typeof window.advanceCalendarWeek === 'function') {
    const _acw = window.advanceCalendarWeek;
    window.advanceCalendarWeek = function () { const r = _acw.apply(this, arguments); try { guardBeforeMatch(true); } catch (e) {} return r; };
    try { advanceCalendarWeek = window.advanceCalendarWeek; } catch (e) {}
  }
  ['simulateCurrentFixture', 'handleKO'].forEach(fn => {
    if (typeof window[fn] === 'function') {
      const _o = window[fn];
      window[fn] = function () { try { guardBeforeMatch(); } catch (e) {} return _o.apply(this, arguments); };
    }
  });
  try { handleKO = window.handleKO; } catch (e) {}
  try { simulateCurrentFixture = window.simulateCurrentFixture; } catch (e) {}

  console.log('[LineupGuard] aktiv — Aufstellungs-Hinweis, Auto-Aufstellen & Sicherheitsnetz');
})();
