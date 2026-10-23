/* ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
   Kickstil – Nachwuchsleistungszentrum (NLZ) am PC · Etappe 1 (2026-10-18, nur PC-Version)
   Nutzer: „wie man für sein eigenes System ausbildet … wie bei Barça oder universell wie Real … Gelder ins NLZ investieren …
   die Kids von klein auf entwickeln“ – „keine Handy-Änderung, sondern eine PC-Änderung“. Vorschau freigegeben („ja das passt
   alles“), Budget-Spannen freigegeben („passt so“). Plan und Etappen: ../gesamt_app/pc_spezifisch.md, Punkt 10.
   Etappe 1:
   · PHILOSOPHIE  Eigenes System (Eigengewächse entwickeln sich bei dir +15 %, woanders −10 % Marktwert) · Universell (eine
     Position mehr beim Hochziehen, Marktwert +20 %) · Mischform (+7 % Entwicklung, +8 % Marktwert, halbe Chance auf eine
     Position mehr). Gilt für Eigengewächse (Hochgezogene aus der Akademie, id „sq_youth_…“, Marke p.ksNlz). Ein Wechsel wirkt
     über drei Jahre (34/67/100 %).
   · ALTERSSTUFEN U9–U15 als Jahrgänge (Gruppen: Kinder, auffällige) – altern zu jeder Saison, Abbrecher je nach Internat und
     Medizin; der U15-Jahrgang rückt in den Leistungsbereich auf: seine Auffälligen heben das Potenzial der neuen Talente.
     Leistungsbereich U16–U19 = die bisherige Akademie (CLUB.youthProspects) mit Hochziehen/Entlassen.
   · BUDGET je Saison (Spannen vom Nutzer freigegeben): Erste 2–8 Mio (Start 4), Zweite 1–3 (1,8), Dritte 0,5–2 (0,9),
     RL 0,2–0,6 (0,3). Der Startwert steckt – wie der Standard-Stab des Trainerteams – schon in den Betriebskosten; gebucht wird
     nur die Differenz (Saisonstart ganz, Änderung in der Saison anteilig). Aufteilung Trainer/Scouting/Internat/Medizin
     (Standard 45/25/20/10): Trainer → Entwicklung der Akademie-Talente, Scouting → Potenzial der Neuen und Kinder je Jahrgang,
     Internat → Akademie-Plätze ±, Abbrecher, Medizin → Abbrecher.
   Nur in der PC-App (window.FcmPc; Test im Browser: localStorage pcs-test = an). Ansicht nur mit body.pcu-an (Fenster ≥ 1200 px),
   Reiter „NLZ“ in der Navigation. Zustand CLUB.welt.nlz (Karrierestart leert ihn). API: KSNlz.z() · .wirkung() · .oeffnen()
   ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const W = window;
  const CFG = {
    spanne: { bundesliga: [2e6, 8e6, 4e6], bundesliga2: [1e6, 3e6, 1.8e6], liga3: [5e5, 2e6, 9e5], regionalliga: [2e5, 6e5, 3e5] },
    anteile: { trainer: 45, scouting: 25, internat: 20, medizin: 10 },
    phil: {
      system: { name: 'Eigenes System', dev: 0.15, wert: 0.90, pos: 0, vorbild: 'Barça, La Masia – alle Teams spielen ab der U9 dasselbe System.',
        plus: ['Eigengewächse entwickeln sich bei dir +15 %', 'Eigengewächse passen in der Taktik wie Wunschspieler, solange du beim Spielstil bleibst, mit dem sie hochkamen'], minus: ['Woanders weniger wert (Marktwert −10 %)'] },
      universell: { name: 'Universell', dev: 0, wert: 1.20, pos: 1, vorbild: 'Real Madrid „La Fábrica“, Benfica Seixal – ausbilden, verkaufen, mitverdienen.',
        plus: ['Lernen beim Hochziehen eine Position mehr', 'Marktwert +20 %'], minus: ['Kein Entwicklungsbonus bei dir'] },
      misch: { name: 'Mischform', dev: 0.07, wert: 1.08, pos: 0.5, vorbild: 'Ajax – eigenes 4-3-3, trotzdem Verkaufsverein.',
        plus: ['Entwicklung +7 %', 'Marktwert +8 %', 'Halbe Chance auf eine Position mehr'], minus: ['Von beidem weniger'] }
    },
    devWoche: 0.14,           // Grundchance je Woche (wie Trainerteam: Normal-Training ≈ 0,14) – Bonus = Anteil davon
    devAlter: 23,             // Philosophie-Bonus für Eigengewächse bis zu diesem Alter
    umstellung: 3,            // Jahre bis eine neue Philosophie voll wirkt
    abbrecher: 0.08,          // Grundrate je Jahrgang und Jahr
    stufen: ['U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15'],
    takt: 900
  };
  const NACHBAR = { IV: ['ZDM', 'LV', 'RV'], LV: ['LM', 'IV'], RV: ['RM', 'IV'], ZDM: ['ZM', 'IV'], ZM: ['ZOM', 'ZDM'], LM: ['LF', 'LV'], RM: ['RF', 'RV'],
    ZOM: ['ZM', 'ST'], LF: ['ST', 'LM'], RF: ['ST', 'RM'], ST: ['ZOM', 'LF', 'RF'], AV: ['IV'], AM: ['ZM'], FL: ['ST'], OM: ['ZM', 'ST'] };

  // Erweiterungen (Etappe 2+: kickstil_pc_nlz_karte.js …) – je Erweiterung optional: tab {id, name, html(n), klick(ev, n) → true},
  // auffNeu(n, jahr) → Zahl (Auffällige im neuen U9), faktor(art, n) → Zahl (art: 'abbrecher' | 'spaetzuender'), beiAltern(n, aufsteiger),
  // hochgezogen(n, p), saison(n), woche(n), summe(art, n) → Zahl; tab.regler(ev, n) → true, tab.nach(n, v)
  const ERW = [];
  // faktor(art, n, p): 'abbrecher' | 'spaetzuender' | 'dev' (Akademie, p = Talent) | 'umstellung' | 'anziehung' (Landkarte) → Faktor;
  // summe(art, n): 'plaetze' → Zusatzplätze
  const erwFaktor = (art, n, p) => ERW.reduce((f, e) => { try { const x = e.faktor && e.faktor(art, n, p); return f * (typeof x === 'number' && isFinite(x) ? x : 1); } catch (er) { return f; } }, 1);
  const erwSumme = (art, n) => ERW.reduce((s, e) => { try { const x = e.summe && e.summe(art, n); return s + (typeof x === 'number' && isFinite(x) ? x : 0); } catch (er) { return s; } }, 0);
  const erwRuf = (name, ...a) => ERW.forEach(e => { try { if (typeof e[name] === 'function') e[name](...a); } catch (er) { console.warn('[Kickstil-PC-NLZ] Erweiterung ' + name, er); } });
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // PC-Vollversion: das NLZ gehört nicht in die Demo (Nutzer 2026-10-19). Im Browser-Test: pcs-test = an, pcs-demo = an spielt die Demo nach
  const istPc = () => { if (W.FcmPc) return W.FcmPc.voll !== false; try { return localStorage.getItem('pcs-test') === 'an' && localStorage.getItem('pcs-demo') !== 'an'; } catch (e) { return false; } };
  const hatSpiel = () => { try { return typeof CLUB !== 'undefined' && CLUB && typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.tiers; } catch (e) { return false; } };
  const euro = v => (typeof formatEuro === 'function' ? formatEuro(Math.round(v)) : Math.round(v) + ' €');
  const mio = v => v >= 1e6 ? (v / 1e6).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Mio. €' : Math.round(v / 1000).toLocaleString('de-DE') + ' Tsd. €';
  const toast = (t, art) => { if (typeof W.showToast === 'function') W.showToast(t, art || 'info'); };
  const rnd = () => Math.random();
  const restAnteil = () => { const sw = typeof SEASON_WEEKS === 'number' ? SEASON_WEEKS : 52; return Math.max(0, Math.min(1, (sw - (LEAGUE.week || 1)) / sw)); };
  function tierKey() { try { const g = allGroups(LEAGUE).find(x => x.group.teams.some(t => t.id === 'fcm')); return g ? g.tierKey : 'liga3'; } catch (e) { return 'liga3'; } }
  const spanne = () => CFG.spanne[tierKey()] || CFG.spanne.liga3;
  const istEigengewaechs = p => !!p && (String(p.id || '').indexOf('sq_youth_') === 0 || !!p.ksNlz);

  // ── Zustand ────────────────────────────────────────────────────────────────────────────────────────────────────
  function einwohner() { try { return (W.KSVerein && KSVerein.daten('fcm').einwohner) || 150000; } catch (e) { return 150000; } }
  function kinderJeJahrgang(z) { const basis = 8 + Math.log10(Math.max(20000, einwohner()) / 20000) * 6; return Math.round(Math.max(8, Math.min(24, basis * Math.sqrt(wirkung(z).scouting)))); }
  function neuerJahrgang(z, jahr) {
    const k = kinderJeJahrgang(z), w = wirkung(z);
    let auff = 0; const erw = 0.7 * w.scouting; for (let i = 0; i < 3; i++) if (rnd() < erw / 3) auff++;
    for (const e of ERW) { try { const a = e.auffNeu && e.auffNeu(z, jahr); if (typeof a === 'number' && isFinite(a)) { auff = Math.max(0, Math.min(4, Math.round(a))); break; } } catch (er) { /* Standard */ } }
    return { jahr, kinder: k, auff };
  }
  function z() {
    if (!CLUB.welt) CLUB.welt = {};
    let n = CLUB.welt.nlz;
    if (!n || n.v !== 1) {
      const sp = spanne();
      n = CLUB.welt.nlz = { v: 1, phil: 'system', philSeit: (LEAGUE.season || 1) - CFG.umstellung, budget: sp[2], eigen: false,
        anteile: Object.assign({}, CFG.anteile), gebucht: LEAGUE.season || 1, gealtert: LEAGUE.season || 1, jahrgaenge: [], meldung: '' };
      const jahr0 = (LEAGUE.startYear || 2026) + (LEAGUE.season || 1) - 1;   // Kalenderjahr der Saison
      for (let i = 0; i < CFG.stufen.length; i++) n.jahrgaenge.push(neuerJahrgang(n, jahr0 - 9 - i));   // U9 = 9 Jahre alt
      n.jahrgaenge.sort((a, b) => b.jahr - a.jahr);
    }
    return n;
  }
  // Wirkung der Aufteilung: Verhältnis jedes Bereichs zum Standard (1 = wie im Standard)
  function wirkung(n) {
    n = n || (CLUB.welt && CLUB.welt.nlz); const sp = spanne();
    if (!n) return { trainer: 1, scouting: 1, internat: 1, medizin: 1 };
    const summe = Object.values(n.anteile).reduce((a, b) => a + b, 0) || 100, r = {};
    Object.keys(CFG.anteile).forEach(k => { r[k] = (n.budget * n.anteile[k] / summe) / (sp[2] * CFG.anteile[k] / 100); });
    return r;
  }
  const devFaktor = (n, p) => Math.max(0.85, Math.min(1.3, 1 + 0.15 * (wirkung(n).trainer - 1))) * erwFaktor('dev', n, p);
  const potBonus = n => Math.round(Math.max(-3, Math.min(4, 3 * (wirkung(n).scouting - 1))));
  const platzBonus = n => { const r = wirkung(n).internat; return (r >= 1.8 ? 2 : r >= 1.3 ? 1 : r < 0.5 ? -1 : 0) + erwSumme('plaetze', n); };
  const abbrecherRate = n => { const w = wirkung(n); return CFG.abbrecher * Math.max(0.3, 1.5 - 0.35 * Math.min(2, w.internat) - 0.15 * Math.min(2, w.medizin)) * erwFaktor('abbrecher', n); };
  const philStaerke = n => Math.max(0, Math.min(1, ((LEAGUE.season || 1) - n.philSeit + 1) / Math.max(1, Math.round(CFG.umstellung * erwFaktor('umstellung', n)))));
  function philVon(p) { const n = CLUB.welt && CLUB.welt.nlz; const k = (p && p.ksNlz && p.ksNlz.phil) || (n && n.phil) || 'system'; return CFG.phil[k] || CFG.phil.system; }

  // ── Geld ───────────────────────────────────────────────────────────────────────────────────────────────────────
  function saisonBuchen() {
    const n = z(); if (n.gebucht === LEAGUE.season) return;
    n.gebucht = LEAGUE.season;
    const sp = spanne();
    if (!n.eigen) n.budget = sp[2]; else n.budget = Math.max(sp[0], Math.min(sp[1], n.budget));
    const diff = Math.round((n.budget - sp[2]) / 1000) * 1000;
    if (!diff) return;
    CLUB.budget = (CLUB.budget || 0) - diff;
    if (typeof addNews === 'function') addNews('club', diff > 0 ? '🏫 NLZ: Mehrkosten' : '🏫 NLZ: Ersparnis',
      diff > 0 ? `Dein Nachwuchsleistungszentrum kostet diese Saison ${euro(diff)} mehr als der Ligastandard.` : `Dein sparsames NLZ spart diese Saison ${euro(-diff)}.`);
  }
  function budgetSetzen(neu, anteile) {
    const n = z(), sp = spanne();
    neu = Math.max(sp[0], Math.min(sp[1], Math.round(neu / 10000) * 10000));
    const kosten = Math.round((neu - n.budget) * restAnteil() / 1000) * 1000;
    if (kosten > 0 && (CLUB.budget || 0) < kosten) { toast('Dafür reicht das Budget nicht (' + euro(kosten) + ').', 'warn'); return false; }
    CLUB.budget = (CLUB.budget || 0) - kosten;
    n.budget = neu; n.eigen = true; if (anteile) n.anteile = Object.assign({}, anteile);
    toast(`NLZ-Budget: ${mio(neu)} je Saison${kosten ? ` · ${kosten > 0 ? euro(kosten) + ' Mehrkosten' : euro(-kosten) + ' gespart'} für den Rest der Saison` : ''}`, 'success');
    try { if (typeof saveGameState === 'function') saveGameState(); } catch (e) { /* später */ }
    return true;
  }

  // ── Saisonwechsel: Jahrgänge altern, U15 rückt auf, Akademie entwickelt sich (mit Bonus) ──────────────────────────
  function jahrgaengeAltern(n) {
    const rate = abbrecherRate(n), alle = n.jahrgaenge.slice().sort((a, b) => b.jahr - a.jahr);
    alle.forEach(j => {
      let weg = 0; for (let i = 0; i < j.kinder; i++) if (rnd() < rate) weg++;
      j.kinder = Math.max(4, j.kinder - weg);
      if (j.auff > 0 && rnd() < rate * 1.5) j.auff--;                         // ein Auffälliger hört auf oder stagniert
      if (rnd() < 0.12 * Math.sqrt(wirkung(n).trainer) * erwFaktor('spaetzuender', n)) j.auff = Math.min(4, j.auff + 1);   // Spätzünder
    });
    const aelteste = alle[alle.length - 1];                                   // bisher U15 → rückt in den Leistungsbereich
    n.jahrgaenge = alle.slice(0, alle.length - 1);
    n.jahrgaenge.unshift(neuerJahrgang(n, alle[0].jahr + 1));               // neuer U9 = ein Jahr jünger als der bisher jüngste
    return aelteste;
  }
  function plusEins(p) {
    const A = ['def', 'mid', 'att'].map(a => [a, p[a] || 0]).sort((a, b) => b[1] - a[1]);
    p[A[0][0]] = Math.min(98, (p[A[0][0]] || 50) + 1);
    if (typeof computeOvrFromAreas === 'function') p.ovr = computeOvrFromAreas(p);
    if (p.truePotential && p.ovr > p.truePotential) p.ovr = p.truePotential;
  }
  function akademieNachSaison(vorher, aufsteiger, n) {
    // a) Entwicklungs-Bonus/-Malus für Talente, die schon da waren
    (CLUB.youthProspects || []).forEach(p => {
      const alt = vorher.get(p.id); if (alt == null) return;
      const gain = (p.ovr || 0) - alt, extra = gain * (devFaktor(n, p) - 1);
      let k = Math.floor(Math.abs(extra)); if (rnd() < Math.abs(extra) - k) k++;
      for (let i = 0; i < k; i++) {
        if (extra > 0 && p.ovr < (p.truePotential || p.ovr)) plusEins(p);
        else if (extra < 0 && p.ovr > alt) { const A = ['def', 'mid', 'att'].sort((a, b) => (p[b] || 0) - (p[a] || 0)); p[A[0]] = (p[A[0]] || 50) - 1; if (typeof computeOvrFromAreas === 'function') p.ovr = computeOvrFromAreas(p); }
      }
    });
    // b) Neue Talente: Scouting hebt/senkt das Potenzial, die Auffälligen des U15-Jahrgangs heben die Besten
    const neu = (CLUB.youthProspects || []).filter(p => !vorher.has(p.id));
    const pb = potBonus(n), auff = aufsteiger ? aufsteiger.auff : 0;
    neu.sort((a, b) => (b.truePotential || 0) - (a.truePotential || 0)).forEach((p, i) => {
      let b = pb + (i < auff ? 2 + Math.floor(rnd() * 3) : 0);
      p.truePotential = Math.max(p.ovr + 2, Math.min(96, (p.truePotential || p.ovr) + b));
      p.ksJahrgang = aufsteiger ? aufsteiger.jahr : null;
      try { if (typeof computeMarketValue === 'function') p.value = computeMarketValue(p); } catch (e) { /* Wert später */ }
    });
    return { neu: neu.length, auff };
  }

  // ── Wöchentlich: Philosophie-Bonus für Eigengewächse im Profikader ─────────────────────────────────────────────
  function woche() {
    if (!istPc() || !hatSpiel() || typeof SQUAD === 'undefined' || !CLUB.welt || !CLUB.welt.nlz) return;
    const n = CLUB.welt.nlz;
    SQUAD.forEach(p => {
      if (!istEigengewaechs(p) || (p.age || 30) > CFG.devAlter || (p.injuryWeeks || 0) > 0) return;
      if ((p.ovr || 0) >= (p.truePotential || (p.ovr || 0) + 5)) return;
      const ph = philVon(p), st = p.ksNlz && p.ksNlz.st != null ? p.ksNlz.st : philStaerke(n);
      const ch = CFG.devWoche * ph.dev * st;
      if (ch > 0 && rnd() < ch) { plusEins(p); try { if (typeof computeMarketValue === 'function') p.value = computeMarketValue(p); } catch (e) { /* später */ } }
    });
    erwRuf('woche', n);
  }

  // ── Haken ──────────────────────────────────────────────────────────────────────────────────────────────────────
  function haken() {
    // Akademie zum Saisonstart: erst Jahrgänge altern lassen, dann Original (Entwicklung + Auffüllen) mit Platz-Bonus, dann Bonus
    if (typeof W.generateYouthProspects === 'function') {
      const _g = W.generateYouthProspects;
      W.generateYouthProspects = function () {
        if (!istPc() || !hatSpiel()) return _g.apply(this, arguments);
        let n, aufsteiger = null, vorher = new Map(), _cap = null;
        try {
          n = z();
          // nur einmal je Saison altern (die Akademie wird beim Karrierestart und zum Saisonstart teils mehrfach gefüllt)
          if (n.gealtert !== LEAGUE.season) { n.gealtert = LEAGUE.season; aufsteiger = jahrgaengeAltern(n); }
          (CLUB.youthProspects || []).forEach(p => vorher.set(p.id, p.ovr || 0));
          const bonus = platzBonus(n);
          if (bonus && typeof W.youthCapacityForLevel === 'function') {
            _cap = W.youthCapacityForLevel;
            W.youthCapacityForLevel = function (l) { return Math.max(2, _cap(l) + bonus); };
            try { youthCapacityForLevel = W.youthCapacityForLevel; } catch (e) { /* window reicht */ }
          }
        } catch (e) { console.warn('[Kickstil-PC-NLZ] vor der Akademie', e); }
        let r;
        try { r = _g.apply(this, arguments); }
        finally { if (_cap) { W.youthCapacityForLevel = _cap; try { youthCapacityForLevel = _cap; } catch (e) { /* window reicht */ } } }
        try {
          const erg = akademieNachSaison(vorher, aufsteiger, n);
          if (aufsteiger) erwRuf('beiAltern', n, aufsteiger, (CLUB.youthProspects || []).filter(p => !vorher.has(p.id)));
          if (aufsteiger && typeof addNews === 'function') addNews('club', '🏫 NLZ: Jahrgang rückt auf',
            `Der Jahrgang ${aufsteiger.jahr} wechselt in den Leistungsbereich – ${aufsteiger.auff ? aufsteiger.auff + ' auffällige Spieler' : 'ohne Ausreißer nach oben'}. Neu in der Akademie: ${erg.neu} Talente.`);
        } catch (e) { console.warn('[Kickstil-PC-NLZ] nach der Akademie', e); }
        return r;
      };
      try { generateYouthProspects = W.generateYouthProspects; } catch (e) { /* window reicht */ }
    }
    // Hochziehen: Philosophie mitgeben (Universell/Mischform: eine Position mehr)
    if (typeof W.promoteProspect === 'function') {
      const _p = W.promoteProspect;
      W.promoteProspect = function (id) {
        const r = _p.apply(this, arguments);
        try {
          if (istPc() && hatSpiel() && typeof SQUAD !== 'undefined') {
            const p = SQUAD.find(x => x.id === 'sq_' + id);
            if (p && !p.ksNlz) {
              const n = z(), ph = CFG.phil[n.phil], st = philStaerke(n);
              p.ksNlz = { phil: n.phil, saison: LEAGUE.season, st: Math.round(st * 100) / 100 };
              try { if (W.DFLTaktik && DFLTaktik.eigenerStil) { const es = DFLTaktik.eigenerStil(); if (es && es.stil) p.ksNlz.stil = es.stil; } } catch (e) { /* ohne Stil */ }
              erwRuf('hochgezogen', n, p);
              if (rnd() < ph.pos * st) {
                const pos = p.positions && p.positions.length ? p.positions.slice() : [p.pos];
                const kand = (NACHBAR[p.pos] || []).filter(x => pos.indexOf(x) < 0);
                if (kand.length) { pos.push(kand[Math.floor(rnd() * kand.length)]); p.positions = pos; p.ksNlz.neuPos = pos[pos.length - 1]; }
              }
              if (typeof computeMarketValue === 'function') p.value = computeMarketValue(p);
            }
          }
        } catch (e) { console.warn('[Kickstil-PC-NLZ] Hochziehen', e); }
        return r;
      };
      try { promoteProspect = W.promoteProspect; } catch (e) { /* window reicht */ }
    }
    // Marktwert: Philosophie für eigene Eigengewächse
    if (typeof W.computeMarketValue === 'function') {
      const _m = W.computeMarketValue;
      W.computeMarketValue = function (p) {
        const v = _m.apply(this, arguments);
        try {
          if (istPc() && p && p.ksNlz && CFG.phil[p.ksNlz.phil] && typeof SQUAD !== 'undefined' && SQUAD.indexOf(p) >= 0) {
            const f = 1 + (CFG.phil[p.ksNlz.phil].wert - 1) * (p.ksNlz.st != null ? p.ksNlz.st : 1);
            return Math.round(v * f);
          }
        } catch (e) { /* Originalwert */ }
        return v;
      };
      try { computeMarketValue = W.computeMarketValue; } catch (e) { /* window reicht */ }
    }
    if (typeof W.advanceCalendarWeek === 'function') {
      const _w = W.advanceCalendarWeek;
      W.advanceCalendarWeek = function () { const r = _w.apply(this, arguments); try { if (r) woche(); } catch (e) { console.warn('[Kickstil-PC-NLZ] Woche', e); } return r; };
      try { advanceCalendarWeek = W.advanceCalendarWeek; } catch (e) { /* window reicht */ }
    }
    if (typeof W.startNewSeason === 'function') {
      const _s = W.startNewSeason;
      W.startNewSeason = function () { const r = _s.apply(this, arguments); try { if (istPc() && hatSpiel()) { saisonBuchen(); erwRuf('saison', z()); } } catch (e) { console.warn('[Kickstil-PC-NLZ] Saison', e); } return r; };
      try { startNewSeason = W.startNewSeason; } catch (e) { /* window reicht */ }
    }
    if (typeof W.switchAppView === 'function') {
      const _v = W.switchAppView;
      W.switchAppView = function (view, btn) {
        const v = $('view-nlz');
        if (view === 'nlz') {
          document.querySelectorAll('.appnav-btn').forEach(b => b.classList.remove('active'));
          document.querySelectorAll('.app > .app-view').forEach(x => x.classList.remove('active'));
          if (btn && btn.classList) btn.classList.add('active');
          if (v) v.classList.add('active');
          zeichnen(true); W.scrollTo({ top: 0 });
          return;
        }
        if (v) v.classList.remove('active');
        return _v.apply(this, arguments);
      };
      try { switchAppView = W.switchAppView; } catch (e) { /* window reicht */ }
    }
  }

  // ── Ansicht ────────────────────────────────────────────────────────────────────────────────────────────────────
  const CSS = `
#nav-nlz, #view-nlz { display: none; }
body.pcu-an #nav-nlz { display: flex; }
body.pcu-an #view-nlz.active { display: block; padding: 14px; }
#view-nlz .nz-kasten { background: var(--bg2); border: 2px solid var(--k-linie, var(--border)); border-radius: 14px; overflow: hidden; min-width: 0; }
#view-nlz .nz-kasten > h3 { margin: 0; padding: 8px 12px; font-family: var(--font-display, inherit); font-size: 15px; display: flex; justify-content: space-between; gap: 8px; align-items: baseline; border-bottom: 1px solid var(--k-linie, var(--border)); }
#view-nlz .nz-kasten > h3 small { font-family: var(--font-text, system-ui); font-size: 11px; color: var(--text3); font-weight: 800; }
#view-nlz .nz-kopf { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 18px; align-items: center; padding: 10px 16px; }
#view-nlz .nz-kopf h1 { margin: 0; font-family: var(--font-display, inherit); font-size: 22px; line-height: 1.05; }
#view-nlz .nz-kopf h1 small { display: block; font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--text3); }
#view-nlz .nz-kz { display: flex; gap: 22px; justify-content: flex-end; flex-wrap: wrap; }
#view-nlz .nz-kz div { display: grid; text-align: right; } #view-nlz .nz-kz b { font-family: var(--font-display, inherit); font-size: 19px; line-height: 1.1; font-variant-numeric: tabular-nums; }
#view-nlz .nz-kz small { font-size: 11px; font-weight: 800; color: var(--text3); }
#view-nlz .nz-reiter { display: flex; gap: 4px; padding: 3px; margin: 12px 0; width: max-content; max-width: 100%; flex-wrap: wrap; background: var(--bg2); border: 2px solid var(--k-linie, var(--border)); border-radius: 12px; }
#view-nlz .nz-reiter button { all: unset; cursor: pointer; font-family: var(--font-display, inherit); font-weight: 800; font-size: 15px; padding: 4px 16px; border-radius: 9px; color: var(--text2); }
#view-nlz .nz-reiter button.an { background: var(--k-blau-knopf, #2f6fca); color: #fff; }
#view-nlz .nz-reiter button:focus-visible, #view-nlz button:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
#view-nlz .nz-ueb { display: grid; grid-template-columns: 290px minmax(0, 1fr) 300px; gap: 14px; align-items: start; }
#view-nlz .nz-pyr { padding: 8px 12px 12px; display: flex; flex-direction: column; gap: 5px; }
#view-nlz .nz-ber { font-size: 10.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--text3); margin-top: 6px; }
#view-nlz .nz-stufe { all: unset; cursor: pointer; display: grid; grid-template-columns: 40px minmax(0, 1fr) 46px; gap: 8px; align-items: center; padding: 4px 6px; border-radius: 9px; }
#view-nlz .nz-stufe:hover, #view-nlz .nz-stufe.an { background: var(--bg3, rgba(0,0,0,.04)); } #view-nlz .nz-stufe.an { box-shadow: inset 3px 0 0 var(--k-blau-knopf, #2f6fca); }
#view-nlz .nz-stufe b { font-family: var(--font-display, inherit); font-size: 15px; }
#view-nlz .nz-balken { position: relative; height: 16px; border-radius: 6px; background: color-mix(in srgb, #4f9a3a 45%, var(--k-linie, #dcc39a)); overflow: hidden; }
#view-nlz .nz-balken u { position: absolute; top: 0; bottom: 0; right: 0; background: #b7791f; text-decoration: none; }
#view-nlz .nz-stufe small { font-size: 12px; font-weight: 800; text-align: right; color: var(--text2); font-variant-numeric: tabular-nums; }
#view-nlz .nz-jg { padding: 10px 12px; border-top: 1px dashed var(--k-linie, var(--border)); font-size: 13px; line-height: 1.45; color: var(--text2); }
#view-nlz table { width: 100%; border-collapse: collapse; font-size: 13px; font-variant-numeric: tabular-nums; }
#view-nlz th { font-size: 10.5px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--text3); text-align: right; padding: 7px 8px; border-bottom: 1px solid var(--k-linie, var(--border)); white-space: nowrap; }
#view-nlz th.l, #view-nlz td.l { text-align: left; }
#view-nlz td { padding: 5px 8px; text-align: right; border-bottom: 1px solid color-mix(in srgb, var(--k-linie, #dcc39a) 55%, transparent); white-space: nowrap; }
#view-nlz .nz-wer { display: flex; align-items: center; gap: 8px; } #view-nlz .nz-g { width: 30px; height: 30px; border-radius: 8px; overflow: hidden; background: var(--bg4, var(--bg3)); flex: none; }
#view-nlz .nz-g svg { width: 100%; height: 100%; display: block; } #view-nlz .nz-wer small { display: block; font-size: 11px; color: var(--text3); font-weight: 700; }
#view-nlz .nz-ovr { font-family: var(--font-display, inherit); font-weight: 800; font-size: 16px; }
#view-nlz .nz-pot { display: inline-block; position: relative; width: 84px; height: 8px; border-radius: 4px; background: var(--k-linie, var(--border)); vertical-align: middle; margin-left: 6px; }
#view-nlz .nz-pot i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 4px; background: #4f9a3a; }
#view-nlz .nz-pot u { position: absolute; top: 0; bottom: 0; border-radius: 4px; background: repeating-linear-gradient(45deg, rgba(79,154,58,.55) 0 4px, transparent 4px 8px); }
#view-nlz .nz-akt { display: flex; gap: 4px; justify-content: flex-end; }
#view-nlz .nz-leer { padding: 18px; text-align: center; color: var(--text2); }
#view-nlz .nz-zahlen { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 10px; }
#view-nlz .nz-zahlen div { background: var(--bg3, var(--bg)); border-radius: 9px; padding: 7px 10px; } #view-nlz .nz-zahlen small { display: block; font-size: 10.5px; font-weight: 800; color: var(--text3); text-transform: uppercase; letter-spacing: .05em; }
#view-nlz .nz-zahlen b { font-family: var(--font-display, inherit); font-size: 18px; }
#view-nlz .nz-wirk { padding: 10px 12px; font-size: 12.5px; color: var(--text2); line-height: 1.55; border-top: 1px dashed var(--k-linie, var(--border)); } #view-nlz .nz-wirk b { color: var(--text); }
#view-nlz .nz-phil { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
#view-nlz .nz-pk { all: unset; box-sizing: border-box; cursor: pointer; display: flex; flex-direction: column; gap: 8px; padding: 14px; border-radius: 14px; background: var(--bg2); border: 2px solid var(--k-linie, var(--border)); }
#view-nlz .nz-pk.an { border-color: var(--k-blau-knopf, #2f6fca); box-shadow: 0 0 0 3px color-mix(in srgb, var(--k-blau-knopf, #2f6fca) 30%, transparent); }
#view-nlz .nz-pk h2 { margin: 0; font-family: var(--font-display, inherit); font-size: 21px; } #view-nlz .nz-pk i.vb { font-size: 12.5px; color: var(--text2); }
#view-nlz .nz-pk ul { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; font-size: 13px; }
#view-nlz .nz-pk li::before { content: '+ '; font-weight: 800; color: #4f9a3a; } #view-nlz .nz-pk li.m::before { content: '− '; color: #c0392b; }
#view-nlz .nz-pk .st { margin-top: auto; font-weight: 800; font-size: 12.5px; color: var(--k-blau-knopf, #2f6fca); }
#view-nlz .nz-um { margin-top: 14px; padding: 12px 16px; font-size: 13px; color: var(--text2); line-height: 1.5; }
#view-nlz .nz-bud { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 14px; align-items: start; }
#view-nlz .nz-regler { display: grid; grid-template-columns: 160px minmax(0, 1fr) 70px; gap: 8px 12px; align-items: center; padding: 12px 14px; }
#view-nlz .nz-regler label { font-weight: 800; font-size: 13px; } #view-nlz .nz-regler label small { display: block; font-weight: 700; font-size: 11px; color: var(--text3); }
#view-nlz .nz-regler input { width: 100%; accent-color: var(--k-blau-knopf, #2f6fca); } #view-nlz .nz-regler output { text-align: right; font-weight: 800; font-variant-numeric: tabular-nums; }
#view-nlz .nz-fuss { padding: 0 14px 14px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap; } #view-nlz .nz-fuss small { color: var(--text2); }
@media (max-width: 1450px) { #view-nlz .nz-ueb { grid-template-columns: 250px minmax(0, 1fr); } #view-nlz .nz-ueb > .nz-rechts { grid-column: 1 / -1; } }
`;
  let teil = 'ueb', wahlJg = 0, entwurf = null, sig = '';
  function navAnlegen() {
    if ($('nav-nlz')) return;
    const scout = $('nav-scout'); if (!scout) return;
    scout.insertAdjacentHTML('afterend', `<button class="appnav-btn" id="nav-nlz" type="button" onclick="switchAppView('nlz', this)"><i class="ti ti-school" aria-hidden="true"></i> NLZ</button>`);
    const app = document.querySelector('.app'); if (app && !$('view-nlz')) app.insertAdjacentHTML('beforeend', '<div class="app-view" id="view-nlz"></div>');
  }
  function gesicht(p) { try { return W.KSVerein ? KSVerein.gesicht(p, 'fcm') : ''; } catch (e) { return ''; } }
  const ul = a => a <= 15 ? 'U16' : a === 16 ? 'U17' : a === 17 ? 'U18' : 'U19';
  function kennzahlen(n) {
    const sq = typeof SQUAD !== 'undefined' ? SQUAD : [], eg = sq.filter(istEigengewaechs), elf = new Set(Object.values(CLUB.lineup || {}));
    const plaetze = (typeof youthCapacityForLevel === 'function' ? youthCapacityForLevel((CLUB.facilities || {}).youth || 1) : 4) + platzBonus(n);
    return { eg: eg.length, elf: eg.filter(p => elf.has(p.id)).length, plaetze, belegt: (CLUB.youthProspects || []).length };
  }
  function kopfHtml(n) {
    const k = kennzahlen(n);
    return `<header class="nz-kasten nz-kopf"><h1><small>${esc(CLUB.name || '')}</small>Nachwuchsleistungszentrum</h1>
      <div class="nz-kz"><div><b>${esc(CFG.phil[n.phil].name)}</b><small>Philosophie${philStaerke(n) < 1 ? ' · Umstellung ' + Math.round(philStaerke(n) * 100) + ' %' : ''}</small></div>
        <div><b>${mio(n.budget)}</b><small>Budget je Saison</small></div><div><b>${k.belegt} / ${k.plaetze}</b><small>Akademie-Plätze</small></div>
        <div><b>${k.elf} / 11</b><small>Eigengewächse in der Elf</small></div><div><b>${n.jahrgaenge.reduce((a, j) => a + j.kinder, 0) + k.belegt}</b><small>Kinder und Jugendliche</small></div></div></header>
      <div class="nz-reiter" role="tablist">${[['ueb', 'Überblick']].concat(ERW.filter(e => e.tab).map(e => [e.tab.id, e.tab.name]), [['phil', 'Philosophie'], ['bud', 'Budget']]).map(([t, x]) => `<button type="button" data-nz-t="${t}" class="${t === teil ? 'an' : ''}">${x}</button>`).join('')}</div>`;
  }
  function uebHtml(n) {
    const jg = n.jahrgaenge.slice().sort((a, b) => a.jahr - b.jahr), juengster = Math.max(...jg.map(j => j.jahr));
    const alter = j => 9 + (juengster - j.jahr), stufe = j => 'U' + alter(j);
    let pyr = '<div class="nz-ber">Aufbaubereich</div>';
    jg.forEach((j, i) => {
      if (alter(j) === 11 && i > 0) pyr += '<div class="nz-ber">Grundlagenbereich</div>';
      pyr += `<button type="button" class="nz-stufe${i === wahlJg ? ' an' : ''}" data-nz-jg="${i}"><b>${stufe(j)}</b><span class="nz-balken" style="width:${40 + j.kinder * 2.6}%"><u style="width:${j.auff * 12}%"></u></span><small>${j.kinder}·${j.auff}</small></button>`;
    });
    const s = jg[wahlJg] || jg[0];
    const txt = s ? `Jahrgang ${s.jahr}: ${s.kinder} Kinder, ${s.auff ? s.auff + ' fallen auf' : 'noch niemand fällt auf'}. ${alter(s) >= 14 ? 'Rückt bald in den Leistungsbereich auf – die Auffälligen heben das Potenzial der neuen Talente.' : alter(s) <= 11 ? 'Noch Spaß am Spiel, wenig Aussagekraft.' : 'Hier zeigt sich langsam, wer es schaffen kann.'}` : '';
    const sc = (CLUB.facilities && CLUB.facilities.scouting) || 1;
    const tal = (CLUB.youthProspects || []).slice().sort((a, b) => (b.truePotential || 0) - (a.truePotential || 0));
    const zeilen = tal.map(p => {
      let r = { lo: p.truePotential, hi: p.truePotential }; try { r = potentialRange(p, sc); } catch (e) { /* genau */ }
      return `<tr><td class="l"><span class="nz-wer"><span class="nz-g" aria-hidden="true">${gesicht(p)}</span><span><span class="pos-badge-sm pos-${esc(p.pos)}">${esc(p.pos)}</span> <b>${esc((p.firstName ? p.firstName + ' ' : '') + p.name)}</b><small>${ul(p.age)}${p.ksJahrgang ? ' · Jahrgang ' + p.ksJahrgang : ''}</small></span></span></td>
        <td>${p.age}</td><td class="nz-ovr">${p.ovr}</td><td class="l">${r.lo === r.hi ? r.hi : r.lo + '–' + r.hi}<span class="nz-pot"><i style="width:${p.ovr}%"></i><u style="left:${r.lo}%;width:${Math.max(1, r.hi - r.lo)}%"></u></span></td>
        <td><span class="nz-akt">${(p.age || 0) >= 16 ? `<button type="button" class="app-knopf" data-nz-hoch="${esc(p.id)}">Hochziehen</button>` : ''}<button type="button" class="app-knopf" data-nz-weg="${esc(p.id)}">Entlassen</button></span></td></tr>`;
    }).join('');
    const k = kennzahlen(n), w = wirkung(n);
    return `<div class="nz-ueb"><section class="nz-kasten"><h3>Altersstufen <small>Kinder · auffällig</small></h3><div class="nz-pyr">${pyr}</div><div class="nz-jg">${esc(txt)}</div></section>
      <section class="nz-kasten"><h3>Leistungsbereich <small>${tal.length} Talente · U16–U19</small></h3>${tal.length ? `<table><thead><tr><th class="l">Talent</th><th>Alter</th><th>Stärke</th><th class="l">Potenzial</th><th></th></tr></thead><tbody>${zeilen}</tbody></table>` : '<div class="nz-leer">Gerade keine Talente in der Akademie – zum Saisonstart rückt der nächste Jahrgang auf.</div>'}</section>
      <aside class="nz-rechts"><section class="nz-kasten"><h3>Bilanz <small>dein Verein</small></h3><div class="nz-zahlen"><div><small>Eigengewächse im Kader</small><b>${k.eg}</b></div><div><small>davon in der Elf</small><b>${k.elf}</b></div>
        <div><small>Akademie-Plätze</small><b>${k.belegt} / ${k.plaetze}</b></div><div><small>Abbrecher je Jahrgang</small><b>~${Math.round(abbrecherRate(n) * 100)} %</b></div></div>
        <div class="nz-wirk"><b>Wirkung deines Budgets:</b><br>Ausbildung ${fmtP(devFaktor(n))} · neue Talente Potenzial ${potBonus(n) >= 0 ? '+' : ''}${potBonus(n)} · Plätze ${platzBonus(n) >= 0 ? '+' : ''}${platzBonus(n)} · Kinder je Jahrgang ~${kinderJeJahrgang(n)}<br><b>Philosophie:</b> ${esc(CFG.phil[n.phil].name)} (${Math.round(philStaerke(n) * 100)} %)</div></section></aside></div>`;
  }
  const fmtP = f => (f >= 1 ? '+' : '−') + Math.round(Math.abs(f - 1) * 100) + ' %';
  function philHtml(n) {
    return `<div class="nz-phil">${Object.entries(CFG.phil).map(([k, p]) => `<button type="button" class="nz-pk${k === n.phil ? ' an' : ''}" data-nz-phil="${k}" aria-pressed="${k === n.phil}"><h2>${p.name}</h2><i class="vb">Vorbild: ${esc(p.vorbild)}</i>
      <ul>${p.plus.map(x => `<li>${esc(x)}</li>`).join('')}${p.minus.map(x => `<li class="m">${esc(x)}</li>`).join('')}</ul><span class="st">${k === n.phil ? 'Gewählt' : 'Wählen'}</span></button>`).join('')}</div>
      <div class="nz-kasten nz-um"><b>Wechsel wirkt über die Jahrgänge:</b> Eine neue Philosophie wirkt im ersten Jahr zu 34 %, im zweiten zu 67 %, ab dem dritten voll. Jedes Eigengewächs behält die Philosophie, mit der es hochgezogen wurde. Jetzt: <b>${Math.round(philStaerke(n) * 100)} %</b>.</div>`;
  }
  function budHtml(n) {
    const sp = spanne(), e = entwurf || { budget: n.budget, anteile: Object.assign({}, n.anteile) };
    const step = Math.round((sp[1] - sp[0]) / 60 / 10000) * 10000 || 10000;
    const kosten = Math.round((e.budget - n.budget) * restAnteil() / 1000) * 1000, saison = Math.round((e.budget - sp[2]) / 1000) * 1000;
    const w = wirkung({ budget: e.budget, anteile: e.anteile }), sum = Object.values(e.anteile).reduce((a, b) => a + b, 0) || 100;
    const NAME = { trainer: ['Trainer', 'Ausbildung der Akademie-Talente'], scouting: ['Scouting', 'Potenzial der Neuen, Kinder je Jahrgang'], internat: ['Internat & Schule', 'Akademie-Plätze, weniger Abbrecher'], medizin: ['Medizin & Psychologie', 'weniger Abbrecher'] };
    return `<div class="nz-bud"><section class="nz-kasten"><h3>Budget <small>Spanne ${mio(sp[0])} – ${mio(sp[1])} · Standard ${mio(sp[2])}</small></h3>
      <div class="nz-regler"><label for="nz-ges">Gesamt<small>je Saison</small></label><input id="nz-ges" type="range" min="${sp[0]}" max="${sp[1]}" step="${step}" value="${e.budget}"><output>${mio(e.budget)}</output>
        ${Object.keys(CFG.anteile).map(k => `<label for="nz-a-${k}">${NAME[k][0]}<small>${NAME[k][1]}</small></label><input id="nz-a-${k}" data-nz-a="${k}" type="range" min="0" max="70" step="5" value="${e.anteile[k]}"><output>${Math.round(e.anteile[k] / sum * 100)} %</output>`).join('')}</div>
      <div class="nz-fuss"><button type="button" class="app-knopf" data-nz-ok="1"${e.budget === n.budget && JSON.stringify(e.anteile) === JSON.stringify(n.anteile) ? ' disabled' : ''}>Übernehmen</button>
        <small>${kosten ? `Für den Rest der Saison: ${kosten > 0 ? euro(kosten) + ' Mehrkosten' : euro(-kosten) + ' gespart'}. ` : ''}Ab der nächsten Saison ${saison > 0 ? euro(saison) + ' über dem Standard' : saison < 0 ? euro(-saison) + ' unter dem Standard' : 'wie der Standard'} (der steckt schon in den Betriebskosten).</small></div></section>
      <section class="nz-kasten"><h3>Wirkung <small>gegen den Ligastandard</small></h3><div class="nz-wirk" style="border:0">
        <b>Trainer:</b> Ausbildung ${fmtP(Math.max(0.85, Math.min(1.3, 1 + 0.15 * (w.trainer - 1))))} (Entwicklung der Akademie-Talente je Saison).<br>
        <b>Scouting:</b> neue Talente Potenzial ${(x => (x >= 0 ? '+' : '') + x)(Math.round(Math.max(-3, Math.min(4, 3 * (w.scouting - 1)))))}, ~${Math.round(Math.max(8, Math.min(24, (8 + Math.log10(Math.max(20000, einwohner()) / 20000) * 6) * Math.sqrt(w.scouting))))} Kinder je Jahrgang (${Math.round(einwohner() / 1000)} Tsd. Einwohner).<br>
        <b>Internat:</b> Akademie-Plätze ${(x => (x >= 0 ? '+' : '') + x)(w.internat >= 1.8 ? 2 : w.internat >= 1.3 ? 1 : w.internat < 0.5 ? -1 : 0)}.<br>
        <b>Internat + Medizin:</b> Abbrecher je Jahrgang ~${Math.round(CFG.abbrecher * Math.max(0.3, 1.5 - 0.35 * Math.min(2, w.internat) - 0.15 * Math.min(2, w.medizin)) * 100)} %.</div></section></div>`;
  }
  function zeichnen(erzwingen) {
    if (!istPc() || !hatSpiel()) return;
    navAnlegen();
    const v = $('view-nlz'); if (!v || !v.classList.contains('active')) return;
    const n = z();
    const s = JSON.stringify([teil, wahlJg, entwurf, n, (CLUB.youthProspects || []).map(p => p.id + p.ovr), CLUB.budget, LEAGUE.season, LEAGUE.week]);
    if (!erzwingen && s === sig) return; sig = s;
    const et = ERW.find(e => e.tab && e.tab.id === teil);
    v.innerHTML = kopfHtml(n) + (et ? et.tab.html(n) : teil === 'phil' ? philHtml(n) : teil === 'bud' ? budHtml(n) : uebHtml(n));
    if (et && et.tab.nach) { try { et.tab.nach(n, v); } catch (e) { /* Anzeige */ } }
  }
  function klick(ev) {
    const v = $('view-nlz'); if (!v || !v.contains(ev.target)) return;
    const t = ev.target, n = z();
    const r = t.closest('[data-nz-t]'); if (r) { teil = r.getAttribute('data-nz-t'); entwurf = null; zeichnen(true); return; }
    const j = t.closest('[data-nz-jg]'); if (j) { wahlJg = +j.getAttribute('data-nz-jg'); zeichnen(true); return; }
    for (const e of ERW) { if (e.tab && e.tab.id === teil && e.tab.klick) { try { if (e.tab.klick(ev, n)) { zeichnen(true); return; } } catch (er) { console.warn('[Kickstil-PC-NLZ] Klick', er); } } }
    const ph = t.closest('[data-nz-phil]');
    if (ph) { const k = ph.getAttribute('data-nz-phil'); if (k !== n.phil) { n.phil = k; n.philSeit = LEAGUE.season; toast(`Philosophie: ${CFG.phil[k].name} – wirkt ab jetzt zu 34 %, in drei Jahren voll.`, 'info'); try { saveGameState(); } catch (e) { /* später */ } } zeichnen(true); return; }
    const ok = t.closest('[data-nz-ok]'); if (ok && entwurf) { if (budgetSetzen(entwurf.budget, entwurf.anteile)) entwurf = null; zeichnen(true); return; }
    const h = t.closest('[data-nz-hoch]'); if (h && typeof W.promoteProspect === 'function') { W.promoteProspect(h.getAttribute('data-nz-hoch')); zeichnen(true); return; }
    const w = t.closest('[data-nz-weg]'); if (w && typeof W.releaseProspect === 'function') { W.releaseProspect(w.getAttribute('data-nz-weg')); zeichnen(true); }
  }
  function regler(ev) {
    const v = $('view-nlz'); if (!v || !v.contains(ev.target)) return;
    const n = z();
    for (const e of ERW) { if (e.tab && e.tab.id === teil && e.tab.regler) { try { if (e.tab.regler(ev, n)) { const alt = document.activeElement && document.activeElement.id; zeichnen(true); if (alt && $(alt)) $(alt).focus(); return; } } catch (er) { /* weiter */ } } }
    if (!entwurf) entwurf = { budget: n.budget, anteile: Object.assign({}, n.anteile) };
    if (ev.target.id === 'nz-ges') entwurf.budget = +ev.target.value;
    const a = ev.target.getAttribute('data-nz-a'); if (a) entwurf.anteile[a] = +ev.target.value;
    // nur die Zahlen neu – der Regler behält den Fokus
    const alt = document.activeElement && document.activeElement.id; zeichnen(true); if (alt && $(alt)) $(alt).focus();
  }

  function start() {
    if ($('nz-css')) return;
    haken();
    if (!istPc()) return;
    const st = document.createElement('style'); st.id = 'nz-css'; st.textContent = CSS; document.head.appendChild(st);
    document.addEventListener('click', klick);
    document.addEventListener('change', regler);
    setInterval(() => zeichnen(false), CFG.takt);
    setTimeout(() => { try { if (hatSpiel()) { navAnlegen(); z(); } } catch (e) { /* später */ } }, 1500);
    console.log('[Kickstil-PC-NLZ v1] aktiv — Nachwuchsleistungszentrum Etappe 1: Philosophie, Altersstufen, Budget (nur PC)');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  W.KSNlz = { CFG, z: () => (hatSpiel() ? z() : null), wirkung: n => wirkung(n), oeffnen: () => { navAnlegen(); const b = $('nav-nlz'); if (b) W.switchAppView('nlz', b); }, saisonBuchen,
    erweitern: e => { ERW.push(e); }, faktor: (art, n, p) => erwFaktor(art, n || (CLUB.welt && CLUB.welt.nlz), p), neuZeichnen: () => zeichnen(true), teil: t => { if (t) { teil = t; zeichnen(true); } return teil; },
    hilfe: { esc, mio, euro, toast, istPc, hatSpiel, tierKey, spanne, istEigengewaechs, einwohner, philStaerke, gesicht } };
})();
