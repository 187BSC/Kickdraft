/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · TRAINERTEAM  ·  v1   (Nutzer 2026-10-16: Punkt 5 der Liste „Trainerteam“)
   ─────────────────────────────────────────────────────────────────────────
   Drei Personen mit Namen, Alter und 1–5 Sternen (Verein-Reiter, Abschnitt „Trainerteam“):
     · CO-TRAINER       Feldspieler bis 30 unter ihrem Potenzial: zusätzliche Trainingschance je Woche (CFG.co, 1★ = 0)
     · TORWARTTRAINER   Torhüter bis 34 unter ihrem Potenzial: zusätzliche Trainingschance je Woche (CFG.tw)
     · CHEFSCOUT        seine Sterne bestimmen, wie oft die Chefscout-Note danebenliegt (kickstil_scouting.js)
   Jede Karriere startet mit einem 2★-Stab – der steckt schon in den Betriebskosten. Bessere Leute kosten je Saison
   MEHR (schwächere sparen etwas): mehrkosten = basis[Liga] × (F[Sterne] − F[2★]). Gebucht zum Saisonstart, beim Wechsel
   anteilig für den Rest der Saison (Differenz alt → neu). Je Rolle 3 Kandidaten, neu zu jeder Saison.
   Beträge zur Abstimmung (CLAUDE.md: neue Preise erst besprechen) – stehen in CFG.basis.
   Zustand CLUB.welt.trainerteam (Weltzustand – Karrierestart leert ihn). API: KSTrainerteam.sterne(rolle) · .stab() · .oeffnen(rolle)
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const CFG = {
    basis: { bundesliga: 600000, bundesliga2: 150000, liga3: 35000, regionalliga: 10000 },   // je Rolle und Saison
    faktor: [0.5, 1, 1.6, 2.4, 3.4],                                                           // Gehalt je Sterne (Index = Sterne − 1)
    co: [0, 0.006, 0.012, 0.02, 0.03],         // Zusatzchance je Woche und Feldspieler (Normal-Training ≈ 0,14)
    tw: [0, 0.015, 0.03, 0.045, 0.06],         // Zusatzchance je Woche und Torhüter
    coAlter: 30, twAlter: 34,
    kandidaten: 3,
    mittel: { bundesliga: 3.4, bundesliga2: 2.9, liga3: 2.5, regionalliga: 2.0 }               // Sterne-Mittel der Kandidaten
  };
  const ROLLEN = {
    co: { name: 'Co-Trainer', icon: 'ti-clipboard-list', wirkung: s => s <= 1 ? 'kein Entwicklungsbonus' : `Entwicklung der Feldspieler bis ${CFG.coAlter} +${Math.round(CFG.co[s - 1] / 0.14 * 100)} %` },
    tw: { name: 'Torwarttrainer', icon: 'ti-hand-stop', wirkung: s => s <= 1 ? 'kein Entwicklungsbonus' : `Entwicklung der Torhüter bis ${CFG.twAlter} +${Math.round(CFG.tw[s - 1] / 0.14 * 100)} %` },
    scout: { name: 'Chefscout', icon: 'ti-telescope', wirkung: s => `Chefscout-Note liegt ${['oft', 'manchmal', 'ab und zu', 'selten', 'fast nie'][s - 1]} daneben` }
  };
  const ARTEN = {
    co: ['Taktikfuchs', 'Menschenfänger', 'Detailarbeiter', 'Ex-Profi', 'Laptop-Trainer', 'Ausbilder'],
    tw: ['Reflex-Schule', 'Strafraumbeherrscher', 'Ex-Nationaltorwart', 'Fußarbeit-Spezialist', 'Ruhiger Typ'],
    scout: ['Weltenbummler', 'Datenmensch', 'Auge für Talente', 'Netzwerker', 'Alter Hase']
  };
  const VORNAMEN = ['Jürgen', 'Thomas', 'Michael', 'Andreas', 'Frank', 'Stefan', 'Ralf', 'Uwe', 'Carsten', 'Holger', 'Markus', 'Dirk',
    'Sven', 'Jens', 'Torsten', 'Matthias', 'Oliver', 'Christian', 'Rainer', 'Bernd', 'Heiko', 'Volker', 'Sabine', 'Petra', 'Anja', 'Nicole'];
  const NACHNAMEN = ['Hoffmann', 'Krüger', 'Vogt', 'Sauer', 'Lange', 'Brandt', 'Keller', 'Busch', 'Pohl', 'Sander', 'Voss', 'Lorenz',
    'Winkler', 'Kraus', 'Schreiber', 'Albers', 'Thiel', 'Petersen', 'Berg', 'Horn', 'Pfeifer', 'Seidel', 'Kuhn', 'Linke', 'Maurer', 'Decker', 'Reuter', 'Ziegler'];

  const hatSpiel = () => { try { return typeof CLUB !== 'undefined' && CLUB && typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.tiers; } catch (e) { return false; } };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const euro = v => typeof formatEuro === 'function' ? formatEuro(v) : Math.round(v).toLocaleString('de-DE') + ' €';
  const zuf = a => a[Math.floor(Math.random() * a.length)];
  const sterneHtml = s => `<span class="kst-sterne" role="img" aria-label="${s} von 5 Sternen">${[1, 2, 3, 4, 5].map(i => `<i class="ti ti-star-filled${i > s ? ' aus' : ''}" aria-hidden="true"></i>`).join('')}</span>`;
  function tierKey() {
    try { const g = allGroups(LEAGUE).find(x => x.group.teams.some(t => t.id === 'fcm')); return g ? g.tierKey : 'liga3'; } catch (e) { return 'liga3'; }
  }
  const mehr = (s, tk) => Math.round((CFG.basis[tk || tierKey()] || CFG.basis.liga3) * (CFG.faktor[s - 1] - CFG.faktor[1]) / 500) * 500;
  const restAnteil = () => { const sw = typeof SEASON_WEEKS === 'number' ? SEASON_WEEKS : 52; return Math.max(0, Math.min(1, (sw - (LEAGUE.week || 1)) / sw)); };

  function person(rolle, sterne) {
    return { id: rolle + '_' + Math.random().toString(36).slice(2, 8), rolle, vorname: zuf(VORNAMEN), name: zuf(NACHNAMEN),
      alter: 36 + Math.floor(Math.random() * 28), sterne, art: zuf(ARTEN[rolle]) };
  }
  function kandidatenSterne() {
    const m = CFG.mittel[tierKey()] || 2.5;
    return Math.max(1, Math.min(5, Math.round(m + (Math.random() + Math.random() + Math.random() - 1.5) * 1.6)));
  }
  function neueKandidaten(T) {
    T.kandidaten = {}; T.kandSaison = LEAGUE.season;
    Object.keys(ROLLEN).forEach(r => {
      const liste = [];
      for (let i = 0; i < CFG.kandidaten; i++) liste.push(person(r, kandidatenSterne()));
      liste.sort((a, b) => b.sterne - a.sterne);
      T.kandidaten[r] = liste;
    });
  }
  const erbSterne = () => Math.max(1, Math.min(5, Math.ceil(((CLUB.facilities && CLUB.facilities.scouting) || 1) / 2)));
  function z() {
    if (!CLUB.welt) CLUB.welt = {};
    let T = CLUB.welt.trainerteam;
    if (!T) {
      T = CLUB.welt.trainerteam = { stab: {}, kandidaten: {}, kandSaison: 0, gebucht: LEAGUE.season };   // Startsaison steckt im Budget
      Object.keys(ROLLEN).forEach(r => { T.stab[r] = person(r, 2); });
      // Chefscout übernimmt die bisherigen Sterne aus der Scouting-Stufe (alte Spielstände bleiben gleich)
      T.stab.scout.sterne = erbSterne(); T.stab.scout.geerbt = true; T.v2 = 1;
    }
    // 2026-10-16: Der geerbte Chefscout gehört zur Scouting-Abteilung – er wächst mit ihrem Ausbau und kostet weder mehr noch
    // weniger als der Standard (vorher: 5★ aus Stufe 9–10 kostete automatisch 2,4 × Grundbetrag, 1★ brachte eine „Ersparnis“).
    if (!T.v2) { T.v2 = 1; const sc = T.stab.scout; if (sc && sc.sterne === erbSterne() && !sc.verpflichtet) sc.geerbt = true; }
    if (T.stab.scout && T.stab.scout.geerbt) T.stab.scout.sterne = erbSterne();
    if (T.kandSaison !== LEAGUE.season) neueKandidaten(T);
    return T;
  }
  function sterne(rolle) {
    if (!hatSpiel()) return 0;
    try { const p = z().stab[rolle]; return p ? p.sterne : 0; } catch (e) { return 0; }
  }

  // ── Wirkung: Zusatz-Training je Woche ──────────────────────────────────────
  const istTW = p => p.pos === 'TW' || (p.positions || []).indexOf('TW') === 0;
  function plusEins(p) {
    const vorher = p.ovr || 0;
    let best = null;
    ['def', 'mid', 'att', 'pace'].forEach(a => {
      if ((p[a] || 50) >= 98) return;
      const t = Object.assign({}, p, { [a]: (p[a] || 50) + 1 });
      const o = typeof computeOvrFromAreas === 'function' ? computeOvrFromAreas(t) : vorher;
      const g = o - vorher + Math.random() * 0.01;
      if (!best || g > best.g) best = { a, g };
    });
    if (!best) return false;
    p[best.a] = Math.min(98, (p[best.a] || 50) + 1);
    if (typeof computeOvrFromAreas === 'function') p.ovr = computeOvrFromAreas(p);
    if (typeof computeMarketValue === 'function') p.value = computeMarketValue(p);
    try { const t = CLUB.training; if (t && t.totalGains) t.totalGains[p.id] = (t.totalGains[p.id] || 0) + 1; } catch (e) { /* ohne Bericht */ }
    return true;
  }
  function woche() {
    if (!hatSpiel() || typeof SQUAD === 'undefined') return;
    const co = CFG.co[sterne('co') - 1] || 0, tw = CFG.tw[sterne('tw') - 1] || 0;
    if (!co && !tw) return;
    SQUAD.forEach(p => {
      if (!p || p.injured || (p.injuryWeeks || 0) > 0) return;
      if ((p.ovr || 0) >= (p.truePotential || (p.ovr || 0) + 5)) return;
      const g = istTW(p);
      const ch = g ? ((p.age || 25) <= CFG.twAlter ? tw : 0) : ((p.age || 25) <= CFG.coAlter ? co : 0);
      if (ch && Math.random() < ch) plusEins(p);
    });
  }

  // ── Kosten ─────────────────────────────────────────────────────────────────
  function saisonKosten() { const T = z(); return Object.keys(ROLLEN).reduce((a, r) => a + (T.stab[r] && T.stab[r].geerbt ? 0 : mehr(T.stab[r] ? T.stab[r].sterne : 2)), 0); }
  function saisonBuchen() {
    const T = z();
    if (T.gebucht === LEAGUE.season) return;
    T.gebucht = LEAGUE.season;
    const k = saisonKosten();
    if (!k) return;
    CLUB.budget = (CLUB.budget || 0) - k;
    if (typeof addNews === 'function') addNews('club', k > 0 ? '🧑‍🏫 Trainerteam: Mehrkosten' : '🧑‍🏫 Trainerteam: Ersparnis',
      k > 0 ? `Dein Trainerteam kostet diese Saison ${euro(k)} mehr als ein Standard-Stab.` : `Dein günstiges Trainerteam spart diese Saison ${euro(-k)}.`);
  }
  function verpflichten(rolle, id) {
    if (!hatSpiel() || !ROLLEN[rolle]) return false;
    const T = z(), k = (T.kandidaten[rolle] || []).find(x => x.id === id);
    if (!k) return false;
    const alt = T.stab[rolle], kosten = Math.round((mehr(k.sterne) - (alt && alt.geerbt ? 0 : mehr(alt ? alt.sterne : 2))) * restAnteil() / 500) * 500;
    if (kosten > 0 && (CLUB.budget || 0) < kosten) { toast('Dafür reicht das Budget nicht (' + euro(kosten) + ').', 'warn'); return false; }
    CLUB.budget = (CLUB.budget || 0) - kosten;
    T.stab[rolle] = k; k.verpflichtet = true; delete k.geerbt;
    if (alt) delete alt.geerbt;
    T.kandidaten[rolle] = T.kandidaten[rolle].filter(x => x.id !== id).concat(alt ? [alt] : []).sort((a, b) => b.sterne - a.sterne);
    if (typeof addNews === 'function') addNews('club', `🧑‍🏫 Neuer ${ROLLEN[rolle].name}`,
      `${k.vorname} ${k.name} (${k.sterne}★, ${k.art}) übernimmt.${kosten ? ` Für den Rest der Saison: ${kosten > 0 ? euro(kosten) + ' Mehrkosten' : euro(-kosten) + ' gespart'}.` : ''}`);
    toast(`${k.vorname} ${k.name} ist dein neuer ${ROLLEN[rolle].name}`, 'success');
    try { if (typeof saveGameState === 'function') saveGameState(); } catch (e) { /* später */ }
    try { if (typeof renderClubTab === 'function') renderClubTab(); } catch (e) { /* Ansicht optional */ }
    try { if (window.KSScouting && KSScouting.zeichne) KSScouting.zeichne(); } catch (e) { /* Ansicht optional */ }
    return true;
  }
  const toast = (t, art) => { if (typeof window.showToast === 'function') window.showToast(t, art || 'info'); };

  // ── Anzeige ────────────────────────────────────────────────────────────────
  const kostenText = v => v === 0 ? 'Standard' : v > 0 ? '+' + euro(v) + ' je Saison' : '−' + euro(-v) + ' je Saison';
  function zeichnen() {
    if (!hatSpiel()) return;
    const view = document.getElementById('view-club'); if (!view) return;
    let el = document.getElementById('ks-trainerteam');
    if (!el) {
      el = document.createElement('section'); el.id = 'ks-trainerteam'; el.className = 'kst';
      const fac = document.getElementById('club-facilities');
      if (fac && fac.parentNode) fac.parentNode.insertBefore(el, fac.nextSibling); else view.appendChild(el);
    }
    const T = z(), k = saisonKosten();
    el.innerHTML = `<div class="kst-kopf"><b><i class="ti ti-users-group" aria-hidden="true"></i> Trainerteam</b><small>${esc(kostenText(k))}</small></div>
      ${Object.keys(ROLLEN).map(r => { const p = T.stab[r], R = ROLLEN[r]; return `<div class="kst-zeile">
        <i class="ti ${R.icon}" aria-hidden="true"></i><span><small>${R.name}</small><b>${esc(p.vorname + ' ' + p.name)} <em>${p.alter}</em></b>
        ${sterneHtml(p.sterne)}<small>${esc(p.art)} · ${esc(R.wirkung(p.sterne))}</small></span>
        <button type="button" class="kst-knopf" data-kst-rolle="${r}">Wechseln</button></div>`; }).join('')}`;
  }
  let BLATT = null;
  function oeffnen(rolle) {
    if (!hatSpiel() || !ROLLEN[rolle]) return;
    if (!BLATT) {
      BLATT = document.createElement('div'); BLATT.id = 'ks-tt-blatt';
      BLATT.innerHTML = '<div class="kstb-bg"></div><div class="kstb-box" role="dialog" aria-modal="true"></div>';
      BLATT.addEventListener('click', ev => {
        if (ev.target.closest('.kstb-bg') || ev.target.closest('.kstb-zu')) { BLATT.classList.remove('auf'); return; }
        const v = ev.target.closest('[data-kst-holen]');
        if (v && verpflichten(v.getAttribute('data-kst-r'), v.getAttribute('data-kst-holen'))) BLATT.classList.remove('auf');
      });
      document.body.appendChild(BLATT);
    }
    const T = z(), alt = T.stab[rolle], R = ROLLEN[rolle];
    BLATT.querySelector('.kstb-box').setAttribute('aria-label', R.name + ' wechseln');
    BLATT.querySelector('.kstb-box').innerHTML = `<div class="kstb-griff"></div>
      <div class="kstb-kopf"><b>${R.name} wechseln</b><button type="button" class="kstb-zu" aria-label="Schließen"><i class="ti ti-x" aria-hidden="true"></i></button></div>
      <p class="kstb-info">Jetzt: <b>${esc(alt.vorname + ' ' + alt.name)}</b> ${sterneHtml(alt.sterne)} · ${esc(kostenText(mehr(alt.sterne)))}. Neue Kandidaten zu jeder Saison.
        Beim Wechsel zahlst du den Unterschied anteilig für den Rest der Saison.</p>
      ${(T.kandidaten[rolle] || []).map(k => { const d = Math.round((mehr(k.sterne) - mehr(alt.sterne)) * restAnteil() / 500) * 500; return `<div class="kst-zeile">
        <i class="ti ${R.icon}" aria-hidden="true"></i><span><b>${esc(k.vorname + ' ' + k.name)} <em>${k.alter}</em></b>${sterneHtml(k.sterne)}
        <small>${esc(k.art)} · ${esc(R.wirkung(k.sterne))}</small><small>${esc(kostenText(mehr(k.sterne)))}</small></span>
        <button type="button" class="kst-knopf gruen" data-kst-r="${rolle}" data-kst-holen="${k.id}">Holen<small>${d === 0 ? 'kostenlos' : d > 0 ? euro(d) : '+' + euro(-d)}</small></button></div>`; }).join('')}`;
    requestAnimationFrame(() => BLATT.classList.add('auf'));
  }
  document.addEventListener('click', ev => {
    const b = ev.target.closest && ev.target.closest('[data-kst-rolle]');
    if (b) { ev.preventDefault(); oeffnen(b.getAttribute('data-kst-rolle')); }
  });

  // ── Einhängen ──────────────────────────────────────────────────────────────
  if (typeof window.advanceCalendarWeek === 'function') {
    const _w = window.advanceCalendarWeek;
    window.advanceCalendarWeek = function () {
      const r = _w.apply(this, arguments);
      try { if (r) woche(); } catch (e) { console.warn('[Kickstil-Trainerteam] Woche', e); }
      return r;
    };
    try { advanceCalendarWeek = window.advanceCalendarWeek; } catch (e) { /* window reicht */ }
  }
  if (typeof window.startNewSeason === 'function') {
    const _s = window.startNewSeason;
    window.startNewSeason = function () {
      const r = _s.apply(this, arguments);
      try { if (hatSpiel()) { z(); saisonBuchen(); } } catch (e) { console.warn('[Kickstil-Trainerteam] Saison', e); }
      return r;
    };
    try { startNewSeason = window.startNewSeason; } catch (e) { /* window reicht */ }
  }
  if (typeof window.renderClubTab === 'function') {
    const _r = window.renderClubTab;
    window.renderClubTab = function () {
      const r = _r.apply(this, arguments);
      try { zeichnen(); } catch (e) { console.warn('[Kickstil-Trainerteam] Anzeige', e); }
      return r;
    };
    try { renderClubTab = window.renderClubTab; } catch (e) { /* window reicht */ }
  }

  const css = document.createElement('style');
  css.textContent = `.kst{margin:12px 0;padding:12px;border-radius:16px;border:2px solid var(--k-rand,#d9c29a);background:var(--bg2,#fffaf0)}
  html.dark .kst{background:var(--bg2,#1e2230)}
  .kst-kopf{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:8px}
  .kst-kopf b{font:700 17px/1.2 var(--font-titel,Fredoka,system-ui)}.kst-kopf small{color:var(--text3,#846d52);font-size:12px}
  .kst-zeile{display:flex;align-items:center;gap:12px;padding:9px 4px;border-top:1px solid var(--k-rand,#d9c29a)}
  .kst-zeile:first-of-type{border-top:0}
  .kst-zeile>i{font-size:24px;color:var(--k-blau,#2c7cb5)}.kst-zeile>span{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
  .kst-zeile b{font-size:14px}.kst-zeile em{font-style:normal;font-weight:400;color:var(--text3,#846d52);font-size:12px}
  .kst-zeile small{color:var(--text3,#846d52);font-size:12px;line-height:1.3}
  .kst-sterne{display:inline-flex;gap:1px;color:#e3a524;font-size:14px;margin:1px 0}.kst-sterne i.aus{color:var(--bg4,#c9b48f);opacity:.45}
  .kst-knopf{border:2px solid var(--k-rand,#d9c29a);background:transparent;color:inherit;border-radius:10px;padding:8px 10px;
    font:700 12px/1.1 var(--font-titel,system-ui);cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px}
  .kst-knopf small{font:600 10px/1 var(--font-text,system-ui);opacity:.85}
  .kst-knopf.gruen{border:0;color:#fff;background:var(--k-gruen,#25c065);box-shadow:0 3px 0 var(--k-gruen-tief,#188a46)}
  .kst-knopf.gruen small{color:#fff}
  #ks-tt-blatt{position:fixed;inset:0;z-index:9700;pointer-events:none}#ks-tt-blatt.auf{pointer-events:auto}
  .kstb-bg{position:absolute;inset:0;background:rgb(6 6 5/.62);opacity:0;transition:opacity .18s}#ks-tt-blatt.auf .kstb-bg{opacity:1}
  .kstb-box{position:absolute;left:0;right:0;bottom:0;margin:0 auto;max-width:560px;max-height:85vh;overflow-y:auto;background:var(--bg2,#fffaf0);
    color:var(--text,#2b2a26);border-radius:22px 22px 0 0;border:3px solid var(--k-rahmen,#8b5a2b);border-bottom:0;
    padding:4px 14px calc(18px + env(safe-area-inset-bottom,0px));transform:translateY(100%);transition:transform .24s cubic-bezier(.2,.8,.3,1);font-family:var(--font-text,system-ui)}
  #ks-tt-blatt.auf .kstb-box{transform:none}html.dark .kstb-box{background:var(--bg2,#1e2230)}
  .kstb-griff{width:40px;height:4px;border-radius:3px;background:var(--bg4,#c9b48f);margin:6px auto 8px}
  .kstb-kopf{display:flex;align-items:center;justify-content:space-between}.kstb-kopf b{font:700 21px/1.1 var(--font-titel,Fredoka,system-ui)}
  .kstb-zu{border:0;background:var(--bg3,#efe2c8);color:inherit;width:38px;height:38px;border-radius:12px;font-size:20px;cursor:pointer}
  .kstb-info{color:var(--text3,#846d52);font-size:13px;margin:6px 2px 10px;line-height:1.35}`;
  document.head.appendChild(css);

  window.KSTrainerteam = { CFG, ROLLEN, sterne, stab: () => (hatSpiel() ? z().stab : null), oeffnen, verpflichten, saisonKosten, mehr };
  console.log('[Kickstil-Trainerteam v1] aktiv — Co-Trainer, Torwarttrainer, Chefscout mit Sternen');
})();
