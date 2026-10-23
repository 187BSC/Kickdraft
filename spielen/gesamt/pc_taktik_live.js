/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · TAKTIK IM LIVE-SPIEL AM PC  ·  v1   (2026-10-20)
   Nutzer: „können wir noch mehr coaching machen? kann man das im Spiel mehr anweisen so wie bei FM?“ – per Rückfrage:
   Mannschaftsanweisungen, Zurufe wie im FM, Formation im Spiel ändern; Taktikbrett bei Pause; Gegner-Trainer reagiert einfach.
   ─────────────────────────────────────────────────────────────────────────
   NUR PC (hängt an kickstil_pc_spieltag.js, das nur mit window.FcmPc bzw. pcs-test läuft). Beide Spiele (in Kickdraft als
   gesamt/pc_taktik_live.js). Wirkt ausschließlich über die Engine-Anweisungen S.anw (match_engine_v3.js, ANW0) und
   formationSetzen – also ehrlich in der Simulation, nicht als Ergebnis-Faktor.
   · Taktikbrett (Pause, Halbzeit oder Taste T): links das Feld mit Formation (umstellbar), rechts die Mannschaftsanweisungen.
     Anweisungen gelten sofort (ab dem nächsten Abschnitt der Engine) und bleiben für die nächsten Spiele (CLUB.pcAnw).
   · Zurufe in der Leiste (wie FM): Anfeuern, Loben, Mehr fordern, Konzentrieren, Beruhigen, Anschreien – je 10 Minuten,
     Erfolg nach Spielstand und Menschenführung. Zur Halbzeit eine Kabinenansprache (wirkt 15 Minuten).
   · Gegner-Trainer: stellt nach Spielstand und Minute um (Risiko bei Rückstand, Verwalten bei Führung, lange Bälle gegen eine
     hohe Linie) – mit Zeile im Ticker. Eigene Umstellungen stehen ebenfalls im Ticker.
   · Preis: Pressing, Tempo und hohe Linie kosten Kraft im Spiel UND Fitness danach (je 10 % Mehrbelastung 5 Punkte).
   Gemessen (tools/engine_zaehlbogen-Elf, 50 Spiele): siehe gesamt_app/pc_spezifisch.md.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const W = window;
  const CFG = { zurufDauer: 600, zurufPause: 300, kabineDauer: 900, fitnessJe10: 5, fitnessMax: 15, stimmeChance: 0.35, moral: 5, moralStark: 8 };
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const E3 = () => W.MatchEngineV3;
  const P = () => W.KSPcSpieltag;
  const tief = r => { let x = r, n = 0; while (x && x._ref && n++ < 6) x = x._ref; return x || r; };
  const kurzN = r => { const x = tief(r) || {}; return (x.firstName ? x.firstName.charAt(0) + '. ' : '') + (x.name || ''); };
  const minVon = sek => Math.min(90, Math.floor(sek / 60) + 1) + "'";
  const fuehrung = () => { try { const T = CLUB.ksTrainer; return T && T.werte && typeof T.werte.fuehrung === 'number' ? T.werte.fuehrung : 8; } catch (e) { return 8; } };

  // ── Mannschaftsanweisungen: Stufe → Werte für S.anw (ANW0 in match_engine_v3.js) ──
  // Werte aus der Messung 2026-10-20 (50 Spiele je Hebel): spürbar, aber keine Stufe ist „immer besser“ – wer hoch presst
  // und Tempo macht, zahlt mit Kraft und Fitness.
  const ANW = [
    { k: 'linie', name: 'Pressing-Höhe', stufen: [['tief', 'Tief', { linie: -3, kraft: 0.96 }], ['normal', 'Normal', {}], ['hoch', 'Hoch', { linie: 3, kraft: 1.06 }]],
      tipp: 'Wo der Block ohne Ball steht. Hoch erobert Bälle weiter vorn, lockt aber Steilpässe hinter die Kette.' },
    { k: 'press', name: 'Pressing', stufen: [['wenig', 'Abwartend', { press: 0.8, kraft: 0.95 }], ['normal', 'Normal', {}], ['viel', 'Aggressiv', { press: 1.25, kraft: 1.1 }]],
      tipp: 'Wie früh und wie viele anlaufen. Aggressiv zehrt an der Fitness.' },
    { k: 'tempo', name: 'Tempo', stufen: [['ruhig', 'Ruhig', { tempo: 0.88, kraft: 0.97 }], ['normal', 'Normal', {}], ['hoch', 'Hoch', { tempo: 1.12, kraft: 1.05, fehler: 1.03 }]],
      tipp: 'Wie schnell der Ball läuft. Hoch bringt mehr Angriffe und mehr Fehlpässe.' },
    { k: 'pass', name: 'Passspiel', stufen: [['kurz', 'Kurz', { risiko: -0.06, fehler: 0.98 }], ['normal', 'Gemischt', {}], ['direkt', 'Direkt', { risiko: 0.06, fehler: 1.02 }], ['lang', 'Lange Bälle', { lang: 1, risiko: 0.03, fehler: 1.03 }]],
      tipp: 'Kurz hält den Ball sicher, direkt sucht schneller den Weg nach vorn.' },
    { k: 'fluegel', name: 'Angriff über', stufen: [['mitte', 'Mitte', { fluegel: -1 }], ['normal', 'Gemischt', {}], ['fluegel', 'Flügel', { fluegel: 1 }]],
      tipp: 'Flügel heißt: außen bleiben und flanken. Mitte: nach innen ziehen.' },
    { k: 'breite', name: 'Breite', stufen: [['eng', 'Eng', { breite: 0.88 }], ['normal', 'Normal', {}], ['breit', 'Breit', { breite: 1.12 }]],
      tipp: 'Wie weit sich die Elf mit Ball auseinanderzieht.' },
    { k: 'schuss', name: 'Abschluss', stufen: [['geduldig', 'Geduldig', { schuss: 0.85 }], ['normal', 'Normal', {}], ['oft', 'Öfter schießen', { schuss: 1.25 }]],
      tipp: 'Öfter schießen bringt mehr Abschlüsse – auch mehr schlechte.' },
    { k: 'haerte', name: 'Zweikämpfe', stufen: [['fair', 'Fair', { haerte: 0.75 }], ['normal', 'Normal', {}], ['hart', 'Hart', { haerte: 1.3 }]],
      tipp: 'Hart gewinnt etwas mehr Zweikämpfe und bringt mehr Fouls und Karten.' },
    { k: 'zeit', name: 'Zeit schinden', stufen: [['aus', 'Nein', {}], ['an', 'Ja', { zeit: 6, tempo: 0.88 }]],
      tipp: 'Bei eigenen Standards und Einwürfen Zeit von der Uhr nehmen.' }
  ];
  const STANDARD = () => { const o = {}; ANW.forEach(a => { o[a.k] = a.stufen.find(s => s[0] === 'normal') ? 'normal' : a.stufen[0][0]; }); return o; };
  // Ausrichtung aus der Leiste (kickstil_pc_spieltag.js, 0 = Mauern … 4 = Brechstange) wirkt jetzt auch ohne Ball über die Linie
  const AUSR_ANW = [{ linie: -3, risiko: -0.04 }, { linie: -1.5, risiko: -0.02 }, {}, { linie: 1.5, risiko: 0.02 }, { linie: 3, risiko: 0.04 }];
  const ADD = { linie: 1, risiko: 1, lang: 1, fluegel: 1, zeit: 1 };
  // Vollständiger neutraler Satz wie ANW0 der Engine (S.anw ersetzt ihn ganz)
  const NEUTRAL = { linie: 0, press: 1, tempo: 1, breite: 1, risiko: 0, lang: 0, fluegel: 0, schuss: 1, haerte: 1, zeit: 0, lauf: 1, fehler: 1, zweikampf: 1, kraft: 1 };
  function mischen(ziel, teil) {
    Object.keys(teil || {}).forEach(k => { ziel[k] = ADD[k] ? (ziel[k] || 0) + teil[k] : (ziel[k] == null ? 1 : ziel[k]) * teil[k]; });
    return ziel;
  }
  function anwAus(wahl, ausr) {
    const o = {};
    ANW.forEach(a => { const st = a.stufen.find(s => s[0] === (wahl || {})[a.k]); if (st) mischen(o, st[2]); });
    if (ausr != null && AUSR_ANW[ausr]) mischen(o, AUSR_ANW[ausr]);
    // Ausrichtung + Pressing-Höhe zusammen höchstens ±4 m (gemessen: ±6 m kippt jedes Spiel)
    if (o.linie) o.linie = Math.max(-4, Math.min(4, o.linie));
    return o;
  }

  // ── Zurufe und Kabinenansprache ─────────────────────────────────────────────
  // k = { rueck, fuehrt } aus Sicht der eigenen Elf
  const ZURUFE = {
    anfeuern: { name: 'Anfeuern', tipp: 'Sicher: etwas mehr Einsatz.', gut: { lauf: 1.02, zweikampf: 1.03 }, chance: () => 1,
      ok: 'Die Mannschaft wird angefeuert – die Köpfe gehen hoch.' },
    loben: { name: 'Loben', tipp: 'Wirkt, wenn es läuft – bei Rückstand verpufft es.', gut: { lauf: 1.02, fehler: 0.97 }, schlecht: { lauf: 0.98 },
      chance: k => k.fuehrt ? 0.85 : k.rueck ? 0.3 : 0.6, ok: 'Das Lob kommt an – die Mannschaft spielt befreit.', nein: 'Das Lob passt nicht zur Lage – die Spieler lassen nach.' },
    fordern: { name: 'Mehr fordern', tipp: 'Bei Rückstand oder schwacher Leistung.', gut: { lauf: 1.04, zweikampf: 1.05 }, schlecht: { fehler: 1.04 },
      chance: k => k.rueck ? 0.7 : k.fuehrt ? 0.35 : 0.55, ok: 'Die Spieler legen eine Schippe drauf.', nein: 'Zu viel Druck – die Spieler verkrampfen.' },
    konzentrieren: { name: 'Konzentrieren', tipp: 'Weniger Fehler – nach einem Gegentor oder in der Schlussphase.', gut: { fehler: 0.95 }, chance: () => 0.9,
      ok: 'Die Mannschaft ist hellwach.', nein: 'Die Ansage geht im Lärm unter.' },
    beruhigen: { name: 'Beruhigen', tipp: 'Weniger Fouls und Hektik – gut mit Gelb-Belastung.', gut: { haerte: 0.8, fehler: 0.97 }, chance: () => 0.9,
      ok: 'Die Spieler kommen runter.', nein: 'Die Hektik bleibt.' },
    anschreien: { name: 'Anschreien', tipp: 'Großer Schub – oder Unruhe.', gut: { lauf: 1.05, zweikampf: 1.08, haerte: 1.15 }, schlecht: { fehler: 1.05, lauf: 0.98 },
      chance: k => 0.5 + (k.rueck ? 0.2 : 0), ok: 'Die Ansage sitzt – jetzt brennt die Mannschaft.', nein: 'Das kommt schlecht an – die Spieler wirken verunsichert.' }
  };
  // Eindruck des Trainers während ein Zuruf wirkt (Nutzer 2026-10-22: statt „wirkt bis etwa 61'“ – „die Spieler wirkten motivierter,
  // konzentrierter oder irritiert“). Je Zuruf zwei, drei Fassungen, damit es nicht immer gleich klingt.
  const EINDRUCK = {
    anfeuern: { gut: ['Die Spieler wirken motivierter.', 'Mehr Tempo in den Zweikämpfen.', 'Die Köpfe sind oben.'] },
    loben: { gut: ['Die Spieler wirken gelöst.', 'Die Pässe kommen mit mehr Selbstvertrauen.'], nein: ['Die Spieler wirken nachlässig.', 'Etwas Spannung ist raus.'] },
    fordern: { gut: ['Die Spieler wirken bissiger.', 'Jeder geht jetzt einen Meter mehr.'], nein: ['Die Spieler wirken verkrampft.', 'Die Pässe werden hektisch.'] },
    konzentrieren: { gut: ['Die Spieler wirken konzentrierter.', 'Die Abstände stimmen wieder.'], nein: ['Die Spieler wirken unruhig.', 'Die Ansage ist nicht angekommen.'] },
    beruhigen: { gut: ['Die Spieler wirken ruhiger.', 'Weniger Hektik im Zweikampf.'], nein: ['Die Spieler wirken weiter hektisch.', 'Die Gemüter bleiben erhitzt.'] },
    anschreien: { gut: ['Die Spieler wirken wachgerüttelt.', 'Jetzt brennt die Mannschaft.'], nein: ['Die Spieler wirken irritiert.', 'Einige lassen die Köpfe hängen.'] }
  };
  const eindruckVon = (art, gut) => { const e = EINDRUCK[art] || {}, l = (gut ? e.gut : e.nein) || e.gut || ['']; return l[Math.floor(Math.random() * l.length)]; };
  const KABINE = {
    ruhig: { name: 'Ruhig bleiben', gut: { fehler: 0.97 }, chance: () => 0.95, ok: 'Ruhige Worte in der Kabine.', nein: 'Die Ruhe wirkt wie Gleichgültigkeit.' },
    loben: { name: 'Loben', gut: { lauf: 1.03, fehler: 0.97 }, schlecht: { lauf: 0.97 }, chance: k => k.fuehrt ? 0.85 : k.rueck ? 0.3 : 0.6,
      ok: 'Das Lob gibt Selbstvertrauen.', nein: 'Das Lob nimmt die Spannung raus.' },
    fordern: { name: 'Mehr fordern', gut: { lauf: 1.05, zweikampf: 1.05 }, schlecht: { fehler: 1.04 }, chance: k => k.rueck ? 0.75 : k.fuehrt ? 0.35 : 0.55,
      ok: 'Die Mannschaft kommt entschlossen aus der Kabine.', nein: 'Die Spieler fühlen sich unter Druck gesetzt.' },
    enttaeuscht: { name: 'Enttäuscht zeigen', gut: { lauf: 1.06, zweikampf: 1.08 }, schlecht: { fehler: 1.06, lauf: 0.97 }, chance: k => k.rueck ? 0.55 : 0.3,
      ok: 'Die Spieler wollen es dir beweisen.', nein: 'Die Kritik trifft – die Köpfe hängen.' }
  };
  const chanceMit = (z, k) => { const c = z.chance(k); return c >= 1 ? 1 : Math.max(0.2, Math.min(0.92, c + (fuehrung() - 8) * 0.015)); };

  // ── Stand aus Sicht der eigenen Elf (Engine-Team 0) ─────────────────────────
  function stand(S, bis) {
    const t = [0, 0];
    (S.ev || []).forEach(e => { if (e.type === 'goal' && (bis == null || e.t <= bis)) t[e.side === 'home' ? 0 : 1]++; });
    return t;
  }
  function lage(LIVE) {
    // Was der Ticker gerade zeigt (die Engine ist ein paar Minuten voraus)
    let t = null;
    try { const ui = P().tsUi(), s = ui && ui.st[ui.i - 1]; t = s && s.mi != null ? (s.mi + 1) * 60 : null; } catch (e) { t = null; }
    const st = stand(LIVE.S, t);
    return { rueck: st[0] < st[1], fuehrt: st[0] > st[1], st };
  }

  // ── Zustand je Spiel (LIVE.tk) ──────────────────────────────────────────────
  function gespeichert() {
    const o = STANDARD();
    try { const c = CLUB.pcAnw; if (c) ANW.forEach(a => { if (a.k !== 'zeit' && a.stufen.some(s => s[0] === c[a.k])) o[a.k] = c[a.k]; }); } catch (e) { /* Standard */ }
    return o;
  }
  function startAnw(ausr) { return [anwAus(gespeichert(), ausr), null]; }
  function start(LIVE) {
    const form = (typeof CLUB !== 'undefined' && CLUB && CLUB.formation) || '';
    LIVE.tk = { wahl: gespeichert(), angesagt: null, zuruf: null, zurufFrei: 0, kabine: null, kabineGenutzt: false, brett: false, vorschau: null,
      form, formAngesagt: form, gegner: null, kraftSum: 0, kraftZeit: 0, uhr: LIVE.S.clock || 0, laeuftVorher: true };
    LIVE.tk.angesagt = Object.assign({}, LIVE.tk.wahl);
    anwRechnen(LIVE);
  }
  function wirkungJetzt(LIVE) {
    const tk = LIVE.tk, S = LIVE.S, o = {};
    if (tk.zuruf && S.clock < tk.zuruf.bis) mischen(o, tk.zuruf.wirkung);
    if (tk.kabine && S.clock < tk.kabine.bis) mischen(o, tk.kabine.wirkung);
    return o;
  }
  function anwRechnen(LIVE) {
    if (!LIVE || !LIVE.tk || !LIVE.S) return;
    const S = LIVE.S, a = mischen(anwAus(LIVE.tk.wahl, LIVE.ausr), wirkungJetzt(LIVE));
    if (!S.anw) S.anw = [null, null];
    S.anw[0] = Object.assign({}, NEUTRAL, a);
    if (LIVE.tk.gegner) S.anw[1] = Object.assign({}, NEUTRAL, LIVE.tk.gegner.anw);
  }
  // Ticker-Zeile (kickstil-Ticker: Ereignis „taktik“, dfl_textspiel.js)
  function tickerZeile(LIVE, team, text) {
    LIVE.S.ev.push({ t: LIVE.S.clock + 0.05, type: 'taktik', side: team === 0 ? 'home' : 'away', text });
  }
  function aenderungenAnsagen(LIVE) {
    const tk = LIVE.tk, teile = [];
    if (tk.form !== tk.formAngesagt) { teile.push('jetzt im ' + tk.form); tk.formAngesagt = tk.form; }
    ANW.forEach(a => {
      if (tk.wahl[a.k] === tk.angesagt[a.k]) return;
      const st = a.stufen.find(s => s[0] === tk.wahl[a.k]);
      teile.push(a.k === 'zeit' ? (tk.wahl.zeit === 'an' ? 'Zeit schinden' : 'kein Zeitspiel mehr') : `${a.name}: ${st ? st[1] : ''}`);
    });
    tk.angesagt = Object.assign({}, tk.wahl);
    if (teile.length) tickerZeile(LIVE, 0, teile.join(' · '));
  }

  // ── Gegner-Trainer (einfach): nach Spielstand und Minute ────────────────────
  const GEGNER = {
    risiko: { anw: { linie: 2, tempo: 1.1, risiko: 0.04, schuss: 1.15, kraft: 1.08 }, text: 'mehr Risiko, die Kette rückt auf' },
    brechstange: { anw: { linie: 3, lang: 1, risiko: 0.06, schuss: 1.25, kraft: 1.12 }, text: 'Brechstange, lange Bälle nach vorn' },
    verwalten: { anw: { linie: -2, tempo: 0.88, zeit: 5, kraft: 0.96 }, text: 'Ergebnis verwalten, Zeit von der Uhr nehmen' },
    konter: { anw: { lang: 1, risiko: 0.03 }, text: 'lange Bälle hinter die hohe Kette' }
  };
  function gegnerPlanen(LIVE) {
    const S = LIVE.S, min = S.clock / 60, st = stand(S), d = st[1] - st[0];   // aus Sicht des Gegners
    let plan = null;
    if (d < 0 && min >= 80) plan = 'brechstange';
    else if (d < 0 && min >= 60) plan = 'risiko';
    else if (d > 0 && min >= 70) plan = 'verwalten';
    else if (min >= 30 && S.anw && S.anw[0] && S.anw[0].linie >= 3) plan = 'konter';
    const alt = LIVE.tk.gegner && LIVE.tk.gegner.art;
    if (plan === alt) return;
    LIVE.tk.gegner = plan ? { art: plan, anw: GEGNER[plan].anw } : null;
    if (!plan && S.anw) S.anw[1] = null;
    if (plan) tickerZeile(LIVE, 1, GEGNER[plan].text);
  }

  // ── Haken aus kickstil_pc_spieltag.js ───────────────────────────────────────
  function eingriffe(LIVE) {
    const tk = LIVE.tk; if (!tk) return;
    const S = LIVE.S;
    // Kraft über die Zeit mitschreiben (Anweisungen × Ausrichtung) – für die Fitness nach dem Spiel
    const dt = Math.max(0, S.clock - tk.uhr);
    const ausK = (P() && P().AUSRICHTUNG && P().AUSRICHTUNG[LIVE.ausr]) ? P().AUSRICHTUNG[LIVE.ausr].kond : 1;
    tk.kraftSum += dt * ((S.anw && S.anw[0] && S.anw[0].kraft) || 1) * ausK; tk.kraftZeit += dt; tk.uhr = S.clock;
    if (tk.zuruf && S.clock >= tk.zuruf.bis) tk.zuruf = null;
    if (tk.kabine && S.clock >= tk.kabine.bis) tk.kabine = null;
    aenderungenAnsagen(LIVE);
    gegnerPlanen(LIVE);
    anwRechnen(LIVE);
  }
  function vorBuchen(LIVE) {
    const tk = LIVE && LIVE.tk; if (!tk) return null;
    eingriffe(LIVE);
    const schnitt = tk.kraftZeit > 0 ? tk.kraftSum / tk.kraftZeit : 1;
    const spieler = new Set();
    (LIVE.S.alle || LIVE.S.players || []).forEach(p => { if (p.team === 0) spieler.add(tief(p._ref)); });
    (LIVE.wechsel || []).forEach(w => spieler.add(w.raus));
    // Anweisungen fürs nächste Spiel merken (ohne Zeitspiel)
    try { const m = Object.assign({}, tk.wahl); delete m.zeit; CLUB.pcAnw = m; } catch (e) { /* ohne */ }
    return { schnitt, spieler: [...spieler].filter(Boolean), stimmen: tk.stimmen || [] };
  }
  function nachBuchen(n) {
    const extra = Math.max(-5, Math.min(CFG.fitnessMax, Math.round((n.schnitt - 1) * 10 * CFG.fitnessJe10)));
    if (extra) n.spieler.forEach(p => { if (typeof p.fitness === 'number') p.fitness = Math.max(30, Math.min(100, p.fitness - extra)); });
    const st = stimmeWaehlen(n.stimmen);
    if (st) stimmeOffen = st;
    if (extra || st) { try { if (typeof saveGameState === 'function') saveGameState(); } catch (e) { /* ohne */ } }
  }

  // ── Zurufe ──────────────────────────────────────────────────────────────────
  function zurufen(LIVE, art) {
    const tk = LIVE && LIVE.tk, z = ZURUFE[art];
    if (!tk || !z || LIVE.fertig || tk.zuruf || LIVE.S.clock < tk.zurufFrei) return;
    const gut = Math.random() < mitCharakter(LIVE, art, chanceMit(z, lage(LIVE)));
    tk.zuruf = { art, gut, wirkung: gut ? z.gut : (z.schlecht || {}), bis: LIVE.S.clock + CFG.zurufDauer, eindruck: eindruckVon(art, gut) };
    reagieren(LIVE, art, gut);
    tk.zurufFrei = tk.zuruf.bis + CFG.zurufPause;
    anwRechnen(LIVE);
    hinweis(`<i class="ti ti-speakerphone" aria-hidden="true"></i><span><b>${esc(z.name)}:</b> ${esc(gut ? z.ok : z.nein)}</span>`);
  }
  function kabine(LIVE, art) {
    const tk = LIVE && LIVE.tk, z = KABINE[art];
    if (!tk || !z || tk.kabineGenutzt || !LIVE.hz) return;
    const gut = Math.random() < mitCharakter(LIVE, 'k_' + art, chanceMit(z, lage(LIVE)));
    tk.kabine = { art, gut, wirkung: gut ? z.gut : (z.schlecht || {}), bis: LIVE.S.clock + CFG.kabineDauer };
    reagieren(LIVE, 'k_' + art, gut);
    tk.kabineGenutzt = true;
    anwRechnen(LIVE);
    hinweis(`<i class="ti ti-door" aria-hidden="true"></i><span><b>Kabine – ${esc(z.name)}:</b> ${esc(gut ? z.ok : z.nein)}</span>`);
  }
  const hinweis = html => { try { const ui = P().tsUi(); if (ui) ui.hinweis(html); } catch (e) { /* ohne */ } };

  // ── Reaktionen auf Zurufe (Nutzer 2026-10-20: „kleine Reaktionen von Spielern und Teams … nach dem Spiel eine Einblendung von einem
  //    Spieler, der danke sagt oder meint, dass die Zurufe ihn verunsichern – wirkt auf die Moral“; per Rückfrage: Ticker + Sprechblase,
  //    nach Charakter, Karte „Stimmen aus der Kabine“, Moral ±5 / Anschreien und Enttäuscht zeigen ±8) ──────────────────────────────
  const hat = (p, k) => { try { return typeof W.hatTrait === 'function' && W.hatTrait(p, k); } catch (e) { return false; } };
  const kapitaen = p => { try { return typeof isCaptain === 'function' && isCaptain(p); } catch (e) { return false; } };
  const HART = { anschreien: 1, fordern: 1, k_fordern: 1, k_enttaeuscht: 1 };
  const STARK = { anschreien: 1, k_enttaeuscht: 1 };
  const FUEHRT = ['fuehrungsspieler', 'mentalitaet', 'nervenstark'], SENSIBEL = ['diva', 'launisch', 'hitzkopf'];
  const jung = p => (p.age || 25) < 21;
  function feld(LIVE) { return (LIVE.S.teams[0] || []).map(p => tief(p._ref)).filter(p => p && p.name); }
  // Führungsspieler & Co. ziehen mit (+4 % je Spieler, höchstens 3), Diva, Launisch, Hitzkopf stören (−3 %), junge Spieler unter 21
  // vertragen harte Ansagen schlechter (−2 %). Anfeuern klappt immer.
  function mitCharakter(LIVE, art, c) {
    if (c >= 1) return 1;
    const f = feld(LIVE), n = fn => Math.min(3, f.filter(fn).length);
    let d = n(p => FUEHRT.some(k => hat(p, k))) * 0.04 - n(p => SENSIBEL.some(k => hat(p, k))) * 0.03;
    if (HART[art]) d -= n(jung) * 0.02;
    return Math.max(0.15, Math.min(0.95, c + d));
  }
  function reaktor(LIVE, art, gut) {
    const alle = feld(LIVE), f = alle.filter(p => p.pos !== 'TW');
    const zufall = a => a[Math.floor(Math.random() * a.length)];
    const fuehrer = f.filter(p => kapitaen(p) || FUEHRT.some(k => hat(p, k)));
    const sensibel = f.filter(p => SENSIBEL.some(k => hat(p, k)) || (HART[art] && jung(p)));
    if (gut && fuehrer.length && Math.random() < 0.75) return { p: zufall(fuehrer), typ: 'fuehrer' };
    if (!gut && sensibel.length && Math.random() < 0.75) return { p: zufall(sensibel), typ: 'sensibel' };
    return f.length ? { p: zufall(f), typ: 'normal' } : null;
  }
  const RX = {
    anfeuern: { gut: ['{N} klatscht in die Hände und treibt die Kollegen an.', '{N} reckt die Faust Richtung Bank.'], bg: 'Auf geht\'s!' },
    loben: { gut: ['{N} hebt den Daumen Richtung Bank.'], bg: 'Danke, Coach!', schlecht: ['{N} zuckt nur mit den Schultern.'], bs: 'Wofür?' },
    fordern: { gut: ['{N} nickt und gibt die Ansage lautstark weiter.'], bg: 'Verstanden!', schlecht: ['{N} schüttelt den Kopf und gestikuliert Richtung Bank.'], bs: 'Bin doch dabei!' },
    konzentrieren: { gut: ['{N} ruft die Kette zusammen – Konzentration!'], bg: 'Konzentration!', schlecht: ['{N} winkt ab – die Ansage geht im Lärm unter.'], bs: 'Was?' },
    beruhigen: { gut: ['{N} atmet durch und beruhigt die Mitspieler.'], bg: 'Alles ruhig, Jungs.', schlecht: ['{N} diskutiert weiter mit dem Schiedsrichter.'], bs: 'Hast du das gesehen?!' },
    anschreien: { gut: ['{N} brüllt zurück: „Jetzt erst recht!“'], bg: 'Jetzt erst recht!', schlecht: ['{N} senkt den Blick – die Ansage verunsichert ihn.'], bs: 'Was soll das?' },
    k: { gut: ['{N} geht als Erster entschlossen aus der Kabine.'], bg: 'Wir drehen das!', schlecht: ['{N} kommt mit hängendem Kopf aus der Kabine.'], bs: 'Na toll.' }
  };
  function reagieren(LIVE, art, gut) {
    const tk = LIVE.tk, r = reaktor(LIVE, art, gut); if (!r) return;
    const t = RX[art.startsWith('k_') ? 'k' : art] || RX.anfeuern, liste = (gut ? t.gut : t.schlecht) || t.gut;
    const name = (kapitaen(r.p) ? 'Kapitän ' : '') + kurzN(r.p);
    LIVE.S.ev.push({ t: LIVE.S.clock + 0.06, type: 'reaktion', side: 'home', text: liste[Math.floor(Math.random() * liste.length)].replace('{N}', name) });
    tk.blase = { n: ((r.p.firstName ? r.p.firstName + ' ' : '') + r.p.name).trim(), text: gut ? t.bg : (t.bs || t.bg), bis: Date.now() + 7000 };
    // Minute, die der Ticker gerade zeigt (die Engine rechnet ein paar Minuten voraus)
    let min = Math.min(90, Math.floor(LIVE.S.clock / 60) + 1);
    try { const ui = P().tsUi(), z = ui && ui.st[ui.i - 1]; if (z && z.mi != null) min = Math.min(90, z.mi + 1); } catch (e) { /* Engine-Minute */ }
    (tk.stimmen = tk.stimmen || []).push({ p: r.p, art, gut, typ: r.typ, min });
  }
  function blaseZeigen(LIVE) {
    const b = LIVE.tk && LIVE.tk.blase;
    document.querySelectorAll('#dfl-ts .pct-blase').forEach(x => { if (!b || Date.now() > b.bis || x.dataset.n !== b.n) x.remove(); });
    if (!b || Date.now() > b.bis) return;
    const zeile = document.querySelector(`#dfl-ts .pcs-team [data-pcs-n="${(W.CSS && CSS.escape) ? CSS.escape(b.n) : b.n.replace(/"/g, '')}"]`);
    if (zeile && !zeile.querySelector('.pct-blase')) zeile.insertAdjacentHTML('beforeend', `<span class="pct-blase" data-n="${esc(b.n)}">${esc(b.text)}</span>`);
  }
  // Nach dem Spiel: etwa jedes dritte Spiel mit Zurufen meldet sich ein Spieler (Moral ±5, harte Ansagen ±8)
  const STIMME = {
    gut: { anschreien: 'Die Ansage in der {M}. Minute hat mich wachgerüttelt. Genau das brauchte ich.',
      fordern: 'Gut, dass {T} mehr gefordert hat – da habe ich noch mal alles rausgeholt.',
      loben: 'Das Lob von der Seitenlinie tat gut. So macht Fußball Spaß.',
      anfeuern: 'Wenn {T} so mitgeht, laufe ich gern einen Meter mehr.',
      konzentrieren: 'Der Zuruf kam genau richtig – danach waren wir alle wieder hellwach.',
      beruhigen: 'Ich war kurz vorm Platzen. Danke, dass {T} mich runtergeholt hat.',
      k: 'Die Worte in der Kabine haben bei mir etwas ausgelöst. Danke dafür.' },
    schlecht: { anschreien: 'Ehrlich gesagt hat mich das Anschreien vor allen getroffen. Danach lief bei mir nichts mehr.',
      fordern: 'Ich gebe immer alles. Die Zurufe von draußen verunsichern mich nur.',
      loben: 'Das Lob passte nicht – wir haben schlecht gespielt, und das wussten alle.',
      konzentrieren: 'Ich habe die Ansage gar nicht verstanden. Das hat mich eher rausgebracht.',
      beruhigen: 'Ich lasse mir nicht sagen, wann ich ruhig sein soll.',
      k: 'Die Kabinenansprache hat mich verunsichert. Ich wusste nicht mehr, woran ich bin.' }
  };
  let stimmeOffen = null;
  function stimmeWaehlen(liste) {
    if (!liste || !liste.length || Math.random() > CFG.stimmeChance) return null;
    // Wer schlecht reagiert hat und empfindlich ist, meldet sich eher; sonst die stärkste Ansage
    const s = liste.slice().sort((a, b) => ((b.typ === 'sensibel') - (a.typ === 'sensibel')) || (!!STARK[b.art] - !!STARK[a.art]))[0];
    const T = W.KSTrainer && KSTrainer.wort ? KSTrainer.wort('der Trainer') : 'der Trainer';
    const key = s.art.startsWith('k_') ? 'k' : s.art;
    const text = (STIMME[s.gut ? 'gut' : 'schlecht'][key] || STIMME[s.gut ? 'gut' : 'schlecht'].k).replace('{M}', s.min).replace('{T}', T);
    const delta = (STARK[s.art] ? CFG.moralStark : CFG.moral) * (s.gut ? 1 : -1);
    if (typeof s.p.morale !== 'number') s.p.morale = 70;
    s.p.morale = Math.max(0, Math.min(100, s.p.morale + delta));
    return { p: s.p, text, delta };
  }
  function gesichtVon(p) {
    try {
      if (W.KSVerein) return KSVerein.gesicht(p, 'fcm');
      if (W.DFLIdentitaet) { let f = null; try { f = DFLSpiel.franchise('fcm'); } catch (e) { f = null; } return DFLIdentitaet.gesichtSvg(p, f ? { farben: f.farben } : null); }
    } catch (e) { /* ohne */ }
    return '';
  }
  const sichtbar = el => !!el && !el.hidden && getComputedStyle(el).display !== 'none' && el.offsetWidth > 0;
  function stimmeWache() {
    if (!stimmeOffen || $('pct-stimme')) return;
    const S = P(); if (S && S.live && S.live()) return;
    if (sichtbar($('dfl-ts')) || sichtbar($('pm-overlay')) || document.querySelector('#app-blatt.auf, #app-sheet.auf')) return;
    try { if (W.KSSimulieren && KSSimulieren.lauf && KSSimulieren.lauf() && !KSSimulieren.lauf().fertig) return; } catch (e) { /* ohne */ }
    const st = stimmeOffen; stimmeOffen = null;
    const o = document.createElement('div'); o.id = 'pct-stimme'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-label', 'Stimmen aus der Kabine');
    o.innerHTML = `<div class="pct-st-box"><span class="pct-st-titel"><i class="ti ti-message-circle" aria-hidden="true"></i> Stimmen aus der Kabine</span>
      <div class="pct-st-kopf"><span class="pct-st-g" aria-hidden="true">${gesichtVon(st.p)}</span><span><b>${esc(((st.p.firstName ? st.p.firstName + ' ' : '') + st.p.name).trim())}</b><small>${esc(st.p.pos || '')}${st.p.age ? ' · ' + st.p.age + ' J.' : ''}</small></span>
        <span class="pct-st-moral ${st.delta > 0 ? 'plus' : 'minus'}">Moral ${st.delta > 0 ? '+' : '−'}${Math.abs(st.delta)}</span></div>
      <p>„${esc(st.text)}“</p><button type="button" class="app-knopf" data-pct-ok="1">Okay</button></div>`;
    o.addEventListener('click', ev => { if (ev.target === o || ev.target.closest('[data-pct-ok]')) o.remove(); });
    document.body.appendChild(o);
    const k = o.querySelector('[data-pct-ok]'); if (k) k.focus();
  }

  // ── Formation ───────────────────────────────────────────────────────────────
  const POS = W.DFLPosition || W.KSPos;
  function slotPos(s) { return (W.TacticsSystem && TacticsSystem.slotToPos) ? TacticsSystem.slotToPos(s) : (s.label || 'ZM'); }
  function slotPlatz(s) { try { return POS && POS.platz ? POS.platz(s) : undefined; } catch (e) { return undefined; } }
  // Feldspieler der Engine auf die Plätze der neuen Formation verteilen: erst die Plätze, für die es nur wenige passende gibt
  function zuordnen(LIVE, form) {
    const slots = ((typeof FORMATIONS !== 'undefined' && FORMATIONS[form]) || []).filter(s => slotPos(s) !== 'TW');
    const feld = LIVE.S.teams[0].filter(p => p.role !== 'TW');
    const kosten = (p, s) => {
      let k = 0;
      try { k = POS && POS.abzug ? POS.abzug(tief(p._ref), s) : 0; } catch (e) { k = 0; }
      const px = 100 - s.y, py = s.x, ex = (p.dir > 0 ? p.hx / 105 : 1 - p.hx / 105) * 100, ey = (p.dir > 0 ? p.hy / 68 : 1 - p.hy / 68) * 100;
      return k * 10 + Math.hypot(px - ex, py - ey) * 0.15;
    };
    const frei = new Set(feld), zu = new Map();
    const reihen = slots.map(s => ({ s, best: feld.map(p => kosten(p, s)).sort((a, b) => a - b) }))
      .sort((a, b) => (a.best[1] - a.best[0]) < (b.best[1] - b.best[0]) ? 1 : -1);
    reihen.forEach(({ s }) => {
      let bp = null, bk = 1e9;
      frei.forEach(p => { const k = kosten(p, s); if (k < bk) { bk = k; bp = p; } });
      if (bp) { frei.delete(bp); zu.set(bp, s); }
    });
    return zu;
  }
  function formationSetzen(LIVE, form) {
    const E = E3(); if (!E || !E.formationSetzen || form === LIVE.tk.form) return false;
    const zu = zuordnen(LIVE, form);
    const plaetze = LIVE.S.teams[0].map(p => {
      const s = zu.get(p); if (!s) return null;
      return { pos: slotPos(s), platz: slotPlatz(s), px: Math.max(2, Math.min(98, 100 - s.y)), py: Math.max(2, Math.min(98, s.x)) };
    });
    if (!E.formationSetzen(LIVE.S, 0, plaetze)) return false;
    LIVE.tk.form = form; LIVE.tk.vorschau = null;
    hinweis(`<i class="ti ti-layout-grid" aria-hidden="true"></i><span><b>Umgestellt auf ${esc(form)}</b> – gilt ab der nächsten Spielminute.</span>`);
    return true;
  }

  // ── Taktikbrett ─────────────────────────────────────────────────────────────
  function feldHtml(LIVE) {
    const tk = LIVE.tk, vor = tk.vorschau && tk.vorschau !== tk.form ? tk.vorschau : null;
    let punkte = [];
    if (vor) {
      const zu = zuordnen(LIVE, vor);
      zu.forEach((s, p) => punkte.push({ x: s.x, y: s.y, pos: slotPos(s), n: kurzN(p._ref) }));
    } else {
      LIVE.S.teams[0].filter(p => p.role !== 'TW').forEach(p => {
        const px = (p.dir > 0 ? p.hx / 105 : 1 - p.hx / 105) * 100, py = (p.dir > 0 ? p.hy / 68 : 1 - p.hy / 68) * 100;
        punkte.push({ x: py, y: 100 - px, pos: (p._platz || p.pos || ''), n: kurzN(p._ref) });
      });
    }
    const tw = LIVE.S.teams[0].find(p => p.role === 'TW');
    if (tw) punkte.push({ x: 50, y: 92, pos: 'TW', n: kurzN(tw._ref) });
    const forms = typeof FORMATIONS !== 'undefined' ? Object.keys(FORMATIONS) : [];
    const aktiv = vor || tk.form;
    return `<div class="pct-feldkopf"><b>Formation</b><span>${vor ? `Vorschau ${esc(vor)} – noch nicht übernommen` : `im Spiel: ${esc(tk.form)}`}</span></div>
      <div class="pct-feld${vor ? ' vorschau' : ''}">${punkte.map(q => `<span class="pct-sp" style="left:${q.x.toFixed(1)}%;top:${q.y.toFixed(1)}%"><i>${esc(q.pos)}</i><b>${esc(q.n)}</b></span>`).join('')}</div>
      <div class="pct-forms" role="group" aria-label="Formation">${forms.map(f => `<button type="button" class="pcs-knopf${f === aktiv ? ' an' : ''}" data-tk-form="${esc(f)}"${LIVE.fertig ? ' disabled' : ''}>${esc(f)}</button>`).join('')}</div>
      ${vor ? `<div class="pct-formzeile"><button type="button" class="pcs-knopf an" data-tk-uebernehmen="1">Auf ${esc(vor)} umstellen</button><button type="button" class="pcs-knopf" data-tk-form="${esc(tk.form)}">Verwerfen</button></div>` : ''}`;
  }
  function anwHtml(LIVE) {
    const tk = LIVE.tk;
    return ANW.map(a => `<div class="pct-anw"><span class="pct-name" title="${esc(a.tipp)}">${esc(a.name)}</span>
      <span class="pcs-stufen">${a.stufen.map(s => `<button type="button" class="pcs-knopf pcs-stufe${tk.wahl[a.k] === s[0] ? ' an' : ''}" data-tk-anw="${a.k}:${s[0]}"${LIVE.fertig ? ' disabled' : ''}>${esc(s[1])}</button>`).join('')}</span></div>`).join('');
  }
  function kraftText(LIVE) {
    const a = (LIVE.S.anw && LIVE.S.anw[0]) || {}, k = a.kraft || 1, pz = Math.round((k - 1) * 100);
    return pz > 1 ? `<b class="pct-teuer">Fitnessverbrauch +${pz} %</b> im Spiel – und weniger Fitness in der nächsten Woche.` : pz < -1 ? `<b>Fitnessverbrauch ${pz} %</b> – schont die Beine.` : 'Fitnessverbrauch normal.';
  }
  function kabineHtml(LIVE) {
    const tk = LIVE.tk;
    if (!LIVE.hz || LIVE.hzWeiter) return '';
    if (tk.kabineGenutzt) return `<div class="pct-kabine"><b>Kabinenansprache:</b> ${esc(KABINE[tk.kabine ? tk.kabine.art : 'ruhig'].name)} ${tk.kabine && !tk.kabine.gut ? '– kam schlecht an.' : '– wirkt bis etwa ' + minVon(tk.kabine ? tk.kabine.bis : LIVE.S.clock) + '.'}</div>`;
    const l = lage(LIVE);
    return `<div class="pct-kabine"><b>Kabinenansprache</b><span>${l.st[0]}:${l.st[1]} zur Pause</span>
      <div>${Object.keys(KABINE).map(k => `<button type="button" class="pcs-knopf" data-tk-kabine="${k}">${esc(KABINE[k].name)}</button>`).join('')}</div></div>`;
  }
  function brettHtml(LIVE) {
    return `<div class="pct-kopf"><b><i class="ti ti-clipboard-list" aria-hidden="true"></i> Taktikbrett</b><span>Gilt ab der nächsten Spielminute · Taste T · Leertaste = weiter</span>
        <button type="button" class="pcs-knopf" data-tk-zu="1" aria-label="Taktikbrett schließen">Schließen</button></div>
      ${kabineHtml(LIVE)}
      <div class="pct-innen"><section class="pct-links">${feldHtml(LIVE)}</section>
        <section class="pct-rechts"><div class="pct-feldkopf"><b>Mannschaftsanweisungen</b><span>bleiben für die nächsten Spiele</span></div>${anwHtml(LIVE)}
        <p class="pct-kraft">${kraftText(LIVE)}</p>${LIVE.tk.gegner ? `<p class="pct-gegner"><i class="ti ti-arrows-shuffle" aria-hidden="true"></i> Gegner: ${esc(GEGNER[LIVE.tk.gegner.art].text)}</p>` : ''}</section></div>`;
  }
  function brettZeichnen(LIVE) {
    const box = document.querySelector('#dfl-ts .ts-box'); if (!box) return;
    let b = box.querySelector(':scope > .pct-brett');
    const auf = !!(LIVE && LIVE.tk && LIVE.tk.brett && !LIVE.fertig);
    if (!auf) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement('div'); b.className = 'pct-brett'; b.setAttribute('role', 'dialog'); b.setAttribute('aria-label', 'Taktikbrett'); box.appendChild(b); }
    b.innerHTML = brettHtml(LIVE);
  }
  function brett(LIVE, auf) {
    if (!LIVE || !LIVE.tk) return;
    LIVE.tk.brett = auf; if (!auf) { LIVE.tk.vorschau = null; aenderungenAnsagen(LIVE); }
    brettZeichnen(LIVE);
  }

  // ── Leiste (ersetzt die alten Ansagen in kickstil_pc_spieltag.js) ──────────
  function leisteHtml(LIVE) {
    const tk = LIVE && LIVE.tk; if (!tk) return '';
    const S = LIVE.S, aktiv = tk.zuruf, pause = !aktiv && S.clock < tk.zurufFrei, aus = LIVE.fertig;
    const knopf = art => `<button type="button" class="pcs-knopf${aktiv && aktiv.art === art ? ' an' : ''}" data-tk-zuruf="${art}"${aus || aktiv || pause ? ' disabled' : ''} title="${esc(ZURUFE[art].tipp)}">${esc(ZURUFE[art].name)}</button>`;
    let status;
    if (aus) status = '';
    else if (aktiv) status = `<i class="ti ti-eye" aria-hidden="true"></i> ${esc(aktiv.eindruck || eindruckVon(aktiv.art, aktiv.gut))}`;
    else if (pause) status = `Nächster Zuruf ab etwa ${minVon(tk.zurufFrei)}.`;
    else status = '';
    return `<button type="button" class="pcs-knopf pct-auf${tk.brett ? ' an' : ''}" data-tk-brett="1"${aus ? ' disabled' : ''}><i class="ti ti-clipboard-list" aria-hidden="true"></i>Taktik <kbd>T</kbd></button>
      <span class="pcs-t">Zurufe</span><span class="pct-zurufe">${Object.keys(ZURUFE).map(knopf).join('')}</span><span class="pcs-status">${status}</span><span class="pct-umbruch" aria-hidden="true"></span>`;
  }
  function sig(LIVE) {
    const tk = LIVE && LIVE.tk; if (!tk) return '';
    return [tk.zuruf ? tk.zuruf.art + tk.zuruf.gut : '', tk.zurufFrei | 0, tk.brett ? 1 : 0, tk.form, tk.vorschau || '', JSON.stringify(tk.wahl), tk.kabineGenutzt ? 1 : 0, LIVE.hz ? 1 : 0, tk.gegner ? tk.gegner.art : ''].join('/');
  }
  function klick(ev, LIVE) {
    const t = ev.target, tk = LIVE && LIVE.tk; if (!tk) return false;
    const z = t.closest('[data-tk-zuruf]'); if (z) { zurufen(LIVE, z.dataset.tkZuruf); return true; }
    if (t.closest('[data-tk-brett]')) { brett(LIVE, !tk.brett); return true; }
    if (t.closest('[data-tk-zu]')) { brett(LIVE, false); return true; }
    const a = t.closest('[data-tk-anw]');
    if (a && !LIVE.fertig) { const [k, v] = a.dataset.tkAnw.split(':'); tk.wahl[k] = v; anwRechnen(LIVE); brettZeichnen(LIVE); return true; }
    const f = t.closest('[data-tk-form]');
    if (f && !LIVE.fertig) { tk.vorschau = f.dataset.tkForm === tk.form ? null : f.dataset.tkForm; brettZeichnen(LIVE); return true; }
    if (t.closest('[data-tk-uebernehmen]') && tk.vorschau) { formationSetzen(LIVE, tk.vorschau); brettZeichnen(LIVE); return true; }
    const kb = t.closest('[data-tk-kabine]'); if (kb) { kabine(LIVE, kb.dataset.tkKabine); brettZeichnen(LIVE); return true; }
    return false;
  }
  function taste(ev, LIVE, ui) {
    const tk = LIVE && LIVE.tk; if (!tk || LIVE.fertig) return false;
    if (ev.key === 't' || ev.key === 'T') { ev.preventDefault(); if (!tk.brett && ui.laeuft) ui.pause(); brett(LIVE, !tk.brett); return true; }
    if (ev.key === 'Escape' && tk.brett) { ev.preventDefault(); brett(LIVE, false); return true; }
    if (ev.key === ' ' && tk.brett) { ev.preventDefault(); brett(LIVE, false); if (!ui.laeuft) ui.weiter(); return true; }
    return false;
  }
  // Pause (Knopf oder Leertaste) und Halbzeit öffnen das Brett; Weiter schließt es
  function wache() {
    const S = P(), LIVE = S && S.live && S.live(); if (!LIVE || !LIVE.tk) return;
    const ui = S.tsUi(); if (!ui) return;
    const laeuft = !!ui.laeuft, tk = LIVE.tk;
    blaseZeigen(LIVE);
    if (tk.laeuftVorher && !laeuft && !ui.fertig && !LIVE.fertig) brett(LIVE, true);
    else if (!tk.laeuftVorher && laeuft && tk.brett) brett(LIVE, false);
    tk.laeuftVorher = laeuft;
  }

  // ── Vor dem Spiel (kickstil_pc_vorspiel.js): Anweisungen fürs nächste Live-Spiel festlegen (Nutzer 2026-10-20: „Ja, Taktikbrett vorher“) ──
  function vorWahl() { return gespeichert(); }
  function vorText() {
    const w = vorWahl(), teile = [];
    ANW.forEach(a => { if (a.k === 'zeit' || w[a.k] === 'normal') return; const st = a.stufen.find(x => x[0] === w[a.k]); if (st) teile.push(`${a.name}: ${st[1]}`); });
    return teile.length ? teile.join(' · ') : 'Alles auf Normal.';
  }
  function vorZeichnen() {
    let o = $('pct-vor');
    if (!o) {
      o = document.createElement('div'); o.id = 'pct-vor'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', 'Taktikbrett vor dem Spiel');
      o.addEventListener('click', ev => {
        if (ev.target === o || ev.target.closest('[data-tk-vzu]')) { vorZu(); return; }
        const a = ev.target.closest('[data-tk-vanw]');
        if (a) { const [k, v] = a.dataset.tkVanw.split(':'); const w = vorWahl(); w[k] = v; delete w.zeit; try { CLUB.pcAnw = w; } catch (e) { /* ohne */ } vorZeichnen(); }
        if (ev.target.closest('[data-tk-vnormal]')) { try { CLUB.pcAnw = (() => { const x = STANDARD(); delete x.zeit; return x; })(); } catch (e) { /* ohne */ } vorZeichnen(); }
      });
      document.body.appendChild(o);
    }
    const w = vorWahl();
    const k = mischen(anwAus(w, null), {}).kraft || 1, pz = Math.round((k - 1) * 100);
    o.innerHTML = `<div class="pct-vor-box"><div class="pct-kopf"><b><i class="ti ti-clipboard-list" aria-hidden="true"></i> Taktikbrett</b><span>Gilt ab dem Anpfiff · im Spiel änderbar (Pause oder T)</span>
        <button type="button" class="pcs-knopf" data-tk-vzu="1">Fertig</button></div>
      <div class="pct-feldkopf"><b>Mannschaftsanweisungen</b><span>Formation: über „Aufstellung ändern“</span></div>
      ${ANW.filter(a => a.k !== 'zeit').map(a => `<div class="pct-anw"><span class="pct-name" title="${esc(a.tipp)}">${esc(a.name)}<small>${esc(a.tipp)}</small></span>
        <span class="pcs-stufen">${a.stufen.map(st => `<button type="button" class="pcs-knopf pcs-stufe${w[a.k] === st[0] ? ' an' : ''}" data-tk-vanw="${a.k}:${st[0]}">${esc(st[1])}</button>`).join('')}</span></div>`).join('')}
      <p class="pct-kraft"><span>${pz > 1 ? `<b class="pct-teuer">Fitnessverbrauch +${pz} %</b> im Spiel – und weniger Fitness in der nächsten Woche.` : pz < -1 ? `<b>Fitnessverbrauch ${pz} %</b> – schont die Beine.` : 'Fitnessverbrauch normal.'}</span>
        <button type="button" class="pcs-knopf" data-tk-vnormal="1">Alles auf Normal</button></p></div>`;
    o.classList.add('auf');
    const zu = o.querySelector('[data-tk-vzu]'); if (zu && !o.contains(document.activeElement)) zu.focus();
  }
  function vorZu() { const o = $('pct-vor'); if (o) o.remove(); try { if (typeof saveGameState === 'function') saveGameState(); } catch (e) { /* ohne */ } try { if (W.KSPcVorspiel && KSPcVorspiel.zeichnen) KSPcVorspiel.zeichnen(); } catch (e) { /* ohne */ } }
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && $('pct-vor')) { ev.preventDefault(); vorZu(); } });

  const CSS = `
  #dfl-ts .pcs-sp{position:relative}
  .pct-blase{position:absolute;right:30px;top:-14px;z-index:4;font:800 11.5px/1.2 var(--font-text,inherit);color:#1d2b20;background:#fff;
    border:2px solid var(--ts-rand,#8b5a2b);border-radius:10px;padding:3px 8px;white-space:nowrap;box-shadow:0 2px 0 var(--ts-rand,#8b5a2b);
    animation:pctBlase .25s ease-out;pointer-events:none}
  .pct-blase::after{content:'';position:absolute;right:12px;bottom:-7px;border:6px solid transparent;border-top-color:var(--ts-rand,#8b5a2b);border-bottom:0}
  @keyframes pctBlase{from{transform:translateY(4px) scale(.9);opacity:0}to{transform:none;opacity:1}}
  @media (prefers-reduced-motion:reduce){.pct-blase{animation:none}}
  #pct-stimme{position:fixed;inset:0;z-index:9650;background:rgb(6 6 5 / .4);display:grid;place-items:center;padding:24px}
  .pct-st-box{width:min(440px,100%);background:var(--bg2,#fffdf9);border:3px solid var(--k-rahmen,#8b5a2b);border-radius:18px;box-shadow:0 6px 0 var(--k-rahmen,#8b5a2b);
    padding:16px 18px;display:flex;flex-direction:column;gap:12px}
  .pct-st-titel{font-size:11px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--text3,#846d52);display:flex;gap:6px;align-items:center}
  .pct-st-kopf{display:flex;align-items:center;gap:12px}
  .pct-st-g{width:56px;height:56px;border-radius:14px;overflow:hidden;background:var(--bg3,#f6ead2);flex:none}
  .pct-st-g svg{width:100%;height:100%;display:block}
  .pct-st-kopf > span:nth-child(2){flex:1;min-width:0} .pct-st-kopf b{display:block;font:800 17px/1.2 var(--font-display,inherit)}
  .pct-st-kopf small{font-size:12px;color:var(--text2,#5c4a36)}
  .pct-st-moral{font-size:12px;font-weight:800;border-radius:8px;padding:3px 8px}
  .pct-st-moral.plus{background:#dff3d8;color:#2f6b1f} .pct-st-moral.minus{background:#f8dcd7;color:#a52a1e}
  .pct-st-box p{margin:0;font-size:15px;line-height:1.45;font-style:italic}
  .pct-st-box .app-knopf{align-self:flex-end;padding:8px 18px}
  #pct-vor{position:fixed;inset:0;z-index:9600;background:rgb(6 6 5 / .45);display:grid;place-items:center;padding:24px}
  .pct-vor-box{width:min(720px,100%);max-height:calc(100vh - 48px);overflow-y:auto;background:var(--bg2,#fffdf9);border:3px solid var(--k-rahmen,#8b5a2b);
    border-radius:18px;box-shadow:0 6px 0 var(--k-rahmen,#8b5a2b);padding:16px 18px;display:flex;flex-direction:column;gap:8px;
    --ts-rand:var(--k-rahmen,#8b5a2b);--ts-linie:var(--k-linie,#d9c3a0);--ts-blau:var(--k-blau-knopf,#2f6fca)}
  .pct-vor-box .pct-name small{display:block;font-size:11px;font-weight:600;color:var(--text3,#846d52);max-width:300px}
  .pct-vor-box .pct-kraft{display:flex;align-items:center;justify-content:space-between;gap:10px}
  .pct-brett{grid-row:3/6;grid-column:2/4;z-index:5;background:var(--bg2,#fffdf9);border-left:3px solid var(--ts-linie);border-right:3px solid var(--ts-linie);
    overflow-y:auto;min-height:0;padding:12px 16px 16px;display:flex;flex-direction:column;gap:10px}
  .pct-kopf{display:flex;align-items:center;gap:12px}
  .pct-kopf b{font:800 17px var(--font-display,inherit);display:flex;align-items:center;gap:6px}
  .pct-kopf span{font-size:12px;color:var(--text3,#846d52);flex:1}
  .pct-innen{display:grid;grid-template-columns:minmax(220px,.8fr) minmax(0,1.2fr);gap:18px;align-items:start}
  .pct-feldkopf{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:6px}
  .pct-feldkopf b{font-size:11px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--text3,#846d52)}
  .pct-feldkopf span{font-size:11.5px;color:var(--text2,#5c4a36)}
  .pct-feld{position:relative;aspect-ratio:68/80;border-radius:12px;border:3px solid var(--ts-rand);background:
    linear-gradient(transparent 49.6%,rgb(255 255 255 / .55) 49.6% 50.4%,transparent 50.4%),
    repeating-linear-gradient(180deg,#2ecc71 0 10%,#31d978 10% 20%);overflow:hidden}
  .pct-feld.vorschau{border-style:dashed;border-color:var(--ts-blau,#2c7cb5)}
  .pct-sp{position:absolute;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:1px;pointer-events:none}
  .pct-sp i{font:800 10px/1 var(--font-text,inherit);font-style:normal;background:#2c3e50;color:#fff;border-radius:6px;padding:3px 5px}
  .pct-sp b{font:800 10.5px/1.1 var(--font-text,inherit);background:rgb(255 255 255 / .94);color:#1d2b20;border-radius:5px;padding:1px 4px;white-space:nowrap;max-width:88px;overflow:hidden;text-overflow:ellipsis}
  .pct-forms{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}
  .pct-forms .pcs-knopf{padding:4px 8px;font-size:12px;border-width:2px;box-shadow:0 2px 0 var(--ts-rand)}
  .pct-formzeile{display:flex;gap:8px;margin-top:8px}
  .pct-anw{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:4px 0;border-bottom:2px dashed color-mix(in srgb,var(--ts-linie) 60%,transparent)}
  .pct-name{font-size:13px;font-weight:800;cursor:help}
  .pct-anw .pcs-stufe{padding:5px 9px;font-size:12px}
  .pct-kraft,.pct-gegner{font-size:12.5px;margin:8px 0 0;color:var(--text2,#5c4a36)}
  .pct-teuer{color:var(--ts-schlecht-fg,#a52a1e)}
  .pct-kabine{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;padding:10px 12px;border-radius:12px;background:var(--bg3,#f6ead2);border:2px solid var(--ts-linie)}
  .pct-kabine > b{font-size:13px} .pct-kabine > span{font-size:12px;color:var(--text2,#5c4a36);flex:1}
  .pct-kabine > div{display:flex;gap:6px;flex-wrap:wrap;width:100%}
  .pct-zurufe{display:inline-flex;gap:6px;flex-wrap:wrap}
  .pcs-ansagen .pct-umbruch{flex-basis:100%;height:0} .pcs-ansagen .pct-umbruch + .pcs-trenn{display:none}
  .pct-zurufe .pcs-knopf{padding:6px 9px;font-size:12px}
  .pct-auf kbd{font:800 10px var(--font-text,inherit);border:1px solid currentColor;border-radius:5px;padding:0 4px;opacity:.7}
  @media (max-width:1450px){.pct-innen{grid-template-columns:1fr}.pct-feld{max-width:300px}}`;
  function startModul() {
    if ($('pct-css')) return;
    const st = document.createElement('style'); st.id = 'pct-css'; st.textContent = CSS; document.head.appendChild(st);
    setInterval(wache, 300);
    setInterval(stimmeWache, 700);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startModul); else startModul();

  W.KSPcTaktik = { CFG, ANW, ZURUFE, KABINE, GEGNER, startAnw, start, anwRechnen, eingriffe, vorBuchen, nachBuchen, leisteHtml, sig, klick, taste,
    zurufen, kabine, formationSetzen, brett, anwAus, vorOeffnen: vorZeichnen, vorText, stimmeOffen: () => stimmeOffen, nachZeichnen: blaseZeigen };
  console.log('[Kickstil-PC-Taktik v1] aktiv — nur PC: Taktikbrett im Live-Spiel, Mannschaftsanweisungen, Zurufe, Kabinenansprache, Gegner-Trainer');
})();
