/* ===== intro_patch.js =====
   VORSTANDSEINFÜHRUNG v1 — der Empfang beim neuen Verein
   ─────────────────────────────────────────────────────────────────────────────
   Bisher gab es nach der Vereinswahl KEINE inhaltliche Einführung: `showOnboarding`
   ist reine Spielstandsverwaltung (Liga wählen, Verein wählen, los). Wer zum
   ersten Mal spielt, stand danach im Kader-Tab und musste sich Philosophie,
   Vorstandsvertrauen, Rücklagenziel und Ausbaustufen selbst zusammenreimen.

   Dieses Modul legt einen Empfang dazwischen: Der Vorstandsvorsitzende führt in
   fünf Bildern durch das, was den Verein ausmacht — und alle Zahlen darin sind
   ECHT aus dem frisch erzeugten Spielstand gelesen (Liga, Kaderstärke, Budget,
   Stadion, Vertrauen), nicht erfunden.

   Lädt VOR init_bootstrap.js.
   ============================================================================= */
(function () {
  'use strict';

  function euro(v) {
    if (typeof formatEuro === 'function') return formatEuro(Math.round(v || 0));
    return '€' + Math.round((v || 0) / 1000) + 'k';
  }
  function zahl(n) { return (n || 0).toLocaleString('de-DE'); }
  function esc(s) { return String(s == null ? '' : s).replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c])); }

  // Der Vorsitzende bekommt einen Namen — aus dem Vereinsnamen abgeleitet, damit
  // er über die Karriere hinweg derselbe bleibt (deterministisch, kein Zufall).
  const VORNAMEN = ['Hartmut', 'Reinhard', 'Wolfgang', 'Dieter', 'Klaus-Peter', 'Bernd', 'Gerhard', 'Manfred'];
  const NACHNAMEN = ['Bräutigam', 'Kowalski', 'Sonnenberg', 'Retzlaff', 'Hohmann', 'Wendland', 'Grothe', 'Steinbach'];
  function vorsitzender() {
    const s = (typeof CLUB !== 'undefined' && CLUB.name) || 'FC';
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return VORNAMEN[h % VORNAMEN.length] + ' ' + NACHNAMEN[(h >>> 8) % NACHNAMEN.length];
  }

  function lage() {
    const L = {};
    try {
      const grp = findFcmGroup(LEAGUE);
      L.liga = (CLUB.leagueName === 'DFL' ? 'DKL' : CLUB.leagueName) || (grp && grp.group && grp.group.name) || 'Liga';
      L.tier = grp ? grp.tierKey : 'regionalliga';
      L.teams = grp ? grp.group.teams.length : 18;
      // Wo steht der eigene Kader im Vergleich zur Liga?
      const alle = grp ? grp.group.teams.map(function (t) { return t.ovr || 0; }).sort(function (a, b) { return b - a; }) : [];
      const mich = grp ? (grp.group.teams.filter(function (t) { return t.id === 'fcm'; })[0] || {}).ovr || 0 : 0;
      L.rang = alle.indexOf(mich) + 1;
      L.ovr = mich;
    } catch (e) { L.liga = 'Liga'; L.tier = 'regionalliga'; L.teams = 18; L.rang = 9; L.ovr = 0; }
    L.budget = (typeof CLUB !== 'undefined' && CLUB.budget) || 0;
    L.lohn = (typeof CLUB !== 'undefined' && CLUB.wageCap) || 0;
    L.kapazitaet = (typeof stadiumCapacityForLevel === 'function' && CLUB.facilities)
                   ? stadiumCapacityForLevel(CLUB.facilities.stadium) : (CLUB.stadiumCapacity || 0);
    L.stadion = (CLUB.facilities && CLUB.facilities.stadium) || 1;
    L.akademie = (CLUB.facilities && CLUB.facilities.youth) || 1;
    L.deckel = 10;
    try {
      const e = EXP.state();
      L.vertrauen = e.boardSatisfaction != null ? e.boardSatisfaction : 60;
      L.fans = e.fanSatisfaction != null ? e.fanSatisfaction : 50;
    } catch (e) { L.vertrauen = 60; L.fans = 50; }
    L.kader = (typeof SQUAD !== 'undefined' ? SQUAD.filter(function (p) { return p && !p.onLoanAt; }).length : 0);
    return L;
  }

  const LIGA_WORT = {
    regionalliga: 'die vierte Liga', liga3: 'die dritte Liga',
    bundesliga2: 'die zweite Bundesliga', bundesliga: 'die Bundesliga'
  };
  const ZIEL_WORT = {
    regionalliga: 'Der Sprung in die 3. Liga',
    liga3: 'Der Sprung in die 2. Bundesliga',
    bundesliga2: 'Der Sprung ins Oberhaus',
    bundesliga: 'Ein Platz im Europapokal'
  };

  function bilder(L) {
    const chef = vorsitzender();
    // DFL (dfl_liga_patch.js): geschlossene Liga mit 32 Franchises, Playoffs, Draft statt Nachwuchs
    const dfl = typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.dfl;
    const dflF = dfl && window.DFLSpiel ? window.DFLSpiel.franchise('fcm') : null;
    const dflKonf = dflF ? window.DFLSpiel.KONF[dflF.conference] : '';
    const einordnung = L.rang <= 3 ? 'Ihr Kader gehört zu den stärksten der Liga — man erwartet hier oben etwas.'
                     : L.rang <= Math.ceil(L.teams / 2) ? 'Ihr Kader liegt im oberen Mittelfeld. Nach oben ist Luft, nach unten auch.'
                     : 'Ihr Kader gehört nicht zu den stärksten. Das ist ehrlich gesagt kein Nachteil — es erwartet niemand Wunder.';
    // DFL: Der Eigentümer begrüßt (dfl_eigentuemer_patch.js), kein Vorstand mit Philosophie und Vorgaben
    const eig = dfl && window.DFLEigner ? window.DFLEigner.stand() : null;
    if (eig) {
      // Kurz erklärt (Nutzer 2026-10-09: „Text reduzieren, höchstens ein kleines Tutorial für die, die NFL und Cap Hit nicht kennen“):
      // vier Karten mit je ein, zwei Sätzen statt vier Seiten Eigentümer-Rede
      const pr = window.DFLEigner.CFG.profile[eig.profil];
      const pct = x => Math.round(x * 100) + ' %';
      const cap = window.DFLKader && window.DFLKader.cap ? window.DFLKader.cap() : 120e6;
      const mio = x => (Math.round(x / 1e5) / 10).toLocaleString('de-DE') + ' Mio €';
      const kurz = L.rang <= 3 ? 'Dein Kader gehört zu den stärksten.' : L.rang <= Math.ceil(L.teams / 2) ? 'Dein Kader liegt im oberen Mittelfeld.'
        : 'Dein Kader gehört nicht zu den stärksten – Wunder erwartet niemand.';
      const handy = document.body && document.body.classList.contains('ist-handy');
      return [
        { kopf: 'Willkommen bei ' + esc(CLUB.name),
          bild: '🤝',
          rolle: esc(eig.name) + ' · Eigentümer (' + esc(pr.name) + ')',
          text: '<p>' + (dflF ? 'Division <b>' + esc(dflF.division) + '</b>, Conference ' + esc(dflKonf) + '. ' : '') + kurz + '</p>' +
                '<p>Dein Eigentümer misst dich an <b>Gewinn ' + pct(pr.g) + '</b>, <b>Erfolg ' + pct(pr.e) + '</b> und <b>Fans ' + pct(pr.f) + '</b>. ' +
                'Drei verärgerte Saisons in Folge – dann ist Schluss.</p>' },
        { kopf: 'Liga wie in der NFL',
          bild: '🏆',
          rolle: 'So läuft die Saison',
          text: '<p>32 Franchises, <b>kein Abstieg</b>. Nach 26 Spieltagen spielen <b>14 Teams die Playoffs</b>: je Conference die vier Division-Sieger und drei Wildcards.</p>' },
        { kopf: 'Salary Cap',
          bild: '💰',
          rolle: 'Die wichtigste Regel',
          text: '<p>Alle Cap Hits zusammen dürfen <b>' + mio(cap) + '</b> nicht übersteigen.</p>' +
                '<p><b>Cap Hit</b> = Gehalt + Handgeld je Vertragsjahr. Wer entlassen wird, kostet sein restliches Handgeld sofort als <b>Dead Cap</b>.</p>' },
        { kopf: 'Kader bauen',
          bild: '🔁',
          rolle: 'Draft · Trades · Free Agency',
          text: '<p>Talente kommen nur über den <b>Draft</b> – die Schwächsten wählen zuerst. Sonst wechseln Spieler per <b>Trade</b> oder als <b>Free Agent</b>; Ablösen gibt es nicht.</p>' +
                (handy ? '<p>Der grüne Knopf unten führt dich durch die Saison.</p>' : '') }
      ];
    }
    return [
      { kopf: 'Willkommen bei ' + esc(CLUB.name),
        bild: '🤝',
        rolle: chef + ' · Vorstandsvorsitzender',
        text: '<p>Schön, dass Sie da sind. Ich mache es kurz, denn draußen wartet Arbeit.</p>' +
              (dflF ? '<p>Wir spielen in der <b>Deutschen Kickdraft Liga</b> — 32 Franchises, Conference ' + esc(dflKonf) + ', Division <b>' + esc(dflF.division) + '</b>. '
                    : '<p>Wir spielen in <b>' + esc(L.liga) + '</b> — ' + LIGA_WORT[L.tier] + ', ' + L.teams + ' Mannschaften. ') +
              'Sie übernehmen einen Kader von <b>' + L.kader + ' Spielern</b>. ' + einordnung + '</p>' +
              '<p>Was wir von Ihnen erwarten, sage ich Ihnen jetzt. Danach lasse ich Sie in Ruhe arbeiten.</p>' },

      { kopf: 'Das Vertrauen des Vorstands',
        bild: '📊',
        rolle: 'Die wichtigste Zahl für Sie',
        text: '<p>Sie starten mit einem Vertrauensvorschuss von <b>' + L.vertrauen + ' von 100</b>. Diese Zahl ist Ihr Arbeitsplatz.</p>' +
              '<p>Sie steigt, wenn Sie Ihr Tabellenziel erreichen, solide wirtschaften und den Verein weiterbauen. ' +
              'Sie fällt bei verpassten Zielen, roten Zahlen und gebrochenen Versprechen.</p>' +
              '<p style="color:#a8271b"><b>Fällt sie unter 20, trennen wir uns von Ihnen.</b> Das ist keine Drohung, ' +
              'sondern die Regel, nach der auch ich gemessen werde.</p>' },

      { kopf: 'Ihr Kurs — und was er kostet',
        bild: '🧭',
        rolle: 'Vereinsphilosophie',
        text: '<p>Gleich nach diesem Gespräch legen Sie eine <b>Philosophie</b> fest: Setzen wir auf die Jugend? ' +
              'Kaufen wir zu? Sparen wir? Bewahren wir, was diesen Verein ausmacht?</p>' +
              '<p>Diese Wahl bleibt bestehen — nicht nur eine Saison. Sie bestimmt, welche Sponsoren zu uns passen, ' +
              'was der Vorstand von Ihnen verlangt und woran Sie am Saisonende gemessen werden.</p>' +
              '<p>Wählen Sie mit Bedacht. Wer seinen eigenen Kurs verrät, verliert hier schneller das Vertrauen ' +
              'als durch jede Niederlage.</p>' },

      { kopf: 'Drei Vorgaben, jede Saison',
        bild: '📋',
        rolle: 'Wonach Sie bewertet werden',
        text: '<p>Neben dem Tabellenplatz gibt es drei Vorgaben, die jede Saison neu berechnet werden:</p>' +
              '<p><b>1. Rücklage.</b> Am Saisonende sollen 30 % des Transferbudgets übrig sein. ' +
              'Aktuell verfügen Sie über <b>' + euro(L.budget) + '</b>.<br>' +
              '<b>2. Gehaltsdisziplin.</b> Die Wochengehälter bleiben unter der Grenze — derzeit rund <b>' + euro(L.lohn) + ' pro Woche</b>.<br>' +
              (dfl ? '<b>3. Ausbau.</b> Alle zwei Jahre erwarten wir eine neue Stufe an Stadion, Trainingszentrum oder Scouting.</p>'
                   : '<b>3. Ausbau.</b> Alle zwei Jahre erwarten wir eine neue Stufe an Stadion oder Akademie.</p>') +
              '<p>Alle drei zusammen können Ihnen bis zu 10 Punkte Vertrauen bringen — oder 20 kosten. ' +
              'Der sportliche Erfolg bleibt aber der Hauptmaßstab. Gesundwirtschaften können Sie sich hier nicht.</p>' },

      dfl ? {
        kopf: 'Der Weg zum Titel',
        bild: '🏟️',
        rolle: 'Wohin die Reise geht',
        text: '<p>Unser Stadion fasst <b>' + zahl(L.kapazitaet) + ' Plätze</b> (Ausbaustufe ' + L.stadion + ').</p>' +
              '<p>In der DKL gibt es <b>keinen Auf- und Abstieg</b>. 26 Spieltage, dann spielen 14 Teams in den Playoffs um den Titel: ' +
              'je Conference die vier Division-Sieger und drei Wildcards. Das Finale findet jedes Jahr in einer anderen Stadt statt.</p>' +
              '<p>Eine Jugendakademie haben wir nicht. Neue Spieler kommen über den <b>Draft</b>, die Free Agency und Trades – ' +
              'und alle arbeiten unter demselben <b>Salary Cap</b>.</p>' +
              '<p style="margin-top:14px"><b>Viel Erfolg. Wir sehen uns nach dem ersten Spieltag.</b></p>' } :
      { kopf: ZIEL_WORT[L.tier],
        bild: '🏟️',
        rolle: 'Wohin die Reise geht',
        text: '<p>Unser Stadion fasst <b>' + zahl(L.kapazitaet) + ' Plätze</b> (Ausbaustufe ' + L.stadion + '), die Akademie steht auf Stufe ' + L.akademie + '.</p>' +
              (L.deckel ? '<p>Größer bauen dürfen wir vorerst nicht: ' + esc(L.liga) + ' trägt höchstens Stufe <b>' + L.deckel + '</b>. ' +
                          'Mit jedem Aufstieg gibt der Verband — und dieser Vorstand — mehr frei.</p>' : '') +
              '<p>Das ist der Weg: <b>aufsteigen, ausbauen, wieder aufsteigen.</b> Jede Liga höher bedeutet mehr Fernsehgeld, ' +
              'stärkere Sponsoren, bessere Spieler — und ein Stadion, das Sie endlich füllen dürfen.</p>' +
              '<p style="margin-top:14px"><b>Viel Erfolg. Wir sehen uns nach dem ersten Spieltag.</b></p>' }
    ];
  }

  function zeige() {
    if (document.getElementById('intro-overlay')) return;
    const L = lage();
    const B = bilder(L);
    let i = 0;

    const ov = document.createElement('div');
    ov.id = 'intro-overlay';
    ov.innerHTML = '<div class="intro-box"><div class="intro-inhalt"></div></div>';
    document.body.appendChild(ov);

    function male() {
      const b = B[i];
      const punkte = B.map(function (_, k) { return '<span class="intro-punkt' + (k === i ? ' an' : k < i ? ' weg' : '') + '"></span>'; }).join('');
      ov.querySelector('.intro-inhalt').innerHTML =
        '<div class="intro-bild">' + b.bild + '</div>' +
        '<div class="intro-rolle">' + esc(b.rolle) + '</div>' +
        '<h2 class="intro-kopf">' + b.kopf + '</h2>' +
        '<div class="intro-text">' + b.text + '</div>' +
        '<div class="intro-fuss">' +
          '<div class="intro-punkte">' + punkte + '</div>' +
          '<div class="intro-knoepfe">' +
            (i > 0 ? '<button class="intro-zurueck" onclick="window.__introZurueck()">Zurück</button>' : '') +
            '<button class="intro-weiter" onclick="window.__introWeiter()">' +
              (i === B.length - 1 ? 'An die Arbeit' : 'Weiter') + '</button>' +
          '</div>' +
        '</div>' +
        (i === 0 ? '<button class="intro-skip" onclick="window.__introEnde()">Überspringen</button>' : '');
    }
    window.__introWeiter = function () { if (i < B.length - 1) { i++; male(); } else window.__introEnde(); };
    window.__introZurueck = function () { if (i > 0) { i--; male(); } };
    window.__introEnde = function () {
      const o = document.getElementById('intro-overlay');
      if (o) o.remove();
      window.__introWeiter = window.__introZurueck = window.__introEnde = null;
      try { CLUB._introGesehen = true; } catch (e) {}
      try { if (typeof saveGameState === 'function') saveGameState(); } catch (e) {}
    };
    male();
  }
  window.zeigeVorstandsEinfuehrung = zeige;

  // Nach dem Anlegen einer NEUEN Karriere einblenden.
  if (typeof window.startNewGameState === 'function') {
    const _neu = window.startNewGameState;
    window.startNewGameState = async function () {
      const r = await _neu.apply(this, arguments);
      try {
        // Kurz warten, damit die Oberfläche steht und kein anderer Dialog
        // (Philosophie/Sponsor) darüberliegt.
        setTimeout(function () {
          try {
            // D131: neuer erster Tag (Wahl Lite/Voll + Tour mit Vereinsgeschichte) ersetzt die alte Einführung
            if (window.DFLTutorial && DFLTutorial.start()) { try { CLUB._introGesehen = true; } catch (e) {} return; }
            if (document.querySelector('.exp-overlay, .spo-ov')) {
              // Ein Auswahldialog ist schon offen — den Empfang davor schieben (2026-10-21: auch die Sponsorenwahl .spo-ov)
              document.querySelectorAll('.exp-overlay, .spo-ov').forEach(function (o) { o.style.display = 'none'; });
              const _e = window.__introEnde;
              zeige();
              const alt = window.__introEnde;
              window.__introEnde = function () {
                document.querySelectorAll('.exp-overlay, .spo-ov').forEach(function (o) { o.style.display = ''; });
                if (alt) alt();
              };
            } else zeige();
          } catch (e) { console.warn('[Intro]', e); }
        }, 260);
      } catch (e) {}
      return r;
    };
    try { startNewGameState = window.startNewGameState; } catch (e) {}
  }

  const css = document.createElement('style');
  css.textContent = [
    '#intro-overlay{position:fixed;inset:0;z-index:10000;background:rgba(6,10,14,.93);',
      'display:flex;align-items:center;justify-content:center;padding:18px;overflow-y:auto}',
    '.intro-box{max-width:560px;width:100%;background:var(--bg2,#161b22);border:1px solid var(--border,#30363d);',
      'border-radius:14px;padding:30px 30px 22px;position:relative;box-shadow:0 24px 60px rgba(0,0,0,.6)}',
    '.intro-box::before{content:"";position:absolute;inset:0 0 auto 0;height:3px;border-radius:14px 14px 0 0;',
      'background:linear-gradient(90deg,var(--accent,#25c065),var(--gold,#f2c14e))}',
    '.intro-bild{font-size:42px;text-align:center;line-height:1;margin-bottom:10px}',
    '.intro-rolle{text-align:center;font-size:10.5px;letter-spacing:1.8px;text-transform:uppercase;',
      'color:var(--gold,#f2c14e);margin-bottom:6px}',
    '.intro-kopf{text-align:center;font-size:21px;font-weight:700;margin:0 0 16px;color:var(--text,#e6edf3);line-height:1.2}',
    '.intro-text{font-size:14px;line-height:1.62;color:var(--text2,#c9d1d9)}',
    '.intro-text p{margin:0 0 11px}.intro-text b{color:var(--text,#e6edf3)}',
    '.intro-fuss{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:20px;',
      'padding-top:14px;border-top:1px solid var(--border,#30363d);flex-wrap:wrap}',
    '.intro-punkte{display:flex;gap:6px}',
    '.intro-punkt{width:7px;height:7px;border-radius:50%;background:var(--bg4,#30363d)}',
    '.intro-punkt.an{background:var(--accent,#25c065);width:20px;border-radius:4px}',
    '.intro-punkt.weg{background:var(--text3,#6e7681)}',
    '.intro-knoepfe{display:flex;gap:8px;margin-left:auto}',
    '.intro-weiter{padding:9px 20px;border-radius:7px;border:none;background:var(--accent,#25c065);',
      'color:#06210f;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit}',
    '.intro-weiter:hover{filter:brightness(1.1)}',
    '.intro-zurueck{padding:9px 16px;border-radius:7px;border:1px solid var(--border,#30363d);',
      'background:transparent;color:var(--text2,#8b949e);font-size:13px;cursor:pointer;font-family:inherit}',
    '.intro-skip{position:absolute;top:12px;right:14px;background:none;border:none;color:var(--text3,#6e7681);',
      'font-size:11.5px;cursor:pointer;font-family:inherit}',
    '.intro-skip:hover{color:var(--text2,#8b949e)}'
  ].join('');
  document.head.appendChild(css);

  console.log('[Vorstandseinfuehrung v1] aktiv — Empfang beim Karrierestart');
})();
