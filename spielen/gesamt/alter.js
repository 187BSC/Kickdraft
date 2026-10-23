/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · ALTERSFRAGE  ·  v1   (Datenschutzerklärung 2026-10-16: „Spieler unter 16 bekommen nur nicht personalisierte
   Werbung“ – Umsetzung: neutral nach dem Geburtsjahr fragen, Android-Hülle setzt setTagForUnderAgeOfConsent für UMP und AdMob)
   ─────────────────────────────────────────────────────────────────────────
   Nur in der Android-App (window.FcmApk.alterBekannt/alterSetzen, Werbung.java) und nur einmal je Gerät: ohne Antwort startet
   dort weder der Einwilligungsdialog noch Werbung. Neutral: kein Jahr vorausgewählt, kein Hinweis auf eine Altersgrenze.
   Gespeichert wird nur „unter 16 ja/nein“ (localStorage „gesamt-alter“ und in der Hülle), nie das Jahr. Wer im Grenzjahr
   geboren ist, zählt sicherheitshalber als unter 16 (nur das Jahr ist bekannt).
   Läuft in der Moduswahl der Gesamt-App und in beiden Spielen (wer direkt in einem Spiel landet, wird dort gefragt).
   Testen im Browser: localStorage 'gesamt-alter-test' = 'an'.
   API: KSAlter.fragen() · .stand()
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.KSAlter) return;
  const KEY = 'gesamt-alter', GRENZE = 16;
  const lies = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
  const huelle = () => (window.FcmApk && typeof window.FcmApk.alterBekannt === 'function' ? window.FcmApk : null);
  const test = () => { try { return localStorage.getItem('gesamt-alter-test') === 'an'; } catch (e) { return false; } };
  function offen() {
    const h = huelle();
    if (h) { try { return !h.alterBekannt(); } catch (e) { return false; } }
    return test() && !lies();
  }
  function antworten(jahr) {
    const unter16 = new Date().getFullYear() - jahr <= GRENZE;
    try { localStorage.setItem(KEY, JSON.stringify({ unter16, t: Date.now() })); } catch (e) { /* Hülle merkt es sich */ }
    const h = huelle(); if (h) { try { h.alterSetzen(unter16); } catch (e) { console.warn('[KSAlter] Hülle', e); } }
  }
  function fragen() {
    if (document.getElementById('ks-alter')) return;
    const jetzt = new Date().getFullYear();
    let optionen = '<option value="" selected disabled>Jahr wählen</option>';
    for (let j = jetzt - 5; j >= jetzt - 100; j--) optionen += `<option value="${j}">${j}</option>`;
    const ov = document.createElement('div');
    ov.id = 'ks-alter';
    ov.innerHTML = `<div class="kal-box" role="dialog" aria-modal="true" aria-labelledby="kal-titel">
      <b id="kal-titel">Kurze Frage vorab</b>
      <label for="kal-jahr">In welchem Jahr bist du geboren?</label>
      <select id="kal-jahr">${optionen}</select>
      <button type="button" class="kal-weiter" disabled>Weiter</button>
      <small>Damit die Werbung zu deinem Alter passt. Das Jahr bleibt auf deinem Gerät und wird nicht gespeichert.</small></div>`;
    document.body.appendChild(ov);
    const sel = ov.querySelector('#kal-jahr'), knopf = ov.querySelector('.kal-weiter');
    sel.addEventListener('change', () => { knopf.disabled = !sel.value; });
    knopf.addEventListener('click', () => { if (!sel.value) return; antworten(+sel.value); ov.remove(); });
  }
  const css = document.createElement('style');
  css.textContent = `#ks-alter{position:fixed;inset:0;z-index:13000;background:rgb(20 14 8/.72);display:flex;align-items:center;justify-content:center;padding:16px}
  #ks-alter .kal-box{width:100%;max-width:360px;box-sizing:border-box;background:#fffdf9;color:#3b2a17;border:3px solid #8b5a2b;border-radius:20px;
    box-shadow:0 6px 0 #5c3a21;padding:20px 18px;display:flex;flex-direction:column;gap:10px;font-family:var(--font-text,'Rubik',system-ui,sans-serif)}
  #ks-alter b{font:800 21px/1.2 var(--font-titel,var(--font-display,'Rubik',system-ui))}
  #ks-alter label{font:600 15px/1.35 inherit}
  #ks-alter select{font:600 17px/1 inherit;padding:12px;border-radius:12px;border:2px solid #8b5a2b;background:#f6ead2;color:#3b2a17;min-height:48px}
  #ks-alter .kal-weiter{min-height:50px;border:0;border-radius:14px;background:#78bc61;color:#10230a;font:800 16px/1 inherit;box-shadow:0 4px 0 #4d8236;cursor:pointer}
  #ks-alter .kal-weiter:disabled{background:#d9cdb5;color:#6b5a44;box-shadow:0 4px 0 #b59a6a;cursor:default}
  #ks-alter small{font-size:12.5px;line-height:1.4;color:#6b5a44}`;
  document.head.appendChild(css);
  const los = () => { try { if (offen()) fragen(); } catch (e) { /* ohne Frage */ } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', los); else los();

  window.KSAlter = { fragen, stand: lies, offen };
  console.log('[Kickstil-Alter v1] aktiv — Altersfrage ' + (huelle() ? '(Android-App)' : '(nur Test)'));
})();
