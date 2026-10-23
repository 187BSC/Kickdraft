/* ═══════════════════════════════════════════════════════════════════════════
   DFL-TRAINERTEAM  ·  v1  (D118, freigegeben 2026-10-13)
   ─────────────────────────────────────────────────────────────────────────
   Welt-Logik ohne DOM (läuft im Spiel und im Langzeitlauf): alle 32 Vereine
   haben ein Trainerteam mit vier Rollen (1–5 Sterne), die KI-Vereine dazu
   einen Chefcoach. Gehalt je Saison 0,4 / 0,8 / 1,4 / 2,2 / 3,4 Mio € ×
   Preisindex, nicht gegen den Cap (Kosten wie der Betrieb: DFLFinanzen.kosten).

   Wirkung je Stern (Nutzer 2026-10-13, Vorschau „DFL Trainerteam“):
     · Co-Trainer: Eingewöhnung in den Stil +1 Punkt je Spiel (zu 12), Entwicklung +1 %
     · Athletik & Physio: Verletzungsrisiko −2 % (mit Medizin höchstens −35 %), Reha +3 %, Fitness-Erholung +2 %
     · Sportpsychologe: Moralverlust nach Niederlagen −6 %, Wechselwunsch 0,1 später, Elfmeter im Schießen +1 Punkt,
       je Saison eine kleine Chance, bei einem Spieler eine gute Eigenschaft zu wecken oder eine schlechte abzubauen
     · Standardtrainer: Tore nach Standards +2 %, Gegentore nach Standards −1,5 % (Engine: Faktor auf Abschlüsse aus
       Standards; Formel: Anteil der Standardtore an allen Toren, gemessen in Engine v3)
     · Chefcoach (nur KI): Eingewöhnung/Entwicklung je Stern über bzw. unter 3 je ½ Punkt bzw. ½ %
   Markt: Kandidaten nach dem Draft und in der Winterpause; Verträge 1–3 Jahre; reichere Vereine werben gute
   Trainer im letzten Vertragsjahr ab; Trainer entwickeln sich (Erfahrung, Erfolg), Ältere gehen in Rente; ein
   5-Sterne-Co-Trainer kann bei einem KI-Verein Chefcoach werden; Ex-Spieler der Hall of Fame selten als Kandidaten.
   Zustand: t.trainer = { co, physio, psycho, standard, chef } (Weltspeicher: Team-Felder werden mitgepackt),
   L.trainer = { nr, markt: [...] } (dfl_liga_patch.js packt es), t._trainerExtra (Abfindungen/halbe Saisons).
   API: window.DFLTrainer (siehe unten). Ereignisse für den eigenen Verein über DFLTrainer.melde(ev) (setzt das Spiel).

   D128 (Nutzer 2026-10-13: „… wir haben unsere Zielwerte, also werden auch die Trainer schlechter, wenn man runtergeht“):
   Die KI besetzt ihr Trainerteam nach dem Zielwert (D42) statt nach dem Eigentümer-Profil allein – Ziel 72 … 95 ≈ 1,75 … 4,05
   Sterne, dazu ein kleiner Vorteil für große Stadien (bis +0,1) und das Profil (±0,25); knappe Kasse erst unter 15 % −0,5. Steigt das Ziel, ersetzt der Verein
   zum Saisonende klar zu schwache Trainer (Abfindung wie immer eine Saison); sinkt es, verlängert er nur noch günstigere.
   Abwerben und Chefcoach-Aufstieg nur, wo der Trainer zum Anspruch passt. Messschalter CFG.zielwert.aktiv = false = wie D118.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const G = window.DFLGenerator;
  if (!G) { console.warn('[DFL-Trainer] DFLGenerator fehlt'); return; }

  const CFG = {
    aktiv: true,
    rollen: ['co', 'physio', 'psycho', 'standard'],
    rollenExtra: ['scout'],                                      // D120: Chefscout (steht im Scouting, gehört zum Trainerteam)
    gehalt: [0, 400000, 800000, 1400000, 2200000, 3400000],      // je Saison bei Preisindex 1
    ziel: { investor: 3.8, maezen: 3.3, tradition: 2.8 },        // Ø Sterne nach Eigentümer-Profil
    sparZiel: 1.6,                                              // leere Kasse: zuerst am Trainerteam sparen
    streuung: 0.9,
    wirkung: {
      co: { eing: 0.01, entw: 0.01 },
      physio: { risiko: 0.02, reha: 0.03, fitness: 0.02 },
      psycho: { moral: 0.06, weg: 0.1, elfer: 0.01, eigenschaft: 0.05 },
      standard: { tor: 0.02, gegen: 0.015 },
      chef: { eing: 0.005, entw: 0.005, mitte: 3 }
    },
    medDeckel: 0.35,            // Medizin + Physio zusammen höchstens −35 % Verletzungsrisiko
    standardAnteil: 0.10,       // Anteil der Tore aus Ecken/Freistößen in Engine v3 (gemessen 2026-10-13: 9,5–10 %)
    vertrag: [1, 3],
    markt: { jeRolle: 6, max: 10 },
    verteilung: [0.24, 0.31, 0.25, 0.13, 0.07],                  // Sterne 1–5 neuer Kandidaten
    alter: [33, 62],
    rente: [[63, 0.12], [65, 0.25], [67, 0.45], [69, 0.7], [71, 1]],
    entwicklung: { basis: 0.05, erfolg: 0.08, jungBis: 46, jung: 0.04, altAb: 60, abbau: 0.15 },
    knapp: 0.25, knappAbzug: 0.8,          // Kasse unter 25 % der Einnahmen: Ziel −0,8 Sterne (vor dem Sparmodus)
    // D128: Sterne der KI nach Zielwert – mitte + je × (Ziel − basis) + Stadion-Vorteil + Profil-Anteil, geklemmt auf min … max.
    // Ziel 72 → 1,75, 83,5 → 2,9, 95 → 4,05 Sterne (vorher nach Profil 2,8 / 3,3 / 3,8 – Budget sinkt leicht).
    // groesse: Stadion 20.000 → −0,05, ab 80.000 → +0,1 (große Stadien zielen schon höher, DFLSaison.zielPruefen);
    // profil: (Profil-Ziel − 3,3) × 0,5 = ±0,25.
    // knapp/knappAbzug: mit Zielwert erst unter 15 % der Einnahmen −0,5 Sterne (wer aufholt, steckt sein Geld in Anlagen).
    // wechsel: steigt das Ziel, gehen zum Saisonende Trainer, die ≥ 1,5 Sterne unter dem neuen Anspruch liegen (nicht im Sparmodus)
    zielwert: { aktiv: true, basis: 83.5, mitte: 2.9, je: 0.1, groesse: 0.2, profil: 0.5, profilMitte: 3.3, min: 1.3, max: 4.6,
      knapp: 0.15, knappAbzug: 0.5, wechsel: 1.5, abwerbenPlus: 1, chefAb: 2.8 },
    verlaengern: 0.7,
    abwerben: { an: true, ab: 4, chance: 0.35, kasseVor: 1.15 },
    chefcoach: { chance: 0.5, schwachBis: 2 },
    hof: { chance: 0.2, nachJahren: 1 },
    eigenschaften: { plus: ['nervenstark', 'mentalitaet', 'konstant', 'fuehrungsspieler', 'vorbildprofi'],
      minus: ['launisch', 'diva', 'hitzkopf', 'trainingsfaul', 'wechselfreudig', 'geldgierig'] }
  };
  const ROLLE = {
    co: { name: 'Co-Trainer', kurz: 'CT' }, physio: { name: 'Athletik & Physio', kurz: 'AP' },
    psycho: { name: 'Sportpsychologe', kurz: 'SP' }, standard: { name: 'Standardtrainer', kurz: 'ST' },
    chef: { name: 'Chefcoach', kurz: 'CC' }, scout: { name: 'Chefscout', kurz: 'CS' }
  };
  const SPEZ = { standard: ['Ecken', 'Freistöße', 'Kopfbälle'], physio: ['Athletik', 'Reha', 'Ernährung'], co: ['Taktik', 'Training', 'Videoanalyse'],
    psycho: ['Mentaltraining', 'Teamgeist', 'Druck'], chef: ['Pressing', 'Ballbesitz', 'Konter'], scout: ['Draft', 'Liga', 'Ausland'] };

  const klemme = (x, a, b) => Math.max(a, Math.min(b, x));
  let eigenId = null;                     // eigener Verein (setzt das Spiel); im Langzeitlauf null
  let melder = null;                      // Ereignisse für den eigenen Verein
  const melde = ev => { if (melder && ev && ev.team === eigenId) { try { melder(ev); } catch (e) { /* Meldung optional */ } } };

  const preisIndex = L => ((L && L.cap) || 120000000) / 120000000;
  const gehaltFuer = (sterne, L) => Math.round(CFG.gehalt[klemme(Math.round(sterne), 1, 5)] * preisIndex(L) / 10000) * 10000;
  const voll = p => p ? (p.firstName + ' ' + p.name) : '';
  const rngVon = (L, salz) => G.rngAus(((G.hashText(String(salz)) ^ ((L && L.seed) >>> 0) ^ (((L && L.saisonJahr) || 0) * 7919)) >>> 0) || 1);

  // ── Zustand ──────────────────────────────────────────────────────────────
  function welt(L) {
    if (!L.trainer) L.trainer = { nr: 0, markt: [], hof: [] };
    if (!L.trainer.markt) L.trainer.markt = [];
    if (!L.trainer.hof) L.trainer.hof = [];
    return L.trainer;
  }
  function name(r) {
    const gr = G.GRUPPEN || [];
    if (!gr.length) return { firstName: 'Max', name: 'Trainer' };
    let u = r(), g = gr[gr.length - 1];
    for (const x of gr) { if (u < x.anteil) { g = x; break; } u -= x.anteil; }
    return { firstName: g.vor[Math.floor(r() * g.vor.length)], name: g.nach[Math.floor(r() * g.nach.length)] };
  }
  function zieheSterne(r) {
    let u = r();
    for (let i = 0; i < 5; i++) { if (u < CFG.verteilung[i]) return i + 1; u -= CFG.verteilung[i]; }
    return 3;
  }
  function neuePerson(L, r, rolle, sterne, opt) {
    opt = opt || {};
    const W = welt(L), n = opt.name || name(r);
    const alter = opt.alter || (CFG.alter[0] + Math.floor(r() * (CFG.alter[1] - CFG.alter[0] + 1)) - (sterne >= 4 ? 0 : 3));
    const sp = SPEZ[rolle] || [];
    const p = { id: 'tr' + (++W.nr), firstName: n.firstName, name: n.name, rolle, sterne: klemme(Math.round(sterne), 1, 5),
      alter: klemme(alter, 30, 70), xp: Math.max(0, Math.floor(r() * 6) + (sterne - 2)), seed: Math.floor(r() * 4294967295) + 1,
      bis: null, gehalt: 0 };
    if (sp.length) p.spez = sp[Math.floor(r() * sp.length)];
    if (opt.ex) p.ex = opt.ex;
    return p;
  }
  function vertragGeben(L, p, jahre) {
    p.bis = (L.saisonJahr || 0) + Math.max(1, jahre) - 1;          // letzte Saison einschließlich
    p.gehalt = gehaltFuer(p.sterne, L);
    p.seit = L.saisonJahr || 0;
    return p;
  }
  const profilVon = (t, opt) => (opt && opt.profil && t.id === eigenId ? opt.profil : t.profil) || 'tradition';
  // D128: Anspruch der KI aus dem Zielwert (vor dem ersten Saisonwechsel gilt die Startstärke – so setzt DFLSaison das erste Ziel);
  // der eigene Verein (und ohne Zielwert) bleibt beim Profil wie in D118
  function anspruch(t, opt) {
    const Z = CFG.zielwert, p = CFG.ziel[profilVon(t, opt)] || 3;
    if (!Z || !Z.aktiv || t.id === eigenId) return p;
    const S = window.DFLSaison;
    if (S && S.CFG && S.CFG.ziel && !S.CFG.ziel.aktiv) return p;
    const wert = t.ziel && t.ziel.wert != null ? t.ziel.wert : (t.start_ovr || (G.teamOvr && t.roster && t.roster.length ? G.teamOvr(t) : Z.basis));
    const gr = Math.min(1, ((t.anlagen && t.anlagen.stadion) || 20000) / 80000) - 0.5;
    return klemme(Z.mitte + Z.je * (wert - Z.basis) + Z.groesse * gr + Z.profil * (p - Z.profilMitte), Z.min, Z.max);
  }
  function zielSterne(t, opt) {
    const F = window.DFLFinanzen;
    const z = anspruch(t, opt);
    if (F && F.sparmodus && F.sparmodus(t)) return Math.min(z, CFG.sparZiel);
    const ein = (t.finanzen && t.finanzen.einnahmen) || 0;
    const Z = CFG.zielwert, mitZiel = Z && Z.aktiv && t.id !== eigenId;          // D128: KI mit Zielwert
    const knapp = mitZiel ? Z.knapp : CFG.knapp, abzug = mitZiel ? Z.knappAbzug : CFG.knappAbzug;
    return ein && t.kasse != null && t.kasse < knapp * ein ? z - abzug : z;
  }
  // Startbesetzung (alte Spielstände, neue Liga): je Rolle nach Profil, Verträge mit Restlaufzeit
  // Rollen, die ganz fehlen (undefined – null heißt „Stelle frei“), werden besetzt: neue Liga, alte Spielstände, neue Rollen (D120)
  function besetzeStart(L, t, r, opt) {
    const rollen = CFG.rollen.concat(CFG.rollenExtra || []).concat(t.id === eigenId ? [] : ['chef']);
    if (t.trainer && rollen.every(k => t.trainer[k] !== undefined)) return false;
    t.trainer = t.trainer || {};
    rollen.filter(k => t.trainer[k] === undefined).forEach(rolle => {
      const s = klemme(Math.round(zielSterne(t, opt) + (r() - 0.5) * 2 * CFG.streuung), 1, 5);
      const p = vertragGeben(L, neuePerson(L, r, rolle, s), 1 + Math.floor(r() * 3));
      t.trainer[rolle] = p;
    });
    return true;
  }
  function sicherstellen(L, opt) {
    if (!CFG.aktiv || !L || !L.teams) return 0;
    const W = welt(L);
    let n = 0;
    const r = rngVon(L, 'trainer-start'), F = window.DFLFinanzen;
    L.teams.forEach(t => {
      if (!t.profil && F && F.anlagenStart && t.anlagen) F.anlagenStart(t, L.seed);       // Eigentümer-Profil der KI
      if (besetzeStart(L, t, r, opt)) n++;
    });
    if (!W.markt.length) marktAuffrischen(L, r);
    return n;
  }

  // ── Wirkung ──────────────────────────────────────────────────────────────
  const fehlt = t => !t.trainer || CFG.rollen.concat(CFG.rollenExtra || []).some(k => t.trainer[k] === undefined);
  const sterne = (t, rolle) => (t && t.trainer && t.trainer[rolle] && t.trainer[rolle].sterne) || 0;
  const chefDelta = t => (t && t.trainer && t.trainer.chef ? t.trainer.chef.sterne - CFG.wirkung.chef.mitte : 0);
  // Eingewöhnung je Spiel (Bonus zu DFLSaison.CFG.stil.jeSpiel)
  const eingBonus = t => CFG.aktiv ? sterne(t, 'co') * CFG.wirkung.co.eing + chefDelta(t) * CFG.wirkung.chef.eing : 0;
  const entwFaktor = t => CFG.aktiv ? 1 + sterne(t, 'co') * CFG.wirkung.co.entw + chefDelta(t) * CFG.wirkung.chef.entw : 1;
  const physio = t => CFG.aktiv ? sterne(t, 'physio') : 0;
  // Risikoabzug aus Medizin (Anteil 0–1) und Physio-Sternen, zusammen gedeckelt
  const risikoAbzug = (medAbzug, phys) => Math.min(Math.max(CFG.medDeckel, medAbzug), medAbzug + (phys || 0) * CFG.wirkung.physio.risiko);
  const rehaFaktor = phys => 1 + (phys || 0) * CFG.wirkung.physio.reha;
  const fitnessFaktor = phys => 1 + (phys || 0) * CFG.wirkung.physio.fitness;
  const moralFaktor = t => 1 - (CFG.aktiv ? sterne(t, 'psycho') : 0) * CFG.wirkung.psycho.moral;
  const wegVerschiebung = t => (CFG.aktiv ? sterne(t, 'psycho') : 0) * CFG.wirkung.psycho.weg;
  const elferBonus = t => (CFG.aktiv ? sterne(t, 'psycho') : 0) * CFG.wirkung.psycho.elfer;
  // Faktor auf Abschlüsse aus Standards: eigener Standardtrainer × gegnerischer (Engine v3, opt.standard)
  const standardFaktor = (sAtt, sDef) => (1 + (sAtt || 0) * CFG.wirkung.standard.tor) * (1 - (sDef || 0) * CFG.wirkung.standard.gegen);
  // Dasselbe in der Formel: nur der Anteil der Standardtore an allen Toren ändert sich
  const formelFaktor = (sAtt, sDef) => 1 + CFG.standardAnteil * (standardFaktor(sAtt, sDef) - 1);
  const stdSterne = t => (CFG.aktiv ? sterne(t, 'standard') : 0);

  // ── Kosten ───────────────────────────────────────────────────────────────
  // Gehälter der Saison (Rollen ohne Chefcoach – den zahlt der Betrieb, wie beim eigenen Verein) + Abfindungen/halbe Saisons
  function gehaelter(t) {
    if (!t || !t.trainer) return 0;
    return CFG.rollen.concat(CFG.rollenExtra || []).reduce((s, k) => s + ((t.trainer[k] && t.trainer[k].gehalt) || 0), 0);
  }
  const kosten = t => (CFG.aktiv && t && t.trainer ? Math.max(0, gehaelter(t) + (t._trainerExtra || 0)) : 0);
  const extra = (t, x) => { t._trainerExtra = (t._trainerExtra || 0) + x; };

  // ── Markt ────────────────────────────────────────────────────────────────
  const alleRollen = () => CFG.rollen.concat(CFG.rollenExtra || []).concat(['chef']);
  function hofKandidat(L, r) {
    const H = L.historie && L.historie.hallOfFame, W = welt(L);
    if (!H || !H.length) return null;
    const frei = H.filter(h => h.hof && W.hof.indexOf(h.id) < 0 && (L.saisonJahr || 0) - (h.jahr || 0) >= CFG.hof.nachJahren);
    if (!frei.length) return null;
    const h = frei[Math.floor(r() * frei.length)];
    W.hof.push(h.id);
    const rollen = CFG.rollen.concat(CFG.rollenExtra || []);
    const rolle = /ST|LF|RF|OM|ZOM/.test(h.pos || '') ? 'standard' : rollen[Math.floor(r() * rollen.length)];
    const p = neuePerson(L, r, rolle, 2 + Math.floor(r() * 3), { name: { firstName: h.firstName, name: h.nachname }, alter: (h.alter || 35) + Math.max(1, (L.saisonJahr || 0) - (h.jahr || 0)), ex: 'hof' });
    if (h.seed) p.seed = h.seed;
    p.spieler = h.id;
    return p;
  }
  function marktAuffrischen(L, r) {
    const W = welt(L);
    alleRollen().forEach(rolle => {
      const da = W.markt.filter(p => p.rolle === rolle);
      for (let i = da.length; i < CFG.markt.jeRolle; i++) W.markt.push(neuePerson(L, r, rolle, zieheSterne(r)));
    });
    if (r() < CFG.hof.chance) { const h = hofKandidat(L, r); if (h) W.markt.push(h); }
    // zu viele: die Schwächsten gehen
    alleRollen().forEach(rolle => {
      const da = W.markt.filter(p => p.rolle === rolle);
      if (da.length <= CFG.markt.max) return;
      da.sort((a, b) => a.sterne - b.sterne || b.alter - a.alter).slice(0, da.length - CFG.markt.max).forEach(p => W.markt.splice(W.markt.indexOf(p), 1));
    });
  }
  const kandidaten = (L, rolle) => welt(L).markt.filter(p => p.rolle === rolle).sort((a, b) => b.sterne - a.sterne || a.alter - b.alter);
  function zumMarkt(L, p) {
    if (!p) return;
    const W = welt(L);
    p.bis = null; p.gehalt = 0;
    if (W.markt.indexOf(p) < 0) W.markt.push(p);
  }
  // Einstellen (KI und eigener Verein): aus dem Markt nehmen, Vertrag geben; mitten in der Saison zahlt der Verein nur die halbe
  function einstellen(L, t, p, jahre, opt) {
    opt = opt || {};
    const W = welt(L), i = W.markt.indexOf(p);
    if (i >= 0) W.markt.splice(i, 1);
    t.trainer = t.trainer || {};
    const alt = t.trainer[p.rolle];
    if (alt && alt !== p) entlassen(L, t, p.rolle, opt);
    vertragGeben(L, p, jahre);
    t.trainer[p.rolle] = p;
    if (opt.halb && t.id !== eigenId) extra(t, -p.gehalt / 2);
    return p;
  }
  // Entlassen: Restgehalt der laufenden Saison (KI: Hälfte in der Winterpause, voll vor der Saison) – eigener Verein im Spiel
  function entlassen(L, t, rolle, opt) {
    opt = opt || {};
    const p = t && t.trainer && t.trainer[rolle];
    if (!p) return null;
    if (t.id !== eigenId && !opt.ohneKosten) extra(t, opt.halb ? p.gehalt / 2 : p.gehalt);
    t.trainer[rolle] = null;
    zumMarkt(L, p);
    return p;
  }
  function kiBesetzen(L, r, opt) {
    opt = opt || {};
    const ohne = new Set(opt.ohne || []);
    let n = 0;
    L.teams.forEach(t => {
      if (t.id === eigenId || ohne.has(t.id)) return;
      t.trainer = t.trainer || {};
      alleRollen().forEach(rolle => {
        if (t.trainer[rolle]) return;
        const wunsch = klemme(Math.round(zielSterne(t, opt) + (r() - 0.5) * 2 * CFG.streuung), 1, 5);
        const liste = kandidaten(L, rolle).filter(p => p.sterne <= wunsch);
        const p = liste.length ? liste[0] : neuePerson(L, r, rolle, wunsch);
        einstellen(L, t, p, CFG.vertrag[0] + Math.floor(r() * (CFG.vertrag[1] - CFG.vertrag[0] + 1)), { halb: opt.halb });
        n++;
      });
    });
    return n;
  }
  // Abwerben: gute Trainer (ab 4 Sternen) im letzten Vertragsjahr gehen zu einem reicheren Verein, der auf dieser Rolle schwächer ist
  function abwerben(L, r, opt) {
    opt = opt || {};
    if (!CFG.abwerben.an) return [];
    const ohne = new Set(opt.ohne || []), F = window.DFLFinanzen, kasse = t => (opt.kasseVon ? opt.kasseVon(t) : t.kasse) || 0;
    const wechsel = [];
    L.teams.forEach(von => {
      if (!von.trainer) return;
      CFG.rollen.concat(CFG.rollenExtra || []).forEach(rolle => {
        const p = von.trainer[rolle];
        if (!p || p.sterne < CFG.abwerben.ab || p.bis !== L.saisonJahr || r() >= CFG.abwerben.chance) return;
        // D128: nur wer einen Trainer dieser Klasse auch will (Anspruch nach Zielwert + 1 Stern)
        const will = t => !(CFG.zielwert && CFG.zielwert.aktiv) || p.sterne <= Math.round(zielSterne(t)) + CFG.zielwert.abwerbenPlus;
        const reicher = L.teams.filter(t => t !== von && t.id !== eigenId && !ohne.has(t.id) && t.trainer && sterne(t, rolle) < p.sterne
          && kasse(t) > kasse(von) * CFG.abwerben.kasseVor + 1e6 && !(F && F.sparmodus && F.sparmodus(t)) && will(t));
        if (!reicher.length) return;
        const zu = reicher[Math.floor(r() * reicher.length)];
        if (von.id !== eigenId) extra(von, opt.halb ? -p.gehalt / 2 : -p.gehalt);   // zahlt nur bis zum Wechsel
        von.trainer[rolle] = null;
        if (zu.trainer[rolle]) entlassen(L, zu, rolle, { halb: opt.halb });
        einstellen(L, zu, p, 2 + Math.floor(r() * 2), { halb: opt.halb });
        wechsel.push({ p, von: von.id, zu: zu.id, rolle });
        melde({ art: 'abwerbung', team: von.id, person: p, zu: zu.id, rolle });
      });
    });
    return wechsel;
  }

  // ── Jahreslauf ───────────────────────────────────────────────────────────
  function renteChance(alter) { let c = 0; CFG.rente.forEach(([a, x]) => { if (alter >= a) c = x; }); return c; }
  function entwickeln(L, r, p, t) {
    p.alter++; p.xp = (p.xp || 0) + 1;
    const E = CFG.entwicklung, erfolg = t && t._erfolg != null ? t._erfolg : 0.5;
    let rauf = E.basis + (erfolg >= 0.66 ? E.erfolg : erfolg >= 0.4 ? E.erfolg / 3 : 0) + (p.alter <= E.jungBis ? E.jung : 0) + Math.min(0.05, p.xp * 0.004);
    if (p.sterne >= 4) rauf *= 0.6;
    if (p.sterne < 5 && r() < rauf) { p.sterne++; return 1; }
    if (p.alter >= E.altAb && p.sterne > 1 && r() < E.abbau) { p.sterne--; return -1; }
    return 0;
  }
  // Saisonende (DFLSaison.phaseAbschluss, nach den Finanzen und dem Jahreswechsel): Entwicklung, Rente, Vertragsende,
  // Chefcoach, Eigenschaften (Psychologe, nur KI – den eigenen Kader macht das Spiel)
  function saisonEnde(L, r, W) {
    if (!CFG.aktiv) return null;
    sicherstellen(L);
    const st = { rauf: 0, runter: 0, rente: 0, ende: 0, verlaengert: 0, chef: 0, eigenschaft: 0 };
    const ohne = new Set((W && W.ohne) || []);
    const M = welt(L);
    L.teams.forEach(t => { t._trainerExtra = 0; });                  // Abfindungen der Saison sind gebucht
    // Markt: altern, Rente
    for (const p of M.markt.slice()) {
      p.alter++;
      if (r() < renteChance(p.alter) || (p.alter >= 60 && p.sterne <= 1)) M.markt.splice(M.markt.indexOf(p), 1);
    }
    L.teams.forEach(t => {
      if (!t.trainer) return;
      Object.keys(t.trainer).forEach(rolle => {
        const p = t.trainer[rolle];
        if (!p) return;
        const d = entwickeln(L, r, p, t);
        if (d > 0) { st.rauf++; melde({ art: 'entwicklung', team: t.id, person: p, rolle }); } else if (d < 0) st.runter++;
        if (r() < renteChance(p.alter)) {
          t.trainer[rolle] = null; st.rente++;
          melde({ art: 'rente', team: t.id, person: p, rolle });
          return;
        }
        if (p.bis != null && p.bis < (L.saisonJahr || 0)) {
          const F = window.DFLFinanzen, spar = F && F.sparmodus && F.sparmodus(t);
          const z = zielSterne(t);
          if (t.id !== eigenId && !ohne.has(t.id) && !spar && p.sterne >= z - 1 && p.sterne <= Math.round(z) + 1 && r() < CFG.verlaengern) {
            vertragGeben(L, p, 1 + Math.floor(r() * 3)); st.verlaengert++;
          } else {
            t.trainer[rolle] = null; zumMarkt(L, p); st.ende++;
            melde({ art: 'vertragsende', team: t.id, person: p, rolle });
          }
        }
      });
    });
    // D128: Ziel gestiegen (DFLSaison.zielPruefen lief vorher) – klar zu schwache Trainer gehen (Abfindung eine Saison), die Stellen
    // besetzt der Markt nach dem Draft mit dem neuen Anspruch. Sinkt das Ziel, wirkt es über Verlängerung und Neubesetzung.
    st.zielwechsel = 0;
    L.teams.forEach(t => {
      const Z = CFG.zielwert;
      if (!Z || !Z.aktiv || t.id === eigenId || ohne.has(t.id) || !t.trainer || !t.ziel) return;
      const alt = t._trZiel; t._trZiel = t.ziel.wert;
      if (alt == null || t.ziel.wert <= alt) return;
      const F = window.DFLFinanzen;
      if (F && F.sparmodus && F.sparmodus(t)) return;
      const z = zielSterne(t);
      CFG.rollen.concat(CFG.rollenExtra || []).forEach(rolle => {
        const p = t.trainer[rolle];
        if (p && p.sterne <= z - Z.wechsel) { entlassen(L, t, rolle); st.zielwechsel++; }
      });
    });
    // Chefcoach: schwache oder fehlende Chefs – ein 5-Sterne-Co-Trainer eines anderen Vereins (auch deiner) steigt auf
    L.teams.forEach(t => {
      if (t.id === eigenId || !t.trainer) return;
      const c = t.trainer.chef;
      if (c && c.sterne > CFG.chefcoach.schwachBis) return;
      if (CFG.zielwert && CFG.zielwert.aktiv && zielSterne(t) < CFG.zielwert.chefAb) return;      // D128: nur mit Anspruch auf einen guten Chef
      if (r() >= CFG.chefcoach.chance) return;
      const co = L.teams.filter(x => x !== t && x.trainer && x.trainer.co && x.trainer.co.sterne >= 5).map(x => ({ x, p: x.trainer.co }));
      if (!co.length) return;
      const w = co[Math.floor(r() * co.length)];
      w.x.trainer.co = null;                                         // zum Saisonende: die Saison ist bezahlt
      if (c) entlassen(L, t, 'chef', { ohneKosten: true });
      const p = w.p; p.rolle = 'chef'; p.sterne = 4; p.spez = SPEZ.chef[Math.floor(r() * SPEZ.chef.length)];
      einstellen(L, t, p, 3);
      st.chef++;
      melde({ art: 'chefcoach', team: w.x.id, person: p, zu: t.id, rolle: 'co' });
    });
    // Eigenschaften (Psychologe): je Stern eine kleine Chance je Saison
    L.teams.forEach(t => {
      if (t.id === eigenId || ohne.has(t.id)) return;
      if (eigenschaftWuerfeln(r, t.roster || [], sterne(t, 'psycho'))) st.eigenschaft++;
    });
    return st;
  }
  // Ein Spieler: schlechte Eigenschaft abbauen (zuerst) oder gute wecken. Ergebnis { p, art: 'weg'|'neu', key } oder null
  function eigenschaftWuerfeln(r, kader, s) {
    if (!s || !kader.length || r() >= s * CFG.wirkung.psycho.eigenschaft) return null;
    const E = CFG.eigenschaften;
    const minus = kader.filter(p => p.traits && p.traits.some(k => E.minus.indexOf(k) >= 0));
    if (minus.length && r() < 0.6) {
      const p = minus[Math.floor(r() * minus.length)], key = p.traits.find(k => E.minus.indexOf(k) >= 0);
      p.traits = p.traits.filter(k => k !== key);
      if (p.traitsBekannt) p.traitsBekannt = p.traitsBekannt.filter(k => k !== key);
      return { p, art: 'weg', key };
    }
    const offen = kader.filter(p => Array.isArray(p.traits) && p.traits.length < 3);
    if (!offen.length) return null;
    const p = offen[Math.floor(r() * offen.length)], frei = E.plus.filter(k => p.traits.indexOf(k) < 0);
    if (!frei.length) return null;
    const key = frei[Math.floor(r() * frei.length)];
    p.traits.push(key);
    return { p, art: 'neu', key };
  }
  // Nach dem Draft und in der Winterpause: Markt auffrischen, abwerben, KI besetzt offene Stellen (opt.halb: Winterpause)
  function marktRunde(L, r, opt) {
    if (!CFG.aktiv) return null;
    sicherstellen(L);
    marktAuffrischen(L, r);
    const w = abwerben(L, r, opt);
    const n = kiBesetzen(L, r, opt);
    return { abgeworben: w.length, eingestellt: n };
  }
  const nachDraft = (L, r, opt) => marktRunde(L, r, Object.assign({}, opt, { halb: false }));
  const winter = (L, r, opt) => marktRunde(L, r, Object.assign({}, opt, { halb: true }));

  // Kurztext der Wirkung einer Person (Kandidaten-Blatt, eine Zeile)
  function wirkungText(rolle, s) {
    const W = CFG.wirkung, pc = x => Math.round(x * 1000) / 10;
    const z = x => String(x).replace('.', ',');
    if (rolle === 'co') return `Eingewöhnung +${s} je Spiel · Entwicklung +${z(pc(s * W.co.entw))} %`;
    if (rolle === 'physio') return `Verletzungen −${z(pc(s * W.physio.risiko))} % · Reha +${z(pc(s * W.physio.reha))} %`;
    if (rolle === 'psycho') return `Moralverlust −${z(pc(s * W.psycho.moral))} % · Elfmeter +${s} Punkte`;
    if (rolle === 'standard') return `Standardtore +${z(pc(s * W.standard.tor))} % · Gegentore −${z(pc(s * W.standard.gegen))} %`;
    if (rolle === 'scout') return `Urteil ${['oft daneben', 'oft daneben', 'manchmal daneben', 'meist richtig', 'fast immer richtig', 'fast immer richtig'][s]} · Steals ${['kaum', 'kaum', 'ein Viertel', 'die Hälfte', 'die meisten', 'fast alle'][s]}`;
    if (rolle === 'chef') return `Eingewöhnung und Entwicklung ${s >= 3 ? '+' : '−'}${z(Math.abs(s - 3) * 0.5)}`;
    return '';
  }

  window.DFLTrainer = {
    CFG, ROLLE, sicherstellen, fehlt, welt, sterne, chefDelta, eingBonus, entwFaktor, physio, risikoAbzug, rehaFaktor, fitnessFaktor,
    moralFaktor, wegVerschiebung, elferBonus, standardFaktor, formelFaktor, stdSterne, gehaelter, kosten, gehaltFuer, preisIndex,
    kandidaten, einstellen, entlassen, kiBesetzen, abwerben, saisonEnde, nachDraft, winter, marktAuffrischen, neuePerson, vertragGeben,
    eigenschaftWuerfeln, wirkungText, zielSterne, anspruch, voll, rngVon,
    setzeEigen(id) { eigenId = id; }, eigen: () => eigenId, setzeMelder(fn) { melder = fn; }
  };
  console.log('%c[DFL-Trainer v1] aktiv', 'color:#3fb950;font-weight:bold',
    '— Trainerteam für alle 32 Vereine (Co-Trainer, Athletik & Physio, Sportpsychologe, Standardtrainer, KI-Chefcoach), Markt nach dem Draft und in der Winterpause, Abwerben, Entwicklung (D118); KI-Trainer nach Zielwert (D128)');
})();
