/* ═══════════════════════════════════════════════════════════════════════════
   DFL · VEREINSGELÄNDE v6  (D127, Nutzer 2026-10-13: „Schilder weg, mehr Gebäude, mehr Stadt und Leben, größer + Zoom,
   Ausbau sichtbarer“, „Kreuzungen – die Straßen funktionieren nur in eine Richtung“, „bau es ins Spiel ein“)
   ─────────────────────────────────────────────────────────────────────────
   Bilder aus spiel/tools/dfl_gelaende6_render.js (Kenney CC0 + eigenes Low-Poly), je Stadtgröße × Stufe 1–5:
     Grundbild 2160 × 1350 · Tiefenbild (Ebenen: Fahrzeuge und Fans verschwinden hinter Häusern, Bäumen, Tribünen)
     Masken Sitze/Markisen/Fahnen (Vereinsfarbe) und Wiese (Jahreszeit) · Spieltag-Ebene (Buden, Fahnen, Fans) je Stufe
   Vereinsname (Dach, Band an der Tribüne, Tor) wird je Verein auf die Flächen gemalt – verdeckt wie alles andere.
   Stufe = kleinste Anlagenstufe aus Stadion, Training, Scouting, Fanshop: 1–2 → 1 · 3–4 → 2 · 5–6 → 3 · 7–8 → 4 · 9–10 → 5
   Leben: Verkehr geradeaus auf der Hauptstraße vorn und der Straße hinten (Rechtsverkehr, Abstand zum Vordermann; seit 2026-10-14
     ohne Seitenstraßen und Kreuzungen – dort Fußwege mit Minipark), Bus mit Halt, Straßenbahn mit Halt „Stadion“, Zebrastreifen; Heimspiel-Woche: Spieltag-Ebene, Fans aus Bahn und von den
     Gehwegen durchs Tor ins Stadion, Flutlicht; Baustellen mit Kran; marode Anlagen grau (D75); Himmel, Wolken, Wetter,
     Abend, Feuerwerk über dfl_kulisse.js.
   Bedienung: keine Schilder – Antippen zeigt Name und Stufe, zweites Antippen öffnet den Bereich; Knopf „Vergrößern“ öffnet
     das Gelände bildschirmfüllend mit Zoom (zwei Finger, Mausrad, + / −) und Verschieben.
   Eigenständig seit dem Aufräumen 2026-10-13 (v5 gelöscht): bringt stadtGroesse() und anlaesse() selbst mit.
   API: DFLGelaende.zeichne(el) · .stadtGroesse() · .anlaesse(lage) · DFLGelaende.v6 = { stufe(), key(), welt(x, z), sim(dt), fahrzeuge(), fans() }
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const D6 = window.DFL_GELAENDE6;
  if (!D6 || !D6.bilder) { console.warn('[DFL-Gelände v6] gelaende6_daten.js fehlt'); return; }

  // ── Stadtgröße und Anlässe (aus v5 übernommen, Aufräumen 2026-10-13; v5 mit 9 Bildern ist gelöscht) ─────────
  const franchiseFcm = () => { try { return window.DFLSpiel ? DFLSpiel.franchise('fcm') : null; } catch (e) { return null; } };
  // Stadtgröße nach Einwohnern (D53: Kleinstadt < 200.000, Großstadt ab 550.000)
  function stadtGroesse() {
    const f = franchiseFcm(), ew = f && f.einwohner;
    if (!ew) return 'normal';
    return ew < 200000 ? 'klein' : ew >= 550000 ? 'gross' : 'normal';
  }
  // Laufender Ausbau (Bauzeit aus app_main.js) → Kran an der Anlage
  const BAU_ZIEL = { stadium: 'stadion', training: 'training', scouting: 'scouting', merchandising: 'fanshop' };
  function baustellen() {
    const b = (typeof CLUB !== 'undefined' && CLUB && CLUB.facilityBuilds) || {};
    return Object.keys(b).filter(k => b[k] && b[k].weeksLeft > 0 && BAU_ZIEL[k]).map(k => ({ ziel: BAU_ZIEL[k], wochen: b[k].weeksLeft }));
  }
  const eigenesTeam = () => { try { return LEAGUE.tiers.bundesliga.groups[0].teams.find(t => t.id === 'fcm'); } catch (e) { return null; } };
  // Sonne bei drei Siegen in Folge, Regen in der Krise (drei Niederlagen oder aus vier Spielen ≥ 3 Niederlagen ohne Sieg)
  function wetterNachForm() {
    if (typeof LEAGUE === 'undefined' || !LEAGUE || (LEAGUE.matchday || 0) < 3) return null;
    const f = ((eigenesTeam() || {}).form || []).slice(-4), l3 = f.slice(-3);
    if (l3.length === 3 && l3.every(r => r === 'W')) return 'sonne';
    if (l3.length === 3 && (l3.every(r => r === 'L') || (f.length === 4 && f.filter(r => r === 'L').length >= 3 && f.indexOf('W') < 0))) return 'regen';
    return null;
  }
  // Derby = Spiel gegen einen Divisionsrivalen; Wimpel in der Woche nach dem Sieg
  function derbySieg() {
    try {
      const md = LEAGUE.matchday || 0; if (!md || LEAGUE.week - LEAGUE.matchWeeks[md - 1] > 1) return false;
      const fg = findFcmGroup(LEAGUE), paar = ((LEAGUE.fixtures[fg.key] || [])[md - 1] || []).find(([h, a]) => h === 'fcm' || a === 'fcm');
      if (!paar) return false;
      const f = (eigenesTeam() || {}).form || [], a = franchiseFcm(), b = DFLSpiel.franchise(paar[0] === 'fcm' ? paar[1] : paar[0]);
      return f[f.length - 1] === 'W' && !!(a && b && a.division === b.division);
    } catch (e) { return false; }
  }
  // Titel: von der Meisterschaft bis zum ersten Spieltag der neuen Saison
  function titelFeier() {
    const P = typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.dflPlayoffs;
    return !!(P && P.meister === 'fcm' && P.saison === LEAGUE.season - 1 && !(LEAGUE.matchday > 0));
  }
  // Anlässe fürs Gelände (dfl_anlagen_patch.js ergänzt marode Anlagen und Sanierungen)
  function anlaesse(lage) {
    lage = lage || (window.DFLKulisse ? DFLKulisse.lage() : { monat: -1, heimspiel: false });
    const sp = typeof CLUB !== 'undefined' && CLUB && CLUB.sponsors && CLUB.sponsors.shirt;
    return { fans: !!lage.heimspiel, baustellen: baustellen(), derby: derbySieg(), titel: titelFeier(), weihnachten: lage.monat === 5,
      wetter: wetterNachForm(), banner: sp && sp.name ? sp.name : `Auf geht's, ${(typeof CLUB !== 'undefined' && CLUB && (CLUB.shortName || CLUB.name)) || 'Kickdraft'}!` };
  }
  window.DFLGelaende = { stadtGroesse, anlaesse };
  const ALT = window.DFLGelaende;
  const BW = D6.breite, BH = D6.hoehe, P = D6.projektion, KO = D6.koeff, PRO_EINHEIT = 65534 / 199.9;
  const SX = -0.9;                                         // Stadionweg / Tor / Haltestelle „Stadion“ (Szene: STADION_X)
  const welt = (x, z, y) => [(P.o[0] + x * P.ex[0] + (y || 0) * P.ey[0] + z * P.ez[0]) * BW, (P.o[1] + x * P.ex[1] + (y || 0) * P.ey[1] + z * P.ez[1]) * BH];

  // ── Daten aus dem Spiel ────────────────────────────────────────────────────
  const anl = k => (typeof CLUB !== 'undefined' && CLUB && CLUB.facilities && CLUB.facilities[k]) || 1;
  const franchise = () => { try { return window.DFLSpiel ? DFLSpiel.franchise('fcm') : null; } catch (e) { return null; } };
  const ANLAGEN = ['stadium', 'training', 'scouting', 'merchandising'];
  function stufe() { const min = Math.min(...ANLAGEN.map(anl)); return Math.max(1, Math.min(5, Math.ceil(min / 2))); }
  function key() { return ALT.stadtGroesse() + '-' + stufe(); }
  const plaetze = () => (typeof stadiumCapacityForLevel === 'function' ? stadiumCapacityForLevel(anl('stadium')) : 30000);
  const medizinStufe = () => (window.DFLMedizin && DFLMedizin.stufe ? DFLMedizin.stufe() : anl('medizin'));
  const BAU = { stadion: 'stadium', training: 'training', scouting: 'scouting', fanshop: 'merchandising', medizin: 'medizin' };
  const bauText = ziel => { const b = (typeof CLUB !== 'undefined' && CLUB && CLUB.facilityBuilds) || {}, x = b[BAU[ziel]]; return x && x.weeksLeft > 0 ? ` · Bau: noch ${x.weeksLeft} Wo.` : ''; };
  const ZIELE = {
    stadion: { text: () => 'Stadion · ' + plaetze().toLocaleString('de-DE') + ' Plätze', go: 'club' },
    training: { text: () => 'Training · Stufe ' + anl('training'), go: 'training' },
    buero: { text: () => 'Front Office', go: 'fo' },
    fanshop: { text: () => 'Fanshop · Stufe ' + anl('merchandising'), go: 'club' },
    scouting: { text: () => 'Scouting · Stufe ' + anl('scouting'), go: 'scout' },
    medizin: { text: () => 'Medizin · Stufe ' + medizinStufe(), go: 'club' },
    museum: { text: () => 'Museum · Hall of Fame', go: null },
    vereinsheim: { text: () => 'Vereinsheim', go: null },
    parkhaus: { text: () => 'Parkhaus', go: null }
  };
  const KRAN = { stadion: [3.4, -3.9], training: [8.6, -1.6], fanshop: [2.75, 2.3], scouting: [-5.3, -4.6], medizin: [3.2, -6.0] };

  // ── Bilder laden ─────────────────────────────────────────────────────────
  const CACHE = new Map();
  const bild = n => {
    const src = 'app/gelaende6/' + n;
    if (!CACHE.has(src)) { const i = new Image(); i.decoding = 'async'; i.src = src; CACHE.set(src, new Promise(ok => { i.onload = () => ok(i); i.onerror = () => ok(null); })); }
    return CACHE.get(src);
  };
  const SP = {};
  async function spritesLaden() {
    const namen = Object.keys(D6.sprites || {});
    const b = await Promise.all(namen.map(n => bild('sp-' + n + '.png')));
    namen.forEach((n, i) => { if (b[i]) SP[n] = Object.assign({ img: b[i] }, D6.sprites[n]); });
  }
  function tiefeAus(img) {
    if (!img) return null;
    const c = document.createElement('canvas'); c.width = img.naturalWidth || img.width; c.height = img.naturalHeight || img.height; const o = c.getContext('2d', { willReadFrequently: true });
    o.drawImage(img, 0, 0); let d;
    try { d = o.getImageData(0, 0, c.width, c.height).data; } catch (e) { return null; }    // file:// (Offline-ZIP): Pixel gesperrt → ohne Verdeckung
    const t = new Uint16Array(c.width * c.height);
    for (let k = 0, j = 0; k < t.length; k++, j += 4) t[k] = d[j] * 256 + d[j + 1];
    return { t, w: c.width, h: c.height, f: BW / c.width };
  }

  // ── Gelände zusammensetzen (einmal je Zustand) ─────────────────────────────
  const leinwand = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  function maskeFarbig(maske, farbe, art) {
    const c = leinwand(BW, BH), o = c.getContext('2d');
    o.drawImage(maske, 0, 0, BW, BH);
    if (art === 'multiply') { o.globalCompositeOperation = 'multiply'; o.fillStyle = farbe; o.fillRect(0, 0, BW, BH); o.globalCompositeOperation = 'destination-in'; o.drawImage(maske, 0, 0, BW, BH); }
    else { o.globalCompositeOperation = 'source-in'; o.fillStyle = farbe; o.fillRect(0, 0, BW, BH); }
    return c;
  }
  const hell = f => { const n = parseInt(String(f).slice(1), 16); return (0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) / 255; };
  function vereinsFarben() {
    const f = franchise() || {}, a = (f.farben && f.farben[0]) || '#2fb36b', b = (f.farben && f.farben[1]) || '#ffffff';
    const name = String(f.name || (typeof CLUB !== 'undefined' && CLUB && CLUB.name) || 'Kickdraft');
    return { a, b, schrift: Math.abs(hell(a) - hell(b)) > 0.3 ? b : (hell(a) > 0.55 ? '#1f2328' : '#ffffff'), name: name.toUpperCase(), kurz: name.split(' ').pop().toUpperCase() };
  }
  // Vereinsname auf eine Fläche (Ecken oben links / oben rechts / unten links + Tiefe), verdeckt über das Tiefenbild
  function nameMalen(o, fl, V, tf) {
    const [A, B, C] = fl.ecken.map(e => [e[0] * BW, e[1] * BH, e[2]]);
    const lu = Math.hypot(B[0] - A[0], B[1] - A[1]), lv = Math.hypot(C[0] - A[0], C[1] - A[1]);
    if (lu < 4 || lv < 2) return;
    const cw = 512, ch = Math.max(24, Math.round(cw * lv / lu * (fl.art === 'dach' ? 1 : 1))), t = leinwand(cw, ch), g = t.getContext('2d');
    const dach = fl.art === 'dach';
    g.fillStyle = dach ? '#eef0f2' : V.a; g.fillRect(0, 0, cw, ch);
    if (!dach) { g.fillStyle = V.schrift; g.fillRect(0, ch * 0.07, cw, ch * 0.05); g.fillRect(0, ch * 0.88, cw, ch * 0.05); }
    const text = fl.text === 'kurz' ? V.kurz : V.name;
    g.fillStyle = dach ? (hell(V.a) > 0.8 ? V.b : V.a) : V.schrift;
    g.font = `bold ${Math.round(ch * (dach ? 0.7 : 0.6))}px Fredoka, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const f = Math.min(1, cw * 0.88 / Math.max(1, g.measureText(text).width));
    g.save(); g.translate(cw / 2, ch * 0.54); g.scale(f, 1); g.fillText(text, 0, 0); g.restore();
    // auf eine eigene Ebene in Bildgröße zeichnen (Ausschnitt), dann Pixel hinter Vorderem entfernen
    const xs = [A[0], B[0], C[0], B[0] + C[0] - A[0]], ys = [A[1], B[1], C[1], B[1] + C[1] - A[1]];
    const x0 = Math.max(0, Math.floor(Math.min(...xs))), y0 = Math.max(0, Math.floor(Math.min(...ys))), x1 = Math.min(BW, Math.ceil(Math.max(...xs))), y1 = Math.min(BH, Math.ceil(Math.max(...ys)));
    if (x1 <= x0 || y1 <= y0) return;
    const e = leinwand(x1 - x0, y1 - y0), eo = e.getContext('2d', { willReadFrequently: true });
    eo.setTransform((B[0] - A[0]) / cw, (B[1] - A[1]) / cw, (C[0] - A[0]) / ch, (C[1] - A[1]) / ch, A[0] - x0, A[1] - y0); eo.drawImage(t, 0, 0);
    if (tf) {
      // Tiefe der Fläche ist im Bild affin: d = A.d + α·(x − A.x) + β·(y − A.y)
      const ux = B[0] - A[0], uy = B[1] - A[1], vx = C[0] - A[0], vy = C[1] - A[1], du = B[2] - A[2], dv = C[2] - A[2], det = ux * vy - uy * vx;
      if (Math.abs(det) > 1e-6) {
        const al = (du * vy - dv * uy) / det, be = (dv * ux - du * vx) / det, eps = 0.25 * PRO_EINHEIT;
        const id = eo.getImageData(0, 0, e.width, e.height), p = id.data;
        for (let y = 0; y < e.height; y++) for (let x = 0; x < e.width; x++) { const k = (y * e.width + x) * 4; if (!p[k + 3]) continue;
          const px = x + x0, py = y + y0, soll = A[2] + al * (px - A[0]) + be * (py - A[1]);
          const ist = tf.t[Math.min(tf.h - 1, Math.floor(py / tf.f)) * tf.w + Math.min(tf.w - 1, Math.floor(px / tf.f))];
          if (ist < soll - eps) p[k + 3] = 0; }
        eo.putImageData(id, 0, 0);
      }
    }
    o.drawImage(e, x0, y0);
  }
  let gelMerk = { k: '', c: null };
  function zusammensetzen(B, daten, lage, an, K, tf) {
    const V = vereinsFarben(), ton = K && lage ? K.gelaendeTon(lage.zeit) : null, heim = !!(an && an.fans);
    const grau = ((an && an.marode) || []).filter(z => daten.ziele[z]);
    const k = [key(), V.a, V.b, V.name, ton ? ton.farbe + ton.staerke : '', lage && lage.abend, heim, grau.join(), B.rund ? 'rund' : ''].join('|');
    if (gelMerk.k === k) return gelMerk.c;
    const c = leinwand(BW, BH), o = c.getContext('2d');
    o.drawImage(B.grund, 0, 0);
    if (ton && B.gras) { o.globalAlpha = ton.staerke; o.drawImage(maskeFarbig(B.gras, ton.farbe, 'flach'), 0, 0); o.globalAlpha = 1; }
    if (B.sitze) o.drawImage(maskeFarbig(B.sitze, V.a, 'multiply'), 0, 0);
    (daten.flaechen || []).forEach(fl => nameMalen(o, fl, V, tf));
    if (heim && B.spieltag) { o.drawImage(B.spieltag, 0, 0); if (B.spieltagSitze) o.drawImage(maskeFarbig(B.spieltagSitze, V.a, 'multiply'), 0, 0); }
    if (grau.length) {                               // D75: marode Anlagen grau (Farbe raus, Helligkeit bleibt)
      const q = leinwand(BW, BH), qq = q.getContext('2d'); qq.drawImage(c, 0, 0); qq.globalCompositeOperation = 'saturation';
      grau.forEach(z => { const r = daten.ziele[z], rx = (r.x1 - r.x0) / 2 * BW, ry = (r.y1 - r.y0) / 2 * BH;
        qq.save(); qq.translate((r.x0 + r.x1) / 2 * BW, (r.y0 + r.y1) / 2 * BH); qq.scale(1, ry / rx);
        const v = qq.createRadialGradient(0, 0, rx * 0.45, 0, 0, rx); v.addColorStop(0, 'rgba(128,128,128,0.9)'); v.addColorStop(1, 'rgba(128,128,128,0)');
        qq.fillStyle = v; qq.beginPath(); qq.arc(0, 0, rx, 0, 7); qq.fill(); qq.restore(); });
      qq.globalCompositeOperation = 'destination-in'; qq.drawImage(c, 0, 0); o.clearRect(0, 0, BW, BH); o.drawImage(q, 0, 0);
    }
    gelMerk = { k, c };
    return c;
  }

  // ── Verkehr geradeaus auf zwei Straßen (Rechtsverkehr) ───────────────────────
  // Nutzer 2026-10-14: „die Autos biegen nicht richtig ab, die drehen sich einfach um 90 Grad … nimm diese beiden Straßen
  // raus und ersetze sie durch Gehwege“ → keine Seitenstraßen und Kreuzungen mehr: je Straße zwei Spuren, jedes Fahrzeug
  // fährt von Rand zu Rand und hält Abstand zum Vordermann, am Zebrastreifen und an seiner Haltestelle.
  const ZM_E = 6.71, ZM_W = 5.33, ZB_E = -8.1, ZB_W = -8.7, RAND0 = -15.2, RAND1 = 13.2, GLEIS = 6.14;
  const LAENGE = { auto: 0.85, bus: 1.8, bahn: 2.9 }, AUTOS = ['sedan', 'taxi', 'van', 'suv', 'delivery'], FANS = ['male-a', 'female-b', 'male-d', 'female-e'];
  const SPUREN = { mE: { z: ZM_E, r: 1 }, mW: { z: ZM_W, r: -1 }, bE: { z: ZB_E, r: 1 }, bW: { z: ZB_W, r: -1 } };   // m = Hauptstraße vorn, b = Straße hinten
  const R = Math.random, wahl = a => a[Math.floor(R() * a.length)];
  const richtung = (dx, dz) => Math.abs(dx) >= Math.abs(dz) ? (dx >= 0 ? 'px' : 'nx') : (dz >= 0 ? 'pz' : 'nz');
  // Zustand des Lebens (bleibt zwischen zwei Office-Aufrufen erhalten)
  // Erweiterungen (D122/D159 e, dfl_laden.js: Wiese mit Maskottchen, Pflanze, Vitrine): { boden(g, Z), sim(dt), figuren() → [{ x, z, malen(g, tf) }], tippen(px, py) → true = verbraucht }
  const EXTRAS = [];
  const extraAufruf = (fn, ...a) => { for (const e of EXTRAS) if (typeof e[fn] === 'function') { try { e[fn](...a); } catch (x) { console.warn('[DFL-Gelände v6] Erweiterung', x); } } };
  const L = { fz: [], fans: [], uhr: { mE: 1, mW: 0.5, bE: 2, bW: 3, bahn: 3, bus: 9, fan: 0 }, heim: false, stadt: '', t: null };
  const TAKT = { klein: [3.2, 5.5, 5, 8], normal: [2.0, 4.5, 3.5, 7.5], gross: [1.4, 3.2, 2.5, 5.5] };
  function neuesFahrzeug(spur, art) {
    const S = SPUREN[spur], x0 = S.r > 0 ? RAND0 : RAND1;
    if (L.fz.some(f => f.spur === spur && Math.abs(f.x - x0) < 1.4)) return;           // Einfahrt frei?
    const bus = art === 'bus';
    L.fz.push({ art: bus ? 'bus' : 'auto', sp: bus ? 'bus' : 'auto-' + wahl(AUTOS), spur, x: x0, z: S.z, r: S.r, ende: S.r > 0 ? RAND1 : RAND0,
      L: LAENGE[bus ? 'bus' : 'auto'], vmax: bus ? 1.2 : 1.5 + R() * 0.5, halt: bus ? { x: -5, zeit: 3.5 } : null });
  }
  function neueBahn() {
    if (L.fz.some(f => f.art === 'bahn')) return;
    const r = R() < 0.5 ? 1 : -1;
    L.fz.push({ art: 'bahn', sp: 'bahn', spur: 'gleis', x: r > 0 ? -15.6 : 13.6, z: GLEIS, r, ende: r > 0 ? 13.6 : -15.6, L: LAENGE.bahn, vmax: 1.3, halt: { x: SX, zeit: 4 } });
  }
  const zebraBelegt = () => L.fans.some(w => Math.abs(w.x - SX) < 0.3 && w.z > 4.95 && w.z < 5.75);
  // Freie Strecke vor der Fahrzeugmitte: Vordermann auf derselben Spur, Zebrastreifen (Spur mW, wenn Fans queren), Haltestelle
  function freieStrecke(f, zebra) {
    let frei = 9;
    for (const o of L.fz) if (o !== f && o.spur === f.spur) { const d = (o.x - f.x) * f.r; if (d > 0) frei = Math.min(frei, d - (o.L + f.L) / 2 - 0.12); }
    if (zebra && f.spur === 'mW') { const d = (SX - f.x) * f.r - 0.3; if (d - f.L / 2 > -0.02) frei = Math.min(frei, d - f.L / 2 - 0.05); }
    if (f.halt && !f.hielt) { const d = (f.halt.x - f.x) * f.r; if (d >= 0) frei = Math.min(frei, d); }
    return frei;
  }
  function fan(name, weg, v) { return { name, weg: weg.slice(1), x: weg[0][0], z: weg[0][1], v, f: R() * 6, dir: 'px' }; }
  const zumStadion = () => [[SX + (R() - 0.5) * 0.2, 4.3], [SX + (R() - 0.5) * 0.25, 2.5]];
  function sim(dt) {
    const tk = TAKT[L.stadt] || TAKT.normal;
    for (const sp of Object.keys(SPUREN)) { L.uhr[sp] -= dt; if (L.uhr[sp] <= 0) { neuesFahrzeug(sp, 'auto'); L.uhr[sp] = sp[0] === 'm' ? tk[0] + R() * (tk[1] - tk[0]) : tk[2] + R() * (tk[3] - tk[2]); } }
    if (L.stadt !== 'klein') { L.uhr.bus -= dt; if (L.uhr.bus <= 0) { L.uhr.bus = 18; if (!L.fz.some(f => f.art === 'bus')) neuesFahrzeug('mW', 'bus'); } }
    L.uhr.bahn -= dt; if (L.uhr.bahn <= 0) { L.uhr.bahn = L.heim ? 8 : 14; neueBahn(); }
    const zebra = L.heim && zebraBelegt();
    for (const f of L.fz) {
      if (f.warte > 0) { f.warte -= dt; if (f.warte <= 0) f.hielt = true; continue; }
      const frei = freieStrecke(f, zebra), v = Math.max(0, Math.min(f.vmax, frei * 2.4));
      f.x += f.r * Math.min(v * dt, Math.max(0, frei));
      if ((f.x - f.ende) * f.r >= 0) { f.tot = true; continue; }
      if (f.halt && !f.hielt && Math.abs(f.x - f.halt.x) < 0.05) { f.warte = f.halt.zeit;
        if (f.art === 'bahn' && L.heim) for (let k = 0; k < 7; k++) L.fans.push(fan(wahl(FANS), [[f.halt.x - 0.9 + R() * 1.8, 5.84], [SX + (R() - 0.5) * 0.2, 5.84], [SX + (R() - 0.5) * 0.2, 4.78], ...zumStadion()], 0.7)); }
    }
    L.fz = L.fz.filter(f => !f.tot);
    L.uhr.fan -= dt;
    if (L.heim && L.uhr.fan <= 0) { L.uhr.fan = 0.5; const von = R() < 0.5 ? [[-14, 4.78], [SX, 4.78]] : [[12.3, 4.78], [SX, 4.78]];
      L.fans.push(fan(wahl(FANS), [...von.map(([x, z]) => [x, z + (R() - 0.5) * 0.12]), ...zumStadion()], 0.7)); }
    for (const w of L.fans) {
      w.f += dt * 9;
      if (!w.weg.length) { w.tot = true; continue; }
      const [zx, zz] = w.weg[0], dx = zx - w.x, dz = zz - w.z, d = Math.hypot(dx, dz);
      if (d < 0.02) { w.weg.shift(); continue; }
      if (w.z > 5.75 && zz < w.z && L.fz.some(f => f.art !== 'bahn' && Math.abs(f.z - ZM_W) < 0.3 && Math.abs(f.x - SX) < f.L / 2 + 0.1)) continue;
      w.dir = richtung(dx, dz); const s2 = Math.min(d, w.v * dt); w.x += dx / d * s2; w.z += dz / d * s2;
    }
    L.fans = L.fans.filter(w => !w.tot);
    extraAufruf('sim', dt);
  }
  function lebenFuer(stadt, heim) {
    if (L.stadt !== stadt) { L.fz = []; L.stadt = stadt; L.heim = heim; for (let i = 0; i < 400; i++) sim(0.1); }     // vorwärmen
    if (!heim) L.fans = [];
    L.heim = heim;
  }

  // ── Figuren und Fahrzeuge mit Ebenen zeichnen ───────────────────────────────
  const hilf = leinwand(64, 64), hctx = hilf.getContext('2d', { willReadFrequently: true });
  function zeichneVerdeckt(g, sp, fr, x, z, hoehe, eps, tf) {
    const [wx, wy] = welt(x, z), x0 = Math.round(wx - sp.ax), y0 = Math.round(wy - sp.ay);
    if (!tf) { g.drawImage(sp.img, fr * sp.w, 0, sp.w, sp.h, x0, y0, sp.w, sp.h); return; }
    if (hilf.width < sp.w) hilf.width = sp.w; if (hilf.height < sp.h) hilf.height = sp.h;
    hctx.clearRect(0, 0, sp.w, sp.h); hctx.drawImage(sp.img, fr * sp.w, 0, sp.w, sp.h, 0, 0, sp.w, sp.h);
    const meine = KO.c0 + KO.cx * x + KO.cy * hoehe + KO.cz * z - eps * PRO_EINHEIT;
    // Nutzer 2026-10-17 („Animation smoother, nicht in 3 fps“): Pixel nur zurücklesen, wenn im Tiefenbild überhaupt etwas
    // davor liegt – sonst direkt zeichnen (getImageData war am Handy der Bremsklotz)
    if (!verdecktIrgendwo(tf, x0, y0, sp.w, sp.h, meine)) { g.drawImage(sp.img, fr * sp.w, 0, sp.w, sp.h, x0, y0, sp.w, sp.h); return; }
    if (verdecktMalen(g, sp.img, fr * sp.w, 0, sp.w, sp.h, x0, y0, sp.w, sp.h, tf, meine)) return;
    const id = hctx.getImageData(0, 0, sp.w, sp.h), p = id.data;
    let weg = false;
    for (let j = 0; j < sp.h; j++) { const sy = Math.floor((y0 + j) / tf.f); if (sy < 0 || sy >= tf.h) continue;
      for (let i = 0; i < sp.w; i++) { const k = (j * sp.w + i) * 4; if (!p[k + 3]) continue; const sx = Math.floor((x0 + i) / tf.f); if (sx < 0 || sx >= tf.w) continue;
        if (tf.t[sy * tf.w + sx] < meine) { p[k + 3] = 0; weg = true; } } }
    if (weg) hctx.putImageData(id, 0, 0);
    g.drawImage(hilf, 0, 0, sp.w, sp.h, x0, y0, sp.w, sp.h);
  }
  // Liegt im Rechteck (Bildpunkte) irgendwo eine Tiefe vor „meine“? Grob über das Tiefenbild (eine Zelle = tf.f Bildpunkte)
  function verdecktIrgendwo(tf, x0, y0, w, h, meine) {
    const sx0 = Math.max(0, Math.floor(x0 / tf.f)), sx1 = Math.min(tf.w - 1, Math.floor((x0 + w) / tf.f));
    const sy0 = Math.max(0, Math.floor(y0 / tf.f)), sy1 = Math.min(tf.h - 1, Math.floor((y0 + h) / tf.f));
    for (let sy = sy0; sy <= sy1; sy++) { const o = sy * tf.w; for (let sx = sx0; sx <= sx1; sx++) if (tf.t[o + sx] < meine) return true; }
    return false;
  }
  // Verdeckt zeichnen ohne Pixel zurückzulesen: kleine Maske aus dem Tiefenbild (eine Zelle = tf.f Bildpunkte, wie die Prüfung
  // Bildpunkt für Bildpunkt), dann „destination-out“ – alles auf der Grafikkarte
  let MK = null, mko = null, HV = null, hvo = null;                 // erst beim ersten Bedarf (Prüflauf ohne DOM)
  function verdecktMalen(g, img, sx, sy, sw, sh, x0, y0, w, h, tf, meine) {
    try {
      if (!MK) { MK = leinwand(16, 16); mko = MK.getContext('2d'); HV = leinwand(64, 64); hvo = HV.getContext('2d'); }
      const cx0 = Math.floor(x0 / tf.f), cy0 = Math.floor(y0 / tf.f), cw = Math.floor((x0 + w) / tf.f) - cx0 + 1, ch = Math.floor((y0 + h) / tf.f) - cy0 + 1;
      if (MK.width < cw) MK.width = cw; if (MK.height < ch) MK.height = ch;
      const id = mko.createImageData(cw, ch), d = id.data;
      for (let j = 0; j < ch; j++) { const ty = cy0 + j; if (ty < 0 || ty >= tf.h) continue; const o = ty * tf.w;
        for (let i = 0; i < cw; i++) { const tx = cx0 + i; if (tx >= 0 && tx < tf.w && tf.t[o + tx] < meine) d[(j * cw + i) * 4 + 3] = 255; } }
      mko.clearRect(0, 0, MK.width, MK.height); mko.putImageData(id, 0, 0);
      const W2 = Math.ceil(w) + 1, H2 = Math.ceil(h) + 1;
      if (HV.width < W2) HV.width = W2; if (HV.height < H2) HV.height = H2;
      hvo.globalCompositeOperation = 'source-over'; hvo.clearRect(0, 0, HV.width, HV.height);
      hvo.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
      hvo.globalCompositeOperation = 'destination-out'; hvo.imageSmoothingEnabled = false;
      hvo.drawImage(MK, 0, 0, cw, ch, cx0 * tf.f - x0, cy0 * tf.f - y0, cw * tf.f, ch * tf.f);
      hvo.globalCompositeOperation = 'source-over'; hvo.imageSmoothingEnabled = true;
      g.drawImage(HV, 0, 0, w, h, x0, y0, w, h);
      return true;
    } catch (e) { return false; }
  }
  window.DFLGelaendeVerdeckt = verdecktIrgendwo;
  window.DFLGelaendeVerdecktMalen = verdecktMalen;
  const fzName = f => f.sp + (f.r > 0 ? '-px' : '-nx');      // Bildstreifen je Fahrtrichtung (Autos, Bus, Bahn)
  function lebenZeichnen(g, tf, kraene) {
    const zusatz = [];
    for (const x of EXTRAS) if (typeof x.figuren === 'function') { try { (x.figuren() || []).forEach(f => zusatz.push({ x: f, t: f.x + f.z })); } catch (e) { /* Erweiterung optional */ } }
    const alle = [...L.fans.map(w => ({ w, t: w.x + w.z })), ...L.fz.map(f => ({ f, t: f.x + f.z })), ...kraene.map(k => ({ k, t: k[0] + k[1] })), ...zusatz].sort((a, b) => a.t - b.t);
    for (const e of alle) {
      if (e.x) { try { e.x.malen(g, tf); } catch (x) { /* Erweiterung optional */ } continue; }
      if (e.k) { const sp = SP.kran; if (sp) zeichneVerdeckt(g, sp, 0, e.k[0], e.k[1], 0.5, 0.6, tf); continue; }
      if (e.f) { const sp = SP[fzName(e.f)]; if (sp) zeichneVerdeckt(g, sp, 0, e.f.x, e.f.z, 0.2, e.f.L / 2 + 0.15, tf); continue; }
      const w = e.w, sp = SP['fan-' + w.name + '-' + w.dir]; if (sp) zeichneVerdeckt(g, sp, Math.floor(w.f) % sp.n, w.x, w.z, 0.2, 0.28, tf);
    }
  }

  // ── Ansicht (Office-Kopf oder Vollbild) ─────────────────────────────────────
  // Standardausschnitt: Gelände mit beiden Fußwegen und Miniparks an den Seiten
  function standardRahmen() {
    const p = [welt(-9.4, -9.6), welt(10.8, -9.6), welt(-9.4, 7.2), welt(10.8, 7.2), welt(1, -9.6, 3)];
    return { x0: Math.min(...p.map(q => q[0])), x1: Math.max(...p.map(q => q[0])), y0: Math.min(...p.map(q => q[1])), y1: Math.max(...p.map(q => q[1])) };
  }
  function ansicht(cv, voll) {
    const A = { cv, g: cv.getContext('2d'), V: { k: 0.3, tx: 0, ty: 0 }, vw: 0, vh: 0, dpr: 1, voll, auswahl: null };
    A.groesse = () => { const r = cv.getBoundingClientRect(); A.vw = Math.max(1, r.width); A.vh = Math.max(1, r.height); A.dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(A.vw * A.dpr); cv.height = Math.round(A.vh * A.dpr); };
    A.kMin = () => voll ? Math.min(A.vw / BW, A.vh / BH) * 0.95 : Math.max(A.vw / BW, A.vh / BH);       // Vollbild: ganze Insel passt hinein
    A.begrenzen = () => { A.V.k = Math.min(Math.max(1.4, A.kMin() * 6), Math.max(A.kMin(), A.V.k)); const w = BW * A.V.k, h = BH * A.V.k;
      A.V.tx = w <= A.vw ? (A.vw - w) / 2 : Math.min(0, Math.max(A.vw - w, A.V.tx)); A.V.ty = h <= A.vh ? (A.vh - h) / 2 : Math.min(0, Math.max(A.vh - h, A.V.ty)); };
    A.start = () => { A.groesse(); const r = standardRahmen(); A.V.k = Math.min(A.vw / (r.x1 - r.x0), A.vh / (r.y1 - r.y0)) * (voll ? 1 : 1.05);
      A.V.tx = A.vw / 2 - (r.x0 + r.x1) / 2 * A.V.k; A.V.ty = A.vh / 2 - (r.y0 + r.y1) / 2 * A.V.k; A.begrenzen(); };
    A.zoomUm = (f, cx, cy) => { const k0 = A.V.k; A.V.k *= f; A.begrenzen(); const q = A.V.k / k0; A.V.tx = cx - (cx - A.V.tx) * q; A.V.ty = cy - (cy - A.V.ty) * q; A.begrenzen(); };
    A.bildpunkt = (cx, cy) => { const r = cv.getBoundingClientRect(); return [(cx - r.left - A.V.tx) / A.V.k / BW, (cy - r.top - A.V.ty) / A.V.k / BH]; };
    return A;
  }
  function trefferBei(A, daten, cx, cy) {
    const [x, y] = A.bildpunkt(cx, cy); let best = null, fl = 9;
    for (const [k, q] of Object.entries(daten.ziele || {})) if (ZIELE[k] && x >= q.x0 && x <= q.x1 && y >= q.y0 && y <= q.y1) { const f = (q.x1 - q.x0) * (q.y1 - q.y0); if (f < fl) { fl = f; best = k; } }
    return best;
  }
  // Antippen wechselt beim Loslassen (pointerup); der nachfolgende Klick des Fingers landete sonst in der neuen Ansicht
  // (z. B. auf dem Reiter „Geld“ an derselben Stelle) – deshalb den nächsten Klick kurz schlucken.
  function geheZu(go, ausTipp) {
    if (!go) return;
    if (ausTipp) {
      const schlucke = ev => { ev.stopPropagation(); ev.preventDefault(); document.removeEventListener('click', schlucke, true); };
      document.addEventListener('click', schlucke, true);
      setTimeout(() => document.removeEventListener('click', schlucke, true), 500);
    }
    if (window.DFLAppShell) DFLAppShell.zeige(go);
    else if (typeof switchAppView === 'function' && go !== 'fo') switchAppView(go, document.getElementById('nav-' + go));
    // Stadion, Fanshop, Medizin: Verein auf dem Reiter „Anlagen“ (nicht der zuletzt gewählte Reiter)
    if (go === 'club' && window.DFLWege && typeof DFLWege.vereinReiter === 'function') { try { DFLWege.vereinReiter('anlagen'); } catch (e) { /* optional */ } }
  }
  function bedienung(A, el, daten, pille, schliessen) {
    const zeiger = new Map(); let ziehen = null, pinch = null, tipp = null;
    const geh = (go, ausTipp) => { if (go && A.voll && el.isConnected) el.remove(); geheZu(go, ausTipp); };   // Vollbild schließt beim Wechsel
    const box = A.cv;
    if (A.voll) box.style.touchAction = 'none';
    box.addEventListener('pointerdown', e => { zeiger.set(e.pointerId, [e.clientX, e.clientY]); tipp = zeiger.size === 1 ? { x: e.clientX, y: e.clientY, t: performance.now() } : null;
      if (!A.voll) return; box.setPointerCapture(e.pointerId);
      if (zeiger.size === 1) ziehen = { x: e.clientX, y: e.clientY, tx: A.V.tx, ty: A.V.ty };
      if (zeiger.size === 2) { const [a, b] = [...zeiger.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), k: A.V.k }; } });
    box.addEventListener('pointermove', e => { if (!zeiger.has(e.pointerId)) return; zeiger.set(e.pointerId, [e.clientX, e.clientY]);
      if (tipp && Math.hypot(e.clientX - tipp.x, e.clientY - tipp.y) > 8) tipp = null;
      if (!A.voll) return; const r = box.getBoundingClientRect();
      if (pinch && zeiger.size === 2) { const [a, b] = [...zeiger.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); A.zoomUm(pinch.k * d / pinch.d / A.V.k, (a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top); }
      else if (ziehen) { A.V.tx = ziehen.tx + e.clientX - ziehen.x; A.V.ty = ziehen.ty + e.clientY - ziehen.y; A.begrenzen(); } });
    const los = e => { zeiger.delete(e.pointerId); if (zeiger.size < 2) pinch = null;
      if (zeiger.size === 0) {
        const [tbx, tby] = tipp ? A.bildpunkt(e.clientX, e.clientY) : [0, 0];
        if (tipp && performance.now() - tipp.t < 450 && EXTRAS.some(x => { try { return typeof x.tippen === 'function' && x.tippen(tbx * BW, tby * BH); } catch (er) { return false; } })) { ziehen = null; tipp = null; return; }
        if (tipp && performance.now() - tipp.t < 450) {
          const k = trefferBei(A, daten, e.clientX, e.clientY);
          if (k && A.auswahl && A.auswahl.k === k) geh(ZIELE[k].go, true);                      // zweites Antippen: in den Bereich
          A.auswahl = k ? { k, q: daten.ziele[k], t: performance.now() } : null;
          pille.hidden = !k; if (k) pille.innerHTML = ZIELE[k].text() + bauText(k) + (ZIELE[k].go ? ' <i class="ti ti-chevron-right" aria-hidden="true"></i>' : '');
        }
        ziehen = null; tipp = null;
      } else if (A.voll) { const [a] = [...zeiger.values()]; ziehen = { x: a[0], y: a[1], tx: A.V.tx, ty: A.V.ty }; } };
    box.addEventListener('pointerup', los); box.addEventListener('pointercancel', los);
    if (A.voll) box.addEventListener('wheel', e => { e.preventDefault(); const r = box.getBoundingClientRect(); A.zoomUm(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    pille.addEventListener('click', () => { if (A.auswahl) geh(ZIELE[A.auswahl.k].go); });
  }

  // ── Zeichnen ──────────────────────────────────────────────────────────────
  let zustand = null;            // gemeinsam für Office-Kopf und Vollbild
  // Runde Stadien (Nutzer 2026-10-17: „mehr Variabilität“): je Verein fest ein Drittel rund (aus dem Vereinsnamen);
  // CLUB.ksStadionForm ('rund' | 'eckig') überschreibt, localStorage „gel-rund“ = an/aus zum Testen. Bilder: nur die Flicken,
  // die sich vom eckigen Gelände unterscheiden (app/gelaende6/rund-*, tools/dfl_gelaende6_rund.js)
  function stadionRund() {
    try { const t = localStorage.getItem('gel-rund'); if (t === 'an') return true; if (t === 'aus') return false; } catch (e) { /* weiter */ }
    try { if (typeof CLUB !== 'undefined' && CLUB && CLUB.ksStadionForm) return CLUB.ksStadionForm === 'rund'; } catch (e) { /* weiter */ }
    const f = franchise() || {}, n = String(f.name || f.id || '');
    let h = 0; for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0;
    return !!n && h % 3 === 0;
  }
  // Flicken einsetzen: Ebene in eigener Größe, Rechteck leeren, Ausschnitt hinein (e = [x, y, w, h, breite, hoehe])
  function geflickt(img, flick, e) {
    if (!img || !flick || !e) return img;
    const c = leinwand(e[4], e[5]), o = c.getContext('2d');
    o.drawImage(img, 0, 0, e[4], e[5]); o.clearRect(e[0], e[1], e[2], e[3]); o.drawImage(flick, e[0], e[1]);
    return c;
  }
  async function laden() {
    const k = key();
    let daten = D6.bilder[k] || D6.bilder['normal-' + stufe()];
    if (!daten) return null;
    const s = stufe(), K = window.DFLKulisse, lage = K ? K.lage() : { zeit: 'sommer', abend: false, heimspiel: false, monat: -1 };
    const an = (window.DFLGelaende && DFLGelaende.anlaesse ? DFLGelaende.anlaesse(lage) : ALT.anlaesse(lage)) || {};
    let kk = D6.bilder[k] ? k : 'normal-' + s;
    const [grund, tiefe, sitze, gras, spieltag, spieltagSitze] = await Promise.all([bild(kk + '.webp'), bild(kk + '-tiefe.png'), bild(kk + '-sitze.png'), bild(kk + '-gras.png'),
      an.fans ? bild('spieltag-' + s + '.webp') : null, an.fans ? bild('spieltag-' + s + '-sitze.png') : null, Object.keys(SP).length ? null : spritesLaden(), K ? K.laden() : null]);
    if (!grund) return null;
    const RD = window.DFL_GELAENDE6_RUND, R = stadionRund() && RD && RD.bilder && RD.bilder[kk] && RD.bilder[kk].ebenen ? RD.bilder[kk] : null;
    let ebenen = { grund, tiefe, sitze, gras, spieltag, spieltagSitze };
    if (R) {
      const E = R.ebenen, S = an.fans && RD.spieltag ? RD.spieltag[s] : null;
      const [fg, ft, fs, fr, fsp, fsps] = await Promise.all([bild('rund-' + kk + '.webp'), bild('rund-' + kk + '-tiefe.png'), bild('rund-' + kk + '-sitze.png'), bild('rund-' + kk + '-gras.png'),
        S ? bild('rund-spieltag-' + s + '.webp') : null, S ? bild('rund-spieltag-' + s + '-sitze.png') : null]);
      if (fg) {
        ebenen = { grund: geflickt(grund, fg, E.grund), tiefe: geflickt(tiefe, ft, E.tiefe), sitze: geflickt(sitze, fs, E.sitze), gras: geflickt(gras, fr, E.gras),
          spieltag: S ? geflickt(spieltag, fsp, S.spieltag) : spieltag, spieltagSitze: S ? geflickt(spieltagSitze, fsps, S.sitze) : spieltagSitze };
        daten = Object.assign({}, daten, { ziele: R.ziele || daten.ziele, flaechen: R.flaechen || daten.flaechen });
        kk += '|rund';
      }
    }
    const tf = (zustand && zustand.kk === kk && zustand.tf) || tiefeAus(ebenen.tiefe);
    const gel = zusammensetzen({ grund: ebenen.grund, sitze: ebenen.sitze, gras: ebenen.gras, spieltag: ebenen.spieltag, spieltagSitze: ebenen.spieltagSitze, rund: /\|rund$/.test(kk) }, daten, lage, an, K, tf);
    lebenFuer(ALT.stadtGroesse(), !!an.fans);
    const kraene = (an.baustellen || []).map(b => KRAN[b.ziel]).filter(Boolean);
    zustand = { kk, daten, lage, an, K, tf, gel, kraene };
    return zustand;
  }
  function malen(A, Z, t) {
    const { g, V, vw, vh, dpr } = A, K = Z.K, lage = Z.lage, an = Z.an;
    const SK = vw / 720, f = franchise() || {}, V2 = vereinsFarben();
    const opt = { zeit: lage.zeit, abend: lage.abend, stadt: ALT.stadtGroesse(), name: f.city || '', region: f.region || null, wetter: an.wetter };
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, A.cv.width, A.cv.height);
    if (K) {
      if (!A.himmel || A.himmel.w !== A.cv.width || A.himmel.h !== A.cv.height || A.himmel.k !== lage.zeit + lage.abend + an.wetter) {
        const h = leinwand(A.cv.width, A.cv.height), ho = h.getContext('2d'); ho.setTransform(SK * dpr, 0, 0, SK * dpr, 0, 0); K.himmelEbene(ho, 720, vh / SK, opt);
        A.himmel = { c: h, w: A.cv.width, h: A.cv.height, k: lage.zeit + lage.abend + an.wetter };
      }
      g.drawImage(A.himmel.c, 0, 0);
      g.setTransform(SK * dpr, 0, 0, SK * dpr, 0, 0); K.wolken(g, 720, opt, t);
      if (an.titel) K.feuerwerk(g, 720, vh / SK, t, [V2.a, V2.b, '#ffd23f']);
    } else { g.fillStyle = '#bfe3f2'; g.fillRect(0, 0, A.cv.width, A.cv.height); }
    // Welt (Gelände + Leben) – abends gedämpft wie das Gelände
    const ziel = lage.abend ? (A.ebene || (A.ebene = leinwand(1, 1))) : null;
    let w = g;
    if (ziel) { if (ziel.width !== A.cv.width || ziel.height !== A.cv.height) { ziel.width = A.cv.width; ziel.height = A.cv.height; } w = ziel.getContext('2d'); w.setTransform(1, 0, 0, 1, 0, 0); w.clearRect(0, 0, ziel.width, ziel.height); }
    w.setTransform(V.k * dpr, 0, 0, V.k * dpr, V.tx * dpr, V.ty * dpr);
    w.drawImage(Z.gel, 0, 0);
    extraAufruf('boden', w, Z);
    lebenZeichnen(w, Z.tf, Z.kraene);
    if (lage.heimspiel && Z.daten.ziele.stadion && K) {       // Flutlicht beim Heimspiel
      const r = Z.daten.ziele.stadion, bx = (r.x1 - r.x0) * BW, by = (r.y1 - r.y0) * BH;
      w.setTransform(dpr, 0, 0, dpr, 0, 0);
      K.flutlicht(w, [[0.12, 0.15], [0.88, 0.15], [0.12, 0.8], [0.88, 0.8]].map(([a, b]) => [(r.x0 * BW + a * bx) * V.k + V.tx, (r.y0 * BH + b * by) * V.k + V.ty, 160 * V.k * 2]));
    }
    if (ziel) {
      const q = A.ebene2 || (A.ebene2 = leinwand(1, 1)); if (q.width !== ziel.width || q.height !== ziel.height) { q.width = ziel.width; q.height = ziel.height; }
      const qq = q.getContext('2d'); qq.setTransform(1, 0, 0, 1, 0, 0); qq.clearRect(0, 0, q.width, q.height); qq.drawImage(ziel, 0, 0);
      qq.globalCompositeOperation = 'multiply'; qq.fillStyle = K ? K.abendTon() : '#9aa3c7'; qq.fillRect(0, 0, q.width, q.height);
      qq.globalCompositeOperation = 'destination-in'; qq.drawImage(ziel, 0, 0); qq.globalCompositeOperation = 'source-over';
      g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(q, 0, 0);
    }
    // Auswahl: weicher Ring am Gebäude
    if (A.auswahl) { const q = A.auswahl.q, ph = ((performance.now() - A.auswahl.t) / 900) % 1, ax = q.anker.x * BW * V.k + V.tx, ay = q.anker.y * BH * V.k + V.ty;
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.strokeStyle = 'rgba(255,255,255,' + (1 - ph).toFixed(2) + ')'; g.lineWidth = 3; g.beginPath(); g.arc(ax, ay, 8 + ph * 16, 0, 7); g.stroke();
      if (A.pille) { A.pille.style.left = ax + 'px'; A.pille.style.top = (ay - 12) + 'px'; } }
    if (K) {
      g.setTransform(SK * dpr, 0, 0, SK * dpr, 0, 0);
      K.flugzeug(g, 720, t, an.banner, hell(V2.a) < 0.72 ? V2.a : '#2d2f38', lage.abend);
      if (an.titel) K.konfetti(g, 720, vh / SK, t, [V2.a, V2.b, '#ffd23f', '#ffffff']);
      const schneit = !!(K.ZEITEN[lage.zeit] && K.ZEITEN[lage.zeit].schnee);
      if (schneit) K.schnee(g, 720, vh / SK, t); else if (an.wetter === 'regen') K.regen(g, 720, vh / SK, t);
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
  }
  function schleife(A, Z) {
    const takt = t => { const dt = L.t == null ? 0 : Math.max(0, Math.min(0.1, t - L.t)); if (dt && L.letzte !== t) { sim(dt); L.letzte = t; } L.t = t; if (A.cv.isConnected) malen(A, Z, t); };
    if (Z.K) Z.K.animiere(A.cv, takt);
    else { const r = ts => { if (!A.cv.isConnected) return; takt(ts / 1000); requestAnimationFrame(r); }; requestAnimationFrame(r); }
  }
  function vollbild(Z) {
    const o = document.createElement('div'); o.className = 'gel6-voll'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-label', 'Vereinsgelände');
    o.innerHTML = `<canvas></canvas><div class="gel6-pille" hidden></div>
      <button type="button" class="gel6-knopf gel6-zu" aria-label="Schließen"><i class="ti ti-x" aria-hidden="true"></i></button>
      <div class="gel6-zoom"><button type="button" class="gel6-knopf" data-z="1.35" aria-label="Näher"><i class="ti ti-plus" aria-hidden="true"></i></button>
      <button type="button" class="gel6-knopf" data-z="0.74" aria-label="Weiter weg"><i class="ti ti-minus" aria-hidden="true"></i></button></div>`;
    document.body.appendChild(o);
    const A = ansicht(o.querySelector('canvas'), true); A.pille = o.querySelector('.gel6-pille'); A.start();
    bedienung(A, o, Z.daten, A.pille);
    o.querySelector('.gel6-zu').onclick = () => o.remove();
    o.querySelectorAll('[data-z]').forEach(b => b.onclick = () => A.zoomUm(+b.dataset.z, A.vw / 2, A.vh / 2));
    window.addEventListener('resize', () => { if (o.isConnected) { const k = A.V.k / A.kMin(); A.groesse(); A.V.k = A.kMin() * k; A.begrenzen(); } });
    schleife(A, Z);
  }
  async function zeichne(el) {
    if (!el) return;
    const s = stufe();
    const ib = typeof window.infoKarteSetzen === 'function';
    if (ib) window.infoKarteSetzen('gelaende', 'Vereinsgelände', `Ausbau ${s} von 5. Das Gelände wächst mit der kleinsten Stufe aus Stadion, Training, Scouting und Fanshop.`);
    el.innerHTML = `<div class="gel-buehne gel6" style="aspect-ratio:8 / 5"><canvas role="img" aria-label="Vereinsgelände, Ausbau ${s} von 5"></canvas>
      <div class="gel6-pille" hidden></div>
      ${ib ? `<button type="button" class="gel-info" onclick="toggleInfoCard(event,'gelaende')" aria-label="Vereinsgelände"><i class="ti ti-info-circle" aria-hidden="true"></i></button>` : ''}
      <button type="button" class="gel6-knopf gel6-gross" aria-label="Gelände vergrößern"><i class="ti ti-arrows-maximize" aria-hidden="true"></i></button></div>`;
    const Z = await laden();
    const cv = el.querySelector('canvas');
    if (!Z || !cv || !cv.isConnected) return;
    const A = ansicht(cv, false); A.pille = el.querySelector('.gel6-pille'); A.start();
    bedienung(A, el, Z.daten, A.pille);
    el.querySelector('.gel6-gross').onclick = () => vollbild(Z);
    schleife(A, Z);
  }

  // CSS (eigene Klassen; Flächen aus Tokens)
  if (!document.getElementById('dfl-gelaende6-css')) {
    const css = document.createElement('style'); css.id = 'dfl-gelaende6-css';
    css.textContent = `.gel6 canvas{width:100%;height:100%;display:block;cursor:pointer}
.gel6-pille{position:absolute;transform:translate(-50%,-100%);background:var(--bg2);color:var(--text);border:2px solid var(--k-rand);
  border-radius:12px;padding:3px 10px;font-weight:600;font-size:13px;white-space:nowrap;box-shadow:0 2px 0 var(--k-rand);cursor:pointer;z-index:3}
.gel6-pille i{font-size:12px;vertical-align:-1px}
.gel6-knopf{width:34px;height:34px;border-radius:10px;border:2px solid var(--k-rand);background:var(--bg2);color:var(--text);
  display:grid;place-items:center;padding:0;cursor:pointer;box-shadow:0 2px 0 var(--k-rand)}
.gel6-gross{position:absolute;right:8px;bottom:8px;z-index:2}
.gel6-voll{position:fixed;inset:0;z-index:9300;background:var(--bg,#efe3c9);padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}
.gel6-voll canvas{width:100%;height:100%;display:block;touch-action:none}
.gel6-zu{position:absolute;right:12px;top:calc(12px + env(safe-area-inset-top,0px))}
.gel6-zoom{position:absolute;right:12px;bottom:calc(16px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;gap:8px}`;
    document.head.appendChild(css);
  }
  DFLGelaende.zeichne = zeichne;
  // Ausschnitt einer Anlage aus dem fertigen Gelände (Vereinsfarben, Ausbaustufe) als Canvas – z. B. das Stadion bei der
  // Wahl des Stadionnamens (Nutzer 2026-10-17: „beim Stadionnamen das tatsächliche Stadion sehen“)
  async function ausschnitt(ziel, rand) {
    const Z = zustand || await laden();
    const r = Z && Z.daten && Z.daten.ziele && Z.daten.ziele[ziel];
    if (!r || !Z.gel) return null;
    const m = rand == null ? 0.12 : rand, w = (r.x1 - r.x0) * BW, h = (r.y1 - r.y0) * BH;
    const x0 = Math.max(0, r.x0 * BW - w * m), y0 = Math.max(0, r.y0 * BH - h * m), x1 = Math.min(BW, r.x1 * BW + w * m), y1 = Math.min(BH, r.y1 * BH + h * m);
    const c = leinwand(Math.round(x1 - x0), Math.round(y1 - y0));
    c.getContext('2d').drawImage(Z.gel, x0, y0, x1 - x0, y1 - y0, 0, 0, c.width, c.height);
    return c;
  }
  DFLGelaende.v6 = { stufe, key, welt, sim, ausschnitt, rund: stadionRund, fahrzeuge: () => L.fz, fans: () => L.fans,
    extra(e) { if (e && EXTRAS.indexOf(e) < 0) EXTRAS.push(e); }, KO, PRO_EINHEIT, BW, BH, zustand: () => zustand };
  console.log('[DFL-Gelände v6] aktiv — ' + Object.keys(D6.bilder).length + ' Gelände (Stadtgröße × Stufe 1–5), Ebenen, Verkehr geradeaus auf 2 Straßen, Vereinsname, Vollbild mit Zoom');
})();
