/* =====================================================================
   DFL-App v1 — Spiel als App (Startbildschirm, offline, Android)
   ─────────────────────────────────────────────────────────────────────
   • meldet den Service Worker an (sw.js: offline spielbar, Updates im
     Hintergrund) – nur über http(s), nicht in der Android-App (Capacitor
     liefert die Dateien selbst) und nicht im Offline-ZIP (file://)
   • bittet den Browser, den Speicher dauerhaft zu halten: der Spielstand
     liegt im localStorage und soll nicht beim Aufräumen verschwinden
   • „Als App installieren“ im Mehr-Blatt der Handyleiste: Android/Chrome
     über das Install-Angebot des Browsers, iPhone mit Hinweis (Teilen →
     Zum Home-Bildschirm)
   • markiert <html> mit .dfl-app, wenn das Spiel als App läuft
   • Bestätigen ohne Browserdialog: wo confirm() unterdrückt wird (eingebettete
     Seite, z. B. als Artifact), fragt ein eigener Dialog; bei „Ja“ wird der
     auslösende Klick wiederholt und dieselbe Frage dann mit Ja beantwortet
   Lädt nach mobile_patch.js, vor init_bootstrap.js.
   ===================================================================== */
(function () {
  'use strict';

  const capacitor = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const standalone = () => capacitor || navigator.standalone === true ||
    (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.MSStream;
  if (standalone()) document.documentElement.classList.add('dfl-app');

  // ── Service Worker ─────────────────────────────────────────────────────────
  let swStatus = 'aus';
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !capacitor) {
    const anmelden = () => navigator.serviceWorker.register('sw.js')
      .then(() => { swStatus = 'an'; })
      .catch(e => { swStatus = 'fehlgeschlagen'; console.info('[DFL-App] kein Service Worker:', e && e.message); });
    if (document.readyState === 'complete') anmelden(); else window.addEventListener('load', anmelden);
  }

  // ── Speicher dauerhaft ─────────────────────────────────────────────────────
  try {
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persisted().then(ja => { if (!ja) return navigator.storage.persist(); }).catch(() => {});
    }
  } catch (e) { /* älterer Browser */ }

  // ── Installieren ───────────────────────────────────────────────────────────
  let angebot = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); angebot = e; eintrag(); });
  window.addEventListener('appinstalled', function () { angebot = null; eintrag(); toast('Kickdraft ist installiert – viel Spaß!'); });

  function toast(t) {
    try { if (typeof showToast === 'function') { showToast(t); return; } } catch (e) {}
    try { alert(t); } catch (e) {}
  }

  function eintrag() {
    const box = document.querySelector('#app-sheet .app-sheet-box') || document.querySelector('#mob-sheet .mob-sheet-box');
    if (!box) return;
    let b = document.getElementById('dfl-app-installieren');
    const zeigen = !standalone() && (angebot || ios);
    if (!zeigen) { if (b) b.remove(); return; }
    if (b && box.contains(b)) return;
    if (b) b.remove();
    b = document.createElement('button');
    b.id = 'dfl-app-installieren';
    b.className = 'mob-eintrag';
    b.innerHTML = '<i class="ti ti-device-mobile-down" aria-hidden="true"></i>' +
      '<span class="mob-eintrag-txt"><b>Als App installieren</b><small>' +
      (ios ? 'Teilen → „Zum Home-Bildschirm“' : 'Auf den Startbildschirm, auch offline') + '</small></span>' +
      '<i class="ti ti-chevron-right mob-pfeil" aria-hidden="true"></i>';
    b.addEventListener('click', function (ev) {
      ev.stopPropagation();   // das Blatt würde sonst eine Ansicht ohne Namen öffnen
      ['mob-sheet', 'app-sheet'].forEach(function (id) { const s = document.getElementById(id); if (s) s.classList.remove('auf'); });
      document.body.classList.remove('mob-sheet-offen', 'app-gesperrt');
      if (angebot) {
        angebot.prompt();
        angebot.userChoice.then(function () { angebot = null; eintrag(); }).catch(function () {});
      } else if (ios) {
        toast('Auf dem iPhone: unten auf „Teilen“ tippen, dann „Zum Home-Bildschirm“. Danach startet Kickdraft wie eine App.');
      }
    });
    box.appendChild(b);
  }

  // Das Mehr-Blatt baut mobile_patch.js erst bei schmalem Fenster → nachziehen
  function nachziehen() { eintrag(); }
  window.addEventListener('resize', nachziehen);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', nachziehen); else nachziehen();

  // ── Bestätigen ohne Browserdialog ──────────────────────────────────────────
  // Die Aufrufer sind synchron (`if (!confirm(…)) return;`). Kommt die Antwort
  // schneller, als ein Mensch tippen kann, war der Dialog unterdrückt.
  const freigaben = new Map();             // Frage → gültig bis (ms)
  let letzterKlick = null, dialogAuf = false;
  document.addEventListener('click', function (e) { if (!e.target.closest('#dfl-frage')) letzterKlick = e.target; }, true);
  const _confirm = window.confirm;
  window.confirm = function (frage) {
    const text = String(frage == null ? '' : frage), jetzt = Date.now();
    if ((freigaben.get(text) || 0) > jetzt) return true;
    const t0 = performance.now();
    let antwort = false;
    try { antwort = _confirm.call(window, text); } catch (e) { antwort = false; }
    if (antwort || performance.now() - t0 > 150 || dialogAuf) return antwort;
    const ziel = letzterKlick;
    frageZeigen(text, function () {
      freigaben.set(text, Date.now() + 30000);   // Folgefragen derselben Aktion bleiben beantwortet
      if (ziel && ziel.isConnected) ziel.click();
    });
    return false;
  };

  function frageZeigen(text, ja) {
    dialogAuf = true;
    const ov = document.createElement('div');
    ov.id = 'dfl-frage';
    ov.innerHTML = '<div class="dfl-frage-box" role="alertdialog" aria-modal="true" aria-labelledby="dfl-frage-text">' +
      '<div id="dfl-frage-text" class="dfl-frage-text"></div>' +
      '<div class="dfl-frage-knoepfe"><button type="button" class="dfl-frage-nein">Abbrechen</button>' +
      '<button type="button" class="dfl-frage-ja">Ja, weiter</button></div></div>';
    ov.querySelector('.dfl-frage-text').textContent = text;
    const zu = function () { ov.remove(); dialogAuf = false; };
    ov.addEventListener('click', function (e) {
      if (e.target === ov || e.target.closest('.dfl-frage-nein')) { zu(); return; }
      if (e.target.closest('.dfl-frage-ja')) { zu(); setTimeout(ja, 0); }
    });
    document.body.appendChild(ov);
    try { ov.querySelector('.dfl-frage-ja').focus(); } catch (e) {}
  }

  window.DFLApp = {
    standalone: standalone,
    capacitor: capacitor,
    status: function () { return { sw: swStatus, standalone: standalone(), capacitor: capacitor, installierbar: !!angebot, ios: ios }; }
  };
  console.log('[DFL-App v1] aktiv — ' + (capacitor ? 'Android-App' : standalone() ? 'installiert (Startbildschirm)' : 'Browser') +
    ', Service Worker ' + (/^https?:$/.test(location.protocol) && !capacitor ? 'wird angemeldet' : 'nicht nötig'));
})();
