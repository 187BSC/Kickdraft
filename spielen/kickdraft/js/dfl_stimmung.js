/* ═══════════════════════════════════════════════════════════════════════════
   DFL-STIMMUNG  ·  v1   (Spieltiefe nach Football GM, analyse-football-gm.md G1/G2)
   ─────────────────────────────────────────────────────────────────────────
   Warum will ein Spieler bleiben oder gehen? Die Stimmung setzt sich aus
   sichtbaren Gründen zusammen (Teamerfolg, Hype, Bühne, Anlagen, Rolle,
   Gehalt, Vereinsjahre, Unruhe, Rookie-Vertrag). Gewichtet wird mit dem
   Verhandlungsprofil (Geld · Titel · Treue · Sicherheit) plus dem neuen Wert
   „Bühne“ (bei Football GM „Fame“), der aus Traits, Alter und Stärke folgt.

   Ergebnis: Summe, Einzelgründe, Verlängerungsbereitschaft und ein Faktor auf
   die Gehaltsforderung (zufriedene Spieler fordern weniger).
   Teamwerte je Saison: hype, erfolg, anlagenVerlauf (3 Saisons), unruhe.

   Braucht: js/dfl_liga_generator.js. Noch NICHT in index.html eingehängt.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const G = window.DFLGenerator;
  if (!G) { console.warn('[DFL-Stimmung] DFLGenerator fehlt'); return; }

  // Alle Zahlen zur Diskussion (Arbeitsregel 5): Summe ≈ −5 … +5
  const CFG = {
    bereit: 2.0,            // ab hier: will verlängern
    offen: 0.5,             // ab hier: offen für Gespräche
    markt: -0.8,            // darunter: verweigert Gespräche
    neutral: 0.8,           // Liga-Median der Summe: hier fordert ein Spieler genau den Marktpreis
    faktorJePunkt: 0.035,   // Forderung −3,5 % je Punkt über/unter neutral …
    faktorMin: 0.92, faktorMax: 1.12,   // … höchstens −8 % / +12 %
    rookieBonus: 2.0,       // erster großer Vertrag beim eigenen Klub (Football GM: sehr stark)
    chanceSteilheit: 0.9,   // Verlängerungschance = 1 / (1 + e^(−0,9 · (Summe − neutral + 0,3)))
    anlagenJahre: 3         // Anlagen wirken über den Schnitt der letzten 3 Saisons (G2)
  };

  const klemme = (x, a, b) => Math.max(a, Math.min(b, x));
  const hat = (p, t) => (p.traits || []).indexOf(t) >= 0;
  const mio = x => (x / 1e6).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' Mio';
  function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  // ── Profil inkl. Bühne ───────────────────────────────────────────────────
  // Bühne braucht keinen Zufall aus dem Generator (Seeds der Liga bleiben gleich)
  function buehne(p) {
    if (p.vertragsprofil && typeof p.vertragsprofil.buehne === 'number') return p.vertragsprofil.buehne;
    let b = 35 + (p.ovr - 75) * 1.2 + (p.age <= 25 ? 8 : 0) - (p.age >= 31 ? 8 : 0);
    if (hat(p, 'medienpraesent')) b += 30;
    if (hat(p, 'diva')) b += 25;
    if (hat(p, 'publikumsliebling')) b += 10;
    if (hat(p, 'bescheiden')) b -= 20;
    b += (hash(String(p.id || p.name) + 'buehne') % 21) - 10;
    return klemme(Math.round(b), 0, 100);
  }
  function profil(p) {
    const v = p.vertragsprofil || { geld: 50, titel: 50, treue: 50, sicherheit: 50 };
    return { geld: v.geld, titel: v.titel, treue: v.treue, sicherheit: v.sicherheit, buehne: buehne(p) };
  }
  // Ausgeprägte Eigenschaften als Chips (wie F/L/$/W bei Football GM)
  const NAMEN = { geld: 'Geld', titel: 'Titel', treue: 'Treue', sicherheit: 'Sicherheit', buehne: 'Bühne' };
  function eigenschaften(p) {
    const v = profil(p);
    return Object.keys(NAMEN).filter(k => v[k] >= 70).sort((a, b) => v[b] - v[a]).map(k => ({ key: k, name: NAMEN[k], wert: v[k] }));
  }

  // ── Teamwerte ────────────────────────────────────────────────────────────
  function staerkeRang(L) {
    const rang = new Map();
    L.teams.slice().sort((a, b) => G.teamOvr(b) - G.teamOvr(a)).forEach((t, i) => rang.set(t.id, i + 1));
    return rang;
  }
  const marktGroesse = t => klemme(((t.anlagen ? t.anlagen.stadion : 30000) - 15000) / 65000, 0, 1);
  // Startwerte, falls noch keine Saison gespielt ist
  function initialisiere(L) {
    // schon gesetzt: nichts zu tun (stimmung() ruft das je Spieler – der Stärke-Rang kostet 32 Startelf-Rechnungen, D99 fragt alle Spieler)
    if (L.teams.every(t => t.erfolg != null && t.hype != null && t.anlagenVerlauf && t.unruhe != null)) return;
    const rang = staerkeRang(L);
    L.teams.forEach(t => {
      const r = rang.get(t.id);
      if (t.erfolg == null) t.erfolg = klemme(1 - (r - 1) / 31, 0, 1);
      if (t.hype == null) t.hype = klemme(0.35 + 0.3 * (1 - r / 32) + 0.15 * marktGroesse(t), 0, 1);
      if (!t.anlagenVerlauf) t.anlagenVerlauf = [Object.assign({}, t.anlagen)];
      if (t.unruhe == null) t.unruhe = 0;
    });
  }
  // Nach der Saison (vor dem Saisonwechsel): Erfolg, Hype, Anlagen-Verlauf, Kern merken
  function nachSaison(L, saison, po) {
    initialisiere(L);
    const rang = staerkeRang(L);
    const tab = Object.values(saison.tabelle);
    const platz = new Map(G && window.DFLSaison ? window.DFLSaison.sortiereTabelle(tab, saison.los).map((z, i) => [z.id, i + 1]) : []);
    L.teams.forEach(t => {
      const p = platz.get(t.id) || 16;
      const runde = po && po.ausgeschieden[t.id];         // 1–4 ausgeschieden, 5 Meister
      const neu = klemme(1 - (p - 1) / 31 + (runde ? 0.04 * runde : 0) + (runde === 5 ? 0.1 : 0), 0, 1);
      t.erfolg = klemme(0.4 * t.erfolg + 0.6 * neu, 0, 1);
      const ueber = (rang.get(t.id) - p) / 31;             // besser als erwartet → mehr Hype
      t.hype = klemme(0.6 * t.hype + 0.4 * (0.45 + ueber + (runde === 5 ? 0.3 : runde ? 0.1 : 0)), 0, 1);
      t.anlagenVerlauf = (t.anlagenVerlauf || []).concat([Object.assign({}, t.anlagen)]).slice(-CFG.anlagenJahre);
      t._kern = t.roster.slice().sort((a, b) => b.ovr - a.ovr).slice(0, 5).map(x => x.id);
    });
  }
  // Nach dem Saisonwechsel: Wer aus dem Kern ist weg (ohne Karriereende)?
  function nachWechsel(L, st) {
    const ruhestand = new Set(((st && st.ruhestandListe) || []).map(p => p.id));
    L.teams.forEach(t => {
      if (!t._kern) return;
      const da = new Set(t.roster.map(p => p.id));
      t.unruhe = t._kern.filter(id => !da.has(id) && !ruhestand.has(id)).length;
      delete t._kern;
    });
  }

  // ── Stimmung eines Spielers gegenüber einem Team ─────────────────────────
  // opt.rang (Map, sonst berechnet) · für ein fremdes Team: Free-Agency-Sicht
  // opt.elf / opt.spieltag (D99): Startelf- und Spieltags-IDs des eigenen Vereins, einmal je Verein gerechnet statt je Spieler
  function stimmung(p, team, L, opt) {
    opt = opt || {};
    initialisiere(L);
    const v = profil(p), w = k => v[k] / 100;
    const eigen = p.teamId === team.id;
    const teile = [];
    const teil = (key, name, wert, text) => { if (Math.abs(wert) >= 0.05) teile.push({ key, name, wert: Math.round(wert * 10) / 10, text }); };

    // 1) Teamerfolg – zählt für Titeljäger doppelt
    const erf = team.erfolg;
    teil('erfolg', 'Teamerfolg', (erf - 0.5) * 4 * (0.4 + 0.8 * w('titel')),
      erf >= 0.75 ? 'Spitzenteam' : erf >= 0.55 ? 'erfolgreiches Team' : erf >= 0.4 ? 'Mittelmaß' : 'Team im Keller');
    // 2) Hype im Umfeld
    teil('hype', 'Hype', (team.hype - 0.5) * 2 * (0.3 + 0.9 * w('buehne')),
      team.hype >= 0.65 ? 'Euphorie in der Stadt' : team.hype >= 0.45 ? 'normale Stimmung' : 'Umfeld ist frustriert');
    // 3) Bühne: Markt/Stadion
    const m = marktGroesse(team);
    teil('markt', 'Bühne', (m - 0.4) * 2 * w('buehne'),
      (team.anlagen ? team.anlagen.stadion.toLocaleString('de-DE') : '?') + ' Plätze');
    // 4) Anlagen: Schnitt der letzten 3 Saisons (G2)
    const verlauf = team.anlagenVerlauf && team.anlagenVerlauf.length ? team.anlagenVerlauf : [team.anlagen || { training: 5 }];
    const a = verlauf.reduce((s, x) => s + (x.training || 5), 0) / verlauf.length / 10;
    teil('anlagen', 'Anlagen', (a - 0.5) * 1.5, 'Trainingszentrum Ø Stufe ' + (a * 10).toFixed(1).replace('.', ',') + ' (letzte ' + verlauf.length + ' Saisons)');
    // 5) Rolle: Startelf? Bei fremdem Team: würde er dort spielen?
    const kader = eigen ? team.roster : team.roster.concat([p]);
    const elf = eigen && opt.elf ? opt.elf : new Set(G.startelfVon(kader, team).map(x => x.id));
    const spieltag = eigen && opt.spieltag ? opt.spieltag : new Set(kader.slice().sort((x, y) => y.ovr - x.ovr).slice(0, 18).map(x => x.id));
    const rolle = elf.has(p.id) ? 0.8 : spieltag.has(p.id) ? 0 : -1;
    const jungeBank = rolle < 0 && p.age <= 23 && (G.potSichtbar ? G.potSichtbar(p) : p.truePotential) - p.ovr >= 6 ? -0.5 : 0;
    teil('rolle', 'Rolle', rolle * (0.5 + w('buehne')) + jungeBank,
      rolle > 0 ? (eigen ? 'Stammspieler' : 'wäre Stammspieler') : rolle === 0 ? 'Rotation' : (eigen ? 'kaum Einsätze' : 'hätte kaum Einsätze'));
    // 6) Gehalt (nur beim eigenen Verein: fühlt er sich fair bezahlt?)
    if (eigen && p.contract) {
      const markt = G.marktgehalt(p), hit = G.capHitSpieler(p), q = hit / Math.max(1, markt);
      if (p.contract.art !== 'rookie') {
        teil('gehalt', 'Gehalt', klemme((q - 1) * 3, -1.5, 1) * (0.3 + w('geld')),
          q < 0.85 ? 'fühlt sich unterbezahlt (' + mio(hit) + ' statt ~' + mio(markt) + ')' : q > 1.15 ? 'gut bezahlt' : 'fair bezahlt');
      }
    }
    // 7) Treue: Vereinsjahre, Heimat
    if (eigen) {
      const c = p.contract;
      const jahre = p.vereinsJahre != null ? p.vereinsJahre : (c ? c.years_total - c.years_remaining : 0) + (hash(String(p.id)) % 3);
      if (jahre > 0) teil('treue', 'Vereinsjahre', Math.min(2, jahre * 0.3) * w('treue'), 'seit ' + jahre + (jahre === 1 ? ' Jahr' : ' Jahren') + ' im Verein');
    }
    if (hat(p, 'heimatverbunden') && p.heimat && p.heimat === team.city) teil('heimat', 'Heimat', 0.8, 'spielt in seiner Heimatstadt');
    // 8) Unruhe: Leistungsträger abgegeben
    if (team.unruhe) teil('unruhe', 'Unruhe', -0.5 * team.unruhe * (0.3 + w('titel')), team.unruhe + ' Leistungsträger abgegeben');
    // 9) Familie: Bruder/Vater im Team (Football GM: +2 je Verwandtem)
    if (p.verwandt && team.roster.some(x => x.id === p.verwandt.id && x.id !== p.id)) teil('familie', 'Familie', 1.0, p.verwandt.art + ' ' + p.verwandt.name + ' im Team');
    // 10) Rookie-Vertrag: will den ersten großen Vertrag beim eigenen Klub
    if (eigen && p.contract && p.contract.art === 'rookie') teil('rookie', 'Rookie-Vertrag', CFG.rookieBonus, 'erster großer Vertrag winkt');

    const summe = Math.round(teile.reduce((s, x) => s + x.wert, 0) * 10) / 10;
    let bereitschaft;
    if (summe >= CFG.bereit) bereitschaft = { key: 'bereit', text: eigen ? 'Will verlängern' : 'Sehr interessiert' };
    else if (summe >= CFG.offen) bereitschaft = { key: 'offen', text: eigen ? 'Offen für Gespräche' : 'Interessiert' };
    else if (summe >= CFG.markt) bereitschaft = { key: 'markt', text: eigen ? 'Will den Markt testen' : 'Eher skeptisch' };
    else bereitschaft = { key: 'nein', text: eigen ? 'Verweigert Gespräche' : 'Kein Interesse' };
    const faktor = klemme(1 - CFG.faktorJePunkt * (summe - CFG.neutral), CFG.faktorMin, CFG.faktorMax);
    // Chance in Prozent (wie bei Football GM sichtbar); „verweigert“ = höchstens 15 %
    const chance = bereitschaft.key === 'nein' ? Math.min(0.15, 1 / (1 + Math.exp(-CFG.chanceSteilheit * (summe - CFG.neutral + 0.3))))
      : 1 / (1 + Math.exp(-CFG.chanceSteilheit * (summe - CFG.neutral + 0.3)));
    teile.sort((x, y) => Math.abs(y.wert) - Math.abs(x.wert));
    return { summe, teile, bereitschaft, faktor, chance: Math.round(chance * 100), eigenschaften: eigenschaften(p) };
  }

  // Forderung inkl. Stimmung (zufriedene Spieler fordern weniger)
  function forderung(p, team, L, ctx) {
    const s = stimmung(p, team, L);
    const f = G.forderung(p, team, ctx);
    const jahresWert = Math.max(G.CFG.mindestgehalt, Math.round(f.jahresWert * s.faktor / 10000) * 10000);
    const prozent = Math.round((s.faktor - 1) * 100);
    const gruende = f.gruende.concat(prozent ? ['Stimmung ' + (prozent > 0 ? '+' : '−') + Math.abs(prozent) + ' %'] : []);
    return Object.assign({}, f, { jahresWert, gruende, stimmung: s, verweigert: p.teamId === team.id && s.bereitschaft.key === 'nein' });
  }

  // Wohin zieht es einen Spieler, wenn er den Markt testet? (beste n Teams)
  function wunschvereine(p, L, n) {
    return L.teams.filter(t => t.id !== p.teamId).map(t => ({ team: t, stimmung: stimmung(p, t, L) }))
      .sort((a, b) => b.stimmung.summe - a.stimmung.summe).slice(0, n || 3);
  }

  window.DFLStimmung = { CFG, profil, buehne, eigenschaften, stimmung, forderung, wunschvereine, initialisiere, nachSaison, nachWechsel };
  console.log('%c[DFL-Stimmung v1] aktiv', 'color:#3fb950;font-weight:bold',
    '— Stimmung mit Gründen, Verlängerungsbereitschaft, Hype, Anlagen über 3 Saisons');
})();
