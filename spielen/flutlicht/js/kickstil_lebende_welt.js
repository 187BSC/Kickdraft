/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · LEBENDE WELT  ·  v1   (Nutzer 2026-10-15: „dieselbe Logik wie im Draftkick … Entwicklung der Spieler
   auch außerhalb und Talente, die aus den Akademien kommen“)
   ─────────────────────────────────────────────────────────────────────────
   CLUB.npcSquads (npc_real_transfers_patch.js) ist ab jetzt DIE Welt der Ersten bis Dritten Liga:
     · ENTWICKLUNG wie in Kickdraft (DFLSaison.entwicklung): Tempo nach Entwicklungstyp, Spielpraxis (Startelf 1,2 ·
       Talentkader 1,05 · Spieltagskader 1,0 · sonst 0,8), Kurve nach Stärke (OVR 50 → 1,7 … 99 → 0,1), Jugendschub bis 20,
       verlorenes Jahr, Durchbruch, Körperalter, Abbau, Ruhestand nach Tabelle. Hängt sich über NpcKaderleben.entwickle /
       .hoertAuf in npc_kaderleben.js ein (dessen Nachwuchs bleibt). Training der KI nach Vereinsstärke (wie die Akademie-
       Stufe im Vereinsblatt).
     · GEGNER spielen mit dem lebenden Kader: window.AI_SQUADS liest die lebenden Kader (AwayScorers/kickstil_anbindung).
     · MARKT: Der Echt-Spieler-Pool (RealMarket) kommt aus den lebenden Kadern – mit aktuellem Alter und Stärke.
     · KAUF: Wer zum eigenen Verein wechselt, verschwindet beim alten Verein. VERKAUF an einen deutschen Verein: Der
       Spieler steht danach in dessen Kader.
     · AUFFÜLLEN: Kartei-Lücken (Havelse hat 4 Spieler) und Aufsteiger ohne Kader bekommen einen Kader nach Vereinsstärke.
   Regionalliga (seit 2026-10-16, Nutzer-Liste Punkt 6) gehört dazu: Kader nach Vereinsstärke, Entwicklung, Akademie,
   Kaderplanung wie die Profiligen. Europa: euro_kader.js (Alterskurve, Kaderplanung, Akademien seit 2026-10-16).
   API: KSLebendeWelt.cfg · .sicherstellen() · .bericht()
   Lädt nach npc_kaderleben.js, vor init_bootstrap.js.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const CFG = {
    typen: [['normal', 0.70], ['schnell', 0.12], ['star', 0.14], ['ausnahme', 0.04]],
    tempo: { normal: 1, schnell: 1.3, star: 1.3, ausnahme: 1.6 },
    kurve: [[50, 1.7], [55, 1.55], [60, 1.4], [65, 1.2], [70, 1.0], [75, 0.86], [80, 0.7], [85, 0.52], [90, 0.34], [95, 0.18], [99, 0.1]],
    jugend: { 21: 0.85, 22: 0.72 },
    praxis: { startelf: 1.2, talent: 1.05, kader: 1.0, sonst: 0.8 },
    talentPlaetze: 6, talentBis: 21,               // Talentkader (in Kickdraft „Development Squad“)
    training: { basis: 0.9, jeStufe: 0.02 },       // Stufe 1–10 aus der Vereinsstärke
    // Kickdraft-Kurve gilt für eine Liga um 83; Flutlicht reicht von 60 (Dritte Liga) bis 80 – dort läge der Faktor bei
    // 1,0–1,4 und die Kader wüchsen über 10 Saisons um 6 Punkte. Gesamttempo deshalb gedämpft (Messung siehe CLAUDE.md)
    tempoGesamt: 0.8,
    nachwuchsJeSaison: [1, 2],                     // npc_kaderleben.js hatte 1–3: nach 10 Saisons ein Viertel bis 21
    verlorenesJahr: 0.25, durchbruch: 0.15,
    // 2026-10-22 (Nutzer: „ab 29 deutlich größerer Decline … ab 30 ruhig −2 oder −3 auf der Bank … die 80–90 durch die Athletik …
    // junge verlieren Potenzial, wenn sie nicht spielen … bitte das alles auch für die Vereinskarriere“) – gleiche Zahlen wie
    // Kickdraft (dfl_saisonlauf.js CFG.spielzeit) und der eigene Verein (spielzeit_entwicklung.js); ersetzt verlorenesJahr
    spielzeit: { aktiv: true,
      jungBank: [[20, 2, 4, 1], [23, 1, 3, 0.7]], jungRotation: { bis: 23, minus: 1, chance: 0.3 },
      comeback: { bis: 25, luecke: 2, min: 1, max: 3, chance: 0.5 },
      altBank: [[29, 1, 2], [30, 2, 3], [32, 2, 4]], altRotation: [[30, 1, 1]],
      athletik: { ovrAb: 80, alterAb: 30, minus: 1 } },
    abbau: { ab: 31, abSchnell: 29, abTw: 34, max: 3 },
    koerper: { ab: 27, stamm: -0.1, bank: 0.5, min: -2, max: 3 },
    ruhestand: { 33: 0.10, 34: 0.18, 35: 0.30, 36: 0.45, 37: 0.65, 38: 0.85, 39: 1 }, ruhestandTwPlus: 2,   // etwas früher als Kickdraft (dort gibt es Free Agency)
    // Kein neuer Vertrag (Kickdraft hat dafür Vertragsende und Free Agency): Ergänzungsspieler ab 31 und Talente ohne
    // Einsatz verlassen den Verein (Ausland, tiefere Ligen) – sonst stehen nach 10 Saisons 15–20 % über 33 in den Kadern
    abgang: { altAb: 30, alt: 0.45, altKader: 0.25, altKaderAb: 32, jungBis: 22, jung: 0.35 },
    // Niveauanstieg in kaderstaerke.js (0,16/Saison) war für die eingefrorene Welt gedacht – jetzt entwickeln sich die Kader
    // selbst; gemessen ohne Halbierung +3 bis +4 OVR je Liga in 10 Saisons
    kaderstaerkeDrift: 0.08,
    mindestKader: 22, auffuellenBis: 24,            // Kartei-Lücken und Aufsteiger
    // Aufstieg der Besten: Wer deutlich über seinem Verein steht, wechselt zu einem passenden stärkeren (oder ins Ausland).
    // Ohne das blieben die Talente der Dritten Liga dort und wurden mit 30 die Besten der Liga (gemessen: 30–32-Jährige
    // im Schnitt 71 statt 61, Liga +4 in 10 Saisons)
    aufstieg: { ueber: 2, chance: 0.4, jePunkt: 0.1, max: 0.85, bisAlter: 30, abgebenMax: 4, holenMax: 5, kaderMax: 30,
                ausland: { ab: 84, bisAlter: 29, chance: 0.06 } },
    // Kaderplanung (2026-10-15): Vereine halten ihr gewohntes Niveau über Zugänge (Ausland/Vereinslose), wie echte Vereine
    // mit Budget. Ohne das verlor die Erste Liga mit der echten Alterskurve 3 OVR in 10 Saisons (nur Talente kamen nach).
    // Niveau = Ø beste Elf beim ersten Blick auf den Verein; unter Niveau − 1 → bis zu 3 Zugänge (Niveau −1 … +3, 23–29 J.)
    // Aufsteiger rüsten auf: Ziel mindestens Ligaschnitt − 3 (Ligaschnitt = Ø beste Elf der Liga zu Spielbeginn).
    // Breite: bis kader Spieler mit Ergänzungsspielern (Niveau −5 … −1, 24–31 J.) statt nur Jugend.
    planung: { unter: 1, max: 3, alter: [23, 29], kaderMax: 27, liga: 3, kader: 24, breite: [-5, -1], breiteAlter: [23, 29],
                // Vereinsstärke-Ziel (kaderstaerke.js) folgt der Liga: Aufsteiger mind. Ligaschnitt − 3, Absteiger höchstens + 4
                zielUnter: 3, zielUeber: 4 },   // 2026-10-17: Absteiger höchstens +4 (vorher +6, 40–52 % kamen sofort zurück)
    zielKader: 22,                                   // npc_kaderleben füllt mit Nachwuchs bis hierher (vorher 26: 28 % bis 21 J.)
  };

  const hatLiga = () => { try { return typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.tiers; } catch (e) { return false; } };
  const kader = () => (window.NpcRealTransfers && typeof NpcRealTransfers.npcSquads === 'function' && typeof CLUB !== 'undefined')
    ? NpcRealTransfers.npcSquads() : null;
  const posOvr = p => typeof computeOvrFromAreas === 'function' ? computeOvrFromAreas(p) : Math.round((p.def + p.mid + p.att) / 3);
  const zufall = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const runden = x => Math.floor(x) + (Math.random() < x - Math.floor(x) ? 1 : 0);
  function gewichtet(liste) { let r = Math.random(); for (const [w, g] of liste) { if ((r -= g) <= 0) return w; } return liste[0][0]; }
  const eigeneId = () => { try { return CLUB.dataClubId || null; } catch (e) { return null; } };
  const dataIdVon = t => t.dataId || (t.id === 'fcm' ? null : String(t.id).replace(/^club_/, ''));
  const nameKey = p => ((p.firstName || '') + ' ' + (p.name || '')).toLowerCase().replace(/\s+/g, ' ').trim();

  // Stärke um d verschieben: alle drei Bereiche gleich, so ändert sich die Positionsstärke genau um d
  function verschiebe(p, d) {
    if (!d) return;
    ['def', 'mid', 'att'].forEach(k => { p[k] = Math.max(20, Math.min(99, (+p[k] || 50) + d)); });
    p.ovr = Math.round((p.def + p.mid + p.att) / 3);
  }
  function ovrFaktor(o) {
    const k = CFG.kurve;
    if (o <= k[0][0]) return k[0][1];
    for (let i = 1; i < k.length; i++) if (o <= k[i][0]) return k[i - 1][1] + (k[i][1] - k[i - 1][1]) * (o - k[i - 1][0]) / (k[i][0] - k[i - 1][0]);
    return k[k.length - 1][1];
  }
  const koerperAlter = p => p.age + (p.koerper || 0);
  function trainingsStufe(kad) {
    const top = kad.map(posOvr).sort((a, b) => b - a).slice(0, 11);
    const o = top.length ? top.reduce((a, b) => a + b, 0) / top.length : 60;
    return Math.max(1, Math.min(10, Math.round((o - 52) / 4.5)));
  }

  // Rollen der abgelaufenen Saison: beste Elf (ein Torwart), Spieltagskader (7), Talentkader (bis 21, 6 Plätze)
  function rollen(kad) {
    const r = new Map(), sortiert = kad.slice().sort((a, b) => posOvr(b) - posOvr(a));
    const tw = sortiert.find(p => p.pos === 'TW');
    const elf = (tw ? [tw] : []).concat(sortiert.filter(p => p.pos !== 'TW').slice(0, tw ? 10 : 11));
    elf.forEach(p => r.set(p, 'startelf'));
    sortiert.filter(p => !r.has(p)).slice(0, 7).forEach(p => r.set(p, 'kader'));
    kad.filter(p => !r.has(p) && p.age <= CFG.talentBis).sort((a, b) => (b.truePotential || 0) - (a.truePotential || 0))
      .slice(0, CFG.talentPlaetze).forEach(p => r.set(p, 'talent'));
    return r;
  }

  // ── Entwicklung eines Kaders um eine Saison (statt Schritt 1 in npc_kaderleben.js) ──────────
  // Welt-Thermostat (Langzeitlauf 2026-10-17: ohne Gegenhalt stiegen alle Ligen in 5 Saisons um 4–8 Punkte, die Regionalliga
  // um 7): liegt eine Liga über ihrem Startniveau (ligaNiveau, beim ersten Aufruf gemerkt) plus dem erlaubten Anstieg, entwickeln
  // sich ihre KI-Spieler etwas langsamer (je Punkt Überschuss 35 % Chance auf −1). Nutzer: „die KI darf im späteren Spiel ruhig
  // besser werden … aber ab Saison 10“ → erlaubt bis Saison 10 +1, danach +0,3 je Saison bis +4. Nie für den eigenen Verein.
  const THERMO = { bis10: 1, jeSaison: 0.3, max: 4, abSaison: 10, jePunkt: 0.35 };
  let thermoCache = { s: null, m: null };
  function thermo(kad) {
    try {
      if (thermoCache.s !== LEAGUE.season) {
        const start = ligaNiveau(), sq = kader() || {}, m = new Map(), summe = {}, eig = eigeneId();
        const erlaubt = THERMO.bis10 + Math.min(THERMO.max - THERMO.bis10, Math.max(0, ((LEAGUE.season || 1) - THERMO.abSaison) * THERMO.jeSaison));
        allGroups(LEAGUE).forEach(g => g.group.teams.forEach(t => { const d = dataIdVon(t), k = d && sq[d]; if (k && d !== eig && k.length >= 11) { m.set(k, g.tierKey); (summe[g.tierKey] = summe[g.tierKey] || []).push(niveau(k)); } }));
        const ueber = {}; Object.keys(summe).forEach(t => { if (start[t] == null) return; const jetzt = summe[t].reduce((a, b) => a + b, 0) / summe[t].length; ueber[t] = Math.max(0, jetzt - start[t] - erlaubt); });
        thermoCache = { s: LEAGUE.season, m, ueber };
      }
      const t = thermoCache.m.get(kad);
      return t ? (thermoCache.ueber[t] || 0) : 0;
    } catch (e) { return 0; }
  }
  function entwickle(kad) {
    const bremse = Math.min(0.9, thermo(kad) * THERMO.jePunkt);
    const rolle = rollen(kad), stufe = trainingsStufe(kad);
    const training = CFG.training.basis + CFG.training.jeStufe * stufe;
    kad.forEach(p => {
      if (!p.entwicklungstyp) p.entwicklungstyp = gewichtet(CFG.typen);
      const ro = rolle.get(p) || 'sonst';
      p._rolle = ro;                     // für hoertAuf (gleich danach, wird dort gelöscht)
      const spielt = ro === 'startelf', imKader = spielt || ro === 'kader';
      // Körperalter: Stammspieler altern langsamer, wer nicht im Spieltagskader steht, schneller
      if (p.age >= CFG.koerper.ab && ro !== 'talent') {
        const d = spielt ? CFG.koerper.stamm : imKader ? 0 : CFG.koerper.bank;
        const neu = Math.max(CFG.koerper.min, Math.min(CFG.koerper.max, Math.round(((p.koerper || 0) + d) * 100) / 100));
        if (neu) p.koerper = neu; else delete p.koerper;
      }
      p.age = (p.age || 24) + 1;
      const o = posOvr(p), typ = p.entwicklungstyp;
      p.truePotential = Math.max(o, p.truePotential || o);
      const luecke = p.truePotential - o;
      const A = CFG.abbau, abbauAb = p.pos === 'TW' ? A.abTw : typ === 'schnell' ? A.abSchnell : A.ab;
      let d = 0;
      if (p.age <= 25 && luecke > 0) {
        const basis = p.age <= 22 ? zufall(2, 5) * (p.age <= 20 ? 1 : CFG.jugend[p.age] || 1) : zufall(1, 3);
        d = Math.min(luecke, runden(basis * CFG.tempoGesamt * CFG.tempo[typ] * training * CFG.praxis[ro] * ovrFaktor(o)));
        if (!CFG.spielzeit.aktiv && !imKader && ro !== 'talent' && p.age <= 23 && Math.random() < CFG.verlorenesJahr)
          p.truePotential = Math.max(o + d, p.truePotential - zufall(1, 3));
        if (spielt && (typ === 'star' || typ === 'ausnahme') && Math.random() < CFG.durchbruch)
          p.truePotential = Math.min(99, p.truePotential + zufall(2, 5));
      } else if (koerperAlter(p) < (window.Alterskurve ? Alterskurve.beginn(p) : abbauAb)) {
        d = luecke > 0 ? (Math.random() < 0.5 * ovrFaktor(o) ? 1 : 0) : zufall(-1, 1);
      } else if (window.Alterskurve) {
        // Kurve wie in echt (kickstil_alterskurve.js), mit dem Körperalter: Stammspieler später, Bankspieler früher
        d = -Alterskurve.verlust(p, koerperAlter(p));
      } else {
        d = -zufall(1, Math.max(1, Math.min(A.max, 1 + Math.floor(koerperAlter(p)) - abbauAb)));
      }
      if (CFG.spielzeit.aktiv && ro !== 'talent') d += spielzeitFolgen(p, o, d, spielt, imKader);
      if (bremse && Math.random() < bremse) d -= 1;
      d = Math.max(35, Math.min(99, o + d)) - o;
      verschiebe(p, d);
      p.truePotential = Math.max(posOvr(p), Math.min(99, p.truePotential));
    });
  }
  // Spielzeit-Folgen (2026-10-22): Potenzial der Jungen, Stärke der Älteren; gibt die zusätzliche Stärke-Änderung zurück
  function spielzeitFolgen(p, o, d, spielt, imKader) {
    const C = CFG.spielzeit, a = p.age;
    if (!spielt) {
      const jb = !imKader && C.jungBank.find(([bis]) => a <= bis);
      const v = jb ? (Math.random() < jb[3] ? zufall(jb[1], jb[2]) : 0) : (imKader && a <= C.jungRotation.bis && Math.random() < C.jungRotation.chance ? C.jungRotation.minus : 0);
      if (v) p.truePotential = Math.max(o + d, p.truePotential - v);
    }
    const cb = C.comeback;
    if (spielt && a <= cb.bis && p.truePotential - (o + d) <= cb.luecke && Math.random() < cb.chance) p.truePotential = Math.min(99, p.truePotential + zufall(cb.min, cb.max));
    const stufe = l => l.reduce((x, st) => (a >= st[0] ? st : x), null);
    const ab = !imKader ? stufe(C.altBank) : !spielt ? stufe(C.altRotation) : null;
    let x = ab ? -zufall(ab[1], ab[2]) : 0;
    if (o >= C.athletik.ovrAb && a >= C.athletik.alterAb && p.pos !== 'TW') x -= C.athletik.minus;
    return x;
  }
  function hoertAuf(p) {
    const a = Math.round(koerperAlter(p)) - (p.pos === 'TW' ? CFG.ruhestandTwPlus : 0);
    let chance = a >= 39 ? 1 : (CFG.ruhestand[a] || 0);
    const ro = p._rolle, G = CFG.abgang;
    delete p._rolle;
    if (ro === 'sonst' && a >= G.altAb) chance += G.alt;
    else if (ro === 'kader' && a >= G.altKaderAb) chance += G.altKader;
    else if (ro === 'sonst' && p.age <= G.jungBis) chance += G.jung;
    return Math.random() < chance;
  }
  if (window.Kaderstaerke) window.Kaderstaerke.driftProSaison = CFG.kaderstaerkeDrift;
  if (window.NpcKaderleben) { NpcKaderleben.zielKader = CFG.zielKader; NpcKaderleben.talenteProSaison = CFG.nachwuchsJeSaison; NpcKaderleben.entwickle = entwickle; NpcKaderleben.hoertAuf = hoertAuf; }
  else console.warn('[Kickstil-LebendeWelt] npc_kaderleben.js fehlt – Entwicklung inaktiv');

  // ── Aufstieg der Besten (einmal je Saisonende) ─────────────────────────────
  function niveau(kad) {
    const top = kad.map(posOvr).sort((a, b) => b - a).slice(0, 11);
    return top.length ? top.reduce((a, b) => a + b, 0) / top.length : 0;
  }
  function aufstieg() {
    const sq = kader();
    if (!sq) return [];
    const A = CFG.aufstieg, eig = eigeneId(), ids = Object.keys(sq).filter(id => id !== eig && (sq[id] || []).length >= 15);
    const lvl = {}; ids.forEach(id => { lvl[id] = niveau(sq[id]); });
    const geholt = {}, log = [];
    // 2026-10-16: der Transfermarkt der KI-Vereine (kickstil_ki_markt.js) ersetzt den ablösefreien „Aufstieg der Besten“
    // und die verschwindenden Auslands-Stars – die Kaderplanung unten bleibt als Netz für Lücken
    const markt = !!(window.KSMarkt && window.KSMarkt.aktiv);
    if (markt) { try { window.KSMarkt.saisonwechsel(); } catch (e) { console.warn('[Kickstil-LebendeWelt] Markt', e); } }   // Geld; Transfers ab KW 1
    if (!markt) ids.sort(() => Math.random() - 0.5).forEach(id => {
      const kad = sq[id];
      let abgegeben = 0;
      kad.slice().sort((a, b) => posOvr(b) - posOvr(a)).forEach(p => {
        if (abgegeben >= A.abgebenMax || p.age > A.bisAlter) return;
        const o = posOvr(p), diff = o - lvl[id];
        if (diff < A.ueber || Math.random() > Math.min(A.max, A.chance + A.jePunkt * (diff - A.ueber))) return;
        // Ziel: stärkerer Verein, zu dessen Niveau der Spieler passt (−3 … +2)
        const ziele = ids.filter(z => z !== id && lvl[z] > lvl[id] + 1 && lvl[z] >= o - 3 && lvl[z] <= o + 2 && (geholt[z] || 0) < A.holenMax);
        let nach = ziele.length ? ziele[Math.floor(Math.random() * ziele.length)] : null;
        if (!nach && !(o >= A.ausland.ab && p.age <= A.ausland.bisAlter && Math.random() < A.ausland.chance * 2)) return;
        kad.splice(kad.indexOf(p), 1); abgegeben++;
        if (nach) {
          p.clubId = nach; sq[nach].push(p); geholt[nach] = (geholt[nach] || 0) + 1;
          // Platz schaffen: der schwächste Ältere geht (Karriereende/tiefere Liga)
          if (sq[nach].length > A.kaderMax) {
            const weg = sq[nach].filter(x => x.age >= 28 && x !== p).sort((a, b) => posOvr(a) - posOvr(b))[0];
            if (weg) sq[nach].splice(sq[nach].indexOf(weg), 1);
          }
        }
        log.push({ p, o, von: id, nach });
      });
    });
    // Stars ins Ausland (auch von Spitzenvereinen, die niemand in Deutschland überbietet)
    if (!markt) ids.forEach(id => {
      const kad = sq[id];
      kad.filter(p => posOvr(p) >= A.ausland.ab && p.age <= A.ausland.bisAlter && Math.random() < A.ausland.chance).slice(0, 1).forEach(p => {
        kad.splice(kad.indexOf(p), 1); log.push({ p, o: posOvr(p), von: id, nach: null });
      });
    });
    // Kaderplanung: mit dem KI-Transfermarkt (KW 1–9) zum Saisonwechsel nur die Breite; Lücken füllt erst der Deadline-Day
    letzteZugaenge = planen(sq, ids, lvl, { luecken: !markt }).length;
    zielAnpassen();
    try {
      if (log.length && typeof addNews === 'function') {
        const nm = id => { const c = (window.EMBEDDED_CLUBS || []).find(x => x.id === id); return c ? c.name : id; };
        const top = log.slice().sort((a, b) => b.o - a.o).slice(0, 6).map(x =>
          (x.p.firstName ? x.p.firstName + ' ' : '') + x.p.name + ' (' + x.p.pos + ', ' + x.p.age + ') — ' + nm(x.von) + ' → ' + (x.nach ? nm(x.nach) : 'Ausland'));
        addNews('transfer', '📈 ' + log.length + ' Spieler machen den nächsten Schritt', 'Die größten Namen:\n• ' + top.join('\n• '));
      }
    } catch (e) { /* ohne Meldung */ }
    letzterAufstieg = log.length;
    return log;
  }
  // Kaderplanung (ausgelagert 2026-10-16): Lücken in der Elf mit Zugängen (Ausland/Vereinslose) füllen, Breite auffüllen,
  // zu große Kader verkleinern. opt.luecken = false → nur Breite und Größe. Rückgabe: [{ p, id }] der erzeugten Spieler.
  function planen(sq, ids, lvl, opt) {
    opt = opt || {};
    const neu = [];
    const start = startNiveau(), P = CFG.planung, drift = (CLUB.staerke && CLUB.staerke.drift) || 0;
    let zugaenge = 0;
    const liga = ligaNiveau(), tierVon = {};
    try { allGroups(LEAGUE).forEach(g => g.group.teams.forEach(t => { const d = dataIdVon(t); if (d) tierVon[d] = g.tierKey; })); } catch (e) { /* ohne Liga */ }
    ids.forEach(id => {
      const kad = sq[id];
      if (start[id] == null) start[id] = lvl[id];
      // Aufsteiger (KI-Markt, erste Saison in der neuen Liga): Lücken bis zum Ligaschnitt statt − 3, bis zu 5 Zugänge (Nutzer
      // 2026-10-17: „Aufsteiger versuchen sich durch erfahrene günstige Spieler gezielt zu verbessern“)
      const aufst = !!(window.KSMarkt && KSMarkt.aufsteiger && KSMarkt.aufsteiger(id));
      const boden = liga[tierVon[id]] != null ? liga[tierVon[id]] - (aufst ? 0 : P.liga) : -Infinity;
      const T = Math.max(start[id], boden) + drift;
      for (let n = 0; opt.luecken !== false && n < (aufst ? 5 : P.max) && niveau(kad) < T - P.unter; n++) {
        // die schwächste Stelle der besten Elf ersetzen
        const elf = kad.slice().sort((a, b) => posOvr(b) - posOvr(a)).slice(0, 11);
        const schwach = elf.sort((a, b) => posOvr(a) - posOvr(b))[0];
        const pos = schwach ? schwach.pos : 'ZM';
        const z = erzeugeSpieler(id, pos, Math.round(T + zufall(-2, 1)), { alter: aufst ? [27, 31] : P.alter, ausland: true });   // 2026-10-17: vorher −1…+3 (Lückenfüller über dem Ziel)
        kad.push(z); neu.push({ p: z, id });
        zugaenge++;
      }
      // Breite: erfahrene Ergänzungsspieler statt nur Jugend
      while (kad.length < P.kader) {
        const pos = SCHABLONE[Math.floor(Math.random() * SCHABLONE.length)];
        kad.push(erzeugeSpieler(id, pos, Math.round(T + zufall(P.breite[0], P.breite[1])), { alter: P.breiteAlter, ausland: Math.random() < 0.5 }));
        zugaenge++;
      }
      while (kad.length > P.kaderMax) {
        const elf = new Set(kad.slice().sort((a, b) => posOvr(b) - posOvr(a)).slice(0, 14));
        const weg = kad.filter(x => !elf.has(x)).sort((a, b) => (posOvr(a) - (a.age <= 21 ? 3 : 0)) - (posOvr(b) - (b.age <= 21 ? 3 : 0)))[0];
        if (!weg) break;
        kad.splice(kad.indexOf(weg), 1);
      }
    });
    return neu;
  }
  function zielAnpassen() {
    const P = CFG.planung;
    // Ziel der Vereinsstärke an die Liga anpassen (sonst blieb ein Aufsteiger bei seinem Zweitliga-Ziel + 4 gedeckelt)
    try {
      const st = CLUB.staerke, lo = ligaOvr();
      if (st && st.ziel) allGroups(LEAGUE).forEach(g => {
        if (lo[g.tierKey] == null) return;
        g.group.teams.forEach(t => {
          if (st.ziel[t.id] == null) return;
          st.ziel[t.id] = Math.max(lo[g.tierKey] - P.zielUnter, Math.min(lo[g.tierKey] + P.zielUeber, st.ziel[t.id]));
        });
      });
    } catch (e) { /* ohne Stärke-Modul */ }
  }
  let letzterAufstieg = 0, letzteZugaenge = 0;
  // Gewohntes Niveau je Verein (Ø beste Elf beim ersten Blick) – Ziel der Kaderplanung
  // Ligaschnitt zu Spielbeginn (Ø beste Elf je Liga, ohne Regionalliga) – Boden für Aufsteiger
  function ligaNiveau() {
    if (!CLUB.welt) CLUB.welt = {};
    if (CLUB.welt.lwLiga && CLUB.welt.lwLiga.regionalliga != null) return CLUB.welt.lwLiga;   // alter Zwischenspeicher ohne Regionalliga: neu
    const sq = CLUB.npcSquads || {}, summe = {};
    try { allGroups(LEAGUE).forEach(g => { g.group.teams.forEach(t => { const d = dataIdVon(t); if (d && sq[d] && sq[d].length >= 15) (summe[g.tierKey] = summe[g.tierKey] || []).push(niveau(sq[d])); }); }); } catch (e) { return {}; }
    const out = {}; Object.keys(summe).forEach(k => { out[k] = summe[k].reduce((a, b) => a + b, 0) / summe[k].length; });
    if (Object.keys(out).length) CLUB.welt.lwLiga = out;
    return out;
  }
  // Ø Vereinsstärke (team.ovr) je Liga zu Spielbeginn
  function ligaOvr() {
    if (!CLUB.welt) CLUB.welt = {};
    // 2026-10-16: über ALLE Gruppen mitteln (Regionalliga hat fünf – vorher galt nur die letzte); alter Zwischenspeicher ohne
    // Regionalliga wird neu gerechnet
    if (CLUB.welt.lwLigaOvr && CLUB.welt.lwLigaOvr.regionalliga != null) return CLUB.welt.lwLigaOvr;
    const out = {}, summe = {};
    try { allGroups(LEAGUE).forEach(g => { g.group.teams.forEach(t => { if (t.id !== 'fcm') (summe[g.tierKey] = summe[g.tierKey] || []).push(t.ovr || 60); }); }); } catch (e) { return {}; }
    Object.keys(summe).forEach(k => { out[k] = summe[k].reduce((a, b) => a + b, 0) / summe[k].length; });
    if (Object.keys(out).length) CLUB.welt.lwLigaOvr = out;
    return out;
  }
  function startNiveau() {
    if (!CLUB.welt) CLUB.welt = {};
    if (!CLUB.welt.lwNiveau) CLUB.welt.lwNiveau = {};
    return CLUB.welt.lwNiveau;
  }

  // ── Auffüllen: Kartei-Lücken und Aufsteiger ohne Kader ─────────────────────
  // Positionen mit Seite (2026-10-18)
  const SCHABLONE = ['TW', 'TW', 'IV', 'IV', 'IV', 'IV', 'LV', 'RV', 'LV', 'ZDM', 'ZDM', 'ZM', 'ZM', 'ZM', 'ZOM', 'ZOM', 'LF', 'RF', 'RM', 'ST', 'ST', 'ST', 'TW', 'ZM'];
  const BEREICH = { TW: 'def', IV: 'def', AV: 'def', LV: 'def', RV: 'def', ZDM: 'mid', ZM: 'mid', OM: 'mid', ZOM: 'mid', LM: 'mid', RM: 'mid', AM: 'mid', FL: 'att', LF: 'att', RF: 'att', ST: 'att' };
  function neuerName() {
    const SC = window.SCOUTING_COUNTRIES && window.SCOUTING_COUNTRIES.Deutschland;
    const vor = (SC && SC.first) || (typeof GERMAN_FIRST !== 'undefined' ? GERMAN_FIRST : ['Max']);
    const nach = (SC && SC.last) || (typeof TRANSFER_SURNAMES !== 'undefined' ? TRANSFER_SURNAMES : ['Neumann']);
    return { firstName: vor[Math.floor(Math.random() * vor.length)], name: nach[Math.floor(Math.random() * nach.length)] };
  }
  function auslandName() {
    if (window.KSNationen) return KSNationen.name(KSNationen.auslandLand('Deutschland'));   // gewichtet nach Export (2026-10-16)
    const SC = window.SCOUTING_COUNTRIES;
    const laender = SC ? Object.keys(SC).filter(l => SC[l] && SC[l].first && SC[l].last) : [];
    if (!laender.length) return Object.assign(neuerName(), { flag: '🇩🇪', country: 'Deutschland' });
    const l = laender[Math.floor(Math.random() * laender.length)], c = SC[l];
    return { firstName: c.first[Math.floor(Math.random() * c.first.length)], name: c.last[Math.floor(Math.random() * c.last.length)], flag: c.flag || '', country: l };
  }
  function erzeugeSpieler(clubId, pos, stark, opt) {
    opt = opt || {};
    const age = opt.alter ? zufall(opt.alter[0], opt.alter[1]) : 18 + zufall(0, 7) + zufall(0, 7), haupt = BEREICH[pos] || 'mid';   // 18–32, Schwerpunkt um 25
    const n = opt.ausland ? auslandName() : Object.assign(neuerName(), { flag: '🇩🇪', country: 'Deutschland' });
    const p = { firstName: n.firstName, name: n.name, flag: n.flag, country: n.country, age, pos, positions: [pos], clubId, _auffuell: !opt.ausland, _zugang: !!opt.ausland };
    // Hauptbereich = Zielstärke, die anderen darunter (wie die Kartei: Torhüter mit niedrigem Angriff)
    ['def', 'mid', 'att'].forEach(k => { p[k] = k === haupt ? stark : stark - zufall(6, pos === 'TW' ? 22 : 12); });
    const o = posOvr(p); verschiebe(p, stark - o);
    p.ovr = Math.round((p.def + p.mid + p.att) / 3);
    p.truePotential = Math.min(95, posOvr(p) + (age <= 23 ? zufall(3, 12) : age <= 26 ? zufall(0, 4) : 0));
    p.entwicklungstyp = gewichtet(CFG.typen);
    return p;
  }
  function auffuellen(t, kad) {
    const id = dataIdVon(t), ziel = t.ovr || 60;
    const fehlend = SCHABLONE.slice();
    kad.forEach(p => { const i = fehlend.indexOf(p.pos); if (i >= 0) fehlend.splice(i, 1); });
    let i = 0;
    while (kad.length < CFG.auffuellenBis) {
      const pos = fehlend.length ? fehlend.shift() : SCHABLONE[i++ % SCHABLONE.length];
      // Stammkräfte um die Vereinsstärke, Ergänzung darunter (wie gewachsene Kader)
      const stark = Math.round(ziel + (kad.length < 14 ? zufall(-2, 3) : zufall(-7, -2)));
      kad.push(erzeugeSpieler(id, pos, stark));
    }
  }
  function ligaTeams() {
    const out = [];
    try { allGroups(LEAGUE).forEach(g => g.group.teams.forEach(t => out.push(t))); } catch (e) { /* ohne Liga */ }
    return out;
  }
  let aufgefuellt = 0;
  function sicherstellen() {
    if (!hatLiga()) return false;
    const sq = kader();
    if (!sq) return false;
    // Fix: der eigene Verein stand bisher als NPC-Kader drin (ownClubId suchte t.realClubId) – Spieler doppelt
    const eig = eigeneId();
    if (eig && sq[eig]) delete sq[eig];
    ligaTeams().forEach(t => {
      const id = dataIdVon(t);
      if (!id || id === eig) return;
      const kad = sq[id] = sq[id] || [];
      if (kad.length < CFG.mindestKader) { const vor = kad.length; auffuellen(t, kad); aufgefuellt += kad.length - vor; }
    });
    abgleichen();
    { const st = startNiveau(); Object.keys(sq).forEach(id => { if (st[id] == null && id !== eig && sq[id].length >= 15) st[id] = niveau(sq[id]); }); ligaNiveau(); ligaOvr(); }
    try { if (typeof window.staerkeInit === 'function') window.staerkeInit(); } catch (e) { /* später */ }
    return true;
  }

  // ── Kauf und Leihe: Spieler des eigenen Kaders nicht mehr beim alten Verein ─────────────────
  function eigeneSchluessel() {
    const m = new Map();
    try { (typeof SQUAD !== 'undefined' ? SQUAD : []).forEach(s => m.set(nameKey(s), s)); } catch (e) { /* ohne Kader */ }
    return m;
  }
  function abgleichen() {
    const sq = CLUB && CLUB.npcSquads;
    if (!sq) return 0;
    let n = 0;
    try {
      SQUAD.forEach(s => {
        if (String(s.id || '').indexOf('sq_real_') !== 0 || s.onLoanFrom) return;   // nur fest verpflichtete Echt-Spieler
        const k = nameKey(s);
        Object.keys(sq).forEach(id => {
          const kad = sq[id], i = kad.findIndex(p => nameKey(p) === k && Math.abs((p.age || 0) - (s.age || 0)) <= 1);
          if (i >= 0) { kad.splice(i, 1); n++; }
        });
      });
    } catch (e) { /* ohne Kader */ }
    return n;
  }

  // ── Gegner: AI_SQUADS liest die lebenden Kader ─────────────────────────────
  const KARTEI = window.AI_SQUADS || {};
  window.AI_SQUADS = new Proxy(KARTEI, {
    get(ziel, k) {
      if (typeof k === 'string') {
        const sq = (typeof CLUB !== 'undefined' && CLUB && CLUB.npcSquads) || null;
        if (sq && Array.isArray(sq[k]) && sq[k].length >= 11) {
          const eigen = eigeneSchluessel();      // geliehene/gekaufte Spieler stehen beim eigenen Verein, nicht beim Gegner
          return eigen.size ? sq[k].filter(p => !eigen.has(nameKey(p))) : sq[k];
        }
      }
      return ziel[k];
    }
  });

  // ── Markt: Echt-Spieler-Pool aus den lebenden Kadern ───────────────────────
  const KARTEI_SPIELER = new Map();
  (window.EMBEDDED_PLAYERS || []).forEach(r => KARTEI_SPIELER.set(nameKey(r), r));
  function poolAuffrischen() {
    if (!hatLiga() || !window.RealMarket || typeof RealMarket.getPool !== 'function') return;
    const sq = kader();
    if (!sq) return;
    abgleichen();
    const liste = [];
    Object.keys(sq).forEach(id => (sq[id] || []).forEach(p => {
      const roh = KARTEI_SPIELER.get(nameKey(p));
      liste.push({ clubId: id, name: p.name, firstName: p.firstName || '', flag: p.flag || '', country: p.country || 'Deutschland',
        age: p.age, positions: p.positions || [p.pos || 'ZM'], def: p.def, mid: p.mid, att: p.att,
        pace: roh && roh.pace != null ? roh.pace : Math.round(Math.max(40, Math.min(95, (p.att + p.mid) / 2 - (p.age - 26) * 0.8))),
        mental: roh && roh.mental != null ? roh.mental : Math.round(Math.max(40, Math.min(95, (p.def + p.mid) / 2 + (p.age - 24) * 0.5))),
        truePotential: p.truePotential });
    }));
    if (liste.length < 100) return;
    const pool = RealMarket.getPool();       // dasselbe Array, das generateMarketPool liest (setPool würde den Markt neu bauen)
    pool.length = 0; liste.forEach(x => pool.push(x));
  }
  if (typeof window.generateMarketPool === 'function') {
    const _gen = window.generateMarketPool;
    window.generateMarketPool = function () { try { poolAuffrischen(); } catch (e) { console.warn('[Kickstil-LebendeWelt] Markt', e); } return _gen.apply(this, arguments); };
    try { generateMarketPool = window.generateMarketPool; } catch (e) { /* window reicht */ }
  }

  // ── Verkauf an einen deutschen Verein: Spieler steht danach in dessen Kader ─────────────────
  const NAME_ZU_ID = new Map();
  (window.EMBEDDED_CLUBS || []).forEach(c => { if (c && c.name) NAME_ZU_ID.set(c.name, c.id); });
  if (typeof window.acceptTransferBid === 'function') {
    const _acc = window.acceptTransferBid;
    window.acceptTransferBid = function (bidId) {
      let bid = null, sp = null;
      try { bid = (CLUB.transferBids || []).find(b => b.id === bidId); sp = bid && SQUAD.find(p => p.id === bid.playerId); } catch (e) { /* weiter */ }
      const r = _acc.apply(this, arguments);
      try {
        const sq = CLUB.npcSquads, name = bid && bid.club;
        const id = name && (NAME_ZU_ID.get(name) || NAME_ZU_ID.get(window.KSVereinsnamen ? KSVereinsnamen.alt(name) : name));
        if (r && sp && sq && id && sq[id]) {
          sq[id].push({ name: sp.name, firstName: sp.firstName || '', flag: sp.flag || '', country: sp.country || '', age: sp.age,
            positions: sp.positions || [sp.pos], pos: sp.pos, def: sp.def, mid: sp.mid, att: sp.att,
            ovr: Math.round((sp.def + sp.mid + sp.att) / 3), truePotential: Math.max(posOvr(sp), sp.truePotential || 0), clubId: id });
        }
      } catch (e) { console.warn('[Kickstil-LebendeWelt] Verkauf', e); }
      return r;
    };
    try { acceptTransferBid = window.acceptTransferBid; } catch (e) { /* window reicht */ }
  }

  // ── Zeitpunkte: Spielstart, Laden, Saisonende ──────────────────────────────
  // Vereine mit lebendem Kader: Stärke NUR aus dem Kader (kaderstaerke.js). Die abstrakte Entwicklung (bundle_europa.js
  // developAllNpcs) läuft vorher über alle Vereine und zog die Erste Liga in 10 Saisons um ~3 OVR nach unten (gemessen auch
  // ohne lebende Welt) – für diese Vereine wird ihr Ergebnis zurückgenommen, bevor die Kaderstärke rechnet.
  let vorher = null;
  function stärkenMerken() {
    vorher = new Map();
    const sq = (CLUB && CLUB.npcSquads) || {};
    try { allGroups(LEAGUE).forEach(g => g.group.teams.forEach(t => { const id = dataIdVon(t); if (id && sq[id] && sq[id].length >= 11) vorher.set(t, { def: t.def, mid: t.mid, att: t.att, ovr: t.ovr, npcAge: t.npcAge, baselineOvr: t.baselineOvr }); })); } catch (e) { vorher = null; }
  }
  if (window.NpcDevelopment && typeof NpcDevelopment.simulateNpcTransfers === 'function') {
    const _sim = NpcDevelopment.simulateNpcTransfers;
    NpcDevelopment.simulateNpcTransfers = function () {
      try { if (vorher) vorher.forEach((v, t) => Object.assign(t, v)); } catch (e) { /* weiter */ }
      vorher = null;
      return _sim.apply(this, arguments);
    };
  }
  if (typeof window.runEndOfSeason === 'function') {
    const _end = window.runEndOfSeason;
    window.runEndOfSeason = function () {
      try { stärkenMerken(); } catch (e) { vorher = null; }
      const r = _end.apply(this, arguments);
      try { aufstieg(); } catch (e) { console.warn('[Kickstil-LebendeWelt] Aufstieg', e); }
      try { sicherstellen(); } catch (e) { console.warn('[Kickstil-LebendeWelt] Saisonende', e); }   // Aufsteiger brauchen einen Kader
      return r;
    };
    try { runEndOfSeason = window.runEndOfSeason; } catch (e) { /* window reicht */ }
  }
  {
    const _orig = window.applyLoadedState;
    if (typeof _orig === 'function') {
      window.applyLoadedState = function () { const r = _orig.apply(this, arguments); setTimeout(sicherstellen, 0); return r; };
      try { applyLoadedState = window.applyLoadedState; } catch (e) { /* window reicht */ }
    }
  }
  // Neues Spiel: Liga entsteht erst nach der Vereinswahl → kurz prüfen, bis sie da ist
  let versuche = 0;
  const warte = setInterval(() => { if (sicherstellen() || ++versuche > 600) clearInterval(warte); }, 500);

  function bericht() {
    const sq = kader() || {}, alle = [].concat(...Object.values(sq));
    const ovr = alle.map(posOvr);
    return { vereine: Object.keys(sq).length, spieler: alle.length, aufgefuellt, wechselHoch: letzterAufstieg, zugaenge: letzteZugaenge,
      alter: +(alle.reduce((s, p) => s + p.age, 0) / Math.max(1, alle.length)).toFixed(2),
      ab33: +(alle.filter(p => p.age >= 33).length / Math.max(1, alle.length) * 100).toFixed(1),
      staerke: +(ovr.reduce((a, b) => a + b, 0) / Math.max(1, ovr.length)).toFixed(1) };
  }
  // Kaderplanung von außen (KI-Transfermarkt am Deadline-Day): Lücken, die der Markt nicht geschlossen hat
  function kaderplanung(opt) {
    const sq = kader(); if (!sq) return [];
    const eig = eigeneId(), ids = Object.keys(sq).filter(id => id !== eig && (sq[id] || []).length >= 11);
    const lvl = {}; ids.forEach(id => { lvl[id] = niveau(sq[id]); });
    return planen(sq, ids, lvl, opt || { luecken: true });
  }
  window.KSLebendeWelt = { cfg: CFG, sicherstellen, bericht, entwickle, hoertAuf, kaderplanung };
  console.log('[Kickstil-LebendeWelt v1] aktiv — Kickdraft-Entwicklung, Gegner und Markt aus den lebenden Kadern (Erste bis Dritte Liga)');
})();
