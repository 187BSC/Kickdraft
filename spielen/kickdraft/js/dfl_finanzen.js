/* ═══════════════════════════════════════════════════════════════════════════
   DFL-FINANZEN  ·  v2
   ─────────────────────────────────────────────────────────────────────────
   Ein Finanzmodell für alle 32 Vereine (D41, Wunsch 2026-10-08: „die anderen
   Vereine sollen genauso wirtschaften müssen wie ich“).

   Regeln, die für den eigenen Verein und die KI gleich gelten:
     · Kaderkosten = Cap Hits × 1,1 („was gegen den Cap zählt, kostet Geld“:
       Gehalt + Handgeld in Raten über die Laufzeit + Dead Cap; 10 % Stab)
     · Betriebskosten = 20 % der Einnahmen (D75; vorher 25 % mit Anlagen)
     · TV-Topf = 92 % des Caps, gleich für alle
     · Ticketteilung wie in der NFL: 34 % jeder Ticketeinnahme gehen an den Gast
     · Tickets, Merch, Sponsoren, Banden mit dem Preisindex (Cap ÷ 120 Mio)
   Die KI rechnet mit denselben Formeln wie das Spiel bei Standardpreisen
   (gemessen 2026-10-08 für alle 32 Vereine) und investiert Überschüsse in
   Training, Scouting, Medizin (D102, nach gesparten Gehältern) und
   Merchandising – zu denselben Preisen wie du.
   Ist die Kasse leer, spart die KI (Free Agency und Verlängerungen nur bis
   92 % des Caps).

   v2 – laufende Kosten der Anlagen (D75, Nutzer 2026-10-10 „damit das Geld
   auch immer wohin geht“, eingebaut 2026-10-11):
     · Unterhalt je Stufe und Saison 0,2 … 11 Mio (Medizin 75 %), Stadion 60 € je Platz
     · Zustand 0–100 % je Anlage, sinkt in 6 (Scouting), 10 (Training, Fanshop,
       Medizin) bzw. 15 Saisons (Stadion); leer = eine Stufe weniger (ersetzt
       „Scouting veraltet“), das Stadion verliert bis 10 % Zuschauer
     · Sanieren: anteilig die Hälfte der letzten Ausbaustufe, Stadion 500 € je Platz
     · alle Preise (Ausbau, Unterhalt, Sanierung) wachsen mit dem Preisindex
     · KI-Eigentümer wie beim eigenen Verein (Investor, Traditionsverein, Mäzen):
       Höchststufen, Rücklage, Sanieren ab, Gewinnentnahme; die KI baut nur, was
       ihr Ergebnis dauerhaft trägt, spart auf den nächsten Schritt, legt die
       offene Untergrenze zurück und baut im Minus die teuerste Anlage zurück.
   Messschalter CFG.anlagen.aktiv = false rechnet wie v1 (Langzeitläufe vorher/nachher).

   D128 – KI-Wirtschaft (Nutzer 2026-10-13: „… die anderen holen auf und versuchen durch Infrastruktur besser zu werden.
   Wenn es gar nicht geht, bekommen sie eine Geldspritze, ohne dass jemand etwas mitbekommt.“), nur KI-Vereine:
     · Aufholen: schwache kleinere Vereine (Stärke-Rang ab 22 oder unteres Tabellendrittel, Ziel nicht unter der Stärke,
       Einnahmen höchstens Liga-Median) bauen zuerst
       Training, Scouting und Medizin aus, eine Stufe über dem Anspruch des Eigentümers, mit ¾ der
       Rücklage und bis zu 2 % der Einnahmen Mehrkosten über dem Ergebnis; diese drei verfallen nicht zuerst
     · stille Geldspritze (Eigentümer/Sponsor): zwei Saisonabschlüsse in Folge im Sparmodus (Kasse < 0) oder Kasse unter
       −10 % der Einnahmen → Kasse auf 8 % der Einnahmen, höchstens alle 4 Saisons je Verein und 2 je Saison ligaweit. Keine Meldung, kein Postfach,
       kein Ticker; gezählt nur in t._wirtschaft und st.spritzen (Tests, Langzeitlauf)
   Messschalter CFG.wirtschaft.aktiv = false rechnet wie vor D128.

   Reine Logik ohne DOM: läuft im Spiel und im Langzeitlauf (node).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const CFG = {
    startCap: 120000000,
    tvAnteil: 0.92,                    // D41: TV-Topf je Verein = 92 % des Caps
    gastAnteil: 0.34,                  // D41: Ticketteilung (NFL: 34 % an den Gast)
    stab: 1.10,                        // Personal = Cap Hits × 1,1
    betrieb: 0.20,                     // Betriebskosten = 20 % der Einnahmen (D75; die Anlagen kosten einzeln, siehe anlagen)
    heimspiele: 14,                    // 13 Ligaspiele + ein Heim-Testspiel
    // Tickets bei Standardpreisen (gemessen im Spiel, Cap 120 Mio): Dauerkarten je Platz und Saison,
    // Tageskarten je Platz und Heimspiel
    dauerkarteJePlatz: 546, tageskarteJePlatz: 16.7,
    // Merch wie engine_main.js (fanbaseSize × 0,55 € je Heimspiel) + Wochenumsatz bundle_finance.js
    merch: { basis: 900000 * 0.55, wochen: [1500, 4000, 9000, 17000, 31000, 53000, 86000, 136000, 206000, 311000],
      // 2026-10-22 (Nutzer: „Level 1 höher, dann weniger steil, später prozentual nicht mehr viel“, Test analyse/kd_anlagen_test.js):
      // Stufe 1 × 1,25, danach +18/+14/+11/+9/+7/+5/+4/+3/+2 % (Stufe 10 = 2 × Stufe 1 statt 5 ×); null = alte Kurve
      flach: [1, 1.18, 1.345, 1.49, 1.62, 1.73, 1.82, 1.89, 1.945, 1.98].map(x => x * 1.25) },
    sponsoren: 25200000,               // Trikot + Stadionname (bundle_economy.js: (12 + 6) Mio × 1,4)
    bandeJePlatz: 168000,              // 120.000 € × 1,4 je Bandenplatz; 8 Plätze, ab Stufe 4 vierzehn
    erfolgsbonus: [0, 1.5e6, 3e6, 5e6, 7e6, 10e6],   // Sponsorprämie nach Playoff-Runde (5 = Meister)
    stadionLeiter: [20000, 22000, 24000, 26000, 28000, 33000, 42000, 52000, 62000, 75000],
    // Ausbaupreise: FACILITY_DEFS (engine_main.js) stammen aus der Regionalliga-Zeit – Fanshop-Stufe 2 kostete
    // 90.000 € und brachte einem DFL-Verein ~1,8 Mio im Jahr. In der DFL × 4 (gilt für dich und die KI).
    ausbauFaktor: 4,
    ausbau: {
      training: [0, 40000, 80000, 160000, 400000, 900000, 2160000, 4550000, 8500000, 15400000],
      scouting: [0, 40000, 100000, 210000, 520000, 1120000, 2700000, 5660000, 10620000, 19250000],
      merchandising: [0, 90000, 240000, 560000, 1300000, 3100000, 7200000, 15800000, 30500000, 56000000],
      // Medizinische Abteilung (D102): 75 % des Trainingsgeländes – alle Stufen zusammen 96,6 Mio € (DFL-Preise)
      medizin: [0, 30000, 60000, 120000, 300000, 675000, 1620000, 3412500, 6375000, 11550000],
      // Stadion je Stufe der stadionLeiter (wie FACILITY_DEFS.stadium.cost, engine_main.js) – für den Ausbau der KI (2026-10-22)
      stadion: [0, 120000, 310000, 650000, 1700000, 3920000, 9900000, 21450000, 40800000, 74800000]
    },
    // 2026-10-22 (Nutzer: Nebenbefund „die KI baut ihr Stadion nie aus“ → ausbauen): eine Stufe je Saison, wenn der Mehrerlös
    // (Plätze × Ticketerlös − Unterhalt) den Preis im Rückfluss-Horizont des Eigentümers (Profil.jahre) trägt und Geld da ist
    kiStadion: { aktiv: true },
    ki: {
      startKasse: 6000000,             // wie der eigene Verein zum Karrierestart
      reserve: 0.08,                   // so viel der Einnahmen bleibt immer auf dem Konto
      investAnteil: 0.6,               // höchstens dieser Teil des Überschusses fließt in Anlagen
      kasseMax: 1.0,                   // mehr als eine Jahreseinnahme hortet niemand (Rest an den Eigentümer)
      sparQuote: 0.92,                 // Sparmodus: Kader nur bis 92 % des Caps
      sparAb: 0                        // Sparmodus, sobald die Kasse darunter liegt
    },
    // ── D128: KI-Wirtschaft (Aufholen über Anlagen, stille Geldspritze) ──
    wirtschaft: {
      aktiv: true,
      // wer: Stärke-Rang ab 22 oder unteres Tabellendrittel – wenn das Ziel nicht unter der Stärke liegt (Umbruch baut nicht aus).
      // Nicht über die Ziel-Lücke allein: gemessen holten sich damit vor allem gefallene Große (Ziel = Startstärke) Anlagen über dem
      // Anspruch und blieben oben (Start ↔ J12 höher statt niedriger)
      // einnahmenBis: nur die kleinere Hälfte (Einnahmen höchstens der Liga-Median) – gefallene Große haben das Geld ohnehin
      aufholen: { rangAb: 22, erfolgBis: 0.33, lueckeMin: 0, einnahmenBis: 1.0, reihe: ['training', 'scouting', 'medizin'], maxPlus: 1,
                  marge: 0.02,             // so viel der Einnahmen darf der Ausbau mehr kosten, als das Ergebnis trägt
                  reserve: 0.75 },         // Anteil der Rücklage des Eigentümers, der beim Aufholen bleibt
      spritze: { sparJahre: 2,             // Saisonabschlüsse in Folge im Sparmodus (Kasse < sparAb)
                 tief: -0.10,              // oder Kasse unter −10 % der Einnahmen: sofort
                 auf: 0.08,                // Kasse danach: 8 % der Einnahmen (= ki.reserve, was immer auf dem Konto bleibt)
                 pause: 4,                 // höchstens alle 4 Saisons je Verein
                 proSaison: 2 }            // ligaweit höchstens 2 je Saison (die knappsten zuerst)
    },
    // ── D75: laufende Kosten der Anlagen (Vorschau spiel/dfl_kosten_vorschau.html, freigegeben „so“) ──
    anlagen: {
      aktiv: true,                     // Messschalter: false = wie vor D75 (Betrieb 25 %, Anlagen gratis, alte KI, Scouting veraltet)
      betriebOhne: 0.25,               // Betriebsanteil ohne D75 (Anlagenunterhalt steckte darin)
      // Unterhalt je Saison bei Preisindex 1, Stufe 1 … 10 (Training, Scouting, Fanshop gleich; oben steil)
      unterhalt: [200000, 300000, 500000, 800000, 1200000, 1800000, 2800000, 4500000, 7000000, 11000000],
      faktor: { training: 1, scouting: 1, merchandising: 1, medizin: 0.75 },   // Medizin wie ihre Preise (D102: 75 % des Trainings)
      stadionJePlatz: 60,              // Stadion-Unterhalt je Platz und Saison
      lebensdauer: { training: 10, scouting: 6, merchandising: 10, medizin: 10, stadion: 15 },   // Saisons von 100 auf 0 %
      sanierung: 0.5,                  // Vollsanierung (0 → 100 %) = halber Preis der letzten Ausbaustufe
      stadionSanierungJePlatz: 500,    // Stadion: 500 € je Platz für 0 → 100 %
      stadionNachfrage: 0.10,          // Stadion bei 0 % → 10 % weniger Zuschauer (100 % → ±0)
      nachVerfall: 50,                 // Zustand nach dem Stufenverlust
      startZustand: [40, 100],         // Zustand zum Start (fest je Verein und Liga)
      marode: 30,                      // darunter warnt das Postfach (eigener Verein)
      // KI-Eigentümer (gemessen in der Vorschau, 6 Ligen × 15 Saisons): reihe = Ausbau-Reihenfolge (Medizin danach, nach Rendite),
      // max = höchste Stufe, die der Eigentümer will; marge: Ausbau nur, wenn Ø-Ergebnis − Verschleiß − Mehrkosten ≥ marge × Einnahmen;
      // reserve: bleibt auf dem Konto (Anteil der Einnahmen); invest: so viel vom Rest fließt in Anlagen; saniertAb: Zustand, ab dem
      // saniert wird; jahre: Rückfluss-Horizont des Fanshops; kasseMax: darüber entnimmt der Eigentümer (Mäzen: nie, Deckel ki.kasseMax)
      profile: {
        investor:  { name: 'Investor', anteil: 0.30, reihe: ['merchandising', 'training', 'scouting'], max: { training: 8, scouting: 7, merchandising: 10, medizin: 8 },
                     marge: 0.03, reserve: 0.15, invest: 1, saniertAb: 30, jahre: 6, kasseMax: 0.3 },
        tradition: { name: 'Traditionsverein', anteil: 0.40, reihe: ['training', 'merchandising', 'scouting'], max: { training: 9, scouting: 9, merchandising: 10, medizin: 9 },
                     marge: 0, reserve: 0.15, invest: 1, saniertAb: 50, jahre: 5, kasseMax: 0.6 },
        maezen:    { name: 'Mäzen', anteil: 0.30, reihe: ['training', 'scouting', 'merchandising'], max: { training: 10, scouting: 10, merchandising: 10, medizin: 10 },
                     marge: 0, reserve: 0.10, invest: 1, saniertAb: 40, jahre: 8, kasseMax: null }
      }
    }
  };

  const klemme = (x, a, b) => Math.max(a, Math.min(b, x));
  const preisIndex = cap => (cap || CFG.startCap) / CFG.startCap;
  const tv = cap => Math.round(CFG.tvAnteil * (cap || CFG.startCap));
  // Preis für den Schritt von Stufe s auf s+1 (DFL-Preise)
  const ausbauPreis = (art, s) => (CFG.ausbau[art][s] || 0) * CFG.ausbauFaktor;
  const ausbauPreise = art => CFG.ausbau[art].map(x => x * CFG.ausbauFaktor);
  function stadionStufe(plaetze) {
    let s = 1;
    CFG.stadionLeiter.forEach((c, i) => { if (plaetze >= c) s = i + 1; });
    return s;
  }
  // Fanshop zum Start (D53, Wunsch 2026-10-09: „hat Bayern schon einen größeren Fanshop“): große Vereine haben schon ausgebaut –
  // Ø aus Stadionstufe, Training und Scouting minus 1, zwischen 1 und 8 (Fulda 1 … Bayern und Dortmund 8)
  function fanshopStart(a) {
    a = a || {};
    return klemme(Math.round((stadionStufe(a.stadion || 20000) + (a.training || 5) + (a.scouting || 5)) / 3) - 1, 1, 8);
  }
  function capTeam(t) {
    const G = window.DFLGenerator;
    return G ? G.capHitTeam(t) : 0;
  }

  // ── D75: Anlagen – Unterhalt, Zustand, Sanierung (für alle 32 gleich) ────
  // Arten: training, scouting, merchandising, medizin (Stufe 1–10) und stadion (Plätze). Im Spiel heißt das Stadion „stadium“.
  const ARTEN = ['training', 'scouting', 'merchandising', 'medizin'];
  const ALLE = ARTEN.concat(['stadion']);
  const anlagenAktiv = () => !!(CFG.anlagen && CFG.anlagen.aktiv);
  const betriebAnteil = () => (anlagenAktiv() ? CFG.betrieb : CFG.anlagen.betriebOhne);
  // Ausbaupreis mit Preisindex: mit D75 wachsen alle Preise mit dem Cap (vorher fest)
  const ausbauPreisJetzt = (art, s, cap) => ausbauPreis(art, s) * (anlagenAktiv() ? preisIndex(cap) : 1);
  // Unterhalt einer Anlage je Saison
  function unterhalt(art, stufe, cap) {
    if (!anlagenAktiv()) return 0;
    const A = CFG.anlagen, s = klemme(Math.round(stufe || 1), 1, 10);
    return A.unterhalt[s - 1] * (A.faktor[art] != null ? A.faktor[art] : 1) * preisIndex(cap);
  }
  const stadionUnterhalt = (plaetze, cap) => (anlagenAktiv() ? (plaetze || 20000) * CFG.anlagen.stadionJePlatz * preisIndex(cap) : 0);
  // Stufe eines Vereins der Welt (Medizin über DFLSaison.medStufe: fehlt sie, gilt die Startstufe)
  function stufeVon(t, art) {
    const a = (t && t.anlagen) || {};
    if (art === 'medizin') { const S = window.DFLSaison; return S && S.medStufe ? S.medStufe(t) : (a.medizin || 1); }
    return a[art] || (art === 'merchandising' ? 1 : 5);
  }
  // Unterhalt aller Anlagen eines Vereins der Welt (je Art und Summe)
  function anlagenKosten(t, cap) {
    const je = {}; let summe = 0;
    if (!anlagenAktiv()) return { summe: 0, je };
    ARTEN.forEach(art => { je[art] = unterhalt(art, stufeVon(t, art), cap); summe += je[art]; });
    je.stadion = stadionUnterhalt(t && t.anlagen && t.anlagen.stadion, cap); summe += je.stadion;
    return { summe, je };
  }
  // Vollsanierung (0 → 100 %): halber Preis der letzten Ausbaustufe (Stufe 1: halber Preis von 1 → 2), Stadion 500 € je Platz
  function sanierungVoll(art, stufe, cap, plaetze) {
    const A = CFG.anlagen;
    if (art === 'stadion' || art === 'stadium') return (plaetze || 20000) * A.stadionSanierungJePlatz * preisIndex(cap);
    return A.sanierung * ausbauPreis(art, Math.max(1, (stufe || 1) - 1)) * preisIndex(cap);
  }
  // Sanieren bis 100 % kostet den fehlenden Anteil
  const sanierPreis = (art, stufe, zustand, cap, plaetze) => Math.max(0, 100 - (zustand == null ? 100 : zustand)) / 100 * sanierungVoll(art, stufe, cap, plaetze);
  const lebensdauer = art => CFG.anlagen.lebensdauer[art === 'stadium' ? 'stadion' : art] || 10;
  // Verschleiß je Saison = Vollsanierung ÷ Lebensdauer (was ständiges Sanieren im Jahr kostet)
  const verschleissJahr = (art, stufe, cap, plaetze) => sanierungVoll(art, stufe, cap, plaetze) / lebensdauer(art);
  // Was eine Stufe mehr je Saison zusätzlich kostet (Unterhalt + Verschleiß)
  const mehrkosten = (art, s, cap) => (unterhalt(art, s + 1, cap) - unterhalt(art, s, cap)) + (verschleissJahr(art, s + 1, cap) - verschleissJahr(art, s, cap));
  // Stadionzustand → Zuschauer: 100 % → 1, 0 % → 1 − stadionNachfrage
  const komfort = z => (anlagenAktiv() ? 1 - CFG.anlagen.stadionNachfrage * (1 - klemme(z == null ? 100 : z, 0, 100) / 100) : 1);
  // Zustand und Eigentümer zum Start: fest je Verein und Liga (eigener Zufall, stört den Ligazufall nicht)
  function anlagenStart(t, seed) {
    if (!t) return t;
    const G = window.DFLGenerator, A = CFG.anlagen;
    if (t.zustand && t.profil) return t;
    const saat = ((G && G.hashText ? G.hashText(String(t.id) + '|anlagen') : 7) ^ ((seed || 1) >>> 0)) >>> 0;
    const r = G && G.rngAus ? G.rngAus(saat) : Math.random;
    const [a, b] = A.startZustand;
    const z = {}; ALLE.forEach(k => { z[k] = Math.round(a + r() * (b - a)); });
    if (!t.zustand) t.zustand = z;
    if (!t.profil) {
      const x = r(), P = A.profile;
      t.profil = x < P.investor.anteil ? 'investor' : x < P.investor.anteil + P.tradition.anteil ? 'tradition' : 'maezen';
    }
    return t;
  }
  // Verschleiß zum Saisonende: Zustand sinkt, leer = eine Stufe weniger (Zustand danach 50 %); Stadion bleibt bei 0 %
  // zust: { training, scouting, merchandising, medizin, stadion|stadium } · stufe(art) / senken(art) für Welt und Spiel
  function verschleissSchritt(zust, stufe, senken) {
    const A = CFG.anlagen, verloren = [];
    Object.keys(zust).forEach(k => {
      const art = k === 'stadium' ? 'stadion' : k;
      if (!A.lebensdauer[art]) return;
      zust[k] = (zust[k] == null ? 100 : zust[k]) - 100 / A.lebensdauer[art];
      if (zust[k] > 1e-9) return;
      if (art === 'stadion') { zust[k] = 0; return; }
      const s = stufe(k);
      if (s > 1) { senken(k, s - 1); verloren.push({ art: k, von: s, auf: s - 1 }); }
      zust[k] = A.nachVerfall;
    });
    return verloren;
  }

  // ── Einnahmen eines Vereins (Standardpreise) ─────────────────────────────
  // Nachfrage: ±5 % nach Prestige (Erfolg der letzten Jahre) – wie die Fanstimmung beim eigenen Verein
  const nachfrage = t => 0.95 + 0.1 * klemme(t.prestige || 0, 0, 1);
  function ticketsHeim(t, cap) {
    const plaetze = (t.anlagen && t.anlagen.stadion) || 20000;
    // D75: ein marodes Stadion kostet bis 10 % Zuschauer
    return plaetze * (CFG.dauerkarteJePlatz + CFG.tageskarteJePlatz * CFG.heimspiele) * nachfrage(t) * preisIndex(cap) * komfort(t.zustand && t.zustand.stadion);
  }
  function merch(t, cap) {
    const a = t.anlagen || {}, plaetze = a.stadion || 20000, stufe = a.merchandising || 1;
    const erfolg = t._erfolg != null ? t._erfolg : 0.5;                   // 0 … 1 (Tabellenplatz der Vorsaison)
    const fans = (0.7 + 0.8 * erfolg) * (0.8 + Math.min(0.6, plaetze / 75000 * 0.6));
    const spieltag = CFG.heimspiele * CFG.merch.basis * fans * (1 + (stufe - 1) * 0.2);
    const woche = 52 * CFG.merch.wochen[stufe - 1] * (0.7 + (stadionStufe(plaetze) - 1) * 0.1);
    // Messvariante (Nutzer 2026-10-22: „Level 1 höher ansetzen und dann weniger steil“): Stufe 1 × flach[stufe − 1]; null = wie bisher
    const flach = CFG.merch.flach;
    if (Array.isArray(flach)) return (CFG.heimspiele * CFG.merch.basis * fans + 52 * CFG.merch.wochen[0] * (0.7 + (stadionStufe(plaetze) - 1) * 0.1)) * flach[stufe - 1] * preisIndex(cap);
    return (spieltag + woche) * preisIndex(cap);
  }
  // Ticketschnitt der Liga (für den Gästeanteil)
  function ticketSchnitt(L) {
    return L.teams.reduce((s, t) => s + ticketsHeim(t, L.cap), 0) / Math.max(1, L.teams.length);
  }
  function einnahmen(t, L, runde) {
    const cap = L.cap, pi = preisIndex(cap);
    const heim = ticketsHeim(t, cap), schnitt = ticketSchnitt(L);
    const e = {
      tv: tv(cap),
      tickets: heim * (1 - CFG.gastAnteil),
      gast: schnitt * CFG.gastAnteil,
      merch: merch(t, cap),
      sponsoren: CFG.sponsoren * pi * (0.9 + 0.2 * klemme(t.prestige || 0, 0, 1)),
      banner: (stadionStufe((t.anlagen && t.anlagen.stadion) || 20000) >= 4 ? 14 : 8) * CFG.bandeJePlatz * pi,
      bonus: (CFG.erfolgsbonus[runde || 0] || 0) * pi
    };
    e.total = e.tv + e.tickets + e.gast + e.merch + e.sponsoren + e.banner + e.bonus;
    return e;
  }
  // Kosten einer Saison: Kader (Cap Hits × 1,1), Betrieb (Anteil der Einnahmen), D75: Unterhalt der Anlagen (cap: Preisindex)
  function kosten(t, e, cap) {
    const personal = capTeam(t) * CFG.stab;
    const betrieb = e.total * betriebAnteil();
    const G = window.DFLGenerator;
    const anlagen = anlagenKosten(t, cap || (G && G.CFG && G.CFG.cap) || CFG.startCap).summe;
    // D118: Trainerteam – Gehälter der Saison außerhalb des Caps (+ Abfindungen/halbe Saisons), wie Betriebskosten
    const Tr = window.DFLTrainer, trainer = Tr && Tr.kosten ? Tr.kosten(t) : 0;
    return { personal, betrieb, anlagen, trainer, total: personal + betrieb + anlagen + trainer };
  }

  // ── KI: Sparmodus und Investitionen ──────────────────────────────────────
  const sparmodus = t => t.kasse != null && t.kasse < CFG.ki.sparAb;
  // Darf das Team diesen Jahreswert noch ausgeben (Cap und Kasse)?
  function darfAusgeben(t, wert) {
    if (!sparmodus(t)) return true;
    return capTeam(t) + wert <= t.salary_cap_limit * CFG.ki.sparQuote;
  }
  // Rechnet sich die nächste Fanshop-Stufe in höchstens `jahre` Saisons?
  function merchLohnt(t, cap, jahre) {
    const a = t.anlagen, s = a.merchandising || 1;
    if (s >= 10) return false;
    const jetzt = merch(t, cap);
    a.merchandising = s + 1; const danach = merch(t, cap); a.merchandising = s;
    return ausbauPreis('merchandising', s) <= (danach - jetzt) * jahre;
  }
  // Rechnet sich die nächste Stufe der medizinischen Abteilung in höchstens `jahre` Saisons (D102)? Gesparte Ausfallwochen
  // (Mittel der letzten bis zu 3 Saisons, ohne Verlauf 100) × Gehalt je Spielerwoche – Risiko und Dauer sinken je Stufe
  function medizinLohnt(t, cap, jahre) {
    const S = window.DFLSaison, C = S && S.CFG && S.CFG.verletzung;
    if (!C || !C.aktiv || !S.medStufe) return false;
    const s = S.medStufe(t);
    if (s >= C.med.max) return false;
    const v = t.ausfallVerlauf || [], wochen = v.length ? v.reduce((x, y) => x + y, 0) / v.length : 100;
    const f = k => (1 - C.med.risiko * (k - 1)) * (1 - C.med.dauer * (k - 1));
    const spart = wochen * (1 - f(s + 1) / f(s));
    const lohnWoche = capTeam(t) / Math.max(1, (t.roster || []).length) / 52;
    return ausbauPreis('medizin', s) <= spart * lohnWoche * (jahre || C.rendite);
  }
  // Überschuss in Anlagen, wie ein umsichtiger Manager: Fanshop, wenn er sich schnell rechnet (≤ 4 Jahre),
  // dann Training (Entwicklung), dann Scouting (Draft, veraltet ohne Ausbau), dann die Medizin, wenn sie sich über gesparte
  // Gehälter in ≤ 5 Saisons rechnet (D102), dann Fanshop bis 8 Jahre Rückfluss
  function investieren(t, e, st, cap) {
    const a = t.anlagen;
    if (a.merchandising == null) a.merchandising = 1;
    const S = window.DFLSaison;
    if (S && S.medStufe) S.medStufe(t);                     // Startstufe setzen, falls sie fehlt
    const reserve = e.total * CFG.ki.reserve;
    let budget = Math.max(0, (t.kasse - reserve) * CFG.ki.investAnteil);
    const ausgaben = [];
    const schritte = [['merchandising', 4], ['training'], ['scouting'], ['medizin'], ['merchandising', 8], ['training'], ['scouting']];
    for (const [art, jahre] of schritte) {
      if (art === 'medizin' && !a.medizin) continue;
      const stufe = a[art] || 1;
      if (stufe >= 10) continue;
      if (art === 'medizin' && !medizinLohnt(t, cap)) continue;
      if (jahre && !merchLohnt(t, cap, jahre)) continue;
      const preis = ausbauPreis(art, stufe);
      if (preis > budget) continue;
      budget -= preis; t.kasse -= preis; a[art] = stufe + 1;
      if (art === 'scouting') a.scoutingAlter = 0;
      ausgaben.push(art);
    }
    if (st && ausgaben.length) st.ausbau = (st.ausbau || 0) + ausgaben.length;
    return ausgaben;
  }

  // ── D75: KI wirtschaftet wie ein Eigentümer ──────────────────────────────
  // Offene Untergrenze (D20): was bis zum Ende des 4-Jahres-Fensters voraussichtlich nachzuzahlen ist – die KI legt es zurück
  function offeneUntergrenze(t, L) {
    const S = window.DFLSaison, U = S && S.CFG && S.CFG.untergrenze;
    if (!U || !U.aktiv || !t.ausgaben || !t.ausgaben.length) return 0;
    const n = ((L.saisonIndex || 0) + 1) % U.jahre;            // Saisons im laufenden Fenster (0 = gerade abgerechnet)
    if (n === 0) return 0;
    const fenster = t.ausgaben.slice(-n), letzte = t.ausgaben[t.ausgaben.length - 1];
    const bisher = fenster.reduce((s, x) => s + (U.anteil * x.cap - x.bar), 0);
    const rest = Math.max(0, U.anteil - letzte.bar / Math.max(1, letzte.cap)) * L.cap * (U.jahre - n);
    return Math.max(0, bisher + rest);
  }
  // Fanshop s → s+1: Mehrertrag − Mehrkosten (Unterhalt + Verschleiß) je Saison
  function merchGewinn(t, cap, s) {
    const a = t.anlagen, alt = a.merchandising;
    a.merchandising = s; const e1 = merch(t, cap);
    a.merchandising = s + 1; const e2 = merch(t, cap);
    a.merchandising = alt;
    return (e2 - e1) - mehrkosten('merchandising', s, cap);
  }
  const plaetzeVon = t => (t.anlagen && t.anlagen.stadion) || 20000;
  const verschleissSumme = (t, cap) => ARTEN.reduce((s, art) => s + verschleissJahr(art, stufeVon(t, art), cap), 0) + verschleissJahr('stadion', 0, cap, plaetzeVon(t));
  // Sanieren und Ausbauen nach dem Profil des Eigentümers. Der Spielraum ist das Ergebnis der letzten bis zu 3 Saisons
  // minus Nachzahlungen (Untergrenze), Verschleiß aller Anlagen und Mindestmarge: nur was er dauerhaft trägt, wird gebaut.
  // D128: holt dieser KI-Verein über die Anlagen auf? Stärke-Rang am Saisonende (DFLHandel.lagenSetzen), Tabellendrittel, Ziel-Lücke,
  // kleinere Hälfte der Liga (e: Einnahmen der Saison, opt.einMedian: Median der Liga – ohne Angabe keine Grenze)
  function holtAuf(t, e, opt) {
    const W = CFG.wirtschaft, A = W && W.aufholen;
    if (!W || !W.aktiv || !A) return false;
    if (e && opt && opt.einMedian != null && A.einnahmenBis != null && e.total > opt.einMedian * A.einnahmenBis) return false;
    const Tr = window.DFLTrainer;
    if (Tr && Tr.eigen && Tr.eigen() === t.id) return false;
    const G = window.DFLGenerator;
    const luecke = t.ziel && t.ziel.wert != null && G && G.teamOvr && t.roster && t.roster.length ? t.ziel.wert - G.teamOvr(t) : 0;
    const schwach = (t.lage && t.lage.rang >= A.rangAb) || (t._erfolg != null && t._erfolg <= A.erfolgBis);
    return schwach && luecke >= A.lueckeMin;
  }
  function kiInvest(t, e, cap, st, L, opt) {
    const A = CFG.anlagen, P0 = A.profile[t.profil] || A.profile.tradition, a = t.anlagen;
    if (a.merchandising == null) a.merchandising = 1;
    stufeVon(t, 'medizin');                                    // Medizin-Startstufe setzen, falls sie fehlt
    const aus = { sanierung: 0, ausbau: 0, schritte: 0, saniert: 0, rueckbau: 0 };
    // D128: Aufholen – Training, Scouting, Medizin zuerst, eine Stufe über dem Anspruch, kleinere Rücklage, etwas Mehrkosten erlaubt
    const H = holtAuf(t, e, opt) ? CFG.wirtschaft.aufholen : null, fokus = H ? H.reihe : [];
    const P = H ? Object.assign({}, P0, { reserve: P0.reserve * H.reserve, marge: P0.marge - H.marge,
      reihe: H.reihe.concat(P0.reihe.filter(x => H.reihe.indexOf(x) < 0)),
      max: Object.assign({}, ...Object.keys(P0.max).map(k => ({ [k]: Math.min(10, P0.max[k] + (H.reihe.indexOf(k) >= 0 ? H.maxPlus : 0)) }))) }) : P0;
    if (H) { aus.aufholen = true; const w = t._wirtschaft = t._wirtschaft || { spar: 0, spritzen: 0, summe: 0, zuletzt: null }; w.aufholen = (w.aufholen || 0) + 1; }
    const reserve = e.total * P.reserve + offeneUntergrenze(t, L);
    let budget = Math.max(0, (t.kasse - reserve) * P.invest);
    const erg = (t.ergebnisse || []).slice(-3), schnitt = erg.length ? erg.reduce((s, x) => s + x, 0) / erg.length : 0;
    const nz = t._nachz && t._nachz.length ? t._nachz.reduce((x, y) => x + y, 0) / Math.max(4, t._nachz.length) : 0;
    let spielraum = schnitt - nz - verschleissSumme(t, cap) - P.marge * e.total;
    const last = art => unterhalt(art, stufeVon(t, art), cap) + verschleissJahr(art, stufeVon(t, art), cap);
    // 0) Sparprogramm: Kasse im Minus und das Ergebnis trägt die Anlagen nicht → teuerste Anlage eine Stufe zurück
    if (t.kasse < 0 && spielraum < 0) {
      // D128: wer aufholt, baut zuerst außerhalb von Training/Scouting/Medizin zurück
      const teuer = ARTEN.filter(art => stufeVon(t, art) > 3).sort((x, y) => (fokus.indexOf(x) >= 0) - (fokus.indexOf(y) >= 0)
        || unterhalt(y, stufeVon(t, y), cap) - unterhalt(x, stufeVon(t, x), cap))[0];
      if (teuer) { a[teuer] = stufeVon(t, teuer) - 1; aus.rueckbau++; }
      return aus;
    }
    // 1) Sanieren, dringendstes zuerst. Trägt das Ergebnis die Anlagen nicht, verfällt die teuerste.
    const opfer = spielraum < 0 ? ARTEN.filter(x => fokus.indexOf(x) < 0).sort((x, y) => last(y) - last(x))[0] : null;
    const reihe = ALLE.filter(k => t.zustand[k] <= P.saniertAb).sort((x, y) => t.zustand[x] - t.zustand[y]);
    for (const k of reihe) {
      if (k === opfer) continue;
      if (k !== 'stadion' && stufeVon(t, k) > P.max[k]) continue;            // über dem Anspruch des Eigentümers: verfallen lassen
      if (k === 'merchandising') { const s0 = stufeVon(t, k); if (s0 > 1 && merchGewinn(t, cap, s0 - 1) * P.jahre < sanierungVoll(k, s0, cap)) continue; }
      const preis = sanierPreis(k, stufeVon(t, k), t.zustand[k], cap, plaetzeVon(t));
      if (preis > budget) continue;
      budget -= preis; t.kasse -= preis; t.zustand[k] = 100; aus.sanierung += preis; aus.saniert++;
    }
    // 2) Ausbauen in der Reihenfolge des Eigentümers, je Anlage höchstens eine Stufe je Saison; dann die Medizin (Rendite D102 +
    //    Mehrkosten tragbar). Ist der gewünschte Schritt tragbar, aber noch zu teuer, spart der Verein darauf.
    for (const art of (P.reihe.indexOf('medizin') >= 0 ? P.reihe : P.reihe.concat(['medizin']))) {
      const s0 = stufeVon(t, art); if (s0 >= 10 || s0 >= P.max[art]) continue;
      const preis = ausbauPreisJetzt(art, s0, cap), mk = mehrkosten(art, s0, cap);
      let will;
      if (art === 'merchandising') will = merchGewinn(t, cap, s0) * P.jahre >= preis;
      else if (art === 'medizin') will = (H || medizinLohnt(t, cap)) && spielraum - mk >= 0;     // D128: wer aufholt, baut sie auch so
      else will = spielraum - mk >= 0;
      if (!will) continue;
      if (preis > budget) { if (art === 'medizin' || fokus.indexOf(art) >= 0) continue; break; }     // D128: wer aufholt, nimmt den nächsten Schritt
      if (art !== 'merchandising') spielraum -= mk;
      budget -= preis; t.kasse -= preis; a[art] = s0 + 1; t.zustand[art] = 100; aus.ausbau += preis; aus.schritte++;
      if (art === 'scouting') a.scoutingAlter = 0;
    }
    // 3) Stadion: nächste Stufe der Leiter, wenn sie sich im Horizont des Eigentümers rechnet
    if (CFG.kiStadion && CFG.kiStadion.aktiv) {
      const pl = plaetzeVon(t), stufeJetzt = stadionStufe(pl), neu = CFG.stadionLeiter[stufeJetzt];
      if (neu && neu > pl) {
        const mehr = neu - pl, je = (CFG.dauerkarteJePlatz + CFG.tageskarteJePlatz * CFG.heimspiele) * nachfrage(t) * preisIndex(cap) - A.stadionJePlatz * preisIndex(cap);
        const preis = (CFG.ausbau.stadion[stufeJetzt] || 0) * CFG.ausbauFaktor * preisIndex(cap);
        if (preis > 0 && mehr * je * P.jahre >= preis && preis <= budget) {
          budget -= preis; t.kasse -= preis; a.stadion = neu; aus.ausbau += preis; aus.schritte++; aus.stadion = neu;
        }
      }
    }
    if (st) st.ausbau = (st.ausbau || 0) + aus.schritte;
    if (st && H) { st.aufholen = (st.aufholen || 0) + 1; st.aufholSchritte = (st.aufholSchritte || 0) + aus.schritte; }
    return aus;
  }

  // D128: stille Geldspritze des Eigentümers/Sponsors – nur intern (t._wirtschaft, st.spritzen), nie für den eigenen Verein.
  // spritzeBedarf zählt die Saisons im Sparmodus mit (einmal je Saisonabschluss) und sagt, ob der Verein jetzt eine braucht
  // (Pause beachtet); spritzeGeben bucht sie (Betrag, 0 = keine). geldspritze = beides für einen Verein.
  function spritzeBedarf(t, e, L) {
    const W = CFG.wirtschaft, S = W && W.spritze;
    if (!W || !W.aktiv || !S) return false;
    const Tr = window.DFLTrainer;
    if (Tr && Tr.eigen && Tr.eigen() === t.id) return false;
    const w = t._wirtschaft = t._wirtschaft || { spar: 0, spritzen: 0, summe: 0, zuletzt: null };
    const idx = (L && L.saisonIndex) || 0;
    w.spar = sparmodus(t) ? w.spar + 1 : 0;
    const noetig = w.spar >= S.sparJahre || t.kasse < S.tief * e.total;
    return noetig && (w.zuletzt == null || idx - w.zuletzt >= S.pause);
  }
  function spritzeGeben(t, e, L, st) {
    const S = CFG.wirtschaft.spritze, w = t._wirtschaft;
    const betrag = Math.max(0, Math.round(S.auf * e.total - t.kasse));
    if (!betrag || !w) return 0;
    t.kasse += betrag; w.spritzen++; w.summe += betrag; w.zuletzt = (L && L.saisonIndex) || 0; w.spar = 0;
    if (st) { st.spritzen = (st.spritzen || 0) + 1; st.spritzeSumme = (st.spritzeSumme || 0) + betrag; }
    return betrag;
  }
  const geldspritze = (t, e, L, st) => (spritzeBedarf(t, e, L) ? spritzeGeben(t, e, L, st) : 0);

  // Saisonabschluss aller KI-Vereine: Ergebnis, Kasse, Investitionen.
  // tabelle: sortierte Zeilen der Saison (für Merch-Erfolg), po: Playoffs (Runde je Team)
  function saisonAbschlussKI(L, tabelle, po, ohne, st) {
    if (anlagenAktiv()) return saisonAbschlussD75(L, tabelle, po, ohne, st);
    const rang = new Map((tabelle || []).map((z, i) => [z.id, i + 1]));
    const aus = (po && po.ausgeschieden) || {};
    L.teams.forEach(t => {
      if (ohne && ohne.has(t.id)) return;
      if (t.kasse == null) t.kasse = CFG.ki.startKasse * preisIndex(L.cap);
      const e = einnahmen(t, L, aus[t.id] || 0), k = kosten(t, e);
      const ergebnis = e.total - k.total;
      t.kasse += ergebnis;
      const deckel = e.total * CFG.ki.kasseMax;
      if (t.kasse > deckel) t.kasse = deckel;
      t.finanzen = { saison: L.saisonJahr, einnahmen: Math.round(e.total), personal: Math.round(k.personal), betrieb: Math.round(k.betrieb),
        ergebnis: Math.round(ergebnis), kasse: Math.round(t.kasse) };
      (t.ergebnisse = t.ergebnisse || []).push(Math.round(ergebnis));
      if (t.ergebnisse.length > 10) t.ergebnisse.shift();
      if (rang.has(t.id)) t._erfolg = 1 - (rang.get(t.id) - 1) / Math.max(1, rang.size - 1);
      investieren(t, e, st, L.cap);
      if (st) { st.kasse = st.kasse || []; st.kasse.push(t.kasse); }
    });
  }
  // D75: Ergebnis mit Unterhalt → Kasse (Deckel 1 Jahreseinnahme) → Verschleiß zum Saisonende → Sanieren/Ausbauen nach Profil →
  // Entnahme des Eigentümers (über kasseMax × Einnahmen, nie unter Rücklage + offene Untergrenze)
  function saisonAbschlussD75(L, tabelle, po, ohne, st) {
    const rang = new Map((tabelle || []).map((z, i) => [z.id, i + 1]));
    const aus = (po && po.ausgeschieden) || {};
    const cap = L.cap;
    L.teams.forEach(t => anlagenStart(t, L.seed));
    // Einnahmen aller Teams vor den Änderungen (der Gästeanteil hängt am Ligaschnitt, das Stadion am Zustand)
    const E = new Map(L.teams.map(t => [t.id, einnahmen(t, L, aus[t.id] || 0)]));
    if (st) { st.saniert = st.saniert || 0; st.verfall = st.verfall || 0; st.rueckbau = st.rueckbau || 0; }
    const bedarf = [];
    // D128: Median der Einnahmen (Aufholen nur für die kleinere Hälfte)
    const einAlle = L.teams.map(t => E.get(t.id).total).sort((a, b) => a - b), einMedian = (einAlle[(einAlle.length - 1) >> 1] + einAlle[einAlle.length >> 1]) / 2;
    L.teams.forEach(t => {
      if (ohne && ohne.has(t.id)) return;
      if (t.kasse == null) t.kasse = CFG.ki.startKasse * preisIndex(cap);
      const kasseVor = t.kasse, e = E.get(t.id), k = kosten(t, e, cap);
      const ergebnis = e.total - k.total;
      t.kasse += ergebnis;
      let entnahme = 0;
      const deckel = e.total * CFG.ki.kasseMax;
      if (t.kasse > deckel) { entnahme += t.kasse - deckel; t.kasse = deckel; }
      (t.ergebnisse = t.ergebnisse || []).push(Math.round(ergebnis));
      if (t.ergebnisse.length > 10) t.ergebnisse.shift();
      if (rang.has(t.id)) t._erfolg = 1 - (rang.get(t.id) - 1) / Math.max(1, rang.size - 1);
      // Nachzahlung der Untergrenze seit dem letzten Abschluss (phaseAbschluss bucht sie vorher von der Kasse)
      (t._nachz = t._nachz || []).push(t._kasseEnde != null ? Math.max(0, Math.round(t._kasseEnde - kasseVor)) : 0);
      if (t._nachz.length > 4) t._nachz.shift();
      const verloren = verschleissSchritt(t.zustand, art => stufeVon(t, art), (art, s) => { t.anlagen[art] = s; });
      const inv = kiInvest(t, e, cap, st, L, { einMedian });
      const P = CFG.anlagen.profile[t.profil];
      if (P && P.kasseMax != null) {
        const grenze = Math.max(P.kasseMax * e.total, P.reserve * e.total + offeneUntergrenze(t, L));
        if (t.kasse > grenze) { entnahme += t.kasse - grenze; t.kasse = grenze; }
      }
      if (spritzeBedarf(t, e, L)) bedarf.push(t);              // D128: stille Geldspritze nach der Schleife (ligaweit begrenzt)
      t.finanzen = { saison: L.saisonJahr, einnahmen: Math.round(e.total), personal: Math.round(k.personal), betrieb: Math.round(k.betrieb),
        anlagen: Math.round(k.anlagen), trainer: Math.round(k.trainer || 0), ergebnis: Math.round(ergebnis), sanierung: Math.round(inv.sanierung), ausbau: Math.round(inv.ausbau),
        entnahme: Math.round(entnahme), verfall: verloren.length, kasse: Math.round(t.kasse) };
      t._kasseEnde = t.kasse;
      if (st) { st.kasse = st.kasse || []; st.kasse.push(t.kasse); st.saniert += inv.saniert; st.verfall += verloren.length; st.rueckbau += inv.rueckbau; }
    });
    // D128: höchstens proSaison Spritzen je Saison, die knappsten zuerst (Kasse im Verhältnis zu den Einnahmen); wer leer ausgeht,
    // bleibt im Sparmodus gezählt und ist in der nächsten Saison dran
    const S = CFG.wirtschaft && CFG.wirtschaft.spritze, quote = t => t.kasse / Math.max(1, E.get(t.id).total);
    bedarf.sort((a, b) => quote(a) - quote(b)).slice(0, S ? S.proSaison : 0).forEach(t => {
      const b = spritzeGeben(t, E.get(t.id), L, st);
      if (!b) return;
      t.finanzen.spritze = b; t.finanzen.kasse = Math.round(t.kasse); t._kasseEnde = t.kasse;
    });
  }

  // Übersicht für Langzeitläufe und Anzeigen
  function ueberblick(L) {
    return L.teams.map(t => {
      const e = einnahmen(t, L, 0), k = kosten(t, e, L.cap);
      return { id: t.id, plaetze: t.anlagen.stadion, einnahmen: e.total, personal: k.personal, betrieb: k.betrieb, unterhalt: k.anlagen, ergebnis: e.total - k.total,
        kasse: t.kasse, anlagen: Object.assign({}, t.anlagen), zustand: t.zustand ? Object.assign({}, t.zustand) : null, profil: t.profil || null };
    });
  }

  window.DFLFinanzen = { CFG, preisIndex, tv, ticketsHeim, ticketSchnitt, merch, einnahmen, kosten, sparmodus, darfAusgeben,
    investieren, merchLohnt, medizinLohnt, saisonAbschlussKI, ueberblick, stadionStufe, ausbauPreis, ausbauPreise, fanshopStart,
    // D75: laufende Kosten der Anlagen (auch für den eigenen Verein im Spiel, dfl_finanz_patch.js / dfl_anlagen_patch.js)
    ARTEN, anlagenAktiv, betriebAnteil, ausbauPreisJetzt, unterhalt, stadionUnterhalt, anlagenKosten, sanierungVoll, sanierPreis, lebensdauer,
    verschleissJahr, mehrkosten, komfort, anlagenStart, verschleissSchritt, offeneUntergrenze, merchGewinn, kiInvest, stufeVon,
    // D128: KI-Wirtschaft (Aufholen über Anlagen, stille Geldspritze)
    holtAuf, geldspritze, spritzeBedarf, spritzeGeben };
  console.log('%c[DFL-Finanzen v2] aktiv', 'color:#3fb950;font-weight:bold',
    '— ein Finanzmodell für alle 32 Vereine: Cap Hits kosten Geld, TV-Topf 92 % des Caps, Ticketteilung 34 %, Betrieb 20 % + Anlagen mit Unterhalt, Zustand und Sanierung (D75); KI holt über Anlagen auf (D128)');
})();
