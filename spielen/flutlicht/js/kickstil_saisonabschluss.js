/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · SAISONABSCHLUSS  ·  v1   (Nutzer 2026-10-16: Reihenfolge „Saisonabschluss mit Werbeplatz“ zuerst; Kickdraft D117:
   „Saisonabschluss soll sich anfühlen, als hätte man etwas geschafft, und Lust auf die nächste Saison machen“)
   ─────────────────────────────────────────────────────────────────────────
   Ersetzt den schlichten Saison-Rückblick (chronicle_patch.js, ein Fenster mit Zahlen) durch einen Abschluss in 4 Schritten:
     1. ERGEBNIS      Meister / Aufstieg / Klassenerhalt / Abstieg / Pokalsieg groß, Platz, Punkte, Bilanz, Tore
     2. DEINE BESTEN  Sonderkarte „Spieler der Saison“ (kickstil_karten.js) groß, Torjäger, Talent, Durchbruch
     3. DIE LIGEN     Meister jeder Liga, Pokalsieger, Auf- und Absteiger (Log aus runEndOfSeason)
     4. NEUE SAISON   Ladebildschirm mit Fußballspruch und Tipp – hier läuft in der App die Pflichtanzeige zum Saisonabschluss
                      (KSWerbung.uebergang('saison'), Nutzer: „nach jeder Saison beim Abschluss kommt Werbung“)
   Die Chronik (CLUB.chronicle) bleibt; „Chronik ansehen“ öffnet sie wie bisher. Philosophie- und Sponsorenwahl erscheinen
   danach (liegen darunter, z-index).
   Daten: vor startNewSeason festgehalten (Tabellen, Noten und Tore werden dort zurückgesetzt).
   API: KSSaisonende.zeigen(result) · .letzte()
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const neu = s => (window.KSVereinsnamen ? KSVereinsnamen.text(String(s || '')) : String(s || ''));
  const LIGA = { bundesliga: 'Erste Liga', bundesliga2: 'Zweite Liga', liga3: 'Dritte Liga', regionalliga: 'Regionalliga' };
  const LIGA_D = { bundesliga: 'Ersten Liga', bundesliga2: 'Zweiten Liga', liga3: 'Dritten Liga', regionalliga: 'Regionalliga' };   // „in der …“
  const RANG = ['regionalliga', 'liga3', 'bundesliga2', 'bundesliga'];
  const SPRUECHE = ['Nach dem Spiel ist vor dem Spiel.', 'Der Ball ist rund.', 'Die Wahrheit liegt auf dem Platz.', 'Elf Freunde müsst ihr sein.',
    'Ein Spiel dauert 90 Minuten – und die Saison 34 Spieltage.', 'Wer hinten nichts zulässt, gewinnt vorne.', 'Geld schießt keine Tore.',
    'Das nächste Spiel ist immer das schwerste.', 'Der Pokal hat seine eigenen Gesetze.', 'Abgerechnet wird am Schluss.', 'Ein Tor ist ein Tor.',
    'Hinten dicht und vorne hilft der liebe Gott.'];
  const TIPPS = ['Gib der Scouting-Abteilung zwei Fokus-Positionen – dann findet sie jede Woche passende Spieler.',
    'In den Akademien anderer Vereine stecken Talente. Im Transferfenster kannst du sie im Vereinsblatt holen.',
    'Ab etwa 30 Jahren bauen Spieler ab, Flügelspieler am frühesten. Plane deinen Kader rechtzeitig um.',
    'Starke Spiele bringen Sonderkarten – am letzten Oktober-Spieltag sogar Halloween-Karten.',
    'Einmal pro Saison gibt es die Transferspritze unter Mehr → Joker.',
    'Die Zahl in Klammern neben der Stärke zeigt die Entwicklung seit Saisonbeginn.',
    'Tippe in der Tabelle auf einen Verein: Kader, Akademie und Scout-Bericht auf einen Blick.'];
  const zufall = a => a[Math.floor(Math.random() * a.length)];
  // Nutzer 2026-10-22: überflüssiger Text raus: am PC (body.pcu-an) keine Tipps mit „Tippe …“, am Handy bleibt alles wie es war
  const tippsHier = () => (document.body && document.body.classList.contains('pcu-an')) ? TIPPS.filter(t => !/^Tippe /.test(t)) : TIPPS;

  // ── Vor startNewSeason festhalten ─────────────────────────────────────────
  let VOR = null, LETZTE = null;
  function festhalten() {
    if (typeof LEAGUE === 'undefined' || !LEAGUE) return null;
    const v = { saison: LEAGUE.season, woche: LEAGUE.week, jahr: LEAGUE.startYear, label: typeof seasonYearLabel === 'function' ? seasonYearLabel(LEAGUE.season) : 'Saison ' + LEAGUE.season, meister: [] };
    try {
      const fg = findFcmGroup(LEAGUE); v.tier = fg.tierKey; v.liga = fg.group.name;
      const tbl = computeTable(fg.group.teams), i = tbl.findIndex(t => t.id === 'fcm');
      v.zeile = tbl[i]; v.platz = i + 1; v.anzahl = tbl.length;
      allGroups(LEAGUE).forEach(g => { if (g.tierKey === 'regionalliga') return; const t = computeTable(g.group.teams)[0]; if (t) v.meister.push({ liga: LIGA[g.tierKey] || g.group.name, name: t.id === 'fcm' ? CLUB.name : t.name, id: t.id, pts: t.pts }); });
    } catch (e) { /* ohne Tabelle */ }
    try { if (typeof CUP !== 'undefined' && CUP && CUP.winnerId) { v.pokalsieger = CUP.winnerId === 'fcm'; v.pokalName = CUP.winnerId === 'fcm' ? CLUB.name : (CUP.winnerName || teamNameById(CUP.winnerId)); } } catch (e) { /* ohne Pokal */ }
    try { v.liste = window.KSKarten ? KSKarten.saisonListe(v.saison) : null; } catch (e) { v.liste = null; }
    return v;
  }
  function teamNameById(id) { try { for (const g of allGroups(LEAGUE)) { const t = g.group.teams.find(x => x.id === id); if (t) return t.name; } } catch (e) { /* weiter */ } return ''; }
  if (typeof window.startNewSeason === 'function') {
    const _s = window.startNewSeason;
    window.startNewSeason = function () {
      try { VOR = festhalten(); } catch (e) { VOR = null; }
      const r = _s.apply(this, arguments);
      const danach = () => {
        if (!VOR) return;
        try {
          const fg = findFcmGroup(LEAGUE); VOR.tierNach = fg.tierKey; VOR.ligaNach = fg.group.name;
          const auf = RANG.indexOf(VOR.tierNach) > RANG.indexOf(VOR.tier), ab = RANG.indexOf(VOR.tierNach) < RANG.indexOf(VOR.tier);
          VOR.auf = auf; VOR.ab = ab;
          if (ab && VOR.tierNach === 'regionalliga') {
            CLUB.ksEntlassen = { saison: VOR.saison, grund: 'regionalliga' };
            if (typeof addNews === 'function') addNews('club', '🚪 ENTLASSUNG', 'Abstieg in die Regionalliga – der Vorstand trennt sich von dir. Game Over.');
            try { if (typeof saveGameState === 'function') saveGameState(); } catch (e) { /* später */ }
          }
          VOR.karten = window.KSKarten ? KSKarten.saisonAbschluss({ saison: VOR.saison, woche: VOR.woche, jahr: VOR.jahr, liste: VOR.liste, meister: VOR.platz === 1,
            aufstieg: auf, pokalsieger: !!VOR.pokalsieger, liga: LIGA[VOR.tier] || VOR.liga, neueLiga: LIGA[VOR.tierNach] || VOR.ligaNach }) : {};
        } catch (e) { console.warn('[Kickstil-Saisonabschluss] danach', e); }
        LETZTE = VOR;
      };
      if (r && typeof r.then === 'function') r.then(x => { danach(); return x; }); else danach();
      return r;
    };
    try { startNewSeason = window.startNewSeason; } catch (e) { /* window reicht */ }
  }

  // ── Abstieg in die Regionalliga = Entlassung (Nutzer 2026-10-16: „Regio nur im Hintergrund und für den Pokal“) ──
  // Gespielt wird nur Erste bis Dritte Liga. Wer aus der Dritten Liga absteigt, wird immer entlassen – keine Gnadenfrist.
  // CLUB.ksEntlassen bleibt im Spielstand: wer neu lädt, landet wieder hier statt in der Regionalliga weiterzuspielen.
  const entlassen = () => { try { return typeof CLUB !== 'undefined' && CLUB && !!CLUB.ksEntlassen; } catch (e) { return false; } };
  function entlassung() {
    if (document.querySelector('.exp-gameover')) return;
    const ov = document.createElement('div'); ov.className = 'exp-gameover ks-entlassen';
    const name = (() => { try { const n = typeof clubName === 'function' ? clubName() : CLUB.name; return window.KSVereinsnamen ? KSVereinsnamen.text(n) : n; } catch (e) { return 'dem Verein'; } })();
    ov.innerHTML = `<div class="exp-gameover-box"><div class="exp-gameover-icon"><i class="ti ti-door-exit" aria-hidden="true"></i></div>
      <div class="exp-gameover-title">ENTLASSEN</div>
      <div class="exp-gameover-text">Abstieg in die Regionalliga. Der Vorstand von <b>${esc(name)}</b> zieht die Reißleine – deine Amtszeit ist beendet.<br><br>
        Deine Winpunkte, Erfolge und Karten bleiben. Starte neu in der Ersten, Zweiten oder Dritten Liga.</div>
      <button class="exp-gameover-btn" type="button" onclick="expRestartAfterGameOver()">Neues Spiel starten</button></div>`;
    document.body.appendChild(ov);
  }
  setInterval(() => {
    try {
      // Sicherheitsnetz (Langzeitlauf 2026-10-17: ein Bot spielte nach dem Abstieg in der Regionalliga weiter): gestartet wird nie
      // in der Regionalliga – steht der eigene Verein dort ohne Entlassung, wurde sie auf irgendeinem Weg übergangen
      if (!entlassen() && typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.tiers && typeof findFcmGroup === 'function') {
        const fg = findFcmGroup(LEAGUE), ob = document.getElementById('onboarding-overlay');
        if (fg && fg.tierKey === 'regionalliga' && !(ob && ob.offsetWidth)) {
          CLUB.ksEntlassen = { saison: LEAGUE.season, grund: 'regionalliga', netz: true };
          try { if (typeof saveGameState === 'function') saveGameState(); } catch (e) { /* später */ }
        }
      }
      if (!entlassen() || document.querySelector('.exp-gameover')) return;
      const se = document.getElementById('ks-saisonende'), ob = document.getElementById('onboarding-overlay');
      if ((se && se.classList.contains('auf')) || (ob && ob.offsetWidth)) return;
      entlassung();
    } catch (e) { /* später */ }
  }, 1500);
  // CLUB wird beim Laden nur überschrieben (Object.assign) – die Marke darf nicht in einen anderen Spielstand oder eine neue
  // Karriere wandern
  if (typeof window.expRestartAfterGameOver === 'function') {
    const _r = window.expRestartAfterGameOver;
    window.expRestartAfterGameOver = function () { try { delete CLUB.ksEntlassen; } catch (e) { /* ohne */ } return _r.apply(this, arguments); };
    try { expRestartAfterGameOver = window.expRestartAfterGameOver; } catch (e) { /* window reicht */ }
  }
  ['applyLoadedState', 'startNewGameState'].forEach(fn => {
    if (typeof window[fn] !== 'function') return;
    const _o = window[fn];
    window[fn] = function (l, c, clubObj) {
      try {
        delete CLUB.ksEntlassen;
        // Laden mischt per Object.assign: Kickstil-Felder (ks…) und CLUB.welt, die der geladene Stand nicht hat, stammen aus
        // dem vorher offenen Spielstand und müssen weg (sonst z. B. Erfolge/Sponsorentreffen eines anderen Spielstands).
        const neu = fn === 'applyLoadedState' && clubObj && clubObj.club;
        if (neu) Object.keys(CLUB).forEach(k => { if ((/^ks[A-Z]/.test(k) || k === 'welt') && !(k in neu)) delete CLUB[k]; });
      } catch (e) { /* ohne */ }
      return _o.apply(this, arguments);
    };
    try { if (fn === 'applyLoadedState') applyLoadedState = window[fn]; else startNewGameState = window[fn]; } catch (e) { /* window reicht */ }
  });
  // Philosophie-/Sponsorenwahl der neuen Saison entfällt nach der Entlassung
  ['openPhilosophyChoiceDialog', 'openSponsorChoiceDialog'].forEach(fn => {
    if (typeof window[fn] !== 'function') return;
    const _o = window[fn];
    window[fn] = function () { if (entlassen()) return; return _o.apply(this, arguments); };
    try { if (fn === 'openPhilosophyChoiceDialog') openPhilosophyChoiceDialog = window[fn]; else openSponsorChoiceDialog = window[fn]; } catch (e) { /* window reicht */ }
  });

  // ── Anzeige ───────────────────────────────────────────────────────────────
  let EL = null, SCHRITT = 0, RES = null;
  function titel(v) {
    if (v.pokalsieger && v.platz === 1) return { t: 'Das Double!', s: `Meister der ${LIGA_D[v.tier]} und Flutlichtpokalsieger`, k: 'gold', i: 'ti-crown' };
    if (v.platz === 1) return { t: 'Meister!', s: `Erster der ${LIGA_D[v.tier] || v.liga}${v.auf ? ' – und der Aufstieg in die ' + LIGA[v.tierNach] : ''}`, k: 'gold', i: 'ti-trophy' };
    if (v.auf) return { t: 'Aufstieg!', s: `Nächste Saison in der ${LIGA_D[v.tierNach] || v.ligaNach}`, k: 'gruen', i: 'ti-trending-up' };
    if (v.pokalsieger) return { t: 'Pokalsieger!', s: 'Der Flutlichtpokal gehört dir', k: 'gold', i: 'ti-cup' };
    if (v.ab && v.tierNach === 'regionalliga') return { t: 'Abstieg – und das Aus', s: 'In der Regionalliga ist für dich Schluss: Der Vorstand trennt sich von dir.', k: 'rot', i: 'ti-door-exit' };
    if (v.ab) return { t: 'Abstieg', s: `Nächste Saison in der ${LIGA_D[v.tierNach] || v.ligaNach} – Neustart mit Wut im Bauch`, k: 'rot', i: 'ti-trending-down' };
    if (v.platz <= Math.ceil((v.anzahl || 18) / 3)) return { t: 'Starke Saison', s: `Platz ${v.platz} in der ${LIGA_D[v.tier] || v.liga}`, k: 'blau', i: 'ti-star' };
    return { t: 'Klassenerhalt', s: `Platz ${v.platz} in der ${LIGA_D[v.tier] || v.liga}`, k: 'blau', i: 'ti-shield-check' };
  }
  function seite(v) {
    const z = v.zeile || {}, chr = (CLUB.chronicle || []).slice(-1)[0] || {};
    if (SCHRITT === 0) {
      const t = titel(v);
      return `<div class="kse-held ${t.k}"><i class="ti ${t.i}" aria-hidden="true"></i><b>${esc(t.t)}</b><small>${esc(t.s)}</small></div>
        <div class="kse-kacheln"><div><b>${v.platz || '–'}.</b><small>Platz</small></div><div><b>${z.pts != null ? z.pts : '–'}</b><small>Punkte</small></div>
          <div><b>${z.w != null ? `${z.w}·${z.d}·${z.l}` : '–'}</b><small>S·U·N</small></div><div><b>${z.gf != null ? `${z.gf}:${z.ga}` : '–'}</b><small>Tore</small></div></div>
        ${chr.cup ? `<p class="kse-zeile"><i class="ti ti-cup" aria-hidden="true"></i><span>Flutlichtpokal: <b>${esc(chr.cup)}</b></span></p>` : ''}
        ${RES && RES.tvMoney && RES.tvMoney.amount ? `<p class="kse-zeile"><i class="ti ti-device-tv" aria-hidden="true"></i><span>TV-Gelder: <b>${esc(typeof formatEuro === 'function' ? formatEuro(RES.tvMoney.amount) : RES.tvMoney.amount)}</b></span></p>` : ''}
        ${chr.att ? `<p class="kse-zeile"><i class="ti ti-users" aria-hidden="true"></i><span>Zuschauerschnitt: <b>${chr.att.toLocaleString('de-DE')}</b></span></p>` : ''}`;
    }
    if (SCHRITT === 1) {
      const K = v.karten || {}, KK = window.KSKarten;
      const gross = K.sds && KK ? `<div class="kse-karte">${KK.karteHtml(K.sds)}</div><p class="kse-mitte"><b>Spieler der Saison</b><br><small>${esc(K.sds.grund)}</small></p>` : '<p class="kse-mitte">Kein Spieler kam auf genug Einsätze für „Spieler der Saison“.</p>';
      const klein = ['torjaeger', 'talent'].filter(k => K[k]).map(k => `<figure class="kse-klein">${KK.karteHtml(K[k], { klein: true })}<figcaption><b>${esc(KK.ED[k].name)}</b><small>${esc(K[k].grund)}</small></figcaption></figure>`).join('');
      return `<h3 class="kse-h">Deine Besten</h3>${gross}${klein ? `<div class="kse-reihe">${klein}</div>` : ''}
        ${chr.breakout ? `<p class="kse-zeile"><i class="ti ti-trending-up" aria-hidden="true"></i><span>Durchbruch: <b>${esc(chr.breakout.name)}</b> ${chr.breakout.from} → ${chr.breakout.to}</span></p>` : ''}
        ${chr.topAssist ? `<p class="kse-zeile"><i class="ti ti-shoe" aria-hidden="true"></i><span>Meiste Vorlagen: <b>${esc(chr.topAssist.name)}</b> (${chr.topAssist.assists})</span></p>` : ''}`;
    }
    if (SCHRITT === 2) {
      const log = (RES && RES.log) || [];
      // Relegation und „Direktaufstieg (Wechsel)“ sind keine eigenen Aufsteiger – der Sieger steht ohnehin mit „steigt … auf“ in der Liste
      const rel = log.filter(l => /^Relegation zur/.test(l));
      const auf = log.filter(l => /aufsteig|steigt .*auf|Aufstieg/i.test(l) && !/^Relegation zur|Direktaufstieg in dieser Saison/.test(l)), ab = log.filter(l => /steigt .*ab|Abstieg/i.test(l));
      return `<h3 class="kse-h">Die Ligen</h3>
        <div class="kse-meister">${v.meister.map(m => `<div class="${m.id === 'fcm' ? 'du' : ''}"><i class="ti ti-trophy" aria-hidden="true"></i><span><small>Meister ${esc(m.liga)}</small><b>${esc(neu(m.name))}</b></span></div>`).join('')}
          ${v.pokalName ? `<div class="${v.pokalsieger ? 'du' : ''}"><i class="ti ti-cup" aria-hidden="true"></i><span><small>Flutlichtpokal</small><b>${esc(neu(v.pokalName))}</b></span></div>` : ''}</div>
        ${auf.length ? `<p class="kse-unter"><i class="ti ti-arrow-up" aria-hidden="true"></i> Aufsteiger</p><ul class="kse-liste">${auf.map(l => `<li>${esc(neu(l))}</li>`).join('')}</ul>` : ''}
        ${rel.map(l => `<p class="kse-zeile"><i class="ti ti-swords" aria-hidden="true"></i><span>${esc(neu(l.replace(/ → .*$/, '')))}</span></p>`).join('')}
        ${ab.length ? `<p class="kse-unter"><i class="ti ti-arrow-down" aria-hidden="true"></i> Absteiger</p><ul class="kse-liste">${ab.map(l => `<li>${esc(neu(l))}</li>`).join('')}</ul>` : ''}`;
    }
    const naechste = typeof seasonYearLabel === 'function' && typeof LEAGUE !== 'undefined' && LEAGUE ? seasonYearLabel(LEAGUE.season) : '';
    return `<div class="kse-laden"><i class="ti ti-ball-football kse-ball" aria-hidden="true"></i><b>Saison ${esc(naechste)} wird vorbereitet</b>
        <div class="kse-balken"><i></i></div><blockquote>„${esc(zufall(SPRUECHE))}“</blockquote>
        <p class="kse-tipp"><i class="ti ti-bulb" aria-hidden="true"></i><span><b>Tipp:</b> ${esc(zufall(tippsHier()))}</span></p>
        <div class="kse-anzeige" aria-hidden="true"></div></div>`;
  }
  function zeichnen() {
    const v = LETZTE; if (!v || !EL) return;
    const letzte = SCHRITT === 3;
    EL.querySelector('.kse-box').innerHTML = `<div class="kse-kopf"><small>Saisonabschluss ${esc(v.label)} · ${esc(LIGA[v.tier] || v.liga || '')}</small>
        <span class="kse-punkte">${[0, 1, 2, 3].map(i => `<i class="${i === SCHRITT ? 'an' : ''}"></i>`).join('')}</span></div>
      <div class="kse-inhalt">${seite(v)}</div>
      <div class="kse-fuss">${SCHRITT > 0 && !letzte ? '<button type="button" class="kse-knopf leise" data-kse="zurueck">Zurück</button>' : ''}
        ${SCHRITT === 0 && typeof window.openChronicle === 'function' ? '<button type="button" class="kse-knopf leise" data-kse="chronik">Chronik</button>' : ''}
        <button type="button" class="kse-knopf" data-kse="${letzte ? 'fertig' : 'weiter'}" ${letzte ? 'disabled' : ''}>${letzte ? 'Auf in die neue Saison' : 'Weiter'}</button></div>`;
    if (letzte) {
      // Pflichtanzeige zum Saisonabschluss (nur in der App mit Werbe-Anbieter); der Knopf wird nach dem Laden frei
      try { if (window.KSWerbung) KSWerbung.uebergang('saison'); } catch (e) { /* ohne Anzeige */ }
      setTimeout(() => { const k = EL && EL.querySelector('[data-kse="fertig"]'); if (k) k.disabled = false; }, 2600);
    }
  }
  function zeigen(result) {
    RES = result || null;
    if (!LETZTE) { try { if (window.Chronicle && Chronicle.showSeasonRecap) Chronicle.showSeasonRecap((CLUB.chronicle || []).slice(-1)[0], result); } catch (e) { /* nichts */ } return; }
    if (!EL) {
      EL = document.createElement('div'); EL.id = 'ks-saisonende';
      EL.innerHTML = '<div class="kse-box" role="dialog" aria-modal="true" aria-label="Saisonabschluss"></div>';
      EL.addEventListener('click', ev => {
        const k = ev.target.closest('[data-kse]'); if (!k) return;
        const a = k.getAttribute('data-kse');
        if (a === 'weiter') SCHRITT = Math.min(3, SCHRITT + 1);
        else if (a === 'zurueck') SCHRITT = Math.max(0, SCHRITT - 1);
        else if (a === 'chronik') { try { openChronicle(); } catch (e) { /* ohne Chronik */ } return; }
        else if (a === 'fertig') { EL.classList.remove('auf'); if (entlassen()) setTimeout(entlassung, 200); return; }
        zeichnen();
      });
      document.body.appendChild(EL);
    }
    SCHRITT = 0; zeichnen();
    requestAnimationFrame(() => EL.classList.add('auf'));
  }
  if (typeof window.showSeasonEndSummary === 'function') {
    window.showSeasonEndSummary = zeigen;
    try { showSeasonEndSummary = window.showSeasonEndSummary; } catch (e) { /* window reicht */ }
  }

  const css = document.createElement('style');
  css.textContent = `#ks-saisonende{position:fixed;inset:0;z-index:11000;display:none;align-items:center;justify-content:center;padding:14px;background:rgb(6 6 5/.92)}
  #ks-saisonende.auf{display:flex}
  .kse-box{width:100%;max-width:440px;max-height:calc(100vh - 28px);overflow-y:auto;background:var(--bg2,#fffaf0);color:var(--text,#2b2a26);border:3px solid var(--k-rahmen,#8b5a2b);
    border-radius:22px;box-shadow:0 8px 0 var(--k-rahmen,#8b5a2b);padding:14px 16px 16px;font-family:var(--font-text,system-ui);display:flex;flex-direction:column;gap:10px}
  html.dark .kse-box{background:var(--bg2,#1e2230)}
  .kse-kopf{display:flex;align-items:center;justify-content:space-between}.kse-kopf small{font:800 11px/1 system-ui;letter-spacing:.08em;text-transform:uppercase;color:var(--text3,#846d52)}
  .kse-punkte{display:flex;gap:5px}.kse-punkte i{width:8px;height:8px;border-radius:50%;background:var(--bg4,#c9b48f)}.kse-punkte i.an{background:var(--k-blau,#2c7cb5);width:20px;border-radius:5px}
  .kse-held{display:flex;flex-direction:column;align-items:center;text-align:center;gap:4px;padding:18px 10px;border-radius:18px;color:#fff}
  .kse-held i{font-size:44px}.kse-held b{font:700 30px/1.05 var(--font-titel,Fredoka,system-ui)}.kse-held small{font-size:14px;opacity:.9}
  .kse-held.gold{background:linear-gradient(150deg,#f0c05a,#c98a12);color:#2a1c02}.kse-held.gruen{background:linear-gradient(150deg,#25c065,#188a46)}
  .kse-held.blau{background:linear-gradient(150deg,#2c7cb5,#1d5a86)}.kse-held.rot{background:linear-gradient(150deg,#d6584a,#9a2a20)}
  .kse-kacheln{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}.kse-kacheln div{background:var(--bg3,#efe2c8);border-radius:12px;padding:8px 4px;text-align:center}
  .kse-kacheln b{display:block;font:800 18px/1.1 var(--font-zahl,system-ui)}.kse-kacheln small{font-size:11px;color:var(--text3,#846d52)}
  .kse-zeile{display:flex;gap:8px;align-items:center;margin:0;font-size:14px}.kse-zeile i{font-size:18px;color:var(--k-blau,#2c7cb5)}
  .kse-h{margin:2px 0;font:700 20px/1.1 var(--font-titel,Fredoka,system-ui)}
  .kse-karte{display:grid;place-items:center;padding:4px 0}.kse-mitte{text-align:center;margin:0}.kse-mitte small{color:var(--text3,#846d52)}
  .kse-reihe{display:flex;justify-content:center;gap:8px;flex-wrap:wrap}.kse-klein{margin:0;display:flex;flex-direction:column;align-items:center}
  .kse-klein figcaption{text-align:center;display:flex;flex-direction:column;font-size:12px}.kse-klein small{color:var(--text3,#846d52);font-size:11px}
  .kse-meister{display:grid;gap:6px}.kse-meister div{display:flex;gap:10px;align-items:center;padding:8px 10px;border-radius:12px;background:var(--bg3,#efe2c8)}
  .kse-meister div.du{background:linear-gradient(150deg,#f0c05a,#d39a1a);color:#2a1c02}.kse-meister i{font-size:22px;color:var(--k-gold,#c9a227)}.kse-meister div.du i{color:#2a1c02}
  .kse-meister span{display:flex;flex-direction:column}.kse-meister small{font-size:11px;opacity:.75}
  .kse-unter{margin:6px 0 0;font:800 12px/1 system-ui;letter-spacing:.06em;text-transform:uppercase;color:var(--text3,#846d52)}
  .kse-liste{margin:4px 0 0;padding-left:18px;font-size:13px;line-height:1.45}
  .kse-laden{display:flex;flex-direction:column;align-items:center;text-align:center;gap:12px;padding:10px 4px}
  .kse-ball{font-size:46px;color:var(--k-gruen,#25c065);animation:kse-dreh 1.4s linear infinite}@keyframes kse-dreh{to{transform:rotate(360deg)}}
  .kse-laden b{font:700 19px/1.2 var(--font-titel,Fredoka,system-ui)}
  .kse-balken{width:100%;height:10px;border-radius:6px;background:var(--bg3,#efe2c8);overflow:hidden}.kse-balken i{display:block;height:100%;width:0;background:var(--k-gruen,#25c065);animation:kse-lauf 2.6s ease-out forwards}
  @keyframes kse-lauf{to{width:100%}}
  .kse-laden blockquote{margin:0;font:600 17px/1.35 var(--font-titel,Fredoka,system-ui)}
  .kse-tipp{display:flex;gap:8px;text-align:left;margin:0;padding:10px 12px;border-radius:12px;background:var(--bg3,#efe2c8);font-size:13px}.kse-tipp i{font-size:20px;color:var(--k-gold,#c9a227)}
  .kse-fuss{display:flex;gap:8px;justify-content:flex-end;margin-top:4px}
  .kse-knopf{font:700 15px/1 var(--font-titel,Fredoka,system-ui);border:0;border-radius:12px;padding:12px 16px;cursor:pointer;color:#fff;background:var(--k-gruen,#25c065);box-shadow:0 4px 0 var(--k-gruen-tief,#188a46)}
  .kse-knopf.leise{background:var(--bg3,#efe2c8);color:inherit;box-shadow:0 3px 0 var(--k-rand,#d9c29a)}.kse-knopf:disabled{opacity:.5;cursor:default}
  @media (prefers-reduced-motion:reduce){.kse-ball,.kse-balken i{animation:none}.kse-balken i{width:100%}}
  .ks-entlassen{background:rgb(6 6 5/.9)!important}
  .ks-entlassen .exp-gameover-box{background:var(--bg2,#fffaf0);color:var(--text,#2b2a26);border:3px solid var(--k-rahmen,#8b5a2b);border-radius:22px;
    box-shadow:0 8px 0 var(--k-rahmen,#8b5a2b);padding:22px 18px;max-width:400px;margin:0 16px}
  html.dark .ks-entlassen .exp-gameover-box{background:var(--bg2,#1e2230)}
  .ks-entlassen .exp-gameover-text{color:var(--text2,#5a4a36)}`;
  document.head.appendChild(css);

  window.KSSaisonende = { zeigen, letzte: () => LETZTE };
  console.log('[Kickstil-Saisonabschluss v1] aktiv — Ergebnis, deine Besten (Sonderkarten), die Ligen, Ladebildschirm mit Saison-Werbeplatz');
})();
