/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · PRUNKKARTE  ·  v1   (2026-10-17, Nutzer: „so sehen die Karten aus, die komplett steil gehen“ – Vorlagen FUT Gold,
   TOTY, Ikone, WM, Geburtstag; Muster abgesegnet: „die Karten sind super“)
   ─────────────────────────────────────────────────────────────────────────
   Grundkarten (Bronze/Silber/Gold) schlicht metallisch mit eingezogenen Ecken, Sonderkarten mit Spitze, Schnörkeln und eigenem
   Motiv (Kristalle, Goldlinien, Marmor, Neon, Turniermuster, Konfetti). Schrift Big Shoulders (liegt in vendor/fonts).
   Gleiche Datei für beide Spiele (Kickdraft: Spieler/Team der Woche, Rookie-Pack; Flutlicht: Sonderkarten).
   Rookie-Pack (2026-10-18): draft1 (Erstrunden-Pick), draft2 (Zweitrunden-Pick), rookie (ab Runde 3).
   API: KSPrunk.karte({ stufe, wert, pos, positionen, gesicht, name, werte, wappen, flagge, titel, pick, pot, seed }) · .stil() · .ED
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  // form: 'kerbe' = Grundkarte mit eingezogenen Ecken oben, 'spitze' = Sonderkarte mit Spitze und Schultern
  // motiv: sterne | kristalle | marmor | muster | neon | linien | konfetti
  const ED = {
    bronze:     { form: 'kerbe',  motiv: 'sterne',    bg: ['#f6d2b0', '#c88a5a', '#9a5f34'], mk: ['#fff1e2', '#b06f40', '#6d3c18'], rahmen: ['#ffe6cc', '#b9784a', '#6a3716'], text: '#3a1d08' },
    silber:     { form: 'kerbe',  motiv: 'sterne',    bg: ['#ffffff', '#c9d1db', '#98a3b1'], mk: ['#ffffff', '#9aa6b5', '#5f6b7a'], rahmen: ['#ffffff', '#b3bdca', '#5a6576'], text: '#1c2532' },
    gold:       { form: 'kerbe',  motiv: 'sterne',    bg: ['#fbefb8', '#e2c36e', '#c49a3c'], mk: ['#fff8d6', '#c9a24a', '#8a6418'], rahmen: ['#fff6c8', '#d9b04c', '#87590c'], text: '#3b2a05' },
    sdw:        { form: 'spitze', motiv: 'kristalle', bg: ['#9b1426', '#3a040c', '#160105'], mk: ['#ff8a98', '#d0233b', '#5a0714'], rahmen: ['#fff4c4', '#e9b44c', '#8a5a12'], text: '#ffe7a6' },
    tdw:        { form: 'spitze', motiv: 'linien',    bg: ['#3a3a3a', '#141414', '#050505'], mk: ['#ffe9a0', '#d9a93a', '#7a5a14'], rahmen: ['#fff4c4', '#e0ad3e', '#7a5210'], text: '#f3d27a' },
    saison:     { form: 'spitze', motiv: 'kristalle', bg: ['#2a55d8', '#0d1f7a', '#050a33'], mk: ['#bcd2ff', '#3d6cff', '#0e1f8a'], rahmen: ['#fff4c4', '#e9b44c', '#8a5a12'], text: '#f3d27a' },
    ikone:      { form: 'spitze', motiv: 'marmor',    bg: ['#ffffff', '#ecebe7', '#cfccc4'], mk: ['#fff3c0', '#d9ad45', '#9a7420'], rahmen: ['#fff6cf', '#d8ab3f', '#86600f'], text: '#3a2c10' },
    zukunft:    { form: 'spitze', motiv: 'neon',      bg: ['#3b1670', '#160634', '#07021a'], mk: ['#7df9ff', '#ff4fd8', '#a46bff'], rahmen: ['#e9fbff', '#8ad8ff', '#5a3a9a'], text: '#e9fbff' },
    national:   { form: 'spitze', motiv: 'muster',    bg: ['#ffb347', '#f28a1a', '#c9600a'], mk: ['#ffffff', '#ffd9a0', '#c95a00'], rahmen: ['#d9fff6', '#3cc6b0', '#1a7a6a'], text: '#5a1e00' },
    abwehr:     { form: 'spitze', motiv: 'kristalle', bg: ['#3d5f8f', '#142640', '#060c18'], mk: ['#d6e8ff', '#6d9be0', '#1b3358'], rahmen: ['#ffffff', '#c9d6e6', '#5e7088'], text: '#e9f3ff' },
    diamant:    { form: 'spitze', motiv: 'kristalle', bg: ['#14806f', '#06302e', '#021412'], mk: ['#c4fff2', '#2fd6b5', '#0b4a42'], rahmen: ['#ffffff', '#c9e8e2', '#4f7a74'], text: '#eafff9' },
    jubilaeum:  { form: 'spitze', motiv: 'konfetti',  bg: ['#9b5cff', '#5a22c9', '#2a0a6a'], mk: ['#ffe14d', '#ff5fa2', '#45e0ff'], rahmen: ['#ffffff', '#d6c2ff', '#6a3ac9'], text: '#ffffff' },
    // Rookie-Pack nach dem Draft (kickstil_draftpack.js, 2026-10-18): Erstrunden-Pick, Zweitrunden-Pick, Rookie ab Runde 3
    draft1:     { form: 'spitze', motiv: 'nummer', nummer: '1', bg: ['#3a3348', '#141020', '#050309'], mk: ['#fff3c4', '#f2c14e', '#8a5a12'], rahmen: ['#fff4c4', '#e9b44c', '#8a5a12'], text: '#ffe7a6' },
    draft2:     { form: 'spitze', motiv: 'nummer', nummer: '2', bg: ['#3f74d6', '#15357a', '#061331'], mk: ['#eef4ff', '#9cc2ff', '#2a4f9a'], rahmen: ['#ffffff', '#c9d6e6', '#5e7088'], text: '#eef4ff' },
    rookie:     { form: 'kerbe',  motiv: 'feld',      bg: ['#fbf6e6', '#ebe1c2', '#cfc092'], mk: ['#ffffff', '#3f8a55', '#24583a'], rahmen: ['#eef8e6', '#4f9a5e', '#1f4f2c'], text: '#1b3a23' }
  };
  const FORM = {
    spitze: 'M24 22L84 14C96 12 102 7 110 2C118 7 124 12 136 14L196 22C206 23 212 30 212 40L212 252C212 262 207 268 198 273L120 302C113 305 107 305 100 302L22 273C13 268 8 262 8 252L8 40C8 30 14 23 24 22Z',
    kerbe: 'M32 12L188 12C190 25 199 34 212 36L212 252C212 262 207 268 198 273L120 302C113 305 107 305 100 302L22 273C13 268 8 262 8 252L8 36C21 34 30 25 32 12Z'
  };
  let zaehler = 0;
  function zufall(seed) {
    let s = seed >>> 0 || 1;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  const p2 = a => a.map(v => v.toFixed(1)).join(',');
  function kristall(x, y, w, l, b, id) {
    const c = Math.cos(w), s = Math.sin(w), nx = -s, ny = c;
    const sp = [x + c * l, y + s * l], li = [x + nx * b, y + ny * b], re = [x - nx * b, y - ny * b], mi = [x + c * l * 0.18, y + s * l * 0.18];
    return `<polygon points="${p2(li)} ${p2(sp)} ${p2(mi)}" fill="url(#${id}h)"/><polygon points="${p2(re)} ${p2(sp)} ${p2(mi)}" fill="url(#${id}d)"/>` +
      `<polyline points="${p2(li)} ${p2(sp)} ${p2(re)}" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width=".7"/>` +
      `<line x1="${mi[0].toFixed(1)}" y1="${mi[1].toFixed(1)}" x2="${sp[0].toFixed(1)}" y2="${sp[1].toFixed(1)}" stroke="#fff" stroke-opacity=".55" stroke-width=".6"/>`;
  }
  const stern4 = (x, y, r, kl, f) => `<path${kl ? ` class="${kl}" style="animation-delay:${(-(x * 7 + y) % 30 / 10).toFixed(1)}s"` : ''} d="M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z" fill="${f || '#fff'}"/>`;
  // Motive (hinter dem Gesicht)
  const MOTIV = {
    sterne(E, id, r) {                                   // Grundkarte: Sternenfeld oben, breiter Schwung diagonal
      let s = '';
      for (let y = 26; y < 120; y += 16) for (let x = 20 + (y % 32 ? 8 : 0); x < 210; x += 22) if (r() < 0.55) s += stern4(x, y, +(1.2 + r() * 1.6).toFixed(1), '', E.mk[2]);
      return `<g opacity=".35">${s}</g>
        <path d="M-10 230C60 190 120 120 240 40L240 70C130 140 70 210 -10 262Z" fill="url(#${id}h)" opacity=".55"/>
        <path d="M-10 262C70 210 130 140 240 70L240 78C132 148 72 218 -10 272Z" fill="${E.mk[0]}" opacity=".6"/>`;
    },
    kristalle(E, id, r) {
      let kr = '';
      [[30, 250, -1.15, 9], [196, 120, -2.2, 8], [150, 268, -1.6, 4], [40, 120, -0.9, 3]].forEach(([cx, cy, w0, n]) => {
        for (let i = 0; i < n; i++) kr += kristall(cx + (r() - 0.5) * 34, cy + (r() - 0.5) * 30, w0 + (r() - 0.5) * 1.3, 40 + r() * 70, 6 + r() * 9, id);
      });
      return `<g opacity=".9">${kr}</g>`;
    },
    linien(E, id, r) {                                   // Team der Woche: Goldlinien und Rauten auf Schwarz
      let s = '';
      for (let i = -6; i < 14; i++) s += `<line x1="${i * 22}" y1="0" x2="${i * 22 + 160}" y2="308" stroke="${E.mk[1]}" stroke-opacity="${(0.08 + r() * 0.18).toFixed(2)}" stroke-width="${(0.6 + r() * 1.4).toFixed(1)}"/>`;
      return s + `<path d="M150 30L206 86L150 142L94 86Z" fill="none" stroke="${E.mk[1]}" stroke-opacity=".5" stroke-width="2"/>
        <path d="M150 44L192 86L150 128L108 86Z" fill="${E.mk[1]}" fill-opacity=".1" stroke="${E.mk[0]}" stroke-opacity=".35"/>`;
    },
    marmor(E, id, r) {                                   // Ikone: weißer Marmor mit Goldadern
      let s = '';
      for (let i = 0; i < 6; i++) s += `<ellipse cx="${(r() * 220).toFixed(0)}" cy="${(r() * 300).toFixed(0)}" rx="${(30 + r() * 50).toFixed(0)}" ry="${(14 + r() * 30).toFixed(0)}" fill="#b9b4aa" opacity=".12"/>`;
      for (let i = 0; i < 9; i++) {
        let x = r() * 220, y = r() * 300, d = `M${x.toFixed(0)} ${y.toFixed(0)}`;
        for (let k = 0; k < 4; k++) { const nx = x + (r() - 0.3) * 70, ny = y + (r() - 0.5) * 70; d += `Q${((x + nx) / 2 + (r() - 0.5) * 30).toFixed(0)} ${((y + ny) / 2 + (r() - 0.5) * 30).toFixed(0)} ${nx.toFixed(0)} ${ny.toFixed(0)}`; x = nx; y = ny; }
        s += `<path d="${d}" fill="none" stroke="url(#${id}h)" stroke-width="${(0.6 + r() * 2.2).toFixed(1)}" opacity="${(0.5 + r() * 0.5).toFixed(2)}"/>`;
      }
      return s + `<path d="M120 0L240 0L240 130Z" fill="url(#${id}h)" opacity=".35"/>`;
    },
    muster(E, id, r) {                                   // Nationalspieler: geometrisches Muster wie ein Turnierdesign
      let s = '';
      for (let y = 10; y < 310; y += 26) for (let x = 100; x < 230; x += 26) {
        const t = Math.floor(r() * 4), a = (0.12 + r() * 0.3).toFixed(2), f = r() < 0.5 ? E.mk[0] : E.mk[2];
        s += t === 0 ? `<rect x="${x}" y="${y}" width="24" height="24" fill="${f}" opacity="${a}"/>`
          : t === 1 ? `<path d="M${x} ${y + 24}L${x + 24} ${y + 24}L${x + 24} ${y}Z" fill="${f}" opacity="${a}"/>`
          : t === 2 ? `<circle cx="${x + 12}" cy="${y + 12}" r="11" fill="none" stroke="${f}" stroke-width="3" opacity="${a}"/>` : '';
      }
      return `<g>${s}</g><rect width="220" height="308" fill="url(#${id}fl)"/>`;
    },
    neon(E, id, r) {                                     // Zukunftsstar: leuchtende Bahnen
      let s = '';
      for (let i = 0; i < 7; i++) {
        const y = 40 + i * 38 + r() * 10, f = E.mk[i % 3];
        s += `<path d="M-10 ${y.toFixed(0)}C60 ${(y - 30).toFixed(0)} 150 ${(y + 40).toFixed(0)} 240 ${(y - 10).toFixed(0)}" fill="none" stroke="${f}" stroke-width="${(1 + r() * 2).toFixed(1)}" opacity=".75" filter="url(#${id}gl)"/>`;
      }
      return s;
    },
    nummer(E, id, r) {                                   // Draft-Pick: Lichtkegel von oben, große Rundenzahl, Bänder unten
      let s = '';
      for (let i = 0; i < 9; i++) {
        const a = -0.95 + i * 0.24, x2 = 110 + Math.sin(a) * 430, y2 = Math.cos(a) * 430, b = 10 + r() * 12;
        s += `<path d="M110 -12L${(x2 - b).toFixed(0)} ${y2.toFixed(0)}L${(x2 + b).toFixed(0)} ${y2.toFixed(0)}Z" fill="${E.mk[1]}" opacity="${(0.05 + r() * 0.08).toFixed(2)}"/>`;
      }
      return s + `<text x="156" y="236" text-anchor="middle" font-family="Big Shoulders Display,system-ui" font-weight="900" font-size="290" fill="${E.mk[1]}" fill-opacity=".07" stroke="url(#${id}h)" stroke-width="2.2" stroke-opacity=".45">${E.nummer}</text>
        <path d="M-10 302L240 176L240 194L-10 320Z" fill="url(#${id}h)" opacity=".32"/><path d="M-10 287L240 161L240 166L-10 292Z" fill="${E.mk[0]}" opacity=".45"/>`;
    },
    feld(E, id, r) {                                     // Rookie: Kreidelinien eines Spielfelds auf hellem Grund
      let s = '';
      for (let i = 0; i < 40; i++) s += `<circle cx="${(r() * 220).toFixed(0)}" cy="${(r() * 300).toFixed(0)}" r="${(0.6 + r() * 1.2).toFixed(1)}" fill="${E.mk[1]}" opacity="${(0.08 + r() * 0.14).toFixed(2)}"/>`;
      return `<rect width="220" height="308" fill="${E.mk[1]}" opacity=".06"/>${s}
        <g fill="none" stroke="${E.mk[1]}" stroke-opacity=".3" stroke-width="2.2" stroke-linecap="round">
          <path d="M20 40L20 290M200 40L200 290"/><path d="M20 150L200 150"/><circle cx="110" cy="150" r="34"/><circle cx="110" cy="150" r="2.5" fill="${E.mk[1]}"/>
          <path d="M62 14L62 58L158 58L158 14M86 14L86 32L134 32L134 14"/><path d="M90 58A22 22 0 0 0 130 58"/></g>
        <path d="M-10 236C70 206 140 196 240 150L240 166C140 212 70 222 -10 252Z" fill="url(#${id}h)" opacity=".28"/>`;
    },
    konfetti(E, id, r) {                                 // Jubiläum: Konfetti und Luftschlangen
      let s = '';
      for (let i = 0; i < 46; i++) {
        const x = (r() * 220).toFixed(0), y = (r() * 300).toFixed(0), f = E.mk[i % 3], w = (r() * 180).toFixed(0);
        s += i % 3 ? `<rect x="${x}" y="${y}" width="7" height="3" rx="1" fill="${f}" transform="rotate(${w} ${x} ${y})" opacity=".85"/>`
          : `<circle cx="${x}" cy="${y}" r="2.2" fill="${f}" opacity=".85"/>`;
      }
      return s + `<path d="M150 20c20 10 0 30 20 40s0 30 20 40" fill="none" stroke="${E.mk[0]}" stroke-width="3" opacity=".8"/>`;
    }
  };
  function hintergrund(E, id, seed, form) {
    const r = zufall(seed), dunkel = E.form === 'spitze' && E.motiv !== 'marmor' && E.motiv !== 'muster';
    const u = E.bg[dunkel ? 2 : 0];
    let fu = '';
    if (E.motiv !== 'sterne') for (let i = 0; i < 14; i++) fu += stern4(Math.round(20 + r() * 180), Math.round(24 + r() * 250), +(1.2 + r() * 2.6).toFixed(1), 'pk-funk');
    return `<defs>
      <radialGradient id="${id}bg" cx="55%" cy="30%" r="80%"><stop offset="0" stop-color="${E.bg[0]}"/><stop offset=".55" stop-color="${E.bg[1]}"/><stop offset="1" stop-color="${E.bg[2]}"/></radialGradient>
      <linearGradient id="${id}h" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${E.mk[0]}"/><stop offset="1" stop-color="${E.mk[1]}"/></linearGradient>
      <linearGradient id="${id}d" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${E.mk[1]}"/><stop offset="1" stop-color="${E.mk[2]}"/></linearGradient>
      <linearGradient id="${id}fl" x1="0" y1="0" x2="1" y2="0"><stop offset=".3" stop-color="${E.bg[1]}"/><stop offset=".62" stop-color="${E.bg[1]}" stop-opacity="0"/></linearGradient>
      <radialGradient id="${id}l" cx="58%" cy="34%" r="45%"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
      <linearGradient id="${id}u" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${u}" stop-opacity="0"/><stop offset=".35" stop-color="${u}" stop-opacity=".6"/><stop offset="1" stop-color="${u}" stop-opacity=".85"/></linearGradient>
      <filter id="${id}gl" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <clipPath id="${id}c"><path d="${form}"/></clipPath>
    </defs>
    <g clip-path="url(#${id}c)">
      <rect width="220" height="308" fill="url(#${id}bg)"/>
      ${MOTIV[E.motiv](E, id, r)}
      <rect width="220" height="308" fill="url(#${id}l)"/>
      <rect y="186" width="220" height="122" fill="url(#${id}u)"/>
      ${fu}
    </g>`;
  }
  function rahmen(E, id, form) {
    const g = `url(#${id})`;
    const def = `<defs><linearGradient id="${id}" x1="0" y1="0" x2=".6" y2="1"><stop offset="0" stop-color="${E.rahmen[0]}"/><stop offset=".35" stop-color="${E.rahmen[1]}"/><stop offset=".55" stop-color="${E.rahmen[0]}"/><stop offset="1" stop-color="${E.rahmen[2]}"/></linearGradient></defs>`;
    const innen = `<path d="${form}" transform="translate(110 154) scale(.935 .945) translate(-110 -154)" fill="none" stroke="${g}" stroke-width="1.2" stroke-opacity=".9"/>`;
    if (E.form === 'kerbe') return def + `<path d="${form}" fill="none" stroke="#000" stroke-opacity=".25" stroke-width="4"/><path d="${form}" fill="none" stroke="${g}" stroke-width="2.6"/>` + innen;
    const sch = `<path d="M15 78C6 58 10 34 30 28C46 24 52 40 41 45C33 48 30 38 37 37" fill="none" stroke="${g}" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M58 20C66 30 80 28 84 20" fill="none" stroke="${g}" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M9 138L1 150L9 162" fill="${g}" stroke="${g}" stroke-width="1"/><circle cx="16" cy="150" r="2.2" fill="${g}"/>
      <path d="M14 244C8 258 16 268 30 270" fill="none" stroke="${g}" stroke-width="1.6" stroke-linecap="round"/>`;
    return def + `<path d="${form}" fill="none" stroke="#000" stroke-opacity=".45" stroke-width="7"/><path d="${form}" fill="none" stroke="${g}" stroke-width="4.2"/>${innen}
      ${sch}<g transform="translate(220 0) scale(-1 1)">${sch}</g>
      <path d="M110 -4L116 6L110 15L104 6Z" fill="${g}" stroke="#000" stroke-opacity=".35" stroke-width=".8"/><path d="M110 294L115 301L110 308L105 301Z" fill="${g}"/>`;
  }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // o: stufe (Edition), wert, pos, positionen, gesicht, name, werte [[k,v]×6], wappen, flagge, titel, pick, pot, seed
  function karte(o) {
    const E = ED[o.stufe] || ED.gold, id = 'pk' + (++zaehler).toString(36), form = FORM[E.form];
    const ax = o.werte || [];
    const spalte = i => ax.slice(i * 3, i * 3 + 3).map(([k, v]) => `<span><b>${esc(v)}</b><em>${esc(k)}</em></span>`).join('');
    const nebenPos = [...new Set(o.positionen || [])].filter(x => x !== o.pos).slice(0, 2);
    return `<div class="pk pk-${o.stufe} pk-${E.form}" style="--pk-text:${E.text};--pk-gold:${E.rahmen[1]}">
      <svg class="pk-grund" viewBox="0 0 220 308" aria-hidden="true">${hintergrund(E, id, o.seed || 7, form)}</svg>
      <div class="pk-gesicht">${o.gesicht || ''}</div>
      <svg class="pk-rahmen" viewBox="-4 -6 228 316" aria-hidden="true">${rahmen(E, id + 'r', form)}</svg>
      <div class="pk-links">
        <div class="pk-wert">${esc(o.wert)}</div>
        ${o.pot ? `<div class="pk-pot">(${esc(o.pot)})</div>` : ''}
        <div class="pk-pos">${esc(o.pos)}</div>
        ${nebenPos.length ? `<div class="pk-neben">${nebenPos.map(esc).join(' ')}</div>` : ''}
        <i class="pk-strich"></i>
        ${o.flagge ? `<div class="pk-flagge">${o.flagge}</div><i class="pk-strich"></i>` : ''}
        ${o.wappen ? `<div class="pk-wappen">${o.wappen}</div>` : ''}
      </div>
      <div class="pk-name">${esc(o.name)}</div>
      <div class="pk-werte"><div>${spalte(0)}</div><i></i><div>${spalte(1)}</div></div>
      ${o.titel ? `<div class="pk-titel">${esc(o.titel)}</div>` : '<i class="pk-fussstrich"></i>'}
      ${o.pick ? `<span class="pk-pick">#${esc(o.pick)}</span>` : ''}
    </div>`;
  }
  const SCHRIFT = "'Big Shoulders Display', var(--font-zahl, var(--font-display, system-ui))";
  const CSS = `
  .pk{position:relative;width:220px;height:308px;color:var(--pk-text);font-family:${SCHRIFT};filter:drop-shadow(0 14px 18px rgb(0 0 0/.4))}
  .pk svg.pk-grund{position:absolute;inset:0;width:100%;height:100%}
  .pk svg.pk-rahmen{position:absolute;left:-4px;top:-6px;width:228px;height:316px;z-index:3;pointer-events:none}
  .pk-gesicht{position:absolute;left:68px;top:18px;width:128px;height:192px;z-index:1;
    -webkit-mask-image:linear-gradient(#000 70%,transparent 96%);mask-image:linear-gradient(#000 70%,transparent 96%)}
  .pk-spitze .pk-gesicht{filter:drop-shadow(0 0 10px rgb(255 255 255/.25))}
  .pk-gesicht svg{width:100%;height:100%;display:block}
  .pk-links{position:absolute;left:20px;top:38px;width:52px;z-index:4;display:flex;flex-direction:column;align-items:center;gap:2px}
  .pk-wert{font:800 52px/.82 ${SCHRIFT};letter-spacing:-.01em}
  .pk-pot{font:700 15px/1 ${SCHRIFT};opacity:.8}
  .pk-pos{font:800 20px/1 ${SCHRIFT};letter-spacing:.03em}
  .pk-neben{font:700 11px/1.1 ${SCHRIFT};opacity:.7;text-align:center;letter-spacing:.04em}
  .pk-strich{display:block;width:30px;height:1px;margin:4px 0;background:currentColor;opacity:.4}
  .pk-flagge{font-size:22px;line-height:1}
  .pk-wappen{width:30px;height:32px}.pk-wappen svg{width:100%;height:100%;display:block}
  .pk-name{position:absolute;left:22px;right:22px;top:188px;z-index:4;text-align:center;font:800 25px/1 ${SCHRIFT};letter-spacing:.02em;text-transform:uppercase;
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:5px 0 5px;border-bottom:1px solid color-mix(in srgb,currentColor 35%,transparent)}
  .pk-werte{position:absolute;left:44px;right:44px;top:224px;z-index:4;display:grid;grid-template-columns:1fr 1px 1fr;gap:0 12px}
  .pk-werte>i{background:currentColor;opacity:.35}
  .pk-werte>div{display:flex;flex-direction:column}
  .pk-werte span{display:flex;gap:5px;align-items:baseline;justify-content:center;font-variant-numeric:tabular-nums}
  .pk-werte b{font:800 17px/1.05 ${SCHRIFT};min-width:18px;text-align:right}
  .pk-werte em{font:700 15px/1 ${SCHRIFT};font-style:normal;min-width:26px}
  .pk-titel{position:absolute;left:0;right:0;top:284px;z-index:4;text-align:center;font:800 8px/1 ${SCHRIFT};letter-spacing:.18em;text-transform:uppercase;opacity:.9}
  .pk-fussstrich{position:absolute;left:96px;right:96px;top:284px;height:1px;z-index:4;background:currentColor;opacity:.35}
  .pk-pick{position:absolute;top:2px;right:-6px;z-index:5;background:#c8463a;color:#fff;font:800 17px/1 ${SCHRIFT};padding:6px 8px 5px;border-radius:10px;border:2px solid #fff;box-shadow:0 2px 0 rgb(0 0 0/.3)}
  .pk-sdw .pk-links,.pk-diamant .pk-links,.pk-diamant .pk-name,.pk-abwehr .pk-links,.pk-abwehr .pk-name,.pk-tdw .pk-links,.pk-saison .pk-links,.pk-zukunft .pk-links,.pk-jubilaeum .pk-links,
  .pk-sdw .pk-name,.pk-tdw .pk-name,.pk-saison .pk-name,.pk-zukunft .pk-name,.pk-jubilaeum .pk-name,
  .pk-draft1 .pk-links,.pk-draft1 .pk-name,.pk-draft2 .pk-links,.pk-draft2 .pk-name{text-shadow:0 2px 0 rgb(0 0 0/.35)}
  .pk::after{content:'';position:absolute;inset:0;z-index:5;pointer-events:none;clip-path:path('${FORM.spitze}');
    background:linear-gradient(115deg,transparent 35%,rgb(255 255 255/.3) 48%,transparent 60%) -260px 0/220px 100% no-repeat;animation:pk-glanz 4.5s ease-in-out infinite}
  .pk-kerbe::after{clip-path:path('${FORM.kerbe}')}
  @keyframes pk-glanz{0%,55%{background-position:-260px 0}100%{background-position:260px 0}}
  .pk-funk{animation:pk-funk 3s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
  @keyframes pk-funk{0%,100%{opacity:.15;transform:scale(.6)}50%{opacity:1;transform:scale(1.15)}}
  @media (prefers-reduced-motion:reduce){.pk::after,.pk-funk{animation:none}}`;
  function stil() {
    if (document.getElementById('pk-stil')) return;
    const s = document.createElement('style'); s.id = 'pk-stil'; s.textContent = CSS; document.head.appendChild(s);
  }
  window.KSPrunk = { karte, stil, ED };
  console.log('[Kickstil-Prunkkarte v1] aktiv — Grund- und Sonderkarten im neuen Rahmen');
})();
