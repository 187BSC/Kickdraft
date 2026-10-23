/* ═══════════════════════════════════════════════════════════════════════════
   TRANSFERMARKT-BALANCE  ·  v1
   ─────────────────────────────────────────────────────────────────────────
   Lädt ganz zuletzt — damit die Wrapper NACH allen anderen Preis-Patches
   greifen (PriceBalance v3, Unzufriedenheits-Abschlag, RealMarket).

   Drei Baustellen:
   1) MARKTWERT ab OVR 60 zu niedrig. Die Grundkurve (700 × 1,225^(OVR−40))
      trifft die untere Hälfte gut, wird aber im Bereich 60–80 zu flach: ein
      solider Zweitligaspieler kostete so viel wie ein Regionalliga-Ersatzmann
      im echten Fußball. Dazu ein eigener Aufschlag für ungenutztes Potenzial —
      Talente waren das größte Schnäppchen im Spiel.
   2) ABLÖSEFREIE Spieler waren zu bequem: keine Ablöse, kaum Gehaltsaufschlag,
      keine Unterschriftsprämie. Jetzt verlangen sie HANDGELD aus dem
      Transferbudget und ein spürbar höheres Gehalt — die Ablöse spart man,
      umsonst ist der Wechsel nicht.
   3) Die Niveau-Sperre galt nur beim Kauf über den Markt. Ablösefreie Stars
      sind daran vorbeigelaufen — jetzt nicht mehr.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const CFG = {
    // ── Marktwert ──────────────────────────────────────────────────────────
    // Stützpunkte OVR → Faktor, dazwischen linear. Angehoben wird der Bereich
    // 60–80; ganz oben läuft der Aufschlag wieder aus, dort stimmten die
    // Preise schon (ein 88er kostete bereits zweistellige Millionen).
    klasse: [[60, 1.00], [64, 1.18], [68, 1.36], [72, 1.52], [76, 1.62],
             [80, 1.60], [84, 1.42], [88, 1.24], [92, 1.12]],
    potenzialAbOvr: 58,        // darunter greift der Potenzial-Aufschlag nicht
    potenzialBisOvr: 82,       // darüber auch nicht (dort zählt nur noch Klasse)
    potenzialProPunkt: 0.045,  // je Punkt Luft nach oben
    potenzialMax: 0.75,        // höchstens +75 %
    potenzialMaxAlter: 27,

    // ── Ablösefreie Spieler ────────────────────────────────────────────────
    faGehaltBasis:   1.45,     // Aufschlag auf das faire Wochengehalt
    faGehaltProOvr:  0.012,    // zusätzlich je OVR-Punkt über 60
    faGehaltProJahr: 0.04,     // längere Laufzeit = etwas teurer
    handgeldWochen:  6,        // Grundstock in Wochengehältern
    handgeldProJahr: 1.5,      // plus je Vertragsjahr
    handgeldProOvr:  0.02,     // Klassenaufschlag je OVR-Punkt über 60
    handgeldMin:     5000
  };
  window.TransfermarktBalance = CFG;          // zum Nachjustieren von außen

  const euro = v => (typeof formatEuro === 'function') ? formatEuro(v) : ('€' + v);
  const rundWert = v => (typeof roundMarketValue === 'function') ? roundMarketValue(v) : Math.round(v);
  const rundLohn = v => (typeof roundWage === 'function') ? roundWage(v) : Math.round(v);
  const zeigeName = p => (typeof displayName === 'function') ? displayName(p) : (p.name || '');

  // ── 1. MARKTWERT ─────────────────────────────────────────────────────────
  function klasseFaktor(ovr) {
    const K = CFG.klasse;
    if (!(ovr > K[0][0])) return 1;
    if (ovr >= K[K.length - 1][0]) return K[K.length - 1][1];
    for (let i = 0; i < K.length - 1; i++) {
      const a = K[i], b = K[i + 1];
      if (ovr >= a[0] && ovr <= b[0]) return a[1] + (b[1] - a[1]) * ((ovr - a[0]) / (b[0] - a[0]));
    }
    return 1;
  }
  function potenzialFaktor(p) {
    const ovr = p.ovr || 0, tp = p.truePotential || ovr, luft = tp - ovr;
    // JUWEL: Ab Potenzial 85 bei einem jungen Spieler greift ein eigener,
    // steiler Aufschlag. Solche Spieler wechseln nur für Summen, die weh tun.
    if (tp >= 85 && (p.age || 25) <= 21) {
      const alter = p.age || 20;
      return 1 + Math.min(3.2, (tp - 84) * 0.42) * Math.max(0.55, (23 - alter) / 4);
    }
    if (luft <= 0 || ovr < CFG.potenzialAbOvr || ovr > CFG.potenzialBisOvr) return 1;
    const alter = p.age || 24;
    if (alter > CFG.potenzialMaxAlter) return 1;
    // Je jünger, desto mehr ist die Luft nach oben wert.
    const jung = Math.max(0.3, Math.min(1.1, (29 - alter) / 9));
    return 1 + Math.min(CFG.potenzialMax, luft * CFG.potenzialProPunkt * jung);
  }
  window.marktwertAufschlag = function (p) {
    return p ? klasseFaktor(p.ovr || 0) * potenzialFaktor(p) : 1;
  };

  if (typeof window.computeMarketValue === 'function') {
    const _mv = window.computeMarketValue;
    window.computeMarketValue = function (p) {
      const v = _mv.apply(this, arguments);
      if (!p || !p.ovr) return v;
      return rundWert(v * klasseFaktor(p.ovr) * potenzialFaktor(p));
    };
    try { computeMarketValue = window.computeMarketValue; } catch (e) {}
    console.log('%c[TransfermarktBalance v1] Marktwert ab OVR 60 angehoben', 'color:#3fb950;font-weight:bold');
  }

  // Gespeicherte Werte nachziehen. Ohne das behielten Spieler aus einem alten
  // Spielstand ihren alten (zu niedrigen) Preis, weil p.value beim Erzeugen
  // einmal festgeschrieben wird.
  function werteNachziehen() {
    if (typeof computeMarketValue !== 'function') return;
    const frisch = liste => { (liste || []).forEach(p => {
      if (p && p.ovr && !p._levelPremium) { try { p.value = computeMarketValue(p); } catch (e) {} }
    }); };
    try { if (typeof MARKET !== 'undefined' && MARKET) frisch(MARKET.players); } catch (e) {}
    try { if (typeof CLUB !== 'undefined' && CLUB) frisch(CLUB.freeAgents); } catch (e) {}
    try { if (typeof SQUAD !== 'undefined') frisch(SQUAD); } catch (e) {}
  }

  // ── 2. NIVEAU-PRÜFUNG (auch für Ablösefreie) ─────────────────────────────
  function niveau(p) {
    try { if (typeof checkTransferLevel === 'function') return checkTransferLevel(p); } catch (e) {}
    return { ok: true, premium: 1, over: 0 };
  }

  // ── 3. ABLÖSEFREIE: Gehalt + Handgeld ────────────────────────────────────
  function faPool() {
    try { if (window.FreeAgents && FreeAgents.pool) return FreeAgents.pool(); } catch (e) {}
    try { return (CLUB && CLUB.freeAgents) || []; } catch (e) { return []; }
  }
  try { if (window.FreeAgents && FreeAgents.CFG) FreeAgents.CFG.wagePremium = CFG.faGehaltBasis; } catch (e) {}

  function faGehalt(p, jahre) {
    jahre = Math.max(1, jahre | 0);
    const fair = (typeof weeklyWageFor === 'function') ? weeklyWageFor(p) : (p.wage || 3000);
    let w = fair * (CFG.faGehaltBasis + Math.max(0, (p.ovr || 60) - 60) * CFG.faGehaltProOvr);
    w *= (1 + (jahre - 1) * CFG.faGehaltProJahr);
    // Internationale Spiele sind bares Geld wert: Wer sie bieten kann, muss
    // beim Gehalt weniger drauflegen.
    const eu = (typeof europaStufe === 'function') ? europaStufe() : 0;
    if (eu) w *= eu === 3 ? 0.88 : eu === 2 ? 0.93 : 0.96;
    const chk = niveau(p);
    if (chk.premium > 1) w *= chk.premium;      // zu gut für die Liga = teurer
    return rundLohn(w);
  }
  function faHandgeld(p, jahre) {
    jahre = Math.max(1, jahre | 0);
    const w = faGehalt(p, jahre);
    let hg = w * (CFG.handgeldWochen + jahre * CFG.handgeldProJahr);
    hg *= (1 + Math.max(0, (p.ovr || 60) - 60) * CFG.handgeldProOvr);
    // Wer international spielt, muss weniger Handgeld auf den Tisch legen.
    const eu = (typeof europaStufe === 'function') ? europaStufe() : 0;
    if (eu) hg *= eu === 3 ? 0.82 : eu === 2 ? 0.89 : 0.94;
    return Math.max(CFG.handgeldMin, rundWert(hg));
  }
  window.faKonditionen = function (p, jahre) {
    return { gehalt: faGehalt(p, jahre || 2), handgeld: faHandgeld(p, jahre || 2), niveau: niveau(p) };
  };

  // ── Verpflichtung ────────────────────────────────────────────────────────
  const _origSign = window.signFreeAgent;
  if (typeof _origSign === 'function') {
    window.signFreeAgent = function (faId, jahre) {
      const pool = faPool();
      const p = pool.find(x => x && x.id === faId);
      if (!p) return _origSign.apply(this, arguments);

      if (typeof isTransferWindowOpen === 'function' && !isTransferWindowOpen()) {
        alert('Das Transferfenster ist geschlossen. Auch ablösefreie Spieler können nur im Sommer (KW1-6) und Winter (Januar) verpflichtet werden.');
        return;
      }
      // Ein Spieler dieser Klasse unterschreibt nicht in dieser Liga —
      // ablösefrei hin oder her.
      const chk = niveau(p);
      if (!chk.ok) { alert('🚫 ' + chk.reason); return; }

      if (jahre == null) { vertragsDialog(p); return; }
      const maxY = (typeof MAX_CONTRACT_YEARS !== 'undefined') ? MAX_CONTRACT_YEARS : 5;
      jahre = Math.max(1, Math.min(maxY, jahre | 0));

      const gehalt = faGehalt(p, jahre), handgeld = faHandgeld(p, jahre);
      if (((CLUB && CLUB.budget) || 0) < handgeld) {
        alert('Das Handgeld ist nicht gedeckt: ' + zeigeName(p) + ' verlangt ' + euro(handgeld) +
              ' bei Unterschrift. Frei im Transferbudget: ' + euro((CLUB && CLUB.budget) || 0) + '.');
        return;
      }
      // Forderung festschreiben, damit die Original-Funktion damit rechnet.
      p.faWageDemand = gehalt; p.wage = gehalt;

      const vorher = pool.length;
      _origSign.call(this, faId, jahre);
      if (pool.length >= vorher) return;         // abgebrochen (z.B. Kader voll)

      CLUB.budget = (CLUB.budget || 0) - handgeld;
      try {
        // Der Eintrag der Original-Funktion steht als „buy" mit Ablöse 0 vorn —
        // dort das Handgeld eintragen, damit die Transferbilanz stimmt.
        const h = CLUB.transferHistory;
        if (Array.isArray(h) && h[0] && h[0].type === 'buy' && !h[0].amount) h[0].amount = handgeld;
      } catch (e) {}
      if (typeof addNews === 'function') {
        addNews('transfer', 'Handgeld: ' + euro(handgeld) + ' für ' + p.name,
          zeigeName(p) + ' unterschreibt ablösefrei — dafür fließen ' + euro(handgeld) +
          ' Handgeld aus dem Transferbudget, das Gehalt liegt bei ' + euro(gehalt) +
          '/Woche. Restbudget: ' + euro(CLUB.budget) + '.');
      }
      if (typeof showToast === 'function') showToast('Handgeld ' + euro(handgeld) + ' gezahlt.', 'money');
      if (typeof renderTransferTab === 'function') renderTransferTab();
      if (typeof updateUI === 'function') updateUI();
      if (typeof saveGameState === 'function') saveGameState();
    };
    try { signFreeAgent = window.signFreeAgent; } catch (e) {}
  }

  window.__signFA = function (id, y) {
    const ov = document.querySelector('.contract-overlay');
    if (ov) ov.remove();
    window.signFreeAgent(id, y);
  };

  // ── Vertragsdialog ───────────────────────────────────────────────────────
  function vertragsDialog(p) {
    const maxY = (typeof MAX_CONTRACT_YEARS !== 'undefined') ? MAX_CONTRACT_YEARS : 5;
    const chk = niveau(p);
    const ov = document.createElement('div');
    ov.className = 'contract-overlay';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px';
    let rows = '';
    for (let y = 1; y <= maxY; y++) {
      const w = faGehalt(p, y), hg = faHandgeld(p, y);
      const lohnOk = ((CLUB && CLUB.wageBudget) || 0) >= w;
      const geldOk = ((CLUB && CLUB.budget) || 0) >= hg;
      const ok = lohnOk && geldOk;
      const warn = ok ? '' : (!lohnOk ? 'Gehaltsbudget zu klein' : 'Transferbudget zu klein');
      rows += '<button class="contract-year-btn" ' + (ok ? '' : 'disabled') +
        ' onclick="__signFA(\'' + p.id + '\',' + y + ')"' +
        ' style="display:flex;justify-content:space-between;align-items:center;width:100%;padding:10px 12px;margin-bottom:6px;border-radius:8px;border:1px solid var(--border,#30363d);background:' +
        (ok ? 'var(--bg3,#21262d)' : 'var(--bg2,#161b22)') + ';color:var(--text,#e6edf3);cursor:' +
        (ok ? 'pointer' : 'not-allowed') + ';opacity:' + (ok ? 1 : .5) + '">' +
        '<span><b>' + y + (y === 1 ? ' Jahr' : ' Jahre') + '</b> · bis ' +
        (typeof seasonEndYear === 'function' ? seasonEndYear(LEAGUE.season + y) : (LEAGUE.season + y)) +
        (warn ? '<br><span style="font-size:10px;color:#f85149">' + warn + '</span>' : '') + '</span>' +
        '<span style="text-align:right"><b style="color:var(--gold,#f2c14e)">' + euro(hg) + '</b> Handgeld' +
        '<br><span style="font-size:11px;color:var(--text2,#8b949e)">' + euro(w) + '/Woche</span></span></button>';
    }
    // Rückmeldung 18.10.: keine Erklärsätze im Spiel – nur die Marke
    const hinweis = chk.premium > 1
      ? '<div style="margin-bottom:10px"><span class="loan-tag" style="color:var(--gold,#f2c14e);border-color:var(--gold,#f2c14e)">Prämie +' +
        Math.round((chk.premium - 1) * 100) + ' %</span></div>'
      : '';
    ov.innerHTML = '<div style="background:var(--bg2,#161b22);border:1px solid var(--border,#30363d);border-radius:12px;max-width:440px;width:100%;padding:20px">' +
      '<div style="font-size:15px;font-weight:700;margin-bottom:4px">Ablösefrei verpflichten: ' +
      (p.flag ? p.flag + ' ' : '') + zeigeName(p) + '</div>' +
      '<div style="font-size:12px;color:var(--text2,#8b949e);margin-bottom:6px">' + p.age + ' J · ' +
      (typeof positionsDisplay === 'function' ? positionsDisplay(p) : p.pos) + ' · OVR ' + p.ovr + ' · ' +
      (p.fromClub || 'vereinslos') + '</div>' +
      '<div style="font-size:12px;font-weight:700;margin-bottom:8px">Laufzeit</div>' +
      hinweis + rows +
      '<button onclick="this.closest(\'.contract-overlay\').remove()" style="width:100%;padding:9px;margin-top:6px;border-radius:8px;border:1px solid var(--border,#30363d);background:transparent;color:var(--text2,#8b949e);cursor:pointer">Abbrechen</button>' +
      '</div>';
    document.body.appendChild(ov);
  }

  // ── Liste der Ablösefreien ───────────────────────────────────────────────
  function renderFrei() {
    const el = document.getElementById('tr-sub-frei');
    if (!el) return;
    const pool = faPool();
    const offen = (typeof isTransferWindowOpen === 'function') ? isTransferWindowOpen() : true;
    if (!pool.length) {
      el.innerHTML = '<div style="color:var(--text3);font-size:11px;padding:12px">Aktuell keine ablösefreien Spieler verfügbar. Schau im nächsten Transferfenster wieder vorbei.</div>';
      return;
    }
    const scout = (CLUB.facilities && CLUB.facilities.scouting) || 1;
    const sorted = pool.slice().sort((a, b) =>
      (b.ovr + (b.truePotential || 0) * 0.2) - (a.ovr + (a.truePotential || 0) * 0.2));
    const rows = sorted.map(p => {
      const chk = niveau(p);
      const hg = faHandgeld(p, 2), w = faGehalt(p, 2);
      const potTxt = (typeof potentialDisplay === 'function') ? potentialDisplay(p, scout) : ('Pot ' + (p.truePotential || '?'));
      const tag = !chk.ok
        ? '<span class="loan-tag" style="background:#3a1a1a;color:#f85149;border-color:#f85149">zu hochklassig</span>'
        : (p.academyProduct
            ? '<span class="loan-tag" style="background:#1a3a1a;color:#3fb950;border-color:#3fb950">NLZ-Talent</span>'
            : '<span class="loan-tag">ablösefrei</span>');
      const preis = chk.ok
        ? '<span style="color:var(--gold,#f2c14e)">' + euro(hg) + '</span><br><span style="font-size:9px;color:var(--text3)">Handgeld · ' + euro(w) + '/Wo</span>'
        : '<span style="color:#f85149;font-size:10px">lehnt ab</span>';
      const knopf = chk.ok
        ? '<button class="mkt-btn" ' + (offen ? '' : 'disabled') + ' onclick="signFreeAgent(\'' + p.id + '\')">Verpflichten</button>'
        : '<button class="mkt-btn" disabled title="' + (chk.reason || '') + '">Kein Wechsel</button>';
      // Rückmeldung 18.10.: Ablösefreie mit Gesicht wie im Markt
      let bild = '';
      try { if (window.KSVerein && KSVerein.gesicht) bild = '<span class="ks-mkt-gesicht dfl-portrait klein">' + KSVerein.gesicht(p) + '</span>'; } catch (e) { bild = ''; }
      return '<div class="market-row">' + bild + '<div style="flex:1">' +
        '<span class="pos-badge-sm pos-' + p.pos + '">' +
        (typeof positionsDisplay === 'function' ? positionsDisplay(p) : p.pos) + '</span> ' +
        '<span class="market-name">' + (p.flag ? p.flag + ' ' : '') + zeigeName(p) + '</span> ' + tag +
        '<div class="market-meta">' + p.age + ' J · OVR ' + p.ovr + ' · <b style="color:var(--text2)">' + potTxt +
        '</b> · DEF ' + p.def + ' · MID ' + p.mid + ' · ATT ' + p.att + ' · ' + (p.fromClub || 'vereinslos') + '</div>' +
        '</div><div class="market-value">' + preis + '</div>' +
        '<div class="market-btns">' + knopf + '</div></div>';
    }).join('');
    el.innerHTML = '<div style="font-size:11px;color:var(--text3);margin-bottom:8px">' + pool.length + ' verfügbar</div>' +
      '<div class="market-list">' + rows + '</div>';
  }
  window.renderFreeAgentList = renderFrei;

  // Der Transfermarkt rendert die Liste über die IIFE-interne Fassung —
  // deshalb hier NACH dem Original noch einmal drüber.
  if (typeof window.renderTransferTab === 'function') {
    const _tab = window.renderTransferTab;
    window.renderTransferTab = function () {
      try { werteNachziehen(); } catch (e) {}
      const r = _tab.apply(this, arguments);
      try { renderFrei(); } catch (e) {}
      return r;
    };
    try { renderTransferTab = window.renderTransferTab; } catch (e) {}
  }

  // ── 4. VERKAUFSWEGE ──────────────────────────────────────────────────────
  // Drei Wege, einen Spieler abzugeben — mit klarer Rangfolge:
  //   Schnellverkauf   70–90 % vom Marktwert (sofort, ohne Verhandlung)
  //   Anbieten         ~90 %              (ein Interessent meldet sich)
  //   Fremdes Gebot    100–140 % und mehr (mit Verhandlung noch mehr)
  CFG.schnellverkauf = { min: 0.70, max: 0.90 };

  // „Anbieten" war im Spiel gar nicht erreichbar und ohne jede Prüfung. Hier
  // bekommt es dieselben Sperren wie der Verkauf — Transferfenster, Kadergröße,
  // Verkaufssperre für Neuzugänge, keine Leihspieler.
  const _origOffer = window.offerPlayerForSale;
  if (typeof _origOffer === 'function') {
    window.offerPlayerForSale = function (playerId) {
      const p = (typeof SQUAD !== 'undefined' ? SQUAD : []).find(x => x && x.id === playerId);
      if (!p) return _origOffer.apply(this, arguments);
      if (typeof isTransferWindowOpen === 'function' && !isTransferWindowOpen()) {
        alert('Das Transferfenster ist geschlossen. Anbieten geht nur im Sommer (KW1–6) und im Winter (Januar).');
        return null;
      }
      if (p.onLoanFrom) { alert(zeigeName(p) + ' gehört dir nicht — Leihspieler kannst du nicht anbieten.'); return null; }
      if (p.onLoanAt)   { alert(zeigeName(p) + ' ist verliehen. Hol ihn erst zurück.'); return null; }
      if ((typeof SQUAD !== 'undefined' ? SQUAD.length : 0) <= 12) {
        alert('Der Kader ist zu klein, um noch jemanden abzugeben (mindestens 12 Spieler nötig).');
        return null;
      }
      if (typeof window.canSellPlayer === 'function' && !window.canSellPlayer(p)) {
        alert(zeigeName(p) + ' wurde erst in dieser Saison verpflichtet und kann frühestens in der nächsten Saison wieder abgegeben werden.');
        return null;
      }
      const mv = (typeof computeMarketValue === 'function') ? computeMarketValue(p) : (p.value || 0);
      const erwartet = rundWert(mv * 0.9);
      if (typeof confirm === 'function' &&
          !confirm(zeigeName(p) + ' anbieten?\n' +
                   'Erwarteter Erlös rund ' + euro(erwartet) + ' · Marktwert ' + euro(mv))) {
        return null;
      }
      return _origOffer.apply(this, arguments);
    };
    try { offerPlayerForSale = window.offerPlayerForSale; } catch (e) {}
  }

  console.log('%c[TransfermarktBalance v1] aktiv', 'color:#3fb950;font-weight:bold',
    '— Marktwert 60+, Handgeld & Gehalt für Ablösefreie, Niveau-Sperre auch ablösefrei, ' +
    'Schnellverkauf ' + Math.round(CFG.schnellverkauf.min * 100) + '–' + Math.round(CFG.schnellverkauf.max * 100) + ' % MW');
})();