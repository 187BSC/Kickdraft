/* ===== BUNDLE: bundles/bundle_tactics_core.js ===== */
/* Enthält (in dieser Reihenfolge): tactics_system.js tactics_patches.js */

/* ---------- js/tactics_system.js ---------- */
/* ===== tactics_system.js ===== */
/* ═══════════════════════════════════════════════════════════════════════════
   TAKTIK-SYSTEM  ·  Schere/Stein/Papier/Brunnen + Stil-Sterne + Positionen
   ───────────────────────────────────────────────────────────────────────────
   Eigenständiges Modul. Wird NACH engine_main.js, VOR app_main.js geladen.
   Erweitert bestehende Strukturen, ohne sie zu zerstören.

   Inhalt:
   1. Erweitertes Positionssystem (9 seitenneutrale Positionen)
   2. Technik-Attribut (Migration + ovr-Einfluss)
   3. Stil-Sterne pro Spieler (Werte + Verhältnis zum System)
   4. Eingewöhnung (30 Spiele = +1 Stern, bleibt für immer)
   5. Positions-Malus (gestaffelt nach Verwandtschaft)
   6. Formations-Familien + Konter-Matrix
   7. 6 Taktik-Regler + Regler-Synergie
   8. Kader-Fit (Team-Gesamtbewertung)
   9. Match-Effekt-Berechnung (Formation ±12% / Synergie ±8% / Kader ±6%)
   ═══════════════════════════════════════════════════════════════════════════ */
