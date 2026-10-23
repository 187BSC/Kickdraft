/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · APP-OBERFLÄCHE  ·  v1   (2026-10-15, aus Kickdraft dfl_app_shell.js v2 übernommen)
   ─────────────────────────────────────────────────────────────────────────
   Unterschiede zur Kickdraft-Fassung (dort an Franchises, Cap und Draft gebunden):
   • Leiste: Office · Kader · Liga · Transfer (statt Front Office); Europa unter Liga, Scouting unter Transfer
   • Haupt-Button: Zum Spiel (Liga, Pokal, Europapokal, Testspiel) · Saison abschließen · Woche weiter
   • Office-Kacheln: Kader, Verletzte, Transferbudget, nächstes Spiel, Platz, Gehaltsbudget, Stadion,
     Fans/Vorstand, Postfach
   • Spieler-Blatt: Marktwert und Gehalt statt Cap Hit; Vertrag verlängern, Verkaufen
   • Vereinsdaten, Wappen und Gesichter über KSVerein (js/kickstil_verein.js)
   • Aufgeräumt 2026-10-15: Kickdraft-Teile ohne Gegenstück in unserer Welt entfernt (Front Office mit Cap,
     Kaderschnitt-Blatt, Draft-/Playoff-Haupt-Button, Rookie-Marken, alte Office-Kacheln)
   Aufbau: baut auf mobile_patch.js auf (body.ist-handy) und ersetzt dessen Leiste durch eine App-Oberfläche:
   App-Kopf oben (Wappen, Verein, Woche/Platz, „Mehr“-Blatt mit Einstellungen), Leiste unten, Office mit
   Vereinsgelände + Kacheln, Haupt-Button unten rechts, Spieler-Blatt von unten, Gesichter und Fitness auf dem
   Taktikfeld, Spielbericht-Weiter-Knopf bleibt unten stehen.
   Lädt nach mobile_patch.js, vor init_bootstrap.js.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // Kickstil: aktiv, sobald eine Karriere läuft (Kickdraft: CLUB.dfl.aktiv). Name bleibt für den Abgleich mit Kickdraft.
  const dfl = () => typeof CLUB !== 'undefined' && CLUB && CLUB.name && typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.tiers && !CLUB.dfl;
  const KS = () => window.KSVerein;
  const handy = () => !!(document.body && document.body.classList.contains('ist-handy'));
  const shell = () => handy() && dfl();
  const K = () => window.DFLKader;
  const I = () => window.DFLIdentitaet;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const mio = x => (Math.round((x || 0) / 1e5) / 10).toLocaleString('de-DE') + ' Mio €';
  // Geld wie im Spiel (formatEuro: „€168k“, „€1,2 Mio“)
  const euro = x => (typeof formatEuro === 'function' ? formatEuro(Math.round(x || 0)) : mio(x));
  const kurz = p => (typeof displayName === 'function' ? displayName(p) : p.name);
  const voll = p => ((p.firstName ? p.firstName + ' ' : '') + p.name).trim();
  const spieler = id => (typeof getPlayer === 'function' ? getPlayer(id) : null);
  const farben = () => { try { const f = KS() && KS().eigen(); return f ? { id: 'fcm', farben: f.farben } : null; } catch (e) { return null; } };
  const FIT = f => f >= 85 ? '#3fcf7a' : f >= 70 ? '#f0c05a' : '#f07462';
  const fitness = p => Math.round(typeof p.fitness === 'number' ? p.fitness : 95);
  const moral = p => Math.round(typeof p.morale === 'number' ? p.morale : 70);
  const portraet = (p, klein) => {
    try { return `<span class="dfl-portrait${klein ? ' klein' : ''}">${KS() ? KS().gesicht(p) : I().gesichtSvg(p, SQUAD.some(q => q.id === p.id) ? farben() : null)}</span>`; }
    catch (e) { return ''; }
  };

  // ── Ansichten ────────────────────────────────────────────────────────────
  // Kickstil: unsere Bereiche (Europa unter Liga, Nachwuchs & Scouting unter Transfer)
  const NAV = [
    { id: 'office', icon: 'ti-layout-dashboard', label: 'Office', view: 'home', views: ['home'] },
    { id: 'kader', icon: 'ti-users', label: 'Kader', view: 'squad', views: ['squad', 'training'] },
    { id: 'liga', icon: 'ti-trophy', label: 'Liga', view: 'liga', views: ['liga', 'europa'] },
    { id: 'transfer', icon: 'ti-arrows-left-right', label: 'Transfer', view: 'transfer', views: ['transfer', 'scout'] }
  ];
  const MEHR = [
    { icon: 'ti-barbell', label: 'Training', sub: 'Einheiten und Trainingslager', go: () => zeige('training') },
    { icon: 'ti-school', label: 'Nachwuchs & Scouting', sub: 'Talente finden, Länder beobachten', go: () => zeige('scout') },
    { icon: 'ti-world', label: 'Europa', sub: 'Champions League, Europa League, Conference League', go: () => zeige('europa') },
    { icon: 'ti-news', label: 'Zeitung', sub: 'Flutlicht-Kurier', go: () => zeige('zeitung') },
    { icon: 'ti-arrows-exchange', label: 'Transferticker', sub: 'Wer wen holt – Deutschland und Europa', go: () => { mehrZu(); if (window.KSMarkt) window.KSMarkt.oeffnen(); } },
    { icon: 'ti-building-stadium', label: 'Verein & Stadion', sub: 'Philosophie, Ausbau, Finanzen', go: () => zeige('club') },
    { icon: 'ti-settings', label: 'Einstellungen', sub: () => einstellungenText(), go: () => einstellungenBlatt() },
    { icon: 'ti-device-floppy', label: 'Spielstand & Verwaltung', sub: 'Speichern, Export, Engine', go: () => {
      zeige('home');
      setTimeout(() => { const z = document.querySelector('#view-home .mgmt-section, #view-home [id*="mgmt"], #mgmt-engine3-btn');
        if (z && z.scrollIntoView) z.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 80); } },
    { icon: 'ti-scale', label: 'Mitwirkende', sub: 'Lizenzen von Icons, Wappen, Gesichtern', go: () => mitwirkende() }
  ];
  let aktuelleAnsicht = 'home';

  function zeige(view) {
    blattZu(); mehrZu();
    if (typeof switchAppView === 'function') switchAppView(view, document.getElementById('nav-' + view) || document.createElement('button'));
    window.scrollTo(0, 0);
  }
  function unterReiter(sel, name) {
    const b = [...document.querySelectorAll(sel + ' .subtab')].find(x => (x.getAttribute('onclick') || '').indexOf("'" + name + "'") >= 0);
    if (b) b.click();
  }
  // Ansichtswechsel mitschreiben: Leiste markieren, Haupt-Button neu
  {
    const _orig = window.switchAppView;
    if (typeof _orig === 'function') window.switchAppView = function (view, btn) {
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
      <button class="ak-mehr" type="button" aria-label="Mehr: Training, Scouting, Europa, Zeitung, Verein, Einstellungen, Spielstand"><i class="ti ti-menu-2" aria-hidden="true"></i></button>`;
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
    try { const d = KS() && KS().daten(id); return d ? d.name : ''; } catch (e) { return ''; }
  }
  // Kickstil: Spiel dieser Woche ohne Nebenwirkung bestimmen (ensureFixtureLoaded würde den Spieltag schon aufbauen).
  // Reihenfolge wie dort: Europa (Vorrang in seinen Wochen) · Testspiel · Liga · Pokal.
  function spielDieseWoche() {
    try {
      const wo = LEAGUE.week;
      const st = CLUB.euro, EC = window.EuroCompetitions;
      // bundle_europa.js kennt die Wochen und weiß, ob das Europaspiel dieser Woche schon gespielt ist (Doppelwoche)
      if (typeof window.fcmEuroDieseWoche === 'function') {
        const e = window.fcmEuroDieseWoche();
        if (e) { const g = e.kind === 'league' ? e.fx.opponent : e.tie.opponent; return { art: 'euro', id: g && g.id, name: g && g.name }; }
      } else if (st && st.fcmComp && EC) {
        const lw = window.EURO_LEAGUE_WEEKS || [10, 12, 14, 16, 23, 24, 30, 31];
        if (lw.indexOf(wo) >= 0 && EC.fcmEuroFixtureForMatchday) { const fx = EC.fcmEuroFixtureForMatchday(st.fcmComp); if (fx) return { art: 'euro', id: fx.opponent && fx.opponent.id, name: fx.opponent && fx.opponent.name }; }
        const ko = (window.EuroIntegration && EuroIntegration.KO_SCHEDULE) || [];
        const step = ko.find(s => s.week === wo);
        if (step && EC.fcmKnockoutTie) { const tie = EC.fcmKnockoutTie(st.fcmComp); if (tie && tie.round === step.round) return { art: 'euro', id: tie.opponent && tie.opponent.id, name: tie.opponent && tie.opponent.name }; }
      }
      const test = typeof fcmFriendlyThisWeek === 'function' && fcmFriendlyThisWeek(LEAGUE);
      if (test) return { art: 'test', id: test.opponentId };
      const liga = typeof seasonFullyComplete === 'function' && !seasonFullyComplete(LEAGUE) && Array.isArray(LEAGUE.matchWeeks)
        && LEAGUE.matchWeeks[LEAGUE.matchday] === wo && typeof fcmNextFixture === 'function' && fcmNextFixture(LEAGUE);
      if (liga) return { art: 'liga', id: liga.opponentId, heim: liga.isHome };
      if (typeof cupDueThisWeek === 'function' && cupDueThisWeek() && typeof fcmCupFixture === 'function') {
        const c = fcmCupFixture(CUP); if (c) return { art: 'pokal', id: c.opponentId, heim: c.isHome, runde: c.roundName };
      }
    } catch (e) { /* kein Spiel erkennbar */ }
    return null;
  }
  function ctaZustand() {
    if (!dfl() || typeof LEAGUE === 'undefined' || !LEAGUE) return null;
    if (aktuelleAnsicht === 'match') return null;
    const g = typeof G !== 'undefined' && G ? G : {};
    const sp = !g.ended ? spielDieseWoche() : null;
    if (sp) {
      const geg = sp.name || teamName(sp.id);
      const text = sp.art === 'test' ? 'Zum Testspiel' : sp.art === 'pokal' ? 'Zum Pokalspiel' : sp.art === 'euro' ? 'Zum Europapokal' : 'Zum Spiel';
      return { text, sub: geg ? 'gegen ' + geg : '', icon: 'ti-ball-football', go: () => zeige('match') };
    }
    // Kickstil: Deadline-Day (kickstil_deadline_day.js) – nach dem Spiel der Woche, vor „Woche weiter“
    if (window.KSDeadline && KSDeadline.offen()) return { text: 'Deadline-Day live', sub: 'Transferschluss 18:00 Uhr', icon: 'ti-clock-bolt', go: () => KSDeadline.oeffnen() };
    if (typeof fcmSeasonOver === 'function' && fcmSeasonOver()) return { text: 'Saison abschließen', sub: 'Auf- und Abstieg, neue Saison', icon: 'ti-trophy', go: () => nextWeek() };
    const lblK = typeof calendarLabel === 'function' ? calendarLabel(LEAGUE.week, LEAGUE.startYear || 2026) : 'Woche ' + LEAGUE.week;
    return { text: 'Woche weiter', sub: lblK, icon: 'ti-arrow-right', go: () => nextWeek() };
  }
  // App-Kopf: Wappen, Name, Woche · Platz
  function tabellenPlatz() {
    try {
      // Kickstil: die Liga des eigenen Vereins (Pyramide mit vier Stufen)
      const grp = typeof findFcmGroup === 'function' ? findFcmGroup(LEAGUE) : null;
      const teams = (grp ? grp.group.teams : []).slice().sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
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
    const st = (opt && opt.stufe) || futStufe(ovr);
    const marke = st === 'legende' ? '<span class="fut-marke"><i class="ti ti-crown" aria-hidden="true"></i>Legende</span>'
      : st === 'elite' ? '<span class="fut-marke"><i class="ti ti-star-filled" aria-hidden="true"></i>Elite</span>'
      : String(st).indexOf('ed ') === 0 && window.KSKarten ? KSKarten.markeHtml(st, p) : '';   // Sonderkarte (kickstil_karten.js)
    // Sonderkarte eigener Spieler: Vereinswappen unter der Position (2026-10-22, wie die Kickdraft-Karten)
    const wp = String(st).indexOf('ed ') === 0 && window.KSVerein && KSVerein.wappen && (!opt || !opt.fremd) ? `<div class="fut-wappen" aria-hidden="true">${KSVerein.wappen('fcm', { klein: true })}</div>` : '';
    return `<div class="fut ${st}"><div class="fut-wert${opt && opt.wertKl ? ' ' + opt.wertKl : ''}">${esc(ovr)}${opt && opt.plus ? opt.plus : ''}</div><div class="fut-pos">${esc(p.pos)}</div>${wp}${marke}
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
      // D92/D93: Verlängern als Folgevertrag, Entlassung zum Saisonende vormerken (dfl_saisonwechsel_patch.js)
      if (window.DFLSaisonwechsel) aktionen.push(...DFLSaisonwechsel.blattKnoepfe(p));
      if (k.entlassen) {
        // D111: ein Tipp öffnet das Entlassen-Blatt (Dead Cap jetzt / am Saisonende, dfl_ebenen_patch.js)
        const dead = k.deadCapVon ? k.deadCapVon(p) : 0, vor = window.DFLSaisonwechsel && DFLSaisonwechsel.istVorgemerkt && DFLSaisonwechsel.istVorgemerkt(p.id);
        aktionen.push(`<button class="app-knopf rot" data-a="entlassen"><i class="ti ti-scissors" aria-hidden="true"></i><span class="ak-zwei">Entlassen${vor ? '<small>zum Saisonende vorgemerkt</small>' : dead ? `<small>Dead Cap ${mio(dead)}</small>` : ''}</span></button>`);
      }
    }
    // Kickstil: Verlängern (Verhandlung aus contracts_patch.js) und Verkaufen (Schnellverkauf mit Rückfrage)
    if (eigen && !k) {
      if (typeof window.renewContract === 'function') aktionen.push(`<button class="app-knopf" data-a="ks-vertrag"><i class="ti ti-file-certificate" aria-hidden="true"></i>Vertrag</button>`);
      if (typeof window.sellPlayer === 'function') aktionen.push(`<button class="app-knopf rot" data-a="ks-verkauf"><i class="ti ti-coin-euro" aria-hidden="true"></i>Verkaufen</button>`);
    }
    aktionen.push(`<button class="app-knopf" data-a="statistik" aria-expanded="false"><i class="ti ti-chart-line" aria-hidden="true"></i>Statistiken</button>`);
    aktionen.push(`<button class="app-knopf" data-a="details"><i class="ti ti-id" aria-hidden="true"></i>Alle Details</button>`);
    // Ebene 2 (D54): FUT-Karte mit Neigung, alle 6 Werte, Radar · Ebene 3: „Statistiken“
    const ovr = typeof ovrBase === 'function' ? ovrBase(p) : p.ovr, ax = achsen(p), n = noten(p), f = formVon(p);
    let gesicht = '';
    try { gesicht = KS() ? KS().gesicht(p) : I().gesichtSvg(p, eigen ? farben() : null); } catch (e) { /* ohne Gesicht */ }
    box.innerHTML = `<div class="app-griff"></div><button class="app-blatt-zu" aria-label="Schließen"><i class="ti ti-x" aria-hidden="true"></i></button>
      <div class="fut-kopf"><div class="app-blatt-name">${esc(voll(p))}${typeof isCaptain === 'function' && isCaptain(p) ? ' <span class="cap-badge">©</span>' : ''}</div>
        <div class="app-blatt-meta"><span class="pos-badge-sm pos-${p.pos}">${pos}</span> ${p.age} Jahre${p.perspektiv ? ' · <b>Development Squad</b>' : ''}${verletzt ? ' · <span class="app-rot">verletzt</span>' : ''}
          ${eigen ? ' · Form ' + formHtml(f) : ''}${pot ? ` · <span class="fut-pot">${pot}${window.DFLUiTeile && typeof potentialRange === 'function' ? DFLUiTeile.sterne(potentialRange(p, scout)) : ''}</span>` : ''}</div>
        ${eigen && window.DFLPosition ? DFLPosition.blattHtml(p, kontext) : ''}${eigen && window.DFLMedizin ? DFLMedizin.blattHtml(p) : ''}</div>
      <div class="fut-buehne">${futKarte(p, ovr, ax, gesicht, eigen ? vorjahrAchsen(p) : null, eigen ? Object.assign({ plus: typeof seasonGainBadge === 'function' ? seasonGainBadge(p) : '' }, window.KSKarten && KSKarten.klasse(p) ? { stufe: KSKarten.klasse(p) } : {}) : null)}</div>
      ${radar(ax)}
      <div class="app-blatt-werte">
        <div><span>Fitness</span>${balken(fit, FIT(fit))}<b>${fit}</b></div>
        <div><span>Moral</span>${balken(mor, mor >= 70 ? '#3fcf7a' : mor >= 50 ? '#f0c05a' : '#f07462')}<b>${mor}</b></div>
        ${window.KSNational ? KSNational.blattZeile(p) : ''}
        ${eigen && k ? `<div><span>Cap Hit</span><b class="app-weit">${mio(k.capHitJahr(p))}</b></div><div><span>Vertrag bis</span><b class="app-weit">${bis}</b></div>` : ''}
        ${!k ? `<div><span>Marktwert</span><b class="app-weit">${euro(typeof computeMarketValue === 'function' ? computeMarketValue(p) : p.value)}</b></div>` +
          (eigen ? `<div><span>Gehalt</span><b class="app-weit">${euro(p.wage)}<small>/Woche</small></b></div><div><span>Vertrag bis</span><b class="app-weit">${bis}</b></div>` : '') : ''}
      </div>
      ${eigen && window.DFLSaisonwechsel ? DFLSaisonwechsel.blattInfo(p) : ''}
      ${window.DFLEbenen ? DFLEbenen.stilBlockHtml(p) : ''}
      <div class="app-blatt-aktionen">${aktionen.join('')}</div>
      <div class="app-statistik" hidden>
        <div class="app-stat-kopf"><b>Noten der Saison</b><small>${n.length ? `${n.length} Spiele · Schnitt ${(n.reduce((a, b) => a + b, 0) / n.length).toLocaleString('de-DE', { maximumFractionDigits: 1 })}` : 'noch kein Einsatz'}</small></div>
        <div class="app-noten">${n.slice(-10).map(x => `<i style="height:${Math.max(8, Math.min(100, (x - 4) / 6 * 100)).toFixed(0)}%"><b>${x.toLocaleString('de-DE', { maximumFractionDigits: 1 })}</b></i>`).join('') || '<small>Keine Spiele</small>'}</div>
      </div>
      <div class="app-blatt-details"></div>`;
    box.onclick = ev => {
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
      else if (a === 'ks-vertrag') { blattZu(); window.renewContract(p.id); }
      else if (a === 'ks-verkauf') { blattZu(); window.sellPlayer(p.id); }
      else if (a === 'unv') { DFLAnfragen.unverkaeuflich(p.id); spielerBlatt(p, kontext); }
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
        <p><b>Vereinsgelände, Himmel, Startbild, Regler und Sterne:</b> Kenney (kenney.nl), CC0 – dazu eigene Low-Poly-Bauten.</p>
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
        tok.innerHTML = `<span class="tk-gesicht">${KS() ? KS().gesicht(p, 'fcm') : I().gesichtSvg(p, farben())}</span><span class="tk-pos">${esc(pos)}</span>`;
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
      if (!dfl()) return r;                                  // Kickstil: auch ohne DFLKader (dann Marktwert statt Cap Hit)
      document.querySelectorAll('#sub-squadlist .sqo-row').forEach(row => {
        const m = /showSquadPlayerCard\('([^']+)'\)/.exec(row.getAttribute('onclick') || ''), p = m && spieler(m[1]);
        if (!p) return;
        const v = row.querySelector('.sqo-val'); if (v && k) { v.textContent = mio(k.capHitJahr(p)).replace(' €', ''); v.title = 'Cap Hit'; v.classList.add('ist-cap'); }
        if (!row.querySelector('.dfl-portrait')) row.querySelector('.pos-badge-sm').insertAdjacentHTML('afterend', portraet(p, true));
        const nm = row.querySelector('.sqo-name');
        // DFL-Spieler sind alle generiert und deutsch – die Flagge kostet nur Platz
        if (k && nm && nm.firstChild && nm.firstChild.nodeType === 3) nm.firstChild.nodeValue = nm.firstChild.nodeValue.replace(/^[\u{1F1E6}-\u{1F1FF}]{2}\s*/u, '');
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
          if (v && !k) v.innerHTML = `<b>${euro(typeof computeMarketValue === 'function' ? computeMarketValue(p) : p.value)}</b>${jahre == null ? '' : jahre <= 0 ? 'endet' : jahre + ' J.'}`;
          if (v && k) v.innerHTML = `<b>${(k.capHitJahr(p) / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 1 })}</b>${jahre == null ? '' : jahre <= 0 ? 'endet' : jahre + ' J.'}`;
          row.classList.add('sqo-d54');
        }
      });
      // Legende über der Liste
      const anzahl = document.querySelector('#sub-squadlist .sqo-count');
      if (anzahl && !document.querySelector('#sub-squadlist .form-legende')) anzahl.insertAdjacentHTML('afterend',
        `<div class="form-legende" aria-hidden="true"><span>Form</span>${[-2, -1, 0, 1, 2].map(formHtml).join('')}</div>`);
      const wert = [...document.querySelectorAll('#sub-squadlist .pos-filter-btn')].find(b => /setSqSort\('value'\)/.test(b.getAttribute('onclick') || ''));
      if (wert && k) wert.remove();
      return r;
    };
  }


  // ── Office: Gelände + 8 Kacheln (D54) ────────────────────────────────────
  // Jede Kachel: Icon, eine große Zahl, Farbzustand (Unterkante), Tippen öffnet den Bereich.
  const ZUSTAND = { gut: 'var(--app-gut)', mittel: 'var(--app-mittel)', schlecht: 'var(--app-schlecht)', info: 'var(--k-blau, #38bdf8)' };
  // Kickstil: 8 Kacheln für die normale Fußballwelt (Kickdraft: Cap, Medizin, Saisonvorbereitung …)
  function officeKachelnKS(tp, sp) {
    const kacheln = [];
    const kader = SQUAD.filter(p => !p.onLoanAt).length;
    const verletzt = SQUAD.filter(p => typeof isInjured === 'function' ? isInjured(p) : p.injuryWeeks > 0).length;
    const gesperrt = SQUAD.filter(p => typeof isSuspended === 'function' && isSuspended(p)).length;
    kacheln.push({ ic: 'ti-users', z: kader < 18 ? 'schlecht' : kader > 30 ? 'mittel' : 'gut', gross: `${kader}<small> Spieler</small>`,
      unten: kader < 18 ? 'Kader zu klein' : kader > 30 ? 'Kader sehr groß' : 'Kader', go: () => zeige('squad') });
    kacheln.push({ ic: 'ti-first-aid-kit', z: verletzt + gesperrt === 0 ? 'gut' : verletzt + gesperrt <= 2 ? 'mittel' : 'schlecht',
      gross: `${verletzt}<small> verletzt</small>`, unten: gesperrt ? `${gesperrt} gesperrt` : 'Ausfälle', go: () => { zeige('squad'); unterReiter('#view-squad', 'squadlist'); } });
    const budget = CLUB.budget || 0;
    kacheln.push({ ic: 'ti-coin-euro', z: budget >= 0 ? 'info' : 'schlecht', gross: esc(euro(budget)),
      unten: budget >= 0 ? 'Transferbudget' : 'Budget im Minus', go: () => zeige('transfer') });
    if (sp) {
      const d = KS() ? KS().daten(sp.id) : null, kuerzel = d ? d.kuerzel : String(sp.name || '').slice(0, 3).toUpperCase();
      const art = sp.art === 'pokal' ? 'Pokal' : sp.art === 'euro' ? 'Europa' : sp.art === 'test' ? 'Testspiel' : (sp.heim ? 'Heim' : 'Auswärts');
      kacheln.push({ ic: 'ti-ball-football', z: 'info',
        gross: `<span class="ok-paar"><span class="lg-crest ok-wappen" style="${typeof crestStyle === 'function' ? crestStyle(sp.id) : ''}"></span>${esc(kuerzel)}</span>`,
        unten: `${art} · ${esc(teamName(sp.id) || sp.name || '')}`, go: () => zeige('match') });
    }
    if (tp) {
      const form = (tp.t.form || []).slice(-5);
      const n = typeof findFcmGroup === 'function' ? findFcmGroup(LEAGUE).group.teams.length : 18;
      kacheln.push({ ic: 'ti-trophy', z: !tp.t.played ? 'info' : tp.platz <= 3 ? 'gut' : tp.platz <= n - 4 ? 'mittel' : 'schlecht',
        gross: tp.t.played ? `${tp.platz}.<small>Platz</small>` : '–<small>Platz</small>',
        unten: form.length ? `<span class="ok-form">${form.map(r => `<i class="f-${r}">${r === 'W' ? 'S' : r === 'L' ? 'N' : 'U'}</i>`).join('')}</span>` : `${tp.t.pts || 0} Punkte`,
        go: () => zeige('liga') });
    }
    const frei = CLUB.wageBudget != null ? CLUB.wageBudget : null;
    if (frei != null) kacheln.push({ ic: 'ti-wallet', z: frei >= 0 ? 'gut' : 'schlecht', gross: esc(euro(frei)), unten: 'Gehalt frei / Woche', go: () => zeige('club') });
    const plaetze = typeof stadiumCapacityForLevel === 'function' && CLUB.facilities ? stadiumCapacityForLevel(CLUB.facilities.stadium) : 0;
    const bau = CLUB.facilityBuilds && CLUB.facilityBuilds.stadium;
    if (plaetze) kacheln.push({ ic: 'ti-building-stadium', z: 'info', gross: `${(plaetze / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })}<small>k</small>`,
      unten: `Stadion · Stufe ${CLUB.facilities.stadium || 1}${bau ? ` · Bau ${bau.weeksLeft} Wo.` : ''}`, go: () => zeige('club') });
    let fans = null, vorstand = null;
    try { const s = typeof EXP !== 'undefined' && EXP.state ? EXP.state() : null; if (s) { fans = Math.round(s.fanSatisfaction); vorstand = Math.round(s.boardSatisfaction); } } catch (e) { /* ohne Erwartungen */ }
    if (fans != null) {
      const w = Math.min(fans, isFinite(vorstand) ? vorstand : 100);
      kacheln.push({ ic: 'ti-mood-smile', z: w >= 60 ? 'gut' : w >= 40 ? 'mittel' : 'schlecht', gross: `${fans}<small> %</small>`,
        unten: `Fans${isFinite(vorstand) ? ` · Vorstand ${vorstand} %` : ''}`, go: () => fansBlatt() });
    }
    let offen = 0;
    try { offen = buildPostfachItems().filter(i => i.cat === 'offer' || i.cat === 'warn').length; } catch (e) { /* ohne Postfach */ }
    kacheln.push({ ic: 'ti-mail', z: offen ? 'schlecht' : 'gut', gross: `${offen}`, unten: offen ? 'Postfach · offen' : 'Postfach · alles erledigt',
      go: () => { const z = document.querySelector('#view-home .postfach-section'); if (z) z.scrollIntoView({ behavior: 'smooth', block: 'start' }); } });
    if (kacheln.length > 8) { const i = kacheln.findIndex(x => x.ic === 'ti-building-stadium'); if (i >= 0) kacheln.splice(i, 1); }
    return kacheln.slice(0, 8);
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
    if (typeof LEAGUE === 'undefined' || !LEAGUE || !LEAGUE.tiers) return;
    const ziel = document.getElementById('view-home'); if (!ziel) return;
    // Kickstil: am PC (ohne Handy-Shell) nur das Vereinsgelände als breiter Streifen über der Übersicht
    if (!shell()) {
      if (!dfl() || !window.DFLGelaende) return;
      ziel.insertAdjacentHTML('afterbegin', '<section id="app-office-kopf" class="ks-pc-kopf"><div class="aok-gelaende" id="app-gelaende"></div></section>');
      DFLGelaende.zeichne(document.getElementById('app-gelaende')).catch(e => console.warn('[Kickstil-App] Gelände', e));
      return;
    }
    const tp = tabellenPlatz(); if (!tp) return;
    // Kickstil: Spiel dieser Woche, sonst das nächste Ligaspiel
    let sp = spielDieseWoche();
    if (!sp) { const n = typeof fcmNextFixture === 'function' && !seasonFullyComplete(LEAGUE) ? fcmNextFixture(LEAGUE) : null; if (n) sp = { art: 'liga', id: n.opponentId, heim: n.isHome }; }
    kachelListe = officeKachelnKS(tp, sp);
    ziel.insertAdjacentHTML('afterbegin', `<section id="app-office-kopf">
      ${window.DFLGelaende ? '<div class="aok-gelaende" id="app-gelaende"></div>' : ''}
      <div class="ok-kacheln">${kachelListe.map((x, i) => `<button type="button" class="ok-kachel" data-k="${i}" style="--zustand:${ZUSTAND[x.z]}">
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
      setTimeout(() => { cta(); }, 30);
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
  window.DFLAppShell = { zeige, mitwirkende, spielerBlatt, ctaZustand, cta, stilBlatt: einstellungenBlatt, einstellungenBlatt, fansBlatt, officeKopf,
    ansicht, blattZu, futKarte, futStufe, radar, achsen, formHtml, spielDieseWoche };
  console.log('[Kickstil-App-Oberfläche v1] aktiv — App-Kopf mit Mehr, Leiste Office/Kader/Liga/Transfer, Office-Kacheln, Haupt-Button, Spieler-Blatt, Gesichter + Fitness auf dem Feld');
})();
