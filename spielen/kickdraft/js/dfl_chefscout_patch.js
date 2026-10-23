/* ═══════════════════════════════════════════════════════════════════════════
   DFL-CHEFSCOUT  ·  v1  (D120 + D115, freigegeben 2026-10-13)
   ─────────────────────────────────────────────────────────────────────────
   Der Chefscout ist eine Person im Trainerteam (Rolle „scout“, 1–5 Sterne, Gehalt
   wie alle Trainer, dfl_trainer.js). Die Scouting-Anlage bestimmt, wie viele
   Spieler je Woche angesehen werden (dfl_scouting_patch.js), seine Sterne, wie
   gut das Urteil ist:
     · Note A+ … F je Spieler mit Bericht: bei 1 Stern etwa jedes dritte Urteil eine
       Stufe daneben, bei 5 fast immer richtig (CFG.fehler)
     · Steals: Draft-Talent, das die Medien deutlich später sehen, als es gut ist, bzw.
       guter Spieler, den sein Verein günstig abgibt (D99) – gefunden zu 8 / 50 / 95 %
     · Draft-Nieten (Medien sehen ihn weit vorn, echt viel schwächer) durchschaut zu
       ≈ 10 / 35 / 60 % – sonst übernimmt er das Urteil der Medien
     · Trade-Urteil in fünf Stufen (Top-Deal, Guter Deal, Okay, Schlecht, Finger weg)
       mit Symbol und einem Satz, ohne Wertzahl; bis ±1 Stufe daneben nach Sternen
   Jedes Urteil ist je Spieler (bzw. Tausch) und Chefscout fest gewürfelt (Hash) –
   die Note springt nicht bei jedem Zeichnen. Die KI hat ebenfalls einen Chefscout:
   ihr Draft-Urteil liegt um (Sterne − 3) Scouting-Stufen besser bzw. schlechter
   (DFLSaison.npcWahl).
   API: DFLChefscout.person() · .sterne() · .note(p) · .satz(p) · .urteil(L, deal) · .kopfHtml(fokus) · .notenHtml(n) · .NOTEN · .CFG
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const Tr = window.DFLTrainer, D = window.DFLSpiel, G = window.DFLGenerator, H = window.DFLHandel;
  if (!Tr || !D || !G || !H) { console.warn('[DFL-Chefscout] Module fehlen – Patch inaktiv'); return; }

  const CFG = {
    // Index = Sterne (0 = Stelle frei)
    fehler: [0.45, 0.33, 0.24, 0.15, 0.08, 0.03],         // Note eine Stufe daneben
    steal: [0.03, 0.08, 0.28, 0.5, 0.74, 0.95],          // Steal erkannt
    niete: [0.05, 0.10, 0.22, 0.35, 0.48, 0.60],          // Draft-Niete durchschaut
    urteilFehler: [0.5, 0.40, 0.30, 0.20, 0.12, 0.05],   // Trade-Urteil eine Stufe daneben
    ohneBericht: 1.4,                                    // Tausch mit fremden Spielern ohne Bericht: Fehler × 1,4
    draft: { stealAb: 30, nieteAb: 40, vorn: 64 },        // Plätze Abstand Medien ↔ echt; Niete nur unter den ersten 64 der Medien
    liga: { steal: 2 },                                  // Liga-Steal: wird abgegeben/will weg und Note mindestens A− (Index ≤ 2)
    urteil: [1.25, 1.07, 0.93, 0.78]                     // Wert rein ÷ raus: Top-Deal ≥ 1,25 · Gut ≥ 1,07 · Okay ≥ 0,93 · Schlecht ≥ 0,78 · sonst Finger weg
  };
  const NOTEN = ['A+', 'A', 'A−', 'B+', 'B', 'B−', 'C+', 'C', 'C−', 'D', 'F'];
  const URTEILE = [
    { key: 'top', name: 'Top-Deal', icon: 'ti-flame' }, { key: 'gut', name: 'Guter Deal', icon: 'ti-thumb-up' },
    { key: 'okay', name: 'Okay', icon: 'ti-scale' }, { key: 'schlecht', name: 'Schlecht', icon: 'ti-thumb-down' },
    { key: 'weg', name: 'Finger weg', icon: 'ti-hand-stop' }
  ];
  const klemme = (x, a, b) => Math.max(a, Math.min(b, x));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const zufall = key => G.hashText(String(key)) / 4294967296;
  const voll = p => (p.firstName ? p.firstName + ' ' : '') + p.name;

  const dfl = () => typeof CLUB !== 'undefined' && CLUB && CLUB.dfl && CLUB.dfl.aktiv && typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.dfl;
  const welt = () => (window.DFLTrainerteam && DFLTrainerteam.welt ? DFLTrainerteam.welt() : (dfl() ? D.liga() : null));
  const eigenTeam = () => { const L = welt(); return L ? L.teams.find(t => t.id === D.eigeneDflId()) : null; };
  const person = () => { const t = eigenTeam(); return (t && t.trainer && t.trainer.scout) || null; };
  const sterne = () => { const p = person(); return p ? p.sterne : 0; };
  const pid = () => { const p = person(); return p ? p.id : 'keiner'; };

  // ── Draft: echte Rangliste des Jahrgangs (Stärke und Potenzial) ─────────────
  let rangCache = { k: '', m: new Map() };
  function echterRang(L, w) {
    const j = [L.draft, L.draftNaechste].find(x => x && x.talente && x.talente.indexOf(w) >= 0);
    if (!j) return null;
    const k = j.jahr + ':' + j.talente.length;
    if (rangCache.k !== k || !rangCache.m.has(w.id)) {
      const wert = p => 0.4 * p.ovr + 0.6 * Math.max(p.ovr, p.truePotential || p.ovr);
      j.talente.slice().sort((a, b) => wert(b) - wert(a)).forEach((p, i) => rangCache.m.set(p.id, i + 1));
      rangCache.k = k;
    }
    return { rang: rangCache.m.get(w.id), n: j.talente.length, medien: (w.medien && w.medien.rang) || j.talente.indexOf(w) + 1 };
  }
  // Note aus einem Rang im Jahrgang (Anteile wie eine Notenskala: oben wenige)
  const RANG_GRENZEN = [0.02, 0.05, 0.10, 0.16, 0.24, 0.33, 0.44, 0.56, 0.68, 0.82];
  const noteAusRang = (rang, n) => { const q = (rang - 0.5) / Math.max(1, n); const i = RANG_GRENZEN.findIndex(g => q < g); return i < 0 ? NOTEN.length - 1 : i; };
  // Liga/Free Agents: was er gegenüber deiner Elf bringt (jetzt + Potenzial der Jungen − Alter)
  const LIGA_GRENZEN = [6, 4, 2.5, 1, -0.5, -2, -3.5, -5, -6.5, -9];
  function ligaIndex(w) {
    const elf = (D.eigeneStaerke && D.eigeneStaerke().ovr) || 78;
    const pot = Math.max(w.ovr, w.truePotential || w.ovr);
    const jung = w.age <= 21 ? 0.5 : w.age <= 23 ? 0.35 : w.age <= 25 ? 0.2 : 0;
    const d = w.ovr + (pot - w.ovr) * jung - Math.max(0, w.age - 30) * 1.2 - elf;
    const i = LIGA_GRENZEN.findIndex(g => d >= g);
    return i < 0 ? NOTEN.length - 1 : i;
  }
  // Urteil des Chefscouts über einen Spieler (Welt-Spieler oder Spielspieler): { note, i, steal, niete, art, quelle, zuHaben }
  let zhCache = { k: '', m: new Map() };
  function zuHaben(w) {
    const L = welt(); if (!L || !H.zuHabenListe) return null;
    const k = (L.handel || []).length + ':' + LEAGUE.season + '/' + LEAGUE.week;
    if (zhCache.k !== k) {
      zhCache = { k, m: new Map() };
      try { H.zuHabenListe(L, { ohne: [D.eigeneDflId()] }).forEach(z => zhCache.m.set(String(z.p.id), z)); } catch (e) { /* ohne D99 */ }
    }
    return zhCache.m.get(String(w.id)) || null;
  }
  const notenCache = new Map();
  function note(p) {
    const SC = window.DFLScouting;
    const s = SC && SC.sicht ? SC.sicht(p) : null;
    const w = (s && s.w) || p;
    if (!w || (s && s.eigen) || (s && !s.bericht)) return null;          // eine Note gibt es erst mit Bericht
    const st = sterne(), ckey = pid() + '|' + st + '|' + w.id + '|' + w.ovr + '|' + LEAGUE.season;
    if (notenCache.has(ckey)) return notenCache.get(ckey);
    const L = welt();
    const z = k => zufall(ckey + '|' + k);
    let i, steal = false, niete = false, art = 'normal';
    const quelle = s ? s.quelle : 'liga';
    if (quelle === 'draft') {
      const r = echterRang(L, w);
      if (r) {
        const echt = noteAusRang(r.rang, r.n), medien = noteAusRang(r.medien, r.n);
        if (r.medien - r.rang >= CFG.draft.stealAb) {                     // Medien sehen ihn spät
          if (z('steal') < CFG.steal[st]) { i = echt; steal = true; art = 'steal'; } else i = medien;
        } else if (r.rang - r.medien >= CFG.draft.nieteAb && r.medien <= CFG.draft.vorn) {   // Medien sehen ihn weit vorn
          if (z('niete') < CFG.niete[st]) { i = echt; niete = true; art = 'niete'; } else i = medien;
        } else i = echt;
      } else i = ligaIndex(w);
    } else {
      i = ligaIndex(w);
      const zh = quelle === 'liga' ? zuHaben(w) : null;
      if (zh && i <= CFG.liga.steal) { if (z('steal') < CFG.steal[st]) { steal = true; art = 'steal'; } }
      else if (zh) art = zh.art === 'weg' ? 'weg' : 'ab';
      if (w.age >= 31 && art === 'normal') art = 'alt';
      else if (w.age <= 22 && art === 'normal' && (w.truePotential || 0) - w.ovr >= 6) art = 'jung';
    }
    // eine Stufe daneben (fest je Spieler und Chefscout)
    if (art !== 'steal' && art !== 'niete' && z('fehler') < CFG.fehler[st]) {
      const r = z('richtung') < 0.5 ? -1 : 1;
      i = i + r >= 0 && i + r < NOTEN.length ? i + r : i - r;            // am Rand der Skala in die andere Richtung
    }
    const erg = { note: NOTEN[i], i, steal, niete, art, quelle };
    if (notenCache.size > 3000) notenCache.clear();
    notenCache.set(ckey, erg);
    return erg;
  }
  const istSteal = p => { const n = note(p); return !!(n && n.steal); };

  // ── Ein Satz des Chefscouts ──────────────────────────────────────────────
  const SAETZE = {
    steal_draft: ['Die Medien sehen ihn spät. Ich nicht.', 'Den hat kaum einer auf dem Zettel. Ich schon.', 'Spät zu haben und besser als sein Platz.'],
    steal_liga: ['Sein Verein gibt ihn zu billig her. Zugreifen.', 'Für den Preis bekommst du selten so einen.'],
    niete: ['Viel Lärm in den Medien. Ich sehe da nicht viel mehr kommen.', 'Die Zahlen beim Probetraining täuschen. Finger weg so früh.'],
    weg: ['Er will weg, das drückt den Preis.', 'Unzufrieden bei seinem Verein. Gute Gelegenheit.'],
    ab: ['Sein Verein will ihn loswerden.', 'Er wird abgegeben – verhandeln lohnt sich.'],
    alt: ['Noch zwei gute Jahre, dann wird er langsam.', 'Erfahrung ja, Zukunft eher nicht.'],
    jung: ['Noch roh, aber da steckt viel drin.', 'In zwei Jahren redet jeder über ihn.'],
    A: ['Würde uns sofort besser machen.', 'Einer für die Startelf.', 'Klare Verstärkung.'],
    B: ['Solide. Passt in den Kader.', 'Guter Mann für die Breite.', 'Kann bei uns spielen.'],
    C: ['Eher Ergänzung als Verstärkung.', 'Für die Bank reicht es.'],
    D: ['Bringt uns nicht weiter.', 'Da gibt es Bessere.'],
    draft_A: ['Einer der Besten in diesem Jahrgang.', 'Wird ein Stammspieler. Früh nehmen.'],
    draft_B: ['Guter Jahrgang für ihn. Ab Runde zwei interessant.', 'Solides Talent, kein Selbstläufer.'],
    draft_C: ['Ein Projekt für den Development Squad.', 'Eher was für die späten Runden.'],
    draft_D: ['Den würde ich nicht ziehen.', 'Da gibt es in jeder Runde Bessere.']
  };
  function satz(p) {
    const n = note(p); if (!n) return '';
    const s = window.DFLScouting && DFLScouting.sicht ? DFLScouting.sicht(p) : null, w = (s && s.w) || p;
    let k = n.art === 'steal' ? (n.quelle === 'draft' ? 'steal_draft' : 'steal_liga') : n.art !== 'normal' ? n.art : null;
    if (!k || !SAETZE[k]) k = (n.quelle === 'draft' ? 'draft_' : '') + (n.i <= 2 ? 'A' : n.i <= 5 ? 'B' : n.i <= 8 ? 'C' : 'D');
    const liste = SAETZE[k];
    let t = liste[Math.floor(zufall(pid() + '|satz|' + w.id) * liste.length)];
    if (n.art === 'steal' && n.quelle === 'draft') {
      const pick = eigenerPick();
      if (pick) t += ` Wenn er bei ${pick} noch da ist, nimm ihn.`;
    }
    return t;
  }
  // Dein nächster Pick im kommenden Draft (laufender Draft: dein nächster Slot; sonst dein bester Pick aus L.picks)
  function eigenerPick() {
    const L = welt(); if (!L || !L.draft || !L.draft.talente || !L.draft.talente.length) return null;
    const j = L.draft, eig = D.eigeneDflId(), rf = j.reihenfolge || [];
    const dd = typeof LEAGUE !== 'undefined' && LEAGUE.dflDraft;
    if (dd && dd.jahr === j.jahr && !dd.fertig && dd.slots) { const i = dd.slots.findIndex((x, k) => k >= dd.nr && x.besitzer === 'fcm'); return i >= 0 ? i + 1 : null; }
    const meine = (L.picks || []).filter(x => x.jahr === j.jahr && x.besitzer === eig && rf.indexOf(x.von) >= 0).map(x => (x.runde - 1) * rf.length + rf.indexOf(x.von) + 1);
    if (meine.length) return Math.min(...meine);
    return rf.indexOf(eig) >= 0 ? rf.indexOf(eig) + 1 : null;
  }

  // ── Trade-Urteil (ohne Wertzahl) ─────────────────────────────────────────
  // Stufe aus „Wert rein ÷ Wert raus“; der Chefscout liegt je nach Sternen manchmal eine Stufe daneben (key: fest je Tausch)
  function stufeAusQuote(q, key, ohne) {
    let i = CFG.urteil.findIndex(g => q >= g);
    if (i < 0) i = URTEILE.length - 1;
    const st = sterne(), f = Math.min(0.8, CFG.urteilFehler[st] * (ohne ? CFG.ohneBericht : 1));
    if (zufall(key + '|f') < f) { const r = zufall(key + '|r') < 0.5 ? -1 : 1; i = i + r >= 0 && i + r < URTEILE.length ? i + r : i - r; }
    return i;
  }
  // Urteil nur aus der Quote (Draft-Tausch: Picks gegen Picks, keine Spieler) – Symbol + Wort, ohne Satz
  function urteilQuote(q, key) {
    if (!(q > 0)) return null;
    const i = stufeAusQuote(q, pid() + '|' + sterne() + '|' + String(key || ''), false);
    return Object.assign({ i, satz: '', sterne: sterne() }, URTEILE[i]);
  }
  // kleines Schild (Symbol + Wort) wie in der Trade-Zentrale
  const urteilChip = u => u ? `<span class="cs-chip ${u.key}"${u.satz ? ` title="${esc(u.satz)}"` : ''}><i class="ti ${u.icon}" aria-hidden="true"></i>${esc(u.name)}</span>` : '';
  // Wert aus deiner Sicht: was du bekommst ÷ was du gibst (echte Werte, auch das echte Potenzial); Stufe ±1 nach Sternen
  function urteil(L, deal) {
    if (!L || !deal) return null;
    const A = L.teams.find(t => t.id === deal.von), B = L.teams.find(t => t.id === deal.an);
    if (!A || !B) return null;
    const rang = H.raenge(L), lg = H.lage(L, A, rang);
    const echt = p => Object.assign({}, p, { niete: null });
    const sp = (T, ids) => (ids || []).map(id => T.roster.find(p => p.id === id)).filter(Boolean);
    const pk = ids => (ids || []).map(id => (L.picks || []).find(x => x.id === id)).filter(Boolean);
    const wert = (spieler, picks) => H.paketWert(spieler.map(p => H.spielerWert(echt(p), lg)).concat(picks.map(x => H.pickWert(L, x, lg, rang).wert)));
    const rein = sp(B, deal.bekommt && deal.bekommt.spieler), raus = sp(A, deal.gibt && deal.gibt.spieler);
    const wRein = wert(rein, pk(deal.bekommt && deal.bekommt.picks)), wRaus = wert(raus, pk(deal.gibt && deal.gibt.picks));
    if (wRein <= 0 && wRaus <= 0) return null;
    const q = wRaus > 0 ? wRein / wRaus : 9;
    const st = sterne(), SC = window.DFLScouting;
    const ohne = rein.some(p => SC && SC.hatBericht && !SC.hatBericht(p));
    const key = pid() + '|' + st + '|' + [].concat(deal.gibt.spieler || [], deal.gibt.picks || [], ['/'], deal.bekommt.spieler || [], deal.bekommt.picks || []).join(',');
    const i = stufeAusQuote(q, key, ohne);
    const u = URTEILE[i];
    // Satz: der wichtigste Spieler, den du bekommst bzw. gibst
    const top = rein.slice().sort((a, b) => H.spielerWert(echt(b), lg) - H.spielerWert(echt(a), lg))[0];
    const gibTop = raus.slice().sort((a, b) => H.spielerWert(echt(b), lg) - H.spielerWert(echt(a), lg))[0];
    const nur = (deal.gibt.picks || []).length && !raus.length;
    const n = x => x ? x.name : '';
    const S = {
      top: [top ? `${n(top)} ist mehr wert, als wir abgeben. Zuschlagen.` : 'So ein Angebot kommt nicht oft. Zuschlagen.'],
      gut: [top ? `${n(top)} hilft uns.${nur ? ' Den Pick vermisst du nicht.' : ''}` : 'Das lohnt sich für uns.', 'Passt. Ich würde es machen.'],
      okay: ['Fairer Tausch, mehr nicht.', 'Kann man machen, muss man nicht.'],
      schlecht: [gibTop ? `Für ${n(gibTop)} sollten wir mehr bekommen.` : 'Wir geben mehr ab, als wir bekommen.', 'Wir zahlen drauf.'],
      weg: [gibTop ? `${n(gibTop)} dafür? Auf keinen Fall.` : 'Das würde ich nicht machen.']
    }[u.key];
    return Object.assign({ i, satz: S[Math.floor(zufall(key + '|s') * S.length)], sterne: st }, u);
  }

  // ── Anzeige ───────────────────────────────────────────────────────────────
  const notenKlasse = i => i <= 2 ? 'gut' : i <= 5 ? 'mittel' : i <= 8 ? 'leise' : 'schlecht';
  const notenHtml = n => n ? `<span class="cs-note ${notenKlasse(n.i)}" aria-label="Note ${esc(n.note)}">${esc(n.note)}</span>` : '<span class="cs-note offen" aria-label="noch keine Note">?</span>';
  const sterneHtml = n => (window.DFLTrainerteam && DFLTrainerteam.sterneHtml ? DFLTrainerteam.sterneHtml(n) : '');
  function urteilHtml(u, opt) {
    opt = opt || {};
    if (!u) return '';
    const p = person();
    const skala = opt.skala === false ? '' : `<div class="cs-skala" aria-hidden="true">${URTEILE.map((x, i) => `<span class="${i === u.i ? 'an ' + x.key : ''}">${x.name}</span>`).join('')}</div>`;
    return `<div class="cs-urteil ${u.key}" aria-live="polite"><div class="cs-urteil-kopf"><i class="ti ${u.icon}" aria-hidden="true"></i><b>${u.name}</b></div>
      <div class="cs-urteil-satz">${p ? `<span>${esc(p.name)}:</span> ` : ''}„${esc(u.satz)}“</div>${skala}</div>`;
  }
  // Kopfzeile im Scouting: Gesicht, Name, Sterne, „schaut zuerst: …“
  function kopfHtml(fokus) {
    const p = person();
    if (!p) return `<button type="button" class="cs-kopf leer" data-cs="chef"><span class="tt-bild tt-icon"><i class="ti ti-user-search" aria-hidden="true"></i></span>
      <span class="tt-name"><b>Chefscout</b><small>nicht besetzt</small></span><span class="tt-suchen">Suchen</span></button>`;
    let bild = '';
    try { bild = window.DFLIdentitaet ? DFLIdentitaet.gesichtSvg({ seed: p.seed, dflSeed: p.seed, firstName: p.firstName, name: p.name, id: p.id }, eigenTeam()) : ''; } catch (e) { bild = ''; }
    const pos = (fokus || []).map(x => x === 'OM' ? 'ZOM' : x).join(', ');
    return `<button type="button" class="cs-kopf" data-cs="chef"><span class="tt-bild">${bild}</span>
      <span class="tt-name"><b>${esc(voll(p))}</b><small>Chefscout${pos ? ' · schaut zuerst: ' + esc(pos) : ''}</small></span>${sterneHtml(p.sterne)}</button>`;
  }

  // Klick auf die Kopfzeile: Kandidaten-Blatt „Chefscout“ (Trainerteam)
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('click', ev => {
      const t = ev.target && ev.target.closest && ev.target.closest('[data-cs="chef"]');
      if (!t || !dfl()) return;
      ev.preventDefault(); ev.stopPropagation();
      if (window.DFLTrainerteam) DFLTrainerteam.kandidatenBlatt('scout');
    });
  }

  window.DFLChefscout = { CFG, NOTEN, URTEILE, person, sterne, note, satz, istSteal, urteil, urteilQuote, urteilChip, urteilHtml, notenHtml, kopfHtml, eigenerPick, echterRang };
  console.log('[DFL-Chefscout v1] aktiv — Note A+ bis F und ein Satz je Spieler, Steals, Draft-Nieten, Trade-Urteil in fünf Stufen ohne Wertzahl (D120, D115)');
})();
