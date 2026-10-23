/* ===== match_engine_v2.js =====
   BALLBESITZ-KETTEN-ENGINE (Prototyp)
   ─────────────────────────────────────────────────────────────────────────────
   Simuliert ein Fußballspiel als Folge von BALLBESITZ-SEQUENZEN statt als
   Minuten-Würfel. Jede Sequenz ist eine Kette von Aktionen (Pass, Dribbling,
   Flanke, Abschluss), die in Zonen stattfinden und aus Spielerwerten, Druck,
   Taktik und Zone ausgewürfelt werden.

   Warum: Die Kette erzeugt einen echten Ereignisstrom MIT Ort und Spieler —
   die Grundlage für eine ehrliche 2D-Darstellung, echte Passquoten, echte
   Vorlagen, Chancenqualität (xG) und Pressing, das wirklich etwas bewirkt.

   Reines Modell — KEIN DOM, KEINE Abhängigkeit zum Spiel. Rückgabe ist ein
   Ergebnisobjekt; die Anbindung an die bestehende Engine macht später ein Adapter.

   Feld-Modell
     bands 0..5 aus Sicht des ballführenden Teams:
       0 eigener Strafraum · 1 eigenes Drittel · 2 eigene Hälfte
       3 gegn. Hälfte · 4 gegn. Drittel · 5 gegn. Strafraum
     lanes 0..4 von links nach rechts (aus Sicht des ballführenden Teams)

   Kalibrierziele (pro Team/Spiel, Profiniveau):
     Tore 1,2–1,6 · Schüsse 10–14 · aufs Tor ~35% · Pässe 300–500
     Passquote 72–85% · Sequenzen 100–130 · Ecken 4–6 · Fouls 10–13
   ============================================================================= */
