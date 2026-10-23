/* ═══════════════════════════════════════════════════════════════════════════
   DFL · ANLAGEN: ZUSTAND, VERSCHLEISS, SANIERUNG  ·  v1   (D75, 2026-10-11)
   ─────────────────────────────────────────────────────────────────────────
   Nutzer 2026-10-10: „Damit das Geld auch immer wohin geht: Du musst auch die laufenden
   Kosten im Blick behalten wie Stadion- und Facility-Instandhaltung und Verbesserung über
   die Zeit.“ Vorschau spiel/dfl_kosten_vorschau.html, freigegeben mit ihren Vorschlägen.

   Eigener Verein mit denselben Regeln wie die KI (Zahlen in DFLFinanzen.CFG.anlagen):
     · Zustand 0–100 % je Anlage (Training, Scouting, Fanshop, Medizin, Stadion) in
       CLUB.dfl.anlagen.zustand – zum Karrierestart wie in der Welt (DFLFinanzen.anlagenStart)
     · Saisonwechsel (vor dem neuen Saisonplan): Zustand sinkt um 100 % ÷ Lebensdauer
       (Scouting 6, Training/Fanshop/Medizin 10, Stadion 15 Saisons), leer = eine Stufe weniger
       (danach 50 %), ein marodes Stadion kostet bis 10 % Zuschauer – ersetzt „Scouting veraltet“
     · Ausbau fertig → 100 % (neue Stufe, neue Anlage)
     · Sanieren: anteilig die Hälfte der letzten Ausbaustufe, Stadion 500 € je Platz, beides mit
       dem Preisindex; sofort gebucht, Zustand 100 %, Kran auf dem Gelände für ein paar Wochen;
       der Eigentümer zählt es wie einen Ausbau als Investition
     · Postfach unter 30 %: „Sanieren“ oder „Verfallen lassen“
     · Front Office: Karte „Anlagen“ (Zustand, Unterhalt) → Blatt mit Sanieren; Verein & Stadion:
       Zustand, Unterhalt und Sanieren an jeder Anlage; Office: Zustand an der Stadion-Kachel
     · Rückbau (10 % Gebühr, bundle_finance.js) nennt den Unterhalt statt alter Wochenkosten
   Unterhalt im Saisonplan und Woche für Woche, Stadion-Zuschauer: dfl_finanz_patch.js.
   Lädt nach dfl_gelaende.js, dfl_medizin_patch.js, dfl_app_shell.js und dfl_eigentuemer_patch.js.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const F = window.DFLFinanzen;
  if (!F || !F.anlagenAktiv) { console.warn('[DFL-Anlagen] DFLFinanzen v2 fehlt – Patch inaktiv'); return; }

  const dfl = () => typeof CLUB !== 'undefined' && CLUB && CLUB.dfl && CLUB.dfl.aktiv;
  const aktiv = () => dfl() && F.anlagenAktiv();
  const FS = () => window.DFLFinanzSpiel;
  const cap = () => (window.DFLKader && DFLKader.cap ? DFLKader.cap() : F.CFG.startCap);
  const A = () => F.CFG.anlagen;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const zahl = (x, n) => Number(x).toLocaleString('de-DE', { minimumFractionDigits: n || 0, maximumFractionDigits: n || 0 });
  const mio = x => (Math.abs(x) >= 1e6 ? zahl(x / 1e6, Math.abs(x) >= 1e7 ? 1 : 2).replace(/,?0+$/, '') + ' Mio €' : zahl(Math.round(x / 1000) * 1000) + ' €');
  const geld = x => (typeof formatEuro === 'function' ? formatEuro(Math.round(x)) : mio(x));

  // Anlagen im Spiel (Schlüssel wie CLUB.facilities) – in der Welt heißt das Stadion „stadion“
  const KEYS = ['training', 'scouting', 'merchandising', 'medizin', 'stadium'];
  const NAME = { training: 'Trainingsgelände', scouting: 'Scouting', merchandising: 'Fanshop', medizin: 'Medizin', stadium: 'Stadion' };
  const KURZ = { training: 'Training', scouting: 'Scouting', merchandising: 'Fanshop', medizin: 'Medizin', stadium: 'Stadion' };
  const ICON = { training: 'ti-barbell', scouting: 'ti-search', merchandising: 'ti-shirt-sport', medizin: 'ti-first-aid-kit', stadium: 'ti-building-stadium' };
  const welt = k => (k === 'stadium' ? 'stadion' : k);
  const spiel = k => (k === 'stadion' ? 'stadium' : k);

  // ── Zustand ──────────────────────────────────────────────────────────────
  // Zum Start wie in der Welt (fest je Liga und Verein); ältere Spielstände holen ihn so nach
  function startZustand() {
    const z = {};
    try {
      const D = window.DFLSpiel, L = D.liga(), t = L.teams.find(x => x.id === D.eigeneDflId());
      F.anlagenStart(t, L.seed);
      Object.keys(t.zustand).forEach(k => { z[spiel(k)] = t.zustand[k]; });
    } catch (e) { KEYS.forEach(k => { z[k] = 70; }); }
    KEYS.forEach(k => { if (z[k] == null) z[k] = 70; });
    return z;
  }
  function zustand() {
    if (!dfl()) return null;
    const d = CLUB.dfl;
    if (!d.anlagen || !d.anlagen.zustand) d.anlagen = { zustand: startZustand(), bau: {}, lassen: {}, log: [] };
    const a = d.anlagen;
    a.bau = a.bau || {}; a.lassen = a.lassen || {}; a.log = a.log || [];
    KEYS.forEach(k => { if (a.zustand[k] == null) a.zustand[k] = 70; });
    return a;
  }
  const z = k => { const a = zustand(); return a ? Math.max(0, Math.min(100, a.zustand[k])) : 100; };
  function stufe(k) {
    if (k === 'medizin') return window.DFLMedizin && DFLMedizin.stufe ? DFLMedizin.stufe() : ((CLUB.facilities && CLUB.facilities.medizin) || 1);
    return (CLUB.facilities && CLUB.facilities[k]) || 1;
  }
  const plaetze = () => (typeof stadiumCapacityForLevel === 'function' ? stadiumCapacityForLevel(stufe('stadium')) : 20000);
  const vollPreis = k => F.sanierungVoll(welt(k), stufe(k), cap(), plaetze());
  const preis = k => F.sanierPreis(welt(k), stufe(k), z(k), cap(), plaetze());
  const verschleiss = k => F.verschleissJahr(welt(k), stufe(k), cap(), plaetze());
  const schritt = k => 100 / F.lebensdauer(welt(k));
  // Saisons bis zum Stufenverlust ohne Sanierung (1 = nach dieser Saison); Stadion: nie (verliert Zuschauer)
  const haeltNoch = k => (k === 'stadium' ? null : Math.max(1, Math.ceil((z(k) - 1e-9) / schritt(k))));
  const unterhaltVon = k => { const fs = FS(); const je = fs && fs.anlagenJe ? fs.anlagenJe() : {}; return je[k] || 0; };
  const unterhaltSumme = () => KEYS.reduce((s, k) => s + unterhaltVon(k), 0);
  const zClass = w => (w >= 60 ? 'gut' : w >= A().marode ? 'mittel' : 'schlecht');
  const bauLaeuft = k => { const b = typeof CLUB !== 'undefined' && CLUB.facilityBuilds && CLUB.facilityBuilds[k]; return !!(b && b.weeksLeft > 0); };
  const sanierungLaeuft = k => { const a = zustand(); return !!(a && a.bau[k] && a.bau[k].wochen > 0); };
  // Bauzeit der Sanierung: ein Fünftel der Ausbauzeit der Stufe, anteilig zum fehlenden Zustand (Scouting 7 bei 12 % → 6 Wochen)
  function sanierWochen(k) {
    const voll = typeof facilityBuildWeeks === 'function' ? facilityBuildWeeks(k, stufe(k)) : 20;
    return Math.max(1, Math.round(voll * 0.2 * (100 - z(k)) / 100));
  }

  // ── Sanieren / verfallen lassen ──────────────────────────────────────────
  function sanieren(k, still) {
    if (!aktiv() || KEYS.indexOf(k) < 0) return false;
    const a = zustand(), p = Math.round(preis(k));
    if (z(k) >= 99.5) { if (!still && typeof alert === 'function') alert(`${NAME[k]} ist in Topzustand.`); return false; }
    if (bauLaeuft(k)) { if (!still && typeof alert === 'function') alert(`An ${NAME[k] === 'Medizin' ? 'der Medizin' : NAME[k]} wird gerade ausgebaut – danach ist alles neu.`); return false; }
    if ((CLUB.budget || 0) < p) { if (!still && typeof alert === 'function') alert(`Nicht genug Geld: Sanieren kostet ${geld(p)}, in der Kasse sind ${geld(CLUB.budget || 0)}.`); return false; }
    const wochen = sanierWochen(k), vorher = z(k);
    CLUB.budget -= p;
    // Der Eigentümer zählt die Sanierung wie einen Ausbau als Investition, nicht als Verlust
    try { const s = CLUB.dfl.eigner && CLUB.dfl.eigner.start; if (s) s.investiert = (s.investiert || 0) + p; } catch (e) { /* ohne Eigentümer */ }
    a.zustand[k] = 100;
    a.bau[k] = { wochen, gesamt: wochen };
    delete a.lassen[k];
    a.log.push({ saison: LEAGUE.season, art: k, kosten: p, von: Math.round(vorher) });
    if (a.log.length > 40) a.log.shift();
    if (typeof addNews === 'function') addNews('club', `${NAME[k]} wird saniert`,
      `${geld(p)} für ${NAME[k]} (Stufe ${stufe(k)}, Zustand ${Math.round(vorher)} → 100 %). Bauzeit ${wochen} ${wochen === 1 ? 'Woche' : 'Wochen'}, der Betrieb läuft weiter.`);
    neuZeichnen();
    if (typeof saveGameState === 'function') saveGameState();
    return true;
  }
  function verfallen(k) {
    const a = zustand(); if (!a || KEYS.indexOf(k) < 0) return;
    a.lassen[k] = LEAGUE.season;
    neuZeichnen();
    if (typeof saveGameState === 'function') saveGameState();
  }

  // ── Saisonwechsel: Verschleiß, Stufenverlust (vor dem neuen Saisonplan) ──
  function saisonwechsel() {
    const a = zustand(); if (!a || !aktiv()) return [];
    // Anlagen im Ausbau verschleißen nicht (fertig sind sie wie neu)
    const teil = {}; KEYS.filter(k => !bauLaeuft(k)).forEach(k => { teil[k] = a.zustand[k]; });
    const verloren = F.verschleissSchritt(teil, stufe, (k, s) => {
      CLUB.facilities[k] = s;
      if (k === 'stadium' && typeof stadiumCapacityForLevel === 'function') CLUB.stadiumCapacity = stadiumCapacityForLevel(s);
    });
    Object.assign(a.zustand, teil);
    verloren.forEach(v => {
      const k = v.art;
      if (typeof addNews === 'function') addNews('club', `${NAME[k]} verfallen: Stufe ${v.von} → ${v.auf}`,
        `Ohne Sanierung war ${NAME[k] === 'Medizin' ? 'die Medizin' : NAME[k]} am Ende. Sie arbeitet jetzt auf Stufe ${v.auf} (Zustand ${A().nachVerfall} %), der Unterhalt sinkt.`);
    });
    a.lassen = {};
    a.bau = {};
    weltAbgleichen();
    return verloren;
  }
  // Der eigene Verein in der Welt: gleicher Zustand (Ticketschnitt der Liga, Gästeanteil der KI)
  function weltAbgleichen() {
    try {
      const a = zustand(), D = window.DFLSpiel, t = D.liga().teams.find(x => x.id === D.eigeneDflId());
      if (!a || !t) return;
      t.zustand = t.zustand || {};
      KEYS.forEach(k => { t.zustand[welt(k)] = a.zustand[k]; });
    } catch (e) { /* ohne Welt */ }
  }

  // ── Anzeige ──────────────────────────────────────────────────────────────
  function balken(k, klein) {
    const w = Math.round(z(k));
    return `<span class="anl-akku${klein ? ' klein' : ''}" role="img" aria-label="${esc(NAME[k])}: Zustand ${w} %"><i class="${zClass(w)}" style="width:${w}%"></i><em style="left:${A().marode}%"></em></span>`;
  }
  function hinweis(k) {
    if (sanierungLaeuft(k)) { const b = zustand().bau[k]; return `Sanierung läuft · noch ${b.wochen} ${b.wochen === 1 ? 'Woche' : 'Wochen'}`; }
    if (k === 'stadium') {
      const minus = Math.round((1 - F.komfort(z(k))) * 100);
      return minus ? `${minus} % weniger Zuschauer` : 'Zuschauer: voller Komfort';
    }
    const n = haeltNoch(k), s = stufe(k);
    if (s <= 1) return 'Stufe 1 – kann nicht weiter verfallen';
    return n === 1 ? `Nach dieser Saison Stufe ${s - 1}` : `Hält noch ${n} Saisons`;
  }
  function stufeText(k) { return k === 'stadium' ? `${zahl(plaetze())} Plätze` : `Stufe ${stufe(k)}`; }
  // Front Office: Karte unter dem Cap
  function foHtml() {
    const zeilen = KEYS.map(k => `<button type="button" class="anl-zeile" data-anl="${k}" aria-label="${esc(NAME[k])}: Zustand ${Math.round(z(k))} %, Unterhalt ${esc(mio(unterhaltVon(k)))}">
        <span class="anl-name"><i class="ti ${ICON[k]}" aria-hidden="true"></i><span><b>${esc(KURZ[k])}</b><small>${esc(stufeText(k))}</small></span></span>
        ${balken(k, true)}<span class="anl-wert"><b>${Math.round(z(k))} %</b><small>${esc(mio(unterhaltVon(k)))}</small></span></button>`).join('');
    const marode = KEYS.filter(k => z(k) < A().marode).length;
    // Nutzer 2026-10-22: überflüssiger Text raus: „Zustand und Sanieren: antippen“ nur am Handy, am PC (body.pcu-an) ohne Fußzeile, solange nichts marode ist
    const pcOhneHinweis = !marode && document.body.classList.contains('pcu-an');
    return `<section class="fo-karte dfl-anlagen-fo" aria-label="Anlagen">
      <div class="fo-zeile"><span><i class="ti ti-building-cog" aria-hidden="true"></i> Anlagen</span><b>${esc(mio(unterhaltSumme()))} <small>Unterhalt je Saison</small></b></div>
      <div class="anl-liste">${zeilen}</div>
      ${pcOhneHinweis ? '' : `<div class="anl-fuss">${marode ? `<span class="schlecht"><i class="ti ti-alert-triangle" aria-hidden="true"></i> ${marode} ${marode === 1 ? 'Anlage ist' : 'Anlagen sind'} marode</span>` : '<span>Zustand und Sanieren: antippen</span>'}</div>`}
    </section>`;
  }
  function foErgaenzen() {
    const fo = document.querySelector('#view-fo .fo');
    if (!fo || !aktiv() || fo.classList.contains('fo-kurz')) return;          // D121: im kurzen Front Office als Zeile
    const alt = fo.querySelector('.dfl-anlagen-fo'); if (alt) alt.remove();
    const karten = fo.querySelectorAll('.fo-karte');
    const ziel = karten.length ? karten[karten.length - 1] : null;
    if (ziel) ziel.insertAdjacentHTML('afterend', foHtml()); else fo.insertAdjacentHTML('beforeend', foHtml());
  }
  // Blatt mit allen Anlagen und Sanieren
  function blattInhalt() {
    const kasse = CLUB.budget || 0;
    const zeilen = KEYS.map(k => {
      const w = Math.round(z(k)), p = Math.round(preis(k)), laeuft = sanierungLaeuft(k) || bauLaeuft(k);
      const knopf = laeuft || w >= 100 ? '' : `<button type="button" class="app-knopf${w < A().marode ? ' haupt' : ''}" data-a="sanieren" data-k="${k}" ${kasse < p ? 'disabled' : ''}>
          <i class="ti ti-tool" aria-hidden="true"></i>Sanieren · ${esc(geld(p))}</button>`;
      return `<div class="anl-block ${zClass(w)}">
        <div class="anl-kopf"><span class="anl-name"><i class="ti ${ICON[k]}" aria-hidden="true"></i><span><b>${esc(NAME[k])}</b><small>${esc(stufeText(k))}</small></span></span><b class="anl-prozent">${w} %</b></div>
        ${balken(k)}
        <div class="anl-info"><span>${esc(hinweis(k))}</span><span>Unterhalt ${esc(mio(unterhaltVon(k)))} · Verschleiß ${esc(mio(verschleiss(k)))} je Saison</span></div>
        ${knopf}</div>`;
    }).join('');
    return `<div class="app-griff"></div><button class="app-blatt-zu" aria-label="Schließen"><i class="ti ti-x" aria-hidden="true"></i></button>
      <div class="app-sheet-titel">Anlagen</div>
      <div class="anl-summe"><div><b>${esc(mio(unterhaltSumme()))}</b><span>Unterhalt je Saison</span></div><div><b>${esc(mio(KEYS.reduce((s, k) => s + verschleiss(k), 0)))}</b><span>Verschleiß je Saison</span></div>
        <div><b>${esc(mio(kasse))}</b><span>Kasse</span></div></div>
      <p class="anl-text">Jede Anlage nutzt sich ab. Leer heißt eine Stufe weniger, das Stadion verliert Zuschauer. Sanieren füllt den Balken wieder.</p>
      <div class="anl-bloecke">${zeilen}</div>`;
  }
  function blatt() {
    const box = document.querySelector('#app-blatt .app-blatt-box');
    if (!box) { if (typeof switchAppView === 'function') switchAppView('club', document.getElementById('nav-club')); return; }
    box.innerHTML = blattInhalt();
    box.onclick = ev => {
      const b = ev.target.closest('[data-a="sanieren"]');
      if (b && !b.disabled) { if (sanieren(b.getAttribute('data-k'))) box.innerHTML = blattInhalt(); }
    };
    document.getElementById('app-blatt').classList.add('auf'); document.body.classList.add('app-gesperrt');
    if (window.DFLAppShell && DFLAppShell.cta) DFLAppShell.cta();
  }
  // Verein & Stadion: Zustand, Unterhalt und Sanieren an der Anlage
  function karteBlock(k) {
    const w = Math.round(z(k)), p = Math.round(preis(k)), laeuft = sanierungLaeuft(k) || bauLaeuft(k);
    const knopf = laeuft || w >= 100 ? '' : `<button type="button" class="fc-upgrade anl-sanieren" ${(CLUB.budget || 0) < p ? 'disabled' : ''} onclick="DFLAnlagen.sanieren('${k}')">Sanieren — ${esc(geld(p))}</button>`;
    return `<div class="anl-im-karte ${zClass(w)}">
      <div class="fc-stat"><span>Zustand</span><b>${w} %</b></div>${balken(k)}
      <div class="fc-stat"><span>Unterhalt je Saison</span><b>${esc(mio(unterhaltVon(k)))}</b></div>
      <div class="anl-info"><span>${esc(hinweis(k))}</span></div>${knopf}</div>`;
  }
  function einfuegen(html, block) {
    const ende = html.lastIndexOf('</div>');
    return ende >= 0 ? html.slice(0, ende) + block + html.slice(ende) : html + block;
  }
  function neuZeichnen() {
    try { if (typeof renderClubTab === 'function' && document.getElementById('club-facilities')) renderClubTab(); } catch (e) { /* Ansicht fehlt */ }
    try { if (typeof renderScoutTab === 'function') renderScoutTab(); } catch (e) { /* Ansicht fehlt */ }
    try { foErgaenzen(); } catch (e) { /* Ansicht fehlt */ }
    try { if (typeof renderPostfach === 'function') renderPostfach(); } catch (e) { /* Ansicht fehlt */ }
    try { const b = document.getElementById('app-blatt'); const box = b && b.classList.contains('auf') && b.querySelector('.app-blatt-box .anl-bloecke'); if (box) blatt(); } catch (e) { /* Blatt zu */ }
  }

  // ── Einhängen ────────────────────────────────────────────────────────────
  // Saisonwechsel: Verschleiß vor dem neuen Saisonplan (der Unterhalt rechnet mit den neuen Stufen); äußerster Wrapper
  {
    const _orig = window.startNewSeason;
    if (typeof _orig === 'function') window.startNewSeason = function () {
      let verloren = [];
      if (aktiv()) { try { verloren = saisonwechsel(); } catch (e) { console.warn('[DFL-Anlagen] Saisonwechsel', e); } }
      const r = _orig.apply(this, arguments);
      try { if (aktiv() && window.DFLFinanzSpiel) DFLFinanzSpiel.preiseSetzen(); } catch (e) { /* Preise bleiben */ }
      return r;
    };
    try { startNewSeason = window.startNewSeason; } catch (e) { /* nur im Spiel */ }
  }
  // Karrierestart: Zustand wie in der Welt
  {
    const _orig = window.startNewGameState;
    if (typeof _orig === 'function') window.startNewGameState = async function () {
      const r = await _orig.apply(this, arguments);
      if (dfl()) { try { if (CLUB.dfl.anlagen) delete CLUB.dfl.anlagen; zustand(); weltAbgleichen(); if (window.DFLFinanzSpiel) DFLFinanzSpiel.preiseSetzen(); } catch (e) { console.warn('[DFL-Anlagen] Start', e); } }
      return r;
    };
  }
  // Woche: Ausbau fertig → 100 %; Sanierung (Kran) zählt herunter
  {
    const _orig = window.advanceCalendarWeek;
    if (typeof _orig === 'function') window.advanceCalendarWeek = function () {
      const vorher = aktiv() ? KEYS.map(k => stufe(k)) : null;
      const r = _orig.apply(this, arguments);
      if (vorher && r !== false) {
        try {
          const a = zustand();
          KEYS.forEach((k, i) => { if (stufe(k) > vorher[i]) a.zustand[k] = 100; });
          Object.keys(a.bau).forEach(k => { a.bau[k].wochen--; if (a.bau[k].wochen <= 0) delete a.bau[k]; });
        } catch (e) { console.warn('[DFL-Anlagen] Woche', e); }
      }
      return r;
    };
    try { advanceCalendarWeek = window.advanceCalendarWeek; } catch (e) { /* nur im Spiel */ }
  }
  // Postfach: marode Anlagen (unter 30 %) mit zwei Knöpfen
  {
    const _orig = window.buildPostfachItems;
    if (typeof _orig === 'function') window.buildPostfachItems = function () {
      const items = _orig.apply(this, arguments);
      try {
        if (aktiv() && LEAGUE) {
          const a = zustand();
          KEYS.filter(k => z(k) < A().marode && a.lassen[k] !== LEAGUE.season && !sanierungLaeuft(k) && !bauLaeuft(k)).forEach(k => {
            const p = Math.round(preis(k));
            items.push({ cat: 'warn', icon: `<i class="ti ${ICON[k]}"></i>`, title: `${NAME[k]} marode (${Math.round(z(k))} %)`,
              text: k === 'stadium' ? `Kostet Zuschauer (jetzt −${Math.round((1 - F.komfort(z(k))) * 100)} %).` : (haeltNoch(k) === 1 && stufe(k) > 1
                ? `Ohne Sanierung nach dieser Saison Stufe ${stufe(k) - 1}.` : `Hält ohne Sanierung noch ${haeltNoch(k)} ${haeltNoch(k) === 1 ? 'Saison' : 'Saisons'}.`),
              actions: `<button class="pf-btn" onclick="DFLAnlagen.sanieren('${k}')"${(CLUB.budget || 0) < p ? ' disabled' : ''}>Sanieren · ${esc(geld(p))}</button>` +
                `<button class="pf-btn" onclick="DFLAnlagen.verfallen('${k}')">Verfallen lassen</button>`, prio: 3 });
          });
        }
      } catch (e) { /* Postfach bleibt, wie es ist */ }
      return items;
    };
    try { buildPostfachItems = window.buildPostfachItems; } catch (e) { /* nicht global gebunden */ }
  }
  // Verein & Stadion / Scouting: Karten der Anlagen
  {
    const _orig = window.renderFacilityCard;
    if (typeof _orig === 'function') window.renderFacilityCard = function (key) {
      let html = _orig.apply(this, arguments);
      try {
        if (aktiv() && KEYS.indexOf(key) >= 0) {
          // Rückbau-Knopf (bundle_finance.js): Unterhalt statt alter Wochenkosten im Hinweis
          const s = stufe(key);
          if (s > 1 && key !== 'stadium') {
            const spart = F.unterhalt(key, s, cap()) - F.unterhalt(key, s - 1, cap());
            html = html.replace(/spart [^"]*Betriebskosten/, `spart ${mio(spart)} Unterhalt je Saison`);
          }
          html = einfuegen(html, karteBlock(key));
        }
      } catch (e) { console.warn('[DFL-Anlagen] Karte', e); }
      return html;
    };
    try { renderFacilityCard = window.renderFacilityCard; } catch (e) { /* nicht global gebunden */ }
  }
  {
    const _orig = window.renderClubTab;
    if (typeof _orig === 'function') window.renderClubTab = function () {
      const r = _orig.apply(this, arguments);
      try {
        const med = aktiv() && document.querySelector('#club-facilities .med-karte');
        if (med && !med.querySelector('.anl-im-karte')) med.insertAdjacentHTML('beforeend', karteBlock('medizin'));
      } catch (e) { console.warn('[DFL-Anlagen] Medizin-Karte', e); }
      return r;
    };
    try { renderClubTab = window.renderClubTab; } catch (e) { /* nicht global gebunden */ }
  }
  // Rückbau mit dem Unterhalt (D75) statt der alten Wochenkosten; gleiche Gebühr (10 % des Ausbaupreises der Stufe)
  {
    const _orig = window.downgradeFacility;
    if (typeof _orig === 'function') window.downgradeFacility = function (key) {
      if (!aktiv() || KEYS.indexOf(key) < 0 || key === 'medizin' && !FACILITY_DEFS.medizin) return _orig.apply(this, arguments);
      const def = FACILITY_DEFS[key], cur = stufe(key);
      if (!def || cur <= 1) return _orig.apply(this, arguments);
      const fee = Math.round(def.cost[cur - 1] * ((window.RunningCosts && RunningCosts.DOWNGRADE_FEE_FACTOR) || 0.1));
      const vorher = unterhaltVon(key), danach = key === 'stadium' ? F.stadionUnterhalt(stadiumCapacityForLevel(cur - 1), cap()) : F.unterhalt(key, cur - 1, cap());
      if (!confirm(`${def.name} von Stufe ${cur} auf Stufe ${cur - 1} zurückbauen?\n\nGebühr: ${geld(fee)} (10 % des Ausbaupreises).\n` +
        `Der Unterhalt sinkt ab sofort von ${mio(vorher)} auf ${mio(danach)} je Saison.`)) return;
      if ((CLUB.budget || 0) < fee) { alert(`Nicht genug Geld für die Gebühr (${geld(fee)}). In der Kasse: ${geld(CLUB.budget || 0)}.`); return; }
      CLUB.budget -= fee;
      CLUB.facilities[key] = cur - 1;
      if (key === 'stadium') CLUB.stadiumCapacity = stadiumCapacityForLevel(cur - 1);
      if (typeof addNews === 'function') addNews('club', `${def.name} zurückgebaut`, `Stufe ${cur} → ${cur - 1}. Gebühr ${geld(fee)}, Unterhalt jetzt ${mio(danach)} je Saison.`);
      neuZeichnen();
      if (typeof saveGameState === 'function') saveGameState();
    };
  }
  // Front Office (App): Karte unter dem Cap; die App zeichnet intern neu → auf Änderungen achten (wie dfl_blick_patch.js)
  function beobachten() {
    const app = document.querySelector('.app') || document.body;
    const fo = new MutationObserver(() => { try { if (!document.querySelector('#view-fo .dfl-anlagen-fo') && !document.querySelector('#view-fo .fo-kurz')) foErgaenzen(); } catch (e) { console.warn('[DFL-Anlagen] Front Office', e); } });
    let foAn = null;
    const verbinden = () => {
      const v = document.getElementById('view-fo');
      if (v && v !== foAn) { fo.disconnect(); fo.observe(v, { childList: true, subtree: true }); foAn = v; if (!v.querySelector('.dfl-anlagen-fo')) foErgaenzen(); }
    };
    new MutationObserver(verbinden).observe(app, { childList: true });
    if (app !== document.body) new MutationObserver(verbinden).observe(document.body, { childList: true });
    verbinden();
    document.addEventListener('click', ev => {
      const b = ev.target.closest && ev.target.closest('.dfl-anlagen-fo .anl-zeile');
      if (b) blatt();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', beobachten); else beobachten();
  // Office: Zustand des Stadions an der Stadion-Kachel
  {
    const _orig = window.renderHomeTab;
    if (typeof _orig === 'function') window.renderHomeTab = function () {
      const r = _orig.apply(this, arguments);
      try {
        if (aktiv()) {
          const ic = document.querySelector('#app-office-kopf .ok-kachel .ti-building-stadium');
          const k = ic && ic.closest('.ok-kachel');
          if (k && !k.querySelector('.anl-ok')) {
            const w = Math.round(z('stadium'));
            const unten = k.querySelector('.ok-unten');
            const html = `<span class="ok-barometer anl-ok" aria-hidden="true"><i class="${zClass(w)}" style="width:${w}%"></i><em style="left:${A().marode}%"></em></span>`;
            if (unten) unten.insertAdjacentHTML('beforebegin', html); else k.insertAdjacentHTML('beforeend', html);
            if (unten) unten.insertAdjacentHTML('beforeend', ` · ${w} %`);
          }
        }
      } catch (e) { console.warn('[DFL-Anlagen] Office', e); }
      return r;
    };
  }
  // Gelände: Kran an der Anlage, solange saniert wird (Ausbau zeigt dfl_gelaende.js selbst); marode Anlagen (unter 30 %) grau
  if (window.DFLGelaende && typeof DFLGelaende.anlaesse === 'function') {
    const _orig = DFLGelaende.anlaesse;
    const ZIEL = { stadium: 'stadion', training: 'training', scouting: 'scouting', merchandising: 'fanshop' };
    DFLGelaende.anlaesse = function () {
      const an = _orig.apply(this, arguments);
      try {
        if (aktiv() && an && Array.isArray(an.baustellen)) {
          const a = zustand();
          Object.keys(a.bau).forEach(k => { if (ZIEL[k] && a.bau[k].wochen > 0 && !an.baustellen.some(b => b.ziel === ZIEL[k])) an.baustellen.push({ ziel: ZIEL[k], wochen: a.bau[k].wochen, sanierung: true }); });
          if (!an.marode) an.marode = Object.keys(ZIEL).filter(k => z(k) < A().marode && !an.baustellen.some(b => b.ziel === ZIEL[k])).map(k => ZIEL[k]);
        }
      } catch (e) { /* Gelände wie bisher */ }
      return an;
    };
  }

  // Spielstand schon geladen (initGame lädt vor den Patches): Zustand nachholen, Preise mit Preisindex (Medizin gibt es jetzt)
  try { if (aktiv()) { zustand(); weltAbgleichen(); } if (window.DFLFinanzSpiel) DFLFinanzSpiel.preiseSetzen(); } catch (e) { console.warn('[DFL-Anlagen] Laden', e); }

  window.DFLAnlagen = { KEYS, NAME, zustand, z, stufe, preis, vollPreis, verschleiss, haeltNoch, unterhaltVon, unterhaltSumme, sanieren, verfallen,
    saisonwechsel, sanierWochen, blatt, foHtml, karteBlock, weltAbgleichen };
  console.log('[DFL-Anlagen v1] aktiv — Zustand und Verschleiß je Anlage, leer = eine Stufe weniger, Sanieren, Postfach unter 30 %, Front Office (D75)');
})();
