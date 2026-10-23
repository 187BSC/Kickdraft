/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · BEWERTUNG  ·  v1   (Nutzer 2026-10-16: „Mitteilung im Spiel, dass man das Spiel bewerten soll, inwiefern es Spaß macht“)
   ─────────────────────────────────────────────────────────────────────────
   Erst fragen, ob es Spaß macht – nur wer „Ja“ sagt, wird zur Store-Bewertung geschickt (FcmApk.bewerten: Googles In-App-Bewertung,
   sonst die Store-Seite). „Geht so“ führt zu einer Rückmeldung an uns (Mail an CFG.mail, sobald es eine Adresse gibt).
   Wann: nach einem guten Saisonabschluss (Aufstieg, Meister, Pokalsieg oder obere Tabellenhälfte), frühestens ab dem 3. Start
   und 2 Tage nach dem ersten Start, höchstens CFG.maxFragen-mal, mindestens CFG.abstandTage Tage Abstand; nach „Bewerten“
   oder „Nicht mehr fragen“ nie wieder. Kickdraft (Gesamt-App) ohne Flutlicht-Saison: nach dem 6. Start. Geräteweit, localStorage
   „gesamt-bewertung“ (eine App, eine Store-Seite).
   API: KSBewertung.fragen() · .faellig() · .CFG
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const CFG = { mail: '', abStart: 3, abTagen: 2, abstandTage: 21, maxFragen: 3, kickdraftStarts: 6 };
  const KEY = 'gesamt-bewertung';
  const lies = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } };
  const schreib = z => { try { localStorage.setItem(KEY, JSON.stringify(z)); } catch (e) { /* ohne Merker */ } };
  const hatSpiel = () => { try { return typeof CLUB !== 'undefined' && CLUB && typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.tiers; } catch (e) { return false; } };
  const toast = (t, art) => { if (typeof window.showToast === 'function') window.showToast(t, art || 'info'); };
  { const z = lies(); z.starts = (z.starts || 0) + 1; if (!z.erster) z.erster = Date.now(); schreib(z); }

  function erlaubt() {
    const z = lies();
    if (z.fertig || (z.fragen || 0) >= CFG.maxFragen) return false;
    if ((z.starts || 0) < CFG.abStart || Date.now() - (z.erster || Date.now()) < CFG.abTagen * 864e5) return false;
    if (Date.now() - (z.zuletzt || 0) < CFG.abstandTage * 864e5) return false;
    return true;
  }
  let moment = false;
  const faellig = () => moment && erlaubt();

  // Guter Saisonabschluss (Daten aus kickstil_saisonabschluss.js)
  if (typeof window.startNewSeason === 'function') {
    const _s = window.startNewSeason;
    window.startNewSeason = function () {
      const r = _s.apply(this, arguments);
      try {
        const v = window.KSSaisonende && KSSaisonende.letzte();
        if (v && !v.ab && (v.auf || v.platz === 1 || v.pokalsieger || v.platz <= Math.ceil((v.anzahl || 18) / 2))) moment = true;
      } catch (e) { /* ohne Moment */ }
      return r;
    };
    try { startNewSeason = window.startNewSeason; } catch (e) { /* window reicht */ }
  }
  // Kickdraft in der Gesamt-App: ohne Flutlicht-Saison nach einigen Starts
  setTimeout(() => { if (!hatSpiel() && (lies().starts || 0) >= CFG.kickdraftStarts) moment = true; }, 20000);

  const frei = () => {
    try { if (window.KSErfolge && KSErfolge.frei && hatSpiel() && !KSErfolge.frei()) return false; } catch (e) { return false; }
    if (window.KSErfolge && KSErfolge.warteschlange && KSErfolge.warteschlange().length) return false;
    try { const E = window.KSErfolge && hatSpiel() && KSErfolge.zustand(); if (E && E.bilanzOffen != null) return false; } catch (e) { /* weiter */ }
    if (document.querySelector('.ef-bilanz, #ks-pro.auf, #ks-push.auf, #ks-neu.auf, .exp-gameover, #ks-saisonende.auf, .exp-overlay, #pm-overlay')) return false;
    return !document.body.classList.contains('ts-offen') && !document.hidden;
  };

  let EL = null;
  function seite(art) {
    if (art === 'frage') return `<i class="ti ti-mood-happy kbw-gross" aria-hidden="true"></i><b>Macht dir das Spiel Spaß?</b>
      <p>Eine ehrliche Antwort hilft uns, es besser zu machen.</p>
      <div class="kbw-reihe"><button type="button" class="kbw-ja" data-bw="ja"><i class="ti ti-mood-happy" aria-hidden="true"></i>Ja!</button>
        <button type="button" class="kbw-geht" data-bw="geht"><i class="ti ti-mood-neutral" aria-hidden="true"></i>Geht so</button></div>
      <button type="button" class="kbw-leise" data-bw="spaeter">Später</button>`;
    if (art === 'bewerten') return `<i class="ti ti-star-filled kbw-gross gold" aria-hidden="true"></i><b>Das freut uns!</b>
      <p>Magst du das Spiel im Play Store bewerten? Ein paar Sterne helfen einem kleinen Studio mehr als alles andere.</p>
      <button type="button" class="kbw-ja breit" data-bw="store">Jetzt bewerten</button>
      <div class="kbw-reihe"><button type="button" class="kbw-leise" data-bw="spaeter">Später</button><button type="button" class="kbw-leise" data-bw="nie">Nicht mehr fragen</button></div>`;
    return `<i class="ti ti-message-heart kbw-gross" aria-hidden="true"></i><b>Was sollen wir besser machen?</b>
      <p>Schreib uns kurz, was fehlt oder nervt – wir lesen alles.</p>
      <textarea class="kbw-text" rows="4" maxlength="800" placeholder="Zum Beispiel: zu wenig Tore, Transfers zu teuer, …"></textarea>
      <button type="button" class="kbw-ja breit" data-bw="senden">Senden</button>
      <button type="button" class="kbw-leise" data-bw="spaeter">Abbrechen</button>`;
  }
  function zeichnen(art) { EL.querySelector('.kbw-box').innerHTML = seite(art); }
  function fragen() {
    if (!EL) {
      EL = document.createElement('div'); EL.id = 'ks-bewertung';
      EL.innerHTML = '<div class="kbw-bg"></div><div class="kbw-box" role="dialog" aria-modal="true" aria-label="Bewertung"></div>';
      EL.addEventListener('click', ev => {
        const b = ev.target.closest('[data-bw]'); if (!b) return;
        const a = b.getAttribute('data-bw'), z = lies();
        if (a === 'ja') { z.spass = 'ja'; schreib(z); zeichnen('bewerten'); return; }
        if (a === 'geht') { z.spass = 'geht'; schreib(z); zeichnen('rueckmeldung'); return; }
        if (a === 'store') {
          z.fertig = 'bewertet'; schreib(z); EL.classList.remove('auf');
          if (window.FcmApk && typeof window.FcmApk.bewerten === 'function') { try { window.FcmApk.bewerten(); } catch (e) { /* ohne */ } }
          else toast('Danke! Die Bewertung geht, sobald das Spiel im Play Store ist.', 'success');
          return;
        }
        if (a === 'nie') { z.fertig = 'nie'; schreib(z); EL.classList.remove('auf'); return; }
        if (a === 'senden') {
          const t = (EL.querySelector('.kbw-text') || {}).value || '';
          z.rueckmeldungen = (z.rueckmeldungen || []).concat([{ t: Date.now(), text: t.slice(0, 800) }]).slice(-5); schreib(z);
          if (CFG.mail && t.trim()) { try { location.href = 'mailto:' + CFG.mail + '?subject=' + encodeURIComponent('Rückmeldung Unter Flutlicht') + '&body=' + encodeURIComponent(t); } catch (e) { /* ohne Mail */ } }
          EL.classList.remove('auf'); toast('Danke für deine Rückmeldung!', 'success'); return;
        }
        EL.classList.remove('auf');   // später
      });
      document.body.appendChild(EL);
    }
    const z = lies(); z.fragen = (z.fragen || 0) + 1; z.zuletzt = Date.now(); schreib(z);
    zeichnen('frage');
    requestAnimationFrame(() => EL.classList.add('auf'));
    return true;
  }
  setInterval(() => { try { if (faellig() && frei()) { moment = false; fragen(); } } catch (e) { /* später */ } }, 2500);

  const css = document.createElement('style');
  css.textContent = `#ks-bewertung{position:fixed;inset:0;z-index:12450;pointer-events:none}#ks-bewertung.auf{pointer-events:auto}
  .kbw-bg{position:absolute;inset:0;background:rgb(6 6 5/.62);opacity:0;transition:opacity .18s}#ks-bewertung.auf .kbw-bg{opacity:1}
  .kbw-box{position:absolute;left:16px;right:16px;top:50%;max-width:400px;margin:0 auto;transform:translateY(-40%) scale(.96);opacity:0;transition:all .22s;
    background:var(--bg2,#fffaf0);color:var(--text,#2b2a26);border-radius:20px;border:3px solid var(--k-rahmen,#8b5a2b);padding:18px 16px;text-align:center;
    font-family:var(--font-text,system-ui);display:flex;flex-direction:column;align-items:center;gap:6px}
  #ks-bewertung.auf .kbw-box{transform:translateY(-50%);opacity:1}html.dark .kbw-box{background:var(--bg2,#1e2230)}
  .kbw-gross{font-size:42px;color:var(--k-gruen,#25c065)}.kbw-gross.gold{color:#e3a524}
  .kbw-box>b{font:700 21px/1.2 var(--font-titel,Fredoka,system-ui)}.kbw-box p{margin:0 0 6px;font-size:14px;line-height:1.4;color:var(--text2,#5a4a36)}
  .kbw-reihe{display:flex;gap:8px;width:100%;justify-content:center}
  .kbw-ja,.kbw-geht{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;border:0;border-radius:14px;padding:12px;font:700 16px/1 var(--font-titel,system-ui);cursor:pointer}
  .kbw-ja i,.kbw-geht i{font-size:26px}.kbw-ja{color:#fff;background:var(--k-gruen,#25c065);box-shadow:0 4px 0 var(--k-gruen-tief,#188a46)}
  .kbw-geht{background:var(--bg3,#efe2c8);color:inherit;box-shadow:0 4px 0 var(--k-rand,#d9c29a)}.kbw-ja.breit{width:100%;flex:none}
  .kbw-leise{border:0;background:transparent;color:var(--text3,#846d52);font:600 14px/1 var(--font-text,system-ui);padding:10px;cursor:pointer}
  .kbw-text{width:100%;box-sizing:border-box;border-radius:12px;border:2px solid var(--k-rand,#d9c29a);background:var(--bg,#fff);color:inherit;padding:10px;font:14px/1.4 var(--font-text,system-ui);resize:vertical}`;
  document.head.appendChild(css);

  window.KSBewertung = { CFG, fragen, faellig, erlaubt };
  console.log('[Kickstil-Bewertung v1] aktiv — Spaß-Frage nach guten Saisons, dann Store-Bewertung oder Rückmeldung');
})();
