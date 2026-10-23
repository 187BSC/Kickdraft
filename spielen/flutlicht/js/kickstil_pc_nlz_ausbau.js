/* ===== kickstil_pc_nlz_ausbau.js =====
   KICKSTIL · NLZ AM PC, ETAPPE 3: AUSBAU, TRAINER, STERNE  ·  v1   (2026-10-19)
   ─────────────────────────────────────────────────────────────────────────────
   Nur PC (Erweiterung von kickstil_pc_nlz.js über KSNlz.erweitern, zwei Reiter „Ausbau“ und „Trainer“).
   Vorschau 2 (Artifact Q57g8DtZcaqaJXdx6pbgTo) freigegeben; Beträge vom Nutzer freigegeben 2026-10-19 („passt so“),
   alle für die Dritte Liga und skaliert nach Liga (Erste ×3, Zweite ×1,6, Regionalliga ×0,4).

   · AUSBAU in drei Strängen (Infrastruktur, Lehrplan, Netzwerk): Bauprojekte mit Kosten und Bauzeit (höchstens 2
     gleichzeitig) und Abos je Saison (gebucht beim Start und zu jedem Saisonstart).
   · TRAINER: drei Bereichsleiter (Grundlagen U9–U11, Aufbau U12–U15, Leistung U16–U19) mit 1–5 Sternen, Schwerpunkt,
     Lizenz C → B → Elite-Jugend → A → Pro, Erfahrung (voll = ein Stern mehr). Gehälter stecken im Trainer-Anteil des
     NLZ-Budgets. Fortbildung kostenlos, 6 Wochen (eine gleichzeitig, ab Trainer-Wirkung 1,35 zwei). Abwerbe-Angebote zum
     Saisonstart (ab 3★): Halten kostet einmalig 30 % seines Anteils am Trainerbudget. Leistungstrainer mit A-Lizenz kann
     zu den Profis: wird Co-Trainer im Trainerteam (KSTrainerteam.verpflichten), die Stelle im NLZ wird neu besetzt.
   · STERNE: Start Erste/Zweite 2★, sonst 1★; Prüfung alle 3 Saisons (höchstens ±1). 2★: Kunstrasen, Spielidee 1,
     Leistungstrainer B-Lizenz, Durchlässigkeit 10 %. 3★: Internat 2, Spielidee 2, Elite-Jugend-Lizenz, 20 %.
     Fördergeld je Saison 1★ 50 Tsd., 2★ 120 Tsd., 3★ 250 Tsd. (skaliert). Sterne wirken auf die Landkarte (KSNlzAusbau.sterne).
   Zustand: CLUB.welt.nlz.ausbau. API: KSNlzAusbau.CFG · .sterne(n) · .z()
   Lädt nach kickstil_pc_nlz_karte.js, vor init_bootstrap.js.
   ============================================================================= */
