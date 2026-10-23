/* ═══════════════════════════════════════════════════════════════════════════
   DFL · KULISSE  ·  v3   (D52, freigegeben 2026-10-09: „Office mit Jahreszeiten feier ich“)
   ─────────────────────────────────────────────────────────────────────────
   Himmel, Wolken, Berge, Hügel und eine Baumreihe hinter dem Vereinsgelände (dfl_gelaende.js) und das
   Startbild der Vereinswahl. Bilder: Kenney „Background Elements Remastered“ (CC0) in app/kulisse/.
   Die Ebenen sind einfarbige Flächen und werden im Canvas getönt – ein Bildersatz für alle Jahreszeiten.

     Jahreszeit nach Kalendermonat:  Jul–Aug Sommer · Sep–Nov Herbst · Dez–Feb Winter (Schnee) · Mär–Jun Frühling
     Abend mit Mond und Flutlicht in jeder Woche mit eigenem Heimspiel (Liga oder Playoffs)

   v2 (D53, 2026-10-09): Silhouette der eigenen Stadt am Horizont – Kleinstadt mit Giebeln und Kirchtürmen,
   normale Stadt mit Blöcken und Turm, Großstadt mit Hochhäusern, Fernsehturm und Kränen (Form aus dem Stadtnamen,
   abends Fensterlichter); Hintergrund in Ebenen (Himmel · Wolken · Land), damit das Gelände das Land
   zwischenspeichern kann. Bäume der Jahreszeit im Startbild.
   v3 (2026-10-09, „bau mal alles ein“): Region am Horizont (Hafenkräne und Schiff · Fördertürme, Schlot, Halde ·
   Alpen · Bogenbrücke; Feld region in data/league.json), Wetter nach Form (Sonne bei Siegesserie, Regen in der
   Krise), Flugzeug mit Banner des Trikotsponsors, Abend auch nach der echten Uhr (19–6 Uhr; Flutlicht nur beim
   Heimspiel), Feuerwerk und Konfetti für die Titelfeier.

   Ohne getImageData (läuft auch über file:// im Offline-ZIP). Animation nur, solange das Bild sichtbar ist;
   bei „Bewegung reduzieren“ ein Standbild.
   API: DFLKulisse.lage() → { zeit, abend, heimspiel, monat } · .himmelEbene / .wolken / .landEbene / .zeichneHintergrund(g, W, H, opt)
        opt: { zeit, abend, stadt, name, region, wetter: 'sonne'|'regen'|null } · .regen · .flugzeug · .feuerwerk · .konfetti
        .gelaendeTon(zeit) · .abendTon() · .flutlicht(…) · .schnee(…) · .animiere(canvas, zeichne) · .laden()
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // Volle Pfade als Text: sw.js liest sie aus dieser Datei und legt sie in den Offline-Cache
  const BILDER = {
    hills: 'app/kulisse/hills.png', hillsLarge: 'app/kulisse/hillsLarge.png', mountains: 'app/kulisse/mountains.png',
    sun: 'app/kulisse/sun.png', moonFull: 'app/kulisse/moonFull.png',
    cloud1: 'app/kulisse/cloud1.png', cloud3: 'app/kulisse/cloud3.png', cloud5: 'app/kulisse/cloud5.png', cloud7: 'app/kulisse/cloud7.png',
    tree: 'app/kulisse/tree.png', treePine: 'app/kulisse/treePine.png', treeLong: 'app/kulisse/treeLong.png',
    treeOrange: 'app/kulisse/treeOrange.png', treePineOrange: 'app/kulisse/treePineOrange.png', treeLongOrange: 'app/kulisse/treeLongOrange.png',
    treeSnow: 'app/kulisse/treeSnow.png', treePineSnow: 'app/kulisse/treePineSnow.png', treeLongSnow: 'app/kulisse/treeLongSnow.png',
    house1: 'app/kulisse/house1.png', house2: 'app/kulisse/house2.png', houseAlt1: 'app/kulisse/houseAlt1.png',
    houseSmall1: 'app/kulisse/houseSmall1.png', houseSmallAlt1: 'app/kulisse/houseSmallAlt1.png',
    tower: 'app/kulisse/tower.png', castleSmall: 'app/kulisse/castleSmall.png'
  };
  const B = {};
  let ladeVersprechen = null;
  function laden() {
    if (!ladeVersprechen) ladeVersprechen = Promise.all(Object.entries(BILDER).map(([n, src]) => new Promise(ok => {
      const i = new Image(); i.decoding = 'async';
      i.onload = () => { B[n] = i; ok(); }; i.onerror = () => ok(); i.src = src;
    })));
    return ladeVersprechen;
  }

  const ZEITEN = {
    sommer:    { himmel: ['#7cc4f2', '#cdeefc'], berge: '#a9d4ec', stadt: '#93b9d3', fern: '#9fd0a8', nah: '#6cc56b', boden: '#57b35a', baum: ['tree', 'treePine', 'treeLong'] },
    herbst:    { himmel: ['#86b9e0', '#f3e2c6'], berge: '#b4cde0', stadt: '#a3b9cc', fern: '#d9a76a', nah: '#c9873f', boden: '#b8793a', baum: ['treeOrange', 'treePineOrange', 'treeLongOrange'], ton: ['#c98b45', 0.3] },
    winter:    { himmel: ['#9db6cc', '#e7eef4'], berge: '#cbd8e3', stadt: '#a9bccc', fern: '#e8eef3', nah: '#f4f7fa', boden: '#e6edf2', baum: ['treeSnow', 'treePineSnow', 'treeLongSnow'], ton: ['#f4f8fb', 0.62], schnee: true },
    fruehling: { himmel: ['#73c2f0', '#e2f6ff'], berge: '#a4d2ee', stadt: '#8fb8d6', fern: '#a8dc8c', nah: '#7fd36f', boden: '#6cc35d', baum: ['tree', 'treePine', 'treeLong'] }
  };
  const ABEND = { himmel: ['#18264a', '#4d3f6b'], berge: '#3a4470', stadt: '#2c3760', fern: '#2f3f5e', nah: '#29384f', boden: '#223046', dunkel: 'rgba(22,26,58,.42)' };
  // Monat 0 = Juli … 11 = Juni (wie calendarMonthOfWeek)
  const ZEIT_JE_MONAT = ['sommer', 'sommer', 'herbst', 'herbst', 'herbst', 'winter', 'winter', 'winter', 'fruehling', 'fruehling', 'fruehling', 'fruehling'];

  function monatIndex(woche) {
    const sw = typeof SEASON_WEEKS === 'number' ? SEASON_WEEKS : 52;
    return Math.max(0, Math.min(11, Math.floor((woche - 1) / (sw / 12))));
  }
  function heimspielDieseWoche() {
    try {
      const po = window.DFLPlayoffs && DFLPlayoffs.faellig && DFLPlayoffs.faellig();
      if (po) return (DFLPlayoffs.gastgeber ? DFLPlayoffs.gastgeber(po) : po.heim) === 'fcm';      // D166: Hinspiel beim schlechteren Seed
      if (typeof seasonFullyComplete === 'function' && seasonFullyComplete(LEAGUE)) return false;
      const n = typeof fcmNextFixture === 'function' ? fcmNextFixture(LEAGUE) : null;
      return !!(n && n.isHome && Array.isArray(LEAGUE.matchWeeks) && LEAGUE.matchWeeks[LEAGUE.matchday] === LEAGUE.week);
    } catch (e) { return false; }
  }
  // Echte Uhr: zwischen 19 und 6 Uhr ist es auch ohne Heimspiel Abend (Flutlicht und Fans nur beim Heimspiel)
  const uhrAbend = () => { const h = new Date().getHours(); return h >= 19 || h < 6; };
  // Wo steht der Verein im Jahr? → { zeit, abend, heimspiel, monat (0 = Juli … 5 = Dezember … 11 = Juni) }
  function lage() {
    if (typeof LEAGUE === 'undefined' || !LEAGUE || !LEAGUE.week) return { zeit: ZEIT_JE_MONAT[(new Date().getMonth() + 6) % 12], abend: false, heimspiel: false, monat: -1 };
    const m = monatIndex(LEAGUE.week), heim = heimspielDieseWoche();
    return { zeit: ZEIT_JE_MONAT[m], abend: heim || uhrAbend(), heimspiel: heim, monat: m };
  }

  // Getönte Ebene (Form bleibt, der helle Rand scheint leicht durch); zwischengespeichert
  const tonCache = new Map();
  function getoent(img, farbe, staerke) {
    const key = img.src + '|' + farbe + '|' + staerke;
    let c = tonCache.get(key);
    if (!c) {
      c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const o = c.getContext('2d'); o.drawImage(img, 0, 0);
      o.globalCompositeOperation = 'source-atop'; o.globalAlpha = staerke; o.fillStyle = farbe; o.fillRect(0, 0, c.width, c.height);
      tonCache.set(key, c);
    }
    return c;
  }
  function himmel(g, W, H, farben) {
    const v = g.createLinearGradient(0, 0, 0, H); v.addColorStop(0, farben[0]); v.addColorStop(1, farben[1]);
    g.fillStyle = v; g.fillRect(0, 0, W, H);
  }

  // ── Stadt am Horizont (D53) ───────────────────────────────────────────────
  // Gleiche Stadt → gleiche Silhouette (Form aus dem Namen); 720 breit, Grundlinie y
  function zufall(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function seedVon(text) { let h = 2166136261; for (const c of String(text)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
  const FORMEN = new Map();
  function stadtFormen(groesse, seed) {
    const key = groesse + '|' + seed;
    if (FORMEN.has(key)) return FORMEN.get(key);
    const r = zufall(seed), f = [];
    const haus = (x, w, h, dach) => f.push({ t: 'haus', x, w, h, dach });
    if (groesse === 'klein') {
      const frei = x => x < 250 || x > 470;      // hinter dem Stadion sieht man ohnehin nichts
      let x = 10; while (x < 720) { if (frei(x)) haus(x, 18 + r() * 14, 10 + r() * 10, 'giebel'); x += 26 + r() * 40; }
      f.push({ t: 'kirche', x: 120 + r() * 60, h: 52 }, { t: 'kirche', x: 560 + r() * 60, h: 40 });
    } else if (groesse === 'normal') {
      let x = 0; while (x < 720) { const blk = r() < 0.35; haus(x, blk ? 24 + r() * 16 : 18 + r() * 12, blk ? 30 + r() * 34 : 14 + r() * 14, blk ? 'flach' : 'giebel'); x += (blk ? 22 : 16) + r() * 18; }
      f.push({ t: 'kirche', x: 90 + r() * 80, h: 70 }, { t: 'turm', x: 560 + r() * 80, h: 64 });
    } else {
      let x = 0; while (x < 720) { const hoch = r() < 0.55; haus(x, hoch ? 20 + r() * 22 : 26 + r() * 18, hoch ? 60 + r() * 90 : 26 + r() * 30, hoch && r() < 0.3 ? 'spitz' : 'flach'); x += (hoch ? 18 : 22) + r() * 14; }
      f.push({ t: 'fernsehturm', x: 150 + r() * 60, h: 175 }, { t: 'kran', x: 520 + r() * 40, h: 120 }, { t: 'kran', x: 640 + r() * 40, h: 104 });
    }
    FORMEN.set(key, f);
    return f;
  }
  function stadtZeichnen(g, formen, y, farbe, nacht, rng) {
    g.fillStyle = farbe;
    formen.forEach(s => {
      if (s.t === 'haus') {
        g.fillRect(s.x, y - s.h, s.w, s.h);
        if (s.dach === 'giebel') { g.beginPath(); g.moveTo(s.x - 2, y - s.h); g.lineTo(s.x + s.w / 2, y - s.h - s.w * 0.45); g.lineTo(s.x + s.w + 2, y - s.h); g.fill(); }
        if (s.dach === 'spitz') { g.beginPath(); g.moveTo(s.x, y - s.h); g.lineTo(s.x + s.w / 2, y - s.h - 16); g.lineTo(s.x + s.w, y - s.h); g.fill(); }
      } else if (s.t === 'kirche') {
        g.fillRect(s.x, y - s.h * 0.45, 30, s.h * 0.45); g.fillRect(s.x + 22, y - s.h, 12, s.h);
        g.beginPath(); g.moveTo(s.x + 20, y - s.h); g.lineTo(s.x + 28, y - s.h - 22); g.lineTo(s.x + 36, y - s.h); g.fill();
      } else if (s.t === 'turm') {
        g.fillRect(s.x, y - s.h, 16, s.h); g.fillRect(s.x - 3, y - s.h - 6, 22, 6);
        for (let i = 0; i < 4; i++) g.fillRect(s.x - 3 + i * 6, y - s.h - 11, 4, 5);
      } else if (s.t === 'fernsehturm') {
        g.fillRect(s.x - 4, y - s.h, 8, s.h); g.beginPath(); g.arc(s.x, y - s.h * 0.72, 12, 0, 7); g.fill();
        g.fillRect(s.x - 1.5, y - s.h - 28, 3, 28);
        if (nacht) { g.fillStyle = 'rgba(255,80,80,.9)'; g.beginPath(); g.arc(s.x, y - s.h - 28, 2.5, 0, 7); g.fill(); g.fillStyle = farbe; }
      } else if (s.t === 'kran') {
        g.fillRect(s.x, y - s.h, 5, s.h); g.fillRect(s.x - 50, y - s.h, 76, 4); g.fillRect(s.x + 16, y - s.h + 4, 8, 8);
        g.fillRect(s.x - 40, y - s.h + 4, 1.5, 30);
      }
    });
    if (nacht) {                                   // Lichter in den Fenstern
      g.fillStyle = 'rgba(255,214,122,.85)';
      formen.forEach(s => {
        if (s.t !== 'haus' || s.h < 18) return;
        const n = Math.floor(s.h * s.w / 90);
        for (let i = 0; i < n; i++) if (rng() < 0.55) g.fillRect(s.x + 3 + Math.floor(rng() * (s.w - 6) / 5) * 5, y - s.h + 4 + Math.floor(rng() * (s.h - 8) / 6) * 6, 2.4, 2.6);
      });
    }
  }

  // ── Region am Horizont (v3): flache Silhouetten in der Farbe der Stadt ────
  function hafenkran(g, x, y, h, f) {
    g.fillStyle = f; g.strokeStyle = f;
    g.fillRect(x, y - h, 4, h); g.fillRect(x + 26, y - h, 4, h); g.fillRect(x - 4, y - h - 4, 38, 5);
    g.fillRect(x - 34, y - h - 1, 96, 3); g.fillRect(x + 8, y - h - 12, 14, 8);
    g.lineWidth = 2; g.beginPath(); g.moveTo(x - 30, y - h); g.lineTo(x + 15, y - h - 24); g.lineTo(x + 58, y - h); g.stroke();
  }
  function schiff(g, x, y, f, ab) {
    g.fillStyle = f;
    g.beginPath(); g.moveTo(x, y - 16); g.lineTo(x + 170, y - 16); g.lineTo(x + 160, y - 2); g.lineTo(x + 8, y - 2); g.closePath(); g.fill();
    g.fillRect(x + 140, y - 40, 18, 24); g.fillRect(x + 146, y - 50, 5, 10);
    const C = ['#c4785c', '#6d8fae', '#cfa95a', '#86a273', '#b05f5f'];
    for (let r = 0; r < 3; r++) for (let i = 0; i < 9 - r; i++) {
      g.fillStyle = ab ? f : C[(i * 3 + r * 2) % C.length]; g.globalAlpha = ab ? 1 : 0.55;
      g.fillRect(x + 14 + i * 13 + r * 4, y - 26 - r * 9, 12, 8);
    }
    g.globalAlpha = 1;
  }
  function foerderturm(g, x, y, h, f) {
    g.fillStyle = f; g.strokeStyle = f;
    g.fillRect(x, y - h, 6, h); g.fillRect(x - 6, y - h + 2, 22, 4);
    g.lineWidth = 3; g.beginPath(); g.moveTo(x + 4, y - h + 6); g.lineTo(x + 30, y); g.stroke();
    g.lineWidth = 2;
    [x - 1, x + 9].forEach(cx => {
      g.beginPath(); g.arc(cx, y - h - 6, 8, 0, 7); g.stroke();
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 4; g.beginPath(); g.moveTo(cx - Math.cos(a) * 8, y - h - 6 - Math.sin(a) * 8); g.lineTo(cx + Math.cos(a) * 8, y - h - 6 + Math.sin(a) * 8); g.stroke(); }
    });
  }
  function schlot(g, x, y, h, f) { g.fillStyle = f; g.fillRect(x, y - h, 8, h); g.fillRect(x - 2, y - h, 12, 4); g.fillRect(x - 1, y - h * 0.55, 10, 3); }
  function halde(g, x, y, w, h, f) { g.fillStyle = f; g.beginPath(); g.moveTo(x, y); g.lineTo(x + w * 0.3, y - h); g.lineTo(x + w * 0.7, y - h); g.lineTo(x + w, y); g.closePath(); g.fill(); }
  function bruecke(g, x0, x1, y, f) {
    g.fillStyle = f; g.strokeStyle = f;
    const n = 3, sp = (x1 - x0) / n, deck = y - 14;
    g.fillRect(x0, deck, x1 - x0, 4);
    for (let i = 0; i <= n; i++) g.fillRect(x0 + i * sp - 3, deck, 6, y - deck);
    for (let i = 0; i < n; i++) {
      const cx = x0 + (i + 0.5) * sp;
      g.lineWidth = 3; g.beginPath(); g.ellipse(cx, deck, sp / 2 - 4, 24, 0, Math.PI, 2 * Math.PI); g.stroke();
      g.lineWidth = 1.2;
      for (let x = cx - sp / 2 + 10; x < cx + sp / 2 - 8; x += 9) { const dy = 24 * Math.sqrt(Math.max(0, 1 - Math.pow((x - cx) / (sp / 2 - 4), 2))); g.beginPath(); g.moveTo(x, deck - dy); g.lineTo(x, deck); g.stroke(); }
    }
  }
  function alpen(g, f, kappe) {
    const P = [[-20, 160], [30, 58], [80, 112], [140, 36], [205, 98], [262, 56], [318, 118], [380, 42], [440, 104], [505, 30], [570, 96], [628, 52], [690, 112], [760, 160]];
    g.fillStyle = f; g.beginPath(); g.moveTo(-20, 210); P.forEach(([x, y]) => g.lineTo(x, y)); g.lineTo(760, 210); g.closePath(); g.fill();
    g.fillStyle = kappe;
    for (let i = 1; i < P.length - 1; i++) {
      const [x, y] = P[i]; if (y > P[i - 1][1] || y > P[i + 1][1]) continue;
      const l = P[i - 1], r = P[i + 1], k = 0.32;
      const lx = x + (l[0] - x) * k, ly = y + (l[1] - y) * k, rx = x + (r[0] - x) * k, ry = y + (r[1] - y) * k;
      g.beginPath(); g.moveTo(x, y); g.lineTo(rx, ry); g.lineTo((x + rx) / 2, (y + ry) / 2 + 7); g.lineTo(x, ly + 4); g.lineTo((x + lx) / 2, (y + ly) / 2 + 8); g.lineTo(lx, ly); g.closePath(); g.fill();
    }
  }
  function dunkler(hex, k) {
    const n = parseInt(hex.slice(1), 16), m = c => Math.round(c * (1 - k));
    return '#' + [n >> 16 & 255, n >> 8 & 255, n & 255].map(m).map(c => c.toString(16).padStart(2, '0')).join('');
  }
  function regionZeichnen(g, region, y, f, ab) {
    if (region === 'hafen') { schiff(g, 24, y - 2, f, ab); hafenkran(g, 520, y, 64, f); hafenkran(g, 600, y, 74, f); hafenkran(g, 672, y, 60, f); }
    else if (region === 'zechen') { foerderturm(g, 70, y, 72, f); schlot(g, 140, y, 98, f); halde(g, 490, y, 110, 34, f); foerderturm(g, 615, y, 64, f); schlot(g, 682, y, 84, f); }
    else if (region === 'fluss') bruecke(g, 488, 716, y, f);
  }

  // ── Hintergrund für das Gelände (720 breit, Gelände ab y = 96) ─────────────
  // In drei Ebenen, damit das Gelände Himmel und Land zwischenspeichern kann und je Bild nur die Wolken neu zeichnet.
  // opt: { zeit, abend, stadt: 'klein'|'normal'|'gross', name } (ohne stadt: keine Silhouette)
  function himmelEbene(g, W, H, opt) {
    const k = ZEITEN[opt.zeit] || ZEITEN.sommer, ab = !!opt.abend, wetter = opt.wetter;
    himmel(g, W, H, ab ? ABEND.himmel : k.himmel);
    if (ab) {
      g.fillStyle = ABEND.dunkel; g.fillRect(0, 0, W, H);
      if (wetter !== 'regen') {
        if (B.moonFull) g.drawImage(B.moonFull, W - 150, 18, 56, 58);
        g.fillStyle = 'rgba(255,255,255,.75)';
        for (let i = 0; i < 26; i++) g.fillRect((i * 131) % W, (i * 37) % 130, 2, 2);
      }
    } else if (wetter === 'sonne') {                 // Siegesserie: große Sonne mit Schein und Strahlen
      const v = g.createRadialGradient(92, 48, 10, 92, 48, 170);
      v.addColorStop(0, 'rgba(255,236,170,.75)'); v.addColorStop(1, 'rgba(255,236,170,0)');
      g.fillStyle = v; g.fillRect(0, 0, 280, 230);
      g.fillStyle = 'rgba(255,240,190,.35)';
      for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; g.beginPath(); g.moveTo(92, 48); g.lineTo(92 + Math.cos(a - 0.07) * 130, 48 + Math.sin(a - 0.07) * 130); g.lineTo(92 + Math.cos(a + 0.07) * 130, 48 + Math.sin(a + 0.07) * 130); g.closePath(); g.fill(); }
      if (B.sun) g.drawImage(B.sun, 50, 6, 84, 84);
    } else if (wetter !== 'regen' && B.sun) g.drawImage(B.sun, 60, 16, 64, 64);
    if (wetter === 'regen') { g.fillStyle = ab ? 'rgba(14,18,34,.35)' : 'rgba(92,102,118,.45)'; g.fillRect(0, 0, W, H); }   // Krise: grau verhangen
  }
  const WOLKEN = [['cloud1', 0, 26, .5], ['cloud5', 300, 70, .4], ['cloud3', 540, 8, .46], ['cloud7', 820, 96, .36]];
  const REGENWOLKEN = WOLKEN.concat([['cloud3', 150, 40, .6], ['cloud1', 430, 20, .62], ['cloud7', 690, 56, .55]]);
  function wolken(g, W, opt, t) {
    const ab = !!opt.abend, regen = opt.wetter === 'regen', breit = W + 260, versatz = ((t || 0) * (regen ? 14 : 9)) % breit;
    (regen ? REGENWOLKEN : WOLKEN).forEach(([n, x0, y, s]) => {
      const im = B[n]; if (!im) return;
      g.globalAlpha = ab ? (regen ? 0.6 : 0.35) : 0.95;
      g.drawImage(regen ? getoent(im, ab ? '#20253d' : '#6f7884', 0.6) : ab ? getoent(im, '#161a3a', 0.42) : im, ((x0 + versatz) % breit) - 200, y, im.width * s, im.height * s);
      g.globalAlpha = 1;
    });
  }
  // Regen ohne Zustand (wie der Schnee): schräge Striche
  function regen(g, W, H, t) {
    g.strokeStyle = 'rgba(205,218,238,.55)'; g.lineWidth = 1.2; g.beginPath();
    for (let i = 0; i < 110; i++) {
      const v = 260 + (i % 5) * 40, y = ((i * 71) % H + t * v) % (H + 20) - 10, x = ((i * 113) % (W + 40)) - 20 - (y * 0.18);
      g.moveTo(x, y); g.lineTo(x - 3, y + 11);
    }
    g.stroke();
  }
  // Flugzeug mit Banner (alle 40 s, 16 s lang) – fliegt über dem Gelände nach links
  function flugzeug(g, W, t, text, farbe, ab) {
    const P = 40, D = 16, ph = (t || 0) % P; if (!t || ph > D) return;
    const x = W + 40 - ph / D * (W + 380), y = 66 + Math.sin(t * 0.9) * 2;      // unter dem Stufen-Schild
    g.save();
    g.fillStyle = ab ? '#aeb5c9' : '#f7f7f5'; g.strokeStyle = ab ? '#6c7389' : '#9aa1ab'; g.lineWidth = 1;
    g.beginPath(); g.ellipse(x, y, 17, 3.6, 0, 0, 7); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(x - 2, y); g.lineTo(x + 6, y + 9); g.lineTo(x + 10, y + 9); g.lineTo(x + 6, y); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(x + 12, y - 1); g.lineTo(x + 17, y - 9); g.lineTo(x + 19, y - 9); g.lineTo(x + 17, y); g.closePath(); g.fill(); g.stroke();
    if (ab && Math.floor(t * 2) % 2) { g.fillStyle = '#ff4d4d'; g.beginPath(); g.arc(x + 8, y + 9, 1.6, 0, 7); g.fill(); }
    g.font = '800 10px system-ui, sans-serif';
    const bw = Math.ceil(g.measureText(text).width) + 16, bx = x + 34, by = y - 6;
    g.strokeStyle = ab ? 'rgba(180,186,205,.6)' : 'rgba(90,90,90,.6)'; g.beginPath(); g.moveTo(x + 17, y); g.lineTo(bx, by + 6); g.stroke();
    g.beginPath(); g.moveTo(bx, by);
    for (let i = 0; i <= 10; i++) g.lineTo(bx + bw * i / 10, by + Math.sin(t * 6 + i * 0.8) * 1.2);
    for (let i = 10; i >= 0; i--) g.lineTo(bx + bw * i / 10, by + 13 + Math.sin(t * 6 + i * 0.8) * 1.2);
    g.closePath(); g.fillStyle = ab ? '#c9cede' : '#ffffff'; g.fill(); g.strokeStyle = farbe; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = farbe; g.textBaseline = 'middle'; g.fillText(text, bx + 8, by + 7);
    g.restore();
  }
  // Titelfeier: Feuerwerk (ohne Zustand, jede Rakete aus t berechnet) und Konfetti
  function feuerwerk(g, W, H, t, farben) {
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
      const P = 2.6 + (i % 3) * 0.6, u = (t || 0) + i * 1.37, ph = (u % P) / P, r = zufall(seedVon('fw' + i + ':' + Math.floor(u / P)));
      const x = 60 + r() * (W - 120), yz = 34 + r() * 90, f = farben[Math.floor(r() * farben.length)] || '#ffd23f';
      if (ph < 0.28) { const yy = H * 0.5 - (H * 0.5 - yz) * (ph / 0.28); g.fillStyle = 'rgba(255,230,170,.9)'; g.fillRect(x - 1, yy, 2, 6); continue; }
      const p = (ph - 0.28) / 0.72, rad = 6 + p * 46;
      g.globalAlpha = Math.max(0, 1 - p); g.fillStyle = f;
      for (let k = 0; k < 24; k++) { const a = k * Math.PI / 12 + i; g.beginPath(); g.arc(x + Math.cos(a) * rad, yz + Math.sin(a) * rad + p * p * 14, 2.1, 0, 7); g.fill(); }
      g.globalAlpha = 1;
    }
    g.restore();
  }
  function konfetti(g, W, H, t, farben) {
    for (let i = 0; i < 70; i++) {
      const v = 30 + (i % 6) * 9, y = ((i * 53) % H + (t || 0) * v) % (H + 12) - 6, x = ((i * 97) % W) + Math.sin((t || 0) * 1.4 + i) * 10;
      g.save(); g.translate(x, y); g.rotate((t || 0) * 3 + i); g.fillStyle = farben[i % farben.length]; g.fillRect(-2.5, -1.4, 5, 2.8); g.restore();
    }
  }
  // Berge, Stadt, Hügel und Boden; abends gedämpft. Auf eine eigene (leere) Fläche zeichnen – die Dämpfung trifft alles, was schon darauf liegt.
  function landEbene(g, W, H, opt) {
    const k = ZEITEN[opt.zeit] || ZEITEN.sommer, ab = !!opt.abend;
    if (opt.region === 'alpen') alpen(g, ab ? '#2f3862' : opt.zeit === 'winter' ? '#b9c8d6' : '#9cbcd4', ab ? '#8f97b8' : '#f7fafc');
    if (B.mountains) g.drawImage(getoent(B.mountains, ab ? ABEND.berge : k.berge, 0.85), -40, 40, 800, 312);
    if (opt.stadt) {
      const seed = seedVon((opt.name || '') + opt.stadt);
      stadtZeichnen(g, stadtFormen(opt.stadt, seed), 200, ab ? ABEND.stadt : k.stadt, ab, zufall(seed + 7));
    }
    if (opt.region) regionZeichnen(g, opt.region, 200, dunkler(ab ? ABEND.stadt : k.stadt, 0.16), ab);      // etwas dunkler: steht vor der Stadt
    if (B.hillsLarge) g.drawImage(getoent(B.hillsLarge, ab ? ABEND.fern : k.fern, 0.92), -60, 170, 840, 330);
    if (B.hills) g.drawImage(getoent(B.hills, ab ? ABEND.nah : k.nah, 0.95), -40, 236, 800, 312);
    g.fillStyle = ab ? ABEND.nah : k.nah; g.fillRect(0, 456, W, H - 456);     // wie die vorderen Hügel, ohne Kante
    if (ab) { g.save(); g.globalCompositeOperation = 'source-atop'; g.fillStyle = ABEND.dunkel; g.fillRect(0, 0, W, H); g.restore(); }
  }
  // Alles auf einmal (ohne Zwischenspeicher)
  function zeichneHintergrund(g, W, H, opt) {
    himmelEbene(g, W, H, opt); wolken(g, W, opt, opt.t);
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    landEbene(c.getContext('2d'), W, H, opt); g.drawImage(c, 0, 0);
  }
  // Tönung für den Boden des Geländes (Herbstlaub, Schnee) – oder null
  function gelaendeTon(zeit) { const k = ZEITEN[zeit]; return k && k.ton ? { farbe: k.ton[0], staerke: k.ton[1] } : null; }
  // Abends wird das Gelände bläulich gedämpft (multiply), das Flutlicht hellt das Stadion wieder auf
  function abendTon() { return '#9aa3c7'; }
  function flutlicht(g, punkte) {
    g.save(); g.globalCompositeOperation = 'screen';
    punkte.forEach(([x, y, r]) => {
      const v = g.createRadialGradient(x, y, 0, x, y, r);
      v.addColorStop(0, 'rgba(255,236,180,.34)'); v.addColorStop(1, 'rgba(255,236,180,0)');
      g.fillStyle = v; g.fillRect(x - r, y - r, r * 2, r * 2);
    });
    g.restore();
  }
  // Schnee ohne Zustand: Lage jeder Flocke folgt aus t
  function schnee(g, W, H, t) {
    g.fillStyle = 'rgba(255,255,255,.9)';
    for (let i = 0; i < 70; i++) {
      const v = 18 + (i % 7) * 6, y = ((i * 53) % H + t * v) % (H + 8) - 4;
      const x = ((i * 97) % W) + Math.sin(y / 30 + i) * 3;
      g.beginPath(); g.arc(x, y, (1.2 + (i % 3) * 0.7) * 1.6, 0, 7); g.fill();
    }
  }

  // ── Eine gemeinsame Schleife für alle bewegten Bilder ─────────────────────
  const ruhig = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const LAEUFT = new Map();          // canvas → zeichne(t)
  let rafId = 0, start = 0, zuletzt = 0;
  function sichtbar(cv) {
    if (!cv.isConnected || document.hidden || !cv.offsetParent) return false;
    const r = cv.getBoundingClientRect();
    return r.bottom > 0 && r.top < (window.innerHeight || 800) && r.width > 0;
  }
  function schleife(jetzt) {
    rafId = 0;
    if (!start) start = jetzt;
    const t = ruhig() ? 0 : (jetzt - start) / 1000;
    if (jetzt - zuletzt >= 33) {            // höchstens ~30 Bilder je Sekunde
      zuletzt = jetzt;
      for (const [cv, f] of LAEUFT) {
        if (!cv.isConnected) { LAEUFT.delete(cv); continue; }
        if (sichtbar(cv)) { try { f(t); } catch (e) { console.warn('[DFL-Kulisse]', e); LAEUFT.delete(cv); } }
      }
    }
    if (LAEUFT.size && !ruhig()) rafId = requestAnimationFrame(schleife);
  }
  function animiere(cv, zeichne) {
    LAEUFT.set(cv, zeichne);
    try { zeichne(0); } catch (e) { console.warn('[DFL-Kulisse]', e); }
    if (!rafId && !ruhig()) rafId = requestAnimationFrame(schleife);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && LAEUFT.size && !rafId && !ruhig()) rafId = requestAnimationFrame(schleife); });

  // ── Startbild der Vereinswahl ─────────────────────────────────────────────
  // Kleine Stadt zieht langsam vorbei, auf dem Turm weht eine Fahne. Ihre Farbe wechselt durch die
  // Vereinsfarben; zeigt man auf einen Verein (Maus oder Tastatur), weht seine Farbe.
  // baum0–2: Baum der Jahreszeit (Laub, Herbst, Schnee)
  const STADT = [['houseAlt1', 0, .42], ['house1', 80, .38], ['tower', 168, .55], ['house2', 210, .4], ['houseSmall1', 300, .9],
    ['castleSmall', 380, .9], ['baum1', 470, .42], ['houseSmallAlt1', 520, .9], ['house1', 590, .36], ['baum0', 680, .5], ['baum2', 730, .34]];
  function fahne(g, x, y, farbe, t) {
    g.fillStyle = '#6b5b4b'; g.fillRect(x - 1.5, y - 46, 3, 46);
    g.beginPath(); g.moveTo(x + 1.5, y - 46);
    for (let i = 0; i <= 10; i++) g.lineTo(x + 1.5 + i * 3.4, y - 46 + Math.sin(t * 5 + i * 0.7) * 2.2 * (i / 10));
    for (let i = 10; i >= 0; i--) g.lineTo(x + 1.5 + i * 3.4, y - 28 + Math.sin(t * 5 + i * 0.7) * 2.2 * (i / 10));
    g.closePath(); g.fillStyle = farbe; g.fill();
    g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 1; g.stroke();
  }
  function startbild(wahl) {
    if (!wahl || wahl.querySelector('.dfl-startbild')) return;
    const kopf = wahl.querySelector('.dfl-wahl-kopf'); if (!kopf) return;
    kopf.insertAdjacentHTML('beforebegin', `<div class="dfl-startbild"><canvas width="720" height="300" role="img"
      aria-label="Startbild: kleine Stadt mit Turm und Vereinsfahne vor Bergen"></canvas>
      <div class="dfl-startbild-titel"><img class="dfl-startbild-logo" src="app/logo-schriftzug.svg" alt="Kickdraft" width="1000" height="290"><span>Fußball-Manager</span></div></div>`);
    const cv = wahl.querySelector('.dfl-startbild canvas'), g = cv.getContext('2d');
    const farben = (window.DFL_LIGA && DFL_LIGA.franchises || []).map(f => f.farben[0]);
    let gezeigt = null;
    wahl.addEventListener('pointerover', e => { const b = e.target.closest('.dfl-wahl-verein'); gezeigt = b ? getComputedStyle(b).getPropertyValue('--v1').trim() || null : null; });
    wahl.addEventListener('focusin', e => { const b = e.target.closest('.dfl-wahl-verein'); if (b) gezeigt = getComputedStyle(b).getPropertyValue('--v1').trim() || null; });
    const zeit = lage().zeit, k = ZEITEN[zeit] || ZEITEN.sommer;
    laden().then(() => animiere(cv, t => {
      const W = cv.width, H = cv.height, x = t * 14;
      himmel(g, W, H, [k.himmel[0], '#ffe3c2']);
      if (B.sun) g.drawImage(B.sun, 600, 40, 64, 64);
      const reihe = (im, farbe, y, w, h, tempo, st) => {
        if (!im) return; const b = farbe ? getoent(im, farbe, st) : im, off = -((x * tempo) % w);
        for (let i = -1; i < Math.ceil(W / w) + 1; i++) g.drawImage(b, off + i * w, y, w, h);
      };
      reihe(B.cloud3, null, 10, 520, 310, .15);
      reihe(B.mountains, k.berge, 30, 820, 320, .2, .8);
      reihe(B.hillsLarge, k.fern, 110, 820, 320, .35, .9);
      const breite = 760, off = -((x * .6) % breite);
      const farbe = gezeigt || farben[Math.floor(t / 2.5) % Math.max(1, farben.length)] || '#2fb36b';
      for (let i = -1; i < 2; i++) STADT.forEach(([n, sx, s]) => {
        const im = B[/^baum\d$/.test(n) ? k.baum[+n[4]] : n]; if (!im) return;
        const px = off + i * breite + sx, py = 262 - im.height * s;
        g.drawImage(im, px, py, im.width * s, im.height * s);
        if (n === 'tower') fahne(g, px + im.width * s / 2, py + 4, farbe, t);
      });
      reihe(B.hills, k.nah, 230, 820, 320, .9, .95);
      g.fillStyle = k.boden; g.fillRect(0, 288, W, H - 288);
    }));
  }
  function beobachteWahl() {
    const pruefe = () => document.querySelectorAll('.dfl-wahl').forEach(startbild);
    new MutationObserver(pruefe).observe(document.body, { childList: true, subtree: true });
    pruefe();
  }
  if (document.body) beobachteWahl(); else document.addEventListener('DOMContentLoaded', beobachteWahl);

  window.DFLKulisse = { lage, laden, bilder: B, himmelEbene, wolken, landEbene, zeichneHintergrund, stadtFormen, seedVon, zufall,
    gelaendeTon, abendTon, flutlicht, schnee, regen, flugzeug, feuerwerk, konfetti, animiere, getoent, ZEITEN };
  console.log('[DFL-Kulisse v3] aktiv — Himmel, Jahreszeiten, Stadt und Region am Horizont, Wetter nach Form, Flugzeug, Startbild (Kenney CC0)');
})();
