/* ═══════════════════════════════════════════════════════════════════════════
   DFL-EHRUNGEN  ·  v1   (Wunsch 2026-10-08: Hall of Fame für brutale Karrieren, Pro Bowl wie in der NFL)
   ─────────────────────────────────────────────────────────────────────────
   Schließt das Liga-Gedächtnis (dfl_historie.js) ans Spiel an:
     · Saisonpreise zum Saisonwechsel: Spieler der Saison, Torschützenkönig, Verteidiger, Rookie,
       Spieler der Finals, Manager der Saison, Elf der Saison (Werte aus der Saisonstatistik der Welt)
     · Hall of Fame beim Karriereende: Saisonwerte, Preise, Titel und Pro Bowls über einer Schwelle je
       Position – für KI-Spieler (Ruhestand in der Welt) und eigene Spieler (Karriereende im Spiel)
     · Pro Bowl: je Conference die 18 Besten (2 TW, 3 IV, LV, RV, 2 ZDM, ZM, LM, RM, 2 OM, LF, RF, 2 ST), ohne Spieler der
       beiden Finalisten. D158: Aufgebot nach dem Conference-Finale (Meldung mit Karte, Blatt mit Gesichtern), Spiel in der
       Woche vor dem Finale mit Engine v3 auf neutralem Platz (Schaulaufen über den Torfaktor), im Ticker ansehen oder still
       beim Weiterklicken; Elfmeterschießen bei Gleichstand, MVP. Jede Nominierung zählt für die Hall of Fame.
     · Reiter „Ehrenhalle“ im Bereich Liga: Hall of Fame, Preise, Pro Bowl, Rekorde, Meister
   Zustand: Welt (L.historie, Spieler.karriere) wird mit LEAGUE.dflWelt gespeichert; eigene Spieler tragen
   ihre Karriere selbst (SQUAD, gleiches Objekt wie in der Welt). Pro Bowl: po.proBowl → LEAGUE.dflPlayoffs.proBowl.
   Hängt sich an: DFLSaison.phaseAbschluss (Preise vorher, Hall of Fame nachher), startNewSeason (eigene
   Karriereenden), renderLgPokal (Pro-Bowl-Karte), switchLigaSubview + renderLeagueTab (Ehrenhalle).
   dfl_playoffs_patch.js ruft DFLEhrungen.proBowl nach dem Conference-Finale und DFLEhrungen.proBowlNachholen vor dem Finale;
   Ticker über DFLTextspiel.proBowl, Postfach-Karte über dfl_bilder_patch.js, Haupt-Button in dfl_app_shell.js.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  // Achtung: G ist im Spiel der Spielzustand – der Generator heißt hier Gen
  const Gen = window.DFLGenerator, S = window.DFLSaison, H = window.DFLHistorie, D = window.DFLSpiel, I = window.DFLIdentitaet;
  if (!Gen || !S || !H || !D) { console.warn('[DFL-Ehrungen] DFL-Module fehlen – Patch inaktiv'); return; }

  const CFG = {
    // 18 je Conference; D95 je Position mit Seite (vorher AV 3, FL 3 ohne Seite)
    quote: { TW: 2, IV: 3, LV: 1, RV: 1, ZDM: 2, ZM: 1, LM: 1, RM: 1, OM: 2, LF: 1, RF: 1, ST: 2 },
    schaulaufen: 0.8,                  // zusätzliche Torerwartung je Team im Pro Bowl (Formel: Siegchance im Ticker, Rückfall ohne Engine)
    torFaktor: 2.8,                    // D158: Engine v3, Ausgang der Abschlüsse beider Teams (Schaulaufen) – gemessen 1,8 → Ø 3,7 Tore, 2,4 → 4,0, 3,0 → 5,0
    hofZeigen: 40
  };
  const KONF = { SUE_WEST: 'Süd-West', NORD_OST: 'Nord-Ost' };
  // Anzeige (OM der Welt heißt ZOM); D95 mit Seite, AV/FL aus alten Einträgen bleiben lesbar
  const POS = { TW: 'TW', IV: 'IV', LV: 'LV', RV: 'RV', AV: 'AV', ZDM: 'ZDM', ZM: 'ZM', LM: 'LM', RM: 'RM', OM: 'ZOM', LF: 'LF', RF: 'RF', FL: 'FL', ST: 'ST' };
  const POS_ORDNUNG = ['TW', 'IV', 'LV', 'RV', 'AV', 'ZDM', 'ZM', 'LM', 'RM', 'OM', 'LF', 'RF', 'FL', 'ST'];
  const saisonText = s => { try { return typeof seasonYearLabel === 'function' ? seasonYearLabel(s) : String(s); } catch (e) { return String(s); } };

  const aktiv = () => typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.dfl && typeof CLUB !== 'undefined' && CLUB && CLUB.dfl && CLUB.dfl.aktiv;
  const name = p => (p.firstName ? p.firstName + ' ' : '') + p.name;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const melde = (titel, text, art, extra) => { try { addNews(art || 'season', titel, text, extra); } catch (e) { /* Meldungen sind optional */ } };
  const weltTeam = id => D.liga().teams.find(t => t.id === id);
  const teamName = id => { const t = id && weltTeam(id); return t ? t.name : '–'; };
  const eigeneId = () => D.eigeneDflId();
  const icon = n => (I && I.icon ? I.icon(n) : '');
  // game-icons-Marke (dfl_spielicons.js, D52), sonst das Tabler-Zeichen wie bisher
  const ehrIcon = (gi, ti) => (window.DFLSpielicons && DFLSpielicons.hat(gi) ? DFLSpielicons.marke(gi, 'gold') : icon(ti));
  const wappen = id => { const t = id && weltTeam(id); return t && I ? `<span class="dfl-eh-wappen" aria-hidden="true">${I.wappenSvg(t)}</span>` : ''; };
  function historie(L) { if (!L.historie) L.historie = { saisons: [], rekorde: {}, hallOfFame: [], ehemalige: [] }; return L.historie; }
  // Eigene Spieler: Karriere am Spieler im Spiel (SQUAD) – in der Welt steckt dasselbe Objekt
  function karriereZurueck(L) {
    const t = L.teams.find(x => x.id === eigeneId()); if (!t || typeof SQUAD === 'undefined') return;
    t.roster.concat(t.practice_squad || []).forEach(p => {
      if (!p.sq || !p.karriere) return;
      const q = SQUAD.find(x => x.id === p.sq);
      if (q && q.karriere !== p.karriere) q.karriere = p.karriere;
    });
  }

  // ── Pro Bowl (D158, Nutzer 2026-10-14: „das pro bowl team würde ich gerne sehen als anzeige bevor es ist und man kann es
  // verfolgen über den Ticker genauso wie das finale“, Vorschau freigegeben) ─────────────────────────────────────────────
  // 1. Nach den Conference-Finals nur das Aufgebot (po.proBowl.status 'angesetzt'); Meldung mit Karte, Nominierungen zählen.
  // 2. Ab der Woche vor dem Finale spielbar: Engine v3 auf neutralem Platz, Teams aus Kopien der Weltspieler
  //    (DFLEngine.auswahlTeam → zuSpielSpieler). Das Ergebnis steht im Spielstand, bevor der Ticker es abspielt.
  //    „Pro Bowl ansehen“ (Haupt-Button, Reiter Playoffs, Aufgebot) spielt es im Ticker, sonst rechnet es still beim
  //    Verlassen der Woche (advanceCalendarWeek, „Simulieren bis …“) bzw. spätestens vor dem Finale (DFLPlayoffs).
  // 3. Ändert nichts an Kader und Liga: kein CURRENT_FIXTURE während der Engine läuft (Brücke, Statistik, Neutral-Haken
  //    greifen nicht), Wechsel-Puffer von substitution_stats_patch.js zurückgesetzt, kein processFixtureResult/PostMatchModal.
  // Format po.proBowl: { saison, status, woche, kader { SUE_WEST, NORD_OST: [eintrag] }, ohne } + nach dem Spiel tore, sieger,
  // elfer (bool), elferStand, kicks, schuetzen [{ konf, id, name, teamId, min, nach, vorlage }], mvp, stats. Alte Spielstände:
  // ohne status, mit tore = gespielt.
  const KURZ_KONF = { SUE_WEST: 'SÜD', NORD_OST: 'NORD' };
  const MARKE_KONF = { SUE_WEST: ['sw', 'SW'], NORD_OST: ['no', 'NO'] };
  const FARBE_KONF = { SUE_WEST: ['#c8102e', '#ffffff'], NORD_OST: ['#1d4ed8', '#ffffff'] };
  const SEITE = { home: 'SUE_WEST', away: 'NORD_OST' };
  const gespielt = pb => !!(pb && Array.isArray(pb.tore));
  const poJetzt = () => { try { return window.DFLPlayoffs && DFLPlayoffs.stand ? DFLPlayoffs.stand() : null; } catch (e) { return null; } };
  const konfMarke = (k, kl) => `<span class="pb-konf-marke ${MARKE_KONF[k][0]}${kl ? ' ' + kl : ''}" aria-hidden="true">${MARKE_KONF[k][1]}</span>`;
  const ergText = pb => `${pb.tore[0]}:${pb.tore[1]}${pb.elfer && pb.elferStand ? `, ${pb.elferStand[0]}:${pb.elferStand[1]} i. E.` : pb.elfer ? ' i. E.' : ''}`;

  function poisson(l) { const g = Math.exp(-l); let k = 0, p = 1; do { k++; p *= Math.random(); } while (p > g); return k - 1; }
  function ziehe(liste, gewicht) {
    const summe = liste.reduce((s, x) => s + gewicht(x), 0); if (summe <= 0) return liste[0];
    let x = Math.random() * summe;
    for (const e of liste) { x -= gewicht(e); if (x <= 0) return e; }
    return liste[liste.length - 1];
  }
  function auswahl(L, konf, raus) {
    const pool = [];
    L.teams.filter(t => t.conference === konf && !raus.has(t.id)).forEach(t => t.roster.forEach(p => { if (!p.ir) pool.push({ p, t }); }));
    pool.sort((a, b) => b.p.ovr - a.p.ovr);
    const wahl = [], zahl = {};
    pool.forEach(x => { if ((zahl[x.p.pos] || 0) < (CFG.quote[x.p.pos] || 0)) { zahl[x.p.pos] = (zahl[x.p.pos] || 0) + 1; wahl.push(x); } });
    for (const x of pool) { if (wahl.length >= 18) break; if (wahl.indexOf(x) < 0) wahl.push(x); }
    return wahl.slice(0, 18);
  }
  // Schritt 1: Aufgebot nach dem Conference-Finale (dfl_playoffs_patch.js, rundeAbschliessen r = 3)
  function proBowl(po, still) {
    if (!aktiv() || !po || po.proBowl) return null;
    const fin = po.spiele.find(s => s.runde === 4); if (!fin) return null;
    const L = D.welt();
    const raus = new Set([fin.heim, fin.gast].map(id => D.dflIdVon(id)));
    const kader = { SUE_WEST: auswahl(L, 'SUE_WEST', raus), NORD_OST: auswahl(L, 'NORD_OST', raus) };
    // Gesicht über Seed und Namen (auch wenn der Spieler die Welt später verlässt)
    const eintrag = e => ({ id: e.p.id, sq: e.p.sq || null, name: name(e.p), firstName: e.p.firstName || '', nachname: e.p.name, seed: e.p.seed != null ? e.p.seed : null,
      pos: e.p.pos, ovr: e.p.ovr, alter: e.p.age, teamId: e.t.id });
    po.proBowl = { saison: po.saison, status: 'angesetzt', woche: Array.isArray(po.wochen) ? po.wochen[2] + 1 : null,
      kader: { SUE_WEST: kader.SUE_WEST.map(eintrag), NORD_OST: kader.NORD_OST.map(eintrag) }, ohne: [...raus] };
    // Karrieren: jede Nominierung zählt (Hall of Fame)
    [...kader.SUE_WEST, ...kader.NORD_OST].forEach(e => { const k = H.karriere(e.p); k.proBowls = (k.proBowls || 0) + 1; });
    karriereZurueck(L);
    if (!still) meldeAufgebot(po.proBowl);
    return po.proBowl;
  }
  // Spielbar ab der Woche nach dem Conference-Finale, solange das Finale noch aussteht
  function bereit() {
    if (!aktiv()) return null;
    const po = poJetzt(), pb = po && po.proBowl;
    return pb && !gespielt(pb) && !po.meister && Array.isArray(po.wochen) && LEAGUE.week > po.wochen[2] ? pb : null;
  }
  // Pro Bowl einer Saison: laufende Playoffs, sonst die abgeschlossenen
  function pbVon(saison) {
    const po = poJetzt(), P = typeof LEAGUE !== 'undefined' && LEAGUE ? LEAGUE.dflPlayoffs : null;
    const liste = [po && po.proBowl, P && P.proBowl].filter(Boolean);
    return saison == null ? liste[0] || null : liste.find(pb => pb.saison === saison) || null;
  }
  // Weltspieler zum Eintrag – er kann seit dem Aufgebot verletzt oder getauscht worden sein
  function weltSpielerVon(L, e) {
    const such = t => ((t && t.roster) || []).find(p => p.id === e.id || (e.sq && p.sq === e.sq)) || null;
    return such(L.teams.find(t => t.id === e.teamId)) || L.teams.reduce((x, t) => x || such(t), null);
  }
  function teamFuer(L, pb, k) {
    const verf = S.verfuegbar || (p => !p.ir);
    const liste = pb.kader[k].map(e => weltSpielerVon(L, e)).filter(p => p && verf(p));
    return window.DFLEngine && DFLEngine.auswahlTeam ? DFLEngine.auswahlTeam(liste, { name: KONF[k] }) : null;
  }
  // Torerwartung der Formel wie bis D158 (Siegchance im Ticker, Rückfall ohne Engine)
  function lambdaVon(L, pb) {
    const w = k => S.teamWerte({ roster: pb.kader[k].map(e => weltSpielerVon(L, e)).filter(Boolean) });
    const A = w('SUE_WEST'), B = w('NORD_OST');
    const x = S.toreErwartet(A, B, 0), y = S.toreErwartet(B, A, 0);
    return [(x[0] + y[1]) / 2 + CFG.schaulaufen, (x[1] + y[0]) / 2 + CFG.schaulaufen];
  }
  const tief = x => { let r = x && x._ref; while (r && r._ref) r = r._ref; return r || null; };
  const weltIdVon = x => { const r = tief(x); return r ? (r.dflId || r.id) : null; };
  const minuteVon = t => { const roh = t / 60; return { min: Math.max(1, Math.min(90, Math.floor(roh) + 1)), nach: roh >= 90 ? Math.floor(roh - 90) + 1 : 0 }; };
  // Engine-Lauf ohne Buchung: kein Spiel geladen (CURRENT_FIXTURE), Wechsel-Puffer des eigenen Spiels unverändert
  function engineLauf(H, A) {
    const hatFx = typeof CURRENT_FIXTURE !== 'undefined', fx = hatFx ? CURRENT_FIXTURE : null;
    const ES = window.EinwechslungsStatistik, wv = ES && ES.letzteWechsel ? ES.letzteWechsel().slice() : null;
    try {
      if (fx) CURRENT_FIXTURE = null;
      return MatchEngineV3.simulateMatch(H, A, { seed: (Math.random() * 1e9) | 0, record: true, homeAdv: null, torFaktor: [CFG.torFaktor, CFG.torFaktor] });
    } finally {
      if (fx) CURRENT_FIXTURE = fx;
      if (wv) { const a = ES.letzteWechsel(); if (Array.isArray(a)) { a.length = 0; wv.forEach(x => a.push(x)); } }
    }
  }
  // Elf am Ende (Wechsel und Platzverweise aus den Ereignissen) → Schützen wie im Elfmeterschießen der Playoffs
  function elfAmEnde(res, seite, start) {
    const drin = new Map(start.map(tief).filter(Boolean).map(p => [p.id, p]));
    (res.events || []).slice().sort((a, b) => a.t - b.t).forEach(ev => {
      if (ev.side !== seite) return;
      if (ev.type === 'wechsel') { const a = tief({ _ref: ev.refAus }), b = tief(ev.player); if (a) drin.delete(a.id); if (b) drin.set(b.id, b); }
      else if (ev.type === 'red' || ev.type === 'gelbrot') { const q = tief(ev.player); if (q) drin.delete(q.id); }
    });
    return [...drin.values()];
  }
  function elfmeterschiessen(res, Ht, At) {
    const P = window.DFLPlayoffs, E = (P && P.CFG && P.CFG.elfer) || { basis: 0.62, att: 0.004, mental: 0.003, torwart: 0.002, min: 0.6, max: 0.9 };
    const elf = [elfAmEnde(res, 'home', Ht.players), elfAmEnde(res, 'away', At.players)];
    const reihe = l => l.filter(p => p.pos !== 'TW').sort((a, b) => ((b.att || 50) * 0.6 + (b.mental || 50) * 0.4) - ((a.att || 50) * 0.6 + (a.mental || 50) * 0.4));
    const tw = l => (l.find(p => p.pos === 'TW') || {}).ovr || 75;
    const quote = (p, t) => Math.max(E.min, Math.min(E.max, E.basis + ((p.att || 60) - 60) * E.att + ((p.mental || 60) - 60) * E.mental - ((t || 75) - 75) * E.torwart));
    const r = [reihe(elf[0]), reihe(elf[1])];
    const q = s => i => (r[s].length ? quote(r[s][i % r[s].length], tw(elf[1 - s])) : 0.75);
    if (!P || typeof P.schiessen !== 'function') { const h = Math.random() < 0.5; return { h: h ? 5 : 4, a: h ? 4 : 5, kicks: [] }; }
    const e = P.schiessen(q(0), q(1));
    const kicks = e.kicks.map(k => { const p = r[k.seite][k.nr % Math.max(1, r[k.seite].length)]; return { konf: k.seite ? 'NORD_OST' : 'SUE_WEST', wer: p ? p.name : '', tor: !!k.tor }; });
    return { h: e.h, a: e.a, kicks };
  }
  // Startelf fürs Feld (Testrückmeldung 2026-10-22): Weltspieler-ID und Platz (px 0 = eigenes Tor … 100, py 0 … 100 Breite)
  const aufstellungVon = T => (T && T.players ? { formation: T.formation, elf: T.players.map(x => ({ id: weltIdVon(x), px: x.px, py: x.py })) } : null);
  // Schritt 2: das Spiel – reine Rechnung (setzt nur po.proBowl über abschliessen)
  function rechnen(po) {
    const pb = po.proBowl, L = D.welt(), lambda = lambdaVon(L, pb);
    const Ht = teamFuer(L, pb, 'SUE_WEST'), At = teamFuer(L, pb, 'NORD_OST');
    if (!window.MatchEngineV3 || !Ht || !At || Ht.players.length < 11 || At.players.length < 11) return formelErgebnis(L, pb, lambda);
    const res = engineLauf(Ht, At);
    const tore = [res.stats.home.goals, res.stats.away.goals];
    const eintragVon = (k, id) => (id == null ? null : pb.kader[k].find(e => e.id === id) || null);
    const schuetzen = res.events.filter(ev => ev.type === 'goal').sort((a, b) => a.t - b.t).map(ev => {
      const k = SEITE[ev.side], id = weltIdVon(ev.player), e = eintragVon(k, id), m = minuteVon(ev.t), r = tief(ev.player);
      const vid = ev.assist && ev.player && ev.assist.team === ev.player.team ? weltIdVon(ev.assist) : null, v = vid !== id ? eintragVon(k, vid) : null;
      return { konf: k, id, name: e ? e.name : r ? name(r) : ((ev.player && ev.player.name) || ''), teamId: e ? e.teamId : null, min: m.min, nach: m.nach,
        art: ev.art || null, vorlage: v ? v.name : null, vorlageId: v ? v.id : null };
    });
    const sh = res.stats.home, sa = res.stats.away;
    return { tore, schuetzen, elfer: tore[0] === tore[1] ? elfmeterschiessen(res, Ht, At) : null, lambda, aufstellung: { SUE_WEST: aufstellungVon(Ht), NORD_OST: aufstellungVon(At) },
      stats: { schuesse: [sh.shots, sa.shots], xg: [+(sh.xg || 0).toFixed(2), +(sa.xg || 0).toFixed(2)], besitz: [sh.possPct, sa.possPct] },
      rec: { frames: res.frames, frameCount: res.frameCount, stride: res.stride, events: res.events, score: res.score, stats: res.stats, teams: [Ht, At] } };
  }
  // Rückfall ohne Engine (Test, Engine fehlt): Formel wie bis D158
  function formelErgebnis(L, pb, lambda) {
    const tore = [poisson(lambda[0]), poisson(lambda[1])], schuetzen = [];
    [['SUE_WEST', tore[0]], ['NORD_OST', tore[1]]].forEach(([k, n]) => {
      const liste = pb.kader[k].map(e => ({ e, p: weltSpielerVon(L, e) || e }));
      for (let i = 0; i < n; i++) {
        const s = ziehe(liste, x => ({ ST: 6, FL: 4, AM: 3, OM: 3, ZM: 1.5, ZDM: 0.7, AV: 0.5, IV: 0.4, TW: 0 }[Gen.grund(x.e.pos)] || 0.5) * Math.pow((x.p.att || 60) / 75, 3));
        schuetzen.push({ konf: k, id: s.e.id, name: s.e.name, teamId: s.e.teamId, min: 1 + Math.floor(Math.random() * 90), nach: 0, art: null, vorlage: null, vorlageId: null });
      }
    });
    schuetzen.sort((a, b) => a.min - b.min);
    const h = Math.random() < 0.5;
    return { tore, schuetzen, elfer: tore[0] === tore[1] ? { h: h ? 5 : 4, a: h ? 4 : 5, kicks: [] } : null, lambda, stats: null, rec: null };
  }
  // Ergebnis eintragen: Sieger, MVP (Tore × 3 + Vorlagen × 2 beim Sieger; ohne Tor der Torhüter nach Elfmeterschießen, sonst der Beste)
  function abschliessen(pb, r) {
    const sieger = r.tore[0] > r.tore[1] ? 'SUE_WEST' : r.tore[1] > r.tore[0] ? 'NORD_OST' : (r.elfer.h > r.elfer.a ? 'SUE_WEST' : 'NORD_OST');
    const punkte = {}, toreVon = {}, vorlVon = {};
    r.schuetzen.filter(s => s.konf === sieger).forEach(s => {
      if (s.id != null) { punkte[s.id] = (punkte[s.id] || 0) + 3; toreVon[s.id] = (toreVon[s.id] || 0) + 1; }
      if (s.vorlageId != null) { punkte[s.vorlageId] = (punkte[s.vorlageId] || 0) + 2; vorlVon[s.vorlageId] = (vorlVon[s.vorlageId] || 0) + 1; }
    });
    const kader = pb.kader[sieger], nachStaerke = l => l.slice().sort((a, b) => b.ovr - a.ovr);
    const mvp = kader.filter(e => punkte[e.id]).sort((a, b) => punkte[b.id] - punkte[a.id] || (toreVon[b.id] || 0) - (toreVon[a.id] || 0) || b.ovr - a.ovr)[0]
      || (r.elfer ? nachStaerke(kader.filter(e => e.pos === 'TW'))[0] : null) || nachStaerke(kader)[0];
    Object.assign(pb, { status: 'gespielt', tore: r.tore, sieger, elfer: !!r.elfer, elferStand: r.elfer ? [r.elfer.h, r.elfer.a] : null, kicks: r.elfer ? r.elfer.kicks : null,
      schuetzen: r.schuetzen, mvp: Object.assign({}, mvp, { tore: toreVon[mvp.id] || 0, vorlagen: vorlVon[mvp.id] || 0 }), stats: r.stats || null,
      gespieltWoche: typeof LEAGUE !== 'undefined' && LEAGUE ? LEAGUE.week : null, engine: !!r.rec, aufstellung: r.aufstellung || pb.aufstellung || null });
    return pb;
  }
  function spielen(po, opt) {
    opt = opt || {};
    const pb = po && po.proBowl;
    if (!aktiv() || !pb || gespielt(pb)) return null;
    let r;
    try { r = rechnen(po); }
    catch (e) { console.warn('[DFL-Ehrungen] Pro Bowl: Engine', e); const L = D.liga(); r = formelErgebnis(L, pb, lambdaVon(L, pb)); }
    abschliessen(pb, r);
    if (!opt.still) meldeErgebnis(pb);
    return r;
  }
  // Rückfall vor dem Finale (dfl_playoffs_patch.js) und beim Verlassen der Woche
  function nachholen(po, still) { const p = po || poJetzt(); return p && p.proBowl && !gespielt(p.proBowl) ? spielen(p, { still: !!still }) : null; }
  function meldeAufgebot(pb) {
    const eigene = [...pb.kader.SUE_WEST, ...pb.kader.NORD_OST].filter(e => e.teamId === eigeneId());
    melde('Pro Bowl: das Aufgebot', `Je Conference die 18 Besten ohne die Finalisten, Spiel in der Woche vor dem Finale${pb.woche ? ` (KW ${pb.woche})` : ''}. ` +
      (eigene.length ? `Von dir dabei: ${eigene.map(e => `${e.name} (${POS[e.pos] || e.pos})`).join(', ')}. Jede Nominierung zählt für die Hall of Fame.`
        : 'Diesmal ist kein Spieler von dir nominiert.'), 'season', { karte: { typ: 'probowl', art: 'aufgebot', saison: pb.saison } });
  }
  function meldeErgebnis(pb) {
    const s = pb.sieger;
    melde(`Pro Bowl: ${KONF.SUE_WEST} ${pb.tore[0]}:${pb.tore[1]} ${KONF.NORD_OST}`, `${pb.elfer ? `Nach Elfmeterschießen${pb.elferStand ? ` (${pb.elferStand[0]}:${pb.elferStand[1]})` : ''} gewinnt` : 'Es gewinnt'} die Conference ${KONF[s]}. ` +
      `MVP: ${pb.mvp.name} (${teamName(pb.mvp.teamId)})${pb.mvp.tore ? `, ${pb.mvp.tore} Tor${pb.mvp.tore > 1 ? 'e' : ''}` : ''}.`, 'season', { karte: { typ: 'probowl', art: 'ergebnis', saison: pb.saison } });
  }

  // ── Pro Bowl: ansehen (Ticker), Aufgebot und Ergebnis als Blatt, Postfach-Karte ──────────────────
  const tickerTeam = k => ({ id: k, name: KONF[k], stadt: KONF[k], spitz: KONF[k] + '-Stars', kurz: KURZ_KONF[k], farben: FARBE_KONF[k].slice(), marke: konfMarke(k, 'ts-konf') });
  function ansehen() {
    const pb = bereit(), po = poJetzt();
    if (!pb) { if (pbVon()) blatt(); return false; }
    blattZu();
    const r = spielen(po, {});
    if (!r) return false;
    try { if (typeof saveGameState === 'function') saveGameState(); } catch (e) { console.warn('[DFL-Ehrungen] Pro Bowl: Speichern', e); }
    let lief = false;
    if (r.rec && window.DFLTextspiel && typeof DFLTextspiel.proBowl === 'function') {
      try {
        lief = DFLTextspiel.proBowl({ rec: r.rec, teams: { h: tickerTeam('SUE_WEST'), g: tickerTeam('NORD_OST') }, tore: pb.tore, lambda: r.lambda,
          nach: r.elfer ? { art: 'Elfmeterschießen', direkt: true, tore: [], kicks: r.elfer.kicks.map(x => ({ s: x.konf === 'SUE_WEST' ? 'h' : 'g', wer: x.wer, tor: x.tor })), elfer: [r.elfer.h, r.elfer.a] } : null,
          kopf: `${KONF.SUE_WEST} gegen ${KONF.NORD_OST} · ${po.finalort ? 'in ' + po.finalort : 'neutraler Platz'}`, ort: po.finalort || null,
          mvp: `${pb.mvp.name} (${teamName(pb.mvp.teamId)})` }, neuZeichnen);
      } catch (e) { console.warn('[DFL-Ehrungen] Pro Bowl: Ticker', e); lief = false; }
    }
    neuZeichnen();
    if (!lief) blatt(pb.saison);
    return true;
  }
  function neuZeichnen() {
    try { if (window.DFLAppShell && DFLAppShell.cta) DFLAppShell.cta(); } catch (e) { /* nur am Handy */ }
    try { if (typeof renderCalendarWidget === 'function') renderCalendarWidget(); } catch (e) { /* nur Anzeige */ }
    try { const el = hatDom() && document.getElementById('lg-sub-pokal'); if (el && el.classList.contains('active') && typeof renderLgPokal === 'function') renderLgPokal(); } catch (e) { /* nur Anzeige */ }
  }
  const kurzVon = id => { const t = id && weltTeam(id); return t ? (t.kurz || String(t.name || '').slice(0, 3).toUpperCase()) : ''; };
  function gesichtVon(e) {
    if (!I || !I.gesichtSvg) return '';
    let p = null;
    try { p = weltSpielerVon(D.liga(), e); } catch (x) { p = null; }
    const q = p || (e.seed != null ? { id: e.id, seed: e.seed, firstName: e.firstName, name: e.nachname || e.name } : null);
    if (!q) return '';
    try { return I.gesichtSvg(q, weltTeam(e.teamId)) || ''; } catch (x) { return ''; }
  }
  const posVon = e => (window.DFLOberflaeche && DFLOberflaeche.posMarke ? DFLOberflaeche.posMarke(POS[e.pos] || e.pos, { nur1: true }) : `<span class="pos">${esc(POS[e.pos] || e.pos)}</span>`);
  const sortiert = l => l.slice().sort((a, b) => POS_ORDNUNG.indexOf(a.pos) - POS_ORDNUNG.indexOf(b.pos) || b.ovr - a.ovr);
  const minText = s => (s.nach ? `90+${s.nach}'` : `${s.min}'`);
  function ergebnisBlockHtml(pb) {
    const tore = k => pb.schuetzen.filter(s => s.konf === k).map(s => `<li><span class="m">${minText(s)}</span><b>${esc(s.name)}</b>${s.vorlage ? `<small>Vorlage ${esc(s.vorlage)}</small>` : ''}</li>`).join('');
    const mvp = pb.mvp ? `<div class="pb-mvp"><span class="pb-gesicht">${gesichtVon(pb.mvp)}</span><span><small>MVP</small><b>${esc(pb.mvp.name)}</b>
      <small>${esc(teamName(pb.mvp.teamId))}${pb.mvp.tore ? ` · ${pb.mvp.tore} Tor${pb.mvp.tore > 1 ? 'e' : ''}` : ''}${pb.mvp.vorlagen ? ` · ${pb.mvp.vorlagen} Vorlage${pb.mvp.vorlagen > 1 ? 'n' : ''}` : ''}</small></span></div>` : '';
    return `<div class="pb-erg"><div class="pb-erg-t">${konfMarke('SUE_WEST', 'gross')}<span>${KONF.SUE_WEST}</span></div>
        <div class="pb-erg-s"><b>${pb.tore[0]}:${pb.tore[1]}</b>${pb.elfer ? `<small>${pb.elferStand ? `i. E. ${pb.elferStand[0]}:${pb.elferStand[1]}` : 'i. E.'}</small>` : ''}</div>
        <div class="pb-erg-t">${konfMarke('NORD_OST', 'gross')}<span>${KONF.NORD_OST}</span></div></div>
      ${pb.schuetzen.length ? `<div class="pb-tore"><ul>${tore('SUE_WEST')}</ul><ul>${tore('NORD_OST')}</ul></div>` : ''}${mvp}`;
  }
  // Startelf je Conference: gespeichert beim Spiel, vorher wie die Engine sie aufstellen würde (DFLEngine.auswahlTeam)
  const elfMerk = new WeakMap();
  function elfVon(pb, k) {
    let a = pb.aufstellung && pb.aufstellung[k];
    if (!a) {
      const m = elfMerk.get(pb) || {};
      if (!m[k]) { try { m[k] = aufstellungVon(teamFuer(D.liga(), pb, k)); } catch (e) { m[k] = null; } elfMerk.set(pb, m); }
      a = m[k];
    }
    const elf = [], ids = new Set();
    ((a && a.elf) || []).forEach(x => { const e = pb.kader[k].find(y => y.id === x.id); if (e && !ids.has(e.id)) { ids.add(e.id); elf.push({ e, px: x.px, py: x.py }); } });
    return { formation: a && a.formation, elf, bank: sortiert(pb.kader[k].filter(e => !ids.has(e.id))) };
  }
  // Feld quer (Nutzer 17.10. (12): „beide Aufstellungen rechts und links nebeneinander … und nur das Ergebnis“): Süd-West spielt
  // nach rechts, Nord-Ost nach links; Spalten nach Linie (Tor, Abwehr, Mitte, Angriff), in der Spalte gleichmäßig verteilt
  // Wappen am Gesicht (Nutzer 2026-10-22: „Wappen nochmal einarbeiten“ – Vorschlag E)
  const miniWappen = id => { const t = id && weltTeam(id); return t && I && I.wappenSvg ? `<span class="pb-w" aria-hidden="true">${I.wappenSvg(t, { klein: true })}</span>` : ''; };
  function feldHtml(pb) {
    const eigen = eigeneId(), mvp = pb.mvp && pb.mvp.id, tore = {};
    (pb.schuetzen || []).forEach(t => { if (t.id != null) tore[t.id] = (tore[t.id] || 0) + 1; });
    const kurz = e => esc(e.nachname || String(e.name || '').split(' ').slice(-1)[0]);
    const haelfte = k => {
      const { elf } = elfVon(pb, k);
      const linie = x => x.px < 20 ? 0 : x.px < 42 ? 1 : x.px < 62 ? 2 : x.px < 76 ? 3 : 4;
      const spalten = [0, 1, 2, 3, 4].map(n => elf.filter(x => linie(x) === n).sort((a, b) => a.py - b.py)).filter(l => l.length);
      return spalten.map((l, si) => {
        const x = spalten.length > 1 ? 7 + si * (36 / (spalten.length - 1)) : 25;
        return l.map((s, i) => {
          const y = (i + 1) * 100 / (l.length + 1), e = s.e;
          const links = k === 'SUE_WEST' ? x : 100 - x, oben = k === 'SUE_WEST' ? y : 100 - y;
          return `<div class="pb-sp${e.teamId === eigen ? ' eigen' : ''}${e.id === mvp ? ' mvp' : ''}" data-team="${esc(e.teamId)}" style="left:${links.toFixed(1)}%;top:${oben.toFixed(1)}%">
            <span class="pb-gesicht">${gesichtVon(e)}</span>${miniWappen(e.teamId)}${tore[e.id] ? `<i class="pb-tor">${tore[e.id] > 1 ? tore[e.id] : ''}</i>` : ''}<b>${kurz(e)}</b><em>${e.ovr}</em></div>`;
        }).join('');
      }).join('');
    };
    const form = k => { const f = elfVon(pb, k).formation; return f ? `<small>${esc(f)}</small>` : ''; };
    return `<div class="pb-feld-kopf"><span>${konfMarke('SUE_WEST')}${KONF.SUE_WEST}${form('SUE_WEST')}</span><span>${form('NORD_OST')}${KONF.NORD_OST}${konfMarke('NORD_OST')}</span></div>
      <div class="pb-feld" role="img" aria-label="Aufstellungen ${KONF.SUE_WEST} gegen ${KONF.NORD_OST}"><i class="pb-feld-linien" aria-hidden="true"></i>${haelfte('SUE_WEST')}${haelfte('NORD_OST')}</div>`;
  }
  function bankHtml(pb) {
    const eigen = eigeneId();
    const reihe = k => `<div class="pb-bank-r"><h4>${konfMarke(k)}Bank</h4><ul>${elfVon(pb, k).bank.map(e => `<li class="${e.teamId === eigen ? 'eigen' : ''}">${posVon(e)}<span>${esc(e.name)}</span><b>${e.ovr}</b></li>`).join('')}</ul></div>`;
    return `<div class="pb-bank">${reihe('SUE_WEST')}${reihe('NORD_OST')}</div>`;
  }
  function blattHtml(pb) {
    const fertig = gespielt(pb), kann = bereit() === pb;
    const po = poJetzt(), ort = po && po.saison === pb.saison ? po.finalort : null;
    return `<div class="ks-kopf"><b>Pro Bowl ${esc(saisonText(pb.saison))}</b><small>${ort ? 'in ' + esc(ort) : 'neutraler Platz'}</small></div>
      ${fertig ? ergebnisBlockHtml(pb) : `<div class="pb-status"><i class="ti ti-calendar" aria-hidden="true"></i><span>Spiel in der Woche vor dem Finale${pb.woche ? ` · KW ${pb.woche}` : ''}</span></div>`}
      ${feldHtml(pb)}${bankHtml(pb)}
      <div class="app-knoepfe po-knoepfe">${kann ? '<button class="app-knopf haupt" type="button" data-pb="ansehen"><i class="ti ti-player-play" aria-hidden="true"></i>Pro Bowl ansehen</button>' : ''}
        <button class="app-knopf${kann ? '' : ' haupt'}" type="button" data-pb="zu"><i class="ti ti-check" aria-hidden="true"></i>Schließen</button></div>`;
  }
  const shellAktiv = () => hatDom() && document.body.classList.contains('dfl-shell');
  function blattZu() {
    if (!hatDom()) return;
    const ov = document.getElementById('dfl-pb-ov'); if (ov) ov.remove();
    const b = document.getElementById('app-blatt'), box = b && b.querySelector('.app-blatt-box');
    if (box && box.dataset.proBowl) {
      delete box.dataset.proBowl;
      if (b.classList.contains('auf')) { b.classList.remove('auf'); document.body.classList.remove('app-gesperrt'); }
    }
    try { if (window.DFLAppShell) DFLAppShell.cta(); } catch (e) { /* nur am Handy */ }
  }
  function blatt(saison) {
    const pb = pbVon(saison);
    if (!aktiv() || !pb || !hatDom()) return false;
    const html = blattHtml(pb);
    const klick = ev => { const k = ev.target.closest('[data-pb], .app-blatt-zu'); if (!k) return;
      if (k.getAttribute('data-pb') === 'ansehen') ansehen(); else blattZu(); };
    if (shellAktiv()) {
      const box = document.querySelector('#app-blatt .app-blatt-box'); if (!box) return false;
      box.innerHTML = '<div class="app-griff"></div><button class="app-blatt-zu" aria-label="Schließen"><i class="ti ti-x" aria-hidden="true"></i></button>' + `<div class="pb-blatt">${html}</div>`;
      box.dataset.proBowl = '1'; box.onclick = klick; box.scrollTop = 0;
      document.getElementById('app-blatt').classList.add('auf'); document.body.classList.add('app-gesperrt');
      try { DFLAppShell.cta(); } catch (e) { /* Haupt-Button ausblenden */ }
      return true;
    }
    blattZu();
    const ov = document.createElement('div');
    ov.className = 'exp-overlay'; ov.id = 'dfl-pb-ov';
    ov.innerHTML = `<div class="exp-dialog qn-dialog pb-dialog"><button class="app-blatt-zu qn-zu" aria-label="Schließen"><i class="ti ti-x" aria-hidden="true"></i></button><div class="pb-blatt">${html}</div></div>`;
    ov.addEventListener('click', ev => { if (ev.target === ov) blattZu(); else klick(ev); });
    document.body.appendChild(ov);
    return true;
  }
  // Postfach-Karte (dfl_bilder_patch.js, D76): Aufgebot mit eigenen Spielern bzw. Ergebnis; Knopf öffnet das Blatt
  function karte(k) {
    const pb = k && pbVon(k.saison); if (!pb) return null;
    const knopf = text => `<div class="bk-fuss"><button class="pf-btn ok" type="button" onclick="DFLEhrungen.proBowlBlatt(${Number(pb.saison)})"><i class="ti ti-users" aria-hidden="true"></i>${text}</button></div>`;
    if (k.art === 'ergebnis' && gespielt(pb)) {
      return { marke: 'star:gold', titel: `Pro Bowl: ${KONF.SUE_WEST} ${pb.tore[0]}:${pb.tore[1]} ${KONF.NORD_OST}`, html: `<div class="pb-k">${ergebnisBlockHtml(pb)}${knopf('Aufgebot und Tore')}</div>` };
    }
    const eigene = sortiert([...pb.kader.SUE_WEST, ...pb.kader.NORD_OST].filter(e => e.teamId === eigeneId()));
    return { marke: 'star:gold', titel: 'Pro Bowl: das Aufgebot',
      html: `<div class="pb-k"><div class="pb-k-paar">${konfMarke('SUE_WEST')}<b>${KONF.SUE_WEST}</b><small>gegen</small><b>${KONF.NORD_OST}</b>${konfMarke('NORD_OST')}</div>
        <div class="pb-status"><i class="ti ti-calendar" aria-hidden="true"></i><span>${gespielt(pb) ? 'gespielt: ' + ergText(pb) : `Spiel in der Woche vor dem Finale${pb.woche ? ` · KW ${pb.woche}` : ''}`}</span></div>
        ${eigene.length ? `<ul class="pb-k-eigen">${eigene.map(e => `<li><span class="pb-gesicht">${gesichtVon(e)}</span><span class="pb-wer"><b>${esc(e.name)}</b><small>${posVon(e)}${esc(KONF[pb.kader.SUE_WEST.indexOf(e) >= 0 ? 'SUE_WEST' : 'NORD_OST'])}</small></span><b class="pb-st">${e.ovr}</b></li>`).join('')}</ul>`
          : '<p class="pb-k-leer">Kein Spieler von dir nominiert.</p>'}${knopf('Aufgebot ansehen')}</div>` };
  }

  // ── Saisonpreise und Hall of Fame zum Saisonwechsel ────────────────────
  function poFuerHistorie() {
    const P = LEAGUE.dflPlayoffs; if (!P || !P.meister) return null;
    const w = id => id == null ? null : D.dflIdVon(id);
    const aus = {}; Object.keys(P.ausgeschieden || {}).forEach(id => { aus[w(id)] = P.ausgeschieden[id]; });
    return { meister: w(P.meister), finalist: w(P.finalist), ausgeschieden: aus,
      runden: (P.spiele || []).map(s => ({ runde: s.runde, heim: w(s.heim), gast: w(s.gast), gh: s.gh, ga: s.ga, art: s.art, sieger: w(s.sieger) })) };
  }
  function meldePreise(L, e) {
    if (!e || !e.preise) return;
    const p = e.preise, eigen = eigeneId();
    const teil = (titel, x, zusatz) => x ? `${titel}: ${x.name} (${teamName(x.teamId)}${zusatz ? ', ' + zusatz(x) : ''})` : null;
    const zeilen = [teil('Spieler der Saison', p.spieler), teil('Torschützenkönig', p.tore, x => `${x.tore} Tore`), teil('Verteidiger', p.verteidiger),
      teil('Rookie', p.rookie), teil('Spieler der Finals', p.finals),
      p.manager ? `Manager der Saison: ${teamName(p.manager.teamId)} (erwartet Platz ${p.manager.erwartet}, geworden ${p.manager.platz})` : null].filter(Boolean);
    melde(`🏅 Preise der Saison ${e.jahr}`, zeilen.join(' · ') + '.');
    const eigene = ['spieler', 'tore', 'verteidiger', 'rookie', 'finals'].filter(k => p[k] && p[k].teamId === eigen);
    if (eigene.length) melde(`🏅 ${p[eigene[0]].name}: ${H.PREISE[eigene[0]]}!`, `Ein Preis für deinen Verein: ${eigene.map(k => `${H.PREISE[k]} – ${p[k].name}`).join(', ')}.`, 'club');
    if (p.manager && p.manager.teamId === eigen) melde('🏅 Du bist Manager der Saison!', `Erwartet war Platz ${p.manager.erwartet}, geworden ist es Platz ${p.manager.platz}.`, 'club');
    const elf = (p.elf || []).filter(x => x.teamId === eigen);
    if (elf.length) melde('🏅 Elf der Saison', `Von dir in der Elf der Saison: ${elf.map(x => x.name).join(', ')}.`, 'club');
  }
  function meldeHof(neu) {
    if (!neu.length) return;
    neu.forEach(h => { h.neu = true; });
    melde(`🏛️ Hall of Fame: ${neu.length === 1 ? neu[0].name : neu.length + ' Neue'}`, neu.map(h =>
      `${h.name} (${POS[h.pos] || h.pos}, ${h.saisons} Saisons, ${h.tore} Tore, ${h.titel} Titel${h.proBowls ? ', ' + h.proBowls + '× Pro Bowl' : ''})`).join(' · ') +
      ' – aufgenommen nach dem Karriereende.');
  }
  {
    const _orig = S.phaseAbschluss;
    S.phaseAbschluss = function (L, saison, r, W) {
      if (!aktiv()) return _orig.apply(this, arguments);
      // Abschlusstabelle aus dem Spiel kennt nur Tordifferenz und Tore → Gegentore ergänzen
      Object.values(saison.tabelle || {}).forEach(z => { if (z.ga == null) z.ga = (z.gf || 0) - (z.gd || 0); });
      let eintrag = null;
      try { eintrag = H.erfasseSaison(L, saison, poFuerHistorie()); karriereZurueck(L); }
      catch (e) { console.warn('[DFL-Ehrungen] Saisonstatistik', e); }
      const H0 = historie(L).hallOfFame.length;
      const res = _orig.apply(this, arguments);
      try {
        H.nachWechsel(L, W && W.st);
        meldePreise(L, eintrag);
        meldeHof(historie(L).hallOfFame.slice(H0));
      } catch (e) { console.warn('[DFL-Ehrungen] Hall of Fame', e); }
      return res;
    };
  }
  // Vereinslose, die vor dem 1. Spieltag aus dem Markt fallen (ab 30 = Karriereende), auch auf die Hall of Fame prüfen
  {
    const _orig = S.phaseKader;
    S.phaseKader = function (L, r, W) {
      const res = _orig.apply(this, arguments);
      if (aktiv() && W && W.st && W.st.ruhestandListe && W.st.ruhestandListe.length) {
        try {
          const H0 = historie(L).hallOfFame.length;
          H.nachWechsel(L, W.st, { ohneVerwandte: true });
          meldeHof(historie(L).hallOfFame.slice(H0));
        } catch (e) { console.warn('[DFL-Ehrungen] Hall of Fame (Vereinslose)', e); }
      }
      return res;
    };
  }
  // Eigene Spieler: Karriereende passiert im Spiel (bundle_match.js) – danach prüfen
  {
    const _orig = window.startNewSeason;
    if (typeof _orig === 'function') window.startNewSeason = function () {
      const vorher = aktiv() && typeof SQUAD !== 'undefined' ? SQUAD.slice() : null;
      // Höchste Stärke merken (Legende 99 → Hall of Fame, auch wenn er zum Karriereende nachgelassen hat)
      if (vorher) vorher.forEach(q => { q.maxOvr = Math.max(q.maxOvr || 0, q.ovr || 0); });
      const r = _orig.apply(this, arguments);
      if (vorher && aktiv()) {
        try {
          const L = D.liga(), drin = new Set();
          L.teams.forEach(t => t.roster.concat(t.practice_squad || []).forEach(p => { drin.add(p.id); if (p.sq) drin.add(p.sq); }));
          (L.freie || []).forEach(p => { drin.add(p.id); if (p.sq) drin.add(p.sq); });
          const weg = vorher.filter(q => SQUAD.indexOf(q) < 0 && (q.age || 0) >= 32 && !drin.has(q.id) && !drin.has(q.dflId));
          const neu = [];
          const schonDrin = new Set(historie(L).hallOfFame.map(h => h.id));
          weg.forEach(q => {
            if (schonDrin.has(q.dflId || q.id)) return;          // schon über die Welt aufgenommen (Prüfung 2026-10-10: doppelt)
            const k = H.karriere(q), punkte = H.hofPunkte(q), schwelle = H.CFG.hof.schwelle[Gen.grund(Gen.dflPos(q.pos))] || 170;   // D95: Gruppe ohne Seite (ZOM = OM)
            const peak = Math.max(k.peak || 0, q.maxOvr || 0, q.ovr || 0), legende = peak >= (H.CFG.hof.legende || 99);
            if (punkte < schwelle && !legende) return;
            const info = { id: q.dflId || q.id, name: name(q), firstName: q.firstName, nachname: q.name, pos: q.pos, alter: q.age, jahr: L.saisonJahr,
              seed: q.dflSeed != null ? q.dflSeed : q.seed, punkte, schwelle, tore: k.tore, titel: k.titel, proBowls: k.proBowls || 0,
              saisons: k.saisons + k.vorher.length, geschaetzt: k.vorher.length > 0, preise: k.preise.length, vereine: k.vereine.slice(),
              heimat: q.heimat, teamId: eigeneId(), peak, eigen: true, hof: true, legende };
            historie(L).hallOfFame.push(info); neu.push(info);
          });
          meldeHof(neu);
        } catch (e) { console.warn('[DFL-Ehrungen] eigene Hall of Fame', e); }
      }
      return r;
    };
  }

  // Legende in Sicht (Nutzer 2026-10-09: „99 sollte nochmal was Spezielles sein“): einmal melden, wenn ein eigener Spieler 99 erreicht
  function legendenCheck() {
    if (!aktiv() || typeof SQUAD === 'undefined' || !Array.isArray(SQUAD)) return;
    SQUAD.forEach(q => {
      if (!q || (q.ovr || 0) < (H.CFG.hof.legende || 99) || q.legendeGemeldet) return;
      q.legendeGemeldet = true; q.maxOvr = Math.max(q.maxOvr || 0, q.ovr);
      if (typeof addNews === 'function') addNews('club', '👑 Legende', `${name(q)} erreicht 99 – die Hall of Fame ist ihm sicher.`);
    });
  }
  {
    const _orig = window.advanceCalendarWeek;
    if (typeof _orig === 'function') {
      window.advanceCalendarWeek = function () {
        // D158: wer die Woche vor dem Finale ohne „Pro Bowl ansehen“ verlässt (Woche weiter, „Simulieren bis …“), bekommt das Ergebnis ohne Ticker
        try { if (bereit()) spielen(poJetzt(), {}); } catch (e) { console.warn('[DFL-Ehrungen] Pro Bowl', e); }
        const r = _orig.apply(this, arguments); try { legendenCheck(); } catch (e) { console.warn('[DFL-Ehrungen] Legende', e); } return r;
      };
      try { advanceCalendarWeek = window.advanceCalendarWeek; } catch (e) { /* nur im Spiel */ }
    }
  }

  // ── Anzeige: Pro Bowl im Reiter Playoffs (D158: Aufgebot bis zum Spiel, danach Ergebnis) ──────────────────
  function proBowlHtml(pb) {
    if (!pb) return '';
    const eigen = eigeneId(), fertig = gespielt(pb), kann = bereit() === pb;
    const eigene = sortiert([...pb.kader.SUE_WEST, ...pb.kader.NORD_OST].filter(e => e.teamId === eigen));
    const tore = fertig && pb.schuetzen && pb.schuetzen.length ? `<p class="dfl-eh-hinweis">Tore: ${pb.schuetzen.map(s => `${esc(s.name)} ${typeof s.min === 'number' ? minText(s) : ''}`.trim()).join(' · ')}</p>` : '';
    const knopf = kann ? '<button class="app-knopf haupt dfl-eh-pb-knopf" type="button" onclick="DFLEhrungen.proBowlAnsehen()"><i class="ti ti-player-play" aria-hidden="true"></i>Pro Bowl ansehen</button>'
      : `<button class="app-knopf dfl-eh-pb-knopf" type="button" onclick="DFLEhrungen.proBowlBlatt(${Number(pb.saison)})"><i class="ti ti-users" aria-hidden="true"></i>${fertig ? 'Aufstellungen und Tore' : 'Aufgebot ansehen'}</button>`;
    return `<div class="dfl-div-tabelle dfl-eh-probowl"><div class="lg-header"><h3 style="font-size:13px;font-weight:800">${ehrIcon('star-medal', 'star')} Pro Bowl ${saisonText(pb.saison)}</h3>
      <span style="font-size:11px;color:var(--text2)">${fertig ? `MVP: ${esc(pb.mvp.name)} (${esc(teamName(pb.mvp.teamId))})` : pb.woche ? `KW ${pb.woche}` : ''}</span></div>
      ${fertig ? `<div class="dfl-eh-ergebnis"><span>${KONF.SUE_WEST}</span><b>${pb.tore[0]} : ${pb.tore[1]}</b><span>${KONF.NORD_OST}</span>${pb.elfer ? `<small>${pb.elferStand ? `${pb.elferStand[0]}:${pb.elferStand[1]} ` : ''}i. E.</small>` : ''}</div>${tore}`
        : `<div class="dfl-eh-ergebnis angesetzt"><span>${KONF.SUE_WEST}</span><b>– : –</b><span>${KONF.NORD_OST}</span></div><p class="dfl-eh-hinweis dfl-eh-pb-termin">Spiel in der Woche vor dem Finale${pb.woche ? ` · KW ${pb.woche}` : ''}</p>`}
      ${eigene.length ? `<p class="dfl-eh-hinweis dfl-eh-pb-eigen">Von dir dabei: ${eigene.map(e => `<b>${esc(e.name)}</b> (${POS[e.pos] || e.pos})`).join(', ')}</p>` : ''}
      <div class="dfl-eh-pb-fuss">${knopf}</div>
      <p class="dfl-eh-hinweis">Je Conference die 18 Besten ohne Finalisten · zählt für die Hall of Fame</p></div>`;
  }
  {
    const _orig = window.renderLgPokal;
    if (typeof _orig === 'function') window.renderLgPokal = function () {
      const r = _orig.apply(this, arguments);
      if (!aktiv()) return r;
      const el = document.getElementById('lg-sub-pokal'); if (!el) return r;
      const po = (window.DFLPlayoffs && DFLPlayoffs.stand()) || LEAGUE.dflPlayoffs;
      const pb = po && po.proBowl;
      if (pb) { const baum = el.querySelector('.dfl-po-baum'); const ziel = baum ? baum.closest('.dfl-tabellen') : null;
        (ziel || el).insertAdjacentHTML('beforeend', proBowlHtml(pb)); }
      return r;
    };
  }
  // PC: Wochen-Karte (renderCalendarWidget) mit „Pro Bowl ansehen“ neben „Woche weiter“ (Handy: Haupt-Button, dfl_app_shell.js)
  {
    const _orig = window.renderCalendarWidget;
    if (typeof _orig === 'function') window.renderCalendarWidget = function () {
      const r = _orig.apply(this, arguments);
      try {
        const el = aktiv() && hatDom() && bereit() ? document.getElementById('calendar-widget') : null;
        if (el && !el.querySelector('.dfl-eh-pb-cal')) {
          const st = el.querySelector('.cal-status'); if (st) st.innerHTML = '<span class="cal-tag cal-match"><i class="ti ti-star" aria-hidden="true"></i> Pro Bowl</span>';
          const w = el.querySelector('.cal-next');
          if (w) w.insertAdjacentHTML('beforebegin', '<button class="cal-next dfl-eh-pb-cal" type="button" onclick="DFLEhrungen.proBowlAnsehen()">Pro Bowl ansehen</button>');
        }
      } catch (e) { /* nur Anzeige */ }
      return r;
    };
  }

  // ── Anzeige: Reiter „Ehrenhalle“ im Bereich Liga ───────────────────────
  function reiterEinbauen() {
    if (!aktiv() || document.getElementById('lg-sub-ehren')) return;
    const leiste = document.querySelector('#view-liga .subtabs'), letzte = document.getElementById('lg-sub-pyramide');
    if (!leiste || !letzte) return;
    leiste.insertAdjacentHTML('beforeend', '<button class="subtab" onclick="switchLigaSubview(\'ehren\', this)">Ehrenhalle</button>');
    letzte.insertAdjacentHTML('afterend', '<div class="subview" id="lg-sub-ehren" style="padding-top:12px"></div>');
  }
  function ehrenhalleHtml() {
    const L = D.liga(), Hs = historie(L), eigen = eigeneId();
    const hof = Hs.hallOfFame.slice().reverse().slice(0, CFG.hofZeigen);
    const letzte = Hs.saisons[Hs.saisons.length - 1];
    const preis = (k, x, z) => x ? `<li><span>${H.PREISE[k]}</span><b class="${x.teamId === eigen ? 'eigen' : ''}">${wappen(x.teamId)}${esc(x.name)}</b>${z ? `<small>${z}</small>` : ''}</li>` : '';
    const preiseHtml = letzte && letzte.preise ? `<ul class="dfl-eh-preise">${preis('spieler', letzte.preise.spieler)}${preis('tore', letzte.preise.tore, letzte.preise.tore && letzte.preise.tore.tore + ' Tore')}
        ${preis('verteidiger', letzte.preise.verteidiger)}${preis('rookie', letzte.preise.rookie)}${preis('finals', letzte.preise.finals)}
        ${letzte.preise.manager ? `<li><span>${H.PREISE.manager}</span><b class="${letzte.preise.manager.teamId === eigen ? 'eigen' : ''}">${wappen(letzte.preise.manager.teamId)}${esc(teamName(letzte.preise.manager.teamId))}</b><small>erwartet ${letzte.preise.manager.erwartet}., geworden ${letzte.preise.manager.platz}.</small></li>` : ''}</ul>
        <div class="dfl-eh-elf"><b>Elf der Saison:</b> ${(letzte.preise.elf || []).map(x => `<span class="${x.teamId === eigen ? 'eigen' : ''}">${esc(x.name)} (${POS[x.pos] || x.pos})</span>`).join(', ')}</div>`
      : '<p class="dfl-eh-hinweis">Die ersten Preise gibt es zum Ende der ersten Saison.</p>';
    const R = Hs.rekorde || {};
    const rek = [R.punkteSaison && `Punkterekord: ${R.punkteSaison.wert} Punkte (${teamName(R.punkteSaison.teamId)}, ${R.punkteSaison.jahr})`,
      R.toreSaison && `Tore in einer Saison: ${R.toreSaison.wert} – ${esc(R.toreSaison.name)} (${R.toreSaison.jahr})`,
      R.karriereTore && `Ewige Torjägerliste: ${esc(R.karriereTore.name)} mit ${R.karriereTore.wert} Toren`].filter(Boolean);
    const chronik = (LEAGUE.dflChronik || []).slice().reverse().slice(0, 12).map(c => `<li>${saisonText(c.saison)}: <b>${wappen(D.dflIdVon(c.meister))}${esc(teamName(D.dflIdVon(c.meister)))}</b>${c.finalort ? ` <small>Finale in ${esc(c.finalort)}</small>` : ''}</li>`).join('');
    const pb = LEAGUE.dflPlayoffs && LEAGUE.dflPlayoffs.proBowl;
    return `<div class="dfl-tabellen">
      <button type="button" class="hof-eingang" onclick="DFLEhrungen.halle()"><span class="hof-eingang-titel">${ehrIcon('laurels-trophy', 'crown')} Hall of Fame</span>
        <small>${Hs.hallOfFame.length + GRUENDER.length} Mitglieder${hof.length ? ' · zuletzt ' + esc(hof[0].name) : ''}</small><i class="ti ti-chevron-right" aria-hidden="true"></i></button>
      <div class="dfl-div-tabelle"><div class="lg-header"><h3 style="font-size:13px;font-weight:800">${ehrIcon('medal', 'medal')} Preise${letzte ? ' ' + letzte.jahr : ''}</h3></div>${preiseHtml}
        ${rek.length ? `<h4 class="dfl-eh-h4">Rekorde</h4><ul class="dfl-eh-liste">${rek.map(x => `<li>${x}</li>`).join('')}</ul>` : ''}
        ${chronik ? `<h4 class="dfl-eh-h4">Meister</h4><ul class="dfl-eh-liste">${chronik}</ul>` : ''}</div>
      ${bestenlistenHtml(L, Hs)}
      ${pb ? proBowlHtml(pb) : ''}</div>`;
  }
  // D54: Bestenlisten je Position – Tore (Sturm, aktive + ehemalige), Vorlagen (Mittelfeld), Spiele (Abwehr, Tor);
  // D85: Mannschaftsteil als Wort mit Farbpunkt statt „MID“/„DEF“ (css/dfl_oberflaeche.css)
  function bestenlistenHtml(L, Hs) {
    const aktive = [];
    L.teams.forEach(t => t.roster.forEach(p => { if (p.karriere) aktive.push({ p, team: t.id }); }));
    (typeof SQUAD !== 'undefined' ? SQUAD : []).forEach(p => {
      if (p.karriere && !aktive.some(x => x.p.id === p.id || (p.dflId && x.p.id === p.dflId))) aktive.push({ p, team: eigeneId() });
    });
    const k = x => x.p.karriere || {};
    const gruppe = (x, ps) => ps.indexOf(Gen.grund(x.p.pos)) >= 0;           // D95: Gruppe ohne Seite
    const top = (liste, wert, n) => liste.map(x => ({ name: x.name || name(x.p), team: x.team, wert: wert(x) })).filter(x => x.wert > 0)
      .sort((a, b) => b.wert - a.wert).slice(0, n || 3);
    const sturm = aktive.filter(x => gruppe(x, ['ST', 'FL'])).map(x => ({ p: x.p, team: x.team, tore: k(x).tore || 0 }))
      .concat((Hs.ehemalige || []).filter(e => ['ST', 'FL'].indexOf(Gen.grund(e.pos)) >= 0).map(e => ({ p: { pos: e.pos }, name: e.name, team: e.teamId, tore: e.tore || 0 })));
    const listen = [
      { pos: 'ST', titel: 'Tore', sub: 'alle Zeiten', top: top(sturm, x => x.tore) },
      { pos: 'ZM', titel: 'Vorlagen', sub: 'Aktive', top: top(aktive.filter(x => gruppe(x, ['ZDM', 'ZM', 'AM', 'OM'])), x => k(x).vorlagen || 0) },
      { pos: 'IV', titel: 'Spiele', sub: 'Aktive', top: top(aktive.filter(x => gruppe(x, ['IV', 'AV'])), x => k(x).spiele || 0) },
      { pos: 'TW', titel: 'Spiele', sub: 'Aktive', top: top(aktive.filter(x => gruppe(x, ['TW'])), x => k(x).spiele || 0) }
    ].filter(l => l.top.length);
    if (!listen.length) return '';
    return `<div class="dfl-div-tabelle"><div class="lg-header"><h3 style="font-size:13px;font-weight:800">${ehrIcon('podium', 'list-numbers')} Bestenlisten</h3><span style="font-size:11px;color:var(--text2)">je Position</span></div>
      <div class="dfl-eh-bestenlisten">${listen.map(l => `<div class="dfl-eh-bl"><h4><span class="ko-gruppe"><i class="kpm-${{ ST: 'st', ZM: 'mf', IV: 'abw', TW: 'tw' }[l.pos]}"></i>${{ ST: 'Sturm', ZM: 'Mittelfeld', IV: 'Abwehr', TW: 'Tor' }[l.pos]}</span>${l.titel} <small>${l.sub}</small></h4>
        <ol>${l.top.map(x => `<li class="${x.team === eigeneId() ? 'eigen' : ''}"><span>${wappen(x.team)}${esc(x.name)}</span><b>${x.wert}</b></li>`).join('')}</ol></div>`).join('')}</div></div>`;
  }
  function zeigeEhrenhalle() {
    const el = document.getElementById('lg-sub-ehren'); if (!el || !aktiv()) return;
    try { el.innerHTML = ehrenhalleHtml(); } catch (e) { console.warn('[DFL-Ehrungen] Ehrenhalle', e); el.innerHTML = '<p class="dfl-eh-hinweis">Die Ehrenhalle konnte nicht gezeichnet werden.</p>'; }
  }
  {
    const _orig = window.switchLigaSubview;
    if (typeof _orig === 'function') window.switchLigaSubview = function (name, btn) {
      const r = _orig.apply(this, arguments);
      const el = document.getElementById('lg-sub-ehren');
      if (el) el.classList.toggle('active', name === 'ehren');
      if (name === 'ehren') zeigeEhrenhalle();
      return r;
    };
  }
  {
    const _orig = window.renderLeagueTab;
    if (typeof _orig === 'function') window.renderLeagueTab = function () {
      const r = _orig.apply(this, arguments);
      try { reiterEinbauen(); const el = document.getElementById('lg-sub-ehren'); if (el && el.classList.contains('active')) zeigeEhrenhalle(); } catch (e) { /* nur im Spiel */ }
      return r;
    };
  }
  if (aktiv()) { try { reiterEinbauen(); } catch (e) { /* DOM noch nicht da */ } }

  // ── Hall of Fame als eigenes Fenster (D157, Nutzer 2026-10-14: „die hall of fame muss separat designt werden … du kannst
  // gerne spaßnamen dort eintragen in die hall of fame die in anlehnung an echte spieler ist“, Vorschau freigegeben) ──────────
  // Vollbild wie der Ticker: dunkles Holz, Bronze-Plaketten, Gold (in Tag und Nacht gleich, Farben als Variablen am Fenster).
  // Gründungsklasse: Legenden vor der Liga, nur Anzeige – sie spielen nie, zählen nicht für Rekorde, Bestenlisten oder Preise.
  const GRUENDER = [
    { name: 'Franz Kaiserbauer', pos: 'Libero', spitz: 'Der Kaiser' },
    { name: 'Gerd Bomberle', pos: 'ST', spitz: 'Der Bomber' },
    { name: 'Sepp Katzmaier', pos: 'TW', spitz: 'Die Katze' },
    { name: 'Olli Titanski', pos: 'TW', spitz: 'Der Titan' },
    { name: 'Lothar Matthäusen', pos: 'ZM', spitz: 'Der Rekordmann' },
    { name: 'Uwe Seegler', pos: 'ST', spitz: 'Uns Uwe' },
    { name: 'Günter Netzerling', pos: 'ZOM', spitz: 'Der Rebell' },
    { name: 'Paul Breitbart', pos: 'AV', spitz: 'Der Afro' },
    { name: 'Rudi Völlerei', pos: 'ST', spitz: 'Tante Käthe' },
    { name: 'Kalle Rummelsberg', pos: 'FL', spitz: 'Kalle' },
    { name: 'Miro Klosemann', pos: 'ST', spitz: 'Der Salto' },
    { name: 'Basti Schweinsberg', pos: 'ZM', spitz: 'Fußballgott' }
  ];
  const initialen = n => String(n || '').split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  let hofReiter = 'jahrgaenge';
  function plakette(h, eigen) {
    let bild = '';
    if (I && I.gesichtSvg && h.seed != null) {
      const t = h.teamId ? weltTeam(h.teamId) : null;
      try { bild = I.gesichtSvg({ id: h.id, seed: h.seed, firstName: h.firstName, name: h.nachname || h.name }, t); } catch (e) { bild = ''; }
    }
    const zeile = [POS[h.pos] || h.pos, `${h.saisons} Saisons`, h.tore ? `${h.tore} Tore` : '', h.titel ? `${h.titel} Titel` : ''].filter(Boolean).join(' · ');
    const extra = [h.proBowls ? `${h.proBowls}× Pro Bowl` : '', h.preise ? `${h.preise} Preise` : ''].filter(Boolean).join(' · ');
    return `<div class="hof-plakette${eigen ? ' eigen' : ''}${h.legende ? ' legende' : ''}">
      <span class="hof-buste${bild ? ' mit-bild' : ''}" aria-hidden="true">${bild || esc(initialen(h.name))}</span>
      <b>${esc(h.name)}</b><small>${esc(zeile)}</small>${extra ? `<small>${esc(extra)}</small>` : ''}
      <span class="hof-vereine">${(h.vereine || []).slice(-3).map(wappen).join('')}</span>
      ${h.legende ? '<span class="hof-spitz"><i class="ti ti-crown" aria-hidden="true"></i> Legende 99</span>' : eigen ? '<span class="hof-spitz">dein Spieler</span>' : ''}</div>`;
  }
  const gruenderPlakette = g => `<div class="hof-plakette gruender"><span class="hof-buste" aria-hidden="true">${esc(initialen(g.name))}</span>
      <b>${esc(g.name)}</b><small>${esc(g.pos)}</small><span class="hof-spitz">„${esc(g.spitz)}“</span></div>`;
  function hofJahrgaenge(Hs) {
    const eigen = eigeneId(), klassen = [];
    Hs.hallOfFame.slice().reverse().slice(0, CFG.hofZeigen).forEach(h => {
      let k = klassen.find(x => x.jahr === h.jahr); if (!k) klassen.push(k = { jahr: h.jahr, liste: [] }); k.liste.push(h);
    });
    klassen.sort((a, b) => b.jahr - a.jahr);
    const echte = klassen.map(k => `<section class="hof-klasse"><h3>Class of ${k.jahr}</h3>
      <div class="hof-tafeln">${k.liste.map(h => plakette(h, h.teamId === eigen || h.eigen)).join('')}</div></section>`).join('');
    return (echte || '<p class="hof-leer">Noch ist kein Spieler der Liga aufgenommen. Wer eine große Karriere beendet, bekommt hier seine Plakette.</p>') +
      `<section class="hof-klasse"><h3>Gründungsklasse · Legenden vor der Liga</h3><div class="hof-tafeln">${GRUENDER.map(gruenderPlakette).join('')}</div></section>`;
  }
  function hofRekorde(L, Hs) {
    const R = Hs.rekorde || {};
    const rek = [
      R.punkteSaison && ['Punkte in einer Saison', `${R.punkteSaison.wert}`, `${teamName(R.punkteSaison.teamId)} · ${R.punkteSaison.jahr}`],
      R.toreSaison && ['Tore in einer Saison', `${R.toreSaison.wert}`, `${R.toreSaison.name} · ${R.toreSaison.jahr}`],
      R.karriereTore && ['Tore in der Karriere', `${R.karriereTore.wert}`, R.karriereTore.name]
    ].filter(Boolean);
    const karten = rek.map(r => `<div class="hof-rekord"><span>${esc(r[0])}</span><b>${esc(r[1])}</b><small>${esc(r[2])}</small></div>`).join('');
    return (karten ? `<div class="hof-rekorde">${karten}</div>` : '<p class="hof-leer">Rekorde gibt es nach der ersten Saison.</p>') + bestenlistenHtml(L, Hs);
  }
  function hofMeister() {
    const liste = (LEAGUE.dflChronik || []).slice().reverse();
    if (!liste.length) return '<p class="hof-leer">Der erste Meister wird am Ende dieser Saison gekrönt.</p>';
    return `<ol class="hof-meister">${liste.map(c => { const id = D.dflIdVon(c.meister);
      return `<li class="${id === eigeneId() ? 'eigen' : ''}"><span>${saisonText(c.saison)}</span><b>${wappen(id)}${esc(teamName(id))}</b>${c.finalort ? `<small>Finale in ${esc(c.finalort)}</small>` : ''}</li>`; }).join('')}</ol>`;
  }
  const HOF_REITER = [['jahrgaenge', 'Jahrgänge'], ['rekorde', 'Rekorde'], ['meister', 'Meister']];
  function halleMalen(ov) {
    const L = D.liga(), Hs = historie(L);
    const inhalt = hofReiter === 'rekorde' ? hofRekorde(L, Hs) : hofReiter === 'meister' ? hofMeister() : hofJahrgaenge(Hs);
    ov.innerHTML = `<div class="hof-blatt">
      <button class="hof-zu" type="button" aria-label="Schließen"><i class="ti ti-x" aria-hidden="true"></i></button>
      <header class="hof-kopf"><span class="hof-titel">HALL OF FAME</span><small>Deutsche Kickdraft Liga · ${Hs.hallOfFame.length + GRUENDER.length} Mitglieder</small></header>
      <nav class="hof-reiter">${HOF_REITER.map(([k, t]) => `<button type="button" data-hof="${k}" class="${k === hofReiter ? 'an' : ''}">${t}</button>`).join('')}</nav>
      <div class="hof-inhalt">${inhalt}</div></div>`;
  }
  function halle() {
    if (!aktiv() || !hatDom()) return false;
    let ov = document.getElementById('dfl-hof');
    if (!ov) {
      ov = document.createElement('div'); ov.id = 'dfl-hof';
      ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Hall of Fame');
      ov.addEventListener('click', ev => {
        if (ev.target === ov || ev.target.closest('.hof-zu')) { ov.remove(); return; }
        const r = ev.target.closest('[data-hof]'); if (r) { hofReiter = r.dataset.hof; halleMalen(ov); ov.querySelector('.hof-inhalt').scrollTop = 0; }
      });
      document.body.appendChild(ov);
    }
    try { halleMalen(ov); } catch (e) { console.warn('[DFL-Ehrungen] Hall of Fame', e); ov.remove(); return false; }
    return true;
  }
  const hatDom = () => typeof document !== 'undefined' && !!document.body;
  if (typeof document !== 'undefined') document.addEventListener('keydown', ev => { if (ev.key === 'Escape') { const ov = document.getElementById('dfl-hof'); if (ov) ov.remove(); } });

  window.DFLEhrungen = { CFG, proBowl, zeigeEhrenhalle, ehrenhalleHtml, halle, GRUENDER,
    // D158: Pro Bowl mit Aufgebot und Ticker
    proBowlBereit: bereit, proBowlAnsehen: ansehen, proBowlSpielen: spielen, proBowlNachholen: nachholen, proBowlBlatt: blatt, proBowlKarte: karte,
    proBowlRechnen: rechnen, proBowlStand: pbVon };
  console.log('%c[DFL-Ehrungen v1] aktiv', 'color:#3fb950;font-weight:bold',
    '— Saisonpreise, Hall of Fame (KI und eigene Spieler), Pro Bowl vor dem Finale, Reiter Ehrenhalle');
})();
