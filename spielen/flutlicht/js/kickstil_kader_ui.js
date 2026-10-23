/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · KADER WIE KICKDRAFT  ·  v1   (Rückmeldung 2026-10-18: „Auch bei Flutlicht Aufstellung und Kader nebeneinander …
   am Ende sollte beides das gleiche Layout haben, damit man beide Spiele ohne Umlernen spielen kann“ · „Taktikansicht MUSS raus“ ·
   „Verträge zum Kader“)
   ─────────────────────────────────────────────────────────────────────────
   Kader-Reiter wie Kickdraft: Aufstellung · Liste · Tiefe · Verträge (Taktik-Reiter entfällt, die Taktik bleibt wie gespeichert).
   Aufstellung: rechts neben dem Feld die Bank (Kickdraft dfl_bank_patch.js, CSS in css/dfl_kader.css, gleich in beiden Spielen):
   Name, Position, Stärke (Potenzial); Tauschen per Wischen (Bank aufs Feld, Feld auf Bank, Feld auf Feld) oder Antippen.
   Verträge: renderContractsSection (app_main.js) im eigenen Reiter statt unter Nachwuchs & Scouting.
   Hängt an: renderPitch (nach kickstil_app_shell.js), performSwap, switchSubview (app_main.js).
   API: KSKaderUI.bauen() · .bankSpieler() · .vertraege()
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const spiel = () => typeof CLUB !== 'undefined' && CLUB && typeof LEAGUE !== 'undefined' && LEAGUE && typeof SQUAD !== 'undefined';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const REIHE = ['TW', 'IV', 'LV', 'RV', 'AV', 'DM', 'ZDM', 'ZM', 'LM', 'RM', 'OM', 'ZOM', 'AM', 'LA', 'RA', 'FL', 'HS', 'ST', 'MS'];
  const rang = p => { const i = REIHE.indexOf(p.pos); return i < 0 ? 50 : i; };
  const gesicht = p => { try { return window.KSVerein ? KSVerein.gesicht(p, 'fcm') : ''; } catch (e) { return ''; } };
  const kurzName = p => (typeof displayName === 'function' ? displayName(p) : (p.name || ''));
  const aus = p => (typeof isAvailable === 'function' && !isAvailable(p)) || p.onStrike;

  // ── Bank neben dem Feld ──────────────────────────────────────────────────
  function bankSpieler() {
    const drin = new Set(Object.values(CLUB.lineup || {}).filter(Boolean));
    return (SQUAD || []).filter(p => !drin.has(p.id) && !p.onLoanAt).sort((a, b) => rang(a) - rang(b) || (b.ovr || 0) - (a.ovr || 0));
  }
  function bankHtml() {
    const liste = bankSpieler();
    if (!liste.length) return '<p class="bk-leer">Alle stehen in der Startelf.</p>';
    const scout = (CLUB.facilities && CLUB.facilities.scouting) || 1;
    return liste.map(p => {
      let pot = ''; try { pot = typeof potentialOnly === 'function' ? potentialOnly(p, scout).replace(/^Pot\.? /, '') : ''; } catch (e) { pot = ''; }
      const st = typeof ovrBase === 'function' ? ovrBase(p) : p.ovr;
      return `<div class="bk-spieler${aus(p) ? ' bk-aus' : ''}${CLUB.selected && CLUB.selected.type === 'bench' && CLUB.selected.key === p.id ? ' bk-gewaehlt' : ''}" data-bk="${esc(p.id)}">
        <span class="bk-name">${esc(kurzName(p))}</span>
        <span class="bk-zeile"><span class="bk-pos">${esc(p.pos || '')}</span><b>${st || ''}</b>${pot ? `<small>(${esc(pot)})</small>` : ''}</span></div>`;
    }).join('');
  }
  function bauen() {
    const feld = document.getElementById('pitch');
    if (!feld || !spiel()) return;
    let reihe = feld.parentNode;
    if (!reihe.classList.contains('bk-reihe')) {
      reihe = document.createElement('div'); reihe.className = 'bk-reihe';
      feld.parentNode.insertBefore(reihe, feld); reihe.appendChild(feld);
      const bank = document.createElement('aside'); bank.id = 'dfl-bank'; bank.setAttribute('aria-label', 'Bank');
      reihe.appendChild(bank);
      bank.addEventListener('click', ev => {
        if (Date.now() < sperreKlick) return;
        const el = ev.target.closest('[data-bk]'); if (!el) return;
        const p = typeof getPlayer === 'function' ? getPlayer(el.dataset.bk) : null;
        if (CLUB.selected && CLUB.selected.type === 'slot' && typeof clickBench === 'function') { clickBench(el.dataset.bk); return; }
        if (p && window.DFLAppShell && DFLAppShell.spielerBlatt && document.body.classList.contains('dfl-shell')) DFLAppShell.spielerBlatt(p, { typ: 'bench', key: p.id });
        else if (typeof clickBench === 'function') clickBench(el.dataset.bk);
      });
    }
    const bank = document.getElementById('dfl-bank');
    const liste = bank.querySelector('.bk-liste'), y = liste ? liste.scrollTop : 0;
    bank.innerHTML = `<div class="bk-kopf">Bank</div><div class="bk-liste">${bankHtml()}</div>`;
    bank.querySelector('.bk-liste').scrollTop = y;
    passendMarkieren(CLUB.selected && CLUB.selected.type === 'bench' ? CLUB.selected.key : null);
    document.body.classList.add('dfl-bank-an');
  }
  // Gestrichelt, wo der Spieler spielen kann (Hauptposition oder gelernte Positionen)
  function kannSpielen(p, slot) {
    const ziel = slot.pos || slot.label || slot.group;
    const pos = (p.positions && p.positions.length ? p.positions : [p.pos]);
    return pos.indexOf(ziel) >= 0 || (slot.group && pos.indexOf(slot.group) >= 0);
  }
  function passendMarkieren(pid) {
    document.querySelectorAll('#pitch .p-slot.bk-passt').forEach(e => e.classList.remove('bk-passt'));
    const p = pid && typeof getPlayer === 'function' ? getPlayer(pid) : null;
    if (!p || typeof FORMATIONS === 'undefined') return;
    const slots = FORMATIONS[CLUB.formation] || [], els = document.querySelectorAll('#pitch .p-slot');
    slots.forEach((slot, i) => { if (kannSpielen(p, slot) && els[i] && CLUB.lineup[slot.id] !== p.id) els[i].classList.add('bk-passt'); });
  }

  // Ziehen (Pointer Events: Finger und Maus) – wie Kickdraft
  let zug = null, sperreKlick = 0;
  const slotId = el => {
    const els = [...document.querySelectorAll('#pitch .p-slot')], i = els.indexOf(el), s = (FORMATIONS[CLUB.formation] || [])[i];
    return s ? s.id : null;
  };
  function ziel(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    const slot = el.closest('#pitch .p-slot'); if (slot) { const id = slotId(slot); return id ? { art: 'slot', key: id, el: slot } : null; }
    const b = el.closest('#dfl-bank [data-bk]'); if (b) return { art: 'bench', key: b.dataset.bk, el: b };
    return null;
  }
  function markieren(z) {
    document.querySelectorAll('.bk-ziel').forEach(e => e.classList.remove('bk-ziel'));
    if (z && z.el) z.el.classList.add('bk-ziel');
  }
  document.addEventListener('pointerdown', ev => {
    if (!spiel() || ev.button > 0) return;
    const b = ev.target.closest('#dfl-bank [data-bk]'), s = ev.target.closest('#pitch .p-slot');
    if (!b && !s) return;
    const art = b ? 'bench' : 'slot', key = b ? b.dataset.bk : slotId(s);
    if (!key || (art === 'slot' && !CLUB.lineup[key])) return;
    zug = { art, key, x0: ev.clientX, y0: ev.clientY, id: ev.pointerId, aktiv: false, quelle: b || s };
  }, true);
  document.addEventListener('pointermove', ev => {
    if (!zug || ev.pointerId !== zug.id) return;
    const dx = ev.clientX - zug.x0, dy = ev.clientY - zug.y0;
    if (!zug.aktiv) {
      if (Math.hypot(dx, dy) < 9) return;
      if (zug.art === 'bench' && Math.abs(dy) > Math.abs(dx)) { zug = null; return; }
      zug.aktiv = true;
      const p = getPlayer(zug.art === 'bench' ? zug.key : CLUB.lineup[zug.key]);
      zug.geist = document.createElement('div'); zug.geist.className = 'bk-geist';
      zug.geist.innerHTML = `<span class="bk-gesicht">${p ? gesicht(p) : ''}</span><span class="bk-name">${esc(p ? kurzName(p) : '')}</span>`;
      passendMarkieren(p && p.id);
      document.body.appendChild(zug.geist); document.body.classList.add('bk-zieht');
      zug.quelle.classList.add('bk-quelle');
    }
    ev.preventDefault();
    zug.geist.style.transform = `translate(${ev.clientX - 30}px, ${ev.clientY - 36}px)`;
    markieren(ziel(ev.clientX, ev.clientY));
  }, { passive: false });
  function ende(ev, abbruch) {
    if (!zug || (ev && ev.pointerId !== zug.id)) return;
    const z = zug; zug = null;
    if (!z.aktiv) return;
    sperreKlick = Date.now() + 400;
    z.geist.remove(); document.body.classList.remove('bk-zieht'); z.quelle.classList.remove('bk-quelle'); markieren(null); passendMarkieren(null);
    if (abbruch) return;
    const t = ziel(ev.clientX, ev.clientY);
    if (!t || (t.art === z.art && t.key === z.key) || (t.art === 'bench' && z.art === 'bench')) return;
    if (typeof performSwap === 'function') performSwap(z.art, z.key, t.art, t.key);
  }
  document.addEventListener('pointerup', ev => ende(ev, false), true);
  document.addEventListener('pointercancel', ev => ende(ev, true), true);
  document.addEventListener('click', ev => { if (Date.now() < sperreKlick && ev.target.closest('#pitch, #dfl-bank')) { ev.stopPropagation(); ev.preventDefault(); } }, true);

  // ── Verträge im Kader ────────────────────────────────────────────────────
  function vertraege() {
    const el = document.getElementById('sub-vertraege');
    if (!el || !spiel() || typeof renderContractsSection !== 'function') return;
    try { el.innerHTML = renderContractsSection(); } catch (e) { console.warn('[KS-Kader] Verträge', e); }
  }

  // ── Haken ────────────────────────────────────────────────────────────────
  {
    const _orig = window.renderPitch;
    if (typeof _orig === 'function') {
      window.renderPitch = function () {
        const r = _orig.apply(this, arguments);
        try { bauen(); } catch (e) { console.warn('[KS-Kader] Bank', e); }
        return r;
      };
      try { renderPitch = window.renderPitch; } catch (e) { /* window reicht */ }
    }
  }
  {
    const _orig = window.switchSubview;
    if (typeof _orig === 'function') {
      window.switchSubview = function (name, btn) {
        const knopf = btn || [...document.querySelectorAll('#view-squad .subtab')].find(b => (b.getAttribute('onclick') || '').includes("'" + name + "'"));
        if (name === 'vertraege') {
          document.querySelectorAll('#view-squad .subtab').forEach(b => b.classList.toggle('active', b === knopf));
          document.querySelectorAll('#view-squad .subview').forEach(v => v.classList.toggle('active', v.id === 'sub-vertraege'));
          vertraege();
          return;
        }
        const v = document.getElementById('sub-vertraege'); if (v) v.classList.remove('active');
        return _orig.call(this, name, knopf || btn);
      };
      try { switchSubview = window.switchSubview; } catch (e) { /* window reicht */ }
    }
  }
  // Verträge nach Verlängern/Gehenlassen neu zeichnen, wenn der Reiter offen ist
  ['renewContract', 'releaseExpiringPlayer'].forEach(f => {
    const _orig = window[f];
    if (typeof _orig !== 'function') return;
    window[f] = function () {
      const r = _orig.apply(this, arguments);
      setTimeout(() => { const v = document.getElementById('sub-vertraege'); if (v && v.classList.contains('active')) vertraege(); }, 50);
      return r;
    };
  });
  if (spiel()) try { bauen(); } catch (e) { /* Spiel lädt später */ }
  window.KSKaderUI = { bauen, bankSpieler, vertraege };
  console.log('[KS-Kader v1] aktiv — Kader wie Kickdraft: Bank neben dem Feld, Verträge im Kader, ohne Taktik-Reiter');
})();
