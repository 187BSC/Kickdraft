/* ═══════════════════════════════════════════════════════════════════════════
   DFL · WECHSELWÜNSCHE UND ABGABEN  ·  v1   (D99, Vorschau spiel/dfl_scout_vorschau.html, freigegeben 2026-10-10, eingebaut 2026-10-11)
   ─────────────────────────────────────────────────────────────────────────
   Nutzer 2026-10-10: „Dass generell Spieler getradet werden möchten oder der Verein einen Spieler aktiv wegtradet, sollte noch
   mehr im Spiel sein.“
     · Welt (DFLHandel): KI-Spieler wollen weg (Stimmung im eigenen Verein unter −2,0, endet über −1,5 oder mit dem Wechsel; nie im
       Rookie-Vertrag bis 22), Vereine geben ab (Cap-Not, Neuaufbau, Stil, Überschuss – nie gesperrte, Top 3, große Talente); Preis
       85 % bzw. 90 % des Werts in jedem Tausch, KI-Tausche nehmen diese Spieler zuerst. Hier: im Wechselfenster wöchentlich auffrischen.
     · Scout-Bericht: zwei Listen im Scouting unter „Bericht“ (DFLScouting.listeAnmelden, D78): „Wollen weg“ und „Werden abgegeben“, zu
       dir passend sortiert – Lücke in deiner Kaderanalyse, Passung zu deinem Stil (nur mit Scout-Bericht), Cap; fremde Spieler wie
       überall nur mit Stufe ohne Bericht. Im Wechselfenster alle 4 Wochen eine Meldung im Postfach (mit „Ansehen“).
     · Angebote an dich: dfl_anfragen_patch.js (art 'angebot'); Filter „Zu haben“: dfl_trade_patch.js.
     · Dein Kader (Vorschlag der Vorschau, Frage 4): wer bei dir unter −2,0 fällt, will auch weg – zusätzlich zum Wunsch aus der
       Einsatzzeit (contracts_patch.js). Meldung im Postfach, Marke wie beim Trade-Wunsch (p.wantsOut = 'stimmung', Gründe in
       p.dflWeg); endet über −1,5.
     · v2 (Welt-Paket, 2026-10-11): höchstens 3 eigene Wechselwünsche aus der Stimmung gleichzeitig (CFG.eigenMax) – wer schon weg
       will, bleibt dabei, bis seine Stimmung über −1,5 steigt; freie Plätze bekommen die mit der schlechtesten Stimmung.
   Zustand: CLUB.dfl.wechsel = { bericht: { s, w }, n: { [saison]: { berichte, eigen, ruhig, weg, ab } } }; Welt: p.weg (EXTRA).
   Hängt sich an: advanceCalendarWeek (vorher: Wünsche der Welt; danach: Bericht, eigener Kader), buildPostfachItems (Texte, Knopf),
   renderPlayerCard (Grund statt „Wert gedrückt“).
   API: DFLWechsel. Lädt nach dfl_scouting_patch.js und vor dfl_oberflaeche_patch.js/dfl_bilder_patch.js (deren Postfach bleibt die äußerste
   Hülle; „Stimmung im Kader“ zeigt den Grund über DFLWechsel.grundKurz). CSS: css/dfl_wechsel.css.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const G = window.DFLGenerator, H = window.DFLHandel, D = window.DFLSpiel;
  if (!G || !H || !D || !H.zuHabenListe) { console.warn('[DFL-Wechsel] DFL-Module fehlen – Patch inaktiv'); return; }

  // eigenMax: höchstens so viele eigene Wechselwünsche aus der Stimmung gleichzeitig (Welt-Paket 2026-10-11)
  const CFG = { berichtAlle: 4, liste: 8, aus: false, eigenMax: 3 };
  const hatClub = () => typeof CLUB !== 'undefined' && CLUB;
  const dfl = () => !!(hatClub() && CLUB.dfl && CLUB.dfl.aktiv && typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.dfl);
  const aktiv = () => !CFG.aus && dfl() && H.CFG.zuHaben && H.CFG.zuHaben.aktiv;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ico = n => `<i class="ti ti-${n}" aria-hidden="true"></i>`;
  const voll = p => (p.firstName ? p.firstName + ' ' : '') + p.name;
  const kurz = p => (p.firstName ? p.firstName.charAt(0) + '. ' : '') + p.name;
  const posName = x => x === 'OM' ? 'ZOM' : x;
  const fensterOffen = () => LEAGUE.matchday < H.CFG.deadlineSpieltag;
  const SC = () => (window.DFLScouting && DFLScouting.aktiv() ? window.DFLScouting : null);
  const GRUND = { cap: 'Cap-Not', neuaufbau: 'Neuaufbau', stil: 'passt nicht zu ihrem Stil', ueberschuss: 'Überschuss' };
  // Gründe der Stimmung kurz (ohne Zahlen in Klammern – „unterbezahlt (1,0 statt ~2,4 Mio)“ verriete das Marktgehalt und damit die Stärke)
  const WEG_KURZ = { markt: 'kleine Bühne', anlagen: 'schwache Anlagen', hype: 'Umfeld frustriert' };
  const wegText = g => WEG_KURZ[g.k] || String(g.t || '').replace(/ \(.*\)$/, '');

  function zustand() {
    if (!dfl()) return null;
    const z = CLUB.dfl.wechsel = CLUB.dfl.wechsel || {};
    if (!z.n || typeof z.n !== 'object') z.n = {};
    return z;
  }
  const zaehl = (k, n) => { const z = zustand(); if (!z) return; const s = z.n[LEAGUE.season] = z.n[LEAGUE.season] || {}; s[k] = (s[k] || 0) + (n == null ? 1 : n); };
  function welt() { const L = D.welt(); H.picks(L); H.taktikenSetzen(L); return L; }
  const eigenId = () => D.eigeneDflId();

  // ── Welt: Wünsche auffrischen (ohne deinen Verein – seine Spieler sind SQUAD) ──
  function aktualisieren() {
    if (!aktiv()) return null;
    const L = welt();
    return H.wechselwunschAktualisieren(L, { ohne: [eigenId()] });
  }

  // ── Wer passt zu dir? (Lücke deiner Kaderanalyse, Stil nur mit Scout-Bericht, Cap, Stärke nach deiner Sicht – D78) ──
  function eigeneAnalyse(L) {
    const e = D.eigenSync() || L.teams.find(t => t.id === eigenId());
    if (!e) return { e: null, ana: {}, frei: 0 };
    const sc = (CLUB.facilities && CLUB.facilities.scouting) || 5;
    return { e, ana: G.kaderAnalyse(e, { scouting: sc, saat: (CLUB.dfl.saisonIndex || 0) * 101 }), frei: e.salary_cap_limit - G.capHitTeam(e) };
  }
  function bewertet(L, liste) {
    const { ana, frei } = eigeneAnalyse(L), s = SC();
    return liste.map(z => {
      const p = z.p, bedarf = (ana[p.pos] && ana[p.pos].bedarf) || 0;
      // eingehende Spieler zählen ohne Handgeld (bleibt beim alten Verein, C4) – wie die Cap-Prüfung des Tauschs
      const hit = p.contract ? p.contract.base_salary + (p.contract.guaranteed_bonuses || 0) : 0;
      const pa = s && s.hatBericht(p) && s.passung ? s.passung(p) : null;
      const st = s ? s.sortWert(p) % 1000 : p.ovr;
      return Object.assign({ bedarf, cap: hit <= frei, pa, fit: bedarf + (pa && pa.relevant ? (pa.pct - 50) / 25 : 0) + st / 8 + (hit <= frei ? 0.5 : 0) }, z);
    }).sort((a, b) => b.fit - a.fit);
  }
  function liga(L) { return H.zuHabenListe(L || welt(), { ohne: [eigenId()] }); }

  // ── Scout-Bericht: zwei Listen im Reiter „Bericht“ (D78) ───────────────────
  // Zeile kompakt: Marke „will weg“ bzw. erster Abgabe-Grund, „Lücke“ (deine Kaderanalyse), „Cap knapp“ nur wenn er nicht passt;
  // die weiteren Gründe stehen in der Unterzeile hinter dem Verein (Preis 85/90 % steht in der Überschrift der Liste)
  const CHIP_ART = { cap: 'schlecht', neuaufbau: 'mittel', stil: 'info', ueberschuss: '' };
  function chipsVon(x) {
    const c = [];
    if (x.art === 'weg') c.push(`<span class="d99-chip schlecht">${ico('door-exit')}will weg</span>`);
    else { const g = x.gruende.find(k => GRUND[k]); if (g) c.push(`<span class="d99-chip ${CHIP_ART[g]}">${esc(GRUND[g])}</span>`); }
    if (x.bedarf >= H.CFG.zuHaben.angebot.bedarf) c.push(`<span class="d99-chip gut">${ico('plus')}Lücke</span>`);
    if (!x.cap) c.push(`<span class="d99-chip mittel">${ico('coin')}Cap knapp</span>`);
    return c.join('');
  }
  function subVon(x) {
    const T = x.team, wappen = `<span class="lg-crest sc-wappen" style="${typeof crestStyle === 'function' ? crestStyle(D.spielId(T.id)) : ''}" aria-hidden="true"></span>`;
    const mehr = x.art === 'weg' ? ((x.weg && x.weg.gruende) || []).slice(0, 2).map(wegText) : x.gruende.filter(g => GRUND[g]).slice(1).map(g => GRUND[g]);
    // Gründe vor dem Kürzel (das Wappen zeigt den Verein schon) – wird es zu lang, fällt das Kürzel weg statt des Grunds
    return `${wappen}<span class="d99-sub">${mehr.length ? esc(mehr.join(', ')) + ' · ' : ''}${esc(T.kurz || T.name)}</span>`;
  }
  let listenCache = { k: '', weg: [], ab: [] };
  function listen() {
    const L = welt();
    const k = LEAGUE.season + ':' + LEAGUE.week + ':' + (L.handel || []).length + ':' + L.teams.reduce((s, t) => s + t.roster.length, 0) + ':' + ((CLUB.facilities && CLUB.facilities.scouting) || 5)
      + ':' + Object.keys((CLUB.dfl.scouting && CLUB.dfl.scouting.berichte) || {}).length;
    if (listenCache.k !== k) {
      const alle = bewertet(L, liga(L));
      listenCache = { k, weg: alle.filter(x => x.art === 'weg'), ab: alle.filter(x => x.art === 'ab') };
    }
    return listenCache;
  }
  function zeilen(art) {
    try {
      return listen()[art].slice(0, CFG.liste).map(x => ({ id: String(x.p.id), w: x.p, quelle: 'liga', team: x.team, chips: chipsVon(x), sub: subVon(x) }));
    } catch (e) { console.warn('[DFL-Wechsel] Liste', e); return []; }
  }
  if (window.DFLScouting && DFLScouting.listeAnmelden) {
    DFLScouting.listeAnmelden({ key: 'd99-weg', titel: 'Wollen weg', icon: 'door-exit', leer: 'Gerade will bei den anderen Vereinen niemand weg.',
      get sub() { try { const n = listen().weg.length; return n ? `${Math.min(n, CFG.liste)} von ${n} · zu dir passend sortiert · Preis 85 %` : ''; } catch (e) { return ''; } },
      zeilen: () => zeilen('weg') });
    DFLScouting.listeAnmelden({ key: 'd99-ab', titel: 'Werden abgegeben', icon: 'tag', leer: 'Gerade gibt kein Verein jemanden ab.',
      get sub() { try { const n = listen().ab.length; return n ? `${Math.min(n, CFG.liste)} von ${n} · alle in der Trade-Zentrale unter „Zu haben“ · Preis 90 %` : ''; } catch (e) { return ''; } },
      zeilen: () => zeilen('ab') });
  }
  // Meldung alle 4 Wochen im Wechselfenster: Zahlen + die drei, die am besten zu dir passen (Namen, keine Stärke – D78)
  function bericht(opt) {
    opt = opt || {};
    const z = zustand(); if (!z || !aktiv()) return null;
    if (!opt.immer) {
      if (!fensterOffen()) return null;
      const b = z.bericht;
      if (b && b.s === LEAGUE.season && LEAGUE.week - b.w < CFG.berichtAlle) return null;
    }
    const l = listen(), top = l.weg.concat(l.ab).sort((a, b) => b.fit - a.fit).slice(0, 3);
    z.bericht = { s: LEAGUE.season, w: LEAGUE.week, weg: l.weg.length, ab: l.ab.length };
    zaehl('berichte');
    if (typeof addNews === 'function') {
      addNews('transfer', `🔭 Scout-Bericht: ${l.weg.length} wollen weg, ${l.ab.length} werden abgegeben`,
        (top.length ? 'Passend für dich: ' + top.map(x => `${voll(x.p)} (${posName(x.p.pos)}, ${x.team.kurz || x.team.name}, ${x.art === 'weg' ? 'will weg' : x.gruende.filter(g => GRUND[g]).map(g => GRUND[g]).join(', ')})`).join(' · ') + '. ' : '') +
        'Alles im Scouting unter „Bericht“, alle in der Trade-Zentrale unter „Zu haben“.');
    }
    return z.bericht;
  }
  // „Ansehen“: Scouting, Reiter „Bericht“
  function berichtZeigen() {
    const s = window.DFLScouting; if (!s) return;
    const ui = s.ui ? s.ui() : null; if (ui) { ui.tab = 'bericht'; ui.wahl = null; }
    const shell = document.body && document.body.classList.contains('dfl-shell');
    if (window.DFLAppShell && shell && DFLAppShell.zeige) DFLAppShell.zeige('scout');
    else if (typeof switchAppView === 'function') switchAppView('scout', document.getElementById('nav-scout'));
    try { s.zeichne(); } catch (e) { /* Ansicht optional */ }
    setTimeout(() => { const el = document.getElementById('dfl-scouting'); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start' }); }, 60);
  }

  // ── Dein Kader: Wechselwunsch aus der Stimmung (Vorschlag der Vorschau) ───
  // Höchstens CFG.eigenMax gleichzeitig: bestehende Wünsche zuerst (bis die Stimmung über −1,5 steigt), freie Plätze nach der
  // schlechtesten Stimmung; wer darüber hinaus unter −2,0 liegt, schweigt (noch). Alte Stände mit mehr Wünschen behalten die schlechtesten.
  function eigeneStimmung() {
    const ST = window.DFLStimmung;
    if (!aktiv() || !ST || typeof SQUAD === 'undefined') return [];
    const L = welt(), t = D.eigenSync();
    if (!t) return [];
    const Z = H.CFG.zuHaben, aus = [], kandidaten = [];
    const psy = window.DFLTrainer ? DFLTrainer.wegVerschiebung(t) : 0;      // D118: Sportpsychologe
    const elf = new Set(G.startelfVon(t.roster, t).map(x => x.id)), spieltag = new Set(t.roster.slice().sort((x, y) => y.ovr - x.ovr).slice(0, 18).map(x => x.id));
    SQUAD.forEach(q => {
      if (q.perspektiv || q.onLoanAt || q.onLoanFrom) { if (q.dflWeg) ende(q, true); return; }
      const w = t.roster.find(x => x.sq === q.id);
      if (!w) return;
      if (w.contract && w.contract.art === 'rookie' && w.age <= Z.rookieBis) { if (q.dflWeg) ende(q, true); return; }
      const s = ST.stimmung(w, t, L, { elf, spieltag });
      if (s.summe < Z.weg - psy || (q.dflWeg && s.summe <= Z.wegEnde - psy)) kandidaten.push({ q, s });
      else if (q.dflWeg) ende(q);
    });
    kandidaten.sort((a, b) => (!!b.q.dflWeg - !!a.q.dflWeg) || a.s.summe - b.s.summe);
    kandidaten.forEach(({ q, s }, i) => {
      if (i >= CFG.eigenMax) { if (q.dflWeg) ende(q, true); return; }
      const gruende = s.teile.filter(x => x.wert < 0).slice(0, 3).map(x => ({ k: x.key, t: String(x.text).replace(/ \(.*\)$/, '') }));
      if (!q.dflWeg) {
        q.dflWeg = { seit: LEAGUE.season, woche: LEAGUE.week, summe: s.summe, gruende };
        aus.push(q); zaehl('eigen');
        // Wer schon wegen der Einsatzzeit weg will (contracts_patch.js), bekommt keine zweite Meldung
        if (!q.wantsOut && typeof addNews === 'function') {
          addNews('club', `✈️ Trade-Wunsch: ${q.name}`, `${typeof displayName === 'function' ? displayName(q) : voll(q)} will weg – ${gruende.map(wegText).join(', ') || 'die Stimmung stimmt nicht'}. ` +
            'Bessert sich seine Stimmung (neuer Vertrag, mehr Einsatzzeit, Erfolg), bleibt er – sonst trade ihn.');
        }
      } else Object.assign(q.dflWeg, { summe: s.summe, gruende });
      if (!q.wantsOut) q.wantsOut = 'stimmung';
    });
    return aus;
  }
  // Grund kurz (Postfach-Karte „Stimmung im Kader“, dfl_bilder_patch.js): die zwei stärksten Gründe
  function grundKurz(q) { return q && q.dflWeg ? ((q.dflWeg.gruende || []).slice(0, 2).map(wegText).join(', ') || 'Stimmung') : ''; }
  function ende(q, still) {
    delete q.dflWeg;
    if (q.wantsOut === 'stimmung') {
      delete q.wantsOut;
      if (!still) {
        zaehl('ruhig');
        if (typeof addNews === 'function') addNews('club', `😌 Beruhigt: ${q.name}`, `${typeof displayName === 'function' ? displayName(q) : voll(q)} will wieder bleiben – die Sache ist vom Tisch.`);
      }
    }
  }

  // ── Wochentakt ────────────────────────────────────────────────────────────
  // vorher (vor Anfragen/Angeboten und KI-Tauschen der Woche): Wünsche der Welt; danach: Bericht, eigener Kader
  {
    const _orig = window.advanceCalendarWeek;
    if (typeof _orig === 'function') {
      window.advanceCalendarWeek = function () {
        const vorher = dfl() ? LEAGUE.season + ':' + LEAGUE.week : null;
        if (aktiv() && fensterOffen()) { try { aktualisieren(); } catch (e) { console.warn('[DFL-Wechsel] Wünsche der Welt', e); } }
        const r = _orig.apply(this, arguments);
        if (dfl() && LEAGUE.season + ':' + LEAGUE.week !== vorher) {
          try { eigeneStimmung(); } catch (e) { console.warn('[DFL-Wechsel] eigener Kader', e); }
          try { bericht(); } catch (e) { console.warn('[DFL-Wechsel] Scout-Bericht', e); }
        }
        return r;
      };
      try { advanceCalendarWeek = window.advanceCalendarWeek; } catch (e) { /* nur im Spiel */ }
    }
  }
  // Postfach: Trade-Wunsch aus der Stimmung mit Gründen (statt „Wert sinkt“), Scout-Bericht mit „Ansehen“
  {
    const _orig = window.buildPostfachItems;
    if (typeof _orig === 'function') {
      window.buildPostfachItems = function () {
        const items = _orig.apply(this, arguments);
        if (!dfl()) return items;
        try {
          const nm = q => (typeof displayName === 'function' ? displayName(q) : voll(q));
          (typeof SQUAD !== 'undefined' ? SQUAD : []).filter(q => q.dflWeg && q.wantsOut === 'stimmung' && !q.onStrike).forEach(q => {
            const it = items.find(i => i.cat === 'warn' && i.title === `Trade-Wunsch: ${nm(q)}`);
            if (it) it.text = `Will weg: ${q.dflWeg.gruende.map(wegText).join(', ') || 'Stimmung'}. Vertrag, Einsatzzeit oder Erfolg stimmen ihn um – sonst traden.`;
          });
          items.forEach(i => {
            if (i.cat === 'news' && !i.actions && /^\S*\s*Scout-Bericht: \d+ wollen weg/.test(i.title || '')) i.actions = `<button class="pf-btn" onclick="DFLWechsel.berichtZeigen()">Ansehen</button>`;
          });
        } catch (e) { console.warn('[DFL-Wechsel] Postfach', e); }
        return items;
      };
      try { buildPostfachItems = window.buildPostfachItems; } catch (e) { /* nur im Spiel */ }
    }
  }

  // Spielerkarte (app_main.js): beim Trade-Wunsch aus der Stimmung der Grund statt „Wert gedrückt“ (der Abschlag hängt nur an der Moral)
  {
    const _orig = window.renderPlayerCard;
    if (typeof _orig === 'function') {
      window.renderPlayerCard = function (p) {
        const r = _orig.apply(this, arguments);
        try {
          if (dfl() && p && p.wantsOut === 'stimmung' && p.dflWeg && !p.onStrike) {
            const el = document.querySelector('#playercard-sec .pcard-status.wantsout');
            if (el) el.textContent = `✈️ Trade-Wunsch – die Stimmung stimmt nicht: ${grundKurz(p)}. Kein Wertabschlag; bessert sie sich, bleibt er.`;
          }
        } catch (e) { /* Karte bleibt wie gezeichnet */ }
        return r;
      };
      try { renderPlayerCard = window.renderPlayerCard; } catch (e) { /* nur im Spiel */ }
    }
  }

  // Zähler je Saison (Bot, Prüfung): Berichte, eigene Wünsche, Angebote an dich (dfl_anfragen_patch.js), Stand der Liga
  function zaehler() {
    const z = zustand(); if (!z) return null;
    const ang = (CLUB.dfl.angebote && CLUB.dfl.angebote.n) || {}, aus = {};
    Object.keys(z.n).concat(Object.keys(ang)).forEach(s => { aus[s] = Object.assign({}, z.n[s] || {}, ang[s] ? { angebot: ang[s] } : {}); });
    try { const l = listen(); aus.jetzt = { weg: l.weg.length, ab: l.ab.length }; } catch (e) { /* ohne Welt */ }
    return aus;
  }
  // Spielstand schon geladen (initGame lädt vor den Patches): Zustand anlegen
  try { if (dfl()) zustand(); } catch (e) { /* ohne Spielstand */ }

  window.DFLWechsel = { CFG, aktiv, aktualisieren, liga, listen, bewertet, bericht, berichtZeigen, eigeneStimmung, grundKurz, zaehler, zustand };
  console.log('%c[DFL-Wechsel v2] aktiv', 'color:#3fb950;font-weight:bold',
    '— D99: Wechselwünsche (Stimmung unter −2,0) und Abgaben der KI, Scout-Bericht alle 4 Wochen, Listen im Scouting, Trade-Wunsch im eigenen Kader (höchstens 3)');
})();
