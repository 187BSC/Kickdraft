/* ═══════════════════════════════════════════════════════════════════════════
   DFL · POSITIONSFREMD  ·  v2   (D81, Nutzer 2026-10-10: „Wenn ein Spieler positionsfremd spielt, anzeigen, inwiefern ihn das
   beeinträchtigt: dann steht dort bspw. 80 (−4), und er hat dann für Spiele und die Engine 76.“ – „Wenn du die Position hast
   als 2. oder 3., dann −2, sonst viel, viel mehr.“ · D95, Nutzer 2026-10-10: „LF und RF, LV und RV und LM und RM als Positionen
   für die Formationen als auch für die Spieler“)
   ─────────────────────────────────────────────────────────────────────────
   Eine Zahl je Spieler und Platz: DFLPosition.abzug(p, platz)
     Stammposition 0 · gelernte 2./3. Position −2 · nicht gelernt nach dem Abstand zur nächsten gelernten Position:
     benachbart −8, zwei Schritte −12, drei −18 · Torwart ↔ Feld −24.
     v2 (D95): zwölf Positionen mit Seite (TW, IV, LV, RV, ZDM, ZM, LM, RM, ZOM, LF, RF, ST), Wege über das Feld aus dem
     Generator (DFLGenerator.positionsAbzug – dieselbe Rechnung für Welt und Spiel): andere Seite −12 (LV–IV–RV, LM–ZM–RM,
     LF–ST–RF), eine Reihe weiter auf derselben Seite und LV/RV ↔ IV −8. Die Seite eines Platzes kommt aus seiner Lage auf dem
     Feld (platz: x links/rechts, 4-2-3-1 außen = LF/RF, Schienen der Dreier-/Fünferkette = LV/RV, LM/RM im Mittelfeld).
     Altbestand ohne Seite (AV, FL) gilt bis zur Umstellung des Spielstands als beide Seiten (FL auch LM/RM wie bis D95).
     v1: LM/RM-Plätze zählten als FL (D85), Nachbarschaft der acht Positionen ohne Seite.
   Dieselbe Zahl überall:
     · Anzeige: Taktikfeld und Startelf-Liste „84 −2“, Kaderliste (Startelf), Spieler-Blatt „84 (−2) → 82“ (dfl_app_shell.js)
     · Teamstärke: computeTeamRatings rechnet mit der wirksamen Stärke (Stärke − Abzug)
     · Beste Elf: lineup_auto_patch.js fragt DFLPosition.zuordnen (ungarische Methode: größte Summe der wirksamen Stärke) und
       DFLPosition.formationWert (Ø der wirksamen Stärke) – vorher gierig nach Eignung (100/88/62 …) + Stärke
     · Engine: player_attributes.js zieht denselben Abzug vom Grundniveau der Detailwerte ab (Haken SpielerAttribute.abzugHaken),
       v2 auch für KI-Spieler (D95: „KI-Gegner bekommen dieselbe Zahl“); die Adapter geben der Engine die Rolle des Platzes wie
       bisher (TacticsSystem.slotToPos: AV, AM, FL …) und die Detailwerte für den Platz mit Seite (dfl_engine_patch.js)
   API: DFLPosition.abzug(p, platz) · .info(p, platz) · .wirksam(p, platz) · .platz(slot) · .zuordnen(plaetze, spieler)
        · .formationWert(plaetze, spieler) · .elf() · .badge(p, platz) · .blattHtml(p, kontext) · .aktiv() · .frisch() · .CFG
        · .positionen(p) · .posVon(kürzel) · .rolle(slot) · .POS12
   Lädt nach lineup_auto_patch.js, player_attributes.js, engine_main.js, dfl_app_shell.js; vor init_bootstrap.js.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const CFG = {
    gelernt: 2,                 // gelernte 2./3. Position (p.positions[1…])
    abstand: [0, 8, 12, 18],    // nicht gelernt: 1, 2, 3 Schritte zur nächsten gelernten Position
    torwart: 24,                // Torwart ↔ Feld (wie bisher in player_attributes.js)
    aussenAb: 25,               // D95: Plätze ab diesem Abstand zur Mitte (x, 0–100) liegen außen
    fluegelBisY: 36,            // D95: außen bis zu dieser Höhe (y, 0 = Angriff) ein Flügel (LF/RF, 4-2-3-1), tiefer LM/RM
    gleichstand: 10000,         // Beste Elf: bei gleicher Summe gewinnt die Elf mit weniger Abzug (Abzug × Stärke ÷ gleichstand)
    aus: false                  // Messschalter: D81 aus (Beste Elf, Teamstärke, Engine und Anzeige wie vorher)
  };
  const Gen = window.DFLGenerator;
  const dfl = () => typeof CLUB !== 'undefined' && CLUB && CLUB.dfl && CLUB.dfl.aktiv;
  const aktiv = () => !CFG.aus && !!dfl() && !!Gen;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const versteckt = (o, k, v) => { try { Object.defineProperty(o, k, { value: v, enumerable: false, writable: true, configurable: true }); } catch (e) { o[k] = v; } return v; };

  // ── Positionen (Spiel-Kürzel: ZOM statt OM der Welt) ─────────────────────
  const POS12 = ['TW', 'IV', 'LV', 'RV', 'ZDM', 'ZM', 'LM', 'RM', 'ZOM', 'LF', 'RF', 'ST'];
  const spielPos = x => (x === 'OM' ? 'ZOM' : x);
  // Kürzel normieren (LA → LF, DM → ZDM, OM → ZOM); Altbestand AV/FL/AM bleibt, bis der Spielstand umgestellt ist
  const posVon = x => (x ? spielPos(Gen ? Gen.dflPos(x) : x) : null);
  // Platz eines Formations-Slots aus seiner Lage (D95): Gruppe + x (Seite) + y (Flügel oder Mittelfeld)
  function platzAusSlot(s) {
    const g = String(s.group || '').toUpperCase(), l = String(s.label || '').toUpperCase();
    const x = isFinite(s.x) ? s.x : 50, y = isFinite(s.y) ? s.y : 50, aussen = Math.abs(x - 50) >= CFG.aussenAb;
    const seite = (li, re) => (x < 50 ? li : re);
    const breit = () => (y <= CFG.fluegelBisY ? seite('LF', 'RF') : seite('LM', 'RM'));
    if (g === 'TW') return 'TW';
    if (g === 'IV') return 'IV';
    if (g === 'AV') return seite('LV', 'RV');
    if (g === 'ST') return aussen ? seite('LF', 'RF') : 'ST';
    if (g === 'OM') return aussen ? breit() : 'ZOM';
    if (g === 'ZM') return l.indexOf('DM') >= 0 ? 'ZDM' : (aussen || l === 'LM' || l === 'RM') ? breit() : 'ZM';
    // unbekannte Gruppe: Rolle des Basisspiels, außen mit Seite
    const r = rolle(s);
    return r === 'AV' ? seite('LV', 'RV') : r === 'AM' ? breit() : r === 'FL' ? seite('LF', 'RF') : posVon(r) || 'ZM';
  }
  // Rolle in der Engine (bleibt wie vor D95: TW, IV, AV, ZDM, ZM, AM, ZOM, FL, ST – die Engine kennt die Seite über die Koordinaten)
  function rolle(slot) {
    try { if (window.TacticsSystem && typeof TacticsSystem.slotToPos === 'function') return TacticsSystem.slotToPos(slot); } catch (e) { /* Ersatz */ }
    return slot && (slot.group || slot.label);
  }
  const platzVon = z => (z && typeof z === 'object' ? platzAusSlot(z) : posVon(z));
  const platz = slot => (slot ? platzVon(slot) : null);
  function positionen(p) {
    const aus = [];
    (Gen ? Gen.positionenVon(p) : (p && p.positions) || []).forEach(x => { const n = posVon(x); if (n && aus.indexOf(n) < 0) aus.push(n); });
    return aus;
  }

  // ── Die eine Zahl ────────────────────────────────────────────────────────
  // info: { abzug, art: 'stamm' | 'gelernt' | 'fremd' | 'torwart', platz, rang (gelernt), schritte + von (fremd), feldImTor }
  function info(p, ziel) {
    const z = platzVon(ziel);
    if (!Gen) return { abzug: 0, art: 'stamm', platz: z };
    const r = Gen.positionsAbzug(positionen(p), z, CFG);
    return Object.assign({}, r, { platz: spielPos(r.platz) || z, von: r.von ? spielPos(r.von) : r.von });
  }
  const abzug = (p, ziel) => info(p, ziel).abzug;
  // D102: Rückstand nach einer Verletzung (dfl_medizin_patch.js) zählt wie ein Abzug – Beste Elf, Teamstärke, Engine. Nur eigene
  // Spieler: KI-Spieler bringen ihn schon in der Stärke mit (dfl_engine_patch.js gegnerTeam: Stärke − Rückstand)
  // Rückmeldung 17.10.: Bonus einer Sonderkarte (Spieler/Team der Woche, dfl_woche_patch.js) wirkt wie ein negativer Rückstand
  const reha = p => (p && istEigen(p) ? (window.DFLMedizin ? window.DFLMedizin.rueckstand(p) || 0 : 0) - (window.DFLWoche ? DFLWoche.bonus(p) || 0 : 0) : 0);
  const wirksam = (p, ziel) => Math.max(0, ((p && p.ovr) || 0) - abzug(p, ziel) - reha(p));

  // ── Beste Zuordnung (ungarische Methode, n Zeilen ≤ m Spalten, minimiert die Kosten) ─────────────────
  function ungarisch(k) {
    const n = k.length, m = k[0].length, INF = 1e15;
    const u = new Array(n + 1).fill(0), v = new Array(m + 1).fill(0), p = new Array(m + 1).fill(0), weg = new Array(m + 1).fill(0);
    for (let i = 1; i <= n; i++) {
      p[0] = i; let j0 = 0;
      const minv = new Array(m + 1).fill(INF), benutzt = new Array(m + 1).fill(false);
      do {
        benutzt[j0] = true; const i0 = p[j0]; let delta = INF, j1 = 0;
        for (let j = 1; j <= m; j++) if (!benutzt[j]) {
          const c = k[i0 - 1][j - 1] - u[i0] - v[j];
          if (c < minv[j]) { minv[j] = c; weg[j] = j0; }
          if (minv[j] < delta) { delta = minv[j]; j1 = j; }
        }
        for (let j = 0; j <= m; j++) if (benutzt[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta;
        j0 = j1;
      } while (p[j0] !== 0);
      do { const j1 = weg[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
    }
    const aus = new Array(n).fill(-1);
    for (let j = 1; j <= m; j++) if (p[j]) aus[p[j] - 1] = j - 1;
    return aus;
  }
  const VERBOTEN = 1e6;
  // Je Platz der Index in `spieler` oder −1. Größte Summe der wirksamen Stärke; Torwart ↔ Feld nie (solche Plätze bleiben frei
  // für den Notnagel in lineup_auto_patch.js, wie bisher); bei Gleichstand gewinnt die Elf mit weniger Abzug.
  function zuordnen(plaetze, spieler) {
    const n = plaetze.length, m = spieler.length;
    if (!n) return [];
    if (!m) return plaetze.map(() => -1);
    const kosten = plaetze.map(z => {
      const zeile = spieler.map(q => {
        const a = abzug(q, z), o = ((q && q.ovr) || 50) - reha(q);
        return a >= CFG.torwart ? VERBOTEN : -(o - a) + a * o / CFG.gleichstand;
      });
      for (let i = 0; i < n; i++) zeile.push(0);                 // „frei lassen“ – besser als verboten, schlechter als jeder Spieler
      return zeile;
    });
    return ungarisch(kosten).map((j, i) => j >= 0 && j < m && kosten[i][j] < VERBOTEN ? j : -1);
  }
  // Ø der wirksamen Stärke einer Formation (freie Plätze zählen 0 – wie bewerteFormation bisher)
  function formationWert(plaetze, spieler) {
    if (!plaetze.length) return -1;
    let s = 0;
    zuordnen(plaetze, spieler).forEach((j, i) => { if (j >= 0) s += wirksam(spieler[j], plaetze[i]); });
    return s / plaetze.length;
  }

  // ── Eigene Elf ───────────────────────────────────────────────────────────
  const slots = () => (typeof FORMATIONS !== 'undefined' && typeof CLUB !== 'undefined' && CLUB && FORMATIONS[CLUB.formation]) || [];
  const spieler = id => (id && typeof getPlayer === 'function' ? getPlayer(id) : null) || null;
  function elf() {
    return slots().map(s => { const p = spieler(CLUB.lineup && CLUB.lineup[s.id]); return p ? { p, s, platz: platz(s) } : null; }).filter(Boolean);
  }
  const slotVon = id => slots().find(s => CLUB.lineup && CLUB.lineup[s.id] === id) || null;
  const istEigen = p => typeof SQUAD !== 'undefined' && Array.isArray(SQUAD) && SQUAD.indexOf(p) >= 0;

  // ── Engine: derselbe Abzug in den Detailwerten (v2, D95: auch KI-Spieler – vorher galt für sie der alte Malus des Basisspiels,
  //    2,2 je Kettenschritt) ──────────────────────────────────────────────────────────────────────────────────────────────────
  if (window.SpielerAttribute) window.SpielerAttribute.abzugHaken = (p, pos) => (aktiv() ? abzug(p, pos) + reha(p) : null);
  // Werte je Fremdposition liegen im Cache (p._werteAlt) – neu rechnen, wenn sich Positionen oder Regeln ändern
  const regel = () => [CFG.gelernt, CFG.abstand.join(','), CFG.torwart, 'D95'].join('|');
  function frisch() {
    if (typeof SQUAD === 'undefined' || !Array.isArray(SQUAD)) return 0;
    let n = 0;
    SQUAD.forEach(p => { if (p && p._werteAlt) { try { delete p._werteAlt; } catch (e) { p._werteAlt = null; } n++; } if (p) versteckt(p, '_d81', null); });
    return n;
  }
  {
    const _orig = window.spielerWerte;
    if (typeof _orig === 'function') {
      window.spielerWerte = function (p, einsatzPos) {
        if (p && typeof p === 'object' && einsatzPos) {
          const sig = aktiv() ? positionen(p).join('/') + '#' + regel() + (istEigen(p) ? '#e' : '') : '-';
          if (p._d81 !== sig) {
            try { delete p._werteAlt; } catch (e) { p._werteAlt = null; }
            versteckt(p, '_d81', sig);
          }
        }
        return _orig.apply(this, arguments);
      };
    }
  }

  // ── Teamstärke ───────────────────────────────────────────────────────────
  // Basis (engine_main.js) = Ø von Stärke/Angriff/Abwehr der Elf; darauf liegen Moral, Fitness und Spielvorbereitung als Faktoren
  // → hier im Verhältnis „wirksam ÷ roh“ skaliert, damit die Faktoren erhalten bleiben
  {
    const _orig = window.computeTeamRatings;
    if (typeof _orig === 'function') {
      window.computeTeamRatings = function () {
        const r = _orig.apply(this, arguments);
        try {
          if (!aktiv() || !r || typeof r !== 'object') return r;
          const e = elf(); if (!e.length) return r;
          const s = { o: 0, ow: 0, a: 0, aw: 0, d: 0, dw: 0 };
          e.forEach(x => {
            const z = abzug(x.p, x.platz) + reha(x.p);
            s.o += x.p.ovr || 0; s.ow += Math.max(0, (x.p.ovr || 0) - z);
            s.a += x.p.att || 0; s.aw += Math.max(0, (x.p.att || 0) - z);
            s.d += x.p.def || 0; s.dw += Math.max(0, (x.p.def || 0) - z);
          });
          const cap = v => Math.round(Math.max(30, Math.min(95, v)));
          if (s.o > 0 && typeof r.overall === 'number') r.overall = cap(r.overall * s.ow / s.o);
          if (s.a > 0 && typeof r.attack === 'number') r.attack = cap(r.attack * s.aw / s.a);
          if (s.d > 0 && typeof r.defense === 'number') r.defense = cap(r.defense * s.dw / s.d);
        } catch (err) { console.warn('[DFL-Position] Teamstärke', err); }
        return r;
      };
      try { computeTeamRatings = window.computeTeamRatings; } catch (e) { /* window reicht */ }
    }
  }

  // ── Anzeige ──────────────────────────────────────────────────────────────
  const basis = p => (typeof ovrBase === 'function' ? ovrBase(p) : (p && p.ovr) || 0);
  const klasse = a => a <= CFG.gelernt ? 'gelernt' : a >= CFG.torwart ? 'torwart' : 'fremd';
  function grund(i) {
    if (i.art === 'gelernt') return i.rang === 2 ? '2. Position' : i.rang === 3 ? '3. Position' : 'gelernte Position';
    if (i.art === 'torwart') return i.feldImTor ? 'Feldspieler im Tor' : 'Torwart im Feld';
    if (i.art === 'fremd') return i.schritte === 1 ? `nicht gelernt, neben ${i.von}` : `nicht gelernt, ${i.schritte} Schritte von ${i.von}`;
    return 'Stammposition';
  }
  // Kleine Marke „−2“ (gelb: gelernt, rot: nicht gelernt, dunkelrot: Torwart ↔ Feld); Titel mit der ganzen Rechnung
  function badge(p, ziel) {
    if (!aktiv() || !p) return '';
    const i = info(p, ziel); if (!i.abzug) return '';
    const o = basis(p);
    return `<em class="dfl-abz ${klasse(i.abzug)}" title="Als ${esc(i.platz)}: ${o} (−${i.abzug}) → ${o - i.abzug} · ${esc(grund(i))}">−${i.abzug}</em>`;
  }
  // Spieler-Blatt: „In der Elf als AV: 84 (−2) → 82 · 2. Position“
  function blattHtml(p, kontext) {
    if (!aktiv() || !p || p.perspektiv || !CLUB.lineup) return '';
    const s = kontext && kontext.typ === 'slot' ? slots().find(x => x.id === kontext.key) : slotVon(p.id);
    if (!s || CLUB.lineup[s.id] !== p.id) return '';
    const i = info(p, platz(s)), o = basis(p);
    if (!i.abzug) return `<div class="dfl-abz-zeile">In der Elf als <b>${esc(i.platz)}</b> · Stammposition</div>`;
    return `<div class="dfl-abz-zeile">In der Elf als <b>${esc(i.platz)}</b>: ${o} (<em class="dfl-abz-t ${klasse(i.abzug)}">−${i.abzug}</em>) → <b>${o - i.abzug}</b> · ${esc(grund(i))}</div>`;
  }
  // Marke vor das Potenzial setzen (Startelf-Liste, Kaderliste: „84 +1 −2 Pot 85“)
  function markeSetzen(ovrEl, html) {
    if (!ovrEl || !html || ovrEl.querySelector('.dfl-abz')) return;
    const pot = ovrEl.querySelector('.squad-pot');
    if (pot) pot.insertAdjacentHTML('beforebegin', html); else ovrEl.insertAdjacentHTML('beforeend', html);
  }
  // Platzkürzel des Basisspiels (AV, AM, FL …) → Platz mit Seite (LV, LM, LF …; v1: nur AM → FL)
  function kuerzelSetzen(el, s) {
    if (!el) return;
    const z = platz(s), t = el.textContent.trim();
    if (z && t !== z && /^[A-ZÄÖÜ]{2,3}$/.test(t)) el.textContent = z;
  }
  function feldZeichnen() {
    const els = document.querySelectorAll('#pitch .p-slot');
    slots().forEach((s, i) => {
      const el = els[i]; if (!el) return;
      const tok = el.querySelector('.p-token');
      kuerzelSetzen(tok && tok.classList.contains('mit-gesicht') ? tok.querySelector('.tk-pos') : tok, s);
      const p = spieler(CLUB.lineup[s.id]);
      if (!p) { kuerzelSetzen(el.querySelector('.p-name'), s); return; }
      const ov = el.querySelector('.p-ovr');
      if (ov && !ov.querySelector('.dfl-abz')) ov.insertAdjacentHTML('beforeend', badge(p, platz(s)));
    });
  }
  function startelfListe() {
    document.querySelectorAll('#squad-list .squad-row').forEach(row => {
      const m = /clickSlot\('([^']+)'\)/.exec(row.getAttribute('onclick') || '');
      const s = m && slots().find(x => x.id === m[1]); if (!s) return;
      kuerzelSetzen(row.querySelector('.squad-pos'), s);
      const p = spieler(CLUB.lineup[s.id]);
      if (p) markeSetzen(row.querySelector('.squad-ovr'), badge(p, platz(s)));
    });
  }
  function kaderliste() {
    const plaetze = {};
    elf().forEach(x => { plaetze[x.p.id] = x.platz; });
    document.querySelectorAll('#sub-squadlist .sqo-row').forEach(row => {
      const m = /showSquadPlayerCard\('([^']+)'\)/.exec(row.getAttribute('onclick') || ''), id = m && m[1];
      if (!id || !plaetze[id]) return;
      markeSetzen(row.querySelector('.squad-ovr'), badge(spieler(id), plaetze[id]));
    });
  }
  [['renderPitch', feldZeichnen], ['renderSquadList', startelfListe], ['renderSquadOverview', kaderliste]].forEach(([fn, nach]) => {
    const _orig = window[fn];
    if (typeof _orig !== 'function') return;
    window[fn] = function () {
      const r = _orig.apply(this, arguments);
      try { if (aktiv()) nach(); } catch (e) { console.warn('[DFL-Position] Anzeige', fn, e); }
      return r;
    };
  });

  // ── Alte Spielstände: eigener Kader auf Positionen mit Seite (D95, einmal, Marke CLUB.dfl.positionen = 12) ────────────
  // Die Welt stellt dfl_liga_patch.js beim Entpacken um (Marke pos: 12 in LEAGUE.dflWelt). Eigener Kader: wer in der Aufstellung auf
  // einem Platz mit Seite steht, behält diese Seite (die Elf bleibt, wie sie ist); sonst je Gruppe ausgeglichen nach Stärke, Flügel
  // lernen LM/RM ihrer Seite (Bestandsschutz: dort −2 statt −8). Free-Agent-Spiegel übernimmt die Seiten der Welt.
  const altbestand = p => positionen(p).some(x => Gen && Gen.altbestand(x));
  function umstellen() {
    if (!dfl() || !Gen || !Gen.seitenUmstellen || typeof SQUAD === 'undefined' || !Array.isArray(SQUAD)) return 0;
    if (CLUB.dfl.positionen === 12) return 0;
    const vorgabe = new Map();
    slots().forEach(s => {
      const p = spieler(CLUB.lineup && CLUB.lineup[s.id]), sd = Gen.seiteVon(platz(s));
      if (p && sd && altbestand(p) && !vorgabe.has(p)) vorgabe.set(p, sd);
    });
    const n = Gen.seitenUmstellen(SQUAD, { vorgabe, saat: (CLUB.dfl.seed || '') + '|' + (CLUB.dfl.franchiseId || '') });
    let nf = 0;
    if (Array.isArray(CLUB.freeAgents)) {
      let welt = null; try { welt = window.DFLSpiel ? DFLSpiel.liga() : null; } catch (e) { welt = null; }
      const frei = new Map(((welt && welt.freie) || []).map(w => [String(w.id), w]));
      const rest = [];
      CLUB.freeAgents.forEach(q => {
        if (!q || !altbestand(q)) return;
        const w = frei.get(String(q.dflId || String(q.id || '').replace(/^fa_/, '')));
        if (w && !Gen.positionenVon(w).some(x => Gen.altbestand(x))) { q.positions = Gen.positionenVon(w).map(spielPos); q.pos = q.positions[0]; nf++; }
        else rest.push(q);
      });
      nf += Gen.seitenUmstellen(rest, { saat: (CLUB.dfl.seed || '') + '|fa' });
    }
    CLUB.dfl.positionen = 12;
    if (n) {
      frisch();
      try { if (window.DFLSpiel) { DFLSpiel.eigenSync(); DFLSpiel.weltGeaendert(); } } catch (e) { /* Welt optional */ }
      const elfOk = elf().every(x => abzug(x.p, x.platz) <= CFG.gelernt);
      try {
        if (typeof addNews === 'function') addNews('club', `Positionen mit Seite: ${n} Spieler umgestellt`,
          `Außenverteidiger heißen jetzt LV oder RV, Flügel LF oder RF – je Seite ausgeglichen; Flügel haben LM/RM ihrer Seite gelernt (dort −2). ` +
          (elfOk ? 'Deine Aufstellung bleibt, wie sie ist.' : 'Prüf deine Aufstellung: nicht jeder steht auf seiner Seite („Beste Elf“ stellt neu auf).'));
      } catch (e) { /* Meldung optional */ }
    }
    if (n || nf) console.log(`[DFL-Position] D95: eigener Kader ${n}, Free Agents ${nf} auf Positionen mit Seite umgestellt`);
    return n;
  }
  {
    const _orig = window._afterLoad;
    if (typeof _orig === 'function') window._afterLoad = function () {
      const r = _orig.apply(this, arguments);
      try { if (umstellen()) { if (typeof renderAll === 'function') renderAll(); } } catch (e) { console.warn('[DFL-Position] Umstellung', e); }
      return r;
    };
  }

  window.DFLPosition = { CFG, POS12, aktiv, abzug, info, wirksam, platz, platzAusSlot, rolle, posVon, spielPos, positionen, zuordnen, formationWert, elf,
    badge, blattHtml, frisch, ungarisch, slotVon, umstellen };

  // Spielstand schon geladen (initGame lädt vor den Patches): alte Stände auf Positionen mit Seite (D95), Werte-Cache leeren,
  // Feld und Listen mit Abzug zeichnen
  try {
    umstellen();
    frisch();
    if (aktiv() && typeof SQUAD !== 'undefined' && SQUAD.length) {
      if (typeof renderPitch === 'function') renderPitch();
      if (typeof renderBench === 'function') renderBench();
      if (typeof renderRatings === 'function') renderRatings();
    }
  } catch (e) { console.warn('[DFL-Position] Laden', e); }
  console.log('[DFL-Position v2] aktiv — positionsfremd mit einer Zahl (D81) und Positionen mit Seite (D95): Stamm 0, gelernt −2, nicht gelernt −8/−12/−18 (andere Seite −12), Torwart ↔ Feld −24; Plätze aus der Lage auf dem Feld; Beste Elf, Teamstärke und Engine mit Abzug, auch für KI-Spieler');
})();
