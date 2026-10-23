/* ===== cohesion_patch.js =====
   EINGESPIELTHEIT — Brücke zwischen Taktik-System und Match-Engine v2
   ─────────────────────────────────────────────────────────────────────────────
   Idee (Nutzer): Nicht Stein-Papier-Schere soll Taktik interessant machen, sondern
   SYSTEMTREUE. Man bleibt eine Saison bei einer Systematik und kauft die Spieler
   dazu passend — statt vor jedem Spiel auf die „beste" Taktik zu wechseln.

   Die Datenbasis liegt bereits im TacticsSystem:
     · styleScoreFromAttrs → Stil-Eignung aus den Attributen
     · p.styleXP[stil]     → Spiele in diesem Stil (wächst via trackAdaptation)
     · adaptationBonus     → bis +2 Sterne nach ~30 Spielen (≈ eine Saison)
     · squadFit(...)       → Ø Stil-Sterne der Startelf inkl. Positions-Eignung
   Wechselt man das System, ist die Erfahrung im neuen Stil bei null → die
   Wechselkosten entstehen von selbst.

   Diese Datei liefert:
     window.computeCohesion()  → { value 0..1, style, stars, perPlayer, … }
     Anzeige-Panel im Taktik-Reiter (macht die Mechanik sichtbar & handlungsleitend)
   Lädt NACH bundle_tactics_core.js und app_main.js.
   ============================================================================= */
(function () {
  'use strict';

  function T() { return window.TacticsSystem; }

  // ── Eingespieltheit der aktuellen Startelf im aktuellen System ─────────────
  window.computeCohesion = function () {
    const Ts = T();
    if (!Ts || typeof CLUB === 'undefined' || !CLUB) return null;
    try {
      const tac = CLUB.tactics6 || Ts.DEFAULT_TACTICS6;
      const style = Ts.dominantStyle(tac);
      const slots = (typeof FORMATIONS !== 'undefined' && FORMATIONS[CLUB.formation]) || [];
      const fit = Ts.squadFit(CLUB.lineup || {}, getPlayer, slots, style);
      if (!fit) return null;
      // Sterne 0..5 → 0..1. Ein Wert von 0,5 entspricht einer soliden 2,5-Sterne-Elf.
      const value = Math.max(0, Math.min(1, fit.stars / 5));
      // Wie viele Spiele fehlen im Schnitt noch bis zur vollen Eingewöhnung?
      let toNext = 0, n = 0;
      (fit.perPlayer || []).forEach(pp => {
        const p = getPlayer(pp.id); if (!p) return;
        const o = Ts.playerStyleStarsObj(p, style);
        if (o.adapt < 2) { toNext += o.toNext; n++; }
      });
      return {
        value, style, styleLabel: (Ts.STYLE_LABELS || {})[style] || style,
        stars: fit.stars, perPlayer: fit.perPlayer || [],
        einspielenNoch: n ? Math.round(toNext / n) : 0
      };
    } catch (e) { console.warn('[Cohesion]', e); return null; }
  };

  // ── Anzeige im Taktik-Reiter ───────────────────────────────────────────────
  function label(v) {
    if (v >= 0.78) return ['eingespielt', 'coh-top'];
    if (v >= 0.60) return ['gut eingespielt', 'coh-ok'];
    if (v >= 0.42) return ['im Aufbau', 'coh-mid'];
    if (v >= 0.26) return ['fremdes System', 'coh-low'];
    return ['System sitzt nicht', 'coh-bad'];
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])); }

  function renderCohesionPanel() {
    const host = document.getElementById('sub-tactics');
    if (!host) return;
    const c = window.computeCohesion();
    let el = host.querySelector(':scope > .coh-panel');
    if (!c) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.className = 'coh-panel'; host.insertBefore(el, host.firstChild); }

    const pct = Math.round(c.value * 100);
    const [lbl, cls] = label(c.value);
    // Schwächste Glieder: passen am wenigsten ins System
    const weak = c.perPlayer.slice().sort((a, b) => a.effStars - b.effStars).slice(0, 3)
      .filter(p => p.effStars < 3.5);
    const weakHtml = weak.length
      ? `<div class="coh-weak"><span class="coh-weak-lbl">Passt noch nicht ins System:</span> ` +
        weak.map(p => `<span class="coh-chip">${esc(p.name)} <b>${p.effStars.toFixed(1)}★</b></span>`).join(' ') + `</div>`
      : `<div class="coh-weak"><span class="coh-weak-lbl">Die ganze Elf trägt das System.</span></div>`;

    el.innerHTML = `
      <div class="coh-head">
        <div><div class="coh-kicker">Systematik · ${esc(c.styleLabel)}</div>
          <div class="coh-title">Eingespieltheit</div></div>
        <div class="coh-val ${cls}">${pct}%<span>${lbl}</span></div>
      </div>
      <div class="coh-track"><div class="coh-fill ${cls}" style="width:${pct}%"></div></div>
      <div class="coh-note">Ø ${c.stars.toFixed(1)} von 5 Sternen im aktuellen Stil.
        ${c.einspielenNoch > 0 ? `Noch rund <b>${c.einspielenNoch} Spiele</b>, bis die Elf das System verinnerlicht hat.` : `Die Elf ist voll eingespielt.`}
        Ein Systemwechsel setzt diese Erfahrung zurück — Spieler kaufen, die zum Stil passen, hebt sie sofort.</div>
      ${weakHtml}`;
  }
  window.renderCohesionPanel = renderCohesionPanel;

  // An das Rendern des Taktik-Reiters hängen
  ['renderTacticsUI', 'renderTacticsTab', 'renderAll'].forEach(fn => {
    if (typeof window[fn] === 'function') {
      const _o = window[fn];
      window[fn] = function () { const r = _o.apply(this, arguments); try { renderCohesionPanel(); } catch (e) {} return r; };
    }
  });
  if (typeof window.switchSubview === 'function') {
    const _s = window.switchSubview;
    window.switchSubview = function (v) { const r = _s.apply(this, arguments); try { if (v === 'tactics') renderCohesionPanel(); } catch (e) {} return r; };
    try { switchSubview = window.switchSubview; } catch (e) {}
  }

  console.log('[Cohesion] aktiv — Eingespieltheit aus Stil-Eignung + Stil-Erfahrung');
})();
