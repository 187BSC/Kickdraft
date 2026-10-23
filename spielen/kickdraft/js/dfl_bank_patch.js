/* ═══════════════════════════════════════════════════════════════════════════
   DFL · BANK NEBEN DEM FELD  ·  v1   (Nutzer 2026-10-14: „kader: aufstellung und daneben die Bank zum tauschen muss auch bei
   Hochformat funktionieren und durch wischen der spieler und namen am rand funktionieren“)
   ───────────────────────────────────────────────────────────────────────────
   Kader → Aufstellung: rechts neben dem Feld eine schmale Spalte mit allen Spielern, die nicht in der Startelf stehen (Gesicht,
   Name, Position, Stärke; Ausfälle abgeblendet), im Hoch- und Querformat. Tauschen per Wischen: Bankspieler aufs Feld ziehen
   (wechselt ein), Feldspieler auf einen Bankspieler ziehen (wechselt aus) oder auf einen anderen Feldplatz (tauscht die Plätze).
   In der Bank-Spalte entscheidet die erste Bewegung: seitlich = ziehen, senkrecht = blättern. Antippen bleibt wie bisher.
   Hängt an: renderPitch (nach dfl_app_shell.js), performSwap (app_main.js). Development Squad und Verletztenliste stehen nicht
   auf der Bank (wie im Spieltagskader).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const dfl = () => typeof CLUB !== 'undefined' && CLUB && CLUB.dfl && typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.dfl;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const REIHE = ['TW', 'IV', 'LV', 'RV', 'AV', 'ZDM', 'ZM', 'LM', 'RM', 'OM', 'AM', 'LF', 'RF', 'FL', 'ST'];
  const rang = p => { const i = REIHE.indexOf(p.pos); return i < 0 ? 50 : i; };
  const farben = () => { try { const f = window.DFLSpiel && DFLSpiel.franchise ? DFLSpiel.franchise('fcm') : null; return f ? { farben: f.farben } : null; } catch (e) { return null; } };
  const gesicht = p => { try { return window.DFLIdentitaet ? DFLIdentitaet.gesichtSvg(p, farben()) : ''; } catch (e) { return ''; } };
  const kurzName = p => { const n = typeof displayName === 'function' ? displayName(p) : (p.name || ''); return n; };
  const pos = p => p.pos || '';                       // nur die Hauptposition (schmale Spalte)
  const aus = p => (typeof isAvailable === 'function' && !isAvailable(p)) || p.onStrike;

  function bankSpieler() {
    const drin = new Set(Object.values(CLUB.lineup || {}).filter(Boolean));
    return (SQUAD || []).filter(p => !drin.has(p.id) && !p.perspektiv && !p.verletztenliste && !p.onLoanAt)
      .sort((a, b) => rang(a) - rang(b) || (b.ovr || 0) - (a.ovr || 0));
  }
  function bankHtml() {
    const liste = bankSpieler();
    if (!liste.length) return '<p class="bk-leer">Alle stehen in der Startelf.</p>';
    // Nutzer 2026-10-14: „bank braucht keine Bilder nur Name position und ovr mit potential“
    const scout = (CLUB.facilities && CLUB.facilities.scouting) || 1;
    return liste.map(p => {
      const pot = typeof potentialOnly === 'function' ? potentialOnly(p, scout).replace(/^Pot /, '') : '';
      const st = typeof ovrBase === 'function' ? ovrBase(p) : p.ovr;
      return `<div class="bk-spieler${aus(p) ? ' bk-aus' : ''}${CLUB.selected && CLUB.selected.type === 'bench' && CLUB.selected.key === p.id ? ' bk-gewaehlt' : ''}" data-bk="${esc(p.id)}">
        <span class="bk-name">${esc(kurzName(p))}</span>
        <span class="bk-zeile"><span class="bk-pos">${esc(pos(p))}</span><b>${st || ''}</b>${pot ? `<small>(${esc(pot)})</small>` : ''}</span></div>`;
    }).join('');
  }
  // Feld und Bank nebeneinander (einmal umbauen, dann nur die Bank neu füllen)
  function bauen() {
    const feld = document.getElementById('pitch');
    if (!feld || !dfl()) return;
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
        // am PC (body.pcu-an) wählt ein Klick zum Tauschen aus, der Doppelklick öffnet das Profil (kickstil_pc_kader.js) – wie Flutlicht
        if (p && window.DFLAppShell && DFLAppShell.spielerBlatt && !document.body.classList.contains('pcu-an')) DFLAppShell.spielerBlatt(p, { typ: 'bench', key: p.id });
        else if (typeof clickBench === 'function') clickBench(el.dataset.bk);
      });
    }
    const bank = document.getElementById('dfl-bank');
    const liste = bank.querySelector('.bk-liste'), y = liste ? liste.scrollTop : 0;      // Blätterstand behalten
    bank.innerHTML = `<div class="bk-kopf">Bank</div><div class="bk-liste">${bankHtml()}</div>`;
    bank.querySelector('.bk-liste').scrollTop = y;
    passendMarkieren(CLUB.selected && CLUB.selected.type === 'bench' ? CLUB.selected.key : null);
    document.body.classList.add('dfl-bank-an');
  }

  // Nutzer 2026-10-14: „gestrichelt anzeigen, wo der spieler spielen kann“ – beim Ziehen und bei ausgewähltem Bankspieler:
  // Plätze mit seiner Stammposition oder einer gelernten Position (DFLPosition.info, ohne Abzug fürs Fremde)
  function passendMarkieren(pid) {
    document.querySelectorAll('#pitch .p-slot.bk-passt').forEach(e => e.classList.remove('bk-passt'));
    const p = pid && typeof getPlayer === 'function' ? getPlayer(pid) : null;
    if (!p || !window.DFLPosition || typeof FORMATIONS === 'undefined') return;
    const slots = FORMATIONS[CLUB.formation] || [], els = document.querySelectorAll('#pitch .p-slot');
    slots.forEach((slot, i) => {
      let art = ''; try { art = DFLPosition.info(p, slot).art; } catch (e) { art = ''; }
      if ((art === 'stamm' || art === 'gelernt') && els[i] && CLUB.lineup[slot.id] !== p.id) els[i].classList.add('bk-passt');
    });
  }

  // ── Ziehen (Pointer Events: Finger und Maus) ─────────────────────────────
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
    if (!dfl() || ev.button > 0) return;
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
      if (zug.art === 'bench' && Math.abs(dy) > Math.abs(dx)) { zug = null; return; }       // senkrecht: Bank blättern
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

  // ── An renderPitch hängen ────────────────────────────────────────────────
  {
    const _orig = window.renderPitch;
    if (typeof _orig === 'function') {
      window.renderPitch = function () {
        const r = _orig.apply(this, arguments);
        try { bauen(); } catch (e) { console.warn('[DFL-Bank] Bank', e); }
        return r;
      };
      try { renderPitch = window.renderPitch; } catch (e) { /* window reicht */ }
    }
  }
  if (dfl()) try { bauen(); } catch (e) { /* Spiel lädt später */ }
  window.DFLBank = { bauen, bankSpieler };
  console.log('[DFL-Bank v1] aktiv — Bank neben dem Feld, Tauschen per Wischen');
})();
