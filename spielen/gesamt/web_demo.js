/* ═══════════════════════════════════════════════════════════════════════════
   WEBSITE-DEMO  ·  v1   (2026-10-23, Nutzer: „Website mit der Demo … beide Spiele in eins und eine Demo-Version zum Online-Spielen,
   angepasst auf Handy und PC“)
   ─────────────────────────────────────────────────────────────────────────
   Nur in der Fassung für langerhafer.com/spielen/ (gesamt_app/website_bauen.sh hängt die Datei als erstes Skript in die Moduswahl
   und in beide Spielarten). Nichts davon gilt in der App oder der PC-Version.
     · Großer Bildschirm mit Maus (ab 1200 px): PC-Bedienung an wie in der PC-Demo (pcs-test), Vollversion-Teile aus (pcs-demo = NLZ)
     · Joker ohne Video wie in der App ohne Netz (höchstens einer am Tag) – der Browser zeigt keine Werbung, auch keinen Platzhalter
     · Bewertungsfrage aus (sie führt zum Play Store)
     · Ladebild (#web-lade, setzt website_bauen.sh direkt nach <body>): liegt, bis die Seite fertig ist – vorher blitzten die
       unfertige Oberfläche und die internen Vereinsnamen auf – und beim Start einer Karriere, bis das Office steht
     · „Woche weiter“: Knopf zeigt sofort, dass gerechnet wird (Animation läuft auch, während das Spiel rechnet)
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
  // Tag/Nacht wie das Spiel (dfl-stil: auto nach Uhrzeit 6–19 Uhr, tag, nacht) – fürs Ladebild
  try { const w = localStorage.getItem('dfl-stil'), h = new Date().getHours();
    if (w === 'nacht' || ((!w || w === 'auto') && (h < 6 || h >= 19))) document.documentElement.classList.add('wl-nacht'); } catch (e) { /* Tag */ }
  const ladebild = () => document.getElementById('web-lade');
  const naechstesBild = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  function ladebildZeigen() { const e = ladebild(); if (e) { e.hidden = false; e.classList.remove('weg'); } }
  function ladebildWeg() {
    const e = ladebild(); if (!e) return;
    naechstesBild().then(() => { e.classList.add('weg'); setTimeout(() => { if (e.classList.contains('weg')) e.hidden = true; }, 400); });
  }
  // Karriere starten/laden: erst das Ladebild zeichnen, dann rechnen lassen, danach ausblenden
  function huellen(name) {
    const orig = window[name];
    if (typeof orig !== 'function' || orig.__web) return;
    const h = async function () { ladebildZeigen(); await naechstesBild(); try { return await orig.apply(this, arguments); } finally { setTimeout(ladebildWeg, 600); } };
    h.__web = true; window[name] = h;
  }
  // „Woche weiter“: echter Tipp → Knopf zeigt sofort „rechnet“, zwei Bilder später läuft die Woche wie gehabt
  const WOCHE = /Woche weiter|Spieltag weiter|Zum Spieltag|Weiter zur|Saison abschließen/;
  document.addEventListener('click', ev => {
    if (!ev.isTrusted) return;
    const k = ev.target.closest && ev.target.closest('#app-cta, button, .cal-next');
    if (!k || k.classList.contains('web-rechnet') || !(k.id === 'app-cta' || WOCHE.test(k.textContent || ''))) return;
    ev.preventDefault(); ev.stopImmediatePropagation();
    k.classList.add('web-rechnet');
    naechstesBild().then(() => { try { k.click(); } finally { setTimeout(() => k.classList.remove('web-rechnet'), 120); } });
  }, true);
  // Bedienbar, sobald alle Skripte gelaufen sind (DOMContentLoaded) – Bilder dürfen nachladen
  document.addEventListener('DOMContentLoaded', () => { ['_beginNewGame', '_beginGame'].forEach(huellen); setTimeout(ladebildWeg, 350); });
  window.addEventListener('load', () => {
    if (window.KSWerbung && KSWerbung.anbieterSetzen) KSWerbung.anbieterSetzen(fertig => fertig(true, true));
    ['_beginNewGame', '_beginGame'].forEach(huellen);
  });
  console.log('[Website-Demo v2] aktiv — Ladebild, Woche-weiter-Rückmeldung, PC-Bedienung ab 1200 px mit Maus, Joker ohne Video, keine Bewertungsfrage');
})();
