/* ===== lineup_auto_patch.js =====
   AUFSTELLUNGS-AUTOMATIK v1
   ─────────────────────────────────────────────────────────────────────────────
   Problem: Die Standard-Elf eines NEUEN Spiels war unbrauchbar — gemessen standen
   8 von 11 Spielern falsch, beide Torhüter im Feld (einer als Zehner, einer im
   Sturm) und ein Flügelspieler im Tor.

   Ursache: Alle drei bisherigen Fassungen (engine_main, bundle_squad,
   lineup_guard) gleichen `slot.group` ab — das kennt nur fünf grobe Gruppen
   (TW, AV, IV, ZM, ST), der Kader aber neun feine Positionen (zusätzlich AM, FL,
   OM, ZDM). Wer NUR eine der vier unbekannten Positionen spielt, passte zu gar
   keiner Gruppe und landete im Auffüll-Durchlauf irgendwo — nach Stärke sortiert,
   weshalb ausgerechnet die starken Torhüter im Sturm auftauchten.
   Dazu nahm die erste Runde jeweils den ERSTBESTEN passenden Spieler statt den
   passendsten, und die zweite Runde füllte ohne jede Prüfung auf.

   Lösung: eine echte Zuordnung statt zweier Greedy-Durchläufe.
     1. Eignung(Spieler, Zielposition) 0…100 über die feine Position, mit
        Positionskette als Abstandsmaß. Torwart↔Feld ist gesperrt.
     2. Alle (Slot, Spieler)-Paare bewerten, nach Punkten sortieren, von oben
        durchgehen und vergeben, solange Slot UND Spieler frei sind. Das findet
        eine deutlich bessere Gesamtaufstellung als „Slot für Slot".
     3. Erst ganz zum Schluss Notnagel: übrige Slots mit übrigen Spielern füllen,
        damit nie eine Elf unvollständig ins Spiel geht.

   Lädt NACH bundle_squad.js und lineup_guard_patch.js (überschreibt beide) und
   VOR init_bootstrap.js.
   ============================================================================= */
