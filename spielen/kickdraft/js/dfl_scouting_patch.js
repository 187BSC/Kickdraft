/* ═══════════════════════════════════════════════════════════════════════════
   DFL · SCOUTING NACH POSITIONEN  ·  v1   (D78, Vorschau spiel/dfl_kader_vorschau.html, freigegeben 2026-10-10, eingebaut 2026-10-11)
   ─────────────────────────────────────────────────────────────────────────
   Nutzer 2026-10-10: „Es müsste eine Liste geben, dass ich nach Positionen scouten kann und nicht bei jedem Team schon Potenzial
   usw. fertig sehe. Auch soll durchs Scouting klar werden, ob der Spieler in mein System passt oder nicht.“
     · Aufträge je Position (Vorschläge aus der Kaderanalyse oder frei über das Auswahlblatt D82). Ein Auftrag sucht in Liga,
       Free Agents und Draft: Liga ab der Stufe knapp unter deiner Elf (bis 32 J.), Free Agents und Talente bis 23 eine Stufe
       darunter; Draft: die besten 8 der Medienliste auf der Position. Gesucht wird nach öffentlichen Angaben (Stufe, Alter).
     · Scouts: Scouting-Stufe ÷ 2 (aufgerundet) gleichzeitig. Ein Bericht dauert Liga 2 Wochen, Free Agent 1, Draft 2
       (Wochentakt an advanceCalendarWeek). Laufende Aufträge schicken freie Scouts selbst los – die vielversprechendsten zuerst
       nach der groben Sicht deines Scoutings (DFLGenerator.sichtAuf, wie bisher in der Trade-Zentrale); einzelne Spieler
       scoutest du direkt („Scouten“, auch aus Trade-Zentrale und Free Agency). Ein Bericht gilt eine Saison (52 Wochen).
     · Ohne Bericht siehst du bei fremden Spielern nur die Stufe (Bronze < 70 · Silber 70–79 · Gold 80–89 · Elite 90+),
       Potenzial „?“, keine Passung, keine Detailwerte, nur die offenen Eigenschaften. Mit Bericht: Stärke genau (Draft ±2),
       Potenzial-Spanne (potentialRange mit dem Nieten-Wrapper D103, Draft über DFLGenerator.potSichtbar), Passung zum eigenen
       Stil, Detailwerte für den Stil, Platz in deiner Elf (D81), vom Scout erkannte Eigenschaften (traits.js „scout“) und was er
       an der Stil-Passung deiner Elf ändert (DFLHandel.stilPassungProzent – die Zahl, mit der die Spielformel rechnet).
     · Passung in Prozent: Stilwert der KI-Formel (DFLHandel.stilWert) gegen alle Kaderspieler seiner Position in der Liga –
       Gerade Stilwert ~ Stärke, Abstand ÷ Streuung = z, Prozent = Φ(z). Stärkebereinigt (Stilwerte hängen zu 97 % an der
       Stärke, CLAUDE.md), je Position normiert. Ab 65 % passt · 35–64 % geht · darunter passt nicht; Positionen, die für den
       Stil nicht zählen (DFLHandel.STIL_POS), bekommen keine Passung. D156 (2026-10-14): Torhüter zählen in jedem Stil – Teile aus
       ihren Detailwerten (CFG.teileTw), Torwart-Typ in passung().typ („Mitspieler“).
     · Überall gleich für fremde Spieler (DFLScouting.sicht/staerkeHtml/potText): Trade-Zentrale, Wertliste, Trading Block,
       Anfragen, Free Agency (Liste und Vertrag), Saisonstart-Tipps, Kader-Blatt. Eigene Spieler unverändert. Draft-Board und
       Medienrang bleiben (dort steht schon das Urteil deines Scoutings). Die KI behält ihre eigene Sicht.
     · D99 (Wechselwünsche, Abgaben) hängt sich an: DFLScouting.listeAnmelden({ key, titel, icon, zeilen }) – weitere Listen im
       Reiter „Bericht“ –, DFLScouting.zeileHtml(eintrag) für dieselben Zeilen.
   Zustand: CLUB.dfl.scouting = { v, nr, auftraege, aktiv, unterwegs, berichte, neu } (Berichte nach Welt-ID).
   Hängt sich an: renderScoutTab (Block über den Draft-Jahrgängen), advanceCalendarWeek (Wochentakt), #view-fo (Kachel-Text),
   window.beobachtungsFortschritt (traits.js: „scout“-Eigenschaften mit Bericht sichtbar).
   API: DFLScouting.aktiv · sicht · staerkeHtml · staerkeText · potText · potSpanne · stufe · knopfHtml · blatt · scouten · rueckruf
        · auftragStarten · auftragBeenden · kandidaten · passung · woche · zeileHtml · listeAnmelden · teilText · tauschLeiste
        · sortWert · zeichne · zustand · CFG
   Lädt nach dfl_simulieren_patch.js, vor init_bootstrap.js. CSS: css/dfl_scouting.css.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const G = window.DFLGenerator, H = window.DFLHandel, D = window.DFLSpiel;
  if (!G || !H || !D || !H.stilWert || !G.sichtAuf) { console.warn('[DFL-Scouting] DFL-Module fehlen – Patch inaktiv'); return; }

  const CFG = {
    // D120 (2026-10-13): keine Aufträge mit Wochen-Uhr mehr. Die Anlage bestimmt, wie viele Spieler je Woche angesehen werden
    // (Stufe × jeWoche), der Chefscout das Urteil (dfl_chefscout_patch.js). Er schaut zuerst auf die Fokus-Positionen (bis 2),
    // sonst auf den Bedarf aus der Kaderanalyse; einzeln angefragte Spieler („Ansehen“) kommen in der nächsten Woche zuerst.
    jeWoche: 1, startWochen: 3, fokusMax: 2, liste: 40,
    dauer: { liga: 1, frei: 1, draft: 1 },        // Wochen bis zum Bericht für einzeln angefragte Spieler
    gueltig: 52,                                   // Wochen, so lange gilt ein Bericht (eine Saison)
    jeScout: 2,                                    // Scouts = Scouting-Stufe ÷ 2, aufgerundet (Stufe 6 → 3)
    auftraegeMax: 4,
    // Kandidaten eines Auftrags (öffentliche Angaben: Stufe und Alter); abstand: Stufe ab (Stärke deiner Elf − abstand)
    kandidaten: { liga: 18, frei: 6, draft: 8, abstand: 2, maxAlter: 32, talentAlter: 23, talentLuecke: 10, freiLuecke: 10 },
    passung: { gut: 65, mittel: 35 },
    draft: { spanne: 2, potMin: 2 },              // Bericht über ein Draft-Talent: Stärke ±2, Potenzial halb so breit wie auf dem Board
    // Teile des Stilwerts wie DFLHandel.stilWert (der Prüflauf vergleicht beide)
    teile: {
      direkt: [['pace', 0.50], ['att', 0.35], ['tec', 0.15]],
      ballbesitz: [['tec', 0.45], ['mid', 0.35], ['mental', 0.20]],
      fluegel: [['pace', 0.40], ['tec', 0.30], ['mid', 0.30]],
      pressing: [['mental', 0.45], ['pace', 0.40], ['def', 0.15]]
    },
    // D156: Torhüter – Teile aus ihren Detailwerten (DFLHandel.TW_GEWICHT, Torwart-Typ je Stil)
    teileTw: Object.keys(H.TW_GEWICHT || {}).reduce((o, s) => { o[s] = Object.entries(H.TW_GEWICHT[s]); return o; }, {}),
    // Detailwerte, die der Bericht je Stil zeigt (player_attributes.js); Torhüter immer dieselben
    detail: {
      fluegel: ['schnelligkeit', 'flanken', 'dribbling', 'ausdauer'],
      direkt: ['schnelligkeit', 'schiessen', 'offStellung', 'kraft'],
      ballbesitz: ['passen', 'spielintelligenz', 'dribbling', 'ausdauer'],
      pressing: ['ausdauer', 'schnelligkeit', 'tackling', 'spielintelligenz'],
      TW: ['reflexe', 'paraden', 'einsGegenEins', 'spielaufbau']
    },
    aus: false                                     // Messschalter: alles sichtbar wie vor D78
  };
  const TEIL_NAME = { pace: 'Tempo', tec: 'Technik', mid: 'Mittelfeld', att: 'Angriff', mental: 'Mentalität', def: 'Abwehr',
    einsGegenEins: '1 gegen 1', spielaufbau: 'Spielaufbau', abwurf: 'Abwurf', reflexe: 'Reflexe', paraden: 'Paraden', schnelligkeit: 'Schnelligkeit' };
  const DETAIL_NAME = { schnelligkeit: 'Schnelligkeit', flanken: 'Flanken', dribbling: 'Dribbling', ausdauer: 'Ausdauer', passen: 'Passen',
    spielintelligenz: 'Spielintelligenz', tackling: 'Tackling', offStellung: 'Off. Stellung', schiessen: 'Schießen', kraft: 'Kraft',
    reflexe: 'Reflexe', paraden: 'Paraden', einsGegenEins: '1 gegen 1', spielaufbau: 'Spielaufbau' };
  // D95: Positionen mit Seite (AV/FL: Aufträge aus alten Spielständen suchen beide Seiten)
  const POS_NAME = { TW: 'Torwart', IV: 'Innenverteidiger', AV: 'Außenverteidiger', LV: 'Linker Verteidiger', RV: 'Rechter Verteidiger',
    ZDM: 'Defensives Mittelfeld', ZM: 'Zentrales Mittelfeld', LM: 'Linkes Mittelfeld', RM: 'Rechtes Mittelfeld',
    OM: 'Offensives Mittelfeld', ZOM: 'Offensives Mittelfeld', FL: 'Flügel', LF: 'Linker Flügel', RF: 'Rechter Flügel', ST: 'Mittelstürmer' };
  const QUELLE = { liga: 'Liga', frei: 'Free Agents', draft: 'Draft' };
  // D120: Positions-Chips (Fokus und Filter zugleich)
  const GRUPPEN = [['TW', ['TW']], ['IV', ['IV']], ['LV/RV', ['LV', 'RV', 'AV']], ['ZDM', ['ZDM']], ['ZM', ['ZM']], ['LM/RM', ['LM', 'RM']],
    ['ZOM', ['OM', 'ZOM']], ['LF/RF', ['LF', 'RF', 'FL']], ['ST', ['ST']]];
  const gruppeVon = pos => { const x = GRUPPEN.find(g => g[1].indexOf(pos) >= 0); return x ? x[0] : null; };
  const positionenVon = g => { const x = GRUPPEN.find(y => y[0] === g); return x ? x[1] : []; };

  const hatClub = () => typeof CLUB !== 'undefined' && CLUB;
  const dfl = () => !!(hatClub() && CLUB.dfl && CLUB.dfl.aktiv && typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.dfl);
  const aktiv = () => !CFG.aus && dfl();
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const de = (x, n) => Number(x).toLocaleString('de-DE', { minimumFractionDigits: n || 0, maximumFractionDigits: n || 0 });
  const mio = x => (typeof formatEuro === 'function' ? formatEuro(x) : de((x || 0) / 1e6, 1) + ' Mio €');
  const ico = n => `<i class="ti ti-${n}" aria-hidden="true"></i>`;
  const voll = p => (p.firstName ? p.firstName + ' ' : '') + p.name;
  const kurz = p => (p.firstName ? p.firstName.charAt(0) + '. ' : '') + p.name;
  const posName = x => x === 'OM' ? 'ZOM' : x;
  const posBadge = pos => `<span class="pos-badge-sm pos-${esc(posName(pos))}">${esc(posName(pos))}</span>`;
  const posText = p => { const n = [...new Set((p.positions || []).filter(x => x && x !== p.pos))].map(posName);
    return posName(p.pos) + (n.length ? ' (' + n.join(', ') + ')' : ''); };
  const wochen = n => n + ' ' + (n === 1 ? 'Woche' : 'Wochen');
  const wo = n => n + ' Wo.';
  const klemme = (x, a, b) => Math.max(a, Math.min(b, x));
  const stufeScouting = () => (hatClub() && CLUB.facilities && CLUB.facilities.scouting) || 5;
  const scoutsGesamt = () => Math.max(1, Math.round(stufeScouting() * CFG.jeWoche));      // D120: Berichte je Woche
  const saisonWochen = () => (typeof SEASON_WEEKS === 'number' ? SEASON_WEEKS : 52);
  // Fortlaufende Woche über die Saisons (Saison 1, Woche 1 = 1) – für Dauer und Gültigkeit der Berichte
  const jetzt = () => ((LEAGUE.season || 1) - 1) * saisonWochen() + (LEAGUE.week || 1);
  const speichern = () => { if (typeof saveGameState === 'function') { try { saveGameState(); } catch (e) { /* ohne Speicher */ } } };
  const toast = (t, art) => { if (typeof showToast === 'function') { try { showToast(t, art || 'info'); } catch (e) { /* ohne Toast */ } } };

  // ── Zustand ───────────────────────────────────────────────────────────────
  function zustand() {
    if (!dfl()) return null;
    const z = CLUB.dfl.scouting = CLUB.dfl.scouting || {};
    if (z.v !== 1) Object.assign(z, { v: 1, nr: z.nr || 0 });
    ['auftraege', 'unterwegs', 'neu', 'fokus'].forEach(k => { if (!Array.isArray(z[k])) z[k] = []; });
    if (!z.seg) z.seg = 'draft';
    // D120: alte Aufträge werden zum Fokus (höchstens 2 Positionen), danach gibt es keine Aufträge mehr
    if (z.auftraege.length) { z.auftraege.forEach(a => { const g = gruppeVon(a.pos); if (g && z.fokus.indexOf(g) < 0) z.fokus.push(g); }); z.fokus = z.fokus.slice(-CFG.fokusMax); z.auftraege = []; }
    if (!z.berichte || typeof z.berichte !== 'object') z.berichte = {};
    return z;
  }
  const ui = { tab: null, filter: 'alle', wahl: null, aufgedeckt: new Set(), offen: null };

  // ── Welt: Spieler nach Welt-ID (Liga, Free Agents, Draft) ─────────────────
  // Spielspieler tragen die Welt-ID als dflId (eigene und Free Agents „fa_…“); Weltspieler ihre ID.
  function weltId(p) {
    if (p == null) return null;
    if (typeof p === 'string') return p.replace(/^fa_/, '');
    if (p.dflId) return String(p.dflId);
    return String(p.id || '').replace(/^fa_/, '');
  }
  function istEigen(p, id) {
    if (typeof SQUAD === 'undefined' || !SQUAD) return false;
    id = id || weltId(p);
    return SQUAD.some(q => q === p || (p && typeof p === 'object' && q.id === p.id) || (q.dflId && String(q.dflId) === id) || q.id === id);
  }
  let idx = null;
  function index() {
    const L = D.liga();
    const k = (L.saisonIndex || 0) + ':' + (L.freie || []).length + ':' + (L.handel || []).length + ':' + L.teams.reduce((s, t) => s + t.roster.length + (t.practice_squad || []).length, 0) +
      ':' + (L.draft ? L.draft.jahr + '/' + L.draft.talente.length : '') + ':' + (typeof LEAGUE !== 'undefined' && LEAGUE ? LEAGUE.season + '/' + LEAGUE.week : '');
    if (idx && idx.L === L && idx.k === k) return idx;
    const m = new Map(), eig = D.eigeneDflId();
    L.teams.forEach(t => t.roster.concat(t.practice_squad || []).forEach(p => m.set(String(p.id), { w: p, quelle: t.id === eig ? 'eigen' : 'liga', team: t })));
    (L.freie || []).forEach(p => { if (!m.has(String(p.id))) m.set(String(p.id), { w: p, quelle: 'frei', team: null }); });
    [[L.draft, 0], [L.draftNaechste, 1]].forEach(([j, voraus]) => (j && j.talente || []).forEach(p => {
      if (!m.has(String(p.id))) m.set(String(p.id), { w: p, quelle: 'draft', team: null, jahrgang: j.jahr, voraus });
    }));
    idx = { L, k, m };
    return idx;
  }
  const finde = id => (id == null ? null : index().m.get(String(id)) || null);
  // Weltspieler zu einem Spielspieler (Free Agent im Spiegel CLUB.freeAgents) oder einer ID
  const weltVon = p => { const f = finde(weltId(p)); return f ? f.w : (p && typeof p === 'object' && p.seed != null && p.seed < 1 ? p : null); };
  const teamVon = id => D.liga().teams.find(t => t.id === id) || null;
  const farbenVon = T => (T && T.farben) || ((T && D.franchise(T.id)) || {}).farben || null;

  // ── Berichte ──────────────────────────────────────────────────────────────
  function bericht(id) {
    const z = zustand(); if (!z) return null;
    const b = z.berichte[id];
    if (!b) return null;
    if (jetzt() - b.a >= CFG.gueltig) { delete z.berichte[id]; return null; }
    return b;
  }
  const unterwegs = id => { const z = zustand(); return z ? z.unterwegs.find(u => u.id === id) || null : null; };
  function hatBericht(p) {
    if (!aktiv()) return true;
    const id = weltId(p);
    return istEigen(p, id) || !!bericht(id);
  }
  const freieScouts = () => { const z = zustand(); return z ? Math.max(0, scoutsGesamt() - z.unterwegs.length) : 0; };

  // ── Stufen (öffentlich) ───────────────────────────────────────────────────
  const STUFEN = [{ ab: 90, key: 'elite', name: 'Elite', spanne: '90+', kurz: '90er' }, { ab: 80, key: 'gold', name: 'Gold', spanne: '80–89', kurz: '80er' },
    { ab: 70, key: 'silber', name: 'Silber', spanne: '70–79', kurz: '70er' }, { ab: 0, key: 'bronze', name: 'Bronze', spanne: 'unter 70', kurz: '<70' }];
  const stufe = ovr => STUFEN.find(s => (ovr || 0) >= s.ab) || STUFEN[STUFEN.length - 1];
  const stufeBoden = ovr => stufe(ovr).ab;

  // ── Potenzial wie im Spiel: potentialRange (mit Nieten-Wrapper D103) auf der Spielsicht des Spielers ──
  function spielSicht(w) {
    if (w.seed >= 1 || w.dflSeed != null) return w;                       // schon ein Spielspieler (Free Agent, eigener)
    return { id: 'sq_' + w.id, ovr: w.ovr, age: w.age, gamesPlayed: w.gamesPlayed || 0, truePotential: Math.max(w.ovr, w.truePotential || w.ovr),
      niete: w.niete, diamant: w.diamant, seed: Math.floor((w.seed || 0.5) * 2147483646) + 1, pos: w.pos, positions: w.positions };
  }
  function potSpanne(p) {
    const sc = stufeScouting();
    if (typeof potentialRange === 'function') { try { return potentialRange(spielSicht(p), sc); } catch (e) { /* Ersatz */ } }
    const s = G.potSichtbar(p, sc);
    return { lo: s, hi: s, exact: true };
  }
  // Draft-Talent: das Board schätzt (DFLKader.schaetzung), der Bericht engt ein (Stärke ±2, Potenzial halb so breit, eigener Würfel)
  function draftSchaetzung(t, voraus, mitBericht) {
    const K = window.DFLKader, board = K && K.schaetzung ? K.schaetzung(t, voraus || 0) : null;
    if (!mitBericht) return board;
    const r = G.rngAus((G.hashText('bericht|' + t.id) ^ 0x5c0a7) >>> 0);
    const basis = typeof computeOvrFromAreas === 'function' ? computeOvrFromAreas(t) : t.ovr;
    const o = basis + Math.round(r.normal(0, 1));
    const p = o + (G.potSichtbar(t, stufeScouting()) - t.ovr) + Math.round(r.normal(0, 1.5));
    const breite = board ? (board.pot[1] - board.pot[0]) / 2 : 6, h = Math.max(CFG.draft.potMin, Math.round(breite / 2));
    return { ovr: [o - CFG.draft.spanne, Math.min(99, o + CFG.draft.spanne)], pot: [Math.max(o, p - h), Math.min(99, p + h)], board };
  }

  // ── Sicht auf einen Spieler (zentral für alle Anzeigen) ───────────────────
  // { eigen, bericht, quelle, ovr (genau, sonst null), stufe, pot {lo, hi} | null, draft {ovr:[a,b], pot:[a,b]} | null }
  function sicht(p) {
    const id = weltId(p), f = finde(id), w = (f && f.w) || (p && typeof p === 'object' ? p : null);
    if (!w) return null;
    const eigen = istEigen(p, id);
    const quelle = eigen ? 'eigen' : f ? f.quelle : (p && p.freeAgent ? 'frei' : 'liga');
    const b = eigen || !aktiv() || !!bericht(id);
    const o = (p && typeof p === 'object' && p.ovr != null) ? p.ovr : w.ovr;
    if (quelle === 'draft') {
      const s = draftSchaetzung(w, f && f.voraus, b);
      return { eigen: false, bericht: b, quelle, id, w, ovr: null, stufe: stufe(w.ovr), pot: null, draft: s, team: null };
    }
    return { eigen, bericht: b, quelle, id, w, ovr: b ? o : null, stufe: stufe(o), pot: b ? potSpanne(p && typeof p === 'object' ? p : w) : null,
      draft: null, team: f ? f.team : null };
  }
  const spanneText = r => r ? (r.lo === r.hi ? String(r.lo) : r.lo + '–' + r.hi) : '?';
  // Stärke als HTML: genau (Zahl) oder Stufe (Marke); art 'kurz' = „80er“, 'lang' = „Gold 80–89“
  function staerkeHtml(p, art) {
    const s = sicht(p);
    if (!s) return '';
    if (s.draft) {
      const r = s.draft.ovr;
      return `<span class="sc-zahl${s.bericht ? '' : ' leise'}" title="${s.bericht ? 'Draft-Talent: Bericht deines Scouts' : 'Draft-Talent: Schätzung des Draft-Boards'}">${r[0]}–${r[1]}</span>`;
    }
    if (s.bericht) return `<span class="sc-zahl">${s.ovr}</span>`;
    const st = s.stufe;
    return `<span class="sc-stufe ${st.key}" title="Stärke: ${st.name} (${st.spanne}) – genau erst mit Scout-Bericht">${art === 'lang' ? st.name + ' ' + st.spanne : st.kurz}</span>`;
  }
  function staerkeText(p) {
    const s = sicht(p);
    if (!s) return '';
    if (s.draft) return s.draft.ovr[0] + '–' + s.draft.ovr[1];
    return s.bericht ? String(s.ovr) : `${s.stufe.name} ${s.stufe.spanne}`;
  }
  function potText(p) {
    const s = sicht(p);
    if (!s) return '?';
    if (s.draft) return s.draft.pot[0] + '–' + s.draft.pot[1];
    return s.bericht ? spanneText(s.pot) : '?';
  }
  // Sortierschlüssel fremder Spieler: erst die (öffentliche) Stufe, darin genau mit Bericht, sonst die grobe Sicht deines
  // Scoutings (DFLGenerator.sichtAuf – die Zahl, die vor D78 in der Trade-Zentrale stand)
  function sortWert(p) {
    const s = sicht(p); if (!s) return 0;
    if (s.draft) return (s.draft.ovr[0] + s.draft.ovr[1]) / 2;
    const wert = s.bericht && s.ovr != null ? s.ovr : G.sichtAuf(s.w, stufeScouting(), (CLUB.dfl.saisonIndex || 0) * 13).ovr;
    return stufeBoden(s.bericht && s.ovr != null ? s.ovr : s.w.ovr) * 1000 + wert;
  }
  // Vereinfachte Nase des Scouts: wen er zuerst ansieht (Stärke, bei Jungen das Potenzial)
  function nase(e) {
    if (e.quelle === 'draft') { const s = draftSchaetzung(e.w, e.voraus, false); return s ? 0.45 * (s.ovr[0] + s.ovr[1]) / 2 + 0.55 * (s.pot[0] + s.pot[1]) / 2 : e.w.ovr; }
    const s = G.sichtAuf(e.w, stufeScouting(), (CLUB.dfl.saisonIndex || 0) * 13);
    return e.w.age <= 25 ? 0.6 * s.ovr + 0.4 * s.pot : s.ovr;
  }

  // ── Passung zum Stil (stärkebereinigt, je Position) ───────────────────────
  const MERKMAL = {
    pace: p => p.pace || 55, att: p => p.att || 55, mid: p => p.mid || 55, mental: p => p.mental || 55, def: p => p.def || 55,
    tec: p => (p.technik != null ? p.technik : ((p.mid || 55) + (p.att || 55)) / 2)
  };
  // D156: Detailwerte der Torhüter (dieselben wie im Spieler-Blatt, DFLHandel.twWerte)
  ['einsGegenEins', 'spielaufbau', 'abwurf', 'reflexe', 'paraden', 'schnelligkeit'].forEach(k => {
    MERKMAL[k] = p => { const w = H.twWerte ? H.twWerte(p) : null; return w && isFinite(w[k]) ? w[k] : 55; };
  });
  const merkmal = art => /^stil:/.test(art) ? (p => H.stilWert(p, art.slice(5))) : MERKMAL[art];
  let regCache = { k: '', m: new Map() };
  // D95: je Gruppe ohne Seite (LV und RV zusammen, LF und RF, LM und RM) – sonst zerfällt die Gerade in zu kleine Gruppen
  function reg(pos, art) {
    const L = D.liga(), eig = D.eigeneDflId();
    const k = (L.saisonIndex || 0) + ':' + L.teams.reduce((s, t) => s + t.roster.length, 0) + ':' + (L.handel || []).length;
    if (regCache.k !== k) regCache = { k, m: new Map() };
    const gr = G.grund(pos), key = gr + '|' + art;
    if (regCache.m.has(key)) return regCache.m.get(key);
    const f = merkmal(art);
    const ps = [].concat(...L.teams.filter(t => t.id !== eig).map(t => t.roster)).filter(p => G.grund(p.pos) === gr && isFinite(p.ovr));
    const n = Math.max(1, ps.length), xs = ps.map(p => p.ovr), ys = ps.map(f);
    const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
    let sxy = 0, sxx = 0;
    xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) ** 2; });
    const b = sxx ? sxy / sxx : 0;
    const sd = Math.sqrt(ys.reduce((a, y, i) => a + (y - (my + b * (xs[i] - mx))) ** 2, 0) / n);
    const r = { a: my - b * mx, b, sd: Math.max(0.5, sd), n: ps.length };
    regCache.m.set(key, r);
    return r;
  }
  // Normalverteilung Φ(z) (Abramowitz/Stegun 7.1.26)
  function phi(z) {
    const x = Math.abs(z) / Math.SQRT2, t = 1 / (1 + 0.3275911 * x);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
  }
  function eigenerStil() {
    const T = window.DFLTaktik;
    const s = T && T.eigenerStil ? T.eigenerStil() : null;
    return (s && s.stil) || (CLUB.dfl.taktik && CLUB.dfl.taktik.stil) || null;
  }
  const stilName = s => (window.DFLTaktik && DFLTaktik.STILE && DFLTaktik.STILE[s] ? DFLTaktik.STILE[s].name : H.STIL_TEXT[s] || s || 'Stil');
  const passKlasse = pct => pct >= CFG.passung.gut ? 'gut' : pct >= CFG.passung.mittel ? 'mittel' : 'schlecht';
  const passText = pct => pct >= CFG.passung.gut ? 'passt' : pct >= CFG.passung.mittel ? 'geht' : 'passt nicht';
  // { stil, relevant, z, pct, klasse, text, teile: [[merkmal, wert, abstand zur Erwartung]] } – immer am Weltspieler
  function passung(p, stil) {
    stil = stil || eigenerStil();
    const w = weltVon(p) || p;
    if (!stil || !w || !H.STIL_POS[stil]) return null;
    const pos = G.dflPos(w.pos);
    if (H.stilRelevant ? !H.stilRelevant({ pos }, stil) : H.STIL_POS[stil].indexOf(G.grund(pos)) < 0) return { stil, relevant: false, pos };
    const R = reg(pos, 'stil:' + stil);
    const z = klemme((H.stilWert(w, stil) - (R.a + R.b * w.ovr)) / R.sd, -3, 3);
    const pct = Math.round(phi(z) * 100);
    const typ = H.twTyp ? H.twTyp(w, stil) : null;                       // D156: Torwart-Typ („Mitspieler“), Feldspieler null
    const teile = ((typ ? CFG.teileTw : CFG.teile)[stil] || []).map(([k, g]) => {
      const r = reg(pos, k), v = MERKMAL[k](w);
      return [k, Math.round(v), Math.round(v - (r.a + r.b * w.ovr)), g];
    });
    return { stil, relevant: true, pos, z, pct, klasse: passKlasse(pct), text: passText(pct), teile, typ };
  }
  const passHtml = (pa, klein) => !pa ? '' : !pa.relevant
    ? `<span class="sc-passung neutral" title="Auf ${esc(posName(pa.pos))} zählt der Stil nicht">${klein ? 'Stil –' : 'zählt nicht'}</span>`
    : `<span class="sc-passung ${pa.klasse}" title="Passung zum ${esc(stilName(pa.stil))}${pa.typ ? ' als ' + esc(pa.typ) : ''}: ${pa.pct} % (${pa.text})"><i></i>${pa.pct} %</span>`;

  // Wirkung auf die Stil-Passung deiner Elf (die Zahl der Spielformel, D55): mit ihm im Kader, falls er in die Startelf käme
  function stilWirkung(w, stil) {
    try {
      const L = D.welt(), e = L.teams.find(t => t.id === D.eigeneDflId());
      if (!e || !stil) return null;
      const vor = H.stilPassungProzent(L, e, stil);
      const mit = H.stilPassungProzent(L, Object.assign({}, e, { roster: e.roster.concat([w]) }), stil);
      const inElf = G.startelfVon(e.roster.concat([w])).indexOf(w) >= 0;
      return { vor, mit, inElf };
    } catch (e) { return null; }
  }

  // ── Detailwerte für den Stil (sieht man nur mit Bericht) ──────────────────
  const detailCache = new Map();
  function detailwerte(w, stil) {
    if (typeof spielerWerte !== 'function') return [];
    const keys = G.dflPos(w.pos) === 'TW' ? CFG.detail.TW : CFG.detail[stil] || CFG.detail.ballbesitz;
    const k = w.id + '|' + w.ovr + '|' + w.age + '|' + (w.koerper || 0);
    let werte = detailCache.get(k);
    if (!werte) {
      try { werte = spielerWerte(D.zuSpielSpieler(w)) || {}; } catch (e) { werte = {}; }
      if (detailCache.size > 400) detailCache.clear();
      detailCache.set(k, werte);
    }
    return keys.filter(x => typeof werte[x] === 'number').map(x => [x, Math.round(werte[x])]);
  }

  // ── Platz in deiner Elf (D81: Abzug je Platz) ─────────────────────────────
  function platzInElf(w, ovr) {
    if (typeof FORMATIONS === 'undefined' || !CLUB.formation || !FORMATIONS[CLUB.formation]) return null;
    const P = window.DFLPosition, slots = FORMATIONS[CLUB.formation];
    const kand = { pos: posName(w.pos), positions: [w.pos].concat((w.positions || []).filter(x => x !== w.pos)).map(posName), ovr };
    const platz = s => (P ? P.platz(s) : s.group);
    const abz = (q, z) => (P ? P.abzug(q, z) : (posName(q.pos) === z ? 0 : 99));
    const hier = slots.map(s => ({ s, z: platz(s) })).filter(x => abz(kand, x.z) <= 2);
    if (!hier.length) return { text: `Kein Platz für ihn im ${CLUB.formation} ohne großen Abzug.`, art: 'keiner' };
    const besetzt = hier.map(x => {
      const q = CLUB.lineup && typeof getPlayer === 'function' ? getPlayer(CLUB.lineup[x.s.id]) : null;
      return { x, q, wirk: q ? (P ? P.wirksam(q, x.z) : q.ovr) : 0, er: ovr - abz(kand, x.z) };
    });
    // Plätze nach Abzug: „LM/RM ohne Abzug, OM/ST −2“
    const gruppen = new Map();
    hier.forEach(x => { const a = abz(kand, x.z); if (!gruppen.has(a)) gruppen.set(a, new Set()); gruppen.get(a).add(x.z || x.s.label); });   // D95: Platz mit Seite
    const plaetze = [...gruppen.keys()].sort((a, b) => a - b).map(a => `${[...gruppen.get(a)].join('/')} ${a ? '−' + a : 'ohne Abzug'}`).join(', ');
    const schwach = besetzt.slice().sort((a, b) => a.wirk - b.wirk)[0];
    const kopf = `Im ${CLUB.formation}: ${plaetze}. `;
    if (!schwach.q) return { text: kopf + 'Der Platz ist frei → <b>Stammspieler</b>.', art: 'stamm' };
    if (schwach.er > schwach.wirk) return { text: kopf + `Stärker als ${esc(kurz(schwach.q))} (${Math.round(schwach.wirk)}) → <b>Stammspieler</b>.`, art: 'stamm' };
    const vor = besetzt.filter(b => b.q).sort((a, b) => b.wirk - a.wirk).slice(0, 2).map(b => `${esc(kurz(b.q))} (${Math.round(b.wirk)})`);
    return { text: kopf + `Hinter ${vor.join(' und ')} → <b>Ergänzung</b>${w.age <= 23 ? ', Talent für später' : ''}.`, art: 'ergaenzung' };
  }

  // ── Kaderanalyse (Vorschläge für Aufträge) ────────────────────────────────
  function analyse() {
    try {
      const eigen = D.eigenSync();
      if (!eigen) return [];
      const a = G.kaderAnalyse(eigen, { scouting: stufeScouting(), saat: (CLUB.dfl.saisonIndex || 0) * 101 });
      return Object.entries(a).filter(([, v]) => v.art).map(([pos, v]) => Object.assign({ pos }, v)).sort((x, y) => y.bedarf - x.bedarf);
    } catch (e) { console.warn('[DFL-Scouting] Kaderanalyse', e); return []; }
  }
  const POSITIONEN = () => Object.keys(G.CFG.kader || { TW: 1, IV: 1, AV: 1, ZDM: 1, ZM: 1, OM: 1, FL: 1, ST: 1 });

  // ── Kandidaten eines Auftrags ─────────────────────────────────────────────
  // Gesucht wird mit öffentlichen Angaben (Stufe, Alter, Medienliste); sortiert nach der groben Sicht deines Scoutings
  function kandidaten(a) {
    const L = D.liga(), eig = D.eigeneDflId(), C = CFG.kandidaten, pos = a.pos;
    const anders = p => G.dflPos(p.pos) !== pos && !(G.altbestand(pos) && G.grund(p.pos) === G.grund(pos));   // D95
    const elf = (D.eigeneStaerke && D.eigeneStaerke().ovr) || 75;
    const min = stufeBoden(elf - C.abstand);
    const passt = (p, luecke) => (stufeBoden(p.ovr) >= min - luecke && p.age <= C.maxAlter) || (p.age <= C.talentAlter && stufeBoden(p.ovr) >= min - C.talentLuecke);
    const gefunden = { liga: 0, frei: 0, draft: 0 };
    const liga = [], frei = [], draft = [];
    L.teams.forEach(t => {
      if (t.id === eig) return;
      t.roster.forEach(p => {
        if (anders(p) || istEigen(p)) return;
        gefunden.liga++;
        if (passt(p, 0)) liga.push({ id: String(p.id), w: p, quelle: 'liga', team: t });
      });
    });
    (L.freie || []).forEach(p => {
      if (anders(p) || istEigen(p)) return;
      gefunden.frei++;
      if (passt(p, C.freiLuecke)) frei.push({ id: String(p.id), w: p, quelle: 'frei', team: p._exVerein ? teamVon(p._exVerein) : null });
    });
    ((L.draft && L.draft.talente) || []).forEach(p => {
      if (anders(p)) return;
      gefunden.draft++;
      draft.push({ id: String(p.id), w: p, quelle: 'draft', team: null, voraus: 0 });
    });
    liga.forEach(e => { e.nase = nase(e); }); frei.forEach(e => { e.nase = nase(e); });
    const nachNase = (x, y) => y.nase - x.nase;
    const liste = liga.sort(nachNase).slice(0, C.liga)
      .concat(frei.sort(nachNase).slice(0, C.frei))
      .concat(draft.sort((x, y) => ((x.w.medien && x.w.medien.rang) || 999) - ((y.w.medien && y.w.medien.rang) || 999)).slice(0, C.draft));
    liste.forEach(e => { if (e.nase == null) e.nase = nase(e); });
    return { liste, gefunden, min, elf };
  }
  // Schutz der Vereine (D50): gesperrte Spieler sind nicht zu haben – kein Scout fährt hin
  let schutzCache = { k: '', m: new Map() };
  function schutz(e) {
    if (e.quelle !== 'liga' || !e.team) return null;
    const L = D.liga(), k = (L.handel || []).length + ':' + (typeof LEAGUE !== 'undefined' && LEAGUE ? LEAGUE.season + '/' + LEAGUE.week : '');
    if (schutzCache.k !== k) schutzCache = { k, m: new Map() };
    if (!schutzCache.m.has(e.team.id)) {
      try { H.taktikenSetzen(L); schutzCache.m.set(e.team.id, H.schutzKarte(L, e.team, H.raenge(L))); } catch (err) { schutzCache.m.set(e.team.id, new Map()); }
    }
    return schutzCache.m.get(e.team.id).get(e.w.id) || null;
  }

  // ── Scouts losschicken, zurückrufen, Wochentakt ───────────────────────────
  function dauerVon(quelle) { return CFG.dauer[quelle] || CFG.dauer.liga; }
  function scouten(id, opt) {
    opt = opt || {};
    const z = zustand(); if (!z) return { ok: false, grund: 'Kein Spielstand.' };
    id = weltId(id);
    const f = finde(id);
    if (!f || f.quelle === 'eigen' || istEigen(f.w, id)) return { ok: false, grund: 'Eigene Spieler kennst du genau.' };
    if (bericht(id)) return { ok: false, grund: 'Für ihn liegt schon ein Bericht vor.' };
    if (unterwegs(id)) return { ok: false, grund: 'Ein Scout ist schon unterwegs.' };
    if (!freieScouts()) return { ok: false, grund: `Diese Woche sind schon ${scoutsGesamt()} Spieler vorgemerkt.` };
    const s = schutz(f);
    if (s && s.stufe === 'gesperrt' && !opt.trotzdem) return { ok: false, grund: `${voll(f.w)} ist nicht zu haben (${s.grund}).` };
    const d = dauerVon(f.quelle);
    z.unterwegs.push({ id, q: f.quelle, rest: d, ges: d, au: opt.auftrag || null, start: jetzt() });
    if (!opt.still) { toast(`${voll(f.w)}: Bericht nächste Woche.`, 'info'); speichern(); }
    return { ok: true, dauer: d };
  }
  function rueckruf(id) {
    const z = zustand(); if (!z) return false;
    const i = z.unterwegs.findIndex(u => u.id === weltId(id));
    if (i < 0) return false;
    z.unterwegs.splice(i, 1);
    speichern();
    return true;
  }
  // Freie Scouts zu den laufenden Aufträgen schicken (abwechselnd, die vielversprechendsten zuerst)
  function verteilen() {
    const z = zustand(); if (!z || !freieScouts()) return 0;
    const laufend = z.auftraege.filter(a => !a.pause);
    if (!laufend.length) return 0;
    const schlangen = laufend.map(a => ({ a, liste: kandidaten(a).liste.filter(e => !bericht(e.id) && !unterwegs(e.id) && !(schutz(e) && schutz(e).stufe === 'gesperrt'))
      .sort((x, y) => y.nase - x.nase) }));
    let n = 0, weiter = true;
    while (freieScouts() && weiter) {
      weiter = false;
      for (const s of schlangen) {
        if (!freieScouts()) break;
        const e = s.liste.shift();
        if (!e) continue;
        if (scouten(e.id, { auftrag: s.a.id, still: true }).ok) { n++; weiter = true; }
      }
    }
    return n;
  }
  function woche() {
    const z = zustand(); if (!z || !aktiv()) return [];
    const fertig = [];
    z.unterwegs = z.unterwegs.filter(u => {
      u.rest--;
      if (u.rest > 0) return true;
      z.berichte[u.id] = { a: jetzt(), s: LEAGUE.season, w: LEAGUE.week, q: u.q, st: stufeScouting(), au: u.au || null };
      if (z.neu.indexOf(u.id) < 0) z.neu.push(u.id);
      fertig.push(u.id);
      return false;
    });
    // abgelaufene Berichte (älter als eine Saison) und Neu-Marken ohne Bericht aufräumen
    Object.keys(z.berichte).forEach(id => { if (jetzt() - z.berichte[id].a >= CFG.gueltig) delete z.berichte[id]; });
    z.neu = z.neu.filter(id => z.berichte[id]).slice(-40);
    // D120: der Rest der Woche geht automatisch an die Fokus-Positionen (ohne Meldung – das Postfach bleibt kurz)
    const auto = autoBerichte(Math.max(0, scoutsGesamt() - fertig.length));
    if (fertig.length) meldung(fertig);
    try { diamantPruefen(fertig.concat(auto)); } catch (e) { console.warn('[DFL-Scouting] Rohdiamant', e); }
    return fertig.concat(auto);
  }
  // Rohdiamanten (Rückmeldung 17.10. (11)): ein fertiger Bericht erkennt ihn mit Chance nach Scouting-Stufe (DFLGenerator.diamantEntdecken);
  // dann Meldung des Chefscouts und ein Moment mit der Karte (DFLWoche)
  function diamantPruefen(ids) {
    (ids || []).forEach(id => {
      const f = finde(id); if (!f || !f.w || !f.w.diamant || f.w.diamant.entdeckt) return;
      if (!G.diamantEntdecken(f.w, stufeScouting())) return;
      const w = f.w, wo2 = f.quelle === 'draft' ? 'im Draft ' + (f.jahrgang || '') : f.quelle === 'frei' ? 'als Free Agent' : 'bei ' + ((f.team && f.team.name) || '');
      const C = window.DFLChefscout, cs = C && C.person ? C.person() : null;
      if (typeof addNews === 'function') addNews('transfer', 'Rohdiamant entdeckt: ' + voll(w),
        `${cs ? voll(cs) + ': ' : ''}„Den hat keiner auf dem Zettel. ${voll(w)} (${posName(w.pos)}, ${w.age} J.) ${wo2} kann viel mehr, als alle denken – Potenzial ${w.truePotential} statt ${w.diamant.schein}.${f.quelle === 'liga' ? ' Sein Verein wird ihn aber nicht hergeben.' : ''}“`);
      if (window.DFLWoche && DFLWoche.diamantMerken) DFLWoche.diamantMerken({ id: w.id, quelle: f.quelle });   // Draft: gleich auf die Merkliste
      if (window.DFLWoche && DFLWoche.diamantMoment) DFLWoche.diamantMoment(w, f.quelle, f.team ? f.team.id : null);
    });
  }
  // Fokus-Positionen (Weltcodes): gewählte Chips, sonst die zwei größten Lücken laut Kaderanalyse
  function fokusPositionen() {
    const z = zustand(); if (!z) return [];
    if (z.fokus.length) return [].concat(...z.fokus.map(positionenVon));
    return [].concat(...GRUPPEN.map(g => g[1].filter(x => x !== 'AV' && x !== 'FL' && x !== 'ZOM')));      // „Alle“: überall die Besten zuerst
  }
  // n Berichte sofort: Kandidaten der Fokus-Positionen aus Draft, Liga (wer zu haben ist, zuerst) und Free Agents im Wechsel
  function autoBerichte(n) {
    const z = zustand(); if (!z || n <= 0) return [];
    const schlangen = { draft: [], liga: [], frei: [] }, gesehen = new Set();
    const zh = zuHabenIds();
    fokusPositionen().forEach(pos => {
      let k; try { k = kandidaten({ pos }); } catch (e) { return; }
      k.liste.forEach(e => {
        if (gesehen.has(e.id) || bericht(e.id) || unterwegs(e.id) || (schutz(e) && schutz(e).stufe === 'gesperrt')) return;
        gesehen.add(e.id); schlangen[e.quelle].push(e);
      });
    });
    schlangen.draft.sort((x, y) => ((x.w.medien && x.w.medien.rang) || 999) - ((y.w.medien && y.w.medien.rang) || 999));
    schlangen.liga.sort((x, y) => (zh.has(String(y.id)) - zh.has(String(x.id))) || (y.nase - x.nase));
    schlangen.frei.sort((x, y) => y.nase - x.nase);
    const reihe = z.seg === 'liga' ? ['liga', 'draft', 'frei'] : z.seg === 'frei' ? ['frei', 'liga', 'draft'] : ['draft', 'liga', 'frei'];
    const aus = [];
    while (aus.length < n && reihe.some(q => schlangen[q].length)) {
      for (const q of reihe) { if (aus.length >= n) break; const e = schlangen[q].shift(); if (e) aus.push(e); }
    }
    aus.forEach(e => {
      z.berichte[e.id] = { a: jetzt(), s: LEAGUE.season, w: LEAGUE.week, q: e.quelle, st: stufeScouting(), au: 'fokus' };
      if (z.neu.indexOf(e.id) < 0) z.neu.push(e.id);
    });
    z.neu = z.neu.slice(-40);
    return aus.map(e => e.id);
  }
  // D99: wer bei anderen Vereinen weg will oder abgegeben wird (Welt-IDs → Eintrag)
  let zhCache = { k: '', m: new Map() };
  function zuHabenIds() {
    const L = D.liga(), k = (L.handel || []).length + ':' + LEAGUE.season + '/' + LEAGUE.week;
    if (zhCache.k !== k) {
      zhCache = { k, m: new Map() };
      try { if (H.zuHabenListe) H.zuHabenListe(L, { ohne: [D.eigeneDflId()] }).forEach(x => zhCache.m.set(String(x.p.id), x)); } catch (e) { /* ohne D99 */ }
    }
    return zhCache.m;
  }
  function meldung(ids) {
    if (typeof addNews !== 'function') return;
    const stil = eigenerStil();
    const teile = ids.map(id => {
      const f = finde(id); if (!f) return null;
      const s = sicht(f.w), pa = passung(f.w, stil);
      const wo2 = f.quelle === 'frei' ? 'Free Agent' : f.quelle === 'draft' ? 'Draft ' + (f.jahrgang || '') : (f.team ? f.team.kurz || f.team.name : '');
      const st = s.draft ? `Stärke ${s.draft.ovr[0]}–${s.draft.ovr[1]}` : `Stärke ${s.ovr}`;
      return `${voll(f.w)} (${posName(f.w.pos)}, ${wo2}): ${st}, Potenzial ${potText(f.w)}` + (pa && pa.relevant ? `, ${pa.text} zum ${stilName(stil)} (${pa.pct} %)` : '');
    }).filter(Boolean);
    if (!teile.length) return;
    const f0 = finde(ids[0]);
    addNews('transfer', teile.length === 1 && f0 ? 'Scout-Bericht: ' + voll(f0.w) : teile.length + ' Scout-Berichte fertig', teile.join(' · ') + '.');
  }

  // ── Aufträge ──────────────────────────────────────────────────────────────
  function auftragStarten(pos, herkunft) {
    const z = zustand(); if (!z) return null;
    pos = G.dflPos(pos);
    const schon = z.auftraege.find(a => a.pos === pos);
    if (schon) { z.aktiv = schon.id; return schon; }
    if (z.auftraege.length >= CFG.auftraegeMax) { toast(`Höchstens ${CFG.auftraegeMax} Aufträge gleichzeitig – beende erst einen.`, 'warn'); return null; }
    z.nr = (z.nr || 0) + 1;
    const a = { id: 'a' + z.nr, pos, stil: eigenerStil(), start: jetzt(), s: LEAGUE.season, w: LEAGUE.week, herkunft: herkunft || 'frei' };
    z.auftraege.push(a);
    z.aktiv = a.id;
    const n = verteilen();
    toast(`Auftrag ${posName(pos)} läuft${n ? ` – ${n} ${n === 1 ? 'Scout fährt' : 'Scouts fahren'} los` : ''}.`, 'info');
    speichern();
    return a;
  }
  function auftragBeenden(id) {
    const z = zustand(); if (!z) return false;
    const i = z.auftraege.findIndex(a => a.id === id);
    if (i < 0) return false;
    z.auftraege.splice(i, 1);
    if (z.aktiv === id) z.aktiv = z.auftraege.length ? z.auftraege[0].id : null;
    speichern();
    return true;
  }
  const aktiverAuftrag = () => { const z = zustand(); return z ? z.auftraege.find(a => a.id === z.aktiv) || z.auftraege[0] || null : null; };

  // ── Bausteine der Anzeige ─────────────────────────────────────────────────
  function gesichtHtml(w, team, kl) {
    let svg = '';
    try { svg = window.DFLIdentitaet ? DFLIdentitaet.gesichtSvg(w, team ? { farben: farbenVon(team) } : null) : ''; } catch (e) { svg = ''; }
    return `<span class="sc-gesicht${kl ? ' ' + kl : ''}" aria-hidden="true">${svg}</span>`;
  }
  const wappenHtml = T => T ? `<span class="lg-crest sc-wappen" style="${typeof crestStyle === 'function' ? crestStyle(D.spielId(T.id)) : ''}" aria-hidden="true"></span>` : '';
  function herkunftHtml(e) {
    if (e.quelle === 'frei') return `Free Agent${e.team ? ' · zuletzt ' + esc(e.team.kurz || e.team.name) : ''}`;
    if (e.quelle === 'draft') { const m = e.w.medien || {}; return `Draft #${m.rang || '?'}${m.note ? ' · ' + esc(m.note) : ''}`; }
    return e.team ? `${wappenHtml(e.team)}${esc(e.team.kurz || e.team.name)}` : '';
  }
  function ringHtml(u) {
    const anteil = 1 - u.rest / Math.max(1, u.ges);
    return `<span class="sc-ring" title="Scout unterwegs, noch ${wochen(u.rest)}"><svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15" class="sc-ring-bahn"/>` +
      `<circle cx="18" cy="18" r="15" class="sc-ring-fuell" stroke-dasharray="${(94.2 * Math.max(0.04, anteil)).toFixed(1)} 94.2"/></svg><span>${wo(u.rest)}</span></span>`;
  }
  // Knopf für fremde Spieler (Trade-Zentrale, Free Agency, Wertliste): Bericht ansehen · Scouten · unterwegs
  function knopfHtml(p, opt) {
    if (!aktiv()) return '';
    opt = opt || {};
    const id = weltId(p), f = finde(id);
    if (!f || f.quelle === 'eigen' || istEigen(p, id)) return '';
    const u = unterwegs(id);
    if (bericht(id)) return `<button type="button" class="sc-knopf bericht" data-sc="blatt:${esc(id)}">${ico('report-search')}Bericht</button>`;
    if (u) return `<button type="button" class="sc-knopf unterwegs" data-sc="blatt:${esc(id)}" title="Scout unterwegs">${ico('hourglass')}${wo(u.rest)}</button>`;
    return `<button type="button" class="sc-knopf" data-sc="scout:${esc(id)}">${ico('eye')}Ansehen</button>`;
  }
  // Eine Zeile (Kandidaten, Berichte, D99-Listen). e: { id | w, quelle?, team?, chips?: html, sub?: html, status?: html | false }
  function zeileHtml(e) {
    if (!e) return '';
    const id = e.id || weltId(e.w), f = finde(id);
    const w = e.w || (f && f.w);
    if (!w) return '';
    const quelle = e.quelle || (f ? f.quelle : 'liga'), team = e.team !== undefined ? e.team : (f ? f.team : null);
    const x = { id, w, quelle, team, voraus: f && f.voraus };
    const s = sicht(w), b = s && s.bericht, u = unterwegs(id), sch = schutz(x);
    const stil = eigenerStil(), pa = b && quelle !== 'eigen' ? passung(w, stil) : null;
    const pot = s && (s.draft || s.bericht) ? (s.draft ? { lo: s.draft.pot[0], hi: s.draft.pot[1] } : s.pot) : null;
    const sterne = pot && window.DFLUiTeile && DFLUiTeile.sterne ? DFLUiTeile.sterne(pot) : '';
    const werte = `<span class="sc-werte">${staerkeHtml(w, 'kurz')}<span class="sc-pot">${pot ? (sterne || 'Pot. ' + spanneText(pot)) : 'Pot. <span class="sc-unbekannt">?</span>'}</span></span>`;
    let status = e.status;
    if (status == null) {
      status = b ? passHtml(pa, true) : u ? ringHtml(u)
        : sch && sch.stufe === 'gesperrt' ? `<span class="sc-schloss" title="nicht zu haben: ${esc(sch.grund)}">${ico('lock')}</span>`
          : `<button type="button" class="sc-mini" data-sc="scout:${esc(id)}" aria-label="${esc(voll(w))} scouten">Scouten</button>`;
    }
    const teuer = sch && sch.stufe === 'teuer' ? `<span class="sc-teuer" title="${esc(sch.grund)}">×${de(sch.faktor, 2).replace(/,?0+$/, '')}</span>` : '';
    const neu = ui.aufgedeckt.has(id) ? ' sc-neu' : '';
    // D112: Stil-Zeichen (Typ öffentlich, Prozente mit Bericht – dfl_ebenen_patch.js)
    const E = window.DFLEbenen && DFLEbenen.zeichenHtml ? window.DFLEbenen : null;
    return `<div class="sc-zeile${b ? ' fertig' : ''}${neu}" role="button" tabindex="0" data-sc="bericht:${esc(id)}" aria-label="${esc(voll(w))}${b ? ', Bericht fertig' : ''}">
      ${gesichtHtml(w, team)}
      <span class="sc-name"><span class="sc-z1"><b>${esc(voll(w))}</b>${E ? E.zeichenHtml(w) : ''}${teuer}</span><small>${posBadge(w.pos)} ${w.age} J. · ${e.sub != null ? e.sub : herkunftHtml(x)}</small>${e.chips ? `<span class="sc-chips">${e.chips}</span>` : ''}</span>
      ${werte}<span class="sc-status">${status || ''}</span></div>`;
  }
  // D112: Filter „passt zu meinem Stil“ je Liste (dfl_ebenen_patch.js); ohne das Modul alles
  const stilFilter = key => { const E = window.DFLEbenen; return E && E.filter && E.filter(key) ? (w => E.passtZuMir(w)) : null; };
  const stilChip = (key, ws) => { const E = window.DFLEbenen; return E && E.filterChipHtml ? E.filterChipHtml(key, ws.filter(w => E.passtZuMir(w)).length, { kl: 'sc-chip' }) : ''; };
  // D111: Erklärsätze hinter ⓘ (info_cards_patch.js)
  const info = (key, titel, text) => { if (typeof window.infoKarteSetzen !== 'function' || typeof window.infoBtn !== 'function') return ''; window.infoKarteSetzen(key, titel, text); return window.infoBtn(key); };

  // ── Reiter ────────────────────────────────────────────────────────────────
  function auftraegeHtml() {
    const z = zustand(), an = analyse(), stil = eigenerStil();
    const laufend = z.unterwegs.map(u => ({ u, f: finde(u.id) }));
    const scouts = Array.from({ length: Math.max(scoutsGesamt(), z.unterwegs.length) }, (_, i) => {
      const x = laufend[i];
      return x ? `<span class="sc-scout"><i>${i + 1}</i><b>${esc(x.f ? kurz(x.f.w) : '–')}</b>${wo(x.u.rest)}<button type="button" class="sc-x" data-sc="rueckruf:${esc(x.u.id)}" aria-label="Scout zurückrufen" title="Zurückrufen (der Bericht verfällt)">${ico('x')}</button></span>`
        : `<span class="sc-scout frei"><i>${i + 1}</i>frei</span>`;
    }).join('');
    const karten = z.auftraege.map(a => {
      const k = kandidaten(a), fertig = k.liste.filter(e => bericht(e.id)).length, weg = k.liste.filter(e => unterwegs(e.id)).length;
      const gr = (an.find(x => x.pos === a.pos) || { gruende: [] }).gruende.slice(0, 2).join(' · ');
      return `<section class="sc-karte${a.id === z.aktiv ? ' gewaehlt' : ''}">
        <h4>${posBadge(a.pos)} ${esc(POS_NAME[a.pos] || a.pos)}<span class="sc-tag blau">läuft</span></h4>
        <p>${stil ? 'für ' + esc(stilName(stil)) + ' · ' : ''}seit KW ${a.w}${gr ? ' · ' + esc(gr) : ''}</p>
        <p class="leise">Liga · Free Agents · Draft: ${k.liste.length} Kandidaten, ${fertig} Berichte fertig${weg ? `, ${weg} unterwegs` : ''}</p>
        <div class="sc-balken" role="img" aria-label="${fertig} von ${k.liste.length} gescoutet"><i style="width:${k.liste.length ? Math.round(fertig / k.liste.length * 100) : 0}%"></i></div>
        <div class="sc-knoepfe"><button type="button" class="app-knopf haupt" data-sc="kandidaten:${a.id}">${ico('list-search')}Kandidaten</button>
          <button type="button" class="app-knopf" data-sc="auftrag-ende:${a.id}">${ico('x')}Beenden</button></div></section>`;
    }).join('');
    const offen = an.filter(x => !z.auftraege.some(a => a.pos === x.pos)).slice(0, 3);
    const vorschlaege = offen.map(x => `<section class="sc-karte leise-karte">
        <h4>${posBadge(x.pos)} ${esc(x.art)}<span class="sc-tag">Bedarf ${de(x.bedarf, 1)}</span></h4><p>${esc(x.gruende.slice(0, 2).join(' · ') || 'laut Kaderanalyse')}</p>
        <button type="button" class="app-knopf" data-sc="auftrag:${esc(x.pos)}">${ico('player-play')}Auftrag starten</button></section>`).join('');
    const regeln = `Stufe ${stufeScouting()} → ${scoutsGesamt()} gleichzeitig. Bericht: Liga ${wochen(CFG.dauer.liga)} · Free Agent ${wochen(CFG.dauer.frei)} · Draft ${wochen(CFG.dauer.draft)}. Ein Bericht gilt eine Saison.`;
    const ib = info('sc-scouts', 'Deine Scouts', esc(regeln));
    return `<section class="sc-karte"><h4>${ico('users')}Deine Scouts${ib}<span class="sc-tag">${freieScouts()}/${scoutsGesamt()} frei</span></h4>
        <div class="sc-scouts">${scouts}</div>
        ${ib ? '' : `<p class="leise">${regeln}</p>`}</section>
      ${karten}
      ${vorschlaege ? `<div class="sc-ueber">Vorschläge aus deiner Kaderanalyse</div>${vorschlaege}` : ''}
      <button type="button" class="app-knopf sc-neu-auftrag" data-sc="auftrag-neu"${z.auftraege.length >= CFG.auftraegeMax ? ' disabled' : ''}>${ico('plus')}Neuer Auftrag</button>`;
  }
  function kandidatenHtml() {
    const z = zustand(), a = aktiverAuftrag();
    if (!a) return `<div class="sc-leer">${ico('user-search')}<span>Noch kein Auftrag. Unter „Aufträge“ eine Position wählen – oder einzelne Spieler direkt aus Trade-Zentrale und Free Agency scouten.</span></div>`;
    const k = kandidaten(a), stil = eigenerStil();
    const wahl = z.auftraege.length > 1 ? `<div class="sc-chips-reihe" role="group" aria-label="Auftrag">${z.auftraege.map(x =>
      `<button type="button" class="sc-chip" data-sc="kandidaten:${x.id}" aria-pressed="${x.id === a.id}">${esc(posName(x.pos))}</button>`).join('')}</div>` : '';
    const zahl = q => k.liste.filter(e => e.quelle === q).length;
    const filter = [['alle', 'Alle', k.liste.length], ['liga', 'Liga', zahl('liga')], ['frei', 'Free Agents', zahl('frei')], ['draft', 'Draft', zahl('draft')]];
    if (!filter.some(f => f[0] === ui.filter)) ui.filter = 'alle';
    // Reihenfolge: Berichte, unterwegs, zu haben (nach der Nase des Scouts), gesperrte zuletzt
    const zu = e => { const s = schutz(e); return s && s.stufe === 'gesperrt' ? 1 : 0; };
    const sf = stilFilter('kandidaten');
    const liste = k.liste.filter(e => (ui.filter === 'alle' || e.quelle === ui.filter) && (!sf || sf(e.w)))
      .sort((x, y) => (!!bericht(y.id) - !!bericht(x.id)) || (!!unterwegs(y.id) - !!unterwegs(x.id)) || (zu(x) - zu(y)) || (y.nase - x.nase));
    const st = stufe(k.min);
    const gefunden = `Gefunden: Liga ${k.gefunden.liga} · Free Agents ${k.gefunden.frei} · Draft ${k.gefunden.draft}. Gezeigt: ${k.liste.length} (ab ${st.name}, bis ${CFG.kandidaten.maxAlter} J., Talente bis ${CFG.kandidaten.talentAlter}, Draft: Top ${CFG.kandidaten.draft}).`;
    const ib = info('sc-kandidaten', 'Kandidaten', esc(gefunden) + ' Gesucht wird nach öffentlichen Angaben (Stufe, Alter, Medienliste), sortiert nach der Sicht deiner Scouts.');
    return `<div class="sc-kopf2">${wahl}<div class="sc-z1">${posBadge(a.pos)} <b>${esc(POS_NAME[a.pos] || a.pos)}</b>${stil ? `<span class="leise"> für ${esc(stilName(stil))}</span>` : ''}${ib}</div>
        ${ib ? '' : `<small class="leise">${gefunden}</small>`}
        <div class="sc-chips-reihe" role="group" aria-label="Quelle">${filter.map(([f, t, n]) => `<button type="button" class="sc-chip" data-sc="filter:${f}" aria-pressed="${ui.filter === f}">${t} <b>${n}</b></button>`).join('')}${stilChip('kandidaten', k.liste.map(e => e.w))}</div></div>
      <div class="sc-liste">${liste.map(e => zeileHtml(e)).join('') || `<div class="sc-leer klein">${sf ? 'Niemand passt klar zu deinem Stil.' : 'Niemand in dieser Liste.'}</div>`}</div>`;
  }
  // D99 und andere: weitere Listen im Reiter „Bericht“
  const LISTEN = [];
  function listeAnmelden(def) {
    if (!def || !def.key || typeof def.zeilen !== 'function') return false;
    const i = LISTEN.findIndex(x => x.key === def.key);
    if (i >= 0) LISTEN.splice(i, 1, def); else LISTEN.push(def);
    return true;
  }
  function berichteUebersichtHtml() {
    const z = zustand();
    const ids = Object.keys(z.berichte).filter(id => bericht(id) && finde(id) && !istEigen(null, id))
      .sort((a, b) => z.berichte[b].a - z.berichte[a].a);
    // D112: ein Filter „passt zu meinem Stil“ für alle Listen im Bericht (Berichte, D99: wollen weg, werden abgegeben)
    const sf = stilFilter('bericht'), alle = new Set();
    const wVon = e => e.w || (finde(e.id || weltId(e)) || {}).w || null;
    const filtern = zs => zs.filter(e => { const w = wVon(e); if (w) alle.add(w); return !sf || (w && sf(w)); });
    const leerStil = '<div class="sc-leer klein">Niemand passt klar zu deinem Stil.</div>';
    const listen = LISTEN.map(def => {
      let zeilen = [];
      try { zeilen = def.zeilen() || []; } catch (e) { console.warn('[DFL-Scouting] Liste ' + def.key, e); }
      const roh = zeilen.length;
      zeilen = filtern(zeilen);
      return `<div class="sc-ueber">${def.icon ? ico(def.icon) : ''}${esc(def.titel || def.key)}${def.sub ? ` <small>${esc(def.sub)}</small>` : ''}</div>
        <div class="sc-liste">${zeilen.map(zeileHtml).join('') || (sf && roh ? leerStil : `<div class="sc-leer klein">${esc(def.leer || 'Niemand in dieser Liste.')}</div>`)}</div>`;
    }).join('');
    const fertig = filtern(ids.map(id => ({ id })));
    // Nutzer 2026-10-22: überflüssiger Text raus: am PC (body.pcu-an) nur „Noch keine Berichte.“, am Handy unverändert
    const keineBerichte = document.body.classList.contains('pcu-an') ? 'Noch keine Berichte.' : 'Noch keine Berichte. Starte einen Auftrag oder tippe bei einem Spieler auf „Scouten“.';
    return `<div class="sc-ueber">${ico('report-search')}Fertige Berichte <small>${ids.length} · gelten eine Saison</small></div>
      <div class="sc-chips-reihe">${stilChip('bericht', [...alle])}</div>
      <div class="sc-liste">${fertig.map(e => zeileHtml(e)).join('') || (sf && ids.length ? leerStil : `<div class="sc-leer klein">${keineBerichte}</div>`)}</div>
      ${listen}`;
  }
  function berichtTabHtml() {
    if (ui.wahl && finde(ui.wahl)) return `<button type="button" class="sc-zurueck" data-sc="zurueck">${ico('chevron-left')}Alle Berichte</button>` + berichtHtml(ui.wahl);
    return berichteUebersichtHtml();
  }

  // ── Der Bericht (Reiter „Bericht“ und Blatt für fremde Spieler) ───────────
  // D111 (Nutzer zu Frage 3: „ein Blatt wie bei eigenen Spielern … cool für Nerds bzw. FM-Spieler“): Karte wie im Spieler-Blatt
  // (ohne Bericht die Stufe und „?“ statt der Werte), Radar und Stil-Balken nur mit Bericht, ohne Bericht Stufe, Typ (D112) und
  // „?“; Entwicklungs-Pfeil mit Bericht; Talente: College, Text der Medien, Note, Mock-Draft (Talent-Blatt im Draft-Jahrgang).
  // Detailwerte (Radar, Rechnung) zwischengespeichert wie detailwerte
  function werteVon(w) {
    if (typeof spielerWerte !== 'function') return {};
    const k = w.id + '|' + w.ovr + '|' + w.age + '|' + (w.koerper || 0);
    let werte = detailCache.get(k);
    if (!werte) {
      try { werte = spielerWerte(D.zuSpielSpieler(w)) || {}; } catch (e) { werte = {}; }
      if (detailCache.size > 400) detailCache.clear();
      detailCache.set(k, werte);
    }
    return werte;
  }
  function futHtml(w, f, s, b) {
    const A = window.DFLAppShell;
    if (!A || !A.futKarte || !A.achsen || s.draft) return { karte: '', radar: '' };
    const p = Object.assign({}, w, { pos: posName(w.pos) });
    const ax = b ? A.achsen(p, werteVon(w)) : A.achsen(p, {}).map(([k]) => [k, '?']);
    let svg = '';
    try { svg = window.DFLIdentitaet ? DFLIdentitaet.gesichtSvg(w, f.team ? { farben: farbenVon(f.team) } : null) : ''; } catch (e) { svg = ''; }
    const karte = b ? A.futKarte(p, s.ovr, ax, svg, null)
      : A.futKarte(p, s.stufe.kurz, ax, svg, null, { stufe: A.futStufe(s.stufe.ab), wertKl: 'fut-stufe' });
    return { karte: `<div class="fut-buehne">${karte}</div>`, radar: b && A.radar ? A.radar(ax) : '' };
  }
  function berichtHtml(id) {
    const f = finde(id); if (!f) return '<div class="sc-leer">Spieler nicht mehr in der Liga.</div>';
    const w = f.w, s = sicht(w), b = s.bericht, B = bericht(String(w.id)), u = unterwegs(String(w.id));
    const stil = eigenerStil(), x = { id: String(w.id), w, quelle: f.quelle, team: f.team, voraus: f.voraus };
    const sch = schutz(x), E = window.DFLEbenen && DFLEbenen.stilBlockHtml ? window.DFLEbenen : null;
    const status = b && B ? `Bericht KW ${B.w}${B.s !== LEAGUE.season ? ' (Vorsaison)' : ''} · Scouting Stufe ${B.st}`
      : u ? `Scout unterwegs · Bericht in ${wochen(u.rest)}` : 'Kein Bericht – öffentlich sind nur Stufe und Typ';
    const fut = futHtml(w, f, s, b);
    const kopf = fut.karte
      ? `<div class="fut-kopf sc-fut-kopf"><div class="app-blatt-name">${esc(voll(w))}</div>
          <div class="sc-meta">${posBadge(w.pos)}<span>${esc(posText(w))}</span><span>${w.age} Jahre</span><span>${herkunftHtml(x)}</span></div>
          <div class="sc-meta leise">${status}</div></div>`
      : `<div class="sc-bericht-kopf">${gesichtHtml(w, f.team, 'gross')}<div>
          <h4>${esc(voll(w))}</h4>
          <div class="sc-meta">${posBadge(w.pos)}<span>${esc(posText(w))}</span><span>${w.age} Jahre</span><span>${herkunftHtml(x)}</span></div>
          <div class="sc-meta leise">${status}</div></div></div>`;
    const kachel = (t, wert, unter) => `<div class="sc-kachel"><small>${t}</small><b>${wert}</b><span>${unter || ''}</span></div>`;
    let werte;
    if (s.draft) {
      const bo = s.draft.board || (window.DFLKader && DFLKader.schaetzung ? DFLKader.schaetzung(w, f.voraus || 0) : null);
      werte = kachel('Stärke', `${s.draft.ovr[0]}–${s.draft.ovr[1]}`, b ? `Board ${bo ? bo.ovr[0] + '–' + bo.ovr[1] : '?'}` : 'Draft-Board') +
        kachel('Potenzial', `${s.draft.pot[0]}–${s.draft.pot[1]}`, (window.DFLUiTeile ? DFLUiTeile.sterne({ lo: s.draft.pot[0], hi: s.draft.pot[1] }) : '') + (b && bo ? ` Board ${bo.pot[0]}–${bo.pot[1]}` : ''));
    } else {
      werte = kachel('Stärke', b ? s.ovr : staerkeHtml(w, 'lang'), b ? 'genau' : 'nur die Stufe') +
        kachel('Potenzial', b ? spanneText(s.pot) : '<span class="sc-unbekannt">?</span>', b && window.DFLUiTeile ? DFLUiTeile.sterne(s.pot) : 'erst mit Bericht');
    }
    const pa = b ? passung(w, stil) : null;
    // D112: ohne Bericht der Typ (öffentlich), mit Bericht die Passung zu deinem Stil in Prozent
    const z = E ? E.zeichenDaten(w) : null;
    werte += !b
      ? kachel('Passung', z ? `<span class="sc-typ">${E.zeichenHtml(w)}${esc(E.stilDef(z.stil).kurz)}</span>` : '<span class="sc-unbekannt">?</span>',
        z ? (z.typ ? esc(z.typ) + (z.ok ? ' · passt zu dir' : '') : z.ok ? 'passt zu dir' : 'Typ') + ' · genau mit Bericht' : 'erst mit Bericht')   // D156: Torwart-Typ darunter
      : kachel('Passung', pa && pa.relevant ? pa.pct + ' %' : '–', !pa ? 'kein Stil gewählt' : !pa.relevant ? 'zählt hier nicht'
        : `${pa.typ ? `<span class="sc-twtyp">${esc(pa.typ)}</span>` : ''}<span class="sc-passung ${pa.klasse}"><i></i>${pa.text}</span>`);
    const knopf = !b ? (u ? `<button type="button" class="app-knopf" data-sc="rueckruf:${esc(String(w.id))}">${ico('x')}Scout zurückrufen</button>`
      : sch && sch.stufe === 'gesperrt' ? `<p class="leise">${ico('lock')} Nicht zu haben (${esc(sch.grund)}) – kein Scout fährt hin.</p>`
        : freieScouts() ? `<button type="button" class="app-knopf haupt" data-sc="scout:${esc(String(w.id))}">${ico('telescope')}Scouten · Bericht in ${wochen(dauerVon(f.quelle))}</button>`
          : `<button type="button" class="app-knopf" data-sc="scout:${esc(String(w.id))}">${ico('hourglass')}Alle ${scoutsGesamt()} Scouts unterwegs</button>`) : '';
    let stilKarte = '', platz = '', entw = '';
    if (b) {
      const max = 8;
      // Draft-Talente: keine Detailwerte (sie verrieten die genaue Stärke, der Bericht schätzt ±2 – wie in der Vorschau)
      const det = s.draft ? [] : detailwerte(w, stil);
      const wirk = pa && pa.relevant ? stilWirkung(w, stil) : null;
      const wirkText = wirk ? (wirk.inElf && Math.abs(wirk.mit - wirk.vor) >= 0.05
        ? `<p>Mit ihm in der Elf: Stil-Passung deines Teams ${de(wirk.vor, 1)} % → <b>${de(wirk.mit, 1)} %</b> (zählt in jedem Spiel, D55).</p>`
        : `<p class="leise">An der Stil-Passung deiner Elf ändert er nichts${wirk.inElf ? '' : ' – er käme nicht in die Startelf'}.</p>`) : '';
      const detHtml = det.length ? `<p>Detailwerte für den Stil:</p><div class="sc-details">${det.map(([k, v]) => `<span class="sc-detail">${esc(DETAIL_NAME[k] || k)} <b>${v}</b></span>`).join('')}</div>` : '';
      if (E) stilKarte = E.stilBlockHtml(w, { genau: true, extra: detHtml + wirkText });
      else {
        const teile = pa && pa.relevant ? pa.teile.map(([k, v, d]) => `<div class="sc-teil"><span>${TEIL_NAME[k]} ${v}</span><span class="sc-spur"><i class="${d >= 0 ? 'plus' : 'minus'}" style="${d >= 0 ? 'left' : 'right'}:50%;width:${Math.min(50, Math.abs(d) / max * 50).toFixed(0)}%"></i></span><b class="${d > 0 ? 'plus' : d < 0 ? 'minus' : ''}">${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d)}</b></div>`).join('') : '';
        stilKarte = `<section class="sc-karte leise-karte"><h4>${ico('target-arrow')}Stil: ${esc(stilName(stil))}</h4>
          ${pa && pa.relevant ? `<p>Gegenüber anderen ${esc(posName(pa.pos))} gleicher Stärke (Formel der KI):</p>${teile}` : `<p class="leise">Auf ${esc(posName(w.pos))} zählt der Stil in der Spielformel nicht.</p>`}
          ${detHtml}${wirkText}</section>`;
      }
      // D111: Entwicklung als Pfeil (Regeln der Welt, sichtbares Potenzial aus dem Bericht)
      const pf = !s.draft && E && E.pfeilTeile ? E.pfeilTeile(w, { team: f.team, pot: s.pot }) : null;
      if (pf) entw = `<section class="eb-karte eb-entw" data-eb-box><div class="eb-kopf"><b>${ico('compass')}Entwicklung</b></div>
          <div class="bk-satz">${pf.html}<button class="eb-tiefer klein" type="button" data-eb-auf="entw" aria-expanded="false">Wie gerechnet? ${ico('chevron-down')}</button></div>
          <div class="eb-ebene3" data-eb-ziel="entw" hidden>${pf.rechnung}</div></section>`;
      const o = s.draft ? Math.round((s.draft.ovr[0] + s.draft.ovr[1]) / 2) : s.ovr;
      const pl = platzInElf(w, o);
      if (pl) platz = `<section class="sc-karte leise-karte"><h4>${ico('layout-board')}Platz in deiner Elf</h4><p>${pl.text}</p></section>`;
    }
    let eig = '';
    try { eig = typeof traitChips === 'function' ? traitChips(w) : ''; } catch (e) { eig = ''; }
    const eigKarte = `<section class="sc-karte leise-karte"><h4>${ico('sparkles')}Eigenschaften</h4><div class="sc-eig">${eig || '<span class="leise">keine bekannten Eigenschaften</span>'}</div>
      <p class="leise klein">${b ? 'Bekannte und vom Scout erkannte – verdeckte zeigen sich erst im Verein.' : 'Nur die bekannten – den Rest sieht erst dein Scout.'}</p></section>`;
    // Talent-Blatt (Draft): Medien-Rang, Note, Mock-Draft, College und der Text der Medien
    let talent = '';
    if (f.quelle === 'draft') {
      const m = w.medien || {}, pr = m.prognose || {}, T = pr.teamId ? teamVon(pr.teamId) : null;
      const trend = m.vorher && m.vorher !== m.rang ? (m.vorher > m.rang ? ` <span class="dfl-auf">▲${m.vorher - m.rang}</span>` : ` <span class="dfl-ab">▼${m.rang - m.vorher}</span>`) : '';
      talent = `<section class="sc-karte"><h4>${ico('school')}Talent · Draft ${esc(f.jahrgang || '')}</h4>
        <div class="sc-talent"><span><small>Rang</small><b>#${m.rang || '?'}${trend}</b></span><span><small>Note</small><b>${esc(m.note || '–')}</b></span>
          <span><small>Mock-Draft</small><b>${pr.pick ? '#' + pr.pick + (T ? ' ' + esc(T.kurz || T.name) : '') : '–'}</b></span></div>
        <p>${esc(w.college || '')}${w.wiederangemeldet ? ' · wieder angemeldet' : ''}</p>${(() => { const tx = window.DFLGenerator && DFLGenerator.medienText ? DFLGenerator.medienText(w) : m.text; return tx ? `<p class="leise">„${esc(tx)}“</p>` : ''; })()}</section>`;
    }
    // Vertrag und Verfügbarkeit (öffentlich) + Knöpfe Tauschen / Angebot / Draft
    let vertrag = '', aktion = '';
    if (f.quelle === 'liga') {
      const c = w.contract, rest = c ? c.years_remaining : 0;
      const verf = sch && sch.stufe === 'gesperrt' ? `nicht zu haben (${esc(sch.grund)})` : sch && sch.stufe === 'teuer' ? `teuer (×${de(sch.faktor, 2).replace(/,?0+$/, '')}, ${esc(sch.grund)})` : 'normal zu haben';
      vertrag = `${c ? `Cap Hit ${mio(G.capHitSpieler(w))} · noch ${rest} ${rest === 1 ? 'Jahr' : 'Jahre'} · ` : ''}${verf}`;
      if (!(sch && sch.stufe === 'gesperrt') && window.DFLTrade) aktion = `<button type="button" class="app-knopf haupt" data-sc="trade:${esc(String(w.id))}">${ico('arrows-exchange')}Tauschen</button>`;
    } else if (f.quelle === 'frei') {
      const fa = (CLUB.freeAgents || []).find(q => q.id === 'fa_' + w.id);
      vertrag = `vereinslos${w._exVerein && teamVon(w._exVerein) ? ', zuletzt ' + esc(teamVon(w._exVerein).name) : ''}${fa ? ` · fordert etwa ${mio((fa.faWageDemand || fa.wage || 0) * 52)} pro Jahr` : ''}`;
      if (fa && typeof signFreeAgent === 'function') aktion = `<button type="button" class="app-knopf haupt" data-sc="fa:${esc(String(w.id))}">${ico('signature')}Angebot machen</button>`;
      else vertrag += ' · steht nicht in deiner Free-Agent-Liste';
    } else if (f.quelle === 'draft') {
      vertrag = 'Rookie-Vertrag nach dem Pick (Skala nach Pick-Nummer)';
      aktion = `<button type="button" class="app-knopf" data-sc="draft">${ico('school')}Zu den Draft-Jahrgängen</button>`;
    }
    const vertragKarte = `<section class="sc-karte leise-karte"><h4>${ico('file-certificate')}Vertrag und Verfügbarkeit</h4><p>${vertrag}</p>${aktion ? `<div class="sc-knoepfe">${aktion}</div>` : ''}</section>`;
    return `<div class="sc-bericht" data-id="${esc(String(w.id))}"><section class="sc-karte">${kopf}${fut.karte}${fut.radar}<div class="sc-kacheln">${werte}</div>${knopf ? `<div class="sc-knoepfe">${knopf}</div>` : ''}</section>
      ${talent}${stilKarte}${entw}${platz}${eigKarte}${vertragKarte}</div>`;
  }

  // ── Block im Scouting (über den Draft-Jahrgängen) ─────────────────────────
  // ── D120: eine Liste mit Chefscout, Segment Draft · Liga · Free Agents, Positions- und Filter-Chips ──────
  const CS = () => window.DFLChefscout || null;
  function draftJahrgang() { const L = D.liga(); return (L.draft && L.draft.talente && L.draft.talente.length ? L.draft : L.draftNaechste) || null; }
  // Einträge eines Segments (ohne Filter), je { id, w, quelle, team, voraus, zh }
  function segmentEintraege(seg) {
    const L = D.liga(), eig = D.eigeneDflId(), zh = zuHabenIds(), z = zustand();
    const posOk = new Set(z.fokus.length ? [].concat(...z.fokus.map(positionenVon)) : []);
    const passt = p => !posOk.size || posOk.has(G.dflPos(p.pos));
    if (seg === 'draft') {
      const j = draftJahrgang(); if (!j) return [];
      const voraus = j === L.draftNaechste ? 1 : 0;
      return j.talente.filter(passt).sort((a, b) => ((a.medien && a.medien.rang) || 999) - ((b.medien && b.medien.rang) || 999))
        .map(p => ({ id: String(p.id), w: p, quelle: 'draft', team: null, voraus }));
    }
    if (seg === 'frei') {
      return (L.freie || []).filter(p => passt(p) && !istEigen(p)).map(p => ({ id: String(p.id), w: p, quelle: 'frei', team: p._exVerein ? teamVon(p._exVerein) : null }))
        .map(e => Object.assign(e, { nase: nase(e) })).sort((a, b) => (!!bericht(b.id) - !!bericht(a.id)) || b.nase - a.nase);
    }
    const elf = (D.eigeneStaerke && D.eigeneStaerke().ovr) || 75, min = stufeBoden(elf - CFG.kandidaten.abstand);
    const aus = [];
    L.teams.forEach(t => {
      if (t.id === eig) return;
      t.roster.forEach(p => {
        if (!passt(p)) return;
        const id = String(p.id), x = zh.get(id);
        if (!x && !bericht(id) && stufeBoden(p.ovr) < min && !(p.age <= CFG.kandidaten.talentAlter && stufeBoden(p.ovr) >= min - CFG.kandidaten.talentLuecke)) return;
        aus.push({ id, w: p, quelle: 'liga', team: t, zh: x || null });
      });
    });
    aus.forEach(e => { e.nase = nase(e); });
    return aus.sort((a, b) => (!!bericht(b.id) - !!bericht(a.id)) || (!!b.zh - !!a.zh) || b.nase - a.nase);
  }
  const noteVon = e => (bericht(e.id) && CS() ? CS().note(e.w) : null);
  function herkunft2(e) {
    if (e.quelle === 'draft') {
      const m = e.w.medien || {}, sp = m.prognose && m.prognose.spanne;
      return `${e.w.age} J.${sp ? ` · Pick ${sp[0]}–${sp[1]}` : m.rang ? ` · Medien #${m.rang}` : ''}`;
    }
    if (e.quelle === 'frei') return `${e.w.age} J. · Free Agent`;
    const z = e.zh, T = e.team;
    const grund = z ? (z.art === 'weg' ? ' · will weg' : ' · wird abgegeben') : '';
    return `${e.w.age} J. · ${T ? esc(T.kurz || T.name) : ''}${grund}`;
  }
  function listenZeile(e) {
    const w = e.w, b = !!bericht(e.id), u = unterwegs(e.id), n = noteVon(e), offen = ui.offen === e.id;
    const steal = n && n.steal ? `<span class="cs-steal"><i class="ti ti-diamond" aria-hidden="true"></i>Steal</span>` : '';
    const notenHtml = CS() ? CS().notenHtml(n) : '';
    const E = window.DFLEbenen && DFLEbenen.zeichenHtml ? window.DFLEbenen : null;
    let mehr = '';
    if (offen) {
      const p = CS() && CS().person();
      const satz = b && CS() ? CS().satz(w) : u ? 'Den sehe ich mir diese Woche an.' : 'Den habe ich mir noch nicht angesehen.';
      const knoepfe = [];
      knoepfe.push(`<button type="button" class="app-knopf" data-sc="blatt:${esc(e.id)}">${ico('report-search')}${b ? 'Bericht' : 'Profil'}</button>`);
      if (!b && !u) knoepfe.push(`<button type="button" class="app-knopf haupt" data-sc="scout:${esc(e.id)}">${ico('eye')}Ansehen</button>`);
      if (e.quelle === 'liga' && e.team) knoepfe.push(`<button type="button" class="app-knopf" data-sc="trade:${esc(e.id)}">${ico('arrows-left-right')}Tausch</button>`);
      if (e.quelle === 'frei') knoepfe.push(`<button type="button" class="app-knopf" data-sc="fa:${esc(e.id)}">${ico('signature')}Vertrag</button>`);
      mehr = `<div class="cs-satz">${p ? `<b>${esc(p.name)}:</b>` : ''}„${esc(satz)}“</div><div class="sc-knoepfe">${knoepfe.join('')}</div>`;
    }
    return `<div class="sc-eintrag${offen ? ' offen' : ''}"><div class="sc-zeile${b ? ' fertig' : ''}${ui.aufgedeckt.has(e.id) ? ' sc-neu' : ''}" role="button" tabindex="0" data-sc="offen:${esc(e.id)}" aria-expanded="${offen}" aria-label="${esc(voll(w))}">
      ${gesichtHtml(w, e.team)}
      <span class="sc-name"><span class="sc-z1"><b>${esc(voll(w))}</b>${E ? E.zeichenHtml(w) : ''}</span><small>${posBadge(w.pos)} ${herkunft2(e)}</small>${steal ? `<span class="sc-chips">${steal}</span>` : ''}</span>
      <span class="sc-werte">${staerkeHtml(w, 'kurz')}</span><span class="sc-status">${u && !b ? ringHtml(u) : notenHtml}</span></div>${mehr}</div>`;
  }
  function blockHtml() {
    const z = zustand();
    if (!z.startFertig) { z.startFertig = true; try { autoBerichte(scoutsGesamt() * CFG.startWochen); } catch (e) { console.warn('[DFL-Scouting] Start', e); } }
    const seg = z.seg || 'draft', zh = zuHabenIds();
    const alle = segmentEintraege(seg);
    const steals = alle.filter(e => { const n = noteVon(e); return n && n.steal; });
    const filter = [['steal', 'Steals', steals.length, 'diamond']];
    if (seg === 'liga') {
      filter.push(['weg', 'Wechselwillig', alle.filter(e => e.zh && e.zh.art === 'weg').length, 'door-exit']);
      filter.push(['ab', 'Werden abgegeben', alle.filter(e => e.zh && e.zh.art !== 'weg').length, 'tag']);
    }
    if (!filter.some(f => f[0] === z.filter)) z.filter = null;
    const sf = stilFilter('kandidaten');
    let liste = alle.filter(e => (!z.filter || (z.filter === 'steal' ? steals.indexOf(e) >= 0 : z.filter === 'weg' ? e.zh && e.zh.art === 'weg' : e.zh && e.zh.art !== 'weg')) && (!sf || sf(e.w)));
    const gesamt = liste.length;
    liste = liste.slice(0, CFG.liste);
    const fokusText = z.fokus;
    const segs = [['draft', 'Draft'], ['liga', 'Liga'], ['frei', 'Free Agents']];
    const pick = seg === 'draft' && CS() ? CS().eigenerPick() : null;
    const j = seg === 'draft' ? draftJahrgang() : null;
    return `${CS() ? CS().kopfHtml(fokusText) : ''}
      <div class="sc-seg" role="tablist" aria-label="Liste">${segs.map(([k, t]) => `<button type="button" role="tab" aria-selected="${seg === k}" class="${seg === k ? 'an' : ''}" data-sc="seg:${k}">${t}</button>`).join('')}</div>
      <div class="sc-chips-reihe sc-pos" role="group" aria-label="Positionen">
        <button type="button" class="sc-chip" data-sc="pos:alle" aria-pressed="${!z.fokus.length}">Alle</button>
        ${GRUPPEN.map(([g]) => `<button type="button" class="sc-chip" data-sc="pos:${g}" aria-pressed="${z.fokus.indexOf(g) >= 0}">${g}</button>`).join('')}</div>
      <div class="sc-chips-reihe" role="group" aria-label="Filter">${filter.map(([k, t, n, ic]) => `<button type="button" class="sc-chip${k === 'steal' ? ' sc-chip-steal' : ''}" data-sc="filt:${k}" aria-pressed="${z.filter === k}">${ico(ic)}${t} <b>${n}</b></button>`).join('')}${stilChip('kandidaten', alle.map(e => e.w))}</div>
      ${pick ? `<div class="sc-pick">${ico('ticket')}Dein Pick: <b>${pick}</b>${j ? ` · Draft ${j.jahr}` : ''}</div>` : ''}
      <div class="sc-liste">${liste.map(listenZeile).join('') || `<div class="sc-leer klein">${sf ? 'Niemand passt klar zu deinem Stil.' : 'Niemand in dieser Liste.'}</div>`}</div>
      ${gesamt > liste.length ? `<div class="sc-fuss">${liste.length} von ${gesamt}</div>` : ''}
      <div class="sc-fuss">KW ${LEAGUE.week} · ${scoutsGesamt()} Spieler je Woche</div>`;
  }
  // Nur zeichnen, wenn die Scouting-Ansicht offen ist (renderScoutTab läuft jede Woche, auch im Hintergrund)
  function zeichne() {
    if (!aktiv() || typeof document === 'undefined') return;
    foKachel();
    const view = document.getElementById('view-scout');
    if (!view || !view.classList.contains('active')) return;
    let box = document.getElementById('dfl-scouting');
    if (!box) {
      box = document.createElement('section');
      box.id = 'dfl-scouting'; box.className = 'sc';
      const banner = document.getElementById('scout-banner');
      if (banner) banner.insertAdjacentElement('afterend', box); else (view.querySelector('.lg-wrap') || view).prepend(box);
    }
    // Neue Berichte leuchten einmal auf und zählen danach als gesehen
    const z = zustand();
    const gesehen = true;
    ui.aufgedeckt = new Set(z.neu);
    try { box.innerHTML = blockHtml(); } catch (e) { console.warn('[DFL-Scouting] Anzeige', e); box.innerHTML = ''; }
    if (gesehen && z.neu.length) { z.neu = []; foKachel(); }
  }

  // ── Blatt für fremde Spieler (Handy: #app-blatt, PC: Fenster) ─────────────
  const shell = () => typeof document !== 'undefined' && document.body && document.body.classList.contains('dfl-shell');
  let blattId = null;
  function blatt(id) {
    if (!aktiv() || typeof document === 'undefined') return;
    id = weltId(id);
    const f = finde(id);
    if (!f) return;
    if (f.quelle === 'eigen' || istEigen(f.w, id)) {
      const q = SQUAD.find(x => x.dflId === id || x.id === id);
      if (q && window.DFLAppShell && shell()) DFLAppShell.spielerBlatt(q, null);
      else if (q && typeof showSquadPlayerCard === 'function') showSquadPlayerCard(q.id);
      return;
    }
    blattId = id;
    const titel = bericht(id) ? 'Scout-Bericht' : unterwegs(id) ? 'Scout unterwegs' : f.quelle === 'draft' ? 'Talent' : 'Fremder Spieler';
    const html = `<div class="app-sheet-titel sc-blatt-titel">${titel}</div><div class="sc-blatt">${berichtHtml(id)}</div>`;
    if (shell()) {
      const box = document.querySelector('#app-blatt .app-blatt-box'); if (!box) return;
      delete box.dataset.spieler;
      box.onclick = null;
      box.innerHTML = '<div class="app-griff"></div><button class="app-blatt-zu" aria-label="Schließen"><i class="ti ti-x" aria-hidden="true"></i></button>' + html;
      document.getElementById('app-blatt').classList.add('auf'); document.body.classList.add('app-gesperrt');
      if (window.DFLAppShell) try { DFLAppShell.cta(); } catch (e) { /* optional */ }
      return;
    }
    let ov = document.getElementById('sc-ov');
    if (!ov) {
      ov = document.createElement('div');
      ov.className = 'exp-overlay'; ov.id = 'sc-ov';
      ov.addEventListener('click', ev => { if (ev.target === ov || ev.target.closest('.sc-ov-zu')) blattZu(); });
      document.body.appendChild(ov);
    }
    ov.innerHTML = `<div class="exp-dialog sc-dialog" role="dialog" aria-modal="true"><button type="button" class="app-blatt-zu sc-ov-zu" aria-label="Schließen">${ico('x')}</button>${html}</div>`;
  }
  function blattOffen() {
    if (typeof document === 'undefined') return false;
    const ov = document.getElementById('sc-ov');
    if (ov) return true;
    const b = document.getElementById('app-blatt');
    return !!(b && b.classList.contains('auf') && b.querySelector('.sc-blatt'));
  }
  function blattZu() {
    blattId = null;
    const ov = document.getElementById('sc-ov'); if (ov) ov.remove();
    const b = document.getElementById('app-blatt');
    if (b && b.classList.contains('auf') && b.querySelector('.sc-blatt')) {
      b.classList.remove('auf'); document.body.classList.remove('app-gesperrt');
      if (window.DFLAppShell) try { DFLAppShell.cta(); } catch (e) { /* optional */ }
    }
  }
  function blattNeu() { if (blattId && blattOffen()) blatt(blattId); }

  // ── Trade-Zentrale: Leiste unter dem Tausch (für jeden eingehenden fremden Spieler) ──
  function tauschLeiste(B, ids) {
    if (!aktiv() || !ids || !ids.length) return '';
    const zeilen = ids.map(id => {
      const f = finde(id); if (!f || istEigen(f.w, String(id))) return '';
      const b = bericht(String(id)), pa = b ? passung(f.w, eigenerStil()) : null;
      const n = b && window.DFLChefscout ? DFLChefscout.notenHtml(DFLChefscout.note(f.w)) : '';
      return `<div class="sc-tausch-zeile"><span class="sc-tausch-name"><b>${esc(kurz(f.w))}</b> ${b ? n + (pa && pa.relevant ? passHtml(pa, true) : '') : '<span class="leise">noch nicht angesehen</span>'}</span>${knopfHtml(f.w)}</div>`;
    }).join('');
    return zeilen ? `<div class="sc-tausch" aria-label="Scout-Berichte zum Tausch">${zeilen}</div>` : '';
  }
  // Texte „Name (POS, 82, 27 J.)“ aus Angeboten der KI (DFLHandel): ohne Bericht die Stufe statt der Zahl
  function teilText(text, team, id) {
    if (!aktiv() || typeof text !== 'string') return text;
    const m = /^(.*) \(([^,()]+), (\d+), (\d+) J\.\)$/.exec(text);
    if (!m) return text;
    let w = id ? (finde(id) || {}).w : null;
    if (!w && team) w = (team.roster || []).find(p => voll(p) === m[1]);
    if (!w || hatBericht(w)) return text;
    const st = stufe(w.ovr);
    return `${m[1]} (${m[2]}, ${st.name} ${st.spanne}, ${m[4]} J.)`;
  }

  // ── Front Office: Text der Kachel „Draft & Scouting“ ──────────────────────
  function kachelText() {
    const z = zustand(); if (!z) return '';
    const neu = z.neu.filter(id => bericht(id)).length;
    if (neu) return `${neu} ${neu === 1 ? 'neuer Bericht' : 'neue Berichte'}`;
    const j = draftJahrgang();
    return j ? `Draft ${j.jahr}` : `${scoutsGesamt()} Spieler je Woche`;
  }
  function foKachel() {
    if (typeof document === 'undefined') return;
    const k = document.querySelector('#view-fo .fo-kachel[data-go="scout"] small');
    if (k && aktiv()) { const t = kachelText(); if (k.textContent !== t) k.textContent = t; }
  }

  // ── Bedienung (ein Empfänger für alle data-sc) ────────────────────────────
  function neuZeichnen() { zeichne(); blattNeu(); if (typeof window.renderTransferTab === 'function' && document.querySelector('#view-transfer.active')) { try { window.renderTransferTab(); } catch (e) { /* optional */ } } }
  async function neuerAuftrag() {
    const z = zustand(), an = analyse(), stil = eigenerStil();
    const relevant = stil && H.STIL_POS[stil] ? H.STIL_POS[stil] : [];
    // großer Bedarf zuerst (dann auch der Filter „Großer Bedarf“ vorn), sonst in der Reihenfolge der Positionen
    const gross = p => { const a = an.find(x => x.pos === p); return a && a.bedarf >= 2 ? 1 : 0; };
    const eintraege = POSITIONEN().slice().sort((x, y) => gross(y) - gross(x)).map(p => {
      const a = an.find(x => x.pos === p), lauf = z.auftraege.some(x => x.pos === p);
      return { wert: p, text: POS_NAME[p] || p, bild: posBadge(p),
        sub: (lauf ? 'läuft schon · ' : '') + (a ? `${a.art} · Bedarf ${de(a.bedarf, 1)}${a.gruende[0] ? ' · ' + a.gruende[0] : ''}` : 'kein Bedarf laut Analyse') + (relevant.indexOf(G.grund(p)) >= 0 ? ' · zählt für den Stil' : ''),   // D95: Gruppe ohne Seite
        gruppe: a && a.bedarf >= 2 ? 'Großer Bedarf' : 'Weitere', aus: lauf };
    });
    let pos = null;
    if (window.DFLAuswahl && DFLAuswahl.oeffnen) pos = await DFLAuswahl.oeffnen({ titel: 'Neuer Scouting-Auftrag', untertitel: 'Position wählen' + (stil ? ' · Stil: ' + stilName(stil) : ''), eintraege, filter: true });
    else pos = (an[0] || {}).pos || 'ST';
    if (!pos) return;
    auftragStarten(pos, 'frei');
    ui.tab = 'auftraege';
    neuZeichnen();
  }
  function aktion(was, el) {
    const i = was.indexOf(':'), art = i < 0 ? was : was.slice(0, i), wert = i < 0 ? '' : was.slice(i + 1);
    const z = zustand(); if (!z) return;
    if (art === 'tab') { ui.tab = wert; if (wert === 'bericht') ui.wahl = null; zeichne(); return; }
    // D120: Segment, Positionen (Fokus, höchstens 2), Filter, Zeile auf/zu
    if (art === 'seg') { z.seg = wert; z.filter = null; ui.offen = null; zeichne(); return; }
    if (art === 'pos') {
      if (wert === 'alle') z.fokus = [];
      else { const i = z.fokus.indexOf(wert); if (i >= 0) z.fokus.splice(i, 1); else { z.fokus.push(wert); if (z.fokus.length > CFG.fokusMax) z.fokus.shift(); } }
      ui.offen = null; speichern(); zeichne(); return;
    }
    if (art === 'filt') { z.filter = z.filter === wert ? null : wert; ui.offen = null; zeichne(); return; }
    if (art === 'offen') { ui.offen = ui.offen === wert ? null : wert; zeichne(); return; }
    if (art === 'filter') { ui.filter = wert; zeichne(); return; }
    if (art === 'kandidaten') { z.aktiv = wert; ui.tab = 'kandidaten'; zeichne(); return; }
    if (art === 'auftrag') { auftragStarten(wert, 'analyse'); ui.tab = 'auftraege'; neuZeichnen(); return; }
    if (art === 'auftrag-neu') { neuerAuftrag(); return; }
    if (art === 'auftrag-ende') { auftragBeenden(wert); zeichne(); return; }
    if (art === 'scout') { const r = scouten(wert); if (!r.ok) toast(r.grund, 'warn'); neuZeichnen(); return; }
    if (art === 'rueckruf') { if (rueckruf(wert)) toast('Scout zurückgerufen – der Bericht verfällt.', 'info'); neuZeichnen(); return; }
    if (art === 'zurueck') { ui.wahl = null; zeichne(); return; }
    if (art === 'bericht') {
      const imScouting = el && el.closest && el.closest('#dfl-scouting');
      if (imScouting && bericht(wert)) { ui.wahl = wert; ui.tab = 'bericht'; zeichne(); const b = document.getElementById('dfl-scouting'); if (b && b.scrollIntoView) b.scrollIntoView({ block: 'start' }); return; }
      blatt(wert); return;
    }
    if (art === 'blatt') { blatt(wert); return; }
    if (art === 'trade') {
      const f = finde(wert); if (!f || !f.team || !window.DFLTrade) return;
      blattZu();
      if (DFLTrade.mitSpieler) DFLTrade.mitSpieler(f.team.id, String(f.w.id));
      return;
    }
    if (art === 'fa') { blattZu(); if (typeof signFreeAgent === 'function') signFreeAgent('fa_' + wert); return; }
    if (art === 'draft') {
      blattZu();
      if (window.DFLAppShell && shell()) DFLAppShell.zeige('scout'); else if (typeof switchAppView === 'function') switchAppView('scout', document.getElementById('nav-scout'));
      setTimeout(() => { const d = document.getElementById('dfl-draftboard'); if (d && d.scrollIntoView) d.scrollIntoView({ block: 'start' }); }, 60);
    }
  }
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('click', ev => {
      if (!aktiv()) return;
      const t = ev.target && ev.target.closest && ev.target.closest('[data-sc]');
      if (!t || t.disabled) return;
      ev.preventDefault(); ev.stopPropagation();
      aktion(t.getAttribute('data-sc'), t);
    });
    document.addEventListener('keydown', ev => {
      // Zeilen als Knopf: Scouting-Listen und Draft-Jahrgang (D111: Zeile → Talent-Blatt)
      if ((ev.key === 'Enter' || ev.key === ' ') && ev.target && ev.target.matches && ev.target.matches('.sc-zeile, tr[data-sc][role="button"]')) { ev.preventDefault(); ev.target.click(); }
      if (ev.key === 'Escape' && document.getElementById('sc-ov')) blattZu();
    });
  }

  // ── Einhängen ─────────────────────────────────────────────────────────────
  // Scouting-Ansicht: Block zwischen Banner und Draft-Jahrgängen; Text der Abteilung passend zur DFL (vorher: Transfermarkt)
  const ABTEILUNG = 'Deine Scouts beobachten Spieler aus Liga, Free Agency und Draft. Je Stufe mehr Scouts gleichzeitig (Stufe ÷ 2) ' +
    'und genauere Einschätzungen: engere Spannen im Draft, verborgene Nieten werden früher erkannt.';
  {
    const _orig = window.renderScoutTab;
    if (typeof _orig === 'function') {
      window.renderScoutTab = function () {
        try { if (aktiv() && typeof FACILITY_DEFS !== 'undefined' && FACILITY_DEFS.scouting) FACILITY_DEFS.scouting.desc = ABTEILUNG; } catch (e) { /* ohne Anlagen */ }
        const r = _orig.apply(this, arguments);
        try { zeichne(); } catch (e) { console.warn('[DFL-Scouting] Scouting-Ansicht', e); }
        return r;
      };
      try { renderScoutTab = window.renderScoutTab; } catch (e) { /* nur im Spiel */ }
    }
  }
  // Karte der Scouting-Abteilung: statt der Werte des alten Transfermarkts (Max. Spielerstärke, Internationale Spieler) was die
  // Stufe in der DFL bringt – Scouts gleichzeitig, Spannen auf dem Draft-Board (DFLKader.schaetzung), Nieten früher erkannt (D103)
  {
    const _orig = window.renderFacilityCard;
    if (typeof _orig === 'function') {
      window.renderFacilityCard = function (key) {
        const html = _orig.apply(this, arguments);
        if (key !== 'scouting' || !aktiv() || typeof html !== 'string') return html;
        try {
          const sc = stufeScouting(), N = (G.CFG && G.CFG.niete) || { scoutingAb: 5, scoutingMax: 0.5 };
          const scouts = s => Math.max(1, Math.ceil(s / CFG.jeScout));
          const naechste = sc < 10 ? ` <small>(Stufe ${sc + 1}: ${scouts(sc + 1)})</small>` : '';
          const blick = Math.round(klemme((sc - N.scoutingAb) / 10, 0, N.scoutingMax) * 100);
          const neu = `<div class="fc-stat"><span>Scouts gleichzeitig</span><b>${scouts(sc)}${naechste}</b></div>` +
            `<div class="fc-stat"><span>Draft-Board</span><b>Stärke ±${Math.max(1, 7 - Math.round(sc / 2))} · Potenzial ±${Math.max(2, 12 - sc)}</b></div>` +
            `<div class="fc-stat"><span>Nieten durchschaut</span><b title="So viel der falschen Hoffnung bei verborgenen Nieten (D103) sieht dein Scouting gleich">${blick} %</b></div>`;
          return html.replace(/<div class="fc-stat"><span>Max\. Spielerstärke<\/span>[\s\S]*?<span>Internationale Spieler<\/span><b>[^<]*<\/b><\/div>/, neu);
        } catch (e) { return html; }
      };
      try { renderFacilityCard = window.renderFacilityCard; } catch (e) { /* nicht global gebunden */ }
    }
  }
  // Wochentakt: Berichte fertig, abgelaufene weg, freie Scouts zu den Aufträgen
  {
    const _orig = window.advanceCalendarWeek;
    if (typeof _orig === 'function') {
      window.advanceCalendarWeek = function () {
        const vorher = dfl() ? LEAGUE.season + ':' + LEAGUE.week : null;
        const r = _orig.apply(this, arguments);
        if (dfl() && LEAGUE.season + ':' + LEAGUE.week !== vorher) {
          try { woche(); zeichne(); blattNeu(); } catch (e) { console.warn('[DFL-Scouting] Wochentakt', e); }
        }
        return r;
      };
      try { advanceCalendarWeek = window.advanceCalendarWeek; } catch (e) { /* nur im Spiel */ }
    }
  }
  // traits.js: „scout“-Eigenschaften sieht man mit Bericht (die alte Beobachtung gibt es nicht mehr)
  if (typeof window.beobachtungsFortschritt !== 'function') window.beobachtungsFortschritt = p => (aktiv() && p && hatBericht(p) ? 1 : 0);
  // Front Office: Kacheltext (die App-Oberfläche zeichnet #view-fo intern neu)
  if (typeof document !== 'undefined' && typeof MutationObserver === 'function') {
    const beobachten = () => {
      let an = null;
      const fo = new MutationObserver(() => foKachel());
      const verbinden = () => { const v = document.getElementById('view-fo'); if (v && v !== an) { fo.disconnect(); fo.observe(v, { childList: true }); an = v; foKachel(); } };
      new MutationObserver(verbinden).observe(document.querySelector('.app') || document.body, { childList: true });
      if (document.body) new MutationObserver(verbinden).observe(document.body, { childList: true });
      verbinden();
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', beobachten); else { try { beobachten(); } catch (e) { /* ohne DOM */ } }
  }
  // Spielstand schon geladen (initGame lädt vor den Patches): Zustand anlegen, Ansicht zeichnen
  try { if (dfl()) { zustand(); zeichne(); } } catch (e) { /* ohne Spielstand */ }

  window.DFLScouting = {
    CFG, aktiv, zustand, sicht, hatBericht, bericht, staerkeHtml, staerkeText, potText, potSpanne, stufe, sortWert, knopfHtml, blatt, blattZu,
    scouten, rueckruf, auftragStarten, auftragBeenden, kandidaten, passung, woche, verteilen, zeileHtml, listeAnmelden, teilText, tauschLeiste,
    berichtHtml, uebersichtHtml: berichteUebersichtHtml, zeichne, kachelText, scoutsGesamt, freieScouts, weltId, finde, phi, eigenerStil,
    ui: () => ui
  };
  console.log('%c[DFL-Scouting v1] aktiv', 'color:#3fb950;font-weight:bold',
    '— Aufträge je Position, Scouts nach Stufe, Berichte (Liga 2 · FA 1 · Draft 2 Wochen), ohne Bericht nur die Stufe, Passung zum Stil (D78)');
})();
