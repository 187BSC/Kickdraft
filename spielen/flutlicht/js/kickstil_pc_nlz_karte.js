/* ===== kickstil_pc_nlz_karte.js =====
   KICKSTIL · NLZ AM PC, ETAPPE 2: LANDKARTE & KONKURRENZ  ·  v1   (2026-10-18)
   ─────────────────────────────────────────────────────────────────────────────
   Nur PC (wie kickstil_pc_nlz.js, an dem es als Erweiterung hängt: KSNlz.erweitern).
   Nutzerwunsch: „pro verein eine kleine region, radius mit einzugsgebiet … in ballungsräumen konkurrieren …
   konzeptionell arbeiten … mehr spieler oben durchkommen lassen … was passiert, wenn 4 jahre lang nichts kommt“.
   Vorschau 2 (Artifact Q57g8DtZcaqaJXdx6pbgTo) freigegeben.

   · Einzugsgebiet: echte Lage der Vereinsorte (data/ks_geo.js), Radius aus dem Scouting-Budget (30 km × √Wirkung,
     15–50 km; Partnervereine +10 km).
   · Konkurrenz: jedes NLZ im Umkreis zieht Toptalente nach Sternen (KI: KSAkademien.stufeVon, eigenes: Kaderniveau
     + Budget), Liga, Durchlässigkeit, Internat und Entfernung. Je neuem U9-Jahrgang werden die Toptalente der Orte
     gezogen und verteilt – die bei dir landen, sind die Auffälligen des Jahrgangs (ersetzt den Standardwurf).
   · Konzepte (höchstens 2): Weg nach oben (Zusage 20 Einsätze von Eigengewächsen je Saison, Anziehung +15 %,
     gebrochen −25 % für eine Saison), Partnervereine (60 Tsd. €/Saison, Radius +10 km), Eliteschule des Fußballs
     (40 Tsd. €/Saison, Abbrecher −20 %, Anziehung +5 %), Aussortierte holen (Spätzünder ×1,8).
   · Dürre-Uhr: Saisons ohne hochgezogenes Eigengewächs. Ab 3 fragt der Vorstand nach, ab 4 meiden Eltern dich
     (Anziehung −15 %). Konzept-Gespräch mit dem Vorstand: 2 Saisons Schonfrist (höchstens alle 4 Saisons).
   · Spielstil-Passung: Eigengewächse aus „Eigenes System“ zählen in der Taktik-Passung wie perfekt passende Spieler,
     solange der Verein den Stil behält, mit dem sie hochkamen (window.KSStilHaken in kickstil_taktik.js).
   Zustand: CLUB.welt.nlz.karte = { v, konz, wegSeit, bezahlt, wege[{jahr, ort, la, lo, ziel}], letztesHoch, schonBis,
     gespraech, bruch, warnung }.
   API: KSNlzKarte.CFG · .modell() · .ziehen(jahr)
   Lädt nach kickstil_pc_nlz.js und data/ks_geo.js, vor init_bootstrap.js.
   ============================================================================= */
