/* ═══════════════════════════════════════════════════════════════════════════
   GESAMT-APP · KICKDRAFT · WERBUNG  ·  v2   (2026-10-15, v2 2026-10-16: Saisonanzeige nach dem Rückblick)
   Wird von bauen.sh in Kickdraft eingehängt, NACH werbung.js (= flutlicht_manager/js/kickstil_werbung.js): beide Spiele
   nutzen dasselbe Gerüst (app-weiter 30-Minuten-Zähler, Pro-Status, Saisonabschluss immer, Platzhalter bis zum Werbekonto).
   Kickdrafts Cap-Bonus-Videos (dfl_werbung_patch.js, DFLWerbung) laufen über KSWerbung.video – Pro ohne Video.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (!window.KSWerbung) { console.warn('[Gesamt-Werbung] werbung.js fehlt'); return; }
  if (window.DFLWerbung && typeof DFLWerbung.anbieterSetzen === 'function') {
    DFLWerbung.anbieterSetzen(fertig => KSWerbung.video('Cap-Bonus', fertig));
  }
  // Saisonabschluss (2026-10-16, monetarisierung-anpassungen.md 2.6): Kickdraft zeigt nach „Saison abschließen“ den
  // Saison-Rückblick (chronicle_patch.js). Die Anzeige lief bisher im selben Moment und verdeckte ihn. Jetzt wartet sie, bis
  // man im Rückblick „Weiter“ tippt – das ruft openSponsorChoiceDialog erneut auf (dfl_saisonwechsel_patch.js) – und kommt
  // VOR Briefing, Draft und Sponsorenwahl. Notnagel: spätestens beim nächsten Wochenwechsel.
  // Merker im Gerätespeicher (gesamt-werbung.saisonOffen): überlebt ein Schließen der App mitten im Rückblick
  const lies = () => { try { return JSON.parse(localStorage.getItem('gesamt-werbung') || '{}') || {}; } catch (e) { return {}; } };
  const merke = an => { try { const z = lies(); if (an) z.saisonOffen = true; else delete z.saisonOffen; localStorage.setItem('gesamt-werbung', JSON.stringify(z)); } catch (e) { /* ohne Speicher */ } };
  const istOffen = () => !!lies().saisonOffen;
  const rueckblickOffen = () => !!document.querySelector('.exp-overlay');
  KSWerbung.saisonSpaeter = () => merke(true);
  function nachholen(danach) {
    if (!istOffen()) return false;
    merke(false);
    KSWerbung.uebergang('saison', danach);
    return true;
  }
  if (typeof window.openSponsorChoiceDialog === 'function') {
    const _o = window.openSponsorChoiceDialog;
    window.openSponsorChoiceDialog = function () {
      const self = this, args = arguments;
      if (istOffen() && !rueckblickOffen()) { nachholen(() => _o.apply(self, args)); return undefined; }
      return _o.apply(this, arguments);
    };
    try { openSponsorChoiceDialog = window.openSponsorChoiceDialog; } catch (e) { /* window reicht */ }
  }
  if (typeof window.advanceCalendarWeek === 'function') {
    const _w = window.advanceCalendarWeek;
    window.advanceCalendarWeek = function () { try { if (!rueckblickOffen()) nachholen(); } catch (e) { /* ohne Anzeige */ } return _w.apply(this, arguments); };
    try { advanceCalendarWeek = window.advanceCalendarWeek; } catch (e) { /* window reicht */ }
  }
  console.log('[Gesamt-Werbung v2] aktiv — Kickdraft nutzt das gemeinsame Werbe-Gerüst; Saisonanzeige erst nach dem Rückblick');
})();
