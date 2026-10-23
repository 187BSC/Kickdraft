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