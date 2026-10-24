;
;/* ── js/kickstil_anbindung.js ── */
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

;/* ── js/dfl_textspiel.js ── */
/* ═══════════════════════════════════════════════════════════════════════════
   DFL · SPIEL ALS TEXT – KERN  ·  v1   (D77, Nutzer 2026-10-10: „mit Text das Spiel beschreiben lassen und dann immer
                                       schnell simulieren“ – beide Varianten, Ergebnis sofort beim Anpfiff gebucht)
   ─────────────────────────────────────────────────────────────────────────
   Rein, ohne DOM. Macht aus der Aufzeichnung von Engine v3 (LAST_MATCH_2D: Ereignisse mit Spielerbezug, Bilder mit
   Ballbesitz) einen kompakten Spielfilm (aufbereiten) und daraus Tickerzeilen (erzaehle) und einen Fahrplan je Variante
   (fahrplan: A „Jede Minute“, B „Höhepunkte“). Gleiche Eingabe = gleiche Zeilen (Satzwahl über den Text-Seed im Film).
   Der Text ändert nichts: Ergebnis, Torschützen, Karten und Wechsel kommen nur aus den Ereignissen der Engine; die
   Verlängerung und das Elfmeterschießen der Playoffs (beim Buchen gerechnet, dfl_playoffs_patch.js) kommen als fertige
   Liste dazu (spiel.nach; Pro Bowl D158: nach.direkt = Elfmeterschießen ohne Verlängerung). Minuten wie im Adapter (engine_v3_adapter.js): 0:30 = 1., nach 90:00 Nachspielzeit 90+1'.
   Vorlage: spiel/dfl_textspiel_vorschau.html (Textkern und Export der Aufzeichnung dort 1:1 erprobt, 40 Spiele).
   API: DFLTextKern.aufbereiten(aufzeichnung, info) · .erzaehle(spiel) · .fahrplan(spiel, 'A'|'B') · .schritte(fahrplan, 'A'|'B')
        · .druck(spiel) · .verlauf(spiel) · .schuesse(spiel) · .chancen(lh, lg) · .minText(t) · .TAKT
   Prüfung: spiel/tools/dfl_pruefung.js (textspielPruefung).
   ═══════════════════════════════════════════════════════════════════════════ */
