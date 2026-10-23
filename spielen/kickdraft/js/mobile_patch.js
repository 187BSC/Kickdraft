/* ===== mobile_patch.js =====
   HANDYVERSION v1 — Bottom-Navigation und Touch-Layout
   ─────────────────────────────────────────────────────────────────────────────
   Gemessen auf 375×812 (Samsung-Format):
     • Die Reiterleiste ist 1231 px breit — von elf Reitern sieht man drei, der
       Rest liegt hinter horizontalem Wischen. Man findet Tabs schlicht nicht.
     • Die Ligatabelle ist 485 px breit, die Kader-Seitenleiste 280 px — beide
       ragen über den Rand.
     • Knöpfe sind 26–32 px hoch; für Daumenbedienung braucht es 44 px.

   Lösung: eine feste Leiste am unteren Rand mit fünf Zielen (Übersicht, Kader,
   Spieltag, Liga, Mehr). „Mehr" öffnet ein Blatt mit den übrigen Bereichen.
   Die alte Reiterleiste wird auf schmalen Geräten ausgeblendet, auf breiten
   bleibt alles wie es war — das Modul greift NUR unterhalb von 820 px.

   Lädt VOR init_bootstrap.js, nach allen View-Modulen.
   ============================================================================= */
(function () {
  'use strict';

  const GRENZE = 820;                       // ab hier gilt Desktop-Layout
  const HAUPT = [
    { view: 'home',    icon: 'ti-home',           label: 'Übersicht' },
    { view: 'squad',   icon: 'ti-users',          label: 'Kader' },
    { view: 'match',   icon: 'ti-ball-football',  label: 'Spieltag' },
    { view: 'liga',    icon: 'ti-trophy',         label: 'Liga' }
  ];
  const MEHR = [
    { view: 'zeitung',  icon: 'ti-news',     label: 'Zeitung',   sub: 'Der Anstoß' },
    { view: 'club',     icon: 'ti-building', label: 'Verein',    sub: 'Ausbau, Finanzen' },
    { view: 'transfer', icon: 'ti-cash',     label: 'Trades & FA', sub: 'Free Agency und Trades' },
    { view: 'scout',    icon: 'ti-search',   label: 'Scouting',  sub: 'Draft-Jahrgänge' },
    { view: 'training', icon: 'ti-barbell',  label: 'Training',  sub: 'Einheiten und Trainingsgruppe' }
  ];

  // `handy.html` ruft index.html mit ?ui=handy auf und erzwingt damit die
  // Handy-Bedienung unabhängig von der Fensterbreite. Die Wahl wird gemerkt,
  // damit sie einen Neustart des Spiels überlebt (der Spielstand-Ladevorgang
  // führt zu keinem Reload, aber „Zum Startbildschirm hinzufügen" schon).
  function erzwungen() {
    try {
      // Die gebündelte Einzeldatei (fcm_handy.html) setzt dieses Flag direkt —
      // sie IST die Handyfassung, unabhängig von Fensterbreite und Adresszeile.
      if (window.FM_NUR_HANDY === true) return true;
      if (/[?&]ui=handy/.test(location.search)) {
        try { localStorage.setItem('fm_ui', 'handy'); } catch (e) {}
        return true;
      }
      if (/[?&]ui=desktop/.test(location.search)) {
        try { localStorage.removeItem('fm_ui'); } catch (e) {}
        return false;
      }
      return localStorage.getItem('fm_ui') === 'handy';
    } catch (e) { return false; }
  }
  const ERZWUNGEN = erzwungen();

  function istHandy() { return ERZWUNGEN || window.innerWidth < GRENZE; }

  // ── Leiste bauen ───────────────────────────────────────────────────────────
  function baueLeiste() {
    if (document.getElementById('mob-nav')) return;
    const nav = document.createElement('div');
    nav.id = 'mob-nav';
    nav.innerHTML = HAUPT.map(function (h) {
      return '<button class="mob-btn" data-view="' + h.view + '">' +
               '<i class="ti ' + h.icon + '" aria-hidden="true"></i>' +
               '<span>' + h.label + '</span></button>';
    }).join('') +
      '<button class="mob-btn" id="mob-mehr-btn">' +
        '<i class="ti ti-dots" aria-hidden="true"></i><span>Mehr</span></button>';
    document.body.appendChild(nav);

    // Blatt für die übrigen Bereiche
    const sheet = document.createElement('div');
    sheet.id = 'mob-sheet';
    sheet.innerHTML =
      '<div class="mob-sheet-bg"></div>' +
      '<div class="mob-sheet-box">' +
        '<div class="mob-sheet-griff"></div>' +
        '<div class="mob-sheet-titel">Alle Bereiche</div>' +
        // Nur Bereiche anbieten, die es in DIESER Fassung wirklich gibt. Die
        // gebündelte Handydatei lässt das Gelände weg (21 MB Sprites) — der
        // Eintrag stand trotzdem im Menü und führte ins Leere.
        MEHR.filter(function (m) { return !!document.getElementById('view-' + m.view); })
            .map(function (m) {
          return '<button class="mob-eintrag" data-view="' + m.view + '">' +
                   '<i class="ti ' + m.icon + '" aria-hidden="true"></i>' +
                   '<span class="mob-eintrag-txt"><b>' + m.label + '</b><small>' + m.sub + '</small></span>' +
                   '<i class="ti ti-chevron-right mob-pfeil" aria-hidden="true"></i>' +
                 '</button>';
        }).join('') +
      '</div>';
    document.body.appendChild(sheet);

    // Klicks — über switchAppView, damit alle bestehenden Patches greifen.
    nav.addEventListener('click', function (ev) {
      const b = ev.target.closest('.mob-btn');
      if (!b) return;
      if (b.id === 'mob-mehr-btn') { sheetAuf(); return; }
      wechsle(b.getAttribute('data-view'));
    });
    sheet.addEventListener('click', function (ev) {
      if (ev.target.closest('.mob-sheet-bg')) { sheetZu(); return; }
      const e = ev.target.closest('.mob-eintrag');
      if (!e) return;
      sheetZu();
      wechsle(e.getAttribute('data-view'));
    });
  }

  function wechsle(view) {
    try {
      // Der Original-Knopf muss mitgegeben werden: mehrere Module lesen ihn,
      // um die aktive Markierung zu setzen.
      const btn = document.getElementById('nav-' + view);
      if (typeof switchAppView === 'function') switchAppView(view, btn);
      markiere(view);
      window.scrollTo(0, 0);
    } catch (e) { console.warn('[Mobile] Wechsel', e); }
  }

  function markiere(view) {
    document.querySelectorAll('#mob-nav .mob-btn').forEach(function (b) {
      b.classList.toggle('an', b.getAttribute('data-view') === view);
    });
    // Liegt die View im „Mehr"-Blatt, den Mehr-Knopf markieren.
    const imMehr = MEHR.some(function (m) { return m.view === view; });
    const mb = document.getElementById('mob-mehr-btn');
    if (mb) mb.classList.toggle('an', imMehr);
  }

  function sheetAuf() {
    const s = document.getElementById('mob-sheet');
    if (s) { s.classList.add('auf'); document.body.classList.add('mob-sheet-offen'); }
  }
  function sheetZu() {
    const s = document.getElementById('mob-sheet');
    if (s) { s.classList.remove('auf'); document.body.classList.remove('mob-sheet-offen'); }
  }
  window.mobSheetZu = sheetZu;

  // Aktive View nachführen, egal wer switchAppView aufruft.
  if (typeof window.switchAppView === 'function') {
    const _sav = window.switchAppView;
    window.switchAppView = function (view, btn) {
      const r = _sav.apply(this, arguments);
      try { if (istHandy()) markiere(view); } catch (e) {}
      return r;
    };
    try { switchAppView = window.switchAppView; } catch (e) {}
  }

  function anpassen() {
    const handy = istHandy();
    document.body.classList.toggle('ist-handy', handy);
    if (handy) { baueLeiste();
      const aktiv = document.querySelector('.app-view.active');
      if (aktiv) markiere(aktiv.id.replace('view-', ''));
    } else sheetZu();
  }
  window.addEventListener('resize', anpassen);
  window.addEventListener('orientationchange', function () { setTimeout(anpassen, 120); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', anpassen);
  else anpassen();

  // ── Stil ───────────────────────────────────────────────────────────────────
  const css = document.createElement('style');
  css.textContent = [
    '@media (max-width: ' + (GRENZE - 1) + 'px) {',
      /* Alte Reiterleiste weg — sie war 1231 px breit und praktisch unbedienbar */
      '  .appnav { display:none !important; }',
      /* Platz für die untere Leiste schaffen, inkl. iPhone/Android-Gesten-Leiste */
      '  body { padding-bottom: calc(62px + env(safe-area-inset-bottom, 0px)); }',
      '  .app { min-height: auto; }',

      /* Untere Navigation */
      '  #mob-nav { position:fixed; left:0; right:0; bottom:0; z-index:9000; display:flex;',
      '    background:var(--bg2,#161b22); border-top:1px solid var(--border,#30363d);',
      '    padding-bottom: env(safe-area-inset-bottom, 0px);',
      '    box-shadow:0 -6px 20px rgba(0,0,0,.35) }',
      '  .mob-btn { flex:1 1 0; min-width:0; background:none; border:none; cursor:pointer;',
      '    display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px;',
      '    padding:8px 2px 7px; color:var(--text3,#6e7681); font-family:inherit; position:relative;',
      '    min-height:56px; -webkit-tap-highlight-color:transparent }',
      '  .mob-btn i { font-size:21px; line-height:1 }',
      '  .mob-btn span { font-size:10px; font-weight:600; letter-spacing:.2px;',
      '    max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap }',
      '  .mob-btn.an { color:var(--accent,#25c065) }',
      '  .mob-btn.an::before { content:""; position:absolute; top:0; left:22%; right:22%; height:2.5px;',
      '    border-radius:0 0 3px 3px; background:var(--accent,#25c065) }',

      /* Blatt „Alle Bereiche" */
      '  #mob-sheet { position:fixed; inset:0; z-index:9500; pointer-events:none }',
      '  #mob-sheet.auf { pointer-events:auto }',
      '  .mob-sheet-bg { position:absolute; inset:0; background:rgba(4,7,10,.6); opacity:0;',
      '    transition:opacity .18s }',
      '  #mob-sheet.auf .mob-sheet-bg { opacity:1 }',
      '  .mob-sheet-box { position:absolute; left:0; right:0; bottom:0; background:var(--bg2,#161b22);',
      '    border-top:1px solid var(--border,#30363d); border-radius:16px 16px 0 0; padding:8px 10px',
      '    calc(14px + env(safe-area-inset-bottom, 0px));',
      '    transform:translateY(100%); transition:transform .22s cubic-bezier(.2,.8,.3,1);',
      '    max-height:82vh; overflow-y:auto }',
      '  #mob-sheet.auf .mob-sheet-box { transform:translateY(0) }',
      '  .mob-sheet-griff { width:38px; height:4px; border-radius:3px; background:var(--bg4,#30363d);',
      '    margin:4px auto 10px }',
      '  .mob-sheet-titel { font-size:11px; letter-spacing:1.6px; text-transform:uppercase;',
      '    color:var(--text3,#6e7681); padding:0 6px 8px; font-weight:700 }',
      '  .mob-eintrag { width:100%; display:flex; align-items:center; gap:12px; background:none;',
      '    border:none; border-radius:10px; padding:12px 10px; cursor:pointer; text-align:left;',
      '    color:var(--text,#e6edf3); font-family:inherit; min-height:56px; position:relative;',
      '    -webkit-tap-highlight-color:transparent }',
      '  .mob-eintrag:active { background:var(--bg3,#21262d) }',
      '  .mob-eintrag > i:first-child { font-size:20px; color:var(--accent,#25c065); flex:none; width:24px; text-align:center }',
      '  .mob-eintrag-txt { display:flex; flex-direction:column; gap:1px; min-width:0; flex:1 }',
      '  .mob-eintrag-txt b { font-size:14px; font-weight:600 }',
      '  .mob-eintrag-txt small { font-size:11.5px; color:var(--text3,#6e7681);',
      '    overflow:hidden; text-overflow:ellipsis; white-space:nowrap }',
      '  .mob-pfeil { font-size:15px; color:var(--text3,#6e7681); flex:none }',
      '  body.mob-sheet-offen { overflow:hidden }',

      /* Breite Tabellen (Liga 485 px) horizontal scrollbar machen, statt sie */
      /* über den Rand ragen zu lassen. */
      '  .lg-wrap, .subview, .squad-main { max-width:100%; overflow-x:auto; -webkit-overflow-scrolling:touch }',
      '  .lg-table { min-width:460px }',
      '  table { max-width:100% }',

      /* Kader: Seitenleiste unter den Platz statt daneben (war 280 px breit) */
      '  .squad-layout { grid-template-columns:1fr !important; }',
      '  .sidebar { width:100% !important; max-width:100% !important; border-left:none !important;',
      '    border-top:1px solid var(--border,#30363d) }',

      /* Touch-Ziele: gemessen 26–32 px, nötig sind 44 px */
      '  .subtab { min-height:40px; padding:9px 13px; font-size:12.5px }',
      '  .mkt-btn, .market-btns button { min-height:40px }',
      '  .market-btns { flex-wrap:wrap; gap:6px }',
      /* Die Marktzeile war flex-nowrap: Name + Wert + Knöpfe brauchen 362 px in */
      /* einer 319 px breiten Zeile, die Knöpfe ragten bis x=422 aus dem Bild.  */
      '  .market-row { flex-wrap:wrap; row-gap:8px }',
      /* Spielernamen kürzt `.squad-name` per ellipsis auf eine Zeile — auf dem */
      /* Handy fielen dadurch längere Namen ab („🇩🇪 Philipp Ziegler"). Umbrechen */
      /* lassen statt abschneiden; die Zeile wird dann zweizeilig. */
      '  .squad-name { white-space:normal !important; overflow:visible !important;',
      '    text-overflow:clip !important; line-height:1.3 }',
      '  .market-row > .market-btns { margin-left:auto }',
      /* Untertab-Leisten (Liga/Pokal, Europa) horizontal wischbar statt */
      /* abgeschnitten — einzelne Reiter lagen bei x=477. */
      '  .subtabs { overflow-x:auto; -webkit-overflow-scrolling:touch; scrollbar-width:none;',
      '    flex-wrap:nowrap }',
      '  .subtabs::-webkit-scrollbar { display:none; height:0 }',
      '  .subtab { flex:0 0 auto; white-space:nowrap }',

      /* Spielkarte auf der Übersicht: Wappen (46 px) und Name standen */
      /* nebeneinander in einer 98 px breiten Spalte — für den Namen blieben */
      /* 40 px, aus „FC Musterhausen" wurde „FC…". Untereinander gestellt hat */
      /* der Name die volle Spaltenbreite und darf umbrechen. */
      '  .hm-team { flex-direction:column !important; gap:6px !important; text-align:center }',
      '  .hm-team > [id$="-name"], .hm-team > [class$="-name"] {',
      '    white-space:normal !important; overflow:visible !important; text-overflow:clip !important;',
      '    font-size:12px; line-height:1.25; width:100% }',
      '  .hm-teams { gap:8px !important }',
      '  .hm-vs { flex:0 0 auto }',

      /* Einführung: volle Breite nutzen */
      '  .intro-box { padding:24px 20px 18px; border-radius:12px }',
      '  .intro-kopf { font-size:19px }',
      '  .intro-text { font-size:13.5px }',
      /* Gemessen 34 px hoch — für Daumenbedienung zu wenig. */
      '  .intro-weiter, .intro-zurueck { min-height:44px; padding-left:22px; padding-right:22px }',
      '  .intro-skip { min-height:34px; padding:6px 10px }',

      /* Dialoge/Overlays sollen nicht unter der Leiste verschwinden */
      '  .exp-overlay { padding-bottom: calc(70px + env(safe-area-inset-bottom, 0px)) }',

    '}',

    /* Auf breiten Geräten nie anzeigen */
    '@media (min-width: ' + GRENZE + 'px) { #mob-nav, #mob-sheet { display:none !important } }'
  ].join('\n');
  document.head.appendChild(css);

  window.MobileUI = { GRENZE: GRENZE, istHandy: istHandy, anpassen: anpassen,
                      HAUPT: HAUPT, MEHR: MEHR, wechsle: wechsle };
  console.log('[Handyversion v1] aktiv — Bottom-Navigation unter ' + GRENZE + 'px');
})();
