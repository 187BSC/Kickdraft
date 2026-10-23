/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · JOKER  ·  v1   (Nutzer 2026-10-15: Joker „Bau sofort, Wunderheilung, Spiel wiederholen, Scout-Express,
   Gnadenfrist – ja das passt“; „Transferspritze in Abhängigkeit der Liga (1× pro Saison)“)
   ─────────────────────────────────────────────────────────────────────────
   Freiwillige Belohnungsvideos (KSWerbung.video – zurzeit Platzhalter; Pro: ohne Video, gleiche Grenzen):
     · BAU SOFORT       laufender Ausbau des Vereinsgeländes ist fertig (Geld bleibt bezahlt)        je Ausbau
     · WUNDERHEILUNG    Verletzung ab 6 Wochen sofort geheilt, Fitness bleibt unten (Reha-Rückstand)   1 je Saison
     · SCOUT-EXPRESS    Vereins-Scouting (Vereinsblatt) sofort fertig                                 je Auftrag
     · GNADENFRIST      Vorstand verzichtet einmal auf die Entlassung (Zufriedenheit auf 30 %)        1 je Karriere
     · TRANSFERSPRITZE  Transferbudget + je Liga (Erste 6 Mio, Zweite 2 Mio, Dritte 600.000, RL 200.000)   1 je Saison
     · SPIEL WIEDERHOLEN letztes Pflichtspiel zurücknehmen und neu anpfeifen (Stand beim Anpfiff: Tabelle,
                        Pokal, Europa, Kader, Noten, Verletzungen, Geld, Karten)                   1 je Saison
                        Nur direkt nach dem Spiel, solange die Woche nicht weiter ist (Knopf im Spielbericht).
   Zustand CLUB.welt.joker (Weltzustand – Karrierestart leert ihn). Zugang: „Joker“ im Mehr-Blatt (Handy), Knopf im Verein-
   Reiter (PC), „Sofort“ im laufenden Scout-Auftrag, Angebot im Entlassungs-Fenster.
   Am Ort des Problems (2026-10-16, monetarisierung-anpassungen.md 2.4): Wunderheilung im Spielbericht (Ausfälle), am Ticker-Ende
   und im Spieler-Blatt; Wiederholen im Spielbericht nur nach einer Niederlage; Bau sofort an der Anlagen-Karte; Transferspritze
   in der Verhandlung, wenn die Sofortzahlung das Budget übersteigt („Es fehlen …“). Knöpfe tragen data-jk-ort (Messung).
   API: KSJoker.oeffnen() · .einsetzen(art, arg) · .verfuegbar() · .CFG
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const CFG = {
    wunderAb: 6, wunderFitness: 70,
    gnadeZufriedenheit: 30,
    // Transferspritze je Liga – Beträge zur Abstimmung (gegen die Liga-Ökonomie: rund 5–10 % eines Startbudgets)
    // Nutzer 2026-10-16: „Finanzspritze nochmal erhöhen, sodass es sich auch mehr lohnt“ → verdoppelt (vorher 3 Mio/1 Mio/300k/100k)
    spritze: { bundesliga: 6000000, bundesliga2: 2000000, liga3: 600000, regionalliga: 200000 },
    // Nutzer 2026-10-17: Wiederholen nur noch in Endspielen – das übernimmt die Zeitmaschine (kickstil_zeitmaschine.js)
    wiederholenAus: true
  };
  const hatSpiel = () => { try { return typeof CLUB !== 'undefined' && CLUB && typeof LEAGUE !== 'undefined' && LEAGUE; } catch (e) { return false; } };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const euro = v => typeof formatEuro === 'function' ? formatEuro(v) : Math.round(v).toLocaleString('de-DE') + ' €';
  const toast = (t, art) => { if (typeof window.showToast === 'function') window.showToast(t, art || 'info'); else alert(t); };
  const speichern = () => { try { if (typeof saveGameState === 'function') saveGameState(); } catch (e) { /* später */ } };
  function z() {
    if (!CLUB.welt) CLUB.welt = {};
    if (!CLUB.welt.joker) CLUB.welt.joker = { saison: {}, karriere: {} };
    return CLUB.welt.joker;
  }
  const genutzt = art => z().saison[art] === LEAGUE.season;
  function tierKey() {
    try { const g = allGroups(LEAGUE).find(x => x.group.teams.some(t => t.id === 'fcm')); return g ? g.tierKey : 'liga3'; } catch (e) { return 'liga3'; }
  }
  const ligaName = k => ({ bundesliga: 'Erste Liga', bundesliga2: 'Zweite Liga', liga3: 'Dritte Liga', regionalliga: 'Regionalliga' }[k] || k);
  const proText = () => (window.KSWerbung && KSWerbung.istPro() ? 'Pro: ohne Video' : 'kurzes Video');

  // ── Was gerade geht ────────────────────────────────────────────────────────
  function verfuegbar() {
    if (!hatSpiel()) return [];
    const out = [];
    const builds = CLUB.facilityBuilds || {};
    Object.keys(builds).forEach(k => {
      const b = builds[k]; if (!b) return;
      const name = (typeof FACILITY_DEFS !== 'undefined' && FACILITY_DEFS[k] && FACILITY_DEFS[k].name) || k;
      out.push({ art: 'bau', arg: k, icon: 'ti-building-skyscraper', titel: 'Bau sofort: ' + name, text: `Stufe ${b.targetLevel} ist sofort fertig statt in ${b.weeksLeft} Woche(n).` });
    });
    const verletzt = (typeof SQUAD !== 'undefined' ? SQUAD : []).filter(p => (p.injuryWeeks || 0) >= CFG.wunderAb);
    if (verletzt.length) {
      const frei = !genutzt('wunder');
      verletzt.forEach(p => out.push({ art: 'wunder', arg: p.id, icon: 'ti-first-aid-kit', aus: !frei,
        titel: 'Wunderheilung: ' + ((p.firstName ? p.firstName.charAt(0) + '. ' : '') + p.name), text: frei ? `${p.injuryWeeks} Wochen Ausfall – sofort wieder dabei, Fitness ${CFG.wunderFitness} (Reha).` : 'Diese Saison schon genutzt.' }));
    }
    const auftraege = window.KSVereinsblatt && KSVereinsblatt.auftraege ? KSVereinsblatt.auftraege() : {};
    Object.keys(auftraege).forEach(d => {
      const a = auftraege[d], nm = window.KSVereinsnamen ? KSVereinsnamen.text(a.name || d) : (a.name || d);
      out.push({ art: 'scout', arg: d, icon: 'ti-telescope', titel: 'Scout-Express: ' + nm, text: 'Der Bericht über Kader und Akademie ist sofort da.' });
    });
    const tk = tierKey(), betrag = CFG.spritze[tk] || CFG.spritze.liga3;
    out.push({ art: 'spritze', icon: 'ti-coin-euro', aus: genutzt('spritze'), titel: 'Transferspritze: +' + euro(betrag),
      text: genutzt('spritze') ? 'Diese Saison schon genutzt – wieder ab der nächsten Saison.' : `Einmal je Saison, Betrag nach Liga (${ligaName(tk)}).` });
    out.push({ art: 'gnade', icon: 'ti-shield-heart', aus: true, titel: 'Gnadenfrist',
      text: z().karriere.gnade ? 'In dieser Karriere schon genutzt.' : 'Wird angeboten, wenn der Vorstand dich entlassen will (einmal je Karriere).' });
    const wg = genutzt('wiederholen'), wo = wiederOffen();
    if (!CFG.wiederholenAus) out.push({ art: 'wiederholen', icon: 'ti-repeat', aus: wg || !wo, titel: 'Spiel wiederholen' + (wo ? `: ${STAND.stand} gegen ${STAND.gegner}` : ''),
      text: wg ? 'Diese Saison schon genutzt – wieder ab der nächsten Saison.'
        : wo ? 'Das letzte Pflichtspiel zurücknehmen und neu anpfeifen (einmal je Saison).'
        : 'Direkt nach einem Pflichtspiel, bevor die Woche weitergeht (einmal je Saison).' });
    return out;
  }

  // ── Spiel wiederholen: Stand beim Anpfiff merken (nur im Speicher), nach der Buchung einmal je Saison zurück ──
  let STAND = null;
  const fxKey = fx => fx ? [LEAGUE.season, LEAGUE.week, fx.type, fx.opponentId, fx.matchday || '', fx.roundName || ''].join('|') : null;
  // 2026-10-16: an den Spielstand gebunden – sonst bot ein anderer Spielstand in derselben Saison/Woche „Wiederholen“ an und
  // bekam den Anpfiff-Stand des ersten eingespielt
  const slot = () => { try { return typeof ACTIVE_SLOT_ID !== 'undefined' ? ACTIVE_SLOT_ID : null; } catch (e) { return null; } };
  function wiederOffen() {
    return !!(STAND && STAND.gebucht && hatSpiel() && STAND.slot === slot() && STAND.saison === LEAGUE.season && STAND.woche === LEAGUE.week && !genutzt('wiederholen'));
  }
  ['applyLoadedState', 'startNewGameState', 'resetGameStorage'].forEach(fn => {
    if (typeof window[fn] !== 'function') return;
    const _o = window[fn];
    window[fn] = function () { STAND = null; return _o.apply(this, arguments); };
    try { if (fn === 'applyLoadedState') applyLoadedState = window[fn]; else if (fn === 'startNewGameState') startNewGameState = window[fn]; else resetGameStorage = window[fn]; } catch (e) { /* window reicht */ }
  });
  function anpfiffMerken() {
    try {
      if (!hatSpiel() || genutzt('wiederholen') || CFG.wiederholenAus) return;
      const fx = CURRENT_FIXTURE; if (!fx || fx.type === 'friendly') return;
      const k = fxKey(fx);
      if (STAND && STAND.key === k && !STAND.gebucht && Date.now() - STAND.t < 3000) return;   // derselbe Anpfiff (äußere + innere Hülle)
      STAND = { key: k, t: Date.now(), slot: slot(), saison: LEAGUE.season, woche: LEAGUE.week, gebucht: false,
        league: JSON.stringify(LEAGUE), cup: JSON.stringify(CUP), club: JSON.stringify({ club: CLUB, achievements: FCM_ACHIEVEMENTS, squad: SQUAD }),
        market: JSON.stringify(MARKET), karten: localStorage.getItem('fl-karten') };
    } catch (e) { console.warn('[Kickstil-Joker] Anpfiff merken', e); STAND = null; }
  }
  if (typeof window.handleKO === 'function') {
    const _ko = window.handleKO;
    window.handleKO = function () {
      try { if (typeof G !== 'undefined' && !G.running && !G.halfDone && !G.ended && G.min === 0) anpfiffMerken(); } catch (e) { /* ohne Joker */ }
      return _ko.apply(this, arguments);
    };
    try { handleKO = window.handleKO; } catch (e) { /* window reicht */ }
  }
  if (typeof window.simulateCurrentFixture === 'function') {
    const _sim = window.simulateCurrentFixture;
    window.simulateCurrentFixture = function () { anpfiffMerken(); return _sim.apply(this, arguments); };
    try { simulateCurrentFixture = window.simulateCurrentFixture; } catch (e) { /* window reicht */ }
  }
  if (typeof window.processFixtureResult === 'function') {
    const _pfr = window.processFixtureResult;
    window.processFixtureResult = function () {
      let k = null; try { k = fxKey(CURRENT_FIXTURE); } catch (e) { /* ohne */ }
      const r = _pfr.apply(this, arguments);
      try {
        if (STAND && k && STAND.key === k) { STAND.gebucht = true; STAND.stand = G.homeGoals + ':' + G.awayGoals; STAND.gegner = TEAMS.away.name; STAND.niederlage = G.homeGoals < G.awayGoals; }
      } catch (e) { /* ohne Joker */ }
      return r;
    };
    try { processFixtureResult = window.processFixtureResult; } catch (e) { /* window reicht */ }
  }
  ['advanceCalendarWeek', 'startNewSeason'].forEach(fn => {
    if (typeof window[fn] !== 'function') return;
    const _o = window[fn];
    window[fn] = function () { STAND = null; return _o.apply(this, arguments); };
    try { if (fn === 'advanceCalendarWeek') advanceCalendarWeek = window[fn]; else startNewSeason = window[fn]; } catch (e) { /* window reicht */ }
  });

  // ── Wirkung ────────────────────────────────────────────────────────────────
  const WIRKUNG = {
    bau(key) {
      const builds = CLUB.facilityBuilds || {}, b = builds[key];
      if (!b || typeof tickFacilityBuilds !== 'function') return false;
      // Nur diesen Bau voranbringen: die anderen kurz beiseitelegen (tickFacilityBuilds zählt alle eine Woche runter)
      const andere = {};
      Object.keys(builds).forEach(k => { if (k !== key) { andere[k] = builds[k]; delete builds[k]; } });
      b.weeksLeft = 1;
      try { tickFacilityBuilds(); } finally { CLUB.facilityBuilds = Object.assign(CLUB.facilityBuilds || {}, andere); }
      return true;
    },
    wunder(id) {
      if (genutzt('wunder')) return false;
      const p = (typeof SQUAD !== 'undefined' ? SQUAD : []).find(x => x.id === id);
      if (!p || (p.injuryWeeks || 0) < CFG.wunderAb) return false;
      p.injuryWeeks = 0; p.injuryType = null;
      if (typeof p.fitness === 'number') p.fitness = Math.min(p.fitness, CFG.wunderFitness); else p.fitness = CFG.wunderFitness;
      z().saison.wunder = LEAGUE.season;
      if (typeof addNews === 'function') addNews('squad', '✨ Wunderheilung', `${(p.firstName || '') + ' ' + p.name} ist früher als erwartet zurück – die Reha geht im Training weiter.`);
      return true;
    },
    scout(dataId) { return !!(window.KSVereinsblatt && KSVereinsblatt.sofort && KSVereinsblatt.sofort(dataId)); },
    spritze() {
      if (genutzt('spritze')) return false;
      const betrag = CFG.spritze[tierKey()] || CFG.spritze.liga3;
      CLUB.budget = (CLUB.budget || 0) + betrag;
      z().saison.spritze = LEAGUE.season;
      if (typeof addNews === 'function') addNews('club', '💶 Transferspritze', `Ein Partner stellt ${euro(betrag)} zusätzlich fürs Transferbudget bereit.`);
      return true;
    },
    wiederholen() {
      if (!wiederOffen()) return false;
      const S = STAND; STAND = null;
      const club = JSON.parse(S.club);
      Object.keys(CLUB).forEach(k => { if (!(k in club.club)) delete CLUB[k]; });   // nach dem Anpfiff Hinzugekommenes weg
      applyLoadedState(JSON.parse(S.league), JSON.parse(S.cup), club, JSON.parse(S.market));
      try { if (S.karten == null) localStorage.removeItem('fl-karten'); else localStorage.setItem('fl-karten', S.karten); } catch (e) { /* Sammlung bleibt */ }
      z().saison.wiederholen = LEAGUE.season;
      try { CURRENT_FIXTURE = null; } catch (e) { /* neu geladen */ }
      try { if (window.DFLTextspiel && DFLTextspiel.ui) DFLTextspiel.ui.schliessen(); } catch (e) { /* ohne Ticker */ }
      const pm = document.getElementById('pm-overlay'); if (pm) pm.remove();
      if (EL) EL.classList.remove('auf');
      if (typeof addNews === 'function') addNews('match', '🔁 Spiel wiederholt', `Das ${S.stand} gegen ${S.gegner} ist zurückgenommen – das Spiel wird neu angepfiffen.`);
      try { if (typeof switchAppView === 'function') switchAppView('match', document.getElementById('nav-match')); } catch (e) { /* Ansicht optional */ }
      try { if (typeof ensureFixtureLoaded === 'function') ensureFixtureLoaded(); } catch (e) { console.warn('[Kickstil-Joker] Spiel laden', e); }
      return true;
    },
    gnade() {
      if (z().karriere.gnade || !CLUB.expectations) return false;
      CLUB.expectations.boardSatisfaction = Math.max(CLUB.expectations.boardSatisfaction || 0, CFG.gnadeZufriedenheit);
      z().karriere.gnade = LEAGUE.season;
      if (typeof addNews === 'function') addNews('club', '🤝 Letzte Chance', `Der Vorstand gibt dir eine letzte Chance. Die Zufriedenheit steht wieder bei ${CFG.gnadeZufriedenheit} % – das gibt es nur einmal.`);
      return true;
    }
  };
  function einsetzen(art, arg, danach) {
    if (!hatSpiel() || !WIRKUNG[art]) return;
    const titel = { bau: 'Bau sofort', wunder: 'Wunderheilung', scout: 'Scout-Express', spritze: 'Transferspritze', gnade: 'Gnadenfrist', wiederholen: 'Spiel wiederholen' }[art];
    const los = () => {
      const ok = WIRKUNG[art](arg);
      if (ok) { toast(titel + ' eingesetzt', 'success'); speichern(); }
      try { if (typeof renderAll === 'function') renderAll(); } catch (e) { /* Ansicht optional */ }
      try { if (typeof renderClubTab === 'function') renderClubTab(); } catch (e) { /* Ansicht optional */ }
      if (typeof danach === 'function') danach(ok);
      if (EL && EL.classList.contains('auf')) zeichnen();
    };
    if (window.KSWerbung) KSWerbung.video(titel, ok => { if (ok) los(); else if (typeof danach === 'function') danach(false); });
    else los();
  }

  // ── Blatt ──────────────────────────────────────────────────────────────────
  let EL = null;
  function zeichnen() {
    const liste = verfuegbar();
    EL.querySelector('.ksj-box').innerHTML = `<div class="ksj-griff"></div>
      <div class="ksj-kopf"><b>Joker</b><button type="button" class="ksj-zu" aria-label="Schließen"><i class="ti ti-x" aria-hidden="true"></i></button></div>
      <p class="ksj-info">Freiwillig: ein ${esc(proText())} – dafür ein kleiner Vorteil. Nie Stärke gegen Geld.</p>
      ${liste.map(j => `<div class="ksj-zeile${j.aus ? ' aus' : ''}"><i class="ti ${j.icon}" aria-hidden="true"></i>
        <span><b>${esc(j.titel)}</b><small>${esc(j.text)}</small></span>
        ${j.aus ? '' : `<button type="button" class="ksj-knopf" data-joker="${esc(j.art)}" data-arg="${esc(j.arg || '')}"><i class="ti ti-player-play" aria-hidden="true"></i></button>`}</div>`).join('')}`;
  }
  function oeffnen() {
    if (!hatSpiel()) return;
    if (!EL) {
      EL = document.createElement('div'); EL.id = 'ks-joker';
      EL.innerHTML = '<div class="ksj-bg"></div><div class="ksj-box" role="dialog" aria-modal="true" aria-label="Joker"></div>';
      EL.addEventListener('click', ev => {
        if (ev.target.closest('.ksj-bg') || ev.target.closest('.ksj-zu')) { EL.classList.remove('auf'); return; }
        const k = ev.target.closest('[data-joker]'); if (k) einsetzen(k.getAttribute('data-joker'), k.getAttribute('data-arg') || null);
      });
      document.body.appendChild(EL);
    }
    zeichnen();
    requestAnimationFrame(() => EL.classList.add('auf'));
  }

  // ── Zugänge ────────────────────────────────────────────────────────────────
  const ICON = '<i class="ti ti-cards" aria-hidden="true"></i>';
  function einbauen() {
    const box = document.querySelector('#app-sheet .app-sheet-box');
    if (box && !box.querySelector('[data-ks-joker]')) {
      const b = document.createElement('button');
      b.className = 'app-eintrag'; b.setAttribute('data-ks-joker', '1');
      b.innerHTML = ICON + '<span class="app-eintrag-txt"><b>Joker</b><small>Bau sofort, Wunderheilung, Transferspritze …</small></span><i class="ti ti-chevron-right app-pfeil" aria-hidden="true"></i>';
      const vor = box.querySelector('[data-gesamt]');
      box.insertBefore(b, vor || null);
    }
    const club = document.getElementById('view-club');
    if (club && !club.querySelector('[data-ks-joker]')) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'ksj-pc'; b.setAttribute('data-ks-joker', '1');
      b.innerHTML = ICON + ' Joker';
      club.insertBefore(b, club.firstChild);
    }
  }
  // „Wiederholen“ neben dem Weiter-Knopf nach dem Spiel (Spielbericht, Ticker-Ende, Bericht nach Neustart)
  function wiederKnopf() {
    const ziele = [];
    const pmw = document.getElementById('pm-continue-btn'); if (pmw && pmw.parentNode) ziele.push(pmw.parentNode);
    document.querySelectorAll('[data-ts="bericht"],[data-ts="weiter"]').forEach(b => b.parentNode && ziele.push(b.parentNode));
    // Am Ort des Problems (monetarisierung-anpassungen.md 2.4): im Spielbericht nur nach einer Niederlage – nach Sieg oder Remis
    // bleibt der Joker im Blatt „Joker“
    const offen = wiederOffen() && !!(STAND && STAND.niederlage);
    ziele.forEach(z => {
      const da = z.querySelector('[data-ks-wieder]');
      if (!offen) { if (da) da.remove(); return; }
      if (da) return;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'ksj-wieder'; b.setAttribute('data-ks-wieder', '1'); b.setAttribute('data-jk-ort', 'wiederholen@spielbericht');
      b.innerHTML = '<i class="ti ti-repeat" aria-hidden="true"></i><span>' + (window.KSWerbung && KSWerbung.istPro() ? 'Joker' : 'Video ansehen') + ': neu anpfeifen<small>1× je Saison</small></span>';
      z.insertBefore(b, z.firstChild);
    });
  }
  // ── Joker am Ort des Problems (monetarisierung-anpassungen.md 2.4, 2026-10-16) ─────────────────────────────────
  // Neutrale Knopftexte („Video ansehen: …“, BGH „Runes of Magic“), keine Kaufaufforderung. data-jk-ort = art@ort für die
  // Messung (kickstil_messung.js: gesehen/gedrückt).
  const nameVon = p => (typeof displayName === 'function' ? displayName(p) : ((p.firstName ? p.firstName + ' ' : '') + p.name));
  const vorsatz = () => (window.KSWerbung && KSWerbung.istPro() ? 'Joker' : 'Video ansehen');
  function ortKnopf(art, arg, text, ort, klein) {
    return `<button type="button" class="ksj-ort${klein ? ' klein' : ''}" data-jk-ort="${art}@${ort}" data-jk-art="${art}" data-jk-arg="${esc(arg || '')}">` +
      `<i class="ti ti-player-play" aria-hidden="true"></i><span>${esc(vorsatz())}: ${esc(text)}</span></button>`;
  }
  const wunderFrei = p => hatSpiel() && p && (p.injuryWeeks || 0) >= CFG.wunderAb && !genutzt('wunder') && SQUAD.some(q => q.id === p.id);
  function setze(el, html, schluessel) {
    // ein Knopf je Stelle; verschwindet, wenn der Joker nicht mehr passt
    const da = el.querySelector(':scope > .ksj-ort-platz');
    if (!html) { if (da) da.remove(); return; }
    if (da && da.getAttribute('data-k') === schluessel) return;
    if (da) da.remove();
    const d = document.createElement('div'); d.className = 'ksj-ort-platz'; d.setAttribute('data-k', schluessel); d.innerHTML = html;
    el.appendChild(d);
  }
  function ortKnoepfe() {
    if (!hatSpiel() || typeof SQUAD === 'undefined') return;
    // Wunderheilung: Spielbericht (Ausfälle), Ticker-Ende, Spieler-Blatt
    document.querySelectorAll('#pm-overlay .pm-alert-row.injured').forEach(row => {
      const nm = ((row.querySelector('.pm-alert-name') || {}).textContent || '').trim();
      const p = SQUAD.find(q => nameVon(q) === nm || q.name === nm);
      setze(row, wunderFrei(p) ? ortKnopf('wunder', p.id, 'sofort fit', 'spielbericht', true) : '', 'w' + (p ? p.id : ''));
    });
    document.querySelectorAll('.ts-verletzt').forEach(el => {
      const t = el.textContent || '', liste = SQUAD.filter(q => wunderFrei(q) && t.indexOf(q.name) >= 0);
      const ziel = el.parentNode; if (!ziel) return;
      setze(ziel, liste.map(q => ortKnopf('wunder', q.id, nameVon(q) + ' sofort fit', 'ticker', true)).join(''), 'w' + liste.map(q => q.id).join());
    });
    const blatt = document.querySelector('#app-blatt .app-blatt-box[data-spieler]');
    if (blatt) {
      const p = SQUAD.find(q => q.id === blatt.dataset.spieler);
      const meta = blatt.querySelector('.app-blatt-meta'), ziel = (meta && meta.parentNode) || blatt;   // oben im Kopf, nicht unter der Karte
      setze(ziel, wunderFrei(p) ? ortKnopf('wunder', p.id, `sofort fit statt ${p.injuryWeeks} Wochen Pause`, 'spielerblatt') : '', 'w' + (p ? p.id : ''));
    }
    // Bau sofort: laufender Ausbau auf der Anlagen-Karte
    const builds = CLUB.facilityBuilds || {};
    document.querySelectorAll('.facility-card .fc-building').forEach(el => {
      const card = el.closest('.facility-card'), nm = ((card && card.querySelector('.fc-name')) || {}).textContent || '';
      const k = Object.keys(builds).find(x => builds[x] && typeof FACILITY_DEFS !== 'undefined' && FACILITY_DEFS[x] && FACILITY_DEFS[x].name === nm.trim());
      setze(el, k ? ortKnopf('bau', k, `Stufe ${builds[k].targetLevel} sofort fertig`, 'anlage', true) : '', 'b' + (k || ''));
    });
    // Transferspritze: Verhandlung, wenn das Geld für die Sofortzahlung fehlt
    const spritzeFrei = !genutzt('spritze'), betrag = CFG.spritze[tierKey()] || CFG.spritze.liga3;
    const nego = document.querySelector('#clubnego-overlay .nego-card'), s = window._clubNego;
    if (nego && s && !s.done) {
      const sofort = s.pay > 0 ? Math.round(s.fee / s.pay) : s.fee, fehlt = sofort - (CLUB.budget || 0);
      const ziel = nego.querySelector('.nego-ctrls') || nego;
      setze(ziel, spritzeFrei && fehlt > 0 ? `<div class="ksj-fehlt"><i class="ti ti-alert-triangle" aria-hidden="true"></i>Es fehlen ${esc(euro(fehlt))} für die Sofortzahlung.</div>` +
        ortKnopf('spritze', '', `+${euro(betrag)} Transferbudget`, 'verhandlung') : '', 's' + (fehlt > 0) + spritzeFrei);
    }
    document.querySelectorAll('.nego-msg').forEach(m => {
      if (m.closest('#clubnego-overlay')) return;
      const knapp = /Budget reicht nicht/.test(m.textContent || '');
      setze(m, spritzeFrei && knapp ? ortKnopf('spritze', '', `+${euro(betrag)} Transferbudget`, 'vertrag', true) : '', 's' + knapp);
    });
  }
  document.addEventListener('click', ev => {
    const o = ev.target.closest && ev.target.closest('[data-jk-art]');
    if (!o) return;
    ev.preventDefault(); ev.stopPropagation();
    const art = o.getAttribute('data-jk-art'), arg = o.getAttribute('data-jk-arg') || null;
    einsetzen(art, arg, ok => {
      if (!ok) return;
      const platz = o.closest('.ksj-ort-platz'); if (platz) platz.remove();
      try { if (art === 'spritze' && window._clubNego && typeof window.clubNegoAdjust === 'function') window.clubNegoAdjust(0); } catch (e) { /* Ansicht optional */ }
      try { if (art === 'wunder' && window.DFLAppShell && DFLAppShell.spielerBlatt) { const p = SQUAD.find(q => q.id === arg); if (p && document.querySelector('#app-blatt .app-blatt-box[data-spieler="' + arg + '"]')) DFLAppShell.spielerBlatt(p); } } catch (e) { /* Ansicht optional */ }
    });
  }, true);

  document.addEventListener('click', ev => {
    const w = ev.target.closest && ev.target.closest('[data-ks-wieder]');
    if (w) { ev.preventDefault(); ev.stopPropagation(); einsetzen('wiederholen'); return; }
    const j = ev.target.closest && ev.target.closest('[data-ks-joker]');
    if (j) { ev.preventDefault(); ev.stopPropagation(); const s = document.getElementById('app-sheet'); if (s) s.classList.remove('auf'); oeffnen(); return; }
    const sc = ev.target.closest && ev.target.closest('[data-joker-scout]');
    if (sc) { ev.preventDefault(); ev.stopPropagation(); einsetzen('scout', sc.getAttribute('data-joker-scout')); }
  }, true);
  // Orte-Knöpfe gebündelt (der Ticker ändert das DOM ständig)
  let ortT = 0;
  const ortSpaeter = () => { if (ortT) return; ortT = setTimeout(() => { ortT = 0; try { ortKnoepfe(); } catch (e) { /* später */ } }, 250); };
  const los = () => { einbauen(); new MutationObserver(() => { einbauen(); wiederKnopf(); ortSpaeter(); }).observe(document.body, { childList: true, subtree: true }); };
  if (document.body) los(); else document.addEventListener('DOMContentLoaded', los);

  // ── Gnadenfrist im Entlassungs-Fenster ─────────────────────────────────────
  if (typeof window.onExpectationsGameOver === 'function') {
    const _go = window.onExpectationsGameOver;
    window.onExpectationsGameOver = function (e) {
      const r = _go.apply(this, arguments);
      try {
        if (hatSpiel() && !z().karriere.gnade) {
          const box = document.querySelector('.exp-gameover .exp-gameover-box');
          if (box && !box.querySelector('.ksj-gnade')) {
            const b = document.createElement('button');
            b.type = 'button'; b.className = 'exp-gameover-btn ksj-gnade'; b.setAttribute('data-jk-ort', 'gnade@entlassung');
            b.innerHTML = '<i class="ti ti-player-play" aria-hidden="true"></i> Gnadenfrist (' + esc(proText()) + ', einmal je Karriere)';
            b.addEventListener('click', () => einsetzen('gnade', null, ok => { if (ok) { const ov = document.querySelector('.exp-gameover'); if (ov) ov.remove(); } }));
            box.insertBefore(b, box.querySelector('.exp-gameover-btn'));
          }
        }
      } catch (er) { /* ohne Angebot */ }
      return r;
    };
    try { onExpectationsGameOver = window.onExpectationsGameOver; } catch (e) { /* window reicht */ }
  }

  const css = document.createElement('style');
  css.textContent = `#ks-joker{position:fixed;inset:0;z-index:9700;pointer-events:none}#ks-joker.auf{pointer-events:auto}
  .ksj-bg{position:absolute;inset:0;background:rgb(6 6 5/.62);opacity:0;transition:opacity .18s}#ks-joker.auf .ksj-bg{opacity:1}
  .ksj-box{position:absolute;left:0;right:0;bottom:0;margin:0 auto;max-width:560px;max-height:85vh;overflow-y:auto;background:var(--bg2,#fffaf0);
    color:var(--text,#2b2a26);border-radius:22px 22px 0 0;border:3px solid var(--k-rahmen,#8b5a2b);border-bottom:0;
    padding:4px 14px calc(18px + env(safe-area-inset-bottom,0px));transform:translateY(100%);transition:transform .24s cubic-bezier(.2,.8,.3,1);font-family:var(--font-text,system-ui)}
  #ks-joker.auf .ksj-box{transform:none}html.dark .ksj-box{background:var(--bg2,#1e2230)}
  .ksj-griff{width:40px;height:4px;border-radius:3px;background:var(--bg4,#c9b48f);margin:6px auto 8px}
  .ksj-kopf{display:flex;align-items:center;justify-content:space-between}.ksj-kopf b{font:700 21px/1.1 var(--font-titel,Fredoka,system-ui)}
  .ksj-zu{border:0;background:var(--bg3,#efe2c8);color:inherit;width:38px;height:38px;border-radius:12px;font-size:20px;cursor:pointer}
  .ksj-info{color:var(--text3,#846d52);font-size:13px;margin:6px 2px 10px}
  .ksj-zeile{display:flex;align-items:center;gap:12px;padding:10px;border-radius:14px;border:2px solid var(--k-rand,#d9c29a);margin-bottom:8px}
  .ksj-zeile>i{font-size:24px;color:var(--k-blau,#2c7cb5)}.ksj-zeile>span{flex:1;min-width:0;display:flex;flex-direction:column}
  .ksj-zeile small{color:var(--text3,#846d52);font-size:12px;margin-top:2px}.ksj-zeile.aus{opacity:.55}
  .ksj-knopf{border:0;border-radius:12px;width:46px;height:42px;font-size:20px;cursor:pointer;color:#fff;background:var(--k-gruen,#25c065);box-shadow:0 4px 0 var(--k-gruen-tief,#188a46)}
  .ksj-knopf:active{transform:translateY(3px);box-shadow:0 1px 0 var(--k-gruen-tief,#188a46)}
  .ksj-pc{margin:0 0 10px;border:2px solid var(--k-rand,#d9c29a);background:var(--bg2,#fffaf0);color:inherit;border-radius:12px;padding:8px 14px;font:700 14px/1 var(--font-titel,system-ui);cursor:pointer}
  body.dfl-shell .ksj-pc{display:none}
  :has(>.ksj-wieder){flex-wrap:wrap}
  .ksj-ort-platz{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;width:100%}
  .ksj-ort{display:inline-flex;align-items:center;gap:6px;border:0;border-radius:12px;padding:9px 12px;cursor:pointer;font:700 13px/1.15 var(--font-titel,system-ui);
    color:#2a1c02;background:#f0c05a;box-shadow:0 3px 0 #b8862a;text-align:left}
  .ksj-ort.klein{padding:6px 10px;font-size:12px}.ksj-ort i{font-size:15px}
  .ksj-fehlt{width:100%;font:600 12px/1.3 var(--font-text,system-ui);color:var(--red,#c0392b);display:flex;gap:6px;align-items:center}
  .ksj-wieder{display:flex;flex:1 0 100%;width:100%;justify-content:center;align-items:center;gap:10px;border:0;border-radius:12px;padding:8px 12px;margin:0 0 8px;cursor:pointer;
    font:700 14px/1.1 var(--font-titel,system-ui);color:#3a2600;background:#f2c14e;box-shadow:0 3px 0 #b8892a}
  .ksj-wieder i{font-size:20px}.ksj-wieder span{display:flex;flex-direction:column;text-align:left}.ksj-wieder small{font:600 11px/1.2 var(--font-text,system-ui);opacity:.8}
  .ksj-wieder:active{transform:translateY(2px);box-shadow:0 1px 0 #b8892a}
  .exp-gameover .exp-gameover-btn.ksj-gnade{background:var(--k-gruen,#25c065);color:#fff;margin-bottom:10px}`;
  document.head.appendChild(css);

  window.KSJoker = { CFG, oeffnen, einsetzen, verfuegbar, wiederOffen };
  console.log('[Kickstil-Joker v2] aktiv — Bau sofort, Wunderheilung, Scout-Express, Gnadenfrist, Transferspritze, Spiel wiederholen (Video-Platzhalter)');
})();
