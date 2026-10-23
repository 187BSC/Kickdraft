/* ═══════════════════════════════════════════════════════════════════════════
   DFL · POSITIONEN LERNEN  ·  v1   (Welt-Paket L3, Nutzer 2026-10-11: „nach x Spielen die Mainposition switch“)
   ─────────────────────────────────────────────────────────────────────────
   Startelf-Einsätze je Platz zählen (p.posEinsaetze, Regeln in DFLSaison.CFG.lernen / lerneEinsatz): nach 10 Einsätzen auf einem
   fremden Platz wird er gelernte Nebenposition (−2), nach 25 Hauptposition (die alte bleibt gelernt; nur im selben Mannschaftsteil).
     · KI: die Elf der Welt je Ligaspieltag (Hülle um advanceMatchday, Elf wie dfl_medizin_patch.js vor dem Spieltag)
     · Eigener Verein: die Aufstellung je Pflichtspiel (Liga und Playoffs, Hülle um processFixtureResult), Meldung im Postfach,
       Werte-Cache der Detailwerte neu (DFLPosition.frisch)
   Feld p.posEinsaetze zieht über EXTRA/spielZuDfl/zuSpielSpieler (dfl_liga_patch.js) mit. Lädt nach dfl_medizin_patch.js (äußere Hüllen).
   API: DFLLernen
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const S = window.DFLSaison, D = window.DFLSpiel;
  if (!S || !D || !S.lerneEinsatz) { console.warn('[DFL-Lernen] DFL-Module fehlen – Patch inaktiv'); return; }
  const CFG = { aus: false };
  const dfl = () => typeof CLUB !== 'undefined' && CLUB && CLUB.dfl && CLUB.dfl.aktiv && typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.dfl;
  const aktiv = () => !CFG.aus && !!dfl() && S.CFG.lernen && S.CFG.lernen.aktiv;
  const posText = x => (x === 'OM' ? 'ZOM' : x);
  const name = p => (typeof displayName === 'function' ? displayName(p) : (p.firstName ? p.firstName + ' ' : '') + p.name);
  const zaehler = () => (CLUB.dfl.lernen = CLUB.dfl.lernen || { neben: 0, haupt: 0, ki: { neben: 0, haupt: 0 } });

  // ── Eigener Verein: Aufstellung je Pflichtspiel ──────────────────────────
  function eigeneElf() {
    const P = window.DFLPosition;
    if (P && P.elf) { try { return P.elf().map(x => ({ p: x.p, platz: x.platz })); } catch (e) { /* Ersatz unten */ } }
    return [];
  }
  function eigeneLernen(elf) {
    const neu = [];
    elf.forEach(({ p, platz }) => { if (!p || p.perspektiv) return; const x = S.lerneEinsatz(p, platz); if (x) neu.push(Object.assign({ p }, x)); });
    if (!neu.length) return neu;
    const z = zaehler();
    neu.forEach(x => {
      z[x.art]++;
      if (typeof addNews !== 'function') return;
      if (x.art === 'haupt') addNews('club', `Neue Hauptposition: ${x.p.name}`, `${name(x.p)} ist nach ${S.CFG.lernen.haupt} Spielen auf ${posText(x.pos)} jetzt ${posText(x.pos)} – ${posText(x.alt)} bleibt gelernt.`);
      else addNews('club', `Position gelernt: ${x.p.name}`, `${name(x.p)} kann nach ${S.CFG.lernen.neben} Spielen auf ${posText(x.pos)} auch ${posText(x.pos)} (−2 statt Fremdposition).`);
    });
    try { if (window.DFLPosition && DFLPosition.frisch) DFLPosition.frisch(); } catch (e) { /* Werte-Cache optional */ }
    return neu;
  }
  {
    const _orig = window.processFixtureResult;
    if (typeof _orig === 'function') window.processFixtureResult = function () {
      const fx = typeof CURRENT_FIXTURE !== 'undefined' ? CURRENT_FIXTURE : null;
      const elf = aktiv() && fx && fx.type !== 'friendly' ? eigeneElf() : null;
      const r = _orig.apply(this, arguments);
      if (elf && elf.length) { try { eigeneLernen(elf); } catch (e) { console.warn('[DFL-Lernen] eigener Verein', e); } }
      return r;
    };
  }

  // ── KI: Elf der Welt je Ligaspieltag ─────────────────────────────────────
  {
    const _orig = window.advanceMatchday;
    if (typeof _orig === 'function') window.advanceMatchday = function (league) {
      if (!aktiv() || !league || !league.dfl || (typeof maxMatchday === 'function' && league.matchday >= maxMatchday(league))) return _orig.apply(this, arguments);
      let L = null, werte = null;
      const vorher = league.matchday, spielen = D.spielendeTeams ? D.spielendeTeams(league, league.matchday) : null;
      try {
        L = D.liga(); werte = {};
        const eigen = D.eigeneDflId();
        L.teams.forEach(t => { if (t.id !== eigen) werte[t.id] = S.teamWerte(t); });
      } catch (e) { werte = null; console.warn('[DFL-Lernen] vor dem Spieltag', e); }
      const r = _orig.apply(this, arguments);
      try {
        if (L && werte && league.matchday > vorher) {
          const ohne = new Set([D.eigeneDflId()]);
          if (spielen) L.teams.forEach(t => { if (!spielen.has(t.id)) ohne.add(t.id); });   // Bye Week
          const neu = S.lernenSpieltag(L, werte, ohne);
          if (neu.length) {
            const z = zaehler();
            neu.forEach(x => { z.ki[x.art] = (z.ki[x.art] || 0) + 1; });
            if (D.weltGeaendert) D.weltGeaendert();
          }
        }
      } catch (e) { console.warn('[DFL-Lernen] Spieltag der KI', e); }
      return r;
    };
  }

  window.DFLLernen = { CFG, aktiv, eigeneLernen, eigeneElf, zaehler: () => (dfl() ? zaehler() : null) };
  console.log('%c[DFL-Lernen v1] aktiv', 'color:#3fb950;font-weight:bold',
    '— Positionen lernen: 10 Einsätze → Nebenposition, 25 → Hauptposition (KI je Spieltag, eigener Verein je Pflichtspiel, Postfach)');
})();
