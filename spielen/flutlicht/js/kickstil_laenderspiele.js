/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · LÄNDERSPIELE: EM- UND WM-QUALIFIKATION  ·  v1
   (Nutzer 2026-10-16: „EM und WM Qualifikation mit echten Teams, die intern gegeneinander spielen … nicht spielbar als Trainer“)
   ─────────────────────────────────────────────────────────────────────────
   Termine wie in echt: EM 2028, WM 2030, EM 2032 … – jedes gerade Jahr ein Turnier im Sommer (Saisonwechsel).
   Ein Zyklus = die zwei Saisons davor:
     · Qualifikation in den Länderspielpausen (FENSTER): Saison 1 KW 18/34/42, Saison 2 KW 18/34 – je Fenster 2 Spieltage
       (10 Spieltage; Gruppen mit 5–6 Teams spielen Hin- und Rückrunde, kleinere Gruppen/Ligen verteilen sich darauf).
     · Playoffs (und bei der WM die interkontinentalen Playoffs): Saison 2 KW 42.
     · Endrunde beim Saisonwechsel in das Turnierjahr: EM 24 Teams (6×4, Achtelfinale), WM 48 Teams (12×4, Sechzehntelfinale).
   Formate: EM – UEFA 10 Gruppen, Erste und Zweite direkt, Rest über Playoff-Wege (je 4 Teams, Halbfinale + Finale).
     WM – UEFA 16 Plätze (Gruppensieger + Playoffs), CONMEBOL 6 (eine Liga), CAF 9 (Gruppensieger), AFC 8 (6 Gruppen),
     CONCACAF 6 (6 Gruppen), OFC 1, dazu 2 Plätze aus den interkontinentalen Playoffs (6 Teams). Gastgeber sind gesetzt.
   Stärke einer Nation (staerke) = Elf nach Positionen (1 TW, 4 Abwehr, 3 Mittelfeld, 3 Angriff). Nutzer 2026-10-16: „der
     OVR der Nationalmannschaften spiegelt die Mannschaft und die Spieler wider – wenn es keine deutschen Talente gibt,
     spielen die auch Müll … für San Marino und so kleine Nationen können es ausgedachte sein, die es nicht zu kaufen gibt“:
     · ECHTE Nationen (Export > 0 und Grundstärke ≥ CFG.echtAb, ~70): nur echte Spieler der Spielwelt (dein Kader, deutsche
       Ligen, Auslandskader). Fehlt eine Position ganz, springt ein Notnagel weit unter Niveau ein.
     · KLEINE Nationen: ausgedachter Grundstock aus data/nationen.js (nicht kaufbar, Elf ≈ Grundstärke) + deine Spieler.
   Spielerbasis (pflege): beim neuen Spiel bekommt jede echte Nation einen vollen Kader auf ihrem Niveau – erfundene
     Spieler der Welt (nie Stars, nie deine) wechseln dafür die Nationalität, bevorzugt bei Vereinen der typischen Ligen
     (Waliser in England, Südamerikaner in Spanien/Portugal …). Jeden Sommer: fehlt einer Nation Breite oder Nachwuchs,
     kommen junge Spieler dazu – wie stark das Team wird, entscheidet danach allein deren Entwicklung.
   Deine Spieler: Berufung, wenn sie unter den besten 23 ihres Landes sind; Spiele/Tore aus den echten Partien
     (kickstil_national.js fragt KSLaender.berufung). Endrunde: Einsätze, Tore, Moral; Titel = Meldung.
   Zustand: CLUB.welt.laender = { v, zyklus, historie } (Karrierestart leert CLUB.welt).
   Anzeige: Europa-Reiter → „Nationalteams“ (Qualifikation, Tabellen, Playoffs, Endrunde, Rangliste, Turniersieger).
   Lädt nach kickstil_nationen.js, VOR kickstil_national.js (dessen Woche-Hülle läuft danach), vor init_bootstrap.js.
   API: KSLaender.zustand() · .staerke(land) · .kader(land) · .berufung(p) · .fenster() · .html() · .nachholen() · .CFG
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const CFG = {
    fenster: [[0, 18], [0, 34], [0, 42], [1, 18], [1, 34]],   // [Saison im Zyklus, Woche] – je 2 Spieltage
    playoffWoche: [1, 42],
    echtAb: 65,                    // Grundstärke, ab der eine Nation (mit Export) echte Spieler braucht
    notnagel: 15,                  // echte Nation ohne Spieler auf einer Position: Ersatz so weit unter Grundstärke
    mindest: { TW: 3, D: 8, M: 6, A: 6 },   // Mindestkader je echter Nation (Pflege)
    nachwuchsMin: 3,               // so viele Spieler ≤ 21 hält die Pflege je echter Nation vor
    saatUnten: 1, saatOben: 2.5,   // Start: Elf soll in [Grundstärke − 1, + 2,5] liegen
    heim: 3,                       // Heimvorteil in Stärkepunkten (Qualifikation)
    kaderGroesse: 23, turnierKader: 26,
    gastgeber: { 2028: ['England', 'Irland'], 2030: ['Spanien', 'Portugal', 'Marokko'], 2032: ['Italien', 'Türkei'], 2034: ['Saudi-Arabien'] },
    wmPlaetze: { UEFA: 16, CONMEBOL: 6, CAF: 9, AFC: 8, CONCACAF: 6, OFC: 1 },
    icPlaetze: { CONMEBOL: 1, CAF: 1, AFC: 1, CONCACAF: 2, OFC: 1 },
    torAnteil: { ST: 0.28, FL: 0.16, LF: 0.16, RF: 0.16, OM: 0.16, ZOM: 0.16, AM: 0.16, LM: 0.16, RM: 0.16, ZM: 0.07, ZDM: 0.04, IV: 0.03, AV: 0.03, LV: 0.03, RV: 0.03, TW: 0 }
  };
  const W = window;
  const zufall = n => Math.floor(Math.random() * n);
  const mische = a => { for (let i = a.length - 1; i > 0; i--) { const j = zufall(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hatSpiel = () => { try { return typeof CLUB !== 'undefined' && CLUB && typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.tiers; } catch (e) { return false; } };
  const N = () => W.KSNationen;
  const flagge = l => (N() && N().flagge(l)) || '';
  const voll = p => (p.firstName ? p.firstName + ' ' : '') + p.name;
  const jahrJetzt = () => (LEAGUE && LEAGUE.startYear) || 2026;
  const zeitpunkt = (jahr, woche) => jahr * 100 + woche;
  const jetzt = () => zeitpunkt(jahrJetzt(), LEAGUE.week || 1);
  const typVon = T => (T % 4 === 0 ? 'EM' : 'WM');
  const TITEL = { EM: 'Europameisterschaft', WM: 'Weltmeisterschaft' };

  function zustand() {
    if (!hatSpiel()) return null;
    if (!CLUB.welt) CLUB.welt = {};
    if (!CLUB.welt.laender) CLUB.welt.laender = { v: 1, zyklus: null, historie: [] };
    return CLUB.welt.laender;
  }

  // ── Stärke und Kader einer Nation ──────────────────────────────────────────
  let CACHE = null;
  // Positionsstärke (Skala der Grundstärke): 70 % Hauptbereich + 30 % Schnitt; p.ovr ist der reine Schnitt und lag ~4 tiefer
  const ovrVon = p => {
    try { if (typeof ovrBase === 'function' && typeof SQUAD !== 'undefined' && SQUAD.includes(p)) return ovrBase(p) || p.ovr || 0; } catch (e) { /* weiter */ }
    try { if (typeof computeOvrFromAreas === 'function' && p.def != null) return computeOvrFromAreas(p) || p.ovr || 0; } catch (e) { /* weiter */ }
    return p.ovr || Math.round(((p.def || 50) + (p.mid || 50) + (p.att || 50)) / 3);
  };
  function weltIndex() {
    // Schlüssel auch nach Kaderzahl: npcSquads entstehen beim Spielstart nach und nach – sonst blieb ein halber Index die ganze Woche stehen
    const k = (LEAGUE.season || 1) + ':' + (LEAGUE.week || 1) + ':' + Object.keys(CLUB.npcSquads || {}).length + ':' + (CLUB.euroKader ? 1 : 0) + ':' + (typeof SQUAD !== 'undefined' ? SQUAD.length : 0);
    if (CACHE && CACHE.k === k) return CACHE.idx;
    const idx = {};
    const rein = (p, eigen) => {
      if (!p || !p.country || p.onLoanAt) return;
      (idx[p.country] = idx[p.country] || []).push({ p, ovr: ovrVon(p), eigen: !!eigen });
    };
    try { (typeof SQUAD !== 'undefined' ? SQUAD : []).forEach(p => rein(p, true)); } catch (e) { /* ohne Kader */ }
    try { Object.keys(CLUB.npcSquads || {}).forEach(id => { if (id !== CLUB.dataClubId) (CLUB.npcSquads[id] || []).forEach(p => rein(p)); }); } catch (e) { /* ohne Welt */ }
    try { const ek = typeof W.euroKader === 'function' ? W.euroKader() : (CLUB.euroKader || {}); Object.keys(ek || {}).forEach(id => (ek[id] || []).forEach(p => rein(p))); } catch (e) { /* ohne Ausland */ }
    Object.keys(idx).forEach(l => idx[l].sort((a, b) => b.ovr - a.ovr));
    CACHE = { k, idx, staerke: {} };
    return idx;
  }
  // Kader nach Positionen. Elf (e.elf) = bester TW + 4 Abwehr + 3 Mittelfeld + 3 Angriff, Rest nach Stärke (höchstens 3 TW).
  // Echte Nationen: nur echte Spieler (+ Notnagel, falls eine Position leer ist); kleine: Grundstock (virtuell) + deine Spieler.
  const TEIL = pos => pos === 'TW' ? 'TW' : (pos === 'IV' || pos === 'AV' || pos === 'LV' || pos === 'RV') ? 'D' : (pos === 'ST' || pos === 'FL' || pos === 'LF' || pos === 'RF') ? 'A' : 'M';
  const ELF = { TW: 1, D: 4, M: 3, A: 3 };
  const echtLand = land => { const n = N() && N().get(land); return !!(n && n.exp > 0 && n.basis >= CFG.echtAb); };
  function kader(land, n) {
    const nat = N() && N().get(land);
    const basis = nat ? nat.basis : 55, echt = echtLand(land);
    let pool = (weltIndex()[land] || []).filter(e => !(e.p.injuryWeeks > 0) && !e.p.injured);
    if (!echt) pool = pool.filter(e => e.eigen);
    const alle = pool.map(e => Object.assign({ t: TEIL(e.p.pos) }, e));
    [['TW', 3], ['D', 8], ['M', 7], ['A', 6]].forEach(([t, k]) => {
      for (let i = 0; i < k; i++) alle.push({ p: null, t, eigen: false, ovr: Math.round((echt ? basis - CFG.notnagel - i : basis + 1 - i * 0.8) * 10) / 10 });
    });
    alle.sort((a, b) => b.ovr - a.ovr);
    const elf = [];
    Object.keys(ELF).forEach(t => alle.filter(e => e.t === t).slice(0, ELF[t]).forEach(e => { e.elf = true; elf.push(e); }));
    const groesse = n || CFG.kaderGroesse;
    const rest = alle.filter(e => !e.elf);
    const k = elf.slice();
    let tw = 1;
    for (const e of rest) { if (k.length >= groesse) break; if (e.t === 'TW') { if (tw >= 3) continue; tw++; } k.push(e); }
    return k.sort((a, b) => b.ovr - a.ovr);
  }
  function staerke(land) {
    weltIndex();
    if (CACHE.staerke[land] != null) return CACHE.staerke[land];
    const k = kader(land).filter(e => e.elf);
    const s = Math.round(k.reduce((a, e) => a + e.ovr, 0) / Math.max(1, k.length) * 10) / 10;
    CACHE.staerke[land] = s;
    return s;
  }

  // ── Spielerbasis der echten Nationen ───────────────────────────────────────
  // Wo Spieler einer Nation typischerweise spielen (Vereinsländer) – dort wird zuerst gesucht
  const SUED = ['Spanien', 'Portugal', 'Italien', 'Frankreich', 'Brasilien', 'Argentinien'];
  const FRANKO = ['Frankreich', 'Belgien', 'Spanien', 'Portugal'];
  const BALKAN = ['Italien', 'Deutschland', 'Österreich', 'Schweiz', 'Türkei', 'Serbien', 'Kroatien'];
  const OST = ['Ukraine', 'Türkei', 'Polen', 'Tschechien', 'Deutschland'];
  const UEBERSEE = ['Deutschland', 'Niederlande', 'Belgien', 'Portugal', 'Schottland', 'Türkei'];
  const HEIMAT = {
    Wales: ['England'], Nordirland: ['England', 'Schottland'], Irland: ['England', 'Schottland'], Schottland: ['Schottland', 'England'],
    Argentinien: SUED, Brasilien: SUED, Uruguay: SUED, Kolumbien: SUED, Ecuador: SUED, Paraguay: SUED, Chile: SUED, Peru: SUED, Venezuela: SUED,
    Marokko: FRANKO, Algerien: FRANKO, Tunesien: FRANKO, Senegal: FRANKO, Elfenbeinküste: FRANKO, Mali: FRANKO, Kamerun: FRANKO,
    Nigeria: ['England', 'Belgien', 'Frankreich', 'Portugal', 'Türkei'], Ghana: ['England', 'Belgien', 'Frankreich', 'Italien'], Ägypten: ['England', 'Belgien', 'Frankreich', 'Türkei'],
    Japan: UEBERSEE, Südkorea: UEBERSEE, Australien: ['Schottland', 'England', 'Niederlande', 'Belgien'], Iran: ['Niederlande', 'Portugal', 'Türkei', 'Belgien'],
    USA: ['England', 'Deutschland', 'Niederlande', 'Spanien'], Kanada: ['England', 'Deutschland', 'Belgien', 'Frankreich'], Mexiko: ['Spanien', 'Niederlande', 'Portugal'],
    Serbien: BALKAN, Kroatien: BALKAN, Slowenien: BALKAN, 'Bosnien-Herzegowina': BALKAN, Montenegro: BALKAN, Mazedonien: BALKAN, Kosovo: BALKAN, Albanien: BALKAN,
    Georgien: OST, Armenien: OST, Aserbaidschan: OST, Kasachstan: OST, Ukraine: OST, Ungarn: OST, Slowakei: OST, Rumänien: OST, Bulgarien: OST, Israel: OST
  };
  function vereinsSpieler() {
    const l = [], cl = {};
    (W.EURO_CLUBS || []).forEach(c => { cl[c.id] = c.country; });
    Object.keys(CLUB.npcSquads || {}).forEach(id => { if (id !== CLUB.dataClubId) (CLUB.npcSquads[id] || []).forEach(p => { if (p) l.push({ p, liga: 'Deutschland' }); }); });
    const ek = typeof W.euroKader === 'function' ? W.euroKader() : (CLUB.euroKader || {});
    Object.keys(ek || {}).forEach(id => (ek[id] || []).forEach(p => { if (p) l.push({ p, liga: cl[id] || '' }); }));
    return l;
  }
  // Nationalität wechseln (nur erfundene Spieler der Welt): neuer Name aus dem Land, Index direkt nachziehen
  function umschreiben(p, land) {
    const idx = weltIndex(), alt = p.country;
    if (idx[alt]) { const i = idx[alt].findIndex(e => e.p === p); if (i >= 0) idx[alt].splice(i, 1); }
    const nm = N().name(land);
    Object.assign(p, { firstName: nm.firstName, name: nm.name, flag: N().flagge(land) || nm.flag || '', country: land });
    (idx[land] = idx[land] || []).push({ p, ovr: ovrVon(p), eigen: false });
    idx[land].sort((a, b) => b.ovr - a.ovr);
    CACHE.staerke = {};
  }
  const anzahl = (land, t, filter) => (weltIndex()[land] || []).filter(e => !e.eigen && TEIL(e.p.pos) === t && (!filter || filter(e.p))).length;
  // Spender: Spieler einer echten Nation mit großem Überschuss auf dieser Position, nicht in deren erweitertem Kader
  function spender(liste, land, t, ziel, alterMax, minOvr) {
    const idx = weltIndex(), geschuetzt = new Set(), pref = HEIMAT[land] || [land, 'Deutschland', 'England', 'Italien'];
    const ueber = {};
    let best = null, bestS = Infinity;
    for (const x of liste) {
      const p = x.p;
      if (p.stern || p.country === land || TEIL(p.pos) !== t || (alterMax && p.age > alterMax) || !echtLand(p.country)) continue;
      if (ueber[p.country] == null) {
        const l = (idx[p.country] || []).filter(e => !e.eigen && TEIL(e.p.pos) === t);
        ueber[p.country] = l.length >= CFG.mindest[t] * 4;
        if (ueber[p.country]) l.slice(0, CFG.mindest[t] * 2).forEach(e => geschuetzt.add(e.p));
      }
      if (!ueber[p.country] || geschuetzt.has(p)) continue;
      const o = ovrVon(p);
      if (minOvr && o < minOvr) continue;
      const sc = Math.abs(o - ziel) + (pref.includes(x.liga) ? 0 : 4) + Math.random() * 2;
      if (sc < bestS) { bestS = sc; best = p; }
    }
    return best;
  }
  function pflege(modus) {
    if (!hatSpiel() || !N()) return 0;
    CACHE = null; weltIndex();
    const liste = vereinsSpieler(), echte = N().alle().filter(n => echtLand(n.name)).sort((a, b) => b.basis - a.basis);
    let n = 0;
    const neu = (land, t, ziel, alterMax, minOvr) => { const p = spender(liste, land, t, ziel, alterMax, minOvr); if (p) { umschreiben(p, land); n++; } return p; };
    echte.forEach(nat => {
      const land = nat.name, b = nat.basis;
      // Breite: Mindestkader je Position
      Object.keys(CFG.mindest).forEach(t => {
        for (let fehlt = CFG.mindest[t] - anzahl(land, t); fehlt > 0; fehlt--) {
          if (modus === 'start') neu(land, t, b - 4 - Math.random() * 4);
          else neu(land, t, b - 14, 21);
        }
      });
      if (modus === 'start') {
        // Niveau: Elf in [Grundstärke − 1; + 2,5] – schwache Stelle verstärken bzw. stärksten erfundenen Spieler abgeben
        for (let i = 0; i < 14 && staerke(land) < b - CFG.saatUnten; i++) {
          const elf = kader(land).filter(e => e.elf).sort((x, y) => x.ovr - y.ovr)[0];
          if (!elf || !neu(land, elf.t, b + Math.random() * 3 - 0.5, 0, Math.max(elf.ovr + 1, b - 2))) break;
        }
        for (let i = 0; i < 10 && staerke(land) > b + CFG.saatOben; i++) {
          const top = kader(land).filter(e => e.elf && e.p && !e.p.stern && !e.eigen).sort((x, y) => y.ovr - x.ovr)[0];
          if (!top) break;
          const x = liste.find(v => v.p === top.p);
          const ziel = x && x.liga && x.liga !== land && echtLand(x.liga) ? x.liga : N().auslandLand(land);
          umschreiben(top.p, ziel); n++;
        }
      } else {
        // Nachwuchs: Nationen ohne eigene Liga bekommen sonst kaum Talente
        const jung = Object.keys(CFG.mindest).reduce((a, t) => a + anzahl(land, t, p => p.age <= 21), 0);
        for (let i = jung; i < CFG.nachwuchsMin; i++) neu(land, ['D', 'M', 'A'][zufall(3)], b - 16, 19);
      }
    });
    CACHE = null;
    if (n) console.log(`[Kickstil-Länderspiele] Spielerbasis (${modus}): ${n} Spieler mit neuer Nationalität`);
    return n;
  }

  // ── Ein Länderspiel ────────────────────────────────────────────────────────
  const poisson = l => (typeof poissonSample === 'function' ? poissonSample(l) : (() => { let k = 0, p = 1; const L = Math.exp(-l); do { k++; p *= Math.random(); } while (p > L); return k - 1; })());
  function tore(a, b, heimA, faktor) {
    const d = staerke(a) - staerke(b) + (heimA ? CFG.heim : 0);
    const f = faktor || 1;
    return [poisson(Math.max(0.15, Math.min(5, 1.25 + d / 14)) * f), poisson(Math.max(0.15, Math.min(5, 1.25 - d / 14)) * f)];
  }
  // K.-o.: Verlängerung, dann Elfmeterschießen (leicht zugunsten des Stärkeren)
  function koSpiel(a, b, heimA) {
    let [ta, tb] = tore(a, b, heimA);
    let zusatz = '';
    if (ta === tb) {
      const [va, vb] = tore(a, b, heimA, 0.33); ta += va; tb += vb;
      if (va || vb) zusatz = ' n. V.';
      if (ta === tb) {
        const pa = 0.5 + (staerke(a) - staerke(b)) / 200;
        return { a, b, ta, tb, sieger: Math.random() < pa ? a : b, zusatz: ' i. E.' };
      }
    }
    return { a, b, ta, tb, sieger: ta > tb ? a : b, zusatz };
  }

  // ── Spielplan: doppelte Runde (Kreisverfahren) ─────────────────────────────
  function runden(teams, einfach) {
    const t = teams.slice(); if (t.length % 2) t.push(null);
    const n = t.length, r = [];
    for (let i = 0; i < n - 1; i++) {
      const paare = [];
      for (let j = 0; j < n / 2; j++) {
        const h = t[j], a = t[n - 1 - j];
        if (h && a) paare.push(i % 2 ? [a, h] : [h, a]);
      }
      r.push(paare);
      t.splice(1, 0, t.pop());
    }
    return einfach ? r : r.concat(r.map(p => p.map(([h, a]) => [a, h])));
  }
  function gruppe(name, verband, teams, slots, einfach) {
    const R = runden(teams, einfach), spiele = [];
    R.forEach((paare, i) => {
      const slot = Math.min(slots - 1, Math.floor(i * slots / R.length));
      paare.forEach(([h, a]) => spiele.push({ h, a, slot, th: null, ta: null }));
    });
    return { name, verband, teams: teams.slice(), spiele };
  }
  function tabelle(g) {
    const z = {}; g.teams.forEach(t => { z[t] = { t, sp: 0, s: 0, u: 0, n: 0, tf: 0, tg: 0, p: 0 }; });
    g.spiele.forEach(s => {
      if (s.th == null) return;
      const H = z[s.h], A = z[s.a]; if (!H || !A) return;
      H.sp++; A.sp++; H.tf += s.th; H.tg += s.ta; A.tf += s.ta; A.tg += s.th;
      if (s.th > s.ta) { H.s++; A.n++; H.p += 3; } else if (s.th < s.ta) { A.s++; H.n++; A.p += 3; } else { H.u++; A.u++; H.p++; A.p++; }
    });
    return Object.values(z).sort((a, b) => b.p - a.p || (b.tf - b.tg) - (a.tf - a.tg) || b.tf - a.tf || staerke(b.t) - staerke(a.t));
  }
  // Töpfe nach Stärke, je Gruppe eines aus jedem Topf
  function auslosen(teams, anzahl) {
    const sortiert = teams.slice().sort((a, b) => staerke(b) - staerke(a));
    const gr = Array.from({ length: anzahl }, () => []);
    for (let i = 0; i < sortiert.length; i += anzahl) {
      const topf = mische(sortiert.slice(i, i + anzahl));
      const ziel = mische(gr.map((g, k) => k)).sort((x, y) => gr[x].length - gr[y].length);
      topf.forEach((t, j) => gr[ziel[j]].push(t));
    }
    return gr;
  }
  const BUCHST = 'ABCDEFGHIJKL';

  // ── Zyklus anlegen ─────────────────────────────────────────────────────────
  function gastgeberVon(T, typ) {
    if (CFG.gastgeber[T]) return CFG.gastgeber[T].slice();
    const z = zustand(), zuletzt = new Set(((z && z.historie) || []).slice(-3).flatMap(h => h.gastgeber || []));
    const pool = N().alle().filter(n => (typ === 'EM' ? n.verband === 'UEFA' : true) && !zuletzt.has(n.name))
      .sort((a, b) => b.basis - a.basis).slice(0, typ === 'EM' ? 14 : 24);
    return [pool[zufall(pool.length)].name];
  }
  function zyklusAnlegen(T) {
    const typ = typVon(T), gastgeber = gastgeberVon(T, typ), alle = N().alle();
    const startJahr = T - 2;
    const fenster = CFG.fenster.map(([o, w]) => [startJahr + o, w]);
    const SLOTS = fenster.length * 2;
    const ohne = verband => alle.filter(n => n.verband === verband && !gastgeber.includes(n.name)).map(n => n.name);
    const quali = [];
    const uefaGruppen = (teams, n) => auslosen(teams, n).map((t, i) => gruppe(BUCHST[i], 'UEFA', t, SLOTS));
    let regeln;
    if (typ === 'EM') {
      const gr = uefaGruppen(ohne('UEFA'), 10); gr.forEach(g => quali.push(g));
      regeln = { UEFA: { direkt: 2, playoffWege: Math.max(0, 24 - gastgeber.length - 20) } };
    } else {
      const hostIn = v => gastgeber.filter(h => (N().get(h) || {}).verband === v).length;
      const P = v => CFG.wmPlaetze[v] - hostIn(v);
      uefaGruppen(ohne('UEFA'), 10).forEach(g => quali.push(g));
      quali.push(gruppe('Südamerika', 'CONMEBOL', mische(ohne('CONMEBOL')), SLOTS));
      auslosen(ohne('CAF'), P('CAF')).forEach((t, i) => quali.push(gruppe('Afrika ' + BUCHST[i], 'CAF', t, SLOTS)));
      auslosen(ohne('AFC'), 6).forEach((t, i) => quali.push(gruppe('Asien ' + BUCHST[i], 'AFC', t, SLOTS)));
      auslosen(ohne('CONCACAF'), 6).forEach((t, i) => quali.push(gruppe('Nord-/Mittelamerika ' + BUCHST[i], 'CONCACAF', t, SLOTS)));
      quali.push(gruppe('Ozeanien', 'OFC', ohne('OFC'), SLOTS));
      regeln = { UEFA: { direkt: 1, playoffWege: Math.max(0, P('UEFA') - 10) }, CONMEBOL: { plaetze: P('CONMEBOL') },
        CAF: { plaetze: P('CAF') }, AFC: { plaetze: P('AFC') }, CONCACAF: { plaetze: P('CONCACAF') }, OFC: { plaetze: P('OFC') } };
    }
    // Termine je Spieltag-Slot
    const termine = []; fenster.forEach(([j, w]) => { termine.push([j, w]); termine.push([j, w]); });
    const z = {
      T, typ, gastgeber, quali, regeln, termine,
      playoffTermin: [startJahr + CFG.playoffWoche[0], CFG.playoffWoche[1]],
      playoffs: null, ic: null, qualifiziert: null, endrunde: null, gemeldet: {}
    };
    return z;
  }

  // ── Fällige Spiele nachholen (jede Woche; auch nach dem Laden eines alten Stands) ──
  const meine = () => {
    const l = new Set(['Deutschland']);
    try { SQUAD.forEach(p => { if (p && p.country && kader(p.country).some(e => e.p === p)) l.add(p.country); }); } catch (e) { /* ohne Kader */ }
    return l;
  };
  let LETZTE = null;   // Partien dieses Fensters je Nation (für Berufungen und die Meldung)
  function spieleSlot(z, slot) {
    const out = [];
    z.quali.forEach(g => g.spiele.forEach(s => {
      if (s.slot !== slot || s.th != null) return;
      [s.th, s.ta] = tore(s.h, s.a, true);
      out.push({ h: s.h, a: s.a, th: s.th, ta: s.ta, wettbewerb: (z.typ === 'EM' ? 'EM-Qualifikation' : 'WM-Qualifikation'), gruppe: g.name });
    }));
    return out;
  }
  function nachholen() {
    const z0 = zustand(); if (!z0 || !N()) return;
    let z = z0.zyklus;
    if (!z) {
      const sj = jahrJetzt();
      z = z0.zyklus = zyklusAnlegen(sj + (sj % 2 === 0 ? 2 : 1));
      auslosungMelden(z);
    }
    const now = jetzt(), partien = [];
    z.termine.forEach(([j, w], slot) => {
      if (zeitpunkt(j, w) > now) return;
      spieleSlot(z, slot).forEach(p => partien.push(p));
    });
    if (!z.playoffs && zeitpunkt(z.playoffTermin[0], z.playoffTermin[1]) <= now && z.quali.every(g => g.spiele.every(s => s.th != null))) {
      playoffs(z).forEach(p => partien.push(p));
    }
    if (partien.length) { LETZTE = { k: now, partien }; fensterMelden(z, partien); }
  }

  // ── Playoffs und Teilnehmer ────────────────────────────────────────────────
  function rangliste(gruppen, platz) {
    return gruppen.map(g => { const t = tabelle(g)[platz - 1]; return t ? Object.assign({ gr: g.name, quote: t.p / Math.max(1, t.sp) }, t) : null; })
      .filter(Boolean).sort((a, b) => b.quote - a.quote || (b.tf - b.tg) - (a.tf - a.tg) || b.tf - a.tf);
  }
  function playoffs(z) {
    const partien = [], quali = new Set(z.gastgeber), wege = [];
    const uefa = z.quali.filter(g => g.verband === 'UEFA');
    const R = z.regeln.UEFA;
    uefa.forEach(g => tabelle(g).slice(0, R.direkt).forEach(t => quali.add(t.t)));
    // Kandidaten: nächste Plätze nach Quote
    let kand = [];
    for (let platz = R.direkt + 1; platz <= 6 && kand.length < R.playoffWege * 4; platz++) kand = kand.concat(rangliste(uefa, platz).map(t => t.t));
    kand = kand.slice(0, R.playoffWege * 4);
    const p = R.playoffWege;
    for (let i = 0; i < p; i++) {
      const vier = [kand[i], kand[4 * p - 1 - i], kand[2 * p - 1 - i], kand[2 * p + i]].filter(Boolean);
      if (vier.length < 4) continue;
      const hf1 = koSpiel(vier[0], vier[1], true), hf2 = koSpiel(vier[2], vier[3], true);
      const heimF = staerke(hf1.sieger) >= staerke(hf2.sieger);
      const fin = koSpiel(heimF ? hf1.sieger : hf2.sieger, heimF ? hf2.sieger : hf1.sieger, true);
      quali.add(fin.sieger);
      wege.push({ name: 'Weg ' + BUCHST[i], spiele: [hf1, hf2, fin] });
      [hf1, hf2, fin].forEach((s, k) => partien.push({ h: s.a, a: s.b, th: s.ta, ta: s.tb, zusatz: s.zusatz, wettbewerb: (k < 2 ? 'Playoff-Halbfinale' : 'Playoff-Finale') }));
    }
    z.playoffs = wege;
    if (z.typ === 'WM') {
      const ic = [];
      const plaetzeAus = (verband, n) => {
        const gr = z.quali.filter(g => g.verband === verband);
        if (gr.length === 1) { const t = tabelle(gr[0]); t.slice(0, n).forEach(x => quali.add(x.t)); return t.slice(n).map(x => x.t); }
        const sieger = rangliste(gr, 1).map(x => x.t), zweite = rangliste(gr, 2).map(x => x.t);
        const reihe = sieger.concat(zweite, rangliste(gr, 3).map(x => x.t));
        reihe.slice(0, n).forEach(t => quali.add(t));
        return reihe.slice(n);
      };
      ['CONMEBOL', 'CAF', 'AFC', 'CONCACAF', 'OFC'].forEach(v => {
        const rest = plaetzeAus(v, z.regeln[v].plaetze);
        rest.slice(0, CFG.icPlaetze[v]).forEach(t => ic.push(t));
      });
      // Interkontinentale Playoffs: zwei Gesetzte warten im Finale
      ic.sort((a, b) => staerke(b) - staerke(a));
      if (ic.length >= 6) {
        const h1 = koSpiel(ic[2], ic[5], false), h2 = koSpiel(ic[3], ic[4], false);
        const f1 = koSpiel(ic[0], h2.sieger, false), f2 = koSpiel(ic[1], h1.sieger, false);
        quali.add(f1.sieger); quali.add(f2.sieger);
        z.ic = { teams: ic.slice(0, 6), spiele: [h1, h2, f1, f2] };
        [h1, h2, f1, f2].forEach(s => partien.push({ h: s.a, a: s.b, th: s.ta, ta: s.tb, zusatz: s.zusatz, wettbewerb: 'Interkontinentale Playoffs' }));
      }
    }
    // Feld exakt füllen (Sicherheit): fehlende Plätze an die stärksten Nicht-Qualifizierten
    const soll = z.typ === 'EM' ? 24 : 48;
    const liste = [...quali];
    if (liste.length < soll) {
      const verb = z.typ === 'EM' ? ['UEFA'] : null;
      N().alle().filter(n => !quali.has(n.name) && (!verb || verb.includes(n.verband))).sort((a, b) => staerke(b.name) - staerke(a.name))
        .slice(0, soll - liste.length).forEach(n => liste.push(n.name));
    }
    z.qualifiziert = liste.slice(0, soll);
    qualiMelden(z);
    return partien;
  }

  // ── Endrunde (Sommer: beim Wechsel ins Turnierjahr) ─────────────────────────
  function endrunde(z) {
    const teams = (z.qualifiziert || []).slice();
    const nG = z.typ === 'EM' ? 6 : 12;
    // Topf 1: Gastgeber zuerst, dann nach Stärke
    const sortiert = teams.sort((a, b) => (z.gastgeber.includes(b) - z.gastgeber.includes(a)) || staerke(b) - staerke(a));
    const gr = Array.from({ length: nG }, () => []);
    for (let i = 0; i < sortiert.length; i += nG) {
      const topf = sortiert.slice(i, i + nG);
      const erst = i === 0 ? topf.splice(0, Math.min(z.gastgeber.length, nG)) : [];
      mische(topf);
      erst.concat(topf).forEach((t, j) => gr[j].push(t));
    }
    const gruppen = gr.map((t, i) => {
      const g = gruppe(BUCHST[i], 'END', t, 3, true);
      g.spiele.forEach(s => { const heimH = z.gastgeber.includes(s.h); [s.th, s.ta] = tore(s.h, s.a, heimH); });
      return g;
    });
    // Weiter: Erste, Zweite, beste Dritte
    const erste = gruppen.map(g => Object.assign({ gr: g.name, platz: 1 }, tabelle(g)[0]));
    const zweite = gruppen.map(g => Object.assign({ gr: g.name, platz: 2 }, tabelle(g)[1]));
    const dritte = rangliste(gruppen, 3).slice(0, z.typ === 'EM' ? 4 : 8).map(t => Object.assign({ platz: 3 }, t));
    const weiter = erste.concat(zweite, dritte).sort((a, b) => a.platz - b.platz || b.p - a.p || (b.tf - b.tg) - (a.tf - a.tg));
    let runde = weiter.map(t => t.t);
    // Setzliste 1–n gegen n–1, Gruppengegner möglichst nicht sofort wieder
    const rundenNamen = runde.length === 32 ? ['Sechzehntelfinale', 'Achtelfinale', 'Viertelfinale', 'Halbfinale', 'Finale'] : ['Achtelfinale', 'Viertelfinale', 'Halbfinale', 'Finale'];
    const ko = [];
    let erstePaarung = true;
    rundenNamen.forEach(name => {
      const spiele = [];
      if (erstePaarung) {
        const n = runde.length, paare = [];
        for (let i = 0; i < n / 2; i++) paare.push([runde[i], runde[n - 1 - i]]);
        erstePaarung = false;
        paare.forEach(([a, b]) => spiele.push(koSpiel(a, b, z.gastgeber.includes(a))));
      } else {
        for (let i = 0; i < runde.length; i += 2) spiele.push(koSpiel(runde[i], runde[i + 1], z.gastgeber.includes(runde[i])));
      }
      ko.push({ name, spiele });
      runde = spiele.map(s => s.sieger);
    });
    const finale = ko[ko.length - 1].spiele[0];
    z.endrunde = { gruppen, ko, sieger: finale.sieger, zweiter: finale.sieger === finale.a ? finale.b : finale.a };
    // Rundenweit erreicht je Nation
    const erreicht = {}; teams.forEach(t => { erreicht[t] = 'Vorrunde'; });
    ko.forEach(r => r.spiele.forEach(s => { erreicht[s.a] = r.name; erreicht[s.b] = r.name; }));
    erreicht[finale.sieger] = 'Titel';
    z.endrunde.erreicht = erreicht;
    return z.endrunde;
  }
  // Spiele einer Nation in der Endrunde (für Einsätze und Tore deiner Spieler)
  function endrundeSpiele(z, land) {
    const out = [];
    (z.endrunde.gruppen || []).forEach(g => g.spiele.forEach(s => { if (s.h === land) out.push([s.th, s.a]); else if (s.a === land) out.push([s.ta, s.h]); }));
    (z.endrunde.ko || []).forEach(r => r.spiele.forEach(s => { if (s.a === land) out.push([s.ta, s.b]); else if (s.b === land) out.push([s.tb, s.a]); }));
    return out;
  }
  function tourSpieler(z) {
    const zeilen = [];
    try {
      SQUAD.forEach(p => {
        if (!p || !p.country || !z.qualifiziert.includes(p.country)) return;
        const k = kader(p.country, CFG.turnierKader), i = k.findIndex(e => e.p === p);
        if (i < 0) return;
        const elf = !!k[i].elf;
        const NT = p.national = p.national || { a: 0, t: 0, u21: 0 };
        let spiele = 0, tg = 0;
        endrundeSpiele(z, p.country).forEach(([teamTore]) => {
          if (!elf && Math.random() < 0.5) return;
          spiele++;
          for (let g = 0; g < teamTore; g++) if (Math.random() < (CFG.torAnteil[p.pos] || 0.05) * (elf ? 1 : 0.4)) tg++;
        });
        if (!NT.a && spiele && W.KSKarten && KSKarten.vergeben) KSKarten.vergeben(p, 'nationalspieler', { grund: 'Erste Berufung für ' + p.country });
        NT.a += spiele; NT.t += tg;
        (NT.turniere = NT.turniere || []).push({ typ: z.typ, jahr: z.T, erreicht: z.endrunde.erreicht[p.country], spiele, tore: tg });
        if (z.endrunde.sieger === p.country && typeof W.addMorale === 'function') W.addMorale([p], 8);
        if (typeof computeMarketValue === 'function' && (tg >= 2 || z.endrunde.sieger === p.country)) p.value = computeMarketValue(p);
        zeilen.push(`${flagge(p.country)} ${voll(p)}: ${spiele} ${spiele === 1 ? 'Spiel' : 'Spiele'}${tg ? ', ' + tg + (tg === 1 ? ' Tor' : ' Tore') : ''} (${z.endrunde.erreicht[p.country]})`);
      });
    } catch (e) { console.warn('[Kickstil-Länderspiele] Turnierspieler', e); }
    return zeilen;
  }
  function sommer() {
    const z0 = zustand(); if (!z0 || !N()) return;
    nachholen();
    const z = z0.zyklus;
    if (!z || jahrJetzt() < z.T || z.endrunde) return;
    if (!z.qualifiziert) { const q = playoffs(z); if (!q) return; }
    const e = endrunde(z);
    const zeilen = tourSpieler(z);
    const fin = e.ko[e.ko.length - 1].spiele[0];
    z0.historie.push({ typ: z.typ, jahr: z.T, gastgeber: z.gastgeber, sieger: e.sieger, zweiter: e.zweiter, finale: `${fin.a} – ${fin.b} ${fin.ta}:${fin.tb}${fin.zusatz}`, de: e.erreicht.Deutschland || (z.qualifiziert.includes('Deutschland') ? 'Vorrunde' : 'nicht qualifiziert') });
    if (typeof addNews === 'function') {
      addNews('cup', `🏆 ${flagge(e.sieger)} ${e.sieger} ist ${z.typ === 'EM' ? 'Europameister' : 'Weltmeister'} ${z.T}`,
        `Finale: ${fin.a} – ${fin.b} ${fin.ta}:${fin.tb}${fin.zusatz}. ${flagge('Deutschland')} Deutschland: ${z0.historie[z0.historie.length - 1].de}.` +
        (zeilen.length ? ' Deine Spieler beim Turnier: ' + zeilen.join(' · ') + '.' : ''));
    }
    // Nächster Zyklus
    z0.letzteEndrunde = { typ: z.typ, T: z.T, gastgeber: z.gastgeber, endrunde: z.endrunde, qualifiziert: z.qualifiziert };
    z0.zyklus = zyklusAnlegen(z.T + 2);
    auslosungMelden(z0.zyklus);
  }

  // ── Meldungen ──────────────────────────────────────────────────────────────
  function gruppeVon(z, land) { return z.quali.find(g => g.teams.includes(land)) || null; }
  function auslosungMelden(z) {
    if (typeof addNews !== 'function') return;
    const g = gruppeVon(z, 'Deutschland');
    const txt = g ? `Deutschland trifft in Gruppe ${g.name} auf ${g.teams.filter(t => t !== 'Deutschland').map(t => flagge(t) + ' ' + t).join(', ')}.` : 'Deutschland ist als Gastgeber gesetzt.';
    addNews('club', `🌍 ${z.typ}-Qualifikation ${z.T}: Auslosung`, `${TITEL[z.typ]} ${z.T} in ${z.gastgeber.join(', ')}. ${txt} Gespielt wird in den Länderspielpausen – alles im Europa-Reiter unter „Nationalteams“.`);
  }
  function fensterMelden(z, partien) {
    if (typeof addNews !== 'function') return;
    const wichtig = meine();
    const zeilen = partien.filter(p => wichtig.has(p.h) || wichtig.has(p.a))
      .map(p => `${flagge(p.h)} ${p.h} – ${p.a} ${flagge(p.a)} ${p.th}:${p.ta}${p.zusatz || ''}`);
    if (!zeilen.length) return;
    const g = gruppeVon(z, 'Deutschland');
    let stand = '';
    if (g) { const t = tabelle(g), i = t.findIndex(x => x.t === 'Deutschland'); if (i >= 0) stand = ` Deutschland ist ${i + 1}. der Gruppe ${g.name} (${t[i].p} Punkte).`; }
    addNews('club', `🌍 ${partien[0].wettbewerb}: ${zeilen.length === 1 ? zeilen[0] : zeilen.length + ' Spiele'}`, zeilen.join(' · ') + '.' + stand);
  }
  function qualiMelden(z) {
    if (typeof addNews !== 'function') return;
    const de = z.qualifiziert.includes('Deutschland');
    const andere = [...meine()].filter(l => l !== 'Deutschland');
    const dabei = andere.filter(l => z.qualifiziert.includes(l)), raus = andere.filter(l => !z.qualifiziert.includes(l));
    addNews('club', `🌍 ${z.typ} ${z.T}: ${de ? 'Deutschland ist dabei' : 'Deutschland verpasst die Endrunde'}`,
      `${z.qualifiziert.length} Teams fahren zur ${TITEL[z.typ]} ${z.T}.` +
      (dabei.length ? ` Mit dabei: ${dabei.map(l => flagge(l) + ' ' + l).join(', ')}.` : '') +
      (raus.length ? ` Nicht dabei: ${raus.map(l => flagge(l) + ' ' + l).join(', ')}.` : ''));
  }

  // ── Berufung deiner Spieler (kickstil_national.js) ──────────────────────────
  function berufung(p) {
    const z0 = zustand(); if (!z0 || !p || !p.country || !N()) return null;
    const k = kader(p.country), i = k.findIndex(e => e.p === p);
    if (i < 0) return null;
    const startelf = !!k[i].elf, partien = (LETZTE && LETZTE.k === jetzt() ? LETZTE.partien : []).filter(x => x.h === p.country || x.a === p.country);
    const spiele = [];
    const liste = partien.length ? partien : (() => {
      // Kein Pflichtspiel in diesem Fenster (z. B. Gastgeber): zwei Testspiele gegen ähnlich starke Gegner
      const s = staerke(p.country);
      const geg = N().alle().filter(n => n.name !== p.country).sort((a, b) => Math.abs(staerke(a.name) - s) - Math.abs(staerke(b.name) - s)).slice(0, 8);
      return [0, 1].map(() => { const g = geg[zufall(geg.length)].name, [a, b] = tore(p.country, g, true); return { h: p.country, a: g, th: a, ta: b, wettbewerb: 'Testspiel' }; });
    })();
    liste.slice(0, 2).forEach(x => {
      if (!startelf && Math.random() < 0.45) return;
      const heim = x.h === p.country, teamTore = heim ? x.th : x.ta, geg = heim ? x.a : x.h;
      let t = 0; for (let g = 0; g < teamTore; g++) if (Math.random() < (CFG.torAnteil[p.pos] || 0.05) * (startelf ? 1 : 0.4)) t++;
      spiele.push({ gegner: geg, ergebnis: heim ? `${x.th}:${x.ta}` : `${x.ta}:${x.th}`, tore: t, wettbewerb: x.wettbewerb });
    });
    return { startelf, spiele };
  }

  // ── Anzeige: Europa-Reiter → „Nationalteams“ ───────────────────────────────
  function tabHtml(g, hervor) {
    const t = tabelle(g);
    return `<div class="ksl-gr"><div class="ksl-gr-kopf">${esc(g.verband === 'UEFA' || g.verband === 'END' ? 'Gruppe ' + g.name : g.name)}</div>
      <table class="eu-table ksl-tab"><thead><tr><th>#</th><th style="text-align:left">Team</th><th>Sp</th><th>Diff</th><th>Pkt</th></tr></thead><tbody>` +
      t.map((x, i) => `<tr class="${hervor.has(x.t) ? 'eu-row-fcm' : ''}"><td class="eu-pos">${i + 1}</td><td class="eu-team">${flagge(x.t)} ${esc(x.t)}</td><td>${x.sp}</td><td>${x.tf - x.tg >= 0 ? '+' : ''}${x.tf - x.tg}</td><td class="eu-pts"><b>${x.p}</b></td></tr>`).join('') +
      `</tbody></table></div>`;
  }
  const spielZeile = s => `<div class="ksl-sp"><span>${flagge(s.a)} ${esc(s.a)}</span><b>${s.ta}:${s.tb}${esc(s.zusatz || '')}</b><span>${esc(s.b)} ${flagge(s.b)}</span></div>`;
  function html() {
    const z0 = zustand(); if (!z0) return '<div class="eu-empty">Noch kein Spiel gestartet.</div>';
    if (!z0.zyklus) nachholen();
    const z = z0.zyklus, hervor = meine();
    const gespielt = z.quali.reduce((a, g) => a + g.spiele.filter(s => s.th != null).length, 0), gesamt = z.quali.reduce((a, g) => a + g.spiele.length, 0);
    const naechst = z.termine.find(([j, w]) => zeitpunkt(j, w) > jetzt());
    const phase = z.qualifiziert ? 'Qualifikation abgeschlossen – Endrunde im Sommer ' + z.T
      : naechst ? `nächste Länderspiele: KW ${naechst[1]} (${naechst[0]}/${String(naechst[0] + 1).slice(2)})` : 'Playoffs in KW ' + z.playoffTermin[1];
    let h = `<div class="ksl-kopf"><div class="ksl-titel"><i class="ti ti-${z.typ === 'EM' ? 'trophy' : 'world'}" aria-hidden="true"></i> ${TITEL[z.typ]} ${z.T} · Qualifikation</div>
      <div class="ksl-unter">Gastgeber: ${z.gastgeber.map(g => flagge(g) + ' ' + esc(g)).join(', ')} · ${gespielt}/${gesamt} Spiele · ${esc(phase)}</div></div>`;
    // Deine Nationalspieler
    try {
      const ns = SQUAD.filter(p => p && p.country).map(p => ({ p, e: kader(p.country).find(e => e.p === p) })).filter(x => x.e);
      if (ns.length) h += `<div class="ksl-box"><b>Deine Nationalspieler</b><div class="ksl-ns">` + ns.map(x => `<span>${flagge(x.p.country)} ${esc(voll(x.p))} <small>${x.e.elf ? 'Stammspieler' : 'Kader'} · ${(x.p.national && x.p.national.a) || 0} Länderspiele</small></span>`).join('') + `</div></div>`;
    } catch (e) { /* ohne Kader */ }
    if (z.qualifiziert) {
      h += `<div class="ksl-box"><b>Qualifiziert (${z.qualifiziert.length})</b><div class="ksl-ns">` + z.qualifiziert.slice().sort((a, b) => staerke(b) - staerke(a)).map(t => `<span class="${hervor.has(t) ? 'ksl-mein' : ''}">${flagge(t)} ${esc(t)}</span>`).join('') + `</div></div>`;
    }
    if (z.playoffs && z.playoffs.length) h += `<div class="ksl-box"><b>Playoffs</b>` + z.playoffs.map(w => `<div class="ksl-weg"><small>${esc(w.name)}</small>${w.spiele.map(spielZeile).join('')}</div>`).join('') + `</div>`;
    if (z.ic) h += `<div class="ksl-box"><b>Interkontinentale Playoffs</b>${z.ic.spiele.map(spielZeile).join('')}</div>`;
    // Gruppen: deine zuerst, dann nach Verband
    const sort = z.quali.slice().sort((a, b) => (b.teams.some(t => hervor.has(t)) - a.teams.some(t => hervor.has(t))));
    const verb = { UEFA: 'Europa', CONMEBOL: 'Südamerika', CAF: 'Afrika', AFC: 'Asien', CONCACAF: 'Nord-/Mittelamerika', OFC: 'Ozeanien' };
    const reihen = {};
    sort.forEach(g => { (reihen[g.verband] = reihen[g.verband] || []).push(g); });
    Object.keys(reihen).sort((a, b) => (a === 'UEFA' ? -1 : b === 'UEFA' ? 1 : 0)).forEach(v => {
      h += `<div class="ksl-abschnitt">${esc(verb[v] || v)}${v === 'UEFA' ? ` · ${z.typ === 'EM' ? 'Erste und Zweite direkt, Rest über Playoffs' : 'Gruppensieger direkt, Rest über Playoffs'}` : ''}</div><div class="ksl-gitter">` + reihen[v].map(g => tabHtml(g, hervor)).join('') + '</div>';
    });
    // Letzte Endrunde und Siegerliste
    const L = z0.letzteEndrunde;
    if (L && L.endrunde) {
      h += `<div class="ksl-abschnitt">${esc(TITEL[L.typ])} ${L.T} · K.-o.-Runde</div><div class="ksl-gitter">` +
        L.endrunde.ko.map(r => `<div class="ksl-gr"><div class="ksl-gr-kopf">${esc(r.name)}</div>${r.spiele.map(spielZeile).join('')}</div>`).join('') + '</div>';
    }
    if (z0.historie.length) h += `<div class="ksl-box"><b>Turniersieger</b>` + z0.historie.slice().reverse().map(x => `<div class="ksl-hist"><span>${x.typ} ${x.jahr}</span><b>${flagge(x.sieger)} ${esc(x.sieger)}</b><small>${esc(x.finale)} · DE: ${esc(x.de)}</small></div>`).join('') + '</div>';
    // Rangliste
    const top = N().alle().map(n => ({ n: n.name, s: staerke(n.name) })).sort((a, b) => b.s - a.s).slice(0, 20);
    // Rückmeldung 18.10.: Power-Ranking ohne genaue Stärkezahlen
    h += `<div class="ksl-box"><b>Power-Ranking</b><ol class="ksl-power">` + top.map((x, i) => `<li class="${hervor.has(x.n) ? 'ksl-mein' : ''}${i < 3 ? ' ksl-top' : ''}"><span class="ksl-pl">${i + 1}</span>${flagge(x.n)} ${esc(x.n)}</li>`).join('') + '</ol></div>';
    return h;
  }
  const CSS = `
    .ksl-kopf{margin:4px 0 10px}.ksl-titel{font-weight:700;font-size:15px}.ksl-unter{font-size:12px;color:var(--text2)}
    .ksl-box{background:var(--card,rgba(127,127,127,.06));border-radius:12px;padding:10px 12px;margin:8px 0;font-size:13px}
    .ksl-ns,.ksl-rang{display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:6px}.ksl-ns small{color:var(--text2)}
    .ksl-mein{font-weight:700;color:var(--accent,#2c7cb5)}
    .ksl-power{list-style:none;padding:0;margin:8px 0 0;display:grid;grid-template-columns:1fr 1fr;gap:4px 12px}
    .ksl-power li{display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid rgba(127,127,127,.15)}
    .ksl-pl{min-width:22px;height:22px;border-radius:7px;display:inline-grid;place-items:center;font:700 11px/1 var(--font-zahl,system-ui);background:rgba(127,127,127,.15)}
    .ksl-top .ksl-pl{background:var(--k-gold,#c9a227);color:#2b1a05}
    .ksl-abschnitt{font-weight:700;font-size:13px;margin:14px 0 6px;color:var(--text2)}
    .ksl-gitter{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px}
    .ksl-gr{background:var(--card,rgba(127,127,127,.06));border-radius:12px;padding:8px}
    .ksl-gr-kopf{font-weight:700;font-size:12px;margin:0 0 4px 2px}
    .ksl-tab{font-size:12px;width:100%}.ksl-tab td,.ksl-tab th{padding:3px 4px}
    .ksl-sp{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;font-size:12px;padding:3px 0}.ksl-sp span:last-child{text-align:right}
    .ksl-weg{margin-top:6px}.ksl-weg small{color:var(--text2)}
    .ksl-hist{display:grid;grid-template-columns:70px auto 1fr;gap:10px;align-items:baseline;padding:3px 0}.ksl-hist small{color:var(--text2)}
    #eu-sub-laender{padding-top:12px}`;
  function reiterEinbauen() {
    const tabs = document.getElementById('eu-comp-tabs');
    if (!tabs || document.getElementById('eu-tab-laender')) return;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const b = document.createElement('button');
    b.className = 'subtab'; b.id = 'eu-tab-laender'; b.innerHTML = '<i class="ti ti-flag" aria-hidden="true"></i> Nationalteams';
    tabs.appendChild(b);
    const sub = document.createElement('div'); sub.className = 'subview'; sub.id = 'eu-sub-laender';
    const ko = document.getElementById('eu-sub-ko'); if (ko && ko.parentNode) ko.parentNode.appendChild(sub);
    const modus = an => {
      ['eu-phase-tabs', 'eu-sub-tabelle', 'eu-sub-ko'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = an ? 'none' : ''; });
      sub.classList.toggle('active', an); sub.style.display = an ? '' : 'none';
    };
    b.addEventListener('click', () => {
      tabs.querySelectorAll('.subtab').forEach(x => x.classList.remove('active')); b.classList.add('active');
      modus(true);
      try { sub.innerHTML = html(); } catch (e) { sub.innerHTML = '<div class="eu-empty">Länderspiele konnten nicht angezeigt werden.</div>'; console.warn('[Kickstil-Länderspiele] Anzeige', e); }
    });
    modus(false);
    if (typeof W.switchEuroComp === 'function') {
      const _s = W.switchEuroComp;
      W.switchEuroComp = function () { modus(false); return _s.apply(this, arguments); };
      try { switchEuroComp = W.switchEuroComp; } catch (e) { /* window reicht */ }
    }
  }

  // ── Haken ──────────────────────────────────────────────────────────────────
  if (typeof W.advanceCalendarWeek === 'function') {
    const _w = W.advanceCalendarWeek;
    W.advanceCalendarWeek = function () {
      const r = _w.apply(this, arguments);
      try { if (r && hatSpiel()) nachholen(); } catch (e) { console.warn('[Kickstil-Länderspiele] Woche', e); }
      return r;
    };
    try { advanceCalendarWeek = W.advanceCalendarWeek; } catch (e) { /* window reicht */ }
  }
  if (typeof W.startNewSeason === 'function') {
    const _s = W.startNewSeason;
    W.startNewSeason = function () {
      const r = _s.apply(this, arguments);
      try { if (hatSpiel()) sommer(); } catch (e) { console.warn('[Kickstil-Länderspiele] Sommer', e); }
      try { if (hatSpiel()) pflege('saison'); } catch (e) { console.warn('[Kickstil-Länderspiele] Pflege', e); }
      return r;
    };
    try { startNewSeason = W.startNewSeason; } catch (e) { /* window reicht */ }
  }
  // Neues Spiel (und alter Spielstand, solange Saison 1): einmal die Spielerbasis aller echten Nationen anlegen
  function saat() {
    const z0 = zustand(); if (!z0 || z0.saat) return;
    z0.saat = 1;
    if ((LEAGUE.season || 1) === 1) pflege('start');
  }
  const start = () => { try { reiterEinbauen(); if (hatSpiel()) { saat(); nachholen(); } } catch (e) { console.warn('[Kickstil-Länderspiele] Start', e); } };
  if (typeof W._afterLoad === 'function') {
    const _a = W._afterLoad;
    W._afterLoad = function () { const r = _a.apply(this, arguments); setTimeout(start, 0); return r; };
    try { _afterLoad = W._afterLoad; } catch (e) { /* window reicht */ }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(start, 50)); else setTimeout(start, 50);

  W.KSLaender = { zustand, staerke, kader, berufung, html, nachholen, sommer, tabelle, pflege, echt: echtLand, CFG, fenster: () => LETZTE,
    intern: { zyklusAnlegen, spieleSlot, playoffs, endrunde, spender, vereinsSpieler, weltIndex } };   // intern: für Tests (pc_app/test)
  console.log('[Kickstil-Länderspiele v1] aktiv — EM/WM-Qualifikation mit 148 Nationen, Playoffs, Endrunde im Sommer');
})();
