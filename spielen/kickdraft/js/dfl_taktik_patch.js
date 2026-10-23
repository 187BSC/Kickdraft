/* ═══════════════════════════════════════════════════════════════════════════
   DFL · TAKTIK-STILE  ·  v2   (D55, Zahlen freigegeben 2026-10-09: „macht das Spiel intuitiver und einfacher“)
   ─────────────────────────────────────────────────────────────────────────
   Schere-Stein-Papier der vier Spielstile: Gegenpressing → Ballbesitz → Flügelspiel → Direktes Angriffsspiel →
   Gegenpressing („schlägt“), gegenüber ausgeglichen. Formel und Zahlen liegen in DFLSaison (CFG.stil, stilFaktor),
   die stärkebereinigte Spielerpassung in DFLHandel (stilPassung) – damit rechnen Spiel, Langzeitlauf und Prüflauf gleich.
     · Eigener Verein: CLUB.dfl.taktik = { stil, eing } – Start mit dem Stil, der am besten zum Kader passt (100 %).
       Umstellen: zum Nachbarn höchstens 50 %, zum Gegenüber höchstens 20 % Eingewöhnung; +12 Punkte je eigenem Spiel
       (auch Testspiele – genau dafür ist die Vorbereitung da). Unter 60 % entwickeln sich die eigenen Spieler 15 % langsamer.
     · KI-Vereine: Stil aus D50 (DFLHandel.taktikenSetzen), Wechsel mit neuem Zielwert und seit L3 (Welt-Paket) zum Saisonwechsel, wenn ein
       anderer Stil klar besser passt (DFLHandel.stilPruefen); Eingewöhnung nach denselben Regeln. Neue Karriere: Stil und Formation des Vereins aus der Welt.
     · Wirkung (Stufe 1): Engine v3 bekommt je Team einen Faktor an derselben Stelle wie den Heimvorteil (xG + Reaktion),
       KI-Spiele und Spiele ohne Engine multiplizieren die Torerwartung (DFLSaison.toreErwartet).
     · Ansicht: Kader → Taktik oben: Kreis mit Pfeilen, Gegner-Stil rot umrandet, Urteil gegen den nächsten Gegner,
       Eingewöhnungsring, Stilfaktor-Karte, Stilkarten mit Formationen, „Wer passt?“.
     · v2 (2026-10-09, Nutzer: „die Taktikregler am besten jetzt raus“): die 6 Regler, Repertoire und Eingespieltheit
       der alten Minuten-Engine sind in der DFL ausgeblendet (body.dfl-taktik); „Anpfiff“ rechnet wie „Spiel simulieren“
       mit Engine v3 – eine Engine für alle eigenen Spiele, mit Stilfaktor.
   API: DFLTaktik.STILE · .eigenerStil() · .stilSetzen(stil) · .stilVon(spielId) · .stilInfo(spielId) · .faktor(gegner, opt)
        · .engineFaktoren() · .passung(stil) · .entwicklungsFaktor() · .zeichne()
   Braucht: DFLSaison, DFLHandel, DFLSpiel. Lädt nach dfl_analysten_patch.js, vor dfl_design_patch.js.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const S = window.DFLSaison, H = window.DFLHandel, D = window.DFLSpiel;
  if (!S || !H || !D || !S.stilFaktor) { console.warn('[DFL-Taktik] DFL-Module fehlen – Patch inaktiv'); return; }

  const dfl = () => typeof CLUB !== 'undefined' && CLUB && CLUB.dfl && CLUB.dfl.aktiv && typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.dfl;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const de = (x, d) => Number(x).toLocaleString('de-DE', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  const C = () => S.CFG.stil;
  // Symbole (Nutzer 2026-10-10: „passende Fußballelemente“ statt Feuer/Wasser/Wind): Sprinter fürs Pressing, Ball für
  // Ballbesitz, Eckfahne für das Spiel über die Flügel, Schuh für den langen Ball
  const STILE = {
    pressing: { name: 'Gegenpressing', kurz: 'Pressing', ic: 'ti-run', farbe: '#fb7185', formationen: ['4-2-3-1', '4-3-3', '4-2-2-2'], schlaegt: 'erstickt den langsamen Aufbau' },
    ballbesitz: { name: 'Geduldiger Ballbesitz', kurz: 'Ballbesitz', ic: 'ti-ball-football', farbe: '#38bdf8', formationen: ['4-3-3', '4-1-4-1', '4-2-3-1'], schlaegt: 'macht die Mitte zu, Flanken kommen nicht' },
    fluegel: { name: 'Flügelspiel', kurz: 'Flügel', ic: 'ti-flag-3', farbe: '#a3e635', formationen: ['4-3-3', '3-4-3', '5-2-3'], schlaegt: 'zieht das Konterteam auseinander' },
    direkt: { name: 'Direktes Angriffsspiel', kurz: 'Direkt', ic: 'ti-shoe', farbe: '#fbbf24', formationen: ['4-4-2', '4-4-1-1', '3-5-2'], schlaegt: 'spielt lange Bälle hinter die hohe Kette' }
  };
  const KREIS = S.KREIS;
  const formationPasst = (stil, f) => !!(STILE[stil] && STILE[stil].formationen.indexOf(f) >= 0);

  // ── Zustand ──────────────────────────────────────────────────────────────
  const welt = () => D.liga();
  const eigenWelt = () => { try { return D.eigenSync() || welt().teams.find(t => t.id === D.eigeneDflId()); } catch (e) { return null; } };
  function zustand() {
    if (!dfl()) return null;
    const z = CLUB.dfl.taktik;
    if (z && STILE[z.stil]) return z;
    // Start: der Stil, der (stärkebereinigt) am besten zum eigenen Kader passt, voll eingewöhnt
    const L = welt(), e = eigenWelt();
    let best = 'ballbesitz';
    // Welt-Paket L3 (Nutzer 2026-10-11: „wenn die stark sind, muss der Trainer sich am Anfang darauf umstellen, selbst schuld“): der Verein
    // bringt Stil und Formation aus der Welt mit (Generator, Kader dafür gebaut); ohne Startstil wie bisher der am besten passende
    if (e && e.taktik && e.taktik.start && H.STILE.indexOf(e.taktik.stil) >= 0) {
      best = e.taktik.stil;
      if (e.formation && typeof FORMATIONS !== 'undefined' && FORMATIONS[e.formation] && formationPasst(best, e.formation)) { CLUB.formation = e.formation; CLUB.selected = null; }
    } else if (L && e) best = H.STILE.slice().sort((a, b) => H.stilPassung(L, e, b) - H.stilPassung(L, e, a))[0];
    CLUB.dfl.taktik = { stil: best, eing: 1 };
    // Neue Karriere: Formation und Elf gleich passend zum Stil (sonst startet jeder im 4-4-2 des Basisspiels)
    try { if (typeof SQUAD !== 'undefined' && SQUAD && SQUAD.length >= 11) besteElf(true, { formationWaehlen: true }); } catch (e) { console.warn('[DFL-Taktik] Start-Elf', e); }
    return CLUB.dfl.taktik;
  }
  // „Beste Elf“ (Nutzer 2026-10-09: „automatische erste Elf, ohne viel rumzuschieben“): beste Besetzung der Formation.
  // Fehler 2026-10-10 (Nutzer: „wählt immer 5-3-2 und bleibt nicht bei der aktuellen Formation“): vorher nahm sie immer die
  // stärkste Formation des Stils (Ø der Elf – mit vielen guten Verteidigern gewinnt die Fünferkette). Jetzt bleibt die
  // Formation; nur wenn sie nicht zum Stil passt (Stilwechsel, Karrierestart), kommt die passende mit derselben Zahl an
  // Verteidigern (sonst die stärkste passende). opt.formationWaehlen = beim Stilwechsel/Karrierestart.
  const abwehr = f => +String(f).split('-')[0] || 4;
  function formationFuer(stil, aktuell) {
    const st = STILE[stil];
    if (!st || typeof FORMATIONS === 'undefined') return aktuell;
    const liste = st.formationen.filter(f => FORMATIONS[f]);
    if (!liste.length || liste.indexOf(aktuell) >= 0) return aktuell;
    const gleich = liste.filter(f => abwehr(f) === abwehr(aktuell || '4-4-2')), kand = gleich.length ? gleich : liste;
    if (typeof window.bewerteFormation !== 'function') return kand[0];
    return kand.map(f => ({ f, w: window.bewerteFormation(f) })).sort((a, b) => b.w - a.w)[0].f;
  }
  function besteElf(still, opt) {
    const z = CLUB.dfl && CLUB.dfl.taktik;
    if (z && opt && opt.formationWaehlen) {
      const f = formationFuer(z.stil, CLUB.formation);
      if (f && f !== CLUB.formation) { CLUB.formation = f; CLUB.selected = null; }
    }
    if (still && typeof window.baueAufstellung === 'function') window.baueAufstellung(false);
    else if (typeof window.besteAufstellung === 'function') window.besteAufstellung();
    if (!still) { try { weltSync(); zeichne(); } catch (e) { /* Ansicht optional */ } }
    return CLUB.formation;
  }
  const eigenerStil = () => { const z = zustand(); return z ? { stil: z.stil, eing: z.eing } : null; };
  function wechselKosten(von, nach) { return S.wechselKosten(von, nach); }
  function stilSetzen(stil) {
    const z = zustand(); if (!z || !STILE[stil] || stil === z.stil) return eigenerStil();
    z.eing = Math.min(z.eing, wechselKosten(z.stil, stil));
    z.stil = stil;
    weltSync();
    if (typeof saveGameState === 'function') saveGameState();
    return eigenerStil();
  }
  // Eigener Verein in der Welt: Stil, Passung, Formation, Eingewöhnung (für Quoten, Saisonlauf, Power Rankings)
  function weltSync() {
    const z = zustand(), L = welt(), e = eigenWelt(); if (!z || !L || !e) return;
    H.stilAktualisieren(L);
    e.taktik = Object.assign(e.taktik || {}, { stil: z.stil, spieler: H.stilPassungProzent(L, e, z.stil), eing0: z.eing,
      eingSaison: L.saisonIndex || 0, formPasst: formationPasst(z.stil, CLUB.formation) });
  }
  function passung(stil) { const L = welt(), e = eigenWelt(); return L && e ? H.stilPassungProzent(L, e, stil) : 0; }

  // Stil eines Teams fürs Spiel (Formel und Engine): eigener Verein mit echter Formation und Eingewöhnung
  function stilVon(spielId) {
    if (!dfl() || spielId == null) return null;
    if (spielId === 'fcm') { const z = zustand(); return z ? z.stil : null; }
    const t = welt().teams.find(x => x.id === D.dflIdVon(spielId));
    if (t && !(t.taktik && t.taktik.stil && t.taktik.spieler != null)) H.stilAktualisieren(welt());
    return t && t.taktik ? t.taktik.stil : null;
  }
  function stilInfo(spielId, opt) {
    if (!dfl() || spielId == null) return null;
    opt = opt || {};
    if (spielId === 'fcm') {
      const z = zustand(); if (!z) return null;
      const stil = opt.stil || z.stil;
      return { key: stil, spieler: passung(stil), formPasst: formationPasst(stil, opt.formation || CLUB.formation),
        eing: stil === z.stil ? z.eing : Math.min(z.eing, wechselKosten(z.stil, stil)) };
    }
    const t = welt().teams.find(x => x.id === D.dflIdVon(spielId));
    if (!t) return null;
    // Saison 1: Passung der KI fehlte ganz (Prüfung 2026-10-09) → einmal für alle nachrechnen
    if (!(t.taktik && t.taktik.stil && t.taktik.spieler != null)) H.stilAktualisieren(welt());
    const tk = t.taktik || {};
    if (!tk.stil) return null;
    return { key: tk.stil, spieler: tk.spieler || 0, formPasst: tk.formPasst !== false,
      eing: Math.min(1, (tk.eing0 != null ? tk.eing0 : 1) + (C().jeSpiel + trBonus(t)) * (LEAGUE.matchday || 0)) };
  }
  // D118: Co-Trainer (und Chefcoach der KI) beschleunigen die Eingewöhnung
  const trBonus = t => (window.DFLTrainer && t ? DFLTrainer.eingBonus(t) : 0);
  const eigenTeam = () => { try { return welt().teams.find(x => x.id === D.eigeneDflId()); } catch (e) { return null; } };
  // Faktor des eigenen Vereins gegen einen Gegner (opt.stil: „was wäre, wenn“)
  function faktor(gegnerId, opt) {
    const a = stilInfo('fcm', opt), b = stilInfo(gegnerId);
    if (!a) return null;
    const f = S.stilFaktor(a, b || { key: null });
    return Object.assign(f, { stil: a.key, passt: a.formPasst, gegnerStil: b ? b.key : null });
  }
  // Für die Engine v3: [eigener Verein, Gegner] des aktuellen Spiels
  function engineFaktoren() {
    if (!dfl() || C().aus || typeof CURRENT_FIXTURE === 'undefined' || !CURRENT_FIXTURE || !CURRENT_FIXTURE.opponentId) return null;
    const a = stilInfo('fcm'), b = stilInfo(CURRENT_FIXTURE.opponentId);
    if (!a || !b) return null;
    return [S.stilFaktor(a, b).mult, S.stilFaktor(b, a).mult];
  }
  const entwicklungsFaktor = () => { const z = dfl() && zustand(); return z && z.eing < C().entwicklungUnter ? C().entwicklung : 1; };

  // ── Einhängen ────────────────────────────────────────────────────────────
  // KI-Spiele und eigene Spiele ohne Engine: ratingsOf trägt den Stil zur Formel (dfl_liga_patch.js → DFLSaison.toreErwartet)
  {
    const _orig = window.ratingsOf;
    if (typeof _orig === 'function') {
      window.ratingsOf = function (team) {
        const r = _orig.apply(this, arguments);
        if (!dfl() || !r || !team || C().aus) return r;
        try { const st = stilInfo(team.id); if (st) return Object.assign({}, r, { stil: st }); } catch (e) { /* ohne Stil */ }
        return r;
      };
      try { ratingsOf = window.ratingsOf; } catch (e) { /* nicht global gebunden */ }
    }
  }
  // Eingewöhnung: +12 Punkte je eigenem Spiel (Liga, Playoffs, Testspiel)
  {
    const _orig = window.postMatchContinue;
    if (typeof _orig === 'function') {
      window.postMatchContinue = function () {
        if (dfl()) { const z = zustand(); if (z && z.eing < 1) { z.eing = Math.min(1, Math.round((z.eing + C().jeSpiel + trBonus(eigenTeam())) * 100) / 100); weltSync(); } }
        return _orig.apply(this, arguments);
      };
      try { postMatchContinue = window.postMatchContinue; } catch (e) { /* nicht global gebunden */ }
    }
  }
  // Entwicklung: unter 60 % Eingewöhnung 15 % langsamer (nur eigener Kader)
  {
    const _orig = window.traitDevFaktor;
    window.traitDevFaktor = function (p) {
      const f = typeof _orig === 'function' ? _orig.apply(this, arguments) : 1;
      if (!dfl() || !p || typeof SQUAD === 'undefined' || SQUAD.indexOf(p) < 0) return f;
      return f * entwicklungsFaktor();
    };
  }
  // Formation gewechselt → Passung neu in die Welt
  {
    const _orig = window.changeFormation;
    if (typeof _orig === 'function') {
      window.changeFormation = function () { const r = _orig.apply(this, arguments); if (dfl()) { weltSync(); zeichne(); } return r; };
      try { changeFormation = window.changeFormation; } catch (e) { /* nicht global gebunden */ }
    }
  }
  // Welt geändert (Vorbereitung, Kaderschnitt, Free Agency, Trades): Passung aller Teams frisch halten
  if (D.weltGeaendert) {
    const _orig = D.weltGeaendert;
    D.weltGeaendert = function () { const r = _orig.apply(this, arguments); try { if (dfl()) weltSync(); } catch (e) { /* optional */ } return r; };
  }
  // Saisonwechsel: KI-Stile und Passung neu, eigener Verein bleibt eingewöhnt
  {
    const _orig = window.startNewSeason;
    if (typeof _orig === 'function') window.startNewSeason = function () {
      const r = _orig.apply(this, arguments);
      try { if (dfl()) weltSync(); } catch (e) { console.warn('[DFL-Taktik] Saisonwechsel', e); }
      return r;
    };
  }

  // ── Ansicht: Kader → Taktik ──────────────────────────────────────────────
  let gewaehlt = null;
  function ringSvg(anteil, farbe, text) {
    const r = 26, u = 2 * Math.PI * r;
    return `<svg class="stil-ring" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="${r}" class="stil-ring-grund"/>
      <circle cx="32" cy="32" r="${r}" fill="none" style="stroke:${farbe}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${(u * anteil).toFixed(1)} ${u.toFixed(1)}" transform="rotate(-90 32 32)"/>
      <text x="32" y="37" text-anchor="middle">${text}</text></svg>`;
  }
  function kreisSvg(wahl, gegner, gegnerKurz) {
    const pos = [[150, 64], [262, 172], [150, 280], [38, 172]];
    const pfeile = KREIS.map((s, i) => {
      const [x1, y1] = pos[i], [x2, y2] = pos[(i + 1) % 4], dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l;
      return `<line x1="${(x1 + ux * 40).toFixed(1)}" y1="${(y1 + uy * 40).toFixed(1)}" x2="${(x2 - ux * 42).toFixed(1)}" y2="${(y2 - uy * 42).toFixed(1)}" class="stil-pfeil" marker-end="url(#stil-spitze)"/>`;
    }).join('');
    const knoten = KREIS.map((s, i) => {
      const [x, y] = pos[i], st = STILE[s], ich = s === wahl, er = s === gegner;
      return `<g class="stil-knoten" data-stil="${s}" role="button" tabindex="0" aria-label="${st.name}${ich ? ', gewählt' : ''}${er ? ', Stil des Gegners' : ''}">
        ${er ? `<circle cx="${x}" cy="${y}" r="38" fill="none" class="stil-gegner"/>` : ''}
        <circle cx="${x}" cy="${y}" r="30" style="fill:${ich ? st.farbe : 'var(--bg3, #262a3a)'};stroke:${st.farbe}" stroke-width="3"/>
        <foreignObject x="${x - 14}" y="${y - 14}" width="28" height="28"><i class="ti ${st.ic}" style="font-size:26px;line-height:28px;color:${ich ? '#10161f' : st.farbe}" aria-hidden="true"></i></foreignObject>
        <text x="${x}" y="${y + (i === 0 ? -42 : 50)}" text-anchor="middle">${st.kurz}</text>
        ${er && gegnerKurz ? `<text x="${x}" y="${y + (i === 0 ? -56 : 64)}" text-anchor="middle" class="stil-gegner-name">${esc(gegnerKurz)}</text>` : ''}</g>`;
    }).join('');
    return `<svg class="stil-rad" viewBox="0 -10 300 360" role="group" aria-label="Kreis der Spielstile: Pfeil zeigt auf den Stil, den er schlägt">
      <defs><marker id="stil-spitze" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" class="stil-spitze"/></marker></defs>
      ${pfeile}${knoten}<text x="150" y="177" text-anchor="middle" class="stil-mitte">gegenüber: ausgeglichen</text></svg>`;
  }
  function faktorKarte(f, gegnerKurz) {
    const z = (text, v) => { const w = Math.min(50, Math.abs(v) / 6 * 50);
      return `<div class="stil-fz"><span>${text}</span><span class="stil-bal"><i style="${v >= 0 ? 'left' : 'right'}:50%;width:${w.toFixed(0)}%;background:${v > 0 ? 'var(--app-gut, #2ecc71)' : v < 0 ? 'var(--app-schlecht, #e74c3c)' : 'transparent'}"></i></span><b>${v > 0 ? '+' : v < 0 ? '−' : '±'}${de(Math.abs(v), Number.isInteger(v) ? 0 : 1)} %</b></div>`; };
    return `<div class="stil-karte stil-faktor"><div class="stil-titel"><b><i class="ti ti-target-arrow" aria-hidden="true"></i> Stilfaktor</b></div>
      ${f.gegnerStil ? z('Kreis gegen ' + esc(gegnerKurz || 'Gegner'), f.kreis) : ''}${z('Formation ' + esc(CLUB.formation) + (f.passt ? ' passt' : ' passt nicht'), f.formation)}${z('Spieler passen zum Stil', f.spieler)}
      ${f.roh > 0 && f.eing < 1 ? z('Eingewöhnung ' + Math.round(f.eing * 100) + ' % (Bonus anteilig)', -(Math.round((f.roh - f.summe) * 10) / 10)) : ''}
      <div class="stil-summe"><span>Torchancen</span><b class="${f.summe > 0 ? 'plus' : f.summe < 0 ? 'minus' : ''}">×${de(f.mult, 2)}</b></div></div>`;
  }
  function boxHtml() {
    const z = zustand(); if (!z) return '';
    if (!gewaehlt || !STILE[gewaehlt]) gewaehlt = z.stil;
    const n = typeof fcmNextFixture === 'function' && typeof seasonFullyComplete === 'function' && !seasonFullyComplete(LEAGUE) ? fcmNextFixture(LEAGUE) : null;
    const gId = n ? n.opponentId : null, gStil = gId ? stilVon(gId) : null;
    const gTeam = gId ? LEAGUE.tiers.bundesliga.groups[0].teams.find(t => t.id === gId) : null;
    const gKurz = gTeam ? (gTeam.kurz || (window.DFLNamen && DFLNamen.kuerzel(gId)) || gTeam.name) : '';
    const d = gStil ? S.duell(gewaehlt, gStil) : 0;
    const eing = gewaehlt === z.stil ? z.eing : Math.min(z.eing, wechselKosten(z.stil, gewaehlt));
    const f = faktor(gId, { stil: gewaehlt });
    const urteil = gStil ? `<div class="stil-karte stil-urteil ${d > 0 ? 'plus' : d < 0 ? 'minus' : ''}">
        <span class="lg-crest stil-wappen" style="${typeof crestStyle === 'function' ? crestStyle(gId) : ''}"></span>
        <span><b>${d > 0 ? 'Vorteil' : d < 0 ? 'Nachteil' : 'Ausgeglichen'} gegen ${esc(gTeam ? gTeam.name : 'den Gegner')}</b>
        <small>${d > 0 ? `+${C().kreis} % Torchancen` : d < 0 ? `−${C().kreis} % Torchancen` : `beide ±0 %`}</small></span></div>` : '';
    const ringFarbe = eing >= 1 ? 'var(--app-gut, #2ecc71)' : eing >= C().entwicklungUnter ? 'var(--app-mittel, #f1c40f)' : 'var(--app-schlecht, #e74c3c)';
    const L = welt(), e = eigenWelt();
    // D95: Gruppe ohne Seite; D156: Torhüter zählen mit (stilRelevant), mit ihrem Torwart-Typ
    const werPasst = e ? e.roster.filter(p => H.stilRelevant ? H.stilRelevant(p, gewaehlt) : H.STIL_POS[gewaehlt].indexOf(window.DFLGenerator ? DFLGenerator.grund(p.pos) : p.pos) >= 0)
      .map(p => ({ p, w: Math.round(H.stilWert(p, gewaehlt)) })).sort((a, b) => b.w - a.w).slice(0, 5) : [];
    const schnitt = L ? H.stilSchnitt(L)[gewaehlt] : 60;
    const karten = KREIS.map(s => {
      const st = STILE[s], pa = passung(s), d2 = gStil ? S.duell(s, gStil) : 0, w = wechselKosten(z.stil, s);
      const pf = Math.max(4, Math.min(100, 50 + pa * 12));
      return `<button type="button" class="stil-wahl-karte" data-stil="${s}" aria-pressed="${s === gewaehlt}">
        <span class="stil-icon" style="background:${st.farbe}"><i class="ti ${st.ic}" aria-hidden="true"></i></span>
        <span class="stil-name">${st.name}${s === z.stil ? ' <span class="stil-chip gut">aktuell</span>' : ''}</span>
        <span class="stil-pass" title="Passung des Kaders ${pa > 0 ? '+' : ''}${de(pa, 1)} %"><i style="width:${pf}%;background:${pa >= 1 ? 'var(--app-gut, #2ecc71)' : pa >= -1 ? 'var(--app-mittel, #f1c40f)' : 'var(--app-schlecht, #e74c3c)'}"></i></span>
        <span class="stil-zeile2">${st.formationen.map(fm => `<span class="stil-chip form${fm === CLUB.formation ? ' an' : ''}">${fm}</span>`).join('')}
          ${gStil ? `<span class="stil-chip ${d2 > 0 ? 'gut' : d2 < 0 ? 'schlecht' : ''}">${d2 > 0 ? '▲' : d2 < 0 ? '▼' : '='} ${esc(gKurz)}</span>` : ''}
          ${s !== z.stil ? `<span class="stil-chip ${w <= C().gegenueber ? 'schlecht' : 'mittel'}">→ ${Math.round(Math.min(z.eing, w) * 100)} %</span>` : ''}</span></button>`;
    }).join('');
    return `<div class="stil-box">
      <div class="stil-titel"><b>Spielstil</b></div>
      ${kreisSvg(gewaehlt, gStil, gKurz)}
      ${urteil}
      <div class="stil-karte stil-eing">${ringSvg(eing, ringFarbe, Math.round(eing * 100) + '%')}
        <span><b>Eingewöhnung</b><small>${eing >= 1 ? 'voll' : `+${Math.round((C().jeSpiel + trBonus(eigenTeam())) * 100)} % je Spiel`}</small>
          ${eing < C().entwicklungUnter ? `<span class="stil-chip schlecht"><i class="ti ti-clock" aria-hidden="true"></i>Entwicklung −${Math.round((1 - C().entwicklung) * 100)} %</span>` : ''}</span></div>
      ${f ? faktorKarte(f, gKurz) : ''}
      ${vorher && vorher.taktik.stil !== z.stil ? `<button type="button" class="app-knopf stil-zurueck" data-zurueck="1"><i class="ti ti-arrow-back-up" aria-hidden="true"></i>Rückgängig: zurück zu ${STILE[vorher.taktik.stil].name} · ${vorher.formation}</button>` : ''}
      <div class="stil-titel"><b>Stile</b></div>
      ${karten}
      <div class="stil-titel"><b>Wer passt zu ${STILE[gewaehlt].kurz}?</b><small>Liga Ø ${Math.round(schnitt)}</small></div>
      <div class="stil-wer">${werPasst.map(x => `<div class="stil-wer-zeile"><span class="pos-badge-sm pos-${x.p.pos}">${x.p.pos}</span><span>${esc((x.p.firstName ? x.p.firstName + ' ' : '') + x.p.name)}${H.twTyp && H.twTyp(x.p, gewaehlt) ? ` <small>${esc(H.twTyp(x.p, gewaehlt))}</small>` : ''}</span><b class="${x.w >= schnitt + 5 ? 'plus' : ''}">${x.w}</b></div>`).join('')}</div>
    </div>`;
  }
  // Fehler 2026-10-10 (Nutzer: „Die Taktik speichert nicht. Ich klicke auf Ballbesitz und es springt auf Flügelspiel“):
  // Antippen war nur eine Vorschau, gespeichert wurde erst mit einem zweiten Knopf – jeder Neuaufbau sprang zurück. Jetzt
  // gilt der Stil sofort; „Rückgängig“ stellt Stil, Eingewöhnung, Formation und Elf wieder her (solange die Ansicht offen ist).
  let vorher = null;
  function waehle(stil) {
    const z = zustand(); if (!z || !STILE[stil]) return;
    if (stil === z.stil) { gewaehlt = stil; zeichne(); return; }
    const merk = { taktik: Object.assign({}, z), formation: CLUB.formation, lineup: Object.assign({}, CLUB.lineup) };
    const neu = stilSetzen(stil), f = besteElf(false, { formationWaehlen: true });
    vorher = merk; gewaehlt = neu.stil;
    if (typeof window.showToast === 'function') window.showToast(`${STILE[neu.stil].name} · ${f} · Eingewöhnung ${Math.round(neu.eing * 100)} %`, 'info');
    zeichne();
  }
  function zurueck() {
    if (!vorher) return;
    CLUB.dfl.taktik = vorher.taktik; CLUB.formation = vorher.formation; CLUB.lineup = vorher.lineup; CLUB.selected = null;
    vorher = null; gewaehlt = CLUB.dfl.taktik.stil;
    weltSync();
    if (typeof saveGameState === 'function') saveGameState();
    try { if (typeof renderAll === 'function') renderAll(); } catch (e) { /* Ansicht optional */ }
    zeichne();
  }
  function zeichne() {
    const host = document.getElementById('sub-tactics'); if (!host || !dfl()) return;
    let box = document.getElementById('dfl-stil-box');
    if (!box) {
      box = document.createElement('div'); box.id = 'dfl-stil-box';
      box.addEventListener('click', ev => {
        // Formations-Chips in den Stil-Karten sind nur Anzeige (2026-10-10: ein Tipp auf die Karte traf oft den Chip und
        // wechselte die Formation statt den Stil) – die Formation wählt man in der Aufstellung
        if (ev.target.closest('[data-zurueck]')) { zurueck(); return; }
        const k = ev.target.closest('[data-stil]');
        if (k) { waehle(k.getAttribute('data-stil')); return; }
      });
      box.addEventListener('keydown', ev => {
        const k = ev.target.closest('.stil-knoten');
        if (k && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); waehle(k.getAttribute('data-stil')); }
      });
    }
    if (host.firstChild !== box) host.insertBefore(box, host.firstChild);
    try { box.innerHTML = boxHtml(); } catch (e) { console.warn('[DFL-Taktik] Ansicht', e); }
  }
  {
    const _orig = window.switchSubview;
    if (typeof _orig === 'function') {
      window.switchSubview = function (name) { const r = _orig.apply(this, arguments); if (name === 'tactics') { gewaehlt = null; vorher = null; zeichne(); } return r; };
      try { switchSubview = window.switchSubview; } catch (e) { /* nicht global gebunden */ }
    }
  }
  {
    const _orig = window.renderTacticsExtras;
    if (typeof _orig === 'function') window.renderTacticsExtras = function () { const r = _orig.apply(this, arguments); try { zeichne(); } catch (e) { /* optional */ } return r; };
  }

  // ── Eine Engine für deine Spiele (v2): „Anpfiff“ = Engine v3 wie „Spiel simulieren“ ──────────────────
  // Die alte Minuten-Engine kennt weder Stilfaktor noch die Brücke zur KI-Formel → in der DFL nicht mehr erreichbar.
  {
    const _orig = window.handleKO;
    if (typeof _orig === 'function') {
      window.handleKO = function () {
        if (dfl() && typeof window.simulateCurrentFixture === 'function') return window.simulateCurrentFixture();
        return _orig.apply(this, arguments);
      };
      try { handleKO = window.handleKO; } catch (e) { /* nicht global gebunden */ }
    }
  }
  // body.dfl-taktik: alte Regler, Repertoire, Live-Momentum und zweiten Spielknopf ausblenden (dfl_spiel.css)
  const klasse = () => { try { if (document.body) document.body.classList.toggle('dfl-taktik', !!dfl()); } catch (e) { /* ohne DOM */ } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', klasse); else klasse();
  setInterval(() => { if (document.visibilityState === 'visible') klasse(); }, 1500);

  // Neue Karriere: Stil, Formation und Elf gleich festlegen (sonst erst beim ersten Blick in die Taktik – bis dahin 4-4-2)
  if (typeof window.startNewGameState === 'function') {
    const _neu = window.startNewGameState;
    window.startNewGameState = async function () {
      const r = await _neu.apply(this, arguments);
      try { if (dfl() && !(CLUB.dfl.taktik && STILE[CLUB.dfl.taktik.stil])) { zustand(); weltSync(); } } catch (e) { console.warn('[DFL-Taktik] Start', e); }
      return r;
    };
    try { startNewGameState = window.startNewGameState; } catch (e) { /* nicht global gebunden */ }
  }
  // Spielstand schon geladen (initGame lädt vor den Patches): Zustand und Welt nachziehen
  try { if (dfl()) weltSync(); } catch (e) { console.warn('[DFL-Taktik] Laden', e); }
  window.DFLTaktik = { STILE, KREIS, eigenerStil, stilSetzen, stilVon, stilInfo, faktor, engineFaktoren, passung, wechselKosten,
    formationPasst, entwicklungsFaktor, zeichne, weltSync, besteElf, formationFuer, waehle };
  console.log('[DFL-Taktik v3] aktiv — Stil-Kreis (D55): Faktor in Engine v3 und KI-Formel, Eingewöhnung, Entwicklung −15 % unter 60 %; Stil gilt beim Antippen (Rückgängig), Beste Elf behält die Formation; alte Regler aus, Anpfiff = Engine v3');
})();
