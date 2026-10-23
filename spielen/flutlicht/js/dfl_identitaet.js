/* ═══════════════════════════════════════════════════════════════════════════
   DFL-IDENTITÄT  ·  v2   (v2: Wappen D113, 2026-10-11)
   ─────────────────────────────────────────────────────────────────────────
   Gibt Vereinen und Spielern ein Gesicht, ohne echte Logos oder Fotos:

     · Wappen (D113): drei Wappenarten aus einem Generator, je Verein die Art aus data/league.json (wappen_art):
       A Vereinsabzeichen (Ring mit Stadt und Spitzname, Mitte nach Region), B Monogramm (Kürzel, nur wenige Vereine),
       C Heraldik plus (Armoria-Schild, Teilung nach Region, Mauerkrone ab 500.000 Einwohnern, Band mit Spitzname).
       Schrift als Rubik-Pfade, Figuren von game-icons.net (CC BY 3.0), Schilde Armoria (CC0) – alles aus
       data/dfl_wappen.js. Unter 64 px (Monogramm 40 px) die kleine Variante ohne Schrift; Titelsterne nach
       Bundesliga-Stufen (sterneFuer). Ohne Elemente echter Logos (Prüfliste im Prüflauf).
       Ersatz ohne Daten (v1): Linien-Icons von Tabler (MIT).
     · Gesichter: facesjs (Apache-2.0, zengm-games) in Trikotfarben des Vereins,
       aus dem Spieler-Seed immer gleich erzeugt. Nur im Speicher zwischengelagert,
       NICHT am Spieler: 626 Byte × ~1300 Spieler wären ~800 KB mehr Spielstand.
     · Vereinsfarben als Oberfläche: setzt --accent & Co. so, dass Text und
       Flächen auf dunklem Grund lesbar bleiben.
     · Emoji → Zeichen: über die zentrale Tabelle in js/dfl_kenney_patch.js (D104); hier nur Schnittstelle emojiZuIcon.

   Braucht: js/dfl_icons.js; optional data/dfl_wappen.js (Wappen), data/dfl_liga.js (fehlende Vereinsfelder)
   und vendor/facesjs/facesjs.js (Gesichter).
   API: wappenSvg(team, { richtung, groesse, klein, sterne }) · wappenHintergrund(team, { groesse }) · sterneFuer(titel) · …
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const ICONS = () => window.DFL_ICONS || {};

  // ── Farben ───────────────────────────────────────────────────────────────
  function rgb(hex) {
    const m = /rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/.exec(hex);
    if (m) return [+m[1], +m[2], +m[3]];
    const h = hex.replace('#', '');
    const v = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    return [0, 2, 4].map(i => parseInt(v.slice(i, i + 2), 16));
  }
  const hex = c => '#' + c.map(x => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('');
  function luminanz(c) {
    const [r, g, b] = rgb(c).map(x => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function kontrast(a, b) {
    const [x, y] = [luminanz(a), luminanz(b)].sort((m, n) => n - m);
    return (x + 0.05) / (y + 0.05);
  }
  const mische = (a, b, t) => hex(rgb(a).map((x, i) => x + (rgb(b)[i] - x) * t));
  // Hellt (bzw. dunkelt) eine Farbe so weit auf, bis sie auf dem Grund den Mindestkontrast erreicht
  function lesbar(farbe, grund, min) {
    const ziel = luminanz(grund) < 0.5 ? '#ffffff' : '#000000';
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const c = mische(farbe, ziel, t);
      if (kontrast(c, grund) >= min) return c;
    }
    return ziel;
  }


  // ── Wappen ───────────────────────────────────────────────────────────────
  function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  // v1 (Ersatz ohne data/dfl_wappen.js): Schildformen im Feld 100 × 104, Linien-Icon von Tabler
  const FORMEN = {
    klassisch: 'M10 6 H90 V50 C90 76 72 92 50 100 C28 92 10 76 10 50 Z',
    spanisch:  'M10 6 H90 V58 A40 40 0 0 1 10 58 Z',
    spitz:     'M10 6 H90 V68 L50 100 L10 68 Z',
    rund:      'M50 6 A47 47 0 1 1 49.99 6 Z'
  };
  // Teilungen in der Zweitfarbe (heraldische Grundmuster, keine Vereinslogos)
  const TEILUNGEN = {
    keine: '',
    gespalten: '<rect x="50" y="0" width="50" height="104"/>',
    geteilt: '<rect x="0" y="52" width="100" height="52"/>',
    schraeg: '<path d="M0 30 L70 104 H100 V80 L22 0 H0 Z"/>',
    sparren: '<path d="M0 84 L50 40 L100 84 V104 H82 L50 70 L18 104 H0 Z"/>',
    pfahl: '<rect x="38" y="0" width="24" height="104"/>',
    balken: '<rect x="0" y="40" width="100" height="22"/>',
    streifen: '<rect x="22" y="0" width="14" height="104"/><rect x="64" y="0" width="14" height="104"/>'
  };
  let zaehler = 0;
  function wappenLinie(team, opt) {
    const [p, s] = team.farben || ['#3a4250', '#ffffff'];
    const h = hash(team.id || team.name || 'x');
    const formName = opt.form || Object.keys(FORMEN)[h % 4];
    const teilung = opt.teilung || Object.keys(TEILUNGEN)[(h >>> 3) % Object.keys(TEILUNGEN).length];
    const rand = kontrast(p, '#111113') < 1.6 ? mische(s, '#111113', 0.35) : mische(p, '#000000', 0.45);
    const id = 'dflw' + (++zaehler) + '_' + h.toString(36);
    const figur = ICONS()[team.wappen_icon] || ICONS()[team.wappen_figur] || ICONS().star || '';
    const herz = kontrast(s, p) >= 2 ? s : (luminanz(p) > 0.4 ? '#111111' : '#ffffff');
    const groesse = opt.groesse ? ` width="${opt.groesse}" height="${Math.round(opt.groesse * 1.04)}"` : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 104"${groesse} role="img" aria-label="Wappen ${esc(anzeigeName(team))}">` +
      `<defs><clipPath id="${id}"><path d="${FORMEN[formName]}"/></clipPath></defs>` +
      `<g clip-path="url(#${id})"><rect width="100" height="104" fill="${p}"/><g fill="${s}">${TEILUNGEN[teilung]}</g>` +
      `<path d="M0 0 H100 V22 H0 Z" fill="#000" opacity=".08"/></g>` +
      `<path d="${FORMEN[formName]}" fill="none" stroke="${rand}" stroke-width="5"/>` +
      `<circle cx="50" cy="${formName === 'rund' ? 53 : 48}" r="19" fill="${p}" stroke="${herz}" stroke-width="3.5"/>` +
      `<g transform="translate(36 ${formName === 'rund' ? 39 : 34}) scale(1.17)" fill="none" stroke="${herz}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">${figur}</g>` +
      `</svg>`;
  }

  // ── Wappen v3 (D113): A Vereinsabzeichen · B Monogramm · C Heraldik plus ──
  // Deterministisch aus den Vereinsdaten (id, farben, kuerzel, spec_name, city, einwohner, region, wappen_figur,
  // wappen_art). Schrift: Rubik (SIL OFL) als Pfade aus DFL_WAPPEN.glyphen – wirkt auch im data:-Bild (crestStyle).
  // Figuren: game-icons.net (CC BY 3.0, Autor je Figur), Schilde: Armoria (CC0), alles andere eigene Geometrie.
  const W = () => window.DFL_WAPPEN || null;
  const WEISS = '#ffffff', FAST_SCHWARZ = '#17181c', GOLD = '#efb72e';
  const esc = s => String(s == null ? '' : s).replace(/[<>&"']/g, '');
  // Beste Farbe auf einem Grund: Wunschfarbe ab min : 1, sonst Weiß oder Fast-Schwarz
  const auf = (wunsch, grund, min) => kontrast(wunsch, grund) >= (min || 3) ? wunsch
    : (kontrast(WEISS, grund) >= kontrast(FAST_SCHWARZ, grund) ? WEISS : FAST_SCHWARZ);
  // Heraldische Farbregel „nie Farbe auf Farbe“: dunkle Zweitfarbe (Schwarz, Dunkelblau) auf farbigem Grund → die Figur
  // wird Silber (Weiß), z. B. Hannover Grün-Schwarz: weißer Löwe statt schwarzem
  const metall = (wunsch, grund) => (luminanz(wunsch) < 0.2 && luminanz(grund) < 0.35 && kontrast(WEISS, grund) >= 3) ? WEISS : auf(wunsch, grund);

  // Nähe zu echten Logos: feste Ausnahmen je Kürzel (sonst entscheidet die Prüfsumme)
  //   ring: Ringstil in A · teilung: Teilung in C · kleinFigur: kleine Variante in B mit Figur statt Buchstabe
  const NAH = {
    'MÜM': { ring: 'hell' },                    // roter Ring + weiße Schrift „München“ = FC Bayern
    MAI: { ring: 'hell' },                      // rot-weißes Rund = Mainz 05
    'NÜR': { ring: 'hell' },                    // rundes Abzeichen in Club-Rot = 1. FCN
    HHP: { ring: 'hell' },                      // braunes Rund = St. Pauli
    'KÖL': { ring: 'hell' },                    // rotes Rund mit „Köln“ = 1. FC Köln
    BRA: { teilung: ['bord'] },                 // blau-gelb gespaltener Schild = Eintracht Braunschweig
    DUI: { teilung: ['wellenbalken'] },         // mehrere blau-weiße Querstreifen = MSV
    DRE: { kleinFigur: true }                   // großes „D“ in Gelb-Schwarz = Dynamo Dresden
  };

  // Kontrast-Protokoll (Prüflauf): opt.protokoll sammelt Vorder-/Hintergrund je Figur und Schrift
  let PROT = null;
  const notiere = (art, vorne, hinten) => { if (PROT) PROT.push({ art, vorne, hinten, k: Math.round(kontrast(vorne, hinten) * 100) / 100 }); };
  const z = v => { const r = Math.round(v * 10) / 10; return String(Object.is(r, -0) ? 0 : r); };
  const P = (x, y) => z(x) + ' ' + z(y);

  // ── Schrift als Pfad (Rubik 700/800, 1/1000 em, Grundlinie y = 0) ─────────
  const GL = {};
  function glyph(gew, ch) {
    const k = gew + ch; if (GL[k]) return GL[k];
    const G = W().glyphen[gew], e = G[ch] || G[' '];
    const cmds = []; let cur = null, m; const re = /([MLQCZ])|(-?\d*\.?\d+)/g;
    while ((m = re.exec(e[1]))) { if (m[1]) { cur = [m[1]]; cmds.push(cur); } else cur.push(+m[2]); }
    return (GL[k] = { adv: e[0], cmds });
  }
  function glyphD(g, T) {
    let s = '';
    for (const c of g.cmds) { s += c[0]; for (let i = 1; i < c.length; i += 2) { const q = T(c[i], c[i + 1]); s += (i > 1 ? ' ' : '') + P(q[0], q[1]); } }
    return s;
  }
  function satz(text, gew, sperrung) {
    const K = W().kern[gew] || {}, zs = [...String(text).toUpperCase()];
    let x = 0; const teile = [];
    zs.forEach((ch, i) => { const g = glyph(gew, ch); if (i) x += (K[zs[i - 1] + ch] || 0) + sperrung; teile.push({ g, x }); x += g.adv; });
    return { teile, breite: x };
  }
  const VERSAL = 0.7;                                                     // Versalhöhe Rubik (700/1000)
  // Gerade Zeile: o.x (Mitte), o.y (Grundlinie), o.groesse, o.gew, o.sperrung, o.maxBreite
  function textGerade(text, o) {
    const st = satz(text, o.gew || 700, o.sperrung || 0);
    let gr = o.groesse; if (o.maxBreite && st.breite * gr / 1000 > o.maxBreite) gr = o.maxBreite * 1000 / st.breite;
    const s = gr / 1000, x0 = o.x - st.breite * s / 2;
    let d = ''; for (const t of st.teile) d += glyphD(t.g, (x, y) => [x0 + (t.x + x) * s, o.y + y * s]);
    return { d, groesse: gr };
  }
  // Schrift auf dem Bogen: o.cx, o.cy, o.r (Mitte der Versalhöhe), o.oben (Kopf nach außen) oder unten (Kopf zur Mitte)
  function textBogen(text, o) {
    const st = satz(text, o.gew || 700, o.sperrung || 0);
    let gr = o.groesse, s, rb, w;
    const rechne = () => { s = gr / 1000; rb = o.oben ? o.r - VERSAL * gr / 2 : o.r + VERSAL * gr / 2; w = st.breite * s / rb; };
    rechne();
    const max = (o.maxWinkel || 300) * Math.PI / 180;
    for (let i = 0; i < 4 && w > max; i++) { gr *= max / w; rechne(); }
    const mitte = (o.mitte != null ? o.mitte : (o.oben ? -90 : 90)) * Math.PI / 180;
    let d = '';
    for (const t of st.teile) {
      const c = (t.x + t.g.adv / 2) * s;
      const th = o.oben ? mitte - w / 2 + c / rb : mitte + w / 2 - c / rb;
      const px = o.cx + rb * Math.cos(th), py = o.cy + rb * Math.sin(th);
      const ph = o.oben ? th + Math.PI / 2 : th - Math.PI / 2, co = Math.cos(ph), si = Math.sin(ph), halb = t.g.adv / 2;
      d += glyphD(t.g, (x, y) => { const lx = (x - halb) * s, ly = y * s; return [px + co * lx - si * ly, py + si * lx + co * ly]; });
    }
    return { d, groesse: gr, winkel: w * 180 / Math.PI };
  }

  // ── Grundformen ───────────────────────────────────────────────────────────
  const kreis = (cx, cy, r) => `M${P(cx - r, cy)}a${z(r)} ${z(r)} 0 1 0 ${z(2 * r)} 0a${z(r)} ${z(r)} 0 1 0 ${z(-2 * r)} 0Z`;
  function stern(cx, cy, R, innen) {
    let d = ''; for (let i = 0; i < 10; i++) { const r = i % 2 ? R * (innen || 0.42) : R, a = -Math.PI / 2 + i * Math.PI / 5; d += (i ? 'L' : 'M') + P(cx + r * Math.cos(a), cy + r * Math.sin(a)); }
    return d + 'Z';
  }
  // Musterlinie von A nach B (ohne Startpunkt): gerade · wellen · zinnen · spitzen
  function linie(A, B, art, amp, wl, phase) {
    if (!art || art === 'gerade') return 'L' + P(B[0], B[1]);
    phase = phase || 1;
    const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    const at = (t, o) => [A[0] + ux * t + nx * o, A[1] + uy * t + ny * o];
    const n = Math.max(2, Math.round(L / (wl / 2))), h = L / n;
    let s = '';
    if (art === 'wellen') {
      for (let i = 0; i < n; i++) { const c = at(h * (i + 0.5), 2 * amp * (i % 2 ? -1 : 1) * phase), e = at(h * (i + 1), 0); s += 'Q' + P(c[0], c[1]) + ' ' + P(e[0], e[1]); }
    } else if (art === 'zinnen') {
      let o = amp / 2 * phase, q = at(0, o); s += 'L' + P(q[0], q[1]);
      for (let i = 0; i < n; i++) { q = at(h * (i + 1), o); s += 'L' + P(q[0], q[1]); if (i < n - 1) { o = -o; q = at(h * (i + 1), o); s += 'L' + P(q[0], q[1]); } }
      q = at(L, 0); s += 'L' + P(q[0], q[1]);
    } else {                                                                // spitzen
      for (let i = 0; i < n; i++) { const q = at(h * (i + 0.5), amp * (i % 2 ? -1 : 1) * phase), e = at(h * (i + 1), 0); s += 'L' + P(q[0], q[1]) + 'L' + P(e[0], e[1]); }
    }
    return s;
  }
  // Heller Außenrand: hebt dunkle Wappen vom Nacht-Grund ab, auf hellem Grund nur ein feiner Rand (wie ein Aufkleber)
  const randHell = (d, kontur, f) => `<path d="${d}" fill="none" stroke="#ffffff" stroke-opacity=".92" stroke-width="${z(kontur + 7 * (f || 1))}" stroke-linejoin="round"/>`;
  // Figur (game-icons, 512er-Feld) zentriert bei x/y mit Kantenlänge gr; Kontur in Einheiten des Zielfelds
  const figurStrich = (gr, tinte, kontur) => kontur ? ` stroke="${tinte}" stroke-width="${z(2 * kontur / (gr / 512))}" stroke-linejoin="round" paint-order="stroke"` : '';
  const figurLage = (x, y, gr) => `translate(${P(x - gr / 2, y - gr / 2)}) scale(${(Math.round(gr / 512 * 10000) / 10000)})`;
  function figur(name, x, y, gr, farbe, tinte, kontur, extra) {
    const f = W().figuren[name]; if (!f) return '';
    return `<path transform="${figurLage(x, y, gr)}" d="${f.d}" fill="${farbe}"` + figurStrich(gr, tinte, kontur) + (extra || '') + '/>';
  }
  // Dieselbe Figur mehrfach (verwechselte Farben): einmal als Vorlage, dann je Farbe ein <use> – spart zwei Drittel der Pfade
  function figurVorlage(name, x, y, gr, vid) {
    const f = W().figuren[name]; if (!f) return '';
    return `<defs><path id="${vid}" transform="${figurLage(x, y, gr)}" d="${f.d}"/></defs>`;
  }
  const figurNutzen = (vid, gr, farbe, tinte, kontur) => `<use href="#${vid}" fill="${farbe}"` + figurStrich(gr, tinte, kontur) + '/>';

  // ── Veredelung (Nutzer 2026-10-17: „die Wappen nochmal polishen und etwas mehr Details reinbringen“) ─────────────────
  // Glanz von oben, Schatten nach unten, feines Damast-Muster im Feld, Metallrand, Schatten unter der Figur; groß zusätzlich
  // Lorbeer (Heraldik) bzw. Gründungsjahr (Abzeichen). VEREDELN = false → Wappen wie bis 2026-10-17.
  let VEREDELN = true;
  function glanzDefs(id, klein) {
    return `<defs><linearGradient id="${id}gl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="${klein ? '.2' : '.24'}"/>` +
      `<stop offset=".42" stop-color="#fff" stop-opacity="0"/><stop offset=".7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${klein ? '.2' : '.26'}"/></linearGradient>` +
      `<radialGradient id="${id}gr" cx=".3" cy=".18" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".26"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>` +
      `<linearGradient id="${id}mt" x1="0" y1="0" x2=".7" y2="1"><stop offset="0" stop-color="#fff4c2"/><stop offset=".35" stop-color="${GOLD}"/><stop offset=".6" stop-color="#fff1b0"/><stop offset="1" stop-color="#9a6a12"/></linearGradient>` +
      (klein ? '' : `<pattern id="${id}dm" width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(45 100 108)">` +
        `<path d="M0 9H18M9 0V18" stroke="#fff" stroke-width=".7"/><circle cx="9" cy="9" r="1.6" fill="#fff"/><circle cx="0" cy="0" r="1" fill="#fff"/><circle cx="18" cy="18" r="1" fill="#fff"/></pattern>`) +
      '</defs>';
  }
  // Muster im Feld (unter der Figur), Glanz über allem (im Clip der Form)
  const damast = (id, klein, staerke) => klein ? '' : `<rect x="-20" y="-20" width="240" height="260" fill="url(#${id}dm)" opacity="${staerke || 0.12}"/>`;
  const glanz = id => `<rect x="-20" y="-20" width="240" height="260" fill="url(#${id}gl)"/><rect x="-20" y="-20" width="240" height="260" fill="url(#${id}gr)"/>`;
  // Schatten unter der Figur: dieselbe Figur dunkel, leicht versetzt
  // Figur einmal als Vorlage, Schatten und Figur als <use> (spart die doppelte Figur im Bild)
  const figurMitSchatten = (name, x, y, gr, farbe, tinte, kontur, vid, klein) => figurVorlage(name, x, y, gr, vid) +
    `<g transform="translate(${klein ? 3 : 2.4} ${klein ? 4 : 3.2})" opacity="${klein ? '.22' : '.3'}">${figurNutzen(vid, gr, '#000000', '', 0)}</g>` +
    figurNutzen(vid, gr, farbe, tinte, kontur);
  const figurSchatten = (vid, gr, klein) => `<g transform="translate(${klein ? 3 : 2.4} ${klein ? 4 : 3.2})" opacity="${klein ? '.22' : '.3'}">${figurNutzen(vid, gr, '#000000', '', 0)}</g>`;
  // Lorbeer: zwei Zweige von unten nach oben, Blätter abwechselnd außen und innen
  function lorbeer(cx, cy, r, farbe, tinte, von, bis) {
    let d = '', stiel = '';
    [-1, 1].forEach(seite => {
      const n = 10;
      let pfad = '';
      for (let i = 0; i <= n; i++) {
        const a = (von + (bis - von) * i / n) * Math.PI / 180, x = cx + seite * r * Math.sin(a), y = cy + r * Math.cos(a);
        pfad += (i ? 'L' : 'M') + P(x, y);
        if (i === 0) continue;
        [1, -1].forEach(aussen => {
          const w = a + seite * 0.0, nx = seite * Math.sin(w) * aussen, ny = Math.cos(w) * aussen;            // Normale (außen/innen)
          const tx = seite * Math.cos(w), ty = -Math.sin(w);                                                   // Tangente nach oben
          const L = 19 - i * 0.7, B = 6.4 - i * 0.22;
          const sx = x + nx * 2, sy = y + ny * 2, ex = sx + (nx * 0.75 + tx * 0.65) * L, ey = sy + (ny * 0.75 + ty * 0.65) * L;
          const mx = (sx + ex) / 2, my = (sy + ey) / 2, ox = -(ey - sy) / L * B, oy = (ex - sx) / L * B;
          d += `M${P(sx, sy)}Q${P(mx + ox, my + oy)} ${P(ex, ey)}Q${P(mx - ox, my - oy)} ${P(sx, sy)}Z`;
        });
      }
      stiel += pfad;
    });
    return `<path d="${stiel}" fill="none" stroke="${tinte}" stroke-width="3.2" stroke-linecap="round"/>` +
      `<path d="${d}" fill="${farbe}" stroke="${tinte}" stroke-width="1.8" stroke-linejoin="round"/>`;
  }
  // Gründungsjahr (erfunden, je Verein fest): 1880–1975
  const gruendung = t => 1880 + (hash(String(t.id || anzeigeName(t)) + 'gr') % 96);

  // ── Namen aus den Vereinsdaten (nie den echten Vereinsnamen) ──────────────
  const anzeigeName = t => t.spec_name || (t.verein ? t.name : '') || t.name || '';
  // Wappenschrift hat nur A–Z, ÄÖÜ, 0–9: Akzente der Europapokal-Namen umschreiben („Nervión“ → Nervion, „Bodø“ → Bodo)
  const UML = 'ÄÖÜäöü';
  const glyphen = s => String(s || '').replace(/[ÄÖÜäöü]/g, c => String.fromCharCode(0xE000 + UML.indexOf(c))).normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[\uE000-\uE005]/g, c => UML[c.charCodeAt(0) - 0xE000])
    .replace(/[øØ]/g, 'o').replace(/[æÆ]/g, 'ae').replace(/[łŁ]/g, 'l').replace(/ı/g, 'i').replace(/[đĐ]/g, 'd').replace(/[ħĦ]/g, 'h')
    .replace(/ß/g, 'ss').replace(/[’`]/g, "'");
  const stadtVon = t => glyphen(t.city || anzeigeName(t).split(' ')[0] || '');
  const spitzname = t => { if (t.spitz) return glyphen(t.spitz); const n = anzeigeName(t), c = stadtVon(t); return n.indexOf(c + ' ') === 0 ? n.slice(c.length + 1) : n.split(' ').slice(1).join(' ') || n; };
  const kuerzelVon = t => (t.kuerzel || t.kurz || stadtVon(t).slice(0, 3)).toUpperCase();
  function farbenVon(t) {
    const [p, s] = t.farben || ['#3a4250', '#ffffff'];
    return { p, s, tinte: mische(p, '#000000', 0.62), hell: luminanz(p) > 0.35 };   // hell: Gelb, Hellblau
  }
  // Welt-Teams und Spiel-Teams tragen nicht alle Felder (Art, Einwohner, Region …) → aus data/league.json ergänzen
  function teamDaten(team) {
    const L = window.DFL_LIGA && window.DFL_LIGA.franchises;
    const id = String(team.id || '').replace(/^dfl_/, '');
    const f = L && L.find(x => x.id === id);
    if (!f) return team;
    const t = Object.assign({}, f, team, { id: f.id });                    // Prüfsumme immer aus der Franchise-ID (ohne dfl_)
    ['spec_name', 'kuerzel', 'city', 'einwohner', 'region', 'wappen_art'].forEach(k => { if (t[k] == null) t[k] = f[k]; });
    if (!t.wappen_figur) t.wappen_figur = f.wappen_figur;
    return t;
  }

  // ══ A · Vereinsabzeichen (rund, Ringschrift) ══════════════════════════════
  function abzeichen(t, id, klein) {
    const F = farbenVon(t), h = hash(t.id || anzeigeName(t));
    const cx = 100, cy = 108;
    // Ringstil: dunkel · farbe (Ring in Vereinsfarbe, Mitte hell) · hell (heller Ring) · invers für helle Vereinsfarben
    // (Gelb, Hellblau): Ring in der Vereinsfarbe, dunkle Mitte – gelbe Scheibe mit schwarzem Rand wäre zu nah an einem echten Logo
    const stile = ['dunkel', 'farbe', 'hell'];
    let stil = F.hell ? 'invers' : (NAH[kuerzelVon(t)] && NAH[kuerzelVon(t)].ring) || stile[(h >>> 3) % 3];
    if (stil === 'farbe' && kontrast(F.s, F.p) < 3) stil = 'dunkel';
    const dunkel = luminanz(F.s) < 0.12 ? F.s : F.tinte;
    const ringF = stil === 'dunkel' ? F.tinte : stil === 'farbe' || stil === 'invers' ? F.p : '#fbf7ee';
    const textF = stil === 'hell' ? auf(F.p, ringF, 4.5) : stil === 'invers' ? auf(dunkel, ringF, 4.5) : auf(F.s, ringF, 4.5);
    const feldF = stil === 'farbe' ? F.s : stil === 'invers' ? dunkel : F.p;
    const figF = stil === 'farbe' || stil === 'invers' ? auf(F.p, feldF) : metall(F.s, feldF);
    const linieF = stil === 'invers' ? textF : (kontrast(GOLD, ringF) >= 1.7 ? GOLD : textF);
    const R = klein ? 91 : 92, rIn = klein ? 68 : 62;
    const muster = (t.region === 'hafen' || t.region === 'fluss') ? 'wellen' : ['strahlen', 'halb', 'glatt'][(h >>> 6) % 3];
    let o = `<defs><clipPath id="${id}i"><path d="${kreis(cx, cy, rIn)}"/></clipPath><clipPath id="${id}a"><path d="${kreis(cx, cy, R)}"/></clipPath></defs>`;
    if (VEREDELN) o += glanzDefs(id, klein);
    o += randHell(kreis(cx, cy, R), klein ? 9 : 5);
    o += `<path d="${kreis(cx, cy, R)}" fill="${ringF}" stroke="${F.tinte}" stroke-width="${klein ? 9 : 5}"/>`;
    if (!klein) o += `<path d="${kreis(cx, cy, R - 6.5)}" fill="none" stroke="${linieF}" stroke-width="2"/>`;
    o += `<g clip-path="url(#${id}i)"><rect x="0" y="0" width="200" height="216" fill="${feldF}"/>`;
    if (VEREDELN) o += damast(id, klein, 0.1);
    const ton = mische(feldF, luminanz(feldF) > 0.5 ? '#000000' : '#ffffff', 0.1);
    let figY = cy, figGr = klein ? 104 : 80;
    if (!klein && muster === 'strahlen') { let d = ''; for (let i = 0; i < 24; i += 2) { const a1 = i * Math.PI / 12, a2 = (i + 1) * Math.PI / 12; d += `M${P(cx, cy)}L${P(cx + 90 * Math.cos(a1), cy + 90 * Math.sin(a1))}L${P(cx + 90 * Math.cos(a2), cy + 90 * Math.sin(a2))}Z`; } o += `<path d="${d}" fill="${ton}"/>`; }
    if (!klein && muster === 'halb') o += `<rect x="${cx}" y="0" width="100" height="216" fill="${ton}"/>`;
    if (muster === 'wellen') {
      const andere = feldF === F.s ? F.p : (stil === 'invers' ? F.p : F.s);
      const wF = kontrast(andere, feldF) >= 1.6 ? andere : ton, y1 = klein ? 142 : 134;
      const welle = (y, d) => `M-10 ${y}` + linie([-10, y], [210, y], 'wellen', 3.2, 26) + `L210 ${y + d}` + linie([210, y + d], [-10, y + d], 'wellen', 3.2, 26, -1) + 'Z';
      o += `<path d="${welle(y1, 9) + welle(y1 + 17, 9)}" fill="${wF}" opacity="${wF === F.s ? 1 : 0.9}"/>`;
      figY = klein ? 100 : 98; figGr = klein ? 82 : 68;
    }
    o += (VEREDELN ? figurMitSchatten(t.wappen_figur, cx, figY, figGr, figF, F.tinte, klein ? 5 : 2.6, id + 'v', klein)
      : figur(t.wappen_figur, cx, figY, figGr, figF, F.tinte, klein ? 5 : 2.6)) + '</g>';
    notiere('figur', figF, feldF);
    o += `<path d="${kreis(cx, cy, rIn)}" fill="none" stroke="${F.tinte}" stroke-width="${klein ? 6 : 3}"/>`;
    if (!klein) {
      o += `<path d="${kreis(cx, cy, rIn + 3.2)}" fill="none" stroke="${linieF}" stroke-width="2"/>`;
      const rT = (R - 6.5 + rIn + 3.2) / 2;
      const oben = textBogen(stadtVon(t), { cx, cy, r: rT, groesse: 19.5, gew: 700, sperrung: 70, oben: true, maxWinkel: 150 });
      const unten = textBogen(spitzname(t), { cx, cy, r: rT, groesse: 19.5, gew: 700, sperrung: 70, oben: false, maxWinkel: 128 });
      o += `<path d="${oben.d}${unten.d}" fill="${textF}"/>`;
      notiere('schrift', textF, ringF);
      if (VEREDELN) {
        // Gründungsjahr links und rechts im Ring („19 · 04“), dazu feine Perlenreihe innen
        const j = String(gruendung(t)), l = textGerade(j.slice(0, 2), { x: cx - rT, y: cy + 6.5, groesse: 17, gew: 800, maxBreite: 22 }),
          r = textGerade(j.slice(2), { x: cx + rT, y: cy + 6.5, groesse: 17, gew: 800, maxBreite: 22 });
        o += `<path d="${l.d}${r.d}" fill="${textF}"/>`;
        const rp = rIn + 6.6, umfang = 2 * Math.PI * rp;
        o += `<circle cx="${cx}" cy="${cy}" r="${z(rp)}" fill="none" stroke="${linieF}" stroke-width="1.9" stroke-linecap="round" stroke-dasharray="0 ${z(umfang / 48)}" opacity=".7"/>`;
      } else o += `<path d="${stern(cx - rT, cy, 6.2) + stern(cx + rT, cy, 6.2)}" fill="${linieF}"/>`;
    }
    if (VEREDELN) {
      o += `<g clip-path="url(#${id}a)">${glanz(id)}</g>`;
      if (!klein) o += `<path d="${kreis(cx, cy, R - 2.6)}" fill="none" stroke="url(#${id}mt)" stroke-width="2.4" opacity=".9"/>`;
    }
    return o;
  }

  // ══ B · Monogramm (D113: nur noch wenige Vereine) ═══════════════════════════
  const FORMEN_B = {
    klassik: 'M28 12H172V110C172 156 140 186 100 206C60 186 28 156 28 110Z',
    kante: 'M46 12H154L174 32V124L100 206L26 124V32Z',
    bogen: 'M26 32Q100 0 174 32V116C174 160 142 188 100 206C58 188 26 160 26 116Z'
  };
  function monogramm(t, id, klein) {
    const F = farbenVon(t), h = hash(t.id || anzeigeName(t));
    const form = FORMEN_B[Object.keys(FORMEN_B)[(h >>> 2) % 3]];
    // Helle Vereinsfarben (Gelb, Hellblau): dunkles Feld, die Vereinsfarbe als Schmuck und Schrift
    const feld = F.hell ? (luminanz(F.s) < 0.12 ? F.s : F.tinte) : F.p;
    const schmuck = F.hell ? F.p : (kontrast(F.s, feld) >= 1.6 ? F.s : mische(feld, '#ffffff', 0.3));
    // Monogramm: hell auf dunklem Feld (Weiß bzw. helle Zweitfarbe), auf gelbem Schmuck das Gelb
    const schrift = F.hell ? F.p : (luminanz(F.s) > 0.6 && kontrast(F.s, feld) >= 2.5 ? F.s : auf(WEISS, feld, 2.2));
    // Schmuck liegt außerhalb der Schriftzone (y 100–156): Spitze, Sparren unten oder Kopfband
    const deko = ['spitze', 'sparren', 'kopf'][(h >>> 5) % 3];
    let o = `<defs><clipPath id="${id}f"><path d="${form}"/></clipPath></defs>`;
    if (VEREDELN) o += glanzDefs(id, klein);
    o += randHell(form, klein ? 14 : 9);
    o += `<path d="${form}" fill="${feld}" stroke="${F.tinte}" stroke-width="${klein ? 14 : 9}" stroke-linejoin="round"/>`;
    o += `<g clip-path="url(#${id}f)">`;
    if (VEREDELN) o += damast(id, klein, 0.1);
    if (deko === 'spitze') o += `<path d="M-10 166H210V230H-10Z" fill="${schmuck}"/><path d="M-10 172H210" stroke="${feld}" stroke-width="3"/>`;
    if (deko === 'sparren') o += `<path d="M-10 150L100 190L210 150V178L100 218L-10 178Z" fill="${schmuck}"/>`;
    if (deko === 'kopf') o += `<path d="M-10 -10H210V86H-10Z" fill="${schmuck}"/><path d="M-10 92H210" stroke="${schmuck}" stroke-width="3"/>`;
    o += '</g>';
    o += `<path d="${form}" fill="none" stroke="${schmuck}" stroke-width="${klein ? 6 : 3}" stroke-linejoin="round" transform="translate(100 108) scale(.88) translate(-100 -108)"/>`;
    const kontur = mische(feld, '#000000', 0.55);
    if (klein) {
      if (NAH[kuerzelVon(t)] && NAH[kuerzelVon(t)].kleinFigur) { o += figur(t.wappen_figur, 100, deko === 'kopf' ? 124 : 104, 104, schrift, kontur, 5); notiere('figur', schrift, feld); }
      else {
        const tx = textGerade(kuerzelVon(t)[0], { x: 100, y: deko === 'kopf' ? 168 : 150, groesse: deko === 'kopf' ? 104 : 122, gew: 800, maxBreite: 112 });
        o += `<path d="${tx.d}" fill="${schrift}" stroke="${kontur}" stroke-width="12" stroke-linejoin="round" paint-order="stroke"/>`;
        notiere('schrift', schrift, feld);
      }
    } else {
      const figF = deko === 'kopf' ? auf(feld, schmuck) : schrift;
      o += figur(t.wappen_figur, 100, deko === 'kopf' ? 52 : 62, 54, figF, deko === 'kopf' ? mische(schmuck, '#000000', 0.5) : kontur, deko === 'kopf' ? 0 : 3);
      const tx = textGerade(kuerzelVon(t), { x: 100, y: 152, groesse: 60, gew: 800, sperrung: 14, maxBreite: 124 });
      o += `<path d="${tx.d}" fill="${schrift}" stroke="${kontur}" stroke-width="8" stroke-linejoin="round" paint-order="stroke"/>`;
      notiere('schrift', schrift, feld); notiere('figur', figF, deko === 'kopf' ? schmuck : feld);
    }
    if (VEREDELN) {
      o += `<g clip-path="url(#${id}f)">${glanz(id)}</g>`;
      if (!klein) o += `<path d="${form}" fill="none" stroke="url(#${id}mt)" stroke-width="2.2" stroke-linejoin="round" transform="translate(100 108) scale(.955) translate(-100 -108)"/>`;
    }
    return o;
  }

  // ══ C · Heraldik plus ═══════════════════════════════════════════════════════
  // Teilungen im Armoria-Feld (0–200), Fläche in der Zweitfarbe; fig = Platz der Figur, verw = verwechselte Farben
  function teilung(art, la) {
    switch (art) {
      case 'geteilt': return { d: 'M-20 116' + linie([-20, 116], [220, 116], la, 7, 30) + 'L220 240L-20 240Z', fig: [100, 72, 76] };
      case 'wellenbalken': return { d: 'M-20 118' + linie([-20, 118], [220, 118], 'wellen', 5, 34) + 'L220 146' + linie([220, 146], [-20, 146], 'wellen', 5, 34, -1) + 'Z', fig: [100, 72, 74] };
      case 'haupt': return { d: 'M-20 -20H220V70' + linie([220, 70], [-20, 70], la, 10, 26) + 'Z', fig: [100, 132, 84], haupt: true };
      case 'gespalten': return { d: 'M100 -20' + linie([100, -20], [100, 240], la, 6, 30) + 'L220 240L220 -20Z', fig: [100, 108, 98], verw: true };
      case 'schraeg': return { d: 'M-20 -12' + linie([-20, -12], [220, 228], la, 6, 34) + 'L220 -20L-20 -20Z', fig: [100, 108, 96], verw: true };
      case 'schraegwellen': return { d: 'M-20 50' + linie([-20, 50], [220, 170], 'wellen', 5, 32) + 'L220 206' + linie([220, 206], [-20, 86], 'wellen', 5, 32, -1) + 'Z', fig: [100, 108, 92], verw: true };
      case 'geviert': return { d: 'M100 -20H220V108H100ZM-20 108H100V240H-20Z', fig: [100, 108, 96], verw: true };
      case 'sparren': return { d: 'M-20 214L100 118L220 214V242L100 146L-20 242Z', fig: [100, 74, 70] };
      case 'pfahl': return { d: 'M74 -20H126V240H74Z', fig: [100, 108, 96], verw: true };
      case 'bord': return { bord: true, fig: [100, 110, 86] };
      // Pfähle in der Zweitfarbe (Prunk-Wappen, z. B. schwarz-weiß gestreift); Figur ohne Farbwechsel
      case 'streifen': { let d = ''; for (let x = 18; x < 200; x += 44) d += `M${x} -20H${x + 22}V240H${x}Z`; return { d, fig: [100, 112, 92] }; }
      default: return { d: '', fig: [100, 108, 96] };
    }
  }
  // Teilung nach Region: Wellenschnitt bei Hafen und Fluss, Spitzen bei Zechen und Alpen, Zinnen in Großstädten
  function heraldikWahl(t) {
    const h = hash(t.id || anzeigeName(t)), r = t.region, ew = t.einwohner || 0;
    const nah = NAH[kuerzelVon(t)]; if (nah && nah.teilung) return nah.teilung;
    const w = (liste, s) => liste[(h >>> s) % liste.length];
    if (r === 'hafen') return w([['wellenbalken'], ['geteilt', 'wellen'], ['wellenbalken']], 4);
    if (r === 'fluss') return w([['gespalten', 'wellen'], ['wellenbalken'], ['geviert']], 4);
    if (r === 'zechen') return w([['sparren'], ['geteilt', 'spitzen'], ['haupt', 'spitzen']], 4);
    if (r === 'alpen') return w([['geteilt', 'spitzen'], ['haupt', 'spitzen']], 4);
    if (ew >= 500000) return ['haupt', 'zinnen'];
    return w([['gespalten'], ['geviert'], ['bord'], ['pfahl'], ['schraeg'], ['haupt', 'gerade']], 4);
  }
  // Mauerkrone (ab 500.000 Einwohnern, fünf Türme ab einer Million)
  function mauerkrone(cx, yBasis, breite, tuerme, farbe, tinte) {
    const hb = breite * 0.17, ht = breite * 0.21, n = tuerme, tw = breite / (n * 1.5);
    const x0 = cx - breite / 2, y0 = yBasis - hb;
    const dunkel = mische(farbe, tinte, 0.3), licht = mische(farbe, '#ffffff', 0.35);
    let tuerme_ = '', fenster = '';
    for (let i = 0; i < n; i++) {
      const x = x0 + tw / 2 + i * (breite - tw) / (n - 1), mitte = i === (n - 1) / 2;
      const l = x - tw / 2, r = x + tw / 2, top = y0 - ht * (mitte ? 1.14 : 1), zb = tw / 5, zt = zb * 0.95;
      tuerme_ += `M${P(l, y0 + 2)}V${z(top)}H${z(l + zb)}V${z(top + zt)}H${z(l + 2 * zb)}V${z(top)}H${z(l + 3 * zb)}V${z(top + zt)}H${z(l + 4 * zb)}V${z(top)}H${z(r)}V${z(y0 + 2)}Z`;
      const fw = tw * 0.3, fh = ht * 0.42, fy = top + zt + (y0 - top - zt - fh) / 2 + 1;
      fenster += `M${P(x - fw / 2, fy + fh)}V${z(fy + fw / 2)}a${z(fw / 2)} ${z(fw / 2)} 0 0 1 ${z(fw)} 0V${z(fy + fh)}Z`;
    }
    // Mauerband, unten leicht durchhängend, mit Fugen
    const mauer = `M${P(x0, y0)}H${z(x0 + breite)}V${z(yBasis)}Q${P(cx, yBasis + breite * 0.05)} ${P(x0, yBasis)}Z`;
    let fugen = `M${P(x0 + 3, y0 + hb * 0.48)}H${z(x0 + breite - 3)}`;
    for (let i = 1; i < 6; i++) { const x = x0 + i * breite / 6; fugen += `M${P(x, y0 + 2)}V${z(y0 + hb * 0.48)}M${P(x - breite / 12, y0 + hb * 0.48)}V${z(yBasis - 1)}`; }
    return `<path d="${tuerme_}" fill="${farbe}" stroke="${tinte}" stroke-width="3" stroke-linejoin="round"/>` +
      `<path d="${fenster}" fill="${tinte}" opacity=".75"/>` +
      `<path d="${mauer}" fill="${dunkel}" stroke="${tinte}" stroke-width="3" stroke-linejoin="round"/>` +
      `<path d="${fugen}" fill="none" stroke="${tinte}" stroke-width="1.6" opacity=".55"/>` +
      `<path d="M${P(x0 + 3, y0 + 2.6)}H${z(x0 + breite - 3)}" stroke="${licht}" stroke-width="2" opacity=".8"/>`;
  }
  // Band (Spruchband) mit dem Spitznamen, Bogen nach unten durchhängend, Enden mit Schwalbenschwanz
  function band(text, cx, yMitte, farbe, schatten, tinte, schrift, maxBreite) {
    const R = 240, hB = 25, cy = yMitte - R;
    const tx = textBogen(text, { cx, cy, r: R, groesse: 17, gew: 700, sperrung: 60, oben: false, maxWinkel: (maxBreite - 34) / R * 180 / Math.PI });
    const halb = Math.max(tx.winkel * Math.PI / 180 * R / 2 + 15, 46);
    const D = halb / R, a1 = Math.PI / 2 + D, a2 = Math.PI / 2 - D;
    const pt = (a, r) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    const ro = R + hB / 2, ri = R - hB / 2;
    const haupt = `M${P(...pt(a1, ro))}A${ro} ${ro} 0 0 0 ${P(...pt(a2, ro))}L${P(...pt(a2, ri))}A${ri} ${ri} 0 0 1 ${P(...pt(a1, ri))}Z`;
    const ende = (a, seite) => {
      const E = pt(a, R), t = seite < 0 ? [-Math.sin(a), Math.cos(a)] : [Math.sin(a), -Math.cos(a)], n = [Math.cos(a), Math.sin(a)];
      const at = (u, v) => [E[0] + t[0] * u + n[0] * v, E[1] + t[1] * u + n[1] * v];
      const off = hB * 0.42, L = 26, w0 = 10;
      const schwanz = `M${P(...at(-w0, -hB / 2 + off))}L${P(...at(L, -hB / 2 + off))}L${P(...at(L - 9, off))}L${P(...at(L, hB / 2 + off))}L${P(...at(-w0, hB / 2 + off))}Z`;
      const falz = `M${P(...at(0, hB / 2))}L${P(...at(0, -hB / 2 + off))}L${P(...at(-w0, hB / 2 + off - 0.01))}Z`;
      return { schwanz, falz };
    };
    const l = ende(a1, -1), r = ende(a2, 1);
    return `<path d="${l.schwanz + r.schwanz}" fill="${schatten}" stroke="${tinte}" stroke-width="3" stroke-linejoin="round"/>` +
      `<path d="${l.falz + r.falz}" fill="${mische(schatten, '#000000', 0.35)}" stroke="${tinte}" stroke-width="2" stroke-linejoin="round"/>` +
      `<path d="${haupt}" fill="${farbe}" stroke="${tinte}" stroke-width="3.2" stroke-linejoin="round"/>` +
      `<path d="${tx.d}" fill="${schrift}"/>`;
  }
  // Prunk-Wappen (data/wappen_prunk.js): Zusätze nur für ausgewählte Vereine, Schlüssel = angezeigter Name
  function prunkVon(t) {
    const L = window.KS_WAPPEN_PRUNK; if (!L) return null;
    const n = anzeigeName(t);
    return L[n] || (window.KSVereinsnamen && L[window.KSVereinsnamen.neu(n)]) || null;
  }
  // Kleines Kreuz im Eckfeld (selbst gezeichnet, keine Figur nötig)
  const eckKreuz = (cx, cy, r) => `M${P(cx - r * 0.2, cy - r)}H${z(cx + r * 0.2)}V${z(cy - r * 0.2)}H${z(cx + r)}V${z(cy + r * 0.2)}H${z(cx + r * 0.2)}V${z(cy + r)}H${z(cx - r * 0.2)}V${z(cy + r * 0.2)}H${z(cx - r)}V${z(cy - r * 0.2)}H${z(cx - r * 0.2)}Z`;
  function heraldik(t, id, klein) {
    const F = farbenVon(t), h = hash(t.id || anzeigeName(t)), D = W(), PR = prunkVon(t) || {};
    const ew = t.einwohner || 0, koenig = !klein && PR.krone === 'koenig', krone = !klein && (koenig || ew >= 500000);
    const formen = krone ? ['heater', 'spanish', 'french', 'oldFrench'] : ['heater', 'spanish', 'french', 'oldFrench', 'swiss', 'renaissance', 'wedged'];
    const pfad = D.schilde[PR.form && D.schilde[PR.form] ? PR.form : formen[(h >>> 9) % formen.length]];
    const [art, la] = PR.teilung || heraldikWahl(t), T = teilung(art, la);
    const figName = PR.figur && D.figuren[PR.figur] ? PR.figur : t.wappen_figur;
    const k = klein ? 1.1 : (krone ? 0.8 : 0.86);
    const oben = klein ? 4 : (krone ? 36 : 10);
    const tx = 100 - 100 * k, ty = oben - 18 * k;
    const tinte = F.tinte;
    // Tinkturen: Feld = Vereinsfarbe, Teilung = Zweitfarbe (Metall); zu wenig Abstand → Weiß bzw. Fast-Schwarz
    const feld = F.p, zweit = kontrast(F.s, F.p) >= 1.5 ? F.s : (luminanz(F.p) > 0.3 ? FAST_SCHWARZ : WEISS);
    let o = `<defs><clipPath id="${id}s"><path d="${pfad}"/></clipPath>` + (T.d ? `<clipPath id="${id}t"><path d="${T.d}"/></clipPath><clipPath id="${id}u"><path d="M-30 -30H230V250H-30Z${T.d}" clip-rule="evenodd"/></clipPath>` : '') + '</defs>';
    if (VEREDELN) o += glanzDefs(id, klein);
    // Lorbeer hinter dem Schild (groß, ohne Mauerkrone)
    if (VEREDELN && !klein && !krone && (PR.lorbeer != null ? PR.lorbeer : (h >>> 11) % 2 === 0)) o += lorbeer(100, 104, 90, mische(GOLD, '#ffffff', 0.08), mische(GOLD, '#000000', 0.6), 22, 122);
    o += `<g transform="translate(${P(tx, ty)}) scale(${k})">`;
    o += randHell(pfad, (klein ? 11 : 8), 1 / k);
    o += `<g clip-path="url(#${id}s)"><rect x="-10" y="-10" width="220" height="230" fill="${feld}"/>`;
    if (T.d) o += `<path d="${T.d}" fill="${zweit}"/>`;
    if (T.bord) o += `<path d="${pfad}" fill="none" stroke="${zweit}" stroke-width="34"/>`;
    // Schildhaupt mit kleinen Sternen oder kurzem Schriftzug (nur groß, nur bei Teilung „haupt“)
    if (!klein && T.haupt && PR.hauptSterne) {
      const n = PR.hauptSterne, ab = Math.min(18, 110 / Math.max(1, n - 1)); let d = '';
      for (let i = 0; i < n; i++) d += stern(100 - (n - 1) * ab / 2 + i * ab, 48, 8.2);
      o += `<path d="${d}" fill="${metall(WEISS, zweit)}" stroke="${tinte}" stroke-width="1.4" stroke-linejoin="round"/>`;
    }
    if (!klein && T.haupt && PR.hauptText) {
      const tx2 = textGerade(PR.hauptText, { x: 100, y: 57, groesse: 27, gew: 800, sperrung: 80, maxBreite: 112 });
      o += `<path d="${tx2.d}" fill="${auf(feld, zweit, 3)}"/>`;
    }
    if (VEREDELN) o += damast(id, klein, 0.11);
    // Eckfeld oben links (nur groß): Kreuz oder kleine Figur auf eigenem Feld; die Hauptfigur rückt etwas nach unten rechts
    const eck = !klein && PR.eck;
    if (eck) {
      const eF = PR.eckFeld || WEISS, eC = PR.eckFarbe || (eck === 'kreuz' ? (kontrast('#c8102e', eF) >= 3 ? '#c8102e' : F.p) : auf(F.p, eF));
      // Schild reicht von x 25–175, y 25–200 → Eckfeld bis 92/88
      o += `<path d="M-10 -10H92V88H-10Z" fill="${eF}" stroke="${tinte}" stroke-width="5"/>`;
      o += eck === 'kreuz' ? `<path d="${eckKreuz(58, 56, 21)}" fill="${eC}" stroke="${tinte}" stroke-width="2"/>` : figur(eck, 58, 57, 50, eC, tinte, 2.4);
    }
    const jahrDa = !klein && PR.jahr;
    const [fx0, fy0, fgr0] = T.fig, fx = eck ? fx0 + 8 : fx0, fy = eck ? fy0 + 12 : fy0;
    const fgr = (klein ? fgr0 * 1.08 : fgr0) * (eck ? 0.84 : 1) * (jahrDa ? 0.72 : 1), kont = klein ? 4.5 : 3;
    if (T.verw && T.d && !PR.figFarbe) {
      // verwechselte Farben: Figur auf dem Feld in der Zweitfarbe, auf der Teilung in der Feldfarbe
      o += figurVorlage(figName, fx, fy, fgr, id + 'p');
      if (VEREDELN) o += figurSchatten(id + 'p', fgr, klein);
      o += figurNutzen(id + 'p', fgr, tinte, tinte, kont);
      o += `<g clip-path="url(#${id}u)">${figurNutzen(id + 'p', fgr, auf(zweit, feld), '', 0)}</g>`;
      o += `<g clip-path="url(#${id}t)">${figurNutzen(id + 'p', fgr, auf(feld, zweit), '', 0)}</g>`;
      notiere('figur', auf(zweit, feld), feld); notiere('figur', auf(feld, zweit), zweit);
    } else {
      const figF = PR.figFarbe || metall(zweit, feld);
      o += VEREDELN ? figurMitSchatten(figName, fx, fy, fgr, figF, tinte, kont, id + 'v', klein) : figur(figName, fx, fy, fgr, figF, tinte, kont);
      notiere('figur', figF, feld);
    }
    // Gründungsjahr links und rechts der Figur (nur groß), helle Ziffern mit dunkler Kontur – auf jedem Grund lesbar
    if (jahrDa) {
      const j = String(gruendung(t)), yJ = fy + 8, rand = fy > 120 ? 62 : 53, xl = Math.min(fx - fgr / 2 - 12, rand), xr = Math.max(fx + fgr / 2 + 12, 200 - rand);   // Schild wird nach unten schmaler
      const l = textGerade(j.slice(0, 2), { x: xl, y: yJ, groesse: 22, gew: 800, maxBreite: 26 }), r = textGerade(j.slice(2), { x: xr, y: yJ, groesse: 22, gew: 800, maxBreite: 26 });
      o += `<path d="${l.d}${r.d}" fill="#ffffff" stroke="${tinte}" stroke-width="5" stroke-linejoin="round" paint-order="stroke"/>`;
    }
    if (VEREDELN) o += glanz(id);
    o += '</g>';                                                            // Ende Clip
    o += `<path d="${pfad}" fill="none" stroke="${tinte}" stroke-width="${klein ? 11 : 8}" stroke-linejoin="round"/>`;
    if (VEREDELN && !klein) o += `<path d="${pfad}" fill="none" stroke="url(#${id}mt)" stroke-width="${PR.gold ? 6 : 3}" stroke-linejoin="round" transform="translate(100 108) scale(.94) translate(-100 -108)"/>`;
    if (VEREDELN && !klein && PR.gold) o += `<path d="${pfad}" fill="none" stroke="url(#${id}mt)" stroke-width="2.2" stroke-linejoin="round" transform="translate(100 108) scale(.86) translate(-100 -108)"/>`;
    o += '</g>';                                                            // Ende Transformation
    if (koenig) o += figur('crown', 100, oben - 6, 70, GOLD, tinte, 2.6) + `<path d="${stern(100, oben - 24, 4.2)}" fill="#ffffff" opacity=".85"/>`;
    else if (krone) o += mauerkrone(100, oben + 4, 108 * k / 0.8 * 0.92, ew >= 1000000 ? 5 : 3, GOLD, tinte);
    if (!klein) {
      const bandF = '#fbf7ee', schrift = auf(F.p, bandF, 4.5);
      o += band(spitzname(t), 100, 194, bandF, mische(bandF, F.p, 0.28), tinte, schrift, 196);
      notiere('schrift', schrift, bandF);
    }
    return o;
  }

  // ── Titelsterne (Bundesliga-Stufen: 1 ab 3 Titeln, 2 ab 5, 3 ab 10, 4 ab 20, 5 ab 30) ─────
  const STERN_STUFEN = [3, 5, 10, 20, 30];
  const sterneFuer = titel => STERN_STUFEN.filter(s => (titel || 0) >= s).length;
  function sterneOben(n, tinte) {
    let d = ''; const ab = 25, x0 = 100 - (n - 1) * ab / 2;
    for (let i = 0; i < n; i++) d += stern(x0 + i * ab, 13.5, 11);
    return `<path d="${d}" fill="${GOLD}" stroke="${tinte}" stroke-width="2.4" stroke-linejoin="round"/>`;
  }

  // ── Ein Wappen ────────────────────────────────────────────────────────────
  // Ab dieser Anzeigegröße (px) die große Variante (gemessen, D113): Ring- und Bandschrift sind erst ab 64 px lesbar,
  // das Monogramm ab 40 px; darunter Schild oder Kreis mit Figur bzw. Anfangsbuchstabe
  const SCHWELLE = { A: 64, B: 40, C: 64 };
  const ARTEN = ['A', 'B', 'C'];
  const INHALT = new Map(), HINTERGRUND = new Map();
  const merkeIn = (map, k, v) => { if (map.size > 600) map.clear(); map.set(k, v); return v; };
  function variante(t, opt) {
    let r = opt.richtung || 'D';
    const PR = prunkVon(t);
    if (r === 'D') r = PR ? (PR.art || 'C') : (ARTEN.indexOf(t.wappen_art) >= 0 ? t.wappen_art : 'C');
    // Nutzer 2026-10-17: „wirklich alle Wappen, die wie von Magdeburg sind, rausnehmen“ – kein Monogramm mehr als Vereinswappen;
    // diese Vereine bekommen je nach Verein fest ein Abzeichen (Ring) oder ein Heraldik-Schild
    if (r === 'B' && (!opt.richtung || opt.richtung === 'D')) r = hash(String(t.id || anzeigeName(t)) + 'art') % 2 ? 'A' : 'C';
    // ohne Größe die kleine Variante (fast jede Stelle im Spiel ist kleiner als 64 px)
    const klein = opt.klein != null ? !!opt.klein : (opt.groesse == null || opt.groesse < SCHWELLE[r]);
    const sterne = Math.max(0, Math.min(5, Math.round(opt.sterne || (PR && !klein && PR.krone !== 'koenig' && PR.sterne) || 0)));
    const key = [VEREDELN ? 'v2' : 'v1', PR ? JSON.stringify(PR) : '', r, klein ? 1 : 0, sterne, t.id, t.wappen_figur, (t.farben || []).join(), anzeigeName(t), t.city, t.einwohner, t.region, kuerzelVon(t)].join('|');
    return { r, klein, sterne, key };
  }
  // Inhalt mit Platzhalter § für die IDs (je Aufruf neu ersetzt)
  function inhaltVon(t, v, protokoll) {
    PROT = Array.isArray(protokoll) ? protokoll : null;
    let inhalt = PROT ? null : INHALT.get(v.key);
    if (inhalt == null) {
      try {
        // Prunk-Figur auch im Abzeichen (z. B. Lilie bei Darmstadt)
        const PR = v.r === 'A' && prunkVon(t), tA = PR && PR.figur && W().figuren[PR.figur] ? Object.assign({}, t, { wappen_figur: PR.figur }) : t;
        const roh = v.r === 'A' ? abzeichen(tA, '§', v.klein) : v.r === 'B' ? monogramm(t, '§', v.klein) : heraldik(t, '§', v.klein);
        inhalt = v.sterne ? `<g transform="translate(15 26) scale(.85)">${roh}</g>${sterneOben(v.sterne, farbenVon(t).tinte)}` : roh;
      } finally { if (!PROT) merkeIn(INHALT, v.key, inhalt); PROT = null; }
    }
    return inhalt;
  }
  const bereit = () => { const D = W(); return !!(D && D.schilde && D.figuren && D.glyphen && D.kern); };
  // team: Verein aus data/league.json, der Welt oder dem Spiel (fehlende Felder kommen aus DFL_LIGA)
  // opt.richtung 'A' | 'B' | 'C' | 'D' (Standard: Art des Vereins) · opt.groesse Anzeigegröße in px (wählt die Variante,
  // setzt width/height; ohne Größe die kleine Variante) · opt.klein true/false erzwingt die Variante ·
  // opt.sterne 0–5 Titelsterne (nur groß sinnvoll) · opt.stil 'linie' = v1 (Tabler-Icons) · opt.protokoll Array für den Kontrast-Prüflauf
  function wappenSvg(team, opt) {
    opt = opt || {};
    if (!team) return '';
    if (opt.stil === 'linie' || !bereit()) return wappenLinie(team, opt);
    try {
      const t = teamDaten(team), v = variante(t, opt);
      const inhalt = inhaltVon(t, v, opt.protokoll);
      const id = 'dw' + (++zaehler).toString(36) + (hash(String(t.id || 'x')) % 1296).toString(36);
      const g = opt.groesse ? ` width="${opt.groesse}" height="${Math.round(opt.groesse * 1.08)}"` : '';
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 216"${g} role="img" aria-label="Wappen ${esc(anzeigeName(t))}">` +
        inhalt.replace(/§/g, id) + '</svg>';
    } catch (e) {
      console.warn('[DFL-Identität] Wappen', team && team.id, e);
      return wappenLinie(team, opt);                                       // ein Fehler im Wappen darf das Spiel nicht aufhalten
    }
  }
  // Für bestehende Stellen im Spiel, die Wappen per style="…" setzen (crestStyle): kleine Variante, außer opt.groesse
  // liegt über der Schwelle. Ein data:-Bild ist ein eigenes Dokument → feste IDs, der fertige Stil wird zwischengespeichert.
  // Einfache Anführungszeichen: das Spiel setzt Crests per style="${crestStyle(id)}" in Templates
  const alsHintergrund = svg => `background:url('data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, '%27')}') center/contain no-repeat;color:transparent;border:0;border-radius:0;`;
  function wappenHintergrund(team, opt) {
    const o = opt || {};
    if (!team) return '';
    if (!bereit()) return alsHintergrund(wappenLinie(team, {}));
    try {
      const t = teamDaten(team), v = variante(t, o);
      return HINTERGRUND.get(v.key) || merkeIn(HINTERGRUND, v.key,
        alsHintergrund(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 216">` + inhaltVon(t, v).replace(/§/g, 'w') + '</svg>'));
    } catch (e) {
      console.warn('[DFL-Identität] Wappen', team && team.id, e);
      return alsHintergrund(wappenLinie(team, {}));
    }
  }

  // ── Gesichter (facesjs) ──────────────────────────────────────────────────
  // Aus dem Seed reproduzierbar: Für den Aufruf von generate() wird der Seed-Zufall
  // untergeschoben. Spieler ohne seed (Altbestand des Spiels) bekommen einen aus id/Name.
  function seedZufall(seed) {
    // Kommazahl (Generator, 0–1) oder ganze Zahl (Spiel) → 32-Bit-Startwert
    let a = (seed >= 1 ? Math.floor(seed) : Math.floor((seed || 0.5) * 4294967296)) >>> 0 || 1;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0; let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const GESICHTER = new Map(), SVGS = new Map();
  // Anteile der facesjs-Typen je Namensgruppe (DFLGenerator.GRUPPEN). facesjs kennt nur vier grobe Töne – Typ bestimmt
  // Haar und Züge, eine eigene Hautliste (dritter Eintrag) legt olivfarbene und mittlere Töne dazwischen.
  const OLIV = ['#e8c3a6', '#dcb08e', '#d0a07e'], MITTEL = ['#c99878', '#bb876f', '#a87a60'];
  const HAUT = {
    deutsch: [['white', 0.80], ['white', 0.04, OLIV], ['black', 0.10], ['brown', 0.04, MITTEL], ['asian', 0.02]],
    tuerkisch: [['brown', 0.70, OLIV], ['white', 0.20], ['brown', 0.10, MITTEL]],
    arabisch: [['brown', 0.50, OLIV], ['brown', 0.40, MITTEL], ['black', 0.10]],
    englisch: [['white', 0.70], ['black', 0.25], ['brown', 0.05, MITTEL]],
    spanisch: [['white', 0.45], ['brown', 0.40, OLIV], ['brown', 0.10, MITTEL], ['black', 0.05]]
  };
  const zieheTyp = (liste, u) => { for (const x of liste) { if (u < x[1]) return x; u -= x[1]; } return liste[0]; };
  const seedVon = p => (typeof p.dflSeed === 'number' && p.dflSeed > 0) ? p.dflSeed
    : (typeof p.seed === 'number' && p.seed > 0) ? p.seed : (hash(String(p.id || '') + (p.firstName || '') + (p.name || '')) / 4294967296) || 0.5;
  function gesichtFuer(p) {
    const F = window.facesjs;
    if (!F) return null;
    if (p.gesicht) return p.gesicht;                       // später z. B. im Editor angepasst
    const key = seedVon(p);
    if (!GESICHTER.has(key)) {
      const orig = Math.random;
      Math.random = seedZufall(key);
      try {
        // Hautton passend zur Namensgruppe (2026-10-13), sonst bekam jeder vierte ein asiatisches Gesicht
        const her = window.DFLGenerator && DFLGenerator.herkunftVon ? DFLGenerator.herkunftVon(p) : 'deutsch';
        const typ = zieheTyp(HAUT[her] || HAUT.deutsch, Math.random()), haut = typ[2] ? typ[2][Math.floor(Math.random() * typ[2].length)] : null;
        const face = F.generate({ jersey: { id: 'jersey' }, accessories: { id: 'none' }, glasses: { id: 'none' } }, { gender: 'male', race: typ[0] });
        if (haut && face.body) face.body.color = haut;
        GESICHTER.set(key, face);
      } finally { Math.random = orig; }
    }
    return GESICHTER.get(key);
  }
  // ── Fußballtrikots (2026-10-13) ─────────────────────────────────────────
  // facesjs kennt nur Basketball-, Football-, Hockey- und Baseball-Hemden. Wir erzeugen mit dem Basketball-Hemd und
  // tauschen dessen Pfad (feste Form im 400 × 600-Raster von facesjs) gegen ein Fußballtrikot mit Ärmelansatz:
  // Rundkragen, V-Ausschnitt oder Polokragen – je Verein fest (aus der ID), Farben = Vereinsfarben.
  const TANK = /<path fill="([^"]+)" stroke="#000" stroke-width="6" d="M80 610s10-30 10-90l20-10s10 80 90 80 90-80 90-80l20 10c0 60 10 90 10 90z"\/>/;
  const TRIKOTARTEN = ['rund', 'v', 'polo'];
  function trikotArt(team) {
    if (!team) return 'rund';
    if (team.trikot && TRIKOTARTEN.indexOf(team.trikot) >= 0) return team.trikot;
    return TRIKOTARTEN[hash(String(team.id || team.name || '')) % 3];
  }
  function trikotSvg(art, a, b) {
    const k = '#000', rumpf = 'M-5 610c0-45 10-70 60-82l85-30h120l85 30c50 12 60 37 60 82z';
    const naht = `<path fill="none" stroke="${k}" stroke-width="3" opacity=".55" d="M70 600c5-30 0-50-10-68M330 600c-5-30 0-50 10-68"/>`;
    let hals;
    if (art === 'v') {
      hals = `<path fill="${b}" stroke="${k}" stroke-width="5" d="M140 498l60 62 60-62h-16l-44 44-44-44z"/>`;
    } else if (art === 'polo') {
      hals = `<path fill="${a}" stroke="${k}" stroke-width="4" d="M188 505h24v55h-24z"/>` +
        `<circle cx="200" cy="522" r="4" fill="${b}" stroke="${k}" stroke-width="2"/><circle cx="200" cy="544" r="4" fill="${b}" stroke="${k}" stroke-width="2"/>` +
        `<path fill="${b}" stroke="${k}" stroke-width="5" stroke-linejoin="round" d="M138 494l62 14-30 34zM262 494l-62 14 30 34z"/>`;
    } else {
      hals = `<path fill="none" stroke="${k}" stroke-width="20" d="M140 497c18 34 102 34 120 0"/>` +
        `<path fill="none" stroke="${b}" stroke-width="12" d="M140 497c18 34 102 34 120 0"/>`;
    }
    return `<g class="trikot"><path fill="${a}" stroke="${k}" stroke-width="6" d="${rumpf}"/>${naht}${hals}</g>`;
  }
  function fussballTrikot(svg, team, a, b) {
    const m = svg.match(TANK);
    if (!m) return svg;                                   // andere facesjs-Version: Hemd bleibt
    // Trikots v1 (kickstil_trikots.js, 2026-10-17): Muster, Bündchen und Wappen des Heimtrikots; ohne Verein schlicht
    if (window.KSTrikot && team && team.farben) return svg.replace(TANK, () => KSTrikot.portraet(KSTrikot.ausstattung(team).heim));
    return svg.replace(TANK, trikotSvg(trikotArt(team), a, b));
  }

  // SVG eines Spielergesichts in den Farben seines Vereins (~2 ms je Gesicht, daher zwischengespeichert)
  function gesichtSvg(p, team) {
    const F = window.facesjs, face = gesichtFuer(p);
    if (!F || !face) return '';
    const [a, b] = (team && team.farben) || ['#3a4250', '#ffffff'];
    const key = seedVon(p) + '|' + a + b + '|' + trikotArt(team);
    if (!SVGS.has(key)) {
      if (SVGS.size > 800) SVGS.clear();
      const c = Object.assign({}, face, { teamColors: [a, b, mische(a, '#000000', 0.45)] });
      SVGS.set(key, fussballTrikot(F.faceToSvgString(c), team, a, b).replace('<svg ', '<svg role="img" aria-label="Gesicht" '));
    }
    // eigene IDs je Einsatz (Muster-Clip im Trikot), sonst greift ein verstecktes Porträt
    return SVGS.get(key).replace(/KSTID/g, 'kst' + (++TRIKOT_ID));
  }
  let TRIKOT_ID = 0;

  // ── Vereinsfarben als Oberfläche ─────────────────────────────────────────
  // Setzt die Variablen des Spiels (--accent …) für den gewählten Verein.
  function vereinsTheme(team, ziel) {
    const el = ziel || document.documentElement;
    let grund = getComputedStyle(el).getPropertyValue('--bg').trim();
    if (!/^#[0-9a-f]{3,8}$/i.test(grund) && !/^rgb/.test(grund)) grund = '#111113';
    const [p, s] = team.farben || ['#25c065', '#ffffff'];
    // Fläche: Primärfarbe, außer sie verschwindet auf dem Grund. Auf hellem Grund reicht weniger,
    // weil Flächen dort Schatten und dunkle Schrift haben (BVB bleibt gelb).
    const minF = luminanz(grund) > 0.5 ? 1.12 : 1.8;
    const basis = kontrast(p, grund) >= minF ? p : (kontrast(s, grund) >= minF ? s : lesbar(p, grund, minF));
    // Schrift auf der Fläche (Scorebug, Ticker): Weiß oder Fast-Schwarz, je nachdem was besser liest.
    // Reicht beides nicht für 4,5:1 (kräftiges Rot), wird die Fläche leicht abgedunkelt bzw. aufgehellt.
    const ink = kontrast(basis, '#ffffff') >= kontrast(basis, '#111113') ? '#ffffff' : '#111113';
    let flaeche = basis;
    for (let t = 0.04; kontrast(ink, flaeche) < 4.5 && t <= 0.4; t += 0.04) {
      const c = mische(basis, ink === '#ffffff' ? '#000000' : '#ffffff', t);
      if (kontrast(c, grund) < minF) break;
      flaeche = c;
    }
    el.style.setProperty('--accent', flaeche);
    el.style.setProperty('--accent-text', lesbar(flaeche, grund, 4.5));            // Text in Vereinsfarbe
    el.style.setProperty('--accent-ink', ink);
    el.style.setProperty('--verein-2', s);
    el.style.setProperty('--verein-1', p);
    return { flaeche, text: lesbar(flaeche, grund, 4.5) };
  }

  // ── Icons & Emoji ────────────────────────────────────────────────────────
  function icon(name, klasse) {
    const inhalt = ICONS()[name];
    // Nicht im Auszug: Tabler-Webfont des Spiels (index.html lädt tabler-icons)
    if (!inhalt) return name ? `<i class="ti ti-${name} dfl-icon${klasse ? ' ' + klasse : ''}" aria-hidden="true"></i>` : '';
    return `<svg class="dfl-icon${klasse ? ' ' + klasse : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inhalt}</svg>`;
  }
  // Emoji → Zeichen: EINE Tabelle für das ganze Spiel in js/dfl_kenney_patch.js (D104, DFLKenney.EMOJI: game-icons
  // in Farbmarken, Tabler für Bedienung). dfl_kenney_patch.js lädt später und setzt EMOJI und emojiZuIcon hier ein;
  // bis dahin fallen Emojis nur weg (keine zweite Tabelle mehr).
  const EMOJI = {};
  function emojiZuIcon(text) {
    if (window.DFLKenney) return window.DFLKenney.zuIcons(text);
    return String(text).replace(/(?:\p{Regional_Indicator}{2}|\p{Extended_Pictographic})\uFE0F?\s?/gu, '');
  }


  // Mitwirkende (Lizenzpflicht CC BY 3.0): Autoren der verwendeten Figuren
  function mitwirkende(teams) {
    const D = W(); if (!D) return [];
    const autoren = {};
    (teams || []).forEach(t => { const f = D.figuren[t.wappen_figur]; if (f) (autoren[f.autor] = autoren[f.autor] || new Set()).add(t.wappen_figur); });
    return Object.entries(autoren).map(([autor, set]) => ({ autor, figuren: [...set].sort() }));
  }

  window.DFLIdentitaet = { veredeln(b) { VEREDELN = b !== false; HINTERGRUND.clear(); }, wappenSvg, wappenHintergrund, sterneFuer, gesichtSvg, gesichtFuer, trikotArt, trikotSvg, vereinsTheme, icon, emojiZuIcon, mitwirkende,
    kontrast, lesbar, EMOJI, FORMEN: Object.keys(FORMEN), TEILUNGEN: Object.keys(TEILUNGEN),
    WAPPEN: { SCHWELLE, ARTEN, STERN_STUFEN, NAH, heraldikWahl, spitzname, stadtVon, kuerzelVon, anzeigeName, teamDaten, textGerade, textBogen } };
  console.log('%c[DFL-Identität v2] aktiv', 'color:#3fb950;font-weight:bold',
    '— Wappen D113 (Abzeichen, Monogramm, Heraldik plus; Schrift als Rubik-Pfad, Titelsterne), Gesichter (facesjs), Vereinsfarben, Icons statt Emoji');
})();
