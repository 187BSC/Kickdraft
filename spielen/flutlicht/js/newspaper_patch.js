/* ===== newspaper_patch.js =====
   FLUTLICHT-KURIER (vormals „Der Anstoß“, umbenannt 2026-10-16 wegen Markenkonflikt mit dem Spiel „Anstoss“) v1 — Wochenzeitung mit regelbasiertem Erzähler
   ─────────────────────────────────────────────────────────────────────────────
   Kein KI-Modell: ein Textgenerator, der den Spielstand liest, Muster erkennt
   (Siegesserien, Tabellendruck gegen das Saisonziel, Sensationen im Europapokal,
   Marktlage, Lazarett) und daraus Sätze aus Bausteinen baut. Jeder Baustein hat
   mehrere Varianten, deshalb liest sich keine Ausgabe wie die vorige.

   Rubriken: Aufmacher (eigener Verein) · Formkurve · Liga-Tabelle ·
   Kurzmeldungen · Entscheidung der Woche · Aus Europa (CL/EL/ECL) ·
   Transfermarkt · Aus den Ligen · Analyse der Redaktion (nur im Formtief,
   mit echtem Moral-Effekt).

   Lädt NACH bundle_squad.js/city_map_iso_patch.js (wegen switchAppView) und
   VOR init_bootstrap.js.
   ============================================================================= */
