/* ═══════════════════════════════════════════════════════════════════════════
   DFL · KENNEY STATT EMOJI  ·  v1   (D104, freigegeben 2026-10-10: „arbeite alles in die App ein“)
   ─────────────────────────────────────────────────────────────────────────
   Eine Tabelle für alle Emojis des Spiels und ein Wächter, der sie aus der Oberfläche holt:
     · Tabelle EMOJI: Emoji → [Zeichen, Farbe]. Zeichen ohne „ti-“ = game-icon (data/dfl_spielicons.js, CC BY 3.0,
       nur in Farbmarken), mit „ti-“ = Tabler (Bedienung: Pfeile, Haken, Hinweise). Farben: gut · mittel · schlecht ·
       info · neutral · gold (Tokens in css/dfl_kenney_reste.css, Tag und Nacht).
     · Bedeutung bleibt: Postfach (buildPostfachItems), Toasts (showToast), Ticker (addEv) nehmen das führende Emoji
       eines Titels als Icon-Marke; im Fließtext fällt es weg (Entscheidung D104: keine Mini-Icons mitten im Satz).
     · Wächter: ein MutationObserver ersetzt jedes übrige sichtbare Emoji – führend oder allein als Zeichen, Folgen
       „⚽⚽“ als Zeichen ×2, im Satz weg (Ausnahmen IM_SATZ: Karten, Ball, Stern, ↔) –, Flaggen fallen immer weg,
       unbekannte Emojis einmal in die Konsole. Überspringt Eingaben, SVG, Canvas und [data-emoji-ok].
       Dazu feste Farben der Altoberfläche in style-Attributen (GitHub-Palette, Statusfarben) → Tokens und dünne
       Inline-Balken (Training) → Kenney-Balken (Klassen k-bahn / k-fuell).
     · Flaggen (D104 Frage 1): in der DFL spielen nur generierte Deutsche – p.flag bleibt leer (Generator, Welt → Spiel,
       alte Spielstände beim Laden).
     · Teammoral-Karte im Office: Marke statt Smiley, Skala aus Tokens (die Karte ruft die lokale moraleMeta – Closure-Falle).
   Lädt nach allen DFL-Modulen (äußerste Wrapper), vor init_bootstrap.js. Tabelle und Textfunktionen laufen ohne DOM
   (Prüflauf mit node:vm).
   API: DFLKenney.EMOJI · .zeichen(e) · .marke(e) · .teile(text) · .ohne(text) · .zuIcons(text) · .ersetze(wurzel)
        · .flaggenWeg() · .stand()
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : globalThis;
  const DOM = typeof document !== 'undefined' && typeof MutationObserver === 'function';

  // ── 1) Die Tabelle ───────────────────────────────────────────────────────
  // Schlüssel ohne Variantenzeichen U+FE0F. Jedes Emoji, das im Code des Spiels steht, braucht hier einen Eintrag
  // (dfl_pruefung.js prüft das); Flaggen fehlen absichtlich – sie fallen immer weg.
  const EMOJI = {
    // Spiel, Tore, Karten, Zeit
    '⚽': ['soccer-ball', 'neutral'], '🅰': ['soccer-kick', 'info'], '🟨': ['karte-gelb', 'mittel'], '🟥': ['karte-rot', 'schlecht'],
    '⚑': ['whistle', 'mittel'], '⏱': ['stopwatch', 'info'], '⏰': ['stopwatch', 'info'], '⌛': ['hourglass', 'mittel'], '⏳': ['hourglass', 'mittel'],
    '⏩': ['ti-player-track-next', 'neutral'], '🏁': ['checkered-flag', 'neutral'], '📅': ['ti-calendar', 'neutral'], '🎯': ['target-arrows', 'info'],
    // Erfolge, Ehrungen
    '🏆': ['trophy-cup', 'gold'], '🥇': ['medal', 'gold'], '🥈': ['medal', 'neutral'], '🥉': ['medal', 'mittel'], '🏅': ['medal', 'gold'],
    '🎖': ['medal', 'gold'], '⭐': ['star-medal', 'gold'], '🌟': ['star-medal', 'gold'], '★': ['ti-star-filled', 'gold'], '👑': ['crown', 'gold'],
    '🏛': ['greek-temple', 'neutral'], '🎉': ['party-popper', 'gut'],
    // Verein, Anlagen, Fans
    '🏟': ['arena', 'info'], '🏃': ['run', 'info'], '🔭': ['binoculars', 'info'], '🛍': ['shopping-bag', 'info'], '📢': ['megaphone', 'info'],
    '📣': ['megaphone', 'info'], '🪧': ['megaphone', 'mittel'], '🧣': ['shopping-bag', 'info'], '🎟': ['ticket', 'info'], '👥': ['three-friends', 'info'],
    '🏗': ['crane', 'mittel'], '🔧': ['ti-tool', 'mittel'], '🌱': ['sprout', 'gut'], '🏕': ['ti-tent', 'info'], '🏋': ['weight-lifting-up', 'info'],
    '🏠': ['house', 'neutral'],
    // Geld, Verträge, Handel
    '💰': ['money-stack', 'gold'], '💶': ['money-stack', 'gold'], '💵': ['money-stack', 'gold'], '🏦': ['ti-building-bank', 'neutral'],
    '💼': ['suitcase', 'neutral'], '📺': ['tv', 'info'], '📄': ['contract', 'neutral'], '✍': ['contract', 'gut'], '🤝': ['shaking-hands', 'info'],
    '🔁': ['shaking-hands', 'info'], '🔄': ['ti-refresh', 'info'], '🔀': ['ti-arrows-shuffle', 'info'], '📨': ['envelope', 'info'],
    '📤': ['envelope', 'info'], '💬': ['ti-message-circle', 'info'], '🆓': ['ti-user-plus', 'info'], '✂': ['ti-scissors', 'schlecht'],
    '🎓': ['graduate-cap', 'info'],
    // Kader, Form, Stimmung
    '🤕': ['bandage-roll', 'schlecht'], '🩹': ['bandage-roll', 'schlecht'], '💪': ['muscle-up', 'gut'], '🔥': ['flame', 'gut'],
    '❄': ['snowflake-2', 'info'], '📈': ['growth', 'gut'], '📉': ['ti-trending-down', 'schlecht'], '📊': ['histogram', 'info'],
    '🚀': ['ti-rocket', 'gut'], '🐢': ['snail', 'mittel'], '💤': ['night-sleep', 'neutral'], '🔒': ['padlock', 'neutral'],
    '⬆': ['ti-arrow-big-up', 'gut'], '⬇': ['ti-download', 'neutral'], '➡': ['ti-arrow-right', 'neutral'], '👋': ['exit-door', 'neutral'],
    '🚪': ['exit-door', 'schlecht'], '✈': ['airplane-departure', 'mittel'], '✊': ['fist', 'schlecht'],
    '😃': ['ti-mood-happy', 'gut'], '🤩': ['ti-mood-crazy-happy', 'gut'], '🙂': ['ti-mood-smile', 'gut'], '😌': ['ti-mood-smile', 'gut'],
    '😐': ['ti-mood-empty', 'mittel'], '😟': ['ti-mood-sad', 'mittel'], '😬': ['ti-mood-nervous', 'mittel'], '😠': ['ti-mood-angry', 'schlecht'],
    '🎂': ['cake-slice', 'info'], '🎲': ['rolling-dices', 'neutral'], '🎙': ['microphone', 'info'], '📋': ['ti-clipboard-list', 'neutral'],
    // Presse
    '📰': ['newspaper', 'neutral'], '🗞': ['newspaper', 'neutral'], '✒': ['quill-ink', 'neutral'],
    // Taktik
    '🛡': ['shield', 'info'], '⚖': ['ti-scale', 'neutral'], '⚔': ['ti-swords', 'schlecht'], '⚡': ['ti-bolt', 'mittel'],
    '🧭': ['ti-compass', 'info'], '🔵': ['ti-circle-filled', 'info'], '🔴': ['ti-circle-filled', 'schlecht'], '💙': ['ti-heart-filled', 'info'],
    // Bedienung, Hinweise
    '⚠': ['ti-alert-triangle', 'mittel'], '🚫': ['ti-ban', 'schlecht'], '✅': ['ti-circle-check', 'gut'], '✔': ['ti-check', 'gut'],
    '❌': ['ti-x', 'schlecht'], '💾': ['ti-device-floppy', 'neutral'], '📦': ['ti-package', 'neutral'], '⚙': ['ti-settings', 'neutral'],
    '🌍': ['ti-world', 'neutral'], '🔎': ['ti-search', 'neutral'], '🔍': ['ti-search', 'neutral'], '🎁': ['ti-gift', 'gut'],
    // Textzeichen ohne Emoji-Darstellung, die wie Emojis wirken (D104: „pseudo-clean“)
    '✓': ['ti-check', 'gut'], '✗': ['ti-x', 'schlecht'], '✘': ['ti-x', 'schlecht'], '☆': ['ti-star', 'neutral'],
    '↔': ['ti-arrows-left-right', 'neutral']
  };
  // Zeichen, die auch mitten im Satz Bedeutung tragen (Karte, Tor, Stern hinter einer Zahl, „A ↔ B“): dort als kleines
  // Zeichen statt wegzufallen
  const IM_SATZ = new Set(['🟨', '🟥', '⚽', '🅰', '★', '☆', '✓', '✔', '✗', '✘', '↔']);
  // Bleiben stehen (Schriftzeichen, kein Bild)
  const ERLAUBT = new Set(['©', '®', '™']);
  const ARTEN = ['gut', 'mittel', 'schlecht', 'info', 'neutral', 'gold'];

  // Ein Emoji = Regionalzeichen-Paar (Flagge) oder Bildzeichen samt Variante, Hautton, Tag-Folge (🏴…) und ZWJ-Verbindung
  const EINHEIT = '(?:\\p{Regional_Indicator}{2}|(?:\\p{Extended_Pictographic}|[✓✗✘☆])(?:\\uFE0F|\\u20E3|[\\u{1F3FB}-\\u{1F3FF}]|[\\u{E0020}-\\u{E007F}]|\\u200D\\p{Extended_Pictographic})*)';
  const RE_ALLE = new RegExp(EINHEIT + '|\\uFE0F|\\p{Regional_Indicator}', 'gu');
  const RE_TEST = /\p{Extended_Pictographic}|\p{Regional_Indicator}|[✓✗✘☆\uFE0F]/u;
  const RE_VORN = new RegExp('^(\\s*)((?:' + EINHEIT + '\\s*)+)', 'u');
  const basis = e => String(e).replace(/[\uFE0F\u20E3\u{1F3FB}-\u{1F3FF}\u{E0020}-\u{E007F}]/gu, '').replace(/\u200D.*$/u, '');
  const istFlagge = e => /\p{Regional_Indicator}/u.test(e) || /^\u{1F3F4}|^\u{1F3F3}/u.test(e);
  const eintrag = e => { const k = basis(e); return EMOJI[k] || null; };

  const unbekannt = new Set(), zaehler = { ersetzt: 0, entfernt: 0, flaggen: 0, farben: 0, balken: 0 };
  function merkeUnbekannt(e) {
    const k = basis(e);
    if (ERLAUBT.has(k) || istFlagge(e) || unbekannt.has(k)) return;
    unbekannt.add(k);
    try { console.warn('[DFL-Kenney] Emoji ohne Zeichen in der Tabelle (fällt weg): ' + k + ' U+' + k.codePointAt(0).toString(16).toUpperCase()); } catch (e) { /* ohne Konsole */ }
  }

  // ── 2) Zeichen und Marken ────────────────────────────────────────────────
  function bild(name) {
    if (name === 'karte-gelb' || name === 'karte-rot') return `<span class="k-karte ${name === 'karte-gelb' ? 'gelb' : 'rot'}"></span>`;
    if (name === 'karte-gelbrot') return '<span class="k-karte gelb"></span><span class="k-karte rot"></span>';
    if (/^ti-/.test(name)) return `<i class="ti ${name}" aria-hidden="true"></i>`;
    const S = W.DFLSpielicons;
    if (S && S.hat && S.hat(name)) return S.svg(name);
    // Sprite-Modul noch nicht da (Prüflauf ohne DOM): gleicher Verweis auf das Symbol
    if (W.DFL_SPIELICONS && W.DFL_SPIELICONS[name]) return `<svg class="gi" aria-hidden="true" focusable="false"><use href="#gi-${name}"/></svg>`;
    return '<i class="ti ti-point-filled" aria-hidden="true"></i>';
  }
  // Mehrere Emojis vorn (🟨🟥) → ein Eintrag; Gelb-Rot bekommt beide Karten
  function eintragFolge(liste) {
    const b = liste.map(basis);
    if (b.includes('🟨') && b.includes('🟥')) return ['karte-gelbrot', 'schlecht'];
    for (const e of liste) { const x = eintrag(e); if (x) return x; }
    return null;
  }
  // Zeichen im Text (führend oder allein): ohne Fläche, Größe nach der Schrift
  function zeichen(e, x) {
    x = x || eintrag(e); if (!x) return '';
    return `<span class="kz kz-${x[1]}" aria-hidden="true">${bild(x[0])}</span>`;
  }
  // Icon-Marke (Postfach, Toasts, Anlagen): Fläche in der Farbe der Bedeutung
  function marke(e, klasse, x) {
    x = x || eintrag(e); if (!x) return '';
    return `<span class="km km-${x[1]}${klasse ? ' ' + klasse : ''}" aria-hidden="true">${bild(x[0])}</span>`;
  }
  // Marke aus Name + Farbe (ohne Emoji), z. B. für Toast-Arten
  const markeAus = (name, art, klasse) => `<span class="km km-${art}${klasse ? ' ' + klasse : ''}" aria-hidden="true">${bild(name)}</span>`;

  // ── 3) Text ──────────────────────────────────────────────────────────────
  const einheiten = s => String(s).match(new RegExp(EINHEIT, 'gu')) || [];
  // Führende Emojis abtrennen: { emoji: erstes, liste: alle führenden, x: Eintrag, rest }
  function teile(text) {
    const s = String(text == null ? '' : text);
    const m = RE_VORN.exec(s);
    if (!m) return { emoji: null, liste: [], x: null, rest: s };
    const liste = einheiten(m[2]).filter(e => !ERLAUBT.has(basis(e)));
    if (!liste.length) return { emoji: null, liste: [], x: null, rest: s };
    const ohneFlaggen = liste.filter(e => !istFlagge(e));
    return { emoji: ohneFlaggen[0] || null, liste: ohneFlaggen, x: eintragFolge(ohneFlaggen), rest: m[1] + s.slice(m[0].length) };
  }
  // Alle Emojis entfernen (Fließtext, Titel ohne Marke, native Dialoge, Optionen); Leerzeichen bleiben einfach
  function ohne(text) {
    if (text == null) return text;
    const s = String(text);
    if (!RE_TEST.test(s)) return s;
    return s.replace(new RegExp('[ \\t]?(?:' + EINHEIT + '|\\uFE0F)(?:[ \\t](?=[ \\t]))?', 'gu'), m => {
      const e = m.trim(); if (ERLAUBT.has(basis(e))) return m;
      return m.startsWith(' ') || m.startsWith('\t') ? ' ' : '';
    }).replace(/^[ \t]+|[ \t]+$/g, '').replace(/[ \t]{2,}/g, ' ');
  }
  // Emoji im HTML-Text → Zeichen (führend) bzw. weg (im Satz); für DFLIdentitaet.emojiZuIcon und Meldungstitel
  function zuIcons(html) {
    const t = teile(html);
    if (!t.emoji) return ohne(html);
    return (t.x ? zeichen(t.emoji, t.x) + ' ' : '') + ohne(t.rest).trim();
  }

  // ── 4) Flaggen weg (D104 Frage 1: „Flaggen ganz entfernen“) ──────────────
  const dfl = () => typeof CLUB !== 'undefined' && CLUB && CLUB.dfl;
  function flaggenWeg() {
    if (!dfl()) return 0;
    let n = 0;
    const weg = p => { if (p && p.flag) { p.flag = ''; n++; } };
    try { if (typeof SQUAD !== 'undefined' && Array.isArray(SQUAD)) SQUAD.forEach(weg); } catch (e) { /* ohne Kader */ }
    try {
      const L = W.DFLSpiel && DFLSpiel.liga ? DFLSpiel.liga() : null;
      if (L) {
        (L.teams || []).forEach(t => (t.roster || []).concat(t.practice_squad || []).forEach(weg));
        (L.freie || []).forEach(weg);
        if (L.draft && L.draft.talente) L.draft.talente.forEach(weg);
      }
    } catch (e) { /* Welt noch nicht da */ }
    zaehler.flaggen += n;
    return n;
  }

  // ── 5) Feste Farben → Tokens (style-Attribute) ───────────────────────────
  const ROLLE = {};
  [['gut', '#3fb950 #56d364 #2ea043 #238636 #7ee787 #3fcf7a #25c065 #5fd39a #2fb36b #1d9053'],
    ['mittel', '#d29922 #e3b341 #e09637 #e09b3a #e3873c #f0a070 #f0c05a #f2c14e #e0a030'],
    ['schlecht', '#f85149 #da3633 #ff7b72 #f07462 #e24b4a #ff4d4d'],
    ['info', '#58a6ff #1f6feb #79c0ff #378add #a371f7 #bc8cff'],
    ['text2', '#8b949e'], ['text3', '#6e7681 #484f58 #3a4552'], ['text', '#e6edf3 #c9d1d9 #f0f6fc'],
    ['bg', '#0d1117'], ['bg2', '#161b22'], ['bg3', '#21262d'], ['linie', '#30363d']
  ].forEach(([r, l]) => l.split(' ').forEach(h => { ROLLE[h] = r; }));
  const TOKEN = {
    gut: ['var(--k-gut-fg, #3fb950)', 'var(--app-gut, #3fb950)'], mittel: ['var(--k-mittel-fg, #d29922)', 'var(--app-mittel, #d29922)'],
    schlecht: ['var(--k-schlecht-fg, #f85149)', 'var(--app-schlecht, #f85149)'], info: ['var(--k-info-fg, #58a6ff)', 'var(--k-blau, #58a6ff)'],
    text: ['var(--text)', 'var(--bg3)'], text2: ['var(--text2)', 'var(--bg4)'], text3: ['var(--text3)', 'var(--bg4)'],
    bg: ['var(--text)', 'var(--bg)'], bg2: ['var(--text)', 'var(--bg2)'], bg3: ['var(--text2)', 'var(--bg3)'], linie: ['var(--text3)', 'var(--k-linie, var(--border))']
  };
  const hex2 = n => Math.round(+n).toString(16).padStart(2, '0');
  const RE_FARBE = /#[0-9a-f]{8}\b|#[0-9a-f]{6}\b|rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+\s*)?\)/gi;
  const RE_FARBE_T = /#[0-9a-f]{6}|rgba?\(\s*\d/i;
  const ohneVar = s => s.replace(/var\((?:[^()]|\((?:[^()]|\([^()]*\))*\))*\)/g, '');
  const FARB_PROPS = /^(color|background-color|background-image|border(-(top|right|bottom|left))?-color|outline-color|fill|stroke|box-shadow|text-decoration-color|caret-color)$/;
  function tokenFuer(f, flaeche) {
    let h, a = 1;
    const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(f);
    if (m) { h = '#' + hex2(m[1]) + hex2(m[2]) + hex2(m[3]); if (m[4] != null) a = +m[4]; }
    else { h = f.slice(0, 7).toLowerCase(); if (f.length === 9) a = parseInt(f.slice(7, 9), 16) / 255; }
    const r = ROLLE[h]; if (!r) return null;
    const t = TOKEN[r][flaeche ? 1 : 0];
    return a < 0.98 ? `color-mix(in oklab, ${t} ${Math.round(a * 100)}%, transparent)` : t;
  }
  // Nicht anfassen: Vereinsfarben, Wappen, Gesichter, Gelände, Spielfeld, FUT-Karten
  const FARBE_OK = '[class*="crest"],[class*="wappen"],[class*="gesicht"],.dfl-face,.dfl-portrait,[class*="trikot"],[class*="gel-"],[class*="kulisse"],.p-token,.fut,[class*="fut-"],[data-farbe-ok],.dfl-ts,svg';
  function farbenIn(el) {
    const st = el.getAttribute('style');
    if (!st || !/#[0-9a-f]{6}|rgba?\(/i.test(ohneVar(st))) return;
    if (el.closest(FARBE_OK)) return;
    let n = 0;
    for (let i = 0; i < el.style.length; i++) {
      const prop = el.style[i];
      if (!FARB_PROPS.test(prop)) continue;
      const wert = el.style.getPropertyValue(prop);
      if (!wert || /var\(/.test(wert) || !RE_FARBE_T.test(wert)) continue;
      const flaeche = prop !== 'color' && prop !== 'caret-color' && prop !== 'text-decoration-color';
      let geaendert = false;
      const neu = wert.replace(RE_FARBE, f => { const t = tokenFuer(f, flaeche); if (t) { geaendert = true; return t; } return f; });
      if (geaendert) { el.style.setProperty(prop, neu, el.style.getPropertyPriority(prop)); n++; }
    }
    if (n) zaehler.farben++;
  }

  // ── 6) Dünne Inline-Balken → Kenney-Balken (Training, Fans, Altoberfläche) ──
  // Spur: style mit height 2–9 px und Fläche, genau ein Kind mit width:%; Klassen statt fester Höhe/Fläche
  const RE_DUENN = /(?:^|;)\s*height\s*:\s*[2-9]px/i;
  function balkenIn(el) {
    const st = el.getAttribute('style');
    if (!st || !RE_DUENN.test(st) || !/background/i.test(st) || el.classList.contains('k-bahn')) return;
    const kind = el.firstElementChild;
    if (!kind || el.children.length !== 1 || !/width\s*:\s*[\d.]+%/.test(kind.getAttribute('style') || '')) return;
    el.classList.add('k-bahn'); kind.classList.add('k-fuell');
    ['height', 'background', 'background-color', 'border-radius', 'opacity'].forEach(p => el.style.removeProperty(p));
    ['height', 'border-radius', 'opacity'].forEach(p => kind.style.removeProperty(p));
    zaehler.balken++;
  }

  // ── 7) Der Wächter ───────────────────────────────────────────────────────
  const SKIP = 'script,style,textarea,input,select,noscript,template,svg,canvas,[contenteditable="true"],[data-emoji-ok]';
  const ATTRIBUTE = ['title', 'placeholder', 'aria-label', 'alt'];
  // Steht vor dem Textknoten im selben Element schon Text? (dann ist ein Emoji am Anfang nicht „führend“)
  function textDavor(n) {
    for (let s = n.previousSibling; s; s = s.previousSibling) {
      if (s.nodeType === 3 && s.nodeValue.trim()) return true;
      if (s.nodeType === 1 && !s.classList.contains('kz') && !s.classList.contains('km') && s.textContent.trim()) return true;
    }
    return false;
  }
  // Text in Stücke: { t } oder { e, n } (Folge gleicher Emojis zusammengefasst)
  function zerlege(t) {
    const out = [];
    let letzte = 0, m;
    RE_ALLE.lastIndex = 0;
    while ((m = RE_ALLE.exec(t))) {
      if (m.index > letzte) out.push({ t: t.slice(letzte, m.index) });
      const e = m[0];
      const vorher = out[out.length - 1];
      if (vorher && vorher.e && basis(vorher.e) === basis(e)) vorher.n++;
      else out.push({ e, n: 1 });
      letzte = m.index + e.length;
    }
    if (letzte < t.length) out.push({ t: t.slice(letzte) });
    return out;
  }
  const tmpl = DOM ? document.createElement('template') : null;
  function textKnoten(n) {
    const p = n.parentNode;
    if (!p || p.nodeType !== 1) return;
    const t = n.nodeValue;
    if (!t || !RE_TEST.test(t)) return;
    if (p.nodeName === 'OPTION') { const o = ohne(t); if (o !== t) n.nodeValue = o; return; }
    if (p.closest(SKIP)) return;
    const stuecke = zerlege(t);
    if (!stuecke.some(x => x.e && !ERLAUBT.has(basis(x.e)))) return;
    // allein: nur Emojis, Zahlen, × und Leerzeichen (Marke einer Kachel, „⚽⚽“ im Notenblatt)
    const allein = stuecke.every(x => x.e || /^[\s\d×·.,+\-]*$/.test(x.t));
    const davor = textDavor(n);
    // Teile: Text (String) oder Zeichen ({ h: HTML })
    const teileListe = [];
    let ersteGesehen = false, textBisher = '', vornWeg = false;
    for (const x of stuecke) {
      if (!x.e || ERLAUBT.has(basis(x.e))) {
        let s = x.t != null ? x.t : x.e;
        // nach einem weggefallenen führenden Emoji kein Leerzeichen am Anfang stehen lassen
        if (vornWeg && !textBisher.trim()) s = s.replace(/^[ \t]+/, '');
        teileListe.push(s); textBisher += s; continue;
      }
      const flagge = istFlagge(x.e);
      // Kickstil: echte Nationalitäten – Flaggen bleiben stehen (flags_patch.js macht PNG daraus)
      if (flagge && !dfl()) { teileListe.push(x.e); textBisher += x.e; continue; }
      const eintr = flagge ? null : eintrag(x.e);
      const fuehrend = !davor && !ersteGesehen && !textBisher.trim();
      // nach einem Trennzeichen beginnt ein neuer Eintrag („… · 🔥 Lauf · ❄️ Krise“, „Stadion · 📢 1,2 Mio €“)
      const nachTrenner = !!textBisher.trim() && /[·•|–—(\/:]\s*$/.test(textBisher);
      ersteGesehen = true;
      if (eintr && (allein || fuehrend || nachTrenner || IM_SATZ.has(basis(x.e)))) {
        teileListe.push({ h: zeichen(x.e, eintr) + (x.n > 1 ? `<span class="kz-anzahl">×${x.n}</span>` : '') });
        zaehler.ersetzt++;
      } else {
        if (flagge) zaehler.flaggen++; else { zaehler.entfernt++; if (!eintr && basis(x.e)) merkeUnbekannt(x.e); }
        if (!textBisher.trim()) vornWeg = true;
        // „Text 🔴“ → „Text“: Leerzeichen vor einem weggefallenen Emoji am Ende nicht stehen lassen
        else if (typeof teileListe[teileListe.length - 1] === 'string') teileListe[teileListe.length - 1] = teileListe[teileListe.length - 1].replace(/[ \t]+$/, ' ');
      }
    }
    if (!teileListe.some(x => typeof x === 'object')) {
      // nur entfernt: Text ersetzen (Knoten bleibt derselbe)
      const neu = teileListe.join('').replace(/[ \t]{2,}/g, ' ');
      if (neu !== t) n.nodeValue = neu;
      return;
    }
    const frag = document.createDocumentFragment();
    for (const x of teileListe) {
      if (typeof x === 'string') { if (x) frag.appendChild(document.createTextNode(x.replace(/[ \t]{2,}/g, ' '))); }
      else { tmpl.innerHTML = x.h; frag.appendChild(tmpl.content.cloneNode(true)); }
    }
    p.replaceChild(frag, n);
  }
  function attributeIn(el) {
    for (const a of ATTRIBUTE) {
      const v = el.getAttribute(a);
      if (v && RE_TEST.test(v)) { const o = ohne(v); if (o !== v) el.setAttribute(a, o); }
    }
  }
  function ersetze(wurzel) {
    if (!DOM || !wurzel) return;
    if (wurzel.nodeType === 3) { textKnoten(wurzel); return; }
    if (wurzel.nodeType !== 1 && wurzel.nodeType !== 11) return;
    if (wurzel.nodeType === 1 && wurzel.closest && wurzel.closest('svg,canvas,[data-emoji-ok]')) return;
    const texte = [];
    const tw = document.createTreeWalker(wurzel, NodeFilter.SHOW_TEXT, { acceptNode: x => (RE_TEST.test(x.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
    let x;
    while ((x = tw.nextNode())) texte.push(x);
    texte.forEach(textKnoten);
    const els = wurzel.nodeType === 1 ? [wurzel] : [];
    if (wurzel.querySelectorAll) els.push(...wurzel.querySelectorAll('[style],[title],[placeholder],[aria-label],[alt]'));
    for (const el of els) {
      if (el.hasAttribute('style')) { farbenIn(el); balkenIn(el); }
      attributeIn(el);
    }
  }
  let mo = null;
  const offen = new Set();
  function abarbeiten() {
    const liste = [...offen]; offen.clear();
    const menge = liste.length > 1 ? new Set(liste) : null;
    for (const n of liste) {
      if (!n.isConnected) continue;
      // Knoten in einem Teilbaum, der selbst in der Liste steht, nicht doppelt ablaufen
      let drin = false;
      if (menge) for (let a = n.parentNode; a; a = a.parentNode) if (menge.has(a)) { drin = true; break; }
      if (drin) continue;
      try { ersetze(n); } catch (e) { console.warn('[DFL-Kenney] Wächter', e); }
    }
  }
  function waechter() {
    if (!DOM || mo || !document.body) return;
    mo = new MutationObserver(recs => {
      for (const r of recs) {
        if (r.type === 'childList') r.addedNodes.forEach(n => { if (n.nodeType === 1 || n.nodeType === 3) offen.add(n); });
        else if (r.type === 'characterData') offen.add(r.target);
        else if (r.type === 'attributes') {
          const el = r.target;
          if (r.attributeName === 'style') { try { farbenIn(el); balkenIn(el); } catch (e) { /* weiter */ } }
          else attributeIn(el);
        }
      }
      if (offen.size) abarbeiten();
      if (mo) mo.takeRecords();   // eigene Änderungen nicht noch einmal ansehen
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['style', 'title', 'placeholder'] });
    ersetze(document.body);
    mo.takeRecords();
  }

  // ── 8) Bedeutung behalten: Postfach, Toasts, Ticker, Dialoge ──────────────
  if (typeof W.buildPostfachItems === 'function') {
    const _orig = W.buildPostfachItems;
    W.buildPostfachItems = function () {
      const items = _orig.apply(this, arguments);
      if (Array.isArray(items)) items.forEach(i => {
        const t = teile(i.title);
        if (t.x) i.icon = marke(t.emoji, 'km-fuellt', t.x);
        if (t.emoji || RE_TEST.test(String(i.title || ''))) i.title = ohne(t.rest).trim();
        if (i.text && RE_TEST.test(i.text)) i.text = ohne(i.text);
      });
      return items;
    };
    try { buildPostfachItems = W.buildPostfachItems; } catch (e) { /* nicht global gebunden */ }
  }
  // Alter Meldungsfeed (#news-feed, im Office versteckt) und dfl_design_patch.js: über die zentrale Tabelle
  if (W.DFLIdentitaet) { W.DFLIdentitaet.emojiZuIcon = zuIcons; W.DFLIdentitaet.EMOJI = EMOJI; }

  const TOAST_ART = { success: ['ti-circle-check', 'gut'], error: ['ti-alert-triangle', 'schlecht'], warn: ['ti-alert-triangle', 'mittel'],
    warning: ['ti-alert-triangle', 'mittel'], info: ['ti-info-circle', 'info'], money: ['money-stack', 'gold'] };
  // Hinweise nicht über Entscheidungsfenstern (2026-10-11: „Aufstellung angepasst …“ verdeckte die Überschrift der Steuerprüfung):
  // solange ein Ereignis-/Sponsorfenster oder ein Briefing offen ist, warten neue Hinweise und kommen danach nacheinander;
  // schon sichtbare rutschen per CSS hinter das Fenster (css/dfl_textspiel.css)
  const FENSTER = '.exp-overlay, .sw-briefing';
  const fensterOffen = () => { try { return !!document.querySelector(FENSTER); } catch (e) { return false; } };
  const wartend = [];
  let fensterBeob = null;
  function hinweiseFreigeben() {
    if (fensterOffen()) return;
    if (fensterBeob) { fensterBeob.disconnect(); fensterBeob = null; }
    wartend.splice(0).forEach((a, i) => setTimeout(() => { try { W.showToast.apply(W, a); } catch (e) { /* Hinweis optional */ } }, 300 + i * 400));
  }
  if (typeof W.showToast === 'function') {
    const _orig = W.showToast;
    W.showToast = function (msg, typ, opts) {
      if (DOM && fensterOffen()) {
        wartend.push(Array.from(arguments));
        if (!fensterBeob) { fensterBeob = new MutationObserver(hinweiseFreigeben); fensterBeob.observe(document.body, { childList: true, subtree: true }); }
        return;
      }
      if (msg == null) return _orig.apply(this, arguments);
      const t = teile(String(msg));
      const r = _orig.call(this, ohne(t.rest).trim(), typ, opts);
      try {
        const host = DOM && document.getElementById('toast-host'), el = host && host.lastElementChild;
        const i = el && el.querySelector(':scope > i.ti');
        if (i) {
          const art = TOAST_ART[typ] || TOAST_ART.info;
          i.outerHTML = t.x ? marke(t.emoji, 'km-toast', t.x) : markeAus(art[0], art[1], 'km-toast');
        }
      } catch (e) { /* Toast ohne Zeichen */ }
      return r;
    };
  }
  if (typeof W.addEv === 'function') {
    const _orig = W.addEv;
    W.addEv = function (type, team, text, icon, minute) {
      if (!icon) {
        const t = typeof text === 'string' ? teile(text) : null;
        if (t && t.x) icon = bild(t.x[0]);
        else if (type === 'yellow') icon = bild('karte-gelb');
        else if (type === 'red') icon = bild('karte-rot');
      }
      return _orig.call(this, type, team, typeof text === 'string' ? (teile(text).emoji ? text : ohne(text)) : text, icon, minute);
    };
  }
  // Native Dialoge können keine Icons zeigen: Emojis weg (Fragen bleiben gleich)
  ['confirm', 'prompt'].forEach(f => {
    const _orig = W[f];
    if (typeof _orig !== 'function') return;
    W[f] = function (frage) { const a = [].slice.call(arguments); if (typeof frage === 'string') a[0] = ohne(frage); return _orig.apply(this, a); };
  });

  // ── 9) Teammoral-Karte im Office: Marke, Zahl, Skala (statt 🙂 doppelt und Verlaufsbalken) ──
  const MORAL_STUFEN = [[85, 'euphorisch', '🤩', 'gut'], [70, 'gut', '🙂', 'gut'], [55, 'neutral', '😐', 'mittel'], [40, 'angespannt', '😟', 'mittel'], [0, 'zerrüttet', '😠', 'schlecht']];
  function moralKarte() {
    if (!DOM) return;                                   // Kickstil: auch ohne DFL
    const karte = document.querySelector('#view-home .team-morale-card'), M = W.MoraleSystem;
    if (!karte || !M || karte.dataset.kenney === '1') return;
    let tm, faktor;
    try { tm = Math.round(M.teamMorale()); faktor = M.moraleStrengthFactor(); } catch (e) { return; }
    const st = MORAL_STUFEN.find(s => tm >= s[0]);
    const pct = Math.round((faktor - 1) * 100);
    const segment = [0, 40, 55, 70, 85].map((ab, i) => `<i class="s${i + 1}${tm >= ab && (i === 4 || tm < [40, 55, 70, 85][i]) ? ' an' : ''}"></i>`).join('');
    karte.removeAttribute('style');
    karte.classList.add('k-moral');
    karte.dataset.kenney = '1';
    karte.innerHTML = `<div class="k-moral-kopf">${marke(st[2])}<div><small>Teammoral</small><b>${tm} <span class="kz-${st[3]}">${st[1]}</span></b></div>` +
      `<span class="k-moral-effekt">Stärke <b class="${pct > 0 ? 'kz-gut' : pct < 0 ? 'kz-schlecht' : ''}">${pct > 0 ? '+' : ''}${pct} %</b></span></div>` +
      `<div class="k-skala" role="img" aria-label="Teammoral ${tm} von 100: ${st[1]}">${segment}<span class="k-skala-zeiger" style="left:${Math.max(2, Math.min(98, tm))}%"></span></div>` +
      '<div class="k-skala-text"><span>zerrüttet</span><span>angespannt</span><span>neutral</span><span>gut</span><span>euphorisch</span></div>';
  }
  if (typeof W.renderHomeTab === 'function') {
    const _orig = W.renderHomeTab;
    W.renderHomeTab = function () {
      const r = _orig.apply(this, arguments);
      try { moralKarte(); } catch (e) { console.warn('[DFL-Kenney] Teammoral', e); }
      return r;
    };
    try { renderHomeTab = W.renderHomeTab; } catch (e) { /* nicht global gebunden */ }
  }
  // Fitness-Farbe (global, fitness_patch.js): Tokens statt fester Farben
  if (typeof W.fitnessColor === 'function') {
    const _orig = W.fitnessColor;
    W.fitnessColor = function (v) {
      // Kickstil: Tokens auch ohne DFL
      v = v || 0; return v >= 80 ? 'var(--app-gut, #25c065)' : v >= 55 ? 'var(--app-mittel, #f2c14e)' : 'var(--app-schlecht, #ff4d4d)';
    };
  }

  // ── 10) Laden ─────────────────────────────────────────────────────────────
  {
    const _orig = W._afterLoad;
    if (typeof _orig === 'function') W._afterLoad = function () {
      const r = _orig.apply(this, arguments);
      try { flaggenWeg(); } catch (e) { console.warn('[DFL-Kenney] Flaggen', e); }
      return r;
    };
  }
  // Spielstand ist beim Laden der Seite schon da (initGame läuft vor den Patches)
  try { flaggenWeg(); } catch (e) { /* ohne Spielstand */ }
  if (DOM) { if (document.body) waechter(); else document.addEventListener('DOMContentLoaded', waechter); }

  const stand = () => ({ eintraege: Object.keys(EMOJI).length, unbekannt: [...unbekannt], zaehler: Object.assign({}, zaehler) });
  W.DFLKenney = { EMOJI, IM_SATZ, ARTEN, zeichen, marke, markeAus, bild, teile, ohne, zuIcons, eintrag, basis, ersetze, flaggenWeg, stand, moralKarte };
  console.log('[DFL-Kenney v1] aktiv — ' + Object.keys(EMOJI).length + ' Emojis → Zeichen (game-icons/Tabler), Wächter, Flaggen weg, Farben aus Tokens (D104)');
})();