(function () {
  'use strict';

  // Positionskette: Abstand = wie artfremd ist die Position?
  const KETTE = { TW: 0, IV: 1, AV: 2, ZDM: 3, ZM: 4, ZOM: 5, AM: 5, OM: 5, FL: 6, ST: 7 };

  function positionenVon(p) {
    const liste = (p.positions && p.positions.length) ? p.positions : (p.pos ? [p.pos] : []);
    return liste.filter(Boolean);
  }

  // Zielposition eines Slots — bevorzugt die FEINE Position aus dem Taktiksystem,
  // ersatzweise die grobe Gruppe.
  function zielPosition(slot) {
    // Positionen mit Seite (kickstil_positionen.js): Platz aus der Lage des Slots
    if (window.KSPos) return KSPos.platz(slot);
    try {
      if (window.TacticsSystem && typeof TacticsSystem.slotToPos === 'function') {
        const z = TacticsSystem.slotToPos(slot);
        if (z) return z;
      }
    } catch (e) { /* Ersatzweg unten */ }
    return slot.group || slot.label || 'ZM';
  }

  // Eignung 0…100. Torwart und Feld sind strikt getrennt: ein Keeper im Sturm
  // ist keine Notlösung, sondern ein Fehler.
  function eignung(p, ziel) {
    // Positionen mit Seite: Eignung aus dem Abzug (0 → 100, gelernt −2 → 88, benachbart −8 → 62, Torwart ↔ Feld gesperrt)
    if (window.KSPos) {
      const a = KSPos.abzug(p, ziel);
      return a >= KSPos.CFG.torwart ? 0 : a === 0 ? 100 : a <= KSPos.CFG.gelernt ? 88 : Math.max(10, 70 - a);
    }
    const liste = positionenVon(p);
    if (!liste.length) return 10;
    const istTw = liste.indexOf('TW') === 0;
    const zielTw = ziel === 'TW';
    if (istTw !== zielTw) return 0;
    if (zielTw) return 100;
    if (liste[0] === ziel) return 100;          // Stammposition
    if (liste.indexOf(ziel) >= 0) return 88;    // gelernte Nebenposition
    // Artfremd: über den Kettenabstand bewerten. Nächster eigener Posten zählt.
    let best = 99;
    const zk = KETTE[ziel];
    liste.forEach(function (q) {
      const qk = KETTE[q];
      if (zk != null && qk != null) best = Math.min(best, Math.abs(zk - qk));
    });
    if (best === 99) return 25;
    return Math.max(10, 62 - best * 10);
  }
  window.positionsEignung = eignung;

  function verfuegbar(p) {
    if (!p || p.onLoanAt || p.onStrike) return false;
    if (typeof isInjured === 'function' && isInjured(p)) return false;
    if (typeof isSuspended === 'function' && isSuspended(p)) return false;
    return true;
  }

  // Kern: beste Zuordnung von Spielern auf Slots.
  // `nurLeere` = true → bestehende Besetzungen bleiben stehen (Sicherheitsnetz
  // des alten lineup_guard: nur Lücken schließen, nichts umbauen).
  function baueAufstellung(nurLeere) {
    if (typeof CLUB === 'undefined' || !CLUB) return 0;
    if (typeof FORMATIONS === 'undefined') return 0;
    const slots = FORMATIONS[CLUB.formation] || FORMATIONS['4-4-2'] || [];
    if (!slots.length) return 0;
    const kader = (typeof SQUAD !== 'undefined' && SQUAD) ? SQUAD : [];
    if (!CLUB.lineup) CLUB.lineup = {};
    // Tote Verweise (Spieler nicht mehr im Kader) räumen
    const imKader = {};
    kader.forEach(function (p) { if (p && p.id) imKader[p.id] = p; });
    slots.forEach(function (s) { if (CLUB.lineup[s.id] && !imKader[CLUB.lineup[s.id]]) CLUB.lineup[s.id] = null; });
    // Altschlüssel anderer Formationen entfernen (LM/RM neben OML/OMR): sie zählten als Aufstellung mit – 16 Spieler
    // bekamen Einsätze, Moral und Noten, zwei davon doppelt (Fehleranalyse 2026-10-21, F2)
    Object.keys(CLUB.lineup).forEach(function (k) { if (!slots.some(function (s) { return s.id === k; })) delete CLUB.lineup[k]; });
    // Nicht einsatzbereite Spieler (verletzt, gesperrt, verliehen, streikend) raus, damit sie unten ersetzt werden.
    // Vorher blieben sie beim „Simulieren bis …“ in der Elf und spielten mit voller Stärke (F3: 44 von 127 Anpfiffen)
    if (nurLeere) slots.forEach(function (s) { const p = imKader[CLUB.lineup[s.id]]; if (p && !verfuegbar(p)) CLUB.lineup[s.id] = null; });
    // DOPPELBESETZUNG auflösen: steht ein Spieler auf zwei Positionen, spielt die
    // Elf faktisch mit zehn Mann — die Engine baut sie ohne zu murren doppelt ein.
    // Der zweite Platz wird geleert und unten regulär neu besetzt.
    const schonDrin = {};
    slots.forEach(function (s) {
      const id = CLUB.lineup[s.id];
      if (!id) return;
      if (schonDrin[id]) CLUB.lineup[s.id] = null; else schonDrin[id] = 1;
    });

    const offen = slots.filter(function (s) { return nurLeere ? !CLUB.lineup[s.id] : true; });
    if (!offen.length) return 0;
    const belegt = {};
    if (nurLeere) slots.forEach(function (s) { if (CLUB.lineup[s.id]) belegt[CLUB.lineup[s.id]] = true; });
    else slots.forEach(function (s) { CLUB.lineup[s.id] = null; });

    const frei = kader.filter(function (p) { return p && !belegt[p.id] && verfuegbar(p); });
    const notnagel = kader.filter(function (p) { return p && !belegt[p.id] && !verfuegbar(p); });

    // Alle Paare bewerten. Eignung und Stärke gleich gewichtet: ein passender
    // Durchschnittsspieler schlägt den fehlbesetzten Star, ein deutlich besserer
    // Spieler auf seiner Nebenposition setzt sich aber durch.
    const slotBelegt = {}, spielerBelegt = {};
    let gesetzt = 0;
    if (window.KSPos) {
      // Beste Gesamt-Elf (ungarische Methode): größte Summe aus Stärke − Positionsabzug
      KSPos.zuordnen(offen, frei).forEach(function (j, i) {
        if (j < 0) return;
        CLUB.lineup[offen[i].id] = frei[j].id;
        slotBelegt[offen[i].id] = true; spielerBelegt[frei[j].id] = true;
        gesetzt++;
      });
    }
    const paare = [];
    if (!window.KSPos) offen.forEach(function (s) {
      const ziel = zielPosition(s);
      frei.forEach(function (p) {
        const e = eignung(p, ziel);
        if (e <= 0) return;                       // Torwart/Feld-Sperre
        paare.push({ slot: s.id, spieler: p.id, punkte: e + (p.ovr || 50) });
      });
    });
    paare.sort(function (a, b) { return b.punkte - a.punkte; });
    paare.forEach(function (x) {
      if (slotBelegt[x.slot] || spielerBelegt[x.spieler]) return;
      CLUB.lineup[x.slot] = x.spieler;
      slotBelegt[x.slot] = true; spielerBelegt[x.spieler] = true;
      gesetzt++;
    });

    // Notnagel: bleibt ein Slot leer (zu kleiner Kader, alles verletzt), lieber
    // einen unpassenden Spieler aufstellen als mit zehn Mann anzutreten.
    // Reihenfolge der Notnägel: erst Streikende (gesund), dann Gesperrte, zuletzt Verletzte
    const notStufe = function (p) { return p.onStrike ? 0 : (typeof isSuspended === 'function' && isSuspended(p)) ? 1 : 2; };
    const rest = frei.concat(notnagel).filter(function (p) { return !spielerBelegt[p.id]; })
                     .sort(function (a, b) { return notStufe(a) - notStufe(b) || (b.ovr || 0) - (a.ovr || 0); });
    const notnagelVorher = gesetzt;
    offen.forEach(function (s) {
      if (CLUB.lineup[s.id]) return;
      const p = rest.shift();
      if (p) { CLUB.lineup[s.id] = p.id; spielerBelegt[p.id] = true; gesetzt++; }
    });
    if (gesetzt > notnagelVorher && typeof addNews === 'function') {
      const n = gesetzt - notnagelVorher;
      addNews('club', 'Notaufstellung', n === 1 ? 'Ein Spieler steht notgedrungen in der Elf, obwohl er nicht einsatzbereit ist – es fehlen gesunde Spieler.'
                                              : n + ' Spieler stehen notgedrungen in der Elf, obwohl sie nicht einsatzbereit sind – es fehlen gesunde Spieler.');
    }
    return gesetzt;
  }
  window.baueAufstellung = baueAufstellung;

  // ── Die drei bestehenden Einstiege auf die neue Logik umlegen ──────────────
  // autoFillLineup schließt nur Lücken (so war das Sicherheitsnetz gedacht).
  window.autoFillLineup = function () {
    const n = baueAufstellung(true);
    if (n) {
      try { if (typeof renderAll === 'function') renderAll(); } catch (e) {}
      try { if (typeof syncClubToTeams === 'function') syncClubToTeams(); } catch (e) {}
      try { if (typeof saveGameState === 'function') saveGameState(); } catch (e) {}
    }
    return n;
  };
  try { autoFillLineup = window.autoFillLineup; } catch (e) {}

  // Komplette Neuaufstellung (Spielstart, Formationswechsel, Knopf im Spieltag)
  window.besteAufstellung = function () {
    const n = baueAufstellung(false);
    try { if (typeof renderAll === 'function') renderAll(); } catch (e) {}
    try { if (typeof syncClubToTeams === 'function') syncClubToTeams(); } catch (e) {}
    try { if (typeof recomputeMatchEffect === 'function') recomputeMatchEffect(); } catch (e) {}
    return n;
  };

  if (typeof window.changeFormation === 'function') {
    window.changeFormation = function (neueFormation) {
      CLUB.formation = neueFormation;
      CLUB.selected = null;
      baueAufstellung(false);
      try { if (typeof ensureCurrentInRepertoire === 'function') ensureCurrentInRepertoire(); } catch (e) {}
      try { if (typeof renderAll === 'function') renderAll(); } catch (e) {}
      try { if (typeof recomputeMatchEffect === 'function') recomputeMatchEffect(); } catch (e) {}
      try { if (typeof renderTacticsExtras === 'function') renderTacticsExtras(); } catch (e) {}
    };
    try { changeFormation = window.changeFormation; } catch (e) {}
  }

  // Bei einer NEUEN Karriere komplett neu aufstellen. `autoFillLineup` füllt nur
  // Lücken — hängt aber noch die Aufstellung des vorigen Spielstands in
  // CLUB.lineup, bleiben deren Slots besetzt und der frische Kader startet
  // fehlbesetzt (gemessen: 6 von 11).
  if (typeof window.startNewGameState === 'function') {
    const _neu = window.startNewGameState;
    window.startNewGameState = async function () {
      const r = await _neu.apply(this, arguments);
      try { CLUB.lineup = {}; baueAufstellung(false); } catch (e) {}
      try { if (typeof syncClubToTeams === 'function') syncClubToTeams(); } catch (e) {}
      return r;
    };
    try { startNewGameState = window.startNewGameState; } catch (e) {}
  }

  // Nach dem Saisonwechsel neu aufstellen. Abgänge, Karriereenden und
  // hochgezogene Talente hinterlassen sonst Lücken, die erst das nächste Spiel
  // schließt — im Kader stand bis dahin eine Elf mit drei leeren Plätzen.
  if (typeof window.startNewSeason === 'function') {
    const _sns = window.startNewSeason;
    window.startNewSeason = function () {
      const r = _sns.apply(this, arguments);
      try { baueAufstellung(true); } catch (e) {}
      return r;
    };
    try { startNewSeason = window.startNewSeason; } catch (e) {}
  }

  console.log('[LineupAuto v1] aktiv — Aufstellung nach echter Positionseignung statt slot.group');
})();
