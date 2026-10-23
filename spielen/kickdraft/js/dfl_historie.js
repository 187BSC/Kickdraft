/* ═══════════════════════════════════════════════════════════════════════════
   DFL-HISTORIE  ·  v1   (Liga-Gedächtnis nach Football GM, analyse-football-gm.md G5/G6)
   ─────────────────────────────────────────────────────────────────────────
     · Saisonstatistik je Spieler: Spiele, Tore, Vorlagen, Note (1,0–5,0),
       Saisonwert (wie „AV“ bei Football GM) – Tore werden aus den Teamtoren
       der Simulation auf die Spieler verteilt
     · Preise: Spieler der Saison, Torschützenkönig, Verteidiger der Saison,
       Rookie der Saison, Spieler der Finals, Manager der Saison, Elf der Saison
     · Meister, Finalist, Finalort (wechselt jedes Jahr, B4), Rekorde
     · Hall of Fame beim Karriereende: Karrierewert + (beste 5 Saisons − Abzug)
       über einer Schwelle je Position
     · Verwandte im Draft: Söhne früherer Spieler, Brüder aktiver Spieler
     · Power Rankings (Stärke + Tordifferenz + Form) und Playoff-Chancen
       (Hochrechnung der Restsaison)

   Eigener Zufall je Saison: der Saisonlauf bleibt bei gleichem Seed gleich.
   Braucht: dfl_liga_generator.js, dfl_saisonlauf.js. Im Spiel angeschlossen über dfl_ehrungen_patch.js.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const G = window.DFLGenerator, S = window.DFLSaison;
  if (!G || !S) { console.warn('[DFL-Historie] Generator/Saisonlauf fehlt'); return; }

  const CFG = {
    // Tore und Vorlagen der KI-Spiele wie in Engine v3 verteilt (D66 a, 2026-10-10): Gewicht je Position × (Angriff/75)³ bzw.
    // × (Mittelfeld/75)² × Spielanteil, angepasst an 1653 Tore und 1215 Vorlagen von KI-Elfen im 4-2-3-1 (so ist die
    // KI-Startelf der Welt zusammengesetzt) in 4092 Engine-Spielen. Engine: Mittelstürmer 39 %, Zehner 25 %, Außen 18 %,
    // Sechser 8 %, Innenverteidiger 4 %; Vorlagen vor allem aus der Tiefe (Sechser 28 %, Außenverteidiger 21 %, Außen 17 %),
    // 73 % der Tore mit Vorlage. Vorher ST 1,0 · FL 0,55 · OM 0,5 (Mittelstürmer 48 %) und Vorlagen OM 0,8 · FL 0,7.
    // D95: Schlüssel = Gruppe ohne Seite (DFLGenerator.grund: LV/RV → AV, LF/RF → FL, LM/RM → AM). LM/RM laufen in der Engine wie
    // bisher die Außenbahn im 4-2-3-1 (Rolle AM) – dieselben Gewichte wie die Flügel, ihr niedrigerer Angriffswert zählt über (att/75)³
    torGewicht:    { ST: 1.0, FL: 0.41, AM: 0.41, OM: 0.97, ZM: 0.4, ZDM: 0.37, AV: 0.08, IV: 0.38, TW: 0 },
    vorlageGewicht: { FL: 1.0, AM: 1.0, ZM: 0.95, ST: 0.95, AV: 0.85, ZDM: 0.8, OM: 0.6, IV: 0.43, TW: 0.01 },
    vorlageQuote: 0.73,
    // Hall of Fame: Karrierewert + (Summe der besten 5 Saisons − abzug) > Schwelle je Position
    // legende: wer je diese Stärke erreicht hat, kommt beim Karriereende immer hinein (Nutzer 2026-10-09: „99 … Hall of Fame“)
    hof: { abzug: 60, proBowl: 4, legende: 99, schwelle: { TW: 190, IV: 200, AV: 190, ZDM: 200, ZM: 205, AM: 210, OM: 215, FL: 220, ST: 230 } },
    vorherFaktor: 0.5,      // geschätzte Saisonwerte vor der DFL: (OVR − 68) × 0,5
    ehemaligeMax: 150,
    verwandte: { sohn: 0.02, bruder: 0.02, vaterMinAlter: 42 },
    finalortMinPlaetze: 40000
  };
  const PREISE = {
    spieler: 'Spieler der Saison', tore: 'Torschützenkönig', verteidiger: 'Verteidiger der Saison',
    rookie: 'Rookie der Saison', finals: 'Spieler der Finals', elf: 'Elf der Saison', manager: 'Manager der Saison'
  };
  const klemme = (x, a, b) => Math.max(a, Math.min(b, x));
  const name = p => (p.firstName ? p.firstName + ' ' : '') + p.name;
  function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  const zufall = (L, zusatz) => G.rngAus(hash(String(L.seed || 1) + '|' + L.saisonJahr + '|' + zusatz));
  function ziehe(r, liste, gewicht) {
    const summe = liste.reduce((s, x) => s + gewicht(x), 0);
    if (summe <= 0) return null;
    let x = r() * summe;
    for (const e of liste) { x -= gewicht(e); if (x <= 0) return e; }
    return liste[liste.length - 1];
  }
  function historie(L) {
    if (!L.historie) L.historie = { saisons: [], rekorde: {}, hallOfFame: [], ehemalige: [] };
    return L.historie;
  }
  function karriere(p) {
    if (!p.karriere) {
      // Spieler aus dem Startkader: Karriere vor der DFL grob schätzen (für Hall of Fame der ersten Jahre)
      const vorher = Math.max(0, Math.min(15, p.age - 20));
      const proSaison = Math.max(0, (p.ovr - 68) * CFG.vorherFaktor);
      p.karriere = { saisons: 0, spiele: 0, tore: 0, vorlagen: 0, titel: 0, preise: [], werte: [], vereine: [],
        vorher: p.rookieVertrag ? [] : Array.from({ length: vorher }, (_, i) => Math.round(proSaison * (0.6 + 0.4 * i / Math.max(1, vorher)))),
        peak: p.ovr };
    }
    return p.karriere;
  }

  // ── Finalort: wechselt jedes Jahr (B4) ───────────────────────────────────
  function finalort(L, index) {
    const orte = L.teams.filter(t => t.anlagen && t.anlagen.stadion >= CFG.finalortMinPlaetze)
      .sort((a, b) => a.id < b.id ? -1 : 1);
    const t = orte[(index || 0) % Math.max(1, orte.length)];
    return t ? { teamId: t.id, stadt: t.city, plaetze: t.anlagen.stadion } : null;
  }

  // ── Saisonstatistik ──────────────────────────────────────────────────────
  function statistik(L, saison) {
    const r = zufall(L, 'statistik');
    const tab = saison.tabelle;
    const platz = new Map(S.sortiereTabelle(Object.values(tab), saison.los).map((z, i) => [z.id, i + 1]));
    const erfolg = id => 1 - (platz.get(id) - 1) / 31;
    const alle = [];
    L.teams.forEach(t => {
      const elf = new Set(saison.werte[t.id].elf.map(p => p.id));
      const spieltag = new Set(t.roster.slice().sort((a, b) => b.ovr - a.ovr).slice(0, 18).map(p => p.id));
      const st = new Map();
      t.roster.forEach(p => st.set(p.id, {
        p, spiele: elf.has(p.id) ? Math.min(26, 20 + r.int(0, 6)) : spieltag.has(p.id) ? r.int(6, 18) : r.int(0, 4), tore: 0, vorlagen: 0
      }));
      const liste = [...st.values()];
      // Im Spiel (dfl_statistik_patch.js): echte Tore/Vorlagen/Einsätze der eigenen Spieler und die laufend verteilten
      // Tore der KI-Spieler – Torjägerliste, Preise und Karrieren zeigen dann dieselben Zahlen (Prüfung 2026-10-09).
      // Map Spieler-ID → { tore, vorlagen, spiele }; .komplett: Einsätze seit Spieltag 1 mitgezählt
      const vorgabe = typeof CFG.vorgabe === 'function' ? CFG.vorgabe(L, t, tab[t.id]) : null;
      if (vorgabe) {
        liste.forEach(x => {
          const v = vorgabe.get(x.p.id);
          if (!v) { if (vorgabe.komplett) x.spiele = 0; return; }
          x.tore = v.tore || 0; x.vorlagen = v.vorlagen || 0;
          if (vorgabe.komplett && v.spiele != null) x.spiele = Math.min(26, v.spiele);
        });
      }
      for (let i = 0; !vorgabe && i < tab[t.id].gf; i++) {
        const sch = ziehe(r, liste, x => x.spiele * (CFG.torGewicht[G.grund(x.p.pos)] || 0) * Math.pow((x.p.att || x.p.ovr) / 75, 3));
        if (!sch) continue;
        sch.tore++;
        if (r() < CFG.vorlageQuote) {
          const vor = ziehe(r, liste.filter(x => x !== sch), x => x.spiele * (CFG.vorlageGewicht[G.grund(x.p.pos)] || 0) * Math.pow((x.p.mid || x.p.ovr) / 75, 2));
          if (vor) vor.vorlagen++;
        }
      }
      const gegentore = tab[t.id].ga / 26;
      liste.forEach(x => {
        const p = x.p, def = ['TW', 'IV', 'AV', 'ZDM'].indexOf(G.grund(p.pos)) >= 0;
        let note = null, wert = 0;
        if (x.spiele >= 5) {
          note = 4.7 - (p.ovr - 65) * 0.055 - (erfolg(t.id) - 0.5) * 0.5 - x.tore * 0.02 - x.vorlagen * 0.025
            - (def ? (1.3 - gegentore) * 0.3 : 0) + r.normal(0, 0.12);
          note = Math.round(klemme(note, 1.0, 5.0) * 100) / 100;
          wert = Math.max(0, 4.6 - note) * 6 + x.tore * 0.3 + x.vorlagen * 0.25 + x.spiele / 26 * 3;
        }
        p.saison = { jahr: L.saisonJahr, teamId: t.id, spiele: x.spiele, tore: x.tore, vorlagen: x.vorlagen, note, wert: Math.round(wert * 10) / 10 };
        const k = karriere(p);
        k.saisons++; k.spiele += x.spiele; k.tore += x.tore; k.vorlagen += x.vorlagen; k.werte.push(p.saison.wert);
        k.peak = Math.max(k.peak, p.ovr);
        if (k.vereine[k.vereine.length - 1] !== t.id) k.vereine.push(t.id);
        alle.push({ p, t, s: p.saison, erfolg: erfolg(t.id) });
      });
    });
    return { alle, platz };
  }

  // ── Preise ───────────────────────────────────────────────────────────────
  function preise(L, saison, po, stat) {
    const k = stat.alle.filter(x => x.s.note != null && x.s.spiele >= 13);
    const best = (liste, f) => liste.slice().sort((a, b) => f(b) - f(a))[0];
    const eintrag = x => x && { id: x.p.id, name: name(x.p), pos: x.p.pos, teamId: x.t.id, tore: x.s.tore, vorlagen: x.s.vorlagen, note: x.s.note };
    const r = {};
    // Spieler der Saison: vor allem die Note, Tore nur leicht (sonst gewinnen immer Stürmer)
    r.spieler = eintrag(best(k, x => (4.6 - x.s.note) * 6 + x.s.tore * 0.12 + x.s.vorlagen * 0.12 + x.erfolg * 4));
    r.tore = eintrag(best(k, x => x.s.tore * 100 - x.s.spiele + (5 - x.s.note)));
    // Verteidiger der Saison: Note im Vergleich zur eigenen Position – roh gewannen Außenverteidiger (mehr Vorlagen)
    // 58 % und Innenverteidiger nur 5 % (Langzeitlauf 2026-10-09)
    // D95: je Gruppe ohne Seite (LV und RV zusammen)
    const abwehr = k.filter(x => ['TW', 'IV', 'AV', 'ZDM'].indexOf(G.grund(x.p.pos)) >= 0), posSchnitt = {};
    abwehr.forEach(x => { const a = posSchnitt[G.grund(x.p.pos)] = posSchnitt[G.grund(x.p.pos)] || [0, 0]; a[0] += x.s.note; a[1]++; });
    r.verteidiger = eintrag(best(abwehr, x => posSchnitt[G.grund(x.p.pos)][0] / posSchnitt[G.grund(x.p.pos)][1] - x.s.note + x.erfolg * 0.3));
    r.rookie = eintrag(best(stat.alle.filter(x => x.p.rookieVertrag && x.p.rookieVertrag.jahr === L.saisonJahr && x.s.note != null), x => x.s.wert));
    r.finals = po ? eintrag(best(k.filter(x => x.t.id === po.meister), x => x.s.wert)) : null;
    // Elf der Saison: beste Note je Startelf-Position
    r.elf = [];
    for (const [pos, n] of Object.entries(G.CFG.startelf)) {
      k.filter(x => x.p.pos === pos).sort((a, b) => a.s.note - b.s.note).slice(0, n).forEach(x => r.elf.push(eintrag(x)));
    }
    // Manager der Saison: größter Sprung gegenüber der Vorhersage (Stärke-Rang)
    const rang = new Map(L.teams.slice().sort((a, b) => saison.werte[b.id].ovr - saison.werte[a.id].ovr).map((t, i) => [t.id, i + 1]));
    const m = L.teams.slice().sort((a, b) => (rang.get(b.id) - stat.platz.get(b.id)) - (rang.get(a.id) - stat.platz.get(a.id)))[0];
    r.manager = { teamId: m.id, erwartet: rang.get(m.id), platz: stat.platz.get(m.id) };
    // in die Karrieren eintragen
    const byId = new Map(stat.alle.map(x => [x.p.id, x.p]));
    ['spieler', 'tore', 'verteidiger', 'rookie', 'finals'].forEach(key => { if (r[key]) karriere(byId.get(r[key].id)).preise.push({ jahr: L.saisonJahr, key }); });
    r.elf.forEach(e => karriere(byId.get(e.id)).preise.push({ jahr: L.saisonJahr, key: 'elf' }));
    return r;
  }

  // ── Rekorde ──────────────────────────────────────────────────────────────
  function rekorde(L, saison, stat) {
    const R = historie(L).rekorde, neu = [];
    const setze = (key, wert, info, text) => {
      if (!R[key] || wert > R[key].wert) { if (R[key]) neu.push(text); R[key] = Object.assign({ wert, jahr: L.saisonJahr }, info); }
    };
    const tab = Object.values(saison.tabelle);
    const topP = tab.slice().sort((a, b) => b.pts - a.pts)[0];
    setze('punkteSaison', topP.pts, { teamId: topP.id }, `Punkterekord: ${topP.pts} Punkte`);
    const topT = stat.alle.slice().sort((a, b) => b.s.tore - a.s.tore)[0];
    setze('toreSaison', topT.s.tore, { id: topT.p.id, name: name(topT.p), teamId: topT.t.id }, `Torrekord: ${name(topT.p)} mit ${topT.s.tore} Toren`);
    const topK = stat.alle.slice().sort((a, b) => b.p.karriere.tore - a.p.karriere.tore)[0];
    setze('karriereTore', topK.p.karriere.tore, { id: topK.p.id, name: name(topK.p) }, `Ewige Torjägerliste: ${name(topK.p)} an der Spitze`);
    let hoch = null;
    (saison.ergebnisse || []).forEach((tag, i) => tag.forEach(([h, g, gh, ga]) => {
      const d = Math.abs(gh - ga);
      if (!hoch || d > hoch.d || (d === hoch.d && gh + ga > hoch.gh + hoch.ga)) hoch = { d, h, g, gh, ga, spieltag: i + 1 };
    }));
    if (hoch) setze('hoechsterSieg', hoch.d * 100 + hoch.gh + hoch.ga, { heim: hoch.h, gast: hoch.g, gh: hoch.gh, ga: hoch.ga, spieltag: hoch.spieltag },
      `Höchster Sieg der Ligageschichte: ${hoch.gh}:${hoch.ga}`);
    return neu;
  }

  // ── Nach der Saison (vor dem Saisonwechsel) ──────────────────────────────
  function erfasseSaison(L, saison, po) {
    const H = historie(L);
    const stat = statistik(L, saison);
    const pr = preise(L, saison, po, stat);
    if (po) L.teams.find(t => t.id === po.meister).roster.forEach(p => { if (p.saison && p.saison.spiele > 0) karriere(p).titel++; });
    const fin = po ? po.runden.find(x => x.runde === 4) : null;
    const eintrag = {
      jahr: L.saisonJahr, meister: po && po.meister, finalist: po && po.finalist,
      // Finale aus Sicht des Meisters (toreMeister:toreFinalist)
      finale: fin ? { heim: fin.heim, gast: fin.gast, gh: fin.gh, ga: fin.ga, art: fin.art,
        ergebnis: fin.sieger === fin.heim ? fin.gh + ':' + fin.ga : fin.ga + ':' + fin.gh } : null,
      finalort: finalort(L, H.saisons.length), preise: pr,
      platz: Object.fromEntries(stat.platz), punkte: Object.fromEntries(Object.values(saison.tabelle).map(z => [z.id, z.pts])),
      rekorde: rekorde(L, saison, stat)
    };
    H.saisons.push(eintrag);
    return eintrag;
  }

  // ── Hall of Fame ─────────────────────────────────────────────────────────
  function hofPunkte(p) {
    const k = karriere(p);
    const werte = k.vorher.concat(k.werte);
    const summe = werte.reduce((s, x) => s + x, 0);
    const beste = werte.slice().sort((a, b) => b - a).slice(0, 5).reduce((s, x) => s + x, 0);
    const preisBonus = k.preise.reduce((s, x) => s + ({ spieler: 20, finals: 8, tore: 10, verteidiger: 10, rookie: 4, elf: 5 }[x.key] || 0), 0);
    return Math.round(summe + Math.max(0, beste - CFG.hof.abzug) + preisBonus + k.titel * 6 + (k.proBowls || 0) * CFG.hof.proBowl);
  }
  // opt.ohneVerwandte: nur Hall of Fame prüfen (Vereinslose, die vor der Saison aus dem Markt fallen – der Jahrgang ist schon vergeben)
  function nachWechsel(L, st, opt) {
    const H = historie(L);
    const r = zufall(L, 'wechsel');
    ((st && st.ruhestandListe) || []).forEach(p => {
      const k = karriere(p), punkte = hofPunkte(p), schwelle = CFG.hof.schwelle[G.grund(p.pos)] || 170;
      const info = { id: p.id, name: name(p), firstName: p.firstName, nachname: p.name, pos: p.pos, alter: p.age, jahr: L.saisonJahr, seed: p.seed,
        punkte, schwelle, tore: k.tore, titel: k.titel, proBowls: k.proBowls || 0, saisons: k.saisons + k.vorher.length, geschaetzt: k.vorher.length > 0, teamId: p._exVerein || null, peak: k.peak,
        preise: k.preise.length, vereine: k.vereine.slice(), heimat: p.heimat };
      if (k.peak >= CFG.hof.legende) info.legende = true;
      if (punkte >= schwelle || info.legende) { info.hof = true; H.hallOfFame.push(info); }
      if (punkte >= schwelle * 0.5) H.ehemalige.push(info);           // für „Sohn von …“
      if (H.ehemalige.length > CFG.ehemaligeMax) H.ehemalige.sort((a, b) => b.punkte / b.schwelle - a.punkte / a.schwelle).length = CFG.ehemaligeMax;
    });
    // Verwandte im neuen Draft-Jahrgang (Football GM: je 2 % Sohn bzw. Bruder)
    if (L.draft && !(opt && opt.ohneVerwandte)) verwandte(L, r);
  }
  function verwandte(L, r) {
    const H = historie(L), V = CFG.verwandte;
    const aktive = [].concat(...L.teams.map(t => t.roster));
    L.draft.talente.forEach(tal => {
      if (tal.verwandt) return;
      const vaeter = H.ehemalige.filter(e => e.alter + (L.saisonJahr - e.jahr) - tal.age >= 21 && e.alter + (L.saisonJahr - e.jahr) >= V.vaterMinAlter);
      if (vaeter.length && r() < V.sohn) {
        const v = ziehe(r, vaeter, e => e.punkte * (e.hof ? 2 : 1));
        tal.name = v.nachname; tal.verwandt = { art: 'Sohn', id: v.id, name: v.name, hof: !!v.hof };
        if (v.heimat) tal.heimat = v.heimat;
        return;
      }
      if (r() < V.bruder) {
        const b = r.pick(aktive.filter(p => Math.abs(p.age - tal.age) <= 8 && p.age >= tal.age));
        if (!b) return;
        tal.name = b.name; tal.heimat = b.heimat; tal.verwandt = { art: 'Bruder', id: b.id, name: name(b), teamId: b.teamId };
        b.verwandt = b.verwandt || { art: 'Bruder', id: tal.id, name: name(tal) };
      }
    });
  }

  // ── Power Rankings & Playoff-Chancen ─────────────────────────────────────
  function tabelleBis(L, saison, bisTag) {
    const t = {};
    L.teams.forEach(x => { t[x.id] = { id: x.id, pts: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, form: [] }; });
    (saison.ergebnisse || []).slice(0, bisTag).forEach(tag => tag.forEach(([h, g, gh, ga]) => {
      const H = t[h], A = t[g];
      H.gf += gh; H.ga += ga; A.gf += ga; A.ga += gh;
      if (gh > ga) { H.pts += 3; H.w++; A.l++; H.form.push('S'); A.form.push('N'); }
      else if (gh < ga) { A.pts += 3; A.w++; H.l++; H.form.push('N'); A.form.push('S'); }
      else { H.pts++; A.pts++; H.d++; A.d++; H.form.push('U'); A.form.push('U'); }
    }));
    Object.values(t).forEach(z => { z.gd = z.gf - z.ga; });
    return t;
  }
  function powerRanking(L, saison, bisTag) {
    const rechne = tag => {
      const tab = tabelleBis(L, saison, tag);
      return L.teams.map(t => {
        const z = tab[t.id], w = saison.werte[t.id], sp = z.w + z.d + z.l;
        const form = z.form.slice(-5), formPkt = form.reduce((s, x) => s + (x === 'S' ? 3 : x === 'U' ? 1 : 0), 0);
        const score = (sp ? z.gd / sp * (sp / 26) * 10 : 0) + (0.6 * w.ovr - 45) + (form.length ? (formPkt - 1.4 * form.length) * 0.6 : 0);
        return { team: t, score: Math.round(score * 10) / 10, bilanz: z, form: form.join(''), def: w.def, mid: w.mid, att: w.att, ovr: w.ovr };
      }).sort((a, b) => b.score - a.score);
    };
    const jetzt = rechne(bisTag), vorher = bisTag > 0 ? rechne(bisTag - 1) : jetzt;
    const alt = new Map(vorher.map((x, i) => [x.team.id, i + 1]));
    return jetzt.map((x, i) => Object.assign(x, { rang: i + 1, trend: alt.get(x.team.id) - (i + 1) }));
  }
  function poisson(r, lambda) {
    const grenze = Math.exp(-lambda); let k = 0, p = 1;
    do { k++; p *= r(); } while (p > grenze);
    return k - 1;
  }
  function playoffChancen(L, saison, bisTag, n) {
    n = n || 400;
    const r = zufall(L, 'chancen' + bisTag);
    const basis = tabelleBis(L, saison, bisTag);
    const byId = new Map(L.teams.map(t => [t.id, t]));
    const zaehl = {}; L.teams.forEach(t => { zaehl[t.id] = { playoffs: 0, division: 0, freilos: 0 }; });
    const rest = (saison.plan || []).slice(bisTag);
    for (let i = 0; i < n; i++) {
      const t = {};
      for (const id in basis) t[id] = { id, pts: basis[id].pts, gd: basis[id].gd, gf: basis[id].gf };
      rest.forEach(tag => tag.forEach(([h, g]) => {
        const [lh, la] = S.toreErwartet(saison.werte[h], saison.werte[g], S.CFG.heimvorteil);
        const gh = poisson(r, lh), ga = poisson(r, la);
        t[h].gf += gh; t[g].gf += ga; t[h].gd += gh - ga; t[g].gd += ga - gh;
        if (gh > ga) t[h].pts += 3; else if (gh < ga) t[g].pts += 3; else { t[h].pts++; t[g].pts++; }
      }));
      for (const konf of ['SUE_WEST', 'NORD_OST']) {
        const zeilen = Object.values(t).filter(z => byId.get(z.id).conference === konf);
        const divs = [...new Set(zeilen.map(z => byId.get(z.id).division))];
        const sieger = divs.map(d => S.sortiereTabelle(zeilen.filter(z => byId.get(z.id).division === d), saison.los)[0]);
        const siegerSort = S.sortiereTabelle(sieger, saison.los);
        const wild = S.sortiereTabelle(zeilen.filter(z => sieger.indexOf(z) < 0), saison.los).slice(0, 3);
        sieger.forEach(z => { zaehl[z.id].division++; zaehl[z.id].playoffs++; });
        wild.forEach(z => { zaehl[z.id].playoffs++; });
        zaehl[siegerSort[0].id].freilos++;
      }
    }
    const aus = {};
    for (const id in zaehl) aus[id] = { playoffs: zaehl[id].playoffs / n, division: zaehl[id].division / n, freilos: zaehl[id].freilos / n };
    return aus;
  }

  // ── Langzeitlauf mit Gedächtnis (und Stimmung, falls geladen) ────────────
  function langzeitlauf(liga, opt) {
    opt = Object.assign({}, opt);
    const M = window.DFLStimmung;
    const nachSaison = opt.nachSaison, nachW = opt.nachWechsel;
    opt.nachSaison = (L, saison, po) => {
      if (M) M.nachSaison(L, saison, po);
      erfasseSaison(L, saison, po);
      L._letzteSaison = saison; L._letztePlayoffs = po;
      if (nachSaison) nachSaison(L, saison, po);
    };
    opt.nachWechsel = (L, st) => {
      if (M) M.nachWechsel(L, st);
      nachWechsel(L, st);
      if (nachW) nachW(L, st);
    };
    return S.langzeitlauf(liga, opt);
  }

  window.DFLHistorie = { CFG, PREISE, erfasseSaison, nachWechsel, hofPunkte, karriere, finalort, statistik,
    powerRanking, playoffChancen, tabelleBis, langzeitlauf };
  console.log('%c[DFL-Historie v1] aktiv', 'color:#3fb950;font-weight:bold',
    '— Saisonstatistik, Preise, Rekorde, Hall of Fame, Verwandte, Power Rankings, Playoff-Chancen');
})();
