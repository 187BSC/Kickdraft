/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · FRONT OFFICE  ·  v1   (Nutzer 2026-10-18: Aufteilung wie Kickdraft, „95 % des Hauptspiels in den vier Reitern“,
   Bild 3 „die anderen passen“)
   ─────────────────────────────────────────────────────────────────────────
   Nur Flutlicht. Der vierte Reiter heißt „Front Office“ (vorher „Transfer“) und hat oben die Reiter
   Transfer · Scouting · Verein · Finanzen. Scouting = bisherige Ansicht „Nachwuchs & Scouting“, Verein und Finanzen = die
   Vereinsansicht, je nur mit ihren Teilen (Verein: Anlagen, Vorstand, Trikots, Trainer, Chronik; Finanzen: Kasse, Übersicht,
   Tickets, Sponsoren, Anlagen-Geld). Beides stand vorher unter „Mehr“.
   API: KSFrontOffice.zeige(teil)
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const TEILE = [['transfer', 'Transfer'], ['scout', 'Scouting'], ['verein', 'Verein'], ['finanzen', 'Finanzen']];
  let teil = 'transfer';
  function leiste(view) {
    const v = document.getElementById('view-' + view); if (!v) return;
    let l = v.querySelector(':scope > .ksfo-tabs');
    if (!l) { l = document.createElement('div'); l.className = 'subtabs ksfo-tabs'; v.prepend(l); }
    l.innerHTML = TEILE.map(([k, n]) => `<button type="button" class="subtab${k === teil ? ' active' : ''}" data-fo="${k}">${n}</button>`).join('');
  }
  function navMarkieren() {
    document.querySelectorAll('#app-nav .app-nav-btn').forEach(b => b.classList.toggle('an', b.getAttribute('data-nav') === 'transfer'));
  }
  function zeige(t) {
    teil = t || 'transfer';
    const view = teil === 'verein' || teil === 'finanzen' ? 'club' : teil;
    if (window.DFLAppShell && DFLAppShell.zeige) DFLAppShell.zeige(view);
    nachher(view);
  }
  function nachher(view) {
    document.body.classList.toggle('ksfo-verein', view === 'club' && teil === 'verein');
    document.body.classList.toggle('ksfo-finanzen', view === 'club' && teil === 'finanzen');
    leiste(view); navMarkieren(); setTimeout(navMarkieren, 150); window.scrollTo(0, 0);
  }
  document.addEventListener('click', ev => {
    const b = ev.target.closest && ev.target.closest('.ksfo-tabs [data-fo]'); if (!b) return;
    zeige(b.getAttribute('data-fo'));
  });
  const _view = window.switchAppView;
  if (typeof _view === 'function') {
    window.switchAppView = function (view) {
      const r = _view.apply(this, arguments);
      if (view === 'transfer' || view === 'scout' || view === 'club') {
        if (view === 'transfer') teil = 'transfer'; else if (view === 'scout') teil = 'scout'; else if (teil !== 'finanzen') teil = 'verein';
        setTimeout(() => nachher(view), 0);
      } else document.body.classList.remove('ksfo-verein', 'ksfo-finanzen');
      return r;
    };
    try { switchAppView = window.switchAppView; } catch (e) { /* window reicht */ }
  }
  // Leiste unten: „Transfer“ heißt „Front Office“
  const umbenennen = () => {
    const b = document.querySelector('#app-nav .app-nav-btn[data-nav="transfer"]'); if (!b) { setTimeout(umbenennen, 400); return; }
    const s = b.querySelector('span'), i = b.querySelector('.ti');
    if (s) s.textContent = 'Front Office'; if (i) i.className = 'ti ti-briefcase';
  };
  umbenennen();

  const st = document.createElement('style');
  st.textContent = `
  .ksfo-tabs{display:flex;margin:10px 12px 10px}.ksfo-tabs .subtab{flex:1 1 0;justify-content:center}
  body.ksfo-verein #view-club #club-banner, body.ksfo-verein #view-club #finance-dash, body.ksfo-verein #view-club .sponsor-section,
  body.ksfo-verein #view-club #club-facilities > div:not(.facility-card):first-child{display:none!important}
  body.ksfo-finanzen #view-club .facility-card, body.ksfo-finanzen #view-club #exp-panel, body.ksfo-finanzen #view-club #kt-trikots,
  body.ksfo-finanzen #view-club #kstr-verein, body.ksfo-finanzen #view-club #ks-trainerteam, body.ksfo-finanzen #view-club .club-chronicle,
  body.ksfo-finanzen #view-club #club-danger-zone, body.ksfo-finanzen #view-club > .ef-pc, body.ksfo-finanzen #view-club > .ksj-pc{display:none!important}
  /* Bilanz-Kacheln in der Zahlenschrift des Spiels (Nutzer 2026-10-18: „der Font passt nicht“) */
  #finance-dash .fin-balance, #finance-dash .fin-balance *{font-family:var(--font-zahl,var(--font-text,inherit))!important}
  #finance-dash .fin-balance [class*="label"], #finance-dash .fin-balance small{font-family:var(--font-text,inherit)!important;letter-spacing:.06em}
  `;
  document.head.appendChild(st);
  window.KSFrontOffice = { zeige };
  console.log('[KS-Front-Office v1] aktiv — Front Office: Transfer · Scouting · Verein · Finanzen');
})();
