/* ═══════════════════════════════════════════════════════════════════════════
   DFL · GLEICHE REGELN FÜR ALLE SPIELE  ·  v5   (Checkliste des Nutzers 2026-10-09: „Gleichbehandlung von KI- & Spieler-Spielen“)
   ─────────────────────────────────────────────────────────────────────────
   · Echter Gegner: In Engine v3 spielt der Gegner mit seinem Kader aus der Welt (Startelf in der stärksten Formation
     seines Stils, Bank aus dem Rest) – über dieselbe Umrechnung wie die eigenen Spieler (DFLSpiel.zuSpielSpieler).
     Vorher war er ein Kunstteam aus der Teamstärke: alle elf auf vollem Stärkewert, Tempo 85 statt 71; gemessen
     verlor der eigene Verein gegen gleich starke Gegner im Schnitt 0,8 : 2,1.
   · Eine Stärke-Skala (v2): Das Basisspiel mischt die Technik in die Stärke (88 % Bereiche + 12 % Technik), die Welt
     nicht – eigene Spieler lagen so bei gleichen Werten rund 4 Punkte unter KI-Spielern (Anzeige, Teamstärke, Forderungen
     und über die Spielerwerte auch in der Engine). In der DFL rechnet computeOvrFromAreas jetzt wie die Welt (DFLGenerator.ovrAus);
     alte Spielstände werden einmal angeglichen (Saisonvergleich und Potenzial verschieben sich mit).
   · Technik: KI-Spieler bekommen sie in der Engine wie eigene Spieler (aus dem Mittelfeldwert, fest je Spieler) statt
     des vollen Mittelfeldwerts. Kondition: eigene Spieler starten mit ihrer echten Fitness (vorher immer 92 %, Gegner 97 %).
   · Bank: Development Squad, Verletztenliste, Verletzte und Gesperrte kommen nicht mehr als Einwechsler.
   · Brücke zur KI-Formel: Je Team skaliert ein Torfaktor (= Formel ÷ Engine-Erwartung, Elfmeter herausgerechnet) den Ausgang
     der Abschlüsse (opt.torFaktor); Heimvorteil und Stil wirken nur noch über die Formel (Basis(d) × Heimvorteil × Stil).
     Die Engine-Erwartung kommt aus eigenen Spielen (CFG.bruecke.modell: eigene Tore und Gegentore getrennt, je e^(a + b·d)
     mal Faktor der eigenen und der gegnerischen Formation) – in Engine v3 verschiebt die Formation das Ergebnis stärker als
     10 Stärkepunkte, die Formel kennt keine. Eigene Spiele haben so dieselben Sieg-/Remis-/Niederlagen-Chancen wie KI-Spiele.
   · Gegner-Stil über DFLTaktik.stilVon (in neuen Karrieren hatten die KI-Vereine sonst noch keinen → alle im 4-3-3).
   · Ausfälle (v4): Verletzte, Gesperrte, Streikende, Verletztenliste und Development Squad verlassen vor dem Anpfiff die Elf
     (beim Öffnen des Spieltags und direkt vor dem Spiel), die Lücke füllt der beste passende Spieler – vorher spielten sie mit.
   · D102 (v5): Verletzungen auch bei der KI – der Gegner spielt mit seiner verfügbaren Elf in Formation und Besetzung aus der Welt
     (DFLSaison.teamWerte: beste Formation seines Stils, Rückstand nach Verletzung zählt), die Brücke rechnet beide Seiten mit der
     verfügbaren Elf (eigener Verein in seiner Formation, ohne Gesperrte und Streikende).
   API: DFLEngine.gegnerTeam(gegnerSpielId) · .auswahlTeam(weltSpieler, { name }) (Pro Bowl, D158) · .skalaAngleichen() · .technik(weltSpieler) · .bruecke(opt) · .ausfaelleErsetzen() · .letzte() · .CFG
   Braucht: EngineV2Adapter, DFLSpiel, DFLGenerator, DFLTaktik (Formation nach Stil), lineup_auto_patch.js. Lädt nach dfl_taktik_patch.js.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const D = window.DFLSpiel, G = window.DFLGenerator;
  if (!window.EngineV2Adapter || !D || !G) { console.warn('[DFL-Engine] Adapter oder DFL fehlen – Patch inaktiv'); return; }
  const CFG = { formation: '4-3-3', bank: 7, fitGegner: 97,
    // Engine-Erwartung je Team = e^(a + b·d); Torfaktor geklemmt auf [min, max]. elfer: Elfmetertore je Team und Spiel
    // (Quote fest 0,80, Nutzer 2026-10-09 – der Faktor gilt nur für die übrigen Abschlüsse; gemessen ≈ 0,34 Elfmeter je Spiel,
    // nach D66 0,128 Elfmetertore je Team und Spiel)
    bruecke: { aktiv: true, min: 0.3, max: 2.5, elfer: 0.13,
      // Engine-Erwartung je Seite in EIGENEN Spielen (Team 0 = eigener Verein; roh gemessen, im Spielweg nachgezogen):
      //   eigene Tore = e^(tore.a + tore.b·d₀ + tore.f[eigene Formation] + tore.g[Gegner-Formation])
      //   Gegentore   = e^(gegen.a + gegen.b·d₁ + gegen.f[Gegner-Formation] + gegen.g[eigene Formation])
      // Formation zählt in Engine v3 (nur Rollen TW/IV/AV/ZM/FL/ST), die KI-Formel kennt keine → der Torfaktor rechnet sie
      // heraus. Bezug der Formationswerte: 4-3-3 = 0.
      // Geeicht 2026-10-10 nach dem Engine-Umbau D66 (zweite Reihe, Schienen, Abschlussfaktor) auf dem Stand mit D81 (Beste Elf
      // mit Positionsabzug), in zwei Schritten:
      // 1) roh: Bremen, Hannover, Fulda, Dortmund je in allen 11 Formationen gegen alle 31 Gegner (echte Stil-Formation) × 3 Spiele
      //    = 4092 Spiele, neutral, ohne Brücke, Poisson-Regression, Formationswerte geschrumpft (Ridge 12, seltene
      //    Gegner-Formationen gegen 0; 3-5-2 kam als Gegner nicht vor). Gleich stark, beide 4-3-3: eigene Elf 1,01 Tore,
      //    Gegner 1,16 (vorher 1,04 / 1,29); die Dreier-/Fünferketten greifen seit D66 fast wie ein 4-3-3 an (eigene Tore
      //    5-3-2 ×0,87 statt ×0,60), die Fünferkette kassiert weiter mehr.
      // 2) Gegenprobe im Spielweg (Brücke an, je Lauf 4 Vereine in einer neuen Welt × 11 Formationen × 31 Gegner × Heim/Auswärts
      //    = 2728 Spiele): Achsenabschnitte aus 6 Läufen, Werte der eigenen Formation (tore.f, gegen.g) aus 5 Läufen über Tore ÷ λ
      //    nachgezogen (je Lauf relativ zum Lauf gesamt, damit die Welt herausfällt).
      //    Mit nur 4 Kadern in der Rohmessung lag die Formation je nach Kader daneben (eigene Tore 4-3-3 +7 %, 5-3-2 −11 %,
      //    Gegentore 4-1-4-1 −11 %, 5-3-2 +10 %), und der eigene Verein blieb insgesamt unter der Formel (eigene Tore −10 %;
      //    der Torfaktor wirkt leicht unterproportional: 1,2 → ×0,986, 0,85 → ×1,021).
      //    Geprüft in zwei neuen Welten (je 4 Vereine × 11 Formationen × 31 Gegner × Heim/Auswärts, die zweite nach dem Merge mit
      //    D77/D101): Siege/Remis/Niederlagen Engine 42,0/20,4/37,6 und 42,5/21,3/36,3 gegen Formel 41,7/20,9/37,4 und
      //    41,6/21,4/37,0, Tore = λ auf ±2 %, je Verein −3 … +4, je Formation −4 … +5 Punkte.
      // Gegenprobe nach D102 (2026-10-11: d aus der verfügbaren Elf, eigener Verein in seiner Formation mit Abzügen wie D81),
      //    3 neue Welten × 2728 Spiele, eine mit Verletzten (KI 12 Wochen Welt-Takt, eigener Verein 3 verletzt + 2 im Aufbau):
      //    Siege/Remis/Niederlagen Engine 39,3/22,3/38,5 · 38,9/21,8/39,2 · 33,5/21,8/44,7 gegen Formel 39,7/21,1/39,2 ·
      //    39,6/21,8/38,6 · 32,0/21,1/47,0; Reste je eigener Formation (log, Mittel der Läufe) 0,06 Tore / 0,05 Gegentore → unverändert.
      // Neu geeicht 2026-10-11 nach D95 (Positionen mit Seite: Plätze mit Seite, Abzug nach D81 auch in den Detailwerten der
      //    KI-Spieler, Gegner-Elf über DFLPosition.zuordnen) – wie D66 in zwei Schritten, d wie in der Brücke (eigene Elf in ihrer
      //    Formation, D102):
      // 1) roh (4 Vereine × 11 Formationen × 31 Gegner × 3 Spiele = 4092, neutral, ohne Brücke): 2,32 Tore je Spiel (vor D95
      //    2,39), eigene Elf 1,07 : 1,26 (vorher 1,19 : 1,21) – vor allem in Formationen mit LM/RM weniger eigene Tore (4-1-4-1
      //    1,33 → 1,00, 5-4-1 1,12 → 0,87), weil die Elf dort jetzt Abzug hat; gleich stark, beide 4-3-3: eigene 0,98, Gegner 1,21.
      // 2) Gegenproben im Spielweg mit dem Rohmodell (6 neue Welten × 2728 Spiele): Siege Engine 37,1 gegen Formel 39,7, eigene
      //    Tore ÷ λ 0,95 (je Welt 0,88–1,00), Gegentore 1,00 → Achsenabschnitte voll, Werte der eigenen Formation × 0,7 nachgezogen.
      //    Geprüft in 3 neuen Welten: Siege/Remis/Niederlagen Engine 38,7/22,3/39,0 gegen Formel 38,8/22,3/38,9, Heim und
      //    Auswärts je ±2 Punkte, je eigener Formation (Mittel der 3 Welten) −3,8 (5-3-2) … +1,7 Punkte, Reste (log) 0,07–0,09 Tore /
      //    0,06–0,08 Gegentore. Vorher (Modell vom 2026-10-10 in einer D95-Welt): Tore ÷ λ 1,05 / 1,07, je Formation −4,5 … +5,1.
      modell: {
        tore: { a: -0.007, b: 0.0456,
          f: { '3-4-3': -0.154, '3-5-2': -0.084, '4-1-4-1': -0.148, '4-2-2-2': -0.159, '4-2-3-1': -0.171, '4-4-1-1': -0.083, '4-4-2': 0.011, '5-2-3': 0.034, '5-3-2': -0.202, '5-4-1': -0.231 },
          g: { '3-4-3': -0.139, '3-5-2': 0.242, '4-1-4-1': 0.038, '4-2-3-1': 0.053, '4-4-1-1': 0.107, '4-4-2': 0.344, '5-2-3': 0.102 } },
        gegen: { a: 0.142, b: 0.0488,
          f: { '3-4-3': -0.105, '3-5-2': -0.158, '4-1-4-1': -0.266, '4-2-3-1': -0.179, '4-4-1-1': -0.16, '4-4-2': -0.018, '5-2-3': -0.084 },
          g: { '3-4-3': 0.109, '3-5-2': 0.164, '4-1-4-1': -0.041, '4-2-2-2': 0.388, '4-2-3-1': 0.032, '4-4-1-1': 0.092, '4-4-2': 0.276, '5-2-3': -0.007, '5-3-2': 0.427, '5-4-1': 0.142 } } },
      // Rückfall ohne Modell: KI-Paarungen 4-3-3 gegen 4-3-3 (108 × 16 Spiele, 2026-10-09)
      a: 0.124, b: 0.0423 } };
  const dfl = () => typeof CLUB !== 'undefined' && CLUB && CLUB.dfl && CLUB.dfl.aktiv && typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.dfl;
  // Rolle in der Engine wie bisher (TacticsSystem.slotToPos: AV, AM, FL …) – die Seite kennt die Engine über die Koordinaten
  const slotPos = s => (window.TacticsSystem && TacticsSystem.slotToPos) ? TacticsSystem.slotToPos(s) : (s.label || 'ZM');
  const eignung = (p, ziel) => (typeof window.positionsEignung === 'function' ? window.positionsEignung(p, ziel) : (p.pos === ziel ? 100 : 40));
  // D95: Platz mit Seite (DFLPosition.platz) für die Detailwerte – Abzug nach D81 für eigene und KI-Spieler gleich
  const P = () => (window.DFLPosition && DFLPosition.aktiv && DFLPosition.aktiv() ? DFLPosition : null);
  const platzVon = s => { const p = P(); return p ? p.platz(s) : slotPos(s); };
  // Rolle eines Spielers ohne Platz (Bank): seine Stammposition mit Seite → Rolle der Engine wie vor D95
  const ROLLE = { LV: 'AV', RV: 'AV', LM: 'AM', RM: 'AM', LF: 'FL', RF: 'FL', OM: 'ZOM' };
  const rolleVon = pos => ROLLE[pos] || pos || 'ZM';
  // Detailwerte für den Platz (Engine liest sie statt sie selbst über die Rolle zu holen: match_engine_v3.js werteVon)
  const werteFuer = (q, platz) => { try { return typeof window.spielerWerte === 'function' && q ? window.spielerWerte(q, platz || undefined) || undefined : undefined; } catch (e) { return undefined; } };
  const weltTeam = spielId => { try { return D.liga().teams.find(t => t.id === D.dflIdVon(spielId)) || null; } catch (e) { return null; } };

  // Technik wie beim eigenen Spieler (bundle_tactics_core.js deriveTechnik: 55 % Mittelfeld + 18 ± 9), fest je Spieler (DFLSpiel.technikVon)
  const technik = w => D.technikVon(w);
  // Gegner-Elf aus dem echten Kader: stärkste Formation seines Stils, beste Zuordnung (Eignung + Stärke) wie lineup_auto_patch.js
  // D102: nur verfügbare Spieler (Verletzte und Verletztenliste fehlen), Rückstand nach Verletzung mindert die Stärke; Formation
  // und Besetzung kommen aus der Welt (DFLSaison.teamWerte) – dieselbe Elf, mit der die Spielformel und die Brücke rechnen
  function gegnerTeam(spielId) {
    const t = weltTeam(spielId);
    if (!t || !t.roster || t.roster.length < 11 || typeof FORMATIONS === 'undefined') return null;
    // Stil über DFLTaktik.stilVon: setzt die Stile der Welt, falls noch keiner gesetzt ist (neue Karriere) – direkt aus
    // t.taktik gelesen fielen sonst alle Gegner auf 4-3-3 zurück, bis irgendwo anders ein Stil abgefragt wurde
    const T = window.DFLTaktik, S = window.DFLSaison, stil = (T && T.stilVon ? T.stilVon(spielId) : null) || (t.taktik && t.taktik.stil);
    const verf = S && S.verfuegbar ? S.verfuegbar : (p => !p.ir);
    const weltKader = t.roster.filter(verf);
    const kader = weltKader.map(w => Object.assign(D.zuSpielSpieler(w), { ovr: Math.max(20, Math.round(w.ovr - (w.reha > 0 ? w.reha : 0) + (window.DFLSaison && DFLSaison.kartenBonus ? DFLSaison.kartenBonus(w) : 0))), technik: technik(w) }));
    const tw = S && S.teamWerte && S.CFG.staerke && S.CFG.staerke.formation ? S.teamWerte(t) : null;
    const slotZu = {}, belegt = {};
    let formation = tw && FORMATIONS[tw.formation] && tw.plaetze && tw.plaetze.length === FORMATIONS[tw.formation].length ? tw.formation : null;
    if (formation) {
      tw.plaetze.forEach((w, si) => { const qi = weltKader.indexOf(w); if (qi >= 0 && !belegt[qi]) { slotZu[si] = qi; belegt[qi] = 1; } });
    } else {
      const stilFormen = (stil && T && T.STILE && T.STILE[stil] ? T.STILE[stil].formationen : []).filter(f => FORMATIONS[f]);
      const bewertet = typeof window.bewerteFormation === 'function'
        ? stilFormen.map(f => ({ f, w: window.bewerteFormation(f, kader) })).sort((a, b) => b.w - a.w) : [];
      formation = [bewertet.length ? bewertet[0].f : null, stilFormen[0], CFG.formation, '4-4-2'].find(f => f && FORMATIONS[f]);
      // D95: dieselbe Zahl wie beim eigenen Verein (beste Zuordnung, Stärke − Abzug)
      besetzen(formation, kader, slotZu, belegt);
    }
    // D166: Playoffs mit englischer Woche – die Startelf des Gegners geht so müde ins Spiel wie das Modell der Playoffs sagt
    let fit = null;
    try { const fx = typeof CURRENT_FIXTURE !== 'undefined' ? CURRENT_FIXTURE : null; if (fx && fx.type === 'playoff' && window.DFLPlayoffs && DFLPlayoffs.frische) fit = DFLPlayoffs.frische(spielId); } catch (e) { fit = null; }
    const { players, bench } = elfUndBank(formation, kader, slotZu, belegt, null, fit != null ? Math.min(CFG.fitGegner, fit) : null);
    // Eingespieltheit wie beim Kunstgegner an die Stärke gekoppelt (Engine v3 nutzt sie nicht, v2 schon)
    const staerke = G.teamOvr(t), rel = Math.max(-1, Math.min(1, (staerke - 62) / 22));
    return { name: t.name, players, bench, formation, tactics6: {}, cohesion: Math.max(0.38, Math.min(0.62, 0.46 + rel * 0.12)), press: 0.5 };
  }
  // Beste Zuordnung Platz → Spieler (D95: DFLPosition.zuordnen, sonst Eignung + Stärke wie lineup_auto_patch.js)
  function besetzen(formation, kader, slotZu, belegt) {
    const Pos = P();
    if (Pos) {
      Pos.zuordnen(FORMATIONS[formation].map(platzVon), kader).forEach((qi, si) => { if (qi >= 0 && !belegt[qi]) { slotZu[si] = qi; belegt[qi] = 1; } });
      return;
    }
    const paare = [];
    FORMATIONS[formation].forEach((s, si) => kader.forEach((q, qi) => { const e = eignung(q, slotPos(s)); if (e > 0) paare.push({ si, qi, punkte: e + (q.ovr || 50) }); }));
    paare.sort((a, b) => b.punkte - a.punkte);
    paare.forEach(x => { if (slotZu[x.si] == null && !belegt[x.qi]) { slotZu[x.si] = x.qi; belegt[x.qi] = 1; } });
  }
  // Engine-Spieler: Rolle wie bisher; D95: Detailwerte für den Platz mit Seite (Abzug wie beim eigenen Verein), Bank mit ihrer Stammposition
  function engineSpieler(q, i, s, fit) {
    const platz = s ? platzVon(s) : null;
    return {
      name: (q.firstName ? q.firstName + ' ' : '') + q.name, num: i + 1, pos: s ? slotPos(s) : rolleVon(q.pos),
      px: s ? Math.max(2, Math.min(98, 100 - (s.y != null ? s.y : 50))) : 50, py: s ? Math.max(2, Math.min(98, s.x != null ? s.x : 50)) : 50,
      ovr: q.ovr || 60, att: q.att || 55, mid: q.mid || 55, def: q.def || 55, pace: q.pace || 55,
      technik: (q.technik != null ? q.technik : q.mid) || 55, fit: fit || CFG.fitGegner, _ref: q,
      platz: platz || q.pos, werte: P() ? werteFuer(q, platz) : undefined
    };
  }
  // Elf (offene Plätze mit den Stärksten aufgefüllt) und Bank (Rest ohne Torhüter, nach Stärke)
  function elfUndBank(formation, kader, slotZu, belegt, bank, fit) {
    const slots = FORMATIONS[formation];
    const rest = kader.map((q, qi) => qi).filter(qi => !belegt[qi]).sort((a, b) => kader[b].ovr - kader[a].ovr);
    slots.forEach((s, si) => { if (slotZu[si] == null && rest.length) { slotZu[si] = rest.shift(); belegt[slotZu[si]] = 1; } });
    const players = slots.map((s, si) => slotZu[si] != null ? engineSpieler(kader[slotZu[si]], si, s, fit) : null).filter(Boolean);
    const bench = kader.filter((q, qi) => !belegt[qi] && q.pos !== 'TW').sort((a, b) => b.ovr - a.ovr).slice(0, bank || CFG.bank)
      .map((q, i) => engineSpieler(q, 11 + i, null));
    return { players, bench };
  }
  // Auswahl aus Weltspielern (Pro Bowl, D158): beste Formation für genau diese Spieler (alle Formationen, bewerteFormation),
  // Besetzung und Bank wie beim KI-Gegner. Die Engine bekommt Kopien (zuSpielSpieler) – Welt und eigener Kader bleiben unberührt.
  function auswahlTeam(weltKader, opt) {
    opt = opt || {};
    if (!Array.isArray(weltKader) || weltKader.length < 11 || typeof FORMATIONS === 'undefined') return null;
    const kader = weltKader.map(w => Object.assign(D.zuSpielSpieler(w), { ovr: Math.max(20, Math.round(w.ovr - (w.reha > 0 ? w.reha : 0) + (window.DFLSaison && DFLSaison.kartenBonus ? DFLSaison.kartenBonus(w) : 0))), technik: technik(w) }));
    const formen = (opt.formationen || Object.keys(FORMATIONS)).filter(f => FORMATIONS[f]);
    const bewertet = typeof window.bewerteFormation === 'function' ? formen.map(f => ({ f, w: window.bewerteFormation(f, kader) })).sort((a, b) => b.w - a.w) : [];
    const formation = [bewertet.length ? bewertet[0].f : null, CFG.formation, '4-4-2'].find(f => f && FORMATIONS[f]);
    const slotZu = {}, belegt = {};
    besetzen(formation, kader, slotZu, belegt);
    const { players, bench } = elfUndBank(formation, kader, slotZu, belegt, opt.bank);
    return { name: opt.name || 'Auswahl', players, bench, formation, tactics6: {}, cohesion: opt.cohesion || 0.5, press: 0.5 };
  }

  {
    const _orig = EngineV2Adapter.buildOppTeam;
    EngineV2Adapter.buildOppTeam = function () {
      try {
        const fx = typeof CURRENT_FIXTURE !== 'undefined' ? CURRENT_FIXTURE : null;
        if (dfl() && fx && fx.opponentId) { const t = gegnerTeam(fx.opponentId); if (t && t.players.length >= 11) return t; }
      } catch (e) { console.warn('[DFL-Engine] Gegnerkader', e); }
      return _orig.apply(this, arguments);
    };
  }

  // Eigene Elf: echte Fitness als Startkondition (die Engine las nur `fit` am Eingabe-Datensatz → immer 92 %)
  {
    const _orig = EngineV2Adapter.buildOwnTeam;
    EngineV2Adapter.buildOwnTeam = function () {
      const t = _orig.apply(this, arguments);
      try {
        if (dfl() && t && t.players) {
          skalaAngleichen();
          // D95: Detailwerte für den Platz mit Seite (die Rolle der Engine bleibt AV/AM/FL …, der Abzug hängt an LV/RV, LM/RM, LF/RF)
          const slots = (typeof FORMATIONS !== 'undefined' && FORMATIONS[CLUB.formation]) || [], mitPlatz = !!P();
          t.players.forEach(x => {
            const q = x._ref; if (!q) return;
            if (q.fitness != null && isFinite(q.fitness)) x.fit = q.fitness; x.ovr = q.ovr || x.ovr;
            if (!mitPlatz) return;
            const s = slots.find(z => CLUB.lineup && CLUB.lineup[z.id] === q.id);
            if (s) { x.platz = platzVon(s); x.werte = werteFuer(q, x.platz); }
          });
          t.formation = CLUB.formation;                        // für die Formations-Korrektur der Brücke
        }
      } catch (e) { console.warn('[DFL-Engine] eigene Elf', e); }
      return t;
    };
  }

  // ── Eine Stärke-Skala für alle (v2) ───────────────────────────────────────
  {
    const _orig = window.computeOvrFromAreas;
    if (typeof _orig === 'function' && typeof G.ovrAus === 'function') {
      window.computeOvrFromAreas = function (p) {
        if (!dfl() || !p || p.def == null || p.mid == null || p.att == null) return _orig.apply(this, arguments);
        return G.ovrAus({ pos: (p.positions && p.positions[0]) || p.pos, def: p.def, mid: p.mid, att: p.att });
      };
      try { computeOvrFromAreas = window.computeOvrFromAreas; } catch (e) { /* nicht global gebunden */ }
    }
  }
  // Kader auf die Welt-Skala bringen. Beim ersten Mal (alter Spielstand) wandern Saisonvergleich und Potenzial mit.
  function skalaAngleichen() {
    if (!dfl() || typeof SQUAD === 'undefined' || !Array.isArray(SQUAD) || typeof computeOvrFromAreas !== 'function') return 0;
    const erstes = CLUB.dfl.ovrSkala !== 2, snap = CLUB.training && CLUB.training.seasonSnapshot;
    let n = 0;
    SQUAD.forEach(p => {
      if (!p || p.def == null) return;
      const neu = computeOvrFromAreas(p);
      if (!isFinite(neu) || neu === p.ovr) return;
      const d = neu - (p.ovr || 0); p.ovr = neu; n++;
      if (erstes && snap && snap[p.id] && typeof snap[p.id].ovr === 'number') snap[p.id].ovr += d;
      if ((p.truePotential || 0) < neu) p.truePotential = neu;
    });
    CLUB.dfl.ovrSkala = 2;
    if (n) { try { D.eigenSync(); D.weltGeaendert(); } catch (e) { /* Welt optional */ } }
    return n;
  }
  // Neue Karriere: nach dem Kaderaufbau angleichen
  if (typeof window.startNewGameState === 'function') {
    const _neu = window.startNewGameState;
    window.startNewGameState = async function () {
      const r = await _neu.apply(this, arguments);
      try { skalaAngleichen(); } catch (e) { console.warn('[DFL-Engine] Skala', e); }
      return r;
    };
    try { startNewGameState = window.startNewGameState; } catch (e) { /* nicht global gebunden */ }
  }
  // Spielstand schon geladen (initGame lädt vor den Patches)
  try { const n = skalaAngleichen(); if (n) console.log(`[DFL-Engine] ${n} Spieler auf die Stärke-Skala der Welt gebracht`); } catch (e) { console.warn('[DFL-Engine] Laden', e); }

  // ── Brücke Engine ↔ KI-Formel ─────────────────────────────────────────────
  let letzte = null;
  function bruecke(opt, heimTeam, gastTeam) {
    const B = CFG.bruecke, S = window.DFLSaison, T = window.DFLTaktik;
    if (!B.aktiv || !dfl() || !S || !opt || opt.torFaktor) return null;
    const fx = typeof CURRENT_FIXTURE !== 'undefined' ? CURRENT_FIXTURE : null;
    if (!fx || !fx.opponentId) return null;
    const eig = D.eigenSync() || D.liga().teams.find(t => t.id === D.eigeneDflId()), geg = weltTeam(fx.opponentId);
    if (!eig || !geg || !eig.roster || eig.roster.length < 11 || !geg.roster || geg.roster.length < 11) return null;
    // D102: beide Seiten mit ihrer verfügbaren Elf (Verletzte, Rückstand); der eigene Verein in seiner Formation, ohne Gesperrte
    // und Streikende (die Welt kennt nur Verletzungen) – so trifft die Erwartung die Elf, die in der Engine wirklich spielt
    const fehlt = new Set((typeof SQUAD !== 'undefined' && SQUAD ? SQUAD : []).filter(q => q && (q.onStrike || (typeof isSuspended === 'function' && isSuspended(q)))).map(q => q.dflId || q.id));
    const eigFit = fehlt.size ? Object.assign({}, eig, { roster: eig.roster.filter(w => !fehlt.has(w.id)) }) : eig;
    const wo = S.teamWerte(eigFit, { formation: CLUB.formation }), wg = S.teamWerte(geg);
    // Stil wie in engineFaktoren: eigener Verein mit seiner echten Eingewöhnung, Gegner nach Spieltag
    wo.stil = T && T.stilInfo ? T.stilInfo('fcm') : null; wg.stil = T && T.stilInfo ? T.stilInfo(fx.opponentId) : null;
    // D166: englische Woche in den Playoffs – Müdigkeit beider Seiten auch in der Erwartung (eigener Verein: echte Fitness der Elf)
    const P = window.DFLPlayoffs;
    if (fx.type === 'playoff' && P && P.frische && P.abzug) {
      const fo = typeof teamFitness === 'function' ? teamFitness() : 95, fg = P.frische(fx.opponentId);
      [[wo, P.abzug(fo)], [wg, fg != null ? P.abzug(fg) : 0]].forEach(([w, m]) => { if (m) ['def', 'mid', 'att'].forEach(k => { if (typeof w[k] === 'number') w[k] -= m; }); });
    }
    // D118: Standardtrainer wirkt in der Engine direkt auf Abschlüsse aus Standards (opt.standard) – die Formel-Erwartung der Brücke
    // rechnet deshalb ohne ihn (sonst zählte er doppelt)
    const Tr = window.DFLTrainer, sO = wo.std || 0, sG = wg.std || 0;
    wo.std = 0; wg.std = 0;
    const standard = Tr && (sO || sG) ? [Tr.standardFaktor(sO, sG), Tr.standardFaktor(sG, sO)] : null;
    // Engine-Team 0 ist immer der eigene Verein; opt.homeAdv 'H' = eigenes Heimspiel, 'A' = auswärts, null = neutral
    const neutral = !!fx.neutral || opt.homeAdv == null || opt.homeAdv === 'neutral', heim = !neutral && opt.homeAdv !== 'A';
    const tag = (typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.matchday) || 0, h = S.CFG.heimvorteil;
    const lam = neutral ? S.toreErwartet(wo, wg, 0, tag) : heim ? S.toreErwartet(wo, wg, h, tag) : S.toreErwartet(wg, wo, h, tag).reverse();
    const kante = (wo.mid - wg.mid) / 30 * 6, d = [(wo.att - wg.def) + kante, (wg.att - wo.def) - kante];
    // Engine-Erwartung je Seite: Stärke-Differenz + eigene und gegnerische Formation (Modell aus eigenen Spielen)
    const fo = (heimTeam && heimTeam.formation) || CLUB.formation, fg = gastTeam && gastTeam.formation, M = B.modell;
    const eng = M ? [Math.exp(M.tore.a + M.tore.b * d[0] + (M.tore.f[fo] || 0) + (M.tore.g[fg] || 0)),
                     Math.exp(M.gegen.a + M.gegen.b * d[1] + (M.gegen.f[fg] || 0) + (M.gegen.g[fo] || 0))]
                  : d.map(x => Math.exp(B.a + B.b * x));
    // Elfmeter bleiben unskaliert → nur der Rest muss die Formel treffen: f = (λ − Elfer) ÷ (Engine − Elfer)
    const f = lam.map((l, i) => Math.max(B.min, Math.min(B.max, eng[i] - B.elfer > 0.15 ? Math.max(0.05, l - B.elfer) / (eng[i] - B.elfer) : l / eng[i])));
    letzte = { lambda: lam, engine: eng, d, torFaktor: f, ort: neutral ? 'neutral' : heim ? 'H' : 'A', formation: [fo, fg], standard };
    return standard ? { torFaktor: f, homeAdv: null, stilFaktor: null, standard } : { torFaktor: f, homeAdv: null, stilFaktor: null };
  }
  {
    const E = window.MatchEngineV3;
    if (E && typeof E.simulateMatch === 'function') {
      const _orig = E.simulateMatch;
      E.simulateMatch = function (h, a, opt) {
        try { const b = bruecke(opt, h, a); if (b) opt = Object.assign({}, opt, b); } catch (e) { console.warn('[DFL-Engine] Brücke', e); }
        return _orig.call(this, h, a, opt);
      };
    }
  }

  // ── Ausfälle vor jedem eigenen Spiel ersetzen (v4, Prüfung 2026-10-09) ────────────────────────────────────
  // engine_v3_adapter.js wrappt simulateCurrentFixture nach lineup_guard_patch.js und ruft das Original nur im Fehlerfall,
  // „Anpfiff“ geht in der DFL direkt dorthin (dfl_taktik_patch.js) → weder Sicherheitsnetz noch Prüfung vor dem Anpfiff:
  // verletzte, gesperrte und streikende Spieler standen in der Engine-Elf (gemessen: 6 Wochen verletzt, 4 Spiele gespielt).
  // Jetzt beim Öffnen des Spieltags und direkt vor dem Spiel: raus aus der Elf, Lücke mit dem besten passenden Spieler
  // füllen (lineup_auto_patch.js, nur leere Plätze), Meldung im Postfach + Hinweis.
  const fehltGrund = p => !p ? 'weg' : (typeof isInjured === 'function' && isInjured(p)) ? 'verletzt'
    : (typeof isSuspended === 'function' && isSuspended(p)) ? 'gesperrt' : p.onStrike ? 'Streik'
    : p.verletztenliste ? 'Verletztenliste' : p.perspektiv ? 'Development Squad' : null;
  // Vertretung: fällt ein Spieler nur verletzt oder gesperrt aus, kehrt er danach auf seinen Platz zurück – solange dort noch
  // sein Ersatz steht (hat der Nutzer selbst umgestellt, gilt dessen Elf).
  function ausfaelleErsetzen() {
    if (!dfl() || typeof FORMATIONS === 'undefined' || !CLUB.lineup || typeof window.baueAufstellung !== 'function') return [];
    const slots = FORMATIONS[CLUB.formation] || [], imKader = new Set((typeof SQUAD !== 'undefined' && SQUAD ? SQUAD : []).map(p => p.id));
    const name = q => (typeof displayName === 'function' ? displayName(q) : q.name);
    // D76: Spieler-IDs als Karten-Daten (4. Argument, dfl_bilder_patch.js zeichnet daraus die Karte mit Gesichtern; ohne das
    // Modul wird es übergangen) – Titel und Text bleiben wie bisher (Zeitung, „Simulieren bis …“ lesen sie)
    const melde = (titel, text, art, karte) => {
      try { addNews('match', titel, text + '.', karte ? { karte } : undefined); } catch (e) { /* Meldung optional */ }
      try { if (typeof showToast === 'function') showToast(titel.replace(/^\S+\s/, '') + ': ' + text, art, { duration: 5000 }); } catch (e) { /* Hinweis optional */ }
    };
    // 1. Rückkehr nach Verletzung oder Sperre
    const behalten = [], zurueck = [];
    (CLUB.dfl.vertretung || []).forEach(v => {
      if (v.formation !== CLUB.formation || CLUB.lineup[v.slot] !== v.ersatz || !imKader.has(v.stamm)) return;
      if (Object.values(CLUB.lineup).indexOf(v.stamm) >= 0) return;
      const p = getPlayer(v.stamm);
      if (fehltGrund(p)) { behalten.push(v); return; }
      CLUB.lineup[v.slot] = v.stamm; zurueck.push({ p, ersatz: getPlayer(v.ersatz) });
    });
    CLUB.dfl.vertretung = behalten;
    // 2. Ausfälle raus, Lücken mit dem besten passenden Spieler füllen
    const raus = [];
    slots.forEach(s => {
      const id = CLUB.lineup[s.id]; if (!id) return;
      const p = imKader.has(id) ? getPlayer(id) : null, grund = fehltGrund(p);
      if (grund) { if (p) raus.push({ slot: s.id, p, grund }); CLUB.lineup[s.id] = null; }
    });
    if (slots.some(s => !CLUB.lineup[s.id])) window.baueAufstellung(true);
    const wechsel = raus.map(x => ({ raus: x.p, grund: x.grund, rein: getPlayer(CLUB.lineup[x.slot]) || null, slot: x.slot }));
    wechsel.forEach(w => { if (w.rein && (w.grund === 'verletzt' || w.grund === 'gesperrt')) behalten.push({ slot: w.slot, stamm: w.raus.id, ersatz: w.rein.id, formation: CLUB.formation }); });
    if (wechsel.length || zurueck.length) { try { if (typeof syncClubToTeams === 'function') syncClubToTeams(); } catch (e) { /* nur Anzeige */ } }
    // Kein einsatzfähiger Torwart: ein Feldspieler geht ins Tor; nur wenn weniger als elf einsatzfähig sind, spielt der Ausfall selbst
    const TROTZ = { verletzt: 'Verletzung', gesperrt: 'Sperre', Streik: 'Streik', Verletztenliste: 'Verletzung', 'Development Squad': 'Development Squad' };   // „spielt trotz Verletzung“ statt „trotz verletzt“
    const wechselText = w => !w.rein ? `niemand für ${name(w.raus)} (${w.grund})`
      : w.rein.id === w.raus.id ? `${name(w.raus)} spielt trotz ${TROTZ[w.grund] || w.grund} (zu wenige Einsatzfähige)`
      : `${name(w.rein)}${w.raus.pos === 'TW' && w.rein.pos !== 'TW' ? ' (Feldspieler) im Tor' : ''} für ${name(w.raus)} (${w.grund})`;
    if (wechsel.length) melde('🔄 Aufstellung angepasst', wechsel.map(wechselText).join(', '), 'warn',
      { typ: 'aufstellung', art: 'wechsel', liste: wechsel.map(w => ({ raus: w.raus.id, rein: w.rein ? w.rein.id : null, grund: w.grund, slot: w.slot })) });
    if (zurueck.length) melde('💪 Zurück in der Elf', zurueck.map(z => `${name(z.p)} für ${z.ersatz ? name(z.ersatz) : '–'}`).join(', '), 'info',
      { typ: 'aufstellung', art: 'zurueck', liste: zurueck.map(z => ({ rein: z.p.id, raus: z.ersatz ? z.ersatz.id : null, grund: 'zurück' })) });
    return wechsel.concat(zurueck.map(z => ({ rein: z.p, raus: z.ersatz, grund: 'zurück' })));
  }
  {
    const _orig = window.simulateCurrentFixture;
    if (typeof _orig === 'function') {
      window.simulateCurrentFixture = function () {
        try { ausfaelleErsetzen(); } catch (e) { console.warn('[DFL-Engine] Ausfälle', e); }
        return _orig.apply(this, arguments);
      };
      try { simulateCurrentFixture = window.simulateCurrentFixture; } catch (e) { /* nicht global gebunden */ }
    }
    // Schon beim Öffnen des Spieltags, damit die angepasste Elf vor dem Anpfiff zu sehen ist
    const _zeige = window.switchAppView;
    if (typeof _zeige === 'function') {
      window.switchAppView = function (view) {
        if (view === 'match') { try { ausfaelleErsetzen(); } catch (e) { console.warn('[DFL-Engine] Ausfälle', e); } }
        return _zeige.apply(this, arguments);
      };
    }
  }

  window.DFLEngine = { CFG, gegnerTeam, auswahlTeam, skalaAngleichen, technik, bruecke, ausfaelleErsetzen, letzte: () => letzte };
  console.log('[DFL-Engine v5] aktiv — Gegner mit echtem Kader (verfügbare Elf, D102), eine Stärke-Skala, echte Fitness, Technik wie bei eigenen Spielern, Torfaktor = KI-Formel (mit Formation), Ausfälle vor dem Anpfiff ersetzt');
})();
