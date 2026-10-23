/* ═══════════════════════════════════════════════════════════════════════════
   DFL-TESTKIT  ·  v1   (Testphase mit Freunden, 2026-10-13)
   ───────────────────────────────────────────────────────────────────────────
     · Version + „Was ist neu“: einmal je Version beim Start, nur nach einem Update – beim allerersten Start nie
       (Nutzer 2026-10-17); nicht über einem Entscheidungsfenster, nicht während „Simulieren bis …“
     · Fehlerprotokoll: window.onerror, unhandledrejection, console.error →
       die letzten 30 Einträge im localStorage ('dfl-fehler'), gleiche Folgen
       werden gezählt statt wiederholt
     · Nutzung: Sitzungen, Spieltage (Kalendertage), eigene Spiele
     · „Feedback senden“ (Mehr-Blatt): Bewertung 1–5, Text, Häkchen „Fehler
       und Spielstand-Infos anhängen“ → Teilen-Menü des Geräts (Web Share);
       ohne Teilen: in die Zwischenablage und als markierbarer Text
   Kein Netz, keine Adressen im Code: die Tester schicken den Text selbst
   (Discord/WhatsApp). Messenger und Ziel wählt der Tester im Teilen-Menü.
   API: DFLTestkit.version · .feedback() · .neu() · .fehler() · .bericht()
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const VERSION = '0.9.21';
  const STAND = '2026-10-22';
  const BEZEICHNUNG = 'Testphase 1';
  // Was ist neu: je Version wenige Punkte, Inhalt statt Erklärung
  const NEU = [
    'Wer nicht spielt, verliert: Junge auf der Bank büßen Potenzial ein, ab 29 baut die Bank schnell ab, Spitzenspieler ab 30 verlieren Tempo',
    'Wer viel spielt und gut ist, kann sein Potenzial steigern – im passenden Spielstil entwickeln sich Spieler schneller',
    'Draft: Jeder Jahrgang ist anders – mal mit Wunderkindern (17–19, um 80), dazu fertige 21-Jährige; 99er Potenzial ist selten',
    'Top-Picks sind beim Handel deutlich mehr wert – Runtertraden lohnt sich jetzt',
    'Stadien zum Start näher an der Stärke der Teams, die KI baut ihr Stadion aus, Fanshop-Stufen flacher',
    'Pro Bowl und Team der Woche: Wappen am Gesicht',
    'Spieler des Monats: Offensiv und Defensiv je Conference plus Rookie, +2 Stärke für 4 Spiele – das Team der Woche bleibt wöchentlich',
    'Sonderkarte in der Aufstellung: Spieler mit Bonus tragen Rahmen und Farbe ihrer Karte und ein +2',
    'Achillessehnenriss: 7 bis 9 Monate mit Reha',
    'Pro Bowl neu: beide Aufstellungen nebeneinander auf dem Feld, Ergebnis und Bank – keine lange Liste mehr',
    'Tabelle: Die Pfeile für die Veränderung stehen jetzt neben dem Platz',
    'Team der Woche: Deine Spieler stehen auf der Position, auf der sie gespielt haben',
    'Draft-Pack: Am Ende gibt es eine Note für deinen ganzen Draft',
    'Kreuzband- und Syndesmosebandriss: 9 bis 12 Monate Pause – die Wunderheilung per Video hilft sofort',
    'Trade-Anfragen gelten höchstens bis zur Trade-Deadline',
    'Verträge: Wer nur wegen des Kader-Minimums bleibt, bekommt vom Front Office einen Einjahresvertrag statt ewig „abgelaufen“',
    'Platz im App-Kopf und in der Liga-Ansicht stimmen jetzt überein (gleiche Tiebreak-Regeln)',
    'Neue Wappen: Die meisten Teams tragen jetzt eigene Details – Kronen, Sterne, Streifen, Eckfelder und das Gründungsjahr',
    'Anlagen in neuer Optik: Stadion, Trainingsgelände, Fanshop, Scouting und Medizin stehen jetzt mitten im Gelände',
    'Kader: Aufstellung · Spieler · Training – nächster Gegner und Ausfälle mit „Tauschen“, Spielstil direkt über dem Feld',
    'Spieler als eine Liste mit Filtern Alle, Verträge, Verletzt – Training mit Talenten und Fortschritt jetzt im Kader',
    'Mehr aufgeräumt: Dunkelmodus und Ticker mit einem Tipp, Extras als Kacheln, alles Weitere unter Optionen',
    'Draft-Pack: neue Sprüche vom Chefscout – mit Kombine-Werten, Stärken, Merkliste und Trade-Picks',
    'Draft: oben siehst du, wer gerade dran ist, wie viele Picks noch bis zu dir fehlen und die letzten drei Picks',
    'Postfach: höchstens drei Einträge, dazu ein Knopf zum Leeren',
    'Ereignisse zeigen die beteiligten Spieler mit Gesicht',
    'Rückfragen erscheinen im Spiel-Look statt im Systemfenster',
    'Rookie-Pack nach dem Draft: Pack aufreißen, deine Picks vom letzten zum ersten aufdecken – mit Note und Satz deines Chefscouts',
    'Rookie-Karten: Erstrunden-Pick, Zweitrunden-Pick und Rookie – deine Rookies tragen sie die ganze erste Saison',
    'Ab Saison 10 werden die besten KI-Teams klüger: bessere Drafts, gezieltere Verpflichtungen, höhere Ziele',
    'Runde Stadien: Jedes dritte Team spielt in einer ovalen Arena – oder du wählst die Form selbst (Front Office → Stadion)',
    'Trikots neu: jedes Team mit eigenem Muster, Wappen auf der Brust und Auswärtstrikot – bei gleicher Farbe spielt der Gast auswärts. Front Office → Trikots',
    'Stadionname: Bei der Wahl siehst du dein echtes Stadion',
    'Pokalvitrine: jeder Titel als eigener Pokal (DKL-Meister, Conference, Division, Spieler der Saison) – im Office und unter Mehr → Pokalvitrine',
    'Ausbau-Bilder für die Jugendakademie, Maskottchen läuft flüssiger',
    'Zeitmaschine: Playoff-Spiel verloren? Einmal je Playoffs die Uhr zurückdrehen und neu anpfeifen (Video, mit Pro 10 Winpunkte)',
    'Ticker: eigenes Aussehen für Conference-Finale und DKL-Finale, Spielfeld wieder nur mit Ball und Torschüssen',
    'Playoffs: Wildcard- und Divisional-Runde mit Hin- und Rückspiel als englische Woche – Gesamtergebnis zählt, Seed 1 ruht in Runde 1',
    'Bye Weeks: jedes Team hat 5 spielfreie Wochen zu eigenen Zeiten, keine Länderspielpausen mehr',
    'Spieler und Team der Woche: Offensiv- und Defensivspieler je Conference, Rookie und Team der Woche – mit Sonderkarte und Stärke-Bonus',
    'Neue Kartenoptik für Sonderkarten',
    'Office: Seed in der Conference mit Farbe für die Playoff-Lage',
    'Spieler mit einem Knopf zum Trade anbieten',
    'Tag der Verträge: Der Chefscout sagt, wen er halten würde',
    'Lange Verletzung: Diagnose und traditionelle chinesische Wunderheilung',
    'Begrüßung passend zu deinem Werdegang als Trainer',
    'Rohdiamanten: seltene Talente, die nur dein Scout erkennt',
    'Saisonabschluss mit Statistik und drei Wochen Off-Season vor dem Draft',
    'Wappen neu poliert, keine Monogramme mehr',
    'Karten: Namen mit Umlauten (Ö, Ü) werden nicht mehr oben abgeschnitten'
  ];
  const MAX_FEHLER = 30;
  const K_FEHLER = 'dfl-fehler', K_NUTZUNG = 'dfl-nutzung', K_GESEHEN = 'dfl-version-gesehen';

  const lies = (k, std) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : std; } catch (e) { return std; } };
  const schreib = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* voller oder gesperrter Speicher */ } };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const dfl = () => typeof CLUB !== 'undefined' && CLUB && CLUB.dfl && CLUB.dfl.aktiv;
  const simLaeuft = () => !!(window.DFLSimulieren && typeof DFLSimulieren.aktiv === 'function' && DFLSimulieren.aktiv());
  const jetzt = () => new Date().toISOString().slice(0, 16).replace('T', ' ');

  // ── Spielort für Einträge ─────────────────────────────────────────────────
  function ort() {
    try {
      if (typeof LEAGUE === 'undefined' || !LEAGUE) return '';
      return `S${LEAGUE.season} KW${LEAGUE.week || '?'} ST${LEAGUE.matchday || 0}`;
    } catch (e) { return ''; }
  }

  // ── Fehlerprotokoll ───────────────────────────────────────────────────────
  let schreibtGerade = false;
  function fehlerMerken(text, quelle) {
    if (schreibtGerade) return;
    schreibtGerade = true;
    try {
      const msg = String(text || 'Unbekannter Fehler').replace(/\s+/g, ' ').slice(0, 240);
      const liste = lies(K_FEHLER, []);
      const letzter = liste[liste.length - 1];
      if (letzter && letzter.m === msg && letzter.q === (quelle || '')) { letzter.n = (letzter.n || 1) + 1; letzter.t = jetzt(); }
      else liste.push({ t: jetzt(), m: msg, q: quelle || '', o: ort(), v: VERSION, n: 1 });
      while (liste.length > MAX_FEHLER) liste.shift();
      schreib(K_FEHLER, liste);
    } catch (e) { /* Protokoll darf nie selbst stören */ }
    schreibtGerade = false;
  }
  window.addEventListener('error', ev => {
    const q = ev.filename ? `${String(ev.filename).split('/').pop()}:${ev.lineno || 0}` : '';
    fehlerMerken(ev.message || (ev.error && ev.error.message), q);
  });
  window.addEventListener('unhandledrejection', ev => {
    const r = ev.reason;
    fehlerMerken('Promise: ' + (r && r.message ? r.message : String(r)), '');
  });
  {
    const _orig = console.error;
    console.error = function () {
      try { fehlerMerken([...arguments].map(a => (a && a.message) ? a.message : String(a)).join(' '), 'console'); } catch (e) { /* weiter */ }
      return _orig.apply(this, arguments);
    };
  }

  // ── Nutzung ───────────────────────────────────────────────────────────────
  function nutzung() {
    const n = lies(K_NUTZUNG, { sitzungen: 0, tage: [], spiele: 0, erstes: null });
    if (!Array.isArray(n.tage)) n.tage = [];
    return n;
  }
  {
    const n = nutzung(), heute = new Date().toISOString().slice(0, 10);
    n.sitzungen++;
    if (n.tage.indexOf(heute) < 0) n.tage.push(heute);
    if (n.tage.length > 120) n.tage = n.tage.slice(-120);
    if (!n.erstes) n.erstes = heute;
    schreib(K_NUTZUNG, n);
  }
  if (typeof window.postMatchContinue === 'function') {
    const _orig = window.postMatchContinue;
    window.postMatchContinue = function () {
      try { const n = nutzung(); n.spiele++; schreib(K_NUTZUNG, n); } catch (e) { /* Zähler */ }
      return _orig.apply(this, arguments);
    };
  }

  // ── Bericht für das Feedback ──────────────────────────────────────────────
  function geraet() {
    const ua = navigator.userAgent || '';
    const os = (ua.match(/Android [\d.]+/) || ua.match(/iPhone OS [\d_]+/) || ua.match(/Windows NT [\d.]+/) || ua.match(/Mac OS X [\d_]+/) || [''])[0].replace(/_/g, '.');
    const br = (ua.match(/(Chrome|CriOS|Firefox|FxiOS|Version)\/[\d]+/) || [''])[0].replace('Version', 'Safari');
    const app = document.documentElement.classList.contains('dfl-app') ? ' · App' : '';
    return `${os || 'unbekannt'} · ${br || 'Browser'} · ${window.innerWidth}×${window.innerHeight}${app}`;
  }
  function spielInfo() {
    if (!dfl()) return 'kein Spielstand geladen';
    try {
      const platz = (window.DFLSpiel && typeof DFLSpiel.platz === 'function') ? ` · Platz ${DFLSpiel.platz()}` : '';
      const L = window.DFLSpiel && DFLSpiel.liga ? DFLSpiel.liga() : null, j = L && L.saisonJahr;
      const saison = j ? `${j}/${String(j + 1).slice(2)}` : LEAGUE.season;
      return `${CLUB.name} · Saison ${saison} (${LEAGUE.season}.) · KW ${LEAGUE.week} · Spieltag ${LEAGUE.matchday || 0}${platz} · Kader ${SQUAD.length}`;
    } catch (e) { return 'Spielstand nicht lesbar'; }
  }
  function bericht(opt) {
    opt = opt || {};
    const n = nutzung(), f = lies(K_FEHLER, []);
    const zeilen = [`Kickdraft Test-Feedback · Version ${VERSION} (${BEZEICHNUNG}, ${STAND})`];
    if (opt.sterne) zeilen.push(`Bewertung: ${opt.sterne} von 5`);
    if (opt.text) zeilen.push('', opt.text.trim());
    if (opt.anhang !== false) {
      zeilen.push('', '--- Spiel ---', spielInfo(), `Gerät: ${geraet()}`,
        `Nutzung: ${n.sitzungen} Sitzungen an ${n.tage.length} Tagen seit ${n.erstes || '–'}, ${n.spiele} eigene Spiele`);
      if (window.DFLNutzung && typeof DFLNutzung.bericht === 'function') { try { zeilen.push(String(DFLNutzung.bericht())); } catch (e) { /* optional */ } }
      zeilen.push('', `--- Fehler (${f.length}) ---`);
      if (!f.length) zeilen.push('keine');
      f.slice(-12).forEach(x => zeilen.push(`${x.t} ${x.o || ''} ${x.n > 1 ? `(${x.n}×) ` : ''}${x.m}${x.q ? ` [${x.q}]` : ''}`));
    }
    return zeilen.join('\n');
  }

  // ── Blätter ───────────────────────────────────────────────────────────────
  function blattBox() { return document.querySelector('#app-blatt .app-blatt-box'); }
  function blattZu() {
    const b = document.getElementById('app-blatt'); if (b) b.classList.remove('auf');
    const s = document.getElementById('app-sheet');
    if (!(s && s.classList.contains('auf'))) document.body.classList.remove('app-gesperrt');
  }
  // Ein Klick-Empfänger je Öffnen (box.onclick wird ersetzt, nicht gestapelt)
  function blattAuf(html, beiKlick) {
    const box = blattBox();
    if (!box) return false;
    box.innerHTML = '<div class="app-griff"></div><button class="app-blatt-zu" type="button" aria-label="Schließen"><i class="ti ti-x" aria-hidden="true"></i></button>' + html;
    box.onclick = ev => { if (ev.target.closest('.app-blatt-zu')) blattZu(); else if (beiKlick) beiKlick(ev, box); };
    document.getElementById('app-blatt').classList.add('auf'); document.body.classList.add('app-gesperrt');
    return true;
  }
  const stern = (an, i) => `<button type="button" class="tk-stern${an ? ' an' : ''}" data-stern="${i}" aria-label="${i} von 5"><i class="ti ${an ? 'ti-star-filled' : 'ti-star'}" aria-hidden="true"></i></button>`;

  function feedback() {
    let sterne = 0;
    const html = `<div class="tk-blatt">
      <div class="app-sheet-titel">Feedback senden</div>
      <div class="tk-sterne" role="group" aria-label="Bewertung">${[1, 2, 3, 4, 5].map(i => stern(false, i)).join('')}</div>
      <label class="tk-label" for="tk-text">Was ist dir aufgefallen?</label>
      <textarea id="tk-text" class="tk-text" rows="5" placeholder="Fehler, Wünsche, was Spaß macht …"></textarea>
      <label class="tk-haken"><input type="checkbox" id="tk-anhang" checked> Fehler und Spielstand-Infos anhängen</label>
      <div class="app-blatt-aktionen">
        <button type="button" class="app-knopf haupt" data-tk="senden"><i class="ti ti-send" aria-hidden="true"></i>Senden</button>
      </div>
      <p class="tk-klein">Version ${VERSION} · ${lies(K_FEHLER, []).length} Fehler im Protokoll</p>
      <div class="tk-ausweich" hidden><textarea class="tk-text" rows="8" readonly></textarea><p class="tk-klein">Kopiert. Füge den Text im Chat ein oder schick ihn an <a href="mailto:kickdraft.spiel@gmail.com">kickdraft.spiel@gmail.com</a>.</p></div>
    </div>`;
    const klick = async (ev, box) => {
      const s = ev.target.closest('[data-stern]');
      if (s) {
        sterne = +s.getAttribute('data-stern');
        box.querySelector('.tk-sterne').innerHTML = [1, 2, 3, 4, 5].map(i => stern(i <= sterne, i)).join('');
        return;
      }
      if (!ev.target.closest('[data-tk="senden"]')) return;
      const text = bericht({ sterne, text: box.querySelector('#tk-text').value, anhang: box.querySelector('#tk-anhang').checked });
      if (navigator.share) {
        try { await navigator.share({ title: 'Kickdraft Feedback', text }); blattZu(); if (typeof showToast === 'function') showToast('Danke für dein Feedback!', 'success'); return; }
        catch (e) { if (e && e.name === 'AbortError') return; }
      }
      const aus = box.querySelector('.tk-ausweich'), ta = aus.querySelector('textarea');
      ta.value = text; aus.hidden = false; ta.focus(); ta.select();
      try { if (navigator.clipboard) await navigator.clipboard.writeText(text); } catch (e) { /* markierter Text reicht */ }
    };
    if (!blattAuf(html, klick)) console.log(bericht());      // ohne Handy-Oberfläche: Bericht in die Konsole
  }

  function neu() {
    const html = `<div class="tk-blatt">
      <div class="app-sheet-titel">Was ist neu · ${VERSION}</div>
      <ul class="tk-neu">${NEU.map(x => `<li><i class="ti ti-circle-check" aria-hidden="true"></i><span>${esc(x)}</span></li>`).join('')}</ul>
      <div class="app-blatt-aktionen"><button type="button" class="app-knopf haupt app-blatt-zu-knopf" data-tk="ok">Los geht's</button></div>
    </div>`;
    if (!blattAuf(html, ev => { if (ev.target.closest('[data-tk="ok"]')) blattZu(); })) return false;
    schreib(K_GESEHEN, VERSION);
    return true;
  }
  function neuBeimStart() {
    const gesehen = lies(K_GESEHEN, null);
    if (gesehen === VERSION) return;
    // Nutzer 2026-10-17: „Was ist neu“ nur nach einem Update – wer zum ersten Mal spielt, kennt nichts Altes
    if (gesehen == null) { schreib(K_GESEHEN, VERSION); return; }
    if (navigator.webdriver) return;                       // automatische Tests (Bot, Nutzer-Test) nicht mit dem Blatt aufhalten
    let versuche = 0;
    const t = setInterval(() => {
      versuche++;
      const frei = dfl() && !simLaeuft() && !document.querySelector('.exp-overlay, .sw-briefing, #app-blatt.auf, #onboarding-overlay:not([style*="none"])');
      if (frei && blattBox()) { clearInterval(t); neu(); }
      else if (versuche > 120) clearInterval(t);            // nach 2 Minuten aufgeben, nächster Start zeigt es
    }, 1000);
  }

  // ── Eintrag im Mehr-Blatt ─────────────────────────────────────────────────
  function eintragEinhaengen() {
    const box = document.querySelector('#app-sheet .app-sheet-box');
    if (!box || box.querySelector('.tk-eintrag')) return !!box;
    const f = lies(K_FEHLER, []).length;
    box.insertAdjacentHTML('beforeend', `<button class="app-eintrag tk-eintrag" type="button"><i class="ti ti-message-report" aria-hidden="true"></i>
      <span class="app-eintrag-txt"><b>Feedback senden</b><small>Version ${VERSION}${f ? ` · ${f} Fehler` : ''}</small></span><i class="ti ti-chevron-right app-pfeil" aria-hidden="true"></i></button>`);
    box.querySelector('.tk-eintrag').addEventListener('click', ev => {
      ev.stopPropagation();                                   // das Mehr-Blatt kennt nur seine eigenen Einträge
      const s = document.getElementById('app-sheet'); if (s) s.classList.remove('auf');
      feedback();
    });
    return true;
  }
  if (!eintragEinhaengen()) {
    let n = 0;
    const t = setInterval(() => { if (eintragEinhaengen() || ++n > 60) clearInterval(t); }, 1000);
  }

  // ── Aussehen (hier statt eigener CSS-Datei: Tokens des Kenney-Stils, Tag und Nacht) ──
  {
    const st = document.createElement('style');
    st.id = 'dfl-testkit-css';
    st.textContent = `
      .tk-blatt{display:grid;gap:12px}
      .tk-sterne{display:flex;gap:6px;justify-content:center}
      .tk-stern{font:inherit;background:none;border:0;padding:4px;cursor:pointer;color:var(--text3,#8a7f6c);font-size:30px;line-height:1}
      .tk-stern.an{color:#d6a51c}
      .tk-label{font-weight:700;font-size:14px}
      .tk-text{width:100%;box-sizing:border-box;font:inherit;font-size:15px;padding:10px;border:2px solid var(--k-rand,#b98a55);border-radius:10px;background:var(--bg2);color:var(--text);resize:vertical}
      .tk-haken{display:flex;gap:8px;align-items:center;font-size:14px}
      .tk-klein{margin:0;font-size:12px;color:var(--text3,#8a7f6c)}
      .tk-ausweich{display:grid;gap:6px}
      .tk-neu{list-style:none;margin:0;padding:0;display:grid;gap:8px}
      .tk-neu li{display:grid;grid-template-columns:22px 1fr;gap:8px;align-items:start;font-size:15px}
      .tk-neu i{color:var(--k-gut-fg,#3f8a33);font-size:20px}`;
    document.head.appendChild(st);
  }

  window.DFLTestkit = { version: VERSION, stand: STAND, feedback, neu, bericht,
    fehler: () => lies(K_FEHLER, []), fehlerLeeren: () => schreib(K_FEHLER, []), nutzung, fehlerMerken };
  neuBeimStart();
  console.log(`[DFL-Testkit v1] aktiv — Version ${VERSION}, Fehlerprotokoll, Feedback über das Teilen-Menü, Was ist neu`);
})();
