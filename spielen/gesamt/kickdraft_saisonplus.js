/* ═══════════════════════════════════════════════════════════════════════════
   GESAMT-APP · KICKDRAFT · SAISON-PLUS  ·  v1   (Nutzer 2026-10-15: „Eine Sache für beide: … plus 1 in Klammern …“)
   Wird von bauen.sh in Kickdraft eingehängt, NACH saisonplus.js (= flutlicht_manager/js/kickstil_saisonplus.js, dieselbe
   Logik: ovrBase/gainPill/seasonGainBadge, Basis CLUB.training.ovrBasis, Zusammenrechnen nach startNewSeason).
   Kickdraft-Stellen, die eigenes HTML bauen und deshalb hier nachgezogen werden (der Kickdraft-Branch bleibt unverändert):
     · Spieler-Blatt (dfl_app_shell.js futKarte): „(+1)“ neben der großen Zahl
     · Tiefenkader (dfl_oberflaeche_patch.js .kd-ovr small „▲1“) → „(+1)“
     · Trainings-Ansicht (.ktr-zeile: aktueller Wert + „▲“ gegen den alten Schnappschuss) → „Basis (+d)“ wie überall
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (!window.KSSaisonPlus) { console.warn('[Gesamt-SaisonPlus] saisonplus.js fehlt'); return; }
  const SP = window.KSSaisonPlus;
  const kader = () => { try { return Array.isArray(SQUAD) ? SQUAD : []; } catch (e) { return []; } };
  const voll = p => ((p.firstName || '') + ' ' + (p.name || '')).replace(/\s+/g, ' ').trim();
  const finde = txt => { const t = String(txt || '').replace(/[©]/g, '').replace(/\s+/g, ' ').trim(); return kader().find(p => voll(p) === t || p.name === t) || null; };
  const plus = p => { const d = (p.ovr || 0) - SP.basis(p); return d ? SP.pille(d) : ''; };

  function blatt(root) {
    root.querySelectorAll('.fut-wert').forEach(w => {
      if (w.querySelector('.ks-plus') || w.dataset.ksPlus) return;
      const box = w.closest('.app-blatt-box, .app-blatt, [role="dialog"]') || document;
      const n = box.querySelector('.app-blatt-name');
      const p = n && finde(n.firstChild ? n.firstChild.textContent : n.textContent);
      w.dataset.ksPlus = '1';
      if (p) w.insertAdjacentHTML('beforeend', plus(p));
    });
  }
  function tiefe(root) {
    root.querySelectorAll('.kd-ovr small.auf, .kd-ovr small.ab').forEach(s => {
      if (s.dataset.ksPlus) return;
      const d = parseInt(s.textContent.replace(/[^\d]/g, ''), 10) || 0;
      s.dataset.ksPlus = '1';
      s.outerHTML = SP.pille(s.classList.contains('ab') ? -d : d);
    });
  }
  function training(root) {
    root.querySelectorAll('.ktr-zeile').forEach(z => {
      if (z.dataset.ksPlus) return;
      z.dataset.ksPlus = '1';
      const b = z.querySelector('.ktr-wer b'), o = z.querySelector('.ktr-ovr'), alt = z.querySelector('.ktr-delta');
      const p = b && finde(b.textContent);
      if (!p || !o) return;
      if (alt) alt.remove();
      o.textContent = SP.basis(p);
      o.insertAdjacentHTML('afterend', plus(p));
    });
  }
  const lauf = root => { try { blatt(root); tiefe(root); training(root); } catch (e) { /* Anzeige optional */ } };

  const css = document.createElement('style');
  css.textContent = `.season-gain.ks-plus{display:inline;padding:0;margin-left:3px;border:0;border-radius:0;background:none;box-shadow:none;
    color:#2f7a4c;font-weight:700;font-size:.72em;vertical-align:.12em;white-space:nowrap}
  .season-gain.ks-plus::before{content:none;display:none}.season-gain.ks-plus.season-loss{color:#a8463c}
  html.dark .season-gain.ks-plus{color:#79b893}html.dark .season-gain.ks-plus.season-loss{color:#d08a82}
  html .fut .fut-wert .season-gain.ks-plus{font-size:15px;font-weight:700;vertical-align:.9em;margin-left:2px;text-shadow:none;color:#33563f;opacity:.9}
  html .fut .fut-wert .season-gain.ks-plus.season-loss{color:#6e2f29}
  html .pitch-wrap .p-ovr .season-gain.ks-plus,html .mini-pitch .p-ovr .season-gain.ks-plus{color:#9fcfae;font-size:.85em;margin-left:2px;vertical-align:0}
  html .pitch-wrap .p-ovr .season-gain.ks-plus.season-loss,html .mini-pitch .p-ovr .season-gain.ks-plus.season-loss{color:#e3a9a2}
  .ktr-rechts .season-gain.ks-plus{margin-left:2px}`;
  document.head.appendChild(css);

  const los = () => { lauf(document); new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) lauf(n.parentNode || n); }))).observe(document.body, { childList: true, subtree: true }); };
  if (document.body) los(); else document.addEventListener('DOMContentLoaded', los);
  console.log('[Gesamt-SaisonPlus v1] aktiv — Kickdraft: Spieler-Blatt, Tiefenkader und Training mit „(+1)“');
})();
