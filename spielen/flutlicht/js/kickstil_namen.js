/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · NAMEN  ·  v1   (Nutzer 2026-10-15: „alle echten Namen raus … lass den Spieler an sich existent, nur der
   Name sollte anders oder angepasst sein, sodass man ihn nur leicht erkennen könnte“)
   ─────────────────────────────────────────────────────────────────────────
   Verfremdung (deterministisch – gleicher Name ergibt immer dasselbe):
     · Nachname: Endung leicht verändert („Berger“ → „Bergert“, „Brinkmann“ → „Brinkmayr“, „-ski“ → „-sky“); bei langen Namen
       (ab 7 Buchstaben) zusätzlich eine kleine Schreibänderung im Wort (ll → l, ck → k, ç → c …). Erster Buchstabe bleibt.
     · Vorname: ein anderer Vorname mit demselben Anfangsbuchstaben aus dem Herkunftsland (Listen aus scouting_patch.js),
       sonst aus einem ähnlichen Land – „L. Berger“ wird „L. Bergert“ mit neuem Vornamen.
   Die Spielerdaten in data/game_data.js sind damit EINMAL umgeschrieben (Werkzeug tools/namen_verfremden.html).
   v2 (2026-10-16, vor dem Store): Leicht verfremdet reichte nicht – alle 1558 Kartei-Spieler haben jetzt ERFUNDENE Namen aus den
   Namenslisten ihres Landes (tools/namen_erfinden.js). Alte Spielstände und die Kartensammlung (fl-karten) werden über
   data/ks_namen2.js (Prüfsumme alter Name → neuer Name) umbenannt, nach der Verfremdung oben (echt → verfremdet → erfunden).
   Alte Spielstände: applyLoadedState benennt beim Laden jeden Spieler um, dessen alter Name (Vor- + Nachname) zu den
   früheren echten Spielern gehört oder dessen Nachname aus den alten Promi-Listen stammt. Erkannt wird das über
   Prüfsummen (KS_ALTNAMEN) – die echten Namen selbst stehen nirgends mehr im Spiel.
   Lädt nach engine_main.js und scouting_patch.js, vor init_bootstrap.js.
   API: KSNamen.verfremde(vorname, nachname, land) → { firstName, name } · .migriere() · .h32(text)
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  function h32(s) {
    let h = 2166136261 >>> 0; s = String(s || '');
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  // Endungen: längste zuerst; je zwei Varianten, die Prüfsumme wählt
  const ENDUNG = [
    ['oğlu', ['oglu', 'olu']], ['ović', ['ovic', 'owitsch']], ['ević', ['evic', 'ewitsch']], ['mann', ['mayr', 'manns']],
    ['sson', ['ssen', 'sohn']], ['ski', ['sky', 'szki']], ['cki', ['cky', 'tzki']], ['ska', ['sky', 'szka']], ['son', ['sen', 'sohn']], ['sen', ['son', 'ssen']],
    ['ies', ['ys', 'eys']], ['ner', ['nert', 'ners']], ['ich', ['ig', 'isch']], ['ell', ['el', 'elle']], ['er', ['ert', 'ers']], ['ig', ['ich', 'igk']], ['ić', ['ich', 'ics']],
    ['ez', ['es', 'etz']], ['es', ['ez', 'is']], ['el', ['ell', 'le']], ['en', ['enn', 'in']], ['in', ['ihn', 'en']], ['an', ['ahn', 'ann']], ['on', ['ohn', 'onn']],
    ['ar', ['ahr', 'ard']], ['or', ['ohr', 'ort']], ['us', ['os', 'uss']], ['is', ['iz', 'iss']], ['as', ['az', 'ass']], ['os', ['oz', 'oss']],
    ['ia', ['ja', 'ya']], ['io', ['jo', 'iu']], ['ie', ['y', 'ee']], ['tt', ['t', 'dt']], ['ck', ['k', 'kk']], ['tz', ['z', 'ts']], ['ss', ['s', 'ß']],
    ['nn', ['n', 'nd']], ['ll', ['l', 'lt']], ['rr', ['r', 'rd']], ['ng', ['nk', 'ngs']], ['ey', ['ay', 'ie']],
    ['a', ['e', 'o']], ['o', ['a', 'u']], ['i', ['y', 'e']], ['y', ['i', 'ey']], ['e', ['er', 'é']], ['u', ['o', 'ou']], ['t', ['dt', 'th']],
    ['d', ['dt', 't']], ['k', ['ck', 'g']], ['z', ['tz', 's']], ['s', ['ss', 'z']], ['n', ['nn', 'm']], ['l', ['ll', 'hl']], ['r', ['rr', 'hr']],
    ['m', ['mm', 'n']], ['h', ['hl', 'ch']], ['g', ['k', 'gh']], ['f', ['ff', 'v']], ['p', ['pp', 'b']], ['b', ['bb', 'p']], ['c', ['k', 'ck']],
    ['x', ['ks', 'gs']], ['w', ['v', 'ff']], ['v', ['w', 'f']], ['j', ['y', 'i']], ['q', ['k', 'c']],
    ['é', ['e', 'ée']], ['á', ['a', 'ah']], ['í', ['i', 'y']], ['ó', ['o', 'oh']], ['ú', ['u', 'uh']], ['ø', ['ö', 'oe']], ['ı', ['i', 'y']], ['ć', ['c', 'tsch']], ['č', ['c', 'tsch']],
    ['ñ', ['n', 'nj']], ['ş', ['s', 'sch']], ['ž', ['z', 'sch']], ['š', ['s', 'sch']], ['ł', ['l', 'w']], ['ü', ['ue', 'u']], ['ö', ['oe', 'o']], ['ä', ['ae', 'e']]
  ];
  const INNEN = [['ck', 'k'], ['tz', 'z'], ['ph', 'f'], ['th', 't'], ['ei', 'ai'], ['ai', 'ei'], ['ll', 'l'], ['tt', 't'], ['nn', 'n'], ['ss', 's'], ['mm', 'm'],
    ['ff', 'f'], ['rr', 'r'], ['ç', 'c'], ['ı', 'i'], ['ğ', 'g'], ['ş', 's'], ['ł', 'l'], ['ø', 'ö'], ['å', 'a'], ['ñ', 'n'], ['ć', 'c'], ['č', 'c'], ['š', 's'],
    ['ž', 'z'], ['đ', 'd'], ['ae', 'ä'], ['oe', 'ö'], ['ou', 'u'], ['ee', 'e'], ['oo', 'o'], ['dt', 't']];
  const gross = (alt, neu) => (alt && alt[0] === alt[0].toUpperCase() ? neu.charAt(0).toUpperCase() + neu.slice(1) : neu);
  function wortVerfremden(w, h) {
    if (!w || w.length < 2) return w;
    const klein = w.toLowerCase();
    // Stamm + neue Endung getrennt halten: die Änderung im Wortinneren darf die neue Endung nicht wieder aufheben
    let stamm = w, ende = '';
    for (const [e, alt] of ENDUNG) {
      if (klein.length > e.length && klein.endsWith(e)) { stamm = w.slice(0, w.length - e.length); ende = alt[h % alt.length]; break; }
    }
    if ((stamm + ende).length >= 7 || (stamm + ende).toLowerCase() === klein) {
      const start = (h >>> 4) % INNEN.length;
      for (let k = 0; k < INNEN.length; k++) {
        const [a, b] = INNEN[(start + k) % INNEN.length], i = stamm.toLowerCase().indexOf(a, 1);
        if (i > 0) { stamm = stamm.slice(0, i) + b + stamm.slice(i + a.length); break; }
      }
    }
    let neu = stamm + ende;
    if (neu.toLowerCase() === klein) neu = w + 'e';
    return gross(w, neu);
  }
  function nachname(last) {
    last = String(last || '');
    if (!last) return last;
    const h = h32(last);
    // nur das letzte Wort/Segment („de Jong“, „En-Nesyri“)
    const m = /^(.*[\s-])([^\s-]+)$/.exec(last);
    return m ? m[1] + wortVerfremden(m[2], h) : wortVerfremden(last, h);
  }
  let POOL = null, ALLE = null;
  function pools() {
    if (POOL) return POOL;
    POOL = {}; const alle = new Set();
    const SC = window.SCOUTING_COUNTRIES || {};
    Object.keys(SC).forEach(k => { const l = (SC[k] && SC[k].first) || []; POOL[k] = l.slice(); l.forEach(n => alle.add(n)); });
    if (typeof GERMAN_FIRST !== 'undefined') { POOL.Deutschland = Array.from(new Set((POOL.Deutschland || []).concat(GERMAN_FIRST))); GERMAN_FIRST.forEach(n => alle.add(n)); }
    ALLE = Array.from(alle).sort();
    Object.keys(POOL).forEach(k => POOL[k].sort());
    return POOL;
  }
  // Länder ohne eigene Liste → Namensraum eines ähnlichen Landes (sonst stünden Ghana-Vornamen bei Griechen)
  const NAH = { Kosovo: 'Serbien', Albanien: 'Serbien', 'Bosnien-Herzegowina': 'Kroatien', Bosnien: 'Kroatien', Nordmazedonien: 'Serbien',
    Montenegro: 'Serbien', Slowenien: 'Kroatien', Griechenland: 'Italien', Zypern: 'Italien', Rumänien: 'Italien', Bulgarien: 'Serbien',
    Ungarn: 'Polen', Tschechien: 'Polen', Slowakei: 'Polen', Ukraine: 'Polen', Russland: 'Polen', Georgien: 'Polen', Armenien: 'Polen', Belarus: 'Polen',
    Norwegen: 'Schweden', Finnland: 'Schweden', Island: 'Dänemark', Färöer: 'Dänemark', Luxemburg: 'Deutschland', Liechtenstein: 'Deutschland',
    Schottland: 'England', Wales: 'England', Irland: 'England', Nordirland: 'England', Kanada: 'USA', Australien: 'England', Neuseeland: 'England', Jamaika: 'England',
    Algerien: 'Marokko', Tunesien: 'Marokko', Ägypten: 'Marokko', Libyen: 'Marokko', 'Burkina Faso': 'Elfenbeinküste', Mali: 'Senegal', Guinea: 'Senegal',
    Gambia: 'Senegal', Kamerun: 'Elfenbeinküste', Togo: 'Elfenbeinküste', Benin: 'Elfenbeinküste', 'DR Kongo': 'Elfenbeinküste', Kongo: 'Elfenbeinküste',
    Angola: 'Portugal', 'Kap Verde': 'Portugal', 'Guinea-Bissau': 'Portugal', Mosambik: 'Portugal', 'Südafrika': 'England', Kenia: 'Ghana', Sambia: 'Ghana', Simbabwe: 'Ghana',
    Venezuela: 'Kolumbien', Ecuador: 'Kolumbien', Peru: 'Kolumbien', Chile: 'Argentinien', Paraguay: 'Argentinien', Bolivien: 'Argentinien',
    'Costa Rica': 'Mexiko', Honduras: 'Mexiko', Panama: 'Mexiko', 'El Salvador': 'Mexiko', Guatemala: 'Mexiko', Haiti: 'Frankreich',
    China: 'Japan', Iran: 'Türkei', Irak: 'Marokko', Israel: 'USA', Usbekistan: 'Türkei', Aserbaidschan: 'Türkei', Kasachstan: 'Polen',
    'Vereinigte Staaten': 'USA', Suriname: 'Niederlande', Curacao: 'Niederlande', 'Curaçao': 'Niederlande', Estland: 'Polen', Lettland: 'Polen', Litauen: 'Polen',
    Eritrea: 'Ghana', 'Sierra Leone': 'Ghana', Uganda: 'Ghana', Malawi: 'Ghana', Komoren: 'Frankreich', Philippinen: 'Japan', Indonesien: 'Japan',
    Thailand: 'Japan', 'Sri Lanka': 'Japan', Palästina: 'Marokko', Syrien: 'Marokko', Libanon: 'Marokko', Moldau: 'Polen' };
  function vorname(first, last, land) {
    first = String(first || '');
    if (!first) return first;
    const P = pools(), eigene = P[land] || P[NAH[land]] || [], h = h32(first + '|' + last);
    const ini = first.charAt(0).toUpperCase();
    // erst gleicher Anfangsbuchstabe im eigenen Land, dann irgendein Name des Landes, erst dann weltweit
    let k = eigene.filter(n => n.charAt(0).toUpperCase() === ini && n !== first);
    if (!k.length) k = eigene.filter(n => n !== first);
    if (!k.length) k = ALLE.filter(n => n.charAt(0).toUpperCase() === ini && n !== first);
    if (!k.length) k = ALLE.filter(n => n !== first);
    return k.length ? k[h % k.length] : first;
  }
  function verfremde(first, last, land) {
    // Datensätze mit zusammengeschriebenem Namen („JomaineConsbruch“, Vorname leer) erst trennen
    if (!first) { const m = /^([A-ZÄÖÜ][a-zäöüßéèáíóúñç]+)([A-ZÄÖÜ][^\s]+)$/.exec(String(last || '')); if (m) { first = m[1]; last = m[2]; } }
    return { firstName: vorname(first, last, land), name: nachname(last) };
  }

  // ── Alte Spielstände ──────────────────────────────────────────────────────
  // KS_ALTNAMEN = { paar: [h32(Vorname|Nachname) der früheren echten Spieler], promi: [h32(Nachname) der alten Promi-Listen] }
  let ALT = null;
  function altSets() {
    if (ALT) return ALT;
    const A = window.KS_ALTNAMEN || { paar: [], promi: [] };
    ALT = { paar: new Set(A.paar || []), promi: new Set(A.promi || []) };
    return ALT;
  }
  function istAlt(p) {
    const S = altSets();
    return S.paar.has(h32((p.firstName || '') + '|' + (p.name || ''))) || S.promi.has(h32(p.name || ''));
  }
  const N2 = () => window.KS_NAMEN2 || {};
  function migriere(wurzeln) {
    const S = altSets(); if (!S.paar.size && !S.promi.size && !Object.keys(N2()).length) return 0;
    let n = 0; const gesehen = new Set();
    const lauf = (o, tiefe) => {
      if (!o || typeof o !== 'object' || tiefe > 8 || gesehen.has(o)) return;
      gesehen.add(o);
      if (Array.isArray(o)) { o.forEach(x => lauf(x, tiefe + 1)); return; }
      if (typeof o.name === 'string' && typeof o.firstName === 'string') {
        if (istAlt(o)) { const v = verfremde(o.firstName, o.name, o.country); o.firstName = v.firstName; o.name = v.name; n++; }
        // v2 (2026-10-16): die leicht verfremdeten Kartei-Namen → erfundene Namen (data/ks_namen2.js, tools/namen_erfinden.js)
        const neu = N2()[h32(o.firstName + '|' + o.name)];
        if (neu) { o.firstName = neu[0]; o.name = neu[1]; n++; }
      }
      for (const k in o) { const v = o[k]; if (v && typeof v === 'object') lauf(v, tiefe + 1); }
    };
    (wurzeln || []).forEach(w => lauf(w, 0));
    return n;
  }
  function migriereSpielstand() {
    const w = [];
    try { if (typeof SQUAD !== 'undefined') w.push(SQUAD); } catch (e) { /* ohne Kader */ }
    try { if (typeof MARKET !== 'undefined' && MARKET) w.push(MARKET); } catch (e) { /* ohne Markt */ }
    try { if (typeof CLUB !== 'undefined' && CLUB) w.push(CLUB); } catch (e) { /* ohne Verein */ }
    try { if (typeof LEAGUE !== 'undefined' && LEAGUE) w.push(LEAGUE); } catch (e) { /* ohne Liga */ }
    if (window.AI_SQUADS) w.push(window.AI_SQUADS);
    let n = migriere(w);
    // Kartensammlung (geräteweit, kickstil_karten.js) – Karten tragen Vor- und Nachnamen
    try {
      const k = JSON.parse(localStorage.getItem('fl-karten') || 'null');
      if (k && Array.isArray(k.karten)) { const m = migriere([k.karten]); if (m) { localStorage.setItem('fl-karten', JSON.stringify(k)); n += m; } }
    } catch (e) { /* Sammlung bleibt */ }
    if (n) console.log(`[Kickstil-Namen] ${n} Spieler aus altem Spielstand umbenannt`);
    return n;
  }
  {
    const _orig = window.applyLoadedState;
    if (typeof _orig === 'function') {
      window.applyLoadedState = function () {
        const r = _orig.apply(this, arguments);
        try { migriereSpielstand(); } catch (e) { console.warn('[Kickstil-Namen] Migration', e); }
        return r;
      };
      try { applyLoadedState = window.applyLoadedState; } catch (e) { /* window reicht */ }
    }
  }

  // Der erste Spielstand wird schon vor diesem Modul geladen (initGame läuft vor den Patches, wie in kickstil_verein.js) –
  // daher zusätzlich direkt nach dem Start und noch einmal nach dem asynchronen Laden umbenennen und dann speichern
  function nachStart() {
    try {
      const n = migriereSpielstand();
      if (n && typeof saveGameState === 'function') saveGameState();
      if (n && typeof renderAll === 'function') renderAll();
    } catch (e) { console.warn('[Kickstil-Namen] Start', e); }
  }
  setTimeout(nachStart, 0);
  setTimeout(nachStart, 2500);

  window.KSNamen = { verfremde, nachname, vorname, h32, migriere: migriereSpielstand, istAlt };
  console.log('[Kickstil-Namen v1] aktiv — echte Spielernamen leicht verfremdet, alte Spielstände werden beim Laden umbenannt');
})();
