/* ===== engine_v3_adapter.js =====
   ADAPTER: räumliche Engine (v3) → bestehende Spiel-Pipeline
   ─────────────────────────────────────────────────────────────────────────────
   Gleiches Muster wie engine_v2_adapter.js, aber mit MatchEngineV3. Der große
   Unterschied: v3 zeichnet währenddessen ALLE Positionen auf (opt.record). Daraus
   entstehen die Spielernoten (spielerLeistung) und die Spielanalyse.
   Die 2D-Taktikansicht mit Live-Modus und Halbzeit-Panel ist seit 2026-10-09
   ausgebaut (Nutzer: zu kompliziert, später neu) – Spiele werden sofort gewertet.

   Umschalter: CLUB.settings.engineV3 (Standard AN) — window.toggleEngineV3().
   Hat Vorrang vor v2, wenn beide an sind.
   Lädt NACH match_engine_v2.js / engine_v2_adapter.js und NACH match_engine_v3.js.

   STOLPERFALLE (aus v2 übernommen): NICHT runQuickSimulation wrappen —
   simulateCurrentFixture ruft die LOKALE Funktion aus seiner eigenen IIFE auf.
   ============================================================================= */
(function () {
  'use strict';

  // STANDARD AN. Vorher war das Feld bei neuen Spielständen schlicht nicht
  // gesetzt und `!!undefined` ergab false — die gesamte räumliche Engine lief
  // damit NIE, außer man fand den versteckten Schalter. Alle Ligaspiele liefen
  // mit der alten Simulation, obwohl die Taktikansicht v3 zeigt.
  // Nur ein ausdrückliches `false` schaltet sie jetzt noch ab.
  function on() { try { return !(CLUB.settings && CLUB.settings.engineV3 === false); } catch (e) { return true; } }
  function settings() { if (!CLUB.settings) CLUB.settings = {}; return CLUB.settings; }

  window.toggleEngineV3 = function () {
    const s = settings(); s.engineV3 = !on();
    if (s.engineV3) s.engineV2 = false;              // v3 löst v2 ab
    const b = document.getElementById('mgmt-engine3-btn');
    if (b) b.innerHTML = '<i class="ti ti-cpu" aria-hidden="true"></i> Räumliche Engine: ' + (on() ? 'an' : 'aus');
    if (typeof showToast === 'function') {
      showToast(on() ? 'Räumliche Engine aktiv — nach dem Spiel gibt es die Spielanalyse.'
                     : 'Räumliche Engine aus.', 'info');
    }
    try { if (typeof saveGameState === 'function') saveGameState(); } catch (e) {}
  };

  // ── Teams bauen: dieselbe Logik wie v2, die Engines nehmen dasselbe Format ──
  function buildOwn() {
    if (!(window.EngineV2Adapter && EngineV2Adapter.buildOwnTeam)) return null;
    const t = EngineV2Adapter.buildOwnTeam();
    t.bench = eigeneBank(t);
    return t;
  }
  function buildOpp() {
    if (!(window.EngineV2Adapter && EngineV2Adapter.buildOppTeam)) return null;
    const t = EngineV2Adapter.buildOppTeam();
    if (Array.isArray(t.bench) && t.bench.length) return t;        // echter Kader (DFL, dfl_engine_patch.js) bringt seine Bank mit
    // Gegnerbank: etwas schwächer als die Startelf, dafür ausgeruht
    t.bench = t.players.slice(1, 8).map((p, i) => Object.assign({}, p, {
      name: p.name + '-E', num: 12 + i,
      ovr: (p.ovr || 65) - 4, att: (p.att || 60) - 4, mid: (p.mid || 60) - 4,
      def: (p.def || 60) - 4, pace: (p.pace || 60) - 3, fit: 97
    }));
    return t;
  }

  // DFL D95 (Positionen mit Seite): die Engine kennt nur die Rollen ohne Seite (AV, AM, FL) – der Einwechsler bringt seine
  // Detailwerte für die Stammposition mit (LV/RV wie AV, LM/RM eigenes Profil, LF/RF wie FL)
  const ROLLE = { LV: 'AV', RV: 'AV', LM: 'AM', RM: 'AM', LF: 'FL', RF: 'FL' };
  // Ersatzbank aus dem echten Kader: alle, die nicht in der Startelf stehen,
  // sortiert nach Stärke × Fitness. Feldspieler zuerst, Torhüter zuletzt.
  function eigeneBank(team) {
    try {
      const drin = {};
      (team.players || []).forEach(p => { if (p._ref) drin[p._ref.id] = 1; });
      const alle = (typeof SQUAD !== 'undefined' && SQUAD) ? SQUAD : [];
      // Development Squad, Verletztenliste, Verletzte und Gesperrte sitzen nicht auf der Bank
      return alle.filter(p => p && !drin[p.id] && !p.perspektiv && !p.verletztenliste
          && !(typeof isInjured === 'function' && isInjured(p)) && !(typeof isSuspended === 'function' && isSuspended(p)))
        .map(p => ({
          name: (p.firstName ? p.firstName + ' ' : '') + p.name,
          num: p.number || 0,
          pos: (function (x) { return ROLLE[x] ? ROLLE[x] : x; })((p.positions && p.positions[0]) || p.pos || 'ZM'),
          werte: ROLLE[(p.positions && p.positions[0]) || p.pos] && typeof window.spielerWerte === 'function' ? window.spielerWerte(p) : undefined,
          ovr: p.ovr || 60, att: p.att || 55, mid: p.mid || 55, def: p.def || 55,
          pace: p.pace || 55, technik: (p.technik != null ? p.technik : p.mid) || 55,
          // Der Kader führt das Feld als `fitness`; `fit` gab es hier nie, die
          // Bank wurde deshalb immer mit Standardwert 95 sortiert.
          fit: p.fitness != null ? p.fitness : (p.fit != null ? p.fit : 95),
          _ref: p
        }))
        .sort((a, b) => (b.ovr * (b.fit / 100)) - (a.ovr * (a.fit / 100)))
        .filter(p => p.pos !== 'TW')
        .slice(0, 7);
    } catch (e) { return []; }
  }

  // Der Engine-Spieler trägt _ref auf den Eingabe-Datensatz, der wiederum _ref
  // auf den echten Kaderspieler trägt. Beide Ebenen abklopfen.
  function echterSpieler(ev) {
    let r = ev && ev.player && ev.player._ref;
    if (r && r._ref) r = r._ref;
    return (r && r.id != null) ? r : null;
  }
  function anzeigeName(ev) {
    const r = echterSpieler(ev);
    if (r) return (r.firstName ? r.firstName + ' ' : '') + r.name;
    return (ev && ev.player && ev.player.name) || 'Unbekannt';
  }

  function pickCardPlayer() {
    const ids = (typeof getLineupIds === 'function') ? getLineupIds() : [];
    const ps = ids.map(getPlayer).filter(Boolean);
    if (!ps.length) return null;
    const w = ps.map(p => {
      const pos = (p.positions && p.positions[0]) || p.pos;
      return { p, w: ['IV', 'AV', 'ZDM', 'ZM'].includes(pos) ? 3 : 1 };
    });
    let tot = w.reduce((a, b) => a + b.w, 0), r = Math.random() * tot;
    for (const x of w) { r -= x.w; if (r <= 0) return x.p; }
    return ps[0];
  }

  // ── EINZELLEISTUNG AUS DER AUFZEICHNUNG ────────────────────────────────────
  // Die Note kannte bisher nur Tore, Karten, Ergebnis und Teamstatistik. Ein
  // Stürmer konnte deshalb faktisch nicht schlecht bewertet werden — Gegentore
  // zählen für ihn null, und Fehlleistungen tauchten nirgends auf. Unter 5,5
  // lagen gemessen 2,4 % aller Noten, die Krisen-Serie war praktisch
  // unerreichbar.
  //
  // Die Aufzeichnung weiß es besser: Sie hält für jedes Bild fest, wer den Ball
  // führt. Daraus lassen sich drei echte Einzelwerte ableiten:
  //   · Ballverluste, gemessen am eigenen Ballbesitzanteil
  //   · vergebene Großchancen (miss-Ereignisse mit hohem xG)
  //   · Patzer: der letzte eigene Ballführende vor einem Gegentor
  function spielerLeistung(res) {
    if (!res || !res.frames || !res.frameCount) return null;
    const F = res.frames, S = res.stride, n = res.frameCount;

    // 1) Zeitleiste je Feldposition: wer stand wann auf diesem Platz? Nach einem
    //    Wechsel gehört der Platz jemand anderem — ohne das würden Aktionen dem
    //    Falschen angelastet.
    const slots = [];
    for (let i = 0; i < 11; i++) slots.push([]);
    (res.events || []).forEach(function (ev) {
      if (ev.type !== 'wechsel' || ev.side !== 'home') return;
      const sl = (ev.slot != null) ? ev.slot : (ev.player && ev.player._i);
      if (sl == null || sl < 0 || sl > 10) return;
      slots[sl].push({ bis: ev.t, ref: ev.refAus || null });
    });
    for (let i = 0; i < 11; i++) {
      const akt = (res.players && res.players[i]) ? res.players[i]._ref : null;
      slots[i].sort(function (a, b) { return a.bis - b.bis; });
      slots[i].push({ bis: Infinity, ref: akt });
    }
    function refFuer(slot, t) {
      const l = slots[slot] || [];
      for (let k = 0; k < l.length; k++) if (t <= l[k].bis) return l[k].ref;
      return null;
    }

    const daten = {}, refListe = {};
    function eintrag(ref) {
      if (!ref || ref.id == null) return null;
      refListe[ref.id] = ref;
      if (!daten[ref.id]) daten[ref.id] = { besitz: 0, verluste: 0, eroberungen: 0,
                                            abgefangen: 0, zweikaempfe: 0, vergeben: 0, patzer: 0,
                                            paesse: 0, paesseAn: 0, dribblings: 0, dribbelVersuche: 0 };
      return daten[ref.id];
    }

    // 2) Ballbesitz je Spieler und Ballverluste an den Gegner
    let vorIdx = -1, vorZeit = 0, eigenBesitz = 0, eigenVerluste = 0, eigenEroberungen = 0;
    for (let i = 0; i < n; i++) {
      const o = i * S, t = F[o + 47];
      const dt = (i + 1 < n) ? (F[(i + 1) * S + 47] - t) : 0;
      const halter = F[o + 46];
      if (dt > 0 && dt <= 5 && halter >= 0 && halter < 11) {
        const e = eintrag(refFuer(halter, t));
        if (e) { e.besitz += dt; eigenBesitz += dt; }
      }
      if (halter >= 0 && halter !== vorIdx) {
        if (vorIdx >= 0 && vorIdx < 11 && halter >= 11) {
          const e = eintrag(refFuer(vorIdx, vorZeit));
          if (e) { e.verluste++; eigenVerluste++; }
        }
        // BALLEROBERUNG: das Gegenstück zum Verlust. Ohne diesen Wert hätte ein
        // Innenverteidiger keinerlei messbare Leistung — seine Note hing allein
        // an Gegentoren und damit an der ganzen Mannschaft.
        if (vorIdx >= 11 && halter >= 0 && halter < 11) {
          const e = eintrag(refFuer(halter, t));
          if (e) { e.eroberungen++; eigenEroberungen++; }
        }
        vorIdx = halter; vorZeit = t;
      }
    }

    // 3) DEFENSIVAKTIONEN. Die Engine entscheidet Abfangen über Stellungsspiel
    //    und Spielintelligenz, Zweikämpfe über Tackling und Eins-gegen-eins —
    //    und protokolliert beides längst mit Spielerbezug. Der erste Versuch
    //    über Ballbesitzwechsel in der Aufzeichnung war zu grob: Er zählte auch
    //    Abstöße, Einwürfe und lose Bälle mit und zeigte deshalb keinerlei
    //    Zusammenhang zur Klasse des Verteidigers (10,8 % Anteil bei OVR 58 wie
    //    bei OVR 90).
    (res.events || []).forEach(function (ev) {
      if (ev.side !== 'home' || !ev.player) return;
      if (ev.type === 'intercept') { const e = eintrag(ev.player._ref); if (e) e.abgefangen++; }
      else if (ev.type === 'tackle') { const e = eintrag(ev.player._ref); if (e) e.zweikaempfe++; }
      // Pässe und Flanken tragen ok:true/false — daraus wird die Passquote.
      else if (ev.type === 'pass' || ev.type === 'cross') {
        const e = eintrag(ev.player._ref);
        if (e) { e.paesse++; if (ev.ok) e.paesseAn++; }
      }
      // Dribbling gegen einen Mann: gelungen oder verloren.
      else if (ev.type === 'dribble') {
        const e = eintrag(ev.player._ref);
        if (e) { e.dribbelVersuche++; if (ev.ok) e.dribblings++; }
      }
    });

    // 4) Vergebene Großchancen und Patzer vor dem Gegentor
    (res.events || []).forEach(function (ev) {
      if (ev.side !== 'home') return;
      // Schwelle an der echten xG-Verteilung der Engine kalibriert: Median 0,11,
      // 90. Perzentil 0,17. Bei 0,30 wäre praktisch nie eine Chance „groß"
      // gewesen (0,04 je Spiel). 0,155 trifft rund eine je Spiel — das entspricht
      // dem, was man als vergebene Hundertprozentige empfinden würde.
      if (ev.type === 'miss' && (ev.xg || 0) >= 0.155) {
        const e = eintrag(ev.player && ev.player._ref);
        if (e) e.vergeben++;
      } else if (ev.type === 'save' && (ev.xg || 0) >= 0.28) {
        // Vom Torwart gehalten zählt halb: die Chance war da, der Abschluss zu
        // schwach — aber immerhin aufs Tor.
        const e = eintrag(ev.player && ev.player._ref);
        if (e) e.vergeben += 0.5;
      }
    });
    (res.events || []).forEach(function (ev) {
      if (ev.type !== 'goal' || ev.side !== 'away') return;
      // Wer hatte den Ball zuletzt für uns, höchstens 20 Sekunden vor dem Tor?
      let bester = null;
      for (let i = n - 1; i >= 0; i--) {
        const t = F[i * S + 47];
        if (t > ev.t) continue;
        if (ev.t - t > 20) break;
        const h = F[i * S + 46];
        if (h >= 0 && h < 11) { bester = refFuer(h, t); break; }
      }
      const e = eintrag(bester);
      if (e) e.patzer++;
    });

    // 5) Erwartungswerte. Ballverluste: wer den Ball oft hat, verliert ihn
    //    öfter — bewertet wird nur, was darüber hinausgeht. Defensivaktionen:
    //    gemessen wird gegen den Positionsschnitt, sonst stünde jeder Stürmer
    //    als Faulpelz da und jeder Verteidiger als Held.
    const SOLL = { TW: 1.5, IV: 8.0, AV: 8.5, ZDM: 9.0, ZM: 8.5, ZOM: 6.5,
                   OM: 6.0, AM: 6.0, FL: 5.5, ST: 4.0 };
    Object.keys(daten).forEach(function (id) {
      const d = daten[id];
      d.anteil = eigenBesitz > 0 ? d.besitz / eigenBesitz : 0;
      d.erwartet = d.anteil * eigenVerluste;
      d.ueber = Math.max(0, d.verluste - d.erwartet);
      d.defAktionen = d.abgefangen + d.zweikaempfe;
      const ref = refListe[id];
      const soll = SOLL[(ref && ref.pos) || 'ZM'] || 7;
      d.defSoll = soll;
      d.defDelta = d.defAktionen - soll;     // positiv = überdurchschnittlich
      // Passquote: erst ab genug Pässen aussagekräftig, sonst entscheidet ein
      // einzelner Fehlpass über die Note eines Einwechselspielers.
      d.passquote = d.paesse >= 12 ? d.paesseAn / d.paesse : null;
      // Dribblings: gewonnene minus verlorene Zweikämpfe am Ball.
      d.dribbelDelta = d.dribblings - (d.dribbelVersuche - d.dribblings);
    });
    return { spieler: daten, teamBesitz: Math.round(eigenBesitz),
             teamVerluste: eigenVerluste, teamEroberungen: eigenEroberungen };
  }

  // ── Hauptlauf ──────────────────────────────────────────────────────────────
  // AUFGETEILT: runV3() rechnet das Spiel und pfeift an, verbucheErgebnis()
  // trägt Tore, Karten, Statistik und Tabelle ein. Getrennt, damit das Ergebnis
  // wirklich erst mit dem Abpfiff zählt.
  let OFFEN = null;                 // gerechnetes, noch nicht gewertetes Spiel

  function runV3() {
    if (OFFEN) return true;         // es läuft bereits ein Spiel
    try { if (typeof window.autoFillLineup === 'function') window.autoFillLineup(); } catch (e) {}
    const H = buildOwn(), A = buildOpp();
    if (!H || !A || H.players.length < 7) return false;

    // FCM wird IMMER als Heim-Objekt übergeben, spielt aber nicht immer zu Hause —
    // homeAdv sagt der Engine, wer den Heimvorteil bekommt. Fehlte bisher ganz.
    const heim = (typeof FCM_IS_HOME !== 'undefined' && FCM_IS_HOME) ? 'H' : 'A';
    const res = MatchEngineV3.simulateMatch(H, A, {
      seed: (Math.random() * 1e9) | 0, record: true, homeAdv: heim,
      // Spielstil (D55, dfl_taktik_patch.js): [eigener Verein, Gegner]; ohne DFL keiner
      stilFaktor: (window.DFLTaktik && DFLTaktik.engineFaktoren) ? DFLTaktik.engineFaktoren() : null
    });
    const season = (typeof LEAGUE !== 'undefined' && LEAGUE) ? LEAGUE.season : 1;
    const friendly = (typeof CURRENT_FIXTURE !== 'undefined' && CURRENT_FIXTURE && CURRENT_FIXTURE.type === 'friendly');

    // Aufzeichnung für Spielanalyse und Spielernoten bereitlegen
    window.LAST_MATCH_2D = {
      frames: res.frames, frameCount: res.frameCount, stride: res.stride,
      events: res.events, score: res.score, stats: res.stats,
      teams: [H, A],
      namen: [(typeof clubShort === 'function' ? clubShort() : 'FCM'),
              (typeof TEAMS !== 'undefined' && TEAMS.away ? (TEAMS.away.shortTag || TEAMS.away.name) : 'Gegner')]
    };
    OFFEN = { res: res, season: season, friendly: friendly, S: res._S || null };

    return verbucheErgebnis();
  }

  // Trägt das gerechnete Spiel in den Spielstand ein. Läuft garantiert nur
  // einmal — OFFEN wird zuerst geleert.
  function verbucheErgebnis() {
    if (!OFFEN) return false;
    const res = OFFEN.res;
    const season = OFFEN.season, friendly = OFFEN.friendly;
    OFFEN = null;
    const sh = res.stats.home, sa = res.stats.away;

    // Einzelleistungen bereitlegen, BEVOR processFixtureResult läuft — dort
    // hängt die Notenvergabe dran.
    try { window.LAST_MATCH_PERF = spielerLeistung(res); }
    catch (e) { window.LAST_MATCH_PERF = null; console.warn('[EngineV3] Einzelleistung', e); }

    // Ergebnis + Statistik (FCM ist IMMER home — Engine-Konvention des Spiels)
    G.homeGoals = sh.goals; G.awayGoals = sa.goals;
    G.min = 90; G.running = false; G.halfDone = true; G.ended = true;
    G.shots = [sh.shots, sa.shots];
    G.corners = [sh.corners, sa.corners];
    G.fouls = [sh.fouls, sa.fouls];
    G.poss = [sh.possPct, sa.possPct];
    G.passAcc = [Math.round(sh.passAcc / Math.max(1, sh.passes) * 100),
                 Math.round(sa.passAcc / Math.max(1, sa.passes) * 100)];
    G.goalLog = G.goalLog || []; G.scorers = G.scorers || []; G.cards = G.cards || [];
    // Prüfung Spielbericht 2026-10-10: Zweikämpfe standen immer bei 50 % : 50 % (G.duelQuote nie gesetzt) – jetzt aus den
    // Duellen der Engine: Tackling, Luftduell und Ballannahme gewinnt die Seite des Ereignisses, ein misslungenes Dribbling
    // die andere Seite. Gegentore mit Schütze für den Bericht (nicht in G.scorers: Noten lesen das als eigene Tore).
    {
      const zk = [0, 0];
      res.events.forEach(ev => {
        const s = ev.side === 'home' ? 0 : 1;
        if (ev.type === 'tackle' || ev.type === 'luftduell' || ev.type === 'annahme') zk[s]++;
        else if (ev.type === 'dribble') zk[ev.ok ? s : 1 - s]++;
      });
      const n = zk[0] + zk[1];
      if (n) G.duelQuote = [Math.round(zk[0] / n * 100), 100 - Math.round(zk[0] / n * 100)];
    }
    G.gegnerTore = [];
    try { window.LAST_FIXTURE = (typeof CURRENT_FIXTURE !== 'undefined' && CURRENT_FIXTURE) ? Object.assign({}, CURRENT_FIXTURE) : null; } catch (e) { window.LAST_FIXTURE = null; }
    if (typeof updateScore === 'function') { try { updateScore(); } catch (e) { /* Anzeigetafel ist Beiwerk */ } }

    res.events.forEach(ev => {
      // Minute wie im Fußball: 0:30 ist die 1., 1:01 die 2. Minute; nach 90:00 Nachspielzeit (90+1')
      const roh = ev.t / 60, min = Math.max(1, Math.min(90, Math.floor(roh) + 1)), nach = roh >= 90 ? Math.floor(roh - 90) + 1 : 0;
      // Minute für den Ticker aus dem Ereignis (D77, Prüfung 2026-10-10: addEv nahm G.min – nach der Sofortwertung immer 90)
      const mt = nach ? `90+${nach}` : String(min);
      const own = ev.side === 'home';
      if (ev.type === 'goal') {
        G.goalLog.push({ min, team: own ? 'home' : 'away', momentumAtTime: G.momentum });
        if (own) {
          const real = echterSpieler(ev), nm = anzeigeName(ev);
          let as = ev.assist && ev.player && ev.assist.team === ev.player.team ? ev.assist._ref : null; if (as && as._ref) as = as._ref;
          // FEHLER BEHOBEN: Hier stand nur { min, name }. Die Notenvergabe liest
          // aber G.scorers[].id — ohne id wurde KEIN Tor der Note zugerechnet.
          // Die Vorlage kam dort ohnehin nie an; jetzt steht beides drin.
          G.scorers.push({ min, nach, name: nm, id: real ? real.id : null, art: ev.art || null,
                           assistId: (as && as.id != null && as !== real) ? as.id : null });
          if (!friendly && real && typeof addPlayerGoal === 'function') addPlayerGoal(real, season);
          if (!friendly && as && as.id != null && as !== real && typeof addPlayerAssist === 'function') addPlayerAssist(as, season);
          const wie = ev.art === 'freistoss' ? ' per direktem Freistoß' : (ev.art === 'elfmeter' ? ' vom Elfmeterpunkt' : '');
          addEv('goal', 0, `⚽ TOR für ${clubShort()}! ${nm} trifft${wie}.`, null, mt);
        } else {
          const wie = ev.art === 'freistoss' ? ' per Freistoß' : (ev.art === 'elfmeter' ? ' per Elfmeter' : '');
          G.gegnerTore.push({ min, nach, name: anzeigeName(ev), art: ev.art || null });
          addEv('goal', 1, `⚽ Tor für ${TEAMS.away.name}${wie}.`, null, mt);
        }
      } else if (ev.type === 'save' && ev.xg >= 0.10) {
        addEv('save', own ? 1 : 0, own
          ? `Große Chance für ${clubShort()} — der Torhüter pariert!`
          : `${clubShort()} klärt in höchster Not.`, null, mt);
      } else if (ev.type === 'miss' && ev.xg >= 0.14 && own) {
        addEv('chance', 0, `Riesenchance vergeben! ${anzeigeName(ev)} zielt zu ungenau.`, null, mt);
      } else if (ev.type === 'blocked' && ev.xg >= 0.14 && own) {
        addEv('chance', 0, `${anzeigeName(ev)} kommt zum Abschluss — geblockt.`, null, mt);
      } else if (ev.type === 'elfmeter') {
        if (own) addEv('chance', 0, `⚑ Elfmeter für ${clubShort()}! ${anzeigeName(ev)} übernimmt.`, null, mt);
        else addEv('chance', 1, `⚑ Elfmeter für ${TEAMS.away.name}.`, null, mt);
      } else if (ev.type === 'abseits' && own) {
        addEv('info', 0, `Abseits — ${anzeigeName(ev)} war zu früh gestartet.`, null, mt);
      } else if (ev.type === 'wechsel') {
        if (own) addEv('info', 0, `Wechsel bei ${clubShort()}: ${ev.ein} kommt für ${ev.aus}.`, null, mt);
        else addEv('info', 1, `Wechsel bei ${TEAMS.away.name}: ${ev.ein} kommt für ${ev.aus}.`, null, mt);
      } else if (ev.type === 'ecke' && own) {
        addEv('corner', 0, `Ecke für ${clubShort()}.`, null, mt);
      } else if (ev.type === 'yellow' || ev.type === 'red') {
        // Die Engine weiß seit den Regeln (2026-09-16), WER die Karte sieht —
        // vorher wurde hier ein zufälliger Spieler verwarnt, während die
        // Taktikansicht einen anderen Namen zeigte. Zufall nur noch als Notbehelf.
        const gelb = ev.type === 'yellow';
        if (own) {
          const p = echterSpieler(ev) || pickCardPlayer();
          const nm = p ? ((p.firstName ? p.firstName + ' ' : '') + p.name) : 'Ein Spieler';
          G.cards.push({ type: ev.type, player: nm, playerId: p ? p.id : null, team: 'home', min });
          if (!gelb && TEAMS.home) TEAMS.home.redCards = (TEAMS.home.redCards || 0) + 1;
          if (!friendly && p) {
            if (gelb && typeof addPlayerYellow === 'function') addPlayerYellow(p, season);
            if (!gelb && typeof addPlayerRed === 'function') addPlayerRed(p, season);
          }
          const grund = ev.grund === 'schwalbe' ? ' wegen einer Schwalbe' : (ev.grund === 'notbremse' ? ' — Notbremse' : '');
          addEv(ev.type, 0, gelb ? `${nm} sieht Gelb${grund}.` : `🟥 ${nm} sieht Rot${grund}! ${clubShort()} in Unterzahl.`, null, mt);
        } else {
          G.cards.push({ type: ev.type, player: anzeigeName(ev), playerId: null, team: 'away', min });
          if (!gelb && TEAMS.away) TEAMS.away.redCards = (TEAMS.away.redCards || 0) + 1;
          addEv(ev.type, 1, gelb ? `${TEAMS.away.name}: Gelbe Karte für ${anzeigeName(ev)}.` : `🟥 Rote Karte für ${anzeigeName(ev)} (${TEAMS.away.name}) — Unterzahl.`, null, mt);
        }
      } else if (ev.type === 'gelbrot') {
        // Die zwei Gelben stehen schon in G.cards — die Sperrenlogik (applyCardSuspensions zählt nur yellow/red) macht daraus
        // Gelb-Rot. Zusätzlich ein eigener Eintrag für Bericht und Note (Prüfung 2026-10-10: Gelb-Rot erschien nur als
        // zwei Gelbe, ohne Rot-Abzug in der Note, redCards blieb 0).
        const p = own ? echterSpieler(ev) : null;
        G.cards.push({ type: 'gelbrot', player: anzeigeName(ev), playerId: p ? p.id : null, team: own ? 'home' : 'away', min });
        const tm = own ? TEAMS.home : TEAMS.away; if (tm) tm.redCards = (tm.redCards || 0) + 1;
        if (own) addEv('red', 0, `🟨🟥 Gelb-Rot für ${anzeigeName(ev)} — ${clubShort()} in Unterzahl.`, null, mt);
        else addEv('red', 1, `🟨🟥 Gelb-Rot für ${anzeigeName(ev)} (${TEAMS.away.name}).`, null, mt);
      }
    });

    const tEnde = res.frames && res.frameCount ? res.frames[(res.frameCount - 1) * res.stride + 47] : 5400;
    addEv('info', -1, `Abpfiff (räumliche Engine): ${G.homeGoals}:${G.awayGoals} · Ballbesitz ${sh.possPct}% · ` +
      `Schüsse ${sh.shots}:${sa.shots} · xG ${sh.xg.toFixed(2)}:${sa.xg.toFixed(2)}`, null, tEnde >= 5400 ? `90+${Math.floor(tEnde / 60 - 90) + 1}` : '90');

    const tb = document.getElementById('time-badge');
    if (tb) { tb.textContent = 'FT'; tb.className = 'time-badge ft'; }

    if (typeof processFixtureResult === 'function') processFixtureResult();
    if (typeof updateUI === 'function') updateUI();
    if (typeof setupPostMatchButton === 'function') setupPostMatchButton();
    const sb = document.getElementById('sim-btn'); if (sb) sb.style.display = 'none';
    if (typeof window.zeigeAnalyseKnopf === 'function') window.zeigeAnalyseKnopf();
    if (window.PostMatchModal && typeof window.PostMatchModal.show === 'function') {
      try { window.PostMatchModal.show(); } catch (e) {}
    }
    return true;
  }

  if (typeof window.simulateCurrentFixture === 'function') {
    const _orig = window.simulateCurrentFixture;
    window.simulateCurrentFixture = function () {
      if (on() && window.MatchEngineV3) {
        if (typeof CURRENT_FIXTURE === 'undefined' || !CURRENT_FIXTURE) {
          if (typeof ensureFixtureLoaded === 'function') ensureFixtureLoaded();
        }
        if (typeof CURRENT_FIXTURE === 'undefined' || !CURRENT_FIXTURE) { alert('Kein Spiel geladen.'); return; }
        if (OFFEN) return;
        if (typeof G !== 'undefined' && (G.running || G.ended)) return;
        try { if (runV3()) return; } catch (e) { console.warn('[EngineV3] Fehler, falle zurück', e); }
      }
      return _orig.apply(this, arguments);
    };
    try { simulateCurrentFixture = window.simulateCurrentFixture; } catch (e) {}
  }

  // Beschriftung beim Laden auf den gespeicherten Zustand setzen
  function refreshBtn() {
    const b = document.getElementById('mgmt-engine3-btn');
    if (b) b.innerHTML = '<i class="ti ti-chart-dots" aria-hidden="true"></i> Räumliche Engine: ' + (on() ? 'an' : 'aus');
  }
  try { refreshBtn(); } catch (e) {}
  window.addEventListener('load', function () { try { refreshBtn(); } catch (e) {} });

  // buildOwn/buildOpp: dieselben Teams wie im echten Spiel (eigene Elf MIT Bank) – für Messwerkzeuge
  window.EngineV3Adapter = { runV3, refreshBtn, verbucheErgebnis, buildOwn, buildOpp, istOffen: function () { return !!OFFEN; } };
  console.log('[EngineV3Adapter v1] aktiv — Umschalter toggleEngineV3(), zeichnet Positionen für Spielanalyse und Spielernoten auf');
})();