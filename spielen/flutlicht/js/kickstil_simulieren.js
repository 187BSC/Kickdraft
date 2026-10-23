/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · SIMULIEREN BIS …  ·  v1   (Kern aus Kickdraft dfl_simulieren_patch.js, für unsere Fußballwelt)
   ─────────────────────────────────────────────────────────────────────────
   · Knopf „bis …“ rechts am Haupt-Button (Handy, #app-cta) bzw. neben „Woche weiter“ im Kalender (PC) öffnet ein Blatt
     mit Zielen: Vorbereitung → Saisonstart / Deadline-Day · Saison → 4 Wochen, Wintertransferfenster bzw. Deadline-Day,
     Ende der Hinrunde, Saisonende
   · Woche für Woche wie von Hand: eigene Spiele mit der Engine wie beim Anpfiff (ohne Ticker: DFLTextspiel.ohne, ohne
     Spielbericht), danach postMatchContinue; Wochen ohne eigenes Spiel über nextWeek. Nichts wird doppelt gebucht.
   · Hält immer: „Saison abschließen“, Fenster, die das Spiel öffnet und das Blatt nicht kennt
   · Schalter (je Gerät, localStorage 'ks-sim'): Pokal- und Europapokalspiele selbst spielen (an), Transferangebot für
     deine Spieler (an; Karte mit Gesicht und Summe, „Später“ fragt am Deadline-Day noch einmal), Ereignis mit
     Entscheidung (an; aus = erste Antwort), Verletzung in der Startelf (aus)
   · Ticker je Woche: Gegner mit Wappen, Ergebnis, Torschützen, Tabellenplatz ▲▼, Verletzte, Rückkehrer, Meldungen
   · Zusammenfassung: Bilanz, bester Schütze, Platz-Verlauf, „Braucht dich“, Tabellenausschnitt mit Auf-/Abstiegszonen
   · Schneller: während des Laufs keine unsichtbaren Ansichten zeichnen, keine Hinweise, Speichern alle 4 Wochen und
     an jedem Halt
   Lädt nach kickstil_app_shell.js / kickstil_transfer_karten.js, vor init_bootstrap.js. CSS: css/dfl_simulieren.css.
   API: KSSimulieren.ziele() · .starte(key, opt) · .oeffnen() · .lauf() · .laeuft() · .einstellungen()
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ── Grundlagen ───────────────────────────────────────────────────────────
  const aktiv = () => typeof CLUB !== 'undefined' && CLUB && typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.tiers;
  const hatDom = () => typeof document !== 'undefined' && !!document && !!document.body;
  const jetzt = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ic = n => `<i class="ti ti-${n}" aria-hidden="true"></i>`;
  const ruhig = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const warte = ms => new Promise(res => setTimeout(res, ms));

  const LS = 'ks-sim';
  let EIN = null;
  function einstellungen() {
    if (EIN) return EIN;
    let e = {};
    try { e = JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch (x) { e = {}; }
    EIN = { gross: e.gross !== false, angebot: e.angebot !== false, ereignis: e.ereignis !== false, verletzung: e.verletzung === true, ziel: e.ziel || null };
    return EIN;
  }
  function einstellungSetzen(k, v) {
    einstellungen()[k] = v;
    try { localStorage.setItem(LS, JSON.stringify(EIN)); } catch (x) { /* ohne Speicher: bis zum Neuladen */ }
  }

  // Vereine: Name, Wappen (generiert, kickstil_verein.js)
  const gruppe = () => { try { return findFcmGroup(LEAGUE) || null; } catch (e) { return null; } };
  function vereinsName(id) {
    if (id === 'fcm') return CLUB.name;
    try { const g = gruppe(), t = g && g.group.teams.find(x => x.id === id); if (t) return t.name; } catch (e) { /* weiter */ }
    try { const d = window.KSVerein && KSVerein.daten(id); if (d) return d.name; } catch (e) { /* weiter */ }
    return String(id || 'Gegner');
  }
  const wappen = (id, kl) => `<span class="lg-crest ${kl || 'sim-wappen'}" style="${typeof crestStyle === 'function' ? esc(crestStyle(id)) : ''}" aria-hidden="true"></span>`;
  const spielerName = p => !p ? '' : (typeof displayName === 'function' ? displayName(p) : ((p.firstName ? p.firstName.charAt(0) + '. ' : '') + (p.name || '')));
  const kalender = w => (typeof calendarLabel === 'function' ? calendarLabel(w, LEAGUE.startYear || 2026) : 'KW' + w);
  const monatKurz = w => (kalender(w).split(' · ')[1] || '').slice(0, 3);
  const euro = v => (typeof formatEuro === 'function' ? formatEuro(v) : Math.round(v).toLocaleString('de-DE') + ' €');

  // Tabelle der eigenen Liga, Zonen je Spielklasse (runEndOfSeason: BL −2, 2. BL +2/−2, 3. Liga +2/−4, RL Meister)
  const ZONEN = { bundesliga: [0, 2], bundesliga2: [2, 2], liga3: [2, 4], regionalliga: [1, 0] };
  function tabelle() {
    const g = gruppe(); if (!g) return [];
    try { return computeTable(g.group.teams); } catch (e) { return []; }
  }
  const platzVon = id => { const t = tabelle(); const i = t.findIndex(x => x.id === id); return i >= 0 ? i + 1 : null; };
  const ligaName = () => { const g = gruppe(); return g ? (g.group.name || g.tierName) : ''; };
  const zonen = () => { const g = gruppe(); return (g && ZONEN[g.tierKey]) || [0, 0]; };

  // Eigenes Spiel diese Woche (wie der Haupt-Button der App-Shell): Europa · Testspiel · Liga · Pokal
  function spielFaellig() {
    try {
      if (window.DFLAppShell && DFLAppShell.spielDieseWoche) return DFLAppShell.spielDieseWoche();
    } catch (e) { /* unten */ }
    const test = typeof fcmFriendlyThisWeek === 'function' ? fcmFriendlyThisWeek(LEAGUE) : null;
    if (test) return { art: 'test', id: test.opponentId };
    const liga = !seasonFullyComplete(LEAGUE) && Array.isArray(LEAGUE.matchWeeks) && LEAGUE.matchWeeks[LEAGUE.matchday] === LEAGUE.week ? fcmNextFixture(LEAGUE) : null;
    if (liga) return { art: 'liga', id: liga.opponentId, heim: liga.isHome };
    if (typeof cupDueThisWeek === 'function' && cupDueThisWeek() && typeof fcmCupFixture === 'function') {
      const c = fcmCupFixture(CUP); if (c) return { art: 'pokal', id: c.opponentId, heim: c.isHome, runde: c.roundName };
    }
    return null;
  }

  // ══ Ziele ═══════════════════════════════════════════════════════════════
  function ziele() {
    if (!aktiv()) return [];
    const mw = LEAGUE.matchWeeks || [], w = LEAGUE.week, md = LEAGUE.matchday || 0;
    const voll = typeof seasonFullyComplete === 'function' && seasonFullyComplete(LEAGUE);
    const win = typeof transferWindowInfo === 'function' ? transferWindowInfo(w) : { open: false };
    const z = [];
    const deadline = win.open ? (win.type === 'Winter' ? 30 : 9) : null;
    if (md === 0 && mw.length && w < mw[0]) {
      z.push({ key: 'start', name: 'Saisonstart', icon: 'flag', text: `bis Spieltag 1 · KW ${mw[0]}`, bisWoche: mw[0] });
      if (deadline && w < deadline) z.push({ key: 'fenster', name: 'Deadline-Day', icon: 'clock', text: `bis KW ${deadline} · letzte Woche des Sommerfensters`, bisWoche: deadline });
    } else if (!voll) {
      z.push({ key: 'vier', name: '4 Wochen', icon: 'calendar', text: `bis KW ${w + 4}`, bisWoche: w + 4 });
      if (deadline && w < deadline) z.push({ key: 'fenster', name: 'Deadline-Day', icon: 'clock', text: `bis KW ${deadline} · letzte Woche des ${win.type}fensters`, bisWoche: deadline });
      else if (w < 27) z.push({ key: 'fenster', name: 'Wintertransferfenster', icon: 'snowflake', text: 'bis KW 27 · Fenster öffnet', bisWoche: 27 });
      const g = gruppe(), n = g && LEAGUE.fixtures && LEAGUE.fixtures[g.key] ? LEAGUE.fixtures[g.key].length : mw.length, halb = Math.floor(n / 2);
      if (halb && md < halb) z.push({ key: 'hinrunde', name: 'Ende der Hinrunde', icon: 'flag', text: `bis Spieltag ${halb}`, bisMd: halb });
      z.push({ key: 'saison', name: 'Saisonende', icon: 'trophy', text: 'bis zum letzten Spieltag · hält vor „Saison abschließen“', saison: true });
    } else {
      z.push({ key: 'saison', name: 'Saisonende', icon: 'trophy', text: 'restliche Pokal- und Europapokalspiele', saison: true });
    }
    // Wochen und eigene Spiele bis zum Ziel (Anzeige)
    z.forEach(x => {
      const bis = x.bisWoche != null ? x.bisWoche : x.bisMd != null ? (mw[x.bisMd - 1] || w) + 1 : (mw[mw.length - 1] || w) + 1;
      x.wochen = Math.max(1, bis - w);
      x.spiele = mw.filter((wk, i) => i >= md && wk >= w && wk < bis).length;
      x.tests = (LEAGUE.friendlies || []).filter(f => !f.played && f.week >= w && f.week < bis).length;
      x.anzahl = x.spiele ? `${x.spiele} Ligaspiel${x.spiele === 1 ? '' : 'e'}` : x.tests ? `${x.tests} Testspiel${x.tests === 1 ? '' : 'e'}`
        : `${x.wochen} Woche${x.wochen === 1 ? '' : 'n'}`;
    });
    return z;
  }
  function zielErreicht(z, L) {
    if (L && LEAGUE.season !== L.start.saison) return true;   // Sicherung: ein Lauf geht nie über den Saisonwechsel
    if (z.bisWoche != null) return LEAGUE.week >= z.bisWoche;
    if (z.bisMd != null) return (LEAGUE.matchday || 0) >= z.bisMd;
    return false;                                  // Saisonende: der Pflicht-Halt „Saison abschließen“ beendet den Lauf
  }
  // Halt immer bzw. nach Schalter (große Spiele)
  function pflichtHalt() {
    if (!aktiv()) return { art: 'aus' };
    const f = spielFaellig();
    if (f && (f.art === 'pokal' || f.art === 'euro') && einstellungen().gross) return { art: f.art, sp: f };
    // Deadline-Day (kickstil_deadline_day.js): hält immer, solange der Tag nicht gespielt ist (wie der Draft in Kickdraft)
    if (!f && window.KSDeadline && KSDeadline.offen()) return { art: 'deadline' };
    if (!f && typeof fcmSeasonOver === 'function' && fcmSeasonOver()) return { art: 'saisonende' };
    return null;
  }
  const PFLICHT = {
    saisonende: { titel: 'Saison abschließen', text: 'Auf- und Abstieg, Vorstandsurteil und die neue Saison kommen beim Abschluss.', knopf: 'Saison abschließen', icon: 'trophy' },
    pokal: { titel: 'Dein Pokalspiel', text: 'Die großen Spiele spielst du selbst.', knopf: 'Zum Pokalspiel', icon: 'trophy' },
    euro: { titel: 'Dein Europapokalspiel', text: 'Die großen Spiele spielst du selbst.', knopf: 'Zum Europapokal', icon: 'world' },
    deadline: { titel: 'Deadline-Day', text: 'Transferschluss um 18:00 Uhr – Anrufe, Last-Minute-Markt und Ticker warten auf dich.', knopf: 'Zum Deadline-Day', icon: 'clock-bolt' },
    aus: { titel: 'Angehalten', text: '', knopf: null, icon: 'player-pause' }
  };

  // Ein Lauf merkt sich, was er tut (Ticker, Halte, Zeiten); das Spiel selbst bleibt die Quelle
  let LAUF = null;
  let erlaubtSpeichern = false, dirty = false;
  const OFFEN = { home: false, liga: false, club: false };
  const simAktiv = () => !!(LAUF && LAUF.aktiv);
  const pausiert = () => !!(LAUF && LAUF.beiseite);
  function neuerLauf(z) {
    return {
      ziel: z, aktiv: false, beiseite: false, stopp: false, fertig: false, grund: null, halt: null, weiterMit: null,
      start: { woche: LEAGUE.week, md: LEAGUE.matchday || 0, saison: LEAGUE.season, platz: platzVon('fcm'), t: jetzt() },
      wochen: [], spaeter: {}, gefragt: {}, seitSpeichern: 0, ende: null, hinweise: [], zeit: { gesamt: 0 }
    };
  }

  // ── Meldungen der Woche → Tickerzeilen ───────────────────────────────────
  let MELDUNGEN = null;
  const ohneZeichen = t => String(t || '').replace(/^[^\p{L}\p{N}]+/u, '').trim();
  const ohnePunkt = t => String(t || '').replace(/<[^>]+>/g, '').trim().replace(/[.!]+$/, '');
  const REGELN = [
    [/^Wieder fit: (.+)/, 'zurueck', (n, m) => 'Wieder fit: ' + m[1]],
    [/^Sperre/, 'sperre', n => ohnePunkt(n.title)],
    [/^Angebot für (.+)/, 'anfrage', (n, m) => 'Angebot für ' + m[1]],
    [/^Verkauft: (.+)/, 'trade', (n, m) => 'Verkauft: ' + m[1]],
    [/^Transferfenster offen/, 'info', n => ohneZeichen(n.title)],
    [/^Transferfenster geschlossen/, 'info', () => 'Transferfenster geschlossen'],
    [/^Deadline Day/, 'info', () => 'Deadline-Day'],
    [/^Pokal: |^Pokal-Aus|^DFB-POKALSIEGER/, 'poRunde', n => ohneZeichen(n.title)],
    [/^Sommer-Vorbereitung|^Winter-Vorbereitung/, 'entscheidung', n => ohneZeichen(n.title)],
    [/^Sponsor(?!bonus)/, 'info', n => ohneZeichen(n.title)]          // Sponsorbonus kommt jede Woche – kein Tickerstoff
  ];
  function zeileAus(n) {
    const titel = ohneZeichen(n.title);
    for (const [re, art, f] of REGELN) {
      const m = re.exec(titel);
      if (m) { const text = f(n, m); return text ? { art, text } : null; }
    }
    return null;
  }
  {
    const _orig = window.addNews;
    if (typeof _orig === 'function') {
      window.addNews = function (kat, titel, text) {
        if (MELDUNGEN) { try { MELDUNGEN.push({ category: kat, title: titel, text }); } catch (e) { /* nur Ticker */ } }
        return _orig.apply(this, arguments);
      };
      try { addNews = window.addNews; } catch (e) { /* window reicht */ }
    }
  }

  // ── Eine Woche wie von Hand ──────────────────────────────────────────────
  const verletzt = p => (typeof isInjured === 'function' ? isInjured(p) : (p && p.injuryWeeks > 0));
  const angebote = () => (CLUB && Array.isArray(CLUB.transferBids) ? CLUB.transferBids : []);
  const kader = () => (typeof SQUAD !== 'undefined' && Array.isArray(SQUAD) ? SQUAD : []);
  function eigeneSchuetzen() {
    if (typeof G === 'undefined' || !G || !Array.isArray(G.scorers)) return '';
    const m = new Map();
    G.scorers.forEach(s => {
      const p = s.id != null && typeof getPlayer === 'function' ? getPlayer(s.id) : null;
      const n = p ? spielerName(p) : (s.name || '');
      if (n) m.set(n, (m.get(n) || 0) + 1);
    });
    return [...m].map(([n, k]) => (k > 1 ? n + ' ' + k : n)).join(', ');
  }
  function spielen(sp) {
    if (typeof G !== 'undefined' && G && G.ended && typeof resetMatchState === 'function') resetMatchState();   // altes Spiel nie stehen lassen
    let fx = null;
    const los = () => {
      // wie „Zum Spiel“: Spiel laden …
      if ((typeof CURRENT_FIXTURE === 'undefined' || !CURRENT_FIXTURE) && typeof ensureFixtureLoaded === 'function') ensureFixtureLoaded();
      fx = typeof CURRENT_FIXTURE !== 'undefined' && CURRENT_FIXTURE ? Object.assign({}, CURRENT_FIXTURE) : null;
      if (!fx) throw new Error('kein Spiel geladen');
      // … und „Anpfiff“: gebucht wie immer (Spielbericht und Ticker fallen weg)
      window.simulateCurrentFixture();
    };
    if (window.DFLTextspiel && typeof DFLTextspiel.ohne === 'function') DFLTextspiel.ohne(los); else los();
    if (typeof G === 'undefined' || !G || !G.ended) throw new Error('Spiel wurde nicht gewertet');
    const erg = { typ: fx.type === 'friendly' ? 'test' : fx.type, gegner: fx.opponentId || sp.id, name: sp.name || null, heim: !!fx.isHome,
      tore: [G.homeGoals, G.awayGoals], sp: fx.matchday || null, runde: fx.roundName || sp.runde || null, sch: eigeneSchuetzen() };
    // wie „Nächste Woche“ im Spielbericht – aber nie den Saisonabschluss: postMatchContinue ruft nach dem letzten Spiel
    // finishSeasonFlow direkt auf; „Saison abschließen“ ist ein Pflicht-Halt (Test 2026-10-15: Lauf rutschte in Saison 2)
    if (!(typeof fcmSeasonOver === 'function' && fcmSeasonOver())) window.postMatchContinue();
    else if (typeof resetMatchState === 'function') resetMatchState();
    return erg;
  }
  function naechsteWoche() {
    if (typeof fcmSeasonOver === 'function' && fcmSeasonOver()) return false;
    const w = LEAGUE.week, s = LEAGUE.season;
    window.nextWeek();
    return LEAGUE.week !== w || LEAGUE.season !== s;
  }
  function wocheSpielen(L) {
    const vor = { woche: LEAGUE.week, md: LEAGUE.matchday || 0, platz: platzVon('fcm'),
      elf: new Set(typeof getLineupIds === 'function' ? getLineupIds() : []),
      verletzt: new Set(kader().filter(verletzt).map(p => p.id)), angebote: new Set(angebote().map(b => b.id)) };
    MELDUNGEN = [];
    let spiel = null, weiter = true;
    try {
      const f = spielFaellig();
      if (f) spiel = spielen(f);
      else weiter = naechsteWoche();
    } finally { L.meldungen = MELDUNGEN; MELDUNGEN = null; }
    const e = {
      woche: vor.woche, nach: LEAGUE.week, md: (LEAGUE.matchday || 0) > vor.md ? LEAGUE.matchday : null,
      platzVor: vor.md > 0 ? vor.platz : null, platz: (LEAGUE.matchday || 0) > 0 ? platzVon('fcm') : null,     // vor Spieltag 1 kein Platz
      spiel, zeilen: [], pause: null
    };
    if (!spiel) e.pause = (vor.md === 0 && (LEAGUE.matchWeeks || [])[0] > vor.woche) ? 'vorbereitung' : [26, 27].indexOf(vor.woche) >= 0 ? 'winter' : 'frei';
    const seen = new Set();
    (L.meldungen || []).forEach(n => {
      const z = zeileAus(n);
      if (!z || seen.has(z.art + z.text)) return;
      seen.add(z.art + z.text);
      e.zeilen.push(z);
    });
    kader().filter(p => verletzt(p) && !vor.verletzt.has(p.id)).forEach(p => e.zeilen.push({ art: 'verletzt',
      text: `${spielerName(p)} verletzt${p.injuryType ? ': ' + p.injuryType : ''} (${p.injuryWeeks} Wo.)`, startelf: vor.elf.has(p.id), id: p.id }));
    e.neueAngebote = angebote().filter(b => !vor.angebote.has(b.id));
    if (!spiel && !weiter) e.steht = true;          // nextWeek hat nicht weitergeschaltet (Hinweis kam)
    return e;
  }

  // ── Halte nach der Woche ─────────────────────────────────────────────────
  // Fenster, die das Spiel öffnet: Entscheidungen (.exp-overlay mit Wahl) spiegelt das Blatt, alles andere erledigst du selbst
  // .exp-gameover: Entlassung (app_main.js onExpectationsGameOver) – der Lauf muss dort enden (Test 2026-10-15: er rechnete
  // hinter dem Entlassungsfenster weiter, die Entlassung kam zweimal)
  const FREMD = ['#pm-overlay', '#intro-overlay', '#onboarding-overlay', '.exp-gameover'];
  const sichtbar = x => !!(x && x.isConnected && !(x.classList && x.classList.contains('sim-gespiegelt')) && x.style.display !== 'none'
    && getComputedStyle(x).display !== 'none');
  function offenesFenster() {
    if (!hatDom()) return null;
    const ov = [...document.querySelectorAll('.exp-overlay')].find(sichtbar);
    if (ov) return ov;
    return FREMD.map(s => document.querySelector(s)).find(sichtbar) || null;
  }
  function entscheidungLesen(ov) {
    const text = el => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
    const optionen = [...ov.querySelectorAll('.exp-offer')].map((o, i) => {
      const btn = o.querySelector('.exp-offer-btn');
      if (!btn || btn.disabled) return null;
      const folgen = text(o.querySelector('.ev-outcome')).replace(/^(Mögliche Folgen|Ausgang ungewiss):\s*/, '');
      return { i, label: text(o.querySelector('.exp-offer-name')), info: [text(o.querySelector('.camp-cost')), folgen].filter(Boolean).join(' · '),
        ungewiss: /Ausgang ungewiss/.test(text(o.querySelector('.ev-outcome'))), btn };
    }).filter(Boolean);
    return optionen.length ? { titel: text(ov.querySelector('.exp-dialog-title')), text: text(ov.querySelector('.exp-dialog-sub')), optionen } : null;
  }
  function ereignisAusloesen() {
    const st = CLUB ? CLUB._events : null;
    if (!st || !st.pending || typeof window.__flushPendingEvent !== 'function' || !hatDom()) return;
    if (document.querySelector('.exp-overlay')) return;          // eins nach dem anderen
    try { window.__flushPendingEvent(); } catch (e) { console.warn('[Kickstil-Simulieren] Ereignis', e); }
  }
  async function fensterErledigen(L, e) {
    for (let n = 0; n < 4 && !L.stopp; n++) {
      ereignisAusloesen();
      const ov = offenesFenster();
      if (!ov) break;
      const ent = ov.classList && ov.classList.contains('exp-overlay') ? entscheidungLesen(ov) : null;
      if (ent && !einstellungen().ereignis) {
        const o = ent.optionen[0];
        o.btn.click();
        e.zeilen.push({ art: 'entscheidung', text: `${ent.titel}: ${o.label} (automatisch)` });
        continue;
      }
      if (ent) { ov.classList.add('sim-gespiegelt'); await halt(L, { art: 'entscheidung', ent, ov, e }); continue; }
      await halt(L, { art: 'fenster', ov, titel: fensterTitel(ov) });
    }
  }
  function fensterTitel(ov) {
    const h = ov.querySelector('h1,h2,h3,[class*=title],[class*=titel]');
    return String(h ? h.textContent : ov.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  }
  async function nachDerWoche(L, e) {
    await fensterErledigen(L, e);
    if (L.stopp) return;
    if (einstellungen().angebot) {
      for (const b of e.neueAngebote || []) {
        if (L.stopp) return;
        if (angebote().some(x => x.id === b.id)) await halt(L, { art: 'angebot', b, e });
      }
    }
    if (einstellungen().verletzung && !L.stopp) {
      const v = e.zeilen.find(z => z.art === 'verletzt' && z.startelf);
      if (v) await halt(L, { art: 'verletzt', zeile: v, e });
    }
  }
  // „Später“: am Deadline-Day noch einmal fragen
  function spaeterFaellig(L) {
    const win = typeof transferWindowInfo === 'function' ? transferWindowInfo(LEAGUE.week) : null;
    for (const id of Object.keys(L.spaeter)) {
      const b = angebote().find(x => x.id === id);
      if (!b) { delete L.spaeter[id]; continue; }
      if (win && win.deadline && !L.gefragt[id]) return b;
    }
    return null;
  }

  // ── Der Lauf ─────────────────────────────────────────────────────────────
  async function speichern(L) {
    if (!dirty) return;
    erlaubtSpeichern = true;
    try { await Promise.resolve(typeof window.saveGameState === 'function' ? window.saveGameState() : null); }
    catch (e) { console.warn('[Kickstil-Simulieren] Speichern', e); }
    finally { erlaubtSpeichern = false; dirty = false; if (L) L.seitSpeichern = 0; }
  }
  function nachholen() {
    const sicht = id => { const v = hatDom() && document.getElementById(id); return !!(v && v.classList.contains('active')); };
    if (OFFEN.home) { OFFEN.home = false; if (sicht('view-home') && typeof window.renderHomeTab === 'function') { try { window.renderHomeTab(); } catch (e) { console.warn('[Kickstil-Simulieren] Übersicht', e); } } }
    if (OFFEN.liga) { OFFEN.liga = false; if (sicht('view-liga') && typeof window.renderLeagueTab === 'function') { try { window.renderLeagueTab(); } catch (e) { console.warn('[Kickstil-Simulieren] Liga', e); } } }
    if (OFFEN.club) { OFFEN.club = false; if (sicht('view-club') && typeof window.renderClubTab === 'function') { try { window.renderClubTab(); } catch (e) { /* Ansicht optional */ } } }
    try { if (window.DFLAppShell && DFLAppShell.cta) DFLAppShell.cta(); } catch (e) { /* Haupt-Button optional */ }
    try { if (typeof window.renderCalendarWidget === 'function') window.renderCalendarWidget(); } catch (e) { /* Kalender optional */ }
  }
  function starte(key, opt) {
    opt = opt || {};
    if (LAUF && !LAUF.fertig) return LAUF;
    if (pflichtHalt()) return null;
    const z = ziele().find(x => x.key === key);
    if (!z) return null;
    einstellungSetzen('ziel', key);
    const L = LAUF = neuerLauf(z);
    L.ohneUi = !!opt.ohneUi || !hatDom();
    L.promise = laufen(L);
    return L;
  }
  async function laufen(L) {
    if (!L.ohneUi) blattModus('laeuft');
    L.aktiv = true;
    try {
      for (let runde = 0; runde < 80; runde++) {
        await warte(L.ohneUi || ruhig() ? 0 : 40);                 // Bild aufbauen lassen, „Anhalten“ annehmen
        if (L.stopp) { L.grund = L.grund || { art: 'stopp' }; break; }
        if (offenesFenster()) { await fensterErledigen(L, L.wochen[L.wochen.length - 1] || { zeilen: [] }); continue; }
        const pf = pflichtHalt();
        if (pf) { L.grund = Object.assign({ pflicht: true }, pf); break; }
        // „Später“ zurückgestellte Angebote am Deadline-Day noch einmal – auch, wenn dort das Ziel liegt
        const letzte = spaeterFaellig(L);
        if (letzte) { L.gefragt[letzte.id] = true; await halt(L, { art: 'angebot', b: letzte, letzte: true }); continue; }
        if (zielErreicht(L.ziel, L)) { L.grund = { art: 'ziel' }; break; }
        const e = wocheSpielen(L);
        L.wochen.push(e);
        if (!L.ohneUi) tickerNeu(e);
        if (L.hinweise.length) { const h = L.hinweise.splice(0); await halt(L, { art: 'hinweis', text: h.join(' · ') }); if (L.stopp) break; }
        // Kader schrumpft (auslaufende Verträge, Verkäufe): einmal je Lauf warnen (Test 2026-10-15: passiv gespielt
        // fiel der Kader in drei Saisons von 33 auf 13 Spieler, ohne dass der Lauf je anhielt)
        if (!L.kaderGewarnt && kader().filter(p => !p.onLoanAt).length < 16) {
          L.kaderGewarnt = true;
          await halt(L, { art: 'hinweis', text: `Kader zu klein: nur noch ${kader().filter(p => !p.onLoanAt).length} Spieler – Verträge verlängern, Talente hochziehen oder einkaufen` });
          if (L.stopp) break;
        }
        if (e.steht) { L.grund = { art: 'steht' }; break; }
        await nachDerWoche(L, e);
        if (++L.seitSpeichern >= 4) await speichern(L);
      }
    } catch (err) {
      console.warn('[Kickstil-Simulieren] Lauf abgebrochen', err);
      L.grund = { art: 'fehler', text: String(err && err.message || err) };
    } finally {
      L.aktiv = false; L.beiseite = false; MELDUNGEN = null;
      dirty = true;                                                  // am Ende immer einmal speichern
      await speichern(L);
      L.ende = { woche: LEAGUE.week, md: LEAGUE.matchday || 0, platz: platzVon('fcm') };
      L.zeit.gesamt = Math.max(0, Math.round(jetzt() - L.start.t - (L.zeit.halt || 0)));
      L.fertig = true;
      nachholen();
      if (!L.ohneUi) blattModus('ziel');
    }
    return L;
  }
  // Halt: das Spiel verhält sich normal (Speichern, Hinweise, Ansichten), bis du entschieden hast
  function halt(L, h) {
    L.halt = h; L.aktiv = false;
    dirty = true; speichern(L);
    nachholen();
    const t0 = jetzt();
    const fertig = res => w => {
      L.zeit.halt = (L.zeit.halt || 0) + (jetzt() - t0);          // Wartezeit zählt nicht als Rechenzeit
      if (h.ov && h.ov.classList) h.ov.classList.remove('sim-gespiegelt');
      L.halt = null; L.weiterMit = null; L.beiseite = false;
      L.aktiv = !L.stopp && w !== 'stopp';
      res(w);
    };
    const p = new Promise(res => { L.weiterMit = fertig(res); });
    if (L.ohneUi) return p;
    blattModus('halt');
    if (h.art === 'fenster') beiseite();                         // das Fenster des Spiels liegt oben – erledigen, dann geht es weiter
    return p;
  }
  function weiter(w) { if (LAUF && LAUF.weiterMit) LAUF.weiterMit(w || 'weiter'); }
  function anhalten() {
    if (!LAUF || LAUF.fertig) return;
    LAUF.stopp = true;
    if (LAUF.halt && LAUF.weiterMit) LAUF.weiterMit('stopp');
  }

  // ── Schneller weiterklicken: Wrapper ─────────────────────────────────────
  {
    const _orig = window.saveGameState;
    if (typeof _orig === 'function') {
      window.saveGameState = function () {
        if (simAktiv() && !erlaubtSpeichern) { dirty = true; return Promise.resolve(true); }
        return _orig.apply(this, arguments);
      };
      try { saveGameState = window.saveGameState; } catch (e) { /* window reicht */ }
    }
  }
  if (typeof window.showToast === 'function') {
    const _toast = window.showToast;
    window.showToast = function () { if (simAktiv()) return undefined; return _toast.apply(this, arguments); };
    try { showToast = window.showToast; } catch (e) { /* window reicht */ }
  }
  {
    const _alert = window.alert;
    window.alert = function (m) { if (simAktiv() && LAUF) { LAUF.hinweise.push(String(m || '').split('\n')[0]); return undefined; } return _alert.apply(window, arguments); };
  }
  if (window.PostMatchModal && typeof window.PostMatchModal.show === 'function') {
    const _show = window.PostMatchModal.show;
    window.PostMatchModal.show = function () { if (simAktiv()) return undefined; return _show.apply(this, arguments); };   // kein Bericht je Spiel
  }
  // Während des Laufs: Übersicht, Liga, Verein erst am Ende (hinter dem Blatt sieht sie niemand)
  [['renderHomeTab', 'home'], ['renderLeagueTab', 'liga'], ['renderClubTab', 'club']].forEach(([fn, k]) => {
    const _orig = window[fn];
    if (typeof _orig !== 'function') return;
    window[fn] = function () { if (simAktiv()) { OFFEN[k] = true; return undefined; } return _orig.apply(this, arguments); };
    try { if (fn === 'renderHomeTab') renderHomeTab = window[fn]; if (fn === 'renderLeagueTab') renderLeagueTab = window[fn]; if (fn === 'renderClubTab') renderClubTab = window[fn]; } catch (e) { /* window reicht */ }
  });
  // Transfer- und Scouting-Reiter zeichnen nur, wenn sie zu sehen sind (switchAppView zeichnet sie beim Öffnen) –
  // advanceCalendarWeek zeichnet beide sonst jede Woche unsichtbar mit
  [['renderTransferTab', 'view-transfer'], ['renderScoutTab', 'view-scout']].forEach(([fn, id]) => {
    const _orig = window[fn];
    if (typeof _orig !== 'function') return;
    window[fn] = function () {
      const v = hatDom() ? document.getElementById(id) : null;
      if (simAktiv() && v && !v.classList.contains('active')) return undefined;
      return _orig.apply(this, arguments);
    };
    try { if (fn === 'renderTransferTab') renderTransferTab = window[fn]; else renderScoutTab = window[fn]; } catch (e) { /* window reicht */ }
  });

  // ══ Anzeige: Blatt, Ticker, Zusammenfassung ═════════════════════════════
  let BLATT = null, MODUS = null, WAHL = null;
  function blattBauen() {
    if (BLATT || !hatDom()) return BLATT;
    BLATT = document.createElement('div');
    BLATT.id = 'dfl-sim'; BLATT.hidden = true;
    BLATT.innerHTML = `<div class="sim-dimmer"></div><section class="sim-blatt" role="dialog" aria-modal="true" aria-labelledby="sim-titel">
      <div class="sim-griff" aria-hidden="true"></div><div class="sim-kopf"></div><div class="sim-inhalt" id="sim-inhalt"></div><div class="sim-fuss"></div></section>`;
    document.body.appendChild(BLATT);
    BLATT.addEventListener('click', klick);
    BLATT.addEventListener('change', ev => {
      const m = /^sim-sw-(\w+)$/.exec(ev.target.id || '');
      if (m) einstellungSetzen(m[1], !!ev.target.checked);
    });
    BLATT.addEventListener('keydown', ev => { if (ev.key === 'Escape' && (MODUS === 'wahl' || MODUS === 'ziel')) schliessen(); });
    return BLATT;
  }
  const blattOffen = () => !!(BLATT && !BLATT.hidden);
  function zeigeBlatt() {
    blattBauen(); if (!BLATT) return;
    BLATT.hidden = false;
    document.body.classList.add('sim-offen');
    knopfAktualisieren();
  }
  function schliessen() {
    if (LAUF && !LAUF.fertig) return;                      // laufender Lauf: erst „Anhalten“
    if (BLATT) BLATT.hidden = true;
    document.body.classList.remove('sim-offen');
    LAUF = null; MODUS = null;
    nachholen();
    knopfAktualisieren();
  }
  function beiseite() {
    if (!LAUF) return;
    LAUF.beiseite = true;
    if (BLATT) BLATT.hidden = true;
    document.body.classList.remove('sim-offen');
    nachholen();
    knopfAktualisieren();
    setTimeout(pruefeBeiseite, 500);
  }
  // Pausiert („Ansehen“, fremdes Fenster): zurück, sobald nichts mehr offen ist
  function pruefeBeiseite() {
    if (!LAUF || !LAUF.beiseite) return;
    const h = LAUF.halt;
    if (h && h.art === 'fenster') {
      if (h.ov && h.ov.isConnected && sichtbar(h.ov)) { setTimeout(pruefeBeiseite, 400); return; }
      fortsetzen(); return;
    }
    // „Ansehen“ (Transfermarkt/Aufstellung): der Nutzer kommt über den Knopf „weiter“ zurück
  }
  function fortsetzen() {
    const L = LAUF; if (!L) return;
    L.beiseite = false;
    const h = L.halt;
    if (h && h.art === 'angebot' && !angebote().some(x => x.id === h.b.id)) {
      (h.e || L.wochen[L.wochen.length - 1] || { zeilen: [] }).zeilen.push({ art: 'anfrage', text: `Angebot ${h.b.club}: erledigt` });
      zeigeBlatt(); blattModus('laeuft'); weiter(); return;
    }
    if (h && (h.art === 'fenster' || h.art === 'entscheidung') && !(h.ov && h.ov.isConnected && sichtbar(h.ov))) { zeigeBlatt(); blattModus('laeuft'); weiter(); return; }
    zeigeBlatt(); blattModus(h ? 'halt' : (L.fertig ? 'ziel' : 'laeuft'));
  }
  function oeffnen() {
    if (!aktiv()) return;
    if (LAUF && LAUF.beiseite) { fortsetzen(); return; }
    if (LAUF && !LAUF.fertig) { zeigeBlatt(); blattModus(LAUF.halt ? 'halt' : 'laeuft'); return; }
    if (pflichtHalt()) return;
    LAUF = null;
    const z = ziele();
    if (!z.length) return;
    const ein = einstellungen();
    WAHL = z.some(x => x.key === ein.ziel) ? ein.ziel : z[0].key;
    zeigeBlatt(); blattModus('wahl');
    const b = BLATT.querySelector('.sim-ziel[aria-checked="true"]'); if (b) b.focus({ preventScroll: true });
  }
  function blattModus(m) {
    if (!blattBauen()) return;
    MODUS = m;
    const kopf = BLATT.querySelector('.sim-kopf'), inhalt = BLATT.querySelector('.sim-inhalt'), fuss = BLATT.querySelector('.sim-fuss');
    const zu = `<button class="sim-zu" type="button" data-sim="zu" aria-label="Schließen">${ic('x')}</button>`;
    const L = LAUF;
    if (m === 'wahl') {
      const z = ziele(), ein = einstellungen(), Z = z.find(x => x.key === WAHL) || z[0];
      kopf.innerHTML = `<div><h2 id="sim-titel">Simulieren bis …</h2><p>Deine Spiele laufen mit der Engine wie beim Anpfiff.</p></div>${zu}`;
      inhalt.innerHTML = `<div class="sim-zielwahl" role="radiogroup" aria-label="Ziel">${z.map(x => `<button class="sim-ziel" type="button" role="radio" data-ziel="${x.key}" aria-checked="${x.key === Z.key}">
          <span class="sim-zi">${ic(x.icon)}</span><b>${esc(x.name)}</b><small>${esc(x.text)}</small><span class="sim-zt">${esc(x.anzahl)}</span></button>`).join('')}</div>
        <p class="sim-unter">Anhalten bei</p>
        <div class="sim-schalter">
          <label for="sim-sw-gross"><span>Pokal- und Europapokalspiel<small>aus: wird mitsimuliert wie ein Ligaspiel</small></span><input type="checkbox" id="sim-sw-gross"${ein.gross ? ' checked' : ''}></label>
          <label for="sim-sw-angebot"><span>Angebot für deine Spieler<small>aus: es bleibt im Postfach, bis das Fenster schließt</small></span><input type="checkbox" id="sim-sw-angebot"${ein.angebot ? ' checked' : ''}></label>
          <label for="sim-sw-ereignis"><span>Ereignis mit Entscheidung<small>aus: die erste Antwort, dann weiter</small></span><input type="checkbox" id="sim-sw-ereignis"${ein.ereignis ? ' checked' : ''}></label>
          <label for="sim-sw-verletzung"><span>Verletzung in der Startelf<small>aus: die Aufstellung füllt sich vor dem Spiel selbst auf</small></span><input type="checkbox" id="sim-sw-verletzung"${ein.verletzung ? ' checked' : ''}></label>
        </div>
        <p class="sim-blass sim-klein">Hält immer: Deadline-Day, Saisonabschluss und Fenster, die eine Antwort von dir brauchen.</p>`;
      fuss.innerHTML = `<button class="sim-knopf gruen" type="button" data-sim="los">${ic('player-track-next')}<span>Los: ${esc(Z.name)}<small>${esc(Z.anzahl)} · ${esc(Z.text)}</small></span></button>`;
    } else if (m === 'laeuft' || m === 'halt') {
      const n = L.ziel.wochen, i = L.wochen.length;
      const zt = L.ziel.key === 'vier' ? L.ziel.name : 'bis ' + L.ziel.name;
      kopf.innerHTML = `<div><h2 id="sim-titel">${m === 'halt' ? 'Angehalten · ' + esc(zt) : 'Simuliere ' + esc(zt)}</h2><p class="sim-zahl" id="sim-stand">${standText()}</p></div>`;
      inhalt.innerHTML = `<div class="sim-fortschritt" aria-hidden="true"><div id="sim-balken" style="transform:scaleX(${Math.min(1, i / n).toFixed(3)})"></div></div>
        <ol class="sim-ticker" id="sim-ticker" aria-live="polite">${L.wochen.map(e => wochenKarte(e)).join('')}${m === 'laeuft' ? laeuftKarte() : ''}</ol>
        ${m === 'halt' ? haltKarte(L.halt) : ''}`;
      fuss.innerHTML = `<button class="sim-knopf hell" type="button" data-sim="stopp">${ic('player-pause')} Anhalten</button>`;
      inhalt.scrollTop = inhalt.scrollHeight;
      if (m === 'halt') { const b = inhalt.querySelector('.sim-halt button'); if (b) b.focus({ preventScroll: true }); }
    } else if (m === 'ziel') {
      kopf.innerHTML = `<div class="sim-z-kopf">${zusammenfassungKopf(L)}</div>${zu}`;
      inhalt.innerHTML = zusammenfassung(L);
      const g = L.grund || {}, P = PFLICHT[g.art], pflichtKnopf = g.pflicht && P && P.knopf;
      fuss.innerHTML = (pflichtKnopf ? `<button class="sim-knopf blau" type="button" data-sim="pflicht">${ic(P.icon)} ${esc(P.knopf)}</button>` : '')
        + `<button class="sim-knopf ${pflichtKnopf ? 'hell' : 'gruen'}" type="button" data-sim="fertig">${ic('circle-check')} Fertig</button>`;
      inhalt.scrollTop = 0;
      const b = fuss.querySelector('button'); if (b) b.focus({ preventScroll: true });
    }
    BLATT.dataset.modus = m;
  }
  function standText() {
    const L = LAUF; if (!L) return '';
    return `Woche ${Math.min(L.wochen.length, L.ziel.wochen)} von ${L.ziel.wochen} · ${kalender(LEAGUE.week)}`;
  }
  function tickerNeu(e) {
    if (!BLATT || MODUS !== 'laeuft' || BLATT.hidden) return;
    const t = BLATT.querySelector('#sim-ticker'), inhalt = BLATT.querySelector('.sim-inhalt');
    if (!t) return;
    const alt = t.querySelector('.sim-laeuft'); if (alt) alt.remove();
    t.insertAdjacentHTML('beforeend', wochenKarte(e, true) + laeuftKarte());
    const b = BLATT.querySelector('#sim-balken'); if (b) b.style.transform = `scaleX(${Math.min(1, LAUF.wochen.length / LAUF.ziel.wochen).toFixed(3)})`;
    const s = BLATT.querySelector('#sim-stand'); if (s) s.textContent = standText();
    inhalt.scrollTop = inhalt.scrollHeight;
  }
  const SPIELART = { liga: '', test: 'Test: ', pokal: 'Pokal: ', euro: 'Europa: ' };
  function laeuftKarte() {
    const f = spielFaellig();
    const was = !f ? ' …' : f.art === 'liga' ? ` · Spieltag ${(LEAGUE.matchday || 0) + 1} läuft …` : f.art === 'test' ? ' · Testspiel läuft …' : ' · Spiel läuft …';
    return `<li class="sim-tw sim-laeuft">${ic('refresh')} ${esc(kalender(LEAGUE.week).split(' · ')[0])}${was}</li>`;
  }
  const ART = { zurueck: ['user-plus', 'gut'], verletzt: ['bandage', 'schlecht'], sperre: ['ban', 'schlecht'], trade: ['arrows-exchange', 'gut', true],
    poRunde: ['trophy', ''], entscheidung: ['dice-5', ''], anfrage: ['cash', 'warn', true], info: ['info-circle', ''] };
  const PAUSE = { vorbereitung: ['barbell', 'Vorbereitung'], winter: ['snowflake', 'Winterpause'], frei: ['calendar-off', 'Spielfrei'] };
  function zeilenHtml(e) {
    if (!e.zeilen.length) return '';
    return `<ul class="sim-z">${e.zeilen.map(z => { const a = ART[z.art] || ['news', '']; return `<li class="${a[1]}${a[2] ? ' wichtig' : ''}">${ic(a[0])}<span>${esc(z.text)}${z.startelf ? ' · Startelf' : ''}</span></li>`; }).join('')}</ul>`;
  }
  function wochenKarte(e, neu) {
    const kw = `<span class="sim-kw">KW${e.woche}<small>${e.spiel && e.spiel.typ === 'liga' && e.md ? 'Sp. ' + e.md : esc(monatKurz(e.woche))}</small></span>`;
    if (!e.spiel) {
      const p = PAUSE[e.pause] || PAUSE.frei;
      return `<li class="sim-tw sim-pause${neu ? ' neu' : ''}"><div class="sim-tw-kopf">${kw}<span class="sim-pause-text">${ic(p[0])} ${esc(p[1])}</span></div>${zeilenHtml(e)}</li>`;
    }
    const s = e.spiel, [a, b] = s.tore, kl = a > b ? 's' : a === b ? 'u' : 'n';
    const d = e.platzVor && e.platz ? e.platzVor - e.platz : 0;
    const pfeil = d > 0 ? `<span class="sim-auf">▲${d}</span>` : d < 0 ? `<span class="sim-ab">▼${-d}</span>` : '';
    const liga = s.typ === 'liga' && e.md;
    const geg = s.name || vereinsName(s.gegner);
    return `<li class="sim-tw${neu ? ' neu' : ''}">
      <div class="sim-tw-kopf">${kw}
        <span class="sim-geg">${wappen(s.gegner)}<span class="n">${SPIELART[s.typ] || ''}${esc(geg)}</span><small>${s.heim ? '(H)' : '(A)'}</small></span>
        <b class="sim-erg ${kl}">${a}:${b}</b>${liga && e.platz ? `<span class="sim-platz">Pl. ${e.platz} ${pfeil}</span>` : '<span></span>'}</div>
      ${s.sch ? `<div class="sim-sch">${ic('ball-football')} ${esc(s.sch)}</div>` : ''}
      ${zeilenHtml(e)}</li>`;
  }
  function haltKarte(h) {
    if (!h) return '';
    if (h.art === 'angebot') {
      const b = h.b, karte = window.KSTransfer && KSTransfer.angebotKarte ? KSTransfer.angebotKarte(b, { gross: true }) : '';
      return `<div class="sim-halt" role="group" aria-labelledby="sim-h-t"><span class="sim-h-eyebrow">${ic(h.letzte ? 'clock' : 'cash')} ${h.letzte ? 'Deadline-Day' : 'Angebot'} · KW ${LEAGUE.week}</span>
        <h4 id="sim-h-t">${h.letzte ? `Letzte Chance: ${esc(b.club)} wartet noch` : `${esc(b.club)} will ${esc(b.playerName || 'einen Spieler')}`}</h4>
        ${karte || `<p><b>${esc(euro(b.amount))}</b></p>`}
        <div class="sim-knoepfe"><button class="sim-knopf hell" type="button" data-halt="annehmen">${ic('check')} Annehmen</button><button class="sim-knopf hell" type="button" data-halt="ablehnen">${ic('x')} Ablehnen</button></div>
        <div class="sim-knoepfe"><button class="sim-knopf hell" type="button" data-halt="ansehen">${ic('eye')} Verhandeln</button>
        ${h.letzte ? `<button class="sim-knopf blau" type="button" data-halt="weiter">${ic('player-track-next')}<span>Verfallen lassen<small>weiter simulieren</small></span></button>`
          : `<button class="sim-knopf blau" type="button" data-halt="spaeter">${ic('player-track-next')}<span>Später<small>am Deadline-Day frage ich noch einmal</small></span></button>`}</div></div>`;
    }
    if (h.art === 'entscheidung') {
      const ent = h.ent;
      return `<div class="sim-halt ereignis" role="group" aria-labelledby="sim-h-t"><span class="sim-h-eyebrow">${ic('dice-5')} Entscheidung · KW ${LEAGUE.week}</span>
        <h4 id="sim-h-t">${esc(ent.titel)}</h4>${ent.text ? `<p>${esc(ent.text)}</p>` : ''}
        <div class="sim-wahl">${ent.optionen.map((o, n) => `<button class="sim-knopf hell" type="button" data-wahl="${n}"><span>${esc(o.label)}${o.info ? `<small>${o.ungewiss ? 'Ausgang ungewiss · ' : ''}${esc(o.info)}</small>` : ''}</span></button>`).join('')}</div></div>`;
    }
    if (h.art === 'verletzt') {
      return `<div class="sim-halt" role="group" aria-labelledby="sim-h-t"><span class="sim-h-eyebrow">${ic('bandage')} Verletzung · KW ${h.e ? h.e.woche : LEAGUE.week}</span>
        <h4 id="sim-h-t">${esc(h.zeile.text)} · Startelf</h4>
        <p>Vor dem nächsten Spiel füllt sich die Aufstellung selbst auf. Du kannst sie auch von Hand ändern.</p>
        <div class="sim-knoepfe"><button class="sim-knopf hell" type="button" data-halt="aufstellung">${ic('users')} Aufstellung</button><button class="sim-knopf blau" type="button" data-halt="weiter">${ic('player-track-next')} Weiter</button></div></div>`;
    }
    if (h.art === 'fenster') {
      return `<div class="sim-halt" role="group" aria-labelledby="sim-h-t"><span class="sim-h-eyebrow">${ic('hand-stop')} Offen · KW ${LEAGUE.week}</span>
        <h4 id="sim-h-t">${esc(h.titel || 'Eine Entscheidung wartet')}</h4><p>Das Spiel fragt dich etwas. Erledige es im Fenster – danach geht es hier weiter.</p>
        <button class="sim-knopf blau" type="button" data-halt="fenster">${ic('external-link')} Zum Fenster</button></div>`;
    }
    if (h.art === 'hinweis') {
      return `<div class="sim-halt" role="group" aria-labelledby="sim-h-t"><span class="sim-h-eyebrow">${ic('info-circle')} Hinweis · KW ${LEAGUE.week}</span>
        <h4 id="sim-h-t">${esc(h.text)}</h4><button class="sim-knopf blau" type="button" data-halt="weiter">${ic('player-track-next')} Weiter</button></div>`;
    }
    return '';
  }
  function zusammenfassungKopf(L) {
    const g = L.grund || {}, P = PFLICHT[g.art], z = L.ziel, kw = kalender(LEAGUE.week).split(' · ')[0];
    let eyebrow, titel, text;
    if (g.art === 'ziel') {
      eyebrow = `Ziel erreicht · ${kw}`; titel = z.name;
      text = z.key === 'start' ? 'Als Nächstes: Spieltag 1.' : z.key === 'fenster' && /Deadline/.test(z.name) ? 'Letzte Woche des Transferfensters – jetzt oder erst im nächsten Fenster.'
        : z.key === 'fenster' ? 'Das Wintertransferfenster ist offen.' : z.key === 'hinrunde' ? 'Halbzeit der Saison.' : 'Hier geht es weiter, wann du willst.';
    } else if (g.pflicht && P) {
      eyebrow = `Angehalten · ${kw}`; titel = P.titel;
      const sp = g.sp, geg = sp ? (sp.name || vereinsName(sp.id)) : '';
      text = geg ? `${P.text} Gegner: ${geg}${sp.runde ? ' · ' + sp.runde : ''}.` : P.text;
    } else if (g.art === 'fehler') { eyebrow = 'Angehalten'; titel = 'Etwas ist schiefgelaufen'; text = 'Spiel bitte von Hand weiter (' + g.text + ').'; }
    else if (g.art === 'steht') { eyebrow = 'Angehalten'; titel = 'Hier geht es nicht weiter'; text = 'Das Spiel braucht erst eine Entscheidung von dir.'; }
    else { eyebrow = `Angehalten · ${kw}`; titel = 'Zwischenstand'; text = 'Hier geht es weiter, wann du willst.'; }
    return `<p class="sim-eyebrow">${esc(eyebrow)}</p><h2 id="sim-titel">${esc(titel)}</h2><p>${esc(text)}</p>`;
  }
  function kurve(L) {
    // Platz nach jeder Woche (erst ab Spieltag 1 – davor stünde die Tabelle nach dem Alphabet)
    const reihe = [{ p: L.start.md > 0 ? L.start.platz : null, kw: L.start.woche }].concat(L.wochen.map(e => ({ p: e.platz, kw: e.nach || e.woche + 1 }))).filter(x => x.p != null);   // Doppelwoche: Woche bleibt stehen
    const pts = reihe.map(x => x.p), kws = reihe.map(x => x.kw), n = pts.length;
    if (n < 2) return '';
    const anzahl = tabelle().length || 18, [auf, ab] = zonen();
    const B = 300, H = 92, l = 26, r = 14, o = 10, u = 18, maxP = Math.max(anzahl, ...pts);
    const x = i => l + (B - l - r) * (i / (n - 1)), y = p => o + (H - o - u) * (p - 1) / (maxP - 1);
    const pfad = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(' ');
    const linie = (p, kl) => `<line x1="${l}" x2="${B - r}" y1="${((y(p) + y(p + 1)) / 2).toFixed(1)}" y2="${((y(p) + y(p + 1)) / 2).toFixed(1)}" class="${kl}"/>`;
    return `<svg class="sim-kurve" viewBox="0 0 ${B} ${H}" role="img" aria-label="Tabellenplatz: von ${pts[0]} auf ${pts[n - 1]}">
      ${[1, Math.round(maxP / 2), maxP].map(p => `<line x1="${l}" x2="${B - r}" y1="${y(p)}" y2="${y(p)}" class="sim-k-gitter"/><text x="${l - 6}" y="${y(p) + 4}" text-anchor="end" class="sim-k-text">${p}</text>`).join('')}
      ${auf ? linie(auf, 'sim-k-linie ks-auf') : ''}${ab ? linie(anzahl - ab, 'sim-k-linie') : ''}
      <path d="${pfad}" class="sim-k-pfad"/>
      ${pts.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p).toFixed(1)}" r="${i === 0 || i === n - 1 ? 4.5 : 2.5}" class="sim-k-punkt${i === n - 1 ? ' ende' : ''}"><title>KW${kws[i] || ''}: Platz ${p}</title></circle>`).join('')}
      <text x="${x(0)}" y="${H - 4}" class="sim-k-text">KW${kws[0]}</text><text x="${x(n - 1)}" y="${H - 4}" text-anchor="end" class="sim-k-text">KW${kws[n - 1]}</text></svg>`;
  }
  function tabelleHtml(max) {
    const t = tabelle(); if (!t.length) return '';
    const [auf, ab] = zonen(), n = t.length;
    let zeigen = t.slice(0, max || n);
    const eig = t.find(x => x.id === 'fcm'), luecke = eig && zeigen.indexOf(eig) < 0;
    if (luecke) zeigen = zeigen.concat([eig]);
    const rows = zeigen.map(x => {
      const pl = t.indexOf(x) + 1, td = x.gf - x.ga;
      const zone = pl <= auf ? 'division' : (ab && pl > n - ab) ? 'ks-ab' : '';
      return `${luecke && x === eig ? '<tr class="sim-luecke" aria-hidden="true"><td colspan="5">…</td></tr>' : ''}<tr class="${x.id === 'fcm' ? 'eigen' : ''}${pl === auf ? ' ks-linie-auf' : ''}${ab && pl === n - ab ? ' linie' : ''}">
        <td>${zone ? `<span class="sim-seed ${zone}">${pl}</span>` : `<span class="sim-blass">${pl}</span>`}</td>
        <td class="sim-verein"><span>${wappen(x.id)}<b>${esc(x.id === 'fcm' ? CLUB.name : x.name)}</b></span></td>
        <td>${x.played || 0}</td><td>${td > 0 ? '+' : ''}${td}</td><td><b>${x.pts || 0}</b></td></tr>`;
    }).join('');
    return `<table class="sim-tab"><thead><tr><th scope="col"><span class="sim-sr">Platz</span></th><th scope="col">Verein</th><th scope="col">Sp</th>
      <th scope="col">TD</th><th scope="col">Pkt</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="sim-legende">${auf ? `<span><span class="sim-seed division">1</span> Aufstieg</span>` : ''}${ab ? `<span><span class="sim-seed ks-ab">${n}</span> Abstieg</span>` : ''}</div>`;
  }
  function brauchtDich() {
    const z = [];
    angebote().forEach(b => z.push(`<li>${ic('cash')}<span><b>${esc(b.club)}</b> bietet ${esc(euro(b.amount))} für ${esc(b.playerName || '')}</span>
      <button class="sim-link" type="button" data-sim="transfer">Ansehen</button></li>`));
    const elf = new Set(typeof getLineupIds === 'function' ? getLineupIds() : []);
    const verl = kader().filter(p => verletzt(p) && elf.has(p.id)).map(spielerName);
    if (verl.length) z.push(`<li>${ic('bandage')}<span><b>Verletzt in der Startelf:</b> ${esc(verl.join(', '))}</span></li>`);
    const ablauf = kader().filter(p => p.contractUntil != null && LEAGUE && p.contractUntil <= (LEAGUE.season || 1) && !p.onLoanFrom).map(spielerName);
    if (ablauf.length) z.push(`<li>${ic('file-text')}<span><b>Vertrag läuft aus:</b> ${esc(ablauf.slice(0, 5).join(', '))}${ablauf.length > 5 ? ' …' : ''}</span></li>`);
    if (!z.length) z.push(`<li class="ok">${ic('circle-check')}<span>Nichts Dringendes.</span></li>`);
    return `<section class="sim-tafel"><h3 class="sim-h3">${ic('alert-triangle')} Braucht dich</h3><ul class="sim-braucht">${z.join('')}</ul></section>`;
  }
  function zusammenfassung(L) {
    const sp = L.wochen.filter(e => e.spiel && e.spiel.typ === 'liga').map(e => e.spiel);
    const s = sp.filter(x => x.tore[0] > x.tore[1]).length, u = sp.filter(x => x.tore[0] === x.tore[1]).length, n = sp.length - s - u;
    const tf = sp.reduce((a, x) => a + x.tore[0], 0), tg = sp.reduce((a, x) => a + x.tore[1], 0);
    const sch = new Map();
    L.wochen.filter(e => e.spiel && e.spiel.typ !== 'test').forEach(e => String(e.spiel.sch || '').split(', ').filter(Boolean).forEach(t => {
      const m = /^(.*?)(?: (\d+))?$/.exec(t); sch.set(m[1], (sch.get(m[1]) || 0) + (+m[2] || 1));
    }));
    const top = [...sch].sort((a, b) => b[1] - a[1])[0];
    const p0 = L.start.platz, p1 = L.ende ? L.ende.platz : platzVon('fcm'), dp = p0 && p1 ? p0 - p1 : 0;
    const kl = d => (d > 0 ? 'sim-gut' : d < 0 ? 'sim-schlecht' : '');
    const tests = L.wochen.filter(e => e.spiel && e.spiel.typ === 'test').map(e => e.spiel);
    const pokal = L.wochen.filter(e => e.spiel && (e.spiel.typ === 'pokal' || e.spiel.typ === 'euro')).map(e => e.spiel);
    const ergChip = x => { const k = x.tore[0] > x.tore[1] ? 's' : x.tore[0] === x.tore[1] ? 'u' : 'n'; return `<span class="sim-erg ${k}" title="${esc(x.name || vereinsName(x.gegner))}">${x.tore[0]}:${x.tore[1]}</span>`; };
    const saison = (LEAGUE.matchday || 0) > 0, vergleich = L.start.md > 0 && p0;
    const bilanz = sp.length ? `<section class="sim-tafel"><h3 class="sim-h3">${ic('chart-line')} Bilanz · ${sp.length} Ligaspiel${sp.length === 1 ? '' : 'e'}</h3>
        <div class="sim-bilanz"><div><b class="sim-gut">${s}</b><small>Siege</small></div><div><b>${u}</b><small>Remis</small></div><div><b class="sim-schlecht">${n}</b><small>Niederl.</small></div><div><b>${tf}:${tg}</b><small>Tore</small></div></div>
        ${top ? `<div class="sim-vn"><span>Bester Schütze</span><b>${esc(top[0])} · ${top[1]} Tor${top[1] === 1 ? '' : 'e'}</b></div>` : ''}
        ${p1 && saison ? `<div class="sim-vn"><span>Tabellenplatz</span><b class="${vergleich ? kl(dp) : ''}">${vergleich ? p0 + ' → ' : ''}${p1}${vergleich && dp ? (dp > 0 ? ' ▲' + dp : ' ▼' + (-dp)) : ''}</b></div>` : ''}
        ${pokal.length ? `<div class="sim-vn"><span>Pokal/Europa</span><span class="sim-reihe">${pokal.map(ergChip).join('')}</span></div>` : ''}
        ${kurve(L)}</section>`
      : `<section class="sim-tafel"><h3 class="sim-h3">${ic('barbell')} Vorbereitung · ${L.wochen.length} Woche${L.wochen.length === 1 ? '' : 'n'}</h3>
        ${tests.length ? `<div class="sim-vn"><span>Testspiele</span><span class="sim-reihe">${tests.map(ergChip).join('')}</span></div>` : '<p class="sim-klein sim-blass">Keine Testspiele.</p>'}</section>`;
    return `${bilanz}
      ${brauchtDich()}
      ${saison ? `<section class="sim-tafel"><h3 class="sim-h3">${ic('trophy')} ${esc(ligaName())} · Top 6</h3>${tabelleHtml(6)}</section>` : ''}
      ${saison ? `<div class="sim-kacheln"><button class="sim-knopf hell" type="button" data-sim="liga">${ic('list-numbers')}<span>Tabelle<small>ganze Liga</small></span></button></div>` : ''}
      <p class="sim-blass sim-klein sim-zeit">${L.wochen.length} Woche${L.wochen.length === 1 ? '' : 'n'} in ${(L.zeit.gesamt / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} s</p>`;
  }

  // ── Klicks im Blatt ──────────────────────────────────────────────────────
  function zuAnsicht(view) {
    try {
      if (window.DFLAppShell && DFLAppShell.zeige && document.body.classList.contains('dfl-shell')) DFLAppShell.zeige(view);
      else if (typeof switchAppView === 'function') switchAppView(view, document.getElementById('nav-' + view));
    } catch (e) { console.warn('[Kickstil-Simulieren] Ansicht', e); }
  }
  function klick(ev) {
    if (ev.target.classList && ev.target.classList.contains('sim-dimmer')) { if (MODUS === 'wahl' || (LAUF && LAUF.fertig)) schliessen(); return; }
    const t = ev.target.closest('button');
    if (!t || !BLATT.contains(t)) return;
    const L = LAUF, d = t.dataset;
    if (d.ziel) { WAHL = d.ziel; blattModus('wahl'); const b = BLATT.querySelector(`[data-ziel="${WAHL}"]`); if (b) b.focus({ preventScroll: true }); return; }
    if (d.sim === 'zu' || d.sim === 'fertig') { schliessen(); return; }
    if (d.sim === 'los') { starte(WAHL); knopfAktualisieren(); return; }
    if (d.sim === 'stopp') { anhalten(); if (L && L.halt == null) { t.disabled = true; t.innerHTML = `${ic('loader-2')} Hält nach dieser Woche …`; } return; }
    if (d.sim === 'liga') { schliessen(); zuAnsicht('liga'); return; }
    if (d.sim === 'transfer') { schliessen(); zuAnsicht('transfer'); return; }
    if (d.sim === 'pflicht') {
      schliessen();
      setTimeout(() => {
        try {
          const z = window.DFLAppShell && DFLAppShell.ctaZustand ? DFLAppShell.ctaZustand() : null;
          if (L && L.grund && L.grund.art === 'deadline' && window.KSDeadline) KSDeadline.oeffnen();
          else if (z && document.body.classList.contains('dfl-shell')) { z.go(); DFLAppShell.cta(); }
          else if (L && L.grund && L.grund.art === 'saisonende') nextWeek();
          else zuAnsicht('match');
        } catch (e) { console.warn('[Kickstil-Simulieren] Pflicht', e); }
      }, 30);
      return;
    }
    if (!L || !L.halt) return;
    const h = L.halt, zeilen = (h.e || L.wochen[L.wochen.length - 1] || { zeilen: [] }).zeilen;
    if (d.wahl != null && h.art === 'entscheidung') {
      const o = h.ent.optionen[+d.wahl];
      if (o) { try { o.btn.click(); } catch (e) { console.warn('[Kickstil-Simulieren] Entscheidung', e); } zeilen.push({ art: 'entscheidung', text: `${h.ent.titel}: ${o.label}` }); }
      blattModus('laeuft'); weiter(); return;
    }
    if (h.art === 'angebot') {
      const b = h.b;
      if (d.halt === 'annehmen') {
        try { if (typeof onAcceptBid === 'function') onAcceptBid(b.id); } catch (e) { console.warn('[Kickstil-Simulieren] Annehmen', e); }
        zeilen.push({ art: 'trade', text: `Verkauft: ${b.playerName} für ${euro(b.amount)} an ${b.club}` });
        blattModus('laeuft'); weiter(); return;
      }
      if (d.halt === 'ablehnen') {
        try { if (typeof declineTransferBid === 'function') declineTransferBid(b.id); } catch (e) { /* schon weg */ }
        zeilen.push({ art: 'anfrage', text: `Angebot ${b.club} für ${b.playerName}: abgelehnt` });
        blattModus('laeuft'); weiter(); return;
      }
      if (d.halt === 'ansehen') {
        beiseite();
        try { if (typeof openSellNegotiation === 'function') openSellNegotiation(b.id); else zuAnsicht('transfer'); } catch (e) { zuAnsicht('transfer'); }
        warteAufVerhandlung(b.id);
        return;
      }
      if (d.halt === 'spaeter') {
        L.spaeter[b.id] = true;
        zeilen.push({ art: 'anfrage', text: `Angebot ${b.club} für ${b.playerName}: später` });
        blattModus('laeuft'); weiter(); return;
      }
    }
    if (d.halt === 'weiter') { blattModus('laeuft'); weiter(); return; }
    if (d.halt === 'aufstellung') { beiseite(); zuAnsicht('squad'); return; }
    if (d.halt === 'fenster') { if (h.ov) h.ov.classList.remove('sim-gespiegelt'); beiseite(); return; }
  }
  // Verhandlung (#sellnego-overlay) offen: danach zurück zum Blatt
  function warteAufVerhandlung(id) {
    const pruefe = () => {
      if (!LAUF || !LAUF.beiseite) return;
      const ov = document.getElementById('sellnego-overlay');
      if (ov && sichtbar(ov)) { setTimeout(pruefe, 400); return; }
      fortsetzen();
    };
    setTimeout(pruefe, 600);
  }

  // ══ Knopf „bis …“ am Haupt-Button (Handy) und neben „Woche weiter“ (PC) ══
  const hatShell = () => hatDom() && document.body.classList.contains('dfl-shell');
  function simMoeglich() {
    if (!aktiv() || (LAUF && !LAUF.fertig)) return false;
    if (pflichtHalt()) return false;
    return ziele().length > 0;
  }
  function knopfBauen() {
    if (!hatDom() || document.getElementById('dfl-sim-knopf')) return;
    const b = document.createElement('button');
    b.id = 'dfl-sim-knopf'; b.type = 'button';
    b.setAttribute('aria-haspopup', 'dialog');
    b.addEventListener('click', () => { oeffnen(); knopfAktualisieren(); });
    document.body.appendChild(b);
  }
  function knopfAktualisieren() {
    if (!hatDom()) return;
    knopfBauen();
    const b = document.getElementById('dfl-sim-knopf'), cta = document.getElementById('app-cta');
    const pause = pausiert();
    const zeigen = hatShell() && !!cta && cta.classList.contains('zeigen') && !blattOffen() && (pause || simMoeglich());
    b.classList.toggle('zeigen', zeigen);
    b.classList.toggle('weiter', pause);
    document.body.classList.toggle('sim-mit-knopf', zeigen);
    const html = pause ? `${ic('player-play')}<span>weiter</span>` : `${ic('player-track-next')}<span>bis …</span>`;
    if (b.innerHTML !== html) b.innerHTML = html;
    b.setAttribute('aria-label', pause ? 'Simulation fortsetzen' : 'Simulieren bis …');
    const pc = document.getElementById('dfl-sim-pc');
    if (pc) {
      pc.hidden = hatShell() || !(pause || simMoeglich());
      pc.innerHTML = pause ? `${ic('player-play')} weiter` : `${ic('player-track-next')} bis …`;
    }
  }
  function pcKnopfEinbauen() {
    const n = aktiv() && hatDom() ? document.querySelector('#calendar-widget .cal-next') : null;
    if (n && !document.getElementById('dfl-sim-pc')) {
      n.insertAdjacentHTML('afterend', `<button type="button" class="dfl-sim-pc" id="dfl-sim-pc">${ic('player-track-next')} bis …</button>`);
      document.getElementById('dfl-sim-pc').addEventListener('click', () => { oeffnen(); knopfAktualisieren(); });
    }
  }
  {
    const _orig = window.renderCalendarWidget;
    if (typeof _orig === 'function') {
      window.renderCalendarWidget = function () {
        const r = _orig.apply(this, arguments);
        try { pcKnopfEinbauen(); knopfAktualisieren(); } catch (e) { /* nur Anzeige */ }
        return r;
      };
      try { renderCalendarWidget = window.renderCalendarWidget; } catch (e) { /* window reicht */ }
    }
  }
  // Haupt-Button der Shell wird laufend neu gesetzt → Knopf mitziehen
  if (window.DFLAppShell && typeof DFLAppShell.cta === 'function') {
    const _cta = DFLAppShell.cta;
    DFLAppShell.cta = function () { const r = _cta.apply(this, arguments); try { knopfAktualisieren(); } catch (e) { /* nur Anzeige */ } return r; };
  }
  setInterval(() => { if (document.visibilityState === 'visible') { try { knopfAktualisieren(); } catch (e) { /* nur Anzeige */ } } }, 1500);

  window.KSSimulieren = { ziele, starte, oeffnen, einstellungen, lauf: () => LAUF, laeuft: simAktiv, weiter, anhalten };
  setTimeout(() => { try { pcKnopfEinbauen(); knopfAktualisieren(); } catch (e) { /* später */ } }, 0);
  console.log('[Kickstil-Simulieren v1] aktiv — „Simulieren bis …“: Saisonstart, 4 Wochen, Transferfenster, Hinrunde, Saisonende; hält vor Pokal/Europa, bei Angeboten und Entscheidungen');
})();
