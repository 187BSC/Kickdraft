/* ═══════════════════════════════════════════════════════════════════════════
   DFL · ANALYSTEN  ·  v1   (D51, Wunsch 2026-10-09: „am Ende des Drafts eine Note je Team“ und
   „wie die Odds in Form von Wettquoten, wer den Titel holt“; eingebaut 2026-10-09: „bau mal alles ein“)
   ─────────────────────────────────────────────────────────────────────────
   Wettquoten auf den Titel
     400 Simulationen von Restsaison und Playoffs (Tabelle aus dem Spiel, Spielformel D43 über DFLSaison),
     Quote = 1 / Titelchance × 0,92 (8 % Buchmacher-Marge), gerundet wie beim Buchmacher.
     Im Postfach vor der Saison, nach Spieltag 8, an der Trade-Deadline und vor den Playoffs; ▲▼ = Trend
     seit dem letzten Stand.
   Draft-Noten der Analysten
     Am Draft-Ende eine Note je Verein (A+ bis F nach Rang): Talent nach Medienliste gegen den Wert der eigenen
     Picks, dazu Gewinn/Verlust an künftigen Picks aus Draft-Trades und geschlossene Lücken; ein Satz dazu
     (Steal, Reach, viele/wenige Picks, Lücken).
   Gespeichert in LEAGUE.dflAnalysten = { quoten: { saison, staende: [...] }, noten: { jahr, liste } }.
   Anzeige: Postfach (News) → „Ansehen“ öffnet das Blatt (Handy) bzw. ein Fenster (PC).
   Haken: advanceCalendarWeek (Quoten), dfl_kader_patch.js ruft DFLAnalysten.draftFertig(d), buildPostfachItems.
   API: DFLAnalysten.quotenRechnen(n) · .quoten() · .noten() · .zeigeQuoten(i) · .zeigeNoten() · .draftFertig(d)
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const D = () => window.DFLSpiel, S = () => window.DFLSaison, H = () => window.DFLHandel, G = () => window.DFLGenerator;
  const dfl = () => !!(window.DFLSpiel && DFLSpiel.aktiv && DFLSpiel.aktiv() && typeof LEAGUE !== 'undefined' && LEAGUE);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const zustand = () => (LEAGUE.dflAnalysten = LEAGUE.dflAnalysten || {});
  const N_SIM = 400, MARGE = 0.92;
  const DEADLINE = () => (H() && H().CFG.deadlineSpieltag) || 16;

  // ── Wettquoten ───────────────────────────────────────────────────────────
  function zufall(seed) { let s = (seed >>> 0) % 2147483646 + 1; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
  function poisson(l, r) { let k = 0, p = Math.exp(-l), s = p; const u = r(); while (u > s && k < 10) { k++; p *= l / k; s += p; } return k; }
  const quote = p => p <= 0 ? 501 : Math.max(1.05, Math.min(501, 1 / p * MARGE));
  const rund = q => q < 2 ? Math.round(q * 20) / 20 : q < 10 ? Math.round(q * 4) / 4 : q < 50 ? Math.round(q) : Math.round(q / 5) * 5;
  // Restsaison + Playoffs n-mal durchspielen → je Verein Titel-, Final- und Playoff-Chance
  function quotenRechnen(n, seed) {
    const Sx = S(), Dx = D(), L = Dx.welt(), r = zufall(seed || (LEAGUE.season * 1009 + LEAGUE.matchday * 31 + 7));
    const werte = {}; L.teams.forEach(t => { werte[t.id] = Sx.teamWerte(t); });
    const fg = findFcmGroup(LEAGUE), tab0 = {};
    computeTable(fg.group.teams).forEach(z => { const id = Dx.dflIdVon(z.id); tab0[id] = { id, pts: z.pts || 0, w: z.w || 0, d: z.d || 0, l: z.l || 0, gf: z.gf || 0, ga: z.ga || 0 }; });
    L.teams.forEach(t => { if (!tab0[t.id]) tab0[t.id] = { id: t.id, pts: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 }; });
    const rest = (LEAGUE.fixtures[fg.key] || []).slice(LEAGUE.matchday).map(tag => tag.map(([h, g]) => [Dx.dflIdVon(h), Dx.dflIdVon(g)]));
    const titel = {}, playoffs = {};
    for (let i = 0; i < (n || N_SIM); i++) {
      const tab = {}; Object.keys(tab0).forEach(id => { tab[id] = Object.assign({}, tab0[id]); });
      rest.forEach(tag => tag.forEach(([h, g]) => {
        const A = tab[h], B = tab[g]; if (!A || !B) return;
        const [lh, la] = Sx.toreErwartet(werte[h], werte[g], Sx.CFG.heimvorteil);
        const gh = poisson(lh, r), ga = poisson(la, r);
        A.gf += gh; A.ga += ga; B.gf += ga; B.ga += gh;
        if (gh > ga) { A.pts += 3; A.w++; B.l++; } else if (gh < ga) { B.pts += 3; B.w++; A.l++; } else { A.pts++; B.pts++; A.d++; B.d++; }
      }));
      Object.values(tab).forEach(z => { z.gd = z.gf - z.ga; });
      const los = {}; L.teams.forEach(t => { los[t.id] = r(); });
      const po = Sx.playoffs(L, { tabelle: tab, los, werte }, r);
      titel[po.meister] = (titel[po.meister] || 0) + 1;
      Object.keys(po.ausgeschieden).forEach(id => { playoffs[id] = (playoffs[id] || 0) + 1; });
    }
    const N = n || N_SIM;
    return L.teams.map(t => ({ id: t.id, q: rund(quote((titel[t.id] || 0) / N)), p: Math.round((titel[t.id] || 0) / N * 1000),
      po: Math.round((playoffs[t.id] || 0) / N * 1000), ovr: Math.round(G().teamOvr(t)) }))
      .sort((a, b) => b.p - a.p || a.q - b.q || b.ovr - a.ovr);
  }
  // Welcher Stand ist jetzt fällig? (immer nur der jüngste, der noch fehlt)
  function faelligerStand() {
    const md = LEAGUE.matchday || 0, mw = LEAGUE.matchWeeks || [], dl = DEADLINE() - 1;
    const A = zustand(), q = A.quoten && A.quoten.saison === LEAGUE.season ? A.quoten : null;
    const hat = art => !!(q && q.staende.some(x => x.art === art));
    const poLaeuft = LEAGUE.dflPO && (LEAGUE.dflPO.runde || 1) > 1;
    if (md >= ((LEAGUE.matchWeeks || []).length || 26)) return !hat('playoffs') && !poLaeuft ? { art: 'playoffs', label: 'vor den Playoffs' } : null;
    if (md >= dl) return !hat('deadline') ? { art: 'deadline', label: md <= dl + 1 ? `an der Trade-Deadline (nach Spieltag ${md})` : `nach Spieltag ${md}` } : null;
    if (md >= 8) return !hat('spieltag8') ? { art: 'spieltag8', label: `nach Spieltag ${md}` } : null;
    if (md === 0 && mw.length && LEAGUE.week >= mw[0] - 1) return !hat('start') ? { art: 'start', label: 'vor der Saison' } : null;
    return null;
  }
  function quotenPruefen() {
    if (!dfl() || !S() || !H()) return false;
    const f = faelligerStand(); if (!f) return false;
    const A = zustand();
    if (!A.quoten || A.quoten.saison !== LEAGUE.season) A.quoten = { saison: LEAGUE.season, staende: [] };
    const liste = quotenRechnen(N_SIM);
    A.quoten.staende.push({ art: f.art, label: f.label, woche: LEAGUE.week, ts: Date.now(), liste });
    return true;
  }
  const quoten = () => { const A = dfl() && zustand(); return A && A.quoten && A.quoten.saison === LEAGUE.season ? A.quoten.staende : []; };

  // ── Draft-Noten ──────────────────────────────────────────────────────────
  const NOTEN = ['A+', 'A+', 'A', 'A', 'A', 'A-', 'A-', 'A-', 'A-', 'B+', 'B+', 'B+', 'B+', 'B+', 'B', 'B', 'B', 'B', 'B', 'B-', 'B-', 'B-', 'B-', 'C+', 'C+', 'C+', 'C', 'C', 'C', 'D', 'D', 'F'];
  function notenRechnen(d) {
    const Dx = D(), Hx = H(), Gx = G(), L = Dx.liga();
    // Gewinn/Verlust an künftigen Picks aus Draft-Trades (Stand beim Draft-Start gegen jetzt)
    const zukunft = {};
    Object.entries(d.zukunft || {}).forEach(([id, [vorher, wert]]) => {
      const x = (L.picks || []).find(k => k.id === id); if (!x || x.besitzer === vorher) return;
      zukunft[x.besitzer] = (zukunft[x.besitzer] || 0) + wert; zukunft[vorher] = (zukunft[vorher] || 0) - wert;
    });
    const teams = L.teams.map(T => {
      const gid = Dx.spielId(T.id), meine = d.picks.filter(p => p.team === gid);
      const orig = d.slots.map((s, i) => ({ s, i })).filter(x => x.s.von === gid).map(x => x.i + 1);
      let ana = {}; try { ana = Gx.kaderAnalyse(T, { scouting: 6, saat: 3 }) || {}; } catch (e) { /* ohne Analyse */ }
      let haul = 0, fit = 0; const einzel = [];
      meine.forEach(p => {
        const rang = p.medien || p.pick;
        haul += Hx.pickWertNr(Math.min(rang, 200)); einzel.push({ p, rang, diff: p.pick - rang });
        const b = ana[p.pos]; if (b && b.bedarf >= 1 && p.pick <= 64) fit++;
      });
      const erwartet = orig.reduce((s, n) => s + Hx.pickWertNr(n), 0), plus = zukunft[T.id] || 0;
      const score = (haul + plus - erwartet) / Math.max(10, erwartet) + 0.05 * fit;
      const steal = einzel.slice().sort((a, b) => b.diff - a.diff)[0], reach = einzel.slice().sort((a, b) => a.diff - b.diff)[0];
      return { id: T.id, picks: meine.length, score: Math.round(score * 1000) / 1000, fit, plus: Math.round(plus * 10) / 10,
        steal: steal && steal.diff >= 8 ? `${steal.p.name} an #${steal.p.pick} (Medien #${steal.rang})` : null,
        reach: reach && reach.diff <= -12 ? `${reach.p.name} schon an #${reach.p.pick} (Medien #${reach.rang})` : null };
    }).sort((a, b) => b.score - a.score);
    teams.forEach((t, i) => {
      t.note = NOTEN[Math.min(i, NOTEN.length - 1)];
      t.satz = t.steal && t.note[0] <= 'B' ? `Steal: ${t.steal}.`
        : t.reach && t.note[0] >= 'C' ? `Reach: ${t.reach}.`
          : t.plus >= 3 ? 'Hat im Draft künftige Picks dazugewonnen.'
            : t.plus <= -3 ? 'Hat fürs Hochtraden künftige Picks abgegeben.'
              : t.picks > 4 ? `${t.picks} Picks durch Trades – viel Talent für wenig Kapital.`
                : t.picks < 4 ? `Nur ${t.picks} Picks – hoch getauscht, alles auf wenige Talente gesetzt.`
                  : t.fit >= 2 ? 'Hat gezielt die Lücken im Kader geschlossen.' : 'Solide, ohne große Ausreißer.';
      delete t.steal; delete t.reach;
    });
    return teams;
  }
  function draftFertig(d) {
    if (!dfl() || !d || !d.picks || !d.picks.length) return;
    const A = zustand();
    if (A.noten && A.noten.jahr === d.jahr) return;
    A.noten = { jahr: d.jahr, saison: LEAGUE.season, woche: LEAGUE.week, ts: Date.now(), liste: notenRechnen(d) };
  }
  const noten = () => { const A = dfl() && zustand(); return A && A.noten ? A.noten : null; };

  // ── Anzeige ──────────────────────────────────────────────────────────────
  const teamVon = id => D().liga().teams.find(t => t.id === id) || { name: id, kurz: id };
  const kurz = t => t.kurz || t.name;
  const fmtQ = q => q >= 100 ? String(Math.round(q)) : q.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const prozent = x => (x >= 10 || x === 0 ? Math.round(x / 10) : (x / 10).toLocaleString('de-DE', { maximumFractionDigits: 1 })) + ' %';
  const notenKlasse = n => 'n-' + n[0].toLowerCase();
  function trend(id, liste, vorher) {
    if (!vorher) return '';
    const a = vorher.liste.find(x => x.id === id), b = liste.find(x => x.id === id);
    if (!a || !b || a.q === b.q) return '';
    return b.q < a.q ? '<span class="qn-trend auf" aria-label="Quote gesunken">▲</span>' : '<span class="qn-trend ab" aria-label="Quote gestiegen">▼</span>';
  }
  function quotenHtml(i) {
    const st = quoten(); if (!st.length) return '';
    if (i == null || !st[i]) i = st.length - 1;
    const s = st[i], vorher = st[i - 1], eigen = D().eigeneDflId(), ich = s.liste.find(x => x.id === eigen);
    const titel = typeof seasonYearLabel === 'function' ? seasonYearLabel(LEAGUE.season) : '';
    return `<div class="ks-kopf"><b>Wer wird DKL-Meister ${esc(titel)}?</b><small>Buchmacher-Quoten ${esc(s.label)}${ich ? ` · 10 € auf ${esc(kurz(teamVon(eigen)))} bringen ${fmtQ(ich.q * 10)} €` : ''}</small></div>
      ${st.length > 1 ? `<div class="qn-staende" role="group" aria-label="Stand wählen">${st.map((x, k) => `<button type="button" class="pf-chip${k === i ? ' active' : ''}" aria-pressed="${k === i}" onclick="DFLAnalysten.zeigeQuoten(${k})">${esc({ start: 'Saisonstart', spieltag8: 'Spieltag 8', deadline: 'Deadline', playoffs: 'Playoffs' }[x.art] || x.label)}</button>`).join('')}</div>` : ''}
      <div class="ks-liste">${s.liste.map((x, k) => { const t = teamVon(x.id); return `<div class="ks-zeile${x.id === eigen ? ' ich' : ''}"><span class="qn-platz">${k + 1}</span>
        <span class="ks-wer"><b>${esc(t.name)}</b><small>Titel ${prozent(x.p)} · Playoffs ${prozent(x.po)} · Stärke ${x.ovr}</small></span>
        <span class="qn-quote">${fmtQ(x.q)}${trend(x.id, s.liste, vorher)}</span></div>`; }).join('')}</div>
      <div class="ks-hinweis">${N_SIM} Simulationen · Quote = Auszahlung je 1 €${vorher ? ` · ▲▼ seit „${esc(vorher.label)}“` : ''}</div>`;
  }
  function notenHtml() {
    const n = noten(); if (!n) return '';
    const eigen = D().eigeneDflId();
    return `<div class="ks-kopf"><b>Draft-Noten ${n.jahr}</b><small>Talent gegen Pick-Wert, Steals, Lücken, Draft-Trades</small></div>
      <div class="ks-liste">${n.liste.map(x => { const t = teamVon(x.id); return `<div class="ks-zeile${x.id === eigen ? ' ich' : ''}"><span class="qn-note ${notenKlasse(x.note)}">${x.note}</span>
        <span class="ks-wer"><b>${esc(t.name)}</b><small>${x.picks} Picks · ${esc(x.satz)}</small></span></div>`; }).join('')}</div>
      <div class="ks-hinweis">Noten nach Rang: die zwei besten A+, die schwächste F.</div>`;
  }
  const shell = () => document.body && document.body.classList.contains('dfl-shell');
  function zeige(html) {
    if (!html) return;
    zu();
    if (shell()) {
      const box = document.querySelector('#app-blatt .app-blatt-box'); if (!box) return;
      box.onclick = ev => { if (ev.target.closest('.app-blatt-zu')) zu(); };
      box.innerHTML = '<div class="app-griff"></div><button class="app-blatt-zu" aria-label="Schließen"><i class="ti ti-x" aria-hidden="true"></i></button>' + html;
      box.dataset.analysten = '1';
      document.getElementById('app-blatt').classList.add('auf'); document.body.classList.add('app-gesperrt');
      return;
    }
    const ov = document.createElement('div');
    ov.className = 'exp-overlay'; ov.id = 'qn-ov';
    ov.addEventListener('click', ev => { if (ev.target === ov || ev.target.closest('.qn-zu')) zu(); });
    ov.innerHTML = `<div class="exp-dialog qn-dialog"><button class="app-blatt-zu qn-zu" aria-label="Schließen"><i class="ti ti-x" aria-hidden="true"></i></button>${html}</div>`;
    document.body.appendChild(ov);
  }
  function zu() {
    const ov = document.getElementById('qn-ov'); if (ov) ov.remove();
    const b = document.getElementById('app-blatt'), box = b && b.querySelector('.app-blatt-box');
    if (box && box.dataset.analysten) {
      delete box.dataset.analysten;
      if (b.classList.contains('auf')) { b.classList.remove('auf'); document.body.classList.remove('app-gesperrt'); }
    }
  }
  function zeigeQuoten(i) {
    const html = quotenHtml(i);
    const box = document.querySelector('#app-blatt .app-blatt-box');
    if (shell() && box && box.dataset.analysten && document.getElementById('app-blatt').classList.contains('auf')) {      // Stand wechseln, Blatt bleibt offen
      box.innerHTML = '<div class="app-griff"></div><button class="app-blatt-zu" aria-label="Schließen"><i class="ti ti-x" aria-hidden="true"></i></button>' + html;
      return;
    }
    const dlg = document.querySelector('#qn-ov .qn-dialog');
    if (dlg) { dlg.innerHTML = '<button class="app-blatt-zu qn-zu" aria-label="Schließen"><i class="ti ti-x" aria-hidden="true"></i></button>' + html; return; }
    zeige(html);
  }

  // ── Haken ins Spiel ──────────────────────────────────────────────────────
  // Postfach: jüngster Quoten-Stand und die Draft-Noten als Nachricht (frisch: oben)
  {
    const _orig = window.buildPostfachItems;
    if (typeof _orig === 'function') {
      window.buildPostfachItems = function () {
        const items = _orig.apply(this, arguments);
        if (!dfl()) return items;
        try {
          const frisch = (saison, woche) => saison === LEAGUE.season && LEAGUE.week - woche <= 2;
          const st = quoten();
          if (st.length) {
            const s = st[st.length - 1], eigen = D().eigeneDflId(), ich = s.liste.find(x => x.id === eigen), platz = s.liste.indexOf(ich);
            items.push({ cat: 'news', icon: '<i class="ti ti-chart-bar"></i>',
              title: `Buchmacher: Wer wird DKL-Meister ${typeof seasonYearLabel === 'function' ? seasonYearLabel(LEAGUE.season) : ''}?`,
              text: s.liste.slice(0, 3).map(x => esc(kurz(teamVon(x.id))) + ' ' + fmtQ(x.q)).join(' · ') + (ich && platz >= 3 ? ` · … · <b>${esc(kurz(teamVon(eigen)))} ${fmtQ(ich.q)}</b>` : ''),
              meta: 'Quoten ' + esc(s.label) + (st.length > 1 ? ' · Trend seit dem letzten Stand' : ''),
              actions: '<button class="pf-btn" onclick="DFLAnalysten.zeigeQuoten()">Ansehen</button>',
              prio: frisch(LEAGUE.season, s.woche) ? 5 : 0, ts: s.ts || 0 });
          }
          const n = noten();
          if (n) {
            const eigen = D().eigeneDflId(), ich = n.liste.find(x => x.id === eigen);
            items.push({ cat: 'news', icon: '<i class="ti ti-school"></i>', title: `Draft-Noten der Analysten ${n.jahr}`,
              text: (ich ? `Deine Note: <b>${ich.note}</b> · ` : '') + 'Gewinner: ' + n.liste.slice(0, 2).map(x => esc(kurz(teamVon(x.id))) + ' ' + x.note).join(', ') +
                ' · Verlierer: ' + n.liste.slice(-1).map(x => esc(kurz(teamVon(x.id))) + ' ' + x.note).join(''),
              meta: 'Nach dem Draft', actions: '<button class="pf-btn" onclick="DFLAnalysten.zeigeNoten()">Ansehen</button>',
              prio: frisch(n.saison, n.woche) ? 5 : 0, ts: n.ts || 0 });
          }
        } catch (e) { console.warn('[DFL-Analysten] Postfach', e); }
        return items;
      };
      try { buildPostfachItems = window.buildPostfachItems; } catch (e) { /* nur im Spiel */ }
    }
  }
  // Wochentakt: fällige Quoten nach dem Weiterklicken rechnen (kurz verzögert, damit der Wechsel nicht hakt)
  {
    const _orig = window.advanceCalendarWeek;
    if (typeof _orig === 'function') {
      window.advanceCalendarWeek = function () {
        const r = _orig.apply(this, arguments);
        if (dfl() && faelligerStand()) setTimeout(() => {
          try {
            if (quotenPruefen() && typeof renderPostfach === 'function') renderPostfach();
          } catch (e) { console.warn('[DFL-Analysten] Quoten', e); }
        }, 60);
        return r;
      };
      try { advanceCalendarWeek = window.advanceCalendarWeek; } catch (e) { /* nur im Spiel */ }
    }
  }

  window.DFLAnalysten = { quotenRechnen, quotenPruefen, quoten, noten, notenRechnen, draftFertig, zeigeQuoten,
    zeigeNoten: () => zeige(notenHtml()), zu, faelligerStand };
  console.log('[DFL-Analysten v1] aktiv — Wettquoten auf den Titel (4× je Saison) und Draft-Noten A+ bis F im Postfach');
})();
