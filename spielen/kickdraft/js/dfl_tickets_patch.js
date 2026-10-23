/* ═══════════════════════════════════════════════════════════════════════════
   DFL · TICKETPREISE NUR VOR DER SAISON  ·  v1   (D54, entschieden 2026-10-09)
   ─────────────────────────────────────────────────────────────────────────
   • Tages- und Dauerkarte legt der Nutzer vor Spieltag 1 fest; ab Spieltag 1 sind beide gesperrt,
     bis die Saison des eigenen Vereins vorbei ist (fcmSeasonOver, also auch während eigener Playoffs).
     Gesperrt heißt: setTicketLevel / setSeasonTicketLevel ändern nichts, die Regler (dfl_ui_teile.js)
     sind aus und zeigen ein Schloss.
   • Entscheidungs-Blatt (Handy): 5 Kacheln Tageskarte (Preis, Auslastung, Einnahme je Heimspiel) und
     5 Kacheln Dauerkarte (Preis, Anteil der Plätze, Einnahme der Saison), dazu die Saisonprognose
     = Heimspiele × Tageskarten + Dauerkarten. Gerechnet mit den Funktionen des Spiels (Preisindex,
     dauerkartenAnteil, Nachfragekurve D44 bei mittlerer Saison wie der Saisonplan) – keine eigene Ökonomie.
   • Postfach: in der Vorbereitung ein Hinweis „Ticketpreise festlegen“, bis die Preise bestätigt sind.
   Geld: Plan und Abrechnung je Heimspiel bleiben wie gehabt (dfl_finanz_patch.js); die Sperre ändert nur,
   wann der Nutzer die Stufe wechseln darf.
   API: DFLTickets.gesperrt() · .blatt() · .prognose()
   Lädt nach dfl_ui_teile.js (die Regler entstehen in renderFinancePanel), vor dfl_app_shell.js.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const dfl = () => typeof CLUB !== 'undefined' && CLUB && CLUB.dfl && CLUB.dfl.aktiv;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const NAMEN = ['Fanpreis', 'Günstig', 'Normal', 'Gehoben', 'Premium'];
  const STUFEN = [-2, -1, 0, 1, 2];
  const de = (x, d) => Number(x).toLocaleString('de-DE', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  const toast = (t, typ) => { if (typeof window.showToast === 'function') window.showToast(t, typ || 'info'); };

  // ── Sperre ───────────────────────────────────────────────────────────────
  function gesperrt() {
    if (!dfl() || typeof LEAGUE === 'undefined' || !LEAGUE) return false;
    if (!(LEAGUE.matchday >= 1)) return false;                                   // Vorbereitung: frei
    return !(typeof fcmSeasonOver === 'function' && fcmSeasonOver());            // nach dem Saisonende wieder frei
  }
  const SPERR_TEXT = 'Ticketpreise sind bis zum Saisonende fest. Neue Preise legst du vor der nächsten Saison fest.';
  ['setTicketLevel', 'setSeasonTicketLevel'].forEach(fn => {
    const _orig = window[fn];
    if (typeof _orig !== 'function') return;
    window[fn] = function (delta) {
      if (gesperrt()) {
        toast(SPERR_TEXT);
        if (typeof renderFinancePanel === 'function') renderFinancePanel();      // Regler zurück auf den festen Wert
        return;
      }
      return _orig.apply(this, arguments);
    };
    try { if (fn === 'setTicketLevel') setTicketLevel = window[fn]; else setSeasonTicketLevel = window[fn]; } catch (e) { /* nicht global gebunden */ }
  });
  // Regler (dfl_ui_teile.js) während der Saison aus, mit Schloss und Satz
  if (typeof window.renderFinancePanel === 'function') {
    const _orig = window.renderFinancePanel;
    window.renderFinancePanel = function () {
      const r = _orig.apply(this, arguments);
      try {
        const zu = gesperrt();
        document.querySelectorAll('.dfl-regler').forEach(e => { e.disabled = zu; });
        document.querySelectorAll('.dfl-regler-zeile').forEach(z => {
          const alt = z.parentElement && z.parentElement.querySelector('.tk-sperre');
          if (zu && !alt) z.insertAdjacentHTML('afterend', `<div class="tk-sperre"><i class="ti ti-lock" aria-hidden="true"></i>Fest bis Saisonende</div>`);
          if (!zu && alt) alt.remove();
        });
      } catch (e) { console.warn('[DFL-Tickets] Regler sperren', e); }
      return r;
    };
    try { renderFinancePanel = window.renderFinancePanel; } catch (e) { /* nicht global gebunden */ }
  }

  // ── Prognose (mit den Funktionen des Spiels) ─────────────────────────────
  // mit(tl, sl, fn): Stufen kurz setzen, rechnen, zurücksetzen (Preisindex und Dauerkarten-Anteil hängen daran)
  function mit(tl, sl, fn) {
    const a = CLUB.ticketLevel, b = CLUB.seasonTicketLevel;
    CLUB.ticketLevel = tl; CLUB.seasonTicketLevel = sl;
    try { return fn(); } finally { CLUB.ticketLevel = a; CLUB.seasonTicketLevel = b; }
  }
  function heimspiele() { return typeof HOME_MATCHDAYS_PER_SEASON === 'number' ? HOME_MATCHDAYS_PER_SEASON : 16; }
  function rechne(tl, sl) {
    return mit(tl, sl, () => {
      const plaetze = typeof stadiumCapacityForLevel === 'function' ? stadiumCapacityForLevel(CLUB.facilities.stadium) : 20000;
      // Nachfrage wie der Saisonplan: mittlere Saison, Durchschnittsgegner (D44); außerhalb der DFL die Spielkurve
      const fill = typeof window.dflTicketNachfrage === 'function' && window.dflTicketNachfrage(0.5, tl, sl) != null
        ? window.dflTicketNachfrage(0.5, tl, sl) : (typeof stadiumFillRate === 'function' ? stadiumFillRate() : 0.8);
      const anteil = typeof dauerkartenAnteil === 'function' ? dauerkartenAnteil() : 0.45;
      const block = Math.round(plaetze * anteil);
      const tagesKarten = Math.max(0, Math.round(plaetze * fill) - block);
      const tagesPreis = currentTicketPrice(), dauerPreis = currentSeasonTicketPrice();
      return { plaetze, fill, anteil, block, tagesKarten, tagesPreis, dauerPreis,
        jeSpiel: tagesKarten * tagesPreis, dauer: block * dauerPreis, saison: tagesKarten * tagesPreis * heimspiele() + block * dauerPreis };
    });
  }
  function prognose() {
    const tl = CLUB.ticketLevel || 0, sl = CLUB.seasonTicketLevel || 0;
    return { aktuell: rechne(tl, sl), tages: STUFEN.map(i => rechne(i, sl)), dauer: STUFEN.map(j => rechne(tl, j)), heimspiele: heimspiele() };
  }

  // ── Entscheidungs-Blatt (Handy) ──────────────────────────────────────────
  let wahlT = null, wahlD = null;
  function blatt() {
    const box = document.querySelector('#app-blatt .app-blatt-box');
    if (!box || !dfl()) { if (typeof switchAppView === 'function') switchAppView('club', document.getElementById('nav-club')); return; }
    const zu = gesperrt();
    wahlT = CLUB.ticketLevel || 0; wahlD = CLUB.seasonTicketLevel || 0;
    const malen = () => {
      const tages = STUFEN.map(i => rechne(i, wahlD)), dauer = STUFEN.map(j => rechne(wahlT, j)), jetzt = rechne(wahlT, wahlD), hs = heimspiele();
      const bestT = Math.max(...tages.map(x => x.jeSpiel)), bestD = Math.max(...dauer.map(x => x.saison));
      const farbe = f => f >= 0.95 ? 'var(--app-gut, #3fcf7a)' : f >= 0.8 ? 'var(--app-mittel, #f0c05a)' : 'var(--app-schlecht, #f07462)';
      const aus = zu ? ' disabled' : '';
      box.innerHTML = `<div class="app-griff"></div><button class="app-blatt-zu" aria-label="Schließen"><i class="ti ti-x" aria-hidden="true"></i></button>
        <div class="tk-kopf"><b>Ticketpreise der Saison</b><small>${zu ? 'Festgelegt vor Spieltag 1' : `Vor Spieltag 1 · gilt für alle ${hs} Heimspiele`}</small></div>
        ${zu ? `<div class="tk-sperre gross"><i class="ti ti-lock" aria-hidden="true"></i>${esc(SPERR_TEXT)}</div>` : ''}
        <div class="tk-titel">Tageskarte · je Heimspiel</div>
        <div class="tk-kacheln">${tages.map((t, k) => `<button type="button" class="tk-wahl" data-t="${STUFEN[k]}" aria-pressed="${STUFEN[k] === wahlT}"${aus}>
          <small>${NAMEN[k]}</small><span class="tk-preis">${de(t.tagesPreis)} €</span>
          <span class="tk-fuellung" title="Auslastung ${Math.round(t.fill * 100)} %"><i style="height:${Math.round(t.fill * 100)}%;background:${farbe(t.fill)}"></i></span>
          <small><b>${Math.round(t.fill * 100)} %</b><br>voll</small>
          <small class="${t.jeSpiel === bestT ? 'tk-best' : ''}"><b>${de(t.jeSpiel / 1e6, 2)}</b> Mio${t.jeSpiel === bestT ? '<br>★ meiste' : ''}</small></button>`).join('')}</div>
        <div class="tk-titel">Dauerkarte · ganze Saison</div>
        <div class="tk-kacheln tk-dauer">${dauer.map((d, k) => `<button type="button" class="tk-wahl" data-d="${STUFEN[k]}" aria-pressed="${STUFEN[k] === wahlD}"${aus}>
          <small>${NAMEN[k]}</small><span class="tk-preis klein">${de(d.dauerPreis)} €</span>
          <small><b>${Math.round(d.anteil * 100)} %</b><br>der Plätze</small>
          <small class="${d.saison === bestD ? 'tk-best' : ''}"><b>${de(d.dauer / 1e6, 1)}</b> Mio${d.saison === bestD ? '<br>★ Saison' : ''}</small></button>`).join('')}</div>
        <div class="tk-summe"><span><b>Prognose Saison</b><small>${hs} Heimspiele × ${de(jetzt.jeSpiel / 1e6, 2)} Mio + Dauerkarten ${de(jetzt.dauer / 1e6, 1)} Mio</small></span>
          <strong>${de(jetzt.saison / 1e6, 1)} Mio</strong></div>
        <p class="tk-hinweis">Prognose für eine mittlere Saison · Erfolg füllt das Stadion auch bei hohen Preisen</p>
        ${zu ? '' : `<button class="app-knopf haupt" type="button" data-ok="1"><i class="ti ti-lock" aria-hidden="true"></i>Preise für die Saison festlegen</button>`}`;
    };
    box.onclick = ev => {
      const b = ev.target.closest('.tk-wahl:not([disabled])');
      if (b) { if (b.dataset.d != null) wahlD = +b.dataset.d; else wahlT = +b.dataset.t; malen(); return; }
      if (ev.target.closest('[data-ok]')) {
        if (gesperrt()) { toast(SPERR_TEXT); return; }
        const dt = wahlT - (CLUB.ticketLevel || 0), dd = wahlD - (CLUB.seasonTicketLevel || 0);
        if (dt) setTicketLevel(dt);
        if (dd) setSeasonTicketLevel(dd);
        if (CLUB.dfl) CLUB.dfl.ticketsFest = LEAGUE.season;                         // Postfach-Hinweis erledigt
        if (typeof saveGameState === 'function') saveGameState();
        const r = rechne(CLUB.ticketLevel || 0, CLUB.seasonTicketLevel || 0);
        const z = document.getElementById('app-blatt'); if (z) z.classList.remove('auf');
        document.body.classList.remove('app-gesperrt');
        toast(`Saisonpreise fest: Tageskarte ${de(r.tagesPreis)} €, Dauerkarte ${de(r.dauerPreis)} €.`, 'success');
        if (window.DFLAppShell) { try { DFLAppShell.cta(); if (typeof renderHomeTab === 'function') renderHomeTab(); } catch (e) { /* optional */ } }
      }
    };
    malen();
    document.getElementById('app-blatt').classList.add('auf'); document.body.classList.add('app-gesperrt');
    if (window.DFLAppShell) try { DFLAppShell.cta(); } catch (e) { /* optional */ }
  }

  // ── Postfach: Hinweis in der Vorbereitung ────────────────────────────────
  {
    const _orig = window.buildPostfachItems;
    if (typeof _orig === 'function') window.buildPostfachItems = function () {
      const items = _orig.apply(this, arguments);
      try {
        if (dfl() && LEAGUE && !(LEAGUE.matchday >= 1) && CLUB.dfl.ticketsFest !== LEAGUE.season) {
          const r = rechne(CLUB.ticketLevel || 0, CLUB.seasonTicketLevel || 0);
          items.push({ cat: 'warn', icon: '<i class="ti ti-ticket"></i>', title: 'Ticketpreise für die Saison festlegen',
            text: `Tageskarte ${de(r.tagesPreis)} €, Dauerkarte ${de(r.dauerPreis)} € – Prognose ${de(r.saison / 1e6, 1)} Mio.`,
            actions: `<button class="pf-btn" onclick="DFLTickets.blatt()">Festlegen</button>`, prio: 3 });
        }
      } catch (e) { /* Postfach bleibt wie es ist */ }
      return items;
    };
    try { buildPostfachItems = window.buildPostfachItems; } catch (e) { /* nicht global gebunden */ }
  }

  window.DFLTickets = { gesperrt, blatt, prognose, rechne };
  console.log('[DFL-Tickets v1] aktiv — Ticketpreise nur vor der Saison, Entscheidungs-Blatt mit Tages- und Dauerkarte, Hinweis im Postfach');
})();
