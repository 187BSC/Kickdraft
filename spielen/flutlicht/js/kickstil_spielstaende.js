/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · SPIELSTÄNDE  ·  v1   (Nutzer 2026-10-16: „zu jedem der beiden Spiele 2 Spielstände ermöglichen“)
   ─────────────────────────────────────────────────────────────────────────
   Wie Kickdraft (dfl_start.js: FREI 2, MIT_PRO 3): höchstens 2 Spielstände, mit Pro 3.
     · „Neues Spiel“ und „Importieren“ auf dem Spielstand-Bildschirm sind gesperrt, solange alle Plätze belegt sind
       (Hinweis: einen Spielstand löschen oder als Datei sichern). Anzeige „1 von 2“.
     · Aufräumen: leere „—“-Stände ohne Liga (entstanden beim Start vor der Vereinswahl, Fehler behoben in
       engine_main.js saveGameState) werden beim Start entfernt.
   Pro: localStorage „gesamt-pro“ (KSWerbung) oder „dfl-pro“ = 'an' (Kickdraft).
   API: KSSpielstaende.plaetze() · .belegt() · .CFG
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const CFG = { frei: 2, mitPro: 3 };
  const lies = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const pro = () => lies('gesamt-pro') === 'true' || lies('dfl-pro') === 'an';
  const plaetze = () => (pro() ? CFG.mitPro : CFG.frei);
  let anzahl = 0;
  async function belegt() {
    try { const idx = await loadSavesIndex(); anzahl = (idx.slots || []).length; } catch (e) { /* bleibt */ }
    return anzahl;
  }
  const voll = () => anzahl >= plaetze();
  const hinweis = () => {
    const t = `Alle ${plaetze()} Spielstand-Plätze sind belegt. Lösche einen Spielstand oder sichere ihn als Datei (Export), dann ist wieder Platz.`;
    if (typeof window.showToast === 'function') window.showToast(t, 'warn'); else alert(t);
  };

  // Leere Stände ohne Liga entfernen (nicht den aktiven)
  async function aufraeumen() {
    try {
      const idx = await loadSavesIndex();
      for (const s of (idx.slots || []).slice()) {
        if (!s || s.club !== '—' || s.id === (typeof ACTIVE_SLOT_ID !== 'undefined' ? ACTIVE_SLOT_ID : null)) continue;
        const l = await window.storage.get(slotKey(s.id, 'league'));
        if (!l || !l.value || l.value === 'null') await deleteSlot(s.id);
      }
    } catch (e) { console.warn('[Kickstil-Spielstände] Aufräumen', e); }
    await belegt();
  }

  // Import begrenzen
  if (typeof window.importSaveObject === 'function') {
    const _imp = window.importSaveObject;
    window.importSaveObject = async function () {
      await belegt();
      if (voll()) { hinweis(); return null; }
      const r = await _imp.apply(this, arguments);
      await belegt();
      return r;
    };
    try { importSaveObject = window.importSaveObject; } catch (e) { /* window reicht */ }
  }
  if (typeof window.deleteSlot === 'function') {
    const _del = window.deleteSlot;
    window.deleteSlot = async function () { const r = await _del.apply(this, arguments); await belegt(); return r; };
    try { deleteSlot = window.deleteSlot; } catch (e) { /* window reicht */ }
  }

  // „Neues Spiel“ sperren, solange voll (vor dem onclick des Knopfs abfangen)
  document.addEventListener('click', ev => {
    const b = ev.target.closest && ev.target.closest('#onboarding-overlay [onclick^="window._obNew"], #onboarding-overlay [onclick^="window._obImport"]');
    if (b && voll()) { ev.preventDefault(); ev.stopPropagation(); hinweis(); }
  }, true);
  // Anzeige „x von 2“ unter der Überschrift
  function anzeigen() {
    const ov = document.getElementById('onboarding-overlay');
    const neu = ov && ov.querySelector('[onclick^="window._obNew"]');
    if (!neu) return;
    let z = ov.querySelector('.kss-plaetze');
    if (!z) {
      z = document.createElement('div'); z.className = 'kss-plaetze';
      z.style.cssText = 'font-size:12px;text-align:center;margin:-8px 0 12px;color:var(--text2,#8b949e)';
      const leiste = neu.parentNode; leiste.parentNode.insertBefore(z, leiste);
    }
    const txt = `${anzahl} von ${plaetze()} Spielstand-Plätzen belegt` + (voll() ? ' – für ein neues Spiel einen löschen oder als Datei sichern' : '');
    if (z.textContent !== txt) z.textContent = txt;
    neu.style.opacity = voll() ? '.5' : '';
  }
  const los = () => {
    aufraeumen().then(anzeigen);
    let wartet = false;
    new MutationObserver(() => {
      if (wartet || !document.getElementById('onboarding-overlay')) return;
      wartet = true; belegt().then(() => { wartet = false; anzeigen(); });
    }).observe(document.body, { childList: true, subtree: true });
  };
  if (document.body) los(); else document.addEventListener('DOMContentLoaded', los);

  window.KSSpielstaende = { plaetze, belegt, aufraeumen, CFG };
  console.log('[Kickstil-Spielstände v1] aktiv — höchstens ' + plaetze() + ' Spielstände (Pro 3), leere Stände werden aufgeräumt');
})();
