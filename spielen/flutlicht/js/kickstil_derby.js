/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · DERBYS  ·  v1   (Nutzer 2026-10-16: Punkt 9 der Liste „Derbys“)
   ─────────────────────────────────────────────────────────────────────────
   Rivalitäten aus einer festen Liste (Kartei-Kennungen der echten Vereine, angezeigt mit den Spielnamen aus
   KSVereinsnamen). Ein Derby
     · kündigt sich zu Wochenbeginn im Postfach an und steht beim Anpfiff im Ticker,
     · bringt daheim einen Derby-Zuschlag auf die Tageskarten (CFG.zuschlag),
     · hebt nach einem Sieg die Moral der Mannschaft (CFG.moralSieg), eine Niederlage drückt sie (CFG.moralNiederlage),
     · zählt in die Derby-Bilanz je Gegner (CLUB.welt.derbys) und bringt die Karte „Derbyheld“ (kickstil_karten.js).
   API: KSDerby.istDerby(fx) · .name(fx) · .bilanz(gegnerDataId) · .LISTE
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const CFG = { zuschlag: 0.25, moralSieg: 4, moralNiederlage: -3 };
  // [Verein A, Verein B, Name] – Kennungen aus data/game_data.js (EMBEDDED_CLUBS)
  const LISTE = [
    ['dortmund', 'schalke', 'Revierderby'], ['schalke', 'bochum', 'Revierderby'], ['dortmund', 'bochum', 'Revierderby'],
    ['rot_weiss_essen', 'schalke', 'Revierderby'], ['rot_weiss_essen', 'bochum', 'Revierderby'], ['msv_duisburg', 'rot_weiss_essen', 'Revierderby'],
    ['hamburg', 'stpauli', 'Stadtderby'], ['hamburg', 'bremen', 'Nordderby'], ['kiel', 'stpauli', 'Nordderby'], ['kiel', 'hansa_rostock', 'Ostseederby'],
    ['vfb_l_beck', 'ph_nix_l_beck', 'Stadtderby'], ['vfb_l_beck', 'kiel', 'Landesderby'],
    ['koeln', 'gladbach', 'Rheinderby'], ['koeln', 'leverkusen', 'Rheinderby'], ['koeln', 'fortuna_duesseldorf', 'Rheinderby'],
    ['gladbach', 'fortuna_duesseldorf', 'Rheinderby'], ['msv_duisburg', 'fortuna_duesseldorf', 'Rheinderby'],
    ['koeln', 'viktoria_koeln', 'Stadtderby'], ['koeln', 'fortuna_koeln', 'Stadtderby'], ['viktoria_koeln', 'fortuna_koeln', 'Stadtderby'],
    ['alemannia_aachen', 'koeln', 'Rheinlandderby'], ['alemannia_aachen', 'gladbach', 'Rheinlandderby'],
    ['bayern', 'nuernberg', 'Bayernderby'], ['bayern', 'augsburg', 'Bayernderby'], ['nuernberg', 'fuerth', 'Frankenderby'],
    ['fc_ingolstadt', 'jahn_regensburg', 'Donauderby'], ['wuerzburger_kickers', 'fuerth', 'Frankenderby'], ['spvgg_unterhaching', 'bayern', 'Stadtderby'],
    ['stuttgart', 'karlsruhe', 'Landesderby'], ['stuttgart', 'stuttgarter_kickers', 'Stadtderby'], ['karlsruhe', 'waldhof_mannheim', 'Badisches Derby'],
    ['freiburg', 'karlsruhe', 'Badisches Derby'], ['sv_sandhausen', 'waldhof_mannheim', 'Kurpfalzderby'], ['hoffenheim', 'waldhof_mannheim', 'Kurpfalzderby'],
    ['frankfurt', 'darmstadt', 'Hessenderby'], ['frankfurt', 'mainz', 'Rhein-Main-Derby'], ['frankfurt', 'kickers_offenbach', 'Mainderby'],
    ['frankfurt', 'fsv_frankfurt', 'Stadtderby'], ['darmstadt', 'kickers_offenbach', 'Hessenderby'], ['ksv_hessen_kassel', 'kickers_offenbach', 'Hessenderby'],
    ['wehen_wiesbaden', 'mainz', 'Rhein-Main-Derby'],
    ['kaiserslautern', 'fc_saarbruecken', 'Südwestderby'], ['kaiserslautern', 'waldhof_mannheim', 'Südwestderby'], ['kaiserslautern', 'mainz', 'Südwestderby'],
    ['fc_saarbruecken', 'fc_homburg', 'Saarlandderby'], ['elversberg', 'fc_saarbruecken', 'Saarlandderby'], ['elversberg', 'fc_homburg', 'Saarlandderby'],
    ['union', 'hertha', 'Hauptstadtderby'], ['union', 'bfc_dynamo', 'Hauptstadtderby'], ['hertha', 'bfc_dynamo', 'Hauptstadtderby'],
    ['hannover', 'braunschweig', 'Niedersachsenderby'], ['hannover', 'wolfsburg', 'Niedersachsenderby'], ['braunschweig', 'wolfsburg', 'Niedersachsenderby'],
    ['osnabrueck', 'preussen_muenster', 'Westfalenderby'], ['osnabrueck', 'sv_meppen', 'Emslandderby'], ['bielefeld', 'paderborn', 'OWL-Derby'],
    ['bielefeld', 'preussen_muenster', 'Westfalenderby'], ['bielefeld', 'sc_verl', 'OWL-Derby'], ['paderborn', 'sc_verl', 'OWL-Derby'],
    ['sc_verl', 'sc_wiedenbr_ck', 'OWL-Derby'], ['fc_g_tersloh', 'sc_verl', 'OWL-Derby'], ['sportfreunde_lotte', 'osnabrueck', 'Nachbarderby'],
    ['leipzig', '1_fc_lokomotive_leipzig', 'Leipziger Derby'], ['1_fc_lokomotive_leipzig', 'chemie_leipzig', 'Leipziger Derby'],
    ['dresden', 'cottbus', 'Ostderby'], ['dresden', '1_fc_lokomotive_leipzig', 'Sachsenderby'], ['magdeburg', 'hallescher_fc', 'Mitteldeutsches Derby'],
    ['fc_carl_zeiss_jena', 'fc_rot_wei_erfurt', 'Thüringenderby'], ['cottbus', 'sv_babelsberg_03', 'Brandenburgderby'], ['hansa_rostock', 'greifswalder_fc', 'Landesderby'],
    ['heidenheim', 'stuttgart', 'Landesderby'], ['wacker_burghausen', 'spvgg_unterhaching', 'Oberbayernderby']
  ];
  const INDEX = new Map();
  LISTE.forEach(([a, b, n]) => { INDEX.set(a + '|' + b, n); INDEX.set(b + '|' + a, n); });

  const hatSpiel = () => { try { return typeof CLUB !== 'undefined' && CLUB && typeof LEAGUE !== 'undefined' && LEAGUE; } catch (e) { return false; } };
  const dataIdVon = id => String(id || '').replace(/^club_/, '');
  const neuName = n => (window.KSVereinsnamen ? KSVereinsnamen.text(String(n || '')) : String(n || ''));
  function gegnerName(dataId) {
    const c = (window.EMBEDDED_CLUBS || []).find(x => x.id === dataId);
    return neuName(c ? c.name : dataId);
  }
  function nameFuer(gegnerId) {
    if (!hatSpiel() || !CLUB.dataClubId || !gegnerId) return null;
    return INDEX.get(CLUB.dataClubId + '|' + dataIdVon(gegnerId)) || null;
  }
  const name = fx => (fx && fx.type !== 'friendly' && fx.type !== 'euro' ? nameFuer(fx.opponentId) : null);
  const istDerby = fx => !!name(fx);
  function bilanzen() { if (!CLUB.welt) CLUB.welt = {}; if (!CLUB.welt.derbys) CLUB.welt.derbys = {}; return CLUB.welt.derbys; }
  const bilanz = gid => bilanzen()[dataIdVon(gid)] || { s: 0, u: 0, n: 0 };
  const bilanzText = b => `${b.s} Siege, ${b.u} Remis, ${b.n} Niederlagen`;

  // ── Wochenbeginn: Derby ankündigen ─────────────────────────────────────────
  function dieseWoche() {
    const out = [];
    try {
      if (Array.isArray(LEAGUE.matchWeeks) && LEAGUE.matchWeeks[LEAGUE.matchday] === LEAGUE.week) {
        const f = typeof fcmNextFixture === 'function' ? fcmNextFixture(LEAGUE) : null;
        if (f) out.push({ type: 'liga', opponentId: f.opponentId, isHome: f.isHome });
      }
      if (typeof cupDueThisWeek === 'function' && cupDueThisWeek() && typeof fcmCupFixture === 'function' && typeof CUP !== 'undefined' && CUP) {
        const f = fcmCupFixture(CUP);
        if (f) out.push({ type: 'pokal', opponentId: f.opponentId, isHome: f.isHome });
      }
    } catch (e) { /* ohne Ankündigung */ }
    return out;
  }
  if (typeof window.advanceCalendarWeek === 'function') {
    const _w = window.advanceCalendarWeek;
    window.advanceCalendarWeek = function () {
      const r = _w.apply(this, arguments);
      try {
        if (r && hatSpiel()) dieseWoche().forEach(fx => {
          const n = name(fx); if (!n) return;
          const gid = dataIdVon(fx.opponentId), b = bilanz(gid);
          if (typeof addNews === 'function') addNews('match', `🔥 ${n} gegen ${gegnerName(gid)}`,
            `Diese Woche ist Derby – ${fx.isHome ? 'daheim, das Stadion ist ausverkauft' : 'auswärts vor feindlicher Kulisse'}. ` +
            `Ein Sieg hebt die Stimmung im Team, eine Niederlage tut doppelt weh.${b.s + b.u + b.n ? ' Bilanz in deiner Zeit: ' + bilanzText(b) + '.' : ''}`);
        });
      } catch (e) { console.warn('[Kickstil-Derby] Woche', e); }
      return r;
    };
    try { advanceCalendarWeek = window.advanceCalendarWeek; } catch (e) { /* window reicht */ }
  }
  // ── Anpfiff: im Ticker ──────────────────────────────────────────────────────
  if (typeof window.goToFixture === 'function') {
    const _g = window.goToFixture;
    window.goToFixture = function (spec) {
      const r = _g.apply(this, arguments);
      try { const n = name(spec); if (n && typeof addEv === 'function') addEv('info', -1, `🔥 ${n}! Die Fans haben seit Tagen nur dieses Spiel im Kopf.`); } catch (e) { /* ohne Ticker */ }
      return r;
    };
    try { goToFixture = window.goToFixture; } catch (e) { /* window reicht */ }
  }
  // ── Nach dem Spiel: Zuschlag, Moral, Bilanz ────────────────────────────────
  if (typeof window.processFixtureResult === 'function') {
    const _p = window.processFixtureResult;
    window.processFixtureResult = function () {
      let fx = null, heim = false, tageskarten = 0;
      try {
        fx = CURRENT_FIXTURE ? Object.assign({}, CURRENT_FIXTURE) : null; heim = !!FCM_IS_HOME;
        if (fx && name(fx) && heim && typeof matchAttendanceIncome === 'function') tageskarten = matchAttendanceIncome(TEAMS.away.str).dayIncome || 0;
      } catch (e) { fx = null; }
      const tore = (() => { try { return { f: G.homeGoals, g: G.awayGoals }; } catch (e) { return null; } })();
      const r = _p.apply(this, arguments);
      try {
        const n = name(fx);
        if (n && tore) {
          const gid = dataIdVon(fx.opponentId), B = bilanzen(), b = B[gid] = B[gid] || { s: 0, u: 0, n: 0 };
          const erg = tore.f > tore.g ? 's' : tore.f < tore.g ? 'n' : 'u';
          b[erg]++;
          const elf = (typeof getLineupIds === 'function' && typeof getPlayer === 'function') ? getLineupIds().map(getPlayer).filter(Boolean) : [];
          if (erg !== 'u' && typeof window.addMorale === 'function') window.addMorale(typeof SQUAD !== 'undefined' ? SQUAD : elf, erg === 's' ? CFG.moralSieg : CFG.moralNiederlage);
          let geld = 0;
          if (heim && tageskarten > 0) { geld = Math.round(tageskarten * CFG.zuschlag / 1000) * 1000; CLUB.budget = (CLUB.budget || 0) + geld; }
          if (typeof addNews === 'function') addNews('match', erg === 's' ? `🔥 Derbysieg! ${n} gewonnen` : erg === 'n' ? `💔 ${n} verloren` : `🔥 ${n}: Unentschieden`,
            `${tore.f}:${tore.g} gegen ${gegnerName(gid)}. ${erg === 's' ? 'Die Stadt gehört uns – die Mannschaft ist in Feierlaune.' : erg === 'n' ? 'Das tut weh. In der Kabine ist es still.' : 'Keiner hat die Oberhand.'}` +
            `${geld ? ' Derby-Zuschlag auf die Tageskarten: ' + (typeof formatEuro === 'function' ? formatEuro(geld) : geld + ' €') + '.' : ''} Bilanz: ${bilanzText(b)}.`);
        }
      } catch (e) { console.warn('[Kickstil-Derby] Ergebnis', e); }
      return r;
    };
    try { processFixtureResult = window.processFixtureResult; } catch (e) { /* window reicht */ }
  }

  window.KSDerby = { CFG, LISTE, istDerby, name, bilanz, nameFuer };
  console.log('[Kickstil-Derby v1] aktiv — ' + LISTE.length + ' Rivalitäten');
})();
