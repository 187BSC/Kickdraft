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
      L.liga = CLUB.leagueName || (grp && grp.group && grp.group.name) || 'Liga';
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
    try { L.deckel = window.VereinsDNA ? VereinsDNA.stadionDeckel() : null; } catch (e) { L.deckel = null; }
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
    const einordnung = L.rang <= 3 ? 'Ihr Kader gehört zu den stärksten der Liga — man erwartet hier oben etwas.'
                     : L.rang <= Math.ceil(L.teams / 2) ? 'Ihr Kader liegt im oberen Mittelfeld. Nach oben ist Luft, nach unten auch.'
                     : 'Ihr Kader gehört nicht zu den stärksten. Das ist ehrlich gesagt kein Nachteil — es erwartet niemand Wunder.';
    // PC (Stolperstein 1, Nutzer 2026-10-21 „Zusammenfassen“): eine Karte mit den drei wichtigsten Punkten statt vier
    if (document.body.classList.contains('pcu-an')) return [
      { kopf: 'Willkommen bei ' + esc(CLUB.name),
        bild: '🤝',
        rolle: chef + ' · Vorstandsvorsitzender',
        text: '<p>' + esc(L.liga) + ', ' + L.teams + ' Mannschaften, ' + L.kader + ' Spieler. ' + einordnung + '</p>' +
              '<p><b>Vertrauen ' + L.vertrauen + ' von 100:</b> Ziele erreicht, solide gewirtschaftet – es steigt. <span style="color:#a8271b"><b>Unter 20 trennen wir uns.</b></span></p>' +
              '<p><b>Vorgaben je Saison:</b> 30 % des Transferbudgets als Rücklage, Gehälter unter ' + euro(L.lohn) + ' pro Woche, alle zwei Jahre eine Ausbaustufe.</p>' +
              '<p><b>' + ZIEL_WORT[L.tier] + '</b> – gleich legen Sie Philosophie und Sponsor fest.</p>' }
    ];
    // Rückmeldung 18.10.: kurz wie Kickdraft – vier Karten, je zwei, drei Sätze
    return [
      { kopf: 'Willkommen bei ' + esc(CLUB.name),
        bild: '🤝',
        rolle: chef + ' · Vorstandsvorsitzender',
        text: '<p>Schön, dass Sie da sind. <b>' + esc(L.liga) + '</b>, ' + L.teams + ' Mannschaften, ein Kader mit <b>' + L.kader + ' Spielern</b>. ' + einordnung + '</p>' +
              '<p>Ich messe Sie an drei Dingen: Tabelle, Finanzen, Ausbau.</p>' },

      { kopf: 'Ihr Vertrauen: ' + L.vertrauen + ' von 100',
        bild: '📊',
        rolle: 'Die wichtigste Zahl',
        text: '<p>Ziele erreicht, solide gewirtschaftet: Es steigt. Ziele verpasst, rote Zahlen: Es fällt.</p>' +
              '<p style="color:#a8271b"><b>Unter 20 trennen wir uns.</b></p>' },

      { kopf: 'Drei Vorgaben je Saison',
        bild: '📋',
        rolle: 'Neben dem Tabellenplatz',
        text: '<p><b>Rücklage:</b> 30 % des Transferbudgets bleiben übrig (jetzt ' + euro(L.budget) + ').<br>' +
              '<b>Gehälter:</b> unter ' + euro(L.lohn) + ' pro Woche.<br>' +
              '<b>Ausbau:</b> alle zwei Jahre eine Stufe an Stadion oder Akademie.</p>' +
              '<p>Gleich danach legen Sie die Vereinsphilosophie fest. Sie gilt länger als eine Saison.</p>' },

      { kopf: ZIEL_WORT[L.tier],
        bild: '🏟️',
        rolle: 'Wohin die Reise geht',
        text: '<p>Aufsteigen, ausbauen, wieder aufsteigen. Jede Liga höher bringt mehr Geld, bessere Spieler und ein volleres Stadion.</p>' +
              '<p><b>Viel Erfolg. Wir sehen uns nach dem ersten Spieltag.</b></p>' }
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
      const punkte = B.length < 2 ? '' : B.map(function (_, k) { return '<span class="intro-punkt' + (k === i ? ' an' : k < i ? ' weg' : '') + '"></span>'; }).join('');
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
      // Erst JETZT die Philosophie-Wahl anbieten — sie ergibt nach der
      // Einführung Sinn, vorher wäre sie eine Frage ohne Kontext.
      try {
        const e = EXP.state();
        if (!e.philosophyId && (e.pendingPhilosophyOffers || []).length &&
            typeof window.openPhilosophyChoiceDialog === 'function') {
          window.openPhilosophyChoiceDialog();
        }
      } catch (err) {}
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
            if (document.querySelector('.exp-overlay')) {
              // Ein Auswahldialog ist schon offen — den Empfang davor schieben.
              document.querySelectorAll('.exp-overlay').forEach(function (o) { o.style.display = 'none'; });
              const _e = window.__introEnde;
              zeige();
              const alt = window.__introEnde;
              window.__introEnde = function () {
                document.querySelectorAll('.exp-overlay').forEach(function (o) { o.style.display = ''; });
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

  // PC: Philosophie und Sponsor nacheinander in EINEM Fenster (Stolperstein 1) – der Sponsor
  // ersetzt den Inhalt, ohne dass Hintergrund und Fenster kurz verschwinden. Handy unverändert.
  const pcAn = () => document.body.classList.contains('pcu-an');
  function schritt(ov, n) {
    const t = ov && ov.querySelector('.exp-dialog-title');
    if (t && !t.querySelector('.intro-schritt')) t.insertAdjacentHTML('beforeend', '<span class="intro-schritt">' + n + ' von 2</span>');
  }
  if (typeof window.openPhilosophyChoiceDialog === 'function' && typeof window.choosePhilosophyFromDialog === 'function' && typeof window.openSponsorChoiceDialog === 'function') {
    const _oPh = window.openPhilosophyChoiceDialog, _wPh = window.choosePhilosophyFromDialog;
    window.openPhilosophyChoiceDialog = function () {
      const r = _oPh.apply(this, arguments);
      if (pcAn()) { try { const alle = document.querySelectorAll('.exp-overlay'), ov = alle[alle.length - 1]; if (ov && /Philosophie/.test(ov.textContent)) schritt(ov, 1); } catch (e) {} }
      return r;
    };
    window.choosePhilosophyFromDialog = function () {
      const alt = pcAn() ? document.querySelector('.exp-overlay') : null;
      if (alt) alt.className = 'exp-overlay-halt';      // das Original entfernt so nichts
      const r = _wPh.apply(this, arguments);
      if (alt) {
        alt.className = '';
        try { window.openSponsorChoiceDialog(); } catch (e) {}   // sofort statt nach 250 ms
        const neu = document.querySelector('.exp-overlay');
        if (neu) {
          const d = neu.querySelector('.exp-dialog');
          alt.className = 'exp-overlay';
          alt.innerHTML = ''; alt.appendChild(d); neu.remove();
          schritt(alt, 2);
        } else alt.remove();
      }
      return r;
    };
    try { openPhilosophyChoiceDialog = window.openPhilosophyChoiceDialog; choosePhilosophyFromDialog = window.choosePhilosophyFromDialog; } catch (e) {}
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
    '.intro-skip:hover{color:var(--text2,#8b949e)}',
    '.intro-schritt{margin-left:auto;float:right;font-size:11px;font-weight:600;letter-spacing:.5px;color:var(--text3,#6e7681);',
      'background:var(--bg3,#21262d);border-radius:10px;padding:2px 9px}'
  ].join('');
  document.head.appendChild(css);

  console.log('[Vorstandseinfuehrung v1] aktiv — Empfang beim Karrierestart');
})();
