/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · VEREINSNAMEN  ·  v1   (Nutzer 2026-10-15: „wir müssen alle Namen ändern“)
   ─────────────────────────────────────────────────────────────────────────
   Zeigt die neuen Vereinsnamen aus data/vereinsnamen.js an – überall, wo ein Vereinsname sichtbar wird:
     · Text im Dokument (Tabellen, Ticker, Zeitung, Postfach, Wappen-Beschriftung), auch alte Meldungen aus Spielständen
     · Zeichenflächen (canvas: Vereinsname auf dem Stadiondach, Fähnchen in der Kulisse)
     · Kürzel im Wappen-Ersatz (crestInitials)
   Wie kickstil_anzeigenamen.js: Die alten Namen bleiben INTERNE SCHLÜSSEL (Kader-Zuordnung, Spielstände, Tabellen).
   Varianten: voller Name, Kurzform ohne Rechtsform/Jahr („FC Bayern München“ → „Bayern München“ ⇒ „Isar München“),
   jeweils auch in GROSSBUCHSTABEN. Eine Kurzform, die nur noch die Stadt ist („Duisburg“), bleibt unverändert –
   die Stadt bleibt ja. Zweitvertretungen („… II“) folgen von selbst.
   Wappenfigur je Verein (3. Spalte der Liste) → kickstil_verein.js nimmt sie statt der Hash-Figur.
   API: KSVereinsnamen.text(s) · .neu(alterName) · .alt(neuerName) · .figur(name)
   Lädt nach kickstil_anzeigenamen.js, vor init_bootstrap.js.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const LISTE = Array.isArray(window.KS_VEREINSNAMEN) ? window.KS_VEREINSNAMEN : [];
  if (!LISTE.length) { console.warn('[Kickstil-Vereinsnamen] keine Liste (data/vereinsnamen.js) – inaktiv'); return; }

  // Rechtsformen und Jahreszahlen, wie sie Laufband, Ticker und Deadline-Day für Kurzformen weglassen
  const FORM = /^(\d+\.?|FC|SV|SC|VfL|VfB|TSG|TSV|FSV|SpVgg|SG|BV|RB|SSV|SpVg|KFC|MSV|FK|AC|AS|SK|BSC|SSC|SU|TuS|TSC|VfR|SVgg|BSG|VSG)$/i;
  const kurz = n => {
    const w = n.split(/\s+/).filter(x => !FORM.test(x));
    while (w.length > 1 && /^\d+$/.test(w[w.length - 1])) w.pop();
    return w.join(' ');
  };
  const stadt = n => n.split(/\s+/).pop();

  const KARTE = new Map(), RUECK = new Map(), FIGUR = new Map();
  function eintragen(alt, neu) {
    if (!alt || !neu || alt === neu || KARTE.has(alt)) return;
    KARTE.set(alt, neu); KARTE.set(alt.toUpperCase(), neu.toUpperCase());
  }
  LISTE.forEach(([alt, neu, figur]) => {
    if (figur) { FIGUR.set(alt, figur); FIGUR.set(neu, figur); }
    eintragen(alt, neu);
    RUECK.set(neu, alt);
    const ka = kurz(alt), kn = kurz(neu) || neu;
    // Kurzform nur, wenn sie mehr als die Stadt ist (sonst würde jede Erwähnung der Stadt umbenannt):
    // „MSV Duisburg“ → „Duisburg“ bleibt, „Hamburger SV“ → „Hamburger“ (Ortsadjektiv) bleibt
    // Einzelwörter nie automatisch („Noah“ aus „FC Noah“ träfe Spieler namens Noah) – die sicheren stehen in KS_VEREINSNAMEN_KURZ
    const nurStadt = ka === stadt(neu) || !/\s/.test(ka);
    if (ka && ka !== alt && !nurStadt && ka.length >= 4) eintragen(ka, kn);
  });
  (window.KS_VEREINSNAMEN_KURZ || []).forEach(([alt, neu]) => eintragen(alt, neu));

  // ── Stadt und Spitzname aus dem NEUEN Namen (für Wappen: Spruchband, Ringschrift, Kürzel) ─────────────
  // Deutsche Namen: Stadt = letztes Wort („FC Isar München“ → München · Isar), Europapokal: erstes Wort
  // („Liverpool Reds“ → Liverpool · Reds). Ausnahmen mit Stadt aus mehreren Wörtern oder ohne Stadt fest.
  const ORT_FEST = {
    'Highbury FC': ['London', 'Highbury'], 'White Hart FC': ['London', 'White Hart'], 'Selhurst FC': ['London', 'Selhurst'],
    'Gibraltar Rock FC': ['Gibraltar', 'Rock'], 'CD Manzanares Madrid': ['Madrid', 'Manzanares'], 'CD Vallecas Madrid': ['Madrid', 'Vallecas'],
    'CF Les Corts Barcelona': ['Barcelona', 'Les Corts'], 'CD Donostia': ['San Sebastián', 'Donostia'], 'Saint-Gilles Brüssel': ['Brüssel', 'Saint-Gilles'],
    'Be\u2019er Sheva Negev': ['Be\u2019er Sheva', 'Negev'], 'Tel Aviv Yarkon': ['Tel Aviv', 'Yarkon'], 'Novi Sad Donau': ['Novi Sad', 'Donau'],
    'Kiew Weiß-Blau': ['Kiew', 'Weiß-Blau']
  };
  const EURO = new Set((window.EURO_CLUBS || []).map(c => c.name));
  const ORT = new Map();
  LISTE.forEach(([alt, neu]) => {
    let o, sp;
    if (ORT_FEST[neu]) [o, sp] = ORT_FEST[neu];
    else {
      const w = neu.split(/\s+/).filter(x => !FORM.test(x) && !/^(CD|CF|AFC|II)$/.test(x));
      if (EURO.has(alt)) { o = w[0]; sp = w.slice(1).join(' '); } else { o = w[w.length - 1]; sp = w.slice(0, -1).join(' '); }
    }
    const d = { ort: o, spitz: sp || o };
    ORT.set(alt, d); ORT.set(neu, d);
  });

  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const wort = k => new RegExp('(^|[^\\wÄÖÜäöüß])' + esc(k) + '(?![\\wÄÖÜäöüß])');
  // Sicherung gegen Endlosschleifen: Ein Muster, das in einem NEUEN Namen vorkommt („Stuttgart II“ in
  // „SV Neckar Stuttgart II“), würde den neuen Namen erneut ersetzen – solche Muster fallen weg.
  {
    const neue = [...new Set([...KARTE.values()])];
    for (const k of [...KARTE.keys()]) {
      const re = wort(k);
      if (neue.some(n => n !== KARTE.get(k) ? re.test(n) : (n !== k && re.test(n)))) KARTE.delete(k);
    }
  }

  const muster = [...KARTE.keys()].sort((a, b) => b.length - a.length).map(esc).join('|');
  // Wortgrenzen mit Umlauten: kein Buchstabe/Ziffer direkt davor oder danach
  const RE = new RegExp('(^|[^\\wÄÖÜäöüß])(' + muster + ')(?![\\wÄÖÜäöüß])', 'g');
  const TEST = new RegExp(muster);

  function text(s) {
    if (typeof s !== 'string' || !TEST.test(s)) return s;
    return s.replace(RE, (m, vor, name) => vor + KARTE.get(name));
  }

  // ── Dokument ─────────────────────────────────────────────────────────────
  const ATTR = ['title', 'aria-label', 'placeholder', 'alt', 'data-tip'];
  function wert(n) { const v = n.nodeValue; if (TEST.test(v)) { const w = text(v); if (w !== v) n.nodeValue = w; } }
  function attrs(el) { for (const a of ATTR) { const v = el.getAttribute && el.getAttribute(a); if (v && TEST.test(v)) { const w = text(v); if (w !== v) el.setAttribute(a, w); } } }
  function knoten(n) {
    if (n.nodeType === 3) { wert(n); return; }
    if (n.nodeType !== 1 || n.tagName === 'SCRIPT' || n.tagName === 'STYLE') return;
    attrs(n);
    if (n.tagName === 'INPUT' || n.tagName === 'TEXTAREA') return;   // Eingaben des Spielers nicht anfassen
    const walk = document.createTreeWalker(n, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let x;
    while ((x = walk.nextNode())) {
      if (x.nodeType === 3) wert(x);
      else if (x.tagName !== 'SCRIPT' && x.tagName !== 'STYLE') attrs(x);
    }
  }
  function start() {
    if (document.title) document.title = text(document.title);
    knoten(document.body);
    new MutationObserver(ms => {
      for (const m of ms) {
        if (m.type === 'characterData') knoten(m.target);
        else if (m.type === 'attributes') { const v = m.target.getAttribute(m.attributeName); if (v && TEST.test(v)) { const w = text(v); if (w !== v) m.target.setAttribute(m.attributeName, w); } }   // nur bei Änderung – sonst weckt das eigene Setzen den Observer endlos
        else m.addedNodes.forEach(knoten);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTR });
  }

  // ── Zeichenflächen: Name auf Stadiondach und Fähnchen ───────────────────
  try {
    const P = CanvasRenderingContext2D.prototype;
    ['fillText', 'strokeText', 'measureText'].forEach(fn => {
      const orig = P[fn];
      if (typeof orig !== 'function') return;
      P[fn] = function (t, ...rest) { return orig.call(this, typeof t === 'string' ? text(t) : t, ...rest); };
    });
  } catch (e) { /* ohne Canvas */ }

  // ── Vereinsfarben der Europapokal-Vereine (data/vereinsnamen.js, KS_VEREINSFARBEN) ─────────────────
  if (typeof window.clubColors === 'function' && window.KS_VEREINSFARBEN) {
    const orig = window.clubColors, F = window.KS_VEREINSFARBEN;
    // Gleiche ID in Deutschland und Europa („union“ = Union Berlin und Union Saint-Gilloise): deutsche Farbe bleibt
    const DE = new Set((window.EMBEDDED_CLUBS || []).map(c => c.id));
    window.clubColors = function (id, ...rest) { const k = String(id || ''); return F[k] && !DE.has(k) ? F[k].slice() : orig.call(this, id, ...rest); };
  }

  // ── Kürzel im Wappen-Ersatz aus dem neuen Namen ─────────────────────────
  if (typeof window.crestInitials === 'function') {
    const orig = window.crestInitials;
    window.crestInitials = function (name, ...rest) { return orig.call(this, text(name), ...rest); };
  }

  // ── Kürzel des eigenen Vereins (CLUB.shortName, z. B. „SCHA“ aus „FC Schalke 04“) ──────────────
  // Reine Anzeige (Flugzeugbanner, Zeitung) – wird aus dem neuen Namen gebildet: neue Spiele über makeShortName,
  // alte Spielstände beim Laden (nur wenn das Kürzel noch das automatisch gebildete ist, nie ein selbst gewähltes)
  let kurzOrig = null;
  if (typeof makeShortName === 'function') {
    kurzOrig = makeShortName;
    try { makeShortName = function (name) { return kurzOrig(text(String(name || ''))); }; } catch (e) { /* bleibt */ }
  }
  function kuerzelPruefen() {
    try {
      if (!kurzOrig || typeof CLUB === 'undefined' || !CLUB || !KARTE.has(CLUB.name)) return;
      if (CLUB.shortName === kurzOrig(CLUB.name)) CLUB.shortName = kurzOrig(KARTE.get(CLUB.name));
    } catch (e) { /* ohne Verein */ }
  }
  {
    const _orig = window.applyLoadedState;
    if (typeof _orig === 'function') {
      window.applyLoadedState = function () { const r = _orig.apply(this, arguments); kuerzelPruefen(); return r; };
      try { applyLoadedState = window.applyLoadedState; } catch (e) { /* window reicht */ }
    }
  }
  // Der erste Spielstand ist schon vor diesem Modul geladen (siehe kickstil_namen.js)
  setTimeout(kuerzelPruefen, 0); setTimeout(kuerzelPruefen, 1500);

  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  window.KSVereinsnamen = { text, neu: alt => KARTE.get(alt) || alt, alt: neu => RUECK.get(neu) || neu,
    figur: name => FIGUR.get(name) || FIGUR.get(KARTE.get(name)) || null,
    ort: name => (ORT.get(name) || ORT.get(KARTE.get(name)) || {}).ort || null,
    spitz: name => (ORT.get(name) || ORT.get(KARTE.get(name)) || {}).spitz || null, anzahl: LISTE.length };
  console.log('[Kickstil-Vereinsnamen v1] aktiv — ' + LISTE.length + ' Vereine mit neuem Namen (nur Anzeige, intern alte Schlüssel)');
})();
