/* ═══════════════════════════════════════════════════════════════════════════
   DFL · DER ANSTOSS  ·  v1   (D141, 2026-10-14: „eine allgemeine Sport Zeitung und nicht für jeden eins“,
                               „Bilder irgendwie noch mit rein von Spielern, Trainern, Wappen etc.“)
   ─────────────────────────────────────────────────────────────────────────
   Eine Sportzeitung für die ganze Liga statt des alten Lokalblatts (newspaper_patch.js, entfernt). Sie erscheint nur an
   Tagen mit Geschichte: nach jeder Woche sammelt das Modul die Fakten (Ergebnisse und Torschützen des Spieltags aus
   LEAGUE.dflKonferenz, Serien, Tabellenplätze, KI-Trades, große Free-Agent-Verträge, Verletzungen wichtiger Spieler,
   Draft, Playoffs, Meister) und lässt den Textbaukasten (dfl_zeitung_text.js) entscheiden, ob es eine Ausgabe gibt.
     · Höchstens eine Ausgabe je Woche (Wochentakt an advanceCalendarWeek, äußerste Hülle)
     · Bilder: Porträt (DFLIdentitaet.gesichtSvg) vor Vereinsfarbe, wenn ein Spieler die Geschichte trägt; Wappen bei
       Duellen, Tabelle, Trades; Trainer mit Gesicht beim Zitat (Chefcoach der KI, beim eigenen Verein der Co-Trainer)
     · Fremde Spieler nur mit Name, Position und Gesicht – keine Werte (D78)
     · Office: ruhiger Hinweis „Neue Ausgabe“ unter den Kacheln, bis sie gelesen ist; „Simulieren bis …“ legt Ausgaben
       still ab (kein Hinweis)
   Zustand (klein, im Spielstand): CLUB.dfl.zeitung = { v, nr, gelesen, ausgaben[≤ 6], ged[≤ 4] (Vorlagen-IDs je Ausgabe),
     saison, md, serie { id: [art, n] }, platz { id: Platz }, verl [IDs], poStart, poRunde, rekord, faMax, offen { trades, fa, draft } }
   Alte Spielstände: Zustand entsteht beim ersten Wochentakt; Reste des Lokalblatts (CLUB._zeitung, _zeitungTipp,
   _zeitungGelesen) werden entfernt.
   Hängt sich an: advanceCalendarWeek, switchAppView, renderHomeTab, DFLHandel.kiTrades, DFLSaison.phaseFreeAgency,
   DFLAnalysten.draftFertig. Lädt nach dfl_start.js, vor init_bootstrap.js. CSS: css/dfl_zeitung.css.
   API: DFLZeitung.zeige(nr) · .ausgaben() · .fakten() · .takt() · .zustand() · .blattHtml(a)
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const T = window.DFLZeitungText, D = window.DFLSpiel;
  if (!T || !D) { console.warn('[DFL-Zeitung] Textbaukasten oder DFLSpiel fehlt – Zeitung inaktiv'); return; }

  const CFG = { ausgaben: 6, verletzungAb: 4, eigeneVerletzungAb: 3, faGross: 0.06 };
  const dfl = () => typeof CLUB !== 'undefined' && CLUB && CLUB.dfl && CLUB.dfl.aktiv && typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.dfl;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ic = n => `<i class="ti ti-${n}" aria-hidden="true"></i>`;
  const simAktiv = () => !!(window.DFLSimulieren && typeof DFLSimulieren.aktiv === 'function' && DFLSimulieren.aktiv());
  const geld = x => (typeof formatEuro === 'function' ? formatEuro(Math.round(x || 0)) : Math.round((x || 0) / 1e5) / 10 + ' Mio €');
  const ligaTeams = () => { try { return LEAGUE.tiers.bundesliga.groups[0].teams; } catch (e) { return []; } };
  const franchise = id => { try { return D.franchise(id) || null; } catch (e) { return null; } };
  const spielId = weltId => { try { return D.spielId(weltId); } catch (e) { return weltId; } };
  const weltId = id => { try { return D.dflIdVon(id); } catch (e) { return id; } };
  const welt = () => { try { return D.liga(); } catch (e) { return null; } };
  const weltTeam = id => { const L = welt(); return L ? L.teams.find(t => t.id === weltId(id)) || null : null; };
  const anzeigeName = p => (typeof displayName === 'function' ? displayName(p) : ((p.firstName ? p.firstName.charAt(0) + '. ' : '') + (p.name || '')));
  const vollName = p => ((p.firstName ? p.firstName + ' ' : '') + (p.name || '')).trim();

  // ── Zustand ───────────────────────────────────────────────────────────────
  function zustand() {
    const d = CLUB.dfl;
    if (!d.zeitung || d.zeitung.v !== 1) {
      d.zeitung = { v: 1, nr: 0, gelesen: 0, ausgaben: [], ged: [], saison: null, md: 0, serie: {}, platz: {}, verl: null,
        poStart: false, poRunde: 0, rekord: 0, offen: { trades: [], fa: [], draft: null } };
    }
    const z = d.zeitung;
    z.offen = z.offen || { trades: [], fa: [], draft: null };
    return z;
  }
  // Reste des alten Lokalblatts (newspaper_patch.js) entfernen
  function altesAufraeumen() {
    try { if (typeof CLUB !== 'undefined' && CLUB) { delete CLUB._zeitung; delete CLUB._zeitungTipp; delete CLUB._zeitungGelesen; } } catch (e) { /* ohne Spielstand */ }
  }

  // ── Vereine: Namen mit Grammatik (Spitzname/Stadt nur, wenn eindeutig) ──────
  let EINDEUTIG = null;
  function eindeutig() {
    if (EINDEUTIG) return EINDEUTIG;
    const fr = (window.DFL_LIGA && DFL_LIGA.franchises) || [], kz = {}, st = {};
    fr.forEach(f => { const k = f.kurzname || (f.name || '').split(' ').slice(1).join(' '); kz[k] = (kz[k] || 0) + 1; st[f.city] = (st[f.city] || 0) + 1; });
    EINDEUTIG = { kurz: k => kz[k] === 1, stadt: c => st[c] === 1 };
    return EINDEUTIG;
  }
  function konfPlatz(id) {
    try { if (window.DFLSimulieren && DFLSimulieren.platzVon) return DFLSimulieren.platzVon(id); } catch (e) { /* Ersatz unten */ }
    const t = ligaTeams().find(x => x.id === id); if (!t) return null;
    const k = ligaTeams().filter(x => x.conference === t.conference).sort((a, b) => (b.pts || 0) - (a.pts || 0) || ((b.gf - b.ga) - (a.gf - a.ga)));
    return k.indexOf(t) + 1;
  }
  function sprecherVon(id) {
    const t = weltTeam(id), tr = t && t.trainer;
    if (!tr) return null;
    const R = window.DFLTrainer && DFLTrainer.ROLLE ? DFLTrainer.ROLLE : { chef: { name: 'Chefcoach' }, co: { name: 'Co-Trainer' } };
    const p = id === 'fcm' ? (tr.co || tr.psycho || tr.standard) : (tr.chef || tr.co);
    if (!p) return null;
    return { name: vollName(p), rolle: (R[p.rolle] || {}).name || 'Trainer', bild: { id: p.id, seed: p.seed, firstName: p.firstName, name: p.name } };
  }
  function teamInfo(t, z, serieVorher) {
    const f = franchise(t.id) || {}, E = eindeutig();
    const voll = t.id === 'fcm' ? (CLUB.name || f.name || t.name) : (f.name || t.name);
    const kurz = f.kurzname || voll.split(' ').slice(1).join(' ');
    const g = window.DFL_GESCHICHTEN && DFL_GESCHICHTEN[weltId(t.id)];
    const s = z.serie[t.id];
    return {
      id: t.id, voll, kurz: kurz && E.kurz(kurz) ? kurz : null, stadt: f.city && E.stadt(f.city) ? f.city : null, ort: f.city || null,
      konf: t.conference, konfName: (D.KONF && D.KONF[t.conference]) || t.conference, div: t.division, staerke: t.ovr || 0,
      platz: konfPlatz(t.id), platzVorher: z.platz[t.id] || null, punkte: t.pts || 0, spiele: t.played || 0,
      serie: s ? { art: s[0], n: s[1] } : { art: null, n: 0 }, serieVorher: serieVorher && serieVorher[t.id] ? { art: serieVorher[t.id][0], n: serieVorher[t.id][1] } : null,
      rivale: g && g.rivale_id ? spielId(g.rivale_id) : null, trainer: sprecherVon(t.id)
    };
  }

  // ── Spieler (Bild nur mit Seed und Namen, keine Werte) ────────────────────
  function spielerBild(p) {
    if (!p) return null;
    const seed = (typeof p.dflSeed === 'number' && p.dflSeed > 0) ? p.dflSeed : p.seed;
    return { id: p.dflId || p.id, seed, firstName: p.firstName, name: p.name };
  }
  function spielerFakt(p, n) {
    return { voll: vollName(p) || p.name, nach: p.name || vollName(p), pos: p.pos === 'ZOM' ? 'OM' : p.pos, n: n || 1, bild: spielerBild(p), alter: p.age || null };
  }
  function kaderVon(id) {
    if (id === 'fcm') return typeof SQUAD !== 'undefined' ? SQUAD : [];
    const t = weltTeam(id); return t ? t.roster.concat(t.practice_squad || []) : [];
  }
  // Torschützen aus der Konferenz („J. Cooper 2, M. Haddad“) den Spielern des Vereins zuordnen
  function schuetzen(id, text, saisonTore) {
    if (!text) return [];
    const kader = kaderVon(id);
    return String(text).split(',').map(x => x.trim()).filter(Boolean).map(x => {
      const m = /^(.*?)(?:\s(\d+))?$/.exec(x), name = m[1], n = +(m[2] || 1);
      const p = kader.find(q => anzeigeName(q) === name) || kader.find(q => vollName(q) === name);
      if (!p) return { voll: name, nach: name.replace(/^.*\.\s*/, ''), pos: null, n, bild: null };
      const f = spielerFakt(p, n);
      if (n >= 3) {
        f.saisontore = saisonTore ? saisonTore(p) : null;
        f.sprecher = { name: f.voll, rolle: T.POS[f.pos] || 'Spieler', bild: f.bild };
      }
      return f;
    });
  }
  function saisonToreVon() {
    let liste = null;
    return p => {
      try {
        if (!liste) liste = window.DFLStatistik && DFLStatistik.torjaeger ? DFLStatistik.torjaeger() : [];
        const id = p.dflId || p.id, x = liste.find(q => q.id === id);
        return x ? x.goals : (p.stats && p.stats.goals) || null;
      } catch (e) { return null; }
    };
  }

  // ── Haken: KI-Trades, Free Agency, Draft (gemerkt bis zum nächsten Wochentakt) ─────
  if (window.DFLHandel && typeof DFLHandel.kiTrades === 'function') {
    const _orig = DFLHandel.kiTrades;
    DFLHandel.kiTrades = function () {
      const r = _orig.apply(this, arguments);
      try {
        if (dfl() && Array.isArray(r) && r.length) {
          const z = zustand();
          r.forEach(x => {
            const p = x.spieler, gegen = ((x.texte && x.texte.a) || []).map(s => String(s).replace(/\s*\([^)]*\)\s*$/, ''));
            z.offen.trades.push({ an: spielId(x.von), von: spielId(x.an), spieler: p ? spielerFakt(p) : null, gegen, gross: !!(p && p.ovr >= 84),
              lage: x.lageA || null, weg: x.zuHaben ? (x.zuHaben.art === 'weg' ? 'weg' : 'abgabe') : null });
          });
          z.offen.trades = z.offen.trades.slice(-6);
        }
      } catch (e) { console.warn('[DFL-Zeitung] Trades', e); }
      return r;
    };
  }
  if (window.DFLSaison && typeof DFLSaison.phaseFreeAgency === 'function') {
    const _orig = DFLSaison.phaseFreeAgency;
    DFLSaison.phaseFreeAgency = function (L) {
      const r = _orig.apply(this, arguments);
      try {
        if (dfl() && Array.isArray(r) && r.length) {
          const z = zustand(), Gn = window.DFLGenerator, cap = (L && L.cap) || 120e6;
          const neu = r.filter(x => x && x.p && x.p.contract).map(x => {
            const c = x.p.contract, hit = Gn && Gn.capHitSpieler ? Gn.capHitSpieler(x.p) : c.base_salary;
            const summe = (c.base_salary_by_year || []).reduce((s, v) => s + v, 0) + (c.signing_bonus_total || 0) + (c.guaranteed_bonuses || 0) * (c.years_total || 1);
            return { team: spielId(x.an), spieler: spielerFakt(x.p), jahre: c.years_total || 1, summe: geld(summe), jeJahr: geld(hit), wert: hit, gross: hit >= cap * CFG.faGross };
          }).sort((a, b) => b.wert - a.wert).slice(0, 4);
          z.offen.fa = z.offen.fa.concat(neu).sort((a, b) => b.wert - a.wert).slice(0, 4);
        }
      } catch (e) { console.warn('[DFL-Zeitung] Free Agency', e); }
      return r;
    };
  }
  function draftHaken() {
    if (!window.DFLAnalysten || typeof DFLAnalysten.draftFertig !== 'function' || DFLAnalysten.draftFertig._zeitung) return;
    const _orig = DFLAnalysten.draftFertig;
    DFLAnalysten.draftFertig = function (d) {
      const r = _orig.apply(this, arguments);
      try {
        if (dfl() && d && Array.isArray(d.picks) && d.picks.length) {
          const L = welt(), finde = id => { let p = null; (L ? L.teams : []).some(t => (p = t.roster.concat(t.practice_squad || []).find(q => q.id === id))); return p; };
          const eigen = typeof SQUAD !== 'undefined' ? SQUAD : [];
          const fakt = x => {
            const p = x.team === 'fcm' ? (eigen.find(q => q.dflId === x.id || q.id === x.id) || finde(x.id)) : finde(x.id);
            const f = p ? spielerFakt(p) : { voll: x.name, nach: String(x.name || '').split(' ').slice(-1)[0], pos: x.pos, n: 1, bild: null, alter: x.age };
            if (p && p.college) f.college = p.college;
            return { nr: x.pick, team: x.team, spieler: f };
          };
          const picks = d.picks.slice().sort((a, b) => a.pick - b.pick);
          zustand().offen.draft = { jahr: d.jahr, picks: picks.slice(0, 4).map(fakt), eigen: picks.filter(x => x.team === 'fcm').slice(0, 2).map(fakt) };
        }
      } catch (e) { console.warn('[DFL-Zeitung] Draft', e); }
      return r;
    };
    DFLAnalysten.draftFertig._zeitung = true;
  }
  draftHaken();

  // ── Wochentakt: Fakten sammeln, Ausgabe schreiben ─────────────────────────
  function saisonPruefen(z) {
    if (z.saison === LEAGUE.season) return;
    const neu = z.saison != null;
    z.saison = LEAGUE.season; z.md = neu ? 0 : (LEAGUE.matchday || 0);
    z.serie = {}; z.platz = {}; z.poStart = false; z.poRunde = 0; z.rekord = 0; z.faMax = 0;
    // alter Spielstand mitten in der Saison: Serien aus der Form der Tabelle (letzte 5), Plätze von heute
    if (!neu) ligaTeams().forEach(t => {
      const f = (t.form || []).slice().reverse(), art = f[0];
      if (art === 'W' || art === 'L') { let n = 0; while (n < f.length && f[n] === art) n++; z.serie[t.id] = [art === 'W' ? 'S' : 'N', n]; }
      if ((LEAGUE.matchday || 0) > 0) z.platz[t.id] = konfPlatz(t.id);
    });
    if (z.verl == null) z.verl = verletzteJetzt().map(v => v.key);
  }
  // Verletzte wichtige Spieler (Welt: aus ≥ 4 Wochen und in der Startelf; eigener Verein: ≥ 3 Wochen und in der Aufstellung)
  function verletzteJetzt() {
    const aus = [], L = welt(), Gn = window.DFLGenerator, eig = D.eigeneDflId();
    (L ? L.teams : []).forEach(t => {
      if (t.id === eig) return;
      const lang = t.roster.filter(p => (p.aus || 0) >= CFG.verletzungAb);
      if (!lang.length) return;
      let elf = null;
      try { elf = Gn && Gn.startelfVon ? new Set(Gn.startelfVon(t.roster.map(p => Object.assign({}, p, { aus: 0 })), t).map(p => p.id)) : null; } catch (e) { elf = null; }
      lang.forEach(p => { if (!elf || elf.has(p.id)) aus.push({ key: 'w:' + p.id, team: spielId(t.id), p, wochen: p.aus, art: p.ausTyp || null, eigen: false }); });
    });
    const lineup = new Set(typeof CLUB !== 'undefined' && CLUB.lineup ? Object.values(CLUB.lineup) : []);
    (typeof SQUAD !== 'undefined' ? SQUAD : []).forEach(p => {
      if ((p.injuryWeeks || 0) >= CFG.eigeneVerletzungAb && lineup.has(p.id)) aus.push({ key: 'e:' + p.id, team: 'fcm', p, wochen: p.injuryWeeks, art: p.injuryType || null, eigen: true });
    });
    return aus;
  }
  const ergebnisArt = (a, b) => (a > b ? 'S' : a < b ? 'N' : 'U');
  function serieFortschreiben(z, id, art) {
    const s = z.serie[id];
    if (art === 'U') { delete z.serie[id]; return; }
    z.serie[id] = s && s[0] === art ? [art, s[1] + 1] : [art, 1];
  }

  function fakten(nurLesen) {
    if (!dfl()) return null;
    // nur lesen (API, Fehlersuche): auf einer Kopie des Zustands rechnen
    const z = nurLesen ? JSON.parse(JSON.stringify(zustand())) : zustand();
    saisonPruefen(z);
    const md = LEAGUE.matchday || 0, k = LEAGUE.dflKonferenz && LEAGUE.dflKonferenz.saison === LEAGUE.season ? LEAGUE.dflKonferenz : null;
    const serieVorher = Object.assign({}, z.serie), neuerTag = md > z.md;
    const tz = saisonToreVon();
    let spiele = [];
    if (neuerTag) {
      for (let m = z.md + 1; m <= md; m++) {
        const tag = k && k.tage[m];
        (tag || []).forEach(([h, g, th, tg]) => { serieFortschreiben(z, h, ergebnisArt(th, tg)); serieFortschreiben(z, g, ergebnisArt(tg, th)); });
      }
      spiele = ((k && k.tage[md]) || []).map(([h, g, th, tg, sh, sg]) => {
        const sp = { h, g, th, tg, tore: { [h]: schuetzen(h, sh, tz), [g]: schuetzen(g, sg, tz) } };
        const marge = Math.abs(th - tg);
        if (marge >= 4 && marge > (z.rekord || 0)) { sp.rekord = md >= 3; z.rekord = marge; }
        return sp;
      });
    }
    // Vereine (alle 32, mit Plätzen vorher/nachher)
    const teams = {};
    ligaTeams().forEach(t => { teams[t.id] = teamInfo(t, z, serieVorher); });
    if (!neuerTag) Object.values(teams).forEach(t => { t.platzVorher = t.platz; });
    Object.values(teams).forEach(t => {
      if (t.platz === 1 && t.platzVorher > 1) { const v = Object.values(teams).find(x => x.konf === t.konf && x.platzVorher === 1); if (v) t.vorgaenger = v.id; }
    });
    // Nächster Gegner je Verein
    const naechste = {};
    try { const fx = Object.values(LEAGUE.fixtures || {})[0], tag = fx && fx[md]; (tag || []).forEach(([h, g]) => { naechste[h] = g; naechste[g] = h; }); } catch (e) { /* ohne Vorschau */ }
    // Verletzungen (neu seit dem letzten Takt)
    const jetzt = verletzteJetzt(), bekannt = new Set(z.verl || []);
    const verletzungen = jetzt.filter(v => !bekannt.has(v.key)).map(v => ({ team: v.team, spieler: spielerFakt(v.p), wochen: v.wochen, art: v.art, eigen: v.eigen }));
    // Playoffs
    const playoffs = playoffFakten(z, teams);
    // Free Agency: nur der größte Vertrag der Vorbereitung trägt eine Ausgabe (die Besten unterschreiben in der ersten Welle)
    const fa = z.offen.fa.slice();
    if (fa.length && fa[0].gross) { if (fa[0].wert > (z.faMax || 0)) z.faMax = fa[0].wert; else fa[0] = Object.assign({}, fa[0], { gross: false }); }
    const L = welt();
    const F = {
      saison: LEAGUE.season, jahr: saisonText(), jahrEnde: L ? L.saisonJahr + 1 : null, spieltag: neuerTag ? md : 0, eigen: 'fcm', teams, spiele, naechste,
      trades: z.offen.trades.slice(), fa, verletzungen, draft: z.offen.draft, playoffs
    };
    if (!nurLesen) {
      // Zustand fortschreiben (auch ohne Ausgabe)
      if (neuerTag) { z.md = md; Object.values(teams).forEach(t => { z.platz[t.id] = t.platz; }); }
      z.verl = jetzt.map(v => v.key);
      z.offen = { trades: [], fa: [], draft: null };
    }
    return F;
  }
  function saisonText() {
    const L = welt(), j = L ? L.saisonJahr : (LEAGUE.startYear || 2026) + (LEAGUE.season || 1) - 1;
    return `${j}/${String(j + 1).slice(2)}`;
  }
  function playoffFakten(z, teams) {
    const po = LEAGUE.dflPO;
    if (!po || !po.setzliste || (po.saison != null && po.saison !== LEAGUE.season)) return null;
    const seed = id => { for (const k of Object.keys(po.setzliste)) { const i = po.setzliste[k].indexOf(id); if (i >= 0) return i + 1; } return null; };
    const sp = (po.spiele || []);
    const fertig = r => { const s = sp.filter(x => x.runde === r); return s.length && s.every(x => x.sieger); };
    let r = 0; for (let i = 1; i <= 4; i++) if (fertig(i)) r = i;
    const karte = s => ({ h: s.heim, g: s.gast, th: s.gh + (s.hin ? s.hin.gh : 0), tg: s.ga + (s.hin ? s.hin.ga : 0), hin: s.hin || null, art: s.art, elfer: s.elfer, sieger: s.sieger, seedSieger: seed(s.sieger), seedVerl: seed(s.sieger === s.heim ? s.gast : s.heim) });
    if (r > (z.poRunde || 0)) {
      z.poRunde = r; z.poStart = true;
      if (r === 4) {
        const f = sp.find(x => x.runde === 4);
        const titelNr = window.DFLPlayoffs && DFLPlayoffs.titel ? DFLPlayoffs.titel(po.meister) : 1;
        return { art: 'meister', meister: po.meister, finalist: po.finalist, ort: po.finalort, finale: f ? karte(f) : null, titelNr, seed: seed(po.meister) };
      }
      const runde = sp.filter(x => x.runde === r).map(karte);
      const fg = {};
      if (r === 3) { const f = runde.map(x => x.sieger); if (f.length === 2) { fg[f[0]] = f[1]; fg[f[1]] = f[0]; } }
      return { art: 'runde', runde: r, spiele: runde, ort: po.finalort, finalGegner: fg };
    }
    if (!z.poStart) {
      z.poStart = true;
      const eig = teams.fcm, konf = eig && eig.konf, liste = (konf && po.setzliste[konf]) || [];
      const s = seed('fcm'), erstes = sp.find(x => x.runde === 1 && (x.heim === 'fcm' || x.gast === 'fcm'));
      const siebter = liste[6] && teams[liste[6]];
      return { art: 'start', setz: po.setzliste, eigenSeed: s || 0, eigenGegner: erstes ? (erstes.heim === 'fcm' ? erstes.gast : erstes.heim) : null,
        abstand: !s && siebter && eig ? Math.max(0, (siebter.punkte || 0) - (eig.punkte || 0)) : 0 };
    }
    return null;
  }

  function saat() {
    const s = (CLUB.dfl.seed || 1) >>> 0;
    return ((s ^ Math.imul(LEAGUE.season || 1, 7919) ^ Math.imul(LEAGUE.week || 1, 104729)) >>> 0) || 1;
  }
  function kopfText(F) {
    const po = F.playoffs;
    if (po && po.art === 'meister') return 'Finale';
    if (po && po.art === 'runde') return T.RUNDE[po.runde];
    if (po && po.art === 'start') return 'Playoffs';
    if (F.spieltag) return `${F.spieltag}. Spieltag`;
    if (F.draft) return 'Draft';
    return (LEAGUE.matchday || 0) === 0 ? 'Vorbereitung' : 'Sommerpause';
  }
  function tabelleFuer(F) {
    const eig = F.teams.fcm; if (!eig) return null;
    const konf = eig.konf;
    const zeilen = Object.values(F.teams).filter(t => t.konf === konf && t.platz).sort((a, b) => a.platz - b.platz);
    const oben = zeilen.slice(0, 8);
    if (eig.platz > 8) oben.push(eig);
    return { konf: eig.konfName, zeilen: oben.map(t => [t.id, t.punkte, t.platz, t.platzVorher || t.platz]) };
  }
  function takt() {
    if (!dfl()) return null;
    const z = zustand();
    const F = fakten(false);
    if (!F) return null;
    let a = null;
    try { a = T.ausgabe(F, z.ged, { saat: saat() }); } catch (e) { console.warn('[DFL-Zeitung] Ausgabe', e); a = null; }
    if (!a) return null;
    z.nr++;
    const po = F.playoffs;
    const ausgabe = {
      nr: z.nr, s: LEAGUE.season, w: LEAGUE.week, jahr: F.jahr, kopf: kopfText(F), stuecke: a.stuecke, still: simAktiv(),
      spiele: F.spiele.map(s => [s.h, s.g, s.th, s.tg]),
      po: po && (po.art === 'runde' || po.art === 'meister') ? (po.art === 'runde' ? po.spiele : [po.finale].filter(Boolean)).map(s => [s.h, s.g, s.th, s.tg, s.art || '', s.elfer ? s.elfer.join(':') : '']) : null,
      tab: F.spieltag ? tabelleFuer(F) : null
    };
    z.ausgaben.push(ausgabe);
    if (z.ausgaben.length > CFG.ausgaben) z.ausgaben.splice(0, z.ausgaben.length - CFG.ausgaben);
    z.ged.push(a.vorlagen);
    if (z.ged.length > T.CFG.gedaechtnis) z.ged.splice(0, z.ged.length - T.CFG.gedaechtnis);
    if (ausgabe.still) z.gelesen = Math.max(z.gelesen || 0, z.nr);
    hinweisZeichnen();
    return ausgabe;
  }
  {
    const _orig = window.advanceCalendarWeek;
    if (typeof _orig === 'function') {
      window.advanceCalendarWeek = function () {
        const r = _orig.apply(this, arguments);
        try { takt(); } catch (e) { console.warn('[DFL-Zeitung] Wochentakt', e); }
        try { if (document.getElementById('view-zeitung') && document.getElementById('view-zeitung').classList.contains('active')) zeige(); } catch (e) { /* Ansicht fehlt */ }
        return r;
      };
      try { advanceCalendarWeek = window.advanceCalendarWeek; } catch (e) { /* window reicht */ }
    }
  }

  // ═══ Ansicht ══════════════════════════════════════════════════════════════
  const farbenVon = id => { const f = franchise(id); return (f && f.farben) || ['#3a4250', '#ffffff']; };
  const kuerzel = id => (window.DFLNamen && DFLNamen.kuerzel ? DFLNamen.kuerzel(id) : '') || ((franchise(id) || {}).kurz) || '';
  const teamName = id => (id === 'fcm' ? CLUB.name : ((franchise(id) || {}).name || id));
  function wappen(id, groesse, opt) {
    const f = franchise(id);
    try { if (f && window.DFLIdentitaet) return DFLIdentitaet.wappenSvg(f, Object.assign({ groesse }, opt || {})); } catch (e) { /* ohne Wappen */ }
    return '';
  }
  const kleinWappen = id => `<span class="lg-crest zg-wk" style="${typeof crestStyle === 'function' ? crestStyle(id) : ''}" aria-hidden="true"></span>`;
  function gesicht(p, teamId) {
    if (!p || !window.DFLIdentitaet) return '';
    // wie im Rest der App nur die Farben übergeben (gleiches Trikot wie in Kader, Trades, Scouting)
    try { return DFLIdentitaet.gesichtSvg({ id: p.id, seed: p.seed, dflSeed: p.seed, firstName: p.firstName, name: p.name }, { farben: farbenVon(teamId) }); } catch (e) { return ''; }
  }
  function fotoHtml(b) {
    if (!b) return '';
    if (b.art === 'gesicht') {
      const fb = farbenVon(b.team);
      return `<div class="zg-foto" style="--zg-farbe:${fb[0]}">
        ${b.erg ? `<span class="zg-erg">${esc(b.erg)}</span>` : ''}
        <span class="zg-ecke">${b.tausch ? `${wappen(b.tausch, 34)}<i class="ti ti-arrow-right" aria-hidden="true"></i>` : ''}${wappen(b.team, 44)}</span>
        <span class="zg-gesicht">${gesicht(b.p, b.team)}</span></div>`;
    }
    if (b.art === 'duell') {
      const fa = farbenVon(b.a), fb = farbenVon(b.b);
      return `<div class="zg-foto zg-duell" style="--zg-farbe:${fa[0]};--zg-farbe2:${fb[0]}">
        <span class="zg-dw">${wappen(b.a, 84)}</span><span class="zg-vs">${b.erg ? esc(b.erg) : b.tausch ? ic('arrows-exchange') : 'vs'}</span><span class="zg-dw">${wappen(b.b, 84)}</span></div>`;
    }
    if (b.art === 'wappen') {
      const fa = farbenVon(b.team), n = b.meister && window.DFLPlayoffs && DFLPlayoffs.titel ? DFLPlayoffs.titel(b.team) : 0;
      const sterne = n && window.DFLIdentitaet && DFLIdentitaet.sterneFuer ? DFLIdentitaet.sterneFuer(n) : 0;
      return `<div class="zg-foto zg-einzel" style="--zg-farbe:${fa[0]}">${b.meister ? `<span class="zg-pokal">${ic('trophy')}</span>` : ''}<span class="zg-dw">${wappen(b.team, sterne ? 112 : 104, sterne ? { sterne } : null)}</span></div>`;
    }
    return `<div class="zg-foto zg-einzel zg-liga"><span class="zg-pokal">${ic('trophy')}</span></div>`;
  }
  function miniBild(b) {
    if (!b) return '';
    if (b.art === 'gesicht') return `<span class="zg-mini" style="--zg-farbe:${farbenVon(b.team)[0]}">${gesicht(b.p, b.team)}</span>`;
    if (b.art === 'duell') return `<span class="zg-mini zg-mini-duell">${wappen(b.a, 30)}${wappen(b.b, 30)}</span>`;
    if (b.art === 'wappen') return `<span class="zg-mini zg-mini-wappen">${wappen(b.team, 44)}</span>`;
    return `<span class="zg-mini zg-mini-wappen">${ic('trophy')}</span>`;
  }
  function zitatHtml(z) {
    if (!z) return '';
    const bild = z.bild && z.bild.seed ? `<span class="zg-mini zg-mini-rund" style="--zg-farbe:${farbenVon(z.team)[0]}">${gesicht(z.bild, z.team)}</span>`
      : `<span class="zg-mini zg-mini-wappen">${wappen(z.team, 40)}</span>`;
    return `<figure class="zg-zitat">${bild}<blockquote><p>„${esc(z.text)}“</p><figcaption>${esc(z.name)}${z.rolle ? ', ' + esc(z.rolle) : ''}</figcaption></blockquote></figure>`;
  }
  function spieleHtml(a) {
    if (a.po && a.po.length) {
      return `<section class="zg-kasten" aria-label="Ergebnisse"><h3>${esc(a.kopf)}</h3><ul class="zg-ergebnisse">${a.po.map(([h, g, th, tg, art, el]) => `<li>
        ${kleinWappen(h)}<b>${esc(kuerzel(h))}</b><span class="zg-e">${th}:${tg}${art === 'Verlängerung' ? '<small>n. V.</small>' : art === 'Elfmeterschießen' ? `<small>${esc(el)} i. E.</small>` : ''}</span><b>${esc(kuerzel(g))}</b>${kleinWappen(g)}</li>`).join('')}</ul></section>`;
    }
    if (!a.spiele || !a.spiele.length) return '';
    return `<section class="zg-kasten" aria-label="Ergebnisse"><h3>${esc(a.kopf)}</h3><ul class="zg-ergebnisse">${a.spiele.map(([h, g, th, tg]) => `<li class="${h === 'fcm' || g === 'fcm' ? 'zg-eigen' : ''}">
      ${kleinWappen(h)}<b>${esc(kuerzel(h))}</b><span class="zg-e">${th}:${tg}</span><b>${esc(kuerzel(g))}</b>${kleinWappen(g)}</li>`).join('')}</ul></section>`;
  }
  function tabelleHtml(a) {
    if (!a.tab) return '';
    return `<section class="zg-kasten" aria-label="Tabelle"><h3>Conference ${esc(a.tab.konf)}</h3><ol class="zg-tab">${a.tab.zeilen.map(([id, pkt, pl, vor]) => {
      const pfeil = vor && vor !== pl ? (pl < vor ? `<i class="zg-auf" aria-label="aufgestiegen">${ic('caret-up-filled')}</i>` : `<i class="zg-ab" aria-label="abgestiegen">${ic('caret-down-filled')}</i>`) : '<i></i>';
      return `<li class="${id === 'fcm' ? 'zg-eigen' : ''}${pl === 7 ? ' zg-linie' : ''}"><span class="zg-pl">${pl}</span>${kleinWappen(id)}<span class="zg-tn">${esc(teamName(id))}</span>${pfeil}<b>${pkt}</b></li>`;
    }).join('')}</ol></section>`;
  }
  function blattHtml(a, liste) {
    const kopf = `<header class="zg-kopf"><b>Der Anstoß</b><small>Die Sportzeitung der Deutschen Kickdraft Liga</small></header>`;
    if (!a) return `<div class="zg">${kopf}<p class="zg-leer">Noch keine Ausgabe.</p></div>`;
    const datum = typeof calendarLabel === 'function' ? calendarLabel(a.w, LEAGUE.startYear || 2026) : 'KW ' + a.w;
    const [lead, ...rest] = a.stuecke;
    const archiv = (liste || []).slice().reverse();
    return `<div class="zg">${kopf}
      <div class="zg-unterzeile"><span>Ausgabe ${a.nr}</span><span>${esc(a.kopf)}</span><span>${esc(datum)}</span></div>
      <article class="zg-aufmacher">${fotoHtml(lead.bild)}
        <div class="zg-artikel"><span class="zg-rubrik">${esc(lead.rubrik)}</span><h2>${esc(lead.titel)}</h2>
          ${lead.saetze.length ? `<p class="zg-vorspann">${esc(lead.saetze[0])}</p>` : ''}
          ${lead.saetze.length > 1 ? `<p>${esc(lead.saetze.slice(1).join(' '))}</p>` : ''}
          ${zitatHtml(lead.zitat)}</div></article>
      ${rest.map(s => `<article class="zg-meldung">${miniBild(s.bild)}<div><span class="zg-rubrik">${esc(s.rubrik)}</span><h3>${esc(s.titel)}</h3>${s.saetze.length ? `<p>${esc(s.saetze.join(' '))}</p>` : ''}</div></article>`).join('')}
      ${spieleHtml(a)}${tabelleHtml(a)}
      ${archiv.length > 1 ? `<nav class="zg-archiv" aria-label="Frühere Ausgaben"><h3>Ausgaben</h3><div>${archiv.map(x => `<button type="button" class="zg-ausgabe${x.nr === a.nr ? ' aktiv' : ''}" data-zg-nr="${x.nr}"${x.nr === a.nr ? ' aria-current="true"' : ''}>
        <b>Nr. ${x.nr}</b><small>${esc(x.kopf)}</small></button>`).join('')}</div></nav>` : ''}
    </div>`;
  }
  let gezeigt = null;
  function zeige(nr) {
    const ziel = document.getElementById('zeitung-blatt'); if (!ziel) return;
    if (!dfl()) { ziel.innerHTML = blattHtml(null); return; }
    const z = zustand(), liste = z.ausgaben;
    const a = (nr != null && liste.find(x => x.nr === +nr)) || liste[liste.length - 1] || null;
    gezeigt = a ? a.nr : null;
    ziel.innerHTML = blattHtml(a, liste);
    if (a && a.nr === z.nr) z.gelesen = z.nr;
    hinweisZeichnen();
  }
  function zeitungAnsicht() {
    document.querySelectorAll('.app-view').forEach(el => el.classList.remove('active'));
    const v = document.getElementById('view-zeitung'); if (v) v.classList.add('active');
    document.querySelectorAll('.appnav-btn').forEach(b => b.classList.remove('active'));
    const nb = document.getElementById('nav-zeitung'); if (nb) nb.classList.add('active');
    zeige();
  }
  {
    const _orig = window.switchAppView;
    if (typeof _orig === 'function') {
      window.switchAppView = function (view) {
        const r = _orig.apply(this, arguments);
        try {
          // die feste Ansichtsliste in bundle_squad.js kennt 'zeitung' nicht: selbst ein- und ausblenden
          if (view === 'zeitung') zeitungAnsicht();
          else { const vz = document.getElementById('view-zeitung'); if (vz) vz.classList.remove('active'); }
        } catch (e) { console.warn('[DFL-Zeitung] Ansicht', e); }
        return r;
      };
      try { switchAppView = window.switchAppView; } catch (e) { /* window reicht */ }
    }
  }
  document.addEventListener('click', ev => {
    const b = ev.target.closest && ev.target.closest('[data-zg-nr]');
    if (b) { zeige(+b.getAttribute('data-zg-nr')); const v = document.getElementById('view-zeitung'); if (v && v.scrollIntoView) window.scrollTo(0, 0); return; }
    const h = ev.target.closest && ev.target.closest('#dfl-zeitung-neu');
    if (h) { if (window.DFLAppShell && DFLAppShell.zeige) DFLAppShell.zeige('zeitung'); else if (typeof switchAppView === 'function') switchAppView('zeitung', document.getElementById('nav-zeitung')); }
  });

  // ── Office: „Neue Ausgabe“ ────────────────────────────────────────────────
  function neueAusgabe() {
    if (!dfl()) return null;
    const z = CLUB.dfl.zeitung; if (!z || !z.ausgaben || !z.ausgaben.length) return null;
    const a = z.ausgaben[z.ausgaben.length - 1];
    return a.nr > (z.gelesen || 0) && !a.still ? a : null;
  }
  function hinweisZeichnen() {
    try {
      if (typeof document === 'undefined' || simAktiv()) return;
      const alt = document.getElementById('dfl-zeitung-neu'); if (alt) alt.remove();
      const a = neueAusgabe(), nav = document.getElementById('nav-zeitung');
      if (nav) nav.classList.toggle('zg-hat-neu', !!a);
      if (!a) return;
      const home = document.getElementById('view-home'); if (!home) return;
      const html = `<button type="button" id="dfl-zeitung-neu" class="zg-neu" aria-label="Neue Ausgabe: ${esc(a.stuecke[0].titel)}">
        <span class="zg-neu-ic">${ic('news')}</span><span class="zg-neu-txt"><b>Neue Ausgabe</b><small>${esc(a.stuecke[0].titel)}</small></span>${ic('chevron-right')}</button>`;
      const kopf = document.getElementById('app-office-kopf');
      if (kopf) kopf.insertAdjacentHTML('afterend', html); else home.insertAdjacentHTML('afterbegin', html);
    } catch (e) { console.warn('[DFL-Zeitung] Hinweis', e); }
  }
  {
    const _orig = window.renderHomeTab;
    if (typeof _orig === 'function') {
      window.renderHomeTab = function () { const r = _orig.apply(this, arguments); hinweisZeichnen(); return r; };
      try { renderHomeTab = window.renderHomeTab; } catch (e) { /* window reicht */ }
    }
  }

  // Spielstand ist beim Laden der Seite schon da (initGame läuft vor den Patches)
  altesAufraeumen();
  {
    const _orig = window._afterLoad;
    if (typeof _orig === 'function') window._afterLoad = function () { const r = _orig.apply(this, arguments); altesAufraeumen(); return r; };
  }
  setTimeout(() => { draftHaken(); hinweisZeichnen(); }, 0);

  window.DFLZeitung = { CFG, zeige, takt, fakten: () => fakten(true), zustand: () => (dfl() ? zustand() : null), ausgaben: () => (dfl() ? zustand().ausgaben : []),
    blattHtml, neueAusgabe, hinweisZeichnen };
  console.log('[DFL-Zeitung v1] aktiv — Der Anstoß: eine Sportzeitung für die Liga, erscheint an Tagen mit Geschichte, mit Porträts und Wappen');
})();
