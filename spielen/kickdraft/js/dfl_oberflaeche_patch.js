/* ═══════════════════════════════════════════════════════════════════════════
   DFL · ALTE OBERFLÄCHE IM KENNEY-STIL  ·  v1   (D85, freigegeben 2026-10-10: „arbeite alles in die App ein“;
   Vorschau spiel/dfl_bilder_vorschau.html, Teil „Alte Teile → Kenney“, offene Fragen = Vorschlag der Vorschau)
   ─────────────────────────────────────────────────────────────────────────
   Die Reste der Altoberfläche bekommen den Kenney-Stil – aufbauend auf D104 (dfl_kenney_patch.js: Emojis, Farben, Balken,
   Knöpfe in Rubik) und D82 (dfl_auswahl.js: Auswahlblätter):
     A  Positionsmarken: eine Marke überall (Liste, Feld, Bank, Tiefenkader, Spielbericht, Training, Free Agency), Farbe nach
        Mannschaftsteil – auch ZOM, LM/RM, LV/RV, LF/RF (D95) –, Nebenpositionen als geteilte Marke „ZDM|IV“ (Frage 3: ja),
        auf dem Feld Platz-Marke mit Passung (✓ oder −2 aus D81), „OM“ der Welt heißt wie im Kader „ZOM“
     B  Spieltag: Anzeigetafel (Wappen, Ort, Stärke groß, Formation, Heim/Auswärts) statt Altkopf mit „Formation wird analysiert…“
     C  Spielplan: Wappen, Gegner, Heim/Auswärts, S/U/N + Ergebnis (eigene Tore zuerst), nächstes Spiel mit „Spielen“
     D  Breite Tabellen → Zeilen mit großer Zahl: Torjäger, Wertliste (Pick-Kurve als Kacheln, Spieler als Zeilen)
     E  Tiefenkader: Rang-Medaillen 1–3, Marke, Fitness-Balken, Stärke
     F  Training: Segment Leicht/Normal/Intensiv, Schwerpunkt-Chips mit Zeichen, Spielerzeilen (▲ seit Saisonstart, Tempo der
        Entwicklung, Einsätze der letzten 5 Spiele) statt Basisspiel-Knöpfen und vier Mini-Balken je Spieler
     H  Vertragsverhandlung: Angebot gegen Forderung als Balken, Laufzeit als Segment 1–5, Erfolgschance als Ring, Versuche als Punkte
     I  „Alle Details“: Kacheln + Werte-Balken (Tempo, Mentalität, Technik), kein zweites Radar, keine Doppelungen im Spieler-Blatt
     J  Reiterkopf am Handy weg (der App-Kopf zeigt Verein, Woche, Platz), Saison-Banner als Chips + Druckknopf
     K  Office: Kalender als Wochenleiste mit Wappen, Postfach-Filter als Segment (Teammoral hat D104 schon)
     L  Kleinteile: „Stärke“ statt „OVR“ (Wächter), helle Free-Agent-Marke, Moral · Form · Fitness als drei Mini-Säulen
     dazu: Liga-Trade-Log mit Wappen und Positionsmarken; Bestenlisten „Tor/Abwehr/Mittelfeld/Sturm“ statt „MID/DEF“
   Nicht hier: Anlagen-Karte (D75 baut Zustand/Sanieren), Scouting-Reiter/Draft-Jahrgänge (D78), Kurz erklärt + Sponsorenwahl
   (D106–D109).
   Ein Wächter (MutationObserver) färbt Positionsmarken, die andere Module zeichnen (Spielbericht, Zeilen der Kaderliste,
   Wertliste, Trade-Log); sonst hängen die Ansichten an den globalen Zeichenfunktionen (äußerste Wrapper).
   CSS: css/dfl_oberflaeche.css (nur Tokens, Tag und Nacht; Positionsfarben wie theme_dfl_kenney.css in beiden Stilen gleich).
   API: DFLOberflaeche.posMarke(p|pos|liste, opt) · .posGruppe(pos) · .anzeigePos(pos) · .wappen(id, kl) · .ortName(id)
        · .kiTradeTeile(text) · .kiTradeHtml(text) · .markenFaerben(wurzel) · .ovrText(text) · .CFG
   Lädt nach dfl_simulieren_patch.js, vor dfl_bilder_patch.js und init_bootstrap.js.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : globalThis;
  const DOM = typeof document !== 'undefined' && typeof MutationObserver === 'function';
  const CFG = {
    aus: false,                       // Messschalter: alte Oberfläche (nur die Wrapper prüfen ihn)
    wochenleiste: 6,                  // Wochen in der Leiste im Office
    torjaeger: 20,
    passtZeichen: true                // Feld: ✓ an der Stärke, wenn die Position passt (D81 zeigt sonst „−2“)
  };
  const dfl = () => !CFG.aus && typeof CLUB !== 'undefined' && CLUB && CLUB.dfl && CLUB.dfl.aktiv;
  const shell = () => !!(DOM && document.body && document.body.classList.contains('dfl-shell'));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const zahl = (x, n) => Number(x || 0).toLocaleString('de-DE', { minimumFractionDigits: n || 0, maximumFractionDigits: n || 0 });
  const ti = (n, kl) => `<i class="ti ti-${n}${kl ? ' ' + kl : ''}" aria-hidden="true"></i>`;
  const spieler = id => (id != null && typeof getPlayer === 'function' ? getPlayer(id) : null) || null;
  const wrap = (name, nach, vor) => {
    const _orig = W[name];
    if (typeof _orig !== 'function') return false;
    W[name] = function () {
      if (vor) { try { vor.apply(this, arguments); } catch (e) { console.warn('[DFL-Oberfläche] ' + name, e); } }
      const r = _orig.apply(this, arguments);
      try { if (dfl()) nach.apply(this, [r].concat([].slice.call(arguments))); } catch (e) { console.warn('[DFL-Oberfläche] ' + name, e); }
      return r;
    };
    return true;
  };

  // ── A) Positionen: eine Marke überall ─────────────────────────────────────
  // Mannschaftsteile wie in theme_dfl_kenney.css (TW gold, Abwehr blau, Mittelfeld grün, Sturm rot); seit D95 erzeugt die DFL
  // Positionen mit Seite (LV/RV, LM/RM, LF/RF), AV/FL kommen nur noch in alten Einträgen vor (Hall of Fame, Aufträge)
  const GRUPPE = { TW: 'tw', GK: 'tw', IV: 'abw', AV: 'abw', LV: 'abw', RV: 'abw', LIB: 'abw',
    ZDM: 'mf', DM: 'mf', ZM: 'mf', ZOM: 'mf', OM: 'mf', AM: 'mf', LM: 'mf', RM: 'mf',
    FL: 'st', LF: 'st', RF: 'st', LA: 'st', RA: 'st', ST: 'st', MS: 'st', HS: 'st' };
  const GRUPPEN = { tw: 'Tor', abw: 'Abwehr', mf: 'Mittelfeld', st: 'Sturm' };
  // Anzeige: „OM“ (Welt, Draft, Trade-Texte) heißt im Kader „ZOM“; LA/RA (Flügelplätze des Basisspiels) heißen LF/RF (D95).
  // „AM“ (Außenbahn ohne Seite, Platz-Typ des Basisspiels) bleibt AM – bis D95 zählte der Platz als Flügel (D81/D85)
  function anzeigePos(x) {
    const p = String(x == null ? '' : x).trim().toUpperCase();
    if (p === 'OM') return 'ZOM';
    if (p === 'DM') return 'ZDM';
    if (p === 'LA') return 'LF';
    if (p === 'RA') return 'RF';
    return p;
  }
  const posGruppe = x => GRUPPE[anzeigePos(x)] || 'mf';
  function positionenVon(x) {
    const roh = Array.isArray(x) ? x : x && typeof x === 'object' ? (x.positions && x.positions.length ? x.positions : [x.pos])
      : String(x == null ? '' : x).split(/[/|]/);
    const aus = [];
    roh.forEach(p => { const a = anzeigePos(p); if (a && GRUPPE[a] && aus.indexOf(a) < 0) aus.push(a); });
    return aus;
  }
  const teil = (p, i) => `<span class="kpm-t kpm-${posGruppe(p)}${i ? ' neben' : ''}">${esc(p)}</span>`;
  // Marke: eine Position = ein Schild in der Farbe des Mannschaftsteils; mehrere = geteilte Marke (Hauptposition vorn)
  function posMarke(x, opt) {
    opt = opt || {};
    let liste = positionenVon(x);
    if (opt.nur1) liste = liste.slice(0, 1);
    if (!liste.length) return '';
    const kl = (opt.gross ? ' gross' : '') + (opt.klasse ? ' ' + opt.klasse : '');
    if (liste.length === 1) return `<span class="kpm kpm-${posGruppe(liste[0])}${kl}" data-kpm="1">${esc(liste[0])}</span>`;
    return `<span class="kpm kpm-paar${kl}" data-kpm="1" title="${esc(liste.join(' · '))}">${liste.map(teil).join('')}</span>`;
  }
  const RE_POS = /^[A-ZÄÖÜ]{2,3}(?:\s*[/|]\s*[A-ZÄÖÜ]{2,3})*$/;
  // Marken anderer Module (Text = Kürzel oder „ZDM/ZM/IV“) umfärben; nur einmal je Element (data-kpm)
  function markeUmbauen(el) {
    if (!el || el.nodeType !== 1 || el.dataset.kpm) return;
    if (el.children.length && !el.querySelector(':scope > .kz')) { el.dataset.kpm = '0'; return; }
    const t = (el.textContent || '').trim();
    if (!RE_POS.test(t)) { if (t) el.dataset.kpm = '0'; return; }
    const liste = positionenVon(t);
    if (!liste.length) { el.dataset.kpm = '0'; return; }
    el.dataset.kpm = '1';
    el.classList.add('kpm');
    if (liste.length > 1) { el.classList.add('kpm-paar'); el.innerHTML = liste.map(teil).join(''); el.title = liste.join(' · '); }
    else { el.classList.add('kpm-' + posGruppe(liste[0])); if (liste[0] !== t) el.textContent = liste[0]; }
  }
  const SEL_MARKE = '.pos-badge-sm, .pos-badge, .squad-pos, .squad-ppos, .tk-pos, .pm-rating-pos, .depth-pos, .dfl-pos, .tg-zeile .pos-badge-sm';
  function markenFaerben(wurzel) {
    if (!DOM || !wurzel || !wurzel.querySelectorAll) return;
    if (wurzel.matches && wurzel.matches(SEL_MARKE)) markeUmbauen(wurzel);
    wurzel.querySelectorAll(SEL_MARKE).forEach(markeUmbauen);
  }

  // ── Bausteine ─────────────────────────────────────────────────────────────
  const wappen = (id, kl) => `<span class="lg-crest ${kl || ''}" style="${typeof crestStyle === 'function' ? crestStyle(id) : ''}" aria-hidden="true"></span>`;
  function teams() { try { return LEAGUE.tiers.bundesliga.groups[0].teams; } catch (e) { return []; } }
  const teamVon = id => teams().find(t => t.id === id) || null;
  const teamNachName = n => teams().find(t => t.name === n) || null;
  // Ort statt Franchise-Name, wo Platz knapp ist (Anzeigetafel); doppelte Orte (zwei Hamburger) mit vollem Namen
  function ortName(id) {
    try {
      const f = W.DFLSpiel && DFLSpiel.franchise ? DFLSpiel.franchise(id) : null;
      if (f && f.city) {
        const gleich = (W.DFL_LIGA && DFL_LIGA.franchises || []).filter(x => x.city === f.city).length;
        return gleich > 1 ? f.name : f.city;
      }
    } catch (e) { /* ohne Franchise */ }
    const t = teamVon(id); return t ? t.name : (id === 'fcm' && typeof CLUB !== 'undefined' ? CLUB.name : '');
  }
  const kuerzel = id => (W.DFLNamen && DFLNamen.kuerzel(id)) || ((teamVon(id) || {}).name || '').slice(0, 3).toUpperCase();
  function gesicht(p, kl) {
    try {
      const eigen = typeof SQUAD !== 'undefined' && SQUAD.some(q => q.id === p.id);
      const f = eigen && W.DFLSpiel ? DFLSpiel.franchise('fcm') : null;
      return `<span class="ko-gesicht${kl ? ' ' + kl : ''}" aria-hidden="true">${W.DFLIdentitaet ? DFLIdentitaet.gesichtSvg(p, f ? { farben: f.farben } : null) : ''}</span>`;
    } catch (e) { return ''; }
  }
  function ligaPlatz(id) {
    try {
      const t = typeof computeTable === 'function' ? computeTable(teams()) : teams();
      const i = t.findIndex(x => x.id === (id || 'fcm'));
      return i >= 0 ? i + 1 : null;
    } catch (e) { return null; }
  }
  const fitFarbe = f => f >= 85 ? 'var(--app-gut)' : f >= 70 ? 'var(--app-mittel)' : 'var(--app-schlecht)';

  // ── B) Spieltag: Anzeigetafel ────────────────────────────────────────────
  // Die Spiel-Labels (#home-str-label usw.) setzt das Spiel selbst (Formation, Heim/Auswärts, Stärke) – die Tafel liest sie und
  // zeichnet daneben Wappen, Ort, Stärke groß und Formation; ändert das Spiel einen Label-Text, zeichnet sie neu
  const staerkeAus = t => { const m = /St(?:ä|ae)rke:?\s*(\d+)/.exec(t || ''); return m ? +m[1] : null; };
  function tafel() {
    if (!DOM || !dfl()) return;
    const bar = document.querySelector('#view-match .topbar'); if (!bar) return;
    const hl = document.getElementById('home-str-label'), al = document.getElementById('away-str-label');
    const fx = typeof CURRENT_FIXTURE !== 'undefined' && CURRENT_FIXTURE ? CURRENT_FIXTURE : null;
    const gegId = fx && fx.opponentId;
    const heimSpiel = typeof FCM_IS_HOME !== 'undefined' ? !!FCM_IS_HOME : true;
    const neutral = !!(fx && fx.neutral) || /neutral/i.test((al && al.textContent) || '');
    const fb = document.getElementById('opp-formation-badge');
    const gegForm = fb && /\d-\d/.test(fb.textContent) ? (fb.textContent.match(/\d(?:-\d)+/) || [''])[0] : '';
    const seite = (wer, id, st, unter) => `<div class="kt-seite ${wer}">${id ? wappen(id, 'kt-wappen') : ''}<b class="kt-ort">${esc(id ? ortName(id) : '')}</b>
      <span class="kt-st">${st != null ? st : '–'}</span><small class="kt-unter">${unter}</small></div>`;
    const ort = neutral ? 'neutraler Platz' : heimSpiel ? 'Heimspiel' : 'Auswärtsspiel';
    const formHeim = typeof CLUB !== 'undefined' ? CLUB.formation : '';
    let k = bar.querySelector('.kt-tafel');
    const html = `${seite('heim', 'fcm', staerkeAus(hl && hl.textContent), esc(formHeim))}
      ${seite('gast', gegId, staerkeAus(al && al.textContent), gegForm ? esc(gegForm) : `${ti('eye-off')}verdeckt`)}`;
    if (!k) {
      // Altkopf: Spalten links/rechts (Labels bleiben als Quelle, unsichtbar), Mitte (Stand, Minute) bleibt stehen
      [...bar.children].forEach(c => c.classList.add(c.querySelector('#score') ? 'kt-mitte' : 'kt-alt'));
      k = document.createElement('div'); k.className = 'kt-tafel';
      bar.insertBefore(k, bar.firstChild);
      bar.classList.add('kt-an');
    }
    if (k.dataset.html !== html) { k.innerHTML = html; k.dataset.html = html; }
    // Spielort klein unter der Minute
    const mitte = bar.querySelector('.kt-mitte');
    if (mitte) {
      let o = mitte.querySelector('.kt-ortchip');
      if (!o) { o = document.createElement('small'); o.className = 'kt-ortchip'; mitte.appendChild(o); }
      if (o.textContent !== ort) o.textContent = ort;
    }
  }
  let tafelBeobachter = null;
  function tafelBeobachten() {
    if (!DOM || tafelBeobachter) return;
    const ziele = ['home-str-label', 'away-str-label', 'away-team-label'].map(id => document.getElementById(id)).filter(Boolean);
    if (!ziele.length) return;
    tafelBeobachter = new MutationObserver(() => { try { tafel(); } catch (e) { /* Tafel ist Beiwerk */ } });
    ziele.forEach(z => tafelBeobachter.observe(z, { childList: true, characterData: true, subtree: true }));
    const sub = document.getElementById('away-str-label');
    if (sub && sub.parentNode) tafelBeobachter.observe(sub.parentNode, { childList: true, subtree: true, characterData: true });
  }

  // ── C) Spielplan ─────────────────────────────────────────────────────────
  function spielplanHtml() {
    const fg = typeof findFcmGroup === 'function' ? findFcmGroup(LEAGUE) : null;
    const plan = fg && LEAGUE.fixtures ? LEAGUE.fixtures[fg.key] : null;
    if (!plan) return null;
    const erg = LEAGUE.dflEigeneErg && LEAGUE.dflEigeneErg.saison === LEAGUE.season ? LEAGUE.dflEigeneErg.erg : {};
    const pill = (e, g) => `<i class="kf-pill ${e > g ? 's' : e < g ? 'n' : 'u'}">${e > g ? 'S' : e < g ? 'N' : 'U'}</i>`;
    const zeile = (nr, id, heim, rechts, kl, unter) => `<div class="kf-zeile${kl ? ' ' + kl : ''}">
      <span class="kf-nr">${nr}</span>${wappen(id, 'kf-wappen')}
      <span class="kf-wer"><b>${esc((teamVon(id) || {}).name || (typeof friendlyOpponentTeam === 'function' ? ((friendlyOpponentTeam(LEAGUE, id) || {}).name || '') : ''))}</b>
        <small>${heim ? 'Heim' : 'Auswärts'}${unter ? ' · ' + unter : ''}</small></span>${rechts}</div>`;
    const spielen = '<button class="fixture-btn kf-spielen" onclick="ensureFixtureLoaded()">Spielen</button>';
    // Vorbereitung: Testspiele (Engine stellt den eigenen Verein immer als „Heim“ dar → f.gh = eigene Tore)
    const tests = (LEAGUE.friendlies || []).map(f => {
      const naechst = !f.played && f.week === LEAGUE.week;
      const rechts = f.played ? `<span class="kf-erg">${pill(f.gh, f.ga)}<b>${f.gh}:${f.ga}</b></span>` : naechst ? spielen : `<span class="kf-kw">KW ${f.week}</span>`;
      return zeile(typeof calendarMonthOfWeek === 'function' ? calendarMonthOfWeek(f.week).slice(0, 3) : '', f.opponentId, f.isHome, rechts,
        (f.played ? 'gespielt' : '') + (naechst ? ' naechst' : ''), 'Testspiel');
    }).join('');
    const nx = typeof fcmNextFixture === 'function' && !(typeof seasonFullyComplete === 'function' && seasonFullyComplete(LEAGUE)) ? fcmNextFixture(LEAGUE) : null;
    const naechstIdx = nx ? nx.matchday - 1 : -1;
    const liga = plan.map((tag, i) => {
      const paar = tag.find(x => (x[0] != null ? x[0] : x.home) === 'fcm' || (x[1] != null ? x[1] : x.away) === 'fcm');
      // Rückmeldung 17.10. (6): Bye Week als eigene Zeile
      if (!paar) return `<div class="kf-zeile kf-bye${i < LEAGUE.matchday ? ' gespielt' : ''}"><span class="kf-nr">${i + 1}</span>${ti('moon', 'kf-bye-ico')}
        <span class="kf-wer"><b>Bye Week</b><small>spielfrei · Erholung</small></span><span class="kf-kw">KW ${Array.isArray(LEAGUE.matchWeeks) ? LEAGUE.matchWeeks[i] : ''}</span></div>`;
      const h = paar[0] != null ? paar[0] : paar.home, a = paar[1] != null ? paar[1] : paar.away;
      const heim = h === 'fcm', geg = heim ? a : h, nr = i + 1;
      const gespielt = i < LEAGUE.matchday, naechst = i === naechstIdx;
      let rechts;
      if (gespielt) {
        const x = erg[nr];
        rechts = x ? `<span class="kf-erg">${pill(heim ? x[0] : x[1], heim ? x[1] : x[0])}<b>${heim ? x[0] : x[1]}:${heim ? x[1] : x[0]}</b></span>` : '<span class="kf-kw">gespielt</span>';
      } else if (naechst) rechts = spielen;
      else rechts = `<span class="kf-kw">KW ${Array.isArray(LEAGUE.matchWeeks) ? LEAGUE.matchWeeks[i] : ''}</span>`;
      return zeile(nr, geg, heim, rechts, (gespielt ? 'gespielt' : '') + (naechst ? ' naechst' : ''), naechst && Array.isArray(LEAGUE.matchWeeks) ? 'KW ' + LEAGUE.matchWeeks[i] : '');
    }).join('');
    return `<div class="kf">${tests ? `<h4 class="kf-titel">${ti('friends')}Vorbereitung</h4><div class="kf-liste">${tests}</div>` : ''}
      <h4 class="kf-titel">${ti('trophy')}Liga · 26 Spiele, 5 Bye Weeks</h4><div class="kf-liste">${liga}</div></div>`;
  }

  // ── D) Torjäger ──────────────────────────────────────────────────────────
  // Nutzer 2026-10-14: „bei den torjägern und vorlagengebern auch die bilder in klein mit dabei“ – zwei Listen, je mit Gesicht
  function torjaegerHtml() {
    const alle = typeof buildTopScorers === 'function' ? buildTopScorers(LEAGUE, 0) : [];
    if (!alle.length) return null;
    const gesicht = s => {
      let svg = '';
      try { const f = window.DFLSpiel && s.teamId ? DFLSpiel.franchise(s.teamId === 'fcm' ? 'fcm' : s.teamId) : null;
        svg = s.spieler && window.DFLIdentitaet ? DFLIdentitaet.gesichtSvg(s.spieler, f && f.farben ? { farben: f.farben } : null) : ''; } catch (e) { svg = ''; }
      return `<span class="kz-gesicht" aria-hidden="true">${svg}</span>`;
    };
    const liste = (arr, zahl, neben) => '<div class="kz-liste">' + arr.map((s, i) => {
      const t = s.own ? { id: 'fcm' } : teamNachName(s.teamName);
      return `<div class="kz-zeile${s.own ? ' eigen' : ''}"><span class="kz-rang">${i + 1}</span>${gesicht(s)}
          <span class="kz-wer"><b>${esc(s.name)}</b><small>${t ? wappen(t.id, 'kz-wappen mini') : ''}${esc(s.teamName)}</small></span>
          <span class="kz-zahl"><b>${zahl(s)}</b><small>${neben(s)}</small></span></div>`;
    }).join('') + '</div>';
    const tore = alle.filter(s => s.goals > 0).slice(0, CFG.torjaeger);
    const vorl = alle.filter(s => s.assists > 0).sort((a, b) => b.assists - a.assists || b.goals - a.goals).slice(0, CFG.torjaeger);
    return `<div class="kt-liste-kopf"><h3>${ti('ball-football')}Torjäger</h3><small>Tore</small></div>` + liste(tore, s => s.goals, s => s.assists + ' Vorl.') +
      (vorl.length ? `<div class="kt-liste-kopf kz-zweite"><h3>${ti('shoe')}Vorlagengeber</h3><small>Vorlagen</small></div>` + liste(vorl, s => s.assists, s => s.goals + ' Tore') : '');
  }

  // ── E) Tiefenkader ───────────────────────────────────────────────────────
  const TIEFE = [['tw', 'Tor'], ['abw', 'Abwehr'], ['mf', 'Mittelfeld'], ['st', 'Angriff']];
  function tiefenkaderHtml() {
    const own = (typeof SQUAD !== 'undefined' ? SQUAD : []).filter(p => !p.onLoanAt);
    const basis = p => (typeof ovrBase === 'function' ? ovrBase(p) : p.ovr);
    return '<div class="depth-wrap kd">' + TIEFE.map(([g, titel]) => {
      const liste = own.filter(p => posGruppe(p.pos) === g).sort((a, b) => b.ovr - a.ovr);
      const zeilen = liste.map((p, i) => {
        const inj = typeof isInjured === 'function' && isInjured(p), sus = typeof isSuspended === 'function' && isSuspended(p);
        const fit = Math.round(typeof p.fitness === 'number' ? p.fitness : 95), d = (p.ovr || 0) - basis(p);
        const aus = inj ? `<span class="kd-aus">${ti('bandage')}${p.injuryWeeks}</span>` : sus ? `<span class="kd-aus">${ti('ban')}${p.suspendedGames}</span>` : '';
        return `<div class="depth-row kd-zeile${i === 0 ? ' is-starter' : ''}${inj || sus ? ' unavailable' : ''}" onclick="renderPlayerCard(getPlayer('${esc(p.id)}'))">
          <span class="kd-rang${i < 3 ? ' m' + (i + 1) : ''}">${i + 1}</span>${posMarke(p)}
          <span class="kd-wer"><b>${esc(typeof displayName === 'function' ? displayName(p) : p.name)}</b>${aus}
            <span class="kd-fit" title="Fitness ${fit}"><i style="width:${fit}%;background:${fitFarbe(fit)}"></i></span></span>
          <span class="kd-ovr">${basis(p)}${d ? `<small class="${d > 0 ? 'auf' : 'ab'}">${d > 0 ? '▲' : '▼'}${Math.abs(d)}</small>` : ''}</span></div>`;
      }).join('') || '<div class="depth-empty">keine Spieler</div>';
      return `<section class="depth-cat kd-gruppe"><h4 class="kd-kopf"><i class="kd-punkt kpm-${g}"></i>${titel}<small>${liste.length}</small></h4>${zeilen}</section>`;
    }).join('') + '</div>';
  }

  // ── F) Training ──────────────────────────────────────────────────────────
  const INTENS = [['leicht', 'Leicht', 0.57], ['normal', 'Normal', 1.0], ['intensiv', 'Intensiv', 1.57]];
  const FOKUS = [['ausgewogen', 'Ausgewogen', 'scale'], ['defensive', 'Defensive', 'shield'], ['offensive', 'Offensive', 'target-arrow'], ['fitness', 'Fitness', 'run']];
  const ohneEmoji = s => (W.DFLKenney ? DFLKenney.ohne(s) : String(s || '')).replace(/\s+/g, ' ').trim();
  function tempoZeichen(t) {
    if (/Potenzial erreicht/.test(t)) return ['lock', 'neutral', 'Potenzial erreicht'];
    if (/Abbau-Gefahr/.test(t)) return ['trending-down', 'schlecht', 'Abbau-Gefahr'];
    if (/Abbau möglich/.test(t)) return ['alert-triangle', 'mittel', 'Abbau möglich'];
    if (/Kaum Entwicklung/.test(t)) return ['zzz', 'neutral', 'kaum Entwicklung'];
    const m = /\+([\d,]+)/.exec(t);
    return m ? ['trending-up', 'gut', `+${m[1]} je Saison`] : null;
  }
  function trainingUmbauen() {
    const el = document.getElementById('training-content');
    if (!el || !CLUB.training) return;
    const kopf = el.firstElementChild, liste = kopf && kopf.nextElementSibling;
    if (!kopf || kopf.classList.contains('ktr') || !liste || liste.id === 'dfl-trainingsgruppe') return;
    const t = CLUB.training, txt = kopf.textContent || '';
    // aus dem Basisspiel ablesen: Faktoren, Sperre, Hinweise, Gelände, Fortschritte (TrainingSystem rechnet privat)
    const knoepfe = [...kopf.querySelectorAll('button')];
    const faktor = k => { const b = knoepfe.find(x => x.textContent.indexOf(INTENS.find(i => i[0] === k)[1]) >= 0); const m = b && /×\s*([\d,]+)/.exec(b.textContent); return m ? m[1] : zahl(INTENS.find(i => i[0] === k)[2], 2); };
    const gesperrt = knoepfe.some(b => /Intensiv/.test(b.textContent) && /gesperrt/.test(b.textContent));
    const gel = /Stufe (\d+) \(\+(\d+)% Entwicklung\)/.exec(txt), fort = /([\d.,]+)\/Woche/.exec(txt);
    const hinweisFrei = /Intensivtraining verfügbar/.test(txt), hinweisZu = /Intensivtraining gesperrt/.test(txt);
    // Zeilen des Basisspiels (gleiche Reihenfolge wie SQUAD nach Stärke): Tempo der Entwicklung und Form ablesen
    const alt = [...liste.children];
    const sortiert = SQUAD.slice().sort((a, b) => (b.ovr || 0) - (a.ovr || 0));
    const scout = (CLUB.facilities && CLUB.facilities.scouting) || 1;
    const zeilen = sortiert.map((p, i) => {
      const row = alt[i], voll = ((p.firstName || '') + ' ' + p.name).trim();
      const passt = row && (row.textContent || '').indexOf(p.name) >= 0;
      const tempo = passt && row.children[1] ? tempoZeichen(ohneEmoji(row.children[1].lastElementChild ? row.children[1].lastElementChild.textContent : '')) : null;
      const form = passt ? /Ø\s*([\d,]+)/.exec(row.textContent || '') : null;
      const snap = t.seasonSnapshot && t.seasonSnapshot[p.id], d = snap && typeof snap.ovr === 'number' ? (p.ovr || 0) - snap.ovr : 0;
      const apps = (p._recentApps || []).slice(-5);
      const pot = typeof potentialOnly === 'function' ? potentialOnly(p, scout) : '';
      const inj = typeof isInjured === 'function' && isInjured(p);
      return `<div class="ktr-zeile${inj ? ' verletzt' : ''}">${posMarke(p)}
        <span class="ktr-wer"><b>${esc(voll)}</b><small>${p.age} J.${inj ? ` · ${ti('bandage')}${p.injuryWeeks} Wo.` : ''}${pot ? ' · ' + esc(pot) : ''}</small></span>
        <span class="ktr-rechts">${d ? `<span class="ktr-delta ${d > 0 ? 'auf' : 'ab'}">${d > 0 ? '▲' : '▼'}${Math.abs(d)}</span>` : ''}<b class="ktr-ovr">${p.ovr}</b></span>
        <span class="ktr-unten">${tempo ? `<span class="ktr-tempo kz-${tempo[1]}">${ti(tempo[0])}${esc(tempo[2])}</span>` : ''}
          <span class="ktr-apps" title="Startelf in den letzten 5 Spielen">${apps.length ? apps.map(a => `<i class="${a ? 'an' : ''}"></i>`).join('') : ''}</span>
          ${form ? `<span class="ktr-form">Ø ${form[1]}</span>` : ''}</span></div>`;
    }).join('');
    const neu = document.createElement('div');
    neu.className = 'ktr';
    neu.innerHTML = `<section class="ktr-steuerung">
        <h3 class="ktr-titel">${ti('barbell')}Training${gel ? `<small>Gelände Stufe ${gel[1]} · +${gel[2]} % Entwicklung</small>` : ''}</h3>
        ${hinweisZu ? `<div class="ktr-hinweis schlecht">${ti('lock')}Intensiv nur in der Vorbereitung und in spielfreien Wochen – zurück auf Normal.</div>` : ''}
        ${hinweisFrei ? `<div class="ktr-hinweis gut">${ti('circle-check')}Intensiv möglich – höheres Verletzungsrisiko.</div>` : ''}
        <div class="ktr-seg" role="group" aria-label="Intensität">${INTENS.map(([k, label]) => {
          const zu = k === 'intensiv' && gesperrt;
          return `<button type="button" data-ktr-int="${k}" class="${t.intensity === k ? 'an' : ''}${zu ? ' zu' : ''}" aria-pressed="${t.intensity === k}"${zu ? ' aria-disabled="true"' : ''}>
            ${zu ? ti('lock') : ''}<b>${label}</b><small>×${faktor(k)}</small></button>`;
        }).join('')}</div>
        <div class="ktr-chips" role="group" aria-label="Schwerpunkt">${FOKUS.map(([k, label, ic]) =>
          `<button type="button" data-ktr-fok="${k}" class="${t.focus === k ? 'an' : ''}" aria-pressed="${t.focus === k}">${ti(ic)}${label}</button>`).join('')}</div>
      </section>
      <section class="ktr-liste"><h4 class="ktr-h">Entwicklung <small>${fort ? `Ø ${fort[1].replace('.', ',')} Fortschritte je Woche · ` : ''}▲ seit Saisonstart</small>${typeof infoBtn === 'function' ? infoBtn('training-liste') : ''}</h4>
        ${zeilen || '<p class="ktr-leer">Keine Spieler im Kader.</p>'}</section>`;
    el.replaceChild(neu, kopf);
    liste.remove();
    neu.addEventListener('click', ev => {
      const b = ev.target.closest('[data-ktr-int], [data-ktr-fok]'); if (!b) return;
      if (b.dataset.ktrInt) {
        if (b.classList.contains('zu')) { if (typeof showToast === 'function') showToast('Intensivtraining nur in der Vorbereitung oder in spielfreien Wochen.', 'warn'); return; }
        CLUB.training.intensity = b.dataset.ktrInt;
      } else CLUB.training.focus = b.dataset.ktrFok;
      if (W.TrainingSystem) TrainingSystem.renderTrainingTab();
    });
  }
  if (typeof W.infoKarteSetzen === 'function') {
    W.infoKarteSetzen('training-liste', 'Entwicklung', 'Je jünger und je mehr Einsätze, desto schneller. <b>▲</b> = Stärke seit Saisonstart, die Kästchen = Startelf in den letzten 5 Spielen, <b>Ø</b> = Form (Noten). Gute Noten beschleunigen, eine Krise bremst.');
  }

  // ── H) Vertragsverhandlung (contracts_patch.js zeichnet #nego-overlay neu) ─────────
  function verhandlungUmbauen(ov) {
    const s = W._nego, karte = ov && ov.querySelector('.nego-card');
    if (!s || !karte || karte.dataset.ko) return;
    karte.dataset.ko = '1'; karte.classList.add('ko-nego');
    const p = s.player || spieler(s.pid);
    const name = karte.querySelector('.nego-name');
    if (p && name && !karte.querySelector('.ko-gesicht')) name.insertAdjacentHTML('beforebegin', gesicht(p, 'nego-gesicht'));
    const sub = karte.querySelector('.nego-sub');
    if (p && sub) sub.innerHTML = sub.innerHTML.replace(/ · ([A-Z]{2,3}) · /, (m, pos) => ' · ' + posMarke(pos) + ' · ');
    // Angebot gegen Forderung
    const dem = s.dem || {}, max = Math.max(s.wage || 0, dem.wage || 0) * 1.18 || 1;
    const pc = x => Math.max(2, Math.min(100, x / max * 100)).toFixed(1);
    const euro = x => (typeof formatEuro === 'function' ? formatEuro(x) : Math.round(x) + ' €');
    const fehlt = (dem.wage || 0) - (s.wage || 0);
    const balken = `<div class="kn-vergleich" role="img" aria-label="Angebot ${euro(s.wage)} je Woche, Forderung ${euro(dem.wage)}">
      <div class="kn-bahn"><i class="kn-angebot ${fehlt > 0 ? 'unter' : 'drueber'}" style="width:${pc(s.wage)}%"><b>${euro(s.wage).replace(' €', '')}</b></i><em class="kn-forderung" style="left:${pc(dem.wage)}%"></em></div>
      <div class="kn-skala"><span>€ je Woche</span><span>Forderung <b>${euro(dem.wage).replace(' €', '')}</b></span></div></div>`;
    const forderung = karte.querySelector('.nego-demand');
    if (forderung && !karte.querySelector('.kn-vergleich')) forderung.insertAdjacentHTML('afterend', balken);
    // Laufzeit als Segment 1–5 (statt − / +)
    const MAXY = typeof MAX_CONTRACT_YEARS !== 'undefined' ? MAX_CONTRACT_YEARS : 5;
    const jahreZeile = [...karte.querySelectorAll('.nego-row')].find(r => /Laufzeit/.test(r.textContent));
    if (jahreZeile && !s.done) {
      const seg = document.createElement('div');
      seg.className = 'nego-row kn-jahre';
      seg.innerHTML = `<span class="nego-label">Laufzeit</span><span class="kn-seg" role="group" aria-label="Laufzeit in Jahren">` +
        Array.from({ length: MAXY }, (_, i) => i + 1).map(j => `<button type="button" class="${s.years === j ? 'an' : ''}" aria-pressed="${s.years === j}" data-kn-jahre="${j}">${j}</button>`).join('') + '</span>';
      jahreZeile.replaceWith(seg);
      seg.addEventListener('click', ev => {
        const b = ev.target.closest('[data-kn-jahre]'); if (!b || !W._nego) return;
        W._nego.years = +b.dataset.knJahre;
        if (typeof W.negoAdjust === 'function') W.negoAdjust('years', 0);
      });
    }
    // Erfolgschance als Ring, Berater und Versuche
    const sat = karte.querySelector('.nego-sat');
    if (sat && !sat.querySelector('.kn-ring')) {
      const tx = sat.textContent || '';
      const chance = +((/Erfolgschance\s*([\d]+)\s*%/.exec(tx) || [])[1] || 0);
      const berater = (/Beraters:\s*([\d]+)\s*%/.exec(tx) || [])[1];
      const v = /Versuch (\d+) von (\d+)/.exec(tx);
      const sicher = /Zusage sicher/.test(tx);
      const kl = chance >= 70 ? 'gut' : chance >= 35 ? 'mittel' : 'schlecht';
      const r = 15.9155;
      sat.innerHTML = `<div class="kn-chance"><svg class="kn-ring ${kl}" viewBox="0 0 36 36" role="img" aria-label="Erfolgschance ${chance} %">
          <circle class="kn-ring-grund" cx="18" cy="18" r="${r}"/><circle class="kn-ring-wert" cx="18" cy="18" r="${r}" stroke-dasharray="${chance} 100" transform="rotate(-90 18 18)"/>
          <text x="18" y="21" text-anchor="middle">${chance} %</text></svg>
        <div class="kn-chance-text"><b>Erfolgschance</b>${berater ? `<small>Berater ${berater} %${sicher ? ' · Zusage sicher' : ''}</small>` : ''}
          ${v ? `<span class="kn-versuche" title="Versuch ${v[1]} von ${v[2]}">${Array.from({ length: +v[2] }, (_, i) => `<i class="${i < +v[1] ? 'an' : ''}"></i>`).join('')}</span>` : ''}</div></div>`;
    }
  }

  // ── I) „Alle Details“ (alte Spielerkarte) ────────────────────────────────
  const WERT_ZEILEN = ['Tempo', 'Mentalität', 'Technik'];
  // renderPlayerCard zeichnet die Karte jedes Mal ganz neu – der Umbau ist deshalb ohne Merker, aber wiederholbar
  function detailsUmbauen(p) {
    const el = document.getElementById('playercard-sec');
    if (!el || !p) return;
    el.classList.add('ko-details');
    const radar = el.querySelector('.pcard-radar'); if (radar) radar.remove();
    const sub = el.querySelector('.pcard-sub');
    if (sub && !sub.querySelector('.kpm')) {
      const teile = sub.textContent.split(' · ').filter(x => x && x.trim() !== 'Deutschland');
      sub.innerHTML = teile.map(x => RE_POS.test(x.trim()) ? posMarke(x.trim()) : esc(x)).join(' · ');
    }
    el.querySelectorAll('.pcard-row').forEach(r => {
      const lab = r.querySelector('span'), wert = r.querySelector('b');
      if (!lab || !wert || r.classList.contains('kd-wert')) return;
      const l = lab.textContent.trim(), v = parseInt(wert.textContent, 10);
      if (WERT_ZEILEN.indexOf(l) >= 0 && isFinite(v)) {
        r.classList.add('kd-wert');
        r.innerHTML = `<span>${esc(l)}</span><span class="k-bahn kd-bahn"><i class="k-fuell" style="width:${Math.max(2, Math.min(100, v))}%"></i></span><b>${v}</b>`;
      }
    });
  }

  // ── J) Saison-Banner als Chips ───────────────────────────────────────────
  const KONF = { NORD_OST: 'Nord-Ost', SUED_WEST: 'Süd-West' };
  function bannerUmbauen() {
    const el = document.getElementById('season-banner'); if (!el || el.querySelector('.kb-chips')) return;
    const knoepfe = [...el.querySelectorAll('button')];
    let konf = '';
    try { const f = DFLSpiel.franchise('fcm'); konf = KONF[f.conference] || String(f.conference || '').replace(/_/g, '-'); } catch (e) { /* ohne Franchise */ }
    const pl = ligaPlatz('fcm'), t = teamVon('fcm');
    const max = typeof maxMatchday === 'function' ? maxMatchday(LEAGUE) : 26;
    const chip = (inhalt, kl) => `<span class="kb-chip${kl ? ' ' + kl : ''}">${inhalt}</span>`;
    el.innerHTML = `<div class="kb-chips">${chip(`<b>${typeof seasonYearLabel === 'function' ? seasonYearLabel(LEAGUE.season) : LEAGUE.season}</b>`)}
      ${konf ? chip(ti('compass') + esc(konf)) : ''}${chip(`Spieltag <b>${LEAGUE.matchday}</b>/${max}`)}${t && t.played && pl ? chip(`Platz <b>${pl}</b>`) : ''}</div>`;
    knoepfe.forEach(b => { b.classList.add('kb-knopf'); el.appendChild(b); });
    el.classList.add('kb');
  }

  // ── K) Office: Wochenleiste statt Terminliste ────────────────────────────
  function wochenleisteHtml() {
    const fg = typeof findFcmGroup === 'function' ? findFcmGroup(LEAGUE) : null;
    const plan = fg && LEAGUE.fixtures ? LEAGUE.fixtures[fg.key] : null;
    const mw = Array.isArray(LEAGUE.matchWeeks) ? LEAGUE.matchWeeks : [];
    const po = W.DFLPlayoffs && DFLPlayoffs.wochen ? (DFLPlayoffs.wochen() || []) : [];
    const kacheln = [];
    for (let w = LEAGUE.week; kacheln.length < CFG.wochenleiste && w <= (typeof SEASON_WEEKS === 'number' ? SEASON_WEEKS : 52); w++) {
      const md = mw.indexOf(w), test = (LEAGUE.friendlies || []).find(f => f.week === w);
      let bild = ti('barbell', 'kw-ico'), unten = 'Training', kl = '', titel = 'Trainingswoche';
      if (md >= 0 && plan && plan[md]) {
        const paar = plan[md].find(x => (x[0] != null ? x[0] : x.home) === 'fcm' || (x[1] != null ? x[1] : x.away) === 'fcm');
        if (paar) {
          const h = paar[0] != null ? paar[0] : paar.home, a = paar[1] != null ? paar[1] : paar.away, heim = h === 'fcm', geg = heim ? a : h;
          bild = wappen(geg, 'kw-wappen'); unten = (heim ? 'H' : 'A') + ` · ${md + 1}.`; kl = 'spiel'; titel = `Spieltag ${md + 1} · ${heim ? 'gegen' : 'bei'} ${(teamVon(geg) || {}).name || ''}`;
        } else { bild = ti('moon', 'kw-ico'); unten = 'Bye'; kl = 'frei'; titel = 'Bye Week – spielfrei'; }
      } else if (test) {
        bild = wappen(test.opponentId, 'kw-wappen'); unten = (test.isHome ? 'H' : 'A') + ' · Test'; kl = 'test'; titel = 'Testspiel';
      } else if (po.indexOf(w) >= 0) { bild = ti('trophy', 'kw-ico'); unten = 'Playoffs'; kl = 'po'; titel = 'Playoff-Woche'; }
      else if (typeof isBreakWeek === 'function' && isBreakWeek(w)) { bild = ti('moon', 'kw-ico'); unten = 'frei'; kl = 'frei'; titel = 'Spielfrei'; }
      kacheln.push(`<div class="kw-tag ${kl}${w === LEAGUE.week ? ' jetzt' : ''}" title="KW ${w}: ${esc(titel)}"><small>KW ${w}</small>${bild}<b>${unten}</b></div>`);
    }
    return `<div class="kw-leiste" role="list" aria-label="Die nächsten Wochen">${kacheln.join('')}</div>`;
  }

  // ── L) Kleinteile ────────────────────────────────────────────────────────
  // „OVR“ → „Stärke“ in allem Sichtbaren (Texte und Titel); Tabellenköpfe mit „Δ OVR“ ebenso
  const RE_OVR = /\bOVR\b/g, RE_OVR_T = /\bOVR\b/;
  const ovrText = s => String(s == null ? '' : s).replace(/OVR\/Sai\./g, 'Stärke/Saison').replace(RE_OVR, 'Stärke');
  const SKIP = 'script,style,textarea,input,select,noscript,template,[contenteditable="true"],[data-ovr-ok]';
  function ovrErsetzen(wurzel) {
    if (!DOM || !wurzel) return;
    if (wurzel.nodeType === 3) { if (RE_OVR_T.test(wurzel.nodeValue) && !(wurzel.parentElement && wurzel.parentElement.closest(SKIP))) wurzel.nodeValue = ovrText(wurzel.nodeValue); return; }
    if (wurzel.nodeType !== 1 && wurzel.nodeType !== 11) return;
    if (wurzel.nodeType === 1 && wurzel.closest(SKIP)) return;
    const tw = document.createTreeWalker(wurzel, NodeFilter.SHOW_TEXT, { acceptNode: x => (RE_OVR_T.test(x.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
    const liste = []; let x;
    while ((x = tw.nextNode())) liste.push(x);
    liste.forEach(n => { if (!(n.parentElement && n.parentElement.closest(SKIP))) n.nodeValue = ovrText(n.nodeValue); });
    if (wurzel.querySelectorAll) wurzel.querySelectorAll('[title*="OVR"]').forEach(e => { e.title = ovrText(e.title); });
  }
  // Moral · Form · Fitness: drei Mini-Säulen statt zwei Punkte und einer dünnen Leiste (Höhe = Wert, Farbe = Zustand)
  function saeulen(p) {
    if (W.ensureFitness) { try { W.ensureFitness(p); } catch (e) { /* ohne Fitness */ } }
    const mor = Math.round(typeof p.morale === 'number' ? p.morale : 70), fit = Math.round(typeof p.fitness === 'number' ? p.fitness : 95);
    let form = null;
    try { const l = p.matchRatings && Array.isArray(p.matchRatings.list) ? p.matchRatings.list.slice(-5) : []; if (l.length) form = l.reduce((a, b) => a + b, 0) / l.length; } catch (e) { /* ohne Noten */ }
    const art = (v, gut, mittel) => v == null ? 'leer' : v >= gut ? 'gut' : v >= mittel ? 'mittel' : 'schlecht';
    const h = v => Math.max(18, Math.min(100, v)).toFixed(0);
    const formH = form == null ? 18 : Math.max(18, Math.min(100, (form - 4) / 5 * 100));
    const titel = `Moral ${mor} · Form ${form == null ? 'kein Spiel' : form.toFixed(1).replace('.', ',')} · Fitness ${fit}${fit < 62 ? ' – braucht eine Pause' : ''}`;
    return `<span class="squad-dots ko-mff" title="${esc(titel)}" role="img" aria-label="${esc(titel)}">` +
      `<i class="m ${art(mor, 70, 50)}" style="height:${h(mor)}%"></i><i class="f ${art(form, 7, 5.5)}" style="height:${formH.toFixed(0)}%"></i>` +
      `<i class="fit ${art(fit, 80, 62)}" style="height:${h(fit)}%"></i></span>`;
  }

  // ── Liga-Trade-Log und KI-Trade-Meldungen: Wappen tauschen, Spieler als Marke + Stärke ────────
  // „Essen Red Miners (Neuaufbau) holt Paul Koch (AV, 74) von Duisburg Zebras für Levin Schulz (IV, 74) + 2027 Runde 2“
  const RE_KITRADE = /^(.+?) \(([^()]+)\) holt (.+) von (.+?) für (.+?)\.?$/;
  function kiTradeTeile(text) {
    const m = RE_KITRADE.exec(String(text || '').trim());
    if (!m) return null;
    const stueck = s => {
      const p = /^(.+?) \(([A-Z]{2,3}), (\d+)(?:, [^)]*)?\)$/.exec(s.trim());
      if (p) return { art: 'spieler', name: p[1], pos: p[2], ovr: +p[3] };
      const k = /^(?:Pick )?(\d{4})(?: ·)? Runde (\d)/.exec(s.trim());
      if (k) return { art: 'pick', jahr: +k[1], runde: +k[2] };
      return { art: 'text', text: s.trim() };
    };
    const a = teamNachName(m[1]), b = teamNachName(m[4]);
    return { a: m[1], aId: a ? a.id : null, lage: m[2], holt: m[3].split(/, (?=[^,]+\()/).map(stueck), b: m[4], bId: b ? b.id : null, fuer: m[5].split(' + ').map(stueck) };
  }
  function kiTradeHtml(text) {
    const t = kiTradeTeile(text); if (!t) return null;
    const stk = x => x.art === 'spieler' ? `<span class="kh-sp">${posMarke(x.pos)}<b>${esc(x.name)}</b><em>${x.ovr}</em></span>`
      : x.art === 'pick' ? `<span class="kh-sp pick">${ti('ticket')}<b>${x.jahr}</b><em>R${x.runde}</em></span>` : `<span class="kh-sp">${esc(x.text)}</span>`;
    const seite = (id, name, liste) => `<div class="kh-seite">${id ? wappen(id, 'kh-wappen') : ''}<span class="kh-team">${esc(id ? kuerzel(id) || name : name)} <small>holt</small></span>
      <span class="kh-teile">${liste.map(stk).join('')}</span></div>`;
    return `<div class="kh" title="${esc(text)}">${seite(t.aId, t.a, t.holt)}<span class="kh-pfeil">${ti('arrows-exchange')}</span>${seite(t.bId, t.b, t.fuer)}</div>`;
  }
  function tradeLogUmbauen(wurzel) {
    (wurzel.matches && wurzel.matches('.dfl-tr-log') ? [wurzel] : [...wurzel.querySelectorAll('.dfl-tr-log')]).forEach(log => {
      log.querySelectorAll('li:not([data-ko])').forEach(li => {
        li.dataset.ko = '1';
        const zeit = li.querySelector('.dfl-draft-sub'), roh = li.textContent.replace(zeit ? zeit.textContent : '', '').trim();
        const h = kiTradeHtml(roh); if (!h) return;
        li.classList.add('kh-zeile');
        li.innerHTML = `<small class="kh-zeit">${esc(zeit ? zeit.textContent.replace(/:$/, '') : '')}</small>${h}`;
      });
    });
  }

  // ── D) Wertliste: Tabellen → Kacheln und Zeilen (am Handy) ─────────────────────────
  function wertlisteUmbauen(box) {
    if (!box || !shell()) return;
    box.querySelectorAll('table.dfl-tabelle:not([data-ko])').forEach(tab => {
      tab.dataset.ko = '1';
      const kopf = [...tab.querySelectorAll('thead th')].map(th => th.textContent.trim());
      const ix = n => kopf.indexOf(n);
      const zeilen = [...tab.querySelectorAll('tbody tr')];
      let html = '';
      const dz = s => { const v = parseFloat(String(s || '').replace(',', '.')); return isFinite(v) ? v.toLocaleString('de-DE', { maximumFractionDigits: 1 }) : esc(s); };
      if (ix('Pick') >= 0 && ix('Runde') >= 0) {
        html = '<div class="kw-legende">Groß: Wert des Picks in diesem Draft · klein: derselbe Pick im nächsten Jahr</div><div class="kw-picks">' + zeilen.map(tr => { const td = [...tr.children].map(x => x.textContent.trim());
          return `<div class="kw-pick"><small>#${esc(td[ix('Pick')])} · ${esc(td[ix('Runde')].replace('Runde ', 'R'))}</small><b>${dz(td[ix('Wert')])}</b><em>${dz(td[ix('Nächstes Jahr')] || '')}<span> nächstes Jahr</span></em></div>`; }).join('') + '</div>';
      } else if (ix('Spieler') >= 0) {
        html = '<div class="kw-liste">' + zeilen.map(tr => {
          const td = [...tr.children], tx = i => i >= 0 && td[i] ? td[i].textContent.trim() : '';
          const nm = td[ix('Spieler')], b = nm && nm.querySelector('b'), team = nm && nm.querySelector('.dfl-draft-sub');
          // D78: fremde Spieler ohne Scout-Bericht – Name als Knopf (öffnet Bericht/„Scouten“, Klick über data-sc), Stärke als Stufe („80er“)
          const knopf = nm && nm.querySelector('.sc-namelink');
          // D112: Stil-Zeichen am Namen mitnehmen (fremde Spieler tragen es im Namensknopf)
          const z = !knopf && nm ? nm.querySelector('.stil-z') : null;
          const st = td[ix('OVR') >= 0 ? ix('OVR') : ix('Stärke')];
          const stHtml = st && st.querySelector('.sc-stufe, .sc-zahl') ? st.innerHTML : esc(st ? st.textContent.trim() : '');
          return `<div class="kw-zeile${tr.classList.contains('fcm-row') ? ' eigen' : ''}">${ix('#') >= 0 ? `<span class="kw-rang">${esc(tx(ix('#')))}</span>` : ''}
            ${posMarke(tx(ix('Pos')).replace(/[()]/g, ' ').split(/\s+/).filter(Boolean))}
            <span class="kw-wer">${knopf ? knopf.outerHTML : `<b>${esc(b ? b.textContent : tx(ix('Spieler')))}${z ? z.outerHTML : ''}</b>`}<small>${team ? esc(team.textContent) + ' · ' : ''}${esc(tx(ix('Alter')))} J · Cap ${esc(tx(ix('Cap Hit')))}</small></span>
            <span class="kw-st">${stHtml}<small>Stärke</small></span><span class="kw-wert">${esc(tx(ix('Wert')))}<small>Wert</small></span></div>`;
        }).join('') + '</div>';
      }
      if (html) { tab.insertAdjacentHTML('beforebegin', html); tab.hidden = true; }
    });
  }

  // ── Einhängen ────────────────────────────────────────────────────────────
  // Feld: Platz-Marke färbt der Wächter, ✓ an der Stärke, wenn die Position passt
  wrap('renderPitch', () => {
    if (!CFG.passtZeichen || !W.DFLPosition || !DFLPosition.aktiv()) return;
    const slots = (typeof FORMATIONS !== 'undefined' && FORMATIONS[CLUB.formation]) || [], els = document.querySelectorAll('#pitch .p-slot');
    slots.forEach((s, i) => {
      const el = els[i], p = spieler(CLUB.lineup[s.id]), ov = el && el.querySelector('.p-ovr');
      if (!p || !ov || ov.querySelector('.dfl-abz, .kpm-passt')) return;
      if (!DFLPosition.abzug(p, DFLPosition.platz(s))) ov.insertAdjacentHTML('beforeend', `<i class="ti ti-check kpm-passt" aria-label="Position passt"></i>`);
    });
    markenFaerben(document.getElementById('pitch'));
  });
  wrap('renderSquadList', () => markenFaerben(document.getElementById('squad-list')));
  wrap('renderSquadOverview', () => markenFaerben(document.getElementById('sub-squadlist')));
  wrap('renderLgSpielplan', () => { const el = document.getElementById('lg-sub-spielplan'), h = spielplanHtml(); if (el && h) el.innerHTML = h; });
  wrap('renderLgTorjaeger', () => { const el = document.getElementById('lg-sub-torjaeger'), h = torjaegerHtml(); if (el && h) el.innerHTML = h; });
  wrap('renderDepthChart', () => { const el = document.getElementById('sub-depth'); if (el) el.innerHTML = tiefenkaderHtml(); });
  wrap('renderSeasonBanner', bannerUmbauen);
  wrap('renderCalendarWidget', () => {
    const el = document.getElementById('calendar-widget'), liste = el && el.querySelector('.cal-schedule');
    if (liste) { liste.outerHTML = wochenleisteHtml(); el.classList.add('kw-an'); }
  });
  // Alle Details: nach allen Erweiterungen der Karte (Technik, Moral, Noten, Vertrag, Werte)
  wrap('renderPlayerCard', (r, p) => detailsUmbauen(p));
  if (W.TrainingSystem && typeof TrainingSystem.renderTrainingTab === 'function') {
    const _orig = TrainingSystem.renderTrainingTab;
    TrainingSystem.renderTrainingTab = function () {
      const r = _orig.apply(this, arguments);
      try { if (dfl()) { trainingUmbauen(); markenFaerben(document.getElementById('training-content')); } } catch (e) { console.warn('[DFL-Oberfläche] Training', e); }
      return r;
    };
  }
  // Moral · Form · Fitness (Aufstellung, Tiefenkader, Liste): global gebunden, intern über die globale Bindung gerufen
  {
    const _orig = W.playerDots;
    if (typeof _orig === 'function') {
      W.playerDots = function (p) { if (!dfl() || !p) return _orig.apply(this, arguments); try { return saeulen(p); } catch (e) { return _orig.apply(this, arguments); } };
      try { playerDots = W.playerDots; } catch (e) { /* window reicht */ }
    }
  }
  // Ansichtswechsel: Spieltag-Tafel
  {
    const _orig = W.switchAppView;
    if (typeof _orig === 'function') W.switchAppView = function (view) {
      const r = _orig.apply(this, arguments);
      if (view === 'match') { try { tafelBeobachten(); tafel(); } catch (e) { console.warn('[DFL-Oberfläche] Tafel', e); } }
      return r;
    };
  }
  // Bestenlisten und Spielbericht, Wertliste, Trade-Log, Verhandlung: Wächter über den ganzen Body
  let wache = null;
  function waechter() {
    if (!DOM || wache || !document.body) return;
    wache = new MutationObserver(recs => {
      if (!dfl()) return;
      for (const r of recs) {
        if (r.type === 'characterData') { if (RE_OVR_T.test(r.target.nodeValue || '')) ovrErsetzen(r.target); continue; }
        r.addedNodes.forEach(n => {
          if (n.nodeType === 3) { if (RE_OVR_T.test(n.nodeValue)) ovrErsetzen(n); return; }
          if (n.nodeType !== 1) return;
          try {
            markenFaerben(n); ovrErsetzen(n);
            if (n.id === 'nego-overlay' || (n.closest && n.closest('#nego-overlay'))) verhandlungUmbauen(document.getElementById('nego-overlay'));
            if (n.querySelector && (n.matches('.dfl-tr-log') || n.querySelector('.dfl-tr-log'))) tradeLogUmbauen(n);
            const wl = n.id === 'tr-sub-werte' ? n : n.closest && n.closest('#tr-sub-werte');
            if (wl || (n.querySelector && n.querySelector('#tr-sub-werte table.dfl-tabelle'))) wertlisteUmbauen(document.getElementById('tr-sub-werte'));
          } catch (e) { console.warn('[DFL-Oberfläche] Wächter', e); }
        });
      }
      wache.takeRecords();
    });
    wache.observe(document.body, { childList: true, subtree: true, characterData: true });
    if (dfl()) { markenFaerben(document.body); ovrErsetzen(document.body); }
  }
  if (DOM) { if (document.body) waechter(); else document.addEventListener('DOMContentLoaded', waechter); }

  // Spielstand ist beim Laden schon da (initGame läuft vor den Patches): sichtbare Ansichten einmal neu
  try {
    if (dfl() && DOM && typeof LEAGUE !== 'undefined' && LEAGUE) {
      if (typeof W.renderCalendarWidget === 'function') W.renderCalendarWidget();
      if (typeof SQUAD !== 'undefined' && SQUAD.length && typeof W.renderPitch === 'function') W.renderPitch();
      if (typeof W.renderSquadList === 'function') W.renderSquadList();
    }
  } catch (e) { console.warn('[DFL-Oberfläche] Laden', e); }

  W.DFLOberflaeche = { CFG, posMarke, posGruppe, anzeigePos, positionenVon, GRUPPEN, wappen, ortName, kuerzel, gesicht, ligaPlatz,
    kiTradeTeile, kiTradeHtml, markenFaerben, ovrText, saeulen, tafel, spielplanHtml, torjaegerHtml, tiefenkaderHtml, wochenleisteHtml };
  console.log('[DFL-Oberfläche v1] aktiv — alte Teile im Kenney-Stil (D85): eine Positionsmarke überall, Spieltag-Tafel, Spielplan, Torjäger, Tiefenkader, Training, Verhandlung, Details, Wochenleiste, Stärke statt OVR');
})();
