/* =====================================================================
   FLAGS PATCH v1 — PNG-Länderflaggen statt Emoji
   Kenney-Flaggen (CC0, ISO-3166-Codes) in assets/flags/.
   Stellt globale Helfer bereit; ersetzt NICHT automatisch bestehende
   Emojis — die Render-Funktionen nutzen flagHTML()/flagSrc() gezielt.
   Muss VOR den UI-Modulen geladen werden, die es verwenden.
   ===================================================================== */
(function () {
  'use strict';
  var BASE = 'assets/flags/';

  /* Deutscher Landesname → Flaggen-Dateiname (ohne .png).
     Abgeleitet aus Scouting (19) + Europapokal (43). */
  var MAP = {
    'Deutschland':'DE', 'Österreich':'AT', 'Schweiz':'CH', 'Brasilien':'BR',
    'Argentinien':'AR', 'Kolumbien':'CO', 'Uruguay':'UY', 'Portugal':'PT',
    'Spanien':'ES', 'Frankreich':'FR', 'Belgien':'BE', 'Niederlande':'NL',
    'Kroatien':'HR', 'Serbien':'RS', 'Elfenbeinküste':'CI', 'Senegal':'SN',
    'Nigeria':'NG', 'Japan':'JP', 'Südkorea':'KR',
    'England':'GB_ENG', 'Schottland':'GB_SCT', 'Wales':'GB_WLS', 'Nordirland':'GB',
    'Italien':'IT', 'Türkei':'TR', 'Griechenland':'GR', 'Tschechien':'CZ',
    'Dänemark':'DK', 'Norwegen':'NO', 'Polen':'PL', 'Ukraine':'UA',
    'Rumänien':'RO', 'Israel':'IL', 'Ungarn':'HU', 'Schweden':'SE',
    'Zypern':'CY', 'Bulgarien':'BG', 'Aserbaidschan':'AZ', 'Kasachstan':'KZ',
    'Slowakei':'SK', 'Slowenien':'SI', 'Armenien':'AM', 'Kosovo':'XK',
    'Finnland':'FI', 'Mazedonien':'MK', 'Nordmazedonien':'MK', 'Island':'IS',
    'Irland':'IE', 'Malta':'MT', 'Gibraltar':'GI', 'Luxemburg':'LU',
    'Litauen':'LT', 'Lettland':'LV', 'Estland':'EE', 'BosnienHerzegowina':'BA',
    'Bosnien-Herzegowina':'BA', 'Albanien':'AL', 'Russland':'RU', 'USA':'US',
    'Mexiko':'MX', 'Kanada':'CA', 'Australien':'AU', 'Marokko':'MA',
    'Algerien':'DZ', 'Tunesien':'TN', 'Ägypten':'EG', 'Ghana':'GH',
    'Kamerun':'CM', 'Mali':'ML', 'Griechland':'GR'
  };

  window.FLAG_ISO = MAP;

  /* ISO-Codes, für die es im Kenney-Satz KEINE Datei gibt.
     Bisher fing das nur ein `onerror="this.remove()"` ab — das Bild verschwand
     zwar, der 404 stand aber trotzdem in der Konsole (onerror läuft erst NACH
     dem gescheiterten Request). Bei einem Projekt, in dem man die Konsole zum
     Debuggen liest, ist dieses Rauschen teuer. Hier gar nicht erst anfragen;
     stattdessen bleibt das Emoji stehen. */
  var FEHLT = { XK: 1 };   // Kosovo — im Satz nicht enthalten, in euro_clubs.js aber genutzt
  window.FLAG_FEHLT = FEHLT;

  /* Pfad zur Flagge oder null */
  window.flagSrc = function (country) {
    var iso = MAP[country];
    return (iso && !FEHLT[iso]) ? BASE + iso + '.png' : null;
  };

  /* <img>-Tag als String; Fallback: leerer String (Aufrufer kann Emoji behalten).
     cls: optionale zusätzliche CSS-Klasse. */
  window.flagHTML = function (country, cls) {
    var src = window.flagSrc(country);
    if (!src) return '';
    var safe = String(country).replace(/"/g, '&quot;');
    // onerror: fehlt eine Flaggendatei, verschwindet das Bild lautlos statt als
    // kaputtes Symbol samt 404 in der Konsole zu erscheinen (Kosovo/XK fehlt z. B.
    // im Kenney-Satz, wird aber in den Spielerdaten verwendet).
    return '<img class="flag-ico' + (cls ? ' ' + cls : '') + '" src="' + src + '" alt="' + safe + '" title="' + safe + '" loading="lazy" onerror="this.remove()">';
  };

  /* ISO-Code aus einem Regional-Indicator-Flaggen-Emoji (z. B. 🇩🇪 → DE) */
  function isoFromRI(s) {
    var cps = Array.from(s);
    return String.fromCharCode(cps[0].codePointAt(0) - 0x1F1E6 + 65) +
           String.fromCharCode(cps[1].codePointAt(0) - 0x1F1E6 + 65);
  }
  window.flagFromEmoji = function (emoji) {
    if (!emoji) return '';
    var cp = Array.from(emoji)[0];
    if (cp && cp.codePointAt(0) >= 0x1F1E6 && cp.codePointAt(0) <= 0x1F1FF) {
      var iso = isoFromRI(emoji);
      if (FEHLT[iso]) return emoji;   // keine Datei → Emoji behalten statt 404
      return '<img class="flag-ico" src="' + BASE + iso + '.png" alt="" loading="lazy">';
    }
    return '';
  };

  /* ---------- DOM-Ersetzer: Emoji-Flaggen → PNG ---------- */
  var RI_PAIR = /\uD83C[\uDDE6-\uDDFF]\uD83C[\uDDE6-\uDDFF]/;                 // 🇩🇪 usw.
  var RI_PAIR_G = new RegExp(RI_PAIR.source, 'g');
  var BLACK = /🏴(?:\uDB40[\uDC00-\uDFFF])*/;                       // 🏴 (evtl. mit Tags: England/Schottland/Wales)
  var ANY = new RegExp(RI_PAIR.source + '|' + BLACK.source, 'g');
  function ukFile(txt) {
    if (/England/i.test(txt)) return 'GB_ENG';
    if (/Schottland/i.test(txt)) return 'GB_SCT';
    if (/Wales/i.test(txt)) return 'GB_WLS';
    return 'GB';
  }
  function imgFor(iso) {
    var img = document.createElement('img');
    img.className = 'flag-ico'; img.src = BASE + iso + '.png'; img.alt = ''; img.loading = 'lazy';
    return img;
  }
  function processTextNode(node) {
    var text = node.nodeValue;
    ANY.lastIndex = 0;
    if (!ANY.test(text)) return;
    ANY.lastIndex = 0;
    /* In <option> kann kein Bild stehen → Emoji entfernen (Windows zeigt sonst "DE") */
    if (node.parentNode && node.parentNode.nodeName === 'OPTION') {
      node.nodeValue = text.replace(ANY, '').replace(/^\s+/, '');
      return;
    }
    var frag = document.createDocumentFragment(), last = 0, m;
    while ((m = ANY.exec(text))) {
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      var iso = (m[0].charCodeAt(0) === 0xD83C && m[0].charCodeAt(1) === 0xDFF4) ? ukFile(text) : isoFromRI(m[0]);
      // Ohne Datei das Emoji stehen lassen — sonst verschwindet die Flagge ganz
      // (Emoji ersetzt, Bild lädt nicht) und der 404 landet in der Konsole.
      if (FEHLT[iso]) frag.appendChild(document.createTextNode(m[0]));
      else frag.appendChild(imgFor(iso));
      last = m.index + m[0].length;
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    node.parentNode.replaceChild(frag, node);
  }
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, IMG: 1 };
  window.replaceFlagsIn = function (root) {
    if (!root || !root.nodeType) return;
    if (root.nodeType === 3) { if (root.parentNode && !SKIP[root.parentNode.nodeName]) processTextNode(root); return; }
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue || (n.parentNode && SKIP[n.parentNode.nodeName])) return NodeFilter.FILTER_REJECT;
        return RI_PAIR.test(n.nodeValue) || BLACK.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    var nodes = [], n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(processTextNode);
  };

  /* CSS für Inline-Flaggen (skaliert mit der Textgröße) */
  var st = document.createElement('style');
  st.textContent = '.flag-ico{width:1.2em;height:1.2em;vertical-align:-0.22em;border-radius:2px;' +
    'object-fit:cover;display:inline-block;box-shadow:0 0 0 1px rgba(0,0,0,.25)}';
  (document.head || document.documentElement).appendChild(st);

  /* Nach jedem View-Wechsel ersetzen + laufende Re-Renders via Observer abfangen */
  function boot() {
    var app = document.querySelector('.app') || document.body;
    if (typeof window.switchAppView === 'function' && !window.switchAppView.__flags) {
      var _orig = window.switchAppView;
      window.switchAppView = function () {
        var r = _orig.apply(this, arguments);
        setTimeout(function () { window.replaceFlagsIn(app); }, 0);
        return r;
      };
      window.switchAppView.__flags = true;
    }
    var pending = false;
    var obs = new MutationObserver(function (muts) {
      if (pending) return; pending = true;
      requestAnimationFrame(function () {
        pending = false;
        muts.forEach(function (mu) {
          mu.addedNodes.forEach(function (nd) { window.replaceFlagsIn(nd); });
        });
      });
    });
    obs.observe(app, { childList: true, subtree: true });
    window.replaceFlagsIn(app);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  console.log('[Flags v1] aktiv — ' + Object.keys(MAP).length + ' Länder → PNG-Flaggen, DOM-Ersetzer aktiv');
})();
