/* ═══════════════════════════════════════════════════════════════════════════
   DFL · APP-OBERFLÄCHE  ·  v2   (Handy zuerst, Wunsch 2026-10-08: „mach eine wirkliche App daraus“;
                                   v2 = Bedienkonzept D54, Stil Kenney Tag/Nacht in css/theme_dfl_kenney.css)
   ─────────────────────────────────────────────────────────────────────────
   Baut auf mobile_patch.js auf (body.ist-handy) und ersetzt dessen Leiste durch eine App-Oberfläche:
   • App-Kopf oben: Wappen, Verein, Woche/Platz, „Mehr“ (Blatt von unten; darin „Einstellungen“: Tag/Nacht, Spiel als Text + Tempo, Haltepunkte von „Simulieren bis …“ – D111)
   • Leiste unten mit 4 Zielen: Office · Kader · Liga · Front Office
   • Office: Vereinsgelände + 8 Kacheln (je eine große Zahl, Icon, Farbzustand; Tippen öffnet den Bereich)
   • Haupt-Button unten rechts, je nach Phase: Zum Draft · Kader regelkonform machen · Zum Spiel ·
     Woche weiter · Saison abschließen (die Woche-weiter-Knöpfe im Inhalt werden ausgeblendet)
   • Spieler-Blatt von unten statt Karte irgendwo unter der Liste: Porträt, Stärke, Fitness, Moral,
     Cap Hit, Vertrag; Tauschen, Development Squad, Vertrag, alle Details
   • Front Office: Cap-Balken (Untergrenze 89 %, Hard Cap), Kader 21–28, Kasse, Kacheln zu Verträgen,
     Trades, Free Agency, Draft & Scouting, Finanzen, Wertliste
   • Office-Kopf auf der Übersicht: Wappen, Platz und Bilanz, Woche, nächstes Spiel
   • Kaderschnitt-Blatt vor Spieltag 1: was nicht passt (Cap, 28er-Kader, Development Squad) und Vorschläge
     mit Ersparnis nach Dead Cap – Entlassen oder in den Development Squad direkt aus dem Blatt
   • Spielbericht: Weiter-Knopf bleibt unten stehen (kein Scrollen durch Statistik und Noten)
   Überall in der DFL (auch am PC): Gesichter und Fitness auf dem Taktikfeld, ganze Porträts in der
   Spielerkarte und der Startelf-Liste, Kaderliste mit Cap Hit statt Marktwert (D47).
   Lädt nach mobile_patch.js, dfl_design_patch.js und dfl_app_patch.js, vor init_bootstrap.js.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const dfl = () => typeof CLUB !== 'undefined' && CLUB && CLUB.dfl && CLUB.dfl.aktiv;
  const handy = () => !!(document.body && document.body.classList.contains('ist-handy'));
  const shell = () => handy() && dfl();
  const K = () => window.DFLKader;
  const I = () => window.DFLIdentitaet;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const mio = x => (Math.round((x || 0) / 1e5) / 10).toLocaleString('de-DE') + ' Mio €';
  const kurz = p => (typeof displayName === 'function' ? displayName(p) : p.name);
  const voll = p => ((p.firstName ? p.firstName + ' ' : '') + p.name).trim();
  const spieler = id => (typeof getPlayer === 'function' ? getPlayer(id) : null);
  const farben = () => { try { const f = DFLSpiel.franchise('fcm'); return f ? { farben: f.farben } : null; } catch (e) { return null; } };
  const FIT = f => f >= 85 ? '#3fcf7a' : f >= 70 ? '#f0c05a' : '#f07462';
  const fitness = p => Math.round(typeof p.fitness === 'number' ? p.fitness : 95);
  const moral = p => Math.round(typeof p.morale === 'number' ? p.morale : 70);
  const portraet = (p, klein) => {
    try { return `<span class="dfl-portrait${klein ? ' klein' : ''}">${I().gesichtSvg(p, SQUAD.some(q => q.id === p.id) ? farben() : null)}</span>`; }
    catch (e) { return ''; }
  };

  // ── Ansichten ────────────────────────────────────────────────────────────
  const NAV = [
    { id: 'office', icon: 'ti-layout-dashboard', label: 'Office', view: 'home', views: ['home'] },
    { id: 'kader', icon: 'ti-users', label: 'Kader', view: 'squad', views: ['squad', 'training'] },
    { id: 'liga', icon: 'ti-trophy', label: 'Liga', view: 'liga', views: ['liga'] },
    { id: 'fo', icon: 'ti-briefcase', label: 'Front Office', view: 'fo', views: ['fo', 'transfer', 'scout', 'club', 'sv'] }
  ];
  const MEHR = [
    { icon: 'ti-barbell', label: 'Training', sub: 'Einheiten, Development Squad, Verletztenliste', go: () => zeige('training') },
    { icon: 'ti-news', label: 'Zeitung', sub: 'Der Anstoß', go: () => zeige('zeitung') },
    { icon: 'ti-building-stadium', label: 'Verein & Stadion', sub: 'Anlagen, Eigentümer, Sponsoren', go: () => zeige('club') },
    { icon: 'ti-award', label: 'Hall of Fame', sub: 'Legenden, Jahrgänge, Rekorde', go: () => { if (!(window.DFLEhrungen && DFLEhrungen.halle && DFLEhrungen.halle())) { zeige('liga'); unterReiter('#view-liga', 'ehren'); } } },
    // Einstellungen (2026-10-11, Wunsch des Nutzers: Tag/Nacht und Ähnliches sammeln, später Sound/Musik): Darstellung, Spiel als
    // Text (D77), Haltepunkte von „Simulieren bis …“ (D64) – vorher die Einträge „Stil“ und „Spiel als Text“
    { icon: 'ti-settings', label: 'Einstellungen', sub: () => einstellungenText(), go: () => einstellungenBlatt() },
    // Nutzer 2026-10-14: Spieltag, Jetzt speichern und Spielstände raus (das Spiel speichert automatisch), Spielmodus und Erster
    // Tag in die Einstellungen, dafür zurück zum Hauptmenü (Startbildschirm mit Weiter, Spielständen, neuem Spiel)
    { icon: 'ti-home', label: 'Hauptmenü', sub: 'Spielstände, neues Spiel', go: () => { try { saveGameState(); } catch (e) { /* speichert die Woche */ } if (window.DFLStart) DFLStart.zeigen(); } },
    { icon: 'ti-scale', label: 'Impressum und Datenschutz', sub: 'Lizenzen, Mitwirkende', go: () => { if (window.DFLStart) DFLStart.recht(); else mitwirkende(); } }
  ];
  let aktuelleAnsicht = 'home';

  function zeige(view) {
    blattZu(); mehrZu();
    if (view === 'fo') { foZeigen(); return; }
    const fo = document.getElementById('view-fo'); if (fo) fo.classList.remove('active');
    if (typeof switchAppView === 'function') switchAppView(view, document.getElementById('nav-' + view) || document.createElement('button'));
    window.scrollTo(0, 0);
  }
  function unterReiter(sel, name) {
    const b = [...document.querySelectorAll(sel + ' .subtab')].find(x => (x.getAttribute('onclick') || '').indexOf("'" + name + "'") >= 0);
    if (b) b.click();
  }
  // Ansichtswechsel mitschreiben: Leiste markieren, Front Office verstecken, Haupt-Button neu
  {
    const _orig = window.switchAppView;
    if (typeof _orig === 'function') window.switchAppView = function (view, btn) {
      if (view === 'fo') { foZeigen(); return; }
      const fo = document.getElementById('view-fo'); if (fo) fo.classList.remove('active');
      const r = _orig.call(this, view, btn || document.getElementById('nav-' + view) || document.createElement('button'));
      aktuelleAnsicht = view; markiere(); cta();
      return r;
    };
  }

  // ── Leiste und Mehr-Blatt ────────────────────────────────────────────────
  function baue() {
    if (document.getElementById('app-nav')) return;
    // App-Kopf: Wappen + Verein (→ Office), „Mehr“ rechts oben (D54: die Leiste hat nur noch 4 Ziele)
    const kopf = document.createElement('header');
    kopf.id = 'app-kopf';
    kopf.innerHTML = `<button class="ak-verein" type="button" aria-label="Zum Office"><span class="lg-crest ak-wappen"></span><span class="ak-txt"><b></b><small></small></span></button>
      <button class="ak-mehr" type="button" aria-label="Mehr: Training, Zeitung, Verein, Hall of Fame, Einstellungen, Hauptmenü"><i class="ti ti-menu-2" aria-hidden="true"></i></button>`;
    kopf.addEventListener('click', ev => {
      if (ev.target.closest('.ak-mehr')) mehrAuf();
      else if (ev.target.closest('.ak-verein')) zeige('home');
    });
    document.body.appendChild(kopf);

    const nav = document.createElement('nav');
    nav.id = 'app-nav'; nav.setAttribute('aria-label', 'Hauptnavigation');
    nav.innerHTML = NAV.map(n => `<button class="app-nav-btn" data-nav="${n.id}"><i class="ti ${n.icon}" aria-hidden="true"></i><span>${n.label}</span></button>`).join('');
    nav.addEventListener('click', ev => {
      const b = ev.target.closest('.app-nav-btn'); if (!b) return;
      const n = NAV.find(x => x.id === b.getAttribute('data-nav'));
      zeige(n.view);
    });
    document.body.appendChild(nav);

    const sheet = document.createElement('div');
    sheet.id = 'app-sheet';
    sheet.innerHTML = `<div class="app-sheet-bg"></div><div class="app-sheet-box" role="dialog" aria-label="Mehr">
      <div class="app-griff"></div><div class="app-sheet-titel">Mehr</div>` +
      MEHR.map((m, i) => `<button class="app-eintrag" data-mehr="${i}"><i class="ti ${m.icon}" aria-hidden="true"></i>
        <span class="app-eintrag-txt"><b>${m.label}</b><small>${typeof m.sub === 'function' ? m.sub() : m.sub}</small></span><i class="ti ti-chevron-right app-pfeil" aria-hidden="true"></i></button>`).join('') +
      `</div>`;
    sheet.addEventListener('click', ev => {
      if (ev.target.closest('.app-sheet-bg')) { mehrZu(); return; }
      const e = ev.target.closest('.app-eintrag'); if (!e) return;
      mehrZu(); MEHR[+e.getAttribute('data-mehr')].go();
    });
    document.body.appendChild(sheet);

    const btn = document.createElement('button');
    btn.id = 'app-cta'; btn.type = 'button';
    btn.addEventListener('click', () => { const z = ctaZustand(); if (z) { z.go(); setTimeout(cta, 60); } });
    document.body.appendChild(btn);

    const blatt = document.createElement('div');
    blatt.id = 'app-blatt';
    blatt.innerHTML = '<div class="app-sheet-bg"></div><div class="app-blatt-box" role="dialog" aria-modal="true"></div>';
    blatt.addEventListener('click', ev => { if (ev.target.closest('.app-sheet-bg') || ev.target.closest('.app-blatt-zu')) blattZu(); });
    document.body.appendChild(blatt);

    const hinweis = document.createElement('div');
    hinweis.id = 'app-hinweis';
    document.body.appendChild(hinweis);
    hinweis.addEventListener('click', ev => {
      if (!ev.target.closest('button')) return;
      CLUB.selected = null; hinweisAus(); if (typeof renderPitch === 'function') { renderPitch(); renderBench(); }
    });
    document.addEventListener('keydown', ev => { if (ev.key === 'Escape') { blattZu(); mehrZu(); } });
    // „Als App installieren“ (dfl_app_patch.js) ins neue Blatt holen
    window.dispatchEvent(new Event('resize'));
  }
  function mehrAuf() {
    const s = document.getElementById('app-sheet'); if (!s) return;
    s.querySelectorAll('.app-eintrag').forEach(e => {        // Untertitel aktuell halten (Stil)
      const m = MEHR[+e.getAttribute('data-mehr')], sm = e.querySelector('small');
      if (m && typeof m.sub === 'function' && sm) sm.textContent = m.sub();
    });
    s.classList.add('auf'); document.body.classList.add('app-gesperrt');
  }
  function mehrZu() { const s = document.getElementById('app-sheet'); if (s) s.classList.remove('auf'); if (!offen('app-blatt')) document.body.classList.remove('app-gesperrt'); }
  const offen = id => { const e = document.getElementById(id); return !!(e && e.classList.contains('auf')); };
  function markiere() {
    document.querySelectorAll('#app-nav .app-nav-btn').forEach(b => {
      const n = NAV.find(x => x.id === b.getAttribute('data-nav'));
      b.classList.toggle('an', n.views.indexOf(aktuelleAnsicht) >= 0);
    });
  }

  // ── Haupt-Button ─────────────────────────────────────────────────────────
  function teamName(id) {
    try { const t = LEAGUE.tiers.bundesliga.groups[0].teams.find(x => x.id === id); return t ? t.name : ''; } catch (e) { return ''; }
  }
  function ctaZustand() {
    if (!dfl() || typeof LEAGUE === 'undefined' || !LEAGUE) return null;
    if (aktuelleAnsicht === 'match' || document.querySelector('.dfl-draft-ov')) return null;
    const k = K();
    // D108: Start am Tag der Verträge, dann der erste Draft (dfl_startdraft.js)
    const sd = window.DFLStartDraft && DFLStartDraft.cta ? DFLStartDraft.cta() : null;
    if (sd) return sd;
    if (k && LEAGUE.dflDraft && !LEAGUE.dflDraft.fertig) return { text: 'Zum Draft', sub: 'Dein Pick wartet', icon: 'ti-school', go: () => k.oeffneDraft(null) };
    // D136: zwei Torhüter während der Saison – vor dem nächsten Spiel (Liga und Playoffs)
    if (k && k.twFehlt && k.saisonLaeuft && k.saisonLaeuft() && k.twFehlt())
      return { text: 'Torhüter holen', sub: `${k.torhueter().length} von ${k.TW_MIN} im Kader`, icon: 'ti-alert-triangle', warn: true, go: () => kaderschnitt() };
    // Mindestkader 21 genauso streng (Nutzer 2026-10-14: „Ja mindestkader auch“): vor dem nächsten Spiel
    if (k && k.saisonLaeuft && k.saisonLaeuft() && k.hauptkader().length < k.MIN())
      return { text: `Kader auf ${k.MIN()} auffüllen`, sub: `${k.hauptkader().length} Spieler im Kader`, icon: 'ti-alert-triangle', warn: true,
        go: () => kaderschnitt() };
    const po = window.DFLPlayoffs && DFLPlayoffs.faellig && DFLPlayoffs.faellig();
    const test = typeof fcmFriendlyThisWeek === 'function' && fcmFriendlyThisWeek(LEAGUE);
    const liga = typeof seasonFullyComplete === 'function' && !seasonFullyComplete(LEAGUE) && Array.isArray(LEAGUE.matchWeeks)
      && LEAGUE.matchWeeks[LEAGUE.matchday] === LEAGUE.week && fcmNextFixture(LEAGUE);
    if (po || test || liga) {
      const geg = po ? teamName(po.heim === 'fcm' ? po.gast : po.heim) : test ? teamName(test.opponentId) : teamName(liga.opponentId);
      // D166: Hin- und Rückspiel im Untertitel
      const b = po && DFLPlayoffs.bein ? DFLPlayoffs.bein(po) : 0, vor = b === 2 && po.hin ? (po.heim === 'fcm' ? [po.hin.gh, po.hin.ga] : [po.hin.ga, po.hin.gh]) : null;
      const sub = (b === 1 ? 'Hinspiel ' : b === 2 ? 'Rückspiel ' : '') + (geg ? 'gegen ' + geg : '') + (vor ? ` · Hin ${vor[0]}:${vor[1]}` : '');
      return { text: po ? 'Zum Playoff-Spiel' : test ? 'Zum Testspiel' : 'Zum Spiel', sub: sub.trim(), icon: 'ti-ball-football', go: () => zeige('match') };
    }
    // D92: einmal je Saison die Saisonvorbereitung (ab der Finalwoche, dfl_saisonwechsel_patch.js)
    const SW = window.DFLSaisonwechsel, sv = SW && SW.ctaSchritt ? SW.ctaSchritt() : null;
    if (sv) return sv;
    if (k && LEAGUE.matchday === 0 && Array.isArray(LEAGUE.matchWeeks) && LEAGUE.week + 1 >= LEAGUE.matchWeeks[0]) {
      const f = k.startPruefung();
      if (f.length) return { text: 'Kader regelkonform machen', sub: f[0], icon: 'ti-alert-triangle', warn: true, go: () => kaderschnitt() };
    }
    if (typeof fcmSeasonOver === 'function' && fcmSeasonOver()) {
      // Rückmeldung 17.10.: nach dem Finale noch ein paar Wochen Off-Season vor dem Draft (dfl_abschluss_patch.js)
      const pause = window.DFLAbschluss && DFLAbschluss.pauseRest ? DFLAbschluss.pauseRest() : 0;
      if (pause) return { text: 'Woche weiter', sub: `Off-Season · noch ${pause === 1 ? 'eine Woche' : pause + ' Wochen'} bis zum Draft`, icon: 'ti-arrow-right', go: () => nextWeek() };
      return { text: 'Saison abschließen', sub: SW && SW.ctaText ? SW.ctaText() : '', icon: 'ti-trophy', go: () => nextWeek() };
    }
    const lbl = typeof calendarLabel === 'function' ? calendarLabel(LEAGUE.week, LEAGUE.startYear || 2026) : 'Woche ' + LEAGUE.week;
    // D158: in der Woche vor dem Finale den Pro Bowl im Ticker ansehen (wer weiterklickt oder simuliert, bekommt das Ergebnis still)
    const pb = window.DFLEhrungen && DFLEhrungen.proBowlBereit && DFLEhrungen.proBowlBereit();
    if (pb) return { text: 'Pro Bowl ansehen', sub: 'Süd-West gegen Nord-Ost', icon: 'ti-star', go: () => DFLEhrungen.proBowlAnsehen() };
    const poLauf = window.DFLPlayoffs && DFLPlayoffs.laufend && DFLPlayoffs.laufend();   // Playoffs ohne eigenes Spiel diese Woche
    return { text: 'Woche weiter', sub: poLauf ? 'Playoffs · ' + poLauf : lbl, icon: poLauf ? 'ti-trophy' : 'ti-arrow-right', go: () => nextWeek() };
  }
  // App-Kopf: Wappen, Name, Woche · Platz
  // Playoff-Lage in der eigenen Conference: Seed 1–7 kommt weiter. Sicher = höchstens 6 andere können noch gleichziehen,
  // raus = schon 7 andere uneinholbar vorn, wahrscheinlich = auf einem Seed mit mindestens 3 Punkten Vorsprung auf Platz 8
  function seedLage(t) {
    try {
      if (!window.DFLSpiel || !DFLSpiel.setzliste || !t || !t.conference) return null;
      const s = DFLSpiel.setzliste(t.conference), reihe = s.sieger.concat(s.wild, s.draussen);
      const seed = reihe.findIndex(x => x.id === t.id) + 1; if (!seed) return null;
      const SPIELE = 26, max = x => x.pts + 3 * Math.max(0, SPIELE - (x.played || 0));
      const andere = reihe.filter(x => x.id !== t.id), divs = [...new Set(andere.map(x => x.division))].filter(d => d !== t.division);
      // Division-Sieger bekommen einen Seed, auch mit weniger Punkten: jede andere Division ohne Team aus der Menge zählt einen Platz dazu
      const plaetze = menge => menge.length + divs.filter(d => !menge.some(x => x.division === d)).length;
      const eigeneDiv = andere.filter(x => x.division === t.division);
      const divWeg = eigeneDiv.some(x => x.pts > max(t)), divSicher = eigeneDiv.every(x => max(x) < t.pts);
      const vorn = divWeg ? plaetze(andere.filter(x => x.pts > max(t))) : 0;
      const jaeger = divSicher ? 0 : plaetze(andere.filter(x => max(x) >= t.pts));
      const achter = reihe[7], abstand = seed <= 7 && achter ? t.pts - achter.pts : 0;
      if (!t.played) return { seed, z: 'info', text: 'Saison startet' };
      if (vorn >= 7) return { seed, z: 'schlecht', text: 'Playoffs verpasst' };
      if (jaeger <= 6) return { seed, z: 'gut', text: 'Playoffs sicher' };
      if (seed <= 7 && abstand >= 3) return { seed, z: 'info', text: `Playoffs wahrscheinlich · +${abstand}` };
      const linie = reihe[6];
      return { seed, z: 'mittel', text: seed <= 7 ? `Im Rennen · ${abstand ? '+' + abstand : 'punktgleich'}` : (linie && linie.pts > t.pts ? `Im Rennen · ${linie.pts - t.pts} Pkt. zu Seed 7` : 'Im Rennen · punktgleich mit Seed 7') };
    } catch (e) { return null; }
  }
  function tabellenPlatz() {
    try {
      // 2026-10-21 (Fehleranalyse F6): dieselbe Reihenfolge wie der Platz-Chip (computeTable mit den Tiebreak-Regeln des Spiels)
      const roh = LEAGUE.tiers.bundesliga.groups[0].teams;
      const teams = typeof computeTable === 'function' ? computeTable(roh) : roh.slice().sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
      const t = teams.find(x => x.id === 'fcm'); return t ? { t, platz: teams.indexOf(t) + 1 } : null;
    } catch (e) { return null; }
  }
  function kopfAktualisieren() {
    const k = document.getElementById('app-kopf'); if (!k || !shell() || typeof LEAGUE === 'undefined' || !LEAGUE) return;
    const w = k.querySelector('.ak-wappen'), st = typeof crestStyle === 'function' ? crestStyle('fcm') : '';
    if (w.getAttribute('style') !== st) w.setAttribute('style', st);
    const tp = tabellenPlatz();
    const woche = typeof calendarLabel === 'function' ? calendarLabel(LEAGUE.week, LEAGUE.startYear || 2026) : 'Woche ' + LEAGUE.week;
    const unter = woche + (tp && tp.t.played ? ` · Platz ${tp.platz}` : '');
    const b = k.querySelector('.ak-txt b'), sm = k.querySelector('.ak-txt small');
    if (b.textContent !== CLUB.name) b.textContent = CLUB.name;
    if (sm.textContent !== unter) sm.textContent = unter;
  }
  function cta() {
    try { kopfAktualisieren(); } catch (e) { /* Kopf ist Beiwerk */ }
    const b = document.getElementById('app-cta'); if (!b) return;
    const z = shell() ? ctaZustand() : null;
    b.classList.toggle('zeigen', !!z && !offen('app-blatt') && !offen('app-sheet'));
    if (!z) return;
    b.classList.toggle('warn', !!z.warn);
    const html = `<i class="ti ${z.icon}" aria-hidden="true"></i><span><b>${esc(z.text)}</b>${z.sub ? `<small>${esc(z.sub)}</small>` : ''}</span>`;
    if (b.innerHTML !== html) b.innerHTML = html;
  }

  // ── Form −2…+2 (D54): Schnitt der letzten 3 Noten gegen den Saisonschnitt ──
  // Noten nur aus der laufenden Saison (neue Saison → wieder „–“), nur gültige Zahlen
  function noten(p) {
    const mr = p && p.matchRatings, s = typeof LEAGUE !== 'undefined' && LEAGUE ? LEAGUE.season : null;
    return mr && Array.isArray(mr.list) && s != null && mr.season === s ? mr.list.filter(x => typeof x === 'number' && isFinite(x)) : [];
  }
  // Form −2…+2: unter 3 Einsätzen gar keine Rechnung (null), nur Anzeige – fließt nicht in die Mannschaftsstärke
  function formVon(p) {
    const n = noten(p); if (n.length < 3) return null;
    const d = n.slice(-3).reduce((a, b) => a + b, 0) / 3 - n.reduce((a, b) => a + b, 0) / n.length;
    return d >= 0.6 ? 2 : d >= 0.2 ? 1 : d <= -0.6 ? -2 : d <= -0.2 ? -1 : 0;
  }
  const FORM = { '2': ['p2', '+2', 'stark steigend'], '1': ['p1', '+1', 'steigend'], '0': ['n0', '0', 'gleich'], '-1': ['m1', '−1', 'fallend'], '-2': ['m2', '−2', 'stark fallend'] };
  const formHtml = f => f == null ? '<span class="form-chip n0" title="Form: noch keine 3 Spiele">–</span>'
    : `<span class="form-chip ${FORM[f][0]}" title="Form ${FORM[f][2]}">${FORM[f][1]}</span>`;
  // 6 Achsen fürs Radar, die ersten 4 auf der Karte (aus den feinen Werten, player_attributes.js)
  function achsen(p, werte) {
    const w = werte || (typeof spielerWerte === 'function' && spielerWerte(p)) || {};
    const a = (...k) => { const v = k.map(x => w[x]).filter(x => typeof x === 'number'); return v.length ? Math.round(v.reduce((s, x) => s + x, 0) / v.length) : 0; };
    return p.pos === 'TW'
      ? [['REF', a('reflexe')], ['PAR', a('paraden')], ['1G1', a('einsGegenEins')], ['AUF', a('spielaufbau')], ['ABW', a('abwurf')], ['PHY', a('kraft', 'ausdauer')]]
      : [['TEM', a('schnelligkeit')], ['SCH', a('schiessen')], ['PAS', a('passen', 'flanken')], ['DRI', a('dribbling', 'offEinsGegenEins')], ['DEF', a('defStellung', 'tackling', 'defEinsGegenEins')], ['PHY', a('kraft', 'ausdauer')]];
  }
  // FUT-Karte (Nutzer 2026-10-09): Bronze < 70 · Silber 70–79 · Gold 80–89 · Elite 90–98 · Legende 99;
  // alle 6 Werte, Gesicht ganz und mittig
  const futStufe = ovr => ovr >= 99 ? 'legende' : ovr >= 90 ? 'elite' : ovr >= 80 ? 'gold' : ovr >= 70 ? 'silber' : 'bronze';
  // ▲▼ gegenüber dem letzten Saisonende (D68, dfl_werte_alter_patch.js merkt die Werte eigener Spieler)
  function vorjahrAchsen(p) {
    const v = window.DFLWerteAlter && DFLWerteAlter.vorjahr(p);
    return v ? achsen(p, v) : null;
  }
  const pfeil = d => d ? `<sup class="fut-d ${d > 0 ? 'auf' : 'ab'}" aria-label="${d > 0 ? 'plus' : 'minus'} ${Math.abs(d)} zum Vorjahr">${d > 0 ? '▲' : '▼'}${Math.abs(d)}</sup>` : '';
  // opt (D111, Blatt fremder Spieler ohne Scout-Bericht): stufe = Kartenfarbe aus der öffentlichen Stufe, wertKl = Klasse des Werts („80er“)
  function futKarte(p, ovr, ax, gesicht, vor, opt) {
    // Rückmeldung 17.10.: Sonderkarte, solange ein Bonus gilt (Spieler/Team der Woche, dfl_woche_patch.js)
    const sonder = window.DFLWoche && DFLWoche.sonderKarte ? DFLWoche.sonderKarte(p, ovr, ax, gesicht, opt) : null;
    if (sonder) return sonder;
    // Rookie-Karte (Erstrunden-/Zweitrunden-Pick, Rookie) die ganze erste Saison (kickstil_draftpack.js, Nutzer 2026-10-18)
    const rookie = window.KSDraftPack && KSDraftPack.rookieKarte ? KSDraftPack.rookieKarte(p, ovr, ax, gesicht, opt) : null;
    if (rookie) return rookie;
    const st = (opt && opt.stufe) || futStufe(ovr);
    const marke = st === 'legende' ? '<span class="fut-marke"><i class="ti ti-crown" aria-hidden="true"></i>Legende</span>'
      : st === 'elite' ? '<span class="fut-marke"><i class="ti ti-star-filled" aria-hidden="true"></i>Elite</span>' : '';
    return `<div class="fut ${st}"><div class="fut-wert${opt && opt.wertKl ? ' ' + opt.wertKl : ''}">${esc(ovr)}</div><div class="fut-pos">${esc(p.pos)}</div>${marke}
      <div class="fut-gesicht">${gesicht}</div><div class="fut-name">${esc(kurz(p))}</div>
      <div class="fut-werte">${ax.map(([k, v], i) => `<span><b>${v}${vor && vor[i] ? pfeil(v - vor[i][1]) : ''}</b><em>${k}</em></span>`).join('')}</div></div>`;
  }
  function radar(ax) {
    const n = ax.length, R = 84, cx = 130, cy = 108;
    const pt = (i, v) => { const w = -Math.PI / 2 + i * 2 * Math.PI / n; return [(cx + Math.cos(w) * R * v).toFixed(1), (cy + Math.sin(w) * R * v).toFixed(1)]; };
    const netz = [0.25, 0.5, 0.75, 1].map(f => `<polygon points="${ax.map((_, i) => pt(i, f).join(',')).join(' ')}" class="rd-netz"/>`).join('');
    const form = `<polygon points="${ax.map(([, v], i) => pt(i, Math.max(0.05, (v - 30) / 69)).join(',')).join(' ')}" class="rd-form"/>`;
    const lab = ax.map(([k, v], i) => { const [x, y] = pt(i, 1.22); return `<text x="${x}" y="${(+y + 4).toFixed(1)}" text-anchor="middle">${k} ${v}</text>`; }).join('');
    return `<svg class="app-radar" viewBox="0 0 260 220" role="img" aria-label="Radar: ${ax.map(([k, v]) => k + ' ' + v).join(', ')}">${netz}${form}${lab}</svg>`;
  }
  function neigung(karte) {
    if (!karte || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    const b = karte.parentElement;
    b.addEventListener('pointermove', e => {
      const r = karte.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      karte.style.transform = `rotateY(${(x * 20).toFixed(1)}deg) rotateX(${(-y * 20).toFixed(1)}deg)`;
      karte.style.setProperty('--gx', ((x + 0.5) * 100).toFixed(0) + '%'); karte.style.setProperty('--gy', ((y + 0.5) * 100).toFixed(0) + '%');
    });
    b.addEventListener('pointerleave', () => { karte.style.transform = ''; });
  }

  // ── Spieler-Blatt ────────────────────────────────────────────────────────
  function balken(wert, farbe) { return `<span class="app-balken"><i style="width:${Math.max(0, Math.min(100, wert))}%;background:${farbe}"></i></span>`; }
  function spielerBlatt(p, kontext) {
    if (!p) return;
    const box = document.querySelector('#app-blatt .app-blatt-box'); if (!box) return;
    box.dataset.spieler = p.id;                                                  // D62 · 6: Karriere-Kompass (dfl_blick_patch.js)
    const k = K(), scout = (CLUB.facilities && CLUB.facilities.scouting) || 1;
    const fit = fitness(p), mor = moral(p), eigen = SQUAD.some(q => q.id === p.id);
    const pot = typeof potentialOnly === 'function' ? potentialOnly(p, scout) : '';
    const pos = typeof positionsDisplay === 'function' ? positionsDisplay(p) : p.pos;
    const bis = typeof seasonEndYear === 'function' ? seasonEndYear(p.contractUntil) : p.contractUntil;
    const verletzt = typeof isInjured === 'function' && isInjured(p);
    const aktionen = [];
    if (kontext && eigen && !p.perspektiv) aktionen.push(`<button class="app-knopf haupt" data-a="tauschen"><i class="ti ti-arrows-left-right" aria-hidden="true"></i>Tauschen</button>`);
    if (eigen && k) {
      if (p.perspektiv) aktionen.push(`<button class="app-knopf" data-a="hoch"><i class="ti ti-arrow-up" aria-hidden="true"></i>Hochziehen</button>`);
      else if (k.pkTauglich(p)) aktionen.push(`<button class="app-knopf" data-a="ds"><i class="ti ti-plant-2" aria-hidden="true"></i>Development Squad</button>`);
      aktionen.push(`<button class="app-knopf" data-a="vertrag"><i class="ti ti-file-certificate" aria-hidden="true"></i>Vertrag</button>`);
      // D50: unverkäuflich – für diesen Spieler kommen keine Trade-Anfragen
      if (window.DFLAnfragen && !p.perspektiv) {
        const u = DFLAnfragen.istUnverkaeuflich(p.id);
        aktionen.push(`<button class="app-knopf" data-a="unv"><i class="ti ${u ? 'ti-lock-open' : 'ti-lock'}" aria-hidden="true"></i>${u ? 'Wieder verkäuflich' : 'Unverkäuflich'}</button>`);
      }
      // Rückmeldung 17.10. (16): mit einem Tipp zum Trade anbieten
      if (window.DFLTrade && DFLTrade.blattAngebote && !p.perspektiv && !(window.DFLAnfragen && DFLAnfragen.istUnverkaeuflich(p.id)))
        aktionen.push(`<button class="app-knopf" data-a="anbieten" aria-expanded="false"><i class="ti ti-arrows-exchange" aria-hidden="true"></i>Zum Trade anbieten</button>`);
      // D92/D93: Verlängern als Folgevertrag, Entlassung zum Saisonende vormerken (dfl_saisonwechsel_patch.js)
      if (window.DFLSaisonwechsel) aktionen.push(...DFLSaisonwechsel.blattKnoepfe(p));
      if (k.entlassen) {
        // D111: ein Tipp öffnet das Entlassen-Blatt (Dead Cap jetzt / am Saisonende, dfl_ebenen_patch.js)
        const dead = k.deadCapVon ? k.deadCapVon(p) : 0, vor = window.DFLSaisonwechsel && DFLSaisonwechsel.istVorgemerkt && DFLSaisonwechsel.istVorgemerkt(p.id);
        aktionen.push(`<button class="app-knopf rot" data-a="entlassen"><i class="ti ti-scissors" aria-hidden="true"></i><span class="ak-zwei">Entlassen${vor ? '<small>zum Saisonende vorgemerkt</small>' : dead ? `<small>Dead Cap ${mio(dead)}</small>` : ''}</span></button>`);
      }
    }
    aktionen.push(`<button class="app-knopf" data-a="statistik" aria-expanded="false"><i class="ti ti-chart-line" aria-hidden="true"></i>Statistiken</button>`);
    aktionen.push(`<button class="app-knopf" data-a="details"><i class="ti ti-id" aria-hidden="true"></i>Alle Details</button>`);
    // Ebene 2 (D54): FUT-Karte mit Neigung, alle 6 Werte, Radar · Ebene 3: „Statistiken“
    const ovr = typeof ovrBase === 'function' ? ovrBase(p) : p.ovr, ax = achsen(p), n = noten(p), f = formVon(p);
    let gesicht = '';
    try { gesicht = I().gesichtSvg(p, eigen ? farben() : null); } catch (e) { /* ohne Gesicht */ }
    box.innerHTML = `<div class="app-griff"></div><button class="app-blatt-zu" aria-label="Schließen"><i class="ti ti-x" aria-hidden="true"></i></button>
      <div class="fut-kopf"><div class="app-blatt-name">${esc(voll(p))}${typeof isCaptain === 'function' && isCaptain(p) ? ' <span class="cap-badge">©</span>' : ''}</div>
        <div class="app-blatt-meta"><span class="pos-badge-sm pos-${p.pos}">${pos}</span> ${p.age} Jahre${p.perspektiv ? ' · <b>Development Squad</b>' : ''}${verletzt ? ' · <span class="app-rot">verletzt</span>' : ''}
          ${eigen ? ' · Form ' + formHtml(f) : ''}${pot ? ` · <span class="fut-pot">${pot}${window.DFLUiTeile && typeof potentialRange === 'function' ? DFLUiTeile.sterne(potentialRange(p, scout)) : ''}</span>` : ''}${p.diamant && p.diamant.entdeckt ? ' <span class="dw-diamant-chip"><i class="ti ti-diamond" aria-hidden="true"></i>Rohdiamant</span>' : ''}</div>
        ${eigen && window.DFLPosition ? DFLPosition.blattHtml(p, kontext) : ''}${eigen && window.DFLMedizin ? DFLMedizin.blattHtml(p) : ''}</div>
      <div class="fut-buehne">${futKarte(p, ovr, ax, gesicht, eigen ? vorjahrAchsen(p) : null)}</div>
      ${radar(ax)}
      <div class="app-blatt-werte">
        <div><span>Fitness</span>${balken(fit, FIT(fit))}<b>${fit}</b></div>
        <div><span>Moral</span>${balken(mor, mor >= 70 ? '#3fcf7a' : mor >= 50 ? '#f0c05a' : '#f07462')}<b>${mor}</b></div>
        ${eigen && k ? `<div><span>Cap Hit</span><b class="app-weit">${mio(k.capHitJahr(p))}</b></div><div><span>Vertrag bis</span><b class="app-weit">${bis}</b></div>` : ''}
      </div>
      ${eigen && window.DFLSaisonwechsel ? DFLSaisonwechsel.blattInfo(p) : ''}
      ${window.DFLEbenen ? DFLEbenen.stilBlockHtml(p) : ''}
      <div class="app-blatt-aktionen">${aktionen.join('')}</div>
      <div class="app-angebote" hidden></div>
      <div class="app-statistik" hidden>
        <div class="app-stat-kopf"><b>Noten der Saison</b><small>${n.length ? `${n.length} Spiele · Schnitt ${(n.reduce((a, b) => a + b, 0) / n.length).toLocaleString('de-DE', { maximumFractionDigits: 1 })}` : 'noch kein Einsatz'}</small></div>
        <div class="app-noten">${n.slice(-10).map(x => `<i style="height:${Math.max(8, Math.min(100, (x - 4) / 6 * 100)).toFixed(0)}%"><b>${x.toLocaleString('de-DE', { maximumFractionDigits: 1 })}</b></i>`).join('') || '<small>Keine Spiele</small>'}</div>
      </div>
      <div class="app-blatt-details"></div>`;
    box.onclick = ev => {
      const an = ev.target.closest('[data-ang]');
      if (an) {
        const r = DFLTrade.blattAnnehmen(+an.getAttribute('data-ang'));
        if (typeof showToast === 'function') showToast(r.text || (r.ok ? 'Tausch abgeschlossen.' : 'Tausch nicht möglich.'), r.ok ? 'success' : 'warn');
        if (r.ok) { blattZu(); cta(); }
        return;
      }
      const b = ev.target.closest('[data-a]'); if (!b) return;
      const a = b.getAttribute('data-a');
      if (window.DFLSaisonwechsel && DFLSaisonwechsel.blattKlick(a, p, kontext)) return;
      if (a === 'tauschen') {
        blattZu();
        CLUB.selected = { type: kontext.typ, key: kontext.key };
        if (typeof renderPitch === 'function') { renderPitch(); renderBench(); }
        if (aktuelleAnsicht !== 'squad') { zeige('squad'); unterReiter('#view-squad', 'lineup'); }
        // Nutzer 2026-10-22: überflüssiger Text raus: am PC (body.pcu-an) ohne „Tippe …“, die Leiste mit „Abbrechen“ bleibt; am Handy unverändert
        hinweisAn(document.body.classList.contains('pcu-an') ? `Tauschen: ${kurz(p)}` : `Tauschen: Tippe den Spieler an, der für ${kurz(p)} kommt.`);
      } else if (a === 'ds') { k.inPerspektivkader(p.id); spielerBlatt(p, null); }
      else if (a === 'hoch') { k.hochziehen(p.id); spielerBlatt(p, null); }
      else if (a === 'vertrag') { blattZu(); zeige('squad'); unterReiter('#view-squad', 'vertraege'); }
      else if (a === 'unv') { DFLAnfragen.unverkaeuflich(p.id); spielerBlatt(p, kontext); }
      else if (a === 'anbieten') {
        const fl = box.querySelector('.app-angebote');
        if (!fl.hidden) { fl.hidden = true; b.setAttribute('aria-expanded', 'false'); return; }
        const r = DFLTrade.blattAngebote(p.id);
        fl.innerHTML = `<div class="app-stat-kopf"><b>Angebote für ${esc(kurz(p))}</b></div>${r.html}
          <button type="button" class="app-knopf" data-a="tradezentrale"><i class="ti ti-building-bank" aria-hidden="true"></i>In der Trade-Zentrale verhandeln</button>`;
        fl.hidden = false; b.setAttribute('aria-expanded', 'true');
        fl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
      else if (a === 'tradezentrale') { blattZu(); DFLTrade.oeffne(p.id); }
      else if (a === 'entlassen') {
        if (window.DFLEbenen && DFLEbenen.entlassenBlatt) { DFLEbenen.entlassenBlatt(p, kontext); return; }
        k.entlassen(p.id); if (!SQUAD.some(q => q.id === p.id)) { blattZu(); cta(); }
      }
      else if (a === 'statistik') {
        const st = box.querySelector('.app-statistik'); st.hidden = !st.hidden; b.setAttribute('aria-expanded', String(!st.hidden));
        if (!st.hidden) st.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
      else if (a === 'details') {
        const ziel = box.querySelector('.app-blatt-details');
        if (ziel.innerHTML) { ziel.innerHTML = ''; return; }
        if (typeof renderPlayerCard === 'function') renderPlayerCard(p);
        const karte = document.getElementById('playercard-sec');
        ziel.innerHTML = karte ? karte.innerHTML : '';
        ziel.querySelectorAll('[id]').forEach(e => e.removeAttribute('id'));
        b.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
    };
    const blatt = document.getElementById('app-blatt');
    blatt.classList.add('auf'); document.body.classList.add('app-gesperrt'); cta();
    neigung(box.querySelector('.fut'));
  }
  // Namensnennung (game-icons.net verlangt sie, CC BY 3.0) und Dank an die übrigen Quellen
  function mitwirkende() {
    const box = document.querySelector('#app-blatt .app-blatt-box'); if (!box) return;
    const gi = window.DFLSpielicons ? DFLSpielicons.autoren() : {};
    try {
      const L = window.DFL_LIGA && DFL_LIGA.franchises, I = window.DFLIdentitaet;
      if (L && I && I.mitwirkende) I.mitwirkende(L).forEach(x => { gi[x.autor] = (gi[x.autor] || []).concat(x.figuren); });
    } catch (e) { /* ohne Wappen-Daten */ }
    const autoren = Object.keys(gi).sort().map(a => `<li><b>${esc(a)}</b> – ${[...new Set(gi[a])].sort().map(esc).join(', ')}</li>`).join('');
    box.innerHTML = `<div class="app-griff"></div><button class="app-blatt-zu" aria-label="Schließen"><i class="ti ti-x" aria-hidden="true"></i></button>
      <div class="app-sheet-titel">Mitwirkende</div>
      <div class="app-lizenzen">
        <p><b>Icons und Wappenfiguren</b> von <a href="https://game-icons.net" target="_blank" rel="noopener">game-icons.net</a>,
          Lizenz <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noopener">CC BY 3.0</a>:</p>
        <ul>${autoren}</ul>
        <p><b>Vereinsgelände, Himmel, Startbild, Maskottchen (Cube Pets), Regler und Sterne:</b> Kenney (kenney.nl), CC0 – dazu eigene Low-Poly-Bauten.</p>
        <p><b>Wappenschilde:</b> Armoria von Azgaar, CC0. <b>Gesichter:</b> facesjs, MIT. <b>Bedien-Icons:</b> Tabler Icons, MIT.
          <b>Farben:</b> Radix Colors, MIT. <b>Schrift:</b> Rubik (The Rubik Project Authors), SIL OFL – auch die Schrift in den Wappen.</p>
      </div>`;
    document.getElementById('app-blatt').classList.add('auf'); document.body.classList.add('app-gesperrt'); cta();
  }
  // Stil Kenney Tag / Nacht (D54): nach Uhrzeit, Tag oder Nacht – gilt für dieses Gerät
  // Nutzer 2026-10-17: kein „Kenney“ in den Texten – nur Hellmodus/Dunkelmodus
  const STILE = [['auto', 'ti-clock', 'Nach Uhrzeit', '6–19 Uhr hell, sonst dunkel'], ['tag', 'ti-sun', 'Hellmodus', 'Beige und Holz'], ['nacht', 'ti-moon', 'Dunkelmodus', 'Dunkel mit Flutlicht']];
  function stilText() {
    const D = window.DFLDesign; if (!D || !D.stilWahl) return 'Hellmodus';
    const w = STILE.find(x => x[0] === D.stilWahl()); return w ? w[2] : 'Nach Uhrzeit';
  }
  // ── Einstellungen (Mehr → Einstellungen, 2026-10-11) ─────────────────────
  // Darstellung (Kenney Tag/Nacht, D54), Spiel als Text (D77: Modus und Tempo), Haltepunkte von „Simulieren bis …“ (D64). Alles je
  // Gerät, gelesen und gesetzt über die Module (DFLDesign, DFLTextspiel, DFLSimulieren). Später kommt hier ein Abschnitt für Ton
  // und Musik dazu – ohne Platzhalter-Knöpfe, solange es beides nicht gibt.
  const TEXT_WAHL = [['minute', 'ti-list-details', 'Jede Minute', 'etwa 2½ Minuten'], ['hoehepunkte', 'ti-flame', 'Höhepunkte', 'etwa 1 Minute'],
    ['aus', 'ti-player-track-next', 'Aus', 'sofort zum Ergebnis']];
  const HALTE = [['anfrage', 'Trade-Anfrage an dich', 'sonst läuft sie nach 2 Wochen ab'], ['ereignis', 'Ereignis mit Entscheidung', 'aus: die erste Antwort, dann weiter'],
    ['verletzung', 'Verletzung in der Startelf', 'aus: der beste Ersatz spielt, danach kehrt er zurück']];
  function einstellungenText() {
    const T = window.DFLTextspiel;
    return stilText() + (T && T.einstellungText ? ' · Spiel als Text: ' + T.einstellungText() : '') + (window.DFLTon ? ' · Ton ' + (DFLTon.an() ? 'an' : 'aus') : '');
  }
  function einstellungenBlatt() {
    const box = document.querySelector('#app-blatt .app-blatt-box'); if (!box) return;
    const D = window.DFLDesign, T = window.DFLTextspiel, SIM = window.DFLSimulieren;
    const kachel = (attr, wert, an, ic, t, sub) => `<button class="stil-kachel" type="button" ${attr}="${wert}" aria-pressed="${an}">
      <i class="ti ${ic}" aria-hidden="true"></i><b>${t}</b><small>${sub}</small></button>`;
    const malen = () => {
      const tx = T && T.einstellung ? T.einstellung() : null, tempo = T && T.tempo ? T.tempo() : 1;
      const ein = SIM && SIM.einstellungen ? SIM.einstellungen() : null;
      box.innerHTML = `<div class="app-griff"></div><button class="app-blatt-zu" aria-label="Schließen"><i class="ti ti-x" aria-hidden="true"></i></button>
        <div class="app-sheet-titel">Einstellungen</div>
        ${D && D.stilWahl ? `<section class="einst-gruppe" aria-label="Darstellung"><h4><i class="ti ti-sun-moon" aria-hidden="true"></i>Darstellung</h4>
          <div class="stil-wahl">${STILE.map(([w, ic, t, sub]) => kachel('data-stil', w, D.stilWahl() === w, ic, t, sub)).join('')}</div></section>` : ''}
        ${tx ? `<section class="einst-gruppe" aria-label="Spiel als Text"><h4><i class="ti ti-message-dots" aria-hidden="true"></i>Spiel als Text</h4>
          <div class="stil-wahl">${TEXT_WAHL.map(([w, ic, t, sub]) => kachel('data-textspiel', w, tx === w, ic, t, sub)).join('')}</div>
          <div class="einst-zeile"><span>Tempo</span><div class="einst-seg" role="group" aria-label="Tempo">${[1, 4].map(v =>
            `<button type="button" data-tempo="${v}" aria-pressed="${tempo === v}"${tx === 'aus' ? ' disabled' : ''}>${v}×</button>`).join('')}</div></div></section>` : ''}
        ${ein ? `<section class="einst-gruppe" aria-label="Simulieren bis"><h4><i class="ti ti-player-track-next" aria-hidden="true"></i>Simulieren bis … anhalten bei</h4>
          ${HALTE.map(([k, t, sub]) => `<button type="button" class="einst-schalter" role="switch" data-halt="${k}" aria-checked="${!!ein[k]}">
            <span><b>${t}</b><small>${sub}</small></span><i class="einst-bahn" aria-hidden="true"></i></button>`).join('')}
          <p class="stil-hinweis">Hält immer: Draft, Kaderschnitt, unter 21 Spielern, ohne 2 Torhüter, dein Playoff-Spiel, Saisonabschluss.</p></section>` : ''}
        ${window.DFLTon ? `<section class="einst-gruppe" aria-label="Ton"><h4><i class="ti ti-volume" aria-hidden="true"></i>Ton</h4>
          <button type="button" class="einst-schalter" role="switch" data-ton="1" aria-checked="${DFLTon.an()}">
            <span><b>Klänge</b><small>Anpfiff, Tor, Abpfiff, Draft-Pick, Titel</small></span><i class="einst-bahn" aria-hidden="true"></i></button></section>` : ''}
        ${window.DFLTutorial ? `<section class="einst-gruppe" aria-label="Spiel"><h4><i class="ti ti-adjustments-horizontal" aria-hidden="true"></i>Spiel</h4>
          <button type="button" class="einst-schalter einst-link" data-modus="1"><span><b>Spielmodus</b><small>${DFLTutorial.lite() ? 'Lite – Bereiche kommen nach und nach' : 'Voll – alles offen'}</small></span><i class="ti ti-chevron-right" aria-hidden="true"></i></button>
          ${typeof window.zeigeVorstandsEinfuehrung === 'function' ? `<button type="button" class="einst-schalter einst-link" data-erstertag="1"><span><b>Erster Tag</b><small>Rundgang mit Eigentümer und Chefscout</small></span><i class="ti ti-chevron-right" aria-hidden="true"></i></button>` : ''}</section>` : ''}
        <p class="stil-hinweis">Gilt für dieses Gerät.</p>
        ${typeof window.restartGame === 'function' ? `<section class="einst-gruppe einst-neustart" aria-label="Spielstand"><h4><i class="ti ti-refresh-alert" aria-hidden="true"></i>Spielstand</h4>
          <button type="button" class="app-knopf" data-neustart="1"><i class="ti ti-trash" aria-hidden="true"></i>Spiel neu starten</button></section>` : ''}`;
    };
    box.onclick = ev => {
      const b = ev.target.closest('button'); if (!b || b.disabled) return;
      if (b.dataset.stil && D) D.stilSetzen(b.dataset.stil);
      else if (b.dataset.textspiel && T) T.setzeEinstellung(b.dataset.textspiel);
      else if (b.dataset.tempo && T && T.setzeTempo) T.setzeTempo(+b.dataset.tempo);
      else if (b.dataset.halt && SIM && SIM.einstellungSetzen) SIM.einstellungSetzen(b.dataset.halt, b.getAttribute('aria-checked') !== 'true');
      else if (b.dataset.ton && window.DFLTon) { DFLTon.setzen(!DFLTon.an()); if (DFLTon.an()) DFLTon.spiele('pfiff'); }
      else if (b.dataset.modus && window.DFLTutorial) { blattZu(); DFLTutorial.wahl(null, { nurModus: true }); return; }
      else if (b.dataset.erstertag && typeof window.zeigeVorstandsEinfuehrung === 'function') { blattZu(); window.zeigeVorstandsEinfuehrung(); return; }
      else if (b.dataset.neustart && typeof window.restartGame === 'function') { blattZu(); window.restartGame(); return; }   // D121: aus dem Verein hierher
      else return;
      malen();
    };
    delete box.dataset.spieler;
    malen();
    document.getElementById('app-blatt').classList.add('auf'); document.body.classList.add('app-gesperrt'); cta();
  }
  function blattZu() {
    const b = document.getElementById('app-blatt'); if (!b) return;
    b.classList.remove('auf');
    if (!offen('app-sheet')) document.body.classList.remove('app-gesperrt');
    cta();
  }
  function hinweisAn(text) {
    const h = document.getElementById('app-hinweis'); if (!h) return;
    h.innerHTML = `<span>${esc(text)}</span><button type="button">Abbrechen</button>`; h.classList.add('auf');
  }
  function hinweisAus() { const h = document.getElementById('app-hinweis'); if (h) h.classList.remove('auf'); }

  // ── Kaderschnitt vor Spieltag 1 (Cap, 28er-Kader, Development Squad) ─────
  // Vorschläge beim Cap: erst Bankspieler, deren Entlassung allein reicht (schwächste zuerst), dann die mit der größten
  // Ersparnis, Startelf zuletzt; Ersparnis = Cap Hit minus Dead Cap. Kader zu groß: Junge (Development Squad) vor Schwachen.
  function kaderschnitt() {
    const k = K(), box = document.querySelector('#app-blatt .app-blatt-box');
    if (!k || !box) return;
    const fehler = k.startPruefung(), belegt = k.capBelegt(), limit = k.capLimit();
    const haupt = k.hauptkader(), dsPlaetze = (window.DFLSaison && DFLSaison.CFG.perspektiv) || 6;
    const dsListe = SQUAD.filter(p => p.perspektiv), ds = dsListe.length;
    const zuViel = Math.max(0, belegt - limit), zuGross = Math.max(0, haupt.length - 28), zuWenig = Math.max(0, k.MIN() - haupt.length);
    const twFehlt = k.twFehlt ? k.twFehlt() : 0, twN = k.torhueter ? k.torhueter().length : 2, twMin = k.TW_MIN || 2;   // D136
    const startelf = new Set(Object.values(CLUB.lineup || {}));
    const ziel = (ok, icon, titel, text) => `<div class="ks-ziel ${ok ? 'ok' : 'rot'}"><i class="ti ${ok ? 'ti-circle-check' : icon}" aria-hidden="true"></i><span><b>${titel}</b><small>${text}</small></span></div>`;
    const kopf = (p, extra) => `${portraet(p, true)}<span class="ks-wer"><b>${esc(kurz(p))}</b>
          <small><span class="pos-badge-sm pos-${p.pos}">${p.pos}</span> ${p.age} J · Stärke ${p.freeAgent && window.DFLScouting && DFLScouting.aktiv() ? DFLScouting.staerkeText(p) : p.ovr}${extra || ''}</small>`;
    const alle = box.dataset.ksAlle === '1';
    let titel, liste = [], gesamt = 0, hinweis = '';
    // Zu teuer UND zu klein (z. B. nach Vertragsenden mit steigenden Gehältern): erst Cap-Platz schaffen, sonst passt kein
    // Free Agent und das Blatt bot nichts an (Dynastie-Test 2026-10-10: 18,8 Mio zu viel bei 20 Spielern)
    if ((zuWenig || twFehlt) && !zuViel && !zuGross) {
      // Kader zu klein: erst aus dem Development Squad hochziehen, dann bezahlbare Free Agents (fehlende Positionen zuerst)
      // Position dünn = unter 60 % des Solls aus dem Generator für deine Formation (D95: zwölf Positionen mit Seite, DFLGenerator.kaderSoll;
      // Welt-Kürzel – ZOM heißt dort OM)
      const Gn = window.DFLGenerator, wpos = x => (Gn && Gn.dflPos ? Gn.dflPos(x) : x);
      const soll = (Gn && Gn.kaderSoll ? Gn.kaderSoll({ formation: CLUB.formation }) : Gn && Gn.CFG && Gn.CFG.kader) || {};
      const anzahl = {}; haupt.forEach(p => { anzahl[wpos(p.pos)] = (anzahl[wpos(p.pos)] || 0) + 1; });
      const duenn = pos => (anzahl[wpos(pos)] || 0) < Math.ceil((soll[wpos(pos)] || 2) * 0.6);
      const frei = Math.max(0, CLUB.wageBudget || 0);
      // D136: fehlt ein Torhüter, stehen Torhüter vorn; fehlt nur der Torhüter, nur Torhüter
      const tw = p => (twFehlt && p.pos === 'TW' ? 1 : 0), nurTw = twFehlt && !zuWenig;
      const fas = (CLUB.freeAgents || []).filter(p => (p.faWageDemand || p.wage) <= frei && (!nurTw || p.pos === 'TW'))
        .sort((a, b) => (tw(b) - tw(a)) || (duenn(b.pos) - duenn(a.pos)) || b.ovr - a.ovr);
      const dsWahl = dsListe.filter(p => !nurTw || p.pos === 'TW').sort((a, b) => tw(b) - tw(a));
      titel = nurTw ? `Noch ${twFehlt} Torhüter bis ${twMin}: hochziehen oder Free Agents holen`
        : `Noch ${zuWenig} Spieler bis ${k.MIN()}${twFehlt ? `, davon ${twFehlt} im Tor` : ''}: hochziehen oder Free Agents holen`;
      liste = dsWahl.map(p => `<div class="ks-zeile">${kopf(p, ' · Development Squad')}<small class="ks-geld">Vertrag läuft weiter, kein neues Geld</small></span>
          <span class="ks-tun"><button class="ks-knopf gruen" data-hoch="${p.id}"><i class="ti ti-arrow-up" aria-hidden="true"></i>Hoch</button></span></div>`)
        .concat(fas.map(p => `<div class="ks-zeile">${kopf(p, tw(p) ? ' · <em class="ks-fehlt">Torhüter fehlt</em>' : duenn(p.pos) ? ' · <em class="ks-fehlt">Position dünn</em>' : '')}
          <small class="ks-geld">fordert ${mio((p.faWageDemand || p.wage) * 52)} pro Jahr · ${esc(p.fromClub || 'vereinslos')}</small></span>
          <span class="ks-tun"><button class="ks-knopf gruen" data-holen="${p.id}"><i class="ti ti-signature" aria-hidden="true"></i>Holen</button></span></div>`));
      gesamt = liste.length;
      const twFrei = twFehlt ? (CLUB.freeAgents || []).filter(p => p.pos === 'TW').length : 0;
      // Kein Torhüter passt in den Cap und keiner im Development Squad: erst Platz schaffen – Vorschläge wie beim Cap (Bank vor Startelf,
      // größte Ersparnis zuerst), nie ein Torhüter; in der Saison nur, solange der Kader über dem Mindestkader liegt
      if (nurTw && !liste.length && (!k.saisonLaeuft() || haupt.length > k.MIN())) {
        titel = `Erst Cap-Platz schaffen, dann ${twFehlt} Torhüter holen`;
        liste = haupt.filter(p => p.pos !== 'TW').map(p => ({ p, spart: k.capHitJahr(p) - k.deadCapVon(p), dead: k.deadCapVon(p), stamm: startelf.has(p.id) }))
          .filter(x => x.spart > 0).sort((a, b) => (a.stamm - b.stamm) || b.spart - a.spart)
          .map(x => `<div class="ks-zeile">${kopf(x.p, x.stamm ? ' · Startelf' : '')}
            <small class="ks-geld">spart ${mio(x.spart)}${x.dead ? ` · Dead Cap ${mio(x.dead)}` : ''}</small></span>
            <span class="ks-tun"><button class="ks-knopf rot" data-weg="${x.p.id}"><i class="ti ti-scissors" aria-hidden="true"></i>Entlassen</button></span></div>`);
        gesamt = liste.length;
      }
      if (!fas.length) hinweis = `${nurTw ? 'Kein freier Torhüter' : 'Kein Free Agent'} passt in den freien Cap (${mio(frei * 52)}) – Platz schaffen über die <button class="ks-link" data-trades="1">Trade-Zentrale</button>.`;
      if (twFehlt) hinweis += `${hinweis ? '<br>' : ''}<button class="ks-link" data-fa-tw="1">Alle freien Torhüter (${twFrei})</button>`;
    } else if (fehler.length) {
      // Zu teuer oder zu groß: Vorschläge zum Entlassen bzw. für den Development Squad
      const kand = haupt.map(p => ({ p, spart: k.capHitJahr(p) - k.deadCapVon(p), dead: k.deadCapVon(p), stamm: startelf.has(p.id),
        ds: k.pkTauglich(p) && ds < dsPlaetze }))
        .filter(x => zuViel ? x.spart > 0 : true)
        .filter(x => x.p.pos !== 'TW' || twN > twMin)                     // D136: nie unter 2 Torhüter schneiden
        .sort(zuViel
          ? (a, b) => (a.stamm - b.stamm) || ((b.spart >= zuViel) - (a.spart >= zuViel)) || (a.spart >= zuViel ? a.p.ovr - b.p.ovr : b.spart - a.spart)
          : (a, b) => (a.stamm - b.stamm) || (b.ds - a.ds) || ((a.spart < 0) - (b.spart < 0)) || (a.p.ovr - b.p.ovr));
      titel = zuViel && (zuWenig || twFehlt) ? `Erst Cap-Platz schaffen (${mio(zuViel)}), dann ${zuWenig ? `auf ${k.MIN()} auffüllen` : 'einen Torhüter holen'}`
        : zuViel ? 'Vorschläge: viel Ersparnis, wenig Stärkeverlust' : 'Vorschläge: Junge in den Development Squad, sonst die Schwächsten';
      liste = kand.map(x => {
        const p = x.p, reicht = zuViel && x.spart >= zuViel;
        const geld = x.spart >= 0 ? `spart ${mio(x.spart)}` : `<span class="app-rot">kostet ${mio(-x.spart)} mehr</span>`;
        return `<div class="ks-zeile">${kopf(p, x.stamm ? ' · Startelf' : '')}
            <small class="ks-geld">${geld}${x.dead ? ` · Dead Cap ${mio(x.dead)}` : ''}${reicht ? ' · <em>reicht allein</em>' : ''}</small></span>
          <span class="ks-tun">${x.ds && zuGross ? `<button class="ks-knopf gruen" data-ds="${p.id}"><i class="ti ti-plant-2" aria-hidden="true"></i>DS</button>` : ''}
            <button class="ks-knopf rot" data-weg="${p.id}"><i class="ti ti-scissors" aria-hidden="true"></i>Entlassen</button></span></div>`;
      });
      gesamt = liste.length;
      const knapp = zuViel && haupt.length <= k.MIN() + 1 && !zuWenig;
      hinweis = `${zuWenig ? `Danach mit günstigen Free Agents auf ${k.MIN()} auffüllen – oder einen teuren Spieler gegen zwei günstige tauschen.<br>`
          : knapp ? `Der Kader ist fast bei ${k.MIN()} – jetzt hilft Tauschen gegen günstigere Spieler oder ein billiger Free Agent.<br>` : 'Lieber tauschen statt entlassen? '}
          <button class="ks-link" data-trades="1">Trade-Zentrale</button> · <button class="ks-link" data-fa="1">Free Agents</button>`;
    }
    // Nutzer 2026-10-22: überflüssiger Text raus (Kopf: „– wie in der NFL“; „Kader passt“: „Weiter geht’s mit dem Haupt-Button.“)
    box.innerHTML = `<div class="app-griff"></div><button class="app-blatt-zu" aria-label="Schließen"><i class="ti ti-x" aria-hidden="true"></i></button>
      <div class="ks-kopf"><b>${twFehlt && !zuWenig && !zuViel && !zuGross ? 'Torhüter holen' : zuWenig && !zuViel ? 'Kader auffüllen' : 'Kaderschnitt'}</b><small>${k.saisonLaeuft() ? `Während der Saison müssen mindestens ${k.MIN()} Spieler und ${twMin} Torhüter im Kader sein.` : 'Bis zum 1. Spieltag muss der Kader passen.'}</small></div>
      <div class="ks-ziele">
        ${ziel(!zuViel, 'ti-coin', 'Salary Cap', `${mio(belegt)} von ${mio(limit)}${zuViel ? ` – <b class="app-rot">${mio(zuViel)} zu viel</b>` : ''}`)}
        ${ziel(!zuGross && !zuWenig, 'ti-users', 'Kader', `${haupt.length} Spieler · erlaubt ${k.MIN()}–28`)}
        ${ziel(!twFehlt, 'ti-hand-stop', 'Torhüter', `${twN} im Kader · mindestens ${twMin}`)}
        ${ziel(ds <= dsPlaetze, 'ti-plant-2', 'Development Squad', `${ds} von ${dsPlaetze} · zählt gegen den Cap`)}
      </div>
      ${fehler.length ? `<div class="ks-titel">${titel}</div>
        <div class="ks-liste">${(alle ? liste : liste.slice(0, 6)).join('')}</div>
        ${gesamt > 6 ? `<button class="app-knopf ks-mehr" data-alle="1">${alle ? 'Weniger anzeigen' : `Alle ${gesamt} anzeigen`}</button>` : ''}
        ${hinweis ? `<div class="ks-hinweis">${hinweis}</div>` : ''}`
      : `<div class="ks-fertig"><i class="ti ti-circle-check" aria-hidden="true"></i><b>Kader passt</b></div>
        <button class="app-knopf haupt" data-fertig="1"><i class="ti ti-check" aria-hidden="true"></i>Fertig</button>`}`;
    box.onclick = ev => {
      const t = ev.target.closest('button'); if (!t) return;
      const wer = id => SQUAD.find(x => String(x.id) === id);
      if (t.dataset.weg) {
        const p = wer(t.dataset.weg); if (!p) return;
        k.entlassen(p.id);
        if (!SQUAD.includes(p)) kaderschnitt();     // abgebrochen → Knopf bleibt (Ersatz-Dialog klickt ihn erneut)
      } else if (t.dataset.ds) { const p = wer(t.dataset.ds); if (p) { k.inPerspektivkader(p.id); kaderschnitt(); } }
      else if (t.dataset.hoch) { const p = wer(t.dataset.hoch); if (p) { k.hochziehen(p.id); kaderschnitt(); } }
      else if (t.dataset.holen) { blattZu(); if (typeof signFreeAgent === 'function') signFreeAgent(t.dataset.holen); }   // Vertragsdialog des Spiels
      else if (t.dataset.alle) { box.dataset.ksAlle = alle ? '' : '1'; kaderschnitt(); }
      else if (t.dataset.trades) { blattZu(); zeige('transfer'); unterReiter('#view-transfer', 'trades'); }
      else if (t.dataset.fa) { blattZu(); zeige('transfer'); unterReiter('#view-transfer', 'frei'); }
      else if (t.dataset.faTw) { blattZu(); if (k.faFilter) k.faFilter('TW'); zeige('transfer'); unterReiter('#view-transfer', 'frei'); }   // D136
      else if (t.dataset.fertig) blattZu();
    };
    const blatt = document.getElementById('app-blatt');
    blatt.classList.add('auf'); document.body.classList.add('app-gesperrt'); cta();
  }

  // Spielbericht: Pfeil-Emoji im Weiter-Knopf → Icon (Knopf selbst bleibt per CSS unten stehen)
  new MutationObserver(() => {
    const b = document.getElementById('pm-continue-btn');
    if (b && !b.dataset.dfl) { b.dataset.dfl = '1'; b.innerHTML = b.innerHTML.replace('➡️', '<i class="ti ti-arrow-right" aria-hidden="true"></i>'); }
  }).observe(document.body, { childList: true });

  // Antippen am Handy öffnet das Blatt; ist schon jemand zum Tauschen gewählt, läuft der Klick normal weiter
  document.addEventListener('click', ev => {
    if (!shell()) return;
    const row = ev.target.closest('#squad-list .squad-row, .depth-row');
    if (!row) return;
    if (CLUB.selected) { setTimeout(hinweisAus, 0); return; }
    const attr = row.getAttribute('onclick') || '';
    const slot = /clickSlot\('([^']+)'\)/.exec(attr), bank = /clickBench\('([^']+)'\)/.exec(attr), tief = /getPlayer\('([^']+)'\)/.exec(attr);
    const p = slot ? spieler(CLUB.lineup[slot[1]]) : bank ? spieler(bank[1]) : tief ? spieler(tief[1]) : null;
    if (!p) return;
    ev.stopPropagation(); ev.preventDefault();
    spielerBlatt(p, slot ? { typ: 'slot', key: slot[1] } : bank ? { typ: 'bench', key: bank[1] } : null);
  }, true);
  {
    const _orig = window.showSquadPlayerCard;
    window.showSquadPlayerCard = function (id) {
      if (shell()) { spielerBlatt(spieler(id), null); return; }
      return typeof _orig === 'function' ? _orig.apply(this, arguments) : undefined;
    };
  }

  // ── Taktikfeld: Gesicht, Positionskürzel, Fitness (D47) ──────────────────
  {
    const _orig = window.renderPitch;
    if (typeof _orig === 'function') window.renderPitch = function () {
      const r = _orig.apply(this, arguments);
      if (!dfl() || !I() || typeof FORMATIONS === 'undefined') return r;
      const slots = FORMATIONS[CLUB.formation] || [], els = document.querySelectorAll('#pitch .p-slot');
      slots.forEach((slot, i) => {
        const el = els[i], pid = CLUB.lineup[slot.id], p = pid && spieler(pid);
        if (!el || !p) return;
        const tok = el.querySelector('.p-token'); if (!tok || tok.classList.contains('mit-gesicht')) return;
        const pos = tok.textContent.trim(), fit = fitness(p);
        tok.classList.add('mit-gesicht');
        tok.innerHTML = `<span class="tk-gesicht">${I().gesichtSvg(p, farben())}</span><span class="tk-pos">${esc(pos)}</span>`;
        tok.insertAdjacentHTML('afterend', `<div class="tk-fit" title="Fitness ${fit}"><i style="width:${fit}%;background:${FIT(fit)}"></i></div>`);
        // Ausfall direkt auf dem Feld (Fehler 2026-10-13: verletzte/gesperrte Stammspieler sahen auf dem Feld normal aus):
        // abgeblendet + Marke mit Wochen bzw. Spielen; beim Anpfiff ersetzt D65 sie ohnehin
        const inj = typeof isInjured === 'function' ? isInjured(p) : p.injuryWeeks > 0, sus = typeof isSuspended === 'function' && isSuspended(p);
        if (inj || sus || p.onStrike) {
          el.classList.add('tk-ausfall');
          tok.insertAdjacentHTML('beforeend', inj ? `<span class="tk-aus" title="Verletzt: noch ${p.injuryWeeks} Woche${p.injuryWeeks === 1 ? '' : 'n'}"><i class="ti ti-bandage" aria-hidden="true"></i>${p.injuryWeeks}</span>`
            : sus ? `<span class="tk-aus gesperrt" title="Gesperrt: ${p.suspendedGames} Spiel${p.suspendedGames === 1 ? '' : 'e'}"><i class="ti ti-ban" aria-hidden="true"></i>${p.suspendedGames}</span>`
            : '<span class="tk-aus gesperrt" title="Streik"><i class="ti ti-hand-stop" aria-hidden="true"></i></span>');
        }
        if (shell()) el.onclick = () => { if (CLUB.selected) { hinweisAus(); clickSlot(slot.id); } else spielerBlatt(p, { typ: 'slot', key: slot.id }); };
      });
      // Ein Knopf statt Schieben: „Beste Elf“ (lineup_auto_patch.js: Position + Stärke, ohne Verletzte, Gesperrte, Development Squad)
      const zeile = document.querySelector('#sub-lineup .formation-row');
      if (zeile && !zeile.querySelector('.beste-elf') && typeof window.besteAufstellung === 'function') {
        zeile.insertAdjacentHTML('beforeend', '<button type="button" class="app-knopf beste-elf"><i class="ti ti-wand" aria-hidden="true"></i>Beste Elf</button>');
        zeile.querySelector('.beste-elf').addEventListener('click', () => {
          CLUB.selected = null; hinweisAus();
          // DFL: auch die Formation – die stärkste der Formationen, die zum eigenen Stil passen (dfl_taktik_patch.js)
          const f = window.DFLTaktik && DFLTaktik.besteElf ? DFLTaktik.besteElf() : (window.besteAufstellung(), null);
          if (typeof window.showToast === 'function') window.showToast(f ? `Beste Elf steht (${f}).` : 'Beste Elf steht.', 'success');
        });
      }
      return r;
    };
  }
  // Spielerkarte: ganzes Porträt (Kopf, Schultern, Trikot) statt Kreis
  {
    const _orig = window.renderPlayerCard;
    if (typeof _orig === 'function') window.renderPlayerCard = function (p) {
      const r = _orig.apply(this, arguments);
      const g = dfl() && p && document.querySelector('#playercard-sec .dfl-pcard-gesicht');
      if (g && !g.querySelector('.dfl-portrait')) g.innerHTML = portraet(p);
      return r;
    };
  }
  // Kader-Marken (Nutzer 2026-10-10: „Rookies als Rookies in der Aufstellung angeben. Talent raus. Star sollte rein“): in der
  // DFL nur noch zwei Marken – Rookie (erste Saison im Rookie-Vertrag) und Star (Kaderrolle aus contracts_patch.js);
  // Stamm/Rotation/Ergänzung/Talent ohne Marke. Die Rollen selbst (Moral, Verhandlung) bleiben unverändert.
  function istRookie(p) {
    const rv = p && p.rookieVertrag, c = p && p.contract;
    if (!rv) return false;
    if (rv.jahr != null) { const L = window.DFLSpiel && DFLSpiel.liga && DFLSpiel.liga(); return !!L && rv.jahr === L.saisonJahr; }
    // Startkader: Rookie-Vertrag ohne Draftjahr – im ersten Vertragsjahr
    return !!(c && c.art === 'rookie' && c.years_total && c.years_remaining >= c.years_total);
  }
  {
    const _orig = window.squadRoleBadge;
    if (typeof _orig === 'function') window.squadRoleBadge = function (p) {
      if (!dfl() || !p) return _orig.apply(this, arguments);
      const star = typeof window.squadRoleFor === 'function' && window.squadRoleFor(p).key === 'star';
      return (istRookie(p) ? '<span class="role-badge role-rookie" title="Erste Saison nach dem Draft">Rookie</span>' : '') +
        (star ? '<span class="role-badge role-star" title="Starspieler: erwartet fast jedes Spiel">Star</span>' : '');
    };
    try { squadRoleBadge = window.squadRoleBadge; } catch (e) { /* window reicht */ }
  }
  // Startelf-Liste: kleine Porträts
  {
    const _orig = window.renderSquadList;
    if (typeof _orig === 'function') window.renderSquadList = function () {
      const r = _orig.apply(this, arguments);
      if (dfl()) document.querySelectorAll('#squad-list .squad-row .dfl-face').forEach(f => { f.className = 'dfl-portrait klein'; });
      return r;
    };
  }
  // Kaderliste: Position, Stärke, Cap Hit (Marktwert gibt es in der DFL nicht – keine Ablösen)
  {
    const _orig = window.renderSquadOverview;
    if (typeof _orig === 'function') window.renderSquadOverview = function () {
      const r = _orig.apply(this, arguments);
      const k = K();
      if (!dfl() || !k) return r;
      document.querySelectorAll('#sub-squadlist .sqo-row').forEach(row => {
        const m = /showSquadPlayerCard\('([^']+)'\)/.exec(row.getAttribute('onclick') || ''), p = m && spieler(m[1]);
        if (!p) return;
        const v = row.querySelector('.sqo-val'); if (v) { v.textContent = mio(k.capHitJahr(p)).replace(' €', ''); v.title = 'Cap Hit'; v.classList.add('ist-cap'); }
        if (!row.querySelector('.dfl-portrait')) row.querySelector('.pos-badge-sm').insertAdjacentHTML('afterend', portraet(p, true));
        const nm = row.querySelector('.sqo-name');
        // DFL-Spieler sind alle generiert und deutsch – die Flagge kostet nur Platz
        if (nm && nm.firstChild && nm.firstChild.nodeType === 3) nm.firstChild.nodeValue = nm.firstChild.nodeValue.replace(/^[\u{1F1E6}-\u{1F1FF}]{2}\s*/u, '');
        if (p.perspektiv && nm && !row.querySelector('.dfl-pk')) nm.insertAdjacentHTML('beforeend', ' <span class="dfl-pk" title="Development Squad">DS</span>');
        // Marken Rookie/Star in eine zweite Zeile unter den Namen (neben dem Namen kürzten sie ihn am Handy auf „O. Günt…“)
        if (nm && nm.querySelector('.role-badge') && !nm.querySelector('.sqo-marken')) {
          const marken = document.createElement('span'), txt = document.createElement('span');
          marken.className = 'sqo-marken'; txt.className = 'sqo-nm';
          nm.querySelectorAll('.role-badge').forEach(b => marken.appendChild(b));
          while (nm.firstChild) txt.appendChild(nm.firstChild);
          nm.append(txt, marken);
        }
        // Verletzt/gesperrt (Nutzer 2026-10-10: „Wieso steht verletzt da, aber sie sind nicht durchgestrichen?“): Name
        // durchgestrichen (CSS .unavailable) und Marke mit den Wochen bzw. Spielen
        if (nm && !row.querySelector('.sqo-aus')) {
          const inj = typeof isInjured === 'function' && isInjured(p), sus = typeof isSuspended === 'function' && isSuspended(p);
          // neben dem Namen (nicht darin: lange Namen werden abgeschnitten, die Marke ginge mit verloren)
          if (inj) nm.insertAdjacentHTML('afterend', `<span class="sqo-aus" title="Verletzt: noch ${p.injuryWeeks} Woche${p.injuryWeeks === 1 ? '' : 'n'}"><i class="ti ti-bandage" aria-hidden="true"></i>${p.injuryWeeks}</span>`);
          else if (sus) nm.insertAdjacentHTML('afterend', `<span class="sqo-aus gesperrt" title="Gesperrt: ${p.suspendedGames} Spiel${p.suspendedGames === 1 ? '' : 'e'}"><i class="ti ti-ban" aria-hidden="true"></i>${p.suspendedGames}</span>`);
          else if (p.onStrike) nm.insertAdjacentHTML('afterend', '<span class="sqo-aus gesperrt" title="Streik: verweigert die Mitarbeit"><i class="ti ti-hand-stop" aria-hidden="true"></i></span>');
          else if (p.wantsOut) nm.insertAdjacentHTML('afterend', '<span class="sqo-aus weg" title="Will getradet werden"><i class="ti ti-door-exit" aria-hidden="true"></i></span>');
        }
        // D54: Form −2…+2 und Fitness; Restvertrag unter dem Cap Hit
        if (!row.querySelector('.sqo-formfit')) {
          const fit = fitness(p), jahre = p.contractUntil != null && typeof LEAGUE !== 'undefined' ? p.contractUntil - LEAGUE.season : null;
          const ovrEl = row.querySelector('.squad-ovr');
          if (ovrEl) ovrEl.insertAdjacentHTML('afterend', `<span class="sqo-formfit">${formHtml(formVon(p))}<span class="sqo-fit" title="Fitness ${fit}"><i style="width:${fit}%;background:${FIT(fit)}"></i></span></span>`);
          if (v) v.innerHTML = `<b>${(k.capHitJahr(p) / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 1 })}</b>${jahre == null ? '' : jahre <= 0 ? 'endet' : jahre + ' J.'}`;
          row.classList.add('sqo-d54');
        }
      });
      // Legende über der Liste
      const anzahl = document.querySelector('#sub-squadlist .sqo-count');
      if (anzahl && !document.querySelector('#sub-squadlist .form-legende')) anzahl.insertAdjacentHTML('afterend',
        `<div class="form-legende" aria-hidden="true"><span>Form</span>${[-2, -1, 0, 1, 2].map(formHtml).join('')}</div>`);
      const wert = [...document.querySelectorAll('#sub-squadlist .pos-filter-btn')].find(b => /setSqSort\('value'\)/.test(b.getAttribute('onclick') || ''));
      if (wert) wert.remove();
      return r;
    };
  }

  // ── Front Office ─────────────────────────────────────────────────────────
  // D121 (Kurze Wege, 2026-10-13): oben die Cap-Zeile, darunter eine große Kachel nach Phase, dann feste Kacheln (Trades, Scouting,
  // Verträge, Trainerteam), unten schmale Zeilen (Finanzen, Anlagen, Cap nach Positionen zum Aufklappen). Nur die erste Kachel wechselt.
  function foPhase() {
    const k = K(), L = window.DFLSpiel ? DFLSpiel.liga() : null;
    const SW = window.DFLSaisonwechsel, sv = SW && SW.zustand && SW.zustand() ? SW.ctaText() : null;
    const H = window.DFLHandel, deadline = H && H.CFG ? H.CFG.deadlineSpieltag : 16;
    const md = LEAGUE.matchday || 0, wo = LEAGUE.week || 1;
    const dd = LEAGUE.dflDraft;
    const fa = (CLUB.freeAgents || []).length;
    const ang = window.DFLAnfragen && DFLAnfragen.offeneAngebote ? DFLAnfragen.offeneAngebote().length : 0;
    const CS = window.DFLChefscout, pick = CS && CS.eigenerPick ? CS.eigenerPick() : null;
    if (sv != null) return { go: 'sv', icon: 'ti-calendar-event', titel: 'Saisonvorbereitung', text: sv || 'Verlängern, Vormerken' };
    if (dd && !dd.fertig) return { go: 'draft', icon: 'ti-school', titel: `Draft ${dd.jahr}`, text: pick ? `Dein nächster Pick: ${pick}` : 'Der Draft läuft' };
    if (md === 0 && wo >= 2 && wo <= 5) return { go: 'frei', icon: 'ti-user-plus', titel: 'Free Agency', text: `${fa} Spieler noch frei` };
    if (md === 0 && k) {
      const zuViel = k.capBelegt() > k.capLimit(), zuGross = k.hauptkader().length > 28;
      if (zuViel || zuGross || wo >= 6) return { go: 'kaderschnitt', icon: 'ti-scissors', titel: 'Kader regelkonform', text: zuViel ? 'Über dem Cap' : zuGross ? `${k.hauptkader().length} von 28` : 'Cap und 28 passen' , warn: zuViel || zuGross };
    }
    if (md < deadline) return { go: 'trades', icon: 'ti-arrows-left-right', titel: 'Trades', text: ang ? `${ang} ${ang === 1 ? 'Angebot' : 'Angebote'} · Deadline Spieltag ${deadline - 1}` : `Deadline Spieltag ${deadline - 1}` };
    const j = L && (L.draft || L.draftNaechste);
    return { go: 'scout', icon: 'ti-school', titel: 'Scouting', text: j ? `Draft ${j.jahr}${pick ? ' · dein Pick ' + pick : ''}` : 'Draft-Jahrgang' };
  }
  function foHtml() {
    const k = K(); if (!k) return '';
    const belegt = k.capBelegt(), limit = k.capLimit(), basis = k.cap(), unten = 0.89 * basis;
    const lage = belegt > limit ? 'rot' : belegt < unten ? 'gold' : 'gruen';
    const haupt = k.hauptkader().length, ds = SQUAD.filter(p => p.perspektiv).length;
    const auslaufend = SQUAD.filter(p => !p.perspektiv && p.contractUntil <= LEAGUE.season && !p.vertragFolge).length;   // mit Folgevertrag (D92) bleibt er
    const H = window.DFLHandel, deadline = H && H.CFG ? H.CFG.deadlineSpieltag : 16;
    const plan = CLUB._budgetBreakdown ? CLUB._budgetBreakdown.fixBalance : null;
    const ang = window.DFLAnfragen && DFLAnfragen.offeneAngebote ? DFLAnfragen.offeneAngebote().length : 0;
    const kachel = (go, icon, titel, text, kl) => `<button class="fo-kachel${kl ? ' ' + kl : ''}" data-go="${go}"><i class="ti ${icon}" aria-hidden="true"></i><b>${titel}</b><small>${text}</small></button>`;
    const ph = foPhase();
    // Steht Trades oder Scouting schon groß oben, hält der Platz darunter die Free Agency (keine Kachel doppelt)
    const fa = (CLUB.freeAgents || []).length;
    const frei = kachel('frei', 'ti-user-plus', 'Free Agency', fa ? `${fa} ohne Vertrag` : 'Spieler ohne Vertrag');
    const A = window.DFLAnlagen, marode = A && A.KEYS && A.z ? A.KEYS.filter(x => A.z(x) < 30).length : 0;
    const zeile = (go, icon, titel, wert, warn) => `<button type="button" class="fo-zeile2${warn ? ' warn' : ''}" data-go="${go}"><span><i class="ti ${icon}" aria-hidden="true"></i>${titel}</span><span>${wert}<i class="ti ti-chevron-right" aria-hidden="true"></i></span></button>`;
    return `<div class="fo fo-kurz">
      <div class="fo-kopf"><span class="fo-ueber">${esc(CLUB.name)}</span><h2>Front Office</h2></div>
      <section class="fo-capzeile" aria-label="Salary Cap">
        <div class="fo-zeile"><span>Cap</span><b>${mio(belegt)} <small>von ${mio(limit)}</small></b></div>
        <div class="fo-cap ${lage}"><i style="width:${Math.min(100, belegt / limit * 100).toFixed(1)}%"></i><em style="left:${Math.min(100, unten / limit * 100).toFixed(1)}%" title="Untergrenze 89 %"></em></div>
        ${lage === 'rot' ? `<div class="fo-lage rot"><i class="ti ti-alert-triangle" aria-hidden="true"></i> ${mio(belegt - limit)} über dem Cap</div>` : ''}
        <div class="fo-mini"><span>Kader <b>${haupt}</b></span><span>Dev. Squad <b>${ds}/6</b></span><span>Kasse <b>${mio(CLUB.budget)}</b></span></div>
        ${window.DFLWerbung ? DFLWerbung.zeileHtml() : ''}
      </section>
      <div class="fo-kacheln">
        ${kachel(ph.go, ph.icon, esc(ph.titel), esc(ph.text), 'fo-gross' + (ph.warn ? ' warn' : ''))}
        ${ph.go === 'trades' ? frei : kachel('trades', 'ti-arrows-left-right', 'Trades', ang ? `${ang} ${ang === 1 ? 'Angebot' : 'Angebote'}` : LEAGUE.matchday < deadline ? `Deadline Spieltag ${deadline - 1}` : 'Deadline vorbei')}
        ${ph.go === 'scout' ? frei : kachel('scout', 'ti-school', 'Scouting', window.DFLScouting && DFLScouting.kachelText ? esc(DFLScouting.kachelText() || 'Draft') : 'Draft')}
        ${kachel('vertraege', 'ti-file-certificate', 'Verträge', auslaufend ? `${auslaufend} laufen aus` : 'Cap Hits')}
        ${window.DFLTrainerteam ? kachel('trainer', 'ti-users-group', 'Trainerteam', esc(DFLTrainerteam.kachelText())) : ''}
      </div>
      <div class="fo-zeilen">
        ${zeile('club', 'ti-wallet', 'Finanzen', plan != null ? `Plan ${plan >= 0 ? '+' : '−'}${mio(Math.abs(plan))}` : '')}
        ${A ? zeile('anlagen', 'ti-building-stadium', 'Anlagen', marode ? `${marode} marode` : `${A.KEYS.length} Anlagen`, marode) : ''}
        <details class="fo-zeile2 fo-auf"><summary><span><i class="ti ti-chart-bar" aria-hidden="true"></i>Cap nach Positionen</span><i class="ti ti-chevron-down" aria-hidden="true"></i></summary><div class="fo-cap-pos"></div></details>
      </div></div>`;
  }
  function foZeigen() {
    let v = document.getElementById('view-fo');
    if (!v) {
      v = document.createElement('div'); v.className = 'app-view'; v.id = 'view-fo';
      const letzte = [...document.querySelectorAll('.app > .app-view')].pop();
      if (letzte) letzte.insertAdjacentElement('afterend', v); else (document.querySelector('.app') || document.body).appendChild(v);
      v.addEventListener('click', ev => {
        const b = ev.target.closest('.fo-kachel, .fo-zeile2[data-go]'); if (!b) return;
        const go = b.getAttribute('data-go');
        if (go === 'sv') { if (window.DFLSaisonwechsel) DFLSaisonwechsel.zeigen(); }
        else if (go === 'anlagen') { if (window.DFLAnlagen && DFLAnlagen.blatt) DFLAnlagen.blatt(); }
        else if (go === 'kaderschnitt') kaderschnitt();
        else if (go === 'draft') { zeige('scout'); setTimeout(() => { const d = document.getElementById('dfl-draftboard'); if (d && d.scrollIntoView) d.scrollIntoView({ block: 'start' }); }, 80); }
        else if (go === 'trainer') { if (window.DFLTrainerteam) DFLTrainerteam.blatt(); }
        else if (go === 'vertraege') { zeige('squad'); unterReiter('#view-squad', 'vertraege'); }
        else if (go === 'trades' || go === 'frei' || go === 'werte') { zeige('transfer'); unterReiter('#view-transfer', go); }
        else zeige(go);
      });
    }
    document.querySelectorAll('.app-view').forEach(x => x.classList.toggle('active', x === v));
    v.innerHTML = foHtml();
    aktuelleAnsicht = 'fo'; markiere(); cta(); window.scrollTo(0, 0);
  }

  // ── Office: Gelände + 8 Kacheln (D54) ────────────────────────────────────
  // Jede Kachel: Icon, eine große Zahl, Farbzustand (Unterkante), Tippen öffnet den Bereich.
  const ZUSTAND = { gut: 'var(--app-gut)', mittel: 'var(--app-mittel)', schlecht: 'var(--app-schlecht)', info: 'var(--k-blau, #38bdf8)' };
  function officeKacheln(tp, naechst, geg) {
    const k = K(), kacheln = [];
    const haupt = k ? k.hauptkader().length : SQUAD.length, min = k ? k.MIN() : 21;
    const twLuecke = k && k.twFehlt ? k.twFehlt() : 0;      // D136
    kacheln.push({ ic: 'ti-users', z: haupt > 28 || haupt < min || twLuecke ? 'schlecht' : haupt === 28 ? 'mittel' : 'gut', gross: `${haupt}<small>/28</small>`,
      unten: haupt > 28 ? 'Kader zu groß' : haupt < min ? `Kader unter ${min}` : twLuecke ? 'Torhüter fehlt' : haupt === 28 ? 'Kader voll' : 'Kader', go: () => zeige('squad') });
    // D102: Medizin – verletzt, im Aufbau, Stufe (dfl_medizin_patch.js)
    const med = window.DFLMedizin && DFLMedizin.kachel ? DFLMedizin.kachel() : null;
    if (med) kacheln.push(med);
    if (k) {
      const belegt = k.capBelegt(), limit = k.capLimit(), unten = 0.89 * k.cap(), q = belegt / limit;
      // Barometer nach der Richtlinie: blau bis 80 %, gelb bis 100 %, rot darüber; Strich = Untergrenze 89 %
      const z = q > 1 ? 'schlecht' : q >= 0.8 ? 'mittel' : 'info';
      kacheln.push({ ic: 'ti-coin', z, gross: `${(belegt / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 1 })}<small>/${Math.round(limit / 1e6)}</small>`,
        extra: `<span class="ok-barometer" aria-hidden="true"><i style="width:${Math.min(100, q * 100).toFixed(1)}%;background:${ZUSTAND[z]}"></i><em style="left:${(unten / limit * 100).toFixed(1)}%"></em></span>`,
        unten: `Cap · ${Math.round(q * 100)} %`, go: () => foZeigen() });
    }
    // D92: Saisonvorbereitung (ab der Finalwoche) neben dem Cap
    const sv = window.DFLSaisonwechsel && DFLSaisonwechsel.kachel ? DFLSaisonwechsel.kachel() : null;
    if (sv) kacheln.push(sv);
    if (geg && naechst) {
      const T = window.DFLTaktik, stil = T && T.stilVon ? T.stilVon(geg.id) : null, st = stil && T.STILE ? T.STILE[stil] : null;
      const kuerzel = geg.kurz || (window.DFLNamen && DFLNamen.kuerzel(geg.id)) || (geg.name || '').slice(0, 3).toUpperCase();
      kacheln.push({ ic: 'ti-ball-football', z: (geg.ovr || 0) <= (tp && tp.t.ovr || 0) ? 'gut' : 'mittel',
        gross: `<span class="ok-paar"><span class="lg-crest ok-wappen" style="${typeof crestStyle === 'function' ? crestStyle(geg.id) : ''}"></span>${esc(kuerzel)}</span>`,
        unten: `${naechst.isHome ? 'Heim' : 'Auswärts'} · Stärke ${geg.ovr || '–'}${st ? ' · ' + esc(st.kurz) : ''}`, go: () => zeige('match') });
    }
    if (tp) {
      const form = (tp.t.form || []).slice(-5);
      // Rückmeldung 17.10. (10): Seed in der Conference statt Ligaplatz, Rand in 4 Farben (sicher/wahrscheinlich/im Rennen/raus)
      const sd = seedLage(tp.t);
      if (sd) kacheln.push({ ic: 'ti-trophy', z: sd.z, rand: true,
        gross: tp.t.played ? (sd.seed <= 7 ? `${sd.seed}<small>. Seed</small>` : `${sd.seed}.<small>Conf.</small>`) : '–<small>Seed</small>',
        unten: `<span class="ok-seed">${sd.text}</span>`, go: () => zeige('liga') });
      else kacheln.push({ ic: 'ti-trophy', z: !tp.t.played ? 'info' : tp.platz <= 7 ? 'gut' : tp.platz <= 16 ? 'mittel' : 'schlecht',
        gross: tp.t.played ? `${tp.platz}.<small>Platz</small>` : '–<small>Platz</small>',
        unten: form.length ? `<span class="ok-form">${form.map(r => `<i class="f-${r}">${r === 'W' ? 'S' : r === 'L' ? 'N' : 'U'}</i>`).join('')}</span>` : `${tp.t.pts || 0} Punkte`,
        go: () => zeige('liga') });
    }
    const gesperrt = window.DFLTickets && DFLTickets.gesperrt && DFLTickets.gesperrt();
    kacheln.push({ ic: 'ti-ticket', z: (CLUB.budget || 0) >= 0 ? 'gut' : 'schlecht',
      gross: `${((CLUB.budget || 0) / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 1 })}<small> Mio</small>`,
      unten: `Kasse · Tickets${gesperrt ? ' <i class="ti ti-lock" aria-label="Preise fest bis Saisonende"></i>' : ''}`,
      go: () => { if (window.DFLTickets && DFLTickets.blatt) DFLTickets.blatt(); else zeige('club'); } });
    const plaetze = typeof stadiumCapacityForLevel === 'function' ? stadiumCapacityForLevel(CLUB.facilities.stadium) : 0;
    const bau = CLUB.facilityBuilds && CLUB.facilityBuilds.stadium;
    kacheln.push({ ic: 'ti-building-stadium', z: 'info', gross: `${(plaetze / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })}<small>k</small>`,
      unten: `Stufe ${CLUB.facilities.stadium || 1}${bau ? ` · Bau ${bau.weeksLeft} Wo.` : ''}`, go: () => zeige('club') });
    const fans = typeof EXP !== 'undefined' && EXP.state ? EXP.state().fanSatisfaction : null;
    const eig = window.DFLEigner && DFLEigner.stand ? DFLEigner.stand() : null;
    if (fans != null) {
      const w = Math.min(fans, eig ? eig.wert : 100);
      kacheln.push({ ic: 'ti-mood-smile', z: w >= 70 ? 'gut' : w >= 45 ? 'mittel' : 'schlecht', gross: `${fans}<small> %</small>`,
        unten: `Fans${eig ? ` · Eigentümer ${eig.wert} %` : ''}`, go: () => fansBlatt() });
    }
    let offen = 0;
    try { offen = buildPostfachItems().filter(i => i.cat === 'offer' || i.cat === 'warn').length; } catch (e) { /* ohne Postfach */ }
    kacheln.push({ ic: 'ti-mail', z: offen ? 'schlecht' : 'gut', gross: `${offen}`, unten: offen ? 'Postfach · offen' : 'Postfach · alles erledigt',
      go: () => { const z = document.querySelector('#view-home .postfach-section'); if (z) z.scrollIntoView({ behavior: 'smooth', block: 'start' }); } });
    // höchstens 8 Kacheln (D54): mit der Saisonvorbereitung muss das Stadion weichen
    if (kacheln.length > 8) { const i = kacheln.findIndex(x => x.ic === 'ti-building-stadium'); if (i >= 0) kacheln.splice(i, 1); }
    return kacheln;
  }
  // Fans und Eigentümer als Blatt (die Karte der Startseite bleibt die Quelle)
  function fansBlatt() {
    const box = document.querySelector('#app-blatt .app-blatt-box'); if (!box) return;
    if (typeof renderExpectationsSummary === 'function') renderExpectationsSummary();
    const quelle = document.getElementById('exp-home-card');
    box.innerHTML = `<div class="app-griff"></div><button class="app-blatt-zu" aria-label="Schließen"><i class="ti ti-x" aria-hidden="true"></i></button>
      <div class="app-sheet-titel">Fans &amp; Eigentümer</div><div class="ok-fans">${quelle ? quelle.innerHTML : ''}</div>
      <button class="app-knopf" data-a="verein"><i class="ti ti-building-stadium" aria-hidden="true"></i>Verein &amp; Stadion</button>`;
    box.onclick = ev => { if (ev.target.closest('[data-a="verein"]')) zeige('club'); };
    document.getElementById('app-blatt').classList.add('auf'); document.body.classList.add('app-gesperrt'); cta();
  }
  let kachelListe = [];
  function officeKopf() {
    const alt = document.getElementById('app-office-kopf'); if (alt) alt.remove();
    if (!shell() || typeof LEAGUE === 'undefined' || !LEAGUE || !LEAGUE.tiers) return;
    const ziel = document.getElementById('view-home'); if (!ziel) return;
    const tp = tabellenPlatz(); if (!tp) return;
    const naechst = typeof fcmNextFixture === 'function' && !seasonFullyComplete(LEAGUE) ? fcmNextFixture(LEAGUE) : null;
    const geg = naechst ? LEAGUE.tiers.bundesliga.groups[0].teams.find(x => x.id === naechst.opponentId) : null;
    kachelListe = officeKacheln(tp, naechst, geg);
    ziel.insertAdjacentHTML('afterbegin', `<section id="app-office-kopf">
      ${window.DFLGelaende ? '<div class="aok-gelaende" id="app-gelaende"></div>' : ''}
      <div class="ok-kacheln">${kachelListe.map((x, i) => `<button type="button" class="ok-kachel${x.rand ? ' ok-rand' : ''}" data-k="${i}" style="--zustand:${ZUSTAND[x.z]}">
        <span class="ok-oben"><i class="ti ${x.ic}" aria-hidden="true"></i><span class="ok-punkt"></span></span>
        <span class="ok-gross">${x.gross}</span>${x.extra || ''}<span class="ok-unten">${x.unten}</span></button>`).join('')}</div>
    </section>`);
    const box = document.getElementById('app-office-kopf');
    box.addEventListener('click', ev => { const b = ev.target.closest('.ok-kachel'); if (b) kachelListe[+b.getAttribute('data-k')].go(); });
    if (window.DFLGelaende) DFLGelaende.zeichne(document.getElementById('app-gelaende')).catch(e => console.warn('[DFL-App] Gelände', e));
  }
  {
    const _orig = window.renderHomeTab;
    if (typeof _orig === 'function') window.renderHomeTab = function () {
      const r = _orig.apply(this, arguments);
      try { officeKopf(); } catch (e) { console.warn('[DFL-App] Office-Kopf', e); }
      cta();
      return r;
    };
  }
  {
    const _orig = window.nextWeek;
    if (typeof _orig === 'function') window.nextWeek = function () {
      const r = _orig.apply(this, arguments);
      setTimeout(() => { cta(); if (aktuelleAnsicht === 'fo') foZeigen(); }, 30);
      return r;
    };
  }

  // ── Ein/aus je nach Gerät und Spielstand ─────────────────────────────────
  // Office nach dem Laden (Prüfung 2026-10-10): initGame zeichnet die Startseite, bevor dieses Modul renderHomeTab
  // umhüllt – ohne Neuzeichnen stand die alte Startseite da, bis man einmal auf „Office“ tippte
  let officeNachLaden = false;
  // Nutzer 2026-10-22 (PC): „die bleiben nicht fest, sondern gehen nach einer Sekunde wieder“ – am PC ist die Hülle aus, das
  // Spieler- und Einstellungsblatt wird dort trotzdem genutzt; der 1,5-s-Takt schloss es jedes Mal. Nur beim Wechsel an → aus schließen.
  let warAn = null;
  function anpassen() {
    const an = shell();
    document.body.classList.toggle('dfl-shell', an);
    if (an) { baue(); markiere(); }
    else if (warAn !== false) { blattZu(); mehrZu(); hinweisAus(); }
    warAn = an;
    if (an && !officeNachLaden && typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.tiers) {
      officeNachLaden = true;
      if (!document.getElementById('app-office-kopf') && typeof window.renderHomeTab === 'function') {
        try { window.renderHomeTab(); } catch (e) { console.warn('[DFL-App] Office nach dem Laden', e); }
      }
    }
    cta();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', anpassen); else anpassen();
  // Spielstand beim Seitenstart: initGame zeichnete Feld und Kaderliste vor diesem Modul → ohne Gesichter/Fitness
  try { if (typeof LEAGUE !== 'undefined' && LEAGUE && typeof SQUAD !== 'undefined' && SQUAD.length && typeof renderPitch === 'function') { renderPitch(); if (typeof renderBench === 'function') renderBench(); if (typeof renderSquadList === 'function') renderSquadList(); } }
  catch (e) { console.warn('[DFL-App] Feld nach dem Laden', e); }
  window.addEventListener('resize', anpassen);
  setInterval(() => { if (document.visibilityState === 'visible') anpassen(); }, 1500);

  // eigene Ansicht eines Moduls (z. B. #view-sv der Saisonvorbereitung): Leiste markieren, Haupt-Button neu
  function ansicht(name) { blattZu(); mehrZu(); aktuelleAnsicht = name; markiere(); cta(); }
  // stilBlatt bleibt als Name (ältere Aufrufer) und öffnet die Einstellungen; futKarte/radar/achsen/futStufe/formHtml für das Blatt
  // fremder Spieler (D111, dfl_scouting_patch.js) und das Filter-Blatt der Kaderliste (dfl_ebenen_patch.js)
  window.DFLAppShell = { kaderschnitt, zeige, mitwirkende, spielerBlatt, foZeigen, ctaZustand, cta, stilBlatt: einstellungenBlatt, einstellungenBlatt, fansBlatt, officeKopf,
    istRookie, ansicht, blattZu, futKarte, futStufe, radar, achsen, formHtml };
  console.log('[DFL-App-Oberfläche v2] aktiv — App-Kopf mit Mehr, Leiste Office/Kader/Liga/Front Office, Office-Kacheln, Haupt-Button, Spieler-Blatt, Gesichter + Fitness auf dem Feld');
})();
