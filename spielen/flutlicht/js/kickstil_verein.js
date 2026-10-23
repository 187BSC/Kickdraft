/* ===== kickstil_verein.js =====
   KICKSTIL · VEREINE, WAPPEN, GESICHTER, TAG/NACHT  ·  v1   (2026-10-15)
   ─────────────────────────────────────────────────────────────────────────────
   Die Identität aus Kickdraft (dfl_identitaet.js: Wappen-Generator, facesjs-
   Gesichter, Vereinsfarben als Oberfläche) für UNSERE echten Vereine. Kickdraft
   speist sie aus seinen 32 Franchises (DFLSpiel.franchise); hier kommen die Daten
   aus dem Spiel selbst:
     · Name aus Liga, Pokal, Kartei bzw. CLUB (eigener Verein = 'fcm')
     · Stadt und Kürzel aus dem Namen („Borussia Dortmund“ → Dortmund, DOR),
       ein paar Vereine mit anderem Ort fest eingetragen (Bayern → München …)
     · Farben aus club_colors.js (HSL der unbekannten Vereine → Hex umgerechnet)
     · Wappenart, Figur, Region, Einwohner fest aus Name/Stadt abgeleitet
   Die Wappen sind generiert (Schilde Armoria, Figuren game-icons.net) – keine
   echten Vereinslogos; die Liste NAH in dfl_identitaet.js hält bekannte Formen fern.

   Dazu aus dfl_design_patch.js übernommen (dort an die DFL gebunden):
     · Stil Kenney Tag / Nacht (nach Uhrzeit oder fest, je Gerät 'dfl-stil')
     · crestStyle → Wappen, eigenes Wappen auf der Startseite, Vereinsfarbe als Akzent
     · Gesichter in Aufstellungsliste und Spielerkarte
   API: KSVerein.daten(id) · .eigen() · .gesicht(p, id) · .wappen(id, opt) ·
        DFLDesign.stilWahl() · .stilSetzen(w) · .stilAnwenden() · .farbenSetzen()
   Lädt nach dfl_identitaet.js und club_colors.js, vor kickstil_app_shell.js.
   ============================================================================= */
