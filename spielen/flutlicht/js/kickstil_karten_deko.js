/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · SONDERKARTEN v2 – MOTIVE  ·  (Nutzer 2026-10-16: „die Karten noch mehr ausgestalten, wie besonders sie sind – bei
   Halloween oder Weihnachten fallen mir so viele kleine Sachen ein. Manches sieht einfach straight gleich aus.“)
   ─────────────────────────────────────────────────────────────────────────
   Jede Edition bekommt eigene Bildebenen über dem Kartengrund (kickstil_karten.js liefert Farben und Marke):
     · HINTEN (hinter Gesicht und Werten): Motiv – Mond und Friedhof, Schneehügel, Weihnachtsbaum, Sternenkranz, Globus,
       Pokal, Flammen, Herzschlag-Linie, Ranken, Zielscheibe, Edelstein-Facetten, Lorbeer, Marmor …
     · VORN (über allem, ohne Klickfläche): Rahmen und Details – Spinnennetz und Kürbisse, Eiszapfen, Schneekappe,
       Zuckerstangen-Rahmen, Lichterkette, Stechpalme, Krone, Pflaster, Rosette, Säulen …
     · TEILCHEN (CSS, nur große Karten): Fledermäuse, Schnee, Glut, Konfetti, Funkeln – aus bei prefers-reduced-motion.
   Feste Zufallswerte je Edition (keine Sprünge beim Neuzeichnen). Kartenmaß 220 × 308 (dfl_app_shell.css .fut).
   API: KSKartenDeko.html(art, p) → HTML zum Einsetzen vor .fut-gesicht (über KSKarten.markeHtml)
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const W = 220, H = 308;
  const rnd = (i, k) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
  const svg = (inhalt, kl) => `<svg class="ksd-svg ${kl}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${inhalt}</svg>`;
  const f = n => (+n).toFixed(1);

  // ── Bausteine ─────────────────────────────────────────────────────────────
  function stern(cx, cy, r, zacken, innen) {
    zacken = zacken || 5; innen = innen || 0.45;
    let d = '';
    for (let i = 0; i < zacken * 2; i++) {
      const w = -Math.PI / 2 + i * Math.PI / zacken, rr = i % 2 ? r * innen : r;
      d += (i ? 'L' : 'M') + f(cx + Math.cos(w) * rr) + ' ' + f(cy + Math.sin(w) * rr);
    }
    return d + 'Z';
  }
  const ball = (cx, cy, r, farbe) => `<g><circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff" stroke="#111" stroke-width="1"/>
    <path d="${stern(cx, cy, r * 0.42, 5, 0.8)}" fill="#111"/>
    ${[0, 1, 2, 3, 4].map(i => { const w = -Math.PI / 2 + i * 2 * Math.PI / 5; return `<line x1="${f(cx + Math.cos(w) * r * 0.42)}" y1="${f(cy + Math.sin(w) * r * 0.42)}" x2="${f(cx + Math.cos(w) * r)}" y2="${f(cy + Math.sin(w) * r)}" stroke="#111" stroke-width=".8"/>`; }).join('')}
    ${farbe ? `<circle cx="${cx}" cy="${cy}" r="${r + 2}" fill="none" stroke="${farbe}" stroke-width="1.2" opacity=".7"/>` : ''}</g>`;
  // Lorbeerzweig entlang eines Bogens (seite −1 links, +1 rechts)
  function lorbeer(cx, cy, R, seite, farbe, op) {
    let s = `<path d="M${f(cx + seite * R * Math.sin(0.15))} ${f(cy + R * Math.cos(0.15))} A${R} ${R} 0 0 ${seite > 0 ? 0 : 1} ${f(cx + seite * R * Math.sin(2.6))} ${f(cy + R * Math.cos(2.6))}" fill="none" stroke="${farbe}" stroke-width="1.6" opacity="${op}"/>`;
    for (let i = 0; i < 9; i++) {
      const w = 0.3 + i * 0.27, x = cx + seite * R * Math.sin(w), y = cy + R * Math.cos(w), rot = (seite > 0 ? -1 : 1) * (w * 57.3) + (seite > 0 ? 40 : -40);
      s += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="3.2" ry="8" transform="rotate(${f(rot)} ${f(x)} ${f(y)})" fill="${farbe}" opacity="${op}"/>`;
    }
    return s;
  }
  function blatt(x, y, gr, rot, farbe, op) {
    return `<path d="M0 0 C${gr * 0.5} ${-gr * 0.45} ${gr} ${-gr * 0.2} ${gr * 1.2} 0 C${gr} ${gr * 0.2} ${gr * 0.5} ${gr * 0.45} 0 0Z" fill="${farbe}" opacity="${op}" transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)})"/>`;
  }
  const rahmen = (farbe, op, inset, dick, rx) => `<rect x="${inset}" y="${inset}" width="${W - inset * 2}" height="${H - inset * 2}" rx="${rx == null ? 14 - inset / 2 : rx}" fill="none" stroke="${farbe}" stroke-width="${dick || 1.2}" opacity="${op}"/>`;
  const ecken = (farbe, op, l, inset) => { const i = inset || 7, L = l || 22;
    return `<path d="M${i} ${i + L}V${i}H${i + L}M${W - i - L} ${i}H${W - i}V${i + L}M${W - i} ${H - i - L}V${H - i}H${W - i - L}M${i + L} ${H - i}H${i}V${H - i - L}" fill="none" stroke="${farbe}" stroke-width="2.4" stroke-linecap="round" opacity="${op}"/>`; };
  // Schnörkel-Ecken (Ornament)
  const schnoerkel = (farbe, op) => [[0, 0, 1, 1], [W, 0, -1, 1], [W, H, -1, -1], [0, H, 1, -1]].map(([x, y, sx, sy]) =>
    `<path d="M${x + sx * 8} ${y + sy * 34} C${x + sx * 8} ${y + sy * 16} ${x + sx * 16} ${y + sy * 8} ${x + sx * 34} ${y + sy * 8} M${x + sx * 14} ${y + sy * 26} c${sx * 4} ${sy * -8} ${sx * 10} ${sy * -10} ${sx * 14} ${sy * -6} c${sx * 3} ${sy * 3} ${sx * -1} ${sy * 8} ${sx * -5} ${sy * 6}" fill="none" stroke="${farbe}" stroke-width="1.8" stroke-linecap="round" opacity="${op}"/>
     <circle cx="${x + sx * 9}" cy="${y + sy * 9}" r="2.6" fill="${farbe}" opacity="${op}"/>`).join('');
  function schneeflocke(cx, cy, r, farbe, op, dicke) {
    let s = '';
    for (let i = 0; i < 6; i++) {
      const w = i * Math.PI / 3, x2 = cx + Math.cos(w) * r, y2 = cy + Math.sin(w) * r;
      s += `<line x1="${cx}" y1="${cy}" x2="${f(x2)}" y2="${f(y2)}"/>`;
      [0.45, 0.7].forEach(t => {
        const bx = cx + Math.cos(w) * r * t, by = cy + Math.sin(w) * r * t, l = r * (t === 0.45 ? 0.28 : 0.2);
        [-1, 1].forEach(sg => { const w2 = w + sg * 0.75; s += `<line x1="${f(bx)}" y1="${f(by)}" x2="${f(bx + Math.cos(w2) * l)}" y2="${f(by + Math.sin(w2) * l)}"/>`; });
      });
    }
    return `<g stroke="${farbe}" stroke-width="${dicke || 2}" stroke-linecap="round" opacity="${op}">${s}</g>`;
  }
  function kuerbis(cx, cy, r) {
    return `<g><ellipse cx="${cx - r * 0.45}" cy="${cy}" rx="${r * 0.6}" ry="${r * 0.82}" fill="#e8681a"/><ellipse cx="${cx + r * 0.45}" cy="${cy}" rx="${r * 0.6}" ry="${r * 0.82}" fill="#e8681a"/>
      <ellipse cx="${cx}" cy="${cy}" rx="${r * 0.62}" ry="${r * 0.88}" fill="#ff8a2a"/>
      <rect x="${cx - 1.6}" y="${cy - r * 1.12}" width="3.2" height="${r * 0.4}" rx="1" fill="#3d6b1f"/>
      <path d="M${cx - r * 0.5} ${cy - r * 0.18}l${r * 0.2} ${-r * 0.26}l${r * 0.2} ${r * 0.26}Z M${cx + r * 0.1} ${cy - r * 0.18}l${r * 0.2} ${-r * 0.26}l${r * 0.2} ${r * 0.26}Z" fill="#3a1600"/>
      <path d="M${cx - r * 0.55} ${cy + r * 0.22}q${r * 0.55} ${r * 0.5} ${r * 1.1} 0l${-r * 0.18} ${r * 0.1}l${-r * 0.18} ${-r * 0.08}l${-r * 0.18} ${r * 0.1}l${-r * 0.18} ${-r * 0.08}l${-r * 0.18} ${r * 0.1}Z" fill="#3a1600"/>
      <ellipse cx="${cx}" cy="${cy + r * 0.05}" rx="${r * 0.9}" ry="${r * 0.7}" fill="#ffd27a" opacity=".18"/></g>`;
  }
  function geschenk(x, y, b, h, farbe, band) {
    return `<g><rect x="${x}" y="${y}" width="${b}" height="${h}" rx="1.5" fill="${farbe}"/><rect x="${x + b / 2 - 2}" y="${y}" width="4" height="${h}" fill="${band}"/>
      <rect x="${x}" y="${y + h * 0.35}" width="${b}" height="3.5" fill="${band}"/>
      <path d="M${x + b / 2} ${y} c-6 -7 -11 -2 0 0 c6 -7 11 -2 0 0" fill="none" stroke="${band}" stroke-width="2.2"/></g>`;
  }
  // Pokal-Silhouette
  const pokal = (cx, cy, s, farbe, op) => `<path transform="translate(${cx} ${cy}) scale(${s})" d="M-22 -30 H22 V-12 C22 6 10 16 4 18 V28 H14 V36 H-14 V28 H-4 V18 C-10 16 -22 6 -22 -12Z M22 -24 C34 -24 36 -8 24 -2 M-22 -24 C-34 -24 -36 -8 -24 -2" fill="${farbe}" stroke="${farbe}" stroke-width="3" opacity="${op}"/>`;
  const krone = (cx, cy, s, farbe, op) => `<path transform="translate(${cx} ${cy}) scale(${s})" d="M-14 6 L-16 -8 L-8 -1 L0 -11 L8 -1 L16 -8 L14 6Z" fill="${farbe}" opacity="${op}" stroke="#7a5a08" stroke-width=".8"/>
    <circle cx="${cx}" cy="${cy - 11 * s}" r="${1.8 * s}" fill="${farbe}" opacity="${op}"/>`;

  // ── Teilchen (CSS-Animation) ─────────────────────────────────────────────
  function teilchen(art, n, extra) {
    let s = '';
    for (let i = 0; i < n; i++) {
      const x = (rnd(i, art.length) * 92 + 4).toFixed(1), d = (rnd(i, 7) * 6).toFixed(2), t = (4 + rnd(i, 3) * 5).toFixed(2), g = (0.6 + rnd(i, 11) * 0.8).toFixed(2);
      const farbe = extra && extra.farben ? extra.farben[i % extra.farben.length] : '';
      s += `<i class="ksd-t ksd-t-${art}" style="--x:${x}%;--d:-${d}s;--t:${t}s;--g:${g}${farbe ? ';--f:' + farbe : ''}"></i>`;
    }
    return `<span class="ksd-teilchen" aria-hidden="true">${s}</span>`;
  }

  // ── Motive je Edition ─────────────────────────────────────────────────────
  const MOTIV = {
    totw: () => ({
      hinten: `<defs><pattern id="ksd-p-totw" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><line x1="0" y1="0" x2="0" y2="10" stroke="#e8c35a" stroke-width="1" opacity=".09"/></pattern></defs>
        <rect width="${W}" height="${H}" fill="url(#ksd-p-totw)"/>
        <text x="110" y="168" text-anchor="middle" font-family="Georgia,serif" font-weight="900" font-size="150" fill="#e8c35a" opacity=".07">XI</text>`,
      vorn: rahmen('#e8c35a', 0.55, 6, 1.2) + `<path d="${stern(18, 290, 5)} ${stern(202, 290, 5)}" fill="#e8c35a" opacity=".8"/>`
    }),
    potw: () => ({
      css: 'strahlen',
      vorn: rahmen('#f0c05a', 0.7, 5, 1.4) + rahmen('#f0c05a', 0.35, 9, 0.8),
      teilchen: teilchen('funkeln', 6)
    }),
    hattrick: () => ({
      hinten: [...Array(9)].map((_, i) => `<line x1="${f(-20 + rnd(i, 1) * 120)}" y1="${f(40 + i * 28)}" x2="${f(140 + rnd(i, 2) * 120)}" y2="${f(10 + i * 28)}" stroke="#fff" stroke-width="${f(1 + rnd(i, 4) * 2)}" opacity=".07"/>`).join('')
        + `<text x="196" y="236" text-anchor="middle" font-family="Fredoka,system-ui" font-weight="800" font-size="120" fill="#fff" opacity=".07">3</text>`,
      vorn: ball(24, 92, 8, '#ff5a4a') + ball(24, 114, 8, '#ff5a4a') + ball(24, 136, 8, '#ff5a4a'),
      teilchen: teilchen('funken', 7)
    }),
    zukunft: () => ({
      hinten: `<path d="M-10 290 C 60 250, 80 160, 230 40" fill="none" stroke="#4ff0d0" stroke-width="7" opacity=".16" stroke-linecap="round"/>
        <path d="M-10 290 C 60 250, 80 160, 230 40" fill="none" stroke="#bffff2" stroke-width="1.5" stroke-dasharray="3 7" opacity=".5"/>
        <circle cx="186" cy="132" r="13" fill="#0a5a6a" stroke="#4ff0d0" stroke-width="1.5" opacity=".75"/><ellipse cx="186" cy="132" rx="24" ry="6" fill="none" stroke="#4ff0d0" stroke-width="1.5" opacity=".6" transform="rotate(-20 186 132)"/>
        ${[...Array(14)].map((_, i) => `<circle cx="${f(rnd(i, 5) * W)}" cy="${f(rnd(i, 6) * 220)}" r="${f(0.6 + rnd(i, 8) * 1.2)}" fill="#d4fff6" opacity="${f(0.3 + rnd(i, 9) * 0.5)}"/>`).join('')}`,
      vorn: `<g fill="none" stroke="#4ff0d0" stroke-width="1.4" opacity=".7"><path d="M6 60V18q0-12 12-12h36M214 248v42q0 12-12 12h-36"/><circle cx="54" cy="6" r="2.5" fill="#4ff0d0"/><circle cx="166" cy="302" r="2.5" fill="#4ff0d0"/>
        <path d="M6 70h10v14M214 238h-10v-14"/></g>`,
      teilchen: teilchen('funkeln', 6)
    }),
    potm: () => ({
      hinten: `<g opacity=".1">${[...Array(35)].map((_, i) => `<rect x="${24 + (i % 7) * 25}" y="${58 + Math.floor(i / 7) * 22}" width="20" height="17" rx="3" fill="#fff"/>`).join('')}</g>
        <rect x="${24 + 4 * 25}" y="${58 + 2 * 22}" width="20" height="17" rx="3" fill="#ff7ac8" opacity=".55"/>
        <ellipse cx="110" cy="-10" rx="120" ry="90" fill="#ff7ac8" opacity=".14"/>`,
      vorn: ecken('#ff7ac8', 0.85, 24, 7)
    }),
    halloween: () => ({
      hinten: `<circle cx="176" cy="70" r="40" fill="#ffe6a8" opacity=".14"/><circle cx="176" cy="70" r="25" fill="#ffe6a8" opacity=".9"/>
        <circle cx="168" cy="64" r="4" fill="#e8c98a"/><circle cx="182" cy="78" r="5" fill="#e8c98a"/><circle cx="184" cy="60" r="2.5" fill="#e8c98a"/>
        <ellipse cx="60" cy="226" rx="110" ry="12" fill="#c9b6ff" opacity=".07"/>
        <path d="M0 262 Q40 246 80 258 T160 254 T220 250 V308 H0Z" fill="#0a0410" opacity=".75"/>
        <g fill="#0a0410" opacity=".9"><path d="M30 262v-20q0-9 9-9t9 9v20Z"/><path d="M150 258v-14q0-7 7-7t7 7v14Z"/><rect x="104" y="238" width="5" height="22"/><rect x="98" y="245" width="17" height="5"/></g>
        <path d="M196 262 C198 230 190 214 204 196 M200 226 C188 220 182 214 180 206 M201 214 C210 208 214 200 216 192" fill="none" stroke="#0a0410" stroke-width="4" stroke-linecap="round"/>`,
      vorn: `<g stroke="#e9dcff" stroke-width=".7" fill="none" opacity=".55">
          ${[0, 1, 2, 3, 4].map(i => { const w = -0.15 + i * 0.42; return `<line x1="0" y1="96" x2="${f(Math.cos(w) * 46)}" y2="${f(96 + Math.sin(w) * 46)}"/>`; }).join('')}
          ${[14, 26, 38].map(r => `<path d="${[0, 1, 2, 3, 4].map((i, j) => { const w = -0.15 + i * 0.42; return (j ? 'Q' + f(Math.cos(w - 0.21) * (r - 4)) + ' ' + f(96 + Math.sin(w - 0.21) * (r - 4)) + ' ' : 'M') + f(Math.cos(w) * r) + ' ' + f(96 + Math.sin(w) * r); }).join(' ')}"/>`).join('')}</g>
        <g class="ksd-spinne"><line x1="206" y1="0" x2="206" y2="128" stroke="#e9dcff" stroke-width=".7" opacity=".6"/><circle cx="206" cy="132" r="4.5" fill="#0a0410"/><circle cx="206" cy="126" r="3" fill="#0a0410"/>
          <path d="M202 130l-6 -4M202 133l-6 2M210 130l6 -4M210 133l6 2" stroke="#0a0410" stroke-width="1.2"/></g>
        ${kuerbis(24, 212, 11)}${kuerbis(196, 214, 9)}`,
      teilchen: teilchen('fledermaus', 4)
    }),
    winter: () => ({
      hinten: schneeflocke(110, 98, 70, '#ffffff', 0.25, 3) + schneeflocke(32, 210, 14, '#ffffff', 0.5, 1.4) + schneeflocke(194, 52, 12, '#ffffff', 0.45, 1.2)
        + `<path d="M0 252 Q50 232 110 246 T220 240 V308 H0Z" fill="#ffffff" opacity=".42"/><path d="M0 270 Q70 254 140 266 T220 262 V308 H0Z" fill="#eaf7ff" opacity=".5"/>`,
      vorn: `<g fill="#eaf7ff" opacity=".92">${[...Array(16)].map((_, i) => { const x = 8 + i * 13.5, l = 6 + rnd(i, 4) * 14; return `<path d="M${f(x)} 0 L${f(x + 5)} 0 L${f(x + 2.5)} ${f(l)}Z"/>`; }).join('')}</g>
        <path d="M0 0 H220 V5 Q110 9 0 5Z" fill="#ffffff" opacity=".9"/>${rahmen('#ffffff', 0.6, 5, 1)}`,
      teilchen: teilchen('schnee', 14)
    }),
    weihnachten: () => ({
      hinten: `<g transform="translate(190 118)"><path d="M0 -40 L18 -8 H10 L24 16 H14 L28 42 H-28 L-14 16 H-24 L-10 -8 H-18Z" fill="#0d4a28" stroke="#1f7a40" stroke-width="1"/>
          <rect x="-4" y="42" width="8" height="9" fill="#5a3010"/><path d="${stern(0, -44, 7)}" fill="#ffd75a"/>
          ${[[-8, -12], [7, -2], [-12, 12], [10, 22], [-4, 30], [16, 34], [-18, 36]].map(([x, y], i) => `<circle class="ksd-blink" style="--d:-${(i * 0.37).toFixed(2)}s" cx="${x}" cy="${y}" r="2.4" fill="${['#ff4a4a', '#ffd75a', '#6ad0ff', '#ff8ae0'][i % 4]}"/>`).join('')}</g>
        ${geschenk(12, 150, 20, 16, '#d6283a', '#ffd75a')}${geschenk(26, 158, 14, 10, '#2a9a4a', '#ffffff')}
        <path d="M0 266 Q60 252 120 262 T220 258 V308 H0Z" fill="#ffffff" opacity=".2"/>`,
      vorn: `<rect x="2.5" y="2.5" width="215" height="303" rx="16" fill="none" stroke="#ffffff" stroke-width="5"/>
        <rect x="2.5" y="2.5" width="215" height="303" rx="16" fill="none" stroke="#e8323a" stroke-width="5" stroke-dasharray="9 9"/>
        <path d="M0 0 H220 V7 C200 13 190 6 170 11 C150 15 140 8 120 12 C100 15 90 7 70 11 C50 15 40 8 20 12 C10 14 4 10 0 9Z" fill="#ffffff"/>
        <path d="M14 198 Q60 210 110 200 T206 198" fill="none" stroke="#2a2a2a" stroke-width="1" opacity=".7"/>
        ${[...Array(9)].map((_, i) => { const x = 22 + i * 22, y = 202 + Math.sin(i * 1.3) * 3; return `<ellipse class="ksd-blink" style="--d:-${(i * 0.29).toFixed(2)}s" cx="${x}" cy="${f(y + 4)}" rx="3" ry="4.2" fill="${['#ff4a4a', '#ffd75a', '#6ad0ff', '#7dff8a'][i % 4]}"/>`; }).join('')}
        <g transform="translate(190 46)">${blatt(0, 0, 12, 200, '#1f8a40', 1)}${blatt(0, 0, 12, 330, '#1f8a40', 1)}<circle cx="-2" cy="2" r="3" fill="#e8323a"/><circle cx="3" cy="4" r="3" fill="#e8323a"/></g>`,
      teilchen: teilchen('schnee', 12)
    }),
    'held-cl': () => ({
      hinten: `<circle cx="110" cy="96" r="78" fill="none" stroke="#dfe6f5" stroke-width=".8" opacity=".25"/>
        ${[...Array(8)].map((_, i) => { const w = -Math.PI / 2 + i * Math.PI / 4; return `<path d="${stern(110 + Math.cos(w) * 66, 96 + Math.sin(w) * 66, 9)}" fill="#ffffff" opacity=".55"/>`; }).join('')}
        <g opacity=".07" fill="#fff">${[...Array(10)].map((_, i) => `<path d="${stern(rnd(i, 3) * W, 210 + rnd(i, 4) * 90, 6 + rnd(i, 5) * 6)}"/>`).join('')}</g>`,
      vorn: ecken('#dfe6f5', 0.9, 26, 7) + `<path d="${stern(110, 300, 4)}" fill="#dfe6f5"/>`,
      teilchen: teilchen('funkeln', 6)
    }),
    'held-el': () => ({
      hinten: `<path d="M-30 260 C 40 120, 160 90, 250 150" fill="none" stroke="#ff8a1f" stroke-width="14" opacity=".2"/>
        <path d="M-30 290 C 50 160, 170 130, 250 190" fill="none" stroke="#ff8a1f" stroke-width="5" opacity=".35"/>
        ${pokal(110, 150, 2.6, '#ff8a1f', 0.08)}`,
      vorn: ecken('#ff8a1f', 0.95, 30, 6)
    }),
    'held-co': () => ({
      hinten: `<g fill="none" stroke="#3ee6b4" stroke-width="1.1" opacity=".3"><circle cx="110" cy="100" r="74"/><ellipse cx="110" cy="100" rx="30" ry="74"/><ellipse cx="110" cy="100" rx="56" ry="74"/>
        <line x1="36" y1="100" x2="184" y2="100"/><ellipse cx="110" cy="100" rx="70" ry="22"/><path d="M45 64 H175 M45 136 H175"/></g>`,
      vorn: rahmen('#3ee6b4', 0.7, 5, 1.4) + rahmen('#3ee6b4', 0.35, 10, 0.8)
    }),
    pokalheld: () => ({
      hinten: pokal(110, 140, 3.2, '#ffffff', 0.1) + `<g opacity=".14">${[0, 1, 2].map(i => `<rect x="-60" y="${30 + i * 16}" width="120" height="7" fill="#fff" transform="rotate(-45 0 0)"/>`).join('')}</g>`,
      vorn: rahmen('#ffffff', 0.85, 5, 1.6) + rahmen('#ffffff', 0.4, 9, 0.8)
    }),
    derby: () => ({
      css: 'flammen',
      hinten: `<text x="110" y="120" text-anchor="middle" font-family="Fredoka,system-ui" font-weight="900" font-size="96" fill="#ff5a1a" opacity=".09" font-style="italic">VS</text>
        <g class="ksd-flammen-g"><g transform="translate(0 308) scale(1 .6) translate(0 -308)">
          <path d="M0 308 C10 270 30 280 26 246 C46 266 50 230 62 214 C66 250 86 252 84 226 C104 248 108 270 120 238 C130 262 150 250 148 220 C170 244 172 268 186 240 C196 262 214 256 220 236 V308Z" fill="#ff3b2f" opacity=".45"/>
          <path d="M0 308 C14 284 34 290 34 268 C50 284 60 262 72 250 C78 276 98 274 98 256 C112 276 124 280 132 260 C142 280 160 270 162 252 C176 270 190 284 200 262 C206 280 216 278 220 268 V308Z" fill="#ff8a1f" opacity=".5"/>
          <path d="M0 308 C20 296 40 300 46 286 C60 298 80 290 90 280 C100 296 120 296 130 284 C144 298 166 296 176 286 C190 300 206 298 220 290 V308Z" fill="#ffd25a" opacity=".45"/></g></g>`,
      vorn: `<rect width="${W}" height="${H}" fill="url(#ksd-v-derby)"/><defs><radialGradient id="ksd-v-derby" cx="50%" cy="45%" r="70%"><stop offset="70%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity=".55"/></radialGradient></defs>`,
      teilchen: teilchen('glut', 10)
    }),
    comeback: () => ({
      hinten: `<path class="ksd-puls" d="M0 118 H50 L58 104 L66 132 L76 72 L88 150 L98 110 L106 118 H220" fill="none" stroke="#c88cff" stroke-width="2.6" stroke-linejoin="round" opacity=".7"/>
        <path d="M0 118 H50 L58 104 L66 132 L76 72 L88 150 L98 110 L106 118 H220" fill="none" stroke="#c88cff" stroke-width="9" opacity=".12"/>`,
      vorn: `<g transform="translate(24 206) scale(.8) rotate(-30)"><rect x="-18" y="-6" width="36" height="12" rx="6" fill="#f3d2b0" stroke="#c9a07a"/><rect x="-6" y="-5" width="12" height="10" fill="#e6bf98"/>
          ${[-14, -10, 10, 14].map(x => `<circle cx="${x}" cy="0" r=".9" fill="#c9a07a"/>`).join('')}</g>
        <g transform="translate(24 206) scale(.8) rotate(40)"><rect x="-18" y="-6" width="36" height="12" rx="6" fill="#f3d2b0" stroke="#c9a07a" opacity=".95"/></g>` + ecken('#c88cff', 0.7, 20, 7)
    }),
    eigengewaechs: () => ({
      hinten: `<path d="M0 308 Q30 296 60 304 T120 300 T220 304 V308Z" fill="#3a2410" opacity=".6"/>
        <path d="M110 300 C108 270 112 250 110 226" stroke="#7fdc6a" stroke-width="3" fill="none" opacity=".35"/>${blatt(110, 240, 22, 210, '#7fdc6a', 0.3)}${blatt(110, 252, 20, 330, '#7fdc6a', 0.3)}`,
      vorn: ['M6 300 C2 240 14 200 6 140 C2 110 10 90 8 66', 'M214 300 C218 240 206 200 214 140 C218 110 210 90 212 66'].map((d, k) =>
        `<path d="${d}" fill="none" stroke="#5fbf4a" stroke-width="2" opacity=".85"/>` + [0, 1, 2, 3, 4, 5].map(i => blatt(k ? 212 - (i % 2) * 3 : 8 + (i % 2) * 3, 284 - i * 38, 11, k ? (i % 2 ? 200 : 160) : (i % 2 ? -20 : 20), '#7fdc6a', 0.95)).join('')).join('')
    }),
    nationalspieler: (p) => ({
      hinten: `<text x="110" y="170" text-anchor="middle" font-size="150" opacity=".22">${(p && p.flag) || '🇩🇪'}</text>
        <g opacity=".12">${[0, 1, 2, 3].map(i => `<rect x="-40" y="${180 + i * 26}" width="320" height="11" fill="#fff" transform="rotate(-12 110 240)"/>`).join('')}</g>`,
      vorn: `<path d="${stern(96, 9, 4.5)} ${stern(110, 7, 5.5)} ${stern(124, 9, 4.5)}" fill="#ffd75a"/>` + rahmen('#ffffff', 0.7, 5, 1.2)
    }),
    torjaeger: () => ({
      hinten: `<g fill="none" stroke="#f0c05a" opacity=".22"><circle cx="110" cy="92" r="34" stroke-width="2"/><circle cx="110" cy="92" r="56" stroke-width="2"/><circle cx="110" cy="92" r="78" stroke-width="2"/></g>
        <defs><pattern id="ksd-p-netz" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M0 0 L12 12 M12 0 L0 12" stroke="#fff" stroke-width=".7" opacity=".12"/></pattern></defs>
        <rect x="0" y="222" width="${W}" height="86" fill="url(#ksd-p-netz)"/>`,
      vorn: ball(26, 88, 9, '#f0c05a') + ecken('#f0c05a', 0.8, 20, 7)
    }),
    talent: () => ({
      hinten: [...Array(16)].map((_, i) => { const x = (i % 4) * 55, y = Math.floor(i / 4) * 77; return `<path d="M${x} ${y} L${x + 55} ${y + 30} L${x + 20} ${y + 77}Z" fill="#9df06a" opacity="${f(0.03 + rnd(i, 2) * 0.09)}"/>`; }).join('')
        + `<path d="M110 26 L160 70 L110 168 L60 70Z M60 70 H160 M85 70 L110 168 L135 70 M85 70 L110 26 L135 70" fill="none" stroke="#c9ffb0" stroke-width="1.4" opacity=".28"/>`,
      vorn: rahmen('#9df06a', 0.6, 5, 1.2),
      teilchen: teilchen('funkeln', 7)
    }),
    sds: () => ({
      css: 'holo',
      hinten: `<g opacity=".18">${[...Array(18)].map((_, i) => { const w = i * Math.PI / 9; return `<line x1="110" y1="92" x2="${f(110 + Math.cos(w) * 220)}" y2="${f(92 + Math.sin(w) * 220)}" stroke="#ffe9a0" stroke-width="${i % 2 ? 2 : 5}"/>`; }).join('')}</g>`,
      vorn: rahmen('#ffd75a', 0.95, 5, 1.6) + rahmen('#ffd75a', 0.45, 9, 0.8) + schnoerkel('#ffd75a', 0.95),
      teilchen: teilchen('funkeln', 8)
    }),
    aufstieg: () => ({
      css: 'pfeile',
      hinten: `<defs><pattern id="ksd-p-auf" width="44" height="30" patternUnits="userSpaceOnUse"><path d="M8 22 L22 10 L36 22" fill="none" stroke="#7fe0a0" stroke-width="4" stroke-linecap="round" opacity=".14"/></pattern></defs>
        <rect class="ksd-auf-bahn" x="0" y="0" width="${W}" height="${H + 60}" fill="url(#ksd-p-auf)"/>`,
      vorn: `<path d="M6 300 V230 M214 300 V230" stroke="#7fe0a0" stroke-width="2"/><path d="M0 238 L6 228 L12 238 M208 238 L214 228 L220 238" fill="#7fe0a0"/>` + ecken('#7fe0a0', 0.7, 20, 7)
    }),
    pokalsieger: () => ({
      hinten: `<ellipse cx="110" cy="96" rx="96" ry="96" fill="#ffffff" opacity=".25"/>` + pokal(110, 150, 3.4, '#6a7484', 0.16),
      vorn: `<g transform="translate(22 203) scale(.75)"><path d="M-6 6 L-12 30 L-4 25 L0 33 L4 6Z M6 6 L12 30 L4 25 L0 33" fill="#b8141c"/>
          <circle r="12" fill="#e8323a" stroke="#ffffff" stroke-width="2.5"/><circle r="6" fill="#ffffff"/><path d="${stern(0, 0, 4.5)}" fill="#e8323a"/></g>` + rahmen('#ffffff', 0.9, 5, 1.6),
      teilchen: teilchen('konfetti', 12, { farben: ['#e8323a', '#ffffff', '#ffd75a', '#2c7cb5'] })
    }),
    meister: () => ({
      hinten: lorbeer(110, 92, 70, -1, '#8a6a10', 0.4) + lorbeer(110, 92, 70, 1, '#8a6a10', 0.4) + `<ellipse cx="110" cy="92" rx="80" ry="80" fill="#fff6c8" opacity=".25"/>`,
      vorn: krone(110, 15, 1.05, '#ffd75a', 1) + rahmen('#9a7612', 0.8, 5, 1.6) + rahmen('#fff1b8', 0.7, 8, 0.8) + schnoerkel('#9a7612', 0.8),
      teilchen: teilchen('konfetti', 10, { farben: ['#ffd75a', '#fff1b8', '#c9a227'] })
    }),
    ikone: () => ({
      hinten: `<g fill="none" stroke="#b9a070" stroke-linecap="round" opacity=".3">
          <path d="M-10 40 C40 60 60 30 110 70 S180 60 230 100" stroke-width="1.2"/><path d="M-10 150 C30 130 80 170 120 140 S200 150 230 120" stroke-width=".8"/>
          <path d="M-10 230 C50 210 90 250 140 220 S200 240 230 210" stroke-width="1.4"/><path d="M60 0 C70 40 50 60 70 100" stroke-width=".7"/></g>`
        + `<g fill="#d8c28a" opacity=".45"><rect x="3" y="62" width="13" height="246"/><rect x="204" y="62" width="13" height="246"/><rect x="0" y="56" width="19" height="7"/><rect x="201" y="56" width="19" height="7"/></g>
          <g stroke="#b9a070" stroke-width=".8" opacity=".5">${[6, 9.5, 13].map(x => `<line x1="${x}" y1="66" x2="${x}" y2="300"/><line x1="${W - x}" y1="66" x2="${W - x}" y2="300"/>`).join('')}</g>`
        + lorbeer(110, 92, 70, -1, '#a8884a', 0.35) + lorbeer(110, 92, 70, 1, '#a8884a', 0.35),
      vorn: rahmen('#a8884a', 0.9, 4, 1.8) + rahmen('#d8c28a', 0.8, 8, 0.8) + schnoerkel('#a8884a', 0.9)
    })
  };

  function html(art, p) {
    const m = MOTIV[art]; if (!m) return '';
    let o; try { o = m(p) || {}; } catch (e) { return ''; }
    return (o.css ? `<span class="ksd-ebene ksd-${o.css}" aria-hidden="true"></span>` : '')
      + (o.hinten ? `<span class="ksd-hinten">${svg(o.hinten, 'ksd-h')}</span>` : '')
      + (o.vorn ? `<span class="ksd-vorn">${svg(o.vorn, 'ksd-v')}</span>` : '')
      + (o.teilchen || '');
  }

  const css = document.createElement('style');
  css.textContent = `
.fut.ed>.fut-gesicht,.fut.ed>.fut-name,.fut.ed>.fut-werte{position:absolute;z-index:1}
.fut.ed>.fut-wert,.fut.ed>.fut-pos,.fut.ed>.fut-ed-marke{z-index:4}
.ksd-hinten,.ksd-vorn,.ksd-ebene,.ksd-teilchen{position:absolute;inset:0;pointer-events:none;border-radius:inherit;overflow:hidden}
.ksd-hinten,.ksd-ebene{z-index:0}.ksd-vorn{z-index:3}.ksd-teilchen{z-index:1}
.fut.ed-derby .fut-werte,.fut.ed-halloween .fut-werte,.fut.ed-weihnachten .fut-werte,.fut.ed-hattrick .fut-werte{text-shadow:0 1px 3px rgb(0 0 0/.85),0 0 8px rgb(0 0 0/.5)}
.ksd-svg{position:absolute;inset:0;width:100%;height:100%;display:block}
.ksd-strahlen{inset:-60%;background:repeating-conic-gradient(from 0deg at 50% 50%,rgb(255 226 138/.13) 0 7deg,transparent 7deg 20deg);animation:ksd-dreh 60s linear infinite;border-radius:0}
@keyframes ksd-dreh{to{transform:rotate(360deg)}}
.ksd-holo{background:linear-gradient(115deg,transparent 20%,rgb(255 120 220/.18) 32%,rgb(120 220 255/.2) 40%,rgb(255 240 140/.18) 48%,transparent 60%);background-size:250% 100%;animation:ksd-holo 5s ease-in-out infinite alternate;mix-blend-mode:screen}
@keyframes ksd-holo{from{background-position:100% 0}to{background-position:0 0}}
.ksd-flammen-g{transform-origin:50% 100%;animation:ksd-flacker 1.6s ease-in-out infinite alternate}
@keyframes ksd-flacker{from{transform:scaleY(1)}to{transform:scaleY(1.06) skewX(-1deg)}}
.ksd-puls{stroke-dasharray:320;animation:ksd-puls 3s linear infinite}@keyframes ksd-puls{from{stroke-dashoffset:320}to{stroke-dashoffset:-320}}
.ksd-auf-bahn{animation:ksd-auf 3s linear infinite}@keyframes ksd-auf{from{transform:translateY(0)}to{transform:translateY(-30px)}}
.ksd-blink{animation:ksd-blink 1.8s ease-in-out infinite;animation-delay:var(--d,0s)}@keyframes ksd-blink{0%,100%{opacity:1}50%{opacity:.25}}
.ksd-spinne{animation:ksd-spinne 4s ease-in-out infinite;transform-origin:206px 0}@keyframes ksd-spinne{0%,100%{transform:translateY(0)}50%{transform:translateY(-22px)}}
.ksd-t{position:absolute;left:var(--x);top:0;display:block;animation-duration:var(--t);animation-delay:var(--d);animation-iteration-count:infinite;animation-timing-function:linear}
.ksd-t-schnee{width:calc(4px*var(--g));height:calc(4px*var(--g));border-radius:50%;background:#fff;opacity:.9;box-shadow:0 0 3px #fff;animation-name:ksd-fall}
.ksd-t-konfetti{width:5px;height:9px;background:var(--f,#ffd75a);animation-name:ksd-konfetti}
.ksd-t-glut{top:auto;bottom:0;width:calc(3px*var(--g));height:calc(3px*var(--g));border-radius:50%;background:#ffb04a;box-shadow:0 0 5px #ff6a1a;animation-name:ksd-glut}
.ksd-t-funkeln{top:calc(var(--x)*.9);width:7px;height:7px;background:#fff;clip-path:polygon(50% 0,62% 38%,100% 50%,62% 62%,50% 100%,38% 62%,0 50%,38% 38%);animation-name:ksd-funkeln;animation-timing-function:ease-in-out}
.ksd-t-funken{top:auto;bottom:40%;left:12%;width:4px;height:4px;border-radius:50%;background:#ffd25a;animation-name:ksd-funken;animation-timing-function:ease-out}
.ksd-t-fledermaus{top:calc(10% + var(--g)*14%);left:-12%;width:20px;height:9px;background:#0a0410;
  clip-path:polygon(0 20%,18% 0,30% 35%,42% 25%,50% 45%,58% 25%,70% 35%,82% 0,100% 20%,85% 60%,70% 50%,58% 100%,50% 70%,42% 100%,30% 50%,15% 60%);animation-name:ksd-flug;animation-timing-function:ease-in-out}
@keyframes ksd-fall{from{transform:translate(0,-12px)}to{transform:translate(calc(10px*var(--g)),320px)}}
@keyframes ksd-konfetti{from{transform:translate(0,-14px) rotate(0)}to{transform:translate(calc(18px*var(--g) - 9px),320px) rotate(calc(540deg*var(--g)))}}
@keyframes ksd-glut{0%{transform:translate(0,0);opacity:0}15%{opacity:1}100%{transform:translate(calc(16px*var(--g) - 8px),-200px);opacity:0}}
@keyframes ksd-funkeln{0%,100%{transform:scale(.2);opacity:0}50%{transform:scale(calc(var(--g)*1.3));opacity:1}}
@keyframes ksd-funken{0%{transform:translate(0,0);opacity:1}100%{transform:translate(calc(60px*var(--g)),calc(-50px*var(--g)));opacity:0}}
@keyframes ksd-flug{0%{transform:translate(0,0) scaleY(1)}25%{transform:translate(70px,-10px) scaleY(.4)}50%{transform:translate(140px,6px) scaleY(1)}75%{transform:translate(210px,-6px) scaleY(.4)}100%{transform:translate(280px,0) scaleY(1)}}
.ksk-mini .ksd-teilchen,.ksk-umriss .ksd-teilchen{display:none}
@media (prefers-reduced-motion:reduce){.ksd-teilchen{display:none}.ksd-strahlen,.ksd-holo,.ksd-flammen-g,.ksd-puls,.ksd-auf-bahn,.ksd-blink,.ksd-spinne{animation:none}}`;
  document.head.appendChild(css);

  window.KSKartenDeko = { html, MOTIV };
  console.log('[Kickstil-Kartenmotive v2] aktiv — ' + Object.keys(MOTIV).length + ' Editionen mit eigenen Motiven, Rahmen und Teilchen');
})();
