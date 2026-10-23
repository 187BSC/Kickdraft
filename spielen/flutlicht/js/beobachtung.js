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