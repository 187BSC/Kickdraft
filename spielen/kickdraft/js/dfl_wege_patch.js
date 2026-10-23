/* ═══════════════════════════════════════════════════════════════════════════
   DFL · KURZE WEGE  ·  v1  (D121, freigegeben 2026-10-13)
   ─────────────────────────────────────────────────────────────────────────
   Nutzer: „Reiter nach Häufigkeit … möglichst wenig Zeit mit sinnlosem Scrollen“.
     · Front Office: Cap-Zeile, große Kachel nach Phase, feste Kacheln, Zeilen
       (in dfl_app_shell.js: foHtml/foPhase)
     · Verein: drei Reiter Anlagen · Geld · Eigentümer (Anlagen mit den bisherigen
       Karten, darf scrollen); „Spiel neu starten“ steht in Mehr → Einstellungen,
       die Chronik in der Ehrenhalle
     · Kader: alle fünf Reiter in einer Zeile („Verträge“ statt „Verträge & Cap“)
     · Liga: Tabelle · Spieltag · Spielplan · Torjäger · Statistik vorn, danach der
       Rest; in den Playoffs „Playoffs“ ganz vorn (nichts versteckt)
     · Transfer: in den Free-Agency-Wochen Free Agency vorn, sonst Trades; Historie
       und Wertliste stehen in der Trade-Zentrale (Filter oben)
     · Nutzung nur lokal zählen (localStorage 'dfl-ansichten'): je Ansicht und Reiter
       ein Zähler, dazu Sitzungen und Spieltage – kein Netz, keine persönlichen Daten.
       DFLNutzung.daten() / .bericht() für das Test-Kit (dfl_testkit.js liest .bericht()).
   API: DFLNutzung · DFLWege.vereinReiter(name) · .ligaOrdnen() · .transferOrdnen()
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const dfl = () => typeof CLUB !== 'undefined' && CLUB && CLUB.dfl && CLUB.dfl.aktiv && typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.dfl;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ── Nutzung (nur lokal) ────────────────────────────────────────────────────
  const K = 'dfl-ansichten';
  const lies = () => { try { const v = localStorage.getItem(K); const o = v ? JSON.parse(v) : null; return o && typeof o === 'object' ? o : null; } catch (e) { return null; } };
  const schreib = o => { try { localStorage.setItem(K, JSON.stringify(o)); } catch (e) { /* voller oder gesperrter Speicher */ } };
  let daten = lies() || { v: 1, seit: new Date().toISOString().slice(0, 10), sitzungen: 0, spieltage: 0, z: {} };
  daten.z = daten.z || {};
  daten.sitzungen = (daten.sitzungen || 0) + 1;
  schreib(daten);
  const simLaeuft = () => !!(window.DFLSimulieren && typeof DFLSimulieren.aktiv === 'function' && DFLSimulieren.aktiv());
  function zaehle(key) {
    if (!key || simLaeuft()) return;
    daten.z[key] = (daten.z[key] || 0) + 1;
    schreib(daten);
  }
  window.DFLNutzung = {
    zaehle,
    daten: () => JSON.parse(JSON.stringify(daten)),
    // Eine Zeile für „Feedback senden“: die häufigsten Ansichten zuerst
    bericht() {
      const top = Object.entries(daten.z).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, n]) => `${k} ${n}`).join(', ');
      return `Ansichten (seit ${daten.seit}, ${daten.sitzungen} Sitzungen, ${daten.spieltage} Spieltage): ${top || '–'}`;
    },
    leeren() { daten = { v: 1, seit: new Date().toISOString().slice(0, 10), sitzungen: 0, spieltage: 0, z: {} }; schreib(daten); }
  };
  // Ansichten (App-Leiste), Reiter, Blätter
  {
    const _orig = window.switchAppView;
    if (typeof _orig === 'function') {
      window.switchAppView = function (view) {
        const r = _orig.apply(this, arguments);
        try { if (dfl()) { zaehle('ansicht:' + view); nachAnsicht(view); } } catch (e) { /* Zählen optional */ }
        return r;
      };
      try { switchAppView = window.switchAppView; } catch (e) { /* nur im Spiel */ }
    }
  }
  [['switchSubview', 'kader'], ['switchLigaSubview', 'liga'], ['switchTransferSubview', 'transfer']].forEach(([fn, bereich]) => {
    const _orig = window[fn];
    if (typeof _orig !== 'function') return;
    window[fn] = function (name) {
      const r = _orig.apply(this, arguments);
      try { if (dfl()) zaehle(bereich + ':' + name); } catch (e) { /* Zählen optional */ }
      try { if (bereich === 'liga' && name === 'ehren') chronikInEhrenhalle(); } catch (e) { console.warn('[DFL-Wege] Chronik', e); }
      return r;
    };
  });
  if (window.DFLAppShell && typeof DFLAppShell.foZeigen === 'function') {
    const _orig = DFLAppShell.foZeigen;
    DFLAppShell.foZeigen = function () { const r = _orig.apply(this, arguments); try { if (dfl()) zaehle('ansicht:fo'); } catch (e) { /* optional */ } return r; };
  }
  if (typeof document !== 'undefined' && document.addEventListener) {
    // Front Office-Kacheln/Zeilen und Blätter (Trainerteam, Kandidaten, Anlagen)
    document.addEventListener('click', ev => {
      try {
        if (!dfl() || !ev.target || !ev.target.closest) return;
        const k = ev.target.closest('#view-fo [data-go]');
        if (k) zaehle('fo:' + k.getAttribute('data-go'));
        const sc = ev.target.closest('#dfl-scouting [data-sc^="seg:"], #dfl-scouting [data-sc^="filt:"]');
        if (sc) zaehle('scouting:' + sc.getAttribute('data-sc').split(':')[1]);
        const vt = ev.target.closest('.vt-reiter [data-vt]');
        if (vt) zaehle('verein:' + vt.getAttribute('data-vt'));
      } catch (e) { /* Zählen optional */ }
    }, true);
  }
  {
    const _orig = window.advanceCalendarWeek;
    if (typeof _orig === 'function') {
      window.advanceCalendarWeek = function () {
        const md = typeof LEAGUE !== 'undefined' && LEAGUE ? LEAGUE.matchday : null;
        const r = _orig.apply(this, arguments);
        try { if (dfl() && LEAGUE.matchday !== md) { daten.spieltage = (daten.spieltage || 0) + 1; schreib(daten); } } catch (e) { /* optional */ }
        try { if (dfl()) transferOrdnen(); } catch (e) { /* optional */ }
        return r;
      };
      try { advanceCalendarWeek = window.advanceCalendarWeek; } catch (e) { /* nur im Spiel */ }
    }
  }

  function nachAnsicht(view) {
    if (view === 'liga') ligaOrdnen();
    else if (view === 'transfer') transferOrdnen();
    else if (view === 'club') vereinReiter();
  }

  // ── Liga: Reihenfolge, Playoffs vorn ──────────────────────────────────────
  const LIGA_REIHE = ['tabelle', 'spieltag', 'spielplan', 'torjaeger', 'statistik', 'lage', 'pyramide', 'ehren', 'pokal'];
  function playoffsLaufen() {
    const w = LEAGUE.matchWeeks || [];
    const po = LEAGUE.dflPlayoffs;
    return !!(po && (LEAGUE.matchday || 0) >= (w.length || 26) && !po.meister);
  }
  function ligaOrdnen() {
    const leiste = document.querySelector('#view-liga .subtabs'); if (!leiste) return;
    const knoepfe = [...leiste.querySelectorAll('.subtab')];
    const key = b => { const m = /'([a-z]+)'/.exec(b.getAttribute('onclick') || ''); return m ? m[1] : (/Playoffs/.test(b.textContent) ? 'playoffs' : b.textContent.trim().toLowerCase()); };
    const vorn = playoffsLaufen() ? ['pokal', 'playoffs'] : [];
    const rang = b => { const k = key(b); const v = vorn.indexOf(k); if (v >= 0) return -10 + v; const i = LIGA_REIHE.indexOf(k); return i >= 0 ? i : 50; };
    const sortiert = knoepfe.slice().sort((a, b) => rang(a) - rang(b));
    if (sortiert.some((b, i) => b !== knoepfe[i])) sortiert.forEach(b => leiste.appendChild(b));
  }
  {
    const _orig = window.renderLeagueTab;
    if (typeof _orig === 'function') {
      window.renderLeagueTab = function () { const r = _orig.apply(this, arguments); try { if (dfl()) ligaOrdnen(); } catch (e) { /* optional */ } return r; };
      try { renderLeagueTab = window.renderLeagueTab; } catch (e) { /* nur im Spiel */ }
    }
  }
  // Chronik in der Ehrenhalle (vorher im Verein)
  function chronikInEhrenhalle() {
    const el = document.getElementById('lg-sub-ehren'); if (!el || !dfl()) return;
    const alt = el.querySelector('.wg-chronik'); if (alt) alt.remove();
    const rows = Array.isArray(CLUB.chronicle) ? CLUB.chronicle.slice().reverse() : [];
    const zeilen = rows.length ? rows.slice(0, 12).map(e => `<tr><td>${esc(e.label)}</td><td class="num">${e.pos ? e.pos + '.' : '–'}</td><td class="num">${e.pts != null ? e.pts : ''}</td><td class="num">${e.gf != null ? e.gf + ':' + e.ga : ''}</td></tr>`).join('')
      : '<tr><td colspan="4">Noch keine abgeschlossene Saison.</td></tr>';
    el.insertAdjacentHTML('beforeend', `<section class="wg-chronik"><h4 class="news-header"><i class="ti ti-history" aria-hidden="true"></i> Chronik</h4>
      <table class="lg-table dfl-tabelle"><thead><tr><th>Saison</th><th class="num">Platz</th><th class="num">Pkt</th><th class="num">Tore</th></tr></thead><tbody>${zeilen}</tbody></table></section>`);
  }

  // ── Transfer: Reihenfolge nach Phase, Historie und Wertliste in die Trade-Zentrale ──
  const faWochen = () => (LEAGUE.matchday || 0) === 0 && (LEAGUE.week || 1) >= 1 && (LEAGUE.week || 1) <= 5;
  function transferOrdnen() {
    const leiste = document.querySelector('#view-transfer .subtabs'); if (!leiste) return;
    const knopf = name => [...leiste.querySelectorAll('.subtab')].find(b => (b.getAttribute('onclick') || '').indexOf("'" + name + "'") >= 0);
    const fa = knopf('frei'), tr = knopf('trades'), hi = knopf('historie'), we = knopf('werte');
    if (hi) hi.setAttribute('data-vt-aus', '1');
    if (we) we.setAttribute('data-vt-aus', '1');
    if (fa && tr) {
      const erst = faWochen() ? fa : tr, zweit = erst === fa ? tr : fa;
      if (leiste.firstElementChild !== erst) leiste.insertBefore(erst, leiste.firstElementChild);
      if (erst.nextElementSibling !== zweit) leiste.insertBefore(zweit, erst.nextElementSibling);
      // Beim Öffnen des Transfers: der erste Reiter ist aktiv (sonst bleibt der alte Standard „Free Agency“)
      const aktiv = leiste.querySelector('.subtab.active');
      if (!aktiv || aktiv.hasAttribute('data-vt-aus')) erst.click();
    }
    tradeFilter();
  }
  // Filter oben in der Trade-Zentrale: Tausch · Wertliste · Historie (Wertliste/Historie zeigen ihre bisherigen Ansichten)
  function tradeFilter() {
    const sub = { trades: document.getElementById('tr-sub-trades'), werte: document.getElementById('tr-sub-werte'), historie: document.getElementById('tr-sub-historie') };
    Object.keys(sub).forEach(k => {
      const el = sub[k]; if (!el || el.querySelector(':scope > .tz-wege')) return;
      el.insertAdjacentHTML('afterbegin', `<div class="tz-wege sc-chips-reihe" role="group" aria-label="Trade-Zentrale">${[['trades', 'Tausch', 'arrows-left-right'], ['werte', 'Wertliste', 'list-numbers'], ['historie', 'Historie', 'history']]
        .map(([n, t, ic]) => `<button type="button" class="sc-chip" data-tz-wege="${n}" aria-pressed="${n === k}"><i class="ti ti-${ic}" aria-hidden="true"></i>${t}</button>`).join('')}</div>`);
    });
  }
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('click', ev => {
      const b = ev.target && ev.target.closest && ev.target.closest('[data-tz-wege]');
      if (!b || !dfl()) return;
      ev.preventDefault();
      const name = b.getAttribute('data-tz-wege');
      const leiste = document.querySelector('#view-transfer .subtabs');
      const knopf = leiste && [...leiste.querySelectorAll('.subtab')].find(x => (x.getAttribute('onclick') || '').indexOf("'" + name + "'") >= 0);
      if (typeof window.switchTransferSubview === 'function') window.switchTransferSubview(name, knopf || null);
      // der sichtbare Reiter bleibt „Trades“
      const tr = leiste && [...leiste.querySelectorAll('.subtab')].find(x => (x.getAttribute('onclick') || '').indexOf("'trades'") >= 0);
      if (tr) { leiste.querySelectorAll('.subtab').forEach(x => x.classList.remove('active')); tr.classList.add('active'); }
      tradeFilter();
      document.querySelectorAll('[data-tz-wege]').forEach(x => x.setAttribute('aria-pressed', String(x.getAttribute('data-tz-wege') === name)));
    });
  }
  {
    const _orig = window.renderTransferTab;
    if (typeof _orig === 'function') {
      window.renderTransferTab = function () { const r = _orig.apply(this, arguments); try { if (dfl()) { transferOrdnen(); } } catch (e) { console.warn('[DFL-Wege] Transfer', e); } return r; };
      try { renderTransferTab = window.renderTransferTab; } catch (e) { /* nur im Spiel */ }
    }
  }
  // die Trade-Zentrale zeichnet ihren Inhalt neu → Filter wieder einsetzen
  if (window.DFLTrade && typeof DFLTrade.zeichne === 'function') {
    const _orig = DFLTrade.zeichne;
    DFLTrade.zeichne = function () { const r = _orig.apply(this, arguments); try { if (dfl()) tradeFilter(); } catch (e) { /* optional */ } return r; };
  }
  if (typeof MutationObserver === 'function' && typeof document !== 'undefined') {
    const beobachten = () => {
      const v = document.getElementById('view-transfer'); if (!v) return;
      new MutationObserver(() => { try { if (dfl()) tradeFilter(); } catch (e) { /* optional */ } }).observe(v, { childList: true, subtree: false });
      ['tr-sub-trades', 'tr-sub-werte', 'tr-sub-historie'].forEach(id => {
        const el = document.getElementById(id);
        if (el) new MutationObserver(() => { try { if (dfl() && !el.querySelector(':scope > .tz-wege')) tradeFilter(); } catch (e) { /* optional */ } }).observe(el, { childList: true });
      });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', beobachten); else { try { beobachten(); } catch (e) { /* ohne DOM */ } }
  }

  // ── Verein: drei Reiter ────────────────────────────────────────────────────
  let vereinAktiv = 'anlagen';
  function vereinTeile() {
    const view = document.getElementById('view-club'); if (!view) return null;
    const wrap = view.querySelector('.club-wrap') || view;
    return {
      view, wrap,
      anlagen: [document.getElementById('club-facilities')],
      geld: [document.getElementById('finance-dash'), wrap.querySelector('.sponsor-section'), document.getElementById('kt-trikots')],   // Trikots zu den Sponsoren (Nutzer 2026-10-22: standen in jedem Reiter, auch beim Eigentümer)
      eigner: [document.getElementById('exp-panel')],
      weg: [document.getElementById('club-danger-zone'), view.querySelector(':scope > .club-chronicle')]
    };
  }
  function vereinReiter(name) {
    if (!dfl()) return;
    if (name) vereinAktiv = name;
    const T = vereinTeile(); if (!T) return;
    let leiste = T.wrap.querySelector('.vt-reiter');
    if (!leiste) {
      const banner = document.getElementById('club-banner');
      const html = `<div class="vt-reiter" role="tablist" aria-label="Verein">${[['anlagen', 'Anlagen'], ['geld', 'Geld'], ['eigner', 'Eigentümer']]
        .map(([k, t]) => `<button type="button" role="tab" data-vt="${k}">${t}</button>`).join('')}</div>`;
      if (banner) banner.insertAdjacentHTML('afterend', html); else T.wrap.insertAdjacentHTML('afterbegin', html);
      leiste = T.wrap.querySelector('.vt-reiter');
      leiste.addEventListener('click', ev => { const b = ev.target.closest('[data-vt]'); if (b) { vereinReiter(b.getAttribute('data-vt')); window.scrollTo(0, 0); } });
    }
    leiste.querySelectorAll('[data-vt]').forEach(b => { const an = b.getAttribute('data-vt') === vereinAktiv; b.classList.toggle('an', an); b.setAttribute('aria-selected', String(an)); });
    ['anlagen', 'geld', 'eigner'].forEach(k => T[k].forEach(el => { if (el) { if (k === vereinAktiv) el.removeAttribute('data-vt-aus'); else el.setAttribute('data-vt-aus', '1'); } }));
    T.weg.forEach(el => { if (el) el.setAttribute('data-vt-aus', '1'); });
  }
  {
    const _orig = window.renderClubTab;
    if (typeof _orig === 'function') {
      window.renderClubTab = function () { const r = _orig.apply(this, arguments); try { vereinReiter(); } catch (e) { console.warn('[DFL-Wege] Verein', e); } return r; };
      try { renderClubTab = window.renderClubTab; } catch (e) { /* nur im Spiel */ }
    }
  }

  window.DFLWege = { vereinReiter, ligaOrdnen, transferOrdnen, tradeFilter, chronikInEhrenhalle, playoffsLaufen };
  console.log('[DFL-Wege v1] aktiv — Front Office nach Phase, Verein in drei Reitern, Reiter in einer Zeile, Transfer nach Phase, Nutzung nur lokal (D121)');
})();
