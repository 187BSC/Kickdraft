/* ═══════════════════════════════════════════════════════════════════════════
   DFL-VERTRÄGE  ·  v1   (D40, Wunsch 2026-10-08: „genauso wirtschaften wie ich“)
   ─────────────────────────────────────────────────────────────────────────
   Der eigene Verein verhandelt zu denselben Preisen wie die KI:
     · Forderung = DFLGenerator.forderung (Charakter, Treue-, Titel-, Prestige-Rabatt),
       bei eigenen Spielern zusätzlich die Stimmung (DFLStimmung: zufriedene fordern weniger)
     · Free Agents: DFL-Vertrag (Laufzeit, Handgeld-Anteil, Staffelung wie bei der KI) statt
       alter Formel mit ~50 % Aufschlag; Handgeld läuft in Raten über den Cap Hit (D41)
     · Verlängerung: Die Berater-Verhandlung (Rolle, Laufzeit, Handgeld, Prämien) bleibt als
       Spielraum um diesen Wert; der neue Vertrag wird ein DFL-Vertrag (Cap Hit nach Spec)
     · Cap-Prüfung mit dem vollen Cap Hit (Gehalt + Handgeld ÷ Jahre)
     · D87 (2026-10-11): beim Verpflichten Vorlage gleich/steigend/fallend für das Gehalt über die Jahre (Wunsch des
       Spielers vorgewählt, Gesamtsumme bleibt) – signFreeAgent(faId, jahre, staffel), dflFaKonditionen(p, jahre, staffel);
       Verlängern und Vertrag vorab nutzen dieselben Vorlagen im Vertragsblatt (dfl_saisonwechsel_patch.js)
   Hängt sich über Haken in contracts_patch.js (dflVertragsForderung, dflVertragPruefen,
   dflVertragAbschliessen) und transfermarkt_balance.js (dflFaKonditionen, dflHandgeldInRaten) ein.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const G = window.DFLGenerator, S = window.DFLSaison;
  if (!G || !S) { console.warn('[DFL-Verträge] Generator/Saisonlauf fehlt'); return; }

  const dfl = () => typeof CLUB !== 'undefined' && CLUB && CLUB.dfl && CLUB.dfl.aktiv && window.DFLSpiel && window.DFLKader;
  const mio = x => (Math.round(x / 1e5) / 10).toLocaleString('de-DE') + ' Mio €';
  const rund = (x, auf) => Math.round(x / auf) * auf;

  function weltUndTeam() {
    const L = DFLSpiel.welt();
    return { L, t: L.teams.find(x => x.id === DFLSpiel.eigeneDflId()) };
  }
  const titelkandidat = (L, t) => L.teams.slice().sort((a, b) => G.teamOvr(b) - G.teamOvr(a)).slice(0, 8).some(x => x.id === t.id);
  const freierCap = () => DFLKader.capLimit() - DFLKader.capBelegt();

  // ── Forderung wie bei der KI ─────────────────────────────────────────────
  function forderung(q, eigener) {
    const { L, t } = weltUndTeam();
    G.setzeCap(DFLKader.cap());
    const w = eigener ? DFLSpiel.spielZuDfl(q, LEAGUE.season) : q;
    const ctx = { eigenerVerein: eigener || q._exVerein === t.id, titelkandidat: titelkandidat(L, t), prestige: t.prestige || 0 };
    if (eigener && window.DFLStimmung && DFLStimmung.forderung) return DFLStimmung.forderung(Object.assign({}, w, { teamId: t.id }), t, L, ctx);
    return G.forderung(w, t, ctx);
  }

  // Verlängerung: Wochenwert für die Berater-Verhandlung (Gehalt + Handgeld ÷ Jahre, wie der Cap Hit)
  window.dflVertragsForderung = function (p) {
    if (!dfl() || !p || p.freeAgent) return null;
    try {
      const f = forderung(p, true);
      return { wochenlohn: Math.round(f.jahresWert / 52), jahre: f.jahre, gruende: f.gruende || [], jahresWert: f.jahresWert };
    } catch (e) { console.warn('[DFL-Verträge] Forderung', e); return null; }
  };
  // Cap-Prüfung vor der Unterschrift: null = in Ordnung, Text = Ablehnung, undefined = kein DFL
  window.dflVertragPruefen = function (p, s) {
    if (!dfl()) return undefined;
    // Verlängerung: contractUntil = Saison + Jahre → das Handgeld verteilt sich auf Jahre + 1 Cap-Jahre (diese Saison zählt mit)
    const rest = DFLKader.deadCapVon ? DFLKader.deadCapVon(p) : 0;      // altes Handgeld läuft im neuen Vertrag weiter
    const neu = s.wage * 52 + ((s.bonus || 0) + rest) / Math.max(1, s.years + 1);
    const alt = DFLKader.capHitJahr(p);
    if (neu - alt > freierCap() + 1) return `Zu wenig Platz unter dem Cap: Der Vertrag zählt ${mio(neu)} pro Jahr (Gehalt + Handgeld ÷ ${s.years}), frei sind ${mio(freierCap() + alt)}.`;
    return null;
  };
  // Neuer Vertrag als DFL-Vertrag: Cap Hit = Gehalt + Handgeld ÷ Laufzeit, Handgeld in Raten (kein Bargeld)
  window.dflVertragAbschliessen = function (p, s) {
    if (!dfl()) return false;
    const basis = s.wage * 52;
    // Noch nicht verrechnetes Handgeld des alten Vertrags wandert in den neuen (vorher fiel es ersatzlos weg – ausnutzbar,
    // Prüfung 2026-10-09); gerechnet mit dem alten Vertragsende, bevor dflVertragBis neu gesetzt wird
    const rest = DFLKader.deadCapVon ? DFLKader.deadCapVon(p) : 0;
    // Laufzeit in Cap-Jahren = bis contractUntil inklusive der laufenden Saison (vorher eine Saison zu viel: Handgeld × 4/3)
    const jahre = Math.max(1, (p.contractUntil || LEAGUE.season) - LEAGUE.season + 1);
    p.contract = { years_total: jahre, years_remaining: jahre, base_salary: basis, base_salary_by_year: Array(jahre).fill(basis),
      signing_bonus_total: Math.round((s.bonus || 0) + rest), guaranteed_bonuses: 0, staffelung: 'gleich', art: 'veteran' };
    p.dflVertragBis = p.contractUntil;
    DFLKader.capSetzen();
    try { DFLSpiel.eigenSync(); } catch (e) { /* nur im Spiel */ }
    return true;
  };

  // ── Free Agents ──────────────────────────────────────────────────────────
  window.dflHandgeldInRaten = () => !!dfl();
  function weltSpieler(faId) {
    const L = DFLSpiel.liga();
    return L.freie.find(x => 'fa_' + x.id === faId) || null;
  }
  // D87 (Nutzer 2026-10-10: „Gehälter staffeln und über die Jahre verteilen“ – nur Vorlagen, keine freien Regler): beim
  // Verpflichten wählst du gleich/steigend/fallend; ohne Wahl gilt der Wunsch des Spielers (Forderung). Die Gesamtsumme bleibt.
  const STAFFELN = ['gleich', 'steigend', 'fallend'];
  let faStaffelJetzt = null;               // { id, staffel } während einer Unterschrift – die Rechnungen darin nehmen dieselbe Vorlage
  // Konditionen für eine Laufzeit: Wochengehalt (1. Jahr), Handgeld, Cap Hit, fertiger Vertrag; staffel = Vorlage (D87)
  window.dflFaKonditionen = function (p, jahre, staffel) {
    if (!dfl()) return null;
    try {
      const w = weltSpieler(p.id) || p;
      const f = forderung(w, false);
      jahre = Math.max(1, Math.min(5, jahre || f.jahre));
      const st = STAFFELN.indexOf(staffel) >= 0 ? staffel : faStaffelJetzt && faStaffelJetzt.id === p.id && faStaffelJetzt.staffel ? faStaffelJetzt.staffel : f.staffelung;
      const vertrag = G.baueVertrag({ jahresWert: f.jahresWert, jahre, rest: jahre, staffelung: st,
        handgeldAnteil: f.handgeldAnteil, garantiert: 0, art: f.jahresWert <= G.CFG.mindestgehalt ? 'minimum' : 'veteran' });
      // Cap Hit im ersten Jahr (Staffel!): Grundgehalt Jahr 1 + Handgeld ÷ Laufzeit – vorher der Durchschnitt (fallende
      // Staffel lag bis 19 % höher und konnte über den Cap führen, Prüfung 2026-10-09)
      const capHit1 = (vertrag.base_salary_by_year ? vertrag.base_salary_by_year[0] : vertrag.base_salary) + (vertrag.signing_bonus_total || 0) / Math.max(1, vertrag.years_total);
      return { gehalt: Math.round(vertrag.base_salary / 52), handgeld: vertrag.signing_bonus_total, capHit: Math.round(capHit1), vertrag, gruende: f.gruende || [],
        staffel: st, wunsch: f.staffelung || 'gleich' };
    } catch (e) { console.warn('[DFL-Verträge] FA', e); return null; }
  };
  // Unterschrift: Cap-Prüfung mit vollem Cap Hit, danach DFL-Vertrag am neuen Spieler; staffel = gewählte Vorlage (D87)
  {
    const _orig = window.signFreeAgent;
    if (typeof _orig === 'function') window.signFreeAgent = function (faId, jahre, staffel) {
      if (!dfl() || jahre == null) return _orig.apply(this, arguments);
      const pool = CLUB.freeAgents || [], p = pool.find(x => x.id === faId);
      const k = p && window.dflFaKonditionen(p, jahre, staffel);
      if (k && k.capHit > freierCap() + 1) {
        alert(`Zu wenig Platz unter dem Cap: ${p.name} zählt ${mio(k.capHit)} pro Jahr, frei sind ${mio(Math.max(0, freierCap()))}.`);
        return;
      }
      const vorher = SQUAD.length;
      faStaffelJetzt = k ? { id: faId, staffel: k.staffel } : null;
      let r;
      try { r = _orig.apply(this, arguments); } finally { faStaffelJetzt = null; }
      const q = SQUAD.length > vorher ? SQUAD.find(x => x.id === 'sq_' + faId) : null;
      if (q && k) {
        q.contract = k.vertrag; q.wage = k.gehalt;
        q.contractUntil = LEAGUE.season + k.vertrag.years_total - 1;      // Sommer-Unterschrift: diese Saison zählt mit
        q.dflVertragBis = q.contractUntil;
        DFLKader.capSetzen();
        try { DFLSpiel.eigenSync(); } catch (e) { /* nur im Spiel */ }
        if (typeof saveGameState === 'function') saveGameState();
      }
      return r;
    };
    try { signFreeAgent = window.signFreeAgent; } catch (e) { /* nur im Spiel */ }
  }

  console.log('%c[DFL-Verträge v1] aktiv', 'color:#3fb950;font-weight:bold',
    '— Forderungen wie bei der KI, DFL-Verträge mit Handgeld in Raten, Cap-Prüfung mit vollem Cap Hit, Gehalt-Vorlagen beim Verpflichten (D87)');
})();
