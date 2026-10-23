/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · NATIONEN & HERKUNFT  ·  v1   (Nutzer 2026-10-16: „mehr Länder in der Erstellung und Generation –
   vor allem können auch Brasilianer in sehr guten Akademien spawnen“)
   ─────────────────────────────────────────────────────────────────────────
   · Namen je Land aus SCOUTING_COUNTRIES (29 Länder) oder data/nationen.js KS_NAMEN_EXTRA (47 weitere) – vorher bekamen
     Spieler aus Schottland, Griechenland, Tschechien … zufällig eines der 29 Länder; Griechen gab es praktisch nicht.
   · Ausland gewichtet nach Export (Brasilien 10, Frankreich 9, Argentinien 7 …) statt gleich verteilt (vorher genauso viele
     Japaner wie Brasilianer).
   · Akademien: ausländische Talente je nach Stufe (talentLand): bis Stufe 3 2 %, Stufe 6–7 10 %, Stufe 10 28 % –
     die Spitzenakademien holen sich Brasilianer, Franzosen, Argentinier, Senegalesen …
   Eingehängt in euro_kader.js (name), kickstil_akademien.js (erzeuge), kickstil_lebende_welt.js (auslandName) und
   generateYouthProspects (eigene Akademie, Hülle unten). Grundlage für kickstil_laenderspiele.js.
   API: KSNationen.alle() · .get(land) · .name(land) · .vereinsName(land, auslandAnteil) · .auslandLand(ohne)
        · .talentLand(stufe, heimat) · .flagge(land) · .CFG
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const CFG = { talentAusland: [0, 0.02, 0.02, 0.02, 0.05, 0.05, 0.10, 0.10, 0.16, 0.22, 0.28] };   // Index = Akademie-Stufe
  const zufall = n => Math.floor(Math.random() * n);
  let LISTE = null, INDEX = null;
  function alle() {
    if (LISTE) return LISTE;
    LISTE = (window.KS_NATIONEN || []).map(([name, flag, verband, basis, exp]) => ({ name, flag, verband, basis, exp }));
    INDEX = {}; LISTE.forEach(n => { INDEX[n.name] = n; });
    return LISTE;
  }
  const get = land => { alle(); return INDEX[land] || null; };
  function namen(land) {
    const SC = window.SCOUTING_COUNTRIES || {}, EX = window.KS_NAMEN_EXTRA || {};
    const c = SC[land] && SC[land].first && SC[land].last ? SC[land] : EX[land];
    return c && c.first && c.first.length && c.last && c.last.length ? c : null;
  }
  const flagge = land => { const n = get(land), c = namen(land); return (n && n.flag) || (c && c.flag) || ''; };
  function name(land) {
    const c = namen(land) || namen('Deutschland');
    const l = namen(land) ? land : 'Deutschland';
    return { firstName: c.first[zufall(c.first.length)], name: c.last[zufall(c.last.length)], flag: flagge(l) || c.flag || '', country: l };
  }
  // Gewichtet nach Export – nur Länder mit Namensliste
  let TOPF = null;
  function auslandLand(ohne) {
    if (!TOPF) { TOPF = []; alle().forEach(n => { if (n.exp > 0 && namen(n.name)) TOPF.push([n.name, n.exp]); }); }
    const pool = ohne ? TOPF.filter(t => t[0] !== ohne) : TOPF;
    const summe = pool.reduce((s, t) => s + t[1], 0);
    let r = Math.random() * summe;
    for (const t of pool) { r -= t[1]; if (r <= 0) return t[0]; }
    return pool.length ? pool[pool.length - 1][0] : 'Deutschland';
  }
  // Vereinsspieler: Heimat mit Namensliste, sonst/anteilig Ausland
  function vereinsName(land, auslandAnteil) {
    if (namen(land) && Math.random() >= (auslandAnteil == null ? 0.30 : auslandAnteil)) return name(land);
    return name(auslandLand(land));
  }
  function talentLand(stufe, heimat) {
    const s = Math.max(0, Math.min(10, Math.round(stufe || 1)));
    return Math.random() < CFG.talentAusland[s] ? auslandLand(heimat) : heimat;
  }

  // ── Eigene Akademie: neue Talente können aus dem Ausland kommen (Hülle um generateYouthProspects) ──
  if (typeof window.generateYouthProspects === 'function') {
    const _gen = window.generateYouthProspects;
    window.generateYouthProspects = function () {
      const vorher = new Set(((typeof CLUB !== 'undefined' && CLUB && CLUB.youthProspects) || []).map(p => p && p.id));
      const r = _gen.apply(this, arguments);
      try {
        const st = (CLUB.facilities && CLUB.facilities.youth) || 1;
        (CLUB.youthProspects || []).forEach(p => {
          if (!p || vorher.has(p.id) || p.country !== 'Deutschland') return;
          const l = talentLand(st, 'Deutschland');
          if (l === 'Deutschland') return;
          Object.assign(p, name(l));
        });
      } catch (e) { console.warn('[Kickstil-Nationen] Akademie', e); }
      return r;
    };
    try { generateYouthProspects = window.generateYouthProspects; } catch (e) { /* window reicht */ }
  }

  window.KSNationen = { alle, get, namen, name, vereinsName, auslandLand, talentLand, flagge, CFG };
  console.log('[Kickstil-Nationen v1] aktiv — ' + alle().length + ' Nationen, Herkunft nach Export, Akademie-Ausländer je Stufe');
})();
