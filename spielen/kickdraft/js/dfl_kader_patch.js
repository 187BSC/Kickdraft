/* ═══════════════════════════════════════════════════════════════════════════
   DFL-KADER-PATCH  ·  v2   (Cap, Saisonwechsel der Welt, Draft, Free Agency, Development Squad)
   ─────────────────────────────────────────────────────────────────────────
     · Cap: Das Gehaltsbudget des Spiels ist der freie Platz unter dem Hard Cap
       (Spec 3.1: Lohn + Handgeld anteilig; Development Squad zählt mit, D45 statt C3).
       Der Cap wächst jede Saison (Konzept 9.6, Rollover höchstens 5 %, D101).
     · Die Liga lebt: Nach jeder Saison laufen für alle 31 KI-Teams Entwicklung,
       Ruhestand, Vertragsende und Verlängerungen (DFLSaison.phaseAbschluss).
     · Draft: 4 Runden, Reihenfolge nach Spec, getauschte Picks wählt der Besitzer.
       Die KI wählt nach eigenem Scouting und Kaderanalyse, Rookies kommen in ihre Kader.
     · Free Agency: Spieler ohne Vertrag aus der Welt; die KI-Teams unterschreiben in
       Wellen über das Sommerfenster (Wochen 2–5) – wer zögert, geht leer aus.
       Karrierestart (D74): alle Vereine mit 25, gut 150 Free Agents aller Altersstufen (DFLSaison.startMarkt).
     · Saisonvorbereitung vor Spieltag 1: KI-Teams füllen auf und schneiden auf 28 und
       unter den Cap; der eigene Verein muss selbst unter Cap und 28 kommen.
     · Development Squad (D45, früher Perspektivkader): 6 Plätze, bis 21 Jahre, zählt gegen den Cap
       (Spieler behalten ihren Vertrag), spielt nicht, entwickelt sich schneller als auf der Bank.
       Andere Teams können Talente mit Squad-Vertrag und großem Potenzial abwerben.
     · Mindestkader 21 (D46): Pflicht ab dem 1. Spieltag und während der Saison.
     · Zwei Torhüter (D136, 2026-10-14): Pflicht im Hauptkader vor dem 1. Spieltag (Kaderschnitt) und während der Saison
       (Entlassen, Development Squad, Woche weiter); Free-Agent-Liste auf eine Position filterbar (faFilter/faPos).
     · Scouting veraltet: 3 Saisons ohne Ausbau → eine Stufe weniger.
     · Draft-Board mit Uhr (D54, 2026-10-09): bei deinem Pick 60 Sekunden, dann wählt „Für mich wählen“
       (Scouting-Wert aus Stärke und Potenzial – die Stärke kennst du nur als Spanne); anhalten möglich;
       Top 5 der Medien mit Note, Spannen und Rookie-Gehalt, Antippen zeigt die Karte mit „Wählen“.
     · Saisonwechsel (D92/D93, 2026-10-10): ein Folgevertrag (p.vertragFolge) wird zum Vertragsende der laufende Vertrag,
       zum Saisonende vorgemerkte Entlassungen (CLUB.dfl.vorgemerkt) gehen danach – Dead Cap ganz in der neuen Saison;
       Cap je Saison als reine Rechnung (capNaechste, capHitSaison). Planung und Oberfläche: dfl_saisonwechsel_patch.js.
   Braucht: dfl_liga_patch.js (DFLSpiel), DFLGenerator, DFLSaison, DFLHandel. Lädt danach.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const G = window.DFLGenerator, S = window.DFLSaison, D = window.DFLSpiel, H = window.DFLHandel;
  if (!G || !S || !D || !H) { console.warn('[DFL-Kader] DFL-Module fehlen – Patch inaktiv'); return; }

  const START_CAP = 120000000, PICKS = 4 * 32, FA_START = 30, KADER = 28;
  const hatClub = () => typeof CLUB !== 'undefined' && CLUB;
  const dfl = () => !!(hatClub() && CLUB.dfl && CLUB.dfl.aktiv && typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.dfl);
  const mio = v => (Math.round(v / 1e5) / 10).toLocaleString('de-DE') + ' Mio €';
  const rng = n => G.rngAus(((CLUB.dfl.seed || 1) * n + (CLUB.dfl.saisonIndex || 0) * 7919 + (LEAGUE.week || 0)) >>> 0);
  const name = p => (p.firstName ? p.firstName + ' ' : '') + p.name;
  const teamName = id => id === 'fcm' ? CLUB.name : ((D.franchise(id) || {}).name || id);
  const neuerW = () => S.neuerWechsel({ ohne: [D.eigeneDflId()], cap: { aktiv: false } });
  const PK = () => G.CFG.perspektiv;
  const hauptkader = () => SQUAD.filter(p => !p.perspektiv && !p.onLoanAt && !p.verletztenliste);   // Verletztenliste zählt nicht gegen die 28 (D38)
  const perspektivkader = () => SQUAD.filter(p => p.perspektiv);
  const DS = 'Development Squad';
  const MIN = () => S.CFG.mindestKader || 21;
  // D136 (Nutzer 2026-10-14: „Ja TW Regel mit 2 pflicht ist top.“): mindestens 2 Torhüter im Hauptkader
  const TW_MIN = 2;
  const torhueter = () => hauptkader().filter(p => p.pos === 'TW');
  const twFehlt = () => Math.max(0, TW_MIN - torhueter().length);
  const twText = () => { const n = torhueter().length; return `Torhüter: ${n ? 'nur ' + n : 'keiner'} im Kader, ${TW_MIN} sind Pflicht`; };
  // Free-Agent-Liste auf eine Position filtern (z. B. Torhüter aus dem Kaderschnitt); transfermarkt_balance.js liest faPos()
  let faPosFilter = null;
  const faPos = () => faPosFilter;
  function faFilter(pos) { faPosFilter = pos || null; if (typeof window.renderFreeAgentList === 'function') { try { window.renderFreeAgentList(); } catch (e) { /* Liste fehlt */ } } }
  // Saison läuft (Spieltag 1 bis Playoffs): dann gilt der Mindestkader hart (D46); in der Offseason laufen Verträge aus
  const saisonLaeuft = () => typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.matchday >= 1;
  // 28er-Grenze: ab der Saisonvorbereitung (letzte Welle, Kaderschnitt der KI) bis Saisonende – sonst ließ sich nach der
  // Prüfung vor Spieltag 1 noch jemand verpflichten (Dynastie-Bot 2026-10-10: 29 Spieler am 1. Spieltag)
  const grenzeAktiv = () => saisonLaeuft() || (typeof CLUB !== 'undefined' && CLUB && CLUB.dfl && CLUB.dfl.vorbereitet === LEAGUE.season);
  // Vertrag des Squads (250.000 €) statt eigenem Vertrag – nur diese Spieler können abgeworben werden
  const dsVertrag = p => !!(p.dsVertrag || (p.contract && p.contract.art === 'perspektiv'));
  const render = () => ['renderAll', 'renderClubTab', 'renderTransferTab'].forEach(f => { if (typeof window[f] === 'function') { try { window[f](); } catch (e) { /* Ansicht optional */ } } });
  const speichern = () => { if (typeof saveGameState === 'function') saveGameState(); };

  // ── Cap ──────────────────────────────────────────────────────────────────
  const cap = () => (CLUB.dfl && CLUB.dfl.cap) || START_CAP;
  const capLimitBasis = () => (CLUB.dfl && CLUB.dfl.capLimit) || cap();
  // Werbe-Bonus (D56, dfl_werbung_patch.js): +1 Mio für die laufende Saison, nur der eigene Verein – zählt sofort überall mit
  const werbeBonus = () => (window.DFLWerbung && typeof DFLWerbung.bonus === 'function' ? DFLWerbung.bonus() : 0);
  // Cap +1 Mio aus dem Laden (D122, dfl_laden.js): 2 Winpunkte, nur die laufende Saison, nur der eigene Verein – mit D56 höchstens +2 Mio
  const ladenBonus = () => (window.DFLLaden && typeof DFLLaden.capBonus === 'function' ? DFLLaden.capBonus() : 0);
  const capLimit = () => capLimitBasis() + werbeBonus() + ladenBonus();
  // Cap Hit je Spieler: Lohn + Handgeld anteilig, solange der Ursprungsvertrag läuft; Development Squad zählt mit (D45).
  // „Heute gezahlt“ (D92, p.vorauszahlung) steht nicht hier, sondern wie Dead Cap beim Verein (CLUB.dfl.deadCap, deadCapBuchen):
  // bezahlt ist bezahlt – es bleibt bei Trade und Entlassung auf dem Cap dieser Saison, die Welt sieht es über dead_cap_total
  function capHitJahr(p) {
    const c = p.contract;
    const laeuft = c && c.years_total && p.dflVertragBis != null && LEAGUE.season <= p.dflVertragBis;
    const bonus = laeuft ? (c.signing_bonus_total || 0) / c.years_total : 0;
    // Garantierte Boni zählen mit (Spec 3.1) – eingetauschte KI-Verträge bringen sie mit; vorher rechnete der Tausch sie, das Spiel nicht
    return (p.wage || 0) * 52 + bonus + (laeuft ? (c.guaranteed_bonuses || 0) : 0);
  }
  // Folgevertrag (D92): beginnt nach dem alten Vertrag; Cap Hit je Jahr = Grundgehalt der Staffel + Rest-Handgeld ÷ Laufzeit
  function folgeHit(F, s) {
    const i = s - F.start, n = Math.max(1, F.jahre || 1);
    if (i < 0 || i >= n) return null;
    const by = F.base_salary_by_year || [];
    return (by[i] != null ? by[i] : (by[by.length - 1] || 0)) + Math.max(0, (F.signing_bonus_total || 0) - (F.vorab || 0)) / n + (F.guaranteed_bonuses || 0);
  }
  // Cap Hit in Saison s (Planung, D92) – wie das Spiel ihn dann rechnet: Staffel wie staffelWeiter, Handgeld anteilig, Folgevertrag
  function capHitSaison(p, s) {
    if (s === LEAGUE.season) return capHitJahr(p);
    const F = p.vertragFolge, f = F ? folgeHit(F, s) : null;
    if (f != null) return f;
    if (dsVertrag(p)) return s > LEAGUE.season && p.age + (s - LEAGUE.season) > PK().alterMax ? 0 : (p.wage || 0) * 52;   // Squad-Vertrag läuft jährlich weiter
    if (p.contractUntil == null || s > p.contractUntil || s < LEAGUE.season) return 0;
    const c = p.contract, laeuft = c && c.years_total && p.dflVertragBis != null && s <= p.dflVertragBis;
    if (!laeuft) return (p.wage || 0) * 52;
    const by = c.base_salary_by_year, rest = p.dflVertragBis - s + 1;
    const basis = Array.isArray(by) && by.length ? by[Math.max(0, Math.min(by.length - 1, (c.years_total || rest) - rest))] : (p.wage || 0) * 52;
    return basis + (c.signing_bonus_total || 0) / c.years_total + (c.guaranteed_bonuses || 0);
  }
  const capBelegt = () => SQUAD.reduce((s, p) => s + capHitJahr(p), 0) + ((CLUB.dfl && CLUB.dfl.deadCap) || 0);
  // Gehaltsbudget des Spiels = freier Cap-Platz pro Woche (ersetzt den Deckel aus den Einnahmen)
  function capSetzen() {
    if (!dfl()) return;
    G.setzeCap(cap());
    CLUB.wageBudget = Math.max(0, Math.floor((capLimit() - capBelegt()) / 52));
    CLUB.wageCap = Math.round(totalWeeklyWages(SQUAD) + CLUB.wageBudget);
  }
  // Neuer Cap zur nächsten Saison (wie DFLSaison) + Rollover des ungenutzten Platzes. Reine Rechnung (gleiche Saat), damit die
  // Saisonvorbereitung (D92) den Cap der nächsten Saison schon vorher zeigen kann
  function capNaechste() {
    const C = S.CFG.cap, idx = (CLUB.dfl.saisonIndex || 0) + 1;
    const r = G.rngAus(((CLUB.dfl.seed || 1) * 53 + idx) >>> 0);
    let w = C.wachstum + r.normal(0, C.streuung);
    if (idx % C.tvAlle === 0) w += C.tvSprung;
    if (r() < C.kriseChance) w = C.krise;
    const ungenutzt = Math.max(0, capLimitBasis() - capBelegt());       // Werbe-Bonus rollt nicht ins nächste Jahr
    const neu = Math.round(cap() * (1 + w) / 100000) * 100000;
    return { cap: neu, rollover: Math.round(Math.min(ungenutzt, S.CFG.rollover * neu)), wachstum: w, ungenutzt };
  }
  function capWachstum() {
    const n = capNaechste();
    CLUB.dfl.capVorjahr = cap();                                         // die Welt rechnet die alte Saison damit ab
    CLUB.dfl.cap = n.cap;
    CLUB.dfl.capLimit = n.cap + n.rollover;
    CLUB.dfl.deadCap = 0;
  }
  // Entlassung (Spec 3.2): das noch nicht verrechnete Handgeld zählt sofort als Dead Cap – beim Folgevertrag (D92) auch dessen
  // Handgeld (ohne den schon heute gezahlten Teil, der steht bereits im Cap dieser Saison)
  function deadCapVon(p) {
    const c = p.contract, F = p.vertragFolge;
    const folge = F ? Math.max(0, (F.signing_bonus_total || 0) - (F.vorab || 0)) : 0;
    if (!c || !c.years_total || p.dflVertragBis == null || LEAGUE.season > p.dflVertragBis) return Math.round(folge);
    return Math.round((c.signing_bonus_total || 0) / c.years_total * (p.dflVertragBis - LEAGUE.season + 1) + folge);
  }
  // Entlassung zum Saisonende (D93, vorgemerkt): Dead Cap ganz in der neuen Saison = Handgeld der Jahre nach dieser Saison (Spec 3.2)
  function deadCapNach(p) {
    const c = p.contract;
    if (!c || !c.years_total || p.dflVertragBis == null || p.dflVertragBis <= LEAGUE.season) return 0;
    return Math.round((c.signing_bonus_total || 0) / c.years_total * (p.dflVertragBis - LEAGUE.season));
  }
  // Dead Cap kostet das restliche Handgeld sofort als Geld (× 1,1 wie alle Kaderkosten, D41) – vorher nur anteilig der
  // Restwochen, nach der letzten Spielwoche gar nicht (Prüfung 2026-10-09). Plan-Basis wird angehoben, damit der
  // Wochenabgleich (dfl_finanz_patch.js) den Betrag nicht noch einmal rechnet. deadCapGeld: dieselbe Rechnung für die
  // Vorschau im Trade (Trade-Zentrale, Anfrage-Blatt)
  function deadCapGeld(betrag) {
    const stab = (window.DFLFinanzen && DFLFinanzen.CFG && DFLFinanzen.CFG.stab) || 1.1;
    return betrag > 0 ? Math.round(betrag * stab) : 0;
  }
  function deadCapBuchen(betrag) {
    if (!dfl() || !(betrag > 0)) return;
    CLUB.dfl.deadCap = (CLUB.dfl.deadCap || 0) + betrag;
    const geld = deadCapGeld(betrag);
    CLUB.budget -= geld;
    const bd = CLUB._budgetBreakdown;
    if (bd && bd.dflKader != null) { bd.dflKader += betrag; bd.dflAbweichung = (bd.dflAbweichung || 0) + geld; }
  }
  const frischGedraftet = p => !!(p.rookieVertrag && LEAGUE.dflDraft && p.rookieVertrag.jahr === LEAGUE.dflDraft.jahr && LEAGUE.matchday === 0);
  function ausKader(p) {
    if (typeof clearFromLineup === 'function') clearFromLineup(p.id);
    SQUAD.splice(SQUAD.indexOf(p), 1);
  }
  function entlassen(id) {
    if (!dfl()) return;
    const p = SQUAD.find(x => x.id === id);
    if (!p) return;
    const dead = deadCapVon(p);
    const untergrenze = saisonLaeuft() ? MIN() : 16;
    if (hauptkader().length <= untergrenze && !p.perspektiv) {
      alert(`Mindestens ${untergrenze} Spieler im Kader${saisonLaeuft() ? ' (Pflicht während der Saison)' : ''} – verpflichte erst jemanden oder hol einen Spieler aus dem ${DS} hoch.`); return;
    }
    // D136: während der Saison bleiben 2 Torhüter im Kader
    if (saisonLaeuft() && p.pos === 'TW' && !p.perspektiv && !p.verletztenliste && torhueter().length <= TW_MIN) {
      alert(`Mindestens ${TW_MIN} Torhüter müssen während der Saison im Kader bleiben – verpflichte erst einen oder hol einen aus dem ${DS} hoch.`); return;
    }
    // Ab dem Kaderschnitt gilt der Cap hart: das ganze Rest-Handgeld zählt sofort, das kann mehr sein als Gehalt + Anteil
    // dieser Saison – vorher ließ eine Entlassung den Verein über den Cap rutschen (Prüfung 2026-10-10: 115,1 → 122,1 Mio bei 115,6)
    const capNachher = capBelegt() - capHitJahr(p) + dead;
    if (grenzeAktiv() && capNachher > capLimit() + 1 && capNachher > capBelegt()) {
      alert(`${name(p)} jetzt zu entlassen, geht nicht: Sein restliches Handgeld (${mio(dead)}) zählt sofort als Dead Cap – danach lägst du bei ${mio(capNachher)} (Limit ${mio(capLimit())}). Erst anderswo Cap-Platz schaffen.`); return;
    }
    if (!confirm(`${name(p)} entlassen?\n\nSein Gehalt fällt weg. ` + (dead ? `Das restliche Handgeld (${mio(dead)}) zählt in dieser Saison sofort als Dead Cap.` : 'Es entsteht kein Dead Cap.') +
      (p.vertragFolge ? '\nSein Folgevertrag verfällt.' : ''))) return;
    ausKader(p);
    deadCapBuchen(dead);
    if (Array.isArray(CLUB.dfl.vorgemerkt)) CLUB.dfl.vorgemerkt = CLUB.dfl.vorgemerkt.filter(x => x !== p.id);   // D93: Marke weg
    // Er landet bei den Free Agents der Liga – andere Teams können ihn holen
    const L = D.liga(), w = D.spielZuDfl(p, LEAGUE.season);
    w.contract = null; w.teamId = null; w._exVerein = D.eigeneDflId(); delete w.sq; delete w.ir;   // Verletztenliste gilt nur im eigenen Kader
    L.freie.push(w);
    capSetzen();
    addNews('transfer', `✂️ Entlassen: ${name(p)}`, `${CLUB.shortName || CLUB.name} trennt sich von ${name(p)} (${p.pos}, OVR ${p.ovr}). ` +
      (dead ? `Dead Cap: ${mio(dead)}. ` : '') + `Cap: ${mio(capBelegt())} von ${mio(capLimit())} belegt.`);
    faSpiegel(); render(); speichern();
  }

  // ── Development Squad (eigener Verein, D45) ──────────────────────────────
  const pkTauglich = p => p.age <= PK().alterMax && p.ovr < PK().ovrMax;
  function inPerspektivkader(id) {
    const p = SQUAD.find(x => x.id === id);
    if (!dfl() || !p || p.perspektiv) return;
    if (!pkTauglich(p)) { alert(`In den ${DS} dürfen nur Spieler bis ${PK().alterMax} Jahre.`); return; }
    if (perspektivkader().length >= S.CFG.perspektiv) { alert(`Der ${DS} ist voll (${S.CFG.perspektiv} Plätze).`); return; }
    if (saisonLaeuft() && hauptkader().length <= MIN()) { alert(`Mindestens ${MIN()} Spieler müssen während der Saison im Kader bleiben.`); return; }
    if (saisonLaeuft() && p.pos === 'TW' && torhueter().length <= TW_MIN) { alert(`Mindestens ${TW_MIN} Torhüter müssen während der Saison im Kader bleiben.`); return; }
    if (typeof clearFromLineup === 'function') clearFromLineup(p.id);
    p.perspektiv = true;            // Vertrag bleibt: zählt weiter gegen den Cap, kein Dead Cap
    capSetzen();
    addNews('transfer', `🌱 ${DS}: ${name(p)}`, `${name(p)} (${p.age}, ${p.pos}) trainiert ab jetzt im ${DS}. Er behält seinen Vertrag (zählt gegen den Cap), ` +
      `spielt nicht, entwickelt sich aber schneller als auf der Bank – Spielzeit bringt noch mehr.`);
    render(); speichern();
  }
  function hochziehen(id) {
    const p = SQUAD.find(x => x.id === id);
    if (!dfl() || !p || !p.perspektiv) return;
    // Während der Saison gilt die 28er-Grenze immer (vorher erst vor Spieltag 1; Prüfung 2026-10-10: Kader mit 29–31 Spielern)
    if (hauptkader().length >= (grenzeAktiv() ? KADER : KADER + 2)) { alert(grenzeAktiv() ? `Ab dem Kaderschnitt höchstens ${KADER} Spieler im Kader – erst jemanden abgeben.` : 'Der Kader ist voll – erst jemanden abgeben.'); return; }
    if (!dsVertrag(p)) {
      // eigener Vertrag läuft weiter (D45): einfach zurück in den Kader
      p.perspektiv = false; capSetzen();
      addNews('transfer', `⬆️ Hochgezogen: ${name(p)}`, `${name(p)} ist zurück im Kader – mit seinem bisherigen Vertrag.`);
      render(); speichern(); return;
    }
    const lohn = Math.round(G.CFG.mindestgehalt / 52), mehr = lohn - (p.wage || 0);
    if ((CLUB.wageBudget || 0) < mehr) { alert(`Nicht genug Platz unter dem Cap: Ein Profivertrag kostet ${mio(G.CFG.mindestgehalt)} im Jahr.`); return; }
    p.perspektiv = false; p.dsVertrag = false; p.wage = lohn; p.contractUntil = LEAGUE.season + 1; p.dflVertragBis = null; p.contract = null;
    capSetzen();
    addNews('transfer', `⬆️ Hochgezogen: ${name(p)}`, `${name(p)} bekommt einen Profivertrag über 2 Jahre (${mio(G.CFG.mindestgehalt)} pro Jahr).`);
    render(); speichern();
  }
  // Saisonwechsel: wer zu alt für den Development Squad ist, kommt hoch (wenn Platz) oder geht; die Stärke entscheidest du (D45)
  function perspektivPruefen() {
    perspektivkader().forEach(p => {
      if (pkTauglich(p)) { if (dsVertrag(p)) p.contractUntil = LEAGUE.season; return; }
      if (!dsVertrag(p)) {
        p.perspektiv = false;
        addNews('transfer', `⬆️ ${name(p)} ist dem ${DS} entwachsen`, `${name(p)} (${p.age}, OVR ${p.ovr}) ist zurück im Kader – mit seinem bisherigen Vertrag.`);
        return;
      }
      const lohn = Math.round(G.CFG.mindestgehalt / 52);
      if (hauptkader().length < KADER + 2 && (capLimit() - capBelegt()) / 52 >= lohn) {
        p.perspektiv = false; p.dsVertrag = false; p.wage = lohn; p.contractUntil = LEAGUE.season + 1; p.dflVertragBis = null; p.contract = null;
        addNews('transfer', `⬆️ ${name(p)} ist dem ${DS} entwachsen`, `${name(p)} (${p.age}, OVR ${p.ovr}) bekommt automatisch einen Profivertrag über 2 Jahre.`);
      } else {
        ausKader(p);
        addNews('transfer', `👋 ${name(p)} verlässt den ${DS}`, `Zu alt für den ${DS}, aber kein Platz im Kader – er geht ablösefrei.`);
      }
    });
  }

  // ── Scouting veraltet (eigener Verein) ───────────────────────────────────
  function scoutingAltern() {
    const f = CLUB.facilities || (CLUB.facilities = {});
    const stufe = f.scouting || 5;
    if (CLUB.dfl.scoutingStufe != null && stufe > CLUB.dfl.scoutingStufe) CLUB.dfl.scoutingAlter = 0;
    else CLUB.dfl.scoutingAlter = (CLUB.dfl.scoutingAlter || 0) + 1;
    const zustand = window.DFLFinanzen && DFLFinanzen.anlagenAktiv && DFLFinanzen.anlagenAktiv();   // D75: geht im Zustand auf (dfl_anlagen_patch.js)
    if (!zustand && CLUB.dfl.scoutingAlter >= S.CFG.scoutingVeraltet && stufe > 1) {
      f.scouting = stufe - 1; CLUB.dfl.scoutingAlter = 1;
      addNews('club', '🔭 Scouting veraltet', `Seit ${S.CFG.scoutingVeraltet} Saisons wurde nicht ins Scouting investiert – die Konkurrenz hat aufgerüstet. ` +
        `Stufe ${stufe} → ${f.scouting}. Deine Einschätzungen im Draft und in der Kaderanalyse werden ungenauer.`);
    }
    CLUB.dfl.scoutingStufe = f.scouting || 5;
  }

  // ── Free Agency ──────────────────────────────────────────────────────────
  // Der vorhandene Markt „Ablösefrei“ (bundle_squad.js) zeigt die Free Agents der Welt.
  const FA = window.FreeAgents && window.FreeAgents.CFG;
  const faAlt = FA ? { poolTarget: FA.poolTarget, refreshPerWeek: FA.refreshPerWeek } : null;
  function faEinstellungen(an) {
    window.KADER_MAX = an ? undefined : KADER + S.CFG.perspektiv;      // 28 + 6
    if (!FA || !faAlt) return;
    FA.poolTarget = an ? faAlt.poolTarget : 0;
    FA.refreshPerWeek = an ? faAlt.refreshPerWeek : 0;
  }
  function forderungJahr(p, eigen) {
    const f = G.forderung(p, eigen, { eigenerVerein: p._exVerein === eigen.id, prestige: eigen.prestige || 0 });
    return Math.max(G.CFG.mindestgehalt, f.jahresWert);
  }
  // CLUB.freeAgents = Spiegel der Free Agents der Welt: die besten 60 + bis zu 15 junge Talente bis 23
  // (D74: zum Start gut 150 Spieler aller Altersstufen – vorher 40 + 10 bis 21, das zeigte fast nur die Stärksten)
  const SPIEGEL = { beste: 60, jung: 15, jungBis: 23 };
  function faSpiegel() {
    if (!dfl()) return;
    G.setzeCap(cap());
    const L = D.liga(), eigen = D.eigenSync() || L.teams.find(t => t.id === D.eigeneDflId());
    const liste = L.freie.slice().sort((a, b) => b.ovr - a.ovr);
    const zeigen = liste.slice(0, SPIEGEL.beste).concat(liste.slice(SPIEGEL.beste).filter(p => p.age <= SPIEGEL.jungBis).slice(0, SPIEGEL.jung));
    CLUB.freeAgents = zeigen.map(p => {
      const q = D.zuSpielSpieler(Object.assign({}, p, { wage: Math.round(forderungJahr(p, eigen) / 52), contract: null, contractUntil: 1 }));
      const her = p._exVerein ? 'zuletzt ' + teamName(D.spielId(p._exVerein)) : p.college ? p.college + ' (nicht gedraftet)' : 'vereinslos';
      return Object.assign(q, { id: 'fa_' + p.id, freeAgent: true, fee: 0, faWageDemand: q.wage, fromClub: her, dflVertragBis: null });
    });
  }
  // Start-Pool (Saison 1): Spieler ohne Vertrag mit Erfahrung, Forderung nach Marktwert. Seit D74 legt DFLSaison.startMarkt den
  // Markt schon beim Erzeugen der Welt an (Abgänge aller Vereine + erzeugte Free Agents) – dies hier ist nur der Rückfall,
  // falls der Start-Markt abgeschaltet ist (DFLSaison.CFG.start.aktiv = false: 28er-Kader + 30 Erfahrene wie vorher)
  function faStartpool(L) {
    if (L.startMarkt) return;
    const r = rng(17), idx = CLUB.dfl.saisonIndex || 0;
    const positionen = [];
    Object.entries(G.CFG.nachwuchs || G.CFG.kader).forEach(([pos, n]) => { for (let i = 0; i < n; i++) positionen.push(pos); });   // D95: LM/RM wie LF/RF
    const andere = L.teams.filter(t => t.id !== D.eigeneDflId());
    L.freie = L.freie || [];
    for (let i = 0; i < FA_START; i++) {
      const ex = r.pick(andere);
      const p = G.erzeugeSpieler(r, { id: 'fa' + idx, city: ex.city }, r.pick(positionen), Math.round(Math.max(60, Math.min(86, r.normal(70, 5)))), r.int(24, 33), i, L.namen);
      p.teamId = null; p.contract = null; p._exVerein = ex.id;
      L.freie.push(p);
    }
  }
  // Eine Welle der KI-Free-Agency (Wochen 2–5); die besten Unterschriften als Meldung
  function faWelle(anteil) {
    const L = D.welt(), W = neuerW();
    G.setzeCap(L.cap);
    const neu = S.phaseFreeAgency(L, rng(29), W, anteil);
    const gross = neu.filter(x => x.p.ovr >= 76).sort((a, b) => b.p.ovr - a.p.ovr).slice(0, 4);
    if (gross.length) addNews('transfer', `✍️ Free Agency: ${gross.length === 1 ? name(gross[0].p) + ' unterschreibt' : neu.length + ' Unterschriften'}`,
      gross.map(x => `${name(x.p)} (${x.p.pos}, OVR ${x.p.ovr}) → ${teamName(D.spielId(x.an))}`).join(' · ') + '.');
    faSpiegel(); D.weltGeaendert();
    return neu.length;
  }
  // Saisonvorbereitung: letzte Welle, dann füllen die KI-Teams auf und schneiden auf 28 / unter den Cap
  function vorbereitung() {
    if (CLUB.dfl.vorbereitet === LEAGUE.season) return;
    CLUB.dfl.vorbereitet = LEAGUE.season;
    faWelle(1);
    const L = D.welt(), W = neuerW();
    W.draftJahr = LEAGUE.dflDraft ? LEAGUE.dflDraft.jahr : null;
    S.phaseKader(L, rng(31), W);
    addNews('season', '📋 Kaderschnitt in der DKL', `Vor dem 1. Spieltag: ${W.st.entlassen} Spieler entlassen (Dead Cap ${mio(W.st.deadCap)}), ` +
      `${W.st.perspektiv} Junge in den ${DS}, ${W.st.hochgezogen} hochgezogen. Alle KI-Teams liegen unter dem Cap; ihre Kader richten sich nach der Lage ` +
      `(Titel jetzt 28, Mittelfeld 26, Neuaufbau 25 – Liga → „Lage“).`);
    faSpiegel(); D.weltGeaendert();
  }
  // Eigener Verein vor Spieltag 1: unter den Cap und höchstens 28 im Kader
  function startPruefung() {
    const fehler = [];
    if (capBelegt() > capLimit()) fehler.push(`Cap: ${mio(capBelegt())} belegt, Limit ${mio(capLimit())} – ${mio(capBelegt() - capLimit())} zu viel`);
    if (hauptkader().length > KADER) fehler.push(`Kader: ${hauptkader().length} Spieler, erlaubt sind ${KADER} (+ ${S.CFG.perspektiv} im ${DS})`);
    if (hauptkader().length < MIN()) fehler.push(`Kader: nur ${hauptkader().length} Spieler, mindestens ${MIN()} nötig`);
    if (twFehlt()) fehler.push(twText());
    if (perspektivkader().length > S.CFG.perspektiv) fehler.push(`${DS}: ${perspektivkader().length} von ${S.CFG.perspektiv}`);
    return fehler;
  }

  // ── Saisonwechsel der Welt ───────────────────────────────────────────────
  // Abschlusstabelle aus LEAGUE.dflPlayoffs (Spiel-IDs) in Welt-IDs
  function saisonDaten(L) {
    const po = LEAGUE.dflPlayoffs;
    if (!po || !po.tabelle) return null;
    const tabelle = {}, los = {}, aus = {}, werte = {};
    Object.keys(po.tabelle).forEach(id => { const d = D.dflIdVon(id); tabelle[d] = Object.assign({}, po.tabelle[id], { id: d }); los[d] = po.los[id]; });
    Object.keys(po.ausgeschieden || {}).forEach(id => { aus[D.dflIdVon(id)] = po.ausgeschieden[id]; });
    L.teams.forEach(t => { werte[t.id] = S.teamWerte(t); });
    return { saison: { tabelle, los, werte }, po: { ausgeschieden: aus } };
  }
  function weltSaisonwechsel() {
    const L = D.welt(), sd = saisonDaten(L);
    if (!sd) return;
    // Alte Saison mit dem alten Cap abrechnen (Ausgaben, Untergrenze, TV-Topf der KI), danach gilt der neue –
    // vorher lief alles schon mit dem Cap der nächsten Saison (Prüfung 2026-10-09: Nachzahlungen in Milliardenhöhe)
    L.cap = CLUB.dfl.capVorjahr || cap(); G.setzeCap(L.cap);
    const W = neuerW(); W.po = sd.po; W.neuerCap = cap();
    const rein = abgaengeEinsetzen(L);
    // Stimmung: Teamerfolg, Hype, Anlagen-Verlauf und Kern der alten Saison fortschreiben, danach die Unruhe (Kern weg ohne
    // Karriereende). Im Spiel blieb das seit dem Karrierestart stehen – Forderungen eigener Spieler rechneten immer mit dem Startrang.
    if (window.DFLStimmung) try { DFLStimmung.nachSaison(L, sd.saison, sd.po); } catch (e) { console.warn('[DFL-Kader] Stimmung', e); }
    try { S.phaseAbschluss(L, sd.saison, rng(3), W); }
    finally { abgaengeAbgeben(L, rein); }
    if (window.DFLStimmung) try { DFLStimmung.nachWechsel(L, W.st); } catch (e) { console.warn('[DFL-Kader] Stimmung', e); }
    L.cap = cap();
    // Abgeworbene eigene Squad-Spieler verlassen den Kader
    W.st.abgeworben.filter(x => x.von === D.eigeneDflId()).forEach(x => {
      const p = SQUAD.find(q => q.id === x.p.sq || q.dflId === x.p.id);
      if (!p) return;
      ausKader(p);
      addNews('transfer', `😬 Abgeworben: ${name(p)}`, `${teamName(D.spielId(x.an))} holt dein Talent ${name(p)} (${p.age}, ${p.pos}) aus dem ${DS} mit einem Profivertrag.`);
    });
    // Kurswechsel (Zielwert, D42): deutliche neue Richtung eines Vereins als Meldung – das Ziel selbst bleibt intern
    const wechsel = L.teams.filter(t => t.ziel && t.ziel.vorher != null && t.ziel.bis - (L.saisonIndex || 0) >= S.CFG.ziel.jahre[0]
      && t.ziel._gemeldet !== t.ziel.bis && Math.abs(t.ziel.wert - G.teamOvr(t)) >= 6);
    wechsel.slice(0, 3).forEach(t => {
      t.ziel._gemeldet = t.ziel.bis;
      const hoch = t.ziel.wert > G.teamOvr(t), n = teamName(D.spielId(t.id));
      addNews('season', hoch ? `📈 ${n} greift an` : `📉 Umbruch bei ${n}`, hoch
        ? `Neue Führung, neue Ziele: ${n} will in den nächsten Jahren nach oben – mit klugen Drafts, gezielten Verpflichtungen und harten Verhandlungen.`
        : `${n} steht vor unruhigen Jahren: Leistungsträger wollen weg, Entscheidungen wirken fragwürdig. Für Trades kann sich ein Anruf lohnen.`);
    });
    const fremd = W.st.abgeworben.filter(x => x.von !== D.eigeneDflId()).length;
    addNews('season', '🔄 Offseason in der DKL', `${W.st.ruhestand} Karriereenden, ${W.st.verlaengert} Verlängerungen, ${L.freie.length} Spieler ohne Vertrag. ` +
      (fremd ? `${fremd} ${fremd === 1 ? 'Talent' : 'Talente'} aus dem ${DS} abgeworben. ` : '') + (window.DFLFinanzen ? (DFLFinanzen.anlagenAktiv && DFLFinanzen.anlagenAktiv()
        ? `Die Vereine haben ${W.st.ausbau || 0}× ausgebaut und ${W.st.saniert || 0}× saniert, ${W.st.verfall || 0} ${W.st.verfall === 1 ? 'Anlage hat' : 'Anlagen haben'} eine Stufe verloren.`
        : `Die Vereine haben ${W.st.ausbau || 0}× in Anlagen investiert, ${W.st.scouting.ab} Scouting-Abteilungen sind veraltet.`) : `Scouting: ${W.st.scouting.auf} Teams haben aufgerüstet, ${W.st.scouting.ab} sind veraltet.`));
  }

  // ── Draft ────────────────────────────────────────────────────────────────
  let wDraft = null;
  const talente = () => { const L = D.liga(); return L.draft ? L.draft.talente : []; };
  const amZug = d => d.nr < PICKS ? d.slots[d.nr].besitzer : null;
  // start (D108, dfl_startdraft.js): Reihenfolge der stillen Vorsaison (Spiel-IDs) für den ersten Draft vor Saison 1
  function draftVorbereiten(start) {
    const L = D.liga(), po = LEAGUE.dflPlayoffs;
    if (!L.draft || (!start && (!po || !po.tabelle))) return;
    H.picks(L);
    const reihenfolge = start ? start.slice() : S.draftReihenfolge({ teams: Object.keys(po.tabelle).map(id => ({ id })) }, { tabelle: po.tabelle, los: po.los }, { ausgeschieden: po.ausgeschieden });
    const jahr = L.draft.jahr, slots = [];
    for (let nr = 0; nr < PICKS; nr++) {
      const runde = Math.floor(nr / 32) + 1, von = reihenfolge[nr % 32];
      slots.push({ von, besitzer: D.spielId(H.pickBesitzer(L, jahr, runde, D.dflIdVon(von))) });
    }
    // D51: künftige Picks zum Draft-Start merken (Draft-Noten zählen Gewinn/Verlust aus Draft-Trades mit)
    const rang = H.raenge(L), zukunft = {};
    (L.picks || []).filter(x => x.jahr > jahr).forEach(x => { zukunft[x.id] = [x.besitzer, H.pickWert(L, x, null, rang).wert]; });
    LEAGUE.dflDraft = Object.assign({ jahr, slots, nr: 0, picks: [], fertig: false, zukunft }, start ? { start: true } : {});
    wDraft = null;
  }
  // Scouting-Einschätzung des eigenen Vereins: je besser, desto enger die Spanne (fest je Talent)
  function schaetzung(t, voraus) {
    const sc = (CLUB.facilities && CLUB.facilities.scouting) || 5;
    const r = G.rngAus(Math.floor((t.seed || 0.5) * 1e9) >>> 0);
    const b1 = Math.max(1, 7 - Math.round(sc / 2)) + (voraus || 0) * 2, b2 = Math.max(2, 12 - sc) + (voraus || 0) * 3;
    const ovr = typeof computeOvrFromAreas === 'function' ? computeOvrFromAreas(t) : t.ovr;      // Spiel-Skala wie nach dem Draft
    // Rohdiamant: das Board sieht die alte Einschätzung, bis ein Scout ihn entdeckt (G.potSichtbar)
    const o = ovr + Math.round(r.normal(0, b1 / 2)), p = ovr + (G.potSichtbar(t, sc) - t.ovr) + Math.round(r.normal(0, b2 / 2));
    return { ovr: [o - b1, Math.min(99, o + b1)], pot: [Math.max(o, p - b2), Math.min(99, p + b2)], wert: 0.45 * o + 0.55 * p };
  }
  const verfuegbar = () => talente().slice().sort((a, b) => a.medien.rang - b.medien.rang);

  // ── Verborgene Nieten (D103): angezeigt wird die alte Hoffnung, entwickelt wird nach dem echten Potenzial ──
  // potentialRange (engine_main.js) ist eine globale Funktion: Spieler-Blatt, FUT-Sterne, Kaderliste, Free Agents und
  // Trainingsgruppe lesen sie zur Laufzeit – ein Wrapper reicht.
  if (typeof window.potentialRange === 'function') {
    const _origRange = window.potentialRange;
    window.potentialRange = function (player, scoutLevel) {
      if (!player || !(player.niete || player.diamant) || !dfl()) return _origRange.apply(this, arguments);
      const sc = scoutLevel || (CLUB.facilities && CLUB.facilities.scouting) || 5, s = G.potSichtbar(player, sc);
      if (s === player.truePotential) return _origRange.apply(this, arguments);
      return _origRange.call(this, Object.assign({}, player, { truePotential: s }), scoutLevel);
    };
  }

  // ── Draft-Trades (Wunsch 2026-10-08): hochtraden mit Picks bis 4 Jahre im Voraus ──
  const pickIdVon = (d, i) => d.jahr + '-' + (Math.floor(i / 32) + 1) + '-' + D.dflIdVon(d.slots[i].von);
  function slotKarte(d) { const m = new Map(); d.slots.forEach((s, i) => m.set(pickIdVon(d, i), i + 1)); return m; }
  const drng = (d, n) => G.rngAus(((CLUB.dfl.seed || 1) * n + d.jahr * 13 + d.nr * 7) >>> 0);
  // Wie sehr ein KI-Team ein Talent will: eigenes Scouting + Kaderbedarf
  function wunsch(T, t, d) {
    if (!wDraft) { wDraft = neuerW(); wDraft.draftJahr = d.jahr; }
    const sc = (T.anlagen && T.anlagen.scouting) || 5, saat = (CLUB.dfl.saisonIndex || 0) * 101;
    const an = wDraft.analyse[T.id] = wDraft.analyse[T.id] || G.kaderAnalyse(T, { scouting: sc, saat });
    const u = G.draftUrteil(T, t, an, sc, saat);
    // D159 (c): ein wahres Draft-Gerücht macht das Talent für diesen Verein zum Wunschkandidaten (Hochtraden, Fenster D94)
    const DB = window.DFLDraftboard, plus = DB && DB.wunschBonus ? DB.wunschBonus(T.id, t.id, d) : 0;
    return u.wert + u.passt + plus;
  }
  // Will ein Team mit späterem Pick an Slot i hoch? Lohnt sich, wenn sein Wunschtalent jetzt klar besser ist
  // als das, was es an der eigenen Stelle noch erwarten kann.
  // opt: { n: wie viele Interessenten, minLuecke: wie klar das Wunschtalent besser sein muss (Standard 3) }
  function hochtradenKandidaten(d, i, ausschluss, opt) {
    opt = opt || {};
    const n = opt.n || 1, minL = opt.minLuecke != null ? opt.minLuecke : 3;
    const L = D.liga(), verf = verfuegbar(), r = drng(d, 17);
    const kand = [], aus = [];
    for (let k = i + 4; k < Math.min(PICKS, i + 24); k++) {
      const b = d.slots[k].besitzer;
      if (b !== 'fcm' && b !== d.slots[i].besitzer && b !== ausschluss && !kand.some(x => x.b === b)) kand.push({ b, k });
    }
    for (const { b, k } of kand.sort(() => r() - 0.5).slice(0, Math.max(4, n * 4))) {
      if (aus.length >= n) break;
      const T = L.teams.find(t => t.id === D.dflIdVon(b));
      const sicht = verf.slice(0, 12).map(t => ({ t, w: wunsch(T, t, d) })).sort((x, y) => y.w - x.w);
      const spaeter = verf.slice(k - i, k - i + 6).map(t => wunsch(T, t, d));
      if (!sicht.length || sicht[0].w - Math.max(0, ...spaeter) < minL) continue;
      const paket = H.hochtradenPaket(L, T, i + 1, i + 1, slotKarte(d));
      if (paket) aus.push({ b, T, ziel: sicht[0].t, paket, rookie: rookieCap(d, i, paket) });
    }
    return aus;
  }
  const hochtradenKandidat = (d, i, ausschluss, opt) => hochtradenKandidaten(d, i, ausschluss, Object.assign({}, opt, { n: 1 }))[0] || null;
  // Rookie-Cap (Skala) des Slots gegen die Picks dieses Drafts im Paket – nach unten tauschen spart meist Cap
  function rookieCap(d, i, paket) {
    const sk = slotKarte(d);
    return { vorher: G.rookieCapHit(i + 1), nachher: paket.picks.filter(id => sk.has(id)).reduce((s, id) => s + G.rookieCapHit(sk.get(id)), 0) };
  }
  // Wie klar ist das Wunschtalent des Slot-Besitzers jetzt besser als das, was ab Slot `ab` noch da wäre?
  function favoritLuecke(d, i, O, ab) {
    const verf = verfuegbar();
    const jetzt = verf.slice(0, 12).map(t => wunsch(O, t, d)).sort((a, b) => b - a)[0] || 0;
    const spaeter = verf.slice(Math.max(1, ab - i), Math.max(1, ab - i) + 8).map(t => wunsch(O, t, d));
    return jetzt - Math.max(0, ...spaeter);
  }
  // Nach unten tauschen (Wunsch 2026-10-09): der Slot-Besitzer prüft das Paket. Mit klarem Favoriten nur gegen
  // deutlichen Aufpreis; im Neuaufbau (mehr Picks) oder knapp am Cap (teurer Rookie-Vertrag) schon zum Gegenwert.
  function verkaeuferWill(d, i, k) {
    const L = D.liga(), O = L.teams.find(t => t.id === D.dflIdVon(d.slots[i].besitzer));
    if (!O) return true;
    const sk = slotKarte(d), naechster = Math.min(...k.paket.picks.filter(id => sk.has(id)).map(id => sk.get(id) - 1));
    const luecke = favoritLuecke(d, i, O, isFinite(naechster) ? naechster : i + 32);
    const lg = H.lage(L, O, H.raenge(L)), capFrei = O.salary_cap_limit - G.capHitTeam(O);
    let faktor = luecke >= 3 ? 1.3 : luecke >= 1.5 ? 1.12 : 1.0;
    if (lg.key === 'neuaufbau') faktor -= 0.05;
    if (capFrei < G.rookieGehalt(i + 1)) faktor -= 0.05;
    return k.paket.wert >= H.pickWertNr(i + 1) * faktor;
  }
  // Sucht der Slot-Besitzer selbst einen Abnehmer? Kein klarer Favorit und (Neuaufbau oder knapp am Cap)
  function verkaeuferSucht(d, i) {
    const L = D.liga(), O = L.teams.find(t => t.id === D.dflIdVon(d.slots[i].besitzer));
    if (!O) return false;
    const lg = H.lage(L, O, H.raenge(L)), capFrei = O.salary_cap_limit - G.capHitTeam(O);
    return favoritLuecke(d, i, O, i + 6) < 1 && (lg.key === 'neuaufbau' || capFrei < G.rookieGehalt(i + 1) * 1.5);
  }
  // Tausch ausführen: Slot i geht an `nach`, die Picks des Pakets an den bisherigen Besitzer
  function pickTausch(d, i, nach, paketIds) {
    const L = D.liga(), von = d.slots[i].besitzer, jetztId = pickIdVon(d, i);
    const pk = L.picks.find(x => x.id === jetztId); if (pk) pk.besitzer = D.dflIdVon(nach);
    d.slots[i].besitzer = nach;
    paketIds.forEach(id => {
      const x = L.picks.find(p => p.id === id); if (x) x.besitzer = D.dflIdVon(von);
      d.slots.forEach((s, j) => { if (pickIdVon(d, j) === id) s.besitzer = von; });
    });
    (L.handel = L.handel || []).push({ jahr: d.jahr, draft: true, von: D.dflIdVon(nach), an: D.dflIdVon(von), gibt: { spieler: [], picks: paketIds }, bekommt: { spieler: [], picks: [jetztId] } });
    return von;
  }
  function tradeText(d, i, nach, von, paket, ziel, rookie) {
    return `${teamName(nach)} ↑ #${i + 1} von ${teamName(von)} für ${paket.texte.join(' + ')}` + (ziel ? ` · ${name(ziel)} (${ziel.pos}, ${ziel.age})` : '');
  }
  function kiHochtraden(d) {
    if (d.nr >= 64 || (d.tradeups || 0) >= 8 || amZug(d) === 'fcm') return;
    // Ein Pick, der bei diesem Slot schon den Besitzer gewechselt hat, wird nicht sofort weiterverkauft (Prüfung 2026-10-09)
    if (d.slots[d.nr] && d.slots[d.nr].ziel) return;
    // Wer ohne klaren Favoriten im Neuaufbau oder knapp am Cap am Zug ist, sucht selbst einen Abnehmer (tauscht nach unten)
    const sucht = verkaeuferSucht(d, d.nr);
    if (drng(d, 5)() > (sucht ? 0.6 : 0.3)) return;
    const k = hochtradenKandidat(d, d.nr, null, { minLuecke: sucht ? 1.5 : 3 });
    if (!k || !verkaeuferWill(d, d.nr, k)) return;
    const von = pickTausch(d, d.nr, k.b, k.paket.picks);
    d.slots[d.nr].ziel = k.ziel.id;
    d.tradeups = (d.tradeups || 0) + 1;
    (d.trades = d.trades || []).push(tradeText(d, d.nr, k.b, von, k.paket, k.ziel, k.rookie));
  }
  // Auto-Wahl für dich („Für mich wählen“, „Rest automatisch“): bester Wert aus deinem Scouting, dazu der Bedarf nach dem Kader-Soll
  // deiner Formation (+2 je fehlendem Spieler, −2 je Überhang); Torhüter höchstens 3 im ganzen Kader (Spieltest 2026-10-13:
  // „Rest automatisch“ nahm 2 Torhüter, danach 5 im Kader)
  // D136: fehlen im Hauptkader Torhüter bis zur Pflicht (2), zählt der beste verfügbare Torhüter mit und bekommt je fehlendem +twPflicht
  const AUTO = { bedarf: 2, ueberhang: 2, kandidaten: 16, twMax: 3, twPflicht: 6 };
  function eigeneAutoWahl() {
    const pos = p => (G.dflPos ? G.dflPos(p.pos) : p.pos);
    const soll = (G.kaderSoll ? G.kaderSoll({ formation: typeof CLUB !== 'undefined' && CLUB ? CLUB.formation : null }) : G.CFG.kader) || {};
    const ist = {};
    SQUAD.forEach(p => { if (!p.onLoanFrom) { const k = pos(p); ist[k] = (ist[k] || 0) + 1; } });
    const twLuecke = Math.max(0, TW_MIN - SQUAD.filter(p => !p.onLoanFrom && !p.perspektiv && pos(p) === 'TW').length);
    const kand = verfuegbar().slice(0, AUTO.kandidaten);
    if (twLuecke) { const tw = verfuegbar().find(t => pos(t) === 'TW'); if (tw && kand.indexOf(tw) < 0) kand.push(tw); }
    const wert = t => {
      const k = pos(t), n = ist[k] || 0, s = soll[k] || 0;
      if (k === 'TW' && n >= AUTO.twMax && !twLuecke) return -Infinity;
      return schaetzung(t).wert + (k === 'TW' ? AUTO.twPflicht * twLuecke : 0) + (n < s ? AUTO.bedarf * Math.min(2, s - n) : -AUTO.ueberhang * Math.min(3, n - s));
    };
    const best = kand.map(t => ({ t, w: wert(t) })).filter(x => x.w > -Infinity).sort((a, b) => b.w - a.w)[0];
    return best ? best.t : kand[0];
  }
  function rookieVerpflichten(t, pick, runde) {
    G.setzeCap(cap());
    const contract = G.baueVertrag({ jahresWert: G.rookieGehalt(pick), jahre: G.CFG.rookie.jahre, rest: G.CFG.rookie.jahre,
      staffelung: 'steigend', handgeldAnteil: G.CFG.rookie.handgeld[runde - 1], art: 'rookie' });
    const roh = Object.assign({}, t, { contract, wage: Math.round(contract.base_salary / 52) });
    ['medien', '_wert', '_medienWert', 'kombine'].forEach(k => delete roh[k]);
    // D103: verborgene Niete – dieselbe Regel wie bei der KI; D159: nicht beim Wunschspieler der Tutorial-Mission
    if (!(window.DFLMissionen && DFLMissionen.istWunsch && DFLMissionen.istWunsch(t.id))) G.nieteWuerfeln(roh, runde);
    const q = D.zuSpielSpieler(roh);
    Object.assign(q, { rookieVertrag: { pick, runde, jahr: LEAGUE.dflDraft.jahr }, college: t.college, acquiredSeason: LEAGUE.season });
    SQUAD.push(q);
    if (typeof assignBirthday === 'function') assignBirthday(q);
    if (typeof assignShirtNumbers === 'function') { try { assignShirtNumbers(); } catch (e) { /* optional */ } }
    return q;
  }
  function waehle(d, t) {
    const L = D.liga(), slot = d.slots[d.nr], pick = d.nr + 1, runde = Math.floor(d.nr / 32) + 1;
    const liste = L.draft.talente;
    // Rookie-Pack (kickstil_draftpack.js): Note und Kaderlücke im Moment des eigenen Picks, solange das Talent im Jahrgang steht
    const info = slot.besitzer === 'fcm' && window.KSDraftPack ? KSDraftPack.pickInfo(L, t, pick) : {};
    liste.splice(liste.indexOf(t), 1);
    d.picks.push(Object.assign({ pick, runde, team: slot.besitzer, von: slot.von, id: t.id, name: name(t), pos: t.pos, age: t.age, medien: t.medien ? t.medien.rang : null }, info));
    if (slot.besitzer === 'fcm') rookieVerpflichten(t, pick, runde);
    else {
      const team = L.teams.find(x => x.id === D.dflIdVon(slot.besitzer));
      G.setzeCap(L.cap);
      S.rookieUnterschreiben(L, team, t, pick, runde, d.jahr, D.dflIdVon(slot.von));
    }
    d.nr++;
  }
  // D159: dfl_draftboard.js kann eingreifen – wahres Gerücht (der Verein greift zu, wenn das Talent da ist) und der Wunschspieler
  // der Tutorial-Mission (im ersten Draft überspringt ihn die KI, bis du deinen ersten Pick gemacht hast); sonst unverändert
  function npcWahl(d) {
    const DB = window.DFLDraftboard, hk = DB && DB.kiHaken ? DB.kiHaken(d, amZug(d), verfuegbar()) : null;
    const verf = hk && hk.verf ? hk.verf : verfuegbar();
    const ziel = d.slots[d.nr].ziel && verf.find(t => t.id === d.slots[d.nr].ziel);
    if (ziel) return ziel;
    if (hk && hk.zwang) return hk.zwang;
    const L = D.liga(), team = L.teams.find(x => x.id === D.dflIdVon(amZug(d)));
    if (!wDraft) { wDraft = neuerW(); wDraft.draftJahr = d.jahr; }
    return S.npcWahl(L, team, verf, G.rngAus(((CLUB.dfl.seed || 1) * 131 + d.jahr * 7 + d.nr) >>> 0), wDraft);
  }
  // modus: 'eins' = ein KI-Pick, 'bisIch' = bis du dran bist, 'alles' = ganzer Rest (deine Picks per Scouting)
  function simulieren(d, modus) {
    let n = 0;
    while (d.nr < PICKS) {
      kiHochtraden(d);
      if (amZug(d) === 'fcm') { if (modus !== 'alles') break; waehle(d, eigeneAutoWahl()); }
      else { waehle(d, npcWahl(d)); n++; if (modus === 'eins') break; }
    }
    if (d.nr >= PICKS && !d.fertig) abschliessen(d);
    return n;
  }
  // D94 (2026-10-10): Fenster, wenn ein Verein deinen Pick unbedingt will – sein Favorit steht unter den ersten 3 des
  // Boards und an seinem eigenen Platz wäre er klar schwächer ersetzt (Lücke ≥ 4 in seiner Wertung). Er bietet das für
  // ihn günstigste Paket über Wert + 5 % + Aufschlag (Lücke 4 → +10 %, je Punkt +5 %, höchstens +30 %), 20 Sekunden,
  // die Draft-Uhr steht so lange, einmal nachbessern (+1 Pick, mind. +5 %, höchstens Ziel × 1,12).
  const FENSTER = { favRang: 3, luecke: 4, aufschlag: 0.10, jePunkt: 0.05, aufschlagMax: 0.30, sekunden: 20, plus: 0.05, grenze: 1.12, bisPick: 96 };
  function unbedingtKandidat(d) {
    const i = d.nr, L = D.liga(), verf = verfuegbar();
    let best = null;
    const gesehen = new Set();
    for (let k = i + 4; k < Math.min(PICKS, i + 24); k++) {
      const b = d.slots[k].besitzer;
      if (b === 'fcm' || b === d.slots[i].besitzer || gesehen.has(b)) continue;
      gesehen.add(b);
      const T = L.teams.find(t => t.id === D.dflIdVon(b));
      if (!T) continue;
      const sicht = verf.slice(0, 12).map(t => ({ t, w: wunsch(T, t, d) })).sort((x, y) => y.w - x.w);
      if (!sicht.length) continue;
      const favRang = verf.indexOf(sicht[0].t) + 1;
      if (favRang > FENSTER.favRang) continue;
      const luecke = sicht[0].w - Math.max(0, ...verf.slice(k - i, k - i + 6).map(t => wunsch(T, t, d)));
      if (luecke >= FENSTER.luecke && (!best || luecke > best.luecke)) best = { b, k, T, ziel: sicht[0].t, luecke, favRang };
    }
    if (!best) return null;
    const aufschlag = Math.min(FENSTER.aufschlagMax, FENSTER.aufschlag + (best.luecke - FENSTER.luecke) * FENSTER.jePunkt);
    const paket = H.hochtradenPaket(L, best.T, i + 1, i + 1, slotKarte(d), { aufschlag: 1 + aufschlag });
    return paket ? Object.assign(best, { aufschlag, paket }) : null;
  }
  const fensterOffen = d => !!(d && !d.fertig && d.fenster && d.fenster.nr === d.nr && d.fenster.phase === 'offen' && amZug(d) === 'fcm');
  // Ein KI-Team will deinen Pick: einmal je Pick ein Angebot
  // Nach unten tauschen (Wunsch 2026-10-09): bis zu 3 Angebote für deinen Pick – jeweils mindestens zwei schwächere Picks
  function angebotFuerMich(d) {
    if (d.angebotNr === d.nr) return d.angebote || [];
    d.angebotNr = d.nr; d.angebote = []; d.fenster = null;
    if (d.nr < FENSTER.bisPick) {
      const f = unbedingtKandidat(d), mein = Math.round(H.pickWertNr(d.nr + 1) * 10) / 10;
      if (f) d.fenster = { nr: d.nr, b: f.b, slot: f.k + 1, ziel: f.ziel.id, luecke: Math.round(f.luecke * 10) / 10, aufschlag: f.aufschlag,
        paket: f.paket, grenze: f.paket.ziel * FENSTER.grenze, mein, rookie: rookieCap(d, d.nr, f.paket), rest: FENSTER.sekunden, phase: 'offen', nachgebessert: false, notiz: '' };
      // Die Liste darunter ohne den Verein im Fenster (er hat schon sein bestes Angebot gemacht)
      d.angebote = hochtradenKandidaten(d, d.nr, f ? f.b : null, { n: 3, minLuecke: 2 })
        .map(k => ({ b: k.b, ziel: k.ziel.id, picks: k.paket.picks, texte: k.paket.texte, wert: k.paket.wert, mein, rookie: k.rookie }));
    }
    d.angebot = d.angebote[0] || null;
    return d.angebote;
  }
  // Fenster zeichnen (über dem Board; nur solange es offen ist)
  // D120: Urteil des Chefscouts (Symbol + Wort) statt Wertzahlen beim Draft-Tausch
  const csChip = (q, key) => (window.DFLChefscout && DFLChefscout.urteilQuote ? DFLChefscout.urteilChip(DFLChefscout.urteilQuote(q, key)) : '');
  function fensterHtml(d) {
    const f = d.fenster, t = talente().find(x => x.id === f.ziel), p = f.paket, max = Math.max(p.wert, f.mein, 1);
    const faktor = p.wert / f.mein, sk = slotKarte(d);
    const rookieNach = p.picks.filter(id => sk.has(id)).reduce((s, id) => s + G.rookieCapHit(sk.get(id)), 0);
    const kurz = (D.franchise(f.b) || {}).kurz || '';
    return `<div class="dfl-fenster-scrim"><div class="dfl-fenster" id="dfl-fenster" role="dialog" aria-modal="true" aria-labelledby="dfl-fenster-titel" tabindex="-1" onkeydown="if (event.key === 'Escape') DFLKader.fenster('ab')">
      <div class="dfl-fenster-kopf"><span class="lg-crest dfl-fenster-wappen" style="${typeof crestStyle === 'function' ? crestStyle(f.b) : ''}" aria-hidden="true">${typeof crestInitials === 'function' ? crestInitials(teamName(f.b)) : kurz}</span>
        <span class="dfl-fenster-titel"><small>Anruf · Pick #${f.slot} will hoch</small><b id="dfl-fenster-titel">${teamName(f.b)} wollen deinen Pick #${d.nr + 1}</b></span>
        ${fensterUhrHtml(f)}</div>
      ${t ? `<div class="dfl-fenster-geruecht">Gerücht: Sie wollen <b>${name(t)}</b> (${t.pos}, ${t.age} J., Note ${t.medien.note}, Rang ${t.medien.rang}). Bei #${f.slot} wäre er weg.${window.DFLDraftboard && DFLDraftboard.geruechtVon && DFLDraftboard.geruechtVon(D.dflIdVon(f.b), t.id) ? ' Das Gerücht stimmte.' : ''}</div>` : ''}
      <div><div class="dfl-fenster-unter">Sie bieten</div><div class="dfl-fenster-tickets">${p.texte.map((x, ix) => { const nr = /^#(\d+)/.exec(x);
          return `<span class="dfl-ticket${p.dazu === x ? ' neu' : ''}"><b>${x.replace(/ \((\d{4})\)$/, ' · $1')}</b>${nr ? 'Runde ' + Math.ceil(+nr[1] / 32) : 'Zukunft'}</span>`; }).join('')}</div></div>
      <div class="dfl-fenster-meter" role="group" aria-label="Trade-O-Meter">
        <div class="dfl-fenster-zeile"><span>Du gibst #${d.nr + 1}</span><span class="dfl-fenster-balken"><i class="du" style="width:${(f.mein / max * 100).toFixed(1)}%"></i></span></div>
        <div class="dfl-fenster-zeile"><span>Für dich wert</span><span class="dfl-fenster-balken"><i class="sie" style="width:${(p.wert / max * 100).toFixed(1)}%"></i></span></div>
        <div class="dfl-fenster-fazit">${csChip(faktor, 'fenster|' + d.nr + '|' + f.b + '|' + (p.picks || []).join(',')) || `<span class="${faktor >= 1 ? 'plus' : 'minus'}">${faktor >= 1 ? 'lohnt sich' : 'zu wenig'}</span>`} · Rookie-Cap ${mio(G.rookieCapHit(d.nr + 1))} → ${mio(rookieNach)}</div>
      </div>
      ${f.notiz ? `<div class="dfl-fenster-geruecht">${f.notiz}</div>` : ''}
      <div class="dfl-fenster-knoepfe"><button type="button" class="app-knopf haupt" onclick="DFLKader.fenster('an')">Annehmen</button>
        <button type="button" class="app-knopf" onclick="DFLKader.fenster('mehr')"${f.nachgebessert ? ' disabled' : ''}>Nachbessern</button>
        <button type="button" class="app-knopf rot" onclick="DFLKader.fenster('ab')">Ablehnen</button></div>
      <div class="dfl-fenster-fuss">Draft-Uhr steht · sie legen drauf, weil sie ihn unbedingt wollen</div>
    </div></div>`;
  }
  function fensterUhrHtml(f) {
    const r = 18, u = 2 * Math.PI * r, a = Math.max(0, f.rest) / FENSTER.sekunden;
    const farbe = f.rest > 10 ? 'var(--app-gut, #3fcf7a)' : f.rest > 5 ? 'var(--app-mittel, #f0c05a)' : 'var(--app-schlecht, #f07462)';
    return `<svg class="dfl-uhr dfl-fenster-uhr" viewBox="0 0 46 46" role="timer" aria-label="Noch ${Math.max(0, f.rest)} Sekunden"><circle cx="23" cy="23" r="${r}" class="dfl-uhr-grund"/>
      <circle cx="23" cy="23" r="${r}" class="dfl-uhr-zeit" style="stroke:${farbe}" stroke-dasharray="${(u * a).toFixed(1)} ${u.toFixed(1)}" transform="rotate(-90 23 23)"/>
      <text x="23" y="28" text-anchor="middle">${Math.max(0, f.rest)}</text></svg>`;
  }
  // Du willst hoch: Pakete aus deinen Picks (bis 4 Jahre) für die nächsten Slots vor deinem eigenen Pick
  function hochtradenOptionen(d) {
    const L = D.liga(), eigen = D.eigenSync() || L.teams.find(t => t.id === D.eigeneDflId()), aus = [];
    for (let i = d.nr; i < Math.min(PICKS, d.nr + 16) && aus.length < 3; i++) {
      if (d.slots[i].besitzer === 'fcm') break;
      const paket = H.hochtradenPaket(L, eigen, i + 1, i + 1, slotKarte(d), { skepsis: true });
      if (paket) aus.push({ i, b: d.slots[i].besitzer, paket });
    }
    return aus;
  }
  function abschliessen(d) {
    d.fertig = true;
    const L = D.liga();
    // Nicht gedraftete: Junge (bis 20) melden sich für den nächsten Draft an, Ältere werden Free Agents;
    // dann rückt der übernächste Jahrgang nach
    const rest = L.draft.talente.slice(); L.draft.talente = [];
    const zurueck = rest.filter(t => t.age <= 20).length;
    S.nichtGedraftet(L, rest);
    L.picks = (L.picks || []).filter(x => x.jahr !== d.jahr);
    S.phaseJahrgang(L, rng(41));
    if (d.trades && d.trades.length) {
      d.trades.forEach(tradeLog);
      addNews('transfer', `🔁 Draft-Trades ${d.jahr}: ${d.trades.length}×`, d.trades.slice(0, 3).join(' · ') + (d.trades.length > 3 ? ` · und ${d.trades.length - 3} weitere (Trade-Log)` : '') + '.');
    }
    const meine = d.picks.filter(p => p.team === 'fcm').map(p => `#${p.pick} ${p.name} (${p.pos}, ${p.age})`);
    addNews('transfer', `🎓 DKL-Draft ${d.jahr}: ${meine.length} Rookies für ${CLUB.shortName || CLUB.name}`,
      (meine.length ? meine.join(', ') + '.' : '') + (zurueck ? ` ${zurueck} Nicht-Gedraftete bis 20 melden sich ${d.jahr + 1} wieder an.` : ''));
    faSpiegel(); capSetzen(); D.weltGeaendert();
    if (window.DFLAnalysten) try { DFLAnalysten.draftFertig(d); } catch (e) { console.warn('[DFL-Kader] Draft-Noten', e); }   // D51
    if (window.DFLDraftboard && DFLDraftboard.draftFertig) try { DFLDraftboard.draftFertig(d); } catch (e) { console.warn('[DFL-Kader] Merkliste', e); }   // D159
  }

  // ── KI-Trades im Jahr (Wunsch 2026-10-08) ────────────────────────────────
  function tradeLog(text) {
    (CLUB.dfl.tradeLog = CLUB.dfl.tradeLog || []).unshift({ s: LEAGUE.season, w: LEAGUE.week, t: text });
    CLUB.dfl.tradeLog.length = Math.min(CLUB.dfl.tradeLog.length, 30);
  }
  function kiTradeRunde(max) {
    const L = D.welt();
    G.setzeCap(L.cap);
    // D99: die Wechselwünsche der Welt frischt dfl_wechsel_patch.js in dieser Woche schon auf (vor dem Wochentakt) – nicht doppelt rechnen
    const wuensche = !(window.DFLWechsel && DFLWechsel.aktiv && DFLWechsel.aktiv());
    const tr = H.kiTrades(L, rng(61), { ohne: [D.eigeneDflId()], max, saat: LEAGUE.week, wuensche });
    tr.forEach(x => {
      const t = `${teamName(D.spielId(x.von))} (${x.lageA}) holt ${x.texte.b.join(', ')} von ${teamName(D.spielId(x.an))} für ${x.texte.a.join(' + ')}`;
      tradeLog(t);
      addNews('transfer', `🔁 Trade: ${teamName(D.spielId(x.von))} ↔ ${teamName(D.spielId(x.an))}`, t + '.');
    });
    if (tr.length) { faSpiegel(); D.weltGeaendert(); }
    return tr.length;
  }
  // Halbzeit: Draft-Talente entwickeln sich, die Medien sehen genauer hin
  function draftZwischenstand() {
    const L = D.liga();
    S.jahrgangZwischenstand(L, rng(71));
    const auf = (L.draft ? L.draft.talente : []).filter(t => t.medien.vorher).map(t => ({ t, d: t.medien.vorher - t.medien.rang }))
      .sort((a, b) => b.d - a.d).slice(0, 3);
    addNews('season', `📋 Draft-Board ${L.draft ? L.draft.jahr : ''}: Halbzeit-Update`, `Die Talente haben sich weiterentwickelt, die Medien sehen genauer hin. ` +
      (auf.length ? 'Größte Aufsteiger: ' + auf.map(x => `${name(x.t)} (${x.t.pos}, ${x.t.age}) +${x.d} auf Rang ${x.t.medien.rang}`).join(' · ') + '. ' : '') +
      `Beide Jahrgänge findest du im Scouting unter „Draft-Jahrgänge“.`);
  }
  // Draft-Vorschau im Scouting: kommender und übernächster Jahrgang
  function vorschauHtml() {
    const L = D.liga();
    if (!L.draftNaechste && L.draft) L.draftNaechste = G.erzeugeDraftJahrgang(rng(73), L.teams, { jahr: L.draft.jahr + 1, namen: L.namen, voraus: 1 });
    const jgs = [L.draft, L.draftNaechste].filter(j => j && j.talente && j.talente.length);
    if (!jgs.length) return '';
    const j = jgs.find(x => x.jahr === CLUB.dfl.vorschauJahr) || jgs[0];
    const voraus = j === L.draftNaechste ? 1 : 0;
    // D159 (b): ganzer Jahrgang mit Positionsfilter, Kaderlücken und Merkliste (dfl_draftboard.js); ohne das Modul wie bisher
    if (window.DFLDraftboard && DFLDraftboard.vorschauHtml) {
      try { const h = DFLDraftboard.vorschauHtml(jgs, j, voraus); if (h) return h; } catch (e) { console.warn('[DFL-Kader] Draft-Board', e); }
    }
    const tabs = jgs.map(x => `<button class="subtab ${x === j ? 'active' : ''}" onclick="DFLKader.vorschau(${x.jahr})">Draft ${x.jahr} ${x === L.draft ? '(kommend)' : '(übernächster)'}</button>`).join('');
    // D111 (Ebene 1): sechs Spalten – Rang, Talent mit Stil-Zeichen (D112), Position, Alter, Stärke, Potenzial; College, Text der
    // Medien, Note und Mock-Draft im Talent-Blatt (Tipp auf die Zeile → DFLScouting.blatt), die Legende hinter ⓘ
    const E = window.DFLEbenen && DFLEbenen.zeichenHtml ? window.DFLEbenen : null;
    const alle = j.talente.slice().sort((a, b) => a.medien.rang - b.medien.rang).slice(0, 40);
    const stilN = E ? alle.filter(t => E.passtZuMir(t)).length : 0;
    const zeilen = alle.filter(t => !E || !E.filter('draft') || E.passtZuMir(t)).map(t => {
      const s = schaetzung(t, voraus), v = t.medien.vorher;
      const trend = v && v !== t.medien.rang ? (v > t.medien.rang ? `<span class="dfl-auf">▲${v - t.medien.rang}</span>` : `<span class="dfl-ab">▼${t.medien.rang - v}</span>`) : '';
      return `<tr data-sc="blatt:${t.id}" role="button" tabindex="0" aria-label="${name(t)}: Talent-Blatt öffnen"><td class="num">${t.medien.rang} ${trend}</td>
        <td><b>${name(t)}</b>${E ? E.zeichenHtml(t, { klein: true }) : ''}</td>
        <td>${t.pos}</td><td class="num">${t.age}</td><td class="num">${s.ovr[0]}–${s.ovr[1]}</td><td class="num">${s.pot[0]}–${s.pot[1]}</td></tr>`;
    }).join('') || '<tr><td colspan="6" class="dfl-draft-sub">Kein Talent passt klar zu deinem Stil.</td></tr>';
    const sc = (CLUB.facilities && CLUB.facilities.scouting) || 5;
    const legende = `Rang und Note: Medien · Stärke und Potenzial: dein Scouting (Stufe ${sc})${voraus ? ' · ein Jahr vorher unschärfer' : ' · Prognose: Mock-Draft'}. Ein Tipp auf ein Talent: College, Text der Medien, Note, Mock-Draft.`;
    if (typeof window.infoKarteSetzen === 'function') window.infoKarteSetzen('draft-jahrgang', 'Draft-Jahrgänge', legende);
    return `<div class="dfl-vorschau"><div class="news-header"><i class="ti ti-school" aria-hidden="true"></i> Draft-Jahrgänge${typeof window.infoBtn === 'function' ? window.infoBtn('draft-jahrgang') : ''}</div>
      <div class="subtabs">${tabs}</div>
      ${E ? `<div class="dfl-draft-filter">${E.filterChipHtml('draft', stilN)}</div>` : `<div class="dfl-draft-sub" style="margin:6px 0">${legende}</div>`}
      <div class="dfl-draft-tabelle eb-draft"><table><thead><tr><th>Rang</th><th>Talent</th><th>Pos</th><th>Alter</th><th>Stärke</th><th>Potenzial</th></tr></thead>
        <tbody>${zeilen}</tbody></table></div></div>`;
  }

  // ── Draft-Dialog ─────────────────────────────────────────────────────────
  let weiterNachDraft = null;
  function analyseHtml() {
    const eigen = D.eigenSync();
    if (!eigen) return '';
    const sc = (CLUB.facilities && CLUB.facilities.scouting) || 5;
    const a = G.kaderAnalyse(eigen, { scouting: sc, saat: (CLUB.dfl.saisonIndex || 0) * 101 });
    const top = Object.entries(a).filter(([, v]) => v.art).sort((x, y) => y[1].bedarf - x[1].bedarf).slice(0, 4);
    if (!top.length) return '';
    return `<details class="dfl-analyse dfl-dz-mehr"><summary><i class="ti ti-clipboard-list" aria-hidden="true"></i><b>Kaderanalyse</b><span class="dfl-draft-sub">Scouting Stufe ${sc}${sc <= 4 ? ' – ungenau' : sc >= 8 ? ' – sehr genau' : ''}</span></summary>
      ${top.map(([pos, v]) => `<div class="dfl-analyse-zeile"><b>${pos}</b> · ${v.art} <span class="dfl-draft-sub">${v.gruende.slice(0, 2).join(' · ')}</span></div>`).join('')}</details>`;
  }
  function draftHtml(d) {
    const zug = amZug(d), ich = zug === 'fcm' && !d.fertig;
    const chips = d.slots.map((s, i) => ({ s, n: i + 1 })).filter(x => x.s.besitzer === 'fcm').map(({ s, n }) => {
      const p = d.picks.find(x => x.pick === n);
      return `<span class="dfl-draft-chip ${p ? 'erledigt' : n === d.nr + 1 ? 'jetzt' : ''}">R${Math.ceil(n / 32)} · #${n}${s.von !== 'fcm' ? ' (von ' + ((D.franchise(s.von) || {}).kurz || teamName(s.von)) + ')' : ''}${p ? ' · ' + p.name : ''}</span>`;
    }).join('') || '<span class="dfl-draft-sub">Keine eigenen Picks in diesem Draft.</span>';
    // Rückmeldung 18.10.: während des Drafts die letzten Picks als Leiste oben, unten nur noch Draft-Trades
    const letzte = (d.trades || []).slice(-2).reverse().map(t => `<li><i class="ti ti-arrows-exchange" aria-hidden="true"></i> ${t}</li>`).join('') +
      (d.fertig ? d.picks.slice(-6).reverse().map(p => `<li><b>#${p.pick}</b> ${teamName(p.team)}: ${p.name} · ${p.pos}, ${p.age}</li>`).join('') : '');
    const I = window.DFLIdentitaet, wappen = id => { try { const F = D.franchise(id); return F && I && I.wappenSvg ? I.wappenSvg(F, { klein: true }) : ''; } catch (e) { return ''; } };
    const kurzName = id => (D.franchise(id) || {}).kurz || teamName(id);
    const leiste = d.fertig || !d.picks.length ? '' : `<div class="dfl-dz-letzte" aria-label="Letzte Picks">${d.picks.slice(-3).reverse().map(p => `<div class="dfl-dz-pick${p.team === 'fcm' ? ' ich' : ''}">
        <span class="dfl-dz-w">${wappen(p.team)}</span><span class="dfl-dz-pt"><small>#${p.pick} · ${kurzName(p.team)}</small><b>${p.name}</b></span>
        <span class="pos-badge-sm pos-${p.pos}">${p.pos}</span></div>`).join('')}</div>`;
    let mitte;
    if (d.fertig) {
      const rookies = SQUAD.filter(p => p.rookieVertrag && p.rookieVertrag.jahr === d.jahr);
      mitte = `<div class="dfl-draft-fertig"><h3>Draft abgeschlossen</h3>` + rookies.map(p => `<div class="dfl-draft-rookie">
          <b>#${p.rookieVertrag.pick} ${name(p)}</b> · ${p.pos} · ${p.age} J · ${p.college || ''}
          <span>${p.perspektiv ? DS + ' · ' : ''}OVR ${p.ovr} · Cap Hit ${mio(capHitJahr(p))}</span>
          ${!p.perspektiv && pkTauglich(p) ? `<button class="dfl-draft-btn leise" onclick="DFLKader.inPerspektivkader('${p.id}');DFLKader.zeichne()">→ ${DS}</button>` : ''}</div>`).join('') +
        `<p class="dfl-draft-hinweis">Cap ${mio(capBelegt())} / ${mio(capLimit())} · Kader ${hauptkader().length}/${KADER} (min. ${MIN()}) · ${DS} ${perspektivkader().length}/${S.CFG.perspektiv}</p>
        <button class="dfl-draft-btn gross" onclick="DFLKader.draftSchliessen()">Weiter</button></div>`;
    } else {
      // D112: Stil-Zeichen am Namen und Filter „passt zu meinem Stil“ (dfl_ebenen_patch.js)
      const E = window.DFLEbenen && DFLEbenen.zeichenHtml ? window.DFLEbenen : null;
      const liste = verfuegbar().slice(0, 40), stilN = E ? liste.filter(t => E.passtZuMir(t)).length : 0;
      const zeilen = liste.filter(t => !E || !E.filter('draftboard') || E.passtZuMir(t)).map(t => {
        const s = schaetzung(t);
        return `<tr><td class="num">${t.medien.rang}</td>
          <td><b>${name(t)}</b>${E ? E.zeichenHtml(t, { klein: true }) : ''}<div class="dfl-draft-sub">${t.college}${t.medien.prognose && t.medien.prognose.pick ? ' · Prognose #' + t.medien.prognose.pick : ''}</div></td>
          <td>${t.pos}</td><td class="num">${t.age}</td><td class="num">${s.ovr[0]}–${s.ovr[1]}</td><td class="num">${s.pot[0]}–${s.pot[1]}</td>
          <td class="num">${t.medien.note}</td>
          <td>${ich ? `<button class="dfl-draft-btn" onclick="DFLKader.draftWahl('${t.id}')">Wählen</button>` : ''}</td></tr>`;
      }).join('');
      const naechsterEigener = d.slots.findIndex((s, i) => i >= d.nr && s.besitzer === 'fcm');
      // D159 (b): Merkliste und alle verfügbaren Talente mit Positionsfilter statt der Tabelle (dfl_draftboard.js)
      let DBL = '';
      if (window.DFLDraftboard && DFLDraftboard.draftListeHtml) { try { DBL = DFLDraftboard.draftListeHtml(d, ich); } catch (e) { console.warn('[DFL-Kader] Merkliste', e); DBL = ''; } }
      const angebote = ich ? angebotFuerMich(d) : [];
      const board = ich ? boardHtml(d) : '';
      const hoch = !ich ? hochtradenOptionen(d) : [];
      // Rückmeldung 18.10. („Ansicht vor dem eigenen Pick aufpolieren“): Wer ist dran (Wappen), wie lange noch bis zu dir
      let vorEigener = -1; for (let i = d.nr - 1; i >= 0; i--) if (d.slots[i].besitzer === 'fcm') { vorEigener = i; break; }
      const rest = naechsterEigener >= 0 ? naechsterEigener - d.nr : null;
      const anteil = rest != null ? Math.max(0.04, Math.min(1, (d.nr - vorEigener) / Math.max(1, naechsterEigener - vorEigener))) : 0;
      mitte = (ich ? `<div class="dfl-draft-status"><b>Du bist am Zug:</b> Runde ${Math.floor(d.nr / 32) + 1}, Pick #${d.nr + 1}
          <span class="dfl-draft-aktionen"><button class="dfl-draft-btn" onclick="DFLKader.draftAutoWahl()">Für mich wählen</button>
          <button class="dfl-draft-btn leise" onclick="DFLKader.draftAuto()">Rest automatisch</button></span></div>`
        : `<div class="dfl-dz">
            <span class="dfl-dz-wappen">${wappen(zug)}</span>
            <span class="dfl-dz-text"><small>Am Zug · Runde ${Math.floor(d.nr / 32) + 1} · Pick #${d.nr + 1}</small><b>${teamName(zug)}</b></span>
            ${rest != null ? `<span class="dfl-dz-rest"><b>${rest}</b><small>${rest === 1 ? 'Pick' : 'Picks'} bis zu dir</small></span>` : ''}
            ${rest != null ? `<span class="dfl-dz-balken" aria-hidden="true"><i style="width:${(anteil * 100).toFixed(0)}%"></i></span>` : ''}
          </div>
          <div class="dfl-dz-knoepfe"><button class="dfl-draft-btn leise" onclick="DFLKader.draftWeiter('eins')">Nächster Pick</button>
            ${rest != null ? `<button class="dfl-draft-btn" onclick="DFLKader.draftWeiter('bisIch')">Bis zu Pick #${naechsterEigener + 1}</button>` : ''}
            <button class="dfl-draft-btn leise" onclick="DFLKader.draftAuto()">Rest automatisch</button></div>`) + `
        ${leiste}
        ${board}
        ${angebote.length ? `<div class="dfl-draft-angebot"><b>Nach unten tauschen?</b> <span class="dfl-draft-sub">Für deinen Pick #${d.nr + 1} (Rookie-Cap ${mio(angebote[0].rookie.vorher)}) bieten:</span>
            ${angebote.map((a, ix) => `<div class="dfl-draft-hoch"><span><b>${teamName(a.b)}</b>: ${a.texte.join(' + ')}
              ${csChip(a.wert / a.mein, 'draft|' + d.nr + '|' + a.b + '|' + (a.picks || []).join(','))}<span class="dfl-draft-sub">Rookie-Cap danach ${mio(a.rookie.nachher)}</span></span>
              <button class="dfl-draft-btn" onclick="DFLKader.angebot(true, ${ix})">Annehmen</button></div>`).join('')}
            <span class="dfl-draft-aktionen"><button class="dfl-draft-btn leise" onclick="DFLKader.angebot(false)">Selbst wählen</button></span></div>` : ''}
        ${hoch.length ? `<details class="dfl-dz-mehr"><summary><i class="ti ti-arrow-big-up-lines" aria-hidden="true"></i><b>Hochtraden</b><span class="dfl-dz-zahl">${hoch.length}</span></summary>
            ${hoch.map(o => `<div class="dfl-dz-hoch"><span class="dfl-dz-w">${wappen(o.b)}</span><span class="dfl-dz-pt"><b>Pick #${o.i + 1} · ${kurzName(o.b)}</b><small>für ${o.paket.texte.join(' + ')}</small></span>
              <button class="dfl-draft-btn leise" onclick="DFLKader.hochtraden(${o.i})">Tauschen</button></div>`).join('')}</details>` : ''}
        ${analyseHtml()}
        ${DBL ? DBL : `${E ? `<div class="dfl-draft-filter">${E.filterChipHtml('draftboard', stilN)}</div>` : ''}
        <div class="dfl-draft-tabelle"><table><thead><tr><th>Rang</th><th>Talent</th><th>Pos</th><th>Alter</th><th>Stärke</th><th>Potenzial</th><th>Note</th><th></th></tr></thead>
          <tbody>${zeilen || '<tr><td colspan="8" class="dfl-draft-sub">Kein Talent passt klar zu deinem Stil.</td></tr>'}</tbody></table></div>
        <div class="dfl-draft-hinweis">Rang/Note: Medien · Stärke/Potenzial: dein Scouting</div>`}`;
    }
    return `<div class="dfl-draft-karte">
        <div class="dfl-draft-kopf"><div><div class="dfl-draft-titel">DKL-Draft ${d.jahr}</div>
          <div class="dfl-draft-sub">4 Runden · 128 Picks</div></div>
          <div class="dfl-draft-cap">Cap ${mio(capBelegt())} / ${mio(capLimit())}</div></div>
        <div class="dfl-draft-chips">${chips}</div>
        ${mitte}
        ${letzte ? `<ul class="dfl-draft-letzte">${letzte}</ul>` : ''}
        ${fensterOffen(d) ? fensterHtml(d) : ''}
      </div>`;
  }
  // ── Draft-Board mit Uhr (D54) ────────────────────────────────────────────
  const UHR = 60;
  let uhr = { nr: -1, rest: UHR, pause: false, t: 0, karte: null };
  const NOTE_KLASSE = n => /^A/.test(n) ? 'a' : /^B/.test(n) ? 'b' : 'c';
  function uhrRing() {
    const r = 26, u = 2 * Math.PI * r, a = Math.max(0, uhr.rest) / UHR;
    const f = uhr.rest > 20 ? 'var(--app-gut, #3fcf7a)' : uhr.rest > 10 ? 'var(--app-mittel, #f0c05a)' : 'var(--app-schlecht, #f07462)';
    return `<svg class="dfl-uhr" viewBox="0 0 64 64" role="timer" aria-label="Noch ${uhr.rest} Sekunden"><circle cx="32" cy="32" r="${r}" class="dfl-uhr-grund"/>
      <circle cx="32" cy="32" r="${r}" class="dfl-uhr-zeit" style="stroke:${f}" stroke-dasharray="${(u * a).toFixed(1)} ${u.toFixed(1)}" transform="rotate(-90 32 32)"/>
      <text x="32" y="38" text-anchor="middle">${uhr.pause ? 'II' : uhr.rest + 's'}</text></svg>`;
  }
  function boardHtml(d) {
    // Cap Hit im ersten Jahr wie beim Unterschreiben (rookieVerpflichten) – vorher der Jahresdurchschnitt (5,1 statt 4,6 Mio)
    const pick = d.nr + 1, runde = Math.floor(d.nr / 32) + 1, gehalt = G.rookieCapHit(pick);
    const top = verfuegbar().slice(0, 5);
    const karte = uhr.karte && top.find(t => t.id === uhr.karte);
    const zeile = t => { const sc = schaetzung(t), offen = karte === t;
      return `<button type="button" class="dfl-prospekt${offen ? ' offen' : ''}" onclick="DFLKader.draftKarte('${t.id}')" aria-expanded="${offen}">
        <span class="dfl-note ${NOTE_KLASSE(t.medien.note)}">${t.medien.note}</span>
        <span class="dfl-pr-name"><b>${name(t)}${window.DFLEbenen && DFLEbenen.zeichenHtml ? DFLEbenen.zeichenHtml(t, { klein: true }) : ''}</b><small><span class="pos-badge-sm pos-${t.pos}">${t.pos}</span> ${t.age} J. · Stärke ${sc.ovr[0]}–${sc.ovr[1]} · Pot. ${sc.pot[0]}–${sc.pot[1]}</small></span>
        <span class="dfl-pr-cap"><b>${(gehalt / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 1 })}</b>Mio Cap</span></button>
        ${offen ? `<div class="dfl-pr-karte"><div class="fut silber dfl-pr-fut"><div class="fut-wert">${t.medien.note}</div><div class="fut-pos">${t.pos}</div>
            <div class="fut-name">${name(t)}</div><div class="fut-werte"><span><em>STÄ</em>${sc.ovr[0]}–${sc.ovr[1]}</span><span><em>POT</em>${sc.pot[0]}–${sc.pot[1]}</span>
            <span><em>ALT</em>${t.age}</span><span><em>RANG</em>${t.medien.rang}</span></div></div>
          <div class="dfl-pr-text"><b>${t.college || ''}</b><span>${(G.medienText ? G.medienText(t) : t.medien.text) || ''}</span>
            <span class="dfl-draft-sub">Rookie-Vertrag ${G.CFG.rookie.jahre} Jahre nach der Skala · ${mio(gehalt)} pro Jahr</span>
            <button class="dfl-draft-btn gross" onclick="DFLKader.draftWahl('${t.id}')">#${pick}: ${name(t)} wählen</button></div></div>` : ''}`; };
    return `<div class="dfl-board">
      <div class="dfl-board-kopf">${uhrRing()}<span><small>DRAFT ${d.jahr}</small><b>Runde ${runde} · Pick #${pick}</b><small>Du bist dran · ${fensterOffen(d) ? 'Uhr steht – Angebot liegt vor' : uhr.pause ? 'Uhr angehalten' : 'Auto-Pick bei 0'}</small></span>
        <button type="button" class="dfl-uhr-knopf" onclick="DFLKader.uhrPause()" aria-label="${uhr.pause ? 'Uhr weiterlaufen lassen' : 'Uhr anhalten'}"><i class="ti ${uhr.pause ? 'ti-player-play' : 'ti-player-pause'}" aria-hidden="true"></i></button></div>
      <div class="dfl-board-titel"><b>Top 5 auf dem Board</b><small>Note der Medien · Spannen aus deinem Scouting</small></div>
      ${top.map(zeile).join('')}</div>`;
  }
  function uhrZeigen() {
    const el = document.querySelector('#dfl-draft-ov .dfl-uhr'); if (el) el.outerHTML = uhrRing();
  }
  function uhrTick() {
    const d = dfl() && LEAGUE.dflDraft, ov = document.getElementById('dfl-draft-ov');
    if (!d || d.fertig || !ov || amZug(d) !== 'fcm') { clearInterval(uhr.t); uhr.t = 0; return; }
    if (uhr.pause || fensterOffen(d) || document.visibilityState === 'hidden') return;
    uhr.rest--;
    if (uhr.rest > 0) { uhrZeigen(); return; }
    clearInterval(uhr.t); uhr.t = 0;
    const t = eigeneAutoWahl(); if (!t) return;
    if (typeof window.showToast === 'function') window.showToast(`Zeit abgelaufen – Auto-Pick #${d.nr + 1}: ${name(t)} (${t.pos})`, 'info');
    waehle(d, t); nachWahl();
  }
  function uhrStarten(d) {
    if (!d || d.fertig || amZug(d) !== 'fcm') { clearInterval(uhr.t); uhr.t = 0; return; }
    if (uhr.nr !== d.nr) { uhr.nr = d.nr; uhr.rest = UHR; uhr.karte = null; }
    if (!uhr.t) uhr.t = setInterval(uhrTick, 1000);
  }
  // D94: eigene 20-s-Uhr des Fensters; bei 0 legen sie auf, die Draft-Uhr läuft weiter
  let fUhr = 0;
  function fensterUhrStop() { if (fUhr) { clearInterval(fUhr); fUhr = 0; } }
  function fensterTick() {
    const d = dfl() && LEAGUE.dflDraft;
    if (!fensterOffen(d) || !document.getElementById('dfl-fenster')) { fensterUhrStop(); return; }
    if (document.visibilityState === 'hidden') return;
    const f = d.fenster;
    f.rest--;
    if (f.rest > 0) { const el = document.querySelector('#dfl-fenster .dfl-fenster-uhr'); if (el) el.outerHTML = fensterUhrHtml(f); return; }
    f.phase = 'verfallen'; fensterUhrStop();
    if (typeof window.showToast === 'function') window.showToast(`Zeit abgelaufen – ${teamName(f.b)} legen auf. Du wählst selbst.`, 'info');
    zeichne();
  }
  function zeichne() {
    const d = LEAGUE.dflDraft, ov = document.getElementById('dfl-draft-ov');
    if (d && amZug(d) === 'fcm' && uhr.nr !== d.nr) { uhr.nr = d.nr; uhr.rest = UHR; uhr.karte = null; }
    if (ov && d) {
      ov.innerHTML = draftHtml(d); uhrStarten(d);
      // Rookie-Pack einmal je Draft, sobald er fertig ist (Nutzer 2026-10-18)
      if (d.fertig && !d.packGezeigt && window.KSDraftPack) {
        d.packGezeigt = true;
        try { KSDraftPack.zeigen(KSDraftPack.ausDraft(d)); } catch (e) { console.warn('[DFL-Kader] Rookie-Pack', e); }
      }
      if (fensterOffen(d)) {
        if (!fUhr) { fUhr = setInterval(fensterTick, 1000); const el = document.getElementById('dfl-fenster'); if (el) el.focus({ preventScroll: true }); }
      } else fensterUhrStop();
    }
  }
  function oeffneDraft(weiter) {
    const d = dfl() && LEAGUE.dflDraft;
    if (!d || d.fertig) { if (weiter) weiter(); return; }
    if (weiter) weiterNachDraft = weiter;
    let ov = document.getElementById('dfl-draft-ov');
    if (!ov) { ov = document.createElement('div'); ov.id = 'dfl-draft-ov'; ov.className = 'dfl-draft-ov'; document.body.appendChild(ov); }
    zeichne();
  }
  function nachWahl() { zeichne(); speichern(); }

  window.DFLKader = {
    draftWahl(id) {
      const d = LEAGUE.dflDraft, t = d && talente().find(x => x.id === id);
      if (!t || amZug(d) !== 'fcm') return;
      waehle(d, t); nachWahl();
    },
    draftAutoWahl() { const d = LEAGUE.dflDraft; if (d && amZug(d) === 'fcm') { waehle(d, eigeneAutoWahl()); nachWahl(); } },
    autoWahl: eigeneAutoWahl,          // Auto-Wahl nach Wert und Bedarf (Prüfläufe)
    draftKarte(id) { uhr.karte = uhr.karte === id ? null : id; zeichne(); },
    uhrPause() { uhr.pause = !uhr.pause; zeichne(); },
    draftAuto() { const d = LEAGUE.dflDraft; if (d && !d.fertig) { simulieren(d, 'alles'); zeichne(); speichern(); } },
    draftWeiter(modus) { const d = LEAGUE.dflDraft; if (d && !d.fertig) { simulieren(d, modus); zeichne(); speichern(); } },
    angebot(ja, ix) {
      const d = LEAGUE.dflDraft, a = d && (d.angebote || [])[ix || 0];
      if (!a || amZug(d) !== 'fcm') return;
      if (ja) {
        const von = pickTausch(d, d.nr, a.b, a.picks);
        d.slots[d.nr].ziel = a.ziel;
        (d.trades = d.trades || []).push(tradeText(d, d.nr, a.b, von, { texte: a.texte }, talente().find(t => t.id === a.ziel), a.rookie));
        simulieren(d, 'eins');
      }
      d.angebot = null; d.angebote = [];
      zeichne(); speichern();
    },
    // D94: Fenster „will deinen Pick unbedingt“ – 'an' (annehmen), 'mehr' (einmal nachbessern), 'ab' (ablehnen)
    fenster(aktion) {
      const d = LEAGUE.dflDraft, f = d && d.fenster;
      if (!fensterOffen(d)) return;
      const melde = t => { if (typeof window.showToast === 'function') window.showToast(t, 'info'); };
      if (aktion === 'mehr') {
        if (f.nachgebessert) return;
        f.nachgebessert = true;
        const L = D.liga(), T = L.teams.find(t => t.id === D.dflIdVon(f.b));
        const n = T && H.hochtradenNachbessern(L, T, f.paket, d.nr + 1, slotKarte(d), f.grenze, FENSTER.plus);
        if (n) { f.paket = n; f.rookie = rookieCap(d, d.nr, n); f.notiz = `Nachgebessert: ${n.dazu.replace(/ \((\d{4})\)$/, ' · $1')} dazu. Mehr gibt es nicht.`; }
        else f.notiz = 'Das ist ihr letztes Angebot.';
      } else if (aktion === 'an') {
        f.phase = 'an'; fensterUhrStop();
        const nr = d.nr, von = pickTausch(d, nr, f.b, f.paket.picks);
        d.slots[nr].ziel = f.ziel;
        (d.trades = d.trades || []).push(tradeText(d, nr, f.b, von, f.paket, talente().find(t => t.id === f.ziel), f.rookie));
        d.angebot = null; d.angebote = [];
        melde(`Getauscht: Pick #${nr + 1} an ${teamName(f.b)} für ${f.paket.texte.join(' + ')}`);
        simulieren(d, 'eins');
      } else {
        f.phase = 'ab'; fensterUhrStop();
        melde(`${teamName(f.b)} legen auf – du wählst selbst.`);
      }
      zeichne(); speichern();
    },
    hochtraden(i) {
      const d = LEAGUE.dflDraft;
      if (!d || d.fertig || i < d.nr) return;
      const o = hochtradenOptionen(d).find(x => x.i === i);
      if (!o) return;
      const von = pickTausch(d, i, 'fcm', o.paket.picks);
      (d.trades = d.trades || []).push(tradeText(d, i, 'fcm', von, o.paket, null));
      zeichne(); speichern();
    },
    draftSchliessen() {
      clearInterval(uhr.t); uhr.t = 0; fensterUhrStop();
      const ov = document.getElementById('dfl-draft-ov'); if (ov) ov.remove();
      render();
      const w = weiterNachDraft; weiterNachDraft = null;
      if (w) w();
    },
    vorschau(jahr) { CLUB.dfl.vorschauJahr = jahr; if (typeof window.renderScoutTab === 'function') window.renderScoutTab(); },
    vorschauHtml, verfuegbar, amZug,          // D159: Draft-Board vorab (dfl_draftboard.js)
    startDraftVorbereiten: reihenfolge => { draftVorbereiten(reihenfolge); return LEAGUE.dflDraft; },     // D108: erster Draft vor Saison 1
    kiTradeRunde, draftZwischenstand,
    oeffneDraft, zeichne, cap, capLimit, capLimitBasis, werbeBonus, capBelegt, deadCapBuchen, deadCapGeld, zuVertraegen, capHitJahr, capSetzen, schaetzung, entlassen, deadCapVon,
    capNaechste, capHitSaison, deadCapNach, folgeHit,      // D92/D93: Saisonvorbereitung, Folgevertrag, Entlassung zum Saisonende
    inPerspektivkader, hochziehen, startPruefung, faSpiegel, faWelle, vorbereitung, pkTauglich, dsVertrag, saisonLaeuft, grenzeAktiv, hauptkader, MIN, MAX: () => KADER,
    TW_MIN, torhueter, twFehlt, twText, faFilter, faPos      // D136: zwei Torhüter, Free Agents nach Position
  };

  // ── Einhängen ────────────────────────────────────────────────────────────
  // Saisonwechsel: Cap wächst vorher (Budget und TV rechnen schon mit dem neuen Cap); danach die
  // Offseason der Welt, Development Squad, Scouting, Draft vorbereiten und Free Agency spiegeln.
  {
    const _orig = window.startNewSeason;
    if (typeof _orig === 'function') window.startNewSeason = function () {
      const war = dfl(), wocheEnde = war ? LEAGUE.week : 0;
      if (war) {
        D.eigenSync(); capWachstum();
        // Saison-Rückblick (chronicle_patch.js) erfasst erst danach: Kader vor den Abgängen merken
        try { if (window.Chronicle && Chronicle.merkeKader) Chronicle.merkeKader(); } catch (e) { /* Rückblick optional */ }
        // vor dem neuen Saisonplan: abgelaufene Verträge raus (Folgeverträge beginnen, D92), Gehaltsstaffel weiter (sonst stehen
        // sie im Plan), dann die zum Saisonende vorgemerkten Entlassungen (D93, Dead Cap in der neuen Saison)
        try { vertraegeAuslaufen(LEAGUE.season + 1); } catch (e) { console.warn('[DFL-Kader] Vertragsende', e); }
        try { staffelWeiter(LEAGUE.season + 1); } catch (e) { console.warn('[DFL-Kader] Gehaltsstaffel', e); }
        try { vorgemerkteEntlassen(LEAGUE.season + 1); } catch (e) { console.warn('[DFL-Kader] Vorgemerkte Entlassungen', e); }
      }
      const vorSquad = war ? SQUAD.slice() : null;
      const r = _orig.apply(this, arguments);
      if (war && dfl()) {
        // Karriereende im Basisspiel (bundle_match.js processRetirements): letzte Saison noch in der Welt zählen
        try { vorSquad.filter(q => SQUAD.indexOf(q) < 0 && !q.onLoanFrom).forEach(q => abgangMerken(q, D.spielZuDfl(q, LEAGUE.season), 'ruhestand')); }
        catch (e) { console.warn('[DFL-Kader] Karriereenden', e); }
        try { geburtstageNachholen(wocheEnde); } catch (e) { console.warn('[DFL-Kader] Geburtstage', e); }
        faEinstellungen(false);
        try { weltSaisonwechsel(); } catch (e) { console.warn('[DFL-Kader] Offseason der Welt fehlgeschlagen', e); }
        try { if (abgaenge.length) abgaengeAbgeben(D.liga()); } catch (e) { console.warn('[DFL-Kader] Abgänge', e); }
        perspektivPruefen();
        scoutingAltern();
        try { draftVorbereiten(); } catch (e) { console.warn('[DFL-Kader] Draft konnte nicht vorbereitet werden', e); }
        faSpiegel(); capSetzen(); D.weltGeaendert();
        addNews('club', `📈 Neuer Cap: ${mio(cap())}`, (capLimit() > cap() ? `+ ${mio(capLimit() - cap())} Rollover. ` : '') + `Belegt: ${mio(capBelegt())}.`);
      }
      return r;
    };
  }
  // Geburtstage nach dem Saisonende (DFL: Woche springt nach den Playoffs auf 1) und in Woche 1 feiert sonst niemand –
  // die KI altert jedes Jahr, der eigene Kader muss es auch (Prüfung 2026-10-09: 4–14 Spieler je Saison blieben gleich alt)
  function geburtstageNachholen(wocheEnde) {
    SQUAD.forEach(p => { if (p.birthWeek && (p.birthWeek === 1 || p.birthWeek > wocheEnde)) p.age = (p.age || 20) + 1; });
  }
  // Gehaltsstaffel eigener DFL-Verträge (steigend/fallend, Rookies) wie bei der KI jedes Jahr weiterschalten –
  // vorher blieb das Gehalt des ersten Jahres für die ganze Laufzeit stehen (Prüfung 2026-10-09)
  function staffelWeiter(saison) {
    SQUAD.forEach(p => {
      const c = p.contract;
      if (!c || !Array.isArray(c.base_salary_by_year) || !c.base_salary_by_year.length || p.dflVertragBis == null || saison > p.dflVertragBis) return;
      const rest = p.dflVertragBis - saison + 1;
      const idx = Math.max(0, Math.min(c.base_salary_by_year.length - 1, (c.years_total || rest) - rest));
      c.years_remaining = rest; c.base_salary = c.base_salary_by_year[idx];
      p.wage = Math.round(c.base_salary / 52);
    });
  }
  // Abgänge zum Saisonwechsel (Vertragsende, Karriereende) stehen beim Saisonabschluss der Welt noch im eigenen Kader:
  // so zählt ihre letzte Saison in Karriere, Preisen und Titeln, und die Welt altert/entwickelt sie nicht ein zweites Mal
  // (vorher: sofort in die Free Agency → doppelt gealtert, letzte Saison fehlte, Hall of Fame doppelt; Prüfung 2026-10-10)
  let abgaenge = [];
  function abgangMerken(q, w, ziel) {
    if (window.DFLHistorie && DFLHistorie.karriere) q.karriere = DFLHistorie.karriere(w);   // ein Karriere-Objekt für Spiel und Welt
    w._abgang = ziel; abgaenge.push(w);
  }
  function abgaengeEinsetzen(L) {
    const t = L.teams.find(x => x.id === D.eigeneDflId());
    const liste = abgaenge.splice(0);
    if (t) liste.forEach(w => { w.teamId = t.id; t.roster.push(w); });
    return { t, liste };
  }
  function abgaengeAbgeben(L, rein) {
    const liste = rein ? rein.liste : abgaenge.splice(0);
    if (rein && rein.t) rein.t.roster = rein.t.roster.filter(p => liste.indexOf(p) < 0);
    liste.forEach(w => {
      const ziel = w._abgang; delete w._abgang;
      if (ziel !== 'frei') return;                         // Karriereende: nur die letzte Saison zählen
      w.contract = null; w.teamId = null; w._exVerein = D.eigeneDflId(); delete w.sq; delete w.ir;
      L.freie.push(w);
    });
  }
  // Abgelaufene Verträge wie in der NFL: der Spieler wird Free Agent (vorher spielte er eine Saison ohne Vertrag
  // und verschwand dann aus der Liga). Kein Dead Cap – der Vertrag ist vollständig gelaufen.
  // D92: Karriereenden, die in der Saisonvorbereitung schon feststehen (dfl_saisonwechsel_patch.js würfelt sie zu Beginn der Woche)
  const karriereVorab = () => {
    const v = CLUB.dfl && CLUB.dfl.vorbereitung;
    return new Set(v && v.saison === LEAGUE.season && Array.isArray(v.karriere) ? v.karriere : []);
  };
  // Folgevertrag (D92) beginnt: wird der laufende Vertrag (Staffel aus der Vorlage, Rest-Handgeld ÷ Laufzeit; der heute gezahlte
  // Teil zählte schon in der alten Saison)
  function folgevertragAktivieren(p, saison) {
    const F = p.vertragFolge;
    if (!F || !(F.start <= saison)) return false;
    const n = Math.max(1, F.jahre || (F.base_salary_by_year || []).length || 1);
    const by = (F.base_salary_by_year || []).slice(0, n);
    while (by.length < n) by.push(by.length ? by[by.length - 1] : G.CFG.mindestgehalt);
    p.contract = { years_total: n, years_remaining: n, base_salary: by[0], base_salary_by_year: by,
      signing_bonus_total: Math.max(0, Math.round((F.signing_bonus_total || 0) - (F.vorab || 0))), guaranteed_bonuses: F.guaranteed_bonuses || 0,
      staffelung: F.staffelung || 'gleich', art: F.art || 'veteran' };
    p.wage = Math.round(by[0] / 52);
    p.contractUntil = F.start + n - 1; p.dflVertragBis = p.contractUntil;
    delete p.vertragFolge; delete p.vorauszahlung; delete p.expiring;
    return true;
  }
  function vertraegeAuslaufen(saison) {
    const weg = [], folge = [], ende = [], karriere = karriereVorab();
    SQUAD.slice().forEach(p => {
      if (p.vertragFolge && !karriere.has(p.id) && folgevertragAktivieren(p, saison)) { folge.push(p); return; }
      if (p.contractUntil == null || p.contractUntil >= saison || dsVertrag(p) || p.onLoanFrom) return;
      const w = D.spielZuDfl(p, LEAGUE.season);
      // Geburtstag nach Saisonende wie geburtstageNachholen – die Welt altert sie in diesem Wechsel nicht mehr
      if (p.birthWeek && (p.birthWeek === 1 || p.birthWeek > LEAGUE.week)) w.age += 1;
      // Karriereende stand schon in der Saisonvorbereitung fest (D92): er hört auf, statt Free Agent zu werden
      abgangMerken(p, w, karriere.has(p.id) ? 'ruhestand' : 'frei');
      ausKader(p); (karriere.has(p.id) ? ende : weg).push(p);
    });
    if (!weg.length && !folge.length && !ende.length) return;
    D.eigenSync(); capSetzen();
    if (folge.length) addNews('transfer', `✍️ ${folge.length} ${folge.length === 1 ? 'Folgevertrag beginnt' : 'Folgeverträge beginnen'}`,
      folge.map(p => `${name(p)} (${p.pos}, ${p.ovr}) bis ${typeof seasonEndYear === 'function' ? seasonEndYear(p.contractUntil) : p.contractUntil}, Cap Hit ${mio(capHitSaison(p, saison))}`).join(', ') + '.');
    ende.forEach(p => addNews('club', `🎖️ Karriereende: ${name(p)}`, `${name(p)} beendet mit ${p.age} Jahren seine aktive Karriere – sein Vertrag endet ohne Dead Cap.`));
    if (weg.length) addNews('transfer', `📄 ${weg.length} ${weg.length === 1 ? 'Vertrag' : 'Verträge'} ausgelaufen`,
      weg.map(p => `${name(p)} (${p.pos}, ${p.ovr})`).join(', ') + ' – jetzt Free Agent.');
  }
  // Zum Saisonende vorgemerkte Entlassungen (D93): nach dem Vertragsende, vor dem neuen Saisonplan. Dead Cap ganz in der neuen
  // Saison (Spec 3.2: nicht verrechnetes Handgeld der Folgejahre), nach capWachstum gebucht (setzt Dead Cap auf 0); bezahlt wird
  // er über den Saisonplan (Kaderkosten = Cap Hits × 1,1), deshalb kein deadCapBuchen. Karriereende hebt die Marke auf.
  function vorgemerkteEntlassen(saison) {
    const ids = Array.isArray(CLUB.dfl.vorgemerkt) ? CLUB.dfl.vorgemerkt.slice() : [];
    CLUB.dfl.vorgemerkt = [];
    if (!ids.length) return [];
    const karriere = karriereVorab(), raus = [], bleiben = [];
    ids.forEach(id => {
      const p = SQUAD.find(x => x.id === id);
      if (!p || karriere.has(id) || p.vertragFolge || dsVertrag(p) || p.onLoanFrom || p.contractUntil == null || p.contractUntil < saison) return;
      if (hauptkader().length <= 16 && !p.perspektiv) { bleiben.push(p); return; }      // wie Entlassen in der Offseason
      const dead = deadCapNach(p);
      const w = D.spielZuDfl(p, LEAGUE.season);
      if (p.birthWeek && (p.birthWeek === 1 || p.birthWeek > LEAGUE.week)) w.age += 1;
      abgangMerken(p, w, 'frei');
      ausKader(p);
      CLUB.dfl.deadCap = (CLUB.dfl.deadCap || 0) + dead;
      raus.push({ p, dead });
    });
    if (raus.length) {
      D.eigenSync(); capSetzen();
      const dead = raus.reduce((s, x) => s + x.dead, 0);
      addNews('transfer', `✂️ Zum Saisonende entlassen: ${raus.length === 1 ? name(raus[0].p) : raus.length + ' Spieler'}`,
        raus.map(x => `${name(x.p)} (${x.p.pos}, ${x.p.ovr})${x.dead ? ', Dead Cap ' + mio(x.dead) : ''}`).join(' · ') +
        `. Sie sind jetzt Free Agents.${dead ? ` Dead Cap der neuen Saison: ${mio(dead)}.` : ''}`);
    }
    if (bleiben.length) addNews('transfer', '✂️ Entlassung nicht möglich', `${bleiben.map(name).join(', ')} ${bleiben.length === 1 ? 'bleibt' : 'bleiben'}: Der Kader hätte sonst weniger als 16 Spieler.`);
    return raus;
  }
  function zuVertraegen() {
    if (window.DFLAppShell && DFLAppShell.zeige) DFLAppShell.zeige('squad'); else if (typeof switchAppView === 'function') switchAppView('squad', document.getElementById('nav-squad') || document.createElement('button'));
    const b = document.querySelector('#view-squad .subtab[onclick*="vertraege"]'); if (b) b.click();
  }
  // Postfach: auslaufende Verträge ab Spieltag 18 (sie werden zum Saisonende Free Agent)
  {
    const _orig = window.buildPostfachItems;
    if (typeof _orig === 'function') window.buildPostfachItems = function () {
      let items = _orig.apply(this, arguments);
      try {
        // Die allgemeine Warnung des Grundspiels zählt jede Saison mit – in der DFL gilt nur diese hier
        if (dfl()) items = items.filter(it => !(it.cat === 'warn' && /ti-file-text/.test(it.icon || '') && /aus$/.test(it.title || '')));
        if (dfl() && LEAGUE.matchday >= 18) {
          const weg = SQUAD.filter(p => !dsVertrag(p) && !p.vertragFolge && p.contractUntil != null && p.contractUntil <= LEAGUE.season);   // mit Folgevertrag (D92) bleibt er
          if (weg.length) items.push({ cat: 'warn', icon: '<i class="ti ti-file-certificate"></i>',
            title: `${weg.length} ${weg.length === 1 ? 'Vertrag läuft' : 'Verträge laufen'} aus`,
            text: weg.slice(0, 4).map(p => `${name(p)} (${p.ovr})`).join(', ') + (weg.length > 4 ? ' …' : '') + ' – sonst Free Agent zum Saisonende.',
            actions: `<button class="pf-btn" onclick="DFLKader.zuVertraegen()">Verträge</button>`, prio: 2 });
        }
      } catch (e) { /* Postfach bleibt wie es ist */ }
      return items;
    };
    try { buildPostfachItems = window.buildPostfachItems; } catch (e) { /* nicht global gebunden */ }
  }
  // Wahl des Hauptsponsors erst nach dem Draft (der Saisonabschluss ruft sie direkt auf)
  {
    const _orig = window.openSponsorChoiceDialog;
    if (typeof _orig === 'function') window.openSponsorChoiceDialog = function () {
      const d = dfl() && LEAGUE.dflDraft;
      if (d && !d.fertig) { const self = this, args = arguments; oeffneDraft(() => _orig.apply(self, args)); return; }
      return _orig.apply(this, arguments);
    };
  }
  // Woche weiter: Cap-Pflicht vor Spieltag 1 und Mindestkader (D46)
  {
    const _orig = window.nextWeek;
    if (typeof _orig === 'function') window.nextWeek = function () {
      if (dfl() && LEAGUE.matchday === 0 && Array.isArray(LEAGUE.matchWeeks) && LEAGUE.week + 1 >= LEAGUE.matchWeeks[0]) {
        const f = startPruefung();
        if (f.length) {
          alert('Vor dem 1. Spieltag musst du deinen Kader regelkonform machen:\n• ' + f.join('\n• ') +
            '\nTausche Spieler, entlasse jemanden, verpflichte Free Agents oder schiebe Talente in den ' + DS + '.');
          return;
        }
      }
      // Mindestkader während der Saison (D46): 21 Spieler (ohne Development Squad und Verletztenliste)
      if (dfl() && saisonLaeuft() && hauptkader().length < MIN()) {
        alert(`Dein Kader hat nur ${hauptkader().length} Spieler – mindestens ${MIN()} sind Pflicht. ` +
          `Verpflichte einen Free Agent (Transfermarkt → „Ablösefrei“) oder hol jemanden aus dem ${DS} hoch.`);
        return;
      }
      // D136: zwei Torhüter während der Saison (Trade, Entlassung, Abwerbung, Verletztenliste)
      if (dfl() && saisonLaeuft() && twFehlt()) {
        alert(`${twText()}. Verpflichte einen Torhüter (Transfermarkt → „Ablösefrei“) oder hol einen aus dem ${DS} hoch.`);
        return;
      }
      return _orig.apply(this, arguments);
    };
  }
  // Wochentakt: KI-Trades, Draft-Board, Free-Agency-Wellen, Saisonvorbereitung der KI. Hängt an advanceCalendarWeek,
  // nicht an nextWeek – Wochen mit eigenem Spiel enden über postMatchContinue → advanceCalendarWeek (vorher liefen
  // dort weder KI-Trades noch FA-Wellen: in der Vorbereitung nur 1 von 4 Wellen, in der Saison kaum Trades).
  {
    const _orig = window.advanceCalendarWeek;
    if (typeof _orig === 'function') window.advanceCalendarWeek = function () {
      const wocheVorher = dfl() ? LEAGUE.week : null;
      const r = _orig.apply(this, arguments);
      if (dfl() && LEAGUE.week !== wocheVorher) {
        try {
          const md = LEAGUE.matchday, marke = LEAGUE.season * 100 + (md || LEAGUE.week);
          // KI-Trades: in der Vorbereitung jede Woche, in der Saison jeden 3. Spieltag bis zur Deadline
          if (CLUB.dfl.tradeMarke !== marke && ((md === 0 && LEAGUE.week >= 2 && LEAGUE.week <= 5) || (md > 0 && md < H.CFG.deadlineSpieltag && md % 3 === 0))) {
            CLUB.dfl.tradeMarke = marke;
            kiTradeRunde(1);
          }
          if (md >= 13 && CLUB.dfl.zwischenstand !== LEAGUE.season) { CLUB.dfl.zwischenstand = LEAGUE.season; draftZwischenstand(); }
        } catch (e) { console.warn('[DFL-Kader] KI-Trades/Draft-Board', e); }
      }
      if (dfl() && LEAGUE.week !== wocheVorher && LEAGUE.matchday === 0) {
        try {
          if (LEAGUE.week >= 2 && LEAGUE.week <= 5 && CLUB.dfl.faWoche !== LEAGUE.season * 100 + LEAGUE.week) {
            CLUB.dfl.faWoche = LEAGUE.season * 100 + LEAGUE.week;
            faWelle(0.3);
          }
          if (Array.isArray(LEAGUE.matchWeeks) && LEAGUE.week + 1 >= LEAGUE.matchWeeks[0]) vorbereitung();
          capSetzen();
        } catch (e) { console.warn('[DFL-Kader] Wochenablauf', e); }
      }
      return r;
    };
    try { advanceCalendarWeek = window.advanceCalendarWeek; } catch (e) { /* nur im Spiel */ }
  }
  // Ablösefrei verpflichtet: Spieler aus der Welt nehmen, Charakter und Gesicht übernehmen
  {
    const _orig = window.signFreeAgent;
    if (typeof _orig === 'function') window.signFreeAgent = function (faId, years) {
      if (dfl() && years != null && grenzeAktiv() && hauptkader().length >= KADER) {
        alert(`Der Kader ist voll (${KADER}). Ab dem Kaderschnitt erst Platz schaffen: entlassen, in den ${DS} oder tauschen.`); return;
      }
      const vorher = SQUAD.length;
      // Spielfassung aus dem Free-Agent-Spiegel (zuSpielSpieler): Positionen und Technik stehen dort fest. Das Basisspiel
      // übernahm sie nicht, migratePlayer würfelte dann neu (ZM → AM, Technik zufällig; Prüfung 2026-10-10)
      const fa = dfl() && years != null ? (CLUB.freeAgents || []).find(x => x.id === faId) : null;
      const r = _orig.apply(this, arguments);
      if (dfl() && years != null && SQUAD.length > vorher) {
        const L = D.liga(), wid = String(faId).replace(/^fa_/, ''), w = L.freie.find(p => p.id === wid);
        const q = SQUAD.find(x => x.id === 'sq_' + faId);
        if (q && fa) Object.assign(q, { positions: (fa.positions || [fa.pos]).slice(), pos: fa.pos, technik: fa.technik, styleXP: {}, _posMigrated: true });
        if (w) {
          L.freie.splice(L.freie.indexOf(w), 1);
          // Karriere (Statistik, Titel, Preise) zieht mit um – vorher begann sie im neuen Verein bei null
          if (q) Object.assign(q, { dflId: w.id, dflSeed: w.seed, traits: (w.traits || []).slice(), vertragsprofil: Object.assign({}, w.vertragsprofil),
            entwicklungstyp: w.entwicklungstyp, entwicklungstypBekannt: w.entwicklungstypBekannt, heimat: w.heimat, dflVertragBis: null,
            karriere: w.karriere || q.karriere, verwandt: w.verwandt || q.verwandt });
        }
        capSetzen(); faSpiegel(); D.weltGeaendert();
      }
      return r;
    };
    try { signFreeAgent = window.signFreeAgent; } catch (e) { /* nur im Spiel */ }
  }
  // Spieler im Development Squad spielen nicht (zählen nicht zum Spieltagskader)
  {
    const _orig = window.isAvailable;
    if (typeof _orig === 'function') window.isAvailable = function (p) {
      if (p && p.perspektiv && dfl()) return false;
      return _orig.apply(this, arguments);
    };
  }
  // Karrierestart: Start-Cap, Free-Agent-Pool in der Welt, Gehaltsbudget aus dem Cap
  {
    const _orig = window.startNewGameState;
    window.startNewGameState = async function () {
      const r = await _orig.apply(this, arguments);
      faEinstellungen(!dfl());
      const W = window.DFL_WECHSEL;
      if (dfl() && W) {
        // D143: Vereinswechsel – Cap der laufenden Saison, Dead Cap des neuen Vereins aus der Welt, kein Start-Markt
        const t = D.liga().teams.find(x => x.id === D.eigeneDflId()) || {};
        Object.assign(CLUB.dfl, { cap: W.cap, capLimit: W.cap, capVorjahr: W.capVorjahr || W.cap, deadCap: t.dead_cap_total || 0,
          scoutingStufe: (CLUB.facilities && CLUB.facilities.scouting) || 5, scoutingAlter: 0 });
        faSpiegel(); capSetzen();
      } else if (dfl()) {
        Object.assign(CLUB.dfl, { cap: START_CAP, capLimit: START_CAP, deadCap: 0, scoutingStufe: (CLUB.facilities && CLUB.facilities.scouting) || 5, scoutingAlter: 0 });
        const L = D.liga();
        L.saisonIndex = 0;
        faStartpool(L);
        faSpiegel(); capSetzen();
        const zuviel = capBelegt() - capLimit();
        // D108: Start am Tag der Verträge – Cap und eigene Abgänge stehen erst nach deiner Entscheidung fest (dfl_startdraft.js)
        const startTag = !!(L._start && S.startDraftAn && S.startDraftAn(S.CFG.start));
        if (!startTag) addNews('club', '💶 Cap-Lage zum Start', `Belegt: ${mio(capBelegt())} von ${mio(capLimit())}. ` + (zuviel > 0
          ? `${mio(zuviel)} über dem Cap – bis Spieltag 1 tauschen oder entlassen.`
          : `Frei: ${mio(-zuviel)} für Free Agents.`));
        // D74: Start mit 25 – was auf dem Markt ist und wer bei dir ausgelaufen ist (die KI greift ab Woche 2 zu)
        const sm = L.startMarkt;
        if (sm && sm.abgaenge) {
          const alle = L.freie, eigene = alle.filter(p => p._exVerein === D.eigeneDflId());
          addNews('transfer', `🆓 Free Agency zum Start: ${alle.length} Spieler`,
            (startTag ? `Bei allen Vereinen sind Verträge ausgelaufen, die anderen gehen mit ${sm.kader} Spielern in den Draft. `
              : `Bei allen Vereinen sind Verträge ausgelaufen, jeder startet mit ${sm.kader}. `) + `Auf dem Markt: ${alle.filter(p => p.ovr >= 80).length} mit Stärke 80+, ` +
            `${alle.filter(p => p.age >= 30).length} ab 30, ${alle.filter(p => p.age <= 23).length} bis 23 Jahre. ` +
            (eigene.length ? `Bei dir ausgelaufen: ${eigene.map(p => `${name(p)} (${p.pos}, ${p.ovr})`).join(', ')}. ` : '') +
            'Woche 1 gehört dir, ab Woche 2 greifen die anderen zu.');
        }
        if (typeof saveGameState === 'function') await saveGameState();
      }
      return r;
    };
  }
  // Laden: Einstellungen und Budget aus dem Cap; offener Draft geht weiter
  {
    const _orig = window._afterLoad;
    if (typeof _orig === 'function') window._afterLoad = function () {
      const r = _orig.apply(this, arguments);
      faEinstellungen(!dfl());
      if (dfl()) {
        capSetzen();
        if (LEAGUE.dflDraft && !LEAGUE.dflDraft.fertig) setTimeout(() => oeffneDraft(null), 1200);
      }
      return r;
    };
  }
  // Spielerkarte: Cap Hit, Vertrag, Development Squad, „Entlassen“
  {
    const _orig = window.renderPlayerCard;
    if (typeof _orig === 'function') window.renderPlayerCard = function (p) {
      const r = _orig.apply(this, arguments);
      const el = document.getElementById('playercard-sec');
      if (dfl() && p && el && SQUAD.some(x => x.id === p.id) && !el.querySelector('.dfl-vertrag')) {
        const dead = deadCapVon(p);
        const pkKnopf = p.perspektiv ? `<button class="dfl-draft-btn leise" onclick="DFLKader.hochziehen('${p.id}')">Hochziehen${dsVertrag(p) ? ' (Profivertrag)' : ''}</button>`
          : pkTauglich(p) ? `<button class="dfl-draft-btn leise" onclick="DFLKader.inPerspektivkader('${p.id}')">→ ${DS}</button>` : '';
        el.insertAdjacentHTML('beforeend', `<div class="dfl-vertrag">
          <div>${p.perspektiv ? `<b>${DS}</b> · spielt nicht · ` : ''}<b>Cap Hit ${mio(capHitJahr(p))}</b> · Vertrag bis ${typeof seasonEndYear === 'function' ? seasonEndYear(p.contractUntil) : 'Saison ' + p.contractUntil}
          ${p.rookieVertrag ? ` · Rookie (Pick #${p.rookieVertrag.pick}, ${p.rookieVertrag.jahr})` : ''}</div>
          <span class="dfl-draft-aktionen">${pkKnopf}<button class="dfl-draft-btn leise" onclick="DFLKader.entlassen('${p.id}')">Entlassen${dead ? ' · Dead Cap ' + mio(dead) : ''}</button></span></div>`);
      }
      return r;
    };
  }
  // Kaderliste: Spieler im Development Squad markieren
  {
    const _orig = window.renderSquadList;
    if (typeof _orig === 'function') window.renderSquadList = function () {
      const r = _orig.apply(this, arguments);
      if (dfl() && perspektivkader().length) {
        const ids = new Set(perspektivkader().map(p => p.id));
        document.querySelectorAll('#squad-list .squad-row').forEach(row => {
          const attr = (row.getAttribute('onclick') || '') + ' ' + (row.getAttribute('ondragstart') || '');
          const treffer = [...ids].find(id => attr.indexOf("'" + id + "'") >= 0);
          if (treffer && !row.querySelector('.dfl-pk')) {
            const n = row.querySelector('.squad-name') || row;
            n.insertAdjacentHTML('beforeend', ' <span class="dfl-pk" title="' + DS + '">DS</span>');
          }
        });
      }
      return r;
    };
  }
  // Startseite: Hinweis, solange der Kader vor Spieltag 1 nicht regelkonform ist
  {
    const _orig = window.renderHomeTab;
    if (typeof _orig === 'function') window.renderHomeTab = function () {
      const r = _orig.apply(this, arguments);
      const alt = document.getElementById('dfl-cap-hinweis'); if (alt) alt.remove();
      if (dfl() && LEAGUE.matchday === 0) {
        const f = startPruefung();
        const ziel = document.querySelector('#view-home') || document.querySelector('.app');
        if (f.length && ziel) ziel.insertAdjacentHTML('afterbegin', `<div id="dfl-cap-hinweis" class="dfl-hinweis">⚠️ Vor dem 1. Spieltag: ${f.join(' · ')}</div>`);
      }
      return r;
    };
  }
  // Scouting-Tab: Draft-Jahrgänge über der Scouting-Abteilung
  {
    const _orig = window.renderScoutTab;
    if (typeof _orig === 'function') window.renderScoutTab = function () {
      const r = _orig.apply(this, arguments);
      if (dfl()) {
        let box = document.getElementById('dfl-draftboard');
        const banner = document.getElementById('scout-banner');
        if (!box && banner) { box = document.createElement('div'); box.id = 'dfl-draftboard'; banner.insertAdjacentElement('afterend', box); }
        if (box) { try { box.innerHTML = vorschauHtml(); } catch (e) { console.warn('[DFL-Kader] Draft-Vorschau', e); } }
      }
      return r;
    };
  }
  // Alte Meldung des Altspieler-Markts in der DFL unterdrücken
  {
    const _orig = window.addNews;
    window.addNews = function (kat, titel) {
      if (dfl() && /ablösefreie Spieler verfügbar/.test(String(titel || ''))) return;
      return _orig.apply(this, arguments);
    };
  }

  // Spielstand schon vor diesem Modul geladen (initGame lädt während des Skript-Ladens): nachholen
  if (dfl()) {
    faEinstellungen(false); capSetzen();
    if (LEAGUE.dflDraft && !LEAGUE.dflDraft.fertig) setTimeout(() => oeffneDraft(null), 1500);
  }

  // Anpfiff erst mit Mindestkader und zwei Torhütern (D136, Nutzer 2026-10-14: „Ja Mindestkader auch“). Beim Seitenstart als
  // äußerster Wrapper um simulateCurrentFixture, damit Ticker und Engine-Patches gar nicht erst anlaufen.
  window.addEventListener('load', () => {
    const _sim = window.simulateCurrentFixture;
    if (typeof _sim !== 'function' || _sim._kaderPflicht) return;
    window.simulateCurrentFixture = function () {
      if (dfl() && saisonLaeuft() && (hauptkader().length < MIN() || twFehlt())) {
        const grund = hauptkader().length < MIN() ? `Dein Kader hat nur ${hauptkader().length} Spieler, mindestens ${MIN()} sind Pflicht` : twText();
        if (typeof showToast === 'function') showToast(grund + '.', 'error'); else alert(grund + '.');
        try { if (window.DFLAppShell && DFLAppShell.kaderschnitt) DFLAppShell.kaderschnitt(); } catch (e) { /* nur Hilfe */ }
        return;
      }
      return _sim.apply(this, arguments);
    };
    window.simulateCurrentFixture._kaderPflicht = true;
    try { simulateCurrentFixture = window.simulateCurrentFixture; } catch (e) { /* nicht global gebunden */ }
  });

  console.log('%c[DFL-Kader v2] aktiv', 'color:#3fb950;font-weight:bold',
    '— Cap, Offseason der Welt, Draft (KI nach Scouting + Bedarf), Free Agency in Wellen, Development Squad, Mindestkader 21, Scouting veraltet');
})();
