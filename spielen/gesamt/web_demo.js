/* ═══════════════════════════════════════════════════════════════════════════
   WEBSITE-DEMO  ·  v1   (2026-10-23, Nutzer: „Website mit der Demo … beide Spiele in eins und eine Demo-Version zum Online-Spielen,
   angepasst auf Handy und PC“)
   ─────────────────────────────────────────────────────────────────────────
   Nur in der Fassung für langerhafer.com/spielen/ (gesamt_app/website_bauen.sh hängt die Datei als erstes Skript in die Moduswahl
   und in beide Spielarten). Nichts davon gilt in der App oder der PC-Version.
     · Großer Bildschirm mit Maus (ab 1200 px): PC-Bedienung an wie in der PC-Demo (pcs-test), Vollversion-Teile aus (pcs-demo = NLZ)
     · Joker ohne Video wie in der App ohne Netz (höchstens einer am Tag) – der Browser zeigt keine Werbung, auch keinen Platzhalter
     · Bewertungsfrage aus (sie führt zum Play Store)
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  window.KS_WEB = true;
  try {
    const pc = window.matchMedia && matchMedia('(min-width: 1200px) and (hover: hover) and (pointer: fine)').matches;
    if (pc) localStorage.setItem('pcs-test', 'an'); else localStorage.removeItem('pcs-test');
    localStorage.setItem('pcs-demo', 'an');
    const bw = JSON.parse(localStorage.getItem('gesamt-bewertung') || '{}') || {};
    if (!bw.fertig) { bw.fertig = 'web'; localStorage.setItem('gesamt-bewertung', JSON.stringify(bw)); }
  } catch (e) { /* ohne Speicher */ }
  // Moduswahl: Hinweis auf die Demo-Grenze und Weg zurück zur Website (Saisons aus dem Skript-Tag, website_bauen.sh)
  const tag = document.currentScript, fl = tag && tag.dataset.fl, kd = tag && tag.dataset.kd;
  document.addEventListener('DOMContentLoaded', () => {
    const fuss = document.getElementById('m-flutlicht') && document.querySelector('main footer');
    if (!fuss) return;
    const n = x => x === '1' ? 'eine Saison' : x + ' Saisons';
    const el = document.createElement('p');
    el.style.cssText = 'margin:14px 0 0;font-size:13px;line-height:1.5';
    el.innerHTML = `Demo im Browser: Vereinskarriere ${n(fl || '2')}, Kickdraft ${n(kd || '1')} · ohne Werbung<br>
      <a href="../" style="color:inherit;font-weight:700">Zurück zu langerhafer.com</a>`;
    fuss.appendChild(el);
  });
  window.addEventListener('load', () => {
    if (window.KSWerbung && KSWerbung.anbieterSetzen) KSWerbung.anbieterSetzen(fertig => fertig(true, true));
  });
  console.log('[Website-Demo v1] aktiv — PC-Bedienung ab 1200 px mit Maus, Joker ohne Video, keine Bewertungsfrage');
})();
