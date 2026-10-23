/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · RECHTLICHES  ·  v1   (Datenschutzerklärung vom 2026-10-16, Website 187bsc.github.io/Kickdraft)
   ─────────────────────────────────────────────────────────────────────────
   Beide Spiele, ein Text, passend zur Erklärung auf der Website:
     · Kickdraft: ersetzt in „Impressum und Datenschutz“ (dfl_start.js, Ansicht „recht“) Impressum und Datenschutz – der alte
       Text sagte „keine Werbung“. Lizenzen bleiben.
     · Flutlicht: Eintrag „Impressum und Datenschutz“ im Mehr-Blatt mit demselben Inhalt.
   Kurzfassung in der App, die ganze Erklärung und das Impressum auf der Website (öffnet im Browser). Die Anschrift fürs
   Impressum steht nur auf der Website (CFG.anschrift bleibt leer, bis der Nutzer sie freigibt).
   API: KSRecht.html() · .oeffnen() · .CFG
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.KSRecht) return;
  const CFG = {
    seite: 'https://187bsc.github.io/Kickdraft/',
    datenschutz: 'https://187bsc.github.io/Kickdraft/datenschutz.html',
    impressum: 'https://187bsc.github.io/Kickdraft/impressum.html',
    name: 'Tim Laurids Ranze', kontakt: 'kickdraft.spiel@gmail.com', anschrift: [], stand: '16. Oktober 2026'
  };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const link = (href, text) => `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(text)}</a>`;
  const app = () => !!window.FcmApk;

  function impressumHtml() {
    const adr = CFG.anschrift.length ? CFG.anschrift.map(esc).join('<br>') + '<br>' : '';
    return `<p>${esc(CFG.name)}<br>${adr}E-Mail: <a href="mailto:${CFG.kontakt}">${CFG.kontakt}</a></p>
      <p>Vollständige Angaben nach § 5 DDG: ${link(CFG.impressum, 'Impressum auf der Website')}</p>`;
  }
  function datenschutzHtml() {
    return `<p>Das Spiel läuft auf deinem Gerät. Spielstände, Einstellungen und Nutzungszähler bleiben dort; ein Konto brauchst du nicht.
      Wir selbst bekommen keine Daten über dich: kein Server, keine Analyse-Werkzeuge, keine eigenen Tracker.</p>
      <p>${app() ? 'Diese App' : 'Die Android-App'} zeigt Werbung über Google AdMob. Dabei verarbeitet Google Daten wie deine Werbe-ID und
      IP-Adresse. Personalisierte Werbung gibt es nur mit deiner Einwilligung, unter 16 nie. Ändern kannst du die Einwilligung jederzeit:
      Mehr → „Datenschutz und Werbung“.${app() ? '' : ' Die Browser-Version zeigt keine Werbung.'}</p>
      ${app() ? '<p>Pro kaufst du über Google Play. Die Zahlung wickelt Google ab; wir erfahren nur, dass Pro gekauft ist – keine Zahlungsdaten.</p>' : ''}
      <p>Erinnerungen plant dein Handy selbst, nur mit deiner Erlaubnis. Feedback und Spielstand-Dateien schickst du nur selbst.</p>
      <p>Verantwortlich: ${esc(CFG.name)} · Kontakt: <a href="mailto:${CFG.kontakt}">${CFG.kontakt}</a></p>
      <p>${link(CFG.datenschutz, 'Ganze Datenschutzerklärung')} (Stand ${esc(CFG.stand)})</p>`;
  }
  function html() {
    return `<section><h3>Impressum</h3>${impressumHtml()}</section><section><h3>Datenschutz</h3>${datenschutzHtml()}</section>
      ${window.FcmDatenschutz ? '<button type="button" class="st-eintrag" data-ks-datenschutz="1"><span><b>Datenschutz und Werbung</b><small>Einwilligung für Anzeigen ändern</small></span></button>' : ''}
      <p class="ksr-fuss">Alle Vereine, Spieler und Personen sind erfunden. Ähnlichkeiten mit echten Vereinen oder Personen sind nicht beabsichtigt.</p>`;
  }

  // ── Kickdraft: Abschnitte in „Impressum und Datenschutz“ ersetzen ─────────
  function kickdraft() {
    const box = document.querySelector('.st-ov.st-recht .st-recht');
    if (!box || box.dataset.ksRecht) return;
    box.dataset.ksRecht = '1';
    box.querySelectorAll('section').forEach(sec => {
      const h = ((sec.querySelector('h3') || {}).textContent || '').trim();
      if (h === 'Impressum') sec.innerHTML = '<h3>Impressum</h3>' + impressumHtml();
      if (h === 'Datenschutz') {
        sec.innerHTML = '<h3>Datenschutz</h3>' + datenschutzHtml() +
          (window.FcmDatenschutz ? '<button type="button" class="st-eintrag" data-ks-datenschutz="1"><span><b>Datenschutz und Werbung</b><small>Einwilligung für Anzeigen ändern</small></span></button>' : '');
      }
    });
  }

  // ── Flutlicht: eigenes Blatt über das Mehr-Menü ────────────────────────────
  let EL = null;
  function oeffnen() {
    if (!EL) {
      EL = document.createElement('div'); EL.id = 'ks-recht';
      EL.innerHTML = '<div class="ksr-bg"></div><div class="ksr-box" role="dialog" aria-modal="true" aria-label="Impressum und Datenschutz"></div>';
      EL.addEventListener('click', ev => { if (ev.target.closest('.ksr-bg') || ev.target.closest('.ksr-zu')) EL.classList.remove('auf'); });
      document.body.appendChild(EL);
    }
    EL.querySelector('.ksr-box').innerHTML = `<div class="ksr-kopf"><b>Impressum und Datenschutz</b><button type="button" class="ksr-zu" aria-label="Schließen">✕</button></div><div class="ksr-inhalt">${html()}</div>`;
    requestAnimationFrame(() => EL.classList.add('auf'));
  }
  const kickdraftSpiel = () => !!(document.querySelector('.st-ov') || window.DFLTestkit);
  function eintrag() {
    if (kickdraftSpiel()) return;   // Kickdraft hat „Impressum und Datenschutz“ im Startbildschirm
    const box = document.querySelector('#app-sheet .app-sheet-box');
    if (!box || box.querySelector('[data-ks-recht]')) return;
    const b = document.createElement('button'); b.className = 'app-eintrag'; b.setAttribute('data-ks-recht', '1');
    b.innerHTML = '<i class="ti ti-scale" aria-hidden="true"></i><span class="app-eintrag-txt"><b>Impressum und Datenschutz</b><small>Werbung, Daten, Kontakt</small></span><i class="ti ti-chevron-right app-pfeil" aria-hidden="true"></i>';
    box.appendChild(b);
  }
  document.addEventListener('click', ev => {
    const b = ev.target.closest && ev.target.closest('[data-ks-recht]');
    if (!b) return;
    ev.preventDefault(); ev.stopPropagation();
    const s = document.getElementById('app-sheet'); if (s) s.classList.remove('auf');
    oeffnen();
  }, true);
  // „Datenschutz und Werbung“ aus diesen Ansichten: dasselbe UMP-Formular wie im Mehr-Blatt (kickstil_werbung.js fängt den Klick)
  setInterval(() => { try { kickdraft(); eintrag(); } catch (e) { /* später */ } }, 800);

  const css = document.createElement('style');
  css.textContent = `#ks-recht{position:fixed;inset:0;z-index:12400;pointer-events:none}#ks-recht.auf{pointer-events:auto}
  .ksr-bg{position:absolute;inset:0;background:rgb(6 6 5/.6);opacity:0;transition:opacity .18s}#ks-recht.auf .ksr-bg{opacity:1}
  .ksr-box{position:absolute;left:0;right:0;bottom:0;max-height:88vh;overflow:auto;background:var(--bg2,#fffdf9);color:var(--text,#3b2a17);
    border-radius:20px 20px 0 0;border:3px solid var(--k-rand,#8b5a2b);border-bottom:0;padding:16px 16px 24px;transform:translateY(100%);transition:transform .22s;
    font:15px/1.5 var(--font-text,system-ui)}#ks-recht.auf .ksr-box{transform:none}
  .ksr-kopf{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px}.ksr-kopf b{font:800 19px/1.2 var(--font-titel,var(--font-display,system-ui))}
  .ksr-zu{border:0;background:var(--bg3,#f6ead2);color:inherit;width:44px;height:44px;border-radius:50%;font-size:18px;cursor:pointer}
  .ksr-inhalt h3{font:800 13px/1 var(--font-text,system-ui);letter-spacing:.1em;text-transform:uppercase;color:var(--text3,#8e7556);margin:16px 0 6px}
  .ksr-inhalt p{margin:0 0 8px}.ksr-inhalt a{color:var(--k-blau-knopf,#2c7cb5);font-weight:700}
  .ksr-inhalt .st-eintrag{width:100%;text-align:left;border:2px solid var(--k-linie,#e3c99a);background:var(--bg3,#f6ead2);border-radius:14px;padding:12px;color:inherit;margin:4px 0 8px;font:inherit;cursor:pointer}
  .ksr-inhalt .st-eintrag span{display:flex;flex-direction:column}.ksr-inhalt .st-eintrag small{color:var(--text3,#8e7556)}
  .ksr-fuss{font-size:12.5px;color:var(--text3,#8e7556)}html.dark .ksr-box{background:var(--bg2,#1e2230)}`;
  document.head.appendChild(css);

  window.KSRecht = { CFG, html, oeffnen };
  console.log('[Kickstil-Rechtliches v1] aktiv — Impressum und Datenschutz passend zur Erklärung vom ' + CFG.stand);
})();
