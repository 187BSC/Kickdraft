/* ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
   Kickstil – Spieltag vor dem Anpfiff am PC (2026-10-18, nur PC-Version, body.pcu-an aus kickstil_pc_uebersicht.js)
   Nutzer: „tote Sachen raus“ – die alte Spielansicht (#view-match) zeigte vor dem Anpfiff Statistik 0:0, 50 % Ballbesitz,
   Momentum, „Keine Karten“ und „Formation wird analysiert …“; gespielt wird längst im Ticker (dfl_textspiel + PC-Spieltag).
   Am PC steht dort jetzt „Vor dem Spiel“:
   · links „Deine Elf“ (Platz, Gesicht, Stärke, Kraft; müde/verletzt markiert) mit „Aufstellung ändern“,
   · Mitte „Das Duell“ (Wettbewerb, Heim/Auswärts, Wappen, Stärke, Tabellenplatz und Form, Einschätzung) und die
     Ausrichtung zum Anpfiff (KSPcSpieltag.vorAusrichtung – gilt im Live-Spiel ab Minute 0) sowie Selbst coachen / Co-Trainer,
   · rechts wie bisher Anpfiff, Simulieren und „Spiel als Text“.
   Ohne Spiel in dieser Woche: das nächste Spiel und „Woche weiter“. Läuft die alte Ansicht doch einmal (Uhr ≠ 00'), bleibt
   alles wie es ist.
   ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const W = window;
  const CFG = { takt: 700, muede: 70 };
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const spiel = () => typeof SQUAD !== 'undefined' && typeof CLUB !== 'undefined' && CLUB && typeof LEAGUE !== 'undefined' && LEAGUE;
  const fx = () => (typeof CURRENT_FIXTURE !== 'undefined' ? CURRENT_FIXTURE : null);
  const dn = p => (typeof displayName === 'function' ? displayName(p) : p.name);
  const basis = p => (W.KSSaisonPlus ? KSSaisonPlus.basis(p) : p.ovr);
  const verletzt = p => (typeof isInjured === 'function' ? isInjured(p) : (p.injuryWeeks || 0) > 0);
  const gesperrt = p => (typeof isSuspended === 'function' ? isSuspended(p) : false);
  // Flutlicht: KSVerein; Kickdraft (als gesamt/pc_vorspiel.js eingehängt): DFLIdentitaet mit den Franchise-Daten
  const franchise = id => { try { return W.DFLSpiel ? DFLSpiel.franchise(id) : null; } catch (e) { return null; } };
  function gesicht(p) {
    try {
      if (W.KSVerein) return KSVerein.gesicht(p, 'fcm');
      if (W.DFLIdentitaet) { const f = franchise('fcm'); return DFLIdentitaet.gesichtSvg(p, f ? { farben: f.farben } : null); }
    } catch (e) {}
    return '';
  }
  function wappen(id) {
    try {
      if (W.KSVerein) return KSVerein.wappen(id, {});
      const f = franchise(id); if (f && W.DFLIdentitaet) return DFLIdentitaet.wappenSvg(f, { klein: true });
    } catch (e) {}
    return '';
  }
  const fitKl = f => f < 50 ? 'platt' : f < CFG.muede ? 'muede' : '';

  const CSS = `
#pcv-vor { display: none; }
body.pcv-an #view-match .main { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 14px; padding: 14px; align-items: start; height: auto; }
body.pcv-an #view-match .main > .feed-wrap, body.pcv-an #view-match .main > #tactics-col { display: none; }
body.pcv-an #view-match .sidebar { position: sticky; top: 12px; border-radius: 14px; border: 2px solid var(--k-linie, var(--border)); background: var(--bg2); }
body.pcv-an #view-match .sidebar > .sb-sec:not(:first-child) { display: none; }
body.pcv-an #view-match #time-badge, body.pcv-an #view-match #opp-formation-badge, body.pcv-an #view-match #score { display: none; }
body.pcv-an #pcv-vor { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr); gap: 14px; align-items: start; grid-column: 1; grid-row: 1; }
#pcv-vor .pcv-k { background: var(--bg2); border: 2px solid var(--k-linie, var(--border)); border-radius: 14px; overflow: hidden; min-width: 0; }
#pcv-vor .pcv-k > h3 { margin: 0; padding: 9px 14px; font-family: var(--font-display, inherit); font-size: 16px; display: flex; justify-content: space-between; align-items: baseline; gap: 8px;
  border-bottom: 1px solid var(--k-linie, var(--border)); }
#pcv-vor .pcv-k > h3 small { font-family: var(--font-text, system-ui); font-size: 12px; font-weight: 800; color: var(--text3); }
#pcv-vor .pcv-elf { list-style: none; margin: 0; padding: 4px 0; }
#pcv-vor .pcv-elf li { display: grid; grid-template-columns: 38px 30px minmax(0, 1fr) 50px 30px; gap: 8px; align-items: center; padding: 3px 12px; }
#pcv-vor .pcv-elf li.warn { background: color-mix(in srgb, #d69a1e 14%, transparent); }
#pcv-vor .pcv-elf li.rot { background: color-mix(in srgb, #c0392b 14%, transparent); }
#pcv-vor .pcv-pl { font-size: 10.5px; font-weight: 800; text-align: center; border-radius: 6px; padding: 1px 0; background: var(--bg4, var(--bg3)); color: var(--text2); }
#pcv-vor .pcv-g { width: 30px; height: 30px; border-radius: 8px; overflow: hidden; background: var(--bg4, var(--bg3)); }
#pcv-vor .pcv-g svg { width: 100%; height: 100%; display: block; }
#pcv-vor .pcv-n { font-weight: 800; font-size: 13.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#pcv-vor .pcv-n small { display: block; font-size: 11px; font-weight: 700; color: var(--text3); }
#pcv-vor .pcv-n small.pcv-rot { color: #c0392b; } #pcv-vor .pcv-n small.pcv-gelb { color: #b7791f; }
#pcv-vor .pcv-o { font-family: var(--font-display, inherit); font-weight: 800; font-size: 17px; text-align: right; font-variant-numeric: tabular-nums; }
#pcv-vor .pcv-fit { height: 5px; border-radius: 3px; background: var(--k-linie, var(--border)); overflow: hidden; }
#pcv-vor .pcv-fit i { display: block; height: 100%; background: #4f9a3a; } #pcv-vor .pcv-fit i.muede { background: #d69a1e; } #pcv-vor .pcv-fit i.platt { background: #c0392b; }
#pcv-vor .pcv-fuss { padding: 8px 12px 12px; border-top: 1px dashed var(--k-linie, var(--border)); display: flex; gap: 8px; flex-wrap: wrap; align-items: center; justify-content: space-between; }
#pcv-vor .pcv-fuss small { color: var(--text2); font-size: 12px; }
#pcv-vor .pcv-duell { padding: 14px 16px; display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); gap: 12px; align-items: center; text-align: center; }
#pcv-vor .pcv-team .pcv-w { width: 74px; height: 74px; margin: 0 auto 6px; }
#pcv-vor .pcv-team .pcv-w svg { width: 100%; height: 100%; display: block; }
#pcv-vor .pcv-team b { display: block; font-family: var(--font-display, inherit); font-size: 17px; line-height: 1.15; }
#pcv-vor .pcv-team small { display: block; font-size: 12px; color: var(--text2); font-weight: 700; margin-top: 2px; }
#pcv-vor .pcv-form { display: inline-flex; gap: 3px; margin-top: 5px; }
#pcv-vor .pcv-form i { width: 17px; height: 17px; border-radius: 4px; font-style: normal; font-size: 10px; font-weight: 800; color: #fff; display: grid; place-items: center; }
#pcv-vor .pcv-form .f-W { background: #4f9a3a; } #pcv-vor .pcv-form .f-D { background: #9a8468; } #pcv-vor .pcv-form .f-L { background: #c0392b; }
#pcv-vor .pcv-mitte { display: flex; flex-direction: column; align-items: center; gap: 4px; }
#pcv-vor .pcv-mitte .pcv-wb { font-size: 11px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--text3); }
#pcv-vor .pcv-mitte .pcv-st { font-family: var(--font-display, inherit); font-weight: 800; font-size: 30px; line-height: 1; font-variant-numeric: tabular-nums; }
#pcv-vor .pcv-mitte .pcv-st span { color: var(--text3); font-size: 20px; margin: 0 6px; }
#pcv-vor .pcv-mitte small { font-size: 11px; color: var(--text3); font-weight: 800; }
#pcv-vor .pcv-balken { grid-column: 1 / -1; display: flex; height: 8px; border-radius: 4px; overflow: hidden; background: var(--k-linie, var(--border)); }
#pcv-vor .pcv-balken i { display: block; height: 100%; } #pcv-vor .pcv-balken .h { background: #2f6fca; } #pcv-vor .pcv-balken .a { background: #c0392b; }
#pcv-vor .pcv-text { grid-column: 1 / -1; margin: 0; font-size: 13.5px; color: var(--text2); line-height: 1.4; }
#pcv-vor .pcv-text b { color: var(--text); }
#pcv-vor .pcv-wahl { padding: 12px 14px 14px; border-top: 1px dashed var(--k-linie, var(--border)); display: flex; flex-direction: column; gap: 8px; }
#pcv-vor .pcv-anw { display: flex; align-items: center; gap: 12px; } #pcv-vor .pcv-anw p { margin: 0; flex: 1; font-size: 13px; }
#pcv-vor .pcv-anw .app-knopf { flex: none; display: inline-flex; gap: 6px; align-items: center; padding: 8px 14px; }
#pcv-vor .pcv-wahl .pcv-et { font-size: 11px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--text3); }
#pcv-vor .pcv-stufen { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 4px; padding: 3px; background: var(--bg3, var(--bg)); border-radius: 12px; }
#pcv-vor .pcv-stufen button, #pcv-vor .pcv-coach button { all: unset; cursor: pointer; text-align: center; font-weight: 800; font-size: 13px; padding: 7px 4px; border-radius: 9px; color: var(--text2); }
#pcv-vor .pcv-stufen button.an, #pcv-vor .pcv-coach button.an { background: var(--k-blau-knopf, #2f6fca); color: #fff; box-shadow: 0 3px 0 var(--k-blau-schatten, #1d5a86); }
#pcv-vor .pcv-stufen button:focus-visible, #pcv-vor .pcv-coach button:focus-visible { outline: 3px solid var(--accent); outline-offset: 1px; }
#pcv-vor .pcv-wahl p { margin: 0; font-size: 12.5px; color: var(--text2); }
#pcv-vor .pcv-coach { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 3px; background: var(--bg3, var(--bg)); border-radius: 12px; }
#pcv-vor .pcv-leer { grid-column: 1 / -1; padding: 22px; text-align: center; display: flex; flex-direction: column; gap: 10px; align-items: center; }
#pcv-vor .pcv-leer b { font-family: var(--font-display, inherit); font-size: 18px; }
#pcv-vor .pcv-leer p { margin: 0; color: var(--text2); }
#pcv-vor .pcv-leer button { padding: 8px 22px; }
`;

  // ── Daten ─────────────────────────────────────────────────────────────────────────────────────────────────────
  function tabelle() {
    try { const g = findFcmGroup(LEAGUE); return g && typeof computeTable === 'function' ? computeTable(g.group.teams) : []; } catch (e) { return []; }
  }
  function teamInfo(id, tab) {
    const i = tab.findIndex(t => t.id === id), t = i >= 0 ? tab[i] : null;
    return { platz: t && tab.some(x => x.played > 0) ? i + 1 : 0, form: t && Array.isArray(t.form) ? t.form.slice(-5) : [] };
  }
  const staerkeAus = id => { const t = (($(id) || {}).textContent || '').match(/(\d{2,3})/); return t ? +t[1] : null; };
  function wettbewerb(f) {
    const t = f.type || '';
    if (t === 'friendly') return 'Testspiel';
    if (t === 'cup') return 'Flutlichtpokal';
    if (t === 'euro') return f.comp || f.compName || 'Europapokal';
    try { const g = findFcmGroup(LEAGUE); return (typeof tierLabelOf === 'function' ? tierLabelOf(g.tierKey) : 'Liga') + ' · ' + ((LEAGUE.matchday || 0) + 1) + '. Spieltag'; } catch (e) { return 'Liga'; }
  }
  function elfZeilen() {
    let slots = []; try { slots = FORMATIONS[CLUB.formation] || []; } catch (e) { slots = []; }
    return slots.map(s => {
      const p = CLUB.lineup && CLUB.lineup[s.id] ? SQUAD.find(q => q.id === CLUB.lineup[s.id]) : null;
      let pl = s.label || s.id; try { if (W.KSPos && KSPos.platz) pl = KSPos.platz(s) || pl; } catch (e) { /* Rolle */ }
      return { s, p, pl };
    });
  }

  // ── Zeichnen ──────────────────────────────────────────────────────────────────────────────────────────────────
  function elfHtml() {
    const z = elfZeilen(), probleme = [];
    const li = z.map(({ p, pl }) => {
      if (!p) return `<li class="rot"><span class="pcv-pl">${esc(pl)}</span><span class="pcv-g"></span><span class="pcv-n">frei<small class="pcv-rot">Platz nicht besetzt</small></span><span></span><span></span></li>`;
      const fit = Math.round(p.fitness == null ? 100 : p.fitness), rot = verletzt(p) || gesperrt(p), gelb = !rot && fit < CFG.muede;
      if (rot || gelb) probleme.push(p);
      const info = verletzt(p) ? '<small class="pcv-rot">verletzt</small>' : gesperrt(p) ? '<small class="pcv-rot">gesperrt</small>' : gelb ? `<small class="pcv-gelb">müde · ${fit} %</small>` : `<small>${p.age} J.</small>`;
      return `<li class="${rot ? 'rot' : gelb ? 'warn' : ''}"><span class="pcv-pl">${esc(pl)}</span><span class="pcv-g" aria-hidden="true">${gesicht(p)}</span>
        <span class="pcv-n">${esc(dn(p))}${info}</span><span class="pcv-fit" title="Fitness ${fit} %"><i class="${fitKl(fit)}" style="width:${fit}%"></i></span><span class="pcv-o">${basis(p)}</span></li>`;
    }).join('');
    return `<section class="pcv-k" aria-label="Deine Elf"><h3>Deine Elf <small>${esc(CLUB.formation || '')}</small></h3><ul class="pcv-elf">${li}</ul>
      <div class="pcv-fuss"><small>${probleme.length ? `${probleme.length} Spieler nicht fit` : 'Alle fit'}</small><button type="button" class="app-knopf" data-pcv="aufstellung">Aufstellung ändern</button></div></section>`;
  }
  function duellHtml(f) {
    const tab = tabelle(), heim = f.isHome !== false;
    let opp = null; try { opp = W.KSVerein ? KSVerein.daten(f.opponentId) : null; } catch (e) { opp = null; }
    const wir = { id: 'fcm', name: (($('home-team-label') || {}).textContent || CLUB.name || '').trim(), st: null };
    const geg = { id: f.opponentId, name: ((heim ? $('away-team-label') : $('home-team-label')) || {}).textContent || (opp && opp.name) || '' };
    // Die Spielansicht schreibt die eigene Mannschaft immer links (home-…), den Gegner rechts (away-…)
    wir.name = (($('home-team-label') || {}).textContent || '').trim() || CLUB.name;
    geg.name = (($('away-team-label') || {}).textContent || '').trim() || (opp && opp.name) || '';
    wir.st = staerkeAus('home-str-label'); geg.st = staerkeAus('away-str-label');
    if (wir.st == null) { try { wir.st = Math.round(computeTeamRatings().overall); } catch (e) { wir.st = 0; } }
    const iw = teamInfo('fcm', tab), ig = teamInfo(f.opponentId, tab);
    const team = (t, inf, ort) => `<div class="pcv-team"><div class="pcv-w" aria-hidden="true">${wappen(t.id)}</div><b>${esc(t.name)}</b>
      <small>${ort}${inf.platz ? ` · ${inf.platz}. Platz` : ''}</small>${inf.form.length ? `<span class="pcv-form">${inf.form.map(r => `<i class="f-${esc(r)}">${r === 'W' ? 'S' : r === 'L' ? 'N' : 'U'}</i>`).join('')}</span>` : ''}</div>`;
    const d = (wir.st || 0) - (geg.st || 0), sum = Math.max(1, (wir.st || 0) + (geg.st || 0));
    const text = geg.st == null ? '' : d >= 6 ? `<b>Ihr seid klarer Favorit.</b> Offensiv kann sich lohnen – aber Vorsicht vor Kontern.`
      : d >= 3 ? `<b>Ihr seid leicht favorisiert.</b> Ausgewogen oder Offensiv passt.`
      : d <= -6 ? `<b>Ihr seid klarer Außenseiter.</b> Mauern oder Defensiv hält das Spiel lange offen.`
      : d <= -3 ? `<b>Ihr seid leichter Außenseiter.</b> Defensiv stehen und auf Konter lauern.`
      : `<b>Ausgeglichenes Duell.</b> Kleinigkeiten entscheiden.`;
    const S = W.KSPcSpieltag, live = S && S.liveMoeglich && (() => { try { return S.liveMoeglich(); } catch (e) { return false; } })();
    const A = S && S.AUSRICHTUNG, i = S && S.vorAusrichtung ? S.vorAusrichtung() : 2, coach = S && S.coachModus ? S.coachModus() : 'selbst';
    const wahl = live && A ? `<div class="pcv-wahl"><span class="pcv-et">Ausrichtung zum Anpfiff</span>
        <div class="pcv-stufen" role="group" aria-label="Ausrichtung">${A.map((a, k) => `<button type="button" data-pcv-a="${k}" class="${k === i ? 'an' : ''}" aria-pressed="${k === i}">${esc(a.name)}</button>`).join('')}</div>
        <p>${esc(A[i].text)}</p>
        <span class="pcv-et">Coaching</span>
        <div class="pcv-coach" role="group" aria-label="Coaching"><button type="button" data-pcv-c="selbst" class="${coach === 'selbst' ? 'an' : ''}">Selbst coachen</button><button type="button" data-pcv-c="co" class="${coach === 'co' ? 'an' : ''}">Co-Trainer übernimmt</button></div>${W.KSPcTaktik && KSPcTaktik.vorOeffnen ? `<span class="pcv-et">Mannschaftsanweisungen</span>
        <div class="pcv-anw"><p>${esc(KSPcTaktik.vorText())}</p><button type="button" class="app-knopf" data-pcv="taktik"><i class="ti ti-clipboard-list" aria-hidden="true"></i> Taktikbrett</button></div>` : ''}</div>`
      : `<div class="pcv-wahl"><p>Live-Coaching gibt es, wenn „Spiel als Text“ an ist (rechts).</p></div>`;
    return `<section class="pcv-k" aria-label="Das Duell"><h3>Das Duell <small>${esc(wettbewerb(f))}</small></h3>
      <div class="pcv-duell">${team(wir, iw, heim ? 'Heim' : 'Auswärts')}
        <div class="pcv-mitte"><span class="pcv-wb">Stärke</span><span class="pcv-st">${wir.st ?? '–'}<span>:</span>${geg.st ?? '–'}</span><small>${heim ? 'im eigenen Stadion' : 'auswärts'}</small></div>
        ${team(geg, ig, heim ? 'Gast' : 'Gastgeber')}
        ${geg.st != null ? `<div class="pcv-balken" aria-hidden="true"><i class="h" style="width:${(wir.st / sum * 100).toFixed(1)}%"></i><i class="a" style="width:${(geg.st / sum * 100).toFixed(1)}%"></i></div>` : ''}
        ${text ? `<p class="pcv-text">${text}</p>` : ''}</div>${wahl}</section>`;
  }
  function leerHtml() {
    const n = (($('hm-away-name') || {}).textContent || '').trim(), h = (($('hm-home-name') || {}).textContent || '').trim();
    const wann = (($('hm-countdown') || {}).textContent || '').trim(), comp = (($('hm-comp') || {}).textContent || '').trim();
    return `<section class="pcv-k pcv-leer"><b>Diese Woche ist spielfrei</b>${h && n ? `<p>Nächstes Spiel${wann ? ' ' + esc(wann) : ''}: <b>${esc(h)} – ${esc(n)}</b>${comp ? ' · ' + esc(comp) : ''}</p>` : ''}
      <button type="button" class="app-knopf" data-pcv="weiter">Woche weiter</button></section>`;
  }
  let sig = '';
  function zeichnen() {
    const v = $('view-match'), main = v && v.querySelector('.main'); if (!main) return;
    const lauf = (typeof G !== 'undefined' && G && G.running) || ((($('time-badge') || {}).textContent || "00'").trim() !== "00'");
    const an = document.body.classList.contains('pcu-an') && v.classList.contains('active') && spiel() && !lauf;
    document.body.classList.toggle('pcv-an', !!an);
    if (!an) return;
    let box = $('pcv-vor'); if (!box || box.parentNode !== main) { if (box) box.remove(); box = document.createElement('div'); box.id = 'pcv-vor'; main.insertBefore(box, main.firstChild); sig = ''; }
    const f = fx(), S = W.KSPcSpieltag;
    const s = JSON.stringify([f, LEAGUE.week, CLUB.formation, CLUB.lineup, SQUAD.map(p => [p.id, Math.round(p.fitness || 0), p.injuryWeeks || 0]),
      S && S.vorAusrichtung ? S.vorAusrichtung() : 2, S && S.coachModus ? S.coachModus() : '', JSON.stringify((CLUB && CLUB.pcAnw) || null), ($('away-str-label') || {}).textContent, ($('time-badge') || {}).textContent]);
    if (s === sig) return; sig = s;
    box.innerHTML = f && f.opponentId ? elfHtml() + duellHtml(f) : leerHtml();
  }
  function klick(ev) {
    if (!document.body.classList.contains('pcv-an')) return;
    const t = ev.target, S = W.KSPcSpieltag;
    const a = t.closest('[data-pcv-a]'); if (a && S && S.vorAusrichtung) { S.vorAusrichtung(+a.getAttribute('data-pcv-a')); zeichnen(); return; }
    const c = t.closest('[data-pcv-c]'); if (c && S && S.coachSetzen) { S.coachSetzen(c.getAttribute('data-pcv-c')); zeichnen(); return; }
    const b = t.closest('[data-pcv]'); if (!b) return;
    const was = b.getAttribute('data-pcv');
    if (was === 'aufstellung') { const n = $('nav-squad'); if (n) n.click(); if (W.KSKader && KSKader.zeige) KSKader.zeige('aufstellung'); W.scrollTo({ top: 0 }); }
    else if (was === 'taktik') { if (W.KSPcTaktik && KSPcTaktik.vorOeffnen) KSPcTaktik.vorOeffnen(); }
    else if (was === 'weiter') { const n = document.querySelector('#calendar-widget .cal-next'); if (n) n.click(); }
  }
  function start() {
    if ($('pcv-css')) return;
    const st = document.createElement('style'); st.id = 'pcv-css'; st.textContent = CSS; document.head.appendChild(st);
    document.addEventListener('click', klick);
    setInterval(zeichnen, CFG.takt);
    console.log('[Kickstil-PC-Vorspiel v1] aktiv — Spieltag vor dem Anpfiff: Elf, Duell, Ausrichtung zum Anpfiff (nur PC ≥ 1200 px)');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  W.KSPcVorspiel = { CFG, zeichnen };
})();
