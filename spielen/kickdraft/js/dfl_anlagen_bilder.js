/* ═══════════════════════════════════════════════════════════════════════════
   DFL · ANLAGEN-BILDER  ·  v1   (2026-10-14)
   ─────────────────────────────────────────────────────────────────────────
   Nutzer 2026-10-14: „das trainingsgelände, stadion und so wenn man die ausbauen möchte sind noch alte, hässliche bilder zu sehen.
   auch die icons passen nicht. das muss gemacht werden“
     · Bilder: statt der SVG-Zeichnungen des Basisspiels (facilityImage, engine_main.js) die Gebäude des Vereinsgeländes auf einer
       Rasenplatte (Kenney-Stil), je Anlage 5 Stufen wie das Gelände: Stufe 1–2 → 1 · 3–4 → 2 · 5–6 → 3 · 7–8 → 4 · 9–10 → 5.
       Bilder aus spiel/tools/dfl_anlagen_render.js in app/anlagen/, Klassen mit url(…) in css/dfl_anlagen.css (Service Worker cacht sie
       über das Stylesheet). Medizin bekommt dasselbe Bild oben in ihrer Karte.
     · Marke der Anlage: Tabler-Icons wie Front Office, Postfach und Office (DFLAnlagen) statt der Spiel-Icons aus Emojis
     · Stufenvorschau: bringt die nächste Stufe ein neues Bild, steht es klein im Hinweis zur nächsten Stufe
     · Bau läuft / höchste Stufe / Zurückstufen mit Icons statt Zeichen, Baufortschritt als Kenney-Balken
   Lädt nach dfl_anlagen_patch.js (Zustand und Sanieren hängen schon an der Karte).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  // Flutlicht (2026-10-17, gleiche Datei): youth = Nachwuchsleistungszentrum; Bilder in app/anlagen/, Klassen in css/dfl_anlagen.css
  const BILD = { stadium: 'stadion', training: 'training', merchandising: 'fanshop', scouting: 'scouting', medizin: 'medizin', youth: 'jugend' };
  const ICON = { stadium: 'ti-building-stadium', training: 'ti-barbell', merchandising: 'ti-shirt-sport', scouting: 'ti-search', medizin: 'ti-first-aid-kit', youth: 'ti-school' };
  const STUFE_NAME = ['Basis', 'Ausgebaut', 'Modern', 'Profi', 'Weltklasse'];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const bildStufe = lvl => Math.max(1, Math.min(5, Math.ceil((+lvl || 1) / 2)));
  const name = key => { try { return (FACILITY_DEFS[key] && FACILITY_DEFS[key].name) || key; } catch (e) { return key; } };
  const stufeVon = key => {
    if (key === 'medizin' && window.DFLMedizin && DFLMedizin.stufe) return DFLMedizin.stufe();
    return (typeof CLUB !== 'undefined' && CLUB && CLUB.facilities && CLUB.facilities[key]) || 1;
  };

  // Stadion rund oder eckig (dfl_gelaende6.js, CLUB.ksStadionForm)
  const rund = () => { try { return !!(window.DFLGelaende && DFLGelaende.v6 && DFLGelaende.v6.rund && DFLGelaende.v6.rund()); } catch (e) { return false; } };
  const bildName = key => (key === 'stadium' && BILD[key] && rund() ? 'rund' : BILD[key]);
  // Stadionform wählen (Nutzer 2026-10-17: „Stadionform selbst wählen – pack das noch mit rein“), kostenlos
  function form(f) {
    if (typeof CLUB === 'undefined' || !CLUB || (f !== 'rund' && f !== 'eckig')) return;
    CLUB.ksStadionForm = f;
    try { if (typeof saveGameState === 'function') saveGameState(); } catch (e) { /* Tests */ }
    try { if (typeof renderClubTab === 'function') renderClubTab(); } catch (e) { /* ohne Ansicht */ }
    try { const el = document.getElementById('app-gelaende'); if (el && window.DFLGelaende) DFLGelaende.zeichne(el).catch(() => {}); } catch (e) { /* ohne Gelände */ }
  }
  function formHtml() {
    const r = rund(), k = (f, t, an) => `<button type="button" class="anl-form-k${an ? ' an' : ''}" aria-pressed="${an}" onclick="DFLAnlagenBilder.form('${f}')">${t}</button>`;
    return `<div class="anl-form" role="group" aria-label="Stadionform"><span>Form</span>${k('eckig', 'Eckig', !r)}${k('rund', 'Rund', r)}</div>`;
  }

  // Bild einer Anlage (ohne Rahmen) und mit Rahmen + Stufen-Schild wie die Karten
  function bildHtml(key, lvl) {
    const b = bildName(key); if (!b) return '';
    const s = bildStufe(lvl);
    return `<div class="fc-img anl-bild anl-bild-${b}-${s}" role="img" aria-label="${esc(name(key))} · ${STUFE_NAME[s - 1]}"></div>`;
  }
  function rahmenHtml(key, lvl) {
    return `<div class="fc-img-wrap anl-wrap">${bildHtml(key, lvl)}<span class="fc-tier-tag">${STUFE_NAME[bildStufe(lvl) - 1]}</span></div>`;
  }

  // ── Bilder statt der alten SVG-Zeichnungen (engine_main.js, global) ──────
  {
    const _orig = window.facilityImage;
    if (typeof _orig === 'function') {
      window.facilityImage = function (key, level) { return BILD[key] ? bildHtml(key, level) : _orig.apply(this, arguments); };
      try { facilityImage = window.facilityImage; } catch (e) { /* nicht global gebunden */ }
    }
  }
  // ── Marken: Tabler-Icons wie im Front Office (DFLAnlagen) ────────────────
  function markenSetzen() {
    if (typeof FACILITY_DEFS === 'undefined' || !FACILITY_DEFS) return;
    Object.keys(ICON).forEach(k => { if (FACILITY_DEFS[k]) FACILITY_DEFS[k].icon = `<i class="ti ${ICON[k]}" aria-hidden="true"></i>`; });
  }
  markenSetzen();

  // ── Karte: Rahmen mit Stufen-Schild, Stufenvorschau, Bau, höchste Stufe, Zurückstufen ──
  function bauHtml(key) {
    const b = typeof CLUB !== 'undefined' && CLUB && CLUB.facilityBuilds && CLUB.facilityBuilds[key];
    if (!b) return '';
    const pct = Math.max(0, Math.min(100, Math.round((b.totalWeeks - b.weeksLeft) / Math.max(1, b.totalWeeks) * 100)));
    return `<div class="fc-building anl-bau"><div class="anl-bau-kopf"><i class="ti ti-crane" aria-hidden="true"></i><span>Ausbau auf Stufe ${b.targetLevel} · noch ${b.weeksLeft} ${b.weeksLeft === 1 ? 'Woche' : 'Wochen'}</span></div>` +
      `<span class="anl-akku" role="img" aria-label="Bau zu ${pct} % fertig"><i class="mittel" style="width:${pct}%"></i></span></div>`;
  }
  function karteUmbauen(key, html) {
    if (!BILD[key] || typeof html !== 'string') return html;
    const cur = stufeVon(key);
    // Rahmen: eigene Klasse (Seitenverhältnis der Bilder) und Stufen-Schild nach den Bildstufen
    html = html.replace(/<div class="fc-img-wrap">([\s\S]*?)<span class="fc-tier-tag">[^<]*<\/span><\/div>/,
      (m, bild) => `<div class="fc-img-wrap anl-wrap">${bild}<span class="fc-tier-tag">${STUFE_NAME[bildStufe(cur) - 1]}</span></div>${key === 'stadium' ? formHtml() : ''}`);
    // Stufenvorschau: neues Bild mit der nächsten Stufe
    const max = (FACILITY_DEFS[key] && FACILITY_DEFS[key].maxLevel) || 10;
    if (cur < max && bildStufe(cur + 1) > bildStufe(cur)) {
      html = html.replace(/<span class="fc-roi-ico"><i class="ti ti-trending-up"><\/i><\/span>/,
        `<span class="fc-roi-ico anl-vorschau anl-bild anl-bild-${bildName(key)}-${bildStufe(cur + 1)}" role="img" aria-label="${esc(name(key))} · ${STUFE_NAME[bildStufe(cur + 1) - 1]}"></span>`);
    }
    html = html.replace(/<span class="fc-roi-ico"><i class="ti ti-trending-up"><\/i><\/span>/, '<span class="fc-roi-ico"><i class="ti ti-trending-up" aria-hidden="true"></i></span>');
    // Bau läuft (app_main.js: Zeichen + Inline-Farben) → Kran-Icon und Kenney-Balken
    html = html.replace(/<div class="fc-building">[\s\S]*?<\/div>\s*<\/div><\/div>/, () => bauHtml(key));
    html = html.replace('<div class="fc-maxed">✓ Maximal ausgebaut</div>', '<div class="fc-maxed"><i class="ti ti-circle-check" aria-hidden="true"></i> Maximal ausgebaut</div>');
    // Zurückstufen (bundle_finance.js): Pfeil-Icon, ohne Inline-Rahmen
    html = html.replace(/<button\s+class="fc-upgrade"\s+style="[^"]*"\s+onclick="downgradeFacility\('(\w+)'\)"\s+title="([^"]*)">\s*▼\s*Zurückstufen([^<]*)<\/button>/,
      (m, k, t, rest) => `<button type="button" class="fc-upgrade anl-zurueck" onclick="downgradeFacility('${k}')" title="${t}"><i class="ti ti-arrow-down" aria-hidden="true"></i> Zurückstufen${rest.replace(/\s+$/, '')}</button>`);
    // bundle_finance.js setzt den Knopf vor das erste </div> – das liegt im Bildrahmen (Knopf verdeckte das Bild, 2026-10-18): ans Kartenende
    const zk = html.match(/<button type="button" class="fc-upgrade anl-zurueck"[\s\S]*?<\/button>/);
    if (zk) { html = html.replace(zk[0], ''); const i = html.lastIndexOf('</div>'); if (i > 0) html = html.slice(0, i) + zk[0] + html.slice(i); }
    return html;
  }
  {
    const _orig = window.renderFacilityCard;
    if (typeof _orig === 'function') {
      window.renderFacilityCard = function (key) {
        const html = _orig.apply(this, arguments);
        try { return karteUmbauen(key, html); } catch (e) { console.warn('[DFL-Anlagen-Bilder] Karte', e); return html; }
      };
      try { renderFacilityCard = window.renderFacilityCard; } catch (e) { /* nicht global gebunden */ }
    }
  }
  // Medizin (dfl_medizin_patch.js zeichnet ihre Karte selbst): Bild oben
  {
    const _orig = window.renderClubTab;
    if (typeof _orig === 'function') {
      window.renderClubTab = function () {
        const r = _orig.apply(this, arguments);
        try {
          const med = document.querySelector('#club-facilities .med-karte');
          if (med && !med.querySelector('.anl-wrap')) {
            const s = stufeVon('medizin');
            med.insertAdjacentHTML('afterbegin', rahmenHtml('medizin', s));
            const naechste = med.querySelector('.med-naechste');
            if (naechste && s < 10 && bildStufe(s + 1) > bildStufe(s)) naechste.insertAdjacentHTML('afterbegin',
              `<span class="anl-vorschau anl-bild anl-bild-medizin-${bildStufe(s + 1)}" role="img" aria-label="${esc(name('medizin'))} · ${STUFE_NAME[bildStufe(s + 1) - 1]}"></span>`);
          }
        } catch (e) { console.warn('[DFL-Anlagen-Bilder] Medizin', e); }
        return r;
      };
      try { renderClubTab = window.renderClubTab; } catch (e) { /* nicht global gebunden */ }
    }
  }

  window.DFLAnlagenBilder = { bildStufe, bildHtml, rahmenHtml, BILD, ICON, form };
  console.log('[DFL-Anlagen-Bilder v1] aktiv — Gebäude des Geländes je Stufe statt alter Zeichnungen, Tabler-Marken, Stufenvorschau, Bau mit Kran');
})();