(function (wurzel) {
  'use strict';

  const SCHUSS = { goal: 1, save: 1, miss: 1, blocked: 1 };
  const minuteVon = t => (t >= 5400 ? { m: 90, nach: Math.floor((t - 5400) / 60) + 1 } : { m: Math.max(1, Math.min(90, Math.floor(t / 60) + 1)), nach: 0 });
  const minText = t => { const x = minuteVon(t); return x.nach ? `90+${x.nach}'` : `${x.m}'`; };
  const minIndex = t => Math.max(0, Math.floor(t / 60));          // 0 = 1. Minute, 90 = 90+1
  const minLabel = mi => (mi >= 90 ? `90+${mi - 89}'` : `${mi + 1}'`);
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  const gross = s => s.charAt(0).toUpperCase() + s.slice(1);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const zahl = (x, n) => Number(x || 0).toFixed(n).replace('.', ',');
  // Engine-Spieler → Eingabe-Datensatz → echter Spieler (Kader bzw. Welt)
  const tief = r => { let x = r, n = 0; while (x && x._ref && n++ < 6) x = x._ref; return x || r; };

  // Takt in Millisekunden bei 1× (Vorschau D77: A ≈ 2½ min, B ≈ 1 min je Spiel)
  const TAKT = {
    A: { minute: 1500, zeileMin: 700, tor: 1700, hz: 1400, anpfiff: 1000 },
    B: { leer: 90, zeile: 2300, tor: 1300, hz: 900, anpfiff: 1000 },
    nach: { leer: 90, trenner: 1600, elfer: 1500 }
  };

  // ══ 1. Aufzeichnung → kompakter Spielfilm ════════════════════════════════
  // Wie der Export der Vorschau: Spieler je Seite nummeriert (Startelf, Bank), Ereignisse ausgedünnt (sonst ~2.000 je
  // Spiel), Schüsse mit Besitzkette aus den Bildern, Minutenwerte (Besitz, Angriffsdrittel, xG). Anzeige: h = Heim der
  // Paarung, g = Gast; Engine-Team 0 ist immer der eigene Verein.
  const TYPEN = new Set(['goal', 'save', 'miss', 'blocked', 'kopfball', 'elfmeter', 'freistoss', 'ausfuehrung', 'ecke', 'abseits', 'foul',
    'yellow', 'red', 'gelbrot', 'wechsel', 'schwalbe', 'vorteil', 'dribble', 'tackle', 'intercept', 'twfang', 'luftduell', 'cross', 'pass', 'klaerung',
    'taktik', 'reaktion']);   // reaktion: ein Spieler reagiert auf einen Zuruf (PC-Live-Coaching, Feld text)   // taktik: Umstellung eines Trainers im Spiel (PC-Live-Coaching schreibt sie in den Ereignisstrom, Feld text)
  function aufbereiten(rec, info) {
    info = info || {};
    const L = info.L || 105, B = info.B || 68;
    const eigenHeim = info.eigenHeim !== false;
    const seiteAnz = side => ((side === 'home') === eigenHeim ? 'h' : 'g');
    const teamVon = e => (e.side === 'home' ? 0 : 1);
    const teams = rec.teams || [{}, {}];
    const ev = (rec.events || []).filter(e => e && typeof e.t === 'number').slice().sort((a, b) => a.t - b.t);
    // Spielerlisten je Engine-Team, Nummer = Platz in der Liste
    const listen = [[], []], idx = [new Map(), new Map()];
    function spielerNr(team, r) {
      if (!r) return -1;
      const d = tief(r), key = d && d.id != null ? 'id:' + d.id : 'n:' + (r.name || (d && d.name) || '?');
      if (idx[team].has(key)) return idx[team].get(key);
      let v = (d && d.firstName) || '', n = (d && d.name) || r.name || '?';
      if (!v && d === r && / /.test(n)) { const teile = n.split(' '); n = teile.pop(); v = teile.join(' '); }
      const nr = listen[team].length;
      listen[team].push({ v, n, pos: r.pos || (d && d.pos) || '' });
      idx[team].set(key, nr);
      return nr;
    }
    // Plätze 0–10 eigene Elf, 11–21 Gegner (feste Reihenfolge der Engine). Ein Wechsel überschreibt den Platz – frühere
    // Ereignisse tragen eingefrorene Kopien (match_engine_v3.js eventsEinfrieren), refAus hält den Ausgewechselten fest.
    const wechselAm = {};
    ev.forEach(e => {
      if (e.type !== 'wechsel') return;
      const sl = e.slot != null ? e.slot : (e.player && e.player._i);
      if (sl == null) return;
      (wechselAm[sl] = wechselAm[sl] || []).push({ t: e.t, aus: e.refAus || null, ein: (e.player && e.player._ref) || null });
    });
    const startVon = sl => { const T = teams[sl < 11 ? 0 : 1]; return T && T.players ? T.players[sl % 11] || null : null; };
    const amPlatz = (sl, t) => { let r = startVon(sl); for (const x of (wechselAm[sl] || [])) { if (t < x.t) return x.aus || r; r = x.ein || r; } return r; };
    const elf = [[], []];
    for (let sl = 0; sl < 22; sl++) { const r = startVon(sl); if (r) elf[sl < 11 ? 0 : 1].push(spielerNr(sl < 11 ? 0 : 1, r)); }
    [0, 1].forEach(team => ((teams[team] && teams[team].bench) || []).forEach(r => spielerNr(team, r)));
    const nrVon = (team, pl, t) => {
      if (!pl) return -1;
      if (pl._ref) return spielerNr(team, pl._ref);
      if (pl._i != null) return spielerNr(team, amPlatz(pl._i, t));
      return -1;
    };
    // Bilder: Ballführender (Platz oder −1) und Uhr je Bild
    const F = rec.frames, S = rec.stride || 53, n = F ? (rec.frameCount || 0) : 0;
    const tAt = i => F[i * S + 47];
    function kette(team, t) {
      if (!n) return { stationen: [], dauer: 0, startX: null };
      let lo = 0, hi = n - 1;
      while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (tAt(mid) <= t) lo = mid; else hi = mid - 1; }
      const stationen = []; let start = null;
      for (let i = lo; i >= 0; i--) {
        const h = F[i * S + 46], ti = tAt(i);
        if (t - ti > 40) break;
        if (h < 0) continue;
        if ((h < 11 ? 0 : 1) !== team) { start = ti; break; }
        const nr = spielerNr(team, amPlatz(h, ti));
        if (!stationen.length || stationen[stationen.length - 1].nr !== nr) stationen.push({ nr, t: ti, x: F[i * S + 44] });
      }
      stationen.reverse();
      const erst = stationen[0];
      return { stationen: stationen.map(s => s.nr), dauer: erst ? +(t - (start != null ? start : erst.t)).toFixed(1) : 0,
        startX: erst ? +(team === 0 ? erst.x : L - erst.x).toFixed(1) : null };
    }
    const out = [], letzterStandard = [null, null];
    ev.forEach(e => {
      if (!TYPEN.has(e.type)) return;
      const team = teamVon(e);
      // Tiefe = Abstand vom eigenen Tor (Team 0 spielt nach +x), Seite aus Sicht des Handelnden
      const tiefe = e.x != null ? +(team === 0 ? e.x : L - e.x).toFixed(1) : null;
      // Auswahl: Pässe nur angekommene Steilpässe in den Strafraum und lange Bälle ins letzte Drittel; Ballgewinne nur vorn
      // (Pressing) oder im eigenen Strafraum; Kopfballduelle nur in den Strafräumen; Dribblings nur Mann gegen Mann
      if (e.type === 'pass') {
        const ziel = e.tx != null ? (team === 0 ? e.tx : L - e.tx) : 0;
        if (!e.ok || !((e.kind === 'through' && ziel > 86) || (e.kind === 'long' && ziel > 76))) return;
      }
      if ((e.type === 'intercept' || e.type === 'tackle') && !(tiefe > 72 || tiefe < 20)) return;
      if (e.type === 'luftduell' && !(tiefe > 88 || tiefe < 17)) return;
      if (e.type === 'dribble' && !e.gegen) return;
      const o = { t: +e.t.toFixed(1), typ: e.type, s: seiteAnz(e.side) };
      if (e.player && e.type !== 'wechsel') o.p = nrVon(team, e.player, e.t);
      if (tiefe != null) { o.x = tiefe; o.y = e.y != null ? +(team === 0 ? e.y : B - e.y).toFixed(1) : 34; }
      if (e.assist && (!e.player || e.assist.team == null || e.assist.team === e.player.team)) o.a = nrVon(team, e.assist, e.t);
      if (e.gegen) o.g = nrVon(1 - team, e.gegen, e.t);
      if (e.xg != null) o.xg = +e.xg.toFixed(3);
      if (e.art) o.art = e.art;
      if ((e.type === 'taktik' || e.type === 'reaktion') && e.text) o.text = String(e.text).slice(0, 160);
      if (e.grund) o.grund = e.grund;
      if (e.ok != null) o.ok = e.ok ? 1 : 0;
      if (e.kind && e.type === 'pass') o.kind = e.kind;
      if (e.mauer != null) o.mauer = e.mauer ? 1 : 0;
      if (e.type === 'foul' && e.opfer != null) o.o = spielerNr(1 - team, amPlatz(e.opfer, e.t));
      if ((e.type === 'pass' || e.type === 'cross') && e.empf != null) o.e = spielerNr(e.empf < 11 ? 0 : 1, amPlatz(e.empf, e.t));
      if (e.type === 'wechsel') { o.ein = spielerNr(team, e.player && e.player._ref); o.aus = spielerNr(team, e.refAus); }
      if (e.type === 'ecke' || e.type === 'freistoss' || e.type === 'elfmeter') letzterStandard[team] = { t: e.t, typ: e.type };
      if (SCHUSS[e.type]) {
        // Geblockt: Abschluss bei e.t; Tor/Parade/daneben: der Ball fliegt (≥ 0,8 s) → Kette bis kurz davor
        const k = kette(team, e.type === 'blocked' ? e.t : e.t - 0.6);
        o.k = k.stationen.slice(-5); o.d = k.dauer; o.sx = k.startX;
        const st = letzterStandard[team];
        if (st && e.t - st.t < 25 && k.dauer <= e.t - st.t + 2) o.std = st.typ;
      }
      out.push(o);
    });
    // Kopfbälle an den Abschluss hängen
    out.forEach((o, i) => {
      if (o.typ !== 'kopfball') return;
      for (let j = i + 1; j < out.length && out[j].t - o.t < 4; j++) {
        const q = out[j];
        if (SCHUSS[q.typ] && q.s === o.s && q.p === o.p) { q.kopf = 1; break; }
      }
    });
    // Minutenwerte: Besitz (s), Ballbesitz im Angriffsdrittel (s), xG – je Anzeigeseite (0 = Heim der Paarung)
    const tEnde = n ? tAt(n - 1) : (ev.length ? ev[ev.length - 1].t : 5400);
    const maxMin = Math.max(90, Math.floor(tEnde / 60) + 1);
    const minuten = [];
    for (let m = 0; m < maxMin; m++) minuten.push([0, 0, 0, 0, 0, 0]);
    for (let i = 0; i + 1 < n; i++) {
      const o = i * S, t = F[o + 47], dt = F[(i + 1) * S + 47] - t;
      if (dt <= 0 || dt > 2) continue;
      const m = Math.min(maxMin - 1, Math.floor(t / 60)), h = F[o + 46];
      if (h < 0) continue;
      const team = h < 11 ? 0 : 1, bx = F[o + 44];
      const anz = (team === 0) === eigenHeim ? 0 : 1;
      minuten[m][anz] += dt;
      if ((team === 0 ? bx : L - bx) > L * 2 / 3) minuten[m][2 + anz] += dt;
    }
    ev.forEach(e => {
      if (!(e.type === 'goal' || e.type === 'save' || e.type === 'miss') || e.xg == null) return;
      minuten[Math.min(maxMin - 1, Math.floor(e.t / 60))][4 + (seiteAnz(e.side) === 'h' ? 0 : 1)] += e.xg;
    });
    const r1 = x => Math.round(x * 10) / 10;
    const st = s => { s = s || {};
      return { tore: s.goals || 0, schuesse: s.shots || 0, aufsTor: s.onTarget || 0, xg: +(s.xg || 0).toFixed(2), ecken: s.corners || 0, fouls: s.fouls || 0,
        gelb: s.yellow || 0, rot: s.red || 0, besitz: s.possPct != null ? s.possPct : 50, paesse: s.passes || 0,
        passQuote: Math.round((s.passAcc || 0) / Math.max(1, s.passes || 0) * 100), abseits: s.abseits || 0, elfmeter: s.elfmeter || 0 }; };
    const stats = rec.stats || {};
    const stE = st(stats.home), stG = st(stats.away);
    const anzTeam = s => ((s === 'h') === eigenHeim ? 0 : 1);
    const formE = (teams[0] && teams[0].formation) || info.formationEigen || '', formG = (teams[1] && teams[1].formation) || '';
    return {
      v: 1, seed: info.seed != null ? info.seed : hash(JSON.stringify((rec.score || []))) , eigenHeim, eigen: eigenHeim ? 'h' : 'g',
      teams: info.teams || { h: { name: 'Heim', stadt: 'Heim', spitz: 'Heim', kurz: 'HEI' }, g: { name: 'Gast', stadt: 'Gast', spitz: 'Gast', kurz: 'GAS' } },
      ergebnis: eigenHeim ? [stE.tore, stG.tore] : [stG.tore, stE.tore],
      stats: { h: eigenHeim ? stE : stG, g: eigenHeim ? stG : stE },
      spieler: { h: listen[anzTeam('h')], g: listen[anzTeam('g')] },
      elf: { h: elf[anzTeam('h')], g: elf[anzTeam('g')] },
      formation: { h: eigenHeim ? formE : formG, g: eigenHeim ? formG : formE },
      ev: out.filter(o => o.typ !== 'kopfball'),
      minuten: minuten.map(r => [r1(r[0]), r1(r[1]), r1(r[2]), r1(r[3]), +r[4].toFixed(3), +r[5].toFixed(3)]),
      ende: +(+tEnde).toFixed(1),
      ort: info.ort || null, runde: info.runde || null, lambda: info.lambda || null, nach: info.nach || null
    };
  }

  // ══ 2. Spielfilm → Tickerzeilen ══════════════════════════════════════════
  function erzaehle(spiel) {
    const T = spiel.teams, gegnerVon = s => (s === 'h' ? 'g' : 'h');
    const derby = T.h.stadt && T.h.stadt === T.g.stadt;      // München, Hamburg, Berlin: Stadt allein ist zweideutig
    // Satzwahl der Reihe nach (jede Variante einmal, bevor sich eine wiederholt); Startpunkt je Spiel verschieden
    const zaehler = {};
    function waehle(art, liste) {
      const k = zaehler[art] = (zaehler[art] || 0) + 1;
      return liste[(hash(art + spiel.seed) + k - 1) % liste.length];
    }
    // Namen: Nachname; doppelt im Spiel → Initiale; auch die doppelt → Vorname
    const nachn = {}, ini = {};
    ['h', 'g'].forEach(s => (spiel.spieler[s] || []).forEach(p => { nachn[p.n] = (nachn[p.n] || 0) + 1; const k = (p.v || '').charAt(0) + p.n; ini[k] = (ini[k] || 0) + 1; }));
    const kurzName = p => (nachn[p.n] === 1 || !p.v ? p.n : ini[p.v.charAt(0) + p.n] === 1 ? `${p.v.charAt(0)}. ${p.n}` : `${p.v} ${p.n}`);
    const spielerVon = (s, i) => (i != null && i >= 0 && spiel.spieler[s] ? spiel.spieler[s][i] : null);
    const roh = (s, i) => { const p = spielerVon(s, i); return p ? kurzName(p) : ''; };
    // Ort eines Teams als Satzsubjekt (Einzahl): Stadt, im Stadtderby der ganze Name
    const ort = s => (derby ? T[s].name : T[s].stadt);
    const name = (s, i) => { const p = spielerVon(s, i); return p ? `<b class="n-${s}">${esc(kurzName(p))}</b>` : esc(ort(s)); };
    const tw = s => (spiel.elf[s] || []).find(i => { const p = spielerVon(s, i); return p && p.pos === 'TW'; });
    const istTw = (s, i) => { const p = spielerVon(s, i); return !!(p && p.pos === 'TW'); };
    // Vereinsname im richtigen Fall: Stadt oder „die/den Spitzname“ (im Derby immer der Spitzname)
    const team = (s, fall) => {
      // Kickstil: echte Vereine tragen keinen Spitznamen im Plural („die Titans“) – immer der Kurzname in Einzahl
      if (T[s].einzahl) return esc(ort(s));
      const spitz = derby || waehle('tn' + s, [false, false, true]);
      if (!spitz) return esc(T[s].stadt);
      return (fall === 'dat' ? 'den ' : 'die ') + esc(T[s].spitz);
    };
    const distanz = e => Math.max(5, Math.round(Math.hypot(105 - e.x, 34 - e.y)));
    const flSeite = y => (y > 34 ? 'rechts' : 'links');

    const ev = spiel.ev.slice().sort((a, b) => a.t - b.t);
    const verbraucht = new Set();
    // Foul ↔ Karte/Elfmeter (gleicher Zeitpunkt)
    const karteZu = new Map(), foulZu = new Map();
    ev.forEach((e, i) => {
      if (e.typ !== 'foul') return;
      for (let j = i + 1; j < ev.length && ev[j].t - e.t < 0.2; j++) {
        const k = ev[j];
        if ((k.typ === 'yellow' || k.typ === 'red' || k.typ === 'gelbrot') && k.s === e.s && k.p === e.p) { karteZu.set(e, k); if (!foulZu.has(k)) foulZu.set(k, e); }
        if (k.typ === 'elfmeter' || k.typ === 'freistoss' || k.typ === 'vorteil') { if (!foulZu.has(k)) foulZu.set(k, e); }
      }
    });
    ev.forEach((e, i) => { if (e.typ === 'gelbrot') for (let j = i - 1; j >= 0 && e.t - ev[j].t < 0.2; j--) if (ev[j].typ === 'yellow' && ev[j].p === e.p && ev[j].s === e.s) verbraucht.add(ev[j]); });
    // Elfmeter: das Foul steht im Elfmeter-Satz
    foulZu.forEach((f, k) => { if (k.typ === 'elfmeter' && !karteZu.has(f)) verbraucht.add(f); });

    // ── Weg zum Abschluss ──
    function vorlauf(e, i) {
      const s = e.s, r = { std: null, flanke: null, pass: null, gewinn: null, abpraller: null, konter: false, stationen: [] };
      for (let j = i - 1; j >= 0 && e.t - ev[j].t < 30; j--) {
        const q = ev[j];
        if (SCHUSS[q.typ] && q.s !== s) break;
        if (q.s === s && (q.typ === 'save' || q.typ === 'blocked') && e.t - q.t < 6) { r.abpraller = q; break; }
        if (q.s === s && SCHUSS[q.typ]) break;
        if (q.s === s && q.typ === 'cross' && e.t - q.t < 4 && !r.flanke) { r.flanke = q; verbraucht.add(q); }
        if (q.s === s && q.typ === 'pass' && e.t - q.t < 5 && !r.pass) { r.pass = q; verbraucht.add(q); }
        if (q.s === s && q.typ === 'dribble' && e.t - q.t < 5) verbraucht.add(q);
        if (q.s === s && (q.typ === 'tackle' || q.typ === 'intercept') && e.t - q.t < 4 && q.p === e.p) { r.gewinn = q; verbraucht.add(q); }
        if (q.s === s && q.typ === 'ausfuehrung') verbraucht.add(q);
        if (q.s === s && (q.typ === 'ecke' || (q.typ === 'freistoss' && q.mauer)) && (e.std === q.typ || e.t - q.t < 12)) { r.std = q; break; }
      }
      r.konter = e.sx != null && e.sx < 50 && e.d > 0 && e.d <= 14 && !r.std;
      const vor = (e.k || []).filter(x => x >= 0 && x !== e.p);
      r.stationen = vor.slice(-2);
      if (e.a != null && e.a >= 0 && e.a !== e.p) r.stationen = r.stationen.filter(x => x !== e.a).slice(-1).concat([e.a]);
      return r;
    }
    // { pre, join }: join 'S' = Schütze folgt als Subjekt · 'und' = Schütze steht schon als Subjekt · 'der' = Schütze steht als Objekt
    function weg(e, v) {
      const s = e.s, S = name(s, e.p);
      if (e.art === 'elfmeter' || e.art === 'freistoss') return { pre: '', join: 'S' };
      const konter = v.konter ? waehle('konter', ['Konter! ', 'Schnell umgeschaltet: ', 'Blitzkonter! ']) : '';
      if (v.abpraller) return waehle('abpr', [{ pre: `Der Abpraller landet bei ${S}`, join: 'der' }, { pre: 'Zweiter Ball, ', join: 'S' }, { pre: `${S} setzt nach`, join: 'und' }]);
      if (v.gewinn) return { pre: konter + S + (v.gewinn.x > 80 ? waehle('gewinnV', [' erobert den Ball am Strafraum', ' luchst dem Verteidiger den Ball ab', ' presst erfolgreich']) : ' erobert den Ball'), join: 'und' };
      if (v.std && v.std.typ === 'ecke') {
        const nimmt = v.std.p != null && v.std.p >= 0 && v.std.p !== e.p ? name(s, v.std.p) : null;
        return nimmt ? { pre: waehle('ecke', [`Ecke ${nimmt}, `, `Nach der Ecke von ${nimmt}: `, `${nimmt} bringt die Ecke, `]), join: 'S' }
          : { pre: waehle('ecke0', ['Nach der Ecke ', 'Ecke, Gewühl im Strafraum – ']), join: 'S' };
      }
      if (v.std && v.std.typ === 'freistoss') return { pre: waehle('fsfl', ['Nach dem Freistoß ', 'Freistoßflanke, ']), join: 'S' };
      const st = v.stationen.map(x => name(s, x));
      if (e.kopf) {
        const fl = v.flanke && v.flanke.p != null && v.flanke.p !== e.p ? name(s, v.flanke.p) : (st.length ? st[st.length - 1] : null);
        return fl ? { pre: konter + waehle('kopfweg', [`Flanke ${fl}, `, `${fl} flankt, `, `Hereingabe ${fl}, `]), join: 'S' } : { pre: konter, join: 'S' };
      }
      if (v.pass && v.pass.kind === 'through' && st.length) {
        const z = st[st.length - 1];
        return waehle('steil', [{ pre: `${konter}Steilpass ${z}, `, join: 'S' }, { pre: `${konter}${z} schickt ${S} steil`, join: 'der' }]);
      }
      if (st.length >= 2) return waehle('weg2', [{ pre: `${konter}Über ${st[0]} und ${st[1]} kommt der Ball zu ${S}`, join: 'der' },
        { pre: `${konter}${st[0]} und ${st[1]} kombinieren sich nach vorn, `, join: 'S' }, { pre: `${konter}${st[1]} legt ab, `, join: 'S' }]);
      if (st.length === 1) return waehle('weg1', [{ pre: `${konter}${st[0]} spielt ${S} frei`, join: 'der' }, { pre: `${konter}Zuspiel ${st[0]}, `, join: 'S' },
        { pre: `${konter}${st[0]} legt quer auf ${S}`, join: 'der' }]);
      return waehle('weg0', [{ pre: `${konter}${S} setzt sich durch`, join: 'und' }, { pre: `${konter}${S} zieht in den Strafraum`, join: 'und' }, { pre: konter, join: 'S' }]);
    }
    const satz = (w, S, vp) => gross(w.join === 'S' ? `${w.pre}${S} ${vp}` : w.join === 'der' ? `${w.pre}, und der ${vp}` : `${w.pre} und ${vp}`);
    // Marke eines Tores aus dem Spielstand davor und danach
    function torMarke(s, stand, m) {
      const gS = gegnerVon(s), vorher = { h: stand.h - (s === 'h' ? 1 : 0), g: stand.g - (s === 'g' ? 1 : 0) };
      const fuehrt = stand[s] - stand[gS], vorFuehrt = vorher[s] - vorher[gS];
      if (fuehrt === 0) return 'Ausgleich';
      if (fuehrt === 1 && vorFuehrt === 0) return (stand[s] === 1 && stand[gS] === 0) ? 'Führung' : 'Wieder vorn';
      if (fuehrt === -1) return 'Anschluss';
      if (fuehrt >= 2 && m >= 75) return 'Entscheidung';
      return 'Tor';
    }

    const stand = { h: 0, g: 0 }, toreSpieler = {};
    const zeilen = [];
    function zeile(t, art, s, html, extra) { zeilen.push(Object.assign({ t, min: minText(t), mi: minIndex(t), art, s, html, prio: 1 }, extra || {})); }

    const stadtAnpfiff = spiel.ort || T.h.stadt;
    if (T.h.einzahl) {
      // Kickstil: „Anpfiff bei Werder Bremen! Bremen spielt im 4-4-2, Köln im 4-2-3-1.“
      const fh = spiel.formation.h, fg = spiel.formation.g;
      const aufst = fh && fg ? ` ${esc(ort('h'))} spielt im ${esc(fh)}, ${esc(ort('g'))} im ${esc(fg)}.` : '';
      zeile(0, 'info', null, `Anpfiff bei ${esc(T.h.name)}!${spiel.runde ? ` ${esc(spiel.runde)}.` : ''}${aufst}`, { prio: 3, mi: 0, anpfiff: true });
    } else
    zeile(0, 'info', null, `Anpfiff in ${esc(stadtAnpfiff)}!${spiel.runde === 'Pro Bowl' ? ' Pro Bowl, die Besten beider Conferences.' : spiel.runde ? ` Playoffs, ${esc(spiel.runde)}.` : ''} Die ${esc(T.h.spitz)} spielen ${esc(spiel.formation.h || '–')}, die ${esc(T.g.spitz)} ${esc(spiel.formation.g || '–')}.`,
      { prio: 3, mi: 0, anpfiff: true });

    ev.forEach((e, i) => {
      if (verbraucht.has(e)) return;
      const s = e.s, t = e.t, gS = gegnerVon(s);
      const P = e.p != null && e.p >= 0 ? name(s, e.p) : esc(ort(s));
      const lage = e.x != null ? { x: s === 'h' ? e.x : 105 - e.x, y: s === 'h' ? e.y : 68 - e.y } : null;
      switch (e.typ) {
        case 'goal': {
          const v = vorlauf(e, i);
          stand[s]++;
          const key = s + e.p; toreSpieler[key] = (toreSpieler[key] || 0) + 1;
          const nTor = toreSpieler[key], d = distanz(e), G = name(gS, tw(gS));
          let vp;
          if (e.art === 'elfmeter') vp = waehle('elfTor', ['verwandelt sicher', `schickt ${G} in die falsche Ecke`, 'trifft vom Punkt – halbhoch, unhaltbar']);
          else if (e.art === 'freistoss') vp = waehle('fsTor', [`zirkelt den Freistoß aus ${d} Metern über die Mauer ins Netz`, `trifft per direktem Freistoß aus ${d} Metern`]);
          else if (e.kopf) vp = waehle('kopfTor', ['köpft ein', 'steigt am höchsten und nickt ein', 'wuchtet den Ball per Kopf ins Netz']);
          else if (d <= 8) vp = waehle('nahTor', [`schiebt aus ${d} Metern ein`, 'muss nur noch den Fuß hinhalten', 'trifft aus kurzer Distanz', `drückt den Ball aus ${d} Metern über die Linie`]);
          else if (d >= 20) vp = waehle('fernTor', [`hält aus ${d} Metern drauf – Traumtor`, `trifft aus ${d} Metern in den Winkel`, `zieht aus ${d} Metern ab – drin`]);
          else vp = waehle('tor', [`trifft aus ${d} Metern flach ins Eck`, `vollendet aus ${d} Metern`, `bleibt cool und trifft aus ${d} Metern`, `schlenzt den Ball aus ${d} Metern ins lange Eck`, `jagt den Ball aus ${d} Metern unter die Latte`]);
          const zusatz = nTor === 3 ? 'Hattrick' : nTor === 2 ? 'Doppelpack' : nTor > 3 ? nTor + '. Tor' : '';
          zeile(t, 'tor', s, satz(weg(e, v), P, vp) + (e.art === 'elfmeter' || d >= 20 ? '!' : '.'), { prio: 5, marke: torMarke(s, stand, minuteVon(t).m), zusatz,
            stand: { h: stand.h, g: stand.g }, torschuetze: roh(s, e.p), vorlage: e.a != null && e.a >= 0 && e.a !== e.p ? roh(s, e.a) : null,
            torArt: e.art || (e.kopf ? 'kopf' : null), lage, xg: e.xg });
          break;
        }
        case 'save': case 'miss': case 'blocked': {
          const v = vorlauf(e, i);
          const d = distanz(e), grossC = (e.xg || 0) >= 0.2, G = name(gS, tw(gS));
          let txt;
          if (e.art === 'elfmeter') txt = e.typ === 'save' ? waehle('elfHalt', [`${G} hält den Elfmeter von ${P}!`, `${P} scheitert vom Punkt an ${G}!`]) : `${P} setzt den Elfmeter neben das Tor!`;
          else if (e.art === 'freistoss') txt = e.typ === 'save' ? `Freistoß ${P} aus ${d} Metern – ${G} hält.` : e.typ === 'blocked' ? `${P} schießt den Freistoß in die Mauer.` : `Freistoß ${P} aus ${d} Metern – knapp drüber.`;
          else {
            const w = weg(e, v);
            const ballSchon = /Ball/.test(w.pre);
            const verb = e.kopf ? waehle('kopfV', ['köpft', 'kommt zum Kopfball', 'setzt den Kopfball an'])
              : waehle(ballSchon ? 'schussV2' : 'schussV', ballSchon ? [`zieht aus ${d} Metern ab`, `versucht es aus ${d} Metern`, `schießt aus ${d} Metern`]
                : [`zieht aus ${d} Metern ab`, `versucht es aus ${d} Metern`, `schießt aus ${d} Metern`, `nimmt den Ball aus ${d} Metern direkt`]);
            let ende;
            if (e.typ === 'save') ende = grossC ? waehle('paradeG', [` – starke Parade von ${G}!`, ` – ${G} reißt die Arme hoch und pariert!`, ` – doch ${G} ist zur Stelle!`]) : waehle('parade', [` – ${G} hält.`, `, ${G} ist unten.`, ` – sichere Beute für ${G}.`]);
            else if (e.typ === 'miss') ende = grossC ? waehle('vorbeiG', [' – vorbei!', ' – knapp am Pfosten vorbei!', ' – drüber! Das muss ein Tor sein.', ' – am Tor vorbei. Unglaublich!']) : waehle('vorbei', [' – vorbei.', ', aber deutlich drüber.', ' – Abstoß.', ' – weit über das Tor.']);
            else ende = waehle('block', [' – geblockt.', ', doch ein Verteidiger wirft sich dazwischen.', ' – der Ball bleibt in der Abwehr hängen.']);
            const vor = grossC && w.join === 'S' && !w.pre ? waehle('chanceVor', [`Riesenchance für ${team(s, 'akk')}: `, 'Großchance! ', '']) : '';
            txt = gross(vor + satz(w, P, verb) + ende);
          }
          zeile(t, grossC ? 'chance' : 'schuss', s, txt, { prio: grossC || e.art === 'elfmeter' ? 3 : 2, lage, xg: e.xg, ergebnis: e.typ });
          break;
        }
        case 'elfmeter': {
          const f = foulZu.get(e);
          const tat = f && f.p != null && f.p >= 0 ? name(gS, f.p) : null, opf = f && f.o != null && f.o >= 0 ? name(s, f.o) : null;
          const txt = tat && opf ? waehle('elf', [`Elfmeter für ${team(s, 'akk')}! ${tat} bringt ${opf} im Strafraum zu Fall.`, `Strafstoß! ${tat} holt ${opf} im Sechzehner von den Beinen.`, `Elfmeter! ${tat} erwischt ${opf} im Strafraum.`]) : `Elfmeter für ${team(s, 'akk')}!`;
          zeile(t, 'elfmeter', s, `${txt} ${name(s, e.p)} legt sich den Ball zurecht.`, { prio: 4, lage: { x: s === 'h' ? 94 : 11, y: 34 } });
          break;
        }
        case 'yellow': case 'red': case 'gelbrot': {
          const f = foulZu.get(e);
          const opf = f && f.o != null && f.o >= 0 ? name(gS, f.o) : null;
          const grund = { taktisch: 'taktisches Foul', vonHinten: 'von hinten', notbremse: 'Notbremse', schwalbe: 'Schwalbe' }[e.grund] || (opf ? 'Foul' : '');
          let txt;
          if (e.typ === 'yellow') txt = waehle('gelb', [`Gelb für ${P}`, `${P} sieht Gelb`, `Verwarnung für ${P}`]) + (grund ? ` (${grund}${opf && e.grund !== 'schwalbe' ? ' an ' + opf : ''}).` : '.');
          else if (e.typ === 'gelbrot') txt = `Gelb-Rot! ${P} muss vom Platz – ${team(s, 'nom')} nur noch zu zehnt.`;
          else txt = `Rot für ${P}!` + (grund ? ` ${gross(grund)}${opf ? ' an ' + opf : ''} –` : '') + ` ${team(s, 'nom')} in Unterzahl.`;
          zeile(t, e.typ === 'yellow' ? 'gelb' : 'rot', s, gross(txt), { prio: e.typ === 'yellow' ? 3 : 4, lage, karte: e.typ, spieler: roh(s, e.p) });
          break;
        }
        case 'reaktion':
          zeile(t, 'reaktion', s, esc(e.text || ''), { prio: 3 });
          break;
        case 'taktik':
          zeile(t, 'taktik', s, `${esc(ort(s))} stellt um: ${esc(e.text || '')}.`, { prio: 3 });
          break;
        case 'wechsel':
          zeile(t, 'wechsel', s, waehle('wechsel', [`${esc(ort(s))} wechselt: ${name(s, e.ein)} kommt für ${name(s, e.aus)}.`, `Wechsel bei ${team(s, 'dat')}: ${name(s, e.ein)} für ${name(s, e.aus)}.`, `${name(s, e.ein)} ersetzt ${name(s, e.aus)}.`]),
            { prio: 2, ein: roh(s, e.ein), aus: roh(s, e.aus) });
          break;
        case 'ecke':
          zeile(t, 'ecke', s, gross(waehle('eckeZ', [`Ecke für ${team(s, 'akk')}.`, `${P} tritt die Ecke von ${flSeite(e.y)}.`, `Ecke für ${team(s, 'akk')}, ${P} läuft an.`, `${P} holt eine Ecke heraus.`])), { prio: 1.2, lage });
          break;
        case 'freistoss':
          if (!e.mauer) return;
          zeile(t, 'freistoss', s, distanz(e) > 30 ? waehle('fsWeit', [`Freistoß für ${team(s, 'akk')} im Halbfeld.`, `Freistoß aus dem Halbfeld für ${team(s, 'akk')}.`])
            : waehle('fs', [`Freistoß für ${team(s, 'akk')}, ${distanz(e)} Meter vor dem Tor.`, `Gefährlicher Freistoß aus ${distanz(e)} Metern für ${team(s, 'akk')}.`, `Freistoß in aussichtsreicher Position für ${team(s, 'akk')}.`]), { prio: 1.5, lage });
          break;
        case 'ausfuehrung':
          if (e.art === 'flanke') zeile(t, 'aktion', s, waehle('fsFl', [`${P} bringt den Freistoß hoch in den Strafraum.`, `${P} flankt den Freistoß vors Tor.`]), { prio: 0.8, lage });
          break;
        case 'abseits':
          zeile(t, 'abseits', s, waehle('abseits', [`Abseits: ${P} startet zu früh.`, `Die Fahne geht hoch – ${P} stand im Abseits.`, `${P} im Abseits.`, `Abseitsfalle zugeschnappt, ${P} war zu früh dran.`]), { prio: 1, lage });
          break;
        case 'foul': {
          if (karteZu.has(e)) return;
          const O = e.o != null && e.o >= 0 ? name(gS, e.o) : 'seinen Gegenspieler';
          let txt;
          if (e.art === 'notbremse') txt = `Notbremse! ${P} legt ${O} als letzter Mann.`;
          else if (e.art === 'taktisch') txt = waehle('foulT', [`Taktisches Foul: ${P} hält ${O} fest.`, `${P} stoppt den Konter mit einem Foul an ${O}.`, `${P} zieht ${O} am Trikot.`]);
          else if (e.art === 'vonHinten') txt = waehle('foulH', [`${P} geht von hinten in ${O} rein.`, `${P} kommt zu spät gegen ${O}.`, `Hartes Einsteigen von ${P} gegen ${O}.`]);
          else txt = waehle('foul', [`Foul von ${P} an ${O}.`, `${P} stoppt ${O} unsanft.`, `${P} bringt ${O} zu Fall.`, `${P} rempelt ${O} um – Freistoß.`]);
          zeile(t, 'foul', s, txt, { prio: e.art === 'notbremse' ? 2.5 : 0.9, lage });
          break;
        }
        case 'vorteil':
          zeile(t, 'aktion', s, waehle('vorteil', ['Der Schiedsrichter lässt Vorteil laufen.', 'Vorteil – es geht weiter.']), { prio: 0.6 });
          break;
        case 'schwalbe':
          zeile(t, 'gelb', s, `Schwalbe! ${P} lässt sich im Strafraum fallen.`, { prio: 2, lage });
          break;
        case 'dribble': {
          const G2 = e.g != null && e.g >= 0 ? name(gS, e.g) : 'seinen Gegenspieler';
          if (e.ok) zeile(t, 'aktion', s, waehle('drib', [`${P} lässt ${G2} stehen.`, `${P} tanzt ${G2} aus.`, `${P} geht mit Tempo an ${G2} vorbei.`, `Übersteiger von ${P}, ${G2} ist vernascht.`]), { prio: (e.x > 70 ? 1.1 : 0.7), lage });
          else zeile(t, 'aktion', gS, gross(waehle('dribX', [`${G2} stellt ${P} und erobert den Ball.`, `${P} bleibt an ${G2} hängen.`, `${G2} nimmt ${P} den Ball fair ab.`])), { prio: 0.6, lage });
          break;
        }
        case 'tackle':
          if (istTw(s, e.p)) { zeile(t, 'aktion', s, waehle('tackTw', [`${P} kommt raus und ist vor dem Stürmer am Ball.`, `${P} wirft sich in den Schuss und hat den Ball.`]), { prio: 0.7, lage }); break; }
          zeile(t, 'aktion', s, e.x > 70 ? waehle('tackV', [`${P} erobert den Ball weit in der Hälfte von ${team(gS, 'dat')}.`, `Ballgewinn ${P} am gegnerischen Strafraum.`, `${P} presst und gewinnt den Ball.`])
            : waehle('tackH', [`${P} grätscht in höchster Not dazwischen.`, `${P} klärt mit einer Grätsche im letzten Moment.`, `Starke Grätsche von ${P} im eigenen Strafraum.`]), { prio: 0.6, lage });
          break;
        case 'intercept':
          if (istTw(s, e.p)) { zeile(t, 'aktion', s, waehle('intTw', [`${P} läuft heraus und fängt den Steilpass ab.`, `${P} ist vor dem Stürmer an der Kugel.`]), { prio: 0.6, lage }); break; }
          zeile(t, 'aktion', s, e.x > 70 ? waehle('intV', [`${P} läuft den Pass ab – Pressing zahlt sich aus.`, `${P} fängt den Aufbaupass ab.`, `${P} spekuliert richtig und schnappt sich den Ball.`])
            : waehle('intH', [`${P} fängt die Hereingabe ab.`, `${P} ist mit dem Fuß dazwischen.`, `${P} unterbindet den Pass in den Strafraum.`]), { prio: 0.5, lage });
          break;
        case 'twfang':
          zeile(t, 'aktion', s, waehle('twfang', [`${P} pflückt die Flanke herunter.`, `${P} fängt den hohen Ball sicher.`, `Sicher: ${P} hat den Ball.`]), { prio: 0.6, lage });
          break;
        case 'luftduell': {
          const G2 = e.g != null && e.g >= 0 ? name(gS, e.g) : null;
          if (istTw(s, e.p)) zeile(t, 'aktion', s, waehle('luftTw', [`${P} kommt raus und faustet den Ball${G2 ? ' vor ' + G2 : ''} weg.`, `${P} ist${G2 ? ' vor ' + G2 : ''} am Ball und klärt.`]), { prio: 0.6, lage });
          else zeile(t, 'aktion', s, G2 ? waehle('luft', [`${P} gewinnt das Kopfballduell gegen ${G2}.`, `${P} ist vor ${G2} am Ball.`, `${P} setzt sich in der Luft gegen ${G2} durch.`]) : `${P} gewinnt das Kopfballduell.`, { prio: 0.6, lage });
          break;
        }
        case 'cross': {
          const E = e.e != null && e.e >= 0 && e.e !== e.p ? name(s, e.e) : null;
          if (e.ok && E) zeile(t, 'aktion', s, waehle('flanke', [`${P} flankt von ${flSeite(e.y)}, ${E} kommt an den Ball.`, `Hereingabe ${P}, ${E} nimmt sie an.`, `${P} bringt den Ball scharf rein, ${E} ist da.`]), { prio: 0.9, lage });
          else zeile(t, 'aktion', s, waehle('flankeX', [`Flanke von ${P} – zu ungenau.`, `${P} flankt, doch niemand kommt dran.`, `Die Hereingabe von ${P} segelt ins Aus.`]), { prio: 0.5, lage });
          break;
        }
        case 'pass': {
          const E = e.e != null && e.e >= 0 && e.e !== e.p ? name(s, e.e) : null;
          if (!E) return;
          zeile(t, 'aktion', s, e.kind === 'through' ? waehle('steilZ', [`Steilpass von ${P} in den Lauf von ${E}.`, `${P} schickt ${E} in die Tiefe.`, `Feiner Ball von ${P} auf ${E}.`, `${P} spielt ${E} in den Strafraum.`])
            : waehle('lang', [`Langer Ball von ${P}, ${E} nimmt ihn mit.`, `${P} schlägt den Ball weit auf ${E}.`, `Diagonalball ${P} auf ${E}.`]), { prio: 0.55, lage });
          break;
        }
        case 'klaerung':
          zeile(t, 'aktion', s, waehle('klaer', [`${P} klärt per Kopf.`, `${P} befreit mit einem Kopfball.`, `${P} haut den Ball weg.`]), { prio: 0.4, lage });
          break;
        default: break;
      }
    });

    const standBis = g => { const x = { h: 0, g: 0 }; zeilen.forEach(z => { if (z.art === 'tor' && z.t < g) x[z.s]++; }); return x; };
    const schuesseBis = g => { const x = { h: 0, g: 0 }; ev.forEach(e => { if (SCHUSS[e.typ] && e.t < g) x[e.s]++; }); return x; };
    const ende = spiel.ende || 5460;
    if (ende > 2700) {
      const hz = standBis(2700), hzS = schuesseBis(2700);
      zeile(2699.9, 'hz', null, `Halbzeit. Torschüsse ${hzS.h}:${hzS.g}.`, { prio: 4, mi: 44, stand: hz, halbzeit: true });
    }
    const end = standBis(1e9), endS = schuesseBis(1e9), st = spiel.stats || { h: {}, g: {} };
    const xg = `xG ${zahl(st.h.xg, 1)}:${zahl(st.g.xg, 1)}`;
    // Stand als Kopie: nach einer Verlängerung ändert sich „end“ noch (sonst zeigte der Trenner „Verlängerung“ den Endstand)
    // Pro Bowl (D158, nach.direkt): Elfmeterschießen gleich nach 90 Minuten, ohne Verlängerung
    if (spiel.nach && spiel.nach.art && end.h === end.g && spiel.nach.direkt) {
      zeile(ende, 'ende', null, `Nach 90 Minuten steht es ${end.h}:${end.g} – Elfmeterschießen! Torschüsse ${endS.h}:${endS.g}, ${xg}.`,
        { prio: 5, stand: { h: end.h, g: end.g }, endeVerl: true, mi: minIndex(ende) });
    } else if (spiel.nach && spiel.nach.art && end.h === end.g) {
      zeile(ende, 'ende', null, `Nach 90 Minuten steht es ${end.h}:${end.g} – es geht in die Verlängerung! Torschüsse ${endS.h}:${endS.g}, ${xg}.`,
        { prio: 5, stand: { h: end.h, g: end.g }, ende90: true, mi: minIndex(ende) });
    } else {
      zeile(ende, 'ende', null, `Abpfiff! Torschüsse ${endS.h}:${endS.g}, ${xg}.`, { prio: 5, stand: { h: end.h, g: end.g }, abpfiff: true, mi: minIndex(ende) });
    }
    zeilen.sort((a, b) => a.t - b.t || (a.anpfiff ? -1 : b.anpfiff ? 1 : 0));

    // ── Verlängerung und Elfmeterschießen (Playoffs; Tore aus der Formel, Schüsse aus dem Elfmeterschießen) ──
    const nachZeilen = [];
    let iE = null;
    if (spiel.nach && spiel.nach.art && end.h === end.g) {
      const N = spiel.nach, x = { h: end.h, g: end.g };
      (N.tore || []).slice().sort((a, b) => a.m - b.m).forEach(tor => {
        x[tor.s]++;
        const nm = tor.name ? `<b class="n-${tor.s}">${esc(tor.name)}</b>` : esc(ort(tor.s));
        const vp = waehle('verlTor', [`${nm} trifft in der Verlängerung!`, `Tor in der Verlängerung: ${nm} ist zur Stelle!`, `${nm} schlägt in der Verlängerung zu!`]);
        nachZeilen.push({ phase: 'verl', m: tor.m, min: `${tor.m}'`, art: 'tor', s: tor.s, html: gross(vp), prio: 5, marke: torMarke(tor.s, x, 90),
          zusatz: '', stand: { h: x.h, g: x.g }, torschuetze: tor.name || '', vorlage: null, torArt: 'verlaengerung' });
      });
      if (N.art === 'Elfmeterschießen' && x.h === x.g) {
        if (!N.direkt) nachZeilen.push({ phase: 'verl', m: 120, min: "120'", art: 'ende', html: `Ende der Verlängerung: ${x.h}:${x.g} – Elfmeterschießen!`, prio: 5, stand: { h: x.h, g: x.g }, endeVerl: true });
        const ie = { h: 0, g: 0 };
        (N.kicks || []).forEach((k, i) => {
          if (k.tor) ie[k.s]++;
          const nm = k.wer ? `<b class="n-${k.s}">${esc(k.wer)}</b>` : esc(ort(k.s));
          const txt = k.tor ? waehle('ieTor', [`${nm} trifft.`, `${nm} verwandelt sicher.`, `${nm} bleibt cool – drin.`])
            : waehle('ieX', [`${nm} scheitert!`, `${nm} vergibt – gehalten!`, `${nm} schießt drüber!`]);
          nachZeilen.push({ phase: 'elfer', nr: i, min: 'i. E.', art: 'elfer', s: k.s, html: txt, prio: 5, tor: !!k.tor, iE: { h: ie.h, g: ie.g }, stand: { h: x.h, g: x.g } });
        });
        iE = Array.isArray(N.elfer) ? { h: N.elfer[0], g: N.elfer[1] } : { h: ie.h, g: ie.g };
        const sieger = iE.h > iE.g ? 'h' : 'g';
        nachZeilen.push({ phase: 'elfer', min: 'i. E.', art: 'ende', html: `Entscheidung im Elfmeterschießen: ${esc(T[sieger].name)} gewinnt ${Math.max(iE.h, iE.g)}:${Math.min(iE.h, iE.g)}!`,
          prio: 5, stand: { h: x.h, g: x.g }, iE, abpfiff: true });
      } else {
        const sieger = x.h > x.g ? 'h' : x.g > x.h ? 'g' : null;
        nachZeilen.push({ phase: 'verl', m: 120, min: "120'", art: 'ende', html: `Abpfiff nach Verlängerung!${sieger ? ` ${esc(T[sieger].name)} gewinnt ${Math.max(x.h, x.g)}:${Math.min(x.h, x.g)}.` : ''}`,
          prio: 5, stand: { h: x.h, g: x.g }, abpfiff: true });
      }
      end.h = x.h; end.g = x.g;
    }
    return { zeilen, nachZeilen, stand: { h: end.h, g: end.g }, iE };
  }

  // ══ 3. Lagezeilen für ruhige Minuten (Variante A), der Reihe nach je Lage ══
  function lageMacher(spiel) {
    const T = spiel.teams, z = {};
    const derby = T.h.stadt && T.h.stadt === T.g.stadt, ort = s => esc(derby ? T[s].name : T[s].stadt);
    const w = (art, l) => { const n = z[art] = (z[art] || 0) + 1; return l[(hash(art + spiel.seed) + n - 1) % l.length]; };
    return function (mi) {
      const r = spiel.minuten[mi]; if (!r) return null;
      const [bh, bg, ah, ag] = r, summe = bh + bg;
      if (summe < 22) return { art: 'ruhe', html: w('ruhe', ['Unterbrechung, das Spiel stockt.', 'Kurze Behandlungspause.', 'Zerfahrene Minute mit vielen Unterbrechungen.', 'Einwurf, Abstoß, Einwurf – wenig Spielfluss.']) };
      const dom = ah >= ag ? 'h' : 'g', geg = dom === 'h' ? 'g' : 'h', druck = Math.max(ah, ag);
      const A = ort(dom), Bn = ort(geg);
      if (druck >= 18 && druck > 2 * Math.min(ah, ag)) return { art: 'druck', s: dom, html: w('druck' + dom, [`${A} schnürt ${Bn} hinten ein.`, `Druckphase ${A}, ${Bn} kommt kaum raus.`, `${A} spielt sich am Strafraum fest.`, `${A} drückt, ${Bn} verteidigt mit allen Mann.`]) };
      const bes = bh / summe > 0.62 ? 'h' : bg / summe > 0.62 ? 'g' : null;
      if (bes) {
        const X = ort(bes), Y = ort(bes === 'h' ? 'g' : 'h');
        return { art: 'besitz', s: bes, html: w('besitz' + bes, [`${X} lässt den Ball laufen, ${Y} wartet ab.`, `Geduldiger Aufbau von ${X}.`, `${X} hat den Ball, findet aber keine Lücke.`, `${Y} läuft hinterher.`, `${X} kontrolliert das Spiel.`]) };
      }
      if (druck < 8) return { art: 'mitte', html: w('mitte', ['Viel Betrieb im Mittelfeld.', 'Zweikämpfe im Mittelfeld, keiner setzt sich ab.', 'Ausgeglichene Phase.', 'Das Spiel wogt hin und her.', 'Abtasten im Mittelfeld.']) };
      return { art: 'zug', s: dom, html: w('zug' + dom, [`${A} sucht den Weg nach vorn.`, `${A} mit mehr Zug zum Tor.`, `Gute Minute für ${A}.`, `${A} kommt über die Flügel.`]) };
    };
  }

  // ══ 4. Fahrplan je Variante: welche Zeilen in welcher Minute ══════════════
  //   A = jede Minute (alles Wichtige + höchstens eine Szene, sonst eine Lagezeile)
  //   B = nur Höhepunkte (Tore, Großchancen, Elfmeter, Karten, Wechsel, Halbzeit, Abpfiff)
  //   Danach (Playoffs): Verlängerung Minute 91–120 (nur Tore) und Elfmeterschießen Schuss für Schuss
  function fahrplan(spiel, variante) {
    const { zeilen, nachZeilen, stand, iE } = erzaehle(spiel);
    const nMin = Math.max(1, spiel.minuten.length), lage = lageMacher(spiel);
    const proMin = Array.from({ length: nMin }, () => []);
    zeilen.forEach(z => { proMin[Math.max(0, Math.min(nMin - 1, z.mi))].push(z); });
    const plan = [];
    for (let mi = 0; mi < nMin; mi++) {
      const alle = proMin[mi];
      const fest = alle.filter(z => z.prio >= 3 || z.halbzeit || z.abpfiff || z.ende90 || z.anpfiff || (variante === 'A' && z.prio >= 2) || (variante === 'B' && z.art === 'wechsel'));
      let zeig = fest;
      if (variante === 'A') {
        if (!fest.some(z => !z.anpfiff)) {
          const rest = alle.filter(z => !fest.includes(z)).sort((a, b) => b.prio - a.prio || a.t - b.t);
          if (rest.length) zeig = fest.concat([rest[0]]);
          else { const l = lage(mi); if (l) zeig = fest.concat([{ t: mi * 60 + 30, min: minLabel(mi), mi, art: 'lage', s: l.s || null, html: l.html, prio: 0 }]); }
        }
      }
      zeig = zeig.slice().sort((a, b) => a.t - b.t || (a.anpfiff ? -1 : b.anpfiff ? 1 : 0));
      plan.push({ mi, key: 'm' + mi, min: minLabel(mi), phase: 'regulaer', zeilen: zeig });
    }
    if (nachZeilen.length) {
      const letzte = nMin - 1;
      for (let m = 91; m <= 120 && !(spiel.nach && spiel.nach.direkt); m++) {
        const z = nachZeilen.filter(x => x.phase === 'verl' && x.m === m);
        plan.push({ mi: letzte, key: 'v' + m, min: `${m}'`, phase: 'verl', zeilen: z });
      }
      nachZeilen.filter(x => x.phase === 'elfer').forEach((z, i) => plan.push({ mi: letzte, key: 'e' + i, min: 'i. E.', phase: 'elfer', zeilen: [z] }));
    }
    return { plan, stand, iE };
  }

  // ══ 5. Schritte mit Dauer (ms bei 1×) ════════════════════════════════════
  function schritte(fp, variante) {
    const plan = fp.plan || fp, v = variante === 'A' ? 'A' : 'B', out = [];
    plan.forEach(p => {
      const n = p.zeilen.length;
      if (!n) { out.push({ mi: p.mi, key: p.key, min: p.min, phase: p.phase, z: null, ms: p.phase === 'regulaer' && v === 'A' ? TAKT.A.minute : TAKT.B.leer }); return; }
      p.zeilen.forEach(z => {
        let ms = v === 'A' ? Math.max(TAKT.A.minute / n, TAKT.A.zeileMin) : TAKT.B.zeile;
        if (p.phase === 'elfer') ms = TAKT.nach.elfer;
        if (z.anpfiff) ms = TAKT[v].anpfiff;
        if (z.art === 'tor') ms += TAKT[v].tor;
        if (z.halbzeit) ms += TAKT[v].hz;
        if (z.ende90 || z.endeVerl) ms = TAKT.nach.trenner;
        if (z.abpfiff) ms = 0;
        out.push({ mi: p.mi, key: p.key, min: p.min, phase: p.phase, z, ms });
      });
    });
    return out;
  }

  // ══ 6. Zahlen für Anzeigetafel, Druckleiste und Mini-Feld ════════════════
  // Druck je Minute: Ballbesitz im letzten Drittel + xG, geglättet (+ = Heim, − = Gast)
  function druck(spiel) {
    let gl = 0;
    return spiel.minuten.map(r => { const v = Math.max(-1, Math.min(1, (r[2] - r[3]) / 12 + (r[4] - r[5]) * 2)); gl = gl * 0.35 + v * 0.65; return +gl.toFixed(3); });
  }
  // Zahlen bis einschließlich Minute i (alle Ereignisse, nicht nur gezeigte Zeilen); Gelb vor Gelb-Rot zählt nicht doppelt
  function verlauf(spiel) {
    const n = Math.max(1, spiel.minuten.length);
    const k = Array.from({ length: n }, () => ({ sch: [0, 0], ecken: [0, 0], xg: [0, 0], karten: [[], []] }));
    spiel.ev.forEach(e => {
      const mi = Math.min(n - 1, Math.floor(e.t / 60)), s = e.s === 'h' ? 0 : 1;
      if (SCHUSS[e.typ]) { k[mi].sch[s]++; if (e.typ !== 'blocked') k[mi].xg[s] += e.xg || 0; }
      if (e.typ === 'ecke') k[mi].ecken[s]++;
      if (e.typ === 'yellow' || e.typ === 'red' || e.typ === 'gelbrot') k[mi].karten[s].push(e.typ === 'yellow' ? 'gelb' : e.typ === 'red' ? 'rot' : 'gelbrot');
    });
    const kum = [];
    let a = { sch: [0, 0], ecken: [0, 0], xg: [0, 0], karten: [[], []] };
    k.forEach(x => {
      a = { sch: [a.sch[0] + x.sch[0], a.sch[1] + x.sch[1]], ecken: [a.ecken[0] + x.ecken[0], a.ecken[1] + x.ecken[1]], xg: [a.xg[0] + x.xg[0], a.xg[1] + x.xg[1]],
        karten: [a.karten[0].concat(x.karten[0]), a.karten[1].concat(x.karten[1])] };
      kum.push(a);
    });
    kum.forEach(x => { x.karten = x.karten.map(l => { let weg = l.filter(c => c === 'gelbrot').length; return l.filter(c => { if (c === 'gelb' && weg > 0) { weg--; return false; } return true; }); }); });
    return kum;
  }
  // Schüsse fürs Mini-Feld (Anzeige: Heim spielt nach rechts)
  function schuesse(spiel) {
    const n = Math.max(1, spiel.minuten.length);
    return spiel.ev.filter(e => SCHUSS[e.typ] && e.x != null).map(e => ({ mi: Math.min(n - 1, Math.floor(e.t / 60)), s: e.s, typ: e.typ, xg: e.xg || 0.05,
      x: e.s === 'h' ? e.x : 105 - e.x, y: e.s === 'h' ? e.y : 68 - e.y }));
  }
  // Siegchance aus der Torerwartung (Poisson): [Sieg Heim, Remis, Sieg Gast]
  function chancen(lh, lg) {
    const f = [1]; for (let k = 1; k <= 12; k++) f[k] = f[k - 1] * k;
    const p = (l, k) => Math.exp(-l) * Math.pow(l, k) / f[k];
    let s = 0, u = 0, n = 0;
    for (let i = 0; i <= 12; i++) for (let j = 0; j <= 12; j++) { const q = p(lh, i) * p(lg, j); if (i > j) s += q; else if (i === j) u += q; else n += q; }
    const t = s + u + n; return [s / t, u / t, n / t];
  }

  const api = { aufbereiten, erzaehle, fahrplan, schritte, druck, verlauf, schuesse, chancen, minText, minuteVon, TAKT, esc };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  wurzel.DFLTextKern = api;
  if (wurzel.console && wurzel.console.log) wurzel.console.log('[DFL-Textspiel-Kern v1] aktiv — Engine-Aufzeichnung → Tickerzeilen (Jede Minute, Höhepunkte, Verlängerung, Elfmeterschießen)');
})(typeof window !== 'undefined' ? window : this);

