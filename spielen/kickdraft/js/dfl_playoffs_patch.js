/* ═══════════════════════════════════════════════════════════════════════════
   DFL-PLAYOFFS  ·  v1   (Wunsch 2026-10-08: „danach noch Playoffs spielbar machen“)
   ─────────────────────────────────────────────────────────────────────────
   Nach dem 26. Spieltag spielen 14 Teams um den Titel (Spec: je Conference 4 Division-Sieger und
   3 Wildcards, Seed 1 mit Freilos, Re-Seeding, Finale auf neutralem Platz). Bisher lief alles beim
   Saisonabschluss in einem Rutsch; jetzt Woche für Woche:
     · Kalender: Wildcard-Runde, Divisional-Runde und Conference-Finale in den drei Wochen nach dem
       letzten Spieltag, eine Woche Pause, dann das Finale am Finalort (DFLHistorie.finalort)
     · Eigene Spiele mit der Match-Engine (live oder simuliert) wie ein Ligaspiel; Finale ohne Heimvorteil
     · Unentschieden nach 90 Minuten: Verlängerung (30 Minuten, Torerwartung des Saisonlaufs), danach
       Elfmeterschießen mit den Schützen der eigenen Startelf
     · Die übrigen Spiele einer Runde rechnet die Formel von DFLSaison.playoffs, sobald die Runde fällig ist
     · Ausgeschieden oder nicht qualifiziert: die Playoffs laufen trotzdem Woche für Woche bis zum Finale (Wunsch 2026-10-10:
       „die Playoffs spielen können und sehen, wer am Ende gewonnen hat“) – Ergebnisse im Laufband und im Postfach, danach
       ein Meister-Blatt; erst dann „Saison abschließen“
     · Hin- und Rückspiel (Wunsch 2026-10-17, D166): Wildcard- und Divisional-Runde als englische Woche – Hinspiel unter der
       Woche beim schlechteren Seed, Rückspiel am Wochenende beim besseren; es zählt das Gesamtergebnis (keine Auswärtstorregel),
       Verlängerung und Elfmeterschießen nur im Rückspiel. Zwischen den Spielen erholt sich niemand (Fitness erst beim Wochenwechsel),
       die KI wird nach demselben Modell müde (frische) – Seed 1 ruht in der Wildcard-Woche und geht frisch in die Divisional-Runde
     · Geld: Playoff-Heimspiele buchen wie Ligaspiele nur die Abweichung vom Saisonplan – die Einnahmen
       gehen wie in der NFL an die Liga; Prämien kommen über den Sponsor-Erfolgsbonus und den Eigentümer
   Zustand: LEAGUE.dflPO (laufende Playoffs), am Saisonende wie bisher LEAGUE.dflPlayoffs (+ spiele).
   Hängt sich an fcmSeasonOver, ensureFixtureLoaded, nextWeek, advanceCalendarWeek, processFixtureResult,
   MatchEngineV3/V2.simulateMatch (neutraler Platz), renderHomeTab, renderCalendarWidget, buildScheduleRows,
   renderSeasonBanner und renderLgPokal; dfl_liga_patch.js holt beim Saisonabschluss DFLPlayoffs.abschluss.
   Lädt nach dfl_liga_patch.js und vor dfl_design_patch.js (Wappen auf der Startseite).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  // Achtung: G ist im Spiel der Spielzustand (Tore, Minute) – der Generator heißt hier Gen
  const Gen = window.DFLGenerator, S = window.DFLSaison, D = window.DFLSpiel;
  if (!Gen || !S || !D) { console.warn('[DFL-Playoffs] DFL-Module fehlen – Patch inaktiv'); return; }

  const RUNDE = { 1: 'Wildcard-Runde', 2: 'Divisional-Runde', 3: 'Conference-Finale', 4: 'Finale' };
  const KURZ = { 1: 'Wildcard', 2: 'Divisional', 3: 'Conference-Finale', 4: 'Finale' };
  const IM = { 1: 'in der Wildcard-Runde', 2: 'in der Divisional-Runde', 3: 'im Conference-Finale', 4: 'im Finale' };
  const KONFS = ['SUE_WEST', 'NORD_OST'];
  const CFG = {
    pauseVorFinale: 1,              // spielfreie Woche vor dem Finale (wie in der NFL)
    zweiBeine: [1, 2],              // D166: Runden mit Hin- und Rückspiel in derselben Woche
    // D166: Frische wie fitness_patch.js (−15…22 je Spiel, +12 je Woche, höchstens 100); Abzug auf Abwehr/Mitte/Angriff in Punkten,
    // voll ab Frische 55 (dort greift auch der Stärke-Malus des eigenen Vereins), nichts ab 90
    frische: { start: 95, spiel: 18, woche: 12, ab: 90, boden: 55, abzug: 4 },
    verlaengerung: 1 / 3,           // 30 Minuten = ein Drittel der Torerwartung
    elfer: { basis: 0.62, att: 0.004, mental: 0.003, torwart: 0.002, min: 0.6, max: 0.9 }
  };

  const aktiv = () => typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.dfl && typeof CLUB !== 'undefined' && CLUB && CLUB.dfl && CLUB.dfl.aktiv;
  const teams = () => LEAGUE.tiers.bundesliga.groups[0].teams;
  const team = id => teams().find(t => t.id === id);
  const name = id => (team(id) || {}).name || id;
  const klemme = (x, a, b) => Math.max(a, Math.min(b, x));
  const pname = p => (typeof displayName === 'function' ? displayName(p) : p.name);
  const melde = (titel, text) => { try { addNews('season', titel, text); } catch (e) { /* Meldungen sind optional */ } };

  // ── Kalender: drei Wochen nach dem letzten Spieltag, Pause, Finale ───────
  function wochen() {
    const mw = (LEAGUE && LEAGUE.matchWeeks) || [];
    const ende = typeof SEASON_WEEKS !== 'undefined' ? SEASON_WEEKS : 52;
    let x = mw.length ? mw[mw.length - 1] : 36;
    const naechste = () => { do { x++; } while (typeof isBreakWeek === 'function' && isBreakWeek(x) && x < ende); return x; };
    const w = [naechste(), naechste(), naechste()];
    x += CFG.pauseVorFinale;
    w.push(naechste());
    return w;
  }
  function finalort() {
    try {
      if (!window.DFLHistorie) return null;
      const f = DFLHistorie.finalort({ teams: window.DFL_LIGA.franchises.map(t => ({ id: t.id, city: t.city, anlagen: t.anlagen })) }, (CLUB.dfl.saisonIndex || 0));
      return f && f.stadt;
    } catch (e) { return null; }
  }

  // ── Turnierbaum ──────────────────────────────────────────────────────────
  // heim = besserer Seed (Rückspiel bei ihm); zwei: Hin- und Rückspiel (D166), hin = { gh, ga } aus Sicht von heim (Hinspiel beim Gast)
  const neuesSpiel = (runde, konf, heim, gast, neutral) => ({ runde, konf, heim, gast, neutral: !!neutral, gh: null, ga: null, art: null, elfer: null, sieger: null,
    zwei: !neutral && CFG.zweiBeine.indexOf(runde) >= 0, hin: null });
  // Welches Spiel steht an: 0 = nur eines, 1 = Hinspiel, 2 = Rückspiel
  const bein = s => (s && s.zwei ? (s.hin ? 2 : 1) : 0);
  const gastgeber = s => (bein(s) === 1 ? s.gast : s.heim);
  // Gesamtergebnis [heim, gast] (mit dem Rückspiel, sobald es gebucht ist)
  const gesamt = s => [(s.gh || 0) + (s.hin ? s.hin.gh : 0), (s.ga || 0) + (s.hin ? s.hin.ga : 0)];
  // Paarungen der aktuellen Runde (Regeln wie DFLSaison.playoffs: 2–7, 3–6, 4–5; danach Re-Seeding)
  function paarungen(po) {
    const r = po.runde;
    if (r === 4) {
      const m = KONFS.map(k => po.spiele.find(s => s.runde === 3 && s.konf === k).sieger);
      po.spiele.push(neuesSpiel(4, null, m[0], m[1], true));
      return;
    }
    KONFS.forEach(k => {
      const s = po.setzliste[k], seed = id => s.indexOf(id);
      const drin = s.filter(id => !(id in po.ausgeschieden)).sort((a, b) => seed(a) - seed(b));
      const paare = r === 1 ? [[s[1], s[6]], [s[2], s[5]], [s[3], s[4]]]
        : r === 2 ? [[drin[0], drin[3]], [drin[1], drin[2]]] : [[drin[0], drin[1]]];
      paare.forEach(([h, g]) => po.spiele.push(neuesSpiel(r, k, h, g, false)));
    });
  }
  function neu() {
    const setzliste = {};
    KONFS.forEach(k => { const s = D.setzliste(k); setzliste[k] = [...s.sieger, ...s.wild].map(t => t.id); });
    // Abschlusstabelle für die Draft-Reihenfolge (wie bisher in dfl_liga_patch.js)
    const tabelle = {}, los = {};
    teams().forEach(t => { tabelle[t.id] = { id: t.id, pts: t.pts, gd: t.gf - t.ga, gf: t.gf }; los[t.id] = Math.random(); });
    const po = { saison: LEAGUE.season, setzliste, wochen: wochen(), runde: 1, spiele: [], ausgeschieden: {},
      meister: null, finalist: null, finalort: finalort(), tabelle, los };
    paarungen(po);
    return po;
  }
  // Laufende Playoffs dieser Saison; entstehen, sobald der 26. Spieltag gespielt ist
  function stand() {
    if (!aktiv()) return null;
    const po = LEAGUE.dflPO;
    if (po && po.saison === LEAGUE.season) return po;
    if (!Array.isArray(LEAGUE.matchWeeks) || !LEAGUE.matchWeeks.length) return null;
    if (!(typeof seasonFullyComplete === 'function' && seasonFullyComplete(LEAGUE))) return null;
    LEAGUE.dflPO = neu();
    startMeldung(LEAGUE.dflPO);
    return LEAGUE.dflPO;
  }
  const seedVon = (po, id) => { for (const k of KONFS) { const i = po.setzliste[k].indexOf(id); if (i >= 0) return { konf: k, seed: i + 1 }; } return null; };
  const dabei = po => !!seedVon(po, 'fcm');
  const imRennen = po => !po.meister && dabei(po) && !('fcm' in po.ausgeschieden);
  const eigenesSpiel = po => po.spiele.find(s => s.runde === po.runde && !s.sieger && (s.heim === 'fcm' || s.gast === 'fcm')) || null;
  // Eigenes Spiel, das JETZT dran ist (Woche erreicht)
  function faellig() {
    const po = stand();
    if (!po || po.runde > 4) return null;
    const sp = eigenesSpiel(po);
    return sp && LEAGUE.week >= po.wochen[po.runde - 1] ? sp : null;
  }

  // ── Formel-Spiele (wie DFLSaison.playoffs/koSpiel) ───────────────────────
  function poisson(l) { const g = Math.exp(-l); let k = 0, p = 1; do { k++; p *= Math.random(); } while (p > g); return k - 1; }
  function werte(id) {
    const tr = D.trainerWerte ? D.trainerWerte(id) : {};            // D118: Standardtrainer, Psychologe
    let w;
    if (id === 'fcm' && D.eigeneStaerke) w = Object.assign(D.eigeneStaerke(), tr);
    else { const t = team(id) || { def: 70, mid: 70, att: 70 }; w = Object.assign({ def: t.def, mid: t.mid, att: t.att, ovr: (t.def + t.mid + t.att) / 3 }, tr); }
    // D166: müde aus der englischen Woche (eigener Verein: echte Fitness der Elf)
    const po = LEAGUE.dflPO, f = id === 'fcm' && typeof teamFitness === 'function' ? teamFitness() : po ? frische(po, id) : 100, m = abzug(f);
    if (m) ['def', 'mid', 'att', 'ovr'].forEach(k => { if (typeof w[k] === 'number') w[k] -= m; });
    return w;
  }
  // D166: Frische eines Vereins vor seinem nächsten Playoff-Spiel – Spiele der bisherigen Runden und Hinspiel der laufenden
  function frische(po, id) {
    const F = CFG.frische;
    let f = F.start, w0 = null;
    for (let r = 1; r <= Math.min(po.runde, 4); r++) {
      const w = po.wochen[r - 1];
      if (w0 != null) f = Math.min(100, f + F.woche * Math.max(0, w - w0));
      w0 = w;
      const sp = po.spiele.find(s => s.runde === r && (s.heim === id || s.gast === id));
      if (sp) f -= F.spiel * (sp.sieger ? (sp.zwei ? 2 : 1) : sp.hin ? 1 : 0);
    }
    return klemme(Math.round(f), 0, 100);
  }
  const abzug = f => { const F = CFG.frische; return f >= F.ab ? 0 : F.abzug * Math.min(1, (F.ab - f) / (F.ab - F.boden)); };
  // Torerwartung [heim, gast]; auf neutralem Platz ohne Heimbonus und ohne Heim-Grundwert
  function erwartung(H, A, neutral) {
    if (!neutral) return S.toreErwartet(H, A, S.CFG.heimvorteil);
    const x = S.toreErwartet(H, A, 0), y = S.toreErwartet(A, H, 0);
    return [(x[0] + y[1]) / 2, (x[1] + y[0]) / 2];
  }
  // Elfmeterschießen: 5 Schützen je Team, dann K.-o.; q(i) = Trefferquote des i-ten Schützen
  function schiessen(qH, qA) {
    const kicks = []; let h = 0, a = 0;
    for (let i = 0; i < 40; i++) {
      const th = Math.random() < qH(i); if (th) h++; kicks.push({ seite: 0, nr: i, tor: th });
      if (i < 5 && (h > a + 5 - i || a > h + 4 - i)) break;
      const ta = Math.random() < qA(i); if (ta) a++; kicks.push({ seite: 1, nr: i, tor: ta });
      if (i < 5 ? (h > a + 4 - i || a > h + 4 - i) : h !== a) break;
    }
    if (h === a) h++;                    // nur als Sicherung, praktisch nie erreicht
    return { h, a, kicks };
  }
  // Ergebnis buchen (beim Rückspiel entscheidet das Gesamtergebnis)
  function eintragen(po, sp, gh, ga, art, elfer) {
    Object.assign(sp, { gh, ga, art, elfer });
    const [th, ta] = gesamt(sp);
    sp.sieger = th > ta ? sp.heim : th < ta ? sp.gast : (elfer[0] > elfer[1] ? sp.heim : sp.gast);
    po.ausgeschieden[sp.sieger === sp.heim ? sp.gast : sp.heim] = sp.runde;
  }
  function formelSpiel(po, sp) {
    if (bein(sp) === 1) {                 // Hinspiel beim Gast der Paarung
      const H1 = werte(sp.heim), A1 = werte(sp.gast), [lg, lhw] = erwartung(A1, H1, false);
      sp.hin = { gh: poisson(lhw), ga: poisson(lg) };
    }
    const H = werte(sp.heim), A = werte(sp.gast);
    const [lh, la] = erwartung(H, A, sp.neutral);
    let gh = poisson(lh), ga = poisson(la), art = 'regulär', elfer = null;
    const v = sp.hin || { gh: 0, ga: 0 };
    if (gh + v.gh === ga + v.ga) {
      gh += poisson(lh * CFG.verlaengerung); ga += poisson(la * CFG.verlaengerung); art = 'Verlängerung';
      if (gh + v.gh === ga + v.ga) {
        art = 'Elfmeterschießen';
        const qh = klemme(0.75 + (H.ovr - A.ovr) * 0.004 + (H.elfer || 0), 0.6, 0.95), qa = klemme(0.75 + (A.ovr - H.ovr) * 0.004 + (A.elfer || 0), 0.6, 0.95);
        const e = schiessen(() => qh, () => qa); elfer = [e.h, e.a];
      }
    }
    eintragen(po, sp, gh, ga, art, elfer);
  }
  const ergebnisText = s => `${s.gh}:${s.ga}${s.art === 'Verlängerung' ? ' n. V.' : s.art === 'Elfmeterschießen' ? ` n. V., ${s.elfer[0]}:${s.elfer[1]} i. E.` : ''}` +
    (s.hin ? ` (Hinspiel ${s.hin.gh}:${s.hin.ga}, gesamt ${gesamt(s).join(':')})` : '');
  // Runde abschließen: offene Spiele per Formel, dann nächste Paarungen bzw. Meister
  function rundeAbschliessen(po, still) {
    const r = po.runde;
    // D158: der Pro Bowl ist spätestens vor dem Finale gespielt (sonst beim Verlassen der Woche davor, dfl_ehrungen_patch.js)
    if (r === 4 && window.DFLEhrungen && DFLEhrungen.proBowlNachholen) { try { DFLEhrungen.proBowlNachholen(po, still); } catch (e) { console.warn('[DFL-Playoffs] Pro Bowl', e); } }
    po.spiele.filter(s => s.runde === r && !s.sieger).forEach(s => formelSpiel(po, s));
    if (r === 4) {
      const f = po.spiele.find(s => s.runde === 4);
      po.meister = f.sieger; po.finalist = f.sieger === f.heim ? f.gast : f.heim;
      po.ausgeschieden[po.meister] = 5; po.runde = 5;
    } else { po.runde = r + 1; paarungen(po); }
    if (!still) rundenMeldung(po, r);
    // Pro Bowl: Aufgebot, sobald die Finalisten feststehen; gespielt wird in der Woche vor dem Finale (dfl_ehrungen_patch.js, D158)
    if (r === 3 && window.DFLEhrungen) { try { DFLEhrungen.proBowl(po, still); } catch (e) { console.warn('[DFL-Playoffs] Pro Bowl', e); } }
  }

  // ── Meldungen ────────────────────────────────────────────────────────────
  function gegnerText(po, sp) {
    const heim = sp.heim === 'fcm', opp = heim ? sp.gast : sp.heim, s = seedVon(po, opp), seed = s ? ` (Seed ${s.seed})` : '';
    if (sp.zwei) return `gegen ${name(opp)}${seed}, ${heim ? 'erst auswärts, das Rückspiel zu Hause' : 'erst zu Hause, das Rückspiel auswärts'}`;
    return `${sp.neutral ? 'gegen' : heim ? 'zu Hause gegen' : 'bei'} ${name(opp)}${seed}`;
  }
  function startMeldung(po) {
    const s = seedVon(po, 'fcm');
    if (!s) {
      melde(`Playoffs ohne ${clubShort()}`, `Die 26 Spieltage sind vorbei – ${CLUB.name} hat die Playoffs verpasst. ` +
        'Die Playoffs laufen Woche für Woche bis zum Finale, danach geht es in die Offseason.');
      return;
    }
    const konf = D.KONF[s.konf], sp = eigenesSpiel(po);
    melde(`🏆 Playoffs! ${CLUB.name} ist dabei`, `Seed ${s.seed} in der Conference ${konf}. ` + (sp
      ? `${RUNDE[1]} in KW ${po.wochen[0]} ${gegnerText(po, sp)}.` + (sp.zwei
        ? ' Englische Woche: Hinspiel unter der Woche, Rückspiel am Wochenende – es zählt das Gesamtergebnis, Verlängerung und Elfmeterschießen gibt es nur im Rückspiel. Dazwischen erholt sich keiner, also rotieren.'
        : ' Ab jetzt zählt jedes Spiel: Bei Gleichstand gibt es Verlängerung und Elfmeterschießen.')
      : `Als bester Verein der Conference hast du ein Freilos und eine Woche Ruhe – deine ${RUNDE[2]} ist in KW ${po.wochen[1]} gegen das schwächste verbliebene Team, das Rückspiel zu Hause. Die Gegner kommen aus einer englischen Woche.`));
  }
  function rundenMeldung(po, r) {
    const fremd = po.spiele.filter(s => s.runde === r && s.heim !== 'fcm' && s.gast !== 'fcm');
    if (!fremd.length) return;
    melde(`🏆 ${RUNDE[r]}: die Ergebnisse`, fremd.map(s => `${name(s.heim)} – ${name(s.gast)} ${ergebnisText(s)}`).join(' · ') +
      (po.meister ? ` – ${name(po.meister)} ist DKL-Meister.` : ''));
  }

  // ── Eigenes Spiel laden (wie goToFixture) ────────────────────────────────
  function ladeSpiel(sp) {
    const po = stand(), opp = sp.heim === 'fcm' ? sp.gast : sp.heim, t = team(opp), b = bein(sp), heim = gastgeber(sp) === 'fcm';
    if (!t) { if (typeof showNoMatchThisWeek === 'function') showNoMatchThisWeek(); return; }
    // D166: bein 1 = Hinspiel (beim schlechteren Seed), 2 = Rückspiel; hin = Hinspiel aus eigener Sicht [eigen, Gegner]
    const hin = sp.hin ? (sp.heim === 'fcm' ? [sp.hin.gh, sp.hin.ga] : [sp.hin.ga, sp.hin.gh]) : null;
    CURRENT_FIXTURE = { type: 'playoff', runde: sp.runde, opponentId: opp, isHome: sp.neutral ? false : heim, neutral: sp.neutral,
      roundName: RUNDE[sp.runde], week: LEAGUE.week, bein: b, hin, frische: frische(po, opp) };
    FCM_IS_HOME = sp.neutral ? false : heim;       // Finale: keine Heimeinnahmen, Engine ohne Heimvorteil
    dekor = null;
    resetMatchState(); setOpponent(t); syncClubToTeams();
    // „Spiel simulieren“ wieder zeigen: nach dem letzten Ligaspiel blieb der Knopf versteckt (er kommt sonst nur über goToFixture zurück)
    const sb = document.getElementById('sim-btn');
    if (sb) { sb.style.display = ''; sb.disabled = false; sb.innerHTML = '<i class="ti ti-player-track-next" aria-hidden="true"></i> Spiel simulieren'; }
    if (sp.neutral) {
      G.momentum = 51;
      const l = document.getElementById('away-str-label'); if (l) l.textContent = `Stärke: ${t.ovr} · neutraler Platz`;
    }
    document.querySelectorAll('.appnav-btn').forEach(b => b.classList.remove('active'));
    const nav = document.getElementById('nav-match'); if (nav) nav.classList.add('active');
    ['view-squad', 'view-liga'].forEach(id => { const v = document.getElementById(id); if (v) v.classList.remove('active'); });
    const vm = document.getElementById('view-match'); if (vm) vm.classList.add('active');
    const paar = heim ? `${clubShort()} vs ${t.name}` : `${t.name} vs ${clubShort()}`;
    addEv('info', -1, `🏆 Playoffs, ${RUNDE[sp.runde]}${b === 1 ? ', Hinspiel' : b === 2 ? ', Rückspiel' : ''}: ${paar}${sp.neutral && po.finalort ? ` – Finale in ${po.finalort}` : ''}. ` +
      (b === 1 ? 'Das Rückspiel folgt am Wochenende, es zählt das Gesamtergebnis.'
        : b === 2 ? `Hinspiel ${hin[0]}:${hin[1]} – bei Gleichstand im Gesamtergebnis: Verlängerung, dann Elfmeterschießen.`
        : 'Bei Gleichstand nach 90 Minuten: Verlängerung, dann Elfmeterschießen.'));
  }

  // ── Verlängerung + Elfmeterschießen für das eigene Spiel ─────────────────
  // Elf nach 90 Minuten aus der Aufzeichnung: Startelf, Wechsel (refAus raus, Eingewechselter rein), Platzverweise raus
  // (Prüfung Spielbericht 2026-10-10: in der Verlängerung trafen Ausgewechselte, im Elfmeterschießen schossen sie, Eingewechselte nie)
  const tief = x => { let r = x && x._ref; while (r && r._ref) r = r._ref; return r || null; };
  function elfNach90(side, start) {
    const drin = new Map(start.filter(Boolean).map(p => [p.id, p]));
    ((window.LAST_MATCH_2D && LAST_MATCH_2D.events) || []).slice().sort((a, b) => a.t - b.t).forEach(e => {
      if (e.side !== side) return;
      if (e.type === 'wechsel') { const a = tief({ _ref: e.refAus }), b = tief(e.player); if (a) drin.delete(a.id); if (b) drin.set(b.id, b); }
      else if (e.type === 'red' || e.type === 'gelbrot') { const q = tief(e.player); if (q) drin.delete(q.id); }
    });
    return [...drin.values()];
  }
  function eigeneElf() {
    let start = [];
    try { start = getLineupIds().map(getPlayer).filter(Boolean); } catch (e) { return []; }
    try { return elfNach90('home', start).map(p => getPlayer(p.id) || p); } catch (e) { return start; }
  }
  function torschuetze(elf) {
    const feld = elf.filter(p => p.pos !== 'TW');
    if (!feld.length) return null;
    const gew = feld.map(p => Math.pow(Math.max(30, p.att || 50), 3)), summe = gew.reduce((a, b) => a + b, 0);
    let x = Math.random() * summe;
    for (let i = 0; i < feld.length; i++) { x -= gew[i]; if (x <= 0) return feld[i]; }
    return feld[feld.length - 1];
  }
  function schuetzenReihe(spieler) {
    return spieler.filter(p => p.pos !== 'TW').sort((a, b) => ((b.att || 50) * 0.6 + (b.mental || 50) * 0.4) - ((a.att || 50) * 0.6 + (a.mental || 50) * 0.4));
  }
  function quote(p, torwart) {
    const E = CFG.elfer;
    return klemme(E.basis + ((p.att || 60) - 60) * E.att + ((p.mental || 60) - 60) * E.mental - ((torwart || 75) - 75) * E.torwart, E.min, E.max);
  }
  // Gegner: dieselbe Elf wie in der Engine nach 90 Minuten; sonst Startelf aus der Welt (echte, generierte Namen)
  function gegnerElf(opp) {
    try {
      const T = window.LAST_MATCH_2D && LAST_MATCH_2D.teams && LAST_MATCH_2D.teams[1];
      if (T && Array.isArray(T.players) && T.players.length >= 11) {
        const elf = elfNach90('away', T.players.slice(0, 11).map(x => tief(x) || x));
        if (elf.length) return elf;
      }
    } catch (e) { /* Weltkader als Ersatz */ }
    try {
      const L = D.liga(), t = L.teams.find(x => x.id === D.dflIdVon(opp));
      if (t) return Gen.startelfVon(t.roster);
    } catch (e) { /* Welt nicht greifbar */ }
    return [];
  }
  // vor = Hinspiel aus eigener Sicht [eigen, Gegner] (D166, Rückspiel) – entscheidend ist das Gesamtergebnis
  function nachspielen(po, sp, fx, vor) {
    vor = vor || [0, 0];
    const gleich = () => G.homeGoals + vor[0] === G.awayGoals + vor[1];
    const ges = () => (vor[0] || vor[1] ? ` (gesamt ${G.homeGoals + vor[0]}:${G.awayGoals + vor[1]})` : '');
    const season = LEAGUE.season, opp = fx.opponentId, elf = eigeneElf();
    const E = werte('fcm'), A = werte(opp);
    const heim = gastgeber(sp) === 'fcm';
    const lam = sp.neutral ? erwartung(E, A, true) : heim ? erwartung(E, A, false) : erwartung(A, E, false).reverse();
    const tE = poisson(lam[0] * CFG.verlaengerung), tA = poisson(lam[1] * CFG.verlaengerung);
    addEv('info', -1, `⏱ Abpfiff nach 90 Minuten ${G.homeGoals}:${G.awayGoals}${ges()} – es geht in die Verlängerung!`, null, '90');
    const verl = [];                       // für den Ticker (D77): { m, eigen, name }
    const minuten = n => Array.from({ length: n }, () => 91 + Math.floor(Math.random() * 30)).sort((a, b) => a - b);
    const tore = [...minuten(tE).map(m => ({ m, eigen: true })), ...minuten(tA).map(m => ({ m, eigen: false }))].sort((a, b) => a.m - b.m);
    // Namen wie im übrigen Bericht (Vorname Name); Gegentore mit Schütze aus der Elf des Gegners nach 90 Minuten
    const voll = p => (p.firstName ? p.firstName + ' ' : '') + p.name;
    const gElf90 = tore.some(t => !t.eigen) ? gegnerElf(opp) : [];
    tore.forEach(t => {
      if (t.eigen) {
        G.homeGoals++;
        const p = torschuetze(elf);
        G.scorers = G.scorers || []; G.goalLog = G.goalLog || [];
        G.scorers.push({ min: t.m, name: p ? voll(p) : clubShort(), id: p ? p.id : null });
        G.goalLog.push({ min: t.m, team: 'home', momentumAtTime: G.momentum });
        if (p && typeof addPlayerGoal === 'function') addPlayerGoal(p, season);
        addEv('goal', 0, `⚽ TOR in der Verlängerung! ${p ? voll(p) : clubShort()} trifft.`, null, t.m);
        verl.push({ m: t.m, eigen: true, name: p ? pname(p) : '' });
      } else {
        G.awayGoals++;
        const q = torschuetze(gElf90);
        (G.goalLog = G.goalLog || []).push({ min: t.m, team: 'away', momentumAtTime: G.momentum });
        (G.gegnerTore = G.gegnerTore || []).push({ min: t.m, name: q ? voll(q) : (TEAMS.away.shortTag || TEAMS.away.name), art: null });
        addEv('goal', 1, `⚽ Tor für ${TEAMS.away.name} in der Verlängerung${q ? ': ' + voll(q) : ''}.`, null, t.m);
        verl.push({ m: t.m, eigen: false, name: q ? (q.name || '') : '' });
      }
    });
    const z = { art: 'Verlängerung', kicks: null, tore: verl };
    if (!gleich()) {
      addEv('info', -1, `Ende der Verlängerung: ${G.homeGoals}:${G.awayGoals}${ges()}.`, null, '120');
      return z;
    }
    // Elfmeterschießen
    z.art = 'Elfmeterschießen';
    addEv('info', -1, `Nach 120 Minuten steht es ${G.homeGoals}:${G.awayGoals}${ges()} – Elfmeterschießen!`, null, '120');
    const gElf = gegnerElf(opp), unsere = schuetzenReihe(elf), deren = schuetzenReihe(gElf);
    const unserTW = (elf.find(p => p.pos === 'TW') || {}).ovr || 75;
    const derenTW = (gElf.find(p => p.pos === 'TW') || {}).ovr || A.ovr;
    // D118: Sportpsychologe +1 Punkt je Stern und Schütze
    const psyE = (D.trainerWerte ? D.trainerWerte('fcm').elfer : 0) || 0, gegId = typeof CURRENT_FIXTURE !== 'undefined' && CURRENT_FIXTURE ? CURRENT_FIXTURE.opponentId : null,
      psyG = (D.trainerWerte && gegId ? D.trainerWerte(gegId).elfer : 0) || 0;
    const qE = i => Math.min(0.95, (unsere.length ? quote(unsere[i % unsere.length], derenTW) : 0.75) + psyE);
    const qG = i => Math.min(0.95, (deren.length ? quote(deren[i % deren.length], unserTW) : klemme(0.75 + (A.ovr - 75) * 0.004, 0.6, 0.9)) + psyG);
    const e = schiessen(qE, qG);
    let h = 0, a = 0;
    z.kicks = e.kicks.map(k => {
      const p = k.seite === 0 ? unsere[k.nr % Math.max(1, unsere.length)] : deren[k.nr % Math.max(1, deren.length)];
      const wer = p ? (k.seite === 0 ? pname(p) : p.name) : (k.seite === 0 ? clubShort() : TEAMS.away.shortTag || TEAMS.away.name);
      if (k.tor) { if (k.seite === 0) h++; else a++; }
      addEv(k.tor ? 'goal' : 'save', k.seite, `Elfmeter ${k.nr + 1}: ${wer} ${k.tor ? 'trifft' : 'scheitert'} – ${h}:${a}`, null, 'i. E.');
      return { seite: k.seite, wer, tor: k.tor, stand: `${h}:${a}` };
    });
    z.elfer = [e.h, e.a];
    addEv('info', -1, e.h > e.a ? `🏆 ${clubShort()} gewinnt das Elfmeterschießen ${e.h}:${e.a}!` : `${TEAMS.away.name} gewinnt das Elfmeterschießen ${e.a}:${e.h}.`, null, 'i. E.');
    return z;
  }

  // ── Abpfiff-Fenster: Runde, Verlängerung und Elfmeter anzeigen ───────────
  let dekor = null;
  // Verlängerung/Elfmeterschießen des zuletzt gebuchten eigenen Playoff-Spiels (Spiel als Text, D77): art, tore
  // [{ m, eigen, name }], kicks [{ seite (0 = eigener Verein), wer, tor, stand }], elfer [eigen, Gegner]
  let letztesNachspiel = null;
  function schmuecke(ov, d) {
    const q = sel => ov.querySelector(sel);
    const kopf = q('#pm-header'); if (kopf) kopf.className = d.kopf || (d.sieg ? 'win' : 'loss');
    const emo = q('#pm-result-emoji');
    if (emo) emo.innerHTML = d.hin ? '<i class="ti ti-arrows-exchange" style="color:#f2c14e"></i>'
      : d.sieg ? '<i class="ti ti-trophy" style="color:#f2c14e"></i>' : '<i class="ti ti-mood-sad" style="color:#e24b4a"></i>';
    const lab = q('#pm-result-label'); if (lab) lab.textContent = d.label;
    const sc = q('#pm-score'); if (sc && d.zusatz) sc.textContent = `${sc.textContent} ${d.zusatz}`;
    const typ = q('#pm-match-type'), html = `<i class="ti ti-trophy"></i> Playoffs · ${d.runde}`;
    if (typ) typ.innerHTML = html; else { const t = q('#pm-teams'); if (t) t.insertAdjacentHTML('afterend', `<div id="pm-match-type">${html}</div>`); }
    const body = q('#pm-body');
    if (body && d.kicks) {
      const zeilen = d.kicks.map(k => `<div class="dfl-po-elfer ${k.seite ? 'gast' : 'eigen'}"><span>${k.seite ? d.gegner : clubShort()}</span>` +
        `<span>${k.wer}</span><b>${k.tor ? '✔' : '✘'}</b><span>${k.stand}</span></div>`).join('');
      body.insertAdjacentHTML('afterbegin', `<div class="pm-section"><div class="pm-section-title">Elfmeterschießen ${d.elfer.join(':')}</div>${zeilen}</div>`);
    }
    if (body && d.weiter) body.insertAdjacentHTML('afterbegin', `<div class="pm-section dfl-po-weiter">${d.weiter}</div>`);
    const kn = q('#pm-continue-btn');
    if (kn && d.hin) kn.innerHTML = '<i class="ti ti-arrow-right" aria-hidden="true"></i> Weiter → Rückspiel vorbereiten';
  }
  function beobachte() {
    new MutationObserver(() => {
      if (!dekor) return;
      const ov = document.getElementById('pm-overlay');
      if (ov && !ov.dataset.dflPo) { ov.dataset.dflPo = '1'; const d = dekor; dekor = null; try { schmuecke(ov, d); } catch (e) { console.warn('[DFL-Playoffs] Abpfiff-Fenster', e); } }
    }).observe(document.body, { childList: true });
  }
  if (document.body) beobachte(); else document.addEventListener('DOMContentLoaded', beobachte);

  // ── Haken ins Spiel ──────────────────────────────────────────────────────
  // Saison erst vorbei, wenn das Finale gespielt ist – auch ohne eigenen Verein (bis 2026-10-10: sobald der eigene Verein
  // raus war, rechnete „Saison abschließen“ den Rest still durch und der Meister stand nur im Postfach)
  {
    const _orig = window.fcmSeasonOver;
    if (typeof _orig === 'function') window.fcmSeasonOver = function () {
      const po = stand();
      if (po) return !!po.meister;
      return _orig.apply(this, arguments);
    };
  }
  {
    const _orig = window.ensureFixtureLoaded;
    if (typeof _orig === 'function') window.ensureFixtureLoaded = function () {
      const sp = aktiv() && faellig();
      if (sp) { ladeSpiel(sp); return; }
      return _orig.apply(this, arguments);
    };
  }
  {
    const _orig = window.nextWeek;
    if (typeof _orig === 'function') window.nextWeek = function () {
      if (aktiv() && faellig()) {
        alert('Diese Woche steht ein Playoff-Spiel an! Spiele es erst im Spieltag-Tab.');
        if (typeof switchAppView === 'function') switchAppView('match', document.getElementById('nav-match'));
        return;
      }
      return _orig.apply(this, arguments);
    };
  }
  // Runden ohne eigenes Spiel (Freilos, ausgeschieden, nicht dabei) beim Verlassen ihrer Woche ausspielen; nach dem
  // Finale das Meister-Blatt (eigenes Finale: der Spielbericht zeigt es schon)
  {
    const _orig = window.advanceCalendarWeek;
    if (typeof _orig === 'function') window.advanceCalendarWeek = function () {
      const po = stand();
      if (po && po.runde <= 4 && LEAGUE.week >= po.wochen[po.runde - 1] && !eigenesSpiel(po)) {
        try { rundeAbschliessen(po); } catch (e) { console.warn('[DFL-Playoffs] Runde', e); }
      }
      const r = _orig.apply(this, arguments);
      if (po && po.meister && !po.meisterGezeigt) {
        // sofort (nicht verzögert): sonst stand ein paar hundert Millisekunden „Saison abschließen“ im Haupt-Button
        po.meisterGezeigt = true;
        try { meisterBlatt(po); } catch (e) { console.warn('[DFL-Playoffs] Meister-Blatt', e); }
      }
      return r;
    };
  }
  // Ergebnis des eigenen Spiels: Verlängerung/Elfmeter vor dem Verbuchen, danach Runde abschließen
  {
    const _orig = window.processFixtureResult;
    if (typeof _orig === 'function') window.processFixtureResult = function () {
      const fx = typeof CURRENT_FIXTURE !== 'undefined' ? CURRENT_FIXTURE : null;
      if (!fx || fx.type !== 'playoff' || !aktiv()) return _orig.apply(this, arguments);
      const po = stand(), sp = po && eigenesSpiel(po);
      // D166: Hinspiel ohne Verlängerung; im Rückspiel zählt das Gesamtergebnis (vor = Hinspiel aus eigener Sicht)
      const b = bein(sp), vor = b === 2 ? (sp.heim === 'fcm' ? [sp.hin.gh, sp.hin.ga] : [sp.hin.ga, sp.hin.gh]) : [0, 0];
      let z = { art: 'regulär' };
      letztesNachspiel = null;
      if (sp && b !== 1 && G.homeGoals + vor[0] === G.awayGoals + vor[1]) z = nachspielen(po, sp, fx, vor);
      // Spiel als Text (D77): Verlängerung und Elfmeterschießen stehen beim Buchen fest – der Ticker zeigt sie nach
      if (sp) letztesNachspiel = { saison: LEAGUE.season, runde: sp.runde, gegner: fx.opponentId, art: z.art, tore: z.tore || [], kicks: z.kicks || null, elfer: z.elfer || null,
        bein: b, vor: b === 2 ? vor : null };
      const tE = G.homeGoals, tG = G.awayGoals;
      const r = _orig.apply(this, arguments);
      if (!sp) return r;
      const heim = sp.heim === 'fcm', runde = sp.runde, opp = fx.opponentId;
      if (b === 1) { hinspielGebucht(po, sp, fx, tE, tG); return r; }
      const el = z.elfer ? (heim ? z.elfer : [z.elfer[1], z.elfer[0]]) : null;
      eintragen(po, sp, heim ? tE : tG, heim ? tG : tE, z.art, el);
      const sieg = sp.sieger === 'fcm';
      rundeAbschliessen(po);
      const erg = `${tE}:${tG}${z.art === 'Verlängerung' ? ' n. V.' : z.art === 'Elfmeterschießen' ? ` n. V., ${z.elfer[0]}:${z.elfer[1]} i. E.` : ''}` +
        (b === 2 ? ` (Hinspiel ${vor[0]}:${vor[1]}, gesamt ${tE + vor[0]}:${tG + vor[1]})` : '');
      const naechstes = eigenesSpiel(po);
      let weiter;
      if (runde === 4) po.meisterGezeigt = true;            // der Spielbericht zeigt den Meister
      if (sieg && runde === 4) {
        weiter = `🏆 ${CLUB.name} ist DKL-Meister!`;
        melde(`🏆 Finale gewonnen!`, `${CLUB.name} schlägt ${name(opp)} ${erg}${po.finalort ? ' in ' + po.finalort : ''} und holt den Titel!`);
      } else if (sieg) {
        weiter = naechstes ? `Weiter! ${RUNDE[runde + 1]} in KW ${po.wochen[runde]} ${gegnerText(po, naechstes)}.` : `Weiter in die ${RUNDE[runde + 1]}.`;
        melde(`🏆 Playoffs: ${clubShort()} ist weiter`, `${RUNDE[runde]}: ${erg} gegen ${name(opp)}. ${weiter}`);
      } else {
        weiter = runde === 4 ? `Im Finale verloren – ${name(opp)} ist DKL-Meister.` : `Aus ${IM[runde]}. Die Playoffs laufen ohne dich weiter bis zum Finale.`;
        melde(`Playoff-Aus ${IM[runde]}`, `${clubShort()} verliert ${erg} gegen ${name(opp)}. ` +
          (runde === 4 ? 'Danach zählen Draft, Free Agency und kluge Trades.' : 'Die Playoffs laufen ohne dich weiter – danach zählen Draft, Free Agency und kluge Trades.'));
      }
      dekor = {
        sieg, runde: RUNDE[runde], gegner: TEAMS.away.shortTag || name(opp), kicks: z.kicks || null, elfer: z.elfer || null, weiter,
        kopf: sieg ? 'win' : 'loss', label: z.art === 'Elfmeterschießen' ? (sieg ? 'Sieg im Elfmeterschießen' : 'Aus im Elfmeterschießen')
          : z.art === 'Verlängerung' ? (sieg ? 'Sieg nach Verlängerung' : 'Niederlage nach Verlängerung') : (sieg ? 'Sieg' : 'Niederlage'),
        zusatz: (z.art === 'Verlängerung' ? 'n. V.' : z.art === 'Elfmeterschießen' ? `n. V., ${z.elfer[0]}:${z.elfer[1]} i. E.` : '') +
          (b === 2 ? `${z.art === 'regulär' ? '' : ' · '}gesamt ${tE + vor[0]}:${tG + vor[1]}` : '')
      };
      const sc = document.getElementById('score'); if (sc) sc.textContent = `${tE} : ${tG}`;
      if (typeof saveGameState === 'function') saveGameState();
      try { renderLeagueTab(); } catch (e) { /* nur im Spiel */ }
      return r;
    };
  }
  // D166: Hinspiel gebucht – Stand merken, Rückspiel steht in derselben Woche an (die Woche schaltet nicht weiter)
  function hinspielGebucht(po, sp, fx, tE, tG) {
    const heim = sp.heim === 'fcm', opp = fx.opponentId, R = RUNDE[sp.runde];
    sp.hin = { gh: heim ? tE : tG, ga: heim ? tG : tE };
    const lage = tE > tG ? `${clubShort()} nimmt ${tE - tG === 1 ? 'ein Tor' : (tE - tG) + ' Tore'} Vorsprung mit ins Rückspiel`
      : tE < tG ? `${clubShort()} muss im Rückspiel ${tG - tE === 1 ? 'ein Tor' : (tG - tE) + ' Tore'} aufholen` : 'Alles offen fürs Rückspiel';
    const weiter = `${lage}. Rückspiel am Wochenende ${heim ? 'zu Hause' : 'auswärts'} – bis dahin erholt sich keiner, Rotation hilft.`;
    melde(`Playoffs · Hinspiel der ${R}`, `${fx.isHome ? clubShort() + ' – ' + name(opp) : name(opp) + ' – ' + clubShort()} ${fx.isHome ? tE + ':' + tG : tG + ':' + tE}. ${weiter}`);
    dekor = { sieg: tE > tG, kopf: tE > tG ? 'win' : tE < tG ? 'loss' : 'draw', hin: true, runde: R + ' · Hinspiel', gegner: TEAMS.away.shortTag || name(opp), kicks: null, elfer: null, weiter,
      label: tE > tG ? 'Sieg im Hinspiel' : tE < tG ? 'Niederlage im Hinspiel' : 'Remis im Hinspiel', zusatz: '' };
    if (typeof saveGameState === 'function') saveGameState();
    try { renderLeagueTab(); } catch (e) { /* nur im Spiel */ }
  }
  // Nach dem Hinspiel: „Weiter“ führt ins Office (Aufstellung fürs Rückspiel), die Woche bleibt stehen
  const rueckspielOffen = () => { const sp = aktiv() && faellig(); return !!(sp && bein(sp) === 2); };
  {
    const _orig = window.setupPostMatchButton;
    if (typeof _orig === 'function') window.setupPostMatchButton = function () {
      const r = _orig.apply(this, arguments);
      const btn = document.getElementById('ko-btn');
      if (btn && rueckspielOffen()) btn.innerHTML = '<i class="ti ti-arrow-right" aria-hidden="true"></i> Weiter → Rückspiel vorbereiten';
      return r;
    };
    try { setupPostMatchButton = window.setupPostMatchButton; } catch (e) { /* window reicht */ }
  }
  {
    const _orig = window.postMatchContinue;
    if (typeof _orig === 'function') window.postMatchContinue = function () {
      if (!rueckspielOffen()) return _orig.apply(this, arguments);
      const btn = document.getElementById('ko-btn');
      if (btn) { btn.disabled = true; btn.onclick = null; }
      resetMatchState();
      if (typeof switchAppView === 'function') switchAppView('home', document.getElementById('nav-home'));
    };
    try { postMatchContinue = window.postMatchContinue; } catch (e) { /* window reicht */ }
  }
  // Finale auf neutralem Platz: kein Heimvorteil in der Engine
  ['MatchEngineV3', 'MatchEngineV2'].forEach(k => {
    const E = window[k];
    if (!E || typeof E.simulateMatch !== 'function') return;
    const _orig = E.simulateMatch;
    E.simulateMatch = function (h, a, opt) {
      if (aktiv() && typeof CURRENT_FIXTURE !== 'undefined' && CURRENT_FIXTURE && CURRENT_FIXTURE.neutral) opt = Object.assign({}, opt, { homeAdv: null });
      return _orig.call(this, h, a, opt);
    };
  });

  // ── Anzeige: Startseite, Kalender, Saisonleiste ──────────────────────────
  function naechsteRunde(po) {
    // nächste Runde mit eigenem Spiel oder Freilos; ohne eigenen Verein: laufende Runde (ohne: true)
    if (po.meister || po.runde > 4) return null;
    const drin = imRennen(po);
    return { sp: drin ? eigenesSpiel(po) : null, runde: po.runde, woche: po.wochen[po.runde - 1], ohne: !drin };
  }
  // Für den Haupt-Button: laufende Runde, solange kein eigenes Spiel fällig ist (z. B. „Finale in KW 40“)
  function laufend() {
    const po = aktiv() && stand();
    if (!po || po.meister || po.runde > 4 || faellig()) return null;
    const w = po.wochen[po.runde - 1];
    return RUNDE[po.runde] + (LEAGUE.week < w ? ` in KW ${w}` : '');
  }
  {
    const _orig = window.renderHomeTab;
    if (typeof _orig === 'function') window.renderHomeTab = function () {
      const r = _orig.apply(this, arguments);
      const po = stand(), n = po && naechsteRunde(po);
      if (!n) return r;
      const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
      const wo = n.woche - LEAGUE.week;
      set('hm-comp', `Playoffs · ${RUNDE[n.runde]}`);
      set('hm-countdown', wo <= 0 ? 'diese Woche' : `in ${wo} Woche${wo > 1 ? 'n' : ''}`);
      if (n.ohne) {
        set('hm-away-name', 'ohne dich'); set('hm-venue', 'Ergebnisse im Laufband');
        const c = document.getElementById('hm-away-crest'); if (c) { c.textContent = ''; c.removeAttribute('style'); }
      } else if (n.sp) {
        const heim = gastgeber(n.sp) === 'fcm', opp = n.sp.heim === 'fcm' ? n.sp.gast : n.sp.heim, b = bein(n.sp);
        set('hm-away-name', name(opp));
        if (b) set('hm-comp', `Playoffs · ${RUNDE[n.runde]} · ${b === 1 ? 'Hinspiel' : 'Rückspiel'}`);
        const h = n.sp.hin && (n.sp.heim === 'fcm' ? [n.sp.hin.gh, n.sp.hin.ga] : [n.sp.hin.ga, n.sp.hin.gh]);
        set('hm-venue', n.sp.neutral ? (po.finalort ? `Finale in ${po.finalort}` : 'Neutraler Platz')
          : (heim ? 'Heim' : 'Auswärts') + (b === 2 ? ` · Hinspiel ${h[0]}:${h[1]}` : b === 1 ? ' · Rückspiel am Wochenende' : ''));
        const c = document.getElementById('hm-away-crest');
        if (c) { c.textContent = typeof crestInitials === 'function' ? crestInitials(name(opp)) : ''; if (typeof crestStyle === 'function') c.setAttribute('style', crestStyle(opp)); }
      } else {
        set('hm-away-name', 'Freilos'); set('hm-venue', 'Gegner folgt');
      }
      return r;
    };
  }
  {
    const _orig = window.renderCalendarWidget;
    if (typeof _orig === 'function') window.renderCalendarWidget = function () {
      const r = _orig.apply(this, arguments);
      if (aktiv() && faellig()) {
        const st = document.querySelector('#calendar-widget .cal-status');
        if (st) st.innerHTML = '<span class="cal-tag cal-match"><i class="ti ti-trophy"></i> Playoffs</span>';
      }
      return r;
    };
  }
  // Terminplan: Playoff-Wochen statt „Training“ (eine Zeile je Woche, siehe buildScheduleRows)
  {
    const _orig = window.buildScheduleRows;
    if (typeof _orig === 'function') window.buildScheduleRows = function (von, anzahl) {
      const html = _orig.apply(this, arguments);
      if (!aktiv()) return html;
      const po = stand(), w4 = po ? po.wochen : wochen();
      const teile = html.split('<div class="sched-row');
      if (teile.length < 2) return html;
      const zeilen = teile.slice(1).map((z, i) => {
        const w = von + i, k = w4.indexOf(w) + 1;
        const monat = typeof calendarMonthOfWeek === 'function' ? calendarMonthOfWeek(w).slice(0, 3) : '';
        const jetzt = w === LEAGUE.week ? 'sched-now' : '';
        if (!k && w > w4[2] && w < w4[3]) {
          const pb = po && po.proBowl, erg = pb && Array.isArray(pb.tore) ? `Süd-West ${pb.tore[0]}:${pb.tore[1]} Nord-Ost${pb.elfer ? ' i. E.' : ''}` : null;
          return `<div class="sched-row sched-break ${jetzt}"><span class="sched-wk">${monat} · KW${w}</span><span class="sched-ico"><i class="ti ${window.DFLEhrungen ? 'ti-star' : 'ti-bed'}"></i></span>` +
            (window.DFLEhrungen ? `<span class="sched-lbl">Pro Bowl <span class="sched-sub">${erg || 'die Besten beider Conferences, Pause vor dem Finale'}</span></span></div>`
              : '<span class="sched-lbl">Spielfrei <span class="sched-sub">Pause vor dem Finale</span></span></div>');
        }
        if (!k) return '<div class="sched-row' + z;
        let sub = '';
        if (!po) sub = k === 1 ? 'Top 7 je Conference' : '';
        else if (!dabei(po)) sub = 'ohne dich';
        else if (po.ausgeschieden.fcm && po.ausgeschieden.fcm <= k - 1) sub = 'ohne dich';
        else {
          const sp = po.spiele.find(s => s.runde === k && (s.heim === 'fcm' || s.gast === 'fcm'));
          const ges = sp && gesamt(sp), eig = sp && sp.heim === 'fcm';
          if (sp && sp.sieger) sub = `${sp.sieger === 'fcm' ? 'gewonnen' : 'verloren'} ${eig ? ges[0] + ':' + ges[1] : ges[1] + ':' + ges[0]}${sp.zwei ? ' gesamt' : ''}`;
          else if (sp && sp.hin) sub = `Rückspiel ${eig ? 'gegen' : 'bei'} ${name(eig ? sp.gast : sp.heim)} · Hinspiel ${eig ? sp.hin.gh + ':' + sp.hin.ga : sp.hin.ga + ':' + sp.hin.gh}`;
          else if (sp && sp.zwei) sub = `gegen ${name(eig ? sp.gast : sp.heim)} · Hin und Rück`;
          else if (sp) sub = sp.neutral ? `gegen ${name(sp.heim === 'fcm' ? sp.gast : sp.heim)}${po.finalort ? ' · ' + po.finalort : ''}`
            : `${sp.heim === 'fcm' ? 'gegen' : 'bei'} ${name(sp.heim === 'fcm' ? sp.gast : sp.heim)}`;
          else if (k === 1 && seedVon(po, 'fcm').seed === 1) sub = 'Freilos · eine Woche Ruhe';
          else sub = 'Gegner folgt';
        }
        return `<div class="sched-row sched-cup ${jetzt}"><span class="sched-wk">${monat} · KW${w}</span><span class="sched-ico"><i class="ti ti-trophy"></i></span>` +
          `<span class="sched-lbl">Playoffs · ${KURZ[k]}${sub ? ` <span class="sched-sub">${sub}</span>` : ''}</span></div>`;
      });
      return teile[0] + zeilen.join('');
    };
  }
  {
    const _orig = window.renderSeasonBanner;
    if (typeof _orig === 'function') window.renderSeasonBanner = function () {
      const r = _orig.apply(this, arguments);
      const po = stand(), n = po && naechsteRunde(po), el = document.getElementById('season-banner');
      if (!n || !el) return r;
      const knopf = el.querySelector('button');
      const neu = n.sp && LEAGUE.week >= n.woche
        ? `<button onclick="ensureFixtureLoaded()">Zum Playoff-Spiel: ${RUNDE[n.runde]}${bein(n.sp) === 1 ? ', Hinspiel' : bein(n.sp) === 2 ? ', Rückspiel' : ''}</button>`
        : `<span style="font-size:11px;color:var(--text2)">Playoffs: ${RUNDE[n.runde]} in KW ${n.woche}${n.ohne ? ' – ohne dich' : n.sp ? '' : ' (Freilos)'}</span>`;
      if (knopf) knopf.outerHTML = neu; else el.insertAdjacentHTML('beforeend', neu);
      return r;
    };
  }

  // ── Reiter „Playoffs“: Turnierbaum ───────────────────────────────────────
  function karte(po, s) {
    const seed = id => { const x = seedVon(po, id); return x ? x.seed : ''; };
    const zeile = (id, tore, sieger) => `<div class="dfl-po-team${sieger ? ' sieg' : ''}${id === 'fcm' ? ' eigen' : ''}">` +
      `<span class="dfl-po-seed">${seed(id)}</span><span class="lg-crest" style="${typeof crestStyle === 'function' ? crestStyle(id) : ''}">${typeof crestInitials === 'function' ? crestInitials(name(id)) : ''}</span>` +
      `<span class="dfl-po-name">${name(id)}</span><b>${tore == null ? '' : tore}</b></div>`;
    const nach = s.art === 'Verlängerung' ? 'n. V.' : s.art === 'Elfmeterschießen' ? `n. V., ${s.elfer[0]}:${s.elfer[1]} i. E.` : '';
    const kw = `KW ${po.wochen ? po.wochen[s.runde - 1] : ''}`;
    if (s.zwei) {
      // D166: Gesamtergebnis fett, darunter Hin- und Rückspiel (aus Sicht des oberen Vereins)
      const g = s.hin ? gesamt(s) : [null, null];
      const zus = s.sieger ? `Hin ${s.hin.gh}:${s.hin.ga} · Rück ${s.gh}:${s.ga}${nach ? ' ' + nach : ''}` : s.hin ? `Hin ${s.hin.gh}:${s.hin.ga} · Rückspiel offen` : `${kw} · Hin und Rück`;
      return `<div class="dfl-po-spiel">${zeile(s.heim, g[0], s.sieger === s.heim)}${zeile(s.gast, g[1], s.sieger === s.gast)}<div class="dfl-po-zusatz">${zus}</div></div>`;
    }
    const zus = nach || (s.sieger ? '' : kw);
    return `<div class="dfl-po-spiel">${zeile(s.heim, s.gh, s.sieger === s.heim)}${zeile(s.gast, s.ga, s.sieger === s.gast)}${zus ? `<div class="dfl-po-zusatz">${zus}</div>` : ''}</div>`;
  }
  function baum(po) {
    const spalte = (runde, konf) => {
      const sp = po.spiele.filter(s => s.runde === runde && s.konf === konf);
      const frei = runde === 1 ? `<div class="dfl-po-spiel dfl-po-frei">${(() => { const id = po.setzliste[konf][0];
        return `<div class="dfl-po-team${id === 'fcm' ? ' eigen' : ''}"><span class="dfl-po-seed">1</span>` +
          `<span class="lg-crest" style="${typeof crestStyle === 'function' ? crestStyle(id) : ''}">${typeof crestInitials === 'function' ? crestInitials(name(id)) : ''}</span>` +
          `<span class="dfl-po-name">${name(id)}</span><b></b></div><div class="dfl-po-zusatz">Freilos · eine Woche Ruhe</div>`; })()}</div>` : '';
      return `<div class="dfl-po-runde"><div class="dfl-po-kopf">${KURZ[runde]}</div>${frei}${sp.map(s => karte(po, s)).join('') || '<div class="dfl-po-leer">offen</div>'}</div>`;
    };
    const fin = po.spiele.find(s => s.runde === 4);
    const konfs = KONFS.map(k => `<div class="dfl-div-tabelle"><div class="lg-header"><h3 style="font-size:13px;font-weight:800">Conference ${D.KONF[k]}</h3></div>` +
      `<div class="dfl-po-baum">${[1, 2, 3].map(r => spalte(r, k)).join('')}</div></div>`).join('');
    const finale = `<div class="dfl-div-tabelle"><div class="lg-header"><h3 style="font-size:13px;font-weight:800">Finale${po.finalort ? ' in ' + po.finalort : ''}</h3>` +
      `${po.meister ? `<span style="font-size:11px;color:var(--gold)">🏆 ${name(po.meister)}</span>` : ''}</div>` +
      `<div class="dfl-po-baum">${fin ? `<div class="dfl-po-runde">${karte(po, fin)}</div>` : '<div class="dfl-po-leer">Sieger der beiden Conference-Finals</div>'}</div></div>`;
    return `<div class="dfl-div-tabelle" style="margin-bottom:12px"><div class="lg-header"><h3 style="font-size:13px;font-weight:800">Playoffs ${seasonYearLabelSicher(po.saison)}</h3>` +
      `<span style="font-size:10px;color:var(--text2)">${po.meister ? 'abgeschlossen' : 'laufen'}</span></div><div class="dfl-tabellen">${konfs}${finale}</div></div>`;
  }
  const seasonYearLabelSicher = s => { try { return typeof seasonYearLabel === 'function' ? seasonYearLabel(s) : 'Saison ' + s; } catch (e) { return 'Saison ' + s; } };
  {
    const _orig = window.renderLgPokal;
    if (typeof _orig === 'function') window.renderLgPokal = function () {
      const r = _orig.apply(this, arguments);
      if (!aktiv()) return r;
      const el = document.getElementById('lg-sub-pokal'); if (!el) return r;
      const po = stand() || (LEAGUE.dflPlayoffs && LEAGUE.dflPlayoffs.spiele ? LEAGUE.dflPlayoffs : null);
      if (!po) return r;
      const log = el.querySelector('.cup-log');
      if (log && log.closest('.dfl-div-tabelle')) log.closest('.dfl-div-tabelle').remove();
      const st = el.querySelector('.cup-status');
      if (st) st.insertAdjacentHTML('afterend', baum(po)); else el.insertAdjacentHTML('afterbegin', baum(po));
      return r;
    };
  }

  // ── Meister-Blatt nach dem Finale (Wunsch 2026-10-10: „sehen, wer am Ende gewonnen hat“) ─────────────────────
  const escH = x => String(x == null ? '' : x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const wappenH = (id, kl) => `<span class="lg-crest${kl ? ' ' + kl : ''}" style="${typeof crestStyle === 'function' ? crestStyle(id) : ''}" aria-hidden="true">${typeof crestInitials === 'function' ? crestInitials(name(id)) : ''}</span>`;
  // Titel eines Vereins (Spiel-ID): Chronik der Saisons plus der Meister der laufenden Playoffs, der erst mit dem
  // Saisonabschluss in die Chronik kommt
  function titel(id) {
    if (typeof LEAGUE === 'undefined' || !LEAGUE) return 0;
    const S = window.DFLSpiel, dfl = x => (S && S.dflIdVon ? S.dflIdVon(x) : x), ziel = dfl(id), chronik = LEAGUE.dflChronik || [];
    let n = chronik.filter(c => c && c.meister != null && dfl(c.meister) === ziel).length;
    const po = LEAGUE.dflPO;
    if (po && po.meister && dfl(po.meister) === ziel && !chronik.some(c => c && c.saison === po.saison)) n++;
    return n;
  }
  // D113: große Bühne – Wappen in 96 px (Ring, Band, Mauerkrone) mit Titelsternen nach Bundesliga-Stufen
  function meisterWappen(id) {
    const I = window.DFLIdentitaet, S = window.DFLSpiel, f = S && S.franchise ? S.franchise(id) : null;
    if (!I || !I.sterneFuer || !f) return wappenH(id, 'po-meister-wappen');
    const n = titel(id), sterne = I.sterneFuer(n);
    return `<span class="po-meister-wappen gross${sterne ? ' mit-sternen' : ''}" title="${n} Titel${sterne ? ' · ' + sterne + (sterne === 1 ? ' Stern' : ' Sterne') : ''}">${I.wappenSvg(f, { groesse: sterne ? 112 : 96, sterne })}</span>`;   // mit Sternen etwas größer: das Wappen selbst bleibt ≈ 96 px
  }
  function eigenesAbschneiden(po) {
    if (!dabei(po)) return 'Playoffs verpasst';
    if (po.meister === 'fcm') return 'DKL-Meister!';
    const r = po.ausgeschieden.fcm;
    return r === 4 ? 'im Finale verloren' : r ? `Aus ${IM[r]}` : 'dabei';
  }
  function meisterHtml(po) {
    const m = po.meister, fin = po.spiele.find(s => s.runde === 4);
    const weg = [1, 2, 3, 4].map(r => {
      const sp = po.spiele.find(s => s.runde === r && (s.heim === m || s.gast === m));
      if (!sp) return r === 1 ? `<div class="ks-zeile po-weg"><span class="po-weg-runde">${KURZ[1]}</span><span class="ks-wer"><b>Freilos</b></span></div>` : '';
      const heim = sp.heim === m, opp = heim ? sp.gast : sp.heim, g = gesamt(sp), eig = heim ? g[0] : g[1], geg = heim ? g[1] : g[0];
      const zus = (sp.art === 'Verlängerung' ? ' n. V.' : sp.art === 'Elfmeterschießen' && sp.elfer ? ` i. E. ${heim ? sp.elfer[0] : sp.elfer[1]}:${heim ? sp.elfer[1] : sp.elfer[0]}` : '') + (sp.zwei ? ' ges.' : '');
      return `<div class="ks-zeile po-weg${opp === 'fcm' ? ' ich' : ''}"><span class="po-weg-runde">${KURZ[r]}</span>${wappenH(opp, 'po-weg-wappen')}` +
        `<span class="ks-wer"><b>${escH(name(opp))}</b></span><b class="po-weg-erg">${eig}:${geg}<small>${zus}</small></b></div>`;
    }).join('');
    return `<div class="ks-kopf"><b>DKL-Meister ${escH(seasonYearLabelSicher(po.saison))}</b><small>${po.finalort ? 'Finale in ' + escH(po.finalort) : 'Finale'}</small></div>
      <div class="po-meister">${meisterWappen(m)}<i class="ti ti-trophy po-meister-pokal" aria-hidden="true"></i>
        <b class="po-meister-name">${escH(name(m))}</b>
        ${fin ? `<span class="po-meister-erg">${escH(name(fin.heim))} – ${escH(name(fin.gast))} <b>${ergebnisText(fin)}</b></span>` : ''}</div>
      <div class="ks-liste">${weg}</div>
      <div class="ks-hinweis po-eigen">${escH(CLUB.name)}: <b>${escH(eigenesAbschneiden(po))}</b></div>
      <div class="app-knoepfe po-knoepfe"><button class="app-knopf" type="button" data-po="baum"><i class="ti ti-tournament" aria-hidden="true"></i>Turnierbaum</button>
        <button class="app-knopf haupt" type="button" data-po="zu"><i class="ti ti-check" aria-hidden="true"></i>Weiter</button></div>`;
  }
  const shellAktiv = () => document.body && document.body.classList.contains('dfl-shell');
  function meisterZu() {
    const ov = document.getElementById('dfl-po-meister-ov'); if (ov) ov.remove();
    const b = document.getElementById('app-blatt'), box = b && b.querySelector('.app-blatt-box');
    if (box && box.dataset.poMeister) {
      delete box.dataset.poMeister;
      if (b.classList.contains('auf')) { b.classList.remove('auf'); document.body.classList.remove('app-gesperrt'); }
    }
    try { if (window.DFLAppShell) DFLAppShell.cta(); } catch (e) { /* nur am Handy */ }
  }
  function zumBaum() {
    meisterZu();
    try {
      if (window.DFLAppShell && shellAktiv()) DFLAppShell.zeige('liga');
      else if (typeof switchAppView === 'function') switchAppView('liga', document.getElementById('nav-liga'));
      const tab = document.querySelector('#view-liga .subtab[onclick*="\'pokal\'"]');
      if (tab && typeof switchLigaSubview === 'function') switchLigaSubview('pokal', tab);
      if (typeof renderLgPokal === 'function') renderLgPokal();
    } catch (e) { console.warn('[DFL-Playoffs] Turnierbaum', e); }
  }
  function meisterBlatt(po) {
    if (!aktiv() || !po || !po.meister) return;
    const html = meisterHtml(po);
    const klick = ev => { const k = ev.target.closest('[data-po], .app-blatt-zu'); if (!k) return;
      if (k.getAttribute('data-po') === 'baum') zumBaum(); else meisterZu(); };
    if (shellAktiv()) {
      const box = document.querySelector('#app-blatt .app-blatt-box'); if (!box) return;
      box.innerHTML = '<div class="app-griff"></div><button class="app-blatt-zu" aria-label="Schließen"><i class="ti ti-x" aria-hidden="true"></i></button>' + html;
      box.dataset.poMeister = '1'; box.onclick = klick;
      document.getElementById('app-blatt').classList.add('auf'); document.body.classList.add('app-gesperrt');
      try { DFLAppShell.cta(); } catch (e) { /* Haupt-Button ausblenden */ }
      return;
    }
    meisterZu();
    const ov = document.createElement('div');
    ov.className = 'exp-overlay'; ov.id = 'dfl-po-meister-ov';
    ov.innerHTML = `<div class="exp-dialog qn-dialog po-meister-dialog"><button class="app-blatt-zu qn-zu" aria-label="Schließen"><i class="ti ti-x" aria-hidden="true"></i></button>${html}</div>`;
    ov.addEventListener('click', ev => { if (ev.target === ov) meisterZu(); else klick(ev); });
    document.body.appendChild(ov);
  }

  // ── Saisonabschluss (aus dfl_liga_patch.js): Rest ausspielen, Ergebnis wie bisher ─
  function abschluss(league) {
    if (!aktiv() || !league || !league.dfl) return null;
    const po = stand();
    if (!po) return null;
    let n = 0;
    while (po.runde <= 4 && n++ < 5) rundeAbschliessen(po, true);
    const log = po.spiele.map(s => `${RUNDE[s.runde]}: ${name(s.heim)} – ${name(s.gast)} ${ergebnisText(s)} → ${name(s.sieger)}`);
    const erg = { saison: po.saison, meister: po.meister, finalist: po.finalist, log, finalort: po.finalort, setzliste: po.setzliste,
      eigeneRunde: po.ausgeschieden.fcm || 0, tabelle: po.tabelle, los: po.los, ausgeschieden: po.ausgeschieden,
      spiele: po.spiele, wochen: po.wochen, proBowl: po.proBowl || null };
    delete league.dflPO;
    return erg;
  }

  window.DFLPlayoffs = { CFG, RUNDE, stand, faellig, abschluss, wochen, imRennen, schiessen, eigenesSpiel, laufend, meisterBlatt, titel,
    nachspiel: () => letztesNachspiel, bein, gesamt, gastgeber, abzug,
    // D166: Frische eines Gegners im laufenden Playoff-Spiel (Engine: Kondition der Startelf)
    frische: id => { const po = aktiv() && LEAGUE.dflPO; return po && po.saison === LEAGUE.season && !po.meister ? frische(po, id) : null; } };
  console.log('%c[DFL-Playoffs v1] aktiv', 'color:#3fb950;font-weight:bold',
    '— eigene Playoff-Spiele mit der Engine, Hin- und Rückspiel in Wildcard und Divisional (englische Woche), Verlängerung und Elfmeterschießen, Turnierbaum im Reiter Playoffs');
})();
