/* ═══════════════════════════════════════════════════════════════════════════
   DFL · WERBE-BONUS  ·  v1   (D56, entschieden 2026-10-09: „zwei Werbungen → Cap für die Saison um 1 Mio erweitern, die KI nicht“)
   ─────────────────────────────────────────────────────────────────────────
   · Zwei Videos ansehen → +1 Mio € Salary Cap für die LAUFENDE Saison, nur der eigene Verein (die KI nie).
   · Zustand CLUB.dfl.werbung = { saison, videos, bonus } – gehört zu genau einer Saison (LEAGUE.season); mit dem
     Saisonwechsel ist er automatisch weg (Zähler wieder 0, kein Bonus mehr).
   · Wirkung: DFLKader.capLimit() rechnet den Bonus dazu (dfl_kader_patch.js) → Cap-Barometer im Office, Front Office,
     Kaderschnitt, Verträge, Free Agency und Trades sehen den Spielraum sofort. Rollover, Preisindex und Untergrenze
     rechnen ohne Bonus (capLimitBasis).
   · Video: bis zum Marketingplan ein Platzhalter-Spot (5 s, klar beschriftet). Ein echtes Werbe-SDK meldet sich mit
     DFLWerbung.anbieterSetzen(fn) an: fn(fertig) ruft fertig(true) nach einem vollständig gesehenen Video.
   · Ansicht: Zeile im Front Office unter dem Cap-Balken (DFLWerbung.zeileHtml, dfl_app_shell.js).
   API: DFLWerbung.bonus() · .zustand() · .ansehen() · .anbieterSetzen(fn) · .zeileHtml() · .CFG
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const CFG = { videos: 2, bonus: 1000000, platzhalterSekunden: 5 };
  const dfl = () => typeof CLUB !== 'undefined' && CLUB && CLUB.dfl && CLUB.dfl.aktiv && typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.dfl;
  const mio = x => (Math.round(x / 1e5) / 10).toLocaleString('de-DE') + ' Mio €';

  function zustand() {
    if (!dfl()) return null;
    const z = CLUB.dfl.werbung;
    if (!z || z.saison !== LEAGUE.season) CLUB.dfl.werbung = { saison: LEAGUE.season, videos: 0, bonus: 0 };
    return CLUB.dfl.werbung;
  }
  // Nur lesen (wird bei jeder Cap-Rechnung gefragt): Bonus gilt nur in seiner Saison
  function bonus() {
    if (!dfl()) return 0;
    const z = CLUB.dfl.werbung;
    return z && z.saison === LEAGUE.season ? (z.bonus || 0) : 0;
  }

  // ── Video: Anbieter (später SDK) oder Platzhalter ────────────────────────
  let anbieter = null, laeuft = false;
  function platzhalter(fertig) {
    const ov = document.createElement('div');
    ov.id = 'dfl-werbung-ov';
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Werbung');
    let rest = CFG.platzhalterSekunden;
    ov.innerHTML = `<div class="wb-karte"><span class="wb-marke">Platzhalter</span><i class="ti ti-device-tv" aria-hidden="true"></i>
      <b>Hier läuft später ein Werbevideo</b><span class="wb-uhr" aria-live="polite">${rest}</span>
      <button type="button" class="app-knopf wb-abbruch">Abbrechen</button></div>`;
    document.body.appendChild(ov);
    const zu = ok => { clearInterval(t); ov.remove(); fertig(ok); };
    ov.querySelector('.wb-abbruch').addEventListener('click', () => zu(false));
    const t = setInterval(() => {
      rest--; const u = ov.querySelector('.wb-uhr'); if (u) u.textContent = rest;
      if (rest <= 0) zu(true);
    }, 1000);
  }
  function ansehen() {
    const z = zustand();
    if (!z || z.bonus || laeuft) return;
    laeuft = true;
    (anbieter || platzhalter)(ok => {
      laeuft = false;
      if (!ok) return;
      const zz = zustand(); if (!zz || zz.bonus) return;
      zz.videos = Math.min(CFG.videos, (zz.videos || 0) + 1);
      if (zz.videos >= CFG.videos) {
        zz.bonus = CFG.bonus;
        try { if (window.DFLKader && DFLKader.capSetzen) DFLKader.capSetzen(); } catch (e) { /* ohne Kader-Patch */ }
        if (typeof addNews === 'function') addNews('club', '📺 Cap-Bonus', `+${mio(CFG.bonus)} Salary Cap bis zum Saisonende.`);
        if (typeof window.showToast === 'function') window.showToast(`+${mio(CFG.bonus)} Cap für diese Saison`, 'success');
      } else if (typeof window.showToast === 'function') window.showToast(`Video ${zz.videos}/${CFG.videos} gesehen`, 'info');
      if (typeof saveGameState === 'function') saveGameState();
      try {
        const fo = document.getElementById('view-fo');
        if (window.DFLAppShell && fo && fo.classList.contains('active')) DFLAppShell.foZeigen();
        if (window.DFLAppShell) DFLAppShell.cta();
      } catch (e) { /* Ansicht optional */ }
    });
  }
  function zeileHtml() {
    const z = zustand(); if (!z) return '';
    if (z.bonus) return `<div class="wb-zeile an"><i class="ti ti-circle-check" aria-hidden="true"></i><span>Cap-Bonus +${mio(z.bonus)} bis Saisonende</span></div>`;
    return `<button type="button" class="wb-zeile" data-werbung="1"><i class="ti ti-player-play" aria-hidden="true"></i>
      <span>+${mio(CFG.bonus)} Cap: ${CFG.videos} Videos ansehen</span><b>${z.videos || 0}/${CFG.videos}</b></button>`;
  }
  document.addEventListener('click', ev => { if (ev.target.closest && ev.target.closest('[data-werbung]')) ansehen(); });

  window.DFLWerbung = { CFG, bonus, zustand, ansehen, zeileHtml, anbieterSetzen(fn) { anbieter = typeof fn === 'function' ? fn : null; } };
  console.log('[DFL-Werbung v1] aktiv — 2 Videos → +1 Mio Cap für die laufende Saison (nur eigener Verein), Platzhalter bis zum Werbe-SDK');
})();
