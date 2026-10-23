/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · TRIKOTS  ·  v1   (Nutzer 2026-10-17: „Trikots dürfen gerne schöner und ein Auswärtstrikot dürfen die Teams auch
   bekommen“, „Sponsoren müssen trotzdem drauf passen und gut aussehen“; Vorlage freigegeben: „bitte so einbauen“)
   ─────────────────────────────────────────────────────────────────────────
   Eine Datei für beide Spiele (Quelle: kickdraft/spiel/js, nach Änderung nach flutlicht_manager/js kopieren).
   Jeder Verein bekommt aus seinen Farben fest: Muster (10 Arten), Kragen, Ärmelbündchen, Seitenstreifen – und ein Auswärtstrikot
   (helle Heimfarbe → dunkel, sonst hell; ruhigeres Muster, anderer Kragen). Sponsor passt immer auf die Brust (Größe nach Länge,
   lange Namen mit Leerzeichen zweizeilig, auf unruhigem Muster mit Kontur in der Gegenfarbe).
   Eingebaut: Spielerporträts (dfl_identitaet.js fussballTrikot), Sponsorenwahl (Kickdraft dfl_sponsoren_patch.js), Ticker-Farben
   (Gast in Auswärts bei gleicher Farbe, dfl_textspiel_patch.js), Karte „Trikots“ im Verein-Reiter (beide Spiele).
   Schlüssel ist das Farbpaar (Aufrufer übergeben oft nur { farben }) – gleiche Farben, gleiches Trikot.
   API: KSTrikot.ausstattung(team) · .svg(kit, opt) · .portraet(kit, art) · .gastKit(heim, gast) · .MUSTER
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const W = window;
  const K = '#1c140c';
  const MUSTER = ['einfarbig', 'streifen', 'ringel', 'schaerpe', 'haelften', 'brust', 'nadel', 'winkel', 'verlauf', 'schulter'];
  const MUSTER_NAME = { einfarbig: 'Einfarbig', streifen: 'Streifen', ringel: 'Ringel', schaerpe: 'Schärpe', haelften: 'Hälften', brust: 'Brustring', nadel: 'Nadelstreifen', winkel: 'Winkel', verlauf: 'Verlauf', schulter: 'Schulter' };
  const RUHIG = ['einfarbig', 'schulter', 'brust', 'nadel', 'verlauf'];
  const UNRUHIG = ['streifen', 'nadel', 'schaerpe', 'haelften', 'ringel', 'winkel', 'verlauf'];
  const KRAGEN = ['rund', 'v', 'polo'];
  const ok = h => /^#[0-9a-f]{6}$/i.test(String(h || ''));
  const hell = h => { const n = parseInt(h.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
  const misch = (h, z, t) => { const a = parseInt(h.slice(1), 16), b = parseInt(z.slice(1), 16); const c = s => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t); return '#' + ((1 << 24) + (c(16) << 16) + (c(8) << 8) + c(0)).toString(16).slice(1); };
  const abstand = (x, y) => { const a = parseInt(x.slice(1), 16), b = parseInt(y.slice(1), 16); return Math.hypot((a >> 16) - (b >> 16), ((a >> 8) & 255) - ((b >> 8) & 255), (a & 255) - (b & 255)); };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  // ── Ausstattung je Verein ─────────────────────────────────────────────────
  const CACHE = new Map();
  function ausstattung(team) {
    const f = (team && (team.farben || team.colors)) || [];
    const a = ok(f[0]) ? f[0].toLowerCase() : '#3a4250', b = ok(f[1]) ? f[1].toLowerCase() : '#ffffff';
    const key = a + b;
    if (CACHE.has(key)) return CACHE.get(key);
    const h = hash(key), muster = MUSTER[h % MUSTER.length], kragen = KRAGEN[(h >>> 8) % 3];
    // Bündchen: bei großflächigen Mustern dunkle Variante der Hauptfarbe, sonst Zweitfarbe
    const c = ['streifen', 'schaerpe', 'haelften', 'ringel'].indexOf(muster) >= 0 ? misch(a, '#000000', 0.45) : b;
    const heim = { a, b, c, muster, kragen };
    // Auswärts: dunkle Heimfarbe → helles Trikot mit Heimfarbe als Akzent; helle → dunkel (Zweitfarbe, wenn dunkel, sonst Nachtblau)
    const dunkel = hell(a) < 0.55;
    const ruhig = RUHIG.filter(m => m !== muster), mA = ruhig[(h >>> 12) % ruhig.length];
    const aus = dunkel
      ? { a: '#f4f1ea', b: a, c: a, muster: mA, kragen: KRAGEN[((h >>> 8) % 3 + 1) % 3] }
      : { a: hell(b) < 0.35 ? misch(b, '#000000', 0.2) : '#1d2433', b: a, c: a, muster: mA, kragen: KRAGEN[((h >>> 8) % 3 + 1) % 3] };
    const r = { heim, aus };
    CACHE.set(key, r);
    return r;
  }
  // Gast trägt Auswärts, wenn die Hauptfarben zu ähnlich sind
  function gastKit(heim, gast) {
    const H = ausstattung(heim).heim, G = ausstattung(gast);
    return abstand(H.a, G.heim.a) < 70 ? Object.assign({ auswaerts: true }, G.aus) : Object.assign({ auswaerts: false }, G.heim);
  }

  // ── Muster als SVG (Trikot-Raum 200 × 210) ────────────────────────────────
  function musterSvg(kit, idv) {
    const { b, muster } = kit;
    let m = '';
    if (muster === 'streifen') for (let x = 58; x < 150; x += 24) m += `<rect x="${x}" y="0" width="12" height="210" fill="${b}"/>`;
    if (muster === 'ringel') for (let y = 66; y < 210; y += 30) m += `<rect x="0" y="${y}" width="200" height="15" fill="${b}"/>`;
    if (muster === 'schaerpe') m += `<path d="M30 30 L70 18 L190 180 L150 210 Z" fill="${b}"/>`;
    if (muster === 'haelften') m += `<rect x="100" y="0" width="100" height="210" fill="${b}"/>`;
    if (muster === 'brust') m += `<rect x="0" y="62" width="200" height="34" fill="${b}"/>`;
    if (muster === 'nadel') for (let x = 56; x < 150; x += 10) m += `<rect x="${x}" y="0" width="2" height="210" fill="${b}" opacity=".5"/>`;
    if (muster === 'winkel') m += `<path d="M0 60 L100 112 L200 60 L200 86 L100 138 L0 86 Z" fill="${b}"/>`;
    if (muster === 'verlauf') m += `<rect x="0" y="0" width="200" height="210" fill="url(#${idv})"/>`;
    if (muster === 'schulter') m += `<path d="M0 0 H200 V60 Q100 88 0 60 Z" fill="${b}"/>`;
    return m;
  }
  // Sponsor: passt in die Brustfläche; lange Namen mit Leerzeichen zweizeilig, auf Muster mit Kontur
  function sponsorText(t, y, f, r, kontur) {
    t = String(t || '').toUpperCase().trim();
    if (!t) return '';
    const wort = t.split(/\s+/);
    let zeilen = [t];
    if (t.length > 11 && wort.length > 1) {
      let best = null;
      for (let i = 1; i < wort.length; i++) { const l = [wort.slice(0, i).join(' '), wort.slice(i).join(' ')], m = Math.max(l[0].length, l[1].length); if (!best || m < best.m) best = { l, m }; }
      zeilen = best.l;
    }
    const lang = Math.max(...zeilen.map(z => z.length)), gr = Math.min(zeilen.length > 1 ? 14 : 18, (zeilen.length > 1 ? 74 : 80) / (lang * 0.74));
    const st = kontur ? ` stroke="${r}" stroke-width="${Math.max(2.5, gr * 0.24).toFixed(1)}" paint-order="stroke" stroke-linejoin="round"` : '';
    const y0 = y - (zeilen.length - 1) * gr * 0.55;
    return zeilen.map((z, i) => `<text x="100" y="${(y0 + i * gr * 1.08).toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-family="Fredoka, Rubik, sans-serif" font-weight="700" font-size="${gr.toFixed(1)}" letter-spacing=".3" fill="${f}"${st}>${esc(z)}</text>`).join('');
  }
  const hersteller = () => { try { return W.DFLSpiel && CLUB.dfl && CLUB.dfl.aktiv ? 'KICKDRAFT' : 'FLUTLICHT'; } catch (e) { return 'KICKSTIL'; } };
  let uid = 0;
  // Trikot von vorn. opt: sponsor, aermel, wappen (SVG-String), breite, klasse, label
  function svg(kit, opt) {
    opt = opt || {};
    const id = 'kt' + (++uid), { a, b, c, muster, kragen } = kit;
    const rumpf = 'M64 18 L44 26 L8 52 L24 96 L48 86 L50 196 Q100 204 150 196 L152 86 L176 96 L192 52 L156 26 L136 18 Q100 40 64 18 Z';
    let hals;
    if (kragen === 'v') hals = `<path d="M78 20 L100 50 L122 20" fill="none" stroke="${c}" stroke-width="7" stroke-linejoin="round"/><path d="M78 20 L100 50 L122 20" fill="none" stroke="${K}" stroke-width="2" opacity=".5"/>`;
    else if (kragen === 'polo') hals = `<path d="M70 16 L100 30 L86 46 Z M130 16 L100 30 L114 46 Z" fill="${c}" stroke="${K}" stroke-width="2.5" stroke-linejoin="round"/><path d="M96 30 h8 v24 h-8z" fill="${misch(a, '#000000', 0.12)}"/><circle cx="100" cy="38" r="2" fill="${c}"/><circle cx="100" cy="48" r="2" fill="${c}"/>`;
    else hals = `<path d="M66 19 Q100 44 134 19" fill="none" stroke="${c}" stroke-width="8"/><path d="M66 19 Q100 44 134 19" fill="none" stroke="${K}" stroke-width="2" opacity=".45"/>`;
    const schrift = hell(a) > 0.6 ? K : '#ffffff', rand = schrift === K ? '#ffffff' : K, unruhig = UNRUHIG.indexOf(muster) >= 0;
    const wb = muster === 'haelften' ? a : b, wa = muster === 'haelften' ? b : a;
    const wappen = opt.wappen
      ? opt.wappen.replace(/^<svg\b([^>]*)>/, (m0, at) => `<svg${at.replace(/\s(width|height|x|y)="[^"]*"/g, '')} x="117" y="54" width="20" height="22">`)
      : `<g transform="translate(118 58)"><path d="M0 0 h18 v10 q0 10 -9 14 q-9 -4 -9 -14z" fill="${wb}" stroke="${K}" stroke-width="1.6"/><path d="M4 4 h10 v6 q0 6 -5 9 q-5 -3 -5 -9z" fill="${wa}"/></g>`;
    const aermel = opt.aermel ? (() => {
      const t = String(opt.aermel).toUpperCase(), gr = Math.min(6, 26 / Math.max(1, t.length * 0.62));
      return `<g transform="rotate(-62 178 66)"><rect x="163" y="60" width="30" height="12" rx="2.5" fill="${hell(a) > 0.6 ? K : '#ffffff'}" opacity=".92"/><text x="178" y="66.5" text-anchor="middle" dominant-baseline="middle" font-family="Fredoka, Rubik, sans-serif" font-weight="700" font-size="${gr.toFixed(1)}" fill="${hell(a) > 0.6 ? '#ffffff' : K}">${esc(t)}</text></g>`;
    })() : '';
    const w = opt.breite || 180;
    return `<svg viewBox="0 0 200 210" width="${w}" height="${Math.round(w * 1.05)}"${opt.klasse ? ` class="${opt.klasse}"` : ''} role="img" aria-label="${esc(opt.label || 'Trikot')}">
  <defs><clipPath id="${id}c"><path d="${rumpf}"/></clipPath>
   <linearGradient id="${id}g" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".18"/><stop offset=".25" stop-color="#fff" stop-opacity=".10"/><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient>
   <linearGradient id="${id}v" x1="0" y1="0" x2="0" y2="1"><stop offset=".2" stop-color="${b}" stop-opacity="0"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
  <ellipse cx="100" cy="204" rx="70" ry="5" fill="#000" opacity=".15"/>
  <g clip-path="url(#${id}c)"><rect width="200" height="210" fill="${a}"/>${musterSvg(kit, id + 'v')}
   <path d="M50 86 L50 200 L60 200 L60 86 Z M150 86 L150 200 L140 200 L140 86 Z" fill="${c}" opacity=".9"/>
   <path d="M8 52 L24 96 L32 93 L16 49 Z M192 52 L176 96 L168 93 L184 49 Z" fill="${c}"/>
   <rect width="200" height="210" fill="url(#${id}g)"/>
   <path d="M60 110 Q100 120 140 110" fill="none" stroke="#000" stroke-opacity=".07" stroke-width="10"/></g>
  <path d="${rumpf}" fill="none" stroke="${K}" stroke-width="3.5" stroke-linejoin="round"/>
  <path d="M48 86 L44 26 M152 86 L156 26" fill="none" stroke="${K}" stroke-width="1.6" opacity=".35"/>
  ${hals}${wappen}${aermel}
  <text x="80" y="70" text-anchor="middle" font-family="Fredoka, Rubik, sans-serif" font-weight="700" font-size="7" fill="${schrift}" stroke="${rand}" stroke-width="2.4" paint-order="stroke" stroke-linejoin="round">${hersteller()}</text>
  ${sponsorText(opt.sponsor, muster === 'winkel' ? 156 : muster === 'brust' ? 124 : 112, schrift, rand, unruhig)}
</svg>`;
  }

  // ── Porträt: Ersatz für das facesjs-Hemd (Raum 400 × 600, Schultern ab y ≈ 498) ──────────────
  // Muster wie vorn, auf die Schulterpartie gestreckt; IDs mit Platzhalter KSTID (dfl_identitaet.js setzt je Einsatz eine eigene)
  function portraet(kit, art) {
    const { a, b, c } = kit, k = '#000';
    const rumpf = 'M-5 610c0-45 10-70 60-82l85-30h120l85 30c50 12 60 37 60 82z';
    const naht = `<path fill="none" stroke="${k}" stroke-width="3" opacity=".55" d="M70 600c5-30 0-50-10-68M330 600c-5-30 0-50 10-68"/>`;
    let hals;
    if ((art || kit.kragen) === 'v') hals = `<path fill="${c}" stroke="${k}" stroke-width="5" d="M140 498l60 62 60-62h-16l-44 44-44-44z"/>`;
    else if ((art || kit.kragen) === 'polo') hals = `<path fill="${a}" stroke="${k}" stroke-width="4" d="M188 505h24v55h-24z"/><circle cx="200" cy="522" r="4" fill="${c}" stroke="${k}" stroke-width="2"/><circle cx="200" cy="544" r="4" fill="${c}" stroke="${k}" stroke-width="2"/><path fill="${c}" stroke="${k}" stroke-width="5" stroke-linejoin="round" d="M138 494l62 14-30 34zM262 494l-62 14 30 34z"/>`;
    else hals = `<path fill="none" stroke="${k}" stroke-width="20" d="M140 497c18 34 102 34 120 0"/><path fill="none" stroke="${c}" stroke-width="12" d="M140 497c18 34 102 34 120 0"/>`;
    const wb = kit.muster === 'haelften' ? a : b, wa = kit.muster === 'haelften' ? b : a;
    return `<g class="trikot"><defs><clipPath id="KSTIDc"><path d="${rumpf}"/></clipPath>` +
      `<linearGradient id="KSTIDv" x1="0" y1="0" x2="0" y2="1"><stop offset=".2" stop-color="${b}" stop-opacity="0"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>` +
      `<path fill="${a}" d="${rumpf}"/><g clip-path="url(#KSTIDc)"><g transform="translate(200 498) scale(4.1 2.2) translate(-100 -18)">${musterSvg(kit, 'KSTIDv')}</g>` +
      `<path fill="${c}" d="M-5 520l40 -14 10 30 -50 20z M405 520l-40 -14 -10 30 50 20z" opacity=".95"/></g>` +
      `<path fill="none" stroke="${k}" stroke-width="6" d="${rumpf}"/>${naht}${hals}` +
      `<g transform="translate(262 548) scale(1.6)"><path d="M0 0 h18 v10 q0 10 -9 14 q-9 -4 -9 -14z" fill="${wb}" stroke="${k}" stroke-width="2"/><path d="M4 4 h10 v6 q0 6 -5 9 q-5 -3 -5 -9z" fill="${wa}"/></g></g>`;
  }

  // ── Karte „Trikots“ im Verein-Reiter ──────────────────────────────────────
  function eigenFarben() {
    try { if (W.DFLSpiel && CLUB.dfl && CLUB.dfl.aktiv) { const f = DFLSpiel.franchise('fcm'); if (f) return f.farben; } } catch (e) { /* weiter */ }
    try { if (W.KSVerein && KSVerein.eigen) { const f = KSVerein.eigen(); if (f) return f.farben; } } catch (e) { /* weiter */ }
    try { if (typeof clubColors === 'function') return clubColors('fcm'); } catch (e) { /* weiter */ }
    return null;
  }
  function eigenWappen() {
    try { if (W.DFLSpiel && W.DFLIdentitaet && CLUB.dfl && CLUB.dfl.aktiv) return DFLIdentitaet.wappenSvg(DFLSpiel.franchise('fcm')) || ''; } catch (e) { /* ohne */ }
    try { if (W.KSVerein && KSVerein.wappen) return KSVerein.wappen('fcm') || ''; } catch (e) { /* ohne */ }
    return '';
  }
  function karteHtml() {
    const f = eigenFarben(); if (!f) return '';
    const A = ausstattung({ farben: f }), sp = (typeof CLUB !== 'undefined' && CLUB.sponsors) || {};
    const brust = sp.shirt && sp.shirt.name, arm = sp.sleeve && sp.sleeve.name, wap = eigenWappen();
    const bild = (kit, t) => `<div class="kt-tr">${svg(kit, { sponsor: brust, aermel: arm, wappen: wap, breite: 132, label: t })}<b>${t}</b><small>${esc(MUSTER_NAME[kit.muster])}</small></div>`;
    return `<section id="kt-trikots" class="kt-karte"><h3 class="kt-titel"><i class="ti ti-shirt-sport" aria-hidden="true"></i>Trikots</h3>
      <div class="kt-reihe">${bild(A.heim, 'Heim')}${bild(A.aus, 'Auswärts')}</div>
      <p class="kt-hinweis">${brust ? 'Brust: ' + esc(brust) + (arm ? ' · Ärmel: ' + esc(arm) : '') : 'Noch kein Trikotsponsor'}</p></section>`;
  }
  function karteEinsetzen() {
    if (typeof document === 'undefined') return;
    const host = document.getElementById('club-facilities'); if (!host || !host.parentNode) return;
    const alt = document.getElementById('kt-trikots'); if (alt) alt.remove();
    const html = karteHtml(); if (html) host.insertAdjacentHTML('afterend', html);
    // Kickdraft: Verein in drei Reitern – die Karte gehört zu „Geld“ und kommt erst nach der Zuordnung dazu
    if (W.DFLWege && W.DFLWege.vereinReiter) try { W.DFLWege.vereinReiter(); } catch (e) { /* ohne Reiter */ }
  }
  if (typeof W.renderClubTab === 'function') {
    const _o = W.renderClubTab;
    W.renderClubTab = function () { const r = _o.apply(this, arguments); try { karteEinsetzen(); } catch (e) { console.warn('[Trikots] Karte', e); } return r; };
    try { renderClubTab = W.renderClubTab; } catch (e) { /* window reicht */ }
  }
  if (typeof document !== 'undefined') {
    const css = document.createElement('style');
    css.textContent = `
.kt-karte{margin:14px 0;padding:14px 12px;border-radius:18px;background:var(--bg2,#fff8ea);border:3px solid var(--k-rand,#c99a62)}
.kt-titel{display:flex;align-items:center;gap:8px;margin:0 0 8px;font-size:18px;color:var(--text,#2b1a0d)}
.kt-reihe{display:flex;justify-content:space-around;gap:8px;flex-wrap:wrap}
.kt-tr{display:flex;flex-direction:column;align-items:center;text-align:center}
.kt-tr > svg{max-width:132px;height:auto}
.kt-tr b{font-size:15px;color:var(--text,#2b1a0d)}.kt-tr small{font-size:12px;color:var(--text2,#7a5a3a)}
.kt-hinweis{margin:8px 2px 0;font-size:12.5px;color:var(--text2,#7a5a3a);line-height:1.35}`;
    document.head.appendChild(css);
  }

  W.KSTrikot = { MUSTER, MUSTER_NAME, ausstattung, gastKit, svg, portraet, sponsorText, karteHtml };
  console.log('[Kickstil-Trikots v1] aktiv — Heim und Auswärts je Verein (10 Muster), Sponsor passt immer, Porträts, Ticker, Verein-Reiter');
})();
