/* ═══════════════════════════════════════════════════════════════════════════
   DFL-LIGA-PATCH  ·  v1   (Fahrplan Schritt 2: die Liga-Welt im Spiel)
   ─────────────────────────────────────────────────────────────────────────
   Macht aus dem Spiel die DFL, ohne den Bestandscode umzuschreiben:
     · Vereinswahl: die 32 Franchises (data/league.json) statt der alten Ligen
     · Liga: EINE Gruppe mit 32 Teams. Tier-Schlüssel bleibt 'bundesliga', damit
       Budget-, Gehalts- und Zuschauer-Tabellen des Spiels weiter greifen.
       Der eigene Verein behält intern die ID 'fcm' (steht an 91 Stellen im Code).
     · Kader: aus dem DFL-Generator (28 Spieler, erfundene Namen, Verträge nach Spec); neue Karrieren starten
       mit 25 – je Verein laufen 3 Verträge aus, dazu der Free-Agent-Markt zum Start (D74, DFLSaison.startMarkt)
     · Spielplan: 26 Spieltage nach Spec (DFLSaison.spielplan), Format wie im Spiel
     · NPC-Stärke: Startelf-Werte (Abwehr/Mittelfeld/Angriff) der Kader der Welt
   Zustand im Spielstand: CLUB.dfl = { aktiv, franchiseId, seed, saisonIndex, cap … } und die
   Liga-Welt (alle 32 Kader, Free Agents, Draft-Jahrgang, Picks) kompakt in LEAGUE.dflWelt.
   Der eigene Kader ist SQUAD; in der Welt wird er bei Bedarf gespiegelt (eigenSync).

   Lädt nach allen Spielmodulen und den DFL-Modulen, vor js/init_bootstrap.js.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const G = window.DFLGenerator, S = window.DFLSaison, I = window.DFLIdentitaet;
  if (!G || !S || !window.DFL_LIGA) { console.warn('[DFL-Liga] DFL-Module fehlen – Patch inaktiv'); return; }

  const GRUPPE = 'DFL', TIER = 'bundesliga', KEY = TIER + '::' + GRUPPE;
  const KONF = { SUE_WEST: 'Süd-West', NORD_OST: 'Nord-Ost' };
  let startWahl = null;            // gewählte Franchise beim Karrierestart
  let ligaCache = null;            // generierte Liga (NPC-Kader), aus dem Seed

  const hatClub = () => typeof CLUB !== 'undefined' && CLUB;
  const aktiv = () => (hatClub() && CLUB.dfl && CLUB.dfl.aktiv) || !!startWahl;
  const dflLiga = () => typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.dfl;

  // ── Generierte Liga (deterministisch aus dem Seed) ───────────────────────
  function liga() {
    const seed = startWahl ? startWahl.seed : (CLUB.dfl && CLUB.dfl.seed);
    if (ligaCache && ligaCache.seed === seed) return ligaCache;
    // Gespeicherte Welt (Kader entwickeln sich über die Jahre), sonst neu aus dem Seed
    if (!startWahl && typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.dflWelt && LEAGUE.dflWelt.seed === seed) {
      try { ligaCache = entpackeWelt(LEAGUE.dflWelt); return ligaCache; } catch (e) { console.warn('[DFL-Liga] Welt nicht lesbar – neu erzeugt', e); }
    }
    // D143: Vereinswechsel nach der Entlassung – dieselbe Welt weiter (der alte Verein ist ab jetzt KI), kein Start-Markt
    if (startWahl && startWahl.welt) {
      ligaCache = entpackeWelt(startWahl.welt);
      G.setzeCap(ligaCache.cap || 120000000);
      ligaCache.teams.forEach(t => { t.eigen = t.id === startWahl.franchiseId; });
      if (window.DFLHandel && DFLHandel.lagenSetzen) { try { DFLHandel.lagenSetzen(ligaCache); } catch (e) { console.warn('[DFL-Liga] Lage nach dem Wechsel (D143)', e); } }
      return ligaCache;
    }
    G.setzeCap(120000000);
    ligaCache = G.erzeugeLiga(window.DFL_LIGA, { seed });
    ligaCache.seed = seed; ligaCache.saisonIndex = 0;
    // D74: neue Karriere startet mit 25 – bei allen 32 Vereinen (auch deinem) laufen 3 Verträge aus, dazu erzeugte Free Agents
    // aller Altersstufen (DFLSaison.startMarkt, wie im Langzeitlauf). Alte Spielstände lesen ihre Welt aus LEAGUE.dflWelt.
    // D108: Start am Tag der Verträge – stille Vorsaison (Draft-Reihenfolge), bei den KI-Vereinen laufen Verträge aus (Kader 21),
    // beim eigenen Verein bleiben die Auslaufenden im Kader (du entscheidest am Tag der Verträge, dfl_startdraft.js), dann der
    // Start-Jahrgang als kommender Draft. Ergebnis der Vorsaison für den Spielstart: ligaCache._start (nicht im Weltspeicher)
    if (startWahl && S.startMarkt && S.CFG.start && S.CFG.start.aktiv) {
      const mitDraft = S.startDraftAn && S.startDraftAn(S.CFG.start) && S.vorsaison;
      let vs = null;
      try { if (mitDraft) vs = S.vorsaison(ligaCache); } catch (e) { vs = null; console.warn('[DFL-Liga] Vorsaison (D108) fehlgeschlagen', e); }
      try {
        const m = S.startMarkt(ligaCache, null, Object.assign({ herkunftOhne: [startWahl.franchiseId] }, vs ? { halten: [startWahl.franchiseId] } : { kader: S.CFG.start.kader }));
        if (vs) {
          S.startJahrgang(ligaCache, null, vs.reihenfolge);
          Object.defineProperty(ligaCache, '_start', { value: { reihenfolge: vs.reihenfolge, meister: vs.meister, finalist: vs.finalist,
            tabelle: vs.saison.tabelle, ausgeschieden: vs.po.ausgeschieden, auslauf: (m.halten || {})[startWahl.franchiseId] || [] }, enumerable: false, configurable: true });
        }
      } catch (e) { console.warn('[DFL-Liga] Start-Markt (D74/D108) fehlgeschlagen', e); }
    }
    // D110: Lage aller Vereine zum Start festhalten (Kaderziel, Draft, Free Agency und Handel der KI); der eigene Verein plant frei
    if (startWahl && window.DFLHandel && DFLHandel.lagenSetzen) {
      try {
        const eigen = ligaCache.teams.find(t => t.id === startWahl.franchiseId);
        if (eigen) eigen.eigen = true;
        DFLHandel.lagenSetzen(ligaCache);
      } catch (e) { console.warn('[DFL-Liga] Lage zum Start (D110)', e); }
    }
    return ligaCache;
  }

  // ── Welt im Spielstand (kompakt: ~300 KB statt 1 MB) ─────────────────────
  const TYPEN = ['normal', 'schnell', 'star', 'ausnahme'], STAFFEL = ['gleich', 'steigend', 'fallend'], ARTEN = ['veteran', 'rookie', 'minimum', 'perspektiv'];
  const EXTRA = ['rookieVertrag', 'vereinsJahre', '_exVerein', 'gamesPlayed', '_schwereVerletzung', 'perspektiv', 'college',
    'fruehmelder', 'medien', '_wert', '_medienWert', 'kombine', 'flag', 'country', 'sq', '_bias', 'wiederangemeldet', 'karriere', 'verwandt', 'koerper', 'niete', 'diamant', 'faRunden',
    // D102: Verletzung (Restwochen, Gesamtdauer, Art, frisch), Rückstand, Verletztenliste/Ersatz der KI, verletzte Wochen der Saison
    'aus', 'ausGes', 'ausTyp', 'ausFrisch', 'reha', 'rehaStart', 'ir', 'ersatzFuer', 'saisonAusW',
    // D99: Wechselwunsch eines KI-Spielers { team, seit, summe, gruende } (DFLHandel.wechselwunschAktualisieren)
    'weg',
    // L3: Startelf-Einsätze je Platz (Positionen lernen, DFLSaison.lerneEinsatz)
    'posEinsaetze'];
  function packeSpieler(p) {
    const c = p.contract, v = p.vertragsprofil || {}, x = {};
    EXTRA.forEach(k => {
      const w = p[k];
      if (w == null || w === '' || w === false || (k === 'flag' && w === '🇩🇪') || (k === 'country' && w === 'Deutschland') || (k === 'gamesPlayed' && !w)) return;
      x[k] = w;
    });
    return [p.id, p.pos, (p.positions || [p.pos]).join('/'), p.age, Math.round((p.seed || 0) * 1e6), p.firstName || '', p.name,
      p.def, p.mid, p.att, p.ovr, p.pace, p.mental, TYPEN.indexOf(p.entwicklungstyp), p.entwicklungstypBekannt ? 1 : 0, p.truePotential,
      p.heimat || '', (p.traits || []).join('/'), (p.traitsBekannt || []).join('/'), [v.geld, v.titel, v.treue, v.sicherheit],
      c ? [c.years_total, c.years_remaining, c.base_salary_by_year, c.signing_bonus_total, c.guaranteed_bonuses || 0, STAFFEL.indexOf(c.staffelung), ARTEN.indexOf(c.art)] : 0,
      Object.keys(x).length ? x : 0];
  }
  function entpackeSpieler(a, teamId) {
    const teile = s => s ? s.split('/') : [];
    const p = { id: a[0], teamId: teamId || null, pos: G.dflPos(a[1]), positions: [...new Set(teile(a[2]).map(G.dflPos))], age: a[3], flag: '', country: 'Deutschland', gamesPlayed: 0,
      seed: a[4] / 1e6, firstName: a[5], name: a[6], def: a[7], mid: a[8], att: a[9], ovr: a[10], pace: a[11], mental: a[12],
      entwicklungstyp: TYPEN[a[13]] || 'normal', entwicklungstypBekannt: !!a[14], truePotential: a[15], heimat: a[16] || null,
      traits: teile(a[17]), traitsBekannt: teile(a[18]), vertragsprofil: { geld: a[19][0], titel: a[19][1], treue: a[19][2], sicherheit: a[19][3] } };
    const c = a[20];
    if (c) {
      p.contract = { years_total: c[0], years_remaining: c[1], base_salary_by_year: c[2], base_salary: c[2][c[0] - c[1]] != null ? c[2][c[0] - c[1]] : c[2][c[2].length - 1],
        signing_bonus_total: c[3], guaranteed_bonuses: c[4], staffelung: STAFFEL[c[5]] || 'gleich', art: ARTEN[c[6]] || 'veteran' };
      p.wage = Math.round(p.contract.base_salary / 52); p.contractUntil = c[1];
    } else p.contract = null;
    if (a[21]) Object.assign(p, a[21]);
    return p;
  }
  function packeWelt(L, alle) {
    // alle (D143): auch den eigenen Kader packen – der alte Verein spielt nach dem Vereinswechsel als KI mit seinem Kader weiter
    const eigen = alle ? null : eigeneId(), ohne = ['roster', 'practice_squad', 'farben', 'wappen_figur', 'wappen_icon'];
    // pos: 12 = Positionen mit Seite (D95) – alte Welten ohne die Marke stellt entpackeWelt einmal um
    // kaderschnitt (D110): Saisonjahr des letzten Kaderschnitts – ab dann zählt Cap-Not als Abgabegrund (DFLHandel.abgabeGruende);
    // faWelle (Markt): Welle der Free Agency seit dem Saisonwechsel – gute Free Agents warten nach Profil einige Wellen
    return { v: 1, pos: 12, seed: L.seed, saisonJahr: L.saisonJahr, saisonIndex: L.saisonIndex || 0, cap: L.cap, _ersatzNr: L._ersatzNr || 0, kaderschnitt: L.kaderschnitt || null,
      faWelle: L.faWelle || null,
      trainer: L.trainer || null,                                    // D118: Trainermarkt (frei), Zähler, Hall-of-Fame-Kandidaten
      picks: L.picks || [], handel: (L.handel || []).slice(-80), historie: L.historie || null,      // Liga-Gedächtnis (Preise, Hall of Fame)
      teams: L.teams.map(t => {
        const o = {}; Object.keys(t).forEach(k => { if (ohne.indexOf(k) < 0) o[k] = t[k]; });
        o.roster = t.id === eigen ? [] : t.roster.map(packeSpieler);
        o.practice_squad = t.id === eigen ? [] : t.practice_squad.map(packeSpieler);
        return o;
      }),
      freie: (L.freie || []).map(packeSpieler),
      draft: L.draft ? Object.assign({}, L.draft, { talente: L.draft.talente.slice(0, 240).map(packeSpieler) }) : null,
      draftNaechste: L.draftNaechste ? Object.assign({}, L.draftNaechste, { talente: L.draftNaechste.talente.slice(0, 260).map(packeSpieler) }) : null };
  }
  function entpackeWelt(o) {
    const L = { seed: o.seed, saisonJahr: o.saisonJahr, saisonIndex: o.saisonIndex || 0, cap: o.cap, _ersatzNr: o._ersatzNr || 0,
      picks: o.picks || [], handel: o.handel || [] };
    if (o.kaderschnitt) L.kaderschnitt = o.kaderschnitt;
    if (o.faWelle) L.faWelle = Object.assign({}, o.faWelle);
    if (o.trainer) L.trainer = o.trainer;
    if (o.historie) L.historie = o.historie;
    L.teams = o.teams.map(t => {
      const f = window.DFL_LIGA.franchises.find(x => x.id === t.id) || {};
      // D57: Namen immer aus den Daten (alte Spielstände tragen noch echte Vereinsnamen)
      return Object.assign({}, t, { name: f.name || t.name, kurz: f.kurz || t.kurz, farben: f.farben, wappen_figur: f.wappen_figur, wappen_icon: f.wappen_icon,
        anlagen: Object.assign({}, t.anlagen, { stadion: Math.max(20000, (t.anlagen && t.anlagen.stadion) || 20000) }),
        roster: t.roster.map(a => entpackeSpieler(a, t.id)), practice_squad: t.practice_squad.map(a => entpackeSpieler(a, t.id)) });
    });
    L.freie = (o.freie || []).map(a => entpackeSpieler(a, null));
    L.draft = o.draft ? Object.assign({}, o.draft, { talente: o.draft.talente.map(a => entpackeSpieler(a, null)) }) : null;
    L.draftNaechste = o.draftNaechste ? Object.assign({}, o.draftNaechste, { talente: o.draftNaechste.talente.map(a => entpackeSpieler(a, null)) }) : null;
    // D95: alte Welt (ohne Marke pos: 12) einmal auf Positionen mit Seite umstellen – je Verein ausgeglichen, Free Agents und
    // Draft-Jahrgänge je Liste; Bestandsschutz: Flügel lernen LM/RM ihrer Seite (DFLGenerator.seitenUmstellen)
    if (o.pos !== 12 && G.seitenUmstellen) {
      const saat = String(o.seed || '');
      let n = 0;
      L.teams.forEach(t => { n += G.seitenUmstellen(t.roster.concat(t.practice_squad), { saat: saat + '|' + t.id }); });
      n += G.seitenUmstellen(L.freie, { saat: saat + '|frei' });
      if (L.draft) n += G.seitenUmstellen(L.draft.talente, { saat: saat + '|draft' });
      if (L.draftNaechste) n += G.seitenUmstellen(L.draftNaechste.talente, { saat: saat + '|draft2' });
      Object.defineProperty(L, '_d95', { value: n, enumerable: false, writable: true, configurable: true });
      if (n) console.log(`[DFL-Liga] D95: ${n} Spieler der Welt auf Positionen mit Seite umgestellt`);
    }
    const namen = new Set();
    L.teams.forEach(t => t.roster.concat(t.practice_squad).forEach(p => namen.add(p.firstName + ' ' + p.name)));
    L.freie.concat(L.draft ? L.draft.talente : [], L.draftNaechste ? L.draftNaechste.talente : []).forEach(p => namen.add(p.firstName + ' ' + p.name));
    Object.defineProperty(L, 'namen', { value: namen, enumerable: false });
    return L;
  }

  // ── Eigener Kader in der Welt (für Handel, Analyse, Draft-Reihenfolge) ───
  function spielZuDfl(q, saison) {
    const rest = Math.max(1, (q.contractUntil || saison) - saison + 1);
    const c = q.contract, jahr = (q.wage || 0) * 52;
    const laeuft = c && c.years_total && q.dflVertragBis != null && saison <= q.dflVertragBis;
    const bonusJahr = laeuft ? (c.signing_bonus_total || 0) / c.years_total : 0;
    // Development Squad (D45): nur wer einen Squad-Vertrag hat, steht mit 250.000 € in der Welt; sonst gilt sein Vertrag
    const ds = q.perspektiv && (q.dsVertrag || (c && c.art === 'perspektiv'));
    let contract = ds ? S.pkVertrag() : { years_total: rest, years_remaining: rest, base_salary: jahr, base_salary_by_year: Array(rest).fill(jahr),
      signing_bonus_total: Math.round(bonusJahr * rest), guaranteed_bonuses: laeuft ? (c.guaranteed_bonuses || 0) : 0, staffelung: 'gleich', art: (c && c.art) || 'veteran' };
    // Folgevertrag (D92, dfl_saisonwechsel_patch.js): die Welt kennt nur einen Vertrag – alter und neuer hintereinander, Grundgehalt je
    // Jahr so gesetzt, dass der Cap Hit jedes Jahres dem Spiel entspricht (Handgeld der Welt gleichmäßig über alle Jahre, höchstens so
    // viel, dass kein Grundgehalt negativ wird – sonst rutscht der Rest ins Grundgehalt der neuen Jahre: billiger Rookie-Vertrag + großes
    // Handgeld, Cap-Zufallstest 2026-10-10). Nach einem Trade zahlt der neue Verein wie immer nur das Grundgehalt, das Rest-Handgeld
    // bleibt als Dead Cap (C4)
    const F = !ds && q.vertragFolge, verbunden = !!(F && F.start === saison + rest && F.jahre > 0);
    if (verbunden) {
      const n = F.jahre, sbNeu = Math.max(0, (F.signing_bonus_total || 0) - (F.vorab || 0)), g = contract.guaranteed_bonuses;
      const hits = Array(rest).fill(jahr + bonusJahr + g);
      for (let j = 0; j < n; j++) hits.push(((F.base_salary_by_year || [])[j] || 0) + sbNeu / n + (F.guaranteed_bonuses || 0));
      const T = rest + n, sb = Math.max(0, Math.min(contract.signing_bonus_total + sbNeu, Math.floor(Math.min(...hits.map(h => h - g)) * T))), schnitt = sb / T;
      const by = hits.map(h => Math.max(0, Math.round(h - schnitt - g)));
      contract = { years_total: T, years_remaining: T, base_salary: by[0], base_salary_by_year: by, signing_bonus_total: sb,
        guaranteed_bonuses: g, staffelung: F.staffelung || 'gleich', art: (c && c.art) || 'veteran' };
    }
    // Positionen des Spiels auf DFL-Positionen der Welt (ZOM → OM; seit D95 zwölf mit Seite, Altbestand AV/FL bis zur Umstellung)
    return { id: q.dflId || q.id, sq: q.id, teamId: eigeneId(), pos: G.dflPos(q.pos), positions: [...new Set((q.positions || [q.pos]).map(G.dflPos))], age: q.age,
      firstName: q.firstName || '', name: q.name, def: q.def, mid: q.mid, att: q.att, ovr: q.ovr, pace: q.pace, mental: q.mental,
      truePotential: Math.max(q.ovr, q.truePotential || q.ovr), entwicklungstyp: q.entwicklungstyp || 'normal', entwicklungstypBekannt: !!q.entwicklungstypBekannt,
      traits: (q.traits || []).slice(), traitsBekannt: [], vertragsprofil: Object.assign({ geld: 50, titel: 50, treue: 50, sicherheit: 50 }, q.vertragsprofil),
      seed: q.dflSeed != null ? q.dflSeed : ((q.seed || 1) / 2147483647), heimat: q.heimat || null, rookieVertrag: q.rookieVertrag, perspektiv: !!q.perspektiv, ir: !!q.verletztenliste,
      contract,
      // Welt-Wochenlohn folgt dem Vertrag (mit Folgevertrag weicht das Grundgehalt der Welt vom Spiel ab, der Cap Hit nicht)
      wage: verbunden ? Math.round(contract.base_salary / 52) : q.wage, contractUntil: verbunden ? contract.years_remaining : rest,
      karriere: q.karriere, koerper: q.koerper || undefined, niete: q.niete || undefined, diamant: q.diamant || undefined,
      posEinsaetze: q.posEinsaetze ? Object.assign({}, q.posEinsaetze) : undefined,      // L3: Positionen lernen
      // D102: Verletzung und Rückstand ziehen mit (Welt-Stärke, Brücke, Tausch)
      aus: q.injuryWeeks > 0 ? q.injuryWeeks : undefined, ausGes: q.injuryWeeks > 0 ? (q.injuryTotal || q.injuryWeeks) : undefined,
      ausTyp: q.injuryWeeks > 0 ? (q.injuryType || undefined) : undefined, ausFrisch: q.injuryWeeks > 0 && q.injuryFrisch ? 1 : undefined,
      reha: q.reha > 0 ? q.reha : undefined, rehaStart: q.reha > 0 ? (q.rehaStart || q.reha) : undefined,
      // D99: der Wechselwunsch eigener Spieler lebt im Spiel (q.dflWeg, dfl_wechsel_patch.js) – in der Welt nie (der Spiegel
      // entsteht bei jedem eigenSync neu; nach einem Tausch hat sich der Wunsch mit dem Vereinswechsel erledigt)
      weg: undefined };
  }
  function eigenSync() {
    if (!hatClub() || !CLUB.dfl || typeof SQUAD === 'undefined' || typeof LEAGUE === 'undefined' || !LEAGUE) return null;
    const L = liga(), t = L.teams.find(x => x.id === eigeneId()), s = LEAGUE.season;
    t.eigen = true;                // D110: der eigene Verein plant mit dem vollen Kader (21–28 frei), kein Kaderziel nach Lage
    t.roster = SQUAD.filter(q => !q.perspektiv && !q.onLoanAt).map(q => spielZuDfl(q, s));
    t.practice_squad = SQUAD.filter(q => q.perspektiv).map(q => spielZuDfl(q, s));
    t.salary_cap_limit = (window.DFLKader && DFLKader.capLimit ? DFLKader.capLimit() : 0) || CLUB.dfl.capLimit || L.cap;   // mit Werbe-Bonus (D56)
    t.dead_cap_total = CLUB.dfl.deadCap || 0;
    t.anlagen = Object.assign({}, t.anlagen, { scouting: (CLUB.facilities && CLUB.facilities.scouting) || t.anlagen.scouting,
      training: (CLUB.facilities && CLUB.facilities.training) || t.anlagen.training,
      medizin: (CLUB.facilities && CLUB.facilities.medizin) || t.anlagen.medizin });      // D102
    return t;
  }
  // Stärke der KI-Teams in der Tabelle = Startelf ihrer Kader in der Welt
  function staerkeAktualisieren() {
    if (!dflLiga()) return;
    const L = liga();
    LEAGUE.tiers[TIER].groups[0].teams.forEach(t => {
      if (t.id === 'fcm') return;
      const gt = L.teams.find(x => x.id === t.dflId);
      if (!gt) return;
      const w = S.teamWerte(gt);
      t.def = Math.round(w.def); t.mid = Math.round(w.mid); t.att = Math.round(w.att);
      t.ovr = Math.round((t.def + t.mid + t.att) / 3);
    });
  }
  // KI-Spiele im Spiel (quickSimResult, engine_main.js) mit derselben Formel wie der Saisonlauf (D43): Teiler und Starfaktor
  // aus DFLSaison.CFG.spiel – vorher fest 24/28, damit waren Spiele im Spiel flacher als die Welt.
  {
    const _orig = window.quickSimResult;
    if (typeof _orig === 'function') window.quickSimResult = function (home, away) {
      if (!dflLiga() || typeof ratingsOf !== 'function' || typeof poissonSample !== 'function') return _orig.apply(this, arguments);
      const [lh, la] = S.toreErwartet(Object.assign({}, ratingsOf(home), trainerWerte(home.id)), Object.assign({}, ratingsOf(away), trainerWerte(away.id)), S.CFG.heimvorteil);
      return [poissonSample(lh), poissonSample(la)];
    };
  }
  // D118: Trainerteam eines Vereins für die Formel (Standardtrainer, Psychologe im Elfmeterschießen); id = Spiel-ID ('fcm', 'dfl_…')
  function trainerWerte(id) {
    const Tr = window.DFLTrainer;
    if (!Tr || !Tr.CFG.aktiv || !dflLiga()) return {};
    const t = liga().teams.find(x => x.id === dflIdVon(id));
    return t ? { std: Tr.stdSterne(t), elfer: Tr.elferBonus(t) } : {};
  }
  function weltGeaendert() {
    staerkeAktualisieren();
    if (aktiv()) window.AI_SQUADS = gegnerKader();
  }
  const eigeneId = () => startWahl ? startWahl.franchiseId : CLUB.dfl.franchiseId;
  const spielId = dflId => dflId === eigeneId() ? 'fcm' : 'dfl_' + dflId;
  const dflIdVon = id => id === 'fcm' ? eigeneId() : String(id).replace(/^dfl_/, '');
  function franchise(id) { return window.DFL_LIGA.franchises.find(f => f.id === dflIdVon(id)); }

  // ── Liga statt Pyramide ──────────────────────────────────────────────────
  function baueLiga() {
    // D143: beim Vereinswechsel läuft die Saison weiter (Spielplan, Tabelle, Draft-Reihenfolge; IDs schon umgestellt)
    if (startWahl && startWahl.league) return startWahl.league;
    const L = liga();
    const teams = L.teams.map(t => {
      const w = S.teamWerte(t);
      const team = makeTeam(t.name, { def: Math.round(w.def), mid: Math.round(w.mid), att: Math.round(w.att) }, spielId(t.id));
      Object.assign(team, { dflId: t.id, conference: t.conference, division: t.division, kurz: t.kurz });
      return team;
    });
    return {
      season: 1, matchday: 0, week: 1, startYear: 2026, matchWeeks: [], dfl: true, dflIds: 2,   // dflIds: Vereins-IDs ohne Vorbildnamen (engine_main.js)
      tiers: { [TIER]: { name: 'Deutsche Kickdraft Liga', groups: [{ name: GRUPPE, teams }] } },
      fixtures: {}, usedNames: teams.map(t => t.name)
    };
  }
  ['buildNewPyramid'].forEach(fn => {
    const _orig = window[fn];
    if (typeof _orig !== 'function') return;
    window[fn] = function () { return aktiv() ? baueLiga() : _orig.apply(this, arguments); };
  });

  // ── Spielplan: 26 Spieltage nach Spec ────────────────────────────────────
  function spielplan(league) {
    const L = liga();
    const idx = (CLUB.dfl && CLUB.dfl.saisonIndex) || 0;
    const plan = S.spielplan(L.teams, idx, G.rngAus((CLUB.dfl.seed || 1) * 31 + idx));
    league.fixtures[KEY] = plan.map(tag => tag.map(([h, g]) => [spielId(h), spielId(g)]));
    league.matchWeeks = buildMatchWeeks(league.fixtures[KEY].length);
  }
  // Testspiele: 3 Gegner aus der anderen Conference (keine Ligagegner der Division)
  function testspiele(league) {
    const eigene = league.tiers[TIER].groups[0].teams.find(t => t.id === 'fcm');
    const pool = league.tiers[TIER].groups[0].teams.filter(t => t.id !== 'fcm' && t.conference !== eigene.conference);
    const tmp = pool.slice(), chosen = [];
    for (let i = 0; i < FRIENDLY_WEEKS.length && tmp.length; i++) chosen.push(tmp.splice(rndN(tmp.length), 1)[0]);
    league.friendlies = chosen.map((t, i) => ({ week: FRIENDLY_WEEKS[i], opponentId: t.id, opponentName: t.name, opponentOvr: t.ovr,
      isHome: Math.random() < 0.5, played: false, gh: null, ga: null }));
  }
  {
    const _orig = window.generateAllFixtures;
    window.generateAllFixtures = function (league) {
      if (!league || !league.dfl) { heimspieleSetzen(null); return _orig.apply(this, arguments); }
      if (startWahl && startWahl.league === league) { heimspieleSetzen(league); SQUAD.forEach(assignBirthday); return; }   // D143: Spielplan steht
      spielplan(league);
      testspiele(league);
      heimspieleSetzen(league);
      SQUAD.forEach(assignBirthday);
    };
  }

  // ── Kader aus dem Generator ──────────────────────────────────────────────
  // Technik wie bundle_tactics_core.js deriveTechnik (55 % Mittelfeld + 18 ± 9), aber fest je Spieler aus seinem Seed
  function technikVon(w) {
    const r = G.rngAus((Math.floor((w.seed || 0.5) * 1e9) ^ 0x7ec41) >>> 0);
    return Math.max(25, Math.min(95, Math.round((w.mid || 55) * 0.55 + 18 + (r() - 0.5) * 18)));
  }
  function zuSpielSpieler(p) {
    const q = {
      id: p.sq || (/^sq_/.test(p.id) ? p.id : 'sq_' + p.id), name: p.name, firstName: p.firstName || '', flag: '', country: p.country || 'Deutschland',
      joinedSeason: (typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.season) || 1, pos: p.pos, positions: (p.positions || [p.pos]).slice(),
      def: p.def, mid: p.mid, att: p.att, pace: p.pace, mental: p.mental,
      // Spiel braucht ganzzahlige Seeds (player_attributes.js: seed >>> 0); Gesichter nutzen dflSeed
      age: p.age, gamesPlayed: 0, seed: Math.floor((p.seed || Math.random()) * 2147483646) + 1, dflSeed: p.seed, truePotential: p.truePotential,
      traits: (p.traits || []).slice(), heimat: p.heimat, entwicklungstyp: p.entwicklungstyp,
      entwicklungstypBekannt: p.entwicklungstypBekannt, vertragsprofil: Object.assign({}, p.vertragsprofil),
      // Wochenlohn aus dem laufenden Vertragsjahr, nicht aus p.wage: das stand in älteren Welten noch beim ersten Jahr der
      // Staffel – eingetauschte Spieler kosteten dann mehr oder weniger, als die Cap-Prüfung des Tauschs rechnete (2026-10-10)
      contract: JSON.parse(JSON.stringify(p.contract)), wage: p.contract && p.contract.base_salary > 0 ? Math.round(p.contract.base_salary / 52) : p.wage, dflId: p.id,
      // Karriere (Saisons, Tore, Titel, Preise) und Verwandtschaft ziehen mit (Trade, Free Agency; Prüfung 2026-10-10)
      karriere: p.karriere, verwandt: p.verwandt,
      // Körperalter (D68) zieht mit: Abbau und körperliche Detailwerte wie in der Welt
      koerper: p.koerper || undefined,
      // L3: Einsätze je Platz (Positionen lernen) ziehen mit
      posEinsaetze: p.posEinsaetze ? Object.assign({}, p.posEinsaetze) : undefined,
      // Verborgene Niete (D103): die alte Hoffnung zieht mit, das echte Potenzial steckt in truePotential
      niete: p.niete ? Object.assign({}, p.niete) : undefined,
      // Rohdiamant (Rückmeldung 17.10.): alte Einschätzung und „entdeckt“ ziehen mit
      diamant: p.diamant ? Object.assign({}, p.diamant) : undefined,
      // D99: der Wechselwunsch (p.weg) zieht nicht mit – er endet mit dem Vereinswechsel
      // D102: verletzt bleibt verletzt (Tausch, Free Agency), Rückstand zieht mit
      injuryWeeks: p.aus > 0 ? p.aus : 0, injuryType: p.aus > 0 ? (p.ausTyp || 'Verletzung') : null, injuryTotal: p.aus > 0 ? (p.ausGes || p.aus) : undefined,
      injuryFrisch: p.aus > 0 && p.ausFrisch ? true : undefined, reha: p.reha > 0 ? p.reha : undefined, rehaStart: p.reha > 0 ? (p.rehaStart || p.reha) : undefined,
      // Spiel: contractUntil = letzte Saison des Vertrags (läuft aus, wenn ≤ aktuelle Saison)
      contractUntil: ((typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.season) || 1) + Math.max(1, p.contract ? p.contract.years_remaining : p.contractUntil) - 1
    };
    // Positionen wie in der Welt (sonst würfelt bundle_tactics_core.js migratePlayer sie neu: AV → AM, ST → FL …);
    // OM heißt im Spiel ZOM. Technik fest je Spieler – dieselbe wie bei der KI in der Engine (Prüfung 2026-10-09).
    q.positions = [...new Set((p.positions || [p.pos]).map(x => x === 'OM' ? 'ZOM' : x))]; q.pos = q.positions[0];
    q.technik = technikVon(p); q.styleXP = {}; q._posMigrated = true;
    q.ovr = computeOvrFromAreas(q);
    q.dflVertragBis = q.contractUntil;          // Handgeld zählt bis dahin gegen den Cap (dfl_kader_patch.js)
    if (p.rookieVertrag) q.rookieVertrag = Object.assign({}, p.rookieVertrag);
    if (p.perspektiv) { q.perspektiv = true; if (p.contract && p.contract.art === 'perspektiv') q.dsVertrag = true; }
    q.truePotential = Math.max(q.ovr, q.truePotential || q.ovr);
    q.value = computeMarketValue(q);
    if (!q.wage) q.wage = weeklyWageFor(q);
    return q;
  }
  {
    const _orig = window.generateStartingSquad;
    window.generateStartingSquad = function () {
      if (!aktiv()) return _orig.apply(this, arguments);
      const t = liga().teams.find(x => x.id === eigeneId());
      // D143: beim Vereinswechsel kommt der Development Squad mit (ein neuer Verein beginnt ohne)
      return t.roster.concat(startWahl && startWahl.welt ? t.practice_squad.map(p => Object.assign(p, { perspektiv: true })) : []).map(zuSpielSpieler);
    };
  }

  // ── Altsysteme abschalten, solange die DFL läuft ─────────────────────────
  // (Die alte Stärketabelle echter Vereine ist seit dem Aufräumen 2026-10-13 gelöscht; die Stärke kommt aus der Welt.)
  function altsysteme(an) {
    if (!an && hatClub()) { delete CLUB.euro; delete CLUB.youthProspects; }
    window.AI_SQUADS = an ? altKader : gegnerKader();     // Gegner-Torschützen aus der DFL-Welt (Regel 6)
  }

  // ── Keine echten Spieler in der DFL (Regel 6) ────────────────────────────
  // game_data.js bringt echte Kader mit (AI_SQUADS) – in der DFL kommen die Gegner aus der Welt.
  // Markt, Bieter und Europapokal sind entfernt (D36).
  const altKader = window.AI_SQUADS;
  function gegnerKader() {
    const m = {};
    liga().teams.forEach(t => {
      if (t.id === eigeneId()) return;
      const kader = t.roster.map(p => ({ id: 'dfl_' + p.id, name: p.name, firstName: p.firstName || '', pos: p.pos,
        positions: (p.positions || [p.pos]).slice(), age: p.age, ovr: Math.round(computeOvrFromAreas(p)) }));
      m[spielId(t.id)] = kader; m[t.name] = kader;     // Testspiele kennen den Gegner nur beim Namen
    });
    return m;
  }

  // ── Finanzen: echte Heimspielzahl, gemeinsamer TV-Topf, kein Europa ──────
  // Gemeinsamer TV-Topf, gleich verteilt (Übergabe §4): 65 Mio je Verein beim Start-Cap von
  // 120 Mio (D26, entschieden), wächst mit dem Cap – der Cap folgt den Liga-Einnahmen.
  const TV_JE_VEREIN = 65000000, START_CAP = 120000000;
  const tvJeVerein = () => Math.round(TV_JE_VEREIN * (((hatClub() && CLUB.dfl && CLUB.dfl.cap) || START_CAP) / START_CAP));
  window.tvGemeinsamJeVerein = () => dflLiga() ? tvJeVerein() : null;
  {
    const _orig = window.computeTvMoneyForGroup;
    if (typeof _orig === 'function') window.computeTvMoneyForGroup = function (teams, tierKey) {
      if (!dflLiga() || tierKey !== TIER) return _orig.apply(this, arguments);
      const out = {};
      const tv = tvJeVerein();
      (teams || []).forEach(t => { out[t.id] = tv; });
      return out;
    };
  }
  // Heimspiele der Saison (13 Liga + Heim-Testspiele) für Planung und Dauerkarten-Umlage
  function heimspieleSetzen(league) {
    let n = 17;
    if (league && league.dfl) {
      n = 0;
      (league.fixtures[KEY] || []).forEach(tag => tag.forEach(([h]) => { if (h === 'fcm') n++; }));
      (league.friendlies || []).forEach(f => { if (f.isHome) n++; });
    }
    try { HOME_MATCHDAYS_PER_SEASON = Math.max(1, n); } catch (e) { /* nur im Spiel vorhanden */ }
  }
  {
    const _orig = window.addNews;
    window.addNews = function (kat, titel) {
      // Meldungen aus abgeschalteten Systemen (Akademie, Europapokal, DFB-Pokal, Aufstieg)
      if (aktiv() && /Akademie|Jugendakademie|Nachwuchs rückt nach|Europapokal|DFB-POKAL|Pokal-Aus|Pokal: Weiter|Aufstiegspflicht/.test(String(titel || ''))) return;
      return _orig.apply(this, arguments);
    };
  }
  // Spielfreie Wochen (bisher im Europapokal-Modul): Vorbereitung KW1–5, Winterpause. Rückmeldung 17.10. (6): keine
  // Länderspielpausen mehr (18, 34, 42) – stattdessen 5 Bye Weeks je Team (DFLSaison.spielplan, 26 Spiele in 31 Wochen)
  window.BREAK_WEEKS = [1, 2, 3, 4, 5, 26, 27];
  window.isBreakWeek = function (week) { return window.BREAK_WEEKS.includes(week); };
  try { isBreakWeek = window.isBreakWeek; } catch (e) { /* nur im Spiel */ }

  // ── Bye Weeks im Spiel ───────────────────────────────────────────────────
  // Eine Woche ohne eigenes Spiel: die Runde läuft ohne dich (advanceMatchday ohne Ergebnis), sobald ihre Woche erreicht ist.
  // fcmNextFixture sucht über eine Bye-Runde hinweg das nächste eigene Spiel (vorher: Absturz bei fehlender Paarung).
  const eigenesPaar = (league, md) => {
    try { const fg = findFcmGroup(league), tag = (league.fixtures[fg.key] || [])[md]; return tag ? tag.find(([h, a]) => h === 'fcm' || a === 'fcm') || null : null; }
    catch (e) { return null; }
  };
  const istBye = (league, md) => {
    try { const fg = findFcmGroup(league), tag = (league.fixtures[fg.key] || [])[md]; return !!tag && !tag.some(([h, a]) => h === 'fcm' || a === 'fcm'); }
    catch (e) { return false; }
  };
  {
    const _orig = window.fcmNextFixture;
    if (typeof _orig === 'function') {
      window.fcmNextFixture = function (league) {
        if (!league || !league.dfl) return _orig.apply(this, arguments);
        const fg = findFcmGroup(league), plan = league.fixtures[fg.key] || [];
        for (let n = league.matchday; n < plan.length; n++) {
          const paar = eigenesPaar(league, n); if (!paar) continue;
          const isHome = paar[0] === 'fcm';
          return { opponentId: isHome ? paar[1] : paar[0], isHome, matchday: n + 1 };
        }
        return null;
      };
      try { fcmNextFixture = window.fcmNextFixture; } catch (e) { /* nur im Spiel */ }
    }
    const _due = window.matchdayDueThisWeek;
    if (typeof _due === 'function') {
      window.matchdayDueThisWeek = function (league) {
        const i = _due.apply(this, arguments);
        return league && league.dfl && i >= 0 && istBye(league, i) ? -1 : i;
      };
      try { matchdayDueThisWeek = window.matchdayDueThisWeek; } catch (e) { /* nur im Spiel */ }
    }
  }
  // Fällige Bye-Runden abarbeiten (Woche erreicht, eigenes Team spielfrei); Rückgabe: Anzahl
  function byesAbarbeiten() {
    if (!aktiv() || typeof LEAGUE === 'undefined' || !LEAGUE || !LEAGUE.dfl || !Array.isArray(LEAGUE.matchWeeks)) return 0;
    if (typeof seasonFullyComplete !== 'function' || typeof advanceMatchday !== 'function' || typeof findFcmGroup !== 'function') return 0;
    let n = 0;
    while (n < 3 && !seasonFullyComplete(LEAGUE) && LEAGUE.matchWeeks[LEAGUE.matchday] <= LEAGUE.week && istBye(LEAGUE, LEAGUE.matchday)) {
      const md = LEAGUE.matchday;
      advanceMatchday(LEAGUE, null);
      if (LEAGUE.matchday === md) break;
      n++;
      const nx = fcmNextFixture(LEAGUE), geg = nx ? (findFcmGroup(LEAGUE).group.teams.find(t => t.id === nx.opponentId) || {}).name : '';
      try {
        addNews('match', 'Bye Week – spielfrei', `Diese Woche spielt ${CLUB.shortName || CLUB.name} nicht. Zeit zum Durchatmen: Verletzte und müde Spieler holen auf.` +
          (geg ? ` Weiter geht es ${nx.isHome ? 'zu Hause gegen' : 'bei'} ${geg}.` : ''));
      } catch (e) { /* Meldung optional */ }
    }
    return n;
  }
  {
    const _orig = window.advanceCalendarWeek;
    if (typeof _orig === 'function') {
      window.advanceCalendarWeek = function () {
        const r = _orig.apply(this, arguments);
        try { if (r !== false && byesAbarbeiten() && typeof saveGameState === 'function') saveGameState(); } catch (e) { console.warn('[DFL-Liga] Bye Week', e); }
        return r;
      };
      try { advanceCalendarWeek = window.advanceCalendarWeek; } catch (e) { /* nur im Spiel */ }
    }
  }
  // Spielstand mitten in einer Bye-Woche geladen: Runde nachholen
  if (typeof setTimeout === 'function') setTimeout(() => { try { byesAbarbeiten(); } catch (e) { /* ohne Spielstand */ } }, 0);

  // ── Stadien (D37): mindestens 20.000 Plätze, echte Größe des Vereins ──────────
  // Die Stufenleiter beginnt bei 20.000. Der eigene Verein startet mit seiner echten
  // Größe aus data/league.json (mindestens 20.000); die Stufen darüber wachsen im selben
  // Verhältnis (CLUB.dfl.stadionFaktor). Kosten, Banden und Namensrechte hängen weiter an der Stufe.
  const STADION_MIN = 20000;
  const STADION_LEITER = (typeof FACILITY_DEFS !== 'undefined' && FACILITY_DEFS.stadium) ? FACILITY_DEFS.stadium.capacity.slice() : [];
  const plaetzeVon = f => Math.max(STADION_MIN, (f && f.anlagen && f.anlagen.stadion) || STADION_MIN);
  function stadionStufeFuer(plaetze) {
    let stufe = 1;
    STADION_LEITER.forEach((kap, i) => { if (kap <= plaetze) stufe = i + 1; });
    return stufe;
  }
  function stadionLeiter() {
    if (!STADION_LEITER.length || typeof FACILITY_DEFS === 'undefined') return;
    const faktor = (aktiv() && hatClub() && CLUB.dfl && CLUB.dfl.stadionFaktor) || 1;
    const d = FACILITY_DEFS.stadium;
    d.capacity = STADION_LEITER.map(k => Math.round(k * faktor / 100) * 100);
    d.levelDesc = d.capacity.map(k => k.toLocaleString('de-DE') + ' Plätze');
    if (aktiv() && hatClub() && CLUB.facilities) CLUB.stadiumCapacity = stadiumCapacityForLevel(CLUB.facilities.stadium || 1);
  }
  // Ältere Spielstände: Faktor nachtragen, Stufe nie kleiner als bisher
  function stadionNachtragen() {
    if (!aktiv() || !hatClub() || !CLUB.dfl || CLUB.dfl.stadionFaktor != null) return;
    const f = window.DFL_LIGA.franchises.find(x => x.id === CLUB.dfl.franchiseId);
    const plaetze = plaetzeVon(f), start = stadionStufeFuer(plaetze);
    CLUB.dfl.stadionFaktor = plaetze / STADION_LEITER[start - 1];
    CLUB.facilities.stadium = Math.max(start, CLUB.facilities.stadium || 1);
  }

  // Anlagen und Stadion aus data/league.json (D16)
  function anlagenSetzen(f) {
    const a = f.anlagen || {};
    CLUB.facilities = Object.assign({}, CLUB.facilities, { training: a.training || 5, scouting: a.scouting || 5 });
    delete CLUB.facilities.youth;
    const plaetze = plaetzeVon(f), stufe = stadionStufeFuer(plaetze);
    CLUB.dfl.stadionFaktor = plaetze / STADION_LEITER[stufe - 1];
    CLUB.facilities.stadium = stufe;
    // D53: Fanshop zum Start nach Vereinsgröße wie bei der KI (Bayern 8, Fulda 1)
    if (window.DFLFinanzen && DFLFinanzen.fanshopStart) CLUB.facilities.merchandising = DFLFinanzen.fanshopStart({ stadion: plaetze, training: CLUB.facilities.training, scouting: CLUB.facilities.scouting });
    stadionLeiter();
  }

  // ── Karrierestart ────────────────────────────────────────────────────────
  {
    const _orig = window.startNewGameState;
    window.startNewGameState = async function (chosen) {
      if (!startWahl) {
        if (hatClub() && CLUB.dfl) delete CLUB.dfl;     // alte DFL-Daten nicht in ein normales Spiel erben
        altsysteme(true);
        return _orig.apply(this, arguments);
      }
      altsysteme(false);
      const f = window.DFL_LIGA.franchises.find(x => x.id === startWahl.franchiseId);
      const t = liga().teams.find(x => x.id === f.id);
      const w = S.teamWerte(t);
      chosen = Object.assign({}, chosen, { name: f.name, shortName: f.kurzname || f.kurz, leagueName: GRUPPE, ovr: Math.round(w.ovr), dataClubId: null });
      const W = startWahl.wechsel || null;          // D143: Vereinswechsel (Saisonzähler und Karrierestart laufen weiter)
      CLUB.dfl = { aktiv: true, franchiseId: f.id, seed: startWahl.seed, saisonIndex: W ? W.saisonIndex : 0, start: W ? W.start : 2026 };
      try {
        await _orig.call(this, chosen);
      } finally {
        startWahl = null;
      }
      CLUB.dfl.aktiv = true;
      CLUB.shortName = f.kurzname || f.kurz;           // D57: Spitzname („Titans“), Kürzel bleibt f.kurz
      CLUB.leagueName = GRUPPE;
      try { FCM_GROUP_NAME = GRUPPE; } catch (e) { /* nur im Spiel vorhanden */ }
      anlagenSetzen(W ? Object.assign({}, f, { anlagen: Object.assign({}, f.anlagen, t.anlagen) }) : f);   // D143: Anlagen wie in der Welt
      altsysteme(false);
      CLUB.colors = { primary: f.farben[0], secondary: f.farben[1] };
      // Begrüßung passend zur DFL
      if (CLUB.news && CLUB.news.length) {
        const n = CLUB.news[CLUB.news.length - 1];
        n.title = `Willkommen bei ${f.name}!`;
        n.text = `Division ${f.division}, Conference ${KONF[f.conference]}. Im Juli 3 Testspiele, ab August 26 Spiele mit 5 spielfreien Wochen – hol den Titel nach ${f.city}!`;
      }
      if (typeof saveGameState === 'function') await saveGameState();
    };
  }

  // ── Vereinswahl: 32 Franchises statt alter Ligen ─────────────────────────
  // Der Wahl-Dialog des Spiels liegt in einer Funktion von app_main.js; wir ersetzen
  // seinen Inhalt, sobald er erscheint, und nutzen dann den vorhandenen Ablauf (_obTeam).
  function wahlHtml() {
    const fr = window.DFL_LIGA.franchises;
    const L = liga();
    const ovr = id => Math.round(S.teamWerte(L.teams.find(t => t.id === id)).ovr);
    // D113: große Bühne – Wappen in 96 px (Ring, Band und Mauerkrone zu sehen), Stadt und Spitzname darunter;
    // lange Städte dürfen in der Fuge umbrechen (<wbr> ändert den Text nicht, Tests suchen den Verein per textContent)
    const umbruch = c => c.length < 13 ? c : c.replace(/(gladbach|lautern|kirchen|brücken|schweig)$/, '<wbr>$1');
    const karte = f => `<button type="button" class="dfl-wahl-verein" data-dfl="${f.id}" style="--v1:${f.farben[0]}" title="${f.name}">
        <span class="dfl-wahl-wappen">${I ? I.wappenSvg(f, { groesse: 96 }) : ''}</span>
        <span class="dfl-wahl-name"><b>${umbruch(f.city)}</b> <small>${f.kurzname || ''}</small></span>
        <span class="dfl-wahl-ovr" title="Stärke der Startelf">${ovr(f.id)}</span></button>`;
    let html = '';
    for (const k of ['SUE_WEST', 'NORD_OST']) {
      html += `<div class="dfl-wahl-konf"><h3>Conference ${KONF[k]}</h3>`;
      [...new Set(fr.filter(f => f.conference === k).map(f => f.division))].forEach(d => {
        html += `<div class="dfl-wahl-div"><h4>${d}</h4>${fr.filter(f => f.division === d).map(karte).join('')}</div>`;
      });
      html += '</div>';
    }
    return `<div class="dfl-wahl">
      <div class="dfl-wahl-kopf"><div class="dfl-wahl-titel">Welche Franchise übernimmst du?</div>
        <div class="dfl-wahl-unter">32 Vereine · 8 Divisions · Cap 120 Mio € · Draft</div></div>
      <div class="dfl-wahl-raster">${html}</div>
      <div class="dfl-wahl-fuss">Zahl = Stärke der Startelf</div>
    </div>`;
  }
  function ersetzeWahl(overlay) {
    if (overlay.dataset.dflWahl) return;
    overlay.dataset.dflWahl = '1';
    overlay.innerHTML = wahlHtml();
    overlay.addEventListener('click', e => {
      const b = e.target.closest('[data-dfl]');
      if (!b) return;
      startWahl = { franchiseId: b.dataset.dfl, seed: (Date.now() % 2147483647) || 1 };
      ligaCache = null;
      const f = window.DFL_LIGA.franchises.find(x => x.id === b.dataset.dfl);
      window._obTeam(f.name, 75, null);
    });
  }
  function beobachteWahl() {
    const mo = new MutationObserver(() => {
      document.querySelectorAll('body > div').forEach(d => {
        if (!d.dataset.dflWahl && /Welchen Verein übernimmst du\?/.test(d.textContent || '')) ersetzeWahl(d);
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });
    pruefeWahl();
  }
  // Beim ersten Start steht der Dialog schon, bevor dieses Modul lädt → einmal direkt prüfen
  function pruefeWahl() {
    document.querySelectorAll('body > div').forEach(d => {
      if (!d.dataset.dflWahl && /Welchen Verein übernimmst du\?/.test(d.textContent || '')) ersetzeWahl(d);
    });
  }
  if (document.body) beobachteWahl(); else document.addEventListener('DOMContentLoaded', beobachteWahl);

  // ── Saisonende: Playoffs (14 Teams) statt Auf-/Abstieg ───────────────────
  // Die Playoffs laufen Woche für Woche in dfl_playoffs_patch.js (eigene Spiele mit der Engine);
  // ohne das Modul werden sie hier mit der Formel des Saisonlaufs simuliert (Verlängerung + Elfmeterschießen).
  function eigeneStaerke() {
    const elf = G.startelfVon(SQUAD.filter(p => !p.onLoanAt && !p.perspektiv).map(p => ({ pos: p.pos, ovr: p.ovr, def: p.def, mid: p.mid, att: p.att })));
    const m = k => elf.reduce((s, p) => s + p[k], 0) / Math.max(1, elf.length);
    return { ovr: m('ovr'), def: m('ovr'), mid: m('ovr'), att: m('ovr') };
  }
  function playoffsSpielen(league) {
    // Seit dfl_playoffs_patch.js: Playoffs laufen Woche für Woche, hier wird nur noch der Rest ausgespielt
    const live = window.DFLPlayoffs && window.DFLPlayoffs.abschluss(league);
    if (live) return live;
    const teams = dflTeams();
    const tabelle = {}, werte = {}, los = {};
    teams.forEach(t => {
      tabelle[t.id] = { id: t.id, pts: t.pts, gd: t.gf - t.ga, gf: t.gf };
      werte[t.id] = t.id === 'fcm' ? eigeneStaerke() : { def: t.def, mid: t.mid, att: t.att, ovr: (t.def + t.mid + t.att) / 3 };
      los[t.id] = Math.random();
    });
    const r = G.rngAus(((CLUB.dfl.seed || 1) * 97 + league.season) >>> 0);
    const po = S.playoffs({ teams }, { tabelle, werte, los }, r);
    const name = id => (teams.find(t => t.id === id) || {}).name || id;
    const RUNDE = { 1: 'Wildcard-Runde', 2: 'Divisional-Runde', 3: 'Conference-Finale', 4: 'Finale' };
    const log = po.runden.map(x => `${RUNDE[x.runde]}: ${name(x.heim)} – ${name(x.gast)} ${x.gh}:${x.ga}${x.art !== 'regulär' ? ' (' + x.art + ')' : ''} → ${name(x.sieger)}`);
    const fin = window.DFLHistorie ? window.DFLHistorie.finalort({ teams: window.DFL_LIGA.franchises.map(f => ({ id: f.id, city: f.city, anlagen: f.anlagen })) }, (CLUB.dfl.saisonIndex || 0)) : null;
    return { saison: league.season, meister: po.meister, finalist: po.finalist, log, finalort: fin && fin.stadt,
      setzliste: po.setzliste, eigeneRunde: po.ausgeschieden.fcm || 0,
      // für die Draft-Reihenfolge (Abschlusstabelle vor dem Zurücksetzen)
      tabelle, los, ausgeschieden: po.ausgeschieden };
  }
  {
    const _orig = window.runEndOfSeason;
    window.runEndOfSeason = function (league) {
      if (!league || !league.dfl) return _orig.apply(this, arguments);
      const po = playoffsSpielen(league);
      league.dflPlayoffs = po;
      (league.dflChronik = league.dflChronik || []).push({ saison: po.saison, meister: po.meister, finalist: po.finalist, finalort: po.finalort });
      const name = id => (dflTeams().find(t => t.id === id) || {}).name || id;
      const log = [`DKL-Meister: ${name(po.meister)} (Finale gegen ${name(po.finalist)}${po.finalort ? ' in ' + po.finalort : ''})`];
      const RUNDEN = ['die Playoffs verpasst', 'in der Wildcard-Runde ausgeschieden', 'in der Divisional-Runde ausgeschieden',
        'im Conference-Finale ausgeschieden', 'im Finale gescheitert', 'DKL-Meister geworden!'];
      log.push(`${CLUB.name}: ${RUNDEN[po.eigeneRunde]}`);
      try {
        addNews('season', po.meister === 'fcm' ? `🏆 ${CLUB.name} ist DKL-Meister!` : `🏆 ${name(po.meister)} ist DKL-Meister`,
          po.log.slice(-1)[0] + '. ' + (po.eigeneRunde ? `${CLUB.name} ist ${RUNDEN[po.eigeneRunde]}` : `${CLUB.name} hat die Playoffs verpasst.`));
      } catch (e) { /* Meldungen sind optional */ }
      // Neue Saison: kein Auf-/Abstieg, Tabellen zurücksetzen. Die Stärke der KI-Teams kommt aus ihren
      // Kadern in der Welt (Entwicklung, Draft, Free Agency – dfl_kader_patch.js)
      dflTeams().forEach(t => { t.pts = 0; t.played = 0; t.w = 0; t.d = 0; t.l = 0; t.gf = 0; t.ga = 0; t.form = []; });
      league.season++; league.matchday = 0; league.fixtures = {};
      league.week = 1; league.startYear = (league.startYear || 2026) + 1;
      CLUB.dfl.saisonIndex = (CLUB.dfl.saisonIndex || 0) + 1;
      generateAllFixtures(league);
      return { log, fcmWasChampion: po.meister === 'fcm', dfl: po };
    };
  }

  // ── Tabellen: Division, Conference, Playoff-Bild ─────────────────────────
  const dflTeams = () => LEAGUE.tiers[TIER].groups[0].teams;
  const sortiere = arr => arr.slice().sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || a.name.localeCompare(b.name));
  // Setzliste je Conference: 4 Division-Sieger (Seeds 1–4), dann 3 Wildcards (5–7) – Spec Abschnitt Playoffs
  function setzliste(konf) {
    const teams = dflTeams().filter(t => t.conference === konf);
    const divs = [...new Set(teams.map(t => t.division))];
    const sieger = sortiere(divs.map(d => sortiere(teams.filter(t => t.division === d))[0]));
    const rest = sortiere(teams.filter(t => sieger.indexOf(t) < 0));
    return { sieger, wild: rest.slice(0, 3), draussen: rest.slice(3) };
  }
  const zeile = (t, i, extra) => `<tr class="lg-clickrow ${t.id === 'fcm' ? 'fcm-row' : ''}" onclick="showTeamProfile('${t.id}')">
      <td class="lg-pos">${i}</td><td><span class="lg-club"><span class="lg-crest" style="${crestStyle(t.id)}">${crestInitials(t.name)}</span><span class="lg-name">${t.name}</span></span></td>
      <td class="num">${t.played}</td><td class="num">${t.w}-${t.d}-${t.l}</td><td class="num">${t.gf}:${t.ga}</td><td class="num">${t.gf - t.ga > 0 ? '+' : ''}${t.gf - t.ga}</td>
      <td class="num"><b>${t.pts}</b></td>${extra ? `<td>${extra}</td>` : ''}</tr>`;
  const kopf = extra => `<table class="lg-table dfl-tabelle"><thead><tr><th>#</th><th>Verein</th><th class="num">Sp</th><th class="num">S-U-N</th><th class="num">Tore</th><th class="num">Diff</th><th class="num">Pkt</th>${extra ? `<th>${extra}</th>` : ''}</tr></thead><tbody>`;
  function divisionTabelle(d) {
    return `<div class="dfl-div-tabelle"><div class="lg-header"><h3 style="font-size:13px;font-weight:800">Division ${d}</h3></div>` +
      kopf() + sortiere(dflTeams().filter(t => t.division === d)).map((t, i) => zeile(t, i + 1)).join('') + '</tbody></table></div>';
  }
  window.DFLTabellen = { division: d => divisionTabelle(d) };   // für die Conference-Umschaltung (dfl_simulieren_patch.js)
  function playoffBild(konf) {
    const s = setzliste(konf);
    const sieger = s.sieger.map((t, i) => zeile(t, i + 1, i === 0 ? 'Freilos' : 'Division-Sieger')).join('');
    const wild = s.wild.map((t, i) => zeile(t, i + 5, 'Wildcard')).join('');
    const jagd = s.draussen.slice(0, 4).map((t, i) => zeile(t, i + 8, '')).join('');
    return `<div class="dfl-div-tabelle"><div class="lg-header"><h3 style="font-size:13px;font-weight:800">Conference ${KONF[konf]} – Playoff-Bild</h3>
      <span style="font-size:10px;color:var(--text2)">7 von 16 kommen weiter</span></div>${kopf('Status')}${sieger}${wild}
      <tr><td colspan="8" style="font-size:10px;color:var(--text3);padding:4px 8px">— Playoff-Linie —</td></tr>${jagd}</tbody></table></div>`;
  }
  {
    const _orig = window.renderLgTabelle;
    window.renderLgTabelle = function () {
      if (!dflLiga()) return _orig.apply(this, arguments);
      const el = document.getElementById('lg-sub-tabelle'); if (!el) return;
      const eigen = dflTeams().find(t => t.id === 'fcm');
      el.innerHTML = `<div class="dfl-tabellen">${divisionTabelle(eigen.division)}${playoffBild(eigen.conference)}</div>`;
      reiterUmbenennen();
    };
  }
  {
    const _orig = window.renderLgPokal;
    window.renderLgPokal = function () {
      if (!dflLiga()) return _orig.apply(this, arguments);
      const el = document.getElementById('lg-sub-pokal'); if (!el) return;
      const po = LEAGUE.dflPlayoffs;
      const ergebnisse = po ? `<div class="dfl-div-tabelle"><div class="lg-header"><h3 style="font-size:13px;font-weight:800">Playoffs ${LEAGUE.season - (po.saison === LEAGUE.season ? 0 : 1) > 0 ? '' : ''}Saison ${po.saison}</h3></div>
        <div class="cup-log">${po.log.map(l => `<div>${l}</div>`).join('')}</div></div>` : '';
      el.innerHTML = `<div class="cup-status">14 Teams: je Conference 4 Division-Sieger + 3 Wildcards · Seed 1 mit Freilos · Finale am Finalort</div>
        <div class="dfl-tabellen">${ergebnisse}${playoffBild('SUE_WEST')}${playoffBild('NORD_OST')}</div>`;
    };
  }
  {
    const _orig = window.renderLgPyramide;
    window.renderLgPyramide = function () {
      if (!dflLiga()) return _orig.apply(this, arguments);
      const el = document.getElementById('lg-sub-pyramide'); if (!el) return;
      let html = '';
      for (const k of ['SUE_WEST', 'NORD_OST']) {
        html += `<div class="pyr-tier-title" style="margin:10px 0 4px;font-weight:800">Conference ${KONF[k]}</div><div class="dfl-tabellen">` +
          [...new Set(dflTeams().filter(t => t.conference === k).map(t => t.division))].map(divisionTabelle).join('') + '</div>';
      }
      el.innerHTML = html;
    };
  }
  // Der Liga-Browser (bundle_europa.js) zeichnet nach renderLeagueTab seine eigene Tabelle
  // über unsere – in der DFL danach wieder die Divisions-/Playoff-Ansicht zeigen.
  {
    const _orig = window.renderLeagueTab;
    if (typeof _orig === 'function') {
      window.renderLeagueTab = function () {
        const r = _orig.apply(this, arguments);
        if (dflLiga()) { try { window.renderLgTabelle(); } catch (e) { console.warn('[DFL-Liga] Tabelle', e); } }
        return r;
      };
      try { renderLeagueTab = window.renderLeagueTab; } catch (e) { /* globale Bindung */ }
    }
  }
  // Reiter umbenennen: Pokal → Playoffs, Pyramide → Divisionen
  function reiterUmbenennen() {
    if (!dflLiga()) return;
    document.querySelectorAll('.subtab').forEach(b => {
      const oc = b.getAttribute('onclick') || '';
      if (/'pokal'/.test(oc) && b.textContent !== 'Playoffs') b.textContent = 'Playoffs';
      if (/'pyramide'/.test(oc) && b.textContent !== 'Divisionen') b.textContent = 'Divisionen';
    });
  }

  // Anlagen-Texte passend zur DFL (Scouting = Draft-Genauigkeit statt Transfermarkt), kurz (Nutzer 2026-10-09: weniger Text)
  if (typeof FACILITY_DEFS !== 'undefined' && FACILITY_DEFS) {
    if (FACILITY_DEFS.scouting) FACILITY_DEFS.scouting.desc = 'Bessere Scouts schätzen Draft-Talente und fremde Spieler genauer ein.';
    if (FACILITY_DEFS.merchandising) FACILITY_DEFS.merchandising.desc = 'Fanshop und Vermarktung: mehr Einnahmen aus Trikots und Fanartikeln.';
  }

  {
    const _orig = window._afterLoad;
    if (typeof _orig === 'function') window._afterLoad = function () {
      ligaCache = null;                       // Welt aus dem geladenen Spielstand lesen
      if (aktiv()) { altsysteme(false); stadionNachtragen(); stadionLeiter(); heimspieleSetzen(typeof LEAGUE !== 'undefined' ? LEAGUE : null); staerkeAktualisieren(); }
      return _orig.apply(this, arguments);
    };
  }
  // Falls ein DFL-Spielstand schon vor diesem Modul geladen wurde: initGame (app_main.js) lädt mit
  // synchronem Speicher noch während des Skript-Ladens – die Wrapper oben greifen dann nicht.
  if (aktiv()) { altsysteme(false); stadionNachtragen(); stadionLeiter(); heimspieleSetzen(typeof LEAGUE !== 'undefined' ? LEAGUE : null); staerkeAktualisieren(); }

  // Spielstand: Welt vor jedem Speichern kompakt in LEAGUE.dflWelt ablegen
  {
    const _orig = window.saveGameState;
    if (typeof _orig === 'function') window.saveGameState = function () {
      if (aktiv() && ligaCache && dflLiga()) { try { LEAGUE.dflWelt = packeWelt(ligaCache, !!LEAGUE.dflVereinswechsel); } catch (e) { console.warn('[DFL-Liga] Welt nicht gespeichert', e); } }
      return _orig.apply(this, arguments);
    };
  }

  window.DFLSpiel = { aktiv, liga, franchise, spielId, dflIdVon, setzliste, zuSpielSpieler, technikVon, spielZuDfl, eigenSync, weltGeaendert,
    staerkeAktualisieren, packeWelt, entpackeWelt, trainerWerte, eigeneDflId: () => eigeneId(), KEY, KONF, eigeneStaerke,
    // D143: Vereinswechsel – nächster Karrierestart übernimmt Welt und laufende Saison ({ franchiseId, seed, welt, league, wechsel })
    wechselStart(w) { startWahl = w; ligaCache = null; },
    // Zeitmaschine (kickstil_zeitmaschine.js): Welt aus dem zurückgespielten LEAGUE.dflWelt neu lesen
    weltNeuLaden() { ligaCache = null; try { staerkeAktualisieren(); } catch (e) { console.warn('[DFL-Liga] Welt neu laden', e); } },
    welt() { eigenSync(); return liga(); },
    istBye: md => (typeof LEAGUE !== 'undefined' && LEAGUE ? istBye(LEAGUE, md) : false), byesAbarbeiten,
    // Teams (Welt-IDs), die in Runde md spielen – Bye-Teams bekommen weder Spielverletzungen noch Lernen
    spielendeTeams(league, md) {
      try { const fg = findFcmGroup(league), tag = (league.fixtures[fg.key] || [])[md] || []; return new Set(tag.flat().map(dflIdVon)); }
      catch (e) { return null; }
    } };
  console.log('%c[DFL-Liga v1] aktiv', 'color:#3fb950;font-weight:bold',
    '— 32 Franchises, eine Liga, Kader aus dem Generator, 26 Spiele in 31 Wochen (5 Bye Weeks je Team)');
})();
