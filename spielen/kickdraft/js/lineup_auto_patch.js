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
    // DFL (D95): Platz mit Seite aus der Lage auf dem Feld (LV/RV, LM/RM, LF/RF …) – slotToPos kennt nur die Rolle (AV, AM, FL)
    try {
      const P = window.DFLPosition;
      if (P && typeof P.aktiv === 'function' && P.aktiv() && typeof P.platz === 'function') { const z = P.platz(slot); if (z) return z; }
    } catch (e) { /* Rolle des Basisspiels */ }
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
    if (!p || p.onLoanAt || p.onStrike || p.verletztenliste) return false;   // Verletztenliste (DFL, D38): nicht im Spieltagskader
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
    // Development Squad (DFL, D45) spielt nicht – auch nicht als Notnagel
    const kader = ((typeof SQUAD !== 'undefined' && SQUAD) ? SQUAD : []).filter(function (p) { return p && !p.perspektiv; });
    if (!CLUB.lineup) CLUB.lineup = {};
    // Slots einer anderen Formation räumen: getLineupIds() zählt ALLE Einträge – nach einem Formationswechsel standen
    // sonst bis zu 14 Spieler „in der Elf“ (gemessen 2026-10-09: 4-4-2 → 4-3-3)
    const slotIds = {};
    slots.forEach(function (s) { slotIds[s.id] = 1; });
    Object.keys(CLUB.lineup).forEach(function (k) { if (!slotIds[k]) delete CLUB.lineup[k]; });

    // Tote Verweise (Spieler nicht mehr im Kader) räumen
    const imKader = {};
    kader.forEach(function (p) { if (p && p.id) imKader[p.id] = p; });
    slots.forEach(function (s) { if (CLUB.lineup[s.id] && !imKader[CLUB.lineup[s.id]]) CLUB.lineup[s.id] = null; });
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

    const slotBelegt = {}, spielerBelegt = {};
    let gesetzt = 0;
    const setze = function (slotId, spielerId) {
      CLUB.lineup[slotId] = spielerId;
      slotBelegt[slotId] = true; spielerBelegt[spielerId] = true;
      gesetzt++;
    };
    const P = window.DFLPosition;
    if (P && typeof P.aktiv === 'function' && P.aktiv()) {
      // DFL (D81): eine Zahl je Spieler und Platz (Stärke − Abzug, dfl_position_patch.js), beste Zuordnung über alle
      // Plätze zugleich (ungarische Methode) statt gierig; Torwart ↔ Feld bleibt dem Notnagel unten
      const zu = P.zuordnen(offen.map(zielPosition), frei);
      offen.forEach(function (s, i) { if (zu[i] >= 0) setze(s.id, frei[zu[i]].id); });
    } else {
      // Alle Paare bewerten. Eignung und Stärke gleich gewichtet: ein passender
      // Durchschnittsspieler schlägt den fehlbesetzten Star, ein deutlich besserer
      // Spieler auf seiner Nebenposition setzt sich aber durch.
      const paare = [];
      offen.forEach(function (s) {
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
        setze(x.slot, x.spieler);
      });
    }

    // Notnagel: bleibt ein Slot leer (zu kleiner Kader, alles verletzt), lieber
    // einen unpassenden Spieler aufstellen als mit zehn Mann anzutreten.
    // Erst alle Einsatzfähigen (auch ein Feldspieler im Tor), Verletzte/Gesperrte/Streikende nur, wenn sonst Plätze leer
    // blieben – vorher stand nach Stärke sortiert der streikende 95er-Torwart wieder im Tor, obwohl gesunde Feldspieler
    // auf der Bank saßen (Dynastie-Bot 2026-10-10: „A. Simon für A. Simon (Streik)“)
    const nachStaerke = function (a, b) { return (b.ovr || 0) - (a.ovr || 0); };
    const nochFrei = function (p) { return !spielerBelegt[p.id]; };
    const rest = frei.filter(nochFrei).sort(nachStaerke).concat(notnagel.filter(nochFrei).sort(nachStaerke));
    offen.forEach(function (s) {
      if (CLUB.lineup[s.id]) return;
      const p = rest.shift();
      if (p) { CLUB.lineup[s.id] = p.id; spielerBelegt[p.id] = true; gesetzt++; }
    });
    return gesetzt;
  }
  window.baueAufstellung = baueAufstellung;

  // Wie stark wäre die beste Elf in einer Formation? Ohne Seiteneffekte (DFL: „Beste Elf“ wählt die Formation des Stils,
  // dfl_taktik_patch.js; KI-Gegner in der Engine, dfl_engine_patch.js). Wert je Slot = Stärke minus Abzug für die fremde
  // Position wie in den Spielerwerten (player_attributes.js: 2,2 je Kettenschritt, höchstens 11); Ergebnis = Ø der Elf.
  // Eigene Elf in der DFL: DFLPosition.formationWert (D81: gelernt −2, nicht gelernt −8/−12/−18, beste Zuordnung).
  function malus(e) { return e >= 100 ? 0 : e >= 88 ? 1 : Math.min(11, ((62 - e) / 10 + 1) * 2.2); }
  function bewerteFormation(formation, kaderArg) {
    if (typeof FORMATIONS === 'undefined' || !FORMATIONS[formation]) return -1;
    const slots = FORMATIONS[formation];
    const kader = (kaderArg || ((typeof SQUAD !== 'undefined' && SQUAD) ? SQUAD : []).filter(function (p) { return p && !p.perspektiv; }))
      .filter(function (p) { return kaderArg ? true : verfuegbar(p); });
    // DFL (D81): eigene Elf mit derselben Zahl wie Anzeige und Engine (Ø Stärke − Abzug, beste Zuordnung);
    // D95: KI-Kader (kaderArg, dfl_engine_patch.js) mit derselben Zahl
    const P = window.DFLPosition;
    if (P && typeof P.aktiv === 'function' && P.aktiv()) return P.formationWert(slots.map(zielPosition), kader);
    const paare = [];
    slots.forEach(function (s, si) {
      const ziel = zielPosition(s);
      kader.forEach(function (p, pi) { const e = eignung(p, ziel); if (e > 0) paare.push({ si: si, pi: pi, e: e, punkte: e + (p.ovr || 50) }); });
    });
    paare.sort(function (a, b) { return b.punkte - a.punkte; });
    const sb = {}, pb = {}; let summe = 0, n = 0;
    paare.forEach(function (x) {
      if (sb[x.si] || pb[x.pi]) return;
      sb[x.si] = pb[x.pi] = true; summe += (kader[x.pi].ovr || 50) - malus(x.e); n++;
    });
    return n ? summe / slots.length : -1;
  }
  window.bewerteFormation = bewerteFormation;

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
    try { if (typeof saveGameState === 'function') saveGameState(); } catch (e) {}
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

  console.log('[LineupAuto v2] aktiv — Aufstellung nach echter Positionseignung statt slot.group; Ausfälle nur als letzter Notnagel');
})();
