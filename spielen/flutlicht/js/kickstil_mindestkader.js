/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · MINDESTKADER  ·  v1   (10-Saisons-Lauf 2026-10-16)
   ─────────────────────────────────────────────────────────────────────────
   Gefunden im Langzeitlauf: Wer nicht nachkauft, verliert jede Saison Spieler (Vertragsende mit Netz bei 16, dazu
   Karriereenden ohne Netz) – München stand in Saison 5 mit 14 Spielern da, auf Dauer reicht es nicht mehr für eine Elf.
   Zur neuen Saison füllt der Verein deshalb auf CFG.min auf:
     1. Talente ab 16 aus der eigenen Akademie (die besten zuerst, wie „Hochziehen“)
     2. sonst Vertragsamateure: einfache Spieler unter dem Kaderniveau, 1 Jahr Vertrag, kleines Gehalt
   Mindestens CFG.torhueter Torhüter. Eine Meldung im Postfach sagt, wer dazukam.
   API: KSMindestkader.auffuellen() · .CFG
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const CFG = { min: 16, torhueter: 2, abzug: 7 };
  const hatSpiel = () => { try { return typeof CLUB !== 'undefined' && CLUB && typeof LEAGUE !== 'undefined' && LEAGUE && typeof SQUAD !== 'undefined'; } catch (e) { return false; } };
  const voll = p => (p.firstName ? p.firstName + ' ' : '') + p.name;
  const istTW = p => p.pos === 'TW';

  function ausAkademie() {
    const pool = (CLUB.youthProspects || []).filter(p => (p.age || 0) >= 16).sort((a, b) => (b.ovr || 0) - (a.ovr || 0));
    const p = pool[0]; if (!p) return null;
    const lohn = typeof weeklyWageFor === 'function' ? weeklyWageFor(p) : 500;
    const neu = { id: 'sq_' + p.id, name: p.name, firstName: p.firstName, flag: p.flag, country: p.country, joinedSeason: LEAGUE.season,
      acquiredSeason: LEAGUE.season, pos: p.pos, positions: p.positions, age: p.age, ovr: p.ovr, truePotential: p.truePotential,
      def: p.def, mid: p.mid, att: p.att, pace: p.pace, mental: p.mental, gamesPlayed: 0, seed: p.seed, value: p.value, wage: lohn,
      contractUntil: LEAGUE.season + 3, fromYouth: true, birthWeek: p.birthWeek, birthMonth: p.birthMonth, birthDay: p.birthDay };
    CLUB.youthProspects.splice(CLUB.youthProspects.indexOf(p), 1);
    return neu;
  }
  function amateur(pos, i) {
    if (typeof makeGeneratedPlayer !== 'function') return null;
    const o = SQUAD.map(q => q.ovr || 50).sort((a, b) => a - b);
    const basis = Math.max(40, (o.length ? o[Math.floor(o.length / 2)] : 55) - CFG.abzug);
    const p = makeGeneratedPlayer(pos, basis, 'ama' + LEAGUE.season + '_' + i);
    p.id = 'sq_ama_' + LEAGUE.season + '_' + i + '_' + Math.random().toString(36).slice(2, 6);
    p.joinedSeason = p.acquiredSeason = LEAGUE.season; p.contractUntil = LEAGUE.season + 1; p.amateur = true;
    p.wage = Math.max(300, Math.round((p.wage || 1000) * 0.6 / 50) * 50);
    return p;
  }
  function auffuellen() {
    if (!hatSpiel() || SQUAD.length >= CFG.min && SQUAD.filter(istTW).length >= CFG.torhueter) return [];
    const dazu = [];
    let i = 0;
    while (SQUAD.filter(istTW).length < CFG.torhueter && i < 4) { const p = amateur('TW', i++); if (!p) break; SQUAD.push(p); dazu.push(p); }
    while (SQUAD.length < CFG.min && i < 30) {
      const p = ausAkademie() || amateur(['IV', 'LV', 'ZM', 'RV', 'ZOM', 'ST'][i % 6], i); i++;
      if (!p) break;
      SQUAD.push(p); dazu.push(p);
    }
    dazu.forEach(p => { try { if (typeof assignBirthday === 'function' && !p.birthWeek) assignBirthday(p); } catch (e) { /* ohne Geburtstag */ } });
    try { if (typeof assignShirtNumbers === 'function') assignShirtNumbers(); } catch (e) { /* Nummern später */ }
    if (dazu.length) {
      try { if (CLUB.wageCap) CLUB.wageBudget = Math.max(0, CLUB.wageCap - SQUAD.reduce((a, q) => a + (q.wage || 0), 0)); } catch (e) { /* weiter */ }
      if (typeof addNews === 'function') addNews('squad', `🧩 Kader aufgefüllt (${SQUAD.length} Spieler)`,
        `Der Kader war zu klein für eine Saison. Neu dabei: ${dazu.map(p => voll(p) + ' (' + p.pos + ', ' + (p.fromYouth ? 'Akademie' : 'Vertragsamateur') + ')').join(', ')}. ` +
        `Für mehr Qualität: Transfermarkt, Leihen oder die Akademie.`);
    }
    return dazu;
  }

  if (typeof window.startNewSeason === 'function') {
    const _s = window.startNewSeason;
    window.startNewSeason = function () {
      const r = _s.apply(this, arguments);
      try { auffuellen(); } catch (e) { console.warn('[Kickstil-Mindestkader]', e); }
      return r;
    };
    try { startNewSeason = window.startNewSeason; } catch (e) { /* window reicht */ }
  }

  window.KSMindestkader = { CFG, auffuellen };
  console.log('[Kickstil-Mindestkader v1] aktiv — zur neuen Saison mindestens ' + CFG.min + ' Spieler, ' + CFG.torhueter + ' Torhüter');
})();
