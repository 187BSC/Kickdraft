/* ═══════════════════════════════════════════════════════════════════════════
   DFL · LADEN UND MASKOTTCHEN  ·  v1   (D122, D159 e; Nutzer 2026-10-13: „Preise sind super“, „Krone nur beim Titel, aber dafür
   gratis“, „frei neben dem Gelände rumlaufen“; 2026-10-15: „der Laden sollte schon gebaut werden“)
   ─────────────────────────────────────────────────────────────────────────
   Kauf nur mit Winpunkten (DFLErfolge), nie mit Geld. Preise nach D122:
     Maskottchen 8 W (Hund, Katze, Fuchs, Panda, Hase, Pinguin, Löwe, Küken – Tier wechseln kostenlos wie in der Vorschau,
       Ausstattung und Tricks bleiben) · Zubehör 2–3 W (Auswärtstrikot 2, Schal 2, Mütze 2, Sonnenbrille 3; Krone gratis, nur im
       Meisterjahr) · Tricks 3–4 W (Jubeln gratis, Pfote 3, Männchen 3, Rolle 3, Ball spielen 3, Kopfball 4) · Pokalvitrine 5 W
       (zeigt die Titel der Karriere) · Pflanze gratis (einmal je Spielwoche gießen; Siege lassen sie wachsen, der Titel bringt die
       volle Blüte, nach drei Wochen ohne Gießen welkt sie eine Stufe) · Cap +1 Mio € für 2 W (nur die laufende Saison und diese
       Karriere, einmal je Saison, mit dem Werbe-Bonus D56 höchstens +2 Mio; DFLKader.capLimit liest capBonus, die Welt bekommt es
       über eigenSync → salary_cap_limit).
   Gerätweit (D122): Tier, Besitz, Ausstattung in localStorage 'dfl-winpunkte'.laden; je Karriere (CLUB.dflErfolge.laden):
     Pflanze, Cap-Bonus je Saison.
   Maskottchen auf der Wiese rechts neben dem Gelände (dfl_gelaende6.js, Erweiterung v6.extra): läuft frei in vier Richtungen,
     geht in Wochen ohne eigenes Spiel auf den Trainingsplatz und kickt, jubelt in der Woche nach einem Sieg, schläft abends;
     Antippen = gelernter Trick, Pflanze antippen = gießen. Trikot in Vereinsfarben (Auswärtstrikot: Farben getauscht).
   Bilder: Kenney Cube Pets (CC0), gerendert mit spiel/tools/dfl_maskottchen_render.js nach app/maskottchen/ – Ebenen werden im
     Canvas per Compositing eingefärbt (kein getImageData; Verdeckung auf der Insel nur, wenn das Gelände ein Tiefenbild hat).
   API: DFLLaden = { oeffnen, kaufen, anziehen, tierWaehlen, giessen, pflanzeStufe, capBonus, capKaufbar, meisterjahr, trick, zustand,
     geraetLaden, ARTIKEL, FRAMES }
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : globalThis;
  const hatDom = typeof document !== 'undefined' && typeof document.querySelector === 'function' && typeof document.createElement === 'function';
  const EF = () => W.DFLErfolge;
  const dfl = () => typeof CLUB !== 'undefined' && CLUB && CLUB.dfl && CLUB.dfl.aktiv && typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.dfl;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const ic = n => `<i class="ti ti-${n}" aria-hidden="true"></i>`;
  const speichern = () => { if (typeof saveGameState === 'function') { try { saveGameState(); } catch (e) { /* optional */ } } };
  const geld = n => (typeof formatEuro === 'function' ? formatEuro(n) : (n / 1e6).toLocaleString('de-DE') + ' Mio €');

  // ── Artikel ──────────────────────────────────────────────────────────────
  const TIERE = [['dog', 'Hund'], ['cat', 'Katze'], ['fox', 'Fuchs'], ['panda', 'Panda'], ['bunny', 'Hase'], ['penguin', 'Pinguin'], ['lion', 'Löwe'], ['chick', 'Küken']];
  const PREIS_TIER = 8, PREIS_CAP = 2, CAP_PLUS = 1e6, CAP_MAX = 2e6;
  const AUS = [
    { id: 'ausw', name: 'Auswärtstrikot', text: 'Farben getauscht', preis: 2 },
    { id: 'schal', name: 'Schal', text: 'Gestreift in Vereinsfarben', preis: 2 },
    { id: 'muetze', name: 'Mütze', text: 'Mit Bommel', preis: 2, kopf: true },
    { id: 'brille', name: 'Sonnenbrille', text: 'Für Sommer und Siegesserien', preis: 3, kopf: true },
    { id: 'krone', name: 'Krone', text: 'Gratis im Meisterjahr', preis: null, kopf: true }
  ];
  const TRICKS = [
    { id: 'jubel', name: 'Jubeln', text: 'Nach jedem Sieg', preis: 0 },
    // Nutzer 2026-10-22: überflüssiger Text raus: „Antippen und warten“ nur am Handy, am PC (body.pcu-an) leer
    { id: 'pfote', name: 'Pfote geben', get text() { return document.body && document.body.classList.contains('pcu-an') ? '' : 'Antippen und warten'; }, preis: 3 },
    { id: 'sitz', name: 'Männchen', text: 'Setzt sich auf', preis: 3 },
    { id: 'rolle', name: 'Rolle', text: 'Einmal ganz herum', preis: 3 },
    { id: 'ball', name: 'Ball spielen', text: 'Kickt den Ball weg', preis: 3 },
    { id: 'kopfball', name: 'Kopfball', text: 'Hält den Ball hoch', preis: 4 }
  ];
  const ARTIKEL = {};
  AUS.forEach(a => { ARTIKEL[a.id] = Object.assign({ art: 'aus' }, a); });
  TRICKS.forEach(a => { ARTIKEL[a.id] = Object.assign({ art: 'trick' }, a); });
  ARTIKEL.vitrine = { id: 'vitrine', art: 'office', name: 'Pokalvitrine', text: 'Füllt sich mit deinen Titeln', preis: 5 };
  ARTIKEL.cap = { id: 'cap', art: 'vorteil', name: 'Cap +1 Mio €', text: 'Nur diese Saison', preis: PREIS_CAP };
  // Bilder (dfl_maskottchen_render.js): Spalten je Pose, 128 px
  const PX = 128, N = 48;
  const FRAMES = { lauf: 0, jubel: [16, 4], pfote: [20, 5], sitz: [25, 4], rolle: [29, 8], ball: [37, 5], kopfball: [42, 5], schlaf: [47, 1] };
  const RICHT = { px: 0, pz: 1, nx: 2, nz: 3 };
  const ANKER = { tier: [0.5, 0.7471], pflanze: [0.5, 0.783], vitrine: [0.5, 0.7403] };
  const SKAL = { tier: 2.0, pflanze: 1.3, vitrine: 1.4 };
  const PFLANZE_STUFEN = [0, 2, 6, 12, 20];

  // ── Zustand ──────────────────────────────────────────────────────────────
  function geraetLaden() {
    const G = EF() ? EF().geraet() : { laden: {} };
    const l = G.laden || (G.laden = {});
    if (!l.besitz || typeof l.besitz !== 'object') l.besitz = {};
    if (!l.an || typeof l.an !== 'object') l.an = { kopf: '', schal: false, trikot: 'h' };
    if (!l.wahl) l.wahl = 'dog';
    return l;
  }
  function geraetSichern() { if (EF()) EF().geraetSpeichern(); }
  // Änderungen am Laden gleich sichern
  function aendern(fn) { const l = geraetLaden(); fn(l); geraetSichern(); return l; }
  function zustand() {
    const E = EF() && EF().zustand(); if (!E) return null;
    const z = E.laden || (E.laden = {});
    if (!z.cap || typeof z.cap !== 'object') z.cap = {};
    if (!z.pflanze || typeof z.pflanze !== 'object') z.pflanze = { punkte: 0, gegossen: null, ohne: 0 };
    return z;
  }
  const wochenKey = () => (LEAGUE.season || 0) * 100 + (LEAGUE.week || 0);
  const istIch = id => { if (id === 'fcm') return true; try { return !!(id && W.DFLSpiel && DFLSpiel.dflIdVon && DFLSpiel.dflIdVon(id) === DFLSpiel.dflIdVon('fcm')); } catch (e) { return false; } };
  function meisterjahr() {
    if (!dfl()) return false;
    const P = LEAGUE.dflPlayoffs, po = LEAGUE.dflPO;
    return !!((po && istIch(po.meister)) || (P && P.saison === LEAGUE.season - 1 && istIch(P.meister) && !(po && po.meister && !istIch(po.meister))));
  }
  const titel = () => { try { return W.DFLPlayoffs && DFLPlayoffs.titel ? DFLPlayoffs.titel('fcm') : 0; } catch (e) { return 0; } };
  function farben() {
    let f = null; try { f = W.DFLSpiel ? DFLSpiel.franchise('fcm') : null; } catch (e) { f = null; }
    return { a: (f && f.farben && f.farben[0]) || '#2f8f4e', b: (f && f.farben && f.farben[1]) || '#ffffff' };
  }
  const hell = f => { const n = parseInt(String(f).slice(1), 16); return (0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) / 255; };

  // ── Pflanze ──────────────────────────────────────────────────────────────
  function pflanzeStufe() {
    const z = zustand(); if (!z) return 0;
    if (meisterjahr()) return 4;
    return PFLANZE_STUFEN.filter(x => z.pflanze.punkte >= x).length - 1;
  }
  const giessbar = () => { const z = zustand(); return !!(z && dfl() && z.pflanze.gegossen !== wochenKey()); };
  function giessen() {
    const z = zustand(); if (!z || !giessbar()) return false;
    const vor = pflanzeStufe();
    z.pflanze.punkte += 1; z.pflanze.gegossen = wochenKey(); z.pflanze.ohne = 0;
    blase(pflanzeStufe() > vor ? 'Die Pflanze wächst' : 'Gegossen', 'pflanze');
    if (pflanzeStufe() >= 4 && EF()) EF().erreiche('gruen');
    speichern();
    return true;
  }
  // je Woche: drei Wochen ohne Gießen → eine Stufe zurück (nie unter den Keimling, wenn sie schon einer war)
  function pflanzeWoche() {
    const z = zustand(); if (!z || !dfl()) return;
    const p = z.pflanze, k = wochenKey();
    if (p.letzte === k) return; p.letzte = k;
    if (p.gegossen === k) return;
    p.ohne = (p.ohne || 0) + 1;
    if (p.ohne >= 3) { p.ohne = 0; const s = PFLANZE_STUFEN.filter(x => p.punkte >= x).length - 1; if (s >= 2) p.punkte = PFLANZE_STUFEN[s - 1]; }
  }

  // ── Cap +1 Mio ───────────────────────────────────────────────────────────
  function capBonus() { const z = dfl() && zustand(); return z ? (z.cap[LEAGUE.season] || 0) : 0; }
  function capKaufbar() {
    if (!dfl()) return { ok: false, grund: 'Kein Spiel geladen' };
    if (capBonus() > 0) return { ok: false, grund: 'Diese Saison schon gekauft' };
    const werbung = W.DFLKader && DFLKader.werbeBonus ? DFLKader.werbeBonus() : 0;
    if (werbung + CAP_PLUS > CAP_MAX) return { ok: false, grund: 'Höchstens +2 Mio je Saison' };
    if (EF().konto() < PREIS_CAP) return { ok: false, grund: 'Zu wenige Winpunkte' };
    return { ok: true };
  }

  // ── Kaufen und Anziehen ──────────────────────────────────────────────────
  function kaufen(id, wahl) {
    if (!EF()) return { ok: false, grund: 'Erfolge fehlen' };
    const l = geraetLaden();
    if (id === 'tier') {
      if (l.tier) return { ok: false, grund: 'Schon da' };
      const t = wahl || l.wahl; if (!TIERE.some(x => x[0] === t)) return { ok: false, grund: 'Unbekanntes Tier' };
      if (!EF().ausgeben(PREIS_TIER, 'Maskottchen')) return { ok: false, grund: 'Zu wenige Winpunkte' };
      aendern(x => { x.tier = t; x.wahl = t; });
      bilderNeu(); setTimeout(() => trick('jubel'), 300);
      return { ok: true };
    }
    if (id === 'cap') {
      const k = capKaufbar(); if (!k.ok) return k;
      if (!EF().ausgeben(PREIS_CAP, 'Cap +1 Mio')) return { ok: false, grund: 'Zu wenige Winpunkte' };
      zustand().cap[LEAGUE.season] = CAP_PLUS;
      try { if (W.DFLKader && DFLKader.capSetzen) DFLKader.capSetzen(); if (W.DFLSpiel) { DFLSpiel.eigenSync(); if (DFLSpiel.weltGeaendert) DFLSpiel.weltGeaendert(); } } catch (e) { console.warn('[DFL-Laden] Cap', e); }
      try { if (typeof addNews === 'function') addNews('club', 'Cap +1 Mio für diese Saison', 'Neues Limit: ' + geld(DFLKader.capLimit()) + '.'); } catch (e) { /* optional */ }
      speichern();
      return { ok: true };
    }
    const a = ARTIKEL[id]; if (!a || a.preis == null) return { ok: false, grund: 'Nicht zu kaufen' };
    if (l.besitz[id] || a.preis === 0) return { ok: false, grund: 'Schon da' };
    if (!EF().ausgeben(a.preis, a.name)) return { ok: false, grund: 'Zu wenige Winpunkte' };
    aendern(x => { x.besitz[id] = true; });
    if (a.art === 'aus') anziehen(id, true);
    if (a.art === 'trick') setTimeout(() => trick(id), 200);
    return { ok: true };
  }
  const hat = id => { const a = ARTIKEL[id]; return !!(a && (a.preis === 0 || geraetLaden().besitz[id])); };
  // anziehen(id, an): Kopf (Mütze, Brille, Krone) schließt sich gegenseitig aus
  function anziehen(id, an) {
    const a = ARTIKEL[id]; if (!a || a.art !== 'aus') return false;
    if (id === 'krone' ? !meisterjahr() : !hat(id)) return false;
    aendern(l => {
      if (a.kopf) l.an.kopf = (an === false || (an == null && l.an.kopf === id)) ? '' : id;
      if (id === 'schal') l.an.schal = an == null ? !l.an.schal : !!an;
      if (id === 'ausw') l.an.trikot = (an === false || (an == null && l.an.trikot === 'a')) ? 'h' : 'a';
    });
    bilderNeu();
    return true;
  }
  function tierWaehlen(t) {
    if (!TIERE.some(x => x[0] === t)) return false;
    aendern(l => { if (l.tier) l.tier = t; l.wahl = t; });
    bilderNeu();
    return true;
  }
  const traegt = id => { const l = geraetLaden(); return id === 'schal' ? !!l.an.schal : id === 'ausw' ? l.an.trikot === 'a' : l.an.kopf === id && (id !== 'krone' || meisterjahr()); };

  // ── Bilder zusammensetzen (Compositing, kein getImageData) ───────────────
  const BILD = new Map();
  function bild(n) {
    const src = 'app/maskottchen/' + n + '.webp';
    if (!BILD.has(src)) BILD.set(src, new Promise(ok => { const i = new Image(); i.decoding = 'async'; i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; }));
    return BILD.get(src);
  }
  const leinwand = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  // Ebene (Zeile z eines Bildes) ab Spalte f0, n Spalten, eingefärbt (multiply) oder roh
  function ebene(ziel, img, z, f0, n, farbe) {
    if (!img) return;
    const o = ziel.getContext('2d');
    if (!farbe) { o.drawImage(img, f0 * PX, z * PX, n * PX, PX, 0, 0, n * PX, PX); return; }
    const t = leinwand(n * PX, PX), q = t.getContext('2d');
    q.drawImage(img, f0 * PX, z * PX, n * PX, PX, 0, 0, n * PX, PX);
    q.globalCompositeOperation = 'multiply'; q.fillStyle = farbe; q.fillRect(0, 0, t.width, t.height);
    q.globalCompositeOperation = 'destination-in'; q.drawImage(img, f0 * PX, z * PX, n * PX, PX, 0, 0, n * PX, PX);
    o.drawImage(t, 0, 0);
  }
  function outfit(over) {
    const l = geraetLaden(), o = Object.assign({ tier: l.tier || l.wahl, kopf: l.an.kopf, schal: !!l.an.schal, trikot: l.an.trikot || 'h' }, over || {});
    if (o.kopf === 'krone' && !meisterjahr() && !(over && over.kopf === 'krone')) o.kopf = '';
    return o;
  }
  const outfitKey = o => [o.tier, o.kopf, o.schal ? 1 : 0, o.trikot, farben().a, farben().b].join('|');
  async function zusammen(o, f0, n) {
    const F = farben(), A = o.trikot === 'a' ? F.b : F.a, B = o.trikot === 'a' ? F.a : F.b;
    const [g, tr, sc, kp] = await Promise.all([bild(o.tier + '-grund'), bild(o.tier + '-trikot'), o.schal ? bild(o.tier + '-schal') : null, o.kopf ? bild(o.tier + '-' + o.kopf) : null]);
    if (!g) return null;
    const c = leinwand(n * PX, PX);
    ebene(c, g, 0, f0, n); ebene(c, tr, 0, f0, n, A); ebene(c, tr, 1, f0, n, B);
    if (sc) { ebene(c, sc, 0, f0, n, F.a); ebene(c, sc, 1, f0, n, F.b); }
    if (kp) { if (o.kopf === 'muetze') { ebene(c, kp, 0, f0, n, F.a); ebene(c, kp, 1, f0, n, F.b); } else ebene(c, kp, 0, f0, n); }
    return c;
  }
  let ATLAS = { key: '', c: null, laedt: null };
  function bilderNeu() { ATLAS.key = ''; ATLAS.c = null; ATLAS.laedt = null; DEKO.key = ''; }
  function atlas() {
    const l = geraetLaden(); if (!l.tier || !hatDom) return null;
    const o = outfit(), k = outfitKey(o);
    if (ATLAS.key === k && ATLAS.c) return ATLAS.c;
    if (ATLAS.laedt !== k) { ATLAS.laedt = k; zusammen(o, 0, N).then(c => { if (ATLAS.laedt === k && c) { ATLAS.c = c; ATLAS.key = k; } }); }
    return ATLAS.key === k ? ATLAS.c : ATLAS.c;   // bis zum neuen Bild das alte
  }
  // Pflanze (Blüte in Vereinsfarbe) und Vitrine
  const DEKO = { key: '', pflanze: null, vitrine: null };
  function deko() {
    const F = farben(), k = F.a + F.b;
    if (DEKO.key !== k && !DEKO.laedt) {
      DEKO.laedt = true;
      Promise.all([bild('pflanze'), bild('vitrine')]).then(([p, v]) => {
        const c = leinwand(5 * PX, PX);
        if (p) { ebene(c, p, 0, 0, 5); ebene(c, p, 1, 0, 5, hell(F.a) > 0.85 ? F.b : F.a); }
        DEKO.pflanze = c; DEKO.vitrine = v; DEKO.key = k; DEKO.laedt = false;
      });
    }
    return DEKO;
  }

  // ── Maskottchen auf dem Gelände ──────────────────────────────────────────
  // Wiese rechts neben der Insel (Insel x −14,5…12,5, z −11,2…7,1): Rasen x 12,5…16,5, z −3…4 (Gehweg und Straße bleiben frei)
  const WIESE = { x0: 12.5, x1: 16.5, z0: -3, z1: 4 };
  const ORT = { pflanze: [12.85, 3.8], vitrine: [12.8, 2.2] };
  // Laufbereich im Bild des Office-Kopfs (rechts unten liegt der Knopf „Vergrößern“, links vorn Pflanze und Vitrine): 11,8 ≤ x − z ≤ 15,5, x + z ≤ 16,8
  const aufWiese = (x, z) => x >= 13.6 && x <= 15.3 && z >= -0.6 && z <= 2.6 && x + z <= 16.8 && x - z <= 15.5 && x - z >= 11.8;
  const M = { x: 14.2, z: 0.6, dir: 'pz', ziel: null, weg: [], warte: 1.5, modus: 'frei', schritt: 0, uhr: 0, trick: null, nachher: null, naechstes: 12, blase: null };
  const R = Math.random;
  function richtung(dx, dz) { return Math.abs(dx) >= Math.abs(dz) ? (dx >= 0 ? 'px' : 'nx') : (dz >= 0 ? 'pz' : 'nz'); }
  function neuesZiel() {
    for (let v = 0; v < 20; v++) { const x = 13.6 + R() * 1.7, z = -0.6 + R() * 3.2; if (aufWiese(x, z) && Math.hypot(x - M.x, z - M.z) > 0.6) return { x, z }; }
    return { x: 14.2, z: 0.6 };
  }
  function lage() { const Z = W.DFLGelaende && DFLGelaende.v6 && DFLGelaende.v6.zustand && DFLGelaende.v6.zustand(); return Z && Z.lage ? Z.lage : {}; }
  const nacht = () => !!lage().abend;
  function nachSieg() {
    try { const md = LEAGUE.matchday || 0; if (!md || LEAGUE.week - LEAGUE.matchWeeks[md - 1] > 1) return false;
      const t = LEAGUE.tiers.bundesliga.groups[0].teams.find(x => x.id === 'fcm'); const f = (t && t.form) || []; return f[f.length - 1] === 'W'; } catch (e) { return false; }
  }
  const trainingsWoche = () => { try { return !(LEAGUE.matchWeeks || []).includes(LEAGUE.week) && !LEAGUE.dflPO; } catch (e) { return false; } };
  function trainingsPlatz() {
    const Z = W.DFLGelaende.v6.zustand(), P = W.DFL_GELAENDE6 && DFL_GELAENDE6.projektion, q = Z && Z.daten && Z.daten.ziele && Z.daten.ziele.training;
    if (!q || !P) return null;
    const a = (q.anker.x - P.o[0]) / P.ex[0], b = (q.anker.y - P.o[1]) / P.ex[1];      // a = x − z, b = x + z
    return { x: (a + b) / 2 + 1.2, z: (b - a) / 2 };
  }
  // immer: Ball im Training und Jubel nach Siegen gehören zum Verhalten, nicht zu den gekauften Tricks
  function trick(id, danach, immer) {
    const l = geraetLaden(); if (!l.tier || !FRAMES[id]) return false;
    if (!immer && !hat(id)) return false;
    M.modus = 'trick'; M.ziel = null; M.dir = 'pz';
    const t = ARTIKEL[id]; blase(t ? t.name : '', 'tier');
    M.trick = { id, i: 0, uhr: 0, runde: 0, danach };
    return true;
  }
  function training() {
    const t = trainingsPlatz(); if (!t) return;
    blase('Ab zum Training', 'tier');
    M.modus = 'frei'; M.ziel = null; M.warte = 0;
    M.weg = [{ x: 13.6, z: Math.max(-0.6, Math.min(2.6, t.z)) }, { x: t.x, z: t.z }];
    M.nachher = () => trick('ball', () => { M.weg = [{ x: 13.6, z: Math.max(-0.6, Math.min(2.6, t.z)) }, neuesZiel()]; M.warte = 0.5; }, true);
  }
  function blase(text, wo) { if (text) M.blase = { text, wo, t: 1.8 }; }
  function sim(dt) {
    const l = geraetLaden();
    if (M.blase) { M.blase.t -= dt; if (M.blase.t <= 0) M.blase = null; }
    if (!l.tier) return;
    if (nacht()) { M.modus = 'schlaf'; M.ziel = null; M.weg = []; return; }
    if (M.modus === 'schlaf') M.modus = 'frei';
    if (M.modus === 'trick' && M.trick) {
      const [, n] = FRAMES[M.trick.id] || [0, 1];
      M.trick.uhr += dt; if (M.trick.uhr > 0.15) { M.trick.uhr = 0; M.trick.i++; if (M.trick.i >= n) { M.trick.i = 0; M.trick.runde++; } }
      if (M.trick.runde >= (M.trick.id === 'rolle' ? 1 : 2)) { const f = M.trick.danach; M.trick = null; M.modus = 'frei'; M.warte = 1; if (f) f(); }
      return;
    }
    // Anlässe: Training in Wochen ohne eigenes Spiel, Jubel in der Woche nach einem Sieg
    M.naechstes -= dt;
    if (M.naechstes <= 0 && !M.weg.length && !M.ziel && aufWiese(M.x, M.z)) {
      M.naechstes = 22 + R() * 14;
      if (nachSieg()) { trick('jubel'); return; }
      if (trainingsWoche()) training();
    }
    if (!M.ziel) { M.warte -= dt; if (M.warte <= 0) { M.ziel = M.weg.length ? M.weg.shift() : neuesZiel(); } }
    if (M.ziel) {
      const dx = M.ziel.x - M.x, dz = M.ziel.z - M.z, d = Math.hypot(dx, dz), v = 0.8;
      M.dir = richtung(dx, dz);
      if (d < v * dt) {
        M.x = M.ziel.x; M.z = M.ziel.z; M.ziel = null;
        if (M.weg.length) M.warte = 0.05;
        else { M.warte = 1 + R() * 3; if (M.nachher) { const f = M.nachher; M.nachher = null; f(); } }
      } else { M.x += dx / d * v * dt; M.z += dz / d * v * dt; }
      M.phase = (M.phase || 0) + dt * Math.PI * 2 / 0.4; M.uhr += dt; if (M.uhr > 0.1) { M.uhr = 0; M.schritt++; }
    }
  }
  // Wippen im Schritt: weiche Sinuskurve über die Laufbewegung (Bildpunkte), im Stand ruhig
  function wippen() { return M.ziel && M.modus === 'frei' ? Math.abs(Math.sin(M.phase || 0)) * 3.2 : 0; }
  function frameJetzt() {
    if (M.modus === 'schlaf') return FRAMES.schlaf[0];
    if (M.modus === 'trick' && M.trick) return FRAMES[M.trick.id][0] + M.trick.i;
    return RICHT[M.dir] * 4 + (M.ziel ? M.schritt % 4 : 1);
  }
  // Zeichnen: Bild an Weltpunkt (Fußpunkt = Anker), auf der Insel über das Tiefenbild verdeckt
  const hilf = hatDom ? leinwand(64, 64) : null;
  // Nutzer 2026-10-17 („Animation smoother, nicht in 3 fps“): das Tier mit Unterpixel-Lage und Wippen im Schritt (dy);
  // Pixel nur zurücklesen, wenn im Tiefenbild etwas davor liegt
  function malenAn(g, tf, img, sx, x, z, art, hoehe, dy) {
    const v6 = W.DFLGelaende.v6, [wx, wy] = v6.welt(x, z), s = SKAL[art], [ax, ay] = ANKER[art];
    const fein = art === 'tier';
    const q = img.ksQ || PX, sq = img.ksQ ? 0 : sx * PX;    // Vitrine aus KSVitrine: ein Bild in eigener Größe
    const w = Math.round(PX * s), h = Math.round(PX * s), x0 = fein ? wx - ax * w : Math.round(wx - ax * w), y0 = (fein ? wy - ay * h : Math.round(wy - ay * h)) - (dy || 0);
    const verdeckt = tf && x < WIESE.x0 + 0.1 && (!W.DFLGelaendeVerdeckt || W.DFLGelaendeVerdeckt(tf, x0, y0, w, h, v6.KO.c0 + v6.KO.cx * x + v6.KO.cy * hoehe + v6.KO.cz * z - 0.5 * v6.PRO_EINHEIT));
    if (!verdeckt) { g.drawImage(img, sq, 0, q, q, x0, y0, w, h); return { x0, y0, w, h }; }
    if (W.DFLGelaendeVerdecktMalen && W.DFLGelaendeVerdecktMalen(g, img, sq, 0, q, q, x0, y0, w, h, tf, v6.KO.c0 + v6.KO.cx * x + v6.KO.cy * hoehe + v6.KO.cz * z - 0.5 * v6.PRO_EINHEIT)) return { x0, y0, w, h };
    if (hilf.width < w) hilf.width = w; if (hilf.height < h) hilf.height = h;
    const o = hilf.getContext('2d', { willReadFrequently: true }); o.clearRect(0, 0, w, h); o.drawImage(img, sq, 0, q, q, 0, 0, w, h);
    try {
      const id = o.getImageData(0, 0, w, h), p = id.data, KO = v6.KO, meine = KO.c0 + KO.cx * x + KO.cy * hoehe + KO.cz * z - 0.5 * v6.PRO_EINHEIT;
      for (let j = 0; j < h; j++) { const sy = Math.floor((y0 + j) / tf.f); if (sy < 0 || sy >= tf.h) continue;
        for (let i = 0; i < w; i++) { const k = (j * w + i) * 4; if (!p[k + 3]) continue; const sxx = Math.floor((x0 + i) / tf.f); if (sxx < 0 || sxx >= tf.w) continue;
          if (tf.t[sy * tf.w + sxx] < meine) p[k + 3] = 0; } }
      o.putImageData(id, 0, 0);
    } catch (e) { /* Pixel gesperrt: ohne Verdeckung */ }
    g.drawImage(hilf, 0, 0, w, h, x0, y0, w, h);
    return { x0, y0, w, h };
  }
  let RECHTECK = { tier: null, pflanze: null, vitrine: null };
  function blaseMalen(g, r) {
    if (!M.blase || !r) return;
    g.save(); g.font = '600 46px Fredoka, Rubik, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const tw = g.measureText(M.blase.text).width + 44, cx = r.x0 + r.w / 2, cy = r.y0 + r.h * 0.1;
    g.globalAlpha = Math.min(1, M.blase.t * 3);
    g.fillStyle = '#fffaf0'; g.strokeStyle = '#2b2622'; g.lineWidth = 5;
    const x = cx - tw / 2, y = cy - 38, hh = 76, rr = 24;
    g.beginPath(); g.moveTo(x + rr, y); g.arcTo(x + tw, y, x + tw, y + hh, rr); g.arcTo(x + tw, y + hh, x, y + hh, rr); g.arcTo(x, y + hh, x, y, rr); g.arcTo(x, y, x + tw, y, rr); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#2b2622'; g.fillText(M.blase.text, cx, cy + 1); g.restore();
  }
  const EXT = {
    boden(g, Z) {
      if (!dfl()) return;
      const v6 = W.DFLGelaende.v6, P = (x, z, y) => v6.welt(x, z, y), { x0, x1, z0, z1 } = WIESE, T = -0.6;
      const K = W.DFLKulisse, ton = K && Z && Z.lage && K.gelaendeTon ? K.gelaendeTon(Z.lage.zeit) : null;
      const poly = (pts, farbe) => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fillStyle = farbe; g.fill(); };
      poly([P(x1, z0, 0), P(x1, z1, 0), P(x1, z1, T), P(x1, z0, T)], '#6d5232');
      poly([P(x0, z1, 0), P(x1, z1, 0), P(x1, z1, T), P(x0, z1, T)], '#5d452d');
      poly([P(x0, z0, 0), P(x1, z0, 0), P(x1, z1, 0), P(x0, z1, 0)], '#7fc75b');
      if (ton && ton.farbe) { g.save(); g.globalAlpha = ton.staerke; poly([P(x0, z0, 0), P(x1, z0, 0), P(x1, z1, 0), P(x0, z1, 0)], ton.farbe); g.restore(); }
      g.save(); g.globalAlpha = 0.35; g.fillStyle = '#5ea844';
      [[13.1, -0.4], [14.2, 1.7], [15.4, -1.3], [15.1, 2.4], [13.9, 3.3], [16.0, 0.4]].forEach(([x, z]) => { const [a, b] = P(x, z, 0); g.beginPath(); g.ellipse(a, b, 9, 4.5, 0, 0, 7); g.fill(); });
      g.restore();
    },
    sim(dt) { if (dfl()) sim(dt); },
    figuren() {
      if (!dfl() || !hatDom) return [];
      const l = geraetLaden(), D = deko(), out = [];
      if (D.pflanze) out.push({ x: ORT.pflanze[0], z: ORT.pflanze[1], malen: (g, tf) => { RECHTECK.pflanze = malenAn(g, tf, D.pflanze, pflanzeStufe(), ORT.pflanze[0], ORT.pflanze[1], 'pflanze', 0.5); if (M.blase && M.blase.wo === 'pflanze') blaseMalen(g, RECHTECK.pflanze); } });
      if (D.vitrine && l.besitz.vitrine) out.push({ x: ORT.vitrine[0], z: ORT.vitrine[1], malen: (g, tf) => {
        const vb = W.KSVitrine && KSVitrine.officeBild();       // die drei wichtigsten Pokale (kickstil_vitrine.js)
        RECHTECK.vitrine = malenAn(g, tf, vb || D.vitrine, vb ? 0 : Math.min(3, titel()), ORT.vitrine[0], ORT.vitrine[1], 'vitrine', 0.6); } });
      const a = l.tier && atlas();
      if (a) out.push({ x: M.x, z: M.z, malen: (g, tf) => {
        RECHTECK.tier = malenAn(g, tf, a, frameJetzt(), M.x, M.z, 'tier', 0.35, wippen());
        if (M.modus === 'schlaf') { const r = RECHTECK.tier; g.save(); g.font = '700 44px Fredoka, sans-serif'; g.fillStyle = '#ffffff'; g.strokeStyle = '#0d1a3a'; g.lineWidth = 7;
          const ph = (performance.now() / 2400) % 1; g.globalAlpha = 1 - ph; g.strokeText('Z z z', r.x0 + r.w * 0.72, r.y0 + r.h * 0.4 - ph * 36); g.fillText('Z z z', r.x0 + r.w * 0.72, r.y0 + r.h * 0.4 - ph * 36); g.restore(); }
        if (M.blase && M.blase.wo === 'tier') blaseMalen(g, RECHTECK.tier);
      } });
      return out;
    },
    tippen(px, py) {
      if (!dfl()) return false;
      const drin = r => r && px >= r.x0 + r.w * 0.2 && px <= r.x0 + r.w * 0.8 && py >= r.y0 + r.h * 0.25 && py <= r.y0 + r.h * 0.85;
      if (geraetLaden().tier && drin(RECHTECK.tier)) {
        if (M.modus === 'schlaf') { blase('Z z z', 'tier'); return true; }
        const k = TRICKS.filter(t => hat(t.id)); trick(k[Math.floor(R() * k.length)].id); return true;
      }
      if (W.KSVitrine && geraetLaden().besitz.vitrine && drin(RECHTECK.vitrine)) { KSVitrine.oeffnen(); return true; }
      if (drin(RECHTECK.pflanze)) { if (!giessen()) blase('Diese Woche schon gegossen', 'pflanze'); return true; }
      return false;
    }
  };

  // ── Laden (Blatt) ────────────────────────────────────────────────────────
  // Vorschaubilder als Canvas (unter file:// sind Bilder im Canvas gesperrt für toDataURL)
  function bildPlatz(art, wert, extra) { return `<canvas class="ld-bild" width="${PX}" height="${PX}" data-ld-bild="${art}" data-ld-wert="${esc(wert)}"${extra || ''} aria-hidden="true"></canvas>`; }
  async function bilderFuellen(box) {
    const l = geraetLaden(), tier = l.tier || l.wahl;
    const cs = [...box.querySelectorAll('canvas[data-ld-bild]')];
    for (const c of cs) {
      const art = c.dataset.ldBild, w = c.dataset.ldWert; let quelle = null, f = 0;
      if (art === 'tier') { quelle = await zusammen(outfit({ tier: w }), RICHT.pz * 4 + 1, 1); }
      else if (art === 'aus') { const o = outfit({ tier }); if (w === 'ausw') o.trikot = 'a'; else if (w === 'schal') o.schal = true; else o.kopf = w; quelle = await zusammen(o, RICHT.pz * 4 + 1, 1); }
      else if (art === 'trick') { const [f0] = FRAMES[w]; quelle = await zusammen(outfit({ tier }), f0 + (w === 'kopfball' ? 2 : w === 'rolle' ? 2 : 1), 1); }
      else if (art === 'pflanze') { const D = deko(); await bild('pflanze'); await new Promise(r => setTimeout(r, 30)); quelle = D.pflanze; f = +w; }
      else if (art === 'vitrine') { quelle = (W.KSVitrine && await KSVitrine.officeBildWarten()) || await bild('vitrine'); f = +w; }
      if (!quelle || !c.isConnected) continue;
      const o = c.getContext('2d'), q = quelle.ksQ || PX; o.clearRect(0, 0, PX, PX); o.drawImage(quelle, quelle.ksQ ? 0 : f * PX, 0, q, q, 0, 0, PX, PX);
    }
  }
  function knopf(text, data, aus, haupt) { return `<button type="button" class="app-knopf ld-knopf${haupt ? ' haupt' : ''}" ${data}${aus ? ' disabled' : ''}>${text}</button>`; }
  function ladenHtml() {
    const l = geraetLaden(), k = EF().konto(), M8 = EF().muenze, tierName = (TIERE.find(t => t[0] === (l.tier || l.wahl)) || TIERE[0])[1];
    const ware = (a, inhalt, knopfHtml, cls) => `<div class="ld-ware${cls ? ' ' + cls : ''}">${inhalt}<b>${esc(a.name)}</b><small>${esc(a.text)}</small>${knopfHtml}</div>`;
    const preis = p => `${ic('lock-open')}${p} W`;
    const ausKnopf = a => {
      if (a.id === 'krone') return meisterjahr() ? knopf(traegt('krone') ? 'Absetzen' : 'Aufsetzen', `data-ld-an="krone"`, !l.tier, true) : knopf('Nur im Meisterjahr', '', true);
      if (!hat(a.id)) return knopf(preis(a.preis), `data-ld-kauf="${a.id}"`, k < a.preis);
      return knopf(traegt(a.id) ? 'Ausziehen' : 'Anziehen', `data-ld-an="${a.id}"`, !l.tier);
    };
    const trickKnopf = a => (hat(a.id) ? knopf('Vorführen', `data-ld-trick="${a.id}"`, !l.tier) : knopf(preis(a.preis), `data-ld-kauf="${a.id}"`, k < a.preis));
    const z = zustand(), st = pflanzeStufe(), capK = capKaufbar(), capAn = capBonus() > 0;
    const naechste = PFLANZE_STUFEN[st + 1];
    return `<div class="ld-blatt">
      <div class="ef-kopf"><div><div class="app-sheet-titel">Laden</div><small>Nur mit Winpunkten</small></div>${M8(k)}</div>
      <h3 class="ef-h3">${ic('paw')} Maskottchen</h3>
      <div class="ld-tiere" role="group" aria-label="Tier wählen">${TIERE.map(([id, name]) => `<button type="button" class="ld-tier${(l.tier || l.wahl) === id ? ' an' : ''}" data-ld-tier="${id}" aria-pressed="${(l.tier || l.wahl) === id}" aria-label="${name}">${bildPlatz('tier', id)}<span>${name}</span></button>`).join('')}</div>
      <div class="app-blatt-aktionen">${l.tier ? knopf(`${ic('check')}${esc(tierName)} läuft übers Gelände`, '', true) : knopf(`${esc(tierName)} holen · ${PREIS_TIER} W`, 'data-ld-kauf="tier"', k < PREIS_TIER, true)}</div>
      <h3 class="ef-h3">${ic('shirt-sport')} Ausstattung</h3>
      <div class="ld-gitter">${AUS.map(a => ware(a, bildPlatz('aus', a.id), ausKnopf(a), traegt(a.id) ? 'traegt' : '')).join('')}</div>
      <h3 class="ef-h3">${ic('ball-football')} Tricks</h3>
      <div class="ld-gitter">${TRICKS.map(a => ware(a, bildPlatz('trick', a.id), trickKnopf(a), hat(a.id) ? 'hat' : '')).join('')}</div>
      <h3 class="ef-h3">${ic('building-store')} Fürs Office</h3>
      <div class="ld-gitter">
        ${ware(ARTIKEL.vitrine, bildPlatz('vitrine', String(Math.min(3, titel()))), hat('vitrine') ? knopf(`${ic('trophy')}Ansehen`, 'data-ld-vitrine', !W.KSVitrine) : knopf(preis(5), 'data-ld-kauf="vitrine"', k < 5), hat('vitrine') ? 'hat' : '')}
        ${ware({ name: 'Pflanze', text: naechste != null && !meisterjahr() ? `Stufe ${st + 1} von 5` : 'Volle Blüte' }, bildPlatz('pflanze', String(st)), knopf(giessbar() ? `${ic('droplet')}Gießen` : 'Diese Woche gegossen', 'data-ld-giessen', !giessbar(), giessbar()), 'hat')}
      </div>
      <h3 class="ef-h3">${ic('coin-euro')} Vorteil</h3>
      <div class="ld-cap${capAn ? ' an' : ''}"><span class="ld-cap-plus" aria-hidden="true">+1</span><span><b>Cap +1 Mio € · ${esc(seasonText())}</b><small>${capAn ? 'Limit ' + geld(W.DFLKader ? DFLKader.capLimit() : 0) : 'Nur diese Saison, nur diese Karriere'}</small></span>
        ${capAn ? knopf(`${ic('check')}Aktiv`, '', true) : knopf(preis(PREIS_CAP), 'data-ld-kauf="cap"', !capK.ok)}</div>
      ${!capAn && !capK.ok && capK.grund !== 'Zu wenige Winpunkte' ? `<p class="ld-klein">${esc(capK.grund)}</p>` : ''}
      <div class="app-blatt-aktionen"><button type="button" class="app-knopf" data-ld-erfolge>${ic('medal')}Erfolge</button></div>
    </div>`;
  }
  const seasonText = () => { try { return typeof seasonYearLabel === 'function' ? seasonYearLabel(LEAGUE.season) : 'Saison ' + LEAGUE.season; } catch (e) { return ''; } };
  function oeffnen() {
    if (!EF() || !hatDom || !dfl()) return null;
    const alt = document.querySelector('#app-blatt.auf .ld-blatt, .ef-ov .ld-blatt'), oben = alt ? alt.closest('.app-blatt-box, .ef-ov-box').scrollTop : 0;
    const box = EF().blatt(ladenHtml(), (ev, b) => {
      const t = ev.target.closest('[data-ld-kauf], [data-ld-an], [data-ld-trick], [data-ld-tier], [data-ld-giessen], [data-ld-erfolge], [data-ld-vitrine]');
      if (!t || t.disabled) return;
      if (t.hasAttribute('data-ld-erfolge')) { EF().uebersicht(); return; }
      if (t.hasAttribute('data-ld-vitrine')) { if (EF().zu) EF().zu(); KSVitrine.oeffnen(); return; }
      if (t.dataset.ldKauf) { const r = kaufen(t.dataset.ldKauf); if (!r.ok && typeof showToast === 'function') showToast(r.grund, 'warning'); }
      else if (t.dataset.ldAn) anziehen(t.dataset.ldAn);
      else if (t.dataset.ldTier) tierWaehlen(t.dataset.ldTier);
      else if (t.dataset.ldTrick) { trick(t.dataset.ldTrick); vorfuehren(b, t.dataset.ldTrick); return; }
      else if (t.hasAttribute('data-ld-giessen')) giessen();
      oeffnen();
    });
    if (box) { box.scrollTop = oben; bilderFuellen(box); }
    return box;
  }
  // Trick im Laden: Vorschaubild spielt die Bilder ab
  async function vorfuehren(box, id) {
    const c = box.querySelector(`canvas[data-ld-bild="trick"][data-ld-wert="${id}"]`); if (!c) return;
    const [f0, n] = FRAMES[id], streifen = await zusammen(outfit(), f0, n); if (!streifen) return;
    const o = c.getContext('2d'); let i = 0;
    const t = setInterval(() => { if (!c.isConnected || i >= n * 2) { clearInterval(t); return; } o.clearRect(0, 0, PX, PX); o.drawImage(streifen, (i % n) * PX, 0, PX, PX, 0, 0, PX, PX); i++; }, 150);
  }

  // ── Einhängen ────────────────────────────────────────────────────────────
  {
    const _orig = W.advanceCalendarWeek;
    if (typeof _orig === 'function') W.advanceCalendarWeek = function () { const r = _orig.apply(this, arguments); try { pflanzeWoche(); } catch (e) { /* optional */ } return r; };
  }
  {
    const _orig = W.recordResult;
    if (typeof _orig === 'function') {
      W.recordResult = function (teams, h, a, gh, ga) {
        const r = _orig.apply(this, arguments);
        try { if (dfl() && ((h === 'fcm' && gh > ga) || (a === 'fcm' && ga > gh))) { const z = zustand(); if (z) z.pflanze.punkte += 1; } } catch (e) { /* optional */ }
        return r;
      };
      try { recordResult = W.recordResult; } catch (e) { /* window reicht */ }
    }
  }
  if (W.DFLGelaende && DFLGelaende.v6 && DFLGelaende.v6.extra) DFLGelaende.v6.extra(EXT);

  W.DFLLaden = { oeffnen, kaufen, anziehen, tierWaehlen, giessen, giessbar, pflanzeStufe, pflanzeWoche, capBonus, capKaufbar, meisterjahr, trick, zustand, geraetLaden,
    ARTIKEL, FRAMES, TIERE, PREIS_TIER, hat, traegt, maskottchen: () => M, ladenHtml };
  console.log('[DFL-Laden v1] aktiv — Maskottchen auf der Wiese neben dem Gelände (Kenney Cube Pets), Zubehör, Tricks, Pokalvitrine, Pflanze, Cap +1 Mio für 2 Winpunkte (D122, D159 e)');
})();
