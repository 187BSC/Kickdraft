/* ===== BUNDLE: bundles/bundle_squad.js ===== */
/* Enthält (in dieser Reihenfolge): free_agents_patch.js team_strength_patch.js tactics_ui.js training_system.js training_patches.js */

/* ---------- js/free_agents_patch.js ---------- */
/* ===== free_agents_patch.js ===== */
/* ═══════════════════════════════════════════════════════════════════════════
   ABLÖSEFREIE SPIELER (FREE AGENTS)  ·  v1
   ───────────────────────────────────────────────────────────────────────────
   Ein zweiter Transfermarkt für Spieler ohne Vertrag:
   - Verpflichtung OHNE Ablöse, dafür HÖHERE Gehaltsforderung (frei verhandelbar).
   - Pool = Mischung aus:
       (a) generierten Free Agents (immer etwas Auswahl vorhanden),
       (b) von NPC-Vereinen freigestellten Spielern (an die Liga gekoppelt),
       (c) KI-Akademie-Talenten: NPC-Vereine "züchten" je nach Stärke Nachwuchs;
           bewusst mehr Durchschnitt, selten Ausnahmetalente.
   - Eigener Tab "Ablösefrei" im Transfermarkt.
   - Pool wird pro Transferfenster aufgefrischt und beim Saisonwechsel gespeist.

   Speicherung: CLUB.freeAgents (persistent im Spielstand).
   Lädt nach app_main.js, engine_main.js und npc_development_patch.js.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const CFG = {
    poolTarget:     14,    // angestrebte Anzahl Free Agents im Pool
    wagePremium:    1.35,  // Gehaltsaufschlag ggü. normalem Markt (frei verhandelbar)
    refreshPerWeek: 0.30,  // Anteil, der pro Transferfenster-Woche ausgetauscht wird
    // Saison-Zufluss von NPC-Vereinen (freigestellte Spieler)
    npcReleasesPerSeason: [3, 6],
    // KI-Akademie: wie viele Talente erzeugen die NPC-Vereine pro Saison gesamt
    academyTalentsPerSeason: [4, 8],
    maxAge: 36,
  };

  function rnd(n) { return Math.floor(Math.random() * n); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  // ── Pool-Zugriff (persistent) ──────────────────────────────────────────────
  function pool() {
    if (typeof CLUB === 'undefined') return [];
    if (!Array.isArray(CLUB.freeAgents)) CLUB.freeAgents = [];
    return CLUB.freeAgents;
  }

  // ── Einen Free Agent erzeugen ──────────────────────────────────────────────
  // Nutzt die vorhandene Marktspieler-Generierung als Basis, markiert ihn als
  // ablösefrei und hebt die Gehaltsforderung an.
  function makeFreeAgent(idSuffix, opts) {
    opts = opts || {};
    let p;
    if (typeof generateMarketPlayer === 'function') {
      const used = new Set(pool().map(x => x.id));
      // Scout-Level egal: Free Agents sind öffentlich bekannt
      p = generateMarketPlayer(used, 'fa_' + (idSuffix || Date.now()), rnd(9999), 3);
    } else {
      return null;
    }
    // Tendenziell etwas ältere Spieler (klassische Free Agents), aber nicht nur
    if (!opts.keepAge && Math.random() < 0.6) {
      p.age = Math.min(CFG.maxAge, Math.max(p.age, 26 + rnd(9))); // 26-34 bevorzugt
    }
    p.id = 'fa_' + (idSuffix || (Date.now() + '_' + rnd(99999)));
    p.freeAgent = true;
    p.fromClub = opts.fromClub || 'vereinslos';
    // Gehaltsforderung höher (frei verhandelbar)
    const baseWage = (typeof weeklyWageFor === 'function') ? weeklyWageFor(p) : (p.wage || 5000);
    p.wage = Math.round(baseWage * CFG.wagePremium);
    p.faWageDemand = p.wage;
    // keine Ablöse
    p.value = (typeof computeMarketValue === 'function') ? computeMarketValue(p) : p.value;
    p.fee = 0;
    if (typeof assignBirthday === 'function') { try { assignBirthday(p); } catch (e) {} }
    return p;
  }

  // ── KI-Akademie-Talent eines NPC-Vereins ───────────────────────────────────
  // Stärke des Vereins ~ Akademie-Niveau. Bewusst mehr Durchschnitt, selten Elite.
  function makeAcademyTalent(club) {
    const clubOvr = club ? (club.ovr || 65) : 60;
    // Akademie-Niveau aus Vereinsstärke ableiten (stärkerer Verein = besseres NLZ)
    const academyLevel = Math.max(1, Math.min(10, Math.round((clubOvr - 45) / 5)));
    const baseOvr = 44 + academyLevel * 2 + rnd(6);  // junge Rohdiamanten, eher niedrig
    const age = 16 + rnd(3);                          // 16-18
    let p;
    if (typeof generateMarketPlayer === 'function') {
      const used = new Set(pool().map(x => x.id));
      p = generateMarketPlayer(used, 'aca_' + (club ? club.id : 'x'), rnd(9999), 2);
    } else { return null; }
    p.id = 'fa_aca_' + (club ? club.id : 'x') + '_' + Date.now() + '_' + rnd(9999);
    p.age = age;
    // OVR auf Talent-Niveau drücken (junge Spieler sind noch roh)
    const scale = baseOvr / Math.max(1, p.ovr);
    p.def = Math.max(20, Math.round(p.def * scale));
    p.mid = Math.max(20, Math.round(p.mid * scale));
    p.att = Math.max(20, Math.round(p.att * scale));
    p.ovr = (typeof computeOvrFromAreas === 'function') ? computeOvrFromAreas(p) : baseOvr;

    // Potenzial: DEINE VORGABE — deutlich mehr Durchschnitt, selten Ausnahmetalente.
    const roll = Math.random();
    let potBonus;
    if (roll < 0.02) {                                  // 2% echtes Ausnahmetalent
      potBonus = 16 + Math.round(academyLevel * 1.2) + rnd(5);
    } else if (roll < 0.12) {                           // 10% gutes Talent
      potBonus = 9 + Math.round(academyLevel * 0.8) + rnd(4);
    } else {                                            // 88% solide Durchschnittsspieler
      potBonus = 2 + Math.round(academyLevel * 0.5) + rnd(4);
    }
    p.truePotential = Math.min(90, p.ovr + potBonus);
    p.freeAgent = true;
    p.fromClub = (club ? club.name : 'NLZ') + ' (Jugend)';
    p.academyProduct = true;
    const baseWage = (typeof weeklyWageFor === 'function') ? weeklyWageFor(p) : 2000;
    p.wage = Math.round(baseWage * CFG.wagePremium);
    p.faWageDemand = p.wage;
    p.value = (typeof computeMarketValue === 'function') ? computeMarketValue(p) : p.value;
    p.fee = 0;
    if (typeof assignBirthday === 'function') { try { assignBirthday(p); } catch (e) {} }
    return p;
  }

  // ── Pool auffüllen (generierte Free Agents) ────────────────────────────────
  function topUpPool() {
    const fa = pool();
    let added = 0;
    while (fa.length < CFG.poolTarget) {
      const p = makeFreeAgent(Date.now() + '_' + added);
      if (!p) break;
      fa.push(p);
      added++;
    }
    return added;
  }

  // ── Wöchentliche Auffrischung (im Transferfenster) ─────────────────────────
  function refreshWeekly() {
    const fa = pool();
    if (!fa.length) { topUpPool(); return; }
    // einen Teil austauschen
    const replace = Math.ceil(fa.length * CFG.refreshPerWeek);
    // älteste/uninteressanteste zuerst raus (niedrigstes OVR)
    fa.sort((a, b) => a.ovr - b.ovr);
    for (let i = 0; i < replace && fa.length; i++) {
      fa.shift();
    }
    topUpPool();
  }

  // ── Pool KOMPLETT neu aufbauen (jede Saison frisch) ────────────────────────
  // Leert den alten Pool und erzeugt einen frischen aus generierten Free Agents,
  // NPC-Freistellungen und KI-Akademie-Talenten.
  function regeneratePool(league) {
    if (typeof CLUB === 'undefined') return 0;
    CLUB.freeAgents = [];      // alten Pool verwerfen
    topUpPool();               // generierte Free Agents
    seasonInflux(league);      // NPC-Freistellungen + Akademie-Talente
    return pool().length;
  }
  window.FreeAgents_regenerate = regeneratePool;

  // ── NPC-Freistellungen + KI-Akademie beim Saisonwechsel ────────────────────
  function seasonInflux(league) {
    const fa = pool();
    const before = fa.length;

    // (b) NPC-Vereine stellen Spieler frei → werden Free Agents
    const nRel = CFG.npcReleasesPerSeason[0] +
      rnd(CFG.npcReleasesPerSeason[1] - CFG.npcReleasesPerSeason[0] + 1);
    const clubs = collectClubs(league);
    for (let i = 0; i < nRel && clubs.length; i++) {
      const club = pick(clubs);
      // freigestellter Spieler orientiert sich am Vereinsniveau (eher Rand-/Altspieler)
      const p = makeFreeAgent('rel_' + (club.id || i) + '_' + Date.now() + '_' + i, { fromClub: club.name });
      if (!p) continue;
      // an Vereinsstärke koppeln, eher unter dem Schnitt
      const targetOvr = Math.max(45, Math.round((club.ovr || 65) - 4 - rnd(6)));
      scalePlayerToOvr(p, targetOvr);
      p.age = Math.min(CFG.maxAge, 28 + rnd(8));  // freigestellte sind oft älter
      fa.push(p);
    }

    // (c) KI-Akademie-Talente
    const nAca = CFG.academyTalentsPerSeason[0] +
      rnd(CFG.academyTalentsPerSeason[1] - CFG.academyTalentsPerSeason[0] + 1);
    // stärkere Vereine produzieren wahrscheinlicher Talente (besseres NLZ)
    for (let i = 0; i < nAca && clubs.length; i++) {
      const club = weightedClub(clubs);
      const p = makeAcademyTalent(club);
      if (p) fa.push(p);
    }

    // Pool nicht unbegrenzt wachsen lassen: auf vernünftige Größe kappen
    capPool();
    return fa.length - before;
  }

  // Skaliert einen Spieler grob auf ein Ziel-OVR (für freigestellte NPC-Spieler).
  function scalePlayerToOvr(p, targetOvr) {
    const cur = p.ovr || 60;
    if (cur <= 0) return;
    const s = targetOvr / cur;
    p.def = Math.max(20, Math.min(95, Math.round(p.def * s)));
    p.mid = Math.max(20, Math.min(95, Math.round(p.mid * s)));
    p.att = Math.max(20, Math.min(95, Math.round(p.att * s)));
    p.ovr = (typeof computeOvrFromAreas === 'function') ? computeOvrFromAreas(p) : targetOvr;
    p.value = (typeof computeMarketValue === 'function') ? computeMarketValue(p) : p.value;
    const baseWage = (typeof weeklyWageFor === 'function') ? weeklyWageFor(p) : (p.wage || 4000);
    p.wage = Math.round(baseWage * CFG.wagePremium);
    p.faWageDemand = p.wage;
  }

  // Kappt den Pool auf eine vernünftige Maximalgröße (beste zuerst behalten).
  function capPool() {
    const fa = pool();
    const MAX = CFG.poolTarget + 16;
    if (fa.length > MAX) {
      // nach Attraktivität (OVR + Potenzial) sortieren, Beste behalten
      fa.sort((a, b) => (b.ovr + (b.truePotential || 0) * 0.3) - (a.ovr + (a.truePotential || 0) * 0.3));
      fa.length = MAX;
    }
  }

  // Alle NPC-Vereine (deutsch + ausländisch) als flache Liste.
  function collectClubs(league) {
    const out = [];
    if (league && league.tiers) {
      Object.keys(league.tiers).forEach(tk => {
        (league.tiers[tk].groups || []).forEach(g => {
          (g.teams || []).forEach(t => { if (t.id !== 'fcm') out.push(t); });
        });
      });
    }
    if (window.getForeignClubs) {
      try { window.getForeignClubs().forEach(c => out.push(c)); } catch (e) {}
    }
    return out;
  }

  // Gewichtete Vereinsauswahl: stärkere Vereine (bessere Akademie) häufiger.
  function weightedClub(clubs) {
    const weights = clubs.map(c => Math.max(1, (c.ovr || 60) - 45));
    const sum = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * sum;
    for (let i = 0; i < clubs.length; i++) { r -= weights[i]; if (r <= 0) return clubs[i]; }
    return clubs[clubs.length - 1];
  }

  // ── VERPFLICHTUNG (ohne Ablöse) ────────────────────────────────────────────
  function signFreeAgent(faId, years) {
    if (typeof isTransferWindowOpen === 'function' && !isTransferWindowOpen()) {
      alert('Das Transferfenster ist geschlossen. Auch ablösefreie Spieler können nur im Sommer (KW1-6) und Winter (Januar) verpflichtet werden.');
      return;
    }
    const fa = pool();
    const idx = fa.findIndex(p => p.id === faId);
    if (idx === -1) return;
    const p = fa[idx];
    // Vertragsdialog (nutzt den bestehenden Dialog; Ablöse = 0)
    if (years == null) { openFreeAgentDialog(p); return; }
    years = Math.max(1, Math.min((typeof MAX_CONTRACT_YEARS !== 'undefined' ? MAX_CONTRACT_YEARS : 5), years | 0));
    const wage = p.faWageDemand || p.wage;
    if ((CLUB.wageBudget || 0) < wage) {
      alert('Nicht genug freies Gehaltsbudget! ' + displayName(p) + ' fordert ' + formatEuro(wage) + '/Woche, noch frei: ' + formatEuro(CLUB.wageBudget || 0) + '/Woche.');
      return;
    }
    if (SQUAD.length >= 30) { alert('Der Kader ist voll (max. 30 Spieler).'); return; }
    CLUB.wageBudget = Math.max(0, (CLUB.wageBudget || 0) - wage);
    fa.splice(idx, 1);
    SQUAD.push({
      id: 'sq_' + p.id, name: p.name, firstName: p.firstName, flag: p.flag, country: p.country,
      joinedSeason: LEAGUE.season, acquiredSeason: LEAGUE.season, pos: p.pos, positions: p.positions, age: p.age,
      ovr: p.ovr, truePotential: p.truePotential, def: p.def, mid: p.mid, att: p.att,
      pace: p.pace, mental: p.mental, gamesPlayed: 0, seed: p.seed, value: p.value, wage,
      contractUntil: LEAGUE.season + years,
      birthWeek: p.birthWeek, birthMonth: p.birthMonth, birthDay: p.birthDay,
      fromYouth: !!p.academyProduct,
    });
    if (typeof assignBirthday === 'function') assignBirthday(SQUAD[SQUAD.length - 1]);
    if (typeof assignShirtNumbers === 'function') assignShirtNumbers();
    if (!CLUB.transferHistory) CLUB.transferHistory = [];
    CLUB.transferHistory.unshift({ type: 'buy', name: p.name, amount: 0, season: LEAGUE.season });
    if (window.EXP && typeof EXP.hookTransfer === 'function') {
      try { EXP.hookTransfer(SQUAD[SQUAD.length - 1], 'buy'); } catch (e) {}
    }
    addNews('transfer', `Ablösefrei: ${p.flag ? p.flag + ' ' : ''}${p.name}`,
      `${clubShort()} verpflichtet ${p.name} (${p.age}, ${p.pos}, OVR ${p.ovr}) ablösefrei — Vertrag bis ${seasonEndYear(LEAGUE.season + years)}, Gehalt ${formatEuro(wage)}/Woche.${p.academyProduct ? ' Ein Nachwuchstalent aus einem fremden NLZ.' : ''}`);
    if (typeof renderAll === 'function') renderAll();
    renderFreeAgentList();
    if (typeof renderTransferTab === 'function') renderTransferTab();
    if (typeof saveGameState === 'function') saveGameState();
  }
  window.signFreeAgent = signFreeAgent;

  // Vertragsdialog für Free Agents (ohne Ablöse, mit Gehalt je Laufzeit)
  function openFreeAgentDialog(p) {
    const maxY = (typeof MAX_CONTRACT_YEARS !== 'undefined') ? MAX_CONTRACT_YEARS : 5;
    const wage = p.faWageDemand || p.wage;
    const ov = document.createElement('div');
    ov.className = 'contract-overlay';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px';
    let rows = '';
    for (let y = 1; y <= maxY; y++) {
      const until = LEAGUE.season + y;
      // längere Verträge = etwas höhere Gehaltsforderung (Sicherheit für den Spieler)
      const yWage = Math.round(wage * (1 + (y - 1) * 0.04));
      const afford = (CLUB.wageBudget || 0) >= yWage;
      rows += `<button class="contract-year-btn" ${afford ? '' : 'disabled'} onclick="__signFA('${p.id}',${y})"
          style="display:flex;justify-content:space-between;align-items:center;width:100%;padding:10px 12px;margin-bottom:6px;border-radius:8px;border:1px solid var(--border,#30363d);background:${afford ? 'var(--bg3,#21262d)' : 'var(--bg2,#161b22)'};color:var(--text,#e6edf3);cursor:${afford ? 'pointer' : 'not-allowed'};opacity:${afford ? 1 : .5}">
          <span><b>${y} ${y === 1 ? 'Jahr' : 'Jahre'}</b> · bis ${seasonEndYear(until)}</span>
          <span style="text-align:right"><b style="color:#3fb950">ablösefrei</b><br><span style="font-size:11px;color:var(--text2,#8b949e)">${formatEuro(yWage)}/Woche</span></span>
        </button>`;
    }
    ov.innerHTML = `<div style="background:var(--bg2,#161b22);border:1px solid var(--border,#30363d);border-radius:12px;max-width:420px;width:100%;padding:20px">
        <div style="font-size:15px;font-weight:700;margin-bottom:4px">Ablösefrei verpflichten: ${p.flag ? p.flag + ' ' : ''}${displayName(p)}</div>
        <div style="font-size:12px;color:var(--text2,#8b949e);margin-bottom:6px">${p.age} J · ${positionsDisplay(p)} · OVR ${p.ovr} · ${p.fromClub || 'vereinslos'}</div>
        <div style="font-size:11px;color:var(--text3,#6e7681);margin-bottom:12px">Keine Ablöse — dafür verhandelt der Spieler ein höheres Gehalt. Wähle die Vertragslaufzeit:</div>
        ${rows}
        <button onclick="this.closest('.contract-overlay').remove()" style="width:100%;padding:9px;margin-top:6px;border-radius:8px;border:1px solid var(--border,#30363d);background:transparent;color:var(--text2,#8b949e);cursor:pointer">Abbrechen</button>
      </div>`;
    document.body.appendChild(ov);
  }
  window.__signFA = function (id, y) {
    const ov = document.querySelector('.contract-overlay');
    if (ov) ov.remove();
    signFreeAgent(id, y);
  };

  // ── UI: Free-Agent-Liste rendern ───────────────────────────────────────────
  function renderFreeAgentList() {
    const el = document.getElementById('tr-sub-frei');
    if (!el) return;
    const fa = pool();
    const open = (typeof isTransferWindowOpen === 'function') ? isTransferWindowOpen() : true;
    if (!fa.length) {
      el.innerHTML = '<div style="color:var(--text3);font-size:11px;padding:12px">Aktuell keine ablösefreien Spieler verfügbar. Schau im nächsten Transferfenster wieder vorbei.</div>';
      return;
    }
    // beste zuerst
    const sorted = fa.slice().sort((a, b) => (b.ovr + (b.truePotential || 0) * 0.2) - (a.ovr + (a.truePotential || 0) * 0.2));
    const scout = (CLUB.facilities && CLUB.facilities.scouting) || 1;
    const rows = sorted.map(p => {
      const potTxt = (typeof potentialDisplay === 'function') ? potentialDisplay(p, scout) : ('Pot ' + (p.truePotential || '?'));
      const wage = p.faWageDemand || p.wage;
      const tag = p.academyProduct ? '<span class="loan-tag" style="background:#1a3a1a;color:#3fb950;border-color:#3fb950">NLZ-Talent</span>' : '<span class="loan-tag">ablösefrei</span>';
      return `<div class="market-row">
        <div style="flex:1">
          <span class="pos-badge-sm pos-${p.pos}">${positionsDisplay(p)}</span>
          <span class="market-name">${p.flag ? p.flag + ' ' : ''}${displayName(p)}</span> ${tag}
          <div class="market-meta">${p.age} J · <b style="color:var(--text2)">${potTxt}</b> · DEF ${p.def} · MID ${p.mid} · ATT ${p.att} · ${p.fromClub || 'vereinslos'}</div>
        </div>
        <div class="market-value"><span style="color:#3fb950">0 €</span><br><span style="font-size:9px;color:var(--text3)">${formatEuro(wage)}/Wo</span></div>
        <div class="market-btns">
          <button class="mkt-btn" ${open ? '' : 'disabled'} onclick="signFreeAgent('${p.id}')">Verpflichten</button>
        </div>
      </div>`;
    }).join('');
    el.innerHTML = `<div style="font-size:11px;color:var(--text3);margin-bottom:8px">Ablösefreie Spieler verhandeln frei → keine Ablöse, aber höhere Gehälter. ${fa.length} verfügbar.</div><div class="market-list">${rows}</div>`;
  }
  window.renderFreeAgentList = renderFreeAgentList;

  // ── HOOKS ────────────────────────────────────────────────────────────────
  // 1) Beim Saisonwechsel: Pool KOMPLETT neu aufbauen (frische Free Agents jede Saison)
  if (typeof window.startNewSeason === 'function') {
    const _origSeason = window.startNewSeason;
    window.startNewSeason = function () {
      const r = _origSeason.apply(this, arguments);
      try {
        regeneratePool(typeof LEAGUE !== 'undefined' ? LEAGUE : null);
        if (typeof addNews === 'function') {
          addNews('transfer', `🆓 ${pool().length} ablösefreie Spieler verfügbar`,
            `Zum Saisonstart ist der Markt der ablösefreien Spieler neu — vereinslose Profis, freigestellte Spieler und Talente aus fremden NLZ. Schau im Transfermarkt unter „Ablösefrei".`);
        }
      } catch (e) { console.warn('[FreeAgents] season', e); }
      return r;
    };
    try { startNewSeason = window.startNewSeason; } catch (e) {}
  }

  // 2) Bei NEUEM SPIEL: Free-Agent-Pool frisch erzeugen (keine Altdaten)
  if (typeof window.startNewGameState === 'function') {
    const _origNewGame = window.startNewGameState;
    window.startNewGameState = async function () {
      const r = await _origNewGame.apply(this, arguments);
      try {
        CLUB.freeAgents = [];                                  // sicher leeren
        regeneratePool(typeof LEAGUE !== 'undefined' ? LEAGUE : null);
        if (typeof saveGameState === 'function') await saveGameState();
      } catch (e) { console.warn('[FreeAgents] newgame', e); }
      return r;
    };
    try { startNewGameState = window.startNewGameState; } catch (e) {}
  }

  // 3) Wöchentliche Marktauffrischung im Transferfenster
  if (typeof window.refreshMarketForWeek === 'function') {
    const _origRefresh = window.refreshMarketForWeek;
    window.refreshMarketForWeek = function () {
      const r = _origRefresh.apply(this, arguments);
      try { refreshWeekly(); } catch (e) {}
      return r;
    };
    try { refreshMarketForWeek = window.refreshMarketForWeek; } catch (e) {}
  }

  // 4) Transfer-Tab mitrendern
  if (typeof window.renderTransferTab === 'function') {
    const _origTab = window.renderTransferTab;
    window.renderTransferTab = function () {
      _origTab.apply(this, arguments);
      try { if (!pool().length) topUpPool(); renderFreeAgentList(); } catch (e) {}
    };
    try { renderTransferTab = window.renderTransferTab; } catch (e) {}
  }

  window.FreeAgents = { pool, topUpPool, seasonInflux, refreshWeekly, makeFreeAgent, makeAcademyTalent, CFG };
  console.log('[FreeAgents] aktiv — ablösefreier Markt + KI-Akademie-Talente');
})();


/* ---------- js/team_strength_patch.js ---------- */
/* ===== team_strength_patch.js ===== */
/* ═══════════════════════════════════════════════════════════════════════════
   MANNSCHAFTSSTÄRKEN & VEREINSDATEN-PATCH  v2
   ─────────────────────────────────────────────────────────────────────────
   Laden NACH engine_main.js und app_main.js (letztes oder vorletztes Script).

   Drei Bausteine:
   1. CLUB_DATA  – Stärken (def/mid/att), Stadion-Stufe, Infrastruktur-Stufen,
                   Startbudget für jeden echten Verein aus der Tabelle
   2. ONBOARDING – überschreibt ONBOARDING_LEAGUES mit korrekten OVR-Werten
                   (sichtbar im Vereinswahl-Screen)
   3. LEAGUE     – patcht alle Teams in LEAGUE.tiers nach Spielstart
   4. STARTGAME  – patcht startNewGameState: setzt bei einem echten Verein
                   die passenden Facilities, Stadionlevel und Startbudget

   Ligatypische OVR-Spannen nach Patch:
     Bundesliga    72–91  |  2. Bundesliga  63–75
     3. Liga       53–65  |  Regionalliga   43–56
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {

  // ── 0. SKALIERUNG ────────────────────────────────────────────────────────
  // Tabellen-Stufen (1–10) → OVR je Liga-Ebene
  function blStat (v) { return Math.round(55 + v * 4.2); }  // Bundesliga
  function bl2Stat(v) { return Math.round(52 + v * 3.5); }  // 2. Bundesliga
  function l3Stat (v) { return Math.round(42 + v * 3.2); }  // 3. Liga

  // capacity (Kapazität aus Tabelle) → nächstgelegene FACILITY_DEFS-Stufe (1–10)
  const STADIUM_CAPS = [6000,9000,13000,18000,25000,33000,42000,52000,62000,75000];
  function capacityToLevel(cap) {
    if (!cap || cap <= 0) return 1;
    let best = 0;
    for (let i = 1; i < STADIUM_CAPS.length; i++) {
      if (Math.abs(STADIUM_CAPS[i] - cap) < Math.abs(STADIUM_CAPS[best] - cap)) best = i;
    }
    return best + 1; // 1-basiert
  }

  // ── 1. VEREINSDATEN ──────────────────────────────────────────────────────
  // Felder: def/mid/att (1–10-Stufen), stadiumCap (Sitzplätze), budget (€),
  //         scout, training, youth (Infrastruktur 1–10)
  // OVR wird automatisch aus def/mid/att + Ligafunktion berechnet.
  const CLUBS = {

    // ════════════════════════════════════════════════════════════════════════
    //  BUNDESLIGA
    // ════════════════════════════════════════════════════════════════════════
    'FC Bayern München':
      {fn:blStat, def:9,mid:9,att:9, stadiumCap:75000, budget:80000000, scout:9,train:9,youth:9},
    'Borussia Dortmund':
      {fn:blStat, def:8,mid:8,att:8, stadiumCap:81365, budget:45000000, scout:8,train:9,youth:8},
    'RB Leipzig':
      {fn:blStat, def:8,mid:8,att:8, stadiumCap:47069, budget:40000000, scout:10,train:8,youth:6},
    'Bayer 04 Leverkusen':
      {fn:blStat, def:7,mid:9,att:9, stadiumCap:30210, budget:35000000, scout:9,train:9,youth:8},
    'VfB Stuttgart':
      {fn:blStat, def:7,mid:7,att:8, stadiumCap:60058, budget:20000000, scout:8,train:8,youth:9},
    'TSG 1899 Hoffenheim':
      {fn:blStat, def:6,mid:6,att:6, stadiumCap:30150, budget:15000000, scout:8,train:8,youth:9},
    'Eintracht Frankfurt':
      {fn:blStat, def:7,mid:8,att:7, stadiumCap:58000, budget:18000000, scout:9,train:7,youth:7},
    'SC Freiburg':
      {fn:blStat, def:6,mid:7,att:7, stadiumCap:34700, budget:12000000, scout:8,train:8,youth:9},
    'FC Augsburg':
      {fn:blStat, def:5,mid:6,att:6, stadiumCap:30660, budget:8500000,  scout:6,train:7,youth:6},
    '1. FSV Mainz 05':
      {fn:blStat, def:6,mid:6,att:7, stadiumCap:33305, budget:7000000,  scout:7,train:7,youth:8},
    'Borussia Mönchengladbach':
      {fn:blStat, def:6,mid:6,att:7, stadiumCap:54042, budget:9000000,  scout:7,train:8,youth:8},
    '1. FC Union Berlin':
      {fn:blStat, def:6,mid:5,att:6, stadiumCap:22012, budget:6500000,  scout:7,train:6,youth:6},
    'Hamburger SV':
      {fn:blStat, def:6,mid:5,att:5, stadiumCap:57000, budget:7500000,  scout:6,train:7,youth:8},
    '1. FC Köln':
      {fn:blStat, def:5,mid:5,att:6, stadiumCap:50000, budget:6000000,  scout:6,train:7,youth:8},
    'SV Werder Bremen':
      {fn:blStat, def:6,mid:6,att:6, stadiumCap:42100, budget:5500000,  scout:6,train:6,youth:7},
    'SC Paderborn 07':
      {fn:blStat, def:4,mid:4,att:5, stadiumCap:15000, budget:3500000,  scout:6,train:7,youth:5},
    'FC Schalke 04':
      {fn:blStat, def:5,mid:5,att:5, stadiumCap:62271, budget:4000000,  scout:5,train:8,youth:8},
    'SV Elversberg':
      {fn:blStat, def:4,mid:5,att:4, stadiumCap:10000, budget:2000000,  scout:4,train:5,youth:5},

    // ════════════════════════════════════════════════════════════════════════
    //  2. BUNDESLIGA
    // ════════════════════════════════════════════════════════════════════════
    'VfL Wolfsburg':
      {fn:bl2Stat, def:6,mid:7,att:7, stadiumCap:30000, budget:5000000,  scout:6,train:7,youth:7},
    '1. FC Heidenheim':
      {fn:bl2Stat, def:5,mid:6,att:6, stadiumCap:15000, budget:2200000,  scout:6,train:6,youth:4},
    'FC St. Pauli':
      {fn:bl2Stat, def:6,mid:5,att:5, stadiumCap:29546, budget:2500000,  scout:5,train:5,youth:6},
    'Hannover 96':
      {fn:bl2Stat, def:7,mid:5,att:6, stadiumCap:49000, budget:2000000,  scout:7,train:6,youth:6},
    'Hertha BSC':
      {fn:bl2Stat, def:6,mid:6,att:6, stadiumCap:74475, budget:1500000,  scout:4,train:6,youth:8},
    'SV Darmstadt 98':
      {fn:bl2Stat, def:5,mid:6,att:5, stadiumCap:17810, budget:1500000,  scout:5,train:5,youth:5},
    '1. FC Nürnberg':
      {fn:bl2Stat, def:7,mid:5,att:6, stadiumCap:50000, budget:1600000,  scout:5,train:6,youth:7},
    'VfL Bochum 1848':
      {fn:bl2Stat, def:6,mid:5,att:5, stadiumCap:26000, budget:1400000,  scout:5,train:5,youth:6},
    'Karlsruher SC':
      {fn:bl2Stat, def:6,mid:5,att:6, stadiumCap:34302, budget:1300000,  scout:5,train:6,youth:5},
    'Holstein Kiel':
      {fn:bl2Stat, def:6,mid:5,att:5, stadiumCap:15034, budget:1100000,  scout:5,train:5,youth:5},
    '1. FC Kaiserslautern':
      {fn:bl2Stat, def:6,mid:5,att:6, stadiumCap:49850, budget:1500000,  scout:5,train:5,youth:5},
    'Dynamo Dresden':
      {fn:bl2Stat, def:6,mid:5,att:6, stadiumCap:32249, budget:800000,   scout:5,train:6,youth:5},
    'Arminia Bielefeld':
      {fn:bl2Stat, def:6,mid:4,att:5, stadiumCap:26515, budget:1300000,  scout:4,train:5,youth:5},
    '1. FC Magdeburg':
      {fn:bl2Stat, def:6,mid:5,att:5, stadiumCap:30098, budget:1300000,  scout:5,train:5,youth:6},
    'SpVgg Greuther Fürth':
      {fn:bl2Stat, def:4,mid:6,att:5, stadiumCap:16626, budget:1300000,  scout:6,train:5,youth:5},
    'Eintracht Braunschweig':
      {fn:bl2Stat, def:6,mid:5,att:5, stadiumCap:23325, budget:1000000,  scout:5,train:5,youth:5},
    'VfL Osnabrück':
      {fn:bl2Stat, def:5,mid:4,att:5, stadiumCap:15741, budget:1000000,  scout:4,train:5,youth:4},
    'FC Energie Cottbus':
      {fn:bl2Stat, def:5,mid:5,att:5, stadiumCap:22528, budget:1000000,  scout:5,train:4,youth:5},

    // ════════════════════════════════════════════════════════════════════════
    //  3. LIGA
    // ════════════════════════════════════════════════════════════════════════
    'Fortuna Düsseldorf':
      {fn:l3Stat, def:7,mid:5,att:6, stadiumCap:54600, budget:1000000,  scout:5,train:6,youth:6},
    'SC Preußen Münster':
      {fn:l3Stat, def:5,mid:5,att:5, stadiumCap:12422, budget:200000,   scout:5,train:5,youth:5},
    'Jahn Regensburg':
      {fn:l3Stat, def:5,mid:5,att:5, stadiumCap:15210, budget:150000,   scout:5,train:5,youth:4},
    '1. FC Saarbrücken':
      {fn:l3Stat, def:5,mid:4,att:4, stadiumCap:16003, budget:150000,   scout:4,train:4,youth:3},
    'Rot-Weiss Essen':
      {fn:l3Stat, def:5,mid:5,att:5, stadiumCap:20000, budget:400000,   scout:5,train:5,youth:5},
    'Hansa Rostock':
      {fn:l3Stat, def:6,mid:5,att:5, stadiumCap:29000, budget:700000,   scout:5,train:5,youth:5},
    'MSV Duisburg':
      {fn:l3Stat, def:6,mid:4,att:5, stadiumCap:31500, budget:400000,   scout:4,train:5,youth:4},
    'SV Waldhof Mannheim':
      {fn:l3Stat, def:5,mid:4,att:5, stadiumCap:25667, budget:400000,   scout:4,train:5,youth:5},
    'SV Wehen Wiesbaden':
      {fn:l3Stat, def:4,mid:5,att:5, stadiumCap:15295, budget:400000,   scout:5,train:5,youth:5},
    'Alemannia Aachen':
      {fn:l3Stat, def:5,mid:4,att:5, stadiumCap:32960, budget:400000,   scout:4,train:5,youth:5},
    'FC Ingolstadt 04':
      {fn:l3Stat, def:5,mid:5,att:5, stadiumCap:15200, budget:400000,   scout:5,train:5,youth:6},
    'FC Viktoria Köln':
      {fn:l3Stat, def:4,mid:5,att:4, stadiumCap:8343,  budget:400000,   scout:5,train:4,youth:5},
    'TSG 1899 Hoffenheim II':
      {fn:l3Stat, def:4,mid:6,att:6, stadiumCap:6350,  budget:400000,   scout:7,train:7,youth:7},
    'VfB Stuttgart II':
      {fn:l3Stat, def:4,mid:6,att:6, stadiumCap:11500, budget:400000,   scout:7,train:6,youth:7},
    'SC Verl':
      {fn:l3Stat, def:4,mid:5,att:4, stadiumCap:5153,  budget:400000,   scout:5,train:4,youth:4},
    'SV Meppen':
      {fn:l3Stat, def:4,mid:4,att:4, stadiumCap:13696, budget:400000,   scout:4,train:4,youth:4},
    'Würzburger Kickers':
      {fn:l3Stat, def:4,mid:4,att:4, stadiumCap:13090, budget:400000,   scout:4,train:4,youth:4},
    'Fortuna Köln':
      {fn:l3Stat, def:4,mid:4,att:4, stadiumCap:11748, budget:400000,   scout:4,train:4,youth:4},
  };

  // ── OVR aus Vereinsdaten berechnen ───────────────────────────────────────
  function clubOvr(c) {
    return Math.round((c.fn(c.def) + c.fn(c.mid) + c.fn(c.att)) / 3);
  }

  // ── 2. ONBOARDING_LEAGUES patchen ────────────────────────────────────────
  // Läuft sofort beim Laden; ONBOARDING_LEAGUES ist zur Ladezeit bereits definiert.
  function patchOnboarding() {
    if (typeof ONBOARDING_LEAGUES === 'undefined') {
      console.warn('[TeamStrengthPatch] ONBOARDING_LEAGUES nicht gefunden');
      return;
    }

    // Helferfunktion: OVR-Wert eines Teams in ONBOARDING_LEAGUES aktualisieren
    function updateLeague(leagueArr) {
      if (!leagueArr) return;
      leagueArr.forEach(t => {
        const c = CLUBS[t.name];
        if (c) t.ovr = clubOvr(c);
      });
      leagueArr.sort((a, b) => b.ovr - a.ovr); // stärkste oben
    }

    updateLeague(ONBOARDING_LEAGUES['Bundesliga']);
    updateLeague(ONBOARDING_LEAGUES['2. Bundesliga']);
    updateLeague(ONBOARDING_LEAGUES['3. Liga']);

    // Regionalliga-Teams auf max 56 kappen (Werte waren zu hoch)
    ['Regionalliga Nord','Regionalliga Nordost','Regionalliga West',
     'Regionalliga Südwest','Regionalliga Bayern'].forEach(l => {
      const arr = ONBOARDING_LEAGUES[l];
      if (!arr) return;
      arr.forEach(t => { if (t.ovr > 56) t.ovr = Math.min(56, Math.max(43, t.ovr - 10)); });
      arr.sort((a, b) => b.ovr - a.ovr);
    });

    console.log('[TeamStrengthPatch] ONBOARDING_LEAGUES gepatcht — Bayern OVR:',
      (ONBOARDING_LEAGUES['Bundesliga'].find(t=>t.name==='FC Bayern München')||{}).ovr);
  }

  // ── 3. LEAGUE-TEAMS patchen ───────────────────────────────────────────────
  // Setzt def/mid/att/ovr in allen tiers.
  function patchLeague() {
    if (typeof LEAGUE === 'undefined' || !LEAGUE || !LEAGUE.tiers) return;
    if (typeof allGroups !== 'function') return;

    let byName = 0, rlCapped = 0;

    for (const { tierKey, group } of allGroups(LEAGUE)) {
      for (const team of group.teams) {
        if (!team || team.id === 'fcm') continue;
        const c = CLUBS[team.name];
        if (c) {
          team.def = c.fn(c.def); team.mid = c.fn(c.mid); team.att = c.fn(c.att);
          team.ovr = Math.round((team.def + team.mid + team.att) / 3);
          team.str = team.ovr;
          byName++;
        } else if (tierKey === 'regionalliga' && (team.ovr || 0) > 56) {
          // Unbekannte RL-Teams kappen
          const cap = Math.min(56, Math.max(43, (team.ovr || 56) - 10));
          team.ovr = cap; team.str = cap;
          team.def = cap - 1 + Math.round((Math.random() - 0.5) * 4);
          team.mid = cap     + Math.round((Math.random() - 0.5) * 4);
          team.att = cap + 1 + Math.round((Math.random() - 0.5) * 4);
          rlCapped++;
        }
      }
    }
    console.log(`[TeamStrengthPatch] LEAGUE gepatcht — ${byName} Teams nach Name, ${rlCapped} RL-Teams gekappt`);
  }

  // ── 4. startNewGameState patchen ─────────────────────────────────────────
  // Setzt vereinsspezifische Facilities, Stadionlevel und Startbudget.
  function patchStartNewGame() {
    const _orig = window.startNewGameState;
    if (typeof _orig !== 'function') {
      console.warn('[TeamStrengthPatch] startNewGameState nicht gefunden');
      return;
    }
    window.startNewGameState = async function(chosenTeam) {
      await _orig.apply(this, arguments);

      // Nur bei echten Vereinen aus der Tabelle
      const name = chosenTeam && chosenTeam.name;
      const c = name ? CLUBS[name] : null;
      if (!c) return;

      // Stadion-Stufe aus der Kapazität ableiten
      const stadiumLvl = Math.min(10, Math.max(1, capacityToLevel(c.stadiumCap)));
      CLUB.facilities = {
        stadium:  stadiumLvl,
        scouting: Math.min(10, Math.max(1, c.scout  || 1)),
        training: Math.min(10, Math.max(1, c.train  || 1)),
        youth:    Math.min(10, Math.max(1, c.youth  || 1)),
        // 2026-10-16: fehlte – der Merchandising-Ausbau zeigte „€NaN“ (Einnahmen rechneten schon mit Stufe 1)
        merchandising: (CLUB.facilities && CLUB.facilities.merchandising) || 1,
      };
      // Plätze, nicht die Stufe (stand hier bis 2026-10-16 – CLUB.stadiumCapacity war dann z. B. 6)
      CLUB.stadiumCapacity = (typeof stadiumCapacityForLevel === 'function') ? stadiumCapacityForLevel(stadiumLvl) : c.stadiumCap;

      // Budget aus der Tabelle (mind. ligatypisches Minimum)
      const tierKey = (function(){ try { return findFcmGroup(LEAGUE).tierKey; } catch(_){ return 'regionalliga'; } })();
      const minBudget = ({ bundesliga:2000000, bundesliga2:500000, liga3:100000, regionalliga:80000 })[tierKey] || 80000;
      CLUB.budget = Math.max(minBudget, c.budget || minBudget);

      // Nachwuchsplätze sofort auf die neuen Stufen anpassen
      if (typeof generateYouthProspects === 'function') {
        CLUB.youthProspects = [];
        generateYouthProspects();
      }

      if (typeof saveGameState === 'function') await saveGameState();
      if (typeof renderAll === 'function') renderAll();

      console.log(`[TeamStrengthPatch] ${name}: Stadion Stufe ${stadiumLvl} (${c.stadiumCap.toLocaleString('de-DE')} Pl.), Budget ${c.budget.toLocaleString('de-DE')}€, Facilities scout=${c.scout} train=${c.train} youth=${c.youth}`);
    };
    console.log('[TeamStrengthPatch] startNewGameState gepatcht');
  }

  // ── 5. fillOvrForLeague patchen ─────────────────────────────────────────
  // Auffüll-Teams in 3. Liga und Regionalliga bekommen realistischere Werte.
  function patchFillOvr() {
    if (typeof fillOvrForLeague !== 'function') return;
    const _orig = fillOvrForLeague;
    window.fillOvrForLeague = function(league) {
      const ranges = {
        'Bundesliga':          [72, 84],
        '2. Bundesliga':       [63, 74],
        '3. Liga':             [53, 65],
        'Regionalliga Nord':     [43, 56],
        'Regionalliga Nordost':  [43, 56],
        'Regionalliga West':     [43, 56],
        'Regionalliga Südwest':  [43, 56],
        'Regionalliga Bayern':   [43, 56],
      };
      const r = ranges[league];
      if (!r) return _orig(league);
      const lo = r[0], hi = r[1];
      return { def: lo+rndN(hi-lo+1), mid: lo+rndN(hi-lo+1), att: lo+rndN(hi-lo+1) };
    };
    try { fillOvrForLeague = window.fillOvrForLeague; } catch(_){}
    console.log('[TeamStrengthPatch] fillOvrForLeague gepatcht');
  }

  // ── Init ─────────────────────────────────────────────────────────────────
  function init() {
    patchOnboarding();
    patchFillOvr();
    patchStartNewGame();

    // LEAGUE patchen sobald verfügbar
    if (typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.tiers) {
      patchLeague();
    } else {
      // startNewGameState-Patch wurde bereits durch patchStartNewGame() gesetzt.
      // Nach DOMContentLoaded nochmal prüfen, falls LEAGUE erst dann bereit ist.
      document.addEventListener('DOMContentLoaded', () => {
        if (typeof LEAGUE !== 'undefined' && LEAGUE) patchLeague();
      });
    }

    // Nach jedem Saisonstart LEAGUE neu patchen
    const _afterSeason = window.startNewSeason;
    if (typeof _afterSeason === 'function') {
      window.startNewSeason = function() {
        const r = _afterSeason.apply(this, arguments);
        setTimeout(patchLeague, 100);
        return r;
      };
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.TeamStrengthPatch = { applyLeague: patchLeague, clubs: CLUBS };
  console.log('[TeamStrengthPatch v2] geladen');
})();


/* ---------- js/tactics_ui.js ---------- */
/* ===== tactics_ui.js ===== */
/* ═══════════════════════════════════════════════════════════════════════════
   TAKTIK-UI + MATCH-INTEGRATION
   ───────────────────────────────────────────────────────────────────────────
   Wird NACH app_main.js geladen (ganz am Ende, in der HTML).
   - Match-Effekt in die Momentum-Engine einhängen
   - Gegner-Formation: Anzeige nach ~12 Min (Co-Trainer liest)
   - Halbzeit: Co-Trainer-Umstellungsvorschlag
   - Eingewöhnung nach Spielende tracken
   - Spielerkarte: Technik + Stil-Sterne
   - Taktik-Tab: 6 Regler + Repertoire + Team-Stil-Bewertung
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  const T = window.TacticsSystem;
  if (!T) { console.error('TacticsSystem fehlt (UI)'); return; }

  // Laufzeit-State fürs aktuelle Match
  const MATCH_TAC = {
    oppFormation: null,
    oppRevealed: false,
    revealMin: 8 + Math.floor(Math.random() * 8), // 8..15
    effect: null,        // letztes computeMatchEffect-Ergebnis
    halftimeShown: false
  };
  window.MATCH_TAC = MATCH_TAC;

  // ── Sterne-Renderer (HTML) ─────────────────────────────────────────────────
  function starsHtml(value, size) {
    size = size || 13;
    const full = Math.floor(value);
    const half = (value - full) >= 0.5;
    let h = `<span style="display:inline-flex;gap:1px;font-size:${size}px;line-height:1;color:var(--gold)">`;
    for (let i = 0; i < 5; i++) {
      if (i < full) h += `<i class="ti ti-star-filled"></i>`;
      else if (i === full && half) h += `<i class="ti ti-star-half-filled"></i>`;
      else h += `<i class="ti ti-star" style="color:var(--bg4)"></i>`;
    }
    return h + '</span>';
  }

  // ── PATCH 0: Auto-Fill mit neuer Positions-Kompatibilität ──────────────────
  // changeFormation und autoFillLineup matchen slot.group gegen NEUE Positionen.
  if (typeof window.changeFormation === 'function') {
    window.changeFormation = function (newFormation) {
      const remaining = getLineupIds().map(getPlayer).filter(Boolean);
      const slots = FORMATIONS[newFormation];
      const newLineup = {};
      // 1. Runde: exakte/natürliche Eignung über canPlaySlotGroup
      slots.forEach(slot => {
        let idx = remaining.findIndex(p => T.canPlaySlotGroup(p, slot.group));
        if (idx === -1) return; // im 2. Durchlauf füllen
        newLineup[slot.id] = remaining.splice(idx, 1)[0].id;
      });
      // 2. Runde: restliche Slots mit übrigen Spielern auffüllen
      slots.forEach(slot => {
        if (newLineup[slot.id]) return;
        const p = remaining.shift();
        newLineup[slot.id] = p ? p.id : null;
      });
      CLUB.formation = newFormation;
      CLUB.lineup = newLineup;
      CLUB.selected = null;
      ensureCurrentInRepertoire();
      renderAll();
      recomputeMatchEffect();
      renderTacticsExtras();
    };
    try { changeFormation = window.changeFormation; } catch (e) {}
  }
  if (typeof window.autoFillLineup === 'function') {
    const _origAuto = window.autoFillLineup;
    window.autoFillLineup = function () {
      try {
        const slots = FORMATIONS[CLUB.formation];
        const pool = SQUAD.filter(p => !isInjured || !isInjured(p));
        const taken = new Set();
        const lineup = {};
        slots.forEach(slot => {
          let pick = pool.find(p => !taken.has(p.id) && T.canPlaySlotGroup(p, slot.group));
          if (pick) { taken.add(pick.id); lineup[slot.id] = pick.id; }
        });
        slots.forEach(slot => {
          if (lineup[slot.id]) return;
          const pick = pool.find(p => !taken.has(p.id));
          if (pick) { taken.add(pick.id); lineup[slot.id] = pick.id; }
        });
        CLUB.lineup = lineup;
        if (typeof renderAll === 'function') renderAll();
      } catch (e) { console.warn('autoFill-Patch fehlgeschlagen, nutze Original', e); _origAuto(); }
    };
    try { autoFillLineup = window.autoFillLineup; } catch (e) {}
  }

  // ── MATCH-EFFEKT BERECHNEN (vor Anpfiff + bei Halbzeit-Wechsel) ─────────────
  function recomputeMatchEffect() {
    if (typeof CLUB === 'undefined') return null;
    const eff = T.computeMatchEffect({
      myFormation: CLUB.formation,
      oppFormation: MATCH_TAC.oppFormation,
      tactics: CLUB.tactics6,
      lineupSlots: CLUB.lineup,
      getPlayerFn: getPlayer,
      formationSlots: FORMATIONS[CLUB.formation]
    });
    MATCH_TAC.effect = eff;
    return eff;
  }

  // ── PATCH 1: Gegner-Formation bei setOpponent zuweisen ─────────────────────
  if (typeof window.setOpponent === 'function') {
    const _origSetOpp = window.setOpponent;
    window.setOpponent = function (team) {
      _origSetOpp(team);
      MATCH_TAC.oppFormation = (typeof assignOpponentFormation === 'function')
        ? assignOpponentFormation(team) : '4-4-2';
      MATCH_TAC.oppRevealed = false;
      MATCH_TAC.revealMin = 8 + Math.floor(Math.random() * 8);
      MATCH_TAC.halftimeShown = false;
      recomputeMatchEffect();
      updateOppFormationBadge();
    };
    try { setOpponent = window.setOpponent; } catch (e) {}
  }

  // ── PATCH 2: Momentum-Engine — Effekt einfließen lassen ────────────────────
  // momentumToProbs gibt homeChance/awayChance zurück. Wir skalieren die
  // eigene Chance hoch/runter und die gegnerische gegenläufig.
  if (typeof window.momentumToProbs === 'function') {
    const _origProbs = window.momentumToProbs;
    window.momentumToProbs = function () {
      const r = _origProbs();
      const eff = MATCH_TAC.effect ? MATCH_TAC.effect.total : 0;
      if (eff !== 0) {
        // FCM ist immer "home" in der Engine-Darstellung
        const mult = 1 + eff;          // z.B. +0.09 → 1.09 mehr eigene Chancen
        const oppMult = 1 - eff * 0.6; // Gegner gegenläufig, gedämpft
        r.homeChance = Math.max(0.02, r.homeChance * mult);
        r.awayChance = Math.max(0.02, r.awayChance * oppMult);
        r.homeConv = Math.min(0.6, r.homeConv * (1 + eff * 0.5));
      }
      return r;
    };
    try { momentumToProbs = window.momentumToProbs; } catch (e) {}
  }

  // ── PATCH 3: driftMomentum — leichter Dauer-Push durchs Matchup ────────────
  if (typeof window.driftMomentum === 'function') {
    const _origDrift = window.driftMomentum;
    window.driftMomentum = function () {
      _origDrift();
      const eff = MATCH_TAC.effect ? MATCH_TAC.effect.total : 0;
      if (eff !== 0 && typeof G !== 'undefined') {
        G.momentum = Math.max(5, Math.min(95, G.momentum + eff * 8));
      }
      // Gegner-Formation aufdecken
      if (!MATCH_TAC.oppRevealed && typeof G !== 'undefined' && G.min >= MATCH_TAC.revealMin) {
        MATCH_TAC.oppRevealed = true;
        updateOppFormationBadge();
        if (typeof addEv === 'function') {
          const sign = MATCH_TAC.effect.formation;
          let hint = '';
          if (sign > 0) hint = ' Das liegt unserer Formation.';
          else if (sign < 0) hint = ' Damit tut sich unsere Formation schwer.';
          addEv('info', -1, `📋 Co-Trainer: Gegner spielt ${MATCH_TAC.oppFormation}.${hint}`);
        }
      }
    };
    try { driftMomentum = window.driftMomentum; } catch (e) {}
  }

  // ── PATCH 4: Halbzeit — Umstellungsvorschlag ───────────────────────────────
  if (typeof window.triggerHalftime === 'function') {
    const _origHT = window.triggerHalftime;
    window.triggerHalftime = function () {
      _origHT();
      showHalftimeAdvice();
    };
    try { triggerHalftime = window.triggerHalftime; } catch (e) {}
  }

  function showHalftimeAdvice() {
    if (MATCH_TAC.halftimeShown) return;
    MATCH_TAC.halftimeShown = true;
    if (!MATCH_TAC.oppFormation || typeof addEv !== 'function') return;
    const eff = MATCH_TAC.effect;
    const opp = MATCH_TAC.oppFormation;
    const best = T.bestCounterFromRepertoire(CLUB.repertoire, MATCH_TAC.oppFormation, CLUB.formation);
    // Nur raten, wenn wir im Nachteil sind UND eine bessere Option im Repertoire haben
    if (eff.formation < 0 && best.improves && best.formation && best.formation !== CLUB.formation) {
      const gain = Math.round((best.value - best.currentValue) * T.FORMATION_MAX * 100);
      addEv('info', -1, `🎙️ Co-Trainer-Tipp: Gegen ihr ${opp} stehen wir mit ${CLUB.formation} im Nachteil. ` +
        `Stell auf ${best.formation} um (Momentum-Effekt bis +${gain}%). Wechsel im Taktik-Tab.`);
    } else if (eff.formation > 0) {
      addEv('info', -1, `🎙️ Co-Trainer: Unser ${CLUB.formation} passt gut gegen ihr ${opp} — dabei bleiben.`);
    } else if (eff.formation < 0 && !best.improves) {
      addEv('info', -1, `🎙️ Co-Trainer: Gegen ihr ${opp} sind wir im Nachteil, aber im Repertoire ist keine bessere Formation. ` +
        `Über Spieler und Einstellung gegenhalten.`);
    }
  }

  // ── PATCH 5: Spielende — Eingewöhnung tracken ──────────────────────────────
  if (typeof window.triggerFulltime === 'function') {
    const _origFT = window.triggerFulltime;
    window.triggerFulltime = function () {
      // VOR processFixtureResult: Eingewöhnung der Startelf
      try {
        const ids = getLineupIds();
        const style = T.trackAdaptation(ids, getPlayer, CLUB.tactics6);
        if (typeof addEv === 'function') {
          addEv('info', -1, `📈 Eingewöhnung: Startelf sammelt Erfahrung im Stil „${T.STYLE_LABELS[style]}".`);
        }
      } catch (e) { console.warn('Adaptation-Tracking fehlgeschlagen', e); }
      _origFT();
    };
    try { triggerFulltime = window.triggerFulltime; } catch (e) {}
  }

  // ── GEGNER-FORMATIONS-BADGE im Spiel-Header ────────────────────────────────
  function updateOppFormationBadge() {
    let badge = document.getElementById('opp-formation-badge');
    if (!badge) {
      const awaySub = document.getElementById('away-str-label');
      if (!awaySub) return;
      badge = document.createElement('div');
      badge.id = 'opp-formation-badge';
      badge.style.cssText = 'font-size:10px;font-weight:700;margin-top:2px;';
      awaySub.parentNode.appendChild(badge);
    }
    if (!MATCH_TAC.oppFormation) { badge.textContent = ''; return; }
    if (MATCH_TAC.oppRevealed) {
      badge.innerHTML = `<span style="color:var(--gold)">📋 ${MATCH_TAC.oppFormation}</span>`;
    } else {
      badge.innerHTML = `<span style="color:var(--text3)">📋 Formation wird analysiert…</span>`;
    }
  }
  window.updateOppFormationBadge = updateOppFormationBadge;

  // ── SPIELERKARTE ERWEITERN ─────────────────────────────────────────────────
  if (typeof window.renderPlayerCard === 'function') {
    const _origCard = window.renderPlayerCard;
    window.renderPlayerCard = function (p) {
      _origCard(p);
      if (!p) return;
      T.migratePlayer(p);
      const el = document.getElementById('playercard-sec');
      if (!el) return;
      // Technik-Zeile nach Mentalität einfügen
      const rows = el.querySelectorAll('.pcard-row');
      let mentalRow = null;
      rows.forEach(r => { if (r.textContent.includes('Mentalität')) mentalRow = r; });
      if (mentalRow && !el.querySelector('.pcard-technik')) {
        const tr = document.createElement('div');
        tr.className = 'pcard-row pcard-technik';
        tr.innerHTML = `<span>Technik</span><b>${p.technik}</b>`;
        mentalRow.parentNode.insertBefore(tr, mentalRow.nextSibling);
      }
      // Stil-Sterne-Block anhängen
      if (!el.querySelector('.pcard-styles')) {
        const block = document.createElement('div');
        block.className = 'pcard-styles';
        block.style.cssText = 'margin-top:10px;border-top:1px solid var(--border);padding-top:8px;';
        const all = T.playerAllStars(p);
        let inner = `<div style="font-size:9px;color:var(--text3);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px">Stil-Eignung</div>`;
        for (const s of T.STYLES) {
          const so = all[s];
          const adaptTxt = so.adapt > 0 ? ` <span style="color:var(--accent);font-size:9px">+${so.adapt}</span>` : '';
          inner += `<div style="display:flex;justify-content:space-between;align-items:center;padding:2px 0">
            <span style="font-size:11px;color:var(--text2)">${T.STYLE_LABELS[s]}${adaptTxt}</span>
            ${starsHtml(so.total, 12)}</div>`;
        }
        block.innerHTML = inner;
        el.appendChild(block);
      }
    };
    try { renderPlayerCard = window.renderPlayerCard; } catch (e) {}
  }

  // ── 6 REGLER + REPERTOIRE + TEAM-BEWERTUNG ─────────────────────────────────
  const REGLER_DEFS = [
    { key:'presshoehe',  label:'Pressinghöhe',     lo:'Tief stehen',    hi:'Hoch pressen' },
    { key:'zweikampf',   label:'Zweikampf',        lo:'Auf den Beinen', hi:'Aggressiv rein' },
    { key:'passspiel',   label:'Passspiel',        lo:'Geduldig',       hi:'Direkt/Tiefe' },
    { key:'breite',      label:'Angriffsbreite',   lo:'Zentral',        hi:'Über Flügel' },
    { key:'ballgewinn',  label:'Bei Ballgewinn',   lo:'Ball sichern',   hi:'Schnell kontern' },
    { key:'ballverlust', label:'Bei Ballverlust',  lo:'Zurückfallen',   hi:'Gegenpressing' }
  ];

  window.setRegler = function (key, val) {
    if (!CLUB.tactics6) CLUB.tactics6 = Object.assign({}, T.DEFAULT_TACTICS6);
    CLUB.tactics6[key] = +val;
    const lbl = document.getElementById('reg-' + key + '-val');
    if (lbl) lbl.textContent = val + '%';
    recomputeMatchEffect();
    renderTeamStyleRating();
    if (typeof saveGameState === 'function') saveGameState();
  };

  window.toggleRepertoire = function (formation) {
    if (!CLUB.repertoire) CLUB.repertoire = [];
    // Aktuelle Formation ist fest — kann nicht abgewählt werden
    if (formation === CLUB.formation) return;
    const idx = CLUB.repertoire.indexOf(formation);
    if (idx >= 0) {
      CLUB.repertoire.splice(idx, 1);
    } else {
      if (CLUB.repertoire.length >= 3) {
        // ältesten ersetzen, aber nie die aktuelle Formation
        const rem = CLUB.repertoire.findIndex(f => f !== CLUB.formation);
        CLUB.repertoire.splice(rem >= 0 ? rem : 0, 1);
      }
      CLUB.repertoire.push(formation);
    }
    ensureCurrentInRepertoire();
    renderTacticsExtras();
    if (typeof saveGameState === 'function') saveGameState();
  };

  // Stellt sicher, dass die aktuelle Formation immer im Repertoire steht.
  function ensureCurrentInRepertoire() {
    if (!CLUB.repertoire) CLUB.repertoire = [];
    if (!CLUB.repertoire.includes(CLUB.formation)) {
      if (CLUB.repertoire.length >= 3) CLUB.repertoire.shift();
      CLUB.repertoire.unshift(CLUB.formation);
    }
  }
  window.ensureCurrentInRepertoire = ensureCurrentInRepertoire;

  // Rendert die erweiterten Taktik-Elemente in den Taktik-Subtab
  window.renderTacticsExtras = function () {
    const host = document.getElementById('sub-tactics');
    if (!host) return;
    let box = document.getElementById('tactics6-box');
    if (!box) {
      box = document.createElement('div');
      box.id = 'tactics6-box';
      // Vor die alten Regler setzen
      host.insertBefore(box, host.firstChild);
    }
    const t = CLUB.tactics6 || T.DEFAULT_TACTICS6;
    const allForms = Object.keys(FORMATIONS);
    let h = '';

    // Team-Stil-Bewertung (oben)
    h += `<div id="team-style-rating"></div>`;

    // 6 Regler
    h += `<div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;margin:14px 0 8px">Spielstil-Regler</div>`;
    REGLER_DEFS.forEach(r => {
      h += `<div class="tactic-block" style="margin-bottom:14px">
        <div class="tactic-label"><span>${r.label}</span><span id="reg-${r.key}-val">${t[r.key]}%</span></div>
        <input type="range" min="0" max="100" step="5" value="${t[r.key]}" class="tactic-slider"
          oninput="setRegler('${r.key}', this.value)">
        <div class="tactic-scale"><span>${r.lo}</span><span>${r.hi}</span></div>
      </div>`;
    });

    // Repertoire-Auswahl
    h += `<div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;margin:18px 0 8px">
      Formations-Repertoire <span style="color:var(--gold)">(${(CLUB.repertoire||[]).length}/3)</span></div>
      <div style="font-size:10px;color:var(--text2);margin-bottom:8px">Wähle bis zu 3 Formationen, zwischen denen du zur Halbzeit wechseln kannst. Die aktuelle Formation ist fest gesetzt.</div>
      <div style="display:flex;flex-wrap:wrap;gap:5px">`;
    allForms.forEach(f => {
      const inRep = (CLUB.repertoire || []).includes(f);
      const isCurrent = (f === CLUB.formation);
      let style = 'flex:0 0 auto;';
      let lock = '';
      if (isCurrent) {
        // aktuelle Formation: fest, dunkelgrün, nicht abwählbar
        style += 'background:#0f5132;color:#fff;border-color:#0f5132;cursor:default;';
        lock = ` <i class="ti ti-lock" style="font-size:9px;opacity:0.8"></i>`;
      } else if (inRep) {
        style += 'background:var(--accent);color:#fff;border-color:var(--accent);';
      }
      const onClick = isCurrent ? '' : `onclick="toggleRepertoire('${f}')"`;
      h += `<button ${onClick} class="tactic-btn" style="${style}">${f}${lock}</button>`;
    });
    h += `</div>`;

    box.innerHTML = h;
    renderTeamStyleRating();
  };

  // Team-Stil-Bewertung (Kader-Fit zum aktuellen Stil)
  window.renderTeamStyleRating = function () {
    const host = document.getElementById('team-style-rating');
    if (!host) return;
    const eff = recomputeMatchEffect();
    if (!eff) { host.innerHTML = ''; return; }
    const fit = eff.fitDetail;
    const stars = eff.kaderStars;
    const styleLabel = T.STYLE_LABELS[eff.style];
    const verdict = T.fitVerdict(stars);

    let h = `<div style="background:var(--bg3);border-radius:8px;padding:12px 14px">
      <div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">
        Wie gut passt dein Kader zum Stil?</div>
      <div style="font-size:12px;color:var(--text);margin-bottom:6px">Aktueller Stil: <b>${styleLabel}</b> · ${CLUB.formation}</div>
      ${(() => {
        const ml = T.matchupLists(CLUB.formation);
        if (!ml.strongVs.length) return '';
        return `<div style="font-size:10px;color:var(--text2);margin-bottom:8px;line-height:1.4">
          <i class="ti ti-arrow-up-right" style="color:var(--accent);font-size:10px"></i>
          Stark gegen: <span style="color:var(--text)">${ml.strongVs.join(', ')}</span></div>`;
      })()}
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <span style="font-size:26px;font-weight:700;line-height:1">${stars.toFixed(1).replace('.', ',')}</span>
        <span style="font-size:12px;color:var(--text3)">/ 5</span>
        <span style="margin-left:auto">${starsHtml(stars, 18)}</span>
      </div>
      <div style="font-size:11px;color:var(--text2);line-height:1.4">${verdict}</div>`;

    // Match-Effekt-Aufschlüsselung
    const pct = v => (v >= 0 ? '+' : '') + Math.round(v * 100) + '%';
    const col = v => v > 0 ? 'var(--accent)' : v < 0 ? 'var(--red)' : 'var(--text3)';
    h += `<div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--border);font-size:10px">
      <div style="display:flex;justify-content:space-between;padding:1px 0">
        <span style="color:var(--text3)">Formations-Matchup</span>
        <span style="color:${col(eff.formation)}">${MATCH_TAC.oppFormation ? pct(eff.formation) : '— (kein Gegner)'}</span></div>
      <div style="display:flex;justify-content:space-between;padding:1px 0">
        <span style="color:var(--text3)">Regler-Synergie</span><span style="color:${col(eff.synergy)}">${pct(eff.synergy)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:1px 0">
        <span style="color:var(--text3)">Kader-Fit</span><span style="color:${col(eff.kader)}">${pct(eff.kader)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:3px 0 0;margin-top:3px;border-top:1px solid var(--border);font-weight:700">
        <span style="color:var(--text2)">Gesamt-Effekt</span><span style="color:${col(eff.total)}">${pct(eff.total)}</span></div>
    </div>`;

    // Pro-Spieler-Aufschlüsselung (relevante zuerst)
    const sorted = (fit.perPlayer || []).slice().sort((a, b) => (b.relevant - a.relevant) || (b.effStars - a.effStars));
    if (sorted.length) {
      h += `<div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--border)">`;
      sorted.forEach(pp => {
        const penTxt = pp.posPenalty > 0 ? ` <span style="color:var(--red);font-size:9px">-${Math.round(pp.posPenalty*100)}%</span>` : '';
        const dim = pp.relevant ? '' : 'opacity:0.5;';
        h += `<div style="display:flex;align-items:center;gap:8px;padding:2px 0;${dim}">
          <span class="pos-badge" style="background:var(--bg4);color:var(--text2);min-width:30px;text-align:center">${pp.slotPos}</span>
          <span style="font-size:11px;color:var(--text2);flex:1">${pp.name}${penTxt}</span>
          ${starsHtml(pp.stars, 11)}</div>`;
      });
      h += `</div>`;
    }

    h += `</div>`;
    host.innerHTML = h;
  };

  // ── Hook: bei Tab-Wechsel neu rendern ──────────────────────────────────────
  if (typeof window.switchSubview === 'function') {
    const _origSS = window.switchSubview;
    window.switchSubview = function (name, btn) {
      _origSS(name, btn);
      if (name === 'tactics') renderTacticsExtras();
    };
    try { switchSubview = window.switchSubview; } catch (e) {}
  }
  // Auch bei renderAll (Aufstellungsänderung) die Bewertung aktualisieren
  if (typeof window.renderAll === 'function') {
    const _origRA = window.renderAll;
    window.renderAll = function () {
      _origRA();
      if (document.getElementById('tactics6-box')) renderTeamStyleRating();
    };
    try { renderAll = window.renderAll; } catch (e) {}
  }

  // Initial-Render, falls Taktik-Tab schon offen
  setTimeout(() => { if (document.getElementById('sub-tactics')) renderTacticsExtras(); }, 800);

  console.log('[Taktik] UI + Match-Integration aktiv');
})();


/* ---------- js/training_system.js ---------- */
/* ===== training_system.js ===== */
/* ═══════════════════════════════════════════════════════════════════════════
   TRAINING SYSTEM  v1
   ─────────────────────────────────────────────────────────────────────────
   Stellt window.TrainingSystem bereit.
   Wird VOR training_patches.js geladen.

   Öffentliche API (von training_patches.js genutzt):
     ensureState()          — initialisiert CLUB.training falls noch nicht da
     snapshotSquad()        — Schnappschuss der Spielerwerte für Saisonvergleich
     weeklyTrainingTick()   — wöchentliche Trainingsfortschritt-Berechnung
     showSeasonReport(res)  — Saisonbericht-Dialog (ersetzt alert)
     renderTrainingTab()    — befüllt #training-content
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {

  // ── KONFIG ────────────────────────────────────────────────────────────────
  const CFG = {
    // Trainings-Intensitäten und ihre wöchentliche Tick-Chance
    intensities: {
      leicht:   { label: 'Leicht',   tickChance: 0.08, injuryRisk: 0.002, moralBonus:  2 },
      normal:   { label: 'Normal',   tickChance: 0.14, injuryRisk: 0.006, moralBonus:  0 },
      // Intensiv: erlaubt nur in Vorbereitung & spielfreien Wochen.
      // Hohe Verletzungsgefahr (×3,3 gegenüber Normal) als Risiko-Abwägung.
      intensiv: { label: 'Intensiv', tickChance: 0.22, injuryRisk: 0.020, moralBonus: -3 },
    },
    // Fokus-Bereiche
    focus: {
      ausgewogen: { label: 'Ausgewogen',   weights: { def: 1, mid: 1, att: 1, pace: 0.5 } },
      defensive:  { label: 'Defensive',    weights: { def: 2, mid: 1, att: 0.5, pace: 0.5 } },
      offensive:  { label: 'Offensive',    weights: { def: 0.5, mid: 1, att: 2, pace: 0.7 } },
      fitness:    { label: 'Fitness',      weights: { def: 0.5, mid: 0.5, att: 0.5, pace: 2 } },
    },
    // Trainingsgelände-Stufe skaliert Tick-Chance
    // Max-Bonus bei Stufe 10: +20% (9 Stufen × 0.022 = 0.198 ≈ ×1.20)
    facilityBonusPerLevel: 0.022,
    // Gelände-Bonus-Cap: maximaler Multiplikator unabhängig von der Stufe
    facilityBonusCap: 0.20,
    // Maximales Alter für Attribut-Entwicklung. Stand auf 30 — damit war ein
    // angehobenes Potenzial für ältere Spieler unerreichbar. Jetzt bis 33,
    // dafür mit altersabhängig sinkender Trefferchance (siehe altersFaktor).
    maxDevAge: 33,
    // Multiplikator der Tick-Chance nach Alter
    altersFaktor: [[27, 1.0], [30, 0.55], [33, 0.28]],
    // OVR-Deckel: kein Fortschritt über truePotential hinaus
  };

  // ── HILFSFUNKTIONEN ────────────────────────────────────────────────────────
  function fmt(v) { return typeof formatEuro === 'function' ? formatEuro(v) : v + '€'; }
  function rnd(min, max) { return min + Math.random() * (max - min); }

  // Gibt true zurück wenn Intensiv-Training erlaubt ist:
  // → Vorbereitungsphase (vor Saisonwoche 1, d.h. LEAGUE.week <= 0 oder phase === 'pre')
  // → Spielfreie Wochen in der Saison (kein Spieltag in dieser Woche)
  function isIntensivAllowed() {
    if (typeof LEAGUE === 'undefined') return true;
    // Vorbereitungsphase: Wochen vor Saisonstart
    if (LEAGUE.phase === 'pre' || LEAGUE.week <= 0) return true;
    // Spielfreie Woche: kein Fixture in dieser Woche
    if (typeof FIXTURES !== 'undefined' && Array.isArray(FIXTURES)) {
      const thisWeek = LEAGUE.week;
      const hasMatch = FIXTURES.some(f => f.week === thisWeek && !f.played);
      if (!hasMatch) return true;
    }
    return false;
  }

  // ── ensureState ────────────────────────────────────────────────────────────
  // Initialisiert CLUB.training mit Defaults, falls noch nicht vorhanden.
  function ensureState() {
    if (typeof CLUB === 'undefined') return;
    if (!CLUB.training) CLUB.training = {};
    const t = CLUB.training;
    if (!t.intensity)      t.intensity = 'normal';
    if (!t.focus)          t.focus = 'ausgewogen';
    if (!t.weekLog)        t.weekLog = [];
    if (!t.seasonSnapshot) t.seasonSnapshot = {};
    if (!t.totalGains)     t.totalGains = {};
  }

  // ── snapshotSquad ──────────────────────────────────────────────────────────
  // Speichert aktuelle Attribute aller Spieler für den Saisonbericht.
  function snapshotSquad() {
    ensureState();
    if (typeof SQUAD === 'undefined') return;
    const snap = {};
    SQUAD.forEach(p => {
      snap[p.id] = { ovr: p.ovr, def: p.def, mid: p.mid, att: p.att, pace: p.pace || 50 };
    });
    CLUB.training.seasonSnapshot = snap;
  }

  // Trainingsverletzung — läuft unabhängig davon, ob hier auch entwickelt wird.
  function pruefeVerletzung(p, intCfg) {
    // FEHLER BEHOBEN: Hier stand `p.injured = weeks`. Das ganze Spiel liest aber
    // p.injuryWeeks (über isInjured), und healInjuriesOneWeek zählt auch nur das
    // herunter. Trainingsverletzungen haben den Spieler also NIE ausfallen
    // lassen — sie setzten nur ein Flag, das nie wieder verschwand und ihn
    // dauerhaft von weiteren Trainingsverletzungen ausnahm.
    if (typeof isInjured === 'function' ? isInjured(p) : p.injuryWeeks > 0) return;
    const risikoF = (typeof verletzungsRisikoFaktor === 'function')
      ? verletzungsRisikoFaktor(p)
      : ((typeof window.traitVerletzungsFaktor === 'function') ? window.traitVerletzungsFaktor(p) : 1);
    if (Math.random() >= intCfg.injuryRisk * risikoF) return;
    const heilF = (typeof window.traitHeilFaktor === 'function') ? window.traitHeilFaktor(p) : 1;
    const weeks = Math.max(1, Math.round((1 + Math.floor(Math.random() * 3)) * heilF));
    p.injuryWeeks = weeks;
    p.injuryType = 'Trainingsblessur';
    delete p.injured;                       // Altlast aus Spielständen aufräumen
    if (typeof addNews === 'function') {
      addNews('squad', '🤕 Trainingsverletzung: ' + p.name,
        ((p.firstName || '') + ' ' + p.name) + ' zog sich beim Training eine leichte Verletzung zu und fällt ' + weeks + ' Woche' + (weeks > 1 ? 'n' : '') + ' aus.');
    }
  }

  // ── weeklyTrainingTick ─────────────────────────────────────────────────────
  // Wird nach jedem advanceCalendarWeek-Tick aufgerufen.
  function weeklyTrainingTick() {
    ensureState();
    if (typeof SQUAD === 'undefined' || !SQUAD.length) return;

    const t      = CLUB.training;

    // ── Intensiv-Sperre ──────────────────────────────────────────────────────
    // Intensiv ist nur in der Vorbereitung und spielfreien Wochen erlaubt.
    // Wird es in einer Spielwoche gesetzt, erfolgt automatischer Downgrade auf Normal + Info-Banner.
    if (t.intensity === 'intensiv' && !isIntensivAllowed()) {
      t.intensity = 'normal';
      t._intensivBlockedThisWeek = true;
      if (typeof addNews === 'function') {
        addNews('training',
          '⚠️ Intensiv-Training gesperrt',
          'Intensives Training ist nur in der Vorbereitung und in spielfreien Wochen möglich. Das Training wurde automatisch auf Normal zurückgesetzt.');
      }
    } else {
      t._intensivBlockedThisWeek = false;
    }

    const intCfg  = CFG.intensities[t.intensity] || CFG.intensities.normal;
    const focCfg  = CFG.focus[t.focus]           || CFG.focus.ausgewogen;
    const facLvl  = (CLUB.facilities && CLUB.facilities.training) || 1;

    // Gelände-Bonus: max +20% unabhängig von der Stufe
    const facBonus = Math.min((facLvl - 1) * CFG.facilityBonusPerLevel, CFG.facilityBonusCap);
    const tickBase = intCfg.tickChance * (1 + facBonus);

    const weekGains = [];

    SQUAD.forEach(p => {
      // Kein Fortschritt über Potenzial oder bei zu alten Spielern
      const pot = p.truePotential || (p.ovr + 5);
      if (p.ovr >= pot) return;
      if ((p.age || 25) > CFG.maxDevAge) return;
      // Verletzte Spieler trainieren nicht
      if (p.injured) return;

      // Welches Attribut entwickeln? Gewichtet nach Fokus, dann weighted-random
      const weights = focCfg.weights;
      const candidates = [
        { attr: 'def',  w: weights.def  * (1 + (pot - (p.def  || 50)) / 50) },
        { attr: 'mid',  w: weights.mid  * (1 + (pot - (p.mid  || 50)) / 50) },
        { attr: 'att',  w: weights.att  * (1 + (pot - (p.att  || 50)) / 50) },
        { attr: 'pace', w: weights.pace * (1 + (pot - (p.pace || 50)) / 50) },
      ].filter(c => (p[c.attr] || 0) < 98); // gedeckelt bei 98

      if (!candidates.length) return;

      const total = candidates.reduce((s, c) => s + c.w, 0);
      let r = Math.random() * total;
      let chosen = candidates[candidates.length - 1];
      for (const c of candidates) { r -= c.w; if (r <= 0) { chosen = c; break; } }

      // Ältere Spieler entwickeln sich langsamer, aber nicht gar nicht mehr.
      let altF = 1;
      for (const [bis, f] of CFG.altersFaktor) { if ((p.age || 25) <= bis) { altF = f; break; } }
      if (Math.random() < tickBase * altF) {
        p[chosen.attr] = Math.min(98, (p[chosen.attr] || 50) + 1);

        // OVR neu berechnen
        if (typeof computeOvrFromAreas === 'function') {
          p.ovr = computeOvrFromAreas(p);
        } else {
          p.ovr = Math.round(((p.def || 50) + (p.mid || 50) + (p.att || 50)) / 3);
        }
        if (typeof computeMarketValue === 'function') p.value = computeMarketValue(p);

        weekGains.push({ name: (p.firstName || '') + ' ' + p.name, attr: chosen.attr });

        // Gesamtfortschritt für Bericht
        if (!t.totalGains[p.id]) t.totalGains[p.id] = 0;
        t.totalGains[p.id]++;
      }

      pruefeVerletzung(p, intCfg);
    });

    // Moral-Effekt der Intensität: wirkt jetzt auf das echte Spieler-Moralsystem
    // (intensives Training drückt die Stimmung, leichtes hebt sie leicht).
    if (intCfg.moralBonus !== 0 && window.MoraleSystem && typeof MoraleSystem.addMorale === 'function') {
      try {
        MoraleSystem.addMorale(SQUAD.filter(p => !(typeof isInjured === 'function' ? isInjured(p) : p.injuryWeeks > 0)), intCfg.moralBonus);
      } catch (e) {}
    }
    // Legacy-Wert konsistent halten (falls noch irgendwo gelesen): = echte Teammoral
    if (typeof teamMorale === 'function') CLUB.moral = teamMorale();

    // Wochenlog (max. 34 Einträge = eine Saison)
    t.weekLog.push({ gains: weekGains.length, intensity: t.intensity, focus: t.focus });
    if (t.weekLog.length > 34) t.weekLog.shift();

    if (typeof saveGameState === 'function') saveGameState();
  }

  // ── showSeasonReport ──────────────────────────────────────────────────────
  // Ersetzt den simplen alert am Saisonende durch einen informativen Dialog.
  function showSeasonReport(result) {
    ensureState();
    const snap = CLUB.training.seasonSnapshot || {};

    // Top-Entwickler ermitteln
    const devs = [];
    if (typeof SQUAD !== 'undefined') {
      SQUAD.forEach(p => {
        const before = snap[p.id];
        if (!before) return;
        const delta = (p.ovr || 0) - (before.ovr || 0);
        if (delta > 0) devs.push({ name: (p.firstName || '') + ' ' + p.name, delta, ovrNow: p.ovr });
      });
    }
    devs.sort((a, b) => b.delta - a.delta);
    const topDevs = devs.slice(0, 5);

    // Wochenlog auswerten
    const log  = CLUB.training.weekLog || [];
    const totalTicks = log.reduce((s, w) => s + w.gains, 0);
    const avgPerWeek = log.length ? (totalTicks / log.length).toFixed(1) : '0';

    // Modal bauen
    const existing = document.getElementById('ts-season-modal');
    if (existing) existing.remove();

    const devsHtml = topDevs.length
      ? topDevs.map(d => `<tr><td style="padding:3px 8px">${d.name}</td><td style="padding:3px 8px;text-align:center;color:var(--green,#3fb950)">+${d.delta} OVR</td><td style="padding:3px 8px;text-align:center;color:var(--text2)">${d.ovrNow}</td></tr>`).join('')
      : '<tr><td colspan="3" style="padding:6px;text-align:center;color:var(--text3)">Keine Entwicklungen diese Saison.</td></tr>';

    const resultHtml = (result && result.log && result.log.length)
      ? result.log.map(l => `<div style="margin-bottom:3px;font-size:11px">• ${l}</div>`).join('')
      : '';

    const tvHtml = (result && result.tvMoney && result.tvMoney.amount > 0)
      ? `<div style="margin-top:8px;padding:8px;background:var(--bg3,#21262d);border-radius:6px;font-size:11px">📺 TV-Gelder: <b style="color:var(--gold,#d29922)">${fmt(result.tvMoney.amount)}</b></div>`
      : '';

    const modal = document.createElement('div');
    modal.id = 'ts-season-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;padding:16px';
    modal.innerHTML = `
      <div style="background:var(--bg2,#161b22);border:1px solid var(--border,#30363d);border-radius:12px;padding:24px;max-width:480px;width:100%;max-height:90vh;overflow-y:auto">
        <h2 style="margin:0 0 16px;font-size:16px;font-weight:700">🏁 Saisonende</h2>
        ${resultHtml}
        ${tvHtml}
        <h3 style="margin:16px 0 8px;font-size:13px;font-weight:600">📈 Top-Entwicklungen</h3>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr style="color:var(--text3,#6e7681);font-size:10px">
            <th style="text-align:left;padding:3px 8px">Spieler</th>
            <th style="padding:3px 8px">Δ OVR</th>
            <th style="padding:3px 8px">OVR</th>
          </tr></thead>
          <tbody>${devsHtml}</tbody>
        </table>
        <div style="margin-top:12px;font-size:11px;color:var(--text3,#6e7681)">
          Training: ∅ ${avgPerWeek} Fortschritte/Woche · ${totalTicks} Gesamt-Entwicklungen
        </div>
        <button onclick="document.getElementById('ts-season-modal').remove()"
          style="margin-top:16px;width:100%;padding:10px;border-radius:7px;background:var(--accent,#238636);color:#fff;font-weight:600;border:none;cursor:pointer;font-size:13px">
          Neue Saison starten →
        </button>
      </div>`;
    document.body.appendChild(modal);
  }

  // ── renderTrainingTab ─────────────────────────────────────────────────────
  // Befüllt #training-content mit Einstellungen und Statistiken.
  function renderTrainingTab() {
    ensureState();
    const el = document.getElementById('training-content');
    if (!el) return;

    const t      = CLUB.training;
    const intCfg = CFG.intensities;
    const focCfg = CFG.focus;
    const facLvl = (CLUB.facilities && CLUB.facilities.training) || 1;

    const intensivAllowed = isIntensivAllowed();

    // Top-Entwickler der Saison
    const snap = t.seasonSnapshot || {};
    const devs = [];
    if (typeof SQUAD !== 'undefined') {
      SQUAD.forEach(p => {
        const b = snap[p.id];
        if (!b) return;
        const d = (p.ovr || 0) - (b.ovr || 0);
        if (d > 0) devs.push({ name: (p.firstName ? p.firstName[0] + '. ' : '') + p.name, delta: d, ovr: p.ovr, pos: p.pos || '?' });
      });
    }
    devs.sort((a, b) => b.delta - a.delta);

    const log        = t.weekLog || [];
    const totalTicks = log.reduce((s, w) => s + w.gains, 0);
    const avgPerWeek = log.length ? (totalTicks / log.length).toFixed(1) : '0';

    // Effektive Tick-Chance mit gecapptem Gelände-Bonus
    const facBonus   = Math.min((facLvl - 1) * CFG.facilityBonusPerLevel, CFG.facilityBonusCap);
    const tickChance = (intCfg[t.intensity] || intCfg.normal).tickChance * (1 + facBonus) * 100;
    const facBonusPct = (facBonus * 100).toFixed(0);

    // Info-Banner: Intensiv gesperrt oder erlaubt
    const intensivBanner = t.intensity === 'intensiv' && !intensivAllowed
      ? `<div style="background:#5a1e1e;border:1px solid #c0392b;border-radius:7px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:#f5b7b1">
           ⚠️ <b>Intensiv-Training wird gesperrt.</b> In Spielwochen ist Intensiv nicht erlaubt — das Training wird beim nächsten Wochentick automatisch auf <b>Normal</b> zurückgesetzt.
         </div>`
      : (intensivAllowed
          ? `<div style="background:#1a3a1e;border:1px solid #2ecc71;border-radius:7px;padding:8px 14px;margin-bottom:14px;font-size:11px;color:#a9dfbf">
               ✅ <b>Intensiv verfügbar</b> — Vorbereitungs- oder spielfreie Woche. Hohes Verletzungsrisiko beachten!
             </div>`
          : '');

    el.innerHTML = `
      <div style="padding:16px;max-width:600px">

        <h2 style="font-size:15px;font-weight:700;margin:0 0 16px">🏋️ Trainingssteuerung</h2>

        ${intensivBanner}

        <!-- Intensität -->
        <div style="margin-bottom:16px">
          <div style="font-size:11px;color:var(--text3,#6e7681);margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:.5px">Intensität</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${Object.entries(intCfg).map(([k, v]) => {
              const isIntensiv = k === 'intensiv';
              const locked = isIntensiv && !intensivAllowed;
              const isActive = t.intensity === k;
              const btnStyle = locked
                ? 'opacity:.45;cursor:not-allowed;border:2px solid var(--border,#30363d);background:var(--bg3,#21262d);color:var(--text3,#6e7681)'
                : `cursor:pointer;border:2px solid ${isActive ? 'var(--accent,#238636)' : 'var(--border,#30363d)'};background:${isActive ? 'var(--accent,#238636)' : 'var(--bg3,#21262d)'};color:${isActive ? '#fff' : 'var(--text2,#8b949e)'}`;
              const onClick = locked
                ? `alert('Intensiv-Training ist nur in der Vorbereitung und in spielfreien Wochen möglich.')`
                : `CLUB.training.intensity='${k}'; TrainingSystem.renderTrainingTab();`;
              const injLabel = isIntensiv ? `<br><span style="font-size:10px;font-weight:400;opacity:.85;color:#f0a070">⚠️ Verletzungsrisiko ×3</span>` : '';
              const availLabel = isIntensiv ? `<br><span style="font-size:10px;font-weight:400;opacity:.7">${locked ? '🔒 Nur Vorbereitung' : '✅ Jetzt erlaubt'}</span>` : '';
              return `<button onclick="${onClick}"
                style="flex:1;min-width:90px;padding:8px 10px;border-radius:7px;font-size:12px;font-weight:600;transition:.15s;${btnStyle}">
                ${v.label}<br>
                <span style="font-size:10px;font-weight:400;opacity:.8">${(v.tickChance*100).toFixed(0)}% Basis-Chance</span>
                ${injLabel}${availLabel}
              </button>`;
            }).join('')}
          </div>
        </div>

        <!-- Fokus -->
        <div style="margin-bottom:16px">
          <div style="font-size:11px;color:var(--text3,#6e7681);margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:.5px">Trainingsfokus</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${Object.entries(focCfg).map(([k, v]) => `
              <button onclick="CLUB.training.focus='${k}'; TrainingSystem.renderTrainingTab();"
                style="flex:1;min-width:100px;padding:8px 10px;border-radius:7px;font-size:12px;font-weight:600;cursor:pointer;border:2px solid ${t.focus===k ? 'var(--accent,#238636)' : 'var(--border,#30363d)'};background:${t.focus===k ? 'var(--accent,#238636)' : 'var(--bg3,#21262d)'};color:${t.focus===k ? '#fff' : 'var(--text2,#8b949e)'};transition:.15s">
                ${v.label}
              </button>`).join('')}
          </div>
        </div>

        <!-- Aktuelle Werte -->
        <div style="background:var(--bg3,#21262d);border-radius:8px;padding:12px;margin-bottom:16px;font-size:12px">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px">
            <span style="color:var(--text3,#6e7681)">Effektive Tick-Chance</span>
            <b style="color:var(--green,#3fb950)">${tickChance.toFixed(1)}% / Woche</b>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:6px">
            <span style="color:var(--text3,#6e7681)">Trainingsgelände Stufe</span>
            <b>${facLvl} <span style="font-size:10px;color:var(--text3,#6e7681);font-weight:400">(+${facBonusPct}% Bonus, max +20%)</span></b>
          </div>
          <div style="display:flex;justify-content:space-between">
            <span style="color:var(--text3,#6e7681)">Ø Fortschritte / Woche</span>
            <b>${avgPerWeek}</b>
          </div>
        </div>

        <!-- Top-Entwickler -->
        <div style="font-size:11px;color:var(--text3,#6e7681);margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:.5px">📈 Top-Entwickler diese Saison</div>
        ${devs.length ? `
          <div style="background:var(--bg3,#21262d);border-radius:8px;overflow:hidden">
            ${devs.slice(0, 8).map((d, i) => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;${i ? 'border-top:1px solid var(--border,#30363d)' : ''}">
                <span style="font-size:12px">${d.name} <span style="font-size:10px;color:var(--text3,#6e7681)">${d.pos}</span></span>
                <span style="font-size:12px;color:var(--green,#3fb950);font-weight:700">+${d.delta} OVR → ${d.ovr}</span>
              </div>`).join('')}
          </div>` : `<div style="font-size:12px;color:var(--text3,#6e7681);padding:12px 0">Noch keine Entwicklungen diese Saison.</div>`}

      </div>`;
  }

  // ── PUBLIC API ─────────────────────────────────────────────────────────────
  window.TrainingSystem = {
    ensureState,
    snapshotSquad,
    weeklyTrainingTick,
    showSeasonReport,
    renderTrainingTab,
  };

  console.log('[TrainingSystem v1] geladen');
})();


/* ---------- js/training_patches.js ---------- */
/* ===== training_patches.js ===== */
/* ═══════════════════════════════════════════════════════════════════════════
   TRAINING-PATCHES  ·  Hängt das Training-System in die bestehende Engine ein
   ─────────────────────────────────────────────────────────────────────────────
   Wird NACH training_system.js und app_main.js geladen (letztes Script).

   - Patcht advanceCalendarWeek → weeklyTrainingTick nach jedem Wochentick
   - Patcht showSeasonEndSummary → zeigt den neuen Saisonbericht-Dialog
   - Patcht startNewSeason → macht Snapshot der Spielerwerte für Saisonvergleich
   - Patcht switchAppView → rendert den Training-Tab bei Aktivierung
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  const TS = window.TrainingSystem;
  if (!TS) { console.error('[TrainingPatches] TrainingSystem fehlt'); return; }

  // ── 1. advanceCalendarWeek patchen ─────────────────────────────────────
  //    Original gibt true/false zurück. Wir führen den Training-Tick danach aus.
  const _origAdvance = window.advanceCalendarWeek;
  if (typeof _origAdvance === 'function') {
    window.advanceCalendarWeek = function () {
      const result = _origAdvance.call(this);
      if (result) {
        // Trainingswoche lief durch → Tick
        try { TS.weeklyTrainingTick(); } catch (e) { console.warn('[TrainingPatches] weeklyTrainingTick Fehler', e); }
        // Tab neu rendern falls aktiv
        const trainView = document.getElementById('view-training');
        if (trainView && trainView.classList.contains('active')) {
          try { TS.renderTrainingTab(); } catch(e) {}
        }
      }
      return result;
    };
    console.log('[TrainingPatches] advanceCalendarWeek gepatcht');
  }

  // ── 2. showSeasonEndSummary patchen ────────────────────────────────────
  //    Ersetzt den simplen alert durch den neuen Saisonbericht-Dialog.
  const _origSummary = window.showSeasonEndSummary;
  window.showSeasonEndSummary = function (result) {
    try {
      TS.showSeasonReport(result);
    } catch (e) {
      console.warn('[TrainingPatches] showSeasonReport Fehler', e);
      // Fallback: originaler Alert
      if (typeof _origSummary === 'function') _origSummary(result);
    }
  };
  console.log('[TrainingPatches] showSeasonEndSummary gepatcht');

  // ── 3. startNewSeason patchen ──────────────────────────────────────────
  //    Snapshot der Spielerwerte VOR dem Saisonübergang, damit wir am Ende
  //    die Entwicklung korrekt vergleichen können.
  //    applyEndOfSeasonClubEffects wird innerhalb von startNewSeason aufgerufen;
  //    wir patchen startNewSeason selbst, damit der Snapshot möglichst früh gemacht wird.
  const _origStartSeason = window.startNewSeason;
  if (typeof _origStartSeason === 'function') {
    window.startNewSeason = function () {
      // Snapshot BEVOR die Spieler altern und sich entwickeln
      try { TS.snapshotSquad(); } catch (e) { console.warn('[TrainingPatches] snapshotSquad Fehler', e); }
      // WeekLog für neue Saison zurücksetzen (nach dem Bericht, der bereits gezeigt wurde)
      if (CLUB.training) CLUB.training.weekLog = [];
      return _origStartSeason.apply(this, arguments);
    };
    console.log('[TrainingPatches] startNewSeason gepatcht');
  }

  // ── 4. switchAppView patchen ────────────────────────────────────────────
  //    Training-Tab rendern wenn aktiviert.
  const _origSwitch = window.switchAppView;
  if (typeof _origSwitch === 'function') {
    window.switchAppView = function (view, btn) {
      // Alle Views inkl. 'training' ein-/ausblenden
      const allViews = ['home','squad','club','liga','europa','transfer','scout','match','training'];
      document.querySelectorAll('.appnav-btn').forEach(b => b.classList.remove('active'));
      if (btn) btn.classList.add('active');
      allViews.forEach(v => {
        const el = document.getElementById('view-' + v);
        if (el) el.classList.toggle('active', v === view);
      });
      // Original-Render-Hooks für bekannte Views
      if (view === 'home')     { if (typeof renderHomeTab === 'function') renderHomeTab(); }
      if (view === 'club')     { if (typeof renderClubTab === 'function') renderClubTab(); }
      if (view === 'liga')     { if (typeof renderLeagueTab === 'function') renderLeagueTab(); }
      if (view === 'europa')   { if (typeof renderEuropaTab === 'function') renderEuropaTab(); }
      if (view === 'transfer') { if (typeof renderTransferTab === 'function') renderTransferTab(); }
      if (view === 'scout')    { if (typeof renderScoutTab === 'function') renderScoutTab(); }
      if (view === 'match' && typeof ensureFixtureLoaded === 'function') {
        // Hinweis: G und CURRENT_FIXTURE sind mit const/let deklariert — solche
        // Top-Level-Deklarationen hängen sich NICHT an window (anders als var).
        // window.G / window.CURRENT_FIXTURE waren daher IMMER undefined, wodurch
        // diese Bedingung nie zutraf und der Gegner im Spieltag-Tab nie geladen
        // wurde. Fix: direkt auf die Variablen zugreifen statt über window.
        if (!CURRENT_FIXTURE && typeof G !== 'undefined' && G.min === 0 && !G.running) ensureFixtureLoaded();
      }
      if (view === 'training') {
        try { TS.renderTrainingTab(); } catch(e) { console.warn('[TrainingPatches] renderTrainingTab Fehler', e); }
      }
    };
    console.log('[TrainingPatches] switchAppView gepatcht');
  }

  // ── 5. Erstsnapshot beim Laden ─────────────────────────────────────────
  //    Falls noch kein Snapshot existiert (erster Start oder altes Savegame),
  //    sofort einen machen.
  if (typeof CLUB !== 'undefined') {
    TS.ensureState();
    if (!CLUB.training.seasonSnapshot || Object.keys(CLUB.training.seasonSnapshot).length === 0) {
      try { TS.snapshotSquad(); } catch(e) {}
    }
  }

  console.log('[TrainingPatches] alle Patches aktiv');
})();