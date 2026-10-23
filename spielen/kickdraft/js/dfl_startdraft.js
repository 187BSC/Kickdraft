/* =====================================================================
   DFL: Start am Tag der Verträge mit erstem Draft (D108, freigegeben 2026-10-11, gebaut 2026-10-15)
   Nutzer 2026-10-11: „… am besten mit dem Tag, wo die Verträge für die neue Saison beschlossen werden, und danach Draft-Tag.
   Sodass man mit einem großen Highlight startet und sofort hooked ist.“ · 2026-10-15: „ja bitte bauen … das wäre ganz wichtig.“
   Ablauf einer neuen Karriere: Vereinswahl → (Lite/Voll, Tour, Aufträge) → Tag der Verträge → erster Draft → KW 1 mit Free Agency →
   Spieltag 1.
   • Welt (dfl_liga_patch.js beim Erzeugen, DFLSaison.vorsaison/startMarkt/startJahrgang): stille Vorsaison 2025/26 mit den vollen
     Kadern (Tabelle, Playoffs → Draft-Reihenfolge = echter Pick), bei den KI-Vereinen laufen Verträge aus (Kader 21), beim eigenen
     Verein bleiben die Auslaufenden im Kader. Kommender Draft = Start-Jahrgang (Draft-Jahr = erstes Saisonjahr).
   • Tag der Verträge (Fenster .vt-ov): je auslaufender Vertrag Halten (neuer Vertrag zur Forderung ab dieser Saison, wie
     DFLSaisonwechsel.forderung) oder Gehen (Free Agent ohne Dead Cap); Stab-Empfehlung mit einem Tipp; Cap-Balken mit den
     Rookie-Verträgen der eigenen Picks; wer nicht verlängern will, geht. Der Star der Tutorial-Mission sagt immer zu.
   • Erster Draft: Reihenfolge der Vorsaison (DFLKader.startDraftVorbereiten), Draft-Fenster wie am Saisonende (Uhr, Tausch, D94).
   • Testlauf (navigator.webdriver) ohne localStorage 'dfl-startdraft-test' = 'an': der Stab entscheidet, der Draft läuft durch.
   • Alte Spielstände ohne LEAGUE.dflStart: nichts ändert sich.
   Zustand: LEAGUE.dflStart = { v, phase: 'vertragstag'|'draft'|'fertig', jahr, reihenfolge (Spiel-IDs), auslauf (SQUAD-IDs),
   wahl { id: 'halten'|'gehen' }, vorsaison { meister, finalist, platz, pick }, ergebnis { halten, gehen } }.
   API: DFLStartDraft = { aktiv, zustand, phase, auslauf, istAuslauf, info, empfehlung, waehle, beschliessen, zeigen, pruefen, cta, ergebnisVon }
   ===================================================================== */
