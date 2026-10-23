/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · MESSUNG  ·  v1   (monetarisierung-anpassungen.md, Abschnitt 3 – Testphase)
   ─────────────────────────────────────────────────────────────────────────
   Zählt nur lokal auf dem Gerät, verschickt wird nichts – die Zahlen gehen nur mit dem Feedback mit:
     · Minuten je Sitzung (Schnitt, Median) – Sitzung = sichtbare App; > 5 Minuten im Hintergrund beginnt eine neue
     · Minuten je Saison, getrennt nach Flutlicht und Kickdraft
     · Sitzungen je Tag
     · Pflichtanzeigen: gezeigt / wäre gekommen (Platzhalter im Browser zählt mit, kickstil_werbung.js) und Joker-Videos
     · Joker-Knöpfe: gesehen und gedrückt, je Joker (Blatt „Joker“ und Knöpfe am Ort des Problems, data-jk-ort)
   Beide Spiele der Gesamt-App teilen den Speicher „gesamt-messung“ (bauen.sh hängt die Datei als gesamt/messung.js in
   Kickdraft ein). Kickdraft: hängt sich an DFLNutzung.bericht() – das Test-Kit (dfl_testkit.js) schickt den Text mit dem
   Feedback. Flutlicht (ohne eigenes Test-Kit): Eintrag „Testdaten teilen“ im Mehr-Blatt.
   API: KSMessung.daten() · .bericht() · .joker(art, 'gesehen'|'gedrueckt') · .teilen() · .leeren()
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const KEY = 'gesamt-messung', TAKT = 15, PAUSE_NEU = 300, MAX_SITZ = 80, MAX_SAISON = 40, MAX_TAGE = 60;
  const lies = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } };
  const schreib = d => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* ohne Speicher */ } };
  const spiel = () => { try { return (typeof CLUB !== 'undefined' && CLUB && CLUB.dfl) || window.DFLTestkit ? 'kd' : 'fl'; } catch (e) { return 'fl'; } };
  const NAME = { fl: 'Vereinskarriere', kd: 'Kickdraft' };
  const sichtbar = () => !document.visibilityState || document.visibilityState === 'visible';
  const heute = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const saisonKey = () => { try { return (typeof CLUB !== 'undefined' && CLUB && typeof LEAGUE !== 'undefined' && LEAGUE) ? spiel() + '|' + (CLUB.name || '?') + '|' + LEAGUE.season : null; } catch (e) { return null; } };

  // ── Sitzungen und Spielzeit ───────────────────────────────────────────────
  let zuletztSichtbar = 0;
  function sitzungBeginnen(d) {
    d.sitzungen = (d.sitzungen || []).concat([{ t: Date.now(), s: 0, g: spiel() }]).slice(-MAX_SITZ);
    const t = heute(); d.tage = d.tage || {}; d.tage[t] = (d.tage[t] || 0) + 1;
    const tage = Object.keys(d.tage).sort(); while (tage.length > MAX_TAGE) delete d.tage[tage.shift()];
  }
  function ticken() {
    if (!sichtbar()) return;
    const d = lies(), jetzt = Date.now();
    if (!zuletztSichtbar || jetzt - zuletztSichtbar > PAUSE_NEU * 1000 || !(d.sitzungen || []).length) sitzungBeginnen(d);
    zuletztSichtbar = jetzt;
    const s = d.sitzungen[d.sitzungen.length - 1]; s.s += TAKT; s.g = spiel();
    const k = saisonKey();
    if (k) {
      d.saisons = d.saisons || {}; d.saisons[k] = (d.saisons[k] || 0) + TAKT;
      const ks = Object.keys(d.saisons); while (ks.length > MAX_SAISON) delete d.saisons[ks.shift()];
    }
    schreib(d);
  }
  ticken();
  setInterval(() => { try { ticken(); } catch (e) { /* später */ } }, TAKT * 1000);
  document.addEventListener('visibilitychange', () => { try { if (sichtbar()) ticken(); } catch (e) { /* später */ } });

  // ── Joker-Knöpfe: gesehen (einmal je Erscheinen) und gedrückt ─────────────
  function joker(art, was) {
    if (!art) return;
    const d = lies(); d.joker = d.joker || {};
    const j = d.joker[art] = d.joker[art] || { gesehen: 0, gedrueckt: 0 };
    j[was === 'gedrueckt' ? 'gedrueckt' : 'gesehen']++;
    schreib(d);
  }
  const SEL = '[data-jk-ort], #ks-joker [data-joker], [data-joker-scout]';
  const artVon = el => el.getAttribute('data-jk-ort') || (el.hasAttribute('data-joker-scout') ? 'scout' : el.getAttribute('data-joker'));
  // „gesehen“ einmal je Joker, Ziel und Spielwoche – neu gezeichnete Ansichten zählen nicht doppelt
  const gesehen = new Set();
  const woche = () => { try { return LEAGUE.season + '-' + LEAGUE.week; } catch (e) { return ''; } };
  setInterval(() => {
    try {
      document.querySelectorAll(SEL).forEach(el => {
        if (el.__ksGesehen || !el.getClientRects().length) return;
        el.__ksGesehen = 1;
        const k = artVon(el) + '|' + (el.getAttribute('data-jk-arg') || el.getAttribute('data-arg') || el.getAttribute('data-joker-scout') || '') + '|' + woche();
        if (gesehen.has(k)) return;
        gesehen.add(k); joker(artVon(el), 'gesehen');
      });
    } catch (e) { /* später */ }
  }, 1500);
  document.addEventListener('click', ev => {
    const el = ev.target.closest && ev.target.closest(SEL);
    if (el) joker(artVon(el), 'gedrueckt');
  }, true);

  // ── Auswertung ────────────────────────────────────────────────────────────
  const min = s => Math.round(s / 6) / 10;
  const median = a => { if (!a.length) return 0; const b = a.slice().sort((x, y) => x - y), m = Math.floor(b.length / 2); return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
  const schnitt = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
  function daten() {
    const d = lies(), w = (() => { try { return JSON.parse(localStorage.getItem('gesamt-werbung') || '{}') || {}; } catch (e) { return {}; } })();
    const sitz = (d.sitzungen || []).filter(x => x.s >= TAKT).map(x => x.s);
    const tage = Object.values(d.tage || {});
    const saisons = { fl: [], kd: [] };
    const aktuell = saisonKey();
    Object.keys(d.saisons || {}).forEach(k => { if (k === aktuell) return; const g = k.split('|')[0]; (saisons[g] = saisons[g] || []).push(d.saisons[k]); });
    return {
      sitzungen: sitz.length, minSitzSchnitt: min(schnitt(sitz)), minSitzMedian: min(median(sitz)),
      tage: tage.length, sitzungenJeTag: Math.round(schnitt(tage) * 10) / 10,
      minSaison: { fl: saisons.fl.map(min), kd: saisons.kd.map(min) },
      minSaisonSchnitt: { fl: min(schnitt(saisons.fl)), kd: min(schnitt(saisons.kd)) },
      pflichtGezeigt: w.pflicht || 0, pflichtWaere: w.waere || 0, jokerVideos: w.videos || 0,
      spielMinGesamt: min(w.spielSek || 0), joker: d.joker || {}
    };
  }
  const de = v => (Math.round(v * 10) / 10).toLocaleString('de-DE');
  function bericht() {
    const x = daten(), z = [];
    z.push(`Messung (nur dieses Gerät): ${x.sitzungen} Sitzungen an ${x.tage} Tagen, Ø ${de(x.sitzungenJeTag)} je Tag`);
    z.push(`Minuten je Sitzung: Ø ${de(x.minSitzSchnitt)}, Median ${de(x.minSitzMedian)} · Spielzeit gesamt ${de(x.spielMinGesamt)} Min`);
    ['fl', 'kd'].forEach(g => { if (x.minSaison[g].length) z.push(`Minuten je Saison ${NAME[g]}: Ø ${de(x.minSaisonSchnitt[g])} (letzte: ${x.minSaison[g].slice(-6).map(de).join(' · ')})`); });
    z.push(`Pflichtanzeigen: ${x.pflichtGezeigt} gezeigt, ${x.pflichtWaere} wären gekommen (ohne Werbeanbieter) · Joker-Videos: ${x.jokerVideos}`);
    const j = Object.keys(x.joker);
    if (j.length) z.push('Joker-Knöpfe (gesehen/gedrückt): ' + j.map(a => `${a} ${x.joker[a].gesehen}/${x.joker[a].gedrueckt}`).join(', '));
    return z.join('\n');
  }

  // Kickdraft: an DFLNutzung.bericht() anhängen (dfl_wege_patch.js), das Test-Kit schickt es mit dem Feedback
  if (window.DFLNutzung && typeof DFLNutzung.bericht === 'function') {
    const _b = DFLNutzung.bericht;
    DFLNutzung.bericht = function () { let a = ''; try { a = String(_b.apply(this, arguments)); } catch (e) { a = ''; } return (a ? a + '\n' : '') + bericht(); };
  } else if (!window.DFLNutzung) {
    window.DFLNutzung = { bericht };
  }

  // Flutlicht (ohne Test-Kit): „Testdaten teilen“ im Mehr-Blatt
  function teilen() {
    const text = 'Unter Flutlicht – Testdaten\n' + bericht();
    const toast = (t, a) => { if (typeof window.showToast === 'function') window.showToast(t, a || 'info'); };
    try { if (navigator.share) { navigator.share({ title: 'Testdaten', text }).catch(() => {}); return text; } } catch (e) { /* weiter */ }
    try { navigator.clipboard.writeText(text).then(() => toast('Testdaten kopiert – einfach im Chat einfügen.', 'success'), () => toast(text)); } catch (e) { toast(text); }
    return text;
  }
  if (!window.DFLTestkit) {
    setInterval(() => {
      try {
        const box = document.querySelector('#app-sheet .app-sheet-box');
        if (!box || box.querySelector('[data-ks-messung]')) return;
        const b = document.createElement('button'); b.className = 'app-eintrag'; b.setAttribute('data-ks-messung', '1');
        b.innerHTML = '<i class="ti ti-chart-dots" aria-hidden="true"></i><span class="app-eintrag-txt"><b>Testdaten teilen</b><small>Spielzeit, Sitzungen, Anzeigen – nur wenn du es schickst</small></span><i class="ti ti-chevron-right app-pfeil" aria-hidden="true"></i>';
        box.appendChild(b);
      } catch (e) { /* später */ }
    }, 1500);
    document.addEventListener('click', ev => {
      const b = ev.target.closest && ev.target.closest('[data-ks-messung]');
      if (!b) return;
      ev.preventDefault(); ev.stopPropagation();
      const s = document.getElementById('app-sheet'); if (s) s.classList.remove('auf');
      teilen();
    }, true);
  }

  window.KSMessung = { daten, bericht, joker, teilen, leeren: () => schreib({}) };
  console.log('[Kickstil-Messung v1] aktiv — Spielzeit, Sitzungen, Anzeigen und Joker-Knöpfe (nur lokal, nur mit Feedback)');
})();
