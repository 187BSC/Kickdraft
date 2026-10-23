/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · DRAFT-PACK  ·  v1   (2026-10-17, Nutzer: „Animation wie bei FIFA, wenn man ein Pack öffnet … im Draft zieht man
   das Pack mit der Aufschrift Draft (Jahreszahl), dann die Pickreihenfolge vom letzten zum ersten mit den einzelnen Kommentaren“)
   ─────────────────────────────────────────────────────────────────────────
   Nach dem Draft: Pack in Vereinsfarben („DRAFT 2026“) unter Flutlicht, Tippen reißt es auf. Die eigenen Picks kommen vom
   letzten zum ersten: Rückseite leuchtet in der Farbe der Runde, dann wie beim Walkout Pick → Position →
   College, die Karte dreht sich, die Stärke zählt hoch, der Chefscout sagt einen Satz (Note, Medien-Rang, Steal/Reach).
   Der erste Pick (zuletzt) bekommt mehr Spannung, Gold mit Konfetti. Am Ende alle Karten mit der Draft-Note der Analysten.
   Karten über KSPrunk (kickstil_prunkkarte.js): draft1 Erstrunden-Pick, draft2 Zweitrunden-Pick, rookie ab Runde 3 – die Karte
   bleibt die ganze Rookie-Saison im Spieler-Blatt (rookieKarte, Nutzer 2026-10-18). Tippen = weiter, „Überspringen“ = Übersicht.
   In automatischen Tests (navigator.webdriver) aus, außer localStorage dfl-pack = an.
   API: KSDraftPack.zeigen(daten) · .ausDraft(d) · .pickInfo(L, t) · .rookieKarte(p, ovr, ax, gesicht, opt) · .kommentar(e) · .CFG
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const CFG = {
    steal: 15, reach: 15,                       // Pick gegen Medien-Rang
    takt: { normal: 1, bester: 1.9 },           // Spannung je Karte (Faktor auf alle Schritte)
    roh: 20,                                     // Potenzial über Stärke für „noch roh“ (nicht bei Note A)
    notenSchritt: 10                             // Plätze zwischen Pick und Medien-Rang je Notenstufe
  };
  // Karte je Runde (kickstil_prunkkarte.js): Erstrunden-Pick, Zweitrunden-Pick, Rookie ab Runde 3
  const GLANZ = { draft1: '#ffd257', draft2: '#9cc2ff', rookie: '#9be3a8' };
  const FUNKEN = { draft1: ['#fff3c0', '#ffd257', '#e0a92e'], draft2: ['#ffffff', '#cfe0ff', '#7fa8f0'], rookie: ['#ffffff', '#c8f2d0', '#5fbf78'] };
  const NOTE_FARBE = { A: '#2f9e5a', B: '#c9a227', C: '#e07b2a', D: '#d04a3a', F: '#a3322a' };
  const SCHRIFT = "'Big Shoulders Display', var(--font-zahl, var(--font-display, system-ui))";
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const warte = ms => new Promise(r => setTimeout(r, ms));
  const edVon = runde => runde === 1 ? 'draft1' : runde === 2 ? 'draft2' : 'rookie';
  const titelVon = (runde, jahr) => (runde === 1 ? 'Erstrunden-Pick' : runde === 2 ? 'Zweitrunden-Pick' : `Rookie · Runde ${runde}`) + (jahr ? ` · ${jahr}` : '');
  const posAnz = p => ({ OM: 'ZOM' })[p] || p;
  const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const waehle = (liste, key) => liste[hash(key) % liste.length];
  const POS_NAME = { TW: 'Torwart', IV: 'Innenverteidiger', LV: 'Linksverteidiger', RV: 'Rechtsverteidiger', ZDM: 'Defensives Mittelfeld',
    ZM: 'Zentrales Mittelfeld', ZOM: 'Offensives Mittelfeld', LM: 'Linkes Mittelfeld', RM: 'Rechtes Mittelfeld', LF: 'Linker Flügel',
    RF: 'Rechter Flügel', ST: 'Sturm', MS: 'Sturm' };
  const posName = p => POS_NAME[String(p || '').replace(/^[LR](?=IV|ZM|ZDM|ST)/, '')] || p;

  // Schnitt mehrerer Noten (A+ … F, Skala NOTEN unten) als Note
  function notenSchnitt(liste) {
    const i = liste.map(n => { const k = NOTEN.indexOf(n); return k < 0 ? 4 : k; });
    return NOTEN[Math.round(i.reduce((a, b) => a + b, 0) / i.length)];
  }

  // ── Kommentar des Chefscouts zu einem Pick (Nutzer 2026-10-18: „dachte die wären cooler“) ─────────────
  // Zwei Sätze: ein Aufhänger (Lage des Picks) und eine Pointe (was den Spieler ausmacht: Kombine, Stärke, Charakter, Alter).
  const AUF = {
    erster: ['Unser Mann aus Runde eins. Über den redet morgen die ganze Liga.', '{name} in Runde eins. Ich hab die Nacht vorher kein Auge zugemacht.',
      'Der Erste ist immer der, an dem du gemessen wirst. Mit {name} kann ich gut schlafen.'],
    steal: ['Medien-Rang #{m}, gezogen an #{p}. Ich hab dreimal auf die Liste geguckt.', '#{p} für einen #{m}er. Irgendwo flucht gerade ein Scout.',
      'Bei #{m} hatten ihn die Experten. Bei #{p} hatten wir ihn.'],
    reach: ['Die Medien hatten ihn erst bei #{m}. Die Medien müssen ihn ja auch nicht trainieren.', 'Ja, #{p} ist früh für einen #{m}er. Wir wollten nicht zittern.',
      'Kann sein, dass wir hoch gegriffen haben. Kann sein, dass alle anderen tief geschlafen haben.'],
    merk: ['Stand ganz oben auf deiner Merkliste. Wunsch erfüllt.', 'Dein Zettel, dein Mann. Ich hätte ihn auch genommen.'],
    trade: ['Für diesen Pick haben wir mit {via} getauscht. Hat sich gelohnt.', 'Den Pick haben wir {via} abgeluchst. Und dann gleich das hier.'],
    luecke: ['Auf {pos} hatten wir ein Loch, durch das ein Bus gepasst hätte. Jetzt steht da einer.', 'Die {pos}-Frage ist erledigt. Nächste.'],
    A: ['Einer für die Startelf, schon in Jahr eins.', 'Den wollten wir. Den haben wir.', 'Wenn das kein guter Pick war, weiß ich auch nicht.'],
    B: ['Solider Pick, kein Lotto.', 'Ehrlicher Arbeiter, genau unser Typ.', 'Kein Feuerwerk, aber ein Fundament.', 'Genau da genommen, wo er hingehört. Langweilig? Nein, sicher.'],
    C: ['Ein Projekt. Aber Projekte machen Spaß.', 'Keiner für die erste Elf. Noch nicht.'],
    D: ['Später Pick, kleiner Preis.', 'In Runde {r} suchst du keine Stars. Du suchst Überraschungen.']
  };
  const POINTE = {
    sprint: ['{s} Sekunden auf 30 Meter. Die Stoppuhr wurde zweimal geprüft.', '{s} Sekunden auf 30 Meter. Den holst du nur mit dem Fahrrad ein.'],
    sprung: ['{j} Zentimeter aus dem Stand. Bei Ecken gehört der Ball ihm.', 'Springt {j} Zentimeter hoch. Kopfballduelle sind für ihn Freizeit.'],
    yoyo: ['Yo-Yo-Test {y}. Der läuft noch, wenn die anderen schon duschen.', 'Yo-Yo-Test {y}. Die Lunge hat er von einem Pferd.'],
    schwaenzer: ['Hat die Kombine geschwänzt. Selbstbewusst oder frech, das finden wir raus.'],
    kapitaen: ['Kapitän am {college}. Wenn er redet, wird es in der Kabine still.', 'War Kapitän am {college}. Der zieht andere mit.'],
    hitzkopf: ['Kleiner Hitzkopf. Die Gelben Karten zahlt er aus eigener Tasche.', 'Hat Feuer. Manchmal ein bisschen zu viel.'],
    jung: ['{a} Jahre alt. Der hat sein Abi-Zeugnis noch im Rucksack.', 'Mit {a} schon hier. Was soll das erst mit 23 werden?'],
    TEM: ['Wenn der antritt, siehst du nur noch die Rückennummer.', 'Tempo {v}. Außenverteidiger werden ihn hassen.'],
    SCH: ['Schießt, als hätte der Ball ihn beleidigt.', 'Schuss {v}. Torhüter dieser Liga, viel Glück.'],
    PAS: ['Spielt Pässe, die andere erst in der Wiederholung sehen.', 'Passspiel {v}. Der findet Lücken, die es eigentlich nicht gibt.'],
    DRI: ['Dribbelt durch drei Leute und entschuldigt sich beim vierten.', 'Ball am Fuß wie festgeklebt.'],
    DEF: ['Gegen ihn ist jeder Zweikampf ein schlechter Tag.', 'Defensive {v}. Stürmer sollten sich warm anziehen.'],
    PHY: ['Läuft gegen Wände, und die Wände geben nach.', 'Körper wie ein Kleiderschrank, Puste wie ein Marathonläufer.'],
    REF: ['Reflexe wie eine Katze nach dem dritten Espresso.', 'Reflexe {v}. Elfmeter gegen ihn sind Glücksspiel.'],
    PAR: ['Hält Dinger, die eigentlich drin sind.'],
    pot: ['Potenzial bis {hi}. Wenn das Training stimmt, wird das ein Großer.', 'Die Decke liegt bei {hi}. Wir bauen die Leiter.'],
    sonst: ['Jetzt zeig, was du kannst, Junge.', 'Willkommen in der Liga.', 'Der Rest passiert auf dem Platz.']
  };
  const NOTEN = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F'];
  const GRENZEN = [0.02, 0.05, 0.10, 0.16, 0.24, 0.33, 0.44, 0.56, 0.68, 0.82];
  const noteAusRang = (rang, n) => { const q = (rang - 0.5) / Math.max(1, n); const i = GRENZEN.findIndex(g => q < g); return NOTEN[i < 0 ? NOTEN.length - 1 : i]; };
  const komma = x => String(x).replace('.', ',');
  function kommentar(e) {
    const q = e.q || {}, f = e.fakten || {}, diff = e.medien ? e.pick - e.medien : 0, key = (q.id || '') + '|' + e.pick, pot = e.pot || {};
    // Chip: was den Pick auszeichnet
    const art = diff >= CFG.steal ? 'steal' : diff <= -CFG.reach ? 'reach' : e.luecke ? 'luecke' : null;
    // Aufhänger
    const auf = e.erster && e.runde === 1 ? 'erster' : art === 'steal' ? 'steal' : art === 'reach' ? 'reach' : f.merk === 0 ? 'merk'
      : f.via ? 'trade' : art === 'luecke' ? 'luecke' : (e.note || 'B')[0].replace('F', 'D');
    // Pointe: das Auffälligste am Spieler
    const ax = window.DFLAppShell && DFLAppShell.achsen ? DFLAppShell.achsen(q) : [], k = f.kombine || {};
    const top = ax.slice().sort((a, b) => b[1] - a[1])[0];
    const kandidaten = [];
    if (k.nimmtTeil && k.sprint30 && k.sprint30 <= 4.12) kandidaten.push(['sprint', 9]);
    if (k.nimmtTeil && k.sprung >= 68) kandidaten.push(['sprung', 7]);
    if (k.nimmtTeil && k.yoyo >= 21) kandidaten.push(['yoyo', 6]);
    if (k.nimmtTeil === false && e.runde <= 2) kandidaten.push(['schwaenzer', 5]);
    if (f.kapitaen) kandidaten.push(['kapitaen', 8]);
    if (f.hitzkopf) kandidaten.push(['hitzkopf', 6]);
    if (q.age && q.age <= 18) kandidaten.push(['jung', 7]);
    if (top && top[1] >= 75 && POINTE[top[0]]) kandidaten.push([top[0], 4 + (top[1] - 75) / 3]);
    if ((pot.hi || 0) >= 86 && (pot.hi || 0) - (q.ovr || 0) >= CFG.roh) kandidaten.push(['pot', 5]);
    kandidaten.push(['sonst', 0.5]);
    // die stärksten zwei, davon eine fest je Spieler
    const wahl = kandidaten.sort((a, b) => b[1] - a[1]).slice(0, 2), pointe = wahl[hash(key + 'p') % wahl.length][0];
    const fuell = t => t.replace(/\{m\}/g, e.medien).replace(/\{p\}/g, e.pick).replace(/\{r\}/g, e.runde).replace(/\{pos\}/g, posAnz(q.pos || ''))
      .replace(/\{name\}/g, q.name || '').replace(/\{via\}/g, f.via || '').replace(/\{college\}/g, e.college || 'College').replace(/\{a\}/g, q.age)
      .replace(/\{hi\}/g, pot.hi).replace(/\{s\}/g, komma(k.sprint30)).replace(/\{j\}/g, k.sprung).replace(/\{y\}/g, komma(k.yoyo))
      .replace(/\{v\}/g, top ? top[1] : '');
    const text = fuell(waehle(AUF[auf], key + 'a')) + ' ' + fuell(waehle(POINTE[pointe], key + 'b'));
    return { art, text };
  }

  // ── Daten aus dem fertigen Draft (LEAGUE.dflDraft) ──────────────────────
  function ausDraft(d) {
    if (!d || !d.picks) return null;
    const D = window.DFLSpiel, SC = window.DFLScouting, CS = window.DFLChefscout, A = window.DFLAnalysten;
    const meine = d.picks.filter(p => p.team === 'fcm');
    const luecken = window.DFLDraftboard && DFLDraftboard.luecken ? DFLDraftboard.luecken() : {};
    const picks = meine.map(p => {
      const q = (typeof SQUAD !== 'undefined' ? SQUAD : []).find(x => x.rookieVertrag && x.rookieVertrag.pick === p.pick && x.rookieVertrag.jahr === d.jahr);
      if (!q) return null;
      let pot = null; try { pot = SC && SC.potSpanne ? SC.potSpanne(q) : null; } catch (e) { /* ohne Spanne */ }
      const grp = window.DFLDraftboard && DFLDraftboard.gruppeVon ? DFLDraftboard.gruppeVon(q.pos) : null;
      const e = { q, pick: p.pick, runde: p.runde, medien: p.medien, note: p.note || null, pot, college: q.college, luecke: p.luecke != null ? !!p.luecke : !!(grp && luecken[grp]),
        fakten: p.fakten || null, erster: p.pick === Math.min(...meine.map(x => x.pick)) };
      e.kommentar = kommentar(e);
      return e;
    }).filter(Boolean);
    let gesamt = null;
    try { const n = A && A.noten ? A.noten() : null, ich = n && n.liste.find(x => x.id === D.eigeneDflId()); if (ich) gesamt = { note: ich.note, satz: ich.satz }; } catch (e) { /* ohne Note */ }
    // Testrückmeldung 2026-10-22: „generell die Bewertung und die Note für den Draft geben“ – ohne Analysten-Note
    // (z. B. Startdraft) der Schnitt der Einzelnoten
    if (!gesamt && picks.length) gesamt = { note: notenSchnitt(picks.map(e => e.note || 'B')), satz: '' };
    const scout = CS && CS.person ? CS.person() : null;
    return { jahr: d.jahr, picks, gesamt, scout: scout ? (scout.firstName ? scout.firstName[0] + '. ' : '') + scout.name : 'Dein Chefscout' };
  }

  // Beim eigenen Pick (dfl_kader_patch.js waehle, Talent noch im Jahrgang): Note = Pick gegen Medien-Rang (fairer Pick = B,
  // je 10 Plätze später eine Stufe besser) – so bekommt auch ein guter Pick in Runde 4 eine gute Note; Lücke = Stammplatz frei
  function pickInfo(L, t, pick) {
    const aus = {};
    try {
      const m = t.medien && t.medien.rang;
      if (m && pick) aus.note = NOTEN[Math.max(0, Math.min(9, 4 - Math.round((pick - m) / CFG.notenSchritt)))];
      const DB = window.DFLDraftboard, grp = DB && DB.gruppeVon ? DB.gruppeVon(t.pos) : null, lk = grp && DB.luecken ? DB.luecken()[grp] : null;
      aus.luecke = !!(lk && lk.art === 'Stammspieler');
      // Fakten für den Kommentar (öffentlich: Kombine, Medientext-Eigenschaften, Merkliste, Trade-Pick)
      const k = t.kombine;
      aus.fakten = { kombine: k ? { sprint30: k.sprint30, sprung: k.sprung, yoyo: k.yoyo, nimmtTeil: k.nimmtTeil } : null,
        kapitaen: !!(t.traits && t.traits.indexOf('fuehrungsspieler') >= 0), hitzkopf: !!(t.traits && t.traits.indexOf('hitzkopf') >= 0) };
      if (DB && DB.merkIds) { const m = DB.merkIds().indexOf(String(t.id)); if (m >= 0) aus.fakten.merk = m; }
      const dd = typeof LEAGUE !== 'undefined' && LEAGUE.dflDraft, slot = dd && dd.slots && dd.slots[pick - 1];
      if (slot && slot.besitzer === 'fcm' && slot.von && slot.von !== 'fcm' && window.DFLSpiel) { const F = DFLSpiel.franchise(slot.von); aus.fakten.via = (F && (F.kurz || F.name)) || ''; }
    } catch (e) { /* ohne Zusatz */ }
    return aus;
  }
  // Spieler-Blatt (dfl_app_shell futKarte): eigene Rookies tragen ihre Rookie-Karte die ganze erste Saison
  function rookieKarte(p, ovr, ax, gesicht, opt) {
    if ((opt && opt.stufe) || !p || !p.rookieVertrag || !p.rookieVertrag.runde || !window.KSPrunk) return null;
    const AS = window.DFLAppShell; if (!AS || !AS.istRookie || !AS.istRookie(p)) return null;
    const D = window.DFLSpiel, I = window.DFLIdentitaet, f = D && D.franchise ? D.franchise('fcm') : null, rv = p.rookieVertrag;
    let jahr = rv.jahr; if (jahr == null) try { jahr = D.liga().saisonJahr; } catch (e) { /* ohne Jahr */ }
    KSPrunk.stil();
    return `<div class="dw-blatt-karte">${KSPrunk.karte({ stufe: edVon(rv.runde), wert: ovr || p.ovr || 0, pos: posAnz(p.pos), positionen: (p.positions || []).map(posAnz),
      gesicht, name: p.name, werte: ax || [], wappen: I && I.wappenSvg && f ? I.wappenSvg(f, { klein: true }) : '', titel: titelVon(rv.runde, jahr),
      pick: rv.pick, seed: hash(p.id) % 9973 })}</div>`;
  }

  // ── Karte und Pack ──────────────────────────────────────────────────────
  function karteHtml(e, team, f, jahr) {
    const q = e.q, I = window.DFLIdentitaet, AS = window.DFLAppShell;
    const pot = e.pot ? (e.pot.lo === e.pot.hi ? e.pot.hi : e.pot.lo + '–' + e.pot.hi) : '';
    return KSPrunk.karte({ stufe: edVon(e.runde), wert: q.ovr, pot, pos: posAnz(q.pos), positionen: (q.positions || []).map(posAnz), name: q.name, titel: titelVon(e.runde, jahr),
      gesicht: I && I.gesichtSvg ? I.gesichtSvg(q, team) : '', werte: AS && AS.achsen ? AS.achsen(q) : [],
      wappen: I && I.wappenSvg && f ? I.wappenSvg(f, { klein: true }) : '', pick: e.pick, seed: hash(q.id) % 9973 });
  }
  function zacken(w, h, oben, unten, n) {
    const pts = [], s = w / n;
    for (let i = 0; i <= n; i++) pts.push(`${(i * s).toFixed(1)}px ${oben && i % 2 ? 7 : 0}px`);
    for (let i = n; i >= 0; i--) pts.push(`${(i * s).toFixed(1)}px ${unten && i % 2 ? h - 7 : h}px`);
    return `polygon(${pts.join(',')})`;
  }
  function packHtml(dat, f) {
    const I = window.DFLIdentitaet, c = (f && f.farben) || ['#1d3f8a', '#ffffff'];
    const wappen = I && I.wappenSvg && f ? I.wappenSvg(f, { groesse: 84 }) : '';
    return `<div class="ksdp-pack" style="--p1:${c[0]};--p2:${c[1] || '#fff'}">
      <div class="ksdp-koerper" style="clip-path:${zacken(240, 340, true, true, 24)}">
        <div class="ksdp-holo"></div>
        <div class="ksdp-inhalt">
          <div class="ksdp-liga">DKL · ROOKIE-PACK</div>
          <div class="ksdp-pwappen">${wappen}</div>
          <div class="ksdp-draft">DRAFT</div>
          <div class="ksdp-jahr">${esc(dat.jahr)}</div>
          <div class="ksdp-anzahl">${dat.picks.length} ${dat.picks.length === 1 ? 'ROOKIE' : 'ROOKIES'}</div>
        </div>
        <div class="ksdp-riss"></div>
      </div>
      <div class="ksdp-lasche" style="clip-path:${zacken(240, 46, true, false, 24)}"><div class="ksdp-holo"></div></div>
    </div>`;
  }
  const rueckHtml = dat => `<div class="ksdp-rueck"><svg viewBox="0 0 220 308" aria-hidden="true"><defs>
      <linearGradient id="ksdp-rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#26324f"/><stop offset=".55" stop-color="#121a2e"/><stop offset="1" stop-color="#070b16"/></linearGradient>
      <pattern id="ksdp-rm" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="14" fill="#fff" opacity=".04"/></pattern></defs>
      <path d="${PFAD}" fill="url(#ksdp-rg)"/><path d="${PFAD}" fill="url(#ksdp-rm)"/>
      <path d="${PFAD}" fill="none" stroke="var(--glanz)" stroke-width="3" opacity=".9"/>
      <text x="110" y="150" text-anchor="middle" font-family="Big Shoulders Display,system-ui" font-weight="800" font-size="44" fill="var(--glanz)" letter-spacing="2">DRAFT</text>
      <text x="110" y="182" text-anchor="middle" font-family="Big Shoulders Display,system-ui" font-weight="700" font-size="24" fill="#fff" opacity=".75" letter-spacing="6">${esc(dat.jahr)}</text></svg></div>`;
  const PFAD = 'M32 12L188 12C190 25 199 34 212 36L212 252C212 262 207 268 198 273L120 302C113 305 107 305 100 302L22 273C13 268 8 262 8 252L8 36C21 34 30 25 32 12Z';

  // ── Funken / Konfetti (Canvas) ──────────────────────────────────────────
  function funken(cv) {
    const ctx = cv.getContext('2d'); let teile = [], an = false;
    const groesse = () => { const r = cv.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1); cv.width = r.width * d; cv.height = r.height * d; ctx.setTransform(d, 0, 0, d, 0, 0); };
    groesse();
    function schritt() {
      const r = cv.getBoundingClientRect(); ctx.clearRect(0, 0, r.width, r.height);
      teile = teile.filter(t => t.l > 0);
      teile.forEach(t => {
        t.x += t.vx; t.y += t.vy; t.vy += t.g; t.vx *= 0.985; t.l -= 1; t.w += t.dw;
        ctx.save(); ctx.globalAlpha = Math.min(1, t.l / 30); ctx.translate(t.x, t.y); ctx.rotate(t.w); ctx.fillStyle = t.c;
        if (t.art === 'k') ctx.fillRect(-t.s / 2, -t.s / 4, t.s, t.s / 2); else { ctx.beginPath(); ctx.arc(0, 0, t.s / 2, 0, 7); ctx.fill(); }
        ctx.restore();
      });
      if (teile.length) requestAnimationFrame(schritt); else an = false;
    }
    return {
      los(x, y, n, farben, art) {
        for (let i = 0; i < n; i++) {
          const w = Math.random() * Math.PI * 2, v = art === 'k' ? 3 + Math.random() * 7 : 1.5 + Math.random() * 5;
          teile.push({ x, y, vx: Math.cos(w) * v, vy: Math.sin(w) * v - (art === 'k' ? 4 : 1), g: art === 'k' ? 0.16 : 0.04, l: 70 + Math.random() * 60,
            s: art === 'k' ? 6 + Math.random() * 6 : 2 + Math.random() * 3, c: farben[i % farben.length], w: Math.random() * 6, dw: (Math.random() - 0.5) * 0.3, art });
        }
        if (!an) { an = true; requestAnimationFrame(schritt); }
      },
      groesse
    };
  }

  // ── Ablauf ──────────────────────────────────────────────────────────────
  let EL = null;
  function zeigen(dat) {
    if (!dat || !dat.picks || !dat.picks.length || !window.KSPrunk) return Promise.resolve();
    let test = false; try { test = navigator.webdriver && localStorage.getItem('dfl-pack') !== 'an'; } catch (e) { /* ohne Speicher */ }
    if (test) return Promise.resolve();
    KSPrunk.stil(); stil();
    if (EL) EL.remove();
    const D = window.DFLSpiel, f = D && D.franchise ? D.franchise('fcm') : null, team = { id: D && D.eigeneDflId ? D.eigeneDflId() : 'fcm', farben: f && f.farben };
    const ruhig = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const reihe = dat.picks.slice().sort((a, b) => b.pick - a.pick);          // vom letzten zum ersten Pick
    EL = document.createElement('div'); EL.id = 'ksdp'; EL.setAttribute('role', 'dialog'); EL.setAttribute('aria-modal', 'true'); EL.setAttribute('aria-label', `Draft ${dat.jahr}`);
    EL.innerHTML = `<div class="ksdp-flut l"></div><div class="ksdp-flut r"></div><div class="ksdp-strahlen"></div><canvas class="ksdp-cv"></canvas>
      <button type="button" class="ksdp-skip">Überspringen</button>
      <div class="ksdp-kopf"><b>Dein Draft ${esc(dat.jahr)}</b></div>
      <div class="ksdp-buehne">${packHtml(dat, f)}
        <div class="ksdp-info"></div>
        <div class="ksdp-karte"><div class="ksdp-dreh">${rueckHtml(dat)}<div class="ksdp-vorn"></div></div></div>
        <div class="ksdp-kommentar"></div>
      </div>
      <div class="ksdp-ablage"></div>
      <div class="ksdp-hinweis"></div>
      <div class="ksdp-ende"></div>`;
    document.body.appendChild(EL);
    const $ = s => EL.querySelector(s), fk = funken($('.ksdp-cv'));
    let tippen = null, skip = false;
    const tipp = () => new Promise(r => { tippen = r; });
    EL.addEventListener('click', ev => { if (ev.target.closest('.ksdp-skip')) { skip = true; } if (ev.target.closest('.ksdp-weiter')) return; if (tippen) { const r = tippen; tippen = null; r(); } });
    const pause = ms => skip ? Promise.resolve() : warte(ruhig ? ms * 0.3 : ms);
    // Rückmeldung 18.10. (keine unnötigen Texte): statt „Tippen für …“ nur ein pulsierender Finger
    const hinweis = t => { const h = $('.ksdp-hinweis'); h.innerHTML = t ? '<i class="ti ti-hand-finger" aria-hidden="true"></i>' : ''; h.setAttribute('aria-label', t || ''); h.classList.toggle('an', !!t); };
    const mitte = () => { const r = $('.ksdp-karte').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };

    return (async () => {
      requestAnimationFrame(() => EL.classList.add('auf'));
      await warte(900); hinweis('Tippen zum Öffnen');
      if (!skip) await tipp();
      hinweis('');
      // Pack aufreißen
      const pack = $('.ksdp-pack');
      pack.classList.add('ruetteln'); await pause(1100);
      pack.classList.add('reissen'); await pause(260);
      EL.classList.add('blitz'); fk.los(...(() => { const r = pack.getBoundingClientRect(); return [r.left + r.width / 2, r.top + 30]; })(), 70, ['#fff', '#ffe9a0', GLANZ.gold], 'f');
      await pause(500); pack.classList.add('weg'); EL.classList.remove('blitz');
      await pause(600); pack.classList.add('fort');
      const ablage = $('.ksdp-ablage'), info = $('.ksdp-info'), kom = $('.ksdp-kommentar'), karte = $('.ksdp-karte'), vorn = $('.ksdp-vorn');
      for (let i = 0; i < reihe.length && !skip; i++) {
        const e = reihe[i], bester = i === reihe.length - 1, st = edVon(e.runde), t = bester ? CFG.takt.bester : CFG.takt.normal;
        EL.style.setProperty('--glanz', GLANZ[st]);
        vorn.innerHTML = karteHtml(e, team, f, dat.jahr);
        const wert = vorn.querySelector('.pk-wert'), ziel = e.q.ovr; if (wert) wert.textContent = '';
        karte.className = 'ksdp-karte'; kom.className = 'ksdp-kommentar'; kom.innerHTML = ''; info.innerHTML = '';
        void karte.offsetWidth;
        karte.classList.add('kommt', st); if (bester) karte.classList.add('bester');
        await pause(600 * t);
        // Walkout: Pick → Position → College
        const zeilen = [[`PICK #${e.pick}`, `Runde ${e.runde}${bester ? ' · dein erster Pick' : ''}`], [e.q.pos, posName(e.q.pos)], [e.college ? e.college.toUpperCase() : 'COLLEGE', `${e.q.age} Jahre`]];
        for (const [gross, klein] of zeilen) {
          if (skip) break;
          info.innerHTML = `<b${String(gross).length > 13 ? ' class="lang"' : ''}>${esc(gross)}</b><small>${esc(klein)}</small>`; info.classList.remove('an'); void info.offsetWidth; info.classList.add('an');
          if (bester) { EL.classList.add('puls'); setTimeout(() => EL && EL.classList.remove('puls'), 300); }
          await pause(800 * t);
        }
        info.classList.remove('an');
        if (bester) { EL.classList.add('blitz'); await pause(180); EL.classList.remove('blitz'); }
        EL.classList.add('strahlen-an');
        karte.classList.add('dreht');
        await pause(420);
        fk.los(...mitte(), bester ? 90 : 34, FUNKEN[st], 'f');
        if (bester && st === 'draft1') fk.los(innerWidth / 2, innerHeight * 0.3, 140, ['#ffd257', '#ffffff', (f && f.farben && f.farben[0]) || '#2c7cb5', (f && f.farben && f.farben[1]) || '#c8463a'], 'k');
        // Stärke zählt hoch
        if (wert) { const ab = Math.max(40, ziel - 25), dauer = 520 * t, t0 = performance.now();
          await new Promise(r => { const lauf = now => { const k = Math.min(1, (now - t0) / dauer); wert.textContent = Math.round(ab + (ziel - ab) * (1 - Math.pow(1 - k, 3))); if (k < 1 && !skip) requestAnimationFrame(lauf); else { wert.textContent = ziel; r(); } }; requestAnimationFrame(lauf); }); }
        // Kommentar
        const n = e.note || 'B', k = e.kommentar || kommentar(e);
        const chips = [`<span class="ksdp-note" style="background:${NOTE_FARBE[n[0]] || NOTE_FARBE.B}">Note ${esc(n)}</span>`];
        if (e.medien) chips.push(`<span class="ksdp-chip">Medien #${esc(e.medien)}</span>`);
        if (k.art === 'steal') chips.push('<span class="ksdp-chip gut">Steal</span>'); else if (k.art === 'reach') chips.push('<span class="ksdp-chip schlecht">Reach</span>');
        else if (k.art === 'luecke') chips.push('<span class="ksdp-chip gut">Lücke zu</span>');
        // Testrückmeldung 2026-10-22: Kommentarsatz und Chefscout-Zeile weg – nur die Bewertung (Note, Medien-Rang, Steal/Reach)
        kom.innerHTML = `<div class="ksdp-chips">${chips.join('')}</div>`;
        kom.classList.add('an');
        await pause(500);
        hinweis(i < reihe.length - 1 ? 'Tippen für den nächsten Pick' : 'Tippen für die Übersicht');
        if (!skip) await tipp();
        hinweis('');
        // ab in die Ablage
        EL.classList.remove('strahlen-an');
        const mini = document.createElement('div'); mini.className = 'ksdp-mini'; mini.innerHTML = karteHtml(e, team, f, dat.jahr);
        ablage.appendChild(mini); requestAnimationFrame(() => mini.classList.add('da'));
        karte.classList.add('ab'); kom.classList.remove('an');
        await pause(380);
      }
      // Übersicht
      EL.classList.remove('strahlen-an'); EL.classList.add('fertig');
      const sortiert = dat.picks.slice().sort((a, b) => a.pick - b.pick);
      $('.ksdp-ende').innerHTML = `<div class="ksdp-raster">${sortiert.map(e => `<div class="ksdp-zelle"><div class="ksdp-z-karte">${karteHtml(e, team, f, dat.jahr)}</div>
          <span class="ksdp-z-note" style="background:${NOTE_FARBE[(e.note || 'B')[0]] || NOTE_FARBE.B}">${esc(e.note || 'B')}</span></div>`).join('')}</div>
        ${dat.gesamt ? `<div class="ksdp-gesamt"><b style="color:${NOTE_FARBE[dat.gesamt.note[0]] || '#ffd257'}">${esc(dat.gesamt.note)}</b><span><small>Draft-Note</small>${esc(dat.gesamt.satz || '')}</span></div>` : ''}
        <button type="button" class="ksdp-weiter">Zum Kader</button>`;
      $('.ksdp-ende').classList.add('an');
      await new Promise(r => $('.ksdp-weiter').addEventListener('click', r, { once: true }));
      EL.classList.remove('auf'); await warte(300); EL.remove(); EL = null;
    })();
  }

  // ── Stil ────────────────────────────────────────────────────────────────
  const CSS = `
  #ksdp{position:fixed;inset:0;z-index:12000;overflow:hidden;color:#fff;font-family:var(--font-text,system-ui);user-select:none;-webkit-tap-highlight-color:transparent;
    background:radial-gradient(120% 70% at 50% 38%,#1f3158 0%,#0b1326 55%,#03060d 100%);opacity:0;transition:opacity .35s;--glanz:#ffd257}
  #ksdp.auf{opacity:1}
  #ksdp::before{content:'';position:absolute;left:-10%;right:-10%;bottom:-6%;height:24%;background:radial-gradient(60% 100% at 50% 100%,rgb(80 170 90/.32),transparent 70%),
    repeating-linear-gradient(90deg,rgb(0 0 0/.0) 0 22px,rgb(0 0 0/.12) 22px 44px);border-radius:50% 50% 0 0/30% 30% 0 0}
  #ksdp::after{content:'';position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;transition:opacity .5s}
  #ksdp.blitz::after{opacity:.9;transition:opacity .06s}
  #ksdp.puls .ksdp-karte{filter:drop-shadow(0 0 34px var(--glanz)) brightness(1.25)}
  .ksdp-flut{position:absolute;top:-8%;width:70vmin;height:115vh;background:linear-gradient(rgb(255 250 225/.42),rgb(255 250 225/.08) 55%,transparent 80%);
    clip-path:polygon(46% 0,54% 0,100% 100%,0 100%);transform-origin:50% 0;mix-blend-mode:screen;filter:blur(3px);pointer-events:none}
  .ksdp-flut.l{left:-28vmin;animation:ksdp-schwenk 6s ease-in-out infinite alternate;--w0:-28deg;--w1:-12deg}
  .ksdp-flut.r{right:-28vmin;animation:ksdp-schwenk 7s ease-in-out infinite alternate-reverse;--w0:28deg;--w1:12deg}
  @keyframes ksdp-schwenk{from{transform:rotate(var(--w0))}to{transform:rotate(var(--w1))}}
  .ksdp-strahlen{position:absolute;left:50%;top:46%;width:180vmax;height:180vmax;margin:-90vmax 0 0 -90vmax;pointer-events:none;opacity:0;transition:opacity .4s;
    background:repeating-conic-gradient(from 0deg,color-mix(in srgb,var(--glanz) 55%,transparent) 0 5deg,transparent 5deg 15deg);
    -webkit-mask:radial-gradient(circle,#000 0,#000 8%,transparent 42%);mask:radial-gradient(circle,#000 0,#000 8%,transparent 42%);animation:ksdp-dreh 18s linear infinite}
  #ksdp.strahlen-an .ksdp-strahlen{opacity:.75}
  @keyframes ksdp-dreh{to{transform:rotate(360deg)}}
  .ksdp-cv{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:6}
  .ksdp-skip{position:absolute;top:calc(12px + env(safe-area-inset-top,0px));right:12px;z-index:8;border:1px solid rgb(255 255 255/.3);background:rgb(0 0 0/.35);color:#fff;
    font:600 13px/1 var(--font-text,system-ui);padding:8px 12px;border-radius:999px;cursor:pointer}
  #ksdp.fertig .ksdp-skip{display:none}
  .ksdp-kopf{position:absolute;top:calc(14px + env(safe-area-inset-top,0px));left:16px;z-index:7;display:flex;flex-direction:column;opacity:0;transition:opacity .4s}
  .ksdp-kopf b{font:800 24px/1 ${SCHRIFT};letter-spacing:.04em;text-transform:uppercase}.ksdp-kopf small{font-size:12px;opacity:.7;margin-top:3px}
  #ksdp.auf .ksdp-kopf{opacity:1}
  .ksdp-buehne{position:absolute;left:0;right:0;top:0;bottom:0;display:grid;place-items:center;perspective:1100px}
  .ksdp-buehne>*{grid-area:1/1}
  /* Pack */
  .ksdp-pack{position:relative;width:240px;height:340px;transform:translateY(-120vh) rotate(-8deg);filter:drop-shadow(0 26px 30px rgb(0 0 0/.55))}
  #ksdp.auf .ksdp-pack{animation:ksdp-rein .9s cubic-bezier(.2,1.3,.4,1) forwards,ksdp-schweben 3.2s ease-in-out .9s infinite}
  @keyframes ksdp-rein{to{transform:translateY(-4%) rotate(0)}}
  @keyframes ksdp-schweben{0%,100%{transform:translateY(-4%) rotate(0)}50%{transform:translateY(-6.5%) rotate(1.2deg)}}
  .ksdp-koerper,.ksdp-lasche{position:absolute;left:0;top:0;width:240px;height:340px;overflow:hidden;
    background:linear-gradient(90deg,rgb(255 255 255/.0) 0 6%,rgb(255 255 255/.28) 7%,rgb(255 255 255/0) 9% 91%,rgb(255 255 255/.28) 93%,rgb(255 255 255/0) 94%),
      linear-gradient(165deg,color-mix(in srgb,var(--p1) 70%,#fff) 0%,var(--p1) 38%,color-mix(in srgb,var(--p1) 55%,#000) 100%)}
  .ksdp-lasche{height:46px;z-index:2;border-bottom:1px dashed rgb(255 255 255/.45)}
  .ksdp-holo{position:absolute;inset:0;mix-blend-mode:overlay;opacity:.55;pointer-events:none;
    background:linear-gradient(115deg,transparent 20%,rgb(255 0 150/.5) 32%,rgb(255 220 0/.5) 40%,rgb(0 255 200/.5) 48%,rgb(80 120 255/.5) 56%,transparent 68%) 0 0/260% 100%;
    animation:ksdp-holo 3.6s linear infinite}
  .ksdp-lasche .ksdp-holo{background-size:260% 740%}
  @keyframes ksdp-holo{from{background-position:120% 0}to{background-position:-120% 0}}
  .ksdp-inhalt{position:absolute;inset:52px 0 22px;display:flex;flex-direction:column;align-items:center;text-shadow:0 2px 0 rgb(0 0 0/.3)}
  .ksdp-liga{font:800 12px/1 ${SCHRIFT};letter-spacing:.22em;opacity:.85;padding:5px 10px;border:1px solid rgb(255 255 255/.45);border-radius:999px;background:rgb(0 0 0/.18)}
  .ksdp-pwappen{width:84px;height:90px;margin:14px 0 4px;filter:drop-shadow(0 4px 6px rgb(0 0 0/.35))}.ksdp-pwappen svg{width:100%;height:100%;display:block}
  .ksdp-draft{font:900 72px/.86 ${SCHRIFT};letter-spacing:.04em;color:#fff;-webkit-text-stroke:1px rgb(0 0 0/.15);
    background:linear-gradient(180deg,#fff 30%,color-mix(in srgb,var(--p2) 60%,#ffd257));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
  .ksdp-jahr{font:800 40px/1 ${SCHRIFT};letter-spacing:.26em;margin:4px 0 0 .26em;color:#ffe9a0}
  .ksdp-anzahl{margin-top:auto;font:700 13px/1 ${SCHRIFT};letter-spacing:.3em;opacity:.9}
  .ksdp-riss{position:absolute;left:0;right:0;top:40px;height:12px;background:linear-gradient(transparent,rgb(255 245 200/.0),transparent);transition:background .3s}
  #ksdp.auf .ksdp-pack.ruetteln{animation:ksdp-ruetteln 1.1s ease-in forwards}
  @keyframes ksdp-ruetteln{0%{transform:translateY(-4%) rotate(0)}10%{transform:translateY(-4%) rotate(-2deg)}20%{transform:translateY(-4%) rotate(2deg)}30%{transform:translateY(-4%) rotate(-3deg)}
    40%{transform:translateY(-4%) rotate(3deg)}50%{transform:translateY(-4%) rotate(-4deg) scale(1.02)}60%{transform:translateY(-4%) rotate(4deg) scale(1.03)}70%{transform:translateY(-4%) rotate(-5deg) scale(1.04)}
    80%{transform:translateY(-4%) rotate(5deg) scale(1.05)}90%{transform:translateY(-4%) rotate(-3deg) scale(1.06)}100%{transform:translateY(-4%) rotate(0) scale(1.06)}}
  .ksdp-pack.ruetteln .ksdp-riss{background:linear-gradient(transparent,rgb(255 245 200/.95),transparent);box-shadow:0 0 30px 8px rgb(255 240 190/.8)}
  .ksdp-pack.reissen .ksdp-lasche{animation:ksdp-lasche .7s cubic-bezier(.3,.6,.4,1) forwards}
  @keyframes ksdp-lasche{to{transform:translate(160px,-260px) rotate(48deg);opacity:0}}
  #ksdp.auf .ksdp-pack.weg{animation:ksdp-packweg .6s ease-in forwards}
  #ksdp.auf .ksdp-pack.fort{display:none}
  @keyframes ksdp-packweg{from{transform:translateY(-4%) scale(1.06)}to{transform:translateY(120vh) scale(.9) rotate(6deg);opacity:.2}}
  /* Walkout-Info */
  .ksdp-info{align-self:start;margin-top:calc(70px + env(safe-area-inset-top,0px));display:flex;flex-direction:column;align-items:center;text-align:center;opacity:0;z-index:5;padding:0 16px}
  .ksdp-info b{font:900 46px/1 ${SCHRIFT};letter-spacing:.06em;color:var(--glanz);text-shadow:0 0 22px color-mix(in srgb,var(--glanz) 70%,transparent),0 3px 0 rgb(0 0 0/.4)}
  .ksdp-info small{font:600 15px/1.2 var(--font-text,system-ui);margin-top:6px;opacity:.85}
  .ksdp-info b.lang{font-size:32px;letter-spacing:.03em}
  .ksdp-info.an{animation:ksdp-info .55s cubic-bezier(.2,1.2,.4,1) forwards}
  @keyframes ksdp-info{from{opacity:0;transform:scale(1.5);filter:blur(6px)}to{opacity:1;transform:none;filter:none}}
  /* Karte */
  .ksdp-karte{width:220px;height:308px;opacity:0;transform:translateY(60vh) scale(.6);z-index:4;pointer-events:none}
  .ksdp-karte.kommt{animation:ksdp-kommt .6s cubic-bezier(.2,1.1,.3,1) forwards}
  .ksdp-karte.bester.kommt{animation:ksdp-kommt 1.1s cubic-bezier(.2,1.1,.3,1) forwards}
  @keyframes ksdp-kommt{to{opacity:1;transform:translateY(-2%) scale(1.18)}}
  .ksdp-karte.ab{animation:ksdp-ab .38s ease-in forwards}
  @keyframes ksdp-ab{from{opacity:1;transform:translateY(-2%) scale(1.18)}to{opacity:0;transform:translateY(42vh) scale(.3)}}
  .ksdp-dreh{position:relative;width:100%;height:100%;transform-style:preserve-3d;transition:transform .75s cubic-bezier(.3,1.4,.5,1)}
  .ksdp-karte.dreht .ksdp-dreh{transform:rotateY(180deg)}
  .ksdp-rueck,.ksdp-vorn{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden}
  .ksdp-rueck{filter:drop-shadow(0 0 18px var(--glanz)) drop-shadow(0 14px 18px rgb(0 0 0/.5))}
  .ksdp-karte.kommt:not(.dreht) .ksdp-rueck{animation:ksdp-glimm 1.2s ease-in-out infinite}
  @keyframes ksdp-glimm{50%{filter:drop-shadow(0 0 34px var(--glanz)) drop-shadow(0 14px 18px rgb(0 0 0/.5))}}
  .ksdp-rueck svg{width:100%;height:100%;display:block}
  .ksdp-vorn{transform:rotateY(180deg)}
  .ksdp-vorn .pk{filter:drop-shadow(0 0 24px color-mix(in srgb,var(--glanz) 60%,transparent)) drop-shadow(0 14px 18px rgb(0 0 0/.45))}
  /* Kommentar */
  .ksdp-kommentar{align-self:end;margin-bottom:calc(132px + env(safe-area-inset-bottom,0px));width:min(92vw,420px);z-index:5;opacity:0;transform:translateY(24px);transition:opacity .3s,transform .35s cubic-bezier(.2,1.2,.4,1);
    background:rgb(10 16 30/.78);border:1px solid rgb(255 255 255/.14);border-radius:16px;padding:12px 14px;backdrop-filter:blur(6px)}
  .ksdp-kommentar.an{opacity:1;transform:none}
  .ksdp-chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}
  .ksdp-note,.ksdp-chip{font:800 14px/1 ${SCHRIFT};letter-spacing:.06em;padding:6px 10px 5px;border-radius:999px;text-transform:uppercase}
  .ksdp-chip{background:rgb(255 255 255/.12)}.ksdp-chip.gut{background:#2f9e5a}.ksdp-chip.schlecht{background:#d04a3a}
  .ksdp-kommentar p{margin:0;font:600 15px/1.35 var(--font-text,system-ui)}
  .ksdp-kommentar small{display:block;margin-top:6px;font-size:12px;opacity:.7}
  /* Ablage */
  .ksdp-ablage{position:absolute;left:0;right:0;bottom:calc(14px + env(safe-area-inset-bottom,0px));display:flex;justify-content:center;gap:4px;z-index:5;height:86px;flex-direction:row-reverse}
  .ksdp-mini{width:58px;height:82px;opacity:0;transform:translateY(30px);transition:opacity .3s,transform .4s cubic-bezier(.2,1.3,.4,1)}
  .ksdp-mini.da{opacity:1;transform:none}
  .ksdp-mini .pk{transform:scale(.264);transform-origin:0 0}.ksdp-mini .pk::after,.ksdp-z-karte .pk::after{animation:none}
  #ksdp.fertig .ksdp-ablage,#ksdp.fertig .ksdp-karte,#ksdp.fertig .ksdp-kommentar{display:none}
  
  .ksdp-hinweis{position:absolute;left:0;right:0;bottom:calc(106px + env(safe-area-inset-bottom,0px));text-align:center;font:700 14px/1 var(--font-text,system-ui);letter-spacing:.06em;
    opacity:0;transition:opacity .3s;z-index:5;text-transform:uppercase}
  .ksdp-hinweis.an{opacity:.8;animation:ksdp-blink 1.4s ease-in-out infinite}
  .ksdp-hinweis .ti{font-size:30px}
  @keyframes ksdp-blink{50%{opacity:.35}}
  /* Übersicht */
  .ksdp-ende{position:absolute;inset:0;z-index:7;display:none;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:64px 16px calc(20px + env(safe-area-inset-bottom,0px));overflow-y:auto}
  .ksdp-ende.an{display:flex;animation:ksdp-info .5s ease-out}
  .ksdp-raster{display:flex;flex-wrap:wrap;justify-content:center;gap:8px 6px;max-width:440px}
  .ksdp-zelle{position:relative;width:110px;height:154px}
  /* Karte nur halb so groß gezeichnet, ihr Kasten blieb aber 220×308 und lag über „Zum Kader“ (Nutzer 2026-10-22: Knopf ging nicht) */
  .ksdp-z-karte{width:110px;height:154px;pointer-events:none}
  .ksdp-z-karte .pk{transform:scale(.5);transform-origin:0 0}
  .ksdp-z-note{position:absolute;left:50%;bottom:-6px;transform:translateX(-50%);font:800 14px/1 ${SCHRIFT};padding:5px 10px 4px;border-radius:999px;border:2px solid #fff;z-index:6}
  .ksdp-gesamt{display:flex;gap:12px;align-items:center;background:rgb(10 16 30/.78);border:1px solid rgb(255 255 255/.14);border-radius:16px;padding:12px 16px;width:min(92vw,420px)}
  .ksdp-gesamt b{font:900 54px/1 ${SCHRIFT}}.ksdp-gesamt span{display:flex;flex-direction:column;font:600 14px/1.35 var(--font-text,system-ui)}
  .ksdp-gesamt small{font-size:11px;opacity:.65;text-transform:uppercase;letter-spacing:.08em;margin-bottom:2px}
  .ksdp-weiter{position:relative;z-index:2;border:0;border-radius:14px;background:#ffd257;color:#2b1a05;font:800 18px/1 ${SCHRIFT};letter-spacing:.08em;text-transform:uppercase;padding:14px 28px;cursor:pointer}
  @media (prefers-reduced-motion:reduce){.ksdp-flut,.ksdp-strahlen,.ksdp-holo,#ksdp.auf .ksdp-pack{animation:none}#ksdp.auf .ksdp-pack{transform:none}}`;
  function stil() {
    if (document.getElementById('ksdp-stil')) return;
    const s = document.createElement('style'); s.id = 'ksdp-stil'; s.textContent = CSS; document.head.appendChild(s);
  }
  window.KSDraftPack = { CFG, zeigen, ausDraft, kommentar, noteAusRang, edVon, rookieKarte, pickInfo };
  console.log('[Kickstil-DraftPack v1] aktiv — Rookie-Pack nach dem Draft, Picks vom letzten zum ersten');
})();
