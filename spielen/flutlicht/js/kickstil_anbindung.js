/* ===== kickstil_anbindung.js =====
   KICKSTIL · ANBINDUNG  ·  v1   (2026-10-15)
   ─────────────────────────────────────────────────────────────────────────────
   Die Module aus Kickdraft (Ticker, Design) erwarten ein paar Wege, die es in
   unserem Spiel noch nicht gab. Hier stehen nur diese Brücken – die
   übernommenen Kickdraft-Dateien bleiben so nah am Original wie möglich, damit
   sie sich später mit Kickdraft abgleichen lassen.

   · „Anpfiff“ = Engine v3. Bisher startete der Knopf die alte Minuten-Engine
     (processMinute, 800 ms je Minute); Engine v3 lief nur über „Spiel
     simulieren“. Der Ticker (dfl_textspiel_patch.js) hängt sich an genau diesen
     Engine-Lauf: das Spiel wird beim Anpfiff gerechnet und gebucht, der Ticker
     erzählt es danach nach. Ist die räumliche Engine ausgeschaltet, bleibt alles
     wie bisher (Minuten-Engine).
   Lädt NACH engine_v3_adapter.js und match_simulation_patch.js, VOR
   dfl_textspiel_patch.js (der Ticker legt sich außen um diesen Anpfiff).
   ============================================================================= */
