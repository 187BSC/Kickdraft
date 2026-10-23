/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · POKALVITRINE  ·  v1   (Nutzer 2026-10-17: „wir brauchen noch Pokale für die ganzen Vitrinen … für beide“,
   „die Pokale sind schön“, „Vitrine im Office wäre cool“)
   ─────────────────────────────────────────────────────────────────────────
   Eine Datei für beide Spiele (Quelle: kickdraft/spiel/js, nach Änderung nach flutlicht_manager/js kopieren). Pokale als
   3D-Renderings in app/pokale/ (Blatt: <art>.webp; Office: vit-hinten/vit-vorn + vt-<art>-<platz>.webp, gleiche Kamera, Fußpunkt
   wie das alte Laden-Bild).
     · Kickdraft: DKL-Meister, Conference Nord/Süd, Division, Spieler der Saison – aus der Weltgeschichte (DFLSpiel.liga().historie)
       und den laufenden Playoffs
     · Flutlicht: Meisterschale (Erste Liga), kleine Schale (Zweite/Dritte Liga), Flutlichtpokal, Champions Cup, Europacup,
       Kontinentalcup, Aufstieg – aus CLUB.chronicle, dem Pokal und den Europapokal-Siegen (CLUB.ksVitrine.euro, beim Saisonwechsel)
   Office: die gekaufte Vitrine (Laden) zeigt die drei wichtigsten Pokale; Antippen öffnet das Vitrinen-Blatt. Blatt auch über
   KSVitrine.oeffnen() (Mehr-Menü der Erfolge).
   API: KSVitrine.titel() · .gruppen() · .oeffnen() · .officeBild() · .ARTEN
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const W = window;
  const PFAD = 'app/pokale/';
  const ARTEN = {
    // Kickdraft
    dkl: { name: 'DKL-Meister', fach: 'Meisterschaften', rang: 1, spiel: 'kd' },
    konfNord: { name: 'Conference Nord', fach: 'Meisterschaften', rang: 2, spiel: 'kd' },
    konfSued: { name: 'Conference Süd', fach: 'Meisterschaften', rang: 2, spiel: 'kd' },
    div: { name: 'Division', fach: 'Meisterschaften', rang: 4, spiel: 'kd' },
    mvp: { name: 'Spieler der Saison', fach: 'Auszeichnungen', rang: 5, spiel: 'kd' },
    // Flutlicht
    cl: { name: 'Champions Cup', fach: 'Europa', rang: 1, spiel: 'fl' },
    el: { name: 'Europacup', fach: 'Europa', rang: 3, spiel: 'fl' },
    co: { name: 'Kontinentalcup', fach: 'Europa', rang: 4, spiel: 'fl' },
    schale: { name: 'Meisterschale', fach: 'Deutschland', rang: 2, spiel: 'fl' },
    pokal: { name: 'Flutlichtpokal', fach: 'Deutschland', rang: 3, spiel: 'fl' },
    klein: { name: 'Meister Zweite/Dritte Liga', fach: 'Deutschland', rang: 5, spiel: 'fl' },
    auf: { name: 'Aufstieg', fach: 'Deutschland', rang: 6, spiel: 'fl' }
  };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hatSpiel = () => { try { return typeof CLUB !== 'undefined' && CLUB && typeof LEAGUE !== 'undefined' && LEAGUE; } catch (e) { return false; } };
  const kickdraft = () => { try { return !!(W.DFLSpiel && CLUB.dfl && CLUB.dfl.aktiv && LEAGUE.dfl); } catch (e) { return false; } };
  const spiel = () => (kickdraft() ? 'kd' : 'fl');
  const label = s => { try { return typeof seasonYearLabel === 'function' ? seasonYearLabel(s) : String(s); } catch (e) { return String(s); } };

  // ── Titel sammeln ─────────────────────────────────────────────────────────
  function titelKickdraft() {
    const out = [];
    let L = null; try { L = DFLSpiel.liga(); } catch (e) { return out; }
    const eigen = DFLSpiel.eigeneDflId(), me = L.teams.find(t => t.id === eigen);
    const w = id => (id == null ? null : DFLSpiel.dflIdVon(id));
    const konfArt = me && me.conference === 'SUE_WEST' ? 'konfSued' : 'konfNord';
    const jahrText = j => `${j}/${String((j + 1) % 100).padStart(2, '0')}`;
    const H = (L.historie && L.historie.saisons) || [];
    H.forEach(e => {
      const jahr = jahrText(e.jahr);
      if (w(e.meister) === eigen) out.push({ art: 'dkl', jahr });
      if (w(e.meister) === eigen || w(e.finalist) === eigen) out.push({ art: konfArt, jahr });
      if (e.punkte && me) {
        const div = L.teams.filter(t => t.division === me.division);
        const pk = id => { const k = Object.keys(e.punkte).find(x => w(x) === id); return k ? e.punkte[k] : -1; };
        const best = div.reduce((a, t) => (pk(t.id) > pk(a.id) ? t : a), div[0]);
        if (best && best.id === eigen && pk(eigen) >= 0) out.push({ art: 'div', jahr });
      }
      if (e.preise && e.preise.spieler && w(e.preise.spieler.teamId) === eigen) out.push({ art: 'mvp', jahr, text: e.preise.spieler.name });
    });
    // laufende Playoffs: Titel sofort in der Vitrine (bis die Saison in die Geschichte kommt)
    const po = LEAGUE.dflPO, jetzt = jahrText(L.saisonJahr);
    if (po && po.setzliste && !H.some(e => jahrText(e.jahr) === jetzt)) {
      Object.keys(po.setzliste).forEach(k => { if ((po.setzliste[k] || []).slice(0, 4).indexOf('fcm') >= 0) out.push({ art: 'div', jahr: jetzt }); });
      if (po.meister === 'fcm') out.push({ art: 'dkl', jahr: jetzt });
      if (po.meister === 'fcm' || po.finalist === 'fcm') out.push({ art: konfArt, jahr: jetzt });
    }
    return out;
  }
  const TIER_RANG = { regionalliga: 0, liga3: 1, bundesliga2: 2, bundesliga: 3 };
  const LIGA = { bundesliga: 'Erste Liga', bundesliga2: 'Zweite Liga', liga3: 'Dritte Liga', regionalliga: 'Regionalliga' };
  function tierJetzt() { try { return findFcmGroup(LEAGUE).tierKey; } catch (e) { return null; } }
  function euroSiege() {
    const out = [];
    try { const K = CLUB.euro && CLUB.euro.knockout; if (K) Object.keys(K).forEach(k => { const ko = K[k]; if (ko && ko.winner && ko.winner.isFcm) out.push(k === 'ecl' ? 'co' : k); }); } catch (e) { /* ohne */ }
    return out.filter(k => ARTEN[k]);
  }
  function titelFlutlicht() {
    const out = [], ch = Array.isArray(CLUB.chronicle) ? CLUB.chronicle : [];
    ch.forEach((e, i) => {
      const jahr = e.label || label(e.season);
      if (e.pos === 1) out.push(e.tierKey === 'bundesliga' ? { art: 'schale', jahr } : { art: 'klein', jahr, text: LIGA[e.tierKey] || e.leagueName });
      if (e.cup === 'Pokalsieger') out.push({ art: 'pokal', jahr });
      const nach = ch[i + 1] ? ch[i + 1].tierKey : (i === ch.length - 1 ? tierJetzt() : null);
      if (nach && TIER_RANG[nach] > TIER_RANG[e.tierKey]) out.push({ art: 'auf', jahr, text: 'in die ' + (LIGA[nach] || '') });
    });
    const V = CLUB.ksVitrine || {};
    (V.euro || []).forEach(x => out.push({ art: x.art, jahr: x.jahr }));
    // laufende Saison: Pokal- und Europapokalsieg sofort
    const jetzt = label(LEAGUE.season);
    if (!ch.some(e => (e.label || label(e.season)) === jetzt)) {
      try { if (typeof CUP !== 'undefined' && CUP && CUP.winnerId === 'fcm') out.push({ art: 'pokal', jahr: jetzt }); } catch (e) { /* ohne */ }
    }
    euroSiege().forEach(art => { if (!out.some(x => x.art === art && x.jahr === jetzt)) out.push({ art, jahr: jetzt }); });
    return out;
  }
  function titel() {
    if (!hatSpiel()) return [];
    try { return kickdraft() ? titelKickdraft() : titelFlutlicht(); } catch (e) { console.warn('[Vitrine] Titel', e); return []; }
  }
  // je Art: { art, anzahl, jahre[], texte[] }, sortiert nach Rang
  function gruppen() {
    const g = {};
    titel().forEach(t => { const x = g[t.art] || (g[t.art] = { art: t.art, anzahl: 0, jahre: [], texte: [] }); x.anzahl++; x.jahre.push(t.jahr); if (t.text) x.texte.push(t.text); });
    Object.values(g).forEach(x => x.jahre.sort());       // älteste zuerst, angezeigt werden die letzten drei
    return Object.values(g).sort((a, b) => ARTEN[a.art].rang - ARTEN[b.art].rang || b.anzahl - a.anzahl);
  }

  // Europapokal-Siege vor dem Saisonwechsel festhalten (Flutlicht setzt CLUB.euro danach zurück)
  if (typeof W.startNewSeason === 'function') {
    const _o = W.startNewSeason;
    W.startNewSeason = function () {
      try {
        if (hatSpiel() && !kickdraft()) {
          const V = CLUB.ksVitrine || (CLUB.ksVitrine = {}), jahr = label(LEAGUE.season);
          V.euro = V.euro || [];
          euroSiege().forEach(art => { if (!V.euro.some(x => x.art === art && x.jahr === jahr)) V.euro.push({ art, jahr }); });
        }
      } catch (e) { console.warn('[Vitrine] Europapokal merken', e); }
      return _o.apply(this, arguments);
    };
    try { startNewSeason = W.startNewSeason; } catch (e) { /* window reicht */ }
  }

  // ── Bilder ───────────────────────────────────────────────────────────────
  const BILD = new Map();
  function bild(n) {
    if (!BILD.has(n)) BILD.set(n, new Promise(ok => { const i = new Image(); i.decoding = 'async'; i.onload = () => ok(i); i.onerror = () => ok(null); i.src = PFAD + n + '.webp'; }));
    return BILD.get(n);
  }
  // Office: die drei wichtigsten Pokale in der Vitrine – Canvas 256 × 256 (Quellgröße .ksQ), null bis die Bilder da sind
  let OFFICE = { key: null, c: null, laedt: null, p: null };
  function officeBild() {
    if (!hatSpiel() || typeof document === 'undefined') return null;
    const drei = gruppen().slice(0, 3).map(x => x.art), key = drei.join(',');
    if (OFFICE.key === key && OFFICE.c) return OFFICE.c;
    if (OFFICE.laedt !== key) {
      OFFICE.laedt = key;
      let fertig; OFFICE.p = new Promise(ok => { fertig = ok; });
      // Plätze: einer in der Mitte, zwei links/rechts, drei verteilt
      const plaetze = drei.length === 1 ? [1] : drei.length === 2 ? [0, 2] : [0, 1, 2];
      Promise.all([bild('vit-hinten'), ...drei.map((a, i) => bild(`vt-${a}-${plaetze[i]}`)), bild('vit-vorn')]).then(bs => {
        if (OFFICE.laedt !== key || bs.some(b => !b)) { fertig(OFFICE.c); return; }
        const c = document.createElement('canvas'); c.width = c.height = 256; const o = c.getContext('2d');
        bs.forEach(b => o.drawImage(b, 0, 0, 256, 256));
        c.ksQ = 256; OFFICE = { key, c, laedt: null, p: OFFICE.p }; fertig(c);
      });
    }
    return OFFICE.c;            // bis zum neuen Bild das alte
  }
  // für die Laden-Vorschau: wartet, bis das Bild steht
  function officeBildWarten() { const c = officeBild(); return c && OFFICE.key === OFFICE.laedt ? Promise.resolve(c) : (OFFICE.p || Promise.resolve(c)); }

  // ── Blatt ────────────────────────────────────────────────────────────────
  function zu() { const o = document.getElementById('vt-ov'); if (o) o.remove(); document.body.classList.remove('app-gesperrt'); }
  function oeffnen() {
    if (!hatSpiel() || typeof document === 'undefined') return;
    zu();
    const sp = spiel(), gr = gruppen(), hat = new Map(gr.map(x => [x.art, x]));
    const faecher = sp === 'kd' ? ['Meisterschaften', 'Auszeichnungen'] : ['Europa', 'Deutschland'];
    const name = (CLUB && CLUB.name) || '';
    const summe = gr.reduce((s, x) => s + x.anzahl, 0);
    const pokal = (art) => {
      const A = ARTEN[art], x = hat.get(art);
      const jahre = x ? (x.jahre.length > 3 ? x.jahre.slice(-3).join(' · ') + ` +${x.jahre.length - 3}` : x.jahre.join(' · ')) : 'noch frei';
      const zus = x && x.texte.length ? x.texte[x.texte.length - 1] : '';
      return `<div class="vt-p${x ? '' : ' leer'}"><div class="vt-bild"><img src="${PFAD}${art}.webp" alt="" loading="lazy">${x && x.anzahl > 1 ? `<span class="vt-anz">×${x.anzahl}</span>` : ''}</div>
        <b>${esc(A.name)}</b><span class="vt-schild">${esc(jahre)}</span>${zus ? `<small>${esc(zus)}</small>` : ''}</div>`;
    };
    const fachHtml = f => {
      const arten = Object.keys(ARTEN).filter(a => ARTEN[a].spiel === sp && ARTEN[a].fach === f).sort((a, b) => ARTEN[a].rang - ARTEN[b].rang);
      return `<div class="vt-titel">${esc(f)}</div><div class="vt-fach"><div class="vt-licht"></div><div class="vt-reihe">${arten.map(pokal).join('')}</div><div class="vt-brett"></div></div>`;
    };
    const ov = document.createElement('div');
    ov.id = 'vt-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Pokalvitrine');
    ov.innerHTML = `<div class="vt-box"><button type="button" class="vt-zu" aria-label="Schließen"><i class="ti ti-x" aria-hidden="true"></i></button>
      <div class="vt-kopf"><b>Pokalvitrine</b><small>${esc(name)} · ${summe ? summe + (summe === 1 ? ' Titel' : ' Titel') : 'noch kein Titel'}</small></div>
      <div class="vt-schrank">${faecher.map(fachHtml).join('')}</div></div>`;
    ov.addEventListener('click', ev => { if (ev.target === ov || ev.target.closest('.vt-zu')) zu(); });
    document.body.appendChild(ov); document.body.classList.add('app-gesperrt');
  }

  // ── Aussehen ──────────────────────────────────────────────────────────────
  if (typeof document !== 'undefined') {
    const css = document.createElement('style');
    css.textContent = `
#vt-ov{position:fixed;inset:0;z-index:9800;display:flex;align-items:flex-end;justify-content:center;background:rgb(20 12 4 / .55)}
@media (min-width:700px){#vt-ov{align-items:center}}
.vt-box{position:relative;width:min(480px,100%);max-height:92vh;overflow:auto;background:var(--bg,#f2e3c2);border-radius:24px 24px 0 0;padding:16px 12px 20px;box-shadow:0 -6px 24px #0006}
@media (min-width:700px){.vt-box{border-radius:24px}}
.vt-zu{position:absolute;right:12px;top:12px;width:40px;height:40px;border-radius:12px;border:3px solid var(--k-rand,#8a5a2b);background:var(--bg2,#fff8ea);color:var(--text,#2b1a0d);font-size:20px;display:grid;place-items:center;cursor:pointer}
.vt-kopf{padding:2px 56px 10px 6px}.vt-kopf b{display:block;font:800 28px/1 var(--font-titel,'Big Shoulders Display',system-ui);color:var(--text,#2b1a0d)}
.vt-kopf small{display:block;margin-top:4px;color:var(--text2,#7a5a3a);font:500 13px/1.2 var(--font,system-ui);text-transform:none;letter-spacing:0}
.vt-schrank{border-radius:18px;padding:12px 10px 8px;background:linear-gradient(180deg,#9a5e2c,#6e3d18);box-shadow:inset 0 0 0 3px #b77a40,0 5px 0 #4a260c}
.vt-titel{font:800 18px var(--font-titel,'Big Shoulders Display',system-ui);color:#ffe7b8;margin:2px 4px 8px;letter-spacing:.5px}
.vt-fach{position:relative;border-radius:10px;margin-bottom:12px;padding:12px 4px 0;background:radial-gradient(ellipse 60% 70% at 50% 0%,#5f7392 0%,#2a3448 55%,#1a2130 100%);overflow:hidden}
.vt-fach:after{content:"";position:absolute;inset:0;background:linear-gradient(112deg,rgb(255 255 255 / .13) 0 14%,transparent 14% 38%,rgb(255 255 255 / .07) 38% 44%,transparent 44%);pointer-events:none}
.vt-licht{position:absolute;top:0;left:12%;right:12%;height:4px;border-radius:4px;background:#fff3d6;box-shadow:0 0 18px 6px #ffe2a8aa}
.vt-reihe{position:relative;z-index:1;display:flex;flex-wrap:wrap;justify-content:space-around;row-gap:10px}
.vt-p{width:33%;display:flex;flex-direction:column;align-items:center;text-align:center;color:#f4ead3;padding-bottom:6px}
.vt-bild{position:relative;height:118px;display:flex;align-items:flex-end;justify-content:center}
.vt-bild img{max-height:118px;max-width:100px;filter:drop-shadow(0 6px 6px #0007)}
.vt-p.leer .vt-bild img{filter:brightness(0) opacity(.3)}
.vt-anz{position:absolute;top:0;right:-8px;background:linear-gradient(#ffe08a,#e2a92a);color:#3a2408;font-weight:700;font-size:12px;border-radius:10px;padding:1px 7px;box-shadow:0 2px 0 #9a6a10}
.vt-p b{font-size:12px;margin-top:6px;line-height:1.15}
.vt-schild{display:inline-block;margin-top:4px;font-size:10.5px;font-weight:600;color:#3a2410;background:linear-gradient(#f1d79a,#d4ac5c);border-radius:4px;padding:2px 6px;box-shadow:0 1px 0 #8a6224}
.vt-p.leer .vt-schild{opacity:.45}
.vt-p small{font-size:10.5px;opacity:.85;margin-top:2px}
.vt-brett{position:relative;z-index:1;height:12px;margin:4px -4px 0;background:linear-gradient(180deg,#c48a4e,#87522a);box-shadow:0 3px 0 #4a260c}`;
    document.head.appendChild(css);
  }

  W.KSVitrine = { ARTEN, titel, gruppen, oeffnen, officeBild, officeBildWarten, zu };
  console.log('[Kickstil-Vitrine v1] aktiv — Pokale je Titel (3D), Vitrine im Office, Vitrinen-Blatt');
})();
