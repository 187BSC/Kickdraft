/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · KARTENPACKS  ·  v1   (Nutzer 2026-10-18: „die Winpunkte für die Kartenpacks“ – Plan und Preise vom 2026-10-16,
   gesamt_app/spaetere_updates.md „Sammelkarten-Packs“)
   ─────────────────────────────────────────────────────────────────────────
   Erinnerungskarten deiner ehemaligen und aktuellen Spieler – nur Spieler, die je in deinem Kader standen (alle Karrieren auf
   diesem Gerät). Sonderkarten (Elf der Woche, Halloween, Spieler der Saison …) gibt es weiter nur für Leistung, nie aus dem Pack.
     · Normales Pack: 3 Karten = 3 Winpunkte · Gold-Pack: 5 Karten, mindestens 1 Gold = 6 Winpunkte
     · 1 Gratis-Pack nach jedem Saisonabschluss
     · Nur gegen Winpunkte, nie gegen echtes Geld (Bezahl-Packs gelten je nach Land als Glücksspiel)
   Stufe einer Karte aus der besten Stärke bei dir, im Vergleich zu allen deinen Spielern: oberste 15 % Gold, nächste 35 % Silber,
   Rest Bronze (ab Stärke 80 immer Gold, ab 70 mindestens Silber). Karten im Prunk-Look (kickstil_prunkkarte.js, wie Kickdraft),
   Pack-Öffnen wie Kickdrafts Rookie-Pack: Pack aufreißen, Karten einzeln umdrehen, am Ende alle zusammen.
   Doppelte zählen mit („×2“), Tausch gegen Rahmen/Hintergründe folgt später.
   Geräteweit in localStorage „fl-erinnerung“ { pool: {schlüssel: Spieler}, karten: {schlüssel: Anzahl}, gratis, neu }.
   Zugang: Laden (Abschnitt „Kartenpacks“), Kartensammlung (Reiter „Erinnerungen“).
   API: KSPacks.oeffnen(art) · .kaufen(art) · .poolAktualisieren() · .zustand() · .stufeVon(e) · .CFG
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const CFG = {
    packs: {
      normal: { name: 'Normales Pack', karten: 3, preis: 3, chancen: { gold: 0.08, silber: 0.30 } },
      gold: { name: 'Gold-Pack', karten: 5, preis: 6, chancen: { gold: 0.15, silber: 0.40 }, sicherGold: 1 }
    },
    anteil: { gold: 0.15, silber: 0.35 },      // relative Stufen über alle deine Spieler
    ab: { gold: 80, silber: 70 },              // feste Untergrenzen
    neuBevorzugt: 0.7,                         // Chance, eine noch fehlende Karte der Stufe zu ziehen
    poolMax: 500
  };
  const KEY = 'fl-erinnerung';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ic = n => `<i class="ti ti-${n}" aria-hidden="true"></i>`;
  const warte = ms => new Promise(r => setTimeout(r, ms));
  const EF = () => window.KSErfolge;
  const hatSpiel = () => { try { return typeof CLUB !== 'undefined' && CLUB && typeof LEAGUE !== 'undefined' && LEAGUE && !!LEAGUE.tiers; } catch (e) { return false; } };
  const toast = (t, a) => { if (typeof window.showToast === 'function') window.showToast(t, a || 'info'); };

  // ── Zustand (geräteweit) ───────────────────────────────────────────────
  function zustand() {
    let z = null;
    try { z = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { z = null; }
    if (!z || typeof z !== 'object') z = {};
    z.pool = z.pool || {}; z.karten = z.karten || {}; z.gratis = z.gratis || 0; z.neu = z.neu || 0;
    return z;
  }
  function speichern(z) {
    const k = Object.keys(z.pool);
    if (k.length > CFG.poolMax) k.sort((a, b) => (z.pool[a].best || 0) - (z.pool[b].best || 0)).slice(0, k.length - CFG.poolMax).forEach(x => { if (!z.karten[x]) delete z.pool[x]; });
    try { localStorage.setItem(KEY, JSON.stringify(z)); } catch (e) { console.warn('[KS-Packs] Speichern', e); }
  }

  // ── Pool: wer stand in deinem Kader? (wöchentlich, beim Laden, vor dem Saisonwechsel) ──
  const jahrVon = s => (LEAGUE.startYear || 2026) + (s || LEAGUE.season || 1) - 1;
  function spieleTore(p) {
    let a = 0, t = 0;
    (p.statsHistory || []).forEach(h => { a += h.apps || 0; t += h.goals || 0; });
    if (p.stats) { a += p.stats.apps || 0; t += p.stats.goals || 0; }
    return [a, t];
  }
  function poolAktualisieren() {
    if (!hatSpiel() || typeof SQUAD === 'undefined' || !Array.isArray(SQUAD) || !SQUAD.length) return 0;
    const z = zustand(), karriere = String(CLUB.ksKarriereId || CLUB.dataClubId || CLUB.name || 'fl'), jahr = jahrVon();
    let farben = null; try { const d = window.KSVerein && KSVerein.eigen && KSVerein.eigen(); if (d) farben = d.farben; } catch (e) { farben = null; }
    let n = 0;
    SQUAD.forEach(p => {
      if (!p || !p.name || p.onLoanAt) return;
      const k = karriere + ':' + p.id, alt = z.pool[k];
      const ovr = typeof ovrBase === 'function' ? ovrBase(p) : p.ovr;
      let ax = null; try { ax = window.DFLAppShell && DFLAppShell.achsen ? DFLAppShell.achsen(p) : null; } catch (e) { ax = null; }
      const [spiele, tore] = spieleTore(p);
      const e = alt || { k, id: p.id, seed: p.seed, von: jahr };
      Object.assign(e, { name: p.name, firstName: p.firstName || '', flag: p.flag || '', country: p.country || '', age: p.age,
        pos: p.pos, positions: (p.positions || [p.pos]).slice(0, 3), verein: CLUB.name || '', bis: jahr,
        spiele: Math.max(e.spiele || 0, spiele), tore: Math.max(e.tore || 0, tore) });
      if (!alt || (ovr || 0) >= (alt.best || 0)) { e.best = ovr; if (ax && ax.length) e.ax = ax; }
      if (farben) e.farben = farben;
      if (!alt) n++;
      z.pool[k] = e;
    });
    speichern(z);
    return n;
  }

  // ── Stufe (relativ zu allen deinen Spielern) ───────────────────────────
  function stufen(z) {
    const liste = Object.values(z.pool).sort((a, b) => (b.best || 0) - (a.best || 0)), m = {};
    const nG = Math.max(1, Math.ceil(liste.length * CFG.anteil.gold)), nS = Math.ceil(liste.length * CFG.anteil.silber);
    liste.forEach((e, i) => { m[e.k] = (e.best || 0) >= CFG.ab.gold || i < nG ? 'gold' : (e.best || 0) >= CFG.ab.silber || i < nG + nS ? 'silber' : 'bronze'; });
    return m;
  }
  const stufeVon = e => stufen(zustand())[e.k] || 'bronze';

  // ── Ziehen ─────────────────────────────────────────────────────────────
  function ziehen(art) {
    const P = CFG.packs[art], z = zustand(), st = stufen(z), alle = Object.values(z.pool);
    if (alle.length < 3) return null;
    const je = { gold: [], silber: [], bronze: [] }; alle.forEach(e => je[st[e.k]].push(e));
    const gezogen = [], schon = new Set();
    const eine = stufe => {
      let topf = je[stufe].length ? je[stufe] : (je.silber.length ? je.silber : je.bronze.length ? je.bronze : je.gold);
      const frei = topf.filter(e => !schon.has(e.k));
      if (frei.length) topf = frei;
      const fehlt = topf.filter(e => !z.karten[e.k]);
      const wahl = (fehlt.length && Math.random() < CFG.neuBevorzugt ? fehlt : topf);
      const e = wahl[Math.floor(Math.random() * wahl.length)];
      schon.add(e.k);
      return { e, stufe: st[e.k] };
    };
    for (let i = 0; i < P.karten; i++) {
      const sicher = P.sicherGold && i === P.karten - 1 && !gezogen.some(g => g.stufe === 'gold');
      const r = Math.random(), stufe = sicher ? 'gold' : r < P.chancen.gold ? 'gold' : r < P.chancen.gold + P.chancen.silber ? 'silber' : 'bronze';
      gezogen.push(eine(stufe));
    }
    // aufsteigend: das Beste zuletzt
    const RANG = { bronze: 0, silber: 1, gold: 2 };
    gezogen.sort((a, b) => RANG[a.stufe] - RANG[b.stufe] || (a.e.best || 0) - (b.e.best || 0));
    gezogen.forEach(g => { g.neu = !z.karten[g.e.k]; z.karten[g.e.k] = (z.karten[g.e.k] || 0) + 1; g.anzahl = z.karten[g.e.k]; });
    z.neu += gezogen.filter(g => g.neu).length;
    speichern(z);
    return gezogen;
  }

  // ── Kaufen / Gratis ────────────────────────────────────────────────────
  function kaufen(art) {
    const P = CFG.packs[art]; if (!P) return { ok: false, grund: 'Unbekanntes Pack' };
    poolAktualisieren();
    if (Object.keys(zustand().pool).length < 3) return { ok: false, grund: 'Erst ein paar Spiele mit deinem Kader' };
    if (art === 'gratis') { /* nie */ }
    if (!EF() || !EF().ausgeben(P.preis, P.name)) return { ok: false, grund: 'Zu wenige Winpunkte' };
    return { ok: true, karten: ziehen(art) };
  }
  function gratisOeffnen() {
    const z = zustand(); if (z.gratis < 1) return { ok: false, grund: 'Kein Gratis-Pack' };
    poolAktualisieren();
    if (Object.keys(zustand().pool).length < 3) return { ok: false, grund: 'Erst ein paar Spiele mit deinem Kader' };
    const z2 = zustand(); z2.gratis -= 1; speichern(z2);
    return { ok: true, karten: ziehen('normal') };
  }

  // ── Karte ──────────────────────────────────────────────────────────────
  function gesicht(e) {
    try {
      const I = window.DFLIdentitaet || window.KSIdentitaet;
      if (I && I.gesichtSvg) return I.gesichtSvg(e, e.farben ? { id: 'fcm', farben: e.farben } : null);
      return window.KSVerein ? KSVerein.gesicht(e, 'fcm') : '';
    } catch (x) { return ''; }
  }
  function flagge(e) { try { return window.KSNationen && KSNationen.flagge ? KSNationen.flagge(e.country) || '' : ''; } catch (x) { return ''; } }
  function karteHtml(e, stufe) {
    const ax = Array.isArray(e.ax) && e.ax.length ? e.ax : [['TEM', '–'], ['SCH', '–'], ['PAS', '–'], ['DRI', '–'], ['DEF', '–'], ['PHY', '–']];
    const zeit = e.von === e.bis ? String(e.von) : `${e.von}–${String(e.bis).slice(-2)}`;
    const titel = `${zeit} · ${e.spiele || 0} Spiele${e.tore ? ' · ' + e.tore + ' Tore' : ''}`;
    if (!window.KSPrunk) return `<div class="kp-ersatz kp-${stufe}"><b>${esc(e.best)}</b><span>${esc(e.name)}</span></div>`;
    KSPrunk.stil();
    return KSPrunk.karte({ stufe, wert: e.best, pos: e.pos, positionen: e.positions, gesicht: gesicht(e), name: e.name, werte: ax,
      flagge: flagge(e), titel, seed: (e.seed || 7) * 1000 % 997 });
  }

  // ── Pack öffnen (wie Kickdrafts Rookie-Pack) ───────────────────────────
  let OV = null, tipp = null;
  const weiter = () => new Promise(r => { tipp = r; });
  function farben() {
    try { const d = window.KSVerein && KSVerein.eigen && KSVerein.eigen(); if (d && d.farben) return [d.farben[0] || '#1f4fa0', d.farben[1] || '#ffffff']; } catch (e) { /* Standard */ }
    return ['#1f4fa0', '#ffffff'];
  }
  async function zeigen(art, karten) {
    if (!karten || !karten.length) return;
    if (!OV) {
      OV = document.createElement('div'); OV.id = 'kp-ov';
      OV.addEventListener('click', ev => {
        if (ev.target.closest('[data-kp-zu]')) { OV.classList.remove('auf'); document.body.classList.remove('app-gesperrt'); return; }
        if (ev.target.closest('[data-kp-sammlung]')) { OV.classList.remove('auf'); document.body.classList.remove('app-gesperrt'); sammlungOeffnen(); return; }
        if (ev.target.closest('[data-kp-ueber]')) { ueber = true; }
        if (tipp) { const t = tipp; tipp = null; t(); }
      });
      document.body.appendChild(OV);
    }
    let ueber = false;
    const [f1, f2] = farben(), gold = art === 'gold';
    OV.style.setProperty('--kp-a', f1); OV.style.setProperty('--kp-b', f2);
    OV.innerHTML = `<div class="kp-licht"></div>
      <div class="kp-buehne"><div class="kp-pack${gold ? ' gold' : ''}"><span class="kp-pack-oben">FLUTLICHT</span><b>ERINNERUNGEN</b>
        <span class="kp-pack-art">${gold ? 'GOLD-PACK' : 'PACK'} · ${karten.length} KARTEN</span><i class="kp-riss"></i></div></div>
      <p class="kp-hinweis finger" aria-label="Tippen zum Öffnen"><i class="ti ti-hand-finger" aria-hidden="true"></i></p>
      <button type="button" class="kp-ueber" data-kp-ueber>Überspringen</button>`;
    document.body.classList.add('app-gesperrt');
    requestAnimationFrame(() => OV.classList.add('auf'));
    await weiter();
    const buehne = OV.querySelector('.kp-buehne'), hinweis = OV.querySelector('.kp-hinweis');
    // Nutzer 2026-10-22: überflüssiger Text raus – wie im Draft-Pack nur der pulsierende Finger, Text nur im aria-label
    const finger = t => { hinweis.innerHTML = '<i class="ti ti-hand-finger" aria-hidden="true"></i>'; hinweis.setAttribute('aria-label', t); hinweis.classList.add('finger'); };
    OV.querySelector('.kp-pack').classList.add('reisst');
    await warte(ueber ? 0 : 650);
    for (let i = 0; i < karten.length && !ueber; i++) {
      const g = karten[i];
      buehne.innerHTML = `<div class="kp-karte kp-${g.stufe}"><div class="kp-rueck"><span>${g.stufe === 'gold' ? ic('star-filled') : g.stufe === 'silber' ? ic('star') : ic('circle')}</span></div>
        <div class="kp-vorn">${karteHtml(g.e, g.stufe)}</div></div>
        <div class="kp-info"><b>${esc(((g.e.firstName || '') + ' ' + g.e.name).trim())}</b><small>${esc(g.e.verein || '')}</small>
        <span class="kp-marke ${g.neu ? 'neu' : 'doppelt'}">${g.neu ? 'NEU' : 'Doppelt · ×' + g.anzahl}</span></div>`;
      finger(`Karte ${i + 1} von ${karten.length} · Tippen`);
      await warte(60);
      await weiter(); if (ueber) break;
      const k = buehne.querySelector('.kp-karte'); k.classList.add('dreht');
      if (g.stufe === 'gold') OV.classList.add('kp-gold-glanz');
      await warte(500);
      buehne.querySelector('.kp-info').classList.add('sicht');
      await weiter();
      OV.classList.remove('kp-gold-glanz');
    }
    // Übersicht
    buehne.innerHTML = `<div class="kp-alle">${karten.map(g => `<figure class="kp-klein">${karteHtml(g.e, g.stufe)}<figcaption>${g.neu ? '<b>NEU</b>' : '×' + g.anzahl}</figcaption></figure>`).join('')}</div>`;
    hinweis.classList.remove('finger'); hinweis.removeAttribute('aria-label');
    hinweis.textContent = `${karten.filter(g => g.neu).length} neue Erinnerungen`;
    const u = OV.querySelector('.kp-ueber'); if (u) u.remove();
    OV.insertAdjacentHTML('beforeend', `<div class="kp-knoepfe"><button type="button" class="app-knopf" data-kp-sammlung>${ic('cards')}Erinnerungen ansehen</button>
      <button type="button" class="app-knopf haupt" data-kp-zu>Fertig</button></div>`);
  }

  async function oeffnen(art) {
    const r = art === 'gratis' ? gratisOeffnen() : kaufen(art);
    if (!r.ok) { toast(r.grund, 'warning'); return r; }
    try { if (typeof saveGameState === 'function') saveGameState(); } catch (e) { /* Konto ist geräteweit */ }
    ladenNeu();
    await zeigen(art === 'gold' ? 'gold' : 'normal', r.karten);
    ladenNeu();
    return r;
  }

  // ── Laden: Abschnitt „Kartenpacks“ ─────────────────────────────────────
  function abschnittHtml() {
    const z = zustand(), k = EF() ? EF().konto() : 0, n = Object.keys(z.pool).length, besitz = Object.keys(z.karten).length;
    const pack = (art, P) => `<div class="kp-ware${art === 'gold' ? ' gold' : ''}"><div class="kp-mini-pack${art === 'gold' ? ' gold' : ''}"><b>${art === 'gold' ? 'GOLD' : 'PACK'}</b><span>${P.karten}</span></div>
      <b>${esc(P.name)}</b><small>${P.karten} Karten${P.sicherGold ? ' · mind. 1 Gold' : ''}</small>
      <button type="button" class="app-knopf" data-kp-kauf="${art}" ${k < P.preis || n < 3 ? 'disabled' : ''}>${ic('lock-open')}${P.preis} W</button></div>`;
    return `<section class="kp-abschnitt"><h3 class="ef-h3">${ic('cards')} Kartenpacks</h3>
      ${z.gratis > 0 ? `<button type="button" class="kp-gratis" data-kp-kauf="gratis" ${n < 3 ? 'disabled' : ''}>${ic('gift')}<span><b>Gratis-Pack öffnen</b><small>Für deinen Saisonabschluss${z.gratis > 1 ? ' · noch ' + z.gratis : ''}</small></span></button>` : ''}
      <div class="ld-gitter kp-gitter">${pack('normal', CFG.packs.normal)}${pack('gold', CFG.packs.gold)}</div>
      <p class="ld-klein">Erinnerungskarten deiner Spieler · ${besitz} von ${n} gesammelt</p></section>`;
  }
  function ladenEinbauen() {
    document.querySelectorAll('.ld-blatt').forEach(b => {
      if (b.querySelector('.kp-abschnitt')) return;
      const vor = [...b.querySelectorAll('h3.ef-h3')].find(h => /Fürs Office/.test(h.textContent)) || b.querySelector('h3.ef-h3');
      if (vor) vor.insertAdjacentHTML('beforebegin', abschnittHtml());
    });
  }
  function ladenNeu() {
    document.querySelectorAll('.ld-blatt .kp-abschnitt').forEach(a => { a.outerHTML = abschnittHtml(); });
  }
  document.addEventListener('click', ev => {
    const b = ev.target.closest && ev.target.closest('[data-kp-kauf]');
    if (!b || b.disabled) return;
    ev.preventDefault(); ev.stopPropagation();
    oeffnen(b.getAttribute('data-kp-kauf'));
  }, true);

  // ── Kartensammlung: Reiter „Erinnerungen“ ──────────────────────────────
  let SAMMLUNG_AN = false;
  function erinnerungenHtml() {
    const z = zustand(), st = stufen(z), RANG = { gold: 0, silber: 1, bronze: 2 };
    const liste = Object.values(z.pool).filter(e => z.karten[e.k]).sort((a, b) => RANG[st[a.k]] - RANG[st[b.k]] || (b.best || 0) - (a.best || 0));
    const n = Object.keys(z.pool).length;
    return `<p class="ksk-unter">${liste.length} von ${n} Erinnerungen · aus Kartenpacks im Laden</p>` + (liste.length
      ? `<div class="ksk-raster kp-raster">${liste.map(e => `<figure class="ksk-zelle"><div class="kp-klein">${karteHtml(e, st[e.k])}</div>
          <figcaption><b>${esc(((e.firstName || '') + ' ' + e.name).trim())}</b><small>${esc(e.verein || '')}</small>${z.karten[e.k] > 1 ? `<small>×${z.karten[e.k]}</small>` : ''}</figcaption></figure>`).join('')}</div>`
      : `<p class="ksk-leer">Noch keine Erinnerungen. Kartenpacks gibt es im Laden – nach jedem Saisonabschluss eins gratis.</p>`);
  }
  function sammlungEinbauen() {
    const box = document.querySelector('#ks-karten .ksk-box'); if (!box) return;
    const reiter = box.querySelector('.ksk-reiter'); if (!reiter) return;
    if (!reiter.querySelector('[data-kp-reiter]')) {
      reiter.insertAdjacentHTML('beforeend', `<button type="button" data-kp-reiter class="${SAMMLUNG_AN ? 'an' : ''}">Erinnerungen</button>`);
    }
    if (SAMMLUNG_AN && !box.querySelector('.kp-erinnerungen')) {
      reiter.querySelectorAll('button').forEach(b => b.classList.toggle('an', b.hasAttribute('data-kp-reiter')));
      let n = reiter.nextSibling; while (n) { const x = n.nextSibling; n.remove(); n = x; }
      reiter.insertAdjacentHTML('afterend', `<div class="kp-erinnerungen">${erinnerungenHtml()}</div>`);
      const z = zustand(); if (z.neu) { z.neu = 0; speichern(z); }
    }
  }
  document.addEventListener('click', ev => {
    if (ev.target.closest && ev.target.closest('#ks-karten [data-kp-reiter]')) { ev.stopPropagation(); SAMMLUNG_AN = true; sammlungEinbauen(); return; }
    if (ev.target.closest && ev.target.closest('#ks-karten [data-ksk-reiter], #ks-karten [data-ksk-filter]')) SAMMLUNG_AN = false;
  }, true);
  function sammlungOeffnen() {
    if (!window.KSKarten || !KSKarten.oeffnen) return;
    SAMMLUNG_AN = true; KSKarten.oeffnen(); setTimeout(sammlungEinbauen, 30);
  }
  new MutationObserver(() => { ladenEinbauen(); sammlungEinbauen(); }).observe(document.documentElement, { childList: true, subtree: true });

  // ── Einhängen: Pool je Woche / beim Laden, Gratis-Pack je Saisonabschluss ──
  if (typeof window.advanceCalendarWeek === 'function') {
    const _w = window.advanceCalendarWeek;
    window.advanceCalendarWeek = function () { try { poolAktualisieren(); } catch (e) { /* später */ } return _w.apply(this, arguments); };
    try { advanceCalendarWeek = window.advanceCalendarWeek; } catch (e) { /* window reicht */ }
  }
  if (typeof window.startNewSeason === 'function') {
    const _s = window.startNewSeason;
    window.startNewSeason = function () {
      try { poolAktualisieren(); } catch (e) { /* weiter */ }
      const r = _s.apply(this, arguments);
      try {
        const z = zustand(); z.gratis = Math.min(5, (z.gratis || 0) + 1); speichern(z);
        if (typeof addNews === 'function') addNews('club', 'Gratis-Kartenpack', 'Für den Saisonabschluss liegt im Laden ein Kartenpack mit Erinnerungen an deine Spieler bereit.');
      } catch (e) { /* ohne Pack */ }
      return r;
    };
    try { startNewSeason = window.startNewSeason; } catch (e) { /* window reicht */ }
  }
  setTimeout(() => { try { poolAktualisieren(); } catch (e) { /* später */ } }, 3000);

  const css = document.createElement('style');
  css.textContent = `
  .kp-abschnitt{margin:0 0 6px}.kp-gitter{grid-template-columns:1fr 1fr}
  .kp-ware{display:flex;flex-direction:column;align-items:center;text-align:center;gap:4px;padding:12px 8px;border-radius:16px;background:var(--bg3,#efe2c8);border:var(--k-rahmen,2px solid #d9c29a)}
  .kp-ware small{color:var(--text3,#846d52);font-size:12px}.kp-ware .app-knopf{margin-top:4px;width:100%}
  .kp-mini-pack{width:64px;height:86px;border-radius:10px;display:grid;place-items:center;align-content:center;gap:2px;color:#fff;
    background:linear-gradient(160deg,var(--kp-a,#2a5bb8),#0d1f45);box-shadow:inset 0 0 0 2px rgb(255 255 255/.35),0 4px 0 rgb(0 0 0/.25);
    font:800 13px/1 'Big Shoulders Display',var(--font-zahl,system-ui);letter-spacing:.06em}
  .kp-mini-pack span{font-size:26px}.kp-mini-pack.gold{background:linear-gradient(160deg,#ffe58a,#c99a2e);color:#3a2a05}
  .kp-gratis{display:flex;align-items:center;gap:12px;width:100%;border:0;border-radius:16px;padding:12px 14px;margin:0 0 10px;cursor:pointer;
    background:linear-gradient(150deg,#ffe58a,#e3a524);color:#2a1c02;text-align:left;box-shadow:0 4px 0 #a5780f;font-family:var(--font-text,system-ui)}
  .kp-gratis .ti{font-size:26px}.kp-gratis span{display:flex;flex-direction:column}.kp-gratis small{font-size:12px;opacity:.8}
  #kp-ov{position:fixed;inset:0;z-index:12600;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;opacity:0;pointer-events:none;
    transition:opacity .25s;background:radial-gradient(ellipse at 50% 40%,#1f2a44 0%,#070a12 70%);color:#fff;font-family:var(--font-text,system-ui);padding:20px}
  #kp-ov.auf{opacity:1;pointer-events:auto}
  .kp-licht{position:absolute;left:50%;top:-10%;width:140%;height:80%;transform:translateX(-50%);pointer-events:none;
    background:conic-gradient(from 180deg at 50% 0%,transparent 160deg,rgb(255 255 230/.16) 175deg,rgb(255 255 230/.22) 180deg,rgb(255 255 230/.16) 185deg,transparent 200deg)}
  .kp-buehne{position:relative;min-height:360px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px}
  .kp-pack{position:relative;width:200px;height:290px;border-radius:18px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;
    background:linear-gradient(160deg,var(--kp-a) 0%,#0d1428 85%);box-shadow:inset 0 0 0 3px rgb(255 255 255/.35),0 20px 40px rgb(0 0 0/.55);
    font-family:'Big Shoulders Display',var(--font-zahl,system-ui);animation:kp-schweben 2.4s ease-in-out infinite;overflow:hidden}
  .kp-pack.gold{background:linear-gradient(160deg,#ffe9a0 0%,#c99a2e 55%,#6d4c0c 100%);color:#2a1c02}
  .kp-pack::after{content:'';position:absolute;inset:-40%;background:linear-gradient(115deg,transparent 40%,rgb(255 255 255/.35) 50%,transparent 60%);animation:kp-glanz 2.8s linear infinite}
  .kp-pack-oben{font-weight:800;letter-spacing:.3em;font-size:14px;opacity:.85}.kp-pack b{font-size:30px;letter-spacing:.06em}
  .kp-pack-art{font-weight:700;font-size:14px;letter-spacing:.12em;padding:4px 10px;border-radius:999px;background:rgb(0 0 0/.25)}
  .kp-pack.reisst{animation:kp-reissen .65s ease-in forwards}
  @keyframes kp-schweben{50%{transform:translateY(-8px) rotate(-1deg)}}
  @keyframes kp-glanz{from{transform:translateX(-60%)}to{transform:translateX(60%)}}
  @keyframes kp-reissen{30%{transform:scale(1.08) rotate(2deg)}100%{transform:translateY(-120%) scale(.9);opacity:0}}
  .kp-karte{position:relative;width:220px;height:308px;perspective:900px;animation:kp-rein .35s ease-out}
  .kp-rueck,.kp-vorn{position:absolute;inset:0;backface-visibility:hidden;transition:transform .5s cubic-bezier(.3,.7,.3,1)}
  .kp-vorn{transform:rotateY(180deg)}.kp-karte.dreht .kp-rueck{transform:rotateY(-180deg)}.kp-karte.dreht .kp-vorn{transform:rotateY(0)}
  .kp-rueck{border-radius:18px;display:grid;place-items:center;font-size:54px;color:rgb(255 255 255/.9);
    background:linear-gradient(160deg,var(--kp-a),#0b1226);box-shadow:inset 0 0 0 3px rgb(255 255 255/.3),0 0 40px var(--kp-glow,rgb(255 255 255/.25))}
  .kp-bronze{--kp-glow:#e0a070}.kp-silber{--kp-glow:#dfe8f5}.kp-gold{--kp-glow:#ffd257}
  .kp-gold .kp-rueck{box-shadow:inset 0 0 0 3px #ffe58a,0 0 70px #ffd257}
  @keyframes kp-rein{from{transform:translateY(40px) scale(.9);opacity:0}}
  #kp-ov.kp-gold-glanz{background:radial-gradient(ellipse at 50% 40%,#5a4410 0%,#120d03 70%)}
  .kp-info{text-align:center;opacity:0;transform:translateY(8px);transition:all .3s}.kp-info.sicht{opacity:1;transform:none}
  .kp-info b{display:block;font:700 20px/1.2 var(--font-titel,system-ui)}.kp-info small{display:block;opacity:.75;margin:2px 0 6px}
  .kp-marke{display:inline-block;font:800 12px/1 var(--font-text,system-ui);letter-spacing:.08em;padding:5px 10px;border-radius:999px}
  .kp-marke.neu{background:#3fb950;color:#06200c}.kp-marke.doppelt{background:rgb(255 255 255/.18)}
  .kp-hinweis{position:relative;margin:0;opacity:.75;font-size:14px}
  .kp-hinweis.finger{animation:kp-blink 1.4s ease-in-out infinite}.kp-hinweis.finger .ti{font-size:30px}
  @keyframes kp-blink{50%{opacity:.35}}
  .kp-ueber{position:absolute;top:calc(14px + env(safe-area-inset-top,0px));right:14px;border:0;background:rgb(255 255 255/.12);color:#fff;border-radius:999px;padding:8px 14px;font:600 13px var(--font-text,system-ui);cursor:pointer}
  .kp-alle{display:flex;flex-wrap:wrap;justify-content:center;gap:4px;max-width:420px}
  .kp-klein{margin:0;width:110px;height:162px;position:relative}.kp-klein>.pk{transform:scale(.5);transform-origin:0 0}
  .kp-klein figcaption{position:absolute;left:0;right:0;bottom:-2px;text-align:center;font-size:12px}
  .kp-alle .kp-klein{height:170px}
  .kp-knoepfe{position:relative;display:flex;gap:10px;flex-wrap:wrap;justify-content:center}
  .kp-raster .ksk-zelle .kp-klein{margin:0 auto}
  .kp-ersatz{width:110px;height:154px;border-radius:12px;display:grid;place-items:center;background:#c88a5a;color:#2a1c02}
  .kp-ersatz.kp-silber{background:#c9d1db}.kp-ersatz.kp-gold{background:#e2c36e}
  .ksk-unter{margin:4px 2px 10px;color:var(--text3,#846d52);font-size:13px}
  @media (prefers-reduced-motion:reduce){.kp-pack,.kp-pack::after{animation:none}}`;
  document.head.appendChild(css);

  window.KSPacks = { CFG, oeffnen, kaufen, poolAktualisieren, zustand, stufeVon, ziehen, karteHtml, zeigen };
  console.log('[KS-Kartenpacks v1] aktiv — Erinnerungskarten deiner Spieler: Pack 3 W, Gold-Pack 6 W, Gratis-Pack je Saisonabschluss');
})();
