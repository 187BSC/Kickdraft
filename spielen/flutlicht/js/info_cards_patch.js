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
    postfach: { t: 'Postfach', x: 'Bündelt alles Wichtige: <b>Angebote</b> für deine Spieler (annehmen, verhandeln oder ablehnen), <b>Warnungen</b> (Aufstellung, Verletzte, Sperren, auslaufende Verträge, Wechselwünsche, Streiks) und <b>Vereinsnachrichten</b>. Der rote Zähler zeigt offene Entscheidungen + Warnungen.' },
    sponsoren: { t: 'Sponsoren', x: 'Drei Slots: <b>Trikot</b>, <b>Ärmel</b> und <b>Stadionname</b> (ab Stadion-Stufe 4). Jedes Angebot hat ein Profil: <b>Solide</b> = viel Fixgeld, kleine Boni · <b>Ambitioniert</b> = weniger fix, hohe Erfolgsboni (Aufstieg, Top-3, Pokal-Halbfinale — gezahlt am Saisonende). Deine Wette auf die Saison.' },
    kader: { t: 'Kaderliste erklärt', x: '<b>Rollen-Badge</b> (Star/Stamm/Rotation/Ergänzung/Talent): automatisch aus der Stärke relativ zum Kader. Die Rolle bestimmt Gehaltsforderung und <b>Einsatzzeit-Erwartung</b> — ein fitter Star auf der Bank wird schnell unzufrieden: erst Wechselwunsch (Marktwert sinkt), notfalls Streik. <b>Drei Punkte</b> je Spieler: Moral · Form (Ø letzte Noten) · Fitness. <b>+N</b> = Entwicklung seit Saisonstart (wirkt sofort, Reset zum Saisonstart). Talente 16–20 verbessern sich jede Saison garantiert — mehr mit Spielzeit und guten Noten.' },
    vertrag: { t: 'Vertragsverhandlung', x: '<b>Gehalt</b> muss ins freie Gehaltsbudget passen. <b>Handgeld</b> (einmalig, aus dem Transferbudget) ersetzt Wochengehalt. <b>Kaderrolle</b>: unter der Erwartung des Spielers anzubieten ist fast immer ein No-Go. <b>Prämien</b> (Tor/Einsatz) senken das nötige Grundgehalt, kosten aber bei jedem Treffer/Einsatz. <b>Ausstiegsklausel</b> macht ihn zufriedener — riskiert aber den Abgang zum Fixpreis. Nach 3 zu niedrigen Angeboten sind die Gespräche beendet.' },
    kauf: { t: 'Kaufverhandlung (Verein)', x: 'Erst einigst du dich mit dem <b>Verein</b> über die Ablöse, danach mit dem <b>Spieler</b> über den Vertrag. Die Forderung hängt an Restvertrag und Wichtigkeit; <b>wechselwillige</b> Spieler sind deutlich günstiger. <b>Raten</b> schonen das Budget jetzt, zählen für den Verein aber nur ~85 %. <b>Weiterverkaufsbeteiligung</b> und <b>Erfolgs-Prämien</b> drücken die Ablöse — kosten dafür später. 3 Runden Geduld.' },
    verkauf: { t: 'Gebot verhandeln', x: 'Handle die <b>Ablöse hoch</b> oder sichere dir eine <b>Weiterverkaufsbeteiligung</b> (Anteil am späteren Weiterverkauf) bzw. <b>Erfolgs-Prämien</b>. Der Käufer hat ein Limit (~20–35 % über seinem Gebot): Er nimmt an, kontert — oder zieht nach dreimaligem Übertreiben das Gebot ganz zurück. Klauseln zahlen sich in späteren Saisons aus.' },
    scouting: { t: 'Scouting-Weltkarte', x: 'Oben optional <b>Position/Potenzial</b> wählen, dann ein Land anklicken — der freie Scout reist los (wochenbasiert). <b>Sterne</b> = Schwierigkeit: schwerere Länder kosten mehr Geld und Zeit, liefern aber besondere Talente. Gezielte Suche dauert länger. Das Scouting-Level bestimmt, wie viele Scouts du hast und wie gut die Funde sind.' },
    finanzen: { t: 'Finanzübersicht', x: '<b>Transferbudget</b> (Kaufkraft) und <b>Gehaltsbudget</b> (wöchentliche Kapazität) sind getrennt. Die Prognose rechnet Einnahmen (Tickets, Merchandise, Sponsoren, TV-Geld) gegen Gehälter und Betriebskosten bis Saisonende. Achtung auf künftige Belastungen: <b>Transfer-Raten</b> und Erfolgs-Prämien werden am Saisonstart bzw. -ende fällig.' },
    'markt-scouting': { t: 'Scouting und Markt', x: 'Je höher die Scouting-Stufe, desto stärkere und internationalere Spieler tauchen auf dem Markt auf. Ausbau unter Nachwuchs &amp; Scouting.' },
    markt: { t: 'Transfermarkt', x: '<b>Grüner/roter Punkt</b> = passt ins Budget oder nicht. <b>wechselwillig</b> = abgabebereit und günstiger. <b>★</b> merkt einen Spieler in der Watchlist, <b>⚖</b> vergleicht bis zu 3 Spieler nebeneinander. „Kaufen" startet die zweistufige Verhandlung (Verein → Spieler). Der Markt wechselt im offenen Fenster jede Woche.' }
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
  // Weitere Infokarten aus anderen Modulen (Rückmeldung 18.10. wie Kickdraft D76: Erklärsätze hinter ⓘ statt im Fließtext)
  window.infoKarteSetzen = function (key, titel, text) { if (key) INFO[key] = { t: titel, x: text }; };
  window.infoBtn = function (key) {
    return `<button class="info-btn" onclick="toggleInfoCard(event,'${key}')" title="Erklärung anzeigen" aria-label="Info"><i class="ti ti-info-circle"></i></button>`;
  };

  console.log('[InfoCards v1] aktiv — ' + Object.keys(INFO).length + ' Infokarten (ⓘ)');
})();
