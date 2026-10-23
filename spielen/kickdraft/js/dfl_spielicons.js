/* ═══════════════════════════════════════════════════════════════════════════
   DFL · SPIELICONS  ·  v1   (D52, freigegeben 2026-10-09)
   ─────────────────────────────────────────────────────────────────────────
   Gefüllte Silhouetten von game-icons.net (CC BY 3.0, Autor je Icon in data/dfl_spielicons.js) für die
   Spielwelt: Spieler-Eigenschaften, Postfach, Ehrenhalle. Feste Regel: game-icons nur in runden oder
   pillenförmigen Farbmarken, Tabler bleibt für die Bedienung (Leiste, Pfeile, Knöpfe).
   Die Icons liegen einmal als SVG-Sprite im Dokument (<symbol>), gefärbt wird über currentColor.
   API: DFLSpielicons.svg(name) · .marke(name, art) · .autoren() · .hat(name)
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const D = window.DFL_SPIELICONS;
  if (!D) { console.warn('[DFL-Spielicons] data/dfl_spielicons.js fehlt'); return; }

  function sprite() {
    if (document.getElementById('dfl-spielicons')) return;
    const svg = '<svg id="dfl-spielicons" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden">' +
      Object.entries(D).map(([n, x]) => `<symbol id="gi-${n}" viewBox="0 0 512 512">${x.d.map(d => `<path d="${d}"/>`).join('')}</symbol>`).join('') + '</svg>';
    document.body.insertAdjacentHTML('afterbegin', svg);
  }
  if (document.body) sprite(); else document.addEventListener('DOMContentLoaded', sprite);

  const hat = n => !!D[n];
  const svg = n => hat(n) ? `<svg class="gi" aria-hidden="true" focusable="false"><use href="#gi-${n}"/></svg>` : '';
  // art: plus · minus · mix · gold · neutral (Farbe der Marke)
  const marke = (n, art) => hat(n) ? `<span class="gi-marke gi-${art || 'neutral'}">${svg(n)}</span>` : '';
  function autoren() {
    const a = {};
    Object.entries(D).forEach(([n, x]) => (a[x.autor] = a[x.autor] || []).push(n));
    return a;
  }

  // ── Spieler-Eigenschaften (traits.js): Icon vor dem Namen ─────────────────
  const EIGENSCHAFT = {
    'Frühentwickler': 'lightning-trio', 'Spätentwickler': 'stopwatch', 'Trainingsweltmeister': 'weight-lifting-up',
    'Trainingsfaul': 'night-sleep', 'Laufwunder': 'run', 'Konditionsschwach': 'snail', 'Verletzungsanfällig': 'bandage-roll',
    'Unverwüstlich': 'shield', 'Schnellheiler': 'heart-plus', 'Vorbildprofi': 'shiny-apple', 'Führungsspieler': 'crown',
    'Mentor': 'teacher', 'Diva': 'drama-masks', 'Vereinstreu': 'linked-rings', 'Geldgierig': 'money-stack', 'Bescheiden': 'feather',
    'Titelhungrig': 'trophy-cup', 'Heimatverbunden': 'house', 'Wechselfreudig': 'suitcase', 'Konstant': 'target-arrows',
    'Launisch': 'cloudy-fork', 'Nervenstark': 'brain', 'Mentalitätsspieler': 'muscle-up', 'Standardspezialist': 'soccer-kick',
    'Hitzkopf': 'enrage', 'Publikumsliebling': 'party-popper', 'Medienpräsent': 'microphone'
  };
  if (typeof window.traitChips === 'function') {
    const _orig = window.traitChips;
    window.traitChips = function () {
      const html = _orig.apply(this, arguments);
      return typeof html === 'string'
        ? html.replace(/(<span class="trait-chip [^"]*"[^>]*>)([^<]+)(<\/span>)/g, (m, a, name, z) => a + svg(EIGENSCHAFT[name.trim()]) + name + z)
        : html;
    };
    try { traitChips = window.traitChips; } catch (e) { /* nicht global gebunden */ }
  }

  // ── Postfach: Tabler-Zeichen der Spielwelt durch game-icons ersetzen ──────
  const POSTFACH = {
    'ti-ball-football': 'whistle', 'ti-cash': 'shaking-hands', 'ti-arrows-exchange': 'shaking-hands', 'ti-trophy': 'trophy-cup',
    'ti-calendar': 'newspaper', 'ti-news': 'newspaper', 'ti-bandage': 'bandage-roll', 'ti-file-text': 'quill-ink',
    'ti-school': 'graduate-cap', 'ti-ticket': 'ticket', 'ti-lock': 'padlock', 'ti-award': 'medal', 'ti-medal': 'medal'
  };
  if (typeof window.buildPostfachItems === 'function') {
    const _orig = window.buildPostfachItems;
    window.buildPostfachItems = function () {
      const items = _orig.apply(this, arguments);
      if (Array.isArray(items)) items.forEach(i => {
        const m = /\bti-[a-z0-9-]+/.exec(String(i.icon || ''));
        if (m && POSTFACH[m[0]]) i.icon = svg(POSTFACH[m[0]]);
      });
      return items;
    };
    try { buildPostfachItems = window.buildPostfachItems; } catch (e) { /* nicht global gebunden */ }
  }

  window.DFLSpielicons = { svg, marke, autoren, hat, EIGENSCHAFT, POSTFACH };
  console.log('[DFL-Spielicons v1] aktiv — ' + Object.keys(D).length + ' Icons von game-icons.net (CC BY 3.0) für Eigenschaften, Postfach, Ehrenhalle');
})();