(function () {
  'use strict';
  const W = window, N = W.KSNlz, G = W.KS_GEO;
  if (!N || !N.erweitern || !G || !G.orte) { console.warn('[Kickstil-PC-NLZ-Karte] KSNlz oder KS_GEO fehlt – Modul inaktiv'); return; }
  const H = N.hilfe, esc = H.esc;

  const CFG = {
    px: 5, breite: 860, hoehe: 560,                       // 5 Pixel je km → ±86 km × ±56 km sichtbar
    radius: { basis: 30, min: 15, max: 50 },                   // überregional: aus dem Scouting-Budget
    // Drei Ebenen (Nutzer 2026-10-18): lokal (fest + Partnervereine, Heimvorteil), überregional (Kampf mit der Konkurrenz,
    // ab 30 km zählt das Internat), Netzwerk (ganz Deutschland, Zufallsfunde über das Scouting)
    lokal: { basis: 15, heim: 1.8 }, internatAb: 30,
    // Partnervereine (Nutzer 2026-10-19: echte Nachbarorte, für jeden Verein): Amateurvereine bis 32 km, dort Heimvorteil im Umkreis von 6 km
    partner: { max: 5, umkreis: 6, suche: 32, kandidaten: 10 },
    netz: { jeSaison: 0.6, max: 2, wochen: [2, 37], frist: 4, alter: [13, 14] },
    liga: { bundesliga: 1.6, bundesliga2: 1.25, liga3: 1.0 }, ligaSonst: 0.75,
    talentJeEw: 2.2e-6, umland: 0.5, ohneNlz: 0.15, sammeln: 110,   // km um den eigenen Ort, aus denen Talente kommen
    duerre: { warnung: 3, malus: 4, anziehung: 0.85, schonfrist: 2, gespraechAbstand: 4 },
    weg: { zusage: 20, plus: 1.15, bruch: 0.75 },
    konzepte: {
      weg: { name: 'Weg nach oben', kosten: 0, text: 'Zusage: jede Saison 20 Einsätze von Eigengewächsen bei den Profis. Anziehung +15 %, gebrochen −25 % für eine Saison.', vorbild: 'Vorbild: Freiburg, Mainz' },
      koop: { name: 'Partnervereine', kosten: 60000, text: 'Bis zu 5 Amateurvereine in Nachbarorten arbeiten mit dir: dort hast du Heimvorteil wie vor Ort.', vorbild: 'Vorbild: Kooperationsvereine der Bundesligisten' },
      schule: { name: 'Eliteschule des Fußballs', kosten: 40000, text: 'Kooperation mit einer Schule: Abbrecher −20 %, Eltern vertrauen dir (Anziehung +5 %).', vorbild: 'Vorbild: die DFB-Eliteschulen' },
      nische: { name: 'Aussortierte holen', kosten: 0, text: 'Gezielt Kinder, die große NLZ aussortieren: fast doppelt so viele Spätzünder.', vorbild: 'Vorbild: 1860 und Union gegen ihre großen Nachbarn' }
    },
    stil: { plus: 12, max: 95 }
  };
  const $ = id => document.getElementById(id);
  const saison = () => LEAGUE.season || 1;
  const rnd = () => Math.random();
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function poisson(l) { let k = 0, p = Math.exp(-l), s = p; const u = rnd(); while (u > s && k < 30) { k++; p *= l / k; s += p; } return k; }

  // ── Zustand ────────────────────────────────────────────────────────────────────────────────────────────────────
  function kz(n) {
    if (!n.karte || n.karte.v !== 1) n.karte = { v: 1, konz: [], wegSeit: 0, bezahlt: {}, wege: [], letztesHoch: saison(), schonBis: 0, gespraech: -99, bruch: 0, warnung: 0 };
    if (!n.karte.netz) n.karte.netz = [];
    if (!n.karte.partner) n.karte.partner = [];
    return n.karte;
  }
  const hat = (n, k) => kz(n).konz.indexOf(k) >= 0;

  // ── Geografie ──────────────────────────────────────────────────────────────────────────────────────────────────
  function ortDaten(name) { const o = name && G.orte[name]; return o ? { name, la: o[0], lo: o[1], ew: o[2] } : null; }
  function cityVon(id) { try { const d = KSVerein.daten(id); return d && d.city; } catch (e) { return null; } }
  const eigenOrt = () => ortDaten(cityVon('fcm'));
  function km(a, b) { const f = Math.cos((a.la + b.la) / 2 * Math.PI / 180); return Math.hypot((a.lo - b.lo) * 111.32 * f, (a.la - b.la) * 110.57); }
  const lokalKm = () => CFG.lokal.basis;
  // Partnervereine: Kandidaten in echten Nachbarorten (KS_GEO), in Großstädten auch Stadtteilvereine
  const VOR = ['SV', 'TuS', 'FC', 'SpVgg', 'VfB', 'TSV', 'DJK', 'SC', 'VfR', 'BV'];
  const vereinName = (ort, key) => { const h = hash(key); return `${VOR[h % VOR.length]} ${ort} ${1900 + (h >>> 4) % 76}`; };
  let PK = null, PK_K = '';
  function partnerKandidaten() {
    const o0 = eigenOrt(); if (!o0) return [];
    if (PK && PK_K === o0.name) return PK;
    const f = Math.cos(o0.la * Math.PI / 180), l = [];
    Object.keys(G.orte).map(ortDaten).forEach(o => { const d = km(o, o0); if (o.name !== o0.name && d <= CFG.partner.suche) l.push(Object.assign({ key: o.name, ort: o.name, d }, o)); });
    if (o0.ew >= 150000) [['Nord', 0], ['Ost', 90], ['Süd', 180], ['West', 270]].forEach(([t, w]) => {
      const r = 5 + (hash(o0.name + t) % 3), rad = w * Math.PI / 180, ort = o0.name + '-' + t;
      l.push({ key: ort, ort, name: ort, la: o0.la + Math.cos(rad) * r / 110.57, lo: o0.lo + Math.sin(rad) * r / (111.32 * f), ew: o0.ew / 6, d: r, stadtteil: true });
    });
    l.forEach(p => { p.verein = vereinName(p.ort, p.key); p.wert = Math.sqrt(p.ew) / (p.d + 8); });
    PK = l.sort((a, b) => b.wert - a.wert).slice(0, CFG.partner.kandidaten); PK_K = o0.name;
    return PK;
  }
  function partnerListe(n) {
    if (!hat(n, 'koop')) return [];
    const k = kz(n), kand = partnerKandidaten();
    if (!k.partner.length) k.partner = kand.slice(0, CFG.partner.max).map(p => p.key);
    return kand.filter(p => k.partner.indexOf(p.key) >= 0);
  }
  function partnerSchalten(n, key) {
    const k = kz(n), i = k.partner.indexOf(key);
    if (i >= 0) { k.partner.splice(i, 1); return; }
    if (k.partner.length >= CFG.partner.max) { H.toast(`Höchstens ${CFG.partner.max} Partnervereine – beende erst eine Partnerschaft.`, 'warn'); return; }
    k.partner.push(key);
  }
  function radiusKm(n) {
    const w = N.wirkung(n), R = CFG.radius;
    return Math.max(lokalKm(n) + 5, Math.round(Math.max(R.min, Math.min(R.max, R.basis * Math.sqrt(Math.max(0.05, w.scouting))))));
  }
  // Durchlässigkeit des eigenen Vereins: Anteil der Eigengewächse am Kader (in %)
  function durchlEigen() { const sq = typeof SQUAD !== 'undefined' ? SQUAD : []; return sq.length ? Math.round(sq.filter(H.istEigengewaechs).length / sq.length * 100) : 0; }
  function niveauEigen() {
    const sq = typeof SQUAD !== 'undefined' ? SQUAD : [];
    const o = sq.map(p => typeof computeOvrFromAreas === 'function' ? computeOvrFromAreas(p) : p.ovr || 60).sort((a, b) => b - a).slice(0, 11);
    return o.length ? o.reduce((a, b) => a + b, 0) / o.length : 60;
  }
  const sterneVon = st10 => st10 <= 4 ? 1 : st10 <= 7 ? 2 : 3;

  // Alle Vereine der Ligen mit Ort (je Saison und Kaderstand gemerkt)
  let CACHE = null, CACHE_K = '';
  function vereine(n) {
    let gruppen = [];
    try { gruppen = allGroups(LEAGUE); } catch (e) { return []; }
    const k = saison() + '|' + gruppen.length + '|' + (CLUB.name || '') + '|' + Object.keys(CLUB.npcSquads || {}).length;
    if (!CACHE || CACHE_K !== k) {
      const proOrt = {};
      CACHE = [];
      gruppen.forEach(g => g.group.teams.forEach(t => {
        const eigen = t.id === 'fcm', city = cityVon(t.id), o = ortDaten(city);
        if (!o) return;
        const i = proOrt[city] = (proOrt[city] || 0) + 1;
        let la = o.la, lo = o.lo;
        if (i > 1 || (eigen && proOrt[city] > 1)) { const wkl = (hash(t.id) % 360) * Math.PI / 180, d = 2.5 + (i % 3); la += Math.sin(wkl) * d / 110.57; lo += Math.cos(wkl) * d / (111.32 * Math.cos(la * Math.PI / 180)); }
        let st10 = 3;
        if (!eigen) { try { st10 = W.KSAkademien ? KSAkademien.stufeVon(t.dataId || t.id) : 3; } catch (e) { st10 = 3; } }
        CACHE.push({ id: t.id, name: eigen ? CLUB.name : t.name, eigen, tier: g.tierKey, ort: city, la, lo, st10,
          durchl: 6 + hash(t.id + '|d|' + saison()) % 20 });
      }));
      CACHE_K = k;
    }
    // eigener Verein: immer frisch (Budget, Kader, Konzepte ändern sich unterm Jahr)
    const w = N.wirkung(n), e = CACHE.find(c => c.eigen);
    if (e) {
      e.st10 = Math.max(1, Math.min(10, Math.round((niveauEigen() - 52) / 4.5 + 1.5 * (w.trainer - 1) + 1.2 * (w.internat - 1))));
      // Etappe 3: zertifizierte NLZ-Sterne zählen zur Hälfte (1★ ≈ Stufe 2, 2★ ≈ 5,5, 3★ ≈ 9)
      const zs = W.KSNlzAusbau && KSNlzAusbau.sterne ? KSNlzAusbau.sterne(n) : 0;
      if (zs) { e.st10 = Math.max(1, Math.min(10, Math.round(e.st10 / 2 + [2, 5.5, 9][zs - 1] / 2))); e.zert = zs; }
      e.durchl = durchlEigen(); e.name = CLUB.name;
    }
    CACHE.forEach(c => { c.sterne = c.eigen && c.zert ? c.zert : sterneVon(c.st10); });
    return CACHE;
  }
  // Anzeigename (neue Vereinsnamen wie überall) und kurze Beschriftung: Ort, bei zwei Vereinen am Ort das eigene Wort
  const anzeige = name => (W.KSVereinsnamen && KSVereinsnamen.neu ? KSVereinsnamen.neu(name) : name);
  function kurzName(c, alle) {
    if (c.eigen) return 'Dein NLZ';
    if (alle.filter(x => x.ort === c.ort).length < 2) return c.ort;
    const w = String(anzeige(c.name)).split(/\s+/).filter(x => x && x !== c.ort && !/^(\d+\.?|[A-ZÄÖÜ]{1,4}|VfL|VfB|SpVgg|SSVg|II)$/.test(x));
    return w.length ? w[0] : c.ort;
  }
  const ligaName = t => ({ bundesliga: 'Erste Liga', bundesliga2: 'Zweite Liga', liga3: 'Dritte Liga' }[t] || 'Regionalliga');
  function reichweite(c, n) { return c.eigen ? radiusKm(n) : 15 + 8 * c.sterne; }
  function eigenFaktor(n) {
    const k = kz(n), s = saison();
    let f = 1;
    if (hat(n, 'weg')) f *= CFG.weg.plus;
    if (k.bruch === s) f *= CFG.weg.bruch;
    if (hat(n, 'schule')) f *= 1.05;
    if (duerreJahre(n) >= CFG.duerre.malus && !(k.schonBis >= s)) f *= CFG.duerre.anziehung;
    if (N.faktor) f *= N.faktor('anziehung', n);                                  // Ausbau (Etappe 3)
    return f;
  }
  function internat(c, n) { return c.eigen ? 0.9 + 0.1 * Math.min(2, N.wirkung(n).internat) : 0.9 + 0.1 * c.sterne; }
  function anziehung(c, d, n, ef, beiPartner) {
    if (d > reichweite(c, n)) return 0;
    let a = (0.5 + 0.15 * c.st10) * (CFG.liga[c.tier] || CFG.ligaSonst) * (1 + c.durchl / 40) * internat(c, n) * Math.exp(-d / (10 + 4 * c.sterne))   // Kinder bleiben nah; große NLZ holen weiter;
    if (d <= CFG.lokal.basis || (c.eigen && beiPartner)) a *= CFG.lokal.heim;         // lokal (und bei deinen Partnervereinen): Kinder bleiben vor Ort
    if (c.eigen && d > CFG.internatAb) a *= Math.min(1.1, 0.35 + 0.65 * N.wirkung(n).internat) * (N.faktor ? N.faktor('fern', n) : 1);   // weiter weg nur mit Internat
    return c.eigen ? a * ef : a;
  }

  // ── Ziehung: Toptalente eines neuen Jahrgangs aus den Orten um dich herum ──────────────────────────────────────
  function ziehen(n, jahr) {
    const o0 = eigenOrt(); if (!o0) return null;
    const vs = vereine(n), ef = eigenFaktor(n), k = kz(n), pl = partnerListe(n);
    const quellen = Object.keys(G.orte).map(ortDaten).filter(o => km(o, o0) <= CFG.sammeln);
    quellen.push({ name: o0.name + ' (Umland)', la: o0.la, lo: o0.lo, ew: CFG.umland / CFG.talentJeEw, umland: true });
    let auff = 0;
    const neu = [];
    quellen.forEach(o => {
      const zahl = poisson(o.ew * CFG.talentJeEw);
      if (!zahl) return;
      const beiP = pl.some(p => km(p, o) <= CFG.partner.umkreis);
      const kand = vs.map(c => ({ c, a: anziehung(c, km(o, c), n, ef, c.eigen && beiP) })).filter(x => x.a > 0);
      const summe = kand.reduce((s, x) => s + x.a, 0) + CFG.ohneNlz;
      for (let i = 0; i < zahl; i++) {
        let r = rnd() * summe, ziel = null;
        for (const x of kand) { r -= x.a; if (r <= 0) { ziel = x.c; break; } }
        if (!ziel) continue;                                                     // bleibt im Amateurverein
        if (ziel.eigen) auff++;
        const wkl = rnd() * Math.PI * 2, rr = (o.umland ? 6 : 1.5) + rnd() * 3;
        const la = o.la + Math.sin(wkl) * rr / 110.57, lo = o.lo + Math.cos(wkl) * rr / (111.32 * Math.cos(o.la * Math.PI / 180));
        if (km({ la, lo }, o0) <= 95) neu.push({ jahr, ort: o.umland ? o0.name : o.name, la: +la.toFixed(3), lo: +lo.toFixed(3), ziel: ziel.id });
      }
    });
    k.wege = k.wege.filter(w => w.jahr !== jahr).concat(neu);
    const jahre = Array.from(new Set(k.wege.map(w => w.jahr))).sort((a, b) => b - a).slice(0, 3);
    k.wege = k.wege.filter(w => jahre.indexOf(w.jahr) >= 0);
    return Math.min(4, auff);
  }

  // ── Netzwerk: Zufallsfunde aus ganz Deutschland (außerhalb des überregionalen Rings) ─────────────────────────────
  const POS_TXT = ['Torwart', 'Innenverteidiger', 'Außenverteidiger', 'Sechser', 'Spielmacher', 'Flügelspieler', 'Stürmer'];
  const ART_TXT = ['schnell wie der Wind', 'mit einem linken Fuß wie gemalt', 'Kopfballungeheuer', 'liest das Spiel wie ein Alter', 'dribbelt alles weg', 'Riesentalent, aber schüchtern'];
  function netzChance(n) { const N2 = CFG.netz; return N2.jeSaison * Math.sqrt(Math.max(0.05, N.wirkung(n).scouting)) * (N.faktor ? N.faktor('netz', n) : 1) / (N2.wochen[1] - N2.wochen[0] + 1); }
  function netzFinden(n, erzwingen) {
    const k = kz(n), s = saison(), wo = LEAGUE.week || 1, o0 = eigenOrt(); if (!o0) return null;
    if (!erzwingen && (wo < CFG.netz.wochen[0] || wo > CFG.netz.wochen[1] || k.netz.filter(f => f.saison === s).length >= CFG.netz.max || rnd() >= netzChance(n))) return null;
    const R = radiusKm(n), orte = Object.keys(G.orte).map(ortDaten).filter(o => km(o, o0) > R);
    let r = rnd() * orte.reduce((a, o) => a + Math.sqrt(o.ew), 0), ort = orte[0];
    for (const o of orte) { r -= Math.sqrt(o.ew); if (r <= 0) { ort = o; break; } }
    const f = { id: 'nf' + s + '_' + wo + '_' + Math.floor(rnd() * 1e4), saison: s, woche: wo, ort: ort.name, la: ort.la, lo: ort.lo, d: Math.round(km(ort, o0)),
      alter: CFG.netz.alter[Math.floor(rnd() * CFG.netz.alter.length)], pos: POS_TXT[Math.floor(rnd() * POS_TXT.length)], art: ART_TXT[Math.floor(rnd() * ART_TXT.length)], status: 'offen' };
    k.netz.push(f); k.netz = k.netz.slice(-12);
    if (typeof addNews === 'function') addNews('club', '🔭 NLZ-Netzwerk: Fund in ' + f.ort, `Dein Scout hat in ${f.ort} (${f.d} km) einen ${f.alter}-jährigen ${f.pos} entdeckt – ${f.art}. Holen? Entscheide im NLZ unter Landkarte (${CFG.netz.frist} Wochen Zeit).`);
    return f;
  }
  // Auslandspartner (Etappe 3): ein Fund aus Westafrika, ohne Punkt auf der Deutschlandkarte
  const AUSLAND = ['Accra (Ghana)', 'Kumasi (Ghana)', 'Tamale (Ghana)', 'Abidjan (Elfenbeinküste)', 'Lomé (Togo)'];
  function auslandFund(n) {
    const k = kz(n), s = saison(), wo = LEAGUE.week || 1;
    const f = { id: 'na' + s + '_' + wo + '_' + Math.floor(rnd() * 1e4), saison: s, woche: wo, ort: AUSLAND[Math.floor(rnd() * AUSLAND.length)], ausland: true, d: 5000,
      alter: CFG.netz.alter[Math.floor(rnd() * CFG.netz.alter.length)], pos: POS_TXT[Math.floor(rnd() * POS_TXT.length)], art: ART_TXT[Math.floor(rnd() * ART_TXT.length)], status: 'offen' };
    k.netz.push(f); k.netz = k.netz.slice(-12);
    if (typeof addNews === 'function') addNews('club', '🌍 NLZ-Auslandspartner: Fund in ' + f.ort, `Dein Partner meldet einen ${f.alter}-jährigen ${f.pos} – ${f.art}. Holen? Entscheide im NLZ unter Landkarte → Netzwerk (${CFG.netz.frist} Wochen Zeit).`);
    return f;
  }
  const annahme = (n, f) => Math.max(0.15, Math.min(0.9, 0.3 + 0.25 * Math.min(2, N.wirkung(n).internat) + 0.08 * ((vereine(n).find(c => c.eigen) || {}).sterne || 1) - (f.ausland ? 0.15 : f.d / 2000)));
  function netzEntscheiden(n, id, holen) {
    const k = kz(n), f = k.netz.find(x => x.id === id); if (!f || f.status !== 'offen') return;
    if (!holen) { f.status = 'abgelehnt'; H.toast('Abgelehnt – der Scout sucht weiter.', 'info'); return; }
    if (rnd() < annahme(n, f)) {
      f.status = 'geholt';
      const jg = n.jahrgaenge.slice().sort((a, b) => b.jahr - a.jahr), juengster = jg.length ? jg[0].jahr : 0;
      const j = jg.find(x => 9 + (juengster - x.jahr) === f.alter) || jg[jg.length - 1];
      if (j) { j.auff = Math.min(4, j.auff + 1); j.kinder += 1; f.jahr = j.jahr; }
      if (typeof addNews === 'function') addNews('club', '🔭 NLZ-Netzwerk: Zusage aus ' + f.ort, `Der ${f.alter}-jährige ${f.pos} aus ${f.ort} kommt ins Internat – Jahrgang ${f.jahr || ''} hat einen Auffälligen mehr.`);
      H.toast(`Zusage! Der ${f.pos} aus ${f.ort} kommt.`, 'success');
    } else {
      f.status = 'abgesagt';
      H.toast(`Absage – die Familie bleibt lieber in ${f.ort}.`, 'warn');
    }
    try { if (typeof saveGameState === 'function') saveGameState(); } catch (e) { /* später */ }
  }
  function netzWoche(n) {
    const k = kz(n), s = saison(), wo = LEAGUE.week || 1;
    k.netz.forEach(f => { if (f.status === 'offen' && (f.saison !== s || wo - f.woche >= CFG.netz.frist)) f.status = 'verfallen'; });
    netzFinden(n);
  }

  // ── Dürre-Uhr, Konzepte, Weg nach oben ─────────────────────────────────────────────────────────────────────────
  const duerreJahre = n => Math.max(0, saison() - kz(n).letztesHoch);
  function einsaetzeEigen(s) {
    const sq = typeof SQUAD !== 'undefined' ? SQUAD : [];
    return sq.filter(H.istEigengewaechs).reduce((sum, p) => {
      if (p.stats && p.stats.season === s) return sum + (p.stats.apps || 0);
      const h = (p.statsHistory || []).find(x => x.season === s);
      return sum + (h ? h.apps || 0 : 0);
    }, 0);
  }
  function konzeptSchalten(n, key) {
    const k = kz(n), c = CFG.konzepte[key]; if (!c) return;
    const i = k.konz.indexOf(key);
    if (i >= 0) { k.konz.splice(i, 1); H.toast(c.name + ' beendet.', 'info'); return; }
    if (k.konz.length >= 2) { H.toast('Höchstens 2 Konzepte gleichzeitig – beende erst eins.', 'warn'); return; }
    if (c.kosten && k.bezahlt[key] !== saison()) {
      if ((CLUB.budget || 0) < c.kosten) { H.toast('Dafür reicht das Budget nicht (' + H.euro(c.kosten) + ').', 'warn'); return; }
      CLUB.budget -= c.kosten; k.bezahlt[key] = saison();
    }
    k.konz.push(key);
    if (key === 'weg') k.wegSeit = (LEAGUE.week || 1) <= 4 ? saison() : saison() + 1;   // später im Jahr: Zusage zählt ab nächster Saison
    H.toast(c.name + ' gestartet' + (c.kosten ? ' · ' + H.euro(c.kosten) + ' für diese Saison' : '') + '.', 'success');
    try { if (typeof saveGameState === 'function') saveGameState(); } catch (e) { /* später */ }
  }
  function gespraechMoeglich(n) { const k = kz(n); return duerreJahre(n) >= 2 && saison() - k.gespraech >= CFG.duerre.gespraechAbstand && !(k.schonBis >= saison()); }
  function gespraech(n) {
    const k = kz(n); if (!gespraechMoeglich(n)) return;
    k.gespraech = saison(); k.schonBis = saison() + CFG.duerre.schonfrist - 1;
    if (typeof addNews === 'function') addNews('club', '🏫 NLZ: Konzept-Gespräch', `Der Vorstand gibt dem Nachwuchs ${CFG.duerre.schonfrist} Saisons Zeit. Danach will er Eigengewächse bei den Profis sehen.`);
    H.toast('Vorstand gibt dir ' + CFG.duerre.schonfrist + ' Saisons Schonfrist.', 'success');
  }
  function neueSaison(n) {
    const k = kz(n), s = saison(), news = (t, x) => { if (typeof addNews === 'function') addNews('club', t, x); };
    // Konzepte kosten je Saison
    k.konz.forEach(key => {
      const c = CFG.konzepte[key]; if (!c.kosten || k.bezahlt[key] === s) return;
      CLUB.budget = (CLUB.budget || 0) - c.kosten; k.bezahlt[key] = s;
    });
    const kost = k.konz.reduce((a, key) => a + CFG.konzepte[key].kosten, 0);
    if (kost) news('🏫 NLZ: Konzepte', `${k.konz.map(x => CFG.konzepte[x].name).join(' und ')} kosten diese Saison ${H.euro(kost)}.`);
    // Weg nach oben: Zusage der letzten Saison geprüft
    if (hat(n, 'weg') && k.wegSeit <= s - 1) {
      const e = einsaetzeEigen(s - 1);
      if (e < CFG.weg.zusage) { k.bruch = s; news('🏫 NLZ: Zusage gebrochen', `Nur ${e} von ${CFG.weg.zusage} versprochenen Einsätzen für Eigengewächse. Eltern und Talente glauben dir den Weg nach oben diese Saison nicht (Anziehung −25 %).`); }
      else news('🏫 NLZ: Zusage gehalten', `${e} Einsätze für Eigengewächse – der Weg nach oben spricht sich herum.`);
    }
    // Dürre-Uhr
    const j = duerreJahre(n);
    if (j >= CFG.duerre.warnung && !(k.schonBis >= s) && k.warnung !== s) {
      k.warnung = s;
      news('🏫 Vorstand: Wo bleibt der Nachwuchs?', j >= CFG.duerre.malus
        ? `${j} Jahre ohne neues Eigengewächs bei den Profis. Eltern meiden dein NLZ (Anziehung −15 %). Ein Konzept-Gespräch verschafft dir Zeit.`
        : `${j} Jahre ohne neues Eigengewächs bei den Profis. Der Vorstand fragt nach – im nächsten Jahr leidet dein Ruf bei den Eltern.`);
    }
    stilNachtragen();
  }

  // ── Spielstil-Passung der Eigengewächse ───────────────────────────────────────────────────────────────────────
  function eigenerStil() { try { const e = W.DFLTaktik && DFLTaktik.eigenerStil(); return e && e.stil; } catch (e) { return null; } }
  function stilNachtragen() {
    const st = eigenerStil(); if (!st || typeof SQUAD === 'undefined') return;
    SQUAD.forEach(p => { if (p.ksNlz && p.ksNlz.phil === 'system' && !p.ksNlz.stil) p.ksNlz.stil = st; });
  }
  W.KSStilHaken = function (p, stil, v) {
    const k = p && p.ksNlz;
    if (!k || k.phil !== 'system' || !H.istPc()) return v;
    if (!k.stil) { const st = eigenerStil(); if (!st) return v; k.stil = st; }
    if (k.stil !== stil) return v;
    const plus = CFG.stil.plus * (N.faktor && CLUB.welt && CLUB.welt.nlz ? N.faktor('stil', CLUB.welt.nlz) : 1);   // Lehrplan Spielidee 2: +15 %
    const ziel = Math.min(CFG.stil.max, Math.max(v, (p.ovr || 60) + plus));
    return v + (ziel - v) * Math.max(0, Math.min(1, k.st == null ? 1 : k.st));
  };

  // ── Modell für die Anzeige ─────────────────────────────────────────────────────────────────────────────────────
  function modell(n) {
    const o0 = eigenOrt(); if (!o0) return null;
    const k = kz(n), R = radiusKm(n), L = lokalKm(n), vs = vereine(n);
    const nah = vs.map(c => Object.assign({}, c, { d: c.eigen ? 0 : km(o0, c) })).filter(c => c.d <= 95);
    const gesamt = k.wege.length || 1, imR = k.wege.filter(w => km(w, o0) <= R);
    nah.forEach(c => { c.zahl = k.wege.filter(w => w.ziel === c.id).length; c.anteil = Math.round(c.zahl / gesamt * 100); c.ausR = imR.filter(w => w.ziel === c.id).length; c.reich = reichweite(c, n); });
    return { o0, R, L, nah, alle: vs, k, imR, imL: k.wege.filter(w => km(w, o0) <= L), jahre: Array.from(new Set(k.wege.map(w => w.jahr))).sort((a, b) => a - b) };
  }

  // ── Anzeige ────────────────────────────────────────────────────────────────────────────────────────────────────
  const ebene = { nlz: true, kinder: true, wege: true, bahn: true };
  let ansicht = 'gebiet';
  let gew = 'fcm';
  const FLUSS_B = { Rhein: 9, Elbe: 8, Donau: 8, Main: 6, Weser: 6, 'Spree/Havel': 5, Neckar: 5, Mosel: 5 };
  function svg(m) {
    const { o0, R } = m, px = CFG.px, cx = CFG.breite / 2, cy = CFG.hoehe / 2, f = Math.cos(o0.la * Math.PI / 180);
    const P = (la, lo) => [+(cx + (lo - o0.lo) * 111.32 * f * px).toFixed(1), +(cy + (o0.la - la) * 110.57 * px).toFixed(1)];
    const pfad = pts => { const q = pts.map(([la, lo]) => P(la, lo)); return 'M ' + q[0].join(' ') + q.slice(1).map((p, i) => { const a = q[i]; return ` Q ${a.join(' ')} ${(a[0] + p[0]) / 2} ${(a[1] + p[1]) / 2}`; }).join('') + ' L ' + q[q.length - 1].join(' '); };
    const drin = ([x, y], r) => x > -r && y > -r && x < CFG.breite + r && y < CFG.hoehe + r;
    let h = '';
    // Orte als Flächen
    const orte = Object.keys(G.orte).map(ortDaten).filter(o => km(o, o0) <= 95);
    orte.forEach(o => { const p = P(o.la, o.lo); if (drin(p, 40)) h += `<circle class="nk-ort" cx="${p[0]}" cy="${p[1]}" r="${Math.max(4, Math.min(34, Math.sqrt(o.ew) / 28)).toFixed(1)}"/>`; });
    // Wasser
    (G.fluesse || []).forEach(([name, pts]) => { if (pts.some(([la, lo]) => drin(P(la, lo), 300))) h += `<path class="nk-wasser" stroke-width="${FLUSS_B[name] || 3.5}" d="${pfad(pts)}"><title>${esc(name)}</title></path>`; });
    // Autobahnen
    if (ebene.bahn) {
      const ab = (G.autobahnen || []).filter(([, pts]) => pts.some(([la, lo]) => drin(P(la, lo), 0)));
      ab.forEach(([, pts]) => { const d = pfad(pts); h += `<path class="nk-bahn-r" d="${d}"/><path class="nk-bahn" d="${d}"/>`; });
      ab.forEach(([name, pts]) => {
        const sicht = pts.map(([la, lo]) => P(la, lo)).filter(p => drin(p, -30)); if (!sicht.length) return;
        const s = sicht[Math.floor(sicht.length / 2)];
        h += `<g class="nk-schild" transform="translate(${s[0] - 14} ${s[1] - 8})"><rect width="28" height="16" rx="4"/><text x="14" y="12" text-anchor="middle">${esc(name)}</text></g>`;
      });
    }
    // Zwei Ringe: überregional (gestrichelt) und lokal (kräftig), beschriftet
    h += `<circle class="nk-radius" cx="${cx}" cy="${cy}" r="${R * px}"/><circle class="nk-lokal" cx="${cx}" cy="${cy}" r="${m.L * px}"/>`;
    h += `<text class="nk-ring" x="${cx}" y="${cy - R * px - 6}" text-anchor="middle">Überregional · ${R} km</text><text class="nk-ring lokal" x="${cx}" y="${cy - m.L * px - 6}" text-anchor="middle">Lokal · ${m.L} km</text>`;
    // Partnervereine (Konzept): Amateurvereine in den Orten des lokalen Rings
    partnerListe(m.n).forEach(o => {
      const p = P(o.la, o.lo);
      h += `<circle class="nk-pumkreis" cx="${p[0]}" cy="${p[1]}" r="${CFG.partner.umkreis * px}"/><rect class="nk-partner" x="${p[0] - 6}" y="${p[1] - 6}" width="12" height="12" rx="2"><title>${esc(o.verein)} (Partnerverein)</title></rect>`;
    });
    // Talente-Dichte (feste Punkte je Ort)
    if (ebene.kinder) orte.forEach(o => {
      const zahl = Math.max(1, Math.min(10, Math.round(Math.sqrt(o.ew) / 180))), hh = hash(o.name);
      for (let i = 0; i < zahl; i++) {
        const wkl = ((hh >>> (i % 24)) % 360) * Math.PI / 180 + i * 2.4, rr = 1 + ((hh >>> 3) + i * 37) % 50 / 10 * Math.sqrt(o.ew) / 900;
        const p = P(o.la + Math.sin(wkl) * rr / 110.57, o.lo + Math.cos(wkl) * rr / (111.32 * f));
        if (drin(p, 0)) h += `<circle class="nk-kind" cx="${p[0]}" cy="${p[1]}" r="2.4"/>`;
      }
    });
    // Wege der Toptalente
    if (ebene.wege) m.imR.forEach(w => {                                  // nur Talente aus dem eigenen Radius (Nutzer 2026-10-18)
      const z = m.nah.find(c => c.id === w.ziel); if (!z) return;
      const a = P(w.la, w.lo), b = P(z.la, z.lo), farbe = z.eigen ? 'var(--nk-blau)' : 'var(--nk-rot)';
      h += `<path class="nk-weg" d="M ${a[0]} ${a[1]} Q ${(a[0] + b[0]) / 2} ${(a[1] + b[1]) / 2 - 30} ${b[0]} ${b[1]}" stroke="${farbe}"/><circle cx="${a[0]}" cy="${a[1]}" r="3.6" fill="${farbe}"><title>${esc(w.ort)} · Jahrgang ${w.jahr} → ${esc(anzeige(z.name))}</title></circle>`;
    });
    // Ortsnamen ohne Überlappung (Vereinsorte zuerst)
    const belegt = [], frei = (x, y, b) => !belegt.some(q => Math.abs(q[0] - x) < (q[2] + b) / 2 + 4 && Math.abs(q[1] - y) < 14);
    m.nah.forEach(c => { const p = P(c.la, c.lo); belegt.push([p[0] + 60, p[1] + 5, 120]); });
    orte.slice().sort((a, b) => b.ew - a.ew).forEach(o => {
      if (o.ew < 40000 || m.nah.some(c => c.ort === o.name)) return;
      const r = Math.max(4, Math.min(34, Math.sqrt(o.ew) / 28)), p = P(o.la, o.lo), y = p[1] + r + 11, b = o.name.length * 6.4;
      if (!drin([p[0], y], -20) || !frei(p[0], y, b)) return;
      belegt.push([p[0], y, b]);
      h += `<text class="nk-ortname" x="${p[0]}" y="${y}" text-anchor="middle">${esc(o.name)}</text>`;
    });
    // NLZ
    m.nah.slice().sort((a, b) => (a.eigen ? 1 : 0) - (b.eigen ? 1 : 0)).forEach(c => {
      if (!ebene.nlz && !c.eigen) return;
      const p = P(c.la, c.lo); if (!drin(p, 0)) return;
      const r = 8 + Math.min(16, c.anteil * 0.5), kurz = kurzName(c, m.nah);
      h += `<circle class="nk-nlz${c.id === gew ? ' gew' : ''}" data-nk-c="${esc(c.id)}" cx="${p[0]}" cy="${p[1]}" r="${r}" fill="${c.eigen ? 'var(--nk-blau)' : 'var(--nk-rot)'}" fill-opacity="${c.eigen ? 1 : 0.8}"><title>${esc(anzeige(c.name))}</title></circle>`;
      h += `<text class="nk-nlzname" x="${p[0] + r + 5}" y="${p[1] - 1}">${esc(kurz)}</text><text class="nk-nlzinfo" x="${p[0] + r + 5}" y="${p[1] + 12}">${'★'.repeat(c.sterne)} · ${c.anteil} %</text>`;
    });
    // Maßstab + Nordpfeil
    h += `<g class="nk-mass" transform="translate(18 ${CFG.hoehe - 18})"><rect width="${10 * px}" height="4"/><rect x="${10 * px}" width="${10 * px}" height="4" opacity=".35"/><text y="-5">0</text><text x="${10 * px - 8}" y="-5">10</text><text x="${20 * px - 18}" y="-5">20 km</text></g>`;
    h += `<g class="nk-nord" transform="translate(${CFG.breite - 26} 30)"><path d="M0 -16 L7 6 L0 1 L-7 6 Z"/><text y="20" text-anchor="middle">N</text></g>`;
    return `<svg viewBox="0 0 ${CFG.breite} ${CFG.hoehe}" role="img" aria-label="Landkarte des Einzugsgebiets mit Nachwuchsleistungszentren und Wegen der Toptalente">${h}</svg>`;
  }
  // Netzwerk: ganz Deutschland mit Umriss, NLZ als Punkte, Funde als Sterne
  const DE = [[54.92, 8.3], [54.8, 9.44], [54.85, 9.9], [54.45, 10.2], [54.45, 11.2], [53.95, 10.9], [54.1, 11.6], [54.2, 12.1], [54.45, 12.5], [54.68, 13.4],
    [54.2, 13.8], [53.95, 14.25], [53.4, 14.4], [52.85, 14.13], [52.35, 14.6], [51.8, 14.7], [51.1, 15.0], [50.87, 14.8], [50.85, 14.3], [50.65, 13.3],
    [50.4, 12.3], [50.25, 12.1], [49.95, 12.45], [49.55, 12.55], [49.3, 12.9], [48.95, 13.5], [48.75, 13.83], [48.55, 13.45], [48.25, 13.05], [47.75, 13.0],
    [47.55, 12.95], [47.7, 12.4], [47.6, 11.6], [47.42, 10.98], [47.55, 10.5], [47.5, 10.15], [47.55, 9.65], [47.65, 9.2], [47.7, 8.7], [47.59, 8.2],
    [47.58, 7.6], [48.0, 7.55], [48.6, 7.8], [48.97, 8.2], [49.15, 7.3], [49.18, 6.85], [49.47, 6.36], [49.8, 6.5], [50.13, 6.13], [50.4, 6.2],
    [50.75, 6.02], [51.05, 5.95], [51.25, 6.2], [51.85, 5.95], [52.25, 7.03], [52.65, 7.05], [53.2, 7.2], [53.35, 7.0], [53.6, 7.1], [53.65, 8.1],
    [53.52, 8.13], [53.87, 8.7], [54.1, 8.85], [54.45, 8.6]];
  const NETZ = { breite: 430, hoehe: 560, la0: 51.2, lo0: 10.45, px: 0.6 };
  function svgNetz(m) {
    const { o0 } = m, px = NETZ.px, f = Math.cos(NETZ.la0 * Math.PI / 180);
    const P = (la, lo) => [+(NETZ.breite / 2 + (lo - NETZ.lo0) * 111.32 * f * px).toFixed(1), +(NETZ.hoehe / 2 + (NETZ.la0 - la) * 110.57 * px).toFixed(1)];
    let h = `<path class="nk-de" d="M ${DE.map(([la, lo]) => P(la, lo).join(' ')).join(' L ')} Z"/>`;
    (G.fluesse || []).forEach(([name, pts]) => { h += `<path class="nk-wasser" stroke-width="${(FLUSS_B[name] || 3.5) / 3}" d="M ${pts.map(([la, lo]) => P(la, lo).join(' ')).join(' L ')}"/>`; });
    m.alle.forEach(c => { if (c.eigen) return; const p = P(c.la, c.lo); h += `<circle class="nk-punkt" cx="${p[0]}" cy="${p[1]}" r="${1.5 + c.sterne}"><title>${esc(anzeige(c.name))}</title></circle>`; });
    const e = P(o0.la, o0.lo);
    h += `<circle class="nk-radius" cx="${e[0]}" cy="${e[1]}" r="${m.R * px}"/><circle class="nk-lokal" cx="${e[0]}" cy="${e[1]}" r="${m.L * px}"/>`;
    Object.keys(G.orte).map(ortDaten).filter(o => o.ew >= 480000 && km(o, o0) > 60).forEach(o => { const p = P(o.la, o.lo); h += `<text class="nk-ortname" x="${p[0]}" y="${p[1] - 6}" text-anchor="middle">${esc(o.name)}</text>`; });
    m.k.netz.forEach(x => {
      if (x.ausland) return;
      const p = P(x.la, x.lo), farbe = x.status === 'geholt' ? 'var(--nk-blau)' : x.status === 'offen' ? 'var(--nk-gold)' : 'var(--text3)';
      h += `<path class="nk-weg" d="M ${p[0]} ${p[1]} Q ${(p[0] + e[0]) / 2} ${(p[1] + e[1]) / 2 - 40} ${e[0]} ${e[1]}" stroke="${farbe}"/>`;
      h += `<path class="nk-fund${x.status === 'offen' ? ' offen' : ''}" data-nk-fundzeige="${x.id}" transform="translate(${p[0]} ${p[1]})" d="M0 -9 L2.6 -2.8 L9 -2.8 L3.8 1.2 L5.8 7.6 L0 3.8 L-5.8 7.6 L-3.8 1.2 L-9 -2.8 L-2.6 -2.8 Z" fill="${farbe}"><title>${esc(x.ort)}: ${x.alter}-jähriger ${esc(x.pos)}</title></path>`;
    });
    h += `<circle class="nk-nlz gew" cx="${e[0]}" cy="${e[1]}" r="7" fill="var(--nk-blau)"/><text class="nk-nlzname" x="${e[0] + 11}" y="${e[1] + 4}">Dein NLZ</text>`;
    h += `<g class="nk-mass" transform="translate(14 ${NETZ.hoehe - 16})"><rect width="${100 * px}" height="4"/><text y="-5">0</text><text x="${100 * px - 26}" y="-5">100 km</text></g>`;
    return `<svg viewBox="0 0 ${NETZ.breite} ${NETZ.hoehe}" role="img" aria-label="Deutschlandkarte mit den Funden deines Scouting-Netzwerks">${h}</svg>`;
  }
  function netzListe(m, n) {
    const STATUS = { offen: 'wartet auf dich', geholt: 'zugesagt ✓', abgesagt: 'Familie sagte ab', abgelehnt: 'abgelehnt', verfallen: 'verfallen' };
    const l = m.k.netz.slice().reverse();
    return `<div class="nk-netz-liste"><span class="nk-etikett">Funde deines Netzwerks</span>
      <p class="nk-hinweis">Dein Scout findet außerhalb des überregionalen Rings im Schnitt ${(CFG.netz.jeSaison * Math.sqrt(Math.max(0.05, N.wirkung(n).scouting))).toFixed(1).replace('.', ',')} Talente je Saison (höchstens ${CFG.netz.max}). Ob sie kommen, hängt vor allem am Internat.</p>
      ${l.length ? l.map(x => `<div class="nk-fundk ${x.status}"><b>${x.alter}-jähriger ${esc(x.pos)} aus ${esc(x.ort)}</b><small>${esc(x.art)} · ${x.ausland ? 'Auslandspartner' : x.d + ' km'} · Saison ${x.saison}, KW ${x.woche}</small>
        ${x.status === 'offen' ? `<div class="nk-fk-k"><button type="button" class="app-knopf" data-nk-fund="${x.id}" data-nk-a="holen">Holen · Zusage etwa ${Math.round(annahme(n, x) * 100)} %</button><button type="button" class="app-knopf" data-nk-fund="${x.id}" data-nk-a="nein">Ablehnen</button></div>` : `<em>${STATUS[x.status] || ''}</em>`}</div>`).join('')
        : '<div class="nz-leer">Noch keine Funde – sie kommen im Lauf der Saison als Meldung.</div>'}</div>`;
  }
  function partnerHtml(n) {
    const k = kz(n), kand = partnerKandidaten();
    return `<div class="nk-pv"><span class="nk-etikett">Deine Partnervereine · ${k.partner.length} / ${CFG.partner.max}</span><div class="nk-pv-l">${kand.map(p => `<button type="button" data-nk-pv="${esc(p.key)}" class="${k.partner.indexOf(p.key) >= 0 ? 'an' : ''}" aria-pressed="${k.partner.indexOf(p.key) >= 0}"><b>${esc(p.verein)}</b><small>${Math.round(p.d)} km · ${p.stadtteil ? 'Stadtteil' : Math.round(p.ew / 1000) + ' Tsd. Einwohner'}</small></button>`).join('')}</div></div>`;
  }
  const sterneTxt = s => `${s} von 3 <span>★</span>`;
  function panelHtml(m, n) {
    const c = m.nah.find(x => x.id === gew) || m.nah.find(x => x.eigen); if (!c) return '';
    const punkte = [];
    if (c.eigen) {
      punkte.push(`Lokal ${m.L} km: Heimvorteil, Kinder bleiben bei dir${partnerListe(n).length ? ` – dazu bei ${partnerListe(n).length} Partnervereinen` : ''}`);
      punkte.push(`Überregional ${m.R} km aus dem Scouting-Budget; ab ${CFG.internatAb} km zählt dein Internat`);
      const st = m.nah.filter(x => !x.eigen && x.d <= m.R).length;
      punkte.push(st ? `${st} weitere NLZ in deinem Radius` : 'Kein anderes NLZ in deinem Radius');
      if (eigenFaktor(n) !== 1) punkte.push(`Anziehung durch Konzepte und Ruf: ${eigenFaktor(n) > 1 ? '+' : '−'}${Math.round(Math.abs(eigenFaktor(n) - 1) * 100)} %`);
    } else {
      if (c.ausR) punkte.push(`holte ${c.ausR} Toptalent${c.ausR > 1 ? 'e' : ''} aus deinem Radius (letzte 3 Jahrgänge)`);
      punkte.push(c.d > m.R ? 'liegt außerhalb deines Radius' : 'liegt in deinem Radius');
      punkte.push(`sichtet bis ${c.reich} km weit`);
      if (c.durchl >= 20) punkte.push('hohe Durchlässigkeit – Talente sehen dort einen Weg nach oben');
    }
    return `<span class="nk-etikett">${c.eigen ? 'Dein NLZ' : 'Konkurrenz'}</span><h2>${esc(anzeige(c.name))}</h2><div class="nk-unter">${ligaName(c.tier)} · ${esc(c.ort)}</div>
      <div class="nz-zahlen"><div><small>Sterne</small><b class="nk-st">${sterneTxt(c.sterne)}</b></div><div><small>Durchlässigkeit</small><b>${c.durchl} %</b></div>
        <div><small>Anteil Toptalente</small><b>${c.anteil} %</b></div><div><small>Entfernung</small><b>${c.eigen ? '–' : Math.round(c.d) + ' km'}</b></div></div>
      <ul class="nk-punkte">${punkte.map(p => `<li>${esc(p)}</li>`).join('')}</ul>`;
  }
  function anteilHtml(m) {
    const l = m.nah.filter(c => c.zahl > 0 || c.eigen).sort((a, b) => b.zahl - a.zahl).slice(0, 9);
    const max = Math.max(1, ...l.map(c => c.anteil));
    return l.map(c => `<tr class="${c.eigen ? 'wir' : ''}${c.id === gew ? ' gew' : ''}" data-nk-c="${esc(c.id)}"><td>${esc(anzeige(c.name))}</td><td><span class="nk-bar" style="width:${Math.round(c.anteil / max * 70)}px"></span>${c.anteil} %</td></tr>`).join('');
  }
  function ursachen(m, n) {
    const l = [], vonUns = m.imR.length, wir = m.imR.filter(w => w.ziel === 'fcm').length;
    const gegner = m.nah.filter(c => !c.eigen && c.ausR > 0).sort((a, b) => b.ausR - a.ausR).slice(0, 2);
    if (vonUns) l.push(`<b>Konkurrenz:</b> ${gegner.length ? gegner.map(c => esc(anzeige(c.name))).join(' und ') + ` holten ${gegner.reduce((a, c) => a + c.ausR, 0)} von ${vonUns}` : `Niemand außer dir holte eins von ${vonUns}`} Toptalenten aus deinem Radius, du ${wir}.`);
    else l.push('<b>Konkurrenz:</b> In den letzten Jahrgängen fiel in deinem Radius kaum ein Toptalent auf.');
    const w = N.wirkung(n).scouting;
    l.push(`<b>Scouting:</b> Radius ${m.R} km${w < 0.95 ? ` – ${Math.round((1 - w) * 100)} % unter dem Ligastandard` : w > 1.05 ? ` – ${Math.round((w - 1) * 100)} % über dem Ligastandard` : ' – Ligastandard'}.`);
    const best = m.nah.filter(c => !c.eigen && c.d <= m.R).sort((a, b) => b.durchl - a.durchl)[0], e = m.nah.find(c => c.eigen);
    if (e) l.push(`<b>Durchlässigkeit:</b> ${e.durchl} % deines Kaders sind Eigengewächse${best ? ` (${esc(anzeige(best.name))}: ${best.durchl} %)` : ''}.`);
    if (hat(n, 'weg')) l.push(kz(n).wegSeit > saison() ? `<b>Weg nach oben:</b> Die Zusage über ${CFG.weg.zusage} Einsätze gilt ab der nächsten Saison.` : `<b>Weg nach oben:</b> ${einsaetzeEigen(saison())} von ${CFG.weg.zusage} zugesagten Einsätzen in dieser Saison.`);
    return l.map(x => `<li>${x}</li>`).join('');
  }
  function duerreHtml(n) {
    const j = duerreJahre(n), k = kz(n), schon = k.schonBis >= saison();
    const stufen = [['Jahr 1', 'Normal – Talente kommen in Wellen.'], ['Jahr 2', 'Vorstand fragt nach, Fans merken es.'], ['Jahr 3', 'Vorstand mahnt öffentlich.'], ['Jahr 4', 'Eltern meiden dich (Anziehung −15 %).']];
    const titel = schon && j >= 2 ? `${j} Jahre ohne neues Eigengewächs – der Vorstand wartet ab` : j === 0 ? 'Diese Saison schon ein Eigengewächs hochgezogen' : `${j} ${j === 1 ? 'Jahr' : 'Jahre'} ohne neues Eigengewächs bei den Profis`;
    return `<div><span class="nk-etikett">Dürre-Uhr</span><div class="nk-dtitel">${titel}</div>
      <div class="nk-uhr">${stufen.map(([t, x], i) => `<div class="${i + 1 < Math.min(4, j) ? 'erreicht' : i + 1 === Math.min(4, j) ? 'jetzt' : ''}"><b>${t}${i + 1 === Math.min(4, j) ? ' · jetzt' : ''}</b>${x}</div>`).join('')}</div>
      ${schon ? `<small class="nk-hinweis">Schonfrist des Vorstands bis Saisonende ${k.schonBis === saison() ? 'dieser Saison' : 'nächster Saison'}.</small>`
        : `<button type="button" class="app-knopf" data-nk-gespraech="1"${gespraechMoeglich(n) ? '' : ' disabled'}>Konzept-Gespräch mit dem Vorstand</button> <small class="nk-hinweis">${CFG.duerre.schonfrist} Saisons Schonfrist${j < 2 ? ' · erst ab 2 Jahren Dürre' : saison() - k.gespraech < CFG.duerre.gespraechAbstand ? ' · erst wieder in ' + (CFG.duerre.gespraechAbstand - (saison() - k.gespraech)) + ' Saisons' : ''}</small>`}</div>`;
  }
  function html(n) {
    const m = modell(n);
    if (!m) return `<section class="nz-kasten"><div class="nz-leer">Für deinen Vereinsort gibt es noch keine Landkarte.</div></section>`;
    if (!m.nah.some(c => c.id === gew)) gew = 'fcm';
    const k = m.k, schnitt = m.jahre.length ? (m.imR.length / m.jahre.length).toFixed(1).replace('.', ',') : '0';
    m.n = n;
    const chips = [['nlz', 'Konkurrenz'], ['kinder', 'Talente-Dichte'], ['wege', 'Wege aus deinem Radius'], ['bahn', 'Autobahnen']];
    const offen = k.netz.filter(x => x.status === 'offen').length;
    const umsch = `<span class="nk-ansicht" role="group" aria-label="Ebene"><button type="button" data-nk-ansicht="gebiet" class="${ansicht === 'gebiet' ? 'an' : ''}">Lokal &amp; überregional</button><button type="button" data-nk-ansicht="netz" class="${ansicht === 'netz' ? 'an' : ''}">Netzwerk · Deutschland${offen ? ` <i>${offen}</i>` : ''}</button></span>`;
    const karte = ansicht === 'netz'
      ? `<div class="nk-ebenen">${umsch}</div><div class="nk-netz">${svgNetz(m)}${netzListe(m, n)}</div>
          <div class="nk-leg"><span><i style="background:var(--nk-gold)"></i>offener Fund</span><span><i style="background:var(--nk-blau)"></i>zugesagt</span><span><i style="background:var(--text3)"></i>abgesagt, abgelehnt, verfallen</span><span><i style="background:var(--nk-rot)"></i>NLZ (Größe = Sterne)</span></div>`
      : `<div class="nk-ebenen">${umsch}${chips.map(([e, t]) => `<button type="button" data-nk-e="${e}" aria-pressed="${ebene[e]}" class="${ebene[e] ? 'an' : ''}">${t}</button>`).join('')}
          <span class="nk-r"><button type="button" class="app-knopf" data-nz-t="bud">Scouting-Budget</button></span></div>
          ${svg(m)}
          <div class="nk-leg"><span><i style="background:var(--nk-blau)"></i>dein NLZ</span><span><i class="nk-ring-i"></i>lokal (Heimvorteil)</span><span><i class="nk-ring-i ue"></i>überregional</span><span><i style="background:var(--nk-rot)"></i>Konkurrenz (Größe = Anteil Toptalente)</span>${hat(n, 'koop') ? '<span><i style="background:var(--nk-gruen);border-radius:3px"></i>Partnerverein (Heimvorteil im Umkreis)</span>' : ''}<span><i class="nk-strich"></i>Weg eines Toptalents aus deinem Radius</span></div>`;
    return `<div class="nk-lk"><section class="nz-kasten"><h3>${ansicht === 'netz' ? 'Netzwerk' : 'Einzugsgebiet ' + esc(m.o0.name)} <small>Lokal ${m.L} km · überregional ${m.R} km · im Schnitt ${schnitt} Toptalente je Jahrgang im Radius</small></h3>
        <div class="nk-karte">${karte}</div></section>
      <aside class="nk-rechts"><section class="nz-kasten nk-panel" aria-live="polite">${panelHtml(m, n)}</section>
        <section class="nz-kasten"><h3>Anteil an Toptalenten <small>letzte 3 Jahrgänge · ${k.wege.length} Talente</small></h3><table class="nk-anteil"><tbody>${anteilHtml(m)}</tbody></table></section></aside></div>
      <section class="nz-kasten nk-abschnitt"><h3>Konzept gegen die Großen <small>höchstens 2 gleichzeitig · ${k.konz.length} / 2</small></h3><div class="nk-konz">${Object.entries(CFG.konzepte).map(([key, c]) => `<button type="button" class="nk-konzept${hat(n, key) ? ' an' : ''}" data-nk-k="${key}" aria-pressed="${hat(n, key)}"><b>${c.name}</b><small>${c.text}</small><em>${c.kosten ? H.euro(c.kosten) + ' je Saison · ' : ''}${c.vorbild}</em></button>`).join('')}</div>${hat(n, 'koop') ? partnerHtml(n) : ''}</section>
      <section class="nz-kasten nk-duerre">${duerreHtml(n)}<div><span class="nk-etikett">Analyse des Nachwuchsleiters</span><ul class="nk-ursachen">${ursachen(m, n)}</ul></div></section>`;
  }
  function klick(ev, n) {
    const t = ev.target;
    const pv = t.closest('[data-nk-pv]'); if (pv) { partnerSchalten(n, pv.getAttribute('data-nk-pv')); return true; }
    const an = t.closest('[data-nk-ansicht]'); if (an) { ansicht = an.getAttribute('data-nk-ansicht'); return true; }
    const fd = t.closest('[data-nk-fund]'); if (fd) { netzEntscheiden(n, fd.getAttribute('data-nk-fund'), fd.getAttribute('data-nk-a') === 'holen'); return true; }
    const e = t.closest('[data-nk-e]'); if (e) { const k = e.getAttribute('data-nk-e'); ebene[k] = !ebene[k]; return true; }
    const c = t.closest('[data-nk-c]'); if (c) { gew = c.getAttribute('data-nk-c'); return true; }
    const k = t.closest('[data-nk-k]'); if (k) { konzeptSchalten(n, k.getAttribute('data-nk-k')); return true; }
    if (t.closest('[data-nk-gespraech]')) { gespraech(n); return true; }
    return false;
  }

  const CSS = `
#view-nlz { --nk-blau: var(--k-blau-knopf, #2f6fca); --nk-rot: #c0392b; --nk-gold: #d39b1c; --nk-land: color-mix(in srgb, #8fbf6a 22%, var(--bg2)); --nk-wasser: #6fa8dc; --nk-gruen: #2e9a4b; }
#view-nlz .nk-lk { display: grid; grid-template-columns: minmax(0, 1fr) 330px; gap: 14px; align-items: start; }
#view-nlz .nk-karte { padding: 10px; }
#view-nlz .nk-karte svg { width: 100%; height: auto; max-height: calc(100vh - 250px); min-height: 400px; display: block; border-radius: 10px; background: var(--nk-land); }
#view-nlz .nk-ebenen { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; padding: 0 2px 8px; }
#view-nlz .nk-ebenen > button { all: unset; cursor: pointer; font-size: 12.5px; font-weight: 800; color: var(--text2); padding: 2px 10px; border: 1px solid var(--k-linie, var(--border)); border-radius: 999px; }
#view-nlz .nk-ebenen > button.an { color: #fff; background: var(--nk-blau); border-color: var(--nk-blau); }
#view-nlz .nk-r { margin-left: auto; display: inline-flex; gap: 8px; align-items: center; font-size: 12.5px; font-weight: 800; color: var(--text2); }
#view-nlz .nk-karte .nk-ort { fill: color-mix(in srgb, #9a8f80 30%, transparent); }
#view-nlz .nk-karte .nk-wasser { fill: none; stroke: var(--nk-wasser); stroke-linecap: round; stroke-linejoin: round; opacity: .85; }
#view-nlz .nk-karte .nk-bahn-r { fill: none; stroke: #fff; stroke-width: 5; opacity: .8; }
#view-nlz .nk-karte .nk-bahn { fill: none; stroke: #e0a43a; stroke-width: 2.6; }
#view-nlz .nk-karte .nk-schild rect { fill: #2a5db0; stroke: #fff; stroke-width: 1.2; } #view-nlz .nk-karte .nk-schild text { font-size: 10px; font-weight: 800; fill: #fff; }
#view-nlz .nk-karte .nk-radius { fill: color-mix(in srgb, var(--nk-blau) 9%, transparent); stroke: var(--nk-blau); stroke-width: 2.5; stroke-dasharray: 9 6; }
#view-nlz .nk-karte .nk-lokal { fill: color-mix(in srgb, var(--nk-gruen) 22%, transparent); stroke: var(--nk-gruen); stroke-width: 3; }
#view-nlz .nk-karte .nk-ring { font-size: 12px; font-weight: 800; fill: var(--nk-blau); paint-order: stroke; stroke: var(--nk-land); stroke-width: 3px; letter-spacing: .03em; } #view-nlz .nk-karte .nk-ring.lokal { fill: var(--nk-gruen); }
#view-nlz .nk-karte .nk-partner { fill: var(--nk-gruen); stroke: #fff; stroke-width: 1.5; }
#view-nlz .nk-karte .nk-pumkreis { fill: color-mix(in srgb, var(--nk-gruen) 14%, transparent); stroke: var(--nk-gruen); stroke-width: 1.5; stroke-dasharray: 4 4; }
#view-nlz .nk-pv { padding: 0 10px 12px; } #view-nlz .nk-pv-l { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
#view-nlz .nk-pv-l button { all: unset; cursor: pointer; display: grid; padding: 5px 11px; border-radius: 10px; border: 1px solid var(--k-linie, var(--border)); font-size: 12.5px; }
#view-nlz .nk-pv-l button small { font-size: 11px; color: var(--text3); } #view-nlz .nk-pv-l button.an { border-color: var(--nk-gruen); box-shadow: inset 0 0 0 1px var(--nk-gruen); background: color-mix(in srgb, var(--nk-gruen) 10%, transparent); }
#view-nlz .nk-karte .nk-de { fill: var(--nk-land); stroke: color-mix(in srgb, var(--text3) 60%, transparent); stroke-width: 1.5; }
#view-nlz .nk-karte .nk-punkt { fill: var(--nk-rot); opacity: .7; }
#view-nlz .nk-karte .nk-fund { stroke: #fff; stroke-width: 1.2; cursor: pointer; } #view-nlz .nk-karte .nk-fund.offen { stroke: var(--text); stroke-width: 1.6; }
#view-nlz .nk-netz { display: grid; grid-template-columns: minmax(0, 430px) minmax(0, 1fr); gap: 14px; align-items: start; }
#view-nlz .nk-netz svg { background: color-mix(in srgb, var(--nk-wasser) 14%, var(--bg2)); min-height: 0; }
#view-nlz .nk-netz-liste { display: flex; flex-direction: column; gap: 8px; }
#view-nlz .nk-netz-liste p { margin: 0; font-size: 12.5px; line-height: 1.45; }
#view-nlz .nk-fundk { border: 1px solid var(--k-linie, var(--border)); border-radius: 11px; padding: 8px 11px; display: flex; flex-direction: column; gap: 3px; }
#view-nlz .nk-fundk.offen { border-color: var(--nk-gold); box-shadow: inset 3px 0 0 var(--nk-gold); }
#view-nlz .nk-fundk small { font-size: 12px; color: var(--text2); } #view-nlz .nk-fundk em { font-style: normal; font-size: 12px; font-weight: 800; color: var(--text3); }
#view-nlz .nk-fundk.geholt em { color: var(--nk-blau); } #view-nlz .nk-fk-k { display: flex; gap: 6px; margin-top: 4px; }
#view-nlz .nk-ansicht { display: inline-flex; gap: 2px; padding: 2px; border-radius: 10px; border: 1px solid var(--k-linie, var(--border)); margin-right: 8px; }
#view-nlz .nk-ansicht button { all: unset; cursor: pointer; font-size: 12.5px; font-weight: 800; padding: 3px 11px; border-radius: 8px; color: var(--text2); }
#view-nlz .nk-ansicht button.an { background: var(--text); color: var(--bg2); } #view-nlz .nk-ansicht i { font-style: normal; background: var(--nk-gold); color: #000; border-radius: 9px; padding: 0 6px; margin-left: 3px; }
#view-nlz .nk-leg i.nk-ring-i { background: color-mix(in srgb, var(--nk-gruen) 22%, transparent); border: 2px solid var(--nk-gruen); box-sizing: border-box; }
#view-nlz .nk-leg i.nk-ring-i.ue { border: 2px dashed var(--nk-blau); background: color-mix(in srgb, var(--nk-blau) 9%, transparent); }
#view-nlz .nk-karte .nk-kind { fill: var(--nk-gold); opacity: .75; }
#view-nlz .nk-karte .nk-weg { fill: none; stroke-width: 2; stroke-dasharray: 3 4; opacity: .85; }
#view-nlz .nk-karte .nk-ortname { font-size: 11.5px; font-weight: 700; fill: var(--text2); paint-order: stroke; stroke: var(--nk-land); stroke-width: 3px; pointer-events: none; }
#view-nlz .nk-karte .nk-nlz { stroke: #fff; stroke-width: 2.5; cursor: pointer; } #view-nlz .nk-karte .nk-nlz.gew { stroke: var(--nk-gold); stroke-width: 4; }
#view-nlz .nk-karte .nk-nlzname { font-family: var(--font-display, inherit); font-size: 13.5px; font-weight: 800; fill: var(--text); paint-order: stroke; stroke: var(--nk-land); stroke-width: 3.5px; pointer-events: none; }
#view-nlz .nk-karte .nk-nlzinfo { font-size: 10.5px; font-weight: 800; fill: var(--text2); paint-order: stroke; stroke: var(--nk-land); stroke-width: 3px; pointer-events: none; }
#view-nlz .nk-karte .nk-mass rect { fill: var(--text); } #view-nlz .nk-karte .nk-mass text, #view-nlz .nk-karte .nk-nord text { font-size: 11px; font-weight: 800; fill: var(--text); } #view-nlz .nk-karte .nk-nord path { fill: var(--text); }
#view-nlz .nk-leg { display: flex; gap: 14px; flex-wrap: wrap; font-size: 12px; color: var(--text2); padding: 8px 4px 0; }
#view-nlz .nk-leg i { display: inline-block; width: 12px; height: 12px; border-radius: 50%; margin-right: 4px; vertical-align: -2px; }
#view-nlz .nk-leg i.nk-strich { width: 18px; height: 0; border-radius: 0; border-top: 2px dashed var(--nk-rot); vertical-align: 3px; }
#view-nlz .nk-rechts { display: flex; flex-direction: column; gap: 14px; }
#view-nlz .nk-panel { padding: 12px 14px; } #view-nlz .nk-panel h2 { margin: 2px 0 0; font-family: var(--font-display, inherit); font-size: 20px; }
#view-nlz .nk-panel .nz-zahlen { padding: 10px 0; }
#view-nlz .nk-etikett { font-size: 10.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--text3); }
#view-nlz .nk-unter { font-size: 12.5px; color: var(--text2); }
#view-nlz .nz-zahlen b.nk-st span { color: var(--nk-gold); } 
#view-nlz .nk-punkte { margin: 0; padding-left: 18px; font-size: 13px; line-height: 1.5; color: var(--text2); }
#view-nlz .nk-anteil { width: 100%; border-collapse: collapse; font-size: 12.5px; font-variant-numeric: tabular-nums; }
#view-nlz .nk-anteil td { padding: 4px 10px; border-bottom: 1px solid color-mix(in srgb, var(--k-linie, var(--border)) 55%, transparent); white-space: nowrap; }
#view-nlz .nk-anteil td:first-child { overflow: hidden; text-overflow: ellipsis; max-width: 170px; } #view-nlz .nk-anteil td:last-child { text-align: right; font-weight: 800; }
#view-nlz .nk-anteil tr { cursor: pointer; } #view-nlz .nk-anteil tr:hover td, #view-nlz .nk-anteil tr.gew td { background: var(--bg3, rgba(0,0,0,.04)); }
#view-nlz .nk-anteil tr.wir td { background: color-mix(in srgb, var(--nk-blau) 10%, transparent); font-weight: 800; }
#view-nlz .nk-bar { display: inline-block; height: 7px; border-radius: 4px; background: var(--nk-gold); vertical-align: middle; margin-right: 6px; }
#view-nlz .nk-abschnitt { margin-top: 14px; }
#view-nlz .nk-konz { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; padding: 10px; }
#view-nlz .nk-konzept { all: unset; box-sizing: border-box; cursor: pointer; border: 1px solid var(--k-linie, var(--border)); border-radius: 11px; padding: 9px 11px; display: flex; flex-direction: column; gap: 4px; background: var(--bg2); }
#view-nlz .nk-konzept.an { border-color: var(--nk-blau); box-shadow: inset 0 0 0 1px var(--nk-blau); background: color-mix(in srgb, var(--nk-blau) 7%, var(--bg2)); }
#view-nlz .nk-konzept b { font-size: 13.5px; } #view-nlz .nk-konzept small { font-size: 12px; color: var(--text2); line-height: 1.4; } #view-nlz .nk-konzept em { font-style: normal; font-size: 11.5px; color: var(--text3); }
#view-nlz .nk-duerre { padding: 12px 14px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; margin-top: 14px; }
#view-nlz .nk-dtitel { font-family: var(--font-display, inherit); font-size: 20px; font-weight: 800; margin: 2px 0 8px; }
#view-nlz .nk-uhr { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; margin-bottom: 10px; }
#view-nlz .nk-uhr div { font-size: 12px; color: var(--text2); padding: 6px 8px; border-radius: 9px; border: 1px solid var(--k-linie, var(--border)); line-height: 1.35; }
#view-nlz .nk-uhr b { display: block; color: var(--text); font-size: 12.5px; }
#view-nlz .nk-uhr .erreicht { background: color-mix(in srgb, var(--nk-gold) 14%, transparent); }
#view-nlz .nk-uhr .jetzt { background: color-mix(in srgb, var(--nk-rot) 14%, transparent); border-color: var(--nk-rot); }
#view-nlz .nk-hinweis { color: var(--text2); }
#view-nlz .nk-ursachen { margin: 6px 0 0; padding-left: 18px; font-size: 13px; line-height: 1.55; color: var(--text2); } #view-nlz .nk-ursachen b { color: var(--text); }
@media (max-width: 1450px) { #view-nlz .nk-lk { grid-template-columns: minmax(0, 1fr); } #view-nlz .nk-konz { grid-template-columns: 1fr 1fr; } }
`;
  function cssEinbauen() {
    if ($('nk-css')) return;
    const st = document.createElement('style'); st.id = 'nk-css'; st.textContent = CSS; document.head.appendChild(st);
  }

  N.erweitern({
    tab: { id: 'karte', name: 'Landkarte', html: n => { cssEinbauen(); return html(n); }, klick },
    auffNeu: (n, jahr) => (H.istPc() && eigenOrt() ? ziehen(n, jahr) : null),
    faktor: (art, n) => (!n ? 1 : art === 'abbrecher' && hat(n, 'schule') ? 0.8 : art === 'spaetzuender' && hat(n, 'nische') ? 1.8 : 1),
    hochgezogen: n => { const k = kz(n); k.letztesHoch = saison(); },
    saison: n => neueSaison(n),
    woche: n => { if (eigenOrt()) netzWoche(n); }
  });
  W.KSNlzKarte = { CFG, modell: () => { const n = N.z(); return n ? modell(n) : null; }, ziehen: jahr => { const n = N.z(); return n ? ziehen(n, jahr) : null; },
    netzFinden: () => { const n = N.z(); return n ? netzFinden(n, true) : null; }, auslandFund: n => auslandFund(n || N.z()), ansicht: a => { if (a) ansicht = a; return ansicht; } };
})();
