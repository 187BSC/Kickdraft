/* ═══════════════════════════════════════════════════════════════════════════
   GESAMT-APP · MODUS WECHSELN  ·  v1   (2026-10-15)
   Wird von bauen.sh in beide Spiele eingehängt (vor </body>) und legt in deren Menü einen Eintrag
   „Spielart wechseln“ an, der zur Moduswahl (../index.html) zurückführt:
     · Kickdraft: Hauptmenü (dfl_start.js, Liste .st-liste)
     · Flutlicht: Mehr-Blatt der Handy-Oberfläche (#app-sheet .app-sheet-box) und Startbildschirm (Vereinswahl)
   Vorher wird gespeichert, falls das Spiel eine Speicherfunktion hat. Kein Eingriff in die Spiele selbst.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const ZIEL = '../index.html';
  const MODUS = /\/kickdraft\//.test(location.pathname) ? 'kickdraft' : 'flutlicht';
  try { localStorage.setItem('gesamt-modus', MODUS); } catch (e) { /* egal */ }

  async function wechseln() {
    try { if (typeof saveGameState === 'function' && typeof LEAGUE !== 'undefined' && LEAGUE) await saveGameState(); } catch (e) { /* trotzdem wechseln */ }
    location.href = ZIEL;
  }
  const ICON = '<i class="ti ti-switch-horizontal" aria-hidden="true"></i>';

  const ANDERES = MODUS === 'kickdraft' ? 'Zur Vereinskarriere' : 'Zu Kickdraft (Franchise-Liga)';
  function kickdraft() {
    document.querySelectorAll('.st-liste').forEach(liste => {
      if (liste.querySelector('[data-gesamt]')) return;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'st-eintrag'; b.setAttribute('data-gesamt', '1');
      b.innerHTML = ICON + '<span><b>Spielart wechseln</b><small>' + ANDERES + '</small></span><i class="ti ti-chevron-right" aria-hidden="true"></i>';
      liste.appendChild(b);
    });
  }
  function flutlicht() {
    const box = document.querySelector('#app-sheet .app-sheet-box');
    if (box && !box.querySelector('[data-gesamt]')) {
      const b = document.createElement('button');
      b.className = 'app-eintrag'; b.setAttribute('data-gesamt', '1');
      b.innerHTML = ICON + '<span class="app-eintrag-txt"><b>Spielart wechseln</b><small>' + ANDERES + '</small></span><i class="ti ti-chevron-right app-pfeil" aria-hidden="true"></i>';
      box.appendChild(b);
    }
    // Startbildschirm (Vereinswahl/Spielstände): kleiner Knopf unten
    const ob = document.getElementById('onboarding-overlay');
    if (ob && !ob.querySelector('[data-gesamt]')) {
      const b = document.createElement('button');
      b.type = 'button'; b.setAttribute('data-gesamt', '1');
      b.style.cssText = 'display:block;margin:18px auto 0;padding:8px 14px;border-radius:10px;border:2px solid currentColor;background:transparent;color:inherit;font:inherit;font-size:13px;cursor:pointer;opacity:.8';
      b.innerHTML = ICON + ' Spielart wechseln';
      (ob.firstElementChild || ob).appendChild(b);
    }
  }
  // Beide Spiele haben noch den alten Spielstand-Bildschirm (#onboarding-overlay) und eine Handy-Leiste mit Mehr-Blatt;
  // Kickdraft zusätzlich sein Hauptmenü (.st-liste). Alles prüfen – es greift nur, was gerade da ist.
  const einbauen = () => { kickdraft(); flutlicht(); };
  // Eigene Klicks vor den Spiel-Handlern abfangen (beide Menüs reagieren sonst auf jeden Knopf in ihrer Liste)
  document.addEventListener('click', ev => {
    const b = ev.target.closest && ev.target.closest('[data-gesamt]');
    if (!b) return;
    ev.preventDefault(); ev.stopPropagation(); wechseln();
  }, true);
  const los = () => { einbauen(); new MutationObserver(einbauen).observe(document.body, { childList: true, subtree: true }); };
  if (document.body) los(); else document.addEventListener('DOMContentLoaded', los);
  console.log('[Gesamt-App v1] aktiv — Spiel wechseln (' + MODUS + ')');
})();
