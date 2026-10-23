/* ===== npc_real_transfers_patch.js =====
   Echte, namentliche NPC-Transfers mit Kader-Umzug.
   ─────────────────────────────────────────────────────────────────────────────
   - Nutzt die echten Spieler aus EMBEDDED_PLAYERS (Liga 1-3 haben volle Kader).
   - NPC-Vereine kaufen sich gegenseitig echte, benannte Spieler ab (z.B.
     Schlotterbeck vom BVB zu Real Madrid) — der Spieler zieht wirklich um.
   - Auch von/zu ausländischen Top-Klubs (EURO_CLUBS).
   - Budget-Gate wie gehabt (Käufer muss sich die Ablöse leisten können).
   - Vertragsverlängerungen: starke Klubs halten ihre Leistungsträger.
   - Unabhängig vom kaufbaren Markt des Spielers (RealMarket bleibt separat).
   Lädt nach bundle_europa.js (dessen abstrakte NPC-Transfers werden für Vereine
   mit echtem Kader übersprungen) und nach bundle_match.js.
   ============================================================================= */
(function () {
  'use strict';

  const CFG = {
    transfersPerSeason: [10, 18],   // echte namentliche Transfers pro Saison
    minOvrToMove: 62,               // darunter uninteressant für den NPC-Markt
    keepChanceCap: 0.55,            // max. Haltewahrscheinlichkeit (Verlängerung)
    newsMax: 8,
    foreignBuyerChance: 0.42,       // Anteil der Transfers, bei denen ein Euro-Klub kauft
  };
  const SQUAD_MIN = 20;   // darunter wird aktiv nachgekauft
  const SQUAD_MAX = 34;   // darüber werden überzählige Spieler abgegeben
  const SQUAD_IDEAL = 28; // Zielgröße nach Aufräumen

  function EP() { return window.EMBEDDED_PLAYERS || []; }
  function EC_CLUBS() { return window.EMBEDDED_CLUBS || []; }
  function EURO() { return window.EURO_CLUBS || []; }

  // ── NPC-Kader-Zustand (persistent in CLUB.npcSquads) ────────────────────────
  // Aufbau beim ersten Zugriff: echte Spieler nach clubId gruppiert.
  function npcSquads() {
    if (!CLUB.npcSquads) {
      const squads = {};
      EP().forEach(raw => {
        if (!raw.clubId) return;
        if (raw.clubId === ownClubId()) return;          // eigener Verein nicht als NPC
        const ovr = Math.round((raw.def + raw.mid + raw.att) / 3);
        (squads[raw.clubId] = squads[raw.clubId] || []).push({
          name: raw.name, firstName: raw.firstName || '', flag: raw.flag || '',
          country: raw.country || '', age: raw.age || 24,
          positions: raw.positions || ['ZM'], pos: (raw.positions && raw.positions[0]) || 'ZM',
          def: raw.def, mid: raw.mid, att: raw.att, ovr,
          truePotential: Math.max(ovr, raw.truePotential || ovr),
          clubId: raw.clubId,
        });
      });
      CLUB.npcSquads = squads;
    }
    return CLUB.npcSquads;
  }

  function ownClubId() {
    // 2026-10-15: der eigene Kartei-Verein steht in CLUB.dataClubId (t.realClubId gibt es nicht) – vorher stand er doppelt drin
    try { if (CLUB.dataClubId) return CLUB.dataClubId; } catch (e) {}
    try {
      const fg = findFcmGroup(LEAGUE);
      const t = fg && fg.group.teams.find(x => x.id === 'fcm');
      return t ? (t.realClubId || 'fcm') : 'fcm';
    } catch (e) { return 'fcm'; }
  }

  function clubNameById(id) {
    const c = EC_CLUBS().find(x => x.id === id);
    if (c) return c.name;
    const e = EURO().find(x => x.id === id);
    return e ? e.name : id;
  }
  function clubFlagById(id) {
    const e = EURO().find(x => x.id === id);
    return e ? e.flag : '🇩🇪';
  }

  // Kaufkraft eines Vereins (nutzt das Budget-Modell aus NpcDevelopment, wenn da).
  function clubBudget(clubId, isForeign, ovr) {
    // grobe Näherung über Vereinsstärke; nutzt euroClubBudget-ähnliche Kurve
    if (isForeign) {
      const e = EURO().find(x => x.id === clubId);
      const o = e ? e.ovr : (ovr || 70);
      return Math.round(Math.pow(Math.max(0, o - 52), 3.05) * 62 * (0.75 + Math.random() * 0.5));
    }
    const c = EC_CLUBS().find(x => x.id === clubId);
    const o = c ? Math.round((c.def + c.mid + c.att) / 3) : 70;
    const tier = c ? tierOfLeague(c.league) : 3;
    // dieselbe Logik wie im abstrakten Modell (vereinfacht)
    const tierBase = { 1: 40000000, 2: 8000000, 3: 1500000, 4: 300000 }[tier] || 300000;
    const mul = 1 + Math.max(-0.5, (o - tierMean(tier)) / 20);
    return Math.round(tierBase * mul * (0.6 + Math.random() * 0.8));
  }
  function tierOfLeague(lg) {
    if (!lg) return 3;
    if (lg === 'Bundesliga') return 1;
    if (lg === '2. Bundesliga') return 2;
    if (lg === '3. Liga') return 3;
    return 4;
  }
  function tierMean(t) { return { 1: 78, 2: 70, 3: 63, 4: 57 }[t] || 60; }

  function feeForPlayer(ovr, age, potential) {
    // dieselbe steile Kurve wie im Europa-Bundle
    const base = Math.max(0, ovr - 48);
    let m = Math.pow(base, 4.91) * 1.26;
    // Jung + hohes Potenzial → teurer
    if (age <= 23 && potential - ovr >= 6) m *= 1.35;
    if (age >= 31) m *= 0.6;
    return Math.max(20000, Math.round(m * (0.8 + Math.random() * 0.4) / 1000) * 1000);
  }

  // ── Haupt-Transferlauf mit echten Spielern ──────────────────────────────────
  function simulateRealNpcTransfers() {
    const squads = npcSquads();
    const clubIds = Object.keys(squads).filter(id => squads[id] && squads[id].length > 18);
    if (clubIds.length < 4) return [];

    // Käufer-Kandidaten: deutsche Klubs mit Kader + ausländische Top-Klubs
    const foreignBuyers = EURO().filter(c => c.ovr >= 74);

    // 2026-10-16: mit kickstil_ki_markt.js (Kasse, Bedarf, Sportdirektor) keine Zufallswechsel mehr
    const nT = (window.KSMarkt && window.KSMarkt.aktiv) ? 0 : CFG.transfersPerSeason[0] +
      Math.floor(Math.random() * (CFG.transfersPerSeason[1] - CFG.transfersPerSeason[0] + 1));
    const log = [];
    const spent = {};   // clubId → schon ausgegeben

    for (let i = 0; i < nT; i++) {
      // Verkäufer-Verein (deutscher Klub mit Kader)
      const sellerId = clubIds[Math.floor(Math.random() * clubIds.length)];
      const squad = squads[sellerId];
      if (!squad || squad.length <= SQUAD_MIN + 2) continue;    // genug Puffer lassen

      // Ein begehrter Spieler (eher stärkere, mit etwas Zufall)
      const candidates = squad.filter(p => p.ovr >= CFG.minOvrToMove);
      if (!candidates.length) continue;
      const player = weightedPick(candidates, p => Math.pow(p.ovr - CFG.minOvrToMove + 1, 1.5));

      // Käufer bestimmen: ausländischer Top-Klub oder stärkerer deutscher Klub
      let buyerId, buyerForeign, buyerOvr, buyerName, buyerFlag;
      if (Math.random() < CFG.foreignBuyerChance && foreignBuyers.length) {
        // Ausländischer Käufer, der stärker ist als der Spieler
        const pool = foreignBuyers.filter(c => c.ovr >= player.ovr - 2);
        if (!pool.length) continue;
        const b = pool[Math.floor(Math.random() * pool.length)];
        buyerId = b.id; buyerForeign = true; buyerOvr = b.ovr; buyerName = b.name; buyerFlag = b.flag;
      } else {
        // Deutscher Käufer aus einem stärkeren/ähnlichen Verein
        const buyerPool = clubIds.filter(id => {
          if (id === sellerId) return false;
          const c = EC_CLUBS().find(x => x.id === id);
          if (!c) return false;
          const o = Math.round((c.def + c.mid + c.att) / 3);
          return o >= player.ovr - 4;      // Käufer muss dem Spieler-Niveau nahe kommen
        });
        if (!buyerPool.length) continue;
        buyerId = buyerPool[Math.floor(Math.random() * buyerPool.length)];
        buyerForeign = false;
        const c = EC_CLUBS().find(x => x.id === buyerId);
        buyerOvr = Math.round((c.def + c.mid + c.att) / 3);
        buyerName = c.name; buyerFlag = '🇩🇪';
      }

      // VERTRAGSVERLÄNGERUNG: hält der Verkäufer seinen Star?
      const sellerClub = EC_CLUBS().find(x => x.id === sellerId);
      const sellerOvr = sellerClub ? Math.round((sellerClub.def + sellerClub.mid + sellerClub.att) / 3) : 70;
      const isStar = player.ovr >= sellerOvr - 1;
      if (isStar) {
        let keep = Math.min(CFG.keepChanceCap, Math.max(0, (sellerOvr - 72) / 40));
        const pull = Math.max(0, buyerOvr - sellerOvr);
        keep *= Math.max(0.3, 1 - pull * 0.08);
        if (Math.random() < keep) {
          log.push({ renewal: true, player, club: sellerId });
          continue;
        }
      }

      // Ablöse + Budget-Gate
      const fee = feeForPlayer(player.ovr, player.age, player.truePotential);
      const budget = clubBudget(buyerId, buyerForeign, buyerOvr) - (spent[buyerId] || 0);
      if (fee > budget) continue;    // Käufer kann sich das nicht leisten
      spent[buyerId] = (spent[buyerId] || 0) + fee;

      // KADER-UMZUG: Spieler wirklich verschieben
      const idx = squad.indexOf(player);
      if (idx >= 0) squad.splice(idx, 1);
      player.clubId = buyerId;
      if (!buyerForeign) {
        (squads[buyerId] = squads[buyerId] || []).push(player);
      }
      // (bei ausländischem Käufer verlässt der Spieler die deutsche DB-Sicht)
      // Kadergröße wird am Ende zentral gepflegt (maintainSquadSizes): zu kleine
      // Kader kaufen aktiv nach, zu große geben ab.

      log.push({
        player, fee,
        fromId: sellerId, fromName: clubNameById(sellerId), fromFlag: '🇩🇪',
        toId: buyerId, toName: buyerName, toFlag: buyerFlag,
        international: buyerForeign,
      });
    }

    reportRealTransfers(log);
    // Kaderpflege: zu große Kader geben ab, zu kleine kaufen nach.
    maintainSquadSizes(squads, clubIds, log);
    return log;
  }

  // ── Kaderpflege: Ober-/Untergrenze ───────────────────────────────────────────
  function maintainSquadSizes(squads, clubIds, log) {
    clubIds.forEach(id => {
      const squad = squads[id];
      if (!squad) return;

      // ZU GROSS: überzählige (meist schwächere/ältere) Spieler abgeben.
      // Sie wechseln zu einem passenden, schwächeren Verein oder werden
      // "freigesetzt" (Karriereende/Ligaabstieg), wenn keiner passt.
      if (squad.length > SQUAD_MAX) {
        const surplus = squad.length - SQUAD_IDEAL;
        // schwächste/älteste zuerst abgeben, Stammspieler (Top OVR im Team) bleiben
        const sorted = squad.slice().sort((a, b) => (a.ovr - a.age * 0.3) - (b.ovr - b.age * 0.3));
        for (let i = 0; i < surplus && i < sorted.length; i++) {
          const p = sorted[i];
          const idx = squad.indexOf(p);
          if (idx < 0) continue;
          squad.splice(idx, 1);
          // an einen schwächeren Verein vermitteln, wenn möglich
          const target = clubIds.find(cid => {
            if (cid === id) return false;
            const c = EC_CLUBS().find(x => x.id === cid);
            if (!c) return false;
            const o = Math.round((c.def + c.mid + c.att) / 3);
            return squads[cid].length < SQUAD_MAX && Math.abs(o - p.ovr) <= 8;
          });
          if (target) {
            p.clubId = target;
            squads[target].push(p);
            log.push({ loan: true, player: p, fromId: id, fromName: clubNameById(id), toId: target, toName: clubNameById(target) });
          }
          // sonst: Spieler verlässt den Datenpool (vereinslos/Karriereende) — kein Log nötig
        }
      }

      // ZU KLEIN: aktiv einen Ersatz vom Markt holen (anderer NPC-Verein).
      if (squad.length < SQUAD_MIN) {
        const need = SQUAD_MIN - squad.length;
        for (let i = 0; i < need; i++) {
          const c = EC_CLUBS().find(x => x.id === id);
          const clubOvr = c ? Math.round((c.def + c.mid + c.att) / 3) : 65;
          // billigen, passenden Spieler von einem Verein mit Überschuss finden
          const donor = clubIds.find(cid => {
            if (cid === id) return false;
            const s = squads[cid];
            return s && s.length > SQUAD_MIN + 2;
          });
          if (donor) {
            const donorSquad = squads[donor];
            const candidates = donorSquad.filter(p => p.ovr <= clubOvr + 3);
            if (candidates.length) {
              const p = candidates[Math.floor(Math.random() * candidates.length)];
              const idx = donorSquad.indexOf(p);
              donorSquad.splice(idx, 1);
              p.clubId = id;
              squad.push(p);
              continue;
            }
          }
          // kein passender Spender gefunden → eigenen Nachwuchs hochziehen
          replenishSquad(id, squad, { pos: 'ZM', positions: ['ZM'] });
        }
      }
    });
  }

  // Ersatzspieler generieren, wenn ein Verein einen Spieler abgibt (Nachwuchs/
  // Neuzugang), damit die Kader über die Saisons nicht leerlaufen. Der Ersatz ist
  // meist etwas schwächer (Talent mit Potenzial) — so wandert Qualität nach oben.
  // 2026-10-15: die großen Listen aus engine_main.js (100 Vor-, 200 Nachnamen) statt 12 fester Namen
  const FIRST_NAMES = (typeof GERMAN_FIRST !== 'undefined' && GERMAN_FIRST.length) ? GERMAN_FIRST : ['Luca', 'Nico', 'Tim', 'Jan', 'Leon', 'Finn', 'Paul', 'Max', 'Elias', 'Noah', 'Ben', 'Jonas'];
  const LAST_NAMES = (typeof TRANSFER_SURNAMES !== 'undefined' && TRANSFER_SURNAMES.length) ? TRANSFER_SURNAMES : ['Müller', 'Schmidt', 'Wagner', 'Becker', 'Hofmann', 'Krüger', 'Braun', 'Richter', 'Klein', 'Wolf', 'Schäfer', 'Neumann'];
  function replenishSquad(clubId, squad, soldPlayer) {
    const c = EC_CLUBS().find(x => x.id === clubId);
    const clubOvr = c ? Math.round((c.def + c.mid + c.att) / 3) : 68;
    // Ersatz: jung, etwas unter Vereinsniveau, mit Entwicklungspotenzial
    const ovr = Math.max(52, clubOvr - 4 - Math.floor(Math.random() * 6));
    const age = 17 + Math.floor(Math.random() * 4);
    const pos = soldPlayer.pos || 'ZM';
    const repl = {
      name: LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)],
      firstName: FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)],
      flag: '🇩🇪', country: 'Deutschland', age,
      positions: soldPlayer.positions || [pos], pos,
      def: ovr, mid: ovr, att: ovr, ovr,
      truePotential: Math.min(92, ovr + 6 + Math.floor(Math.random() * 10)),
      clubId, _regen: true,
    };
    squad.push(repl);
  }

  function weightedPick(arr, wfn) {
    const weights = arr.map(wfn);
    const sum = weights.reduce((a, b) => a + b, 0);
    if (sum <= 0) return arr[Math.floor(Math.random() * arr.length)];
    let r = Math.random() * sum;
    for (let i = 0; i < arr.length; i++) { r -= weights[i]; if (r <= 0) return arr[i]; }
    return arr[arr.length - 1];
  }

  function reportRealTransfers(log) {
    if (typeof addNews !== 'function') return;
    const transfers = log.filter(t => !t.renewal);
    const renewals = log.filter(t => t.renewal);

    if (transfers.length) {
      const top = transfers.slice().sort((a, b) => b.fee - a.fee).slice(0, CFG.newsMax);
      const lines = top.map(t => {
        const p = t.player;
        const nm = (p.flag ? p.flag + ' ' : '') + (p.firstName ? p.firstName + ' ' : '') + p.name;
        const intl = t.international ? ' 🌍' : '';
        return `${nm} (${p.pos}, OVR ${p.ovr}) — ${t.fromName} → ${t.toFlag} ${t.toName} · ${fmtFee(t.fee)}${intl}`;
      });
      const intlCount = transfers.filter(t => t.international).length;
      addNews('transfer', `🔄 Transfermarkt: ${transfers.length} Wechsel${intlCount ? ` (${intlCount} international)` : ''}`,
        'Die größten Transfers:\n• ' + lines.join('\n• '));
    }
    if (renewals.length) {
      const topR = renewals.slice().sort((a, b) => b.player.ovr - a.player.ovr).slice(0, 5);
      const rlines = topR.map(t => {
        const p = t.player;
        const nm = (p.flag ? p.flag + ' ' : '') + (p.firstName ? p.firstName + ' ' : '') + p.name;
        return `${clubNameById(t.club)} verlängert mit ${nm} (${p.pos})`;
      });
      addNews('transfer', `✍️ ${renewals.length} Vertragsverlängerung${renewals.length !== 1 ? 'en' : ''}`,
        'Leistungsträger bleiben:\n• ' + rlines.join('\n• '));
    }
  }

  function fmtFee(v) {
    if (typeof formatEuro === 'function') return formatEuro(v);
    return v >= 1e6 ? (v / 1e6).toFixed(1) + ' Mio €' : Math.round(v / 1000) + 'k €';
  }

  // ── In den Saisonablauf einhängen ───────────────────────────────────────────
  // Wir hängen uns an denselben Punkt wie die abstrakten NPC-Transfers, ersetzen
  // sie aber NICHT komplett — die abstrakte Logik entwickelt weiter die
  // Regionalliga & Vereine ohne echten Kader.
  if (window.NpcDevelopment && typeof window.NpcDevelopment.simulateNpcTransfers === 'function') {
    const _origSim = window.NpcDevelopment.simulateNpcTransfers;
    window.NpcDevelopment.simulateNpcTransfers = function (league) {
      // Echte namentliche Transfers für Vereine mit echtem Kader
      let realLog = [];
      // 2026-10-15: über window – sonst lief der Wrapper aus npc_kaderleben.js (Altern, Karriereende, Nachwuchs) nie
      try { realLog = (window.NpcRealTransfers ? window.NpcRealTransfers.simulateRealNpcTransfers : simulateRealNpcTransfers)(); }
      catch (e) { console.warn('[NpcReal] Fehler', e); }
      // Abstrakte Transfers weiterhin (für Regionalliga & Kaderlose), aber ohne
      // erneute News-Flut — wir lassen sie leise laufen für die Stärke-Entwicklung.
      let absLog = [];
      try { absLog = _origSim.call(this, league); } catch (e) {}
      return realLog.concat(absLog);
    };
  }

  window.NpcRealTransfers = { simulateRealNpcTransfers, npcSquads };
  console.log('[NpcRealTransfers] aktiv — echte namentliche NPC-Transfers mit Kader-Umzug');
})();
