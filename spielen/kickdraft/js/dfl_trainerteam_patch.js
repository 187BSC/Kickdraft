/* ═══════════════════════════════════════════════════════════════════════════
   DFL-TRAINERTEAM IM SPIEL  ·  v1  (D118)
   ─────────────────────────────────────────────────────────────────────────
   Eigener Verein: vier Plätze (Co-Trainer, Athletik & Physio, Sportpsychologe,
   Standardtrainer) mit 1–5 Sternen, Kandidaten-Blatt mit Wirkung in einer Zeile
   und „Einstellen · x Mio € / Saison“, Verlängern, Entlassen (Restgehalt der
   laufenden Saison). Front Office-Kachel „Trainerteam“ (dfl_app_shell.js).
   Wirkung im Spiel: Eingewöhnung (dfl_taktik_patch.js), Entwicklung (traitDevFaktor),
   Verletzungen/Reha (dfl_medizin_patch.js), Fitness-Erholung, Moral nach
   Niederlagen, Wechselwunsch (dfl_wechsel_patch.js), Elfmeterschießen
   (dfl_playoffs_patch.js), Standards (Engine v3 über die Brücke, dfl_engine_patch.js),
   Eigenschaften zum Saisonwechsel.
   Geld: Gehälter im Saisonplan (dfl_finanz_patch.js, DFLTrainerteam.saisonKosten),
   Einstellungen mitten in der Saison ab der Woche (wöchentliche Abweichung).
   Markt: nach dem Draft (DFLAnalysten.draftFertig) und in der Winterpause (Woche 26).
   Zustand: Welt (t.trainer am eigenen Verein, L.trainer), CLUB.dfl.trainer = { abfindung, winter }.
   API: DFLTrainerteam.blatt() · .kandidatenBlatt(rolle) · .sterne(rolle) · .saisonKosten() · .kachelText() · .sterneHtml(n)
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const Tr = window.DFLTrainer, D = window.DFLSpiel;
  if (!Tr || !D) { console.warn('[DFL-Trainerteam] DFLTrainer/DFLSpiel fehlen – Patch inaktiv'); return; }

  const dfl = () => typeof CLUB !== 'undefined' && CLUB && CLUB.dfl && CLUB.dfl.aktiv && typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.dfl;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const geld = x => (typeof formatEuro === 'function' ? formatEuro(x) : Math.round(x) + ' €');
  const ROLLEN = () => Tr.CFG.rollen;
  const ICON = { co: 'ti-clipboard-list', physio: 'ti-stethoscope', psycho: 'ti-brain', standard: 'ti-target-arrow', scout: 'ti-user-search', chef: 'ti-users' };

  function zustand() {
    if (!dfl()) return null;
    if (!CLUB.dfl.trainer) CLUB.dfl.trainer = { abfindung: 0, winter: null };
    return CLUB.dfl.trainer;
  }
  // Welt bereit: eigener Verein bekannt, Trainerteams und Markt angelegt (alte Spielstände bekommen sie hier)
  function welt() {
    if (!dfl()) return null;
    const L = D.liga(); if (!L) return null;
    const id = D.eigeneDflId();
    if (Tr.eigen() !== id) Tr.setzeEigen(id);
    if (!L.trainer || L.teams.some(Tr.fehlt)) {
      const profil = CLUB.dfl.eigner && CLUB.dfl.eigner.profil;
      Tr.sicherstellen(L, { profil });
    }
    return L;
  }
  const eigenTeam = () => { const L = welt(); return L ? L.teams.find(t => t.id === D.eigeneDflId()) : null; };
  const sterne = rolle => Tr.sterne(eigenTeam(), rolle);
  const saisonJahr = () => { const L = welt(); return L ? L.saisonJahr || 0 : 0; };

  // ── Geld ─────────────────────────────────────────────────────────────────
  // Gehälter der laufenden Saison + Restgehalt Entlassener (zählt bis zum Saisonende weiter)
  function saisonKosten() {
    const t = eigenTeam(), z = zustand();
    return t ? Tr.gehaelter(t) + ((z && z.abfindung) || 0) : 0;
  }
  const letzteSpielwoche = () => { const w = (LEAGUE && LEAGUE.matchWeeks) || []; return w.length ? w[w.length - 1] : 34; };
  const restAnteil = () => Math.max(0, Math.min(1, (letzteSpielwoche() - (LEAGUE.week || 1)) / Math.max(1, letzteSpielwoche() - 1)));

  // ── Sterne (immer fünf Icons, D120-Logzeile 2026-10-13) ─────────────────────
  function sterneHtml(n) {
    let h = '';
    for (let i = 1; i <= 5; i++) h += `<i class="ti ${i <= n ? 'ti-star-filled' : 'ti-star'}" aria-hidden="true"></i>`;
    return `<span class="tt-sterne" role="img" aria-label="${n} von 5 Sternen">${h}</span>`;
  }
  function gesicht(p) {
    try {
      if (window.DFLIdentitaet && DFLIdentitaet.gesichtSvg) {
        const L = welt(), t = L && L.teams.find(x => x.id === D.eigeneDflId());
        const svg = DFLIdentitaet.gesichtSvg({ seed: p.seed, dflSeed: p.seed, firstName: p.firstName, name: p.name, id: p.id }, t);
        if (svg) return `<span class="tt-bild">${svg}</span>`;
      }
    } catch (e) { /* ohne Gesicht */ }
    return `<span class="tt-bild tt-kuerzel">${esc((p.firstName || ' ')[0] + (p.name || ' ')[0])}</span>`;
  }
  const jahreText = p => { const j = (p.bis || 0) - saisonJahr() + 1; return j <= 1 ? 'letztes Jahr' : `${j} Jahre`; };

  // ── Blatt: vier Plätze ───────────────────────────────────────────────────
  function blattInhalt() {
    const t = eigenTeam(); if (!t) return '';
    const plaetze = ROLLEN().map(r => {
      const p = t.trainer && t.trainer[r], R = Tr.ROLLE[r];
      if (!p) return `<button type="button" class="tt-platz leer" data-rolle="${r}"><span class="tt-bild tt-icon"><i class="ti ${ICON[r]}" aria-hidden="true"></i></span>
        <span class="tt-name"><b>${esc(R.name)}</b><small>nicht besetzt</small></span><span class="tt-suchen">Suchen</span></button>`;
      return `<button type="button" class="tt-platz" data-rolle="${r}">${gesicht(p)}
        <span class="tt-name"><b>${esc(Tr.voll(p))}</b><small>${esc(R.name)} · ${esc(jahreText(p))}</small></span>${sterneHtml(p.sterne)}</button>`;
    }).join('');
    return `<div class="app-griff"></div><button class="app-blatt-zu" aria-label="Schließen"><i class="ti ti-x" aria-hidden="true"></i></button>
      <div class="app-sheet-titel">Trainerteam</div>
      <div class="anl-summe tt-summe"><div><b>${esc(geld(Tr.gehaelter(t)))}</b><span>je Saison</span></div>
        <div><b>${esc(geld(CLUB.budget || 0))}</b><span>Kasse</span></div></div>
      <div class="tt-plaetze">${plaetze}</div>`;
  }
  function oeffnen(html, onclick) {
    const box = document.querySelector('#app-blatt .app-blatt-box');
    if (!box) return false;
    box.innerHTML = html; box.onclick = onclick;
    document.getElementById('app-blatt').classList.add('auf'); document.body.classList.add('app-gesperrt');
    if (window.DFLAppShell && DFLAppShell.cta) DFLAppShell.cta();
    return true;
  }
  function blatt() {
    if (!welt()) return;
    oeffnen(blattInhalt(), ev => {
      const b = ev.target.closest('.tt-platz'); if (b) kandidatenBlatt(b.getAttribute('data-rolle'));
    });
  }

  // ── Blatt: Kandidaten einer Rolle (oben die aktuelle Person) ─────────────────
  let auswahl = null, jahre = 2;
  function kandidatenInhalt(rolle) {
    const L = welt(), t = eigenTeam(); if (!L || !t) return '';
    const R = Tr.ROLLE[rolle], jetzt = t.trainer && t.trainer[rolle];
    const liste = Tr.kandidaten(L, rolle);
    const zeile = (p, aktuell) => {
      const offen = auswahl === p.id, gehalt = aktuell ? p.gehalt : Tr.gehaltFuer(p.sterne, L);
      const meta = aktuell ? `${jahreText(p)} · ${geld(p.gehalt)}` : `${p.alter} J.${p.spez ? ' · ' + p.spez : ''}${p.ex === 'hof' ? ' · Hall of Fame' : ''} · ${geld(gehalt)}`;
      let mehr = '';
      if (offen) {
        const wirk = `<div class="tt-wirkung">${esc(Tr.wirkungText(rolle, p.sterne))}</div>`;
        if (aktuell) {
          const rest = Math.round(p.gehalt * restAnteil());
          const neu = Tr.gehaltFuer(p.sterne, L);
          mehr = `${wirk}<div class="tt-knoepfe">
            <button type="button" class="app-knopf tt-verlaengern" data-a="verlaengern" data-id="${p.id}">Verlängern · ${esc(geld(neu))} / Saison</button>
            <button type="button" class="app-knopf tt-entlassen" data-a="entlassen" data-id="${p.id}">Entlassen${rest > 0 ? ' · Restgehalt ' + esc(geld(rest)) : ''}</button></div>`;
        } else {
          const knapp = (CLUB.budget || 0) < gehalt * restAnteil();
          mehr = `${wirk}<div class="tt-jahre" role="group" aria-label="Vertrag">${[1, 2, 3].map(j => `<button type="button" class="tt-chip${j === jahre ? ' an' : ''}" data-a="jahre" data-j="${j}">${j} ${j === 1 ? 'Jahr' : 'Jahre'}</button>`).join('')}</div>
            <button type="button" class="app-knopf tt-einstellen" data-a="einstellen" data-id="${p.id}" ${knapp ? 'disabled' : ''}>Einstellen · ${esc(geld(gehalt))} / Saison</button>
            ${knapp ? '<div class="tt-grund">Kasse reicht nicht</div>' : ''}`;
        }
      }
      return `<div class="tt-kand${offen ? ' offen' : ''}${aktuell ? ' aktuell' : ''}"><button type="button" class="tt-kopf" data-a="wahl" data-id="${p.id}">${gesicht(p)}
        <span class="tt-name"><b>${esc(Tr.voll(p))}</b><small>${esc(meta)}</small></span>${sterneHtml(p.sterne)}</button>${mehr}</div>`;
    };
    return `<div class="app-griff"></div><button class="app-blatt-zu" aria-label="Schließen"><i class="ti ti-x" aria-hidden="true"></i></button>
      <button type="button" class="tt-zurueck" data-a="zurueck"><i class="ti ti-chevron-left" aria-hidden="true"></i> Trainerteam</button>
      <div class="app-sheet-titel">${esc(R.name)}</div>
      ${jetzt ? zeile(jetzt, true) : ''}
      <div class="tt-unter">${liste.length} Kandidaten</div>
      <div class="tt-liste">${liste.map(p => zeile(p, false)).join('')}</div>`;
  }
  function kandidatenBlatt(rolle) {
    if (!welt()) return;
    const neu = () => oeffnen(kandidatenInhalt(rolle), klick);
    const klick = ev => {
      const b = ev.target.closest('[data-a]'); if (!b || b.disabled) return;
      const a = b.getAttribute('data-a'), id = b.getAttribute('data-id');
      if (a === 'zurueck') { auswahl = null; blatt(); return; }
      if (a === 'wahl') { auswahl = auswahl === id ? null : id; neu(); return; }
      if (a === 'jahre') { jahre = +b.getAttribute('data-j') || 2; neu(); return; }
      if (a === 'einstellen') { if (einstellen(rolle, id, jahre)) { auswahl = null; blatt(); } return; }
      if (a === 'verlaengern') { verlaengern(rolle); neu(); return; }
      if (a === 'entlassen') { entlassen(rolle); auswahl = null; neu(); }
    };
    neu();
  }

  // ── Aktionen ─────────────────────────────────────────────────────────────
  function einstellen(rolle, id, j) {
    const L = welt(), t = eigenTeam(); if (!L || !t) return false;
    const p = Tr.kandidaten(L, rolle).find(x => x.id === id); if (!p) return false;
    if (t.trainer && t.trainer[rolle]) entlassen(rolle, true);
    Tr.einstellen(L, t, p, j || 2);
    nachAenderung();
    hinweis(`${Tr.voll(p)} ist neuer ${Tr.ROLLE[rolle].name}`, 'success');
    return true;
  }
  function entlassen(rolle, still) {
    const L = welt(), t = eigenTeam(), z = zustand(); if (!L || !t || !t.trainer || !t.trainer[rolle]) return;
    const p = t.trainer[rolle];
    // Restgehalt: die Saison ist im Plan bezahlt; nach dem letzten Spieltag ist nichts mehr offen
    if (LEAGUE.week <= letzteSpielwoche()) z.abfindung = (z.abfindung || 0) + p.gehalt;
    Tr.entlassen(L, t, rolle);
    nachAenderung();
    if (!still) hinweis(`${Tr.voll(p)} entlassen`, 'info');
  }
  function verlaengern(rolle) {
    const L = welt(), t = eigenTeam(); if (!L || !t || !t.trainer || !t.trainer[rolle]) return;
    const p = t.trainer[rolle];
    p.bis = Math.max(p.bis || 0, saisonJahr()) + 2;
    p.gehalt = Tr.gehaltFuer(p.sterne, L);
    nachAenderung();
    hinweis(`${Tr.voll(p)} verlängert bis ${p.bis}`, 'success');
  }
  function hinweis(text, art) { try { if (typeof showToast === 'function') showToast(text, art || 'info'); } catch (e) { /* ohne Hinweis */ } }
  function nachAenderung() {
    try { if (typeof saveGameState === 'function') saveGameState(); } catch (e) { /* Speichern optional */ }
    try { const v = document.getElementById('view-fo'); if (v && v.classList.contains('active') && window.DFLAppShell) DFLAppShell.foZeigen(); } catch (e) { /* Ansicht fehlt */ }
  }
  function kachelText() {
    const t = eigenTeam(); if (!t) return 'Trainerteam';
    const n = ROLLEN().filter(r => t.trainer && t.trainer[r]).length;
    return n < ROLLEN().length ? `${ROLLEN().length - n} ${ROLLEN().length - n === 1 ? 'Platz' : 'Plätze'} frei` : `${geld(Tr.gehaelter(t))} / Saison`;
  }

  // ── Meldungen (Postfach, kurz) ───────────────────────────────────────────
  const teamName = id => { const L = welt(); const t = L && L.teams.find(x => x.id === id); return t ? t.name : ''; };
  Tr.setzeMelder(ev => {
    if (typeof addNews !== 'function') return;
    const p = ev.person, n = Tr.voll(p), R = Tr.ROLLE[ev.rolle] || { name: '' };
    if (ev.art === 'abwerbung') addNews('club', 'Trainer abgeworben', `${n} (${R.name}) wechselt zu ${teamName(ev.zu)}.`);
    else if (ev.art === 'chefcoach') addNews('club', 'Co-Trainer wird Chefcoach', `${n} übernimmt ${teamName(ev.zu)} als Chefcoach.`);
    else if (ev.art === 'vertragsende') addNews('club', 'Vertrag ausgelaufen', `${n} (${R.name}) geht.`);
    else if (ev.art === 'rente') addNews('club', 'Trainer geht in Rente', `${n} (${R.name}) hört auf.`);
    else if (ev.art === 'entwicklung') addNews('club', `${n}: ${p.sterne} Sterne`, `${R.name} · ein Jahr Erfahrung mehr.`);
  });

  // ── Wirkung im eigenen Spiel ─────────────────────────────────────────────
  const imKader = p => typeof SQUAD !== 'undefined' && Array.isArray(SQUAD) && SQUAD.indexOf(p) >= 0;
  // Entwicklung im Training (Co-Trainer): bundle_match.js fragt traitDevFaktor je Spieler
  {
    const _orig = window.traitDevFaktor;
    if (typeof _orig === 'function') {
      window.traitDevFaktor = function (p) {
        const f = _orig.apply(this, arguments);
        try { if (dfl() && imKader(p)) return f * Tr.entwFaktor(eigenTeam()); } catch (e) { /* ohne Trainer */ }
        return f;
      };
      try { traitDevFaktor = window.traitDevFaktor; } catch (e) { /* nur im Spiel */ }
    }
  }
  // Moral nach Niederlagen (Psychologe): ein Teil des Verlusts kommt zurück
  {
    const _orig = window.processFixtureResult;
    if (typeof _orig === 'function') {
      window.processFixtureResult = function () {
        let vorher = null, niederlage = false;
        try {
          if (dfl() && typeof SQUAD !== 'undefined') {
            vorher = new Map(SQUAD.map(p => [p, p.morale]));
            const fx = typeof CURRENT_FIXTURE !== 'undefined' ? CURRENT_FIXTURE : null;
            niederlage = !(fx && fx.type === 'friendly') && typeof G !== 'undefined' && G && G.homeGoals < G.awayGoals;
          }
        } catch (e) { vorher = null; }
        const r = _orig.apply(this, arguments);
        try {
          const f = 1 - Tr.moralFaktor(eigenTeam());
          if (vorher && niederlage && f > 0) vorher.forEach((m, p) => {
            if (typeof m !== 'number' || typeof p.morale !== 'number' || p.morale >= m) return;
            const zurueck = (m - p.morale) * f, ganz = Math.floor(zurueck);
            p.morale = Math.min(m, p.morale + ganz + (Math.random() < zurueck - ganz ? 1 : 0));
          });
        } catch (e) { /* ohne Moral */ }
        return r;
      };
      try { processFixtureResult = window.processFixtureResult; } catch (e) { /* nur im Spiel */ }
    }
  }
  // Woche: Fitness-Erholung (Physio), Winterpause (Markt, Woche 26)
  {
    const _orig = window.advanceCalendarWeek;
    if (typeof _orig === 'function') {
      window.advanceCalendarWeek = function () {
        let fit = null;
        try { if (dfl() && typeof SQUAD !== 'undefined') fit = new Map(SQUAD.map(p => [p, p.fitness])); } catch (e) { fit = null; }
        const r = _orig.apply(this, arguments);
        if (r === false || !dfl()) return r;
        try {
          const ph = Tr.physio(eigenTeam());
          if (fit && ph) fit.forEach((f, p) => { if (typeof f === 'number' && typeof p.fitness === 'number' && p.fitness > f && p.fitness < 100) p.fitness = Math.min(100, p.fitness + (p.fitness - f) * (Tr.fitnessFaktor(ph) - 1)); });
        } catch (e) { /* ohne Fitness */ }
        try {
          const z = zustand(), L = welt();
          if (L && z && LEAGUE.week >= 26 && LEAGUE.week <= 27 && z.winter !== LEAGUE.season) {
            z.winter = LEAGUE.season;
            Tr.winter(L, Tr.rngVon(L, 'winter-spiel'), { ohne: [D.eigeneDflId()], kasseVon });
          }
        } catch (e) { console.warn('[DFL-Trainerteam] Winterpause', e); }
        return r;
      };
      try { advanceCalendarWeek = window.advanceCalendarWeek; } catch (e) { /* nur im Spiel */ }
    }
  }
  const kasseVon = t => (t.id === D.eigeneDflId() ? (CLUB.budget || 0) : t.kasse);
  // Nach dem Draft: Markt, Abwerben, KI besetzt
  if (window.DFLAnalysten && typeof DFLAnalysten.draftFertig === 'function') {
    const _orig = DFLAnalysten.draftFertig;
    DFLAnalysten.draftFertig = function (d) {
      const r = _orig.apply(this, arguments);
      if (d && d.start) return r;            // D108: erster Draft vor Saison 1 – die Trainerteams stehen gerade erst, kein Markt
      try { const L = welt(); if (L) Tr.nachDraft(L, Tr.rngVon(L, 'draft-spiel'), { ohne: [D.eigeneDflId()], kasseVon }); } catch (e) { console.warn('[DFL-Trainerteam] Markt nach dem Draft', e); }
      return r;
    };
  }
  // Saisonwechsel: Restgehälter sind bezahlt (vor dem neuen Plan); danach der Psychologe am eigenen Kader
  {
    const _orig = window.startNewSeason;
    if (typeof _orig === 'function') {
      window.startNewSeason = function () {
        try { const z = zustand(); if (z) z.abfindung = 0; } catch (e) { /* ohne Zustand */ }
        const r = _orig.apply(this, arguments);
        try {
          const L = welt();
          if (L && typeof SQUAD !== 'undefined') {
            const e = Tr.eigenschaftWuerfeln(Tr.rngVon(L, 'psycho-eigen'), SQUAD.filter(p => !p.onLoanAt), sterne('psycho'));
            if (e) {
              const K = window.Traits && Traits.katalog, tn = (K && K[e.key] && K[e.key].name) || e.key, pn = typeof displayName === 'function' ? displayName(e.p) : e.p.name;
              if (e.art === 'neu') { e.p.traitsBekannt = e.p.traitsBekannt || []; if (e.p.traitsBekannt.indexOf(e.key) < 0) e.p.traitsBekannt.push(e.key); }
              const ps = eigenTeam().trainer.psycho;
              if (typeof addNews === 'function') addNews('club', e.art === 'neu' ? `${pn}: ${tn}` : `${pn} legt „${tn}“ ab`,
                ps ? `${Tr.voll(ps)}: „${e.art === 'neu' ? 'Er ist reifer geworden.' : 'Die Arbeit hat sich gelohnt.'}“` : '');
            }
          }
        } catch (e) { console.warn('[DFL-Trainerteam] Saisonwechsel', e); }
        return r;
      };
      try { startNewSeason = window.startNewSeason; } catch (e) { /* nur im Spiel */ }
    }
  }
  // Neue Karriere: Trainerteam nach dem Profil des eigenen Eigentümers
  {
    const _orig = window.startNewGameState;
    if (typeof _orig === 'function') {
      window.startNewGameState = async function () {
        const r = await _orig.apply(this, arguments);
        try { if (dfl()) { CLUB.dfl.trainer = { abfindung: 0, winter: null }; welt(); } } catch (e) { console.warn('[DFL-Trainerteam] Start', e); }
        return r;
      };
    }
  }

  // Spielstand schon geladen (initGame lädt vor den Patches): Welt anlegen; laufende Saison ohne Trainer im Plan → ab jetzt anteilig
  try {
    if (dfl()) {
      welt(); zustand();
      const bd = CLUB._budgetBreakdown;
      if (bd && bd.income && bd.dflTrainer == null) { bd.dflTrainer = 0; bd.dflTrainerAbw = 0; }
    }
  } catch (e) { console.warn('[DFL-Trainerteam] Laden', e); }

  window.DFLTrainerteam = { blatt, kandidatenBlatt, sterne, saisonKosten, kachelText, sterneHtml, einstellen, entlassen, verlaengern, eigenTeam, welt };
  console.log('[DFL-Trainerteam v1] aktiv — vier Plätze mit Sternen, Kandidaten, Verlängern/Entlassen, Wirkung auf Eingewöhnung, Entwicklung, Verletzungen, Moral, Elfmeter, Standards (D118)');
})();
