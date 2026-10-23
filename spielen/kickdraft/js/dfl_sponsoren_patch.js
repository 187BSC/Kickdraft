/* =====================================================================
   DFL: Sponsoren ohne Suchen (D129, Nutzer 2026-10-13)
   • Saison-Sponsor mit Klausel ganz raus („Ganz raus und dafür mehr Geld durch Merchandising oder Trikotsponsor“):
     seit dem Aufräumen 2026-10-13 auch aus engine_main/app_main/bundle_economy gelöscht; hier wird nur noch der
     Rest alter Spielstände geleert.
   • Ausgleich nur für den eigenen Verein: Trikotsponsor +8 Mio im Jahr (Basis Bundesliga 16,8 → 24,8 Mio, nach dem
     Faktor 1,4 aus bundle_match.js; Solide ≈ 28,5, Ausgewogen ≈ 24,8, Ambitioniert ≈ 20,3 Mio). Die KI-Vereine hatten nie
     einen Saison-Sponsor und bleiben unverändert.
   • Ein Fenster für Trikot, Ärmel und Stadionname (drei Schritte, nur freie Plätze): kommt einmal je Saison, sobald im
     Office nichts anderes offen ist (nach Einführung, Rückblick, Draft) und nicht während „Simulieren bis …“.
     „Stab entscheidet“ nimmt das solide Angebot. Kein „Namen behalten“: der Saisonplan zahlt für einen freien
     Stadionplatz ohnehin die Schätzung (bundle_economy.js), das wäre Geld ohne Vertrag.
   API: DFLSponsoren = { offen(), freiePlaetze(), oeffnen(), PLUS_TRIKOT }
   ===================================================================== */