(function () {
  'use strict';
  const W = window, N = W.KSNlz;
  if (!N || !N.erweitern) { console.warn('[Kickstil-PC-NLZ-Ausbau] KSNlz fehlt – Modul inaktiv'); return; }
  const H = N.hilfe, esc = H.esc;

  const CFG = {
    skala: { bundesliga: 3, bundesliga2: 1.6, liga3: 1, regionalliga: 0.4 },
    gleichzeitig: 2,
    projekte: [
      // Infrastruktur
      { key: 'kunstrasen', strang: 'infra', name: 'Kunstrasenplatz', text: 'Training auch im Winter: Entwicklung +5 %.', kosten: 250000, wochen: 8 },
      { key: 'internat2', strang: 'infra', name: 'Internat Stufe 2', text: '+1 Akademie-Platz, Abbrecher −30 %, Anziehung ab 30 km +10 %.', kosten: 1200000, wochen: 30 },
      { key: 'athletik', strang: 'infra', name: 'Athletikzentrum', text: 'Entwicklung der Talente +8 %.', kosten: 800000, wochen: 20 },
      { key: 'video', strang: 'infra', name: 'Videoanalyse', text: 'Das Potenzial deiner Talente wird genauer angezeigt.', kosten: 150000, wochen: 6 },
      { key: 'stadion', strang: 'infra', name: 'Flutlicht-Nachwuchsstadion', text: 'U19 vor Publikum: Anziehung +10 %, Entwicklung +5 %.', kosten: 2000000, wochen: 40, braucht: n => sterne(n) >= 3 ? null : 'braucht 3 Sterne' },
      // Lehrplan
      { key: 'idee1', strang: 'lehr', name: 'Spielidee Stufe 1', text: 'Alle Teams spielen dein System: ein Philosophie-Wechsel dauert 2 statt 3 Jahre.', kosten: 60000, wochen: 16 },
      { key: 'idee2', strang: 'lehr', name: 'Spielidee Stufe 2', text: 'Positionsspiel ab U12: Stil-Passung der Eigengewächse +15 %.', kosten: 100000, wochen: 30, braucht: n => fertig(n, 'idee1') ? null : 'braucht Spielidee Stufe 1' },
      { key: 'indiv', strang: 'lehr', name: 'Individualtraining', text: 'Je Talent ein Schwerpunkt: Entwicklung +6 %.', kosten: 120000, abo: true },
      { key: 'mental', strang: 'lehr', name: 'Mentaltraining', text: 'Weniger Heimweh und Motivationslöcher: Abbrecher −15 %, Spätzünder +25 %.', kosten: 80000, abo: true, braucht: n => N.wirkung(n).medizin > 1.05 ? null : 'braucht ein Medizin-Budget über Standard' },
      { key: 'torwart', strang: 'lehr', name: 'Torwartschule', text: 'Torhüter in der Akademie entwickeln sich +20 %.', kosten: 200000, wochen: 20, braucht: n => fertig(n, 'idee2') ? null : 'braucht Spielidee Stufe 2' },
      // Netzwerk
      { key: 'camps', strang: 'netz', name: 'Fußballcamps in den Ferien', text: 'Bringen etwa 80 Tsd. € je Saison ein (skaliert), Netzwerk-Funde +30 %.', kosten: 30000, wochen: 4, einnahmen: 80000 },
      { key: 'sichtung', strang: 'netz', name: 'Bundesweites Sichtungsnetz', text: 'Scouts in ganz Deutschland: doppelt so viele Netzwerk-Funde.', kosten: 100000, abo: true },
      { key: 'ausland', strang: 'netz', name: 'Auslandspartner Westafrika', text: 'Ein zusätzlicher Fund je Saison aus Westafrika (Vorbild: Right to Dream).', kosten: 150000, abo: true, braucht: n => fertig(n, 'internat2') ? null : 'braucht Internat Stufe 2' }
    ],
    straenge: { infra: ['Infrastruktur', 'Gebäude und Plätze – kosten einmal Geld und Bauzeit.'], lehr: ['Lehrplan', 'Wie in allen Altersstufen trainiert wird.'], netz: ['Netzwerk', 'Wer dir Kinder bringt – auch von weit her.'] },
    sterne: { start: { bundesliga: 2, bundesliga2: 2 }, alle: 3, foerder: [50000, 120000, 250000] },
    bereiche: [['grund', 'Grundlagenbereich', 'U9–U11'], ['aufbau', 'Aufbaubereich', 'U12–U15'], ['leist', 'Leistungsbereich', 'U16–U19']],
    lizenzen: ['C', 'B', 'Elite-Jugend', 'A', 'Pro'],
    fokus: ['Technik', 'Taktik', 'Athletik', 'Torwart'],
    eigenschaften: { Technik: ['Ballzauberer', 'Kinderliebling'], Taktik: ['Taktikfuchs', 'Laptop-Trainer'], Athletik: ['Schleifer', 'Fitnessfreak'], Torwart: ['Torwartflüsterer', 'Reflex-Schule'] },
    xpWoche: 1.2, fortbWochen: 6, haltenAnteil: 0.3, angebotChance: 0.25, angebotFrist: 6,
    vereineGross: ['einem Erstligisten', 'einem Zweitligisten', 'einem Verein aus England', 'einem Verein aus den Niederlanden']
  };
  const VORNAMEN_M = ['Holger', 'Dragan', 'Sven', 'Thomas', 'Jens', 'Stefan', 'Markus', 'Ralf', 'Dirk', 'Carsten', 'Heiko', 'Kemal', 'Tobias', 'Jürgen', 'Oliver'];
  const VORNAMEN_W = ['Martina', 'Anja', 'Nicole', 'Sabine', 'Petra', 'Lena', 'Jasmin', 'Kathrin'];
  // Trainer und Trainerinnen (Anteil Frauen 20 %); Wörter je Person
  const wort = (t, m, w) => (t && t.w ? w : m);
  const NACHNAMEN = ['Brandt', 'Kühn', 'Petrović', 'Albers', 'Lorenz', 'Seidel', 'Maurer', 'Thiel', 'Reuter', 'Winkler', 'Busch', 'Keller', 'Yilmaz', 'Horn', 'Decker', 'Sander', 'Pohl', 'Voss'];
  const saison = () => LEAGUE.season || 1;
  const rnd = () => Math.random();
  const zuf = a => a[Math.floor(rnd() * a.length)];
  const skala = () => CFG.skala[H.tierKey()] || 1;
  const preis = p => Math.round(p * skala() / 10000) * 10000;
  const PRJ = k => CFG.projekte.find(p => p.key === k);

  // ── Zustand ────────────────────────────────────────────────────────────────────────────────────────────────────
  function za(n) {
    if (!n.ausbau || n.ausbau.v !== 1) {
      n.ausbau = { v: 1, fertig: {}, lauf: [], abo: {}, aboBezahlt: {}, sterne: CFG.sterne.start[H.tierKey()] || 1, pruefung: saison() + CFG.sterne.alle,
        foerder: saison(), trainer: {}, kand: {}, kandSaison: 0, fortb: [], angebot: null };
      const tk = H.tierKey(), gross = tk === 'bundesliga' || tk === 'bundesliga2';
      CFG.bereiche.forEach(([b]) => { n.ausbau.trainer[b] = person(gross ? 3 : 2, b === 'leist' ? (gross ? 2 : 1) : b === 'aufbau' && gross ? 1 : 0); });
    }
    const a = n.ausbau;
    if (a.kandSaison !== saison()) neueKandidaten(n);
    return a;
  }
  const fertig = (n, k) => !!za(n).fertig[k];
  const aktiv = (n, k) => { const p = PRJ(k); return p && p.abo ? !!za(n).abo[k] : fertig(n, k); };
  const sterne = n => (n && n.ausbau ? n.ausbau.sterne : 0) || 0;

  // ── Trainer ────────────────────────────────────────────────────────────────────────────────────────────────────
  function person(st, liz) {
    const fokus = zuf(CFG.fokus), w = v => Math.max(4, Math.min(20, Math.round(v + (rnd() - 0.5) * 4)));
    const weiblich = rnd() < 0.2;
    return { id: 'nt_' + Math.random().toString(36).slice(2, 8), w: weiblich, vorname: zuf(weiblich ? VORNAMEN_W : VORNAMEN_M), name: zuf(NACHNAMEN), alter: 29 + Math.floor(rnd() * 26),
      sterne: st, fokus, liz: liz || 0, xp: Math.floor(rnd() * 40),
      werte: { Taktik: w(5 + 2.5 * st), Talentförderung: w(6 + 2.5 * st), Menschenführung: w(7 + 2 * st), [fokus]: w(9 + 2.5 * st) },
      eig: st >= 3 ? [zuf(CFG.eigenschaften[fokus])] : [] };
  }
  function neueKandidaten(n) {
    const a = n.ausbau; a.kandSaison = saison(); a.kand = {};
    const w = N.wirkung(n).trainer, tk = H.tierKey(), plus = tk === 'bundesliga' ? 1 : tk === 'bundesliga2' ? 0.5 : 0;
    CFG.bereiche.forEach(([b]) => {
      a.kand[b] = [0, 1, 2].map(() => person(Math.max(1, Math.min(5, Math.round(1.5 + 1.2 * w + plus + (rnd() - 0.5) * 2))), Math.floor(rnd() * 3)))
        .sort((x, y) => y.sterne - x.sterne);
    });
  }
  const trainer = (n, b) => za(n).trainer[b];
  const gehalt = n => { const an = n.anteile || {}, sum = Object.values(an).reduce((x, y) => x + y, 0) || 100; return n.budget * (an.trainer || 45) / sum / 3; };
  const fortbPlaetze = n => N.wirkung(n).trainer >= 1.35 ? 2 : 1;
  function fortbildung(n, b) {
    const a = za(n), t = a.trainer[b];
    if (!t || t.liz >= CFG.lizenzen.length - 1) return;
    if (a.fortb.some(f => f.b === b)) return;
    if (a.fortb.length >= fortbPlaetze(n)) { H.toast(`Gerade läuft schon ${a.fortb.length === 1 ? 'eine Fortbildung' : 'zwei Fortbildungen'} – mehr Trainerbudget erlaubt zwei.`, 'warn'); return; }
    a.fortb.push({ b, id: t.id, rest: CFG.fortbWochen });
    H.toast(`${t.vorname} ${t.name}: Lehrgang ${CFG.lizenzen[t.liz + 1]}-Lizenz (${CFG.fortbWochen} Wochen).`, 'success');
  }
  function aufruecken(n, b) {
    const a = za(n), i = CFG.bereiche.findIndex(x => x[0] === b); if (i < 0 || i >= 2) return;
    const oben = CFG.bereiche[i + 1][0], t = a.trainer[b];
    a.trainer[b] = a.trainer[oben]; a.trainer[oben] = t;
    a.fortb.forEach(f => { if (f.id === t.id) f.b = oben; else if (a.trainer[b] && f.id === a.trainer[b].id) f.b = b; });
    H.toast(`${t.vorname} ${t.name} übernimmt den ${CFG.bereiche[i + 1][1]}.`, 'success');
  }
  function ersetzen(n, b, id) {
    const a = za(n), k = (a.kand[b] || []).find(x => x.id === id); if (!k) return;
    const alt = a.trainer[b];
    a.trainer[b] = k; a.kand[b] = a.kand[b].filter(x => x !== k);
    a.fortb = a.fortb.filter(f => f.id !== (alt && alt.id));
    if (a.angebot && alt && a.angebot.id === alt.id) a.angebot = null;
    if (typeof addNews === 'function') addNews('club', '🏫 NLZ: ' + wort(k, 'Neuer Trainer', 'Neue Trainerin'), `${k.vorname} ${k.name} (${k.sterne}★, ${k.fokus}) übernimmt den ${CFG.bereiche.find(x => x[0] === b)[1]}.`);
    H.toast(`${k.vorname} ${k.name} übernimmt.`, 'success');
  }
  function befoerdern(n, b) {
    const a = za(n), t = a.trainer[b];
    if (!t || b !== 'leist' || t.liz < 3) return;
    const TT = W.KSTrainerteam; if (!TT || !TT.verpflichten || !TT.stab) { H.toast('Das Trainerteam ist gerade nicht erreichbar.', 'warn'); return; }
    try {
      const T = CLUB.welt.trainerteam; if (!T) TT.stab();
      const co = { id: 'co_nlz_' + t.id, rolle: 'co', vorname: t.vorname, name: t.name, alter: t.alter, sterne: t.sterne, art: 'aus dem eigenen NLZ' };
      CLUB.welt.trainerteam.kandidaten.co = (CLUB.welt.trainerteam.kandidaten.co || []).concat([co]);
      if (!TT.verpflichten('co', co.id)) { CLUB.welt.trainerteam.kandidaten.co = CLUB.welt.trainerteam.kandidaten.co.filter(x => x.id !== co.id); return; }
    } catch (e) { console.warn('[Kickstil-PC-NLZ-Ausbau] Befördern', e); return; }
    const neu = (a.kand.leist || [])[0] || person(2, 1);
    a.trainer.leist = neu; a.kand.leist = (a.kand.leist || []).filter(x => x !== neu);
    a.fortb = a.fortb.filter(f => f.id !== t.id); if (a.angebot && a.angebot.id === t.id) a.angebot = null;
    if (typeof addNews === 'function') addNews('club', '🏫 NLZ: Aus dem Nachwuchs zu den Profis', `${t.vorname} ${t.name} wird ${wort(t, 'Co-Trainer', 'Co-Trainerin')} der Profis – der Weg von der U19 nach oben. ${neu.vorname} ${neu.name} übernimmt den Leistungsbereich.`);
  }
  function angebotEntscheiden(n, wahl) {
    const a = za(n), ang = a.angebot; if (!ang) return;
    const b = ang.b, t = a.trainer[b]; if (!t || t.id !== ang.id) { a.angebot = null; return; }
    if (wahl === 'halten') {
      const k = Math.round(gehalt(n) * CFG.haltenAnteil / 1000) * 1000;
      if ((CLUB.budget || 0) < k) { H.toast('Dafür reicht das Budget nicht (' + H.euro(k) + ').', 'warn'); return; }
      CLUB.budget -= k; a.angebot = null;
      H.toast(`${t.vorname} ${t.name} bleibt – für ${H.euro(k)}.`, 'success');
    } else if (wahl === 'befoerdern') { befoerdern(n, b); a.angebot = null; }
    else { gehen(n, b, ang.von); }
  }
  function gehen(n, b, von) {
    const a = za(n), t = a.trainer[b], neu = (a.kand[b] || [])[0] || person(2, 0);
    a.trainer[b] = neu; a.kand[b] = (a.kand[b] || []).filter(x => x !== neu);
    a.fortb = a.fortb.filter(f => f.id !== (t && t.id)); a.angebot = null;
    if (t && typeof addNews === 'function') addNews('club', '🏫 NLZ: ' + wort(t, 'Trainer', 'Trainerin') + ' geht', `${t.vorname} ${t.name} wechselt zu ${von}. ${neu.vorname} ${neu.name} (${neu.sterne}★) übernimmt.`);
  }

  // ── Ausbau ─────────────────────────────────────────────────────────────────────────────────────────────────────
  function starten(n, key) {
    const a = za(n), p = PRJ(key); if (!p) return;
    const sperre = p.braucht && p.braucht(n); if (sperre) { H.toast(sperre[0].toUpperCase() + sperre.slice(1) + '.', 'warn'); return; }
    if (p.abo) {
      if (a.abo[key]) { delete a.abo[key]; H.toast(p.name + ' beendet.', 'info'); return; }
      const k = a.aboBezahlt[key] === saison() ? 0 : preis(p.kosten);
      if (k && (CLUB.budget || 0) < k) { H.toast('Dafür reicht das Budget nicht (' + H.euro(k) + ').', 'warn'); return; }
      CLUB.budget -= k; a.abo[key] = true; a.aboBezahlt[key] = saison();
      H.toast(`${p.name} läuft${k ? ' · ' + H.euro(k) + ' für diese Saison' : ''}.`, 'success');
    } else {
      if (a.fertig[key] || a.lauf.some(x => x.key === key)) return;
      if (a.lauf.length >= CFG.gleichzeitig) { H.toast(`Höchstens ${CFG.gleichzeitig} Projekte gleichzeitig.`, 'warn'); return; }
      const k = preis(p.kosten);
      if ((CLUB.budget || 0) < k) { H.toast('Dafür reicht das Budget nicht (' + H.euro(k) + ').', 'warn'); return; }
      CLUB.budget -= k; a.lauf.push({ key, rest: p.wochen, gesamt: p.wochen });
      H.toast(`${p.name} gestartet · ${H.euro(k)} · ${p.wochen} Wochen.`, 'success');
    }
    try { if (typeof saveGameState === 'function') saveGameState(); } catch (e) { /* später */ }
  }

  // ── Sterne ─────────────────────────────────────────────────────────────────────────────────────────────────────
  function durchl() { const sq = typeof SQUAD !== 'undefined' ? SQUAD : []; return sq.length ? Math.round(sq.filter(H.istEigengewaechs).length / sq.length * 100) : 0; }
  function bedingungen(n, st) {
    const t = trainer(n, 'leist') || { liz: 0 }, d = durchl();
    if (st === 2) return [['Kunstrasenplatz', fertig(n, 'kunstrasen')], ['Spielidee Stufe 1', fertig(n, 'idee1')], ['Leistungstrainer mit B-Lizenz', t.liz >= 1], [`Durchlässigkeit 10 % (jetzt ${d} %)`, d >= 10]];
    if (st === 3) return [['Internat Stufe 2', fertig(n, 'internat2')], ['Spielidee Stufe 2', fertig(n, 'idee2')], ['Leistungstrainer mit Elite-Jugend-Lizenz', t.liz >= 2], [`Durchlässigkeit 20 % (jetzt ${d} %)`, d >= 20]];
    return [];
  }
  const erfuellt = (n, st) => st <= 1 || bedingungen(n, st).every(x => x[1]);
  function pruefen(n) {
    const a = za(n), alt = a.sterne;
    let ziel = erfuellt(n, 3) ? 3 : erfuellt(n, 2) ? 2 : 1;
    ziel = Math.max(alt - 1, Math.min(alt + 1, ziel));
    a.sterne = ziel; a.pruefung = saison() + CFG.sterne.alle;
    if (typeof addNews === 'function') addNews('club', ziel > alt ? '⭐ NLZ: Ein Stern mehr!' : ziel < alt ? '⭐ NLZ: Stern verloren' : '⭐ NLZ: Zertifizierung bestätigt',
      ziel > alt ? `Die Prüfer vergeben deinem Nachwuchsleistungszentrum ${ziel} Sterne. Mehr Fördergeld und mehr Anziehung bei Eltern und Talenten.`
        : ziel < alt ? `Die Prüfer stufen dein NLZ auf ${ziel} ${ziel === 1 ? 'Stern' : 'Sterne'} herab – die Bedingungen für ${alt} Sterne sind nicht mehr erfüllt.`
          : `Dein NLZ behält ${ziel} ${ziel === 1 ? 'Stern' : 'Sterne'}. Nächste Prüfung in ${CFG.sterne.alle} Saisons.`);
  }

  // ── Woche und Saison ───────────────────────────────────────────────────────────────────────────────────────────
  function woche(n) {
    const a = za(n), news = (t, x) => { if (typeof addNews === 'function') addNews('club', t, x); };
    a.lauf.forEach(x => { x.rest--; });
    a.lauf.filter(x => x.rest <= 0).forEach(x => { a.fertig[x.key] = saison(); const p = PRJ(x.key); news('🏗️ NLZ: ' + p.name + ' fertig', p.text); });
    a.lauf = a.lauf.filter(x => x.rest > 0);
    a.fortb.forEach(f => { f.rest--; });
    a.fortb.filter(f => f.rest <= 0).forEach(f => {
      const t = a.trainer[f.b]; if (!t || t.id !== f.id) return;
      t.liz = Math.min(CFG.lizenzen.length - 1, t.liz + 1); t.xp = Math.min(99, t.xp + 10);
      news('🎓 NLZ: Lizenz bestanden', `${t.vorname} ${t.name} hat jetzt die ${CFG.lizenzen[t.liz]}-Lizenz.`);
    });
    a.fortb = a.fortb.filter(f => f.rest > 0);
    CFG.bereiche.forEach(([b]) => {
      const t = a.trainer[b]; if (!t || t.sterne >= 5) return;
      t.xp += CFG.xpWoche;
      if (t.xp >= 100) { t.xp = 0; t.sterne++; if (t.sterne >= 3 && !t.eig.length) t.eig.push(zuf(CFG.eigenschaften[t.fokus])); news('🏫 NLZ: ' + wort(t, 'Trainer', 'Trainerin') + ' entwickelt sich', `${t.vorname} ${t.name} hat dazugelernt – jetzt ${t.sterne} Sterne.`); }
    });
    if (a.angebot && (LEAGUE.week || 1) - a.angebot.woche >= CFG.angebotFrist) gehen(n, a.angebot.b, a.angebot.von);
    // Auslandspartner: ein Fund je Saison, zufällige Woche
    if (a.abo.ausland && a.auslandSaison !== saison() && (LEAGUE.week || 1) >= 3 && (rnd() < 0.06 || (LEAGUE.week || 1) >= 30) && W.KSNlzKarte && KSNlzKarte.auslandFund) {
      a.auslandSaison = saison(); KSNlzKarte.auslandFund(n);
    }
  }
  function neueSaison(n) {
    const a = za(n), s = saison(), news = (t, x) => { if (typeof addNews === 'function') addNews('club', t, x); }, sk = skala();
    let kosten = 0;
    Object.keys(a.abo).forEach(k => { if (a.aboBezahlt[k] !== s) { kosten += preis(PRJ(k).kosten); a.aboBezahlt[k] = s; } });
    if (kosten) { CLUB.budget = (CLUB.budget || 0) - kosten; news('🏫 NLZ: Laufende Programme', `${Object.keys(a.abo).map(k => PRJ(k).name).join(', ')} ${Object.keys(a.abo).length > 1 ? 'kosten' : 'kostet'} diese Saison ${H.euro(kosten)}.`); }
    if (a.fertig.camps) { const e = Math.round(PRJ('camps').einnahmen * sk / 1000) * 1000; CLUB.budget += e; news('⚽ NLZ: Fußballcamps', `Die Ferien-Camps bringen ${H.euro(e)} ein.`); }
    if (s >= a.pruefung) pruefen(n);
    if (a.foerder !== s) {
      a.foerder = s;
      const f = Math.round(CFG.sterne.foerder[Math.max(1, a.sterne) - 1] * sk / 1000) * 1000;
      CLUB.budget += f; news('⭐ NLZ: Fördergeld', `Für dein ${a.sterne}-Sterne-Nachwuchsleistungszentrum gibt es diese Saison ${H.euro(f)} Fördergeld.`);
    }
    // Abwerben: höchstens ein Angebot je Saison
    if (!a.angebot) {
      const kand = CFG.bereiche.map(([b]) => b).filter(b => a.trainer[b] && a.trainer[b].sterne >= 3);
      if (kand.length && rnd() < CFG.angebotChance) {
        const b = zuf(kand), t = a.trainer[b];
        a.angebot = { b, id: t.id, von: zuf(CFG.vereineGross), saison: s, woche: LEAGUE.week || 1 };
        news('🏫 NLZ: Trainer umworben', `${t.vorname} ${t.name} hat ein Angebot von ${a.angebot.von}. Halten, befördern oder ziehen lassen? Entscheide im NLZ unter Trainer (${CFG.angebotFrist} Wochen Zeit).`);
      }
    }
    CFG.bereiche.forEach(([b]) => { const t = a.trainer[b]; if (t) t.alter++; });
  }

  // ── Wirkung (Faktoren für NLZ und Landkarte) ───────────────────────────────────────────────────────────────────
  const istTW = p => p && (p.pos === 'TW' || (p.positions || [])[0] === 'TW');
  function faktor(art, n, p) {
    if (!n || !n.ausbau) return 1;
    const t = b => n.ausbau.trainer[b] || { sterne: 2, fokus: '' };
    if (art === 'dev') {
      let f = (aktiv(n, 'kunstrasen') ? 1.05 : 1) * (aktiv(n, 'athletik') ? 1.08 : 1) * (aktiv(n, 'indiv') ? 1.06 : 1) * (aktiv(n, 'stadion') ? 1.05 : 1);
      f *= 1 + 0.04 * (t('leist').sterne - 2);
      if (istTW(p)) f *= (aktiv(n, 'torwart') ? 1.2 : 1) * (t('leist').fokus === 'Torwart' ? 1.1 : 1);
      return f;
    }
    if (art === 'abbrecher') return (aktiv(n, 'internat2') ? 0.7 : 1) * (aktiv(n, 'mental') ? 0.85 : 1) * (1.2 - 0.08 * t('grund').sterne);
    if (art === 'spaetzuender') return (aktiv(n, 'mental') ? 1.25 : 1) * (0.8 + 0.1 * t('aufbau').sterne);
    if (art === 'umstellung') return aktiv(n, 'idee1') ? 2 / 3 : 1;
    if (art === 'anziehung') return aktiv(n, 'stadion') ? 1.1 : 1;
    if (art === 'fern') return aktiv(n, 'internat2') ? 1.1 : 1;
    if (art === 'netz') return (aktiv(n, 'camps') ? 1.3 : 1) * (aktiv(n, 'sichtung') ? 2 : 1);
    if (art === 'stil') return aktiv(n, 'idee2') ? 1.15 : 1;
    return 1;
  }
  // Videoanalyse: genauere Potenzial-Spanne für die eigenen Akademie-Talente
  if (typeof W.potentialRange === 'function') {
    const _pr = W.potentialRange;
    W.potentialRange = function (p, sc) {
      try {
        const n = CLUB.welt && CLUB.welt.nlz;
        if (n && n.ausbau && n.ausbau.fertig.video && H.istPc() && (CLUB.youthProspects || []).indexOf(p) >= 0)
          return _pr.call(this, p, Math.min(10, (sc || (CLUB.facilities && CLUB.facilities.scouting) || 1) + 2));
      } catch (e) { /* Original */ }
      return _pr.apply(this, arguments);
    };
    try { potentialRange = W.potentialRange; } catch (e) { /* window reicht */ }
  }

  // ── Anzeige: Ausbau ────────────────────────────────────────────────────────────────────────────────────────────
  const sterneHtml = (s, max) => `<span class="na-st" role="img" aria-label="${s} von ${max} Sternen">${Array.from({ length: max }, (_, i) => `<i class="ti ti-star-filled${i >= s ? ' aus' : ''}" aria-hidden="true"></i>`).join('')}</span>`;
  function ausbauHtml(n) {
    const a = za(n), naechster = Math.min(3, a.sterne + 1), bed = a.sterne < 3 ? bedingungen(n, naechster) : bedingungen(n, 3);
    const foerder = Math.round(CFG.sterne.foerder[Math.max(1, a.sterne) - 1] * skala() / 1000) * 1000;
    const kopf = `<section class="nz-kasten na-ziel">${sterneHtml(a.sterne, 3)}
      <div><span class="na-etikett">${a.sterne < 3 ? 'Nächster Stern' : 'Drei Sterne halten'} · Prüfung ${a.pruefung - saison() <= 0 ? 'zum nächsten Saisonstart' : 'in ' + (a.pruefung - saison()) + (a.pruefung - saison() === 1 ? ' Saison' : ' Saisons')}</span>
        <div class="na-bed">${bed.map(([t, ok]) => `<span class="${ok ? 'ok' : 'offen'}">${esc(t)}${ok ? ' ✓' : ''}</span>`).join('')}</div></div>
      <div class="na-zz"><div><small>Fördergeld je Saison</small><b>${H.euro(foerder)}</b></div><div><small>Projekte gleichzeitig</small><b>${a.lauf.length} / ${CFG.gleichzeitig}</b></div></div></section>`;
    const ST = { fertig: 'fertig ✓', lauf: 'im Bau', abo: 'läuft', frei: 'verfügbar', gesperrt: 'gesperrt' };
    const straenge = Object.keys(CFG.straenge).map(sk => {
      const liste = CFG.projekte.filter(p => p.strang === sk);
      const knoten = liste.map(p => {
        const l = a.lauf.find(x => x.key === p.key), sperre = p.braucht && p.braucht(n);
        const st = p.abo ? (a.abo[p.key] ? 'abo' : sperre ? 'gesperrt' : 'frei') : a.fertig[p.key] ? 'fertig' : l ? 'lauf' : sperre ? 'gesperrt' : 'frei';
        const kosten = p.abo ? `${H.euro(preis(p.kosten))} je Saison` : `${H.euro(preis(p.kosten))} · ${p.wochen} Wochen`;
        const knopf = st === 'frei' ? `<button type="button" class="app-knopf" data-na-p="${p.key}">${p.abo ? 'Starten' : 'Bauen'}</button>` : st === 'abo' ? `<button type="button" class="app-knopf" data-na-p="${p.key}">Beenden</button>` : '';
        return `<div class="na-knoten ${st}"><b>${esc(p.name)}</b><span class="na-zst">${ST[st]}</span><small>${esc(p.text)}</small>
          ${l ? `<div class="na-fort"><i style="width:${Math.round((1 - l.rest / l.gesamt) * 100)}%"></i></div><small class="na-rest">noch ${l.rest} ${l.rest === 1 ? 'Woche' : 'Wochen'}</small>` : ''}
          ${st !== 'fertig' && st !== 'lauf' ? `<div class="na-k">${knopf}<span>${st === 'gesperrt' ? esc(sperre) : kosten}</span></div>` : ''}</div>`;
      }).join('');
      return `<section class="nz-kasten na-strang"><h3>${CFG.straenge[sk][0]} <small>${liste.filter(p => p.abo ? a.abo[p.key] : a.fertig[p.key]).length} / ${liste.length}</small></h3><p>${CFG.straenge[sk][1]}</p>${knoten}</section>`;
    }).join('');
    return kopf + `<div class="na-baum">${straenge}</div>`;
  }

  // ── Anzeige: Trainer ───────────────────────────────────────────────────────────────────────────────────────────
  let offenErsetzen = null;
  const GES = new Map();
  function gesichtT(t) {
    try {
      const F = W.facesjs; if (!F || !W.KSVerein) return '';
      if (!GES.has(t.id)) {
        let h = 2166136261; for (let i = 0; i < t.id.length; i++) { h ^= t.id.charCodeAt(i); h = Math.imul(h, 16777619); }
        let seed = (h >>> 0) || 1; const orig = Math.random;
        Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
        try { GES.set(t.id, F.generate({ jersey: { id: 'jersey' }, accessories: { id: 'none' }, glasses: { id: 'none' } }, { gender: t.w ? 'female' : 'male' })); } finally { Math.random = orig; }
      }
      return KSVerein.gesicht({ id: t.id, firstName: t.vorname, name: t.name, gesicht: GES.get(t.id) }, 'fcm');
    } catch (e) { return ''; }
  }
  function trainerHtml(n) {
    const a = za(n), KAR = ['U9–U11', 'U12–U15', 'U16–U19', 'Co-Trainer Profis'];
    let h = '';
    if (a.angebot) {
      const t = a.trainer[a.angebot.b], k = Math.round(gehalt(n) * CFG.haltenAnteil / 1000) * 1000;
      if (t) h += `<section class="nz-kasten na-angebot"><b>${esc(t.vorname + ' ' + t.name)} hat ein Angebot von ${esc(a.angebot.von)}</b>
        <span>Ohne Entscheidung geht ${wort(t, 'er', 'sie')} in ${Math.max(0, CFG.angebotFrist - ((LEAGUE.week || 1) - a.angebot.woche))} Wochen.</span>
        <div class="na-k"><button type="button" class="app-knopf" data-na-ang="halten">Halten · ${H.euro(k)}</button>${a.angebot.b === 'leist' && t.liz >= 3 ? '<button type="button" class="app-knopf" data-na-ang="befoerdern">Zu den Profis befördern</button>' : ''}<button type="button" class="app-knopf" data-na-ang="gehen">Ziehen lassen</button></div></section>`;
    }
    h += `<div class="na-trainer">${CFG.bereiche.map(([b, name, alter], i) => {
      const t = a.trainer[b]; if (!t) return '';
      const fb = a.fortb.find(f => f.id === t.id);
      return `<section class="nz-kasten na-trk"><span class="na-g" aria-hidden="true">${gesichtT(t)}</span>
        <div class="na-trk-m"><span class="na-etikett">${name} (${alter})</span><h2>${esc(t.vorname + ' ' + t.name)}</h2>
          <div class="na-unter">${t.alter} Jahre · Schwerpunkt ${esc(t.fokus)} · ${sterneHtml(t.sterne, 5)}</div>
          ${t.eig.length ? `<div class="na-chips">${t.eig.map(e => `<span>${esc(e)}</span>`).join('')}</div>` : ''}
          <div class="na-xp"><span>Erfahrung</span><span class="na-bar"><i style="width:${Math.round(t.xp)}%"></i></span><span>${Math.round(t.xp)} / 100${t.sterne < 5 ? ' → ' + (t.sterne + 1) + '★' : ''}</span></div>
          <div class="na-liz">${CFG.lizenzen.map((l, k) => `<span class="${k <= t.liz ? 'ok' : fb && k === t.liz + 1 ? 'lauf' : ''}">${l}${fb && k === t.liz + 1 ? ' · noch ' + fb.rest + ' Wo.' : ''}</span>`).join('')}</div>
          <div class="na-kar">${KAR.map((k, j) => `<span class="${j === i ? 'da' : j < i ? 'war' : ''}">${k}</span>`).join('<em>›</em>')}</div></div>
        <div class="na-trk-r"><div class="na-werte">${Object.entries(t.werte).map(([w, v]) => `<span>${esc(w)}</span><span class="na-bar"><i style="width:${v * 5}%"></i></span><b>${v}</b>`).join('')}</div>
          <div class="na-k">${t.liz < 4 ? `<button type="button" class="app-knopf" data-na-fb="${b}"${fb ? ' disabled' : ''}>${fb ? 'Fortbildung läuft' : 'Fortbildung (' + CFG.fortbWochen + ' Wo.)'}</button>` : ''}
            ${b === 'leist' ? `<button type="button" class="app-knopf" data-na-hoch="${b}"${t.liz >= 3 ? '' : ' disabled title="braucht die A-Lizenz"'}>Zu den Profis befördern</button>` : `<button type="button" class="app-knopf" data-na-auf="${b}">Aufrücken</button>`}
            <button type="button" class="app-knopf" data-na-ers="${b}">${offenErsetzen === b ? 'Schließen' : 'Ersetzen'}</button></div>
          ${offenErsetzen === b ? `<div class="na-kand">${(a.kand[b] || []).map(k => `<div><span><b>${esc(k.vorname + ' ' + k.name)}</b> ${k.alter} J. · ${esc(k.fokus)} · ${CFG.lizenzen[k.liz]}-Lizenz</span>${sterneHtml(k.sterne, 5)}<button type="button" class="app-knopf" data-na-hol="${b}|${k.id}">Holen</button></div>`).join('') || '<small>Keine Kandidaten mehr in dieser Saison.</small>'}<small>Gehälter laufen über den Trainer-Anteil deines NLZ-Budgets – mehr Budget, bessere Kandidaten (neu zu jeder Saison).</small></div>` : ''}</div>
      </section>`;
    }).join('')}</div>
      <div class="nz-kasten nz-um"><b>Wirkung:</b> Der Leistungstrainer hebt die Entwicklung der Akademie (${(x => (x >= 0 ? '+' : '−') + Math.abs(x))(4 * ((a.trainer.leist || {}).sterne - 2))} %), der Aufbautrainer bringt Spätzünder, der Grundlagentrainer hält die Kinder bei der Stange (weniger Abbrecher).
        Fortbildungen gleichzeitig: ${fortbPlaetze(n)} (zwei ab hohem Trainerbudget). Volle Erfahrung = ein Stern mehr.</div>`;
    return h;
  }
  function klickAusbau(ev, n) {
    const p = ev.target.closest('[data-na-p]'); if (p) { starten(n, p.getAttribute('data-na-p')); return true; }
    return false;
  }
  function klickTrainer(ev, n) {
    const t = ev.target;
    const fb = t.closest('[data-na-fb]'); if (fb) { fortbildung(n, fb.getAttribute('data-na-fb')); return true; }
    const au = t.closest('[data-na-auf]'); if (au) { aufruecken(n, au.getAttribute('data-na-auf')); return true; }
    const ho = t.closest('[data-na-hoch]'); if (ho) { befoerdern(n, ho.getAttribute('data-na-hoch')); return true; }
    const er = t.closest('[data-na-ers]'); if (er) { const b = er.getAttribute('data-na-ers'); offenErsetzen = offenErsetzen === b ? null : b; return true; }
    const hl = t.closest('[data-na-hol]'); if (hl) { const [b, id] = hl.getAttribute('data-na-hol').split('|'); ersetzen(n, b, id); offenErsetzen = null; return true; }
    const an = t.closest('[data-na-ang]'); if (an) { angebotEntscheiden(n, an.getAttribute('data-na-ang')); return true; }
    return false;
  }

  const CSS = `
#view-nlz .na-ziel { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 18px; align-items: center; padding: 12px 16px; margin-bottom: 14px; }
#view-nlz .na-st { font-size: 30px; display: inline-flex; gap: 2px; color: #d39b1c; white-space: nowrap; vertical-align: -3px; } #view-nlz .na-st i.aus { color: var(--k-linie, var(--border)); }
#view-nlz .na-trk .na-st, #view-nlz .na-kand .na-st { font-size: 14px; letter-spacing: 1px; }
#view-nlz .na-etikett { font-size: 10.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--text3); }
#view-nlz .na-bed { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 5px; }
#view-nlz .na-bed span { font-size: 12.5px; font-weight: 800; padding: 3px 10px; border-radius: 999px; border: 1px solid var(--k-linie, var(--border)); }
#view-nlz .na-bed .ok { background: color-mix(in srgb, #2e9a4b 16%, transparent); border-color: #2e9a4b; } #view-nlz .na-bed .offen { color: var(--text2); }
#view-nlz .na-zz { display: flex; gap: 20px; text-align: right; } #view-nlz .na-zz div { display: grid; } #view-nlz .na-zz small { font-size: 11px; font-weight: 800; color: var(--text3); }
#view-nlz .na-zz b { font-family: var(--font-display, inherit); font-size: 19px; }
#view-nlz .na-baum { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; align-items: start; }
#view-nlz .na-strang { padding-bottom: 10px; } #view-nlz .na-strang > p { margin: 8px 12px; font-size: 12.5px; color: var(--text2); }
#view-nlz .na-knoten { margin: 8px 10px 0; border: 1px solid var(--k-linie, var(--border)); border-radius: 11px; padding: 8px 11px; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 3px 8px; }
#view-nlz .na-knoten > b { font-size: 13.5px; } #view-nlz .na-knoten > small { grid-column: 1 / -1; font-size: 12px; color: var(--text2); line-height: 1.4; }
#view-nlz .na-zst { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; color: var(--text3); }
#view-nlz .na-knoten.fertig { background: color-mix(in srgb, #2e9a4b 10%, transparent); border-color: #2e9a4b; } #view-nlz .na-knoten.fertig .na-zst { color: #2e9a4b; }
#view-nlz .na-knoten.lauf, #view-nlz .na-knoten.abo { border-color: var(--k-blau-knopf, #2f6fca); box-shadow: inset 3px 0 0 var(--k-blau-knopf, #2f6fca); } #view-nlz .na-knoten.lauf .na-zst, #view-nlz .na-knoten.abo .na-zst { color: var(--k-blau-knopf, #2f6fca); }
#view-nlz .na-knoten.gesperrt { opacity: .6; }
#view-nlz .na-fort { grid-column: 1 / -1; height: 7px; border-radius: 4px; background: var(--k-linie, var(--border)); overflow: hidden; } #view-nlz .na-fort i { display: block; height: 100%; background: var(--k-blau-knopf, #2f6fca); }
#view-nlz .na-knoten .na-rest { font-weight: 800; }
#view-nlz .na-k { grid-column: 1 / -1; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 4px; } #view-nlz .na-k span { font-size: 12px; font-weight: 800; color: var(--text2); }
#view-nlz .na-angebot { padding: 12px 16px; margin-bottom: 14px; display: flex; flex-direction: column; gap: 4px; border-color: #c0392b; box-shadow: inset 4px 0 0 #c0392b; }
#view-nlz .na-angebot span { font-size: 13px; color: var(--text2); }
#view-nlz .na-trainer { display: flex; flex-direction: column; gap: 14px; }
#view-nlz .na-trk { display: grid; grid-template-columns: 76px minmax(0, 1fr) minmax(0, 380px); gap: 16px; padding: 14px; align-items: start; }
#view-nlz .na-g { width: 76px; height: 76px; border-radius: 14px; overflow: hidden; background: var(--bg3, rgba(0,0,0,.05)); } #view-nlz .na-g svg { width: 100%; height: 100%; display: block; }
#view-nlz .na-trk h2 { margin: 2px 0; font-family: var(--font-display, inherit); font-size: 21px; } #view-nlz .na-unter { font-size: 13px; color: var(--text2); }
#view-nlz .na-chips { display: flex; gap: 5px; margin-top: 6px; } #view-nlz .na-chips span { font-size: 11.5px; font-weight: 800; padding: 2px 9px; border-radius: 999px; background: color-mix(in srgb, #d39b1c 22%, transparent); }
#view-nlz .na-xp { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 8px; align-items: center; font-size: 12px; font-weight: 800; color: var(--text2); margin-top: 8px; }
#view-nlz .na-bar { height: 8px; border-radius: 4px; background: var(--k-linie, var(--border)); overflow: hidden; display: block; } #view-nlz .na-bar i { display: block; height: 100%; background: #d39b1c; }
#view-nlz .na-liz, #view-nlz .na-kar { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; align-items: center; }
#view-nlz .na-liz span, #view-nlz .na-kar span { font-size: 11.5px; font-weight: 800; padding: 2px 8px; border-radius: 7px; border: 1px solid var(--k-linie, var(--border)); color: var(--text3); }
#view-nlz .na-liz .ok { color: #fff; background: #2e9a4b; border-color: #2e9a4b; } #view-nlz .na-liz .lauf { border-color: var(--k-blau-knopf, #2f6fca); color: var(--k-blau-knopf, #2f6fca); }
#view-nlz .na-kar .da { color: #fff; background: var(--k-blau-knopf, #2f6fca); border-color: var(--k-blau-knopf, #2f6fca); } #view-nlz .na-kar .war { color: var(--text2); } #view-nlz .na-kar em { font-style: normal; color: var(--text3); }
#view-nlz .na-werte { display: grid; grid-template-columns: 120px minmax(0, 1fr) 26px; gap: 5px 8px; align-items: center; font-size: 12.5px; } #view-nlz .na-werte b { text-align: right; }
#view-nlz .na-werte .na-bar i { background: var(--k-blau-knopf, #2f6fca); }
#view-nlz .na-kand { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; padding-top: 8px; border-top: 1px dashed var(--k-linie, var(--border)); }
#view-nlz .na-kand > div { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 8px; align-items: center; font-size: 12.5px; } #view-nlz .na-kand small { color: var(--text3); font-size: 11.5px; } #view-nlz .na-kand .app-knopf { padding: 4px 12px; min-height: 0; font-size: 12.5px; }
@media (max-width: 1450px) { #view-nlz .na-baum { grid-template-columns: minmax(0, 1fr); } #view-nlz .na-trk { grid-template-columns: 76px minmax(0, 1fr); } #view-nlz .na-trk-r { grid-column: 1 / -1; } }
`;
  function cssEinbauen() { if (document.getElementById('na-css')) return; const st = document.createElement('style'); st.id = 'na-css'; st.textContent = CSS; document.head.appendChild(st); }

  N.erweitern({
    tab: { id: 'ausbau', name: 'Ausbau', html: n => { cssEinbauen(); return ausbauHtml(n); }, klick: klickAusbau },
    faktor, summe: (art, n) => (art === 'plaetze' && n && n.ausbau && n.ausbau.fertig.internat2 ? 1 : 0),
    woche: n => woche(n), saison: n => neueSaison(n)
  });
  N.erweitern({ tab: { id: 'trainer', name: 'Trainer', html: n => { cssEinbauen(); return trainerHtml(n); }, klick: klickTrainer } });
  W.KSNlzAusbau = { CFG, sterne: n => { n = n || (CLUB.welt && CLUB.welt.nlz); return n ? za(n).sterne : 0; }, z: () => { const n = N.z(); return n ? za(n) : null; } };
})();
