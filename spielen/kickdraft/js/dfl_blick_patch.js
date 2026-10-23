/* ═══════════════════════════════════════════════════════════════════════════
   DFL · AUF EINEN BLICK, TEIL 2  ·  v1   (D62 · 4–7, freigegeben 2026-10-10, eingebaut 2026-10-11)
   ─────────────────────────────────────────────────────────────────────────
   Vorschau: spiel/dfl_intuitiv_vorschau.html (Teil 1–3 – Spielvorschau, Konferenz, Tabelle – baut D64).
     4 Cap nach Positionsgruppen im Front Office: Balken TW/Abwehr/Mittelfeld/Sturm/Dev. Squad/Dead Cap mit
       Untergrenze, wessen Vertrag ausläuft, die größten Posten.
     5 Kader mit Ampeln: Vertrag (läuft aus / noch 2 Jahre), verletzt, müde (Fitness unter 80), Stimmung
       (DFLStimmung: Chance zu bleiben) je Zeile der Kaderliste, Filter oben zählen mit.
     6 Karriere-Kompass im Spieler-Blatt (eigene Spieler): typische Kurve je Alter aus der Welt-Simulation,
       Phase, Potenzial-Band (nur das sichtbare, D103), „Bleibt er?“ und Vertragswarnung.
     7 Erste Schritte im Office (erste Saison, bis Spieltag 1): Liste, die sich beim Spielen abhakt.
   „Lieber nicht“ der Vorschau: keine neuen Fenster, keine Erklärseiten, jede Zahl mit Farbe/Balken/Richtung.
   Hängt sich an: renderHomeTab (Office), renderSquadOverview (Kaderliste), #view-fo und #app-blatt
   (MutationObserver – die App-Oberfläche ruft ihre Zeichenfunktionen intern auf), DFLTaktik.stilSetzen/waehle,
   DFLTickets.blatt, setTicketLevel/setSeasonTicketLevel, processFixtureResult (Testspiel).
   Zustand: CLUB.dfl.ersteSchritte { kader, taktik, tickets, test }. API: DFLBlick.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const CFG = {
    // Mittlere Änderung der Stärke je Saison nach Alter (Alter in der Vorsaison), Welt-Simulation 3 Ligen × 10 Saisons,
    // 2026-10-11 (Kaderspieler, Stand nach dem Saisonwechsel). Getrennt nach Stärke: unter 70, 70–79, ab 80.
    kurve: {
      u70: { 18: 3.66, 19: 3.54, 20: 2.83, 21: 2.26, 22: 1.72, 23: 1.3, 24: 1.64, 25: 0.08, 26: 0.19, 27: 0.31, 28: -0.3, 29: -0.88, 30: -1.57, 31: -1.96, 32: -2.2, 33: -2.4, 34: -2.5, 35: -2.5 },
      s70: { 18: 3.35, 19: 3.84, 20: 2.94, 21: 2.6, 22: 2, 23: 1.77, 24: 1.47, 25: 0.34, 26: 0.28, 27: 0.31, 28: 0.28, 29: -0.08, 30: -0.4, 31: -1.2, 32: -1.35, 33: -2.34, 34: -2.4, 35: -2.4 },
      s80: { 18: 3.33, 19: 3.33, 20: 2.65, 21: 1.87, 22: 1.51, 23: 1.65, 24: 1.35, 25: 0.6, 26: 0.62, 27: 0.53, 28: 0.56, 29: 0.4, 30: 0.21, 31: -0.59, 32: -0.84, 33: -1.26, 34: -1.49, 35: -1.45 }
    },
    ampel: { muede: 80, gut: 60, mittel: 40 },
    untergrenze: 0.89
  };
  const dfl = () => typeof CLUB !== 'undefined' && CLUB && CLUB.dfl && CLUB.dfl.aktiv;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const mio = x => (typeof formatEuro === 'function' ? formatEuro(x) : (x / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' Mio €');
  const K = () => window.DFLKader || null;
  const icon = n => `<i class="ti ti-${n}" aria-hidden="true"></i>`;
  const voll = p => (p.firstName ? p.firstName + ' ' : '') + p.name;
  const kurzName = p => (typeof displayName === 'function' ? displayName(p) : voll(p));
  const GRUPPE = { TW: 'TW', IV: 'Abwehr', AV: 'Abwehr', LV: 'Abwehr', RV: 'Abwehr', ZDM: 'Mittelfeld', DM: 'Mittelfeld', ZM: 'Mittelfeld',
    OM: 'Mittelfeld', ZOM: 'Mittelfeld', AM: 'Mittelfeld', LM: 'Mittelfeld', RM: 'Mittelfeld', FL: 'Sturm', LF: 'Sturm', RF: 'Sturm', ST: 'Sturm', MS: 'Sturm' };
  const GRUPPEN = [['TW', 'var(--p-tw, #f1c40f)'], ['Abwehr', 'var(--p-abw, #2563eb)'], ['Mittelfeld', 'var(--p-mf, #22c55e)'], ['Sturm', 'var(--p-st, #dc2626)'],
    ['Dev. Squad', 'var(--text3, #8b949e)'], ['Dead Cap', 'var(--k-rand, #5c3a1c)']];
  // Restlaufzeit in Saisons (1 = endet nach dieser Saison)
  const restJahre = p => Math.max(0, (p.contractUntil || 0) - (LEAGUE.season || 0) + 1);
  const fitnessVon = p => Math.round(typeof p.fitness === 'number' ? p.fitness : 95);
  const verletzt = p => (typeof isInjured === 'function' ? isInjured(p) : (p.injuryWeeks || 0) > 0);
  const zustand = () => { CLUB.dfl.ersteSchritte = CLUB.dfl.ersteSchritte || {}; return CLUB.dfl.ersteSchritte; };

  // ── Stimmung eigener Spieler (Chance zu bleiben, wie in den Verhandlungen) ─
  let stimmCache = { k: '', m: new Map() };
  function stimmung(p) {
    const ST = window.DFLStimmung, D = window.DFLSpiel;
    if (!ST || !D || !D.liga) return null;
    const k = (LEAGUE.season || 0) + ':' + (LEAGUE.week || 0) + ':' + SQUAD.length;
    if (stimmCache.k !== k) {
      stimmCache = { k, m: new Map() };
      try {
        const L = D.liga(), eigen = D.eigenSync ? D.eigenSync() : null;
        if (L && eigen) eigen.roster.forEach(w => { try { stimmCache.m.set(String(w.sq || w.id), ST.stimmung(w, eigen, L)); } catch (e) { /* einzelner Spieler */ } });
      } catch (e) { console.warn('[DFL-Blick] Stimmung', e); }
    }
    return stimmCache.m.get(String(p.id)) || stimmCache.m.get(String(p.dflId)) || null;
  }

  // ── 4 · Cap nach Positionsgruppen (Front Office) ─────────────────────────
  function capDaten() {
    const k = K(); if (!k) return null;
    const limit = k.capLimit(), belegt = k.capBelegt(), g = {};
    GRUPPEN.forEach(([n]) => { g[n] = 0; });
    const posten = [];
    SQUAD.forEach(p => {
      const hit = k.capHitJahr(p) || 0;
      const n = p.perspektiv ? 'Dev. Squad' : (GRUPPE[p.pos] || 'Mittelfeld');
      g[n] += hit; if (!p.perspektiv) posten.push({ p, hit });
    });
    const summe = Object.values(g).reduce((s, v) => s + v, 0);
    g['Dead Cap'] = Math.max(0, belegt - summe);
    return { limit, belegt, unten: CFG.untergrenze * k.cap(), g, teuerste: posten.sort((a, b) => b.hit - a.hit).slice(0, 5),
      auslaufend: SQUAD.filter(p => !p.perspektiv && restJahre(p) <= 1).sort((a, b) => b.ovr - a.ovr) };
  }
  // D111 (Ebene 2): „Wohin der Cap geht“ und „Größte Posten“ eingeklappt – ein Tipp öffnet (Aufklappen über data-eb-auf,
  // dfl_ebenen_patch.js); ohne das Modul offen wie vorher
  function capHtml() {
    const c = capDaten(); if (!c) return '';
    const teile = GRUPPEN.map(([n, f]) => ({ n, f, v: c.g[n] })).filter(t => t.v > 0);
    const max = Math.max(1, ...c.teuerste.map(t => t.hit));
    const zu = !!window.DFLEbenen;
    const kopf = (ziel, ic, text, rechts) => zu
      ? `<button type="button" class="blick-auf" data-eb-auf="${ziel}" aria-expanded="false"><span>${icon(ic)} ${text}</span>${rechts ? `<b>${rechts}</b>` : ''}${icon('chevron-down')}</button>`
      : `<div class="fo-zeile"><span>${icon(ic)} ${text}</span>${rechts ? `<b>${rechts}</b>` : ''}</div>`;
    return `<section class="fo-karte dfl-blick-cap" aria-label="Cap nach Positionen" data-eb-box>
      ${kopf('cap', 'chart-pie', 'Wohin der Cap geht', Math.round(c.belegt / c.limit * 100) + ' %')}
      <div class="blick-teil" data-eb-ziel="cap"${zu ? ' hidden' : ''}>
      <div class="blick-capbalken" role="img" aria-label="Cap nach Positionsgruppen">
        ${teile.map(t => `<i style="width:${(t.v / c.limit * 100).toFixed(2)}%;background:${t.f}" title="${esc(t.n)} ${esc(mio(t.v))}"></i>`).join('')}
        <em style="left:${Math.min(100, c.unten / c.limit * 100).toFixed(1)}%" title="Untergrenze"></em></div>
      <div class="blick-capliste">${teile.map(t => `<span class="blick-farbe" style="background:${t.f}"></span><span>${esc(t.n)}</span><b>${esc(mio(t.v))}</b>`).join('')}</div>
      ${c.auslaufend.length ? `<div class="blick-unter">${icon('calendar-x')} Läuft nach der Saison aus</div>
        <div class="blick-kette">${c.auslaufend.slice(0, 8).map(p => `<span><span class="pos-badge-sm pos-${esc(p.pos)}">${esc(p.pos)}</span>${esc(kurzName(p))} <b>${p.ovr}</b></span>`).join('')}${c.auslaufend.length > 8 ? `<span>+${c.auslaufend.length - 8}</span>` : ''}</div>` : ''}
      </div>
      ${zu ? kopf('posten', 'coins', 'Größte Posten', '') : `<div class="blick-unter">${icon('coins')} Größte Posten</div>`}
      <div class="blick-posten" data-eb-ziel="posten"${zu ? ' hidden' : ''}>${c.teuerste.map(t => `<span class="pos-badge-sm pos-${esc(t.p.pos)}">${esc(t.p.pos)}</span><span class="blick-name">${esc(kurzName(t.p))}<i style="width:${(t.hit / max * 100).toFixed(1)}%"></i></span><b>${esc(mio(t.hit))}</b>`).join('')}</div>
    </section>`;
  }
  function foErgaenzen() {
    const fo = document.querySelector('#view-fo .fo');
    if (!fo || !dfl() || fo.querySelector('.dfl-blick-cap')) return;
    const auf = fo.querySelector('.fo-cap-pos');                                 // D121: kurzes Front Office – zum Aufklappen
    if (auf) { auf.innerHTML = capHtml(); return; }
    const karte = fo.querySelector('.fo-karte');
    if (karte) karte.insertAdjacentHTML('afterend', capHtml());
  }

  // ── 5 · Kader mit Ampeln (Kaderliste) ────────────────────────────────────
  const FILTER = [
    ['alle', 'Alle', () => true],
    ['vertrag', 'Vertrag läuft aus', p => !p.perspektiv && restJahre(p) <= 1],
    ['muede', 'Müde', p => fitnessVon(p) < CFG.ampel.muede],
    ['verletzt', 'Verletzt', p => verletzt(p)],
    ['stimmung', 'Unzufrieden', p => { const s = stimmung(p); return !!(s && s.chance < CFG.ampel.mittel); }],
    // D112: Stil-Zeichen mit Haken (dfl_ebenen_patch.js)
    ['stil', 'Passt zu meinem Stil', p => !!(window.DFLEbenen && DFLEbenen.passtZuMir(p))]
  ];
  let filterAktiv = 'alle';
  // D111: das Filter-Blatt (dfl_ebenen_patch.js) setzt den Filter; die Chips hier bleiben die Quelle (am PC sichtbar)
  function filterSetzen(id) {
    if (!FILTER.some(f => f[0] === id)) id = 'alle';
    filterAktiv = id;
    const host = typeof document !== 'undefined' && document.getElementById ? document.getElementById('sub-squadlist') : null;
    if (host) {
      host.querySelectorAll('[data-blick-filter]').forEach(x => x.setAttribute('aria-pressed', String(x.getAttribute('data-blick-filter') === id)));
      if (host.querySelector('.blick-filter')) filterAnwenden(host);
    }
    return filterAktiv;
  }
  function ampelHtml(p) {
    const a = [], rest = restJahre(p);
    if (!p.perspektiv && rest <= 1) a.push(`<span class="blick-a rot" title="Vertrag läuft nach der Saison aus">${icon('calendar')}</span>`);
    else if (!p.perspektiv && rest === 2) a.push(`<span class="blick-a gelb" title="Vertrag läuft noch 2 Saisons">${icon('calendar')}</span>`);
    if (verletzt(p)) a.push(`<span class="blick-a rot" title="verletzt">${icon('first-aid-kit')}</span>`);
    const fit = fitnessVon(p);
    if (fit < CFG.ampel.muede) a.push(`<span class="blick-a gelb" title="müde: Fitness ${fit} %">${icon('bolt')}</span>`);
    const s = stimmung(p);
    if (s) a.push(s.chance >= CFG.ampel.gut ? `<span class="blick-a gruen" title="will bleiben (${s.chance} %)">${icon('mood-happy')}</span>`
      : s.chance >= CFG.ampel.mittel ? `<span class="blick-a gelb" title="unentschlossen (${s.chance} %)">${icon('mood-smile')}</span>`
        : `<span class="blick-a rot" title="will weg (${s.chance} %)">${icon('mood-sad')}</span>`);
    return `<span class="blick-ampeln">${a.join('')}</span>`;
  }
  const zeilenId = row => { const m = /showSquadPlayerCard\('([^']+)'\)/.exec(row.getAttribute('onclick') || ''); return m ? m[1] : null; };
  function filterAnwenden(host) {
    const f = FILTER.find(x => x[0] === filterAktiv) || FILTER[0];
    host.querySelectorAll('.sqo-row').forEach(row => {
      const p = SQUAD.find(q => String(q.id) === zeilenId(row));
      row.classList.toggle('blick-aus', !!p && !f[2](p));
    });
    // Abschnitte (Startelf/Bank/Tribüne/Development, D98) ohne sichtbare Zeile ausblenden, „niemand“ nur ohne Filter
    host.querySelectorAll('.kl-kopf').forEach(t => {
      let n = 0;
      for (let e = t.nextElementSibling; e && !e.classList.contains('kl-kopf'); e = e.nextElementSibling) if (e.classList.contains('sqo-row') && !e.classList.contains('blick-aus')) n++;
      t.classList.toggle('blick-aus', filterAktiv !== 'alle' && n === 0);
    });
    host.querySelectorAll('.kl-leer').forEach(e => e.classList.toggle('blick-aus', filterAktiv !== 'alle'));
    const leer = host.querySelector('.blick-leer');
    const sichtbar = host.querySelectorAll('.sqo-row:not(.blick-aus)').length;
    const leerText = filterAktiv === 'stil' ? `${icon('chess-knight')} Niemand passt klar zu deinem Stil.` : `${icon('circle-check')} Niemand – alles gut.`;
    if (!sichtbar && filterAktiv !== 'alle') { if (!leer) host.querySelector('.blick-filter').insertAdjacentHTML('afterend', `<div class="blick-leer">${leerText}</div>`); else leer.innerHTML = leerText; }
    else if (leer) leer.remove();
  }
  function kaderErgaenzen() {
    const host = document.getElementById('sub-squadlist');
    if (!host || !dfl() || typeof SQUAD === 'undefined') return;
    host.querySelectorAll('.sqo-row').forEach(row => {
      if (row.querySelector('.blick-ampeln')) return;
      const p = SQUAD.find(q => String(q.id) === zeilenId(row)); if (!p) return;
      const ovr = row.querySelector('.squad-ovr');
      if (ovr) ovr.insertAdjacentHTML('beforebegin', ampelHtml(p)); else row.insertAdjacentHTML('beforeend', ampelHtml(p));
    });
    if (!host.querySelector('.blick-filter')) {
      const ziel = host.querySelector('.sqo-count') || host.firstElementChild;
      const chips = FILTER.map(([id, t, f]) => { const n = id === 'alle' ? 0 : SQUAD.filter(f).length;
        return `<button type="button" class="blick-chip" data-blick-filter="${id}" aria-pressed="${filterAktiv === id}">${esc(t)}${id === 'alle' ? '' : ` <b>${n}</b>`}</button>`; }).join('');
      const html = `<div class="blick-filter" role="group" aria-label="Filter">${chips}</div>`;
      if (ziel) ziel.insertAdjacentHTML('beforebegin', html); else host.insertAdjacentHTML('afterbegin', html);
      host.querySelector('.blick-filter').addEventListener('click', ev => {
        const b = ev.target.closest('[data-blick-filter]'); if (!b) return;
        filterAktiv = b.getAttribute('data-blick-filter');
        host.querySelectorAll('[data-blick-filter]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        filterAnwenden(host);
      });
    }
    filterAnwenden(host);
  }

  // ── 6 · Karriere-Kompass (Spieler-Blatt, eigene Spieler) ─────────────────
  const klasse = ovr => ovr >= 80 ? 's80' : ovr >= 70 ? 's70' : 'u70';
  const delta = (ovr, alter) => { const k = CFG.kurve[klasse(ovr)]; return k[Math.max(18, Math.min(35, alter))] || 0; };
  function kurve(p) {
    const vorher = [], nachher = [[p.age, p.ovr]];
    let o = p.ovr;
    for (let a = p.age; a > 19; a--) { o -= delta(o, a - 1); vorher.unshift([a - 1, o]); }
    vorher.push([p.age, p.ovr]);
    o = p.ovr;
    for (let a = p.age; a < 35; a++) { o = Math.min(99, o + delta(o, a)); nachher.push([a + 1, o]); }
    return { vorher, nachher };
  }
  function kompassHtml(p) {
    const phase = p.age <= 23 ? ['Im Aufbau', 'trending-up'] : p.age <= 29 ? ['Bestes Alter', 'flame'] : p.age <= 32 ? ['Erfahren', 'shield-check'] : ['Spätphase', 'clock'];
    const { vorher, nachher } = kurve(p);
    const scout = (CLUB.facilities && CLUB.facilities.scouting) || 1;
    const pr = typeof potentialRange === 'function' ? potentialRange(p, scout) : null;   // D103: nur die sichtbare Spanne
    const potLo = pr ? (Array.isArray(pr) ? pr[0] : pr.lo != null ? pr.lo : pr.min) : null, potHi = pr ? (Array.isArray(pr) ? pr[1] : pr.hi != null ? pr.hi : pr.max) : null;
    const werte = vorher.concat(nachher).map(x => x[1]).concat(potHi && p.age <= 27 ? [potHi] : []);
    const lo = Math.floor(Math.min(...werte) - 2), hi = Math.min(100, Math.ceil(Math.max(...werte) + 2));
    const W = 320, H = 132, L = 26, R = 10, T = 10, B = 22;
    const x = a => L + (a - 19) / (35 - 19) * (W - L - R), y = v => T + (hi - v) / Math.max(1, hi - lo) * (H - T - B);
    const pfad = ps => ps.map((q, i) => (i ? 'L' : 'M') + x(q[0]).toFixed(1) + ' ' + y(q[1]).toFixed(1)).join(' ');
    const gitter = [lo + 2, Math.round((lo + hi) / 2), hi - 2].map(v => `<line class="bk-gitter" x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text x="${L - 4}" y="${(y(v) + 3).toFixed(1)}" text-anchor="end">${v}</text>`).join('');
    const achse = [19, 23, 27, 31, 35].map(a => `<text x="${x(a).toFixed(1)}" y="${H - 6}" text-anchor="middle">${a}</text>`).join('');
    const band = potLo != null && potHi != null && p.age <= 27 ? `<rect class="bk-pot" x="${x(p.age).toFixed(1)}" width="${(x(35) - x(p.age)).toFixed(1)}" y="${y(Math.min(hi, potHi)).toFixed(1)}" height="${Math.max(2, y(Math.max(lo, potLo)) - y(Math.min(hi, potHi))).toFixed(1)}"/>` : '';
    const in4 = nachher[Math.min(4, nachher.length - 1)];
    const svg = `<svg class="bk-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Typische Entwicklung: heute ${p.ovr} mit ${p.age}, mit ${in4[0]} etwa ${Math.round(in4[1])}">
      ${gitter}${achse}${band}
      <path class="bk-flaeche" d="${pfad(vorher)} L ${x(p.age).toFixed(1)} ${H - B} L ${x(vorher[0][0]).toFixed(1)} ${H - B} Z"/>
      <path class="bk-pfad" d="${pfad(vorher)}"/><path class="bk-zukunft" d="${pfad(nachher)}"/>
      <circle class="bk-jetzt" cx="${x(p.age).toFixed(1)}" cy="${y(p.ovr).toFixed(1)}" r="6"/>
      ${nachher.length > 4 ? `<text class="bk-wert" x="${x(in4[0]).toFixed(1)}" y="${(y(in4[1]) - 9).toFixed(1)}" text-anchor="middle">mit ${in4[0]} ≈ ${Math.round(in4[1])}</text>` : ''}
    </svg>`;
    const s = stimmung(p), rest = restJahre(p);
    const st = s ? s.chance : null, stKl = st == null ? '' : st >= CFG.ampel.gut ? 'gut' : st >= CFG.ampel.mittel ? 'mittel' : 'schlecht';
    const kurveText = `<div class="bk-klein">So entwickeln sich Spieler seiner Stärke im Schnitt. Gestrichelt: die nächsten Jahre${band ? ', Band: Potenzial laut Scouting' : ''}.</div>`;
    // D111: Entwicklung als Pfeil in 5 Stufen (Ebene 2), die Kurve hinter „Kurve“ (Ebene 3, dfl_ebenen_patch.js);
    // der Vertragstext („Verlängern geht jetzt …“, dfl_saisonwechsel_patch.js) hinter ⓘ am Vertrag
    const E = window.DFLEbenen, pf = E && E.pfeilTeile ? E.pfeilTeile(p) : null;
    const SW = window.DFLSaisonwechsel, vText = SW && SW.vertragHinweis ? SW.vertragHinweis(p) : '';
    let vInfo = '';
    if (vText && typeof window.infoKarteSetzen === 'function' && typeof window.infoBtn === 'function') { window.infoKarteSetzen('blick-vertrag', 'Vertrag', esc(vText)); vInfo = window.infoBtn('blick-vertrag'); }
    const mitte = pf
      ? `<div class="bk-satz">${pf.html}<button class="eb-tiefer klein" type="button" data-eb-auf="kurve" aria-expanded="false">Kurve ${icon('chevron-down')}</button></div>
        <div class="eb-ebene3" data-eb-ziel="kurve" hidden>${svg}${kurveText}${pf.rechnung}</div>`
      : svg + kurveText;
    return `<section class="dfl-kompass" aria-label="Karriere" data-eb-box>
      <div class="bk-kopf"><b>${icon('compass')} ${pf ? 'Karriere' : 'Karriere-Kompass'}</b><span class="bk-phase">${icon(phase[1])}${phase[0]}</span></div>
      ${mitte}
      <div class="bk-zwei">
        <div class="bk-feld"><small>${icon('mood-happy')} Bleibt er?</small><b class="${stKl}">${st != null ? st + ' %' : '–'}</b><span class="bk-mess"><i class="${stKl}" style="width:${st || 0}%"></i></span></div>
        <div class="bk-feld${!p.perspektiv && rest <= 1 ? ' warn' : ''}"><small>${icon('calendar')} Vertrag${vInfo}</small><b>${p.perspektiv ? 'Dev. Squad' : rest <= 1 ? 'läuft aus' : 'noch ' + rest + ' Jahre'}</b>${s && s.teile && s.teile[0] ? `<span>${esc(s.teile[0].text)}</span>` : ''}</div>
      </div>
    </section>`;
  }
  function blattErgaenzen() {
    const box = document.querySelector('#app-blatt .app-blatt-box');
    if (!box || !dfl() || !box.querySelector('.fut-kopf') || box.querySelector('.dfl-kompass')) return;
    const p = SQUAD.find(q => String(q.id) === String(box.dataset.spieler));
    if (!p) return;                                                            // fremde Spieler: kein Kompass
    const ziel = box.querySelector('.app-blatt-aktionen');
    try { if (ziel) ziel.insertAdjacentHTML('beforebegin', kompassHtml(p)); } catch (e) { console.warn('[DFL-Blick] Kompass', e); }
  }

  // ── 7 · Erste Schritte (Office, erste Saison bis Spieltag 1) ─────────────
  function schritte() {
    const z = zustand(), k = K();
    const kaderOk = k ? (k.hauptkader().length <= k.MAX() && k.hauptkader().length >= k.MIN() && k.capBelegt() <= k.capLimit() && !(k.twFehlt && k.twFehlt())) : false;   // D136: 2 Torhüter
    return [
      { key: 'kader', text: 'Kader ansehen', ic: 'users', fertig: !!z.kader, go: () => window.DFLAppShell && DFLAppShell.zeige('squad') },
      // Kader → Taktik (bis 2026-10-11 öffnete der Schritt das Blatt „Stil“ Tag/Nacht statt des Taktik-Stils)
      { key: 'taktik', text: 'Taktik-Stil wählen', ic: 'target-arrow', fertig: !!z.taktik, go: () => {
        if (window.DFLAppShell) DFLAppShell.zeige('squad');
        const b = typeof document !== 'undefined' ? [...document.querySelectorAll('#view-squad .subtab')].find(x => /'tactics'/.test(x.getAttribute('onclick') || '')) : null;
        if (b) b.click(); } },
      { key: 'tickets', text: 'Ticketpreise festlegen', ic: 'ticket', fertig: !!z.tickets, go: () => window.DFLTickets && DFLTickets.blatt() },
      { key: 'kader28', text: `Kader höchstens ${k ? k.MAX() : 28} und unter dem Cap`, ic: 'clipboard-list', fertig: kaderOk, go: () => window.DFLAppShell && DFLAppShell.kaderschnitt ? DFLAppShell.kaderschnitt() : null },
      { key: 'test', text: 'Erstes Testspiel', ic: 'ball-football', fertig: !!z.test || ((LEAGUE && LEAGUE.friendlies) || []).some(f => f.played), go: () => window.DFLAppShell && DFLAppShell.zeige('match') }
    // Lite (D131): Tickets entscheidet bis Saison 2 der Stab – kein Schritt, der sich nicht erledigen lässt (Spieltest 2026-10-14)
    ].filter(s => !(s.key === 'tickets' && window.DFLTutorial && DFLTutorial.gesperrt('verein')));
  }
  const ersteSaison = () => (CLUB.dfl.saisonIndex || 0) === 0 && !(LEAGUE.matchday >= 1);
  let schrittListe = [];
  function officeErgaenzen() {
    const alt = document.getElementById('dfl-erste-schritte'); if (alt) alt.remove();
    if (!dfl() || typeof LEAGUE === 'undefined' || !LEAGUE || !ersteSaison()) return;
    schrittListe = schritte();
    const fertig = schrittListe.filter(s => s.fertig).length;
    if (fertig === schrittListe.length) return;                                  // alles erledigt: Liste verschwindet
    const kopf = document.getElementById('app-office-kopf'), home = document.getElementById('view-home');
    const html = `<section id="dfl-erste-schritte" class="blick-schritte" aria-label="Erste Schritte">
      <div class="bs-kopf"><b>${icon('clipboard-list')} Vor dem 1. Spieltag</b><span>${fertig}/${schrittListe.length}</span></div>
      <div class="bs-fortschritt"><i style="width:${(fertig / schrittListe.length * 100).toFixed(0)}%"></i></div>
      ${schrittListe.map((s, i) => `<button type="button" class="bs-schritt${s.fertig ? ' fertig' : ''}" data-bs="${i}"${s.fertig ? ' aria-disabled="true"' : ''}>
        <span class="bs-haken">${s.fertig ? icon('check') : icon(s.ic)}</span><span>${esc(s.text)}</span>${s.fertig ? '' : icon('chevron-right')}</button>`).join('')}
    </section>`;
    if (kopf) kopf.insertAdjacentHTML('afterend', html); else if (home) home.insertAdjacentHTML('afterbegin', html); else return;
    document.getElementById('dfl-erste-schritte').addEventListener('click', ev => {
      const b = ev.target.closest('[data-bs]'); if (!b) return;
      const s = schrittListe[+b.getAttribute('data-bs')];
      if (s && !s.fertig && s.go) { if (s.key === 'kader') markiere('kader'); try { s.go(); } catch (e) { console.warn('[DFL-Blick] Schritt', e); } }
    });
  }
  function markiere(key) {
    if (!dfl()) return;
    const z = zustand(); if (z[key]) return;
    z[key] = true;
    if (document.getElementById('dfl-erste-schritte')) officeErgaenzen();
  }

  // ── Einhängen ────────────────────────────────────────────────────────────
  {
    const _orig = window.renderHomeTab;
    if (typeof _orig === 'function') window.renderHomeTab = function () {
      const r = _orig.apply(this, arguments);
      try { officeErgaenzen(); } catch (e) { console.warn('[DFL-Blick] Erste Schritte', e); }
      return r;
    };
  }
  {
    const _orig = window.renderSquadOverview;
    if (typeof _orig === 'function') window.renderSquadOverview = function () {
      const r = _orig.apply(this, arguments);
      try { kaderErgaenzen(); } catch (e) { console.warn('[DFL-Blick] Ampeln', e); }
      return r;
    };
  }
  // Testspiel: processFixtureResult leert CURRENT_FIXTURE – an postMatchContinue war es schon null, der Schritt wurde nie
  // abgehakt (Spieltest 2026-10-13); deshalb vor der Auswertung des Spiels merken
  {
    const _orig = window.processFixtureResult;
    if (typeof _orig === 'function') {
      window.processFixtureResult = function () {
        try { if (typeof CURRENT_FIXTURE !== 'undefined' && CURRENT_FIXTURE && CURRENT_FIXTURE.type === 'friendly') markiere('test'); } catch (e) { /* ohne Spiel */ }
        return _orig.apply(this, arguments);
      };
      try { processFixtureResult = window.processFixtureResult; } catch (e) { /* window reicht */ }
    }
  }
  ['setTicketLevel', 'setSeasonTicketLevel'].forEach(fn => {
    const _orig = window[fn];
    if (typeof _orig !== 'function') return;
    window[fn] = function () { markiere('tickets'); return _orig.apply(this, arguments); };
  });
  if (window.DFLTickets && typeof DFLTickets.blatt === 'function') {
    const _orig = DFLTickets.blatt;
    DFLTickets.blatt = function () { markiere('tickets'); return _orig.apply(this, arguments); };
  }
  if (window.DFLTaktik) ['stilSetzen', 'waehle'].forEach(fn => {
    const _orig = DFLTaktik[fn];
    if (typeof _orig !== 'function') return;
    DFLTaktik[fn] = function () { markiere('taktik'); return _orig.apply(this, arguments); };
  });
  // Kader angesehen: jeder Weg in die Kaderansicht (Leiste, Kachel, Reiter am PC) läuft über switchAppView
  {
    const _orig = window.switchAppView;
    if (typeof _orig === 'function') window.switchAppView = function (view) {
      const r = _orig.apply(this, arguments);
      if (view === 'squad') markiere('kader');
      return r;
    };
  }
  // Front Office und Spieler-Blatt: die App-Oberfläche zeichnet intern neu → auf Änderungen achten
  function beobachten() {
    const app = document.querySelector('.app') || document.body;
    const fo = new MutationObserver(() => { try { foErgaenzen(); } catch (e) { console.warn('[DFL-Blick] Cap', e); } });
    const blatt = new MutationObserver(() => { try { blattErgaenzen(); } catch (e) { console.warn('[DFL-Blick] Kompass', e); } });
    let foAn = null, blattAn = null;
    const verbinden = () => {
      const v = document.getElementById('view-fo');
      if (v && v !== foAn) { fo.disconnect(); fo.observe(v, { childList: true }); foAn = v; foErgaenzen(); }
      const b = document.querySelector('#app-blatt .app-blatt-box');
      if (b && b !== blattAn) { blatt.disconnect(); blatt.observe(b, { childList: true }); blattAn = b; blattErgaenzen(); }
    };
    new MutationObserver(verbinden).observe(app, { childList: true });
    new MutationObserver(verbinden).observe(document.body, { childList: true });
    verbinden();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', beobachten); else beobachten();
  // Spielstand beim Seitenstart: Office und Kaderliste sind schon gezeichnet
  try { if (dfl() && typeof LEAGUE !== 'undefined' && LEAGUE) { officeErgaenzen(); kaderErgaenzen(); } } catch (e) { /* ohne Spielstand */ }

  window.DFLBlick = { CFG, FILTER, capDaten, kurve, stimmung, schritte, markiere, kompassHtml, ampelHtml, filterSetzen, filterAktiv: () => filterAktiv };
  console.log('[DFL-Blick v1] aktiv — Cap nach Positionen, Kader-Ampeln mit Filter, Karriere-Kompass, Erste Schritte (D62 · 4–7)');
})();