(function () {
  'use strict';
  const G = window.DFLGenerator, S = window.DFLSaison, D = window.DFLSpiel;
  if (!G || !S || !D) { console.warn('[DFL-Startdraft] DFL-Module fehlen – inaktiv'); return; }
  const hatDom = typeof document !== 'undefined' && !!document.querySelector;
  const dfl = () => typeof CLUB !== 'undefined' && CLUB && CLUB.dfl && CLUB.dfl.aktiv && typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.dfl;
  const zustand = () => (dfl() && LEAGUE.dflStart) || null;
  const phase = () => (zustand() || {}).phase || null;
  const aktiv = () => { const p = phase(); return !!p && p !== 'fertig'; };
  const K = () => window.DFLKader;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const voll = p => ((p.firstName ? p.firstName + ' ' : '') + (p.name || '')).trim();
  const geld = v => (typeof formatEuro === 'function' ? formatEuro(v) : (Math.round(v / 1e5) / 10).toLocaleString('de-DE') + ' Mio €');
  const ico = n => `<i class="ti ti-${n}" aria-hidden="true"></i>`;
  const speichern = () => { try { if (typeof saveGameState === 'function') saveGameState(); } catch (e) { /* Tests */ } };
  const news = (k, t, x) => { try { if (typeof addNews === 'function') addNews(k, t, x); } catch (e) { /* ohne Postfach */ } };
  const lsLies = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const testlauf = () => typeof navigator !== 'undefined' && !!navigator.webdriver && lsLies('dfl-startdraft-test') !== 'an';
  const imKader = id => (typeof SQUAD !== 'undefined' ? SQUAD.find(p => p.id === id) : null) || null;
  const jahrLabel = s => (typeof seasonYearLabel === 'function' ? seasonYearLabel(s) : String(s));
  const vorLabel = () => { const y = typeof seasonStartYear === 'function' ? seasonStartYear(LEAGUE.season) : 2026; return (y - 1) + '/' + String(y % 100).padStart(2, '0'); };
  const bisJahr = s => (typeof seasonEndYear === 'function' ? seasonEndYear(s) : s);
  const teamName = id => { try { const t = LEAGUE.tiers.bundesliga.groups[0].teams.find(x => x.id === id); return t ? t.name : id; } catch (e) { return id; } };
  const MAX = () => (K() && K().MAX ? K().MAX() : 28);
  const PICKS_JE = 4, WILLIG_MIN = 45;

  // ── Anlegen (neue Karriere) ──────────────────────────────────────────────
  function anlegen() {
    if (!dfl() || window.DFL_WECHSEL || LEAGUE.dflStart) return null;
    const L = D.liga(), st = L && L._start;
    if (!st || !L.draft) return null;
    const auslauf = SQUAD.filter(q => st.auslauf.indexOf(q.dflId || String(q.id).replace(/^sq_/, '')) >= 0).map(q => q.id);
    const eigen = D.eigeneDflId();
    const zeilen = Object.values(st.tabelle).sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
    const platz = zeilen.findIndex(z => z.id === eigen) + 1;
    LEAGUE.dflStart = { v: 1, phase: 'vertragstag', jahr: L.draft.jahr, reihenfolge: st.reihenfolge.map(id => D.spielId(id)), auslauf, wahl: {},
      vorsaison: { meister: D.spielId(st.meister), finalist: D.spielId(st.finalist), platz, pick: st.reihenfolge.indexOf(eigen) + 1,
        runde: st.ausgeschieden && st.ausgeschieden[eigen] != null ? st.ausgeschieden[eigen] : 0 },
      ergebnis: null };
    return LEAGUE.dflStart;
  }

  // ── Forderung, Bereitschaft, Cap ─────────────────────────────────────────
  const auslauf = () => { const z = zustand(); return z ? z.auslauf.map(imKader).filter(Boolean) : []; };
  const istAuslauf = id => { const z = zustand(); return !!(z && z.phase === 'vertragstag' && z.auslauf.indexOf(id) >= 0); };
  function zufall(q) {
    let h = 2166136261;
    for (const c of String((CLUB.dfl.seed || 1) + '|start|' + q.id)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    return (h >>> 0) / 4294967296;
  }
  const istStar = q => !!(window.DFLMissionen && DFLMissionen.istStar && DFLMissionen.istStar(q));
  const cache = {};
  // Forderung wie in der Saisonvorbereitung (DFLSaisonwechsel.forderung: Markt + Stimmung), Vertrag ab dieser Saison
  function info(q) {
    const key = q.id + '|' + (K() ? K().cap() : 0);
    if (cache[key]) return Object.assign({}, cache[key], { willig: cache[key].willig || istStar(q) });
    const SW = window.DFLSaisonwechsel;
    let f = null;
    try { f = SW && SW.forderung ? SW.forderung(q.id) : null; } catch (e) { f = null; }
    f = f || { jahresWert: Math.max(G.CFG.mindestgehalt, (q.wage || 0) * 52), jahre: 2, handgeldAnteil: 0.2, staffelung: 'gleich', chance: 100, key: 'bereit' };
    const alt = G.CFG.cap;
    G.setzeCap(K() ? K().cap() : alt);
    let c;
    try {
      c = G.baueVertrag({ jahresWert: f.jahresWert, jahre: f.jahre, rest: f.jahre, staffelung: f.staffelung || 'gleich', handgeldAnteil: f.handgeldAnteil || 0,
        garantiert: 0, art: f.jahresWert <= G.CFG.mindestgehalt ? 'minimum' : 'veteran' });
    } finally { G.setzeCap(alt); }
    const hit = c.base_salary_by_year[0] + c.signing_bonus_total / c.years_total;
    // Bereitschaft wie in der Saisonvorbereitung, am ersten Tag mindestens WILLIG_MIN % (der neue Manager hat noch nichts verbockt –
    // sonst wollte in manchen Vereinen keiner der Auslaufenden bleiben)
    const x = { f, vertrag: c, hit, gesamt: c.base_salary_by_year.reduce((a, b) => a + b, 0) + c.signing_bonus_total, jahre: c.years_total,
      willig: zufall(q) * 100 < Math.max(WILLIG_MIN, Number.isFinite(f.chance) ? f.chance : 100) };
    cache[key] = x;
    return Object.assign({}, x, { willig: x.willig || istStar(q) });
  }
  // Eigene Picks des Start-Drafts (Runde 1–4, getauschte Picks zählen beim Besitzer)
  function eigenePicks() {
    const z = zustand(), L = D.liga(), H = window.DFLHandel, eigen = D.eigeneDflId(), aus = [];
    if (!z) return aus;
    for (let runde = 1; runde <= PICKS_JE; runde++) z.reihenfolge.forEach((sid, i) => {
      const von = D.dflIdVon(sid), besitzer = H && H.pickBesitzer ? H.pickBesitzer(L, z.jahr, runde, von) : von;
      if (besitzer === eigen) aus.push((runde - 1) * 32 + i + 1);
    });
    return aus;
  }
  const hauptOhneAuslauf = () => { const z = zustand(); return SQUAD.filter(p => !p.perspektiv && !p.onLoanAt && !p.verletztenliste && !(z && z.auslauf.indexOf(p.id) >= 0)); };
  function capLage() {
    const z = zustand(), k = K();
    const limit = k.capLimit(), aus = new Set(z ? z.auslauf : []);
    const fest = SQUAD.filter(p => !aus.has(p.id)).reduce((s, p) => s + k.capHitJahr(p), 0) + ((CLUB.dfl && CLUB.dfl.deadCap) || 0);
    const picks = eigenePicks(), rookies = picks.reduce((s, n) => s + (G.rookieCapHit ? G.rookieCapHit(n) : G.rookieGehalt(n)), 0);
    let gehalten = 0, nHalten = 0;
    auslauf().forEach(q => { if (z.wahl[q.id] === 'halten') { gehalten += info(q).hit; nHalten++; } });
    const kader = hauptOhneAuslauf().length;
    return { limit, fest, rookies, gehalten, frei: limit - fest - rookies - gehalten, picks, kader, nHalten, danach: kader + nHalten + picks.length };
  }
  // Stab-Empfehlung: Stammspieler und Junge halten, solange Cap (mit Puffer für die Rookies) und Platz im Kader (eine Lücke für die
  // Free Agency) reichen; wer nicht verlängern will, geht
  function empfehlung() {
    const z = zustand(); if (!z) return {};
    const L = D.liga(), t = (D.eigenSync() || L.teams.find(x => x.id === D.eigeneDflId()));
    let elf = new Set();
    try { elf = new Set(G.startelfVon(t.roster, t).map(p => p.sq || p.id)); } catch (e) { elf = new Set(); }
    const lage = capLage();
    let frei = lage.limit - lage.fest - lage.rookies - 3000000, platz = MAX() - 1 - (lage.kader + lage.picks.length);
    const aus = {};
    auslauf().map(q => ({ q, x: info(q), stamm: elf.has(q.id) }))
      .sort((a, b) => (b.stamm - a.stamm) || ((b.q.ovr || 0) - (a.q.ovr || 0)))
      .forEach(({ q, x, stamm }) => {
        const ok = x.willig && (istStar(q) || ((stamm || q.age <= 23) && x.hit <= frei && platz > 0));      // der Star der Mission: immer halten
        aus[q.id] = ok ? 'halten' : 'gehen';
        if (ok) { frei -= x.hit; platz--; }
      });
    return aus;
  }

  // ── Entscheiden ──────────────────────────────────────────────────────────
  function vertragGeben(q, x) {
    const c = x.vertrag;
    q.contract = { years_total: c.years_total, years_remaining: c.years_total, base_salary: c.base_salary_by_year[0], base_salary_by_year: c.base_salary_by_year.slice(),
      signing_bonus_total: c.signing_bonus_total, guaranteed_bonuses: 0, staffelung: c.staffelung || 'gleich', art: c.art || 'veteran' };
    q.wage = Math.round(c.base_salary_by_year[0] / 52);
    q.contractUntil = LEAGUE.season + c.years_total - 1; q.dflVertragBis = q.contractUntil;
    delete q.vertragFolge; delete q.vorauszahlung; delete q.expiring;
    if (window.MoraleSystem && MoraleSystem.addMorale) { try { MoraleSystem.addMorale([q], 6); } catch (e) { /* ohne Moral */ } }
  }
  function gehenLassen(q) {
    if (typeof clearFromLineup === 'function') { try { clearFromLineup(q.id); } catch (e) { /* ohne Aufstellung */ } }
    SQUAD.splice(SQUAD.indexOf(q), 1);
    const L = D.liga(), w = D.spielZuDfl(q, LEAGUE.season);
    w.contract = null; w.teamId = null; w._exVerein = D.eigeneDflId(); delete w.sq; delete w.ir;
    L.freie.push(w);
  }
  function waehle(id, was) {
    const z = zustand(); if (!z || z.phase !== 'vertragstag' || z.auslauf.indexOf(id) < 0) return false;
    const q = imKader(id); if (!q) return false;
    if (was === 'halten' && !info(q).willig) return false;
    z.wahl[id] = z.wahl[id] === was ? undefined : was;
    if (!z.wahl[id]) delete z.wahl[id];
    malen();
    return true;
  }
  function empfehlungUebernehmen() {
    const z = zustand(); if (!z) return;
    const e = empfehlung();
    Object.keys(e).forEach(id => { if (!z.wahl[id]) z.wahl[id] = e[id]; });
    malen();
  }
  const alleEntschieden = () => { const z = zustand(); return !!z && auslauf().every(q => z.wahl[q.id] === 'halten' || z.wahl[q.id] === 'gehen'); };
  function beschliessen(opt) {
    opt = opt || {};
    const z = zustand(); if (!z || z.phase !== 'vertragstag') return false;
    if (!alleEntschieden()) return false;
    if (!opt.auto && capLage().frei < 0) return false;                    // Hard Cap: nie über 120 Mio halten (Nutzer 2026-10-17)
    const halten = [], gehen = [];
    auslauf().forEach(q => {
      const x = info(q);
      if (z.wahl[q.id] === 'halten' && x.willig) { vertragGeben(q, x); halten.push({ id: q.id, name: voll(q), pos: q.pos, ovr: q.ovr, bis: q.contractUntil, hit: x.hit, gesamt: x.gesamt }); }
      else { gehen.push({ id: q.id, name: voll(q), pos: q.pos, ovr: q.ovr }); gehenLassen(q); }
    });
    z.ergebnis = { halten, gehen };
    z.phase = 'draft';
    const k = K();
    try { D.eigenSync(); k.capSetzen(); k.faSpiegel(); D.weltGeaendert(); } catch (e) { console.warn('[DFL-Startdraft] Welt', e); }
    news('transfer', `Tag der Verträge: ${halten.length} gehalten, ${gehen.length} ${gehen.length === 1 ? 'geht' : 'gehen'}`,
      (halten.length ? 'Neue Verträge: ' + halten.map(h => `${h.name} (${h.pos}, ${h.ovr}) bis ${bisJahr(h.bis)}, Cap Hit ${geld(h.hit)}`).join(', ') + '. ' : '') +
      (gehen.length ? 'Free Agents: ' + gehen.map(g => `${g.name} (${g.pos}, ${g.ovr})`).join(', ') + '.' : ''));
    try { if (window.DFLMissionen && DFLMissionen.pruefen) DFLMissionen.pruefen(); } catch (e) { /* ohne Aufträge */ }
    schliessen();
    draftStarten(opt);
    return true;
  }
  function draftStarten(opt) {
    opt = opt || {};
    const z = zustand(), k = K(); if (!z || !k) return;
    if (!LEAGUE.dflDraft || LEAGUE.dflDraft.jahr !== z.jahr) {
      try { k.startDraftVorbereiten(z.reihenfolge); } catch (e) { console.warn('[DFL-Startdraft] Draft vorbereiten', e); }
    }
    speichern();
    if (opt.auto) { try { if (!LEAGUE.dflDraft.fertig) k.draftAuto(); } catch (e) { console.warn('[DFL-Startdraft] Draft automatisch', e); } fertig(); return; }
    k.oeffneDraft(fertig);
  }
  function fertig() {
    const z = zustand(); if (!z || z.phase === 'fertig') return;
    const d = LEAGUE.dflDraft;
    if (!d || d.jahr !== z.jahr || !d.fertig) return;
    z.phase = 'fertig';
    // Einstiegs-Test 2026-10-21: gehenLassen() räumt Plätze der Elf frei, ohne nachzubesetzen („Aufstellung unvollständig“) –
    // Lücken mit den Rookies und dem übrigen Kader füllen (die gewählte Formation bleibt)
    try { if (typeof window.autoFillLineup === 'function') window.autoFillLineup(); } catch (e) { console.warn('[DFL-Startdraft] Elf auffüllen', e); }
    const lage = K();
    news('club', 'Saisonvorbereitung beginnt', `Kader ${lage.hauptkader().length} von ${MAX()}, Cap ${geld(lage.capBelegt())} von ${geld(lage.capLimit())}. ` +
      'Woche 1 gehört dir in der Free Agency, ab Woche 2 greifen die anderen zu.');
    speichern();
    ['renderHomeTab'].forEach(f => { if (typeof window[f] === 'function') { try { window[f](); } catch (e) { /* Ansicht fehlt */ } } });
  }

  // ── Fenster „Tag der Verträge“ ───────────────────────────────────────────
  let ov = null;
  function schliessen() { if (ov) { ov.remove(); ov = null; } }
  function balkenHtml(l) {
    const max = Math.max(l.limit, l.fest + l.rookies + l.gehalten);
    const w = v => Math.max(0, Math.min(100, v / max * 100)).toFixed(1) + '%';
    const ueber = l.frei < 0;
    return `<div class="vt-cap${ueber ? ' ueber' : ''}">
      <div class="vt-cap-kopf"><b>Cap ${jahrLabel(LEAGUE.season)}</b><span>${ueber ? `${geld(-l.frei)} über dem Cap` : `${geld(l.frei)} frei`}</span></div>
      <div class="vt-balken" role="img" aria-label="Cap: ${esc(geld(l.fest))} fest, ${esc(geld(l.gehalten))} gehalten, ${esc(geld(l.rookies))} Rookies, Limit ${esc(geld(l.limit))}">
        <span class="fest" style="width:${w(l.fest)}"></span><span class="neu" style="width:${w(l.gehalten)}"></span><span class="rook" style="width:${w(l.rookies)}"></span>
        <i class="grenze" style="left:${w(l.limit)}"></i></div>
      <div class="vt-legende"><span><i class="fest"></i>Verträge ${esc(geld(l.fest))}</span><span><i class="neu"></i>Gehalten ${esc(geld(l.gehalten))}</span><span><i class="rook"></i>${l.picks.length} Rookies ${esc(geld(l.rookies))}</span></div>
      <div class="vt-kader">${ico('users')} Kader ${l.kader} + ${l.nHalten} + ${l.picks.length} Rookies = <b>${l.danach}</b> von ${MAX()}</div></div>`;
  }
  function zeileHtml(q, z, emp, l) {
    const x = info(q), w = z.wahl[q.id], star = istStar(q);
    // Nutzer 2026-10-17: „da ist Verlängern über Cap – du siehst da nichts. Auch wäre das Potenzial dort super“
    const passt = w === 'halten' || !x.willig || !l || l.frei - x.hit >= 0;
    let pot = '';
    try { const r = typeof potentialRange === 'function' ? potentialRange(q) : null; if (r) pot = r.exact || r.lo === r.hi ? ` (Pot. ${r.hi})` : ` (Pot. ${r.lo}–${r.hi})`; } catch (e) { pot = ''; }
    let gesicht = '';
    try { gesicht = window.DFLIdentitaet && DFLIdentitaet.gesichtSvg ? DFLIdentitaet.gesichtSvg(q, null) : ''; } catch (e) { gesicht = ''; }
    const pos = window.DFLOberflaeche && DFLOberflaeche.posMarke ? DFLOberflaeche.posMarke(q, { nur1: true }) : `<span class="pos-badge-sm">${esc(q.pos)}</span>`;
    const tipp = chefGrund(q, x, emp[q.id] === 'halten');
    return `<div class="vt-zeile${w ? ' ' + w : ''}${star ? ' star' : ''}" data-id="${esc(q.id)}">
      <span class="vt-gesicht">${gesicht}</span>
      <span class="vt-text"><b>${esc(voll(q))}${star ? ' <span class="vt-auftrag">Auftrag</span>' : ''}</b>
        <small>${pos} ${q.age} J. · Stärke ${q.ovr}<span class="vt-pot">${esc(pot)}</span></small>
        <small>${x.willig ? `${esc(geld(x.hit))} × ${x.jahre} ${x.jahre === 1 ? 'Jahr' : 'Jahre'}` : 'will den Markt testen'}</small>
        ${passt ? '' : `<small class="vt-capvoll">Passt nicht: ${esc(geld(x.hit - l.frei))} über dem Cap</small>`}
        <small class="vt-tipp">${tipp}</small></span>
      <span class="vt-wahl">
        <button type="button" class="vt-k halten${w === 'halten' ? ' an' : ''}" data-vt="halten:${esc(q.id)}" ${x.willig && passt ? '' : 'disabled'}>${passt ? 'Halten' : 'Cap voll'}</button>
        <button type="button" class="vt-k gehen${w === 'gehen' ? ' an' : ''}" data-vt="gehen:${esc(q.id)}">Gehen</button></span></div>`;
  }
  // Rückmeldung 17.10. (3), Nutzer: „der Scout führt den Tag vor dem Draft einmal durch, worauf man achten muss bei der Kaderplanung –
  // 2–3 Sätze, auch mit Einblendung: den würde ich halten, der war letzte Saison richtig gut“
  const STAMM_ELF = () => { try { const L = D.liga(), t = D.eigenSync() || L.teams.find(x => x.id === D.eigeneDflId()); return new Set(G.startelfVon(t.roster, t).map(p => p.sq || p.id)); } catch (e) { return new Set(); } };
  const notenSchnitt = q => { const l = q.matchRatings && Array.isArray(q.matchRatings.list) ? q.matchRatings.list : []; return l.length >= 5 ? l.reduce((a, b) => a + b, 0) / l.length : null; };
  const komma = n => n.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  let ELF_CACHE = null;
  function chefGrund(q, x, halten) {
    const elf = ELF_CACHE || (ELF_CACHE = STAMM_ELF()), n = notenSchnitt(q), stamm = elf.has(q.id);
    if (halten) {
      if (istStar(q)) return 'Chefscout: halten – Auftrag des Eigentümers';
      if (n != null && n >= 7) return `Chefscout: halten – letzte Saison richtig gut (Note ${komma(n)})`;
      if (stamm) return 'Chefscout: halten – gehört in die Stammelf';
      if (q.age <= 23) return 'Chefscout: halten – jung, wird noch besser';
      return 'Chefscout: halten – passt ins Budget';
    }
    if (!x.willig) return 'Chefscout: will den Markt testen – nicht zu halten';
    if (q.age >= 31) return `Chefscout: gehen lassen – mit ${q.age} zu teuer für ${geld(x.hit)}`;
    if (!stamm) return 'Chefscout: gehen lassen – nur Ergänzung, der Draft bringt Ersatz';
    return `Chefscout: gehen lassen – das Geld brauchen wir woanders${n != null ? ` (Note ${komma(n)})` : ''}`;
  }
  // Sprechblase oben: Gesicht, 2–3 Sätze (Bilanz, wen unbedingt halten, wo es dünn wird)
  function chefBlase(liste, emp) {
    const C = window.DFLChefscout, p = C && C.person ? C.person() : null;
    let bild = '';
    try { if (p && window.DFLIdentitaet) bild = DFLIdentitaet.gesichtSvg({ seed: p.seed, dflSeed: p.seed, firstName: p.firstName, name: p.name, id: p.id }, { id: D.eigeneDflId(), farben: (D.franchise('fcm') || {}).farben }); } catch (e) { bild = ''; }
    const halten = liste.filter(q => emp[q.id] === 'halten'), gehen = liste.filter(q => emp[q.id] !== 'halten');
    const saetze = [];
    if (!liste.length) saetze.push('Diesmal läuft kein Vertrag aus. Wir können uns ganz auf den Draft konzentrieren.');
    else saetze.push(`Bevor wir in den Draft gehen: ${halten.length === 1 ? 'Einen Vertrag' : halten.length + ' Verträge'} würde ich verlängern, ${gehen.length === 1 ? 'einen Spieler' : gehen.length + ' Spieler'} lassen wir ziehen.`);
    const top = halten.slice().sort((a, b) => (notenSchnitt(b) || 0) - (notenSchnitt(a) || 0) || b.ovr - a.ovr)[0];
    if (top) { const n = notenSchnitt(top); saetze.push(`${voll(top)} würde ich auf jeden Fall halten${n != null && n >= 7 ? ` – der war letzte Saison richtig gut` : top.age <= 23 ? ' – der wird noch richtig gut' : ''}.`); }
    const elf = ELF_CACHE || (ELF_CACHE = STAMM_ELF());
    const luecke = gehen.filter(q => elf.has(q.id))[0];
    const pick = (zustand().vorsaison || {}).pick;
    if (luecke) saetze.push(`Auf ${luecke.pos === 'OM' ? 'ZOM' : luecke.pos} wird es dann dünn – dort sollten wir ${pick ? 'mit Pick #' + pick + ' ' : ''}im Draft zuschlagen.`);
    else if (saetze.length < 3) saetze.push('Achte auf den Cap: Was du jetzt hältst, fehlt dir für die Rookies.');
    return `<div class="vt-chef"><span class="vt-chef-bild">${bild || ico('user-search')}</span>
      <div class="vt-chef-text"><small>${p ? esc(voll(p)) + ' · ' : ''}Chefscout</small><p>„${esc(saetze.slice(0, 3).join(' '))}“</p></div></div>`;
  }
  function html() {
    ELF_CACHE = null;
    const z = zustand(), v = z.vorsaison || {}, l = capLage(), emp = empfehlung();
    const liste = auslauf().sort((a, b) => (b.ovr || 0) - (a.ovr || 0));
    const offen = liste.filter(q => !z.wahl[q.id]).length;
    let wappen = '';
    try { wappen = window.DFLIdentitaet ? DFLIdentitaet.wappenSvg({ id: D.eigeneDflId() }, { groesse: 44 }) : ''; } catch (e) { wappen = ''; }
    return `<div class="vt-box">
      <div class="vt-kopf"><span class="vt-wappen">${wappen}</span><span><small>Vor dem Draft ${z.jahr}</small><h2>Tag der Verträge</h2></span></div>
      <div class="vt-vorsaison">${ico('trophy')} <span>Vorsaison ${esc(vorLabel())}: Platz ${v.platz || '–'} · Meister ${esc(teamName(v.meister))}</span>
        <b class="vt-pick">Pick #${v.pick || '–'}</b></div>
      ${chefBlase(liste, emp)}
      ${balkenHtml(l)}
      <div class="vt-liste">${liste.map(q => zeileHtml(q, z, emp, l)).join('') || '<p class="vt-leer">Kein Vertrag läuft aus.</p>'}</div>
      <div class="vt-fuss">
        <button type="button" class="tut-knopf zweit" data-vt="empfehlung" ${offen ? '' : 'disabled'}>Stab entscheidet${offen ? ` (${offen})` : ''}</button>
        <button type="button" class="tut-knopf" data-vt="los" ${offen || l.frei < 0 ? 'disabled' : ''}>${l.frei < 0 ? 'Erst Cap frei machen' : 'Zum Draft'}</button></div></div>`;
  }
  function malen() {
    if (!ov) return;
    const y = ov.querySelector('.vt-box') ? ov.querySelector('.vt-box').scrollTop : 0;
    ov.innerHTML = html();
    const b = ov.querySelector('.vt-box'); if (b) b.scrollTop = y;
  }
  function zeigen() {
    if (!hatDom || phase() !== 'vertragstag') return;
    if (!ov) {
      Object.keys(cache).forEach(k => delete cache[k]);      // Stimmung und Aufträge stehen erst jetzt fest
      ov = document.createElement('div');
      ov.className = 'vt-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Tag der Verträge');
      ov.addEventListener('click', ev => {
        const b = ev.target.closest('[data-vt]'); if (!b || b.disabled) return;
        const [was, id] = b.getAttribute('data-vt').split(':');
        if (was === 'halten' || was === 'gehen') waehle(id, was);
        else if (was === 'empfehlung') empfehlungUebernehmen();
        else if (was === 'los') beschliessen();
      });
      document.body.appendChild(ov);
    }
    malen();
  }

  // ── Ablauf: was gerade dran ist ──────────────────────────────────────────
  const BLOCK = '.st-ov, .tut-ov, .ms-intro, .exp-overlay, .spo-ov, #dfl-draft-ov, .sw-briefing, #pm-overlay, .app-blatt.auf';
  function frei() {
    if (!hatDom) return false;
    const sichtbar = e => !!(e && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden');
    return ![...document.querySelectorAll(BLOCK + ', #onboarding-overlay')].some(sichtbar);
  }
  // Testlauf (navigator.webdriver ohne 'dfl-startdraft-test'): der Stab entscheidet, der Draft läuft durch
  function autoTest() {
    const z = zustand(); if (!z || !testlauf() || z.phase === 'fertig') return;
    if (z.phase === 'vertragstag') { z.wahl = Object.assign(empfehlung(), z.wahl); beschliessen({ auto: true }); }
    else draftStarten({ auto: true });
  }
  function pruefen() {
    const z = zustand(); if (!z) return;
    if (testlauf()) { autoTest(); return; }
    if (z.phase === 'draft') {
      const d = LEAGUE.dflDraft;
      if (d && d.jahr === z.jahr && d.fertig) { fertig(); return; }
      if (!d || d.jahr !== z.jahr) { if (frei()) draftStarten(); return; }
      if (frei() && !document.getElementById('dfl-draft-ov')) K().oeffneDraft(fertig);
      return;
    }
    // zweimal hintereinander frei (≥ 0,7 s): Lücken zwischen Vereinswahl und Lite/Voll (0,26 s) bzw. Tour und Aufträgen (0,3 s)
    // überspringen; in dieser Seite neu begonnen: erst nach der Tour (oder „Ohne Tour“)
    const tut = typeof CLUB !== 'undefined' && CLUB.dflTutorial;
    const bereit = frei() && !(neuHier && window.DFLTutorial && !(tut && tut.tour));
    ruhig = bereit ? ruhig + 1 : 0;
    if (z.phase === 'vertragstag' && !ov && ruhig >= 2) zeigen();
  }
  let ruhig = 0, neuHier = false;
  // Haupt-Button, solange der Start läuft
  function cta() {
    const p = phase();
    if (p === 'vertragstag') return { text: 'Tag der Verträge', sub: `${auslauf().length} Verträge laufen aus`, icon: 'ti-file-certificate', go: zeigen };
    if (p === 'draft' && !(LEAGUE.dflDraft && LEAGUE.dflDraft.jahr === zustand().jahr)) return { text: 'Zum Draft', sub: `Pick #${(zustand().vorsaison || {}).pick || ''}`, icon: 'ti-school', go: () => draftStarten() };
    return null;
  }
  const ergebnisVon = id => { const z = zustand(), e = z && z.ergebnis; if (!e) return null; return e.halten.some(x => x.id === id) ? 'halten' : e.gehen.some(x => x.id === id) ? 'gehen' : null; };

  // ── Einhängen ────────────────────────────────────────────────────────────
  {
    const _orig = window.startNewGameState;
    if (typeof _orig === 'function') {
      window.startNewGameState = async function () {
        const r = await _orig.apply(this, arguments);
        try { if (anlegen()) { neuHier = true; speichern(); } } catch (e) { console.warn('[DFL-Startdraft] Start', e); }
        return r;
      };
      try { startNewGameState = window.startNewGameState; } catch (e) { /* window reicht */ }
    }
  }
  // Testlauf: erst nach _afterLoad (das legt den Welt-Zwischenspeicher neu an – Änderungen davor gingen mit einem noch
  // wartenden Speichern verloren), dann sofort, damit Bots und Prüfungen wie vorher mit fertigem Kader starten
  {
    const _orig = window._afterLoad;
    if (typeof _orig === 'function') {
      window._afterLoad = function () { const r = _orig.apply(this, arguments); try { autoTest(); } catch (e) { console.warn('[DFL-Startdraft] Testlauf', e); } return r; };
      try { _afterLoad = window._afterLoad; } catch (e) { /* window reicht */ }
    }
  }
  // Woche weiter erst nach dem Start-Draft
  {
    const _orig = window.nextWeek;
    if (typeof _orig === 'function') {
      window.nextWeek = function () {
        if (aktiv()) { pruefen(); if (phase() === 'vertragstag') zeigen(); return; }
        return _orig.apply(this, arguments);
      };
      try { nextWeek = window.nextWeek; } catch (e) { /* window reicht */ }
    }
  }
  if (hatDom) setInterval(() => { try { pruefen(); } catch (e) { console.warn('[DFL-Startdraft]', e); } }, 700);

  if (hatDom && document.head) {
    const css = document.createElement('style');
    css.id = 'dfl-startdraft-css';
    css.textContent = `.vt-ov{position:fixed;inset:0;z-index:9600;background:var(--bg,#f4e3c1);color:var(--text,#2c3e50);display:flex;justify-content:center}
.vt-box{width:100%;max-width:560px;overflow-y:auto;padding:14px 14px calc(96px + env(safe-area-inset-bottom,0px));box-sizing:border-box}
.vt-kopf{display:flex;gap:12px;align-items:center;margin:4px 0 10px}.vt-kopf h2{margin:0;font-size:24px}.vt-kopf small{color:var(--text3,#846d52);font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.04em}
.vt-wappen{width:48px;height:48px;flex:none;display:grid;place-items:center}.vt-wappen svg{width:100%;height:100%}
.vt-vorsaison{display:flex;align-items:center;gap:8px;padding:8px 10px;border:2px solid var(--k-rand,#8b5a2b);border-radius:14px;background:var(--bg2,#fffdf9);font-size:13px}
.vt-vorsaison span{flex:1}.vt-pick{font-size:15px;padding:2px 10px;border-radius:999px;background:var(--k-gold,#e0a526);color:#3b2a1d}
.vt-cap{margin:10px 0;padding:10px 12px;border:2px solid var(--k-rand,#8b5a2b);border-radius:14px;background:var(--bg2,#fffdf9)}
.vt-cap-kopf{display:flex;justify-content:space-between;font-size:14px;margin-bottom:6px}.vt-cap.ueber .vt-cap-kopf span{color:var(--k-rot,#d9534f);font-weight:700}
.vt-balken{position:relative;display:flex;height:16px;border-radius:8px;background:var(--bg3,#f6ead2);overflow:hidden}
.vt-balken span{height:100%}.vt-balken .fest,.vt-legende i.fest{background:var(--text3,#846d52)}.vt-balken .neu,.vt-legende i.neu{background:var(--k-gruen,#78bc61)}
.vt-balken .rook,.vt-legende i.rook{background:var(--k-blau,#4aa3df)}.vt-balken .grenze{position:absolute;top:0;bottom:0;width:3px;margin-left:-1px;background:var(--text,#2c3e50)}
.vt-legende{display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:6px;font-size:11.5px;color:var(--text3,#846d52)}.vt-legende i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:4px;vertical-align:-1px}
.vt-kader{margin-top:6px;font-size:13px}
.vt-liste{display:flex;flex-direction:column;gap:8px}
.vt-zeile{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:10px;align-items:center;padding:8px 10px;border:2px solid var(--k-rand,#8b5a2b);border-radius:14px;background:var(--bg2,#fffdf9)}
.vt-zeile.halten{border-color:var(--k-gruen-tief,#4d8236);box-shadow:inset 4px 0 0 var(--k-gruen,#78bc61)}.vt-zeile.gehen{opacity:.72}
.vt-zeile.star{border-color:var(--k-gold,#e0a526)}
.vt-gesicht{width:44px;height:44px;border-radius:50%;overflow:hidden;background:var(--bg3,#f6ead2)}.vt-gesicht svg{width:100%;height:100%;display:block}
.vt-text{min-width:0}.vt-text b{display:block;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vt-text small{display:flex;align-items:center;gap:4px;flex-wrap:wrap;font-size:12px;color:var(--text3,#846d52)}
.vt-tipp{font-weight:600;color:var(--text2,#5b4a3a)}
.vt-chef{display:flex;gap:10px;align-items:flex-start;margin:10px 0;padding:10px;border-radius:14px;background:var(--bg2,#fffaf0);border:2px solid var(--k-rand,#d9c29a)}
.vt-chef-bild{flex:none;width:52px;height:52px;border-radius:50%;overflow:hidden;background:var(--bg3,#efe2c8);display:grid;place-items:center;font-size:24px}
.vt-chef-bild svg{width:100%;height:150%;margin-top:-6%}
.vt-chef-text small{font-size:12px;font-weight:700;opacity:.7}.vt-chef-text p{margin:2px 0 0;font-size:14px;line-height:1.4}.vt-pot{font-weight:700;color:var(--k-blau,#2c7cb5)}.vt-capvoll{font-weight:700;color:var(--k-rot,#c0392b)}.vt-k.halten:disabled{opacity:.6}.vt-auftrag{font-size:11px;font-weight:700;padding:1px 7px;border-radius:999px;background:var(--k-gold,#e0a526);color:#3b2a1d;vertical-align:2px}
.vt-wahl{display:flex;flex-direction:column;gap:6px}
.vt-k{font:inherit;font-size:13px;font-weight:600;min-width:74px;padding:6px 8px;border-radius:10px;cursor:pointer;border:2px solid var(--k-rand,#8b5a2b);background:var(--bg2,#fffdf9);color:var(--text,#2c3e50)}
.vt-k.halten.an{background:var(--k-gruen,#78bc61);border-color:var(--k-gruen-tief,#4d8236);color:var(--k-gruen-text,#10230a)}
.vt-k.gehen.an{background:var(--bg4,#e8d3ab)}.vt-k:disabled{opacity:.45;cursor:default}
.vt-fuss{position:fixed;left:0;right:0;bottom:0;display:flex;justify-content:center;gap:10px;padding:10px 14px calc(12px + env(safe-area-inset-bottom,0px));background:var(--bg,#f4e3c1);border-top:2px solid var(--k-rand,#8b5a2b)}
.vt-fuss .tut-knopf{flex:1;max-width:260px}.vt-fuss .tut-knopf:disabled{opacity:.45;filter:grayscale(1);box-shadow:none;cursor:default}
.vt-leer{text-align:center;color:var(--text3,#846d52)}`;
    document.head.appendChild(css);
  }

  window.DFLStartDraft = { aktiv, zustand, phase, auslauf, istAuslauf, info, empfehlung, waehle, empfehlungUebernehmen, beschliessen, zeigen, pruefen, cta,
    ergebnisVon, capLage, eigenePicks, anlegen };
  console.log('[DFL-Startdraft v1] aktiv — Start am Tag der Verträge mit erstem Draft (D108): Vorsaison, Halten/Gehen, Draft vor Saison 1');
})();
