/* ═══════════════════════════════════════════════════════════════════════════
   DFL · EHRUNGEN DER WOCHE  ·  v1   (Rückmeldung 17.10. (9), Nutzer: „Spieler der Woche in der jeweiligen Conference … wie ein
   Moment, wenn es deiner ist, und der hat dann eine Special-Karte für die Woche und einen Formboost von +3 – Offensiv- und
   Defensivspieler wie in der NFL … oder eine Mannschaft der Woche, dann bekommt man das gesamte Team gezeigt, wenn Spieler von
   dir dabei sind, Special-Karte und +2“; „wenn sie eine Karte bekommen, bekommen sie auch einen Stat-Boost“)
   ─────────────────────────────────────────────────────────────────────────
   Nach jedem Spieltag der regulären Saison (Hülle um advanceMatchday, auch Bye-Runden ohne eigenes Spiel):
     · Team der Woche, ligaweit im 4-3-3 (+2 im nächsten Spiel)
     · am letzten Spieltag eines Kalendermonats (seit 2026-10-22 statt wöchentlich): Offensiv- und Defensivspieler des Monats je
       Conference und Rookie des Monats (Spieler im ersten Jahr des Rookievertrags), Schnitt der Wochennoten, mind. 2 Einsätze,
       +2 Stärke für die nächsten 4 Spiele des Teams
   Wochennote für alle gleich aus Tore/Vorlagen/Einsatz dieses Spieltags
   (LEAGUE.dflStat vorher/nachher, dfl_statistik_patch.js), Ergebnis, Zu-null für die Abwehr, Stärke und etwas Zufall; bei
   eigenen Spielern zusätzlich (echte Note − 7) × 0,4.
   Bonus: wirkt bis einschließlich zum nächsten Spiel des Teams (Bye Weeks übersprungen) wie ein umgekehrter Rückstand –
   eigene Spieler über DFLPosition (Elf, Teamstärke, Engine), KI über DFLSaison.CFG.kartenBonus (Spielformel, Gegner im
   eigenen Spiel). Mehrere Boni: der höchste zählt.
   Anzeige: Postfach-Meldung je Spieltag; ist ein eigener Spieler dabei, ein Moment mit seiner Prunkkarte (Team der Woche mit
   der ganzen Elf), sobald das Office wieder zu sehen ist; Spieler-Blatt zeigt die Sonderkarte, solange der Bonus gilt.
   Zustand: LEAGUE.dflWoche = { saison, letzte: [Woche], monat (laufend), monate: [Monat], bonus: { dflId: { w, bis, s, art } }, warte: [Moment] }.
   Lädt nach dfl_statistik/dfl_medizin/dfl_lernen (äußere Hülle) und kickstil_prunkkarte.js, vor init_bootstrap.js.
   API: DFLWoche.bonus(p) · .sonderKarte(p, ovr, ax, gesicht, opt) · .letzte() · .monate() · .zeigeMoment() · .CFG
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const D = window.DFLSpiel, S = window.DFLSaison, I = window.DFLIdentitaet;
  if (!D || !S) { console.warn('[DFL-Woche] DFL-Module fehlen – Patch inaktiv'); return; }
  const CFG = {
    // 2026-10-22 (Nutzer: „Defensive Spieler of the week ist nochmal mehr Bonus … doppelt gemoppelt … Spieler des Monats und dann
    // gibt es für den gesamten Monat die Steigerung“ – „ja 2 macht Sinn“): Offensiv/Defensiv je Conference und Rookie nur noch
    // einmal im Monat (+2 für die nächsten 4 Spiele), das Team der Woche bleibt wöchentlich (+2 im nächsten Spiel)
    bonus: { off: 2, def: 2, rookie: 2, team: 2 },
    monat: { spiele: 4, minEinsaetze: 2 },             // Bonus für so viele Spiele · Einsätze im Monat, um zu zählen
    // Wochennote der KI: Grund 6,0 + (Stärke − 75) × 0,06, Sieg +0,5 / Remis +0,1 / Niederlage −0,3, Tor +1,0, Vorlage +0,6,
    // Abwehr (TW/IV/LV/RV/ZDM): zu null +0,8 (TW +1,0), je Gegentor −0,25; Zufall ±0,35
    note: { grund: 6, staerke: 0.06, sieg: 0.5, remis: 0.1, niederlage: -0.3, tor: 1, vorlage: 0.6, null: 0.8, nullTw: 1, gegentor: -0.25, zufall: 0.35, echt: 0.4 },
    behalten: 4,                       // so viele Wochen bleiben im Spielstand
    aus: false
  };
  const KONF = { SUE_WEST: 'Süd-West', NORD_OST: 'Nord-Ost' };
  const ABWEHR = new Set(['TW', 'IV', 'LV', 'RV', 'AV', 'ZDM']);
  // Team der Woche 4-3-3: Plätze und wer darauf darf (Hauptposition)
  const ELF = [['TW', ['TW']], ['LV', ['LV', 'AV']], ['IV', ['IV']], ['IV', ['IV']], ['RV', ['RV', 'AV']],
    ['ZM', ['ZDM', 'ZM', 'OM']], ['ZM', ['ZM', 'OM', 'ZDM']], ['ZM', ['OM', 'ZM', 'ZDM']], ['LF', ['LF', 'LM', 'FL']], ['ST', ['ST']], ['RF', ['RF', 'RM', 'FL']]];
  const ART = {
    off: { name: 'Offensivspieler des Monats', ed: 'sdw' },
    def: { name: 'Defensivspieler des Monats', ed: 'abwehr' },
    rookie: { name: 'Rookie des Monats', ed: 'zukunft' },
    team: { name: 'Team der Woche', ed: 'tdw' },
    diamant: { name: 'Rohdiamant entdeckt', ed: 'diamant' }
  };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const dfl = () => typeof CLUB !== 'undefined' && CLUB && CLUB.dfl && CLUB.dfl.aktiv && typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.dfl;
  const komma = x => x.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const POS_ANZ = { OM: 'ZOM' };
  const posAnz = p => POS_ANZ[p] || p;

  function zustand() {
    let z = LEAGUE.dflWoche;
    if (!z || typeof z !== 'object') z = LEAGUE.dflWoche = { saison: LEAGUE.season, letzte: [], bonus: {}, warte: [] };
    if (!z.bonus) z.bonus = {};
    if (!Array.isArray(z.letzte)) z.letzte = [];
    if (!Array.isArray(z.warte)) z.warte = [];
    return z;
  }

  // ── Bonus ────────────────────────────────────────────────────────────────
  const schluessel = p => p && (p.dflId || p.id);
  function bonusEintrag(p) {
    if (!dfl() || !LEAGUE.dflWoche || !LEAGUE.dflWoche.bonus) return null;
    const b = LEAGUE.dflWoche.bonus[schluessel(p)];
    return b && b.s === LEAGUE.season && LEAGUE.matchday < b.bis ? b : null;
  }
  const bonus = p => { const b = bonusEintrag(p); return b ? b.w : 0; };
  S.CFG.kartenBonus = p => bonus(p);

  // Detailwerte der Engine: ändert sich der Bonus, den Werte-Cache des Spielers verwerfen (wie der Rückstand in dfl_medizin_patch.js)
  {
    const _orig = window.spielerWerte;
    const versteckt = (o, k, v) => { try { Object.defineProperty(o, k, { value: v, enumerable: false, writable: true, configurable: true }); } catch (e) { o[k] = v; } };
    if (typeof _orig === 'function') window.spielerWerte = function (p) {
      if (p && typeof p === 'object') {
        const sig = bonus(p);
        if ((p._dwk || 0) !== sig) { try { delete p._werte; delete p._werteAlt; } catch (e) { p._werte = null; p._werteAlt = null; } versteckt(p, '_dwk', sig); }
      }
      return _orig.apply(this, arguments);
    };
  }
  // Nächste Runde (Index), in der ein Team spielt, ab Runde md
  function naechsteRunde(league, md, dflId) {
    const fg = findFcmGroup(league), plan = league.fixtures[fg.key] || [];
    for (let i = md; i < plan.length; i++) if (plan[i].some(([h, a]) => D.dflIdVon(h) === dflId || D.dflIdVon(a) === dflId)) return i;
    return -1;
  }
  function bonusSetzen(league, eintrag, art, spiele) {
    const z = zustand(), w = CFG.bonus[art];
    let i = naechsteRunde(league, league.matchday, eintrag.team);
    for (let n = 1; i >= 0 && n < (spiele || 1); n++) { const j = naechsteRunde(league, i + 1, eintrag.team); if (j < 0) break; i = j; }   // n-tes Spiel des Teams
    if (i < 0 || !w) return;
    const alt = z.bonus[eintrag.id];
    if (alt && alt.s === league.season && league.matchday < alt.bis && alt.w >= w) return;   // höherer Bonus bleibt
    z.bonus[eintrag.id] = { w, bis: i + 1, s: league.season, art };
  }
  function bonusAufraeumen() {
    const z = zustand();
    Object.keys(z.bonus).forEach(k => { const b = z.bonus[k]; if (!b || b.s !== LEAGUE.season || LEAGUE.matchday >= b.bis) delete z.bonus[k]; });
  }

  // ── Wochennote ───────────────────────────────────────────────────────────
  function statStand() {
    const L = D.liga(), rec = LEAGUE.dflStat && LEAGUE.dflStat[L.saisonJahr], m = new Map();
    if (!rec) return m;
    const dazu = (id, a) => { const v = m.get(id) || [0, 0, 0]; v[0] += a[0]; v[1] += a[1]; v[2] += a[2]; m.set(id, v); };
    Object.values(rec.ki || {}).forEach(tab => Object.keys(tab).forEach(id => dazu(id, tab[id])));
    Object.keys(rec.eigen || {}).forEach(id => dazu(id, rec.eigen[id]));
    return m;
  }
  function wochenNoten(vorher, nachher, spiele) {
    const L = D.liga(), eigen = D.eigeneDflId(), N = CFG.note, out = [];
    const ergebnis = new Map();                                  // dflId → { gf, ga }
    spiele.forEach(([h, g, th, tg]) => { ergebnis.set(D.dflIdVon(h), { gf: th, ga: tg }); ergebnis.set(D.dflIdVon(g), { gf: tg, ga: th }); });
    const kader = typeof SQUAD !== 'undefined' ? SQUAD : [];
    // Eigene Spieler mit der Position, auf der sie gespielt haben (Platz in der Aufstellung) – vorher zählte die Stammposition der
    // Welt: ein gelernter Stürmer, den du links hinten aufstellst, landete im Team der Woche im Sturm (Testrückmeldung 2026-10-22)
    const gespielt = new Map();
    try {
      const P = window.DFLPosition, slots = (typeof FORMATIONS !== 'undefined' && CLUB && FORMATIONS[CLUB.formation]) || [];
      if (P && P.platzAusSlot) slots.forEach(sl => { const id = CLUB.lineup && CLUB.lineup[sl.id], z = id ? P.platzAusSlot(sl) : null; if (z) gespielt.set(id, z === 'ZOM' ? 'OM' : z); });   // Welt-Kürzel: ZOM heißt dort OM
    } catch (e) { /* ohne Aufstellung: Stammposition */ }
    L.teams.forEach(t => {
      const e = ergebnis.get(t.id); if (!e) return;               // Bye Week
      const ausgang = e.gf > e.ga ? N.sieg : e.gf === e.ga ? N.remis : N.niederlage;
      t.roster.forEach(p => {
        const a = vorher.get(p.id) || [0, 0, 0], b = nachher.get(p.id) || [0, 0, 0];
        if (b[2] <= a[2]) return;                                 // nicht gespielt
        const tore = b[0] - a[0], vorlagen = b[1] - a[1];
        // Für alle dieselbe Formel (sonst gewinnen eigene Spieler mit ihren echten Engine-Noten fast jede Woche – Bot-Lauf 17.10.:
        // 4 von 11 im Team der Woche); die echte Note des eigenen Spiels fließt nur leicht ein
        const q = t.id === eigen ? kader.find(x => (x.dflId || x.id) === p.id) : null;
        const pos = (q && gespielt.get(q.id)) || p.pos;
        let note = N.grund + ((p.ovr || 70) - 75) * N.staerke + ausgang + tore * N.tor + vorlagen * N.vorlage + (Math.random() - 0.5) * 2 * N.zufall;
        if (ABWEHR.has(pos)) note += e.ga === 0 ? (pos === 'TW' ? N.nullTw : N.null) : e.ga * N.gegentor;
        if (q && typeof q.lastMatchRating === 'number') note += (q.lastMatchRating - 7) * N.echt;
        note = Math.max(3, Math.min(10, Math.round(note * 10) / 10));
        const rookie = !!(p.contract && p.contract.art === 'rookie' && p.contract.years_remaining === p.contract.years_total);
        out.push({ id: p.id, team: t.id, konf: t.conference, name: (p.firstName ? p.firstName[0] + '. ' : '') + p.name, pos, ovr: p.ovr,
          note, tore, vorlagen, rookie, eigen: t.id === eigen });
      });
    });
    return out;
  }
  const besser = (a, b) => b.note - a.note || (b.tore + b.vorlagen) - (a.tore + a.vorlagen) || b.ovr - a.ovr;
  function teamDerWoche(alle) {
    const frei = alle.slice().sort(besser), elf = [];
    ELF.forEach(([platz, erlaubt], idx) => {
      let i = frei.findIndex(x => erlaubt[0] === x.pos);
      if (i < 0) i = frei.findIndex(x => erlaubt.indexOf(x.pos) >= 0);
      if (i < 0) return;
      elf.push(Object.assign({ platz, idx }, frei[i])); frei.splice(i, 1);
    });
    return elf;
  }

  // ── Spieltag auswerten ───────────────────────────────────────────────────
  function auswerten(nr, vorher) {
    const st = LEAGUE.dflSpieltag;
    if (!st || st.saison !== LEAGUE.season || st.nr !== nr || !st.spiele || !st.spiele.length) return;
    const alle = wochenNoten(vorher, statStand(), st.spiele);
    if (alle.length < 30) return;
    const woche = { nr, kw: LEAGUE.week, saison: LEAGUE.season, team: [] };
    woche.team = teamDerWoche(alle);
    woche.team.forEach(x => bonusSetzen(LEAGUE, x, 'team'));
    const z = zustand();
    z.saison = LEAGUE.season;
    z.letzte.unshift(woche); z.letzte = z.letzte.slice(0, CFG.behalten);
    const momente = [];
    if (woche.team.some(x => x.eigen)) momente.push({ art: 'team', nr, saison: LEAGUE.season });
    // Monat: Wochennoten sammeln, am letzten Spieltag eines Kalendermonats (oder der Hauptrunde) die Monatsbesten küren
    const mo = monatSammeln(z, nr, alle);
    const naechste = (LEAGUE.matchWeeks || [])[nr];
    const ende = nr >= maxMatchday(LEAGUE) || naechste == null || monatVon(naechste) !== mo.name;
    const monat = ende ? monatKueren(z) : null;
    if (monat) momente.unshift(...monatMomente(monat));
    z.warte = z.warte.filter(m => m.art === 'diamant').concat(momente);
    melden(woche, monat);
  }
  // ── Spieler des Monats ───────────────────────────────────────────────────
  const monatVon = w => (typeof calendarMonthOfWeek === 'function' ? calendarMonthOfWeek(w) : 'Monat ' + Math.ceil(w / 4));
  function monatSammeln(z, nr, alle) {
    const name = monatVon((LEAGUE.matchWeeks || [])[nr - 1] || LEAGUE.week);
    if (!z.monat || z.monat.saison !== LEAGUE.season || z.monat.name !== name) z.monat = { saison: LEAGUE.season, name, ab: nr, spiele: 0, sp: {} };
    const mo = z.monat;
    mo.spiele++; mo.bis = nr;
    alle.forEach(x => {
      const v = mo.sp[x.id] || (mo.sp[x.id] = { team: x.team, konf: x.konf, name: x.name, pos: x.pos, ovr: x.ovr, rookie: x.rookie, eigen: x.eigen, summe: 0, n: 0, tore: 0, vorlagen: 0 });
      v.summe += x.note; v.n++; v.tore += x.tore; v.vorlagen += x.vorlagen; v.pos = x.pos; v.ovr = x.ovr; v.team = x.team; v.eigen = x.eigen;
    });
    return mo;
  }
  function monatKueren(z) {
    const mo = z.monat; if (!mo || mo.gekuert) return null;
    mo.gekuert = true;
    const min = Math.min(CFG.monat.minEinsaetze, mo.spiele);
    const alle = Object.keys(mo.sp).map(id => Object.assign({ id }, mo.sp[id], { note: Math.round(mo.sp[id].summe / mo.sp[id].n * 10) / 10 })).filter(x => x.n >= min);
    const besserM = (a, b) => b.note - a.note || (b.tore + b.vorlagen) - (a.tore + a.vorlagen) || b.n - a.n || b.ovr - a.ovr;
    const m = { name: mo.name, saison: mo.saison, ab: mo.ab, bis: mo.bis, spiele: mo.spiele, off: {}, def: {}, rookie: null,
      ohneBonus: LEAGUE.matchday >= maxMatchday(LEAGUE) };              // letzter Monat der Hauptrunde: keine Ligaspiele mehr für den Bonus
    Object.keys(KONF).forEach(k => {
      const konf = alle.filter(x => x.konf === k);
      m.off[k] = konf.filter(x => !ABWEHR.has(x.pos)).sort(besserM)[0] || null;
      m.def[k] = konf.filter(x => ABWEHR.has(x.pos)).sort(besserM)[0] || null;
    });
    m.rookie = alle.filter(x => x.rookie).sort(besserM)[0] || null;
    const n = CFG.monat.spiele;
    Object.keys(KONF).forEach(k => { if (m.off[k]) bonusSetzen(LEAGUE, m.off[k], 'off', n); if (m.def[k]) bonusSetzen(LEAGUE, m.def[k], 'def', n); });
    if (m.rookie) bonusSetzen(LEAGUE, m.rookie, 'rookie', n);
    z.monate = [m].concat((z.monate || []).filter(x => x.saison === LEAGUE.season)).slice(0, 3);
    z.monat = null;
    return m;
  }
  function monatMomente(m) {
    const out = [];
    const x = { monat: m.name, saison: m.saison, ohneBonus: !!m.ohneBonus };
    Object.keys(KONF).forEach(k => { if (m.off[k] && m.off[k].eigen) out.push(Object.assign({ art: 'off', konf: k, e: m.off[k] }, x)); });
    Object.keys(KONF).forEach(k => { if (m.def[k] && m.def[k].eigen) out.push(Object.assign({ art: 'def', konf: k, e: m.def[k] }, x)); });
    if (m.rookie && m.rookie.eigen) out.push(Object.assign({ art: 'rookie', e: m.rookie }, x));
    return out;
  }
  function melden(w, m) {
    const L = D.liga(), tname = id => { const t = L.teams.find(x => x.id === id); return t ? t.name : id; };
    const zeile = e => e ? `${e.name} (${tname(e.team)}, Ø Note ${komma(e.note)}${e.tore ? ', ' + e.tore + ' Tor' + (e.tore > 1 ? 'e' : '') : ''})` : '–';
    const eigene = w.team.filter(x => x.eigen).map(x => x.name);
    try { addNews('season', `Team der Woche · Spieltag ${w.nr}`, eigene.length ? `${eigene.length} von dir dabei: ${eigene.join(', ')}.` : 'Diesmal ohne deine Spieler.'); } catch (e) { /* Meldung optional */ }
    if (!m) return;
    const text = Object.keys(KONF).map(k => `${KONF[k]}: Offensiv ${zeile(m.off[k])}, Defensiv ${zeile(m.def[k])}.`).join(' ') +
      (m.rookie ? ` Rookie des Monats: ${zeile(m.rookie)}.` : '') + (m.ohneBonus ? '' : ` Je +${CFG.bonus.off} Stärke für die nächsten ${CFG.monat.spiele} Spiele.`);
    try { addNews('season', `Spieler des Monats · ${m.name}`, text); } catch (e) { /* Meldung optional */ }
  }
  {
    const _orig = window.advanceMatchday;
    if (typeof _orig === 'function') {
      window.advanceMatchday = function (league) {
        if (CFG.aus || !dfl() || !league || !league.dfl || league.matchday >= maxMatchday(league)) return _orig.apply(this, arguments);
        let vorher = null; const md = league.matchday;
        try { vorher = statStand(); } catch (e) { vorher = null; }
        const r = _orig.apply(this, arguments);
        try { bonusAufraeumen(); if (vorher && league.matchday > md) auswerten(md + 1, vorher); } catch (e) { console.warn('[DFL-Woche] Spieltag', e); }
        return r;
      };
      try { advanceMatchday = window.advanceMatchday; } catch (e) { /* nur im Spiel */ }
    }
  }

  // ── Karten ───────────────────────────────────────────────────────────────
  const P = () => window.KSPrunk || null;
  function weltSpieler(id) {
    const L = D.liga();
    for (const t of L.teams) { const p = t.roster.find(x => x.id === id); if (p) return { p, t }; }
    return null;
  }
  function teamFuer(id) { const F = D.franchise(id) || {}; return { id, farben: F.farben || ['#3a4250', '#ffffff'] }; }
  function kartenHtml(e, art, titel) {
    const K = P(); if (!K) return '';
    const w = weltSpieler(e.id); if (!w) return '';
    const q = D.zuSpielSpieler(w.p), tm = teamFuer(w.t.id), A = window.DFLAppShell;
    K.stil();
    return K.karte({ stufe: ART[art].ed, wert: (w.p.ovr || 0) + (CFG.bonus[art] || 0), pos: posAnz(w.p.pos), positionen: (w.p.positions || []).map(posAnz),
      gesicht: I ? I.gesichtSvg(w.p, tm) : '', name: w.p.name, werte: A && A.achsen ? A.achsen(q) : [],
      wappen: I && I.wappenSvg ? I.wappenSvg(tm, { klein: true }) : '', titel, seed: Math.floor((w.p.seed || 0.5) * 1e6) });
  }
  // Spieler-Blatt: solange der Bonus gilt, die Sonderkarte statt der normalen (nicht bei fremden Spielern ohne Bericht)
  function sonderKarte(p, ovr, ax, gesicht, opt) {
    if (opt && opt.stufe) return null;
    const b = bonusEintrag(p), K = P();
    if (!b || !K || !ART[b.art]) return null;
    K.stil();
    const id = schluessel(p), w = weltSpieler(id), tm = teamFuer(w ? w.t.id : D.eigeneDflId());
    return `<div class="dw-blatt-karte">${K.karte({ stufe: ART[b.art].ed, wert: (ovr || p.ovr || 0) + b.w, pos: posAnz(p.pos), positionen: (p.positions || []).map(posAnz),
      gesicht, name: p.name, werte: ax || [], wappen: I && I.wappenSvg ? I.wappenSvg(tm, { klein: true }) : '',
      titel: `${ART[b.art].name} · +${b.w}`, seed: Math.floor((p.seed || 0.5) * 1e6) })}</div>`;
  }

  // ── Moment ───────────────────────────────────────────────────────────────
  const offenesFenster = () => [...document.querySelectorAll('body > *')].some(el => {
    if (el.id === 'dw-moment') return false;
    const cs = getComputedStyle(el);
    // sichtbar und bedienbar (das Mehr-Blatt liegt versteckt mit pointer-events: none bereit)
    return cs.position === 'fixed' && cs.display !== 'none' && cs.visibility !== 'hidden' && cs.pointerEvents !== 'none' && +cs.opacity > 0.05 && +cs.zIndex >= 50 && el.getClientRects().length && el.offsetHeight > 150;
  });
  function elfHtml(woche) {
    const L = D.liga(), reihen = [[8, 9, 10], [5, 6, 7], [1, 2, 3, 4], [0]];
    const kopf = x => {
      const w = weltSpieler(x.id), tm = w ? teamFuer(w.t.id) : null;
      const wp = w && I && I.wappenSvg ? `<span class="dw-mini-w" aria-hidden="true">${I.wappenSvg(Object.assign({}, D.franchise(w.t.id) || {}, w.t), { klein: true })}</span>` : '';
      return `<div class="dw-mini${x.eigen ? ' eigen' : ''}" data-team="${esc(x.team)}"><span class="dw-mini-g">${w && I ? I.gesichtSvg(w.p, tm) : ''}</span>${wp}
        <b>${esc(x.name)}</b><small>${esc(x.platz)} · ${komma(x.note)}</small></div>`;
    };
    // nach Platz-Index (idx) statt Reihenfolge – fehlt ein Platz, rutschten sonst alle dahinter eine Position weiter
    const aufPlatz = i => woche.team.find((x, k) => (x.idx != null ? x.idx : k) === i);
    return `<div class="dw-feld">${reihen.map(r => `<div class="dw-reihe">${r.map(i => aufPlatz(i) ? kopf(aufPlatz(i)) : '').join('')}</div>`).join('')}</div>`;
  }
  // Rohdiamant (Rückmeldung 17.10. (11), dfl_scouting_patch.js): Moment mit Karte und dem echten Potenzial in Klammern
  function diamantMoment(w, quelle, teamId) {
    const z = zustand();
    z.warte.push({ art: 'diamant', id: w.id, quelle, team: teamId || null, saison: LEAGUE.season });
    setTimeout(() => { try { zeigeMoment(); } catch (e) { /* optional */ } }, 800);
  }
  function diamantMerken(m) {
    try { const B = window.DFLDraftboard; if (m.quelle === 'draft' && B && B.merk && B.istMerk && !B.istMerk(m.id)) B.merk(m.id); } catch (e) { /* ohne Merkliste */ }
  }
  function hinZumDiamant(m) {
    try {
      const A = window.DFLAppShell; if (A && A.zeige) A.zeige('scout'); else if (typeof window.switchAppView === 'function') window.switchAppView('scout');
      setTimeout(() => { try { if (window.DFLScouting && DFLScouting.blatt) DFLScouting.blatt(m.id); } catch (e) { /* ohne Bericht */ } }, 250);
    } catch (e) { console.warn('[DFL-Woche] Rohdiamant ansehen', e); }
  }
  function diamantHtml(m) {
    const K = P(), L = D.liga();
    let w = null, team = null;
    for (const t of L.teams) { const x = t.roster.find(p => p.id === m.id); if (x) { w = x; team = t; break; } }
    if (!w) { const jg = [L.draft, L.draftNaechste].filter(Boolean); for (const j of jg) { const x = (j.talente || []).find(p => p.id === m.id); if (x) { w = x; break; } } }
    if (!w) w = (L.freie || []).find(p => p.id === m.id) || null;
    if (!w || !K) return '';
    K.stil();
    const tm = teamFuer(team ? team.id : D.eigeneDflId()), q = D.zuSpielSpieler(w), A = window.DFLAppShell;
    const karte = K.karte({ stufe: 'diamant', wert: w.ovr, pot: w.truePotential, pos: posAnz(w.pos), positionen: (w.positions || []).map(posAnz),
      gesicht: I ? I.gesichtSvg(w, tm) : '', name: w.name, werte: A && A.achsen ? A.achsen(q) : [], wappen: team && I && I.wappenSvg ? I.wappenSvg(tm, { klein: true }) : '',
      titel: 'Rohdiamant', seed: Math.floor((w.seed || 0.5) * 1e6) });
    const wo = m.quelle === 'draft' ? 'Er steht im Draft – noch hat ihn keiner auf dem Zettel.' : m.quelle === 'frei' ? 'Er ist vereinslos – jetzt zuschlagen!'
      : team && team.id === D.eigeneDflId() ? 'Er spielt schon bei dir – gib ihm Spielzeit.' : `Er spielt bei ${esc(team ? team.name : '')} – die geben ihn nicht her.`;
    return `<div class="dw-kopf"><small>Bericht deines Chefscouts</small><h2>Rohdiamant entdeckt</h2></div>
      <div class="dw-karte">${karte}</div>
      <p class="dw-text">${esc((w.firstName ? w.firstName + ' ' : '') + w.name)}, ${w.age} Jahre: alle sehen Potenzial ${w.diamant ? w.diamant.schein : '?'}, <b>wirklich drin ist ${w.truePotential}.</b> ${wo}</p>`;
  }
  function momentHtml(m) {
    if (m.art === 'diamant') return diamantHtml(m);
    const art = ART[m.art], b = CFG.bonus[m.art];
    if (m.monat && m.e) {
      const e = m.e, teile = [`Ø Note ${komma(e.note)} in ${e.n} Spiel${e.n > 1 ? 'en' : ''}`];
      if (e.tore) teile.push(`${e.tore} Tor${e.tore > 1 ? 'e' : ''}`);
      if (e.vorlagen) teile.push(`${e.vorlagen} Vorlage${e.vorlagen > 1 ? 'n' : ''}`);
      return `<div class="dw-kopf"><small>${esc(m.monat)}${m.konf ? ' · Conference ' + KONF[m.konf] : ''}</small><h2>${art.name}</h2></div>
      <div class="dw-karte">${kartenHtml(e, m.art, `${art.name} · ${m.monat}`)}</div>
      <p class="dw-text">${esc(e.name)}: ${teile.join(', ')}.${m.ohneBonus ? '' : ` <b>+${b} Stärke in den nächsten ${CFG.monat.spiele} Spielen.</b>`}</p>`;
    }
    const z = zustand(), woche = z.letzte.find(w => w.nr === m.nr && w.saison === m.saison);
    if (!woche || m.art !== 'team') return '';
    if (m.art === 'team') {
      const eig = woche.team.filter(x => x.eigen);
      return `<div class="dw-kopf"><small>Spieltag ${m.nr}</small><h2>${art.name}</h2></div>${elfHtml(woche)}
        <p class="dw-text">${eig.length === 1 ? `${esc(eig[0].name)} steht` : `${eig.map(x => esc(x.name)).join(', ')} stehen`} im Team der Woche. <b>+${b} Stärke im nächsten Spiel.</b></p>`;
    }
    const e = m.e, teile = [`Note ${komma(e.note)}`];
    if (e.tore) teile.push(`${e.tore} Tor${e.tore > 1 ? 'e' : ''}`);
    if (e.vorlagen) teile.push(`${e.vorlagen} Vorlage${e.vorlagen > 1 ? 'n' : ''}`);
    return `<div class="dw-kopf"><small>Spieltag ${m.nr}${m.konf ? ' · Conference ' + KONF[m.konf] : ''}</small><h2>${art.name}</h2></div>
      <div class="dw-karte">${kartenHtml(e, m.art, `${art.name} · Spieltag ${m.nr}`)}</div>
      <p class="dw-text">${esc(e.name)}: ${teile.join(', ')}. <b>+${b} Stärke im nächsten Spiel.</b></p>`;
  }
  function zeigeMoment() {
    if (!dfl() || !LEAGUE.dflWoche || !LEAGUE.dflWoche.warte || !LEAGUE.dflWoche.warte.length) return false;
    if (document.getElementById('dw-moment') || offenesFenster()) return false;
    // Tests (Playwright) sehen den Moment nur mit localStorage „dw-test“ = an – sonst blockiert er den Bot
    try { if (navigator.webdriver && localStorage.getItem('dw-test') !== 'an') return false; } catch (e) { /* ohne Speicher */ }
    if (window.DFLSimulieren && DFLSimulieren.laeuft && DFLSimulieren.laeuft()) return false;
    const z = zustand(), m = z.warte.shift();
    const html = momentHtml(m);
    if (!html) return zeigeMoment();
    const ov = document.createElement('div');
    ov.id = 'dw-moment'; ov.className = 'dw-ov dw-' + m.art;
    // Rohdiamant (Nutzer 2026-10-22): „Toll, bring mich hin“ öffnet den Bericht im Scouting, „Sehe ich mir später an“ schließt –
    // ein Draft-Talent steht in beiden Fällen auf der Merkliste (diamantMerken)
    const dia = m.art === 'diamant';
    ov.innerHTML = `<div class="dw-box" role="dialog" aria-modal="true" aria-label="${esc(ART[m.art].name)}">${html}
      ${dia ? `<div class="dw-knoepfe"><button type="button" class="dw-weiter dw-spaeter" data-dw="spaeter">Sehe ich mir später an</button><button type="button" class="dw-weiter" data-dw="hin">Toll, bring mich hin</button></div>`
        : `<button type="button" class="dw-weiter">${z.warte.length ? 'Weiter' : 'Stark!'}</button>`}</div>`;
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('auf'));
    if (dia) diamantMerken(m);
    ov.querySelectorAll('.dw-weiter').forEach(k => k.addEventListener('click', () => {
      ov.remove(); if (typeof saveGameState === 'function') saveGameState();
      if (k.getAttribute('data-dw') === 'hin') { hinZumDiamant(m); return; }      // weitere Momente zeigt das Office später
      setTimeout(zeigeMoment, 250);
    }));
    return true;
  }
  // Office wieder sichtbar → wartende Momente zeigen (nicht über dem Spielbericht oder anderen Fenstern)
  {
    const A = window.DFLAppShell;
    if (A && typeof A.officeKopf === 'function') {
      const _orig = A.officeKopf;
      A.officeKopf = function () { const r = _orig.apply(this, arguments); setTimeout(() => { try { zeigeMoment(); } catch (e) { /* optional */ } }, 600); return r; };
    }
    const _rh = window.renderHomeTab;
    if (typeof _rh === 'function') {
      window.renderHomeTab = function () { const r = _rh.apply(this, arguments); setTimeout(() => { try { zeigeMoment(); } catch (e) { /* optional */ } }, 700); return r; };
      try { renderHomeTab = window.renderHomeTab; } catch (e) { /* nur im Spiel */ }
    }
  }
  // Aufstellung (Nutzer 2026-10-22: „in der Aufstellung noch irgendwie ein Special-Kreis oder der Background der Spieler … so wie bei
  // der Karte“): Spieler mit laufendem Bonus tragen Hintergrund und Rahmen ihrer Sonderkarte und die Marke +N
  {
    const FARBE = { sdw: ['#9b1426', '#3a040c', '#e9b44c'], abwehr: ['#3d5f8f', '#142640', '#c9d6e6'], zukunft: ['#3b1670', '#160634', '#8ad8ff'], tdw: ['#3a3a3a', '#050505', '#e0ad3e'] };
    const _orig = window.renderPitch;
    if (typeof _orig === 'function') {
      window.renderPitch = function () {
        const r = _orig.apply(this, arguments);
        try {
          if (!dfl() || typeof FORMATIONS === 'undefined') return r;
          const slots = FORMATIONS[CLUB.formation] || [], els = document.querySelectorAll('#pitch .p-slot');
          slots.forEach((slot, i) => {
            const el = els[i], pid = CLUB.lineup && CLUB.lineup[slot.id], p = pid && typeof getPlayer === 'function' ? getPlayer(pid) : null;
            const b = p ? bonusEintrag(p) : null, tok = el && el.querySelector('.p-token');
            if (!b || !tok || !ART[b.art]) return;
            const f = FARBE[ART[b.art].ed] || FARBE.tdw;
            el.classList.add('dw-sonder');
            tok.style.setProperty('--dw-a', f[0]); tok.style.setProperty('--dw-b', f[1]); tok.style.setProperty('--dw-r', f[2]);
            tok.title = `${ART[b.art].name} · +${b.w}`;
            if (!tok.querySelector('.dw-plus')) tok.insertAdjacentHTML('beforeend', `<span class="dw-plus">+${b.w}</span>`);
          });
        } catch (e) { console.warn('[DFL-Woche] Aufstellung', e); }
        return r;
      };
      try { renderPitch = window.renderPitch; } catch (e) { /* nur im Spiel */ }
    }
  }
  // Neue Saison: alte Boni und Momente weg
  {
    const _orig = window.startNewSeason;
    if (typeof _orig === 'function') {
      window.startNewSeason = function () {
        const r = _orig.apply(this, arguments);
        try { if (dfl()) { const z = zustand(); z.bonus = {}; z.warte = []; z.saison = LEAGUE.season; z.monat = null; z.monate = []; } } catch (e) { /* optional */ }
        return r;
      };
      try { startNewSeason = window.startNewSeason; } catch (e) { /* nur im Spiel */ }
    }
  }

  const CSS = `
  .dw-sonder .p-token{background:radial-gradient(circle at 50% 30%,var(--dw-a),var(--dw-b))!important;border-color:var(--dw-r)!important;
    box-shadow:0 0 0 2px var(--dw-b),0 0 10px var(--dw-r)}
  .dw-sonder .p-token:not(.mit-gesicht){color:#fff}
  .dw-plus{position:absolute;right:-8px;top:-6px;font:800 9px/1 var(--font-zahl,var(--font-display,system-ui));color:var(--dw-b);background:var(--dw-r);
    border-radius:7px;padding:2px 4px;box-shadow:0 1px 0 rgb(0 0 0/.35)}
  .dw-ov{position:fixed;inset:0;z-index:9800;display:grid;place-items:center;padding:16px;background:radial-gradient(circle at 50% 30%,rgb(40 30 70/.92),rgb(5 6 14/.96));
    opacity:0;transition:opacity .25s}
  .dw-ov.auf{opacity:1}
  .dw-box{width:min(380px,100%);max-height:100%;overflow:auto;display:flex;flex-direction:column;align-items:center;gap:12px;color:#fff;text-align:center}
  .dw-kopf small{display:block;font:700 12px var(--font-text,system-ui);letter-spacing:.12em;text-transform:uppercase;opacity:.75}
  .dw-kopf h2{margin:2px 0 0;font:800 30px/1 'Big Shoulders Display',var(--font-display,system-ui);letter-spacing:.02em;text-transform:uppercase;color:#ffe08a}
  .dw-karte{transform:scale(.4) rotateY(90deg);opacity:0;transition:transform .7s cubic-bezier(.2,1.4,.4,1),opacity .4s}
  .dw-ov.auf .dw-karte{transform:none;opacity:1;transition-delay:.15s}
  .dw-text{margin:0;font:500 15px/1.4 var(--font-text,system-ui);max-width:32ch}
  .dw-text b{color:#7dffa8}
  .dw-weiter{font:800 17px var(--font-display,system-ui);padding:12px 34px;border-radius:14px;border:0;background:#f0c05a;color:#2a1c02;box-shadow:0 4px 0 #a07a1c;cursor:pointer}
  .dw-knoepfe{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}.dw-knoepfe .dw-weiter{padding:12px 22px}
  .dw-weiter.dw-spaeter{background:rgb(255 255 255/.14);color:#fff;box-shadow:0 4px 0 rgb(0 0 0/.35)}
  .dw-feld{width:100%;padding:12px 6px;border-radius:16px;background:repeating-linear-gradient(0deg,#1f7a3d 0 34px,#23863f 34px 68px);border:2px solid rgb(255 255 255/.35);display:flex;flex-direction:column;gap:8px}
  .dw-reihe{display:flex;justify-content:space-around;gap:4px}
  .dw-mini{position:relative;display:flex;flex-direction:column;align-items:center;width:76px;color:#fff;text-shadow:0 1px 2px #000}
  .dw-mini-w{position:absolute;left:50%;top:28px;margin-left:10px;width:19px;height:22px;filter:drop-shadow(0 1px 1px rgb(0 0 0/.6))}.dw-mini-w svg{width:100%;height:100%;display:block}
  .dw-mini-g{width:44px;height:44px;border-radius:50%;overflow:hidden;background:rgb(0 0 0/.35);border:2px solid rgb(255 255 255/.6)}
  .dw-mini-g svg{width:100%;height:150%;margin-top:-4%}
  .dw-mini.eigen .dw-mini-g{border-color:#ffd54a;box-shadow:0 0 0 3px rgb(255 213 74/.45),0 0 14px #ffd54a}
  .dw-mini b{font:800 11px/1.1 var(--font-text,system-ui);margin-top:2px;max-width:76px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .dw-mini small{font:700 10px var(--font-text,system-ui);opacity:.9}
  .dw-mini.eigen b{color:#ffe08a}
  .dw-blatt-karte{display:grid;place-items:center}
  .dw-diamant-chip{display:inline-flex;align-items:center;gap:3px;padding:1px 8px;border-radius:999px;background:#14806f;color:#eafff9;font-weight:800;font-size:12px}
  @media (prefers-reduced-motion:reduce){.dw-ov,.dw-karte{transition:none}}`;
  if (typeof document !== 'undefined' && document.head) {
    const s = document.createElement('style'); s.id = 'dw-stil'; s.textContent = CSS; document.head.appendChild(s);
  }

  window.DFLWoche = { CFG, bonus, bonusEintrag, sonderKarte, zeigeMoment, diamantMoment, diamantMerken, letzte: () => (dfl() && LEAGUE.dflWoche ? LEAGUE.dflWoche.letzte : []),
    monate: () => (dfl() && LEAGUE.dflWoche ? LEAGUE.dflWoche.monate || [] : []) };
  console.log('[DFL-Woche v1] aktiv — Offensiv-/Defensivspieler je Conference, Rookie und Team der Woche mit Bonus und Moment');
})();
