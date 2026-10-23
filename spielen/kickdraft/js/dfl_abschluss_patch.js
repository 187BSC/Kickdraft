/* ═══════════════════════════════════════════════════════════════════════════
   DFL · SAISONABSCHLUSS  ·  v1   (Rückmeldung 17.10., Nutzer: „einen Saisonabschluss mit Statistik aller Spieler – Spiele, Tore,
   Vorlagen, Notenschnitt. Welchen Platz man erreicht hat, wie viel überperformt. Tore und Gegentore insgesamt und genauso xG und
   xG against, Ballbesitz … nach dem Finale einmal gezeigt, und die Vorbereitung für die neue Saison kann starten. Vielleicht
   ein paar Wochen Laufzeit, sodass man sich nochmal kurz seinen Kader anschauen kann, bevor es in den Draft geht“)
   ─────────────────────────────────────────────────────────────────────────
   · Mitschrift je eigenem Pflichtspiel (Liga und Playoffs) aus der Engine (MatchEngineV3.simulateMatch, eigener Verein = home):
     xG, xG gegen, Ballbesitz, Schüsse → LEAGUE.dflSaisonStat { saison, spiele, xg, xga, besitz, sch, schG }.
   · Erwartung: Rang der Kaderstärke unter den 32 Vereinen beim ersten Spieltag (CLUB.dfl.erwartung { saison, rang }).
   · Blatt „Saisonabschluss“ einmal je Saison, sobald der Meister feststeht und das Office frei ist: Platz in der Liga und in der
     Conference, Playoff-Runde, Erwartung → über/unter Erwartung, Tore/Gegentore, xG/xGA, Ballbesitz, Bilanz; Tabelle aller eigenen
     Spieler mit Spielen, Toren, Vorlagen, Notenschnitt (Liga, aus LEAGUE.dflStat und den Spielnoten). „Zur Saisonvorbereitung“.
   · Off-Season: nach dem Finale noch CFG.pause Wochen (Training, Reha, Scouting laufen), erst dann „Saison abschließen“ (Draft).
   Tests (navigator.webdriver) sehen das Blatt nur mit localStorage „dw-test“ = an. API: DFLAbschluss.zeige() · .daten() · .pauseRest()
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const D = window.DFLSpiel, G = window.DFLGenerator, I = window.DFLIdentitaet;
  if (!D || !G) { console.warn('[DFL-Abschluss] DFL-Module fehlen – Patch inaktiv'); return; }
  const CFG = { pause: 3 };
  const dfl = () => typeof CLUB !== 'undefined' && CLUB && CLUB.dfl && CLUB.dfl.aktiv && typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.dfl;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const komma = (x, n) => Number(x || 0).toLocaleString('de-DE', { minimumFractionDigits: n == null ? 1 : n, maximumFractionDigits: n == null ? 1 : n });
  const RUNDE = { 0: 'Playoffs verpasst', 1: 'Wildcard-Runde', 2: 'Divisional-Runde', 3: 'Conference-Finale', 4: 'Finale verloren', 5: 'Meister' };

  // ── Mitschrift aus der Engine ────────────────────────────────────────────
  function stat() {
    let s = LEAGUE.dflSaisonStat;
    if (!s || s.saison !== LEAGUE.season) s = LEAGUE.dflSaisonStat = { saison: LEAGUE.season, spiele: 0, xg: 0, xga: 0, besitz: 0, sch: 0, schG: 0 };
    return s;
  }
  {
    const E = window.MatchEngineV3;
    if (E && typeof E.simulateMatch === 'function') {
      const _orig = E.simulateMatch;
      E.simulateMatch = function (heim, gast, opt) {
        const res = _orig.apply(this, arguments);
        try {
          const fx = typeof CURRENT_FIXTURE !== 'undefined' ? CURRENT_FIXTURE : null;
          if (dfl() && opt && opt.record && fx && fx.type !== 'friendly' && res && res.stats && res.fertig !== false) {
            const h = res.stats.home || {}, g = res.stats.away || {}, s = stat();
            s.spiele++; s.xg += h.xg || 0; s.xga += g.xg || 0; s.sch += h.shots || 0; s.schG += g.shots || 0;
            s.besitz += h.possPct != null ? h.possPct : (h.poss != null && g.poss != null && (h.poss + g.poss) > 0 ? 100 * h.poss / (h.poss + g.poss) : 50);
          }
        } catch (e) { console.warn('[DFL-Abschluss] Mitschrift', e); }
        return res;
      };
    }
  }
  // ── Erwartung: Rang der Kaderstärke beim ersten Spieltag ────────────────
  function staerkeRang() {
    const L = D.liga(), eig = D.eigeneDflId();
    const liste = L.teams.map(t => ({ id: t.id, s: G.teamOvr(t) })).sort((a, b) => b.s - a.s);
    return liste.findIndex(x => x.id === eig) + 1;
  }
  function erwartung() {
    const e = CLUB.dfl.erwartung;
    if (e && e.saison === LEAGUE.season) return e.rang;
    if ((LEAGUE.matchday || 0) <= 2) { CLUB.dfl.erwartung = { saison: LEAGUE.season, rang: staerkeRang() }; return CLUB.dfl.erwartung.rang; }
    return null;
  }
  {
    const _orig = window.advanceMatchday;
    if (typeof _orig === 'function') {
      window.advanceMatchday = function () {
        try { if (dfl()) erwartung(); } catch (e) { /* optional */ }
        return _orig.apply(this, arguments);
      };
      try { advanceMatchday = window.advanceMatchday; } catch (e) { /* nur im Spiel */ }
    }
  }

  // ── Daten des Blatts ─────────────────────────────────────────────────────
  function po() { try { return window.DFLPlayoffs && DFLPlayoffs.stand ? DFLPlayoffs.stand() : null; } catch (e) { return null; } }
  function daten() {
    const teams = findFcmGroup(LEAGUE).group.teams.slice().sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
    const me = teams.find(t => t.id === 'fcm'), platz = teams.indexOf(me) + 1;
    let seed = null;
    try { const sl = D.setzliste(me.conference), reihe = sl.sieger.concat(sl.wild, sl.draussen); seed = reihe.findIndex(x => x.id === 'fcm') + 1; } catch (e) { seed = null; }
    const P = po(), runde = P ? (P.ausgeschieden && 'fcm' in P.ausgeschieden ? P.ausgeschieden.fcm : 0) : 0;
    const dabei = P && P.setzliste && Object.values(P.setzliste).some(l => (l || []).indexOf('fcm') >= 0);
    const e = (CLUB.dfl.erwartung && CLUB.dfl.erwartung.saison === LEAGUE.season) ? CLUB.dfl.erwartung.rang : null;
    const s = stat();
    // Spieler: Liga-Statistik der Welt (eigen: [Tore, Vorlagen, Spiele]) + Notenschnitt aus den Spielnoten der Saison
    const L = D.liga(), rec = LEAGUE.dflStat && LEAGUE.dflStat[L.saisonJahr], eigen = (rec && rec.eigen) || {};
    const spieler = (typeof SQUAD !== 'undefined' ? SQUAD : []).map(q => {
      const a = eigen[q.dflId || q.id] || [0, 0, 0], l = q.matchRatings && q.matchRatings.season === LEAGUE.season ? q.matchRatings.list : [];
      return { q, sp: a[2], tore: a[0], vorlagen: a[1], note: l.length ? l.reduce((x, y) => x + y, 0) / l.length : null };
    }).filter(x => x.sp > 0).sort((a, b) => b.sp - a.sp || b.tore - a.tore);
    return { platz, seed, konf: me.conference, runde: dabei ? (runde || 5) : 0, erwartung: e, plus: e ? e - platz : null,
      tore: me.gf, gegen: me.ga, bilanz: [me.w || 0, me.d || 0, me.l || 0], pts: me.pts, s, spieler, meister: P && P.meister };
  }

  // ── Blatt ────────────────────────────────────────────────────────────────
  const offenesFenster = () => [...document.querySelectorAll('body > *')].some(el => {
    if (el.id === 'dab-ov') return false;
    const cs = getComputedStyle(el);
    return cs.position === 'fixed' && cs.display !== 'none' && cs.visibility !== 'hidden' && cs.pointerEvents !== 'none' && +cs.opacity > 0.05 && +cs.zIndex >= 50 && el.getClientRects().length && el.offsetHeight > 150;
  });
  function faellig() {
    const P = po();
    return dfl() && P && P.meister && P.saison === LEAGUE.season && !((CLUB.dfl.abschluss || {})[LEAGUE.season]);
  }
  function zeige(erzwingen) {
    if (!erzwingen && (!faellig() || document.getElementById('dab-ov') || offenesFenster())) return false;
    try { if (!erzwingen && navigator.webdriver && localStorage.getItem('dw-test') !== 'an') return false; } catch (e) { /* ohne Speicher */ }
    if (window.DFLSimulieren && DFLSimulieren.laeuft && DFLSimulieren.laeuft()) return false;
    const d = daten(), s = d.s, n = Math.max(1, s.spiele);
    const meisterName = d.meister ? ((findFcmGroup(LEAGUE).group.teams.find(t => t.id === d.meister) || {}).name || '') : '';
    let wappen = '';
    try { wappen = I ? I.wappenSvg({ id: D.eigeneDflId() }, { groesse: 72 }) : ''; } catch (e) { wappen = ''; }
    const plusText = d.plus == null ? '' : d.plus > 0 ? `<b class="gut">+${d.plus}</b> Plätze besser als erwartet` : d.plus < 0 ? `<b class="schlecht">${d.plus}</b> Plätze unter der Erwartung` : 'genau wie erwartet';
    const kachel = (wert, lab, kl) => `<div class="dab-k${kl ? ' ' + kl : ''}"><b>${wert}</b><small>${lab}</small></div>`;
    const zeile = x => `<tr><td>${esc((x.q.firstName ? x.q.firstName[0] + '. ' : '') + x.q.name)}</td><td>${esc(x.q.pos === 'OM' ? 'ZOM' : x.q.pos)}</td>
      <td>${x.sp}</td><td>${x.tore}</td><td>${x.vorlagen}</td><td>${x.note != null ? komma(x.note) : '–'}</td></tr>`;
    const ov = document.createElement('div');
    ov.id = 'dab-ov';
    // Nutzer 2026-10-22: überflüssiger Text raus („Schau dir deinen Kader an, verlängere Verträge und lass deine Scouts arbeiten.“)
    ov.innerHTML = `<div class="dab-box" role="dialog" aria-modal="true" aria-label="Saisonabschluss">
      <div class="dab-kopf"><span class="dab-wappen">${wappen}</span><div><small>Saisonabschluss ${typeof seasonYearLabel === 'function' ? esc(seasonYearLabel(LEAGUE.season)) : ''}</small>
        <h2>${esc(RUNDE[d.runde] || '')}</h2><p>${meisterName ? 'Meister: ' + esc(meisterName) : ''}</p></div></div>
      <div class="dab-gitter">
        ${kachel(d.platz + '.', 'Platz in der Liga')}${kachel(d.seed ? d.seed + '.' : '–', 'in der Conference')}
        ${kachel(d.erwartung ? d.erwartung + '.' : '–', 'erwartet (Kaderstärke)')}${kachel(d.plus == null ? '–' : (d.plus > 0 ? '+' : '') + d.plus, 'gegen Erwartung', d.plus > 0 ? 'gut' : d.plus < 0 ? 'schlecht' : '')}
      </div>
      ${plusText ? `<p class="dab-satz">${plusText}.</p>` : ''}
      <div class="dab-gitter">
        ${kachel(d.tore, 'Tore')}${kachel(d.gegen, 'Gegentore')}${kachel(komma(s.xg), 'xG')}${kachel(komma(s.xga), 'xG gegen')}
        ${kachel(Math.round(s.besitz / n) + ' %', 'Ballbesitz')}${kachel(d.bilanz.join('-'), 'S-U-N')}${kachel(d.pts, 'Punkte')}${kachel(s.spiele, 'Pflichtspiele')}
      </div>
      <h3>Deine Spieler</h3>
      <div class="dab-tab"><table><thead><tr><th>Spieler</th><th>Pos</th><th>Sp</th><th>T</th><th>V</th><th>Note</th></tr></thead><tbody>${d.spieler.map(zeile).join('')}</tbody></table></div>
      <p class="dab-pause">Jetzt beginnt die Off-Season: noch ${CFG.pause} Wochen bis zum Draft.</p>
      <div class="dab-knoepfe"><button type="button" class="dab-zu">Schließen</button><button type="button" class="dab-sv">Zur Saisonvorbereitung</button></div></div>`;
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('auf'));
    const fertig = () => { CLUB.dfl.abschluss = Object.assign({}, CLUB.dfl.abschluss || {}, { [LEAGUE.season]: true }); ov.remove(); if (typeof saveGameState === 'function') saveGameState(); };
    ov.querySelector('.dab-zu').addEventListener('click', fertig);
    ov.querySelector('.dab-sv').addEventListener('click', () => { fertig(); try { if (window.DFLSaisonwechsel && DFLSaisonwechsel.zeigen) DFLSaisonwechsel.zeigen(); } catch (e) { /* optional */ } });
    return true;
  }
  {
    const _rh = window.renderHomeTab;
    if (typeof _rh === 'function') {
      window.renderHomeTab = function () { const r = _rh.apply(this, arguments); setTimeout(() => { try { zeige(); } catch (e) { /* optional */ } }, 900); return r; };
      try { renderHomeTab = window.renderHomeTab; } catch (e) { /* nur im Spiel */ }
    }
  }

  // ── Off-Season: noch CFG.pause Wochen nach dem Finale ───────────────────
  function pauseRest() {
    if (!dfl()) return 0;
    const P = po(); if (!P || !P.meister || P.saison !== LEAGUE.season) return 0;
    let w = [];
    try { w = DFLPlayoffs.wochen() || []; } catch (e) { w = []; }
    const finale = w.length ? w[w.length - 1] : LEAGUE.week;
    const ende = Math.min((typeof SEASON_WEEKS === 'number' ? SEASON_WEEKS : 52) - 1, finale + CFG.pause);
    return Math.max(0, ende - LEAGUE.week);
  }
  {
    const _orig = window.nextWeek;
    if (typeof _orig === 'function') {
      window.nextWeek = function () {
        if (pauseRest() > 0 && typeof advanceCalendarWeek === 'function') {
          const ok = advanceCalendarWeek();
          if (ok !== false) {
            const r = pauseRest();
            try { addNews('season', 'Off-Season', r ? `Noch ${r === 1 ? 'eine Woche' : r + ' Wochen'} bis zum Draft. Training, Reha und Scouting laufen weiter.` : 'Die Off-Season ist vorbei – schließe die Saison ab, dann geht es in den Draft.'); } catch (e) { /* optional */ }
            ['renderHomeTab', 'renderSquadOverview'].forEach(f => { try { if (typeof window[f] === 'function') window[f](); } catch (e) { /* optional */ } });
            return;
          }
        }
        return _orig.apply(this, arguments);
      };
      try { nextWeek = window.nextWeek; } catch (e) { /* nur im Spiel */ }
    }
  }

  const CSS = `
  #dab-ov{position:fixed;inset:0;z-index:9800;display:grid;place-items:center;padding:12px;background:rgb(8 10 18/.72);opacity:0;transition:opacity .25s}
  #dab-ov.auf{opacity:1}
  .dab-box{width:min(420px,100%);max-height:100%;overflow:auto;background:var(--bg2,#fffaf0);color:var(--text,#2b2a26);border-radius:20px;padding:16px;display:grid;gap:12px;
    border:3px solid var(--k-gold,#e0a526);box-shadow:0 8px 0 rgb(0 0 0/.25)}
  .dab-kopf{display:flex;gap:12px;align-items:center}.dab-wappen{flex:none;width:64px}.dab-wappen svg{width:100%;height:auto;display:block}
  .dab-kopf small{font-size:12px;font-weight:700;opacity:.7}.dab-kopf h2{margin:0;font:800 24px/1.1 var(--font-display,system-ui)}.dab-kopf p{margin:2px 0 0;font-size:13px;opacity:.8}
  .dab-gitter{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
  .dab-k{background:var(--bg3,#efe2c8);border-radius:12px;padding:8px 4px;text-align:center}.dab-k b{display:block;font:800 19px var(--font-zahl,system-ui)}.dab-k small{font-size:10.5px;opacity:.75;line-height:1.15;display:block}
  .dab-k.gut b,.dab-satz .gut{color:var(--app-gut,#25a95c)}.dab-k.schlecht b,.dab-satz .schlecht{color:var(--app-schlecht,#c8463a)}
  .dab-satz{margin:-4px 0 0;font-size:14px;text-align:center}
  .dab-box h3{margin:4px 0 0;font:700 16px var(--font-display,system-ui)}
  .dab-tab{max-height:260px;overflow:auto;border-radius:12px;border:2px solid var(--k-linie,#d9c29a)}
  .dab-tab table{width:100%;border-collapse:collapse;font-size:13px;font-variant-numeric:tabular-nums}
  .dab-tab th,.dab-tab td{padding:5px 6px;text-align:right;border-bottom:1px solid var(--k-linie,#e6d6b8)}.dab-tab th:first-child,.dab-tab td:first-child,.dab-tab th:nth-child(2),.dab-tab td:nth-child(2){text-align:left}
  .dab-tab thead th{position:sticky;top:0;background:var(--bg3,#efe2c8)}
  .dab-pause{margin:0;font-size:13.5px;line-height:1.4;background:var(--bg3,#efe2c8);border-radius:12px;padding:10px}
  .dab-knoepfe{display:flex;gap:8px;justify-content:flex-end}
  .dab-knoepfe button{font:700 15px var(--font-display,system-ui);padding:10px 14px;border-radius:12px;border:0;cursor:pointer}
  .dab-zu{background:var(--bg3,#efe2c8);color:var(--text,#2b2a26)}.dab-sv{background:var(--app-gut,#25a95c);color:#fff;box-shadow:0 4px 0 rgb(0 0 0/.2)}
  @media (prefers-reduced-motion:reduce){#dab-ov{transition:none}}`;
  if (typeof document !== 'undefined' && document.head) { const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); }

  window.DFLAbschluss = { CFG, zeige, daten, pauseRest };
  console.log('[DFL-Abschluss v1] aktiv — Saisonabschluss mit Statistik nach dem Finale, 3 Wochen Off-Season vor dem Draft');
})();
