/* ===== career_start_patch.js =====
   KARRIERESTART v1
   ─────────────────────────────────────────────────────────────────────────────
   Problem: Ein neu übernommener Kader startete mit NULL Eingewöhnung
   (`styleXP` leer) — als hätte die Mannschaft nie zusammen gespielt. Die
   Eingespieltheit lag dadurch bei 0,28, während jeder simulierte Gegner pauschal
   mit 0,42 antritt. Das ist ein struktureller Nachteil in jedem einzelnen Spiel
   der ersten Saison, und zwar für etwas, das der Spieler nicht verschuldet hat.

   Realistisch ist das Gegenteil: Man übernimmt eine Mannschaft, die unter dem
   Vorgänger bereits eine Saison in einem bestimmten Stil gespielt hat. Deshalb
   bekommt der Startkader 25 Spiele Eingewöhnung im Ausgangsstil — knapp unter
   der ersten vollen Bonusstufe (30 Spiele = +1 Stern).

   Wer den Stil danach umstellt, verliert diesen Vorsprung wieder: das ist die
   bestehende Mechanik und bleibt bewusst so.

   Lädt VOR init_bootstrap.js.
   ============================================================================= */
(function () {
  'use strict';

  const START_SPIELE = 25;

  function aktuellerStil() {
    try {
      if (typeof window.computeCohesion === 'function') {
        const c = window.computeCohesion();
        if (c && c.style) return c.style;
      }
    } catch (e) { /* Ersatz unten */ }
    return 'ballbesitz';
  }

  function saeeEingewoehnung() {
    if (typeof SQUAD === 'undefined' || !Array.isArray(SQUAD)) return 0;
    const stil = aktuellerStil();
    let n = 0;
    SQUAD.forEach(function (p) {
      if (!p) return;
      if (!p.styleXP) p.styleXP = {};
      // Nur setzen, wenn wirklich nichts da ist — ein laufender Spielstand darf
      // dadurch nicht plötzlich Eingewöhnung geschenkt bekommen.
      if (!p.styleXP[stil]) { p.styleXP[stil] = START_SPIELE; n++; }
    });
    return n;
  }

  // ── Karriere-Zustand zurücksetzen ──────────────────────────────────────────
  // Eine neue Karriere erbte den kompletten Zustand der alten: Vorstands- und
  // Fanzufriedenheit, NPC-Kader aller 56 Vereine, Sponsorenverträge, Budget- und
  // Zuschauerverlauf, laufende Events, Teammoral.
  // Am gravierendsten die Erwartungen: nach einer gescheiterten Karriere startete
  // die nächste mit Vorstandsvertrauen 15 — die ENTLASSUNGSGRENZE liegt bei 20.
  // Man war also schon vor dem ersten Spieltag gefeuert.
  // Felder, die komplett verschwinden dürfen — ihre Besitzer legen sie bei
  // Bedarf neu an (EXP.ensureState, npcSquads()).
  // `facilities` und `stadiumCapacity` gehören dazu: engine_main setzt sie nur
  // mit `if (!CLUB.facilities)`, und der TeamStrengthPatch überschreibt sie nur
  // für echte Vereine aus der CLUBS-Tabelle. Bei einem frei benannten Verein
  // blieb deshalb der Ausbaustand der Vorkarriere stehen — nach einem
  // Stadionprojekt startete das neue Spiel mit Stufe 3 und 13.000 Plätzen.
  // SITUATIVER SPEICHER. Die Liste unten ist von Hand gepflegt — und genau das
  // war schon mehrfach die Fehlerquelle: Wer ein neues Weltfeld an CLUB hängt und
  // den Eintrag vergisst, verschleppt es in die nächste Karriere. Deshalb gibt es
  // jetzt zusätzlich CLUB.welt: alles, was dort liegt, gehört zum laufenden
  // Spielstand und verschwindet beim Karrierestart restlos — ohne dass jemand
  // eine Liste pflegen muss.
  //   Weltzustand.setz('meinFeld', wert) · Weltzustand.hol('meinFeld', standard)
  const LOESCHEN = ['expectations', 'npcSquads', 'moral', 'vereinsScout',
                    'youthProspects', 'freeAgents', 'sponsorOffers',
                    'welt',
                    // Kader der 155 Auslandsvereine, ihre Ziel-Stärken und die
                    // Beobachtungsliste. Ohne das erbt eine neue Karriere die
                    // halb durchgespielte Transferwelt der alten.
                    'euroKader', 'staerke', 'watchlist', 'euroClubs',
                    // Fallschirm-Basis der Rücklagen-Obergrenze (bundle_economy.js, 2026-10-16)
                    '_deckelBasis'];
  // Felder, die als LEERE STRUKTUR bleiben müssen. Sie einfach zu löschen
  // reicht nicht: `renderTransferHistory` etwa liest `CLUB.transferHistory.length`
  // ungeprüft und wirft dann beim nächsten Wochenwechsel.
  const LEEREN_ARRAY = ['transferHistory', 'transferBids', 'watchlist', 'scoutedPlayers',
                        '_amortizations', '_budgetHistory', '_attendanceLog',
                        '_installments', '_outgoingClauses'];
  const LEEREN_OBJEKT = ['_seasonAchievements', '_events', '_eventStreak', '_runningCostWarnings'];
  const ZURUECKSETZEN = LOESCHEN.concat(LEEREN_ARRAY, LEEREN_OBJEKT);

  // Zugriff auf den situativen Speicher. Wer hier ablegt, muss sich um das
  // Aufräumen nicht kümmern.
  window.Weltzustand = {
    raum: function () {
      if (typeof CLUB === 'undefined' || !CLUB) return {};
      if (!CLUB.welt) CLUB.welt = {};
      return CLUB.welt;
    },
    hol: function (schluessel, standard) {
      const r = this.raum();
      if (r[schluessel] === undefined && standard !== undefined) r[schluessel] = standard;
      return r[schluessel];
    },
    setz: function (schluessel, wert) { this.raum()[schluessel] = wert; return wert; },
    weg: function (schluessel) { delete this.raum()[schluessel]; },
    leeren: function () { if (typeof CLUB !== 'undefined' && CLUB) CLUB.welt = {}; }
  };

  function setzeKarriereZurueck() {
    if (typeof CLUB === 'undefined' || !CLUB) return 0;
    let n = 0;
    // Situativer Speicher: zählen, löschen erledigt die LOESCHEN-Schleife —
    // danach wird er als leeres Objekt neu gesetzt, damit CLUB.welt.x nie auf
    // undefined trifft.
    if (CLUB.welt && Object.keys(CLUB.welt).length) n += Object.keys(CLUB.welt).length;
    LOESCHEN.forEach(function (k) {
      if (CLUB[k] != null) { try { delete CLUB[k]; n++; } catch (e) { CLUB[k] = undefined; } }
    });
    // Alles mit „ks“ + Großbuchstabe gehört den Kickstil-Modulen (ksErfolge, ksDeadline, ksEntlassen …) und damit zur
    // Karriere. 2026-10-16: ksErfolge stand nicht in LOESCHEN – Winpunkte-Wertung, Sponsorentreffen und Zähler wanderten mit.
    Object.keys(CLUB).forEach(function (k) {
      if (/^ks[A-Z]/.test(k)) { try { delete CLUB[k]; n++; } catch (e) { CLUB[k] = undefined; } }
    });
    LEEREN_ARRAY.forEach(function (k) { if (CLUB[k] != null) n++; CLUB[k] = []; });
    LEEREN_OBJEKT.forEach(function (k) { if (CLUB[k] != null) n++; CLUB[k] = {}; });
    CLUB.welt = {};                       // situativer Speicher: leer, aber vorhanden
    // Sponsoren: frischer Verein hat keine Verträge, die wählt man im Dialog.
    CLUB.sponsors = { shirt: null, sleeve: null, stadium: null };
    delete CLUB.casinoStats; delete CLUB.blackjack;   // Casino entfernt (2026-10-15)
    // Ausbaustufen ebenfalls auf den Anfangsstand — aber SETZEN, nicht löschen:
    // `generateYouthProspects` greift schon während startNewGameState auf
    // `CLUB.facilities.youth` zu und der Standard wird erst beim Laden gesetzt.
    // Für echte Vereine überschreibt der TeamStrengthPatch das danach ohnehin;
    // bei frei benanntem Verein blieb sonst der Ausbaustand der Vorkarriere.
    CLUB.facilities = { youth: 1, training: 1, scouting: 1, stadium: 1, merchandising: 1 };
    // Kapazität AUS der Stufe ableiten, nicht raten: die gesamte Ökonomie rechnet
    // mit `stadiumCapacityForLevel(facilities.stadium)` (Stufe 1 = 6.000), nur die
    // Gelände-Karte liest `CLUB.stadiumCapacity`. Mit hart gesetzten 8.000 zeigte
    // sie ein größeres Stadion an, als der Verein wirtschaftlich hat.
    CLUB.stadiumCapacity = (typeof stadiumCapacityForLevel === 'function')
      ? stadiumCapacityForLevel(1) : 6000;
    n += 2;
    return n;
  }

  if (typeof window.startNewGameState === 'function') {
    const _orig = window.startNewGameState;
    window.startNewGameState = async function () {
      // VOR dem Aufbau leeren — startNewGameState ruft EXP.hookSeasonStart(),
      // das sonst auf dem alten Erwartungsstand aufsetzt und ihn weiterrechnet.
      let geleert = 0;
      try { geleert = setzeKarriereZurueck(); } catch (e) { console.warn('[CareerStart] Reset', e); }
      const r = await _orig.apply(this, arguments);
      try {
        const n = saeeEingewoehnung();
        console.log('[CareerStart] ' + geleert + ' Karriere-Felder geleert, ' + n +
                    ' Spieler mit ' + START_SPIELE + ' Spielen Eingewöhnung');
      } catch (e) { console.warn('[CareerStart] Eingewöhnung fehlgeschlagen', e); }
      return r;
    };
    try { startNewGameState = window.startNewGameState; } catch (e) {}
  }

  window.CareerStart = { saeeEingewoehnung: saeeEingewoehnung, START_SPIELE: START_SPIELE,
                         setzeKarriereZurueck: setzeKarriereZurueck, ZURUECKSETZEN: ZURUECKSETZEN };
  console.log('[CareerStart v1] aktiv — übernommener Kader startet nicht bei null Eingewöhnung');
})();