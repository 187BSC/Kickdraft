;
;/* ── js/match_analyse.js ── */
/* ═══════════════════════════════════════════════════════════════════════════
   SPIELANALYSE  ·  v1
   ─────────────────────────────────────────────────────────────────────────
   Die Engine zeichnet jedes Spiel Bild für Bild auf — 22 Positionen, Ballort,
   Ballführender, Uhr, Pressing. Bisher wurde das nach der Taktikansicht
   weggeworfen. Hier wird es ausgewertet:

   · Ballhäufigkeit als Wärmebild (wo lag der Ball, gewichtet nach Zeit)
   · Aufbau über links / Mitte / rechts, gemessen im eigenen Ballbesitz
   · Feldaufteilung: eigenes Drittel, Mittelfeld, letztes Drittel
   · Ballverluste — wo genau der Ball verloren ging

   Damit werden die Taktikregler zum ersten Mal sichtbar: man stellt sie ein
   und sieht hinterher, was sie bewirkt haben.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const L = 105, B = 68;              // Feldmaße wie in der Engine
  const SPALTEN = 12, ZEILEN = 8;     // Raster des Wärmebilds

  function esc(x) { return String(x == null ? '' : x).replace(/[<>&]/g, function (c) {
    return ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c]; }); }

  // ── Auswertung ─────────────────────────────────────────────────────────────
  function auswerten(R) {
    if (!R || !R.frames || !R.frameCount) return null;
    const F = R.frames, S = R.stride, n = R.frameCount;
    const raster = new Float32Array(SPALTEN * ZEILEN);
    const drittel = [0, 0, 0];          // eigenes · Mittelfeld · letztes
    const bahn = [0, 0, 0];             // links · Mitte · rechts (eigener Besitz)
    const verluste = [];
    let eigen = 0, fremd = 0, offen = 0, letzterBesitz = -1, maxZelle = 0;

    for (let i = 0; i < n - 1; i++) {
      const o = i * S;
      const dt = F[(i + 1) * S + 47] - F[o + 47];
      if (!(dt > 0) || dt > 5) continue;             // Unterbrechungen raus
      const bx = F[o + 44], by = F[o + 45];
      const halter = F[o + 46];
      const team = halter < 0 ? -1 : (halter < 11 ? 0 : 1);

      // Wärmebild
      const sx = Math.min(SPALTEN - 1, Math.max(0, Math.floor(bx / L * SPALTEN)));
      const sy = Math.min(ZEILEN - 1, Math.max(0, Math.floor(by / B * ZEILEN)));
      const z = sy * SPALTEN + sx;
      raster[z] += dt;
      if (raster[z] > maxZelle) maxZelle = raster[z];

      if (team === 0) eigen += dt; else if (team === 1) fremd += dt; else offen += dt;

      // Feldaufteilung immer, Bahnen nur im eigenen Ballbesitz — sonst misst
      // man die Angriffe des Gegners mit.
      if (bx < L / 3) drittel[0] += dt;
      else if (bx < L * 2 / 3) drittel[1] += dt;
      else drittel[2] += dt;
      if (team === 0) {
        if (by < B / 3) bahn[0] += dt;
        else if (by < B * 2 / 3) bahn[1] += dt;
        else bahn[2] += dt;
      }

      // Ballverlust: Besitz wechselt von uns zum Gegner
      if (letzterBesitz === 0 && team === 1) verluste.push({ x: bx, y: by, t: F[o + 47] });
      if (team >= 0) letzterBesitz = team;
    }

    const gesamt = eigen + fremd + offen || 1;
    const bs = bahn[0] + bahn[1] + bahn[2] || 1;
    const dr = drittel[0] + drittel[1] + drittel[2] || 1;
    // Ballverluste nach Feldzone: gefährlich sind die im eigenen Drittel.
    let hinten = 0, mitte = 0, vorn = 0;
    verluste.forEach(function (v) {
      if (v.x < L / 3) hinten++; else if (v.x < L * 2 / 3) mitte++; else vorn++;
    });

    return {
      raster: raster, maxZelle: maxZelle || 1,
      // Ballbesitz aus der Engine-Statistik übernehmen, wenn sie vorliegt: die
      // Analyse darf keine andere Zahl nennen als der Spielbericht. Nur wenn
      // sie fehlt, wird sie aus der Aufzeichnung geschätzt.
      besitz: (R.stats && R.stats.home && R.stats.home.possPct != null)
              ? R.stats.home.possPct
              : Math.round(eigen / (eigen + fremd || 1) * 100),
      drittel: drittel.map(function (x) { return Math.round(x / dr * 100); }),
      bahn: bahn.map(function (x) { return Math.round(x / bs * 100); }),
      verluste: verluste, verlustZonen: { hinten: hinten, mitte: mitte, vorn: vorn },
      dauer: Math.round(F[(n - 1) * S + 47]),
      namen: R.namen || ['Wir', 'Gegner']
    };
  }

  // ── Darstellung ────────────────────────────────────────────────────────────
  function css() {
    if (document.getElementById('ma-css')) return;
    const st = document.createElement('style'); st.id = 'ma-css';
    st.textContent = `#ma-ov{position:fixed;inset:0;z-index:9650;background:rgba(0,0,0,.82);
      display:flex;align-items:center;justify-content:center;padding:12px}
    .ma-k{background:var(--bg2,#161b22);border:1px solid var(--border,#30363d);border-radius:14px;
      width:100%;max-width:520px;max-height:94vh;overflow:auto;padding:16px}
    .ma-t{font:800 16px/1.2 sans-serif;color:var(--text,#e6edf3)}
    .ma-s{font-size:11.5px;color:var(--text2,#8b949e);margin-bottom:12px}
    .ma-h{font:700 11px/1 sans-serif;letter-spacing:.5px;text-transform:uppercase;
      color:var(--text3,#6e7681);margin:16px 0 7px}
    .ma-cv{width:100%;border-radius:9px;display:block;background:#123d20}
    .ma-leg{display:flex;justify-content:space-between;font-size:10.5px;color:var(--text3,#6e7681);margin-top:5px}
    .ma-bal{display:flex;height:26px;border-radius:7px;overflow:hidden;margin-bottom:5px}
    .ma-bal span{display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#06240f}
    .ma-zeile{display:flex;justify-content:space-between;font-size:12.5px;color:var(--text,#e6edf3);
      padding:6px 0;border-bottom:1px solid var(--border,#30363d)}
    .ma-zeile b{color:var(--gold,#f2c14e)}
    .ma-x{width:100%;margin-top:16px;padding:11px;border-radius:9px;border:1px solid var(--border,#30363d);
      background:var(--bg3,#21262d);color:var(--text,#e6edf3);font-size:13px;cursor:pointer}`;
    document.head.appendChild(st);
  }

  // Wärmebild + Ballverluste auf ein Canvas zeichnen
  function malen(cv, A, modus) {
    const g = cv.getContext('2d'); if (!g) return;
    const W = cv.width, H = cv.height;
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#123d20'; g.fillRect(0, 0, W, H);

    if (modus === 'hitze') {
      const zw = W / SPALTEN, zh = H / ZEILEN;
      for (let y = 0; y < ZEILEN; y++) {
        for (let x = 0; x < SPALTEN; x++) {
          const v = A.raster[y * SPALTEN + x] / A.maxZelle;
          if (v <= 0.02) continue;
          // grün → gelb → rot, je länger der Ball dort lag
          const t = Math.pow(v, 0.65);
          const r = Math.round(60 + 195 * Math.min(1, t * 1.4));
          const gr = Math.round(190 - 120 * Math.max(0, t - 0.35));
          g.fillStyle = 'rgba(' + r + ',' + gr + ',60,' + (0.18 + t * 0.66).toFixed(3) + ')';
          g.fillRect(x * zw, y * zh, zw + 0.6, zh + 0.6);
        }
      }
    } else {
      A.verluste.forEach(function (v) {
        const x = v.x / L * W, y = v.y / B * H;
        g.fillStyle = v.x < L / 3 ? 'rgba(248,81,73,.85)' : 'rgba(242,193,78,.75)';
        g.beginPath(); g.arc(x, y, 3.4, 0, 6.283); g.fill();
      });
    }

    // Feldlinien darüber
    g.strokeStyle = 'rgba(255,255,255,.34)'; g.lineWidth = 1.4;
    g.strokeRect(1, 1, W - 2, H - 2);
    g.beginPath(); g.moveTo(W / 2, 0); g.lineTo(W / 2, H); g.stroke();
    g.beginPath(); g.arc(W / 2, H / 2, H * 0.135, 0, 6.283); g.stroke();
    const sr = H * 0.58, st = (H - sr) / 2, sb = W * 0.155;
    g.strokeRect(1, st, sb, sr); g.strokeRect(W - 1 - sb, st, sb, sr);
    // Drittel-Markierungen
    g.strokeStyle = 'rgba(255,255,255,.14)';
    g.beginPath(); g.moveTo(W / 3, 0); g.lineTo(W / 3, H);
    g.moveTo(W * 2 / 3, 0); g.lineTo(W * 2 / 3, H); g.stroke();
  }

  let AKT = null, MODUS = 'hitze';

  window.showMatchAnalyse = function () {
    const A = auswerten(window.LAST_MATCH_2D);
    if (!A) {
      if (typeof showToast === 'function') showToast('Für dieses Spiel gibt es keine Aufzeichnung — die räumliche Engine muss aktiv sein.', 'warn');
      return;
    }
    AKT = A; MODUS = 'hitze';
    css();
    let ov = document.getElementById('ma-ov');
    if (!ov) { ov = document.createElement('div'); ov.id = 'ma-ov'; document.body.appendChild(ov); }

    const bal = function (werte, farben, beschriftung) {
      return '<div class="ma-bal">' + werte.map(function (v, i) {
        return '<span style="width:' + Math.max(0, v) + '%;background:' + farben[i] + '">' +
          (v >= 12 ? v + ' %' : '') + '</span>';
      }).join('') + '</div><div class="ma-leg">' +
        beschriftung.map(function (b) { return '<span>' + b + '</span>'; }).join('') + '</div>';
    };
    const vz = A.verlustZonen;

    ov.innerHTML = '<div class="ma-k">' +
      '<div class="ma-t">Spielanalyse</div>' +
      '<div class="ma-s">' + Math.round(A.dauer / 60) + ' Minuten · Angriff nach rechts</div>' +

      '<div class="ma-h">Wo lag der Ball</div>' +
      '<canvas class="ma-cv" id="ma-cv" width="520" height="337"></canvas>' +
      '<div class="ma-bal" style="margin-top:8px">' +
        '<span style="width:50%;background:var(--bg3,#21262d);color:var(--text,#e6edf3);cursor:pointer" onclick="maModus(\'hitze\')" id="ma-m1">Wärmebild</span>' +
        '<span style="width:50%;background:var(--bg3,#21262d);color:var(--text,#e6edf3);cursor:pointer" onclick="maModus(\'verlust\')" id="ma-m2">Ballverluste</span>' +
      '</div>' +

      '<div class="ma-h">Ballbesitz</div>' +
      bal([A.besitz, 100 - A.besitz], ['var(--accent,#3fb950)', 'var(--bg3,#21262d)'],
          [esc(A.namen[0]), esc(A.namen[1])]) +

      '<div class="ma-h">Wo das Spiel stattfand</div>' +
      bal(A.drittel, ['#f85149', '#f2c14e', 'var(--accent,#3fb950)'],
          ['eigenes Drittel', 'Mittelfeld', 'letztes Drittel']) +

      '<div class="ma-h">Aufbau über … (im eigenen Ballbesitz)</div>' +
      bal(A.bahn, ['#58a6ff', '#8b949e', '#58a6ff'], ['links', 'Mitte', 'rechts']) +

      '<div class="ma-h">Ballverluste</div>' +
      '<div class="ma-zeile"><span>insgesamt</span><b>' + A.verluste.length + '</b></div>' +
      '<div class="ma-zeile"><span>im eigenen Drittel</span><b>' + vz.hinten + '</b></div>' +
      '<div class="ma-zeile"><span>im Mittelfeld</span><b>' + vz.mitte + '</b></div>' +
      '<div class="ma-zeile"><span>im letzten Drittel</span><b>' + vz.vorn + '</b></div>' +

      '<button class="ma-x" onclick="closeMatchAnalyse()">Schließen</button>' +
      '</div>';

    const cv = document.getElementById('ma-cv');
    if (cv) malen(cv, A, MODUS);
    markiere();
  };

  function markiere() {
    const a = document.getElementById('ma-m1'), b = document.getElementById('ma-m2');
    if (!a || !b) return;
    a.style.background = MODUS === 'hitze' ? 'var(--gold,#f2c14e)' : 'var(--bg3,#21262d)';
    a.style.color = MODUS === 'hitze' ? '#06240f' : 'var(--text,#e6edf3)';
    b.style.background = MODUS === 'verlust' ? 'var(--gold,#f2c14e)' : 'var(--bg3,#21262d)';
    b.style.color = MODUS === 'verlust' ? '#06240f' : 'var(--text,#e6edf3)';
  }
  window.maModus = function (m) {
    MODUS = m;
    const cv = document.getElementById('ma-cv');
    if (cv && AKT) malen(cv, AKT, MODUS);
    markiere();
  };
  window.closeMatchAnalyse = function () {
    const ov = document.getElementById('ma-ov'); if (ov) ov.remove();
    AKT = null;
  };
  window.matchAnalyseDaten = function () { return auswerten(window.LAST_MATCH_2D); };

  // Knopf unter „Spiel simulieren“ hängen (früher neben der Taktikansicht, die
  // 2026-10-09 ausgebaut wurde); engine_v3_adapter.js ruft das nach dem Abpfiff auf.
  window.zeigeAnalyseKnopf = function () {
    if (!window.LAST_MATCH_2D || document.getElementById('ma-open')) return;
    const sim = document.getElementById('sim-btn');
    if (!sim || !sim.parentNode) return;
    const b = document.createElement('button');
    b.className = 'ko-btn'; b.id = 'ma-open'; b.style.marginTop = '8px';
    b.innerHTML = '<i class="ti ti-chart-histogram" aria-hidden="true"></i> Spielanalyse';
    b.onclick = window.showMatchAnalyse;
    sim.parentNode.appendChild(b);
  };

  console.log('%c[Spielanalyse v1] aktiv', 'color:#3fb950;font-weight:bold',
    '— Wärmebild, Feldaufteilung und Ballverluste aus der Aufzeichnung');
})();
;/* ── js/transfermarkt_balance.js ── */
/* ═══════════════════════════════════════════════════════════════════════════
   TRANSFERMARKT-BALANCE  ·  v1
   ─────────────────────────────────────────────────────────────────────────
   Lädt ganz zuletzt — damit die Wrapper NACH allen anderen Preis-Patches
   greifen (PriceBalance v3, Unzufriedenheits-Abschlag, RealMarket).

   1) MARKTWERT ab OVR 60 angehoben (Grundkurve 700 × 1,225^(OVR−40) war
      im Bereich 60–80 zu flach), plus Aufschlag für ungenutztes Potenzial.
   2) FREE AGENTS verlangen HANDGELD aus der Kasse und ein höheres Gehalt.
   3) Niveau-Sperre auch für Free Agents.
   DFL: Markt, Verkauf und Transferfenster sind entfernt (D36).
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
  // DFL D78 (dfl_scouting_patch.js): fremde Spieler ohne Scout-Bericht nur mit Stufe, Potenzial „?“
  const SC = () => (window.DFLScouting && window.DFLScouting.aktiv && window.DFLScouting.aktiv()) ? window.DFLScouting : null;

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
  // DFL: eine Liga, keine Niveau-Sperre mehr (transfer_plausibility entfernt, D36)
  function niveau() { return { ok: true, premium: 1, over: 0 }; }

  // ── 3. ABLÖSEFREIE: Gehalt + Handgeld ────────────────────────────────────
  function faPool() {
    try { if (window.FreeAgents && FreeAgents.pool) return FreeAgents.pool(); } catch (e) {}
    try { return (CLUB && CLUB.freeAgents) || []; } catch (e) { return []; }
  }
  try { if (window.FreeAgents && FreeAgents.CFG) FreeAgents.CFG.wagePremium = CFG.faGehaltBasis; } catch (e) {}

  function faGehalt(p, jahre) {
    jahre = Math.max(1, jahre | 0);
    // DFL (D40): Konditionen wie bei der KI (Forderung, Laufzeit, Handgeld-Anteil)
    const dfl = (typeof window.dflFaKonditionen === 'function') ? window.dflFaKonditionen(p, jahre) : null;
    if (dfl) return dfl.gehalt;
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
    const dfl = (typeof window.dflFaKonditionen === 'function') ? window.dflFaKonditionen(p, jahre) : null;
    if (dfl) return dfl.handgeld;
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

      // Ein Spieler dieser Klasse unterschreibt nicht in dieser Liga —
      // ablösefrei hin oder her.
      const chk = niveau(p);
      if (!chk.ok) { alert('🚫 ' + chk.reason); return; }

      if (jahre == null) { vertragsDialog(p); return; }
      const maxY = (typeof MAX_CONTRACT_YEARS !== 'undefined') ? MAX_CONTRACT_YEARS : 5;
      jahre = Math.max(1, Math.min(maxY, jahre | 0));

      const gehalt = faGehalt(p, jahre), handgeld = faHandgeld(p, jahre);
      // DFL (D41): Handgeld läuft in Raten über den Cap Hit – keine Barzahlung, keine Kassenprüfung
      const inRaten = typeof window.dflHandgeldInRaten === 'function' && window.dflHandgeldInRaten();
      if (!inRaten && ((CLUB && CLUB.budget) || 0) < handgeld) {
        alert('Das Handgeld ist nicht gedeckt: ' + zeigeName(p) + ' verlangt ' + euro(handgeld) +
              ' bei Unterschrift. In der Kasse: ' + euro((CLUB && CLUB.budget) || 0) + '.');
        return;
      }
      // Forderung festschreiben, damit die Original-Funktion damit rechnet.
      p.faWageDemand = gehalt; p.wage = gehalt;

      const vorher = pool.length;
      _origSign.call(this, faId, jahre);
      if (pool.length >= vorher) return;         // abgebrochen (z.B. Kader voll)

      if (!inRaten) CLUB.budget = (CLUB.budget || 0) - handgeld;
      try {
        // Der Eintrag der Original-Funktion steht als „buy" mit Ablöse 0 vorn —
        // dort das Handgeld eintragen, damit die Transferbilanz stimmt.
        const h = CLUB.transferHistory;
        if (Array.isArray(h) && h[0] && h[0].type === 'buy' && !h[0].amount) h[0].amount = handgeld;
      } catch (e) {}
      if (typeof addNews === 'function') {
        if (inRaten) addNews('transfer', '✍️ Free Agent: ' + p.name,
          zeigeName(p) + ' unterschreibt für ' + jahre + (jahre === 1 ? ' Jahr' : ' Jahre') + ': Gehalt ' + euro(gehalt) + '/Woche, Handgeld ' +
          euro(handgeld) + ' (läuft in Raten über den Cap Hit).');
        else addNews('transfer', 'Handgeld: ' + euro(handgeld) + ' für ' + p.name,
          zeigeName(p) + ' unterschreibt ablösefrei — dafür fließen ' + euro(handgeld) +
          ' Handgeld aus der Kasse, das Gehalt liegt bei ' + euro(gehalt) +
          '/Woche. Restbudget: ' + euro(CLUB.budget) + '.');
      }
      if (typeof showToast === 'function') showToast(inRaten ? zeigeName(p) + ' unterschreibt.' : 'Handgeld ' + euro(handgeld) + ' gezahlt.', 'money');
      if (typeof renderTransferTab === 'function') renderTransferTab();
      if (typeof updateUI === 'function') updateUI();
      if (typeof saveGameState === 'function') saveGameState();
    };
    try { signFreeAgent = window.signFreeAgent; } catch (e) {}
  }

  window.__signFA = function (id, y, staffel) {
    const ov = document.querySelector('.contract-overlay');
    if (ov) ov.remove();
    window.signFreeAgent(id, y, staffel);
  };
  // DFL (D87): andere Vorlage gewählt – Dialog mit derselben Laufzeitliste neu zeichnen
  window.__faStaffel = function (id, staffel) {
    const ov = document.querySelector('.contract-overlay');
    if (ov) ov.remove();
    const p = faPool().find(x => x && x.id === id);
    if (p) vertragsDialog(p, staffel);
  };

  // ── Vertragsdialog ───────────────────────────────────────────────────────
  function vertragsDialog(p, staffel) {
    const maxY = (typeof MAX_CONTRACT_YEARS !== 'undefined') ? MAX_CONTRACT_YEARS : 5;
    const chk = niveau(p);
    const ov = document.createElement('div');
    ov.className = 'contract-overlay';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px';
    let rows = '';
    // DFL: Konditionen mit der gewählten Vorlage (D87: gleich/steigend/fallend, ohne Wahl der Wunsch des Spielers)
    const dflK = y => (typeof window.dflFaKonditionen === 'function') ? window.dflFaKonditionen(p, y, staffel) : null;
    const k2 = dflK(2), st = k2 && k2.staffel ? k2.staffel : null;
    for (let y = 1; y <= maxY; y++) {
      const k = dflK(y), w = k ? k.gehalt : faGehalt(p, y), hg = k ? k.handgeld : faHandgeld(p, y);
      // Cap Hit im letzten Jahr (steigend/fallend): „11,8 → 15,2 Mio €“
      const by = k && k.vertrag && k.vertrag.base_salary_by_year, hitEnde = by && by.length ? by[by.length - 1] + (k.vertrag.signing_bonus_total || 0) / Math.max(1, k.vertrag.years_total) : 0;
      const capText = k ? (Math.abs(hitEnde - k.capHit) >= 5e4 ? euro(k.capHit).replace(/ Mio €$/, '') + ' → ' + euro(hitEnde) : euro(k.capHit)) : '';
      // DFL: voller Cap Hit (Gehalt + Handgeld ÷ Jahre) muss unter den Cap passen; Handgeld läuft in Raten
      const lohnOk = k ? ((CLUB && CLUB.wageBudget) || 0) * 52 >= k.capHit : ((CLUB && CLUB.wageBudget) || 0) >= w;
      const geldOk = k ? true : ((CLUB && CLUB.budget) || 0) >= hg;
      const ok = lohnOk && geldOk;
      const warn = ok ? '' : (!lohnOk ? 'Cap-Platz zu klein' : 'Kasse zu klein');
      rows += '<button class="contract-year-btn" ' + (ok ? '' : 'disabled') +
        ' onclick="__signFA(\'' + p.id + '\',' + y + (st ? ',\'' + st + '\'' : '') + ')"' +
        ' style="display:flex;justify-content:space-between;align-items:center;width:100%;padding:10px 12px;margin-bottom:6px;border-radius:8px;border:1px solid var(--border,#30363d);background:' +
        (ok ? 'var(--bg3,#21262d)' : 'var(--bg2,#161b22)') + ';color:var(--text,#e6edf3);cursor:' +
        (ok ? 'pointer' : 'not-allowed') + ';opacity:' + (ok ? 1 : .5) + '">' +
        '<span><b>' + y + (y === 1 ? ' Jahr' : ' Jahre') + '</b> · bis ' +
        // DFL: contractUntil = Saison + Jahre − 1 (dfl_vertraege_patch.js), die laufende Saison zählt mit
        (typeof seasonEndYear === 'function' ? seasonEndYear(LEAGUE.season + y - (k ? 1 : 0)) : (LEAGUE.season + y - (k ? 1 : 0))) +
        (warn ? '<br><span style="font-size:10px;color:#f85149">' + warn + '</span>' : '') + '</span>' +
        '<span style="text-align:right"><b style="color:var(--gold,#f2c14e)">' + euro(hg) + '</b> Handgeld' +
        '<br><span style="font-size:11px;color:var(--text2,#8b949e)">' + euro(w) + '/Woche' + (k ? ' · Cap Hit ' + capText + '/Jahr' : '') + '</span></span></button>';
    }
    const hinweis = chk.premium > 1
      ? '<div style="font-size:11px;color:var(--gold,#f2c14e);margin-bottom:10px">Überzeugungsprämie: ' +
        zeigeName(p) + ' ist eigentlich eine Klasse zu gut für diese Liga — Gehalt und Handgeld liegen deshalb um ' +
        Math.round((chk.premium - 1) * 100) + ' % höher.</div>'
      : '';
    ov.innerHTML = '<div style="background:var(--bg2,#161b22);border:1px solid var(--border,#30363d);border-radius:12px;max-width:440px;width:100%;padding:20px">' +
      '<div style="font-size:15px;font-weight:700;margin-bottom:4px">' + (dflK(2) ? 'Verpflichten: ' : 'Ablösefrei verpflichten: ') +
      (p.flag ? p.flag + ' ' : '') + zeigeName(p) + '</div>' +
      '<div style="font-size:12px;color:var(--text2,#8b949e);margin-bottom:6px">' + p.age + ' J · ' +
      (typeof positionsDisplay === 'function' ? positionsDisplay(p) : p.pos) + (SC() ? ' · Stärke ' + SC().staerkeText(p) : ' · OVR ' + p.ovr) + ' · ' +
      (p.fromClub || 'vereinslos') + '</div>' +
      '<div style="font-size:11px;color:var(--text3,#6e7681);margin-bottom:12px">' + (dflK(2)
        ? 'Gehalt plus <b>Handgeld</b> (in Raten über die Laufzeit) – wähle die Laufzeit:'
        : 'Keine Ablöse — dafür verlangt der Spieler ein einmaliges <b>Handgeld</b> aus der Kasse und ein höheres Gehalt. Wähle die Laufzeit:') + '</div>' +
      hinweis + (st ? '<div style="font-size:11px;color:var(--text3,#6e7681);margin:0 0 5px">Verteilung über die Jahre – die Gesamtsumme bleibt:</div>' +
        '<div class="sw-segment fa-staffel" role="group" aria-label="Verteilung über die Jahre" style="margin-bottom:10px">' +
        ['gleich', 'steigend', 'fallend'].map(s => '<button type="button" aria-pressed="' + (s === st) + '" onclick="__faStaffel(\'' + p.id + '\',\'' + s + '\')">' + s +
          (s === k2.wunsch ? '<small>Wunsch</small>' : '') + '</button>').join('') + '</div>' : '') + rows +
      '<button onclick="this.closest(\'.contract-overlay\').remove()" style="width:100%;padding:9px;margin-top:6px;border-radius:8px;border:1px solid var(--border,#30363d);background:transparent;color:var(--text2,#8b949e);cursor:pointer">Abbrechen</button>' +
      '</div>';
    document.body.appendChild(ov);
  }

  // ── Liste der Ablösefreien ───────────────────────────────────────────────
  function renderFrei() {
    const el = document.getElementById('tr-sub-frei');
    if (!el) return;
    const pool = faPool();
    if (!pool.length) {
      el.innerHTML = '<div style="color:var(--text3);font-size:11px;padding:12px">Aktuell keine Free Agents verfügbar. Nach der Saison und während der Vorbereitung kommen neue dazu.</div>';
      return;
    }
    const scout = (CLUB.facilities && CLUB.facilities.scouting) || 1;
    // D78: ohne Scout-Bericht nach der groben Sicht des Scoutings sortieren (das echte Potenzial verriete Nieten, D103)
    const sorted = SC() ? pool.map(p => ({ p, k: SC().sortWert(p) })).sort((a, b) => b.k - a.k).map(x => x.p)
      : pool.slice().sort((a, b) =>
        (b.ovr + (b.truePotential || 0) * 0.2) - (a.ovr + (a.truePotential || 0) * 0.2));
    const dflListe = typeof window.dflFaKonditionen === 'function' && typeof window.dflHandgeldInRaten === 'function' && window.dflHandgeldInRaten();
    // D111/D112 (dfl_ebenen_patch.js): Stil-Zeichen am Namen, Filter „passt zu meinem Stil“, am Handy Zeile → Blatt (Knöpfe dort)
    const E = window.DFLEbenen && window.DFLEbenen.zeichenHtml ? window.DFLEbenen : null;
    const stilN = E ? sorted.filter(p => E.passtZuMir(p)).length : 0;
    // D136: Liste auf eine Position gefiltert (Kaderschnitt → „Alle freien Torhüter“), Chip hebt den Filter auf
    const nurPos = window.DFLKader && DFLKader.faPos ? DFLKader.faPos() : null;
    const gezeigt = (E && E.filter('fa') ? sorted.filter(p => E.passtZuMir(p)) : sorted).filter(p => !nurPos || p.pos === nurPos);
    const posChip = nurPos ? ' <button type="button" class="eb-filter fa-pos-chip" aria-pressed="true" onclick="DFLKader.faFilter(null)">' +
      (nurPos === 'TW' ? 'Torhüter' : nurPos) + ' <b>' + pool.filter(p => p.pos === nurPos).length + '</b> <i class="ti ti-x" aria-hidden="true"></i></button>' : '';
    const rows = gezeigt.map(p => {
      const chk = niveau(p);
      const hg = faHandgeld(p, 2), w = faGehalt(p, 2);
      const k2 = dflListe ? window.dflFaKonditionen(p, 2) : null;
      const sc = SC(), mitBericht = !sc || sc.hatBericht(p);
      const potTxt = !mitBericht ? 'Pot. ?' : (typeof potentialDisplay === 'function') ? potentialDisplay(p, scout) : ('Pot ' + (p.truePotential || '?'));
      const staerkeTxt = sc && !mitBericht ? 'Stärke ' + sc.staerkeHtml(p, 'lang') : 'OVR ' + p.ovr;
      const tag = !chk.ok
        ? '<span class="loan-tag" style="background:#3a1a1a;color:#f85149;border-color:#f85149">zu hochklassig</span>'
        : '<span class="loan-tag">Free Agent</span>';
      const preis = !chk.ok
        ? '<span style="color:#f85149;font-size:10px">lehnt ab</span>'
        : k2 ? '<span style="color:var(--gold,#f2c14e)">' + euro(k2.capHit) + '</span><br><span style="font-size:9px;color:var(--text3)">Cap Hit</span>'
        : '<span style="color:var(--gold,#f2c14e)">' + euro(hg) + '</span><br><span style="font-size:9px;color:var(--text3)">Handgeld · ' + euro(w) + '/Wo</span>';
      const knopf = chk.ok
        ? '<button class="mkt-btn" onclick="signFreeAgent(\'' + p.id + '\')">Verpflichten</button>'
        : '<button class="mkt-btn" disabled title="' + (chk.reason || '') + '">Kein Wechsel</button>';
      const welt = sc && sc.weltId ? sc.weltId(p) : String(p.id).replace(/^fa_/, '');
      return '<div class="market-row" data-welt="' + welt + '"><div style="flex:1">' +
        '<span class="pos-badge-sm pos-' + p.pos + '">' +
        (typeof positionsDisplay === 'function' ? positionsDisplay(p) : p.pos) + '</span> ' +
        '<span class="market-name">' + (p.flag ? p.flag + ' ' : '') + zeigeName(p) + '</span>' + (E ? E.zeichenHtml(p) : '') + ' ' + tag +
        '<div class="market-meta">' + p.age + ' J · ' + staerkeTxt + ' · <b style="color:var(--text2)">' + potTxt + '</b>' +
        (dflListe ? '' : ' · DEF ' + p.def + ' · MID ' + p.mid + ' · ATT ' + p.att) + '<span class="fa-zuletzt"> · ' + (p.fromClub || 'vereinslos') + '</span></div>' +
        '</div><div class="market-value">' + preis + '</div>' +
        '<div class="market-btns">' + (sc ? sc.knopfHtml(p, { ohneDauer: true }) : '') + knopf + '</div><i class="ti ti-chevron-right fa-pfeil" aria-hidden="true"></i></div>';
    }).join('');
    el.innerHTML = '<div class="fa-kopf" style="font-size:11px;color:var(--text3);margin-bottom:8px">' +
      ((typeof window.dflHandgeldInRaten === 'function' && window.dflHandgeldInRaten())
        ? 'Cap Hit bei 2 Jahren · '
        : 'Free Agents kosten keine Ablöse, verlangen aber <b>Handgeld</b> bei Unterschrift (aus der Kasse). ') +
      pool.length + ' verfügbar' + (E ? ' ' + E.filterChipHtml('fa', stilN) : '') + posChip + '</div>' +
      '<div class="market-list">' + (rows || '<div class="fa-leer">' + (nurPos ? 'Kein freier Spieler auf dieser Position.' : 'Kein Free Agent passt klar zu deinem Stil.') + '</div>') + '</div>';
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

  console.log('%c[TransfermarktBalance v2] aktiv', 'color:#3fb950;font-weight:bold',
    '— Marktwert 60+, Handgeld & Gehalt für Free Agents');
})();
