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