/* ═══════════════════════════════════════════════════════════════════════════
   DFL-SPEICHER  ·  v1   (Prüfung 2026-10-09: bei vollem Speicher ging ein Spielstand still verloren)
   ─────────────────────────────────────────────────────────────────────────
   Hängt sich in window.storage (storage_polyfill.js → localStorage) und lädt deshalb direkt danach – vor
   engine_main.js, weil initGame den Spielstand liest, bevor die Patches laden.
     · Schreibfehler werden erkannt (der Polyfill schluckte sie: Rückgabe null, keine Meldung) und gesammelt;
       dfl_speicher_patch.js macht daraus ein Speichern „ganz oder gar nicht“ mit Hinweis.
     · Platz: Ein Spielstand hat ~0,6–0,8 Mio Zeichen, der Browser erlaubt je nach Gerät 2,5–5 Mio. Wird es knapp
       (über CFG.schwelle), werden die ANDEREN Spielstände einmalig gepackt (lz-string, etwa 1/7), reicht das nicht,
       auch der aktive. Der aktive bleibt sonst ungepackt: das Spiel speichert ~4-mal je Woche, Packen kostet
       am Handy ~0,4 s je Liga-Teil.
     · Lesen entpackt selbst; alte ungepackte Stände, Export und Import funktionieren unverändert.
   API: DFLSpeicher (zustand, archiviere, fehler…, roh = ungepackter Zugriff für den Rückbau).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const S0 = window.storage;
  if (!S0 || typeof S0.get !== 'function' || typeof S0.set !== 'function') { console.warn('[DFL-Speicher] window.storage fehlt – inaktiv'); return; }

  const CFG = {
    marke: '\u0001LZ1\u0001',     // gepackte Werte beginnen damit (JSON beginnt nie mit \u0001, lz-UTF16 nutzt nur Zeichen ≥ 32)
    gross: 20000,                  // nur Teile ab dieser Länge packen (Liga, Verein)
    schwelle: 1500000,             // ab so vielen Zeichen im localStorage wird gepackt (Safari erlaubt ~2,5 Mio, Chrome ~5 Mio)
    praefix: 'fm_',                // storage_polyfill.js
    platz: 5242880                 // Anzeige „von ≈ 5,2 MB“ (Chromium/Android-WebView: 5 MiB Zeichen, gemessen 2026-10-09)
  };
  const roh = {                    // ungepackter Zugriff (Rückbau in dfl_speicher_patch.js)
    get: S0.get.bind(S0), set: S0.set.bind(S0), delete: typeof S0.delete === 'function' ? S0.delete.bind(S0) : null
  };
  const LZ = () => (typeof LZString !== 'undefined' && LZString) || null;
  const hatLS = (() => { try { return typeof localStorage !== 'undefined' && !!localStorage; } catch (e) { return false; } })();

  // ── Packen ───────────────────────────────────────────────────────────────
  const gepackt = v => typeof v === 'string' && v.indexOf(CFG.marke) === 0;
  function packe(v) {
    const lz = LZ();
    if (!lz || typeof v !== 'string' || gepackt(v)) return v;
    return CFG.marke + lz.compressToUTF16(v);
  }
  function entpacke(v) {
    if (!gepackt(v)) return v;
    const lz = LZ();
    if (!lz) { console.warn('[DFL-Speicher] lz-string fehlt – gepackter Spielstand nicht lesbar'); return null; }
    const x = lz.decompressFromUTF16(v.slice(CFG.marke.length));
    return x ? x : null;           // kaputt → wie fehlend (loadSlot meldet „nicht ladbar“)
  }

  // ── Belegung (nur mit localStorage messbar) ──────────────────────────────
  function belegt() {
    if (!hatLS) return 0;
    let n = 0;
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); n += k.length + (localStorage.getItem(k) || '').length; } } catch (e) { /* gesperrt */ }
    return n;
  }
  const laengeVon = k => { if (!hatLS) return 0; try { return (localStorage.getItem(CFG.praefix + k) || '').length; } catch (e) { return 0; } };
  const SLOT = /^fcm-save-(.+)-(league|cup|club|market)$/;
  const slotVon = k => { const m = SLOT.exec(k); return m ? m[1] : null; };

  // Andere Spielstände einmalig packen (der genannte bleibt, wie er ist)
  async function archiviere(ausser) {
    if (!hatLS || !LZ()) return 0;
    let gespart = 0;
    const schluessel = [];
    try { for (let i = 0; i < localStorage.length; i++) schluessel.push(localStorage.key(i)); } catch (e) { return 0; }
    for (const voll of schluessel) {
      if (voll.indexOf(CFG.praefix) !== 0) continue;
      const k = voll.slice(CFG.praefix.length), id = slotVon(k);
      if (!id || id === ausser) continue;
      const v = localStorage.getItem(voll);
      if (!v || v.length < CFG.gross || gepackt(v)) continue;
      const p = packe(v);
      if (p.length >= v.length) continue;
      const r = await roh.set(k, p);           // kleiner als vorher → passt immer
      if (r) gespart += v.length - p.length;
    }
    if (gespart) console.log(`[DFL-Speicher] andere Spielstände gepackt: ${Math.round(gespart / 1000)} Tsd. Zeichen frei`);
    return gespart;
  }

  // ── Fehler sammeln ───────────────────────────────────────────────────────
  const FEHLER = [];
  async function versuche(k, wert) {
    try { return await roh.set(k, wert); } catch (e) { return null; }
  }

  // ── window.storage umhüllen ──────────────────────────────────────────────
  S0.set = async function (k, v) {
    let wert = v;
    const gross = typeof v === 'string' && v.length >= CFG.gross && !!LZ();
    if (gross && hatLS) {
      const nachher = () => belegt() - laengeVon(k) + v.length;
      if (nachher() > CFG.schwelle) await archiviere(slotVon(k));
      if (nachher() > CFG.schwelle) wert = packe(v);
    }
    let r = await versuche(k, wert);
    if (!r && gross) {                          // voll: erst die anderen packen, dann sich selbst
      await archiviere(slotVon(k));
      r = await versuche(k, wert);
      if (!r && wert === v) { wert = packe(v); r = await versuche(k, wert); }
    }
    if (!r) FEHLER.push({ k, laenge: typeof wert === 'string' ? wert.length : 0, zeit: Date.now() });
    return r;
  };
  S0.get = async function (k) {
    const r = await roh.get(k);
    if (r && typeof r.value === 'string' && gepackt(r.value)) {
      const v = entpacke(r.value);
      return v == null ? null : Object.assign({}, r, { value: v });
    }
    return r;
  };

  // Überblick für die Spielstände-Seite: je Spielstand Größe, gepackt, vollständig
  function zustand() {
    const slots = {};
    if (hatLS) {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const voll = localStorage.key(i);
          if (voll.indexOf(CFG.praefix) !== 0) continue;
          const k = voll.slice(CFG.praefix.length), m = SLOT.exec(k);
          if (!m) continue;
          const v = localStorage.getItem(voll) || '', s = slots[m[1]] = slots[m[1]] || { id: m[1], groesse: 0, gepackt: false, teile: {} };
          s.groesse += v.length; s.teile[m[2]] = v.length; if (gepackt(v)) s.gepackt = true;
        }
      } catch (e) { /* gesperrt */ }
    }
    Object.values(slots).forEach(s => { s.vollstaendig = !!(s.teile.league && s.teile.cup); });
    return { belegt: belegt(), platz: CFG.platz, schwelle: CFG.schwelle, slots, messbar: hatLS };
  }

  window.DFLSpeicher = {
    CFG, roh, packe, entpacke, gepackt, belegt, archiviere, zustand,
    fehlerStart() { FEHLER.length = 0; },
    fehler() { return FEHLER.slice(); }
  };
  console.log('[DFL-Speicher v1] aktiv — Schreibfehler erkannt, Spielstände bei knappem Speicher gepackt' + (LZ() ? '' : ' (lz-string fehlt: nur Fehlererkennung)'));
})();
