/* ===== buy_negotiation_patch.js =====
   Kaufverhandlungen in ZWEI Dialogen:
   1) mit dem abgebenden Verein — Ablöse, Zahlungsweise (sofort/Raten),
      Weiterverkaufsbeteiligung, Erfolgs-Prämien → Verein nimmt an / kontert / lehnt ab.
   2) danach mit dem Spieler (bestehender openNegotiation-Dialog im Kauf-Modus).
   NPC-Preis & Bereitschaft: alle kaufbar, aber Restvertrag/Wichtigkeit treiben den
   Preis; wechselwillige NPCs (~25%) sind günstiger und williger.
   Lädt NACH contracts_patch.js (braucht openNegotiation-Kaufmodus). Wrappt buyPlayer,
   acceptTransferBid und startNewSeason (Raten + Prämien).
   ============================================================================= */
(function () {
  'use strict';

  const IMP_F = { key: 1.30, normal: 1.00, fringe: 0.85 };
  const YEARS_F = { 1: 0.8, 2: 1.0, 3: 1.4, 4: 1.9 };

  // ── WAHRSCHEINLICHKEITEN statt fester Schwelle ────────────────────────────
  // Vorher war die Verhandlung eine Rechenaufgabe: der Balken zeigte exakt, ab
  // wann der Verein zusagt, und unterhalb davon war jedes Angebot chancenlos.
  // Ein Gebot von 80 % der Forderung konnte NIE durchgehen.
  // Jetzt entscheidet ein Wurf. Die Chance hängt davon ab, wie nah dein Angebot
  // an der Forderung liegt (Quote) — und wie verkaufswillig der Verein ist.
  // Gemessen bei 2 Jahren Restvertrag und normaler Wichtigkeit:
  // 60 % → 9 %, 70 % → 17 %, 80 % → 29 %, 90 % → 45 %, 100 % → 62 %, 120 % → 87 %.
  const CHANCE = {
    steigung:       7.1,    // Steilheit der Kurve
    mitte:          0.90,   // Quote mit rund 50 % Chance
    bereitschaftF:  0.35,   // wie stark die Verkaufsbereitschaft die Mitte schiebt
    maxRunden:      5,      // danach sind die Gespräche beendet
    aufschlagRunde: 0.06,   // Forderung steigt je gescheitertem Angebot
    aufschlagFrech: 0.12,   // ... und deutlicher bei Tiefstgeboten
    frechAb:        0.70,   // Quote, ab der es als unseriös gilt
    konterZiel:     0.90,   // Chance, die die Gegenforderung abdeckt
    // JEDER HAT SEINEN PREIS: Früher war bei Verkaufsbereitschaft unter 0,15
    // hart Schluss — „nicht zu haben", egal was man bot. Das traf jeden
    // Stammspieler mit langem Vertrag und war eine Wand statt einer
    // Verhandlung. Jetzt rückt die Kurve stattdessen weit nach rechts: der
    // Preis wird prohibitiv, unmöglich ist er nicht.
    sturAb:         0.30,   // ab dieser Bereitschaft abwärts wird es teuer
    sturF:          2.20,   // wie stark — bei 0,05 braucht es rund 160 % der Forderung
    // KONKURRENZ: Bisher war der Markt ein Wartezimmer — niemand außer dir hat
    // je auf einen Spieler geboten, also kostete Zögern nichts. Jetzt kann ab
    // dem zweiten abgelehnten Angebot ein anderer Verein einsteigen. Dann zählt
    // nicht mehr die Forderung, sondern das höhere fremde Gebot — und wenn die
    // Gespräche platzen, ist der Spieler weg.
    rivaleAb:       2,      // frühestens nach so vielen abgelehnten Angeboten
    rivaleP:        0.32,   // Wahrscheinlichkeit je weiterer Runde
    rivaleMin:      1.00,   // Gebot des Rivalen als Anteil der Forderung
    rivaleMax:      1.30
  };
  window.Kaufverhandlung = CHANCE;             // zum Nachjustieren von außen

  // Verhandlungsstand klebt am Marktspieler: gescheiterte Runden verteuern ihn
  // dauerhaft. Der Markt wird im offenen Fenster wöchentlich neu gewürfelt —
  // damit räumt sich der Stand von selbst wieder auf.
  function negoState(p) {
    if (!p._nego) p._nego = { runden: 0, aufschlag: 0, geplatzt: false, rivale: null };
    return p._nego;
  }

  // Ein plausibler Konkurrent: irgendein Verein aus dem Ligensystem, nur nicht
  // der eigene und nicht der abgebende.
  // Ein plausibler Konkurrent — deutsch oder europäisch. Vorher zog diese
  // Funktion ausschließlich aus LEAGUE.tiers, also nur aus der deutschen
  // Pyramide: Ein englischer oder spanischer Verein hat dich nie überboten,
  // obwohl EURO_CLUBS hunderte echte Vereine mit Stärke und Koeffizient kennt.
  // Jetzt entscheidet die Klasse des Spielers, wie weit der Kreis reicht.
  function fremderKlub(p) {
    const eigen = (typeof CLUB !== 'undefined' && CLUB) ? CLUB.name : '';
    const ovr = (p && p.ovr) || 65;
    // Je besser der Spieler, desto eher ist die Konkurrenz international.
    const auslandP = ovr >= 78 ? 0.60 : ovr >= 72 ? 0.40 : ovr >= 66 ? 0.22 : 0.08;
    if (Math.random() < auslandP) {
      const alle = (typeof window !== 'undefined' && window.EURO_CLUBS) || [];
      // Passende Klasse: ein Verein, für den dieser Spieler interessant wäre.
      const passend = alle.filter(function (c) {
        return c && c.name && c.country !== 'Deutschland' &&
               c.ovr >= ovr - 8 && c.ovr <= ovr + 14 && c.name !== p.fromClub;
      });
      if (passend.length) {
        const k = passend[Math.floor(Math.random() * passend.length)];
        return k.name + ' (' + k.country + ')';
      }
    }
    const raus = [];
    try {
      Object.keys((LEAGUE && LEAGUE.tiers) || {}).forEach(function (k) {
        ((LEAGUE.tiers[k] || {}).groups || []).forEach(function (g) {
          (g.teams || []).forEach(function (t) {
            if (t && t.name && t.name !== eigen && t.name !== p.fromClub) raus.push(t.name);
          });
        });
      });
    } catch (e) {}
    if (!raus.length) return 'ein ausländischer Klub';
    return raus[Math.floor(Math.random() * raus.length)];
  }

  // In diesem Modul gibt es kein esc() — Vereinsnamen kommen aus den Spieldaten,
  // trotzdem nichts ungeprüft in den HTML-String schreiben.
  function esc(x) {
    return String(x == null ? '' : x).replace(/[<>&]/g, function (c) {
      return ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c];
    });
  }

  // Bezugsgröße für die Chance: gegen ein fremdes Gebot musst du ANLEGEN,
  // nicht nur die Forderung treffen.
  function bezugswert(s, p) {
    const r = negoState(p).rivale;
    return Math.max(1, s.ask, r ? r.gebot : 0);
  }

  function euro(v) { return (typeof formatEuro === 'function') ? formatEuro(v) : (Math.round(v) + ' €'); }
  function rm(v) { return (typeof roundMoney === 'function') ? roundMoney(v) : Math.round(v); }
  function hashStr(s) { let h = 0; s = String(s); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }

  // Stabile NPC-Metadaten (Restvertrag, Wichtigkeit, Wechselwunsch) aus der Spieler-ID.
  function ensureNpcMeta(p) {
    if (p._npc) return p._npc;
    const h = hashStr(p.id || p.seed || p.name || 'x');
    p._npc = {
      yearsLeft: 1 + (h % 4),
      imp: p.ovr >= 78 ? 'key' : p.ovr >= 68 ? 'normal' : 'fringe',
      unsettled: (h % 4 === 0)
    };
    return p._npc;
  }
  function clubAsk(p) {
    const m = ensureNpcMeta(p);
    let ask = (p.value || 0) * (YEARS_F[m.yearsLeft] || 1.9) * (IMP_F[m.imp] || 1);
    if (m.unsettled) ask *= 0.7;
    ask *= (1 + negoState(p).aufschlag);     // jedes abgelehnte Gebot verteuert ihn
    // AUSLÄNDISCHE ABGEBENDE VEREINE verhandeln härter: Sie stehen nicht unter
    // dem Druck der deutschen Ligakonkurrenz, kennen den Spieler besser und
    // wissen, dass ein Wechsel nach Deutschland für ihn ein Schritt ist. Je
    // stärker das Land (Koeffizient 1 = Spitze), desto teurer.
    const ak = p.auslandsklub;
    if (ak) ask *= 1 + Math.max(0, (7 - (ak.coeff || 6))) * 0.055;
    return Math.max(25000, Math.round(ask));
  }
  function sellability(p) {
    const m = ensureNpcMeta(p);
    let s = 0.6 - (m.yearsLeft - 1) * 0.18 - ((IMP_F[m.imp] || 1) - 1) * 0.5 + (m.unsettled ? 0.5 : 0);
    // Starke Auslandsklubs sind weniger verkaufswillig — sie brauchen das Geld
    // nicht und haben Alternativen.
    const ak = p.auslandsklub;
    if (ak) s -= Math.max(0, (7 - (ak.coeff || 6))) * 0.035;
    // JUWEL: Ein Jahrhunderttalent gibt kein Verein freiwillig ab.
    const tp = p.truePotential || p.ovr || 0;
    if (tp >= 85 && (p.age || 25) <= 21) s -= 0.28;
    // EUROPAPOKAL: An einen internationalen Verein gibt man eher ab — der
    // Spieler will hin, und die Bühne wertet den Transfer auf. Wiegt genau den
    // Malus einer Liga mittlerer Stärke auf.
    const eu = (typeof europaStufe === 'function') ? europaStufe() : 0;
    if (eu) s += eu === 3 ? 0.14 : eu === 2 ? 0.09 : 0.05;
    return Math.max(0.05, Math.min(0.98, s));
  }
  window.npcTransferInfo = function (p) { const m = ensureNpcMeta(p); return { ask: clubAsk(p), unsettled: m.unsettled, yearsLeft: m.yearsLeft, imp: m.imp, sellability: sellability(p) }; };

  function perceived(s, p) {
    const base = p.value || 0;
    let v = s.pay > 0 ? s.fee * 0.85 : s.fee;                          // Raten sind weniger wert
    v += (s.sellOnPresets[s.sellOnIdx] / 100) * base * 0.5;           // Weiterverkauf, anteilig
    const b = s.bonusPresets[s.bonusIdx];
    v += (b.promotion || 0) * 0.4 + (b.apps || 0) * 0.6;             // Prämien nach Wahrscheinlichkeit
    return v;
  }
  // Mitte der Kurve für diesen Spieler: verkaufswillige Vereine sagen schon bei
  // niedrigeren Quoten zu, sture erst deutlich über ihrer Forderung.
  function kurvenMitte(p) {
    const sell = sellability(p);
    let mitte = CHANCE.mitte + (0.5 - sell) * CHANCE.bereitschaftF;
    // Ein Wechsel zu einem Europapokal-Teilnehmer ist für den Spieler
    // attraktiver — das macht auch den abgebenden Verein gesprächsbereiter.
    const eu = (typeof europaStufe === 'function') ? europaStufe() : 0;
    if (eu) mitte -= eu === 3 ? 0.10 : eu === 2 ? 0.06 : 0.03;
    // Je unwilliger der Verein, desto weiter muss das Angebot über die
    // Forderung hinaus — bis zum Punkt, an dem es sich schlicht nicht lohnt.
    if (sell < CHANCE.sturAb) mitte += (CHANCE.sturAb - sell) * CHANCE.sturF;
    return mitte;
  }
  // Ablöse, die eine bestimmte Chance abdeckt (für die Gegenforderung).
  function feeFuerChance(s, p, ziel) {
    const quote = kurvenMitte(p) + Math.log(ziel / (1 - ziel)) / CHANCE.steigung;
    const noetig = quote * bezugswert(s, p);
    const ohneAbloese = perceived({ fee: 0, pay: 0, sellOnPresets: s.sellOnPresets,
                                    sellOnIdx: s.sellOnIdx, bonusPresets: s.bonusPresets,
                                    bonusIdx: s.bonusIdx }, p);
    const faktor = s.pay > 0 ? 0.85 : 1;
    return { fee: Math.max(s.fee, rm(Math.max(0, (noetig - ohneAbloese) / faktor))), pv: noetig };
  }
  function clubEvaluate(s, p) {
    const sell = sellability(p);
    const pv = perceived(s, p);
    const bezug = bezugswert(s, p);
    const quote = pv / bezug;
    const chance = 1 / (1 + Math.exp(-CHANCE.steigung * (quote - kurvenMitte(p))));
    return { chance: Math.max(0, Math.min(1, chance)), quote, pv, bezug,
             rivale: negoState(p).rivale,
             stur: sell < CHANCE.sturAb, gesperrt: false };
  }

  function findMarket(id) { return (typeof MARKET !== 'undefined' && MARKET.players) ? MARKET.players.find(p => p.id === id) : null; }

  // ── VERKAUFSSPERRE: keine Sofort-Weiterverkäufe ──────────────────────────
  // Spieler, die in DERSELBEN Saison verpflichtet wurden (Kauf, ablösefrei,
  // Leihe-Kaufoption, Jugend, Scout), können erst ab der nächsten Saison wieder
  // verkauft werden. Verhindert den „ablösefrei kaufen → sofort verkaufen"-Cheat.
  window.canSellPlayer = function (p) {
    if (!p) return false;
    if (typeof LEAGUE === 'undefined' || !LEAGUE) return true;
    return !(p.acquiredSeason != null && p.acquiredSeason === LEAGUE.season);
  };
  function sellBlockMsg(p) {
    const nm = (typeof displayName === 'function') ? displayName(p) : (p && p.name) || 'Dieser Spieler';
    return `${nm} wurde erst in dieser Saison verpflichtet und kann frühestens in der nächsten Saison wieder verkauft werden.`;
  }
  function warnBlocked(p) {
    const msg = sellBlockMsg(p);
    if (typeof showToast === 'function') showToast(msg, 'warn'); else if (typeof alert === 'function') alert(msg);
  }

  window.openClubNegotiation = function (marketId) {
    if (typeof isTransferWindowOpen === 'function' && !isTransferWindowOpen()) { alert('Das Transferfenster ist geschlossen. Käufe sind nur im Sommer (Wochen 1–9) und im Winter (Januar) möglich.'); return; }
    const p = findMarket(marketId); if (!p) return;
    ensureNpcMeta(p);
    const st = negoState(p);
    if (st.geplatzt) {
      alert('Die Gespräche über ' + ((typeof displayName === 'function') ? displayName(p) : p.name) +
            ' sind geplatzt. Der Verein verhandelt in diesem Transferfenster nicht mehr über ihn.');
      return;
    }
    const ask = clubAsk(p), val = p.value || 0;
    window._clubNego = {
      marketId, ask,
      fee: Math.round(ask * 0.85),
      pay: 0,                                                          // 0 = sofort, sonst Jahre
      sellOnIdx: 0, sellOnPresets: [0, 10, 15, 20, 25],
      bonusIdx: 0, bonusPresets: [
        { promotion: 0, apps: 0, label: 'keine' },
        { promotion: rm(val * 0.15), apps: 0, label: `+${euro(rm(val * 0.15))} bei Aufstieg` },
        { promotion: 0, apps: rm(val * 0.12), label: `+${euro(rm(val * 0.12))} nach 30 Spielen` },
        { promotion: rm(val * 0.15), apps: rm(val * 0.12), label: 'Aufstieg + Einsatz' }
      ],
      feeStep: Math.max(25000, rm(ask * 0.05)),
      rounds: st.runden, counterFee: null, counterPv: null, msg: null, done: false
    };
    renderClubNego();
  };
  window.clubNegoAdjust = function (dir) { const s = window._clubNego; if (!s || s.done) return; s.fee = Math.max(0, s.fee + dir * s.feeStep); s.msg = null; renderClubNego(); };
  window.clubNegoCyclePay = function () { const s = window._clubNego; if (!s || s.done) return; s.pay = s.pay === 0 ? 2 : s.pay === 2 ? 3 : 0; s.msg = null; s.counterFee = null; renderClubNego(); };
  window.clubNegoCycleSellOn = function () { const s = window._clubNego; if (!s || s.done) return; s.sellOnIdx = (s.sellOnIdx + 1) % s.sellOnPresets.length; s.msg = null; s.counterFee = null; renderClubNego(); };
  window.clubNegoCycleBonus = function () { const s = window._clubNego; if (!s || s.done) return; s.bonusIdx = (s.bonusIdx + 1) % s.bonusPresets.length; s.msg = null; s.counterFee = null; renderClubNego(); };
  window.clubNegoClose = function () { const ov = document.getElementById('clubnego-overlay'); if (ov) ov.remove(); window._clubNego = null; };
  // Gegenforderung übernehmen: counterPv bleibt stehen, damit der Zuschlag
  // garantiert ist (siehe clubNegoMakeOffer).
  window.clubNegoAcceptCounter = function () { const s = window._clubNego; if (!s || !s.counterFee) return; s.fee = s.counterFee; s.msg = null; window.clubNegoMakeOffer(); };

  window.clubNegoMakeOffer = function () {
    const s = window._clubNego; if (!s || s.done) return;
    const p = findMarket(s.marketId); if (!p) { window.clubNegoClose(); return; }
    const st = negoState(p);
    const ev = clubEvaluate(s, p);

    // Wer die Gegenforderung exakt erfüllt, bekommt den Zuschlag sicher —
    // sonst wäre eine ausgehandelte Zusage nichts wert.
    if (s.counterPv && ev.pv >= s.counterPv) { proceedToPlayer(s, p); return; }

    s.rounds++; st.runden++;
    if (Math.random() < ev.chance) { proceedToPlayer(s, p); return; }

    // Abgelehnt — und der Verein schraubt die Forderung nach oben.
    const frech = ev.quote < CHANCE.frechAb;
    st.aufschlag += frech ? CHANCE.aufschlagFrech : CHANCE.aufschlagRunde;
    const alteForderung = s.ask;
    s.ask = clubAsk(p);
    s.feeStep = Math.max(25000, rm(s.ask * 0.05));

    // Konkurrenz betritt die Bühne
    let neuerRivale = null;
    if (!st.rivale && st.runden >= CHANCE.rivaleAb && Math.random() < CHANCE.rivaleP) {
      const anteil = CHANCE.rivaleMin + Math.random() * (CHANCE.rivaleMax - CHANCE.rivaleMin);
      st.rivale = { klub: fremderKlub(p), gebot: rm(s.ask * anteil) };
      neuerRivale = st.rivale;
      if (typeof addNews === 'function') {
        addNews('transfer', 'Konkurrenz um ' + p.name,
          st.rivale.klub + ' hat für ' + p.name + ' ein Angebot über ' + euro(st.rivale.gebot) +
          ' abgegeben. Wer ihn will, muss jetzt darüber gehen.');
      }
    }

    if (st.runden >= CHANCE.maxRunden) {
      st.geplatzt = true; s.done = true; s.counterFee = null; s.counterPv = null;
      // Wer mitgeboten hat, greift zu: der Spieler verschwindet vom Markt.
      if (st.rivale) {
        s.msg = { type: 'reject', text: '„Wir sind uns mit ' + st.rivale.klub + ' einig." ' +
          p.name + ' wechselt für ' + euro(st.rivale.gebot) + ' dorthin.' };
        try {
          const idx = MARKET.players.indexOf(p);
          if (idx >= 0) MARKET.players.splice(idx, 1);
        } catch (e) {}
        if (typeof addNews === 'function') {
          addNews('transfer', p.name + ' wechselt zu ' + st.rivale.klub,
            'Der Transfer ist perfekt: ' + p.name + ' geht für ' + euro(st.rivale.gebot) +
            ' zu ' + st.rivale.klub + '. Für ' + (typeof clubShort === 'function' ? clubShort() : 'uns') +
            ' hat sich das Thema erledigt.');
        }
        if (typeof renderTransferTab === 'function') { try { renderTransferTab(); } catch (e) {} }
      } else {
        s.msg = { type: 'reject', text: '„Wir beenden die Gespräche." ' +
          'Der Verein verhandelt in diesem Transferfenster nicht mehr über ihn.' };
      }
      renderClubNego(); return;
    }

    const kon = feeFuerChance(s, p, CHANCE.konterZiel);
    s.counterFee = kon.fee; s.counterPv = kon.pv;
    const reaktion = ev.stur
      ? 'Ehrlich gesagt wollen wir ihn behalten. Reden können wir trotzdem — zu unserem Preis.'
      : frech
      ? 'So brauchen wir gar nicht erst anzufangen.'
      : (s.pay > 0 ? 'Bei Ratenzahlung wollen wir mehr — oder eine höhere Weiterverkaufsbeteiligung.'
                   : 'Das reicht uns nicht.');
    s.msg = { type: (frech || neuerRivale) ? 'reject' : 'counter',
      text: (neuerRivale
              ? `Dazwischen ist ${neuerRivale.klub} eingestiegen — Angebot: ${euro(neuerRivale.gebot)}. `
              : '') +
            `„${reaktion}" Die Forderung steigt von ${euro(alteForderung)} auf ${euro(s.ask)}. ` +
            `Sicher wäre: ${euro(kon.fee)} Ablöse.` };
    renderClubNego();
  };

  function proceedToPlayer(s, p) {
    const b = s.bonusPresets[s.bonusIdx];
    const clubDeal = { fee: s.fee, installments: s.pay, sellOnPct: s.sellOnPresets[s.sellOnIdx], bonusPromotion: b.promotion || 0, bonusApps: b.apps || 0 };
    window.clubNegoClose();
    if (typeof window.openNegotiation === 'function') {
      window.openNegotiation(p.id, { player: p, onAccept: function (deal) { return executeBuy(p.id, clubDeal, deal); } });
    }
  }

  // Führt den Transfer aus (nach Einigung mit Verein UND Spieler). Validiert das Budget.
  function executeBuy(marketId, clubDeal, playerDeal) {
    const idx = MARKET.players.findIndex(p => p.id === marketId);
    if (idx === -1) return { ok: false, msg: 'Spieler nicht mehr verfügbar.' };
    const p = MARKET.players[idx];
    const N = clubDeal.installments;
    const upfront = N > 0 ? Math.round(clubDeal.fee / N) : clubDeal.fee;
    const dueNow = upfront + (playerDeal.bonus || 0);
    if ((CLUB.budget || 0) < dueNow) return { ok: false, msg: `Budget reicht nicht: ${euro(dueNow)} jetzt fällig (${N > 0 ? '1. Rate + ' : ''}Handgeld), frei ${euro(CLUB.budget || 0)}.` };
    if ((CLUB.wageBudget || 0) < playerDeal.wage) return { ok: false, msg: `Freies Gehaltsbudget reicht nicht: ${euro(playerDeal.wage)}/Wo nötig, frei ${euro(CLUB.wageBudget || 0)}/Wo.` };

    CLUB.budget -= dueNow;
    CLUB.wageBudget = Math.max(0, (CLUB.wageBudget || 0) - playerDeal.wage);
    if (N > 1) {
      if (!Array.isArray(CLUB._installments)) CLUB._installments = [];
      CLUB._installments.push({ amount: upfront, seasonsLeft: N - 1, club: p.fromClub, playerName: p.name });
    }
    MARKET.players.splice(idx, 1);
    const np = { id: 'sq_' + p.id, name: p.name, firstName: p.firstName, flag: p.flag, country: p.country, joinedSeason: LEAGUE.season, acquiredSeason: LEAGUE.season,
      pos: p.pos, positions: p.positions, age: p.age, ovr: p.ovr, truePotential: p.truePotential, def: p.def, mid: p.mid, att: p.att, pace: p.pace, mental: p.mental,
      gamesPlayed: 0, seed: p.seed, value: p.value, wage: playerDeal.wage, contractUntil: LEAGUE.season + playerDeal.years, squadRole: playerDeal.role,
      birthWeek: p.birthWeek, birthMonth: p.birthMonth, birthDay: p.birthDay };
    if (playerDeal.clause > 0) np.releaseClause = playerDeal.clause;
    if (playerDeal.prem && (playerDeal.prem.perGoal || playerDeal.prem.perApp)) np.contractBonuses = { perGoal: playerDeal.prem.perGoal || 0, perApp: playerDeal.prem.perApp || 0 };
    if (clubDeal.sellOnPct > 0) np.sellOn = { club: p.fromClub, pct: clubDeal.sellOnPct };
    const bonuses = [];
    if (clubDeal.bonusPromotion > 0) bonuses.push({ trigger: 'promotion', amount: clubDeal.bonusPromotion, club: p.fromClub });
    if (clubDeal.bonusApps > 0) bonuses.push({ trigger: 'apps', threshold: 30, amount: clubDeal.bonusApps, club: p.fromClub, paid: false });
    if (bonuses.length) np.transferBonuses = bonuses;
    SQUAD.push(np);
    if (typeof assignBirthday === 'function') assignBirthday(SQUAD[SQUAD.length - 1]);
    if (typeof assignShirtNumbers === 'function') assignShirtNumbers();
    if (!CLUB.transferHistory) CLUB.transferHistory = [];
    CLUB.transferHistory.unshift({ type: 'buy', name: p.name, amount: clubDeal.fee, season: LEAGUE.season });
    try { if (typeof EXP !== 'undefined' && EXP.hookTransfer) EXP.hookTransfer(SQUAD[SQUAD.length - 1], 'buy'); } catch (e) {}
    const parts = [];
    parts.push(`${euro(clubDeal.fee)} Ablöse${N > 0 ? ` (in ${N} Raten)` : ''}`);
    if (clubDeal.sellOnPct > 0) parts.push(`${clubDeal.sellOnPct}% Weiterverkauf`);
    if (bonuses.length) parts.push('Erfolgs-Prämien');
    if (playerDeal.bonus > 0) parts.push(`${euro(playerDeal.bonus)} Handgeld`);
    if (typeof addNews === 'function') addNews('transfer', `✅ Verpflichtet: ${p.name}`, `${(typeof displayName === 'function' ? displayName(p) : p.name)} kommt von ${p.fromClub || '—'}: ${parts.join(', ')}, ${euro(playerDeal.wage)}/Woche bis ${(typeof seasonEndYear === 'function') ? seasonEndYear(LEAGUE.season + playerDeal.years) : (LEAGUE.season + playerDeal.years)}.`);
    if (typeof showToast === 'function') showToast(`${(typeof displayName === 'function' ? displayName(p) : p.name)} verpflichtet — ${euro(clubDeal.fee)} Ablöse`, 'success');
    return { ok: true };
  }

  // Farbe nach Erfolgschance (0..1)
  function satColor(c) { return c >= 0.65 ? 'var(--accent)' : c >= 0.30 ? 'var(--gold)' : 'var(--red)'; }

  function renderClubNego() {
    const s = window._clubNego; if (!s) return;
    const p = findMarket(s.marketId); if (!p) { window.clubNegoClose(); return; }
    const m = ensureNpcMeta(p);
    const st = negoState(p);
    const ev = clubEvaluate(s, p);
    const sicher = !!(s.counterPv && ev.pv >= s.counterPv && !ev.gesperrt);
    const row = (lbl, valHtml, onclick) => `<div class="nego-row"><span class="nego-label">${lbl}</span><button class="nego-pick" onclick="${onclick}">${valHtml} ▾</button></div>`;
    let ov = document.getElementById('clubnego-overlay');
    if (!ov) { ov = document.createElement('div'); ov.id = 'clubnego-overlay'; ov.className = 'exp-overlay'; document.body.appendChild(ov); }
    const impLbl = { key: 'Leistungsträger', normal: 'Stammkraft', fringe: 'Ergänzung' }[m.imp];
    const msgHtml = s.msg ? `<div class="nego-msg nego-${s.msg.type}">💬 ${s.msg.text}</div>` : '';
    const counterBtn = s.counterFee ? `<button class="nego-btn ghost" onclick="clubNegoAcceptCounter()">Gegenforderung übernehmen</button>` : '';
    const actions = s.done
      ? `<button class="nego-btn primary" onclick="clubNegoClose()">Schließen</button>`
      : `<button class="nego-btn ghost" onclick="clubNegoClose()">Abbrechen</button>${counterBtn}<button class="nego-btn primary" onclick="clubNegoMakeOffer()">Angebot abgeben</button>`;
    ov.innerHTML = `<div class="nego-card">
      <div class="nego-head">
        <div><div class="nego-name">${p.flag ? p.flag + ' ' : ''}${(typeof displayName === 'function' ? displayName(p) : p.name)} <span class="nego-step-tag">Dialog 1/2 · Verein</span>${typeof infoBtn === 'function' ? infoBtn('kauf') : ''}</div>
          <div class="nego-sub">${p.age} J · ${(p.positions && p.positions[0]) || p.pos} · OVR ${p.ovr} · von ${p.fromClub || '—'} · Vertrag ${m.yearsLeft} J · ${impLbl}${m.unsettled ? ' · <b style="color:var(--gold)">wechselwillig</b>' : ''}</div></div>
      </div>
      <div class="nego-demand">Forderung des Vereins: <b>${euro(s.ask)}</b>${m.unsettled ? ' · abgabebereit' : ''}${st.aufschlag > 0 ? ` <span style="color:var(--red)">(+${Math.round(st.aufschlag * 100)} % nach ${st.runden} abgelehnten Angeboten)</span>` : ''}</div>
      <div class="nego-ctrls">
        <div class="nego-row"><span class="nego-label">Ablöse</span><span class="nego-stepper"><button class="nego-step-btn" onclick="clubNegoAdjust(-1)">−</button><span class="nego-val">${euro(s.fee)}</span><button class="nego-step-btn" onclick="clubNegoAdjust(1)">+</button></span></div>
        ${row('Zahlungsweise', s.pay === 0 ? 'Sofort' : `Raten · ${s.pay} Jahre`, 'clubNegoCyclePay()')}
        ${row('Weiterverkaufsbeteiligung', s.sellOnPresets[s.sellOnIdx] + ' %', 'clubNegoCycleSellOn()')}
        ${row('Erfolgs-Prämie', s.bonusPresets[s.bonusIdx].label, 'clubNegoCycleBonus()')}
      </div>
      <div class="nego-sat">
        <div class="nego-sat-lbl"><span>Erfolgschance</span><span style="color:${satColor(ev.chance)};font-weight:800">${Math.round(ev.chance * 100)} %</span></div>
        <div class="nego-sat-track"><div class="nego-sat-fill" style="width:${Math.round(ev.chance * 100)}%;background:${satColor(ev.chance)}"></div></div>
        <div style="font-size:10.5px;color:var(--text3);margin-top:5px">
          Dein Angebot entspricht ${Math.round(ev.quote * 100)} % der Forderung${sicher ? ' · Gegenforderung erfüllt: Zusage sicher' : ''}<br>
          ${ev.stur ? '<span style="color:var(--gold,#f2c14e)">Der Verein will ihn eigentlich behalten — nur ein deutlich überhöhtes Angebot bewegt ihn.</span><br>' : ''}
          ${(typeof europaLabel === 'function' && europaLabel()) ? '<span style="color:var(--accent,#3fb950)">' + europaLabel() + ' hilft dir in dieser Verhandlung.</span><br>' : ''}
          ${ev.rivale ? '<span style="color:#f85149">' + esc(ev.rivale.klub) + ' bietet ' + euro(ev.rivale.gebot) + ' — darunter geht nichts mehr.</span><br>' : ''}
          Versuch ${Math.min(st.runden + 1, CHANCE.maxRunden)} von ${CHANCE.maxRunden} — jede Ablehnung erhöht die Forderung.
        </div>
      </div>
      ${msgHtml}
      <div style="font-size:11px;color:var(--text3);margin-top:10px">→ Nach Einigung folgt Dialog 2: Vertrag mit dem Spieler (Gehalt, Einsatzzeit, Kaderrolle).</div>
      <div class="nego-actions">${actions}</div>
    </div>`;
  }

  // ── Einbindung in bestehende Abläufe ───────────────────────────────────────
  // Kauf-Klick öffnet jetzt die Vereins-Verhandlung.
  if (typeof window.buyPlayer === 'function') {
    const _buy = window.buyPlayer;
    window.buyPlayer = function (marketId, years) {
      if (years == null) { window.openClubNegotiation(marketId); return; }
      return _buy.apply(this, arguments);
    };
    try { buyPlayer = window.buyPlayer; } catch (e) {}
  }

  // Verkauf: Weiterverkaufsbeteiligung an den Ex-Verein auszahlen.
  if (typeof window.acceptTransferBid === 'function') {
    const _acc = window.acceptTransferBid;
    window.acceptTransferBid = function (bidId) {
      const bid = (CLUB.transferBids || []).find(b => b.id === bidId);
      const seller = bid ? SQUAD.find(x => x.id === bid.playerId) : null;
      const sellOn = seller && seller.sellOn;
      const r = _acc.apply(this, arguments);
      if (r && sellOn && sellOn.pct > 0) {
        const cut = Math.round(r.amount * sellOn.pct / 100);
        CLUB.budget -= cut;
        if (typeof addNews === 'function') addNews('transfer', 'Weiterverkaufsbeteiligung fällig', `${sellOn.club} erhält ${sellOn.pct}% (${euro(cut)}) aus dem Verkauf von ${r.name}.`);
      }
      return r;
    };
    try { acceptTransferBid = window.acceptTransferBid; } catch (e) {}
  }

  // Saisonstart: Transfer-Raten abbuchen + Erfolgs-Prämien auslösen.
  function processTransferFinances() {
    if (typeof CLUB === 'undefined') return;
    // Raten
    if (Array.isArray(CLUB._installments) && CLUB._installments.length) {
      let sum = 0;
      CLUB._installments.forEach(it => { if (it.seasonsLeft > 0) { CLUB.budget -= it.amount; it.seasonsLeft--; sum += it.amount; } });
      CLUB._installments = CLUB._installments.filter(it => it.seasonsLeft > 0);
      if (sum > 0 && typeof addNews === 'function') addNews('club', 'Transfer-Raten fällig', `${euro(sum)} an Ratenzahlungen für frühere Transfers wurden abgebucht.`);
    }
    // Prämien an Ex-Vereine
    const promoted = CLUB._seasonAchievements && CLUB._seasonAchievements.promotion;
    (typeof SQUAD !== 'undefined' ? SQUAD : []).forEach(p => {
      if (!Array.isArray(p.transferBonuses)) return;
      const apps = (p.matchRatings && Array.isArray(p.matchRatings.list)) ? p.matchRatings.list.length : 0;
      p.transferBonuses.forEach(b => {
        if (b.paid) return;
        let due = false;
        if (b.trigger === 'promotion' && promoted) due = true;
        else if (b.trigger === 'apps' && apps >= (b.threshold || 30)) due = true;
        if (due) {
          CLUB.budget -= b.amount; b.paid = true;
          if (typeof addNews === 'function') addNews('club', 'Transfer-Prämie fällig', `${b.club} erhält ${euro(b.amount)} (${b.trigger === 'promotion' ? 'Aufstiegsprämie' : 'Einsatzprämie'}) für ${(typeof displayName === 'function' ? displayName(p) : p.name)}.`);
        }
      });
      p.transferBonuses = p.transferBonuses.filter(b => !b.paid);
      if (!p.transferBonuses.length) delete p.transferBonuses;
    });
    // Eigene ausgehende Klauseln (aus Verkäufen) — contingente Einnahmen, probabilistisch.
    if (Array.isArray(CLUB._outgoingClauses) && CLUB._outgoingClauses.length) {
      const keep = [];
      CLUB._outgoingClauses.forEach(c => {
        if (c.seasonsLeft <= 0) return;
        c.seasonsLeft--;
        let pay = 0, why = '';
        if (c.type === 'sellOn' && Math.random() < 0.28) { pay = Math.round(c.base * (c.pct / 100) * (1.1 + Math.random() * 0.6)); why = `Weiterverkaufsbeteiligung (${c.pct}%) aus dem Weiterverkauf von ${c.playerName}`; }
        else if (c.type === 'promotion' && Math.random() < 0.30) { pay = c.amount; why = `Aufstiegsprämie für ${c.playerName}`; }
        else if (c.type === 'apps' && Math.random() < 0.55) { pay = c.amount; why = `Einsatzprämie für ${c.playerName}`; }
        if (pay > 0) { CLUB.budget += pay; if (typeof addNews === 'function') addNews('transfer', '💰 Transfer-Einnahme', `${c.club} zahlt dir ${euro(pay)}: ${why}.`); return; }
        if (c.seasonsLeft > 0) keep.push(c);
      });
      CLUB._outgoingClauses = keep;
    }
  }
  if (typeof window.startNewSeason === 'function') {
    const _sns = window.startNewSeason;
    window.startNewSeason = function () {
      const r = _sns.apply(this, arguments);
      try { processTransferFinances(); } catch (e) { console.warn('[BuyNego] transferFinances', e); }
      return r;
    };
    try { startNewSeason = window.startNewSeason; } catch (e) {}
  }

  // ── VERKAUF: eingehende Gebote KONTERN ─────────────────────────────────────
  function bidById(id) { return (CLUB.transferBids || []).find(b => b.id === id); }
  function buyerCeiling(bid) {
    if (bid._ceiling) return bid._ceiling;
    const h = hashStr(bid.id || bid.playerId || 'x');
    bid._ceiling = Math.round(bid.amount * (1.2 + (h % 15) / 100));   // 1,20-1,34× des Eröffnungsgebots
    return bid._ceiling;
  }
  function sellPerceivedCost(s, mv) {
    let c = s.fee;
    c += (s.sellOnPresets[s.sellOnIdx] / 100) * mv * 0.5;
    const b = s.bonusPresets[s.bonusIdx];
    c += (b.promotion || 0) * 0.4 + (b.apps || 0) * 0.6;
    return c;
  }
  function sellEvaluate(s, bid, mv) {
    const C = buyerCeiling(bid), cost = sellPerceivedCost(s, mv);
    const sat = Math.max(0, Math.min(150, Math.round(C / cost * 100)));
    let verdict, reaction;
    if (sat >= 100) { verdict = 'accept'; reaction = 'Einverstanden — der Spieler wechselt zu uns.'; }
    else if (sat >= 88) { verdict = 'counter'; reaction = (s.sellOnPresets[s.sellOnIdx] > 0 || s.bonusIdx > 0) ? 'Mit euren Klauseln nicht mehr — so viel zahlen wir bar.' : 'Etwas weniger, dann sind wir dabei.'; }
    else { verdict = 'reject'; reaction = 'Das ist uns zu teuer für ihn.'; }
    const b = s.bonusPresets[s.bonusIdx];
    const clauseCost = (s.sellOnPresets[s.sellOnIdx] / 100) * mv * 0.5 + (b.promotion || 0) * 0.4 + (b.apps || 0) * 0.6;
    return { sat, verdict, reaction, counterFee: Math.max(0, Math.round(C - clauseCost)) };
  }

  window.openSellNegotiation = function (bidId) {
    const bid = bidById(bidId); if (!bid) return;
    const p = (typeof getPlayer === 'function') ? getPlayer(bid.playerId) : null;
    if (!p) { alert('Spieler nicht mehr im Kader.'); return; }
    if (!window.canSellPlayer(p)) { warnBlocked(p); return; }
    const mv = (typeof computeMarketValue === 'function') ? computeMarketValue(p) : (p.value || 0);
    window._sellNego = {
      bidId, playerId: p.id, mv, club: bid.club,
      fee: bid.amount,
      sellOnIdx: 0, sellOnPresets: [0, 10, 15, 20, 25],
      bonusIdx: 0, bonusPresets: [
        { promotion: 0, apps: 0, label: 'keine' },
        { promotion: rm(mv * 0.15), apps: 0, label: `+${euro(rm(mv * 0.15))} bei ihrem Aufstieg` },
        { promotion: 0, apps: rm(mv * 0.12), label: `+${euro(rm(mv * 0.12))} nach 30 Spielen` },
        { promotion: rm(mv * 0.15), apps: rm(mv * 0.12), label: 'Aufstieg + Einsatz' }
      ],
      feeStep: Math.max(25000, rm(bid.amount * 0.05)),
      rounds: 0, counterFee: null, msg: null, done: false
    };
    renderSellNego();
  };
  window.sellNegoAdjust = function (dir) { const s = window._sellNego; if (!s || s.done) return; s.fee = Math.max(0, s.fee + dir * s.feeStep); s.msg = null; s.counterFee = null; renderSellNego(); };
  window.sellNegoCycleSellOn = function () { const s = window._sellNego; if (!s || s.done) return; s.sellOnIdx = (s.sellOnIdx + 1) % s.sellOnPresets.length; s.msg = null; s.counterFee = null; renderSellNego(); };
  window.sellNegoCycleBonus = function () { const s = window._sellNego; if (!s || s.done) return; s.bonusIdx = (s.bonusIdx + 1) % s.bonusPresets.length; s.msg = null; s.counterFee = null; renderSellNego(); };
  window.sellNegoClose = function () { const ov = document.getElementById('sellnego-overlay'); if (ov) ov.remove(); window._sellNego = null; };
  window.sellNegoAcceptCounter = function () { const s = window._sellNego; if (!s || !s.counterFee) return; s.fee = s.counterFee; s.counterFee = null; s.msg = null; window.sellNegoMakeOffer(); };

  window.sellNegoMakeOffer = function () {
    const s = window._sellNego; if (!s || s.done) return;
    const bid = bidById(s.bidId), p = (typeof getPlayer === 'function') ? getPlayer(s.playerId) : null;
    if (!bid || !p) { window.sellNegoClose(); return; }
    const ev = sellEvaluate(s, bid, s.mv);
    if (ev.verdict === 'accept') { executeSale(s, p); return; }
    s.rounds++;
    if (ev.verdict === 'counter') { s.counterFee = ev.counterFee; s.msg = { type: 'counter', text: `„${ev.reaction}" Angebot: ${euro(ev.counterFee)}.` }; }
    else {
      s.counterFee = null; s.msg = { type: 'reject', text: `„${ev.reaction}"` };
      if (s.rounds >= 3) {
        if (typeof declineTransferBid === 'function') declineTransferBid(s.bidId);
        if (typeof addNews === 'function') addNews('transfer', `Gebot zurückgezogen: ${p.name}`, `${s.club} war dein Gegenangebot zu teuer — das Interesse an ${displayName(p)} ist erloschen.`);
        s.done = true; s.msg = { type: 'reject', text: 'Der Käufer zieht sein Gebot zurück.' };
      }
    }
    renderSellNego();
  };

  function executeSale(s, p) {
    const bid = bidById(s.bidId); if (!bid) return;
    const deal = { fee: s.fee, sellOnPct: s.sellOnPresets[s.sellOnIdx], bonusPromotion: s.bonusPresets[s.bonusIdx].promotion || 0, bonusApps: s.bonusPresets[s.bonusIdx].apps || 0 };
    const club = s.club;
    bid.amount = deal.fee;
    const r = (typeof acceptTransferBid === 'function') ? acceptTransferBid(s.bidId) : null;  // Verkauf zum Preis, zahlt evtl. geschuldete Weiterverkaufsbeteiligung
    window.sellNegoClose();
    if (!r) return;
    if (deal.sellOnPct > 0 || deal.bonusPromotion > 0 || deal.bonusApps > 0) {
      if (!Array.isArray(CLUB._outgoingClauses)) CLUB._outgoingClauses = [];
      if (deal.sellOnPct > 0) CLUB._outgoingClauses.push({ type: 'sellOn', pct: deal.sellOnPct, base: deal.fee, club, playerName: r.name, seasonsLeft: 3 });
      if (deal.bonusPromotion > 0) CLUB._outgoingClauses.push({ type: 'promotion', amount: deal.bonusPromotion, club, playerName: r.name, seasonsLeft: 2 });
      if (deal.bonusApps > 0) CLUB._outgoingClauses.push({ type: 'apps', amount: deal.bonusApps, club, playerName: r.name, seasonsLeft: 1 });
    }
    const extra = [];
    if (deal.sellOnPct > 0) extra.push(`${deal.sellOnPct}% Weiterverkauf`);
    if (deal.bonusPromotion || deal.bonusApps) extra.push('Erfolgs-Prämien');
    if (typeof addNews === 'function') addNews('transfer', `✅ Verkauft: ${r.name}`, `${displayName(p)} wechselt für ${euro(deal.fee)} zu ${club}${extra.length ? ' (' + extra.join(', ') + ')' : ''}.`);
    if (typeof showToast === 'function') showToast(`${displayName(p)} verkauft — ${euro(deal.fee)} an ${club}`, 'money');
    if (typeof renderAll === 'function') renderAll();
    if (typeof renderTransferTab === 'function') renderTransferTab();
    if (typeof renderHomeTab === 'function') renderHomeTab();
    if (typeof saveGameState === 'function') saveGameState();
  }

  function renderSellNego() {
    const s = window._sellNego; if (!s) return;
    const bid = bidById(s.bidId), p = (typeof getPlayer === 'function') ? getPlayer(s.playerId) : null;
    if (!bid || !p) { window.sellNegoClose(); return; }
    const ev = sellEvaluate(s, bid, s.mv);
    const row = (lbl, valHtml, onclick) => `<div class="nego-row"><span class="nego-label">${lbl}</span><button class="nego-pick" onclick="${onclick}">${valHtml} ▾</button></div>`;
    let ov = document.getElementById('sellnego-overlay');
    if (!ov) { ov = document.createElement('div'); ov.id = 'sellnego-overlay'; ov.className = 'exp-overlay'; document.body.appendChild(ov); }
    const msgHtml = s.msg ? `<div class="nego-msg nego-${s.msg.type}">💬 ${s.msg.text}</div>` : '';
    const counterBtn = s.counterFee ? `<button class="nego-btn ghost" onclick="sellNegoAcceptCounter()">Käufer-Angebot annehmen</button>` : '';
    const actions = s.done
      ? `<button class="nego-btn primary" onclick="sellNegoClose()">Schließen</button>`
      : `<button class="nego-btn ghost" onclick="sellNegoClose()">Abbrechen</button>${counterBtn}<button class="nego-btn primary" onclick="sellNegoMakeOffer()">Fordern</button>`;
    ov.innerHTML = `<div class="nego-card">
      <div class="nego-head"><div><div class="nego-name">${p.flag ? p.flag + ' ' : ''}${displayName(p)} <span class="nego-step-tag">Verkauf · ${s.club}</span>${typeof infoBtn === 'function' ? infoBtn('verkauf') : ''}</div>
        <div class="nego-sub">${p.age} J · ${(p.positions && p.positions[0]) || p.pos} · OVR ${p.ovr} · Marktwert ${euro(s.mv)} · Gebot ${euro(bid.amount)}</div></div></div>
      <div class="nego-demand">${s.club} bietet aktuell <b>${euro(bid.amount)}</b> für ${displayName(p)}.</div>
      <div class="nego-ctrls">
        <div class="nego-row"><span class="nego-label">Geforderte Ablöse</span><span class="nego-stepper"><button class="nego-step-btn" onclick="sellNegoAdjust(-1)">−</button><span class="nego-val">${euro(s.fee)}</span><button class="nego-step-btn" onclick="sellNegoAdjust(1)">+</button></span></div>
        ${row('Weiterverkaufsbeteiligung (für dich)', s.sellOnPresets[s.sellOnIdx] + ' %', 'sellNegoCycleSellOn()')}
        ${row('Erfolgs-Prämie (zahlt der Käufer)', s.bonusPresets[s.bonusIdx].label, 'sellNegoCycleBonus()')}
      </div>
      <div class="nego-sat"><div class="nego-sat-lbl"><span>Bereitschaft des Käufers</span><span style="color:${satColor(ev.sat)};font-weight:800">${Math.min(100, ev.sat)}%</span></div>
        <div class="nego-sat-track"><div class="nego-sat-fill" style="width:${Math.min(100, ev.sat)}%;background:${satColor(ev.sat)}"></div></div></div>
      ${msgHtml}
      <div class="nego-actions">${actions}</div>
    </div>`;
  }

  // ── Restliche Verkaufspfade absichern (aktives Anbieten + direktes Annehmen) ──
  const _ofs = window.offerPlayerForSale;
  if (typeof _ofs === 'function') {
    window.offerPlayerForSale = function (playerId) {
      const p = (typeof getPlayer === 'function') ? getPlayer(playerId)
              : (typeof SQUAD !== 'undefined' ? SQUAD.find(x => x.id === playerId) : null);
      if (p && !window.canSellPlayer(p)) { warnBlocked(p); return null; }
      return _ofs.apply(this, arguments);
    };
  }
  const _acc = window.acceptTransferBid;
  if (typeof _acc === 'function') {
    window.acceptTransferBid = function (bidId) {
      const bid = (typeof CLUB !== 'undefined' && CLUB && CLUB.transferBids) ? CLUB.transferBids.find(b => b.id === bidId) : null;
      const p = bid ? ((typeof getPlayer === 'function') ? getPlayer(bid.playerId)
              : (typeof SQUAD !== 'undefined' ? SQUAD.find(x => x.id === bid.playerId) : null)) : null;
      if (p && !window.canSellPlayer(p)) { warnBlocked(p); return null; }
      return _acc.apply(this, arguments);
    };
    try { acceptTransferBid = window.acceptTransferBid; } catch (e) {}
  }

  // Kickstil: Kauf nach Einigung (Vereins-Deal + Spieler-Deal) auch für den Deadline-Day (kickstil_deadline_day.js)
  window.ksKaufAusfuehren = executeBuy;
  console.log('[BuyNego v1] aktiv — Kauf- & Verkaufsverhandlung (Verein + Spieler), Raten/Weiterverkauf/Prämien, wechselwillige NPCs, Verkaufssperre Saison-Neuzugänge');
})();