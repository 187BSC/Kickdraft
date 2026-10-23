/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · POKAL MIT ALLEN RUNDEN  ·  v1   (Nutzer 2026-10-18: „Bei Pokalspiel bitte alle Auflistung der Runde 1, Runde 2, …
   Achtel, Viertel, Halb und Finale – je nachdem, wann die fertig sind“)
   ─────────────────────────────────────────────────────────────────────────
   Liga → Pokal: unter dem Stand je Runde (1. Hauptrunde … Finale) alle Ergebnisse, sobald die Runde gespielt ist (Sieger fett,
   Elfmeterschießen, Freilos, eigener Verein hervorgehoben, Wappen), dazu die Auslosung der nächsten Runde. Die jüngste Runde
   ist aufgeklappt, ältere lassen sich aufklappen. Liest nur CUP (engine_main.js: log, currentPairings, teamLookup) – rechnet nichts.
   Hängt an: renderLgPokal (app_main.js).  API: KSPokalRunden.html()
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const RUNDEN = () => (typeof ROUND_NAMES !== 'undefined' ? ROUND_NAMES : ['1. Hauptrunde', '2. Hauptrunde', 'Achtelfinale', 'Viertelfinale', 'Halbfinale', 'Finale']);
  const pokal = () => (typeof CUP !== 'undefined' ? CUP : null);
  const RE_SPIEL = /^(.+?): (.+?) (\d+):(\d+) (.+?)(?: \(n\.E\. für (.+)\))?$/;
  const RE_FREI = /^(.+?): (.+?) \(Freilos\)$/;

  function idVon(cup, name) {
    const l = cup.teamLookup || {};
    for (const id in l) if (l[id] && l[id].name === name) return id;
    return null;
  }
  function wappen(id) {
    try { return id && window.KSVerein && KSVerein.wappen ? KSVerein.wappen(id, { klein: true }) : ''; } catch (e) { return ''; }
  }
  // Ergebnisse je Runde aus dem Pokal-Log (neueste Zeile vorn) – auch für alte Spielstände
  function runden(cup) {
    const R = RUNDEN(), aus = R.map(() => []);
    (cup.log || []).slice().reverse().forEach(z => {
      let m = RE_FREI.exec(z), i;
      if (m && (i = R.indexOf(m[1])) >= 0) { aus[i].push({ frei: true, h: m[2] }); return; }
      m = RE_SPIEL.exec(z);
      if (m && (i = R.indexOf(m[1])) >= 0) aus[i].push({ h: m[2], gh: +m[3], ga: +m[4], a: m[5], ne: m[6] || null });
    });
    return aus;
  }
  // Je Spiel zwei Zeilen wie eine Anzeigetafel: Heim oben, Gast unten, Tore rechts (Namen passen auch am Handy ganz)
  const ichName = cup => (cup.teamLookup.fcm || {}).name;
  function team(cup, name, id, tore, sieg, zusatz) {
    return `<span class="kpr-z${sieg ? ' sieg' : ''}${name === ichName(cup) ? ' du' : ''}"><span class="kpr-w">${wappen(id || idVon(cup, name))}</span><span class="kpr-n">${esc(name)}</span>${zusatz || ''}<b class="kpr-g">${tore}</b></span>`;
  }
  function spielZeile(cup, s) {
    const ich = s.h === ichName(cup) || s.a === ichName(cup);
    if (s.frei) return `<div class="kpr-spiel${ich ? ' ich' : ''}">${team(cup, s.h, null, '', true, '<small class="kpr-ne">Freilos</small>')}</div>`;
    const hSieg = s.ne ? s.ne === s.h : s.gh > s.ga, ne = s.ne ? '<small class="kpr-ne">n.E.</small>' : '';
    return `<div class="kpr-spiel${ich ? ' ich' : ''}">${team(cup, s.h, null, s.gh, hSieg, hSieg ? ne : '')}${team(cup, s.a, null, s.ga, !hSieg, hSieg ? '' : ne)}</div>`;
  }
  function auslosung(cup) {
    if (cup.winnerId || !cup.currentPairings) return '';
    const n = id => (cup.teamLookup[id] || {}).name || id;
    const paare = cup.currentPairings.map(([h, a]) => ({ h, a }));
    const ich = p => p.h === 'fcm' || p.a === 'fcm';
    paare.sort((x, y) => ich(y) - ich(x));
    return paare.map(p => `<div class="kpr-spiel offen${ich(p) ? ' ich' : ''}">${team(cup, n(p.h), p.h, '–', false)}${team(cup, n(p.a), p.a, '–', false)}</div>`).join('')
      + (cup.currentPairings._bye != null ? `<div class="kpr-spiel">${team(cup, n(cup.currentPairings._bye), cup.currentPairings._bye, '', true, '<small class="kpr-ne">Freilos</small>')}</div>` : '');
  }
  function html() {
    const cup = pokal(); if (!cup) return '';
    const R = RUNDEN(), r = runden(cup);
    try { if (!cup.winnerId && typeof ensureRoundPairings === 'function') ensureRoundPairings(cup); } catch (e) { /* ohne Auslosung */ }
    const gespielt = r.map((l, i) => i).filter(i => r[i].length);
    const letzte = gespielt.length ? gespielt[gespielt.length - 1] : -1;
    let h = '';
    R.forEach((name, i) => {
      if (r[i].length) {
        h += `<details class="kpr-runde"${i === letzte && cup.winnerId == null ? '' : ''}${i === letzte ? ' open' : ''}><summary><b>${esc(name)}</b></summary>
          ${r[i].slice().sort((a, b) => (spielIch(cup, b) - spielIch(cup, a))).map(s => spielZeile(cup, s)).join('')}</details>`;
      } else if (i === cup.roundIndex && !cup.winnerId) {
        h += `<details class="kpr-runde kpr-naechste" open><summary><b>${esc(name)}</b></summary>${auslosung(cup)}</details>`;
      } else if (i > cup.roundIndex || cup.winnerId == null) {
        h += `<div class="kpr-runde kpr-zu"><b>${esc(name)}</b></div>`;
      }
    });
    if (cup.winnerId) h = `<div class="kpr-sieger"><i class="ti ti-trophy" aria-hidden="true"></i><span class="kpr-w">${wappen(cup.winnerId)}</span><b>${esc((cup.teamLookup[cup.winnerId] || {}).name || '')}</b><small>Pokalsieger</small></div>` + h;
    return `<div class="kpr">${h}</div>`;
  }
  function spielIch(cup, s) { const n = (cup.teamLookup.fcm || {}).name; return (s.h === n || s.a === n) ? 1 : 0; }

  const _orig = window.renderLgPokal;
  if (typeof _orig === 'function') {
    window.renderLgPokal = function () {
      const r = _orig.apply(this, arguments);
      try {
        const el = document.getElementById('lg-sub-pokal');
        if (el && pokal()) {
          // die alte Liste „Bisherige Ergebnisse“ ersetzt die Rundenansicht
          el.querySelectorAll('.sb-title, .cup-log').forEach(x => x.remove());
          el.insertAdjacentHTML('beforeend', html());
        }
      } catch (e) { console.warn('[KS-Pokal] Runden', e); }
      return r;
    };
    try { renderLgPokal = window.renderLgPokal; } catch (e) { /* window reicht */ }
  }
  const st = document.createElement('style');
  st.textContent = `
  .kpr{display:flex;flex-direction:column;gap:8px;margin-top:10px}
  .kpr-runde{border-radius:12px;border:2px solid var(--k-rand,#d9c29a);background:var(--bg2,#fffaf0);padding:0 10px}
  .kpr-runde>summary{display:flex;align-items:baseline;gap:8px;padding:10px 0;cursor:pointer;list-style:none}
  .kpr-runde>summary::-webkit-details-marker{display:none}
  .kpr-runde>summary::after{content:'';margin-left:auto;width:8px;height:8px;border:solid currentColor;border-width:0 2px 2px 0;transform:rotate(45deg);opacity:.5;align-self:center}
  .kpr-runde[open]>summary::after{transform:rotate(-135deg)}
  .kpr-runde[open]{padding-bottom:8px}
  .kpr-runde b{font:700 15px/1.2 var(--font-titel,var(--font-display,system-ui))}.kpr-runde small{font-size:11.5px;color:var(--text3,#846d52)}
  .kpr-zu{display:flex;align-items:baseline;gap:8px;padding:10px;opacity:.55;border-style:dashed}
  .kpr-naechste{border-color:var(--k-blau,#2c7cb5)}
  .kpr-spiel{display:flex;flex-direction:column;gap:2px;padding:6px 6px;border-top:1px solid rgba(127,127,127,.15);font-size:13px}
  .kpr-spiel.ich{background:color-mix(in srgb,var(--k-blau,#2c7cb5) 12%,transparent);border-radius:8px;border-top-color:transparent}
  .kpr-z{display:flex;align-items:center;gap:8px;min-width:0}
  .kpr-n{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .kpr-z.sieg .kpr-n,.kpr-z.sieg .kpr-g{font-weight:800}.kpr-z:not(.sieg) .kpr-n{opacity:.75}.kpr-z.du .kpr-n{color:var(--k-blau,#2c7cb5);opacity:1}
  .kpr-spiel.offen .kpr-z .kpr-n{opacity:1}
  .kpr-w{width:18px;height:20px;flex:none}.kpr-w svg{width:100%;height:100%;display:block}
  .kpr-g{min-width:18px;text-align:right;font:800 14px/1 var(--font-zahl,system-ui)}
  .kpr-ne{font:600 10px/1 system-ui;opacity:.65;white-space:nowrap}
  .kpr-sieger{display:flex;align-items:center;gap:10px;padding:12px;border-radius:12px;background:linear-gradient(135deg,#fff3c0,#f2c14e);color:#3b2a05}
  .kpr-sieger .ti{font-size:22px}.kpr-sieger .kpr-w{width:28px;height:30px}.kpr-sieger small{margin-left:auto;font-weight:700}`;
  document.head.appendChild(st);
  window.KSPokalRunden = { html, runden };
  console.log('[KS-Pokal v1] aktiv — Pokal mit allen Runden und Auslosung');
})();