const TacticsSystem = (function () {

  // ── 1. POSITIONEN ──────────────────────────────────────────────────────────
  // Seitenneutral. Jede Position kennt ihren "Bereich" und ihre Nachbarn.
  const POSITIONS = {
    TW:  { label:'TW',  name:'Torwart',            area:'DEF', row:0 },
    IV:  { label:'IV',  name:'Innenverteidiger',   area:'DEF', row:1 },
    AV:  { label:'AV',  name:'Außenverteidiger',   area:'DEF', row:1 },
    ZDM: { label:'ZDM', name:'Defensives Mittelfeld', area:'MID', row:2 },
    ZM:  { label:'ZM',  name:'Zentrales Mittelfeld',  area:'MID', row:2 },
    AM:  { label:'AM',  name:'Äußeres Mittelfeld', area:'MID', row:3 },
    ZOM: { label:'ZOM', name:'Offensives Mittelfeld', area:'MID', row:3 },
    FL:  { label:'FL',  name:'Flügelspieler',      area:'ATT', row:4 },
    ST:  { label:'ST',  name:'Mittelstürmer',      area:'ATT', row:4 }
  };
  const POS_KEYS = Object.keys(POSITIONS);

  // "Spielfeld-Distanz" zwischen Positionen für gestaffelten Malus.
  // 0 = gleich, 1 = direkt benachbart, 2 = eine Reihe weiter, 3+ = weit weg.
  const POS_NEIGHBORS = {
    TW:  ['IV'],
    IV:  ['AV','ZDM'],
    AV:  ['IV','ZDM','AM'],
    ZDM: ['IV','AV','ZM'],
    ZM:  ['ZDM','ZOM','AM'],
    AM:  ['AV','ZM','FL','ZOM'],
    ZOM: ['ZM','AM','ST','FL'],
    FL:  ['AM','ZOM','ST'],
    ST:  ['ZOM','FL']
  };

  // BFS-Distanz im Positionsgraph (gecached)
  const _distCache = {};
  function posDistance(a, b) {
    if (a === b) return 0;
    const key = a + '>' + b;
    if (_distCache[key] != null) return _distCache[key];
    const seen = new Set([a]);
    let frontier = [a], dist = 0;
    while (frontier.length) {
      dist++;
      const next = [];
      for (const node of frontier) {
        for (const nb of (POS_NEIGHBORS[node] || [])) {
          if (nb === b) { _distCache[key] = dist; return dist; }
          if (!seen.has(nb)) { seen.add(nb); next.push(nb); }
        }
      }
      frontier = next;
      if (dist > 6) break;
    }
    _distCache[key] = 6;
    return 6;
  }

  // ── 2. MIGRATION ALTE → NEUE POSITIONEN ─────────────────────────────────────
  // Bildet die alten 6 Positionen auf die neuen ab. Attribute verfeinern die Wahl.
  // Hand-Mapping für die 20 Startspieler (per id) hat Vorrang.
  const STARTER_POS_MAP = {
    maier:['TW'], lindner:['TW'],
    bauer:['IV','AV'], fischer:['IV'], stark:['IV'], vogel:['IV','AV'],
    reiter:['AV','IV'], gruber:['AV','AM'], berger:['AV','IV','ZM'],
    wagner:['ZDM','ZM'], krause:['ZDM','ZM'],
    klein:['ZM','ZOM'], huber:['ZM','AV'], sommer:['ZM','ZOM'],
    mueller:['ZOM','ZM','ST'], albrecht:['ZOM','FL'],
    schmidt:['ST','ZOM'], braun:['ST'], roth:['ST','FL'], engel:['ST','FL']
  };

  // ── AM/FL-GENERIERUNG (Tuning) ──────────────────────────────────────────────
  // Steuert, wie oft generierte Spieler (Liga, Jugend, Transfers) die neuen
  // Positionen AM (Außen-MF) und FL (Flügelspieler) als Haupt-/Nebenposition
  // bekommen. Quellen bereichs-konsistent gewählt: AM überwiegend aus ZM/OM (MID),
  // FL überwiegend aus ST (ATT), damit die Bereichswerte (def/mid/att) passen.
  const AMFL = {
    avToAM:  0.16,   // schnelle, offensive AVs → AM (Wing-Back → Flügel-MF)
    zmToZDM: 0.22,   // defensiv veranlagte ZMs → ZDM
    zmToAM:  0.22,   // ZMs → AM (Außen-MF)
    omToAM:  0.30,   // OMs → AM
    omToFL:  0.34,   // OMs → FL (wenn schnell & torgefährlich)
    stToFL:  0.62,   // schnelle STs → FL — Hauptquelle für FL (ATT→ATT)
    amSecondary: 0.50, // Chance auf AM als Nebenposition (wo sinnvoll)
    flSecondary: 0.55  // Chance auf FL als Nebenposition (wo sinnvoll)
  };
  const OLD6 = new Set(['TW','IV','AV','ZM','OM','ST']);

  // Generische Migration für alle anderen Spieler (Liga, Jugend, Transfers).
  function migrateOldPos(oldPos, p) {
    // Bereits eine AUSSCHLIESSLICH neue Position (ZDM/AM/ZOM/FL)? Unverändert lassen.
    // (Alte Namen TW/IV/AV/ZM/OM/ST laufen durch die Verteilung unten.)
    if (POSITIONS[oldPos] && !OLD6.has(oldPos)) return oldPos;
    const pace = (p && p.pace) || 65;
    const att  = (p && p.att)  || 55;
    const mental = (p && p.mental) || 60;
    const r = Math.random();
    switch (oldPos) {
      case 'TW': return 'TW';
      case 'IV': return 'IV';
      case 'AV':
        if (pace >= 76 && att >= 55 && r < AMFL.avToAM) return 'AM';
        return 'AV';
      case 'ZM':
        if (mental >= 70 && att <= 66 && r < AMFL.zmToZDM) return 'ZDM';
        if (r < AMFL.zmToZDM + AMFL.zmToAM) return 'AM';
        return 'ZM';
      case 'OM':
        if (pace >= 70 && att >= 58 && r < AMFL.omToFL) return 'FL';
        if (r < AMFL.omToFL + AMFL.omToAM) return 'AM';
        return 'ZOM';
      case 'ST':
        if (pace >= 70 && r < AMFL.stToFL) return 'FL';
        return 'ST';
      default:   return POS_KEYS.includes(oldPos) ? oldPos : 'ZM';
    }
  }

  function migrateNeighborsFor(mainNew, p) {
    const pace = (p && p.pace) || 65;
    const att  = (p && p.att)  || 55;
    const extra = [];
    const r = Math.random();
    // AM/FL auch als Nebenpositionen streuen (mehr Polyvalenz auf den Außen)
    if (mainNew === 'AV'  && pace >= 75 && r < AMFL.amSecondary) extra.push('AM');
    if (mainNew === 'ST'  && pace >= 76 && r < AMFL.flSecondary) extra.push('FL');
    if (mainNew === 'ZOM' && pace >= 74 && r < AMFL.flSecondary) extra.push('FL');
    if (mainNew === 'ZM'  && r < AMFL.amSecondary * 0.6) extra.push('AM');
    if (mainNew === 'AM') { extra.push(pace >= 78 && att >= 58 ? 'FL' : 'ZM'); }
    if (mainNew === 'FL') { extra.push(att >= 62 ? 'ST' : 'AM'); }
    return extra;
  }

  // Wandelt einen Spieler in-place auf das neue Positionssystem um (idempotent).
  function migratePlayer(p) {
    if (!p || p._posMigrated) return p;
    // Hand-Mapping?
    if (STARTER_POS_MAP[p.id]) {
      p.positions = STARTER_POS_MAP[p.id].slice(0, 3);
    } else {
      const oldList = Array.isArray(p.positions) ? p.positions : [p.pos];
      const newList = [];
      for (const old of oldList) {
        const mig = migrateOldPos(old, p);
        if (!newList.includes(mig)) newList.push(mig);
      }
      if (!newList.length) newList.push(migrateOldPos(p.pos, p));
      // Nachbar-Erweiterungen aus Attributen
      for (const ex of migrateNeighborsFor(newList[0], p)) {
        if (newList.length < 3 && !newList.includes(ex)) newList.push(ex);
      }
      p.positions = newList.slice(0, 3);
    }
    p.pos = p.positions[0];
    // Technik-Attribut sicherstellen
    if (p.technik == null) p.technik = deriveTechnik(p);
    // Stil-Eingewöhnung-Container
    if (!p.styleXP) p.styleXP = {}; // { direkt: gamesInStyle, ballbesitz:..., flügel:..., pressing:... }
    p._posMigrated = true;
    return p;
  }

  // ── 3. TECHNIK ─────────────────────────────────────────────────────────────
  // Eigener Zufallswert (wie pace/mental). Wird bei Migration einmalig gesetzt.
  // Leichte Korrelation zu mid, damit kreative Spieler tendenziell technischer sind.
  function deriveTechnik(p) {
    const mid = (p && p.mid) || 55;
    const base = mid * 0.55 + 40 * 0.45;       // gezogen Richtung mid, aber gedämpft
    const noise = (Math.random() - 0.5) * 18;  // ordentliche Streuung
    return Math.max(25, Math.min(95, Math.round(base + noise)));
  }

  // ovr soll Technik leicht mitnehmen: 88% alter Wert + 12% Technik-Einfluss.
  // Wird über computeOvrFromAreas gehängt (siehe Patch unten in applyPatches).
  function blendTechnikIntoOvr(baseOvr, technik) {
    if (technik == null) return baseOvr;
    return Math.round(baseOvr * 0.88 + technik * 0.12);
  }

  // ── 4. STIL-STERNE ─────────────────────────────────────────────────────────
  // 4 Stile. Jeder gewichtet Attribute anders. Ergebnis 0..100 → Sterne 1..5.
  const STYLES = ['direkt', 'ballbesitz', 'fluegel', 'pressing'];
  const STYLE_LABELS = {
    direkt:'Direktes Spiel', ballbesitz:'Geduldiger Ballbesitz',
    fluegel:'Flügelspiel', pressing:'Gegenpressing'
  };

  // Welche Positionen sind für welchen Stil "relevant" (nur die zählen beim Team-Fit).
  const STYLE_POS = {
    direkt:    ['ST','ZOM','FL','AV'],
    ballbesitz:['ZM','ZOM','ZDM','IV'],
    fluegel:   ['AV','AM','FL','ST'],
    pressing:  ['ZM','ZOM','ST','AM']
  };

  // Attribut-Gewichte pro Stil (Summe = 1).
  function styleScoreFromAttrs(p, style) {
    const pace = p.pace||55, att = p.att||55, mid = p.mid||55,
          mental = p.mental||55, def = p.def||55, tec = p.technik||55;
    switch (style) {
      case 'direkt':     return pace*0.50 + att*0.35 + tec*0.15;
      case 'ballbesitz': return tec*0.45 + mid*0.35 + mental*0.20;
      case 'fluegel':    return pace*0.40 + tec*0.30 + mid*0.30;
      case 'pressing':   return mental*0.45 + pace*0.40 + def*0.15;
      default:           return 55;
    }
  }

  // Score 0..100 → halbe Sterne (0..10 in Halben). Kalibriert: 50≈1, 60≈2, 70≈3, 78≈4, 85+≈5.
  function scoreToStars(score) {
    let s;
    if (score >= 85) s = 5.0;
    else if (score >= 78) s = 4.0 + (score-78)/(85-78);
    else if (score >= 70) s = 3.0 + (score-70)/(78-70);
    else if (score >= 60) s = 2.0 + (score-60)/(70-60);
    else if (score >= 50) s = 1.0 + (score-50)/(60-50);
    else s = Math.max(0.5, score/50);
    return Math.round(s * 2) / 2; // auf halbe Sterne
  }

  // Eingewöhnungs-Bonus: 30 Spiele = +1 Stern, max +2 (Naturtalent bleibt wichtig).
  // Bleibt für immer (kein Verfall).
  function adaptationBonusStars(p, style) {
    const games = (p.styleXP && p.styleXP[style]) || 0;
    const bonus = Math.min(2.0, games / 30); // linear, gedeckelt bei +2
    return Math.round(bonus * 2) / 2;
  }

  // Finaler Stern-Wert eines Spielers für einen Stil:
  // Werte-Basis + Eingewöhnung, gedeckelt bei 5.
  // Verhältnis-zum-System steckt in: Eingewöhnung (hier) + Positions-Malus (separat im Team-Fit).
  function playerStyleStars(p, style) {
    migratePlayer(p);
    const base = scoreToStars(styleScoreFromAttrs(p, style));
    const adapt = adaptationBonusStars(p, style);
    return Math.min(5, base + adapt);
  }

  // Alle 4 Stile auf einmal (für die Spielerkarte).
  function playerAllStars(p) {
    const out = {};
    for (const s of STYLES) out[s] = playerStyleStarsObj(p, s);
    return out;
  }
  function playerStyleStarsObj(p, style) {
    migratePlayer(p);
    const baseScore = styleScoreFromAttrs(p, style);
    const base = scoreToStars(baseScore);
    const adapt = adaptationBonusStars(p, style);
    const games = (p.styleXP && p.styleXP[style]) || 0;
    return {
      total: Math.min(5, base + adapt),
      base, adapt, games,
      toNext: adapt < 2 ? Math.max(0, 30 - (games % 30)) : 0
    };
  }

  // ── 5. POSITIONS-MALUS ──────────────────────────────────────────────────────
  // 0%: Stammposition (positions[0])
  // -5%: Nebenposition (in positions[], nicht erste)
  // -10%: fremd aber benachbart (Distanz 1)
  // -20%: fremd & weit (Distanz >=2)
  function positionPenalty(p, slotPos) {
    migratePlayer(p);
    // Positionen mit Seite (kickstil_positionen.js): Abzug −2/−8/−12/−18/−24 → 2,5 / 10 / 15 / 22,5 / 30 %
    if (window.KSPos && slotPos) return Math.min(0.30, KSPos.abzug(p, slotPos) / 80);
    if (!slotPos || !POSITIONS[slotPos]) return 0;
    if (p.positions[0] === slotPos) return 0;
    if (p.positions.includes(slotPos)) return 0.05;
    const d = posDistance(p.positions[0], slotPos);
    if (d <= 1) return 0.10;
    return 0.20;
  }
  // Multiplikator (1.0 = voll, 0.8 = -20%)
  function positionMult(p, slotPos) { return 1 - positionPenalty(p, slotPos); }

  // Kann ein Spieler (neue Positionen) einen Slot mit alter group füllen?
  // Map: alte group → neue Positionen, die "natürlich" passen.
  const GROUP_TO_NEWPOS = {
    TW:  ['TW'],
    IV:  ['IV'],
    AV:  ['AV','AM'],
    ZM:  ['ZDM','ZM','AM','ZOM'],
    OM:  ['ZOM','ZM','AM'],
    ST:  ['ST','FL','ZOM']
  };
  function canPlaySlotGroup(p, group) {
    migratePlayer(p);
    const allowed = GROUP_TO_NEWPOS[group] || [group];
    return p.positions.some(pos => allowed.includes(pos));
  }

  // ── 6. FORMATIONS-FAMILIEN + KONTER ─────────────────────────────────────────
  // Familie pro Formation. Erweiterte Formationsliste (Schlüssel = Anzeigename).
  const FAMILY = {
    // Stein: offensiv übers Zentrum
    '3-5-2':'stein', '3-4-3':'stein', '4-2-2-2':'stein',
    // Papier: flexibel, umschaltstark
    '4-1-4-1':'papier', '4-2-3-1':'papier', '5-4-1':'papier',
    // Schere: defensiv, konterstark über Flügel
    '4-4-1-1':'schere', '5-2-3':'schere', '4-4-2':'schere', '5-3-2':'schere',
    // Brunnen: 4-3-3
    '4-3-3':'brunnen'
  };
  const FAMILY_LABEL = { stein:'Stein', papier:'Papier', schere:'Schere', brunnen:'Brunnen' };

  // Konter-Matrix: gibt Vorteil von A (Reihe) gegen B (Spalte). +1 = A schlägt B.
  //              stein  papier schere brunnen
  // stein         0      -1     +1     -1
  // papier       +1       0     -1     +1
  // schere       -1      +1      0     -1
  // brunnen      +1      -1     +1      0
  const COUNTER = {
    stein:   { stein:0, papier:-1, schere:+1, brunnen:-1 },
    papier:  { stein:+1, papier:0, schere:-1, brunnen:+1 },
    schere:  { stein:-1, papier:+1, schere:0, brunnen:-1 },
    brunnen: { stein:+1, papier:-1, schere:+1, brunnen:0 }
  };

  function familyOf(formation) { return FAMILY[formation] || 'papier'; }

  // Gegen welche konkreten Formationen ist eine Formation stark bzw. schwach?
  // Gibt Listen von Formations-Namen zurück (für UI-Hinweis ohne Familien-Jargon).
  function matchupLists(formation) {
    const myFam = familyOf(formation);
    const strongVs = [], weakVs = [];
    Object.keys(FAMILY).forEach(f => {
      if (f === formation) return;
      const v = (COUNTER[myFam] && COUNTER[myFam][familyOf(f)]) || 0;
      if (v > 0) strongVs.push(f);
      else if (v < 0) weakVs.push(f);
    });
    return { strongVs, weakVs };
  }

  // Formations-Matchup-Effekt: -0.12 .. +0.12
  const FORMATION_MAX = 0.12;
  function formationMatchup(myFormation, oppFormation) {
    const a = familyOf(myFormation), b = familyOf(oppFormation);
    const v = (COUNTER[a] && COUNTER[a][b]) || 0;
    return v * FORMATION_MAX;
  }

  // ── 7. TAKTIK-REGLER + SYNERGIE ─────────────────────────────────────────────
  // 6 Regler. Werte 0..100 (Slider) bzw. diskret. Default 50 / neutral.
  const DEFAULT_TACTICS6 = {
    presshoehe: 50,    // 0 tief stehen .. 100 hoch pressen
    zweikampf:  50,    // 0 auf den Beinen .. 100 aggressiv rein
    passspiel:  50,    // 0 geduldig .. 100 direkt/tief
    breite:     50,    // 0 zentral .. 100 flügel
    ballgewinn: 50,    // 0 sichern .. 100 schnell kontern
    ballverlust:50     // 0 zurückfallen .. 100 gegenpressing
  };

  // Welcher Stil wird durch welche Reglerstellung "gelebt"?
  // Gibt für jeden Stil einen Erfüllungsgrad 0..1 zurück, wie stark die Regler ihn ausdrücken.
  function styleEmphasis(t) {
    t = t || DEFAULT_TACTICS6;
    const hi = v => Math.max(0, (v - 50) / 50);   // 50→0, 100→1
    const lo = v => Math.max(0, (50 - v) / 50);   // 50→0, 0→1
    return {
      direkt:    (hi(t.passspiel) + hi(t.ballgewinn)) / 2,
      ballbesitz:(lo(t.passspiel) + lo(t.ballgewinn)) / 2,
      fluegel:   hi(t.breite),
      pressing:  (hi(t.presshoehe) + hi(t.ballverlust)) / 2
    };
  }

  // Welche Stile "will" eine Formationsfamilie? (Wunsch-Profil)
  const FAMILY_WANTS = {
    stein:   { direkt:0.7, pressing:0.7, ballbesitz:0.2, fluegel:0.3 },
    papier:  { direkt:0.5, pressing:0.5, ballbesitz:0.5, fluegel:0.5 }, // ausgewogen
    schere:  { fluegel:0.8, direkt:0.7, ballbesitz:0.3, pressing:0.4 },
    brunnen: { ballbesitz:0.9, fluegel:0.5, direkt:0.2, pressing:0.4 }
  };

  // Regler-Synergie: -0.08 .. +0.08
  // Vergleicht, wie gut die per Regler gelebten Stile zum Wunsch der Formation passen.
  const SYNERGY_MAX = 0.08;
  function reglerSynergy(formation, tactics) {
    const wants = FAMILY_WANTS[familyOf(formation)];
    const emph = styleEmphasis(tactics);
    // Gewichteter Erfüllungsgrad: betont der Spieler die Stile, die die Formation will?
    let aligned = 0, wsum = 0, conflict = 0;
    for (const s of STYLES) {
      const w = wants[s] || 0;
      const e = emph[s] || 0;
      aligned += w * e;
      wsum    += w;
      // Konflikt: Formation will den Stil kaum (w<0.4), Regler pushen ihn stark (e>0.55)
      if (w < 0.4 && e > 0.55) conflict += (e - 0.55);
    }
    // ratio: 0 (Regler neutral) .. ~1 (Regler maximal auf die Wunschstile)
    const ratio = wsum > 0 ? aligned / wsum : 0;
    // Neutral-Regler (alle 50) → ratio≈0 → leicht negativ (verschenktes Potenzial),
    // gut abgestimmte Regler → ratio hoch → positiv.
    let net = ratio * 2.4 - 0.30;   // ratio 0→-0.30, 0.4→+0.66, 0.55→+1.0
    net -= conflict * 1.2;          // Extreme gegen die Formation deutlich bestrafen
    net = Math.max(-1, Math.min(1, net));
    return net * SYNERGY_MAX;
  }

  // ── 8. KADER-FIT ────────────────────────────────────────────────────────────
  // Bestimmt den "aktuellen Stil" aus den Reglern (dominanter Emphasis-Stil).
  function dominantStyle(tactics) {
    const emph = styleEmphasis(tactics);
    let best = 'ballbesitz', bestV = -1;
    for (const s of STYLES) { if (emph[s] > bestV) { bestV = emph[s]; best = s; } }
    // Wenn alles neutral (alle ~0), Default je nach... nimm ballbesitz als neutralsten.
    if (bestV < 0.12) return 'ballbesitz';
    return best;
  }

  // Kader-Fit für eine Startelf gegen einen Stil:
  // Pro relevantem Spieler: Stil-Sterne * Positions-Multiplikator.
  // Rückgabe: { stars: Ø 0..5, effect: -0.06..+0.06, perPlayer:[...] }
  const KADER_MAX = 0.06;
  function squadFit(lineupSlots, getPlayerFn, formationSlots, style) {
    // lineupSlots: { slotId: playerId }, formationSlots: [{id, pos/group}]
    const relevant = STYLE_POS[style] || [];
    const perPlayer = [];
    let sum = 0, count = 0;

    const slotPosById = {};
    (formationSlots || []).forEach(s => { slotPosById[s.id] = window.KSPos ? KSPos.platz(s) : slotToPos(s); });

    for (const slotId in lineupSlots) {
      const pid = lineupSlots[slotId];
      if (!pid) continue;
      const p = getPlayerFn(pid);
      if (!p) continue;
      migratePlayer(p);
      const slotPos = slotPosById[slotId] || p.positions[0];
      // Nur Spieler auf für den Stil relevanten Slot-Positionen zählen voll;
      // andere zählen halb (sie tragen den Stil weniger).
      const relPos = window.KSPos ? KSPos.grund(slotPos) : slotPos;
      const relWeight = relevant.includes(relPos) ? 1.0 : 0.4;
      const stars = playerStyleStarsObj(p, style).total;
      const posMult = positionMult(p, slotPos);
      const effStars = stars * posMult;
      sum += effStars * relWeight;
      count += relWeight;
      perPlayer.push({
        id:pid, name:p.name, slotPos,
        stars: Math.round(stars*2)/2,
        posMult, posPenalty: positionPenalty(p, slotPos),
        effStars: Math.round(effStars*2)/2,
        relevant: relevant.includes(relPos)
      });
    }
    const avg = count > 0 ? sum / count : 2.5;
    // Ø-Sterne 0..5 → Effekt -0.06..+0.06 (Mittelpunkt 3.0 = neutral)
    const effect = Math.max(-KADER_MAX, Math.min(KADER_MAX, (avg - 3.0) / 2.0 * KADER_MAX));
    return { stars: Math.round(avg*10)/10, effect, perPlayer, style };
  }

  // Übersetzt einen Formations-Slot in eine Positions-Kennung des neuen Systems.
  // Formationen nutzen 'group' (TW/IV/AV/ZM/OM/ST) + 'label' (LV/RM/LA/DM...).
  function slotToPos(slot) {
    if (!slot) return 'ZM';
    const g = slot.group, l = (slot.label||'').toUpperCase();
    if (g === 'TW') return 'TW';
    if (g === 'IV') return 'IV';
    if (g === 'AV') return 'AV';   // LV/RV/LF/RF Wingback → AV
    if (g === 'OM') return l.includes('OM') ? 'ZOM' : 'ZOM';
    if (g === 'ST') {
      // Flügel-Stürmer (LA/RA/LF/RF) → FL, zentraler ST → ST
      if (l.includes('A') || l.includes('F') || l.includes('L') || l.includes('R')) {
        if (l === 'ST') return 'ST';
        return 'FL';
      }
      return 'ST';
    }
    if (g === 'ZM') {
      // DM → ZDM; LM/RM (Außen) → AM; sonst ZM
      if (l.includes('DM')) return 'ZDM';
      if (l === 'LM' || l === 'RM') return 'AM';
      return 'ZM';
    }
    return 'ZM';
  }

  // ── 9. GESAMT-MATCH-EFFEKT ───────────────────────────────────────────────────
  // Summe der drei Komponenten. Rückgabe in "Anteil" (z.B. +0.09 = +9%).
  function computeMatchEffect(opts) {
    // opts: { myFormation, oppFormation, tactics, lineupSlots, getPlayerFn, formationSlots }
    const style = dominantStyle(opts.tactics);
    const fEff = formationMatchup(opts.myFormation, opts.oppFormation);
    const sEff = reglerSynergy(opts.myFormation, opts.tactics);
    const fit  = squadFit(opts.lineupSlots, opts.getPlayerFn, opts.formationSlots, style);
    const raw = fEff + sEff + fit.effect;
    // Sanfte Deckelung: Summe kann roh bis ±26% gehen, wird aber Richtung ±18% gestaucht,
    // damit Extremfälle (alles negativ) nicht das Spiel entscheiden. Spielerstärke bleibt dominant.
    const CAP = 0.18;
    const total = CAP * Math.tanh(raw / CAP);
    return {
      total,
      formation: fEff, synergy: sEff, kader: fit.effect,
      style, kaderStars: fit.stars, fitDetail: fit,
      myFamily: familyOf(opts.myFormation),
      oppFamily: opts.oppFormation ? familyOf(opts.oppFormation) : null
    };
  }

  // ── EINGEWÖHNUNG TRACKEN ─────────────────────────────────────────────────────
  // Nach jedem Spiel: Startelf-Spieler bekommen +1 Spiel im aktuell dominanten Stil.
  function trackAdaptation(lineupIds, getPlayerFn, tactics) {
    const style = dominantStyle(tactics);
    lineupIds.forEach(pid => {
      const p = getPlayerFn(pid);
      if (!p) return;
      migratePlayer(p);
      if (!p.styleXP) p.styleXP = {};
      p.styleXP[style] = (p.styleXP[style] || 0) + 1;
    });
    return style;
  }

  // ── CO-TRAINER-TEXTE ─────────────────────────────────────────────────────────
  function fitVerdict(stars) {
    if (stars >= 4.3) return 'Perfekte Passung — dein Kader lebt diesen Stil.';
    if (stars >= 3.6) return 'Sehr gut. Der Großteil der Mannschaft passt zum Stil.';
    if (stars >= 3.0) return 'Solide Basis. Mit etwas Eingewöhnung wächst das weiter.';
    if (stars >= 2.3) return 'Durchwachsen. Einige Spieler tun sich mit diesem Stil schwer.';
    return 'Schlechte Passung. Dieser Stil passt kaum zu deinem Personal.';
  }
  function matchupVerdict(myFam, oppFam) {
    const v = (COUNTER[myFam] && COUNTER[myFam][oppFam]) || 0;
    if (v > 0) return { txt:`Vorteil: ${FAMILY_LABEL[myFam]} schlägt ${FAMILY_LABEL[oppFam]}.`, sign:1 };
    if (v < 0) return { txt:`Nachteil: ${FAMILY_LABEL[oppFam]} kontert ${FAMILY_LABEL[myFam]}.`, sign:-1 };
    return { txt:`Ausgeglichenes Duell (${FAMILY_LABEL[myFam]} vs. ${FAMILY_LABEL[oppFam]}).`, sign:0 };
  }
  // Welche meiner 3 Repertoire-Formationen kontert den Gegner am besten?
  function bestCounterFromRepertoire(repertoire, oppFormation, currentFormation) {
    const oppFam = familyOf(oppFormation);
    let best = null, bestV = -99;
    (repertoire || []).forEach(f => {
      const v = (COUNTER[familyOf(f)] && COUNTER[familyOf(f)][oppFam]) || 0;
      if (v > bestV) { bestV = v; best = f; }
    });
    const curV = (COUNTER[familyOf(currentFormation)] && COUNTER[familyOf(currentFormation)][oppFam]) || 0;
    return { formation: best, value: bestV, currentValue: curV, improves: bestV > curV };
  }

  // ── ÖFFENTLICHE API ──────────────────────────────────────────────────────────
  return {
    POSITIONS, POS_KEYS, POS_NEIGHBORS, posDistance,
    STYLES, STYLE_LABELS, STYLE_POS,
    FAMILY, FAMILY_LABEL, COUNTER, familyOf, matchupLists,
    DEFAULT_TACTICS6,
    migratePlayer, deriveTechnik, blendTechnikIntoOvr,
    styleScoreFromAttrs, scoreToStars, playerStyleStarsObj, playerAllStars,
    positionPenalty, positionMult, canPlaySlotGroup,
    formationMatchup, reglerSynergy, styleEmphasis, dominantStyle,
    squadFit, slotToPos, computeMatchEffect,
    trackAdaptation, fitVerdict, matchupVerdict, bestCounterFromRepertoire,
    FORMATION_MAX, SYNERGY_MAX, KADER_MAX
  };
})();

