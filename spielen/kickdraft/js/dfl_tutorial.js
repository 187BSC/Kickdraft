/* =====================================================================
   DFL: Erster Tag (Tutorial) + Lite mit Freischalten (D131, Nutzer 2026-10-13)
   Nutzer: „bauen wir ein Briefing und ersten Tag ein. Eine Art Tutorial und alles wird kurz gezeigt und erklärt“,
   „Die Lite Variante freischalten gerne und dann nach jedem auch ein kleiner Text“, „im Dialog-Format, der Eigentümer erzählt
   was zur Vergangenheit des Vereins … und der Scout kann dann alles zum Thema Draft und Trading sagen“.
   • Neue Karriere: statt der alten Vorstandseinführung (intro_patch.js) kommt die Wahl Lite/Voll, danach die Tour im Office:
     Abdunkelung mit Ausschnitt um den gezeigten Bereich, Sprechblase mit Gesicht. Der Eigentümer erzählt die Vereinsgeschichte
     (data/dfl_geschichten.js, Entwurf docs/vereinsgeschichten.md), der Chefscout erklärt Kader, Cap, Front Office (Draft,
     Free Agency, Trades) und den Haupt-Knopf. Überspringen jederzeit; Mehr → „Erster Tag“ zeigt die Tour noch einmal.
   • Lite: Free Agency und Trades sind ab Tag 1 offen. Anlagen, Tickets und Sponsoren kommen in Saison 2, das Trainerteam in
     Saison 3 – bis dahin entscheidet der Stab (Sponsoren: solides Angebot; Preise: Standard; Trainerteam bleibt). Jede
     Freischaltung kommt mit einer kleinen Karte („Zeig mir's“ führt hin). Im Mehr-Menü umschaltbar (Voll schaltet alles frei).
   • Tests (navigator.webdriver) spielen ohne Tour im Modus Voll, außer localStorage „dfl-tutorial-test“ = „an“.
   Zustand: CLUB.dflTutorial = { modus: 'lite'|'voll', tour: true|false, gezeigt: { schluessel: saison } }
   • Lite-Stab (D137, 2026-10-14): solange das Trainerteam gesperrt ist, verlängert der Stab auslaufende Verträge (Saisonende der Welt)
     und besetzt freie Stellen (nach dem Draft, Winterpause, wöchentlich) wie die KI; Meldung als Hinweis + Postfach.
   API: DFLTutorial = { start(), tour(), modus(), lite(), gesperrt(schluessel), freischaltenPruefen(), stabPruefen(), stabZustaendig() }
   ===================================================================== */
