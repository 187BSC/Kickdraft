/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · ZEITMASCHINE  ·  v1   (Nutzer 2026-10-17: „Spiel wiederholen nur bei einem Playoff-Spiel oder einem Finale …
   dann einen Button dafür und so etwas wie einen kleinen Zeitsprung, humoristisch verpackt“ – „einmal pro Playoffs“,
   „ein Video kosten, bei Pro … 10 Winpunkte“, beim Ausscheiden „vorher aufploppen wie eine Anzeige“)
   ─────────────────────────────────────────────────────────────────────────
   Eine Datei für beide Spiele (Quelle: kickdraft/spiel/js, nach Änderung nach flutlicht_manager/js kopieren):
     · Kickdraft: jedes eigene Playoff-Spiel, einmal je Playoffs (Saison)
     · Flutlicht: Endspiele (Flutlichtpokal, Champions Cup, Europacup, Kontinentalcup), einmal je Finale
   Beim Anpfiff (handleKO/simulateCurrentFixture, äußerste Hülle) merkt sich das Modul den Spielstand im Speicher:
   LEAGUE (Kickdraft: mit frisch gepackter Welt), CUP, CLUB + SQUAD + Erfolge, MARKET (Flutlicht: auch die Kartensammlung).
   Nach der Buchung: Knopf „Zeitmaschine“ im Spielbericht; ist das Spiel das Aus (Kickdraft: ausgeschieden oder Finale verloren,
   Flutlicht: Finale verloren), kommt das Angebot vorher als Vollbild-Karte wie eine Anzeige. Kosten: ein Video (KSWerbung,
   Android-Brücke, sonst Platzhalter), mit Pro statt Video 10 Winpunkte (gemeinsames Konto 'dfl-winpunkte'). Danach
   Zeitsprung (Uhr läuft rückwärts, Ergebnis springt auf 0:0, ein Spruch), Spielstand zurück, Spiel neu geladen.
   Der Stand verfällt mit dem Wochenwechsel und beim Laden/Neustart. Kein Emoji im Spiel (D104).
   API: KSZeitmaschine.offen() · .angebot() · .einsetzen() · .CFG · .SPRUECHE
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const W = window;
  const CFG = { winpunkte: 10, sprungMs: 3400, platzhalterSekunden: 5 };
  const SPRUECHE = [
    'Der Zeugwart hat an der Stadionuhr gedreht. Niemand hat etwas gesehen.',
    'Euer Physio hat das Spiel einfach zurückmassiert.',
    'Der Platzwart hat den Rasen gegen den Strich gemäht – und die Zeit gleich mit.',
    'Kurze Ansage aus der Kabine: Das zählen wir nicht.',
    'Der Schiedsrichter wacht schweißgebadet auf. Alles nur geträumt.',
    'Die Fans haben so laut gesungen, dass die Zeit rückwärts läuft.',
    'Der Co-Trainer hat im Keller einen alten Videorekorder gefunden. Zurückspulen …',
    'Der Stadionsprecher liest die Aufstellung einfach noch einmal vor.',
    'Das Maskottchen hat den Stecker der Anzeigetafel gezogen. Neustart.',
    'Der Präsident hat bei der Liga angerufen. Lieber nicht fragen, wie.',
    'Der Busfahrer hat gewendet. Ihr seid wieder auf dem Weg ins Stadion.',
    'Die Zeugwartin hat die Trikots noch einmal gebügelt – mit Zeitreise-Stufe.'
  ];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hatSpiel = () => { try { return typeof CLUB !== 'undefined' && CLUB && typeof LEAGUE !== 'undefined' && LEAGUE; } catch (e) { return false; } };
  const kickdraft = () => { try { return !!(W.DFLPlayoffs && CLUB.dfl && CLUB.dfl.aktiv && LEAGUE.dfl); } catch (e) { return false; } };
  const slot = () => { try { return typeof ACTIVE_SLOT_ID !== 'undefined' ? ACTIVE_SLOT_ID : null; } catch (e) { return null; } };
  const testlauf = () => { try { return navigator.webdriver && localStorage.getItem('zm-test') !== 'an'; } catch (e) { return false; } };
  const simLaeuft = () => { try { return !!((W.DFLSimulieren && DFLSimulieren.laeuft && DFLSimulieren.laeuft()) || (W.KSSimulieren && KSSimulieren.laeuft && KSSimulieren.laeuft())); } catch (e) { return false; } };

  // ── Welche Spiele? ─────────────────────────────────────────────────────────
  // { key (einmal je …), label, merkKey (dieses Spiel) } oder null
  function grossesSpiel(fx) {
    if (!fx || !hatSpiel()) return null;
    if (kickdraft()) {
      if (fx.type !== 'playoff') return null;
      return { key: 'po' + LEAGUE.season, label: 'Playoffs · ' + (fx.roundName || ''), einmal: 'in diesen Playoffs' };
    }
    const rn = String(fx.roundName || fx.round || '').toLowerCase();
    if ((fx.type === 'pokal' || (fx.type === 'euro' && fx.euroKind === 'ko')) && /^finale$/.test(rn)) {
      const wb = fx.type === 'pokal' ? 'Flutlichtpokal' : ({ cl: 'Champions Cup', el: 'Europacup', co: 'Kontinentalcup', ecl: 'Kontinentalcup' })[String(fx.comp || '').toLowerCase()] || 'Europapokal';
      return { key: ['fin', LEAGUE.season, fx.type, fx.comp || ''].join('|'), label: 'Finale · ' + wb, einmal: 'in diesem Finale' };
    }
    return null;
  }
  function zustand() { if (!CLUB.ksZeit) CLUB.ksZeit = {}; return CLUB.ksZeit; }
  const genutzt = key => !!zustand()[key];

  // ── Stand beim Anpfiff (nur im Speicher) ───────────────────────────────────
  let STAND = null;
  const fxKey = fx => [LEAGUE.season, LEAGUE.week, fx.type, fx.opponentId, fx.runde || '', fx.bein || '', fx.roundName || '', fx.comp || ''].join('|');
  function merken() {
    try {
      if (!hatSpiel() || typeof CURRENT_FIXTURE === 'undefined' || !CURRENT_FIXTURE) return;
      const fx = CURRENT_FIXTURE, gs = grossesSpiel(fx);
      if (!gs || genutzt(gs.key)) return;
      const k = fxKey(fx);
      if (STAND && STAND.fk === k && !STAND.gebucht && Date.now() - STAND.t < 3000) return;       // äußere + innere Hülle
      let league = LEAGUE;
      // Kickdraft: die Welt lebt im Speicher (DFLSpiel.liga) – frisch gepackt in die Kopie
      if (kickdraft() && W.DFLSpiel && DFLSpiel.packeWelt) {
        try { league = Object.assign({}, LEAGUE, { dflWelt: DFLSpiel.packeWelt(DFLSpiel.liga(), !!LEAGUE.dflVereinswechsel) }); } catch (e) { league = LEAGUE; }
      }
      STAND = { fk: k, gs, t: Date.now(), slot: slot(), saison: LEAGUE.season, woche: LEAGUE.week, gebucht: false,
        league: JSON.stringify(league), cup: JSON.stringify(typeof CUP !== 'undefined' ? CUP : null),
        club: JSON.stringify({ club: CLUB, achievements: typeof FCM_ACHIEVEMENTS !== 'undefined' ? FCM_ACHIEVEMENTS : null, squad: SQUAD }),
        market: JSON.stringify(typeof MARKET !== 'undefined' ? MARKET : null),
        karten: (() => { try { return localStorage.getItem('fl-karten'); } catch (e) { return null; } })() };
    } catch (e) { console.warn('[Zeitmaschine] Anpfiff merken', e); STAND = null; }
  }
  function offen() {
    return !!(STAND && STAND.gebucht && hatSpiel() && STAND.slot === slot() && STAND.saison === LEAGUE.season && STAND.woche === LEAGUE.week && !genutzt(STAND.gs.key));
  }
  // Ist das gebuchte Spiel das Aus? (Kickdraft: raus aus den Playoffs oder Finale verloren; Flutlicht: Finale nicht gewonnen)
  function istAus(fx) {
    try {
      if (kickdraft()) {
        const po = DFLPlayoffs.stand && DFLPlayoffs.stand();
        if (po && po.ausgeschieden && po.ausgeschieden.fcm) return true;
        const pl = LEAGUE.dflPlayoffs; return !!(pl && pl.saison === LEAGUE.season && pl.eigeneRunde && pl.meister !== 'fcm');
      }
      if (fx.type === 'pokal') return typeof CUP !== 'undefined' && CUP && CUP.winnerId !== 'fcm';
      return G.homeGoals < G.awayGoals || (G.homeGoals === G.awayGoals && !(G.penaltyWinner === 'home' || G.elfmeterSieger === 'home'));
    } catch (e) { return false; }
  }

  // ── Haken: Anpfiff, Buchung, Wochenwechsel, Laden ─────────────────────────
  ['handleKO', 'simulateCurrentFixture'].forEach(fn => {
    if (typeof W[fn] !== 'function') return;
    const _o = W[fn];
    W[fn] = function () {
      try { if (fn === 'simulateCurrentFixture' || (typeof G !== 'undefined' && !G.running && !G.halfDone && !G.ended && G.min === 0)) merken(); } catch (e) { /* ohne Zeitmaschine */ }
      return _o.apply(this, arguments);
    };
    try { if (fn === 'handleKO') handleKO = W[fn]; else simulateCurrentFixture = W[fn]; } catch (e) { /* window reicht */ }
  });
  let AUS = false;
  if (typeof W.processFixtureResult === 'function') {
    const _o = W.processFixtureResult;
    W.processFixtureResult = function () {
      let k = null, fx = null;
      try { fx = typeof CURRENT_FIXTURE !== 'undefined' ? CURRENT_FIXTURE : null; k = fx ? fxKey(fx) : null; } catch (e) { /* ohne */ }
      const r = _o.apply(this, arguments);
      try {
        if (STAND && k && STAND.fk === k) {
          STAND.gebucht = true; STAND.ergebnis = G.homeGoals + ':' + G.awayGoals;
          STAND.gegner = (typeof TEAMS !== 'undefined' && TEAMS.away && TEAMS.away.name) || '';
          AUS = istAus(fx); STAND.aus = AUS; STAND.angeboten = false;
        }
      } catch (e) { /* ohne Zeitmaschine */ }
      return r;
    };
    try { processFixtureResult = W.processFixtureResult; } catch (e) { /* window reicht */ }
  }
  ['advanceCalendarWeek', 'startNewSeason', 'applyLoadedState', 'startNewGameState'].forEach(fn => {
    if (typeof W[fn] !== 'function') return;
    const _o = W[fn];
    W[fn] = function () { if (!SPRINGT) STAND = null; return _o.apply(this, arguments); };
    try {
      if (fn === 'advanceCalendarWeek') advanceCalendarWeek = W[fn];
      else if (fn === 'startNewSeason') startNewSeason = W[fn];
      else if (fn === 'applyLoadedState') applyLoadedState = W[fn];
      else startNewGameState = W[fn];
    } catch (e) { /* window reicht */ }
  });

  // ── Bezahlen: Video oder (Pro) 10 Winpunkte ────────────────────────────────
  const istPro = () => { try { return !!(W.KSWerbung && KSWerbung.istPro && KSWerbung.istPro()) || localStorage.getItem('dfl-pro') === 'an'; } catch (e) { return false; } };
  const erfolge = () => W.DFLErfolge || W.KSErfolge || null;
  const konto = () => { try { const E = erfolge(); return E ? E.konto() : 0; } catch (e) { return 0; } };
  function video(fertig) {
    // KSWerbung.video lässt Pro ohne Video durch – hier zahlt Pro mit Winpunkten, das Video nur ohne Pro
    if (W.KSWerbung && typeof KSWerbung.video === 'function') return KSWerbung.video('zeitmaschine', fertig);
    if (typeof W.FcmWerbung === 'function') return W.FcmWerbung('belohnung', ok => fertig(!!ok));
    const ov = document.createElement('div');
    ov.className = 'zm-video';
    let rest = CFG.platzhalterSekunden;
    ov.innerHTML = `<div><b>Werbung</b><small>Platzhalter – hier läuft später ein Video</small><span>${rest}</span></div>`;
    document.body.appendChild(ov);
    const t = setInterval(() => { rest--; const s = ov.querySelector('span'); if (s) s.textContent = rest; if (rest <= 0) { clearInterval(t); ov.remove(); fertig(true); } }, 1000);
  }
  function bezahlen(fertig) {
    if (istPro()) {
      const E = erfolge();
      if (!E || !E.ausgeben(CFG.winpunkte, 'Zeitmaschine')) { fertig(false, 'winpunkte'); return; }
      fertig(true); return;
    }
    video(ok => fertig(!!ok));
  }
  const kostenText = () => istPro() ? `${CFG.winpunkte} Winpunkte einsetzen` : 'Video ansehen';
  const kostenKnopf = () => istPro() ? `<span class="zm-muenze" aria-hidden="true">W</span> ${CFG.winpunkte} Winpunkte: Zeit zurückdrehen` : '<i class="ti ti-player-play" aria-hidden="true"></i> Video ansehen: Zeit zurückdrehen';
  const proOhneGeld = () => istPro() && konto() < CFG.winpunkte;

  // ── Zurück vor den Anpfiff ─────────────────────────────────────────────────
  let SPRINGT = false;
  function zurueck() {
    if (!offen()) return false;
    const S = STAND, key = S.gs.key;
    SPRINGT = true;
    try {
      const club = JSON.parse(S.club);
      Object.keys(CLUB).forEach(k => { if (!(k in club.club)) delete CLUB[k]; });      // nach dem Anpfiff Hinzugekommenes weg
      applyLoadedState(JSON.parse(S.league), JSON.parse(S.cup), club, JSON.parse(S.market));
      if (kickdraft() && W.DFLSpiel && DFLSpiel.weltNeuLaden) DFLSpiel.weltNeuLaden();
      try { if (S.karten == null) localStorage.removeItem('fl-karten'); else localStorage.setItem('fl-karten', S.karten); } catch (e) { /* Sammlung bleibt */ }
    } finally { SPRINGT = false; }
    STAND = null;
    zustand()[key] = LEAGUE.season;                       // nach dem Zurückspielen merken (der alte CLUB kannte es nicht)
    try { CURRENT_FIXTURE = null; } catch (e) { /* neu geladen */ }
    try { if (W.DFLTextspiel && DFLTextspiel.ui) DFLTextspiel.ui.schliessen(); } catch (e) { /* ohne Ticker */ }
    const pm = document.getElementById('pm-overlay'); if (pm) pm.remove();
    try { if (typeof resetMatchState === 'function') resetMatchState(); } catch (e) { /* frisch */ }
    if (typeof addNews === 'function') addNews('match', 'Zeitmaschine', `Das ${S.ergebnis} gegen ${S.gegner} hat nie stattgefunden. ${S.gs.label}: neuer Anpfiff.`);
    try { if (typeof saveGameState === 'function') saveGameState(); } catch (e) { /* später */ }
    return true;
  }
  function zumSpiel() {
    try {
      if (W.DFLAppShell && document.body.classList.contains('dfl-shell')) DFLAppShell.zeige('match');
      else if (typeof switchAppView === 'function') switchAppView('match', document.getElementById('nav-match'));
    } catch (e) { /* Ansicht optional */ }
    try { if (typeof ensureFixtureLoaded === 'function') ensureFixtureLoaded(); } catch (e) { console.warn('[Zeitmaschine] Spiel laden', e); }
    try { if (typeof renderHomeTab === 'function') renderHomeTab(); } catch (e) { /* Office optional */ }
  }

  // ── Zeitsprung (Vollbild, ~3 s) ────────────────────────────────────────────
  function sprung(ergebnis, fertig) {
    const ov = document.createElement('div');
    ov.className = 'zm-sprung'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Zeitsprung');
    const spruch = SPRUECHE[Math.floor(Math.random() * SPRUECHE.length)];
    ov.innerHTML = `<div class="zm-ringe" aria-hidden="true"></div>
      <div class="zm-uhr" aria-hidden="true"><span style="left:50%;top:9%">12</span><span style="right:9%;top:50%">3</span><span style="left:50%;bottom:7%">6</span><span style="left:9%;top:50%">9</span>
        <i class="zm-zg"></i><i class="zm-zk"></i></div>
      <div class="zm-stand"><s>${esc(ergebnis)}</s><b>0:0</b></div>
      <p class="zm-spruch">„${esc(spruch)}“</p><small>Zurück vor den Anpfiff · gleich geht es los</small>`;
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('an'));
    setTimeout(() => { try { fertig(); } catch (e) { console.warn('[Zeitmaschine] Sprung', e); } }, CFG.sprungMs * 0.55);
    setTimeout(() => { ov.classList.add('weg'); setTimeout(() => ov.remove(), 450); }, CFG.sprungMs);
  }

  // ── Einsetzen ─────────────────────────────────────────────────────────────
  function einsetzen(danach) {
    if (!offen()) return;
    const erg = STAND.ergebnis;
    bezahlen((ok, grund) => {
      if (!ok) {
        if (grund === 'winpunkte' && typeof W.showToast === 'function') W.showToast(`Dafür brauchst du ${CFG.winpunkte} Winpunkte (du hast ${konto()}).`, 'info');
        if (typeof danach === 'function') danach(false);
        return;
      }
      angebotZu();
      sprung(erg, () => { if (zurueck()) zumSpiel(); if (typeof danach === 'function') danach(true); });
    });
  }

  // ── Angebot wie eine Anzeige (beim Aus, vor dem Spielbericht) ─────────────
  function angebotZu() { const a = document.getElementById('zm-angebot'); if (a) a.remove(); }
  function angebot() {
    if (!offen() || document.getElementById('zm-angebot')) return false;
    STAND.angeboten = true;
    const ov = document.createElement('div');
    ov.id = 'zm-angebot'; ov.className = 'zm-angebot'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Zeitmaschine');
    const leer = proOhneGeld();
    ov.innerHTML = `<div class="zm-karte">
      <div class="zm-kopf"><i class="ti ti-history" aria-hidden="true"></i><span><small>${esc(STAND.gs.label)}</small><b>Zeitmaschine</b></span></div>
      <div class="zm-ergebnis"><span>${esc(STAND.ergebnis)}</span><small>gegen ${esc(STAND.gegner)}</small></div>
      <p>Das war das Aus. Oder doch nicht? Dreh die Uhr zurück und pfeif das Spiel neu an – die Aufstellung darfst du vorher ändern.</p>
      <button type="button" class="zm-los" data-zm="los"${leer ? ' disabled' : ''}>${kostenKnopf()}</button>
      <small class="zm-klein">${leer ? `Du hast ${konto()} von ${CFG.winpunkte} Winpunkten.` : 'einmal ' + esc(STAND.gs.einmal)}</small>
      <button type="button" class="zm-nein" data-zm="nein">Nein danke, zum Spielbericht</button></div>`;
    ov.addEventListener('click', ev => {
      const k = ev.target.closest('[data-zm]'); if (!k) return;
      if (k.dataset.zm === 'nein') angebotZu();
      else { k.disabled = true; einsetzen(ok => { if (!ok) k.disabled = false; }); }
    });
    document.body.appendChild(ov);
    return true;
  }

  // ── Knopf im Spielbericht und am Ticker-Ende ───────────────────────────────
  function knopf() {
    const ziele = [];
    const pmw = document.getElementById('pm-continue-btn'); if (pmw && pmw.parentNode) ziele.push(pmw.parentNode);
    document.querySelectorAll('[data-ts="bericht"]').forEach(b => b.parentNode && ziele.push(b.parentNode));
    const an = offen();
    ziele.forEach(z => {
      const da = z.querySelector('.zm-knopf');
      if (!an) { if (da) da.remove(); return; }
      if (da) return;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'zm-knopf'; b.setAttribute('data-jk-ort', 'zeitmaschine@spielbericht');
      b.innerHTML = `<i class="ti ti-history" aria-hidden="true"></i><span>Zeitmaschine: neu anpfeifen<small>${esc(kostenText())} · einmal ${esc(STAND.gs.einmal)}</small></span>`;
      b.addEventListener('click', ev => { ev.preventDefault(); ev.stopPropagation(); if (proOhneGeld()) { angebot(); return; } b.disabled = true; einsetzen(ok => { if (!ok) b.disabled = false; }); });
      z.insertBefore(b, z.firstChild);
    });
    // Beim Aus: sobald der Spielbericht da ist, vorher das Angebot (nicht in „Simulieren bis …“ und nicht in Tests)
    if (an && STAND.aus && !STAND.angeboten && document.getElementById('pm-overlay') && !simLaeuft() && !testlauf()) angebot();
  }
  let warte = 0;
  const beobachten = () => new MutationObserver(() => { if (warte) return; warte = setTimeout(() => { warte = 0; try { knopf(); } catch (e) { /* Ansicht optional */ } }, 120); })
    .observe(document.body, { childList: true, subtree: true });
  if (document.body) beobachten(); else document.addEventListener('DOMContentLoaded', beobachten);

  // ── Aussehen ──────────────────────────────────────────────────────────────
  const css = document.createElement('style');
  css.textContent = `
body:has(.zm-angebot) .toast-host,body:has(.zm-sprung) .toast-host{visibility:hidden}
.zm-knopf{display:flex;align-items:center;gap:10px;width:100%;margin:0 0 8px;padding:10px 12px;border:0;border-radius:14px;cursor:pointer;text-align:left;
  color:#f6efff;background:radial-gradient(circle at 15% 0%,#6d4bd8,#2a1a63 75%);box-shadow:0 3px 0 #1a0f45,inset 0 0 0 2px #9c84ff;font:700 15px var(--font-text,Fredoka,system-ui)}
.zm-knopf i{font-size:24px;color:#ffe08a}.zm-knopf small{display:block;font-weight:500;font-size:12px;opacity:.8}
.zm-knopf:disabled{opacity:.6}
.zm-angebot{position:fixed;inset:0;z-index:12500;display:grid;place-items:center;padding:16px;background:rgb(8 5 24 / .82);backdrop-filter:blur(3px)}
.zm-karte{width:min(360px,100%);border-radius:22px;padding:18px 16px 14px;color:#f6efff;text-align:center;
  background:radial-gradient(circle at 20% 0%,#6d4bd8,#2a1a63 70%);box-shadow:0 6px 0 #1a0f45,inset 0 0 0 2px #9c84ff;animation:zm-rein .35s ease-out}
.zm-kopf{display:flex;align-items:center;gap:10px;justify-content:center}.zm-kopf i{font-size:34px;color:#ffe08a}
.zm-kopf span{display:grid;text-align:left}.zm-kopf small{font-size:12px;opacity:.8}.zm-kopf b{font:900 28px var(--font-titel,'Big Shoulders Display',system-ui);letter-spacing:.5px}
.zm-ergebnis{margin:12px auto 6px;display:grid}.zm-ergebnis span{font:900 46px var(--font-zahl,'Big Shoulders Display',system-ui);text-decoration:line-through;text-decoration-color:#ff6b6b;text-decoration-thickness:4px}
.zm-ergebnis small{opacity:.8}
.zm-karte p{font-size:14px;line-height:1.4;margin:6px 0 12px;opacity:.95}
.zm-los{width:100%;border:0;border-radius:14px;padding:13px;font:800 16px var(--font-text,Fredoka,system-ui);background:linear-gradient(#ffe08a,#e2a92a);color:#2a1805;
  box-shadow:0 3px 0 #9a6a10;display:flex;gap:8px;align-items:center;justify-content:center;cursor:pointer}
.zm-los:disabled{filter:grayscale(.7);opacity:.6}
.zm-muenze{display:inline-grid;place-items:center;width:22px;height:22px;border-radius:50%;background:#2a1805;color:#ffe08a;font:900 13px system-ui}
.zm-klein{display:block;margin:7px 0 10px;font-size:12px;opacity:.75}
.zm-nein{border:0;background:none;color:#cdbfff;font:600 14px var(--font-text,Fredoka,system-ui);text-decoration:underline;cursor:pointer;padding:6px}
.zm-sprung{position:fixed;inset:0;z-index:12600;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;color:#fff;overflow:hidden;
  background:radial-gradient(circle at 50% 42%,#3a2a8a 0%,#120b33 55%,#05030f 100%);opacity:0;transition:opacity .3s}
.zm-sprung.an{opacity:1}.zm-sprung.weg{opacity:0;transition:opacity .45s}
.zm-ringe{position:absolute;top:50%;left:50%;width:640px;height:640px;margin:-370px 0 0 -320px;border-radius:50%;
  background:repeating-radial-gradient(circle,transparent 0 26px,rgb(156 132 255 / .2) 27px 29px);animation:zm-sog 2.4s linear infinite}
.zm-uhr{position:relative;width:170px;height:170px;border-radius:50%;background:radial-gradient(#fff 0 62%,#ddd 63%);box-shadow:0 0 0 8px #e2a92a,0 0 60px #9c84ff}
.zm-uhr span{position:absolute;transform:translate(-50%,-50%);font:900 20px var(--font-zahl,'Big Shoulders Display',system-ui);color:#1a1240}
.zm-uhr span:nth-child(2){transform:translate(50%,-50%)}.zm-uhr span:nth-child(3){transform:translate(-50%,50%)}
.zm-uhr i{position:absolute;left:50%;bottom:50%;transform-origin:50% 100%;background:#1a1240;border-radius:4px}
.zm-zg{width:7px;height:62px;margin-left:-3.5px;animation:zm-rueck .7s linear infinite}
.zm-zk{width:9px;height:42px;margin-left:-4.5px;animation:zm-rueck 4.2s linear infinite}
.zm-stand{position:relative;font:900 54px var(--font-zahl,'Big Shoulders Display',system-ui);letter-spacing:3px}
.zm-stand s{opacity:.4;font-size:34px;margin-right:12px}
.zm-stand b{display:inline-block;animation:zm-ein .5s 1.1s both}
.zm-spruch{position:relative;max-width:300px;margin:0;font:600 17px/1.35 var(--font-text,Fredoka,system-ui)}
.zm-sprung small{position:relative;opacity:.7}
.zm-video{position:fixed;inset:0;z-index:12700;display:grid;place-items:center;background:#000;color:#fff;text-align:center}
.zm-video div{display:grid;gap:6px}.zm-video span{font:800 40px var(--font-zahl,system-ui)}
@keyframes zm-sog{to{transform:scale(.6) rotate(-90deg);opacity:.6}}
@keyframes zm-rueck{from{transform:rotate(0)}to{transform:rotate(-360deg)}}
@keyframes zm-ein{from{transform:scale(1.8);opacity:0}to{transform:none;opacity:1}}
@keyframes zm-rein{from{transform:translateY(16px) scale(.97);opacity:0}to{transform:none;opacity:1}}
@media (prefers-reduced-motion:reduce){.zm-ringe,.zm-zg,.zm-zk{animation:none}.zm-karte,.zm-stand b{animation:none}}`;
  document.head.appendChild(css);

  W.KSZeitmaschine = { CFG, SPRUECHE, offen, angebot, einsetzen, stand: () => STAND, grossesSpiel };
  console.log('[Kickstil-Zeitmaschine v1] aktiv — Spiel neu anpfeifen in Playoffs/Endspielen (Video oder 10 Winpunkte), Zeitsprung mit Spruch');
})();