(function () {
  'use strict';

  const MORAL_BONUS = 8;          // Wirkung des umgesetzten Taktik-Tipps
  const FANS_BONUS  = 3;

  // ── Werkzeug ───────────────────────────────────────────────────────────────
  // ZUFALL MIT GEDÄCHTNIS: w() zog bisher aus Math.random(). Weil die Ausgabe
  // bei jedem Öffnen des Tabs neu gebaut wird, stand nach einem Tabwechsel eine
  // andere Zeitung da — anderer Aufmacher, andere Texte, gleiche Woche. Eine
  // Wochenzeitung steht aber fest. Deshalb ein eigener Generator, der zu Beginn
  // jeder Ausgabe aus Saison und Woche gesetzt wird: innerhalb der Woche immer
  // dasselbe Blatt, von Woche zu Woche ein anderes.
  let _saat = 1;
  function setzeSaat(saison, woche) {
    let h = (2166136261 ^ Math.imul(saison | 0, 73856093) ^ Math.imul(woche | 0, 19349663)) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    _saat = ((h ^ (h >>> 16)) >>> 0) || 1;
  }
  function zufall() {                                   // Mulberry32
    _saat = (_saat + 0x6D2B79F5) >>> 0;
    let t = _saat;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function w() { const v = arguments; return v[Math.floor(zufall() * v.length)]; }
  function zahlwort(n) {
    return ['null','ein','zwei','drei','vier','fünf','sechs','sieben','acht','neun','zehn'][n] || n;
  }
  // Ordnungszahl — sonst steht da „der zwei. Sieg" statt „der zweite Sieg".
  function ordnungswort(n) {
    return ['nullte','erste','zweite','dritte','vierte','fünfte','sechste','siebte','achte','neunte','zehnte'][n] || (n + '.');
  }
  function gross(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  // Flagge samt Trennzeichen — fehlt sie, bleibt der Satz ohne doppelte Lücke.
  function fl(x) { return x ? x + ' ' : ''; }
  function euro(v) {
    if (typeof formatEuro === 'function') return formatEuro(Math.round(v || 0));
    return '€' + Math.round((v || 0) / 1000) + 'k';
  }
  function zahl(n) { return (n || 0).toLocaleString('de-DE'); }
  function esc(s) { return String(s == null ? '' : s).replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c])); }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1) DATEN SAMMELN
  // ═══════════════════════════════════════════════════════════════════════════
  function meineGruppe() {
    try { return findFcmGroup(LEAGUE); } catch (e) { return null; }
  }
  function tabelleVon(teams) {
    return (teams || []).slice().sort(function (a, b) {
      return (b.pts || 0) - (a.pts || 0) || ((b.gf - b.ga) - (a.gf - a.ga)) || (b.gf - a.gf);
    });
  }
  function tierTabelle(tierKey, n) {
    try {
      const t = LEAGUE.tiers[tierKey];
      if (!t || !t.groups || !t.groups[0]) return [];
      return tabelleVon(t.groups[0].teams).slice(0, n || 5).map(function (x, i) {
        return { pl: i + 1, n: x.name, p: x.pts || 0, gf: x.gf || 0, ga: x.ga || 0, ovr: x.ovr || 0 };
      });
    } catch (e) { return []; }
  }

  // Die letzten Ergebnisse des eigenen Vereins aus dem News-Feed lesen —
  // dort steht jedes Spiel als „Sieg: FCM 2:1 Gegner".
  // Kickstil-Fix: addNews (engine_main.js) setzt neue Meldungen mit unshift NACH VORN – die Schleife lief von hinten und
  // las so die ÄLTESTEN Spiele zuerst (Aufmacher nach Spieltag 3 meldete das 2:3 von Spieltag 1). Jetzt von vorn = neueste zuerst.
  function eigeneErgebnisse() {
    const news = (typeof CLUB !== 'undefined' && CLUB.news) || [];
    const raus = [];
    for (let i = 0; i < news.length && raus.length < 6; i++) {
      const n = news[i];
      if (n.category !== 'match') continue;
      const m = (n.title || '').match(/^(Sieg|Niederlage|Unentschieden|Remis):\s*(.+?)\s+(\d+):(\d+)\s+(.+)$/);
      if (!m) continue;
      const eig = parseInt(m[3], 10), fre = parseInt(m[4], 10);
      raus.push({
        art: eig > fre ? 'S' : eig < fre ? 'N' : 'U',
        gegner: m[5], eigene: eig, fremde: fre,
        // Die News nennt immer „FCM x:y Gegner" — ob heim oder auswärts steht
        // nicht drin. Aus dem Text ableiten („Im Ligaspiel bei X").
        heim: !/\bbei\b/.test(n.text || '')
      });
    }
    return raus;
  }

  function europaDaten(key) {
    try {
      if (typeof CLUB === 'undefined' || !CLUB.euro) return null;
      const lp = CLUB.euro.leaguePhase && CLUB.euro.leaguePhase[key];
      const comp = (CLUB.euro.competitions && CLUB.euro.competitions[key]) || [];
      if (!lp) return null;
      const namen = {};
      comp.forEach(function (c) { namen[c.id] = c; });
      const flach = [];
      (lp.fixtures || []).forEach(function (md) {
        (Array.isArray(md) ? md : [md]).forEach(function (f) { if (f && f.played) flach.push(f); });
      });
      // Sensation: der auf dem Papier deutlich Schwächere gewinnt.
      let sens = null;
      flach.forEach(function (f) {
        const h = namen[f.home], a = namen[f.away];
        if (!h || !a) return;
        const gh = f.gh, ga = f.ga;
        if (gh == null || ga == null) return;
        if (gh > ga && (a.ovr - h.ovr) >= 6 && (!sens || (a.ovr - h.ovr) > sens.d))
          sens = { d: a.ovr - h.ovr, sieger: h.name, sf: h.flag, verlierer: a.name, vf: a.flag, erg: gh + ':' + ga };
        if (ga > gh && (h.ovr - a.ovr) >= 6 && (!sens || (h.ovr - a.ovr) > sens.d))
          sens = { d: h.ovr - a.ovr, sieger: a.name, sf: a.flag, verlierer: h.name, vf: h.flag, erg: gh + ':' + ga };
      });
      return {
        matchday: (CLUB.euro.leaguePhaseMatchdayIndex || 0),
        tabelle: (lp.standings || []).slice(0, 6).map(function (t, i) {
          return { pl: i + 1, n: t.name, f: t.flag, l: t.country, p: t.pts || 0, gf: t.gf || 0, ga: t.ga || 0, isFcm: !!t.isFcm };
        }),
        spiele: flach.slice(-5).map(function (f) {
          const h = namen[f.home] || { name: f.home }, a = namen[f.away] || { name: f.away };
          return { h: h.name, hf: h.flag, a: a.name, af: a.flag, gh: f.gh, ga: f.ga };
        }),
        sensation: sens,
        deutsche: comp.filter(function (c) { return c.country === 'Deutschland'; })
      };
    } catch (e) { return null; }
  }

  // Transfers und Entscheidungen aus dem News-Feed der letzten Wochen.
  function letzteNews(filter, max) {
    const news = (typeof CLUB !== 'undefined' && CLUB.news) || [];
    const raus = [];
    for (let i = 0; i < news.length && raus.length < (max || 3); i++) {     // neueste zuerst (unshift, s. o.)
      if (filter(news[i])) raus.push(news[i]);
    }
    return raus;
  }
  function transferZeilen() {
    const n = letzteNews(function (x) { return /Transfermarkt/.test(x.title || ''); }, 1)[0];
    if (!n) return [];
    // Zeilen der Form „• 🇩🇪 Name (ST) wechselt von A zu B — €8.4 Mio"
    return (n.text || '').split('\n').filter(function (z) { return z.indexOf('•') === 0; })
      .map(function (z) { return z.replace(/^•\s*/, '').trim(); }).slice(0, 4);
  }
  function entscheidungDerWoche() {
    const n = letzteNews(function (x) { return /^🎲/.test(x.title || ''); }, 1)[0];
    if (!n) return null;
    const titel = (n.title || '').replace(/^🎲\s*/, '');
    const t = (n.text || '').split(':');
    return { titel: titel, wahl: (t[0] || '').trim(), folge: t.slice(1).join(':').trim() };
  }
  function freieSpieler() {
    const fa = (typeof CLUB !== 'undefined' && CLUB.freeAgents) || [];
    return fa.slice().sort(function (a, b) { return (b.ovr || 0) - (a.ovr || 0); }).slice(0, 3)
      .map(function (p) {
        return { n: ((p.firstName || '') + ' ' + (p.name || '')).trim(), pos: p.pos, ovr: p.ovr,
                 age: p.age, flagge: p.flag || '' };
      });
  }

  // ── Der Rivale: einmal je Liga bestimmt, dann fest ────────────────────────
  // Gegenspieler auf Augenhöhe zu haben ist erzählerisch mehr wert als ein
  // beliebiger Gegner. Ausgewählt wird der Klub mit der ähnlichsten Stärke —
  // und er BLEIBT es, solange man in derselben Liga spielt.
  function rivale(grp) {
    try {
      if (!CLUB._zeitung) CLUB._zeitung = {};
      const liga = CLUB.leagueName || '';
      const gespeichert = CLUB._zeitung.rivale;
      const teams = grp.group.teams;
      if (gespeichert && gespeichert.liga === liga) {
        const t = teams.filter(function (x) { return x.id === gespeichert.id; })[0];
        if (t) return { id: t.id, n: t.name, pts: t.pts || 0, ovr: t.ovr || 0, form: t.form || [], seit: gespeichert.seit };
      }
      const me = teams.filter(function (x) { return x.id === 'fcm'; })[0];
      if (!me) return null;
      const kand = teams.filter(function (x) { return x.id !== 'fcm' && !x.isReserve; })
        .map(function (x) { return { t: x, d: Math.abs((x.ovr || 0) - (me.ovr || 0)) }; })
        .sort(function (a, b) { return a.d - b.d; })[0];
      if (!kand) return null;
      CLUB._zeitung.rivale = { id: kand.t.id, liga: liga, seit: LEAGUE.season };
      return { id: kand.t.id, n: kand.t.name, pts: kand.t.pts || 0, ovr: kand.t.ovr || 0,
               form: kand.t.form || [], seit: LEAGUE.season };
    } catch (e) { return null; }
  }

  // ── Trainerbeben anderswo ──────────────────────────────────────────────────
  // Es gibt keine NPC-Trainer im Spiel — die Meldung wird deshalb aus echten
  // Tabellendaten abgeleitet: starker Kader, schlechter Platz, schlechte Form.
  // Der EIGENE Verein muss raus, sonst schreibt die Zeitung über den Leser.
  function trainerBeben(grp, rivalId) {
    try {
      const tab = tabelleVon(grp.group.teams);
      if (tab.length < 6) return null;
      const maxOvr = tab.reduce(function (m, t) { return Math.max(m, t.ovr || 0); }, 0);
      const untereHaelfte = Math.ceil(tab.length / 2);
      const kand = tab.map(function (t, i) { return { n: t.name, id: t.id, pl: i + 1, ovr: t.ovr || 0, pts: t.pts || 0, form: t.form || [] }; })
        .filter(function (t) {
          if (t.id === 'fcm') return false;                       // nie der eigene Verein
          // Auch nicht der Rivale: sonst steht in einer Ausgabe „punktgleich wie
          // immer" neben „steckt tief in der Krise" — das widerspricht sich.
          if (rivalId && t.id === rivalId) return false;
          if (t.ovr < maxOvr - 6) return false;                   // muss ein starker Kader sein
          if (t.pl <= untereHaelfte) return false;                // und schlecht stehen
          const pleiten = t.form.filter(function (x) { return x === 'L'; }).length;
          return pleiten >= 2;
        });
      if (!kand.length) return null;
      // Der krasseste Fall: stärkster Kader auf schlechtestem Platz.
      kand.sort(function (a, b) { return (b.ovr - b.pl * 2) - (a.ovr - a.pl * 2); });
      return kand[0];
    } catch (e) { return null; }
  }

  // ── Jubiläen ───────────────────────────────────────────────────────────────
  // `gamesPlayed` zählt über die ganze Karriere. Ein Meilenstein gilt, wenn der
  // Wert eine runde Marke gerade erreicht oder knapp überschritten hat.
  const MARKEN_SPIELE = [50, 100, 150, 200, 250, 300, 400, 500];
  const MARKEN_TORE   = [10, 25, 50, 75, 100, 150, 200];
  function jubilaeen(kader) {
    const raus = [];
    kader.forEach(function (p) {
      const sp = p.gamesPlayed || 0;
      MARKEN_SPIELE.forEach(function (m) {
        if (sp >= m && sp <= m + 2) raus.push({ art: 'spiele', wer: ((p.firstName || '') + ' ' + p.name).trim(), zahl: m, ist: sp, age: p.age });
      });
      const to = (p.stats && p.stats.goals) || 0;
      MARKEN_TORE.forEach(function (m) {
        if (to >= m && to <= m + 1) raus.push({ art: 'tore', wer: ((p.firstName || '') + ' ' + p.name).trim(), zahl: m, ist: to, age: p.age });
      });
    });
    return raus.slice(0, 3);
  }

  function sammle() {
    if (typeof CLUB === 'undefined' || !CLUB || typeof LEAGUE === 'undefined' || !LEAGUE) return null;
    const grp = meineGruppe();
    if (!grp) return null;
    const tab = tabelleVon(grp.group.teams);
    const iMir = tab.findIndex(function (x) { return x.id === 'fcm'; });
    const me = tab[iMir] || {};
    const erg = eigeneErgebnisse();
    const kader = (typeof SQUAD !== 'undefined' ? SQUAD : []).filter(function (p) { return p && !p.onLoanAt; });
    const mitStats = kader.filter(function (p) { return p.stats; });
    // EXP ist ein `const` im Modulkopf und hängt NICHT an window — mit
    // `window.EXP` kam hier ein leeres Objekt heraus und die Zeitung verlor
    // Philosophie, Saisonziel und das echte Vorstandsvertrauen (fiel auf 50).
    const e = (typeof EXP !== 'undefined' && EXP && EXP.state) ? EXP.state() : {};
    const log = (CLUB._attendanceLog || []);
    const riv = rivale(grp);   // zuerst, damit das Trainerbeben ihn ausschließen kann

    return {
      verein: CLUB.name, kurz: CLUB.shortName || 'FCM',
      liga: CLUB.leagueName || (grp.group && grp.group.name) || 'Liga',
      saison: LEAGUE.season, jahr: (LEAGUE.startYear + LEAGUE.season - 1) + '/' + String(LEAGUE.startYear + LEAGUE.season).slice(2),
      spieltag: LEAGUE.matchday || 0, woche: LEAGUE.week || 0,
      platz: iMir + 1, ausVon: tab.length,
      punkte: me.pts || 0, tore: me.gf || 0, gegentore: me.ga || 0,
      bilanz: { s: me.w || 0, u: me.d || 0, n: me.l || 0 },
      zielPlatz: (e.seasonGoals && e.seasonGoals.tablePosition) || null,
      ueberMir: iMir > 0 ? { n: tab[iMir - 1].name, p: tab[iMir - 1].pts || 0 } : null,
      unterMir: iMir >= 0 && iMir < tab.length - 1 ? { n: tab[iMir + 1].name, p: tab[iMir + 1].pts || 0 } : null,
      tabelle: tab.slice(0, 8).map(function (t, i) { return { pl: i + 1, n: t.name, p: t.pts || 0, ich: t.id === 'fcm' }; }),
      letztesSpiel: erg[0] || null,
      ergebnisse: erg.map(function (x) { return x.art; }),
      torjaeger: mitStats.filter(function (p) { return (p.stats.goals || 0) > 0; })
        .sort(function (a, b) { return b.stats.goals - a.stats.goals; }).slice(0, 3)
        .map(function (p) { return { n: ((p.firstName || '') + ' ' + p.name).trim(), g: p.stats.goals,
                                     a: p.stats.assists || 0, apps: p.stats.apps || 0,
                                     note: p.stats.avgRating || 0, age: p.age }; }),
      beste: mitStats.filter(function (p) { return (p.stats.apps || 0) >= 3; })
        .sort(function (a, b) { return (b.stats.avgRating || 0) - (a.stats.avgRating || 0); }).slice(0, 3)
        .map(function (p) { return { n: ((p.firstName || '') + ' ' + p.name).trim(), note: p.stats.avgRating || 0,
                                     pos: p.pos, age: p.age }; }),
      probleme: kader.filter(function (p) {
          return (typeof isInjured === 'function' && isInjured(p)) || (typeof isSuspended === 'function' && isSuspended(p));
        }).slice(0, 4).map(function (p) {
          return { wer: ((p.firstName || '').charAt(0) ? p.firstName.charAt(0) + '. ' : '') + p.name,
                   art: (typeof isInjured === 'function' && isInjured(p)) ? 'Verletzung' : 'Sperre' };
        }),
      vertrauen: e.boardSatisfaction != null ? e.boardSatisfaction : 50,
      fans: e.fanSatisfaction != null ? e.fanSatisfaction : 50,
      philosophie: (e.philosophyId && EXP.PHILOSOPHIES[e.philosophyId] && EXP.PHILOSOPHIES[e.philosophyId].label) || null,
      zuschauer: log.length ? Math.round(log.reduce(function (s, x) { return s + (x.a || 0); }, 0) / log.length) : 0,
      kapazitaet: (typeof stadiumCapacityForLevel === 'function' && CLUB.facilities)
                  ? stadiumCapacityForLevel(CLUB.facilities.stadium) : (CLUB.stadiumCapacity || 0),
      budget: CLUB.budget || 0,
      bundesliga: tierTabelle('bundesliga', 5),
      liga3: tierTabelle('liga3', 3),
      cl: europaDaten('cl'), el: europaDaten('el'),
      transfers: transferZeilen(), freie: freieSpieler(),
      entscheidung: entscheidungDerWoche(),
      // — neue Rubriken —
      ultras: (e.fanFactions && e.fanFactions.ultras) != null ? e.fanFactions.ultras : 50,
      eventFans: (e.fanFactions && e.fanFactions.eventFans) != null ? e.fanFactions.eventFans : 50,
      rivale: riv,
      beben: trainerBeben(grp, riv && riv.id),
      jubilaeen: jubilaeen(kader),
      chronik: (CLUB.chronicle || []).slice(-1)[0] || null,
      // Rückblick in der ERSTEN Ausgabe der neuen Saison, nicht in der letzten
      // der alten: `seasonFullyComplete` ist am eigenen Saisonende noch false
      // (die NPC-Spiele werden erst danach nachgeholt) und die Chronik ist noch
      // nicht geschrieben — gemessen erschien die Bilanz in 180 Ausgaben KEIN
      // einziges Mal. Am Saisonanfang liegen beide Angaben vollständig vor,
      // und eine Wochenzeitung blickt ohnehin zurück.
      rueckblick: (LEAGUE.matchday || 0) <= 1 && (CLUB.chronicle || []).length > 0,
      naechster: (function () {
        try {
          const nf = fcmNextFixture(LEAGUE);
          if (!nf) return null;
          const opp = grp.group.teams.filter(function (t) { return t.id === nf.opponentId; })[0];
          if (!opp) return null;
          const pl = tab.findIndex(function (x) { return x.id === opp.id; }) + 1;
          return { n: opp.name, heim: !!nf.isHome, platz: pl, pts: opp.pts || 0,
                   ovr: opp.ovr || 0, form: opp.form || [] };
        } catch (e2) { return null; }
      })()
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2) MUSTERERKENNUNG
  // ═══════════════════════════════════════════════════════════════════════════
  function analyse(d) {
    const e = d.ergebnisse;
    let serie = 0;
    if (e.length) { serie = 1; for (let i = 1; i < e.length; i++) { if (e[i] === e[0]) serie++; else break; } }
    const p5 = e.slice(0, 5).reduce(function (s, x) { return s + (x === 'S' ? 3 : x === 'U' ? 1 : 0); }, 0);
    const ls = d.letztesSpiel;
    const sp = Math.max(1, d.spieltag);
    return {
      serie: serie, serieArt: e[0] || null, punkte5: p5,
      form: p5 >= 11 ? 'blendend' : p5 >= 8 ? 'gut' : p5 >= 5 ? 'durchwachsen' : p5 >= 3 ? 'schwach' : 'desolat',
      formtief: e.length >= 3 && p5 <= 3,
      // SAISONPHASE: Vor dem ersten Anpfiff stehen alle bei null Punkten, die
      // Tabelle ist reine Alphabetik. „Über den Erwartungen auf Platz 3" nach
      // null Spielen war schlicht Unsinn — deshalb wird alles, was sich auf den
      // Tabellenplatz beruft, erst ab dem 3. Spieltag geschrieben.
      saisonstart: (d.spieltag || 0) === 0,
      fruehphase: (d.spieltag || 0) > 0 && (d.spieltag || 0) < 3,
      aussagekraft: (d.spieltag || 0) >= 3,
      abstand: (d.zielPlatz && (d.spieltag || 0) >= 3) ? d.platz - d.zielPlatz : 0,
      tordifferenz: d.tore - d.gegentore,
      abwehrLoch: d.gegentore / sp > 2.2,
      harmlos: d.tore / sp < 1.0,
      auslastung: d.kapazitaet ? d.zuschauer / d.kapazitaet : 0,
      gewonnen: ls ? ls.eigene > ls.fremde : false,
      unentschieden: ls ? ls.eigene === ls.fremde : false,
      deutlich: ls ? Math.abs(ls.eigene - ls.fremde) >= 3 : false
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3) TEXTE
  // ═══════════════════════════════════════════════════════════════════════════
  function schlagzeile(d, a) {
    const g = d.letztesSpiel;
    if (a.saisonstart) return w(
      'Alles auf Anfang', 'Die Stunde null', 'Bereit für den ersten Anpfiff',
      'Neue Saison, alte Fragen', 'Der ' + d.kurz + ' vor dem Start',
      'Was kommt, weiß keiner', 'Aufbruch ohne Netz',
      d.naechster ? 'Zum Auftakt gegen ' + d.naechster.n : 'Die Saison beginnt');
    if (!g) return w('Die Woche ohne Spiel', 'Ruhe vor dem Sturm', 'Pause im Spielplan',
      'Zeit zum Durchatmen', 'Spielfrei — und trotzdem viel zu tun');
    const erg = g.eigene + ':' + g.fremde;
    if (a.gewonnen && a.deutlich) return w('Schützenfest gegen ' + g.gegner, d.kurz + ' demontiert ' + g.gegner,
      'Klare Sache: ' + erg, 'Ein Fest in ' + erg, g.gegner + ' ohne Gegenwehr', 'Ansage mit ' + erg,
      'So deutlich war lange nichts');
    if (a.gewonnen && a.serie >= 3) return w('Der Lauf geht weiter', gross(zahlwort(a.serie)) + ' Siege in Folge',
      'Kein Halten mehr', 'Die Serie hält', 'Und wieder drei Punkte', 'Wer soll sie stoppen?');
    if (a.gewonnen) return w('Dreier gegen ' + g.gegner, d.kurz + ' bleibt dran', 'Wichtiger Sieg zur rechten Zeit',
      erg + ' — Auftrag erfüllt', 'Knapp, aber verdient', 'Drei Punkte, die zählen', 'Sieg mit Arbeit');
    if (a.unentschieden) return w('Teilung der Punkte', 'Ein Punkt, mehr nicht', 'Remis ohne Sieger',
      'Unentschieden — und unzufrieden', erg + ' und viele offene Fragen', 'Aufgeteilt', 'Weder Fisch noch Fleisch');
    if (a.deutlich) return w('Debakel gegen ' + g.gegner, erg + ' — ein Offenbarungseid',
      'Untergang in ' + (g.heim ? 'eigener Halle' : 'der Fremde'), 'Auseinandergenommen', 'Ein Abend zum Vergessen',
      erg + ' — mehr muss man nicht sagen');
    if (a.serieArt === 'N' && a.serie >= 3) return w('Die Krise wird ernst', gross(zahlwort(a.serie)) + ' Niederlagen am Stück',
      'Kein Ausweg in Sicht', 'Der freie Fall', 'Es hört nicht auf', 'Wann kommt die Wende?');
    return w('Niederlage gegen ' + g.gegner, 'Wieder nichts zu holen', erg + ' — zu wenig',
      'Leer ausgegangen', 'Am Ende fehlte alles', 'Kein Ertrag', 'Verloren — und wie');
  }

  function vorspann(d, a) {
    const g = d.letztesSpiel;
    const stand = 'Platz ' + d.platz + ' von ' + d.ausVon;
    if (a.saisonstart) {
      const gegner = d.naechster ? ' Zum Auftakt geht es ' + (d.naechster.heim ? 'zu Hause gegen ' : 'zu ') + esc(d.naechster.n) + '.' : '';
      return w(
        'Die Saison ist eröffnet, gespielt wurde noch nicht. Eine Tabelle gibt es formal, aussagen tut sie nichts.' + gegner,
        'Vor dem ersten Spieltag zählt nur eines: die Vorbereitung ist vorbei.' + gegner,
        'Null Spiele, null Punkte, null Erkenntnisse — so beginnt jede Saison.' + gegner,
        'Der ' + d.kurz + ' geht in eine neue Spielzeit. Alles davor war Theorie.' + gegner);
    }
    if (!g) return w(
      'Kein Pflichtspiel in dieser Woche. Der ' + d.kurz + ' steht auf ' + stand + '.',
      'Spielfrei. In der Tabelle bleibt es bei ' + stand + '.',
      'Eine Woche ohne Ergebnis — der ' + d.kurz + ' verharrt auf ' + stand + '.');
    const ort = g.heim ? 'vor eigenem Publikum' : 'bei ' + g.gegner;
    const erg = g.eigene + ':' + g.fremde;
    // gross() auf Varianten, die mit `ort` beginnen — sonst startet der
    // Vorspann klein („vor eigenem Publikum gab es …").
    // Der Tabellenplatz gehört nur in den Vorspann, wenn er etwas bedeutet.
    const lage = a.aussagekraft ? stand : (d.spieltag === 1 ? 'nach dem ersten Spieltag' : 'nach ' + zahlwort(d.spieltag) + ' Spieltagen');
    if (a.gewonnen) return w(
      erg + ' ' + ort + ' — der ' + d.kurz + ' nimmt die drei Punkte mit' + (a.aussagekraft ? ' und steht nun auf ' + stand : '') + '.',
      'Ein Sieg, der guttut: ' + erg + ' ' + ort + '.' + (a.aussagekraft ? ' In der Tabelle bedeutet das ' + stand + '.' : ''),
      gross(ort) + ' gab es ein ' + erg + '.' + (a.aussagekraft ? ' Der ' + d.kurz + ' klettert auf ' + stand + '.' : ' Ein guter Anfang.'),
      'Der ' + d.kurz + ' gewinnt ' + ort + ' mit ' + erg + ' — ' + lage + ' eine Ansage.');
    if (a.unentschieden) return w(
      erg + ' ' + ort + ' — ein Punkt, der weder hilft noch schadet.' + (a.aussagekraft ? ' ' + stand + '.' : ''),
      'Remis ' + ort + '.' + (a.aussagekraft ? ' Der ' + d.kurz + ' bleibt auf ' + stand + ' stehen.' : ' Mehr war nicht drin.'),
      'Geteilt ' + ort + ': ' + erg + '. Ein Ergebnis zum Achselzucken.');
    return w(
      erg + ' ' + ort + ' — der ' + d.kurz + ' geht leer aus' + (a.aussagekraft ? ' und steht auf ' + stand : '') + '.',
      'Nichts zu holen ' + ort + ': ' + erg + '.' + (a.aussagekraft ? ' Damit ' + stand + '.' : ''),
      gross(ort) + ' setzte es ein ' + erg + '.' + (a.aussagekraft ? ' Die Tabelle weist ' + stand + ' aus.' : ' Der Start ist misslungen.'),
      'Kein Ertrag ' + ort + ' — ' + erg + ' heißt es am Ende.');
  }

  function fliesstext(d, a) {
    const P = [], g = d.letztesSpiel;
    if (g) {
      let s1 = w('Es war ' + w('ein Nachmittag, der', 'ein Abend, der', 'eine Partie, die') + ' ' +
                 (a.gewonnen ? 'Mut macht' : 'Fragen aufwirft') + '. ',
                 'Wer ' + w('dabei war', 'zugesehen hat') + ', ' + w('nahm gemischte Gefühle mit', 'wusste danach mehr') + '. ', '');
      s1 += a.gewonnen
        ? w('Der ' + d.kurz + ' ' + w('machte früh Druck', 'kontrollierte das Geschehen', 'ließ wenig zu') + ' und ' + w('belohnte sich', 'wurde belohnt') + '.',
            esc(g.gegner) + ' ' + w('fand nie ins Spiel', 'blieb harmlos', 'wehrte sich, aber vergeblich') + '.')
        : w('Der ' + d.kurz + ' ' + w('fand nie richtig statt', 'blieb vieles schuldig', 'war einen Schritt zu langsam') + '.',
            esc(g.gegner) + ' ' + w('war schlicht zwingender', 'nutzte die Fehler eiskalt') + '.');
      if (a.serie >= 2) s1 += ' ' + (a.serieArt === 'S'
        ? w('Es ist bereits der ' + ordnungswort(a.serie) + ' Sieg nacheinander.', 'Damit stehen ' + zahlwort(a.serie) + ' Siege in Serie zu Buche.')
        : a.serieArt === 'N'
        ? w('Es ist die ' + ordnungswort(a.serie) + ' Niederlage nacheinander.', gross(zahlwort(a.serie)) + ' Pleiten am Stück — das nagt.')
        : gross(zahlwort(a.serie)) + ' Unentschieden in Folge.');
      P.push(s1);
    }

    // Vor dem 3. Spieltag wird der Tabellenplatz NICHT bewertet — er entsteht
    // sonst aus null Spielen. Stattdessen: das Ziel nennen und offen lassen.
    if (d.zielPlatz && !a.aussagekraft) {
      P.push(a.saisonstart
        ? w('Der Vorstand hat für diese Spielzeit Platz ' + d.zielPlatz + ' ausgegeben. Was das wert ist, entscheidet sich ab dem ersten Anpfiff — nicht vorher.',
            'Als Ziel steht Platz ' + d.zielPlatz + ' im Raum. Ob realistisch oder vermessen, weiß nach null Spielen niemand.',
            'Platz ' + d.zielPlatz + ' soll es werden. Mehr als eine Absichtserklärung ist das an diesem Punkt nicht.',
            'Die Vorgabe lautet Platz ' + d.zielPlatz + '. Gemessen wird sie erst, wenn Punkte auf dem Konto sind.')
        : w('Platz ' + d.zielPlatz + ' ist die Vorgabe. Nach ' + zahlwort(d.spieltag) + ' ' + (d.spieltag === 1 ? 'Spieltag' : 'Spieltagen') + ' lässt sich daraus noch nichts ablesen.',
            'Das Saisonziel heißt Platz ' + d.zielPlatz + '. So früh in der Runde sagt die Tabelle allerdings wenig.',
            'Zum ausgegebenen Ziel — Platz ' + d.zielPlatz + ' — verbietet sich nach ' + zahlwort(d.spieltag) + ' ' + (d.spieltag === 1 ? 'Spiel' : 'Spielen') + ' jede Prognose.'));
    } else if (d.zielPlatz) {
      let s2 = a.abstand > 4
        ? w('In der Tabelle klafft eine Lücke: Der Vorstand hat Platz ' + d.zielPlatz + ' ausgegeben, aktuell sind es ' + zahlwort(a.abstand) + ' Ränge mehr. ',
            'Das Saisonziel — Platz ' + d.zielPlatz + ' — ist ' + w('weit weg', 'in dieser Verfassung eine Ansage') + '. ')
        : a.abstand > 0
        ? w('Zum ausgegebenen Ziel, Platz ' + d.zielPlatz + ', ' + (a.abstand === 1 ? 'fehlt ein Rang' : 'fehlen ' + zahlwort(a.abstand) + ' Ränge') + '. ',
            'Platz ' + d.zielPlatz + ' soll es werden — noch ist der ' + d.kurz + ' ' + (a.abstand === 1 ? 'einen Platz' : zahlwort(a.abstand) + ' Plätze') + ' davon entfernt. ')
        : w('Der ' + d.kurz + ' liegt ' + w('über', 'vor') + ' der Vorgabe des Vorstands — Platz ' + d.zielPlatz + ' war gefordert. ',
            'Man übertrifft, was der Vorstand verlangt hat. ');
      if (d.ueberMir && d.unterMir) s2 += w(
        esc(d.ueberMir.n) + ' (' + d.ueberMir.p + ') liegt davor, ' + esc(d.unterMir.n) + ' (' + d.unterMir.p + ') lauert dahinter — es ist eng.',
        'Nach oben sind es wenige Zähler auf ' + esc(d.ueberMir.n) + ', nach unten drückt ' + esc(d.unterMir.n) + '.');
      P.push(s2);
    }

    const t = d.torjaeger[0];
    if (t) {
      let s3 = w('Einer ragt heraus: <b>' + esc(t.n) + '</b> steht bei ' + zahlwort(t.g) + ' ' + (t.g === 1 ? 'Treffer' : 'Treffern') + ' aus ' + zahlwort(t.apps) + ' Spielen',
                 '<b>' + esc(t.n) + '</b> trägt die Offensive — ' + zahlwort(t.g) + ' ' + (t.g === 1 ? 'Tor' : 'Tore') + ' in ' + zahlwort(t.apps) + ' Partien');
      // Numerus: bei einer Vorlage „eine weitere", sonst „drei weitere".
      s3 += t.a ? ' und legte ' + (t.a === 1 ? 'eine weitere' : zahlwort(t.a) + ' weitere') + ' auf. ' : '. ';
      s3 += t.note >= 8.5 ? w('Eine Durchschnittsnote von ' + t.note.toFixed(1) + ' spricht für sich. ', 'Note ' + t.note.toFixed(1) + ' — daran gibt es nichts zu deuteln. ')
          : t.note && t.note < 6.5 ? w('Die Note von ' + t.note.toFixed(1) + ' zeigt aber: Es läuft auch für ihn nicht rund. ', 'Note ' + t.note.toFixed(1) + ' — auch der Beste trifft es derzeit nicht. ') : '';
      const jung = d.beste.filter(function (b) { return b.age <= 21; })[0];
      if (jung) s3 += w('Auffällig auch <b>' + esc(jung.n) + '</b>, erst ' + jung.age + ' — Note ' + jung.note.toFixed(1) + '. Da wächst etwas heran.',
                        'Und mit <b>' + esc(jung.n) + '</b> (' + jung.age + ') drängt ein Talent nach vorn, Note ' + jung.note.toFixed(1) + '.');
      P.push(s3);
    }

    let s4 = '';
    if (d.probleme.length >= 2) s4 = w('Sorgen bereitet das Lazarett: ' + d.probleme.map(function (p) { return esc(p.wer); }).join(', ') + ' fehlen. ',
                                       'Die Personallage ist angespannt — ' + d.probleme.map(function (p) { return esc(p.wer) + ' (' + p.art + ')'; }).join(', ') + '. ');
    else if (d.probleme.length === 1) s4 = esc(d.probleme[0].wer) + ' fällt aus — ' + d.probleme[0].art + '. ';
    if (a.abwehrLoch) s4 += w('Und die Abwehr bleibt die offene Baustelle: ' + d.gegentore + ' Gegentore in ' + zahlwort(d.spieltag) + ' Spielen sind zu viele. ',
                              d.gegentore + ' Gegentore nach ' + zahlwort(d.spieltag) + ' Spieltagen — hinten muss sich etwas ändern. ');
    if (a.auslastung > 0.9) s4 += w('Immerhin: Das Stadion ist praktisch voll, ' + zahl(d.zuschauer) + ' kamen im Schnitt.', 'Die Ränge tragen: im Schnitt ' + zahl(d.zuschauer) + ' Zuschauer.');
    else if (a.auslastung && a.auslastung < 0.6) s4 += w('Auf den Rängen wird es derweil leerer — ' + zahl(d.zuschauer) + ' im Schnitt.', 'Nur noch ' + zahl(d.zuschauer) + ' Zuschauer kommen im Mittel.');
    if (s4) P.push(s4);

    // Zwei bis drei wechselnde Nebenthemen — sie sorgen dafür, dass zwei
    // Ausgaben mit ähnlichem Spielverlauf trotzdem verschieden aussehen.
    mischeThemen(nebenthemen(d, a), 2 + Math.floor(zufall() * 2)).forEach(function (t) { P.push(t); });

    const v = d.vertrauen;
    P.push(v < 30 ? w('Im Aufsichtsrat wird die Geduld dünn. Wer die Stimmung kennt, weiß: So geht das nicht mehr lange gut.', 'Der Vorstand schweigt öffentlich — hinter den Kulissen soll der Ton rauer geworden sein.')
        : v < 55 ? w('Der Vorstand hält still, aber die Bewertung läuft mit.', 'Aus der Chefetage heißt es, man beobachte die Entwicklung „aufmerksam".')
        : v < 80 ? w('Der Vorstand steht hinter der sportlichen Leitung — vorerst.', 'In der Führungsetage gibt man sich zufrieden, ohne zu jubeln.')
        :          w('Im Vorstand ist die Stimmung bestens. Der eingeschlagene Weg trägt.', 'Die Chefetage schwärmt — selten passte hier so vieles zusammen.'));
    return P;
  }

  // ── Rotierende Themen ─────────────────────────────────────────────────────
  // Bisher stand in jeder Ausgabe dieselbe Abfolge: Spielbericht, Ziel,
  // Torjäger, Lazarett, Vorstand. Hier kommt ein Vorrat an Nebenthemen dazu,
  // aus dem je Ausgabe zwei bis drei gezogen werden — was passt, wechselt mit
  // der Lage, und die Reihenfolge wechselt ohnehin.
  function mischeThemen(liste, anzahl) {
    const rest = liste.filter(function (x) { return !!x; });
    const raus = [];
    while (rest.length && raus.length < anzahl) {
      raus.push(rest.splice(Math.floor(zufall() * rest.length), 1)[0]);
    }
    return raus;
  }
  function nebenthemen(d, a) {
    const T = [];

    // Stadion und Ränge
    if (d.kapazitaet && d.zuschauer) {
      T.push(a.auslastung > 0.9
        ? w('Die Ränge sind der stille Trumpf: ' + zahl(d.zuschauer) + ' Zuschauer im Schnitt bei ' + zahl(d.kapazitaet) + ' Plätzen. Wer hier antritt, spürt das.',
            'Ausverkauft ist längst der Normalfall — ' + zahl(d.zuschauer) + ' kommen im Mittel. Diese Kulisse ist Geld wert, das in keiner Bilanz steht.')
        : a.auslastung < 0.55
        ? w('Auf den Rängen bleibt viel Platz: ' + zahl(d.zuschauer) + ' von ' + zahl(d.kapazitaet) + '. Ein Stadion, das halb leer wirkt, klingt auch halb leer.',
            'Nur ' + zahl(d.zuschauer) + ' Zuschauer im Schnitt. Die Lücken auf den Rängen sind kein Schönheitsfehler, sie sind ein Signal.')
        : w('Im Schnitt kommen ' + zahl(d.zuschauer) + ' Zuschauer — solide, mehr wäre möglich.',
            zahl(d.zuschauer) + ' im Mittel bei ' + zahl(d.kapazitaet) + ' Plätzen: Das Stadion atmet, voll ist anders.'));
    }

    // Kasse
    T.push(d.budget <= 0
      ? w('Ein Blick in die Kasse verdirbt die Laune: ' + euro(d.budget) + '. Handeln kann man so nicht, höchstens hoffen.',
          'Die Finanzen sind der eigentliche Gegner. ' + euro(d.budget) + ' im Transferbudget sind keine Verhandlungsposition.')
      : d.budget < 150000
      ? w('Finanziell bleibt es eng: ' + euro(d.budget) + ' stehen bereit. Für große Würfe reicht das nicht.',
          'Mit ' + euro(d.budget) + ' lässt sich flicken, nicht bauen.')
      : w('Immerhin die Kasse stimmt: ' + euro(d.budget) + ' sind verfügbar. Wer will, kann handeln.',
          euro(d.budget) + ' im Budget — der Verein ist handlungsfähig, wenn er will.'));

    // Torverhältnis / Spielweise
    if (a.aussagekraft) {
      if (a.harmlos) T.push(w(
        'Die Zahl, die wehtut: ' + d.tore + ' eigene Treffer in ' + zahlwort(d.spieltag) + ' Spielen. Wer so wenig trifft, muss hinten perfekt sein.',
        'Vorne fehlt der Zug zum Tor — ' + d.tore + ' Treffer sind zu wenig, um Spiele zu gewinnen.'));
      else if (a.tordifferenz >= 8) T.push(w(
        'Die Tordifferenz von ' + (a.tordifferenz > 0 ? '+' : '') + a.tordifferenz + ' ist mehr als Statistik: Diese Mannschaft gewinnt nicht nur, sie gewinnt deutlich.',
        d.tore + ':' + d.gegentore + ' Tore — das ist die Bilanz einer Mannschaft, die weiß, wohin sie will.'));
      else if (a.abwehrLoch) T.push(w(
        'Hinten bleibt es offen: ' + d.gegentore + ' Gegentore. Kein Angriff der Welt gleicht das dauerhaft aus.',
        d.gegentore + ' Gegentore in ' + zahlwort(d.spieltag) + ' Spielen — die Abwehr ist das Thema, alles andere ist Beiwerk.'));
    }

    // Kaderbreite / Lazarett
    if (d.probleme.length >= 3) T.push(w(
      'Das Lazarett füllt sich schneller, als der Kader es verkraftet. ' + zahlwort(d.probleme.length) + ' Ausfälle sind für diesen Verein keine Kleinigkeit.',
      'Mit ' + zahlwort(d.probleme.length) + ' Ausfällen wird jede Aufstellung zur Rechenaufgabe.'));

    // Nachwuchs
    const jung = d.beste.filter(function (b) { return b.age <= 21; })[0];
    if (jung) T.push(w(
      'Ein Name für die Zukunft: <b>' + esc(jung.n) + '</b>, ' + jung.age + ' Jahre, Note ' + jung.note.toFixed(1) + '. Solche Spieler macht man nicht, die lässt man wachsen.',
      'Dass <b>' + esc(jung.n) + '</b> mit ' + jung.age + ' schon zu den Besten zählt, sagt mehr über die Ausbildung als jede Broschüre.'));

    // Fanlager
    if (Math.abs((d.ultras || 50) - (d.eventFans || 50)) >= 20) T.push(w(
      'Die Fanlager driften auseinander: Ultras bei ' + d.ultras + ', die breite Anhängerschaft bei ' + d.eventFans + '. Zwei Kurven, zwei Meinungen.',
      'In der Kurve wird anders gedacht als auf der Gegengeraden — ' + d.ultras + ' zu ' + d.eventFans + '. Das hält kein Verein ewig aus.'));

    // Rivale
    if (d.rivale && a.aussagekraft) T.push(w(
      'Und immer im Augenwinkel: ' + esc(d.rivale.n) + ' steht bei ' + d.rivale.pts + ' Punkten. Man vergleicht sich, ob man will oder nicht.',
      'Der Blick geht zu ' + esc(d.rivale.n) + ' (' + d.rivale.pts + ' Punkte). Diese Rechnung macht hier jeder auf.'));

    // Nächster Gegner
    if (d.naechster) T.push(w(
      'Als Nächstes wartet ' + esc(d.naechster.n) + (d.naechster.heim ? ' zu Hause' : ' auswärts') + '. Auf dem Papier ' +
        (d.naechster.ovr >= 0 ? 'eine Aufgabe, die nichts geschenkt bekommt' : 'machbar') + '.',
      'Der nächste Gegner heißt ' + esc(d.naechster.n) + '. ' + (d.naechster.heim ? 'Immerhin daheim.' : 'Und das auswärts.')));

    return T;
  }

  function europaText(d) {
    if (!d.cl) return null;
    const P = [], s = d.cl.sensation;
    if (s) P.push(w(
      '<b>' + fl(s.sf) + esc(s.sieger) + '</b> hat in der Königsklasse für die Überraschung gesorgt: ' + s.erg + ' gegen ' + fl(s.vf) + esc(s.verlierer) +
        ', einen Gegner, der auf dem Papier ' + zahlwort(s.d) + ' Stärkepunkte über dem eigenen Niveau rangiert.',
      'Die Sensation gelang <b>' + fl(s.sf) + esc(s.sieger) + '</b> — ' + s.erg + ' gegen ' + fl(s.vf) + esc(s.verlierer) + ', den haushohen Favoriten.'));
    if (d.cl.tabelle.length >= 3) P.push(w(
      'An der Spitze stehen ' + d.cl.tabelle.slice(0, 3).map(function (t) { return fl(t.f) + esc(t.n); }).join(', ') + '.',
      'Die Tabellenspitze führen ' + fl(d.cl.tabelle[0].f) + esc(d.cl.tabelle[0].n) + ', ' + esc(d.cl.tabelle[1].n) + ' und ' + esc(d.cl.tabelle[2].n) + ' an.'));
    const dt = d.cl.tabelle.filter(function (t) { return t.l === 'Deutschland'; })[0];
    if (dt) P.push(w(
      'Aus deutscher Sicht: ' + fl(dt.f) + '<b>' + esc(dt.n) + '</b> ist bester Vertreter auf Rang ' + dt.pl + ' mit ' + dt.p + ' ' + (dt.p === 1 ? 'Punkt' : 'Punkten') +
        '. Insgesamt sind ' + zahlwort(d.cl.deutsche.length) + ' deutsche Klubs in der Königsklasse dabei.',
      gross(zahlwort(d.cl.deutsche.length)) + ' deutsche Klubs spielen Champions League — bester ist ' + fl(dt.f) + '<b>' + esc(dt.n) + '</b> auf Platz ' + dt.pl + '.'));
    const e = d.el && d.el.sensation;
    if (e) P.push(w(
      'In der Europa League schlug ' + fl(e.sf) + esc(e.sieger) + ' den Favoriten ' + fl(e.vf) + esc(e.verlierer) + ' mit ' + e.erg + '.',
      'Europa League: ' + fl(e.sf) + esc(e.sieger) + ' bezwang ' + fl(e.vf) + esc(e.verlierer) + ' ' + e.erg + ' — ' + zahlwort(e.d) + ' Stärkepunkte Unterschied, auf dem Platz zählte das nicht.'));
    // Der eigene Verein im Europapokal
    const ich = d.cl.tabelle.filter(function (t) { return t.isFcm; })[0];
    if (ich) P.push('<b>Und mittendrin der ' + d.kurz + ':</b> Rang ' + ich.pl + ' der Ligaphase mit ' + ich.p + ' ' + (ich.p === 1 ? 'Punkt' : 'Punkten') + '.');
    return P.length ? P : null;
  }

  function transferText(d) {
    const P = [];
    if (d.transfers.length) {
      P.push(w('Der auffälligste Wechsel der Woche: ', 'Auf dem Markt tat sich einiges. ', '') + esc(d.transfers[0]) + '.');
      if (d.transfers.length > 1)
        P.push('Außerdem: ' + d.transfers.slice(1, 3).map(esc).join(' · ') + '.');
    } else {
      P.push(w('Auf dem Transfermarkt blieb es diese Woche ruhig.', 'Keine nennenswerten Wechsel — der Markt hält den Atem an.'));
    }
    const f = d.freie[0];
    if (f) {
      // Flagge nur MIT Trennzeichen, wenn eine da ist — sonst klafft eine
      // doppelte Lücke im Satz („sticht  Paul Hartmann hervor").
      const fl = f.flagge ? f.flagge + ' ' : '';
      P.push(w(
        '<b>Aufgepasst, ' + d.kurz + ':</b> Ablösefrei zu haben ist ' + fl + '<b>' + esc(f.n) + '</b> — ' + f.pos + ', OVR ' + f.ovr + ', ' + f.age + ' Jahre. ' +
          (f.age >= 32 ? 'Das Alter schreckt ab, die Qualität nicht.' : 'Für diese Liga ein Wort.'),
        'Auf dem Markt der Vereinslosen sticht ' + fl + '<b>' + esc(f.n) + '</b> hervor (' + f.pos + ', OVR ' + f.ovr + ', ' + f.age + '). ' +
          (d.budget < 150000 ? 'Ob das Gehalt darstellbar ist, steht auf einem anderen Blatt.' : 'Ein Anruf könnte sich lohnen.')));
    }
    return P;
  }

  function ligenText(d) {
    const P = [], b = d.bundesliga, l = d.liga3;
    if (b.length) {
      P.push(w('In der Bundesliga führt ' + esc(b[0].n) + ' mit ' + b[0].p + ' Punkten (' + b[0].gf + ':' + b[0].ga + ').',
               esc(b[0].n) + ' steht an der Spitze der Bundesliga — ' + b[0].p + ' Punkte, Torverhältnis ' + b[0].gf + ':' + b[0].ga + '.'));
      // Überraschungsteam: weit oben trotz schwächerem Kader
      const stark = b.reduce(function (m, t) { return Math.max(m, t.ovr || 0); }, 0);
      const ueber = b.filter(function (t) { return t.pl <= 3 && t.ovr && t.ovr <= stark - 5; })[0];
      if (ueber) P.push(w(
        'Für Aufsehen sorgt <b>' + esc(ueber.n) + '</b>: Platz ' + ueber.pl + ' mit ' + ueber.p + ' Punkten, obwohl der Kader nicht zu den stärksten zählt.',
        '<b>' + esc(ueber.n) + '</b> mischt die Liga auf und steht auf Rang ' + ueber.pl + ' — mit einem Kader, dem das kaum jemand zugetraut hätte.'));
    }
    if (l.length >= 3) P.push(w(
      'In der 3. Liga führt ' + esc(l[0].n) + ' (' + l[0].p + ' Punkte) vor ' + esc(l[1].n) + ' und ' + esc(l[2].n) + '.',
      '3. Liga: ' + esc(l[0].n) + ' setzte sich mit ' + l[0].p + ' Punkten an die Spitze, dahinter ' + esc(l[1].n) + ' und ' + esc(l[2].n) + '.'));
    return P.length ? P : null;
  }

  // ── Taktik-Analyse: nur im Formtief, passend zur echten Schwäche ───────────
  function taktikTipp(d, a) {
    if (!a.formtief) return null;
    // Schon in dieser Woche umgesetzt? Dann kein neuer Tipp.
    if (CLUB._zeitungTipp && CLUB._zeitungTipp.woche === d.woche && CLUB._zeitungTipp.saison === d.saison) return { erledigt: true };
    if (a.abwehrLoch) return {
      art: 'defensiv',
      kopf: w('Die Abwehr braucht einen Anker', 'Hinten brennt es lichterloh', 'Zu offen, zu leicht'),
      text: d.gegentore + ' Gegentore in ' + zahlwort(d.spieltag) + ' Spielen. Unsere Beobachtung: Die Kette steht zu hoch, während das Mittelfeld nachrückt statt abzusichern. ' +
            w('Ein tieferer Block und ein abkippender Sechser wären das Mittel der Wahl.', 'Wer defensiver steht und die Räume hinter der Kette schließt, nimmt dem Gegner das Wichtigste.'),
      knopf: 'Mannschaft defensiver einstellen'
    };
    if (a.harmlos) return {
      art: 'offensiv',
      kopf: w('Vorne fehlt der Mut', 'Zu harmlos für die eigenen Ansprüche', 'Wo bleiben die Tore?'),
      text: 'Nur ' + zahlwort(d.tore) + ' Treffer in ' + zahlwort(d.spieltag) + ' Partien. Die Mannschaft spielt sich fest, statt die Flügel zu nutzen. ' +
            w('Mehr Tempo über außen und früheres Anlaufen könnten den Knoten lösen.', 'Ein offensiveres Pressing würde den Gegner zu Fehlern zwingen.'),
      knopf: 'Mannschaft offensiver einstellen'
    };
    return {
      art: 'kopf',
      kopf: w('Der Kopf spielt mit', 'Eine Serie, die lähmt', 'Es fehlt der Glaube'),
      text: zahlwort(Math.max(1, a.serie)) + ' ' + (a.serie === 1 ? 'Spiel' : 'Spiele') + ' ohne Sieg hinterlassen Spuren. Technisch ist wenig zu bemängeln — es ist die Unsicherheit, die jeden Fehlpass verdoppelt. ' +
            w('Eine klare Ansage wäre jetzt mehr wert als jede Umstellung.', 'Zurück zum einfachen Spiel, zurück zur gewohnten Ordnung.'),
      knopf: 'Rückendeckung geben'
    };
  }

  // Der Tipp wirkt über die BESTEHENDE Moral-Mechanik — kein Eingriff in die
  // Match-Engine, damit daraus kein Dauer-Bonus wird. Einmal pro Woche.
  window.zeitungTippUmsetzen = function () {
    try {
      if (typeof CLUB === 'undefined') return;
      const woche = LEAGUE.week, saison = LEAGUE.season;
      if (CLUB._zeitungTipp && CLUB._zeitungTipp.woche === woche && CLUB._zeitungTipp.saison === saison) return;
      CLUB._zeitungTipp = { woche: woche, saison: saison };
      let n = 0;
      (typeof SQUAD !== 'undefined' ? SQUAD : []).forEach(function (p) {
        if (!p || p.onLoanAt) return;
        p.morale = Math.max(0, Math.min(100, (p.morale != null ? p.morale : 60) + MORAL_BONUS));
        n++;
      });
      // Fans: über EXP, damit die bestehende Zufriedenheitsrechnung greift.
      try {
        const e = EXP.state();
        if (e && e.fanFactions) {
          e.fanFactions.eventFans = Math.max(0, Math.min(100, (e.fanFactions.eventFans || 50) + FANS_BONUS));
        }
      } catch (e) {}
      if (typeof addNews === 'function')
        addNews('club', '📰 Umstellung nach Presse-Analyse',
          'Die Mannschaft wurde neu eingestellt. ' + n + ' Spieler mit spürbar besserer Stimmung (Moral +' + MORAL_BONUS + '), die Fans schöpfen Hoffnung.');
      try { if (typeof renderAll === 'function') renderAll(); } catch (e) {}
      renderZeitungTab();
      try { if (typeof saveGameState === 'function') saveGameState(); } catch (e) {}
    } catch (err) { console.warn('[Anstoss] Tipp', err); }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 3b) DER KOMMENTAR — eine Stimme mit Haltung
  // ═══════════════════════════════════════════════════════════════════════════
  // Der Kolumnist bekommt einen festen Namen (aus dem Vereinsnamen abgeleitet,
  // damit er über die Karriere derselbe bleibt) und eine klare Linie: Er misst
  // den Verein an dem, was er selbst versprochen hat.
  const K_VOR = ['Hendrik', 'Anneliese', 'Jürgen', 'Sabine', 'Ottmar', 'Christa', 'Volker', 'Marlies'];
  const K_NACH = ['Reineke', 'Vollmer', 'Steinkamp', 'Brehme-Lang', 'Uhlig', 'Faber', 'Kranz', 'Ohlert'];
  function kolumnist() {
    const s = (typeof CLUB !== 'undefined' && CLUB.name) || 'FC';
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 37 + s.charCodeAt(i)) >>> 0;
    return K_VOR[(h >>> 3) % K_VOR.length] + ' ' + K_NACH[(h >>> 11) % K_NACH.length];
  }

  function kommentar(d, a) {
    const P = [];
    // Aufhänger: die letzte Entscheidung — oder die Tabellenlage.
    if (d.entscheidung) {
      P.push(w(
        'Man kann über „' + esc(d.entscheidung.titel) + '" geteilter Meinung sein. Entschieden wurde: ' +
          esc(d.entscheidung.wahl) + '. ' + w('Das war mutig.', 'Das war bequem.', 'Das war zumindest konsequent.'),
        'Diese Woche stand „' + esc(d.entscheidung.titel) + '" an. Die Vereinsführung wählte: ' + esc(d.entscheidung.wahl) + '.'));
    }
    // Philosophie-Treue: Der Kolumnist misst am eigenen Anspruch.
    if (d.philosophie) {
      const jung = d.beste.filter(function (b) { return b.age <= 21; }).length;
      if (/Jugend|Cantera|Nachwuchs/i.test(d.philosophie)) {
        P.push(jung >= 1
          ? w('Immerhin: Der Kurs „' + esc(d.philosophie) + '" ist mehr als ein Wort auf dem Briefkopf — die Jungen spielen.',
              'Wer „' + esc(d.philosophie) + '" ausruft, muss die Jugend auch bringen. Das geschieht hier.')
          : w('Wer sich „' + esc(d.philosophie) + '" auf die Fahne schreibt und dann keinen einzigen Zwanzigjährigen unter den Besten hat, ' +
              'sollte die Fahne einholen.',
              'Von „' + esc(d.philosophie) + '" ist auf dem Platz derzeit wenig zu sehen. Das fällt auf.'));
      } else if (/Spar|Minimal/i.test(d.philosophie)) {
        P.push(d.budget > 0
          ? w('Sparsamkeit ist keine Schande. Solange sie nicht zur Ausrede wird.',
              'Der Kurs „' + esc(d.philosophie) + '" wird eingehalten — das Konto steht bei ' + euro(d.budget) + '.')
          : w('Ausgerechnet der Sparkurs endet im Minus. Das muss man erst einmal hinbekommen.',
              'Ein Sparkurs mit leerer Kasse ist kein Kurs, sondern ein Zustand.'));
      } else {
        P.push(w('Der Kurs heißt „' + esc(d.philosophie) + '". Ob er trägt, entscheidet sich nicht im Ausschuss, sondern samstags.',
                 'Was „' + esc(d.philosophie) + '" wert ist, zeigt die Tabelle — nicht die Absichtserklärung.'));
      }
    }
    // Schluss: Bewertung der Gesamtlage — aber nicht über eine Tabelle urteilen,
    // die noch keine ist.
    P.push(
      !a.aussagekraft ? w('Urteile hebt sich diese Redaktion für den Moment auf. Es wurde noch nichts gespielt, was eines rechtfertigt.',
                          'Alles Weitere klärt der Platz. Bis dahin: abwarten.',
                          'Wir halten uns zurück. Wer nach ' + (a.saisonstart ? 'null Spielen' : zahlwort(d.spieltag) + ' Spielen') + ' schon alles weiß, weiß gar nichts.',
                          'Prognosen sind billig. Punkte nicht. Fangen wir mit den Punkten an.')
    : a.abstand > 4 ? w('Und ja: ' + zahlwort(a.abstand) + ' Ränge hinter der eigenen Vorgabe ist kein Betriebsunfall mehr, sondern eine Ansage.',
                        'Der Abstand zum ausgegebenen Ziel wächst. Irgendwann wird aus einer Delle ein Loch.')
    : a.abstand > 0 ? w('Zum Ziel fehlt nicht viel. Genau deshalb wäre jetzt der falsche Moment, sich zufriedenzugeben.',
                        'Es reicht noch. Aber es reicht eben nur noch.')
    : d.vertrauen >= 75 ? w('Man muss der Vereinsführung lassen: Es läuft. Das darf man auch einmal schreiben.',
                            'Selten war hier so wenig zu meckern. Genießen wir es, es hält nie lange.')
    : w('Die Richtung stimmt. Der Rest ist Arbeit.', 'Nicht schlecht. Nicht mehr, aber auch nicht weniger.'));
    return P;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3c) LESERBRIEFE — die Fanstimmung wird hörbar
  // ═══════════════════════════════════════════════════════════════════════════
  // Ultras und Eventfans sind im Spiel getrennte Größen — sie schreiben deshalb
  // auch getrennt und widersprechen sich, wenn die Werte auseinanderlaufen.
  const BRIEF_NAMEN = ['M. Kollmann', 'T. Reisig', 'Familie Wendt', 'S. Barnick', 'H.-J. Dietz',
                       'K. Ostrowski', 'B. Lemke', 'A. Thiele', 'Fanclub Nordkurve', 'R. Sablewski'];
  function briefName(seed) {
    return BRIEF_NAMEN[Math.abs(seed) % BRIEF_NAMEN.length];
  }
  function leserbriefe(d, a) {
    const B = [];
    const seed = (d.woche || 1) * 7 + (d.saison || 1) * 13;
    // Ultras
    if (d.ultras < 35) B.push({ von: briefName(seed),
      text: w('Wir stehen jede Woche in der Kurve, bei jedem Wetter. Was wir dafür zurückbekommen, ist zu wenig. So nicht.',
              'Diese Vereinsführung hat den Bezug zu denen verloren, die den Verein tragen. Wir bleiben — aber wir schweigen nicht.') });
    else if (d.ultras > 80) B.push({ von: briefName(seed),
      text: w('Endlich wieder eine Mannschaft, für die man gerne heiser wird. Weiter so!',
              'Man merkt, dass hier jemand versteht, worum es geht. Danke dafür.') });
    // Eventfans / Preise
    if (d.eventFans < 40) B.push({ von: briefName(seed + 3),
      text: w('Was das inzwischen kostet, ist für eine Familie kaum noch zu stemmen. Schade um den Samstag.',
              'Wir kommen seit Jahren mit den Kindern. Bei diesen Preisen überlegen wir uns das künftig.') });
    else if (a.auslastung > 0.9) B.push({ von: briefName(seed + 3),
      text: w('Volles Haus, gute Stimmung — so macht das Spaß. Bitte an den Karten nichts ändern.',
              'Wir kriegen kaum noch Tickets. Ein Luxusproblem, aber eins.') });
    // Sportliches
    if (a.formtief) B.push({ von: briefName(seed + 6),
      text: w('Fünf Spiele ohne Sieg. Irgendwann muss man doch mal etwas ändern, oder sieht das nur ich so?',
              'Ich will gar nicht meckern. Ich will nur wissen, wann es wieder aufwärtsgeht.') });
    else if (a.serieArt === 'S' && a.serie >= 3) B.push({ von: briefName(seed + 6),
      text: w('Seit Wochen ungeschlagen — und trotzdem redet keiner drüber. Typisch für diesen Verein.',
              'Man traut sich ja kaum, es zu sagen: Aber das macht gerade richtig Freude.') });
    // Die Bedingungen oben greifen nicht immer — gemessen blieb genau EIN Brief
    // übrig, was für eine Leserbriefspalte zu dünn ist. Mit allgemeinen Zuschriften
    // auffüllen, die zur Lage passen, bis mindestens zwei stehen.
    const FUELLER = [
      { wenn: function () { return d.torjaeger[0]; },
        text: function () { return w('Was ' + d.torjaeger[0].n + ' da vorne macht, ist aller Ehren wert. Bitte gut behandeln, den Mann.',
                                     'Endlich mal wieder ein Stürmer, bei dem man sitzen bleibt, wenn er den Ball hat.'); } },
      { wenn: function () { return d.probleme.length >= 2; },
        text: function () { return w('Halbe Mannschaft im Lazarett — vielleicht sollte man mal über die Trainingssteuerung reden.',
                                     'So viele Ausfälle können kein Zufall mehr sein.'); } },
      { wenn: function () { return d.budget < 120000; },
        text: function () { return w('Man muss kein Kaufmann sein, um zu sehen, dass da nicht mehr viel Luft ist.',
                                     'Von außen sieht es so aus, als würde jeder Euro zweimal umgedreht. Muss ja auch.'); } },
      { wenn: function () { return d.zuschauer > 0; },
        text: function () { return w('Die Anfahrt lohnt sich wieder, das sage ich auch meinen Kollegen.',
                                     'Beim letzten Heimspiel war die Stimmung so gut wie lange nicht.'); } },
      // ZWEI allgemeine Zuschriften am Ende, nicht eine: Zu Saisonbeginn ist
      // noch nichts passiert (keine Torschützen, keine Ausfälle, keine
      // Zuschauerzahlen) — dann griff nur der letzte Füller und es blieb bei
      // einem einzigen Brief. Gemessen in Woche 1 bis 5 jeder neuen Karriere.
      { wenn: function () { return true; },
        text: function () { return w('Alles in Ordnung soweit. Nur die Bratwurst am Block C könnte wieder heißer sein.',
                                     'Man liest hier viel Kritik. Ich finde: Es läuft doch ganz ordentlich.',
                                     'Ich lese diese Zeitung seit dreißig Jahren. Manches ändert sich nie — zum Glück.'); } },
      { wenn: function () { return true; },
        text: function () { return w('Neue Saison, neues Hoffen. Man kennt das ja.',
                                     'Ich wünsche der Mannschaft eine verletzungsfreie Runde. Alles andere kommt von allein.',
                                     'Hauptsache, wir spielen wieder Fußball. Der Rest findet sich.',
                                     'Man sollte der Vereinsführung Zeit geben. Sagt sich leicht, ich weiß.'); } }
    ];
    let k = 0;
    while (B.length < 2 && k < FUELLER.length) {
      const f = FUELLER[k++];
      try { if (f.wenn()) B.push({ von: briefName(seed + 9 + k * 4), text: f.text() }); } catch (e) {}
    }
    return B.slice(0, 3);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3d) VORSCHAU, RIVALE, JUBILÄEN, TRAINERBEBEN, SAISONBILANZ
  // ═══════════════════════════════════════════════════════════════════════════
  function vorschauText(d) {
    const n = d.naechster;
    if (!n) return null;
    const wo = n.heim ? 'im eigenen Stadion' : 'auswärts';
    const stark = n.platz <= 3, schwach = n.platz >= d.ausVon - 3;
    const formPkt = (n.form || []).slice(-5).reduce(function (s, x) { return s + (x === 'W' ? 3 : x === 'D' ? 1 : 0); }, 0);
    let t = w('Als Nächstes wartet ' + wo + ' <b>' + esc(n.n) + '</b> (Platz ' + n.platz + ', ' + n.pts + ' Punkte). ',
              'Der nächste Gegner heißt <b>' + esc(n.n) + '</b> — ' + wo + ', Tabellenplatz ' + n.platz + '. ');
    t += stark ? w('Ein Brocken. Wer hier etwas mitnimmt, hat sich das verdient.', 'Schwerer geht es kaum.')
       : schwach ? w('Auf dem Papier machbar — was in dieser Liga wenig heißt.', 'Ein Gegner, gegen den man punkten muss.')
       : w('Eine Partie auf Augenhöhe.', 'Gut ausbalanciert, das könnte eng werden.');
    if ((n.form || []).length >= 3)
      t += ' ' + (formPkt >= 9 ? w('Zuletzt war ' + esc(n.n) + ' kaum zu schlagen.', esc(n.n) + ' kommt mit breiter Brust.')
                 : formPkt <= 3 ? w('Allerdings steckt ' + esc(n.n) + ' selbst in einer Schwächephase.', esc(n.n) + ' wartet seinerseits auf einen Befreiungsschlag.')
                 : w('Die Form des Gegners ist wechselhaft.', esc(n.n) + ' schwankt zuletzt.'));
    return t;
  }

  function rivalenText(d) {
    const r = d.rivale;
    if (!r) return null;
    const diff = r.pts - d.punkte;
    let t = w('Ein Blick auf <b>' + esc(r.n) + '</b>, den ewigen Gradmesser: ',
              'Und was macht <b>' + esc(r.n) + '</b>? ');
    t += diff > 3 ? w('Sie liegen ' + zahlwort(Math.abs(diff)) + ' Punkte vor uns. Das schmerzt mehr als jede Tabelle.',
                      esc(r.n) + ' zieht davon — ' + Math.abs(diff) + ' Punkte Vorsprung.')
       : diff < -3 ? w('Wir liegen ' + zahlwort(Math.abs(diff)) + ' Punkte vor ihnen. Man gönnt sich ja sonst nichts.',
                       'Immerhin: ' + Math.abs(diff) + ' Punkte Vorsprung auf den Rivalen.')
       : w('Punktgleich, wie so oft. Diese Rechnung wird erst im Mai gemacht.',
           'Es trennt sie kaum etwas von uns — das war schon immer so.');
    if (r.seit && d.saison > r.seit) t += ' ' + w('Seit ' + zahlwort(d.saison - r.seit) + ' Jahren messen wir uns an ihnen.',
                                                  'Diese Rivalität begleitet uns nun die ' + ordnungswort(d.saison - r.seit + 1) + ' Saison.');
    return t;
  }

  function jubilaeumText(d) {
    if (!d.jubilaeen.length) return null;
    const j = d.jubilaeen[0];
    if (j.art === 'spiele') return w(
      '<b>' + esc(j.wer) + '</b> hat die Marke von ' + j.zahl + ' Pflichtspielen erreicht. ' +
        (j.zahl >= 200 ? 'Eine Zahl, die in diesem Verein nicht viele erreichen.' : 'Ein Wort der Anerkennung ist das wert.'),
      zahl(j.zahl) + ' Pflichtspiele: <b>' + esc(j.wer) + '</b> (' + j.age + ') hat eine runde Marke voll gemacht.');
    return w(
      '<b>' + esc(j.wer) + '</b> steht bei ' + j.zahl + ' Saisontoren. ' + (j.zahl >= 50 ? 'Das ist Vereinsgeschichte.' : 'Ein Ausrufezeichen.'),
      'Torjubiläum: <b>' + esc(j.wer) + '</b> hat den ' + j.zahl + '. Treffer erzielt.');
  }

  function bebenText(d) {
    const b = d.beben;
    if (!b) return null;
    return w(
      'Bei <b>' + esc(b.n) + '</b> wird es unruhig: Platz ' + b.pl + ' mit einem Kader, der für deutlich mehr gebaut wurde. ' +
        w('Hinter den Kulissen soll man bereits über Konsequenzen sprechen.', 'Die Geduld dort dürfte endlich sein.'),
      '<b>' + esc(b.n) + '</b> steckt in der Krise — Rang ' + b.pl + ', obwohl kaum ein Kader der Liga besser besetzt ist. ' +
        w('In der Branche wird bereits über die Trainerfrage geredet.', 'Solche Konstellationen enden selten ohne Wechsel.'));
  }

  function saisonBilanz(d) {
    if (!d.rueckblick || !d.chronik) return null;
    const c = d.chronik;
    const P = [];
    P.push(w(
      'Die abgelaufene Saison ' + esc(c.label) + ' endete auf <b>Platz ' + c.pos + '</b> — ' + c.w + ' Siege, ' + c.d + ' Remis, ' + c.l + ' Niederlagen, ' + c.pts + ' Punkte.',
      'Abgerechnet wurde am Schluss: Platz ' + c.pos + ' in ' + esc(c.leagueName) + ', ' + c.pts + ' Punkte aus ' + c.played + ' Spielen.'));
    if (c.topScorer) P.push(w(
      'Bester Torschütze war <b>' + esc(c.topScorer.name) + '</b> mit ' + c.topScorer.goals + ' Treffern' +
        (c.topAssist ? ', die meisten Vorlagen kamen von ' + esc(c.topAssist.name) + ' (' + c.topAssist.assists + ')' : '') + '.',
      '<b>' + esc(c.topScorer.name) + '</b> traf ' + c.topScorer.goals + '-mal und war damit der auffälligste Angreifer der Saison.'));
    if (c.att) {
      // „Der Pokal endete: nicht dabei." liest sich schief — den Fall trennen.
      const pokal = /nicht dabei|ohne Teilnahme|^-?$/i.test(c.cup || '')
        ? 'Im Pokal war der Verein nicht vertreten.'
        : 'Im Pokal war Schluss: ' + esc(c.cup) + '.';
      P.push('Im Schnitt kamen ' + zahl(c.att) + ' Zuschauer. ' + pokal);
    }
    return P;
  }

  function kurzmeldungen(d, a) {
    const m = [];
    if (d.probleme.length) m.push('<b>Lazarett.</b> ' + d.probleme.map(function (p) { return esc(p.wer) + ' — ' + p.art; }).join('. ') + '.');
    const t = d.torjaeger[0];
    if (t) m.push('<b>Torjägerliste.</b> ' + esc(t.n) + ' führt intern mit ' + t.g + ' Treffern' +
                  (d.torjaeger[1] ? ', vor ' + esc(d.torjaeger[1].n) + ' (' + d.torjaeger[1].g + ')' : '') + '.');
    m.push('<b>Kasse.</b> ' + euro(d.budget) + ' verfügbar. ' +
           (d.budget < 150000 ? w('Viel Spielraum ist das nicht.', 'Große Sprünge sind so nicht drin.')
                              : w('Damit lässt sich arbeiten.', 'Ein Polster ist vorhanden.')));
    if (d.kapazitaet) m.push('<b>Zuschauer.</b> ' + zahl(d.zuschauer) + ' im Schnitt bei ' + zahl(d.kapazitaet) + ' Plätzen — ' + Math.round(a.auslastung * 100) + ' Prozent.');
    if (d.philosophie) m.push('<b>Kurs.</b> Philosophie „' + esc(d.philosophie) + '". Fanstimmung ' + d.fans + '/100.');
    // Zusätzliche Meldungen, damit der Kasten nicht jede Woche identisch ist.
    if (d.jubilaeen && d.jubilaeen.length) {
      const j = d.jubilaeen[0];
      m.push('<b>Jubiläum.</b> ' + esc(j.wer) + ' bei ' + j.zahl + ' ' + (j.art === 'tore' ? 'Toren' : 'Pflichtspielen') + '.');
    }
    if (d.rivale) m.push('<b>Der Rivale.</b> ' + esc(d.rivale.n) + ' steht bei ' + d.rivale.pts + ' ' + (d.rivale.pts === 1 ? 'Punkt' : 'Punkten') + '.');
    if (d.naechster) m.push('<b>Als Nächstes.</b> ' + esc(d.naechster.n) + (d.naechster.heim ? ' (H)' : ' (A)') +
      (a.aussagekraft ? ', derzeit Platz ' + d.naechster.platz : '') + '.');
    if (d.freie && d.freie[0]) m.push('<b>Ablösefrei.</b> ' + esc(d.freie[0].n) + ' — ' + d.freie[0].pos + ', OVR ' + d.freie[0].ovr + '.');
    if (a.aussagekraft && d.ueberMir) m.push('<b>Vor uns.</b> ' + esc(d.ueberMir.n) + ' mit ' + d.ueberMir.p + ' Punkten.');
    if (d.vertrauen != null) m.push('<b>Chefetage.</b> Vorstandsvertrauen ' + d.vertrauen + '/100.');
    // Die ersten beiden sind die wichtigsten, der Rest rotiert.
    return m.slice(0, 2).concat(mischeThemen(m.slice(2), 4));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4) RENDERN
  // ═══════════════════════════════════════════════════════════════════════════
  function renderZeitungTab() {
    const ziel = document.getElementById('zeitung-blatt');
    if (!ziel) return;
    const d = sammle();
    if (!d) { ziel.innerHTML = '<div class="an-leer">Noch keine Ausgabe — starte eine Karriere.</div>'; return; }
    setzeSaat(d.saison, d.woche);     // ab hier ist die Ausgabe reproduzierbar
    const a = analyse(d);
    const P = fliesstext(d, a), tipp = taktikTipp(d, a);
    const eu = europaText(d), li = ligenText(d), tr = transferText(d);
    const kom = kommentar(d, a), briefe = leserbriefe(d, a);
    const vor = vorschauText(d), riv = rivalenText(d), jub = jubilaeumText(d), beb = bebenText(d);
    const bilanz = saisonBilanz(d);
    const kolName = kolumnist();

    const band = d.ergebnisse.slice(0, 6).reverse().map(function (x) {
      return '<span class="an-f' + (x === 'S' ? 's' : x === 'U' ? 'u' : 'n') + '">' + x + '</span>';
    }).join('') || '<span style="font-size:12px;color:var(--tinte2)">noch keine Spiele</span>';

    const tab = d.tabelle.map(function (t) {
      return '<tr class="' + (t.ich ? 'ich' : '') + '"><td class="pl">' + t.pl + '</td><td>' + esc(t.n) + '</td><td class="pk">' + t.p + '</td></tr>';
    }).join('');

    const clSpiele = (d.cl && d.cl.spiele.length)
      ? d.cl.spiele.map(function (s) {
          return '<div><span>' + (s.hf || '') + ' ' + esc(s.h) + ' — ' + (s.af || '') + ' ' + esc(s.a) + '</span><span class="res">' + s.gh + ':' + s.ga + '</span></div>';
        }).join('') : '';

    ziel.innerHTML =
      '<div class="an-blatt">' +
        '<div class="an-kopf">' +
          '<h1 class="an-titel">FLUTLICHT-KURIER</h1>' +
          '<div class="an-untertitel">Europas Fußballwoche</div>' +
          '<div class="an-unterzeile">' +
            '<span>Saison ' + d.saison + ' · ' + d.spieltag + '. Spieltag</span>' +
            '<span>' + d.jahr + '</span>' +
            '<span>Ausgabe ' + Math.max(1, d.woche) + '/' + d.jahr.split('/')[0] + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="an-schlagband">Im Blickpunkt: ' + esc(d.verein) + ' · ' + esc(d.liga) +
          (a.saisonstart ? ' · vor dem 1. Spieltag'
                         : ' · Platz ' + d.platz + ' · ' + d.punkte + ' Punkte') +
          (d.cl ? ' · Champions League ' + d.cl.matchday + '. Spieltag' : '') + '</div>' +

        '<div class="an-oben">' +
          '<div>' +
            '<div class="an-dach">' + (d.letztesSpiel ? (a.gewonnen ? 'Sieg' : a.unentschieden ? 'Remis' : 'Niederlage') + ' am ' + d.spieltag + '. Spieltag'
              : a.saisonstart ? 'Vor dem Saisonstart' : 'Die Woche') + '</div>' +
            '<h2 class="an-aufmacher">' + esc(gross(schlagzeile(d, a))) + '</h2>' +
            '<div class="an-vorspann">' + vorspann(d, a) + '</div>' +
            '<div class="an-fliess">' + P.map(function (p) { return '<p>' + String(p).trim() + '</p>'; }).join('') + '</div>' +
            (tipp && !tipp.erledigt ?
              '<div class="an-analyse">' +
                '<div class="an-kt">Analyse der Redaktion</div>' +
                '<h4>' + esc(tipp.kopf) + '</h4><p>' + tipp.text + '</p>' +
                '<button onclick="zeitungTippUmsetzen()">' + esc(tipp.knopf) + '</button>' +
              '</div>'
            : tipp && tipp.erledigt ?
              '<div class="an-analyse"><div class="an-kt">Analyse der Redaktion</div>' +
                '<p style="margin:0">✓ Die Umstellung ist erfolgt — die Mannschaft zieht mit. Nächste Woche schaut die Redaktion wieder hin.</p></div>' : '') +
            '<div class="an-autor">Sportredaktion · Flutlicht-Kurier</div>' +
          '</div>' +

          '<div class="an-spalte">' +
            '<div class="an-kasten"><div class="an-kastentitel">Formkurve</div>' +
              '<div style="font-size:12.4px">Die letzten Spiele</div>' +
              '<div class="an-formband">' + band + '</div>' +
              '<div style="font-size:12.2px;margin-top:6px;color:var(--tinte2)">' + d.tore + ':' + d.gegentore +
                ' Tore · Differenz ' + (a.tordifferenz > 0 ? '+' : '') + a.tordifferenz + ' · Form ' + a.form + '</div></div>' +
            '<div class="an-kasten"><div class="an-kastentitel">' + esc(d.liga) + '</div><table class="an-tab">' + tab + '</table></div>' +
            '<div class="an-kasten"><div class="an-kastentitel">Kurz gemeldet</div>' +
              kurzmeldungen(d, a).map(function (x) { return '<div class="an-meldung">' + x + '</div>'; }).join('') + '</div>' +
            (d.entscheidung ?
              '<div class="an-entscheidung"><div class="an-kt">Die Entscheidung der Woche</div>' +
                '<div class="an-zitat">„' + esc(d.entscheidung.titel) + '" — ' + esc(d.entscheidung.wahl) + '. ' + esc(d.entscheidung.folge) + '</div></div>' : '') +
          '</div>' +
        '</div>' +

        // ── Kommentar + Vorschau: zwei Spalten unter dem Aufmacher ──
        '<div class="an-mitte">' +
          '<div class="an-kommentar">' +
            '<div class="an-komkopf">' +
              '<div class="an-komavatar">✒️</div>' +
              '<div><div class="an-kt">Der Kommentar</div>' +
                '<div class="an-komname">' + esc(kolName) + '</div></div>' +
            '</div>' +
            '<div class="an-rtext">' + kom.map(function (p) { return '<p>' + String(p).trim() + '</p>'; }).join('') + '</div>' +
          '</div>' +
          '<div class="an-vorschau">' +
            (vor ? '<div class="an-kastentitel">Der nächste Gegner</div><div class="an-rtext"><p>' + String(vor).trim() + '</p></div>' : '') +
            (riv ? '<div class="an-kastentitel" style="margin-top:10px">Der Rivale</div><div class="an-rtext"><p>' + String(riv).trim() + '</p></div>' : '') +
            (jub ? '<div class="an-kastentitel" style="margin-top:10px">Jubiläum</div><div class="an-rtext"><p>' + String(jub).trim() + '</p></div>' : '') +
          '</div>' +
        '</div>' +

        (bilanz ? '<div class="an-bilanz"><div class="an-kt">Saisonbilanz</div>' +
            '<h3 class="an-rkopf">' + esc(w('Was bleibt von dieser Saison', 'Die Abrechnung', 'Ein Jahr in Zahlen')) + '</h3>' +
            '<div class="an-rtext">' + bilanz.map(function (p) { return '<p>' + String(p).trim() + '</p>'; }).join('') + '</div></div>' : '') +

        '<div class="an-unten">' +
          (eu ? '<div class="an-rubrik"><div class="an-rubriktitel eu">Aus Europa</div>' +
                  '<h3 class="an-rkopf">' + esc(w('Sensation in der Königsklasse', 'Der Außenseiter schlägt zurück', 'Europas Woche')) + '</h3>' +
                  '<div class="an-rtext">' + eu.map(function (p) { return '<p>' + String(p).trim() + '</p>'; }).join('') + '</div>' +
                  (clSpiele ? '<div class="an-kastentitel" style="margin-top:10px">Champions League</div><div class="an-ergebnisliste">' + clSpiele + '</div>' : '') +
                '</div>' : '') +
          '<div class="an-rubrik"><div class="an-rubriktitel tr">Transfermarkt</div>' +
            '<h3 class="an-rkopf">' + esc(w('Millionen in Bewegung', 'Der Markt läuft', 'Wechsel der Woche')) + '</h3>' +
            '<div class="an-rtext">' + tr.map(function (p) { return '<p>' + String(p).trim() + '</p>'; }).join('') + '</div></div>' +
          (li ? '<div class="an-rubrik"><div class="an-rubriktitel">Aus den Ligen</div>' +
                  '<h3 class="an-rkopf">' + esc(w('Oben und unten', 'Was sonst geschah', 'Der Blick nach oben')) + '</h3>' +
                  '<div class="an-rtext">' + li.map(function (p) { return '<p>' + String(p).trim() + '</p>'; }).join('') + '</div>' +
                  (d.bundesliga.length ? '<div class="an-kastentitel" style="margin-top:10px">Bundesliga</div><table class="an-tab">' +
                    d.bundesliga.map(function (t) { return '<tr><td class="pl">' + t.pl + '</td><td>' + esc(t.n) + '</td><td class="pk">' + t.p + '</td></tr>'; }).join('') +
                    '</table>' : '') +
                '</div>' : '') +
        '</div>' +

        // ── Leserbriefe + Trainerbeben ──
        '<div class="an-unten2">' +
          '<div class="an-rubrik"><div class="an-rubriktitel">Leserbriefe</div>' +
            briefe.map(function (b) {
              return '<div class="an-brief"><div class="an-brieftext">„' + esc(b.text) + '"</div>' +
                     '<div class="an-briefvon">' + esc(b.von) + '</div></div>';
            }).join('') +
          '</div>' +
          (beb ? '<div class="an-rubrik"><div class="an-rubriktitel">Aus der Liga</div>' +
                   '<h3 class="an-rkopf">' + esc(w('Unruhe beim Nachbarn', 'Ein Verein unter Druck', 'Krise anderswo')) + '</h3>' +
                   '<div class="an-rtext"><p>' + String(beb).trim() + '</p></div></div>'
               : '<div class="an-rubrik"><div class="an-rubriktitel">Aus der Liga</div>' +
                   '<div class="an-rtext"><p>' + esc(w('In den anderen Vereinen der Liga blieb es diese Woche ruhig.',
                     'Keine besonderen Vorkommnisse bei der Konkurrenz.')) + '</p></div></div>') +
        '</div>' +

        '<div class="an-fuss">FLUTLICHT-KURIER · Europas Fußballwoche · Erscheint montags</div>' +
      '</div>';
  }
  window.renderZeitungTab = renderZeitungTab;

  // ═══════════════════════════════════════════════════════════════════════════
  // 5) EINHÄNGEN
  // ═══════════════════════════════════════════════════════════════════════════
  // switchAppView kennt eine FESTE View-Liste (bundle_squad.js) — fehlt 'zeitung'
  // darin, wird beim Klick KEINE View aktiviert und der Tab bleibt weiß.
  // Das ist derselbe Fehler, der den Europa-Tab lahmgelegt hatte.
  if (typeof window.switchAppView === 'function') {
    const _sav = window.switchAppView;
    window.switchAppView = function (view, btn) {
      const r = _sav.apply(this, arguments);
      try {
        // Die feste View-Liste in bundle_squad.js kennt 'zeitung' nicht und
        // blendet sie deshalb NIE aus: gemessen blieb view-zeitung beim Wechsel
        // auf Übersicht/Kader/Liga sichtbar und lag über der eigentlichen View.
        // Also selbst ausblenden, sobald ein anderer Reiter gewählt wird.
        if (view !== 'zeitung') {
          const vz = document.getElementById('view-zeitung');
          if (vz) vz.classList.remove('active');
        }
        if (view === 'zeitung') {
          document.querySelectorAll('.app-view').forEach(function (el) { el.classList.remove('active'); });
          const v = document.getElementById('view-zeitung');
          if (v) v.classList.add('active');
          document.querySelectorAll('.appnav-btn').forEach(function (b) { b.classList.remove('active'); });
          const nb = btn || document.getElementById('nav-zeitung');
          if (nb) nb.classList.add('active');
          renderZeitungTab();
          // Badge löschen: die Ausgabe ist gelesen.
          CLUB._zeitungGelesen = { saison: LEAGUE.season, woche: LEAGUE.week };
          badge();
        }
      } catch (e) { console.warn('[Anstoss] View', e); }
      return r;
    };
    try { switchAppView = window.switchAppView; } catch (e) {}
  }

  // Badge am Reiter, wenn eine neue Ausgabe vorliegt.
  function badge() {
    try {
      const b = document.getElementById('nav-zeitung');
      if (!b || typeof CLUB === 'undefined' || typeof LEAGUE === 'undefined' || !LEAGUE) return;
      const gel = CLUB._zeitungGelesen;
      const neu = !gel || gel.saison !== LEAGUE.season || gel.woche !== LEAGUE.week;
      b.classList.toggle('an-neu', !!neu);
    } catch (e) {}
  }
  window.zeitungBadge = badge;

  // Wochenwechsel → neue Ausgabe
  if (typeof window.advanceCalendarWeek === 'function') {
    const _aw = window.advanceCalendarWeek;
    window.advanceCalendarWeek = function () {
      const r = _aw.apply(this, arguments);
      try { badge(); if (document.getElementById('view-zeitung').classList.contains('active')) renderZeitungTab(); } catch (e) {}
      return r;
    };
    try { advanceCalendarWeek = window.advanceCalendarWeek; } catch (e) {}
  }

  // Stil (eigenes CSS, damit die Zeitung nicht wie der Rest der App aussieht)
  const css = document.createElement('style');
  css.textContent = [
    '#view-zeitung{--papier:#f4f1e8;--tinte:#16130e;--tinte2:#4a4338;--linie:#c9c0ab;--rot:#a8271b;--blau:#1d3f6b}',
    '.an-blatt{background:var(--papier);color:var(--tinte);padding:24px 26px 28px;border-radius:6px;',
      'font-family:"Source Serif 4",Georgia,"Times New Roman",serif;max-width:1040px;margin:0 auto;box-shadow:0 14px 40px rgba(0,0,0,.45)}',
    '.an-kopf{border-bottom:3px double var(--tinte);padding-bottom:8px}',
    '.an-titel{font-family:Georgia,"Times New Roman",serif;font-weight:900;font-size:clamp(28px,6.5vw,56px);',
      'line-height:.94;letter-spacing:-1px;text-align:center;margin:0;color:var(--tinte)}',
    '.an-untertitel{text-align:center;font-size:10px;letter-spacing:4px;text-transform:uppercase;color:var(--tinte2);margin-top:5px}',
    '.an-unterzeile{display:flex;justify-content:space-between;font-size:9.5px;letter-spacing:1.4px;',
      'text-transform:uppercase;color:var(--tinte2);margin-top:8px;flex-wrap:wrap;gap:6px}',
    '.an-schlagband{border-bottom:1px solid var(--linie);padding:6px 0;margin-bottom:15px;font-size:10.5px;',
      'letter-spacing:.7px;text-transform:uppercase;color:var(--tinte2);text-align:center}',
    '.an-oben{display:grid;grid-template-columns:2.05fr 1fr;gap:22px;padding-bottom:15px;border-bottom:3px double var(--tinte)}',
    '@media(max-width:760px){.an-oben{grid-template-columns:1fr}}',
    '.an-dach{font-size:10.5px;letter-spacing:2px;text-transform:uppercase;color:var(--rot);margin-bottom:4px;font-weight:700}',
    '.an-aufmacher{font-family:Georgia,serif;font-weight:700;font-size:clamp(23px,4.4vw,38px);line-height:1.06;margin:0;color:var(--tinte)}',
    '.an-vorspann{font-size:14.6px;font-weight:600;line-height:1.42;margin:9px 0 11px}',
    '.an-fliess{font-size:13.6px;line-height:1.6;text-align:justify;hyphens:auto}',
    '.an-fliess p{margin:0 0 9px}',
    '.an-fliess p:first-of-type::first-letter{font-family:Georgia,serif;font-size:48px;float:left;line-height:.82;padding:4px 8px 0 0;font-weight:900}',
    '.an-autor{font-size:9.5px;letter-spacing:1.3px;text-transform:uppercase;color:var(--tinte2);margin-top:10px;border-top:1px solid var(--linie);padding-top:6px}',
    '.an-spalte{border-left:1px solid var(--linie);padding-left:18px}',
    '@media(max-width:760px){.an-spalte{border-left:none;padding-left:0;border-top:1px solid var(--linie);padding-top:14px}}',
    // Kommentar + Vorschau
    '.an-mitte{display:grid;grid-template-columns:1.6fr 1fr;gap:22px;margin-top:15px;padding-bottom:14px;',
      'border-bottom:1px solid var(--linie)}',
    '@media(max-width:760px){.an-mitte{grid-template-columns:1fr}}',
    '.an-kommentar{border-left:4px solid var(--rot);padding-left:14px}',
    '.an-komkopf{display:flex;align-items:center;gap:10px;margin-bottom:8px}',
    '.an-komavatar{width:34px;height:34px;border-radius:50%;background:var(--tinte);color:var(--papier);',
      'display:grid;place-items:center;font-size:16px;flex:none}',
    '.an-komname{font-family:Georgia,serif;font-weight:700;font-size:14.5px;color:var(--tinte)}',
    '.an-kommentar .an-rtext{font-style:italic}',
    '.an-vorschau{border-left:1px solid var(--linie);padding-left:18px}',
    '@media(max-width:760px){.an-vorschau{border-left:none;padding-left:0;border-top:1px solid var(--linie);padding-top:12px}}',
    // Saisonbilanz
    '.an-bilanz{border:2px solid var(--tinte);padding:13px 15px;margin-top:14px;background:rgba(0,0,0,.03)}',
    // Leserbriefe
    '.an-unten2{display:grid;grid-template-columns:1.4fr 1fr;gap:20px;margin-top:15px}',
    '@media(max-width:760px){.an-unten2{grid-template-columns:1fr}}',
    '.an-brief{margin-bottom:10px;padding-bottom:10px;border-bottom:1px dotted var(--linie)}',
    '.an-brief:last-child{border-bottom:none}',
    '.an-brieftext{font-size:12.8px;line-height:1.5;font-style:italic;color:var(--tinte)}',
    '.an-briefvon{font-size:10.5px;letter-spacing:.9px;text-transform:uppercase;color:var(--tinte2);margin-top:3px;text-align:right}',
    '.an-unten{display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;margin-top:15px}',
    '@media(max-width:880px){.an-unten{grid-template-columns:1fr 1fr}}',
    '@media(max-width:600px){.an-unten{grid-template-columns:1fr}}',
    '.an-rubrik{border-top:2px solid var(--tinte);padding-top:7px}',
    '.an-rubriktitel{font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:700;margin-bottom:7px;color:var(--tinte)}',
    '.an-rubriktitel.eu{color:var(--blau)}.an-rubriktitel.tr{color:var(--rot)}',
    '.an-rkopf{font-family:Georgia,serif;font-weight:700;font-size:16.5px;line-height:1.15;margin:0 0 5px;color:var(--tinte)}',
    '.an-rtext{font-size:12.9px;line-height:1.5;text-align:justify;hyphens:auto}.an-rtext p{margin:0 0 8px}',
    '.an-kasten{margin-bottom:16px}',
    '.an-kastentitel{font-size:10px;letter-spacing:1.7px;text-transform:uppercase;border-bottom:2px solid var(--tinte);',
      'padding-bottom:3px;margin-bottom:7px;font-weight:700;color:var(--tinte)}',
    '.an-meldung{font-size:12.7px;line-height:1.45;margin-bottom:8px;padding-bottom:8px;border-bottom:1px dotted var(--linie)}',
    '.an-meldung:last-child{border-bottom:none}',
    'table.an-tab{width:100%;border-collapse:collapse;font-size:12.2px;font-variant-numeric:tabular-nums}',
    'table.an-tab td{padding:3px 2px;border-bottom:1px dotted var(--linie);color:var(--tinte)}',
    'table.an-tab tr.ich{font-weight:700;background:rgba(168,39,27,.09)}',
    'table.an-tab td.pl{width:20px;color:var(--tinte2)}table.an-tab td.pk{text-align:right;width:26px}',
    '.an-ergebnisliste{font-size:12.3px;line-height:1.7;font-variant-numeric:tabular-nums}',
    '.an-ergebnisliste div{display:flex;justify-content:space-between;gap:8px;border-bottom:1px dotted var(--linie);padding:1.5px 0}',
    '.an-ergebnisliste .res{font-weight:700;white-space:nowrap}',
    '.an-formband{display:flex;gap:3px;margin-top:5px}',
    '.an-formband span{width:18px;height:18px;border-radius:3px;display:grid;place-items:center;font-size:10px;color:#fff;font-weight:700}',
    '.an-fs{background:#2f6b3f}.an-fu{background:#8a8272}.an-fn{background:#a8271b}',
    '.an-analyse{border:2px solid var(--rot);padding:12px 14px;margin-top:12px;background:rgba(168,39,27,.05)}',
    '.an-kt{font-size:10px;letter-spacing:1.9px;text-transform:uppercase;color:var(--rot);font-weight:700;margin-bottom:5px}',
    '.an-analyse h4{font-family:Georgia,serif;font-size:17px;margin:0 0 6px;font-weight:700;color:var(--tinte)}',
    '.an-analyse p{font-size:12.9px;line-height:1.5;margin:0 0 9px;color:var(--tinte)}',
    '.an-analyse button{font-size:11.5px;letter-spacing:1px;text-transform:uppercase;background:var(--rot);color:#fff;',
      'border:none;padding:8px 15px;border-radius:3px;cursor:pointer;font-weight:600;font-family:inherit}',
    '.an-analyse button:hover{background:#8d1f15}',
    '.an-entscheidung{border-left:3px solid var(--tinte);padding-left:11px;margin-top:11px}',
    '.an-entscheidung .an-kt{color:var(--tinte2)}',
    '.an-zitat{font-style:italic;font-size:13px;line-height:1.48}',
    '.an-fuss{margin-top:18px;border-top:3px double var(--tinte);padding-top:7px;font-size:9px;letter-spacing:1.2px;',
      'text-transform:uppercase;color:var(--tinte2);text-align:center}',
    '.an-leer{padding:40px;text-align:center;color:var(--text2,#8b949e)}',
    '#nav-zeitung.an-neu::after{content:"";display:inline-block;width:7px;height:7px;border-radius:50%;',
      'background:var(--gold,#f2c14e);margin-left:6px;vertical-align:middle}'
  ].join('');
  document.head.appendChild(css);

  console.log('[DerAnstoss v1] aktiv — Wochenzeitung mit regelbasiertem Erzähler');
})();