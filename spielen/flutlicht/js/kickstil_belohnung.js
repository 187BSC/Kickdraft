/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · BELOHNEN UND BESTRAFEN  ·  v1   (2026-10-24, beide Spiele – gleiche Datei in kickdraft/spiel/js)
   ─────────────────────────────────────────────────────────────────────────
   Nutzer: „Was kann man dem Kader Gutes tun als Belohnung? Wellness usw. als Moral-Boost“ – „Belohnungen gehen nicht immer,
   sondern nur einmal pro Halbserie, genauso wie Bestrafungen. Bei Bestrafungen KANN-Effekte, die positiv, aber auch negativ sein
   können, selbes für die Belohnungen, dass die Konzentration vielleicht ein wenig sinkt“.
   · Kader → Training: Karte „Mannschaft“ mit Belohnen und Bestrafen; je Halbserie (Hinrunde/Rückrunde nach LEAGUE.matchday
     gegen die Hälfte von LEAGUE.matchWeeks) eine Belohnung und eine Strafe.
   · Kosten in Prozent der Wochengehälter (passt in jeder Liga), vom Kontostand CLUB.budget.
   · Feste Wirkung (Moral, Fitness) plus je Maßnahme Kann-Folgen mit Wahrscheinlichkeit, gut oder schlecht:
     nächstes Spiel ±% (CLUB._nextMatchMod wie die Ereignisse in bundle_economy.js), Verletzungsrisiko (CLUB._injuryRiskMod),
     einzelne Spieler (Moral, Fitness, kurze Verletzung).
   · Siegprämie: wird erst nach dem nächsten Pflichtspiel fällig und nur bei Sieg (Hülle um processFixtureResult).
   Zustand CLUB.ksBelohnung = { genutzt: { 'Saison-Hälfte': { b: id, s: id } }, praemie: { betrag } }.
   API: KSBelohnung.oeffnen('b'|'s') · .frei() · .CFG
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const W = window;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const euro = v => (typeof formatEuro === 'function' ? formatEuro(Math.round(v)) : Math.round(v) + ' €');
  const KD = /\/kickdraft\//.test(location.pathname) || !!W.DFLSpiel;

  // Kann-Folgen: { p: Wahrscheinlichkeit, gut: true|false, text, wirk: { spiel: ±%, moral, fitness, einer: {moral, fitness, verletzt}, risiko } }
  const CFG = {
    BELOHNUNG: [
      { id: 'frei', icon: 'ti-sofa', name: 'Freier Tag', kosten: 0, moral: 3, fitness: 8,
        kann: [{ p: 0.25, gut: false, text: 'Ein paar kommen nicht ganz bei der Sache zurück – die Konzentration leidet.', wirk: { spiel: -1 } }] },
      { id: 'abend', icon: 'ti-grill', name: 'Teamabend', kosten: 0.08, moral: 4, neu: 6,
        kann: [{ p: 0.15, gut: false, text: '{N} hat über die Stränge geschlagen und ist am nächsten Tag nicht zu gebrauchen.', wirk: { einer: { moral: -5, fitness: -10 } } },
          { p: 0.2, gut: true, text: 'Der Abend schweißt zusammen – die Mannschaft zieht im nächsten Spiel an einem Strang.', wirk: { spiel: 1 } }] },
      { id: 'wellness', icon: 'ti-bath', name: 'Wellness-Tag', kosten: 0.15, moral: 5, fitness: 6, risiko: 0.5,
        kann: [{ p: 0.25, gut: false, text: 'Fast zu entspannt: Die Spannung fürs nächste Spiel fehlt ein wenig.', wirk: { spiel: -2 } }] },
      { id: 'praemie', icon: 'ti-coin', name: 'Siegprämie', kosten: 0.3, nurSieg: true, moral: 3, spiel: 2,
        kann: [{ p: 0.15, gut: false, text: 'Der Druck ist spürbar – {N} wirkt nervös.', wirk: { einer: { moral: -3 }, zwei: true } }] },
      { id: 'trip', icon: 'ti-plane', name: 'Kurztrip', kosten: 0.6, moral: 8, fitness: 10, nurPause: true,
        kann: [{ p: 0.1, gut: false, text: '{N} hat sich beim Ausflug leicht verletzt.', wirk: { einer: { verletzt: [1, 2] } } },
          { p: 0.3, gut: true, text: 'Die Neuen sind jetzt richtig angekommen.', wirk: { neu: 5 } }] }
    ],
    STRAFE: [
      { id: 'geld', icon: 'ti-receipt', name: 'Mannschaftsstrafe', kosten: -0.05, moral: -3,
        kann: [{ p: 0.5, gut: true, text: 'Der Weckruf sitzt – die Mannschaft will es zeigen.', wirk: { spiel: 2 } },
          { p: 0.3, gut: false, text: 'Trotz in der Kabine – die Stimmung kippt.', wirk: { spiel: -2 } }] },
      { id: 'straftraining', icon: 'ti-run', name: 'Straftraining', kosten: 0, moral: -4, fitness: -6,
        kann: [{ p: 0.5, gut: true, text: 'Konzentration und Wille steigen.', wirk: { spiel: 2 } },
          { p: 0.2, gut: false, text: '{N} hat sich beim Straftraining verletzt.', wirk: { einer: { verletzt: [1, 1] } } }] },
      { id: 'predigt', icon: 'ti-speakerphone', name: 'Kabinenpredigt', kosten: 0, moral: -2,
        kann: [{ p: 0.4, gut: true, text: 'Die Ansage kommt an.', wirk: { spiel: 3 } },
          { p: 0.3, gut: false, text: '{N} fühlt sich zu Unrecht angegriffen.', wirk: { einer: { moral: -6 }, fuehrung: true } }] }
    ]
  };

  // ── Zustand ───────────────────────────────────────────────────────────────
  const da = () => typeof CLUB !== 'undefined' && CLUB && typeof LEAGUE !== 'undefined' && LEAGUE && typeof SQUAD !== 'undefined';
  function zustand() { if (!CLUB.ksBelohnung) CLUB.ksBelohnung = { genutzt: {} }; if (!CLUB.ksBelohnung.genutzt) CLUB.ksBelohnung.genutzt = {}; return CLUB.ksBelohnung; }
  function haelfte() {
    const n = (LEAGUE.matchWeeks || []).length, md = LEAGUE.matchday || 0;
    return n && md >= Math.ceil(n / 2) ? 2 : 1;
  }
  const schluessel = () => (LEAGUE.season || 1) + '-' + haelfte();
  const haelfteName = () => haelfte() === 1 ? 'Hinrunde' : 'Rückrunde';
  function frei(art) { const g = zustand().genutzt[schluessel()] || {}; return !g[art]; }
  const kader = () => SQUAD.filter(p => p && !p.onLoanAt);
  const lohn = () => kader().reduce((s, p) => s + (p.wage || 0), 0);
  const kosten = m => Math.round(lohn() * m.kosten / 1000) * 1000;
  function pause() {
    // ohne Pflichtspiel diese Woche: Vorbereitung oder Winterpause
    const w = LEAGUE.week, mw = LEAGUE.matchWeeks || [];
    if (!mw.length) return true;
    if (w < mw[0]) return true;
    return !mw.includes(w) && !(typeof CURRENT_FIXTURE !== 'undefined' && CURRENT_FIXTURE && CURRENT_FIXTURE.type !== 'friendly');
  }
  function sperre(m) {
    if (m.nurPause && !pause()) return 'nur in Vorbereitung und Pause';
    if (m.kosten > 0 && (CLUB.budget || 0) < kosten(m)) return 'zu wenig Geld';
    if (m.id === 'praemie' && zustand().praemie) return 'schon ausgelobt';
    return '';
  }

  // ── Wirkung ───────────────────────────────────────────────────────────────
  const clamp = v => Math.max(0, Math.min(100, Math.round(v)));
  const zufall = l => l[Math.floor(Math.random() * l.length)];
  function moral(spieler, d) {
    if (!d) return;
    if (typeof W.addMorale === 'function') W.addMorale(spieler, d);
    else spieler.forEach(p => { p.morale = clamp((p.morale == null ? 70 : p.morale) + d); });
  }
  function fitness(spieler, d) { if (d) spieler.forEach(p => { p.fitness = clamp((p.fitness == null ? 95 : p.fitness) + d); }); }
  function spiel(pct, label) {
    if (!pct) return;
    const alt = CLUB._nextMatchMod && CLUB._nextMatchMod.pct || 0;
    CLUB._nextMatchMod = { pct: alt + pct, scope: 'any', label };
  }
  const neue = () => kader().filter(p => p.acquiredSeason === LEAGUE.season || p.dflNeu);
  const name = p => (typeof displayName === 'function' ? displayName(p) : p.name);
  function einerWaehlen(wirk) {
    let l = kader().filter(p => !(p.injuryWeeks > 0));
    if (wirk.fuehrung) l = l.slice().sort((a, b) => (b.age || 0) - (a.age || 0) || (b.ovr || 0) - (a.ovr || 0)).slice(0, 4);
    return l.length ? zufall(l) : null;
  }
  function anwenden(m) {
    const alle = kader(), folgen = [];
    if (m.kosten) CLUB.budget = (CLUB.budget || 0) - (m.nurSieg ? 0 : kosten(m));
    moral(alle, m.moral); fitness(alle, m.fitness);
    if (m.neu) moral(neue(), m.neu);
    if (m.spiel && !m.nurSieg) spiel(m.spiel, m.name);
    if (m.nurSieg) { zustand().praemie = { betrag: kosten(m) }; spiel(m.spiel, m.name); }
    if (m.risiko) CLUB._injuryRiskMod = { weeks: 1, factor: m.risiko };
    (m.kann || []).forEach(k => {
      if (Math.random() >= k.p) return;
      const w = k.wirk; let text = k.text;
      if (w.einer) {
        const opfer = [einerWaehlen(w)]; if (w.zwei) { const z = einerWaehlen(w); if (z && z !== opfer[0]) opfer.push(z); }
        if (!opfer[0]) return;
        opfer.forEach(p => {
          if (w.einer.moral) moral([p], w.einer.moral);
          if (w.einer.fitness) fitness([p], w.einer.fitness);
          if (w.einer.verletzt) { p.injuryWeeks = w.einer.verletzt[0] + Math.floor(Math.random() * (w.einer.verletzt[1] - w.einer.verletzt[0] + 1)); p.injuryType = 'Zerrung'; }
        });
        text = text.replace('{N}', opfer.map(name).join(' und '));
      }
      if (w.spiel) spiel(w.spiel, m.name);
      if (w.moral) moral(alle, w.moral);
      if (w.neu) moral(neue(), w.neu);
      folgen.push({ gut: k.gut, text });
    });
    return folgen;
  }

  // ── Siegprämie erst nach dem Spiel ──────────────────────────────────────
  if (typeof W.processFixtureResult === 'function') {
    const _orig = W.processFixtureResult;
    W.processFixtureResult = function () {
      let gf = null, ga = null, test = false;
      try { gf = G.homeGoals; ga = G.awayGoals; test = typeof CURRENT_FIXTURE !== 'undefined' && CURRENT_FIXTURE && CURRENT_FIXTURE.type === 'friendly'; } catch (e) { /* ohne */ }
      const r = _orig.apply(this, arguments);
      try {
        const z = da() && CLUB.ksBelohnung, pr = z && z.praemie;
        if (pr && !test && gf != null) {
          if (gf > ga) { CLUB.budget = (CLUB.budget || 0) - pr.betrag; if (typeof addNews === 'function') addNews('club', 'Siegprämie ausgezahlt', `Die Mannschaft bekommt ${euro(pr.betrag)} für den Sieg.`); }
          delete z.praemie;
        }
      } catch (e) { console.warn('[Kickstil-Belohnung] Prämie', e); }
      return r;
    };
    try { processFixtureResult = W.processFixtureResult; } catch (e) { /* nur window */ }
  }

  // ── Oberfläche ────────────────────────────────────────────────────────────
  const CSS = `
  .ksb-karte{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0;padding:10px 12px;border-radius:14px;background:var(--bg2,#fffdf9);
    border:3px solid var(--k-rand,var(--border,#d9c7a6));box-shadow:0 3px 0 var(--k-rand,var(--border,#d9c7a6));color:var(--text,#2c2418)}
  .ksb-karte > span{grid-column:1 / -1;min-width:0} .ksb-karte b{display:block;font-size:14px} .ksb-karte small{font-size:12px;color:var(--text2,#6b5a43)}
  .ksb-karte button{width:100%;justify-content:center;white-space:nowrap}
  .ksb-karte button:disabled{opacity:.45;cursor:not-allowed}
  .ksb-liste{display:flex;flex-direction:column;gap:8px;margin:8px 0 12px}
  .ksb-m{display:grid;grid-template-columns:36px minmax(0,1fr) auto;align-items:center;gap:10px;padding:10px;border-radius:12px;text-align:left;width:100%;
    background:var(--bg3,#f6ead2);border:2px solid var(--border,#d9c7a6);color:inherit;font:inherit;cursor:pointer}
  .ksb-m:disabled{opacity:.5;cursor:not-allowed}
  .ksb-m > i{font-size:22px;justify-self:center} .ksb-m b{display:block;font-size:14px} .ksb-m small{font-size:12px;color:var(--text2,#6b5a43)}
  .ksb-m .ksb-preis{font-weight:800;font-size:13px;white-space:nowrap}
  .ksb-wirk{display:flex;flex-wrap:wrap;gap:4px;margin-top:3px}
  .ksb-wirk em{font-style:normal;font-size:11.5px;font-weight:700;border-radius:999px;padding:1px 7px;background:var(--bg2,#fffdf9)}
  .ksb-wirk em.gut{color:var(--gut,#3d9a2a)} .ksb-wirk em.schlecht{color:var(--schlecht,#b8402f)} .ksb-wirk em.kann{color:var(--text2,#6b5a43)}
  .ksb-folge{display:flex;gap:8px;align-items:flex-start;padding:8px 10px;border-radius:10px;margin:6px 0;background:var(--bg3,#f6ead2)}
  .ksb-folge.gut i{color:var(--gut,#3d9a2a)} .ksb-folge.schlecht i{color:var(--schlecht,#b8402f)}`;
  function stil() { if (document.getElementById('ksb-css')) return; const s = document.createElement('style'); s.id = 'ksb-css'; s.textContent = CSS; document.head.appendChild(s); }

  function wirkHtml(m) {
    const e = [];
    const z = (v, t) => v ? e.push(`<em class="${v > 0 ? 'gut' : 'schlecht'}">${t} ${v > 0 ? '+' : '−'}${Math.abs(v)}</em>`) : 0;
    z(m.moral, 'Moral'); z(m.fitness, 'Fitness'); z(m.neu, 'Neue Moral'); z(m.spiel, 'Nächstes Spiel %');
    if (m.risiko) e.push('<em class="gut">Verletzungen −50 %</em>');
    if (m.nurSieg) e.push('<em class="kann">zahlbar nur bei Sieg</em>');
    if ((m.kann || []).length) e.push('<em class="kann">kann gut oder schlecht ausgehen</em>');
    return `<span class="ksb-wirk">${e.join('')}</span>`;
  }
  function blatt() {
    let b = document.getElementById('app-blatt');
    if (!b) {
      b = document.createElement('div'); b.id = 'app-blatt';
      b.innerHTML = '<div class="app-sheet-bg"></div><div class="app-blatt-box" role="dialog" aria-modal="true"></div>';
      document.body.appendChild(b);
      b.querySelector('.app-sheet-bg').addEventListener('click', zu);
    }
    return b;
  }
  function zu() { const b = document.getElementById('app-blatt'); if (b) b.classList.remove('auf'); document.body.classList.remove('app-gesperrt'); }
  function oeffnen(art) {
    if (!da()) return; stil();
    const b = blatt(), box = b.querySelector('.app-blatt-box'), liste = art === 's' ? CFG.STRAFE : CFG.BELOHNUNG, ist = frei(art);
    delete box.dataset.spieler;
    box.innerHTML = `<div class="app-griff"></div><button class="app-blatt-zu" aria-label="Schließen"><i class="ti ti-x" aria-hidden="true"></i></button>
      <div class="ksk-bt"><i class="ti ${art === 's' ? 'ti-gavel' : 'ti-gift'}" aria-hidden="true"></i>${art === 's' ? 'Bestrafen' : 'Belohnen'} <small>· ${haelfteName()}</small></div>
      ${ist ? '' : `<p class="ksb-folge"><i class="ti ti-clock" aria-hidden="true"></i><span>In der ${haelfteName()} schon genutzt.</span></p>`}
      <div class="ksb-liste">${liste.map(m => { const s = sperre(m), k = kosten(m);
        return `<button type="button" class="ksb-m" data-ksb="${m.id}"${!ist || s ? ' disabled' : ''}><i class="ti ${m.icon}" aria-hidden="true"></i>
          <span><b>${esc(m.name)}</b>${wirkHtml(m)}${s && ist ? `<small>${esc(s)}</small>` : ''}</span>
          <span class="ksb-preis">${m.kosten > 0 ? euro(k) : m.kosten < 0 ? '+' + euro(-k) : 'gratis'}</span></button>`; }).join('')}</div>`;
    box.onclick = ev => {
      if (ev.target.closest('.app-blatt-zu, .ksb-ok')) { zu(); return; }
      const k = ev.target.closest('[data-ksb]'); if (!k || k.disabled) return;
      const m = liste.find(x => x.id === k.dataset.ksb); if (!m || sperre(m) || !frei(art)) return;
      const g = zustand().genutzt, sl = schluessel(); g[sl] = Object.assign({}, g[sl], { [art]: m.id });
      const folgen = anwenden(m);
      if (typeof addNews === 'function') addNews('club', `${art === 's' ? 'Strafe' : 'Belohnung'}: ${m.name}`, folgen.map(f => f.text).join(' ') || 'Die Mannschaft nimmt es auf.');
      box.innerHTML = `<div class="app-griff"></div><button class="app-blatt-zu" aria-label="Schließen"><i class="ti ti-x" aria-hidden="true"></i></button>
        <div class="ksk-bt"><i class="ti ${m.icon}" aria-hidden="true"></i>${esc(m.name)}</div>${wirkHtml(Object.assign({}, m, { kann: [] }))}
        ${folgen.length ? folgen.map(f => `<div class="ksb-folge ${f.gut ? 'gut' : 'schlecht'}"><i class="ti ${f.gut ? 'ti-trending-up' : 'ti-trending-down'}" aria-hidden="true"></i><span>${esc(f.text)}</span></div>`).join('')
          : '<div class="ksb-folge gut"><i class="ti ti-check" aria-hidden="true"></i><span>Alles nach Plan, keine Nebenwirkungen.</span></div>'}
        <button type="button" class="app-knopf ksk-fertig ksb-ok">Fertig</button>`;
      try { if (typeof saveGameState === 'function') saveGameState(); } catch (e) { /* Tests */ }
      karte();
    };
    b.classList.add('auf'); document.body.classList.add('app-gesperrt');
  }
  function karte() {
    const c = document.getElementById('training-content'); if (!c || !da()) return;
    stil();
    const fb = frei('b'), fs = frei('s');
    const html = `<span><b>Mannschaft</b><small>${haelfteName()}: Belohnung ${fb ? 'frei' : 'genutzt'} · Strafe ${fs ? 'frei' : 'genutzt'}</small></span>
      <button type="button" class="app-knopf" data-ksb-auf="b"${fb ? '' : ' disabled'}><i class="ti ti-gift" aria-hidden="true"></i> Belohnen</button>
      <button type="button" class="app-knopf" data-ksb-auf="s"${fs ? '' : ' disabled'}><i class="ti ti-gavel" aria-hidden="true"></i> Bestrafen</button>`;
    let k = c.querySelector('.ksb-karte');
    if (!k) {
      k = document.createElement('div'); k.className = 'ksb-karte';
      k.addEventListener('click', ev => { const x = ev.target.closest('[data-ksb-auf]'); if (x && !x.disabled) oeffnen(x.dataset.ksbAuf); });
    }
    // direkt unter der Trainings-Karte (Intensität · Schwerpunkt)
    const vor = c.querySelector(':scope > .ksk-tr-neu > .ksk-einst') || c.querySelector(':scope > .ksk-tr-neu');
    if (vor && vor.nextElementSibling !== k) vor.after(k); else if (!vor && !k.parentNode) c.prepend(k);
    if (k.dataset.sig !== html) { k.innerHTML = html; k.dataset.sig = html; }
  }
  // Training wird neu gezeichnet → Karte jeweils wieder einsetzen (gebündelt)
  let warte = 0;
  const mo = new MutationObserver(() => { if (warte) return; warte = requestAnimationFrame(() => { warte = 0; try { karte(); } catch (e) { /* still */ } }); });
  function start() { const c = document.getElementById('training-content'); if (c) { mo.observe(c, { childList: true, subtree: false }); karte(); } else setTimeout(start, 1000); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  W.KSBelohnung = { CFG, oeffnen, frei, haelfte, karte, KD };
  console.log('[Kickstil-Belohnung v1] aktiv — Belohnen und Bestrafen einmal je Halbserie, mit Kann-Folgen');
})();
