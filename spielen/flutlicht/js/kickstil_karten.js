/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · SONDERKARTEN + SAMMLUNG  ·  v1   (Nutzer 2026-10-16: „Spieler der Saison oder Team of the Week bei einer super
   Performance und die Karte entsprechend anpassen vom Äußeren … eine Galerie mit allen Karten, die man gefunden hat, und man
   sehen kann, was es noch gibt und wie man sie sich erarbeiten kann … wie bei FIFA Ultimate Team, z. B. Halloween-Karten“)
   ─────────────────────────────────────────────────────────────────────────
   Kickdraft kennt nur die Stufen-Karten (Bronze … Legende, dfl_app_shell.js futKarte) – Sonderausgaben sind neu, nach dem
   Vorbild der FUT-Sonderkarten (TOTW, POTM, TOTS, Future Stars, Ultimate Scream, Winter Wildcards, Road to the Final, Icons,
   Moments, Flashback/Comeback, Hero) mit eigenen Namen und eigenem Aussehen.
   · Karten gibt es NUR für Leistung (nie gegen Geld), sie ändern keine Werte – die Karte ist eine Auszeichnung.
     Ausnahme seit 2026-10-22 (wie Kickdraft): Spieler des Monats +2 Stärke für die nächsten 4 Pflichtspiele (p._potmBonus).
   · Eigene Spieler bekommen sie im Spiel (processFixtureResult), zum Monatswechsel, zum Saisonabschluss
     (KSKarten.saisonAbschluss, von kickstil_saisonabschluss.js) und bei Meilensteinen.
   · Spieler-Blatt: die neueste Sonderkarte der laufenden Saison bestimmt das Aussehen der Karte (klasse(p)).
   · SAMMLUNG geräteweit (localStorage „fl-karten“, überlebt Karrieren und Spielstände): Galerie „Gesammelt“ und
     „Alle Karten“ (Katalog mit Anzahl, Seltenheit und wie man sie erspielt; noch nicht gefundene als Umriss).
   API: KSKarten.EDITIONEN · .vergeben(p, art, info) · .klasse(p) · .karteHtml(eintrag) · .oeffnen() · .saisonAbschluss(daten)
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const CFG = {
    totw: 8.2,            // Note für „Elf der Woche“ (Liga, Pokal, Europapokal)
    potw: 9.4,            // Note für „Spieler der Woche“ (oder 3+ Tore)
    potm: { spiele: 3, note: 7.6 },
    potmBonus: { w: 2, spiele: 4 },   // 2026-10-22 (Nutzer: Spieler des Monats „ja +2 macht Sinn“, auch in der Vereinskarriere)
    sds: { spiele: 15 },
    torjaeger: 8,         // mindestens so viele Saisontore
    pokalheld: 7.8, europa: 8.0, comeback: 7.5, comebackWochen: 10,
    ikone: 150,           // Pflichtspiele für den Verein
    sammlungMax: 600
  };
  // Seltenheit: 1 häufig … 5 extrem selten
  const E = [
    { art: 'totw', name: 'Elf der Woche', kurz: 'EDW', icon: 'ti-star', selten: 1, wie: `Bester Spieler eines Pflichtspiels mit Note ${CFG.totw.toLocaleString('de-DE')} oder besser.` },
    { art: 'potw', name: 'Spieler der Woche', kurz: 'SDW', icon: 'ti-medal', selten: 2, wie: `Bester Spieler eines Pflichtspiels mit Note ${CFG.potw.toLocaleString('de-DE')} oder besser – oder drei Tore.` },
    { art: 'hattrick', name: 'Hattrick-Moment', kurz: 'MOMENT', icon: 'ti-ball-football', selten: 3, wie: 'Drei Tore in einem Pflichtspiel.' },
    { art: 'zukunft', name: 'Zukunftsstar', kurz: 'ZUKUNFT', icon: 'ti-rocket', selten: 2, wie: 'Elf der Woche mit 21 Jahren oder jünger.' },
    { art: 'potm', name: 'Spieler des Monats', kurz: 'SDM', icon: 'ti-calendar-star', selten: 2, wie: `Bester Notenschnitt deiner Mannschaft im Monat (mind. ${CFG.potm.spiele} Spiele, Schnitt ${CFG.potm.note.toLocaleString('de-DE')}).` },
    { art: 'halloween', name: 'Gruselnacht', kurz: 'HALLOWEEN', icon: 'ti-pumpkin-scary', selten: 4, wie: 'Elf der Woche am letzten Oktober-Spieltag.' },
    { art: 'winter', name: 'Winterzauber', kurz: 'WINTER', icon: 'ti-snowflake', selten: 3, wie: 'Elf der Woche im Dezember (vor dem letzten Spiel vor Weihnachten).' },
    { art: 'weihnachten', name: 'Weihnachtself', kurz: 'WEIHNACHTEN', icon: 'ti-christmas-tree', selten: 4, wie: 'Elf der Woche im letzten Spiel vor Weihnachten.' },
    { art: 'held-cl', name: 'Champions-Cup-Held', kurz: 'CHAMPIONS', icon: 'ti-stars', selten: 4, wie: `Note ${CFG.europa.toLocaleString('de-DE')} oder besser im Champions Cup.` },
    { art: 'held-el', name: 'Europacup-Held', kurz: 'EUROPACUP', icon: 'ti-trophy', selten: 3, wie: `Note ${CFG.europa.toLocaleString('de-DE')} oder besser im Europacup.` },
    { art: 'held-co', name: 'Kontinentalcup-Held', kurz: 'KONTINENT', icon: 'ti-world', selten: 3, wie: `Note ${CFG.europa.toLocaleString('de-DE')} oder besser im Kontinentalcup.` },
    { art: 'pokalheld', name: 'Pokalheld', kurz: 'POKAL', icon: 'ti-cup', selten: 3, wie: `Note ${CFG.pokalheld.toLocaleString('de-DE')} oder besser im Pokal-Halbfinale oder -Finale.` },
    { art: 'derby', name: 'Derbyheld', kurz: 'DERBY', icon: 'ti-flame', selten: 3, wie: 'Elf der Woche in einem Derby.' },
    { art: 'comeback', name: 'Comeback', kurz: 'COMEBACK', icon: 'ti-arrow-back-up', selten: 3, wie: `Nach mindestens ${CFG.comebackWochen} Wochen Verletzung im ersten Spiel Note ${CFG.comeback.toLocaleString('de-DE')} oder besser.` },
    { art: 'eigengewaechs', name: 'Eigengewächs', kurz: 'DEBÜT', icon: 'ti-plant-2', selten: 2, wie: 'Pflichtspiel-Debüt eines Spielers aus deiner Akademie.' },
    { art: 'nationalspieler', name: 'Nationalspieler', kurz: 'NATIONAL', icon: 'ti-flag', selten: 3, wie: 'Erste Berufung in die Nationalmannschaft.' },
    { art: 'torjaeger', name: 'Torjäger der Saison', kurz: 'TORJÄGER', icon: 'ti-target-arrow', selten: 3, wie: `Bester Torschütze deiner Mannschaft mit mind. ${CFG.torjaeger} Saisontoren.` },
    { art: 'talent', name: 'Talent der Saison', kurz: 'TALENT', icon: 'ti-leaf', selten: 3, wie: 'Bester Spieler bis 21 Jahre in der Saison (mind. 10 Spiele).' },
    { art: 'sds', name: 'Spieler der Saison', kurz: 'SAISON', icon: 'ti-award', selten: 4, wie: `Bester Notenschnitt der Saison (mind. ${CFG.sds.spiele} Spiele).` },
    { art: 'aufstieg', name: 'Aufstiegsheld', kurz: 'AUFSTIEG', icon: 'ti-trending-up', selten: 4, wie: 'Die drei Besten einer Aufstiegssaison.' },
    { art: 'pokalsieger', name: 'Pokalsieger', kurz: 'POKALSIEG', icon: 'ti-trophy-filled', selten: 4, wie: 'Stammspieler, wenn du den Flutlichtpokal gewinnst.' },
    { art: 'meister', name: 'Meister', kurz: 'MEISTER', icon: 'ti-crown', selten: 4, wie: 'Stammspieler einer Meistersaison (mind. 10 Spiele).' },
    { art: 'ikone', name: 'Vereinsikone', kurz: 'IKONE', icon: 'ti-building-monument', selten: 5, wie: `${CFG.ikone} Pflichtspiele für deinen Verein.` }
  ];
  const ED = Object.fromEntries(E.map(e => [e.art, e]));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hatSpiel = () => { try { return typeof CLUB !== 'undefined' && CLUB && typeof LEAGUE !== 'undefined' && LEAGUE; } catch (e) { return false; } };
  const kader = () => { try { return Array.isArray(SQUAD) ? SQUAD : []; } catch (e) { return []; } };
  const voll = p => ((p.firstName || '') + ' ' + (p.name || '')).trim();
  const monat = w => (typeof calendarMonthOfWeek === 'function' ? calendarMonthOfWeek(w) : '');

  // ── Sammlung (geräteweit) ─────────────────────────────────────────────────
  const KEY = 'fl-karten';
  function sammlung() {
    try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && Array.isArray(s.karten)) return s; } catch (e) { /* neu */ }
    return { karten: [], neu: 0 };
  }
  function speichern(s) {
    if (s.karten.length > CFG.sammlungMax) s.karten = s.karten.slice(-CFG.sammlungMax);
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { console.warn('[Kickstil-Karten] Sammlung', e); }
  }

  // ── Vergeben ──────────────────────────────────────────────────────────────
  function achsenVon(p) { try { return window.DFLAppShell && DFLAppShell.achsen ? DFLAppShell.achsen(p) : []; } catch (e) { return []; } }
  function vergeben(p, art, info) { return vergebenEcht(p, art, info); }
  function vergebenEcht(p, art, info) {
    if (!p || !ED[art] || !hatSpiel()) return null;
    info = info || {};
    // Saisonkarten werden erst nach dem Saisonwechsel vergeben – dann kommen Saison/Woche/Startjahr der alten Saison aus info
    const s = info.s != null ? info.s : LEAGUE.season, w = info.w != null ? info.w : LEAGUE.week;
    const jahr = info.jahr != null ? info.jahr : (LEAGUE.startYear || 2026);
    if (!Array.isArray(p.karten)) p.karten = [];
    // eine Karte derselben Art je Spieler und Woche (Saison-/Einmal-Karten: je Saison bzw. einmal)
    const einmal = art === 'ikone' || art === 'eigengewaechs' || art === 'nationalspieler';
    const proSaison = ['sds', 'torjaeger', 'talent', 'aufstieg', 'pokalsieger', 'meister'].indexOf(art) >= 0;
    if (p.karten.some(k => k.art === art && (einmal || k.s === s && (proSaison || k.w === w)))) return null;
    p.karten.push({ art, s, w });
    const e = {
      art, s, w, id: p.id, seed: p.seed, name: p.name, firstName: p.firstName || '', flag: p.flag || '', pos: p.pos,
      positions: p.positions, age: p.age, ovr: p.ovr, def: p.def, mid: p.mid, att: p.att, pace: p.pace, mental: p.mental,
      ax: achsenVon(p), verein: CLUB.name || '', grund: info.grund || '', wann: (typeof calendarLabel === 'function' ? calendarLabel(w, jahr) : 'KW ' + w),
      saisonLabel: typeof seasonYearLabel === 'function' ? seasonYearLabel(s) : 'Saison ' + s
    };
    const S = sammlung(); S.karten.push(e); S.neu = (S.neu || 0) + 1; speichern(S);
    const ed = ED[art];
    if (typeof addNews === 'function') addNews('squad', `🃏 Neue Karte: ${ed.name}`, `${voll(p)} bekommt die Karte „${ed.name}“${info.grund ? ' – ' + info.grund : ''}. Zu sehen in der Kartensammlung.`);
    if (typeof window.showToast === 'function') window.showToast(`🃏 ${ed.name}: ${voll(p)}`, 'success');
    zaehler();
    return e;
  }
  // Aussehen im Spieler-Blatt: neueste Sonderkarte der laufenden Saison
  function aktuelle(p) {
    if (!p || !Array.isArray(p.karten) || !hatSpiel()) return null;
    const k = p.karten.filter(x => x.s === LEAGUE.season || x.art === 'ikone').slice(-1)[0];
    return k ? ED[k.art] : null;
  }
  const klasse = p => { const ed = aktuelle(p); return ed ? 'ed ed-' + ed.art : null; };

  // ── Spiel: Elf der Woche, Spieler der Woche, Momente ──────────────────────
  let vorher = null;
  function merken() {
    vorher = new Map();
    kader().forEach(p => vorher.set(p.id, { n: (p.matchRatings && p.matchRatings.list ? p.matchRatings.list.length : 0), ms: p.matchRatings && p.matchRatings.season, g: (p.stats && p.stats.goals) || 0 }));
  }
  function nachSpiel(fx) {
    if (!vorher || !fx || fx.type === 'friendly') { vorher = null; return; }
    const w = LEAGUE.week, mo = monat(w);
    // 2026-10-16: vorher „Folgewoche nicht mehr Oktober“ – das war nur Woche 18, eine Länderspielpause ohne Spiel. Jetzt wie
    // Weihnachten: die Spiele nach dem letzten Ligaspieltag im Oktober (Liga, Pokal, Europapokal)
    const halloween = mo === 'Oktober' && !(LEAGUE.matchWeeks || []).some(x => x > w && monat(x) === 'Oktober'), winter = mo === 'Dezember';
    // Weihnachten (Karten v2): letztes Pflichtspiel im Dezember – danach kommt bis Januar kein Ligaspiel mehr
    const weihnachten = winter && !(LEAGUE.matchWeeks || []).some(x => x > w && monat(x) === 'Dezember');
    const comp = String(fx.comp || '').toLowerCase(), runde = String(fx.roundName || fx.round || '');
    const derby = !!(window.KSDerby && KSDerby.istDerby && KSDerby.istDerby(fx));
    const kandidaten = [];
    kader().forEach(p => {
      const v = vorher.get(p.id), mr = p.matchRatings;
      if (!v || !mr || !Array.isArray(mr.list)) return;
      const neu = mr.season === v.ms ? mr.list.length - v.n : mr.list.length;
      if (neu <= 0) return;                                   // nicht gespielt
      const note = mr.list[mr.list.length - 1], tore = ((p.stats && p.stats.goals) || 0) - v.g;
      // Monatsnoten für „Spieler des Monats“
      if (!p._monat || p._monat.m !== mo || p._monat.s !== LEAGUE.season) p._monat = { m: mo, s: LEAGUE.season, l: [] };
      p._monat.l.push(note);
      // Meilensteine
      if (String(p.id || '').indexOf('sq_youth') === 0 && !p._debutGeprueft) { p._debutGeprueft = 1; vergeben(p, 'eigengewaechs', { grund: 'Debüt im Profiteam' }); }
      if (p._comeback) { delete p._comeback; if (note >= CFG.comeback) vergeben(p, 'comeback', { grund: 'Rückkehr nach langer Verletzung mit Note ' + note.toLocaleString('de-DE') }); }
      const spiele = (p.statsHistory || []).reduce((a, x) => a + (x.apps || 0), 0) + ((p.stats && p.stats.apps) || 0);
      if (spiele >= CFG.ikone) vergeben(p, 'ikone', { grund: spiele + ' Pflichtspiele für den Verein' });
      // Leistung
      if (tore >= 3) vergeben(p, 'hattrick', { grund: tore + ' Tore in einem Spiel' });
      const grund = `Note ${note.toLocaleString('de-DE')}${tore > 0 ? ', ' + tore + ' Tor' + (tore > 1 ? 'e' : '') : ''}`;
      if (fx.type === 'euro' && note >= CFG.europa) { const k = comp === 'ecl' ? 'co' : comp; if (ED['held-' + k]) vergeben(p, 'held-' + k, { grund }); }
      if (fx.type === 'pokal' && note >= CFG.pokalheld && /Halbfinale|Finale/.test(runde)) vergeben(p, 'pokalheld', { grund: grund + ' im ' + runde });
      if (note >= CFG.totw || tore >= 3) kandidaten.push({ p, note, tore, grund });
    });
    // Nur der Beste des Spiels kommt in die Elf/zum Spieler der Woche (sonst zu viele Karten)
    const best = kandidaten.sort((x, y) => (y.note + (y.tore >= 3 ? 2 : 0)) - (x.note + (x.tore >= 3 ? 2 : 0)))[0];
    if (best) {
      const p = best.p;
      if (best.note >= CFG.potw || best.tore >= 3) vergeben(p, 'potw', { grund: best.grund });
      else vergeben(p, halloween ? 'halloween' : weihnachten ? 'weihnachten' : winter ? 'winter' : derby ? 'derby' : p.age <= 21 ? 'zukunft' : 'totw', { grund: best.grund });
    }
    // Bonus des Spielers des Monats läuft mit jedem Pflichtspiel des Vereins ab
    kader().forEach(p => { if (p._potmBonus && --p._potmBonus.rest <= 0) delete p._potmBonus; });
    vorher = null;
  }
  // Spieler des Monats beim Monatswechsel; Comeback-Merker aus langen Verletzungen
  let letzterMonat = null;
  function woche() {
    if (!hatSpiel()) return;
    kader().forEach(p => {
      if ((p.injuryWeeks || 0) >= CFG.comebackWochen) p._langVerletzt = 1;
      else if (p._langVerletzt && !(p.injuryWeeks > 0)) { delete p._langVerletzt; p._comeback = 1; }
    });
    const mo = monat(LEAGUE.week);
    if (letzterMonat && mo !== letzterMonat) {
      const kand = kader().filter(p => p._monat && p._monat.m === letzterMonat && p._monat.s === LEAGUE.season && p._monat.l.length >= CFG.potm.spiele)
        .map(p => ({ p, d: p._monat.l.reduce((a, b) => a + b, 0) / p._monat.l.length })).sort((a, b) => b.d - a.d)[0];
      if (kand && kand.d >= CFG.potm.note && vergeben(kand.p, 'potm', { grund: `Notenschnitt ${kand.d.toFixed(2).replace('.', ',')} im ${letzterMonat}` }))
        kand.p._potmBonus = { w: CFG.potmBonus.w, rest: CFG.potmBonus.spiele, s: LEAGUE.season };   // wie Kickdraft: +2 für 4 Spiele
    }
    letzterMonat = mo;
  }
  // Saisonabschluss (kickstil_saisonabschluss.js): Spieler der Saison, Torjäger, Talent, Meister, Aufstieg, Pokalsieger
  // Saisonwerte VOR startNewSeason festhalten (danach sind Tore und Noten zurückgesetzt)
  function saisonListe(saison) {
    return kader().map(p => {
      const l = (p.matchRatings && p.matchRatings.season === saison && p.matchRatings.list) || [];
      return { p, n: l.length, d: l.length ? l.reduce((a, b) => a + b, 0) / l.length : 0, g: (p.stats && p.stats.goals) || 0 };
    });
  }
  function saisonAbschluss(d) {
    d = d || {};
    const alt = { s: d.saison, w: d.woche, jahr: d.jahr };
    const vergeben = (p, art, info) => vergebenEcht(p, art, Object.assign({}, alt, info));
    const sp = d.liste || saisonListe(d.saison);
    const out = {};
    const sds = sp.filter(x => x.n >= CFG.sds.spiele).sort((a, b) => b.d - a.d)[0];
    if (sds) out.sds = vergeben(sds.p, 'sds', { grund: `Notenschnitt ${sds.d.toFixed(2).replace('.', ',')} in ${sds.n} Spielen` });
    const tj = sp.slice().sort((a, b) => b.g - a.g)[0];
    if (tj && tj.g >= CFG.torjaeger) out.torjaeger = vergeben(tj.p, 'torjaeger', { grund: tj.g + ' Saisontore' });
    const ta = sp.filter(x => x.p.age <= 21 && x.n >= 10).sort((a, b) => b.d - a.d)[0];
    if (ta) out.talent = vergeben(ta.p, 'talent', { grund: `Notenschnitt ${ta.d.toFixed(2).replace('.', ',')} mit ${ta.p.age} Jahren` });
    // Stammspieler: die 11 mit den meisten Einsätzen (mind. 10) – sonst bekäme bei einem Titel der ganze Kader eine Karte
    const stamm = sp.filter(x => x.n >= 10).sort((a, b) => b.n - a.n || b.d - a.d).slice(0, 11).sort((a, b) => b.d - a.d);
    if (d.meister) stamm.forEach(x => vergeben(x.p, 'meister', { grund: 'Meister ' + (d.liga || '') }));
    else if (d.aufstieg) stamm.slice(0, 3).forEach(x => vergeben(x.p, 'aufstieg', { grund: 'Aufstieg in die ' + (d.neueLiga || 'nächste Liga') }));
    if (d.pokalsieger) stamm.forEach(x => vergeben(x.p, 'pokalsieger', { grund: 'Flutlichtpokal gewonnen' }));
    return out;
  }

  // ── Darstellung ───────────────────────────────────────────────────────────
  function gesicht(e) { try { return window.KSVerein ? KSVerein.gesicht(e, 'fcm') : ''; } catch (x) { return ''; } }
  function karteHtml(e, opt) {
    opt = opt || {};
    const ed = ED[e.art]; if (!ed) return '';
    const ax = Array.isArray(e.ax) && e.ax.length ? e.ax : [['TEM', '–'], ['SCH', '–'], ['PAS', '–'], ['DRI', '–'], ['DEF', '–'], ['PHY', '–']];
    let html = window.DFLAppShell && DFLAppShell.futKarte ? DFLAppShell.futKarte(e, e.ovr, ax, gesicht(e), null, { stufe: 'ed ed-' + e.art })
      : `<div class="fut ed ed-${e.art}"><div class="fut-wert">${e.ovr}</div><div class="fut-pos">${esc(e.pos)}</div><div class="fut-name">${esc(e.name)}</div></div>`;
    if (html.indexOf('fut-ed-marke') < 0) html = html.replace('<div class="fut-gesicht">', markeHtml('ed ed-' + e.art, e) + '<div class="fut-gesicht">');
    return opt.klein ? `<div class="ksk-mini">${html}</div>` : html;
  }
  // Marke oben rechts + Motive der Edition (kickstil_karten_deko.js, Karten v2); p = Spieler oder Sammlungs-Eintrag
  const MON = { Januar: 'JAN', Februar: 'FEB', März: 'MÄR', April: 'APR', Mai: 'MAI', Juni: 'JUN', Juli: 'JUL', August: 'AUG', September: 'SEP', Oktober: 'OKT', November: 'NOV', Dezember: 'DEZ' };
  function markeHtml(kl, p) {
    const art = String(kl || '').replace(/^ed ed-/, ''), ed = ED[art];
    if (!ed) return '';
    let kurz = ed.kurz;
    if (art === 'potm' && p) {   // Spieler des Monats: Monat in der Marke
      const k = p.art === 'potm' ? p : (p.karten || []).filter(x => x.art === 'potm').slice(-1)[0];
      const m = k && k.w ? monat(k.w - 1) : (String(p.grund || '').match(/im (\S+)$/) || [])[1];
      if (m && MON[m]) kurz += ' · ' + MON[m];
    }
    const deko = window.KSKartenDeko ? KSKartenDeko.html(art, p) : '';
    return `<span class="fut-ed-marke"><i class="ti ${ed.icon}" aria-hidden="true"></i>${esc(kurz)}</span>${deko}`;
  }
  function umrissHtml(ed) {
    return `<div class="fut ed ed-${ed.art} ksk-umriss"><span class="fut-ed-marke"><i class="ti ${ed.icon}" aria-hidden="true"></i>${esc(ed.kurz)}</span>
      <div class="ksk-frage">?</div><div class="fut-name">${esc(ed.name)}</div></div>`;
  }

  // ── Galerie ───────────────────────────────────────────────────────────────
  let EL = null, REITER = 'gesammelt', FILTER = null;
  function zaehler() {
    const n = sammlung().neu || 0;
    document.querySelectorAll('[data-ks-karten] .ksk-neu').forEach(b => { b.textContent = n; b.hidden = !n; });
  }
  function zeichnen() {
    const S = sammlung(), karten = S.karten.slice().reverse();
    const anzahl = {}; S.karten.forEach(k => { anzahl[k.art] = (anzahl[k.art] || 0) + 1; });
    const gefunden = E.filter(e => anzahl[e.art]).length;
    let inhalt;
    if (REITER === 'gesammelt') {
      const liste = FILTER ? karten.filter(k => k.art === FILTER) : karten;
      inhalt = (FILTER ? `<button type="button" class="ksk-filter" data-ksk-filter=""><i class="ti ti-x" aria-hidden="true"></i>${esc(ED[FILTER].name)}</button>` : '') +
        (liste.length ? `<div class="ksk-raster">${liste.map(k => `<figure class="ksk-zelle">${karteHtml(k, { klein: true })}
          <figcaption><b>${esc(ED[k.art].name)}</b><small>${esc(k.saisonLabel)} · ${esc(k.wann)}</small>${k.grund ? `<small>${esc(k.grund)}</small>` : ''}</figcaption></figure>`).join('')}</div>`
          : `<p class="ksk-leer">Noch keine Karten. Starke Leistungen bringen die erste – schau unter „Alle Karten“, was es gibt.</p>`);
    } else {
      inhalt = `<div class="ksk-raster">${E.map(ed => {
        const n = anzahl[ed.art] || 0, letzte = n ? S.karten.filter(k => k.art === ed.art).slice(-1)[0] : null;
        return `<figure class="ksk-zelle${n ? '' : ' fehlt'}" ${n ? `data-ksk-filter="${ed.art}"` : ''}>${n ? karteHtml(letzte, { klein: true }) : `<div class="ksk-mini">${umrissHtml(ed)}</div>`}
          <figcaption><b>${esc(ed.name)}</b><small class="ksk-selten">${'◆'.repeat(ed.selten)}${'◇'.repeat(5 - ed.selten)} · ${n ? n + '× gesammelt' : 'noch nicht gefunden'}</small><small>${esc(ed.wie)}</small></figcaption></figure>`;
      }).join('')}</div>`;
    }
    EL.querySelector('.ksk-box').innerHTML = `<div class="ksk-griff"></div>
      <div class="ksk-kopf"><span><b>Kartensammlung</b><small>${S.karten.length} Karten · ${gefunden} von ${E.length} Kartenarten gefunden</small></span>
        <button type="button" class="ksk-zu" aria-label="Schließen"><i class="ti ti-x" aria-hidden="true"></i></button></div>
      <div class="ksk-reiter"><button type="button" data-ksk-reiter="gesammelt" class="${REITER === 'gesammelt' ? 'an' : ''}">Gesammelt</button>
        <button type="button" data-ksk-reiter="alle" class="${REITER === 'alle' ? 'an' : ''}">Alle Karten</button></div>
      ${inhalt}`;
  }
  function oeffnen(reiter) {
    if (!EL) {
      EL = document.createElement('div'); EL.id = 'ks-karten';
      EL.innerHTML = '<div class="ksk-bg"></div><div class="ksk-box" role="dialog" aria-modal="true" aria-label="Kartensammlung"></div>';
      EL.addEventListener('click', ev => {
        if (ev.target.closest('.ksk-bg') || ev.target.closest('.ksk-zu')) { EL.classList.remove('auf'); return; }
        const r = ev.target.closest('[data-ksk-reiter]'); if (r) { REITER = r.getAttribute('data-ksk-reiter'); FILTER = null; zeichnen(); return; }
        const f = ev.target.closest('[data-ksk-filter]'); if (f) { FILTER = f.getAttribute('data-ksk-filter') || null; REITER = 'gesammelt'; zeichnen(); }
      });
      document.body.appendChild(EL);
    }
    if (reiter) REITER = reiter;
    const S = sammlung(); S.neu = 0; speichern(S); zaehler();
    zeichnen();
    requestAnimationFrame(() => EL.classList.add('auf'));
  }

  // ── Einhängen ─────────────────────────────────────────────────────────────
  if (typeof window.processFixtureResult === 'function') {
    const _p = window.processFixtureResult;
    window.processFixtureResult = function () {
      let fx = null; try { fx = typeof CURRENT_FIXTURE !== 'undefined' ? CURRENT_FIXTURE : null; } catch (e) { fx = null; }
      try { merken(); } catch (e) { vorher = null; }
      const r = _p.apply(this, arguments);
      try { nachSpiel(fx); } catch (e) { console.warn('[Kickstil-Karten] Spiel', e); }
      return r;
    };
    try { processFixtureResult = window.processFixtureResult; } catch (e) { /* window reicht */ }
  }
  if (typeof window.advanceCalendarWeek === 'function') {
    const _w = window.advanceCalendarWeek;
    window.advanceCalendarWeek = function () { const r = _w.apply(this, arguments); try { woche(); } catch (e) { console.warn('[Kickstil-Karten] Woche', e); } return r; };
    try { advanceCalendarWeek = window.advanceCalendarWeek; } catch (e) { /* window reicht */ }
  }
  // Zugang: Mehr-Blatt (Handy) und Verein-Reiter (PC)
  function einbauen() {
    const box = document.querySelector('#app-sheet .app-sheet-box');
    if (box && !box.querySelector('[data-ks-karten]')) {
      const b = document.createElement('button');
      b.className = 'app-eintrag'; b.setAttribute('data-ks-karten', '1');
      b.innerHTML = '<i class="ti ti-cards" aria-hidden="true"></i><span class="app-eintrag-txt"><b>Kartensammlung <span class="ksk-neu" hidden>0</span></b><small>Sonderkarten deiner Spieler – und welche es noch gibt</small></span><i class="ti ti-chevron-right app-pfeil" aria-hidden="true"></i>';
      box.insertBefore(b, box.querySelector('[data-ks-joker]') || box.querySelector('[data-gesamt]') || null);
      zaehler();
    }
    const club = document.getElementById('view-club');
    if (club && !club.querySelector('.ksk-pc')) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'ksk-pc ksj-pc'; b.setAttribute('data-ks-karten', '1');
      b.innerHTML = '<i class="ti ti-cards" aria-hidden="true"></i> Kartensammlung <span class="ksk-neu" hidden>0</span>';
      club.insertBefore(b, club.firstChild);
      zaehler();
    }
  }
  document.addEventListener('click', ev => {
    const k = ev.target.closest && ev.target.closest('[data-ks-karten]');
    if (k) { ev.preventDefault(); ev.stopPropagation(); const s = document.getElementById('app-sheet'); if (s) s.classList.remove('auf'); oeffnen(); }
  }, true);
  const los = () => { einbauen(); new MutationObserver(einbauen).observe(document.body, { childList: true, subtree: true }); };
  if (document.body) los(); else document.addEventListener('DOMContentLoaded', los);

  // ── Aussehen der Sonderkarten (eigene Rahmen, angelehnt an FUT) ───────────
  const css = document.createElement('style');
  css.textContent = `
.fut.ed{color:#fff;box-shadow:0 16px 34px rgb(0 0 0/.5),0 0 0 3px var(--ed-rand,#d4a72c),0 0 18px var(--ed-glow,rgb(244 208 63/.4))}
.fut.ed .fut-name{border-bottom-color:color-mix(in srgb,var(--ed-rand,#d4a72c) 60%,transparent)}
html .fut.ed .fut-werte b,html .fut.ed .fut-werte em,html .fut.ed .fut-name,html .fut.ed .fut-pos{color:inherit}
.fut.ed .fut-d.auf{color:#7ff0a8}.fut.ed .fut-d.ab{color:#ff9a8a}
.fut-ed-marke{position:absolute;right:9px;top:11px;z-index:2;display:inline-flex;align-items:center;gap:3px;padding:4px 7px;border-radius:8px;
  font:800 9.5px/1 var(--font-text,system-ui);letter-spacing:.06em;text-transform:uppercase;background:var(--ed-rand,#d4a72c);color:var(--ed-marke,#131313)}
.fut-ed-marke i{font-size:12px}
.fut.ed-totw{--ed-rand:#e8c35a;background:linear-gradient(160deg,#2a2a2a,#0c0c0c 55%,#1c1a12);color:#f3d77a}
.fut.ed-potw{--ed-rand:#f0c05a;--ed-glow:rgb(160 90 255/.5);background:radial-gradient(120% 90% at 50% 0%,#5b2a9a,#2a1050 55%,#120626);color:#ffe28a}
.fut.ed-hattrick{--ed-rand:#ff5a4a;--ed-glow:rgb(255 90 74/.5);--ed-marke:#fff;background:linear-gradient(150deg,#3a0a0a,#7a1212 45%,#1a0606);color:#fff}
.fut.ed-zukunft{--ed-rand:#4ff0d0;--ed-glow:rgb(79 240 208/.55);background:linear-gradient(150deg,#062a3a,#0a5a6a 45%,#06303a 70%,#02141c);color:#d4fff6}
.fut.ed-potm{--ed-rand:#ff7ac8;--ed-glow:rgb(255 122 200/.45);background:linear-gradient(150deg,#1b2a8a,#4a2aa8 50%,#2a0f5a);color:#fff}
.fut.ed-halloween{--ed-rand:#ff8a1f;--ed-glow:rgb(255 138 31/.6);background:radial-gradient(110% 80% at 50% 15%,#4a1a6a,#200a30 55%,#0a0410);color:#ffb35a}
.fut.ed-halloween::before{content:'';position:absolute;inset:0;background:radial-gradient(circle at 20% 85%,rgb(255 138 31/.25),transparent 35%),radial-gradient(circle at 85% 70%,rgb(140 255 90/.18),transparent 30%);pointer-events:none}
.fut.ed-winter{--ed-rand:#bfe8ff;--ed-glow:rgb(191 232 255/.7);--ed-marke:#0a2a44;background:linear-gradient(160deg,#eaf7ff,#9fd6f5 40%,#4a8fc4 75%,#1f4e7a);color:#06263f}
.fut.ed-weihnachten{--ed-rand:#e8323a;--ed-glow:rgb(255 215 90/.55);--ed-marke:#fff;background:radial-gradient(120% 90% at 50% 10%,#1f6a3a,#0d3a20 55%,#4a0a10 120%);color:#fff4d6}
.fut.ed-held-cl{--ed-rand:#dfe6f5;--ed-glow:rgb(223 230 245/.5);background:radial-gradient(120% 90% at 50% 0%,#22356a,#0b1736 60%,#050b1c);color:#eef2fb}
.fut.ed-held-el{--ed-rand:#ff8a1f;--ed-glow:rgb(255 138 31/.45);background:linear-gradient(160deg,#352b20,#17140f 60%,#0a0806);color:#ffb15a}
.fut.ed-held-co{--ed-rand:#3ee6b4;--ed-glow:rgb(62 230 180/.45);background:linear-gradient(160deg,#124d43,#062a24 60%,#021410);color:#c9fbea}
.fut.ed-pokalheld{--ed-rand:#e8e8e8;--ed-glow:rgb(220 40 40/.45);background:linear-gradient(150deg,#b8141c,#7a0a10 50%,#3a0508);color:#fff}
.fut.ed-derby{--ed-rand:#ff3b2f;--ed-glow:rgb(255 59 47/.6);--ed-marke:#fff;background:linear-gradient(180deg,#120404,#3a0606 50%,#ff5a1a 130%);color:#ffd0b0}
.fut.ed-comeback{--ed-rand:#c88cff;--ed-glow:rgb(200 140 255/.5);background:linear-gradient(150deg,#2a1a3a,#4a2a6a 50%,#1a0f2a);color:#f2e3ff}
.fut.ed-eigengewaechs{--ed-rand:#7fdc6a;--ed-glow:rgb(127 220 106/.45);background:linear-gradient(150deg,#123a1a,#2a6a2a 50%,#0f2a12);color:#e6ffd9}
.fut.ed-nationalspieler{--ed-rand:#ffffff;--ed-glow:rgb(80 140 255/.45);background:linear-gradient(150deg,#0a2a6a,#1a4aa8 50%,#081a40);color:#fff}
.fut.ed-torjaeger{--ed-rand:#f0c05a;--ed-glow:rgb(240 192 90/.6);background:linear-gradient(150deg,#1a3a1a,#2f6a2f 45%,#0f240f);color:#ffe08a}
.fut.ed-talent{--ed-rand:#9df06a;--ed-glow:rgb(157 240 106/.5);background:linear-gradient(150deg,#0a3a2a,#13664a 50%,#062418);color:#eaffdc}
.fut.ed-sds{--ed-rand:#ffd75a;--ed-glow:rgb(80 160 255/.6);background:linear-gradient(150deg,#0c3fa8,#0a2a7a 45%,#1e5ad8 75%,#071c52);color:#ffe9a0}
.fut.ed-aufstieg{--ed-rand:#7fe0a0;--ed-glow:rgb(127 224 160/.5);background:linear-gradient(170deg,#0f3a24,#1a6a3e 55%,#0a2416);color:#fff}
.fut.ed-pokalsieger{--ed-rand:#ffffff;--ed-glow:rgb(255 255 255/.6);--ed-marke:#7a0a10;background:linear-gradient(150deg,#e2e6ec,#9aa4b2 45%,#f2f4f8 70%,#7a8494);color:#3a0508}
.fut.ed-meister{--ed-rand:#ffd75a;--ed-glow:rgb(255 215 90/.7);background:linear-gradient(150deg,#f7e08a,#c9a227 40%,#fff1b8 60%,#9a7612);color:#2a1c02}
.fut.ed-ikone{--ed-rand:#ffffff;--ed-glow:rgb(255 246 214/.8);--ed-marke:#6a4a10;background:linear-gradient(150deg,#fffaf0,#efe1bd 45%,#fffdf6 65%,#d8c28a);color:#4a3208}
@keyframes ksk-glanz{to{background-position:200% 0}}
.fut.ed-sds,.fut.ed-meister,.fut.ed-ikone,.fut.ed-halloween{background-size:200% 200%;animation:ksk-glanz 9s linear infinite}
@media (prefers-reduced-motion:reduce){.fut.ed{animation:none!important}}
.ksk-umriss{filter:grayscale(1) brightness(.55);opacity:.75}.ksk-frage{position:absolute;inset:40px 0 70px;display:grid;place-items:center;font:800 64px/1 var(--font-zahl,system-ui);opacity:.5}
#ks-karten{position:fixed;inset:0;z-index:9700;pointer-events:none}#ks-karten.auf{pointer-events:auto}
.ksk-bg{position:absolute;inset:0;background:rgb(6 6 5/.62);opacity:0;transition:opacity .18s}#ks-karten.auf .ksk-bg{opacity:1}
.ksk-box{position:absolute;left:0;right:0;bottom:0;margin:0 auto;max-width:760px;max-height:90vh;overflow-y:auto;background:var(--bg2,#fffaf0);color:var(--text,#2b2a26);
  border-radius:22px 22px 0 0;border:3px solid var(--k-rahmen,#8b5a2b);border-bottom:0;padding:4px 14px calc(18px + env(safe-area-inset-bottom,0px));
  transform:translateY(100%);transition:transform .24s cubic-bezier(.2,.8,.3,1);font-family:var(--font-text,system-ui)}
#ks-karten.auf .ksk-box{transform:none}html.dark .ksk-box{background:var(--bg2,#1e2230)}
.ksk-griff{width:40px;height:4px;border-radius:3px;background:var(--bg4,#c9b48f);margin:6px auto 8px}
.ksk-kopf{display:flex;align-items:center;justify-content:space-between;gap:8px}.ksk-kopf>span{display:flex;flex-direction:column}
.ksk-kopf b{font:700 21px/1.1 var(--font-titel,Fredoka,system-ui)}.ksk-kopf small{color:var(--text3,#846d52);font-size:12px;margin-top:2px}
.ksk-zu{border:0;background:var(--bg3,#efe2c8);color:inherit;width:38px;height:38px;border-radius:12px;font-size:20px;cursor:pointer}
.ksk-reiter{display:flex;gap:6px;margin:10px 0}.ksk-reiter button{flex:1;font:700 14px/1 var(--font-titel,system-ui);padding:10px;border-radius:12px;border:2px solid var(--k-rand,#d9c29a);background:none;color:inherit;cursor:pointer}
.ksk-reiter button.an{background:var(--k-blau,#2c7cb5);border-color:var(--k-blau-tief,#1d5a86);color:#fff}
.ksk-raster{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px 10px}
.ksk-zelle{margin:0;display:flex;flex-direction:column;align-items:center;gap:6px;cursor:default}.ksk-zelle[data-ksk-filter]{cursor:pointer}
.ksk-zelle figcaption{text-align:center;display:flex;flex-direction:column;gap:2px}.ksk-zelle figcaption b{font-size:13px}
.ksk-zelle figcaption small{font-size:11px;color:var(--text3,#846d52);line-height:1.25}.ksk-selten{color:var(--k-gold,#c9a227)!important;letter-spacing:.05em}
.ksk-mini{width:150px;height:210px;display:grid;place-items:start center;overflow:visible}
.ksk-mini>.fut{transform:scale(.68);transform-origin:top center;flex:none;margin-inline:calc((150px - 220px)/2)}
.ksk-leer{text-align:center;color:var(--text3,#846d52);padding:24px 8px}
.ksk-filter{border:0;border-radius:999px;padding:6px 10px;margin-bottom:10px;background:var(--bg3,#efe2c8);color:inherit;font:700 12px/1 system-ui;cursor:pointer}
.ksk-neu{display:inline-block;min-width:18px;padding:2px 5px;border-radius:999px;background:#e5484d;color:#fff;font:800 11px/1.2 system-ui;text-align:center;margin-left:4px}
.ksk-neu[hidden]{display:none}
body.dfl-shell .ksk-pc{display:none}`;
  document.head.appendChild(css);

  // Aufstellung (2026-10-22, wie Kickdraft: „in der Aufstellung … der Background der Spieler so wie bei der Karte“): wer gerade
  // eine Sonderkarte hat (Elf/Spieler der Woche bis eine Woche danach, Spieler des Monats vier Wochen), trägt auf dem Feld deren
  // Farbe und Rahmen. Karten ändern in der Vereinskarriere weiter keine Werte – nur der Look.
  const FELD = { dauer: { potm: 4 }, dauerSonst: 1,
    farbe: { potw: ['#9b1426', '#3a040c', '#e9b44c'], totw: ['#3a3a3a', '#050505', '#e0ad3e'], potm: ['#7a5a14', '#2a1c02', '#ffe08a'],
             zukunft: ['#3b1670', '#160634', '#8ad8ff'], hattrick: ['#0e5f63', '#04262a', '#7df9ff'] } };
  function feldKarte(p) {
    if (!p || !Array.isArray(p.karten) || !hatSpiel()) return null;
    const k = p.karten.filter(x => x.s === LEAGUE.season && x.w != null && LEAGUE.week - x.w <= (FELD.dauer[x.art] || FELD.dauerSonst) && LEAGUE.week >= x.w).slice(-1)[0];
    return k ? { art: k.art, f: FELD.farbe[k.art] || FELD.farbe.totw } : null;
  }
  function feldMarken() {
    if (typeof FORMATIONS === 'undefined' || !hatSpiel()) return;
    const slots = FORMATIONS[CLUB.formation] || [], els = document.querySelectorAll('#pitch .p-slot');
    slots.forEach((slot, i) => {
      const el = els[i], pid = CLUB.lineup && CLUB.lineup[slot.id], p = pid && kader().find(x => x.id === pid), tok = el && el.querySelector('.p-token');
      const k = feldKarte(p);
      if (!tok || !k) return;
      el.classList.add('ks-sonder');
      tok.style.setProperty('--ks-a', k.f[0]); tok.style.setProperty('--ks-b', k.f[1]); tok.style.setProperty('--ks-r', k.f[2]);
      tok.title = (ED[k.art] || {}).name || '';
      const b = potmBonus(p);
      if (b && !tok.querySelector('.ks-plus')) tok.insertAdjacentHTML('beforeend', `<span class="ks-plus">+${b}</span>`);
    });
  }
  const feldStil = document.createElement('style');
  feldStil.textContent = `.ks-sonder .p-token{background:radial-gradient(circle at 50% 30%,var(--ks-a),var(--ks-b))!important;border-color:var(--ks-r)!important;
    box-shadow:0 0 0 2px var(--ks-b),0 0 10px var(--ks-r)}.ks-sonder .p-token:not(.mit-gesicht){color:#fff}
    .ks-plus{position:absolute;right:-8px;top:-6px;font:800 9px/1 var(--font-zahl,var(--font-display,system-ui));color:var(--ks-b);background:var(--ks-r);border-radius:7px;padding:2px 4px}`;
  document.head.appendChild(feldStil);
  // Spieler des Monats: +w im Spiel (Engine-Kopie, die echten Werte bleiben)
  const potmBonus = p => (p && p._potmBonus && hatSpiel() && p._potmBonus.s === LEAGUE.season && p._potmBonus.rest > 0 ? p._potmBonus.w : 0);
  const engineEinhaengen = () => {
    const A = window.EngineV2Adapter;
    if (!A || typeof A.buildOwnTeam !== 'function' || A.buildOwnTeam._ksPotm) return;
    const _own = A.buildOwnTeam;
    A.buildOwnTeam = function () {
      const t = _own.apply(this, arguments);
      try {
        (t && t.players || []).forEach(x => {
          const b = potmBonus(x._ref); if (!b) return;
          ['ovr', 'att', 'mid', 'def', 'technik', 'pace'].forEach(k => { if (typeof x[k] === 'number') x[k] = Math.min(99, x[k] + b); });
          if (x.werte && typeof x.werte === 'object') Object.keys(x.werte).forEach(k => { if (typeof x.werte[k] === 'number') x.werte[k] = Math.min(99, x.werte[k] + b); });
        });
      } catch (e) { console.warn('[Kickstil-Karten] Bonus', e); }
      return t;
    };
    A.buildOwnTeam._ksPotm = true;
  };
  // erst nach allen Modulen einhängen (Kader-Ansicht und Positionen zeichnen das Feld neu)
  const feldEinhaengen = () => {
    const _rp = window.renderPitch;
    if (typeof _rp !== 'function' || _rp._ksSonder) return;
    window.renderPitch = function () { const r = _rp.apply(this, arguments); try { feldMarken(); } catch (e) { /* nur Anzeige */ } return r; };
    window.renderPitch._ksSonder = true;
    try { renderPitch = window.renderPitch; } catch (e) { /* nur im Spiel */ }
  };
  if (document.readyState === 'complete') { feldEinhaengen(); engineEinhaengen(); } else window.addEventListener('load', () => { feldEinhaengen(); engineEinhaengen(); });

  window.KSKarten = { CFG, EDITIONEN: E, ED, vergeben, klasse, aktuelle, karteHtml, markeHtml, umrissHtml, oeffnen, saisonAbschluss, saisonListe, sammlung, feldKarte, potmBonus };
  console.log('[Kickstil-Karten v1] aktiv — ' + E.length + ' Sonderkarten (Elf der Woche, Halloween, Spieler der Saison …), Kartensammlung im Mehr-Menü');
})();
