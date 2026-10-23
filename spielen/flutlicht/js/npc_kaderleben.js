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