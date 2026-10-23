/* ═══════════════════════════════════════════════════════════════════════════
   DFL · DREI EBENEN UND STIL-EIGNUNG  ·  v1   (D111/D112, freigegeben 2026-10-11, eingebaut 2026-10-11)
   ─────────────────────────────────────────────────────────────────────────
   Vorschau: spiel/dfl_ebenen_vorschau.html. Nutzer 2026-10-11: „Ich würde die Oberfläche gerne einfach halten, diese 3 Klick
   Tiefe einbauen … auf der Oberfläche für die einfachen, schnellen Spieler, die 2. Ebene, wenn man mehr wissen möchte“ und
   „besser und einfacher sehen, für welchen Stil der Spieler besser geeignet ist“. Freigabe: „Bau das erstmal ein“.
     · Ebene 1 (auf einen Blick): eine Zahl, ein Warnzeichen, ein Stil-Zeichen, keine Erklärsätze, lange Listen als Zeilen.
     · Ebene 2 (ein Tipp): Spieler-Blatt mit Stil-Balken und Entwicklungs-Pfeil, Filter-Blatt der Kaderliste, Blatt fremder
       Spieler wie bei eigenen (dfl_scouting_patch.js), Talent-Blatt im Draft, Entlassen-Blatt mit Dead Cap jetzt / am Saisonende.
     · Ebene 3 (für Nerds): „Wie gerechnet?“ (Stil-Rechnung), „Kurve“ (Entwicklung), ⓘ (Regeln, Legenden, Vertragstext).
   D112 Stil-Zeichen: dein Stil mit Haken ab 65 % Passung, sonst sein bester Stil ab 65 %, sonst keins. Torhüter seit D156 (2026-10-14)
   auch – mit ihrem Torwart-Typ je Stil (DFLHandel.TW_TYP: Weitschläger, Mitspieler, Strafraumherr, Mitspielender Libero). Gerechnet
   wird nur über DFLScouting.passung (dieselbe Zahl wie im Scout-Bericht, D78, und wie die KI sucht). Der Typ ist öffentlich,
   die Prozente gibt es nur mit Bericht (eigene Spieler immer). Kein Zeichen auf dem Spielfeld der Aufstellung.
   D111 Entwicklung als Pfeil in 5 Stufen (Nutzer: „ganz nach oben, schräg oben, horizontal, schräg unten, unten; versteht jeder
   und kann sich ändern mit Spielzeit“): erwartete Änderung der Stärke in der nächsten Saison aus Alter, Körperalter (D68),
   sichtbarem Potenzial (potentialRange bzw. DFLGenerator.potSichtbar – nie truePotential, D103) und Spielzeit dieser Saison –
   eigene Spieler mit einem im Spiel gemessenen Modell (pfeilModell: Wochen-Training, Abbau nach Position – sie altern milder
   als die Welt), alle anderen mit dem Erwartungswert der Welt (DFLSaison.entwicklung). Schwellen gemessen (CFG.pfeil), die
   Kurve bleibt auf Ebene 3.
   Hängt sich an: renderSquadOverview (Kaderliste, äußerste Hülle), renderScoutTab (Erklärsätze → ⓘ), Klicks in der Free Agency
   (Zeile → Blatt), [data-eb-auf] (Aufklappen auf Ebene 3). Andere Module rufen zur Zeichenzeit DFLEbenen.zeichenHtml,
   stilBlockHtml, pfeilHtml, filterChipHtml (dfl_trade_patch.js, dfl_scouting_patch.js, dfl_kader_patch.js, transfermarkt_balance.js,
   dfl_anfragen_patch.js, dfl_blick_patch.js, dfl_app_shell.js).
   API: DFLEbenen.CFG · profil · zeichenDaten · zeichenHtml · passtZuMir · stilBlockHtml · rechnungHtml · erwartung · stufe
        · pfeilDaten · pfeilTeile · pfeilHtml · pfeilModell · praxisEigen · praxisWelt · filter · filterSetzen · filterChipHtml
        · filterAnmelden · entlassenBlatt · kaderFilterBlatt · zaehle · genau
   Lädt nach dfl_bilder_patch.js (äußerste Hülle um renderSquadOverview), vor init_bootstrap.js. CSS: css/dfl_ebenen.css.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : globalThis;
  const CFG = {
    // D112: ab dieser Passung (Prozent, DFLScouting.passung) gibt es ein Zeichen
    zeichen: { ab: 65 },
    // D111: Pfeil aus der erwarteten Änderung der Stärke in der nächsten Saison. Schwellen: ↑ ab +2,5 · ↗ ab +0,8 · → · ↘ ab −0,8 ·
    // ↓ ab −2 (gemessen 2026-10-11, Werte im Kopf von pfeilModell und in docs/offene-fragen.md D111)
    pfeil: { stufen: [2.5, 0.8, -0.8, -2] },
    // Spielzeit dieser Saison → wie die Welt rechnet (DFLSaison.entwicklung: Startelf 1,2 · Spieltagskader 1,0 · Development Squad
    // 1,05 · sonst 0,8); Stammspieler ab der Hälfte der Spiele von Beginn, Bank unter einem Fünftel (wie das Körperalter, D68)
    spielzeit: { stamm: 0.5, bank: 0.2, praxis: { elf: 1.2, kader: 1.0, ds: 1.05, bank: 0.8 } },
    aus: false                                    // Messschalter: Oberfläche wie vor D111 (Zeichen und Pfeil bleiben als Funktion)
  };
  const DOM = typeof document !== 'undefined' && !!document.addEventListener;
  const dfl = () => typeof CLUB !== 'undefined' && CLUB && CLUB.dfl && CLUB.dfl.aktiv && typeof LEAGUE !== 'undefined' && LEAGUE && !!LEAGUE.dfl;
  const shell = () => DOM && !!document.body && document.body.classList.contains('dfl-shell');
  const an = () => !CFG.aus && dfl();
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ico = n => `<i class="ti ti-${n}" aria-hidden="true"></i>`;
  const de = (x, n) => Number(x).toLocaleString('de-DE', { minimumFractionDigits: n || 0, maximumFractionDigits: n || 0 });
  // wie das Spieler-Blatt (dfl_app_shell.js) und die Saisonvorbereitung: „2,9 Mio €“
  const mio = x => (Math.round((x || 0) / 1e5) / 10).toLocaleString('de-DE') + ' Mio €';
  const SCO = () => W.DFLScouting || null;
  const Gen = () => W.DFLGenerator || null;

  // ── Stile (Farben und Zeichen wie im Taktik-Reiter, D55) ─────────────────
  const KREIS = ['pressing', 'ballbesitz', 'fluegel', 'direkt'];
  const STIL_ERSATZ = {
    pressing: { name: 'Gegenpressing', kurz: 'Pressing', ic: 'ti-run', farbe: '#fb7185' },
    ballbesitz: { name: 'Geduldiger Ballbesitz', kurz: 'Ballbesitz', ic: 'ti-ball-football', farbe: '#38bdf8' },
    fluegel: { name: 'Flügelspiel', kurz: 'Flügel', ic: 'ti-flag-3', farbe: '#a3e635' },
    direkt: { name: 'Direktes Angriffsspiel', kurz: 'Direkt', ic: 'ti-shoe', farbe: '#fbbf24' }
  };
  const stilDef = s => (W.DFLTaktik && W.DFLTaktik.STILE && W.DFLTaktik.STILE[s]) || STIL_ERSATZ[s] || { name: s, kurz: s, ic: 'ti-target-arrow', farbe: '#9aa3b2' };
  const meinStil = () => { const S = SCO(); try { return S && S.eigenerStil ? S.eigenerStil() : null; } catch (e) { return null; } };
  const TEIL = { pace: 'Tempo', tec: 'Technik', mid: 'Mittelfeld', att: 'Angriff', mental: 'Mentalität', def: 'Abwehr',
    einsGegenEins: '1 gegen 1', spielaufbau: 'Spielaufbau', abwurf: 'Abwurf', reflexe: 'Reflexe', paraden: 'Paraden', schnelligkeit: 'Schnelligkeit' };
  // D156: Name eines Stils für diesen Spieler – Torhüter mit Torwart-Typ („Mitspieler“), sonst das Kürzel des Stils
  const typName = (pa, s) => (pa && pa.typ) || stilDef(s).kurz;
  // Positionsgruppen im Dativ Plural („besser als 89 % der … gleicher Stärke“)
  const GRUPPE_DAT = { TW: 'Torhüter', IV: 'Innenverteidiger', AV: 'Außenverteidiger', ZDM: 'defensiven Mittelfeldspieler', ZM: 'zentralen Mittelfeldspieler',
    AM: 'Außenspieler im Mittelfeld', OM: 'offensiven Mittelfeldspieler', FL: 'Flügelspieler', ST: 'Stürmer' };
  const gruppeDat = pos => { const G = Gen(); const g = G && G.grund ? G.grund(pos) : pos; return GRUPPE_DAT[g] || (pos === 'OM' ? 'ZOM' : pos); };

  // Mit Bericht? (eigene Spieler und Messschalter D78: ja)
  function genau(p) {
    const S = SCO();
    if (!S || !S.aktiv || !S.aktiv()) return true;
    try { return S.hatBericht(p); } catch (e) { return false; }
  }

  // ── D112: Stilprofil, Zeichen, Balken, Rechnung ──────────────────────────
  // Je Spieler und Stil die Passung aus DFLScouting.passung (stärkebereinigt je Position) – zwischengespeichert je Woche und Stil
  let cache = { k: '', m: new Map() };
  function cacheSchluessel() {
    try { const L = W.DFLSpiel && W.DFLSpiel.liga ? W.DFLSpiel.liga() : null;
      return [LEAGUE.season, LEAGUE.week, meinStil(), L ? (L.saisonIndex || 0) + '/' + (L.handel || []).length + '/' + (L.freie || []).length : ''].join(':'); }
    catch (e) { return ''; }
  }
  function profil(p) {
    const S = SCO();
    if (!p || !S || typeof S.passung !== 'function') return null;
    const k = cacheSchluessel();
    if (cache.k !== k) cache = { k, m: new Map() };
    const id = (S.weltId ? S.weltId(p) : p.id) + '|' + p.ovr + '|' + p.pos;
    if (cache.m.has(id)) return cache.m.get(id);
    const r = {};
    KREIS.forEach(s => { let pa = null; try { pa = S.passung(p, s); } catch (e) { pa = null; } r[s] = pa && pa.relevant ? pa : null; });
    const rel = KREIS.filter(s => r[s]);
    const best = rel.slice().sort((a, b) => r[b].pct - r[a].pct)[0] || null;
    const pr = { r, rel, best };
    if (cache.m.size > 3000) cache.m.clear();
    cache.m.set(id, pr);
    return pr;
  }
  // Ebene 1: ein Zeichen – dein Stil mit Haken (ab 65 %), sonst sein bester Stil (ab 65 %), sonst keins; Torhüter mit Torwart-Typ (D156)
  function zeichenDaten(p) {
    const pr = profil(p);
    if (!pr || !pr.best) return null;
    const e = meinStil();
    if (e && pr.r[e] && pr.r[e].pct >= CFG.zeichen.ab) return { stil: e, ok: true, pct: pr.r[e].pct, typ: pr.r[e].typ || null };
    if (pr.r[pr.best].pct >= CFG.zeichen.ab) return { stil: pr.best, ok: false, pct: pr.r[pr.best].pct, typ: pr.r[pr.best].typ || null };
    return null;
  }
  const passtZuMir = p => { try { const z = zeichenDaten(p); return !!(z && z.ok); } catch (e) { return false; } };
  // opt.klein: kleinere Marke (Karten, Draft-Board); opt.titel: false = ohne Tooltip
  function zeichenHtml(p, opt) {
    let z = null;
    try { z = an() || (opt && opt.immer) ? zeichenDaten(p) : null; } catch (e) { z = null; }
    if (!z) return '';
    const st = stilDef(z.stil), mitZahl = genau(p);
    const titel = (z.ok ? 'Passt zu deinem Stil' : 'Typ') + ': ' + (z.typ ? z.typ + ' – ' + st.kurz : st.kurz) + (mitZahl ? ` (${z.pct} %)` : '');
    return `<span class="stil-z${z.ok ? ' ok' : ''}${opt && opt.klein ? ' klein' : ''}" style="--sf:${st.farbe}" role="img" aria-label="${esc(titel)}" title="${esc(titel)}">${ico(st.ic.replace(/^ti-/, ''))}</span>`;
  }
  const klasse = pct => pct >= CFG.zeichen.ab ? 'gut' : pct >= 35 ? 'mittel' : 'schlecht';
  // Ebene 3: Rechnung für einen Stil (Teilwerte gegen die Erwartung für seine Stärke, dieselbe wie im Scout-Bericht)
  function rechnungHtml(p, stil, pa) {
    const S = SCO(), st = stilDef(stil);
    const teile = (S && S.CFG && (pa.typ ? S.CFG.teileTw : S.CFG.teile) && (pa.typ ? S.CFG.teileTw : S.CFG.teile)[stil]) || [];
    const formel = teile.map(([k, g]) => `${de(g, 2)} ${TEIL[k] || k}`).join(' + ');
    const zeilen = (pa.teile || []).map(([k, v, d]) => `<div class="eb-teil"><span>${esc(TEIL[k] || k)}</span><b>${v}</b><span class="eb-spur"><i class="${d >= 0 ? 'plus' : 'minus'}" style="${d >= 0 ? 'left' : 'right'}:50%;width:${Math.min(50, Math.abs(d) / 8 * 50).toFixed(0)}%"></i></span><em class="${d > 0 ? 'plus' : d < 0 ? 'minus' : ''}">${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d)}</em></div>`).join('');
    return `<p><b>${esc(pa.typ ? pa.typ + ' (' + st.kurz + ')' : st.kurz)}: ${pa.pct} %</b> = besser als ${pa.pct} % der ${esc(gruppeDat(pa.pos))} gleicher Stärke in der Liga.</p>
      ${formel ? `<p class="eb-formel">${pa.typ ? 'Torwart-Wert' : 'Stilwert'} = ${esc(formel)}</p>` : ''}${zeilen}
      <p class="eb-klein">Abweichung von der Erwartung für seine Stärke – dieselbe Rechnung wie im Scout-Bericht und bei der KI. Die Stil-Passung der Elf wirkt bis ±4 % auf die Torchancen; Stärke wiegt mehr.</p>`;
  }
  // Ebene 2: vier Balken (dein Stil markiert, „zählt hier nicht“), Ebene 3 hinter „Wie gerechnet?“.
  // opt.genau (Standard: Bericht vorhanden), opt.extra: HTML für Ebene 3 (Detailwerte, Wirkung auf die Elf – Scout-Bericht)
  function stilBlockHtml(p, opt) {
    opt = opt || {};
    const pr = profil(p);
    if (!pr) return '';
    const e = meinStil();
    const kopf = rechts => `<div class="eb-kopf"><b>${ico('chess-knight')}Stil</b><span>${rechts}</span></div>`;
    if (!pr.rel.length) return `<section class="eb-karte eb-stil">${kopf('zählt im Tor nicht')}</section>`;
    const mitZahl = opt.genau != null ? !!opt.genau : genau(p);
    const z = zeichenDaten(p);
    if (!mitZahl) {
      return `<section class="eb-karte eb-stil">${kopf(z ? (z.ok ? 'passt zu dir' : 'anderer Typ') : 'kein klarer Typ')}
        <div class="eb-typ">${z ? `${zeichenHtml(p)}<b>${esc(z.typ || stilDef(z.stil).kurz)}</b>` : `<span class="stil-leer" aria-hidden="true"></span><b>kein Typ</b>`}
          <small>${ico('telescope')}genau mit Scout-Bericht</small></div></section>`;
    }
    const reihen = KREIS.map(s => {
      const st = stilDef(s), pa = pr.r[s], mein = s === e;
      const icon = `<span class="eb-ic" style="--sf:${st.farbe}">${ico(st.ic.replace(/^ti-/, ''))}</span>`;
      const nm = `<span class="eb-nm">${esc(st.kurz)}${pa && pa.typ ? `<em class="eb-tw">${esc(pa.typ)}</em>` : ''}${mein ? '<small>dein Stil</small>' : ''}</span>`;
      if (!pa) return `<div class="eb-reihe aus">${icon}${nm}<span class="eb-leer">zählt hier nicht</span></div>`;
      return `<div class="eb-reihe${mein ? ' mein' : ''}">${icon}${nm}<span class="eb-bahn" role="img" aria-label="${esc(st.kurz)} ${pa.pct} %"><i class="${klasse(pa.pct)}" style="width:${Math.max(3, pa.pct)}%"></i></span><b>${pa.pct} %</b></div>`;
    }).join('');
    const ziel = e && pr.r[e] ? e : pr.best;
    // „am besten“ nur mit klarem Typ (ab der Schwelle des Zeichens) – ein Bester mit 0 % ist kein Typ
    const rechts = pr.r[pr.best].pct >= CFG.zeichen.ab ? 'am besten: ' + esc(typName(pr.r[pr.best], pr.best)) : 'kein klarer Typ';
    return `<section class="eb-karte eb-stil" data-eb-box>${kopf(rechts)}${reihen}
      <button class="eb-tiefer" type="button" data-eb-auf="stil" aria-expanded="false">Wie gerechnet? ${ico('chevron-down')}</button>
      <div class="eb-ebene3" data-eb-ziel="stil" hidden>${rechnungHtml(p, ziel, pr.r[ziel])}${opt.extra || ''}</div></section>`;
  }

  // ── D111: Entwicklung als Pfeil ──────────────────────────────────────────
  const PFEILE = {
    '2': { ic: 'arrow-up', text: 'steigt stark', kl: 'p2' },
    '1': { ic: 'arrow-up-right', text: 'steigt', kl: 'p1' },
    '0': { ic: 'arrow-right', text: 'hält sein Niveau', kl: 'n0' },
    '-1': { ic: 'arrow-down-right', text: 'baut ab', kl: 'm1' },
    '-2': { ic: 'arrow-down', text: 'baut stark ab', kl: 'm2' }
  };
  function stufe(d) {
    const [a, b, c, e] = CFG.pfeil.stufen;
    return d >= a ? 2 : d >= b ? 1 : d > c ? 0 : d > e ? -1 : -2;
  }
  const SL = () => W.DFLSaison || null;
  const ovrFaktor = ovr => { const S = SL(); return S && S.ovrFaktor ? S.ovrFaktor(ovr) : 1; };
  const jugendFaktor = a => { const S = SL(); const j = S && S.CFG && S.CFG.kurve && S.CFG.kurve.jugend; return a <= 20 ? 1 : (j && j[a]) || 1; };
  // Körperalter (D68) nach dieser Saison: Stammspieler altern körperlich langsamer, Bankspieler schneller (ab 27)
  function koerperNachher(x) {
    const S = SL(), K = S && S.CFG && S.CFG.koerper;
    if (!K || x.alter < K.ab || x.praxis === 'ds') return x.koerper || 0;
    const d = x.praxis === 'elf' ? K.jahrStamm : x.praxis === 'bank' ? K.jahrBank : 0;
    return Math.max(K.min, Math.min(K.max, (x.koerper || 0) + d));
  }
  // Erwartete Änderung der Stärke in der nächsten Saison.
  // x = { alter, koerper, ovr, potLo, potHi, praxis: 'elf'|'kader'|'bank'|'ds', training (1–10), pos, quelle: 'eigen'|'welt' }
  // Welt: Erwartungswert von DFLSaison.entwicklung (Jugendschub bis 25, danach ± 0, ab dem Körperalter 31 Abbau −1 … −2).
  // Eigener Verein: Regeln des Spiels (Wochen-Training bis 32, Abbau nach Position ab ALTERUNG_AB) – siehe pfeilModell.
  function erwartung(x) {
    const S = SL();
    const A = (S && S.CFG && S.CFG.abbau) || { ab: 31, abTw: 34, max: 3 };
    const a1 = (x.alter || 25) + 1, gap = Math.max(0, ((x.potLo || x.ovr) + (x.potHi || x.ovr)) / 2 - x.ovr);
    const prax = CFG.spielzeit.praxis[x.praxis] || 1;
    const tempo = ((S && S.CFG && S.CFG.training) ? S.CFG.training.basis + S.CFG.training.jeStufe * (x.training || 5) : 1);
    const ka1 = a1 + koerperNachher(x);
    if (x.quelle === 'eigen') return erwartungEigen(x, { a1, gap, prax, ka1 });
    const abbauAb = x.pos === 'TW' ? A.abTw : A.ab;
    if (a1 <= 25 && gap > 0) {
      const basis = a1 <= 22 ? 3.5 * jugendFaktor(a1) : 2;
      return Math.min(gap, basis * tempo * prax * ovrFaktor(x.ovr));
    }
    if (ka1 < abbauAb) return gap > 0 ? 0.5 * ovrFaktor(x.ovr) : 0;
    const m = Math.max(1, Math.min(A.max || 3, 1 + Math.floor(ka1) - abbauAb));
    return -(1 + m) / 2;
  }
  // Eigener Verein (Spiel): Wochen-Training bis 32 (bundle_match.js: Alter, Spielzeit, Anlage, Form, D48-Kurve), Saisonende nach
  // Alter und Note, Abbau nach Position ab ALTERUNG_AB (engine_main.js, mit Körperalter). Nicht nachrechenbar (Zufall je Woche,
  // Noten) – die Zahlen sind an eigenen Spielern im echten Spiel gemessen (3 Bot-Läufe × 4 Saisons, 2026-10-11, KW 8/20/32 gegen
  // ein Jahr später): Zuwachs je Alter in der nächsten Saison (Stammspieler, Stärke 70), Spielzeit, Trainingsanlage, Abbau je Jahr
  // über ALTERUNG_AB.
  // Befund: eigene Spieler bauen milder ab als die KI-Welt (mit 32: −0,3 statt −1,1 je Saison) – die Regeln des Spiels.
  const pfeilModell = {
    wachs: { 18: 4.8, 19: 4.8, 20: 4.7, 21: 3.8, 22: 2.6, 23: 2.3, 24: 1.8, 25: 1.5, 26: 1.2, 27: 1.0, 28: 0.85, 29: 0.75, 30: 0.4, 31: 0.3, 32: 0.2, 33: 0 },
    // Spielzeit im Spiel (Wochen-Training: 0,15 + 0,85 × Anteil der Einsätze, Training ersetzt bei Jungen einen Teil)
    praxis: { elf: 1.1, kader: 0.8, ds: 0.9, bank: 0.6 },
    // Abbau: Jahre über ALTERUNG_AB → Stärke je Saison (dazwischen linear)
    abbau: [[0, 0], [1, 0.45], [2, 0.75], [4, 1.0], [6, 1.2]],
    // Trainingsanlage (Stufe 1–10) auf den Zuwachs: echt ÷ Modell ohne Training (Alter bis 27, Lücke zum Potenzial > 1) war
    // Fulda (Stufe 3) 0,77 · Bremen (6) 1,16 · Leipzig (8) 1,22 → 0,51 + 0,093 × Stufe, höchstens 1,2 (Dortmund, Stufe 9, außerhalb
    // der Eichung: 1,20 über zwei Saisons)
    training: [0.51, 0.093, 1.2]
  };
  const linear = (pkt, x) => {
    if (x <= pkt[0][0]) return pkt[0][1];
    for (let i = 1; i < pkt.length; i++) if (x <= pkt[i][0]) return pkt[i - 1][1] + (pkt[i][1] - pkt[i - 1][1]) * (x - pkt[i - 1][0]) / (pkt[i][0] - pkt[i - 1][0]);
    return pkt[pkt.length - 1][1];
  };
  function erwartungEigen(x, v) {
    const M = pfeilModell, a = Math.max(18, Math.min(33, v.a1));
    const w = M.wachs[a] != null ? M.wachs[a] : 0;
    const prax = M.praxis[x.praxis] || 1;
    const tr = Math.max(0.6, Math.min(M.training[2] || 1.2, M.training[0] + M.training[1] * (x.training || 5)));
    const wachs = v.gap > 0 ? Math.min(v.gap, w * prax * tr * ovrFaktor(x.ovr)) : 0;
    const ab = x.abbauAb != null && isFinite(x.abbauAb) ? x.abbauAb : (x.pos === 'TW' ? 34 : 31);
    return wachs - linear(M.abbau, v.a1 - ab);
  }
  // Spielzeit dieser Saison: Anteil der Spiele von Beginn (eigener Verein), Startelf/Spieltagskader (Welt)
  function praxisEigen(p) {
    if (p.perspektiv) return 'ds';
    const apps = (p.stats && p.stats.apps) || 0;
    const max = typeof SQUAD !== 'undefined' && Array.isArray(SQUAD) ? Math.max(0, ...SQUAD.map(q => (q.stats && q.stats.apps) || 0)) : 0;
    if (max >= 3) { const a = apps / max; return a >= CFG.spielzeit.stamm ? 'elf' : a < CFG.spielzeit.bank ? 'bank' : 'kader'; }
    // Saisonstart: wie die Aufstellung steht
    const elf = new Set(Object.values((typeof CLUB !== 'undefined' && CLUB && CLUB.lineup) || {}));
    return elf.has(p.id) ? 'elf' : 'kader';
  }
  function praxisWelt(w, team) {
    if (!team) return 'bank';
    try {
      const S = SL(), elf = S && S.teamWerte ? (S.teamWerte(team).elf || []) : Gen().startelfVon(team.roster);
      if (elf.some(q => q === w || q.id === w.id)) return 'elf';
    } catch (e) { /* ohne Elf */ }
    return team.roster.slice().sort((a, b) => b.ovr - a.ovr).slice(0, 18).indexOf(w) >= 0 ? 'kader' : 'bank';
  }
  // Eingabe und Pfeil für einen Spieler: eigener (SQUAD) oder Weltspieler (opt.team = sein Verein, ohne = vereinslos)
  function pfeilDaten(p, opt) {
    opt = opt || {};
    if (!p) return null;
    const eigen = typeof SQUAD !== 'undefined' && Array.isArray(SQUAD) && SQUAD.indexOf(p) >= 0;
    const sc = (typeof CLUB !== 'undefined' && CLUB && CLUB.facilities && CLUB.facilities.scouting) || 5;
    let lo, hi;
    if (eigen && typeof W.potentialRange === 'function') { const r = W.potentialRange(p, sc); lo = r.lo; hi = r.hi; }
    else if (opt.pot) { lo = opt.pot.lo; hi = opt.pot.hi; }
    else { const G = Gen(); const s = G && G.potSichtbar ? G.potSichtbar(p, sc) : p.ovr; lo = hi = s; }
    const x = eigen
      ? { quelle: 'eigen', alter: p.age, koerper: p.koerper || 0, ovr: p.ovr, potLo: lo, potHi: hi, praxis: praxisEigen(p), pos: p.pos,
        training: (CLUB.facilities && CLUB.facilities.training) || 1, abbauAb: typeof W.ALTERUNG_AB === 'function' ? W.ALTERUNG_AB(p) : null }
      : { quelle: 'welt', alter: p.age, koerper: p.koerper || 0, ovr: p.ovr, potLo: lo, potHi: hi, praxis: opt.team ? praxisWelt(p, opt.team) : 'bank',
        pos: Gen() && Gen().dflPos ? Gen().dflPos(p.pos) : p.pos, training: (opt.team && opt.team.anlagen && opt.team.anlagen.training) || 5 };
    const d = erwartung(x);
    return { x, delta: d, stufe: stufe(d), pfeil: PFEILE[String(stufe(d))] };
  }
  const PRAXIS_TEXT = { elf: 'Stammspieler', kader: 'Ergänzung', bank: 'kaum Einsätze', ds: 'Development Squad' };
  // Ebene 2: Pfeil mit Wort (html); Ebene 3: woraus er sich ergibt (rechnung)
  function pfeilTeile(p, opt) {
    const d = pfeilDaten(p, opt);
    if (!d) return null;
    const x = d.x, pf = d.pfeil;
    const pot = x.potLo === x.potHi ? String(x.potLo) : x.potLo + '–' + x.potHi;
    const ka = x.alter + 1 + koerperNachher(x);
    const rechnung = `<p class="eb-klein">Nächste Saison etwa <b>${d.delta >= 0 ? '+' : '−'}${de(Math.abs(d.delta), 1)}</b>: dann ${x.alter + 1} Jahre${Math.abs(ka - x.alter - 1) >= 0.05 ? ` (Körperalter ${de(ka, 1)})` : ''} · ${esc(PRAXIS_TEXT[x.praxis] || '')} · Potenzial ${esc(pot)}. Mit mehr Spielzeit wachsen Junge schneller, Stammspieler altern körperlich langsamer.</p>`;
    return { html: `<span class="eb-pfeil ${pf.kl}" role="img" aria-label="Entwicklung: ${esc(pf.text)}">${ico(pf.ic)}</span><span class="eb-pfeil-text"><b>${esc(pf.text)}</b><small>nächste Saison</small></span>`,
      rechnung, daten: d };
  }
  const pfeilHtml = (p, opt) => { const t = pfeilTeile(p, opt); return t ? t.html : ''; };

  // ── Filter „passt zu meinem Stil“ (je Liste, je Gerät bis zum Neuladen) ──
  const FILTER = {};
  const filter = key => !!FILTER[key];
  function filterSetzen(key, an_) { FILTER[key] = an_ == null ? !FILTER[key] : !!an_; return FILTER[key]; }
  // Chip für eine Liste: data-eb-filter="key" schaltet um, danach ruft der Klick opt.neu() bzw. das Modul zeichnet selbst
  function filterChipHtml(key, n, opt) {
    opt = opt || {};
    const e = meinStil(), st = e ? stilDef(e) : null;
    if (!st) return '';
    return `<button type="button" class="eb-filter${opt.kl ? ' ' + opt.kl : ''}" data-eb-filter="${esc(key)}" aria-pressed="${filter(key)}" title="Nur Spieler, die zu deinem Stil (${esc(st.kurz)}) passen">
      <span class="stil-z ok klein" style="--sf:${st.farbe}" aria-hidden="true">${ico(st.ic.replace(/^ti-/, ''))}</span>passt zu meinem Stil${n != null ? ` <b>${n}</b>` : ''}</button>`;
  }
  // Neu zeichnen je Liste (die Module melden ihre Zeichenfunktion an)
  const NEU = {};
  function filterAnmelden(key, fn) { NEU[key] = fn; }

  // ── Kaderliste (Ebene 1, nur am Handy): Name ganz, nur Stammposition, ein Warnzeichen, Stil-Zeichen, Stärke + Pot, Form,
  //    Fitness; Sortieren, Filter, Legende und „einsatzfähig“ hinter einem Knopf mit Zahl ──
  const blick = () => W.DFLBlick || null;
  const zeilenId = row => { const m = /showSquadPlayerCard\('([^']+)'\)/.exec(row.getAttribute('onclick') || ''); return m ? m[1] : null; };
  // Ein Warnzeichen: rot vor gelb; verletzt steht schon mit Wochen am Namen (.sqo-aus); „will bleiben“ (grün) fällt weg
  const WARN_RANG = [[/rot/, /calendar/], [/rot/, /mood-sad/], [/rot/, /first-aid/], [/gelb/, /bolt/], [/gelb/, /calendar/], [/gelb/, /mood/]];
  function einWarnzeichen(row) {
    const amp = row.querySelector('.blick-ampeln'); if (!amp) return;
    const alle = [...amp.children];
    const verletztSchon = !!row.querySelector('.sqo-aus');
    const kand = alle.filter(a => !a.classList.contains('gruen') && !(verletztSchon && /first-aid/.test(a.innerHTML)));
    const rang = a => { const i = WARN_RANG.findIndex(([k, i2]) => k.test(a.className) && i2.test(a.innerHTML)); return i < 0 ? 99 : i; };
    const beste = kand.sort((a, b) => rang(a) - rang(b))[0] || null;
    alle.forEach(a => { if (a !== beste) a.remove(); });
  }
  function nameMitZeichen(row, p) {
    const nm = row.querySelector('.sqo-name'); if (!nm || row.querySelector('.stil-z')) return;
    let txt = nm.querySelector('.sqo-nm');
    if (!txt) {
      txt = document.createElement('span'); txt.className = 'sqo-nm';
      while (nm.firstChild) txt.appendChild(nm.firstChild);
      nm.appendChild(txt);
    }
    const z = zeichenHtml(p);
    if (z) {
      // Zeichen neben den Namen (nicht hinein): der Name kürzt mit „…“, Zeichen und Haken bleiben ganz
      const zeile = document.createElement('span'); zeile.className = 'eb-nmzeile';
      txt.parentNode.insertBefore(zeile, txt); zeile.appendChild(txt);
      zeile.insertAdjacentHTML('beforeend', z);
    }
    if (passtZuMir(p)) row.setAttribute('data-stil-ok', '1');
  }
  function hinweisZahl() {
    const B = blick(); if (!B || !B.FILTER || typeof SQUAD === 'undefined') return 0;
    return B.FILTER.filter(f => f[0] !== 'alle' && f[0] !== 'stil').reduce((s, f) => s + SQUAD.filter(f[2]).length, 0);
  }
  function kaderErgaenzen() {
    const host = DOM && document.getElementById('sub-squadlist');
    if (!host || !an() || typeof SQUAD === 'undefined') return;
    host.classList.add('eb-kader');
    host.querySelectorAll('.sqo-row').forEach(row => {
      const p = SQUAD.find(q => String(q.id) === zeilenId(row)); if (!p) return;
      einWarnzeichen(row);
      nameMitZeichen(row, p);
    });
    const reihe = host.querySelector('.pos-filter-row:not(.sq-sortrow)');
    if (reihe && !reihe.querySelector('.eb-filterknopf')) {
      const n = hinweisZahl(), B = blick(), akt = B && B.filterAktiv ? B.filterAktiv() : 'alle';
      const f = B && B.FILTER ? B.FILTER.find(x => x[0] === akt) : null;
      reihe.insertAdjacentHTML('beforeend', `<button type="button" class="eb-filterknopf${akt !== 'alle' ? ' an' : ''}" data-eb-kader="filter" aria-label="Filter und Sortieren${n ? ': ' + n + ' Hinweise' : ''}">${ico('adjustments-horizontal')}${n ? `<b>${n}</b>` : ''}</button>`);
      const e = meinStil(), st = e ? stilDef(e) : null;
      const leiste = `<div class="eb-leiste">${akt !== 'alle' && f ? `<button type="button" class="eb-aktiv" data-eb-kader="alle">${esc(f[1])} ${ico('x')}</button>` : ''}
        ${st ? `<span class="eb-legende"><span class="stil-z ok klein" style="--sf:${st.farbe}" aria-hidden="true">${ico(st.ic.replace(/^ti-/, ''))}</span>= passt zu deinem Stil (${esc(st.kurz)})</span>` : ''}</div>`;
      reihe.insertAdjacentHTML('afterend', leiste);
    }
  }
  // Filter-Blatt (Ebene 2): einsatzfähig, Sortieren, Zeigen (Ampel-Filter + Stil), Legende hinter ⓘ
  const SORT = [['ovr', 'Stärke'], ['age', 'Alter'], ['pos', 'Position'], ['name', 'Name']];
  function kaderFilterBlatt() {
    const box = DOM && document.querySelector('#app-blatt .app-blatt-box'), B = blick();
    if (!box || !B) return;
    const malen = () => {
      const akt = B.filterAktiv ? B.filterAktiv() : 'alle', sort = W.SQ_SORT || 'ovr';
      const einsatz = document.querySelector('#sub-squadlist .med-einsatz');
      const chips = B.FILTER.map(([id, t, f]) => {
        const n = id === 'alle' ? 0 : SQUAD.filter(f).length;
        const z = id === 'stil' && meinStil() ? `<span class="stil-z ok klein" style="--sf:${stilDef(meinStil()).farbe}" aria-hidden="true">${ico(stilDef(meinStil()).ic.replace(/^ti-/, ''))}</span>` : '';
        return `<button type="button" class="blick-chip" data-eb-zeige="${id}" aria-pressed="${akt === id}">${z}${esc(t)}${id === 'alle' ? '' : ` <b>${n}</b>`}</button>`;
      }).join('');
      if (typeof W.infoKarteSetzen === 'function') {
        const fc = W.DFLAppShell && DFLAppShell.formHtml;
        const form = fc ? [-2, -1, 0, 1, 2].map(fc).join(' ') : '−2 … +2';
        W.infoKarteSetzen('eb-kader', 'Kaderliste', `<b>Form</b> ${form}: letzte 3 Noten gegen den Saisonschnitt. <b>Balken</b> = Fitness. Ein Zeichen je Spieler: Vertrag läuft aus, will weg, müde. ` +
          `<b>Stil-Zeichen</b>: passt zu einem Stil (ab ${CFG.zeichen.ab} %, mit Haken = deiner). Mehr im Spieler-Blatt.`);
      }
      box.innerHTML = `<div class="app-griff"></div><button class="app-blatt-zu" aria-label="Schließen"><i class="ti ti-x" aria-hidden="true"></i></button>
        <div class="app-sheet-titel">Kaderliste${typeof W.infoBtn === 'function' ? W.infoBtn('eb-kader') : ''}</div>
        ${einsatz ? `<div class="eb-einsatz">${einsatz.innerHTML}</div>` : ''}
        <div class="eb-gruppe"><small>Sortieren</small><div class="eb-seg" role="group" aria-label="Sortieren">${SORT.map(([k, t]) =>
          `<button type="button" data-eb-sort="${k}" aria-pressed="${sort === k}">${t}</button>`).join('')}</div></div>
        <div class="eb-gruppe"><small>Zeigen</small><div class="blick-filter eb-chips" role="group" aria-label="Filter">${chips}</div></div>
        <button class="app-knopf haupt" type="button" data-eb-fertig="1">${ico('check')}Fertig</button>`;
    };
    box.onclick = ev => {
      const t = ev.target.closest('button'); if (!t) return;
      if (t.dataset.ebSort) { if (typeof W.setSqSort === 'function') W.setSqSort(t.dataset.ebSort); malen(); }
      else if (t.dataset.ebZeige) { if (B.filterSetzen) B.filterSetzen(t.dataset.ebZeige); kaderNeu(); malen(); }
      else if (t.dataset.ebFertig) blattSchliessen();
    };
    delete box.dataset.spieler;
    malen();
    blattAuf();
  }
  function kaderNeu() { if (typeof W.renderSquadOverview === 'function') { try { W.renderSquadOverview(); } catch (e) { console.warn('[DFL-Ebenen] Kaderliste', e); } } }
  function blattAuf() {
    const b = document.getElementById('app-blatt'); if (!b) return;
    b.classList.add('auf'); document.body.classList.add('app-gesperrt');
    if (W.DFLAppShell && DFLAppShell.cta) try { DFLAppShell.cta(); } catch (e) { /* Haupt-Button optional */ }
  }
  function blattSchliessen() {
    const b = document.getElementById('app-blatt'); if (!b) return;
    b.classList.remove('auf'); document.body.classList.remove('app-gesperrt');
    if (W.DFLAppShell && DFLAppShell.cta) try { DFLAppShell.cta(); } catch (e) { /* Haupt-Button optional */ }
  }

  // ── Entlassen-Blatt (Ebene 2): Dead Cap jetzt oder zum Saisonende (D93), dann entscheiden ──
  function entlassenBlatt(p, kontext) {
    const box = DOM && document.querySelector('#app-blatt .app-blatt-box'), K = W.DFLKader, SW = W.DFLSaisonwechsel;
    if (!box || !K || !p) return;
    const vor = SW && SW.istVorgemerkt ? SW.istVorgemerkt(p.id) : false;
    const grund = SW && SW.vormerkbarGrund ? SW.vormerkbarGrund(p.id) : 'Ohne Saisonvorbereitung.';
    const vergleich = SW && SW.entlassenVergleich ? SW.entlassenVergleich(p) : null;
    const jetzt = K.deadCapVon ? K.deadCapVon(p) : 0;
    const name = ((p.firstName ? p.firstName + ' ' : '') + p.name).trim();
    box.innerHTML = `<div class="app-griff"></div><button class="app-blatt-zu" aria-label="Schließen"><i class="ti ti-x" aria-hidden="true"></i></button>
      <div class="app-sheet-titel">Entlassen</div>
      <div class="eb-entl-kopf"><b>${esc(name)}</b><small>${esc(p.pos)} · ${p.age} Jahre · Cap Hit ${esc(mio(K.capHitJahr ? K.capHitJahr(p) : 0))}</small></div>
      ${vergleich || `<div class="sw-vergleich"><div class="sw-vg"><small>Jetzt entlassen</small><b>${esc(mio(jetzt))}</b><span>Dead Cap dieser Saison</span></div></div>`}
      <div class="eb-entl-knoepfe">
        <button class="app-knopf rot" type="button" data-eb-entl="jetzt">${ico('scissors')}<span class="ak-zwei">Jetzt entlassen<small>Dead Cap ${esc(mio(jetzt))}</small></span></button>
        ${vor ? `<button class="app-knopf" type="button" data-eb-entl="vor">${ico('scissors-off')}Vormerkung aufheben</button>`
          : !grund ? `<button class="app-knopf" type="button" data-eb-entl="vor">${ico('calendar-time')}<span class="ak-zwei">Am Saisonende<small>spielt bis dahin</small></span></button>`
            : `<p class="eb-klein">${ico('calendar-time')} Am Saisonende: ${esc(grund)}</p>`}
        <button class="app-knopf" type="button" data-eb-entl="zurueck">${ico('chevron-left')}Zurück</button></div>`;
    box.onclick = ev => {
      const t = ev.target.closest('[data-eb-entl]'); if (!t) return;
      const was = t.getAttribute('data-eb-entl');
      if (was === 'zurueck') { if (W.DFLAppShell) DFLAppShell.spielerBlatt(p, kontext); return; }
      if (was === 'vor') { if (SW && SW.vormerkenKlick) SW.vormerkenKlick(p.id); if (W.DFLAppShell) DFLAppShell.spielerBlatt(p, kontext); return; }
      if (was === 'jetzt') {
        // Das Blatt ist die Rückfrage (Dead Cap steht da) – DFLKader.entlassen fragt sonst ein zweites Mal
        const c = W.confirm;
        try { W.confirm = () => true; K.entlassen(p.id); } finally { W.confirm = c; }
        if (typeof SQUAD !== 'undefined' && !SQUAD.some(q => q.id === p.id)) blattSchliessen();
      }
    };
    delete box.dataset.spieler;
    blattAuf();
  }

  // ── Free Agency (Ebene 1 am Handy): Zeilen ohne Knöpfe, ein Tipp öffnet das Blatt (Scouten, Angebot, Typ) ──
  function faKlick(ev) {
    const row = ev.target.closest && ev.target.closest('#tr-sub-frei .market-row[data-welt]');
    if (!row || ev.target.closest('button') || !an()) return;
    const S = SCO(); if (!S || !S.blatt) return;
    ev.preventDefault(); ev.stopPropagation();
    S.blatt(row.getAttribute('data-welt'));
  }

  // ── Erklärsätze im Scouting → ⓘ (Ebene 3) ────────────────────────────────
  function scoutingErklaerungen() {
    if (!DOM || !an() || typeof W.infoKarteSetzen !== 'function' || typeof W.infoBtn !== 'function') return;
    const banner = document.getElementById('scout-banner');
    const zeile = banner && banner.children[1];
    if (zeile && !zeile.querySelector('.info-btn')) {
      W.infoKarteSetzen('eb-scout-stufe', 'Scouting', 'Die Stufe bestimmt die Genauigkeit bei Talenten und fremden Spielern: Scouts gleichzeitig (Stufe ÷ 2), Spannen auf dem Draft-Board, verborgene Nieten.');
      zeile.innerHTML = `Scouting Stufe ${(CLUB.facilities && CLUB.facilities.scouting) || 1} ${W.infoBtn('eb-scout-stufe')}`;
    }
    const fac = document.getElementById('scout-facility'), desc = fac && fac.querySelector('.fc-desc'), nm = fac && fac.querySelector('.fc-name');
    if (desc && nm && !nm.querySelector('.info-btn')) {
      W.infoKarteSetzen('eb-scout-abteilung', 'Scouting-Abteilung', desc.innerHTML);
      nm.insertAdjacentHTML('beforeend', ' ' + W.infoBtn('eb-scout-abteilung'));
      desc.remove();
    }
  }

  // ── Bedienung: Aufklappen (Ebene 3), Filter-Chips, Kader-Knopf ──────────
  if (DOM) {
    document.addEventListener('click', ev => {
      const t = ev.target && ev.target.closest ? ev.target : null; if (!t) return;
      const auf = t.closest('[data-eb-auf]');
      if (auf) {
        const box = auf.closest('[data-eb-box]') || auf.parentElement;
        const ziel = box && box.querySelector(`[data-eb-ziel="${auf.getAttribute('data-eb-auf')}"]`);
        if (!ziel) return;
        ev.preventDefault(); ev.stopPropagation();
        const offen = ziel.hidden; ziel.hidden = !offen;
        auf.setAttribute('aria-expanded', String(offen)); auf.classList.toggle('auf', offen);
        return;
      }
      const f = t.closest('[data-eb-filter]');
      if (f) {
        ev.preventDefault(); ev.stopPropagation();
        const key = f.getAttribute('data-eb-filter');
        filterSetzen(key);
        if (NEU[key]) { try { NEU[key](); } catch (e) { console.warn('[DFL-Ebenen] Filter ' + key, e); } }
        return;
      }
      const k = t.closest('[data-eb-kader]');
      if (k) {
        ev.preventDefault(); ev.stopPropagation();
        if (k.getAttribute('data-eb-kader') === 'filter') kaderFilterBlatt();
        else { const B = blick(); if (B && B.filterSetzen) B.filterSetzen('alle'); kaderNeu(); }
        return;
      }
      faKlick(ev);
    }, true);
  }

  // ── Einhängen ────────────────────────────────────────────────────────────
  {
    const _orig = W.renderSquadOverview;
    if (typeof _orig === 'function') {
      W.renderSquadOverview = function () {
        const r = _orig.apply(this, arguments);
        try { kaderErgaenzen(); } catch (e) { console.warn('[DFL-Ebenen] Kaderliste', e); }
        return r;
      };
      try { renderSquadOverview = W.renderSquadOverview; } catch (e) { /* nur im Spiel */ }
    }
  }
  {
    const _orig = W.renderScoutTab;
    if (typeof _orig === 'function') {
      W.renderScoutTab = function () {
        const r = _orig.apply(this, arguments);
        try { scoutingErklaerungen(); } catch (e) { console.warn('[DFL-Ebenen] Scouting', e); }
        return r;
      };
      try { renderScoutTab = W.renderScoutTab; } catch (e) { /* nur im Spiel */ }
    }
  }
  // Listen mit Filter „passt zu meinem Stil“ zeichnen sich beim Umschalten neu
  filterAnmelden('fa', () => { if (typeof W.renderFreeAgentList === 'function') W.renderFreeAgentList(); });
  filterAnmelden('draft', () => { if (typeof W.renderScoutTab === 'function') W.renderScoutTab(); });
  filterAnmelden('draftboard', () => { if (W.DFLKader && DFLKader.zeichne) DFLKader.zeichne(); });
  ['kandidaten', 'bericht'].forEach(k => filterAnmelden(k, () => { if (W.DFLScouting && DFLScouting.zeichne) DFLScouting.zeichne(); }));
  ['zuhaben', 'vorrat', 'werte'].forEach(k => filterAnmelden(k, () => { if (W.DFLTrade && DFLTrade.zeichne) DFLTrade.zeichne(); }));
  // Messung (Prüflauf, Vorschau): wie viele Spieler einer Liste bekommen ein Zeichen
  function zaehle(liste) {
    const o = { n: 0, ok: 0, typ: 0, ohne: 0, tw: 0 };
    (liste || []).forEach(p => { o.n++; const pr = profil(p); if (!pr || !pr.best) { o.tw++; return; } const z = zeichenDaten(p); if (!z) o.ohne++; else if (z.ok) o.ok++; else o.typ++; });
    return o;
  }
  // Spielstand schon geladen (initGame lädt vor den Patches): Kaderliste einmal nachziehen
  try { if (an() && DOM && document.getElementById('sub-squadlist')) kaderErgaenzen(); } catch (e) { /* ohne Spielstand */ }

  W.DFLEbenen = { CFG, KREIS, PFEILE, stilDef, meinStil, profil, zeichenDaten, zeichenHtml, passtZuMir, stilBlockHtml, rechnungHtml,
    erwartung, stufe, pfeilDaten, pfeilTeile, pfeilHtml, pfeilModell, praxisEigen, praxisWelt, filter, filterSetzen, filterChipHtml, filterAnmelden,
    entlassenBlatt, kaderFilterBlatt, zaehle, genau };
  console.log('[DFL-Ebenen v1] aktiv — drei Ebenen (D111): Kaderliste mit Filter-Knopf, Free Agency als Zeilen, Erklärsätze hinter ⓘ, Entwicklung als Pfeil; Stil-Zeichen (D112) ab ' + CFG.zeichen.ab + ' % mit Balken und Rechnung');
})();
