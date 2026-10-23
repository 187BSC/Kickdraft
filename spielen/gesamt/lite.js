/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · LITE  ·  v1   (Nutzer 2026-10-16: „eine wirkliche Lite-Version ohne Werbung zum Antesten, dann 3–5 € pro Version“)
   ─────────────────────────────────────────────────────────────────────────
   Nur in der Browser-Fassung „Lite“ aktiv (gesamt_app/web_bauen.sh setzt vorher window.KS_LITE = { saisons, spiel, kaufen }).
   Beide Spiele (Flutlicht direkt, Kickdraft als gesamt/lite.js). Ohne Werbung – die Browser-Fassungen zeigen ohnehin keine.
   Die Lite-Fassung ist das volle Spiel, aber nur für CFG.saisons Saisons: Beim Wechsel in die nächste Saison erscheint ein Fenster
   mit Link zur Vollversion (itch.io) und zur App; der Spielstand lässt sich als Datei sichern und in der Vollversion
   weiterspielen (gleicher Speicherweg wie „Spielstand exportieren“). Ein Banner zählt mit („Demo · Saison 1 von 2“), Abschlussfenster „Das war die Demo“.
   Demo mit Bitte um Feedback (Nutzer 2026-10-16: „eine Demo mit Bitte nach Feedback“): nach der ersten Saison einmal von selbst
   und im Abschlussfenster als Knopf – Sterne, Text, auf Wunsch Spieldaten (KSMessung.bericht). Senden über das Teilen-Menü bzw.
   eine Mail an CFG.mail; ohne beides wird der Text kopiert. In Kickdraft übernimmt das Test-Kit (DFLTestkit.feedback).
   API: KSLite.cfg · .fertig() · .feedback()
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const C = window.KS_LITE;
  if (!C) return;
  const CFG = Object.assign({ saisons: 2, spiel: 'Unter Flutlicht', kaufen: '', app: '', mail: 'kickdraft.spiel@gmail.com' }, C);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const saison = () => { try { return typeof LEAGUE !== 'undefined' && LEAGUE ? LEAGUE.season || 1 : 0; } catch (e) { return 0; } };
  const fertig = () => saison() > CFG.saisons;

  function sperre() {
    if (document.getElementById('ks-lite')) return;
    const ov = document.createElement('div'); ov.id = 'ks-lite';
    ov.innerHTML = `<div class="kl-box" role="dialog" aria-modal="true" aria-labelledby="kl-titel">
      <b id="kl-titel">Das war die Demo</b>
      <p>${CFG.saisons === 1 ? 'Eine Saison' : CFG.saisons + ' Saisons'} ${esc(CFG.spiel)} ${CFG.saisons === 1 ? 'ist' : 'sind'} gespielt. In der Vollversion geht deine Karriere weiter – ohne Grenze und ohne Werbung.</p>
      ${CFG.kaufen ? `<a class="kl-los" href="${esc(CFG.kaufen)}" target="_blank" rel="noopener">Vollversion holen</a>` : ''}
      ${CFG.app ? `<a class="kl-zweit" href="${esc(CFG.app)}" target="_blank" rel="noopener">Kostenlos als App (mit Werbung)</a>` : ''}
      <button type="button" class="kl-zweit" data-kl="feedback">Feedback geben – was soll besser werden?</button>
      <button type="button" class="kl-zweit" data-kl="export">Spielstand als Datei sichern</button>
      <small>${window.FcmPc ? 'Die Vollversion für den PC übernimmt deine Spielstände von selbst. Die Datei brauchst du nur für einen anderen Rechner: dort unter „Spielstände“ → „Spielstand aus Datei“.' : 'Den gesicherten Spielstand lädst du in der Vollversion unter „Spielstände“ → „Spielstand aus Datei“ und spielst einfach weiter.'}</small></div>`;
    document.body.appendChild(ov);
    ov.querySelector('[data-kl="feedback"]').addEventListener('click', () => feedback());
    ov.querySelector('[data-kl="export"]').addEventListener('click', async () => {
      try { if (typeof saveGameState === 'function') await saveGameState(); if (typeof exportSlotToFile === 'function') await exportSlotToFile(ACTIVE_SLOT_ID); }
      catch (e) { alert('Sichern fehlgeschlagen.'); }
    });
  }
  // ── Feedback ────────────────────────────────────────────────────────────────
  function feedback(anlass) {
    if (window.DFLTestkit && typeof DFLTestkit.feedback === 'function') { DFLTestkit.feedback(); return; }   // Kickdraft
    if (document.getElementById('kl-fb')) return;
    const ov = document.createElement('div'); ov.id = 'kl-fb';
    ov.innerHTML = `<div class="kl-box" role="dialog" aria-modal="true" aria-labelledby="kl-fb-titel">
      <b id="kl-fb-titel">${anlass === 'saison' ? 'Erste Saison geschafft!' : 'Dein Feedback'}</b>
      <p>Das Spiel ist neu und wird nach euren Rückmeldungen besser. Wie gefällt es dir bisher?</p>
      <div class="kl-sterne" role="radiogroup" aria-label="Bewertung">${[1, 2, 3, 4, 5].map(n => `<button type="button" role="radio" aria-checked="false" aria-label="${n} von 5" data-stern="${n}">★</button>`).join('')}</div>
      <label class="kl-lab" for="kl-fb-text">Was macht Spaß, was nervt, was fehlt?</label>
      <textarea id="kl-fb-text" rows="4" maxlength="1500"></textarea>
      <label class="kl-check"><input type="checkbox" id="kl-fb-daten" checked> Spieldaten anhängen (Spielzeit, Saison, Verein – nichts Persönliches)</label>
      <button type="button" class="kl-los" data-fb="senden">Senden</button>
      <button type="button" class="kl-zweit" data-fb="zu">Später</button></div>`;
    document.body.appendChild(ov);
    let sterne = 0;
    ov.addEventListener('click', ev => {
      const st = ev.target.closest('[data-stern]');
      if (st) { sterne = +st.dataset.stern; ov.querySelectorAll('[data-stern]').forEach(b => { const an = +b.dataset.stern <= sterne; b.classList.toggle('an', an); b.setAttribute('aria-checked', String(+b.dataset.stern === sterne)); }); return; }
      const a = ev.target.closest('[data-fb]'); if (!a) return;
      if (a.dataset.fb === 'zu') { ov.remove(); return; }
      let text = `${CFG.spiel} – Demo-Feedback\nBewertung: ${sterne ? sterne + ' von 5' : '–'}\n\n${ov.querySelector('#kl-fb-text').value.trim()}`;
      if (ov.querySelector('#kl-fb-daten').checked) {
        try { text += `\n\n--- Spiel ---\nSaison ${saison()} · ${(typeof CLUB !== 'undefined' && CLUB && CLUB.name) || ''}`; } catch (e) { /* ohne */ }
        try { if (window.KSMessung) text += '\n' + KSMessung.bericht(); } catch (e) { /* ohne */ }
        try { text += '\nGerät: ' + navigator.userAgent.slice(0, 120); } catch (e) { /* ohne */ }
      }
      ov.remove();
      const toast = t => { if (typeof window.showToast === 'function') window.showToast(t, 'success'); else alert(t); };
      try { if (navigator.share) { navigator.share({ title: CFG.spiel + ' – Feedback', text }).then(() => toast('Danke für dein Feedback!'), () => {}); return; } } catch (e) { /* weiter */ }
      if (CFG.mail) { location.href = 'mailto:' + CFG.mail + '?subject=' + encodeURIComponent(CFG.spiel + ' – Demo-Feedback') + '&body=' + encodeURIComponent(text); toast('Danke! Dein Mailprogramm öffnet sich.'); return; }
      try { navigator.clipboard.writeText(text).then(() => toast('Feedback kopiert – danke!')); } catch (e) { toast('Danke für dein Feedback!'); }
    });
  }
  let gefragt = false;
  try { gefragt = localStorage.getItem('ks-lite-feedback') === '1'; } catch (e) { /* ohne */ }

  if (typeof window.startNewSeason === 'function') {
    const _s = window.startNewSeason;
    window.startNewSeason = function () {
      const r = _s.apply(this, arguments);
      const danach = () => { try { if (fertig()) sperre(); else if (!gefragt && saison() >= 2) { gefragt = true; try { localStorage.setItem('ks-lite-feedback', '1'); } catch (e) { /* ohne */ } setTimeout(() => feedback('saison'), 2500); } } catch (e) { /* ohne */ } };
      if (r && typeof r.then === 'function') r.then(danach, danach); else setTimeout(danach, 0);
      return r;
    };
    try { startNewSeason = window.startNewSeason; } catch (e) { /* window reicht */ }
  }
  // Banner und Sperre auch nach dem Neuladen (Spielstand schon über der Grenze)
  setInterval(() => {
    try {
      if (fertig()) { sperre(); return; }
      let b = document.getElementById('kl-banner');
      if (saison() && !b) { b = document.createElement('a'); b.id = 'kl-banner'; if (CFG.kaufen) { b.href = CFG.kaufen; b.target = '_blank'; b.rel = 'noopener'; } document.body.appendChild(b); }
      if (b) b.textContent = `Demo · Saison ${saison()} von ${CFG.saisons}`;
    } catch (e) { /* später */ }
  }, 1500);

  const css = document.createElement('style');
  css.textContent = `#ks-lite{position:fixed;inset:0;z-index:14000;background:rgb(20 14 8/.8);display:flex;align-items:center;justify-content:center;padding:16px}
  .kl-box{width:100%;max-width:380px;box-sizing:border-box;background:#fffdf9;color:#3b2a17;border:3px solid #8b5a2b;border-radius:20px;box-shadow:0 6px 0 #5c3a21;
    padding:20px 18px;display:flex;flex-direction:column;gap:10px;font-family:var(--font-text,'Rubik',system-ui,sans-serif);text-align:center}
  .kl-box b{font:800 22px/1.2 var(--font-titel,var(--font-display,'Rubik',system-ui))}.kl-box p{margin:0;font-size:15px;line-height:1.45}
  .kl-los,.kl-zweit{display:flex;align-items:center;justify-content:center;min-height:50px;border:0;border-radius:14px;font:800 16px/1 inherit;text-decoration:none;cursor:pointer}
  .kl-los{background:#78bc61;color:#10230a;box-shadow:0 4px 0 #4d8236}.kl-zweit{background:#f6ead2;color:#3b2a17;box-shadow:0 4px 0 #b59a6a;font-weight:700;font-size:15px}
  .kl-box small{font-size:12.5px;color:#6b5a44;line-height:1.4}
  #kl-fb{position:fixed;inset:0;z-index:14100;background:rgb(20 14 8/.7);display:flex;align-items:center;justify-content:center;padding:16px}
  .kl-sterne{display:flex;justify-content:center;gap:6px}.kl-sterne button{width:46px;height:46px;border:0;border-radius:12px;background:#f6ead2;color:#c9b79a;font-size:26px;cursor:pointer}
  .kl-sterne button.an{color:#e3a524}.kl-lab{font-size:14px;font-weight:600;text-align:left}
  #kl-fb textarea{width:100%;box-sizing:border-box;border-radius:12px;border:2px solid #e3c99a;background:#fff;color:#3b2a17;padding:10px;font:14px/1.4 inherit;resize:vertical}
  .kl-check{display:flex;gap:8px;align-items:flex-start;text-align:left;font-size:13px;color:#5c4a35}
  #kl-banner{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(76px + env(safe-area-inset-bottom,0px));z-index:900;background:#f1c40f;color:#2a1c02;
    font:800 11px/1 system-ui;letter-spacing:.08em;text-transform:uppercase;padding:6px 10px;border-radius:999px;text-decoration:none;box-shadow:0 2px 6px rgb(0 0 0/.25);pointer-events:auto}`;
  document.head.appendChild(css);

  window.KSLite = { cfg: CFG, fertig, feedback };
  console.log('[Kickstil-Lite v1] aktiv — ' + CFG.saisons + ' Saisons, dann Vollversion');
})();
