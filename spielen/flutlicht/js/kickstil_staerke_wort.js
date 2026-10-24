/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · „STÄRKE“ STATT „OVR“  ·  v1   (2026-10-24, Nutzer-Regel: sichtbar immer „Stärke“, nie „OVR“)
   ─────────────────────────────────────────────────────────────────────────
   Die automatische Prüfung (analyse/ansichten.js, ERWARTUNGEN.md) fand in der Vereinskarriere noch „OVR“ im Sichtbaren
   (Scouting „Talent-Niveau OVR ~66“, Kauf- und Vertragsfenster, Meldungen, Zeitung). Kickdraft hat dafür einen Wächter
   (dfl_oberflaeche_patch.js, Teil L) – derselbe hier: ein MutationObserver ersetzt „OVR“ in Texten und Titeln.
   Ausnahme: alles mit [data-ovr-ok] und Eingabefelder. Interne Namen (p.ovr) bleiben.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof document === 'undefined' || typeof MutationObserver !== 'function') return;
  const RE = /\bOVR\b/g, RE_T = /\bOVR\b/;
  const text = s => String(s == null ? '' : s).replace(/OVR\/Sai\./g, 'Stärke/Saison').replace(RE, 'Stärke');
  const SKIP = 'script,style,textarea,input,select,noscript,template,[contenteditable="true"],[data-ovr-ok]';
  function ersetzen(w) {
    if (!w) return;
    if (w.nodeType === 3) { if (RE_T.test(w.nodeValue) && !(w.parentElement && w.parentElement.closest(SKIP))) w.nodeValue = text(w.nodeValue); return; }
    if (w.nodeType !== 1 && w.nodeType !== 11) return;
    if (w.nodeType === 1 && w.closest(SKIP)) return;
    const tw = document.createTreeWalker(w, NodeFilter.SHOW_TEXT, { acceptNode: x => (RE_T.test(x.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
    const l = []; let x; while ((x = tw.nextNode())) l.push(x);
    l.forEach(n => { if (!(n.parentElement && n.parentElement.closest(SKIP))) n.nodeValue = text(n.nodeValue); });
    if (w.querySelectorAll) w.querySelectorAll('[title*="OVR"]').forEach(e => { e.title = text(e.title); });
  }
  const mo = new MutationObserver(liste => {
    for (const r of liste) {
      if (r.type === 'characterData') { if (RE_T.test(r.target.nodeValue || '')) ersetzen(r.target); continue; }
      if (r.type === 'attributes') { const t = r.target.getAttribute && r.target.getAttribute('title'); if (t && RE_T.test(t)) r.target.title = text(t); continue; }
      r.addedNodes.forEach(ersetzen);
    }
  });
  function start() { ersetzen(document.body); mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['title'] }); }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  window.KSStaerkeWort = { text, ersetzen };
  console.log('[Kickstil-Stärke-Wort v1] aktiv — „OVR“ wird im Sichtbaren zu „Stärke“');
})();
