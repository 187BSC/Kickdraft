/* ═══════════════════════════════════════════════════════════════════════════
   DFL · EIGENE AUSWAHL  ·  v1   (D82, freigegeben 2026-10-10: „nicht wie bei Android diese Basic, sondern was Eigenes“)
   ─────────────────────────────────────────────────────────────────────────
   Jedes <select> der Oberfläche wird zum Kenney-Auswahlknopf. Antippen öffnet ein Auswahlblatt – am Handy von unten,
   am PC als Fenster am Knopf (Vorschlag der Vorschau spiel/dfl_kader_vorschau.html) – mit Suche und Filter,
   Wappen (Vereine, nach Name sortiert), Gesichtern (Spieler) und Mini-Feld (Formation). Kurze Listen (bis 5 kurze
   Einträge, z. B. Trainings-Schwerpunkt) werden Segment-Knöpfe direkt in der Zeile, ganz ohne Blatt.
   Das <select> bleibt unsichtbar als Quelle der Wahrheit im DOM: gewählt wird über value + change-Ereignis, die
   bisherigen Handler (changeFormation, DFLTrade.partner/.block, DFLTraining.schwerpunkt/.mentor) laufen unverändert;
   setzt das Spiel value selbst (renderFormationOptions), zieht der Knopf nach.
   Bedienung: Pfeiltasten, Pos1/Ende, Enter, Esc; der Fokus springt zurück auf den Knopf.
   API: DFLAuswahl.oeffnen({ titel, untertitel, eintraege:[{ wert, text, sub, bild, gruppe, aus }], wert, suche, filter,
        raster, anker }) → Promise<wert|null> · .aufwerten(wurzel) · .miniFeld(formation)
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof document === 'undefined') return;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const handy = () => (document.body && document.body.classList.contains('ist-handy')) || (window.matchMedia && matchMedia('(max-width: 819px)').matches);

  // ── Mini-Feld (Formation) ─────────────────────────────────────────────────
  // Positionsfarben wie in der Aufstellung (D54); Mittelfeld dunkler, sonst verschwindet es auf dem Rasen
  const POS_FARBE = { TW: '#f1c40f', AV: '#2563eb', IV: '#2563eb', ZM: '#166534', ZDM: '#166534', OM: '#166534', ZOM: '#166534', FL: '#dc2626', ST: '#dc2626',
    LV: '#2563eb', RV: '#2563eb', LM: '#166534', RM: '#166534', LF: '#dc2626', RF: '#dc2626' };
  // D95: Farbe nach dem Platz mit Seite (4-2-3-1 außen = LF/RF, Sturm rot), ohne DFLPosition nach der Gruppe des Slots
  const farbeVon = s => {
    const pl = window.DFLPosition && typeof DFLPosition.platz === 'function' ? DFLPosition.platz(s) : null;
    return POS_FARBE[pl] || POS_FARBE[s.group] || POS_FARBE[s.label] || '#fff';
  };
  function miniFeld(f) {
    const slots = (typeof FORMATIONS !== 'undefined' && FORMATIONS[f]) || [];
    const punkte = slots.map(s => `<circle cx="${(s.x * 0.6).toFixed(1)}" cy="${(s.y * 0.8).toFixed(1)}" r="3.4" fill="${farbeVon(s)}" stroke="#fff" stroke-width="1.2"/>`).join('');
    return `<svg class="wahl-feld" viewBox="0 0 60 80" aria-hidden="true"><rect width="60" height="80" rx="5" fill="#2ecc71"/>` +
      '<g fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="1"><rect x="3" y="3" width="54" height="74" rx="2"/><line x1="3" y1="40" x2="57" y2="40"/>' +
      '<circle cx="30" cy="40" r="7"/><rect x="16" y="3" width="28" height="11"/><rect x="16" y="66" width="28" height="11"/></g>' + punkte + '</svg>';
  }
  // ── Bilder je Art ─────────────────────────────────────────────────────────
  function wappen(wert) {
    try {
      const id = window.DFLSpiel && DFLSpiel.spielId ? DFLSpiel.spielId(wert) : wert;
      return typeof crestStyle === 'function' ? `<span class="lg-crest wahl-wappen" style="${crestStyle(id)}"></span>` : '';
    } catch (e) { return ''; }
  }
  function gesicht(wert) {
    try {
      if (typeof SQUAD === 'undefined' || !window.DFLIdentitaet) return '';
      const p = SQUAD.find(q => q.id === wert || q.dflId === wert);
      if (!p) return '';
      const f = window.DFLSpiel && DFLSpiel.franchise ? DFLSpiel.franchise('fcm') : null;
      return `<span class="dfl-portrait klein wahl-gesicht">${DFLIdentitaet.gesichtSvg(p, f ? { farben: f.farben } : null)}</span>`;
    } catch (e) { return ''; }
  }

  // ── Was für ein Feld? (an den bisherigen Handlern erkannt, kein Eingriff in die Quellen) ──
  function artVon(sel) {
    const h = sel.getAttribute('onchange') || '';
    if (/changeFormation/.test(h) || sel.id === 'formation-select') return { art: 'formation', titel: 'Formation', raster: true };
    if (/DFLTrade\.partner/.test(h)) return { art: 'verein', titel: 'Trade-Partner', untertitel: 'Lage · Cap frei', suche: true, filter: true };
    if (/DFLTrade\.block/.test(h)) return { art: 'spieler', titel: 'Trading Block', untertitel: 'Wer bietet was für einen deiner Spieler?', suche: true };
    if (/DFLTraining\.mentor/.test(h)) return { art: 'spieler', titel: 'Mentor', untertitel: (sel.getAttribute('aria-label') || '').replace(/^Mentor für /, 'für ') };
    if (/DFLTraining\.schwerpunkt/.test(h)) return { art: 'segment', titel: 'Schwerpunkt' };
    const lbl = sel.getAttribute('aria-label') || (sel.labels && sel.labels[0] && sel.labels[0].textContent.trim()) || 'Auswahl';
    return { art: 'liste', titel: lbl };
  }
  function eintraegeVon(sel, a) {
    return [...sel.options].map(o => {
      const text = o.text.trim(), e = { wert: o.value, text, sub: '', bild: '', gruppe: '', aus: o.disabled };
      if (a.art === 'verein') {
        const teile = text.split(' · ');
        e.text = teile[0]; e.sub = teile.slice(1).join(' · '); e.gruppe = teile[1] || ''; e.bild = wappen(o.value);
      } else if (a.art === 'spieler') {
        const m = /^(.*?)\s*\((.*)\)\s*$/.exec(text);
        if (m) { e.text = m[1]; e.sub = m[2]; }
        // Mentor: „(30, 0/2)“ → „30 J · 0/2 Schützlinge“
        const mm = /^(\d+), (\d+\/\d+)$/.exec(e.sub);
        if (mm) e.sub = `${mm[1]} J · ${mm[2]} Schützlinge`;
        e.bild = o.value ? gesicht(o.value) : '<span class="wahl-leer"><i class="ti ti-user-off" aria-hidden="true"></i></span>';
      } else if (a.art === 'formation') {
        e.bild = miniFeld(o.value);
      }
      return e;
    });
  }

  // ── Das Blatt ─────────────────────────────────────────────────────────────
  let blatt = null, offen = null;
  function bauen() {
    if (blatt) return blatt;
    blatt = document.createElement('div');
    blatt.id = 'dfl-ausw'; blatt.className = 'dfl-ausw'; blatt.hidden = true;
    blatt.innerHTML = '<div class="dfl-ausw-hg"></div><div class="dfl-ausw-blatt" role="dialog" aria-modal="true" aria-labelledby="dfl-ausw-titel">' +
      '<div class="app-griff" aria-hidden="true"></div><div class="dfl-ausw-kopf"><h4 id="dfl-ausw-titel"></h4>' +
      '<button type="button" class="dfl-ausw-zu" aria-label="Schließen"><i class="ti ti-x" aria-hidden="true"></i></button></div>' +
      '<label class="dfl-ausw-suche"><i class="ti ti-search" aria-hidden="true"></i><input type="search" autocomplete="off" placeholder="Suchen …" aria-label="Suchen"></label>' +
      '<div class="dfl-ausw-filter" role="group" aria-label="Filter"></div><div class="dfl-ausw-liste" role="listbox"></div></div>';
    document.body.appendChild(blatt);
    blatt.querySelector('.dfl-ausw-hg').addEventListener('click', () => schliessen(null));
    blatt.querySelector('.dfl-ausw-zu').addEventListener('click', () => schliessen(null));
    blatt.querySelector('.dfl-ausw-suche input').addEventListener('input', zeigeListe);
    blatt.querySelector('.dfl-ausw-filter').addEventListener('click', ev => {
      const b = ev.target.closest('[data-filter]'); if (!b || !offen) return;
      offen.filterWert = b.dataset.filter; zeigeListe();
    });
    blatt.querySelector('.dfl-ausw-liste').addEventListener('click', ev => {
      const b = ev.target.closest('.dfl-ausw-opt'); if (!b || b.disabled) return;
      schliessen(b.dataset.wert);
    });
    blatt.addEventListener('keydown', tasten);
    return blatt;
  }
  function zeigeListe() {
    if (!offen) return;
    const o = offen, liste = blatt.querySelector('.dfl-ausw-liste');
    const q = (blatt.querySelector('.dfl-ausw-suche input').value || '').trim().toLowerCase();
    const fl = blatt.querySelector('.dfl-ausw-filter');
    if (o.filter) {
      const gruppen = [...new Set(o.eintraege.map(e => e.gruppe).filter(Boolean))];
      fl.hidden = gruppen.length < 2;
      fl.innerHTML = ['', ...gruppen].map(g => `<button type="button" class="dfl-ausw-chip" data-filter="${esc(g)}" aria-pressed="${(o.filterWert || '') === g}">${g ? esc(g) : 'Alle'}</button>`).join('');
    } else fl.hidden = true;
    const sicht = o.eintraege.filter(e => (!q || (e.text + ' ' + e.sub).toLowerCase().includes(q)) && (!o.filterWert || e.gruppe === o.filterWert));
    liste.classList.toggle('raster', !!o.raster);
    liste.innerHTML = sicht.length ? sicht.map(e => `<button type="button" class="dfl-ausw-opt" role="option" data-wert="${esc(e.wert)}" aria-selected="${String(e.wert) === String(o.wert)}"${e.aus ? ' disabled' : ''}>` +
      `${e.bild || ''}<span class="dfl-ausw-text"><b>${esc(e.text)}</b>${e.sub ? `<small>${esc(e.sub)}</small>` : ''}</span>` +
      '<i class="ti ti-check dfl-ausw-haken" aria-hidden="true"></i></button>').join('')
      : '<div class="dfl-ausw-nichts">Nichts gefunden.</div>';
  }
  function setzeLage(anker) {
    const box = blatt.querySelector('.dfl-ausw-blatt');
    blatt.classList.toggle('am-knopf', !handy());
    box.style.left = box.style.top = box.style.width = box.style.maxHeight = '';
    if (handy() || !anker) return;
    // PC: kleines Fenster am Knopf (unter dem Knopf, sonst darüber)
    const r = anker.getBoundingClientRect(), breite = Math.max(300, Math.min(420, r.width + 120));
    const unten = innerHeight - r.bottom - 12, oben = r.top - 12, nachUnten = unten >= 280 || unten >= oben;
    box.style.width = breite + 'px';
    box.style.left = Math.max(8, Math.min(innerWidth - breite - 8, r.left)) + 'px';
    box.style.maxHeight = Math.max(220, nachUnten ? unten : oben) + 'px';
    box.style.top = (nachUnten ? r.bottom + 6 : Math.max(8, r.top - 6 - Math.min(box.scrollHeight, Math.max(220, oben)))) + 'px';
  }
  function oeffnen(opt) {
    bauen();
    if (offen) schliessen(null);
    return new Promise(fertig => {
      offen = Object.assign({ eintraege: [], filterWert: '' }, opt, { fertig });
      blatt.querySelector('#dfl-ausw-titel').innerHTML = esc(opt.titel || 'Auswahl') + (opt.untertitel ? `<small>${esc(opt.untertitel)}</small>` : '');
      const such = blatt.querySelector('.dfl-ausw-suche');
      such.hidden = !(opt.suche && offen.eintraege.length > 8);
      such.querySelector('input').value = '';
      zeigeListe();
      blatt.hidden = false;
      setzeLage(opt.anker);
      requestAnimationFrame(() => {
        blatt.classList.add('auf');
        const gewaehlt = blatt.querySelector('.dfl-ausw-opt[aria-selected="true"]') || blatt.querySelector('.dfl-ausw-opt:not([disabled])');
        if (gewaehlt) { gewaehlt.scrollIntoView({ block: 'nearest' }); if (!handy() || !such.hidden) gewaehlt.focus({ preventScroll: true }); }
      });
    });
  }
  function schliessen(wert) {
    if (!offen) return;
    const o = offen; offen = null;
    blatt.classList.remove('auf');
    blatt.hidden = true;
    if (o.anker && o.anker.isConnected) { try { o.anker.focus({ preventScroll: true }); } catch (e) { /* ohne Fokus */ } }
    o.fertig(wert == null ? null : wert);
  }
  function tasten(ev) {
    if (!offen) return;
    if (ev.key === 'Escape') { ev.preventDefault(); schliessen(null); return; }
    const opts = [...blatt.querySelectorAll('.dfl-ausw-opt:not([disabled])')];
    if (!opts.length) return;
    const i = opts.indexOf(document.activeElement);
    const ziel = ev.key === 'ArrowDown' || (ev.key === 'ArrowRight' && offen.raster) ? opts[Math.min(opts.length - 1, i + 1)]
      : ev.key === 'ArrowUp' || (ev.key === 'ArrowLeft' && offen.raster) ? opts[Math.max(0, i < 0 ? 0 : i - 1)]
        : ev.key === 'Home' ? opts[0] : ev.key === 'End' ? opts[opts.length - 1] : null;
    if (ziel && document.activeElement !== blatt.querySelector('.dfl-ausw-suche input')) { ev.preventDefault(); ziel.focus(); return; }
    if (ziel && ev.key !== 'Home' && ev.key !== 'End') { ev.preventDefault(); ziel.focus(); return; }
    if ((ev.key === 'Enter') && document.activeElement && document.activeElement.classList.contains('dfl-ausw-opt')) {
      ev.preventDefault(); schliessen(document.activeElement.dataset.wert);
    }
  }
  window.addEventListener('resize', () => { if (offen) setzeLage(offen.anker); });

  // ── <select> → Knopf bzw. Segment ─────────────────────────────────────────
  function waehlen(sel, wert) {
    if (wert == null || String(wert) === sel.value) return;
    sel.value = wert;
    sel.dispatchEvent(new Event('input', { bubbles: true }));
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function knopfInhalt(sel, a) {
    const o = sel.options[sel.selectedIndex];
    const e = o ? eintraegeVon({ options: [o] }, a)[0] : { text: '–', sub: '', bild: '' };
    const bildKlein = a.art === 'formation' ? miniFeld(sel.value) : a.art === 'verein' || a.art === 'spieler' ? e.bild : '';
    return `${bildKlein}<span class="ak-text"><small>${esc(a.titel)}</small><b>${esc(e.text)}</b>${a.art === 'verein' && e.sub ? `<em>${esc(e.sub)}</em>` : ''}</span>` +
      '<i class="ti ti-chevron-down pfeil" aria-hidden="true"></i>';
  }
  function segmentInhalt(sel) {
    return [...sel.options].map(o => `<button type="button" role="radio" aria-checked="${o.selected}" data-wert="${esc(o.value)}"${o.disabled ? ' disabled' : ''}>${esc(o.text.trim())}</button>`).join('');
  }
  function istKurz(sel) {
    const t = [...sel.options].map(o => o.text.trim());
    return t.length >= 2 && t.length <= 5 && t.join('').length <= 52;
  }
  function aufwertenSelect(sel) {
    if (sel.dataset.auswahl || sel.multiple || sel.closest('[data-auswahl-nativ]')) return;
    const a = artVon(sel);
    const segment = a.art === 'segment' || (a.art === 'liste' && istKurz(sel));
    sel.dataset.auswahl = segment ? 'segment' : 'knopf';
    sel.classList.add('dfl-ausw-quelle');
    sel.setAttribute('tabindex', '-1'); sel.setAttribute('aria-hidden', 'true');
    let ui;
    if (segment) {
      ui = document.createElement('div');
      ui.className = 'auswahl-segment'; ui.setAttribute('role', 'radiogroup'); ui.setAttribute('aria-label', sel.getAttribute('aria-label') || a.titel);
      ui.addEventListener('click', ev => { const b = ev.target.closest('button[data-wert]'); if (b && !b.disabled) waehlen(sel, b.dataset.wert); });
    } else {
      ui = document.createElement('button');
      ui.type = 'button'; ui.className = 'auswahl-knopf auswahl-' + a.art; ui.setAttribute('aria-haspopup', 'listbox');
      if (sel.getAttribute('aria-label')) ui.setAttribute('aria-label', sel.getAttribute('aria-label'));
      ui.addEventListener('click', async () => {
        if (sel.disabled) return;
        const w = await oeffnen(Object.assign({}, a, { eintraege: eintraegeVon(sel, a), wert: sel.value, anker: ui }));
        waehlen(sel, w);
      });
    }
    ui.dataset.auswahlFuer = '1';
    const zeichnen = () => {
      if (segment) ui.innerHTML = segmentInhalt(sel);
      else { ui.innerHTML = knopfInhalt(sel, a); ui.disabled = sel.disabled; }
    };
    sel._dflAuswahl = zeichnen;
    zeichnen();
    sel.insertAdjacentElement('afterend', ui);
    // Setzt das Spiel value selbst (renderFormationOptions u. a.), zieht der Knopf nach
    const P = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
    const I = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'selectedIndex');
    try {
      Object.defineProperty(sel, 'value', { configurable: true, get() { return P.get.call(this); }, set(v) { P.set.call(this, v); zeichnen(); } });
      Object.defineProperty(sel, 'selectedIndex', { configurable: true, get() { return I.get.call(this); }, set(v) { I.set.call(this, v); zeichnen(); } });
    } catch (e) { /* alte Browser: über change und Beobachter */ }
    sel.addEventListener('change', zeichnen);
    new MutationObserver(zeichnen).observe(sel, { childList: true, subtree: true, attributes: true, attributeFilter: ['selected', 'disabled'] });
  }
  function aufwerten(wurzel) {
    if (!wurzel || wurzel.nodeType !== 1) return;
    if (wurzel.matches('select')) aufwertenSelect(wurzel);
    wurzel.querySelectorAll('select').forEach(aufwertenSelect);
  }
  function start() {
    aufwerten(document.body);
    new MutationObserver(recs => {
      for (const r of recs) r.addedNodes.forEach(n => { if (n.nodeType === 1 && (n.matches('select') || n.firstElementChild)) aufwerten(n); });
      // Ansicht neu gezeichnet und der Knopf ist weg: Blatt zu
      if (offen && offen.anker && !offen.anker.isConnected) schliessen(null);
    }).observe(document.body, { childList: true, subtree: true });
  }
  // Ansicht oder Unterreiter gewechselt: offenes Blatt schließen
  ['switchAppView', 'switchSubview'].forEach(f => {
    const _orig = window[f];
    if (typeof _orig !== 'function') return;
    window[f] = function () { if (offen) schliessen(null); return _orig.apply(this, arguments); };
  });
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);

  window.DFLAuswahl = { oeffnen, schliessen: () => schliessen(null), aufwerten, miniFeld, offen: () => !!offen };
  console.log('[DFL-Auswahl v1] aktiv — Kenney-Auswahlknopf + Blatt statt Android-Auswahl (D82): Formation, Trade-Partner, Trading Block, Mentor; Schwerpunkt als Segment');
})();
