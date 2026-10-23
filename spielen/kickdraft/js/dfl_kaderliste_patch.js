/* ═══════════════════════════════════════════════════════════════════════════
   DFL · KADER IN ABSCHNITTEN + MITSCROLLEN BEIM ZIEHEN  ·  v1   (D98, D79)
   ─────────────────────────────────────────────────────────────────────────
   D98 (Nutzer 2026-10-10: „Beim Kader hätte ich gerne eine Unterteilung in: Startelf, Bank, Tribüne, Development.“)
     Kaderliste (Kader → Kaderliste) in vier Abschnitte, ebenso die Liste unter dem Taktikfeld (Kader → Aufstellung,
     dort statt „Auswechselspieler“; abschaltbar über CFG.aufstellung):
       Startelf    – die elf Plätze der Aufstellung
       Bank        – Spieltagskader ohne die Elf: 7 Feldspieler nach Stärke × Fitness + Ersatztorwart
                     (DFLTraining.spieltagskader – dieselbe Auswahl, die die Engine auf die Bank setzt)
       Tribüne     – alle übrigen im 28er-Kader: nicht nominiert, verletzt, gesperrt, Streik, Verletztenliste
       Development – Development Squad (D45)
     Innerhalb der Abschnitte bleibt die Reihenfolge wie bisher (Kaderliste: gewählte Sortierung und Positionsfilter,
     Aufstellung: Plätze bzw. Kader); nur die Zeilen werden umgehängt, Klicks und Ziehen bleiben unverändert.
   D79 (Nutzer 2026-10-10: „Ziehen, aber das ist ja schon drin, aber der Bildschirm muss sich mitbewegen.“)
     Beim Ziehen eines Spielers in der Aufstellung scrollt die Seite am oberen/unteren Rand mit (Randzone CFG.rand Pixel über
     der Leiste unten bzw. unter dem App-Kopf, je näher am Rand desto schneller, höchstens CFG.tempo Pixel je Bild).
     Maus: HTML5-Ziehen wie bisher (squadDragStart … squadDrop in app_main.js), Position aus dragover.
     Touch: lange drücken (CFG.halten ms), dann ziehen – Ablegen über dieselbe Funktion (squadDrop → performSwap);
     wer gleich wischt, scrollt wie gewohnt.
   API: DFLKaderliste.abschnitt(p) · .einteilung() · .CFG
   Lädt nach dfl_trainingsgruppe_patch.js, dfl_app_shell.js und dfl_position_patch.js; vor init_bootstrap.js.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const CFG = {
    aufstellung: true,     // D98 auch in der Liste unter dem Taktikfeld
    halten: 350,           // Touch: so lange drücken, bis das Ziehen beginnt (ms)
    schwelle: 10,          // Touch: wer sich vorher weiter bewegt, scrollt
    rand: 90,              // Randzone fürs Mitscrollen (px)
    tempo: 18              // höchstens so viele Pixel je Bild (≈ 1 000 px/s)
  };
  const dfl = () => typeof CLUB !== 'undefined' && CLUB && CLUB.dfl && CLUB.dfl.aktiv;
  const spieler = id => (id && typeof getPlayer === 'function' ? getPlayer(id) : null) || null;

  // ── D98: Einteilung ──────────────────────────────────────────────────────
  const ABSCHNITTE = [
    ['startelf', 'Startelf', ''],
    ['bank', 'Bank', 'Spieltagskader: 7 Feldspieler nach Stärke × Fitness (die Einwechsler im Spiel) + Ersatztorwart'],
    ['tribuene', 'Tribüne', 'nicht im Spieltagskader'],
    ['development', 'Development', 'Development Squad: trainiert, spielt nicht']
  ];
  function einteilung() {
    const elf = new Set();
    ((typeof FORMATIONS !== 'undefined' && FORMATIONS[CLUB.formation]) || []).forEach(s => { const id = CLUB.lineup && CLUB.lineup[s.id]; if (id) elf.add(id); });
    let kader = null;
    try { kader = window.DFLTraining && DFLTraining.spieltagskader ? DFLTraining.spieltagskader() : null; } catch (e) { kader = null; }
    return p => !p ? 'tribuene' : p.perspektiv ? 'development' : elf.has(p.id) ? 'startelf' : (kader && kader.has(p.id)) ? 'bank' : 'tribuene';
  }
  const abschnitt = p => einteilung()(p);
  function kopf(k, titel, hilfe, n, extra) {
    const d = document.createElement('div');
    d.className = 'squad-section-title kl-kopf';
    d.setAttribute('data-abschnitt', k);
    if (hilfe) d.title = hilfe;
    let zahl = String(n);
    if (k === 'development') { const max = window.DFLSaison && DFLSaison.CFG && DFLSaison.CFG.perspektiv; if (max) zahl = n + '/' + max; }
    d.innerHTML = `<span>${titel}</span><span class="kl-zahl">${zahl}</span>${extra || ''}`;
    return d;
  }
  function leer() { const d = document.createElement('div'); d.className = 'kl-leer'; d.textContent = 'niemand'; return d; }

  // Kaderliste: alle vier Abschnitte, leere mit „niemand“
  function kaderlisteTeilen() {
    const liste = document.querySelector('#sub-squadlist .sqo-list');
    if (!liste || liste.querySelector('.kl-kopf')) return;
    const zeilen = [...liste.children].filter(e => e.classList.contains('sqo-row'));
    if (!zeilen.length) return;
    const art = einteilung(), g = { startelf: [], bank: [], tribuene: [], development: [] };
    zeilen.forEach(z => { const m = /showSquadPlayerCard\('([^']+)'\)/.exec(z.getAttribute('onclick') || ''); g[art(spieler(m && m[1]))].push(z); });
    const frag = document.createDocumentFragment();
    ABSCHNITTE.forEach(([k, titel, hilfe]) => {
      frag.appendChild(kopf(k, titel, hilfe, g[k].length));
      if (g[k].length) g[k].forEach(z => frag.appendChild(z)); else frag.appendChild(leer());
    });
    liste.appendChild(frag);
    liste.classList.add('kl-geteilt');
  }
  // Aufstellung: „Auswechselspieler“ → Bank, Tribüne, Development (leere Tribüne/Development ohne Kopf)
  function aufstellungTeilen() {
    const host = document.getElementById('squad-list');
    if (!host || host.querySelector('.kl-kopf')) return;
    const titel = [...host.children].filter(e => e.classList.contains('squad-section-title'));
    if (titel.length < 2) return;
    const zeilen = [];
    for (let e = titel[1].nextElementSibling; e; e = e.nextElementSibling) if (e.classList.contains('squad-row')) zeilen.push(e);
    const art = einteilung(), g = { bank: [], tribuene: [], development: [], startelf: [] };
    zeilen.forEach(z => { const m = /clickBench\('([^']+)'\)/.exec(z.getAttribute('onclick') || ''); g[art(spieler(m && m[1]))].push(z); });
    g.tribuene = g.tribuene.concat(g.startelf);       // (kommt nicht vor: Elf steht oben)
    const frag = document.createDocumentFragment();
    ABSCHNITTE.slice(1).forEach(([k, titel, hilfe]) => {
      if (!g[k].length && k !== 'bank') return;
      const h = kopf(k, titel, hilfe, g[k].length); h.style.marginTop = '14px';
      frag.appendChild(h);
      g[k].forEach(z => frag.appendChild(z));
    });
    titel[1].replaceWith(frag);
    if (!titel[0].querySelector('.kl-zahl')) {
      const n = host.querySelectorAll('.squad-row:not(.empty)').length - zeilen.length;
      titel[0].classList.add('kl-kopf'); titel[0].setAttribute('data-abschnitt', 'startelf');
      titel[0].innerHTML = `<span>Startelf</span><span class="kl-zahl">${Math.max(0, n)}</span>`;
    }
  }
  [['renderSquadOverview', kaderlisteTeilen, () => true], ['renderSquadList', aufstellungTeilen, () => CFG.aufstellung]].forEach(([fn, teile, an]) => {
    const _orig = window[fn];
    if (typeof _orig !== 'function') return;
    window[fn] = function () {
      const r = _orig.apply(this, arguments);
      try { if (dfl() && an()) teile(); } catch (e) { console.warn('[DFL-Kaderliste] Abschnitte', fn, e); }
      return r;
    };
  });

  // ── D79: Mitscrollen beim Ziehen ─────────────────────────────────────────
  const zug = { aktiv: false, y: null, quelle: null, ziel: null, raf: 0, touch: false };
  const sichtbar = e => !!e && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden' && e.getBoundingClientRect().height > 0;
  function scrollZiel(el) {
    for (let e = el && el.parentElement; e && e !== document.body && e !== document.documentElement; e = e.parentElement) {
      const st = getComputedStyle(e);
      if (/(auto|scroll)/.test(st.overflowY) && e.scrollHeight > e.clientHeight + 2) return e;
    }
    return document.scrollingElement || document.documentElement;
  }
  // Sichtbarer Bereich: Ziel-Element bzw. Fenster ohne die festen Leisten (App-Kopf oben, Leiste und Haupt-Button unten)
  function bereich(ziel) {
    let oben = 0, unten = window.innerHeight;
    if (ziel !== document.scrollingElement && ziel !== document.documentElement) {
      const r = ziel.getBoundingClientRect(); oben = Math.max(0, r.top); unten = Math.min(unten, r.bottom);
    }
    const kopfEl = document.getElementById('app-kopf');
    if (sichtbar(kopfEl)) { const r = kopfEl.getBoundingClientRect(); if (r.top <= 1 && r.bottom < window.innerHeight / 2) oben = Math.max(oben, r.bottom); }
    ['app-nav', 'app-cta'].forEach(id => {
      const e = document.getElementById(id);
      if (sichtbar(e)) { const r = e.getBoundingClientRect(); if (r.top > window.innerHeight / 2) unten = Math.min(unten, r.top); }
    });
    return { oben, unten };
  }
  function schritt() {
    zug.raf = 0;
    if (!zug.aktiv) return;
    if (zug.y != null) {
      const ziel = zug.ziel || (zug.ziel = scrollZiel(zug.quelle)), b = bereich(ziel), R = CFG.rand;
      let f = 0;
      if (zug.y < b.oben + R) f = -Math.min(1, (b.oben + R - zug.y) / R);
      else if (zug.y > b.unten - R) f = Math.min(1, (zug.y - (b.unten - R)) / R);
      if (f) {
        const vor = ziel.scrollTop;
        ziel.scrollTop = vor + Math.sign(f) * Math.max(2, Math.round(CFG.tempo * f * f));
        if (ziel.scrollTop !== vor && zug.touch) touchZiel();       // unter dem Finger liegt jetzt ein anderer Platz
      }
    }
    zug.raf = requestAnimationFrame(schritt);
  }
  function zugStart(quelle) {
    zug.aktiv = true; zug.quelle = quelle; zug.ziel = null; zug.y = null;
    if (!zug.raf) zug.raf = requestAnimationFrame(schritt);
  }
  function zugEnde() {
    zug.aktiv = false; zug.y = null; zug.ziel = null; zug.quelle = null; zug.touch = false;
    if (zug.raf) cancelAnimationFrame(zug.raf);
    zug.raf = 0;
  }
  const zeileVon = t => t && t.closest ? t.closest('#squad-list .squad-row[draggable="true"]') : null;

  // Maus (HTML5-Ziehen aus app_main.js): Rand aus dragover
  document.addEventListener('dragstart', ev => {
    const zeile = zeileVon(ev.target);
    if (!zeile) return;
    if (touch.wartet || touch.aktiv) {                         // Touch-Ziehen läuft (unten) – kein zweites Ziehen des Browsers
      ev.preventDefault();
      if (touch.wartet) touchLos();
      return;
    }
    zugStart(zeile);
  }, true);
  document.addEventListener('dragover', ev => { if (zug.aktiv && !zug.touch) zug.y = ev.clientY; }, true);
  document.addEventListener('dragleave', ev => { if (zug.aktiv && !zug.touch && !ev.relatedTarget) zug.y = null; }, true);   // Fenster verlassen
  document.addEventListener('dragend', () => { if (zug.aktiv && !zug.touch) zugEnde(); }, true);
  document.addEventListener('drop', () => { if (zug.aktiv && !zug.touch) zugEnde(); }, true);

  // Touch: lange drücken, ziehen, ablegen
  const touch = { wartet: false, aktiv: false, timer: 0, x0: 0, y0: 0, x: 0, y: 0, hoch: 0, zeile: null, von: null, geist: null, ueber: null, sperre: 0 };
  const quelleVon = z => { const m = /squadDragStart\(event,'(slot|bench)','([^']+)'\)/.exec((z && z.getAttribute('ondragstart')) || ''); return m ? { type: m[1], key: m[2] } : null; };
  const ablageVon = z => { const m = /squadDrop\(event,'(slot|bench)','([^']+)'\)/.exec((z && z.getAttribute('ondrop')) || ''); return m ? { type: m[1], key: m[2] } : null; };
  function touchZiel() {
    const el = document.elementFromPoint(touch.x, touch.y);
    const z = el && el.closest ? el.closest('#squad-list .squad-row') : null;
    const ziel = z && z !== touch.zeile && ablageVon(z) ? z : null;
    if (ziel === touch.ueber) return;
    if (touch.ueber) touch.ueber.classList.remove('drag-over');
    if (ziel) ziel.classList.add('drag-over');
    touch.ueber = ziel;
  }
  // Die gezogene Zeile schwebt etwas über dem Finger – so bleibt der Platz darunter (Ablageziel, grün markiert) sichtbar
  function geistSetzen() {
    if (touch.geist) touch.geist.style.transform = `translate(${Math.round(touch.x - touch.x0)}px, ${Math.round(touch.y - touch.y0 - touch.hoch)}px) scale(.97)`;
  }
  function touchLos() {
    clearTimeout(touch.timer);
    if (!touch.wartet || !touch.zeile || !document.body.contains(touch.zeile)) { touchAbbruch(); return; }
    touch.wartet = false; touch.aktiv = true;
    if (typeof CLUB !== 'undefined' && CLUB) CLUB.selected = null;
    const z = touch.zeile, r = z.getBoundingClientRect(), g = z.cloneNode(true);
    ['onclick', 'ondragstart', 'ondragover', 'ondrop', 'ondragend', 'draggable', 'id'].forEach(a => g.removeAttribute(a));
    g.querySelectorAll('[id]').forEach(e => e.removeAttribute('id'));
    g.classList.remove('dragging', 'selected', 'drag-over'); g.classList.add('kl-geist');
    g.setAttribute('aria-hidden', 'true');
    Object.assign(g.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px' });
    z.parentElement.appendChild(g);                              // in der Liste: gleiche Gestaltung wie die Zeile
    touch.geist = g; touch.x0 = touch.x; touch.y0 = touch.y; touch.hoch = Math.round((touch.y - r.top) + 12);   // Unterkante über dem Finger
    geistSetzen();
    z.classList.add('dragging');
    document.body.classList.add('kl-zieht');
    try { if (navigator.vibrate) navigator.vibrate(12); } catch (e) { /* ohne Vibration */ }
    zugStart(z); zug.touch = true; zug.y = touch.y;
    touchZiel();
  }
  function touchAufraeumen() {
    clearTimeout(touch.timer);
    if (touch.geist) touch.geist.remove();
    if (touch.zeile) touch.zeile.classList.remove('dragging');
    if (touch.ueber) touch.ueber.classList.remove('drag-over');
    document.body.classList.remove('kl-zieht');
    Object.assign(touch, { wartet: false, aktiv: false, zeile: null, von: null, geist: null, ueber: null });
    if (zug.touch) zugEnde();
  }
  function touchAbbruch() { if (touch.wartet || touch.aktiv) touchAufraeumen(); }
  const liste = document.getElementById('squad-list');
  if (liste) {
    liste.addEventListener('touchstart', ev => {
      if (!dfl() || ev.touches.length !== 1) { touchAbbruch(); return; }
      const z = zeileVon(ev.target), von = quelleVon(z);
      if (!z || !von) return;
      const t = ev.touches[0];
      Object.assign(touch, { wartet: true, aktiv: false, x0: t.clientX, y0: t.clientY, x: t.clientX, y: t.clientY, zeile: z, von });
      clearTimeout(touch.timer);
      touch.timer = setTimeout(touchLos, CFG.halten);
    }, { passive: true });
    liste.addEventListener('touchmove', ev => {
      if (!touch.wartet && !touch.aktiv) return;
      const t = ev.touches[0]; if (!t) return;
      touch.x = t.clientX; touch.y = t.clientY;
      if (touch.wartet) { if (Math.hypot(touch.x - touch.x0, touch.y - touch.y0) > CFG.schwelle) touchAbbruch(); return; }   // Wischen = Scrollen
      if (ev.cancelable) ev.preventDefault();                    // beim Ziehen scrollt nur das Mitscrollen
      zug.y = touch.y;
      geistSetzen(); touchZiel();
    }, { passive: false });
    liste.addEventListener('touchend', ev => {
      if (touch.wartet) { touchAbbruch(); return; }              // kurz getippt: normaler Klick
      if (!touch.aktiv) return;
      if (ev.cancelable) ev.preventDefault();                    // kein Klick hinterher (würde den Platz auswählen)
      touch.sperre = Date.now();
      const ziel = touch.ueber && ablageVon(touch.ueber), von = touch.von;
      touchAufraeumen();
      if (!ziel || !von || (ziel.type === von.type && ziel.key === von.key) || typeof squadDrop !== 'function') return;
      try { SQUAD_DRAG = { type: von.type, key: von.key }; } catch (e) { return; }    // app_main.js: Quelle wie beim Maus-Ziehen
      squadDrop({ preventDefault() { /* kein Ereignis */ } }, ziel.type, ziel.key);
    }, { passive: false });
    liste.addEventListener('touchcancel', touchAbbruch);
  }
  document.addEventListener('contextmenu', ev => { if (touch.wartet || touch.aktiv) ev.preventDefault(); }, true);
  // Sicherheitsnetz: ein Klick direkt nach dem Ablegen gehört nicht zum Tippen
  document.addEventListener('click', ev => {
    if (touch.sperre && Date.now() - touch.sperre < 500 && zeileVon(ev.target)) { ev.preventDefault(); ev.stopPropagation(); }
  }, true);

  // Kader immer aktuell (Fehler 2026-10-13: Verletzungen und Karten erschienen in der Aufstellung erst nach „Tauschen“,
  // weil switchAppView('squad') nichts neu zeichnet): beim Öffnen und nach jeder Woche/jedem Spiel neu zeichnen, wenn der
  // Kader zu sehen ist. Nach dem Aufruf (setTimeout 0), damit äußere Hüllen (Medizin, Sperren) schon gebucht haben.
  let auffrischenGeplant = false;
  function auffrischen() {
    auffrischenGeplant = false;
    if (!dfl() || typeof SQUAD === 'undefined') return;
    if (window.DFLSimulieren && typeof DFLSimulieren.aktiv === 'function' && DFLSimulieren.aktiv()) return;
    const v = document.getElementById('view-squad');
    if (!v || !v.classList.contains('active')) return;
    try {
      if (typeof renderAll === 'function') renderAll();
      if (CFG.aufstellung && typeof renderSquadList === 'function') renderSquadList();
      const sl = document.getElementById('sub-squadlist');
      if (sl && sl.classList.contains('active') && typeof renderSquadOverview === 'function') renderSquadOverview();
    } catch (e) { console.warn('[DFL-Kaderliste] auffrischen', e); }
  }
  const auffrischenSpaeter = () => { if (!auffrischenGeplant) { auffrischenGeplant = true; setTimeout(auffrischen, 0); } };
  ['switchAppView', 'advanceCalendarWeek', 'postMatchContinue'].forEach(name => {
    const _orig = window[name];
    if (typeof _orig !== 'function') return;
    window[name] = function () {
      const r = _orig.apply(this, arguments);
      if (name !== 'switchAppView' || arguments[0] === 'squad') auffrischenSpaeter();
      return r;
    };
  });

  window.DFLKaderliste = { CFG, abschnitt, einteilung, auffrischen, zug: () => ({ aktiv: zug.aktiv, touch: zug.touch, y: zug.y }) };

  // Spielstand schon geladen: Listen gleich in Abschnitten zeigen
  try {
    if (dfl() && typeof SQUAD !== 'undefined' && SQUAD.length) {
      if (CFG.aufstellung && typeof renderSquadList === 'function') renderSquadList();
      const sl = document.getElementById('sub-squadlist');
      if (sl && sl.classList.contains('active') && typeof renderSquadOverview === 'function') renderSquadOverview();
    }
  } catch (e) { console.warn('[DFL-Kaderliste] Laden', e); }
  console.log('[DFL-Kaderliste v1] aktiv — Kader in Startelf, Bank, Tribüne, Development (D98); beim Ziehen scrollt die Seite am Rand mit, Touch: lange drücken und ziehen (D79)');
})();
