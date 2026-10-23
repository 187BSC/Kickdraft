/* ═══════════════════════════════════════════════════════════════════════════
   DFL-STATISTIK  ·  v1   (Prüfung 2026-10-09: Torjägerliste mit erfundenen Namen, Preise ohne die echten Tore)
   ─────────────────────────────────────────────────────────────────────────
   Eine Saisonstatistik für alle 32 Vereine – Torjägerliste, Saisonpreise, Karrieren und Hall of Fame zeigen
   dieselben Zahlen:
     · KI gegen KI: die Tore jedes Spiels gehen sofort an Spieler des Kaders, mit denselben Gewichten wie in der
       Welt (DFLHistorie.CFG: Position, Angriff hoch 3, 70 % mit Vorlage); Einsätze je Spiel (Startelf, 8 % Pause,
       3 Wechsel aus dem Spieltagskader)
     · Gegner im eigenen Spiel: echte Torschützen und Vorlagen aus der Engine v3 (Welt-ID am Spieler)
     · eigener Verein: echte Tore und Vorlagen (p.stats) und Einsätze der Ligaspiele – Playoff-Tore zählen wie
       bei der KI nicht zur Saison
   Torjägerliste (buildTopScorers) in der DFL aus diesen Daten statt erfundener KI-Torjäger (engine_main.js).
   Saisonende: DFLHistorie.CFG.vorgabe liefert die Zahlen an statistik(); fehlende Tore (Spielstand aus der
   Saisonmitte) verteilt sie wie bisher nach Gewichten.
   Zustand: LEAGUE.dflStat = { [Saisonjahr der Welt]: { ab, ki: { team: { spieler: [T, V, Sp] } }, eigen: { … } } },
   höchstens zwei Jahre. Hängt sich an: recordResult, MatchEngineV3.simulateMatch, buildTopScorers.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  // Achtung: G ist im Spiel der Spielzustand – der Generator heißt hier Gen
  const Gen = window.DFLGenerator, H = window.DFLHistorie, D = window.DFLSpiel;
  if (!Gen || !H || !D) { console.warn('[DFL-Statistik] DFL-Module fehlen – Patch inaktiv'); return; }

  const CFG = {
    pause: 0.08,          // so oft fehlt ein Stammspieler (Rotation, Wehwehchen) → im Schnitt 24 von 26 Spielen
    wechsel: 3,           // Einwechslungen je Spiel aus dem Spieltagskader
    wechselAnteil: 0.35,  // Eingewechselte spielen rund 30 Minuten
    bank: 7,              // Spieltagskader = Startelf + 7
    jahre: 2              // so viele Saisons bleiben im Spielstand
  };
  const aktiv = () => typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.dfl && typeof CLUB !== 'undefined' && CLUB && CLUB.dfl && CLUB.dfl.aktiv;
  const kurzName = p => typeof displayName === 'function' ? displayName(p) : (p.firstName ? p.firstName.charAt(0) + '. ' : '') + p.name;

  // ── Zustand ──────────────────────────────────────────────────────────────
  function daten(jahr, anlegen) {
    if (!LEAGUE.dflStat || typeof LEAGUE.dflStat !== 'object') LEAGUE.dflStat = {};
    const A = LEAGUE.dflStat;
    if (!A[jahr] && anlegen) {
      // ab = Spieltag beim ersten Eintrag: 0 heißt, die ganze Saison ist mitgezählt (Einsätze zuverlässig)
      A[jahr] = { ab: LEAGUE.matchday || 0, ki: {}, eigen: {} };
      Object.keys(A).map(Number).sort((a, b) => b - a).slice(CFG.jahre).forEach(j => { delete A[j]; });
    }
    return A[jahr] || null;
  }
  const eintrag = (tab, id) => tab[id] || (tab[id] = [0, 0, 0]);
  // Summen je Spieler über alle Vereine (wer im Lauf der Saison wechselt, nimmt seine Tore mit)
  function summen(rec) {
    const m = new Map();
    if (!rec) return m;
    const dazu = (id, a) => { const v = m.get(id) || { tore: 0, vorlagen: 0, spiele: 0 }; v.tore += a[0]; v.vorlagen += a[1]; v.spiele += a[2]; m.set(id, v); };
    Object.values(rec.ki || {}).forEach(tab => Object.keys(tab).forEach(id => dazu(id, tab[id])));
    Object.keys(rec.eigen || {}).forEach(id => dazu(id, rec.eigen[id]));
    return m;
  }

  // ── Verteilen (KI-Spiele) ────────────────────────────────────────────────
  function ziehe(liste, gewicht) {
    let summe = 0;
    const w = liste.map(x => { const v = Math.max(0, gewicht(x) || 0); summe += v; return v; });
    if (summe <= 0) return null;
    let z = Math.random() * summe;
    for (let i = 0; i < liste.length; i++) { z -= w[i]; if (z <= 0) return liste[i]; }
    return liste[liste.length - 1];
  }
  // D95: Gewichte je Gruppe ohne Seite (LV/RV wie AV, LF/RF wie FL, LM/RM eigene Gruppe AM)
  const torGewicht = x => x.f * (H.CFG.torGewicht[Gen.grund(x.p.pos)] || 0) * Math.pow((x.p.att || x.p.ovr) / 75, 3);
  const vorlageGewicht = x => x.f * (H.CFG.vorlageGewicht[Gen.grund(x.p.pos)] || 0) * Math.pow((x.p.mid || x.p.ovr) / 75, 2);
  // Aufgebot eines Spiels: Startelf (je 8 % Pause, dafür spielt ein Ersatzmann durch) + 3 Wechsel; f = Spielanteil
  // D102: nur verfügbare Spieler (Verletzte fehlen), Startelf = die Elf, mit der die Spielformel rechnet (Formation des Stils)
  function aufgebot(team) {
    const S = window.DFLSaison, fit = team.roster.filter(S && S.verfuegbar ? S.verfuegbar : (p => !p.ir));
    const elf = S && S.teamWerte ? S.teamWerte(team).elf : Gen.startelfVon(fit), drin = new Set(elf.map(p => p.id));
    const bank = fit.filter(p => !drin.has(p.id)).sort((a, b) => b.ovr - a.ovr).slice(0, CFG.bank);
    const spielt = elf.filter(() => Math.random() >= CFG.pause).map(p => ({ p, f: 1 }));
    const fehlen = elf.length - spielt.length;
    for (let i = 0; i < fehlen + CFG.wechsel && bank.length; i++) {
      const b = ziehe(bank, p => Math.max(1, p.ovr - 50));
      bank.splice(bank.indexOf(b), 1);
      spielt.push({ p: b, f: i < fehlen ? 1 : CFG.wechselAnteil });
    }
    return spielt;
  }
  function verteile(tab, tore, liste, mitEinsatz) {
    if (mitEinsatz) liste.forEach(x => { eintrag(tab, x.p.id)[2]++; });
    for (let i = 0; i < tore; i++) {
      const sch = ziehe(liste, torGewicht);
      if (!sch) continue;
      eintrag(tab, sch.p.id)[0]++;
      if (Math.random() < H.CFG.vorlageQuote) {
        const vor = ziehe(liste.filter(x => x !== sch), vorlageGewicht);
        if (vor) eintrag(tab, vor.p.id)[1]++;
      }
    }
  }

  // ── Eigenes Ligaspiel: Torschützen des Gegners aus der Engine ────────────
  let PUFFER = null, LETZTE = null;
  const ZAEHLER = { engine: 0, verteilt: 0 };     // Gegner im eigenen Spiel: echte Schützen bzw. verteilt (Prüfung)
  // Engine-Spieler → _ref (Eingabe) → _ref (Spieler des Spiels bzw. der Welt): das tiefste Objekt
  const tief = x => { let r = x && x._ref; while (r && r._ref) r = r._ref; return r || null; };
  const weltId = x => { const r = tief(x); return (r && r.dflId) || null; };
  // Wer hat gespielt? Startelf, wer am Ende auf dem Platz stand, und jeder Ausgewechselte (Engine meldet ihn als refAus)
  function teilnehmer(res, seite, start) {
    const drin = new Set();
    (start || []).forEach(x => { const r = tief(x); if (r) drin.add(r); });
    (res.players || []).forEach(x => { if (x.team === seite) { const r = tief(x); if (r) drin.add(r); } });
    res.events.forEach(ev => { if (ev.type === 'wechsel' && ev.side === (seite ? 'away' : 'home') && ev.refAus) { const r = tief({ _ref: ev.refAus }); if (r) drin.add(r); } });
    return [...drin];
  }
  {
    const E = window.MatchEngineV3;
    if (E && typeof E.simulateMatch === 'function') {
      const _orig = E.simulateMatch;
      E.simulateMatch = function (heim, gast, opt) {
        const res = _orig.apply(this, arguments);
        try {
          const fx = typeof CURRENT_FIXTURE !== 'undefined' ? CURRENT_FIXTURE : null;
          // Wer vom eigenen Verein wirklich gespielt hat (Startelf + Eingewechselte), für jedes aufgezeichnete Pflichtspiel –
          // die Einsatzzeit-Zufriedenheit (contracts_patch.js) bestrafte sonst jeden Eingewechselten als „nicht eingesetzt“
          if (aktiv() && opt && opt.record && fx && res && Array.isArray(res.events)) {
            LETZTE = { woche: LEAGUE.week, ids: teilnehmer(res, 0, heim && heim.players).map(r => r.id).filter(id => id != null) };
          }
          // Eigener Verein ist in der Engine immer „home“ (engine_v3_adapter.js)
          if (aktiv() && opt && opt.record && fx && fx.type === 'liga' && res && Array.isArray(res.events)) {
            // Vorlage nur vom eigenen Mitspieler (Prüfung 2026-10-10: eigene Torhüter bekamen per Abschlag Vorlagen für Gegentore)
            const tore = res.events.filter(ev => ev.type === 'goal' && ev.side === 'away')
              .map(ev => [weltId(ev.player), ev.assist && ev.player && ev.assist.team === ev.player.team ? weltId(ev.assist) : null]);
            PUFFER = { gegner: D.dflIdVon(fx.opponentId), tag: LEAGUE.matchday, tore,
              spielte: teilnehmer(res, 1, gast && gast.players).map(r => r.dflId).filter(Boolean),
              eigen: teilnehmer(res, 0, heim && heim.players).map(r => r.id).filter(id => id != null) };
          }
        } catch (e) { console.warn('[DFL-Statistik] Engine-Torschützen', e); }
        return res;
      };
    }
  }
  function ausEngine(rec, team, P) {
    const tab = rec.ki[team.id] || (rec.ki[team.id] = {}), spielte = new Set(P.spielte);
    P.tore.forEach(([s, v]) => { if (s) spielte.add(s); if (v) spielte.add(v); });
    spielte.forEach(id => { eintrag(tab, id)[2]++; });
    P.tore.forEach(([s, v]) => { if (s) eintrag(tab, s)[0]++; if (v && v !== s) eintrag(tab, v)[1]++; });
  }
  // Eigene Spieler: Tore/Vorlagen aus p.stats (Stand nach dem Ligaspiel); Einsätze hier gezählt – mit Einwechslungen
  // aus der Engine (addPlayerApp zählt nur die Startelf, dafür auch Testspiele)
  function eigenesSpiel(rec, dabeiIds) {
    if (typeof SQUAD === 'undefined') return;
    const s = LEAGUE.season;
    const dabei = new Set(dabeiIds || (typeof getLineupIds === 'function' ? getLineupIds() : []));
    SQUAD.forEach(q => {
      const st = q.stats && q.stats.season === s ? q.stats : null, war = dabei.has(q.id);
      if (!war && !(st && (st.goals || st.assists))) return;
      const e = eintrag(rec.eigen, q.dflId || q.id);
      if (st) { e[0] = st.goals || 0; e[1] = st.assists || 0; }
      if (war) e[2]++;
    });
  }
  function spielVerbuchen(heimId, gastId, th, tg) {
    const L = D.liga(), rec = daten(L.saisonJahr, true), eigenesDa = heimId === 'fcm' || gastId === 'fcm';
    let P = null;
    if (eigenesDa) { P = PUFFER && PUFFER.tag === LEAGUE.matchday ? PUFFER : null; PUFFER = null; }
    [[heimId, th, gastId], [gastId, tg, heimId]].forEach(([id, tore, gegen]) => {
      if (id === 'fcm') return;
      const t = L.teams.find(x => x.id === D.dflIdVon(id));
      if (!t) return;
      if (gegen === 'fcm') {
        if (P && P.gegner === t.id && P.tore.length === tore) { ausEngine(rec, t, P); ZAEHLER.engine++; return; }
        ZAEHLER.verteilt++;
      }
      verteile(rec.ki[t.id] || (rec.ki[t.id] = {}), tore, aufgebot(t), true);
    });
    if (eigenesDa) eigenesSpiel(rec, P ? P.eigen : null);
  }
  {
    const _orig = window.recordResult;
    if (typeof _orig === 'function') {
      window.recordResult = function (teams, homeId, awayId, gh, ga) {
        const r = _orig.apply(this, arguments);
        if (aktiv()) { try { spielVerbuchen(homeId, awayId, gh, ga); } catch (e) { console.warn('[DFL-Statistik] Spiel', e); } }
        return r;
      };
      try { recordResult = window.recordResult; } catch (e) { /* global überschrieben reicht */ }
    }
  }

  // ── Torjägerliste ────────────────────────────────────────────────────────
  function torjaeger(limit) {
    const L = D.liga(), sum = summen(daten(L.saisonJahr, false));
    const wo = new Map();
    L.teams.forEach(t => t.roster.concat(t.practice_squad || []).forEach(p => wo.set(p.id, { p, t })));
    (L.freie || []).forEach(p => { if (!wo.has(p.id)) wo.set(p.id, { p, t: null }); });
    const eigene = new Map((typeof SQUAD !== 'undefined' ? SQUAD : []).map(q => [q.dflId || q.id, q]));
    const liste = [];
    sum.forEach((v, id) => {
      if (!v.tore && !v.vorlagen) return;
      const q = eigene.get(id), w = wo.get(id);
      if (!q && !w) return;                                  // Karriereende oder Ausland
      liste.push({ id, name: kurzName(q || w.p), teamName: q ? clubName() : (w.t ? w.t.name : 'vereinslos'),
        goals: v.tore, assists: v.vorlagen, spiele: v.spiele, own: !!q, spieler: q || w.p, teamId: q ? 'fcm' : (w.t ? w.t.id : null) });
    });
    liste.sort((a, b) => b.goals - a.goals || b.assists - a.assists || a.spiele - b.spiele);
    return limit ? liste.slice(0, limit) : liste;
  }
  {
    const _orig = window.buildTopScorers;
    if (typeof _orig === 'function') {
      window.buildTopScorers = function (league, limit) {
        if (!aktiv()) return _orig.apply(this, arguments);
        try { return torjaeger(limit); } catch (e) { console.warn('[DFL-Statistik] Torjägerliste', e); return []; }
      };
      try { buildTopScorers = window.buildTopScorers; } catch (e) { /* global überschrieben reicht */ }
    }
  }

  // ── Saisonende: Zahlen für DFLHistorie.statistik ─────────────────────────
  H.CFG.vorgabe = function (L, t, zeile) {
    if (!aktiv() || !LEAGUE.dflStat) return null;
    const rec = LEAGUE.dflStat[L.saisonJahr];
    if (!rec) return null;
    const m = summen(rec);
    m.komplett = rec.ab === 0;
    // Tore ohne Eintrag (Spielstand aus der Saisonmitte, Tor ohne Schützen) nach Gewichten verteilen
    const eigen = t.id === D.eigeneDflId(), tab = eigen ? rec.eigen : (rec.ki[t.id] || {});
    const rest = ((zeile && zeile.gf) || 0) - Object.keys(tab).reduce((s, id) => s + tab[id][0], 0);
    if (rest > 0) {
      const fit = t.roster.filter(p => !p.ir), elf = new Set(Gen.startelfVon(fit).map(p => p.id));
      const zusatz = {};
      verteile(zusatz, rest, fit.map(p => ({ p, f: elf.has(p.id) ? 1 : CFG.wechselAnteil })), false);
      Object.keys(zusatz).forEach(id => {
        const v = m.get(id) || { tore: 0, vorlagen: 0, spiele: 0 };
        v.tore += zusatz[id][0]; v.vorlagen += zusatz[id][1]; m.set(id, v);
      });
    }
    return m;
  };

  // Eigene Spieler des letzten aufgezeichneten Spiels dieser Woche (Startelf + Eingewechselte); verbrauchen = einmal lesen
  function eigeneTeilnehmer(verbrauchen) {
    const x = LETZTE && LETZTE.woche === LEAGUE.week ? LETZTE.ids.slice() : null;
    if (verbrauchen) LETZTE = null;
    return x;
  }
  window.DFLStatistik = { CFG, ZAEHLER, torjaeger, summen, daten, aufgebot, verteile, eigeneTeilnehmer };
  console.log('%c[DFL-Statistik v1] aktiv', 'color:#3fb950;font-weight:bold',
    '— Torjägerliste mit echten Spielern, KI-Tore je Spiel verteilt, Gegner-Torschützen aus der Engine, Preise mit echten eigenen Toren');
})();