(function () {
  'use strict';
  const GESCHICHTEN = window.DFL_GESCHICHTEN || {};
  const dfl = () => typeof CLUB !== 'undefined' && CLUB && CLUB.dfl && CLUB.dfl.aktiv;
  const saison = () => (typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.season) || 1;
  const testlauf = () => {
    let an = false;
    try { an = localStorage.getItem('dfl-tutorial-test') === 'an'; } catch (e) { an = false; }
    return !!navigator.webdriver && !an;
  };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  function zustand() {
    if (!dfl()) return null;
    if (!CLUB.dflTutorial) CLUB.dflTutorial = { modus: 'voll', tour: true, gezeigt: {} };     // alte Spielstände: Voll, keine Tour
    if (!CLUB.dflTutorial.gezeigt) CLUB.dflTutorial.gezeigt = {};
    return CLUB.dflTutorial;
  }
  const modus = () => { const z = zustand(); return z ? z.modus : 'voll'; };
  const lite = () => modus() === 'lite';
  const speichern = () => { try { if (typeof saveGameState === 'function') saveGameState(); } catch (e) { /* Tests */ } };

  // ── Was in Lite später kommt ───────────────────────────────────────────────
  const FREI = [
    { key: 'verein', ab: 2, icon: 'ti-building-stadium', titel: 'Anlagen, Tickets und Sponsoren',
      text: 'Ab jetzt entscheidest du, was gebaut wird, was Tickets kosten und wer auf dein Trikot kommt. Training macht Spieler besser, der Fanshop bringt Geld, alles kostet Unterhalt.',
      hin: () => { if (window.DFLAppShell) DFLAppShell.zeige('club'); } },
    { key: 'trainer', ab: 3, icon: 'ti-users-group', titel: 'Trainerteam',
      text: 'Du stellst jetzt selbst Co-Trainer, Torwart-, Fitness- und Standardtrainer ein. Gute Trainer entwickeln Spieler schneller, kosten aber Gehalt.',
      hin: () => { if (window.DFLTrainerteam) DFLTrainerteam.blatt(); } },
    // Tipp für alle Modi (Nutzer 2026-10-14: „das konzept von development squad und mentoren muss auch ins tutorial … im 2. oder 3. jahr“)
    { key: 'squad', ab: 2, tipp: true, icon: 'ti-school', titel: 'Development Squad und Mentoren',
      text: 'Bis zu sechs junge Spieler bis 21 trainieren im Development Squad. Sie spielen nicht, werden aber durch das Training besser. Gib ihnen einen Mentor ab 28 aus demselben Mannschaftsteil, dann geht es noch schneller.',
      hin: () => { if (window.DFLAppShell) DFLAppShell.zeige('training'); } }
  ];
  const sperre = key => FREI.find(f => f.key === key);
  function gesperrt(key) {
    const f = sperre(key);
    return !!(f && !f.tipp && dfl() && lite() && saison() < f.ab);
  }
  const abText = f => `Kommt in Saison ${f.ab}. Bis dahin kümmert sich der Stab darum.`;

  // ── Oberfläche: Fenster, Tour, Karten ──────────────────────────────────────
  function fenster(html, klasse) {
    const ov = document.createElement('div');
    ov.className = 'tut-ov' + (klasse ? ' ' + klasse : '');
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = html;
    document.body.appendChild(ov);
    return ov;
  }
  function gesicht(kurz, farbe) { return `<span class="tut-gesicht" style="--g:${farbe}">${esc(kurz)}</span>`; }
  const kuerzel = name => String(name || '').split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();

  // opt.nurModus (Mehr → Spielmodus, Spieltest 2026-10-14): nur den Modus wechseln, ohne Tour (die Tour gibt es unter „Erster Tag“)
  function wahl(weiter, opt) {
    const z = zustand(); if (!z) return;
    const nurModus = !!(opt && opt.nurModus);
    let gewaehlt = nurModus ? z.modus : 'lite';
    const knoepfe = nurModus
      ? '<button type="button" class="tut-knopf zweit" data-w="ab">Abbrechen</button><button type="button" class="tut-knopf" data-w="ok">Übernehmen</button>'
      : '<button type="button" class="tut-knopf zweit" data-w="ohne">Ohne Tour</button><button type="button" class="tut-knopf" data-w="los">Los geht\'s</button>';
    const ov = fenster(`<div class="tut-blatt">
      <h2 class="tut-titel">${nurModus ? 'Spielmodus' : 'Wie willst du spielen?'}</h2>
      <button type="button" class="tut-wahl${gewaehlt === 'lite' ? ' an' : ''}" data-m="lite"><b>Lite</b><span>Der Stab kümmert sich um Anlagen, Tickets, Sponsoren und das Trainerteam. Neue Bereiche kommen nach und nach dazu.</span></button>
      <button type="button" class="tut-wahl${gewaehlt === 'voll' ? ' an' : ''}" data-m="voll"><b>Voll</b><span>Alles ist von Anfang an offen. Für alle, die jedes Detail selbst entscheiden wollen.</span></button>
      <div class="tut-knoepfe">${knoepfe}</div>
    </div>`);
    ov.querySelectorAll('[data-m]').forEach(b => b.onclick = () => {
      gewaehlt = b.dataset.m;
      ov.querySelectorAll('[data-m]').forEach(x => x.classList.toggle('an', x === b));
    });
    if (nurModus) {
      ov.querySelector('[data-w="ab"]').onclick = () => ov.remove();
      ov.querySelector('[data-w="ok"]').onclick = () => {
        const neu = z.modus !== gewaehlt;
        z.modus = gewaehlt; ov.remove(); speichern();
        if (neu) {
          ['renderClubTab', 'renderHomeTab'].forEach(f => { if (typeof window[f] === 'function') { try { window[f](); } catch (e) { /* Ansicht fehlt */ } } });
          if (typeof showToast === 'function') showToast('Spielmodus: ' + (gewaehlt === 'lite' ? 'Lite' : 'Voll'));
        }
        if (weiter) weiter();
      };
      return;
    }
    const ende = mitTour => { z.modus = gewaehlt; ov.remove(); speichern(); if (mitTour) tour(); else { z.tour = true; weiter && weiter(); } };
    ov.querySelector('[data-w="los"]').onclick = () => ende(true);
    ov.querySelector('[data-w="ohne"]').onclick = () => ende(false);
  }

  function personen() {
    const f = window.DFLSpiel ? DFLSpiel.franchise('fcm') : null;
    const g = (f && GESCHICHTEN[f.id]) || null;
    const eig = g ? g.eigentuemer : 'Die Eigentümerin';
    let scout = null;
    try { scout = window.DFLChefscout && DFLChefscout.person(); } catch (e) { scout = null; }
    const scoutName = scout ? [scout.firstName || scout.vorname || '', scout.name || ''].join(' ').trim() : '';
    return { f, g, eig, scoutName: scoutName || 'Dein Chefscout' };
  }
  const kachelMit = text => [...document.querySelectorAll('#app-office-kopf .ok-kachel')].find(k => text.test(k.textContent || ''));
  function schritte() {
    const P = personen(), d = (P.g && P.g.dialog) || [];
    const E = { wer: P.eig, typ: P.g ? P.g.typ : '', kurz: kuerzel(P.eig), farbe: '#e9c29b' };
    const S = { wer: P.scoutName, typ: 'Chefscout', kurz: kuerzel(P.scoutName) || 'CS', farbe: '#bcd7f0' };
    const L = [];
    L.push(Object.assign({ ziel: () => document.getElementById('app-gelaende'), text: d[0] || `Willkommen bei den ${P.f ? P.f.name : 'Titans'}.` }, E));
    if (d[1]) L.push(Object.assign({ ziel: () => document.getElementById('app-gelaende'), text: d[1] }, E));
    L.push(Object.assign({ ziel: () => kachelMit(/Kader/), text: 'Das ist dein Kader. Höchstens 28 Spieler, 21 müssen es in der Saison mindestens sein. Antippen zeigt Aufstellung und Verträge.' }, S));
    L.push(Object.assign({ ziel: () => kachelMit(/Cap ·/), text: 'Alle Gehälter zusammen dürfen 120 Mio nicht übersteigen. Wer einen Spieler entlässt, zahlt das restliche Handgeld trotzdem, das ist Dead Cap.' }, S));
    L.push(Object.assign({ ziel: () => document.querySelector('#app-nav [data-nav="fo"]'), text: 'Im Front Office liegen Draft, Free Agency und Trades. Die besten freien Spieler sind in den ersten zwei Wochen weg, da musst du schnell sein.' }, S));
    L.push(Object.assign({ ziel: () => document.querySelector('#app-nav [data-nav="fo"]'), text: 'Talente gibt es nur über den Draft. Ich bereite dir vor jedem Draft eine Liste vor. Trades gehen das ganze Jahr bis zur Deadline, Picks kann man mittauschen.' }, S));
    L.push(Object.assign({ ziel: () => document.getElementById('app-cta'), text: 'Mit diesem Knopf geht es immer zum nächsten Schritt: Woche weiter, zum Spiel, zum Draft.' }, S));
    if (d[2]) L.push(Object.assign({ ziel: () => document.getElementById('app-gelaende'), text: d[2] }, E));
    return L;
  }
  function tour(fertig) {
    const z = zustand(); if (!z) return;
    if (window.DFLAppShell) try { DFLAppShell.zeige('home'); } catch (e) { /* Office fehlt */ }
    const L = schritte();
    let i = 0;
    const ov = fenster('<div class="tut-loch"></div><div class="tut-blase" aria-live="polite"></div>', 'tut-tour');
    const loch = ov.querySelector('.tut-loch'), blase = ov.querySelector('.tut-blase');
    // D159 (a): nach der ersten Tour (Lite, Saison 1 vor Spieltag 1) beginnen die Tutorial-Missionen (dfl_missionen.js)
    const ende = () => { ov.remove(); z.tour = true; speichern(); window.removeEventListener('resize', male);
      try { if (window.DFLMissionen && DFLMissionen.nachTour) DFLMissionen.nachTour(); } catch (e) { console.warn('[DFL-Tutorial] Missionen', e); }
      if (fertig) fertig(); };
    function male() {
      const s = L[i], el = s.ziel && s.ziel();
      if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center', behavior: 'instant' });
      const r = el ? el.getBoundingClientRect() : null;
      if (r && r.width) {
        Object.assign(loch.style, { display: 'block', left: (r.left - 6) + 'px', top: (r.top - 6) + 'px', width: (r.width + 12) + 'px', height: (r.height + 12) + 'px' });
      } else loch.style.display = 'none';
      blase.innerHTML = `<div class="tut-wer">${gesicht(s.kurz, s.farbe)}<span><b>${esc(s.wer)}</b>${s.typ ? `<small>${esc(s.typ)}</small>` : ''}</span></div>
        <p>${esc(s.text)}</p>
        <div class="tut-unten"><span class="tut-punkte">${L.map((_, k) => `<i class="${k === i ? 'an' : ''}"></i>`).join('')}</span>
        <span><button type="button" class="tut-knopf leer" data-t="skip">Überspringen</button><button type="button" class="tut-knopf" data-t="weiter">${i === L.length - 1 ? 'Los geht\'s' : 'Weiter'}</button></span></div>`;
      const h = window.innerHeight, oben = r && r.top + r.height / 2 > h * 0.55;
      blase.style.top = oben ? Math.max(12, (r ? r.top : h) - blase.offsetHeight - 18) + 'px' : Math.min(h - blase.offsetHeight - 12, (r ? r.bottom : 80) + 18) + 'px';
      blase.querySelector('[data-t="weiter"]').onclick = () => { if (i < L.length - 1) { i++; male(); } else ende(); };
      blase.querySelector('[data-t="skip"]').onclick = ende;
    }
    window.addEventListener('resize', male);
    male();
  }

  // Karte „Neu freigeschaltet“
  function karte(f) {
    const ov = fenster(`<div class="tut-blatt">
      <span class="tut-chip">${f.tipp ? 'Tipp' : 'Neu freigeschaltet'} · Saison ${f.ab}</span>
      <div class="tut-neu"><span class="tut-ic"><i class="ti ${f.icon}" aria-hidden="true"></i></span><div><h2 class="tut-titel">${esc(f.titel)}</h2><p>${esc(f.text)}</p></div></div>
      <div class="tut-knoepfe"><button type="button" class="tut-knopf zweit" data-k="spaeter">Später</button><button type="button" class="tut-knopf" data-k="zeig">Zeig mir's</button></div>
    </div>`);
    ov.querySelector('[data-k="spaeter"]').onclick = () => ov.remove();
    ov.querySelector('[data-k="zeig"]').onclick = () => { ov.remove(); try { f.hin(); } catch (e) { /* Ziel fehlt */ } };
  }
  const sichtbar = el => !!el && el.isConnected && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden' && el.offsetWidth > 0;
  function andereOffen() {
    if ([...document.querySelectorAll('#app-sheet.auf, #app-blatt.auf')].some(sichtbar)) return true;
    return [...document.body.children].some(e => !/^(app-cta|app-nav|app-hinweis|toast-host)$/.test(e.id) && !/^app-(sheet|blatt)$/.test(e.id)
      && e.offsetWidth > 200 && e.offsetHeight > 200 && getComputedStyle(e).position === 'fixed' && getComputedStyle(e).display !== 'none'
      && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).pointerEvents !== 'none');
  }
  function freischaltenPruefen() {
    try {
      const z = zustand(); if (!z || !z.tour) return;
      if (window.DFLSimulieren && typeof DFLSimulieren.laeuft === 'function' && DFLSimulieren.laeuft()) return;
      const f = FREI.find(x => (x.tipp || z.modus === 'lite') && saison() >= x.ab && !z.gezeigt[x.key]);
      if (!f || andereOffen()) return;
      z.gezeigt[f.key] = saison(); speichern();
      karte(f);
    } catch (e) { console.warn('[DFL-Tutorial] Freischalten', e); }
  }

  // ── Sperren in Lite ────────────────────────────────────────────────────────
  function sperrKarte(el, f) {
    if (!el) return;
    if (!gesperrt(f.key)) { el.removeAttribute('data-lite-zu'); const k = el.querySelector(':scope > .lite-sperre'); if (k) k.remove(); return; }
    el.setAttribute('data-lite-zu', '1');
    if (!el.querySelector(':scope > .lite-sperre')) el.insertAdjacentHTML('afterbegin',
      `<div class="lite-sperre"><i class="ti ti-lock" aria-hidden="true"></i><div><b>${esc(f.titel)}</b><span>${esc(abText(f))}</span></div></div>`);
  }
  function vereinSperren() {
    const f = sperre('verein');
    sperrKarte(document.getElementById('club-facilities'), f);
    document.querySelectorAll('#view-club .sponsor-section').forEach(el => sperrKarte(el, f));
  }
  {
    const _orig = window.renderClubTab;
    if (typeof _orig === 'function') {
      window.renderClubTab = function () { const r = _orig.apply(this, arguments); try { if (dfl()) vereinSperren(); } catch (e) { console.warn('[DFL-Tutorial] Verein', e); } return r; };
      try { renderClubTab = window.renderClubTab; } catch (e) { /* window reicht */ }
    }
  }
  function hinweis(f) { if (typeof showToast === 'function') showToast(abText(f)); else alert(abText(f)); }
  if (window.DFLTrainerteam && typeof DFLTrainerteam.blatt === 'function') {
    const _orig = DFLTrainerteam.blatt;
    DFLTrainerteam.blatt = function () { if (gesperrt('trainer')) { hinweis(sperre('trainer')); return; } return _orig.apply(this, arguments); };
  }
  if (window.DFLTickets && typeof DFLTickets.blatt === 'function') {
    const _orig = DFLTickets.blatt;
    DFLTickets.blatt = function () { if (gesperrt('verein')) { hinweis(sperre('verein')); return; } return _orig.apply(this, arguments); };
  }
  // Front Office → Anlagen (Sanieren) gehört zu „Anlagen, Tickets und Sponsoren“ (Spieltest 2026-10-14: in Lite Saison 1 offen)
  if (window.DFLAnlagen && typeof DFLAnlagen.blatt === 'function') {
    const _orig = DFLAnlagen.blatt;
    DFLAnlagen.blatt = function () { if (gesperrt('verein')) { hinweis(sperre('verein')); return; } return _orig.apply(this, arguments); };
  }

  // ── Lite: der Stab hält das Trainerteam zusammen (D137) ────────────────────
  // Nutzer 2026-10-14: „Ja Stab mit Lite Version der verlängert sich selbst ist gut.“ Bis Saison 3 liefen sonst Standardtrainer,
  // Co-Trainer und Physio aus, ohne dass man verlängern konnte – bei der Freischaltung waren 3 von 4 Plätzen leer.
  // Solange das Trainerteam in Lite gesperrt ist (bis die Freischalt-Karte kam), verlängert der Stab auslaufende Verträge wie die KI
  // (1–3 Jahre, Gehalt nach Sternen über DFLTrainer.vertragGeben/gehaltFuer) und besetzt freie Stellen (Rente, Abwerbung) wie
  // DFLTrainer.kiBesetzen: Sterne nach dem Profil des Eigentümers (zielSterne), bester Kandidat bis zu diesen Sternen.
  const Tr = window.DFLTrainer, TT = window.DFLTrainerteam;
  const D = window.DFLSpiel;
  function stabZustaendig() {
    const f = sperre('trainer'), z = zustand();
    if (!f || !z || z.modus !== 'lite' || !Tr || !TT) return false;
    const s = saison();
    return s < f.ab || (s === f.ab && !(z.gezeigt && z.gezeigt[f.key]));      // Saisonwechsel vor der Freischaltung gehört noch dazu
  }
  const stabTeam = () => { try { const L = TT.welt(); return L ? { L, t: L.teams.find(x => x.id === D.eigeneDflId()) } : null; } catch (e) { return null; } };
  const rolleName = r => (Tr.ROLLE[r] || { name: r }).name;
  const geldText = x => (typeof formatEuro === 'function' ? formatEuro(x) : Math.round(x) + ' €');
  // Vor dem Saisonende der Welt vormerken (Vertrag läuft bis zur neuen Saison, sonst geht er in saisonEnde zum Markt), danach wie die
  // KI verlängern – nach Entwicklung und Rente, Gehalt nach den Sternen von dann (DFLTrainer.saisonEnde: vertragGeben nach entwickeln)
  function stabVormerken(L, t) {
    const aus = [];
    Tr.CFG.rollen.forEach(rolle => {
      const p = t.trainer && t.trainer[rolle];
      if (!p || p.bis == null || p.bis >= (L.saisonJahr || 0)) return;
      aus.push({ p, rolle, bis: p.bis });
      p.bis = L.saisonJahr || 0;
    });
    return aus;
  }
  function stabVerlaengern(L, t, vorgemerkt) {
    const r = Tr.rngVon(L, 'lite-stab-verlaengern'), aus = [];
    vorgemerkt.forEach(x => {
      if (!t.trainer || t.trainer[x.rolle] !== x.p) return;              // in Rente gegangen: die Stelle besetzt stabBesetzen
      Tr.vertragGeben(L, x.p, Tr.CFG.vertrag[0] + Math.floor(r() * (Tr.CFG.vertrag[1] - Tr.CFG.vertrag[0] + 1)));
      aus.push(x);
    });
    return aus;
  }
  function stabBesetzen(L, t) {
    const r = Tr.rngVon(L, 'lite-stab-besetzen-' + (LEAGUE.week || 0)), aus = [];
    const profil = CLUB.dfl && CLUB.dfl.eigner && CLUB.dfl.eigner.profil;
    t.trainer = t.trainer || {};
    Tr.CFG.rollen.forEach(rolle => {
      if (t.trainer[rolle]) return;
      const wunsch = Math.max(1, Math.min(5, Math.round(Tr.zielSterne(t, { profil }) + (r() - 0.5) * 2 * Tr.CFG.streuung)));
      const liste = Tr.kandidaten(L, rolle).filter(p => p.sterne <= wunsch);
      const p = liste.length ? liste[0] : Tr.neuePerson(L, r, rolle, wunsch);
      Tr.einstellen(L, t, p, Tr.CFG.vertrag[0] + Math.floor(r() * (Tr.CFG.vertrag[1] - Tr.CFG.vertrag[0] + 1)));
      aus.push({ p, rolle });
    });
    return aus;
  }
  // Meldung im Stil der Stab-Sponsoren (dfl_sponsoren_patch.js stabAlle): ein Hinweis, dazu eine Zeile im Postfach
  function stabMelden(verl, neu) {
    if (!verl.length && !neu.length) return;
    const zeile = x => `${Tr.voll(x.p)} (${rolleName(x.rolle)}, bis ${x.p.bis}, ${geldText(x.p.gehalt)} je Saison)`;
    if (typeof addNews === 'function') {
      if (verl.length) addNews('club', 'Der Stab hat verlängert', verl.map(zeile).join(' · ') + '.');
      if (neu.length) addNews('club', 'Der Stab hat eingestellt', neu.map(zeile).join(' · ') + '.');
    }
    const teile = [];
    if (verl.length) teile.push('Der Stab hat verlängert: ' + verl.map(x => `${Tr.voll(x.p)} (${rolleName(x.rolle)})`).join(', '));
    if (neu.length) teile.push('Der Stab hat eingestellt: ' + neu.map(x => `${Tr.voll(x.p)} (${rolleName(x.rolle)})`).join(', '));
    if (typeof showToast === 'function') showToast(teile.join('. '));
  }
  function stabPruefen() {
    try {
      if (!dfl() || !stabZustaendig()) return null;
      const w = stabTeam(); if (!w || !w.t) return null;
      const neu = stabBesetzen(w.L, w.t);
      stabMelden([], neu);
      return { neu };
    } catch (e) { console.warn('[DFL-Tutorial] Stab', e); return null; }
  }
  if (Tr && TT) {
    // Saisonende der Welt (phaseAbschluss): vorher verlängern, danach freie Stellen (Rente) besetzen
    const _ende = Tr.saisonEnde;
    Tr.saisonEnde = function (L) {
      let vor = [];
      const zust = (() => { try { return dfl() && stabZustaendig(); } catch (e) { return false; } })();
      const eigen = () => (L && L.teams ? L.teams.find(x => x.id === D.eigeneDflId()) : null);
      if (zust) { try { const t = eigen(); if (t) vor = stabVormerken(L, t); } catch (e) { console.warn('[DFL-Tutorial] Stab', e); } }
      const st = _ende.apply(this, arguments);
      if (zust) { try { const t = eigen(); if (t) { const verl = stabVerlaengern(L, t, vor); stabMelden(verl, stabBesetzen(L, t)); } } catch (e) { console.warn('[DFL-Tutorial] Stab', e); } }
      return st;
    };
    // Markt nach dem Draft und in der Winterpause (Abwerbung): danach freie Stellen besetzen
    ['nachDraft', 'winter'].forEach(k => {
      const _orig = Tr[k];
      Tr[k] = function () { const r = _orig.apply(this, arguments); stabPruefen(); return r; };
    });
    // Wöchentlich (und für Spielstände, in denen schon Stellen frei sind): freie Stellen besetzen
    const _woche = window.advanceCalendarWeek;
    if (typeof _woche === 'function') {
      window.advanceCalendarWeek = function () { const r = _woche.apply(this, arguments); stabPruefen(); return r; };
      try { advanceCalendarWeek = window.advanceCalendarWeek; } catch (e) { /* window reicht */ }
    }
    stabPruefen();
  }

  // ── Einstieg ───────────────────────────────────────────────────────────────
  function start() {
    const z = zustand(); if (!z) return false;
    if (testlauf()) { z.modus = 'voll'; z.tour = true; return false; }
    z.tour = false;
    // Das Sponsorfenster (dfl_sponsoren_patch.js, Prüfung alle 2 s) kann vor der Wahl schon offen sein – im Modus „Voll“ von
    // vorhin, auch in Lite, und lag dann unter Wahl und Tour (Spieltest 2026-10-14). Schließen: nach der Tour öffnet es neu bzw. der Stab unterschreibt.
    document.querySelectorAll('.spo-ov').forEach(o => o.remove());
    wahl();
    return true;
  }
  {
    const _orig = window.renderHomeTab;
    if (typeof _orig === 'function') {
      window.renderHomeTab = function () { const r = _orig.apply(this, arguments); setTimeout(freischaltenPruefen, 800); return r; };
      try { renderHomeTab = window.renderHomeTab; } catch (e) { /* window reicht */ }
    }
  }
  setInterval(freischaltenPruefen, 2500);
  // Mehr → „Kurz erklärt“ zeigt die Tour (app_shell ruft window.zeigeVorstandsEinfuehrung)
  window.zeigeVorstandsEinfuehrung = () => { if (dfl()) tour(); };

  const css = document.createElement('style');
  css.id = 'dfl-tutorial-css';
  css.textContent = `.tut-ov{position:fixed;inset:0;z-index:9400;background:rgba(20,14,8,.55);display:flex;align-items:flex-end;justify-content:center}
.tut-ov.tut-tour{background:transparent;display:block}
.tut-loch{position:fixed;border-radius:16px;box-shadow:0 0 0 3000px rgba(20,14,8,.62);outline:3px solid var(--k-gold,#e0a526);transition:all .3s ease;pointer-events:none}
.tut-blase{position:fixed;left:12px;right:12px;max-width:520px;margin:0 auto;background:var(--bg2,#fffdf9);color:var(--text,#2c3e50);border:2px solid var(--k-rand,#8b5a2b);
  border-radius:16px;box-shadow:0 4px 0 var(--k-rand,#8b5a2b);padding:12px 14px;display:flex;flex-direction:column;gap:8px;transition:top .3s ease}
.tut-blase p{margin:0;font-size:15px;line-height:1.45}
.tut-wer{display:flex;align-items:center;gap:10px}
.tut-wer b{display:block;font-size:14px}.tut-wer small{display:block;font-size:12px;color:var(--text3,#846d52)}
.tut-gesicht{flex:none;width:36px;height:36px;border-radius:50%;background:var(--g);border:2px solid var(--k-rand,#8b5a2b);display:grid;place-items:center;font-weight:700;font-size:13px;color:#3b2a1d}
.tut-unten{display:flex;justify-content:space-between;align-items:center;gap:8px}
.tut-punkte{display:flex;gap:4px}.tut-punkte i{width:7px;height:7px;border-radius:50%;background:var(--k-linie,#e3c99a)}.tut-punkte i.an{background:var(--k-gold,#e0a526)}
.tut-blatt{background:var(--bg2,#fffdf9);color:var(--text,#2c3e50);border-top:3px solid var(--k-rand,#8b5a2b);border-radius:22px 22px 0 0;width:100%;max-width:520px;
  padding:16px 16px calc(18px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;gap:12px}
.tut-titel{margin:0;font-size:20px}
.tut-wahl{font:inherit;text-align:left;cursor:pointer;border:2px solid var(--k-linie,#e3c99a);border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:4px;background:transparent;color:inherit}
.tut-wahl b{font-size:16px}.tut-wahl span{font-size:13px;color:var(--text3,#846d52)}
.tut-wahl.an{border-color:var(--k-gruen,#78bc61);background:color-mix(in oklab,var(--k-gruen,#78bc61) 12%,transparent)}
.tut-knoepfe{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.tut-knopf{font:inherit;font-weight:600;padding:10px 14px;border-radius:12px;cursor:pointer;border:2px solid var(--k-gruen-tief,#4d8236);background:var(--k-gruen,#78bc61);color:var(--k-gruen-text,#10230a);box-shadow:0 3px 0 var(--k-gruen-tief,#4d8236)}
.tut-knopf.zweit{background:var(--bg2,#fffdf9);color:var(--text,#2c3e50);border-color:var(--k-rand,#8b5a2b);box-shadow:0 3px 0 var(--k-rand,#8b5a2b)}
.tut-knopf.leer{background:transparent;border-color:transparent;box-shadow:none;color:var(--text3,#846d52);padding-inline:6px}
.tut-knopf:focus-visible,.tut-wahl:focus-visible{outline:3px solid var(--k-blau,#4aa3df);outline-offset:2px}
.tut-chip{align-self:flex-start;font-size:12px;font-weight:600;padding:2px 8px;border-radius:999px;background:var(--k-blau,#4aa3df);color:#fff}
.tut-neu{display:flex;gap:12px;align-items:flex-start}.tut-neu p{margin:4px 0 0;font-size:14px;color:var(--text2,#5c4a36)}
.tut-ic{flex:none;width:52px;height:52px;border-radius:14px;background:var(--k-blau,#4aa3df);color:#fff;display:grid;place-items:center;font-size:26px;border:2px solid var(--k-blau-tief,#2980b9)}
[data-lite-zu] > *:not(.lite-sperre){display:none!important}
.lite-sperre{display:flex;gap:12px;align-items:center;background:var(--bg3,#f6ead2);border:2px dashed var(--k-linie,#e3c99a);border-radius:14px;padding:14px;margin:8px 0}
.lite-sperre i{font-size:26px;color:var(--text3,#846d52)}.lite-sperre b{display:block}.lite-sperre span{font-size:13px;color:var(--text3,#846d52)}
@media (prefers-reduced-motion:reduce){.tut-loch,.tut-blase{transition:none}}`;
  document.head.appendChild(css);

  window.DFLTutorial = { start, tour, wahl, modus, lite, gesperrt, freischaltenPruefen, stabPruefen, stabZustaendig, FREI };
  console.log('[DFL-Tutorial v1] aktiv — Wahl Lite/Voll, erster Tag als Dialog (Eigentümer + Chefscout), Freischalten in Lite (D131), Stab hält das Trainerteam (D137)');
})();