(function () {
  'use strict';

  // ── Zufall (seedbar → reproduzierbare Tests) ───────────────────────────────
  function rngFrom(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const CFG = {
    matchSeconds: 5400,          // 90 Minuten
    // Zeitkosten je Aktion und tote Zeit nach Sequenzende (Einwurf, Freistoß …)
    actionSec: [2.2, 5.5],
    deadSecShort: [4, 11],       // Ballverlust im Spiel
    deadSecStop: [16, 34],       // Aus, Foul, Abstoß, Tor

    // Passwahrscheinlichkeit: Basis je Passart
    passBase: { short: 0.960, forward: 0.900, long: 0.72, cross: 0.30 },
    dribbleBase: 0.66,
    // Einfluss von Druck (0..1) auf Erfolg
    pressureHit: { pass: 0.125, dribble: 0.40, shotXg: 0.45 },
    // Raumgewinn je Pass — der wichtigste Regler: zu hoch = Dauerfeuer aufs Tor.
    // Echtes Spiel: die meisten Pässe laufen quer oder zurück.
    progress: { fwd: 0.30, back: 0.20 },
    // Pässe INS letzte Drittel / in den Strafraum kommen deutlich seltener an —
    // dort steht die Abwehr kompakt. Das ist der eigentliche Regler für die
    // Anzahl der Torschüsse (nicht die Schussneigung selbst).
    arrivalPenalty: [1, 1, 1, 0.94, 0.71, 0.36],
    // Spielerklasse: Wert 70 = neutral; je Punkt darüber/darunter ±
    qualityPerPoint: 0.006,

    // Aktionsgewichte je Band (0..5)
    wShoot:   [0.00, 0.002, 0.005, 0.014, 0.080, 0.400],
    wDribble: [0.05, 0.08, 0.12, 0.15, 0.17, 0.15],
    wLong:    [0.40, 0.28, 0.20, 0.13, 0.07, 0.02],
    wCross:   [0, 0, 0, 0.06, 0.30, 0.18],   // nur aus Außenbahnen
    wClear:   [0.80, 0.20, 0.03, 0, 0, 0],

    // Chancenqualität (xG) je Band/Lane-Nähe zur Mitte
    xgBase:   [0.00, 0.013, 0.024, 0.043, 0.083, 0.192],
    xgCentral: 1.55,             // Faktor in der zentralen Bahn
    xgWide:    0.55,             // Faktor ganz außen
    onTargetRest: 0.30,          // Anteil der Nicht-Tore, die aufs Tor gehen (Parade)

    foulPerDuel: 0.26,           // Chance auf Foul bei Ballverlust/Zweikampf
    yellowPerFoul: 0.16,
    redPerFoul: 0.006,
    cornerOnBlocked: 0.42,       // geblockter Schuss → Ecke
    cornerOnCrossFail: 0.16,     // abgewehrte Flanke → Ecke
    cornerOnClear: 0.09,         // Klärung ins Aus → Ecke
    cornerXg: 0.031,             // Torwahrscheinlichkeit einer Ecke

    // Ballgewinn-Position: wie stark presst das Team (0..1) → höhere Eroberung
    pressGain: 0.30
  };

  // ── LIGA-PROFILE ───────────────────────────────────────────────────────────
  // Je höher die Spielklasse, desto sauberer das Passspiel, desto weniger lange
  // Bälle und desto besser die Chancenverwertung. Dadurch fühlt sich ein
  // Aufstieg im Spiel wirklich anders an: unten wird gebolzt, oben kombiniert.
  // actionMul: Spieltempo — oben wird schneller kombiniert (mehr Ballkontakte),
  // unten mehr geholzt und verzögert. Staffelt die Passzahl realistisch.
  const LEVELS = {
    regionalliga: { pass: 0.960, longMul: 1.40, arrivalMul: 0.94, xgMul: 1.02, actionMul: 1.22, label: 'Regionalliga' },
    liga3:        { pass: 0.982, longMul: 1.20, arrivalMul: 0.97, xgMul: 1.00, actionMul: 1.10, label: '3. Liga' },
    bundesliga2:  { pass: 1.000, longMul: 1.00, arrivalMul: 1.00, xgMul: 0.97, actionMul: 1.00, label: '2. Bundesliga' },
    bundesliga:   { pass: 1.038, longMul: 0.82, arrivalMul: 0.99, xgMul: 0.86, actionMul: 0.84, label: 'Bundesliga' }
  };

  // ── TAKTIK-ANBINDUNG ───────────────────────────────────────────────────────
  // Die sechs Regler (0..100, 50 = neutral) greifen direkt an den Parametern an.
  // Jede Einstellung hat einen PREIS — das ist der Kern echter Taktik.
  const DEFAULT_TACTICS = { presshoehe: 50, zweikampf: 50, passspiel: 50, breite: 50, ballgewinn: 50, ballverlust: 50 };

  // EINGESPIELTHEIT (0..1): wie gut kennt und lebt die Elf das aktuelle System?
  // Speist sich im Spiel aus TacticsSystem: Stil-Eignung der Spieler (Attribute)
  // + Stil-Erfahrung (p.styleXP, bis +2 Sterne nach ~30 Spielen).
  // WIRKUNG: Ein eingespieltes Team passt sauberer, findet den letzten Pass, presst
  // organisiert und verliert Bälle weniger gefährlich. Wer das System wechselt,
  // startet unten — das sind die Wechselkosten, die Systemtreue belohnen.
  function cohesionOf(team) {
    const c = (team && team.cohesion != null) ? team.cohesion : 0.5;
    return Math.max(0, Math.min(1, c));
  }

  function resolveParams(team, levelKey) {
    const L = LEVELS[levelKey] || LEVELS.bundesliga2;
    const t = Object.assign({}, DEFAULT_TACTICS, team.tactics6 || {});
    const coh = (cohesionOf(team) - 0.5) * 2;        // -1 (fremd) … +1 (eingespielt)
    const n = v => (Math.max(0, Math.min(100, v)) - 50) / 50;   // -1 … +1
    const passspiel = n(t.passspiel), breite = n(t.breite), zweikampf = n(t.zweikampf);
    const presshoehe = n(t.presshoehe), ballgewinn = n(t.ballgewinn), ballverlust = n(t.ballverlust);
    return {
      level: L,
      // Passspiel: direkt → mehr Raumgewinn und lange Bälle, aber unsauberer
      cohesion:  coh,
      passMul:   L.pass * (1 - passspiel * 0.050) * (1 + coh * 0.036),
      fwd:       CFG.progress.fwd * (1 + passspiel * 0.24),
      longMul:   L.longMul * (1 + passspiel * 0.90),
      // Breite: Flügel → viele Flanken, aber weniger zentrale (=beste) Abschlüsse
      crossMul:  1 + breite * 1.10,
      wideBias:  breite * 0.55,
      // Zweikampf: aggressiv → spürbar mehr Druck und Balleroberungen,
      // dafür mehr Fouls und Karten. Muss sich lohnen, nicht nur wehtun.
      duelMul:   1 + zweikampf * 0.42,
      cardMul:   1 + zweikampf * 0.42,
      duelPressure: zweikampf * 0.06,
      // Presshöhe + Gegenpressing: wo der Ball erobert wird
      // −1 … +1: WO der Ball erobert wird. Hoch pressen = weit vorn (kurzer Weg
      // zum Tor). Tief stehen = am eigenen Strafraum (weiter Weg) — das ist der
      // Preis des Abwehrblocks und fehlte vorher komplett.
      pressShift: presshoehe * 0.60 + ballverlust * 0.40,
      pressGain: Math.max(0, CFG.pressGain * (1 + presshoehe * 0.60 + ballverlust * 0.40) * (1 + coh * 0.24)),
      // BEIDSEITIG: hoch pressen öffnet Räume im Rücken (positiv = Gegner hat es
      // leichter), tief stehen verdichtet den eigenen Strafraum (negativ = Gegner
      // hat es schwerer). Das ist der Preis bzw. Lohn der Defensivausrichtung.
      exposure:  presshoehe * 0.34 + ballverlust * 0.22,
      // Riskantes Vorwärtsspiel wird nach Ballverlust bestraft: der Gegner kontert
      // in die offene Ordnung. Geduldiges Spiel verliert den Ball ungefährlich.
      giveaway:  passspiel * 0.28 + Math.max(0, ballgewinn) * 0.12 - coh * 0.09,
      // Ballgewinn: kontern → schneller Angriff direkt nach der Eroberung
      counter:   Math.max(0, ballgewinn),
      // Eingespielt = der letzte Pass kommt an (Automatismen im letzten Drittel)
      arrivalMul: L.arrivalMul * (1 + coh * 0.115),
      xgMul:     L.xgMul,
      // Tempo: „schnell kontern" verkürzt zusätzlich die Aktionsdauer
      actionMul: L.actionMul * (1 - Math.max(0, ballgewinn) * 0.12)
    };
  }

  // Bahnen-Nähe zur Mitte: 0 außen … 1 zentral
  function centrality(lane) { return [0.15, 0.62, 1.0, 0.62, 0.15][lane]; }

  // ── Spieler einer Zone zuordnen ────────────────────────────────────────────
  // Die Aufstellung liefert je Spieler eine relative Position (x 0..100 längs,
  // y 0..100 quer). Wir suchen den plausibelsten Ballführenden für eine Zone.
  function playerForZone(team, band, lane, rnd) {
    const tx = [8, 24, 42, 58, 76, 92][band];
    const ty = [12, 31, 50, 69, 88][lane];
    let best = null, bestD = 1e9;
    team.players.forEach(p => {
      if (p.pos === 'TW' && band > 1) return;               // Torwart nur hinten
      const d = Math.hypot((p.px - tx) * 0.85, (p.py - ty)) + rnd() * 16;
      if (d < bestD) { bestD = d; best = p; }
    });
    return best || team.players[5];
  }

  function quality(p, kind) {
    // kind: 'pass' → mid/technik, 'shot' → att, 'dribble' → pace/technik
    let v;
    if (kind === 'shot') v = p.att;
    else if (kind === 'dribble') v = (p.pace + (p.technik != null ? p.technik : p.mid)) / 2;
    else v = (p.mid + (p.technik != null ? p.technik : p.mid)) / 2;
    return 1 + (v - 70) * CFG.qualityPerPoint;
  }

  function clamp01(v) { return v < 0.02 ? 0.02 : v > 0.985 ? 0.985 : v; }

  // ── Eine Ballbesitz-Sequenz ────────────────────────────────────────────────
  function runPossession(S, atk, def, startBand, startLane) {
    const rnd = S.rnd;
    const PA = atk.P, PD = def.P;                 // aufgelöste Taktik-/Liga-Parameter
    let band = startBand, lane = startLane, sec = 0;
    let carrier = playerForZone(atk, band, lane, rnd);
    let lastPasser = null;
    const st = S.stats[atk.side];

    for (let step = 0; step < 22; step++) {
      // Druck: steigt zum gegnerischen Tor hin und mit dessen Pressing/Zweikampfhärte.
      // Wer hoch presst, lässt dafür hinten Räume offen (PD.exposure).
      const pressure = Math.min(0.95, 0.22 + band * 0.09 + def.press * 0.30
        + PD.pressGain * 0.10 + PD.duelPressure - (band >= 4 ? PD.exposure * 0.24 : 0) + rnd() * 0.18);
      const wide = (lane === 0 || lane === 4);

      // Aktionswahl
      const w = {
        pass:    1.0,
        dribble: CFG.wDribble[band] * quality(carrier, 'dribble'),
        long:    CFG.wLong[band] * PA.longMul,
        cross:   wide ? CFG.wCross[band] * PA.crossMul : 0,
        shoot:   CFG.wShoot[band] * quality(carrier, 'shot') * (0.75 + atk.risk * 0.35) * (0.5 + centrality(lane) * 0.9),
        clear:   CFG.wClear[band] * (0.5 + pressure)
      };
      let tot = 0; for (const k in w) tot += w[k];
      let r = rnd() * tot, act = 'pass';
      for (const k in w) { r -= w[k]; if (r <= 0) { act = k; break; } }

      sec += (CFG.actionSec[0] + rnd() * (CFG.actionSec[1] - CFG.actionSec[0])) * PA.actionMul;

      // ── Abschluss ──────────────────────────────────────────────────────────
      if (act === 'shoot') {
        st.shots++;
        let xg = CFG.xgBase[band] * (CFG.xgWide + (CFG.xgCentral - CFG.xgWide) * centrality(lane));
        xg *= quality(carrier, 'shot') * PA.xgMul;
        xg *= (1 - pressure * CFG.pressureHit.shotXg);
        xg = Math.max(0.006, Math.min(0.62, xg));
        st.xg += xg;
        const roll = rnd();
        if (roll < xg) {
          st.goals++; st.onTarget++;
          S.ev.push({ t: S.clock + sec, type: 'goal', side: atk.side, player: carrier, assist: lastPasser, band, lane, xg });
          return { end: 'goal', sec };
        }
        if (roll < xg + CFG.onTargetRest) {
          st.onTarget++;
          S.ev.push({ t: S.clock + sec, type: 'save', side: atk.side, player: carrier, band, lane, xg });
          return { end: 'save', sec };
        }
        const blocked = rnd() < 0.45;
        S.ev.push({ t: S.clock + sec, type: blocked ? 'blocked' : 'miss', side: atk.side, player: carrier, band, lane, xg });
        if (blocked && rnd() < CFG.cornerOnBlocked) return { end: 'corner', sec };
        return { end: 'miss', sec };
      }

      // ── Klärung ────────────────────────────────────────────────────────────
      if (act === 'clear') {
        S.ev.push({ t: S.clock + sec, type: 'clear', side: atk.side, player: carrier, band, lane });
        if (rnd() < CFG.cornerOnClear) return { end: 'concedeCorner', sec, band, lane };
        return { end: 'clear', sec, toBand: 3 };
      }

      // ── Flanke ─────────────────────────────────────────────────────────────
      if (act === 'cross') {
        st.passes++;
        const ok = rnd() < clamp01(CFG.passBase.cross * PA.passMul * quality(carrier, 'pass') * (1 - pressure * CFG.pressureHit.pass));
        S.ev.push({ t: S.clock + sec, type: 'cross', side: atk.side, player: carrier, band, lane, ok });
        if (!ok) {
          if (rnd() < CFG.cornerOnCrossFail) return { end: 'corner', sec, band, lane };
          return { end: 'turnover', sec, band, lane };
        }
        st.passAcc++;
        lastPasser = carrier;
        band = 5; lane = 2;
        carrier = playerForZone(atk, 5, 1 + Math.floor(rnd() * 3), rnd);
        continue;                                  // im Strafraum weiter (meist Abschluss)
      }

      // ── Dribbling ──────────────────────────────────────────────────────────
      if (act === 'dribble') {
        const ok = rnd() < clamp01(CFG.dribbleBase * quality(carrier, 'dribble')
          * (1 - pressure * CFG.pressureHit.dribble) / (1 + (PD.duelMul - 1) * 0.35));
        S.ev.push({ t: S.clock + sec, type: 'dribble', side: atk.side, player: carrier, band, lane, ok });
        if (!ok) {
          if (rnd() < CFG.foulPerDuel * PD.duelMul) return { end: 'foul', sec, band, lane };
          return { end: 'turnover', sec, band, lane };
        }
        if (band < 5 && rnd() < 0.75) band++;
        continue;
      }

      // ── Pass (kurz / vorwärts / lang) ──────────────────────────────────────
      const isLong = (act === 'long');
      let dBand;
      if (isLong) dBand = 2;
      else {
        const pr = rnd();
        dBand = pr < PA.fwd ? 1 : (pr < PA.fwd + CFG.progress.back ? -1 : 0);
      }
      const kind = isLong ? 'long' : (dBand > 0 ? 'forward' : 'short');
      st.passes++;
      const nBand = Math.max(0, Math.min(5, band + dBand));
      const ok = rnd() < clamp01(CFG.passBase[kind] * PA.passMul * quality(carrier, 'pass')
        * (1 - pressure * CFG.pressureHit.pass)
        * Math.min(1, CFG.arrivalPenalty[nBand] * PA.arrivalMul));
      // Bahnenwahl: „Breite" schiebt das Spiel nach außen, „zentral" in die Mitte
      const outward = rnd() < 0.5 + PA.wideBias * 0.5;
      const toEdge = lane <= 2 ? -1 : 1;
      const dir = outward ? toEdge : -toEdge;
      const nLane = Math.max(0, Math.min(4, lane + dir * (isLong ? 2 : (rnd() < 0.5 ? 0 : 1))));
      S.ev.push({ t: S.clock + sec, type: 'pass', side: atk.side, player: carrier, band, lane, toBand: nBand, toLane: nLane, kind, ok });
      if (!ok) {
        if (rnd() < CFG.foulPerDuel * PD.duelMul * 0.5) return { end: 'foul', sec, band, lane };
        return { end: 'turnover', sec, band: nBand, lane: nLane };
      }
      st.passAcc++;
      lastPasser = carrier;
      band = nBand; lane = nLane;
      carrier = playerForZone(atk, band, lane, rnd);
    }
    return { end: 'turnover', sec, band, lane };
  }

  // ── Ein komplettes Spiel ───────────────────────────────────────────────────
  function simulateMatch(home, away, opt) {
    opt = opt || {};
    const S = {
      rnd: rngFrom(opt.seed != null ? opt.seed : (Math.random() * 1e9) | 0),
      clock: 0, ev: [],
      stats: {
        home: { goals: 0, shots: 0, onTarget: 0, xg: 0, passes: 0, passAcc: 0, corners: 0, fouls: 0, yellow: 0, red: 0, poss: 0, seq: 0 },
        away: { goals: 0, shots: 0, onTarget: 0, xg: 0, passes: 0, passAcc: 0, corners: 0, fouls: 0, yellow: 0, red: 0, poss: 0, seq: 0 }
      }
    };
    const H = Object.assign({ side: 'home', risk: 0, press: 0.5 }, home);
    const A = Object.assign({ side: 'away', risk: 0, press: 0.5 }, away);
    // Heimvorteil — opt.homeAdv: 'H' (Standard), 'A' oder null (neutral, z.B. Finale).
    // Wichtig für die Anbindung: der eigene Verein wird IMMER als `home` übergeben,
    // spielt aber nicht immer zu Hause.
    const adv = (opt.homeAdv === undefined) ? 'H' : opt.homeAdv;
    if (adv === 'H') H.press = Math.min(1, H.press + 0.05);
    else if (adv === 'A') A.press = Math.min(1, A.press + 0.05);
    // Taktik + Liga-Profil in konkrete Parameter auflösen
    const level = opt.level || 'bundesliga2';
    H.P = resolveParams(H, level);
    A.P = resolveParams(A, level);

    // Stärkeverhältnis bestimmt, wer öfter in Ballbesitz startet und wo
    const hStr = H.players.reduce((s, p) => s + p.ovr, 0) / H.players.length;
    const aStr = A.players.reduce((s, p) => s + p.ovr, 0) / A.players.length;
    // Ballbesitz-Übergewicht des stärkeren Teams — bewusst gedeckelt: selbst
    // krasse Klassenunterschiede enden real bei ~65 %, nicht bei 75 %+.
    const hShare = 0.5 + Math.max(-0.15, Math.min(0.15, (hStr - aStr) * 0.0075))
      + (adv === 'H' ? 0.02 : adv === 'A' ? -0.02 : 0);

    let atk = S.rnd() < 0.5 ? H : A, def = atk === H ? A : H;
    let band = 2, lane = 2;

    while (S.clock < CFG.matchSeconds) {
      const st = S.stats[atk.side];
      st.seq++;
      const res = runPossession(S, atk, def, band, lane);
      st.poss += res.sec;
      S.clock += res.sec;

      // Foul auswerten
      if (res.end === 'foul') {
        const ds = S.stats[def.side];
        ds.fouls++;
        if (S.rnd() < CFG.yellowPerFoul * def.P.cardMul) { ds.yellow++; S.ev.push({ t: S.clock, type: 'yellow', side: def.side, band: res.band, lane: res.lane }); }
        else if (S.rnd() < CFG.redPerFoul) { ds.red++; S.ev.push({ t: S.clock, type: 'red', side: def.side, band: res.band, lane: res.lane }); }
        else S.ev.push({ t: S.clock, type: 'foul', side: def.side, band: res.band, lane: res.lane });
      }
      // Ecke ausführen — für wen? 'corner' = für den Angreifer,
      // 'concedeCorner' = geklärt ins Aus, also für den Gegner.
      const cornerFor = res.end === 'corner' ? atk : (res.end === 'concedeCorner' ? def : null);
      if (cornerFor) {
        const cs = S.stats[cornerFor.side];
        cs.corners++;
        S.ev.push({ t: S.clock, type: 'corner', side: cornerFor.side });
        cs.shots++; cs.xg += CFG.cornerXg;
        if (S.rnd() < CFG.cornerXg) {
          cs.goals++; cs.onTarget++;
          const sc = playerForZone(cornerFor, 5, 2, S.rnd);
          S.ev.push({ t: S.clock, type: 'goal', side: cornerFor.side, player: sc, band: 5, lane: 2, xg: CFG.cornerXg, setPiece: true });
        }
      }

      // Tote Zeit
      const stop = (res.end === 'goal' || res.end === 'foul' || res.end === 'corner' || res.end === 'concedeCorner' || res.end === 'miss' || res.end === 'save');
      const dr = stop ? CFG.deadSecStop : CFG.deadSecShort;
      S.clock += dr[0] + S.rnd() * (dr[1] - dr[0]);

      // Nächster Ballbesitz: wer, wo?
      if (res.end === 'goal') {
        atk = (atk === H) ? A : H; def = atk === H ? A : H; band = 2; lane = 2;
      } else if (res.end === 'corner') {
        band = 4; lane = 2;                                   // Ecke → weiter vorn
      } else if (res.end === 'concedeCorner') {
        atk = def; def = atk === H ? A : H;                   // Ecke für den Gegner
        band = 4; lane = 2;
      } else {
        // Ballwechsel; Startzone ist die gespiegelte Verlustzone
        const lostBand = res.band != null ? res.band : band;
        const lostLane = res.lane != null ? res.lane : lane;
        const loser = atk;                                    // wer den Ball verloren hat
        atk = (atk === H) ? A : H; def = atk === H ? A : H;
        band = Math.max(0, Math.min(5, 5 - lostBand));
        lane = 4 - lostLane;
        // Presshöhe/Gegenpressing: WO der neue Angreifer den Ball erobert hat.
        // Hoch pressen → weiter vorn. Tief stehen → tiefer, also weiter Weg zum Tor.
        const ps = atk.P.pressShift;
        if (ps >= 0) { if (S.rnd() < atk.press * atk.P.pressGain) band = Math.min(5, band + 1); }
        else if (S.rnd() < -ps * 0.34) band = Math.max(0, band - 1);
        // Konter: schnelle Umschaltbewegung direkt nach der Eroberung
        if (atk.P.counter > 0 && S.rnd() < atk.P.counter * 0.22) band = Math.min(5, band + 1);
        // Preis des Risikos: wer riskant nach vorn spielt, wird nach Ballverlust
        // in der offenen Ordnung erwischt; geduldiges Spiel verliert ihn harmlos.
        if (loser.P.giveaway > 0 && S.rnd() < loser.P.giveaway) band = Math.min(5, band + 1);
        else if (loser.P.giveaway < 0 && S.rnd() < -loser.P.giveaway) band = Math.max(0, band - 1);
        // PREIS DES PRESSINGS: wird es überspielt, startet der Gegner im Rücken der
        // Abwehr. Ein tiefer Block drängt ihn umgekehrt vom eigenen Tor weg.
        const ex = def.P.exposure;
        if (ex > 0 && S.rnd() < ex * 0.50) band = Math.min(5, band + 1);
        else if (ex < 0 && S.rnd() < -ex * 0.50) band = Math.max(0, band - 1);
        // Ballbesitz-Verteilung an Stärke koppeln
        const wantHome = S.rnd() < hShare;
        if (wantHome && atk !== H) { atk = H; def = A; band = Math.max(0, Math.min(5, 5 - band)); lane = 4 - lane; }
        else if (!wantHome && atk !== A) { atk = A; def = H; band = Math.max(0, Math.min(5, 5 - band)); lane = 4 - lane; }
      }
    }

    const hp = S.stats.home.poss, ap = S.stats.away.poss, tp = Math.max(1, hp + ap);
    S.stats.home.possPct = Math.round(hp / tp * 100);
    S.stats.away.possPct = 100 - S.stats.home.possPct;
    return { score: [S.stats.home.goals, S.stats.away.goals], stats: S.stats, events: S.ev };
  }

  // ── Testlauf: N Spiele, Mittelwerte gegen Realwerte ────────────────────────
  function batch(n, home, away, level) {
    const acc = {};
    const keys = ['goals', 'shots', 'onTarget', 'xg', 'passes', 'corners', 'fouls', 'yellow', 'seq'];
    keys.forEach(k => acc[k] = 0);
    let accPass = 0, accPoss = 0, gamesGoals = [];
    for (let i = 0; i < n; i++) {
      const r = simulateMatch(home, away, { seed: i + 1, level: level });
      ['home', 'away'].forEach(s => {
        keys.forEach(k => acc[k] += r.stats[s][k]);
        accPass += r.stats[s].passes ? r.stats[s].passAcc / r.stats[s].passes : 0;
      });
      accPoss += r.stats.home.possPct;
      gamesGoals.push(r.score[0] + r.score[1]);
    }
    const perTeam = {};
    keys.forEach(k => perTeam[k] = +(acc[k] / (n * 2)).toFixed(2));
    perTeam.passQuote = +(accPass / (n * 2) * 100).toFixed(1);
    perTeam.ballbesitzHeim = +(accPoss / n).toFixed(1);
    perTeam.toreProSpiel = +(gamesGoals.reduce((a, b) => a + b, 0) / n).toFixed(2);
    return perTeam;
  }

  window.MatchEngineV2 = { simulateMatch, batch, CFG, LEVELS, DEFAULT_TACTICS, resolveParams, rngFrom };
  if (typeof console !== 'undefined') console.log('[MatchEngineV2] Prototyp geladen — Ballbesitz-Ketten-Engine');
})();
