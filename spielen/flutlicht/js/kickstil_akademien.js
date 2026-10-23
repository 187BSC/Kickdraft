/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · AKADEMIEN  ·  v1   (Schritt B, Nutzer 2026-10-15: „Talente, die aus den Akademien kommen und gekauft werden
   können“ – „mach mal Schritt B“)
   ─────────────────────────────────────────────────────────────────────────
   Jeder Verein mit lebendem Kader (Erste bis Dritte Liga, kickstil_lebende_welt.js) hat eine eigene Akademie:
     · STUFE 1–10 aus der Vereinsstärke (beste Elf), wie die Akademie-Stufe im Vereinsblatt. Plätze wie die eigene
       Akademie (youthCapacityForLevel: 3–7), Talente 15–17 Jahre, erzeugt wie die eigenen (generateYouthProspects:
       Stärke 46 + 3 × Stufe, Potenzial-Wurf mit ~6 % Supertalent) – damit sind fremde und eigene Talente vergleichbar.
     · JEDE SAISON: Talente altern und entwickeln sich wie die eigenen (YouthDevelopment.developProspect); die besten ab 17
       rücken in den Profikader nach (statt eines erfundenen Talents in npc_kaderleben.js); wer mit 19 nicht hochkam, geht;
       freie Plätze werden mit 15-Jährigen aufgefüllt.
     · KAUFEN im Vereinsblatt (Reiter „Akademie“): im Transferfenster, Ablöse = Marktwert ohne Potenzial × (1 + 5 % je Punkt
       Luft nach oben), braucht einen freien Platz in der eigenen Akademie. Das Talent wechselt in CLUB.youthProspects und
       entwickelt sich dort weiter (Hochziehen ab 16 wie gewohnt).
   Zustand: CLUB.welt.akademien (Weltzustand – wird beim Karrierestart geleert) = { dataId: { stufe, talente: [...] } }.
   API: KSAkademien.fuer(dataId) · .kaufen(dataId, key) · .preis(p) · .saison() · .CFG
   Lädt nach kickstil_lebende_welt.js und kickstil_vereinsblatt.js, vor init_bootstrap.js.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const CFG = {
    hochAb: 17,            // ab diesem Alter in den Profikader
    gehtAb: 19,            // wer so alt ist und nicht hochkam, verlässt die Akademie
    neuAlter: [15, 16],    // Neuzugänge der Akademie
    // Talente wie die eigene Akademie, aber gedämpft: 56 Vereine bringen jedes Jahr Talente hervor – mit der eigenen
    // Formel hatte jedes Bayern-Talent Potenzial 86+ und nach 6 Saisons spielten Akademie-Spieler mit 93
    basis: 44, jeStufe: 2.5, potStufe: 0.6,
    // Ablöse (zur Abstimmung, siehe CLAUDE.md): Marktwert OHNE Potenzial × (1 + 5 % je Punkt Luft nach oben).
    // Der normale Marktwert gewichtet das Potenzial so stark, dass ein 15-Jähriger 71/96 153 Mio € gekostet hätte
    preisJePotPunkt: 0.05, preisMin: 25000,
    // Nutzer 2026-10-15: „hat immer damit zu tun, wie hoch Potenzial und Stärke sind und welcher Verein, weil Bayern nicht
    // verkaufen muss“ → Vereinsfaktor 1 + 12 % je Akademie-Stufe über 1 (Stufe 8 ≈ ×1,84), große Vereine geben
    // Juwelen (Potenzial ≥ 82) nur mit 50 % Aufschlag ab; kleine Vereine (Stufe ≤ 2) brauchen das Geld (×0,9)
    vereinJeStufe: 0.12, juwelAb: 82, juwelStufe: 7, juwelAufschlag: 1.5, kleinBis: 2, kleinRabatt: 0.9,
    // Nutzer 2026-10-17 („pass die Akademien ein bisschen an, der Spieler soll später trotzdem seine Themen haben – fair für alle“):
    // Langzeitlauf 50 Saisons: das Potenzial hing an der Akademie-Stufe, die Stufe an der Teamstärke – der beste Absolvent lag fast
    // immer über dem Team, Team und Stufe stiegen, Jahr für Jahr (Dritte Liga 61 → 70, Erste 80 → 88). Jetzt richtet sich das
    // Potenzial nach dem Niveau des Vereins (beste Elf): meist knapp darunter, jedes vierte leicht darüber, selten ein Juwel.
    // Ein leichter Anstieg bleibt (die Liga zieht mit der Zeit etwas an), aber ohne Spirale.
    pot: { normal: [-7, -2], gut: [0, 4], juwel: [6, 12], gutAb: 0.70, juwelAb: 0.94, mindestLuft: 3 },
    // 2026-10-22 (wie die Draft-Jahrgänge in Kickdraft: „immer variabel in seinen Talenten“): Jahrgangsform je Saison –
    // schwach halbiert die Juwelen (3 %), stark verdoppelt sie (12 %)
    form: [['schwach', 0.25, 0.97], ['normal', 0.5, 0.94], ['stark', 0.25, 0.88]]
  };
  function jahrgangForm() {
    if (!hatSpiel()) return null;
    const J = LEAGUE.ksJahrgang;
    if (J && J.saison === LEAGUE.season) return J;
    let x = Math.random(), f = CFG.form[1];
    for (const e of CFG.form) { if (x < e[1]) { f = e; break; } x -= e[1]; }
    LEAGUE.ksJahrgang = { saison: LEAGUE.season, form: f[0], juwelAb: f[2] };
    if (f[0] !== 'normal') try { if (typeof addNews === 'function') addNews('squad', f[0] === 'stark' ? 'Starker Talentjahrgang' : 'Dünner Talentjahrgang',
      f[0] === 'stark' ? 'Die Akademien melden ungewöhnlich viele Juwelen in diesem Jahrgang – jetzt lohnt sich der Blick auf fremde Talente.'
        : 'In den Akademien wachsen diesmal kaum Juwelen heran – wer eines hat, gibt es nicht her.'); } catch (e) { /* ohne Postfach */ }
    return LEAGUE.ksJahrgang;
  }
  const hatSpiel = () => { try { return typeof CLUB !== 'undefined' && CLUB && typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.tiers; } catch (e) { return false; } };
  const posOvr = p => typeof computeOvrFromAreas === 'function' ? computeOvrFromAreas(p) : Math.round((p.def + p.mid + p.att) / 3);
  const zufall = n => Math.floor(Math.random() * n);
  let folge = 0;

  function alle() {
    if (!CLUB.welt) CLUB.welt = {};
    if (!CLUB.welt.akademien) CLUB.welt.akademien = {};
    return CLUB.welt.akademien;
  }
  const kader = () => (CLUB.npcSquads || {});
  // Auslandsvereine (2026-10-16): Kader in CLUB.euroKader (euro_kader.js), Akademie erst beim ersten Blick (Vereinsblatt)
  const euroK = () => (CLUB.euroKader || {});
  const istEuro = id => !!(id && euroK()[id] && !kader()[id]);
  const kaderVon = id => kader()[id] || euroK()[id] || null;
  const euroClub = id => (window.EURO_CLUBS || []).find(c => c.id === id) || null;
  function niveauVon(dataId) {
    const k = kaderVon(dataId) || [];
    const top = k.map(posOvr).sort((a, b) => b - a).slice(0, 11);
    return top.length ? top.reduce((a, b) => a + b, 0) / top.length : 60;
  }
  function stufeVon(dataId) { return Math.max(1, Math.min(10, Math.round((niveauVon(dataId) - 52) / 4.5))); }
  const plaetze = st => typeof youthCapacityForLevel === 'function' ? youthCapacityForLevel(st) : 3 + Math.floor(st / 2);

  // ── Ein Talent (wie generateYouthProspects, app_main.js) ─────────────────
  function erzeuge(dataId, st, alter) {
    const baseOvr = Math.round(CFG.basis + st * CFG.jeStufe) + zufall(5);
    const pos = typeof pickRnd === 'function' && typeof POS_LIST !== 'undefined' ? pickRnd(POS_LIST) : 'ZM';
    const positions = typeof generatePositions === 'function' ? generatePositions(pos) : [pos];
    const ar = typeof generateAreaRatings === 'function' ? generateAreaRatings(positions, baseOvr) : { def: baseOvr, mid: baseOvr, att: baseOvr };
    const pm = typeof genAttributes === 'function' ? genAttributes(pos, baseOvr) : { pace: 60, mental: 55 };
    const vor = typeof GERMAN_FIRST !== 'undefined' ? GERMAN_FIRST : ['Max'], nach = typeof TRANSFER_SURNAMES !== 'undefined' ? TRANSFER_SURNAMES : ['Neumann'];
    let ec = istEuro(dataId) && typeof window.euroName === 'function' ? window.euroName((euroClub(dataId) || {}).country) : null;
    // 2026-10-16 (kickstil_nationen.js): gute Akademien holen Talente aus aller Welt – Stufe 10 gut jedes vierte
    if (window.KSNationen) {
      const heimat = istEuro(dataId) ? ((euroClub(dataId) || {}).country || 'Deutschland') : 'Deutschland';
      const l = KSNationen.talentLand(st, heimat);
      ec = l === heimat ? (istEuro(dataId) ? KSNationen.name(heimat) : null) : KSNationen.name(l);
    }
    const key = 'ak:' + dataId + ':' + (LEAGUE.season || 1) + ':' + Date.now().toString(36) + ':' + (folge++);
    const p = { key, id: 'ak_' + key.replace(/[^a-z0-9]/gi, '_'), name: ec ? ec.name : nach[zufall(nach.length)], firstName: ec ? ec.firstName : vor[zufall(vor.length)],
      flag: ec ? ec.flag : '🇩🇪', country: ec ? ec.country : 'Deutschland', age: alter, pos, positions, def: ar.def, mid: ar.mid, att: ar.att,
      pace: pm.pace != null ? pm.pace : pm.p, mental: pm.mental != null ? pm.mental : pm.m, gamesPlayed: 0, seed: zufall(997) };
    p.ovr = posOvr(p);
    const roll = Math.random(), P = CFG.pot, niv = niveauVon(dataId), J = jahrgangForm(), juwelAb = J ? J.juwelAb : P.juwelAb;
    const [lo, hi] = roll >= juwelAb ? P.juwel : roll >= P.gutAb ? P.gut : P.normal;
    p.truePotential = Math.min(96, Math.max(p.ovr + P.mindestLuft, Math.round(niv + lo + Math.random() * (hi - lo))));
    return p;
  }
  function auffuellen(dataId, a) {
    const n = plaetze(a.stufe);
    while (a.talente.length < n) a.talente.push(erzeuge(dataId, a.stufe, CFG.neuAlter[0] + zufall(CFG.neuAlter[1] - CFG.neuAlter[0] + 1)));
  }
  // Akademie eines Vereins (legt sie beim ersten Blick an; Start mit gemischten Jahrgängen 15–17)
  function fuer(dataId) {
    if (!hatSpiel() || !dataId || !kaderVon(dataId) || dataId === CLUB.dataClubId) return null;
    const A = alle();
    if (!A[dataId]) {
      const st = stufeVon(dataId), a = { stufe: st, saison: LEAGUE.season, talente: [] };
      for (let i = 0, n = plaetze(st); i < n; i++) a.talente.push(erzeuge(dataId, st, 15 + zufall(3)));
      A[dataId] = a;
    }
    return A[dataId];
  }

  // ── Saison: altern, entwickeln (über npc_kaderleben.js) und nachrücken ─────
  // Merker im Akademie-Objekt (Spielstand), nicht im Modul: sonst überlebte er einen Karrierewechsel ohne Neuladen und die
  // neue Karriere übersprang das erste Akademiejahr (2026-10-16)
  function akademieJahr(dataId) {
    const a = fuer(dataId);
    if (!a || a.entw === LEAGUE.season) return;
    a.entw = LEAGUE.season;
    const dev = window.YouthDevelopment && YouthDevelopment.developProspect;
    a.talente.forEach(p => { if (dev) dev(p, a.stufe); else p.age++; p.ovr = posOvr(p); });
  }
  // Bestes Talent ab 17 in den Profikader (Format der NPC-Kader); null → npc_kaderleben erzeugt selbst eines
  function nachwuchs(dataId) {
    const a = fuer(dataId);
    if (!a) return null;
    const kand = a.talente.filter(p => p.age >= CFG.hochAb).sort((x, y) => (y.truePotential + posOvr(y)) - (x.truePotential + posOvr(x)))[0];
    if (!kand) return null;
    a.talente.splice(a.talente.indexOf(kand), 1);
    return { firstName: kand.firstName, name: kand.name, flag: kand.flag, country: kand.country, age: kand.age, pos: kand.pos,
      positions: kand.positions, def: kand.def, mid: kand.mid, att: kand.att, ovr: Math.round((kand.def + kand.mid + kand.att) / 3),
      truePotential: Math.max(posOvr(kand), kand.truePotential), clubId: dataId, eigengewaechs: true, ausAkademie: true };
  }
  // Auslandsverein: bestes Talent ab 17 in den Euro-Kader (schlankes Format wie euro_kader.js)
  function nachwuchsEuro(id) {
    if (!alle()[id]) return null;
    const n = nachwuchs(id);
    if (!n) return null;
    return { id: id + '_ak_' + Math.floor(Math.random() * 1e6).toString(36), firstName: n.firstName, name: n.name, flag: n.flag, country: n.country,
      age: n.age, pos: n.pos, def: n.def, mid: n.mid, att: n.att, ovr: n.ovr, truePotential: n.truePotential, clubId: id, eigen: 1 };
  }
  function saison() {
    if (!hatSpiel()) return;
    Object.keys(euroK()).forEach(id => {                       // nur angelegte Auslandsakademien (Speicher schlank)
      const a = alle()[id];
      if (!a || !istEuro(id)) return;
      akademieJahr(id);
      a.talente = a.talente.filter(p => p.age < CFG.gehtAb);
      a.stufe = stufeVon(id); a.saison = LEAGUE.season;
      auffuellen(id, a);
    });
    Object.keys(kader()).forEach(dataId => {
      const a = fuer(dataId);
      if (!a) return;
      akademieJahr(dataId);                                     // falls npc_kaderleben den Verein nicht anfasste
      a.talente = a.talente.filter(p => p.age < CFG.gehtAb);    // nicht hochgekommen → anderer Verein
      a.stufe = stufeVon(dataId); a.saison = LEAGUE.season;
      auffuellen(dataId, a);
    });
  }
  if (window.NpcKaderleben) { NpcKaderleben.akademieJahr = akademieJahr; NpcKaderleben.nachwuchs = nachwuchs; }
  if (typeof window.runEndOfSeason === 'function') {
    const _end = window.runEndOfSeason;
    window.runEndOfSeason = function () {
      const r = _end.apply(this, arguments);
      try { saison(); } catch (e) { console.warn('[Kickstil-Akademien] Saison', e); }
      return r;
    };
    try { runEndOfSeason = window.runEndOfSeason; } catch (e) { /* window reicht */ }
  }

  // ── Kaufen ─────────────────────────────────────────────────────────────────
  const vereinVon = p => (String(p.key || '').split(':')[1]) || null;
  function preisInfo(p) {
    const o = posOvr(p), ohnePot = Object.assign({}, p, { truePotential: o });
    const w = typeof computeMarketValue === 'function' ? computeMarketValue(ohnePot) : o * 20000;
    let roh = w * (1 + CFG.preisJePotPunkt * Math.max(0, (p.truePotential || o) - o)), hinweis = '';
    const a = vereinVon(p) && alle()[vereinVon(p)], st = a ? a.stufe : 1;
    roh *= 1 + CFG.vereinJeStufe * (st - 1);
    if (st >= CFG.juwelStufe && (p.truePotential || 0) >= CFG.juwelAb) { roh *= CFG.juwelAufschlag; hinweis = 'Juwel – der Verein muss nicht verkaufen'; }
    else if (st <= CFG.kleinBis) { roh *= CFG.kleinRabatt; hinweis = 'kleiner Verein, braucht das Geld'; }
    return { preis: Math.max(CFG.preisMin, typeof roundMarketValue === 'function' ? roundMarketValue(roh) : Math.round(roh)), hinweis };
  }
  const preis = p => preisInfo(p).preis;
  const euro = v => typeof formatEuro === 'function' ? formatEuro(v) : Math.round(v).toLocaleString('de-DE') + ' €';
  const hinweis = (t, art) => { if (typeof window.showToast === 'function') window.showToast(t, art || 'info'); else alert(t); };
  function eigeneFrei() {
    const lvl = (CLUB.facilities && CLUB.facilities.youth) || 1;
    return plaetze(lvl) - ((CLUB.youthProspects || []).length);
  }
  // Prüft nur (für den Knopf): null = möglich, sonst Grund
  function grund(p) {
    if (typeof isTransferWindowOpen === 'function' && !isTransferWindowOpen()) return 'Transferfenster zu';
    if (eigeneFrei() <= 0) return 'Akademie voll';
    if ((CLUB.budget || 0) < preis(p)) return 'Budget zu knapp';
    return null;
  }
  function kaufen(dataId, key) {
    const a = fuer(dataId);
    const p = a && a.talente.find(x => x.key === key);
    if (!p) return false;
    const g = grund(p);
    if (g === 'Transferfenster zu') { hinweis('Das Transferfenster ist geschlossen. Talente kaufst du im Sommer (Wochen 1–9) und im Winter.', 'warn'); return false; }
    if (g === 'Akademie voll') { hinweis('Deine Akademie ist voll. Mach einen Platz frei (Talent hochziehen oder entlassen) oder baue sie aus.', 'warn'); return false; }
    const kosten = preis(p);
    if (g === 'Budget zu knapp') { hinweis(`Nicht genug Transferbudget: ${euro(kosten)} nötig, ${euro(CLUB.budget || 0)} verfügbar.`, 'warn'); return false; }
    const nm = (p.firstName ? p.firstName + ' ' : '') + p.name;
    const verein = (() => { try { const c = (window.EMBEDDED_CLUBS || []).find(x => x.id === dataId) || euroClub(dataId); const n = c ? c.name : dataId; return window.KSVereinsnamen ? KSVereinsnamen.text(n) : n; } catch (e) { return dataId; } })();
    if (!confirm(`${nm} (${p.age} J, ${p.pos}) aus der Akademie von ${verein} für ${euro(kosten)} holen?`)) return false;   // Nutzer 2026-10-22: überflüssiger Text raus („Er kommt in deine Akademie und entwickelt sich dort weiter.“)
    CLUB.budget -= kosten;
    a.talente.splice(a.talente.indexOf(p), 1);
    const neu = Object.assign({}, p, { id: 'youth_kauf_' + LEAGUE.season + '_' + Date.now().toString(36), gekauftVon: dataId });
    delete neu.key;
    neu.value = typeof computeMarketValue === 'function' ? computeMarketValue(neu) : kosten;
    try { if (typeof assignBirthday === 'function') assignBirthday(neu); } catch (e) { /* ohne Geburtstag */ }
    if (!CLUB.youthProspects) CLUB.youthProspects = [];
    CLUB.youthProspects.push(neu);
    if (!Array.isArray(CLUB.transferHistory)) CLUB.transferHistory = [];
    CLUB.transferHistory.unshift({ type: 'buy', name: p.name, amount: kosten, season: LEAGUE.season, akademie: true });
    if (typeof addNews === 'function') addNews('transfer', '🌱 Talent verpflichtet', `${nm} (${p.age}, ${p.pos}) wechselt aus der Akademie von ${verein} in deine Nachwuchsabteilung. Ablöse: ${euro(kosten)}.`);
    try { if (typeof renderClubTab === 'function') renderClubTab(); } catch (e) { /* Ansicht optional */ }
    try { if (typeof saveGameState === 'function') saveGameState(); } catch (e) { /* später */ }
    hinweis(`${nm} ist in deiner Akademie`, 'success');
    return true;
  }

  window.KSAkademien = { fuer, kaufen, preis, preisInfo, grund, saison, nachwuchs, nachwuchsEuro, akademieJahr, stufeVon, CFG };
  console.log('[Kickstil-Akademien v1] aktiv — Akademie je Verein (Stufe aus der Stärke), Talente rücken nach, kaufbar im Vereinsblatt');
})();