;/* ── js/dfl_textspiel_patch.js ── */
/* ═══════════════════════════════════════════════════════════════════════════
   DFL · SPIEL ALS TEXT  ·  v1   (D77, Nutzer 2026-10-10: „beides“ – Jede Minute und Höhepunkte – und
                                  „ja sofort, kein Cheaten erlauben“)
   ─────────────────────────────────────────────────────────────────────────
   · Anpfiff: Engine v3 rechnet das ganze Spiel und bucht es sofort wie bisher (Tabelle, Noten, Kasse, Speichern).
     Danach spielt ein Ticker das Spiel nur noch ab – Tempo, Pause, „Sofort“ oder App schließen ändern nichts.
   · Einstellung je Gerät (localStorage 'dfl-textspiel'): Jede Minute · Höhepunkte (Standard) · Aus (= sofort wie
     bisher); am Anpfiff (Spieltag) und im Mehr-Blatt. Testspiele seit 2026-10-11 auch (Nutzer: „Anpfiff zeigt sofort das Ergebnis“).
   · Ticker als Vollbild: Anzeigetafel mit Torschützen, Druckleiste, Mini-Feld mit Schüssen, Zahlen, Zeilen (neueste
     oben), Pause · 1× · 4× · Sofort. Spielbericht und Hinweise (Torprämie …) kommen erst nach dem Abpfiff.
   · Playoffs: Tore der Verlängerung und das Elfmeterschießen Schuss für Schuss (DFLPlayoffs.nachspiel).
   · Neustart mitten im Ticker: das Spiel ist schon gebucht und gespeichert; der Ticker geht an derselben Stelle weiter
     (Paket im localStorage, nur wenn der geladene Spielstand die Buchung enthält). Nichts lässt sich neu würfeln.
   · Nebenbei: Gegner-Formation im Spieltag-Kopf nach dem Abpfiff (stand bis 2026-10-10 auf „wird analysiert…“).
   Hängt sich an: handleKO, simulateCurrentFixture (außen), MatchEngineV3.simulateMatch, PostMatchModal.show, showToast,
   postMatchContinue, resetMatchState, switchAppView. Text: dfl_textspiel.js (DFLTextKern). CSS: css/dfl_textspiel.css.
   API: DFLTextspiel.einstellung() · .setzeEinstellung(w) · .tempo() · .setzeTempo(t) (D111) · .einstellungText() · .einstellungBlatt() · .laeuft() · .offen()
        · .sofort() · .wiederaufnehmen() · .paket() · .schritte() · .ohne(fn) (fn spielt eigene Spiele ohne Ticker, z. B. D64)
        · .proBowl(daten, fertig) (D158: fertig gerechneten Pro Bowl abspielen, false = kein Ticker)
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const K = window.DFLTextKern;
  if (!K) { console.warn('[DFL-Textspiel] Kern fehlt (dfl_textspiel.js) – Patch inaktiv'); return; }

  const KEY = 'dfl-textspiel', KEY_TEMPO = 'dfl-textspiel-tempo', KEY_PAKET = 'dfl-textspiel-paket', KEY_POS = 'dfl-textspiel-pos';
  const WAHLEN = [
    { w: 'minute', titel: 'Jede Minute', icon: 'ti-list-details', sub: 'Eine Zeile je Minute · etwa 2½ Minuten' },
    { w: 'hoehepunkte', titel: 'Höhepunkte', icon: 'ti-flame', sub: 'Tore, Chancen, Karten · etwa 1 Minute' },
    { w: 'aus', titel: 'Aus', icon: 'ti-player-track-next', sub: 'Sofort zum Ergebnis' }
  ];
  const esc = K.esc;
  // Kickstil (normale Fußballwelt): kein CLUB.dfl/LEAGUE.dfl – aktiv, sobald ein Spielstand geladen ist.
  // In Kickdraft stand hier die DFL-Prüfung; Name `dfl` bleibt, damit das Modul mit Kickdraft vergleichbar bleibt.
  const dfl = () => typeof CLUB !== 'undefined' && CLUB && typeof LEAGUE !== 'undefined' && LEAGUE &&
    (!CLUB.dfl || !!CLUB.dfl.aktiv);
  // Kennung des eigenen Vereins für das Fortsetzen nach Neustart (DFL: Franchise-ID, hier der Vereinsname)
  const vereinKey = () => (CLUB.dfl && CLUB.dfl.franchiseId) || CLUB.name || 'fcm';
  const hatDom = () => typeof document !== 'undefined' && !!document.body;
  const ls = {
    lies(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    schreib(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    weg(k) { try { localStorage.removeItem(k); } catch (e) { /* ohne Speicher */ } }
  };

  // ── Einstellung je Gerät ─────────────────────────────────────────────────
  function einstellung() { const w = ls.lies(KEY); return WAHLEN.some(x => x.w === w) ? w : 'hoehepunkte'; }
  function setzeEinstellung(w) {
    ls.schreib(KEY, WAHLEN.some(x => x.w === w) ? w : 'hoehepunkte');
    try { wahlZeigen(); } catch (e) { /* nur Anzeige */ }
    return einstellung();
  }
  const einstellungText = () => (WAHLEN.find(x => x.w === einstellung()) || WAHLEN[1]).titel;
  const variante = () => (einstellung() === 'minute' ? 'A' : 'B');
  const tempo = () => (+ls.lies(KEY_TEMPO) === 4 ? 4 : 1);
  // Tempo aus Mehr → Einstellungen (dfl_app_shell.js, 2026-10-11): gilt ab dem nächsten Spiel, ein laufender Ticker zieht mit
  function setzeTempo(t) {
    const v = +t === 4 ? 4 : 1;
    ls.schreib(KEY_TEMPO, String(v));
    try { if (ui.hatSpiel() && ui.tempo !== v) { ui.tempo = v; if (ui.laeuft) { ui.stop(); ui.laeuft = true; ui.naechster(); } ui.steuerZeigen(); } } catch (e) { /* nur Anzeige */ }
    return v;
  }

  // ── Spielzustand ─────────────────────────────────────────────────────────
  const aktFixture = () => (typeof CURRENT_FIXTURE !== 'undefined' && CURRENT_FIXTURE) ? CURRENT_FIXTURE : null;
  const spielG = () => (typeof G !== 'undefined' && G) ? G : {};
  const engineAn = () => !!window.MatchEngineV3 && !(typeof CLUB !== 'undefined' && CLUB && CLUB.settings && CLUB.settings.engineV3 === false);
  // Liga-, Playoff- und Testspiele des eigenen Vereins (Testspiele seit 2026-10-11). ohne(fn): fn rechnet eigene Spiele ohne Ticker
  // (für „Simulieren bis …“, D64: dort laufen eigene Spiele sofort)
  let unterdrueckt = 0;
  // Kickstil: auch Pokal- und Europapokalspiele (DFL kannte nur Liga, Playoffs, Testspiele)
  const TICKER_TYPEN = ['liga', 'pokal', 'euro', 'friendly', 'playoff'];
  const tickerFuer = fx => !!(fx && !unterdrueckt && dfl() && engineAn() && einstellung() !== 'aus' && TICKER_TYPEN.indexOf(fx.type) >= 0);
  // Kopfzeile je Spielart (Kickstil: Pokal und Europapokal dazu)
  function kopfText(fx, eigenHeim, md) {
    const ort = eigenHeim ? 'Heim' : 'Auswärts';
    if (fx.type === 'friendly') return `Testspiel · ${ort}`;
    if (fx.type === 'pokal') return `Pokal · ${fx.roundName || 'Runde'} · ${ort}`;
    if (fx.type === 'euro') {
      const wb = ({ cl: 'Champions League', el: 'Europa League', co: 'Conference League', ecl: 'Conference League' })[String(fx.comp || '').toLowerCase()] || 'Europapokal';
      const phase = fx.euroKind === 'ko' ? (fx.round || 'K.-o.-Runde') + (fx.leg ? ` · ${fx.leg}. Spiel` : '') : 'Ligaphase';
      return `${wb} · ${phase} · ${ort}`;
    }
    return `Spieltag ${md || ''} · ${ort}`;
  }
  function ohne(fn) { unterdrueckt++; try { return fn(); } finally { unterdrueckt--; } }
  const aktiverSlot = () => (typeof ACTIVE_SLOT_ID !== 'undefined' ? ACTIVE_SLOT_ID : null);

  function teamInfo(id) {
    let f = null;
    try { f = window.DFLSpiel && DFLSpiel.franchise ? DFLSpiel.franchise(id) : null; } catch (e) { f = null; }
    if (f && f.name) {
      const teile = String(f.name).split(' ');
      return { id, name: f.name, stadt: f.city || teile[0], spitz: f.kurzname || teile.slice(1).join(' ') || f.name,
        kurz: f.kurz || f.kuerzel || teile[0].slice(0, 3).toUpperCase(), farben: (f.farben || []).slice(0, 2) };
    }
    let name = 'Gegner';
    try { name = id === 'fcm' ? CLUB.name : ((typeof TEAMS !== 'undefined' && TEAMS.away && TEAMS.away.name) || 'Gegner'); } catch (e) { /* Rückfall */ }
    const teile = String(name).split(' ');
    // Kickstil: Vereinsfarben aus club_colors.js; Kürzel wie in der Tabelle (crestInitials), Stadt = letztes Wort
    // („1. FC Köln“ → Köln, „Borussia Dortmund“ → Dortmund)
    let farben = [];
    // Farben als Hex (KSVerein rechnet die HSL-Farben unbekannter Vereine um; der Ticker prüft auf #rrggbb)
    try {
      if (window.KSVerein) { const d = KSVerein.daten(id); if (d && d.farben) farben = d.farben.slice(0, 2); }
      else if (typeof clubColors === 'function') { const c = clubColors(id); if (c && c[0]) farben = [c[0]]; }
    } catch (e) { /* ohne Farbe */ }
    // Kurzname für Sätze in Einzahl: Rechtsform und Jahreszahl weg („1. FC Köln“ → Köln, „SV Werder Bremen“ →
    // Werder Bremen, „Hannover 96“ → Hannover, „TSG 1899 Hoffenheim“ → Hoffenheim, „RB Leipzig“ → Leipzig)
    const FORM = /^(\d+\.?|FC|SV|SC|VfL|VfB|TSG|TSV|FSV|SpVgg|SG|BV|RB|SSV|SpVg|KFC|MSV|FK|AC|AS|SK|BSC|SSC|SU|TuS|TSC|VfR|SVgg)$/i;
    const woerter = teile.filter(w => !FORM.test(w) || w === 'BSC');
    while (woerter.length > 1 && /^\d+$/.test(woerter[woerter.length - 1])) woerter.pop();
    const kurzName = woerter.filter(w => !/^\d+\.?$/.test(w)).join(' ') || name;
    // Drei Buchstaben aus dem Ortsnamen (letztes Wort): „Borussia Dortmund“ → DOR, „1. FC Köln“ → KÖL
    const ortWort = kurzName.split(' ').pop();
    const kurz = ortWort.replace(/[^A-Za-zÄÖÜäöüß]/g, '').slice(0, 3).toUpperCase() || 'XXX';
    return { id, name, stadt: kurzName, spitz: kurzName, kurz, farben, einzahl: true };
  }
  function playoffStand() { try { return window.DFLPlayoffs && DFLPlayoffs.stand ? DFLPlayoffs.stand() : null; } catch (e) { return null; } }
  function playoffSpiel(fx) {
    const po = playoffStand();
    return po && Array.isArray(po.spiele) ? po.spiele.find(s => s.runde === fx.runde && (s.heim === 'fcm' || s.gast === 'fcm')) || null : null;
  }
  // Playoff-Layout (Nachtschicht 2026-10-13, Wunsch des Nutzers „Anderes Ticker layout für playoffs“): Weg durch die Runden,
  // Seeds an der Tafel, Flutlicht-Farben und goldene Tore (CSS .ts-po); Schluss langsamer (naechster)
  const PO_WEG = ['Wildcard', 'Divisional', 'Conf.-Finale', 'Finale'];
  const PB_KOPF = '<div class="ts-po-kopf"><ol class="ts-po-weg" aria-label="Weg durch die Playoffs"><li class="durch"><i class="ti ti-check" aria-hidden="true"></i>Conf.-Finale</li>' +
    '<li class="jetzt">Pro Bowl</li><li>Finale</li></ol></div>';
  function poInfo(T, kopf) {
    const po = playoffStand(); if (!po || !Array.isArray(po.spiele) || !po.setzliste) return null;
    const sp = po.spiele.find(x => x.runde === po.runde && (x.heim === 'fcm' || x.gast === 'fcm'));
    // Runde aus dem Kopf („Playoffs · Wildcard-Runde · …“): beim Abspielen ist die Runde schon gebucht und po.runde eine weiter
    // (Spieltest 2026-10-14: im Wildcard-Spiel stand „Divisional“ als laufende Runde, Wildcard schon abgehakt)
    const name = String(kopf || '').split(' · ')[1] || '', R = (window.DFLPlayoffs && DFLPlayoffs.RUNDE) || {};
    const r = +(Object.keys(R).find(k => R[k] === name) || 0) || (sp ? sp.runde : po.runde);
    const seed = id => { for (const k of Object.keys(po.setzliste)) { const i = po.setzliste[k].indexOf(id); if (i >= 0) return i + 1; } return null; };
    const weg = PO_WEG.map((n, i) => `<li class="${i + 1 < r ? 'durch' : i + 1 === r ? 'jetzt' : ''}">${i + 1 < r ? '<i class="ti ti-check" aria-hidden="true"></i>' : ''}${n}</li>`).join('');
    return { runde: r, seedH: seed(T.h.id), seedG: seed(T.g.id),
      html: `<div class="ts-po-kopf"><ol class="ts-po-weg" aria-label="Weg durch die Playoffs">${weg}</ol></div>` };
  }
  // Verlängerung/Elfmeterschießen des eben gebuchten Playoff-Spiels, in Anzeigeseiten (h = Heim der Paarung)
  function nachspielDaten(fx, eigenHeim) {
    if (!fx || fx.type !== 'playoff' || !window.DFLPlayoffs || typeof DFLPlayoffs.nachspiel !== 'function') return null;
    const n = DFLPlayoffs.nachspiel();
    if (!n || !n.art || n.art === 'regulär' || (n.gegner != null && n.gegner !== fx.opponentId) || (n.runde != null && n.runde !== fx.runde)) return null;
    const seite = eigen => ((eigen === eigenHeim) ? 'h' : 'g');
    return { art: n.art, tore: (n.tore || []).map(t => ({ m: t.m, s: seite(!!t.eigen), name: t.name || '' })),
      kicks: (n.kicks || []).map(k => ({ s: seite(k.seite === 0), wer: k.wer || '', tor: !!k.tor })),
      elfer: Array.isArray(n.elfer) ? (eigenHeim ? [n.elfer[0], n.elfer[1]] : [n.elfer[1], n.elfer[0]]) : null };
  }
  const verletzteIds = () => { try { return new Set(SQUAD.filter(p => p && p.injuryWeeks > 0).map(p => p.id)); } catch (e) { return new Set(); } };
  function neuVerletzt(vorher) {
    if (!vorher) return [];
    try {
      return SQUAD.filter(p => p && p.injuryWeeks > 0 && !vorher.has(p.id))
        .map(p => ({ name: typeof displayName === 'function' ? displayName(p) : p.name, typ: p.injuryType || 'Verletzung', wochen: p.injuryWeeks }));
    } catch (e) { return []; }
  }

  // ── Paket: alles, was der Ticker braucht – gebaut NACH dem Buchen, nur Anzeige ──
  function paketBauen(fx, verletztVorher, live) {
    const rec = live ? live.rec : window.LAST_MATCH_2D;
    if (!rec || !Array.isArray(rec.events) || !fx) return null;
    const sp = fx.type === 'playoff' ? playoffSpiel(fx) : null;
    const eigenHeim = sp ? sp.heim === 'fcm' : !!fx.isHome;
    REC2D = rec.frames && rec.frameCount ? { rec, eigenHeim } : null;     // Bilder nur im Speicher, nie im Paket (zu groß)
    const eig = teamInfo('fcm'), geg = teamInfo(fx.opponentId);
    const teams = eigenHeim ? { h: eig, g: geg } : { h: geg, g: eig };
    const po = fx.type === 'playoff' ? playoffStand() : null;
    const finalort = fx.neutral && po ? po.finalort || null : null;
    let lam = null;
    try { lam = window.DFLEngine && DFLEngine.letzte ? DFLEngine.letzte() : null; } catch (e) { lam = null; }
    const lambda = lam && Array.isArray(lam.lambda) ? (eigenHeim ? [lam.lambda[0], lam.lambda[1]] : [lam.lambda[1], lam.lambda[0]]) : null;
    const E = window.MatchEngineV3 || {};
    const spiel = K.aufbereiten(rec, { eigenHeim, teams, seed: Math.floor(Math.random() * 1e9), ort: finalort || teams.h.stadt,
      runde: fx.type === 'playoff' ? (fx.roundName || null) : null, lambda, nach: nachspielDaten(fx, eigenHeim), L: E.L || 105, B: E.B || 68 });
    if (live && live.seed != null) spiel.seed = live.seed;      // PC-Live: gleiche Satzwahl in jedem Abschnitt
    // Sicherung: der Ticker zeigt genau das gebuchte Ergebnis – sonst kein Ticker (Bericht wie bisher)
    const fp = K.fahrplan(spiel, 'B'), g = spielG();
    const eigen = eigenHeim ? fp.stand.h : fp.stand.g, gegner = eigenHeim ? fp.stand.g : fp.stand.h;
    if ((!live || live.pruefen) && (eigen !== g.homeGoals || gegner !== g.awayGoals)) {
      console.warn('[DFL-Textspiel] Ticker-Stand weicht vom gebuchten Ergebnis ab – kein Ticker', fp.stand, g.homeGoals, g.awayGoals);
      return null;
    }
    const news = typeof CLUB !== 'undefined' && CLUB && Array.isArray(CLUB.news) ? CLUB.news[0] : null;
    const kopf = fx.type === 'playoff'
      ? `Playoffs · ${fx.roundName || 'Runde ' + fx.runde} · ${fx.neutral ? (finalort ? 'Finale in ' + finalort : 'neutraler Platz') : eigenHeim ? 'Heim' : 'Auswärts'}`
      : kopfText(fx, eigenHeim, fx.matchday || LEAGUE.matchday);
    return { v: 1, slot: aktiverSlot(), verein: vereinKey(), saison: LEAGUE.season, woche: LEAGUE.week, md: LEAGUE.matchday,
      newsTs: news ? news.ts : null, newsTitel: news ? news.title : null, typ: fx.type, kopf, variante: variante(), spiel,
      verletzt: neuVerletzt(verletztVorher), erzeugt: Date.now() };
  }
  function paketSpeichern(p) {
    try {
      const json = JSON.stringify(p), LZ = window.LZString;
      if (!ls.schreib(KEY_PAKET, LZ && LZ.compressToUTF16 ? 'LZ1:' + LZ.compressToUTF16(json) : json)) return false;
      ls.schreib(KEY_POS, String(ui.p === p ? ui.i : 0));
      return true;
    } catch (e) { return false; }
  }
  function paketLesen() {
    const roh = ls.lies(KEY_PAKET);
    if (!roh) return null;
    try {
      const json = roh.indexOf('LZ1:') === 0 ? (window.LZString ? LZString.decompressFromUTF16(roh.slice(4)) : null) : roh;
      return json ? JSON.parse(json) : null;
    } catch (e) { return null; }
  }
  function paketLoeschen() { ls.weg(KEY_PAKET); ls.weg(KEY_POS); }
  // Gehört das Paket zum geladenen Spielstand, und ist die Buchung darin gespeichert? (Meldung zum Spiel im Postfach)
  function passt(p) {
    if (!p || p.v !== 1 || !p.spiel || !dfl()) return false;
    if (p.typ === 'friendly') return false;                                 // Testspiel: Buchung nicht sicher erkennbar → nicht fortsetzen
    if (p.verein !== vereinKey() || p.saison !== LEAGUE.season || p.woche !== LEAGUE.week) return false;
    if (p.slot != null && aktiverSlot() != null && p.slot !== aktiverSlot()) return false;
    const g = spielG(); if (g.running) return false;
    if (p.newsTs != null) return Array.isArray(CLUB.news) && CLUB.news.some(n => n && n.ts === p.newsTs && n.title === p.newsTitel);
    return p.md === LEAGUE.matchday;
  }

  // ── Bericht und Hinweise zurückhalten, solange der Ticker läuft ──────────
  let scharf = false, halten = false, berichtWartet = false;
  const wartendeHinweise = [];
  function freigeben(ohneBericht) {
    halten = false;
    const bericht = berichtWartet && !ohneBericht;
    berichtWartet = false;
    if (bericht && window.PostMatchModal && typeof PostMatchModal.show === 'function') {
      try { PostMatchModal.show(); } catch (e) { console.warn('[DFL-Textspiel] Spielbericht', e); }
    }
    wartendeHinweise.splice(0).forEach(a => { try { window.showToast.apply(window, a); } catch (e) { /* Hinweis optional */ } });
  }
  if (window.PostMatchModal && typeof window.PostMatchModal.show === 'function') {
    const _show = window.PostMatchModal.show;
    window.PostMatchModal.show = function () {
      if (halten) { berichtWartet = true; return; }
      return _show.apply(this, arguments);
    };
  }
  if (typeof window.showToast === 'function') {
    const _toast = window.showToast;
    window.showToast = function () {
      if (halten) { wartendeHinweise.push(Array.from(arguments)); return; }
      return _toast.apply(this, arguments);
    };
  }
  // Erst der Engine-Lauf schaltet scharf: Hinweise davor („Aufstellung angepasst“) kommen sofort
  if (window.MatchEngineV3 && typeof window.MatchEngineV3.simulateMatch === 'function') {
    const _sim = window.MatchEngineV3.simulateMatch;
    window.MatchEngineV3.simulateMatch = function () {
      if (scharf) halten = true;
      return _sim.apply(this, arguments);
    };
  }

  // ── Zeichnen: Farben, Wappen, Druckleiste, Mini-Feld ──────────────────────
  const rgb = h => { const x = parseInt(String(h).slice(1), 16); return [(x >> 16) & 255, (x >> 8) & 255, x & 255]; };
  const abstand = (a, b) => { const p = rgb(a), q = rgb(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
  const hell = h => { const [r, g, b] = rgb(h).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const farbeOk = h => /^#[0-9a-f]{6}$/i.test(String(h || ''));
  // Gleiche Farbe → der Gast trägt die zweite; fast Weiß/Schwarz → Textfarbe (sonst unsichtbar auf Tag bzw. Nacht);
  // helle Farben (Gelb) für den hellen Grund abgedunkelt, Schrift darauf dunkel (Nacht hellt in CSS wieder auf)
  function farben(T) {
    const fh = farbeOk(T.h.farben && T.h.farben[0]) ? T.h.farben[0] : '#7f8c8d';
    let fg = farbeOk(T.g.farben && T.g.farben[0]) ? T.g.farben[0] : '#95a5a6';
    // Trikots v1: bei gleicher Farbe spielt der Gast im Auswärtstrikot (kickstil_trikots.js)
    if (window.KSTrikot && farbeOk(T.h.farben && T.h.farben[0]) && farbeOk(T.g.farben && T.g.farben[0])) fg = KSTrikot.gastKit(T.h, T.g).a;
    else if (abstand(fh, fg) < 70 && farbeOk(T.g.farben && T.g.farben[1])) fg = T.g.farben[1];
    const lesbar = f => {
      const l = hell(f);
      if (l < 0.03 || l > 0.85) return ['var(--text)', 'var(--bg2)'];
      return l > 0.4 ? [`color-mix(in srgb, ${f} 72%, #000)`, '#1d2b20'] : [f, '#fff'];
    };
    const h = lesbar(fh), g = lesbar(fg);
    return { th: h[0], tg: g[0], thAuf: h[1], tgAuf: g[1] };
  }
  function farbenSetzen(r, T) {
    const f = farben(T);
    r.style.setProperty('--th', f.th); r.style.setProperty('--tg', f.tg);
    r.style.setProperty('--th-auf', f.thAuf); r.style.setProperty('--tg-auf', f.tgAuf);
  }
  const wappen = (id, kl) => `<span class="lg-crest ${kl || ''}" style="${typeof crestStyle === 'function' ? crestStyle(id) : ''}" aria-hidden="true"></span>`;
  const zahl = (x, n) => Number(x || 0).toFixed(n).replace('.', ',');
  function druckSvg(werte, tore, bis, gross) {
    const n = Math.max(1, werte.length), W = n * 4, H = gross ? 64 : 40, m = H / 2, amp = m - 5;
    let s = `<svg viewBox="0 0 ${W} ${H + (gross ? 12 : 0)}" preserveAspectRatio="none" role="img" aria-label="Druck je Minute: oben Heim, unten Gast">`;
    s += `<line class="ts-null" x1="0" y1="${m}" x2="${W}" y2="${m}"/><line class="ts-hz" x1="180" y1="2" x2="180" y2="${H - 2}"/>`;
    for (let i = 0; i <= Math.min(bis, n - 1); i++) {
      const v = werte[i], h = Math.max(0.6, Math.abs(v) * amp);
      s += v >= 0 ? `<rect class="ts-bh" x="${i * 4 + 0.5}" y="${(m - h).toFixed(1)}" width="3" height="${h.toFixed(1)}" rx="1"/>` : `<rect class="ts-bg" x="${i * 4 + 0.5}" y="${m}" width="3" height="${h.toFixed(1)}" rx="1"/>`;
    }
    tore.filter(z => z.mi <= bis).forEach(z => { s += `<circle class="ts-tp ${z.s}" cx="${Math.min(n - 1, z.mi) * 4 + 2}" cy="${z.s === 'h' ? 4 : H - 4}" r="3.4"/>`; });
    if (!gross && bis >= 0 && bis < n - 1) s += `<line class="ts-jetzt" x1="${bis * 4 + 2}" y1="1" x2="${bis * 4 + 2}" y2="${H - 1}"/>`;
    if (gross) s += `<text class="ts-achse" x="1" y="${H + 10}">1'</text><text class="ts-achse" x="180" y="${H + 10}" text-anchor="middle">45'</text><text class="ts-achse" x="${W - 1}" y="${H + 10}" text-anchor="end">90'</text>`;
    return s + '</svg>';
  }
  // ── 2D-Wiedergabe im Lagebild (Nutzer 2026-10-17: „das Spiel in 2D wiedergegeben, wie in den alten Versionen“) ──
  // Die Engine zeichnet jedes Spiel Bild für Bild auf (LAST_MATCH_2D: je Bild 22 Spieler x/y, Ball 44/45, Uhr 47; Team 0 = eigener
  // Verein, spielt nach +x, kein Seitenwechsel). Zu jeder Tickerzeile laufen die Sekunden davor in ~1 s als Mini-Spiel ab.
  // Nach einem Neuladen fehlt die Aufzeichnung (nur im Speicher) – dann bleibt es beim Ball-Punkt wie bisher.
  // Nutzer 2026-10-17 (später): „die Spieler sollten aus dem Ticker noch raus – nur wo der Ball mit einer Aktion im Torraum war,
  // das war der beste Stand“ → 2D-Wiedergabe aus (Ball-Punkt und Schüsse wie vorher); Code bleibt zum Wiedereinschalten
  const ZWEI_D = false;
  let REC2D = null, ANIM2D = null;
  const RUHIG2D = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  function bild2d(R, t) {
    const S = R.stride || 53, F = R.frames;
    let lo = 0, hi = R.frameCount - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (F[mid * S + 47] <= t) lo = mid; else hi = mid - 1; }
    return lo;
  }
  function zeichne2d(el, i) {
    const R = REC2D.rec, S = R.stride || 53, F = R.frames, o = i * S, heim = REC2D.eigenHeim;
    const X = x => (heim ? x : 105 - x), Y = y => (heim ? y : 68 - y);
    let g = el.sp;
    if (!g.childNodes.length) {
      const eigen = heim ? 'h' : 'g', fremd = heim ? 'g' : 'h';
      let h = '';
      for (let k = 0; k < 22; k++) h += `<circle class="${k < 11 ? eigen : fremd}${k === 0 || k === 11 ? ' tw' : ''}" r="1.7" cx="-9" cy="-9"/>`;
      g.innerHTML = h;
    }
    const kreise = g.childNodes;
    for (let k = 0; k < 22; k++) {
      const x = F[o + 2 * k], y = F[o + 2 * k + 1], c = kreise[k];
      const weg = !(x > -6 && x < 111 && y > -6 && y < 74);                 // vom Platz gestellt oder nicht aufgezeichnet
      c.setAttribute('cx', weg ? -9 : X(x).toFixed(1)); c.setAttribute('cy', weg ? -9 : Y(y).toFixed(1));
    }
    const bx = F[o + 44], by = F[o + 45];
    if (bx === bx && by === by) el.ball.style.transform = `translate(${X(bx).toFixed(1)}px,${Y(by).toFixed(1)}px)`;
  }
  function zweiD(el, z, still) {
    if (!REC2D || !el || !el.sp || !z || z.t == null) return;
    const R = REC2D.rec, ziel = bild2d(R, z.t);
    clearInterval(ANIM2D); ANIM2D = null;
    el.root2d.classList.add('ts-2d');
    if (still || RUHIG2D()) { zeichne2d(el, ziel); return; }
    let i = bild2d(R, Math.max(0, z.t - 6));
    const schritt = Math.max(1, Math.ceil((ziel - i) / 24));            // ~24 Bilder je Szene, je 45 ms ≈ 1,1 s
    zeichne2d(el, i);
    ANIM2D = setInterval(() => {
      i = Math.min(ziel, i + schritt);
      try { zeichne2d(el, i); } catch (e) { clearInterval(ANIM2D); }
      if (i >= ziel) { clearInterval(ANIM2D); ANIM2D = null; }
    }, 45);
  }
  function feldSvg(T) {
    let streifen = '';
    for (let i = 0; i < 10; i++) streifen += `<rect class="${i % 2 ? 'ts-rb' : 'ts-ra'}" x="${i * 10.5}" y="0" width="10.5" height="68"/>`;
    return `<svg class="ts-feld" viewBox="-3 -3 111 74" role="img" aria-label="Spielfeld: Schüsse und Ball, ${esc(T.h.kurz)} spielt nach rechts">
      <rect x="-3" y="-3" width="111" height="74" class="ts-ra"/>${streifen}
      <g class="ts-linien"><rect x="0" y="0" width="105" height="68"/><line x1="52.5" y1="0" x2="52.5" y2="68"/><circle cx="52.5" cy="34" r="9.15"/>
      <rect x="0" y="13.84" width="16.5" height="40.32"/><rect x="0" y="24.84" width="5.5" height="18.32"/><rect x="88.5" y="13.84" width="16.5" height="40.32"/><rect x="88.5" y="24.84" width="5.5" height="18.32"/>
      <rect x="-2" y="30.34" width="2" height="7.32"/><rect x="105" y="30.34" width="2" height="7.32"/></g>
      <text class="ts-rtg" x="3" y="7">${esc(T.h.kurz)} ▸</text><text class="ts-rtg" x="102" y="7" text-anchor="end">◂ ${esc(T.g.kurz)}</text>
      <g class="ts-schuesse"></g><g class="ts-sp" aria-hidden="true"></g><circle class="ts-ballp" r="1.9" cx="0" cy="0" style="transform:translate(52.5px,34px)"/></svg>`;
  }
  const ICON = { taktik: 'ti-clipboard-list', reaktion: 'ti-message-circle', chance: 'ti-target-arrow', schuss: 'ti-target', elfmeter: 'ti-target-arrow', ecke: 'ti-flag', abseits: 'ti-flag-3', freistoss: 'ti-wall',
    foul: 'ti-alert-triangle', lage: 'ti-chart-line', info: 'ti-clock', wechsel: 'ti-arrows-exchange', verletzt: 'ti-ambulance' };
  function zeileHtml(z) {
    if (z.art === 'tor') {
      return `<div class="ts-tor-kopf"><span class="ts-ball"><i class="ti ti-ball-football" aria-hidden="true"></i></span><b>Tor</b><span class="ts-tor-stand">${z.stand.h}:${z.stand.g}</span>` +
        `<span class="ts-marken">${z.marke && z.marke !== 'Tor' ? `<span class="ts-marke">${esc(z.marke)}</span>` : ''}${z.zusatz ? `<span class="ts-marke gold">${esc(z.zusatz)}</span>` : ''}</span></div>` +
        `<p>${z.html}</p>${z.vorlage ? `<small>Vorlage ${esc(z.vorlage)}</small>` : ''}`;
    }
    if (z.art === 'gelb' || z.art === 'rot') return `<span class="ts-ic"><i class="ts-kt ${z.karte === 'gelbrot' ? 'gelbrot' : z.art}"></i></span><p>${z.html}</p>`;
    if (z.art === 'elfer') return `<span class="ts-ic"><i class="ti ${z.tor ? 'ti-circle-check' : 'ti-circle-x'}" aria-hidden="true"></i></span><p>${z.html}</p><b class="ts-ie-stand">${z.iE.h}:${z.iE.g}</b>`;
    if (z.art === 'aktion') return `<span class="ts-ic"><i class="ts-punkt"></i></span><p>${z.html}</p>`;
    return `<span class="ts-ic"><i class="ti ${ICON[z.art] || 'ti-point'}" aria-hidden="true"></i></span><p>${z.html}</p>`;
  }

  // ── Der Ticker (Vollbild) ────────────────────────────────────────────────
  const ui = {
    root: null, el: null, p: null, fp: null, st: [], i: 0, timer: null, laeuft: false, fertig: false, wieder: false,
    bloecke: {}, schussN: 0, torListe: { h: [], g: [] },
    offen() { return !!(this.root && !this.root.hidden); },
    hatSpiel() { return !!this.p; },
    dom() {
      if (this.root && this.root.parentNode) return this.root;
      const r = document.createElement('div');
      r.id = 'dfl-ts'; r.className = 'dfl-ts'; r.hidden = true;
      r.setAttribute('role', 'dialog'); r.setAttribute('aria-modal', 'true'); r.setAttribute('aria-label', 'Spiel als Text');
      r.addEventListener('click', ev => this.klick(ev));
      document.body.appendChild(r);
      this.root = r;
      return r;
    },
    zeigen() { if (!this.root) return; this.root.hidden = false; document.body.classList.add('ts-offen'); },
    verstecken() { if (this.root) this.root.hidden = true; if (hatDom()) document.body.classList.remove('ts-offen'); },
    schliessen() {
      this.stop();
      if (this.root && this.root.parentNode) this.root.parentNode.removeChild(this.root);
      this.root = null; this.el = null; this.p = null; this.fertig = false; this.wieder = false;
      if (hatDom()) document.body.classList.remove('ts-offen');
      paketLoeschen();
    },
    // Kopf und Tafel aus Spiel und Teams (vor dem Rechnen: ohne Zahlen); Playoffs mit eigenem Layout (poInfo)
    geruest(T, kopf, art) {
      // Pro Bowl (D158): Flutlicht wie die Playoffs, Weg „Conf.-Finale · Pro Bowl · Finale“, Conference-Marken statt Wappen
      const pb = !!(this.p && this.p.typ === 'probowl');
      const po = pb ? { html: PB_KOPF } : /^Playoffs/.test(kopf || '') ? poInfo(T, kopf) : null;
      this.po = !!po;
      if (this.root) { this.root.classList.toggle('ts-po', !!po); this.root.classList.toggle('ts-pb', pb); }
      const seed = n => (n ? `<small class="ts-seed">Seed ${n}</small>` : '');
      const marke = (X, kl) => X.marke || wappen(X.id, kl);
      return `<div class="ts-box">
        <header class="ts-kopf">${pb ? '<span class="ts-wappen ts-pb-stern" aria-hidden="true"><i class="ti ti-star-filled"></i></span>' : wappen('fcm', 'ts-wappen')}<span class="ts-kopf-txt"><b>${esc(pb ? 'Pro Bowl' : typeof CLUB !== 'undefined' && CLUB ? CLUB.name : '')}</b><small>${esc(kopf)}</small></span>
          <span class="ts-art"><i class="ti ti-message-dots" aria-hidden="true"></i>${esc(art)}</span></header>
        ${po ? po.html : ''}
        <div class="ts-anzeige">
          <div class="ts-team h">${marke(T.h, 'ts-wappen-k')}<b>${esc(T.h.kurz)}${po ? seed(po.seedH) : ''}</b></div>
          <div class="ts-mitte"><div class="ts-stand" aria-live="polite"><span class="ts-sh">0</span><i>:</i><span class="ts-sg">0</span></div><div class="ts-uhr">Anpfiff</div></div>
          <div class="ts-team g"><b>${esc(T.g.kurz)}${po ? seed(po.seedG) : ''}</b>${marke(T.g, 'ts-wappen-k')}</div>
          <div class="ts-tore h"></div><div class="ts-ie"></div><div class="ts-tore g"></div>
        </div>
        <div class="ts-druck"></div>
        <div class="ts-lagebild">${feldSvg(T)}<dl class="ts-live"></dl></div>
        <div class="ts-hinweis" hidden></div>
        <ol class="ts-ticker" aria-label="Ticker"></ol>
        <div class="ts-steuer"></div>
        <div class="ts-bericht" hidden></div>
      </div>`;
    },
    // Anpfiff-Moment: Overlay schon da, während die Engine rechnet (am Handy ≈ 1–2 s)
    vorbereiten(fx) {
      if (!hatDom()) return;
      const sp = fx.type === 'playoff' ? playoffSpiel(fx) : null, eigenHeim = sp ? sp.heim === 'fcm' : !!fx.isHome;
      const eig = teamInfo('fcm'), geg = teamInfo(fx.opponentId), T = eigenHeim ? { h: eig, g: geg } : { h: geg, g: eig };
      const r = this.dom();
      farbenSetzen(r, T);
      const kopf = fx.type === 'playoff' ? `Playoffs · ${fx.roundName || ''}` : kopfText(fx, eigenHeim, fx.matchday);
      r.innerHTML = this.geruest(T, kopf, einstellungText());
      r.querySelector('.ts-ticker').innerHTML = '<li class="ts-rechnet"><i class="ti ti-ball-football" aria-hidden="true"></i><b>Anpfiff …</b><small>Die Engine rechnet das Spiel.</small></li>';
      r.querySelector('.ts-druck').innerHTML = druckSvg([], [], -1);
      this.p = null; this.fertig = false;
      this.zeigen();
    },
    laden(p, opt) {
      opt = opt || {};
      if (!hatDom()) { this.p = p; return; }
      this.stop();
      const sp = p.spiel, v = p.variante === 'A' ? 'A' : 'B';
      this.p = p; this.wieder = !!opt.wieder; this.fertig = false; this.i = 0; this.bloecke = {}; this.schussN = 0; this.torListe = { h: [], g: [] };
      this.fp = K.fahrplan(sp, v); this.st = K.schritte(this.fp, v);
      this.druckW = K.druck(sp); this.kum = K.verlauf(sp); this.schuss = K.schuesse(sp);
      this.toreAlle = this.fp.plan.flatMap(x => x.zeilen).filter(z => z.art === 'tor' && z.mi != null && !z.phase);
      this.tempo = tempo();
      const r = this.dom();
      farbenSetzen(r, sp.teams);
      r.innerHTML = this.geruest(sp.teams, p.kopf || '', v === 'A' ? 'Jede Minute' : 'Höhepunkte');
      const q = s => r.querySelector(s);
      this.el = { sh: q('.ts-sh'), sg: q('.ts-sg'), stand: q('.ts-stand'), uhr: q('.ts-uhr'), toreH: q('.ts-tore.h'), toreG: q('.ts-tore.g'), ie: q('.ts-ie'),
        druck: q('.ts-druck'), schuesse: q('.ts-schuesse'), ball: q('.ts-ballp'), sp: q('.ts-sp'), root2d: q('.ts-lagebild'), live: q('.ts-live'), ticker: q('.ts-ticker'),
        steuer: q('.ts-steuer'), hinweis: q('.ts-hinweis'), bericht: q('.ts-bericht') };
      this.liveZeigen(-1);
      this.druckZeigen(-1);
      this.chanceZeigen();
      const pos = Math.max(0, Math.min(opt.pos || 0, this.st.length));
      while (this.i < pos) this.zeigeSicher(this.st[this.i++], true);
      if (pos) { const s = this.st[pos - 1]; this.druckZeigen(s.mi); this.liveZeigen(s.mi); }
      this.zeigen();
      if (this.i >= this.st.length) { this.ende(); return; }
      if (opt.wieder) {
        this.hinweis('<i class="ti ti-lock" aria-hidden="true"></i><span><b>Das Spiel ist schon gebucht.</b> Der Ticker geht hier weiter – Play oder „Sofort“.</span>');
        this.steuerZeigen();
        return;
      }
      this.weiter();
    },
    hinweis(html) { if (!this.el) return; this.el.hinweis.innerHTML = html || ''; this.el.hinweis.hidden = !html; },
    // Siegchance vor dem Spiel (Formel der Brücke) – kein Spoiler: sie steht vor dem Anpfiff fest
    chanceZeigen() {
      const sp = this.p.spiel;
      if (!sp.lambda || !this.el) return;
      const c = K.chancen(sp.lambda[0], sp.lambda[1]), T = sp.teams, pr = x => Math.round(x * 100);
      // Playoffs (Spieltest 2026-10-14): kein Remis – Weiterkommen mit Verlängerung (ein Drittel der Torerwartung) und
      // Elfmeterschießen (50 : 50), wie die Spielvorschau (DFLSimulieren.vorschauDaten → weiterkommen)
      if (this.po || this.p.typ === 'playoff') {
        // Pro Bowl (D158): bei Gleichstand gleich Elfmeterschießen (50 : 50), keine Verlängerung
        const pb = this.p.typ === 'probowl', titel = pb ? 'Siegchance' : 'Weiterkommen';
        const v = pb ? [0, 1, 0] : K.chancen(sp.lambda[0] / 3, sp.lambda[1] / 3), w = c[0] + c[1] * (v[0] + v[1] * 0.5), wh = pr(w), wg = 100 - wh;
        this.el.ticker.insertAdjacentHTML('beforeend', `<li class="ts-chance"><span class="ts-chance-titel"><i class="ti ti-target-arrow" aria-hidden="true"></i>${titel} vor dem Spiel</span>
        <span class="ts-dreier" role="img" aria-label="${titel} ${esc(T.h.kurz)} ${wh} Prozent, ${esc(T.g.kurz)} ${wg} Prozent">
          <span style="width:${(w * 100).toFixed(1)}%" class="h">${wh} %</span><span style="width:${(100 - w * 100).toFixed(1)}%" class="g">${wg} %</span></span>
        <span class="ts-dreier-l"><span>${esc(T.h.kurz)}</span><span>${esc(T.g.kurz)}</span></span></li>`);
        return;
      }
      this.el.ticker.insertAdjacentHTML('beforeend', `<li class="ts-chance"><span class="ts-chance-titel"><i class="ti ti-target-arrow" aria-hidden="true"></i>Siegchance vor dem Spiel</span>
        <span class="ts-dreier" role="img" aria-label="Sieg ${esc(T.h.kurz)} ${pr(c[0])} Prozent, Remis ${pr(c[1])} Prozent, Sieg ${esc(T.g.kurz)} ${pr(c[2])} Prozent">
          <span style="width:${(c[0] * 100).toFixed(1)}%" class="h">${pr(c[0])} %</span><span style="width:${(c[1] * 100).toFixed(1)}%" class="x">${pr(c[1])} %</span><span style="width:${(c[2] * 100).toFixed(1)}%" class="g">${pr(c[2])} %</span></span>
        <span class="ts-dreier-l"><span>${esc(T.h.kurz)}</span><span>Remis</span><span>${esc(T.g.kurz)}</span></span></li>`);
    },
    druckZeigen(mi) { if (this.el) this.el.druck.innerHTML = druckSvg(this.druckW, this.toreAlle, mi); },
    liveZeigen(mi) {
      if (!this.el) return;
      const k = mi >= 0 && this.kum[Math.min(mi, this.kum.length - 1)] || { sch: [0, 0], ecken: [0, 0], xg: [0, 0], karten: [[], []] };
      const kt = l => l.length ? `<span class="ts-karten">${l.map(c => `<i class="ts-kt ${c}"></i>`).join('')}</span>` : '0';
      this.el.live.innerHTML = `<div><dd class="h">${k.sch[0]}</dd><dt>Schüsse</dt><dd class="g">${k.sch[1]}</dd></div>
        <div><dd class="h">${zahl(k.xg[0], 1)}</dd><dt>xG</dt><dd class="g">${zahl(k.xg[1], 1)}</dd></div>
        <div><dd class="h">${k.ecken[0]}</dd><dt>Ecken</dt><dd class="g">${k.ecken[1]}</dd></div>
        <div><dd class="h">${kt(k.karten[0])}</dd><dt>Karten</dt><dd class="g">${kt(k.karten[1])}</dd></div>`;
    },
    steuerZeigen() {
      if (!this.el) return;
      const s = this.el.steuer;
      if (this.fertig) {
        s.innerHTML = `<button type="button" class="ts-knopf gruen" data-ts="bericht"><i class="ti ti-clipboard-list" aria-hidden="true"></i>Spielbericht</button>`;
        return;
      }
      s.innerHTML = `<button type="button" class="ts-rund" data-ts="pp" aria-label="${this.laeuft ? 'Pause' : 'Weiter'}"><i class="ti ${this.laeuft ? 'ti-player-pause' : 'ti-player-play'}" aria-hidden="true"></i></button>
        <div class="ts-tempo" role="group" aria-label="Tempo">
          <button type="button" data-ts="t1" aria-pressed="${this.tempo === 1}">1×</button>
          <button type="button" data-ts="t4" aria-pressed="${this.tempo === 4}">4×</button>
          <button type="button" class="ts-sofort" data-ts="sofort" aria-label="Sofort: ans Ende springen"><i class="ti ti-player-track-next" aria-hidden="true"></i>Sofort</button>
        </div>`;
    },
    klick(ev) {
      const b = ev.target.closest('[data-ts]'); if (!b) return;
      const t = b.getAttribute('data-ts');
      if (t === 'pp') { if (this.laeuft) this.pause(); else this.weiter(); }
      else if (t === 't1' || t === 't4') {
        this.tempo = t === 't4' ? 4 : 1; ls.schreib(KEY_TEMPO, String(this.tempo));
        if (this.laeuft) { this.stop(); this.laeuft = true; this.naechster(); }
        this.steuerZeigen();
      }
      else if (t === 'sofort') this.sofort();
      else if (t === 'bericht') this.zumBericht();
      else if (t === 'zumticker') { this.el.bericht.hidden = true; }
      else if (t === 'weiter') this.weiterNachBericht();
      else if (t === 'pbzu') this.proBowlZu();
    },
    weiter() {
      if (this.fertig || this.laeuft || !this.el) return;
      this.hinweis(''); this.laeuft = true;
      this.el.uhr.classList.add('live'); this.el.uhr.classList.remove('pause');
      this.steuerZeigen(); this.naechster();
    },
    pause() {
      this.stop(); this.laeuft = false;
      if (this.el) { this.el.uhr.classList.remove('live'); this.el.uhr.classList.add('pause'); }
      this.steuerZeigen();
    },
    stop() { clearTimeout(this.timer); this.timer = null; this.laeuft = false; },
    naechster() {
      if (this.live) { try { if (this.live.vorrat(this) === 'warten') return; } catch (e) { console.warn('[DFL-Textspiel] Live', e); } }
      if (this.i >= this.st.length) { this.ende(); return; }
      const s = this.st[this.i++];
      this.zeigeSicher(s, false);
      this.posMerken();
      if (this.live) { try { if (this.live.vorrat(this) === 'warten') return; } catch (e) { console.warn('[DFL-Textspiel] Live', e); } }
      if (this.i >= this.st.length) { this.ende(); return; }
      // Playoffs: ab der 90. Minute (Nachspielzeit, Verlängerung, Elfmeterschießen) langsamer
      const lang = this.po && s.mi != null && s.mi >= 90 ? 1.6 : 1;
      this.timer = setTimeout(() => this.naechster(), s.ms * lang / this.tempo);
    },
    posMerken() { if (this.p && !this.fertig) ls.schreib(KEY_POS, String(this.i)); },
    // „Sofort“: alle übrigen Zeilen ohne Pause, dann der Spielbericht
    sofort() {
      if (!this.el) { this.zumBericht(); return; }
      this.stop();
      if (this.live) { try { this.live.bisEnde(this); } catch (e) { console.warn('[DFL-Textspiel] Live', e); } }
      while (this.i < this.st.length) this.zeigeSicher(this.st[this.i++], true);
      this.el.ticker.scrollTop = 0;
      try { this.ende(); } catch (e) { console.warn('[DFL-Textspiel] Abpfiff', e); this.fertig = true; }
      this.zumBericht();
    },
    zeigeSicher(s, still) { try { this.zeige(s, still); } catch (e) { console.warn('[DFL-Textspiel] Zeile', e); } },
    ende() {
      if (this.live) { const l = this.live; this.live = null; this.stop(); try { l.buchen(this); } catch (e) { console.warn('[DFL-Textspiel] Live buchen', e); } return; }
      this.stop(); this.fertig = true;
      if (!this.el) return;
      const s = this.st[this.st.length - 1];
      this.el.uhr.classList.remove('live', 'pause');
      this.el.uhr.textContent = s && s.phase === 'elfer' ? 'i. E.' : s && s.phase === 'verl' ? 'n. V.' : 'Abpfiff';
      this.druckZeigen(this.druckW.length - 1); this.liveZeigen(this.kum.length - 1);
      this.hinweis('');
      this.steuerZeigen();
    },
    zeige(s, still) {
      const z = s.z;
      this.el.uhr.textContent = z && z.halbzeit ? 'Halbzeit' : s.min;
      if (!still) { this.druckZeigen(s.mi); this.liveZeigen(s.mi); }
      // Schüsse bis zu dieser Minute aufs Feld
      let neu = '';
      while (this.schussN < this.schuss.length && this.schuss[this.schussN].mi <= s.mi) {
        const q = this.schuss[this.schussN++], r = (1.1 + Math.sqrt(q.xg) * 3.2).toFixed(2);
        neu += `<circle class="ts-s ${q.s}${q.typ === 'goal' ? ' drin' : q.typ === 'save' ? '' : ' daneben'}" cx="${q.x.toFixed(1)}" cy="${q.y.toFixed(1)}" r="${r}"/>`;
      }
      if (neu) this.el.schuesse.insertAdjacentHTML('beforeend', neu);
      if (!z) return;
      if (z.lage) this.el.ball.style.transform = `translate(${z.lage.x.toFixed(1)}px,${z.lage.y.toFixed(1)}px)`;
      if (ZWEI_D) { try { zweiD(this.el, z, still); } catch (e) { /* ohne 2D */ } }
      this.zeileRein(z, still, s);
      if (z.art === 'tor') {
        this.el.sh.textContent = z.stand.h; this.el.sg.textContent = z.stand.g;
        const l = this.torListe[z.s], name = z.torschuetze || '–', x = l.find(q => q.n === name);
        if (x) x.m.push(z.min); else l.push({ n: name, m: [z.min] });
        const liste = l2 => l2.map(q => `<span>${esc(q.n)} ${q.m.join(', ')}</span>`).join(' · ');
        this.el.toreH.innerHTML = liste(this.torListe.h); this.el.toreG.innerHTML = liste(this.torListe.g);
        if (!still) { this.el.stand.classList.remove('tor'); void this.el.stand.offsetWidth; this.el.stand.classList.add('tor'); }
      }
      if (z.iE) this.el.ie.innerHTML = `<span>i. E. <b>${z.iE.h}:${z.iE.g}</b></span>`;
    },
    zeileRein(z, still, s) {
      const tk = this.el.ticker, nahOben = tk.scrollTop < 40;
      if (z.halbzeit || z.abpfiff || z.ende90 || z.endeVerl) {
        const li = document.createElement('li');
        li.className = 'ts-trenner' + (still ? '' : ' neu');
        const titel = z.halbzeit ? 'Halbzeit' : z.ende90 ? 'Verlängerung' : z.endeVerl ? 'Elfmeterschießen' : 'Abpfiff';
        const text = z.html.replace(/^Abpfiff! |^Halbzeit\. /, '');
        const verl = z.abpfiff && this.p.verletzt && this.p.verletzt.length
          ? `<small class="ts-verletzt"><i class="ti ti-ambulance" aria-hidden="true"></i>Nach dem Spiel verletzt: ${this.p.verletzt.map(v => `${esc(v.name)} (${esc(v.typ)}, ${v.wochen} ${v.wochen === 1 ? 'Woche' : 'Wochen'})`).join(', ')}</small>` : '';
        li.innerHTML = `<i class="ti ${z.abpfiff ? 'ti-flag' : z.endeVerl ? 'ti-target-arrow' : 'ti-clock'}" aria-hidden="true"></i><div><b>${titel}</b><small>${text}</small>${verl}</div>` +
          `<span class="ts-tr-stand">${z.stand.h}:${z.stand.g}${z.iE ? `<small>i. E. ${z.iE.h}:${z.iE.g}</small>` : ''}</span>`;
        tk.prepend(li);
      } else {
        let blk = this.bloecke[s.key];
        if (!blk || blk !== tk.firstElementChild) {
          blk = document.createElement('li'); blk.className = 'ts-blk';
          blk.innerHTML = `<span class="ts-min">${esc(s.min)}</span><div class="ts-zz"></div>`;
          tk.prepend(blk); this.bloecke[s.key] = blk;
        }
        const d = document.createElement('div');
        d.className = `ts-z ${z.art}${z.s ? ' s-' + z.s : ''}${still ? '' : ' neu'}`;
        d.innerHTML = zeileHtml(z);
        blk.querySelector('.ts-zz').append(d);
      }
      if (nahOben) tk.scrollTop = 0;
    },
    // Nach dem Abpfiff: Spielbericht des Spiels (wie bisher); nach einem Neustart der kleine Bericht aus dem Paket
    zumBericht() {
      if (this.p && this.p.typ === 'probowl') { try { this.eigenerBericht(); return; } catch (e) { console.warn('[DFL-Textspiel] Pro Bowl', e); this.proBowlZu(); return; } }
      if (this.wieder) { try { this.eigenerBericht(); return; } catch (e) { console.warn('[DFL-Textspiel] Bericht', e); this.schliessen(); return; } }
      this.verstecken();
      paketLoeschen();
      const pm = hatDom() ? document.getElementById('pm-overlay') : null;
      if (pm) { pm.style.display = ''; return; }
      freigeben();
    },
    nachlesen() {
      if (!this.root) return;
      if (!this.fertig) this.sofortStill();
      this.zeigen(); this.steuerZeigen();
    },
    sofortStill() { this.stop(); while (this.i < this.st.length) this.zeigeSicher(this.st[this.i++], true); this.ende(); },
    eigenerBericht() {
      const sp = this.p.spiel, T = sp.teams, st = sp.stats, end = this.fp.stand, iE = this.fp.iE;
      const fuer = sp.eigen === 'h' ? end.h - end.g : end.g - end.h, ieFuer = iE ? (sp.eigen === 'h' ? iE.h - iE.g : iE.g - iE.h) : 0;
      const d = fuer || ieFuer, pb = this.p.typ === 'probowl';
      // Pro Bowl (D158): kein eigener Verein – das Urteil nennt den Sieger, darunter der MVP
      const urteil = pb ? ['sieg', `${T[d >= 0 ? 'h' : 'g'].name} gewinnt`] : d > 0 ? ['sieg', 'Sieg'] : d < 0 ? ['niederlage', 'Niederlage'] : ['remis', 'Remis'];
      const marke = (X, kl) => X.marke || wappen(X.id, kl);
      const alle = K.erzaehle(sp), tore = alle.zeilen.concat(alle.nachZeilen).filter(z => z.art === 'tor');
      const reihe = (lab, h, g, fmt) => {
        const s = (h + g) || 1, ph = Math.round(h / s * 100);
        return `<div class="ts-bs"><span class="lab">${lab}</span><span class="w h">${fmt(h)}</span><span class="bar" aria-hidden="true"><i class="h" style="width:${ph}%"></i><i class="g" style="width:${100 - ph}%"></i></span><span class="w g">${fmt(g)}</span></div>`;
      };
      const ganz = x => String(x), proz = x => x + ' %', eins = x => zahl(x, 1);
      const saisonEnde = typeof fcmSeasonOver === 'function' && (() => { try { return fcmSeasonOver(); } catch (e) { return false; } })();
      this.el.bericht.innerHTML = `<div class="ts-b-blatt" role="dialog" aria-label="Spielbericht">
        <div class="ts-b-inhalt">
          <div class="ts-b-erg"><div class="t">${marke(T.h, 'ts-wappen-b')}<span>${esc(T.h.kurz)}</span></div>
            <div class="s"><b>${end.h}:${end.g}</b>${iE ? `<small>i. E. ${iE.h}:${iE.g}</small>` : ''}<span class="ts-urteil ${urteil[0]}">${esc(urteil[1])}</span></div>
            <div class="t">${marke(T.g, 'ts-wappen-b')}<span>${esc(T.g.kurz)}</span></div></div>
          ${tore.length ? `<ul class="ts-b-tore">${tore.map(z => `<li class="${z.s}"><span class="m">${esc(z.min)}</span><span class="wer"><b>${esc(z.torschuetze || '–')}</b>${z.vorlage ? `<small>Vorlage ${esc(z.vorlage)}</small>` : ''}</span></li>`).join('')}</ul>` : ''}
          <div class="ts-b-stats">${reihe('Ballbesitz', st.h.besitz, st.g.besitz, proz)}${reihe('Torschüsse', st.h.schuesse, st.g.schuesse, ganz)}${reihe('Aufs Tor', st.h.aufsTor, st.g.aufsTor, ganz)}${reihe('xG', st.h.xg, st.g.xg, eins)}${reihe('Ecken', st.h.ecken, st.g.ecken, ganz)}${reihe('Fouls', st.h.fouls, st.g.fouls, ganz)}</div>
          <div class="ts-b-druck"><b>Druck je Minute</b>${druckSvg(this.druckW, this.toreAlle, this.druckW.length - 1, true)}</div>
          ${pb ? (this.p.mvp ? `<p class="ts-b-hinweis"><i class="ti ti-star-filled" aria-hidden="true"></i>MVP: ${esc(this.p.mvp)}</p>` : '')
            : '<p class="ts-b-hinweis"><i class="ti ti-lock" aria-hidden="true"></i>Gebucht beim Anpfiff – Noten, Tabelle und Kasse stehen schon im Spielstand.</p>'}
        </div>
        <div class="ts-b-fuss"><button type="button" class="ts-knopf hell" data-ts="zumticker"><i class="ti ti-message-dots" aria-hidden="true"></i>Ticker</button>
          ${pb ? '<button type="button" class="ts-knopf gruen" data-ts="pbzu">Schließen<i class="ti ti-chevron-right" aria-hidden="true"></i></button>'
            : `<button type="button" class="ts-knopf gruen" data-ts="weiter">${saisonEnde ? 'Saison abschließen' : 'Nächste Woche'}<i class="ti ti-chevron-right" aria-hidden="true"></i></button>`}</div>
      </div>`;
      this.el.bericht.hidden = false;
    },
    // Pro Bowl (D158): nur schließen – die Woche läuft wie gewohnt über den Haupt-Button weiter
    proBowlZu() {
      const f = pbFertig; pbFertig = null;
      this.schliessen();
      if (f) { try { f(); } catch (e) { console.warn('[DFL-Textspiel] Pro Bowl', e); } }
    },
    weiterNachBericht() {
      this.schliessen();
      try { if (typeof nextWeek === 'function') nextWeek(); } catch (e) { console.warn('[DFL-Textspiel] Woche weiter', e); }
      try { if (typeof switchAppView === 'function') switchAppView('home', document.getElementById('nav-home')); } catch (e) { /* Ansicht optional */ }
    }
  };

  // ── Anpfiff ──────────────────────────────────────────────────────────────
  function naechsterFrame(fn) {
    let erledigt = false;
    const los = () => { if (erledigt) return; erledigt = true; fn(); };
    try { requestAnimationFrame(() => setTimeout(los, 0)); } catch (e) { /* ohne rAF */ }
    setTimeout(los, 150);
  }
  let vorlauf = false;
  {
    const _ko = window.handleKO;
    if (typeof _ko === 'function') {
      window.handleKO = function () {
        const fx = aktFixture(), g = spielG();
        if (!tickerFuer(fx) || g.running || g.ended || !hatDom()) return _ko.apply(this, arguments);
        if (vorlauf) return undefined;
        vorlauf = true;
        try { ui.vorbereiten(fx); } catch (e) { console.warn('[DFL-Textspiel] Anpfiff', e); }
        const self = this, args = arguments;
        naechsterFrame(() => {
          vorlauf = false;
          try { _ko.apply(self, args); } catch (e) { console.warn('[DFL-Textspiel] Anpfiff', e); }
          if (!ui.hatSpiel() && ui.root) ui.schliessen();         // nichts gerechnet (z. B. Elf unvollständig)
        });
        return undefined;
      };
      try { handleKO = window.handleKO; } catch (e) { /* global überschrieben reicht */ }
    }
  }
  // Außen um simulateCurrentFixture (nach engine_v3_adapter.js und dfl_engine_patch.js): erst rechnen und buchen, dann Ticker
  {
    const _sim = window.simulateCurrentFixture;
    if (typeof _sim === 'function') {
      window.simulateCurrentFixture = function () {
        if (!aktFixture() && typeof ensureFixtureLoaded === 'function') { try { ensureFixtureLoaded(); } catch (e) { /* Adapter meldet es */ } }
        const fx0 = aktFixture(), fx = fx0 ? Object.assign({}, fx0) : null, g0 = spielG();
        const mit = tickerFuer(fx) && !g0.running && !g0.ended;
        const vorher = window.LAST_MATCH_2D, verletztVorher = mit ? verletzteIds() : null, hieltSchon = halten;
        scharf = mit;
        let r, fehler = null;
        try { r = _sim.apply(this, arguments); } catch (e) { fehler = e; }
        scharf = false;
        const g = spielG(), neu = !!(window.LAST_MATCH_2D && window.LAST_MATCH_2D !== vorher && g.ended);
        if (neu) { try { formationAufdecken(); } catch (e) { /* nur Anzeige */ } }
        let gestartet = false;
        if (mit && neu && halten) {
          try {
            const lb = window.__tsLiveBuchen;
            const p = paketBauen(fx, verletztVorher, lb ? { rec: window.LAST_MATCH_2D, seed: lb.seed, pruefen: true } : null);
            if (p) {
              ui.laden(p, lb ? { pos: lb.pos } : {});
              gestartet = true;
              // erst nach dem Speichern des Spielstands (läuft in Mikroaufgaben) – sonst belegt das Paket Platz, den das Speichern braucht
              setTimeout(() => { if (ui.p === p && !ui.fertig) paketSpeichern(p); }, 0);
            }
          } catch (e) { console.warn('[DFL-Textspiel] Ticker', e); }
        }
        if (!gestartet) {
          if (ui.root && !ui.hatSpiel()) ui.schliessen();
          if (halten && !hieltSchon) freigeben();        // nur, was dieser Aufruf zurückgehalten hat (ein laufender Ticker behält seins)
        }
        try { wahlZeigen(); } catch (e) { /* nur Anzeige */ }
        if (fehler) throw fehler;
        return r;
      };
      try { simulateCurrentFixture = window.simulateCurrentFixture; } catch (e) { /* global überschrieben reicht */ }
    }
  }
  // Gegner-Formation nach dem Abpfiff (die alte Minuten-Engine deckte sie in Minute 8–15 auf; Engine v3 wertet sofort)
  function formationAufdecken() {
    const T = window.MATCH_TAC, rec = window.LAST_MATCH_2D;
    if (!T) return;
    const f = rec && rec.teams && rec.teams[1] && rec.teams[1].formation;
    if (f) T.oppFormation = f;
    T.oppRevealed = true;
    if (typeof window.updateOppFormationBadge === 'function') window.updateOppFormationBadge();
  }
  // Weiter nach dem Spielbericht: Ticker schließen (nichts mehr zurückhalten)
  {
    const _orig = window.postMatchContinue;
    if (typeof _orig === 'function') {
      window.postMatchContinue = function () {
        try { ui.schliessen(); } catch (e) { /* Ticker optional */ }
        freigeben(true);
        return _orig.apply(this, arguments);
      };
      try { postMatchContinue = window.postMatchContinue; } catch (e) { /* global überschrieben reicht */ }
    }
  }
  // Spielbericht: Knopf „Ticker“ zum Nachlesen
  if (typeof MutationObserver === 'function' && hatDom()) {
    new MutationObserver(() => {
      const pm = document.getElementById('pm-overlay');
      if (!pm || pm.dataset.tsKnopf || !ui.hatSpiel() || ui.wieder) return;
      const fuss = pm.querySelector('#pm-footer'), w = pm.querySelector('#pm-continue-btn');
      if (!fuss || !w) return;
      pm.dataset.tsKnopf = '1';
      fuss.classList.add('ts-mit-ticker');
      w.insertAdjacentHTML('beforebegin', '<button type="button" id="pm-ticker-btn"><i class="ti ti-message-dots" aria-hidden="true"></i><span>Ticker</span></button>');
      fuss.querySelector('#pm-ticker-btn').addEventListener('click', () => { pm.style.display = 'none'; ui.nachlesen(); });
    }).observe(document.body, { childList: true });
  }

  // ── Einstellung am Anpfiff (Spieltag) ────────────────────────────────────
  function wahlZeigen() {
    if (!hatDom()) return;
    const sb = document.getElementById('sim-btn');
    if (!sb || !sb.parentNode) return;
    let el = document.getElementById('ts-wahl-box');
    if (!el) {
      el = document.createElement('div'); el.id = 'ts-wahl-box'; el.className = 'ts-wahl-box';
      sb.parentNode.appendChild(el);
      el.addEventListener('click', ev => { const b = ev.target.closest('[data-ts-wahl]'); if (b) setzeEinstellung(b.getAttribute('data-ts-wahl')); });
    }
    const fx = aktFixture(), g = spielG(), w = einstellung();
    el.hidden = !dfl() || !fx || !!(g.ended || g.running);
    el.innerHTML = `<div class="ts-wahl-kopf"><i class="ti ti-message-dots" aria-hidden="true"></i><b>Spiel als Text</b></div>
      <div class="ts-wahl" role="group" aria-label="Spiel als Text">${WAHLEN.map(x => `<button type="button" data-ts-wahl="${x.w}" aria-pressed="${x.w === w}">${x.titel}</button>`).join('')}</div>`;
  }
  ['resetMatchState', 'showNoMatchThisWeek'].forEach(fn => {
    const _orig = window[fn];
    if (typeof _orig !== 'function') return;
    window[fn] = function () {
      const r = _orig.apply(this, arguments);
      try { wahlZeigen(); } catch (e) { /* nur Anzeige */ }
      // „Spielanalyse“ gehört zum letzten Spiel – vor dem nächsten Anpfiff öffnete sie das alte (engine_v3_adapter.js holt sie nach dem Abpfiff zurück)
      try { const ma = document.getElementById('ma-open'); if (ma && ma.parentNode) ma.parentNode.removeChild(ma); } catch (e) { /* nur Anzeige */ }
      return r;
    };
    try { if (fn === 'resetMatchState') resetMatchState = window[fn]; else showNoMatchThisWeek = window[fn]; } catch (e) { /* global überschrieben reicht */ }
  });
  {
    const _orig = window.switchAppView;
    if (typeof _orig === 'function') window.switchAppView = function (view) {
      const r = _orig.apply(this, arguments);
      if (view === 'match') { try { wahlZeigen(); } catch (e) { /* nur Anzeige */ } }
      return r;
    };
  }

  // ── Einstellung im Mehr-Blatt (Handy) ────────────────────────────────────
  function einstellungBlatt() {
    const box = hatDom() ? document.querySelector('#app-blatt .app-blatt-box') : null;
    if (!box) return;
    const malen = () => {
      const w = einstellung();
      box.innerHTML = `<div class="app-griff"></div><button class="app-blatt-zu" aria-label="Schließen"><i class="ti ti-x" aria-hidden="true"></i></button>
        <div class="app-sheet-titel">Spiel als Text</div>
        <div class="stil-wahl">${WAHLEN.map(x => `<button class="stil-kachel" type="button" data-ts-wahl="${x.w}" aria-pressed="${x.w === w}">
          <i class="ti ${x.icon}" aria-hidden="true"></i><b>${x.titel}</b><small>${x.sub}</small></button>`).join('')}</div>
        <p class="stil-hinweis">Gilt für dieses Gerät.</p>`;
    };
    box.onclick = ev => { const b = ev.target.closest('[data-ts-wahl]'); if (b) { setzeEinstellung(b.getAttribute('data-ts-wahl')); malen(); } };
    malen();
    document.getElementById('app-blatt').classList.add('auf'); document.body.classList.add('app-gesperrt');
    try { if (window.DFLAppShell) DFLAppShell.cta(); } catch (e) { /* Haupt-Button optional */ }
  }

  // ── Pro Bowl im Ticker (D158) ────────────────────────────────────────────
  // Das Spiel ist schon gerechnet und gespeichert (dfl_ehrungen_patch.js); hier nur Abspielen. d = { rec (Aufzeichnung wie
  // LAST_MATCH_2D: frames, events, stats, teams [Süd-West, Nord-Ost]), teams { h, g } (Anzeige, marke = HTML statt Wappen),
  // tore [h, g], lambda, nach (Elfmeterschießen, direkt), kopf, ort, mvp (Text) }; fertig() nach „Schließen“.
  // false = kein Ticker (Einstellung „Aus“, „Simulieren bis …“, ohne DOM, Stand weicht ab) → der Aufrufer zeigt das Ergebnis.
  let pbFertig = null;
  function proBowl(d, fertig) {
    if (!d || !d.rec || !hatDom() || !dfl() || unterdrueckt || einstellung() === 'aus' || ui.hatSpiel()) return false;
    const E = window.MatchEngineV3 || {};
    const spiel = K.aufbereiten(d.rec, { eigenHeim: true, teams: d.teams, seed: Math.floor(Math.random() * 1e9), ort: d.ort || null, runde: 'Pro Bowl',
      lambda: d.lambda || null, nach: d.nach || null, L: E.L || 105, B: E.B || 68 });
    const fp = K.fahrplan(spiel, 'B');
    if (Array.isArray(d.tore) && (fp.stand.h !== d.tore[0] || fp.stand.g !== d.tore[1])) {
      console.warn('[DFL-Textspiel] Pro Bowl: Ticker-Stand weicht vom Ergebnis ab – kein Ticker', fp.stand, d.tore);
      return false;
    }
    paketLoeschen();
    pbFertig = typeof fertig === 'function' ? fertig : null;
    ui.laden({ v: 1, typ: 'probowl', kopf: d.kopf || 'Pro Bowl', variante: variante(), spiel, verletzt: [], mvp: d.mvp || null, erzeugt: Date.now() }, {});
    return true;
  }

  // ── Neustart mitten im Ticker: dort weiter, wo er stand ──────────────────
  function wiederaufnehmen() {
    if (ui.hatSpiel() || !hatDom()) return false;
    const p = paketLesen();
    if (!p) return false;
    if (!passt(p)) { paketLoeschen(); return false; }
    const pos = Math.max(0, parseInt(ls.lies(KEY_POS) || '0', 10) || 0);
    ui.laden(p, { pos, wieder: true });
    return true;
  }
  if (hatDom()) {
    const spaeter = () => setTimeout(() => { try { wiederaufnehmen(); } catch (e) { console.warn('[DFL-Textspiel] Fortsetzen', e); } }, 600);
    if (document.readyState === 'complete') spaeter(); else window.addEventListener('load', spaeter);
    try { wahlZeigen(); } catch (e) { /* nur Anzeige */ }
  }

  window.DFLTextspiel = {
    einstellung, setzeEinstellung, einstellungText, einstellungBlatt, wiederaufnehmen, ohne, tempo, setzeTempo, WAHLEN, proBowl,
    laeuft: () => ui.hatSpiel() && !ui.fertig, offen: () => ui.offen(), fertig: () => ui.fertig,
    sofort: () => ui.sofort(), paket: () => ui.p, schritte: () => ui.st, zurueckgehalten: () => ({ halten, berichtWartet, hinweise: wartendeHinweise.length }),
    paketLesen, passt, ui,
    // PC-Live (kickstil_pc_spieltag.js): Ticker für ein noch nicht gebuchtes Spiel, Prüfung wie beim Anpfiff
    tickerFuer: fx => tickerFuer(fx), paketLive: (fx, rec, seed) => paketBauen(fx, null, { rec, seed }), variante,
    vorbereiten: fx => ui.vorbereiten(fx)
  };
  console.log('[DFL-Textspiel v1] aktiv — Spiel als Text (D77): Engine rechnet und bucht beim Anpfiff, Ticker spielt nur ab (Jede Minute · Höhepunkte · Aus), Neustart setzt fort');
})();

