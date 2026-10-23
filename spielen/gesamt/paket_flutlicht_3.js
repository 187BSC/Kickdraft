;
;/* ── js/leihmarkt.js ── */
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
;/* ── js/traits.js ── */
/* ═══════════════════════════════════════════════════════════════════════════
   CHARAKTEREIGENSCHAFTEN  ·  v1 (Kern)
   ─────────────────────────────────────────────────────────────────────────
   27 Eigenschaften, die Spieler mit gleichen Werten unterscheidbar machen.

   Verteilung: 45 % ohne, 32 % eine, 17 % zwei, 5 % drei, 1 % vier —
   Toptalente etwas häufiger mit. Wer drei oder mehr hat, bekommt garantiert
   mindestens einen Nachteil, sonst wären Mehrfach-Charaktere schlicht bessere
   Spieler. Nachteile sind beim Ziehen zusätzlich höher gewichtet, weil es
   deutlich mehr Vorteile in der Liste gibt.

   Sichtbarkeit:
     offen     — steht sofort im Kader
     scout     — die Beobachtung deckt es bei 60 % Fortschritt auf
     verdeckt  — zeigt sich erst durch Ereignisse (2. Verletzung, Formkrise,
                 Rollenkonflikt)

   Dieser Kern liefert Datenmodell, Vergabe, Aufdeckung und Anzeige. Die
   Wirkungen auf Entwicklung und Physis hängen direkt daran; alles Weitere
   (Kabine, Verhandlung, Spielweise) lässt sich einzeln nachrüsten.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // art: 'plus' | 'minus' | 'mix'   ·   sicht: 'offen' | 'scout' | 'verdeckt'
  const TRAITS = {
    // ── Entwicklung ────────────────────────────────────────────────────────
    fruehentwickler: { name:'Frühentwickler', art:'mix', sicht:'scout', gruppe:'Entwicklung',
      text:'Reift schnell, ist früh fertig — und baut auch früher ab.' },
    spaetentwickler: { name:'Spätentwickler', art:'mix', sicht:'scout', gruppe:'Entwicklung',
      text:'Braucht lange, legt dafür bis weit in die Zwanziger zu.' },
    trainingsfleiss: { name:'Trainingsweltmeister', art:'plus', sicht:'scout', gruppe:'Entwicklung',
      text:'Arbeitet härter als alle anderen und entwickelt sich schneller.' },
    trainingsfaul:   { name:'Trainingsfaul', art:'minus', sicht:'scout', gruppe:'Entwicklung',
      text:'Lässt im Training nach — die Entwicklung stockt.' },

    // ── Physis ─────────────────────────────────────────────────────────────
    laufwunder:      { name:'Laufwunder', art:'plus', sicht:'offen', gruppe:'Physis',
      text:'Hat auch nach 90 Minuten noch Luft.' },
    konditionsschwach:{ name:'Konditionsschwach', art:'minus', sicht:'offen', gruppe:'Physis',
      text:'Geht früh die Puste aus.' },
    verletzungsanfaellig:{ name:'Verletzungsanfällig', art:'minus', sicht:'verdeckt', gruppe:'Physis',
      text:'Fällt häufiger aus als andere.' },
    unverwuestlich:  { name:'Unverwüstlich', art:'plus', sicht:'scout', gruppe:'Physis',
      text:'Steht praktisch immer zur Verfügung.' },
    schnellheiler:   { name:'Schnellheiler', art:'plus', sicht:'scout', gruppe:'Physis',
      text:'Kommt schneller zurück als die Prognose sagt.' },
    vorbildprofi:    { name:'Vorbildprofi', art:'plus', sicht:'scout', gruppe:'Physis',
      text:'Lebt professionell — der Abbau ab 30 setzt später ein.' },

    // ── Kabine ─────────────────────────────────────────────────────────────
    fuehrungsspieler:{ name:'Führungsspieler', art:'plus', sicht:'offen', gruppe:'Kabine',
      text:'Hebt die Stimmung der ganzen Mannschaft.' },
    mentor:          { name:'Mentor', art:'plus', sicht:'scout', gruppe:'Kabine',
      text:'Bringt junge Mitspieler schneller voran.' },
    diva:            { name:'Diva', art:'minus', sicht:'verdeckt', gruppe:'Kabine',
      text:'Verlangt eine große Rolle — und wird laut, wenn er sie nicht bekommt.' },

    // ── Verhandlung und Ehrgeiz ────────────────────────────────────────────
    vereinstreu:     { name:'Vereinstreu', art:'plus', sicht:'scout', gruppe:'Ehrgeiz',
      text:'Verlängert unter Wert und wird nie von sich aus wechselwillig.' },
    geldgierig:      { name:'Geldgierig', art:'minus', sicht:'scout', gruppe:'Ehrgeiz',
      text:'Verlangt deutlich mehr Gehalt — ist dafür fast immer zu holen.' },
    bescheiden:      { name:'Bescheiden', art:'plus', sicht:'scout', gruppe:'Ehrgeiz',
      text:'Nimmt auch eine Reservistenrolle ohne Murren an.' },
    titelhungrig:    { name:'Titelhungrig', art:'mix', sicht:'offen', gruppe:'Ehrgeiz',
      text:'Will Erfolg — und wird unzufrieden, wenn die Saisonziele verfehlt werden.' },
    heimatverbunden: { name:'Heimatverbunden', art:'plus', sicht:'scout', gruppe:'Ehrgeiz',
      text:'Verlangt in der Heimat oder beim alten Verein weniger Gehalt.' },
    wechselfreudig:  { name:'Wechselfreudig', art:'minus', sicht:'scout', gruppe:'Ehrgeiz',
      text:'Drängt regelmäßig auf Veränderung.' },

    // ── Spielweise ─────────────────────────────────────────────────────────
    konstant:        { name:'Konstant', art:'plus', sicht:'scout', gruppe:'Spielweise',
      text:'Schwankt kaum — man weiß, was man bekommt.' },
    launisch:        { name:'Launisch', art:'minus', sicht:'verdeckt', gruppe:'Spielweise',
      text:'Zwischen Rausch und Krise liegt bei ihm wenig.' },
    nervenstark:     { name:'Nervenstark', art:'plus', sicht:'scout', gruppe:'Spielweise',
      text:'Wächst in Derbys, Pokalspielen und Topspielen über sich hinaus.' },
    mentalitaet:     { name:'Mentalitätsspieler', art:'plus', sicht:'scout', gruppe:'Spielweise',
      text:'Wird stärker, wenn die Mannschaft zurückliegt.' },
    standards:       { name:'Standardspezialist', art:'plus', sicht:'offen', gruppe:'Spielweise',
      text:'Gefährlich bei Freistößen und Ecken.' },
    hitzkopf:        { name:'Hitzkopf', art:'minus', sicht:'offen', gruppe:'Spielweise',
      text:'Sieht mehr Karten als ihm guttut.' },

    // ── Öffentlichkeit ─────────────────────────────────────────────────────
    publikumsliebling:{ name:'Publikumsliebling', art:'plus', sicht:'offen', gruppe:'Öffentlichkeit',
      text:'Die Fans lieben ihn — ein Verkauf kostet Stimmung.' },
    medienpraesent:  { name:'Medienpräsent', art:'mix', sicht:'offen', gruppe:'Öffentlichkeit',
      text:'Steht ständig in der Zeitung, im Guten wie im Schlechten.' }
  };
  const SCHLUESSEL = Object.keys(TRAITS);

  const CFG = {
    // Verteilung der Anzahl: [ohne, 1, 2, 3, 4]
    verteilung: [0.45, 0.32, 0.17, 0.05, 0.01],
    // Toptalente haben häufiger Charakter — Persönlichkeit ist mit ein Grund,
    // warum jemand oben landet.
    talentBonus: 0.12,        // verschiebt die Verteilung nach oben
    talentAbPotenzial: 80,
    // Es gibt 15 Vorteile, 8 Nachteile und 4 zweischneidige. Ohne Gegengewicht
    // würde jeder Kader im Schnitt besser. 1,55 landet bei rund 1,1 Vorteilen
    // je Nachteil — leicht positiv, ohne dass die Werte davonlaufen.
    minusGewicht: 1.55,
    minusPflichtAb: 3,        // ab so vielen Traits mindestens ein Nachteil
    scoutSchwelle: 0.6,       // ab diesem Beobachtungs-Fortschritt sichtbar
    // Gegensätze, die sich ausschließen
    unvereinbar: [
      ['fruehentwickler','spaetentwickler'], ['trainingsfleiss','trainingsfaul'],
      ['laufwunder','konditionsschwach'], ['verletzungsanfaellig','unverwuestlich'],
      ['geldgierig','bescheiden'], ['geldgierig','vereinstreu'],
      ['vereinstreu','wechselfreudig'], ['bescheiden','diva'],
      ['konstant','launisch'], ['vorbildprofi','trainingsfaul']
    ]
  };
  window.Traits = { katalog: TRAITS, cfg: CFG };

  function passtDazu(schon, kand) {
    if (schon.includes(kand)) return false;
    return !CFG.unvereinbar.some(([a, b]) =>
      (a === kand && schon.includes(b)) || (b === kand && schon.includes(a)));
  }
  function zieheAnzahl(potenzial) {
    let r = Math.random();
    // Nach OBEN verschieben, nicht nach unten: Index 0 ist „keine Eigenschaft".
    // Vorher senkte der Bonus r und machte Toptalente dadurch charakterloser.
    if ((potenzial || 0) >= CFG.talentAbPotenzial) r = Math.min(0.9999, r + CFG.talentBonus);
    let summe = 0;
    for (let i = 0; i < CFG.verteilung.length; i++) {
      summe += CFG.verteilung[i];
      if (r < summe) return i;
    }
    return 0;
  }
  function ziehe(schon, nurArt) {
    const kandidaten = SCHLUESSEL.filter(k =>
      passtDazu(schon, k) && (!nurArt || TRAITS[k].art === nurArt));
    if (!kandidaten.length) return null;
    const gewichte = kandidaten.map(k => TRAITS[k].art === 'minus' ? CFG.minusGewicht : 1);
    const gesamt = gewichte.reduce((a, b) => a + b, 0);
    let r = Math.random() * gesamt;
    for (let i = 0; i < kandidaten.length; i++) { r -= gewichte[i]; if (r <= 0) return kandidaten[i]; }
    return kandidaten[kandidaten.length - 1];
  }

  // Vergibt Eigenschaften an einen Spieler. Idempotent — wer schon welche hat,
  // behält sie.
  function vergib(p) {
    if (!p || Array.isArray(p.traits)) return p;
    const n = zieheAnzahl(p.truePotential || p.ovr);
    const raus = [];
    for (let i = 0; i < n; i++) {
      // Ab drei Eigenschaften muss ein Nachteil dabei sein
      const pflicht = (n >= CFG.minusPflichtAb && i === n - 1 &&
                       !raus.some(k => TRAITS[k].art === 'minus')) ? 'minus' : null;
      const k = ziehe(raus, pflicht);
      if (k) raus.push(k);
    }
    p.traits = raus;
    // Verdeckte Eigenschaften sind anfangs unbekannt
    p.traitsBekannt = raus.filter(k => TRAITS[k].sicht === 'offen');
    return p;
  }
  window.traitsVergeben = vergib;

  function hat(p, key) { return !!(p && p.traits && p.traits.indexOf(key) >= 0); }
  window.hatTrait = hat;

  // Welche Eigenschaften darf der Spieler gerade sehen?
  function sichtbare(p) {
    if (!p || !Array.isArray(p.traits)) return [];
    const bekannt = p.traitsBekannt || [];
    const fortschritt = (typeof window.beobachtungsFortschritt === 'function')
      ? window.beobachtungsFortschritt(p) : 0;
    const imKader = (typeof SQUAD !== 'undefined') && SQUAD.some(x => x && x.id === p.id);
    return p.traits.filter(k => {
      const t = TRAITS[k]; if (!t) return false;
      if (t.sicht === 'offen') return true;
      if (t.sicht === 'scout') return imKader || fortschritt >= CFG.scoutSchwelle;
      return bekannt.indexOf(k) >= 0;              // verdeckt: nur wenn aufgedeckt
    });
  }
  window.sichtbareTraits = sichtbare;

  // Eine verdeckte Eigenschaft ans Licht bringen (nach Verletzung, Krise, Streit)
  window.traitAufdecken = function (p, key, grund) {
    if (!hat(p, key)) return false;
    if (!Array.isArray(p.traitsBekannt)) p.traitsBekannt = [];
    if (p.traitsBekannt.indexOf(key) >= 0) return false;
    p.traitsBekannt.push(key);
    const t = TRAITS[key];
    if (typeof addNews === 'function') {
      const nm = (typeof displayName === 'function') ? displayName(p) : p.name;
      addNews('squad', 'Erkenntnis: ' + nm + ' — ' + t.name,
        (grund ? grund + ' ' : '') + t.text);
    }
    return true;
  };

  // ── Wirkungen: Entwicklung und Physis ─────────────────────────────────────
  // Multiplikator auf die Entwicklungsgeschwindigkeit
  window.traitDevFaktor = function (p) {
    let f = 1;
    if (hat(p, 'trainingsfleiss')) f *= 1.30;
    if (hat(p, 'trainingsfaul'))   f *= 0.68;
    const age = (p && p.age) || 25;
    // Früh- und Spätentwickler verschieben die Kurve, statt sie anzuheben
    if (hat(p, 'fruehentwickler')) f *= age <= 21 ? 1.35 : age <= 25 ? 1.0 : 0.55;
    if (hat(p, 'spaetentwickler')) f *= age <= 20 ? 0.62 : age <= 24 ? 1.0 : 1.45;
    return f;
  };
  // Multiplikator auf das Verletzungsrisiko
  window.traitVerletzungsFaktor = function (p) {
    let f = 1;
    if (hat(p, 'verletzungsanfaellig')) f *= 1.85;
    if (hat(p, 'unverwuestlich'))       f *= 0.45;
    if (hat(p, 'vorbildprofi'))         f *= 0.85;
    return f;
  };
  // Multiplikator auf die Ausfalldauer
  window.traitHeilFaktor = function (p) {
    let f = 1;
    if (hat(p, 'schnellheiler')) f *= 0.65;
    if (hat(p, 'vorbildprofi'))  f *= 0.90;
    return f;
  };
  // Multiplikator auf den Konditionsverbrauch in der Engine
  window.traitKondFaktor = function (p) {
    let f = 1;
    if (hat(p, 'laufwunder'))        f *= 0.80;
    if (hat(p, 'konditionsschwach')) f *= 1.28;
    return f;
  };
  // Ab wann der altersbedingte Abbau einsetzt (Verschiebung in Jahren)
  window.traitAlterungsVerschiebung = function (p) {
    let v = 0;
    if (hat(p, 'vorbildprofi'))    v += 2;
    if (hat(p, 'fruehentwickler')) v -= 2;
    if (hat(p, 'spaetentwickler')) v += 1;
    return v;
  };

  // ── Anzeige ───────────────────────────────────────────────────────────────
  function css() {
    if (document.getElementById('trait-css')) return;
    const st = document.createElement('style'); st.id = 'trait-css';
    st.textContent = `.trait-chip{display:inline-block;font-size:9.5px;line-height:1.5;padding:1px 6px;
      border-radius:9px;margin:2px 3px 0 0;border:1px solid;white-space:nowrap}
    .trait-plus{color:var(--accent,#3fb950);border-color:rgba(63,185,80,.45);background:rgba(63,185,80,.10)}
    .trait-minus{color:#f85149;border-color:rgba(248,81,73,.45);background:rgba(248,81,73,.10)}
    .trait-mix{color:var(--gold,#f2c14e);border-color:rgba(242,193,78,.45);background:rgba(242,193,78,.10)}`;
    document.head.appendChild(st);
  }
  // HTML-Schnipsel mit den sichtbaren Eigenschaften eines Spielers
  window.traitChips = function (p, maxAnzahl) {
    const keys = sichtbare(p);
    if (!keys.length) return '';
    css();
    return keys.slice(0, maxAnzahl || 99).map(k => {
      const t = TRAITS[k];
      return '<span class="trait-chip trait-' + t.art + '" title="' +
        String(t.text).replace(/"/g, '&quot;') + '">' + t.name + '</span>';
    }).join('');
  };

  // ── Vergabe an bestehende und neue Spieler ────────────────────────────────
  // Marktspieler bekommen ihre Eigenschaften bei der Erzeugung.
  if (typeof window.generateMarketPlayer === 'function') {
    const _gen = window.generateMarketPlayer;
    window.generateMarketPlayer = function () {
      const p = _gen.apply(this, arguments);
      try { vergib(p); } catch (e) {}
      return p;
    };
    try { generateMarketPlayer = window.generateMarketPlayer; } catch (e) {}
  }
  // Alles, was schon im Spielstand liegt (Kader, Markt, Ablösefreie), wird
  // einmalig nachgerüstet — sonst hätten Bestandsspieler nie Charakter.
  window.traitsNachruesten = function () {
    let n = 0;
    const durch = liste => (liste || []).forEach(p => {
      if (p && p.ovr && !Array.isArray(p.traits)) { vergib(p); n++; }
    });
    try { durch(typeof SQUAD !== 'undefined' ? SQUAD : []); } catch (e) {}
    try { durch(typeof MARKET !== 'undefined' && MARKET ? MARKET.players : []); } catch (e) {}
    try { durch(CLUB && CLUB.freeAgents); } catch (e) {}
    try { durch(CLUB && CLUB.youthPlayers); } catch (e) {}
    return n;
  };
  window.addEventListener('load', function () {
    setTimeout(function () { try { window.traitsNachruesten(); } catch (e) {} }, 1200);
  });

  console.log('%c[Traits v1] aktiv', 'color:#3fb950;font-weight:bold',
    '— ' + SCHLUESSEL.length + ' Eigenschaften, Kern mit Vergabe, Aufdeckung und Anzeige');
})();
;/* ── js/beobachtung.js ── */
/* ═══════════════════════════════════════════════════════════════════════════
   BEOBACHTUNG  ·  v1
   ─────────────────────────────────────────────────────────────────────────
   Der Transfermarkt wurde jede Woche neu gewürfelt, und jeder Spieler lag
   sofort offen: exakte Stärke, exaktes Potenzial, einmal hinsehen genügte.
   Scouting war damit nur ein Zahlenmultiplikator, keine Tätigkeit.

   Jetzt gilt:
   · Marktspieler zeigen zunächst nur SCHÄTZUNGEN — Stärke und Potenzial
     als Bereiche.
   · Wer beobachtet wird, wird über mehrere Wochen genauer. Wie schnell,
     hängt an der Scouting-Abteilung: Stufe 1–2 vier Wochen, 3–5 drei,
     6–8 zwei, 9–10 eine.
   · Nicht beobachtete Spieler sind nächste Woche weg. Beobachtete BLEIBEN —
     auch über die geschlossene Transferphase hinweg — und bleiben käuflich,
     weil sie nach jeder Marktauffrischung wieder eingehängt werden.
   · Wer lange beobachtet wird, kann wechselwillig werden: der abgebende
     Verein senkt die Forderung, die Verhandlung wird deutlich leichter.

   Die Merkliste war schon da (CLUB.watchlist) — sie wird hier vom Lesezeichen
   zur Beobachtungsliste ausgebaut.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const CFG = {
    // Wochen bis zur vollen Erkenntnis, Index = Scoutingstufe (0 ungenutzt)
    wochen: [4, 4, 4, 3, 3, 3, 2, 2, 2, 1, 1],
    // Beobachtungsplätze: 5 zu Beginn, alle zwei Ausbaustufen einer mehr,
    // Höchstwert 9. Mit nur drei Plätzen war die Abteilung von Anfang an der
    // Flaschenhals — man konnte kaum vergleichen, sondern nur einzeln prüfen.
    plaetzeBasis: 5,
    plaetzeProZweiStufen: 1,
    plaetzeMax: 9,
    wechselwilligP: 0.07,     // je Woche und beobachtetem Spieler
    ovrUnschaerfe: 5          // ± bei null Erkenntnis
  };
  window.Beobachtung = CFG;

  const stufe = () => { try { return (CLUB.facilities && CLUB.facilities.scouting) || 1; } catch (e) { return 1; } };
  const plaetze = () => Math.min(CFG.plaetzeMax,
    CFG.plaetzeBasis + Math.floor((stufe() - 1) / 2) * CFG.plaetzeProZweiStufen);
  const dauer = () => CFG.wochen[Math.max(0, Math.min(10, stufe()))] || 3;
  const liste = () => { if (!Array.isArray(CLUB.watchlist)) CLUB.watchlist = []; return CLUB.watchlist; };
  const eintrag = (p) => p ? liste().find(w => w.id === (p.id || p)) : null;

  function fortschritt(w) {
    if (!w || !w.ziel) return 0;
    return Math.max(0, Math.min(1, (w.wochen || 0) / w.ziel));
  }
  window.beobachtungsFortschritt = function (p) {
    const w = eintrag(p); return w ? fortschritt(w) : 0;
  };

  // Gehört der Spieler zum Markt (dort wird geschätzt) oder zum eigenen Kader
  // (dort ist alles bekannt)?
  function istMarkt(p) {
    if (!p || !p.id) return false;
    try { if (SQUAD && SQUAD.some(x => x && x.id === p.id)) return false; } catch (e) {}
    try { if (MARKET && MARKET.players && MARKET.players.some(x => x && x.id === p.id)) return true; } catch (e) {}
    return !!eintrag(p);
  }

  // ── Anzeige: Stärke und Potenzial als Schätzung ───────────────────────────
  // potentialDisplay() liefert „OVR (Potenzial)" und wird sowohl in der
  // Marktliste als auch in der Beobachtungsliste benutzt — ein Wrapper genügt.
  const _pd = window.potentialDisplay;
  if (typeof _pd === 'function') {
    window.potentialDisplay = function (p, scoutLevel) {
      if (!p || !istMarkt(p)) return _pd.apply(this, arguments);
      const w = eintrag(p), f = w ? fortschritt(w) : 0;
      if (f >= 1) return p.ovr + ' (' + (p.truePotential || p.ovr) + ')';   // durchleuchtet
      // Stärke: Bereich, der mit dem Fortschritt zusammenläuft
      const oh = Math.max(1, Math.round(CFG.ovrUnschaerfe * (1 - f)));
      const seed = (p.seed || 0), bias = ((seed % 5) - 2);
      const olo = Math.max(35, p.ovr - oh + bias), ohi = Math.min(99, p.ovr + oh + bias);
      // Potenzial: die vorhandene Spannweite, zusätzlich nach Fortschritt verengt
      const r = (typeof potentialRange === 'function')
        ? potentialRange(p, scoutLevel) : { lo: p.ovr, hi: p.ovr, exact: true };
      let plo = r.lo, phi = r.hi;
      if (!r.exact && phi > plo) {
        const mitte = (plo + phi) / 2, halb = (phi - plo) / 2 * (1 - f) + (1 - f);
        plo = Math.round(mitte - halb); phi = Math.round(mitte + halb);
      }
      const pot = (plo >= phi) ? String(plo) : (plo + '-' + phi);
      return olo + '-' + ohi + ' (' + pot + ')';
    };
    try { potentialDisplay = window.potentialDisplay; } catch (e) {}
  }

  // ── Beobachtung starten und beenden ───────────────────────────────────────
  const _tw = window.toggleWatch;
  window.toggleWatch = function (id) {
    const L = liste();
    const i = L.findIndex(w => w.id === id);
    if (i >= 0) { L.splice(i, 1); nachRender(); return; }
    if (L.length >= plaetze()) {
      alert('Deine Scouting-Abteilung kann höchstens ' + plaetze() + ' Spieler gleichzeitig beobachten.\n' +
            'Beende eine Beobachtung oder baue die Abteilung aus.');
      return;
    }
    const p = (typeof MARKET !== 'undefined' && MARKET.players && MARKET.players.find(x => x.id === id))
              || (typeof getPlayer === 'function' ? getPlayer(id) : null);
    if (!p) return;
    // Der VOLLE Spieler wird gesichert, nicht nur Name und Wert: nur so bleibt
    // er nach der nächsten Marktauffrischung noch kauf- und verhandelbar.
    L.push({ id: p.id, name: displayName(p), flag: p.flag, pos: p.pos, value: p.value,
             wochen: 0, ziel: dauer(), seit: (LEAGUE ? LEAGUE.week : 0),
             seitSaison: (LEAGUE ? LEAGUE.season : 1), daten: p });
    if (typeof showToast === 'function') {
      showToast(displayName(p) + ' wird beobachtet — in ' + dauer() +
        (dauer() === 1 ? ' Woche' : ' Wochen') + ' kennst du ihn genau.', 'info');
    }
    nachRender();
  };
  function nachRender() {
    if (typeof renderMarketList === 'function') { try { renderMarketList(); } catch (e) {} }
    if (typeof saveGameState === 'function') { try { saveGameState(); } catch (e) {} }
  }

  // ── Wochentakt ────────────────────────────────────────────────────────────
  function wocheVergeht() {
    const L = liste();
    if (!L.length) return;
    L.forEach(function (w) {
      if (!w.ziel) w.ziel = dauer();
      const vorher = fortschritt(w);
      w.wochen = (w.wochen || 0) + 1;
      const p = w.daten;
      if (vorher < 1 && fortschritt(w) >= 1 && typeof addNews === 'function' && p) {
        addNews('scout', 'Scouting-Bericht: ' + w.name,
          'Unsere Beobachter sind durch: ' + w.name + ' (' + p.age + ', ' + p.pos +
          ') steht bei Stärke ' + p.ovr + ' und hat Potenzial bis ' + (p.truePotential || p.ovr) +
          '. Herkunft: ' + (p.fromClub || 'unbekannt') + '.');
      }
      // Wechselwunsch: je länger beobachtet, desto eher bekommt man mit, dass
      // da einer weg will. Läuft über dieselbe Kennung, die die Verhandlung nutzt.
      if (p && !w.wechselwillig && Math.random() < CFG.wechselwilligP) {
        w.wechselwillig = true;
        if (!p._npc) p._npc = {};
        p._npc.unsettled = true;
        if (typeof addNews === 'function') {
          addNews('scout', w.name + ' will weg',
            'Unsere Beobachter melden Unruhe: ' + w.name + ' drängt bei ' + (p.fromClub || 'seinem Verein') +
            ' auf einen Wechsel. Die Forderung dürfte spürbar sinken.');
        }
      }
    });
    marktAuffuellen();
  }

  // Beobachtete Spieler nach jeder Auffrischung wieder in den Markt hängen —
  // dadurch funktionieren Kauf, Leihe und Verhandlung ohne jede Sonderbehandlung.
  function marktAuffuellen() {
    if (typeof MARKET === 'undefined' || !MARKET || !Array.isArray(MARKET.players)) return;
    liste().forEach(function (w) {
      if (!w.daten) return;
      if (!MARKET.players.some(p => p.id === w.id)) {
        w.daten._beobachtet = true;
        MARKET.players.push(w.daten);
      }
    });
  }
  window.beobachteteInMarkt = marktAuffuellen;

  if (typeof window.refreshMarketForWeek === 'function') {
    const _rm = window.refreshMarketForWeek;
    window.refreshMarketForWeek = function () {
      const r = _rm.apply(this, arguments);
      try { marktAuffuellen(); } catch (e) { console.warn('[Beobachtung]', e); }
      return r;
    };
    try { refreshMarketForWeek = window.refreshMarketForWeek; } catch (e) {}
  }
  if (typeof window.advanceCalendarWeek === 'function') {
    const _aw = window.advanceCalendarWeek;
    window.advanceCalendarWeek = function () {
      const r = _aw.apply(this, arguments);
      if (r !== false) { try { wocheVergeht(); } catch (e) { console.warn('[Beobachtung]', e); } }
      return r;
    };
    try { advanceCalendarWeek = window.advanceCalendarWeek; } catch (e) {}
  }

  // Gekaufte Spieler von der Liste nehmen
  ['buyPlayer', 'loanInPlayer'].forEach(function (fn) {
    if (typeof window[fn] !== 'function') return;
    const _o = window[fn];
    window[fn] = function (id) {
      const vorher = (typeof SQUAD !== 'undefined' ? SQUAD.length : 0);
      const r = _o.apply(this, arguments);
      try {
        if ((typeof SQUAD !== 'undefined' ? SQUAD.length : 0) > vorher) {
          const L = liste(); const i = L.findIndex(w => w.id === id);
          if (i >= 0) L.splice(i, 1);
        }
      } catch (e) {}
      return r;
    };
    try { window[fn] = window[fn]; } catch (e) {}
  });

  // ── Beobachtungsliste im Transfermarkt ────────────────────────────────────
  function css() {
    if (document.getElementById('beo-css')) return;
    const st = document.createElement('style'); st.id = 'beo-css';
    st.textContent = `.beo-box{background:var(--bg3,#21262d);border:1px solid var(--border,#30363d);
      border-radius:9px;padding:10px;margin-bottom:10px}
    .beo-kopf{font:700 12px/1 sans-serif;color:var(--text,#e6edf3);margin-bottom:3px}
    .beo-hint{font-size:10px;color:var(--text3,#6e7681);margin-bottom:8px}
    .beo-row{display:flex;align-items:center;gap:7px;padding:7px 0;border-top:1px solid var(--border,#30363d)}
    .beo-n{flex:1;font-size:12px;color:var(--text,#e6edf3)}
    .beo-m{font-size:10px;color:var(--text2,#8b949e)}
    .beo-bar{height:4px;border-radius:3px;background:var(--bg2,#161b22);margin-top:4px;overflow:hidden}
    .beo-fill{height:100%;background:var(--blue,#388bfd)}
    .beo-fill.fertig{background:var(--accent,#3fb950)}
    .beo-will{color:var(--gold,#f2c14e);font-weight:700}`;
    document.head.appendChild(st);
  }

  function box() {
    const L = liste();
    const ziel = document.getElementById('tr-sub-markt');
    if (!ziel) return;
    const alt = ziel.querySelector('.watchlist-box'); if (alt) alt.remove();
    if (!L.length) return;
    css();
    const zeilen = L.map(function (w) {
      const p = w.daten || w;
      const f = fortschritt(w), pct = Math.round(f * 100);
      const drin = (typeof MARKET !== 'undefined' && MARKET.players) && MARKET.players.some(x => x.id === w.id);
      const wert = p.value != null ? p.value : w.value;
      const kaufbar = drin && (typeof isTransferWindowOpen !== 'function' || isTransferWindowOpen());
      const rest = Math.max(0, (w.ziel || dauer()) - (w.wochen || 0));
      return '<div class="beo-row"><div class="beo-n">' +
        (w.flag ? w.flag + ' ' : '') + w.name +
        (w.wechselwillig ? ' <span class="beo-will">will weg</span>' : '') +
        '<div class="beo-m">' + (typeof potentialDisplay === 'function' ? potentialDisplay(p, stufe()) : p.ovr) +
        ' · ' + (p.fromClub || '') + ' · ' +
        (f >= 1 ? 'vollständig durchleuchtet' : 'noch ' + rest + (rest === 1 ? ' Woche' : ' Wochen')) + '</div>' +
        '<div class="beo-bar"><div class="beo-fill' + (f >= 1 ? ' fertig' : '') + '" style="width:' + pct + '%"></div></div>' +
        '</div><div style="text-align:right"><div style="font-size:11.5px">' +
        (typeof formatEuro === 'function' ? formatEuro(wert) : wert) + '</div></div>' +
        (kaufbar ? '<button class="mkt-btn" onclick="buyPlayer(\'' + w.id + '\')">Kaufen</button>'
                 : '<span style="font-size:10px;color:var(--text3)">Fenster zu</span>') +
        '<button class="mkt-btn secondary" title="Beobachtung beenden" onclick="toggleWatch(\'' + w.id + '\')">✕</button></div>';
    }).join('');
    const d = document.createElement('div');
    d.className = 'beo-box';
    d.innerHTML = '<div class="beo-kopf">🔭 Beobachtung (' + L.length + '/' + plaetze() + ')</div>' +
      '<div class="beo-hint">Beobachtete Spieler bleiben dir erhalten, auch wenn der Markt wechselt — ' +
      'alle anderen sind nächste Woche weg. Volle Erkenntnis nach ' + dauer() +
      (dauer() === 1 ? ' Woche' : ' Wochen') + ' bei Scouting-Stufe ' + stufe() + '.</div>' + zeilen;
    ziel.insertBefore(d, ziel.firstChild);
  }

  if (typeof window.renderMarketList === 'function') {
    const _rl = window.renderMarketList;
    window.renderMarketList = function () {
      const r = _rl.apply(this, arguments);
      try { box(); } catch (e) { console.warn('[Beobachtung]', e); }
      return r;
    };
    try { renderMarketList = window.renderMarketList; } catch (e) {}
  }

  // ── Automatisch zur Zeitung nach dem Wochenwechsel ────────────────────────
  // Die Ausgabe steht ohnehin für jede Woche fest — sie ungelesen liegen zu
  // lassen wäre schade. Nach dem Wochensprung wird sie automatisch geöffnet,
  // sofern der Nutzer das nicht abgeschaltet hat.
  (function () {
    function zeitungAn() {
      try { return !(CLUB.settings && CLUB.settings.zeitungAuto === false); } catch (e) { return true; }
    }
    window.toggleZeitungAuto = function () {
      const st = (CLUB.settings = CLUB.settings || {});
      st.zeitungAuto = !zeitungAn();
      const b = document.getElementById('mgmt-zeitung-btn');
      if (b) b.innerHTML = '<i class="ti ti-news" aria-hidden="true"></i> Zeitung nach der Woche: ' + (zeitungAn() ? 'an' : 'aus');
      if (typeof showToast === 'function') {
        showToast(zeitungAn() ? 'Die Zeitung öffnet sich nach jedem Wochenwechsel.'
                              : 'Die Zeitung öffnet sich nicht mehr automatisch.', 'info');
      }
      try { if (typeof saveGameState === 'function') saveGameState(); } catch (e) {}
    };
    window.__zeitungBtnAuffrischen = function () {
      const b = document.getElementById('mgmt-zeitung-btn');
      if (b) b.innerHTML = '<i class="ti ti-news" aria-hidden="true"></i> Zeitung nach der Woche: ' + (zeitungAn() ? 'an' : 'aus');
    };

    if (typeof window.advanceCalendarWeek !== 'function') return;
    const _aw = window.advanceCalendarWeek;
    window.advanceCalendarWeek = function () {
      const r = _aw.apply(this, arguments);
      // Saisonende (false) hat einen eigenen Ablauf — da nicht dazwischenfunken.
      if (r === false || !zeitungAn()) return r;
      try {
        setTimeout(function () {
          // Nicht aufdrängen, wenn gerade ein Spiel läuft oder ein Fenster offen ist.
          if (document.getElementById('m2d-ov') || document.getElementById('hz-ov') ||
              document.getElementById('ma-ov') || document.querySelector('.contract-overlay') ||
              document.getElementById('clubnego-overlay')) return;
          if (typeof switchAppView === 'function') {
            // Der Nav-Knopf hat eine feste id — darüber wird er auch optisch aktiv.
            switchAppView('zeitung', document.getElementById('nav-zeitung'));
          }
        }, 260);
      } catch (e) {}
      return r;
    };
    try { advanceCalendarWeek = window.advanceCalendarWeek; } catch (e) {}
    window.addEventListener('load', function () {
      setTimeout(function () { try { window.__zeitungBtnAuffrischen(); } catch (e) {} }, 900);
    });
  })();

  console.log('%c[Beobachtung v1] aktiv', 'color:#3fb950;font-weight:bold',
    '— Marktspieler werden geschätzt, Beobachtung deckt sie über Wochen auf');
})();
