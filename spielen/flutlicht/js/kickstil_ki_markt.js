/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · TRANSFERMARKT DER KI-VEREINE  ·  v1
   (Nutzer 2026-10-16: „die Welt mit Leben – und das geht nur durch kluge oder eben schlechte Transfers. Bitte sofort anpassen“)
   ─────────────────────────────────────────────────────────────────────────
   Vorher (Befund INTERNATIONAL.md): 1–5 Zufallswechsel je Sommer, Budget je Transfer gewürfelt, Ablöse nirgends gebucht,
   Auslandsvereine bekamen neu erzeugte Spieler, Stars verschwanden, ins Ausland Verkaufte tauchten nirgends auf.
   Jetzt – für alle Vereine mit Kader (Erste Liga bis Regionalliga, 155 Auslandsvereine; nie der eigene Verein):
   · KASSE je Verein: jährlicher Zufluss nach Liga und Stärke (verdoppelt sich alle CFG.verdopplung Punkte), Ausland nach
     Stärke × Land (England reicher), dazu Europapokal-Antrittsprämien und Ablösen aus Verkäufen. Höchstens CFG.kasseMax
     Jahreszuflüsse auf der Bank.
   · SPORTDIREKTOR (1–5★) je Verein: schätzt Stärke/Potenzial mit Fehler (5★ ±1, 1★ ±4,5), gute setzen auf Jugend und Preis,
     schlechte auf große Namen und zahlen drauf → kluge und schlechte Transfers. Urteil nach einem Jahr (Marktwert jetzt ÷ Ablöse).
   · BEDARF statt Zufall: schwächste/älteste Stelle der Elf (1 TW, 4 Abwehr, 3 Mittelfeld, 3 Angriff) oder zu dünne
     Mannschaftsteile; Suche in ALLEN Kadern (In- und Ausland), passend zu Niveau und Budget. Ablöse = Marktwert
     (computeMarketValue) × Aufschläge (Stammspieler, Star, Talent) – klamme Verkäufer geben nach.
   · VERKAUFEN: Stars gehen nur nach oben (oder bei Wechselwunsch/klammer Kasse), Ältere wechseln eher in kleinere Ligen.
     Verkäufer kassieren und kaufen in späteren Runden nach (Ketten). Zu große Kader geben ältere Ergänzungsspieler ab.
   · FENSTER: Sommer (beim Saisonwechsel, in kickstil_lebende_welt.js aufstieg() statt „Aufstieg der Besten“), Nachzügler am
     Deadline-Day (KW 9), Winter (KW 30). Danach Vereinsstärke neu (kaderstaerke.js).
   · SICHTBAR: Meldung je Fenster, Transfermarkt → Reiter „Welt“ (Ticker, Rekorde, Urteile), Vereinsblatt → „Transfers“
     (Kasse, Sportdirektor, Zu-/Abgänge), Mehr → Transferticker.
   Abgeschaltet, solange aktiv: Zufallstransfers (npc_real_transfers_patch.js), „Aufstieg der Besten“ (lebende Welt),
   verschwindende Stars und erzeugte Zugänge im Ausland (euro_kader.js: nur noch Notnagel bei großer Lücke).
   Zustand: CLUB.welt.kiMarkt = { v, k: { id: { kasse, sd } }, b: { id: { ein, aus } }, log: [...], rek: [...] }.
   API: KSMarkt.aktiv · .fenster(art) · .verein(id) · .liste(filter) · .oeffnen() · .vereinHtml(id) · .CFG
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const CFG = {
    zufluss: { bundesliga: [25e6, 80], bundesliga2: [3e6, 70], liga3: [0.6e6, 61], regionalliga: [0.1e6, 55] },
    zuflussEuro: { basis: 25e6, mittel: 80, land: { 1: 1.3, 2: 1.0, 3: 0.6, 4: 0.4, 5: 0.25, 6: 0.15 }, England: 1.6 },
    verdopplung: 4, kasseMax: 3, start: 1.0,
    // Wochen im Fenster (Nutzer 2026-10-16: „der Markt startet an KW 1“): Chance je Verein und Woche, Bedarfsschwelle, Budgetanteil
    woche: {
      // Nutzer 2026-10-16: „in den ersten 1–3 Wochen je 50 Wechsel, sonst wird's zu weird“
      start:    { chance: 0.2,  bedarf: 2.5, anteil: 0.85 },   // KW 1
      frueh:    { chance: 0.2,  bedarf: 2.5, anteil: 0.85 },   // KW 2–3
      sommer:   { chance: 0.04, bedarf: 2.5, anteil: 0.85 },   // KW 4–8 – Nachzügler
      deadline: { chance: 0.3,  bedarf: 3,   anteil: 0.6 },    // KW 9 – letzte Gelegenheit, danach Kaderplanung für Lücken
      winter:   { chance: 0.05, bedarf: 4,   anteil: 0.4 },    // KW 27–29
      winterDeadline: { chance: 0.1, bedarf: 4, anteil: 0.4 }  // KW 30
    },
    sperreWochen: 52,                               // ein gewechselter Spieler bleibt ein Jahr (nie zweimal im selben Fenster)
    sterneSaison1: 5, sternChance1: 0.2,            // Stars 2026/27: in Saison 1 wechseln nur wenige (Kader stehen schon)
    kaderMin: 20, kaderMax: 27,
    teilMin: { TW: 2, ABW: 6, MIT: 6, ANG: 4 },
    elf: { TW: 1, ABW: 4, MIT: 3, ANG: 3 },
    praemie: { cl: 15e6, el: 4.3e6, co: 3.17e6 },
    urteil: { treffer: 2, flop: -2 },             // Punkte: Entwicklung gegen Erwartung + Verbesserung − Überzahlung
    abwaerts: 3, abwaertsAlt: 5,                    // so weit unter sein Niveau wechselt ein Spieler höchstens (ab 31: 5)
    gedaempftAb: 60e6, ablosMax: 250e6,             // Ablöse über 60 Mio. nur halb, höchstens 250 Mio.
    logSaisons: 3, newsMax: 7,
    // Anspruch (Langzeitlauf 2026-10-17: ohne Grenze rüstete jeder Verein jedes Fenster weiter auf – Erste Liga 80 → 88, Dritte
    // 61 → 69 in 5 Saisons): Ziel = Stärke beim ersten Fenster (mind. Ligaschnitt − 3 für Aufsteiger) + luft; wer es erreicht hat,
    // kauft nur noch für echte Lücken (Stelle ≥ luecke unter dem Niveau). Nutzer: „die KI darf im späteren Spiel ruhig besser
    // werden, dass die besten Teams auch richtig klug sind und eine Challenge darstellen – aber ab Saison 10“ → ab Saison
    // spaetAb heben die Spitzenvereine (oberes Drittel ihrer Liga, Ausland: Elf ≥ 80) ihren Anspruch je Saison um spaetJe (bis
    // spaetMax) und ihr Sportdirektor ist einen Stern besser.
    anspruch: { luft: 2, ligaUnter: 3, luecke: 6, maxUeber: 4, spaetAb: 10, spaetJe: 0.4, spaetMax: 4, spitzeEuro: 80 },
    // Auf- und Absteiger (Nutzer 2026-10-17: „Aufsteiger versuchen sich durch erfahrene günstige Spieler gezielt zu verbessern;
    // Absteiger müssen durch die gesunkenen TV-Gelder Spieler abgeben – wirtschaftlich vernünftig“; Langzeitlauf: 53 % der
    // Aufsteiger in die Dritte Liga gingen sofort wieder runter, Absteiger behielten ihren ganzen Kader)
    //   Aufsteiger (erste Saison in der neuen Liga): Anspruch mindestens Ligaschnitt − ligaUnter, Bedarf schon ab bedarf,
    //   ein Kauf mehr, bevorzugt alter[0]–alter[1] Jahre und günstig
    //   (Aufsteiger bekommen im ersten Jahr mindestens das TV-Geld eines durchschnittlichen Vereins ihrer neuen Liga)
    //   Absteiger: Spieler mit Marktwert über zuTeuer × neuem Jahreszufluss müssen gehen (höchstens max), mit rabatt angeboten;
    //   bis zum Deadline-Day ohne deutschen Käufer → ins Ausland; ihr Anspruch höchstens ueberLiga über dem Ligaschnitt
    auf: { ligaUnter: 1, bedarf: 2, mehrKaeufe: 1, alter: [27, 31], erfahren: 1.5, jung: 0.6, preis: 1.3 },
    ab: { zuTeuer: 1.0, max: 4, rabatt: 0.15, auslandAnteil: 0.8, ueberLiga: 3 }
  };
  const W = window;
  let AKTIV = true;
  const zufall = n => Math.floor(Math.random() * n);
  const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hatSpiel = () => { try { return typeof CLUB !== 'undefined' && CLUB && typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.tiers; } catch (e) { return false; } };
  const geld = v => typeof formatEuro === 'function' ? formatEuro(Math.round(v)) : (v >= 1e6 ? (v / 1e6).toFixed(1) + ' Mio. €' : Math.round(v / 1e3) + ' Tsd. €');
  const voll = p => (p.firstName ? p.firstName + ' ' : '') + (p.name || '');
  let OVR = new WeakMap(), ANA = new Map();      // je Fenster: Stärke je Spieler, Analyse je Verein (nach Wechsel neu)
  const ovrRoh = p => { try { if (typeof computeOvrFromAreas === 'function') return computeOvrFromAreas(p) || p.ovr || 0; } catch (e) { /* weiter */ } return p.ovr || Math.round(((p.def || 50) + (p.mid || 50) + (p.att || 50)) / 3); };
  const ovrVon = p => { let o = OVR.get(p); if (o == null) { o = ovrRoh(p); OVR.set(p, o); } return o; };
  const TEIL = pos => pos === 'TW' ? 'TW' : /^(IV|AV|LV|RV|LIV|RIV|IVL|IVR)$/.test(pos) ? 'ABW' : /^(ST|FL|MS|LA|RA|LF|RF|HS)$/.test(pos) ? 'ANG' : 'MIT';
  const TEILNAME = { TW: 'Torhüter', ABW: 'Abwehr', MIT: 'Mittelfeld', ANG: 'Angriff' };
  const FENSTERNAME = { start: 'Sommer', frueh: 'Sommer', sommer: 'Sommer', deadline: 'Deadline-Day', winter: 'Winter', winterDeadline: 'Winter', frei: 'ablösefrei' };
  const absWoche = () => (LEAGUE.season || 1) * 52 + (LEAGUE.week || 1);
  // Stars ohne Wechsel sind frei (frühere Fassung sperrte sie für Saison 1 – kmSperre ohne kmId)
  const gesperrt = p => (p.kmSperre || 0) > absWoche() && !(p.stern && !p.kmId);
  // Stars in Saison 1: nur wenige Wechsel insgesamt, und nicht jeder Anlauf klappt
  const sternFrei = p => { if (!p.stern || (LEAGUE.season || 1) > 1) return true; const st = zustand(); return (st.sterne1 || 0) < CFG.sterneSaison1 && Math.random() < CFG.sternChance1; };

  function zustand() {
    if (!hatSpiel()) return null;
    if (!CLUB.welt) CLUB.welt = {};
    if (!CLUB.welt.kiMarkt) CLUB.welt.kiMarkt = { v: 1, k: {}, b: {}, log: [], rek: [], zaehler: 0 };
    return CLUB.welt.kiMarkt;
  }

  // ── Vereine mit Kader ──────────────────────────────────────────────────────
  function vereine() {
    const out = [], eigen = CLUB.dataClubId;
    const sq = CLUB.npcSquads || {};
    try {
      Object.keys(LEAGUE.tiers).forEach(tier => (LEAGUE.tiers[tier].groups || []).forEach(g => (g.teams || []).forEach(t => {
        const id = t.dataId || null;
        if (!id || t.id === 'fcm' || id === eigen || !Array.isArray(sq[id]) || sq[id].length < 11) return;
        out.push({ id, art: 'de', name: t.name, tier, ovr: t.ovr || 60, land: 'Deutschland', kader: sq[id] });
      })));
    } catch (e) { /* ohne Liga */ }
    try {
      const ek = typeof W.euroKader === 'function' ? W.euroKader() : (CLUB.euroKader || {});
      const clubs = (CLUB.euroClubs && CLUB.euroClubs.length ? CLUB.euroClubs : (W.EURO_CLUBS || []));
      clubs.forEach(c => {
        if (!Array.isArray(ek[c.id]) || ek[c.id].length < 11) return;
        out.push({ id: c.id, art: 'eu', name: c.name, tier: 'eu', ovr: c.ovr || 70, land: c.country, coeff: c.coeff || 6, flag: c.flag, kader: ek[c.id] });
      });
    } catch (e) { /* ohne Ausland */ }
    return out;
  }
  function zufluss(v) {
    if (v.art === 'eu') {
      const E = CFG.zuflussEuro;
      return E.basis * Math.pow(2, (v.ovr - E.mittel) / CFG.verdopplung) * (v.land === 'England' ? E.England : (E.land[v.coeff] || 0.15));
    }
    const [b, m] = CFG.zufluss[v.tier] || CFG.zufluss.regionalliga;
    const o = v.art === 'de' && aufsteiger(v) ? Math.max(v.ovr, m) : v.ovr;     // Aufsteiger: TV-Geld der neuen Liga
    return b * Math.max(0.25, Math.min(6, Math.pow(2, (o - m) / CFG.verdopplung)));
  }
  function konto(st, v) {
    let k = st.k[v.id];
    if (!k) {
      // Sportdirektor: 1–5★, reichere Vereine etwas öfter gut besetzt
      const sd = Math.max(1, Math.min(5, Math.round(0.8 + Math.random() * 4.2 + (v.ovr - 72) / 30)));
      k = st.k[v.id] = { kasse: Math.round(zufluss(v) * CFG.start), sd };
    }
    return k;
  }
  const bilanz = (st, id) => (st.b[id] = st.b[id] || { ein: 0, aus: 0 });

  // ── Elf, Niveau, Bedarf ────────────────────────────────────────────────────
  function analyse(v) {
    const c = ANA.get(v); if (c) return c;
    const teile = { TW: [], ABW: [], MIT: [], ANG: [] };
    v.kader.forEach(p => { if (p && !p.onLoanAt) teile[TEIL(p.pos)].push(p); });
    Object.values(teile).forEach(l => l.sort((a, b) => ovrVon(b) - ovrVon(a)));
    const start = [];
    Object.keys(CFG.elf).forEach(t => teile[t].slice(0, CFG.elf[t]).forEach(p => start.push(p)));
    const niveau = start.length ? start.reduce((a, p) => a + ovrVon(p), 0) / start.length : 50;
    const top3 = v.kader.slice().sort((a, b) => ovrVon(b) - ovrVon(a)).slice(0, 3);
    const A = { teile, start: new Set(start), top3: new Set(top3), niveau };
    ANA.set(v, A);
    return A;
  }
  function bedarf(v, A, ab) {
    let best = null;
    Object.keys(CFG.elf).forEach(t => {
      const l = A.teile[t], n = CFG.elf[t];
      const schwach = l[n - 1] || null;
      let s = schwach ? A.niveau - ovrVon(schwach) : 12;
      if (schwach && schwach.age >= 31) s += 2;
      if (l.length < CFG.teilMin[t]) s += 4;
      if (!best || s > best.s) best = { teil: t, s, ziel: schwach ? ovrVon(schwach) : 0 };
    });
    return best && best.s >= (ab || 2.5) ? best : null;
  }

  // ── Wert, Preis, Bereitschaft ──────────────────────────────────────────────
  let WERT = new WeakMap(), UE = 1;
  function wert(p) {
    if (WERT.has(p)) return WERT.get(p);
    let w = 0;
    try { w = typeof computeMarketValue === 'function' ? computeMarketValue(Object.assign({}, p)) : 0; } catch (e) { w = 0; }
    if (!w) w = Math.max(25000, Math.pow(Math.max(0, ovrVon(p) - 48), 4.9) * 1.26);
    // Spitzenwerte dämpfen: die Marktwertkurve ist oben sehr steil (95er > 400 Mio.)
    if (w > CFG.gedaempftAb) w = Math.min(CFG.ablosMax, CFG.gedaempftAb + (w - CFG.gedaempftAb) * 0.5);
    WERT.set(p, w);
    return w;
  }
  function preis(p, s, sA, kauf) {
    let f = 1;
    if (sA.start.has(p)) f += 0.2;
    if (sA.top3.has(p)) f += 0.4;
    if (p.age <= 21) f += 0.15;
    if (s.k.kasse < 0) f -= 0.25;
    if (mussWeg(p, s)) f -= CFG.ab.rabatt;                    // Absteiger muss abgeben
    const ue = 1 + (5 - kauf.k.sd) * 0.12 * Math.random();      // schlechte Sportdirektoren zahlen drauf (1★ bis +48 %)
    UE = ue;
    return Math.max(25000, Math.min(CFG.ablosMax, Math.round(wert(p) * f * ue / 1000) * 1000));
  }
  function gibtAb(p, s, sA, kauf, kA) {
    const teil = TEIL(p.pos);
    if (s.kader.length <= CFG.kaderMin - 2 || sA.teile[teil].length <= CFG.teilMin[teil] - 1) return false;
    const gleich = sA.niveau >= kA.niveau - 1;
    if (sA.top3.has(p) && gleich) return s.k.kasse < 0 || Math.random() < 0.12;          // Star nur bei Wechselwunsch/Geldnot
    if (sA.start.has(p) && sA.niveau > kA.niveau + 1) return p.age >= 30 ? Math.random() < 0.5 : Math.random() < 0.08;   // nach unten nur Ältere
    return true;
  }

  // ── Ein Kauf ───────────────────────────────────────────────────────────────
  // ── Anspruch je Verein (siehe CFG.anspruch) ──────────────────────────────
  function anspruchVon(v, A) {
    const st = zustand(), C = CFG.anspruch;
    st.an = st.an || {}; st.ligaStart = st.ligaStart || {};
    if (st.an[v.id] == null) st.an[v.id] = Math.round(A.niveau * 10) / 10;
    let z = st.an[v.id];
    if (v.art === 'de' && st.ligaStart[v.tier] != null) z = Math.max(z, st.ligaStart[v.tier] - (aufsteiger(v) ? CFG.auf.ligaUnter : C.ligaUnter));
    if (v.art === 'de' && absteiger(v) && st.ligaStart[v.tier] != null) z = Math.min(z, st.ligaStart[v.tier] + CFG.ab.ueberLiga - C.luft);
    if (spitze(v)) z += Math.min(C.spaetMax, Math.max(0, ((LEAGUE.season || 1) - C.spaetAb + 1) * C.spaetJe));
    return z + C.luft;
  }
  // Spitzenverein ab Saison 10: oberes Drittel seiner Liga (Ausland: Elf ≥ spitzeEuro)
  function spitze(v) {
    if ((LEAGUE.season || 1) < CFG.anspruch.spaetAb) return false;
    if (v.art === 'eu') return (v.ovr || 0) >= CFG.anspruch.spitzeEuro;
    try { const g = allGroups(LEAGUE).find(x => x.tierKey === v.tier); if (!g) return false;
      const ovr = g.group.teams.map(t => t.ovr || 0).sort((a, b) => b - a); return (v.ovr || 0) >= ovr[Math.floor(ovr.length / 3)]; } catch (e) { return false; }
  }
  // ── Auf- und Absteiger (siehe CFG.auf / CFG.ab) ──────────────────────────
  const aufsteiger = v => { const w = (zustand().wandel || {})[v.id]; return !!(w && w.art === 'auf' && w.saison === LEAGUE.season); };
  const absteiger = v => { const w = (zustand().wandel || {})[v.id]; return w && w.art === 'ab' && w.saison === LEAGUE.season ? w : null; };
  // zum Saisonwechsel: Ligawechsel erkennen und Absteigern ihre Abgaben vorgeben
  function wandelMerken(alle) {
    const st = zustand(), R = { regionalliga: 0, liga3: 1, bundesliga2: 2, bundesliga: 3 };
    st.liga = st.liga || {}; st.wandel = st.wandel || {};
    alle.forEach(v => {
      if (v.art !== 'de') return;
      const vor = st.liga[v.id];
      if (vor && vor !== v.tier && R[vor] != null && R[v.tier] != null) {
        if (R[v.tier] > R[vor]) st.wandel[v.id] = { art: 'auf', saison: LEAGUE.season, von: vor, nach: v.tier };
        else {
          const grenze = zufluss(v) * CFG.ab.zuTeuer;
          const weg = v.kader.filter(p => !gesperrt(p) && wert(p) > grenze).sort((a, b) => wert(b) - wert(a)).slice(0, CFG.ab.max).map(p => p.kmId || (p.kmId = 'km' + (++st.zaehler)));
          st.wandel[v.id] = { art: 'ab', saison: LEAGUE.season, von: vor, nach: v.tier, weg, offen: weg.length };
        }
      }
      st.liga[v.id] = v.tier;
    });
    Object.keys(st.wandel).forEach(id => { if (st.wandel[id].saison < LEAGUE.season - 1) delete st.wandel[id]; });
  }
  const mussWeg = (p, s) => { const a = s && absteiger(s); return !!(a && a.offen > 0 && p.kmId && a.weg.indexOf(p.kmId) >= 0); };
  function abgegeben(p, s) { const a = absteiger(s); if (a && p.kmId && a.weg.indexOf(p.kmId) >= 0) { a.weg = a.weg.filter(x => x !== p.kmId); a.offen = a.weg.length; } }
  // Absteiger bieten ihre zu teuren Spieler aktiv an; zum Deadline-Day geht der Rest ins Ausland
  function absteigerVerkaufen(alle, gewechselt, fenster) {
    const raus = [];
    alle.forEach(v => {
      const a = absteiger(v); if (!a || !a.offen) return;
      v.kader.filter(p => mussWeg(p, v) && !gewechselt.has(p)).forEach(p => {
        const o = ovrVon(p), pr = Math.round(wert(p) * (1 - CFG.ab.rabatt) / 1000) * 1000;
        const kaeufer = alle.filter(z => z !== v && z.kader.length < CFG.kaderMax && z.k.kasse >= pr && Math.abs(analyse(z).niveau - o) <= 4 &&
          (z.art === 'eu' || fenster === 'deadline' || z.art === 'de')).sort((x, y) => (y.art === 'de' ? 1 : 0) - (x.art === 'de' ? 1 : 0) || y.k.kasse - x.k.kasse);
        let ziel = kaeufer.find(z => z.art === 'de') || (fenster === 'deadline' ? kaeufer[0] : null);
        if (!ziel && fenster === 'deadline') {        // niemand kann zahlen: ins Ausland zum passendsten Verein, Ablöse nach dessen Kasse
          ziel = alle.filter(z => z.art === 'eu' && z !== v && z.kader.length < CFG.kaderMax + 2).sort((x, y) => Math.abs(analyse(x).niveau - o) - Math.abs(analyse(y).niveau - o))[0];
        }
        if (!ziel) return;
        const ab = Math.min(pr, Math.max(0, Math.round(ziel.k.kasse * CFG.ab.auslandAnteil / 1000) * 1000));
        const e = wechsel(p, v, ziel, ab, gewechselt, fenster);
        if (e) { e.absteiger = 1; abgegeben(p, v); raus.push(e); }
      });
    });
    return raus;
  }
  function ligaStartMerken(alle) {
    const st = zustand(); st.ligaStart = st.ligaStart || {};
    const summe = {};
    alle.forEach(v => { if (v.art === 'de' && st.ligaStart[v.tier] == null) (summe[v.tier] = summe[v.tier] || []).push(analyse(v).niveau); });
    Object.keys(summe).forEach(t => { st.ligaStart[t] = Math.round(summe[t].reduce((a, b) => a + b, 0) / summe[t].length * 10) / 10; });
  }
  function kaufen(kauf, alle, budget, gewechselt, fenster) {
    const kA = analyse(kauf), auf = aufsteiger(kauf);
    let b = bedarf(kauf, kA, auf ? Math.min(CFG.auf.bedarf, (CFG.woche[fenster] || CFG.woche.sommer).bedarf) : (CFG.woche[fenster] || CFG.woche.sommer).bedarf);
    if (!b) return null;
    const anspruch = anspruchVon(kauf, kA);
    if (kA.niveau >= anspruch && b.s < CFG.anspruch.luecke) return null;      // Ziel erreicht: nur noch echte Lücken
    const sd = Math.min(5, kauf.k.sd + (spitze(kauf) ? 1 : 0)), fehler = (6 - sd) * 1.2;           // Schätzfehler: 5★ ±1,2 · 1★ ±6
    let best = null;
    alle.forEach(s => {
      if (s === kauf) return;
      let sA = null;
      s.kader.forEach(p => {
        if (!p || gewechselt.has(p) || gesperrt(p) || p.onLoanAt || TEIL(p.pos) !== b.teil || p.age > 33 || !sternFrei(p)) return;
        const o = ovrVon(p);
        // Kandidaten nach echter Stärke vorsortieren – schlechte Sportdirektoren nehmen auch Spieler, die gar nicht besser sind
        if (o < b.ziel + (sd <= 2 ? -1 : 1) || o > Math.min(kA.niveau + 5, anspruch + CFG.anspruch.maxUeber)) return;
        // Spieler steigen nicht weit ab: höchstens CFG.abwaerts unter das eigene Niveau des Spielers (Ältere etwas mehr)
        if (o - kA.niveau > (p.age >= 31 ? CFG.abwaertsAlt : CFG.abwaerts)) return;
        // schlechte Sportdirektoren (≤ 2★) überschätzen ältere Namen (+3) und den Hype um Talente (+4 Potenzial)
        const gesehen = o + gauss() * fehler + (sd <= 2 && p.age >= 29 ? 3 : 0);
        const gewinn = gesehen - b.ziel;
        if (gewinn < 2) return;
        sA = sA || analyse(s);
        const pr = preis(p, s, sA, kauf);
        if (pr > budget || !(mussWeg(p, s) || gibtAb(p, s, sA, kauf, kA))) return;
        // Vorlieben: gute Sportdirektoren Jugend und Preis, schlechte große Namen
        const pot = (p.truePotential || o) + gauss() * fehler + (sd <= 2 && p.age <= 22 ? 4 : 0);
        let wunsch = gewinn;
        if (sd >= 4) wunsch *= (p.age <= 24 ? 1.3 : p.age >= 30 ? 0.65 : 1) * (1 + Math.max(0, pot - o) / 40);
        if (sd <= 2) wunsch *= (1 + Math.max(0, gesehen - kA.niveau) / 8) * (p.age >= 28 ? 1.3 : 1);   // große, ältere Namen
        // Aufsteiger: erfahrene, günstige Spieler – schnell besser, ohne die Kasse zu sprengen
        if (auf) wunsch *= (p.age >= CFG.auf.alter[0] && p.age <= CFG.auf.alter[1] ? CFG.auf.erfahren : p.age <= 23 ? CFG.auf.jung : 1);
        wunsch /= Math.pow(1 + pr / Math.max(1, budget), auf ? CFG.auf.preis : sd >= 3 ? 0.8 : 0.3);
        wunsch *= 0.85 + Math.random() * 0.3;
        if (!best || wunsch > best.wunsch) best = { p, s, sA, pr, wunsch, ue: UE };
      });
    });
    if (!best) return null;
    const e = wechsel(best.p, best.s, kauf, best.pr, gewechselt, fenster);
    if (e) abgegeben(best.p, best.s);
    if (e) { e.z = Math.round(b.ziel); e.ue = Math.round(best.ue * 100) / 100; }   // ersetzte Stelle, eigene Überzahlung – fürs Urteil
    return e;
  }
  function wechsel(p, s, kauf, ablose, gewechselt, fenster) {
    const st = zustand();
    const i = s.kader.indexOf(p); if (i < 0) return null;
    s.kader.splice(i, 1);
    if (kauf.art === 'de' && !p.positions) p.positions = [p.pos];
    if (kauf.art === 'eu' && !p.id) p.id = kauf.id + '_km' + Math.floor(Math.random() * 1e6).toString(36);
    if (!p.kmId) p.kmId = 'km' + (++st.zaehler);
    p.clubId = kauf.id;
    p.kmSperre = absWoche() + CFG.sperreWochen;
    if (p.stern && (LEAGUE.season || 1) === 1) { const st = zustand(); st.sterne1 = (st.sterne1 || 0) + 1; }
    delete p.eigen; delete p.eigengewaechs; delete p.ausAkademie;
    kauf.kader.push(p);
    gewechselt.add(p);
    ANA.delete(s); ANA.delete(kauf);
    kauf.k.kasse -= ablose; s.k.kasse += ablose;
    bilanz(st, kauf.id).aus += ablose; bilanz(st, s.id).ein += ablose;
    const e = { s: LEAGUE.season, f: fenster, id: p.kmId, n: voll(p), pos: p.pos, a: p.age, o: ovrVon(p), pot: p.truePotential || ovrVon(p),
      l: p.country || '', von: s.name, vonId: s.id, vonDe: s.art === 'de', nach: kauf.name, nachId: kauf.id, nachDe: kauf.art === 'de',
      ab: ablose, w: Math.round(wert(p)), sd: kauf.k.sd, pid: p.id, ps: p.dflSeed || p.seed || 0 };
    st.log.push(e);
    return e;
  }
  // Zu große Kader: ältere Ergänzungsspieler an kleinere Vereine mit Bedarf, sonst vereinslos
  function abgeben(alle, gewechselt, fenster) {
    const raus = [];
    alle.forEach(v => {
      while (v.kader.length > CFG.kaderMax) {
        const A = analyse(v);
        const p = v.kader.filter(x => !A.start.has(x) && !gesperrt(x) && !(x.stern && (LEAGUE.season || 1) === 1)).sort((a, b) => (ovrVon(a) - (a.age <= 21 ? 4 : 0) - (a.age >= 29 ? -2 : 0)) - (ovrVon(b) - (b.age <= 21 ? 4 : 0) - (b.age >= 29 ? -2 : 0)))[0];
        if (!p) break;
        const ziel = alle.filter(z => z !== v && z.kader.length < CFG.kaderMax - 1 && analyse(z).niveau < ovrVon(p) + 1 && z.k.kasse > wert(p) * 0.5)
          .sort(() => Math.random() - 0.5)[0];
        if (ziel) { const e = wechsel(p, v, ziel, Math.round(wert(p) * 0.5 / 1000) * 1000, gewechselt, fenster); if (e) { e.abgabe = 1; raus.push(e); continue; } }
        v.kader.splice(v.kader.indexOf(p), 1); ANA.delete(v);
      }
    });
    return raus;
  }

  // ── Ein Transferfenster ────────────────────────────────────────────────────
  // Eine Marktwoche im offenen Fenster: jeder Verein mit Bedarf hat eine Chance auf einen Kauf; je Fenster höchstens
  // 1–3 Käufe (Sommer, nach Größe) bzw. 1 (Winter); ein gewechselter Spieler ist ein Jahr gesperrt.
  function fenster(art) {
    const st = zustand(); if (!st || !AKTIV) return [];
    art = CFG.woche[art] ? art : 'sommer';
    const W8 = CFG.woche[art], winter = /^winter/.test(art);
    WERT = new WeakMap(); OVR = new WeakMap(); ANA = new Map();
    const alle = vereine();
    alle.forEach(v => { v.k = konto(st, v); });
    ligaStartMerken(alle);
    st.liga = st.liga || {}; alle.forEach(v => { if (v.art === 'de' && !st.liga[v.id]) st.liga[v.id] = v.tier; });   // Liga beim ersten Fenster (Auf-/Abstieg)
    const fk = LEAGUE.season + (winter ? 'W' : 'S');
    if (!st.fk || st.fk.k !== fk) st.fk = { k: fk, n: {} };
    const gewechselt = new Set(), neu = [];
    const maxKaeufe = v => winter ? 1 : 1 + (zufluss(v) >= 40e6 ? 1 : 0) + (zufluss(v) >= 120e6 ? 1 : 0) + (aufsteiger(v) ? CFG.auf.mehrKaeufe : 0);
    // Reihenfolge: zufällig, Reiche etwas eher
    alle.slice().sort((a, b) => (b.k.kasse * (0.5 + Math.random())) - (a.k.kasse * (0.5 + Math.random()))).forEach(v => {
      if ((st.fk.n[v.id] || 0) >= maxKaeufe(v) || Math.random() > W8.chance) return;
      const budget = Math.max(0, v.k.kasse * W8.anteil);
      if (budget < 25000) return;
      const e = kaufen(v, alle, budget, gewechselt, art);
      if (e) { neu.push(e); st.fk.n[v.id] = (st.fk.n[v.id] || 0) + 1; }
    });
    if (!winter) absteigerVerkaufen(alle, gewechselt, art).forEach(e => neu.push(e));
    abgeben(alle, gewechselt, art).forEach(e => neu.push(e));
    if (art === 'deadline') luecken(st).forEach(e => neu.push(e));
    alle.forEach(v => { v.k.kasse = Math.min(v.k.kasse, zufluss(v) * CFG.kasseMax); });   // Rest fließt in Schulden/Infrastruktur
    // Log kürzen: nur die letzten Saisons, Rekorde getrennt
    const ab = LEAGUE.season - CFG.logSaisons + 1;
    st.log = st.log.filter(e => e.s >= ab);
    neu.forEach(e => { if (e.ab >= 1e6) st.rek.push(e); });
    st.rek = st.rek.sort((a, b) => b.ab - a.ab).slice(0, 15);
    try { if (typeof W.staerkeAktualisieren === 'function') W.staerkeAktualisieren(); } catch (e) { /* ohne Stärke-Modul */ }
    melden(art, neu);
    return neu;
  }
  // Nach dem Deadline-Day: Lücken, die der Markt nicht geschlossen hat, füllt die Kaderplanung mit Vereinslosen (ablösefrei)
  function luecken(st) {
    const out = [];
    try {
      if (!W.KSLebendeWelt || typeof W.KSLebendeWelt.kaderplanung !== 'function') return out;
      const namen = {}; vereine().forEach(v => { namen[v.id] = v.name; });
      W.KSLebendeWelt.kaderplanung({ luecken: true }).forEach(({ p, id }) => {
        if (!p.kmId) p.kmId = 'km' + (++st.zaehler);
        p.kmSperre = absWoche() + CFG.sperreWochen;
        const e = { s: LEAGUE.season, f: 'frei', id: p.kmId, n: voll(p), pos: p.pos, a: p.age, o: ovrVon(p), pot: p.truePotential || ovrVon(p),
          l: p.country || '', von: 'vereinslos', vonId: null, vonDe: false, nach: namen[id] || id, nachId: id, nachDe: true, ab: 0, w: Math.round(wert(p)), frei: 1, pid: p.id, ps: p.dflSeed || p.seed || 0 };
        st.log.push(e); out.push(e);
      });
    } catch (e) { console.warn('[Kickstil-KI-Markt] Kaderplanung', e); }
    return out;
  }
  // Zum Saisonwechsel: nur Geld (Zufluss, Prämien) und Urteile – Transfers erst ab KW 1
  function saisonwechsel() {
    const st = zustand(); if (!st || !AKTIV) return;
    WERT = new WeakMap(); OVR = new WeakMap(); ANA = new Map();
    const alle = vereine();
    alle.forEach(v => { v.k = konto(st, v); });
    try { wandelMerken(alle); } catch (e) { console.warn('[Kickstil-KI-Markt] Auf-/Absteiger', e); }
    sommerGeld(st, alle);
    st.geldSaison = LEAGUE.season;
  }
  function sommerGeld(st, alle) {
    // Bilanz der Vorsaison ablegen, Zufluss + Europapokal-Prämien, Deckel
    st.bAlt = st.b; st.b = {};
    const comp = (CLUB.euro && CLUB.euro.competitions) || null, dabei = {};
    if (comp) ['cl', 'el', 'co'].forEach(k => (comp[k] || []).forEach(t => { if (t && t.id && !t.isFcm) dabei[t.id] = k; }));
    alle.forEach(v => {
      const z = zufluss(v), pr = dabei[v.id] ? CFG.praemie[dabei[v.id]] : 0;
      v.k.kasse = Math.min(v.k.kasse + z + pr, z * CFG.kasseMax);
    });
    urteilen(st);
  }
  // Urteil nach einem Jahr: Marktwert jetzt gegen Ablöse
  function urteilen(st) {
    const offen = st.log.filter(e => !e.u && e.s <= LEAGUE.season - 1 && e.ab >= 250000);
    if (!offen.length) return;
    const index = {};
    vereine().forEach(v => v.kader.forEach(p => { if (p.kmId) index[p.kmId] = p; }));
    try { (typeof SQUAD !== 'undefined' ? SQUAD : []).forEach(p => { if (p && p.kmId) index[p.kmId] = p; }); } catch (e) { /* ohne Kader */ }
    offen.forEach(e => {
      const p = index[e.id];
      if (!p) { e.u = 'weg'; return; }
      // Leistung gegen Erwartung: Entwicklung im Vergleich zum Alter, echte Verbesserung gegenüber der ersetzten Stelle,
      // minus Überzahlung (Ablöse über Marktwert). Gute Sportdirektoren kaufen jung, genau und günstig.
      const d = ovrVon(p) - e.o, erwartet = e.a <= 23 ? 1.5 : e.a <= 27 ? 0.5 : e.a <= 30 ? 0 : -1.5;
      const aufschlag = e.ue || 1, plus = e.z != null ? e.o - e.z : 3;
      const punkte = (d - erwartet) + 0.5 * (plus - 3) - 4 * (aufschlag - 1);
      e.oJetzt = ovrVon(p); e.up = Math.round(punkte * 10) / 10;
      e.u = punkte >= CFG.urteil.treffer ? 'treffer' : punkte <= CFG.urteil.flop ? 'flop' : 'ok';
    });
  }

  // ── Meldungen ──────────────────────────────────────────────────────────────
  function zeile(e) {
    return `${e.n} (${e.pos}, ${e.a}, ${e.o}) – ${e.von} → ${e.nach} · ${geld(e.ab)}`;
  }
  function melden(art, neu) {
    if (typeof addNews !== 'function' || (art !== 'start' && art !== 'deadline' && art !== 'winterDeadline')) return;
    // Deadline: Bilanz des ganzen Fensters
    if (art !== 'start') { const st = zustand(), win = art === 'winterDeadline'; neu = st.log.filter(e => e.s === LEAGUE.season && (win ? /^winter/.test(e.f) : /^(sommer|deadline|start|frueh)$/.test(e.f))); }
    const kauf = neu.filter(e => !e.abgabe);
    if (!kauf.length) return;
    const summe = kauf.reduce((a, e) => a + e.ab, 0);
    const top = kauf.slice().sort((a, b) => b.ab - a.ab).slice(0, CFG.newsMax);
    const de = kauf.filter(e => e.vonDe || e.nachDe).length;
    addNews('transfer', `🔄 ${art === 'start' ? 'Transfersommer eröffnet' : art === 'deadline' ? 'Transfersommer vorbei' : 'Winterfenster vorbei'}: ${kauf.length} Wechsel, ${geld(summe)} bewegt`,
      `${de} mit deutschen Vereinen. Die größten:\n• ` + top.map(zeile).join('\n• ') + '\nAlle Wechsel: Transfermarkt → Welt.');
  }

  // ── Anzeige ────────────────────────────────────────────────────────────────
  const URTEIL = { treffer: ['Volltreffer', 'km-gut'], flop: ['Flop', 'km-schlecht'], ok: ['solide', 'km-neutral'], weg: ['Karriereende', 'km-neutral'] };
  function liste(filter) {
    const st = zustand(); if (!st) return [];
    let l = st.log.slice();
    if (filter === 'de') l = l.filter(e => e.vonDe || e.nachDe);
    if (filter === 'int') l = l.filter(e => !e.vonDe && !e.nachDe);
    if (filter === 'rek') return st.rek.slice();
    return l.filter(e => !e.abgabe || e.ab >= 500000).sort((a, b) => b.s - a.s || b.ab - a.ab);
  }
  let FILTER = 'alle';
  const sterne = n => `<i class="ti ti-star-filled" aria-hidden="true"></i> ${n} von 5`;
  // Rückmeldung 18.10.: Ticker mit Gesicht; Stärke und nur ein geschätztes Potenzial, sonst Vereine, Position, Ablöse
  const potSchaetzung = e => { const m = Math.round((e.pot || e.o) / 2) * 2; return `${Math.max(e.o, m - 4)}–${Math.min(99, m + 4)}`; };
  function gesichtVon(e) {
    if (!W.KSVerein || !KSVerein.gesicht) return '';
    const leer = String(e.n || '').split(' '), p = { id: e.pid || e.id, name: leer.pop(), firstName: leer.join(' '), country: e.l, pos: e.pos, age: e.a };
    if (e.ps) { p.seed = e.ps; p.dflSeed = e.ps; }
    let vid = null; try { vid = KSVerein.idNachName ? KSVerein.idNachName(e.nach) : null; } catch (x) { vid = null; }
    try { return KSVerein.gesicht(p, vid || 'fremd'); } catch (x) { return ''; }
  }
  function zeileHtml(e) {
    const u = e.u && URTEIL[e.u] ? `<span class="km-urteil ${URTEIL[e.u][1]}">${URTEIL[e.u][0]}</span>` : '';
    const fl = (W.KSNationen && KSNationen.flagge(e.l)) || '';
    return `<div class="km-zeile"><span class="km-gesicht dfl-portrait klein">${gesichtVon(e)}</span><div class="km-sp"><b>${fl} ${esc(e.n)}</b><small>${esc(e.pos)} · ${e.a} J. · Stärke ${e.o} · Pot. ${potSchaetzung(e)}</small></div>
      <div class="km-weg"><span>${esc(e.von)}</span><i class="ti ti-arrow-right" aria-hidden="true"></i><span>${esc(e.nach)}</span><small>${FENSTERNAME[e.f] || ''} ${typeof seasonYearLabel === 'function' ? seasonYearLabel(e.s) : 'Saison ' + e.s}${e.abgabe ? ' · Abgabe' : ''}</small></div>
      <div class="km-geld"><b>${e.frei ? 'ablösefrei' : geld(e.ab)}</b>${u}</div></div>`;
  }
  function weltHtml() {
    const st = zustand(); if (!st) return '';
    const l = liste(FILTER), alle = liste('alle');
    const dieseSaison = alle.filter(e => e.s === LEAGUE.season);
    const summe = dieseSaison.reduce((a, e) => a + e.ab, 0);
    const ausgaben = {}; dieseSaison.forEach(e => { ausgaben[e.nach] = (ausgaben[e.nach] || 0) + e.ab; });
    const spender = Object.entries(ausgaben).sort((a, b) => b[1] - a[1])[0];
    const rek = st.rek[0];
    const treffer = alle.filter(e => e.u === 'treffer').length, flops = alle.filter(e => e.u === 'flop').length;
    const chip = (k, t) => `<button type="button" class="km-chip${FILTER === k ? ' an' : ''}" data-km-filter="${k}">${t}</button>`;
    return `<div class="km-kopf">
        <div><b>${alle.length}</b><small>Wechsel</small></div>
        <div><b>${geld(summe)}</b><small>bewegt</small></div>
        <div><b>${rek ? geld(rek.ab) : '–'}</b><small>${rek ? 'Rekord: ' + esc(rek.n) + ' → ' + esc(rek.nach) : 'Rekordtransfer'}</small></div>
        <div><b>${spender ? geld(spender[1]) : '–'}</b><small>${spender ? 'Größter Einkäufer: ' + esc(spender[0]) : 'Größter Einkäufer'}</small></div>
        <div><b>${treffer} / ${flops}</b><small>Volltreffer / Flops</small></div>
      </div>
      <div class="km-chips">${chip('alle', 'Alle')}${chip('de', 'Mit deutschen Vereinen')}${chip('int', 'International')}${chip('rek', 'Rekorde')}</div>
      <div class="km-liste">${l.length ? l.slice(0, 80).map(zeileHtml).join('') : '<p class="km-leer">Noch keine Wechsel – der Markt öffnet zum Saisonwechsel, am Deadline-Day und im Winter.</p>'}</div>`;
  }
  function vereinHtml(id) {
    const st = zustand(); if (!st) return '';
    const v = vereine().find(x => x.id === id);
    if (!v) return '<p class="vb-leer">Für diesen Verein gibt es keine Transferdaten.</p>';
    const k = konto(st, v), b = st.b[id] || { ein: 0, aus: 0 }, ba = (st.bAlt || {})[id];
    const zu = st.log.filter(e => e.nachId === id).sort((a, b) => b.s - a.s || b.ab - a.ab);
    const ab = st.log.filter(e => e.vonId === id).sort((a, b) => b.s - a.s || b.ab - a.ab);
    return `<div class="km-verein">
      <div class="km-kopf">
        <div><b>${geld(k.kasse)}</b><small>Kasse</small></div>
        <div><b>${geld(zufluss(v))}</b><small>Zufluss je Saison</small></div>
        <div><b class="km-sterne">${sterne(k.sd)}</b><small>Sportdirektor</small></div>
        <div><b>${geld(b.ein)} / ${geld(b.aus)}</b><small>Diese Saison ein / aus${ba ? ` · Vorsaison ${geld(ba.ein)} / ${geld(ba.aus)}` : ''}</small></div>
      </div>
      <div class="vb-teil">Zugänge <small>${zu.length}</small></div>${zu.length ? zu.map(zeileHtml).join('') : '<p class="vb-leer">Keine Zugänge.</p>'}
      <div class="vb-teil">Abgänge <small>${ab.length}</small></div>${ab.length ? ab.map(zeileHtml).join('') : '<p class="vb-leer">Keine Abgänge.</p>'}
    </div>`;
  }
  const CSS = `
    .km-kopf{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:4px 0 10px}
    .km-kopf>div{background:var(--card,rgba(127,127,127,.07));border-radius:12px;padding:8px 10px;min-width:0}
    .km-kopf b{display:block;font-size:16px}.km-kopf small{display:block;color:var(--text2);font-size:11.5px;line-height:1.3}
    .km-chips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px}
    .km-chip{border:2px solid var(--k-rand,#d9c29a);background:none;color:inherit;border-radius:99px;padding:5px 11px;font-weight:700;font-size:12.5px;cursor:pointer}
    .km-chip.an{background:var(--k-blau,#2c7cb5);border-color:var(--k-blau-tief,#1d5a86);color:#fff}
    .km-zeile{display:grid;grid-template-columns:40px minmax(0,1.3fr) minmax(0,1.6fr) minmax(0,.9fr);gap:10px;align-items:center;padding:7px 2px;border-bottom:1px solid var(--border,rgba(127,127,127,.18));font-size:13px}
    .km-sp,.km-weg,.km-geld{min-width:0}.km-sp b,.km-sp small,.km-geld b,.km-geld small{display:block}.km-sp small,.km-weg small,.km-geld small{color:var(--text2);font-size:11.5px}
    .km-weg{display:flex;flex-wrap:wrap;gap:3px 6px;align-items:center}.km-weg small{flex-basis:100%}.km-geld{text-align:right}
    .km-urteil{display:inline-block;margin-top:3px;font-size:11px;font-weight:700;padding:1px 7px;border-radius:99px}
    .km-gut{background:rgba(37,192,101,.16);color:#188a46}.km-schlecht{background:rgba(220,60,60,.15);color:#c0392b}.km-neutral{background:rgba(127,127,127,.15);color:var(--text2)}
    .km-sterne{color:#c9900a;letter-spacing:1px}.km-leer{color:var(--text2);font-size:13px}
    .km-gesicht{width:40px;height:40px;border-radius:10px;overflow:hidden;display:block}.km-gesicht svg{width:100%;height:100%;display:block}
    @media (max-width:560px){.km-zeile{grid-template-columns:40px 1fr auto}.km-weg{grid-column:2/-1;order:3}}`;
  function reiterEinbauen() {
    const view = document.getElementById('view-transfer');
    if (!view || document.getElementById('tr-sub-welt')) return;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const tabs = view.querySelector('.subtabs');
    const b = document.createElement('button');
    b.className = 'subtab'; b.id = 'tr-tab-welt'; b.innerHTML = '<i class="ti ti-arrows-exchange" aria-hidden="true"></i> Welt';
    tabs.appendChild(b);
    const sub = document.createElement('div'); sub.className = 'subview'; sub.id = 'tr-sub-welt'; sub.style.paddingTop = '12px';
    view.querySelector('.lg-wrap').appendChild(sub);
    const zeigen = () => {
      tabs.querySelectorAll('.subtab').forEach(x => x.classList.remove('active')); b.classList.add('active');
      view.querySelectorAll('.subview').forEach(x => x.classList.remove('active')); sub.classList.add('active');
      try { sub.innerHTML = weltHtml(); } catch (e) { sub.innerHTML = '<p class="km-leer">Transfers konnten nicht angezeigt werden.</p>'; console.warn('[Kickstil-KI-Markt] Anzeige', e); }
    };
    b.addEventListener('click', zeigen);
    sub.addEventListener('click', ev => { const c = ev.target.closest('[data-km-filter]'); if (c) { FILTER = c.getAttribute('data-km-filter'); sub.innerHTML = weltHtml(); } });
    if (typeof W.switchTransferSubview === 'function') {
      const _s = W.switchTransferSubview;
      W.switchTransferSubview = function () { sub.classList.remove('active'); b.classList.remove('active'); return _s.apply(this, arguments); };
      try { switchTransferSubview = W.switchTransferSubview; } catch (e) { /* window reicht */ }
    }
    W.__kmZeigen = zeigen;
  }
  function oeffnen() {
    try { if (typeof switchAppView === 'function') switchAppView('transfer', document.getElementById('nav-transfer') || document.createElement('button')); } catch (e) { /* weiter */ }
    setTimeout(() => { if (W.__kmZeigen) W.__kmZeigen(); }, 30);
  }

  // ── Haken: Deadline-Day (Sommer) und Winter ────────────────────────────────
  if (typeof W.advanceCalendarWeek === 'function') {
    const _w = W.advanceCalendarWeek;
    W.advanceCalendarWeek = function () {
      const r = _w.apply(this, arguments);
      try {
        if (r) wocheAbarbeiten();
      } catch (e) { console.warn('[Kickstil-KI-Markt] Woche', e); }
      return r;
    };
    try { advanceCalendarWeek = W.advanceCalendarWeek; } catch (e) { /* window reicht */ }
  }
  // Jede Woche im offenen Fenster genau einmal: KW 1 (auch im neuen Spiel), KW 2–8, Deadline-Day KW 9, Winter KW 27–30
  function wocheAbarbeiten() {
    try {
      if (!hatSpiel() || !AKTIV || typeof transferWindowInfo !== 'function') return;
      const wi = transferWindowInfo(LEAGUE.week), st = zustand(), key = LEAGUE.season + ':' + LEAGUE.week;
      if (!wi || !wi.open || st.letztes === key) return;
      st.letztes = key;
      const art = wi.type === 'Winter' ? (wi.deadline ? 'winterDeadline' : 'winter') : (wi.deadline ? 'deadline' : wi.firstWeek ? 'start' : LEAGUE.week <= 3 ? 'frueh' : 'sommer');
      // Alter Spielstand oder Saison ohne Geldbuchung (z. B. gerade aktualisiert): zum Sommerbeginn nachholen
      if (art === 'start' && st.geldSaison !== LEAGUE.season && st.log.length) saisonwechsel();
      fenster(art);
    } catch (e) { console.warn('[Kickstil-KI-Markt] Woche', e); }
  }
  if (typeof W.startNewSeason === 'function') {
    const _s = W.startNewSeason;
    W.startNewSeason = function () { const r = _s.apply(this, arguments); setTimeout(wocheAbarbeiten, 0); return r; };
    try { startNewSeason = W.startNewSeason; } catch (e) { /* window reicht */ }
  }
  if (typeof W._afterLoad === 'function') {
    const _a = W._afterLoad;
    W._afterLoad = function () { const r = _a.apply(this, arguments); setTimeout(wocheAbarbeiten, 200); return r; };
    try { _afterLoad = W._afterLoad; } catch (e) { /* window reicht */ }
  }
  const start = () => { try { reiterEinbauen(); } catch (e) { console.warn('[Kickstil-KI-Markt] Start', e); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(start, 50)); else setTimeout(start, 50);

  W.KSMarkt = {
    aufsteiger: id => { try { const w = (zustand().wandel || {})[id]; return !!(w && w.art === 'auf' && w.saison === LEAGUE.season); } catch (e) { return false; } },
    get aktiv() { return AKTIV; }, set aktiv(x) { AKTIV = !!x; },
    fenster, saisonwechsel, wocheAbarbeiten, liste, oeffnen, vereinHtml, weltHtml, zustand, zufluss, CFG,
    verein: id => { const st = zustand(), v = vereine().find(x => x.id === id); return v && st ? Object.assign({ zufluss: zufluss(v) }, konto(st, v)) : null; }
  };
  console.log('[Kickstil-KI-Markt v1] aktiv — Kasse, Sportdirektor, Transfers nach Bedarf im In- und Ausland (Sommer, Deadline-Day, Winter)');
})();
