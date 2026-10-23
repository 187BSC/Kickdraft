/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · GROSSE SPIELE  ·  v1   (gesamt_app/monetarisierung-anpassungen.md Abschnitt 4, Mockup 2026-10-16;
   Nutzer 2026-10-16: „Wirkung echt“)
   ─────────────────────────────────────────────────────────────────────────
   Je größer das Spiel, desto mehr passiert drumherum. Stufen (höchste gewinnt):
     finale       Pokalfinale, Europapokal-Endspiel
     halbfinale   Pokal- oder Europapokal-Halbfinale
     derby        Ligaspiel gegen einen Rivalen (kickstil_derby.js)
     saisonfinale letzter Spieltag, wenn es um Titel, Aufstieg oder Klassenerhalt geht (Platz ≤ 3 oder in den letzten 4)
   Vorher: Blatt „Großes Spiel“ (einmal je Spiel, Knopf über dem Anpfiff) mit Spielern, die sich melden, Sonderzeitung im
   Postfach, Pressekonferenz (Halbfinale, Finale, Derby). Während: Ticker in Gold mit Kopfzeile. Nachher: Meldung zum Ergebnis.
   WIRKUNG (echt, klein): Spieler melden sich einmal je Spiel (fest gespeichert):
     nervös      jung (≤ 21) oder wenig Spiele (< 8), ohne „Nervenstark“/„Mentalitätsspieler“   −2   (höchstens 2)
     Big Game    „Mentalitätsspieler“, „Nervenstark“ oder Routinier (≥ 30)                     +2   (höchstens 2)
     heiß        kam vom heutigen Gegner                                                       +1
     bereit      bester Spieler auf der Bank                                                   +1, wenn er spielt
   Pressekonferenz: „Favorit“ +2 fürs Team, Nervöse je −1 mehr · „Gegner stärker“ Nervosität fällt weg · „Kein Kommentar“ ±0.
   Teamstärke (computeTeamRatings) = Summe der Spieler in der Startelf ÷ 2, gedeckelt auf ±3 – über die ganze Saison gleicht
   sich das aus (Langzeitlauf prüft, dass die Meisterschaft nicht kippt).
   Zustand: CLUB.welt.gross (nur das aktuelle große Spiel). API: KSGross.stufe(fx) · .zustand() · .oeffnen() · .presse()
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const CFG = { nervoesBis: 21, nervoesSpiele: 8, routinierAb: 30, maxNervoes: 2, maxBig: 2, teiler: 2, deckel: 3, pkFavorit: 2 };
  const LABEL = { finale: 'Finale', halbfinale: 'Halbfinale', derby: 'Derby', saisonfinale: 'Saisonfinale' };
  const hatSpiel = () => { try { return typeof CLUB !== 'undefined' && CLUB && typeof LEAGUE !== 'undefined' && LEAGUE && typeof SQUAD !== 'undefined'; } catch (e) { return false; } };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const voll = p => (p.firstName ? p.firstName + ' ' : '') + p.name;
  const fx = () => { try { return CURRENT_FIXTURE && CURRENT_FIXTURE.type !== 'friendly' ? CURRENT_FIXTURE : null; } catch (e) { return null; } };
  const keyVon = f => f ? [LEAGUE.season, LEAGUE.week, f.type, f.opponentId, f.matchday || '', f.roundName || '', f.round || '', f.leg || ''].join('|') : null;
  const hat = (p, t) => typeof window.hatTrait === 'function' && window.hatTrait(p, t);
  const h32 = s => { let h = 2166136261 >>> 0; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; };
  const simLaeuft = () => { try { return !!(window.KSSimulieren && KSSimulieren.laeuft()); } catch (e) { return false; } };
  const gegnerName = f => { try { return (TEAMS.away && TEAMS.away.name) || ''; } catch (e) { return ''; } };
  const nm = s => (window.KSVereinsnamen && KSVereinsnamen.text ? KSVereinsnamen.text(s) : s);

  // ── Welche Stufe? ─────────────────────────────────────────────────────────
  function stufe(f) {
    if (!f || !hatSpiel()) return null;
    const rn = String(f.roundName || f.round || '').toLowerCase();
    if (f.type === 'pokal' || (f.type === 'euro' && f.euroKind === 'ko')) {
      if (/^finale$/.test(rn)) return 'finale';
      if (/halbfinale/.test(rn)) return 'halbfinale';
    }
    if (f.type === 'liga') {
      try { if (window.KSDerby && KSDerby.istDerby(f)) return 'derby'; } catch (e) { /* ohne Derby */ }
      try {
        if (f.matchday && typeof maxMatchday === 'function' && f.matchday >= maxMatchday(LEAGUE)) {
          const g = findFcmGroup(LEAGUE), t = computeTable(g.group.teams), i = t.findIndex(x => x.id === 'fcm') + 1;
          if (i && (i <= 3 || i > t.length - 4)) return 'saisonfinale';
        }
      } catch (e) { /* ohne Tabelle */ }
    }
    return null;
  }
  function z() { if (!CLUB.welt) CLUB.welt = {}; return CLUB.welt.gross || null; }

  // ── Spieler melden sich (einmal je Spiel, fest) ───────────────────────────
  function stimmenBauen(f, key) {
    const elf = new Set(getLineupIds()), raus = [];
    const kader = SQUAD.filter(p => p && !p.injured && !(p.injuryWeeks > 0) && !p.perspektiv);
    const inElf = kader.filter(p => elf.has(p.id)), bank = kader.filter(p => !elf.has(p.id));
    const sicher = p => hat(p, 'nervenstark') || hat(p, 'mentalitaet');
    inElf.filter(p => !sicher(p) && ((p.age || 25) <= CFG.nervoesBis || (p.gamesPlayed || 0) < CFG.nervoesSpiele))
      .sort((a, b) => h32(key + a.id) - h32(key + b.id)).filter(p => h32(key + 'n' + p.id) % 100 < 55).slice(0, CFG.maxNervoes)
      .forEach(p => raus.push({ id: p.id, art: 'nervoes', delta: -2, text: 'Ich hab kaum geschlafen.', chip: 'nervös −2' }));
    inElf.filter(p => !raus.some(r => r.id === p.id) && (sicher(p) || (p.age || 0) >= CFG.routinierAb))
      .sort((a, b) => (sicher(b) - sicher(a)) || (b.ovr - a.ovr)).slice(0, CFG.maxBig)
      .forEach(p => raus.push({ id: p.id, art: 'big', delta: 2, text: 'Für solche Spiele spielt man Fußball.', chip: 'Big Game +2' }));
    const gegner = gegnerName(f).toLowerCase();
    if (gegner) inElf.filter(p => !raus.some(r => r.id === p.id) && p.fromClub && gegner.indexOf(String(p.fromClub).toLowerCase().slice(0, 12)) >= 0).slice(0, 1)
      .forEach(p => raus.push({ id: p.id, art: 'heiss', delta: 1, text: 'Gegen die will ich unbedingt treffen.', chip: 'heiß +1' }));
    const b = bank.slice().sort((x, y) => (y.ovr || 0) - (x.ovr || 0))[0];
    if (b) raus.push({ id: b.id, art: 'bereit', delta: 1, text: 'Coach, ich bin bereit.', chip: '+1 bei Einsatz', bank: true });
    return raus;
  }
  function sicherstellen() {
    if (!hatSpiel()) return null;
    const f = fx(), s = stufe(f); if (!s) return null;
    const key = keyVon(f), alt = z();
    if (alt && alt.key === key) return alt;
    const neu = CLUB.welt.gross = { key, stufe: s, gegner: gegnerName(f), stimmen: stimmenBauen(f, key), pk: null, gezeigt: false, zeitung: false };
    zeitung(neu, f);
    return neu;
  }

  // ── Wirkung ───────────────────────────────────────────────────────────────
  function teamDelta() {
    const g = z(), f = fx();
    if (!g || !f || g.key !== keyVon(f)) return 0;
    const elf = new Set(getLineupIds());
    let summe = 0;
    g.stimmen.forEach(st => {
      if (!elf.has(st.id)) return;
      let d = st.delta;
      if (st.art === 'nervoes') { if (g.pk === 'underdog') d = 0; else if (g.pk === 'favorit') d -= 1; }
      summe += d;
    });
    let t = summe / CFG.teiler + (g.pk === 'favorit' ? CFG.pkFavorit : 0);
    t = Math.max(-CFG.deckel, Math.min(CFG.deckel, t));
    return Math.round(t * 10) / 10;
  }
  if (typeof window.computeTeamRatings === 'function') {
    const _c = window.computeTeamRatings;
    window.computeTeamRatings = function () {
      const r = _c.apply(this, arguments);
      try {
        const d = teamDelta();
        if (d && r) ['overall', 'attack', 'defense', 'mental'].forEach(k => { if (typeof r[k] === 'number') r[k] = Math.round(Math.max(30, Math.min(95, r[k] + d))); });
      } catch (e) { /* ohne Wirkung */ }
      return r;
    };
    try { computeTeamRatings = window.computeTeamRatings; } catch (e) { /* window reicht */ }
  }
  const neuRechnen = () => { try { if (typeof syncClubToTeams === 'function') syncClubToTeams(); if (typeof renderRatings === 'function') renderRatings(); } catch (e) { /* Ansicht optional */ } };
  // vor dem Anpfiff (auch „Simulieren bis …“): Stimmen festlegen, Stärke neu rechnen
  ['handleKO', 'simulateCurrentFixture'].forEach(fn => {
    if (typeof window[fn] !== 'function') return;
    const _o = window[fn];
    window[fn] = function () { try { if (sicherstellen()) neuRechnen(); } catch (e) { /* ohne */ } return _o.apply(this, arguments); };
    try { if (fn === 'handleKO') handleKO = window[fn]; else simulateCurrentFixture = window[fn]; } catch (e) { /* window reicht */ }
  });

  // ── Zeitung vorher, Meldung nachher ───────────────────────────────────────
  function zeitung(g, f) {
    if (g.zeitung || typeof addNews !== 'function') return;
    g.zeitung = true;
    const geg = nm(g.gegner || 'den Gegner');
    if (g.stufe === 'finale') addNews('club', '📰 Der Anstoß – Finalausgabe', `Sonderausgabe vor dem Endspiel gegen ${geg}: die Wege ins Finale, das Duell der Torjäger, Stimmen aus der Kabine. Die ganze Stadt redet von nichts anderem.`);
    else if (g.stufe === 'halbfinale') addNews('club', '📰 Der Anstoß – Halbfinal-Ausgabe', `Ein Sieg gegen ${geg}, und das Finale ist da. Die Zeitung widmet dem Spiel eine Sonderseite.`);
    else if (g.stufe === 'derby') { /* Derby-Ankündigung mit Bilanz kommt schon aus kickstil_derby.js */ }
    else addNews('club', '📰 Der Anstoß – Alles oder nichts', `Letzter Spieltag gegen ${geg}: Es geht um alles. Die Zeitung rechnet alle Szenarien durch.`);
  }
  if (typeof window.processFixtureResult === 'function') {
    const _p = window.processFixtureResult;
    window.processFixtureResult = function () {
      let g = null, k = null; try { g = z(); k = keyVon(fx()); } catch (e) { /* ohne */ }
      const r = _p.apply(this, arguments);
      try {
        if (g && k && g.key === k && !g.fertig) {
          g.fertig = true;
          const sieg = G.homeGoals > G.awayGoals, st = G.homeGoals + ':' + G.awayGoals;
          if (g.stufe === 'finale' || g.stufe === 'halbfinale') addNews('club', sieg ? `🏆 ${LABEL[g.stufe]}: ${st}!` : `📰 ${LABEL[g.stufe]}: ${st}`,
            sieg ? `Die Sonderseite der Zeitung feiert das ${st} gegen ${nm(g.gegner)}.` : `Die Zeitung tröstet nach dem ${st} gegen ${nm(g.gegner)}: „Erhobenen Hauptes.“`);
        }
      } catch (e) { /* ohne Meldung */ }
      return r;
    };
    try { processFixtureResult = window.processFixtureResult; } catch (e) { /* window reicht */ }
  }

  // ── Blatt „Großes Spiel“ und Pressekonferenz ─────────────────────────────
  let EL = null;
  function rahmen() {
    if (EL) return EL;
    EL = document.createElement('div'); EL.id = 'ks-gross';
    EL.innerHTML = '<div class="ksg-bg"></div><div class="ksg-box" role="dialog" aria-modal="true" aria-label="Großes Spiel"></div>';
    EL.addEventListener('click', ev => {
      if (ev.target.closest('.ksg-bg') || ev.target.closest('[data-ksg="zu"]')) { EL.classList.remove('auf'); return; }
      if (ev.target.closest('[data-ksg="presse"]')) { presse(); return; }
      const a = ev.target.closest('[data-ksg-pk]');
      if (a) { const g = z(); if (g) { g.pk = a.getAttribute('data-ksg-pk'); neuRechnen(); } oeffnen(); }
    });
    document.body.appendChild(EL);
    return EL;
  }
  const spieler = id => SQUAD.find(p => p.id === id);
  function oeffnen() {
    const g = sicherstellen(); if (!g) return false;
    g.gezeigt = true;
    const pk = { favorit: '„Wir sind Favorit.“ – Motivation +2, Nervöse noch nervöser', underdog: '„Der Gegner ist stärker.“ – kein Druck, keine Nervosität', kein: '„Kein Kommentar.“ – keine Wirkung' }[g.pk];
    const d = teamDelta();
    const zeilen = g.stimmen.map(st => { const p = spieler(st.id); if (!p) return '';
      const gut = st.delta > 0; return `<div class="ksg-zeile${st.bank ? ' bank' : ''}"><span class="ksg-pos">${esc(p.pos || '')}</span>
        <span class="ksg-txt"><b>${esc(voll(p))}</b> · ${p.age} J<small>„${esc(st.text)}“</small></span><span class="ksg-chip ${gut ? 'gut' : 'schlecht'}">${esc(st.chip)}</span></div>`; }).join('');
    rahmen().querySelector('.ksg-box').innerHTML = `<div class="ksg-kopf ${g.stufe}"><span class="ksg-marke">${esc(LABEL[g.stufe])}</span>
        <b>gegen ${esc(nm(g.gegner))}</b><small>Wirkung auf deine Elf jetzt: ${d > 0 ? '+' : d < 0 ? '−' : '±'}${String(Math.abs(d)).replace('.', ',')}</small></div>
      <div class="ksg-ueber">Deine Spieler melden sich</div>${zeilen || '<p class="ksg-leer">Die Kabine ist ruhig.</p>'}
      ${pk ? `<p class="ksg-pk-info"><b>Pressekonferenz:</b> ${esc(pk)}</p>` : ''}
      <div class="ksg-knoepfe">${g.stufe !== 'saisonfinale' && !g.pk ? '<button type="button" class="ksg-knopf zweit" data-ksg="presse">Pressekonferenz</button>' : ''}
        <button type="button" class="ksg-knopf" data-ksg="zu">Weiter</button></div>`;
    requestAnimationFrame(() => EL.classList.add('auf'));
    return true;
  }
  function presse() {
    const g = z(); if (!g) return;
    const frage = g.stufe === 'derby' ? `„Derby gegen ${nm(g.gegner)}. Gewinnen Sie diesmal?“` : `„Sind Sie gegen ${nm(g.gegner)} der Favorit?“`;
    rahmen().querySelector('.ksg-box').innerHTML = `<div class="ksg-kopf presse"><span class="ksg-marke">Pressekonferenz</span><b>${esc(frage)}</b></div>
      <button type="button" class="ksg-antwort" data-ksg-pk="favorit"><b>„Wir sind Favorit – und das sagen wir auch.“</b><span><i class="gut">Motivation +2</i><i class="schlecht">Druck: Nervöse −1 mehr</i></span></button>
      <button type="button" class="ksg-antwort" data-ksg-pk="underdog"><b>„Der Gegner ist stärker. Wir haben nichts zu verlieren.“</b><span><i class="gut">kein Druck: Nervosität weg</i></span></button>
      <button type="button" class="ksg-antwort leise" data-ksg-pk="kein"><b>„Kein Kommentar.“</b><span><i>keine Wirkung – die Zeitung stichelt</i></span></button>`;
  }
  // Einmal von selbst zeigen, sobald das große Spiel ansteht (nicht während „Simulieren bis …“); Knopf über dem Anpfiff
  setInterval(() => {
    try {
      if (!hatSpiel()) return;
      const g = sicherstellen();
      const ko = document.getElementById('ko-btn');
      if (ko && ko.parentNode) {
        let b = ko.parentNode.querySelector('[data-ksg-knopf]');
        if (g && !g.fertig) {
          if (!b) { b = document.createElement('button'); b.type = 'button'; b.className = 'ksg-banner'; b.setAttribute('data-ksg-knopf', '1'); ko.parentNode.insertBefore(b, ko); b.addEventListener('click', () => oeffnen()); }
          b.className = 'ksg-banner ' + g.stufe;
          b.textContent = `${LABEL[g.stufe]} · Spieler melden sich${g.stufe !== 'saisonfinale' && !g.pk ? ' · Pressekonferenz' : ''}`;
        } else if (b) b.remove();
      }
      if (g && !g.gezeigt && !g.fertig && !simLaeuft() && !document.querySelector('.exp-overlay, #ks-saisonende.auf, .ef-bilanz') && !document.body.classList.contains('ts-offen')) oeffnen();
      // Ticker in Gold
      const gold = !!(g && !g.fertig && document.body.classList.contains('ts-offen') && g.key === keyVon(fx()));
      document.body.classList.toggle('ks-gross', gold);
      ['finale', 'halbfinale', 'derby', 'saisonfinale'].forEach(s => document.body.classList.toggle('ks-gross-' + s, gold && g.stufe === s));
    } catch (e) { /* später */ }
  }, 1200);

  const css = document.createElement('style');
  css.textContent = `#ks-gross{position:fixed;inset:0;z-index:12350;pointer-events:none}#ks-gross.auf{pointer-events:auto}
  .ksg-bg{position:absolute;inset:0;background:rgb(6 6 5/.6);opacity:0;transition:opacity .18s}#ks-gross.auf .ksg-bg{opacity:1}
  .ksg-box{position:absolute;left:0;right:0;bottom:0;max-width:560px;margin:0 auto;max-height:90vh;overflow:auto;background:var(--bg2,#fffdf9);color:var(--text,#3b2a17);
    border:3px solid var(--k-rand,#8b5a2b);border-bottom:0;border-radius:22px 22px 0 0;padding:0 0 calc(16px + env(safe-area-inset-bottom,0px));transform:translateY(100%);
    transition:transform .24s cubic-bezier(.2,.8,.3,1);font-family:var(--font-text,system-ui)}#ks-gross.auf .ksg-box{transform:none}
  .ksg-kopf{background:#16304d;color:#fff;border-bottom:4px solid #f1c40f;padding:16px;display:flex;flex-direction:column;gap:4px;border-radius:18px 18px 0 0}
  .ksg-kopf.derby{background:#5c1f17}.ksg-kopf.saisonfinale{background:#2c3e1e}.ksg-kopf.presse{background:#2a2118}
  .ksg-kopf b{font:800 20px/1.25 var(--font-titel,var(--font-display,system-ui))}.ksg-kopf small{color:#cfe0f5;font-size:13px}
  .ksg-marke{align-self:flex-start;background:#f1c40f;color:#2a1c02;font:800 11px/1 system-ui;letter-spacing:.12em;text-transform:uppercase;padding:5px 8px;border-radius:6px}
  .ksg-ueber{font:800 12px/1 var(--font-text,system-ui);letter-spacing:.12em;text-transform:uppercase;color:var(--text3,#8e7556);padding:14px 16px 6px}
  .ksg-zeile{display:flex;align-items:center;gap:10px;margin:0 14px 8px;padding:10px 12px;border:2px solid var(--k-linie,#e3c99a);border-radius:14px;background:var(--bg2,#fffdf9)}
  .ksg-zeile.bank{border-style:dashed}.ksg-pos{font:800 12px/1 system-ui;background:var(--bg3,#f6ead2);border-radius:8px;padding:6px 7px;min-width:28px;text-align:center}
  .ksg-txt{flex:1;display:flex;flex-direction:column;gap:2px;font-size:14px}.ksg-txt small{font-style:italic;color:var(--text2,#5c4a35);font-size:13px}
  .ksg-chip{font:700 12px/1 system-ui;padding:5px 7px;border-radius:8px;white-space:nowrap}.ksg-chip.gut{color:#2f6b1f;background:#e3f2dc}.ksg-chip.schlecht{color:#a52a1e;background:#fbe3df}
  .ksg-leer,.ksg-pk-info{margin:4px 16px 8px;font-size:14px}
  .ksg-knoepfe{display:flex;gap:10px;padding:8px 14px 0}
  .ksg-knopf{flex:1;min-height:50px;border:0;border-radius:14px;background:var(--k-gruen,#78bc61);color:var(--k-gruen-text,#10230a);font:800 15px/1 var(--font-titel,system-ui);box-shadow:0 4px 0 var(--k-gruen-tief,#4d8236);cursor:pointer}
  .ksg-knopf.zweit{background:var(--bg3,#f6ead2);color:inherit;box-shadow:0 4px 0 var(--k-linie,#b59a6a)}
  .ksg-antwort{display:flex;flex-direction:column;gap:6px;text-align:left;width:calc(100% - 28px);margin:12px 14px 0;padding:12px;border:3px solid var(--k-rand,#8b5a2b);border-radius:14px;
    background:var(--bg2,#fffdf9);color:inherit;box-shadow:0 4px 0 var(--k-rand,#8b5a2b);font:inherit;cursor:pointer}
  .ksg-antwort.leise{border-color:var(--k-linie,#e3c99a);box-shadow:0 4px 0 var(--k-linie,#e3c99a)}.ksg-antwort b{font-size:15px}
  .ksg-antwort span{display:flex;gap:6px;flex-wrap:wrap}.ksg-antwort i{font:700 12px/1 system-ui;font-style:normal;padding:4px 7px;border-radius:8px;background:var(--bg3,#f6ead2)}
  .ksg-antwort i.gut{color:#2f6b1f;background:#e3f2dc}.ksg-antwort i.schlecht{color:#a52a1e;background:#fbe3df}
  .ksg-banner{display:block;width:100%;margin:0 0 8px;border:0;border-radius:12px;padding:10px 12px;font:800 13px/1.2 var(--font-text,system-ui);letter-spacing:.04em;
    background:#16304d;color:#f1c40f;border-bottom:3px solid #f1c40f;cursor:pointer}.ksg-banner.derby{background:#5c1f17}.ksg-banner.saisonfinale{background:#2c3e1e}
  body.ks-gross .ts-box{box-shadow:0 0 0 3px #f1c40f inset}body.ks-gross-finale .ts-box{background:#0f1a2b;color:#f5f6fa}
  html.dark .ksg-box{background:var(--bg2,#1e2230)}`;
  document.head.appendChild(css);

  window.KSGross = { CFG, stufe, zustand: z, oeffnen, presse, teamDelta };
  console.log('[Kickstil-Große Spiele v1] aktiv — Finale, Halbfinale, Derby, Saisonfinale: Spieler melden sich, Pressekonferenz, Wirkung ±' + CFG.deckel);
})();
