;
;/* ── js/kaderstaerke.js ── */
/* ═══════════════════════════════════════════════════════════════════════════
   VEREINSSTÄRKE AUS DEM KADER  ·  v1
   ─────────────────────────────────────────────────────────────────────────
   Bis hierher waren Kader und Stärke zwei getrennte Welten. Verkaufte Dortmund
   seinen Besten, blieb Dortmunds OVR gleich. Kaufte Bayern drei Stars, änderte
   sich nichts. Transfers hatten sportlich keine Folgen.

   Jetzt folgt die Stärke dem Kader — aber kontrolliert, sonst kippt die Liga:

   ZIEL-OVR   Jeder Verein bekommt einmalig sein Ausgangsniveau als Marke.
              Sie ändert sich nie. Dadurch bleibt der Zehnjahresschnitt
              zwangsläufig auf diesem Wert.
   VERSATZ    Beim ersten Lauf wird gemessen, wie der Kaderwert zum Ziel steht,
              und die Differenz festgehalten. So startet jeder Verein exakt bei
              seinem bisherigen OVR — ohne diesen Schritt würde jeder Klub sofort
              um 3–4 Punkte springen, weil ein Kaderschnitt anders skaliert als
              eine gesetzte Vereinsstärke.
   DECKEL     Höchstens ±4 Punkte Abweichung vom Ziel. Ein Verein darf ein paar
              Jahre stärker oder schwächer sein — aber Wolfsburg überholt Bayern
              nicht, und Bayern verschwindet nicht in der Bedeutungslosigkeit.
   TRÄGHEIT   Die Stärke folgt dem Kader nur zu 45 % pro Saison. Ein einzelner
              Transfersommer dreht keinen Verein um; eine gute Ära schon.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const CFG = {
    deckel: 4,          // maximale Abweichung vom Ziel-OVR
    traegheit: 0.45,    // Anteil, um den sich die Stärke je Saison annähert
    topAnteil: 0.72,    // Gewicht der besten Elf gegenüber dem Rest
    ersatzZahl: 7,      // wie viele Ergänzungsspieler mitzählen
    // NIVEAUANSTIEG: Das Ziel-OVR aller Vereine steigt langsam. Sonst wächst
    // der eigene Verein über die Jahre aus der Liga heraus — Ausbildung,
    // Transfers und Trainingsgelände wirken kumulativ, die Konkurrenz nicht.
    // 0,16 je Saison heißt: nach zehn Jahren rund anderthalb Punkte, nach
    // zwanzig gut drei. Genug, dass es fordernd bleibt, zu wenig, um die
    // Rangfolge zu verzerren.
    driftProSaison: 0.16,
    driftMax: 5         // Obergrenze über die gesamte Karriere
  };
  window.Kaderstaerke = CFG;

  // Kaderwert: die Elf trägt, die Breite stützt.
  function kaderwert(kader) {
    if (!Array.isArray(kader) || !kader.length) return null;
    const o = kader.map(p => p.ovr || 50).sort((a, b) => b - a);
    const elf = o.slice(0, 11);
    const bank = o.slice(11, 11 + CFG.ersatzZahl);
    const mElf = elf.reduce((a, b) => a + b, 0) / elf.length;
    const mBank = bank.length ? bank.reduce((a, b) => a + b, 0) / bank.length : mElf;
    return mElf * CFG.topAnteil + mBank * (1 - CFG.topAnteil);
  }
  window.kaderwert = kaderwert;

  function state() {
    if (!CLUB.staerke) CLUB.staerke = { ziel: {}, versatz: {}, init: false };
    return CLUB.staerke;
  }

  // Alle Vereine mit Kader einsammeln: deutsche Ligateams und Auslandsklubs.
  function vereine() {
    const raus = [];
    try {
      const sq = (window.NpcRealTransfers && NpcRealTransfers.npcSquads()) || {};
      const tiers = (LEAGUE && LEAGUE.tiers) || {};
      Object.keys(tiers).forEach(k => {
        (tiers[k].groups || []).forEach(g => {
          (g.teams || []).forEach(t => {
            // 2026-10-15: Kader liegen unter der Kartei-Kennung (t.dataId „bayern“), nicht unter t.id („club_bayern“)
            const k = t && (sq[t.dataId] || sq[t.id]);
            if (t && t.id && t.id !== 'fcm' && k && k.length >= 11) raus.push({ obj: t, kader: k });
          });
        });
      });
    } catch (e) {}
    try {
      const ek = (typeof window.euroKader === 'function') ? window.euroKader() : {};
      const liste = (CLUB.euroClubs && CLUB.euroClubs.length) ? CLUB.euroClubs : (window.EURO_CLUBS || []);
      liste.forEach(c => {
        if (c && c.id && ek[c.id] && ek[c.id].length >= 11) raus.push({ obj: c, kader: ek[c.id] });
      });
    } catch (e) {}
    return raus;
  }

  // Einmalig: Ziel-OVR und Versatz festhalten.
  function initialisieren() {
    const st = state();
    if (st.init) return;
    vereine().forEach(v => {
      const id = v.obj.id;
      const jetzt = v.obj.ovr || Math.round(((v.obj.def || 70) + (v.obj.mid || 70) + (v.obj.att || 70)) / 3);
      const kw = kaderwert(v.kader);
      if (kw == null) return;
      st.ziel[id] = jetzt;
      st.versatz[id] = jetzt - kw;      // damit Start = bisheriger OVR
    });
    st.init = true;
  }
  window.staerkeInit = initialisieren;

  // Eine Saison: Stärke an den Kader heranführen.
  function aktualisieren() {
    initialisieren();
    const st = state();
    // Erst das Grundniveau anheben, dann die Kader daran messen.
    // 2026-10-17: einmal je Saison – der KI-Transfermarkt ruft aktualisieren() nach jedem Fenster auf (13× je Saison), dadurch
    // war die Obergrenze driftMax schon nach etwa drei Saisons erreicht (Langzeitlauf: alle Ligen +8 in 5 Saisons)
    const saison = (typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.season) || 0;
    if (st.driftSaison !== saison) { st.driftSaison = saison; st.drift = Math.min(CFG.driftMax, (st.drift || 0) + CFG.driftProSaison); }
    const bericht = { angepasst: 0, gestiegen: 0, gefallen: 0, amDeckel: 0 };
    vereine().forEach(v => {
      const id = v.obj.id;
      if (st.ziel[id] == null) return;
      // Der Anstieg wirkt auf BEIDES: auf das Ziel und auf den gemessenen Wert.
      // Nur das Ziel anzuheben genügt nicht — der Deckel ist gar nicht die
      // bindende Grenze, der Kaderwert ist es. Gemessen blieb der Ligaschnitt
      // dadurch über 20 Saisons bei 72,1 statt zu steigen.
      const drift = st.drift || 0;
      const ziel = st.ziel[id] + drift, versatz = st.versatz[id] || 0;
      const kw = kaderwert(v.kader);
      if (kw == null) return;
      const roh = kw + versatz + drift;
      const gedeckelt = Math.max(ziel - CFG.deckel, Math.min(ziel + CFG.deckel, roh));
      const alt = v.obj.ovr || ziel;
      const neu = alt + (gedeckelt - alt) * CFG.traegheit;
      const ovr = Math.round(neu);
      if (ovr === alt) return;
      // def/mid/att im Verhältnis mitziehen, damit das Profil erhalten bleibt
      const f = ovr / Math.max(1, alt);
      v.obj.def = Math.round((v.obj.def || alt) * f);
      v.obj.mid = Math.round((v.obj.mid || alt) * f);
      v.obj.att = Math.round((v.obj.att || alt) * f);
      v.obj.ovr = ovr;
      // ZWILLING MITZIEHEN: Von den Auslandsvereinen gibt es zwei Kopien —
      // window.EURO_CLUBS (Transfermarkt, Konkurrenz, Kadergenerierung) und
      // CLUB.euroClubs (Europapokal, entwickelt sich über Saisons). Wird nur eine
      // aktualisiert, rechnet die Champions League mit anderen Stärken als der
      // Transfermarkt.
      try {
        [window.EURO_CLUBS, CLUB.euroClubs].forEach(function (liste) {
          if (!Array.isArray(liste)) return;
          const z = liste.find(x => x && x.id === id);
          if (z && z !== v.obj) { z.def = v.obj.def; z.mid = v.obj.mid; z.att = v.obj.att; z.ovr = ovr; }
        });
      } catch (e) {}
      bericht.angepasst++;
      if (ovr > alt) bericht.gestiegen++; else bericht.gefallen++;
      if (Math.abs(ovr - ziel) >= CFG.deckel) bericht.amDeckel++;
    });
    return bericht;
  }
  window.staerkeAktualisieren = aktualisieren;

  // An den Saisonwechsel hängen — nach dem Kaderleben, damit die frisch
  // gealterten und nachgerückten Spieler schon zählen.
  function einhaengen() {
    if (window.__staerkeGehaengt) return;
    if (typeof window.npcKaderSaison !== 'function') return;
    window.__staerkeGehaengt = true;
    const _o = window.npcKaderSaison;
    window.npcKaderSaison = function () {
      const b = _o.apply(this, arguments) || {};
      try { b.staerke = aktualisieren(); } catch (e) { console.warn('[Kaderstaerke]', e); }
      return b;
    };
  }
  einhaengen();
  window.addEventListener('load', function () {
    einhaengen();
    // Ziel-Marken früh setzen, solange die Welt noch im Ausgangszustand ist.
    setTimeout(function () { try { initialisieren(); } catch (e) {} }, 1500);
  });

  console.log('%c[Kaderstaerke v1] aktiv', 'color:#3fb950;font-weight:bold',
    '— Vereinsstärke folgt dem Kader, gedeckelt bei ±' + CFG.deckel + ' um das Ziel');
})();
;/* ── js/euro_kader.js ── */
/* ═══════════════════════════════════════════════════════════════════════════
   KADER DER EUROPÄISCHEN VEREINE  ·  v1
   ─────────────────────────────────────────────────────────────────────────
   Die 155 europäischen Vereine waren reine Bewertungsdatensätze — Name, Land,
   Koeffizient, drei Stärkewerte. Kein einziger Spieler. Ein Spieler, den Real
   Madrid dir abkauft, verschwand aus der Welt.

   Jeder Verein bekommt jetzt 26 Mann: 20 Profis und 6 Nachwuchsspieler.
   Entscheidend ist das PROFIL — ein Kader ist mehr als ein Stärkewert:

     ausbildung   Ajax, Salzburg, Benfica, Sporting, Atalanta, Brighton …
                  junger Kader, hohes Potenzial, viele Eigengewächse
     kaufklub     Real, City, PSG, Bayern-Klasse — fertige Spieler, teuer,
                  wenig Nachwuchs im Profikader
     durchlauf    Porto, Lyon, Villarreal, Brügge — kaufen jung, verkaufen teuer
     normal       alle übrigen

   Das Profil steuert Altersschnitt, Potenzialverteilung und Anteil an
   Eigengewächsen. Ein Ajax-Kader sieht dadurch anders aus als ein PSG-Kader,
   auch wenn beide ähnlich stark sind.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const PROFILE = {
    ausbildung: { alter: [19, 26], altSchnitt: 23.4, potBonus: 9,  eigenAnteil: 0.45, talente: 8 },
    kaufklub:   { alter: [22, 33], altSchnitt: 27.2, potBonus: 1,  eigenAnteil: 0.10, talente: 4 },
    durchlauf:  { alter: [20, 30], altSchnitt: 25.0, potBonus: 5,  eigenAnteil: 0.25, talente: 6 },
    normal:     { alter: [20, 32], altSchnitt: 25.8, potBonus: 3,  eigenAnteil: 0.20, talente: 6 }
  };

  // Vereine mit bekanntem Ruf. Alles Übrige bekommt „normal", starke Klubs ohne
  // Eintrag werden automatisch zu Kaufklubs.
  const RUF = {
    ausbildung: ['ajax','salzburg','benfica','sporting','atalanta','brighton','brentford',
                 'azgraz','sturm','genk','brugge','midtjylland','nordsjaelland','partizan',
                 'crvena','dinamozag','shakhtar','lille','rennes','villarreal','realsociedad',
                 'utrecht','az','feyenoord','slavia','sparta','ludogorets','molde','bodo',
                 'rosenborg','malmo','copenhagen','basel','young_boys','olympiakos','paok'],
    kaufklub:   ['mancity','realmadrid','barcelona','psg','chelsea','mancutd','bayern',
                 'juventus','intermilan','acmilan','atletico','liverpool','arsenal',
                 'newcastle','tottenham','alnassr','galatasaray','fenerbahce'],
    durchlauf:  ['porto','lyon','marseille','monaco','sevilla','betis','roma','napoli',
                 'lazio','fiorentina','bologna','stuttgart','eintracht','psv','twente',
                 'astonvilla','nottingham','westham','fulham','bournemouth','wolves']
  };

  function profilFuer(c) {
    const id = (c.id || '').toLowerCase();
    for (const k in RUF) if (RUF[k].some(x => id.indexOf(x) >= 0)) return k;
    // Kein bekannter Ruf: sehr starke Vereine kaufen fertig ein, kleine bilden aus.
    if ((c.ovr || 70) >= 84) return 'kaufklub';
    if ((c.ovr || 70) <= 66) return 'ausbildung';
    return 'normal';
  }
  window.euroProfil = profilFuer;

  // Positionen mit Seite (2026-10-18, kickstil_positionen.js); 'FL' = Flügel, Seite beim Erzeugen gelost
  const POS_VERTEILUNG = ['TW','TW','TW','IV','IV','IV','IV','IV','LV','LV','RV','RV',
                          'ZDM','ZDM','ZM','ZM','ZM','ZOM','ZOM','LF','RF','FL','ST','ST','ST','ST'];
  const GRUPPE = { LV: 'AV', RV: 'AV', LM: 'AM', RM: 'AM', LF: 'FL', RF: 'FL', OM: 'ZOM' };
  const G = pos => GRUPPE[pos] || pos;

  function name(land) {
    // 2026-10-16: kickstil_nationen.js – Heimat auch für Länder ohne Scouting-Liste (Schottland, Griechenland …),
    // Ausland gewichtet nach Export statt gleich verteilt
    if (typeof window !== 'undefined' && window.KSNationen) return window.KSNationen.vereinsName(land, 0.30);
    const SC = (typeof window !== 'undefined' && window.SCOUTING_COUNTRIES) || null;
    // 70 % aus dem Land des Vereins, 30 % international — Fußball ist ein
    // Wanderberuf, aber die Basis bleibt heimisch.
    let l = land;
    if (SC) {
      const alle = Object.keys(SC);
      if (!SC[l] || Math.random() < 0.30) l = alle[Math.floor(Math.random() * alle.length)];
      const c = SC[l];
      if (c && c.first && c.last) {
        return { firstName: c.first[Math.floor(Math.random() * c.first.length)],
                 name: c.last[Math.floor(Math.random() * c.last.length)],
                 flag: c.flag || '', country: l };
      }
    }
    return { firstName: 'Luca', name: 'Ferrari', flag: '', country: land || '' };
  }

  // Ein Spieler für einen bestimmten Verein und Platz im Kader.
  // rang 0 = Stammspieler, höher = Ergänzung, ganz hinten = Nachwuchs.
  function spieler(club, prof, pos, rang, istTalent) {
    const P = PROFILE[prof] || PROFILE.normal;
    const klubOvr = club.ovr || 70;
    // Stärkegefälle im Kader: die Elf trägt das Niveau, dahinter fällt es ab.
    const abfall = istTalent ? 14 + Math.floor(Math.random() * 8)
                             : Math.round(rang * 0.75) + Math.floor(Math.random() * 4);
    const ovr = Math.max(42, Math.min(94, klubOvr + 2 - abfall));
    let alter;
    if (istTalent) alter = 17 + Math.floor(Math.random() * 4);
    else {
      const spanne = P.alter[1] - P.alter[0];
      alter = P.alter[0] + Math.floor(Math.random() * (spanne + 1));
      // zum Schnitt hin ziehen
      alter = Math.round(alter * 0.55 + P.altSchnitt * 0.45);
    }
    const jugendLuft = Math.max(0, 25 - alter);
    let pot = ovr + Math.round(jugendLuft * 0.55) + P.potBonus + Math.floor(Math.random() * 5);
    // Ausnahmetalente: bei Ausbildungsvereinen und starken Klubs deutlich eher
    const juwelP = (prof === 'ausbildung' ? 0.030 : 0.010) * Math.max(0.3, (klubOvr - 60) / 20);
    if (alter <= 21 && Math.random() < juwelP) pot = 85 + Math.floor(Math.random() * 11);
    pot = Math.min(95, Math.max(ovr, pot));

    const n = name(club.country);
    if (pos === 'FL') pos = Math.random() < 0.5 ? 'LF' : 'RF';
    const g = G(pos);
    const def = g === 'TW' ? ovr + 4 : (g === 'IV' || g === 'AV') ? ovr + 3 : ovr - 5;
    const mid = (g === 'ZM' || g === 'ZDM' || g === 'ZOM' || g === 'AM') ? ovr + 3 : ovr - 2;
    const att = (g === 'ST' || g === 'FL') ? ovr + 4 : ovr - 6;
    // SCHLANK HALTEN: 155 Vereine × 26 Spieler = 4030 Datensätze, die bei jedem
    // Speichern mitgeschrieben werden. Mit vollem Datensatz waren das 1,3 MB —
    // pro Speichervorgang, und das Speicherlimit liegt bei 5 MB je Schlüssel.
    // Deshalb nur, was wirklich gebraucht wird: Vereinsname und Land stehen in
    // EURO_CLUBS, `positions` folgt aus `pos`, und Charaktereigenschaften
    // bekommen Hintergrundspieler erst, wenn sie auf dem Transfermarkt landen.
    const p = {
      id: club.id + '_' + rang + '_' + Math.floor(Math.random() * 1e6).toString(36),
      firstName: n.firstName, name: n.name, flag: n.flag, country: n.country,
      age: alter, pos: pos,
      def: Math.max(30, def), mid: Math.max(30, mid), att: Math.max(30, att),
      ovr: ovr, truePotential: pot, clubId: club.id
    };
    if (Math.random() < P.eigenAnteil) p.eigen = 1;
    p.ovr = Math.round((p.def + p.mid + p.att) / 3);
    return p;
  }

  const STAMMELF = ['TW', 'IV', 'IV', 'LV', 'RV', 'ZDM', 'ZM', 'ZOM', 'LF', 'RF', 'ST'];
  function stammelfZuerst(liste) {
    const rest = liste.slice(), vorn = [];
    STAMMELF.forEach(p => { const i = rest.indexOf(p); if (i >= 0) vorn.push(rest.splice(i, 1)[0]); });
    // Reihenfolge der Stammelf je Verein mischen – sonst wäre immer dieselbe Position die stärkste
    for (let i = vorn.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [vorn[i], vorn[j]] = [vorn[j], vorn[i]]; }
    const tw = rest.filter(p => p === 'TW'), feld = rest.filter(p => p !== 'TW');
    // zweiter Torhüter in der Mitte der Ersatzbank, weitere am Ende
    const mitte = Math.floor(feld.length / 2);
    return vorn.concat(feld.slice(0, mitte), tw.slice(0, 1), feld.slice(mitte), tw.slice(1));
  }
  function baueKader(club) {
    const prof = profilFuer(club);
    const P = PROFILE[prof] || PROFILE.normal;
    const kader = [];
    const talente = P.talente;
    const profis = 26 - talente;
    // 2026-10-16: Rang = Platz in der Hierarchie (0 = stärkster). Vorher folgte der Rang der Reihenfolge in
    // POS_VERTEILUNG – die drei Torhüter standen vorn und waren die drei stärksten Spieler jedes Vereins.
    // Jetzt erst eine Stammelf (1 TW + 10 Feldspieler), dann die Ersatzleute, der dritte Torhüter zuletzt.
    const pos = stammelfZuerst(POS_VERTEILUNG);
    for (let i = 0; i < profis; i++) kader.push(spieler(club, prof, pos[i % pos.length], i, false));
    for (let i = 0; i < talente; i++) {
      kader.push(spieler(club, prof, pos[(profis + i) % pos.length], profis + i, true));
    }
    return kader;
  }

  // ── Stars 2026/27 (data/stars_2627.js) ────────────────────────────────────
  // Je Topverein zehn Spieler mit den Werten des echten Kaders (Position, Alter, Land, Stärke, Potenzial),
  // erfundene Namen. Jeder Star ersetzt den stärksten erzeugten Spieler derselben Position (sonst desselben
  // Mannschaftsteils). In Saison 1 wechseln nur wenige Stars (kickstil_ki_markt.js sterneSaison1).
  const BEREICH = { TW: 'def', IV: 'def', AV: 'def', ZDM: 'mid', ZM: 'mid', ZOM: 'mid', OM: 'mid', AM: 'mid', FL: 'att', ST: 'att' };
  const TEIL = pos => pos === 'TW' ? 'TW' : BEREICH[G(pos)] || 'mid';
  function werteFuer(pos, ziel) {
    // Abstände wie in spieler(); Grundwert so, dass die Positionsstärke (70 % Hauptbereich + 30 % Schnitt) = ziel
    const g = G(pos);
    const o = { def: g === 'TW' ? 4 : (g === 'IV' || g === 'AV') ? 3 : -5,
                mid: (g === 'ZM' || g === 'ZDM' || g === 'ZOM' || g === 'AM') ? 3 : -2,
                att: (g === 'ST' || g === 'FL') ? 4 : -6 };
    const b = ziel - 0.7 * o[BEREICH[g] || 'mid'] - 0.3 * (o.def + o.mid + o.att) / 3;
    const w = {}; ['def', 'mid', 'att'].forEach(k => { w[k] = Math.max(30, Math.min(99, Math.round(b + o[k]))); });
    // Rundung: auf die exakte Positionsstärke nachziehen
    const pOvr = () => typeof computeOvrFromAreas === 'function' ? computeOvrFromAreas({ pos: pos, positions: [pos], def: w.def, mid: w.mid, att: w.att }) : null;
    for (let i = 0; i < 4; i++) { const d = pOvr(); if (d == null || d === ziel) break; const s = d > ziel ? -1 : 1; ['def', 'mid', 'att'].forEach(k => { w[k] += s; }); }
    w.ovr = Math.round((w.def + w.mid + w.att) / 3);
    return w;
  }
  const NAMENSERSATZ = { 'Russland': 'Ukraine', 'DR Kongo': 'Frankreich', 'Kosovo': 'Albanien', 'Mosambik': 'Portugal', 'Curaçao': 'Niederlande', 'Elfenbeinküste': 'Frankreich', 'Ghana': 'England', 'Nigeria': 'England' };
  function sterneEinsetzen(K) {
    const S = (typeof window !== 'undefined' && window.KS_STARS_2627) || null;
    if (!S) return 0;
    let n = 0;
    Object.keys(S).forEach(id => {
      const k = K[id]; if (!Array.isArray(k)) return;
      const belegt = new Set();
      S[id].forEach(([pos, alter, land, ovr, pot]) => {
        const frei = k.filter(p => !belegt.has(p));
        const kand = frei.filter(p => p.pos === pos).concat(frei.filter(p => p.pos !== pos && TEIL(p.pos) === TEIL(pos)));
        const p = kand.sort((a, b) => (a.pos === pos ? 0 : 1) - (b.pos === pos ? 0 : 1) || (b.ovr || 0) - (a.ovr || 0))[0];
        if (!p) return;
        // Länder ohne eigene Namensliste: Namen aus einer ähnlichen Liste
        const nl = window.KSNationen && !window.KSNationen.namen(land) ? (NAMENSERSATZ[land] || land) : land;
        const nm = window.KSNationen ? window.KSNationen.name(nl) : name(nl);
        const fl = window.KSNationen && window.KSNationen.flagge ? window.KSNationen.flagge(land) : '';
        Object.assign(p, werteFuer(pos, ovr), { firstName: nm.firstName, name: nm.name, flag: fl || nm.flag || '', country: land,
          pos: pos, age: alter, truePotential: Math.max(ovr, pot), stern: '2627' });
        delete p.eigen;
        belegt.add(p); n++;
      });
    });
    return n;
  }
  window.euroSterneEinsetzen = sterneEinsetzen;

  // ── Speicher ──────────────────────────────────────────────────────────────
  function alle() {
    if (!CLUB.euroKader) {
      const raus = {};
      ((typeof window !== 'undefined' && window.EURO_CLUBS) || []).forEach(c => {
        raus[c.id] = baueKader(c);
      });
      CLUB.euroKader = raus;
    }
    // Stars 2026/27: neue Spiele immer, alte Spielstände nur, solange sie noch in Saison 1 sind
    try {
      const WZ = window.Weltzustand;
      if (WZ && !WZ.hol('sterne2627', 0)) {
        WZ.setz('sterne2627', 1);
        if (((typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.season) || 1) === 1) {
          const n = sterneEinsetzen(CLUB.euroKader);
          if (n) console.log('[EuroKader] Stars 2026/27 eingesetzt: ' + n);
        }
      }
    } catch (e) { console.warn('[EuroKader] Stars', e); }
    // 2026-10-16: Union Saint-Gilloise hieß intern „union“ wie Union Berlin (Akademie, Vereinsblatt, Farben vermischt) → „union_sg“
    const K = CLUB.euroKader;
    if (K.union && !K.union_sg) { K.union_sg = K.union; delete K.union; (Array.isArray(K.union_sg) ? K.union_sg : []).forEach(p => { if (p && p.clubId === 'union') p.clubId = 'union_sg'; }); }
    return K;
  }
  window.euroKader = alle;
  window.euroName = name;            // Namen nach Land (kickstil_akademien.js: Talente der Auslandsakademien)
  window.euroKaderVon = function (clubId) { return alle()[clubId] || null; };

  // ── Verkaufte Spieler kommen wirklich an ──────────────────────────────────
  // Bisher wurde der Spieler nur aus deinem Kader gestrichen. Jetzt landet er im
  // Kader des Käufers — und der schwächste Spieler dort rückt heraus, damit die
  // Kadergröße stabil bleibt.
  window.euroSpielerAufnehmen = function (clubName, p) {
    try {
      const c = ((window.EURO_CLUBS) || []).find(x => x.name === clubName ||
        clubName.indexOf(x.name) === 0);
      if (!c) return false;
      const k = alle()[c.id];
      if (!k) return false;
      k.push({ firstName: p.firstName, name: p.name, flag: p.flag, country: p.country,
        age: p.age, pos: p.pos, def: p.def, mid: p.mid, att: p.att, ovr: p.ovr,
        truePotential: p.truePotential || p.ovr, clubId: c.id });
      // Kader auf 26 halten: der schwächste Profi geht
      while (k.length > 26) {
        let schlecht = 0;
        for (let i = 1; i < k.length; i++) if ((k[i].ovr || 99) < (k[schlecht].ovr || 99)) schlecht = i;
        k.splice(schlecht, 1);
      }
      return true;
    } catch (e) { return false; }
  };

  // ── Kaderleben auch für die Auslandsvereine ───────────────────────────────
  // Eine Saison altern lassen. Als eigene Funktion, weil dieses Modul VOR
  // npc_kaderleben.js geladen wird — der Wrapper unten wird deshalb erst beim
  // load-Ereignis eingehängt.
  const welt = () => { if (!CLUB.welt) CLUB.welt = {}; if (!CLUB.welt.euroNiveau) CLUB.welt.euroNiveau = {}; return CLUB.welt; };
  const posOvrE = p => typeof computeOvrFromAreas === 'function' ? computeOvrFromAreas({ pos: p.pos, positions: [p.pos], def: p.def, mid: p.mid, att: p.att }) : p.ovr;
  const elfVon = k => { const o = k.map(posOvrE).sort((a, b) => b - a).slice(0, 11); return o.length ? o.reduce((a, b) => a + b, 0) / o.length : 0; };
  const runden = x => Math.floor(x) + (Math.random() < x - Math.floor(x) ? 1 : 0);
  function daempfung(o) {
    const K = (window.KSLebendeWelt && KSLebendeWelt.cfg && KSLebendeWelt.cfg.kurve) || [[50, 1.7], [70, 1.0], [80, 0.7], [90, 0.34], [99, 0.1]];
    let f = K[K.length - 1][1];
    for (let i = 0; i < K.length; i++) { if (o <= K[i][0]) { f = i ? K[i - 1][1] + (K[i][1] - K[i - 1][1]) * (o - K[i - 1][0]) / (K[i][0] - K[i - 1][0]) : K[0][1]; break; } }
    return Math.min(1, f);
  }
  function euroSaison() {
      try {
        const k = alle();
        Object.keys(k).forEach(id => {
          let kader = k[id];
          const club = ((window.EURO_CLUBS) || []).find(x => x.id === id) || { ovr: 70, id: id };
          const prof = profilFuer(club);
          const AK = window.Alterskurve;
          // Anker (2026-10-16): Niveau der besten Elf beim ersten Saisonwechsel; Wachstum gedämpft nach Stärke wie die
          // deutschen Kader (Kickdraft-Kurve) – ungedämpft stieg Reals Elf in 8 Saisons von 88 auf 95
          const NV = welt().euroNiveau, niv = NV[id] != null ? NV[id] : (NV[id] = elfVon(kader));
          kader.forEach(p => {
            p.age = (p.age || 24) + 1;
            const pot = p.truePotential || p.ovr;
            let d = 0;
            if (p.age <= 24 && p.ovr < pot) d = 1 + (Math.random() < 0.45 ? 1 : 0);
            else if (p.age <= 28 && p.ovr < pot && Math.random() < 0.35) d = 1;
            // 2026-10-16: Abbau nach der echten Alterskurve (kickstil_alterskurve.js) statt −1 mit 35–60 %
            else if (AK) d = -AK.verlust(p, p.age);
            else if (p.age >= 31 && Math.random() < 0.35 + (p.age - 31) * 0.07) d = -1;
            if (d > 0) d = Math.min(runden(d * daempfung(p.ovr)), pot - p.ovr);
            if (d) {
              ['def', 'mid', 'att'].forEach(k => { p[k] = Math.max(30, Math.min(97, (p[k] || p.ovr) + d)); });
              p.ovr = Math.max(40, Math.round((p.def + p.mid + p.att) / 3));
              if (d < 0) p.truePotential = Math.max(p.ovr, Math.min(pot, pot + d));
            }
          });
          kader = kader.filter(p => p.age < 32 ? true :
            (p.age >= 38 ? false : Math.random() >= (p.age - 32 + 1) * 0.28));
          const pos = POS_VERTEILUNG;
          // Kaderplanung (2026-10-16): beste Elf unter Vereinsniveau − 1 → bis zu 3 fertige Zugänge (wie die deutschen
          // Vereine in kickstil_lebende_welt.js), sonst verlören Real & Co. mit der Alterskurve jedes Jahr an Klasse
          const schnitt = elfVon(kader);
          // 2026-10-16: mit dem KI-Transfermarkt (kickstil_ki_markt.js) kaufen die Vereine selbst – erzeugt wird nur noch bei
          // einer großen Lücke (Niveau − 3) ein einziger Spieler; Stars verschwinden nicht mehr, sie werden verkauft
          const KM = !!(window.KSMarkt && window.KSMarkt.aktiv);
          for (let n = 0; n < (KM ? 1 : 3) && schnitt + n * 0.6 < niv - (KM ? 3 : 1); n++) {
            const z = spieler(club, prof, pos[Math.floor(Math.random() * pos.length)], Math.floor(Math.random() * 4), false);
            z.age = Math.max(23, Math.min(29, z.age)); z.zugang = 1; kader.push(z);
          }
          // Über dem Niveau: gestandene Stars über Niveau + 2 wechseln mit 50 % (andere Liga, Ausland) – wie der Markt in echt
          if (!KM && schnitt > niv + 2) {
            kader.filter(p => p.age >= 26 && p.age <= 31 && posOvrE(p) > niv + 2).sort((a, b) => posOvrE(b) - posOvrE(a)).slice(0, 2)
              .forEach(p => { if (Math.random() < 0.5) kader.splice(kader.indexOf(p), 1); });
          }
          // Nachwuchs: zuerst aus der eigenen Akademie (kickstil_akademien.js, nur wenn sie schon angelegt ist)
          const AKD = window.KSAkademien;
          while (kader.length < 26) {
            const n = AKD && AKD.nachwuchsEuro ? AKD.nachwuchsEuro(id) : null;
            kader.push(n || spieler(club, prof, pos[Math.floor(Math.random() * pos.length)], 20, true));
          }
          // Zu groß (Zugänge): die schwächsten Ältesten gehen
          if (kader.length > 28) kader = kader.sort((a, b) => (b.ovr - (b.age > 30 ? 3 : 0)) - (a.ovr - (a.age > 30 ? 3 : 0))).slice(0, 28);
          k[id] = kader;
        });
      } catch (e) { console.warn('[EuroKader]', e); }
  }
  window.euroKaderSaison = euroSaison;

  function wrapEinhaengen() {
    if (window.__euroSaisonGehaengt) return;
    if (typeof window.npcKaderSaison !== 'function') return;
    window.__euroSaisonGehaengt = true;
    const _npc = window.npcKaderSaison;
    window.npcKaderSaison = function () {
      const b = _npc.apply(this, arguments) || {};
      euroSaison();
      return b;
    };
  }
  wrapEinhaengen();                                   // falls doch schon geladen
  window.addEventListener('load', wrapEinhaengen);

  console.log('%c[EuroKader v1] aktiv', 'color:#3fb950;font-weight:bold',
    '— 26er-Kader für alle europäischen Vereine, nach Vereinsprofil');
})();
;/* ── js/npc_kaderleben.js ── */
/* ═══════════════════════════════════════════════════════════════════════════
   NPC-KADERLEBEN  ·  v1
   ─────────────────────────────────────────────────────────────────────────
   Die 56 Vereine mit echtem Kader (CLUB.npcSquads) waren eingefroren: Spieler
   wechselten zwar zwischen ihnen, aber niemand wurde älter, niemand hörte auf,
   niemand rückte nach. Nach zehn Jahren hätte die Bundesliga aus lauter
   35-Jährigen bestanden — und jeder Abgang ins Ausland hätte den Kader
   dauerhaft verkleinert, weil nichts nachkam.

   Dieses Modul gibt den NPC-Kadern einen Lebenszyklus:
   · ALTERN       — jede Saison ein Jahr, mit Entwicklung und Abbau
   · VERLÄNGERN   — Verträge laufen weiter; wer gebraucht wird, bleibt
   · AUFHÖREN     — ab 34 steigt die Wahrscheinlichkeit, dass Schluss ist
   · NACHRÜCKEN   — jeder Verein bringt eigene Talente hoch, passend zu seiner
                    Klasse und zu seinem Nachwuchsruf

   Damit trägt sich die Spielwelt über 10–12 Jahre selbst.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const CFG = {
    zielKader: 26,            // angestrebte Kadergröße
    talenteImKader: 6,        // davon Nachwuchs
    minKader: 22,
    // Karriereende. Erste Messung ergab nach 12 Saisons 15 % Spieler über 33 —
    // real sind es rund 5 %. Deshalb früher und steiler.
    endeAb: 32,
    endeProJahr: 0.28,        // je Jahr über endeAb
    endeSicherAb: 38,
    // Nachwuchs
    talenteProSaison: [2, 3], // wie viele je Verein hochkommen (2026-10-21, Fehleranalyse M1: vorher 1–3 und nur bei Kadern unter 26)
    abgangAb: 23,             // dafür gehen die schwächsten Ersatzspieler ab diesem Alter, wenn der Kader zu groß wird
    talentAlter: [17, 19],
    // Entwicklung
    entwicklungBis: 24,
    abbauAb: 31
  };
  window.NpcKaderleben = CFG;

  function squads() {
    try { return (window.NpcRealTransfers && NpcRealTransfers.npcSquads()) || null; }
    catch (e) { return null; }
  }
  function klubOvr(clubId) {
    try {
      const tiers = LEAGUE && LEAGUE.tiers;
      for (const k in tiers) {
        for (const g of (tiers[k].groups || [])) {
          const t = (g.teams || []).find(x => x && x.id === clubId);
          if (t) return t.ovr || Math.round(((t.def || 70) + (t.mid || 70) + (t.att || 70)) / 3);
        }
      }
    } catch (e) {}
    // RÜCKFALL über den eigenen Kader. Ohne ihn lieferte diese Funktion für
    // jeden Verein 70 — und damit brachte Duisburg dieselben Talente hervor wie
    // Leverkusen. Maßstab sind die elf Besten, nicht der ganze Kader.
    try {
      const k = (squads() || {})[clubId] || [];
      if (k.length >= 5) {
        const top = k.map(p => p.ovr || 60).sort((a, b) => b - a).slice(0, 11);
        return Math.round(top.reduce((a, b) => a + b, 0) / top.length);
      }
    } catch (e) {}
    return 70;
  }

  // ── Namen für Eigengewächse ───────────────────────────────────────────────
  function nachwuchsName(land) {
    const SC = (typeof window !== 'undefined' && window.SCOUTING_COUNTRIES) || null;
    if (SC) {
      const l = (land && SC[land]) ? land : 'Deutschland';
      const c = SC[l];
      if (c && c.first && c.last) {
        return { firstName: c.first[Math.floor(Math.random() * c.first.length)],
                 name: c.last[Math.floor(Math.random() * c.last.length)],
                 flag: c.flag || '', country: l };
      }
    }
    return { firstName: 'Max', name: 'Neumann', flag: '🇩🇪', country: 'Deutschland' };
  }

  // ── Ein Eigengewächs erzeugen ─────────────────────────────────────────────
  // Die Klasse orientiert sich am Verein: Bayern bringt bessere Talente hoch als
  // ein Aufsteiger. Das Potenzial darf ausreißen — auch ein kleiner Verein kann
  // einmal ein Juwel hervorbringen, nur seltener.
  function erzeugeTalent(clubId) {
    const ovrKlub = klubOvr(clubId);
    const alter = CFG.talentAlter[0] +
                  Math.floor(Math.random() * (CFG.talentAlter[1] - CFG.talentAlter[0] + 1));
    const basis = Math.max(45, ovrKlub - 16 + Math.floor(Math.random() * 9));
    // Potenzial: im Mittel etwas unter Vereinsniveau, mit langer Spitze nach oben
    let pot = basis + 6 + Math.floor(Math.random() * 12);
    // Je stärker die Akademie, desto eher ein Ausnahmetalent. Bei OVR 78 rund
    // 3 %, bei OVR 62 praktisch nie — der große Klub zieht die Besten an.
    const juwelChance = Math.max(0.002, (ovrKlub - 62) * 0.0021);
    if (Math.random() < juwelChance) pot = 85 + Math.floor(Math.random() * 11);
    pot = Math.min(95, Math.max(basis + 3, pot));
    const POS = ['TW', 'IV', 'IV', 'LV', 'RV', 'ZDM', 'ZM', 'ZM', 'ZOM', 'LF', 'RF', 'ST', 'ST'];
    const pos = POS[Math.floor(Math.random() * POS.length)];
    const n = nachwuchsName(null);
    const p = {
      firstName: n.firstName, name: n.name, flag: n.flag, country: n.country,
      age: alter, pos: pos, positions: [pos],
      def: ['TW', 'IV', 'AV', 'LV', 'RV'].indexOf(pos) >= 0 ? basis + 3 : basis - 4,
      mid: ['ZM', 'ZDM', 'OM', 'ZOM', 'LM', 'RM', 'AM'].indexOf(pos) >= 0 ? basis + 3 : basis - 2,
      att: ['ST', 'FL', 'LF', 'RF'].indexOf(pos) >= 0 ? basis + 3 : basis - 5,
      ovr: basis, truePotential: pot, clubId: clubId, eigengewaechs: true
    };
    p.ovr = Math.round((p.def + p.mid + p.att) / 3);
    try { if (typeof window.traitsVergeben === 'function') window.traitsVergeben(p); } catch (e) {}
    return p;
  }

  // ── Eine Saison im Leben eines NPC-Kaders ─────────────────────────────────
  function saisonSchritt() {
    const sq = squads();
    if (!sq) return null;
    const bericht = { gealtert: 0, aufgehoert: 0, nachgerueckt: 0, juwele: 0 };

    Object.keys(sq).forEach(clubId => {
      let kader = sq[clubId];
      if (!Array.isArray(kader)) return;

      // 1) ALTERN samt Entwicklung und Abbau (2026-10-15: Kickdraft-Entwicklung aus kickstil_lebende_welt.js, wenn da)
      if (typeof CFG.entwickle === 'function') { CFG.entwickle(kader, clubId); bericht.gealtert += kader.length; }
      else kader.forEach(p => {
        p.age = (p.age || 24) + 1;
        bericht.gealtert++;
        const pot = p.truePotential || p.ovr;
        if (p.age <= CFG.entwicklungBis && p.ovr < pot) {
          // Junge entwickeln sich zügig auf ihr Potenzial zu
          const schritt = 1 + (Math.random() < 0.45 ? 1 : 0);
          p.ovr = Math.min(pot, p.ovr + schritt);
        } else if (p.age <= 28 && p.ovr < pot && Math.random() < 0.35) {
          p.ovr = Math.min(pot, p.ovr + 1);
        } else if (p.age >= CFG.abbauAb && Math.random() < 0.35 + (p.age - CFG.abbauAb) * 0.07) {
          p.ovr = Math.max(40, p.ovr - 1);
        }
        const f = p.ovr / Math.max(1, Math.round((p.def + p.mid + p.att) / 3));
        p.def = Math.round(p.def * f); p.mid = Math.round(p.mid * f); p.att = Math.round(p.att * f);
      });

      // 2) KARRIEREENDE — ab 33 steigend, ab 39 sicher
      kader = kader.filter(p => {
        if (typeof CFG.hoertAuf === 'function') { if (CFG.hoertAuf(p)) { bericht.aufgehoert++; return false; } return true; }
        if (p.age < CFG.endeAb) return true;
        const chance = p.age >= CFG.endeSicherAb ? 1
          : (p.age - CFG.endeAb + 1) * CFG.endeProJahr;
        if (Math.random() < chance) { bericht.aufgehoert++; return false; }
        return true;
      });

      // 3) NACHWUCHS — so viele, wie der Kader braucht, mindestens einer
      const fehlt = Math.max(0, CFG.zielKader - kader.length);
      const basisAnzahl = CFG.talenteProSaison[0] +
        Math.floor(Math.random() * (CFG.talenteProSaison[1] - CFG.talenteProSaison[0] + 1));
      const anzahl = Math.max(basisAnzahl, Math.min(fehlt, 6));
      // 2026-10-15: Talente kommen aus der Akademie des Vereins (kickstil_akademien.js), sonst wie bisher erfunden
      if (typeof CFG.akademieJahr === 'function') { try { CFG.akademieJahr(clubId); } catch (e) {} }
      // 2026-10-21 (M1): Talente kommen immer – volle Kader geben dafür unten die schwächsten Ersatzspieler ab (siehe nach der Schleife);
      // vorher blockierte „kader.length < zielKader + 2“ den Nachwuchs bei fast allen Vereinen, die Welt alterte (≤ 21 J. −55 % in 5 Saisons)
      for (let i = 0; i < anzahl; i++) {
        let t = null;
        try { t = typeof CFG.nachwuchs === 'function' ? CFG.nachwuchs(clubId) : null; } catch (e) { t = null; }
        if (!t) t = erzeugeTalent(clubId);
        kader.push(t);
        bericht.nachgerueckt++;
        if ((t.truePotential || 0) >= 85) bericht.juwele++;
      }

      // 3b) Zu große Kader: schwächste Ersatzspieler ab CFG.abgangAb gehen (Platz für den Nachwuchs)
      while (kader.length > CFG.zielKader + 2) {
        const alt = kader.filter(p => (p.age || 0) >= CFG.abgangAb).sort((a, b) => (a.ovr || 0) - (b.ovr || 0))[0];
        if (!alt) break;
        kader.splice(kader.indexOf(alt), 1);
        bericht.abgegeben = (bericht.abgegeben || 0) + 1;
      }

      // 4) Zu kleine Kader auffüllen, damit ein Verein nie ausblutet
      while (kader.length < CFG.minKader) {
        kader.push(erzeugeTalent(clubId));
        bericht.nachgerueckt++;
      }
      sq[clubId] = kader;
    });
    return bericht;
  }
  window.npcKaderSaison = saisonSchritt;

  // ── VERTRAGSVERLÄNGERUNG ──────────────────────────────────────────────────
  // Die bestehende Logik entscheidet nur, ob ein Star bei einem Angebot bleibt.
  // Sie kannte weder Alter noch Kaderbedarf: Ein 34-Jähriger wurde genauso
  // gehalten wie ein 24-Jähriger. Jetzt zählt beides.
  if (window.NpcRealTransfers && typeof window.NpcRealTransfers.simulateRealNpcTransfers === 'function') {
    const _orig = window.NpcRealTransfers.simulateRealNpcTransfers;
    window.NpcRealTransfers.simulateRealNpcTransfers = function () {
      const log = _orig.apply(this, arguments) || [];
      // Nach den Transfers: Kaderleben. So wandern Spieler erst, dann altert die
      // Welt — sonst würde ein gerade Verpflichteter sofort wieder aufhören.
      try {
        // über window: dort hängt kaderstaerke.js (Vereinsstärke folgt dem Kader) – der lokale Aufruf lief daran vorbei
        const b = (window.npcKaderSaison || saisonSchritt)();
        if (b && typeof addNews === 'function' && b.nachgerueckt) {
          addNews('transfer', 'Nachwuchs rückt nach',
            b.nachgerueckt + ' Talente aus den Nachwuchsleistungszentren haben den Sprung in ' +
            'die Profikader geschafft, ' + b.aufgehoert + ' Spieler haben ihre Karriere beendet.' +
            (b.juwele ? ' Unter den Neuen sollen ' + b.juwele + ' echte Ausnahmetalente sein.' : ''));
        }
      } catch (e) { console.warn('[NpcKaderleben]', e); }
      return log;
    };
  }

  console.log('%c[NpcKaderleben v1] aktiv', 'color:#3fb950;font-weight:bold',
    '— NPC-Kader altern, Spieler hören auf, Nachwuchs rückt nach');
})();
