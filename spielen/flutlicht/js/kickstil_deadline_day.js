/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · DEADLINE-DAY  ·  v1   (Nutzer 2026-10-15: „wie den Draft gestalten“ – Vorbild Kickdraft-Draft-Tag,
   dfl_kader_patch.js: Uhr-Ring, Top-5-Board, Anruf-Fenster mit eigener Uhr, Ticker, Noten in der Zeitung)
   ─────────────────────────────────────────────────────────────────────────
   Die letzte Woche eines Transferfensters (KW 9 Sommer / KW 30 Winter) wird zum Live-Tag von 09:00 bis 18:00 Uhr:
     · Uhr wie beim Draft (Ring grün → gelb → rot), Schritte à 15 Min.: „+15 Min.“, „Bis zum nächsten Anruf“, „Bis 18:00“,
       Live-Modus (▶) mit 15 Min. je 1,4 s; hält immer bei Anrufen und Zusagen
     · Anrufe = Gebote auf deine Spieler (maybeGenerateTransferBid, also mit Finanzkraft-Deckel und echten Bietern) mit
       PANIK-AUFSCHLAG +10 % (09:00) bis +40 % (18:00) auf das Grundgebot; eigene 20-s-Uhr, Annehmen / einmal Nachbessern
       (50 %: +5–12 %) / Ablehnen – legen bei 0 auf. Höchstens 3 Anrufe am Tag.
     · Last-Minute-Markt Top 5: Note = Preis-Leistung gegen deinen Kaderschnitt; Preis mit DEADLINE-RABATT 8 % (abgebende
       Vereine wollen Gehalt loswerden). „Anfrage stellen“ → Antwort nach 30–60 Spielminuten (Zusage ~75 %, Leistungsträger
       35 %, wechselwillig 90 %). Zusage → Vertragsdialog mit dem Spieler (contracts_patch), Kauf über executeBuy.
       Anfragen ab 17:30 Uhr: 25 % „Unterlagen zu spät“ – geplatzt.
     · Ticker: KI-Wechsel (Spieler verschwinden wirklich vom Markt), Gerüchte, geplatzte Deals
     · 18:00: Bilanz (Zugänge, Abgänge, Saldo) + Note vom Flutlicht-Kurier als Meldung
   Zahlen am 2026-10-15 vom Nutzer freigegeben („super gute Ideen“). Zustand: CLUB.ksDeadline (nur die laufende Woche).
   Wer die Woche ohne Studio weiterschaltet, verpasst den Tag: offene Zusagen verfallen, Anrufe kommen nicht.
   Lädt nach kickstil_simulieren.js und buy_negotiation_patch.js (window.ksKaufAusfuehren), vor init_bootstrap.js.
   API: KSDeadline.offen() · .oeffnen() · .zustand() · .schritt(n)
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const CFG = { start: 540, ende: 1080, takt: 15, rabatt: 0.08, panikMin: 0.10, panikMax: 0.40, grundDeadline: 0.15,
    spaetAb: 1050, spaetRisiko: 0.25, antwort: [30, 60], anrufUhr: 20, maxAnrufe: 3, live: 1400 };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ti = n => `<i class="ti ti-${n}" aria-hidden="true"></i>`;
  const euro = v => (typeof formatEuro === 'function' ? formatEuro(Math.round(v)) : Math.round(v) + ' €');
  const rund = v => (typeof roundMarketValue === 'function' ? roundMarketValue(v) : Math.round(v / 10000) * 10000);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const uhrText = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  const name = p => !p ? '' : (p.firstName ? p.firstName.charAt(0) + '. ' : '') + (p.name || '');
  const aktiv = () => typeof CLUB !== 'undefined' && CLUB && typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.tiers;
  const fenster = () => (typeof transferWindowInfo === 'function' ? transferWindowInfo(LEAGUE.week) : { open: false });
  const istDeadline = () => aktiv() && fenster().open && fenster().deadline;
  const kader = () => (typeof SQUAD !== 'undefined' && Array.isArray(SQUAD) ? SQUAD : []);
  const markt = () => (typeof MARKET !== 'undefined' && MARKET && Array.isArray(MARKET.players) ? MARKET.players : []);
  const schnittVon = () => { const k = kader().filter(p => !p.onLoanAt); return k.length ? Math.round(k.reduce((s, p) => s + (p.ovr || 0), 0) / k.length) : 55; };
  const wappen = (clubName, kl) => `<span class="lg-crest ${kl || 'dl-wappen'}" style="${typeof crestStyle === 'function' && window.KSVerein ? esc(crestStyle(KSVerein.idNachName(clubName))) : ''}" aria-hidden="true"></span>`;
  const gesicht = (p, vid) => (window.KSVerein ? `<span class="dfl-portrait klein">${KSVerein.gesicht(p, vid)}</span>` : '');
  const speichern = () => { try { if (typeof saveGameState === 'function') saveGameState(); } catch (e) { /* später */ } };

  // ── Zustand ──────────────────────────────────────────────────────────────
  function zustand(anlegen) {
    if (!aktiv()) return null;
    let z = CLUB.ksDeadline;
    if (!z || z.s !== LEAGUE.season || z.w !== LEAGUE.week) {
      if (!anlegen || !istDeadline()) return null;
      z = CLUB.ksDeadline = { s: LEAGUE.season, w: LEAGUE.week, typ: fenster().type || 'Sommer', min: CFG.start, ticker: [], anfragen: [],
        anrufe: 0, anruf: null, zu: [], ab: [], fertig: false, schnitt: schnittVon(), budget0: CLUB.budget || 0, offenKarte: null, note: null };
    }
    return z;
  }
  const offen = () => istDeadline() && !(zustand() && zustand().fertig);
  const fortschritt = z => Math.max(0, Math.min(1, (z.min - CFG.start) / (CFG.ende - CFG.start)));
  function tick(z, art, text, extra) {
    z.ticker.unshift(Object.assign({ t: z.min, art, text }, extra || {}));
    if (z.ticker.length > 40) z.ticker.length = 40;
  }

  // ── Last-Minute-Markt ───────────────────────────────────────────────────
  const preisVon = p => { const v = (p.value || 0) * (1 - CFG.rabatt); return v >= 100000 ? Math.round(v / 10000) * 10000 : Math.round(v / 1000) * 1000; };
  // Note = Preis-Leistung: Stärke über deinem Schnitt gegen Ablöse (je 250k ein Punkt Abzug), Alter über 31 kostet
  const noteVon = (p, schnitt) => { const d = (p.ovr - schnitt) - (p.value || 0) / 250000 - Math.max(0, p.age - 31) * 1.5;
    return d >= 10 ? 'A' : d >= 7 ? 'B+' : d >= 4 ? 'B' : 'C'; };
  const NK = n => /^A/.test(n) ? 'a' : /^B/.test(n) ? 'b' : 'c';
  function top5(z) {
    const budget = CLUB.budget || 0, s = z.schnitt;
    return markt().filter(p => preisVon(p) <= budget && p.ovr >= s - 2 && !p.onLoanFrom)
      .map(p => ({ p, w: (p.ovr - s) * 3 - (p.value || 0) / 400000 + (p.age <= 23 ? 2 : 0) }))
      .sort((a, b) => b.w - a.w).slice(0, 5).map(x => x.p);
  }
  function baustellen() {
    const zahl = list => kader().filter(p => !(p.injuryWeeks > 0) && !p.onLoanAt && (p.positions || [p.pos]).some(x => list.indexOf(x) >= 0)).length;
    return [['TW', ['TW'], 2], ['IV', ['IV'], 3], ['AV', ['AV', 'LV', 'RV'], 2], ['Mittelfeld', ['ZDM', 'ZM', 'OM', 'DM', 'ZOM'], 4], ['Flügel', ['FL', 'LF', 'RF', 'LA', 'RA', 'LM', 'RM', 'AM'], 2], ['ST', ['ST', 'MS'], 2]]
      .map(([n, l, soll]) => ({ n, ist: zahl(l), soll })).filter(x => x.ist < x.soll);
  }

  // ── KI-Geschehen für den Ticker ─────────────────────────────────────────
  function teamsDerStufe(stufen) {
    try { return allGroups(LEAGUE).filter(g => stufen.indexOf(g.tierKey) >= 0).reduce((a, g) => a.concat(g.group.teams), []).filter(t => t.id !== 'fcm'); }
    catch (e) { return []; }
  }
  function kaeuferFuer(p) {
    const w = p.value || 0;
    const stufen = w >= 2500000 ? ['bundesliga'] : w >= 700000 ? ['bundesliga', 'bundesliga2'] : w >= 200000 ? ['bundesliga2', 'liga3'] : ['liga3', 'regionalliga'];
    const kand = teamsDerStufe(stufen).filter(t => t.name !== p.fromClub);
    return kand.length ? kand[Math.floor(Math.random() * kand.length)].name : 'ein Auslandsklub';
  }
  function kiEreignis(z) {
    if (Math.random() > 0.5) return;
    const r = Math.random(), gebunden = new Set(z.anfragen.filter(a => a.status === 'offen' || a.status === 'zusage').map(a => a.pid));
    const frei = markt().filter(p => !gebunden.has(p.id));
    if (!frei.length) return;
    if (r < 0.55) {
      // Ein Viertel der Wechsel trifft dein Board – Spieler sind wirklich weg
      const board = top5(z).filter(p => !gebunden.has(p.id));
      const p = (Math.random() < 0.25 && board.length) ? board[Math.floor(Math.random() * board.length)] : frei[Math.floor(Math.random() * frei.length)];
      const club = kaeuferFuer(p), fee = rund((p.value || 0) * rnd(0.9, 1.3));
      const i = markt().indexOf(p); if (i >= 0) markt().splice(i, 1);
      const warBoard = board.indexOf(p) >= 0;
      tick(z, 'fix', `${club} holt ${name(p)} (${p.pos}) für ${euro(fee)}`, { club, boardWeg: warBoard });
      if (warBoard) z.ereignis = 'weg';
    } else if (r < 0.85) {
      if (Math.random() < 0.35 && kader().length) {
        const e = kader()[Math.floor(Math.random() * kader().length)], club = kaeuferFuer(e);
        tick(z, 'geruecht', `Gerücht: ${club} beobachtet ${name(e)} (dein Spieler)`, { club });
      } else {
        const p = frei[Math.floor(Math.random() * frei.length)], club = kaeuferFuer(p);
        tick(z, 'geruecht', `Gerücht: ${club} bietet für ${name(p)} – ${z.min >= 960 ? 'Medizincheck läuft' : 'Gespräche laufen'}`, { club });
      }
    } else {
      const p = frei[Math.floor(Math.random() * frei.length)], club = kaeuferFuer(p);
      tick(z, 'geplatzt', `Geplatzt! ${club} und ${name(p)} – ${z.min >= 1020 ? 'Unterlagen zu spät' : 'Medizincheck nicht bestanden'}`, { club });
    }
  }

  // ── Anrufe: Gebote auf deine Spieler mit Panik-Aufschlag ────────────────
  function gebotErzeugen() {
    if (typeof window.maybeGenerateTransferBid !== 'function') return null;
    const alt = CLUB.transferBids || [];
    let bid = null;
    CLUB.transferBids = [];                           // Höchstzahl offener Gebote gilt für Anrufe nicht
    try { for (let i = 0; i < 4 && !bid; i++) bid = window.maybeGenerateTransferBid(); }
    catch (e) { console.warn('[Kickstil-Deadline] Gebot', e); }
    finally { CLUB.transferBids = alt; }
    if (!bid || alt.some(b => b.playerId === bid.playerId)) return null;
    return bid;
  }
  function anrufWuerfeln(z) {
    if (z.anruf || z.anrufe >= CFG.maxAnrufe) return;
    const f = fortschritt(z);
    if (Math.random() > 0.05 + 0.12 * f) return;
    const bid = gebotErzeugen(); if (!bid) return;
    const p = kader().find(x => x.id === bid.playerId); if (!p) return;
    // maybeGenerateTransferBid rechnet am Deadline-Day schon +10–20 % ein → Grundgebot ohne diesen Zuschlag, darauf die Panik
    const grund = bid.amount / (1 + CFG.grundDeadline);
    const panik = Math.min(CFG.panikMax, Math.max(CFG.panikMin, CFG.panikMin + (CFG.panikMax - CFG.panikMin) * f + rnd(-0.03, 0.03)));
    // fein runden: roundMarketValue springt in groben Stufen (Test: aus +28 % wurden +50 %) – der freigegebene Rahmen ist 10–40 %
    const fein = v => (v >= 1000000 ? Math.round(v / 10000) * 10000 : v >= 100000 ? Math.round(v / 1000) * 1000 : Math.round(v / 500) * 500);
    bid.grund = fein(grund); bid.amount = fein(grund * (1 + panik)); bid.isDeadline = true;
    bid.panik = Math.max(0, Math.round((bid.amount / Math.max(1, bid.grund) - 1) * 100));   // nach dem Runden – Anzeige passt zum Betrag
    z.anrufe++;
    z.anruf = { bid, rest: CFG.anrufUhr, nachgebessert: false, notiz: '', um: z.min };
    tick(z, 'anruf', `Anruf: ${bid.club} will ${name(p)}`, { club: bid.club });
  }
  function anrufAktion(art) {
    const z = zustand(); if (!z || !z.anruf) return;
    const a = z.anruf, b = a.bid, p = kader().find(x => x.id === b.playerId);
    if (art === 'mehr') {
      if (a.nachgebessert) return;
      a.nachgebessert = true;
      if (Math.random() < 0.5) { const plus = rnd(0.05, 0.12); b.amount = Math.round(b.amount * (1 + plus) / 10000) * 10000 || Math.round(b.amount * (1 + plus)); a.notiz = `Nachgebessert: +${Math.round(plus * 100)} % – jetzt ${euro(b.amount)}. Mehr gibt es nicht.`; }
      else a.notiz = 'Das ist ihr letztes Angebot.';
      zeichne(); return;
    }
    anrufUhrStop();
    z.anruf = null;
    if (art === 'an' && p) {
      const mw = typeof computeMarketValue === 'function' ? computeMarketValue(p) : (p.value || 0);
      const daten = { name: name(p), pos: p.pos, age: p.age, ovr: p.ovr, club: b.club, amount: b.amount, mw, pid: p.id, spieler: Object.assign({}, p) };
      CLUB.transferBids = (CLUB.transferBids || []).concat([b]);
      try { if (typeof onAcceptBid === 'function') onAcceptBid(b.id); else if (typeof acceptTransferBid === 'function') acceptTransferBid(b.id); }
      catch (e) { console.warn('[Kickstil-Deadline] Verkauf', e); }
      if (!kader().some(x => x.id === p.id)) { z.ab.push(daten); tick(z, 'fix', `Verkauft: ${name(p)} für ${euro(b.amount)} an ${b.club}`, { club: b.club, eigen: true }); }
      else { CLUB.transferBids = (CLUB.transferBids || []).filter(x => x.id !== b.id); tick(z, 'geplatzt', `Verkauf von ${name(p)} kam nicht zustande`, { eigen: true }); }
    } else if (art === 'zeit') tick(z, 'geplatzt', `${b.club} legt auf – keine Antwort`, { club: b.club, eigen: true });
    else tick(z, 'info', `Abgelehnt: ${b.club} für ${p ? name(p) : b.playerName} (${euro(b.amount)})`, { club: b.club, eigen: true });
    speichern(); zeichne();
  }
  let aUhr = 0;
  function anrufUhrStop() { if (aUhr) { clearInterval(aUhr); aUhr = 0; } }
  function anrufUhrStart() {
    if (aUhr) return;
    aUhr = setInterval(() => {
      const z = zustand(), ov = document.getElementById('ks-dl');
      if (!z || !z.anruf || !ov) { anrufUhrStop(); return; }
      if (document.visibilityState === 'hidden') return;
      z.anruf.rest--;
      if (z.anruf.rest <= 0) { anrufAktion('zeit'); return; }
      const el = ov.querySelector('.dl-anruf-uhr'); if (el) el.outerHTML = anrufUhrHtml(z.anruf);
    }, 1000);
  }

  // ── Eigene Anfragen ─────────────────────────────────────────────────────
  function anfrageStellen(pid) {
    const z = zustand(); if (!z || z.fertig) return;
    const p = markt().find(x => x.id === pid); if (!p) return;
    if (z.anfragen.some(a => a.pid === pid && (a.status === 'offen' || a.status === 'zusage'))) return;
    const preis = preisVon(p);
    if (preis > (CLUB.budget || 0)) { if (typeof showToast === 'function') showToast(`Budget reicht nicht: ${euro(preis)} nötig`, 'warn'); return; }
    const um = Math.min(CFG.ende, z.min + Math.round(rnd(CFG.antwort[0], CFG.antwort[1]) / CFG.takt) * CFG.takt);
    z.anfragen.push({ pid, name: name(p), pos: p.pos, club: p.fromClub || 'Verein', preis, gesendet: z.min, um, status: 'offen' });
    tick(z, 'info', `Deine Anfrage: ${name(p)} bei ${p.fromClub || 'seinem Verein'} für ${euro(preis)} – Antwort gegen ${uhrText(um)}`, { club: p.fromClub, eigen: true });
    z.offenKarte = null;
    speichern(); zeichne();
  }
  function antworten(z) {
    z.anfragen.filter(a => a.status === 'offen' && a.um <= z.min).forEach(a => {
      const p = markt().find(x => x.id === a.pid);
      if (!p) { a.status = 'weg'; tick(z, 'geplatzt', `${a.name} ist weg – ein anderer Verein war schneller`, { eigen: true }); z.ereignis = 'antwort'; return; }
      const m = p._npc || {};
      const chance = m.unsettled ? 0.9 : m.imp === 'key' ? 0.35 : 0.75;
      if (Math.random() < chance) {
        if (a.gesendet >= CFG.spaetAb && Math.random() < CFG.spaetRisiko) {
          a.status = 'zuspaet'; tick(z, 'geplatzt', `Geplatzt! ${a.club} sagt zu, aber die Unterlagen für ${a.name} kommen zu spät`, { club: a.club, eigen: true });
        } else { a.status = 'zusage'; tick(z, 'zusage', `${a.club} sagt zu: ${a.name} für ${euro(a.preis)} – jetzt den Vertrag mit ihm machen`, { club: a.club, eigen: true }); }
      } else { a.status = 'absage'; tick(z, 'geplatzt', `${a.club} sagt ab: ${a.name} bleibt`, { club: a.club, eigen: true }); }
      z.ereignis = 'antwort';
    });
  }
  function vertragMachen(pid) {
    const z = zustand(); if (!z) return;
    const a = z.anfragen.find(x => x.pid === pid && x.status === 'zusage'), p = markt().find(x => x.id === pid);
    if (!a || !p) return;
    if (typeof window.openNegotiation !== 'function' || typeof window.ksKaufAusfuehren !== 'function') return;
    const clubDeal = { fee: a.preis, installments: 0, sellOnPct: 0, bonusPromotion: 0, bonusApps: 0 };
    const kopie = Object.assign({}, p);
    window.openNegotiation(p.id, { player: p, onAccept: deal => {
      const r = window.ksKaufAusfuehren(p.id, clubDeal, deal);
      if (r && r.ok) {
        a.status = 'fix';
        z.zu.push({ name: name(kopie), pos: kopie.pos, age: kopie.age, ovr: kopie.ovr, club: a.club, amount: a.preis, spieler: kopie });
        tick(z, 'fix', `Neuzugang: ${name(kopie)} kommt für ${euro(a.preis)} von ${a.club}`, { club: a.club, eigen: true });
        speichern(); setTimeout(zeichne, 50);
      }
      return r;
    } });
  }

  // ── Zeit ─────────────────────────────────────────────────────────────────
  function schrittEins(z) {
    if (z.fertig || z.anruf) return false;
    z.min += CFG.takt; z.ereignis = null;
    kiEreignis(z);
    antworten(z);
    anrufWuerfeln(z);
    if (z.min >= CFG.ende) abschliessen(z);
    return true;
  }
  // modus: 'eins' · 'anruf' (hält bei allem, was dich betrifft) · 'ende' (hält bei Anrufen und Zusagen)
  function schritt(modus) {
    const z = zustand(); if (!z || z.fertig) return;
    for (let i = 0; i < 40; i++) {
      if (!schrittEins(z)) break;
      if (modus === 'eins' || z.fertig || z.anruf) break;
      if (z.anfragen.some(a => a.status === 'zusage')) break;
      if (modus === 'anruf' && z.ereignis) break;
    }
    if (z.min % 60 === 0 || z.fertig) speichern();
    zeichne();
  }
  let live = 0;
  function liveUmschalten(an) {
    if (live) { clearInterval(live); live = 0; }
    if (!an) { zeichne(); return; }
    live = setInterval(() => {
      const z = zustand();
      if (!z || z.fertig || z.anruf || !document.getElementById('ks-dl') || z.anfragen.some(a => a.status === 'zusage')) { liveUmschalten(false); return; }
      schrittEins(z);
      if (z.ereignis === 'antwort' || z.ereignis === 'weg' || z.anruf || z.fertig) { liveUmschalten(false); return; }
      zeichne();
    }, CFG.live);
    zeichne();
  }

  // ── Abschluss mit Note ──────────────────────────────────────────────────
  function noteBerechnen(z) {
    let s = 0;
    z.ab.forEach(x => { s += Math.max(-1, Math.min(2, ((x.amount / Math.max(1, x.mw)) - 1) * 4)); });
    z.zu.forEach(x => { s += Math.max(-1, Math.min(2, (x.ovr - z.schnitt) / 4)) + (x.amount < (x.spieler.value || 0) ? 0.5 : 0); });
    const offenB = baustellen().length;
    if (!z.ab.length && !z.zu.length) return { note: 'C', text: offenB ? `Ein ruhiger Tag – dabei gäbe es Baustellen (${baustellen().map(b => b.n).join(', ')}).` : 'Ein ruhiger Tag. Der Kader bleibt, wie er ist – kann man machen.' };
    s -= offenB * 0.4;
    const note = s >= 3 ? 'A' : s >= 2.2 ? 'A-' : s >= 1.6 ? 'B+' : s >= 0.9 ? 'B' : s >= 0.2 ? 'C+' : s >= -0.5 ? 'C' : 'D';
    // Vereinsname ohne Rechtsform („1. FC Lokomotive Leipzig“ → „Lokomotive Leipzig“); CLUB.shortName ist oft nur ein Kürzel („LL“)
    const kurz = String(CLUB.name || 'Der Verein').split(' ').filter(w => !/^(\d+\.?|FC|SV|SC|VfL|VfB|TSG|TSV|FSV|SpVgg|SG|BV|RB|SSV|KFC|MSV|BSG|VSG)$/i.test(w)).join(' ') || CLUB.name;
    const texte = { A: `Meisterstück am letzten Tag: ${kurz} verkauft teuer und kauft clever.`, 'A-': `Starker Deadline-Day – ${kurz} hat die Nerven behalten.`,
      'B+': `Spät, aber clever: ${kurz} nutzt den Tag.`, B: `Solide Arbeit bis 18:00 Uhr.`, 'C+': `Viel Betrieb, wenig Ertrag.`,
      C: `Hektik ohne Plan – der Kader ist nicht besser geworden.`, D: `Panik am Deadline-Day: zu billig verkauft, zu teuer eingekauft.` };
    return { note, text: texte[note] + (offenB ? ` Offen bleibt: ${baustellen().map(b => b.n).join(', ')}.` : '') };
  }
  function abschliessen(z, opt) {
    opt = opt || {};
    if (z.fertig) return;
    z.fertig = true; z.min = Math.max(z.min, CFG.ende);
    if (z.anruf) { tick(z, 'geplatzt', `${z.anruf.bid.club} legt auf – Fenster zu`); z.anruf = null; }
    anrufUhrStop(); liveUmschalten(false);
    z.anfragen.filter(a => a.status === 'offen' || a.status === 'zusage').forEach(a => { a.status = 'verfallen'; tick(z, 'geplatzt', `${a.name}: ${opt.ohneDich ? 'ohne dich verfallen' : 'nicht rechtzeitig unterschrieben'}`, { eigen: true }); });
    tick(z, 'schluss', `18:00 Uhr – das ${z.typ}fenster ist zu`);
    z.note = noteBerechnen(z);
    const ein = z.ab.reduce((s, x) => s + x.amount, 0), aus = z.zu.reduce((s, x) => s + x.amount, 0);
    if (typeof addNews === 'function') addNews('transfer', `📰 Deadline-Day: Note ${z.note.note}`,
      `FLUTLICHT-KURIER: „${z.note.text}“ ${z.zu.length} Zugänge, ${z.ab.length} Abgänge · Einnahmen ${euro(ein)}, Ausgaben ${euro(aus)}.`);
    speichern();
  }

  // ── Anzeige ──────────────────────────────────────────────────────────────
  function uhrRing(z) {
    const r = 26, u = 2 * Math.PI * r, rest = Math.max(0, CFG.ende - z.min), a = rest / (CFG.ende - CFG.start);
    const f = a > 0.4 ? 'var(--app-gut, #3fcf7a)' : a > 0.15 ? 'var(--app-mittel, #f0c05a)' : 'var(--app-schlecht, #f07462)';
    return `<svg class="dfl-uhr" viewBox="0 0 64 64" role="timer" aria-label="Noch ${rest} Minuten"><circle cx="32" cy="32" r="${r}" class="dfl-uhr-grund"/>
      <circle cx="32" cy="32" r="${r}" class="dfl-uhr-zeit" style="stroke:${f}" stroke-dasharray="${(u * a).toFixed(1)} ${u.toFixed(1)}" transform="rotate(-90 32 32)"/>
      <text x="32" y="37" text-anchor="middle" style="font-size:13px">${Math.floor(rest / 60)}:${String(rest % 60).padStart(2, '0')}</text></svg>`;
  }
  function anrufUhrHtml(a) {
    const r = 18, u = 2 * Math.PI * r, q = Math.max(0, a.rest) / CFG.anrufUhr;
    const f = a.rest > 10 ? 'var(--app-gut, #3fcf7a)' : a.rest > 5 ? 'var(--app-mittel, #f0c05a)' : 'var(--app-schlecht, #f07462)';
    return `<svg class="dfl-uhr dfl-fenster-uhr dl-anruf-uhr" viewBox="0 0 46 46" role="timer" aria-label="Noch ${Math.max(0, a.rest)} Sekunden"><circle cx="23" cy="23" r="${r}" class="dfl-uhr-grund"/>
      <circle cx="23" cy="23" r="${r}" class="dfl-uhr-zeit" style="stroke:${f}" stroke-dasharray="${(u * q).toFixed(1)} ${u.toFixed(1)}" transform="rotate(-90 23 23)"/>
      <text x="23" y="28" text-anchor="middle">${Math.max(0, a.rest)}</text></svg>`;
  }
  function kopf(z, sub) {
    const kz = kader().length;
    return `<div class="dfl-draft-kopf"><div><div class="dfl-draft-titel">${ti('clock-bolt')} Deadline-Day</div><div class="dfl-draft-sub">${esc(sub)}</div></div>
        <div class="dfl-draft-cap">${euro(CLUB.budget || 0)} frei</div></div>
      <div class="dfl-draft-chips"><span class="dfl-draft-chip">Gehalt frei ${euro(CLUB.wageBudget || 0)}/Wo</span>
        <span class="dfl-draft-chip${kz < 18 ? ' jetzt' : ''}">Kader ${kz}</span><span class="dfl-draft-chip erledigt">${z.zu.length} Zugänge · ${z.ab.length} Abgänge</span></div>`;
  }
  function zeileMarkt(z, p) {
    const offenK = z.offenKarte === p.id, n = noteVon(p, z.schnitt), preis = preisVon(p);
    const a = z.anfragen.find(x => x.pid === p.id && ['offen', 'zusage'].indexOf(x.status) >= 0);
    const status = a ? (a.status === 'zusage' ? `<span class="dl-st gut">${ti('check')} Zusage</span>` : `<span class="dl-st">${ti('clock')} Antwort ~${uhrText(a.um)}</span>`) : '';
    return `<button type="button" class="dfl-prospekt${offenK ? ' offen' : ''}" data-dl="karte" data-id="${esc(p.id)}" aria-expanded="${offenK}">
        <span class="dfl-note ${NK(n)}">${n}</span>${gesicht(p, p._clubId ? 'club_' + p._clubId : null)}
        <span class="dfl-pr-name"><b>${esc(name(p))}</b><small><span class="pos-badge-sm pos-${esc(p.pos)}">${esc(p.pos)}</span> ${p.age} J. · Stärke ${p.ovr} · ${esc(p.fromClub || 'vereinslos')}</small>${status}</span>
        <span class="dfl-pr-cap"><b>${euro(preis).replace(/\s*€/, '')}</b>Ablöse</span></button>
      ${offenK ? `<div class="dfl-pr-karte"><div class="fut silber dfl-pr-fut"><div class="fut-wert">${p.ovr}</div><div class="fut-pos">${esc(p.pos)}</div>
          <div class="fut-name">${esc(p.name)}</div><div class="fut-werte"><span><em>ALT</em>${p.age}</span><span><em>MW</em>${euro(p.value || 0)}</span>
          <span><em>GEH</em>${euro(p.wage || 0)}</span><span><em>NOTE</em>${n}</span></div></div>
        <div class="dfl-pr-text"><b>${esc(p.fromClub || 'Vereinslos')}</b><span>${p._npc && p._npc.unsettled ? 'Wechselwillig – der Verein lässt ihn ziehen.' : p._npc && p._npc.imp === 'key' ? 'Leistungsträger – sie geben ihn nur ungern ab.' : 'Steht dort nur am Rand – der Verein will Gehalt sparen.'}</span>
          <span class="dfl-draft-sub">Deadline-Preis ${euro(preis)} (Marktwert ${euro(p.value || 0)}) · Antwort in 30–60 Min.${z.min >= CFG.spaetAb ? ' · <b>Achtung: nach 17:30 Uhr Risiko „Unterlagen zu spät“</b>' : ''}</span>
          ${a ? (a.status === 'zusage' ? `<button class="dfl-draft-btn gross" data-dl="vertrag" data-id="${esc(p.id)}">${ti('writing')} Vertrag mit ${esc(p.name)} machen</button>` : `<span class="dl-st">${ti('clock')} Anfrage läuft – Antwort gegen ${uhrText(a.um)}</span>`)
            : `<button class="dfl-draft-btn gross" data-dl="anfrage" data-id="${esc(p.id)}">${ti('phone-outgoing')} Anfrage stellen · ${euro(preis)}</button>`}</div></div>` : ''}`;
  }
  const TICK_IC = { fix: ['circle-check', 'gut'], geruecht: ['message-dots', ''], geplatzt: ['circle-x', 'schlecht'], anruf: ['phone-call', 'warn'],
    zusage: ['thumb-up', 'gut'], info: ['info-circle', ''], schluss: ['lock', ''] };
  function tickerHtml(z, n) {
    const l = z.ticker.slice(0, n || 12);
    if (!l.length) return '<p class="dfl-draft-sub">Noch ruhig – um 09:00 Uhr öffnen die Geschäftsstellen.</p>';
    return `<ul class="dl-ticker">${l.map(x => { const ic = TICK_IC[x.art] || TICK_IC.info;
      return `<li class="${ic[1]}${x.eigen ? ' eigen' : ''}"><b>${uhrText(x.t)}</b>${ti(ic[0])}<span>${esc(x.text)}</span></li>`; }).join('')}</ul>`;
  }
  function zusagenHtml(z) {
    const zs = z.anfragen.filter(a => a.status === 'zusage');
    return zs.map(a => `<div class="dfl-draft-angebot dl-zusage">${wappen(a.club)}<span><b>${esc(a.club)} sagt zu!</b><small>${esc(a.name)} (${esc(a.pos)}) für ${euro(a.preis)} – unterschreibt er bis 18:00 Uhr?</small></span>
      <button class="dfl-draft-btn" data-dl="vertrag" data-id="${esc(a.pid)}">${ti('writing')} Vertrag</button></div>`).join('');
  }
  function angeboteHtml() {
    const b = (CLUB.transferBids || []).slice(0, 4);
    if (!b.length) return '';
    return `<div class="dl-block-titel">${ti('mail')} Offene Angebote für deine Spieler</div>` + b.map(x => `<div class="dl-angebot-zeile">${wappen(x.club)}
      <span><b>${esc(x.club)}</b><small>${esc(x.playerName || '')} · ${euro(x.amount)}</small></span>
      <button class="dfl-draft-btn" data-dl="bid-an" data-id="${esc(x.id)}">Annehmen</button><button class="dfl-draft-btn leise" data-dl="bid-ab" data-id="${esc(x.id)}">Ablehnen</button></div>`).join('');
  }
  function studioHtml(z) {
    const rest = Math.max(0, CFG.ende - z.min), offenA = z.anfragen.filter(a => a.status === 'offen').length, t = top5(z);
    const B = baustellen();
    return `<div class="dfl-draft-karte dl">
      ${kopf(z, `${z.typ}fenster · ${typeof calendarLabel === 'function' ? calendarLabel(LEAGUE.week, LEAGUE.startYear) : 'KW ' + LEAGUE.week} · Schluss 18:00 Uhr`)}
      <div class="dfl-board">
        <div class="dfl-board-kopf">${uhrRing(z)}<span><small>LIVE · ${uhrText(z.min)} UHR</small><b>${rest >= 60 ? `Noch ${Math.floor(rest / 60)} Std. ${rest % 60 ? rest % 60 + ' Min.' : ''}` : `Noch ${rest} Minuten`}</b>
          <small>${offenA ? `${offenA} Anfrage${offenA === 1 ? '' : 'n'} läuft · ` : ''}${z.anrufe < CFG.maxAnrufe ? 'Telefon klingelt jederzeit' : 'Telefon ist ruhig'}</small></span>
          <button type="button" class="dfl-uhr-knopf" data-dl="live" aria-label="${live ? 'Live anhalten' : 'Live laufen lassen'}">${ti(live ? 'player-pause' : 'player-play')}</button></div>
        <span class="dfl-draft-aktionen dl-zeit"><button class="dfl-draft-btn leise" data-dl="eins">+15 Min.</button><button class="dfl-draft-btn" data-dl="anruf">Bis zum nächsten Anruf</button><button class="dfl-draft-btn leise" data-dl="ende">Bis 18:00</button></span>
        ${zusagenHtml(z)}
        <div class="dfl-board-titel"><b>Last-Minute-Markt · Top 5</b><small>Note: Preis-Leistung gegen deinen Kader (${z.schnitt}) · Preis mit Deadline-Rabatt</small></div>
        ${t.length ? t.map(p => zeileMarkt(z, p)).join('') : '<p class="dfl-draft-sub">Nichts mehr, was zu deinem Budget und Kader passt.</p>'}
      </div>
      ${angeboteHtml()}
      ${B.length ? `<div class="dfl-analyse"><b>Deine Baustellen</b> <span class="dfl-draft-sub">(Kader ${kader().length})</span>
        ${B.map(x => `<div class="dfl-analyse-zeile"><b>${x.n}</b> · ${x.ist} von ${x.soll} <span class="dfl-draft-sub">${x.ist === 0 ? 'unbesetzt' : 'dünn besetzt'}</span></div>`).join('')}</div>` : ''}
      <div class="dl-ticker-kopf">${ti('broadcast')} <b>Live vom Deadline-Day</b><span class="dl-live">LIVE</span></div>
      ${tickerHtml(z, 12)}
      <div class="dl-fuss"><button class="dfl-draft-btn leise" data-dl="zu">${ti('x')} Schließen – später weiter</button><button class="dfl-draft-btn leise" data-dl="skip">${ti('player-skip-forward')} Tag ohne mich beenden</button></div>
      ${z.anruf ? anrufHtml(z) : ''}
    </div>`;
  }
  function anrufHtml(z) {
    const a = z.anruf, b = a.bid, p = kader().find(x => x.id === b.playerId);
    const karte = window.KSTransfer && KSTransfer.angebotKarte ? KSTransfer.angebotKarte(b, { gross: true }) : `<b>${euro(b.amount)}</b>`;
    return `<div class="dfl-fenster-scrim"><div class="dfl-fenster dl-anruf" id="dl-anruf" role="dialog" aria-modal="true" aria-labelledby="dl-anruf-titel" tabindex="-1">
      <div class="dfl-fenster-kopf">${wappen(b.club, 'dfl-fenster-wappen dl-wappen')}
        <span class="dfl-fenster-titel"><small>${ti('phone-call')} Anruf · ${uhrText(a.um)} Uhr</small><b id="dl-anruf-titel">${esc(b.club)} will ${esc(p ? p.name : b.playerName)} – sofort</b></span>
        ${anrufUhrHtml(a)}</div>
      <div class="dfl-fenster-geruecht">Panik-Aufschlag: Sie legen <b>+${b.panik} %</b> auf ihr Grundgebot von ${euro(b.grund)} – je später der Tag, desto nervöser die Vereine.</div>
      ${karte}
      ${a.notiz ? `<div class="dfl-fenster-geruecht">${esc(a.notiz)}</div>` : ''}
      <div class="dfl-fenster-knoepfe"><button type="button" class="app-knopf haupt" data-dl="a-an">Annehmen</button>
        <button type="button" class="app-knopf" data-dl="a-mehr"${a.nachgebessert ? ' disabled' : ''}>Nachbessern</button>
        <button type="button" class="app-knopf rot" data-dl="a-ab">Ablehnen</button></div>
      <div class="dfl-fenster-fuss">Die Deadline-Uhr steht, solange das Telefon klingelt · bei 0 legen sie auf</div>
    </div></div>`;
  }
  function schlussHtml(z) {
    const ein = z.ab.reduce((s, x) => s + x.amount, 0), aus = z.zu.reduce((s, x) => s + x.amount, 0), N = z.note || noteBerechnen(z);
    const zeile = (x, vid, txt, plus) => `<div class="dl-bilanz-zeile">${gesicht(x.spieler || {}, vid)}<span><b>${esc(x.name)}</b><small>${esc(txt)}</small></span>
      <b class="${plus ? 'sim-gut' : 'sim-schlecht'}">${plus ? '+' : '−'}${euro(x.amount)}</b></div>`;
    return `<div class="dfl-draft-karte dl">
      ${kopf(z, `${z.typ}fenster geschlossen · 18:00 Uhr`)}
      <div class="dfl-draft-fertig dl-schluss"><h3>${ti('lock')} Das Fenster ist zu!</h3>
        <div class="dl-note"><span class="dfl-note ${NK(N.note)}">${N.note}</span><span><b>Note vom Flutlicht-Kurier</b><small>„${esc(N.text)}“</small></span></div>
        ${z.zu.length ? `<div class="dl-bilanz-titel">Zugänge</div>${z.zu.map(x => zeile(x, 'fcm', `${x.pos} · ${x.age} J · Stärke ${x.ovr} · von ${x.club}`, false)).join('')}` : ''}
        ${z.ab.length ? `<div class="dl-bilanz-titel">Abgänge</div>${z.ab.map(x => zeile(x, 'fcm', `${x.pos} · ${x.age} J · zu ${x.club}`, true)).join('')}` : ''}
        ${!z.zu.length && !z.ab.length ? '<p class="dfl-draft-sub">Keine Wechsel an diesem Tag.</p>' : ''}
        <div class="sim-bilanz dl-summen"><div><b class="sim-gut">${euro(ein)}</b><small>Einnahmen</small></div><div><b class="sim-schlecht">${euro(aus)}</b><small>Ausgaben</small></div><div><b>${ein - aus >= 0 ? '+' : '−'}${euro(Math.abs(ein - aus))}</b><small>Saldo</small></div></div>
        <p class="dfl-draft-hinweis">Kader ${kader().length} · Nächstes Fenster: ${z.typ === 'Sommer' ? 'Januar (KW 27)' : 'Sommer (KW 1)'}</p>
        <button class="dfl-draft-btn gross" data-dl="zu">Weiter</button></div>
      <div class="dl-ticker-kopf">${ti('broadcast')} <b>Die letzten Minuten</b></div>${tickerHtml(z, 6)}
    </div>`;
  }
  function zeichne() {
    const ov = document.getElementById('ks-dl'), z = zustand();
    if (!ov) return;
    if (!z) { ov.remove(); return; }
    const scroll = ov.scrollTop;
    ov.innerHTML = z.fertig ? schlussHtml(z) : studioHtml(z);
    ov.scrollTop = z.fertig ? 0 : scroll;
    if (z.anruf) { anrufUhrStart(); const el = document.getElementById('dl-anruf'); if (el) el.focus({ preventScroll: true }); } else anrufUhrStop();
  }
  function oeffnen() {
    const z = zustand(true); if (!z) return;
    let ov = document.getElementById('ks-dl');
    if (!ov) {
      ov = document.createElement('div'); ov.id = 'ks-dl'; ov.className = 'dfl-draft-ov'; document.body.appendChild(ov);
      ov.addEventListener('click', klick);
    }
    if (!z.ticker.length) tick(z, 'info', `Deadline-Day! Das ${z.typ}fenster schließt um 18:00 Uhr.`);
    zeichne();
  }
  function schliessen() {
    liveUmschalten(false); anrufUhrStop();
    const ov = document.getElementById('ks-dl'); if (ov) ov.remove();
    try { if (typeof renderAll === 'function') renderAll(); } catch (e) { /* Ansicht optional */ }
    try { if (window.DFLAppShell && DFLAppShell.cta) DFLAppShell.cta(); } catch (e) { /* Haupt-Button optional */ }
  }
  function klick(ev) {
    const t = ev.target.closest('[data-dl]'); if (!t) return;
    const z = zustand(), d = t.dataset.dl, id = t.dataset.id;
    if (!z) { schliessen(); return; }
    if (d === 'zu') { schliessen(); return; }
    if (d === 'eins' || d === 'anruf' || d === 'ende') { liveUmschalten(false); schritt(d); return; }
    if (d === 'live') { liveUmschalten(!live); return; }
    if (d === 'skip') { abschliessen(z); zeichne(); return; }
    if (d === 'karte') { z.offenKarte = z.offenKarte === id ? null : id; zeichne(); return; }
    if (d === 'anfrage') { anfrageStellen(id); return; }
    if (d === 'vertrag') { vertragMachen(id); return; }
    if (d === 'a-an') { anrufAktion('an'); return; }
    if (d === 'a-mehr') { anrufAktion('mehr'); return; }
    if (d === 'a-ab') { anrufAktion('ab'); return; }
    if (d === 'bid-an' || d === 'bid-ab') {
      const b = (CLUB.transferBids || []).find(x => x.id === id); if (!b) return;
      const p = kader().find(x => x.id === b.playerId);
      if (d === 'bid-an' && p) {
        const mw = typeof computeMarketValue === 'function' ? computeMarketValue(p) : (p.value || 0), kopie = Object.assign({}, p);
        try { onAcceptBid(b.id); } catch (e) { console.warn('[Kickstil-Deadline] Verkauf', e); }
        if (!kader().some(x => x.id === p.id)) { z.ab.push({ name: name(kopie), pos: kopie.pos, age: kopie.age, ovr: kopie.ovr, club: b.club, amount: b.amount, mw, spieler: kopie });
          tick(z, 'fix', `Verkauft: ${name(kopie)} für ${euro(b.amount)} an ${b.club}`, { club: b.club, eigen: true }); }
      } else if (d === 'bid-ab') { try { declineTransferBid(b.id); } catch (e) { /* schon weg */ } tick(z, 'info', `Abgelehnt: ${b.club} für ${b.playerName}`, { eigen: true }); }
      speichern(); zeichne(); return;
    }
  }

  // ── Einstiege ───────────────────────────────────────────────────────────
  // Woche weiter ohne Studio: der Tag läuft ohne dich (offene Zusagen verfallen) – vor dem Wochenwechsel abschließen
  {
    const _orig = window.advanceCalendarWeek;
    if (typeof _orig === 'function') {
      window.advanceCalendarWeek = function () {
        try { const z = zustand(); if (z && !z.fertig) abschliessen(z, { ohneDich: true }); } catch (e) { console.warn('[Kickstil-Deadline] Tag beenden', e); }
        const w = LEAGUE && LEAGUE.week;
        const r = _orig.apply(this, arguments);
        // Neue Woche ist der Deadline-Day → Studio öffnen (nicht während „Simulieren bis …“ – das hält selbst an)
        try {
          const sim = window.KSSimulieren && KSSimulieren.laeuft && KSSimulieren.laeuft();
          if (LEAGUE && LEAGUE.week !== w && istDeadline() && !sim) setTimeout(() => { if (offen() && !(window.KSSimulieren && KSSimulieren.laeuft())) oeffnen(); }, 600);
        } catch (e) { /* nur Komfort */ }
        return r;
      };
      try { advanceCalendarWeek = window.advanceCalendarWeek; } catch (e) { /* window reicht */ }
    }
  }
  // PC: Knopf neben „Woche weiter“
  {
    const _orig = window.renderCalendarWidget;
    if (typeof _orig === 'function') {
      window.renderCalendarWidget = function () {
        const r = _orig.apply(this, arguments);
        try {
          const n = document.querySelector('#calendar-widget .cal-next');
          if (n && offen() && !document.getElementById('ks-dl-pc')) {
            n.insertAdjacentHTML('beforebegin', `<button type="button" class="dfl-sim-pc ks-dl-pc" id="ks-dl-pc">${ti('clock-bolt')} Deadline-Day live</button>`);
            document.getElementById('ks-dl-pc').addEventListener('click', oeffnen);
          }
        } catch (e) { /* nur Anzeige */ }
        return r;
      };
      try { renderCalendarWidget = window.renderCalendarWidget; } catch (e) { /* window reicht */ }
    }
  }

  window.KSDeadline = { offen, oeffnen, zustand: () => zustand(), schritt, CFG };
  console.log('[Kickstil-Deadline v1] aktiv — Deadline-Day live 09–18 Uhr: Uhr, Last-Minute-Markt (−8 %), Anrufe mit Panik-Aufschlag (+10–40 %), Ticker, Note');
})();
