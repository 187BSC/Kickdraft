/* ═══════════════════════════════════════════════════════════════════════════
   DFL · TRADE-ANFRAGEN  ·  v1   (D50, Nutzer 2026-10-09)
   ─────────────────────────────────────────────────────────────────────────
   KI-Vereine fragen von sich aus bei dir an – im Wechselfenster (Vorbereitung bis zur Trade-Deadline):
     · Spieler: ein Verein hat einen deiner Spieler im Auge (Bedarf, Taktik, bezahlbar, passt in den Cap)
       und bietet Picks und/oder Ergänzungsspieler; liegt er sonst über dem Cap, schickt er Gehalt zurück
     · Pick nach unten: ein Verein will deinen besseren Erstrundenpick und gibt dafür mindestens zwei
       schwächere (einer aus demselben Jahrgang) – meist sparst du Rookie-Cap und bekommst einen zweiten Versuch.
       Seit 2026-10-10 (Nutzer: „Trade-Anfragen für nur Picks bitte erst beim Draft-Tag“) nicht mehr in der Saison –
       solche Angebote kommen am Draft-Tag (dfl_kader_patch.js, Draft nach unten tauschen).
   Anfragen landen im Postfach (Filter „Angebote“), gelten 2 Wochen, höchstens 2 sind offen. Ablehnen: mit 50 %
   kommt der Verein einmal mit einem besseren Angebot (mindestens +8 %), sonst fragt er in diesem Fenster nicht mehr.
   Verhandeln öffnet die Trade-Zentrale mit dem Angebot (der Interessenzuschlag gilt weiter).
   Bis zu 3 eigene Spieler lassen sich als unverkäuflich markieren – für sie kommen keine Anfragen.
   v2 (D99, 2026-10-11, Vorschau spiel/dfl_scout_vorschau.html): Angebote AN dich (art 'angebot') auf demselben Weg – ein
   KI-Verein bietet dir einen Spieler an, der bei ihm weg will oder abgegeben wird (DFLHandel.angebotFuer: Lücke in deiner
   Kaderanalyse, passend zu deinem Stil, ab 74, das für dich günstigste Paket aus 1–2 Teilen, Preis 85/90 %). Höchstens ein
   Angebot je Woche (Chance CFG.angebot.chance), je Verein eins je Wechselfenster, höchstens 2 offen; gilt 2 Wochen. Im Blatt:
   Ansehen (Trade-Zentrale mit dem Paket), Später (bis zum Ende des Wechselfensters), Kein Interesse (der Spieler kommt in
   diesem Fenster nicht wieder). Zustand des Fensters: CLUB.dfl.angebote { f, teams, nein, woche, n }.
   v3 (Welt-Paket, Markt, 2026-10-11): bis zu 2 Angebote je Woche (CFG.angebot.jeWoche, je Versuch die Chance von 50 %), höchstens
   4 offen (2 je Woche × 2 Wochen Frist); findet der erste Versuch kein Paket, gibt es in dieser Woche keinen zweiten.
   Braucht: DFLHandel (Logik), DFLTrade (Ausführen), DFLSpiel, DFLKader. Lädt nach dfl_trade_patch.js.
   API: DFLAnfragen
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const H = window.DFLHandel, D = window.DFLSpiel, K = window.DFLKader;
  if (!H || !D || !K || !H.anfragePaket) { console.warn('[DFL-Anfragen] DFL-Module fehlen – Patch inaktiv'); return; }

  const CFG = { chanceSpieler: 0.4, chancePick: 0.15, pickNurDraft: true, offenMax: 2, frist: 2, nachbessern: 0.5, mehr: 1.08, unverkaeuflichMax: 3,
    // D99: Angebote an dich – Chance je Versuch, bis zu jeWoche Versuche je Woche (Welt-Paket: 2 statt 1), höchstens offenMax offen (Nutzer 2026-10-13: 3)
    // (2 × Frist 2 Wochen), Frist wie Anfragen
    angebot: { chance: 0.5, jeWoche: 2, offenMax: 3, frist: 2 } };
  const dfl = () => typeof CLUB !== 'undefined' && CLUB && CLUB.dfl && CLUB.dfl.aktiv && typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.dfl;
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const mio = x => (Math.round((x || 0) / 1e5) / 10).toLocaleString('de-DE') + ' Mio €';
  const name = p => (p.firstName ? p.firstName + ' ' : '') + p.name;
  // Position mit Neben-Positionen in Klammern (D83), Bezeichnungen wie im Spiel (OM = ZOM)
  const posName = x => x === 'OM' ? 'ZOM' : x;
  const posText = p => { const n = [...new Set((p.positions || []).filter(x => x && x !== p.pos))].map(posName);
    return posName(p.pos) + (n.length ? ' (' + n.join(', ') + ')' : ''); };
  const offen = () => (CLUB.dfl.anfragen || []).filter(a => a.status === 'offen');
  // D50-Anfragen (KI will etwas von dir) und D99-Angebote (KI bietet dir etwas an) haben getrennte Grenzen
  const offenAnfragen = () => offen().filter(a => a.art !== 'angebot'), offenAngebote = () => offen().filter(a => a.art === 'angebot');
  const fensterOffen = () => LEAGUE.matchday < H.CFG.deadlineSpieltag;
  const fensterKey = () => LEAGUE.season + (fensterOffen() ? 'a' : 'b');
  // Letzte Woche für Trades (Woche des Deadline-Spieltags, vor dem Anpfiff); Fristen enden spätestens dort (Testrückmeldung 2026-10-22: „KW 25“)
  const letzteWoche = () => { const w = (LEAGUE.matchWeeks || [])[H.CFG.deadlineSpieltag - 1]; return w || Infinity; };
  const fristBis = n => Math.min(LEAGUE.week + n, letzteWoche());
  const speichern = () => { if (typeof saveGameState === 'function') saveGameState(); };
  const postfach = () => { if (typeof renderPostfach === 'function') { try { renderPostfach(); } catch (e) { /* Ansicht optional */ } } };
  function welt() { const L = D.welt(); H.picks(L); H.taktikenSetzen(L); return L; }
  const teamVon = (L, id) => L.teams.find(t => t.id === id);

  // ── Unverkäuflich (eigene Spieler, SQUAD-IDs) ─────────────────────────────
  const unv = () => (CLUB.dfl.unverkaeuflich = CLUB.dfl.unverkaeuflich || []);
  function istUnverkaeuflich(id) { return dfl() && unv().indexOf(id) >= 0; }
  function unverkaeuflich(id) {
    const l = unv(), i = l.indexOf(id);
    if (i >= 0) l.splice(i, 1);
    else if (l.length >= CFG.unverkaeuflichMax) { alert(`Höchstens ${CFG.unverkaeuflichMax} Spieler können unverkäuflich sein.`); return false; }
    else l.push(id);
    speichern();
    return l.indexOf(id) >= 0;
  }
  const sperreDfl = () => unv().map(id => { const q = SQUAD.find(x => x.id === id); return q ? (q.dflId || q.id) : null; }).filter(Boolean);

  // ── Anfragen erzeugen ────────────────────────────────────────────────────
  function teileText(L, a) { return a.teile || []; }
  function neueAnfrage(L, B, paket, extra) {
    const a = Object.assign({ id: 'anf' + LEAGUE.season + '-' + LEAGUE.week + '-' + Math.floor(Math.random() * 1e6), art: paket.art, team: B.id,
      deal: paket.deal, interesse: paket.interesse, ki: !!paket.ki, teile: paket.teile, wertFuerA: paket.wertFuerA, verlust: paket.verlust, aufschlag: paket.aufschlag || null,
      saison: LEAGUE.season, woche: LEAGUE.week, bis: fristBis(CFG.frist), runde: 0, status: 'offen' }, extra || {});
    if (paket.art === 'pick') Object.assign(a, { pick: paket.deal.gibt.picks[0], pickText: paket.pick, rookieVorher: paket.rookieVorher, rookieNachher: paket.rookieNachher });
    (CLUB.dfl.anfragen = CLUB.dfl.anfragen || []).push(a);
    CLUB.dfl.anfragen = CLUB.dfl.anfragen.filter(x => x.status === 'offen' || x.saison >= LEAGUE.season - 1).slice(-40);
    const titel = a.art === 'pick' ? `${B.name} will deinen ${a.pickText.replace(/^Pick /, '')}` : `${B.name} will ${a.spielerName}`;
    addNews('transfer', `📨 Trade-Anfrage: ${titel}`, `${a.runde ? 'Neues Angebot: ' : ''}${B.name} bietet ${a.teile.map(t => sichtText(t, B)).join(' + ')}. Gültig bis KW ${a.bis} – im Postfach unter „Angebote“.`);
    if (typeof showToast === 'function') showToast(`Trade-Anfrage von ${B.name}`, 'info', { duration: 3500 });
    return a;
  }
  // Spieler-Anfrage: KI-Vereine durchsuchen gezielt deinen Kader (Regeln der Wunschliste), dann Paket bauen
  function spielerAnfrage(L, nachbessern) {
    const eigen = D.eigeneDflId(), A = teamVon(L, eigen), rang = H.raenge(L), sperre = CLUB.dfl.anfrageSperre || {};
    const offenTeams = new Set(offen().map(a => a.team)), offenSp = new Set(offen().map(a => a.spieler));
    const kand = [];
    L.teams.forEach(B => {
      if (B.id === eigen || sperre[B.id] === fensterKey() || offenTeams.has(B.id)) return;
      H.wunschliste(L, B, rang, { nur: eigen, nutzer: eigen, sperre: sperreDfl(), max: 2 }).forEach(w => { if (!offenSp.has(w.id)) kand.push({ B, w }); });
    });
    // die zwölf besten Kandidaten in leicht gemischter Reihenfolge – das erste Paket, das für beide aufgeht, wird verschickt
    kand.forEach(k => { k.mix = k.w.score + Math.random() * 6; });
    for (const k of kand.sort((a, b) => b.w.score - a.w.score).slice(0, 12).sort((a, b) => b.mix - a.mix)) {
      const p = A.roster.find(x => x.id === k.w.id); if (!p) continue;
      const paket = H.anfragePaket(L, k.B, A, p);
      if (paket) return neueAnfrage(L, k.B, paket, { spieler: p.id, spielerName: name(p) + ' (' + posText(p) + ', ' + p.ovr + ')', grund: grundText(L, k.B, p) });
    }
    return null;
  }
  // Pick nach unten: dein Erstrundenpick des nächsten Drafts (erwartet bis #20), Vereine mit schwächerem Pick fragen an
  function pickAnfrageNeu(L) {
    const eigen = D.eigeneDflId(), A = teamVon(L, eigen), rang = H.raenge(L), sperre = CLUB.dfl.anfrageSperre || {};
    const j0 = Math.min(...L.picks.map(x => x.jahr));
    const meine = L.picks.filter(x => x.besitzer === eigen && x.runde === 1 && x.jahr === j0 && H.pickWert(L, x, null, rang).platz <= 20 && !offen().some(a => a.pick === x.id));
    if (!meine.length) return null;
    const x = meine[0], offenTeams = new Set(offen().map(a => a.team));
    for (const B of L.teams.filter(t => t.id !== eigen && sperre[t.id] !== fensterKey() && !offenTeams.has(t.id)).sort(() => Math.random() - 0.5).slice(0, 8)) {
      const paket = H.pickAnfrage(L, B, A, x);
      if (paket) return neueAnfrage(L, B, paket, { grund: 'will im Draft nach oben' });
    }
    return null;
  }
  function grundText(L, B, p) {
    const teile = [];
    const bed = (window.DFLGenerator && DFLGenerator.bedarf(B)[p.pos]) || 0;
    if (bed > 0) teile.push(`Lücke auf ${p.pos}`);
    if (H.stilPasst(L, B, p)) teile.push(`passt zu ihrem ${H.STIL_TEXT[H.stilVon(B)]}`);
    return teile.join(' · ') || 'Verstärkung';
  }
  // ── D99: Angebote an dich ────────────────────────────────────────────────
  // Zustand des Wechselfensters: Vereine, die schon angeboten haben (eins je Fenster), Spieler mit „Kein Interesse“, Woche des
  // letzten Versuchs (höchstens ein Angebot je Woche); Zähler je Saison (gemacht, Kandidaten, an der Kadergrenze gescheitert …)
  function angebotZustand() {
    const f = fensterKey(), alt = CLUB.dfl.angebote;
    if (!alt || alt.f !== f) CLUB.dfl.angebote = { f, teams: [], nein: [], woche: alt ? alt.woche : null, n: (alt && alt.n) || {} };
    return CLUB.dfl.angebote;
  }
  const kurz = p => (p.firstName ? p.firstName.charAt(0) + '. ' : '') + p.name;
  // „Pick 2027 · Runde 1 · erwartet Pick ~25“ → „Pick 2027 R1 (~25)“ (Meldungen)
  const teilKurz = t => String(t).replace(/^Pick (\d{4}) · Runde (\d)((?: \(von [^)]+\))?) · erwartet Pick ~(\d+)$/, 'Pick $1 R$2$3 (~$4)');
  const GRUND_AB = { cap: 'Cap-Not', neuaufbau: 'Neuaufbau', stil: 'passt nicht zu ihrem Stil', ueberschuss: 'Überschuss' };
  function stilEigen() {
    const T = window.DFLTaktik, s = T && T.eigenerStil ? T.eigenerStil() : null;
    return (s && s.stil) || (CLUB.dfl.taktik && CLUB.dfl.taktik.stil) || null;
  }
  // deine Kadergrenzen wie beim Ausführen (DFLTrade.ausfuehrenDeal): ab dem Kaderschnitt höchstens 28, in der Saison mindestens 21
  function kaderGrenzen() {
    const K2 = window.DFLKader;
    if (!K2 || !K2.hauptkader) return null;
    return { jetzt: K2.hauptkader().length, max: K2.MAX ? K2.MAX() : 28, min: K2.MIN ? K2.MIN() : 21,
      grenze: !!(K2.grenzeAktiv ? K2.grenzeAktiv() : (K2.saisonLaeuft && K2.saisonLaeuft())), laeuft: !!(K2.saisonLaeuft && K2.saisonLaeuft()) };
  }
  // Grund in einem Satz: „will weg (Team im Keller, kaum Einsätze)“ bzw. „Neuaufbau, passt nicht zu ihrem Stil“
  function angebotGrund(a) {
    const ab = (a.gruende || []).filter(g => GRUND_AB[g]).map(g => GRUND_AB[g]);
    return a.zuHaben === 'weg' ? 'will weg' + ((a.weg || []).length ? ' (' + a.weg.slice(0, 2).join(', ') + ')' : '') : ab.join(', ') || 'wird abgegeben';
  }
  // je Woche einmal: bis zu CFG.angebot.jeWoche Versuche mit je CFG.angebot.chance (opt.immer: genau ein Versuch, ohne Zufall und Grenzen);
  // gibt das erste Angebot zurück
  function angebotWoche(L, opt) {
    opt = opt || {};
    const z = angebotZustand(), marke = LEAGUE.season * 100 + LEAGUE.week;
    if (!opt.immer && z.woche === marke) return null;
    z.woche = marke;
    let erstes = null;
    for (let i = 0; i < (opt.immer ? 1 : CFG.angebot.jeWoche); i++) {
      if (!opt.immer && offenAngebote().length >= CFG.angebot.offenMax) break;
      if (!opt.immer && Math.random() >= CFG.angebot.chance) continue;
      const a = angebotVersuch(L, z);
      if (!a) break;                       // kein passendes Paket – ein zweiter Versuch fände in derselben Woche auch keins
      erstes = erstes || a;
    }
    return erstes;
  }
  function angebotVersuch(L, z) {
    const n = z.n[LEAGUE.season] = z.n[LEAGUE.season] || {};
    const eigen = D.eigeneDflId(), A = D.eigenSync() || teamVon(L, eigen);
    if (!A) return null;
    const sc = (CLUB.facilities && CLUB.facilities.scouting) || 5;
    const analyse = window.DFLGenerator.kaderAnalyse(A, { scouting: sc, saat: (CLUB.dfl.saisonIndex || 0) * 101 });
    const stat = {};
    const ang = H.angebotFuer(L, A, { analyse, stil: stilEigen(), ohneTeams: z.teams.concat(offen().map(a => a.team)), ohneSpieler: z.nein,
      sperre: sperreDfl(), kader: kaderGrenzen(), stat });
    n.versuche = (n.versuche || 0) + 1;
    ['kandidaten', 'kader', 'abgelehnt', 'zuTeuer'].forEach(k => { if (stat[k]) n[k] = (n[k] || 0) + stat[k]; });
    if (stat.gruende) { n.gruende = n.gruende || {}; Object.keys(stat.gruende).forEach(g => { n.gruende[g] = (n.gruende[g] || 0) + stat.gruende[g]; }); }   // Prüflauf
    if (!ang) return null;
    n.angebote = (n.angebote || 0) + 1;
    return neuesAngebot(L, ang);
  }
  function neuesAngebot(L, ang) {
    const z = angebotZustand(), B = ang.B, p = ang.p;
    z.teams.push(B.id);
    const a = { id: 'ang' + LEAGUE.season + '-' + LEAGUE.week + '-' + Math.floor(Math.random() * 1e6), art: 'angebot', team: B.id, deal: ang.deal,
      spieler: p.id, spielerName: name(p) + ' (' + posText(p) + ')', zuHaben: ang.z.art, gruende: ang.z.gruende.slice(),
      weg: ang.z.art === 'weg' && p.weg ? (p.weg.gruende || []).map(g => g.t) : [], faktor: ang.z.faktor, preis: ang.preis, wertVoll: ang.wertVoll,
      fuerB: ang.fuerB, teile: ang.teile.map(t => t.text), bedarf: ang.bedarf, pos: p.pos, verlust: ang.verlust, wertFuerA: ang.wertFuerA,
      meldung: `Angebot: ${B.name} bietet ${kurz(p)} an`,
      saison: LEAGUE.season, woche: LEAGUE.week, bis: fristBis(CFG.angebot.frist), runde: 0, status: 'offen' };
    (CLUB.dfl.anfragen = CLUB.dfl.anfragen || []).push(a);
    CLUB.dfl.anfragen = CLUB.dfl.anfragen.filter(x => x.status === 'offen' || x.saison >= LEAGUE.season - 1).slice(-40);
    addNews('transfer', `📨 ${a.meldung}`, `${B.name} bietet dir ${name(p)} (${posName(p.pos)}) an – ${angebotGrund(a)}. ` +
      `Sie wollen ${a.teile.map(t => teilKurz(sichtText(t, B))).join(' + ')}. Gültig bis KW ${a.bis} – im Postfach unter „Angebote“.`);
    if (typeof showToast === 'function') showToast(`Angebot von ${B.name}`, 'info', { duration: 3500 });
    return a;
  }
  // Später: bleibt bis zum Ende des Wechselfensters · Kein Interesse: der Spieler kommt in diesem Fenster nicht wieder
  function spaeter(id) {
    const a = finde(id); if (!a || a.status !== 'offen' || a.art !== 'angebot') return;
    a.spaeter = true;
    // „gültig bis“ = letzte Woche für Trades (Spieltag vor der Deadline; Tausch-Karte im Postfach zeigt die Frist)
    const dl = letzteWoche();
    if (dl !== Infinity && dl > a.bis) a.bis = dl;
    if (typeof showToast === 'function') showToast('Bleibt bis zum Ende des Wechselfensters im Postfach', 'info');
    zu(); postfach(); speichern();
  }
  function keinInteresse(id) {
    const a = finde(id); if (!a || a.status !== 'offen') return;
    const L = welt(), B = teamVon(L, a.team), z = angebotZustand();
    a.status = 'abgelehnt';
    if (z.nein.indexOf(a.spieler) < 0) z.nein.push(a.spieler);
    if (typeof showToast === 'function') showToast(`Kein Interesse – ${B ? B.name : 'der Verein'} bietet ihn dir in diesem Fenster nicht mehr an`, 'info');
    zu(); postfach(); speichern();
  }
  // Ansehen: Trade-Zentrale mit dem fertigen Paket (dort wie gewohnt umbauen und abschließen)
  function ansehen(id) {
    const a = finde(id); if (!a || !window.DFLTrade) return;
    const B = teamVon(welt(), a.team);
    a.angesehen = true;
    zu();
    DFLTrade.vorbelegen(a.deal, null, `Angebot von ${B ? B.name : 'dem Verein'}: das Paket steht schon drin – abschließen oder umbauen.`);
  }

  // Wochentakt (an advanceCalendarWeek): ablaufen lassen, nachbessern, Wunschlisten auffrischen, neue Anfrage
  function woche() {
    if (!dfl()) return;
    const L = welt();
    // abgelaufen (Frist oder Deadline/neue Saison); D99-Angebote: „Später“ hält bis zum Ende des Fensters, weg ist weg
    (CLUB.dfl.anfragen || []).forEach(a => {
      if (a.status !== 'offen') return;
      if (a.art === 'angebot') {
        const B = teamVon(L, a.team);
        if (a.saison !== LEAGUE.season || !fensterOffen() || (!a.spaeter && LEAGUE.week > a.bis) || !B || !B.roster.some(p => p.id === a.spieler)) a.status = 'abgelaufen';
        return;
      }
      if (a.saison !== LEAGUE.season || LEAGUE.week > a.bis || !fensterOffen()) {
        a.status = 'abgelaufen';
        const B = teamVon(L, a.team);
        if (B && a.saison === LEAGUE.season) addNews('transfer', `⌛ Anfrage abgelaufen: ${B.name}`, `${B.name} hat auf eine Antwort gewartet und sucht jetzt woanders.`);
      }
    });
    if (!fensterOffen()) return;
    // D99: ein Verein bietet dir einen Spieler an (höchstens einer je Woche) – vor den Anfragen, unabhängig von ihnen
    try { angebotWoche(L); } catch (e) { console.warn('[DFL-Anfragen] Angebot (D99)', e); }
    // Wunschlisten: Vorbereitung, ab Spieltag 1 und ab Spieltag 8 neu (für „Interesse“ und KI-Trades)
    const phase = LEAGUE.matchday === 0 ? 0 : LEAGUE.matchday < 8 ? 1 : 2, marke = LEAGUE.season * 10 + phase;
    if (CLUB.dfl.beobMarke !== marke) {
      CLUB.dfl.beobMarke = marke;
      H.beobachtungAktualisieren(L, { nutzer: D.eigeneDflId(), sperre: sperreDfl(), saat: LEAGUE.season });
    }
    // nachbessern (eine Woche nach der Absage)
    (CLUB.dfl.anfragen || []).filter(a => a.status === 'nachbessern' && LEAGUE.week >= a.wann).forEach(a => {
      a.status = 'abgelehnt';
      const B = teamVon(L, a.team), A = teamVon(L, D.eigeneDflId());
      if (!B || offenAnfragen().length >= CFG.offenMax) return;
      // Ein Teil drauflegen (der kleinste Pick oder Ergänzungsspieler, der das Angebot spürbar besser macht)
      const n = (a.art === 'pick' ? L.picks.some(k => k.id === a.pick && k.besitzer === A.id) : A.roster.some(x => x.id === a.spieler) && !sperreDfl().includes(a.spieler))
        ? H.paketNachbessern(L, a.deal, { interesse: a.interesse + 0.1, ki: a.ki, plus: CFG.mehr - 1 }) : null;
      if (n) {
        const paket = { art: a.art, deal: n.deal, interesse: a.interesse + 0.1, ki: a.ki, teile: n.teile, wertFuerA: n.wertFuerA, verlust: a.verlust, aufschlag: a.aufschlag,
          pick: a.pickText, rookieVorher: a.rookieVorher,
          rookieNachher: (a.rookieNachher || 0) + (n.zusatzPick && a.pickText && a.pickText.indexOf(String(n.zusatzPick.jahr)) >= 0 && window.DFLGenerator ? (DFLGenerator.rookieCapHit || DFLGenerator.rookieGehalt)(n.zusatzPick.platz) : 0) };
        neueAnfrage(L, B, paket, { spieler: a.spieler, spielerName: a.spielerName, grund: a.grund, runde: 1, zusatz: n.zusatz });
      } else (CLUB.dfl.anfrageSperre = CLUB.dfl.anfrageSperre || {})[a.team] = fensterKey();
    });
    // neue Anfrage
    if (offenAnfragen().length >= CFG.offenMax) return;
    if (Math.random() < CFG.chanceSpieler && spielerAnfrage(L)) return;
    if (!CFG.pickNurDraft && Math.random() < CFG.chancePick) pickAnfrageNeu(L);
  }

  // ── Annehmen, ablehnen, verhandeln ───────────────────────────────────────
  const finde = id => (CLUB.dfl.anfragen || []).find(a => a.id === id);
  function noch(a, L) {
    if (!a || a.status !== 'offen') return 'Die Anfrage ist nicht mehr offen.';
    if (!fensterOffen()) return 'Das Wechselfenster ist zu.';
    const e = H.bewerte(L, a.deal, { interesse: a.interesse, ki: a.ki });
    return e.akzeptiert ? null : 'Das Angebot gilt nicht mehr: ' + e.grund;
  }
  function annehmen(id) {
    const a = finde(id), L = welt(), fehler = noch(a, L);
    if (fehler) { alert(fehler); if (a && a.status === 'offen') { a.status = 'abgelaufen'; speichern(); } zu(); postfach(); return; }
    const ok = window.DFLTrade && DFLTrade.ausfuehrenDeal(a.deal, { interesse: a.interesse, ki: a.ki });
    if (ok) { a.status = 'angenommen'; if (typeof showToast === 'function') showToast('Trade abgeschlossen', 'success'); }
    zu(); postfach(); speichern();
    if (window.DFLAppShell) try { DFLAppShell.cta(); } catch (e) { /* optional */ }
  }
  function ablehnen(id) {
    const a = finde(id); if (!a || a.status !== 'offen') return;
    if (a.art === 'angebot') { keinInteresse(id); return; }                  // D99: „Kein Interesse“
    const L = welt(), B = teamVon(L, a.team);
    if (a.runde === 0 && Math.random() < CFG.nachbessern) {
      a.status = 'nachbessern'; a.wann = LEAGUE.week + 1;
      if (typeof showToast === 'function') showToast(`${B ? B.name : 'Der Verein'} denkt über ein besseres Angebot nach`, 'info');
    } else {
      a.status = 'abgelehnt';
      (CLUB.dfl.anfrageSperre = CLUB.dfl.anfrageSperre || {})[a.team] = fensterKey();
      if (typeof showToast === 'function') showToast(`${B ? B.name : 'Der Verein'} hat verstanden – keine Anfragen mehr in diesem Fenster`, 'info');
    }
    zu(); postfach(); speichern();
  }
  function verhandeln(id) {
    const a = finde(id); if (!a || !window.DFLTrade) return;
    zu();
    DFLTrade.vorbelegen(a.deal, { team: a.team, wert: a.interesse, ki: a.ki, spieler: a.art === 'spieler' ? a.spieler : null, pick: a.art === 'pick' ? a.pick : null, anfrage: a.id });
  }
  // Nach einem Trade: Anfragen, deren Spieler/Pick weg ist, erledigen sich; D99-Angebote: Spieler bekommen = angenommen
  // (beim anbietenden Verein), ein Teil deines Pakets ist weg = abgelaufen
  function nachTausch(deal) {
    offen().forEach(a => {
      if (a.art === 'angebot') {
        const teile = (a.deal.gibt.spieler || []).concat(a.deal.gibt.picks || []);
        if ((deal.bekommt.spieler || []).indexOf(a.spieler) >= 0) a.status = a.team === deal.an ? 'angenommen' : 'abgelaufen';
        else if ((deal.gibt.spieler || []).concat(deal.gibt.picks || []).some(id => teile.indexOf(id) >= 0)) a.status = 'abgelaufen';
        return;
      }
      const weg = (deal.gibt.spieler || []).indexOf(a.spieler) >= 0 || (deal.gibt.picks || []).indexOf(a.pick) >= 0;
      if (weg) a.status = a.team === deal.an ? 'angenommen' : 'abgelaufen';
    });
  }

  // ── Anzeige: Postfach und Detail (Blatt am Handy, Fenster am PC) ─────────
  // D78: Spieler der KI ohne Scout-Bericht nur mit Stufe statt Stärke (Texte „Name (POS, 82, 27 J.)“ aus DFLHandel)
  const sichtText = (t, B) => (window.DFLScouting && DFLScouting.aktiv() ? DFLScouting.teilText(t, B) : t);
  function zeile(L, txt) {
    const pick = /^Pick /.test(txt);
    return `<div class="ks-zeile"><span class="dfl-portrait klein anf-ico"><i class="ti ${pick ? 'ti-ticket' : 'ti-user'}" aria-hidden="true"></i></span>
      <span class="ks-wer"><b>${esc(pick ? txt.replace(/ · erwartet.*$/, '') : txt.split(' (')[0])}</b><small>${esc(pick ? (txt.match(/erwartet.*$/) || [''])[0] : (txt.indexOf(' (') >= 0 ? txt.slice(txt.indexOf(' (') + 2, txt.lastIndexOf(')')) : ''))}</small></span></div>`;
  }
  function detailHtml(a) {
    const L = welt(), B = teamVon(L, a.team), lg = H.lage(L, B, H.raenge(L)), stil = H.stilVon(B);
    const gibst = a.art === 'pick' ? [a.pickText] : [a.spielerName].concat((a.deal.gibt.picks || []).map(id => { const x = L.picks.find(k => k.id === id); return x ? 'Pick ' + H.pickText(L, x) : id; }));
    const cap = a.art === 'pick' ? `<div class="ks-ziel ok"><i class="ti ti-coin" aria-hidden="true"></i><span><b>Rookie-Cap ${a.pickText.match(/\d{4}/)[0]}: ${mio(a.rookieVorher)} → ${mio(a.rookieNachher)}</b><small>du rutschst im Draft nach unten und hast einen Pick mehr</small></span></div>` : '';
    return `<div class="ks-kopf"><b>${a.runde ? 'Neues Angebot' : 'Trade-Anfrage'}</b><small>${esc(B.name)} · ${esc(lg.text)}${stil ? ' · spielt ' + H.STIL_TEXT[stil] : ''}</small></div>
      <div class="ks-ziele"><div class="ks-ziel ok"><i class="ti ti-eye" aria-hidden="true"></i><span><b>${a.art === 'pick' ? 'Sie wollen im Draft nach oben' : 'Sie haben ' + esc(a.spielerName.split(' (')[0]) + ' im Auge'}</b>
        <small>${esc(a.grund || '')} · gültig bis KW ${a.bis}</small></span></div>${cap}</div>
      <div class="ks-titel">Du bekommst</div><div class="ks-liste">${a.teile.map(t => zeile(L, sichtText(t, B))).join('')}</div>
      <div class="ks-titel" style="margin-top:12px">Du gibst</div><div class="ks-liste">${gibst.map(t => zeile(L, t)).join('')}</div>
      ${window.DFLTrade && DFLTrade.kostenHtml ? DFLTrade.kostenHtml(a.deal) : ''}
      <div class="ks-hinweis">${a.runde ? `Nachgebessert${a.zusatz ? ' – neu dabei: ' + esc(a.zusatz) : ''}. Ein letztes Angebot.` : 'Lehnst du ab, kommen sie höchstens einmal mit einem besseren Angebot wieder.'}</div>
      <div class="app-blatt-aktionen anf-knoepfe" style="margin-top:12px">
        <button class="app-knopf haupt" onclick="DFLAnfragen.annehmen('${a.id}')"><i class="ti ti-check" aria-hidden="true"></i>Annehmen</button>
        <button class="app-knopf" onclick="DFLAnfragen.verhandeln('${a.id}')"><i class="ti ti-arrows-exchange" aria-hidden="true"></i>Verhandeln</button>
        <button class="app-knopf" onclick="DFLAnfragen.ablehnen('${a.id}')"><i class="ti ti-x" aria-hidden="true"></i>Ablehnen</button></div>`;
  }
  // D99: Blatt „Angebot“ (wie die Vorschau): Spieler mit Gesicht – fremd ohne Scout-Bericht nur mit Stufe (D78) –, warum er zu haben
  // ist, was für dich spricht (Lücke, Stil nur mit Bericht, Cap), Tausch, ihr Preis gegen dein Paket, Ansehen / Später / Kein Interesse
  const zahl1 = x => (Math.round((x || 0) / 1e5) / 10).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const gesicht = (p, T) => { try { return window.DFLIdentitaet ? DFLIdentitaet.gesichtSvg(p, T && T.farben ? { farben: T.farben } : null) : ''; } catch (e) { return ''; } };
  // Positionsmarke wie überall (D85: Farbe nach Mannschaftsteil, Nebenpositionen geteilt); ohne D85-Modul die alte Marke
  const posBadge = p => (window.DFLOberflaeche && DFLOberflaeche.posMarke ? DFLOberflaeche.posMarke(p)
    : `<span class="pos-badge-sm pos-${esc(posName(p.pos))}">${esc(posName(p.pos))}</span>`);
  function angebotHtml(a) {
    const L = welt(), B = teamVon(L, a.team), rang = H.raenge(L);
    const p = B && B.roster.find(x => x.id === a.spieler);
    if (!B || !p) return `<div class="ks-kopf"><b>Angebot</b><small>nicht mehr gültig</small></div><div class="ks-hinweis">Der Spieler ist nicht mehr bei diesem Verein.</div>`;
    const lg = H.lage(L, B, rang), stil = H.stilVon(B), SCx = window.DFLScouting && DFLScouting.aktiv() ? DFLScouting : null;
    const farbenB = B.farben || ((D.franchise(B.id) || {}).farben) || null, Tb = { farben: farbenB };
    const e = H.bewerte(L, a.deal), zh = (e.zuHaben || []).find(x => x.id === p.id), faktor = zh ? zh.faktor : a.faktor;
    const c = p.contract, hit = c ? c.base_salary + (c.guaranteed_bonuses || 0) : 0, rest = c ? c.years_remaining : 0;
    const staerke = SCx ? SCx.staerkeHtml(p, 'lang') : `<span class="sc-zahl">${p.ovr}</span>`;
    const pot = SCx ? SCx.potText(p) : String(window.DFLGenerator ? DFLGenerator.potSichtbar(p) : p.ovr);
    const chips = [`<span class="d99-chip gut"><i class="ti ti-plus" aria-hidden="true"></i>Lücke ${esc(posName(p.pos))}</span>`];
    const pa = SCx && SCx.hatBericht(p) && SCx.passung ? SCx.passung(p) : null;
    if (pa && pa.relevant) chips.push(`<span class="d99-chip ${pa.klasse === 'gut' ? 'gut' : pa.klasse === 'mittel' ? '' : 'warn'}"><i class="ti ti-target-arrow" aria-hidden="true"></i>${pa.pct} % · ${esc(pa.text)}</span>`);
    chips.push(e.cap.a.nachher <= e.cap.a.limit ? `<span class="d99-chip gut"><i class="ti ti-coin" aria-hidden="true"></i>Cap passt</span>`
      : `<span class="d99-chip warn"><i class="ti ti-coin" aria-hidden="true"></i>Cap zu knapp</span>`);
    const grund = a.zuHaben === 'weg' ? `${name(p)} will weg${(a.weg || []).length ? ': ' + a.weg.slice(0, 3).join(', ') : ''}.`
      : (a.gruende || []).map(g => g === 'cap' ? `${B.name} hat kaum Cap-Platz, er verdient mehr als sein Marktwert.` : g === 'neuaufbau' ? `${B.name} baut neu auf und gibt Erfahrene mit langem Vertrag ab.`
        : g === 'stil' ? `Er passt nicht zum ${H.STIL_TEXT[stil] || 'Stil'} von ${B.name} und sitzt auf der Bank.` : g === 'ueberschuss' ? `${B.name} hat auf ${posName(p.pos)} mehr Spieler als nötig.` : '').filter(Boolean).join(' ');
    const SQ = typeof SQUAD !== 'undefined' ? SQUAD : [];
    const teil = id => {
      const q = SQ.find(x => (x.dflId || x.id) === id);
      if (q) return `<div class="d99-teil"><span class="d99-gesicht" aria-hidden="true">${gesicht(q, null)}</span><span><b>${esc(kurz(q))}</b><small>${esc(posName(q.pos))} · ${q.ovr} · ${q.age} J.</small></span></div>`;
      const x = L.picks.find(k => k.id === id);
      if (!x) return '';
      const pw = H.pickWert(L, x, lg, rang);
      return `<div class="d99-teil pick"><i class="ti ti-ticket" aria-hidden="true"></i><span><b>${x.jahr} · Runde ${x.runde}</b><small>Pick ~${pw.platz}</small></span></div>`;
    };
    const gibst = (a.deal.gibt.spieler || []).concat(a.deal.gibt.picks || []).map(teil).join('');
    const max = Math.max(e.kiBraucht, e.kiErhaelt, 1), breite = v => Math.min(100, v / max * 100).toFixed(1);
    // D112: Stil-Zeichen (Typ öffentlich, Prozente mit Bericht – dfl_ebenen_patch.js)
    const sz = window.DFLEbenen && DFLEbenen.zeichenHtml ? DFLEbenen.zeichenHtml(p) : '';
    const ok = e.akzeptiert;
    return `<div class="ks-kopf"><b>Angebot</b><small>${esc(B.name)} · ${esc(lg.text)}${stil ? ' · spielt ' + esc(H.STIL_TEXT[stil]) : ''} · ${a.zuHaben === 'weg' ? 'will weg' : 'wird abgegeben'}</small></div>
      <div class="d99-angebot">
        <div class="d99-wer"><span class="d99-gesicht gross" aria-hidden="true">${gesicht(p, Tb)}</span><div class="d99-wer-text">
          <b>${esc(name(p))}${sz}</b><span class="d99-zeile">${posBadge(p)} ${staerke} <small>Pot. ${esc(pot)} · ${p.age} J. · ${zahl1(hit)} Mio € · noch ${rest} ${rest === 1 ? 'Jahr' : 'Jahre'}</small></span>
          <span class="d99-chips">${chips.join('')}</span></div></div>
        <p class="d99-warum">${esc(grund)}</p>
        <div class="d99-tausch"><div class="d99-seite"><small>Du gibst</small>${gibst || '<span class="leise">nichts</span>'}</div>
          <i class="ti ti-arrows-exchange d99-pfeil" aria-hidden="true"></i>
          <div class="d99-seite"><small>Du bekommst</small><div class="d99-teil"><span class="d99-gesicht" aria-hidden="true">${gesicht(p, Tb)}</span><span><b>${esc(kurz(p))}</b><small>${esc(posName(p.pos))} · ${p.age} J.</small></span></div></div></div>
        ${window.DFLChefscout ? DFLChefscout.urteilHtml(DFLChefscout.urteil(L, a.deal), { skala: false }) : ''}
        ${window.DFLTrade && DFLTrade.kostenHtml ? DFLTrade.kostenHtml(a.deal) : `<div class="d99-meter"><small>Cap danach ${zahl1(e.cap.a.nachher)} von ${zahl1(e.cap.a.limit)} Mio €</small></div>`}
        ${ok ? '' : `<div class="ks-hinweis d99-weg">So geht es nicht mehr: ${esc(e.grund)}</div>`}
        <div class="ks-hinweis">${a.spaeter ? 'Aufgehoben bis zum Ende des Wechselfensters.' : `Gültig bis KW ${a.bis} · „Später“ hebt es bis zum Ende des Wechselfensters auf.`}</div>
        <div class="app-blatt-aktionen d99-knoepfe anf-knoepfe">
          ${ok ? `<button class="app-knopf haupt" onclick="DFLAnfragen.annehmen('${a.id}')"><i class="ti ti-check" aria-hidden="true"></i>Annehmen</button>` : ''}
          <button class="app-knopf${ok ? '' : ' haupt'}" onclick="DFLAnfragen.ansehen('${a.id}')"><i class="ti ti-arrows-exchange" aria-hidden="true"></i>Umbauen</button>
          <button class="app-knopf" onclick="DFLAnfragen.spaeter('${a.id}')"${a.spaeter ? ' disabled' : ''}><i class="ti ti-clock-pause" aria-hidden="true"></i>Später</button>
          <button class="app-knopf" onclick="DFLAnfragen.keinInteresse('${a.id}')"><i class="ti ti-x" aria-hidden="true"></i>Kein Interesse</button></div>
      </div>`;
  }
  const shell = () => document.body && document.body.classList.contains('dfl-shell');
  function zeigen(id) {
    const a = finde(id); if (!a) return;
    const html = a.art === 'angebot' ? angebotHtml(a) : detailHtml(a);
    if (shell()) {
      const box = document.querySelector('#app-blatt .app-blatt-box'); if (!box) return;
      box.onclick = ev => { if (ev.target.closest('.app-blatt-zu')) zu(); };
      box.innerHTML = '<div class="app-griff"></div><button class="app-blatt-zu" aria-label="Schließen"><i class="ti ti-x" aria-hidden="true"></i></button>' + html;
      document.getElementById('app-blatt').classList.add('auf'); document.body.classList.add('app-gesperrt');
      if (window.DFLAppShell) try { DFLAppShell.cta(); } catch (e) { /* optional */ }
      return;
    }
    zu();
    const ov = document.createElement('div');
    ov.className = 'exp-overlay'; ov.id = 'anf-ov';
    ov.addEventListener('click', ev => { if (ev.target === ov) zu(); });
    ov.innerHTML = `<div class="exp-dialog anf-dialog">${html}</div>`;
    document.body.appendChild(ov);
  }
  function zu() {
    const ov = document.getElementById('anf-ov'); if (ov) ov.remove();
    const b = document.getElementById('app-blatt');
    if (b && b.classList.contains('auf') && b.querySelector('.ks-kopf') && /Anfrage|Angebot/.test(b.querySelector('.ks-kopf').textContent)) {
      b.classList.remove('auf'); document.body.classList.remove('app-gesperrt');
      if (window.DFLAppShell) try { DFLAppShell.cta(); } catch (e) { /* optional */ }
    }
  }
  // Postfach: offene Anfragen als Angebote
  {
    const _orig = window.buildPostfachItems;
    if (typeof _orig === 'function') {
      window.buildPostfachItems = function () {
        const items = _orig.apply(this, arguments);
        if (!dfl()) return items;
        try {
          const L = D.liga();
          // D99: die Meldung „Angebot: … bietet … an“ steht als Angebot oben (wie „Trade-Anfrage: …“ in dfl_bilder_patch.js) – nur ausblenden, nie umschreiben
          const doppelt = new Set(offenAngebote().map(a => a.meldung).filter(Boolean));
          if (doppelt.size) {
            for (let i = items.length - 1; i >= 0; i--) {
              const it = items[i];
              if (it.cat === 'news' && doppelt.has(String(it.title || '').replace(/^[^\p{L}\p{N}]+/u, '').trim())) items.splice(i, 1);
            }
          }
          offen().forEach(a => {
            const B = teamVon(L, a.team); if (!B) return;
            // D99: Angebot an dich – wer, warum, was sie wollen
            if (a.art === 'angebot') {
              items.push({ cat: 'offer', icon: '<i class="ti ti-user-plus"></i>',
                title: `${B.name} bietet dir ${a.spielerName.split(' (')[0]} an`,
                text: 'Sie wollen ' + a.teile.map(t => teilKurz(sichtText(t, B))).join(' + '),
                meta: `${esc(angebotGrund(a))} · Lücke auf ${esc(posName(a.pos || ''))} · ${a.spaeter ? 'bis Ende des Wechselfensters' : 'gültig bis KW ' + a.bis}`,
                actions: `<button class="pf-btn" onclick="DFLAnfragen.zeigen('${a.id}')">Ansehen</button>`,
                prio: 5, ts: Date.now() });
              return;
            }
            items.push({ cat: 'offer', icon: '<i class="ti ti-arrows-exchange"></i>',
              title: a.art === 'pick' ? `${a.runde ? 'Neues Angebot: ' : ''}${B.name} will deinen ${a.pickText.replace(/^Pick /, '').replace(/ · erwartet.*$/, '')}`
                : `${a.runde ? 'Neues Angebot: ' : ''}${B.name} will ${a.spielerName}`,
              text: 'Bietet ' + a.teile.map(t => sichtText(t, B).replace(/ · erwartet Pick ~/, ' ~#')).join(' + '),
              meta: `${esc(a.grund || '')} · gültig bis KW ${a.bis}`,
              actions: `<button class="pf-btn" onclick="DFLAnfragen.zeigen('${a.id}')">Ansehen</button>`,
              prio: 5, ts: Date.now() });
          });
        } catch (e) { console.warn('[DFL-Anfragen] Postfach', e); }
        return items;
      };
      try { buildPostfachItems = window.buildPostfachItems; } catch (e) { /* nur im Spiel */ }
    }
  }
  // Wochentakt
  {
    const _orig = window.advanceCalendarWeek;
    if (typeof _orig === 'function') {
      window.advanceCalendarWeek = function () {
        const vorher = dfl() ? LEAGUE.week : null;
        const r = _orig.apply(this, arguments);
        if (dfl() && LEAGUE.week !== vorher) { try { woche(); } catch (e) { console.warn('[DFL-Anfragen] Wochentakt', e); } }
        return r;
      };
      try { advanceCalendarWeek = window.advanceCalendarWeek; } catch (e) { /* nur im Spiel */ }
    }
  }

  window.DFLAnfragen = { CFG, woche, zeigen, annehmen, ablehnen, verhandeln, nachTausch, unverkaeuflich, istUnverkaeuflich,
    offene: () => (dfl() ? offen() : []), spielerAnfrage: () => spielerAnfrage(welt()), pickAnfrage: () => pickAnfrageNeu(welt()),
    // D99: Angebote an dich
    angebot: opt => angebotWoche(welt(), opt), ansehen, spaeter, keinInteresse, angebotGrund, angebotZustand: () => (dfl() ? angebotZustand() : null),
    offeneAngebote: () => (dfl() ? offenAngebote() : []) };
  console.log('%c[DFL-Anfragen v3] aktiv', 'color:#3fb950;font-weight:bold',
    '— KI-Vereine fragen an (Spieler; reine Pick-Tausche erst am Draft-Tag), Postfach, Annehmen/Verhandeln/Ablehnen, unverkäuflich; D99: Angebote an dich (Ansehen/Später/Kein Interesse, bis zu 2 je Woche)');
})();
