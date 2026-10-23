/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · WERBUNG  ·  v3 (2026-10-16: Spielzeit-Zähler · v2: AdMob über die Android-Hülle, window.FcmWerbung aus apk_bridge.js)   (Nutzer 2026-10-15: „Du kannst es in den Code schon mal einarbeiten, dass da Werbung
   reinkommt, aber lass da nochmal genau reden“)
   ─────────────────────────────────────────────────────────────────────────
   Nur das Gerüst – noch kein Werbekonto, keine echten Anzeigen:
     · KSWerbung.video(grund, fertig): Belohnungsvideo für einen Joker. Pro → sofort fertig(true), ohne Video. Sonst der
       Anbieter (später AdMob über die Android-Hülle: window.FcmApk.werbung) oder ein klar beschrifteter Platzhalter (5 s,
       abbrechbar) wie Kickdraft (dfl_werbung_patch.js).
     · KSWerbung.uebergang(ort): Pflichtanzeige an Übergängen (Spielbericht, „Simulieren bis …“) – höchstens 1 je 30 Minuten
       SPIELZEIT app-weit, nie in den ersten 30 Spielminuten einer Karriere (v3, 2026-10-16, monetarisierung-anpassungen.md 2.1:
       gezählt wird nur, solange die App offen und sichtbar ist – vorher Echtzeit, dann hieß kurzes tägliches Spielen „App auf,
       Werbung“). Zähler: „gesamt-werbung“ { spielSek, spielSekBeiAnzeige } app-weit, Karriere: CLUB.welt.spielSek. SAISONABSCHLUSS IMMER (Nutzer 2026-10-15: „nach jeder Saison
       beim Abschluss kommt Werbung … die Regelmäßigkeit, auf die man sich einstellen MUSS“).
       Aktiv nur mit Werbe-Anbieter (Android-Hülle) – im Browser/Testphase keine Pflichtanzeige (CFG.pflichtAktiv = 'app').
     · Pro-Status app-weit in localStorage „gesamt-pro“ (später über Play Billing bestätigt), Zähler in „gesamt-werbung“ –
       beide Spiele der Gesamt-App teilen sie.
   API: KSWerbung.video · .uebergang · .istPro · .anbieterSetzen(fn) · .CFG
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  // pflichtAbstandMin: Start 30 Minuten Spielzeit, nach 4–6 Wochen AdMob-Daten neu entscheiden (möglich: 25) – nur hier ändern
  // ohneVideoJeTag: Joker ohne Video, wenn gar keine Werbung laden kann (offline, Werbeblocker) – Nutzer 2026-10-19: höchstens einmal am Tag
  const CFG = { pflichtAktiv: 'app', pflichtAbstandMin: 30, karriereSchonzeitMin: 30, platzhalterSekunden: 5, takt: 15, ohneVideoJeTag: 1 };
  const lies = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const schreib = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ohne Speicher */ } };
  // Pro gilt app-weit für beide Spiele (2026-10-16): „gesamt-pro“ (Flutlicht/Gesamt-App) und „dfl-pro“ = 'an' (Kickdraft,
  // dfl_start.js: 3 statt 2 Spielstände). proSetzen schreibt beide – Kickdraft liest nur seinen Schlüssel.
  const istPro = () => lies('gesamt-pro', false) === true || (() => { try { return localStorage.getItem('dfl-pro') === 'an'; } catch (e) { return false; } })();
  function proSetzen(an) {
    schreib('gesamt-pro', !!an);
    try { if (an) localStorage.setItem('dfl-pro', 'an'); else localStorage.removeItem('dfl-pro'); } catch (e) { /* ohne Speicher */ }
  }

  // ── Spielzeit: alle CFG.takt Sekunden, solange die Seite sichtbar ist (nicht im Hintergrund, nicht bei gesperrtem Handy) ──
  const hatVerein = () => { try { return typeof CLUB !== 'undefined' && CLUB && typeof LEAGUE !== 'undefined' && LEAGUE; } catch (e) { return false; } };
  function karriereSek() {
    if (!hatVerein()) return null;
    if (!CLUB.welt) CLUB.welt = {};
    const w = CLUB.welt;
    if (w.spielSek == null) {
      // Alte Stände (v2) hatten nur das Startdatum: wer schon länger als die Schonzeit dabei ist, hat sie hinter sich
      w.spielSek = (w.karriereStart && Date.now() - w.karriereStart >= CFG.karriereSchonzeitMin * 60000) ? CFG.karriereSchonzeitMin * 60 : 0;
    }
    return w.spielSek;
  }
  function ticken() {
    if (typeof document !== 'undefined' && document.visibilityState && document.visibilityState !== 'visible') return;
    const z = lies('gesamt-werbung', {});
    z.spielSek = (z.spielSek || 0) + CFG.takt;
    if (z.spielSekBeiAnzeige == null) z.spielSekBeiAnzeige = 0;
    schreib('gesamt-werbung', z);
    if (karriereSek() != null) CLUB.welt.spielSek += CFG.takt;
  }
  setInterval(() => { try { ticken(); } catch (e) { /* später */ } }, CFG.takt * 1000);
  const zaehlerZurueck = z => { z.spielSekBeiAnzeige = z.spielSek || 0; z.letzte = Date.now(); };

  let anbieter = null, laeuft = false;
  // Android-Hülle (2026-10-16): window.FcmWerbung(art, rueckruf) aus apk_bridge.js → AdMob (Werbung.java); rueckruf(ok, ohne):
  // ok nach ganz gesehenem Belohnungsvideo; ohne = es konnte gar keine Anzeige laufen (offline, Werbeblocker) – dann entscheidet
  // das Spiel (ohneVideo: höchstens CFG.ohneVideoJeTag Joker am Tag)
  const huelle = () => (typeof window.FcmWerbung === 'function' ? window.FcmWerbung : null);
  function apkAnbieter() {
    const h = huelle();
    return h ? fertig => h('belohnung', (ok, ohne) => fertig(!!ok, !!ohne)) : null;
  }
  const heute = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
  function ohneVideoErlaubt() {
    const z = lies('gesamt-werbung', {}), t = heute();
    if (!z.ohneVideo || z.ohneVideo.tag !== t) z.ohneVideo = { tag: t, n: 0 };
    if (z.ohneVideo.n >= CFG.ohneVideoJeTag) return false;
    z.ohneVideo.n++; schreib('gesamt-werbung', z);
    return true;
  }
  function keinVideoHinweis() {
    const t = 'Gerade ist kein Video verfügbar. Morgen gibt es wieder einen Joker ohne Video.';
    if (window.KSPro && KSPro.zeigen && KSPro.zeigen('kein-video')) return;
    if (typeof window.showToast === 'function') window.showToast(t, 'info');
  }
  function platzhalter(grund, fertig) {
    const ov = document.createElement('div');
    ov.id = 'ks-werbung-ov';
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Werbung');
    let rest = CFG.platzhalterSekunden;
    ov.innerHTML = `<div class="ksw-karte"><span class="ksw-marke">Platzhalter</span><i class="ti ti-device-tv" aria-hidden="true"></i>
      <b>Hier läuft später ein Werbevideo</b><small>${grund ? String(grund).replace(/[<>&]/g, '') : ''}</small><span class="ksw-uhr" aria-live="polite">${rest}</span>
      <button type="button" class="ksw-abbruch">Abbrechen</button></div>`;
    document.body.appendChild(ov);
    const zu = ok => { clearInterval(t); ov.remove(); fertig(ok); };
    ov.querySelector('.ksw-abbruch').addEventListener('click', () => zu(false));
    const t = setInterval(() => { rest--; const u = ov.querySelector('.ksw-uhr'); if (u) u.textContent = rest; if (rest <= 0) zu(true); }, 1000);
  }
  function video(grund, fertig) {
    if (typeof fertig !== 'function') fertig = () => {};
    if (istPro()) { fertig(true); return; }
    if (laeuft) return;
    laeuft = true;
    const f = anbieter || apkAnbieter();
    const ende = (ok, ohne) => {
      laeuft = false;
      if (ok && ohne && !ohneVideoErlaubt()) { keinVideoHinweis(); fertig(false); return; }
      if (ok && !ohne) { const z = lies('gesamt-werbung', {}); zaehlerZurueck(z); z.videos = (z.videos || 0) + 1; schreib('gesamt-werbung', z); }   // Video setzt den Zähler zurück
      fertig(!!ok);
    };
    if (f) f(ende); else platzhalter(grund, ende);
  }
  // Pflichtanzeige an einem Übergang – zurzeit abgeschaltet (CFG.pflichtAktiv)
  // Regeln (Spielzeit): Saisonabschluss immer; sonst erst nach der Schonzeit der Karriere und frühestens CFG.pflichtAbstandMin
  // Spielminuten nach der letzten Anzeige oder dem letzten Joker-Video
  function faellig(ort) {
    if (ort === 'saison') return true;
    const ks = karriereSek();
    if (ks != null && ks < CFG.karriereSchonzeitMin * 60) return false;
    const z = lies('gesamt-werbung', {});
    return (z.spielSek || 0) - (z.spielSekBeiAnzeige || 0) >= CFG.pflichtAbstandMin * 60;
  }
  // fertig (optional): läuft, wenn die Anzeige geschlossen ist – oder sofort, wenn keine kommt
  function uebergang(ort, fertig) {
    const weiter = () => { if (typeof fertig === 'function') { try { fertig(); } catch (e) { console.warn('[KSWerbung] danach', e); } } };
    if (!CFG.pflichtAktiv || istPro() || !faellig(ort)) { weiter(); return false; }
    const mitAnbieter = !!(anbieter || apkAnbieter());
    const z = lies('gesamt-werbung', {});
    if (CFG.pflichtAktiv === 'app' && !mitAnbieter) {
      // Browser/Testphase: keine Anzeige, aber mitzählen, wie oft sie gekommen wäre (Messung, Abschnitt 3) – Zähler läuft wie echt
      zaehlerZurueck(z); z.waere = (z.waere || 0) + 1; schreib('gesamt-werbung', z);
      weiter(); return false;
    }
    zaehlerZurueck(z); z.pflicht = (z.pflicht || 0) + 1; schreib('gesamt-werbung', z);
    // Kann keine Anzeige laden (offline, Werbeblocker, keine Einwilligung): stattdessen unsere eigene Pro-Karte (Eigenwerbung)
    try { const h = huelle(); if (h) { h('vollbild', (ok, ohne) => { if (!ok && ohne && eigenwerbung(weiter)) return; weiter(); }); return true; } } catch (e) { /* ohne Hülle */ }
    console.log('[KSWerbung] Pflichtanzeige (Platzhalter) an', ort);
    weiter(); return true;
  }

  // Eigenwerbung für Pro statt einer ausgefallenen Pflichtanzeige – dieselben Regeln (Abstand, Schonzeit, nie in „Simulieren bis …“)
  function eigenwerbung(weiter) {
    if (!(window.KSPro && KSPro.zeigen)) return false;
    const z = lies('gesamt-werbung', {}); z.eigen = (z.eigen || 0) + 1; schreib('gesamt-werbung', z);
    return KSPro.zeigen('werbung', weiter);
  }

  // ── Übergänge: Saisonabschluss (immer), nach dem Spielbericht (30-Minuten-Regel), nicht mitten in „Simulieren bis …“ ──
  const simLaeuft = () => { try { return !!(window.KSSimulieren && KSSimulieren.laeuft && KSSimulieren.laeuft()); } catch (e) { return false; } };
  if (typeof window.startNewSeason === 'function') {
    const _s = window.startNewSeason;
    window.startNewSeason = function () {
      const r = _s.apply(this, arguments);
      // Mit kickstil_saisonabschluss.js läuft die Anzeige dort auf dem Ladebildschirm (nicht doppelt)
      // Kickdraft (gesamt_app/kickdraft_werbung.js): KSWerbung.saisonSpaeter übernimmt – erst nach dem Saison-Rückblick
      const danach = () => { try { if (window.KSSaisonende) return; if (typeof api.saisonSpaeter === 'function') api.saisonSpaeter(); else uebergang('saison'); } catch (e) { /* ohne Anzeige */ } };
      if (r && typeof r.then === 'function') r.then(danach, danach); else setTimeout(danach, 0);
      return r;
    };
    try { startNewSeason = window.startNewSeason; } catch (e) { /* window reicht */ }
  }
  if (typeof window.postMatchContinue === 'function') {
    const _p = window.postMatchContinue;
    window.postMatchContinue = function () {
      const r = _p.apply(this, arguments);
      try { if (!simLaeuft()) uebergang('spielbericht'); } catch (e) { /* ohne Anzeige */ }
      return r;
    };
    try { postMatchContinue = window.postMatchContinue; } catch (e) { /* window reicht */ }
  }

  // Mehr-Blatt: „Datenschutz und Werbung“ (in der EU Pflicht: Einwilligung jederzeit änderbar – Googles UMP-Formular)
  function datenschutzEintrag() {
    const D = window.FcmDatenschutz;
    const box = document.querySelector('#app-sheet .app-sheet-box');
    if (!box || !D || box.querySelector('[data-ks-datenschutz]')) return;
    const b = document.createElement('button'); b.className = 'app-eintrag'; b.setAttribute('data-ks-datenschutz', '1');
    b.innerHTML = '<i class="ti ti-shield-lock" aria-hidden="true"></i><span class="app-eintrag-txt"><b>Datenschutz und Werbung</b><small>Einwilligung für Anzeigen ändern</small></span><i class="ti ti-chevron-right app-pfeil" aria-hidden="true"></i>';
    box.appendChild(b);
  }
  document.addEventListener('click', ev => {
    const b = ev.target.closest && ev.target.closest('[data-ks-datenschutz]');
    if (!b) return;
    ev.preventDefault(); ev.stopPropagation();
    const s = document.getElementById('app-sheet'); if (s) s.classList.remove('auf');
    try { window.FcmDatenschutz.oeffnen(); } catch (e) { /* ohne Hülle */ }
  }, true);
  setInterval(() => { try { datenschutzEintrag(); } catch (e) { /* später */ } }, 1500);

  const css = document.createElement('style');
  css.textContent = `#ks-werbung-ov{position:fixed;inset:0;z-index:12000;background:rgb(0 0 0/.78);display:flex;align-items:center;justify-content:center;padding:16px}
  .ksw-karte{background:var(--bg2,#fffaf0);color:var(--text,#2b2a26);border:3px solid var(--k-rahmen,#8b5a2b);border-radius:20px;padding:22px 20px;
    max-width:340px;width:100%;display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;font-family:var(--font-text,system-ui)}
  .ksw-karte>i{font-size:46px;color:var(--k-blau,#2c7cb5)}.ksw-karte small{color:var(--text3,#846d52)}
  .ksw-marke{font:800 11px/1 system-ui;letter-spacing:.1em;text-transform:uppercase;background:#f0c05a;color:#2a1c02;padding:4px 8px;border-radius:6px}
  .ksw-uhr{font:800 34px/1 var(--font-zahl,system-ui)}
  .ksw-abbruch{border:0;border-radius:12px;padding:10px 16px;font:700 14px/1 var(--font-titel,system-ui);background:var(--bg3,#efe2c8);color:inherit;cursor:pointer}
  html.dark .ksw-karte{background:var(--bg2,#1e2230)}`;
  document.head.appendChild(css);

  const api = window.KSWerbung = { CFG, video, uebergang, faellig, eigenwerbung, saisonSpaeter: null, istPro, proSetzen, zaehler: () => lies('gesamt-werbung', {}), karriereSek, anbieterSetzen(fn) { anbieter = typeof fn === 'function' ? fn : null; } };
  console.log('[Kickstil-Werbung v3] aktiv — Spielzeit-Zähler ' + CFG.pflichtAbstandMin + ' Min, ' + (huelle() ? 'AdMob' : 'Browser: Platzhalter') + ': Joker-Videos (Platzhalter), Pflichtanzeige nur in der App (Saisonabschluss immer), Pro app-weit');
})();
