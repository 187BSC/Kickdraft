/* ═══════════════════════════════════════════════════════════════════════════
   DFL · ERFUNDENE VEREINSNAMEN  ·  v1   (D57, entschieden 2026-10-09: „ganz klar erfundene Namen“; löst D1 ab)
   ─────────────────────────────────────────────────────────────────────────
   Das Spiel zeigt die Franchise-Namen aus der Spec (data/league.json: spec_name, kuerzel) statt echter Vereinsnamen:
     · name      → „Bremen Titans“ (vorher „SV Werder Bremen“)
     · kurz      → „BRE“ (drei Buchstaben, eindeutig – Tabellen, Schilder, Ehrenhalle, Trade-Log)
     · kurzname  → „Titans“ (Spitzname für den eigenen Verein: Kopfzeilen, Banner im Gelände)
   Die echten Namen bleiben nur als Herkunft in den Daten (verein, vereinKurz) und werden nirgends angezeigt.
   Lädt direkt nach data/dfl_liga.js – alle DFL-Module lesen danach schon die neuen Namen.
   Alte Spielstände: Welt (beim Entpacken, dfl_liga_patch.js), Liga-Tabelle und eigener Verein werden beim Laden
   angeglichen; alte Meldungen im Postfach behalten ihren Text.
   Hinweis D57: Die Liste ist noch nicht bereinigt (Doppelte, Nähe zu echten Spitznamen) – Änderungen nur in league.json.
   Spielernamen: gleiche Kurznamen im eigenen Kader („F. Lang“ zweimal) zeigen den vollen Vornamen (displayName).
   API: DFLNamen.angleichen() · .kuerzel(id) · .kurzname(id) · .kurzEindeutig(p, kurz)
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const D = window.DFL_LIGA;
  if (!D || !D.franchises) { console.warn('[DFL-Namen] DFL_LIGA fehlt – Namen unverändert'); return; }

  D.franchises.forEach(f => {
    if (f.verein) return;                                                    // schon umgestellt
    f.verein = f.name; f.vereinKurz = f.kurz;
    if (f.spec_name) f.name = f.spec_name;
    if (f.kuerzel) f.kurz = f.kuerzel;
    f.kurzname = f.spec_name ? f.spec_name.split(' ').slice(1).join(' ') : f.kurz;
  });
  const nachId = new Map(D.franchises.map(f => [f.id, f]));
  const nachAlt = new Map(D.franchises.map(f => [f.verein, f]));
  const dflIdVon = id => id === 'fcm' ? (typeof CLUB !== 'undefined' && CLUB && CLUB.dfl ? CLUB.dfl.franchiseId : null) : String(id || '').replace(/^dfl_/, '');
  const kuerzel = id => { const f = nachId.get(dflIdVon(id)); return f ? f.kurz : ''; };
  const kurzname = id => { const f = nachId.get(dflIdVon(id)); return f ? f.kurzname : ''; };

  // Spielstand angleichen: eigener Verein, Liga-Tabelle (Teams mit dflId)
  function angleichen() {
    if (typeof CLUB === 'undefined' || !CLUB || !CLUB.dfl || !CLUB.dfl.franchiseId) return false;
    const f = nachId.get(CLUB.dfl.franchiseId); if (!f) return false;
    let n = 0;
    if (CLUB.name !== f.name) { CLUB.name = f.name; n++; }
    if (CLUB.shortName !== f.kurzname) { CLUB.shortName = f.kurzname; n++; }
    if (typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.tiers) {
      Object.values(LEAGUE.tiers).forEach(tier => (tier.groups || []).forEach(g => (g.teams || []).forEach(t => {
        const ff = t.id === 'fcm' ? f : (t.dflId ? nachId.get(t.dflId) : nachAlt.get(t.name));
        if (!ff) return;
        if (t.name !== ff.name) { t.name = ff.name; n++; }
        if (t.kurz != null && t.kurz !== ff.kurz) { t.kurz = ff.kurz; n++; }
        if (t.shortTag != null && t.shortTag !== ff.kurz) { t.shortTag = ff.kurz; n++; }
      })));
    }
    return n > 0;
  }
  {
    const _orig = window._afterLoad;
    if (typeof _orig === 'function') window._afterLoad = function () {
      const r = _orig.apply(this, arguments);
      try { angleichen(); } catch (e) { console.warn('[DFL-Namen] Spielstand angleichen', e); }
      return r;
    };
  }
  // Spielstand ist beim Laden der Seite schon da (initGame läuft vor den Patches)
  try { angleichen(); } catch (e) { console.warn('[DFL-Namen] Angleichen', e); }

  // Gleiche Kurznamen im eigenen Kader (2026-10-11: zweimal „F. Lang“ – der Generator hält nur volle Namen eindeutig) →
  // dort der volle Vorname („Felix Lang“ / „Florian Lang“), sonst wie bisher „F. Lang“
  function kurzEindeutig(p, kurz) {
    if (!p || !p.firstName || typeof SQUAD === 'undefined' || !Array.isArray(SQUAD)) return kurz;
    if (typeof CLUB === 'undefined' || !CLUB || !CLUB.dfl || !CLUB.dfl.aktiv) return kurz;
    if (SQUAD.indexOf(p) < 0 && !SQUAD.some(q => q.id === p.id && q.name === p.name)) return kurz;   // nur eigene Spieler
    const ini = p.firstName.charAt(0);
    return SQUAD.some(q => q !== p && q.id !== p.id && q.name === p.name && q.firstName && q.firstName !== p.firstName && q.firstName.charAt(0) === ini)
      ? p.firstName + ' ' + p.name : kurz;
  }
  {
    const _orig = window.displayName;
    if (typeof _orig === 'function') window.displayName = function (p) { return kurzEindeutig(p, _orig.apply(this, arguments)); };
  }

  window.DFLNamen = { angleichen, kuerzel, kurzname, kurzEindeutig };
  console.log('[DFL-Namen v1] aktiv — erfundene Franchise-Namen (D57) mit Kürzeln, Spielstand angeglichen, Kurznamen im Kader eindeutig');
})();
