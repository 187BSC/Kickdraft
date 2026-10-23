/* ═══════════════════════════════════════════════════════════════════════════
   DFL · SAISONWECHSEL  ·  v1   (D91 Saison-Briefing, D92 Saisonvorbereitung + Folgevertrag, D93 Entlassung vormerken)
   ─────────────────────────────────────────────────────────────────────────
   Freigegeben vom Nutzer 2026-10-10 (Vorschau spiel/dfl_saisonwechsel_vorschau.html, offene Fragen = Vorschlag der Vorschau):
   „eine Woche vorher eine Saisonvorbereitung haben, wo man aktiv sieht, wie man das Cap mit den Entlassungen bearbeiten kann
   und mit Spielern verlängern kann oder nicht … im Football setze ich ja erst ab dem Vertragsende an.“

   · Saisonvorbereitung ab der Finalwoche (letzte Woche aus DFLPlayoffs.wochen()) bis „Saison abschließen“: Cap je Saison
     (jetzt, nächste mit Rollover, 2 Jahre Prognose) als reine Rechnung (DFLKader.capNaechste/capHitSaison, Rookie-Verträge der
     eigenen Picks wie rookieVerpflichten), Kaderleiste 28 mit Strich bei 21, Positionslücken, Picks; Reiter „Verlängern“
     (Chance, Gesamtsumme) und „Entlassen“ (vormerken, Dead Cap, Ersparnis). Handy: eigene Ansicht #view-sv, Schritt im
     Haupt-Button, Kachel im Office und im Front Office; PC: Fenster (Postfach „Öffnen“).
     Karriereenden stehen zu Beginn fest (RealMarket.retirementChance, je Saison fest gewürfelt) – beim Wechsel gehen genau diese.
     Eigenes Finale: der Knopf im Spielbericht führt zurück ins Office (vorher sofort finishSeasonFlow), abgeschlossen wird mit
     „Saison abschließen“.
   · Verlängern = Folgevertrag, auch während der Saison: p.vertragFolge beginnt nach dem alten Vertrag (laufendes Jahr bleibt),
     Gesamtsumme = Forderung × Jahre (DFLStimmung), Vorlagen gleich/steigend/fallend (DFLGenerator.baueVertrag), Cap-Prüfung gegen
     die Saison, in der er beginnt. Ob er unterschreibt, entscheidet seine Chance (je Spieler und Saison fest gewürfelt).
     „Heute zahlen“ (p.vorauszahlung): Teil des Handgelds zählt im Cap der laufenden Saison – wie Dead Cap beim Verein
     (DFLKader.deadCapBuchen: Geld sofort × 1,1, bleibt bei Trade/Entlassung), höchstens der freie Rest dieser Saison und das
     Handgeld. Bis zum Beginn änderbar und zurücknehmbar. Zum Vertragsende macht dfl_kader_patch.js ihn zum Vertrag; die Welt
     sieht alten und neuen Vertrag als einen (dfl_liga_patch.js spielZuDfl, Cap Welt = Spiel).
   · Vormerken (D93): Spieler-Blatt „Am Saisonende“ neben „Entlassen“, Schere in Kaderliste und Aufstellung, jederzeit
     rückgängig; Trade, Verlängerung und Karriereende heben die Marke auf. Ausgeführt in dfl_kader_patch.js nach dem
     Vertragsende, Dead Cap ganz in der neuen Saison (Spec 3.2).
   · Briefings (D91): Abschluss nach dem Saison-Rückblick (vor dem Draft) – Meister, eigenes Abschneiden, Cap der neuen Saison,
     wer geht (Vertragsende, Karriereende, entlassen), wer bleibt, Picks; Daten in LEAGUE.dflWechsel. Start einmal je Saison in
     der Woche des Kaderschnitts vor Spieltag 1 – Cap frei, Kader, Warnungen, Zu-/Abgänge, Positionen gegen den Sollkader, je
     Lücke der beste bezahlbare Free Agent. Beide bis Spieltag 1 im Postfach.
   · Vertrag vorab im Trade (D86, 2026-10-11): dasselbe Vertragsblatt im Tausch-Modus (tauschVertrag) für einen Spieler mit
     1 Restjahr, der erst mit dem Tausch kommt – Cap-Plan und Angebot rechnen mit dem Kader nach dem Tausch (capPlan opt.kader/
     opt.deadExtra, angebot opt.kontext), Forderung aus Sicht des neuen Vereins (opt.f); gebucht wird mit dem Tausch über
     verlaengern(…, { f, ohneZufall, capGeprueft }) in dfl_trade_patch.js.
   Zustand: CLUB.dfl.vorbereitung { saison, gesehen, karriere[], gehen[], abgelehnt[] }, CLUB.dfl.vorgemerkt [ids],
   CLUB.dfl.vorab { saison, betrag }; am Spieler p.vertragFolge, p.vorauszahlung { saison, betrag }; LEAGUE.dflWechsel.
   Haken: dfl_app_shell.js (Haupt-Button, Office-Kachel, Spieler-Blatt, Front Office), contracts_patch.js (dflFolgevertrag),
   dfl_kader_patch.js (Vertragsende, Vorgemerkte, Cap je Saison), dfl_liga_patch.js (Folgevertrag in der Welt).
   Lädt nach dfl_kader_patch.js, dfl_vertraege_patch.js, dfl_playoffs_patch.js, chronicle_patch.js, dfl_app_shell.js und
   dfl_kaderliste_patch.js, vor init_bootstrap.js. CSS: css/dfl_saisonwechsel.css. API DFLSaisonwechsel.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const G = window.DFLGenerator, S = window.DFLSaison, D = window.DFLSpiel, K = window.DFLKader;
  if (!G || !S || !D || !K || !K.capNaechste) { console.warn('[DFL-Saisonwechsel] DFL-Module fehlen – Patch inaktiv'); return; }

  const CFG = {
    jahreVoraus: 2,          // verlängern in den letzten drei Vertragsjahren (der Folgevertrag beginnt nach dem alten, Cap-Prüfung im Plan)
    prognose: 2,             // Jahre Prognose nach der nächsten Saison (Cap + Wachstum, ohne Rollover)
    vorabSchritt: 100000,    // Regler „heute zahlen“
    entlassenListe: 8,       // Kandidaten im Reiter „Entlassen“, Rest über „Alle zeigen“
    moral: 5,                // Moral bei Unterschrift, zurück beim Zurücknehmen
    faTipps: 4               // Start-Briefing: so viele Free Agents für die Lücken
  };
  const STAFFELN = ['gleich', 'steigend', 'fallend'];
  const ST_TEXT = { bereit: 'will verlängern', offen: 'offen für Gespräche', markt: 'will den Markt testen', nein: 'verweigert Gespräche' };
  const RUNDE = { 1: 'Wildcard', 2: 'Divisional', 3: 'Conf.-Finale', 4: 'Finale' };
  const RUNDE_TEXT = ['Playoffs verpasst', 'Aus in der Wildcard-Runde', 'Aus in der Divisional-Runde', 'Aus im Conference-Finale', 'Finale verloren', 'DKL-Meister'];
  const GRUND = { vertrag: 'Vertrag', karriere: 'Karriere', entlassen: 'entlassen', trade: 'Trade', abgeworben: 'abgeworben', frei: 'Free Agent', verein: 'anderer Verein', sonst: 'weg' };

  // ── Hilfen ───────────────────────────────────────────────────────────────
  const dfl = () => typeof CLUB !== 'undefined' && CLUB && CLUB.dfl && CLUB.dfl.aktiv && typeof LEAGUE !== 'undefined' && LEAGUE && !!LEAGUE.dfl;
  const handy = () => !!(document.body && document.body.classList.contains('dfl-shell'));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const zahl1 = x => (Math.round((x || 0) / 1e5) / 10).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const mio = x => zahl1(x) + ' Mio €';
  const vz = x => (x > 5e4 ? '+' : x < -5e4 ? '−' : '±') + zahl1(Math.abs(x));
  const voll = p => ((p.firstName ? p.firstName + ' ' : '') + (p.name || '')).trim();
  const kurz = p => (p.firstName ? p.firstName.charAt(0) + '. ' : '') + (p.name || '');
  const label = s => { try { return typeof seasonYearLabel === 'function' ? seasonYearLabel(s) : 'Saison ' + s; } catch (e) { return 'Saison ' + s; } };
  const kl = s => { const l = label(s); return /^\d{4}\//.test(l) ? l.slice(2) : l; };          // „27/28“
  const bis = s => { try { return typeof seasonEndYear === 'function' ? seasonEndYear(s) : s; } catch (e) { return s; } };
  const plural = (n, eins, viele) => `${n} ${n === 1 ? eins : viele}`;
  const toast = (t, art) => { if (typeof window.showToast === 'function') window.showToast(t, art || 'info', { duration: 4500 }); };
  const speichern = () => { if (typeof saveGameState === 'function') { try { saveGameState(); } catch (e) { /* Speichern meldet selbst */ } } };
  const news = (kat, titel, text) => { try { if (typeof addNews === 'function') addNews(kat, titel, text); } catch (e) { /* Meldung optional */ } };
  const hash = s => (G.hashText ? G.hashText(s) : [...String(s)].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0);
  // je Spieler, Saison und Spielstand fest gewürfelt (kein neues Glück durch Neuladen)
  const zufall = (art, p) => hash(art + ':' + (p.dflId || p.id) + ':' + LEAGUE.season + ':' + (CLUB.dfl.seed || 1)) / 4294967296;
  const imKader = id => (typeof SQUAD !== 'undefined' ? SQUAD.find(p => p.id === id) : null) || null;
  const posBadge = p => `<span class="pos-badge-sm pos-${esc(p.pos)}">${esc(p.pos)}</span>`;
  function gesicht(p, kl2) {
    let svg = '';
    try { const f = D.franchise('fcm'); svg = window.DFLIdentitaet ? DFLIdentitaet.gesichtSvg(p, f ? { farben: f.farben } : null) : ''; } catch (e) { svg = ''; }
    return `<span class="sw-gesicht${kl2 ? ' ' + kl2 : ''}" aria-hidden="true">${svg}</span>`;
  }
  function moral(p, d) { if (window.MoraleSystem && MoraleSystem.addMorale) { try { MoraleSystem.addMorale([p], d); } catch (e) { /* ohne Moral */ } } }
  const ico = n => `<i class="ti ti-${n}" aria-hidden="true"></i>`;

  // ── Zustand ──────────────────────────────────────────────────────────────
  // Saisonvorbereitung offen: ab der Finalwoche der laufenden Playoffs bis zum Saisonwechsel (LEAGUE.dflPO verschwindet dann)
  function offen() {
    if (!dfl() || !window.DFLPlayoffs || !DFLPlayoffs.stand) return false;
    let po = null;
    try { po = DFLPlayoffs.stand(); } catch (e) { return false; }
    return !!(po && po.saison === LEAGUE.season && Array.isArray(po.wochen) && po.wochen.length && LEAGUE.week >= po.wochen[po.wochen.length - 1]);
  }
  const vbLesen = () => { const v = dfl() && CLUB.dfl.vorbereitung; return v && v.saison === LEAGUE.season ? v : null; };
  const vb = () => vbLesen() || (offen() ? starten() : null);
  const karriereSet = () => new Set((vbLesen() || {}).karriere || []);
  const vorgemerkt = () => (dfl() && Array.isArray(CLUB.dfl.vorgemerkt) ? CLUB.dfl.vorgemerkt : []).filter(id => SQUAD.some(p => p.id === id));
  const istVorgemerkt = id => vorgemerkt().indexOf(id) >= 0;
  const vorabJetzt = () => { const v = dfl() && CLUB.dfl.vorab; return v && v.saison === LEAGUE.season ? (v.betrag || 0) : 0; };

  // Zu Beginn der Saisonvorbereitung: Karriereenden festlegen (Chance wie das Spiel beim Saisonwechsel, RealMarket); wer schon
  // einen Folgevertrag hat, spielt weiter. Karriereende hebt eine vorgemerkte Entlassung auf.
  function starten() {
    const R = window.RealMarket, an = !(R && R.config && R.config.retirement && R.config.retirement.affectOwnSquad === false);
    const karriere = [];
    if (an && R && typeof R.retirementChance === 'function') SQUAD.forEach(p => {
      if (p.onLoanFrom || p.vertragFolge || K.dsVertrag(p)) return;
      const ch = R.retirementChance(p.age || 0);
      if (ch > 0 && zufall('karriere', p) < ch) karriere.push(p.id);
    });
    const v = CLUB.dfl.vorbereitung = { saison: LEAGUE.season, gesehen: false, karriere, gehen: [], abgelehnt: [], ab: LEAGUE.week };
    if (Array.isArray(CLUB.dfl.vorgemerkt)) CLUB.dfl.vorgemerkt = CLUB.dfl.vorgemerkt.filter(id => karriere.indexOf(id) < 0);
    // Hinweis selbst steht im Postfach (Eintrag mit „Öffnen“, bis zum Saisonwechsel), im Haupt-Button und als Kachel
    const weg = SQUAD.filter(p => karriere.indexOf(p.id) >= 0);
    if (weg.length) news('club', `🎖️ Karriereende angekündigt: ${weg.length === 1 ? voll(weg[0]) : weg.length + ' Spieler'}`,
      weg.map(p => `${voll(p)} (${p.age}, ${p.pos})`).join(', ') + ' ' + (weg.length === 1 ? 'hört' : 'hören') + ' nach der Saison auf – ohne Dead Cap.');
    return v;
  }

  const endetJetzt = p => p.contractUntil != null && p.contractUntil <= LEAGUE.season && !K.dsVertrag(p) && !p.onLoanFrom;
  function zahlen() {
    const v = vbLesen(), karriere = new Set(v ? v.karriere : []), gehen = new Set(v ? v.gehen : []);
    const aus = SQUAD.filter(p => endetJetzt(p) && !karriere.has(p.id));
    const endet = aus.filter(p => !p.vertragFolge);
    return { aus, endet, verl: aus.filter(p => p.vertragFolge), offen: endet.filter(p => !gehen.has(p.id)), gehen: endet.filter(p => gehen.has(p.id)),
      karriere: SQUAD.filter(p => karriere.has(p.id)), vor: vorgemerkt() };
  }
  function verlaengerbarGrund(p) {
    if (!dfl()) return 'Nur in der DKL.';
    if (!p || SQUAD.indexOf(p) < 0) return 'Nicht im Kader.';
    if (p.onLoanFrom) return 'Leihspieler.';
    if (K.dsVertrag(p)) return 'Mit Development-Squad-Vertrag: Beim Hochziehen bekommt er einen Profivertrag.';
    if (karriereSet().has(p.id)) return `${voll(p)} beendet nach dieser Saison seine Karriere.`;
    if (p.contractUntil == null) return 'Kein Vertrag.';
    if (p.contractUntil - LEAGUE.season > CFG.jahreVoraus) return `Verlängern geht ab ${label(p.contractUntil - CFG.jahreVoraus)} – sein Vertrag läuft bis ${bis(p.contractUntil)}.`;
    return null;
  }
  function vormerkbarGrund(p) {
    if (!dfl()) return 'Nur in der DKL.';
    if (!p || SQUAD.indexOf(p) < 0) return 'Nicht im Kader.';
    if (p.onLoanFrom || K.dsVertrag(p)) return 'Ohne eigenen Vertrag.';
    if (karriereSet().has(p.id)) return 'Er beendet ohnehin seine Karriere.';
    if (p.vertragFolge) return 'Er hat einen Folgevertrag – den erst zurücknehmen.';
    if (p.contractUntil == null || p.contractUntil <= LEAGUE.season) return 'Sein Vertrag endet ohnehin nach dieser Saison.';
    return null;
  }

  // ── Forderung, Chance ────────────────────────────────────────────────────
  function weltTeam() { const L = D.welt(), id = D.eigeneDflId(); return { L, t: L.teams.find(x => x.id === id) }; }
  // Forderung wie bei der KI (DFLGenerator.forderung + Stimmung) in Euro der Saison, in der der Vertrag beginnt
  function forderung(p, capFuer, wt) {
    wt = wt || weltTeam();
    const L = wt.L, t = wt.t;
    if (!t) return null;
    const titel = L.teams.slice().sort((a, b) => G.teamOvr(b) - G.teamOvr(a)).slice(0, 8).some(x => x.id === t.id);
    const ctx = { eigenerVerein: true, titelkandidat: titel, prestige: t.prestige || 0 };
    const alt = G.CFG.cap;
    G.setzeCap(capFuer || K.cap());
    try {
      const w = Object.assign(D.spielZuDfl(p, LEAGUE.season), { teamId: t.id });
      const roh = G.forderung(w, t, ctx);
      const M = window.DFLStimmung, mit = M && M.forderung ? M.forderung(w, t, L, ctx) : null;
      const f = mit || roh;
      return { jahresWert: f.jahresWert, jahre: Math.max(1, Math.min(5, f.jahre || roh.jahre || 2)), handgeldAnteil: roh.handgeldAnteil, staffelung: roh.staffelung || 'gleich',
        gruende: (f.gruende || []).slice(0, 3), chance: mit ? mit.stimmung.chance : 100, key: mit ? mit.stimmung.bereitschaft.key : 'bereit' };
    } finally { G.setzeCap(alt); }
  }
  // D159 (a): der Star der Tutorial-Mission „Verlängere deinen Star“ sagt zu (dfl_missionen.js), sonst Zufall gegen die Bereitschaft
  const willig = (p, f) => !!(window.DFLMissionen && DFLMissionen.istStar && DFLMissionen.istStar(p)) || zufall('verl', p) * 100 < f.chance;

  // ── Picks und Rookie-Verträge ────────────────────────────────────────────
  // Eigene Picks des kommenden Drafts: nach dem Saisonwechsel aus dem vorbereiteten Draft, sonst aus Tabelle und Playoffs
  // (laufendes Finale: der eigene Verein verliert, der andere wird Meister – reine Schätzung für den Cap)
  // besitz (D86, Tausch-Kontext): Map Pick-ID → Besitzer nach dem Tausch (Welt-ID) – Picks, die ein Trade bewegt
  function eigenePicks(besitz) {
    const L = D.liga(), H = window.DFLHandel;
    if (!L || !L.draft) return { picks: [], jetzt: false };
    const jahr = L.draft.jahr, d = LEAGUE.dflDraft;
    const umB = (runde, von, alt) => { const id = jahr + '-' + runde + '-' + D.dflIdVon(von); return besitz && besitz.has(id) ? D.spielId(besitz.get(id)) : alt; };
    if (d && d.jahr === jahr) {
      if (d.fertig) return { picks: [], jetzt: true };
      return { jetzt: true, picks: d.slots.map((x, i) => { const runde = Math.floor(i / 32) + 1; return { nr: i + 1, runde, von: x.von, besitzer: umB(runde, x.von, x.besitzer) }; })
        .filter(x => x.besitzer === 'fcm' && x.nr > d.nr) };
    }
    let tabelle = {}, los = {}, aus = {};
    const po = window.DFLPlayoffs && DFLPlayoffs.stand ? DFLPlayoffs.stand() : null;
    if (po && po.tabelle) {
      tabelle = po.tabelle; los = po.los || {}; aus = Object.assign({}, po.ausgeschieden);
      if (!po.meister) {
        const drin = [].concat(...Object.values(po.setzliste || {})).filter(id => !(id in aus));
        drin.forEach(id => { aus[id] = Math.min(4, po.runde || 1); });
        if (po.runde >= 4 && drin.indexOf('fcm') >= 0) drin.filter(id => id !== 'fcm').forEach(id => { aus[id] = 5; });
      }
    } else {
      LEAGUE.tiers.bundesliga.groups[0].teams.forEach(t => { tabelle[t.id] = { id: t.id, pts: t.pts || 0, gd: (t.gf || 0) - (t.ga || 0), gf: t.gf || 0 }; los[t.id] = 0.5; });
    }
    const ids = Object.keys(tabelle);
    if (!ids.length) return { picks: [], jetzt: false };
    const reihe = S.draftReihenfolge({ teams: ids.map(id => ({ id })) }, { tabelle, los }, { ausgeschieden: aus });
    const picks = [];
    for (let nr = 0; nr < 4 * reihe.length; nr++) {
      const runde = Math.floor(nr / reihe.length) + 1, von = reihe[nr % reihe.length];
      const bes = umB(runde, von, H && H.pickBesitzer ? D.spielId(H.pickBesitzer(L, jahr, runde, D.dflIdVon(von))) : von);
      if (bes === 'fcm') picks.push({ nr: nr + 1, runde, von });
    }
    return { picks, jetzt: false };
  }
  // Rookie-Vertrag wie rookieVerpflichten (Skala, 4 Jahre steigend, Handgeld je Runde); hits[k] = Cap Hit in Saison jetzt + k
  function rookieHits(capNeu, info) {
    const k0 = info.jetzt ? 0 : 1, alt = G.CFG.cap;
    G.setzeCap(capNeu);
    try {
      return info.picks.map(x => {
        const c = G.baueVertrag({ jahresWert: G.rookieGehalt(x.nr), jahre: G.CFG.rookie.jahre, rest: G.CFG.rookie.jahre, staffelung: 'steigend',
          handgeldAnteil: G.CFG.rookie.handgeld[x.runde - 1] || 0.1, art: 'rookie' });
        const hits = [];
        c.base_salary_by_year.forEach((b, i) => { hits[k0 + i] = b + c.signing_bonus_total / c.years_total; });
        return Object.assign({}, x, { hits, capHit: hits[k0] });
      });
    } finally { G.setzeCap(alt); }
  }

  // ── Cap je Saison (D92) ──────────────────────────────────────────────────
  // Spalte 0 = jetzt, 1 = nächste Saison (Cap + Rollover), danach Prognose (+ Wachstum, ohne Rollover).
  // opt.ohneFolge: Set – Folgevertrag dieser Spieler nicht zählen · opt.extra: [{ hits }] geplanter Vertrag ·
  // opt.vorabExtra: zusätzlich heute gezahlt (zählt jetzt, senkt den Rollover) ·
  // opt.kader / opt.deadExtra / opt.pickBesitz (D86, Vertrag vorab im Trade): Kader nach dem Tausch statt SQUAD, Dead Cap des Tauschs in dieser
  // Saison, Besitz der Picks nach dem Tausch (Rookie-Verträge des kommenden Drafts)
  function capPlan(opt) {
    opt = opt || {};
    const s0 = LEAGUE.season, n0 = K.capNaechste(), ve = opt.vorabExtra || 0, kader = opt.kader || SQUAD, dx = opt.deadExtra || 0;
    // Rollover aus dem freien Rest nach dem Tausch (capNaechste rechnet mit dem Kader von heute)
    const n = opt.kader ? Object.assign({}, n0, { ungenutzt: Math.max(0, K.capLimitBasis() - (kader.reduce((a, p) => a + K.capHitJahr(p), 0) + (CLUB.dfl.deadCap || 0) + dx)) }) : n0;
    const karriere = karriereSet(), vor = new Set(vorgemerkt());
    const roll = Math.max(0, Math.round(Math.min(n.ungenutzt - ve, S.CFG.rollover * n.cap)));
    const caps = [K.cap(), n.cap];
    for (let k = 2; k <= 1 + CFG.prognose; k++) caps.push(Math.round(caps[k - 1] * (1 + S.CFG.cap.wachstum) / 100000) * 100000);
    const limits = caps.map((c, k) => k === 0 ? K.capLimit() : k === 1 ? c + roll : c);
    const info = eigenePicks(opt.pickBesitz), picks = rookieHits(info.jetzt ? K.cap() : n.cap, info);
    const dead0 = Math.max(0, (CLUB.dfl.deadCap || 0) - vorabJetzt()) + dx;
    const spalten = caps.map((cap, k) => {
      const s = s0 + k;
      let fest = 0, neu = 0, dead = 0, vorab = 0;
      kader.forEach(p => {
        if (k === 0) { fest += K.capHitJahr(p); return; }                 // wie capBelegt
        if (p.onLoanFrom || karriere.has(p.id)) return;
        if (vor.has(p.id)) { if (k === 1) dead += K.deadCapNach(p); return; }
        const F = p.vertragFolge && !(opt.ohneFolge && opt.ohneFolge.has(p.id)) ? p.vertragFolge : null;
        const f = F ? K.folgeHit(F, s) : null;
        if (f != null) neu += f;
        else if (!(p.vertragFolge && s >= p.vertragFolge.start)) fest += K.capHitSaison(p, s);
      });
      if (k === 0) { dead = dead0; vorab = vorabJetzt() + ve; }
      (opt.extra || []).forEach(x => { neu += (x.hits && x.hits[k]) || 0; });
      const rookies = picks.reduce((a, x) => a + (x.hits[k] || 0), 0);
      const belegt = fest + neu + rookies + dead + vorab;
      return { k, saison: s, cap, limit: limits[k], fest, neu, rookies, dead, vorab, belegt, frei: limits[k] - belegt };
    });
    return { spalten, roll, rollMax: Math.round(S.CFG.rollover * n.cap), naechste: n, picks, pickJetzt: info.jetzt };
  }

  // ── Folgevertrag ─────────────────────────────────────────────────────────
  // Angebot rechnen (ohne zu buchen): Gesamtsumme = Forderung × Jahre, Vorlage, heute zahlen, Cap je Saison mit und ohne ihn.
  // D86 (Vertrag vorab im Trade, dfl_trade_patch.js): opt.kontext { kader, deadExtra } = Kader nach dem Tausch (p ist dann ein
  // Spieler, der erst mit dem Tausch kommt), opt.f = feste Forderung (Objekt) oder Funktion (p, capStart) → Forderung
  function angebot(p, opt, wt) {
    opt = opt || {};
    const F = p.vertragFolge, s0 = LEAGUE.season;
    const start = F ? F.start : (p.contractUntil != null ? p.contractUntil : s0) + 1, k = start - s0;
    const kx = opt.kontext ? { kader: opt.kontext.kader, deadExtra: opt.kontext.deadExtra || 0, pickBesitz: opt.kontext.pickBesitz || null } : null;
    const mitK = o => (kx ? Object.assign(o, kx) : o);
    const plan0 = capPlan(mitK({}));
    const capStart = (plan0.spalten[k] || plan0.spalten[plan0.spalten.length - 1]).cap;
    const fFest = typeof opt.f === 'function' ? opt.f(p, capStart) : opt.f;
    const f = fFest || forderung(p, capStart, wt) || { jahresWert: G.CFG.mindestgehalt, jahre: 2, handgeldAnteil: 0.2, staffelung: 'gleich', gruende: [], chance: 100, key: 'bereit' };
    // ein unterschriebener Vertrag behält seine Summe – geändert werden nur Verteilung und Vorauszahlung
    const basis = F ? { jahresWert: F.forderung || f.jahresWert, jahre: F.jahre, handgeldAnteil: F.handgeldAnteil != null ? F.handgeldAnteil : f.handgeldAnteil } : f;
    const staffel = STAFFELN.indexOf(opt.staffel) >= 0 ? opt.staffel : F ? F.staffelung : f.staffelung;
    const alt = G.CFG.cap;
    G.setzeCap(capStart);
    let c;
    try {
      c = G.baueVertrag({ jahresWert: basis.jahresWert, jahre: basis.jahre, rest: basis.jahre, staffelung: staffel, handgeldAnteil: basis.handgeldAnteil, garantiert: 0,
        art: basis.jahresWert <= G.CFG.mindestgehalt ? 'minimum' : 'veteran' });
    } finally { G.setzeCap(alt); }
    const sb = c.signing_bonus_total, vorab0 = F ? (F.vorab || 0) : 0;
    const vorabFest = !!(F && vorab0 > 0 && !(p.vorauszahlung && p.vorauszahlung.saison === s0));     // in einer früheren Saison gezahlt
    // frei in dieser Saison – im Tausch-Kontext nach dem Tausch (Kader danach + Dead Cap des Tauschs), sonst wie capBelegt
    const frei0 = kx ? K.capLimit() - (kx.kader.reduce((a, q) => a + K.capHitJahr(q), 0) + (CLUB.dfl.deadCap || 0) + kx.deadExtra) : K.capLimit() - K.capBelegt();
    const vorabMax = vorabFest ? vorab0 : Math.max(0, Math.floor(Math.min(sb, frei0 + vorab0) / CFG.vorabSchritt) * CFG.vorabSchritt);
    const vorab = vorabFest ? vorab0 : Math.max(0, Math.min(vorabMax, Math.round(opt.vorab != null ? opt.vorab : vorab0)));
    const hitsMit = v => { const h = []; c.base_salary_by_year.forEach((b, i) => { h[k + i] = b + (sb - v) / c.years_total; }); return h; };
    const hits = hitsMit(vorab), extra = vorabFest ? 0 : vorab - vorab0;
    const plan = capPlan(mitK({ ohneFolge: new Set([p.id]), extra: [{ hits }], vorabExtra: extra }));
    const ohne = capPlan(mitK({ ohneFolge: new Set([p.id]), vorabExtra: vorabFest ? 0 : -vorab0 }));
    const nichts = vorab ? capPlan(mitK({ ohneFolge: new Set([p.id]), extra: [{ hits: hitsMit(0) }], vorabExtra: vorabFest ? 0 : -vorab0 })) : plan;
    const sp = plan.spalten[k];
    return { p, F, f, start, k, staffel, vertrag: c, jahre: c.years_total, sb, vorab, vorab0, vorabMax, vorabFest, hits, basis, frei0, tausch: !!kx,
      gesamt: c.base_salary_by_year.reduce((a, b) => a + b, 0) + sb, plan, ohne, nichts, capOk: !sp || sp.frei >= -1, ueber: sp ? Math.max(0, -sp.frei) : 0 };
  }
  // „Heute zahlen“: wie Dead Cap beim Verein (Geld sofort × 1,1, Plan-Basis angehoben); zurück = Cap frei, Geld zurück
  function vorabBuchen(delta) {
    delta = Math.round(delta || 0);
    if (!delta) return;
    if (delta > 0) K.deadCapBuchen(delta);
    else {
      const b = -delta, stab = (window.DFLFinanzen && DFLFinanzen.CFG && DFLFinanzen.CFG.stab) || 1.1, geld = Math.round(b * stab);
      CLUB.dfl.deadCap = Math.max(0, (CLUB.dfl.deadCap || 0) - b);
      CLUB.budget += geld;
      const bd = CLUB._budgetBreakdown;
      if (bd && bd.dflKader != null) { bd.dflKader -= b; bd.dflAbweichung = (bd.dflAbweichung || 0) - geld; }
    }
    const v = CLUB.dfl.vorab && CLUB.dfl.vorab.saison === LEAGUE.season ? CLUB.dfl.vorab : (CLUB.dfl.vorab = { saison: LEAGUE.season, betrag: 0 });
    v.betrag = Math.max(0, Math.round(v.betrag + delta));
  }
  function ausListe(liste, id) { const i = liste ? liste.indexOf(id) : -1; if (i >= 0) liste.splice(i, 1); }
  // Verlängern (opt: staffel, vorab, ohneZufall = Entscheidung schon gefallen, z. B. Berater-Verhandlung; f = feste Forderung;
  // capGeprueft = Cap schon mit dem Kader danach geprüft – Vertrag vorab im Trade (D86), Trade und Vertrag gelten nur zusammen)
  function verlaengern(id, opt) {
    opt = opt || {};
    const p = imKader(id), g = verlaengerbarGrund(p);
    if (g) return { ok: false, grund: g };
    const a = angebot(p, opt), neu = !p.vertragFolge;
    if (neu && !opt.ohneZufall && !willig(p, a.f)) {
      const v = vbLesen(); if (v && v.abgelehnt.indexOf(p.id) < 0) v.abgelehnt.push(p.id);
      return { ok: false, abgelehnt: true, grund: `${voll(p)} lehnt ab (Chance ${a.f.chance} %, ${ST_TEXT[a.f.key] || 'will den Markt testen'}) – er geht zum Vertragsende als Free Agent.` };
    }
    if (!a.capOk && !opt.capGeprueft) return { ok: false, grund: `Zu wenig Cap ${label(a.start)}: ${mio(a.ueber)} drüber. Erst Platz schaffen – Entlassung vormerken, Verträge auslaufen lassen.` };
    if (!a.vorabFest && a.vorab !== a.vorab0) vorabBuchen(a.vorab - a.vorab0);
    p.vertragFolge = { start: a.start, jahre: a.jahre, base_salary_by_year: a.vertrag.base_salary_by_year.slice(), signing_bonus_total: a.sb, vorab: a.vorab,
      guaranteed_bonuses: 0, staffelung: a.staffel, art: a.vertrag.art, gesamt: Math.round(a.gesamt), forderung: a.basis.jahresWert, handgeldAnteil: a.basis.handgeldAnteil,
      wunsch: neu ? a.f.staffelung : (a.F.wunsch || a.F.staffelung), saison: neu ? LEAGUE.season : a.F.saison, woche: neu ? LEAGUE.week : a.F.woche };
    if (!a.vorabFest) { if (a.vorab > 0) p.vorauszahlung = { saison: LEAGUE.season, betrag: a.vorab }; else delete p.vorauszahlung; }
    if (Array.isArray(CLUB.dfl.vorgemerkt)) ausListe(CLUB.dfl.vorgemerkt, p.id);      // Verlängerung hebt die Marke auf (D93)
    const v = vbLesen(); if (v) { ausListe(v.gehen, p.id); ausListe(v.abgelehnt, p.id); }
    if (neu) {
      moral(p, CFG.moral);
      news('club', `✍️ Folgevertrag: ${voll(p)}`, (opt.anlass ? opt.anlass + ': ' : '') + `${voll(p)} verlängert bis ${bis(a.start + a.jahre - 1)}: ${mio(a.gesamt)} über ${plural(a.jahre, 'Jahr', 'Jahre')} ab ${label(a.start)}` +
        ` (${a.staffel})${a.vorab ? `, davon ${mio(a.vorab)} schon heute im Cap ${label(LEAGUE.season)}` : ''}. Bis dahin gilt sein alter Vertrag.`);
    }
    nachAenderung();
    return { ok: true, vertrag: p.vertragFolge, angebot: a };
  }
  function zuruecknehmen(id) {
    const p = imKader(id);
    if (!p || !p.vertragFolge) return false;
    const F = p.vertragFolge, vz0 = p.vorauszahlung, diese = !!(vz0 && vz0.saison === LEAGUE.season);
    if (diese && F.vorab > 0) vorabBuchen(-F.vorab);
    delete p.vertragFolge; delete p.vorauszahlung;
    moral(p, -CFG.moral);
    news('club', `📄 Folgevertrag zurückgenommen: ${voll(p)}`, `${voll(p)} bleibt bei seinem alten Vertrag bis ${bis(p.contractUntil)}` +
      (F.vorab ? (diese ? ` – die Vorauszahlung (${mio(F.vorab)}) ist zurück.` : ` – die Vorauszahlung aus ${label(vz0 ? vz0.saison : LEAGUE.season - 1)} (${mio(F.vorab)}) ist verloren.`) : '.'));
    nachAenderung();
    return true;
  }
  // Entlassung zum Saisonende vormerken (D93); an = true/false, sonst umschalten
  function vormerken(id, an) {
    const p = imKader(id);
    if (!p) return { ok: false, grund: 'Nicht im Kader.' };
    const ist = istVorgemerkt(id), soll = an == null ? !ist : !!an;
    if (soll && !ist) { const g = vormerkbarGrund(p); if (g) return { ok: false, grund: g }; }
    CLUB.dfl.vorgemerkt = vorgemerkt().filter(x => x !== id).concat(soll ? [id] : []);
    nachAenderung();
    return { ok: true, vorgemerkt: soll };
  }
  // Knopf (Vertragsliste, Werkzeuge): umschalten mit Rückmeldung
  function vormerkenKlick(id) {
    const p = imKader(id), r = vormerken(id);
    if (!r.ok) toast(r.grund, 'warn');
    else if (p) toast(r.vorgemerkt ? `${voll(p)} geht zum Saisonende (Dead Cap ${kl(LEAGUE.season + 1)}: ${mio(K.deadCapNach(p))})` : `Vormerkung für ${voll(p)} aufgehoben`, 'info');
    return r;
  }
  function gehenLassen(id) {
    const v = vb(), p = imKader(id);
    if (!v || !p) return false;
    if (v.gehen.indexOf(id) >= 0) ausListe(v.gehen, id);
    else { if (p.vertragFolge && !zuruecknehmen(id)) return false; v.gehen.push(id); }
    nachAenderung();
    return true;
  }
  function nachAenderung() {
    try { K.capSetzen(); } catch (e) { /* ohne Cap-Budget */ }
    try { D.eigenSync(); if (D.weltGeaendert) D.weltGeaendert(); } catch (e) { console.warn('[DFL-Saisonwechsel] Welt', e); }
    neuZeichnen();
    speichern();
  }

  // Berater-Verhandlung (contracts_patch.js, auch Werkzeuge): Verlängerung als Folgevertrag statt neuem laufenden Vertrag
  window.dflFolgevertrag = function (p, s) {
    if (!dfl() || verlaengerbarGrund(p)) return null;
    const start = p.contractUntil + 1, n = Math.max(1, Math.min(5, s.years || 1)), basis = Math.round((s.wage || 0) * 52);
    // schon unterschriebener Folgevertrag: Vorauszahlung dieser Saison kommt zurück, eine aus einer früheren Saison bleibt angerechnet
    const F0 = p.vertragFolge, fest = !!(F0 && F0.vorab > 0 && !(p.vorauszahlung && p.vorauszahlung.saison === LEAGUE.season));
    if (F0 && F0.vorab && !fest) vorabBuchen(-F0.vorab);
    p.vertragFolge = { start, jahre: n, base_salary_by_year: Array(n).fill(basis), signing_bonus_total: Math.round(s.bonus || 0), vorab: fest ? F0.vorab : 0, guaranteed_bonuses: 0,
      staffelung: 'gleich', art: basis <= G.CFG.mindestgehalt ? 'minimum' : 'veteran', gesamt: basis * n + Math.round(s.bonus || 0), forderung: basis + Math.round(s.bonus || 0) / n,
      handgeldAnteil: (s.bonus || 0) / Math.max(1, basis * n + (s.bonus || 0)), wunsch: 'gleich', saison: LEAGUE.season, woche: LEAGUE.week };
    if (!fest) delete p.vorauszahlung;
    if (Array.isArray(CLUB.dfl.vorgemerkt)) ausListe(CLUB.dfl.vorgemerkt, p.id);
    const v = vbLesen(); if (v) { ausListe(v.gehen, p.id); ausListe(v.abgelehnt, p.id); }
    setTimeout(nachAenderung, 0);
    return { ab: label(start), bis: bis(start + n - 1), gesamt: p.vertragFolge.gesamt };
  };
  {
    const _orig = window.dflVertragPruefen;
    if (typeof _orig === 'function') window.dflVertragPruefen = function (p, s) {
      if (!dfl()) return _orig.apply(this, arguments);
      const g = verlaengerbarGrund(p);
      if (g) return g;
      const start = p.contractUntil + 1, k = start - LEAGUE.season, n = Math.max(1, s.years || 1);
      const hits = []; for (let i = 0; i < n; i++) hits[k + i] = (s.wage || 0) * 52 + (s.bonus || 0) / n;
      const sp = capPlan({ ohneFolge: new Set([p.id]), extra: [{ hits }] }).spalten[k];
      if (sp && sp.frei < -1) return `Zu wenig Platz unter dem Cap ${label(start)}: Der Folgevertrag zählt ${mio(hits[k])} pro Jahr, es fehlen ${mio(-sp.frei)}.`;
      return null;
    };
  }

  // ── Oberfläche: Bausteine ────────────────────────────────────────────────
  const svZ = { reiter: 'verl', alle: false };
  function saeulenHtml(plan) {
    const sp = plan.spalten, skala = Math.max(1, ...sp.map(x => Math.max(x.limit, x.belegt))) * 1.04;
    const ART = ['jetzt', 'neu', 'Prognose', 'Prognose'];
    return `<div class="sw-saeulen" role="img" aria-label="Cap frei je Saison: ${esc(sp.map(x => `${label(x.saison)} ${mio(x.frei)}`).join(', '))}">` + sp.map((x, k) => {
      let unten = 0;
      const seg = [['fest', x.fest], ['rookie', x.rookies], ['neu', x.neu], ['vorab', x.vorab], ['dead', x.dead]].filter(([, w]) => w > 0).map(([c, w]) => {
        const h = `<i class="sw-seg ${c}" style="bottom:${(unten / skala * 100).toFixed(2)}%;height:${(w / skala * 100).toFixed(2)}%"></i>`; unten += w; return h; }).join('');
      return `<div class="sw-sl${k === 0 ? ' jetzt' : ''}"><b class="sw-sl-frei ${x.frei >= 0 ? 'gut' : 'schlecht'}">${x.frei < 0 ? '−' : ''}${zahl1(Math.abs(x.frei))}<small>${x.frei < 0 ? 'drüber' : 'frei'}</small></b>
        <div class="sw-sl-flaeche">${seg}<i class="sw-sl-limit${k >= 2 ? ' prognose' : ''}" style="bottom:${(x.limit / skala * 100).toFixed(2)}%"></i></div>
        <span class="sw-sl-jahr">${esc(kl(x.saison))}</span><span class="sw-sl-art">${ART[k] || 'Prognose'}</span></div>`;
    }).join('') + '</div>';
  }
  const legendeHtml = () => `<div class="sw-legende"><span><i class="fest"></i>Verträge</span><span><i class="rookie"></i>Rookies</span><span><i class="neu"></i>verlängert</span>` +
    `<span><i class="vorab"></i>heute gezahlt</span><span><i class="dead"></i>Dead Cap</span></div>`;
  function kaderleisteHtml(teile) {
    const zellen = [];
    teile.forEach(([c, n]) => { for (let i = 0; i < n; i++) zellen.push(c); });
    const n = Math.max(28, zellen.length), out = [];
    for (let i = 0; i < n; i++) out.push(`<i class="${i >= 28 ? 'zuviel' : (zellen[i] || '')}"></i>`);
    return `<div class="sw-kaderleiste" style="grid-template-columns:repeat(${n},1fr)" aria-hidden="true">${out.join('')}${zellen.length <= 28 ? '<span class="sw-min"></span>' : ''}</div>`;
  }
  // Kader-Soll für deine Formation (D95: zwölf Positionen mit Seite, LM/RM je zwei, wenn deine Formation sie hat – DFLGenerator.kaderSoll)
  const SOLL = () => (G.kaderSoll ? G.kaderSoll({ formation: typeof CLUB !== 'undefined' && CLUB ? CLUB.formation : null }) : G.CFG && G.CFG.kader)
    || { TW: 3, IV: 4, LV: 2, RV: 2, ZDM: 3, ZM: 3, LM: 1, RM: 1, OM: 2, LF: 2, RF: 2, ST: 3 };
  function positionen(liste) {
    const n = {}; Object.keys(SOLL()).forEach(k => { n[k] = 0; });
    liste.forEach(p => { const k = G.dflPos ? G.dflPos(p.pos) : p.pos; n[k] = (n[k] || 0) + 1; });
    return n;
  }
  function lueckenHtml(n, nurFehlt) {
    const soll = SOLL();
    const chips = Object.keys(soll).map(k => {
      const ist = n[k] || 0, c = ist < soll[k] ? 'fehlt' : ist > soll[k] ? 'mehr' : 'ok';
      if (nurFehlt && c !== 'fehlt') return '';
      return `<span class="sw-luecke ${c}" title="${k}: ${ist} von ${soll[k]}"><span class="pos-badge-sm pos-${k}">${k}</span>${ist}/${soll[k]}</span>`;
    }).join('');
    return chips;
  }
  const ticketHtml = x => `<span class="sw-ticket">${ico('ticket')}R${x.runde} · #${x.nr}${x.capHit ? `<small>${zahl1(x.capHit)}</small>` : ''}</span>`;

  // ── Saisonvorbereitung (Ansicht / Fenster) ───────────────────────────────
  function svHtml() {
    if (!dfl()) return '';
    const v = vb();
    if (!v) return `<div class="sw-leer">${ico('calendar-event')}<b>Die Saisonvorbereitung öffnet in der Finalwoche.</b><small>Verlängern geht jederzeit über das Spieler-Blatt.</small></div>`;
    const wt = weltTeam(), plan = capPlan(), s0 = LEAGUE.season, s1 = s0 + 1, z = zahlen(), x1 = plan.spalten[1];
    const karriere = new Set(v.karriere), vor = new Set(z.vor), gehen = new Set(v.gehen), abgelehnt = new Set(v.abgelehnt || []);
    const imNaechsten = p => !p.onLoanFrom && !karriere.has(p.id) && !vor.has(p.id) && ((p.contractUntil != null && p.contractUntil >= s1) || (p.vertragFolge && p.vertragFolge.start <= s1));
    const haupt = SQUAD.filter(p => !p.perspektiv && imNaechsten(p));
    const verl = haupt.filter(p => p.vertragFolge && p.contractUntil < s1), fest = haupt.filter(p => verl.indexOf(p) < 0);
    const ds = SQUAD.filter(p => p.perspektiv && (K.dsVertrag(p) ? p.age + 1 <= (G.CFG.perspektiv || {}).alterMax : imNaechsten(p))).length;
    const nPicks = plan.picks.length, kader = haupt.length + nPicks, platz = 28 - kader;
    const luecken = lueckenHtml(positionen(haupt), true);
    const zeit = typeof fcmSeasonOver === 'function' && fcmSeasonOver() ? 'Verträge enden mit „Saison abschließen“' : 'noch 1 Woche bis zum Vertragsende';
    const kopf = `<div class="sw-kopf"><span class="sw-ueber">${esc(CLUB.name)}</span><h2>Saisonvorbereitung ${esc(label(s1))}</h2><small>${zeit}</small></div>`;
    const capKarte = `<section class="sw-karte" aria-live="polite">
        <div class="sw-zeile"><span class="sw-ueber">Cap je Saison</span><span class="sw-klein">frei in Mio €</span></div>
        ${saeulenHtml(plan)}${legendeHtml()}
        <div class="sw-roll">${ico('refresh')}<span>${plan.spalten[0].vorab ? `Heute gezahlt: ${mio(plan.spalten[0].vorab)}. ` : ''}Rest ${esc(kl(s0))}: ${mio(Math.max(0, plan.naechste.ungenutzt))} rollt in ${esc(kl(s1))} mit (Rollover, höchstens ${mio(plan.rollMax)}).</span></div>
      </section>`;
    const kaderKarte = `<section class="sw-karte">
        <div class="sw-zeile"><span class="sw-ueber">Kader ${esc(label(s1))}</span><span class="sw-gross">${kader}<small>/28</small></span></div>
        ${kaderleisteHtml([['voll', fest.length], ['neu', verl.length], ['rookie', nPicks]])}
        <div class="sw-zeile sw-klein"><span>${plural(haupt.length, 'Vertrag', 'Verträge')} + ${plural(nPicks, 'Pick', 'Picks')} · ${platz >= 0 ? plural(platz, 'Platz', 'Plätze') + ' frei' : -platz + ' zu viel'}${ds ? ` · Dev. Squad ${ds}` : ''}</span><span>Strich = 21</span></div>
        <div class="sw-luecken">${luecken ? '<span class="sw-klein">fehlt:</span>' + luecken : '<span class="sw-klein">alle Positionen besetzt</span>'}</div>
        ${plan.picks.length ? `<div class="sw-tickets">${plan.picks.map(ticketHtml).join('')}</div>` : ''}
      </section>`;
    // Reiter „Verlängern“
    const statusZeile = (p, f) => {
      if (p.vertragFolge) {
        const F = p.vertragFolge;
        return `<div class="sw-status gut">Ab ${esc(kl(F.start))}: ${mio(F.gesamt)} über ${plural(F.jahre, 'Jahr', 'Jahre')} · ${esc(F.staffelung)}${F.vorab ? ` · ${zahl1(F.vorab)} heute` : ''} · <button type="button" class="sw-link" data-sv="anpassen" data-id="${esc(p.id)}">anpassen</button></div>`;
      }
      if (gehen.has(p.id)) return '<div class="sw-status schlecht">Geht zum Vertragsende als Free Agent</div>';
      if (abgelehnt.has(p.id)) return '<div class="sw-status schlecht">Hat abgelehnt – geht zum Vertragsende als Free Agent</div>';
      return '';
    };
    const zeileVerl = p => {
      const F = p.vertragFolge, kStart = (p.contractUntil + 1) - s0;
      const f = F ? null : forderung(p, (plan.spalten[kStart] || x1).cap, wt);
      const gesamt = F ? F.gesamt : f.jahresWert * f.jahre, jahre = F ? F.jahre : f.jahre;
      const zust = F ? 'bleibt' : gehen.has(p.id) || abgelehnt.has(p.id) ? 'geht' : '';
      // Nutzer 2026-10-17: Cap danach, Potenzial und Note gleich in der Zeile – vorher kam „zu wenig Cap“ erst nach dem Tippen
      let cz = null;
      if (!F && !zust) { try { const A = angebot(p, {}, wt), sp = A.plan.spalten[A.k]; if (sp) cz = { belegt: sp.belegt, limit: sp.limit, saison: sp.saison, ok: A.capOk, ueber: A.ueber }; } catch (e) { cz = null; } }
      const pr = typeof potentialRange === 'function' ? potentialRange(p) : null;
      const potTxt = pr ? (pr.exact || pr.lo === pr.hi ? `Pot. ${pr.hi}` : `Pot. ${pr.lo}–${pr.hi}`) : '';
      const nl = p.matchRatings && Array.isArray(p.matchRatings.list) ? p.matchRatings.list : [];
      const note = nl.length >= 3 ? (nl.reduce((x, y) => x + y, 0) / nl.length).toFixed(1).replace('.', ',') : null;
      const capZeile = cz ? `<div class="sw-capz${cz.ok ? '' : ' ueber'}"><span class="sw-capbar"><i style="width:${Math.min(100, cz.belegt / Math.max(1, cz.limit) * 100).toFixed(1)}%"></i></span>
        <small>${cz.ok ? `Cap ${esc(label(cz.saison))} danach: ${zahl1(cz.belegt)} von ${zahl1(cz.limit)} Mio` : `Cap ${esc(label(cz.saison))} danach: ${zahl1(cz.belegt)} von ${zahl1(cz.limit)} Mio – ${zahl1(cz.ueber)} Mio zu viel`}</small></div>` : '';
      return `<div class="sw-vz ${zust}" data-id="${esc(p.id)}">${gesicht(p)}
        <div class="sw-vz-wer"><button type="button" class="sw-name" data-sv="blatt" data-id="${esc(p.id)}">${esc(voll(p))}</button>
          <span class="sw-meta">${posBadge(p)} ${p.age} J · <b>${p.ovr}</b>${potTxt ? ` <span class="sw-pot">${potTxt}</span>` : ''}${note ? ` · Note ${note}` : ''}</span>
          <span class="sw-meta">${F ? '<span class="sw-st bereit"><i></i>unterschrieben</span>' : `<span class="sw-st ${f.key}" title="Stimmung: ${esc(ST_TEXT[f.key] || '')}"><i></i>${f.chance} %</span>`}<span>${zahl1(gesamt)} Mio / ${jahre} J</span></span></div>
        <div class="sw-vz-knoepfe" role="group" aria-label="${esc(voll(p))}">
          <button type="button" class="sw-knopf ja${cz && !cz.ok ? ' sw-capvoll' : ''}" data-sv="verl" data-id="${esc(p.id)}" aria-pressed="${!!F}">${cz && !cz.ok ? `${zahl1(cz.ueber)} Mio fehlen` : 'Verlängern'}</button>
          <button type="button" class="sw-knopf nein" data-sv="geht" data-id="${esc(p.id)}" aria-pressed="${!F && gehen.has(p.id)}">Gehen lassen</button></div>
        ${capZeile}${statusZeile(p, f || {})}</div>`;
    };
    const aus = z.aus.slice().sort((a, b) => b.ovr - a.ovr);
    const karriereListe = z.karriere.map(p => `<div class="sw-vz karriere">${gesicht(p)}<div class="sw-vz-wer"><button type="button" class="sw-name" data-sv="blatt" data-id="${esc(p.id)}">${esc(voll(p))}</button>
        <span class="sw-meta">${posBadge(p)} ${p.age} J · <b>${p.ovr}</b> · Vertrag bis ${bis(p.contractUntil)}</span>
        <span class="sw-meta">Hört auf · ${mio(K.capHitSaison(p, s1))} frei in ${esc(kl(s1))} · kein Dead Cap</span></div></div>`).join('');
    // Reiter „Entlassen“: alle mit Vertrag über die Saison hinaus, vorgemerkte zuerst, dann nach Ersparnis
    const kand = SQUAD.filter(p => !vormerkbarGrund(p) || vor.has(p.id)).map(p => {
      const n1 = K.capHitSaison(p, s1), dead = K.deadCapNach(p);
      return { p, n1, dead, spart: n1 - dead, danach: danachFrei(p) };
    }).sort((a, b) => (vor.has(b.p.id) - vor.has(a.p.id)) || (b.spart - a.spart));
    const zeigen = svZ.alle ? kand : kand.slice(0, Math.max(CFG.entlassenListe, z.vor.length));
    const zeileEnt = x => {
      const p = x.p, an = vor.has(p.id);
      return `<div class="sw-vz${an ? ' vorgemerkt' : ''}" data-id="${esc(p.id)}">${gesicht(p)}
        <div class="sw-vz-wer"><button type="button" class="sw-name" data-sv="blatt" data-id="${esc(p.id)}">${esc(voll(p))}</button>
          <span class="sw-meta">${posBadge(p)} ${p.age} J · <b>${p.ovr}</b> · bis ${bis(p.contractUntil)}</span>
          <span class="sw-meta">${esc(kl(s1))}: Dead Cap ${zahl1(x.dead)} statt ${zahl1(x.n1)}</span>
          <span class="sw-meta"><span class="sw-st ${x.spart >= 0 ? 'bereit' : 'markt'}">${x.spart >= 0 ? 'spart' : 'kostet'} ${zahl1(Math.abs(x.spart))}</span>${x.danach > 0 ? `<span>danach ${zahl1(x.danach)} frei</span>` : ''}</span></div>
        <div class="sw-vz-knoepfe"><button type="button" class="sw-knopf schere" data-sv="vor" data-id="${esc(p.id)}" aria-pressed="${an}">${ico('scissors')}${an ? 'Vorgemerkt' : 'Vormerken'}</button></div>
        ${an ? '<div class="sw-status schlecht">Vorgemerkt: spielt die Saison zu Ende, geht zum Saisonwechsel</div>' : ''}</div>`;
    };
    const reiter = `<div class="sw-reiter" role="tablist" aria-label="Saisonvorbereitung">
        <button type="button" role="tab" data-reiter="verl" aria-selected="${svZ.reiter === 'verl'}">Verlängern (${aus.length})</button>
        <button type="button" role="tab" data-reiter="ent" aria-selected="${svZ.reiter === 'ent'}">${z.vor.length ? `Entlassen ${ico('scissors')}${z.vor.length}` : `Entlassen (${kand.length})`}</button></div>`;
    const panelVerl = `<div class="sw-panel" role="tabpanel"${svZ.reiter === 'verl' ? '' : ' hidden'}>
        <div class="sw-listenkopf"><h4>Verträge enden (${aus.length})</h4><span class="sw-legende"><span class="sw-st bereit"><i></i>will</span><span class="sw-st offen"><i></i>offen</span><span class="sw-st markt"><i></i>Markt</span></span></div>
        <div class="sw-liste">${aus.map(zeileVerl).join('') || '<span class="sw-klein">Kein Vertrag endet nach dieser Saison.</span>'}</div>
        ${karriereListe ? `<div class="sw-listenkopf"><h4>Karriereende</h4><span class="sw-klein">steht schon fest</span></div><div class="sw-liste">${karriereListe}</div>` : ''}
        <p class="sw-klein">Prozent = Chance, dass er verlängert. Wer offen bleibt, wird zum Vertragsende Free Agent.</p></div>`;
    const panelEnt = `<div class="sw-panel" role="tabpanel"${svZ.reiter === 'ent' ? '' : ' hidden'}>
        <div class="sw-listenkopf"><h4>Zum Saisonende entlassen</h4><span class="sw-klein">Dead Cap erst ${esc(label(s1))}</span></div>
        <div class="sw-liste">${zeigen.map(zeileEnt).join('') || '<span class="sw-klein">Niemand mit Vertrag über die Saison hinaus.</span>'}</div>
        ${kand.length > zeigen.length || svZ.alle ? `<button type="button" class="app-knopf sw-mehr" data-sv="alle">${svZ.alle ? 'Weniger zeigen' : `Alle ${kand.length} zeigen`}</button>` : ''}
        <p class="sw-klein">Sofort entlassen geht im Spieler-Blatt – dann zählt auch der Anteil dieser Saison.</p></div>`;
    return `<div class="sw">${kopf}${capKarte}${kaderKarte}${reiter}${panelVerl}${panelEnt}</div>`;
  }
  function svKlick(ev) {
    const t = ev.target.closest('[data-reiter], [data-sv]');
    if (!t) return;
    const id = t.getAttribute('data-id'), a = t.getAttribute('data-sv');
    if (t.hasAttribute('data-reiter')) { svZ.reiter = t.getAttribute('data-reiter'); neuZeichnen(); return; }
    if (a === 'verl') {
      const p = imKader(id);
      if (p && p.vertragFolge) { vertragBlatt(id); return; }
      const r = verlaengern(id, {});
      toast(r.ok ? `${voll(p)} verlängert: ${mio(r.vertrag.gesamt)} ab ${label(r.vertrag.start)}` : r.grund, r.ok ? 'success' : r.abgelehnt ? 'warn' : 'error');
      if (!r.ok) neuZeichnen();
    } else if (a === 'geht') {
      const p = imKader(id);
      if (p && p.vertragFolge && !window.confirm(`Folgevertrag mit ${voll(p)} zurücknehmen? Dann geht er zum Vertragsende.`)) return;
      gehenLassen(id);
    } else if (a === 'anpassen') vertragBlatt(id);
    else if (a === 'vor') vormerkenKlick(id);
    else if (a === 'alle') { svZ.alle = !svZ.alle; neuZeichnen(); }
    else if (a === 'blatt') { const p = imKader(id); if (p && handy() && window.DFLAppShell) DFLAppShell.spielerBlatt(p, null); else if (p && typeof showSquadPlayerCard === 'function') showSquadPlayerCard(p.id); }
  }
  function ansichtZeigen() {
    let v = document.getElementById('view-sv');
    if (!v) {
      v = document.createElement('div'); v.className = 'app-view'; v.id = 'view-sv';
      const letzte = [...document.querySelectorAll('.app > .app-view')].pop();
      if (letzte) letzte.insertAdjacentElement('afterend', v); else (document.querySelector('.app') || document.body).appendChild(v);
      v.addEventListener('click', svKlick);
    }
    document.querySelectorAll('.app-view').forEach(x => x.classList.toggle('active', x === v));
    v.innerHTML = svHtml();
    if (window.DFLAppShell && DFLAppShell.ansicht) DFLAppShell.ansicht('sv');
    window.scrollTo(0, 0);
  }
  function fensterZeigen() {
    let ov = document.getElementById('dfl-sv-ov');
    if (!ov) {
      ov = document.createElement('div'); ov.id = 'dfl-sv-ov'; ov.className = 'sw-ov';
      ov.innerHTML = '<div class="sw-dialog sw-breit" role="dialog" aria-modal="true" aria-label="Saisonvorbereitung"><button class="app-blatt-zu sw-zu" type="button" aria-label="Schließen">' +
        ico('x') + '</button><div class="sw-inhalt"></div></div>';
      ov.addEventListener('click', ev => { if (ev.target === ov || ev.target.closest('.sw-zu')) { ov.remove(); return; } svKlick(ev); });
      document.body.appendChild(ov);
    }
    ov.querySelector('.sw-inhalt').innerHTML = svHtml();
  }
  function zeigen() {
    if (!dfl()) return;
    const v = vb();
    if (!v) { toast('Die Saisonvorbereitung öffnet in der Finalwoche – verlängern geht jederzeit über das Spieler-Blatt.', 'info'); return; }
    v.gesehen = true;
    if (handy()) ansichtZeigen(); else fensterZeigen();
    try { if (window.DFLAppShell) DFLAppShell.cta(); } catch (e) { /* nur am Handy */ }
  }
  function neuZeichnen() {
    const v = document.getElementById('view-sv');
    if (v && v.classList.contains('active')) { const y = window.scrollY; v.innerHTML = svHtml(); window.scrollTo(0, y); }
    const ov = document.getElementById('dfl-sv-ov');
    if (ov) { const b = ov.querySelector('.sw-inhalt'); if (b) b.innerHTML = svHtml(); }
    if (vzZ) { try { vertragMalen(); } catch (e) { /* Blatt zu */ } }
    try { if (typeof renderVertraegeFallsOffen === 'function') renderVertraegeFallsOffen(); } catch (e) { /* Liste zu */ }
    try {
      const sl = document.getElementById('sub-squadlist');
      if (sl && sl.classList.contains('active') && typeof renderSquadOverview === 'function') renderSquadOverview();
    } catch (e) { /* Liste zu */ }
    try { if (window.DFLAppShell) DFLAppShell.cta(); } catch (e) { /* nur am Handy */ }
  }

  // ── Vertrag verlängern (Blatt / Fenster) ─────────────────────────────────
  let vzZ = null;                      // { id, staffel, vorab } solange das Vertragsblatt offen ist
  function vertragBlatt(id) {
    const p = imKader(id);
    if (!p) return;
    const g = verlaengerbarGrund(p);
    if (g && !p.vertragFolge) { toast(g, 'warn'); return; }
    vzZ = { id, staffel: p.vertragFolge ? p.vertragFolge.staffelung : null, vorab: p.vertragFolge ? (p.vertragFolge.vorab || 0) : 0 };
    vertragMalen(true);
  }
  function vertragTeile(a) {
    const p = a.p, s0 = LEAGUE.season, F = a.F;
    const teile = {};
    teile.gesamt = mio(a.gesamt);
    teile['gesamt-text'] = `über ${plural(a.jahre, 'Jahr', 'Jahre')} ab ${esc(label(a.start))} · Handgeld ${mio(a.sb)}${a.vorab ? `, davon ${mio(a.vorab)} schon heute` : ''}`;
    teile.vorab = mio(a.vorab);
    teile['vorab-text'] = a.vorabFest ? `in ${esc(label(F.saison || s0))} gezahlt – bleibt` :
      `frei in ${esc(kl(s0))}${a.tausch ? ' nach dem Tausch' : ''}: ${mio(Math.max(0, a.frei0 + a.vorab0))} · höchstens das Handgeld (${mio(a.sb)})`;
    // Säulen: sein Cap Hit je Saison (alt + heute gezahlt, dann neuer Vertrag)
    const werte = a.plan.spalten.map((x, k) => k === 0 ? K.capHitJahr(p) + a.vorab : (a.hits[k] || (k < a.k ? K.capHitSaison(p, s0 + k) : 0)));
    const skala = Math.max(1, ...werte) * 1.15;
    teile.saeulen = a.plan.spalten.map((x, k) => {
      const w = werte[k], alt = k === 0 ? K.capHitJahr(p) : k < a.k ? w : 0, neu = k === 0 ? 0 : w - alt;
      return `<div class="sw-ms"><span class="sw-ms-wert">${w ? zahl1(w) : '–'}</span><div class="sw-ms-stapel">` +
        (k === 0 && a.vorab ? `<i class="vorab" style="height:${(a.vorab / skala * 100).toFixed(1)}%"></i>` : '') +
        (neu > 0 ? `<i class="neu" style="height:${(neu / skala * 100).toFixed(1)}%"></i>` : '') +
        (alt > 0 ? `<i class="alt" style="height:${(alt / skala * 100).toFixed(1)}%"></i>` : '') +
        `</div><span class="sw-ms-jahr">${esc(kl(x.saison))}</span><span class="sw-ms-art">${k === 0 ? 'alt' + (a.vorab ? ' + heute' : '') : neu > 0 ? 'neu' : alt > 0 ? 'alt' : 'frei'}</span></div>`;
    }).join('');
    teile.wirkung = `<table class="sw-wirkung"><thead><tr><th>Saison</th>${a.plan.spalten.map(x => `<th>${esc(kl(x.saison))}</th>`).join('')}</tr></thead><tbody>
      <tr><td>${a.tausch ? 'nur Trade' : 'ohne ihn'}</td>${a.ohne.spalten.map(x => `<td class="${x.frei < 0 ? 'schlecht' : ''}">${zahl1(x.frei)}</td>`).join('')}</tr>
      <tr><td>mit Vertrag</td>${a.plan.spalten.map(x => `<td class="${x.frei < 0 ? 'schlecht' : 'gut'}">${zahl1(x.frei)}</td>`).join('')}</tr></tbody></table>`;
    const d = a.plan.spalten.map((x, k) => x.frei - a.nichts.spalten[k].frei);
    teile.hinweis = `${ico('refresh')}<span>` + (a.vorab
      ? `Heute ${mio(a.vorab)} gezahlt: Der Rollover in ${esc(kl(s0 + 1))} sinkt um denselben Betrag. Frei gegenüber „nichts heute“: ${a.plan.spalten.slice(1).map((x, k) => `${esc(kl(x.saison))} ${vz(d[k + 1])}`).join(' · ')} Mio.`
      : `Was ${esc(kl(s0))} frei bleibt, rollt ohnehin mit (Rollover, höchstens ${mio(a.plan.rollMax)}). „Heute zahlen“ verschiebt deshalb Platz von ${esc(kl(s0 + 1))} in die Jahre danach.`) + '</span>';
    const geaendert = F && (a.staffel !== F.staffelung || a.vorab !== (F.vorab || 0));
    teile.knoepfe = a.tausch ? tauschKnoepfe(a) : F
      ? `<button type="button" class="app-knopf haupt" data-v="ja"${geaendert && a.capOk ? '' : ' disabled'}>${ico('check')}<span class="ak-zwei">Änderungen übernehmen<small>${geaendert ? (a.capOk ? `${mio(a.gesamt)} bleibt die Summe` : `${esc(kl(a.start))}: ${mio(a.ueber)} drüber`) : 'nichts geändert'}</small></span></button>
         <button type="button" class="app-knopf rot" data-v="zurueck">${ico('arrow-back-up')}Zurücknehmen</button>`
      : a.capOk
        ? `<button type="button" class="app-knopf haupt" data-v="ja">${ico('signature')}<span class="ak-zwei">Verlängern<small>${mio(a.gesamt)} über ${a.jahre} J ab ${esc(kl(a.start))}</small></span></button>`
        : `<button type="button" class="app-knopf warn" data-v="ja" disabled>${ico('alert-triangle')}<span class="ak-zwei">Zu wenig Cap<small>${esc(kl(a.start))}: ${mio(a.ueber)} drüber</small></span></button>`;
    return teile;
  }
  function vertragHtml(a) {
    const p = a.p, s0 = LEAGUE.season, F = a.F, f = a.f, t = vertragTeile(a);
    const wunsch = F ? (F.wunsch || '') : f.staffelung;
    const teil = (k, tag, kls) => `<${tag} class="${kls || ''}" data-teil="${k}">${t[k]}</${tag}>`;
    if (a.tausch) return tauschHtml(a, teil, wunsch);
    return `<div class="sw-blatt-titel"><b>Vertrag verlängern</b><small>beginnt nach dem alten · ab ${esc(label(a.start))}</small></div>
      <div class="sw-v-kopf">${gesicht(p, 'gross')}<div><b>${esc(voll(p))}</b>
        <span>${posBadge(p)} ${p.age} Jahre · Stärke <b>${p.ovr}</b></span>
        <span>${F ? '<span class="sw-st bereit"><i></i>Folgevertrag unterschrieben</span>' : `<span class="sw-st ${f.key}"><i></i>${f.chance} % ${esc(ST_TEXT[f.key] || '')}</span>`}</span>
        <span class="sw-klein">Alter Vertrag bis ${bis(p.contractUntil)} · Cap Hit ${esc(kl(s0))} ${mio(K.capHitJahr(p))} bleibt</span></div></div>
      ${!F && f.gruende && f.gruende.length ? `<p class="sw-klein">Forderung: ${mio(f.jahresWert)} je Jahr · ${esc(f.gruende.join(' · '))}</p>` : ''}
      ${vertragMitte(a, teil, wunsch)}
      ${teil('knoepfe', 'div', 'sw-v-knoepfe')}
      ${!F && typeof window.openNegotiation === 'function' ? `<button type="button" class="sw-link sw-berater" data-v="berater">${ico('message-dots')}Mit dem Berater verhandeln (Laufzeit, Rolle, Prämien)</button>` : ''}`;
  }
  // Gesamtsumme, Verteilung (Vorlagen gleich/steigend/fallend, D87), heute zahlen, Säulen, Cap je Saison – Verlängern und Vertrag vorab
  function vertragMitte(a, teil, wunsch) {
    const s0 = LEAGUE.season;
    return `<section class="sw-karte">
        <div class="sw-zeile"><span class="sw-ueber">Gesamtsumme</span>${teil('gesamt', 'span', 'sw-gross')}</div>
        ${teil('gesamt-text', 'span', 'sw-klein')}
        <span class="sw-ueber">Verteilung</span>
        <div class="sw-segment" role="group" aria-label="Verteilung über die Jahre">${STAFFELN.map(s => `<button type="button" data-staffel="${s}" aria-pressed="${a.staffel === s}">${s}${s === wunsch ? '<small>Wunsch</small>' : ''}</button>`).join('')}</div>
        <label class="sw-ueber" for="sw-vorab">Heute zahlen (Cap ${esc(kl(s0))})</label>
        <div class="sw-regler"><input type="range" id="sw-vorab" min="0" max="${a.vorabMax}" step="${CFG.vorabSchritt}" value="${a.vorab}"${a.vorabFest || a.vorabMax <= 0 ? ' disabled' : ''} aria-valuetext="${esc(mio(a.vorab))}">${teil('vorab', 'b')}</div>
        ${teil('vorab-text', 'span', 'sw-klein')}
        ${teil('saeulen', 'div', 'sw-ms-reihe')}
      </section>
      <section class="sw-karte"><span class="sw-ueber">Cap frei je Saison (Mio €)</span>${teil('wirkung', 'div', 'sw-tabelle')}${teil('hinweis', 'div', 'sw-roll')}</section>`;
  }

  // ── D86: Vertrag vorab im Trade (dfl_trade_patch.js) ─────────────────────
  // Dasselbe Blatt für einen Spieler, der erst mit dem Tausch kommt (Vorschau spiel/dfl_trade_vorschau.html, freigegeben):
  // Schritte Trade → Vertrag → beides bestätigen; der Vertrag ist ein Folgevertrag wie beim Verlängern (D92: beginnt nach dem
  // alten, Vorlagen D87, „heute zahlen“), der Cap rechnet mit dem Kader nach dem Tausch. Gebucht wird erst mit dem Tausch.
  // t = { p (Spielspieler nach dem Tausch, noch nicht im Kader), kontext { kader, deadExtra }, f (Forderung aus Sicht des neuen
  //       Vereins, mit chance/key/text), von (abgebender Verein), staffel, vorab, vereinbart, nein,
  //       vereinbaren({ staffel, vorab, angebot }) → { ok, nein, grund }, streichen(), zurueck() }
  function tauschVertrag(t) {
    if (!dfl() || !t || !t.p) return;
    vzZ = { id: t.p.id, staffel: t.staffel || null, vorab: t.vorab || 0, tausch: t };
    vertragMalen(true);
  }
  function tauschHtml(a, teil, wunsch) {
    const T = vzZ.tausch, p = a.p, s0 = LEAGUE.season, f = a.f;
    const status = T.nein ? '<span class="sw-st nein"><i></i>lehnt ab</span>'
      : T.vereinbart ? '<span class="sw-st bereit"><i></i>Vertrag vereinbart</span>'
        : `<span class="sw-st ${esc(f.key || 'offen')}"><i></i>${f.chance != null ? f.chance + ' % ' : ''}${esc(f.text || ST_TEXT[f.key] || '')}</span>`;
    return `<div class="sw-blatt-titel"><b>Vertrag vorab</b><small>gilt nur zusammen mit dem Trade</small></div>
      <div class="sw-schritte" aria-label="Ablauf"><span class="fertig"><b>1</b>Trade</span><span class="jetzt"><b>2</b>Vertrag</span><span><b>3</b>beides bestätigen</span></div>
      <div class="sw-v-kopf">${gesicht(p, 'gross')}<div><b>${esc(voll(p))}</b>
        <span>${posBadge(p)} ${p.age} Jahre · Stärke <b>${p.ovr}</b></span>
        <span>${status}</span>
        <span class="sw-klein">${T.von ? `Kommt von ${esc(T.von)} · ` : ''}Vertrag bis ${bis(p.contractUntil)} · Cap Hit ${esc(kl(s0))} bei dir ${mio(K.capHitJahr(p))}</span></div></div>
      <p class="sw-klein">Forderung: ${mio(f.jahresWert)} je Jahr · ${plural(f.jahre, 'Jahr', 'Jahre')}${f.gruende && f.gruende.length ? ' · ' + esc(f.gruende.join(' · ')) : ''}</p>
      ${vertragMitte(a, teil, wunsch)}
      ${T.nein ? `<div class="sw-info schlecht">${ico('hand-stop')}<span>${esc(voll(p))} will vorab nicht verlängern. Der Tausch geht trotzdem – ohne Vertrag, sein Vertrag endet dann nach dieser Saison.</span></div>` : ''}
      ${teil('knoepfe', 'div', 'sw-v-knoepfe')}`;
  }
  function tauschKnoepfe(a) {
    const T = vzZ && vzZ.tausch;
    if (!T) return '';
    const zurueck = `<button type="button" class="app-knopf" data-v="trade">${ico('arrows-left-right')}Zum Trade</button>`;
    if (T.nein) return zurueck;
    if (!a.capOk) return `<button type="button" class="app-knopf warn" data-v="ja" disabled>${ico('alert-triangle')}<span class="ak-zwei">Zu wenig Cap<small>${esc(kl(a.start))}: ${mio(a.ueber)} drüber</small></span></button>` + zurueck;
    return `<button type="button" class="app-knopf haupt" data-v="ja">${ico('signature')}<span class="ak-zwei">${T.vereinbart ? 'Änderungen übernehmen' : 'Vertrag vereinbaren'}<small>${mio(a.gesamt)} über ${a.jahre} J ab ${esc(kl(a.start))} · gilt mit dem Trade</small></span></button>` +
      (T.vereinbart ? `<button type="button" class="app-knopf rot" data-v="streichen">${ico('x')}Vertrag streichen</button>` : '') + zurueck;
  }
  const vzSpieler = () => (vzZ ? (vzZ.tausch ? vzZ.tausch.p : imKader(vzZ.id)) : null);
  const vzOpt = () => (vzZ.tausch ? { staffel: vzZ.staffel, vorab: vzZ.vorab, kontext: vzZ.tausch.kontext, f: vzZ.tausch.f } : { staffel: vzZ.staffel, vorab: vzZ.vorab });
  let vzAngebot = null;
  // Vertragsblatt noch offen? (am Handy schließt das Blatt auch über die Shell: X, Hintergrund, Escape)
  function vertragOffen() {
    if (!vzZ) return false;
    if (!handy()) return !!document.getElementById('dfl-sv-vertrag');
    const b = document.getElementById('app-blatt');
    return !!(b && b.classList.contains('auf') && b.querySelector('.app-blatt-box .sw-vertrag'));
  }
  function vertragMalen(neu) {
    if (!vzZ) return;
    if (!neu && !vertragOffen()) { vzZ = null; vzAngebot = null; return; }
    const p = vzSpieler();
    if (!p) { vertragZu(); return; }
    vzAngebot = angebot(p, vzOpt());
    const html = vertragHtml(vzAngebot);
    if (handy()) {
      const box = document.querySelector('#app-blatt .app-blatt-box');
      if (!box) return;
      box.innerHTML = `<div class="app-griff"></div><button class="app-blatt-zu" aria-label="Schließen">${ico('x')}</button><div class="sw-vertrag">${html}</div>`;
      if (neu) box.scrollTop = 0;          // neues Blatt beginnt oben (die Box behält sonst die Lage des vorigen Blatts)
      box.onclick = vertragKlick; box.oninput = vertragInput;
      const b = document.getElementById('app-blatt');
      if (neu || !b.classList.contains('auf')) { b.classList.add('auf'); document.body.classList.add('app-gesperrt'); }
      try { if (window.DFLAppShell) DFLAppShell.cta(); } catch (e) { /* Haupt-Button */ }
    } else {
      let ov = document.getElementById('dfl-sv-vertrag');
      if (!ov) {
        ov = document.createElement('div'); ov.id = 'dfl-sv-vertrag'; ov.className = 'sw-ov';
        ov.innerHTML = `<div class="sw-dialog" role="dialog" aria-modal="true" aria-label="Vertrag verlängern"><button class="app-blatt-zu sw-zu" type="button" aria-label="Schließen">${ico('x')}</button><div class="sw-vertrag"></div></div>`;
        ov.addEventListener('click', ev => { if (ev.target === ov || ev.target.closest('.sw-zu')) { vertragZu(); return; } vertragKlick(ev); });
        ov.addEventListener('input', vertragInput);
        document.body.appendChild(ov);
      }
      ov.querySelector('.sw-dialog').setAttribute('aria-label', vzZ.tausch ? 'Vertrag vorab' : 'Vertrag verlängern');
      ov.querySelector('.sw-vertrag').innerHTML = html;
    }
  }
  function vertragZu() {
    vzZ = null; vzAngebot = null;
    const ov = document.getElementById('dfl-sv-vertrag'); if (ov) ov.remove();
    const b = document.getElementById('app-blatt'), box = b && b.querySelector('.app-blatt-box');
    if (box && box.querySelector('.sw-vertrag')) { b.classList.remove('auf'); document.body.classList.remove('app-gesperrt'); box.oninput = null; }
    try { if (window.DFLAppShell) DFLAppShell.cta(); } catch (e) { /* Haupt-Button */ }
  }
  function vertragInput(ev) {
    const r = ev.target.closest && ev.target.closest('#sw-vorab');
    if (!r || !vzZ) return;
    vzZ.vorab = +r.value;
    const p = vzSpieler(); if (!p) return;
    vzAngebot = angebot(p, vzOpt());
    r.setAttribute('aria-valuetext', mio(vzAngebot.vorab));
    const t = vertragTeile(vzAngebot), wurzel = r.closest('.sw-vertrag');
    if (wurzel) wurzel.querySelectorAll('[data-teil]').forEach(e => { const k = e.getAttribute('data-teil'); if (t[k] != null && e.innerHTML !== t[k]) e.innerHTML = t[k]; });
  }
  function vertragKlick(ev) {
    if (!vzZ) return;
    const st = ev.target.closest('[data-staffel]');
    if (st) { vzZ.staffel = st.getAttribute('data-staffel'); vertragMalen(); return; }
    const k = ev.target.closest('[data-v]');
    if (!k || k.disabled) return;
    // D86: Vertrag vorab – vereinbaren (Spieler entscheidet, gebucht wird erst mit dem Tausch), streichen, zurück zum Trade
    if (vzZ.tausch) {
      const T = vzZ.tausch, was = k.getAttribute('data-v');
      if (was === 'ja') {
        const a = vzAngebot || angebot(T.p, vzOpt());
        const r = T.vereinbaren ? T.vereinbaren({ staffel: a.staffel, vorab: a.vorab, angebot: a }) : null;
        if (r && r.ok) { vertragZu(); if (T.zurueck) T.zurueck(); return; }
        if (r && r.nein) T.nein = true;
        if (r && r.grund) toast(r.grund, r.nein ? 'warn' : 'error');
        vertragMalen();
      } else if (was === 'streichen') { if (T.streichen) T.streichen(); vertragZu(); if (T.zurueck) T.zurueck(); }
      else if (was === 'trade') { vertragZu(); if (T.zurueck) T.zurueck(); }
      return;
    }
    const p = imKader(vzZ.id); if (!p) return;
    if (k.getAttribute('data-v') === 'ja') {
      const r = verlaengern(p.id, { staffel: vzZ.staffel, vorab: vzZ.vorab });
      if (r.ok) { toast(`${voll(p)}: Folgevertrag ab ${label(r.vertrag.start)} – ${mio(r.vertrag.gesamt)}`, 'success'); vertragZu(); neuZeichnen(); }
      else { toast(r.grund, r.abgelehnt ? 'warn' : 'error'); vertragMalen(); }
    } else if (k.getAttribute('data-v') === 'berater') {
      // Berater-Verhandlung (contracts_patch.js): bei Zusage ebenfalls ein Folgevertrag (window.dflFolgevertrag)
      const id = p.id; vertragZu(); window.openNegotiation(id);
    } else if (k.getAttribute('data-v') === 'zurueck') {
      if (!window.confirm(`Folgevertrag mit ${voll(p)} zurücknehmen?${p.vorauszahlung && p.vorauszahlung.saison === LEAGUE.season ? ' Die Vorauszahlung kommt zurück.' : ''}`)) return;
      zuruecknehmen(p.id); vertragZu(); neuZeichnen();
    }
  }

  // ── Haken für die App-Oberfläche (dfl_app_shell.js) ──────────────────────
  // Haupt-Button: einmal je Saison „Saisonvorbereitung“, danach wie gehabt (Woche weiter / Saison abschließen)
  function ctaSchritt() {
    const v = vb();
    if (!v || v.gesehen) return null;
    const z = zahlen();
    return { text: 'Saisonvorbereitung', sub: `${plural(z.endet.length, 'Vertrag endet', 'Verträge enden')} · Cap ${kl(LEAGUE.season + 1)}`, icon: 'ti-calendar-event', go: () => zeigen() };
  }
  function ctaText() {
    if (!vbLesen()) return '';
    const z = zahlen(), t = [plural(z.endet.length, 'Vertrag endet', 'Verträge enden')];
    if (z.offen.length) t.push(`${z.offen.length} offen`);
    if (z.vor.length) t.push(`${z.vor.length} vorgemerkt`);
    return t.join(' · ');
  }
  function kachel() {
    if (!vb()) return null;
    const x = capPlan().spalten[1], z = zahlen();
    return { ic: 'ti-calendar-event', z: x.frei < 0 ? 'schlecht' : z.offen.length ? 'mittel' : 'gut',
      gross: `${x.frei < 0 ? '−' : ''}${zahl1(Math.abs(x.frei))}<small> Mio</small>`,
      unten: `Saisonvorbereitung · ${z.offen.length ? z.offen.length + ' offen' : 'Cap ' + kl(x.saison)}`, go: () => zeigen() };
  }
  // Spieler-Blatt: Verlängern/Folgevertrag und „Am Saisonende“ (neben „Entlassen“), Statuszeilen
  // D111 (2026-10-11): „Am Saisonende entlassen“ steht im Entlassen-Blatt (dfl_ebenen_patch.js) neben „Jetzt entlassen“ – mit
  // beiden Dead-Cap-Kacheln (entlassenVergleich); ohne das Modul wie vorher hier
  const ebenen = () => !!(window.DFLEbenen && window.DFLEbenen.entlassenBlatt);
  function blattKnoepfe(p) {
    if (!dfl() || !p || SQUAD.indexOf(p) < 0) return [];
    const out = [];
    if (p.vertragFolge || !verlaengerbarGrund(p)) out.push(`<button class="app-knopf" data-a="sw-verl">${ico('signature')}${p.vertragFolge ? 'Folgevertrag' : 'Verlängern'}</button>`);
    const an = istVorgemerkt(p.id);
    if (!ebenen() && (an || !vormerkbarGrund(p))) out.push(`<button class="app-knopf${an ? '' : ' rot'}" data-a="sw-vor">${ico(an ? 'scissors-off' : 'scissors')}${an ? 'Vormerkung aufheben' : 'Am Saisonende entlassen'}</button>`);
    return out;
  }
  // Cap Hits nach der nächsten Saison bis zum Vertragsende (wird beim Vormerken ebenfalls frei)
  const danachFrei = p => { let x = 0; for (let s = LEAGUE.season + 2; s <= (p.contractUntil || 0); s++) x += K.capHitSaison(p, s); return x; };
  // Vertragstext (Ebene 3, ⓘ am Vertrag im Spieler-Blatt): leer, wenn nichts zu erklären ist
  function vertragHinweis(p) {
    if (!dfl() || !p || SQUAD.indexOf(p) < 0 || p.vertragFolge || karriereSet().has(p.id) || !endetJetzt(p)) return '';
    return 'Sein Vertrag endet nach dieser Saison. Verlängern geht jetzt – der neue Vertrag beginnt nach dem alten.' +
      (vb() ? '' : ' Spätestens entscheidest du in der Saisonvorbereitung (Finalwoche).');
  }
  // D93: sofort entlassen oder zum Saisonende (Dead Cap erst in der neuen Saison) – Kacheln fürs Entlassen-Blatt
  function entlassenVergleich(p) {
    if (!dfl() || !p || SQUAD.indexOf(p) < 0) return '';
    const s0 = LEAGUE.season, s1 = s0 + 1, vor = istVorgemerkt(p.id), jetzt = K.deadCapVon(p);
    const kJetzt = `<div class="sw-vg"><small>Jetzt entlassen</small><b>${mio(jetzt)}</b><span>Dead Cap ${esc(kl(s0))}, fehlt ab sofort</span></div>`;
    if (!vor && vormerkbarGrund(p)) return `<div class="sw-vergleich">${kJetzt}</div>`;
    const nach = K.deadCapNach(p), hit = K.capHitSaison(p, s1), spart = hit - nach, danach = danachFrei(p);
    return `<div class="sw-vergleich">${kJetzt}
      <div class="sw-vg${vor ? ' an' : ''}"><small>Am Saisonende</small><b>${mio(nach)}</b><span>Dead Cap ${esc(kl(s1))} statt ${mio(hit)}: <em class="${spart >= 0 ? 'gut' : 'schlecht'}">${spart >= 0 ? 'spart' : 'kostet'} ${mio(Math.abs(spart))}</em>${danach > 0 ? `, danach ${mio(danach)} frei` : ''}</span></div></div>`;
  }
  function blattInfo(p) {
    if (!dfl() || !p || SQUAD.indexOf(p) < 0) return '';
    const z = [], ende = karriereSet().has(p.id), vor = istVorgemerkt(p.id), neu = ebenen();
    if (ende) z.push(`<div class="sw-info">${ico('flag')}<span>Karriereende nach dieser Saison – sein Vertrag endet ohne Dead Cap.</span></div>`);
    if (p.vertragFolge) {
      const F = p.vertragFolge;
      z.push(`<div class="sw-info gut">${ico('signature')}<span>Folgevertrag ab ${esc(label(F.start))}: ${mio(F.gesamt)} über ${plural(F.jahre, 'Jahr', 'Jahre')} (${esc(F.staffelung)}), bis ${bis(F.start + F.jahre - 1)}</span></div>`);
    } else if (!neu && vertragHinweis(p)) {
      z.push(`<div class="sw-info">${ico('file-text')}<span>${esc(vertragHinweis(p))}</span></div>`);
    }
    if (!neu && (vor || !vormerkbarGrund(p))) z.push(entlassenVergleich(p));
    if (vor) z.push(`<div class="sw-info schlecht">${ico('scissors')}<span>Vorgemerkt: spielt bis zum Saisonende, geht dann.${neu ? ' <button type="button" class="sw-link" data-a="sw-vor">Aufheben</button>' : ''}</span></div>`);
    return z.join('');
  }
  function blattKlick(a, p, kontext) {
    if (a === 'sw-verl') { vertragBlatt(p.id); return true; }
    if (a === 'sw-vor') {
      vormerkenKlick(p.id);
      if (window.DFLAppShell) DFLAppShell.spielerBlatt(p, kontext);
      return true;
    }
    return false;
  }

  // ── Briefings (D91) ──────────────────────────────────────────────────────
  const info = p => ({ id: p.id, dflId: p.dflId || null, firstName: p.firstName || '', name: p.name, pos: p.pos, age: p.age, ovr: p.ovr, dflSeed: p.dflSeed, seed: p.seed });
  const teamName = id => { if (id === 'fcm') return CLUB.name; try { const t = LEAGUE.tiers.bundesliga.groups[0].teams.find(x => x.id === id); return t ? t.name : id; } catch (e) { return id; } };
  const wappen = (id, kls) => `<span class="lg-crest${kls ? ' ' + kls : ''}" style="${typeof crestStyle === 'function' ? crestStyle(id) : ''}" aria-hidden="true">${typeof crestInitials === 'function' ? crestInitials(teamName(id)) : ''}</span>`;
  // Gleiche Kurznamen in einem Briefing (2026-10-11: zweimal „F. Lang“ unter „Weg“) → dort der volle Vorname
  const doppelteKurz = listen => {
    const n = {};
    listen.forEach(l => (l || []).forEach(p => { const k = kurz(p); (n[k] = n[k] || new Set()).add(p.firstName || ''); }));
    return new Set(Object.keys(n).filter(k => n[k].size > 1));
  };
  function mini(x, grund, kls, doppelt) {
    const nm = doppelt && x.firstName && doppelt.has(kurz(x)) ? x.firstName + ' ' + (x.name || '') : kurz(x);
    return `<span class="sw-mini" title="${esc(voll(x))}"><span class="sw-mini-bild">${gesicht(x)}<span class="sw-mini-ovr">${x.ovr}</span></span><b>${esc(nm)}</b><span class="sw-grund ${kls}">${esc(grund)}</span></span>`;
  }
  // Briefing-Fenster: Haupt-Knopf steht zuerst im Dokument (unten angezeigt) – Werkzeuge klicken den ersten passenden Knopf
  function briefing(id, titel, html, knoepfe, weiter) {
    const alt = document.getElementById(id); if (alt) alt.remove();
    const ov = document.createElement('div');
    ov.id = id; ov.className = 'sw-ov sw-briefing';
    ov.innerHTML = `<div class="sw-dialog" role="dialog" aria-modal="true" aria-label="${esc(titel)}"><div class="sw-fuss">${knoepfe}</div><div class="sw-inhalt">${html}</div></div>`;
    ov.addEventListener('click', ev => {
      const b = ev.target.closest('[data-sw], [data-fa]');
      if (!b) return;
      const was = b.getAttribute('data-sw');
      ov.remove();
      weiter(was, b.getAttribute('data-fa'));
    });
    ov.addEventListener('keydown', ev => {          // Free-Agent-Zeilen (role="button") auch mit Enter/Leertaste
      if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches && ev.target.matches('[data-fa]')) { ev.preventDefault(); ev.target.click(); }
    });
    document.body.appendChild(ov);
    const k = ov.querySelector('.sw-fuss button'); if (k) { try { k.focus({ preventScroll: true }); } catch (e) { /* ohne Fokus */ } }
    return ov;
  }
  // Abschluss: nach dem Saison-Rückblick, vor dem Draft
  function abschlussHtml(w) {
    const a = w.abschluss, s1 = w.saison, s0 = w.alteSaison, e = a.eigen || {}, m = a.meister;
    const cap = a.cap, frei = cap.limit - cap.belegt - cap.rookies;
    const skala = Math.max(cap.limit, cap.belegt + cap.rookies) || 1;
    const segs = [['fest', cap.fest], ['neu', cap.neu], ['rookie', cap.rookies], ['dead', cap.dead]];
    let x = 0;
    const balken = `<div class="sw-capbalken${frei < 0 ? ' drueber' : ''}" role="img" aria-label="Cap ${esc(label(s1))}: ${esc(mio(cap.belegt + cap.rookies))} von ${esc(mio(cap.limit))}">` +
      segs.filter(([, v]) => v > 0).map(([c, v]) => { const h = `<i class="sw-seg ${c}" style="left:${(x / skala * 100).toFixed(2)}%;width:${(v / skala * 100).toFixed(2)}%"></i>`; x += v; return h; }).join('') +
      (frei < 0 ? `<i class="sw-grenze" style="left:${(cap.limit / skala * 100).toFixed(2)}%"></i>` : '') + '</div>';
    const dkA = doppelteKurz([a.weg]), weg = a.weg.map(p => mini(p, GRUND[p.grund] || 'weg', p.grund, dkA));
    // wer nach dem Saisonwechsel noch da war (später aus dem Postfach geöffnet: ohne Rookies und Neuzugänge)
    const basis = new Set(w.basis || SQUAD.map(p => p.id)), bleibt = SQUAD.filter(p => basis.has(p.id)).sort((p, q) => q.ovr - p.ovr);
    const etappen = (e.spiele || []).map(sp => `<span class="sw-etappe ${sp.sieg ? 'sieg' : 'aus'}">${RUNDE[sp.runde] || ''} ${sp.tore} ${esc(sp.gegner)}</span>`).join('');
    const preise = (a.preise || []).map(pr => `<span>${ico('medal')}${esc(pr)}</span>`).join('');
    return `<div class="sw-blatt-titel"><b>Saisonabschluss ${esc(label(s0))}</b><small>Briefing</small></div>
      ${m ? `<section class="sw-karte sw-meister"><div class="sw-verein">${wappen(m.id, 'sw-wappen')}<div><span class="sw-ueber">${ico('trophy')} DKL-Meister</span><b>${esc(m.name)}</b>
        ${m.finale ? `<span class="sw-klein">Finale ${esc(m.finale)}${m.ort ? ' · ' + esc(m.ort) : ''}</span>` : ''}</div></div></section>` : ''}
      <section class="sw-karte"><div class="sw-zeile"><span class="sw-ueber">${esc(CLUB.name)}</span>${e.staerkeRang ? `<span class="sw-klein">Stärke-Rang ${e.staerkeRang}</span>` : ''}</div>
        ${e.platz ? `<div class="sw-zeile sw-links"><span class="sw-gross">${e.platz}.<small> Platz</small></span><span class="sw-klein">${e.pts} Punkte · ${e.w}-${e.d}-${e.l} · ${e.gf}:${e.ga}</span></div>` : ''}
        <div class="sw-weg">${e.seed ? `<span class="sw-etappe">Seed ${e.seed}</span>` : ''}${etappen}</div>
        <b class="sw-runde">${esc(e.rundeText || '')}</b>
        ${preise ? `<div class="sw-preise">${preise}</div>` : ''}</section>
      <section class="sw-karte"><div class="sw-zeile"><span class="sw-ueber">Cap ${esc(label(s1))}</span><span class="sw-gross klein ${frei >= 0 ? 'gut' : 'schlecht'}">${zahl1(Math.abs(frei))}<small> Mio ${frei >= 0 ? 'frei' : 'drüber'}</small></span></div>
        ${balken}
        <div class="sw-legende"><span><i class="fest"></i>Verträge ${zahl1(cap.fest)}</span><span><i class="neu"></i>verlängert ${zahl1(cap.neu)}</span><span><i class="rookie"></i>Rookies ${zahl1(cap.rookies)}</span><span><i class="dead"></i>Dead Cap ${zahl1(cap.dead)}</span></div>
        <span class="sw-klein">Limit ${mio(cap.limit)} = Cap ${zahl1(cap.cap)} + Rollover ${zahl1(cap.limit - cap.cap)}</span></section>
      <section class="sw-karte"><div class="sw-gruppe"><h4>${ico('user-minus')}Wer geht</h4><span class="sw-anzahl">${weg.length}</span></div>
        <div class="sw-minis">${weg.join('') || '<span class="sw-klein">niemand</span>'}</div></section>
      <section class="sw-karte"><div class="sw-gruppe"><h4>${ico('users')}Wer bleibt</h4><span class="sw-anzahl">${bleibt.length}</span></div>
        <div class="sw-strip">${bleibt.slice(0, 9).map(p => gesicht(p, 'klein')).join('')}${bleibt.length > 9 ? `<span class="sw-klein">+${bleibt.length - 9}</span>` : ''}</div>
        ${a.verlaengert.length ? `<span class="sw-klein">mit neuem Vertrag ab ${esc(label(s1))}: ${a.verlaengert.map(p => esc(kurz(p) + (p.pos ? ' (' + p.pos + ')' : ''))).join(', ')}</span>` : ''}</section>
      <section class="sw-karte"><div class="sw-gruppe"><h4>${ico('school')}Draft</h4><span class="sw-klein">Rookie-Cap ${mio(cap.rookies)}</span></div>
        <div class="sw-tickets">${(a.picks || []).map(ticketHtml).join('') || '<span class="sw-klein">keine eigenen Picks</span>'}</div></section>`;
  }
  function briefingAbschluss(weiter) {
    const w = dfl() && LEAGUE.dflWechsel;
    if (!w || !w.abschluss) { if (weiter) weiter(); return; }
    w.abschlussGezeigt = true;
    // Falls das Draft-Fenster schon offen ist: ausblenden, sonst läuft seine 60-s-Uhr beim Lesen weiter (es kommt danach wieder)
    const dr = document.getElementById('dfl-draft-ov'); if (dr && weiter) dr.remove();
    const d = LEAGUE.dflDraft, draft = !!(d && !d.fertig), eigen = draft ? d.slots.findIndex((x, i) => i >= d.nr && x.besitzer === 'fcm') : -1;
    const knopf = !weiter ? `<button type="button" class="app-knopf haupt" data-sw="weiter">${ico('check')}Schließen</button>`
      : draft ? `<button type="button" class="app-knopf haupt" data-sw="weiter">${ico('school')}<span class="ak-zwei">Weiter zum Draft<small>${eigen >= 0 ? `Pick #${eigen + 1} wartet` : 'ohne eigenen Pick'}</small></span></button>`
      : `<button type="button" class="app-knopf haupt" data-sw="weiter">${ico('arrow-right')}Weiter</button>`;
    briefing('dfl-sw-briefing', 'Briefing Saisonabschluss', abschlussHtml(w), knopf, () => { speichern(); if (weiter) weiter(); });
  }
  // Start: Cap frei, Kader, Warnungen, Zu-/Abgänge, Positionen gegen den Sollkader, je Lücke der beste bezahlbare Free Agent
  function startDaten() {
    const w = LEAGUE.dflWechsel && LEAGUE.dflWechsel.saison === LEAGUE.season ? LEAGUE.dflWechsel : null;
    const L = D.liga(), eig = D.eigeneDflId(), d = LEAGUE.dflDraft;
    // ohne Daten vom Saisonwechsel (erste Saison einer Karriere, älterer Spielstand): wer in dieser Saison kam (Draft, Free Agency und
    // Trade setzen acquiredSeason)
    const basis = w && Array.isArray(w.basis) ? new Set(w.basis) : null;
    const neu = SQUAD.filter(p => basis ? !basis.has(p.id) : p.acquiredSeason === LEAGUE.season).map(p => {
      const rv = p.rookieVertrag, draft = rv && d && rv.jahr === d.jahr;
      return Object.assign(info(p), { grund: draft ? 'draft' : /^sq_fa_/.test(p.id) ? 'fa' : 'trade', text: draft ? `Draft #${rv.pick}` : /^sq_fa_/.test(p.id) ? 'Free Agent' : 'Trade' });
    });
    // wo ist er jetzt? Free Agent oder bei einem anderen Verein (Trade, Abwerben, Free Agency) – dann mit dessen Kürzel
    const kuerzel = tid => { const f = D.franchise(tid); return (f && (f.kurz || f.kuerzel)) || ''; };
    const wo = id => {
      if ((L.freie || []).some(x => x.id === id || x.sq === id)) return { grund: 'frei' };
      for (const t of L.teams) if (t.id !== eig && t.roster.concat(t.practice_squad || []).some(x => x.id === id || x.sq === id)) return { grund: 'verein', text: '→ ' + kuerzel(t.id) };
      return { grund: 'sonst' };
    };
    let weg = [];
    if (basis) {
      weg = (w.abschluss ? w.abschluss.weg : []).slice();
      const da = new Set(SQUAD.map(p => p.id));
      (w.basisInfo || []).filter(x => !da.has(x.id)).forEach(x => {
        const o = wo(x.dflId || x.id);
        weg.push(Object.assign({}, x, o.grund === 'frei' ? { grund: 'entlassen' } : o));       // nach dem Saisonwechsel heißt Free Agent: entlassen
      });
    } else {
      // erste Saison/älterer Stand: wer zuletzt bei uns war (_exVerein), jetzt Free Agent oder bei einem anderen Verein
      [].concat(L.freie || [], ...L.teams.filter(t => t.id !== eig).map(t => t.roster)).filter(x => x._exVerein === eig && !SQUAD.some(q => q.dflId === x.id))
        .forEach(x => weg.push(Object.assign({ id: x.id, firstName: x.firstName, name: x.name, pos: x.pos, age: x.age, ovr: x.ovr, dflSeed: x.seed },
          x.teamId ? { grund: 'verein', text: '→ ' + kuerzel(x.teamId) } : { grund: 'frei' })));
    }
    return { w, neu, weg };
  }
  function startHtml() {
    const s = LEAGUE.season, dat = startDaten(), haupt = K.hauptkader(), ds = SQUAD.filter(p => p.perspektiv).length;
    const belegt = K.capBelegt(), limit = K.capLimit(), frei = limit - belegt, warn = K.startPruefung();
    const n = positionen(haupt), soll = SOLL();
    const fehlt = Object.keys(soll).filter(k => (n[k] || 0) < soll[k]);
    const tipps = [];
    fehlt.forEach(pos => {
      if (tipps.length >= CFG.faTipps) return;
      const fa = (CLUB.freeAgents || []).filter(x => x && x.freeAgent && (G.dflPos ? G.dflPos(x.pos) : x.pos) === pos).sort((a, b) => b.ovr - a.ovr).slice(0, 4);
      for (const x of fa) {
        const k = window.dflFaKonditionen ? window.dflFaKonditionen(x, null) : null;
        const hit = k ? k.capHit : (x.faWageDemand || x.wage || 0) * 52;
        if (hit <= frei) { tipps.push({ x, hit, jahre: k ? k.vertrag.years_total : 1 }); break; }
      }
    });
    const geg = (() => { try { const f = typeof fcmNextFixture === 'function' ? fcmNextFixture(LEAGUE) : null; return f ? teamName(f.opponentId) : ''; } catch (e) { return ''; } })();
    const dkS = doppelteKurz([dat.neu, dat.weg]);
    const neuHtml = dat.neu.map(p => mini(p, p.text, p.grund === 'draft' ? 'draft' : p.grund === 'fa' ? 'fa' : 'trade', dkS));
    const wegHtml = dat.weg.map(p => mini(p, p.text || GRUND[p.grund] || 'weg', p.grund, dkS));
    const balkenW = Math.min(100, belegt / Math.max(1, limit) * 100);
    return `<div class="sw-blatt-titel"><b>Saisonstart ${esc(label(s))}</b><small>${geg ? 'Spieltag 1 gegen ' + esc(geg) : 'vor Spieltag 1'}</small></div>
      <div class="sw-kacheln">
        <section class="sw-karte"><span class="sw-ueber">Cap frei</span><span class="sw-gross klein ${frei >= 0 ? 'gut' : 'schlecht'}">${frei < 0 ? '−' : ''}${zahl1(Math.abs(frei))}<small> Mio €</small></span>
          <div class="sw-capbalken flach${frei < 0 ? ' drueber' : ''}" role="img" aria-label="Cap: ${esc(mio(belegt))} von ${esc(mio(limit))}"><i class="sw-seg fest" style="left:0;width:${balkenW.toFixed(1)}%"></i></div>
          <span class="sw-klein">${zahl1(belegt)} von ${zahl1(limit)}</span></section>
        <section class="sw-karte"><span class="sw-ueber">Kader</span><span class="sw-gross klein">${haupt.length}<small>/28</small></span><span class="sw-klein">mind. ${K.MIN()} · Dev. Squad ${ds}/6</span></section>
      </div>
      ${warn.length ? `<div class="sw-warnung">${ico('alert-triangle')}<span>${warn.map(esc).join('<br>')}</span></div>` : ''}
      <section class="sw-karte"><div class="sw-gruppe"><h4>${ico('user-plus')}Neu</h4><span class="sw-anzahl">${neuHtml.length}</span></div><div class="sw-minis">${neuHtml.join('') || '<span class="sw-klein">niemand</span>'}</div></section>
      <section class="sw-karte"><div class="sw-gruppe"><h4>${ico('user-minus')}Weg</h4><span class="sw-anzahl">${wegHtml.length}</span></div><div class="sw-minis">${wegHtml.join('') || '<span class="sw-klein">niemand</span>'}</div></section>
      <section class="sw-karte"><div class="sw-gruppe"><h4>${ico('users')}Positionen</h4><span class="sw-klein">Soll im 28er-Kader</span></div>
        <div class="sw-luecken">${lueckenHtml(n, false)}</div>
        ${tipps.length ? `<span class="sw-ueber">Beste Free Agents für die Lücken</span>${tipps.map(t => `<div class="sw-fa-tipp" role="button" tabindex="0" data-fa="${esc(t.x.id)}">${gesicht(t.x, 'klein')}<span><b>${esc(kurz(t.x))}</b> <span>${posBadge(t.x)} ${t.x.age} J · ${zahl1(t.hit)} Mio × ${t.jahre} J</span></span><b class="sw-ovr">${window.DFLScouting && DFLScouting.aktiv() ? DFLScouting.staerkeHtml(t.x, 'kurz') : t.x.ovr}</b></div>`).join('')}`
          : fehlt.length ? '<span class="sw-klein">Kein Free Agent für die Lücken passt in den freien Cap.</span>' : '<span class="sw-klein">Alle Positionen besetzt.</span>'}</section>`;
  }
  function briefingStart() {
    if (!dfl()) return;
    const w = LEAGUE.dflWechsel = LEAGUE.dflWechsel && LEAGUE.dflWechsel.saison === LEAGUE.season ? LEAGUE.dflWechsel : { saison: LEAGUE.season, basis: null };
    w.startGezeigt = true;
    const warn = K.startPruefung();
    const knoepfe = `<button type="button" class="app-knopf haupt" data-sw="weiter">${ico(warn.length ? 'arrow-right' : 'ball-football')}<span class="ak-zwei">Weiter<small>${warn.length ? esc(warn[0]) : 'zum 1. Spieltag'}</small></span></button>` +
      (warn.length && handy() ? `<button type="button" class="app-knopf" data-sw="kader">${ico('scissors')}Kader regelkonform machen</button>` : '') +
      `<button type="button" class="app-knopf" data-sw="fa">${ico('user-plus')}Free Agents</button>`;
    briefing('dfl-sw-briefing', 'Briefing Saisonstart', startHtml(), knoepfe, (was, fa) => {
      speichern();
      if (fa) { if (typeof signFreeAgent === 'function') signFreeAgent(fa); return; }
      if (was === 'kader' && window.DFLAppShell) DFLAppShell.kaderschnitt();
      else if (was === 'fa') {
        if (window.DFLAppShell && handy()) { DFLAppShell.zeige('transfer'); } else if (typeof switchAppView === 'function') switchAppView('transfer', document.getElementById('nav-transfer'));
        const b = [...document.querySelectorAll('#view-transfer .subtab')].find(x => /'frei'/.test(x.getAttribute('onclick') || '')); if (b) b.click();
      }
      try { if (window.DFLAppShell) DFLAppShell.cta(); } catch (e) { /* Haupt-Button */ }
    });
  }

  // ── Saisonwechsel: Daten fürs Briefing, Karriereenden aus der Saisonvorbereitung ─────────────────────────────────
  let wechsel = null;
  function wechselVorher() {
    const s = LEAGUE.season, v = vbLesen(), karriere = new Set(v ? v.karriere : []), vor = new Set(vorgemerkt());
    return { alteSaison: s, mitVorab: !!v, karriere, vorher: SQUAD.filter(p => !p.onLoanFrom).map(p => ({ p, info: info(p),
      grund: karriere.has(p.id) ? 'karriere' : vor.has(p.id) ? 'entlassen' : (p.vertragFolge && p.vertragFolge.start <= s + 1) ? 'folge' : endetJetzt(p) ? 'vertrag' : null,
      dead: vor.has(p.id) ? K.deadCapNach(p) : 0 })) };
  }
  function wechselNachher(w, r) {
    const da = new Set(SQUAD), L = D.liga(), eig = D.eigeneDflId();
    const inWelt = x => {
      const id = x.info.dflId || x.info.id;
      if ((L.freie || []).some(q => q.id === id)) return 'frei';
      if (L.teams.some(t => t.id !== eig && t.roster.concat(t.practice_squad || []).some(q => q.id === id))) return 'abgeworben';
      return null;
    };
    const weg = w.vorher.filter(x => !da.has(x.p)).map(x => {
      let g = x.grund === 'folge' ? null : x.grund;
      if (!g) { const o = inWelt(x); g = o === 'abgeworben' ? 'abgeworben' : o === 'frei' ? 'frei' : 'karriere'; }
      return Object.assign({}, x.info, { grund: g, dead: x.dead || 0 });
    });
    const verlaengert = w.vorher.filter(x => x.grund === 'folge' && da.has(x.p)).map(x => Object.assign(info(x.p), { bis: x.p.contractUntil }));
    const verlIds = new Set(verlaengert.map(x => x.id));
    // Cap der neuen Saison: Verträge, davon neu begonnene Folgeverträge, Rookies (kommender Draft), Dead Cap (Vorgemerkte)
    const picks = rookieHits(K.cap(), eigenePicks());
    let fest = 0, neu = 0;
    SQUAD.forEach(p => { if (p.onLoanFrom) return; const h = K.capHitJahr(p); if (verlIds.has(p.id)) neu += h; else fest += h; });
    const cap = { cap: K.cap(), limit: K.capLimit(), fest, neu, dead: CLUB.dfl.deadCap || 0, rookies: picks.reduce((a, x) => a + (x.capHit || 0), 0) };
    cap.belegt = fest + neu + cap.dead;
    // Meister, eigenes Abschneiden (Tabelle aus der Chronik, vor dem Zurücksetzen erfasst), Preise
    const po = (r && r.dfl) || LEAGUE.dflPlayoffs || {};
    const fin = Array.isArray(po.spiele) ? po.spiele.find(sp => sp.runde === 4) : null;
    // Ergebnis wie im Turnierbaum (dfl_playoffs_patch.js): „2:2 n. V., 4:3 i. E.“; drehen = aus Sicht des Gasts
    const zusatz = (sp, drehen) => sp.art === 'Verlängerung' ? ' n. V.' : sp.art === 'Elfmeterschießen' && sp.elfer
      ? ` n. V., ${drehen ? sp.elfer[1] : sp.elfer[0]}:${drehen ? sp.elfer[0] : sp.elfer[1]} i. E.` : '';
    const meister = po.meister ? { id: po.meister, name: teamName(po.meister), ort: po.finalort || null,
      finale: fin ? `${teamName(fin.heim)} – ${teamName(fin.gast)} ${fin.gh}:${fin.ga}${zusatz(fin, false)}` : null } : null;
    const chron = (CLUB.chronicle || []).slice(-1)[0];
    const e = chron && chron.season === w.alteSaison ? { platz: chron.pos, pts: chron.pts, w: chron.w, d: chron.d, l: chron.l, gf: chron.gf, ga: chron.ga } : {};
    const KONF = { SUE_WEST: 'Süd-West', NORD_OST: 'Nord-Ost' };
    e.seed = null;
    Object.keys(po.setzliste || {}).forEach(k => { const i = po.setzliste[k].indexOf('fcm'); if (i >= 0) e.seed = `${i + 1} ${KONF[k] || ''}`.trim(); });
    e.runde = po.meister === 'fcm' ? 5 : (po.eigeneRunde || (po.ausgeschieden && po.ausgeschieden.fcm) || 0);
    e.rundeText = RUNDE_TEXT[e.runde] || '';
    e.spiele = (po.spiele || []).filter(sp => sp.heim === 'fcm' || sp.gast === 'fcm').map(sp => {
      const heim = sp.heim === 'fcm';
      return { runde: sp.runde, sieg: sp.sieger === 'fcm', gegner: teamName(heim ? sp.gast : sp.heim), tore: (heim ? `${sp.gh}:${sp.ga}` : `${sp.ga}:${sp.gh}`) + zusatz(sp, !heim) };
    });
    const preise = [];
    try {
      const H = L.historie && L.historie.saisons, pr = H && H.length ? H[H.length - 1].preise : null, NAMEN = (window.DFLHistorie && DFLHistorie.PREISE) || {};
      if (pr) {
        ['spieler', 'tore', 'verteidiger', 'rookie', 'finals'].forEach(k => { const x = pr[k]; if (x && x.teamId === eig) preise.push(`${NAMEN[k] || k}: ${x.name}${k === 'tore' && x.tore ? ` (${x.tore})` : ''}`); });
        if (pr.manager && pr.manager.teamId === eig) preise.push(`${NAMEN.manager || 'Manager der Saison'} (erwartet Platz ${pr.manager.erwartet})`);
      }
    } catch (err) { /* ohne Preise */ }
    try {
      const st = L.teams.map(t => ({ id: t.id, s: t.id === eig ? D.eigeneStaerke().ovr : S.teamWerte(t).ovr })).sort((a, b) => b.s - a.s);
      e.staerkeRang = st.findIndex(x => x.id === eig) + 1;
    } catch (err) { /* ohne Rang */ }
    LEAGUE.dflWechsel = { saison: LEAGUE.season, alteSaison: w.alteSaison, abschlussGezeigt: false, startGezeigt: false,
      abschluss: { weg, verlaengert, cap, meister, eigen: e, preise, picks: picks.map(x => ({ nr: x.nr, runde: x.runde, capHit: Math.round(x.capHit || 0) })) },
      basis: SQUAD.map(p => p.id), basisInfo: SQUAD.map(info) };
    // Rückblick: „Transfers: 0 Abgänge“ stimmte nie – die Abgänge kommen erst jetzt (D91)
    // Zugänge der Saison (Draft, Free Agents, Trades) stehen in acquiredSeason – die Chronik zählte nur Käufe/Verkäufe
    if (chron && chron.season === w.alteSaison) {
      chron.tOut = (chron.tOut || 0) + weg.length;
      chron.tIn = Math.max(chron.tIn || 0, w.vorher.filter(x => x.p.acquiredSeason === w.alteSaison).length);
    }
    CLUB.dfl.vorbereitung = null;
  }
  {
    const _orig = window.startNewSeason;
    if (typeof _orig === 'function') window.startNewSeason = function () {
      if (!dfl()) return _orig.apply(this, arguments);
      let w = null;
      try { w = wechselVorher(); } catch (e) { console.warn('[DFL-Saisonwechsel] vor dem Wechsel', e); }
      // Karriereenden stehen seit der Saisonvorbereitung fest: das Spiel würfelt sie nicht noch einmal (RealMarket)
      const R = window.RealMarket && RealMarket.config && RealMarket.config.retirement, an = R ? R.affectOwnSquad : null;
      if (w && w.mitVorab && R) R.affectOwnSquad = false;
      wechsel = w;
      let r;
      try { r = _orig.apply(this, arguments); }
      finally { if (R && an != null) R.affectOwnSquad = an; wechsel = null; }
      try { if (w && dfl()) wechselNachher(w, r); } catch (e) { console.warn('[DFL-Saisonwechsel] Briefing-Daten', e); }
      // Saisonvorbereitung ist vorbei: Ansicht/Fenster schließen
      try {
        const ov = document.getElementById('dfl-sv-ov'); if (ov) ov.remove();
        const sv = document.getElementById('view-sv');
        if (sv && sv.classList.contains('active')) { if (window.DFLAppShell && handy()) DFLAppShell.zeige('home'); else sv.classList.remove('active'); }
        if (vzZ) vertragZu();
      } catch (e) { /* Ansicht */ }
      return r;
    };
    try { startNewSeason = window.startNewSeason; } catch (e) { /* nur im Spiel */ }
  }
  // Karriereenden der Saisonvorbereitung: nach Entwicklung und Alterung der Saison (wie processRetirements), vor dem Saisonplan
  {
    const _orig = window.applyEndOfSeasonClubEffects;
    if (typeof _orig === 'function') {
      window.applyEndOfSeasonClubEffects = function () {
        const r = _orig.apply(this, arguments);
        if (wechsel && wechsel.mitVorab && dfl()) {
          try {
            SQUAD.slice().forEach(p => {
              if (!wechsel.karriere.has(p.id) || p.onLoanFrom) return;
              if (typeof clearFromLineup === 'function') clearFromLineup(p.id);
              SQUAD.splice(SQUAD.indexOf(p), 1);
              news('club', `🎖️ Karriereende: ${voll(p)}`, `${voll(p)} beendet mit ${p.age} Jahren seine aktive Karriere. Danke für den Einsatz!` +
                (p.contractUntil > wechsel.alteSaison ? ' Sein restlicher Vertrag endet ohne Dead Cap.' : ''));
            });
          } catch (e) { console.warn('[DFL-Saisonwechsel] Karriereenden', e); }
        }
        return r;
      };
      try { applyEndOfSeasonClubEffects = window.applyEndOfSeasonClubEffects; } catch (e) { /* window reicht */ }
    }
  }
  // Briefing Abschluss nach dem Saison-Rückblick (chronicle_patch.js), vor Draft und Sponsorenwahl: finishSeasonFlow ruft
  // openSponsorChoiceDialog gleich nach dem Rückblick auf (dfl_kader_patch.js öffnet dort den Draft) – solange der Rückblick
  // offen ist, warten (sonst lief die 60-s-Uhr des Drafts unter dem Rückblick); „Weiter“ im Rückblick ruft es erneut auf
  {
    const _orig = window.openSponsorChoiceDialog;
    if (typeof _orig === 'function') {
      window.openSponsorChoiceDialog = function () {
        const w = dfl() && LEAGUE.dflWechsel;
        if (!w || !w.abschluss || w.abschlussGezeigt || w.saison !== LEAGUE.season) return _orig.apply(this, arguments);
        if (document.querySelector('.exp-overlay')) return undefined;
        const self = this, args = arguments;
        try { briefingAbschluss(() => _orig.apply(self, args)); }
        catch (e) { console.warn('[DFL-Saisonwechsel] Briefing Abschluss', e); return _orig.apply(self, args); }
        return undefined;
      };
      try { openSponsorChoiceDialog = window.openSponsorChoiceDialog; } catch (e) { /* window reicht */ }
    }
  }
  // Eigenes Finale (D92): der Knopf im Spielbericht schließt die Saison nicht mehr ab, sondern führt zurück ins Office –
  // die Saisonvorbereitung bleibt bis „Saison abschließen“ offen
  let haltNachSpiel = false;
  {
    const _orig = window.finishSeasonFlow;
    if (typeof _orig === 'function') {
      window.finishSeasonFlow = function () { if (haltNachSpiel && dfl()) return undefined; return _orig.apply(this, arguments); };
      try { finishSeasonFlow = window.finishSeasonFlow; } catch (e) { /* window reicht */ }
    }
  }
  {
    const _orig = window.postMatchContinue;
    if (typeof _orig === 'function') {
      window.postMatchContinue = function () {
        const halt = dfl() && typeof fcmSeasonOver === 'function' && fcmSeasonOver();
        if (halt) haltNachSpiel = true;
        try { return _orig.apply(this, arguments); }
        finally {
          haltNachSpiel = false;
          if (halt) {
            try { vb(); if (typeof renderHomeTab === 'function') renderHomeTab(); } catch (e) { /* Office */ }
            if (!handy()) setTimeout(() => { if (offen()) zeigen(); }, 80);
          }
        }
      };
      try { postMatchContinue = window.postMatchContinue; } catch (e) { /* window reicht */ }
    }
  }
  const HALT_TEXT = 'Weiter zur Saisonvorbereitung';
  {
    const _orig = window.setupPostMatchButton;
    if (typeof _orig === 'function') {
      window.setupPostMatchButton = function () {
        const r = _orig.apply(this, arguments);
        try {
          const b = document.getElementById('ko-btn');
          if (b && dfl() && typeof fcmSeasonOver === 'function' && fcmSeasonOver()) b.innerHTML = `${ico('calendar-event')} ${HALT_TEXT} → Office`;
        } catch (e) { /* Knopf bleibt */ }
        return r;
      };
      try { setupPostMatchButton = window.setupPostMatchButton; } catch (e) { /* window reicht */ }
    }
  }
  new MutationObserver(() => {
    const b = document.getElementById('pm-continue-btn');
    if (!b || b.dataset.sw || !dfl() || !(typeof fcmSeasonOver === 'function' && fcmSeasonOver())) return;
    b.dataset.sw = '1'; b.innerHTML = `${ico('calendar-event')} ${HALT_TEXT}`;
  }).observe(document.body, { childList: true });
  // Spiel als Text (D77): nach einem Neustart mitten im Ticker zeigt der Ticker einen eigenen Bericht, dessen Knopf
  // nextWeek ruft (= Saison abschließen) – nach dem eigenen Finale führt auch er zur Saisonvorbereitung
  {
    const T = window.DFLTextspiel && window.DFLTextspiel.ui;
    const ende = () => dfl() && typeof fcmSeasonOver === 'function' && fcmSeasonOver();
    if (T && typeof T.eigenerBericht === 'function' && typeof T.weiterNachBericht === 'function') {
      const _bericht = T.eigenerBericht, _weiter = T.weiterNachBericht;
      T.eigenerBericht = function () {
        try { return _bericht.apply(this, arguments); }
        finally {
          try {
            const b = ende() && this.el && this.el.bericht && this.el.bericht.querySelector('[data-ts="weiter"]');
            if (b) b.innerHTML = `${HALT_TEXT}<i class="ti ti-chevron-right" aria-hidden="true"></i>`;
          } catch (e) { /* Knopf bleibt */ }
        }
      };
      T.weiterNachBericht = function () {
        if (!ende()) return _weiter.apply(this, arguments);
        try { this.schliessen(); } catch (e) { /* Ticker optional */ }
        try {
          vb();
          if (typeof switchAppView === 'function') switchAppView('home', document.getElementById('nav-home'));
          if (typeof renderHomeTab === 'function') renderHomeTab();
        } catch (e) { /* Office */ }
        if (!handy()) setTimeout(() => { if (offen()) zeigen(); }, 80);
        return undefined;
      };
    }
  }

  // Start-Briefing: einmal je Saison in der Woche des Kaderschnitts (die Woche vor Spieltag 1), nach dem Kaderschnitt der KI
  {
    const _orig = window.advanceCalendarWeek;
    if (typeof _orig === 'function') {
      window.advanceCalendarWeek = function () {
        const vorher = dfl() ? LEAGUE.week : null;
        const r = _orig.apply(this, arguments);
        if (dfl() && LEAGUE.week !== vorher) {
          try {
            vb();                                         // Saisonvorbereitung beginnt mit der Finalwoche (Karriereenden fest)
            const sv = document.getElementById('view-sv');
            if (sv && sv.classList.contains('active')) sv.innerHTML = svHtml();
            const w = LEAGUE.dflWechsel, mw = LEAGUE.matchWeeks;
            if (LEAGUE.matchday === 0 && Array.isArray(mw) && mw.length && LEAGUE.week + 1 >= mw[0] && !(w && w.saison === LEAGUE.season && w.startGezeigt)) {
              setTimeout(() => { try { if (dfl() && LEAGUE.matchday === 0) briefingStart(); } catch (e) { console.warn('[DFL-Saisonwechsel] Briefing Start', e); } }, 60);
            }
          } catch (e) { console.warn('[DFL-Saisonwechsel] Woche', e); }
        }
        return r;
      };
      try { advanceCalendarWeek = window.advanceCalendarWeek; } catch (e) { /* window reicht */ }
    }
  }
  // Ansicht der Saisonvorbereitung ausblenden, wenn eine andere gewählt wird (switchAppView kennt nur feste Ansichten)
  {
    const _orig = window.switchAppView;
    if (typeof _orig === 'function') {
      window.switchAppView = function (view) {
        if (view !== 'sv') { const v = document.getElementById('view-sv'); if (v) v.classList.remove('active'); }
        return _orig.apply(this, arguments);
      };
      try { switchAppView = window.switchAppView; } catch (e) { /* window reicht */ }
    }
  }
  // Postfach: Saisonvorbereitung und die beiden Briefings (bis Spieltag 1) wieder öffnen
  {
    const _orig = window.buildPostfachItems;
    if (typeof _orig === 'function') {
      window.buildPostfachItems = function () {
        const items = _orig.apply(this, arguments);
        try {
          if (dfl() && vb()) {
            const z = zahlen();
            items.push({ cat: z.offen.length ? 'warn' : 'news', icon: ico('calendar-event'), title: `Saisonvorbereitung ${label(LEAGUE.season + 1)}`,
              text: `${ctaText()} – Cap der nächsten Jahre planen, verlängern, Entlassungen vormerken.`,
              actions: '<button class="pf-btn" onclick="DFLSaisonwechsel.zeigen()">Öffnen</button>', prio: 5 });
          }
          const w = dfl() && LEAGUE.dflWechsel;
          if (w && w.saison === LEAGUE.season && LEAGUE.matchday === 0) {
            if (w.abschluss) items.push({ cat: 'news', icon: ico('clipboard-list'), title: `Briefing Saisonabschluss ${label(w.alteSaison)}`,
              text: `${plural(w.abschluss.weg.length, 'Abgang', 'Abgänge')}, Cap ${label(w.saison)} – Meister, Cap und wer geht.`,
              actions: '<button class="pf-btn" onclick="DFLSaisonwechsel.briefingAbschluss()">Ansehen</button>', prio: 2 });
            if (w.startGezeigt) items.push({ cat: 'news', icon: ico('clipboard-check'), title: `Briefing Saisonstart ${label(LEAGUE.season)}`,
              text: 'Cap frei, Kader, Lücken und die besten Free Agents dafür.', actions: '<button class="pf-btn" onclick="DFLSaisonwechsel.briefingStart()">Ansehen</button>', prio: 2 });
          }
        } catch (e) { console.warn('[DFL-Saisonwechsel] Postfach', e); }
        return items;
      };
      try { buildPostfachItems = window.buildPostfachItems; } catch (e) { /* window reicht */ }
    }
  }
  // Aufgaben-Chip „Verträge laufen aus“: wer einen Folgevertrag hat, zählt nicht
  {
    const _orig = window.renderTasksWidget;
    if (typeof _orig === 'function') {
      window.renderTasksWidget = function () {
        const r = _orig.apply(this, arguments);
        try {
          if (!dfl()) return r;
          const chip = [...document.querySelectorAll('#tasks-chips .task-chip')].find(c => /Vertr(ag|äge) l(ä|a)uf/.test(c.textContent));
          if (!chip) return r;
          const n = SQUAD.filter(p => !p.onLoanAt && p.contractUntil != null && p.contractUntil <= LEAGUE.season && !p.vertragFolge && !K.dsVertrag(p)).length;
          if (n) { chip.innerHTML = `<i class="ti ti-file-text"></i> ${n} ${n > 1 ? 'Verträge laufen' : 'Vertrag läuft'} aus`; return r; }
          const host = chip.parentElement; chip.remove();
          if (host && !host.querySelector('.task-chip')) host.innerHTML = '<span class="task-ok"><i class="ti ti-check"></i> Alles im Griff — keine offenen Aufgaben</span>';
        } catch (e) { /* Chip bleibt */ }
        return r;
      };
    }
  }

  // ── Kaderliste, Aufstellung, Verträge: Marken ────────────────────────────
  // kompakt (Kaderliste, Aufstellung): nur das Zeichen – die Namensspalte ist am Handy schmal und schneidet ab
  function markeHtml(p, kompakt) {
    if (!p) return '';
    const marke = (kl2, icon, text, titel) => `<span class="sw-marke ${kl2}${kompakt ? ' kompakt' : ''}" title="${titel}" aria-label="${titel}">${ico(icon)}${kompakt ? '' : text}</span>`;
    if (istVorgemerkt(p.id)) return marke('schere', 'scissors', 'Saisonende', 'Am Saisonende entlassen');
    if (karriereSet().has(p.id)) return marke('ende', 'flag', 'hört auf', 'Karriereende nach der Saison');
    return '';
  }
  {
    const _orig = window.renderSquadOverview;
    if (typeof _orig === 'function') window.renderSquadOverview = function () {
      const r = _orig.apply(this, arguments);
      try {
        if (!dfl()) return r;
        document.querySelectorAll('#sub-squadlist .sqo-row').forEach(row => {
          const m = /showSquadPlayerCard\('([^']+)'\)/.exec(row.getAttribute('onclick') || ''), p = m && imKader(m[1]);
          if (!p) return;
          const nm = row.querySelector('.sqo-name'), mk = markeHtml(p, true);
          // Marke in die zweite Zeile unter dem Namen (wie Rookie/Star, dfl_app_shell.js) – neben dem Namen würde er abgeschnitten
          if (nm && mk && !row.querySelector('.sw-marke')) {
            let marken = nm.querySelector('.sqo-marken');
            if (!marken) {
              const txt = document.createElement('span'); txt.className = 'sqo-nm';
              marken = document.createElement('span'); marken.className = 'sqo-marken';
              while (nm.firstChild) txt.appendChild(nm.firstChild);
              nm.append(txt, marken);
            }
            marken.insertAdjacentHTML('beforeend', mk);
          }
          if (p.vertragFolge) { const v = row.querySelector('.sqo-val'); if (v && /endet/.test(v.innerHTML)) { v.innerHTML = v.innerHTML.replace('endet', 'verl.'); v.title = 'Folgevertrag ab ' + label(p.vertragFolge.start); } }
        });
      } catch (e) { console.warn('[DFL-Saisonwechsel] Kaderliste', e); }
      return r;
    };
  }
  {
    const _orig = window.renderSquadList;
    if (typeof _orig === 'function') window.renderSquadList = function () {
      const r = _orig.apply(this, arguments);
      try {
        if (!dfl() || !CLUB.dfl || !(vorgemerkt().length || (vbLesen() && vbLesen().karriere.length))) return r;
        document.querySelectorAll('#squad-list .squad-row').forEach(row => {
          const a = row.getAttribute('onclick') || '', slot = /clickSlot\('([^']+)'\)/.exec(a), bank = /clickBench\('([^']+)'\)/.exec(a);
          const p = slot ? imKader(CLUB.lineup[slot[1]]) : bank ? imKader(bank[1]) : null, mk = markeHtml(p, true);
          const nm = row.querySelector('.squad-name');
          if (nm && mk && !row.querySelector('.sw-marke')) nm.insertAdjacentHTML('beforeend', ' ' + mk);
        });
      } catch (e) { console.warn('[DFL-Saisonwechsel] Aufstellung', e); }
      return r;
    };
  }
  // Verträge & Cap: Folgevertrag, Vormerkung, Karriereende; „Verlängern“ öffnet das Vertragsblatt
  function vertraegeHtml() {
    const s0 = LEAGUE.season, eigen = SQUAD.filter(p => !p.onLoanFrom);
    const sortiert = eigen.slice().sort((a, b) => (endetJetzt(b) - endetJetzt(a)) || ((a.contractUntil || 99) - (b.contractUntil || 99)) || b.ovr - a.ovr);
    const zeilen = sortiert.map(p => {
      const F = p.vertragFolge, endet = endetJetzt(p) && !F, vg = verlaengerbarGrund(p), vor = istVorgemerkt(p.id), ende = karriereSet().has(p.id);
      const info2 = F ? `Folgevertrag ab ${kl(F.start)} bis ${bis(F.start + F.jahre - 1)} · ${zahl1(F.gesamt)} Mio` : vor ? 'geht zum Saisonende (vorgemerkt)' : ende ? 'Karriereende nach der Saison' : endet ? 'endet nach dieser Saison' : '';
      const knoepfe = (F || !vg ? `<button class="mkt-btn${endet ? '' : ' secondary'}" onclick="DFLSaisonwechsel.vertragBlatt('${esc(p.id)}')">${F ? 'Folgevertrag' : 'Verlängern'}</button>` : '') +
        (vor || !vormerkbarGrund(p) ? `<button class="mkt-btn${vor ? '' : ' danger'}" onclick="DFLSaisonwechsel.vormerkenKlick('${esc(p.id)}')" title="Zum Saisonende entlassen">${vor ? 'Aufheben' : 'Saisonende'}</button>` : '');
      let gesicht = '';     // Nutzer 2026-10-14: „bei den verträgen noch die spielerbilder klein dazu“
      try { const f = D.franchise('fcm'); gesicht = window.DFLIdentitaet ? DFLIdentitaet.gesichtSvg(p, f ? { farben: f.farben } : null) : ''; } catch (e) { gesicht = ''; }
      return `<div class="prospect-row vt-zeile sw-vt${endet ? ' vt-aus' : ''}${vor ? ' vorgemerkt' : ''}">
        <span class="sw-vt-gesicht" aria-hidden="true">${gesicht}</span>
        <span class="pos-badge-sm pos-${esc(p.pos)}">${esc(typeof positionsDisplay === 'function' ? positionsDisplay(p) : p.pos)}</span>
        <span class="market-name sw-vt-name">${esc(kurz(p))} <small>OVR ${p.ovr}</small>${info2 ? `<small class="sw-vt-info ${F ? 'gut' : vor || endet ? 'schlecht' : ''}">${esc(info2)}</small>` : ''}</span>
        <span class="sw-vt-rechts">bis ${bis(p.contractUntil)}<small>Cap ${mio(K.capHitJahr(p))}</small></span>
        <span class="vt-knoepfe">${knoepfe}</span></div>`;
    }).join('');
    const nF = eigen.filter(p => p.vertragFolge).length, nV = vorgemerkt().length;
    return `<div class="facility-card sw-vertraege" style="margin-top:4px">
      <div class="fc-head"><div class="fc-icon">${ico('file-certificate')}</div><div style="flex:1"><div class="fc-name">Spielerverträge</div>
        <div class="fc-level">Cap Hits ${mio(eigen.reduce((a, p) => a + K.capHitJahr(p), 0))}${nF ? ` · ${nF} Folgevertr${nF === 1 ? 'ag' : 'äge'}` : ''}${nV ? ` · ${nV} vorgemerkt` : ''} · max. 5 Jahre</div></div></div>
      ${vb() ? '<button class="mkt-btn sw-vt-sv" onclick="DFLSaisonwechsel.zeigen()">Saisonvorbereitung öffnen</button>' : ''}
      <div class="youth-prospects">${zeilen || '<div class="sw-klein">Keine Spieler.</div>'}</div></div>`;
  }
  {
    const _orig = window.renderContractsSection;
    if (typeof _orig === 'function') {
      window.renderContractsSection = function () {
        if (!dfl()) return _orig.apply(this, arguments);
        try { return vertraegeHtml(); } catch (e) { console.warn('[DFL-Saisonwechsel] Verträge', e); return _orig.apply(this, arguments); }
      };
      try { renderContractsSection = window.renderContractsSection; } catch (e) { /* window reicht */ }
    }
  }
  // „Verlängern“ (Vertragsliste, Spielerkarte): in der DFL das Vertragsblatt statt der Berater-Verhandlung
  {
    const _orig = window.renewContract;
    if (typeof _orig === 'function') {
      window.renewContract = function (squadId, years) {
        if (dfl() && years == null) { vertragBlatt(squadId); return; }
        return _orig.apply(this, arguments);
      };
      try { renewContract = window.renewContract; } catch (e) { /* window reicht */ }
    }
  }

  window.DFLSaisonwechsel = {
    CFG, offen, zustand: vbLesen, vorbereitung: () => vb(), zeigen, capPlan, angebot: (id, opt) => angebot(imKader(id), opt), forderung: id => forderung(imKader(id)),
    verlaengern, zuruecknehmen, vormerken, vormerkenKlick, gehenLassen, istVorgemerkt, vorgemerkt, verlaengerbarGrund: id => verlaengerbarGrund(imKader(id)),
    vormerkbarGrund: id => vormerkbarGrund(imKader(id)), vertragBlatt, vertragZu, eigenePicks, zahlen,
    // D86 (Vertrag vorab im Trade, dfl_trade_patch.js): Angebot für einen Spieler, der erst mit dem Tausch kommt, und das Blatt dazu
    angebotFuer: (p, opt) => angebot(p, opt), tauschVertrag, vertragOffen,
    ctaSchritt, ctaText, kachel, blattKnoepfe, blattInfo, blattKlick, briefingAbschluss: () => briefingAbschluss(null), briefingStart, startDaten,
    vertragHinweis: id => vertragHinweis(typeof id === 'object' ? id : imKader(id)), entlassenVergleich: id => entlassenVergleich(typeof id === 'object' ? id : imKader(id))
  };

  // Spielstand schon geladen (initGame lädt vor den Patches): Saisonvorbereitung ggf. sofort beginnen
  try { if (dfl()) vb(); } catch (e) { /* später */ }
  console.log('%c[DFL-Saisonwechsel v1] aktiv', 'color:#3fb950;font-weight:bold',
    '— Saisonvorbereitung ab der Finalwoche (Cap je Saison, Verlängern als Folgevertrag, Entlassen vormerken), Briefings zum Abschluss und Start');
})();