if (typeof window !== 'undefined') window.TacticsSystem = TacticsSystem;


/* ---------- js/tactics_patches.js ---------- */
/* ===== tactics_patches.js ===== */
/* ═══════════════════════════════════════════════════════════════════════════
   TAKTIK-PATCHES  ·  Hängt das Taktik-System in die bestehende Engine ein
   ───────────────────────────────────────────────────────────────────────────
   Wird NACH tactics_system.js, VOR app_main.js geladen.
   - Erweitert FORMATIONS um die neuen Familien-Formationen
   - Verfeinert Slot-Positionen bestehender Formationen (DM, Außen-MF, Flügel)
   - Migriert alle Spieler auf Technik + neue Positionen
   - Integriert Technik leicht in ovr
   - Ersetzt CLUB.tactics durch die 6 neuen Regler (mit Repertoire)
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  const T = window.TacticsSystem;
  if (!T) { console.error('TacticsSystem fehlt'); return; }

  // ── A. NEUE FORMATIONEN ───────────────────────────────────────────────────
  // y: 0=Angriff, 100=eigenes Tor. label dient der Positions-Ableitung (slotToPos).
  const NEW_FORMATIONS = {
    '4-2-3-1': [
      {id:'TW',label:'TW',group:'TW',x:50,y:90},
      {id:'LV',label:'LV',group:'AV',x:14,y:68},{id:'IV1',label:'IV',group:'IV',x:36,y:72},
      {id:'IV2',label:'IV',group:'IV',x:64,y:72},{id:'RV',label:'RV',group:'AV',x:86,y:68},
      {id:'DM1',label:'DM',group:'ZM',x:38,y:56},{id:'DM2',label:'DM',group:'ZM',x:62,y:56},
      {id:'OML',label:'LM',group:'ZM',x:18,y:34},{id:'OMC',label:'OM',group:'OM',x:50,y:30},{id:'OMR',label:'RM',group:'ZM',x:82,y:34},
      {id:'ST1',label:'ST',group:'ST',x:50,y:12}
    ],
    '4-1-4-1': [
      {id:'TW',label:'TW',group:'TW',x:50,y:90},
      {id:'LV',label:'LV',group:'AV',x:14,y:68},{id:'IV1',label:'IV',group:'IV',x:36,y:72},
      {id:'IV2',label:'IV',group:'IV',x:64,y:72},{id:'RV',label:'RV',group:'AV',x:86,y:68},
      {id:'DM1',label:'DM',group:'ZM',x:50,y:58},
      {id:'LM',label:'LM',group:'ZM',x:14,y:40},{id:'ZM1',label:'ZM',group:'ZM',x:38,y:42},
      {id:'ZM2',label:'ZM',group:'ZM',x:62,y:42},{id:'RM',label:'RM',group:'ZM',x:86,y:40},
      {id:'ST1',label:'ST',group:'ST',x:50,y:14}
    ],
    '5-4-1': [
      {id:'TW',label:'TW',group:'TW',x:50,y:90},
      {id:'IV1',label:'IV',group:'IV',x:28,y:76},{id:'IV2',label:'IV',group:'IV',x:50,y:80},{id:'IV3',label:'IV',group:'IV',x:72,y:76},
      {id:'LWB',label:'LV',group:'AV',x:8,y:58},{id:'RWB',label:'RV',group:'AV',x:92,y:58},
      {id:'LM',label:'LM',group:'ZM',x:20,y:40},{id:'ZM1',label:'ZM',group:'ZM',x:42,y:44},
      {id:'ZM2',label:'ZM',group:'ZM',x:58,y:44},{id:'RM',label:'RM',group:'ZM',x:80,y:40},
      {id:'ST1',label:'ST',group:'ST',x:50,y:14}
    ],
    '4-4-1-1': [
      {id:'TW',label:'TW',group:'TW',x:50,y:90},
      {id:'LV',label:'LV',group:'AV',x:12,y:68},{id:'IV1',label:'IV',group:'IV',x:35,y:72},
      {id:'IV2',label:'IV',group:'IV',x:65,y:72},{id:'RV',label:'RV',group:'AV',x:88,y:68},
      {id:'LM',label:'LM',group:'ZM',x:12,y:44},{id:'ZM1',label:'ZM',group:'ZM',x:38,y:48},
      {id:'ZM2',label:'ZM',group:'ZM',x:62,y:48},{id:'RM',label:'RM',group:'ZM',x:88,y:44},
      {id:'OMC',label:'OM',group:'OM',x:50,y:28},{id:'ST1',label:'ST',group:'ST',x:50,y:12}
    ],
    '5-2-3': [
      {id:'TW',label:'TW',group:'TW',x:50,y:90},
      {id:'IV1',label:'IV',group:'IV',x:28,y:76},{id:'IV2',label:'IV',group:'IV',x:50,y:80},{id:'IV3',label:'IV',group:'IV',x:72,y:76},
      {id:'LWB',label:'LV',group:'AV',x:8,y:56},{id:'RWB',label:'RV',group:'AV',x:92,y:56},
      {id:'ZM1',label:'ZM',group:'ZM',x:40,y:48},{id:'ZM2',label:'ZM',group:'ZM',x:60,y:48},
      {id:'LA',label:'LA',group:'ST',x:18,y:20},{id:'ST1',label:'ST',group:'ST',x:50,y:14},{id:'RA',label:'RA',group:'ST',x:82,y:20}
    ],
    '3-4-3': [
      {id:'TW',label:'TW',group:'TW',x:50,y:90},
      {id:'IV1',label:'IV',group:'IV',x:30,y:74},{id:'IV2',label:'IV',group:'IV',x:50,y:78},{id:'IV3',label:'IV',group:'IV',x:70,y:74},
      {id:'LM',label:'LM',group:'ZM',x:12,y:46},{id:'ZM1',label:'ZM',group:'ZM',x:40,y:48},
      {id:'ZM2',label:'ZM',group:'ZM',x:60,y:48},{id:'RM',label:'RM',group:'ZM',x:88,y:46},
      {id:'LA',label:'LA',group:'ST',x:20,y:18},{id:'ST1',label:'ST',group:'ST',x:50,y:14},{id:'RA',label:'RA',group:'ST',x:80,y:18}
    ],
    '4-2-2-2': [
      {id:'TW',label:'TW',group:'TW',x:50,y:90},
      {id:'LV',label:'LV',group:'AV',x:14,y:68},{id:'IV1',label:'IV',group:'IV',x:36,y:72},
      {id:'IV2',label:'IV',group:'IV',x:64,y:72},{id:'RV',label:'RV',group:'AV',x:86,y:68},
      {id:'DM1',label:'DM',group:'ZM',x:38,y:54},{id:'DM2',label:'DM',group:'ZM',x:62,y:54},
      {id:'OML',label:'OM',group:'OM',x:30,y:32},{id:'OMR',label:'OM',group:'OM',x:70,y:32},
      {id:'ST1',label:'ST',group:'ST',x:38,y:14},{id:'ST2',label:'ST',group:'ST',x:62,y:14}
    ]
  };
  // Bestehende 4-2-3-1 in der Engine hat group:'OM' für die Dreierreihe; wir überschreiben
  // mit feineren Labels, damit Außen→AM, Mitte→ZOM korrekt abgeleitet wird.
  for (const key in NEW_FORMATIONS) {
    if (!FORMATIONS[key]) FORMATIONS[key] = NEW_FORMATIONS[key];
    else FORMATIONS[key] = NEW_FORMATIONS[key]; // überschreibe für konsistente Labels
  }
  // Verfeinere die bestehenden Standardformationen, die schon da waren (4-4-2, 4-3-3, 3-5-2, 5-3-2):
  // Bei 4-4-2 sind LM/RM bereits korrekt (→ AM). 4-3-3 LA/RA → FL. 3-5-2 hat LF/RF Wingbacks → AV. Passt.

  // ── B. SPIELER-MIGRATION (Technik + neue Positionen) ───────────────────────
  function migrateAll() {
    if (typeof SQUAD !== 'undefined' && Array.isArray(SQUAD)) SQUAD.forEach(p => T.migratePlayer(p));
  }
  migrateAll();

  // ── C. TECHNIK IN OVR ──────────────────────────────────────────────────────
  // computeOvrFromAreas neu wrappen: alter Wert + leichter Technik-Einfluss.
  if (typeof computeOvrFromAreas === 'function') {
    const _origOvr = computeOvrFromAreas;
    window.computeOvrFromAreas = function (player) {
      const base = _origOvr(player);
      return T.blendTechnikIntoOvr(base, player && player.technik);
    };
    // global überschreiben, damit alle Aufrufer die gepatchte Version nutzen
    try { computeOvrFromAreas = window.computeOvrFromAreas; } catch (e) {}
  }

  // Technik bei neu generierten Spielern setzen: generatePositions auf max 3 begrenzen
  if (typeof generatePositions === 'function') {
    const _origGenPos = generatePositions;
    window.generatePositions = function (mainPos) {
      const list = _origGenPos(mainPos);
      return list.slice(0, 3);
    };
    try { generatePositions = window.generatePositions; } catch (e) {}
  }

  // ── D. 6 NEUE REGLER + REPERTOIRE in CLUB ──────────────────────────────────
  if (typeof CLUB !== 'undefined') {
    // Neue Regler-Struktur (zusätzlich zur alten tactics, die wir für Kompatibilität behalten)
    if (!CLUB.tactics6) CLUB.tactics6 = Object.assign({}, T.DEFAULT_TACTICS6);
    // 3er-Repertoire: Standard = die 3 gängigsten, inkl. aktueller Formation
    if (!CLUB.repertoire) {
      const cur = CLUB.formation || '4-4-2';
      const def = [cur, '4-3-3', '4-2-3-1'].filter((f, i, a) => a.indexOf(f) === i).slice(0, 3);
      CLUB.repertoire = def;
    }
    // Mappe alte tactics → neue tactics6 (einmalig), damit bestehende Einstellungen nicht verloren gehen
    if (CLUB.tactics && !CLUB._tactics6Migrated) {
      const old = CLUB.tactics;
      CLUB.tactics6.presshoehe = old.pressing != null ? old.pressing : 50;
      CLUB.tactics6.passspiel  = old.passstyle === 'lang' ? 80 : old.passstyle === 'kurz' ? 20 : 50;
      CLUB.tactics6.breite     = old.width != null ? old.width : 50;
      CLUB.tactics6.ballgewinn = old.tempo != null ? old.tempo : 50;
      // mentality → presshoehe/ballverlust leicht beeinflussen
      if (old.mentality != null) {
        CLUB.tactics6.ballverlust = Math.max(0, Math.min(100, 50 + old.mentality * 12));
      }
      CLUB._tactics6Migrated = true;
    }
  }

  // ── E. GEGNER-FORMATION ZUWEISEN ───────────────────────────────────────────
  // Gegner-Teams haben nur ovr. Wir geben ihnen prozedural eine Formation,
  // gewichtet leicht nach ihren Werten (def-stark → defensive Familie).
  const ALL_FORMATIONS = Object.keys(FORMATIONS);
  window.assignOpponentFormation = function (team) {
    if (!team) return '4-4-2';
    // deterministisch über Team-id/name, damit dasselbe Team konsistent bleibt
    const seedStr = (team.id || team.name || 'x') + (team.ovr || 60);
    let h = 0; for (let i = 0; i < seedStr.length; i++) h = (h * 31 + seedStr.charCodeAt(i)) >>> 0;
    // Familie nach Defensivneigung
    let pool;
    const d = team.def || team.ovr || 60, a = team.att || team.ovr || 60;
    if (d - a > 6) pool = ['schere', 'papier'];        // defensiv
    else if (a - d > 6) pool = ['stein', 'brunnen'];   // offensiv
    else pool = ['stein', 'papier', 'schere', 'brunnen'];
    const fam = pool[h % pool.length];
    const inFam = ALL_FORMATIONS.filter(f => T.familyOf(f) === fam);
    return inFam[(h >> 3) % inFam.length] || '4-4-2';
  };

  console.log('[Taktik] Patches aktiv:', ALL_FORMATIONS.length, 'Formationen,',
    (typeof SQUAD !== 'undefined' ? SQUAD.length : 0), 'Spieler migriert');
})();

