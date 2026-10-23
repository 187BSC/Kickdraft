/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · NATIONALMANNSCHAFTEN  ·  v1   (Nutzer 2026-10-16: Punkt 8 der Liste „Nationalmannschaften“)
   ─────────────────────────────────────────────────────────────────────────
   In den Länderspielpausen (CFG.wochen – spielfreie Wochen der Saison aus BREAK_WEEKS, ohne Winterpause) berufen die
   Nationen die besten Spieler deines Kaders:
     · A-Nationalmannschaft ab der Schwelle des Landes (große Nationen 82, mittlere 76, übrige 70, kleine 64);
       knapp darunter ein Wackelkandidat (CFG.wackel). U21 für Spieler bis 21 ab Schwelle − 9.
     · Zwei Länderspiele: Einsätze, Tore nach Position, Reisestrapazen (Fitness −4…−8), kleines Verletzungsrisiko (CFG.verletzung).
     · Erste A-Berufung: Karte „Nationalspieler“ (kickstil_karten.js), Moral +, Marktwert neu gerechnet.
   Zustand je Spieler: p.national = { a: Länderspiele, t: Tore, u21: Spiele } · Spieler-Blatt zeigt „Länderspiele“.
   API: KSNational.schwelle(p) · .blattZeile(p) · .pause() (von Hand) · .CFG
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const CFG = {
    wochen: [10, 18, 34, 42],      // Länderspielfenster; nur Wochen, in denen die Liga pausiert, werden genutzt
    gross: ['Deutschland', 'Frankreich', 'Spanien', 'England', 'Brasilien', 'Argentinien', 'Portugal', 'Niederlande', 'Italien', 'Belgien'],
    mittel: ['Kroatien', 'Dänemark', 'Schweiz', 'Österreich', 'Polen', 'Türkei', 'Serbien', 'Schweden', 'Norwegen', 'Uruguay', 'Kolumbien',
      'USA', 'Japan', 'Ukraine', 'Tschechien', 'Schottland', 'Marokko', 'Senegal', 'Mexiko', 'Ungarn', 'Südkorea', 'Nigeria', 'Elfenbeinküste', 'Ecuador'],
    klein: ['Luxemburg', 'Liechtenstein', 'Malta', 'Färöer', 'Andorra', 'San Marino', 'Gibraltar', 'Kosovo', 'Armenien', 'Zypern', 'Estland', 'Lettland', 'Litauen', 'Moldau'],
    schwelle: { gross: 82, mittel: 76, sonst: 70, klein: 64 },
    wackel: 3, wackelChance: 0.2, u21Abzug: 9, u21Bis: 21,
    fitness: [4, 8], verletzung: 0.04, moralErste: 5
  };
  const hatSpiel = () => { try { return typeof CLUB !== 'undefined' && CLUB && typeof LEAGUE !== 'undefined' && LEAGUE; } catch (e) { return false; } };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const voll = p => (p.firstName ? p.firstName + ' ' : '') + p.name;
  const ovrVon = p => (typeof ovrBase === 'function' ? ovrBase(p) : p.ovr) || 0;
  const land = p => p.country || 'Deutschland';
  function schwelle(p) {
    const l = land(p);
    return CFG.gross.includes(l) ? CFG.schwelle.gross : CFG.mittel.includes(l) ? CFG.schwelle.mittel : CFG.klein.includes(l) ? CFG.schwelle.klein : CFG.schwelle.sonst;
  }
  const verfuegbar = p => !(p.injuryWeeks > 0) && !p.injured && !p.perspektiv;
  // Spielfreie Woche der Liga (BREAK_WEEKS) und ein Länderspielfenster?
  function istPause(w) {
    const frei = (window.BREAK_WEEKS || []).includes(w);
    return frei && CFG.wochen.includes(w);
  }
  function torChance(p) {
    const pos = p.pos || 'ZM';
    return pos === 'ST' ? 0.35 : ['FL', 'LF', 'RF', 'OM', 'ZOM', 'AM', 'LM', 'RM'].indexOf(pos) >= 0 ? 0.2 : pos === 'ZM' ? 0.08 : pos === 'TW' ? 0 : 0.04;
  }
  function pause() {
    if (!hatSpiel() || typeof SQUAD === 'undefined') return null;
    const a = [], u = [];
    // 2026-10-16: mit kickstil_laenderspiele.js beruft die Nation ihre besten 23 (Spielwelt + Grundstock) und die
    // Spiele sind die echten Partien des Fensters (EM-/WM-Qualifikation, Playoffs, sonst Testspiele)
    const KL = window.KSLaender && typeof window.KSLaender.berufung === 'function' ? window.KSLaender : null;
    const berufen = new Map();
    SQUAD.forEach(p => {
      if (!p || !verfuegbar(p)) return;
      if (KL) {
        const b = KL.berufung(p);
        if (b) { berufen.set(p, b); a.push(p); return; }
        const o = ovrVon(p), s = schwelle(p);
        if ((p.age || 30) <= CFG.u21Bis && o >= s - CFG.u21Abzug) u.push(p);
        return;
      }
      const o = ovrVon(p), s = schwelle(p);
      let chance = 0;
      if (o >= s) chance = Math.min(0.95, 0.55 + (o - s) * 0.1);
      else if (o >= s - CFG.wackel) chance = CFG.wackelChance;
      if (chance && Math.random() < chance) { a.push(p); return; }
      if ((p.age || 30) <= CFG.u21Bis && o >= s - CFG.u21Abzug) u.push(p);
    });
    if (!a.length && !u.length) return { a, u };
    const zeilen = [];
    a.forEach(p => {
      const N = p.national = p.national || { a: 0, t: 0, u21: 0 };
      const erste = !N.a;
      const b = berufen.get(p);
      let spiele = Math.random() < 0.75 ? 2 : 1;
      let tore = 0;
      if (b) { spiele = b.spiele.length; tore = b.spiele.reduce((x, y) => x + y.tore, 0); }
      else for (let i = 0; i < spiele; i++) if (Math.random() < torChance(p)) tore++;
      N.a += spiele; N.t += tore;
      if (typeof p.fitness === 'number') p.fitness = Math.max(40, p.fitness - (CFG.fitness[0] + Math.floor(Math.random() * (CFG.fitness[1] - CFG.fitness[0] + 1))));
      let verl = '';
      if (Math.random() < CFG.verletzung && typeof injurePlayer === 'function') {
        try { const inj = injurePlayer(p); if (inj) verl = ` – verletzt zurück (${inj.type}, ${inj.weeks} Wo.)`; } catch (e) { /* ohne Verletzung */ }
      }
      if (erste) {
        if (window.KSKarten && KSKarten.vergeben) KSKarten.vergeben(p, 'nationalspieler', { grund: 'Erste Berufung für ' + land(p) });
        if (typeof window.addMorale === 'function') window.addMorale([p], CFG.moralErste);
        if (typeof computeMarketValue === 'function') p.value = computeMarketValue(p);
      }
      const gegen = b && b.spiele.length ? ' – ' + b.spiele.map(x => `${x.ergebnis} gg. ${x.gegner}${x.tore ? ' (' + x.tore + ' ' + (x.tore === 1 ? 'Tor' : 'Tore') + ')' : ''}`).join(', ') : '';
      zeilen.push(`${p.flag || ''} ${voll(p)} (${land(p)}${erste ? ', erstmals' : ''}${b && !b.startelf ? ', Bank' : ''}): ${spiele} ${spiele === 1 ? 'Einsatz' : 'Einsätze'}${tore ? ', ' + tore + (tore === 1 ? ' Tor' : ' Tore') : ''}${gegen}${verl}`);
    });
    u.forEach(p => {
      const N = p.national = p.national || { a: 0, t: 0, u21: 0 };
      N.u21 += 2;
      if (typeof p.fitness === 'number') p.fitness = Math.max(40, p.fitness - CFG.fitness[0]);
    });
    if (typeof addNews === 'function') addNews('club', `🌍 Länderspielpause: ${a.length} Nationalspieler${u.length ? ', ' + u.length + ' U21' : ''}`,
      (zeilen.length ? zeilen.join(' · ') + '.' : 'Keiner deiner Spieler ist für die A-Mannschaft nominiert.') +
      (u.length ? ` U21: ${u.map(voll).join(', ')}.` : '') + ' Die Reisen kosten etwas Frische.');
    return { a, u };
  }
  if (typeof window.advanceCalendarWeek === 'function') {
    const _w = window.advanceCalendarWeek;
    window.advanceCalendarWeek = function () {
      const r = _w.apply(this, arguments);
      try { if (r && hatSpiel() && istPause(LEAGUE.week)) pause(); } catch (e) { console.warn('[Kickstil-National] Pause', e); }
      return r;
    };
    try { advanceCalendarWeek = window.advanceCalendarWeek; } catch (e) { /* window reicht */ }
  }
  // Spieler-Blatt (kickstil_app_shell.js): Zeile „Länderspiele“
  function blattZeile(p) {
    const N = p && p.national;
    if (!N || !(N.a || N.u21)) return '';
    const txt = N.a ? `${N.a}${N.t ? ` · ${N.t} ${N.t === 1 ? 'Tor' : 'Tore'}` : ''}` : `U21 · ${N.u21}`;
    return `<div><span>Länderspiele</span><b class="app-weit">${esc(p.flag || '')} ${esc(txt)}</b></div>`;
  }

  window.KSNational = { CFG, schwelle, blattZeile, pause, istPause };
  console.log('[Kickstil-National v1] aktiv — Berufungen in den Länderspielpausen');
})();