(function () {
  'use strict';

  const engineV3An = () => !!window.MatchEngineV3 &&
    !(typeof CLUB !== 'undefined' && CLUB && CLUB.settings && CLUB.settings.engineV3 === false);

  const _ko = window.handleKO;
  if (typeof _ko === 'function') {
    window.handleKO = function () {
      const g = (typeof G !== 'undefined' && G) ? G : null;
      // Nur der erste Anpfiff eines neuen Spiels; eine laufende Minuten-Engine
      // (z. B. Engine v3 ausgeschaltet) bleibt unberührt.
      if (engineV3An() && g && !g.running && !g.ended && !g.halfDone && g.min === 0 &&
          typeof window.simulateCurrentFixture === 'function') {
        return window.simulateCurrentFixture();
      }
      return _ko.apply(this, arguments);
    };
    try { handleKO = window.handleKO; } catch (e) { /* nicht global gebunden */ }
  }

  // body.ks-v3: Teile der alten Minuten-Engine im Spieltag ausblenden (Momentum, Trainer-Eingriffe,
  // zweiter Spielknopf, Live-Taktikspalte) – mit Engine v3 wird beim Anpfiff gerechnet (css/kickstil.css)
  // Seit 2026-10-15 gibt es keinen Umschalter mehr (die alte Minuten-Engine ist eine Altlast, ihre Oberfläche ist
  // ausgeblendet): Spielstände, in denen v3 abgeschaltet war, laufen wieder mit v3
  function v3Erzwingen() {
    try { if (typeof CLUB !== 'undefined' && CLUB && CLUB.settings) { if (CLUB.settings.engineV3 === false) CLUB.settings.engineV3 = true; CLUB.settings.engineV2 = false; } } catch (e) { /* ohne Verein */ }
  }
  function klasseSetzen() { v3Erzwingen(); try { if (document.body) document.body.classList.toggle('ks-v3', engineV3An()); } catch (e) { /* ohne DOM */ } }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', klasseSetzen); else klasseSetzen();
  setTimeout(klasseSetzen, 2500);      // Spielstand lädt teils erst danach
  {
    const _orig = window.applyLoadedState;
    if (typeof _orig === 'function') {
      window.applyLoadedState = function () { const r = _orig.apply(this, arguments); klasseSetzen(); return r; };
      try { applyLoadedState = window.applyLoadedState; } catch (e) { /* window reicht */ }
    }
  }
  if (typeof window.toggleEngineV3 === 'function') {
    const _t = window.toggleEngineV3;
    window.toggleEngineV3 = function () { const r = _t.apply(this, arguments); klasseSetzen(); return r; };
  }

  // ── Gegner mit echtem Kader, Formation für den Ticker ─────────────────────
  // Der Gegner war in der Engine bisher eine Kunst-Elf aus der Teamstärke mit
  // Platzhalternamen („Augsburg-10“) – im Ticker stand dann genau das. Hat der
  // Verein einen Kader in der Kartei (Bundesliga bis 3. Liga, über
  // AwayScorers.resolveAwaySquad), spielen jetzt dessen Spieler mit ihren Werten.
  // Ohne Kader (Regionalliga) bleiben die Werte der Kunst-Elf, die Spieler
  // bekommen aber feste erfundene Namen (aus dem Vereinsnamen gesät – derselbe
  // Gegner hat jede Woche dieselben Leute).
  const NACHBARN = { TW: ['TW'], IV: ['IV', 'AV', 'ZDM'], AV: ['AV', 'IV', 'AM', 'ZDM'], ZDM: ['ZDM', 'ZM', 'IV', 'AV'],
    ZM: ['ZM', 'ZDM', 'ZOM', 'AM'], AM: ['AM', 'ZM', 'FL', 'ZOM'], ZOM: ['ZOM', 'ZM', 'AM', 'ST'], OM: ['ZOM', 'ZM', 'AM', 'ST'],
    FL: ['FL', 'AM', 'ST', 'AV'], ST: ['ST', 'ZOM', 'FL'] };
  function saat(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function ovrVon(p, pos) {
    try { if (typeof computeOvrFromAreas === 'function') return Math.round(computeOvrFromAreas({ pos: pos, positions: p.positions, def: +p.def || 55, mid: +p.mid || 55, att: +p.att || 55 })); } catch (e) { /* Rückfall */ }
    return Math.round(((+p.def || 55) + (+p.mid || 55) + (+p.att || 55)) / 3);
  }
  // Formation, die buildOppTeam wählt (gleiche Regel wie oppSlots in engine_v2_adapter.js)
  const gegnerFormation = base => (base >= 74 ? '4-3-3' : base >= 62 ? '4-2-3-1' : '4-4-2');
  // Feste erfundene Namen je Verein (Kartei-Lücken, Regionalliga ohne Kader)
  function namensTopf(vereinName) {
    const s0 = saat(String(vereinName || 'Gegner')), benutzt = new Set();
    return function (i) {
      if (typeof TRANSFER_SURNAMES === 'undefined' || typeof GERMAN_FIRST === 'undefined') return null;
      let k = 0, nm;
      do { nm = TRANSFER_SURNAMES[(s0 + i * 7 + k * 13) % TRANSFER_SURNAMES.length]; k++; } while (benutzt.has(nm) && k < 40);
      benutzt.add(nm);
      return { nm, vor: GERMAN_FIRST[((s0 >>> 3) + i * 7) % GERMAN_FIRST.length], s0 };
    };
  }

  const A = window.EngineV2Adapter;
  if (A && typeof A.buildOppTeam === 'function') {
    const _opp = A.buildOppTeam;
    A.buildOppTeam = function () {
      const t = _opp.apply(this, arguments);
      try {
        const away = (typeof TEAMS !== 'undefined' && TEAMS.away) ? TEAMS.away : null;
        if (!t || !Array.isArray(t.players)) return t;
        t.formation = gegnerFormation((away && away.str) || 65);
        let kader = null;
        try { kader = window.AwayScorers && away && away._team ? AwayScorers.resolveAwaySquad(away._team) : null; } catch (e) { kader = null; }
        const echte = Array.isArray(kader) ? kader.filter(p => p && p.name && !(p.injuryWeeks > 0) && !(p.suspendedGames > 0)) : [];
        if (echte.length >= 11) {
          // Stärkste zuerst; je Platz der beste freie Spieler der Position, sonst ein verwandter
          const liste = echte.map(p => ({ p, pos: (p.positions && p.positions[0]) || p.pos || 'ZM' }))
            .map(x => Object.assign(x, { ovr: ovrVon(x.p, x.pos) })).sort((a, b) => b.ovr - a.ovr);
          const frei = new Set(liste);
          const topf = namensTopf(away && away.name);
          // Positionen mit Seite (kickstil_positionen.js): beste Gesamt-Elf nach Stärke − Positionsabzug, Seite aus der Lage (py)
          const fest = {};
          if (window.KSPos) {
            const kand = liste.map(x => ({ positions: x.p.positions || [x.pos], ovr: x.ovr }));
            KSPos.zuordnen(t.players.map(sl => sl.platz || KSPos.ausRolle(sl.pos, sl.py)), kand).forEach((j, i) => { if (j >= 0) fest[i] = liste[j]; });
          }
          t.players.forEach((slot, i) => {
            const nb = NACHBARN[slot.pos] || [slot.pos];
            let w = fest[i] && frei.has(fest[i]) ? fest[i] : null;
            if (!w) for (const pos of nb) { w = liste.find(x => frei.has(x) && ((x.p.positions || [x.pos]).some(k => pos === k || (window.KSPos && KSPos.grund(k) === pos)))); if (w) break; }
            if (!w && slot.pos !== 'TW') w = liste.find(x => frei.has(x) && x.pos !== 'TW');
            if (!w) {
              // Lücke in der Kartei (z. B. kein Torwart): Kunst-Spieler der Position mit festem Namen
              const n = topf(i);
              if (n) { slot.name = n.nm; if (slot._ref) { slot._ref.name = n.nm; slot._ref.firstName = n.vor; } }
              return;
            }
            frei.delete(w);
            const p = w.p, nm = p.name;
            const ref = { id: p.id != null ? p.id : ('kader_' + saat((away && away.name || '') + nm + (p.firstName || ''))),
              name: nm, firstName: p.firstName || '', seed: p.seed != null ? p.seed : saat(nm + (p.firstName || '') + (p.age || '')),
              age: p.age || 26, pos: slot.pos, positions: p.positions || [w.pos], ovr: w.ovr,
              def: +p.def || 55, mid: +p.mid || 55, att: +p.att || 55, pace: +p.pace || 60, mental: +p.mental || 60,
              fitness: p.fitness != null ? p.fitness : undefined };
            Object.assign(slot, { name: nm, ovr: w.ovr, att: ref.att, mid: ref.mid, def: ref.def, pace: ref.pace,
              technik: Math.round(ref.mid * 0.55 + ref.att * 0.45), _ref: ref });
          });
          t._echterKader = true;
          // Bank: die nächstbesten freien Spieler (ein Torwart höchstens), sonst baut engine_v3_adapter.js
          // eine Kopie der Startelf – mit denselben Namen („Decker für Decker“)
          const bank = [];
          let twDrin = false;
          for (const x of liste) {
            if (bank.length >= 7) break;
            if (!frei.has(x)) continue;
            if (x.pos === 'TW') { if (twDrin) continue; twDrin = true; }
            frei.delete(x);
            const p = x.p, nm = p.name;
            const ref = { id: p.id != null ? p.id : ('kader_' + saat((away && away.name || '') + nm + (p.firstName || ''))),
              name: nm, firstName: p.firstName || '', seed: p.seed != null ? p.seed : saat(nm + (p.firstName || '') + (p.age || '')),
              age: p.age || 26, pos: x.pos, positions: p.positions || [x.pos], ovr: x.ovr,
              def: +p.def || 55, mid: +p.mid || 55, att: +p.att || 55, pace: +p.pace || 60, mental: +p.mental || 60 };
            bank.push({ name: nm, num: 12 + bank.length, pos: x.pos, ovr: x.ovr, att: ref.att, mid: ref.mid, def: ref.def,
              pace: ref.pace, technik: Math.round(ref.mid * 0.55 + ref.att * 0.45), fit: 97, _ref: ref });
          }
          if (bank.length) t.bench = bank;
        } else if (typeof TRANSFER_SURNAMES !== 'undefined' && typeof GERMAN_FIRST !== 'undefined') {
          // Ohne Kader: feste Namen statt „Verein-Nummer“ – Startelf und Bank aus einem Topf, keiner doppelt
          const neuerName = namensTopf((away && away.name) || t.name);
          const s0 = saat(String((away && away.name) || t.name || 'Gegner'));
          t.players.forEach((slot, i) => {
            const n = neuerName(i);
            slot.name = n.nm;
            if (slot._ref) { slot._ref.name = n.nm; slot._ref.firstName = n.vor; }
          });
          // Bank wie bisher etwas schwächer (−4) und ausgeruht, aber mit eigenen Leuten
          t.bench = t.players.slice(1, 8).map((p, i) => {
            const n = neuerName(11 + i);
            const ref = Object.assign({}, p._ref || {}, { id: 'bank_' + s0 + '_' + i, name: n.nm, firstName: n.vor,
              seed: (s0 + 31337 * (i + 1)) % 100000, ovr: (p.ovr || 65) - 4, att: (p.att || 60) - 4, mid: (p.mid || 60) - 4, def: (p.def || 60) - 4 });
            return Object.assign({}, p, { name: n.nm, num: 12 + i, ovr: ref.ovr, att: ref.att, mid: ref.mid, def: ref.def,
              pace: (p.pace || 60) - 3, fit: 97, _ref: ref });
          });
        }
      } catch (e) { console.warn('[Kickstil-Anbindung] Gegner-Kader', e); }
      return t;
    };
  }
  if (A && typeof A.buildOwnTeam === 'function') {
    const _own = A.buildOwnTeam;
    A.buildOwnTeam = function () {
      const t = _own.apply(this, arguments);
      try { if (t && !t.formation && typeof CLUB !== 'undefined' && CLUB) t.formation = CLUB.formation || null; } catch (e) { /* nur Anzeige */ }
      return t;
    };
  }

  // ── NIVEAU-BRÜCKE: gleiche Torzahl auf allen Ligastufen ───────────────────
  // Die Engine aus Kickdraft trifft umso öfter, je stärker die Spieler sind
  // (Kickdraft spielt auf einer Stufe und gleicht über seine Formel-Brücke aus).
  // Gemessen 2026-10-15 ohne Ausgleich (Startelf-Mittel der Stärke → Tore je Spiel). Die Torzahl hängt
  // weniger an der Stärke als an der Art der Kader:
  //   Kunst-Elfen (Regionalliga: kein Kader in der Kartei, Profile aus der Teamstärke):
  //     im Spiel ≈54 → 2,20 (64 Spiele) · Zählbogen-Elfen 52 → 2,13, 58 → 1,98 (je 48) – flach
  //   Kartei-Kader (3. Liga bis Bundesliga, spezialisierte echte Spieler):
  //     3. Liga 61 → 3,04 · 2. Bundesliga 68 → 3,00 · Bundesliga 78 → 3,76 (je 54 Spiele)
  // Ziel überall rund 3 Tore. Der Faktor wirkt wie Kickdrafts opt.torFaktor nur auf den Ausgang
  // der Abschlüsse (nicht auf die Schussentscheidung) und dort genau proportional (gleiche Seeds:
  // 2,50 → 3,80 bei ×1,52). Stärkeunterschiede zwischen den Teams bleiben unberührt.
  // Stützwerte [Stärke, Faktor] = 3,0 ÷ gemessene Tore, dazwischen linear.
  // ACHTUNG: Kurze Messungen täuschen – mit 14–20 Spielen lagen die Werte bis 0,6 Tore daneben.
  const NIVEAU = { kunst: 1.38, stuetzen: [[55, 1.0], [68, 1.0], [78, 0.80], [88, 0.70]] };
  function niveauFaktor(home, away) {
    if (away && !away._echterKader) return NIVEAU.kunst;      // Gegner ohne Kartei-Kader
    const alle = [].concat((home && home.players) || [], (away && away.players) || []).filter(p => p && isFinite(p.ovr));
    if (alle.length < 14) return null;
    const L = alle.reduce((s, p) => s + p.ovr, 0) / alle.length;
    const T = NIVEAU.stuetzen;
    if (L <= T[0][0]) return T[0][1];
    for (let i = 1; i < T.length; i++) {
      if (L <= T[i][0]) { const u = (L - T[i - 1][0]) / (T[i][0] - T[i - 1][0]); return T[i - 1][1] + (T[i][1] - T[i - 1][1]) * u; }
    }
    return T[T.length - 1][1];
  }
  const E3 = window.MatchEngineV3;
  if (E3 && typeof E3.simulateMatch === 'function') {
    const _sim = E3.simulateMatch;
    E3.simulateMatch = function (home, away, opt) {
      opt = opt || {};
      if (!opt.torFaktor) {
        const f = niveauFaktor(home, away);
        if (f) opt = Object.assign({}, opt, { torFaktor: [f, f] });
      }
      return _sim.call(this, home, away, opt);
    };
    E3.niveauFaktor = niveauFaktor;
    E3.NIVEAU = NIVEAU;
  }

  // ── Doppelwoche Liga + Pokal: nach dem ersten Spiel nicht weiterschalten ──────────────────────────────────────
  // Fehler im Basisspiel (Test 2026-10-15): postMatchContinue schaltet nach JEDEM Spiel die Woche weiter. In den
  // Pokalwochen (CUP_ROUND_WEEKS, fallen auf Liga-Spieltage) lief nach dem Ligaspiel sofort die nächste Woche – das
  // Pokalspiel fiel aus, der Verein blieb formal im Pokal (fcmInCup), fcmSeasonOver wurde nie wahr und die Saison endete
  // erst mit dem Kalender (KW 52). nextWeek blockt solche Wochen schon; hier gilt dieselbe Regel nach dem Spielbericht.
  // Europapokal: hat in seinen Wochen Vorrang (ensureFixtureLoaded); danach greift diese Sperre für das Ligaspiel derselben
  // Woche. Dass kein zweites Europaspiel kommt, regelt bundle_europa.js (st.ksGespielt in fcmEuroThisWeek).
  {
    const _orig = window.postMatchContinue;
    if (typeof _orig === 'function') {
      window.postMatchContinue = function () {
        try {
          const fertig = typeof fcmSeasonOver === 'function' && fcmSeasonOver();
          const ligaOffen = !fertig && typeof seasonFullyComplete === 'function' && !seasonFullyComplete(LEAGUE) && Array.isArray(LEAGUE.matchWeeks)
            && LEAGUE.matchWeeks[LEAGUE.matchday] === LEAGUE.week && typeof fcmNextFixture === 'function' && !!fcmNextFixture(LEAGUE);
          const pokalOffen = !fertig && typeof cupDueThisWeek === 'function' && cupDueThisWeek();
          // Deadline-Day (kickstil_deadline_day.js): nach dem Spiel der Woche kommt erst der Tag, dann „Woche weiter“
          const deadlineOffen = !fertig && !!(window.KSDeadline && KSDeadline.offen());
          if (ligaOffen || pokalOffen || deadlineOffen) {
            const btn = document.getElementById('ko-btn'); if (btn) { btn.disabled = true; btn.onclick = null; }
            if (typeof resetMatchState === 'function') resetMatchState();
            if (typeof addNews === 'function') addNews('match', ligaOffen || pokalOffen ? 'Noch ein Spiel diese Woche' : 'Deadline-Day', pokalOffen
              ? 'Doppelbelastung: Diese Woche steht noch das Pokalspiel an.' : ligaOffen ? 'Diese Woche steht noch das Ligaspiel an.'
              : 'Heute schließt das Transferfenster um 18:00 Uhr – der Deadline-Day wartet.');
            if (typeof switchAppView === 'function') switchAppView('home', document.getElementById('nav-home'));
            return;
          }
        } catch (e) { console.warn('[Kickstil-Anbindung] Doppelwoche', e); }
        return _orig.apply(this, arguments);
      };
      try { postMatchContinue = window.postMatchContinue; } catch (e) { /* window reicht */ }
    }
  }

  console.log('[Kickstil-Anbindung v1] aktiv — Anpfiff rechnet mit Engine v3 (Ticker erzählt nach), Gegner mit echtem Kader, Niveau-Brücke');
})();
