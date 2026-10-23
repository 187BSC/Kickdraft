/* ===== market_scope_patch.js =====
   TRANSFERMARKT-REICHWEITE v1
   ─────────────────────────────────────────────────────────────────────────────
   Problem: Der Markt zog rein zufällig aus dem gesamten Spielerpool. Ein
   Regionalligist mit 168.000 € Budget bekam als ersten Eintrag einen 19-jährigen
   OVR-88-Spieler für 176 Mio € angeboten, dahinter einen Innenverteidiger für
   64 Mio. 27 von 40 Spielern lagen über dem Budget — die Liste war als
   Arbeitsmittel wertlos.

   Lösung: Die Liga bestimmt, WEN man überhaupt zu sehen bekommt — unabhängig vom
   Scouting, das die Qualität innerhalb dieser Reichweite regelt. Ein Viertligist
   verhandelt nicht mit Bundesliga-Profis; er sieht seine eigene Liga, die Klasse
   darüber und ab und zu ein Ausrufezeichen.

   Zusätzlich bleibt ein kleiner Anteil „Strecker" drin (Spieler leicht über dem
   Niveau) — sonst fehlt der Reiz, sich zu strecken.

   Lädt NACH bundle_match.js (dessen RealMarket-Patch) und VOR init_bootstrap.js.
   ============================================================================= */
(function () {
  'use strict';

  // Je Liga: was ist normal, was ist die Obergrenze, wie viel darf drüber liegen.
  // Ablöse-Deckel orientiert sich an dem, was ein Verein dieser Klasse über eine
  // Saison überhaupt stemmen kann (inkl. Ratenzahlung über drei Jahre).
  const BAND = {
    regionalliga: { maxOvr: 66, maxWert:    600000, streckerOvr: 70, streckerWert:   1500000 },
    liga3:        { maxOvr: 72, maxWert:   2500000, streckerOvr: 76, streckerWert:   6000000 },
    bundesliga2:  { maxOvr: 79, maxWert:  10000000, streckerOvr: 83, streckerWert:  25000000 },
    bundesliga:   { maxOvr: 99, maxWert: 250000000, streckerOvr: 99, streckerWert: 250000000 }
  };
  const STRECKER_ANTEIL = 0.12;   // ~12 % der Liste dürfen über dem Band liegen

  function meinBand() {
    let key = 'regionalliga';
    try { key = findFcmGroup(LEAGUE).tierKey || key; } catch (e) {}
    return BAND[key] || BAND.regionalliga;
  }

  // Passt der Spieler ins normale Beuteschema?
  function imBand(p, b) {
    return (p.ovr || 0) <= b.maxOvr && (p.value || 0) <= b.maxWert;
  }
  // Noch als „Strecker" vertretbar?
  function alsStrecker(p, b) {
    return (p.ovr || 0) <= b.streckerOvr && (p.value || 0) <= b.streckerWert;
  }

  if (typeof window.generateMarketPool !== 'function') {
    console.warn('[MarketScope] generateMarketPool nicht gefunden — Ligafilter inaktiv');
    return;
  }

  const _orig = window.generateMarketPool;
  window.generateMarketPool = function (count, seasonSeed) {
    const b = meinBand();
    // In der Bundesliga gibt es nichts zu filtern — Originalverhalten.
    if (b === BAND.bundesliga) return _orig.apply(this, arguments);

    const ziel = count || 40;
    const maxStrecker = Math.max(1, Math.round(ziel * STRECKER_ANTEIL));
    const passend = [], strecker = [];
    const gesehen = {};

    // Mehrfach ziehen, bis genug Passende beisammen sind. Der Ursprungspool ist
    // zufällig, deshalb reichen wenige Runden; die Obergrenze verhindert eine
    // Endlosschleife, falls ein Band mal zu eng gesetzt ist.
    for (let runde = 0; runde < 6; runde++) {
      let pool;
      try { pool = _orig.call(this, ziel * 2, (seasonSeed || '') + '_s' + runde) || []; }
      catch (e) { break; }
      for (let i = 0; i < pool.length; i++) {
        const p = pool[i];
        if (!p || gesehen[p.id]) continue;
        gesehen[p.id] = 1;
        if (imBand(p, b)) { if (passend.length < ziel) passend.push(p); }
        else if (alsStrecker(p, b)) { if (strecker.length < maxStrecker) strecker.push(p); }
      }
      if (passend.length >= ziel - maxStrecker) break;
    }

    // Strecker beimischen, dann auf die gewünschte Länge bringen.
    let liste = passend.slice(0, Math.max(0, ziel - strecker.length)).concat(strecker);
    // Sollte das Band wider Erwarten zu wenig hergeben: mit dem Originalpool
    // auffüllen, damit der Markt nie leer ist.
    if (liste.length < ziel) {
      let rest;
      try { rest = _orig.call(this, ziel, (seasonSeed || '') + '_rest') || []; } catch (e) { rest = []; }
      for (let i = 0; i < rest.length && liste.length < ziel; i++) {
        if (!gesehen[rest[i].id]) { gesehen[rest[i].id] = 1; liste.push(rest[i]); }
      }
    }
    // Durchmischen, damit die Strecker nicht am Stück am Ende stehen
    for (let i = liste.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = liste[i]; liste[i] = liste[j]; liste[j] = t;
    }
    return liste.slice(0, ziel);
  };
  try { generateMarketPool = window.generateMarketPool; } catch (e) {}

  window.MarketScope = { BAND: BAND, meinBand: meinBand };
  console.log('[MarketScope v1] aktiv — Transfermarkt zeigt nur ligagerechte Spieler (+' +
              Math.round(STRECKER_ANTEIL * 100) + '% Strecker)');
})();
