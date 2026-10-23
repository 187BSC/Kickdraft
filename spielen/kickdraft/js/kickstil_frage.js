/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · FRAGE IM SPIEL-LOOK  ·  v1   (Rückmeldung 2026-10-18: „Wenn ich auf Anbieten klicke kommt ein Android-Layout.
   Muss unser Kenney sein“)
   ─────────────────────────────────────────────────────────────────────────
   Gleiche Datei für beide Spiele (Quelle flutlicht_manager/js, nach kickdraft/spiel/js kopieren).
   confirm() nach einem Tipp zeigt statt des Systemfensters unser Fenster (#dfl-frage, Stil in css/dfl_app.css): die erste Zeile
   als Überschrift, der Rest als Text. Die Aufrufer sind synchron (`if (!confirm(…)) return;`) – deshalb antwortet confirm()
   zuerst mit Nein, und „Ja“ tippt dasselbe Element noch einmal an; dann ist die Frage für 30 s freigegeben und confirm() sagt Ja.
   Ohne Tipp kurz davor (Zeitgeber, Ladevorgang) und in automatischen Tests (navigator.webdriver, außer localStorage ks-frage = an)
   bleibt das alte confirm().
   API: KSFrage.zeigen(text, { ja, nein, gefahr }) → Promise<boolean>
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const freigaben = new Map();                    // Frage → gültig bis (ms)
  let letzter = null, letzterT = 0, offen = false;
  document.addEventListener('click', e => { if (!e.target.closest('#dfl-frage')) { letzter = e.target; letzterT = Date.now(); } }, true);
  const test = () => { try { return !!navigator.webdriver && localStorage.getItem('ks-frage') !== 'an'; } catch (e) { return false; } };

  function zeigen(text, opt) {
    opt = opt || {};
    return new Promise(fertig => {
      offen = true;
      const zeilen = String(text == null ? '' : text).split('\n'), kopf = zeilen.shift().trim(), rest = zeilen.join('\n').trim();
      const ov = document.createElement('div');
      ov.id = 'dfl-frage';
      ov.innerHTML = '<div class="dfl-frage-box" role="alertdialog" aria-modal="true" aria-labelledby="dfl-frage-kopf">' +
        '<div id="dfl-frage-kopf" class="dfl-frage-kopf"></div><div class="dfl-frage-text"></div>' +
        '<div class="dfl-frage-knoepfe"><button type="button" class="dfl-frage-nein"></button>' +
        '<button type="button" class="dfl-frage-ja' + (opt.gefahr ? ' gefahr' : '') + '"></button></div></div>';
      ov.querySelector('.dfl-frage-kopf').textContent = kopf;
      const tx = ov.querySelector('.dfl-frage-text'); if (rest) tx.textContent = rest; else tx.remove();
      ov.querySelector('.dfl-frage-nein').textContent = opt.nein || 'Abbrechen';
      ov.querySelector('.dfl-frage-ja').textContent = opt.ja || 'Ja';
      const zu = antwort => { ov.remove(); offen = false; fertig(antwort); };
      ov.addEventListener('click', e => {
        if (e.target === ov || e.target.closest('.dfl-frage-nein')) zu(false);
        else if (e.target.closest('.dfl-frage-ja')) zu(true);
      });
      document.body.appendChild(ov);
      try { ov.querySelector('.dfl-frage-ja').focus(); } catch (e) { /* ohne Fokus */ }
    });
  }

  const _confirm = window.confirm;
  window.confirm = function (frage) {
    const text = String(frage == null ? '' : frage), jetzt = Date.now();
    if ((freigaben.get(text) || 0) > jetzt) return true;
    const ziel = letzter;
    if (test() || offen || !ziel || !ziel.isConnected || jetzt - letzterT > 1500) return _confirm.call(window, text);
    zeigen(text, { gefahr: /entlass|lösch|unwiderruflich|verkauf/i.test(text) }).then(ja => {
      if (!ja) return;
      freigaben.set(text, Date.now() + 30000);    // Folgefragen derselben Aktion bleiben beantwortet
      setTimeout(() => { if (ziel.isConnected) ziel.click(); }, 0);
    });
    return false;
  };

  const st = document.createElement('style');
  st.textContent = `.dfl-frage-kopf{font:700 17px/1.25 var(--font-titel,var(--font-display,system-ui));margin-bottom:6px}
    .dfl-frage-knoepfe .dfl-frage-ja.gefahr{background:var(--k-rot,#d04a3a);border-color:var(--k-rot,#d04a3a)}`;
  document.head.appendChild(st);
  window.KSFrage = { zeigen };
  console.log('[Kickstil-Frage v1] aktiv — Rückfragen im Spiel-Look statt Systemfenster');
})();