(function () {
  'use strict';
  const I = window.DFLIdentitaet;
  if (!I) { console.warn('[Kickstil-Verein] DFLIdentitaet fehlt – Modul inaktiv'); return; }
  const hatClub = () => typeof CLUB !== 'undefined' && CLUB;
  const root = document.documentElement;

  function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  // hsl(…) aus club_colors.js → #rrggbb (der Wappen-Generator rechnet nur mit Hex/RGB)
  function hex(farbe) {
    const f = String(farbe || '').trim();
    if (/^#[0-9a-f]{6}$/i.test(f)) return f.toLowerCase();
    if (/^#[0-9a-f]{3}$/i.test(f)) return '#' + f.slice(1).split('').map(c => c + c).join('').toLowerCase();
    const m = /^hsl\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)$/i.exec(f);
    if (m) {
      const h = +m[1] / 360, s = +m[2] / 100, l = +m[3] / 100;
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
      const k = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
      return '#' + [k(h + 1 / 3), k(h), k(h - 1 / 3)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
    }
    return '#3a4250';
  }

  // ── Ort, Region, Einwohner ────────────────────────────────────────────────
  // Vereine, deren Name den Ort nicht trägt (Schlüssel = Vereins-ID ohne club_)
  const ORT = { bayern: 'München', hoffenheim: 'Sinsheim', union: 'Berlin', hertha: 'Berlin', gladbach: 'Mönchengladbach',
    stpauli: 'Hamburg', schalke: 'Gelsenkirchen', elversberg: 'Spiesen-Elversberg', unterhaching: 'Unterhaching' };
  const REGION = {
    hafen: ['Hamburg', 'Bremen', 'Kiel', 'Rostock', 'Lübeck', 'Emden', 'Bremerhaven', 'Wilhelmshaven', 'Cuxhaven', 'Stralsund', 'Wismar', 'Flensburg', 'Meppen'],
    fluss: ['Köln', 'Düsseldorf', 'Mainz', 'Koblenz', 'Dresden', 'Magdeburg', 'Frankfurt', 'Würzburg', 'Regensburg', 'Passau', 'Ulm', 'Mannheim',
      'Ludwigshafen', 'Bonn', 'Leverkusen', 'Duisburg', 'Krefeld', 'Halle', 'Jena', 'Wiesbaden', 'Offenbach', 'Heidelberg', 'Trier', 'Saarbrücken'],
    zechen: ['Gelsenkirchen', 'Dortmund', 'Bochum', 'Essen', 'Oberhausen', 'Herne', 'Recklinghausen', 'Bottrop', 'Gladbeck', 'Spiesen-Elversberg',
      'Aue', 'Zwickau', 'Cottbus', 'Wattenscheid', 'Ahlen', 'Lünen', 'Homburg'],
    alpen: ['München', 'Unterhaching', 'Rosenheim', 'Kempten', 'Memmingen', 'Burghausen', 'Garmisch', 'Sonthofen', 'Ingolstadt', 'Freiburg']
  };
  const EINWOHNER = { Berlin: 3600000, Hamburg: 1850000, 'München': 1500000, 'Köln': 1080000, Frankfurt: 760000, Stuttgart: 630000,
    'Düsseldorf': 620000, Leipzig: 600000, Dortmund: 590000, Essen: 580000, Bremen: 570000, Dresden: 560000, Hannover: 535000,
    'Nürnberg': 515000, Duisburg: 500000, Bochum: 365000, Bielefeld: 335000, Bonn: 330000, 'Münster': 315000, Mannheim: 315000,
    Karlsruhe: 308000, Augsburg: 300000, Wiesbaden: 280000, 'Mönchengladbach': 260000, Gelsenkirchen: 260000, Aachen: 250000,
    Braunschweig: 250000, Kiel: 247000, Chemnitz: 245000, Halle: 238000, Magdeburg: 237000, Freiburg: 232000, Krefeld: 228000,
    Mainz: 218000, 'Lübeck': 216000, Oberhausen: 210000, Erfurt: 214000, Rostock: 209000, Kassel: 200000, Hagen: 189000,
    'Saarbrücken': 180000, Potsdam: 183000, Ludwigshafen: 172000, Leverkusen: 163000, Oldenburg: 170000, 'Osnabrück': 165000,
    Heidelberg: 160000, Darmstadt: 160000, Paderborn: 152000, Regensburg: 153000, Ingolstadt: 138000, 'Würzburg': 127000,
    Wolfsburg: 125000, Ulm: 126000, Heilbronn: 126000, Offenbach: 130000, 'Göttingen': 118000, Bottrop: 117000, Jena: 110000,
    Cottbus: 98000, Kaiserslautern: 100000, 'Fürth': 129000, Sandhausen: 15000, Heidenheim: 50000, Sinsheim: 36000 };
  const FORM = /^(\d+\.?|FC|SV|SC|VfL|VfB|TSG|TSV|FSV|SpVgg|SG|BV|RB|SSV|SpVg|KFC|MSV|FK|AC|AS|SK|SSC|SU|TuS|TSC|VfR|SVgg|II|U23|U21)$/i;
  const normId = id => { id = String(id || ''); return id.indexOf('club_') === 0 ? id.slice(5) : id; };

  // Vereinsname zu einer ID (Liga, Pokal, Kartei, eigener Verein)
  function teamVon(id) {
    if (id === 'fcm') return hatClub() ? { id: 'fcm', name: CLUB.name || 'Mein Verein', dataId: CLUB.dataClubId || null } : null;
    // Vereine, die nur mit Namen bekannt sind (Transfergebote: bid.club) – siehe idNachName
    if (String(id).indexOf('nm:') === 0) return { id, name: String(id).slice(3) };
    try {
      if (typeof LEAGUE !== 'undefined' && LEAGUE && typeof allGroups === 'function') {
        for (const g of allGroups(LEAGUE)) { const t = g.group.teams.find(x => x.id === id); if (t) return t; }
      }
    } catch (e) { /* Liga noch nicht da */ }
    try { if (typeof CUP !== 'undefined' && CUP && CUP.teamLookup && CUP.teamLookup[id]) return CUP.teamLookup[id]; } catch (e) { /* ohne Pokal */ }
    const roh = normId(id), K = window.EMBEDDED_CLUBS;
    const k = Array.isArray(K) ? K.find(c => c.id === roh) : null;
    if (k) return { id, name: k.name, dataId: k.id };
    // Europapokal-Gegner (data/euro_clubs.js) und der Gegner des aktuellen Spiels
    const E = window.EURO_CLUBS;
    const e = Array.isArray(E) ? E.find(c => c.id === id || c.id === roh) : null;
    if (e) return { id, name: e.name, dataId: e.id, land: e.country };
    try { if (typeof CURRENT_FIXTURE !== 'undefined' && CURRENT_FIXTURE && CURRENT_FIXTURE.opponentId === id && CURRENT_FIXTURE.opponentTeam) return Object.assign({ id }, CURRENT_FIXTURE.opponentTeam); } catch (e2) { /* ohne Spiel */ }
    return { id, name: String(id || 'Verein') };
  }
  // Vereinswörter, die kein Ort sind (bleiben nur stehen, wenn sonst nichts übrig ist)
  const VEREINSWORT = /^(Kickers|BSC|Dynamo|Borussia|Eintracht|Fortuna|Alemannia|Arminia|Hertha|Werder|Viktoria|Germania|Wacker|Union|Hansa|Energie|Lokomotive|Chemie|Stahl|Preußen|Rot-Weiß|Rot-Weiss|Schwarz-Weiß|Blau-Weiß|Sportfreunde|Teutonia|Concordia|Jahn|Holstein|Carl|Zeiss|Erzgebirge|Bayern|Fortuna|Tasmania|Altglienicke|Babelsberg|Optik|Kickers)$/i;
  // Ortsadjektive vor der Rechtsform: „Hamburger SV“ → Hamburg; unregelmäßige fest
  const ADJ = { Hallescher: 'Halle', Heider: 'Heide', Bremer: 'Bremen', 'Münchner': 'München', Bahlinger: 'Bahlingen', Karlsruher: 'Karlsruhe',
    Hannoverscher: 'Hannover', Hallesche: 'Halle', Oldenburger: 'Oldenburg' };
  const NAME_ORT = { 'BFC Dynamo': 'Berlin', 'Hertha BSC': 'Berlin', 'Hertha BSC II': 'Berlin', 'VSG Altglienicke': 'Berlin',
    'SV Babelsberg 03': 'Potsdam', 'BFC Preussen': 'Berlin', 'Berliner AK 07': 'Berlin' };
  function ortVon(t) {
    const key = normId(t.dataId || t.id), nm = String(t.name || '');
    if (ORT[key]) return ORT[key];
    if (NAME_ORT[nm]) return NAME_ORT[nm];
    const roh = nm.split(/\s+/).filter(Boolean);
    // Ortsadjektiv direkt vor Rechtsform oder Vereinswort („Würzburger Kickers“, „Bonner SC“), nicht „Hannover 96“
    for (let i = 0; i + 1 < roh.length; i++) {
      const w = roh[i], n = roh[i + 1];
      if (/^[A-ZÄÖÜ][a-zäöüß]+er$/.test(w) && ((FORM.test(n) && !/^\d/.test(n)) || VEREINSWORT.test(n))) return ADJ[w] || w.slice(0, -2);
    }
    const teile = roh.filter(w => !FORM.test(w) && !/^\d+$/.test(w) && w !== 'II');
    const orte = teile.filter(w => !VEREINSWORT.test(w));
    const wahl = (orte.length ? orte : teile);
    return wahl.length ? wahl[wahl.length - 1].replace(/[^A-Za-zÄÖÜäöüß-]/g, '') || wahl[wahl.length - 1] : 'Verein';
  }
  let FIGUREN = null;
  // Wunschfigur passend zum neuen Vereinsnamen (data/vereinsnamen.js, 3. Spalte; Nutzer 2026-10-15) – sonst Hash
  function wunschFigur(name) {
    const f = window.KSVereinsnamen && KSVereinsnamen.figur ? KSVereinsnamen.figur(name) : null;
    if (!f) return null;
    figurVon(0);
    return FIGUREN.indexOf(f) >= 0 ? f : null;
  }
  function figurVon(h) {
    if (!FIGUREN) { const W = window.DFL_WAPPEN; FIGUREN = W && W.figuren ? Object.keys(W.figuren).sort() : []; }
    return FIGUREN.length ? FIGUREN[h % FIGUREN.length] : undefined;
  }

  function farbenVon(id, t) {
    let farben = ['#3a4250', '#ffffff'];
    try {
      if (typeof clubColors === 'function') {
        // eigener Verein: Farben des gewählten echten Vereins, falls bekannt
        const c = clubColors(id === 'fcm' && t.dataId ? t.dataId : (t.dataId || id));
        if (c && c[0]) farben = [hex(c[0]), hex(c[1] || '#ffffff')];
      }
    } catch (e) { /* Standardfarben */ }
    return farben;
  }
  // Farbfamilie für den Wappen-Abgleich: unbunt nach Helligkeit, sonst 12 Farbtöne à 30°
  function farbFamilie(hx) {
    const n = parseInt(String(hx).slice(1), 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    if (s < 0.18 || d < 0.08) return l < 0.3 ? 'dunkel' : l > 0.75 ? 'hell' : 'grau';
    let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
    return 'h' + (Math.round(h / 30) % 12);
  }
  // Figuren einmal für alle Ligavereine vergeben (Test 2026-10-15: Werder und Lok Leipzig trugen dieselbe Eiche in
  // fast demselben Grün – 32 Figuren auf 146 Vereine, reiner Hash-Zufall). Reihenfolge nach Namen, damit jeder Verein
  // seine Figur behält; Wunschfigur aus dem Hash, bei gleicher Farbfamilie + Figur die nächste freie.
  let FIG_KARTE = null, FIG_STAND = '';
  function figurKarte() {
    if (typeof LEAGUE === 'undefined' || !LEAGUE || !LEAGUE.tiers || typeof allGroups !== 'function') return null;
    let teams;
    try { teams = allGroups(LEAGUE).reduce((a, g) => a.concat(g.group.teams), []); } catch (e) { return null; }
    const nameVon = t => (t.id === 'fcm' && hatClub() ? CLUB.name : t.name);
    const stand = teams.length + '|' + teams.map(nameVon).sort().join(',').length + '|' + (hatClub() ? CLUB.name : '');
    if (FIG_KARTE && FIG_STAND === stand) return FIG_KARTE;
    figurVon(0);
    if (!FIGUREN.length) return null;
    const belegt = new Set(), karte = new Map();
    teams.map(t => ({ t, name: nameVon(t) })).sort((a, b) => a.name.localeCompare(b.name)).forEach(({ t, name }) => {
      const tt = t.id === 'fcm' ? Object.assign({}, teamVon('fcm') || t, { name }) : Object.assign({}, t, { name });   // eigener Verein: Farben des gewählten Klubs (dataId)
      const fam = farbFamilie(farbenVon(t.id, tt)[0]);
      const wunsch = wunschFigur(name);
      if (wunsch) { belegt.add(fam + '|' + wunsch); karte.set(name, wunsch); return; }
      let i = (hash(String(name) + '|' + ortVon(tt)) >>> 5) % FIGUREN.length, n = 0;
      while (belegt.has(fam + '|' + FIGUREN[i]) && n++ < FIGUREN.length) i = (i + 1) % FIGUREN.length;
      belegt.add(fam + '|' + FIGUREN[i]);
      karte.set(name, FIGUREN[i]);
    });
    FIG_KARTE = karte; FIG_STAND = stand;
    CACHE.clear();                                     // vorher (ohne Liga) gerechnete Wappen neu
    return FIG_KARTE;
  }

  const CACHE = new Map();
  function daten(id) {
    if (id == null) return null;
    const t = teamVon(id); if (!t) return null;
    const karte = figurKarte();
    const key = id + '|' + t.name;
    if (CACHE.has(key)) return CACHE.get(key);
    const KN = window.KSVereinsnamen;
    const city = (KN && KN.ort && KN.ort(t.name)) || ortVon(t), h = hash(String(t.name) + '|' + city);
    const farben = farbenVon(id, t);
    let region = null;
    for (const r of Object.keys(REGION)) if (REGION[r].indexOf(city) >= 0) { region = r; break; }
    const kuerzel = city.replace(/[^A-Za-zÄÖÜäöüß]/g, '').slice(0, 3).toUpperCase() || 'VER';
    // Wappenart: nur Heraldik (C) oder Monogramm (B). KEINE runden Abzeichen mit Ringschrift (A) – viele echte
    // Vereinslogos sind rund mit Stadtnamen (Bayern, Köln, Schalke, Mainz …); mit echten Vereinsnamen wäre das
    // zu nah am Original (Kickdraft hat nur erfundene Vereine und nutzt A dort).
    const r = h % 100;
    // Mit Wunschfigur immer Heraldik (C): ein Monogramm (B) nähme den Buchstaben aus dem ALTEN Namen („Villa“ → V)
    // Neue (erfundene) Namen: wieder wie Kickdraft – rundes Abzeichen mit Ringschrift (A) oder Heraldik mit Spruchband (C)
    const wappen_art = wunschFigur(t.name) ? (r < 25 ? 'A' : 'C') : r < 80 ? 'C' : 'B';
    // Spruchband/Ringschrift werden als Pfade gezeichnet (die Anzeige-Schicht erreicht sie nicht) → neuer Name direkt
    const neuName = KN && KN.neu ? KN.neu(t.name) : t.name;
    const d = { id, name: t.name, spec_name: neuName, spitz: (KN && KN.spitz && KN.spitz(t.name)) || null, city, kuerzel, farben, region,
      einwohner: EINWOHNER[city] || (60000 + (h % 240000)), wappen_art, wappen_figur: wunschFigur(t.name) || (karte && karte.get(t.name)) || figurVon(h >>> 5) };
    if (CACHE.size > 800) CACHE.clear();
    CACHE.set(key, d);
    return d;
  }
  const eigen = () => daten('fcm');
  // Vereins-ID zu einem Namen: Liga, Pokal, Kartei, Europa – sonst eine Namens-ID („nm:Name“), die genauso Wappen bekommt
  const NAMEN_ID = new Map();
  function idNachName(name) {
    if (!name) return null;
    if (hatClub() && name === CLUB.name) return 'fcm';
    if (NAMEN_ID.has(name)) return NAMEN_ID.get(name);
    let id = null;
    try {
      if (typeof LEAGUE !== 'undefined' && LEAGUE && typeof allGroups === 'function') {
        for (const g of allGroups(LEAGUE)) { const t = g.group.teams.find(x => x.name === name); if (t) { id = t.id; break; } }
      }
      if (!id && Array.isArray(window.EMBEDDED_CLUBS)) { const k = window.EMBEDDED_CLUBS.find(c => c.name === name); if (k) id = 'club_' + k.id; }
      if (!id && Array.isArray(window.EURO_CLUBS)) { const e = window.EURO_CLUBS.find(c => c.name === name); if (e) id = e.id; }
    } catch (e) { /* Namens-ID */ }
    id = id || ('nm:' + name);
    if (NAMEN_ID.size > 600) NAMEN_ID.clear();
    NAMEN_ID.set(name, id);
    return id;
  }
  function wappen(id, opt) { const d = daten(id); return d ? I.wappenSvg(d, opt || {}) : ''; }
  // Gesicht eines Spielers in den Farben seines Vereins (eigene Spieler: eigener Verein)
  function gesicht(p, vereinId) {
    if (!p || !window.facesjs) return '';
    let vid = vereinId;
    if (vid == null) {
      try {
        vid = (typeof SQUAD !== 'undefined' && SQUAD.some(q => q.id === p.id)) ? 'fcm'
          : p.clubId ? 'club_' + p.clubId : p.fromClub ? idNachName(p.fromClub) : null;   // Marktspieler: abgebender Verein
      } catch (e) { vid = null; }
    }
    const d = vid ? daten(vid) : null;
    try { return I.gesichtSvg(p, d ? { id: d.id, farben: d.farben } : null); } catch (e) { return ''; }
  }

  // ── Vereinsfarben als Akzent ─────────────────────────────────────────────
  let farbeFuer = null;
  function farbenSetzen() {
    if (!hatClub() || !CLUB.name) return;
    const k = CLUB.name + '|' + (CLUB.dataClubId || '') + '|' + root.className;
    if (farbeFuer === k) return;
    const d = eigen();
    if (d) { I.vereinsTheme(d, root); farbeFuer = k; }
  }

  // ── Stil Kenney Tag / Nacht (aus dfl_design_patch.js, D54) ───────────────
  const STIL_KEY = 'dfl-stil', WAHLEN = ['auto', 'tag', 'nacht'];
  function stilWahl() { try { const w = localStorage.getItem(STIL_KEY); return WAHLEN.indexOf(w) >= 0 ? w : 'auto'; } catch (e) { return 'auto'; } }
  const nachUhr = () => { const h = new Date().getHours(); return h >= 6 && h < 19 ? 'tag' : 'nacht'; };
  let modusJetzt = null;
  function stilAnwenden() {
    const m = stilWahl() === 'auto' ? nachUhr() : stilWahl();
    if (m === modusJetzt) return m;
    modusJetzt = m;
    root.classList.add('freundlich', 'kenney');
    root.classList.toggle('dark', m === 'nacht');
    root.classList.toggle('tag', m === 'tag');
    farbeFuer = null; farbenSetzen();            // Akzent hängt am Grund (Kontrast) → neu rechnen
    try { window.dispatchEvent(new CustomEvent('dfl-stil', { detail: m })); } catch (e) { /* alter Browser */ }
    return m;
  }
  function stilSetzen(w) {
    try { localStorage.setItem(STIL_KEY, WAHLEN.indexOf(w) >= 0 ? w : 'auto'); } catch (e) { /* nur bis zum Neuladen */ }
    modusJetzt = null; return stilAnwenden();
  }
  stilAnwenden();
  setInterval(stilAnwenden, 60000);

  // ── Wappen statt Farbkachel ──────────────────────────────────────────────
  // crestStyle(id, { groesse }) – unter 64 px die kleine Variante (fast jede Stelle im Spiel)
  {
    const _orig = window.crestStyle;
    window.crestStyle = function (id, opt) {
      const d = id != null ? daten(id) : null;
      if (!d) return _orig ? _orig.apply(this, arguments) : '';
      try { return I.wappenHintergrund(d, opt && opt.groesse ? { groesse: opt.groesse } : null); }
      catch (e) { return _orig ? _orig.apply(this, arguments) : ''; }
    };
    try { crestStyle = window.crestStyle; } catch (e) { /* nur window */ }
  }
  {
    // Kein Kürzel mehr auf dem Wappen (das Bild trägt es selbst)
    const _orig = window.crestInitials;
    window.crestInitials = function () { return ''; };
    window.crestInitialsAlt = _orig;
    try { crestInitials = window.crestInitials; } catch (e) { /* nur window */ }
  }

  // ── Startseite: eigenes Wappen + Farben ──────────────────────────────────
  {
    const _orig = window.renderHomeTab;
    if (typeof _orig === 'function') window.renderHomeTab = function () {
      const r = _orig.apply(this, arguments);
      try {
        farbenSetzen();
        const d = eigen(), b = document.getElementById('hc-badge');
        if (d && b) { b.textContent = ''; b.setAttribute('style', I.wappenHintergrund(d, { groesse: 54 })); b.classList.add('dfl-badge'); }
        const h = document.getElementById('hm-home-crest');
        if (d && h) { h.textContent = ''; h.setAttribute('style', I.wappenHintergrund(d, { groesse: 46 })); }
        const a = document.getElementById('hm-away-crest');
        if (a && /url\(/.test(a.getAttribute('style') || '')) a.textContent = '';
      } catch (e) { console.warn('[Kickstil-Verein] Startseite', e); }
      return r;
    };
    try { renderHomeTab = window.renderHomeTab; } catch (e) { /* nur window */ }
  }
  {
    const _orig = window.showTeamProfile;
    if (typeof _orig === 'function') window.showTeamProfile = function (id) {
      const r = _orig.apply(this, arguments);
      const c = document.querySelector('#team-profile-ov .tp-crest');
      if (c) c.textContent = '';
      return r;
    };
  }

  // ── Gesichter in Aufstellungsliste und Spielerkarte ──────────────────────
  function spielerAusZeile(row) {
    const attr = (row.getAttribute('onclick') || '') + ' ' + (row.getAttribute('ondragstart') || '');
    const slot = /clickSlot\('([^']+)'\)/.exec(attr);
    const id = slot ? (CLUB.lineup || {})[slot[1]] : (/'bench','([^']+)'/.exec(attr) || /clickBench\('([^']+)'\)/.exec(attr) || [])[1];
    return id ? SQUAD.find(p => p.id === id) : null;
  }
  {
    const _orig = window.renderSquadList;
    if (typeof _orig === 'function') window.renderSquadList = function () {
      const r = _orig.apply(this, arguments);
      if (window.facesjs) {
        farbenSetzen();
        document.querySelectorAll('#squad-list .squad-row').forEach(row => {
          if (row.querySelector('.dfl-face, .dfl-portrait')) return;
          const p = spielerAusZeile(row);
          if (p) row.insertAdjacentHTML('afterbegin', `<span class="dfl-portrait klein">${gesicht(p, 'fcm')}</span>`);
        });
      }
      return r;
    };
    try { renderSquadList = window.renderSquadList; } catch (e) { /* nur window */ }
  }
  {
    const _orig = window.renderPlayerCard;
    if (typeof _orig === 'function') window.renderPlayerCard = function (p) {
      const r = _orig.apply(this, arguments);
      if (p && window.facesjs) {
        const el = document.getElementById('playercard-sec');
        const name = el && el.querySelector('.pcard-name');
        if (name && !el.querySelector('.dfl-pcard-gesicht')) {
          name.insertAdjacentHTML('beforebegin', `<div class="dfl-pcard-gesicht"><span class="dfl-portrait">${gesicht(p)}</span></div>`);
        }
      }
      return r;
    };
    try { renderPlayerCard = window.renderPlayerCard; } catch (e) { /* nur window */ }
  }

  // Vereinswahl beim Karrierestart (showOnboarding, app_main.js): Wappen vor jeden Vereinsknopf.
  // Das Overlay baut sein innerHTML bei jedem Ligawechsel neu – daher ein Beobachter statt eines Wrappers.
  function vereinswahlWappen(ov) {
    ov.querySelectorAll('button[onclick^="window._obTeam"]:not([data-ks])').forEach(b => {
      b.dataset.ks = '1';
      const m = /,\s*'([^']*)'\)\s*$/.exec(b.getAttribute('onclick') || '');
      const id = m && m[1];
      const svg = id ? wappen(id) : '';
      if (svg) b.insertAdjacentHTML('afterbegin', `<span class="ks-ob-wappen">${svg}</span>`);
    });
  }
  new MutationObserver(() => {
    const ov = document.getElementById('onboarding-overlay');
    if (ov) vereinswahlWappen(ov);
  }).observe(document.body, { childList: true, subtree: true });

  window.KSVerein = { daten, eigen, wappen, gesicht, hex, ortVon, idNachName };
  window.DFLDesign = { farbenSetzen, stilWahl, stilSetzen, stilAnwenden, modus: () => modusJetzt };
  // Spielstand war schon vor diesem Modul da (initGame läuft vor den Patches): einmal neu zeichnen
  setTimeout(() => {
    try {
      farbenSetzen();
      ['renderHomeTab', 'renderLeagueTab', 'renderSquadList'].forEach(f => { if (typeof window[f] === 'function') window[f](); });
    } catch (e) { console.warn('[Kickstil-Verein] Neuzeichnen', e); }
  }, 0);
  console.log('[Kickstil-Verein v1] aktiv — generierte Wappen für echte Vereine, Gesichter, Vereinsfarbe als Akzent, Kenney '
    + (modusJetzt === 'tag' ? 'Tag' : 'Nacht') + ' (' + (stilWahl() === 'auto' ? 'nach Uhrzeit' : 'fest') + ')');
})();
