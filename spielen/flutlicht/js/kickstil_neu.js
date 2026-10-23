/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · NEU & TIPPS  ·  v1   (Nutzer 2026-10-16: „Kurze Einführung neuer Funktionen“)
   ─────────────────────────────────────────────────────────────────────────
   · TIPP beim ersten Kontakt: ein Kärtchen oben mit „Verstanden“, je Funktion einmal je Gerät (localStorage „fl-tipps“).
     Kartensammlung, Joker, Vereinsblatt, Akademie, Scouting-Abteilung, erste Sonderkarte, „Spiel wiederholen“.
   · NEU-BLATT: wer mit einem bestehenden Spielstand startet, sieht einmal je Neuheiten-Stand (NEU_STAND) eine kurze Liste
     mit „Ansehen“-Knöpfen (localStorage „fl-neu“). Neue Karrieren bekommen nur die Tipps.
   Nie über Onboarding, Vorstands-Einführung, Saisonabschluss, Spielbericht oder laufendem Ticker – dann wartet der Hinweis.
   API: KSNeu.zeigen() (Neu-Blatt von Hand) · .tippsZuruecksetzen()
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const NEU_STAND = '2026-10t';   // t: Spielzeit-Entwicklung, Tabellenpfeile, Fanshop flacher, Kartenlook (2026-10-22); s: Startkader höchstens 22 (2026-10-22); r: lange Verletzungen 9–12 Monate (2026-10-22); q: Fehlerbehebung Streikwelle, Aufstellung, Verträge (2026-10-21); p: Prunk-Wappen (2026-10-19); o: neuer Name Unter Flutlicht (2026-10-19); n: Kartenpacks (2026-10-18); m: Anlagen-Bilder neu, Zeitung pausiert (2026-10-18); l: Positionen mit Seite (2026-10-18); k: Kader · Training · Spieler, Mehr-Blatt, Front Office (2026-10-18); j: Kader wie Kickdraft, Ligen, Ticker
  const KEY_TIPPS = 'fl-tipps', KEY_NEU = 'fl-neu';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const lies = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const schreib = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ohne Merker */ } };
  const hatSpiel = () => { try { return typeof CLUB !== 'undefined' && CLUB && typeof LEAGUE !== 'undefined' && LEAGUE; } catch (e) { return false; } };
  const sichtbar = el => !!(el && el.getClientRects().length && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden');
  const da = sel => sichtbar(document.querySelector(sel));

  // ── Tipps beim ersten Kontakt ──────────────────────────────────────────────
  const TIPPS = [
    { id: 'zeitmaschine', icon: 'ti-history', titel: 'Zeitmaschine', wenn: () => da('.zm-knopf'), ueberSpiel: true,
      text: 'Endspiel schiefgelaufen? Einmal je Finale kannst du die Uhr zurückdrehen und neu anpfeifen – nur direkt danach, bevor die Woche weitergeht.' },
    { id: 'karten', icon: 'ti-cards', titel: 'Kartensammlung', wenn: () => da('#ks-karten.auf'),
      text: 'Starke Spiele bringen Sonderkarten – Elf der Woche, Spieler des Monats, Halloween im Oktober und mehr. Unter „Alle Karten“ steht, wie du jede bekommst.' },
    { id: 'joker', icon: 'ti-cards', titel: 'Joker', wenn: () => da('#ks-joker.auf'),
      text: 'Joker sind freiwillig: ein kurzes Video für einen kleinen Vorteil. Stärke gibt es dafür nie – die erspielst du selbst.' },
    { id: 'akademie', icon: 'ti-school', titel: 'Akademien', wenn: () => da('#vb-blatt.auf .vb-ak-kopf'),
      text: 'Jeder Verein hat eine Akademie. Im Transferfenster kannst du Talente kaufen, wenn in deiner eigenen Akademie ein Platz frei ist.' },
    { id: 'vereinsblatt', icon: 'ti-shield', titel: 'Vereinsblatt', wenn: () => da('#vb-blatt.auf'),
      text: 'Kader, Stärke und Akademie jedes Vereins. Ohne Scout-Bericht siehst du nur Stufen – „Verein scouten“ bringt die genauen Werte.' },
    { id: 'scouting', icon: 'ti-telescope', titel: 'Scouting-Abteilung', wenn: () => da('#view-scout.active #ks-scouting'),
      text: 'Öffentlich zeigt jeder Spieler nur seine Stufe. Ein Bericht verrät Stärke, Potenzial und die Note deines Chefscouts (A+ bis F). Wähle bis zu zwei Fokus-Positionen.' },
    { id: 'trainerteam', icon: 'ti-users-group', titel: 'Trainerteam', wenn: () => da('#view-club.active #ks-trainerteam'),
      text: 'Co-Trainer und Torwarttrainer bringen deine Spieler schneller voran, der Chefscout trifft genauere Noten. Bessere Leute kosten mehr – Kandidaten gibt es zu jeder Saison neu.' },
    { id: 'laden', icon: 'ti-building-store', titel: 'Erfolge und Laden', wenn: () => da('.ld-blatt') || da('.ef-blatt'),
      text: 'Erfolge und jede Saison bringen Winpunkte – nie für Geld. Im Laden gibt es dafür ein Maskottchen fürs Gelände, Tricks, eine Pokalvitrine und einmal je Saison ein Sponsorentreffen.' },
    { id: 'ersteKarte', icon: 'ti-star', titel: 'Deine erste Sonderkarte', wenn: () => !!(window.KSKarten && KSKarten.sammlung().karten.length),
      text: 'Ein Spieler hat sich eine Sonderkarte erspielt. Seine Karte trägt jetzt diesen Rahmen – alle Karten findest du unter Mehr → Kartensammlung.' }
  ];
  function blockiert(ueberSpiel) {
    if (da('#onboarding-overlay') || da('#intro-overlay') || da('#ks-saisonende') || da('.exp-overlay') || da('.exp-gameover') || da('#ks-neu.auf')) return true;
    // Einstiegs-Test 2026-10-21: das Kärtchen lag über den Knöpfen des Deadline-Days – auch Begrüßung, Trainer-Editor und Blätter abwarten
    if (da('#ks-dl') || da('.dfl-draft-ov') || da('#kstr-gruss') || da('#kstr-ed') || da('#pcsi-blatt') || da('#pkf-einst') || da('#pkf-suche') || da('#pkf-vergleich')) return true;
    if (!ueberSpiel && (da('#pm-overlay') || document.body.classList.contains('ts-offen'))) return true;
    return false;
  }
  let TIPP_EL = null;
  function tippZeigen(t) {
    if (!TIPP_EL) {
      TIPP_EL = document.createElement('div'); TIPP_EL.id = 'ks-tipp'; TIPP_EL.setAttribute('role', 'status');
      TIPP_EL.addEventListener('click', ev => { if (ev.target.closest('[data-tipp-ok]')) TIPP_EL.classList.remove('auf'); });
      document.body.appendChild(TIPP_EL);
    }
    TIPP_EL.innerHTML = `<i class="ti ${t.icon}" aria-hidden="true"></i><div><b>Tipp · ${esc(t.titel)}</b><p>${esc(t.text)}</p></div>
      <button type="button" data-tipp-ok="1">Verstanden</button>`;
    requestAnimationFrame(() => TIPP_EL.classList.add('auf'));
  }
  function tippPruefen() {
    if (!hatSpiel() || (TIPP_EL && TIPP_EL.classList.contains('auf'))) return;
    const gesehen = lies(KEY_TIPPS, {});
    for (const t of TIPPS) {
      if (gesehen[t.id]) continue;
      let ok = false; try { ok = t.wenn(); } catch (e) { ok = false; }
      if (!ok || blockiert(t.ueberSpiel)) continue;
      gesehen[t.id] = 1; schreib(KEY_TIPPS, gesehen);
      tippZeigen(t);
      return;
    }
  }

  // ── Neu-Blatt für bestehende Spielstände ───────────────────────────────────
  const NEU = [
    { icon: 'ti-armchair', titel: 'Bank kostet', text: 'Junge Spieler ohne Einsätze verlieren Potenzial, ab 29 baut die Bank schnell ab, Spitzenspieler ab 30 verlieren Tempo – für dich und alle Gegner.' },
    { icon: 'ti-trending-up', titel: 'Spielzeit zahlt sich aus', text: 'Wer viel spielt und gut ist, kann sein Potenzial steigern; im passenden Spielstil entwickeln sich Stammspieler schneller.' },
    { icon: 'ti-list-numbers', titel: 'Tabelle mit Pfeilen', text: 'Neben dem Platz siehst du, wie viele Plätze ein Verein seit dem letzten Spieltag gewonnen oder verloren hat.' },
    { icon: 'ti-shirt-sport', titel: 'Fanshop flacher', text: 'Stufe 1 bringt mehr als bisher, jede weitere Stufe etwas weniger dazu – Stufe 10 ist das Doppelte von Stufe 1.' },
    { icon: 'ti-cards', titel: 'Sonderkarten auf dem Feld', text: 'Wer gerade eine Sonderkarte hat, trägt ihren Look in der Aufstellung – mit Vereinswappen auf der Karte.' },
    { icon: 'ti-ambulance', titel: 'Achillessehne', text: 'Ein Achillessehnenriss bedeutet 7 bis 9 Monate Pause.' },
    { icon: 'ti-school', titel: 'Talentjahrgänge', text: 'Mal ein starker, mal ein dünner Jahrgang: In starken Jahren wachsen in den Akademien doppelt so viele Juwelen heran.' },
    { icon: 'ti-users', titel: 'Schlanker Kader', text: 'Neue Karriere: Der Startkader hat höchstens 22 Spieler – die Besten je Position bleiben.' },
    { icon: 'ti-first-aid-kit', titel: 'Lange Pause', text: 'Kreuzbandriss und Syndesmosebandriss bedeuten jetzt 9 bis 12 Monate Pause.' },
    { icon: 'ti-hand-stop', titel: 'Streik mit Maß', text: 'Ein Streik drückt die Kabine nicht mehr in den Abgrund: höchstens drei Streikende gleichzeitig, nach sechs Wochen trainiert der Spieler wieder mit. Reichen die Spieler nicht, stehen Streikende notgedrungen in der Elf.' },
    { icon: 'ti-cash', titel: 'Etwas Gehaltsluft', text: 'Zum Start bleiben 8 % des Gehaltsdeckels frei, ab Saison 2 liegt der Deckel drei Punkte höher. Nach einem Abstieg schrumpft das Transferbudget schneller auf das Maß der neuen Liga.' },
    { icon: 'ti-users', titel: 'Aufstellung sauber', text: 'Verletzte und Gesperrte werden vor jedem Anpfiff ersetzt – auch beim Simulieren. Lücken schließt der Stab jede Woche. Einsätze und Noten zählen nur noch für die elf, die wirklich spielen.' },
    { icon: 'ti-file-text', titel: 'Verträge', text: 'Zum Start laufen die Verträge gleichmäßig über fünf Saisons aus. Wer nur wegen des Kader-Minimums bleibt, bekommt vom Vorstand einen Einjahresvertrag statt ewig „abgelaufen“.' },
    { icon: 'ti-shield', titel: 'Wappen mit Details', text: 'Die großen Vereine Europas und einige Traditionsvereine tragen jetzt Kronen, Sterne, Streifen, Eckfelder und ihr Gründungsjahr im Wappen.' },
    { icon: 'ti-bulb', titel: 'Unter Flutlicht', text: 'Die App heißt jetzt „Unter Flutlicht“ – mit den Spielarten Vereinskarriere und Kickdraft.' },
    { icon: 'ti-cards', titel: 'Kartenpacks', text: 'Im Laden: Erinnerungskarten an deine Spieler – Pack 3 Winpunkte, Gold-Pack 6 Winpunkte, nach jedem Saisonabschluss eins gratis. Gesammelt unter Kartensammlung → Erinnerungen.' },
    { icon: 'ti-building-stadium', titel: 'Anlagen in neuer Optik', text: 'Stadion, Trainingsgelände, Fanshop, Scouting und Nachwuchszentrum stehen jetzt mitten im Gelände – jede Ausbaustufe sichtbar.' },
    { icon: 'ti-arrows-left-right', titel: 'Positionen mit Seite', text: 'Zwölf Positionen wie in Kickdraft: LV und RV, LM und RM, LF und RF, dazu ZOM. Auf der gelernten 2. oder 3. Position −2, daneben −8, auf der anderen Seite −12. „Beste Elf“ stellt jeden auf seine Seite.' },
    { icon: 'ti-users', titel: 'Kader neu', text: 'Aufstellung zeigt den nächsten Gegner und wer fehlt – mit „Tauschen“. Spielstil und Formation direkt über dem Feld, Spieler als eine Liste mit Filtern, Training jetzt im Kader.' },
    { icon: 'ti-search', titel: 'Transfersuche', text: 'Spieler von stark nach schwach, Schnellwahl „Für deine Elf“, „Talente“, „Bezahlbar“ – oder gezielt suchen: Position, Alter, Potenzial und Preis. Ablösefreie stehen in derselben Liste.' },
    { icon: 'ti-briefcase', titel: 'Front Office', text: 'Transfer, Scouting, Verein und Finanzen unter einem Reiter.' },
    { icon: 'ti-adjustments', titel: 'Mehr aufgeräumt', text: 'Dunkelmodus und Ticker mit einem Tipp, Extras als Kacheln, alles Weitere unter „Optionen“.' },
    { icon: 'ti-target-arrow', titel: 'Taktik wie in Kickdraft', text: 'Vier Spielstile im Kreis: jeder schlägt einen anderen. Passende Formation und Spieler bringen Torchancen, nach einem Wechsel braucht die Elf Eingewöhnung. Kader → Aufstellung → Stil.' },
    { icon: 'ti-trophy', titel: 'Pokal mit allen Runden', text: 'Liga → Pokal zeigt jede Runde mit allen Ergebnissen, dazu die Auslosung der nächsten.' },
    { icon: 'ti-users', titel: 'Kader wie in Kickdraft', text: 'Aufstellung mit der Bank direkt daneben – Spieler einfach aufs Feld ziehen. Formation als Auswahl mit Mini-Feld, Verträge unter Kader → Spieler.' },
    { icon: 'ti-trophy', titel: 'Ligen aufgeräumt', text: 'Nur noch Erste bis Dritte Liga, Europa als eigener Reiter, Nationen als Power-Ranking.' },
    { icon: 'ti-arrows-exchange', titel: 'Transferticker mit Gesichtern', text: 'Jeder Wechsel mit Bild, Position, Stärke und geschätztem Potenzial. Ablösefreie Spieler haben jetzt auch Gesichter.' },
    { icon: 'ti-mail', titel: 'Postfach kurz', text: 'Höchstens drei Einträge, dazu ein Knopf zum Leeren. Bei Ereignissen siehst du, welche Spieler beteiligt sind.' },
    { icon: 'ti-scale', titel: 'Faire Welt', text: 'Die Ligen schaukeln sich nicht mehr hoch: KI-Akademien und Transfermarkt halten Maß. Aufsteiger holen gezielt erfahrene, günstige Spieler, Absteiger müssen ihre teuersten abgeben. Ab Saison 10 rüsten die Spitzenvereine klüger auf.' },
    { icon: 'ti-building-stadium', titel: 'Runde Stadien', text: 'Jeder dritte Verein spielt jetzt in einer ovalen Arena – die Form deines Stadions wählst du selbst: Verein → Stadion.' },
    { icon: 'ti-shirt-sport', titel: 'Neue Trikots', text: 'Jeder Verein hat jetzt ein eigenes Muster, das Wappen auf der Brust und ein Auswärtstrikot. Bei gleicher Farbe spielt der Gast auswärts. Verein → Trikots.' },
    { icon: 'ti-trophy', titel: 'Pokalvitrine', text: 'Jeder Titel bekommt seinen eigenen Pokal: Meisterschale, Flutlichtpokal, Champions Cup und mehr. Die gekaufte Vitrine im Office zeigt die drei wichtigsten. Mehr → Pokalvitrine.', los: () => window.KSVitrine && KSVitrine.oeffnen() },
    { icon: 'ti-history', titel: 'Zeitmaschine', text: 'Finale verloren? In Endspielen (Pokal und Europapokal) kannst du einmal die Uhr zurückdrehen und neu anpfeifen – für ein Video, mit Pro für 10 Winpunkte.' },
    { icon: 'ti-arrows-exchange', titel: 'Transfermarkt lebt', text: 'Alle Vereine in Deutschland und Europa kaufen und verkaufen ab KW 1, Woche für Woche bis zum Deadline-Day – mit Kasse, Sportdirektor, Volltreffern und Flops. Wer wechselt, bleibt mindestens ein Jahr. Transfermarkt → Welt.', los: () => window.KSMarkt && KSMarkt.oeffnen() },
    { icon: 'ti-star', titel: 'Stars 2026/27', text: 'Die Topvereine Europas haben je zehn Stars, deren Werte den echten Kadern dieser Saison nachgebildet sind – Position, Alter, Herkunft, Stärke. Die Namen sind erfunden.' },
    { icon: 'ti-flag', titel: 'Nationalteams aus echten Spielern', text: 'Rund 70 Nationen stellen ihre Elf nur aus Spielern der Spielwelt – bleiben Talente aus, wird das Team schwach. Kleine Nationen wie San Marino sind ausgedacht und nicht kaufbar. Europa → Nationalteams.' },
    { icon: 'ti-flag', titel: 'EM- und WM-Qualifikation', text: '148 Nationen spielen um EM 2028, WM 2030 und alle weiteren Turniere – deine Spieler werden berufen. Europa → Nationalteams.', los: () => { if (typeof switchAppView === 'function') switchAppView('europa', document.getElementById('nav-europa')); setTimeout(() => { const b = document.getElementById('eu-tab-laender'); if (b) b.click(); }, 60); } },
    { icon: 'ti-cards', titel: 'Sonderkarten & Kartensammlung', text: 'Elf der Woche, Spieler der Saison, Halloween, Europapokal-Helden … mit eigenem Kartenrahmen. Mehr → Kartensammlung.', los: () => window.KSKarten && KSKarten.oeffnen() },
    { icon: 'ti-trophy', titel: 'Neuer Saisonabschluss', text: 'Ergebnis, deine Besten und alle Ligen auf einen Blick – mit Spieler der Saison.' },
    { icon: 'ti-shield', titel: 'Vereinsblatt & Akademien', text: 'Tippe auf einen Verein: Kader, Stärke, Akademie. Talente fremder Akademien kannst du kaufen.' },
    { icon: 'ti-telescope', titel: 'Scouting-Abteilung', text: 'Scout-Berichte mit Chefscout-Note und Schnäppchen-Hinweisen.', los: () => { if (typeof switchAppView === 'function') switchAppView('scout', document.getElementById('nav-scout')); } },
    { icon: 'ti-users-group', titel: 'Trainerteam', text: 'Co-Trainer, Torwarttrainer und Chefscout mit Sternen – im Verein-Reiter wechseln.', los: () => { if (typeof switchAppView === 'function') switchAppView('club', document.getElementById('nav-club')); } },
    { icon: 'ti-medal', titel: 'Erfolge, Winpunkte und Laden', text: '33 Erfolge und eine Saisonwertung bringen Winpunkte. Dafür im Laden: Maskottchen auf dem Gelände, Vitrine, Pflanze.', los: () => window.KSErfolge && KSErfolge.uebersicht() },
    { icon: 'ti-trending-up', titel: 'Saison-Plus', text: '„(+1)“ neben der Stärke zeigt, was ein Spieler in dieser Saison dazugewonnen hat.' },
    { icon: 'ti-repeat', titel: 'Joker', text: 'Freiwillig für ein kurzes Video: Bau sofort, Wunderheilung, Transferspritze, Scout-Express …', los: () => window.KSJoker && KSJoker.oeffnen() },
    { icon: 'ti-cards', titel: 'Kartensammlung', text: 'Die Karten sitzen in der Sammlung jetzt mittig und passen auch auf schmale Handys; auf der Derby-Karte sind die Werte besser lesbar.' }
  ];
  let NEU_EL = null;
  function zeigen() {
    if (!NEU_EL) {
      NEU_EL = document.createElement('div'); NEU_EL.id = 'ks-neu';
      NEU_EL.addEventListener('click', ev => {
        const a = ev.target.closest('[data-neu]');
        if (a) { NEU_EL.classList.remove('auf'); const n = NEU[+a.getAttribute('data-neu')]; try { if (n && n.los) n.los(); } catch (e) { /* Ansicht optional */ } return; }
        if (ev.target.closest('.ksn-bg') || ev.target.closest('[data-neu-zu]')) NEU_EL.classList.remove('auf');
      });
      document.body.appendChild(NEU_EL);
    }
    NEU_EL.innerHTML = `<div class="ksn-bg"></div><div class="ksn-box" role="dialog" aria-modal="true" aria-label="Neu in der Vereinskarriere">
      <div class="ksn-kopf"><i class="ti ti-sparkles" aria-hidden="true"></i><b>Neu in der Vereinskarriere</b></div>
      ${NEU.map((n, i) => `<div class="ksn-zeile"><i class="ti ${n.icon}" aria-hidden="true"></i><span><b>${esc(n.titel)}</b><small>${esc(n.text)}</small></span>
        ${n.los ? `<button type="button" class="ksn-an" data-neu="${i}">Ansehen</button>` : ''}</div>`).join('')}
      <button type="button" class="ksn-los" data-neu-zu="1">Los geht's</button></div>`;
    requestAnimationFrame(() => NEU_EL.classList.add('auf'));
    schreib(KEY_NEU, NEU_STAND);
  }
  // Bestehender Spieler = beim Start liegt schon ein Spielstand im Gerät (initGame lädt ihn vor diesem Modul an)
  let geladen = false;
  try { for (let i = 0; i < localStorage.length; i++) if (/fcm-save-.+-league$/.test(localStorage.key(i) || '')) { geladen = true; break; } } catch (e) { /* ohne */ }
  if (typeof window.startNewGameState === 'function') {
    const _n = window.startNewGameState;
    window.startNewGameState = function () { schreib(KEY_NEU, NEU_STAND); geladen = false; return _n.apply(this, arguments); };
    try { startNewGameState = window.startNewGameState; } catch (e) { /* window reicht */ }
  }
  function neuPruefen() {
    if (!geladen || !hatSpiel() || lies(KEY_NEU, null) === NEU_STAND) return;
    if (blockiert(false) || da('#ks-tipp.auf') || !da('#view-home.active')) return;
    geladen = false;
    zeigen();
  }

  // Ein schon offenes Kärtchen weicht aus, solange ein Fenster darüber liegen müsste (Deadline-Day u. a.), und kommt danach wieder
  function tippAusweichen() { if (TIPP_EL) TIPP_EL.style.visibility = blockiert(true) ? 'hidden' : ''; }
  setInterval(() => { try { neuPruefen(); tippPruefen(); tippAusweichen(); } catch (e) { /* Hinweise optional */ } }, 1200);

  const css = document.createElement('style');
  css.textContent = `#ks-tipp{position:fixed;left:12px;right:12px;top:calc(10px + env(safe-area-inset-top,0px));z-index:13000;max-width:520px;margin:0 auto;
    display:flex;gap:12px;align-items:flex-start;padding:12px 14px;border-radius:16px;background:var(--bg2,#fffaf0);color:var(--text,#2b2a26);
    border:3px solid var(--k-gold,#f2c14e);box-shadow:0 10px 30px rgb(0 0 0/.35);transform:translateY(-140%);transition:transform .28s cubic-bezier(.2,.8,.3,1);
    font-family:var(--font-text,system-ui)}
  #ks-tipp.auf{transform:none}html.dark #ks-tipp{background:var(--bg2,#1e2230)}
  #ks-tipp>i{font-size:26px;color:var(--k-gold-tief,#c9962a);margin-top:2px}#ks-tipp>div{flex:1;min-width:0}
  #ks-tipp b{font:700 15px/1.2 var(--font-titel,Fredoka,system-ui)}#ks-tipp p{margin:4px 0 0;font-size:13px;line-height:1.35;color:var(--text2,#5a4a36)}
  #ks-tipp button{align-self:center;border:0;border-radius:10px;padding:9px 12px;font:700 13px/1 var(--font-titel,system-ui);cursor:pointer;color:#fff;
    background:var(--k-gruen,#25c065);box-shadow:0 3px 0 var(--k-gruen-tief,#188a46)}
  #ks-neu{position:fixed;inset:0;z-index:9800;pointer-events:none}#ks-neu.auf{pointer-events:auto}
  .ksn-bg{position:absolute;inset:0;background:rgb(6 6 5/.62);opacity:0;transition:opacity .18s}#ks-neu.auf .ksn-bg{opacity:1}
  .ksn-box{position:absolute;left:0;right:0;bottom:0;margin:0 auto;max-width:560px;max-height:88vh;overflow-y:auto;background:var(--bg2,#fffaf0);
    color:var(--text,#2b2a26);border-radius:22px 22px 0 0;border:3px solid var(--k-rahmen,#8b5a2b);border-bottom:0;
    padding:14px 14px calc(18px + env(safe-area-inset-bottom,0px));transform:translateY(100%);transition:transform .24s cubic-bezier(.2,.8,.3,1);font-family:var(--font-text,system-ui)}
  #ks-neu.auf .ksn-box{transform:none}html.dark .ksn-box{background:var(--bg2,#1e2230)}
  .ksn-kopf{display:flex;align-items:center;gap:8px;margin-bottom:10px}.ksn-kopf i{font-size:24px;color:var(--k-gold-tief,#c9962a)}
  .ksn-kopf b{font:700 22px/1.1 var(--font-titel,Fredoka,system-ui)}
  .ksn-zeile{display:flex;align-items:center;gap:12px;padding:10px;border-radius:14px;border:2px solid var(--k-rand,#d9c29a);margin-bottom:8px}
  .ksn-zeile>i{font-size:24px;color:var(--k-blau,#2c7cb5)}.ksn-zeile>span{flex:1;min-width:0;display:flex;flex-direction:column}
  .ksn-zeile small{color:var(--text3,#846d52);font-size:12px;margin-top:2px;line-height:1.3}
  .ksn-an{border:2px solid var(--k-rand,#d9c29a);background:transparent;color:inherit;border-radius:10px;padding:7px 10px;font:700 12px/1 var(--font-titel,system-ui);cursor:pointer}
  .ksn-los{display:block;width:100%;margin-top:6px;border:0;border-radius:14px;padding:13px;font:700 16px/1 var(--font-titel,system-ui);cursor:pointer;color:#fff;
    background:var(--k-gruen,#25c065);box-shadow:0 4px 0 var(--k-gruen-tief,#188a46)}`;
  document.head.appendChild(css);

  window.KSNeu = { zeigen, tippsZuruecksetzen: () => schreib(KEY_TIPPS, {}), TIPPS, NEU };
  console.log('[Kickstil-Neu v1] aktiv — Tipps beim ersten Kontakt, Neu-Blatt für bestehende Spielstände');
})();
