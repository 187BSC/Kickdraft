/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · SAISON-PLUS  ·  v1   (Nutzer 2026-10-15: „wenn ein Spieler um einen Punkt in der Saison besser wird, dass er
   das sofort mit plus 1 in Klammern angezeigt bekommt. Zur neuen Saison wird dann zusammengerechnet … mit minus genauso“)
   ─────────────────────────────────────────────────────────────────────────
   Anzeige eigener Spieler: „72 (+1)“ = Stärke zu Saisonbeginn und Entwicklung seit Saisonbeginn (Training, Formlauf,
   Formkrise, Verletzung …). Gespielt wird sofort mit dem aktuellen Wert (73); die Zahl vorne übernimmt ihn zur neuen
   Saison – nach der Saisonentwicklung, sodass jede Saison wieder bei „(±0)“ beginnt.
   Bisher: app_main.js nahm als Basis CLUB.training.seasonSnapshot, der VOR der Saisonentwicklung entsteht (die
   Sommer-Entwicklung stand die ganze neue Saison als Pille daneben), Neuzugänge hatten keine Basis, die Pille war ein
   Pfeil ohne Klammern und fehlte auf der Spielerkarte am Handy. seasonSnapshot bleibt unverändert für den Saisonbericht.
   Eigene Basis: CLUB.training.ovrBasis = { saison, werte: { spielerId: ovr } }.
   Ersetzt ovrBase / gainPill / seasonGainBadge (app_main.js). Lädt vor init_bootstrap.js.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const saison = () => { try { return LEAGUE ? LEAGUE.season : null; } catch (e) { return null; } };
  const kader = () => { try { return Array.isArray(SQUAD) ? SQUAD : []; } catch (e) { return []; } };

  function zustand() {
    if (typeof CLUB === 'undefined' || !CLUB) return null;
    if (!CLUB.training) CLUB.training = {};
    let z = CLUB.training.ovrBasis;
    // Fehlt sie (alter Spielstand, neues Spiel) oder gehört sie zu einer anderen Saison: jetzt festhalten
    if (!z || !z.werte || z.saison !== saison()) z = setzen();
    return z;
  }
  function setzen() {
    const werte = {};
    kader().forEach(p => { werte[p.id] = p.ovr || 0; });
    CLUB.training.ovrBasis = { saison: saison(), werte };
    return CLUB.training.ovrBasis;
  }
  function basis(p) {
    if (!p) return 0;
    const z = zustand();
    if (!z) return p.ovr || 0;
    if (z.werte[p.id] == null) {
      // Neuzugang (Kauf, Leihe, Nachwuchs): ab heute zählt seine Entwicklung
      if (!kader().some(x => x.id === p.id)) return p.ovr || 0;
      z.werte[p.id] = p.ovr || 0;
    }
    return z.werte[p.id];
  }
  function pille(d, kompakt) {
    d = Math.round(d || 0);
    if (!d) return '';
    const hoch = d > 0, txt = '(' + (hoch ? '+' : '−') + Math.abs(d) + ')';
    return ` <span class="season-gain ks-plus${hoch ? '' : ' season-loss'}${kompakt ? ' season-gain-sm' : ''}" ` +
      `title="Entwicklung in dieser Saison: ${txt} – wirkt sofort, zur neuen Saison wird zusammengerechnet">${txt}</span>`;
  }
  const badge = p => p ? pille((p.ovr || 0) - basis(p)) : '';

  window.ovrBase = basis; window.gainPill = pille; window.seasonGainBadge = badge;
  try { ovrBase = basis; gainPill = pille; seasonGainBadge = badge; } catch (e) { /* window reicht */ }

  // Neue Saison: erst nach der Saisonentwicklung (startNewSeason → applyEndOfSeasonClubEffects) zusammenrechnen
  if (typeof window.startNewSeason === 'function') {
    const _orig = window.startNewSeason;
    window.startNewSeason = function () {
      const r = _orig.apply(this, arguments);
      const fertig = () => { try { setzen(); } catch (e) { /* ohne Verein */ } };
      if (r && typeof r.then === 'function') r.then(fertig, fertig); else fertig();
      return r;
    };
    try { startNewSeason = window.startNewSeason; } catch (e) { /* window reicht */ }
  }

  window.KSSaisonPlus = { basis, pille, setzen };
  console.log('[Kickstil-SaisonPlus v1] aktiv — eigene Spieler „72 (+1)“: Entwicklung seit Saisonbeginn, zusammengerechnet zur neuen Saison');
})();
