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