(function () {
  'use strict';
  const PLUS_TRIKOT = 8000000;
  const TITEL = { shirt: 'Trikotsponsor', sleeve: 'Ärmelsponsor', stadium: 'Stadionname' };
  const dfl = () => typeof CLUB !== 'undefined' && CLUB && CLUB.dfl && CLUB.dfl.aktiv;
  const saison = () => (typeof LEAGUE !== 'undefined' && LEAGUE ? LEAGUE.season : 0);

  // ── Ausgleich: Trikotsponsor ───────────────────────────────────────────────
  try { if (typeof TIER_SPONSOR_BASE !== 'undefined') TIER_SPONSOR_BASE.bundesliga.shirt += PLUS_TRIKOT; } catch (e) { /* ohne Engine */ }

  // ── Saison-Sponsor raus ────────────────────────────────────────────────────
  function klauselLeeren() {
    try {
      const e = CLUB && CLUB.expectations;
      if (!e) return;
      e.pendingSponsorOffers = null;
      e.sponsorClauseId = null;
    } catch (err) { /* ohne Spielstand */ }
  }

  // ── Fenster Trikot · Ärmel · Stadion ──────────────────────────────────────
  function angebote() {
    try { if (!CLUB.sponsorOffers && typeof refreshSponsorOffers === 'function') refreshSponsorOffers(); } catch (e) { /* ohne Liga */ }
    return CLUB.sponsorOffers || {};
  }
  function freiePlaetze() {
    if (!dfl() || !CLUB.sponsors) return [];
    const a = angebote();
    return ['shirt', 'sleeve', 'stadium'].filter(t => !CLUB.sponsors[t] && a[t] && a[t].length);
  }
  const sichtbar = el => !!el && el.isConnected && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden' && el.offsetWidth > 0;
  // Liegt schon ein Fenster, ein Blatt oder das Spiel offen? (wie der Nutzer-Test: großflächig und fest)
  function andereOffen() {
    const frei = /^(app-cta|app-nav|app-hinweis|toast-host|app-kopf)$/;
    if ([...document.querySelectorAll('#app-sheet.auf, #app-blatt.auf')].some(sichtbar)) return true;   // Mehr und Blätter öffnen mit .auf (bis 2026-10-14 .offen geprüft)
    return [...document.body.children].some(e => !frei.test(e.id) && !/^app-(sheet|blatt)$/.test(e.id) && e.offsetWidth > 200 && e.offsetHeight > 200
      && getComputedStyle(e).position === 'fixed' && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden'
      && getComputedStyle(e).pointerEvents !== 'none');
  }
  function farben() {
    let f = null;
    try { f = window.DFLSpiel ? DFLSpiel.franchise('fcm') : null; } catch (e) { f = null; }
    return { a: (f && f.farben && f.farben[0]) || '#1d9053', b: (f && f.farben && f.farben[1]) || '#ffffff', name: (f && f.name) || (CLUB && CLUB.name) || '' };
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  // Nutzer 2026-10-14: „dass auch alle wirklich aufs bild passen … das wappen auf trikot und der austatter ist dann kickdraft in klein
  // wo normalerweise nike oder adidas wären“. Text wird nie breiter als sein Feld: Schriftgröße nach Länge, bei langen Namen zwei
  // Zeilen, als letzte Sicherung textLength. Breite je Zeichen (Fredoka fett, Großbuchstaben) grob 0,74 der Schriftgröße (mit Luft).
  // Schriftfarbe: Vereinsfarbe, wenn sie sich genug abhebt, sonst Weiß oder Fast-Schwarz (zwei dunkle Vereinsfarben).
  const BREITE = 0.74;
  const lum = h => {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(h || '').trim()); if (!m) return 0.5;
    return [0, 2, 4].map(i => parseInt(m[1].substr(i, 2), 16) / 255).map(c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
      .reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0);
  };
  const kontrast = (x, y) => { const a = lum(x), b = lum(y); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
  const schrift = (grund, wunsch) => kontrast(wunsch, grund) >= 3 ? wunsch : (kontrast('#ffffff', grund) >= kontrast('#1b1b1b', grund) ? '#ffffff' : '#1b1b1b');
  function passText(text, x, y, feldB, feldH, gross, farbe) {
    const t = String(text || '').toUpperCase().trim();
    const eine = Math.min(gross, feldB / Math.max(1, t.length * BREITE), feldH * 0.62);
    let zeilen = [t];
    if (eine < gross * 0.72 && t.indexOf(' ') > 0) {                 // lang und teilbar: zwei Zeilen, möglichst gleich lang
      const w = t.split(/\s+/);
      let best = null;
      for (let i = 1; i < w.length; i++) {
        const z = [w.slice(0, i).join(' '), w.slice(i).join(' ')], l = Math.max(z[0].length, z[1].length);
        if (!best || l < best.l) best = { z, l };
      }
      const zwei = Math.min(gross, feldB / Math.max(1, best.l * BREITE), feldH * 0.36);
      if (zwei > eine) zeilen = best.z;
    }
    const fs = zeilen.length === 2 ? Math.min(gross, feldB / Math.max(1, Math.max(zeilen[0].length, zeilen[1].length) * BREITE), feldH * 0.36)
      : eine;
    const r = v => Math.round(v * 10) / 10;
    return zeilen.map((z, i) => {
      const yy = zeilen.length === 2 ? y + (i === 0 ? -fs * 0.18 : fs * 1.02) : y + fs * 0.36;
      const lang = z.length * BREITE * fs > feldB ? ` textLength="${r(feldB)}" lengthAdjust="spacingAndGlyphs"` : '';
      return `<text x="${x}" y="${r(yy)}" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="${r(fs)}"${lang} fill="${farbe}">${esc(z)}</text>`;
    }).join('');
  }
  function brustWappen(x, y, b) {
    let svg = '';
    try {
      const f = window.DFLSpiel && DFLSpiel.franchise ? DFLSpiel.franchise('fcm') : null;
      if (f && window.DFLIdentitaet) svg = DFLIdentitaet.wappenSvg(f) || '';
    } catch (e) { svg = ''; }
    if (!svg) return '';
    return svg.replace(/^<svg\b([^>]*)>/, (m, at) => `<svg${at.replace(/\s(width|height|x|y)="[^"]*"/g, '')} x="${x}" y="${y}" width="${b}" height="${Math.round(b * 1.08)}">`);
  }
  function trikot(F, brust, aermel) {
    // Trikots v1 (kickstil_trikots.js): Heimtrikot des Vereins mit Muster, Sponsor passt immer
    if (window.KSTrikot) {
      let w = ''; try { const f = window.DFLSpiel && DFLSpiel.franchise ? DFLSpiel.franchise('fcm') : null; if (f && window.DFLIdentitaet) w = DFLIdentitaet.wappenSvg(f) || ''; } catch (e) { w = ''; }
      return KSTrikot.svg(KSTrikot.ausstattung({ farben: [F.a, F.b] }).heim, { sponsor: brust, aermel, wappen: w, breite: 150, klasse: 'spo-bild-svg spo-trikot', label: 'Trikot mit ' + brust });
    }
    return `<svg viewBox="0 0 200 140" class="spo-bild-svg" role="img" aria-label="Trikot mit ${esc(brust)}">
      <path d="M70 12 L100 22 L130 12 L172 34 L160 66 L142 58 L142 132 L58 132 L58 58 L40 66 L28 34 Z" fill="${F.a}" stroke="#2b2622" stroke-width="3" stroke-linejoin="round"/>
      <path d="M86 16 Q100 30 114 16" fill="none" stroke="${F.b}" stroke-width="4"/>
      ${passText('Kickdraft', 81, 44, 24, 8, 5.5, schrift(F.a, F.b))}
      ${brustWappen(111, 34, 16)}
      <rect x="62" y="62" width="76" height="26" rx="5" fill="${F.b}"/>
      ${passText(brust, 100, 75, 68, 24, 13, schrift(F.b, F.a))}
      ${aermel ? `<g transform="rotate(22 153 44)"><rect x="142" y="38" width="22" height="12" rx="3" fill="${F.b}"/>${passText(aermel, 153, 44, 19, 11, 5.5, schrift(F.b, F.a))}</g>` : ''}
    </svg>`;
  }
  function stadion(F, name) {
    // Nutzer 2026-10-17: „beim Stadionnamen das tatsächliche Stadion sehen“ – Bild des eigenen Stadions in der aktuellen Ausbaustufe
    // (dfl_anlagen_bilder.js), darüber das Namensschild in Vereinsfarben
    if (window.DFLAnlagenBilder) {
      const lvl = (CLUB.facilities && CLUB.facilities.stadium) || 1;
      // Bild sofort, danach – wenn das Gelände bereit ist – der echte Ausschnitt aus dem Vereinsgelände
      setTimeout(() => { const v6 = window.DFLGelaende && DFLGelaende.v6; if (v6 && v6.ausschnitt) v6.ausschnitt('stadion').then(c => {
        const ziel = document.querySelector('.spo-ov .spo-stadion .anl-bild'); if (!c || !ziel) return;
        c.className = 'spo-st-echt'; c.setAttribute('role', 'img'); c.setAttribute('aria-label', 'Dein Stadion'); ziel.replaceWith(c);
      }).catch(() => {}); }, 0);
      return `<div class="spo-stadion">${DFLAnlagenBilder.bildHtml('stadium', lvl)}<span class="spo-st-schild" style="background:${F.a};color:${schrift(F.a, F.b)}">${esc(String(name).toUpperCase())}</span></div>`;
    }
    const klein = String(name).length > 18;
    return `<svg viewBox="0 0 220 140" class="spo-bild-svg" role="img" aria-label="${esc(name)}">
      <path d="M20 70 L110 30 L200 70 L110 112 Z" fill="#7cc65a" stroke="#2b2622" stroke-width="3"/>
      <path d="M50 70 L110 44 L170 70 L110 98 Z" fill="#5fb045"/>
      <path d="M20 70 L110 112 L110 128 L20 86 Z" fill="#c9cdd3" stroke="#2b2622" stroke-width="2"/>
      <path d="M110 112 L200 70 L200 86 L110 128 Z" fill="#aeb4bb" stroke="#2b2622" stroke-width="2"/>
      <rect x="30" y="6" width="160" height="22" rx="6" fill="${F.a}" stroke="#2b2622" stroke-width="2"/>
      <text x="110" y="21" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="${klein ? 9 : 11}" fill="${F.b}">${esc(String(name).toUpperCase())}</text>
    </svg>`;
  }
  const geld = v => (typeof formatEuro === 'function' ? formatEuro(v) : Math.round(v) + ' €');

  function oeffnen() {
    const plaetze = freiePlaetze();
    if (!plaetze.length || document.querySelector('.spo-ov')) return false;
    const F = farben(), ov = document.createElement('div');
    ov.className = 'spo-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Sponsoren');
    document.body.appendChild(ov);
    let schritt = 0, wahl = 0;
    const fertig = () => {
      CLUB._sponsorFensterSaison = saison();
      ov.remove();
      try { if (typeof renderClubTab === 'function') renderClubTab(); } catch (e) { /* Ansicht fehlt */ }
      try { if (typeof saveGameState === 'function') saveGameState(); } catch (e) { /* Tests */ }
    };
    const weiter = () => { schritt++; wahl = 0; if (schritt >= plaetze.length) fertig(); else male(); };
    function male() {
      const t = plaetze[schritt], liste = (CLUB.sponsorOffers && CLUB.sponsorOffers[t]) || [];
      if (!liste.length) { weiter(); return; }
      const A = liste[wahl] || liste[0];
      const brust = CLUB.sponsors.shirt ? CLUB.sponsors.shirt.name : (t === 'shirt' ? A.name : F.name);
      const bild = t === 'stadium'
        ? stadion(F, A.name + '-Arena')
        : trikot(F, brust, t === 'sleeve' ? A.name : (CLUB.sponsors.sleeve && CLUB.sponsors.sleeve.name));
      const zeile = (o, i) => `<label class="spo-angebot${i === wahl ? ' an' : ''}"><input type="radio" name="spo-wahl" value="${i}"${i === wahl ? ' checked' : ''}>
          <span class="spo-n">${esc(o.name)}</span><span class="spo-g">${geld(o.perYear)} / Jahr</span>
          <span class="spo-p">${esc(o.profileLabel || '')} · ${o.duration} Jahre</span><span class="spo-b">${o.bonuses && o.bonuses.promotion ? 'Titel +' + geld(o.bonuses.promotion) : ''}</span></label>`;
      ov.innerHTML = `<div class="spo-blatt">
        <div class="spo-schritte">${plaetze.map((_, i) => `<i class="${i <= schritt ? 'an' : ''}"></i>`).join('')}<span>${schritt + 1} von ${plaetze.length}</span></div>
        <h2 class="spo-titel">${TITEL[t]}</h2>
        <div class="spo-bild">${bild}</div>
        <div class="spo-liste">${liste.map(zeile).join('')}</div>
        <div class="spo-knoepfe"><button type="button" class="spo-knopf neben" data-spo="stab">Stab entscheidet</button>
          <button type="button" class="spo-knopf haupt" data-spo="ok">Unterschreiben</button></div></div>`;
      ov.querySelectorAll('input[name="spo-wahl"]').forEach(r => r.onchange = () => { wahl = +r.value; male(); });
      ov.querySelector('[data-spo="stab"]').onclick = () => { signSponsor(t, liste[0].id); weiter(); };
      ov.querySelector('[data-spo="ok"]').onclick = () => { signSponsor(t, (liste[wahl] || liste[0]).id); weiter(); };
    }
    male();
    return true;
  }
  function stabAlle() {
    const namen = [];
    freiePlaetze().forEach(t => { const o = (CLUB.sponsorOffers[t] || [])[0]; if (o) { signSponsor(t, o.id); namen.push(o.name); } });
    CLUB._sponsorFensterSaison = saison();
    if (namen.length && typeof showToast === 'function') showToast('Der Stab hat unterschrieben: ' + namen.join(', '));
  }
  function pruefen() {
    try {
      if (!dfl() || CLUB._sponsorFensterSaison === saison() || typeof signSponsor !== 'function') return;
      if (window.DFLSimulieren && typeof DFLSimulieren.laeuft === 'function' && DFLSimulieren.laeuft()) return;
      if (window.DFLStartDraft && DFLStartDraft.aktiv && DFLStartDraft.aktiv()) return;     // D108: erst Tag der Verträge und erster Draft
      // Erster Tag (D131): erst nach der Wahl Lite/Voll und der Tour – vorher lief die Prüfung manchmal in die Lücke vor der Wahl
      // (0,26 s nach der Vereinswahl) und unterschrieb bzw. öffnete schon, bevor der Modus feststand
      if (window.DFLTutorial && LEAGUE.season === 1 && LEAGUE.week === 1 && !(CLUB.dflTutorial && CLUB.dflTutorial.tour)) return;
      { const ms = CLUB.dflTutorial && CLUB.dflTutorial.missionen;      // … und nach den Aufträgen des Chefscouts (D159, Lücke von 0,3 s nach der Tour)
        if (ms && ms.an && !ms.introGesehen && LEAGUE.season === 1 && LEAGUE.week === 1) return; }
      if (!freiePlaetze().length) { CLUB._sponsorFensterSaison = saison(); return; }
      if (andereOffen()) return;
      // Lite (D131): der Stab unterschreibt das solide Angebot, solange Sponsoren gesperrt sind
      if (window.DFLTutorial && DFLTutorial.gesperrt('verein')) { stabAlle(); return; }
      oeffnen();
    } catch (e) { console.warn('[DFL-Sponsoren] Fenster', e); }
  }
  {
    const _orig = window.renderHomeTab;
    if (typeof _orig === 'function') {
      window.renderHomeTab = function () {
        const r = _orig.apply(this, arguments);
        setTimeout(pruefen, 600);
        return r;
      };
      try { renderHomeTab = window.renderHomeTab; } catch (e) { /* window reicht */ }
    }
  }
  setInterval(pruefen, 2000);              // nach Einführung, Rückblick oder Draft zeichnet nicht jeder Weg das Office neu

  const css = document.createElement('style');
  css.id = 'dfl-sponsoren-css';
  css.textContent = `.spo-ov{position:fixed;inset:0;z-index:9200;background:rgba(20,14,8,.45);display:flex;align-items:flex-end;justify-content:center}
.spo-blatt{background:var(--bg2,#fffdf9);color:var(--text,#2c3e50);border-top:3px solid var(--k-rand,#8b5a2b);border-radius:22px 22px 0 0;width:100%;max-width:520px;
  max-height:92vh;overflow:auto;padding:16px 16px calc(18px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;gap:12px}
.spo-schritte{display:flex;gap:6px;align-items:center;font-size:13px;color:var(--text3,#846d52)}
.spo-schritte i{width:28px;height:6px;border-radius:3px;background:var(--k-linie,#e3c99a);display:block}
.spo-schritte i.an{background:var(--k-gruen,#78bc61)}
.spo-schritte span{margin-left:auto}
.spo-titel{margin:0;font-family:var(--font-display,inherit);font-size:20px}
.spo-bild{display:grid;place-items:center;height:150px;border-radius:14px;background:var(--bg3,#f6ead2)}
.spo-bild-svg{width:230px;height:150px;max-width:100%}.spo-trikot{width:150px;height:150px}
.spo-stadion{position:relative;width:100%;height:150px;display:grid;place-items:center}
.spo-stadion .anl-bild{width:100%;height:150px}
.spo-st-echt{width:100%;height:150px;object-fit:cover;border-radius:12px}
.spo-st-schild{position:absolute;bottom:8px;left:50%;transform:translateX(-50%);max-width:92%;padding:4px 14px;border-radius:9px;border:2.5px solid #2b2622;font:700 13px/1.2 Fredoka,Rubik,sans-serif;letter-spacing:.4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 3px 0 #2b2622}
.spo-liste{display:flex;flex-direction:column;gap:8px}
.spo-angebot{cursor:pointer;border:2px solid var(--k-linie,#e3c99a);border-radius:12px;padding:10px 12px;display:grid;grid-template-columns:1fr auto;gap:2px 10px;align-items:baseline}
.spo-angebot input{position:absolute;opacity:0;pointer-events:none}
.spo-angebot.an{border-color:var(--k-gruen,#78bc61);background:color-mix(in oklab,var(--k-gruen,#78bc61) 12%,transparent)}
.spo-angebot:focus-within{outline:3px solid var(--k-blau,#4aa3df);outline-offset:2px}
.spo-n{font-weight:600}.spo-g{font-weight:700;text-align:right;font-variant-numeric:tabular-nums}
.spo-p,.spo-b{font-size:13px;color:var(--text3,#846d52)}.spo-b{text-align:right}
.spo-knoepfe{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.spo-knopf{font:inherit;font-weight:600;padding:12px;border-radius:12px;cursor:pointer;border:2px solid var(--k-rand,#8b5a2b);box-shadow:0 3px 0 var(--k-rand,#8b5a2b);background:var(--bg2,#fffdf9);color:var(--text,#2c3e50)}
.spo-knopf.haupt{background:var(--k-gruen,#78bc61);border-color:var(--k-gruen-tief,#4d8236);box-shadow:0 3px 0 var(--k-gruen-tief,#4d8236);color:var(--k-gruen-text,#10230a)}`;
  document.head.appendChild(css);

  window.DFLSponsoren = { offen: () => !!document.querySelector('.spo-ov'), freiePlaetze, oeffnen, PLUS_TRIKOT };
  // Lade-Schritt nachholen (initGame lädt den Spielstand vor den Patches): alte Klausel leeren, Angebote mit neuer Basis
  try {
    if (typeof CLUB !== 'undefined' && CLUB) {
      klauselLeeren();
      if (!CLUB._sponsorBasisD129 && CLUB.sponsorOffers && typeof refreshSponsorOffers === 'function') { refreshSponsorOffers(); }
      CLUB._sponsorBasisD129 = true;
    }
  } catch (e) { /* ohne Spielstand */ }
  console.log('[DFL-Sponsoren v1] aktiv — Saison-Sponsor raus, Trikotsponsor +8 Mio, ein Fenster für Trikot, Ärmel und Stadionname (D129)');
})();
