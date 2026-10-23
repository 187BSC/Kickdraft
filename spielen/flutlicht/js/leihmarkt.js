/* ═══════════════════════════════════════════════════════════════════════════
   LEIHMARKT  ·  v1
   ─────────────────────────────────────────────────────────────────────────
   Bisher war jeder Marktspieler käuflich, und jede Leihe kam automatisch mit
   einer Kaufoption zu einem gewürfelten Preis. Beides ist unrealistisch:

   · Große Klubs verkaufen ihre Talente nicht — sie verleihen sie, damit die
     Spielpraxis bekommen. Kaufen kann man sie gar nicht.
   · Eine Kaufoption ist Verhandlungssache. Sie kostet, und wer den Spieler
     behalten will, gibt sie nur ungern.
   · Leihen laufen nicht immer nur eine Saison.

   Jetzt:
   · NUR-LEIHE-Spieler sind gekennzeichnet und nicht kaufbar.
   · Der Leihdialog fragt Laufzeit (1 oder 2 Jahre) und Kaufoption ab.
   · Ob es überhaupt eine Kaufoption gibt und was sie kostet, hängt am
     abgebenden Verein: Je stärker und je größer das Talent, desto teurer —
     und bei den größten Juwelen gibt es sie gar nicht.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const CFG = {
    // Wahrscheinlichkeit, dass ein Spieler NUR verliehen wird
    talentAlter: 22, talentLuecke: 8, talentKlubOvr: 76,
    pTalentNurLeihe: 0.55,      // junges Talent bei einem starken Klub
    pSonstNurLeihe:  0.05,      // alle übrigen
    // Kaufoption
    optionBasis: 1.05,          // Anteil vom Marktwert
    optionProKlubOvr: 0.02,     // je OVR-Punkt des abgebenden Klubs über 74
    optionAufschlagLeihe: 0.35, // Nur-Leihe-Spieler: Option ist teuer
    pOptionVerweigert: 0.55,    // ... und oft gar nicht zu bekommen
    gebuehrProJahr: 0.55,       // zweites Jahr kostet zusätzlich
    gebuehrMitOption: 0.25      // Aufpreis auf die Leihgebühr für die Option
  };
  window.Leihmarkt = CFG;

  const euro = v => (typeof formatEuro === 'function') ? formatEuro(v) : ('€' + v);
  const rund = v => (typeof roundMarketValue === 'function') ? roundMarketValue(v) : Math.round(v);
  const nam  = p => (typeof displayName === 'function') ? displayName(p) : p.name;
  const esc  = x => String(x == null ? '' : x).replace(/[<>&]/g, c =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c]);

  // ── Wer ist nur zu leihen? ────────────────────────────────────────────────
  function bestimmeLeihstatus(p) {
    if (!p || p.nurLeihe !== undefined) return p;
    const klubOvr = (p.auslandsklub && p.auslandsklub.ovr) || 0;
    const luecke = (p.truePotential || p.ovr) - p.ovr;
    const talentBeiGrossklub = (p.age || 25) <= CFG.talentAlter &&
                               luecke >= CFG.talentLuecke &&
                               klubOvr >= CFG.talentKlubOvr;
    p.nurLeihe = Math.random() < (talentBeiGrossklub ? CFG.pTalentNurLeihe : CFG.pSonstNurLeihe);
    if (p.nurLeihe) {
      // Bei den größten Juwelen gibt der Klub auch keine Kaufoption heraus.
      p.optionVerweigert = talentBeiGrossklub && Math.random() < CFG.pOptionVerweigert;
    }
    return p;
  }
  if (typeof window.generateMarketPlayer === 'function') {
    const _gen = window.generateMarketPlayer;
    window.generateMarketPlayer = function () {
      const p = _gen.apply(this, arguments);
      try { bestimmeLeihstatus(p); } catch (e) {}
      return p;
    };
    try { generateMarketPlayer = window.generateMarketPlayer; } catch (e) {}
  }
  window.istNurLeihe = function (p) { return !!(p && p.nurLeihe); };

  // ── Konditionen ───────────────────────────────────────────────────────────
  function leihgebuehr(p, jahre, mitOption) {
    let g = (p.loanFee || Math.round((p.value || 0) * 0.10));
    if (jahre > 1) g *= 1 + (jahre - 1) * CFG.gebuehrProJahr;
    if (mitOption) g *= 1 + CFG.gebuehrMitOption;
    return Math.max(5000, rund(g));
  }
  function optionspreis(p) {
    const klubOvr = (p.auslandsklub && p.auslandsklub.ovr) || 72;
    let f = CFG.optionBasis + Math.max(0, klubOvr - 74) * CFG.optionProKlubOvr;
    if (p.nurLeihe) f += CFG.optionAufschlagLeihe;
    return rund((p.value || 0) * f);
  }
  window.leihKonditionen = function (p, jahre, mitOption) {
    return { gebuehr: leihgebuehr(p, jahre || 1, !!mitOption),
             option: p.optionVerweigert ? null : optionspreis(p),
             verweigert: !!p.optionVerweigert };
  };

  // ── Kauf sperren ──────────────────────────────────────────────────────────
  if (typeof window.buyPlayer === 'function') {
    const _buy = window.buyPlayer;
    window.buyPlayer = function (id) {
      try {
        const p = (typeof MARKET !== 'undefined' && MARKET.players)
          ? MARKET.players.find(x => x && x.id === id) : null;
        if (p && p.nurLeihe) {
          alert(nam(p) + ' steht nicht zum Verkauf.\n\n' +
            (p.auslandsklub ? p.auslandsklub.name : (p.fromClub || 'Sein Verein')) +
            ' gibt ihn nur auf Leihbasis ab' +
            (p.optionVerweigert ? ' — eine Kaufoption ist ausgeschlossen.'
                                : ', eine Kaufoption ist verhandelbar.'));
          return;
        }
      } catch (e) {}
      return _buy.apply(this, arguments);
    };
    try { buyPlayer = window.buyPlayer; } catch (e) {}
  }

  // ── Leihdialog ────────────────────────────────────────────────────────────
  function css() {
    if (document.getElementById('leih-css')) return;
    const st = document.createElement('style'); st.id = 'leih-css';
    st.textContent = `#leih-ov{position:fixed;inset:0;z-index:9700;background:rgba(0,0,0,.75);
      display:flex;align-items:center;justify-content:center;padding:14px}
    .leih-k{background:var(--bg2,#161b22);border:1px solid var(--border,#30363d);border-radius:13px;
      width:100%;max-width:430px;max-height:92vh;overflow:auto;padding:17px}
    .leih-t{font:800 15px/1.25 sans-serif;color:var(--text,#e6edf3)}
    .leih-s{font-size:11.5px;color:var(--text2,#8b949e);margin:3px 0 13px}
    .leih-h{font:700 10.5px/1 sans-serif;letter-spacing:.5px;text-transform:uppercase;
      color:var(--text3,#6e7681);margin:13px 0 6px}
    .leih-w{display:flex;gap:6px}
    .leih-b{flex:1;padding:10px;border-radius:8px;border:1px solid var(--border,#30363d);
      background:var(--bg3,#21262d);color:var(--text,#e6edf3);font-size:12.5px;cursor:pointer}
    .leih-b.on{border-color:var(--gold,#f2c14e);background:rgba(242,193,78,.14);font-weight:700}
    .leih-b:disabled{opacity:.45;cursor:not-allowed}
    .leih-z{display:flex;justify-content:space-between;font-size:12.5px;color:var(--text,#e6edf3);
      padding:7px 0;border-bottom:1px solid var(--border,#30363d)}
    .leih-z b{color:var(--gold,#f2c14e)}
    .leih-go{width:100%;margin-top:15px;padding:12px;border-radius:9px;border:none;
      background:var(--accent,#3fb950);color:#06240f;font:800 14px/1 sans-serif;cursor:pointer}
    .leih-go:disabled{background:var(--bg3,#21262d);color:var(--text3,#6e7681);cursor:not-allowed}
    .leih-x{width:100%;margin-top:7px;padding:9px;border-radius:8px;border:1px solid var(--border,#30363d);
      background:transparent;color:var(--text2,#8b949e);font-size:12px;cursor:pointer}`;
    document.head.appendChild(st);
  }

  let LD = null;
  window.loanInPlayer = function (marketId) {
    if (typeof isTransferWindowOpen === 'function' && !isTransferWindowOpen()) {
      alert('Das Transferfenster ist geschlossen.'); return;
    }
    const p = (typeof MARKET !== 'undefined' && MARKET.players)
      ? MARKET.players.find(x => x && x.id === marketId) : null;
    if (!p) return;
    bestimmeLeihstatus(p);
    LD = { id: marketId, jahre: 1, option: false };
    css(); zeichne();
  };

  function zeichne() {
    const p = MARKET.players.find(x => x && x.id === LD.id);
    if (!p) { schliessen(); return; }
    const k = window.leihKonditionen(p, LD.jahre, LD.option);
    const lohn = (typeof weeklyWageFor === 'function') ? weeklyWageFor(p) : (p.wage || 0);
    const budgetOk = (CLUB.budget || 0) >= k.gebuehr;
    const lohnOk = (CLUB.wageBudget || 0) >= lohn;
    let ov = document.getElementById('leih-ov');
    if (!ov) { ov = document.createElement('div'); ov.id = 'leih-ov'; document.body.appendChild(ov); }
    const geber = p.auslandsklub
      ? (p.auslandsklub.flagge || '') + ' ' + p.auslandsklub.name
      : (p.fromClub || 'sein Verein');

    ov.innerHTML = '<div class="leih-k">' +
      '<div class="leih-t">Leihe: ' + (p.flag ? p.flag + ' ' : '') + esc(nam(p)) + '</div>' +
      '<div class="leih-s">' + p.age + ' J · ' +
        (typeof positionsDisplay === 'function' ? positionsDisplay(p) : p.pos) +
        ' · von ' + esc(geber) +
        (p.nurLeihe ? ' · <span style="color:var(--gold,#f2c14e)">steht nicht zum Verkauf</span>' : '') +
      '</div>' +

      '<div class="leih-h">Laufzeit</div>' +
      '<div class="leih-w">' +
        '<button class="leih-b' + (LD.jahre === 1 ? ' on' : '') + '" onclick="leihJahre(1)">1 Jahr</button>' +
        '<button class="leih-b' + (LD.jahre === 2 ? ' on' : '') + '" onclick="leihJahre(2)">2 Jahre</button>' +
      '</div>' +

      '<div class="leih-h">Kaufoption</div>' +
      (k.verweigert
        ? '<div style="font-size:11.5px;color:#f85149">' + esc(geber) +
          ' schließt eine Kaufoption aus — der Spieler kommt nach der Leihe zurück.</div>'
        : '<div class="leih-w">' +
            '<button class="leih-b' + (!LD.option ? ' on' : '') + '" onclick="leihOption(false)">ohne</button>' +
            '<button class="leih-b' + (LD.option ? ' on' : '') + '" onclick="leihOption(true)">aushandeln</button>' +
          '</div>' +
          (LD.option ? '<div style="font-size:11px;color:var(--text3,#6e7681);margin-top:6px">' +
            'Fixierter Kaufpreis ' + euro(k.option) + ', ziehbar im nächsten Transferfenster. ' +
            'Die Leihgebühr steigt dafür um ' + Math.round(CFG.gebuehrMitOption * 100) + ' %.</div>' : '')) +

      '<div class="leih-h">Kosten</div>' +
      '<div class="leih-z"><span>Leihgebühr' + (LD.jahre > 1 ? ' (2 Jahre)' : '') + '</span><b>' + euro(k.gebuehr) + '</b></div>' +
      '<div class="leih-z"><span>Gehalt</span><b>' + euro(lohn) + '/Woche</b></div>' +
      (LD.option && !k.verweigert
        ? '<div class="leih-z"><span>Kaufoption später</span><b>' + euro(k.option) + '</b></div>' : '') +
      (!budgetOk ? '<div style="font-size:11px;color:#f85149;margin-top:7px">Transferbudget reicht nicht (' + euro(CLUB.budget || 0) + ' frei).</div>' : '') +
      (!lohnOk ? '<div style="font-size:11px;color:#f85149;margin-top:4px">Gehaltsbudget reicht nicht (' + euro(CLUB.wageBudget || 0) + '/Woche frei).</div>' : '') +

      '<button class="leih-go" ' + (budgetOk && lohnOk ? '' : 'disabled') + ' onclick="leihAbschliessen()">Leihe abschließen</button>' +
      '<button class="leih-x" onclick="leihSchliessen()">Abbrechen</button>' +
      '</div>';
  }

  window.leihJahre  = function (j) { if (LD) { LD.jahre = j; zeichne(); } };
  window.leihOption = function (b) { if (LD) { LD.option = b; zeichne(); } };
  window.leihSchliessen = schliessen;
  function schliessen() {
    const ov = document.getElementById('leih-ov'); if (ov) ov.remove();
    LD = null;
  }

  window.leihAbschliessen = function () {
    if (!LD) return;
    const idx = MARKET.players.findIndex(x => x && x.id === LD.id);
    if (idx < 0) { schliessen(); return; }
    const p = MARKET.players[idx];
    const k = window.leihKonditionen(p, LD.jahre, LD.option);
    const lohn = (typeof weeklyWageFor === 'function') ? weeklyWageFor(p) : (p.wage || 0);
    if ((CLUB.budget || 0) < k.gebuehr || (CLUB.wageBudget || 0) < lohn) return;

    CLUB.budget -= k.gebuehr;
    CLUB.wageBudget = Math.max(0, (CLUB.wageBudget || 0) - lohn);
    MARKET.players.splice(idx, 1);

    const bis = LEAGUE.season + LD.jahre - 1;
    SQUAD.push({ id: 'sq_' + p.id, name: p.name, firstName: p.firstName, flag: p.flag,
      country: p.country, joinedSeason: LEAGUE.season, acquiredSeason: LEAGUE.season,
      pos: p.pos, positions: p.positions, age: p.age, ovr: p.ovr,
      truePotential: p.truePotential, def: p.def, mid: p.mid, att: p.att,
      pace: p.pace, mental: p.mental, gamesPlayed: 0, seed: p.seed, value: p.value,
      wage: lohn, contractUntil: bis, onLoanFrom: p.fromClub, leihBis: bis,
      traits: p.traits, traitsBekannt: p.traitsBekannt,
      buyOption: (LD.option && !k.verweigert) ? k.option : null,
      birthWeek: p.birthWeek, birthMonth: p.birthMonth, birthDay: p.birthDay });
    try { assignBirthday(SQUAD[SQUAD.length - 1]); assignShirtNumbers(); } catch (e) {}

    CLUB.transferHistory.unshift({ type: 'loan_in', name: p.name, amount: k.gebuehr, season: LEAGUE.season });
    if (typeof addNews === 'function') {
      addNews('transfer', 'Leihe: ' + (p.flag ? p.flag + ' ' : '') + p.name,
        clubShort() + ' leiht ' + p.name + ' für ' + LD.jahre + (LD.jahre === 1 ? ' Jahr' : ' Jahre') +
        ' von ' + (p.fromClub || 'seinem Verein') + ' (Gebühr ' + euro(k.gebuehr) + '). ' +
        ((LD.option && !k.verweigert)
          ? 'Kaufoption über ' + euro(k.option) + ' vereinbart.'
          : 'Ohne Kaufoption — er kehrt danach zurück.'));
    }
    schliessen();
    try { renderAll(); renderTransferTab(); saveGameState(); } catch (e) {}
  };

  // ── Mehrjährige Leihen laufen nicht am Saisonende aus ─────────────────────
  // Die Saisonabrechnung entfernt jeden Spieler mit onLoanFrom. Bei einer
  // Zweijahresleihe muss er bleiben — deshalb wird er vorher versteckt und
  // danach zurückgelegt.
  if (typeof window.applyEndOfSeasonClubEffects === 'function') {
    const _eos = window.applyEndOfSeasonClubEffects;
    window.applyEndOfSeasonClubEffects = function () {
      const bleiben = [];
      try {
        (typeof SQUAD !== 'undefined' ? SQUAD : []).forEach(p => {
          if (p && p.onLoanFrom && p.leihBis != null && p.leihBis > LEAGUE.season) {
            bleiben.push(p); p._leihGeparkt = p.onLoanFrom; delete p.onLoanFrom;
          }
        });
      } catch (e) {}
      const r = _eos.apply(this, arguments);
      bleiben.forEach(p => { p.onLoanFrom = p._leihGeparkt; delete p._leihGeparkt; });
      return r;
    };
    try { applyEndOfSeasonClubEffects = window.applyEndOfSeasonClubEffects; } catch (e) {}
  }

  console.log('%c[Leihmarkt v1] aktiv', 'color:#3fb950;font-weight:bold',
    '— Nur-Leihe-Spieler, Laufzeit 1–2 Jahre, verhandelbare Kaufoption');
})();