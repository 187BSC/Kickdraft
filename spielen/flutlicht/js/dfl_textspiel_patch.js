/* ═══════════════════════════════════════════════════════════════════════════
   DFL · SPIEL ALS TEXT  ·  v1   (D77, Nutzer 2026-10-10: „beides“ – Jede Minute und Höhepunkte – und
                                  „ja sofort, kein Cheaten erlauben“)
   ─────────────────────────────────────────────────────────────────────────
   · Anpfiff: Engine v3 rechnet das ganze Spiel und bucht es sofort wie bisher (Tabelle, Noten, Kasse, Speichern).
     Danach spielt ein Ticker das Spiel nur noch ab – Tempo, Pause, „Sofort“ oder App schließen ändern nichts.
   · Einstellung je Gerät (localStorage 'dfl-textspiel'): Jede Minute · Höhepunkte (Standard) · Aus (= sofort wie
     bisher); am Anpfiff (Spieltag) und im Mehr-Blatt. Testspiele seit 2026-10-11 auch (Nutzer: „Anpfiff zeigt sofort das Ergebnis“).
   · Ticker als Vollbild: Anzeigetafel mit Torschützen, Druckleiste, Mini-Feld mit Schüssen, Zahlen, Zeilen (neueste
     oben), Pause · 1× · 4× · Sofort. Spielbericht und Hinweise (Torprämie …) kommen erst nach dem Abpfiff.
   · Playoffs: Tore der Verlängerung und das Elfmeterschießen Schuss für Schuss (DFLPlayoffs.nachspiel).
   · Neustart mitten im Ticker: das Spiel ist schon gebucht und gespeichert; der Ticker geht an derselben Stelle weiter
     (Paket im localStorage, nur wenn der geladene Spielstand die Buchung enthält). Nichts lässt sich neu würfeln.
   · Nebenbei: Gegner-Formation im Spieltag-Kopf nach dem Abpfiff (stand bis 2026-10-10 auf „wird analysiert…“).
   Hängt sich an: handleKO, simulateCurrentFixture (außen), MatchEngineV3.simulateMatch, PostMatchModal.show, showToast,
   postMatchContinue, resetMatchState, switchAppView. Text: dfl_textspiel.js (DFLTextKern). CSS: css/dfl_textspiel.css.
   API: DFLTextspiel.einstellung() · .setzeEinstellung(w) · .tempo() · .setzeTempo(t) (D111) · .einstellungText() · .einstellungBlatt() · .laeuft() · .offen()
        · .sofort() · .wiederaufnehmen() · .paket() · .schritte() · .ohne(fn) (fn spielt eigene Spiele ohne Ticker, z. B. D64)
        · .proBowl(daten, fertig) (D158: fertig gerechneten Pro Bowl abspielen, false = kein Ticker)
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const K = window.DFLTextKern;
  if (!K) { console.warn('[DFL-Textspiel] Kern fehlt (dfl_textspiel.js) – Patch inaktiv'); return; }

  const KEY = 'dfl-textspiel', KEY_TEMPO = 'dfl-textspiel-tempo', KEY_PAKET = 'dfl-textspiel-paket', KEY_POS = 'dfl-textspiel-pos';
  const WAHLEN = [
    { w: 'minute', titel: 'Jede Minute', icon: 'ti-list-details', sub: 'Eine Zeile je Minute · etwa 2½ Minuten' },
    { w: 'hoehepunkte', titel: 'Höhepunkte', icon: 'ti-flame', sub: 'Tore, Chancen, Karten · etwa 1 Minute' },
    { w: 'aus', titel: 'Aus', icon: 'ti-player-track-next', sub: 'Sofort zum Ergebnis' }
  ];
  const esc = K.esc;
  // Kickstil (normale Fußballwelt): kein CLUB.dfl/LEAGUE.dfl – aktiv, sobald ein Spielstand geladen ist.
  // In Kickdraft stand hier die DFL-Prüfung; Name `dfl` bleibt, damit das Modul mit Kickdraft vergleichbar bleibt.
  const dfl = () => typeof CLUB !== 'undefined' && CLUB && typeof LEAGUE !== 'undefined' && LEAGUE &&
    (!CLUB.dfl || !!CLUB.dfl.aktiv);
  // Kennung des eigenen Vereins für das Fortsetzen nach Neustart (DFL: Franchise-ID, hier der Vereinsname)
  const vereinKey = () => (CLUB.dfl && CLUB.dfl.franchiseId) || CLUB.name || 'fcm';
  const hatDom = () => typeof document !== 'undefined' && !!document.body;
  const ls = {
    lies(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    schreib(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    weg(k) { try { localStorage.removeItem(k); } catch (e) { /* ohne Speicher */ } }
  };

  // ── Einstellung je Gerät ─────────────────────────────────────────────────
  function einstellung() { const w = ls.lies(KEY); return WAHLEN.some(x => x.w === w) ? w : 'hoehepunkte'; }
  function setzeEinstellung(w) {
    ls.schreib(KEY, WAHLEN.some(x => x.w === w) ? w : 'hoehepunkte');
    try { wahlZeigen(); } catch (e) { /* nur Anzeige */ }
    return einstellung();
  }
  const einstellungText = () => (WAHLEN.find(x => x.w === einstellung()) || WAHLEN[1]).titel;
  const variante = () => (einstellung() === 'minute' ? 'A' : 'B');
  const tempo = () => (+ls.lies(KEY_TEMPO) === 4 ? 4 : 1);
  // Tempo aus Mehr → Einstellungen (dfl_app_shell.js, 2026-10-11): gilt ab dem nächsten Spiel, ein laufender Ticker zieht mit
  function setzeTempo(t) {
    const v = +t === 4 ? 4 : 1;
    ls.schreib(KEY_TEMPO, String(v));
    try { if (ui.hatSpiel() && ui.tempo !== v) { ui.tempo = v; if (ui.laeuft) { ui.stop(); ui.laeuft = true; ui.naechster(); } ui.steuerZeigen(); } } catch (e) { /* nur Anzeige */ }
    return v;
  }

  // ── Spielzustand ─────────────────────────────────────────────────────────
  const aktFixture = () => (typeof CURRENT_FIXTURE !== 'undefined' && CURRENT_FIXTURE) ? CURRENT_FIXTURE : null;
  const spielG = () => (typeof G !== 'undefined' && G) ? G : {};
  const engineAn = () => !!window.MatchEngineV3 && !(typeof CLUB !== 'undefined' && CLUB && CLUB.settings && CLUB.settings.engineV3 === false);
  // Liga-, Playoff- und Testspiele des eigenen Vereins (Testspiele seit 2026-10-11). ohne(fn): fn rechnet eigene Spiele ohne Ticker
  // (für „Simulieren bis …“, D64: dort laufen eigene Spiele sofort)
  let unterdrueckt = 0;
  // Kickstil: auch Pokal- und Europapokalspiele (DFL kannte nur Liga, Playoffs, Testspiele)
  const TICKER_TYPEN = ['liga', 'pokal', 'euro', 'friendly', 'playoff'];
  const tickerFuer = fx => !!(fx && !unterdrueckt && dfl() && engineAn() && einstellung() !== 'aus' && TICKER_TYPEN.indexOf(fx.type) >= 0);
  // Kopfzeile je Spielart (Kickstil: Pokal und Europapokal dazu)
  function kopfText(fx, eigenHeim, md) {
    const ort = eigenHeim ? 'Heim' : 'Auswärts';
    if (fx.type === 'friendly') return `Testspiel · ${ort}`;
    if (fx.type === 'pokal') return `Pokal · ${fx.roundName || 'Runde'} · ${ort}`;
    if (fx.type === 'euro') {
      const wb = ({ cl: 'Champions League', el: 'Europa League', co: 'Conference League', ecl: 'Conference League' })[String(fx.comp || '').toLowerCase()] || 'Europapokal';
      const phase = fx.euroKind === 'ko' ? (fx.round || 'K.-o.-Runde') + (fx.leg ? ` · ${fx.leg}. Spiel` : '') : 'Ligaphase';
      return `${wb} · ${phase} · ${ort}`;
    }
    return `Spieltag ${md || ''} · ${ort}`;
  }
  function ohne(fn) { unterdrueckt++; try { return fn(); } finally { unterdrueckt--; } }
  const aktiverSlot = () => (typeof ACTIVE_SLOT_ID !== 'undefined' ? ACTIVE_SLOT_ID : null);

  function teamInfo(id) {
    let f = null;
    try { f = window.DFLSpiel && DFLSpiel.franchise ? DFLSpiel.franchise(id) : null; } catch (e) { f = null; }
    if (f && f.name) {
      const teile = String(f.name).split(' ');
      return { id, name: f.name, stadt: f.city || teile[0], spitz: f.kurzname || teile.slice(1).join(' ') || f.name,
        kurz: f.kurz || f.kuerzel || teile[0].slice(0, 3).toUpperCase(), farben: (f.farben || []).slice(0, 2) };
    }
    let name = 'Gegner';
    try { name = id === 'fcm' ? CLUB.name : ((typeof TEAMS !== 'undefined' && TEAMS.away && TEAMS.away.name) || 'Gegner'); } catch (e) { /* Rückfall */ }
    const teile = String(name).split(' ');
    // Kickstil: Vereinsfarben aus club_colors.js; Kürzel wie in der Tabelle (crestInitials), Stadt = letztes Wort
    // („1. FC Köln“ → Köln, „Borussia Dortmund“ → Dortmund)
    let farben = [];
    // Farben als Hex (KSVerein rechnet die HSL-Farben unbekannter Vereine um; der Ticker prüft auf #rrggbb)
    try {
      if (window.KSVerein) { const d = KSVerein.daten(id); if (d && d.farben) farben = d.farben.slice(0, 2); }
      else if (typeof clubColors === 'function') { const c = clubColors(id); if (c && c[0]) farben = [c[0]]; }
    } catch (e) { /* ohne Farbe */ }
    // Kurzname für Sätze in Einzahl: Rechtsform und Jahreszahl weg („1. FC Köln“ → Köln, „SV Werder Bremen“ →
    // Werder Bremen, „Hannover 96“ → Hannover, „TSG 1899 Hoffenheim“ → Hoffenheim, „RB Leipzig“ → Leipzig)
    const FORM = /^(\d+\.?|FC|SV|SC|VfL|VfB|TSG|TSV|FSV|SpVgg|SG|BV|RB|SSV|SpVg|KFC|MSV|FK|AC|AS|SK|BSC|SSC|SU|TuS|TSC|VfR|SVgg)$/i;
    const woerter = teile.filter(w => !FORM.test(w) || w === 'BSC');
    while (woerter.length > 1 && /^\d+$/.test(woerter[woerter.length - 1])) woerter.pop();
    const kurzName = woerter.filter(w => !/^\d+\.?$/.test(w)).join(' ') || name;
    // Drei Buchstaben aus dem Ortsnamen (letztes Wort): „Borussia Dortmund“ → DOR, „1. FC Köln“ → KÖL
    const ortWort = kurzName.split(' ').pop();
    const kurz = ortWort.replace(/[^A-Za-zÄÖÜäöüß]/g, '').slice(0, 3).toUpperCase() || 'XXX';
    return { id, name, stadt: kurzName, spitz: kurzName, kurz, farben, einzahl: true };
  }
  function playoffStand() { try { return window.DFLPlayoffs && DFLPlayoffs.stand ? DFLPlayoffs.stand() : null; } catch (e) { return null; } }
  function playoffSpiel(fx) {
    const po = playoffStand();
    return po && Array.isArray(po.spiele) ? po.spiele.find(s => s.runde === fx.runde && (s.heim === 'fcm' || s.gast === 'fcm')) || null : null;
  }
  // Playoff-Layout (Nachtschicht 2026-10-13, Wunsch des Nutzers „Anderes Ticker layout für playoffs“): Weg durch die Runden,
  // Seeds an der Tafel, Flutlicht-Farben und goldene Tore (CSS .ts-po); Schluss langsamer (naechster)
  const PO_WEG = ['Wildcard', 'Divisional', 'Conf.-Finale', 'Finale'];
  const PB_KOPF = '<div class="ts-po-kopf"><ol class="ts-po-weg" aria-label="Weg durch die Playoffs"><li class="durch"><i class="ti ti-check" aria-hidden="true"></i>Conf.-Finale</li>' +
    '<li class="jetzt">Pro Bowl</li><li>Finale</li></ol></div>';
  function poInfo(T, kopf) {
    const po = playoffStand(); if (!po || !Array.isArray(po.spiele) || !po.setzliste) return null;
    const sp = po.spiele.find(x => x.runde === po.runde && (x.heim === 'fcm' || x.gast === 'fcm'));
    // Runde aus dem Kopf („Playoffs · Wildcard-Runde · …“): beim Abspielen ist die Runde schon gebucht und po.runde eine weiter
    // (Spieltest 2026-10-14: im Wildcard-Spiel stand „Divisional“ als laufende Runde, Wildcard schon abgehakt)
    const name = String(kopf || '').split(' · ')[1] || '', R = (window.DFLPlayoffs && DFLPlayoffs.RUNDE) || {};
    const r = +(Object.keys(R).find(k => R[k] === name) || 0) || (sp ? sp.runde : po.runde);
    const seed = id => { for (const k of Object.keys(po.setzliste)) { const i = po.setzliste[k].indexOf(id); if (i >= 0) return i + 1; } return null; };
    const weg = PO_WEG.map((n, i) => `<li class="${i + 1 < r ? 'durch' : i + 1 === r ? 'jetzt' : ''}">${i + 1 < r ? '<i class="ti ti-check" aria-hidden="true"></i>' : ''}${n}</li>`).join('');
    return { runde: r, seedH: seed(T.h.id), seedG: seed(T.g.id),
      html: `<div class="ts-po-kopf"><ol class="ts-po-weg" aria-label="Weg durch die Playoffs">${weg}</ol></div>` };
  }
  // Verlängerung/Elfmeterschießen des eben gebuchten Playoff-Spiels, in Anzeigeseiten (h = Heim der Paarung)
  function nachspielDaten(fx, eigenHeim) {
    if (!fx || fx.type !== 'playoff' || !window.DFLPlayoffs || typeof DFLPlayoffs.nachspiel !== 'function') return null;
    const n = DFLPlayoffs.nachspiel();
    if (!n || !n.art || n.art === 'regulär' || (n.gegner != null && n.gegner !== fx.opponentId) || (n.runde != null && n.runde !== fx.runde)) return null;
    const seite = eigen => ((eigen === eigenHeim) ? 'h' : 'g');
    return { art: n.art, tore: (n.tore || []).map(t => ({ m: t.m, s: seite(!!t.eigen), name: t.name || '' })),
      kicks: (n.kicks || []).map(k => ({ s: seite(k.seite === 0), wer: k.wer || '', tor: !!k.tor })),
      elfer: Array.isArray(n.elfer) ? (eigenHeim ? [n.elfer[0], n.elfer[1]] : [n.elfer[1], n.elfer[0]]) : null };
  }
  const verletzteIds = () => { try { return new Set(SQUAD.filter(p => p && p.injuryWeeks > 0).map(p => p.id)); } catch (e) { return new Set(); } };
  function neuVerletzt(vorher) {
    if (!vorher) return [];
    try {
      return SQUAD.filter(p => p && p.injuryWeeks > 0 && !vorher.has(p.id))
        .map(p => ({ name: typeof displayName === 'function' ? displayName(p) : p.name, typ: p.injuryType || 'Verletzung', wochen: p.injuryWeeks }));
    } catch (e) { return []; }
  }

  // ── Paket: alles, was der Ticker braucht – gebaut NACH dem Buchen, nur Anzeige ──
  function paketBauen(fx, verletztVorher, live) {
    const rec = live ? live.rec : window.LAST_MATCH_2D;
    if (!rec || !Array.isArray(rec.events) || !fx) return null;
    const sp = fx.type === 'playoff' ? playoffSpiel(fx) : null;
    const eigenHeim = sp ? sp.heim === 'fcm' : !!fx.isHome;
    REC2D = rec.frames && rec.frameCount ? { rec, eigenHeim } : null;     // Bilder nur im Speicher, nie im Paket (zu groß)
    const eig = teamInfo('fcm'), geg = teamInfo(fx.opponentId);
    const teams = eigenHeim ? { h: eig, g: geg } : { h: geg, g: eig };
    const po = fx.type === 'playoff' ? playoffStand() : null;
    const finalort = fx.neutral && po ? po.finalort || null : null;
    let lam = null;
    try { lam = window.DFLEngine && DFLEngine.letzte ? DFLEngine.letzte() : null; } catch (e) { lam = null; }
    const lambda = lam && Array.isArray(lam.lambda) ? (eigenHeim ? [lam.lambda[0], lam.lambda[1]] : [lam.lambda[1], lam.lambda[0]]) : null;
    const E = window.MatchEngineV3 || {};
    const spiel = K.aufbereiten(rec, { eigenHeim, teams, seed: Math.floor(Math.random() * 1e9), ort: finalort || teams.h.stadt,
      runde: fx.type === 'playoff' ? (fx.roundName || null) : null, lambda, nach: nachspielDaten(fx, eigenHeim), L: E.L || 105, B: E.B || 68 });
    if (live && live.seed != null) spiel.seed = live.seed;      // PC-Live: gleiche Satzwahl in jedem Abschnitt
    // Sicherung: der Ticker zeigt genau das gebuchte Ergebnis – sonst kein Ticker (Bericht wie bisher)
    const fp = K.fahrplan(spiel, 'B'), g = spielG();
    const eigen = eigenHeim ? fp.stand.h : fp.stand.g, gegner = eigenHeim ? fp.stand.g : fp.stand.h;
    if ((!live || live.pruefen) && (eigen !== g.homeGoals || gegner !== g.awayGoals)) {
      console.warn('[DFL-Textspiel] Ticker-Stand weicht vom gebuchten Ergebnis ab – kein Ticker', fp.stand, g.homeGoals, g.awayGoals);
      return null;
    }
    const news = typeof CLUB !== 'undefined' && CLUB && Array.isArray(CLUB.news) ? CLUB.news[0] : null;
    const kopf = fx.type === 'playoff'
      ? `Playoffs · ${fx.roundName || 'Runde ' + fx.runde} · ${fx.neutral ? (finalort ? 'Finale in ' + finalort : 'neutraler Platz') : eigenHeim ? 'Heim' : 'Auswärts'}`
      : kopfText(fx, eigenHeim, fx.matchday || LEAGUE.matchday);
    return { v: 1, slot: aktiverSlot(), verein: vereinKey(), saison: LEAGUE.season, woche: LEAGUE.week, md: LEAGUE.matchday,
      newsTs: news ? news.ts : null, newsTitel: news ? news.title : null, typ: fx.type, kopf, variante: variante(), spiel,
      verletzt: neuVerletzt(verletztVorher), erzeugt: Date.now() };
  }
  function paketSpeichern(p) {
    try {
      const json = JSON.stringify(p), LZ = window.LZString;
      if (!ls.schreib(KEY_PAKET, LZ && LZ.compressToUTF16 ? 'LZ1:' + LZ.compressToUTF16(json) : json)) return false;
      ls.schreib(KEY_POS, String(ui.p === p ? ui.i : 0));
      return true;
    } catch (e) { return false; }
  }
  function paketLesen() {
    const roh = ls.lies(KEY_PAKET);
    if (!roh) return null;
    try {
      const json = roh.indexOf('LZ1:') === 0 ? (window.LZString ? LZString.decompressFromUTF16(roh.slice(4)) : null) : roh;
      return json ? JSON.parse(json) : null;
    } catch (e) { return null; }
  }
  function paketLoeschen() { ls.weg(KEY_PAKET); ls.weg(KEY_POS); }
  // Gehört das Paket zum geladenen Spielstand, und ist die Buchung darin gespeichert? (Meldung zum Spiel im Postfach)
  function passt(p) {
    if (!p || p.v !== 1 || !p.spiel || !dfl()) return false;
    if (p.typ === 'friendly') return false;                                 // Testspiel: Buchung nicht sicher erkennbar → nicht fortsetzen
    if (p.verein !== vereinKey() || p.saison !== LEAGUE.season || p.woche !== LEAGUE.week) return false;
    if (p.slot != null && aktiverSlot() != null && p.slot !== aktiverSlot()) return false;
    const g = spielG(); if (g.running) return false;
    if (p.newsTs != null) return Array.isArray(CLUB.news) && CLUB.news.some(n => n && n.ts === p.newsTs && n.title === p.newsTitel);
    return p.md === LEAGUE.matchday;
  }

  // ── Bericht und Hinweise zurückhalten, solange der Ticker läuft ──────────
  let scharf = false, halten = false, berichtWartet = false;
  const wartendeHinweise = [];
  function freigeben(ohneBericht) {
    halten = false;
    const bericht = berichtWartet && !ohneBericht;
    berichtWartet = false;
    if (bericht && window.PostMatchModal && typeof PostMatchModal.show === 'function') {
      try { PostMatchModal.show(); } catch (e) { console.warn('[DFL-Textspiel] Spielbericht', e); }
    }
    wartendeHinweise.splice(0).forEach(a => { try { window.showToast.apply(window, a); } catch (e) { /* Hinweis optional */ } });
  }
  if (window.PostMatchModal && typeof window.PostMatchModal.show === 'function') {
    const _show = window.PostMatchModal.show;
    window.PostMatchModal.show = function () {
      if (halten) { berichtWartet = true; return; }
      return _show.apply(this, arguments);
    };
  }
  if (typeof window.showToast === 'function') {
    const _toast = window.showToast;
    window.showToast = function () {
      if (halten) { wartendeHinweise.push(Array.from(arguments)); return; }
      return _toast.apply(this, arguments);
    };
  }
  // Erst der Engine-Lauf schaltet scharf: Hinweise davor („Aufstellung angepasst“) kommen sofort
  if (window.MatchEngineV3 && typeof window.MatchEngineV3.simulateMatch === 'function') {
    const _sim = window.MatchEngineV3.simulateMatch;
    window.MatchEngineV3.simulateMatch = function () {
      if (scharf) halten = true;
      return _sim.apply(this, arguments);
    };
  }

  // ── Zeichnen: Farben, Wappen, Druckleiste, Mini-Feld ──────────────────────
  const rgb = h => { const x = parseInt(String(h).slice(1), 16); return [(x >> 16) & 255, (x >> 8) & 255, x & 255]; };
  const abstand = (a, b) => { const p = rgb(a), q = rgb(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
  const hell = h => { const [r, g, b] = rgb(h).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const farbeOk = h => /^#[0-9a-f]{6}$/i.test(String(h || ''));
  // Gleiche Farbe → der Gast trägt die zweite; fast Weiß/Schwarz → Textfarbe (sonst unsichtbar auf Tag bzw. Nacht);
  // helle Farben (Gelb) für den hellen Grund abgedunkelt, Schrift darauf dunkel (Nacht hellt in CSS wieder auf)
  function farben(T) {
    const fh = farbeOk(T.h.farben && T.h.farben[0]) ? T.h.farben[0] : '#7f8c8d';
    let fg = farbeOk(T.g.farben && T.g.farben[0]) ? T.g.farben[0] : '#95a5a6';
    // Trikots v1: bei gleicher Farbe spielt der Gast im Auswärtstrikot (kickstil_trikots.js)
    if (window.KSTrikot && farbeOk(T.h.farben && T.h.farben[0]) && farbeOk(T.g.farben && T.g.farben[0])) fg = KSTrikot.gastKit(T.h, T.g).a;
    else if (abstand(fh, fg) < 70 && farbeOk(T.g.farben && T.g.farben[1])) fg = T.g.farben[1];
    const lesbar = f => {
      const l = hell(f);
      if (l < 0.03 || l > 0.85) return ['var(--text)', 'var(--bg2)'];
      return l > 0.4 ? [`color-mix(in srgb, ${f} 72%, #000)`, '#1d2b20'] : [f, '#fff'];
    };
    const h = lesbar(fh), g = lesbar(fg);
    return { th: h[0], tg: g[0], thAuf: h[1], tgAuf: g[1] };
  }
  function farbenSetzen(r, T) {
    const f = farben(T);
    r.style.setProperty('--th', f.th); r.style.setProperty('--tg', f.tg);
    r.style.setProperty('--th-auf', f.thAuf); r.style.setProperty('--tg-auf', f.tgAuf);
  }
  const wappen = (id, kl) => `<span class="lg-crest ${kl || ''}" style="${typeof crestStyle === 'function' ? crestStyle(id) : ''}" aria-hidden="true"></span>`;
  const zahl = (x, n) => Number(x || 0).toFixed(n).replace('.', ',');
  function druckSvg(werte, tore, bis, gross) {
    const n = Math.max(1, werte.length), W = n * 4, H = gross ? 64 : 40, m = H / 2, amp = m - 5;
    let s = `<svg viewBox="0 0 ${W} ${H + (gross ? 12 : 0)}" preserveAspectRatio="none" role="img" aria-label="Druck je Minute: oben Heim, unten Gast">`;
    s += `<line class="ts-null" x1="0" y1="${m}" x2="${W}" y2="${m}"/><line class="ts-hz" x1="180" y1="2" x2="180" y2="${H - 2}"/>`;
    for (let i = 0; i <= Math.min(bis, n - 1); i++) {
      const v = werte[i], h = Math.max(0.6, Math.abs(v) * amp);
      s += v >= 0 ? `<rect class="ts-bh" x="${i * 4 + 0.5}" y="${(m - h).toFixed(1)}" width="3" height="${h.toFixed(1)}" rx="1"/>` : `<rect class="ts-bg" x="${i * 4 + 0.5}" y="${m}" width="3" height="${h.toFixed(1)}" rx="1"/>`;
    }
    tore.filter(z => z.mi <= bis).forEach(z => { s += `<circle class="ts-tp ${z.s}" cx="${Math.min(n - 1, z.mi) * 4 + 2}" cy="${z.s === 'h' ? 4 : H - 4}" r="3.4"/>`; });
    if (!gross && bis >= 0 && bis < n - 1) s += `<line class="ts-jetzt" x1="${bis * 4 + 2}" y1="1" x2="${bis * 4 + 2}" y2="${H - 1}"/>`;
    if (gross) s += `<text class="ts-achse" x="1" y="${H + 10}">1'</text><text class="ts-achse" x="180" y="${H + 10}" text-anchor="middle">45'</text><text class="ts-achse" x="${W - 1}" y="${H + 10}" text-anchor="end">90'</text>`;
    return s + '</svg>';
  }
  // ── 2D-Wiedergabe im Lagebild (Nutzer 2026-10-17: „das Spiel in 2D wiedergegeben, wie in den alten Versionen“) ──
  // Die Engine zeichnet jedes Spiel Bild für Bild auf (LAST_MATCH_2D: je Bild 22 Spieler x/y, Ball 44/45, Uhr 47; Team 0 = eigener
  // Verein, spielt nach +x, kein Seitenwechsel). Zu jeder Tickerzeile laufen die Sekunden davor in ~1 s als Mini-Spiel ab.
  // Nach einem Neuladen fehlt die Aufzeichnung (nur im Speicher) – dann bleibt es beim Ball-Punkt wie bisher.
  // Nutzer 2026-10-17 (später): „die Spieler sollten aus dem Ticker noch raus – nur wo der Ball mit einer Aktion im Torraum war,
  // das war der beste Stand“ → 2D-Wiedergabe aus (Ball-Punkt und Schüsse wie vorher); Code bleibt zum Wiedereinschalten
  const ZWEI_D = false;
  let REC2D = null, ANIM2D = null;
  const RUHIG2D = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  function bild2d(R, t) {
    const S = R.stride || 53, F = R.frames;
    let lo = 0, hi = R.frameCount - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (F[mid * S + 47] <= t) lo = mid; else hi = mid - 1; }
    return lo;
  }
  function zeichne2d(el, i) {
    const R = REC2D.rec, S = R.stride || 53, F = R.frames, o = i * S, heim = REC2D.eigenHeim;
    const X = x => (heim ? x : 105 - x), Y = y => (heim ? y : 68 - y);
    let g = el.sp;
    if (!g.childNodes.length) {
      const eigen = heim ? 'h' : 'g', fremd = heim ? 'g' : 'h';
      let h = '';
      for (let k = 0; k < 22; k++) h += `<circle class="${k < 11 ? eigen : fremd}${k === 0 || k === 11 ? ' tw' : ''}" r="1.7" cx="-9" cy="-9"/>`;
      g.innerHTML = h;
    }
    const kreise = g.childNodes;
    for (let k = 0; k < 22; k++) {
      const x = F[o + 2 * k], y = F[o + 2 * k + 1], c = kreise[k];
      const weg = !(x > -6 && x < 111 && y > -6 && y < 74);                 // vom Platz gestellt oder nicht aufgezeichnet
      c.setAttribute('cx', weg ? -9 : X(x).toFixed(1)); c.setAttribute('cy', weg ? -9 : Y(y).toFixed(1));
    }
    const bx = F[o + 44], by = F[o + 45];
    if (bx === bx && by === by) el.ball.style.transform = `translate(${X(bx).toFixed(1)}px,${Y(by).toFixed(1)}px)`;
  }
  function zweiD(el, z, still) {
    if (!REC2D || !el || !el.sp || !z || z.t == null) return;
    const R = REC2D.rec, ziel = bild2d(R, z.t);
    clearInterval(ANIM2D); ANIM2D = null;
    el.root2d.classList.add('ts-2d');
    if (still || RUHIG2D()) { zeichne2d(el, ziel); return; }
    let i = bild2d(R, Math.max(0, z.t - 6));
    const schritt = Math.max(1, Math.ceil((ziel - i) / 24));            // ~24 Bilder je Szene, je 45 ms ≈ 1,1 s
    zeichne2d(el, i);
    ANIM2D = setInterval(() => {
      i = Math.min(ziel, i + schritt);
      try { zeichne2d(el, i); } catch (e) { clearInterval(ANIM2D); }
      if (i >= ziel) { clearInterval(ANIM2D); ANIM2D = null; }
    }, 45);
  }
  function feldSvg(T) {
    let streifen = '';
    for (let i = 0; i < 10; i++) streifen += `<rect class="${i % 2 ? 'ts-rb' : 'ts-ra'}" x="${i * 10.5}" y="0" width="10.5" height="68"/>`;
    return `<svg class="ts-feld" viewBox="-3 -3 111 74" role="img" aria-label="Spielfeld: Schüsse und Ball, ${esc(T.h.kurz)} spielt nach rechts">
      <rect x="-3" y="-3" width="111" height="74" class="ts-ra"/>${streifen}
      <g class="ts-linien"><rect x="0" y="0" width="105" height="68"/><line x1="52.5" y1="0" x2="52.5" y2="68"/><circle cx="52.5" cy="34" r="9.15"/>
      <rect x="0" y="13.84" width="16.5" height="40.32"/><rect x="0" y="24.84" width="5.5" height="18.32"/><rect x="88.5" y="13.84" width="16.5" height="40.32"/><rect x="88.5" y="24.84" width="5.5" height="18.32"/>
      <rect x="-2" y="30.34" width="2" height="7.32"/><rect x="105" y="30.34" width="2" height="7.32"/></g>
      <text class="ts-rtg" x="3" y="7">${esc(T.h.kurz)} ▸</text><text class="ts-rtg" x="102" y="7" text-anchor="end">◂ ${esc(T.g.kurz)}</text>
      <g class="ts-schuesse"></g><g class="ts-sp" aria-hidden="true"></g><circle class="ts-ballp" r="1.9" cx="0" cy="0" style="transform:translate(52.5px,34px)"/></svg>`;
  }
  const ICON = { taktik: 'ti-clipboard-list', reaktion: 'ti-message-circle', chance: 'ti-target-arrow', schuss: 'ti-target', elfmeter: 'ti-target-arrow', ecke: 'ti-flag', abseits: 'ti-flag-3', freistoss: 'ti-wall',
    foul: 'ti-alert-triangle', lage: 'ti-chart-line', info: 'ti-clock', wechsel: 'ti-arrows-exchange', verletzt: 'ti-ambulance' };
  function zeileHtml(z) {
    if (z.art === 'tor') {
      return `<div class="ts-tor-kopf"><span class="ts-ball"><i class="ti ti-ball-football" aria-hidden="true"></i></span><b>Tor</b><span class="ts-tor-stand">${z.stand.h}:${z.stand.g}</span>` +
        `<span class="ts-marken">${z.marke && z.marke !== 'Tor' ? `<span class="ts-marke">${esc(z.marke)}</span>` : ''}${z.zusatz ? `<span class="ts-marke gold">${esc(z.zusatz)}</span>` : ''}</span></div>` +
        `<p>${z.html}</p>${z.vorlage ? `<small>Vorlage ${esc(z.vorlage)}</small>` : ''}`;
    }
    if (z.art === 'gelb' || z.art === 'rot') return `<span class="ts-ic"><i class="ts-kt ${z.karte === 'gelbrot' ? 'gelbrot' : z.art}"></i></span><p>${z.html}</p>`;
    if (z.art === 'elfer') return `<span class="ts-ic"><i class="ti ${z.tor ? 'ti-circle-check' : 'ti-circle-x'}" aria-hidden="true"></i></span><p>${z.html}</p><b class="ts-ie-stand">${z.iE.h}:${z.iE.g}</b>`;
    if (z.art === 'aktion') return `<span class="ts-ic"><i class="ts-punkt"></i></span><p>${z.html}</p>`;
    return `<span class="ts-ic"><i class="ti ${ICON[z.art] || 'ti-point'}" aria-hidden="true"></i></span><p>${z.html}</p>`;
  }

  // ── Der Ticker (Vollbild) ────────────────────────────────────────────────
  const ui = {
    root: null, el: null, p: null, fp: null, st: [], i: 0, timer: null, laeuft: false, fertig: false, wieder: false,
    bloecke: {}, schussN: 0, torListe: { h: [], g: [] },
    offen() { return !!(this.root && !this.root.hidden); },
    hatSpiel() { return !!this.p; },
    dom() {
      if (this.root && this.root.parentNode) return this.root;
      const r = document.createElement('div');
      r.id = 'dfl-ts'; r.className = 'dfl-ts'; r.hidden = true;
      r.setAttribute('role', 'dialog'); r.setAttribute('aria-modal', 'true'); r.setAttribute('aria-label', 'Spiel als Text');
      r.addEventListener('click', ev => this.klick(ev));
      document.body.appendChild(r);
      this.root = r;
      return r;
    },
    zeigen() { if (!this.root) return; this.root.hidden = false; document.body.classList.add('ts-offen'); },
    verstecken() { if (this.root) this.root.hidden = true; if (hatDom()) document.body.classList.remove('ts-offen'); },
    schliessen() {
      this.stop();
      if (this.root && this.root.parentNode) this.root.parentNode.removeChild(this.root);
      this.root = null; this.el = null; this.p = null; this.fertig = false; this.wieder = false;
      if (hatDom()) document.body.classList.remove('ts-offen');
      paketLoeschen();
    },
    // Kopf und Tafel aus Spiel und Teams (vor dem Rechnen: ohne Zahlen); Playoffs mit eigenem Layout (poInfo)
    geruest(T, kopf, art) {
      // Pro Bowl (D158): Flutlicht wie die Playoffs, Weg „Conf.-Finale · Pro Bowl · Finale“, Conference-Marken statt Wappen
      const pb = !!(this.p && this.p.typ === 'probowl');
      const po = pb ? { html: PB_KOPF } : /^Playoffs/.test(kopf || '') ? poInfo(T, kopf) : null;
      this.po = !!po;
      if (this.root) { this.root.classList.toggle('ts-po', !!po); this.root.classList.toggle('ts-pb', pb); }
      const seed = n => (n ? `<small class="ts-seed">Seed ${n}</small>` : '');
      const marke = (X, kl) => X.marke || wappen(X.id, kl);
      return `<div class="ts-box">
        <header class="ts-kopf">${pb ? '<span class="ts-wappen ts-pb-stern" aria-hidden="true"><i class="ti ti-star-filled"></i></span>' : wappen('fcm', 'ts-wappen')}<span class="ts-kopf-txt"><b>${esc(pb ? 'Pro Bowl' : typeof CLUB !== 'undefined' && CLUB ? CLUB.name : '')}</b><small>${esc(kopf)}</small></span>
          <span class="ts-art"><i class="ti ti-message-dots" aria-hidden="true"></i>${esc(art)}</span></header>
        ${po ? po.html : ''}
        <div class="ts-anzeige">
          <div class="ts-team h">${marke(T.h, 'ts-wappen-k')}<b>${esc(T.h.kurz)}${po ? seed(po.seedH) : ''}</b></div>
          <div class="ts-mitte"><div class="ts-stand" aria-live="polite"><span class="ts-sh">0</span><i>:</i><span class="ts-sg">0</span></div><div class="ts-uhr">Anpfiff</div></div>
          <div class="ts-team g"><b>${esc(T.g.kurz)}${po ? seed(po.seedG) : ''}</b>${marke(T.g, 'ts-wappen-k')}</div>
          <div class="ts-tore h"></div><div class="ts-ie"></div><div class="ts-tore g"></div>
        </div>
        <div class="ts-druck"></div>
        <div class="ts-lagebild">${feldSvg(T)}<dl class="ts-live"></dl></div>
        <div class="ts-hinweis" hidden></div>
        <ol class="ts-ticker" aria-label="Ticker"></ol>
        <div class="ts-steuer"></div>
        <div class="ts-bericht" hidden></div>
      </div>`;
    },
    // Anpfiff-Moment: Overlay schon da, während die Engine rechnet (am Handy ≈ 1–2 s)
    vorbereiten(fx) {
      if (!hatDom()) return;
      const sp = fx.type === 'playoff' ? playoffSpiel(fx) : null, eigenHeim = sp ? sp.heim === 'fcm' : !!fx.isHome;
      const eig = teamInfo('fcm'), geg = teamInfo(fx.opponentId), T = eigenHeim ? { h: eig, g: geg } : { h: geg, g: eig };
      const r = this.dom();
      farbenSetzen(r, T);
      const kopf = fx.type === 'playoff' ? `Playoffs · ${fx.roundName || ''}` : kopfText(fx, eigenHeim, fx.matchday);
      r.innerHTML = this.geruest(T, kopf, einstellungText());
      r.querySelector('.ts-ticker').innerHTML = '<li class="ts-rechnet"><i class="ti ti-ball-football" aria-hidden="true"></i><b>Anpfiff …</b><small>Die Engine rechnet das Spiel.</small></li>';
      r.querySelector('.ts-druck').innerHTML = druckSvg([], [], -1);
      this.p = null; this.fertig = false;
      this.zeigen();
    },
    laden(p, opt) {
      opt = opt || {};
      if (!hatDom()) { this.p = p; return; }
      this.stop();
      const sp = p.spiel, v = p.variante === 'A' ? 'A' : 'B';
      this.p = p; this.wieder = !!opt.wieder; this.fertig = false; this.i = 0; this.bloecke = {}; this.schussN = 0; this.torListe = { h: [], g: [] };
      this.fp = K.fahrplan(sp, v); this.st = K.schritte(this.fp, v);
      this.druckW = K.druck(sp); this.kum = K.verlauf(sp); this.schuss = K.schuesse(sp);
      this.toreAlle = this.fp.plan.flatMap(x => x.zeilen).filter(z => z.art === 'tor' && z.mi != null && !z.phase);
      this.tempo = tempo();
      const r = this.dom();
      farbenSetzen(r, sp.teams);
      r.innerHTML = this.geruest(sp.teams, p.kopf || '', v === 'A' ? 'Jede Minute' : 'Höhepunkte');
      const q = s => r.querySelector(s);
      this.el = { sh: q('.ts-sh'), sg: q('.ts-sg'), stand: q('.ts-stand'), uhr: q('.ts-uhr'), toreH: q('.ts-tore.h'), toreG: q('.ts-tore.g'), ie: q('.ts-ie'),
        druck: q('.ts-druck'), schuesse: q('.ts-schuesse'), ball: q('.ts-ballp'), sp: q('.ts-sp'), root2d: q('.ts-lagebild'), live: q('.ts-live'), ticker: q('.ts-ticker'),
        steuer: q('.ts-steuer'), hinweis: q('.ts-hinweis'), bericht: q('.ts-bericht') };
      this.liveZeigen(-1);
      this.druckZeigen(-1);
      this.chanceZeigen();
      const pos = Math.max(0, Math.min(opt.pos || 0, this.st.length));
      while (this.i < pos) this.zeigeSicher(this.st[this.i++], true);
      if (pos) { const s = this.st[pos - 1]; this.druckZeigen(s.mi); this.liveZeigen(s.mi); }
      this.zeigen();
      if (this.i >= this.st.length) { this.ende(); return; }
      if (opt.wieder) {
        this.hinweis('<i class="ti ti-lock" aria-hidden="true"></i><span><b>Das Spiel ist schon gebucht.</b> Der Ticker geht hier weiter – Play oder „Sofort“.</span>');
        this.steuerZeigen();
        return;
      }
      this.weiter();
    },
    hinweis(html) { if (!this.el) return; this.el.hinweis.innerHTML = html || ''; this.el.hinweis.hidden = !html; },
    // Siegchance vor dem Spiel (Formel der Brücke) – kein Spoiler: sie steht vor dem Anpfiff fest
    chanceZeigen() {
      const sp = this.p.spiel;
      if (!sp.lambda || !this.el) return;
      const c = K.chancen(sp.lambda[0], sp.lambda[1]), T = sp.teams, pr = x => Math.round(x * 100);
      // Playoffs (Spieltest 2026-10-14): kein Remis – Weiterkommen mit Verlängerung (ein Drittel der Torerwartung) und
      // Elfmeterschießen (50 : 50), wie die Spielvorschau (DFLSimulieren.vorschauDaten → weiterkommen)
      if (this.po || this.p.typ === 'playoff') {
        // Pro Bowl (D158): bei Gleichstand gleich Elfmeterschießen (50 : 50), keine Verlängerung
        const pb = this.p.typ === 'probowl', titel = pb ? 'Siegchance' : 'Weiterkommen';
        const v = pb ? [0, 1, 0] : K.chancen(sp.lambda[0] / 3, sp.lambda[1] / 3), w = c[0] + c[1] * (v[0] + v[1] * 0.5), wh = pr(w), wg = 100 - wh;
        this.el.ticker.insertAdjacentHTML('beforeend', `<li class="ts-chance"><span class="ts-chance-titel"><i class="ti ti-target-arrow" aria-hidden="true"></i>${titel} vor dem Spiel</span>
        <span class="ts-dreier" role="img" aria-label="${titel} ${esc(T.h.kurz)} ${wh} Prozent, ${esc(T.g.kurz)} ${wg} Prozent">
          <span style="width:${(w * 100).toFixed(1)}%" class="h">${wh} %</span><span style="width:${(100 - w * 100).toFixed(1)}%" class="g">${wg} %</span></span>
        <span class="ts-dreier-l"><span>${esc(T.h.kurz)}</span><span>${esc(T.g.kurz)}</span></span></li>`);
        return;
      }
      this.el.ticker.insertAdjacentHTML('beforeend', `<li class="ts-chance"><span class="ts-chance-titel"><i class="ti ti-target-arrow" aria-hidden="true"></i>Siegchance vor dem Spiel</span>
        <span class="ts-dreier" role="img" aria-label="Sieg ${esc(T.h.kurz)} ${pr(c[0])} Prozent, Remis ${pr(c[1])} Prozent, Sieg ${esc(T.g.kurz)} ${pr(c[2])} Prozent">
          <span style="width:${(c[0] * 100).toFixed(1)}%" class="h">${pr(c[0])} %</span><span style="width:${(c[1] * 100).toFixed(1)}%" class="x">${pr(c[1])} %</span><span style="width:${(c[2] * 100).toFixed(1)}%" class="g">${pr(c[2])} %</span></span>
        <span class="ts-dreier-l"><span>${esc(T.h.kurz)}</span><span>Remis</span><span>${esc(T.g.kurz)}</span></span></li>`);
    },
    druckZeigen(mi) { if (this.el) this.el.druck.innerHTML = druckSvg(this.druckW, this.toreAlle, mi); },
    liveZeigen(mi) {
      if (!this.el) return;
      const k = mi >= 0 && this.kum[Math.min(mi, this.kum.length - 1)] || { sch: [0, 0], ecken: [0, 0], xg: [0, 0], karten: [[], []] };
      const kt = l => l.length ? `<span class="ts-karten">${l.map(c => `<i class="ts-kt ${c}"></i>`).join('')}</span>` : '0';
      this.el.live.innerHTML = `<div><dd class="h">${k.sch[0]}</dd><dt>Schüsse</dt><dd class="g">${k.sch[1]}</dd></div>
        <div><dd class="h">${zahl(k.xg[0], 1)}</dd><dt>xG</dt><dd class="g">${zahl(k.xg[1], 1)}</dd></div>
        <div><dd class="h">${k.ecken[0]}</dd><dt>Ecken</dt><dd class="g">${k.ecken[1]}</dd></div>
        <div><dd class="h">${kt(k.karten[0])}</dd><dt>Karten</dt><dd class="g">${kt(k.karten[1])}</dd></div>`;
    },
    steuerZeigen() {
      if (!this.el) return;
      const s = this.el.steuer;
      if (this.fertig) {
        s.innerHTML = `<button type="button" class="ts-knopf gruen" data-ts="bericht"><i class="ti ti-clipboard-list" aria-hidden="true"></i>Spielbericht</button>`;
        return;
      }
      s.innerHTML = `<button type="button" class="ts-rund" data-ts="pp" aria-label="${this.laeuft ? 'Pause' : 'Weiter'}"><i class="ti ${this.laeuft ? 'ti-player-pause' : 'ti-player-play'}" aria-hidden="true"></i></button>
        <div class="ts-tempo" role="group" aria-label="Tempo">
          <button type="button" data-ts="t1" aria-pressed="${this.tempo === 1}">1×</button>
          <button type="button" data-ts="t4" aria-pressed="${this.tempo === 4}">4×</button>
          <button type="button" class="ts-sofort" data-ts="sofort" aria-label="Sofort: ans Ende springen"><i class="ti ti-player-track-next" aria-hidden="true"></i>Sofort</button>
        </div>`;
    },
    klick(ev) {
      const b = ev.target.closest('[data-ts]'); if (!b) return;
      const t = b.getAttribute('data-ts');
      if (t === 'pp') { if (this.laeuft) this.pause(); else this.weiter(); }
      else if (t === 't1' || t === 't4') {
        this.tempo = t === 't4' ? 4 : 1; ls.schreib(KEY_TEMPO, String(this.tempo));
        if (this.laeuft) { this.stop(); this.laeuft = true; this.naechster(); }
        this.steuerZeigen();
      }
      else if (t === 'sofort') this.sofort();
      else if (t === 'bericht') this.zumBericht();
      else if (t === 'zumticker') { this.el.bericht.hidden = true; }
      else if (t === 'weiter') this.weiterNachBericht();
      else if (t === 'pbzu') this.proBowlZu();
    },
    weiter() {
      if (this.fertig || this.laeuft || !this.el) return;
      this.hinweis(''); this.laeuft = true;
      this.el.uhr.classList.add('live'); this.el.uhr.classList.remove('pause');
      this.steuerZeigen(); this.naechster();
    },
    pause() {
      this.stop(); this.laeuft = false;
      if (this.el) { this.el.uhr.classList.remove('live'); this.el.uhr.classList.add('pause'); }
      this.steuerZeigen();
    },
    stop() { clearTimeout(this.timer); this.timer = null; this.laeuft = false; },
    naechster() {
      if (this.live) { try { if (this.live.vorrat(this) === 'warten') return; } catch (e) { console.warn('[DFL-Textspiel] Live', e); } }
      if (this.i >= this.st.length) { this.ende(); return; }
      const s = this.st[this.i++];
      this.zeigeSicher(s, false);
      this.posMerken();
      if (this.live) { try { if (this.live.vorrat(this) === 'warten') return; } catch (e) { console.warn('[DFL-Textspiel] Live', e); } }
      if (this.i >= this.st.length) { this.ende(); return; }
      // Playoffs: ab der 90. Minute (Nachspielzeit, Verlängerung, Elfmeterschießen) langsamer
      const lang = this.po && s.mi != null && s.mi >= 90 ? 1.6 : 1;
      this.timer = setTimeout(() => this.naechster(), s.ms * lang / this.tempo);
    },
    posMerken() { if (this.p && !this.fertig) ls.schreib(KEY_POS, String(this.i)); },
    // „Sofort“: alle übrigen Zeilen ohne Pause, dann der Spielbericht
    sofort() {
      if (!this.el) { this.zumBericht(); return; }
      this.stop();
      if (this.live) { try { this.live.bisEnde(this); } catch (e) { console.warn('[DFL-Textspiel] Live', e); } }
      while (this.i < this.st.length) this.zeigeSicher(this.st[this.i++], true);
      this.el.ticker.scrollTop = 0;
      try { this.ende(); } catch (e) { console.warn('[DFL-Textspiel] Abpfiff', e); this.fertig = true; }
      this.zumBericht();
    },
    zeigeSicher(s, still) { try { this.zeige(s, still); } catch (e) { console.warn('[DFL-Textspiel] Zeile', e); } },
    ende() {
      if (this.live) { const l = this.live; this.live = null; this.stop(); try { l.buchen(this); } catch (e) { console.warn('[DFL-Textspiel] Live buchen', e); } return; }
      this.stop(); this.fertig = true;
      if (!this.el) return;
      const s = this.st[this.st.length - 1];
      this.el.uhr.classList.remove('live', 'pause');
      this.el.uhr.textContent = s && s.phase === 'elfer' ? 'i. E.' : s && s.phase === 'verl' ? 'n. V.' : 'Abpfiff';
      this.druckZeigen(this.druckW.length - 1); this.liveZeigen(this.kum.length - 1);
      this.hinweis('');
      this.steuerZeigen();
    },
    zeige(s, still) {
      const z = s.z;
      this.el.uhr.textContent = z && z.halbzeit ? 'Halbzeit' : s.min;
      if (!still) { this.druckZeigen(s.mi); this.liveZeigen(s.mi); }
      // Schüsse bis zu dieser Minute aufs Feld
      let neu = '';
      while (this.schussN < this.schuss.length && this.schuss[this.schussN].mi <= s.mi) {
        const q = this.schuss[this.schussN++], r = (1.1 + Math.sqrt(q.xg) * 3.2).toFixed(2);
        neu += `<circle class="ts-s ${q.s}${q.typ === 'goal' ? ' drin' : q.typ === 'save' ? '' : ' daneben'}" cx="${q.x.toFixed(1)}" cy="${q.y.toFixed(1)}" r="${r}"/>`;
      }
      if (neu) this.el.schuesse.insertAdjacentHTML('beforeend', neu);
      if (!z) return;
      if (z.lage) this.el.ball.style.transform = `translate(${z.lage.x.toFixed(1)}px,${z.lage.y.toFixed(1)}px)`;
      if (ZWEI_D) { try { zweiD(this.el, z, still); } catch (e) { /* ohne 2D */ } }
      this.zeileRein(z, still, s);
      if (z.art === 'tor') {
        this.el.sh.textContent = z.stand.h; this.el.sg.textContent = z.stand.g;
        const l = this.torListe[z.s], name = z.torschuetze || '–', x = l.find(q => q.n === name);
        if (x) x.m.push(z.min); else l.push({ n: name, m: [z.min] });
        const liste = l2 => l2.map(q => `<span>${esc(q.n)} ${q.m.join(', ')}</span>`).join(' · ');
        this.el.toreH.innerHTML = liste(this.torListe.h); this.el.toreG.innerHTML = liste(this.torListe.g);
        if (!still) { this.el.stand.classList.remove('tor'); void this.el.stand.offsetWidth; this.el.stand.classList.add('tor'); }
      }
      if (z.iE) this.el.ie.innerHTML = `<span>i. E. <b>${z.iE.h}:${z.iE.g}</b></span>`;
    },
    zeileRein(z, still, s) {
      const tk = this.el.ticker, nahOben = tk.scrollTop < 40;
      if (z.halbzeit || z.abpfiff || z.ende90 || z.endeVerl) {
        const li = document.createElement('li');
        li.className = 'ts-trenner' + (still ? '' : ' neu');
        const titel = z.halbzeit ? 'Halbzeit' : z.ende90 ? 'Verlängerung' : z.endeVerl ? 'Elfmeterschießen' : 'Abpfiff';
        const text = z.html.replace(/^Abpfiff! |^Halbzeit\. /, '');
        const verl = z.abpfiff && this.p.verletzt && this.p.verletzt.length
          ? `<small class="ts-verletzt"><i class="ti ti-ambulance" aria-hidden="true"></i>Nach dem Spiel verletzt: ${this.p.verletzt.map(v => `${esc(v.name)} (${esc(v.typ)}, ${v.wochen} ${v.wochen === 1 ? 'Woche' : 'Wochen'})`).join(', ')}</small>` : '';
        li.innerHTML = `<i class="ti ${z.abpfiff ? 'ti-flag' : z.endeVerl ? 'ti-target-arrow' : 'ti-clock'}" aria-hidden="true"></i><div><b>${titel}</b><small>${text}</small>${verl}</div>` +
          `<span class="ts-tr-stand">${z.stand.h}:${z.stand.g}${z.iE ? `<small>i. E. ${z.iE.h}:${z.iE.g}</small>` : ''}</span>`;
        tk.prepend(li);
      } else {
        let blk = this.bloecke[s.key];
        if (!blk || blk !== tk.firstElementChild) {
          blk = document.createElement('li'); blk.className = 'ts-blk';
          blk.innerHTML = `<span class="ts-min">${esc(s.min)}</span><div class="ts-zz"></div>`;
          tk.prepend(blk); this.bloecke[s.key] = blk;
        }
        const d = document.createElement('div');
        d.className = `ts-z ${z.art}${z.s ? ' s-' + z.s : ''}${still ? '' : ' neu'}`;
        d.innerHTML = zeileHtml(z);
        blk.querySelector('.ts-zz').append(d);
      }
      if (nahOben) tk.scrollTop = 0;
    },
    // Nach dem Abpfiff: Spielbericht des Spiels (wie bisher); nach einem Neustart der kleine Bericht aus dem Paket
    zumBericht() {
      if (this.p && this.p.typ === 'probowl') { try { this.eigenerBericht(); return; } catch (e) { console.warn('[DFL-Textspiel] Pro Bowl', e); this.proBowlZu(); return; } }
      if (this.wieder) { try { this.eigenerBericht(); return; } catch (e) { console.warn('[DFL-Textspiel] Bericht', e); this.schliessen(); return; } }
      this.verstecken();
      paketLoeschen();
      const pm = hatDom() ? document.getElementById('pm-overlay') : null;
      if (pm) { pm.style.display = ''; return; }
      freigeben();
    },
    nachlesen() {
      if (!this.root) return;
      if (!this.fertig) this.sofortStill();
      this.zeigen(); this.steuerZeigen();
    },
    sofortStill() { this.stop(); while (this.i < this.st.length) this.zeigeSicher(this.st[this.i++], true); this.ende(); },
    eigenerBericht() {
      const sp = this.p.spiel, T = sp.teams, st = sp.stats, end = this.fp.stand, iE = this.fp.iE;
      const fuer = sp.eigen === 'h' ? end.h - end.g : end.g - end.h, ieFuer = iE ? (sp.eigen === 'h' ? iE.h - iE.g : iE.g - iE.h) : 0;
      const d = fuer || ieFuer, pb = this.p.typ === 'probowl';
      // Pro Bowl (D158): kein eigener Verein – das Urteil nennt den Sieger, darunter der MVP
      const urteil = pb ? ['sieg', `${T[d >= 0 ? 'h' : 'g'].name} gewinnt`] : d > 0 ? ['sieg', 'Sieg'] : d < 0 ? ['niederlage', 'Niederlage'] : ['remis', 'Remis'];
      const marke = (X, kl) => X.marke || wappen(X.id, kl);
      const alle = K.erzaehle(sp), tore = alle.zeilen.concat(alle.nachZeilen).filter(z => z.art === 'tor');
      const reihe = (lab, h, g, fmt) => {
        const s = (h + g) || 1, ph = Math.round(h / s * 100);
        return `<div class="ts-bs"><span class="lab">${lab}</span><span class="w h">${fmt(h)}</span><span class="bar" aria-hidden="true"><i class="h" style="width:${ph}%"></i><i class="g" style="width:${100 - ph}%"></i></span><span class="w g">${fmt(g)}</span></div>`;
      };
      const ganz = x => String(x), proz = x => x + ' %', eins = x => zahl(x, 1);
      const saisonEnde = typeof fcmSeasonOver === 'function' && (() => { try { return fcmSeasonOver(); } catch (e) { return false; } })();
      this.el.bericht.innerHTML = `<div class="ts-b-blatt" role="dialog" aria-label="Spielbericht">
        <div class="ts-b-inhalt">
          <div class="ts-b-erg"><div class="t">${marke(T.h, 'ts-wappen-b')}<span>${esc(T.h.kurz)}</span></div>
            <div class="s"><b>${end.h}:${end.g}</b>${iE ? `<small>i. E. ${iE.h}:${iE.g}</small>` : ''}<span class="ts-urteil ${urteil[0]}">${esc(urteil[1])}</span></div>
            <div class="t">${marke(T.g, 'ts-wappen-b')}<span>${esc(T.g.kurz)}</span></div></div>
          ${tore.length ? `<ul class="ts-b-tore">${tore.map(z => `<li class="${z.s}"><span class="m">${esc(z.min)}</span><span class="wer"><b>${esc(z.torschuetze || '–')}</b>${z.vorlage ? `<small>Vorlage ${esc(z.vorlage)}</small>` : ''}</span></li>`).join('')}</ul>` : ''}
          <div class="ts-b-stats">${reihe('Ballbesitz', st.h.besitz, st.g.besitz, proz)}${reihe('Torschüsse', st.h.schuesse, st.g.schuesse, ganz)}${reihe('Aufs Tor', st.h.aufsTor, st.g.aufsTor, ganz)}${reihe('xG', st.h.xg, st.g.xg, eins)}${reihe('Ecken', st.h.ecken, st.g.ecken, ganz)}${reihe('Fouls', st.h.fouls, st.g.fouls, ganz)}</div>
          <div class="ts-b-druck"><b>Druck je Minute</b>${druckSvg(this.druckW, this.toreAlle, this.druckW.length - 1, true)}</div>
          ${pb ? (this.p.mvp ? `<p class="ts-b-hinweis"><i class="ti ti-star-filled" aria-hidden="true"></i>MVP: ${esc(this.p.mvp)}</p>` : '')
            : '<p class="ts-b-hinweis"><i class="ti ti-lock" aria-hidden="true"></i>Gebucht beim Anpfiff – Noten, Tabelle und Kasse stehen schon im Spielstand.</p>'}
        </div>
        <div class="ts-b-fuss"><button type="button" class="ts-knopf hell" data-ts="zumticker"><i class="ti ti-message-dots" aria-hidden="true"></i>Ticker</button>
          ${pb ? '<button type="button" class="ts-knopf gruen" data-ts="pbzu">Schließen<i class="ti ti-chevron-right" aria-hidden="true"></i></button>'
            : `<button type="button" class="ts-knopf gruen" data-ts="weiter">${saisonEnde ? 'Saison abschließen' : 'Nächste Woche'}<i class="ti ti-chevron-right" aria-hidden="true"></i></button>`}</div>
      </div>`;
      this.el.bericht.hidden = false;
    },
    // Pro Bowl (D158): nur schließen – die Woche läuft wie gewohnt über den Haupt-Button weiter
    proBowlZu() {
      const f = pbFertig; pbFertig = null;
      this.schliessen();
      if (f) { try { f(); } catch (e) { console.warn('[DFL-Textspiel] Pro Bowl', e); } }
    },
    weiterNachBericht() {
      this.schliessen();
      try { if (typeof nextWeek === 'function') nextWeek(); } catch (e) { console.warn('[DFL-Textspiel] Woche weiter', e); }
      try { if (typeof switchAppView === 'function') switchAppView('home', document.getElementById('nav-home')); } catch (e) { /* Ansicht optional */ }
    }
  };

  // ── Anpfiff ──────────────────────────────────────────────────────────────
  function naechsterFrame(fn) {
    let erledigt = false;
    const los = () => { if (erledigt) return; erledigt = true; fn(); };
    try { requestAnimationFrame(() => setTimeout(los, 0)); } catch (e) { /* ohne rAF */ }
    setTimeout(los, 150);
  }
  let vorlauf = false;
  {
    const _ko = window.handleKO;
    if (typeof _ko === 'function') {
      window.handleKO = function () {
        const fx = aktFixture(), g = spielG();
        if (!tickerFuer(fx) || g.running || g.ended || !hatDom()) return _ko.apply(this, arguments);
        if (vorlauf) return undefined;
        vorlauf = true;
        try { ui.vorbereiten(fx); } catch (e) { console.warn('[DFL-Textspiel] Anpfiff', e); }
        const self = this, args = arguments;
        naechsterFrame(() => {
          vorlauf = false;
          try { _ko.apply(self, args); } catch (e) { console.warn('[DFL-Textspiel] Anpfiff', e); }
          if (!ui.hatSpiel() && ui.root) ui.schliessen();         // nichts gerechnet (z. B. Elf unvollständig)
        });
        return undefined;
      };
      try { handleKO = window.handleKO; } catch (e) { /* global überschrieben reicht */ }
    }
  }
  // Außen um simulateCurrentFixture (nach engine_v3_adapter.js und dfl_engine_patch.js): erst rechnen und buchen, dann Ticker
  {
    const _sim = window.simulateCurrentFixture;
    if (typeof _sim === 'function') {
      window.simulateCurrentFixture = function () {
        if (!aktFixture() && typeof ensureFixtureLoaded === 'function') { try { ensureFixtureLoaded(); } catch (e) { /* Adapter meldet es */ } }
        const fx0 = aktFixture(), fx = fx0 ? Object.assign({}, fx0) : null, g0 = spielG();
        const mit = tickerFuer(fx) && !g0.running && !g0.ended;
        const vorher = window.LAST_MATCH_2D, verletztVorher = mit ? verletzteIds() : null, hieltSchon = halten;
        scharf = mit;
        let r, fehler = null;
        try { r = _sim.apply(this, arguments); } catch (e) { fehler = e; }
        scharf = false;
        const g = spielG(), neu = !!(window.LAST_MATCH_2D && window.LAST_MATCH_2D !== vorher && g.ended);
        if (neu) { try { formationAufdecken(); } catch (e) { /* nur Anzeige */ } }
        let gestartet = false;
        if (mit && neu && halten) {
          try {
            const lb = window.__tsLiveBuchen;
            const p = paketBauen(fx, verletztVorher, lb ? { rec: window.LAST_MATCH_2D, seed: lb.seed, pruefen: true } : null);
            if (p) {
              ui.laden(p, lb ? { pos: lb.pos } : {});
              gestartet = true;
              // erst nach dem Speichern des Spielstands (läuft in Mikroaufgaben) – sonst belegt das Paket Platz, den das Speichern braucht
              setTimeout(() => { if (ui.p === p && !ui.fertig) paketSpeichern(p); }, 0);
            }
          } catch (e) { console.warn('[DFL-Textspiel] Ticker', e); }
        }
        if (!gestartet) {
          if (ui.root && !ui.hatSpiel()) ui.schliessen();
          if (halten && !hieltSchon) freigeben();        // nur, was dieser Aufruf zurückgehalten hat (ein laufender Ticker behält seins)
        }
        try { wahlZeigen(); } catch (e) { /* nur Anzeige */ }
        if (fehler) throw fehler;
        return r;
      };
      try { simulateCurrentFixture = window.simulateCurrentFixture; } catch (e) { /* global überschrieben reicht */ }
    }
  }
  // Gegner-Formation nach dem Abpfiff (die alte Minuten-Engine deckte sie in Minute 8–15 auf; Engine v3 wertet sofort)
  function formationAufdecken() {
    const T = window.MATCH_TAC, rec = window.LAST_MATCH_2D;
    if (!T) return;
    const f = rec && rec.teams && rec.teams[1] && rec.teams[1].formation;
    if (f) T.oppFormation = f;
    T.oppRevealed = true;
    if (typeof window.updateOppFormationBadge === 'function') window.updateOppFormationBadge();
  }
  // Weiter nach dem Spielbericht: Ticker schließen (nichts mehr zurückhalten)
  {
    const _orig = window.postMatchContinue;
    if (typeof _orig === 'function') {
      window.postMatchContinue = function () {
        try { ui.schliessen(); } catch (e) { /* Ticker optional */ }
        freigeben(true);
        return _orig.apply(this, arguments);
      };
      try { postMatchContinue = window.postMatchContinue; } catch (e) { /* global überschrieben reicht */ }
    }
  }
  // Spielbericht: Knopf „Ticker“ zum Nachlesen
  if (typeof MutationObserver === 'function' && hatDom()) {
    new MutationObserver(() => {
      const pm = document.getElementById('pm-overlay');
      if (!pm || pm.dataset.tsKnopf || !ui.hatSpiel() || ui.wieder) return;
      const fuss = pm.querySelector('#pm-footer'), w = pm.querySelector('#pm-continue-btn');
      if (!fuss || !w) return;
      pm.dataset.tsKnopf = '1';
      fuss.classList.add('ts-mit-ticker');
      w.insertAdjacentHTML('beforebegin', '<button type="button" id="pm-ticker-btn"><i class="ti ti-message-dots" aria-hidden="true"></i><span>Ticker</span></button>');
      fuss.querySelector('#pm-ticker-btn').addEventListener('click', () => { pm.style.display = 'none'; ui.nachlesen(); });
    }).observe(document.body, { childList: true });
  }

  // ── Einstellung am Anpfiff (Spieltag) ────────────────────────────────────
  function wahlZeigen() {
    if (!hatDom()) return;
    const sb = document.getElementById('sim-btn');
    if (!sb || !sb.parentNode) return;
    let el = document.getElementById('ts-wahl-box');
    if (!el) {
      el = document.createElement('div'); el.id = 'ts-wahl-box'; el.className = 'ts-wahl-box';
      sb.parentNode.appendChild(el);
      el.addEventListener('click', ev => { const b = ev.target.closest('[data-ts-wahl]'); if (b) setzeEinstellung(b.getAttribute('data-ts-wahl')); });
    }
    const fx = aktFixture(), g = spielG(), w = einstellung();
    el.hidden = !dfl() || !fx || !!(g.ended || g.running);
    el.innerHTML = `<div class="ts-wahl-kopf"><i class="ti ti-message-dots" aria-hidden="true"></i><b>Spiel als Text</b></div>
      <div class="ts-wahl" role="group" aria-label="Spiel als Text">${WAHLEN.map(x => `<button type="button" data-ts-wahl="${x.w}" aria-pressed="${x.w === w}">${x.titel}</button>`).join('')}</div>`;
  }
  ['resetMatchState', 'showNoMatchThisWeek'].forEach(fn => {
    const _orig = window[fn];
    if (typeof _orig !== 'function') return;
    window[fn] = function () {
      const r = _orig.apply(this, arguments);
      try { wahlZeigen(); } catch (e) { /* nur Anzeige */ }
      // „Spielanalyse“ gehört zum letzten Spiel – vor dem nächsten Anpfiff öffnete sie das alte (engine_v3_adapter.js holt sie nach dem Abpfiff zurück)
      try { const ma = document.getElementById('ma-open'); if (ma && ma.parentNode) ma.parentNode.removeChild(ma); } catch (e) { /* nur Anzeige */ }
      return r;
    };
    try { if (fn === 'resetMatchState') resetMatchState = window[fn]; else showNoMatchThisWeek = window[fn]; } catch (e) { /* global überschrieben reicht */ }
  });
  {
    const _orig = window.switchAppView;
    if (typeof _orig === 'function') window.switchAppView = function (view) {
      const r = _orig.apply(this, arguments);
      if (view === 'match') { try { wahlZeigen(); } catch (e) { /* nur Anzeige */ } }
      return r;
    };
  }

  // ── Einstellung im Mehr-Blatt (Handy) ────────────────────────────────────
  function einstellungBlatt() {
    const box = hatDom() ? document.querySelector('#app-blatt .app-blatt-box') : null;
    if (!box) return;
    const malen = () => {
      const w = einstellung();
      box.innerHTML = `<div class="app-griff"></div><button class="app-blatt-zu" aria-label="Schließen"><i class="ti ti-x" aria-hidden="true"></i></button>
        <div class="app-sheet-titel">Spiel als Text</div>
        <div class="stil-wahl">${WAHLEN.map(x => `<button class="stil-kachel" type="button" data-ts-wahl="${x.w}" aria-pressed="${x.w === w}">
          <i class="ti ${x.icon}" aria-hidden="true"></i><b>${x.titel}</b><small>${x.sub}</small></button>`).join('')}</div>
        <p class="stil-hinweis">Gilt für dieses Gerät.</p>`;
    };
    box.onclick = ev => { const b = ev.target.closest('[data-ts-wahl]'); if (b) { setzeEinstellung(b.getAttribute('data-ts-wahl')); malen(); } };
    malen();
    document.getElementById('app-blatt').classList.add('auf'); document.body.classList.add('app-gesperrt');
    try { if (window.DFLAppShell) DFLAppShell.cta(); } catch (e) { /* Haupt-Button optional */ }
  }

  // ── Pro Bowl im Ticker (D158) ────────────────────────────────────────────
  // Das Spiel ist schon gerechnet und gespeichert (dfl_ehrungen_patch.js); hier nur Abspielen. d = { rec (Aufzeichnung wie
  // LAST_MATCH_2D: frames, events, stats, teams [Süd-West, Nord-Ost]), teams { h, g } (Anzeige, marke = HTML statt Wappen),
  // tore [h, g], lambda, nach (Elfmeterschießen, direkt), kopf, ort, mvp (Text) }; fertig() nach „Schließen“.
  // false = kein Ticker (Einstellung „Aus“, „Simulieren bis …“, ohne DOM, Stand weicht ab) → der Aufrufer zeigt das Ergebnis.
  let pbFertig = null;
  function proBowl(d, fertig) {
    if (!d || !d.rec || !hatDom() || !dfl() || unterdrueckt || einstellung() === 'aus' || ui.hatSpiel()) return false;
    const E = window.MatchEngineV3 || {};
    const spiel = K.aufbereiten(d.rec, { eigenHeim: true, teams: d.teams, seed: Math.floor(Math.random() * 1e9), ort: d.ort || null, runde: 'Pro Bowl',
      lambda: d.lambda || null, nach: d.nach || null, L: E.L || 105, B: E.B || 68 });
    const fp = K.fahrplan(spiel, 'B');
    if (Array.isArray(d.tore) && (fp.stand.h !== d.tore[0] || fp.stand.g !== d.tore[1])) {
      console.warn('[DFL-Textspiel] Pro Bowl: Ticker-Stand weicht vom Ergebnis ab – kein Ticker', fp.stand, d.tore);
      return false;
    }
    paketLoeschen();
    pbFertig = typeof fertig === 'function' ? fertig : null;
    ui.laden({ v: 1, typ: 'probowl', kopf: d.kopf || 'Pro Bowl', variante: variante(), spiel, verletzt: [], mvp: d.mvp || null, erzeugt: Date.now() }, {});
    return true;
  }

  // ── Neustart mitten im Ticker: dort weiter, wo er stand ──────────────────
  function wiederaufnehmen() {
    if (ui.hatSpiel() || !hatDom()) return false;
    const p = paketLesen();
    if (!p) return false;
    if (!passt(p)) { paketLoeschen(); return false; }
    const pos = Math.max(0, parseInt(ls.lies(KEY_POS) || '0', 10) || 0);
    ui.laden(p, { pos, wieder: true });
    return true;
  }
  if (hatDom()) {
    const spaeter = () => setTimeout(() => { try { wiederaufnehmen(); } catch (e) { console.warn('[DFL-Textspiel] Fortsetzen', e); } }, 600);
    if (document.readyState === 'complete') spaeter(); else window.addEventListener('load', spaeter);
    try { wahlZeigen(); } catch (e) { /* nur Anzeige */ }
  }

  window.DFLTextspiel = {
    einstellung, setzeEinstellung, einstellungText, einstellungBlatt, wiederaufnehmen, ohne, tempo, setzeTempo, WAHLEN, proBowl,
    laeuft: () => ui.hatSpiel() && !ui.fertig, offen: () => ui.offen(), fertig: () => ui.fertig,
    sofort: () => ui.sofort(), paket: () => ui.p, schritte: () => ui.st, zurueckgehalten: () => ({ halten, berichtWartet, hinweise: wartendeHinweise.length }),
    paketLesen, passt, ui,
    // PC-Live (kickstil_pc_spieltag.js): Ticker für ein noch nicht gebuchtes Spiel, Prüfung wie beim Anpfiff
    tickerFuer: fx => tickerFuer(fx), paketLive: (fx, rec, seed) => paketBauen(fx, null, { rec, seed }), variante,
    vorbereiten: fx => ui.vorbereiten(fx)
  };
  console.log('[DFL-Textspiel v1] aktiv — Spiel als Text (D77): Engine rechnet und bucht beim Anpfiff, Ticker spielt nur ab (Jede Minute · Höhepunkte · Aus), Neustart setzt fort');
})();
