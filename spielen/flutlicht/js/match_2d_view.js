/* ===== match_2d_view.js =====
   TAKTIKANSICHT IM SPIEL — spielt die Aufzeichnung der räumlichen Engine ab
   ─────────────────────────────────────────────────────────────────────────────
   Erfindet nichts: window.LAST_MATCH_2D enthält Bild für Bild alle 22 Positionen
   plus Ball, so wie die Engine gerechnet hat (siehe engine_v3_adapter.js).

   Öffnet sich über den Knopf „Taktikansicht" im Spieltag oder window.showMatch2D().
   Textmodus und Schnellsimulation bleiben davon unberührt — das hier ist ein
   reiner Betrachter, der nach dem Abpfiff zur Verfügung steht.

   STOLPERFALLEN, die in der Prototyp-Fassung Zeit gekostet haben:
    · Der Bildindex MUSS ganzzahlig sein — ein gebrochener Index liefert im
      Float32Array lauter undefined (Uhr „NaN", Stand springt auf den Endstand).
    · requestAnimationFrame steht still, sobald das Fenster nicht sichtbar ist.
      Deshalb läuft die Wiedergabe über einen Zeitgeber.
   ============================================================================= */
(function () {
  'use strict';

  const L = 105, B = 68;

  // ── Regie: SCHNITT statt Zeitraffer ────────────────────────────────────────
  // Zwei Modelle wurden verworfen. Erst liefen Höhepunkte in extremer Zeitlupe
  // (0,06) und alles andere 200- bis 800-fach — dem konnte niemand folgen. Dann
  // wurde der Rest nur noch moderat gerafft, aber auch 14-fach ist zu schnell
  // zum Zuschauen.
  // Jetzt gilt: was gezeigt wird, läuft IMMER langsam und vollständig. Was nicht
  // sehenswert ist, wird nicht beschleunigt, sondern WEGGESCHNITTEN — wie eine
  // Zusammenfassung im Fernsehen. Das Spiel bleibt dadurch kurz, ohne dass ein
  // einziges Bild im Blindflug vorbeirauscht.
  const REGULAER = 5400;        // ab hier läuft die Nachspielzeit
  const SICHT_TEMPO = 0.85;     // Spielsekunden je echter Sekunde — etwas
                                // langsamer als Echtzeit, angenehm zum Mitlesen
  const SPRUNG_HALT = 0.65;     // Sekunden Standbild beim Schnitt
  const SPRUNG_MIN  = 4;        // unter so wenig Spielsekunden lohnt kein Schnitt
  // Regie-Stufen: budget = Spielsekunden, die tatsächlich gezeigt werden.
  const REGIE = {
    komplett: { budget: 900, label: 'Viel sehen' },
    normal:   { budget: 420, label: 'Kompakt' },
    kurz:     { budget: 170, label: 'Nur Höhepunkte' }
  };
  const DRITTEL_AB = 64;        // Meter: ab hier beginnt ein Angriff
  const NACHLAUF = 2.5;         // Sekunden Nachlauf, damit die Szene ausklingt
  const MAX_SZENE = 16;         // eine einzelne Szene nie länger als das
  const CFG2D = { regie: 'normal', aktionsBudget: REGIE.normal.budget,
                  sichtTempo: SICHT_TEMPO };
  window.Taktikansicht = CFG2D;                     // zum Nachjustieren von außen

  let R = null, f = 0, playing = false, speed = 1, letzterEv = 0, timer = null;
  let cv = null, g = null, tempoArr = null, stufeArr = null, tPlay = 0;
  // LIVE-BETRIEB: läuft das Spiel gerade zum ersten Mal (dann zählt das Ergebnis
  // mit dem Abpfiff) oder ist es nur eine Wiederholung?
  let live = false, abgepfiffen = false, ABPFIFF = null, blitzAn = false;
  // HALBZEIT: Ist ein Haken gesetzt, endet die erste Aufzeichnung nicht mit dem
  // Abpfiff, sondern mit der Pause — dort darf eingegriffen werden.
  let HALBZEIT = null, inHalbzeit = false;
  // Schnittmodell: welche Bilder werden gezeigt, und halten wir gerade an,
  // weil gerade geschnitten wurde?
  let zeigeArr = null, haltBis = 0, sprungTxt = '';
  // Reihenfolge der Stufen — als Index gespeichert, NICHT über Float-Vergleich
  // ermittelt: in einem Float32Array wird aus 1,6 der Wert 1,60000002, damit
  // schlägt jedes `=== 1.6` fehl (kostete eine falsche Auswertung).
  const STUFEN = ['aktion', 'drittel', 'haelfte', 'ruhe', 'pause', 'standard'];
  const clampU = v => v < 0 ? 0 : v > 1 ? 1 : v;
  let letzterBall = null;

  // Pro Bild festlegen, wie schnell es abgespielt wird
  function baueTempo() {
    const S = R.stride, F = R.frames, n = R.frameCount;
    tempoArr = new Float32Array(n);
    stufeArr = new Uint8Array(n);
    // 1) ANGRIFFE als zusammenhängende Szenen finden: sobald die ballführende
    //    Elf ins letzte Drittel kommt, läuft die Szene — bis der Ball wieder
    //    heraus ist oder der Gegner ihn erobert und wegträgt.
    const istAktion = new Uint8Array(n);
    const szenen = [];
    let team = 0, offen = -1, endeBei = -1;
    for (let i = 0; i < n; i++) {
      const o = i * S, h = F[o + 46];
      if (h >= 0) team = h < 11 ? 0 : 1;          // −1 = Ball unterwegs → letzte Elf gilt weiter
      const bx = F[o + 44];
      const tief = team === 0 ? bx : L - bx;
      const t = F[o + 47];
      if (tief >= DRITTEL_AB) {
        if (offen < 0) { offen = i; endeBei = t + MAX_SZENE; }
        if (t > endeBei) { szenen.push([offen, i]); offen = -1; }
      } else if (offen >= 0) {
        let k = i;                                 // Nachlauf, damit es ausklingt
        while (k < n && F[k * S + 47] <= t + NACHLAUF) k++;
        szenen.push([offen, Math.min(k, n - 1)]);
        offen = -1;
      }
    }
    if (offen >= 0) szenen.push([offen, n - 1]);

    // 1b) AUSWAHL NACH BUDGET. Ein offenes Spiel hat doppelt so viele Angriffe
    //     wie ein zähes — ohne Budget schwankt die Wiedergabe zwischen 5 und 12
    //     Minuten. Deshalb: Szenen nach Wert sortieren und nur so viele in
    //     Zeitlupe zeigen, wie ins Budget passen. Tore und Großchancen zuerst.
    const wert = (a, b) => {
      const t0 = F[a * S + 47], t1 = F[b * S + 47];
      let w = 4 + (t1 - t0) * 0.2;
      for (const e of R.events) {
        if (e.t < t0 - 0.5 || e.t > t1 + 0.5) continue;
        if (e.type === 'goal') w += 300;
        else if (e.type === 'save' || e.type === 'blocked') w += 60;
        else if (e.type === 'miss') w += 45;
        else if (e.type === 'elfmeter') w += 280;
        else if (e.type === 'kopfball') w += 30;
        else if (e.type === 'ecke') w += 18;
        else if (e.type === 'dribble' && e.gegen) w += 12;
      }
      return w;
    };
    szenen.forEach(s => { s[2] = wert(s[0], s[1]); });
    szenen.sort((a, b) => b[2] - a[2]);

    // 1c) AUSWAHL. Das Budget zählt nur NEU hinzugekommene Spielzeit — sonst
    //     würden sich überlappende Szenen und Ereignisfenster doppelt anrechnen
    //     und die Wiedergabe wäre trotz kleinem Budget viel zu lang (gemessen:
    //     23 % des Spiels bei einem Budget von 200 s).
    let budget = CFG2D.aktionsBudget;
    // erster Bildindex mit Uhr ≥ tt (die Uhr läuft monoton, also Binärsuche)
    function idxAb(tt) {
      let lo = 0, hi = n - 1, r = n;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (F[mid * S + 47] >= tt) { r = mid; hi = mid - 1; } else lo = mid + 1;
      }
      return r;
    }
    function markiere(vonT, bisT, kostet) {
      let neu = 0;
      for (let i = idxAb(vonT); i < n; i++) {
        const t = F[i * S + 47];
        if (t > bisT) break;
        if (!istAktion[i]) {
          istAktion[i] = 1;
          if (i + 1 < n) neu += Math.max(0, F[(i + 1) * S + 47] - t);
        }
      }
      if (kostet) budget -= neu;
      return neu;
    }

    // PFLICHT: Tore, Elfmeter, Karten und Wechsel sind gesetzt und kosten nichts.
    // Ohne diese Regel steht im Ticker etwas, das man nie gesehen hat.
    const PFLICHT = { goal: 7, elfmeter: 7, red: 6, gelbrot: 6, yellow: 3.5, wechsel: 3 };
    for (const e of R.events) {
      const sp = PFLICHT[e.type];
      if (sp) markiere(e.t - sp * 0.6, e.t + sp, false);
    }
    // Angriffsszenen nach Wert auffüllen, solange das Budget reicht.
    for (const sz of szenen) {
      if (budget <= 0) break;
      markiere(F[sz[0] * S + 47], F[sz[1] * S + 47], true);
    }
    // KÜR: einzelne Ereignisse, die keine ganze Szene bekommen haben — Parade,
    // Ecke, Freistoß. Nur noch, wenn danach Budget übrig ist.
    const KUER = [['save', 4.5], ['miss', 4], ['blocked', 3.5], ['kopfball', 3.5],
                  ['ecke', 3.5], ['freistoss', 3.5], ['abseits', 3], ['foul', 2.5]];
    for (const [typ, sp] of KUER) {
      for (const e of R.events) {
        if (budget <= 0) break;
        if (e.type === typ) markiere(e.t - sp * 0.6, e.t + sp, true);
      }
      if (budget <= 0) break;
    }

    // 2) SICHTBARKEIT festlegen. Gezeigte Bilder laufen alle mit demselben
    //    langsamen Tempo — es gibt keine schnelle Stufe mehr. Alles andere
    //    wird übersprungen.
    zeigeArr = istAktion;
    // Sehr kurze Lücken lohnen keinen Schnitt: ein Sprung über zwei Sekunden
    // reißt die Szene auseinander, ohne Zeit zu sparen. Solche Lücken werden
    // mitgezeigt.
    let lueckeVon = -1;
    for (let i = 0; i <= n; i++) {
      if (i < n && !zeigeArr[i]) { if (lueckeVon < 0) lueckeVon = i; continue; }
      if (lueckeVon >= 0) {
        const dauer = F[Math.min(i, n - 1) * S + 47] - F[lueckeVon * S + 47];
        if (dauer < SPRUNG_MIN) for (let k = lueckeVon; k < i; k++) zeigeArr[k] = 1;
        lueckeVon = -1;
      }
    }
    // Stufe nur noch für den Lagestreifen: 0 = wird gezeigt, 4 = geschnitten.
    for (let i = 0; i < n; i++) {
      tempoArr[i] = CFG2D.sichtTempo;
      stufeArr[i] = zeigeArr[i] ? 0 : 4;
    }
  }

  // Nächstes gezeigtes Bild ab Index i (oder −1, wenn nichts mehr kommt).
  function naechstesBild(i) {
    for (let k = i; k < R.frameCount; k++) if (zeigeArr[k]) return k;
    return -1;
  }

  // Tatsächliche Wiedergabedauer bei Tempo ×1 — steht im Bedienstreifen, damit
  // man vor dem Anpfiff weiß, worauf man sich einlässt. Gezeigte Zeit geteilt
  // durch das Sichttempo, plus ein kurzer Halt je Schnitt.
  function wiedergabeDauer() {
    if (!R || !zeigeArr) return 0;
    const S = R.stride, F = R.frames;
    let echt = 0, schnitte = 0, warSichtbar = true;
    for (let i = 0; i < R.frameCount - 1; i++) {
      const dtF = F[(i + 1) * S + 47] - F[i * S + 47];
      if (zeigeArr[i]) { if (dtF > 0) echt += dtF / CFG2D.sichtTempo; warSichtbar = true; }
      else if (warSichtbar) { schnitte++; warSichtbar = false; }
    }
    return Math.round(echt + schnitte * SPRUNG_HALT);
  }
  function dauerAnzeigen() {
    const el = document.getElementById('m2d-dauer'); if (!el) return;
    const sek = Math.round(wiedergabeDauer() / Math.max(0.1, speed));
    el.textContent = '≈ ' + Math.max(1, Math.round(sek / 60)) + ' Min · ' + gezeigtProzent() + ' % gezeigt';
  }
  function gezeigtProzent() {
    if (!R || !zeigeArr) return 0;
    const S = R.stride, F = R.frames;
    let ganz = 0, sicht = 0;
    for (let i = 0; i < R.frameCount - 1; i++) {
      const dtF = F[(i + 1) * S + 47] - F[i * S + 47];
      if (dtF <= 0) continue;
      ganz += dtF; if (zeigeArr[i]) sicht += dtF;
    }
    return Math.round(sicht / Math.max(1, ganz) * 100);
  }
  function setzeRegie(name) {
    const r = REGIE[name]; if (!r || !R) return;
    CFG2D.regie = name; CFG2D.aktionsBudget = r.budget;
    baueTempo(); dauerAnzeigen();
    document.querySelectorAll('[data-regie]').forEach(b =>
      b.classList.toggle('on', b.dataset.regie === name));
  }

  function css() {
    if (document.getElementById('m2d-css')) return;
    const s = document.createElement('style');
    s.id = 'm2d-css';
    s.textContent = `
.m2d-ov{position:fixed;inset:0;z-index:9600;background:rgba(4,7,11,.93);
  display:flex;align-items:center;justify-content:center;padding:16px}
.m2d-box{width:min(1180px,100%);max-height:96vh;overflow-y:auto;background:var(--bg2,#111820);
  border:1px solid var(--border,#243244);border-radius:16px;padding:16px 18px 18px}
.m2d-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;gap:10px}
.m2d-head h3{margin:0;font-size:15px;font-weight:800}
.m2d-head .sub{font-size:11.5px;color:var(--text2,#9fb0c0)}
.m2d-x{background:none;border:1px solid var(--border,#243244);color:var(--text,#e6edf3);
  border-radius:9px;padding:6px 12px;cursor:pointer;font-weight:800;font-size:12px}
.m2d-bug{display:flex;flex-direction:column;align-items:center;margin-bottom:12px}
.m2d-row{display:flex}
.m2d-tm{background:var(--bg3,#161f2a);border:1px solid var(--border,#243244);padding:7px 15px;
  font-weight:800;font-size:12.5px;display:flex;align-items:center;gap:8px}
.m2d-tm.l{border-radius:8px 0 0 8px;border-right:none}
.m2d-tm.r{border-radius:0 8px 8px 0;border-left:none}
.m2d-sc{background:#0a1017;border:1px solid var(--border,#243244);padding:7px 18px;
  font-weight:800;font-size:16px;font-variant-numeric:tabular-nums;letter-spacing:1px}
.m2d-ck{background:var(--accent,#25c065);color:#04120a;border-radius:0 0 6px 6px;padding:2px 12px;
  font-weight:800;font-size:11px;font-variant-numeric:tabular-nums}
.m2d-dot{width:9px;height:9px;border-radius:3px;display:inline-block}
.m2d-grid{display:grid;grid-template-columns:150px 1fr 150px;gap:12px;align-items:start}
.m2d-side{background:var(--bg3,#161f2a);border:1px solid var(--border,#243244);border-radius:10px;padding:8px}
.m2d-side h4{font-size:9.5px;letter-spacing:1.1px;text-transform:uppercase;color:var(--text3,#6b7d8f);
  margin:0 0 7px;font-weight:800}
.m2d-pl{display:flex;align-items:center;gap:6px;padding:3px 2px;border-radius:5px}
.m2d-pl.ball{background:rgba(242,193,78,.14)}
.m2d-pl .nr{width:17px;text-align:center;font-size:10px;font-weight:800;color:var(--text2,#9fb0c0);
  font-variant-numeric:tabular-nums}
.m2d-pl .nm{flex:1;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.m2d-cv{width:100%;display:block;border-radius:10px;border:1px solid var(--border,#243244)}
.m2d-bar{display:flex;gap:7px;align-items:center;margin-top:10px;flex-wrap:wrap}
.m2d-bar button{background:var(--bg3,#161f2a);color:var(--text,#e6edf3);border:1px solid var(--border,#243244);
  border-radius:7px;padding:7px 13px;font:800 11px/1 sans-serif;cursor:pointer}
.m2d-bar button.go{background:linear-gradient(180deg,var(--accent,#25c065),#18904a);color:#04120a;border:none}
.m2d-bar button.on{border-color:var(--accent,#25c065);color:var(--accent,#25c065)}
.m2d-lage{display:flex;gap:6px;justify-content:center;align-items:center;margin-top:10px;flex-wrap:wrap}
.m2d-lage span{font-size:10px;font-weight:800;letter-spacing:.4px;padding:3px 9px;border-radius:99px;
  border:1px solid var(--border,#243244);color:var(--text2,#9fb0c0);white-space:nowrap}
.m2d-lage .an{background:rgba(37,192,101,.16);border-color:var(--accent,#25c065);color:var(--accent,#25c065)}
.m2d-lage .gold{background:rgba(242,193,78,.16);border-color:var(--gold,#f2c14e);color:var(--gold,#f2c14e)}
.m2d-lage .lupe{background:rgba(88,166,255,.16);border-color:#58a6ff;color:#58a6ff}
.m2d-st{display:flex;gap:14px;justify-content:center;margin-top:9px;font-size:11px;
  color:var(--text2,#9fb0c0);font-variant-numeric:tabular-nums;flex-wrap:wrap}
.m2d-st b{color:var(--text,#e6edf3)}
.m2d-tk{margin-top:10px;background:var(--bg3,#161f2a);border:1px solid var(--border,#243244);
  border-radius:10px;padding:8px 11px;height:92px;overflow-y:auto;font-size:11.5px}
.m2d-tk div{padding:2px 0;border-bottom:1px solid rgba(255,255,255,.04);color:var(--text2,#9fb0c0)}
.m2d-tk b{color:var(--text,#e6edf3);font-variant-numeric:tabular-nums;margin-right:6px}
.m2d-tk .tor{color:var(--gold,#f2c14e);font-weight:800}
.m2d-dauer{font-size:10.5px;color:var(--text3,#6b7d8f);margin-left:auto;white-space:nowrap}
.m2d-hint{font-size:10.5px;color:var(--gold,#f2c14e);text-align:center;margin-top:8px}
.m2d-tor{position:fixed;inset:0;z-index:9700;display:flex;align-items:center;justify-content:center;
  pointer-events:none;font:900 clamp(30px,9vw,64px)/1 sans-serif;letter-spacing:2px;
  color:var(--gold,#f2c14e);text-shadow:0 4px 26px rgba(0,0,0,.85);animation:m2dTor 1.8s ease-out forwards}
@keyframes m2dTor{0%{opacity:0;transform:scale(.7)}12%{opacity:1;transform:scale(1.06)}
  22%{transform:scale(1)}75%{opacity:1}100%{opacity:0}}
@media(prefers-reduced-motion:reduce){.m2d-tor{animation:none;opacity:1}}
@media(max-width:860px){.m2d-grid{grid-template-columns:1fr}.m2d-side{display:none}}`;
    document.head.appendChild(s);
  }

  function rasen() {
    const W = cv.width, H = cv.height, PAD = 26, PW = W - PAD * 2, PH = H - PAD * 2;
    const sx = x => PAD + x / L * PW, sy = y => PAD + y / B * PH;
    g.fillStyle = '#0a1c12'; g.fillRect(0, 0, W, H);
    const n = 14, bw = PW / n;
    for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? '#14351f' : '#123018'; g.fillRect(PAD + i * bw, PAD, bw, PH); }
    g.strokeStyle = 'rgba(255,255,255,.30)'; g.lineWidth = 2;
    g.strokeRect(sx(0), sy(0), PW, PH);
    g.beginPath(); g.moveTo(sx(L / 2), sy(0)); g.lineTo(sx(L / 2), sy(B)); g.stroke();
    g.beginPath(); g.arc(sx(L / 2), sy(B / 2), 9.15 / L * PW, 0, 7); g.stroke();
    [[0, 1], [L, -1]].forEach(([gx, d]) => {
      g.strokeRect(sx(gx), sy(B / 2 - 20.15), d * 16.5 / L * PW, 40.3 / B * PH);
      g.strokeRect(sx(gx), sy(B / 2 - 9.16), d * 5.5 / L * PW, 18.32 / B * PH);
      g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(sx(gx), sy(B / 2 - 3.66)); g.lineTo(sx(gx), sy(B / 2 + 3.66)); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.30)'; g.lineWidth = 2;
    });
    return { sx, sy };
  }

  // Abseits- und Platzverweis-Ereignisse, zwischengespeichert. In der Halbzeit
  // wächst die Ereignisliste weiter — deshalb an ihrer Länge neu aufbauen.
  let regelCache = null, regelLaenge = -1, regelQuelle = null;
  function regelEreignisse() {
    if (regelQuelle !== R.events || regelLaenge !== R.events.length) {
      regelQuelle = R.events; regelLaenge = R.events.length;
      regelCache = { abseits: [], raus: [] };
      for (const e of R.events) {
        if (e.type === 'abseits') regelCache.abseits.push(e);
        else if ((e.type === 'red' || e.type === 'gelbrot') && e.player && e.player._i != null) regelCache.raus.push(e);
      }
    }
    return regelCache;
  }

  function zeichne() {
    if (!R || !cv) return;
    const { sx, sy } = rasen();
    // WICHTIG: ganzzahliger Index — sonst liefert das Float32Array undefined.
    const S = R.stride, F = R.frames;
    const bi = Math.min(Math.floor(f), R.frameCount - 1);
    const o = bi * S, halter = F[o + 46];

    // ZWISCHENBILDER. Die Engine zeichnet nur 3,6 Bilder je Sekunde auf. Ohne
    // Interpolation springt bei langsamer Wiedergabe alles in großen Sätzen —
    // ein 20-m-Pass in vier 5-Meter-Sprüngen. Das wirkt wie Teleportieren und
    // war der eigentliche Grund für den Eindruck „viel zu schnell".
    // NICHT interpolieren wird über große Uhrsprünge (Zeitraffer, Anstoß nach
    // Tor) — dort würden Spieler und Ball quer übers Feld gleiten.
    let u = 0, o2 = o;
    if (bi + 1 < R.frameCount) {
      const t0 = F[o + 47], t1 = F[(bi + 1) * S + 47];
      if (t1 - t0 > 0 && t1 - t0 < 0.5) {
        o2 = (bi + 1) * S;
        u = clampU((tPlay - t0) / (t1 - t0));
      }
    }
    const px = i => F[o + i * 2] + (F[o2 + i * 2] - F[o + i * 2]) * u;
    const py = i => F[o + i * 2 + 1] + (F[o2 + i * 2 + 1] - F[o + i * 2 + 1]) * u;
    const bx = F[o + 44] + (F[o2 + 44] - F[o + 44]) * u;
    const by = F[o + 45] + (F[o2 + 45] - F[o + 45]) * u;
    // Zustandsfelder der Engine (ab Stride 50): Gegenpressing + wer anläuft
    const sardTeam = S >= 50 ? F[o + 48] : -1;
    const pressMaske = S >= 50 ? F[o + 49] : 0;

    // BALLLINIE — der zentrale Bezugspunkt des Spielmodells sichtbar gemacht
    const blx = sx(bx);
    g.save(); g.setLineDash([5, 6]); g.lineWidth = 1.4;
    g.strokeStyle = 'rgba(255,255,255,.22)';
    g.beginPath(); g.moveTo(blx, sy(0)); g.lineTo(blx, sy(B)); g.stroke(); g.restore();

    // ABSEITS wie im Fernsehen: nach dem Pfiff kurz die Linie im Moment des
    // Abspiels und die Stelle, an der der Angreifer da stand.
    const tJetzt = F[o + 47];
    const regel = regelEreignisse();
    for (const e of regel.abseits) {
      if (tJetzt < e.t - 0.2 || tJetzt > e.t + 2.8 || e.linie == null) continue;
      const lx = sx(e.linie);
      g.save(); g.setLineDash([7, 5]); g.lineWidth = 2;
      g.strokeStyle = 'rgba(255,107,107,.9)';
      g.beginPath(); g.moveTo(lx, sy(0)); g.lineTo(lx, sy(B)); g.stroke(); g.restore();
      // Geister-Markierungen: wo Angreifer und vorletzter Verteidiger beim
      // Abspiel standen — die Spieler selbst sind bis zum Pfiff weitergelaufen.
      if (e.vx != null && Math.abs(e.vx - e.linie) < 0.5) {
        g.save(); g.setLineDash([3, 3]);
        g.beginPath(); g.arc(sx(e.vx), sy(e.vy), 10, 0, 7);
        g.lineWidth = 1.8; g.strokeStyle = 'rgba(255,255,255,.85)'; g.stroke(); g.restore();
      }
      if (e.px != null) {
        g.beginPath(); g.arc(sx(e.px), sy(e.py), 10, 0, 7);
        g.lineWidth = 2.2; g.strokeStyle = 'rgba(255,107,107,.95)'; g.stroke();
      }
      g.fillStyle = 'rgba(255,107,107,.95)'; g.font = '800 11px sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'bottom';
      g.fillText('ABSEITS · Lage beim Abspiel', lx, sy(0) - 3);
    }
    // Vom Platz gestellt: ab dem Platzverweis (plus eine Sekunde) nicht mehr zeichnen
    const weg = function (i) {
      for (const e of regel.raus) if (e.player._i === i && tJetzt > e.t + 1) return true;
      return false;
    };

    for (let i = 0; i < 22; i++) {
      if (weg(i)) continue;
      const x = sx(px(i)), y = sy(py(i));
      g.beginPath(); g.ellipse(x, y + 3.5, 7, 4, 0, 0, 7); g.fillStyle = 'rgba(0,0,0,.34)'; g.fill();
    }
    for (let i = 0; i < 22; i++) {
      if (weg(i)) continue;
      const t = i < 11 ? 0 : 1, p = R.teams[t].players[i % 11] || {};
      const x = sx(px(i)), y = sy(py(i));
      // Wer gerade anläuft, bekommt einen Ring — im Gegenpressing kräftiger
      const presst = (pressMaske >> i) & 1;
      if (presst) {
        const sard = (sardTeam === t);
        g.beginPath(); g.arc(x, y, sard ? 14 : 12, 0, 7);
        g.lineWidth = sard ? 2.6 : 1.6;
        g.strokeStyle = sard ? 'rgba(242,193,78,.85)' : 'rgba(255,255,255,.34)';
        g.stroke();
      }
      g.beginPath(); g.arc(x, y, 8.4, 0, 7);
      g.fillStyle = t ? '#e15252' : '#2f8fe8'; g.fill();
      if (i === halter) { g.lineWidth = 2.4; g.strokeStyle = '#f2c14e'; }
      else { g.lineWidth = 1.4; g.strokeStyle = 'rgba(0,0,0,.42)'; }
      g.stroke();
      g.fillStyle = '#fff'; g.font = '800 10px sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(p.num || (i % 11) + 1, x, y + 0.5);
    }
    // BALLHÖHE (Feld 52, ab Stride 53): Der Schatten bleibt am Boden, der Ball
    // steigt sichtbar auf und wird mit der Höhe etwas größer — ein hoher Ball
    // über die Kette ist so von einem flachen Pass zu unterscheiden.
    const bz = S > 52 ? Math.max(0, F[o + 52] + (F[o2 + 52] - F[o + 52]) * u) : 0;
    const proMeter = sy(1) - sy(0);
    const anheben = bz * proMeter * 0.9;
    letzterBall = { x: +bx.toFixed(2), y: +by.toFixed(2), z: +bz.toFixed(2), u: +u.toFixed(2) };
    const bsx = sx(bx), bsy = sy(by);
    const schattenK = 1 - Math.min(0.45, bz * 0.05);
    g.beginPath(); g.ellipse(bsx, bsy + 3, 4.5 * schattenK, 2.6 * schattenK, 0, 0, 7);
    g.fillStyle = 'rgba(0,0,0,' + Math.max(0.14, 0.4 - bz * 0.03).toFixed(2) + ')'; g.fill();
    if (bz > 1.2) {
      // Höhenmarke: feine goldene Linie vom Schatten zum Ball (weiß ginge in der
      // gestrichelten Balllinie unter, die an derselben Stelle verläuft)
      g.save(); g.setLineDash([2, 2]); g.lineWidth = 1.6; g.strokeStyle = 'rgba(242,193,78,.8)';
      g.beginPath(); g.moveTo(bsx, bsy + 2); g.lineTo(bsx, bsy - anheben + 4); g.stroke(); g.restore();
    }
    g.beginPath(); g.arc(bsx, bsy - anheben, 4.6 + Math.min(3, bz * 0.35), 0, 7);
    g.fillStyle = '#fff'; g.fill(); g.lineWidth = 1.2; g.strokeStyle = '#1b1b1b'; g.stroke();

    // Uhr in Minuten:Sekunden. Ab der 90. läuft sie als Nachspielzeit weiter und
    // zeigt zusätzlich „+1" — wie im Fernsehen.
    const t = F[o + 47];
    const ck = document.getElementById('m2d-clock');
    if (ck) {
      const mm = Math.floor(t / 60), ss = Math.floor(t % 60);
      const zeit = mm + ':' + (ss < 10 ? '0' : '') + ss;
      ck.textContent = t >= REGULAER ? zeit + '  +1' : zeit;
      ck.style.background = t >= REGULAER ? 'var(--gold,#f2c14e)' : '';
    }
    let h = 0, a = 0;
    for (const e of R.events) { if (e.t > t) break; if (e.type === 'goal') { e.side === 'home' ? h++ : a++; } }
    const sc = document.getElementById('m2d-score'); if (sc) sc.textContent = h + ' : ' + a;
    document.querySelectorAll('.m2d-pl').forEach(el => el.classList.toggle('ball', +el.dataset.i === halter));
    lageZeigen(bi, halter, sardTeam);
    return t;
  }

  // ── Lagestreifen: was tut die Engine gerade? ───────────────────────────────
  // Ohne das ist alles unsichtbar, was wir eingebaut haben — der Zuschauer sieht
  // Punkte laufen, aber nicht WARUM. Hier steht, wer den Ball hat, in welcher
  // Spielphase die Elf ist, ob gegengepresst oder rotiert wird, und warum die
  // Wiedergabe gerade langsam oder schnell läuft.
  const PHASE = ['Auftanken', 'Brechen', 'Zünden'];
  const PHASE_HILFE = ['Ballbesitz sichern, Angriff neu aufbauen',
                       'Ordnung öffnen statt überrennen',
                       'direkt abschließen, solange der Gegner offen steht'];
  const STUFEN_TEXT = { aktion: ['läuft', 'lupe'], standard: ['läuft', 'lupe'],
                        drittel: ['läuft', 'lupe'], haelfte: ['läuft', 'lupe'],
                        ruhe: ['läuft', 'lupe'], pause: ['übersprungen', ''] };
  function lageZeigen(bi, halter, sardTeam) {
    const el = document.getElementById('m2d-lage'); if (!el) return;
    const S = R.stride, F = R.frames, o = bi * S;
    const teil = [];
    // Wer hat den Ball?
    if (halter >= 0) {
      const t = halter < 11 ? 0 : 1;
      teil.push('<span class="an">● ' + R.namen[t] + ' am Ball</span>');
      if (S >= 52) {
        const m = F[o + 50] | 0;
        teil.push('<span title="' + (PHASE_HILFE[m] || '') + '">' + (PHASE[m] || '—') + '</span>');
      }
    } else {
      teil.push('<span>Ball unterwegs</span>');
    }
    if (sardTeam >= 0) teil.push('<span class="gold">Gegenpressing ' + R.namen[sardTeam] + '</span>');
    if (S >= 52 && F[o + 51]) teil.push('<span>Rotation außen</span>');
    const st = STUFEN[stufeArr[bi]] || '';
    const txt = STUFEN_TEXT[st] || [st, ''];
    teil.push('<span class="' + txt[1] + '">' + txt[0] + '</span>');
    if (sprungTxt) teil.push('<span class="gold">✂ ' + sprungTxt + '</span>');
    el.innerHTML = teil.join('');
  }

  const LBL = { goal: '⚽ TOR', save: 'Parade', miss: 'vorbei', blocked: 'geblockt',
                ecke: 'Ecke', foul: 'Foul', yellow: '🟨 Gelb', wechsel: '⇄ Wechsel',
                abseits: 'Abseits', freistoss: 'Freistoß', elfmeter: '⚑ ELFMETER',
                kopfball: 'Kopfball', red: '🟥 ROT', gelbrot: '🟨🟥 GELB-ROT',
                vorteil: 'Vorteil', schwalbe: 'Schwalbe' };
  // Zusatz im Ticker: Art des Freistoßes bzw. Standard-Tor
  const FS_ART = { direkt: 'direkt aufs Tor', flanke: 'Flanke', kurz: '' };
  function ticker(t) {
    const tk = document.getElementById('m2d-tk'); if (!tk) return;
    for (; letzterEv < R.events.length; letzterEv++) {
      const e = R.events[letzterEv];
      if (e.t > t) break;
      // Nach einer Auswechslung den Namen in der Aufstellungsliste mitziehen —
      // sonst steht dort weiter der Ausgewechselte, während auf dem Platz längst
      // ein anderer läuft.
      if (e.type === 'wechsel' && e.player) {
        const el = document.querySelector('.m2d-pl[data-i="' + e.player._i + '"] .nm');
        if (el) el.textContent = (e.ein || '').split(' ').slice(-1)[0] || el.textContent;
      }
      if (e.type === 'goal' && blitzAn) torBlitz(e);
      let lbl = LBL[e.type]; if (!lbl) continue;
      if (e.type === 'freistoss' && FS_ART[e.art]) lbl += ' (' + FS_ART[e.art] + ')';
      if (e.type === 'goal' && e.art === 'freistoss') lbl += ' per Freistoß';
      if (e.type === 'goal' && e.art === 'elfmeter') lbl += ' per Elfmeter';
      const nm = e.type === 'wechsel' ? (e.ein + ' für ' + e.aus)
                                      : (e.player ? (e.player.name || '') : '');
      const d = document.createElement('div');
      if (e.type === 'goal') d.className = 'tor';
      d.innerHTML = '<b>' + Math.floor(e.t / 60) + "'</b>" + lbl + (nm ? ' — ' + nm : '') +
                    ' (' + (e.side === 'home' ? R.namen[0] : R.namen[1]) + ')';
      tk.appendChild(d); tk.scrollTop = tk.scrollHeight;
    }
  }

  // Tore sollen auffallen — vorher rutschte ein Treffer nur als Zeile durch den
  // Ticker vorbei, während der Blick auf dem Feld lag.
  function torBlitz(e) {
    if (!document.getElementById('m2d-ov')) return;
    const d = document.createElement('div');
    d.className = 'm2d-tor';
    d.textContent = 'TOR · ' + (e.side === 'home' ? R.namen[0] : R.namen[1]);
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 1900);
  }

  function statsAus(t) {
    const el = document.getElementById('m2d-st'); if (!el) return;
    const s = [{ sh: 0, xg: 0, ec: 0 }, { sh: 0, xg: 0, ec: 0 }];
    for (const e of R.events) {
      if (e.t > t) break;
      const i = e.side === 'home' ? 0 : 1;
      if (e.type === 'goal' || e.type === 'save' || e.type === 'miss' || e.type === 'blocked') {
        s[i].sh++;
        if (e.xg && e.type !== 'blocked') s[i].xg += e.xg;     // geblockt zählt nicht auf xG
      }
      if (e.type === 'ecke') s[i].ec++;
    }
    el.innerHTML = 'Schüsse <b>' + s[0].sh + ' : ' + s[1].sh + '</b> · xG <b>' +
      s[0].xg.toFixed(2) + ' : ' + s[1].xg.toFixed(2) + '</b> · Ecken <b>' + s[0].ec + ' : ' + s[1].ec + '</b>';
  }

  function tick() {
    const jetzt = performance.now();
    const dt = Math.min(0.25, (jetzt - (tick._last || jetzt)) / 1000);
    tick._last = jetzt;
    if (!playing || !R) return;
    // Standbild nach einem Schnitt: kurz halten, damit der Sprung nicht
    // unbemerkt passiert.
    if (haltBis && jetzt < haltBis) { zeichne(); return; }
    if (haltBis) { haltBis = 0; sprungTxt = ''; }
    const S = R.stride, F = R.frames;
    const bi = Math.min(Math.floor(f), R.frameCount - 1);
    // Wiedergabeuhr läuft in SPIELZEIT, immer mit demselben ruhigen Tempo
    tPlay += dt * speed * (tempoArr ? tempoArr[bi] : 1);
    let i = bi;
    while (i < R.frameCount - 1 && F[(i + 1) * S + 47] <= tPlay) i++;
    // SCHNITT: läuft die Wiedergabe in einen übersprungenen Abschnitt, wird
    // nicht beschleunigt, sondern direkt zum nächsten gezeigten Bild gesprungen.
    if (zeigeArr && !zeigeArr[i] && i < R.frameCount - 1) {
      const ziel = naechstesBild(i);
      if (ziel < 0) { f = R.frameCount - 1; }
      else {
        const vonMin = Math.floor(F[i * S + 47] / 60), nachMin = Math.floor(F[ziel * S + 47] / 60);
        f = ziel; tPlay = F[ziel * S + 47];
        sprungTxt = 'Sprung ' + vonMin + '. → ' + nachMin + '. Minute';
        haltBis = jetzt + SPRUNG_HALT * 1000 / Math.max(0.1, speed);
        const t2 = zeichne(); ticker(t2); statsAus(t2);
        return;
      }
    } else { f = i; }
    if (f >= R.frameCount - 1) {
      f = R.frameCount - 1;
      const t0 = zeichne(); ticker(t0); statsAus(t0);
      if (HALBZEIT && !inHalbzeit) { halbzeitPause(); return; }
      matchEnde();
      return;
    }
    const t = zeichne(); ticker(t); statsAus(t);
  }

  // ── ABPFIFF ────────────────────────────────────────────────────────────────
  // Im Live-Betrieb ist das hier das Spielende: alle restlichen Ereignisse
  // werden nachgetragen, die Uhr steht, und der Knopf führt zum Spielbericht.
  // Gewertet wird beim Schließen (closeMatch2D) — genau einmal.
  function matchEnde() {
    playing = false;
    if (abgepfiffen) return;
    abgepfiffen = true;
    const S = R.stride;
    const letzte = R.frames[(R.frameCount - 1) * S + 47] + 1;
    blitzAn = false;
    ticker(letzte); statsAus(letzte);
    const ck = document.getElementById('m2d-clock');
    if (ck) { ck.textContent = 'ABPFIFF'; ck.style.background = 'var(--gold,#f2c14e)'; }
    const sk = document.getElementById('m2d-skip'); if (sk) sk.style.display = 'none';
    const b = document.getElementById('m2d-play');
    if (b) b.textContent = live ? '✓ Weiter zum Spielbericht' : '▶ Nochmal';
    const hint = document.getElementById('m2d-hint');
    if (hint && live) hint.textContent = 'Abpfiff — das Ergebnis wird beim Schließen gewertet.';
  }

  // Pfiff zur Pause: anhalten und den Eingriff anbieten.
  function halbzeitPause() {
    inHalbzeit = true; playing = false; blitzAn = false;
    const ck = document.getElementById('m2d-clock');
    if (ck) { ck.textContent = 'HALBZEIT'; ck.style.background = 'var(--gold,#f2c14e)'; }
    const pb = document.getElementById('m2d-play'); if (pb) pb.textContent = '❚❚ Pause';
    const hint = document.getElementById('m2d-hint');
    if (hint) hint.textContent = 'Halbzeit — jetzt kannst du wechseln und umstellen.';
    try { HALBZEIT(); } catch (e) { console.warn('[Match2DView] Halbzeit', e); }
  }

  // Zweite Hälfte anhängen: die Engine hat in DIESELBE Aufzeichnung
  // weitergeschrieben, es wächst also nur die Bildzahl.
  window.match2DFortsetzen = function (res) {
    if (!R || !res) return;
    R.frames = res.frames || R.frames;
    R.frameCount = res.frameCount || R.frameCount;
    if (res.events) R.events = res.events;
    HALBZEIT = null; inHalbzeit = false;
    baueTempo(); dauerAnzeigen();
    const ck = document.getElementById('m2d-clock'); if (ck) ck.style.background = '';
    const hint = document.getElementById('m2d-hint');
    if (hint) hint.textContent = 'Zweite Halbzeit — gewertet wird mit dem Abpfiff.';
    const pb = document.getElementById('m2d-play'); if (pb) pb.textContent = '❚❚ Pause';
    playing = true; blitzAn = true;
    tick._last = performance.now();
  };

  // Direkt ans Ende springen, ohne den Rest anzuschauen.
  function zumAbpfiff() {
    if (!R) return;
    blitzAn = false;
    f = R.frameCount - 1;
    tPlay = R.frames[f * R.stride + 47];
    const t = zeichne(); ticker(t); statsAus(t);
    if (HALBZEIT && !inHalbzeit) { halbzeitPause(); return; }
    matchEnde();
  }

  function aufstellung() {
    [['m2d-lH', 0], ['m2d-lA', 1]].forEach(([id, t]) => {
      const box = document.getElementById(id); if (!box) return;
      box.innerHTML = '<h4>' + R.namen[t] + '</h4>' +
        R.teams[t].players.slice(0, 11).map((p, i) => {
          const kurz = (p.name || '').split(' ').slice(-1)[0] || ('Sp' + (i + 1));
          return '<div class="m2d-pl" data-i="' + (t * 11 + i) + '"><span class="nr">' +
            (p.num || i + 1) + '</span><span class="nm">' + kurz + '</span></div>';
        }).join('');
    });
  }

  window.showMatch2D = function (opt) {
    opt = opt || {};
    R = window.LAST_MATCH_2D;
    if (!R || !R.frames) {
      if (typeof showToast === 'function') showToast('Für dieses Spiel gibt es keine Aufzeichnung — die räumliche Engine muss aktiv sein.', 'warn');
      return;
    }
    if (document.getElementById('m2d-ov')) return;      // schon offen
    live = !!opt.live;
    ABPFIFF = (typeof opt.abpfiff === 'function') ? opt.abpfiff : null;
    HALBZEIT = (typeof opt.halbzeit === 'function') ? opt.halbzeit : null;
    abgepfiffen = false; inHalbzeit = false;
    css();
    const ov = document.createElement('div');
    ov.className = 'm2d-ov'; ov.id = 'm2d-ov';
    ov.innerHTML = `
      <div class="m2d-box">
        <div class="m2d-head">
          <div><h3>${live ? 'Spiel läuft' : 'Taktikansicht'}</h3>
            <div class="sub">${live
              ? 'Das Spiel läuft jetzt — das Ergebnis zählt mit dem Abpfiff.'
              : 'Keine Nachbildung: jede Position stammt Bild für Bild aus der Simulation.'}</div></div>
          <button class="m2d-x" onclick="closeMatch2D()">Schließen</button>
        </div>
        <div class="m2d-bug">
          <div class="m2d-row">
            <div class="m2d-tm l"><span class="m2d-dot" style="background:#2f8fe8"></span>${R.namen[0]}</div>
            <div class="m2d-sc" id="m2d-score">0 : 0</div>
            <div class="m2d-tm r">${R.namen[1]}<span class="m2d-dot" style="background:#e15252"></span></div>
          </div>
          <div class="m2d-ck" id="m2d-clock">0'</div>
        </div>
        <div class="m2d-grid">
          <div class="m2d-side" id="m2d-lH"></div>
          <div>
            <canvas class="m2d-cv" id="m2d-cv" width="1050" height="680"></canvas>
            <div class="m2d-bar">
              <button class="go" id="m2d-play">▶ ${live ? 'Anpfiff' : 'Abspielen'}</button>
              <button id="m2d-skip">Zum Abpfiff</button>
              <button data-s="0.5">sehr ruhig</button><button data-s="1" class="on">normal</button>
              <button data-s="2">zügig</button><button data-s="4">schnell</button>
              <span class="m2d-dauer" id="m2d-dauer"></span>
            </div>
            <div class="m2d-bar">
              <button data-regie="komplett">Viel sehen</button>
              <button data-regie="normal" class="on">Kompakt</button>
              <button data-regie="kurz">Nur Höhepunkte</button>
            </div>
            <div class="m2d-lage" id="m2d-lage"></div>
            <div class="m2d-st" style="opacity:.75;font-size:10.5px">
              Alles Gezeigte läuft ruhig und vollständig; dazwischen wird geschnitten (✂), nicht beschleunigt.<br>
              gestrichelt = Balllinie · weißer Ring = läuft an ·
              <span style="color:var(--gold,#f2c14e)">goldener Ring = Gegenpressing</span> ·
              goldener Rand = am Ball</div>
            <div class="m2d-st" id="m2d-st"></div>
            <div class="m2d-tk" id="m2d-tk"></div>
            <div class="m2d-hint" id="m2d-hint">${live
              ? 'Tore, Karten und Wechsel werden gewertet, sobald der Abpfiff kommt.' : ''}</div>
          </div>
          <div class="m2d-side" id="m2d-lA"></div>
        </div>
      </div>`;
    document.body.appendChild(ov);

    cv = document.getElementById('m2d-cv'); g = cv.getContext('2d');
    f = 0; letzterEv = 0; playing = false; speed = 1; tPlay = 0; blitzAn = false;
    haltBis = 0; sprungTxt = '';
    setzeRegie(CFG2D.regie || 'normal');
    const erstes = naechstesBild(0);
    if (erstes > 0) { f = erstes; tPlay = R.frames[erstes * R.stride + 47]; }
    aufstellung(); zeichne(); statsAus(0);

    document.getElementById('m2d-play').onclick = function () {
      if (abgepfiffen) {
        if (live) { closeMatch2D(); return; }            // weiter zum Spielbericht
        const start = naechstesBild(0);
        f = start < 0 ? 0 : start;
        tPlay = R.frames[f * R.stride + 47];
        letzterEv = 0; abgepfiffen = false; haltBis = 0; sprungTxt = '';
        document.getElementById('m2d-tk').innerHTML = '';
        const sk = document.getElementById('m2d-skip'); if (sk) sk.style.display = '';
        const ck = document.getElementById('m2d-clock'); if (ck) ck.style.background = '';
      }
      playing = !playing;
      blitzAn = playing;
      this.textContent = playing ? '❚❚ Pause' : '▶ Weiter';
      tick._last = performance.now();
    };
    document.getElementById('m2d-skip').onclick = zumAbpfiff;
    ov.querySelectorAll('[data-s]').forEach(b => b.onclick = function () {
      speed = parseFloat(this.dataset.s);
      ov.querySelectorAll('[data-s]').forEach(x => x.classList.remove('on'));
      this.classList.add('on');
      dauerAnzeigen();
    });
    ov.querySelectorAll('[data-regie]').forEach(b => b.onclick = function () {
      setzeRegie(this.dataset.regie);
    });

    tick._last = performance.now();
    if (timer) clearInterval(timer);
    timer = setInterval(tick, 33);
    // Im Live-Betrieb wird sofort angepfiffen — man wartet nicht auf sein
    // eigenes Spiel.
    if (live) setTimeout(function () {
      const b = document.getElementById('m2d-play');
      if (b && !playing && !abgepfiffen) b.click();
    }, 350);
  };

  // Auskunft über die Regie: wie lange läuft die Wiedergabe, und wie verteilt
  // sich die Spielzeit auf die Tempostufen? (Prüfung + spätere Anzeige)
  window.match2DInfo = function () {
    if (!R || !zeigeArr) return null;
    const S = R.stride, F = R.frames;
    let gezeigt = 0, geschnitten = 0, schnitte = 0, warSicht = true;
    for (let i = 0; i < R.frameCount - 1; i++) {
      const dtF = F[(i + 1) * S + 47] - F[i * S + 47];
      if (dtF <= 0) continue;
      if (zeigeArr[i]) { gezeigt += dtF; warSicht = true; }
      else { geschnitten += dtF; if (warSicht) { schnitte++; warSicht = false; } }
    }
    const o = { gezeigt: Math.round(gezeigt) + ' s', geschnitten: Math.round(geschnitten) + ' s',
                schnitte: schnitte, anteilGezeigt: gezeigtProzent() + ' %' };
    return { wiedergabeSek: wiedergabeDauer(), spielzeitNachStufe: o,
             bild: f, uhr: +F[Math.floor(f) * S + 47].toFixed(2),
             stufe: STUFEN[stufeArr[Math.floor(f)]],
             // zuletzt GEZEICHNETE Ballposition (interpoliert) — zum Prüfen,
             // ob zwischen den Bildern wirklich weiterbewegt wird
             ball: letzterBall };
  };

  // Wird dieses Bild gezeigt oder liegt es in einem geschnittenen Abschnitt?
  // (Prüfhilfe von außen — zeigt, ob ein Ereignis wirklich zu sehen ist.)
  window.__zeigt2D = function (i) { return !!(zeigeArr && zeigeArr[i | 0]); };

  // Zu einem Bild springen (für einen Zeitstrahl und zum Prüfen von außen)
  window.match2DSeek = function (bild) {
    if (!R) return null;
    f = Math.max(0, Math.min(bild | 0, R.frameCount - 1));
    tPlay = R.frames[f * R.stride + 47];
    letzterEv = 0; haltBis = 0; sprungTxt = '';
    const tk = document.getElementById('m2d-tk'); if (tk) tk.innerHTML = '';
    const t = zeichne(); ticker(t); statsAus(t);
    return t;
  };

  window.closeMatch2D = function () {
    playing = false; blitzAn = false;
    if (timer) { clearInterval(timer); timer = null; }
    const ov = document.getElementById('m2d-ov'); if (ov) ov.remove();
    document.querySelectorAll('.m2d-tor, #hz-ov').forEach(el => el.remove());
    HALBZEIT = null; inHalbzeit = false;
    // WICHTIG: Das Ergebnis wird hier verbucht — auch wenn vorzeitig geschlossen
    // wird. Ein angepfiffenes Spiel darf nie ungewertet verschwinden.
    if (live && ABPFIFF) {
      const fn = ABPFIFF; ABPFIFF = null; live = false;
      try { fn(); } catch (e) { console.warn('[Match2DView] Abpfiff fehlgeschlagen', e); }
    }
    live = false; ABPFIFF = null;
  };

  // Knopf im Spieltag einblenden, sobald eine Aufzeichnung vorliegt
  window.zeigeTaktikKnopf = function () {
    if (!window.LAST_MATCH_2D || document.getElementById('m2d-open')) return;
    const sim = document.getElementById('sim-btn');
    if (!sim || !sim.parentNode) return;
    const b = document.createElement('button');
    b.className = 'ko-btn'; b.id = 'm2d-open'; b.style.marginTop = '8px';
    // Icon vorher auf Existenz geprüft (ti-strategy fehlt im Webfont, Breite 0)
    b.innerHTML = '<i class="ti ti-soccer-field" aria-hidden="true"></i> Taktikansicht';
    b.onclick = window.showMatch2D;
    sim.parentNode.appendChild(b);
  };

  console.log('[Match2DView v1] aktiv — Taktikansicht über showMatch2D()');
})();