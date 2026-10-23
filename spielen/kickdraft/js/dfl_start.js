/* ═══════════════════════════════════════════════════════════════════════════
   DFL · START  ·  v1   (Nachtschicht 2026-10-13, Wunsch des Nutzers: „2 Spielstände gleichzeitig bei pro 3 vllt. Mit normalem
   Speichern, einem startbildschirm und einem impressum, Datenschutz und der ganzen rest dazu“)
   ───────────────────────────────────────────────────────────────────────────
   · Startbildschirm bei jedem Seitenstart: Startbild der Vereinswahl (DFLKulisse), „Weiter“ mit Wappen, Saison, Woche, Platz,
     dazu Spielstände, Neues Spiel, Einstellungen, Rechtliches. Ohne Spielstand nur „Neues Spiel“ (Vereinswahl liegt darunter).
   · Spielstände: 2 Plätze, mit Pro 3 (D116, Schalter localStorage 'dfl-pro' = 'an', bis es Pro gibt). Alte Stände über der
     Grenze bleiben, nur neue Spiele und Importe sind dann gesperrt. Laden eines anderen Platzes = speichern, Platz aktiv setzen,
     Seite neu laden (sauberer Zustand aller Module statt _afterLoad im laufenden Spiel).
   · Speichern: Mehr → „Jetzt speichern“ mit „Gespeichert vor …“; der Index merkt sich Franchise, Woche und Platz je Spielstand.
   · Rechtliches: Impressum (Angaben trägt der Nutzer ein: IMPRESSUM unten), Datenschutz, Lizenzen.
   Hängt sich an: currentSlotMeta (engine_main.js), showOnboarding (Vereinswahl statt alter Spielstand-Liste), Mehr-Menü.
   Im Testlauf (navigator.webdriver) kein Startbildschirm, außer localStorage 'dfl-start-test' = 'an'.
   D135 (2026-10-14): Neues Spiel aus einem laufenden Spiel, „Spiel neu starten“ und Game Over laden die Seite mit dem Merker
   'dfl-neues-spiel' (sessionStorage) neu – loadGameState lädt dann nichts, die Vereinswahl kommt direkt, alles startet frisch.
   D160 (2026-10-15): Vorhang aus index.html (Startfarbe + Logo wie das Startbild der App) bis Hauptmenü bzw. Vereinswahl stehen –
   kein Aufblitzen des Spiels oder einer leeren Seite; in der App blendet dflVorhangWeg auch das Startbild aus (SplashScreen.hide).
   API: DFLStart = { zeigen, staende, recht, plaetze, gespeichertText, jetztSpeichern, neuesSpiel, IMPRESSUM }
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof loadSavesIndex !== 'function' || typeof window.showOnboarding !== 'function') {
    console.warn('[DFL-Start] Grundlagen fehlen – inaktiv');
    if (window.dflVorhangWeg) setTimeout(window.dflVorhangWeg, 0);
    return;
  }

  // Impressum: erst eintragen, wenn der Nutzer Name und Kontakt nennt (Prüflauf meldet es, solange es leer ist)
  const KONTAKT = 'kickdraft.spiel@gmail.com';   // Spiel-Adresse des Nutzers (2026-10-14)
  const VERANTWORTLICH = 'Tim Laurids Ranze';     // Datenschutz (Nutzer 2026-10-14)
  const IMPRESSUM = null;   // z. B. { name: '…', anschrift: ['…', '…'], kontakt: '…' }
  const FREI = 2, MIT_PRO = 3;

  const lsLies = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const pro = () => lsLies('dfl-pro') === 'an';
  const plaetze = () => (pro() ? MIT_PRO : FREI);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const laeuft = () => typeof LEAGUE !== 'undefined' && LEAGUE && typeof CLUB !== 'undefined' && CLUB && CLUB.dfl && CLUB.dfl.aktiv && typeof ACTIVE_SLOT_ID !== 'undefined' && !!ACTIVE_SLOT_ID;
  const toast = t => { if (typeof showToast === 'function') showToast(t); };
  const wappen = fid => (fid && window.DFLIdentitaet ? DFLIdentitaet.wappenSvg({ id: fid }) : '');
  const version = () => (window.DFLTestkit ? DFLTestkit.version : '');
  let zuletzt = null;   // Zeitpunkt des letzten Speicherns des aktiven Spielstands (aus dem Index, dann aus dem Speichern)

  // ── Metadaten je Spielstand ──────────────────────────────────────────────
  function platz() {
    try {
      const teams = LEAGUE.tiers.bundesliga.groups[0].teams.slice().sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
      const t = teams.find(x => x.id === 'fcm'); return t && t.played ? teams.indexOf(t) + 1 : null;
    } catch (e) { return null; }
  }
  const _meta = window.currentSlotMeta;
  if (typeof _meta === 'function') {
    window.currentSlotMeta = function () {
      const m = _meta.apply(this, arguments);
      try {
        m.franchise = CLUB.dfl && CLUB.dfl.franchiseId || null;
        m.woche = typeof calendarLabel === 'function' ? calendarLabel(LEAGUE.week, LEAGUE.startYear || 2026) : 'Woche ' + LEAGUE.week;
        m.platz = platz();
        m.ende = !!(CLUB.dfl && CLUB.dfl.karriereEnde);          // D143: Karriere beendet (nur noch Rückblick)
        zuletzt = m.savedAt;
      } catch (e) { /* nur Anzeige */ }
      return m;
    };
    try { currentSlotMeta = window.currentSlotMeta; } catch (e) { /* global überschrieben reicht */ }
  }
  function vor(ts) {
    if (!ts) return '';
    const min = Math.round((Date.now() - ts) / 60000);
    if (min < 1) return 'gerade eben';
    if (min < 60) return `vor ${min} Min`;
    const d = new Date(ts), heute = new Date(), uhr = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === heute.toDateString()) return 'heute ' + uhr;
    const gestern = new Date(heute); gestern.setDate(heute.getDate() - 1);
    if (d.toDateString() === gestern.toDateString()) return 'gestern ' + uhr;
    return d.toLocaleDateString('de-DE') + ' ' + uhr;
  }
  function gespeichertText() {
    const ok = window.DFLSpeicherPatch && DFLSpeicherPatch.STAND && DFLSpeicherPatch.STAND.ok;
    const ts = Math.max(ok || 0, zuletzt || 0);
    return ts ? 'Gespeichert ' + vor(ts) : 'Speichert nach jeder Woche';
  }
  const zeile = s => s.ende ? `Karriere beendet · Saison ${s.season || 1}`
    : [s.woche ? `Saison ${s.season || 1} · ${s.woche}` : `Saison ${s.season || 1}`, s.platz ? `Platz ${s.platz}` : ''].filter(Boolean).join(' · ');

  // ── Spruch vom Zeugwart (freigegeben 2026-10-14) ─────────────────────────
  // Eine trockene Zeile unter dem Startbild, jeden Start eine andere; Antippen holt die nächste. Bei Serien passt sie zur Lage.
  const SPRUECHE = {
    immer: [
      'Die Trikots sind gewaschen. Fast alle.',
      'Der Rasen ist gemäht. Die Kabine riecht nach Pferdesalbe.',
      'Der Torwart hat wieder seine Glückssocken an. Die linke ist neu.',
      'Im Vereinsheim gibt es heute Linsensuppe. Wie jeden Dienstag.',
      'Der Ball ist rund. Wurde heute Morgen nachgemessen.',
      'Der Kapitän sucht seit drei Wochen seinen Schienbeinschoner.',
      'Die Flutlichter funktionieren. Eins flackert, aber nur aus Gewohnheit.',
      'Der Physio hat neues Tape gekauft. Er ist sehr stolz darauf.',
      'Die Kaffeemaschine im Trainerbüro ist wieder heil.',
      'Die Hütchen sind gezählt. Es fehlen wieder zwei.',
      'Die Stollen sind geschraubt. Die Schrauben auch.',
      'Der Ersatztorwart wärmt sich schon mal auf. Sicher ist sicher.',
      'In der Kabine hängt ein neuer Spiegel. Drei Spieler waren seitdem nicht mehr draußen.',
      'Die Bälle sind aufgepumpt. Einer pfeift beim Schießen.',
      'Der Busfahrer kennt den Weg. Sagt er.',
      'Die Eckfahnen stehen gerade. Ich habe nachgemessen.',
      'Die Wäsche ist sortiert. Nach Rückennummer, nicht nach Farbe.',
      'Der Co-Trainer hat ein neues Klemmbrett. Es ist sehr blau.',
      'Die Trinkflaschen sind gefüllt. Mit Wasser, diesmal wirklich.',
      'In der Geschäftsstelle summt der Drucker. Seit Montag.',
      'Der Scout ist zurück. Mit einem Notizblock voller Namen und einer Erkältung.',
      'Die Ersatzbank ist frisch gestrichen. Bitte nicht hinsetzen.',
      'Der Trainer will heute nur Standards üben. Ich habe die Mauer schon aufgestellt.',
      'Die Torlinie ist frisch gekreidet. Bitte nicht drüber, außer mit dem Ball.'
    ],
    sieg: [
      'Drei Siege am Stück. Ich wasche die Trikots erst mal nicht.',
      'Läuft. Der Trainer hat heute sogar gegrüßt.',
      'Die Fans singen schon beim Aufwärmen. Ich singe leise mit.'
    ],
    pleite: [
      'Die Stimmung ist im Keller. Ich habe dort aufgeräumt.',
      'Drei Pleiten. Ich habe die Glückssocken gewaschen. Das war wohl ein Fehler.',
      'Der Trainer schaut heute sehr lange auf die Taktiktafel.'
    ],
    pause: [
      'Sommerpause. Ich zähle die Trikots. Es sind wieder zu viele Größe L.',
      'Kein Spiel diese Woche. Der Rasen erholt sich, ich auch.'
    ]
  };
  function spruchLage() {
    try {
      if (!laeuft() || typeof LEAGUE === 'undefined' || !LEAGUE) return null;
      const md = LEAGUE.matchday || 0, n = (LEAGUE.matchWeeks || []).length;
      if (!md || (n && md >= n)) return 'pause';
      const t = LEAGUE.tiers.bundesliga.groups[0].teams.find(x => x.id === 'fcm');
      const l3 = ((t && t.form) || []).slice(-3);
      if (l3.length === 3 && l3.every(r => r === 'W')) return 'sieg';
      if (l3.length === 3 && l3.every(r => r === 'L')) return 'pleite';
    } catch (e) { /* ohne Lage nur allgemeine Sprüche */ }
    return null;
  }
  let spruchNr = -1;
  function spruch(weiter) {
    const lage = spruchLage(), liste = lage ? SPRUECHE[lage].concat(SPRUECHE.immer) : SPRUECHE.immer;
    // erster Spruch: bei einer Serie einer zur Lage (die stehen vorne in der Liste), sonst irgendeiner
    if (spruchNr < 0) spruchNr = Math.floor(Math.random() * (lage ? SPRUECHE[lage].length : liste.length));
    else if (weiter) spruchNr++;
    return liste[spruchNr % liste.length];
  }
  const spruchHtml = () => `<button type="button" class="st-spruch" data-st="spruch" aria-label="Nächster Spruch"><span>${esc(spruch(false))}</span><small>Der Zeugwart</small></button>`;

  // ── Fenster ──────────────────────────────────────────────────────────────
  let ov = null, ansicht = 'start', ausSpiel = false, idx = { slots: [] };
  function schliessen() { if (ov) { ov.remove(); ov = null; } document.body.classList.remove('st-offen'); }
  async function oeffnen(a, ausDemSpiel) {
    idx = await loadSavesIndex();
    if (laeuft()) { const s = idx.slots.find(x => x.id === ACTIVE_SLOT_ID); if (s && s.savedAt) zuletzt = Math.max(zuletzt || 0, s.savedAt); }
    ansicht = a; ausSpiel = !!ausDemSpiel;
    if (!ov) {
      ov = document.createElement('div'); ov.className = 'st-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
      document.body.appendChild(ov); document.body.classList.add('st-offen');
      ov.addEventListener('click', klick);
    }
    zeichnen();
  }
  function kopf() {
    // .dfl-wahl/.dfl-wahl-kopf: DFLKulisse setzt das Startbild davor (wie in der Vereinswahl)
    return `<div class="dfl-wahl st-bild"><div class="dfl-wahl-kopf"></div></div>`;
  }
  function zurueck(titel) {
    return `<div class="st-leiste"><button type="button" class="st-zurueck" data-st="zurueck" aria-label="Zurück"><i class="ti ti-arrow-left" aria-hidden="true"></i></button><h2>${esc(titel)}</h2></div>`;
  }
  function zeichnen() {
    if (!ov) return;
    const L = laeuft(), voll = idx.slots.length >= plaetze();
    let html = '';
    if (ansicht === 'start') {
      const a = L ? (idx.slots.find(x => x.id === ACTIVE_SLOT_ID) || {}) : null;
      const fid = L ? CLUB.dfl.franchiseId : null;
      html = kopf() + `<div class="st-inhalt">` + spruchHtml() + (L ? `
        <button type="button" class="st-weiter" data-st="weiter">
          <span class="st-wappen">${wappen(fid)}</span>
          <span class="st-wtxt"><b>${esc(CLUB.name)}</b><small>${esc(zeile(Object.assign({}, a, { season: LEAGUE.season, woche: a.woche || null, platz: platz() })))}</small></span>
          <span class="st-los">Weiter <i class="ti ti-player-play-filled" aria-hidden="true"></i></span>
        </button>` : `
        <button type="button" class="st-weiter st-neu-gross" data-st="neu"><span class="st-wtxt"><b>Neues Spiel</b><small>Wähle deine Franchise</small></span>
          <span class="st-los">Los <i class="ti ti-player-play-filled" aria-hidden="true"></i></span></button>`) + `
        <div class="st-liste">
          <button type="button" class="st-eintrag" data-st="staende"><i class="ti ti-device-floppy" aria-hidden="true"></i><span><b>Spielstände</b><small>${idx.slots.length} von ${plaetze()}</small></span><i class="ti ti-chevron-right" aria-hidden="true"></i></button>
          ${L ? `<button type="button" class="st-eintrag" data-st="neu"><i class="ti ti-plus" aria-hidden="true"></i><span><b>Neues Spiel</b><small>${voll ? 'Alle Plätze belegt' : 'Verein wählen'}</small></span><i class="ti ti-chevron-right" aria-hidden="true"></i></button>
          <button type="button" class="st-eintrag" data-st="einst"><i class="ti ti-settings" aria-hidden="true"></i><span><b>Einstellungen</b><small>Ansicht, Spiel als Text, Spielmodus</small></span><i class="ti ti-chevron-right" aria-hidden="true"></i></button>` : ''}
          <button type="button" class="st-eintrag" data-st="recht"><i class="ti ti-scale" aria-hidden="true"></i><span><b>Impressum und Datenschutz</b><small>Lizenzen</small></span><i class="ti ti-chevron-right" aria-hidden="true"></i></button>
        </div>
        <p class="st-fuss">${version() ? 'Version ' + esc(version()) + ' · ' : ''}Alle Vereine und Spieler sind erfunden.</p></div>`;
    } else if (ansicht === 'staende') {
      const slots = [...idx.slots].sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
      const karten = slots.map(s => {
        const aktiv = L && s.id === ACTIVE_SLOT_ID;
        return `<div class="st-platz${aktiv ? ' aktiv' : ''}">
          <div class="st-pkopf"><span class="st-wappen klein">${wappen(s.franchise)}</span>
            <span class="st-wtxt"><b>${esc(s.name || s.club || 'Spielstand')}</b><small>${esc(zeile(s))}</small><small>${aktiv ? 'Läuft · ' : ''}${esc(vor(s.savedAt))}</small></span></div>
          <div class="st-pknoepfe">
            <button type="button" class="st-knopf" data-st="${aktiv ? 'weiter' : 'laden'}" data-id="${esc(s.id)}">${aktiv ? 'Weiter' : 'Laden'}</button>
            <button type="button" class="st-knopf zweit" data-st="datei" data-id="${esc(s.id)}" aria-label="Als Datei sichern"><i class="ti ti-download" aria-hidden="true"></i></button>
            <button type="button" class="st-knopf zweit" data-st="name" data-id="${esc(s.id)}" aria-label="Umbenennen"><i class="ti ti-pencil" aria-hidden="true"></i></button>
            <button type="button" class="st-knopf zweit rot" data-st="loeschen" data-id="${esc(s.id)}" aria-label="Löschen"><i class="ti ti-trash" aria-hidden="true"></i></button>
          </div></div>`;
      }).join('');
      const frei = Math.max(0, plaetze() - slots.length);
      const leer = Array.from({ length: frei }, () => `<button type="button" class="st-platz leer" data-st="neu"><i class="ti ti-plus" aria-hidden="true"></i><span><b>Freier Platz</b><small>Neues Spiel</small></span></button>`).join('');
      const proPlatz = !pro() ? `<div class="st-platz gesperrt"><i class="ti ti-lock" aria-hidden="true"></i><span><b>Dritter Platz</b><small>Mit Pro</small></span></div>` : '';
      html = zurueck('Spielstände') + `<div class="st-inhalt">
        ${voll && slots.length ? `<p class="st-hinweis"><i class="ti ti-info-circle" aria-hidden="true"></i> Alle ${plaetze()} Plätze belegt. Für ein neues Spiel einen Spielstand löschen oder als Datei sichern.</p>` : ''}
        ${karten}${leer}${proPlatz}
        ${L ? `<button type="button" class="st-eintrag" data-st="speichern"><i class="ti ti-device-floppy" aria-hidden="true"></i><span><b>Jetzt speichern</b><small>${esc(gespeichertText())}</small></span></button>` : ''}
        <button type="button" class="st-eintrag" data-st="import" ${voll ? 'disabled' : ''}><i class="ti ti-upload" aria-hidden="true"></i><span><b>Spielstand aus Datei</b><small>${voll ? 'Kein Platz frei' : 'JSON-Datei vom Handy oder Rechner'}</small></span></button>
        <input type="file" class="st-datei" accept="application/json,.json" hidden></div>`;
    } else if (ansicht === 'recht') {
      const I = IMPRESSUM;
      html = zurueck('Impressum und Datenschutz') + `<div class="st-inhalt st-recht">
        <section><h3>Impressum</h3>${I ? `<p>${esc(I.name)}<br>${(I.anschrift || []).map(esc).join('<br>')}<br>${esc(I.kontakt)}</p>` : '<p>Angaben nach § 5 DDG folgen vor der Veröffentlichung.</p>'}</section>
        <section><h3>Datenschutz</h3>
          <p>Das Spiel speichert deine Spielstände und Einstellungen nur auf diesem Gerät. Es sendet keine Daten, nutzt keine Tracker und keine Werbung und lädt beim Spielen nichts aus dem Internet.</p>
          <p>Feedback und Spielstand-Dateien teilst du selbst, zum Beispiel über das Teilen-Menü deines Handys. Was du dort auswählst, entscheidest du.</p>
          <p>Löschen: Spielstände unter „Spielstände“ löschen oder die App-Daten in den Einstellungen des Handys leeren.</p>
          <p>Verantwortlich: ${esc(VERANTWORTLICH)} · Kontakt: <a href="mailto:${KONTAKT}">${KONTAKT}</a></p></section>
        <section><h3>Lizenzen</h3><ul class="st-liz">
          <li><span>Grafiken, Gelände, Himmel, Maskottchen (Kenney)</span><b>CC0</b></li>
          <li><span>Wappenschilde (Armoria)</span><b>CC0</b></li>
          <li><span>Spielicons und Wappenfiguren (game-icons.net)</span><b>CC BY 3.0</b></li>
          <li><span>Schriften Fredoka, Rubik</span><b>SIL OFL 1.1</b></li>
          <li><span>Gesichter (facesjs), Tabler Icons, Radix Colors, lz-string</span><b>MIT</b></li></ul>
          ${L && window.DFLAppShell && DFLAppShell.mitwirkende ? '<button type="button" class="st-eintrag" data-st="autoren"><i class="ti ti-users" aria-hidden="true"></i><span><b>Mitwirkende</b><small>Alle Autoren der Icons und Figuren</small></span><i class="ti ti-chevron-right" aria-hidden="true"></i></button>' : ''}
          <p>Alle Vereine, Spieler und Personen sind erfunden. Ähnlichkeiten mit echten Vereinen oder Personen sind nicht beabsichtigt.</p></section>
        <p class="st-fuss">${version() ? 'Version ' + esc(version()) : ''}</p></div>`;
    }
    ov.className = 'st-ov st-' + ansicht;
    ov.setAttribute('aria-label', ansicht === 'start' ? 'Start' : ansicht === 'staende' ? 'Spielstände' : 'Impressum und Datenschutz');
    ov.innerHTML = `<div class="st-box">${html}</div>`;
    const f = ov.querySelector('.st-datei'); if (f) f.addEventListener('change', importieren);
  }

  // ── Neues Spiel = Seite frisch laden (D135) ─────────────────────────────
  // Nutzer 2026-10-14: „wenn ich ein neues Spiel starte muss alles wieder resetet werden für diesen Spielstand und ein neuer Seed
  // muss kreiert werden.“ startNewGameState setzt CLUB nicht zurück, Module halten Zustand in ihren Closures (Chronik, Tutorial,
  // Sponsorfenster, Trainingslager …). Deshalb startet jede neue Karriere aus einer Seite, die noch kein Spiel hatte: Merker setzen,
  // neu laden – loadGameState (engine_main.js) lädt dann nichts, die Vereinswahl kommt direkt, der Seed entsteht bei der Wahl.
  const MERKER = 'dfl-neues-spiel';
  let benutzt = laeuft();                // diese Seite hat schon einen Spielstand geladen oder ein Spiel begonnen
  const istBenutzt = () => benutzt || laeuft() || (typeof LEAGUE !== 'undefined' && !!LEAGUE);
  function neuesSpielNeuladen(verein) {
    // Ab hier schreibt nichts mehr in einen Platz: ein gelöschter aktiver Platz würde sonst von saveGameState neu angelegt
    window.saveGameState = async function () { return false; };
    try { saveGameState = window.saveGameState; } catch (e) { /* global */ }
    const wert = JSON.stringify({ t: Date.now(), verein: verein || null });
    let ok = false;
    try { sessionStorage.setItem(MERKER, wert); ok = sessionStorage.getItem(MERKER) === wert; } catch (e) { ok = false; }
    if (!ok) { try { localStorage.setItem(MERKER, wert); } catch (e) { /* ohne Speicher bleibt nur das Neuladen */ } }
    location.reload();
  }
  const frisch = () => !!window.DFL_NEUES_SPIEL && !istBenutzt();

  // ── Aktionen ─────────────────────────────────────────────────────────────
  async function neuesSpiel() {
    idx = await loadSavesIndex();
    if (idx.slots.length >= plaetze()) { ansicht = 'staende'; zeichnen(); return; }
    if (istBenutzt()) {
      if (laeuft()) { try { await saveGameState(); } catch (e) { /* letzter Stand bleibt */ } }
      neuesSpielNeuladen();
      return;
    }
    schliessen();
    if (laeuft()) { await window.showOnboarding(); return; }
    if (typeof window._obNew === 'function' && document.querySelector('#onboarding-overlay [onclick^="window._obNew"]')) window._obNew();
    else if (!document.getElementById('onboarding-overlay')) await window.showOnboarding();
  }
  async function laden(id) {
    if (laeuft()) { try { await saveGameState(); } catch (e) { /* alter Stand bleibt */ } }
    const i = await loadSavesIndex(); i.activeId = id; await saveSavesIndex(i);
    location.reload();
  }
  async function loeschen(id) {
    const s = idx.slots.find(x => x.id === id); if (!s) return;
    if (!confirm(`Spielstand „${s.name || s.club}“ löschen? Das lässt sich nicht rückgängig machen.`)) return;
    const aktiv = laeuft() && id === ACTIVE_SLOT_ID;
    if (aktiv) { window.saveGameState = async function () { return false; }; try { saveGameState = window.saveGameState; } catch (e) { /* global */ } }
    await deleteSlot(id);
    if (aktiv) { location.reload(); return; }
    idx = await loadSavesIndex(); zeichnen();
  }
  async function datei(id) {
    if (laeuft() && id === ACTIVE_SLOT_ID) { try { await saveGameState(); } catch (e) { /* letzter Stand */ } }
    if (typeof exportSlotToFile === 'function') await exportSlotToFile(id);
  }
  async function umbenennen(id) {
    const s = idx.slots.find(x => x.id === id); if (!s) return;
    const n = prompt('Name des Spielstands', s.name || s.club || '');
    if (n && n.trim()) { await renameSlot(id, n.trim().slice(0, 40)); idx = await loadSavesIndex(); zeichnen(); }
  }
  async function importieren(ev) {
    const file = ev.target.files && ev.target.files[0]; if (!file) return;
    idx = await loadSavesIndex();
    if (idx.slots.length >= plaetze()) { zeichnen(); return; }
    try {
      const obj = JSON.parse(await file.text());
      if (!obj || !obj.league || !obj.cup) { alert('Diese Datei ist kein Spielstand.'); return; }
      const id = await importSaveObject(obj, obj.name);
      if (!id) { alert('Der Spielstand konnte nicht übernommen werden.'); return; }
      // Wappen und Woche wie bei gespeicherten Ständen (importSaveObject kennt nur Name und Saison; Spieltest 2026-10-14)
      try {
        const i = await loadSavesIndex(), s = i.slots.find(x => x.id === id), c = obj.club && obj.club.club, l = obj.league;
        if (s && c && c.dfl) {
          s.franchise = c.dfl.franchiseId || null;
          if (l.week && typeof calendarLabel === 'function') s.woche = calendarLabel(l.week, l.startYear || 2026);
          await saveSavesIndex(i);
        }
      } catch (e) { /* nur Anzeige */ }
      idx = await loadSavesIndex(); zeichnen(); toast('Spielstand übernommen');
    } catch (e) { alert('Die Datei konnte nicht gelesen werden.'); }
  }
  async function jetztSpeichern() {
    const ok = await saveGameState();
    toast(ok === false ? 'Nicht gespeichert, der letzte Stand bleibt' : 'Gespeichert');
    if (ov) { idx = await loadSavesIndex(); zeichnen(); }
  }
  function klick(e) {
    const b = e.target.closest('[data-st]'); if (!b || b.disabled) return;
    const id = b.getAttribute('data-id'), was = b.getAttribute('data-st');
    if (was === 'weiter') schliessen();
    else if (was === 'neu') neuesSpiel();
    else if (was === 'staende') { ansicht = 'staende'; zeichnen(); }
    else if (was === 'recht') { ansicht = 'recht'; zeichnen(); }
    else if (was === 'zurueck') { if (ausSpiel) schliessen(); else { ansicht = 'start'; zeichnen(); } }
    else if (was === 'einst') { schliessen(); if (window.DFLAppShell) DFLAppShell.einstellungenBlatt(); }
    else if (was === 'autoren') { schliessen(); DFLAppShell.mitwirkende(); }
    else if (was === 'laden') laden(id);
    else if (was === 'loeschen') loeschen(id);
    else if (was === 'datei') datei(id);
    else if (was === 'name') umbenennen(id);
    else if (was === 'import') { const f = ov.querySelector('.st-datei'); if (f) f.click(); }
    else if (was === 'speichern') jetztSpeichern();
    else if (was === 'spruch') { const sp = b.querySelector('span'); if (sp) sp.textContent = spruch(true); }
  }

  // ── Vereinswahl statt alter Spielstand-Liste ────────────────────────────
  // „Zurück“ der Vereinswahl: ins laufende Spiel bzw. auf den Startbildschirm
  function wahlZurueck() {
    const o = document.getElementById('onboarding-overlay');
    // Seite für ein neues Spiel frisch geladen (D135): zurück heißt den letzten Spielstand wieder laden
    if (frisch()) { location.reload(); return; }
    if (laeuft()) { if (o) o.remove(); oeffnen('staende', true); } else oeffnen('start');
  }
  // Sicherheitsnetz (D135): beginnt in einer Seite, die schon ein Spiel hatte, doch eine neue Karriere (z. B. über eine alte
  // Vereinswahl), lädt sie erst frisch und wählt denselben Verein dort noch einmal (neuer Seed bei der Wahl)
  if (typeof window._beginNewGame === 'function') {
    const _orig = window._beginNewGame;
    window._beginNewGame = async function (gewaehlt) {
      if (istBenutzt()) {
        const i = await loadSavesIndex();
        if (i.slots.length >= plaetze()) { oeffnen('staende', laeuft()); return; }      // Platzgrenze wie bei „Neues Spiel“
        if (laeuft()) { try { await saveGameState(); } catch (e) { /* letzter Stand bleibt */ } }
        neuesSpielNeuladen(gewaehlt && gewaehlt.name);
        return;
      }
      benutzt = true;
      return _orig.apply(this, arguments);
    };
    try { _beginNewGame = window._beginNewGame; } catch (e) { /* global überschrieben reicht */ }
  }
  // „Spiel neu starten“ (Einstellungen) und Game Over: Spielstand löschen wie bisher, dann frisch laden statt im alten Zustand weiter
  if (typeof window.restartGame === 'function') {
    window.restartGame = async function () {
      if (!confirm('Wirklich neu starten? Der gesamte aktuelle Spielstand (Verein, Kader, Tabellen, Finanzen) wird dauerhaft gelöscht.')) return;
      if (!confirm('Letzte Bestätigung: Dieser Schritt kann NICHT rückgängig gemacht werden. Fortfahren?')) return;
      try { await resetGameStorage(); } catch (e) { /* Platz bleibt, das neue Spiel bekommt trotzdem einen eigenen */ }
      neuesSpielNeuladen();
    };
    try { restartGame = window.restartGame; } catch (e) { /* global überschrieben reicht */ }
  }
  if (typeof window.expRestartAfterGameOver === 'function') {
    window.expRestartAfterGameOver = async function () {
      const o = document.querySelector('.exp-gameover'); if (o) o.remove();
      try { await resetGameStorage(); } catch (e) { /* wie oben */ }
      neuesSpielNeuladen();
    };
    try { expRestartAfterGameOver = window.expRestartAfterGameOver; } catch (e) { /* global überschrieben reicht */ }
  }
  const _ob = window.showOnboarding;
  window.showOnboarding = async function () {
    const r = await _ob.apply(this, arguments);
    try {
      if (document.querySelector('#onboarding-overlay [onclick^="window._obNew"]')) window._obNew();
      window._obBack = wahlZurueck;
    } catch (e) { /* alte Liste bleibt */ }
    return r;
  };
  try { showOnboarding = window.showOnboarding; } catch (e) { /* global überschrieben reicht */ }
  // Die DFL-Vereinswahl (dfl_liga_patch.js) ersetzt den Inhalt samt altem Zurück-Knopf → eigenen Knopf oben links setzen
  // (Spieltest 2026-10-14: aus „Freier Platz“ kam man nur über ein neues Spiel wieder heraus)
  function wahlKnopf() {
    const w = document.querySelector('#onboarding-overlay .dfl-wahl');
    if (!w || w.querySelector(':scope > .st-wahl-zurueck')) return;
    w.classList.add('st-mit-zurueck');
    w.insertAdjacentHTML('afterbegin', '<button type="button" class="st-zurueck st-wahl-zurueck" aria-label="Zurück"><i class="ti ti-arrow-left" aria-hidden="true"></i></button>');
    w.querySelector(':scope > .st-wahl-zurueck').addEventListener('click', e => { e.stopPropagation(); wahlZurueck(); });
  }
  if (typeof MutationObserver === 'function') new MutationObserver(wahlKnopf).observe(document.body, { childList: true, subtree: true });
  wahlKnopf();

  // ── Stil ────────────────────────────────────────────────────────────────
  const css = document.createElement('style');
  css.id = 'dfl-start-css';
  css.textContent = `.st-ov{position:fixed;inset:0;z-index:10000;background:var(--bg,#f4e3c1);color:var(--text,#2c3e50);overflow-y:auto;display:flex;justify-content:center;
  padding:calc(10px + env(safe-area-inset-top,0px)) 16px calc(20px + env(safe-area-inset-bottom,0px))}
body.st-offen{overflow:hidden}
.st-box{width:100%;max-width:560px;display:flex;flex-direction:column;gap:12px}
.st-bild{width:100%;max-height:none;overflow:visible;padding:0}.st-bild .dfl-wahl-kopf{display:none}
.st-inhalt{display:flex;flex-direction:column;gap:10px}
.st-weiter{font:inherit;color:inherit;cursor:pointer;display:flex;align-items:center;gap:12px;text-align:left;padding:12px 14px;border-radius:18px;
  background:var(--bg2,#fffdf9);border:3px solid var(--k-gruen-tief,#4d8236);box-shadow:0 4px 0 var(--k-gruen-tief,#4d8236)}
.st-wappen{flex:none;width:56px;height:56px;display:grid;place-items:center}.st-wappen svg{width:100%;height:100%}
.st-wappen.klein{width:40px;height:40px}
.st-wtxt{flex:1;min-width:0;display:flex;flex-direction:column}.st-wtxt b{font-size:18px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.st-wtxt small{font-size:13px;color:var(--text3,#846d52)}
.st-los{flex:none;font-weight:700;padding:10px 14px;border-radius:12px;background:var(--k-gruen,#78bc61);color:var(--k-gruen-text,#10230a);border:2px solid var(--k-gruen-tief,#4d8236)}
.st-liste{display:flex;flex-direction:column;gap:8px}
.st-eintrag{font:inherit;color:inherit;cursor:pointer;display:flex;align-items:center;gap:12px;text-align:left;padding:11px 14px;border-radius:14px;
  background:var(--bg2,#fffdf9);border:2px solid var(--k-rand,#8b5a2b);box-shadow:0 3px 0 var(--k-rand,#8b5a2b)}
.st-eintrag > i:first-child{font-size:22px;color:var(--k-blau-tief,#2c7cb5)}.st-eintrag span{flex:1;display:flex;flex-direction:column}
.st-eintrag small{font-size:12px;color:var(--text3,#846d52)}.st-eintrag:disabled{opacity:.55;cursor:default}
.st-leiste{display:flex;align-items:center;gap:10px;margin-top:4px}.st-leiste h2{margin:0;font-size:22px}
.st-zurueck{font:inherit;cursor:pointer;width:42px;height:42px;border-radius:12px;background:var(--bg2,#fffdf9);color:var(--text,#2c3e50);border:2px solid var(--k-rand,#8b5a2b);
  box-shadow:0 3px 0 var(--k-rand,#8b5a2b);font-size:20px;display:grid;place-items:center}
.dfl-wahl.st-mit-zurueck{position:relative}.st-wahl-zurueck{position:absolute;top:14px;left:14px;z-index:2}
.st-platz{display:flex;flex-direction:column;gap:10px;padding:12px;border-radius:16px;background:var(--bg2,#fffdf9);border:2px solid var(--k-rand,#8b5a2b)}
.st-platz.aktiv{border-color:var(--k-gruen-tief,#4d8236);box-shadow:0 3px 0 var(--k-gruen-tief,#4d8236)}
.st-pkopf{display:flex;align-items:center;gap:10px}.st-pknoepfe{display:flex;gap:6px}
.st-platz.leer,.st-platz.gesperrt{flex-direction:row;align-items:center;gap:12px;border-style:dashed;background:transparent;font:inherit;color:inherit;text-align:left}
.st-platz.leer{cursor:pointer}.st-platz.leer i,.st-platz.gesperrt i{font-size:24px;color:var(--text3,#846d52)}
.st-platz.leer span,.st-platz.gesperrt span{display:flex;flex-direction:column}.st-platz.leer small,.st-platz.gesperrt small{color:var(--text3,#846d52);font-size:12px}
.st-platz.gesperrt{opacity:.7}
.st-knopf{font:inherit;font-weight:600;cursor:pointer;padding:8px 14px;border-radius:11px;border:2px solid var(--k-gruen-tief,#4d8236);background:var(--k-gruen,#78bc61);
  color:var(--k-gruen-text,#10230a);box-shadow:0 2px 0 var(--k-gruen-tief,#4d8236)}
.st-knopf:first-child{flex:1}
.st-knopf.zweit{background:var(--bg2,#fffdf9);color:var(--text,#2c3e50);border-color:var(--k-rand,#8b5a2b);box-shadow:0 2px 0 var(--k-rand,#8b5a2b);padding-inline:11px}
.st-knopf.rot{color:var(--red,#c0392b)}
.st-hinweis{margin:0;font-size:14px;padding:10px 12px;border-radius:12px;background:var(--bg3,#f6ead2);border:2px solid var(--k-linie,#e3c99a)}
.st-recht section{background:var(--bg2,#fffdf9);border:2px solid var(--k-rand,#8b5a2b);border-radius:16px;padding:12px 14px;display:flex;flex-direction:column;gap:8px}
.st-recht h3{margin:0;font-size:17px}.st-recht p{margin:0;font-size:14px;line-height:1.5}
.st-liz{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px;font-size:14px}
.st-liz li{display:flex;justify-content:space-between;gap:10px;border-bottom:1px dashed var(--k-linie,#e3c99a);padding-bottom:5px}.st-liz b{flex:none}
.st-spruch{font:inherit;color:var(--text,#2c3e50);cursor:pointer;min-height:44px;display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:left;
  padding:8px 12px;border-radius:14px;background:var(--bg2,#fffdf9);border:2px dashed var(--k-linie,#e3c99a);font-size:14px;font-weight:500}
.st-spruch small{font-size:12px;font-weight:400;color:var(--text3,#846d52)}
.st-fuss{margin:4px 0 0;text-align:center;font-size:12px;color:var(--text3,#846d52)}
.st-ov button:focus-visible{outline:3px solid var(--k-blau,#4aa3df);outline-offset:2px}`;
  document.head.appendChild(css);

  // ── Seitenstart ─────────────────────────────────────────────────────────
  const imTest = () => typeof navigator !== 'undefined' && navigator.webdriver && lsLies('dfl-start-test') !== 'an';
  // Nach dem Neuladen für ein neues Spiel (D135): gleich die Vereinswahl, auch im Testlauf; war schon ein Verein gewählt
  // (Sicherheitsnetz oben), wird er hier gewählt
  async function neueKarriere() {
    // D143: Vereinswechsel nach der Entlassung – keine Vereinswahl, der neue Verein steht fest
    if (window.DFL_NEUES_SPIEL.wechsel && window.DFLVereinswechsel) { benutzt = true; DFLVereinswechsel.fortsetzen(); return; }
    if (typeof window._obNew === 'function' && document.querySelector('#onboarding-overlay [onclick^="window._obNew"]')) window._obNew();
    else if (!document.getElementById('onboarding-overlay')) await window.showOnboarding();
    window._obBack = wahlZurueck;
    const v = window.DFL_NEUES_SPIEL.verein;
    if (v) setTimeout(() => {
      const b = [...document.querySelectorAll('#onboarding-overlay [data-dfl]')].find(x => x.getAttribute('title') === v);
      if (b) b.click();
    }, 50);
  }
  // D160 (Nutzer 2026-10-15: „ich würde mir wünschen, dass man am Anfang IMMER ins Hauptmenü kommt und den Spielstand entsprechend
  // lädt“): der Vorhang aus index.html (Startfarbe + Logo wie das Startbild der App) liegt vom ersten Bild an über allem; weg erst,
  // wenn das Hauptmenü bzw. die Vereinswahl samt Startbild gezeichnet ist (höchstens 1,5 s auf die Bilder warten). In der App
  // verschwindet damit auch das Startbild (Capacitor SplashScreen.hide) – dazwischen blitzt weder das Spiel noch eine leere Seite auf.
  function vorhangWeg(mitBild) {
    const weg = () => { try { if (window.dflVorhangWeg) window.dflVorhangWeg(); } catch (e) { /* Vorhang fehlt */ } };
    if (!mitBild) { weg(); return; }
    const K = window.DFLKulisse;
    const bild = K && K.laden ? Promise.race([Promise.resolve(K.laden()).catch(() => null), new Promise(r => setTimeout(r, 1500))]) : Promise.resolve();
    bild.then(() => requestAnimationFrame(() => requestAnimationFrame(weg)));
  }
  function beimStart() {
    if (frisch()) { Promise.resolve(neueKarriere()).catch(e => console.warn('[DFL-Start] Vereinswahl', e)).then(() => vorhangWeg(true)); return; }
    if (imTest()) { vorhangWeg(false); return; }
    oeffnen('start').catch(e => console.warn('[DFL-Start] Hauptmenü', e)).then(() => vorhangWeg(true));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(beimStart, 0));
  else setTimeout(beimStart, 0);

  window.DFLStart = { zeigen: () => oeffnen('start'), staende: () => oeffnen('staende', true), recht: () => oeffnen('recht', true), plaetze, gespeichertText,
    jetztSpeichern, neuesSpiel, IMPRESSUM };
  console.log('[DFL-Start v1] aktiv — Startbildschirm, ' + plaetze() + ' Spielstände, Jetzt speichern, Impressum und Datenschutz, neues Spiel frisch geladen (D135)');
})();
