/* ═══════════════════════════════════════════════════════════════════════════
   DFL · SIMULIEREN BIS …  ·  v1   (D64 + D62 · 1–3, freigegeben 2026-10-10: „arbeite alles in die App ein“)
   ─────────────────────────────────────────────────────────────────────────
   „Simulieren bis …“ (D64, Vorschau spiel/dfl_simulieren_vorschau.html):
     · Knopf „bis …“ rechts am Haupt-Button (#app-cta; am PC neben „Woche weiter“) öffnet ein Blatt mit Zielen je Phase:
       Vorbereitung: Free Agency (bis KW 2), Saisonstart · Hauptrunde: 4 Wochen, Trade-Deadline, Ende der Hauptrunde,
       Saisonende (mit Playoffs) · Playoffs: Saisonende
     · Woche für Woche wie von Hand: eigene Spiele mit der Engine wie beim Anpfiff (ohne Ticker: DFLTextspiel.ohne), danach
       postMatchContinue → advanceCalendarWeek; Wochen ohne eigenes Spiel über nextWeek. Nichts wird doppelt gebucht.
     · Halt immer: Draft, Kader regelkonform vor Spieltag 1, Mindestkader, eigenes Playoff-Spiel, Saison abschließen,
       Fenster, die das Spiel öffnet und das Blatt nicht kennt
     · Schalter (je Gerät, localStorage 'dfl-sim'): Trade-Anfrage (an; „Später“ hält vor Ablauf noch einmal), Ereignis mit
       Entscheidung (an; aus = erste Antwort), Verletzung in der Startelf (aus; die Beste Elf ersetzt ihn vor dem Spiel)
     · Ticker je Woche: Ergebnis, Torschützen, Platz in der Conference ▲▼, Ausfälle und Rückkehrer, Sperren, Meldungen;
       Tippen auf einen Spieltag öffnet die Konferenz
     · Zusammenfassung: Bilanz, bester Schütze, Platz-Verlauf mit Playoff-Linie, Playoff-Chance vorher → nachher,
       „Braucht dich“ (offene Anfragen, Streik, Trade-Wunsch, Unzufriedene – nur Liste), nächster Gegner, Tabelle
     · Schneller weiterklicken: während des Laufs keine unsichtbaren Ansichten zeichnen, keine Hinweise, Speichern alle
       4 Wochen und an jedem Halt; immer (auch „Woche weiter“): Transfer- und Scouting-Reiter erst beim Öffnen zeichnen
   „DFL auf einen Blick“ (D62 · 1–3, Vorschau spiel/dfl_intuitiv_vorschau.html):
     · Spielvorschau: Sieg/Remis/Niederlage aus der Formel der Brücke (DFLSaison.toreErwartet mit Stil, wie
       dfl_engine_patch.js), Stärke, Form, Stil-Duell, Gefahr (Torjäger), ihre Besten, deine Elf – im Office, vor dem
       Anpfiff und in „bis …“
     · Konferenz: alle Spiele des Spieltags mit Torschützen, eigenes Spiel oben, Platz ▲▼ – im Spielbericht, im Reiter Liga
       („Spieltag“, auch per Antippen des Laufbands) und in „bis …“
     · Tabelle: Conference in Setzplatz-Reihenfolge (Divisionssieger 1–4, Wildcards 5–7, Freilos), Playoff-Linie nach 7,
       ▲▼ zum letzten Spieltag, Playoff-Chance aus 300 Simulationen (DFLAnalysten.quotenRechnen) – Reiter Liga und „bis …“
   Zustand: LEAGUE.dflKonferenz = { saison, tage: { [Spieltag]: [[heim, gast, th, tg, 'Schützen heim', 'Schützen gast']] } }
   (nur die laufende Saison, ≈ 30 KB am Saisonende). Die Torschützen der KI-Spiele kommen aus DFLStatistik (vor/nach dem
   Spiel verglichen), die eigenen aus dem Spiel (G.scorers).
   Hängt sich an: recordResult, saveGameState, showToast, alert, addNews, PostMatchModal.show, renderHomeTab,
   renderLeagueTab, renderClubTab, renderPostfach, renderTransferTab, renderScoutTab, renderLgTabelle, switchLigaSubview,
   renderCalendarWidget, switchAppView, simulateCurrentFixture.
   Lädt nach dfl_kenney_patch.js, vor init_bootstrap.js. CSS: css/dfl_simulieren.css.
   API: DFLSimulieren.ziele() · .starte(key, opt) · .oeffnen() · .lauf() · .laeuft() · .vorschauDaten() · .vorschauHtml()
        · .konferenzHtml(nr) · .tabelleHtml(konf) · .chancen(rechnen) · .setzOrdnung(zeilen) · .dreiWege(a, b) · .einstellungen()
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const D = window.DFLSpiel, S = window.DFLSaison;
  if (!D || !S) { console.warn('[DFL-Simulieren] DFLSpiel/DFLSaison fehlen – Patch inaktiv'); return; }

  // ── Grundlagen ───────────────────────────────────────────────────────────
  const dfl = () => typeof CLUB !== 'undefined' && CLUB && CLUB.dfl && CLUB.dfl.aktiv && typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.dfl;
  const hatDom = () => typeof document !== 'undefined' && !!document && !!document.body && typeof document.createElement === 'function';
  const jetzt = () => (typeof performance !== 'undefined' && performance && performance.now ? performance.now() : Date.now());
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ic = n => `<i class="ti ti-${n}" aria-hidden="true"></i>`;
  const ruhig = () => !!(typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const warte = ms => new Promise(res => setTimeout(res, ms));
  const prozent = x => Math.round(x) + ' %';

  // Schalter und letztes Ziel je Gerät
  const LS = 'dfl-sim';
  let EIN = null;
  function einstellungen() {
    if (EIN) return EIN;
    let e = {};
    try { e = JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch (x) { e = {}; }
    EIN = { anfrage: e.anfrage !== false, ereignis: e.ereignis !== false, verletzung: e.verletzung === true, ziel: e.ziel || null };
    return EIN;
  }
  function einstellungSetzen(k, v) {
    einstellungen()[k] = v;
    try { localStorage.setItem(LS, JSON.stringify(EIN)); } catch (x) { /* ohne Speicher: bis zum Neuladen */ }
  }

  // Vereine: Namen nur aus der Franchise (erfundene Namen, D57) – nie die interne ID (enthält echte Vereinsnamen)
  const ligaTeams = () => { try { return LEAGUE.tiers.bundesliga.groups[0].teams; } catch (e) { return []; } };
  const teamVon = (id, quelle) => (quelle || ligaTeams()).find(t => t.id === id) || null;
  const franchise = id => { try { return D.franchise(id) || null; } catch (e) { return null; } };
  const kuerzel = id => (window.DFLNamen && DFLNamen.kuerzel && DFLNamen.kuerzel(id)) || (franchise(id) || {}).kurz || '–';
  const vereinsName = id => (id === 'fcm' && typeof CLUB !== 'undefined' && CLUB && CLUB.name) ? CLUB.name : ((franchise(id) || {}).name || kuerzel(id));
  const spielIdVon = id => { try { return D.spielId(D.dflIdVon(id)); } catch (e) { return id; } };
  const wappen = (id, kl) => `<span class="lg-crest ${kl || 'sim-wappen'}" style="${typeof crestStyle === 'function' ? crestStyle(spielIdVon(id)) : ''}" aria-hidden="true"></span>`;
  const spielerName = p => !p ? '' : (typeof displayName === 'function' ? displayName(p) : ((p.firstName ? p.firstName.charAt(0) + '. ' : '') + (p.name || '')));
  const konfName = k => (D.KONF && D.KONF[k]) || k || '';
  const kalender = w => (typeof calendarLabel === 'function' ? calendarLabel(w, LEAGUE.startYear || 2026) : 'KW' + w);
  const monatKurz = w => { const l = kalender(w).split(' · ')[1] || ''; return l.slice(0, 3); };
  const posName = p => p === 'OM' ? 'ZOM' : p;

  // ══ 1) Spieltag merken: alle Spiele mit Torschützen (D62 · 2) ══════════
  function konfSpeicher(anlegen) {
    if (typeof LEAGUE === 'undefined' || !LEAGUE) return null;
    let k = LEAGUE.dflKonferenz;
    if (!k || k.saison !== LEAGUE.season || !k.tage) {
      if (!anlegen) return null;
      k = LEAGUE.dflKonferenz = { saison: LEAGUE.season, tage: {} };
    }
    return k;
  }
  // Tore je Welt-Spieler eines KI-Vereins (DFLStatistik) – vor und nach dem Spiel verglichen
  function torStand(spielId) {
    const St = window.DFLStatistik;
    if (!St || !St.daten || spielId === 'fcm') return null;
    const rec = St.daten(D.liga().saisonJahr, false), tab = rec && rec.ki ? rec.ki[D.dflIdVon(spielId)] : null, m = {};
    if (tab) Object.keys(tab).forEach(pid => { m[pid] = tab[pid][0] || 0; });
    return m;
  }
  function weltSpieler(L, dflTeamId, pid) {
    const t = L.teams.find(x => x.id === dflTeamId);
    const suche = liste => (liste || []).find(p => p.id === pid);
    let p = t ? (suche(t.roster) || suche(t.practice_squad)) : null;
    if (!p) L.teams.some(x => (p = suche(x.roster) || suche(x.practice_squad)));
    return p || suche(L.freie) || null;
  }
  function schuetzenText(namen) {
    const m = new Map();
    namen.filter(Boolean).forEach(n => m.set(n, (m.get(n) || 0) + 1));
    return [...m].map(([n, k]) => (k > 1 ? n + ' ' + k : n)).join(', ');
  }
  function eigeneSchuetzen() {
    if (typeof G === 'undefined' || !G || !Array.isArray(G.scorers)) return '';
    return schuetzenText(G.scorers.map(s => {
      const p = s.id != null && typeof getPlayer === 'function' ? getPlayer(s.id) : null;
      return p ? spielerName(p) : (s.name || '');
    }));
  }
  function schuetzenNach(spielId, vorher) {
    if (spielId === 'fcm') return eigeneSchuetzen();
    const St = window.DFLStatistik;
    if (!St || !St.daten || !vorher) return '';
    const L = D.liga(), dflId = D.dflIdVon(spielId), rec = St.daten(L.saisonJahr, false), tab = rec && rec.ki ? rec.ki[dflId] : null;
    if (!tab) return '';
    const namen = [];
    Object.keys(tab).forEach(pid => {
      const n = (tab[pid][0] || 0) - (vorher[pid] || 0);
      if (n > 0) { const p = weltSpieler(L, dflId, pid); for (let i = 0; i < n; i++) namen.push(p ? spielerName(p) : ''); }
    });
    return schuetzenText(namen);
  }
  function spielMerken(h, g, th, tg, vor) {
    const k = konfSpeicher(true), nr = (LEAGUE.matchday || 0) + 1;       // advanceMatchday zählt erst nach allen Spielen hoch
    const tag = k.tage[nr] || (k.tage[nr] = []);
    tag.push([h, g, th, tg, schuetzenNach(h, vor && vor[0]), schuetzenNach(g, vor && vor[1])]);
  }
  {
    const _orig = window.recordResult;
    if (typeof _orig === 'function') {
      window.recordResult = function (teams, h, g, th, tg) {
        let vor = null;
        if (dfl()) { try { vor = [torStand(h), torStand(g)]; } catch (e) { vor = null; } }
        const r = _orig.apply(this, arguments);
        if (dfl()) { try { spielMerken(h, g, th, tg, vor); } catch (e) { console.warn('[DFL-Simulieren] Konferenz', e); } }
        return r;
      };
      try { recordResult = window.recordResult; } catch (e) { /* window.recordResult reicht */ }
    }
  }

  // ══ 2) Tabelle: Setzplätze, Playoff-Linie, Chance (D62 · 3) ════════════
  const sortiere = arr => arr.slice().sort((a, b) => (b.pts - a.pts) || ((b.gf - b.ga) - (a.gf - a.ga)) || (b.gf - a.gf) || String(a.name || '').localeCompare(String(b.name || '')));
  // Conference so, wie die Playoffs sie sehen (wie DFLSpiel.setzliste): 4 Divisionssieger, 3 Wildcards, der Rest
  function setzOrdnung(zeilen) {
    const divs = [...new Set(zeilen.map(t => t.division))];
    const sieger = sortiere(divs.map(d => sortiere(zeilen.filter(t => t.division === d))[0]).filter(Boolean));
    const rest = sortiere(zeilen.filter(t => sieger.indexOf(t) < 0));
    return sieger.map((t, i) => ({ t, seed: i + 1, zone: 'division' }))
      .concat(rest.map((t, i) => ({ t, seed: i < 3 ? sieger.length + 1 + i : null, zone: i < 3 ? 'wildcard' : null })))
      .map((x, i) => Object.assign(x, { platz: i + 1 }));
  }
  const konfZeilen = (konf, quelle) => (quelle || ligaTeams()).filter(t => t.conference === konf);
  function platzVon(id, quelle) {
    const t = teamVon(id, quelle);
    if (!t || !t.conference) return null;
    const o = setzOrdnung(konfZeilen(t.conference, quelle)), x = o.find(z => z.t.id === id);
    return x ? x.platz : null;
  }
  // Tabelle vor dem letzten Spieltag: dessen Ergebnisse wieder abziehen (für ▲▼)
  function vorigeTabelle() {
    const k = konfSpeicher(false), spiele = k && k.tage[LEAGUE.matchday];
    if (!spiele || !spiele.length || (LEAGUE.matchday || 0) < 2) return null;
    const m = new Map(ligaTeams().map(t => [t.id, { id: t.id, name: t.name, conference: t.conference, division: t.division, pts: t.pts, gf: t.gf, ga: t.ga }]));
    spiele.forEach(([h, g, th, tg]) => {
      const H = m.get(h), A = m.get(g);
      if (H) { H.gf -= th; H.ga -= tg; H.pts -= th > tg ? 3 : th === tg ? 1 : 0; }
      if (A) { A.gf -= tg; A.ga -= th; A.pts -= tg > th ? 3 : th === tg ? 1 : 0; }
    });
    return [...m.values()];
  }
  // Playoff-Chance je Verein (Spiel-ID → %) aus der Simulation der Analysten; einmal je Woche gerechnet
  let CHANCEN = null;
  function chancen(rechnen) {
    if (!dfl() || !window.DFLAnalysten || typeof DFLAnalysten.quotenRechnen !== 'function') return null;
    const key = [LEAGUE.season, LEAGUE.matchday, LEAGUE.week].join(':');
    if (CHANCEN && CHANCEN.key === key) return CHANCEN.werte;
    if (!rechnen) return null;
    const t0 = jetzt(), werte = {};
    try { DFLAnalysten.quotenRechnen(300).forEach(x => { werte[spielIdVon(x.id)] = { po: Math.round((x.po || 0) / 10), titel: Math.round((x.p || 0) / 10) }; }); }
    catch (e) { console.warn('[DFL-Simulieren] Playoff-Chance', e); return null; }
    CHANCEN = { key, werte, ms: Math.round(jetzt() - t0) };
    return werte;
  }
  const chanceKlasse = p => (p >= 70 ? 'hoch' : p >= 30 ? 'mittel' : 'tief');
  const poLaeuft = () => !!(LEAGUE.dflPO && LEAGUE.dflPO.saison === LEAGUE.season);
  // Tabelle einer Conference (D62 · 3); opt.max = nur die ersten Zeilen (Zusammenfassung)
  function tabelleHtml(konf, opt) {
    opt = opt || {};
    const zeilen = konfZeilen(konf);
    if (!zeilen.length) return '';
    const ordnung = setzOrdnung(zeilen), vorher = vorigeTabelle();
    const vorPlatz = vorher ? new Map(setzOrdnung(konfZeilen(konf, vorher)).map(x => [x.t.id, x.platz])) : null;
    const ch = poLaeuft() ? null : chancen(!!opt.rechnen);
    const po = poLaeuft() ? LEAGUE.dflPO : null;
    const chanceZelle = id => {
      if (po) { const drin = (po.setzliste[konf] || []).indexOf(id) >= 0; return `<span class="sim-chance ${drin ? 'hoch' : 'tief'}">${drin ? ic('check') : '–'}</span>`; }
      if (!ch) return '<span class="sim-chance warten" aria-label="wird gerechnet">…</span>';
      const p = (ch[id] || {}).po || 0;
      return `<span class="sim-chance ${chanceKlasse(p)}">${p} %</span>`;
    };
    const pfeil = x => {
      if (!vorPlatz || !vorPlatz.has(x.t.id)) return '';
      const d = vorPlatz.get(x.t.id) - x.platz;
      return d > 0 ? `<span class="sim-auf" aria-label="${d} Plätze besser">▲${d}</span>` : d < 0 ? `<span class="sim-ab" aria-label="${-d} Plätze schlechter">▼${-d}</span>` : '';
    };
    // Ausschnitt (Zusammenfassung): die ersten Plätze, der eigene Verein immer dabei
    let zeigen = ordnung.slice(0, opt.max || ordnung.length);
    const eigen = ordnung.find(x => x.t.id === 'fcm');
    const luecke = eigen && zeigen.indexOf(eigen) < 0;
    if (luecke) zeigen = zeigen.concat([eigen]);
    const rows = zeigen.map(x => {
      const t = x.t, td = t.gf - t.ga;
      return `${luecke && x === eigen ? '<tr class="sim-luecke" aria-hidden="true"><td colspan="6">…</td></tr>' : ''}<tr class="${t.id === 'fcm' ? 'eigen' : ''}${x.platz === 7 ? ' linie' : ''}">
        <td class="sim-platz"><span class="sim-platz-in">${x.seed ? `<span class="sim-seed ${x.zone}" title="${x.zone === 'division' ? 'Divisionssieger' : 'Wildcard'}">${x.seed}</span>` : `<span class="sim-blass">${x.platz}</span>`}<span class="sim-pf">${pfeil(x)}</span></span></td>
        <td class="sim-verein"><span>${wappen(t.id)}<b>${esc(kuerzel(t.id))}</b>${x.seed === 1 ? `<span class="sim-krone" title="Freilos in Runde 1">${ic('crown')}</span>` : ''}<small>${esc(t.division || '')}</small></span></td>
        <td>${t.played || 0}</td><td>${td > 0 ? '+' : ''}${td}</td><td><b>${t.pts || 0}</b></td><td>${chanceZelle(t.id)}</td></tr>`;
    }).join('');
    return `<table class="sim-tab" data-konf="${esc(konf)}"><thead><tr><th scope="col"><span class="sim-sr">Seed</span></th><th scope="col">Verein</th><th scope="col">Sp</th>
      <th scope="col">TD</th><th scope="col">Pkt</th><th scope="col">${po ? 'Drin' : 'Chance'}</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="sim-legende"><span><span class="sim-seed division">1</span> Divisionssieger</span><span><span class="sim-seed wildcard">5</span> Wildcard</span>
        <span>${ic('crown')} Freilos</span><span class="sim-linie-text">– – – Playoff-Linie</span></div>`;
  }

  // ══ 3) Spielvorschau mit Siegchance (D62 · 1) ═══════════════════════════
  // Nächstes eigenes Pflichtspiel: Playoffs (Runde mit eigenem Spiel) oder Liga; Testspiele haben keine Vorschau
  function naechstesSpiel() {
    if (!dfl()) return null;
    const P = window.DFLPlayoffs;
    const po = P && P.stand ? P.stand() : null;
    if (po) {
      if (po.meister || po.runde > 4 || !P.eigenesSpiel) return null;
      const sp = P.eigenesSpiel(po);
      if (!sp) return null;
      // D166: Hin- und Rückspiel – im Hinspiel ist der schlechtere Seed Gastgeber; vor = Hinspiel aus eigener Sicht
      const b = P.bein ? P.bein(sp) : 0, heim = (P.gastgeber ? P.gastgeber(sp) : sp.heim) === 'fcm';
      const vor = sp.hin ? (sp.heim === 'fcm' ? [sp.hin.gh, sp.hin.ga] : [sp.hin.ga, sp.hin.gh]) : null;
      return { typ: 'playoff', gegner: sp.heim === 'fcm' ? sp.gast : sp.heim, heim: sp.neutral ? false : heim, neutral: !!sp.neutral, runde: sp.runde,
        rundeName: (P.RUNDE && P.RUNDE[sp.runde]) || 'Playoffs', woche: po.wochen[sp.runde - 1], finalort: sp.neutral ? po.finalort : null, bein: b, vor };
    }
    if (typeof seasonFullyComplete === 'function' && seasonFullyComplete(LEAGUE)) return null;
    const nx = typeof fcmNextFixture === 'function' ? fcmNextFixture(LEAGUE) : null;
    if (!nx) return null;
    return { typ: 'liga', gegner: nx.opponentId, heim: !!nx.isHome, neutral: false, spieltag: nx.matchday, woche: (LEAGUE.matchWeeks || [])[nx.matchday - 1] };
  }
  // Torerwartung wie die Brücke (dfl_engine_patch.js): eigener Verein und Gegner aus der Welt, Stil, Heimvorteil
  function erwartung(sp) {
    const L = D.liga(), Tk = window.DFLTaktik;
    const eig = D.eigenSync() || L.teams.find(t => t.id === D.eigeneDflId()), geg = L.teams.find(t => t.id === D.dflIdVon(sp.gegner));
    if (!eig || !geg || !eig.roster || !geg.roster) return null;
    // wie die Brücke (dfl_engine_patch.js, D102): eigene verfügbare Elf in ihrer Formation, ohne Gesperrte und Streikende
    const fehlt = new Set((typeof SQUAD !== 'undefined' && SQUAD ? SQUAD : []).filter(q => q && (q.onStrike || (typeof isSuspended === 'function' && isSuspended(q)))).map(q => q.dflId || q.id));
    const eigFit = fehlt.size ? Object.assign({}, eig, { roster: eig.roster.filter(w => !fehlt.has(w.id)) }) : eig;
    const wo = S.teamWerte(eigFit, { formation: typeof CLUB !== 'undefined' && CLUB ? CLUB.formation : undefined }), wg = S.teamWerte(geg);
    try { wo.stil = Tk && Tk.stilInfo ? Tk.stilInfo('fcm') : null; wg.stil = Tk && Tk.stilInfo ? Tk.stilInfo(sp.gegner) : null; } catch (e) { /* ohne Stil */ }
    const tag = LEAGUE.matchday || 0, h = S.CFG.heimvorteil;
    const lam = sp.neutral ? S.toreErwartet(wo, wg, 0, tag) : sp.heim ? S.toreErwartet(wo, wg, h, tag) : S.toreErwartet(wg, wo, h, tag).reverse();
    return { lam, wo, wg, geg };
  }
  // Stärke wie in Tabelle und Office-Kachel (dfl_liga_patch.js staerkeAktualisieren): Mittel der gerundeten Mannschaftsteile
  const staerkeZahl = w => (w && w.def != null && w.mid != null && w.att != null)
    ? Math.round((Math.round(w.def) + Math.round(w.mid) + Math.round(w.att)) / 3) : Math.round(w && w.ovr || 0);
  // Eigene Stärke wie im Spieltag-Kopf (app_main.js syncClubToTeams): Aufstellung mit Moral, Fitness und Positionsabzug
  const eigeneStaerke = w => {
    try { const r = typeof window.computeTeamRatings === 'function' ? window.computeTeamRatings() : null; if (r && r.overall) return r.overall; } catch (e) { /* Welt-Wert */ }
    return staerkeZahl(w);
  };
  // Sieg/Remis/Niederlage aus zwei Poisson-Verteilungen, gerundet auf zusammen 100
  function dreiWege(lE, lG) {
    const pv = (l, k) => { let p = Math.exp(-l); for (let i = 1; i <= k; i++) p *= l / i; return p; };
    let s = 0, u = 0, n = 0;
    for (let i = 0; i <= 14; i++) for (let j = 0; j <= 14; j++) { const w = pv(lE, i) * pv(lG, j); if (i > j) s += w; else if (i === j) u += w; else n += w; }
    const sum = s + u + n || 1, roh = [s / sum * 100, u / sum * 100, n / sum * 100], ganz = roh.map(Math.floor);
    let rest = 100 - ganz.reduce((a, b) => a + b, 0);
    // gleich starke Teams bleiben gleich: ein einzelner Restpunkt bei Gleichstand Sieg/Niederlage geht ans Remis
    if (rest % 2 === 1 && Math.abs(roh[0] - roh[2]) < 1e-9) { ganz[1]++; rest--; }
    roh.map((x, i) => [x - ganz[i], i]).sort((a, b) => b[0] - a[0] || (a[1] === 1 ? -1 : b[1] === 1 ? 1 : 0)).forEach(([, i]) => { if (rest > 0) { ganz[i]++; rest--; } });
    return { sieg: ganz[0], remis: ganz[1], niederlage: ganz[2], roh: { s: s / sum, u: u / sum, n: n / sum } };
  }
  // Playoffs: bei Remis Verlängerung (ein Drittel der Torerwartung), dann Elfmeterschießen (rund 50 : 50)
  // D166: im Rückspiel zählt das Gesamtergebnis (vor = Hinspiel [eigen, Gegner])
  function weiterkommen(lE, lG, c, vor) {
    const v = dreiWege(lE / 3, lG / 3).roh;
    let r = c.roh;
    if (vor && vor[0] !== vor[1]) {
      const pv = (l, k) => { let p = Math.exp(-l); for (let i = 1; i <= k; i++) p *= l / i; return p; }, d0 = vor[0] - vor[1];
      let s = 0, u = 0, n = 0;
      for (let i = 0; i <= 14; i++) for (let j = 0; j <= 14; j++) { const w = pv(lE, i) * pv(lG, j), d = i - j + d0; if (d > 0) s += w; else if (d === 0) u += w; else n += w; }
      const sum = s + u + n || 1; r = { s: s / sum, u: u / sum, n: n / sum };
    }
    return Math.round((r.s + r.u * (v.s + v.u * 0.5)) * 100);
  }
  function vorschauDaten(sp) {
    sp = sp || naechstesSpiel();
    if (!sp) return null;
    const e = erwartung(sp);
    if (!e) return null;
    const c = dreiWege(e.lam[0], e.lam[1]);
    const eigT = teamVon('fcm'), gegT = teamVon(sp.gegner);
    // Gefahr: bester Torschütze des Gegners in dieser Saison (DFLStatistik)
    let gefahr = null;
    try {
      const tj = window.DFLStatistik && DFLStatistik.torjaeger ? DFLStatistik.torjaeger(0) : [];
      const x = tj.find(z => z.teamName === e.geg.name && z.goals > 0);
      if (x) gefahr = { name: x.name, tore: x.goals, spiele: x.spiele };
    } catch (err) { gefahr = null; }
    const besten = (e.wg.elf || []).slice().sort((a, b) => b.ovr - a.ovr).slice(0, 3).map(p => ({ pos: posName(p.pos), ovr: p.ovr }));
    // Deine Elf: Ausfälle (die Beste Elf ersetzt sie vor dem Anpfiff), Vertretungen, Müde
    const elf = typeof getLineupIds === 'function' && typeof getPlayer === 'function' ? getLineupIds().map(getPlayer).filter(Boolean) : [];
    const grund = p => (typeof isInjured === 'function' && isInjured(p)) ? 'verletzt' : (typeof isSuspended === 'function' && isSuspended(p)) ? 'gesperrt' : p.onStrike ? 'Streik' : null;
    const ausfall = elf.filter(p => grund(p)).map(p => ({ name: spielerName(p), grund: grund(p) }));
    const vertretung = ((CLUB.dfl && CLUB.dfl.vertretung) || []).map(v => {
      const a = typeof getPlayer === 'function' ? getPlayer(v.stamm) : null, b = typeof getPlayer === 'function' ? getPlayer(v.ersatz) : null;
      return a && b && elf.indexOf(b) >= 0 ? { rein: spielerName(b), raus: spielerName(a), grund: grund(a) || 'zurück' } : null;
    }).filter(Boolean);
    const muede = elf.filter(p => typeof p.fitness === 'number' && p.fitness < 80).sort((a, b) => a.fitness - b.fitness).slice(0, 3)
      .map(p => ({ name: spielerName(p), fit: Math.round(p.fitness) }));
    let stil = null;
    try {
      const Tk = window.DFLTaktik, f = Tk && Tk.faktor ? Tk.faktor(sp.gegner) : null;
      if (f && f.stil) stil = { eigen: f.stil, gegner: f.gegnerStil, mult: f.mult, kreis: f.kreis };
    } catch (err) { stil = null; }
    return {
      sp, chancen: c, weiter: sp.typ === 'playoff' && sp.bein !== 1 ? weiterkommen(e.lam[0], e.lam[1], c, sp.vor) : null, lam: e.lam,
      staerke: [eigeneStaerke(e.wo), staerkeZahl(e.wg)],
      platz: [platzVon('fcm'), platzVon(sp.gegner)], pkt: [eigT ? eigT.pts : 0, gegT ? gegT.pts : 0],
      konf: [eigT && eigT.conference, gegT && gegT.conference],
      form: [(eigT && eigT.form || []).slice(-5), (gegT && gegT.form || []).slice(-5)],
      gefahr, besten, ausfall, vertretung, muede, stil
    };
  }
  const FORM = { W: ['s', 'S', 'Sieg'], D: ['u', 'U', 'Remis'], L: ['n', 'N', 'Niederlage'] };
  const formHtml = f => (f && f.length) ? `<span class="sim-form" aria-label="Form ${f.map(x => (FORM[x] || FORM.D)[2]).join(', ')}">${f.map(x => `<i class="${(FORM[x] || FORM.D)[0]}">${(FORM[x] || FORM.D)[1]}</i>`).join('')}</span>` : '<span class="sim-blass">–</span>';
  function stilText(s) {
    const T = window.DFLTaktik && DFLTaktik.STILE;
    const n = k => (T && T[k] ? T[k].kurz : k) || '–';
    const urteil = s.kreis > 0 ? ['gut', 'Vorteil'] : s.kreis < 0 ? ['schlecht', 'Nachteil'] : ['neutral', 'ausgeglichen'];
    return `<b>${esc(n(s.eigen))}</b> gegen <b>${esc(n(s.gegner))}</b> · <span class="sim-${urteil[0]}">${urteil[1]} ×${String((s.mult || 1).toFixed(2)).replace('.', ',')}</span>`;
  }
  // voll = vor dem Anpfiff und in „bis …“; office = kompakt (ohne Stil, Gefahr, ihre Besten)
  function vorschauHtml(v, art) {
    v = v || vorschauDaten();
    if (!v) return '';
    const sp = v.sp, c = v.chancen, voll = art !== 'office';
    const wo = sp.typ === 'playoff' ? `Playoffs · ${esc(sp.rundeName)}${sp.neutral ? (sp.finalort ? ' · Finale in ' + esc(sp.finalort) : ' · neutral') : sp.heim ? ' · Heim' : ' · Auswärts'}` +
        (sp.bein === 1 ? ' · Hinspiel' : sp.bein === 2 && sp.vor ? ` · Rückspiel, Hinspiel ${sp.vor[0]}:${sp.vor[1]}` : '')
      : `Spieltag ${sp.spieltag} · ${sp.heim ? 'Heimspiel' : 'Auswärts'}`;
    // Platz in der Conference (Setz-Reihenfolge) mit ihrem Namen – sonst verwechselt man ihn mit dem Gesamtplatz in Kopf und Kachel.
    // Vor Spieltag 1 gibt es noch keinen Platz (die Tabelle stünde nach dem Alphabet) – dann nur die Conference
    const vorSaison = (LEAGUE.matchday || 0) === 0;
    const platz = i => vorSaison ? esc(konfName(v.konf[i])) : v.platz[i] ? `${v.platz[i]}. ${esc(konfName(v.konf[i]))} · ${v.pkt[i]} Pkt` : '';
    const st = v.staerke, stKl = st[0] > st[1] ? 'gut' : st[0] < st[1] ? 'schlecht' : 'neutral';
    const balken = (k, w) => w > 0 ? `<div class="${k}" style="flex-grow:${w}"></div>` : '';
    let elfText;
    if (v.ausfall.length) elfText = `<span class="sim-schlecht">${v.ausfall.map(a => esc(a.name) + ' ' + esc(a.grund)).join(', ')}</span> – Ersatz rückt nach`;
    else if (v.vertretung.length) elfText = v.vertretung.map(x => `${esc(x.rein)} für ${esc(x.raus)}`).join(', ');
    else if (v.muede.length) elfText = `<span class="sim-mittel">${v.muede.map(m => esc(m.name) + ' ' + m.fit + ' %').join(', ')}</span>`;
    else elfText = `<span class="sim-gut">${ic('circle-check')} alle fit</span>`;
    return `<section class="sim-tafel sim-vorschau" aria-label="Spielvorschau">
      <h3 class="sim-h3">${ic(sp.typ === 'playoff' ? 'trophy' : 'calendar-event')} ${wo}</h3>
      <div class="sim-duell">
        <div>${wappen('fcm', 'sim-wappen-gross')}<b>${esc(vereinsName('fcm'))}</b><small>${platz(0)}</small></div>
        <span class="sim-vs">${sp.neutral ? 'gegen' : sp.heim ? 'gegen' : 'bei'}</span>
        <div>${wappen(sp.gegner, 'sim-wappen-gross')}<b>${esc(vereinsName(sp.gegner))}</b><small>${platz(1)}</small></div>
      </div>
      ${v.weiter != null ? `<div class="sim-dreier" role="img" aria-label="Weiterkommen ${v.weiter} Prozent, Ausscheiden ${100 - v.weiter} Prozent">
        ${balken('s', v.weiter)}${balken('n', 100 - v.weiter)}</div>
      <div class="sim-dreier-text"><span class="sim-gut">Weiterkommen <b>${v.weiter} %</b></span><span class="sim-schlecht">Aus <b>${100 - v.weiter} %</b></span></div>`
      : `<div class="sim-dreier" role="img" aria-label="Sieg ${c.sieg} Prozent, Remis ${c.remis} Prozent, Niederlage ${c.niederlage} Prozent">
        ${balken('s', c.sieg)}${balken('u', c.remis)}${balken('n', c.niederlage)}</div>
      <div class="sim-dreier-text"><span class="sim-gut">Sieg <b>${c.sieg} %</b></span><span>Remis <b>${c.remis} %</b></span><span class="sim-schlecht">Niederlage <b>${c.niederlage} %</b></span></div>`}
      <div class="sim-zeile2"><span>Stärke</span><span><b class="sim-${stKl}">${st[0]}</b> gegen <b>${st[1]}</b></span></div>
      ${(v.form[0].length || v.form[1].length) ? `<div class="sim-zeile2"><span>Form</span><span class="sim-reihe"><small class="sim-blass">du</small>${formHtml(v.form[0])}<small class="sim-blass">sie</small>${formHtml(v.form[1])}</span></div>` : ''}
      ${voll && v.stil ? `<div class="sim-zeile2"><span>Stil</span><span>${stilText(v.stil)}</span></div>` : ''}
      ${voll && v.gefahr ? `<div class="sim-zeile2"><span>${ic('alert-triangle')} Gefahr</span><span><b>${esc(v.gefahr.name)}</b> · ${v.gefahr.tore} Tore in ${v.gefahr.spiele} Spielen</span></div>` : ''}
      ${voll && v.besten.length ? `<div class="sim-zeile2"><span>Ihre Besten</span><span class="sim-reihe">${v.besten.map(p => `<span class="pos-badge-sm pos-${esc(p.pos)}">${esc(p.pos)}</span><b>${p.ovr}</b>`).join(' ')}</span></div>` : ''}
      <div class="sim-zeile2"><span>Deine Elf</span><span>${elfText}</span></div>
    </section>`;
  }

  // ══ 4) Konferenz (D62 · 2) ══════════════════════════════════════════════
  function konferenzSpiele(nr) {
    const k = konfSpeicher(false);
    return (k && k.tage[nr]) || [];
  }
  function spieltagNummern() {
    const k = konfSpeicher(false);
    return k ? Object.keys(k.tage).map(Number).filter(n => k.tage[n] && k.tage[n].length).sort((a, b) => a - b) : [];
  }
  function konferenzZeilen(spiele, zusatz) {
    const eigen = s => s[0] === 'fcm' || s[1] === 'fcm';
    return spiele.slice().sort((a, b) => eigen(b) - eigen(a)).map((s, i) => `<div class="sim-paar${eigen(s) ? ' eigen' : ''}">
      <span class="sim-t">${wappen(s[0])}<span class="n">${esc(kuerzel(s[0]))}</span></span>
      <b class="sim-e">${s[2]}:${s[3]}${zusatz && zusatz[i] ? `<small>${esc(zusatz[i])}</small>` : ''}</b>
      <span class="sim-t r"><span class="n">${esc(kuerzel(s[1]))}</span>${wappen(s[1])}</span>
      ${s[4] || s[5] ? `<div class="sim-sch2"><span>${esc(s[4] || '')}</span><span>${esc(s[5] || '')}</span></div>` : ''}</div>`).join('');
  }
  function platzBewegung() {
    const jetztP = platzVon('fcm'), vorher = vorigeTabelle(), vorP = vorher ? platzVon('fcm', vorher) : null;
    if (!jetztP) return '';
    const d = vorP ? vorP - jetztP : 0;
    return `<div class="sim-bewegung"><span>Du: Platz <b>${jetztP}</b> in der Conference</span>
      <span class="${d > 0 ? 'sim-auf' : d < 0 ? 'sim-ab' : 'sim-blass'}">${vorP ? (d > 0 ? '▲ ' + d : d < 0 ? '▼ ' + (-d) : '=') + ' seit dem letzten Spieltag' : ''}</span></div>`;
  }
  function konferenzHtml(nr, opt) {
    opt = opt || {};
    const spiele = konferenzSpiele(nr);
    if (!spiele.length) return `<p class="sim-leer">${ic('ball-football')} Für Spieltag ${nr} sind keine Ergebnisse gespeichert.</p>`;
    return `<section class="sim-tafel sim-konferenz"><h3 class="sim-h3">${ic('ball-football')} Spieltag ${nr} · alle ${spiele.length} Spiele</h3>
      ${konferenzZeilen(spiele)}</section>${opt.bewegung && nr === LEAGUE.matchday ? platzBewegung() : ''}`;
  }
  // Playoff-Runde (ohne Torschützen: die Runde rechnet die Formel, das eigene Spiel steht im Spielbericht)
  function playoffRundeHtml(runde) {
    const po = poLaeuft() ? LEAGUE.dflPO : null;
    const RUNDE = (window.DFLPlayoffs && DFLPlayoffs.RUNDE) || {};
    const spiele = po ? po.spiele.filter(s => s.runde === runde && s.sieger) : [];
    if (!spiele.length) return '';
    const zusatz = [];
    const eig = s => s.heim === 'fcm' || s.gast === 'fcm';
    const sortiert = spiele.slice().sort((a, b) => eig(b) - eig(a));
    // D166: Hin und Rück – Gesamtergebnis, das Hinspiel als Zusatz
    sortiert.forEach(s => zusatz.push([s.hin ? `Hin ${s.hin.gh}:${s.hin.ga}` : '', s.art === 'Verlängerung' ? 'n. V.' : s.art === 'Elfmeterschießen' && s.elfer ? `i. E. ${s.elfer[0]}:${s.elfer[1]}` : ''].filter(Boolean).join(' · ')));
    const ges = s => (s.hin ? [s.gh + s.hin.gh, s.ga + s.hin.ga] : [s.gh, s.ga]);
    return `<section class="sim-tafel sim-konferenz"><h3 class="sim-h3">${ic('trophy')} Playoffs · ${esc(RUNDE[runde] || 'Runde ' + runde)}${spiele.some(s => s.hin) ? ' · gesamt' : ''}</h3>
      ${konferenzZeilen(sortiert.map(s => [s.heim, s.gast, ges(s)[0], ges(s)[1], '', '']), zusatz)}</section>`;
  }
  // Spielbericht: Konferenz des eben gespielten Spieltags unter den Torschützen (kein neues Fenster, D62 „Lieber nicht“)
  function berichtKonferenz() {
    if (!hatDom() || !dfl()) return;
    const body = document.getElementById('pm-body');
    if (!body || body.querySelector('.sim-pm-konf')) return;
    const fx = window.LAST_FIXTURE || null;
    let html = '';
    if (fx && fx.type === 'liga') html = konferenzHtml(LEAGUE.matchday, { bewegung: true });
    else if (fx && fx.type === 'playoff') html = playoffRundeHtml(fx.runde);
    if (!html) return;
    const tor = [...body.querySelectorAll('.pm-section')].find(s => /Torschützen/.test((s.querySelector('.pm-section-title') || {}).textContent || ''));
    const block = `<div class="pm-section sim-pm-konf"><div class="pm-section-title">Konferenz</div>${html}</div>`;
    if (tor) tor.insertAdjacentHTML('afterend', block); else body.insertAdjacentHTML('afterbegin', block);
  }

  // ══ 5) Simulieren bis … ═════════════════════════════════════════════════
  let LAUF = null;                      // aktueller Lauf (null = keiner)
  let erlaubtSpeichern = false, dirty = false;
  const OFFEN = { home: false, liga: false, club: false, postfach: false };
  const simAktiv = () => !!(LAUF && LAUF.aktiv);
  const pausiert = () => !!(LAUF && LAUF.beiseite);

  function deadlineSpieltag() { const H = window.DFLHandel; return (H && H.CFG && H.CFG.deadlineSpieltag) || 16; }
  function ziele() {
    if (!dfl()) return [];
    const mw = LEAGUE.matchWeeks || [], w = LEAGUE.week, md = LEAGUE.matchday || 0, dl = deadlineSpieltag();
    const voll = typeof seasonFullyComplete === 'function' && seasonFullyComplete(LEAGUE);
    const z = [];
    if (md === 0 && mw.length && w < mw[0]) {
      if (w < 2) z.push({ key: 'fa', name: 'Free Agency', icon: 'user-plus', text: 'bis KW 2 · ab dann unterschreibt die KI', bisWoche: 2 });
      z.push({ key: 'start', name: 'Saisonstart', icon: 'flag', text: `bis Spieltag 1 · KW ${mw[0]}`, bisWoche: mw[0] });
    } else if (!voll) {
      z.push({ key: 'vier', name: '4 Wochen', icon: 'calendar', text: `bis KW ${w + 4}`, bisWoche: w + 4 });
      if (mw[dl - 1] && w < mw[dl - 1]) z.push({ key: 'deadline', name: 'Trade-Deadline', icon: 'arrows-exchange', text: `bis KW ${mw[dl - 1]} · letzte Woche für Trades`, bisWoche: mw[dl - 1] });
      z.push({ key: 'hauptrunde', name: 'Ende der Hauptrunde', icon: 'flag', text: `bis Spieltag ${mw.length || 26}, dann Playoffs`, bisMd: mw.length || 26 });
      z.push({ key: 'saison', name: 'Saisonende', icon: 'trophy', text: 'mit Playoffs · hält vor deinen Playoff-Spielen', saison: true });
    } else {
      z.push({ key: 'saison', name: 'Saisonende', icon: 'trophy', text: 'Playoffs bis zum Finale · hält vor deinen Spielen', saison: true });
    }
    // Wochen und eigene Ligaspiele bis zum Ziel (Anzeige)
    const poWochen = () => { try { return window.DFLPlayoffs && DFLPlayoffs.wochen ? DFLPlayoffs.wochen() : []; } catch (e) { return []; } };
    z.forEach(x => {
      const bis = x.bisWoche != null ? x.bisWoche : x.bisMd != null ? (mw[x.bisMd - 1] || w) + 1 : ((poWochen()[3] || (mw[mw.length - 1] || w) + 5) + 1);
      x.wochen = Math.max(1, bis - w);
      x.spiele = mw.filter((wk, i) => i >= md && wk >= w && wk < bis).length;
      x.tests = (LEAGUE.friendlies || []).filter(f => !f.played && f.week >= w && f.week < bis).length;
      x.zusatz = x.saison ? ' + Playoffs' : '';
      x.anzahl = x.spiele || !x.tests ? `${x.spiele} Spiel${x.spiele === 1 ? '' : 'e'}${x.zusatz}` : `${x.tests} Testspiel${x.tests === 1 ? '' : 'e'}`;
    });
    return z;
  }
  function zielErreicht(z) {
    if (z.bisWoche != null) return LEAGUE.week >= z.bisWoche;
    if (z.bisMd != null) return (LEAGUE.matchday || 0) >= z.bisMd;
    return false;                                  // Saisonende: der Pflicht-Halt „Saison abschließen“ beendet den Lauf
  }
  // Eigenes Spiel diese Woche (Liga oder Testspiel) – wie ctaZustand
  function spielFaellig() {
    const test = typeof fcmFriendlyThisWeek === 'function' ? fcmFriendlyThisWeek(LEAGUE) : null;
    const liga = typeof seasonFullyComplete === 'function' && !seasonFullyComplete(LEAGUE) && Array.isArray(LEAGUE.matchWeeks)
      && LEAGUE.matchWeeks[LEAGUE.matchday] === LEAGUE.week && typeof fcmNextFixture === 'function' ? fcmNextFixture(LEAGUE) : null;
    return liga ? { typ: 'liga', fx: liga } : test ? { typ: 'test', fx: test } : null;
  }
  // Halt immer (wie die Pflichtstellen des Haupt-Buttons): Draft, Saisonende, eigenes Playoff-Spiel, Kader
  function pflichtHalt() {
    if (!dfl()) return { art: 'aus' };
    if (LEAGUE.dflDraft && !LEAGUE.dflDraft.fertig) return { art: 'draft' };
    if (typeof fcmSeasonOver === 'function' && fcmSeasonOver()) return { art: 'saisonende' };
    const P = window.DFLPlayoffs, po = P && P.faellig ? P.faellig() : null;
    if (po) return { art: 'playoff' };
    const K = window.DFLKader;
    if (K && K.saisonLaeuft && K.saisonLaeuft() && K.hauptkader().length < K.MIN()) return { art: 'mindest' };
    if (K && K.twFehlt && K.saisonLaeuft && K.saisonLaeuft() && K.twFehlt()) return { art: 'torwart' };     // D136: 2 Torhüter
    const mw = LEAGUE.matchWeeks;
    if (K && K.startPruefung && !spielFaellig() && (LEAGUE.matchday || 0) === 0 && Array.isArray(mw) && LEAGUE.week + 1 >= mw[0] && K.startPruefung().length) return { art: 'kader' };
    return null;
  }
  const PFLICHT = {
    draft: { titel: 'Der Draft wartet', text: 'Dein Pick ist dran – danach geht es weiter.', knopf: 'Zum Draft', icon: 'school' },
    saisonende: { titel: 'Saison abschließen', text: 'Eigentümer-Urteil, Hauptsponsor und Draft kommen beim Abschluss.', knopf: 'Saison abschließen', icon: 'trophy' },
    playoff: { titel: 'Dein Playoff-Spiel', text: 'Die großen Spiele spielst du selbst.', knopf: 'Zum Playoff-Spiel', icon: 'ball-football' },
    mindest: { titel: 'Kader zu klein', text: 'Ab Spieltag 1 sind mindestens 21 Spieler Pflicht.', knopf: 'Kader auffüllen', icon: 'alert-triangle' },
    torwart: { titel: 'Torhüter fehlt', text: 'Ab Spieltag 1 sind 2 Torhüter Pflicht.', knopf: 'Torhüter holen', icon: 'alert-triangle' },
    kader: { titel: 'Kader regelkonform machen', text: 'Vor Spieltag 1: unter den Cap, höchstens 28 Spieler, 2 Torhüter.', knopf: 'Kader regelkonform machen', icon: 'alert-triangle' },
    aus: { titel: 'Angehalten', text: '', knopf: null, icon: 'player-pause' }
  };

  // Ein Lauf merkt sich, was er tut (Ticker, Halte, Zeiten); das Spiel selbst bleibt die Quelle
  function neuerLauf(z) {
    const ch = chancen(true);
    return {
      ziel: z, aktiv: false, beiseite: false, stopp: false, fertig: false, grund: null, halt: null, weiterMit: null,
      start: { woche: LEAGUE.week, md: LEAGUE.matchday || 0, platz: platzVon('fcm'), po: ch && ch.fcm ? ch.fcm.po : null, t: jetzt() },
      wochen: [], spaeter: {}, gefragt: {}, seitSpeichern: 0, ende: null, hinweise: [],
      zeit: { spiel: [], woche: [], gesamt: 0 }
    };
  }

  // ── Meldungen der Woche → Tickerzeilen ───────────────────────────────────
  let MELDUNGEN = null;
  const ohneZeichen = t => String(t || '').replace(/^[^\p{L}\p{N}]+/u, '').trim();
  const ohnePunkt = t => String(t || '').replace(/<[^>]+>/g, '').trim().replace(/[.!]+$/, '');
  const ersterSatz = t => { const x = ohnePunkt(t); const m = /^(.*?[.!])\s/.exec(x + ' '); return m ? m[1].replace(/[.!]$/, '') : x; };
  const REGELN = [
    [/^Aufstellung angepasst/, 'tausch', n => ohnePunkt(n.text)],
    [/^Zurück in der Elf/, 'zurueck', n => 'Zurück: ' + ohnePunkt(n.text)],
    // D102 (dfl_medizin_patch.js): wieder einsatzfähig, oft mit Rückstand
    [/^Zurück: (.+)/, 'zurueck', (n, m) => { const r = /Rückstand −(\d+(?:,\d+)?)/.exec(n.text || ''); return 'Wieder fit: ' + m[1] + (r ? ` (Rückstand −${r[1]})` : ''); }],
    [/^Sperre: (.+)/, 'sperre', (n, m) => { const s = /für (\d+) Spiel/.exec(n.text || ''); return `${m[1]} gesperrt${s ? ` (${s[1]} Spiel${s[1] === '1' ? '' : 'e'})` : ''}`; }],
    [/^Streik: (.+)/, 'streik', (n, m) => 'Streik: ' + m[1]],
    [/^Trade-Wunsch: (.+)/, 'wunsch', (n, m) => 'Trade-Wunsch: ' + m[1]],
    [/^Unzufrieden: (.+)/, 'unzufrieden', (n, m) => 'Unzufrieden: ' + m[1]],
    [/^Beruhigt: (.+)/, 'beruhigt', (n, m) => 'Wieder zufrieden: ' + m[1]],
    [/^Lauf der Form: (.+)/, 'form', (n, m) => 'In Form: ' + m[1]],
    [/^Formkrise: (.+)/, 'krise', (n, m) => 'Formkrise: ' + m[1]],
    [/^Trade-Anfrage: (.+)/, 'anfrage', (n, m) => 'Anfrage: ' + m[1]],
    [/^Angebot: (.+)/, 'anfrage', (n, m) => 'Angebot: ' + m[1]],                    // D99: ein Verein bietet dir einen Spieler an
    [/^Anfrage abgelaufen: (.+)/, 'abgelaufen', (n, m) => 'Anfrage abgelaufen: ' + m[1]],
    [/^Trade mit (.+)/, 'trade', (n, m) => 'Trade mit ' + m[1]],
    [/^Trade: (.+)/, 'ligatrade', (n, m) => 'Liga-Trade: ' + m[1]],
    [/^Draft-Board/, 'draft', n => ohneZeichen(n.title)],
    [/^Playoffs! |^Playoffs ohne /, 'playoffs', n => ersterSatz(n.text) + (/Seed/.test(n.text || '') ? '' : '')],
    [/: die Ergebnisse$/, 'poRunde', n => ohneZeichen(n.title).replace(': die Ergebnisse', ' gespielt')],
    [/^Pro Bowl: (Süd-West|Nord-Ost) \d/, 'poRunde', n => ohneZeichen(n.title)],                 // D158: Ergebnis ohne Ticker
    [/^Free Agency: /, 'fa', n => ohneZeichen(n.title)],
    [/^Kaderschnitt in der D[FK]L/, 'info', () => 'Kaderschnitt in der DKL'],
    [/^Sommer-Vorbereitung|^Winter-Vorbereitung/, 'entscheidung', n => ohneZeichen(n.title)],
    [/^Sponsor unterschrieben/, 'info', n => ohneZeichen(n.title)]
  ];
  const SAMMEL = ['unzufrieden', 'streik', 'wunsch', 'beruhigt', 'form', 'krise'];
  function zeileAus(n) {
    const titel = ohneZeichen(n.title);
    if (/^🎲/.test(String(n.title || '').trim())) return { art: 'entscheidung', text: titel + ': ' + ohnePunkt(n.text).split(':')[0] };
    for (const [re, art, f] of REGELN) {
      const m = re.exec(titel);
      if (m) { const text = f(n, m); return text ? { art, text } : null; }
    }
    return null;
  }
  {
    const _orig = window.addNews;
    if (typeof _orig === 'function') {
      window.addNews = function (kat, titel, text) {
        if (MELDUNGEN) { try { MELDUNGEN.push({ category: kat, title: titel, text }); } catch (e) { /* nur Ticker */ } }
        return _orig.apply(this, arguments);
      };
      try { addNews = window.addNews; } catch (e) { /* window reicht */ }
    }
  }

  // ── Eine Woche wie von Hand ──────────────────────────────────────────────
  const verletzt = p => (typeof isInjured === 'function' ? isInjured(p) : (p && p.injuryWeeks > 0));
  const offeneAnfragen = () => { try { return window.DFLAnfragen && DFLAnfragen.offene ? DFLAnfragen.offene() : []; } catch (e) { return []; } };
  function spielen(sp) {
    const t0 = jetzt();
    if (typeof G !== 'undefined' && G && G.ended && typeof resetMatchState === 'function') resetMatchState();   // altes Spiel nie stehen lassen
    let fx = null;
    const los = () => {
      // wie „Zum Spiel“: Spiel laden …
      if ((typeof CURRENT_FIXTURE === 'undefined' || !CURRENT_FIXTURE) && typeof ensureFixtureLoaded === 'function') ensureFixtureLoaded();
      fx = typeof CURRENT_FIXTURE !== 'undefined' && CURRENT_FIXTURE ? Object.assign({}, CURRENT_FIXTURE) : null;
      if (!fx) throw new Error('kein Spiel geladen');
      // … und „Anpfiff“: Engine v3, Ausfälle vor dem Spiel ersetzt, gebucht wie immer (Bericht und Ticker fallen weg)
      window.simulateCurrentFixture();
    };
    if (window.DFLTextspiel && typeof DFLTextspiel.ohne === 'function') DFLTextspiel.ohne(los); else los();
    if (typeof G === 'undefined' || !G || !G.ended) throw new Error('Spiel wurde nicht gewertet');
    const erg = { typ: fx.type === 'friendly' ? 'test' : fx.type, gegner: fx.opponentId, heim: !!fx.isHome, tore: [G.homeGoals, G.awayGoals], sp: fx.matchday || null };
    const ms = jetzt() - t0;
    // wie „Nächste Woche“ im Spielbericht (nie den Saisonabschluss: der ist ein Pflicht-Halt)
    if (!(typeof fcmSeasonOver === 'function' && fcmSeasonOver())) window.postMatchContinue();
    else if (typeof resetMatchState === 'function') resetMatchState();
    return Object.assign(erg, { ms });
  }
  function naechsteWoche() {
    if (typeof fcmSeasonOver === 'function' && fcmSeasonOver()) return false;
    const w = LEAGUE.week;
    window.nextWeek();
    return LEAGUE.week !== w;
  }
  function wocheSpielen(L) {
    const t0 = jetzt();
    const vor = { woche: LEAGUE.week, md: LEAGUE.matchday || 0, platz: platzVon('fcm'), elf: new Set(typeof getLineupIds === 'function' ? getLineupIds() : []),
      verletzt: new Set((typeof SQUAD !== 'undefined' ? SQUAD : []).filter(verletzt).map(p => p.id)), anfragen: new Set(offeneAnfragen().map(a => a.id)) };
    MELDUNGEN = [];
    let spiel = null, weiter = true;
    try {
      const f = spielFaellig();
      if (f) spiel = spielen(f);
      else weiter = naechsteWoche();
    } finally { L.meldungen = MELDUNGEN; MELDUNGEN = null; }
    const e = {
      woche: vor.woche, md: (LEAGUE.matchday || 0) > vor.md ? LEAGUE.matchday : null, mdNach: LEAGUE.matchday || 0,
      platzVor: vor.md > 0 ? vor.platz : null, platz: (LEAGUE.matchday || 0) > 0 ? platzVon('fcm') : null,     // vor Spieltag 1 kein Platz
      spiel: null, zeilen: [], pause: null
    };
    if (spiel) {
      const eigen = spiel.typ === 'liga' && e.md ? konferenzSpiele(e.md).find(s => s[0] === 'fcm' || s[1] === 'fcm') : null;
      e.spiel = { typ: spiel.typ, sp: spiel.sp, gegner: spiel.gegner, heim: spiel.heim, tore: spiel.tore,
        sch: eigen ? (eigen[0] === 'fcm' ? eigen[4] : eigen[5]) : '' };
      L.zeit.spiel.push(Math.round(spiel.ms));
    } else {
      const P = window.DFLPlayoffs, po = poLaeuft() ? LEAGUE.dflPO : null;
      e.pause = po && (P && P.wochen) ? 'playoffs' : (vor.md === 0 && (LEAGUE.matchWeeks || [])[0] > vor.woche) ? 'vorbereitung'
        : [26, 27].indexOf(vor.woche) >= 0 ? 'winter' : 'laenderspiel';
      if (po) { const r = po.spiele.filter(s => s.sieger).reduce((m, s) => Math.max(m, s.runde), 0); if (r) e.poRunde = r; }
    }
    // Zeilen: Meldungen der Woche, neue Verletzte (mit Startelf), neue Anfragen
    const seen = new Set(), sammeln = {};
    (L.meldungen || []).forEach(n => {
      const z = zeileAus(n);
      if (!z || seen.has(z.art + z.text)) return;
      seen.add(z.art + z.text);
      // „Unzufrieden: A“, „Unzufrieden: B“ → eine Zeile „Unzufrieden: A, B“
      const m = SAMMEL.indexOf(z.art) >= 0 ? /^([^:]+): (.+)$/.exec(z.text) : null;
      if (m && sammeln[z.art]) { sammeln[z.art].namen.push(m[2]); sammeln[z.art].z.text = m[1] + ': ' + sammeln[z.art].namen.join(', '); return; }
      if (m) sammeln[z.art] = { z, namen: [m[2]] };
      e.zeilen.push(z);
    });
    const neuVerletzt = (typeof SQUAD !== 'undefined' ? SQUAD : []).filter(p => verletzt(p) && !vor.verletzt.has(p.id));
    neuVerletzt.forEach(p => e.zeilen.push({ art: 'verletzt', text: `${spielerName(p)} verletzt${p.injuryType ? ': ' + p.injuryType : ''} (${p.injuryWeeks} Wo.)`, startelf: vor.elf.has(p.id), id: p.id }));
    e.neueAnfragen = offeneAnfragen().filter(a => !vor.anfragen.has(a.id));
    e.ms = Math.round(jetzt() - t0);
    L.zeit.woche.push(e.ms);
    if (!spiel && !weiter) e.steht = true;          // nextWeek hat nicht weitergeschaltet (Hinweis kam)
    return e;
  }

  // ── Halte nach der Woche ─────────────────────────────────────────────────
  // Fenster, die das Spiel öffnet: Entscheidungen (.exp-overlay mit Wahl) spiegelt das Blatt, alles andere erledigst du selbst
  const FREMD = ['.dfl-draft-ov', '.dfl-fenster-scrim', '#dfl-frage', '#pm-overlay', '.sw-ov', '.vw-ov', '.ef-ov'];   // .sw-ov: Briefings/Saisonvorbereitung (D91–D93); .ef-ov: Erfolge/Laden am PC (D122)
  const sichtbar = x => !!(x && x.isConnected && !(x.classList && x.classList.contains('sim-gespiegelt')) && x.style.display !== 'none'
    && (typeof getComputedStyle !== 'function' || getComputedStyle(x).display !== 'none'));
  function offenesFenster() {
    if (!hatDom()) return null;
    const ov = [...document.querySelectorAll('.exp-overlay')].find(x => x.id !== 'qn-ov' && sichtbar(x));
    if (ov) return ov;
    return FREMD.map(s => document.querySelector(s)).find(sichtbar) || null;
  }
  function entscheidungLesen(ov) {
    const text = el => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
    const optionen = [...ov.querySelectorAll('.exp-offer')].map((o, i) => {
      const btn = o.querySelector('.exp-offer-btn');
      if (!btn || btn.disabled) return null;
      const folgen = text(o.querySelector('.ev-outcome')).replace(/^(Mögliche Folgen|Ausgang ungewiss):\s*/, '');
      return { i, label: text(o.querySelector('.exp-offer-name')), info: [text(o.querySelector('.camp-cost')), folgen].filter(Boolean).join(' · '),
        ungewiss: /Ausgang ungewiss/.test(text(o.querySelector('.ev-outcome'))), btn };
    }).filter(Boolean);
    return optionen.length ? { titel: text(ov.querySelector('.exp-dialog-title')), text: text(ov.querySelector('.exp-dialog-sub')), optionen } : null;
  }
  function ereignisAusloesen() {
    const st = typeof CLUB !== 'undefined' && CLUB ? CLUB._events : null;
    if (!st || !st.pending || typeof window.__flushPendingEvent !== 'function' || !hatDom()) return;
    if (document.querySelector('.exp-overlay')) return;          // eins nach dem anderen
    try { window.__flushPendingEvent(); } catch (e) { console.warn('[DFL-Simulieren] Ereignis', e); }
  }
  async function nachDerWoche(L, e) {
    // 1) Entscheidungen und fremde Fenster
    await fensterErledigen(L, e);
    if (L.stopp) return;
    // 2) neue Trade-Anfragen (D99: Angebote an dich halten nicht – sie stehen im Ticker, unter „Braucht dich“ und im Postfach)
    if (einstellungen().anfrage) {
      for (const a of e.neueAnfragen || []) {
        if (L.stopp) return;
        const x = offeneAnfragen().find(y => y.id === a.id);
        if (x && x.art !== 'angebot') await halt(L, { art: 'anfrage', a: x, e });
      }
    }
    // 3) Verletzung in der Startelf (Schalter, Vorgabe aus)
    if (einstellungen().verletzung && !L.stopp) {
      const v = e.zeilen.find(z => z.art === 'verletzt' && z.startelf);
      if (v) await halt(L, { art: 'verletzt', zeile: v, e });
    }
  }
  async function fensterErledigen(L, e) {
    for (let n = 0; n < 4 && !L.stopp; n++) {
      ereignisAusloesen();
      const ov = offenesFenster();
      if (!ov) break;
      const ent = ov.classList && ov.classList.contains('exp-overlay') ? entscheidungLesen(ov) : null;
      if (ent && !einstellungen().ereignis) {
        const o = ent.optionen[0];
        o.btn.click();
        e.zeilen.push({ art: 'entscheidung', text: `${ent.titel}: ${o.label} (automatisch)` });
        continue;
      }
      if (ent) { ov.classList.add('sim-gespiegelt'); await halt(L, { art: 'entscheidung', ent, ov, e }); continue; }
      await halt(L, { art: 'fenster', ov, titel: fensterTitel(ov) });
    }
  }
  function fensterTitel(ov) {
    const d = ov.querySelector('[role="dialog"][aria-label]'), h = ov.querySelector('h1,h2,h3,[class*=title],[class*=titel]');
    const t = d ? d.getAttribute('aria-label') : h ? h.textContent : ov.textContent;
    return String(t || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  }
  // „Später“: in der letzten Woche vor Ablauf noch einmal fragen
  function spaeterFaellig(L) {
    const offen = offeneAnfragen();
    for (const id of Object.keys(L.spaeter)) {
      const a = offen.find(x => x.id === id);
      if (!a) { delete L.spaeter[id]; continue; }
      if (LEAGUE.week >= a.bis && !L.gefragt[id]) return a;
    }
    return null;
  }

  // ── Der Lauf ─────────────────────────────────────────────────────────────
  async function speichern(L) {
    if (!dirty) return;
    erlaubtSpeichern = true;
    try { await Promise.resolve(typeof window.saveGameState === 'function' ? window.saveGameState() : null); }
    catch (e) { console.warn('[DFL-Simulieren] Speichern', e); }
    finally { erlaubtSpeichern = false; dirty = false; if (L) L.seitSpeichern = 0; }
  }
  function nachholen() {
    // Was während des Laufs liegen blieb: sichtbare Ansichten jetzt zeichnen, unsichtbare zeichnet der Ansichtswechsel
    const sicht = id => { const v = hatDom() && document.getElementById(id); return !!(v && v.classList.contains('active')); };
    if (OFFEN.home) { OFFEN.home = false; if (sicht('view-home') && typeof window.renderHomeTab === 'function') { try { window.renderHomeTab(); } catch (e) { console.warn('[DFL-Simulieren] Office', e); } } }
    if (OFFEN.liga) { OFFEN.liga = false; if (sicht('view-liga') && typeof window.renderLeagueTab === 'function') { try { window.renderLeagueTab(); } catch (e) { console.warn('[DFL-Simulieren] Liga', e); } } }
    if (OFFEN.club) { OFFEN.club = false; if (sicht('view-club') && typeof window.renderClubTab === 'function') { try { window.renderClubTab(); } catch (e) { /* Ansicht optional */ } } }
    OFFEN.postfach = false;
    try { if (window.DFLAppShell && DFLAppShell.cta) DFLAppShell.cta(); } catch (e) { /* Haupt-Button optional */ }
  }
  function starte(key, opt) {
    opt = opt || {};
    if (LAUF && !LAUF.fertig) return LAUF;
    if (pflichtHalt()) return null;
    const z = ziele().find(x => x.key === key);
    if (!z) return null;
    einstellungSetzen('ziel', key);
    const L = LAUF = neuerLauf(z);
    L.ohneUi = !!opt.ohneUi || !hatDom();
    L.promise = laufen(L);
    return L;
  }
  async function laufen(L) {
    if (!L.ohneUi) { blattModus('laeuft'); }
    L.aktiv = true;                                                  // bis zum Ende, nur Halte schalten ab
    try {
      for (let runde = 0; runde < 80; runde++) {
        await warte(L.ohneUi || ruhig() ? 0 : 40);                 // Bild aufbauen lassen, „Anhalten“ annehmen
        if (L.stopp) { L.grund = L.grund || { art: 'stopp' }; break; }
        // Fenster, die das Spiel verzögert öffnet (Briefing Saisonstart D91: 60 ms nach dem Wochenwechsel) – erst erledigen
        if (offenesFenster()) { await fensterErledigen(L, L.wochen[L.wochen.length - 1] || { zeilen: [] }); continue; }
        const pf = pflichtHalt();
        if (pf) { L.grund = Object.assign({ pflicht: true }, pf); break; }
        if (zielErreicht(L.ziel)) { L.grund = { art: 'ziel' }; break; }
        const letzte = spaeterFaellig(L);
        if (letzte) { L.gefragt[letzte.id] = true; await halt(L, { art: 'letzte', a: letzte }); continue; }
        const e = wocheSpielen(L);
        L.wochen.push(e);
        if (!L.ohneUi) tickerNeu(e);
        if (L.hinweise.length) { const h = L.hinweise.splice(0); await halt(L, { art: 'hinweis', text: h.join(' · ') }); if (L.stopp) break; }
        if (e.steht) { L.grund = { art: 'steht' }; break; }
        await nachDerWoche(L, e);
        if (++L.seitSpeichern >= 4) await speichern(L);
      }
    } catch (err) {
      console.warn('[DFL-Simulieren] Lauf abgebrochen', err);
      L.grund = { art: 'fehler', text: String(err && err.message || err) };
    } finally {
      L.aktiv = false; L.beiseite = false; MELDUNGEN = null;
      dirty = true;                                                  // am Ende immer einmal speichern
      await speichern(L);
      L.ende = { woche: LEAGUE.week, md: LEAGUE.matchday || 0, platz: platzVon('fcm') };
      const ch = chancen(true); L.ende.po = ch && ch.fcm ? ch.fcm.po : null;
      L.zeit.gesamt = Math.round(jetzt() - L.start.t);
      L.fertig = true;
      nachholen();
      if (!L.ohneUi) blattModus('ziel');
    }
    return L;
  }
  // Halt: das Spiel verhält sich normal (Speichern, Hinweise, Ansichten), bis du entschieden hast
  function halt(L, h) {
    L.halt = h; L.aktiv = false;
    dirty = true; speichern(L);
    nachholen();
    const fertig = res => w => {
      if (h.ov && h.ov.classList) h.ov.classList.remove('sim-gespiegelt');
      L.halt = null; L.weiterMit = null; L.beiseite = false;
      L.aktiv = !L.stopp && w !== 'stopp';
      res(w);
    };
    // ohne Blatt (Prüflauf): Entscheidung über DFLSimulieren.entscheide(...)
    if (L.ohneUi) return new Promise(res => { L.weiterMit = fertig(res); });
    const p = new Promise(res => { L.weiterMit = fertig(res); });
    blattModus('halt');
    if (h.art === 'fenster') beiseite();                         // das Fenster des Spiels liegt oben – erledigen, dann geht es weiter
    return p;
  }
  function weiter(w) { if (LAUF && LAUF.weiterMit) LAUF.weiterMit(w || 'weiter'); }
  function anhalten() {
    if (!LAUF || LAUF.fertig) return;
    LAUF.stopp = true;
    if (LAUF.halt && LAUF.weiterMit) LAUF.weiterMit('stopp');
  }

  // ── Schneller weiterklicken: Wrapper ─────────────────────────────────────
  {
    const _orig = window.saveGameState;
    if (typeof _orig === 'function') {
      window.saveGameState = function () {
        if (simAktiv() && !erlaubtSpeichern) { dirty = true; return Promise.resolve(true); }
        return _orig.apply(this, arguments);
      };
      try { saveGameState = window.saveGameState; } catch (e) { /* window reicht */ }
    }
  }
  if (typeof window.showToast === 'function') {
    const _toast = window.showToast;
    window.showToast = function () { if (simAktiv()) return undefined; return _toast.apply(this, arguments); };
    try { showToast = window.showToast; } catch (e) { /* window reicht */ }
  }
  if (typeof window.alert === 'function') {
    const _alert = window.alert;
    window.alert = function (m) { if (simAktiv() && LAUF) { LAUF.hinweise.push(String(m || '').split('\n')[0]); return undefined; } return _alert.apply(window, arguments); };
  }
  if (window.PostMatchModal && typeof window.PostMatchModal.show === 'function') {
    const _show = window.PostMatchModal.show;
    window.PostMatchModal.show = function () {
      if (simAktiv()) return undefined;                          // „bis …“: kein Bericht je Spiel
      const r = _show.apply(this, arguments);
      try { berichtKonferenz(); } catch (e) { console.warn('[DFL-Simulieren] Konferenz im Bericht', e); }
      return r;
    };
  }
  // Während des Laufs: Office, Liga, Verein, Postfach erst am Ende (hinter dem Blatt sieht sie niemand)
  [['renderHomeTab', 'home'], ['renderLeagueTab', 'liga'], ['renderClubTab', 'club'], ['renderPostfach', 'postfach']].forEach(([fn, k]) => {
    const _orig = window[fn];
    if (typeof _orig !== 'function') return;
    window[fn] = function () { if (simAktiv()) { OFFEN[k] = true; return undefined; } return _orig.apply(this, arguments); };
  });
  // Immer: Transfer- und Scouting-Reiter nur zeichnen, wenn sie zu sehen sind – der Ansichtswechsel (switchAppView) zeichnet
  // sie beim Öffnen. Vorher kostete jedes „Woche weiter“ 0,1–0,3 s am PC für den unsichtbaren Transfer-Reiter (D64).
  const LAZY = { renderTransferTab: 'view-transfer', renderScoutTab: 'view-scout' };
  const LAZY_ZAEHLER = { gezeichnet: 0, gespart: 0 };
  Object.keys(LAZY).forEach(fn => {
    const _orig = window[fn];
    if (typeof _orig !== 'function') return;
    window[fn] = function () {
      const v = hatDom() ? document.getElementById(LAZY[fn]) : null;
      if (dfl() && v && !v.classList.contains('active')) { LAZY_ZAEHLER.gespart++; return undefined; }
      LAZY_ZAEHLER.gezeichnet++;
      return _orig.apply(this, arguments);
    };
  });
  // Spieltag: Vorschau vor dem Anpfiff, nach dem Anpfiff weg
  {
    const _orig = window.simulateCurrentFixture;
    if (typeof _orig === 'function') {
      window.simulateCurrentFixture = function () {
        const r = _orig.apply(this, arguments);
        try { spieltagVorschau(); } catch (e) { /* nur Anzeige */ }
        return r;
      };
      try { simulateCurrentFixture = window.simulateCurrentFixture; } catch (e) { /* window reicht */ }
    }
  }

  // ══ 6) Anzeige: Blatt, Ticker, Zusammenfassung ══════════════════════════
  let BLATT = null, MODUS = null, SICHT = null, ZURUECK = null;
  function blattBauen() {
    if (BLATT || !hatDom()) return BLATT;
    BLATT = document.createElement('div');
    BLATT.id = 'dfl-sim'; BLATT.hidden = true;
    BLATT.innerHTML = `<div class="sim-dimmer"></div><section class="sim-blatt" role="dialog" aria-modal="true" aria-labelledby="sim-titel">
      <div class="sim-griff" aria-hidden="true"></div><div class="sim-kopf"></div><div class="sim-inhalt" id="sim-inhalt"></div><div class="sim-fuss"></div></section>`;
    document.body.appendChild(BLATT);
    BLATT.addEventListener('click', klick);
    BLATT.addEventListener('change', ev => {
      const m = /^sim-sw-(\w+)$/.exec(ev.target.id || '');
      if (m) einstellungSetzen(m[1], !!ev.target.checked);
    });
    BLATT.addEventListener('keydown', ev => {
      if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches && ev.target.matches('[data-md], [data-runde]')) { ev.preventDefault(); ev.target.click(); }
      if (ev.key === 'Escape' && (MODUS === 'wahl' || MODUS === 'ziel')) schliessen();
    });
    return BLATT;
  }
  const blattOffen = () => !!(BLATT && !BLATT.hidden);
  function zeigeBlatt() {
    blattBauen();
    if (!BLATT) return;
    BLATT.hidden = false;
    document.body.classList.add('sim-offen');
    knopfAktualisieren();
  }
  function schliessen() {
    if (LAUF && !LAUF.fertig) return;                      // laufender Lauf: erst „Anhalten“
    if (BLATT) BLATT.hidden = true;
    document.body.classList.remove('sim-offen');
    LAUF = null; MODUS = null;
    nachholen();
    knopfAktualisieren();
    const k = document.getElementById('dfl-sim-knopf'); if (k && k.offsetParent) k.focus({ preventScroll: true });
  }
  function beiseite() {
    if (!LAUF) return;
    LAUF.beiseite = true;
    if (BLATT) BLATT.hidden = true;
    document.body.classList.remove('sim-offen');
    nachholen();
    knopfAktualisieren();
    setTimeout(pruefeBeiseite, 500);                    // erst prüfen, wenn das andere Blatt/Fenster offen ist
  }
  // Pausiert (z. B. „Ansehen“): zurück, sobald das andere Blatt zu ist und das Office wieder zu sehen ist
  function pruefeBeiseite() {
    if (!LAUF || !LAUF.beiseite) return;
    const blockiert = (document.getElementById('app-blatt') && document.getElementById('app-blatt').classList.contains('auf'))
      || [...document.querySelectorAll('.exp-overlay')].some(sichtbar) || FREMD.some(s => sichtbar(document.querySelector(s)));
    const home = ['view-home', 'view-fo'].some(id => { const v = document.getElementById(id); return v && v.classList.contains('active'); });
    if (blockiert || !home) { setTimeout(pruefeBeiseite, 400); return; }
    fortsetzen();
  }
  function fortsetzen() {
    const L = LAUF; if (!L) return;
    L.beiseite = false;
    const h = L.halt;
    if (h && (h.art === 'anfrage' || h.art === 'letzte')) {
      const a = ((CLUB.dfl && CLUB.dfl.anfragen) || []).find(x => x.id === h.a.id);
      if (a && a.status !== 'offen') { (h.e || L.wochen[L.wochen.length - 1] || { zeilen: [] }).zeilen.push({ art: 'anfrage', text: `Anfrage ${vereinsName(spielIdVon(a.team))}: ${STATUS[a.status] || a.status}` }); zeigeBlatt(); blattModus('laeuft'); weiter(); return; }
    }
    if (h && h.art === 'fenster' && !(h.ov && h.ov.isConnected)) { zeigeBlatt(); blattModus('laeuft'); weiter(); return; }
    if (h && h.art === 'entscheidung' && !(h.ov && h.ov.isConnected)) { zeigeBlatt(); blattModus('laeuft'); weiter(); return; }
    zeigeBlatt(); blattModus(h ? 'halt' : (L.fertig ? 'ziel' : 'laeuft'));
  }
  const STATUS = { angenommen: 'angenommen', abgelehnt: 'abgelehnt', nachbessern: 'abgelehnt – sie bessern vielleicht nach', abgelaufen: 'abgelaufen' };

  function oeffnen() {
    if (!dfl()) return;
    if (LAUF && LAUF.beiseite) { fortsetzen(); return; }
    if (LAUF && !LAUF.fertig) { zeigeBlatt(); blattModus(LAUF.halt ? 'halt' : 'laeuft'); return; }
    if (pflichtHalt()) return;
    LAUF = null;
    const z = ziele();
    if (!z.length) return;
    const ein = einstellungen();
    WAHL = z.some(x => x.key === ein.ziel) ? ein.ziel : (z.find(x => x.key === 'deadline') || z.find(x => x.key === 'start') || z[0]).key;
    zeigeBlatt(); blattModus('wahl');
    const b = BLATT.querySelector('.sim-ziel[aria-checked="true"]'); if (b) b.focus({ preventScroll: true });
  }
  let WAHL = null;
  function blattModus(m) {
    if (!blattBauen()) return;
    if (m !== 'konferenz' && m !== 'tabelle') MODUS = m;
    const kopf = BLATT.querySelector('.sim-kopf'), inhalt = BLATT.querySelector('.sim-inhalt'), fuss = BLATT.querySelector('.sim-fuss');
    const zu = `<button class="sim-zu" type="button" data-sim="zu" aria-label="Schließen">${ic('x')}</button>`;
    const L = LAUF;
    if (m === 'wahl') {
      const z = ziele(), ein = einstellungen(), Z = z.find(x => x.key === WAHL) || z[0];
      kopf.innerHTML = `<div><h2 id="sim-titel">Simulieren bis …</h2><p>Deine Spiele laufen mit der Engine wie beim Anpfiff.</p></div>${zu}`;
      inhalt.innerHTML = `<div class="sim-zielwahl" role="radiogroup" aria-label="Ziel">${z.map(x => `<button class="sim-ziel" type="button" role="radio" data-ziel="${x.key}" aria-checked="${x.key === Z.key}">
          <span class="sim-zi">${ic(x.icon)}</span><b>${esc(x.name)}</b><small>${esc(x.text)}</small><span class="sim-zt">${esc(x.anzahl)}</span></button>`).join('')}</div>
        <p class="sim-unter">Anhalten bei</p>
        <div class="sim-schalter">
          <label for="sim-sw-anfrage"><span>Trade-Anfrage an dich<small>sonst läuft sie nach 2 Wochen ab</small></span><input type="checkbox" id="sim-sw-anfrage"${ein.anfrage ? ' checked' : ''}></label>
          <label for="sim-sw-ereignis"><span>Ereignis mit Entscheidung<small>aus: die erste Antwort, dann weiter</small></span><input type="checkbox" id="sim-sw-ereignis"${ein.ereignis ? ' checked' : ''}></label>
          <label for="sim-sw-verletzung"><span>Verletzung in der Startelf<small>aus: der beste Ersatz spielt, danach kehrt er zurück</small></span><input type="checkbox" id="sim-sw-verletzung"${ein.verletzung ? ' checked' : ''}></label>
        </div>
        <p class="sim-blass sim-klein">Hält immer: Draft, Kader zu groß oder zu teuer, unter 21 Spielern, dein Playoff-Spiel, Saisonabschluss.</p>`;
      fuss.innerHTML = `<button class="sim-knopf gruen" type="button" data-sim="los">${ic('player-track-next')}<span>Los: ${esc(Z.name)}<small>${esc(Z.anzahl)} · ${esc(Z.text)}</small></span></button>`;
    } else if (m === 'laeuft' || m === 'halt') {
      const n = L.ziel.wochen, i = L.wochen.length;
      const zt = L.ziel.key === 'vier' ? L.ziel.name : 'bis ' + L.ziel.name;
      kopf.innerHTML = `<div><h2 id="sim-titel">${m === 'halt' ? 'Angehalten · ' + esc(zt) : 'Simuliere ' + esc(zt)}</h2><p class="sim-zahl" id="sim-stand">${standText()}</p></div>`;
      inhalt.innerHTML = `<div class="sim-fortschritt" aria-hidden="true"><div id="sim-balken" style="transform:scaleX(${Math.min(1, i / n).toFixed(3)})"></div></div>
        <ol class="sim-ticker" id="sim-ticker" aria-live="polite">${L.wochen.map(e => wochenKarte(e)).join('')}${m === 'laeuft' ? laeuftKarte() : ''}</ol>
        ${m === 'halt' ? haltKarte(L.halt) : ''}`;
      fuss.innerHTML = `<button class="sim-knopf hell" type="button" data-sim="stopp">${ic('player-pause')} Anhalten</button>`;
      inhalt.scrollTop = inhalt.scrollHeight;
      if (m === 'halt') { const b = inhalt.querySelector('.sim-halt button'); if (b) b.focus({ preventScroll: true }); }
    } else if (m === 'ziel') {
      kopf.innerHTML = `<div class="sim-z-kopf">${zusammenfassungKopf(L)}</div>${zu}`;
      inhalt.innerHTML = zusammenfassung(L);
      const g = L.grund || {}, P = PFLICHT[g.art];
      fuss.innerHTML = (g.pflicht && P && P.knopf && hatShell() ? `<button class="sim-knopf blau" type="button" data-sim="pflicht">${ic(P.icon)} ${esc(P.knopf)}</button>` : '')
        + `<button class="sim-knopf ${g.pflicht && P && P.knopf && hatShell() ? 'hell' : 'gruen'}" type="button" data-sim="fertig">${ic('circle-check')} Fertig</button>`;
      inhalt.scrollTop = 0;
      const b = fuss.querySelector('button'); if (b) b.focus({ preventScroll: true });
    } else if (m === 'konferenz' || m === 'tabelle') {
      const zurueck = `<button class="sim-zu" type="button" data-sim="zurueck" aria-label="Zurück">${ic('chevron-left')}</button>`;
      if (m === 'konferenz') {
        const titel = SICHT && SICHT.runde ? 'Playoffs' : `Konferenz · Spieltag ${SICHT.md}`;
        kopf.innerHTML = `${zurueck}<div><h2 id="sim-titel">${esc(titel)}</h2><p>Alle Ergebnisse mit Torschützen</p></div>`;
        inhalt.innerHTML = SICHT.runde ? playoffRundeHtml(SICHT.runde) : konferenzHtml(SICHT.md, { bewegung: true });
      } else {
        const konf = (teamVon('fcm') || {}).conference;
        kopf.innerHTML = `${zurueck}<div><h2 id="sim-titel">Conference ${esc(konfName(konf))}</h2><p>Platz 1–7 kommen in die Playoffs</p></div>`;
        inhalt.innerHTML = `<section class="sim-tafel">${tabelleHtml(konf, { rechnen: true })}</section>`;
      }
      fuss.innerHTML = L && !L.fertig ? `<button class="sim-knopf hell" type="button" data-sim="zurueck">${ic('chevron-left')} Zurück zum Ticker</button>` : `<button class="sim-knopf hell" type="button" data-sim="zurueck">${ic('chevron-left')} Zurück</button>`;
      inhalt.scrollTop = 0;
    }
    BLATT.dataset.modus = m;
  }
  const hatShell = () => hatDom() && document.body.classList.contains('dfl-shell') && !!window.DFLAppShell;
  function standText() {
    const L = LAUF; if (!L) return '';
    return `Woche ${Math.min(L.wochen.length, L.ziel.wochen)} von ${L.ziel.wochen} · ${kalender(LEAGUE.week)}`;
  }
  function tickerNeu(e) {
    if (!BLATT || MODUS !== 'laeuft' || BLATT.hidden) return;
    const t = BLATT.querySelector('#sim-ticker'), inhalt = BLATT.querySelector('.sim-inhalt');
    if (!t) return;
    const alt = t.querySelector('.sim-laeuft'); if (alt) alt.remove();
    t.insertAdjacentHTML('beforeend', wochenKarte(e, true) + laeuftKarte());
    const b = BLATT.querySelector('#sim-balken'); if (b) b.style.transform = `scaleX(${Math.min(1, LAUF.wochen.length / LAUF.ziel.wochen).toFixed(3)})`;
    const s = BLATT.querySelector('#sim-stand'); if (s) s.textContent = standText();
    inhalt.scrollTop = inhalt.scrollHeight;
  }
  function laeuftKarte() {
    const f = spielFaellig();
    return `<li class="sim-tw sim-laeuft">${ic('refresh')} ${esc(kalender(LEAGUE.week).split(' · ')[0])}${f && f.typ === 'liga' ? ` · Spieltag ${f.fx.matchday} läuft …` : f ? ' · Testspiel läuft …' : ' …'}</li>`;
  }
  const ART = { tausch: ['arrows-shuffle', 'warn'], zurueck: ['user-plus', 'gut'], verletzt: ['bandage', 'schlecht'], sperre: ['ban', 'schlecht'],
    streik: ['hand-stop', 'schlecht', true], wunsch: ['plane-departure', 'warn', true], unzufrieden: ['mood-sad', 'warn'], beruhigt: ['mood-smile', 'gut'],
    form: ['flame', 'gut'], krise: ['snowflake', 'warn'], ligatrade: ['arrows-exchange', ''], trade: ['arrows-exchange', 'gut', true], abgelaufen: ['clock', 'schlecht', true],
    playoffs: ['trophy', 'gut', true], poRunde: ['trophy', ''], draft: ['clipboard-list', ''], entscheidung: ['dice-5', ''], anfrage: ['arrows-exchange', 'warn', true],
    fa: ['user-plus', ''], info: ['info-circle', ''] };
  const PAUSE = { vorbereitung: ['barbell', 'Vorbereitung'], winter: ['snowflake', 'Winterpause'], laenderspiel: ['calendar-off', 'Länderspielpause'], playoffs: ['trophy', 'Playoffs'] };
  function zeilenHtml(e) {
    if (!e.zeilen.length) return '';
    return `<ul class="sim-z">${e.zeilen.map(z => { const a = ART[z.art] || ['news', '']; return `<li class="${a[1]}${a[2] ? ' wichtig' : ''}">${ic(a[0])}<span>${esc(z.text)}${z.startelf ? ' · Startelf' : ''}</span></li>`; }).join('')}</ul>`;
  }
  function wochenKarte(e, neu) {
    const kw = `<span class="sim-kw">KW${e.woche}<small>${e.spiel && e.spiel.typ === 'liga' && e.md ? 'Sp. ' + e.md : esc(monatKurz(e.woche))}</small></span>`;
    if (!e.spiel) {
      const p = PAUSE[e.pause] || PAUSE.laenderspiel, poR = e.poRunde && (window.DFLPlayoffs && DFLPlayoffs.RUNDE ? DFLPlayoffs.RUNDE[e.poRunde] : null);
      const tap = e.poRunde ? ` data-runde="${e.poRunde}" tabindex="0" role="button" aria-label="Playoffs ${esc(poR || '')}: Ergebnisse öffnen"` : '';
      return `<li class="sim-tw sim-pause${e.poRunde ? ' sim-tippbar' : ''}${neu ? ' neu' : ''}"${tap}><div class="sim-tw-kopf">${kw}<span class="sim-pause-text">${ic(p[0])} ${esc(poR ? 'Playoffs · ' + poR : p[1])}</span></div>${zeilenHtml(e)}</li>`;
    }
    const s = e.spiel, [a, b] = s.tore, kl = a > b ? 's' : a === b ? 'u' : 'n';
    const d = e.platzVor && e.platz ? e.platzVor - e.platz : 0;
    const pfeil = d > 0 ? `<span class="sim-auf">▲${d}</span>` : d < 0 ? `<span class="sim-ab">▼${-d}</span>` : '';
    const liga = s.typ === 'liga' && e.md;
    const tap = liga ? ` data-md="${e.md}" tabindex="0" role="button" aria-label="Spieltag ${e.md}: ${esc(vereinsName(s.gegner))} ${a} zu ${b}, Konferenz öffnen"` : '';
    return `<li class="sim-tw${liga ? ' sim-tippbar' : ''}${neu ? ' neu' : ''}"${tap}>
      <div class="sim-tw-kopf">${kw}
        <span class="sim-geg">${wappen(s.gegner)}<span class="n">${s.typ === 'test' ? 'Test: ' : ''}${esc(vereinsName(s.gegner))}</span><small>${s.heim ? '(H)' : '(A)'}</small></span>
        <b class="sim-erg ${kl}">${a}:${b}</b>${liga && e.platz ? `<span class="sim-platz">Pl. ${e.platz} ${pfeil}</span>` : '<span></span>'}</div>
      ${s.sch ? `<div class="sim-sch">${ic('ball-football')} ${esc(s.sch)}</div>` : ''}
      ${zeilenHtml(e)}</li>`;
  }
  function haltKarte(h) {
    if (!h) return '';
    const L = LAUF;
    // D120: Urteil des Chefscouts (Symbol + Wort) statt Wertzahlen („98 gegen 83 Punkte“, „Preis 85 % des Werts“)
    const csUrteil = x => { try { const C = window.DFLChefscout, u = C && x.deal ? C.urteil(window.DFLSpiel.liga(), x.deal) : null; return u ? C.urteilChip(u) + ' ' : ''; } catch (e) { return ''; } };
    if (h.art === 'anfrage' && h.a && h.a.art === 'angebot') {
      // D99: Angebot an dich – „Später“ hebt es bis zum Ende des Wechselfensters auf (kein zweiter Halt)
      const a = h.a, team = vereinsName(spielIdVon(a.team)), grund = window.DFLAnfragen && DFLAnfragen.angebotGrund ? DFLAnfragen.angebotGrund(a) : '';
      return `<div class="sim-halt" role="group" aria-labelledby="sim-h-t"><span class="sim-h-eyebrow">${ic('user-plus')} Angebot · KW ${LEAGUE.week}</span>
        <h4 id="sim-h-t">${esc(team)} bietet dir ${esc((a.spielerName || 'einen Spieler').split(' (')[0])} an</h4>
        <div class="sim-teile"><span class="sim-blass sim-klein">Sie wollen</span>${(a.teile || []).map(t => `<div>${ic('chevron-right')}<span>${esc(t)}</span></div>`).join('')}</div>
        <p class="sim-klein sim-blass">${csUrteil(a)}${esc(grund)}${grund ? ' · ' : ''}gilt bis KW ${a.bis}</p>
        <div class="sim-knoepfe"><button class="sim-knopf hell" type="button" data-halt="ansehen">${ic('eye')} Ansehen</button><button class="sim-knopf hell" type="button" data-halt="ablehnen">${ic('x')} Kein Interesse</button></div>
        <button class="sim-knopf blau" type="button" data-halt="spaeter">${ic('player-track-next')}<span>Später entscheiden<small>weiter simulieren, bleibt bis zum Ende des Wechselfensters</small></span></button></div>`;
    }
    if (h.art === 'anfrage' || h.art === 'letzte') {
      const a = h.a, letzte = h.art === 'letzte', team = vereinsName(spielIdVon(a.team));
      const was = a.art === 'pick' ? (a.pickText || 'deinen Pick') : (a.spielerName || 'einen Spieler');
      return `<div class="sim-halt" role="group" aria-labelledby="sim-h-t"><span class="sim-h-eyebrow">${ic(letzte ? 'clock' : 'arrows-exchange')} ${letzte ? `Läuft ab · KW ${a.bis}` : `Trade-Anfrage · KW ${LEAGUE.week}`}</span>
        <h4 id="sim-h-t">${letzte ? `Letzte Woche: ${esc(team)} wartet noch auf dich` : `${esc(team)} will ${esc(was)}`}</h4>
        <div class="sim-teile"><span class="sim-blass sim-klein">Sie bieten</span>${(a.teile || []).map(t => `<div>${ic('chevron-right')}<span>${esc(t)}</span></div>`).join('')}</div>
        <p class="sim-klein sim-blass">${csUrteil(a)}${a.grund ? esc(a.grund) + ' · ' : ''}gilt bis KW ${a.bis}</p>
        <div class="sim-knoepfe"><button class="sim-knopf hell" type="button" data-halt="ansehen">${ic('eye')} Ansehen</button><button class="sim-knopf hell" type="button" data-halt="ablehnen">${ic('x')} Ablehnen</button></div>
        ${letzte ? `<button class="sim-knopf blau" type="button" data-halt="ablaufen">${ic('player-track-next')}<span>Ablaufen lassen<small>weiter simulieren</small></span></button>`
          : `<button class="sim-knopf blau" type="button" data-halt="spaeter">${ic('player-track-next')}<span>Später entscheiden<small>weiter simulieren, vor Ablauf halte ich noch einmal</small></span></button>`}</div>`;
    }
    if (h.art === 'entscheidung') {
      const ent = h.ent;
      return `<div class="sim-halt ereignis" role="group" aria-labelledby="sim-h-t"><span class="sim-h-eyebrow">${ic('dice-5')} Entscheidung · KW ${LEAGUE.week}</span>
        <h4 id="sim-h-t">${esc(ent.titel)}</h4>${ent.text ? `<p>${esc(ent.text)}</p>` : ''}
        <div class="sim-wahl">${ent.optionen.map((o, n) => `<button class="sim-knopf hell" type="button" data-wahl="${n}"><span>${esc(o.label)}${o.info ? `<small>${o.ungewiss ? 'Ausgang ungewiss · ' : ''}${esc(o.info)}</small>` : ''}</span></button>`).join('')}</div></div>`;
    }
    if (h.art === 'verletzt') {
      return `<div class="sim-halt" role="group" aria-labelledby="sim-h-t"><span class="sim-h-eyebrow">${ic('bandage')} Verletzung · KW ${h.e ? h.e.woche : LEAGUE.week}</span>
        <h4 id="sim-h-t">${esc(h.zeile.text)} · Startelf</h4>
        <p>Vor dem nächsten Spiel stellt die Beste Elf um und holt ihn nach der Verletzung zurück. Du kannst die Aufstellung auch selbst ändern.</p>
        <div class="sim-knoepfe"><button class="sim-knopf hell" type="button" data-halt="aufstellung">${ic('users')} Aufstellung</button><button class="sim-knopf blau" type="button" data-halt="weiter">${ic('player-track-next')} Weiter</button></div></div>`;
    }
    if (h.art === 'fenster') {
      return `<div class="sim-halt" role="group" aria-labelledby="sim-h-t"><span class="sim-h-eyebrow">${ic('hand-stop')} Offen · KW ${LEAGUE.week}</span>
        <h4 id="sim-h-t">${esc(h.titel || 'Eine Entscheidung wartet')}</h4><p>Das Spiel fragt dich etwas. Erledige es im Fenster – danach geht es hier weiter.</p>
        <button class="sim-knopf blau" type="button" data-halt="fenster">${ic('external-link')} Zum Fenster</button></div>`;
    }
    if (h.art === 'hinweis') {
      return `<div class="sim-halt" role="group" aria-labelledby="sim-h-t"><span class="sim-h-eyebrow">${ic('info-circle')} Hinweis · KW ${LEAGUE.week}</span>
        <h4 id="sim-h-t">${esc(h.text)}</h4><button class="sim-knopf blau" type="button" data-halt="weiter">${ic('player-track-next')} Weiter</button></div>`;
    }
    return '';
  }
  function zusammenfassungKopf(L) {
    const g = L.grund || {}, P = PFLICHT[g.art];
    const z = L.ziel;
    let eyebrow, titel, text;
    if (g.art === 'ziel') {
      eyebrow = `Ziel erreicht · ${kalender(LEAGUE.week).split(' · ')[0]}`; titel = z.name;
      text = z.key === 'deadline' ? 'Letzte Woche für Trades. Danach erst wieder nach der Saison.' : z.key === 'hauptrunde' ? 'Die Hauptrunde ist durch – jetzt kommen die Playoffs.'
        : z.key === 'start' ? 'Als Nächstes: Spieltag 1.' : z.key === 'fa' ? 'Die Free Agency läuft – ab jetzt unterschreibt die KI.' : 'Hier geht es weiter, wann du willst.';
    } else if (g.pflicht && P) { eyebrow = `Angehalten · ${kalender(LEAGUE.week).split(' · ')[0]}`; titel = P.titel; text = P.text; }
    else if (g.art === 'fehler') { eyebrow = 'Angehalten'; titel = 'Etwas ist schiefgelaufen'; text = 'Spiel bitte von Hand weiter (' + g.text + ').'; }
    else if (g.art === 'steht') { eyebrow = 'Angehalten'; titel = 'Hier geht es nicht weiter'; text = 'Das Spiel braucht erst eine Entscheidung von dir.'; }
    else { eyebrow = `Angehalten · ${kalender(LEAGUE.week).split(' · ')[0]}`; titel = 'Zwischenstand'; text = 'Hier geht es weiter, wann du willst.'; }
    return `<p class="sim-eyebrow">${esc(eyebrow)}</p><h2 id="sim-titel">${esc(titel)}</h2><p>${esc(text)}</p>`;
  }
  function kurve(L) {
    // Platz nach jeder Woche (erst ab Spieltag 1 – davor stünde die Tabelle nach dem Alphabet)
    const reihe = [{ p: L.start.md > 0 ? L.start.platz : null, kw: L.start.woche }].concat(L.wochen.map(e => ({ p: e.platz, kw: e.woche + 1 }))).filter(x => x.p != null);
    const pts = reihe.map(x => x.p), kws = reihe.map(x => x.kw), n = pts.length;
    if (n < 2) return '';
    const B = 300, H = 92, l = 26, r = 14, o = 10, u = 18, maxP = Math.max(16, ...pts);
    const x = i => l + (B - l - r) * (i / (n - 1)), y = p => o + (H - o - u) * (p - 1) / (maxP - 1);
    const pfad = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(' ');
    return `<svg class="sim-kurve" viewBox="0 0 ${B} ${H}" role="img" aria-label="Platz in der Conference: von ${pts[0]} auf ${pts[n - 1]}">
      ${[1, 8, maxP].map(p => `<line x1="${l}" x2="${B - r}" y1="${y(p)}" y2="${y(p)}" class="sim-k-gitter"/><text x="${l - 6}" y="${y(p) + 4}" text-anchor="end" class="sim-k-text">${p}</text>`).join('')}
      <line x1="${l}" x2="${B - r}" y1="${((y(7) + y(8)) / 2).toFixed(1)}" y2="${((y(7) + y(8)) / 2).toFixed(1)}" class="sim-k-linie"/>
      <path d="${pfad}" class="sim-k-pfad"/>
      ${pts.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p).toFixed(1)}" r="${i === 0 || i === n - 1 ? 4.5 : 2.5}" class="sim-k-punkt${i === n - 1 ? ' ende' : ''}"><title>KW${kws[i] || ''}: Platz ${p}</title></circle>`).join('')}
      <text x="${x(0)}" y="${H - 4}" class="sim-k-text">KW${kws[0]}</text><text x="${x(n - 1)}" y="${H - 4}" text-anchor="end" class="sim-k-text">KW${kws[n - 1]}</text></svg>`;
  }
  function brauchtDich() {
    const z = [];
    offeneAnfragen().forEach(a => z.push(`<li>${ic(a.art === 'angebot' ? 'user-plus' : 'arrows-exchange')}<span><b>${esc(vereinsName(spielIdVon(a.team)))}</b> ${a.art === 'angebot' ? 'bietet dir ' + esc((a.spielerName || '').split(' (')[0]) + ' an' : 'will ' + esc(a.art === 'pick' ? (a.pickText || 'deinen Pick') : (a.spielerName || '').split(' (')[0])} – ${a.art === 'angebot' && a.spaeter ? 'bis Fensterende' : 'gilt bis KW ' + a.bis}</span>
      <button class="sim-link" type="button" data-anfrage="${esc(a.id)}">Ansehen</button></li>`));
    const sq = typeof SQUAD !== 'undefined' ? SQUAD : [];
    const streik = sq.filter(p => p.onStrike).map(spielerName), wunsch = sq.filter(p => p.wantsOut && !p.onStrike).map(spielerName), unz = sq.filter(p => p._dcStage === 'unhappy').map(spielerName);
    if (streik.length) z.push(`<li>${ic('hand-stop')}<span><b>Streik:</b> ${esc(streik.join(', '))} – traden oder aussitzen</span></li>`);
    if (wunsch.length) z.push(`<li>${ic('plane-departure')}<span><b>Trade-Wunsch:</b> ${esc(wunsch.join(', '))}</span></li>`);
    if (unz.length) z.push(`<li>${ic('mood-sad')}<span><b>Unzufrieden:</b> ${esc(unz.join(', '))} – mehr Einsatzzeit</span></li>`);
    if (!z.length) z.push(`<li class="ok">${ic('circle-check')}<span>Nichts Dringendes.</span></li>`);
    return `<section class="sim-tafel"><h3 class="sim-h3">${ic('alert-triangle')} Braucht dich</h3><ul class="sim-braucht">${z.join('')}</ul></section>`;
  }
  function zusammenfassung(L) {
    const sp = L.wochen.filter(e => e.spiel && e.spiel.typ === 'liga').map(e => e.spiel);
    const s = sp.filter(x => x.tore[0] > x.tore[1]).length, u = sp.filter(x => x.tore[0] === x.tore[1]).length, n = sp.length - s - u;
    const tf = sp.reduce((a, x) => a + x.tore[0], 0), tg = sp.reduce((a, x) => a + x.tore[1], 0);
    const sch = new Map();
    sp.forEach(x => String(x.sch || '').split(', ').filter(Boolean).forEach(t => { const m = /^(.*?)(?: (\d+))?$/.exec(t); sch.set(m[1], (sch.get(m[1]) || 0) + (+m[2] || 1)); }));
    const top = [...sch].sort((a, b) => b[1] - a[1])[0];
    const p0 = L.start.platz, p1 = L.ende ? L.ende.platz : platzVon('fcm'), dp = p0 && p1 ? p0 - p1 : 0;
    const c0 = L.start.po, c1 = L.ende ? L.ende.po : null, dc = c0 != null && c1 != null ? c1 - c0 : 0;
    const kl = d => (d > 0 ? 'sim-gut' : d < 0 ? 'sim-schlecht' : '');
    const letzteMd = [...L.wochen].reverse().find(e => e.md);
    const poW = [...L.wochen].reverse().find(e => e.poRunde);
    const playoffZeile = (() => { for (const e of L.wochen) { const z = e.zeilen.find(x => x.art === 'playoffs'); if (z) return z.text; } return null; })();
    const konf = (teamVon('fcm') || {}).conference;
    const naechste = (() => { try { return vorschauHtml(null, 'voll'); } catch (e) { return ''; } })();
    const tests = L.wochen.filter(e => e.spiel && e.spiel.typ === 'test').map(e => e.spiel);
    const chanceZeile = c0 != null && c1 != null ? `<div class="sim-vn"><span>Playoff-Chance</span><b class="${kl(dc)}">${prozent(c0)} → ${prozent(c1)}</b></div>` : '';
    const ergChip = x => { const k = x.tore[0] > x.tore[1] ? 's' : x.tore[0] === x.tore[1] ? 'u' : 'n'; return `<span class="sim-erg ${k}" title="${esc(vereinsName(x.gegner))}">${x.tore[0]}:${x.tore[1]}</span>`; };
    // Vor Spieltag 1 (nur Vorbereitung): Testspiele statt Bilanz, kein Platz und keine Tabelle (alle 0 Punkte)
    const saison = (LEAGUE.matchday || 0) > 0, vergleich = L.start.md > 0 && p0;
    const bilanz = sp.length ? `<section class="sim-tafel"><h3 class="sim-h3">${ic('chart-line')} Bilanz · ${sp.length} Spiel${sp.length === 1 ? '' : 'e'}</h3>
        <div class="sim-bilanz"><div><b class="sim-gut">${s}</b><small>Siege</small></div><div><b>${u}</b><small>Remis</small></div><div><b class="sim-schlecht">${n}</b><small>Niederl.</small></div><div><b>${tf}:${tg}</b><small>Tore</small></div></div>
        ${top ? `<div class="sim-vn"><span>Bester Schütze</span><b>${esc(top[0])} · ${top[1]} Tor${top[1] === 1 ? '' : 'e'}</b></div>` : ''}
        ${p1 && saison ? `<div class="sim-vn"><span>Platz in der Conference</span><b class="${vergleich ? kl(dp) : ''}">${vergleich ? p0 + ' → ' : ''}${p1}${vergleich && dp ? (dp > 0 ? ' ▲' + dp : ' ▼' + (-dp)) : ''}</b></div>` : ''}
        ${chanceZeile}${kurve(L)}</section>`
      : `<section class="sim-tafel"><h3 class="sim-h3">${ic('barbell')} Vorbereitung · ${L.wochen.length} Woche${L.wochen.length === 1 ? '' : 'n'}</h3>
        ${tests.length ? `<div class="sim-vn"><span>Testspiele</span><span class="sim-reihe">${tests.map(ergChip).join('')}</span></div>` : ''}${chanceZeile}</section>`;
    return `${bilanz}
      ${playoffZeile ? `<section class="sim-tafel"><h3 class="sim-h3">${ic('trophy')} Playoffs</h3><p class="sim-klein">${esc(playoffZeile)}.</p></section>` : ''}
      ${brauchtDich()}
      ${naechste}
      ${konf && !poLaeuft() && saison ? `<section class="sim-tafel"><h3 class="sim-h3">${ic('trophy')} Conference ${esc(konfName(konf))} · Top 9</h3>${tabelleHtml(konf, { max: 9, rechnen: true })}</section>` : ''}
      ${letzteMd || poW || (konf && saison) ? `<div class="sim-kacheln">
        ${letzteMd ? `<button class="sim-knopf hell" type="button" data-md="${letzteMd.md}">${ic('ball-football')}<span>Konferenz<small>Spieltag ${letzteMd.md}</small></span></button>` : ''}
        ${poW ? `<button class="sim-knopf hell" type="button" data-runde="${poW.poRunde}">${ic('trophy')}<span>Playoffs<small>letzte Runde</small></span></button>` : ''}
        ${konf && saison ? `<button class="sim-knopf hell" type="button" data-sim="tabelle">${ic('list-numbers')}<span>Tabelle<small>ganze Conference</small></span></button>` : ''}
      </div>` : ''}
      <p class="sim-blass sim-klein sim-zeit">${L.wochen.length} Woche${L.wochen.length === 1 ? '' : 'n'} in ${(L.zeit.gesamt / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} s</p>`;
  }

  // ── Klicks im Blatt ──────────────────────────────────────────────────────
  function klick(ev) {
    const t = ev.target.closest('button, [data-md], [data-runde]');
    if (ev.target.classList && ev.target.classList.contains('sim-dimmer')) { if (MODUS === 'wahl' || (LAUF && LAUF.fertig)) schliessen(); return; }
    if (!t || !BLATT.contains(t)) return;
    const L = LAUF, d = t.dataset;
    if (d.ziel) { WAHL = d.ziel; blattModus('wahl'); const b = BLATT.querySelector(`[data-ziel="${WAHL}"]`); if (b) b.focus({ preventScroll: true }); return; }
    if (d.sim === 'zu') { schliessen(); return; }
    if (d.sim === 'los') { starte(WAHL); knopfAktualisieren(); return; }
    if (d.sim === 'stopp') { anhalten(); if (L && L.halt == null) { const k = BLATT.querySelector('[data-sim="stopp"]'); if (k) { k.disabled = true; k.innerHTML = `${ic('loader-2')} Hält nach dieser Woche …`; } } return; }
    if (d.sim === 'fertig') { schliessen(); return; }
    if (d.sim === 'pflicht') {
      schliessen();
      setTimeout(() => { try { const z = window.DFLAppShell && DFLAppShell.ctaZustand ? DFLAppShell.ctaZustand() : null; if (z) { z.go(); DFLAppShell.cta(); } } catch (e) { console.warn('[DFL-Simulieren] Pflicht', e); } }, 30);
      return;
    }
    if (d.sim === 'tabelle') { ZURUECK = MODUS; blattModus('tabelle'); return; }
    if (d.sim === 'zurueck') { blattModus(ZURUECK || MODUS || 'ziel'); ZURUECK = null; return; }
    if (d.anfrage && window.DFLAnfragen) { schliessen(); DFLAnfragen.zeigen(d.anfrage); return; }
    if (d.md) { ZURUECK = MODUS; SICHT = { md: +d.md }; blattModus('konferenz'); return; }
    if (d.runde) { ZURUECK = MODUS; SICHT = { runde: +d.runde }; blattModus('konferenz'); return; }
    if (!L || !L.halt) return;
    const h = L.halt;
    if (d.wahl != null && h.art === 'entscheidung') {
      const o = h.ent.optionen[+d.wahl];
      if (o) { try { o.btn.click(); } catch (e) { console.warn('[DFL-Simulieren] Entscheidung', e); } (h.e || { zeilen: [] }).zeilen.push({ art: 'entscheidung', text: `${h.ent.titel}: ${o.label}` }); }
      blattModus('laeuft'); weiter(); return;
    }
    if (d.halt === 'ansehen' && window.DFLAnfragen) { beiseite(); DFLAnfragen.zeigen(h.a.id); return; }
    if (d.halt === 'ablehnen' && window.DFLAnfragen) {
      DFLAnfragen.ablehnen(h.a.id);
      const a = ((CLUB.dfl && CLUB.dfl.anfragen) || []).find(x => x.id === h.a.id);
      (h.e || L.wochen[L.wochen.length - 1] || { zeilen: [] }).zeilen.push({ art: 'anfrage', text: `Anfrage ${vereinsName(spielIdVon(h.a.team))}: ${STATUS[a && a.status] || 'abgelehnt'}` });
      blattModus('laeuft'); weiter(); return;
    }
    if (d.halt === 'spaeter') {
      if (h.a.art === 'angebot' && window.DFLAnfragen && DFLAnfragen.spaeter) DFLAnfragen.spaeter(h.a.id);     // D99: bis Fensterende
      else L.spaeter[h.a.id] = h.a.bis;
      (h.e || { zeilen: [] }).zeilen.push({ art: 'anfrage', text: `${h.a.art === 'angebot' ? 'Angebot' : 'Anfrage'} ${vereinsName(spielIdVon(h.a.team))}: später (${h.a.art === 'angebot' ? 'bis Fensterende' : 'bis KW ' + h.a.bis})` });
      blattModus('laeuft'); weiter(); return;
    }
    if (d.halt === 'ablaufen' || d.halt === 'weiter') { blattModus('laeuft'); weiter(); return; }
    if (d.halt === 'aufstellung') {
      beiseite();
      try { if (window.DFLAppShell && DFLAppShell.zeige) { DFLAppShell.zeige('squad'); const b = [...document.querySelectorAll('#view-squad .subtab')].find(x => /'lineup'/.test(x.getAttribute('onclick') || '')); if (b) b.click(); } } catch (e) { /* Ansicht optional */ }
      return;
    }
    if (d.halt === 'fenster') { if (h.ov) h.ov.classList.remove('sim-gespiegelt'); beiseite(); return; }
  }

  // ══ 7) Knopf „bis …“ am Haupt-Button (Handy) und neben „Woche weiter“ (PC) ══
  function simMoeglich() {
    if (!dfl() || (LAUF && !LAUF.fertig)) return false;
    if (pflichtHalt()) return false;
    if (hatShell()) { try { if (!DFLAppShell.ctaZustand()) return false; } catch (e) { return false; } }
    return ziele().length > 0;
  }
  function knopfBauen() {
    if (!hatDom() || document.getElementById('dfl-sim-knopf')) return;
    const b = document.createElement('button');
    b.id = 'dfl-sim-knopf'; b.type = 'button';
    b.setAttribute('aria-haspopup', 'dialog');
    b.addEventListener('click', () => { oeffnen(); knopfAktualisieren(); });
    document.body.appendChild(b);
  }
  function knopfAktualisieren() {
    if (!hatDom()) return;
    knopfBauen();
    const b = document.getElementById('dfl-sim-knopf'), cta = document.getElementById('app-cta');
    const pause = pausiert();
    const zeigen = hatShell() && !!cta && cta.classList.contains('zeigen') && !blattOffen() && (pause || simMoeglich());
    b.classList.toggle('zeigen', zeigen);
    b.classList.toggle('weiter', pause);
    document.body.classList.toggle('sim-mit-knopf', zeigen);
    const html = pause ? `${ic('player-play')}<span>weiter</span>` : `${ic('player-track-next')}<span>bis …</span>`;
    if (b.innerHTML !== html) b.innerHTML = html;
    b.setAttribute('aria-label', pause ? 'Simulation fortsetzen' : 'Simulieren bis …');
    // PC: neben „Woche weiter“ im Kalender
    const pc = document.getElementById('dfl-sim-pc');
    if (pc) pc.hidden = hatShell() || !(pause || simMoeglich());
  }
  function pcKnopfEinbauen() {
    const n = dfl() && hatDom() ? document.querySelector('#calendar-widget .cal-next') : null;
    if (n && !document.getElementById('dfl-sim-pc')) {
      n.insertAdjacentHTML('afterend', `<button type="button" class="dfl-sim-pc" id="dfl-sim-pc">${ic('player-track-next')} bis …</button>`);
      document.getElementById('dfl-sim-pc').addEventListener('click', () => { oeffnen(); knopfAktualisieren(); });
    }
  }
  {
    const _orig = window.renderCalendarWidget;
    if (typeof _orig === 'function') {
      window.renderCalendarWidget = function () {
        const r = _orig.apply(this, arguments);
        try { pcKnopfEinbauen(); knopfAktualisieren(); } catch (e) { /* nur Anzeige */ }
        return r;
      };
      try { renderCalendarWidget = window.renderCalendarWidget; } catch (e) { /* window reicht */ }
    }
  }

  // ══ 8) D62 an ihrer Stelle: Office, Spieltag, Liga ══════════════════════
  // Office: Spielvorschau unter den Kacheln (Handy) bzw. oben (PC)
  function officeVorschau() {
    if (!hatDom()) return;
    const alt = document.getElementById('sim-office-vorschau'); if (alt) alt.remove();
    if (!dfl()) return;
    const ziel = document.getElementById('view-home'); if (!ziel) return;
    let html = '';
    try { html = vorschauHtml(null, 'office'); } catch (e) { console.warn('[DFL-Simulieren] Spielvorschau', e); }
    if (!html) return;
    const box = `<div id="sim-office-vorschau" class="sim-office">${html}</div>`;
    // unter „Vor dem 1. Spieltag“ (D62 · 7, dfl_blick_patch.js), sonst direkt unter dem Office-Kopf
    const kopf = document.getElementById('dfl-erste-schritte') || document.getElementById('app-office-kopf');
    if (kopf) kopf.insertAdjacentHTML('afterend', box); else ziel.insertAdjacentHTML('afterbegin', box);
  }
  {
    const _orig = window.renderHomeTab;
    if (typeof _orig === 'function') {
      window.renderHomeTab = function () {
        const r = _orig.apply(this, arguments);
        if (!simAktiv()) { try { officeVorschau(); } catch (e) { /* nur Anzeige */ } try { knopfAktualisieren(); } catch (e) { /* nur Anzeige */ } }
        return r;
      };
    }
  }
  // Spieltag: volle Vorschau vor dem Anpfiff (Liga und Playoffs)
  function spieltagVorschau() {
    if (!hatDom()) return;
    let el = document.getElementById('sim-spiel-vorschau');
    const fx = typeof CURRENT_FIXTURE !== 'undefined' ? CURRENT_FIXTURE : null, g = typeof G !== 'undefined' ? G : null;
    const offen = dfl() && fx && (fx.type === 'liga' || fx.type === 'playoff') && g && !g.running && !g.ended && g.min === 0;
    if (!offen) { if (el) el.remove(); return; }
    let html = '';
    try { html = vorschauHtml(null, 'voll'); } catch (e) { console.warn('[DFL-Simulieren] Spielvorschau', e); }
    if (!html) { if (el) el.remove(); return; }
    if (!el) {
      const wo = document.querySelector('#view-match .feed-wrap');
      if (!wo) return;
      el = document.createElement('div'); el.id = 'sim-spiel-vorschau'; el.className = 'sim-spieltag-vorschau';
      wo.insertBefore(el, wo.firstChild);
    }
    el.innerHTML = html;
  }
  {
    const _orig = window.switchAppView;
    if (typeof _orig === 'function') {
      window.switchAppView = function (view) {
        const r = _orig.apply(this, arguments);
        if (view === 'match') { try { spieltagVorschau(); } catch (e) { /* nur Anzeige */ } }
        try { knopfAktualisieren(); } catch (e) { /* nur Anzeige */ }
        return r;
      };
    }
  }
  // Liga → Tabelle: Playoff-Bild durch die Tabelle mit Setzplätzen, Linie und Chance ersetzen (Segment je Conference)
  let LIGA_KONF = null;
  // Nutzer 2026-10-14: „bitte auch die andere conference zeigen bei den tabellen“ – unter dem Playoff-Bild alle Divisionen der
  // gewählten Conference (die eigene Division steht oben schon)
  function divisionenHtml(konf) {
    if (!window.DFLTabellen) return '';
    const ich = teamVon('fcm') || {}, teams = ligaTeams().filter(t => t.conference === konf);
    const divs = [...new Set(teams.map(t => t.division))].filter(d => !(konf === ich.conference && d === ich.division));
    return divs.length ? `<div class="sim-liga-divs">${divs.map(d => DFLTabellen.division(d)).join('')}</div>` : '';
  }
  function ligaTabelle() {
    if (!hatDom() || !dfl()) return;
    const box = document.querySelector('#lg-sub-tabelle .dfl-tabellen');
    if (!box) return;
    const eigen = (teamVon('fcm') || {}).conference, konf = LIGA_KONF || eigen;
    const KS = Object.keys(D.KONF || { NORD_OST: 1, SUE_WEST: 1 }).sort((a, b) => (b === eigen) - (a === eigen));
    let el = box.querySelector('.sim-liga-tabelle');
    const html = `<div class="lg-header"><h3 style="font-size:13px;font-weight:800">Conference ${esc(konfName(konf))} – Playoff-Bild</h3></div>
      <div class="sim-seg" role="group" aria-label="Conference">${KS.map(k => `<button type="button" data-konf="${k}" aria-pressed="${k === konf}">${esc(konfName(k))}</button>`).join('')}</div>
      ${tabelleHtml(konf)}${divisionenHtml(konf)}`;
    if (!el) {
      const alt = [...box.children].find(c => /Playoff-Bild/.test(c.textContent || ''));
      el = document.createElement('div'); el.className = 'dfl-div-tabelle sim-liga-tabelle';
      if (alt) box.replaceChild(el, alt); else box.appendChild(el);
      el.addEventListener('click', ev => { const b = ev.target.closest('[data-konf]'); if (b) { LIGA_KONF = b.dataset.konf; ligaTabelle(); } });
    }
    el.innerHTML = html;
    // Playoff-Chance kurz danach rechnen (300 Simulationen), dann nachtragen
    if (!poLaeuft() && !chancen(false)) setTimeout(() => { try { if (el.isConnected) { chancen(true); ligaTabelle(); } } catch (e) { /* nur Anzeige */ } }, 60);
  }
  {
    const _orig = window.renderLgTabelle;
    if (typeof _orig === 'function') {
      window.renderLgTabelle = function () {
        const r = _orig.apply(this, arguments);
        try { ligaTabelle(); } catch (e) { console.warn('[DFL-Simulieren] Tabelle', e); }
        return r;
      };
    }
  }
  // Liga → „Spieltag“: Konferenz des letzten Spieltags, blättern; in den Playoffs die letzte Runde
  let LIGA_MD = null;
  function ligaReiterEinbauen() {
    if (!hatDom() || !dfl() || document.getElementById('lg-sub-spieltag')) return;
    const leiste = document.querySelector('#view-liga .subtabs'), tab = document.getElementById('lg-sub-tabelle');
    if (!leiste || !tab) return;
    const knopf = '<button class="subtab" onclick="switchLigaSubview(\'spieltag\', this)">Spieltag</button>';
    const t = [...leiste.querySelectorAll('.subtab')].find(b => /'tabelle'/.test(b.getAttribute('onclick') || ''));
    if (t) t.insertAdjacentHTML('afterend', knopf); else leiste.insertAdjacentHTML('afterbegin', knopf);
    tab.insertAdjacentHTML('afterend', '<div class="subview" id="lg-sub-spieltag" style="padding-top:12px"></div>');
    document.getElementById('lg-sub-spieltag').addEventListener('click', ev => {
      const b = ev.target.closest('[data-blaettern]'); if (!b) return;
      LIGA_MD = b.dataset.blaettern === 'po' ? 'po' : +b.dataset.blaettern; zeigeSpieltag();
    });
  }
  function zeigeSpieltag() {
    const el = hatDom() && document.getElementById('lg-sub-spieltag');
    if (!el || !dfl()) return;
    const nrn = spieltagNummern(), po = poLaeuft() ? LEAGUE.dflPO : null;
    const poRunde = po ? po.spiele.filter(s => s.sieger).reduce((m, s) => Math.max(m, s.runde), 0) : 0;
    let wahl = LIGA_MD;
    if (wahl == null) wahl = poRunde ? 'po' : nrn[nrn.length - 1];
    if (wahl !== 'po' && nrn.indexOf(wahl) < 0) wahl = nrn[nrn.length - 1];
    if (wahl == null) { el.innerHTML = `<p class="sim-leer">${ic('ball-football')} Nach dem 1. Spieltag stehen hier alle Ergebnisse mit Torschützen.</p>`; return; }
    const i = nrn.indexOf(wahl), vor = wahl === 'po' ? nrn[nrn.length - 1] : nrn[i - 1], nach = wahl === 'po' ? null : (nrn[i + 1] != null ? nrn[i + 1] : (poRunde ? 'po' : null));
    const titel = wahl === 'po' ? 'Playoffs' : `Spieltag ${wahl}`;
    el.innerHTML = `<div class="sim-blaettern"><button type="button" class="sim-knopf hell" data-blaettern="${vor != null ? vor : ''}"${vor == null ? ' disabled' : ''} aria-label="Früherer Spieltag">${ic('chevron-left')}</button>
      <b>${esc(titel)}</b><button type="button" class="sim-knopf hell" data-blaettern="${nach != null ? nach : ''}"${nach == null ? ' disabled' : ''} aria-label="Späterer Spieltag">${ic('chevron-right')}</button></div>
      ${wahl === 'po' ? playoffRundeHtml(poRunde) : konferenzHtml(wahl, { bewegung: true })}`;
  }
  {
    const _orig = window.switchLigaSubview;
    if (typeof _orig === 'function') {
      window.switchLigaSubview = function (name) {
        const r = _orig.apply(this, arguments);
        const el = hatDom() && document.getElementById('lg-sub-spieltag');
        if (el) el.classList.toggle('active', name === 'spieltag');
        if (name === 'spieltag') { try { zeigeSpieltag(); } catch (e) { console.warn('[DFL-Simulieren] Spieltag', e); } }
        return r;
      };
    }
  }
  {
    const _orig = window.renderLeagueTab;
    if (typeof _orig === 'function') {
      window.renderLeagueTab = function () {
        const r = _orig.apply(this, arguments);
        if (!simAktiv()) {
          try { ligaReiterEinbauen(); LIGA_MD = null; const el = document.getElementById('lg-sub-spieltag'); if (el && el.classList.contains('active')) zeigeSpieltag(); } catch (e) { /* nur im Spiel */ }
        }
        return r;
      };
    }
  }
  // Laufband antippen → Liga, Unterreiter „Spieltag“ (dort stehen dieselben Ergebnisse mit Torschützen)
  if (hatDom()) {
    document.addEventListener('click', ev => {
      if (!ev.target || !ev.target.closest || !ev.target.closest('#dfl-band')) return;
      setTimeout(() => {
        try {
          ligaReiterEinbauen();
          const b = [...document.querySelectorAll('#view-liga .subtab')].find(x => /'spieltag'/.test(x.getAttribute('onclick') || ''));
          if (b && typeof window.switchLigaSubview === 'function') { LIGA_MD = null; window.switchLigaSubview('spieltag', b); }
        } catch (e) { /* nur Anzeige */ }
      }, 0);
    }, true);
  }

  // ── Ein/aus, Beobachter ──────────────────────────────────────────────────
  if (hatDom()) {
    const los = () => {
      knopfBauen(); pcKnopfEinbauen(); knopfAktualisieren();
      const cta = document.getElementById('app-cta');
      if (cta && window.MutationObserver && !cta.dataset.simBeobachtet) {
        cta.dataset.simBeobachtet = '1';
        new MutationObserver(() => knopfAktualisieren()).observe(cta, { attributes: true, attributeFilter: ['class'], childList: true });
      }
      try { if (dfl() && document.getElementById('view-home') && document.getElementById('view-home').classList.contains('active')) officeVorschau(); } catch (e) { /* nur Anzeige */ }
      try { ligaReiterEinbauen(); } catch (e) { /* nur Anzeige */ }
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', los); else los();
    setInterval(() => { if (document.visibilityState === 'visible') { try { los(); } catch (e) { /* nur Anzeige */ } } }, 1500);
  }

  window.DFLSimulieren = {
    ziele, starte, oeffnen, anhalten, weiter, schliessen, lauf: () => LAUF, laeuft: () => !!(LAUF && !LAUF.fertig), aktiv: simAktiv,
    pflichtHalt, vorschauDaten, vorschauHtml, konferenzHtml, playoffRundeHtml, tabelleHtml, chancen, setzOrdnung, platzVon, dreiWege,
    einstellungen, einstellungSetzen, zeileAus, LAZY: LAZY_ZAEHLER,
    entscheide(w) { const L = LAUF; if (!L || !L.halt) return false; const h = L.halt;
      if (h.art === 'anfrage' && w === 'spaeter') { if (h.a.art === 'angebot' && window.DFLAnfragen && DFLAnfragen.spaeter) DFLAnfragen.spaeter(h.a.id); else L.spaeter[h.a.id] = h.a.bis; }
      if ((h.art === 'anfrage' || h.art === 'letzte') && w === 'ablehnen' && window.DFLAnfragen) DFLAnfragen.ablehnen(h.a.id);
      weiter(w); return true; }
  };
  console.log('[DFL-Simulieren v1] aktiv — „bis …“ am Haupt-Button (D64): Ziele je Phase, Woche für Woche mit der Engine, Halt bei Pflichtstellen/Anfrage/Ereignis, Ticker + Zusammenfassung; D62: Spielvorschau mit Siegchance, Konferenz mit Torschützen, Tabelle mit Playoff-Linie und -Chance');
})();
