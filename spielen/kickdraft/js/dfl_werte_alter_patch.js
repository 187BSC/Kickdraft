/* ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
   DFL-WERTE NACH ALTER  ·  v1   (D68, Nutzer 2026-10-10: „Die Detailwerte sollten auch hochgehen, positionsspezifisch und
   altersbedingt: mit Ende 20 sinken die physischen Werte und die mentalen steigen“ – „wie schnell man sinkt, hängt davon ab,
   ob man spielt oder nicht; Verletzungen kommen dazu. Es muss halt Sinn machen.“)
   ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
   1) Form der Detailwerte (player_attributes.js) nach Alter, Position und Seed – für alle Spieler der DFL gleich:
        körperlich (Schnelligkeit, Ausdauer, Kraft, Off. 1 gegen 1, Reflexe) steigt bis Mitte 20, sinkt ab etwa 29,
        technisch bleibt lange stabil, mental (Spielintelligenz, Stellungsspiel, TW 1 gegen 1/Spielaufbau) wächst bis Anfang 30;
        die Kernwerte der Position reifen mit (+2,5 bis 27). Jeder Spieler anders (Seed: Abbau ±2 Jahre, Reife ×0,7…1,3).
        Mittel je Spieler 0 → die Gesamtstärke bleibt der Maßstab (Tabelle, Formel, Markt).
   2) Körperalter p.koerper (DFLSaison.koerperJahr, gespeichert, fehlt solange 0): Stammspieler altern körperlich langsamer,
      Bankspieler und Verletzte schneller – mit dem Alter mehr. Verschiebt die körperliche Kurve, den Abbau der Gesamtstärke
      (Welt: dfl_saisonlauf.js entwicklung; eigener Verein: Beginn der Alterung über traitAlterungsVerschiebung) und das
      Karriereende in der Welt. Eigener Verein: Einsätze von Beginn (p.stats.apps) und verletzte Wochen der Saison.
   3) Vorjahreswerte eigener Spieler (p.werteVorjahr, zum Saisonende) → ▲▼ auf der FUT-Karte im Spieler-Blatt.
   Lädt nach player_attributes.js/attribute_cache_patch.js, dfl_saisonlauf.js und engine_main.js, vor init_bootstrap.js.
   API: DFLWerteAlter.versatz(p, pos, keys) · .vorjahr(p) · .CFG
   ════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const S = window.DFLSaison;
  if (!S || !S.koerperJahr || typeof window.spielerWerte !== 'function' || !window.SpielerAttribute) {
    console.warn('[DFL-Werte-Alter] Bausteine fehlen – Patch inaktiv'); return;
  }
  const A = window.SpielerAttribute;
  const aktiv = () => typeof CLUB !== 'undefined' && CLUB && CLUB.dfl && CLUB.dfl.aktiv;

  const CFG = {
    // Stützstellen (Alter, Punkte) je Gruppe vor dem Ausgleich auf das Gesamtniveau (Vorschau D68, 2026-10-10)
    kurve: { k: [[17, 1], [21, 3], [25, 4], [27, 3], [29, 0], [31, -4], [33, -8], [35, -12], [37, -15]],
      t: [[17, -2], [21, 0], [25, 1], [29, 1], [31, 0], [33, -1], [35, -2], [37, -3]],
      m: [[17, -6], [21, -4], [25, -1], [28, 1], [31, 4], [33, 6], [35, 7], [37, 7]] },
    kern: 2.5,                 // Kernwerte der Position: + kern × Reife (18 → 0, ab 27 voll)
    frueh: 2,                  // körperlicher Abbau je Spieler bis zu ±2 Jahre früher/später (Seed)
    reife: [0.7, 1.3],         // mentale Reife je Spieler (Seed)
    ligaSpiele: 26,            // Anteil Stammspieler = Einsätze von Beginn ÷ Ligaspiele
    aus: false                 // nur für Messungen: Form der Detailwerte abschalten (Körperalter läuft weiter)
  };
  const KAT = { schnelligkeit: 'k', ausdauer: 'k', kraft: 'k', offEinsGegenEins: 'k', reflexe: 'k',
    passen: 't', dribbling: 't', flanken: 't', schiessen: 't', tackling: 't', kopfball: 't', defEinsGegenEins: 't', paraden: 't', abwurf: 't',
    spielintelligenz: 'm', defStellung: 'm', offStellung: 'm', einsGegenEins: 'm', spielaufbau: 'm' };
  const TW = ['einsGegenEins', 'spielaufbau', 'abwurf', 'reflexe', 'paraden'];
  const KERN = { TW, IV: ['tackling', 'kopfball', 'defStellung', 'kraft'], AV: ['schnelligkeit', 'defEinsGegenEins', 'flanken', 'ausdauer'],
    ZDM: ['tackling', 'defStellung', 'passen', 'spielintelligenz'], ZM: ['passen', 'spielintelligenz', 'ausdauer', 'dribbling'],
    ZOM: ['passen', 'dribbling', 'spielintelligenz', 'schiessen'], FL: ['schnelligkeit', 'dribbling', 'flanken', 'offEinsGegenEins'],
    ST: ['schiessen', 'offStellung', 'kopfball', 'offEinsGegenEins'] };
  KERN.OM = KERN.AM = KERN.ZOM;
  // D95: Positionen mit Seite – LV/RV wie AV, LF/RF wie FL, LM/RM: Flanken, Ausdauer, Tempo, Passen
  KERN.LV = KERN.RV = KERN.AV; KERN.LF = KERN.RF = KERN.FL;
  KERN.LM = KERN.RM = ['flanken', 'ausdauer', 'schnelligkeit', 'passen'];

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const auf = (st, a) => {
    if (a <= st[0][0]) return st[0][1];
    for (let i = 1; i < st.length; i++) if (a <= st[i][0]) { const [a0, y0] = st[i - 1], [a1, y1] = st[i]; return y0 + (y1 - y0) * (a - a0) / (a1 - a0); }
    return st[st.length - 1][1];
  };
  // fester Zufall je Spieler: Welt-Seed (Bruchteil) bzw. ganzzahliger Spiel-Seed
  function zufall(p) {
    const s0 = p.dflSeed != null ? p.dflSeed : p.seed != null ? (p.seed % 1000003) / 1000003 : 0.5;
    let s = (Math.floor(Number(s0) * 2654435761) >>> 0) || 1;
    return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  }
  // Abweichung je Wert (Mittel 0) für einen Spieler im Alter p.age mit Körperalter p.koerper
  function versatz(p, pos, keys) {
    const alter = Number(p.age);
    if (!isFinite(alter) || !keys.length) return null;
    const r = zufall(p), frueh = (r() - 0.5) * 2 * CFG.frueh, rf = CFG.reife[0] + (CFG.reife[1] - CFG.reife[0]) * r();
    const reife = clamp((alter - 18) / 9, 0, 1), kern = KERN[pos] || [];
    const alterK = alter + frueh + (Number(p.koerper) || 0);
    const roh = {};
    let summe = 0;
    keys.forEach(k => {
      const kat = KAT[k] || 't';
      let x = auf(CFG.kurve[kat], kat === 'k' ? alterK : alter);
      if (kat === 'm') x *= rf;
      if (kern.indexOf(k) >= 0) x += CFG.kern * reife;
      roh[k] = x; summe += x;
    });
    const mittel = summe / keys.length;
    keys.forEach(k => { roh[k] -= mittel; });
    return roh;
  }
  const versteckt = (o, k, v) => { try { Object.defineProperty(o, k, { value: v, enumerable: false, writable: true, configurable: true }); } catch (e) { o[k] = v; } return v; };

  // ── 1) Detailwerte formen (außen um den Werte-Cache) ─────────────────────────────────────────────────────────
  {
    const _orig = window.spielerWerte;
    window.spielerWerte = function (p) {
      const w = _orig.apply(this, arguments);
      if (!w || !p || typeof p !== 'object' || p.age == null || !aktiv()) return w;
      if (CFG.aus) {
        if (w._basis && w._d68) { Object.keys(w._basis).forEach(k => { w[k] = w._basis[k]; }); versteckt(w, '_d68', null); }
        return w;
      }
      try {
        const sig = p.age + '|' + (p.koerper || 0);
        if (w._d68 === sig) return w;
        const keys = Object.keys(w).filter(k => k[0] !== '_' && typeof w[k] === 'number');
        if (!w._basis) versteckt(w, '_basis', keys.reduce((o, k) => { o[k] = w[k]; return o; }, {}));
        const v = versatz(p, A.hauptPos(p), keys);
        if (v) keys.forEach(k => { w[k] = clamp(Math.round(w._basis[k] + v[k]), 20, 99); });
        versteckt(w, '_d68', sig);
      } catch (e) { console.warn('[DFL-Werte-Alter] Werte', e); }
      return w;
    };
  }

  // ── 2) Körperalter des eigenen Vereins ───────────────────────────────────────────────────────────────────────
  // verletzte Wochen der Saison zählen (Wochentakt: advanceCalendarWeek)
  {
    const _orig = window.advanceCalendarWeek;
    if (typeof _orig === 'function') {
      window.advanceCalendarWeek = function () {
        try {
          if (aktiv() && typeof SQUAD !== 'undefined') SQUAD.forEach(p => { if (p && p.injuryWeeks > 0) p.verletztWochen = (p.verletztWochen || 0) + 1; });
        } catch (e) { console.warn('[DFL-Werte-Alter] Woche', e); }
        return _orig.apply(this, arguments);
      };
      try { advanceCalendarWeek = window.advanceCalendarWeek; } catch (e) { /* window reicht */ }
    }
  }
  // Saisonende: Vorjahreswerte merken, Körperalter verbuchen – VOR Alterung und Entwicklung (applyEndOfSeasonClubEffects
  // setzt p.stats zurück und fragt ALTERUNG_AB ab)
  function saisonEnde() {
    const saison = typeof LEAGUE !== 'undefined' && LEAGUE ? LEAGUE.season : null;
    SQUAD.forEach(p => {
      if (!p) return;
      try {
        const w = window.spielerWerte(p);
        if (w) { const tw = !!w._torwart; p.werteVorjahr = { s: saison, tw: tw ? 1 : 0, w: A.keys(tw).map(k => w[k]) }; }
      } catch (e) { /* ohne Vorjahr */ }
      const apps = (p.stats && p.stats.apps) || 0, wochen = p.verletztWochen || 0;
      S.koerperJahr(p, p.age, p.perspektiv ? null : Math.min(1, apps / CFG.ligaSpiele), wochen, wochen >= 12);
      delete p.verletztWochen;
    });
  }
  {
    const _orig = window.applyEndOfSeasonClubEffects;
    if (typeof _orig === 'function') {
      window.applyEndOfSeasonClubEffects = function () {
        if (aktiv() && typeof SQUAD !== 'undefined') { try { saisonEnde(); } catch (e) { console.warn('[DFL-Werte-Alter] Saisonende', e); } }
        return _orig.apply(this, arguments);
      };
      try { applyEndOfSeasonClubEffects = window.applyEndOfSeasonClubEffects; } catch (e) { /* window reicht */ }
    }
  }
  // Alterung des eigenen Vereins (engine_main.js ALTERUNG_AB = Position + traitAlterungsVerschiebung): Körperalter +1 → ein
  // Jahr früher
  {
    const _orig = window.traitAlterungsVerschiebung;
    window.traitAlterungsVerschiebung = function (p) {
      const v = typeof _orig === 'function' ? _orig.apply(this, arguments) : 0;
      return aktiv() && p && p.koerper ? v - p.koerper : v;
    };
  }

  // ── 3) Vorjahr für ▲▼ ────────────────────────────────────────────────────────────────────────────────────────
  function vorjahr(p) {
    const v = p && p.werteVorjahr;
    if (!v || !Array.isArray(v.w)) return null;
    const keys = A.keys(!!v.tw);
    if (keys.length !== v.w.length) return null;
    const o = { _torwart: !!v.tw };
    keys.forEach((k, i) => { o[k] = v.w[i]; });
    return o;
  }

  window.DFLWerteAlter = { versatz, vorjahr, CFG };
  console.log('%c[DFL-Werte-Alter v1] aktiv', 'color:#3fb950;font-weight:bold',
    '— Detailwerte nach Alter/Position (körperlich ab 29 runter, mental hoch), Körperalter nach Spielzeit und Verletzungen (D68)');
})();