;/* ── js/transfermarkt_balance.js ── */
/* ═══════════════════════════════════════════════════════════════════════════
   TRANSFERMARKT-BALANCE  ·  v1
   ─────────────────────────────────────────────────────────────────────────
   Lädt ganz zuletzt — damit die Wrapper NACH allen anderen Preis-Patches
   greifen (PriceBalance v3, Unzufriedenheits-Abschlag, RealMarket).

   Drei Baustellen:
   1) MARKTWERT ab OVR 60 zu niedrig. Die Grundkurve (700 × 1,225^(OVR−40))
      trifft die untere Hälfte gut, wird aber im Bereich 60–80 zu flach: ein
      solider Zweitligaspieler kostete so viel wie ein Regionalliga-Ersatzmann
      im echten Fußball. Dazu ein eigener Aufschlag für ungenutztes Potenzial —
      Talente waren das größte Schnäppchen im Spiel.
   2) ABLÖSEFREIE Spieler waren zu bequem: keine Ablöse, kaum Gehaltsaufschlag,
      keine Unterschriftsprämie. Jetzt verlangen sie HANDGELD aus dem
      Transferbudget und ein spürbar höheres Gehalt — die Ablöse spart man,
      umsonst ist der Wechsel nicht.
   3) Die Niveau-Sperre galt nur beim Kauf über den Markt. Ablösefreie Stars
      sind daran vorbeigelaufen — jetzt nicht mehr.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const CFG = {
    // ── Marktwert ──────────────────────────────────────────────────────────
    // Stützpunkte OVR → Faktor, dazwischen linear. Angehoben wird der Bereich
    // 60–80; ganz oben läuft der Aufschlag wieder aus, dort stimmten die
    // Preise schon (ein 88er kostete bereits zweistellige Millionen).
    klasse: [[60, 1.00], [64, 1.18], [68, 1.36], [72, 1.52], [76, 1.62],
             [80, 1.60], [84, 1.42], [88, 1.24], [92, 1.12]],
    potenzialAbOvr: 58,        // darunter greift der Potenzial-Aufschlag nicht
    potenzialBisOvr: 82,       // darüber auch nicht (dort zählt nur noch Klasse)
    potenzialProPunkt: 0.045,  // je Punkt Luft nach oben
    potenzialMax: 0.75,        // höchstens +75 %
    potenzialMaxAlter: 27,

    // ── Ablösefreie Spieler ────────────────────────────────────────────────
    faGehaltBasis:   1.45,     // Aufschlag auf das faire Wochengehalt
    faGehaltProOvr:  0.012,    // zusätzlich je OVR-Punkt über 60
    faGehaltProJahr: 0.04,     // längere Laufzeit = etwas teurer
    handgeldWochen:  6,        // Grundstock in Wochengehältern
    handgeldProJahr: 1.5,      // plus je Vertragsjahr
    handgeldProOvr:  0.02,     // Klassenaufschlag je OVR-Punkt über 60
    handgeldMin:     5000
  };
  window.TransfermarktBalance = CFG;          // zum Nachjustieren von außen

  const euro = v => (typeof formatEuro === 'function') ? formatEuro(v) : ('€' + v);
  const rundWert = v => (typeof roundMarketValue === 'function') ? roundMarketValue(v) : Math.round(v);
  const rundLohn = v => (typeof roundWage === 'function') ? roundWage(v) : Math.round(v);
  const zeigeName = p => (typeof displayName === 'function') ? displayName(p) : (p.name || '');

  // ── 1. MARKTWERT ─────────────────────────────────────────────────────────
  function klasseFaktor(ovr) {
    const K = CFG.klasse;
    if (!(ovr > K[0][0])) return 1;
    if (ovr >= K[K.length - 1][0]) return K[K.length - 1][1];
    for (let i = 0; i < K.length - 1; i++) {
      const a = K[i], b = K[i + 1];
      if (ovr >= a[0] && ovr <= b[0]) return a[1] + (b[1] - a[1]) * ((ovr - a[0]) / (b[0] - a[0]));
    }
    return 1;
  }
  function potenzialFaktor(p) {
    const ovr = p.ovr || 0, tp = p.truePotential || ovr, luft = tp - ovr;
    // JUWEL: Ab Potenzial 85 bei einem jungen Spieler greift ein eigener,
    // steiler Aufschlag. Solche Spieler wechseln nur für Summen, die weh tun.
    if (tp >= 85 && (p.age || 25) <= 21) {
      const alter = p.age || 20;
      return 1 + Math.min(3.2, (tp - 84) * 0.42) * Math.max(0.55, (23 - alter) / 4);
    }
    if (luft <= 0 || ovr < CFG.potenzialAbOvr || ovr > CFG.potenzialBisOvr) return 1;
    const alter = p.age || 24;
    if (alter > CFG.potenzialMaxAlter) return 1;
    // Je jünger, desto mehr ist die Luft nach oben wert.
    const jung = Math.max(0.3, Math.min(1.1, (29 - alter) / 9));
    return 1 + Math.min(CFG.potenzialMax, luft * CFG.potenzialProPunkt * jung);
  }
  window.marktwertAufschlag = function (p) {
    return p ? klasseFaktor(p.ovr || 0) * potenzialFaktor(p) : 1;
  };

  if (typeof window.computeMarketValue === 'function') {
    const _mv = window.computeMarketValue;
    window.computeMarketValue = function (p) {
      const v = _mv.apply(this, arguments);
      if (!p || !p.ovr) return v;
      return rundWert(v * klasseFaktor(p.ovr) * potenzialFaktor(p));
    };
    try { computeMarketValue = window.computeMarketValue; } catch (e) {}
    console.log('%c[TransfermarktBalance v1] Marktwert ab OVR 60 angehoben', 'color:#3fb950;font-weight:bold');
  }

  // Gespeicherte Werte nachziehen. Ohne das behielten Spieler aus einem alten
  // Spielstand ihren alten (zu niedrigen) Preis, weil p.value beim Erzeugen
  // einmal festgeschrieben wird.
  function werteNachziehen() {
    if (typeof computeMarketValue !== 'function') return;
    const frisch = liste => { (liste || []).forEach(p => {
      if (p && p.ovr && !p._levelPremium) { try { p.value = computeMarketValue(p); } catch (e) {} }
    }); };
    try { if (typeof MARKET !== 'undefined' && MARKET) frisch(MARKET.players); } catch (e) {}
    try { if (typeof CLUB !== 'undefined' && CLUB) frisch(CLUB.freeAgents); } catch (e) {}
    try { if (typeof SQUAD !== 'undefined') frisch(SQUAD); } catch (e) {}
  }

  // ── 2. NIVEAU-PRÜFUNG (auch für Ablösefreie) ─────────────────────────────
  function niveau(p) {
    try { if (typeof checkTransferLevel === 'function') return checkTransferLevel(p); } catch (e) {}
    return { ok: true, premium: 1, over: 0 };
  }

  // ── 3. ABLÖSEFREIE: Gehalt + Handgeld ────────────────────────────────────
  function faPool() {
    try { if (window.FreeAgents && FreeAgents.pool) return FreeAgents.pool(); } catch (e) {}
    try { return (CLUB && CLUB.freeAgents) || []; } catch (e) { return []; }
  }
  try { if (window.FreeAgents && FreeAgents.CFG) FreeAgents.CFG.wagePremium = CFG.faGehaltBasis; } catch (e) {}

  function faGehalt(p, jahre) {
    jahre = Math.max(1, jahre | 0);
    const fair = (typeof weeklyWageFor === 'function') ? weeklyWageFor(p) : (p.wage || 3000);
    let w = fair * (CFG.faGehaltBasis + Math.max(0, (p.ovr || 60) - 60) * CFG.faGehaltProOvr);
    w *= (1 + (jahre - 1) * CFG.faGehaltProJahr);
    // Internationale Spiele sind bares Geld wert: Wer sie bieten kann, muss
    // beim Gehalt weniger drauflegen.
    const eu = (typeof europaStufe === 'function') ? europaStufe() : 0;
    if (eu) w *= eu === 3 ? 0.88 : eu === 2 ? 0.93 : 0.96;
    const chk = niveau(p);
    if (chk.premium > 1) w *= chk.premium;      // zu gut für die Liga = teurer
    return rundLohn(w);
  }
  function faHandgeld(p, jahre) {
    jahre = Math.max(1, jahre | 0);
    const w = faGehalt(p, jahre);
    let hg = w * (CFG.handgeldWochen + jahre * CFG.handgeldProJahr);
    hg *= (1 + Math.max(0, (p.ovr || 60) - 60) * CFG.handgeldProOvr);
    // Wer international spielt, muss weniger Handgeld auf den Tisch legen.
    const eu = (typeof europaStufe === 'function') ? europaStufe() : 0;
    if (eu) hg *= eu === 3 ? 0.82 : eu === 2 ? 0.89 : 0.94;
    return Math.max(CFG.handgeldMin, rundWert(hg));
  }
  window.faKonditionen = function (p, jahre) {
    return { gehalt: faGehalt(p, jahre || 2), handgeld: faHandgeld(p, jahre || 2), niveau: niveau(p) };
  };

  // ── Verpflichtung ────────────────────────────────────────────────────────
  const _origSign = window.signFreeAgent;
  if (typeof _origSign === 'function') {
    window.signFreeAgent = function (faId, jahre) {
      const pool = faPool();
      const p = pool.find(x => x && x.id === faId);
      if (!p) return _origSign.apply(this, arguments);

      if (typeof isTransferWindowOpen === 'function' && !isTransferWindowOpen()) {
        alert('Das Transferfenster ist geschlossen. Auch ablösefreie Spieler können nur im Sommer (KW1-6) und Winter (Januar) verpflichtet werden.');
        return;
      }
      // Ein Spieler dieser Klasse unterschreibt nicht in dieser Liga —
      // ablösefrei hin oder her.
      const chk = niveau(p);
      if (!chk.ok) { alert('🚫 ' + chk.reason); return; }

      if (jahre == null) { vertragsDialog(p); return; }
      const maxY = (typeof MAX_CONTRACT_YEARS !== 'undefined') ? MAX_CONTRACT_YEARS : 5;
      jahre = Math.max(1, Math.min(maxY, jahre | 0));

      const gehalt = faGehalt(p, jahre), handgeld = faHandgeld(p, jahre);
      if (((CLUB && CLUB.budget) || 0) < handgeld) {
        alert('Das Handgeld ist nicht gedeckt: ' + zeigeName(p) + ' verlangt ' + euro(handgeld) +
              ' bei Unterschrift. Frei im Transferbudget: ' + euro((CLUB && CLUB.budget) || 0) + '.');
        return;
      }
      // Forderung festschreiben, damit die Original-Funktion damit rechnet.
      p.faWageDemand = gehalt; p.wage = gehalt;

      const vorher = pool.length;
      _origSign.call(this, faId, jahre);
      if (pool.length >= vorher) return;         // abgebrochen (z.B. Kader voll)

      CLUB.budget = (CLUB.budget || 0) - handgeld;
      try {
        // Der Eintrag der Original-Funktion steht als „buy" mit Ablöse 0 vorn —
        // dort das Handgeld eintragen, damit die Transferbilanz stimmt.
        const h = CLUB.transferHistory;
        if (Array.isArray(h) && h[0] && h[0].type === 'buy' && !h[0].amount) h[0].amount = handgeld;
      } catch (e) {}
      if (typeof addNews === 'function') {
        addNews('transfer', 'Handgeld: ' + euro(handgeld) + ' für ' + p.name,
          zeigeName(p) + ' unterschreibt ablösefrei — dafür fließen ' + euro(handgeld) +
          ' Handgeld aus dem Transferbudget, das Gehalt liegt bei ' + euro(gehalt) +
          '/Woche. Restbudget: ' + euro(CLUB.budget) + '.');
      }
      if (typeof showToast === 'function') showToast('Handgeld ' + euro(handgeld) + ' gezahlt.', 'money');
      if (typeof renderTransferTab === 'function') renderTransferTab();
      if (typeof updateUI === 'function') updateUI();
      if (typeof saveGameState === 'function') saveGameState();
    };
    try { signFreeAgent = window.signFreeAgent; } catch (e) {}
  }

  window.__signFA = function (id, y) {
    const ov = document.querySelector('.contract-overlay');
    if (ov) ov.remove();
    window.signFreeAgent(id, y);
  };

  // ── Vertragsdialog ───────────────────────────────────────────────────────
  function vertragsDialog(p) {
    const maxY = (typeof MAX_CONTRACT_YEARS !== 'undefined') ? MAX_CONTRACT_YEARS : 5;
    const chk = niveau(p);
    const ov = document.createElement('div');
    ov.className = 'contract-overlay';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px';
    let rows = '';
    for (let y = 1; y <= maxY; y++) {
      const w = faGehalt(p, y), hg = faHandgeld(p, y);
      const lohnOk = ((CLUB && CLUB.wageBudget) || 0) >= w;
      const geldOk = ((CLUB && CLUB.budget) || 0) >= hg;
      const ok = lohnOk && geldOk;
      const warn = ok ? '' : (!lohnOk ? 'Gehaltsbudget zu klein' : 'Transferbudget zu klein');
      rows += '<button class="contract-year-btn" ' + (ok ? '' : 'disabled') +
        ' onclick="__signFA(\'' + p.id + '\',' + y + ')"' +
        ' style="display:flex;justify-content:space-between;align-items:center;width:100%;padding:10px 12px;margin-bottom:6px;border-radius:8px;border:1px solid var(--border,#30363d);background:' +
        (ok ? 'var(--bg3,#21262d)' : 'var(--bg2,#161b22)') + ';color:var(--text,#e6edf3);cursor:' +
        (ok ? 'pointer' : 'not-allowed') + ';opacity:' + (ok ? 1 : .5) + '">' +
        '<span><b>' + y + (y === 1 ? ' Jahr' : ' Jahre') + '</b> · bis ' +
        (typeof seasonEndYear === 'function' ? seasonEndYear(LEAGUE.season + y) : (LEAGUE.season + y)) +
        (warn ? '<br><span style="font-size:10px;color:#f85149">' + warn + '</span>' : '') + '</span>' +
        '<span style="text-align:right"><b style="color:var(--gold,#f2c14e)">' + euro(hg) + '</b> Handgeld' +
        '<br><span style="font-size:11px;color:var(--text2,#8b949e)">' + euro(w) + '/Woche</span></span></button>';
    }
    // Rückmeldung 18.10.: keine Erklärsätze im Spiel – nur die Marke
    const hinweis = chk.premium > 1
      ? '<div style="margin-bottom:10px"><span class="loan-tag" style="color:var(--gold,#f2c14e);border-color:var(--gold,#f2c14e)">Prämie +' +
        Math.round((chk.premium - 1) * 100) + ' %</span></div>'
      : '';
    ov.innerHTML = '<div style="background:var(--bg2,#161b22);border:1px solid var(--border,#30363d);border-radius:12px;max-width:440px;width:100%;padding:20px">' +
      '<div style="font-size:15px;font-weight:700;margin-bottom:4px">Ablösefrei verpflichten: ' +
      (p.flag ? p.flag + ' ' : '') + zeigeName(p) + '</div>' +
      '<div style="font-size:12px;color:var(--text2,#8b949e);margin-bottom:6px">' + p.age + ' J · ' +
      (typeof positionsDisplay === 'function' ? positionsDisplay(p) : p.pos) + ' · OVR ' + p.ovr + ' · ' +
      (p.fromClub || 'vereinslos') + '</div>' +
      '<div style="font-size:12px;font-weight:700;margin-bottom:8px">Laufzeit</div>' +
      hinweis + rows +
      '<button onclick="this.closest(\'.contract-overlay\').remove()" style="width:100%;padding:9px;margin-top:6px;border-radius:8px;border:1px solid var(--border,#30363d);background:transparent;color:var(--text2,#8b949e);cursor:pointer">Abbrechen</button>' +
      '</div>';
    document.body.appendChild(ov);
  }

  // ── Liste der Ablösefreien ───────────────────────────────────────────────
  function renderFrei() {
    const el = document.getElementById('tr-sub-frei');
    if (!el) return;
    const pool = faPool();
    const offen = (typeof isTransferWindowOpen === 'function') ? isTransferWindowOpen() : true;
    if (!pool.length) {
      el.innerHTML = '<div style="color:var(--text3);font-size:11px;padding:12px">Aktuell keine ablösefreien Spieler verfügbar. Schau im nächsten Transferfenster wieder vorbei.</div>';
      return;
    }
    const scout = (CLUB.facilities && CLUB.facilities.scouting) || 1;
    const sorted = pool.slice().sort((a, b) =>
      (b.ovr + (b.truePotential || 0) * 0.2) - (a.ovr + (a.truePotential || 0) * 0.2));
    const rows = sorted.map(p => {
      const chk = niveau(p);
      const hg = faHandgeld(p, 2), w = faGehalt(p, 2);
      const potTxt = (typeof potentialDisplay === 'function') ? potentialDisplay(p, scout) : ('Pot ' + (p.truePotential || '?'));
      const tag = !chk.ok
        ? '<span class="loan-tag" style="background:#3a1a1a;color:#f85149;border-color:#f85149">zu hochklassig</span>'
        : (p.academyProduct
            ? '<span class="loan-tag" style="background:#1a3a1a;color:#3fb950;border-color:#3fb950">NLZ-Talent</span>'
            : '<span class="loan-tag">ablösefrei</span>');
      const preis = chk.ok
        ? '<span style="color:var(--gold,#f2c14e)">' + euro(hg) + '</span><br><span style="font-size:9px;color:var(--text3)">Handgeld · ' + euro(w) + '/Wo</span>'
        : '<span style="color:#f85149;font-size:10px">lehnt ab</span>';
      const knopf = chk.ok
        ? '<button class="mkt-btn" ' + (offen ? '' : 'disabled') + ' onclick="signFreeAgent(\'' + p.id + '\')">Verpflichten</button>'
        : '<button class="mkt-btn" disabled title="' + (chk.reason || '') + '">Kein Wechsel</button>';
      // Rückmeldung 18.10.: Ablösefreie mit Gesicht wie im Markt
      let bild = '';
      try { if (window.KSVerein && KSVerein.gesicht) bild = '<span class="ks-mkt-gesicht dfl-portrait klein">' + KSVerein.gesicht(p) + '</span>'; } catch (e) { bild = ''; }
      return '<div class="market-row">' + bild + '<div style="flex:1">' +
        '<span class="pos-badge-sm pos-' + p.pos + '">' +
        (typeof positionsDisplay === 'function' ? positionsDisplay(p) : p.pos) + '</span> ' +
        '<span class="market-name">' + (p.flag ? p.flag + ' ' : '') + zeigeName(p) + '</span> ' + tag +
        '<div class="market-meta">' + p.age + ' J · OVR ' + p.ovr + ' · <b style="color:var(--text2)">' + potTxt +
        '</b> · DEF ' + p.def + ' · MID ' + p.mid + ' · ATT ' + p.att + ' · ' + (p.fromClub || 'vereinslos') + '</div>' +
        '</div><div class="market-value">' + preis + '</div>' +
        '<div class="market-btns">' + knopf + '</div></div>';
    }).join('');
    el.innerHTML = '<div style="font-size:11px;color:var(--text3);margin-bottom:8px">' + pool.length + ' verfügbar</div>' +
      '<div class="market-list">' + rows + '</div>';
  }
  window.renderFreeAgentList = renderFrei;

  // Der Transfermarkt rendert die Liste über die IIFE-interne Fassung —
  // deshalb hier NACH dem Original noch einmal drüber.
  if (typeof window.renderTransferTab === 'function') {
    const _tab = window.renderTransferTab;
    window.renderTransferTab = function () {
      try { werteNachziehen(); } catch (e) {}
      const r = _tab.apply(this, arguments);
      try { renderFrei(); } catch (e) {}
      return r;
    };
    try { renderTransferTab = window.renderTransferTab; } catch (e) {}
  }

  // ── 4. VERKAUFSWEGE ──────────────────────────────────────────────────────
  // Drei Wege, einen Spieler abzugeben — mit klarer Rangfolge:
  //   Schnellverkauf   70–90 % vom Marktwert (sofort, ohne Verhandlung)
  //   Anbieten         ~90 %              (ein Interessent meldet sich)
  //   Fremdes Gebot    100–140 % und mehr (mit Verhandlung noch mehr)
  CFG.schnellverkauf = { min: 0.70, max: 0.90 };

  // „Anbieten" war im Spiel gar nicht erreichbar und ohne jede Prüfung. Hier
  // bekommt es dieselben Sperren wie der Verkauf — Transferfenster, Kadergröße,
  // Verkaufssperre für Neuzugänge, keine Leihspieler.
  const _origOffer = window.offerPlayerForSale;
  if (typeof _origOffer === 'function') {
    window.offerPlayerForSale = function (playerId) {
      const p = (typeof SQUAD !== 'undefined' ? SQUAD : []).find(x => x && x.id === playerId);
      if (!p) return _origOffer.apply(this, arguments);
      if (typeof isTransferWindowOpen === 'function' && !isTransferWindowOpen()) {
        alert('Das Transferfenster ist geschlossen. Anbieten geht nur im Sommer (KW1–6) und im Winter (Januar).');
        return null;
      }
      if (p.onLoanFrom) { alert(zeigeName(p) + ' gehört dir nicht — Leihspieler kannst du nicht anbieten.'); return null; }
      if (p.onLoanAt)   { alert(zeigeName(p) + ' ist verliehen. Hol ihn erst zurück.'); return null; }
      if ((typeof SQUAD !== 'undefined' ? SQUAD.length : 0) <= 12) {
        alert('Der Kader ist zu klein, um noch jemanden abzugeben (mindestens 12 Spieler nötig).');
        return null;
      }
      if (typeof window.canSellPlayer === 'function' && !window.canSellPlayer(p)) {
        alert(zeigeName(p) + ' wurde erst in dieser Saison verpflichtet und kann frühestens in der nächsten Saison wieder abgegeben werden.');
        return null;
      }
      const mv = (typeof computeMarketValue === 'function') ? computeMarketValue(p) : (p.value || 0);
      const erwartet = rundWert(mv * 0.9);
      if (typeof confirm === 'function' &&
          !confirm(zeigeName(p) + ' anbieten?\n' +
                   'Erwarteter Erlös rund ' + euro(erwartet) + ' · Marktwert ' + euro(mv))) {
        return null;
      }
      return _origOffer.apply(this, arguments);
    };
    try { offerPlayerForSale = window.offerPlayerForSale; } catch (e) {}
  }

  console.log('%c[TransfermarktBalance v1] aktiv', 'color:#3fb950;font-weight:bold',
    '— Marktwert 60+, Handgeld & Gehalt für Ablösefreie, Niveau-Sperre auch ablösefrei, ' +
    'Schnellverkauf ' + Math.round(CFG.schnellverkauf.min * 100) + '–' + Math.round(CFG.schnellverkauf.max * 100) + ' % MW');
})();
;/* ── js/kickstil_marktwert.js ── */
/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · MARKTWERT FÜR ALTER UND POTENZIAL  ·  v1   (2026-10-24)
   ─────────────────────────────────────────────────────────────────────────
   Nutzer: „Bayern hat 100 % overpayed bei einem 80er mit 81–89 Potenzial“ – „89 ist nicht so hoch, dass du dafür 100 Mille
   ausgibst … so bei 75 Mille, wenn der Spieler schon 81 hat und 19 ist (mit Aufschlag eines Top-Klubs aus dem Ausland)“.
   Vorher stapelten vier Schichten den Wert junger Spieler: Potenzial-Aufschlag + Talent-Stufe (engine_main.js), Juwel-Aufschlag bis
   ×4,2 (transfermarkt_balance.js), Nachwuchs ×2 und Generationstalent ×2 (PriceBalance in bundle_match.js) – für 80/19/89 rund ×20
   auf den Wert eines fertigen Spielers; ältere fielen dafür steil ab (31 J. ×0,7 × 0,65 × …).
   Neu, EINE Rechnung für Alter und Potenzial auf dem „fertigen Wert“ (derselbe Spieler mit 26 Jahren ohne Luft nach oben – die
   übrigen Schichten Stärke, Position, Klasse, Unzufriedenheit bleiben):
     Marktwert = fertig × ALTER[alter] × (1 + Luft × LUFT[alter] + Spitze)
     Spitze = (Potenzial − 84) × CFG.spitze × SPITZE_JUNG[alter], nur ab Potenzial 85
   Lädt nach transfermarkt_balance.js und vor den Modulen, die den Wert noch je Verein/NLZ verändern (kickstil_pc_nlz.js).
   Schalter CFG.aktiv (aus = alte Rechnung), Vergleich KSMarktwert.alt(p).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const W = window;
  const CFG = {
    aktiv: true,
    fertigAlter: 26,
    // Alter → Faktor auf den fertigen Wert (jung etwas mehr, ab 29 schrittweise weniger)
    alter: { 17: 1.15, 18: 1.15, 19: 1.15, 20: 1.15, 21: 1.15, 22: 1.08, 23: 1.08, 24: 1.0, 25: 1.0, 26: 1.0, 27: 1.0, 28: 0.95,
      29: 0.85, 30: 0.72, 31: 0.6, 32: 0.45, 33: 0.35, 34: 0.25 },
    alterSonst: 0.18,
    // Wert je Punkt Luft nach oben (Potenzial − Stärke), je jünger desto mehr
    luft: { 16: 0.10, 17: 0.10, 18: 0.10, 19: 0.10, 20: 0.09, 21: 0.08, 22: 0.065, 23: 0.05, 24: 0.04, 25: 0.025, 26: 0.015 },
    luftMax: 14,
    // Spitzenpotenzial ab 85 (Weltklasse in Reichweite)
    spitze: 0.12, spitzeMax: 0.6,
    // Wer schon Weltklasse ist, ist fertig bezahlt: Luft und Spitze zählen ab Stärke 80 weniger (88: gut die Hälfte)
    schonGut: { ab: 80, jePunkt: 0.06, min: 0.5 },
    // Weltklasse gleitend statt Sprung: PriceBalance verdoppelt ab Potenzial 88 (bundle_match.js GENERATIONAL_FACTOR) – im fertigen Wert
    // (Potenzial = Stärke) trifft das alle ab Stärke 88: 87 → 68 Mio, 88 → 146 Mio. Hier herausgerechnet, dafür ab 85 je Punkt +12 %.
    weltklasse: { ab: 84, jePunkt: 0.12, generationAb: 88, deckelAb: 88, ueberDeckel: 1.08 },
    // Über 88 nicht mehr exponentiell (Grundwert × 1,225 je Punkt): 5-Saison-Test 2026-10-24 zeigte 93/22 = 516 Mio – jetzt × 1,08 je Punkt
    spitzeJung: { 16: 1, 17: 1, 18: 1, 19: 1, 20: 1, 21: 1, 22: 0.6, 23: 0.6, 24: 0.3, 25: 0.3 }
  };
  const vor = W.computeMarketValue;
  if (typeof vor !== 'function') { console.warn('[Kickstil-Marktwert] computeMarketValue fehlt – inaktiv'); return; }
  const rund = v => (typeof roundMarketValue === 'function' ? roundMarketValue(v) : Math.round(v / 1000) * 1000);
  const tabelle = (t, a, sonst) => (t[a] != null ? t[a] : a < 17 ? t[Math.min(...Object.keys(t).map(Number))] : sonst);

  function faktor(p) {
    const alter = p.age || 24, ovr = p.ovr || 0, tp = Math.max(ovr, p.truePotential || ovr);
    const luft = Math.min(CFG.luftMax, tp - ovr);
    const gut = Math.max(CFG.schonGut.min, 1 - Math.max(0, ovr - CFG.schonGut.ab) * CFG.schonGut.jePunkt);
    const spitze = tp >= 85 ? Math.min(CFG.spitzeMax, (tp - 84) * CFG.spitze) * tabelle(CFG.spitzeJung, alter, 0) : 0;
    return tabelle(CFG.alter, alter, CFG.alterSonst) * (1 + (luft * tabelle(CFG.luft, alter, 0) + spitze) * gut);
  }
  function fertig(p) {
    const K = CFG.weltklasse, o = Math.min(p.ovr, K.deckelAb);
    const q = Object.assign({}, p, { ovr: o, age: CFG.fertigAlter, truePotential: o, potential: o });
    let v = vor.call(this, q);
    if (o >= K.generationAb) v /= 2;
    return v * (1 + Math.max(0, o - K.ab) * K.jePunkt) * Math.pow(K.ueberDeckel, Math.max(0, p.ovr - K.deckelAb));
  }
  W.computeMarketValue = function (p) {
    if (!CFG.aktiv || !p || !p.ovr) return vor.apply(this, arguments);
    return rund(Math.max(2500, fertig(p) * faktor(p)));
  };
  try { computeMarketValue = W.computeMarketValue; } catch (e) { /* nur window */ }
  W.KSMarktwert = { CFG, faktor, fertig, alt: p => vor(p) };
  console.log('[Kickstil-Marktwert v1] aktiv — Alter und Potenzial in einer Rechnung (fertiger Wert × Alter × Luft)');
})();

