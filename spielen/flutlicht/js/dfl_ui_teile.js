/* ═══════════════════════════════════════════════════════════════════════════
   DFL · UI-TEILE  ·  v1   (D52, freigegeben 2026-10-09: „vom UI siehts erstmal ok aus“)
   ─────────────────────────────────────────────────────────────────────────
   Zwei Teile aus Kenneys „UI Pack“ (CC0, app/ui/), bewusst nur diese – die glänzenden Knöpfe passen
   nicht zu „Freundlich dunkel“:
     · Regler statt −/+ für Tageskarte und Dauerkarte (Verein → Finanzen); Ziehen zeigt den Preis,
       Loslassen übernimmt ihn (setTicketLevel / setSeasonTicketLevel wie bisher)
     · Sterne fürs Potenzial: aus der Scouting-Spanne (potentialRange), halbe Sterne möglich
   API: DFLUiTeile.sterne(spanne) · .sterneZahl(spanne)
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ── Sterne: 92+ = 5, je 6 Punkte weniger ein Stern ────────────────────────
  function sterneZahl(r) {
    if (!r) return 0;
    const mitte = (r.lo + r.hi) / 2;
    return Math.max(0.5, Math.min(5, Math.round((mitte - 62) / 6 * 2) / 2));
  }
  function sterne(r) {
    const n = sterneZahl(r);
    if (!n) return '';
    const text = String(n).replace('.', ',') + ' von 5 Sternen';
    return `<span class="dfl-sterne" role="img" aria-label="Potenzial ${text}" title="Potenzial: ${text}">` +
      Array.from({ length: 5 }, (_, i) => {
        const teil = Math.max(0, Math.min(1, n - i));
        return `<i>${teil ? `<b style="width:${teil * 100}%"></b>` : ''}</i>`;
      }).join('') + '</span>';
  }

  // ── Regler für die Ticketpreise ───────────────────────────────────────────
  const REGLER = [
    { fn: 'setTicketLevel', feld: 'ticketLevel', preis: () => (typeof currentTicketPrice === 'function' ? currentTicketPrice() : 0), name: 'Tageskarte' },
    { fn: 'setSeasonTicketLevel', feld: 'seasonTicketLevel', preis: () => (typeof currentSeasonTicketPrice === 'function' ? currentSeasonTicketPrice() : 0), name: 'Dauerkarte' }
  ];
  const stufeText = v => (typeof PRICE_LEVEL_LABELS !== 'undefined' ? PRICE_LEVEL_LABELS[v + 2] : '');
  function regler() {
    if (typeof CLUB === 'undefined' || !CLUB) return;
    REGLER.forEach(R => {
      const knopf = document.querySelector(`button[onclick="${R.fn}(-1)"]`);
      const zeile = knopf && knopf.parentElement;
      if (!zeile || zeile.dataset.regler) return;
      const wert = Math.max(-2, Math.min(2, CLUB[R.feld] || 0));
      zeile.dataset.regler = '1';
      zeile.className = 'dfl-regler-zeile'; zeile.removeAttribute('style');
      if (zeile.parentElement) zeile.parentElement.classList.add('mit-regler');   // Regler unter die Beschriftung
      zeile.innerHTML = `<input type="range" class="dfl-regler" min="-2" max="2" step="1" value="${wert}" aria-label="${R.name}: Preisstufe">
        <b class="dfl-regler-wert">${R.preis()} € <span>${stufeText(wert)}</span></b>`;
      const ein = zeile.querySelector('input'), aus = zeile.querySelector('.dfl-regler-wert');
      const fuellen = () => ein.style.setProperty('--anteil', ((+ein.value + 2) / 4 * 100) + '%');
      fuellen();
      ein.addEventListener('input', () => {
        CLUB[R.feld] = +ein.value;                  // nur anzeigen; übernommen wird beim Loslassen
        aus.innerHTML = `${R.preis()} € <span>${stufeText(+ein.value)}</span>`; fuellen();
      });
      ein.addEventListener('change', () => { CLUB[R.feld] = +ein.value; if (typeof window[R.fn] === 'function') window[R.fn](0); });
    });
  }
  if (typeof window.renderFinancePanel === 'function') {
    const _orig = window.renderFinancePanel;
    window.renderFinancePanel = function () {
      const r = _orig.apply(this, arguments);
      try { regler(); } catch (e) { console.warn('[DFL-UI-Teile] Regler', e); }
      return r;
    };
    try { renderFinancePanel = window.renderFinancePanel; } catch (e) { /* nicht global gebunden */ }
  }

  window.DFLUiTeile = { sterne, sterneZahl, regler };
  console.log('[DFL-UI-Teile v1] aktiv — Regler für Ticketpreise, Sterne fürs Potenzial (Kenney UI Pack, CC0)');
})();
