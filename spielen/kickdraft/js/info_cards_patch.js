/* ===== info_cards_patch.js =====
   Kleine Infokarten: ⓘ-Buttons neben Überschriften/Dialogen öffnen ein kompaktes
   Popover, das die jeweilige Spielmechanik erklärt. Zentrale Text-Map, ein
   wiederverwendbares Popover, Schließen per Außenklick oder erneutem Klick.
   API: window.infoBtn('key') → Button-HTML · window.toggleInfoCard(event,'key') · window.infoKarteSetzen('key', titel, text).
   Lädt spät (Buttons werden zur Renderzeit mit typeof-Guard eingebettet).
   ============================================================================= */
(function () {
  'use strict';

  const INFO = {
    postfach: { t: 'Postfach', x: 'Angebote, Warnungen und Nachrichten. Der rote Zähler zeigt, was offen ist.' },
    sponsoren: { t: 'Sponsoren', x: 'Trikot, Ärmel, Stadionname. <b>Solide</b> = viel Fixgeld · <b>Ambitioniert</b> = hohe Erfolgsboni am Saisonende.' },
    kader: { t: 'Kaderliste', x: 'Punkte: Moral · Form · Fitness. <b>+N</b> = Entwicklung seit Saisonstart. Stars auf der Bank werden unzufrieden.' },
    vertrag: { t: 'Vertrag', x: '<b>Cap Hit</b> = Gehalt + Handgeld ÷ Laufzeit, muss in den freien Cap passen. Nach 3 zu niedrigen Angeboten ist Schluss.' },
    finanzen: { t: 'Finanzen', x: 'Was gegen den Cap zählt, kostet Geld (Cap Hits × 1,1). Der Saisonplan wird zum Start gebucht, danach zählen nur Abweichungen.' },
  };

  function ensurePop() {
    let el = document.getElementById('info-pop');
    if (!el) {
      el = document.createElement('div');
      el.id = 'info-pop'; el.className = 'info-pop';
      document.body.appendChild(el);
      document.addEventListener('click', function (ev) {
        if (!el.contains(ev.target) && !(ev.target.closest && ev.target.closest('.info-btn'))) hidePop();
      }, true);
    }
    return el;
  }
  function hidePop() { const el = document.getElementById('info-pop'); if (el) { el.style.display = 'none'; el._key = null; } }

  window.toggleInfoCard = function (ev, key) {
    if (ev) { try { ev.stopPropagation(); ev.preventDefault(); } catch (e) {} }
    const el = ensurePop(); const d = INFO[key];
    if (!d) { hidePop(); return; }
    if (el._key === key && el.style.display !== 'none') { hidePop(); return; }
    el.innerHTML = `<div class="info-pop-title"><i class="ti ti-info-circle"></i> ${d.t}</div><div class="info-pop-text">${d.x}</div>`;
    el.style.display = 'block'; el._key = key;
    const btn = ev && (ev.currentTarget || ev.target);
    const r = (btn && btn.getBoundingClientRect) ? btn.getBoundingClientRect() : { left: 20, top: 60, bottom: 60 };
    const w = Math.min(330, window.innerWidth - 24);
    el.style.width = w + 'px';
    let left = Math.min(Math.max(12, r.left - 20), window.innerWidth - w - 12);
    let top = r.bottom + 8;
    const h = el.offsetHeight || 200;
    if (top + h > window.innerHeight - 12) top = Math.max(12, r.top - 8 - h);
    el.style.left = left + 'px'; el.style.top = top + 'px';
  };
  window.infoBtn = function (key) {
    return `<button class="info-btn" onclick="toggleInfoCard(event,'${key}')" title="Erklärung anzeigen" aria-label="Info"><i class="ti ti-info-circle"></i></button>`;
  };
  // Weitere Infokarten aus anderen Modulen (D76: Erklärsätze hinter ⓘ statt im Fließtext) – Titel und Text (HTML erlaubt)
  window.infoKarteSetzen = function (key, titel, text) { if (key) INFO[key] = { t: titel, x: text }; };

  console.log('[InfoCards v1] aktiv — ' + Object.keys(INFO).length + ' Infokarten (ⓘ)');
})();
