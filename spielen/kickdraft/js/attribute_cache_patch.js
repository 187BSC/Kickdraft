/* ===== attribute_cache_patch.js =====
   WERTE-CACHE AUFFRISCHEN v1
   ─────────────────────────────────────────────────────────────────────────────
   `spielerWerte()` leitet die feinen Attribute (schiessen, passen, dribbling,
   tackling …) aus den groben Werten def/mid/att/pace ab und legt das Ergebnis in
   `p._werte` bzw. `p._werteAlt` ab. Der Cache wurde aber NIE verworfen, wenn sich
   die Grundwerte ändern — und genau das tut das Training jede Woche.

   Gemessen über eine komplette Saison (Fokus Offensive, Intensität Normal):
     Seidel    att 59 → 75   ·  schiessen im Cache 70, tatsächlich 83  (+13)
                             ·  offStellung 69 statt 82, passen 43 statt 50
     Schreiber att 58 → 71   ·  schiessen 60 statt 68, dribbling 70 statt 74
     Kuhn      att 34 → 48   ·  schiessen 32 statt 39
   Die Match-Engine v3 rechnet ausschließlich mit diesen feinen Werten. Ein
   Talent, das eine Saison lang trainiert, lief also weiter mit den Werten vom
   ersten Spieltag auf — sichtbar stieg nur die angezeigte OVR.

   Lösung: ein Fingerabdruck der Grundwerte. Ändert er sich, wird der Cache
   verworfen und beim nächsten Zugriff neu abgeleitet.
   v2 (2026-10-10): `mental` gehört dazu – Ausdauer und Spielintelligenz hängen
   daran, Ereignisse (Teamabend, Mentaltrainer) ändern nur `mental`, der Cache
   blieb dann bis zur nächsten Trainingsänderung alt. Das greift unabhängig
   davon, WER die Werte verändert hat — Training, Alterung, Potenzial-Revision,
   Beförderung aus der Jugend oder ein Neuzugang.

   Lädt NACH player_attributes.js, VOR init_bootstrap.js.
   ============================================================================= */
(function () {
  'use strict';

  if (typeof window.spielerWerte !== 'function') {
    console.warn('[WerteCache] spielerWerte fehlt — Modul inaktiv');
    return;
  }

  // Nicht aufzählbar ablegen, damit der Spielstand nicht wächst und der
  // Fingerabdruck nicht mitgespeichert wird.
  function setzeVersteckt(p, feld, wert) {
    try {
      Object.defineProperty(p, feld, { value: wert, writable: true, enumerable: false, configurable: true });
    } catch (e) { p[feld] = wert; }
    return wert;
  }

  function fingerabdruck(p) {
    return (p.def | 0) + '/' + (p.mid | 0) + '/' + (p.att | 0) + '/' + (p.pace | 0) + '/' + (p.mental | 0) +
           '/' + (p.technik != null ? (p.technik | 0) : '-') + '/' + (p.ovr | 0);
  }

  let verworfen = 0;

  const _orig = window.spielerWerte;
  window.spielerWerte = function (p, einsatzPos) {
    if (p && typeof p === 'object') {
      const jetzt = fingerabdruck(p);
      if (p._werteFinger !== jetzt) {
        // Grundwerte haben sich geändert — abgeleitete Werte sind veraltet.
        if (p._werte || p._werteAlt) verworfen++;
        try { delete p._werte; delete p._werteAlt; } catch (e) { p._werte = null; p._werteAlt = null; }
        setzeVersteckt(p, '_werteFinger', jetzt);
      }
    }
    return _orig.apply(this, arguments);
  };

  // Falls jemand die Werte im Spielstand direkt austauscht (Laden), sicherheits-
  // halber beim Boot einmal alles verwerfen.
  function alleVerwerfen() {
    try {
      const liste = (typeof SQUAD !== 'undefined' && SQUAD) ? SQUAD : [];
      liste.forEach(function (p) {
        if (!p) return;
        try { delete p._werte; delete p._werteAlt; delete p._werteFinger; } catch (e) {}
      });
      return liste.length;
    } catch (e) { return 0; }
  }
  if (typeof window.loadGameState === 'function') {
    const _load = window.loadGameState;
    window.loadGameState = async function () {
      const r = await _load.apply(this, arguments);
      try { alleVerwerfen(); } catch (e) {}
      return r;
    };
    try { loadGameState = window.loadGameState; } catch (e) {}
  }

  window.WerteCache = { alleVerwerfen: alleVerwerfen, fingerabdruck: fingerabdruck,
                        verworfen: function () { return verworfen; } };
  console.log('[WerteCache v2] aktiv — feine Attribute folgen dem Training (auch Mentalität)');
})();
