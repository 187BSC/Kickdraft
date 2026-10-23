/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · ERFOLGE UND WINPUNKTE  ·  v1   (Nutzer 2026-10-16: „Auch bei Flutlicht wären Achievements, der Winpunkte-Laden
   auch super“) – nach Kickdraft dfl_erfolge.js (D122, D159 d)
   ─────────────────────────────────────────────────────────────────────────
   · 33 Erfolge (Spiele, Saison, Karten und Ehrungen, Kader und Markt, Verein) mit 1–10 Winpunkten; jeder zählt einmal je Gerät
     (sonst ließen sich mit neuen Karrieren Winpunkte sammeln). Kennungen „fl.…“, damit sie Kickdrafts Erfolge nicht berühren.
   · Saisonwertung (je Karriere und Saison, nach dem Saisonwechsel – Daten aus KSSaisonende.letzte()): Saison ohne Abstieg 1 W,
     Aufstieg 3 W, Meister 5 W, Pokalsieg 5 W, Europapokal gespielt 1 W, Europapokalsieg 8 W.
   · Winpunkte geräteweit im selben Konto wie Kickdraft (localStorage „dfl-winpunkte“ { konto, gesamt, erfolge, log, wertungen,
     laden }) – in der Gesamt-App sammeln beide Spiele für denselben Laden, das Maskottchen läuft in beiden. Nie für Geld.
     Je Karriere: CLUB.ksErfolge (Winpunkte je Saison, Serie, Zu-null-Spiele, Titel, Laden).
   · Pop-up oben, Warteschlange, nie über Fenstern, Blättern, Ticker; Saisonbilanz-Blatt nach dem Saisonabschluss.
   · Übersicht „Erfolge“ und „Laden“ im Mehr-Blatt, Zähler auf dem Vereinsgelände (→ Laden).
   Haken: processFixtureResult (eigene Pflichtspiele), advanceCalendarWeek (Karten, Kader, Verein), startNewSeason (Wertung).
   API: KSErfolge = { LISTE, erreiche, buchen, ausgeben, konto, geraet, geraetSpeichern, zustand, uebersicht, bilanz, blatt, zu, muenze }
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const W = window;
  const KEY = 'dfl-winpunkte';
  const hatSpiel = () => { try { return typeof CLUB !== 'undefined' && CLUB && typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.tiers; } catch (e) { return false; } };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const ic = n => `<i class="ti ti-${n}" aria-hidden="true"></i>`;
  const label = s => { try { return typeof seasonYearLabel === 'function' ? seasonYearLabel(s) : 'Saison ' + s; } catch (e) { return String(s); } };
  const lsRoh = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const testlauf = () => !!navigator.webdriver && lsRoh('fl-erfolge-test') !== 'an';
  const wpText = n => n + ' Winpunkt' + (Math.abs(n) === 1 ? '' : 'e');
  const neuName = n => (W.KSVereinsnamen ? KSVereinsnamen.text(String(n || '')) : String(n || ''));

  // ── Erfolge ──────────────────────────────────────────────────────────────
  const GRUPPEN = [['spiele', 'Spiele', 'ball-football'], ['saison', 'Saison', 'trophy'], ['karten', 'Karten und Ehrungen', 'cards'],
    ['kader', 'Kader und Markt', 'users'], ['verein', 'Verein', 'building-stadium']];
  const LISTE = [
    { id: 'fl.sieg1', g: 'spiele', name: 'Erster Sieg', text: 'Ein Pflichtspiel gewonnen', wp: 1 },
    { id: 'fl.derby', g: 'spiele', name: 'Derbysieger', text: 'Ein Derby gewonnen', wp: 1 },
    { id: 'fl.kantersieg', g: 'spiele', name: 'Kantersieg', text: 'Mit vier Toren Unterschied gewonnen', wp: 1 },
    { id: 'fl.favorit', g: 'spiele', name: 'Favoritenschreck', text: 'Gegen einen klar stärkeren Gegner gewonnen (5 Punkte Stärke mehr)', wp: 2 },
    { id: 'fl.serie3', g: 'spiele', name: 'Lauf', text: 'Drei Ligasiege in Folge', wp: 1 },
    { id: 'fl.serie6', g: 'spiele', name: 'Siegesserie', text: 'Sechs Ligasiege in Folge', wp: 3 },
    { id: 'fl.bollwerk', g: 'spiele', name: 'Bollwerk', text: 'Acht Ligaspiele einer Saison ohne Gegentor', wp: 2 },
    { id: 'fl.europasieg', g: 'spiele', name: 'Europäischer Abend', text: 'Ein Europapokalspiel gewonnen', wp: 2 },
    { id: 'fl.unbesiegt', g: 'spiele', name: 'Unbesiegt', text: 'Eine ganze Ligasaison ohne Niederlage', wp: 5 },
    { id: 'fl.gerettet', g: 'saison', name: 'Gerettet', text: 'Eine Saison ohne Abstieg beendet', wp: 1 },
    { id: 'fl.aufstieg', g: 'saison', name: 'Aufstieg', text: 'In eine höhere Liga aufgestiegen', wp: 3 },
    { id: 'fl.durchmarsch', g: 'saison', name: 'Durchmarsch', text: 'Zwei Aufstiege in Folge', wp: 5 },
    { id: 'fl.meister', g: 'saison', name: 'Meister', text: 'Die eigene Liga gewonnen', wp: 3 },
    { id: 'fl.meister1', g: 'saison', name: 'Deutscher Meister', text: 'Die Erste Liga gewonnen', wp: 5 },
    { id: 'fl.pokal', g: 'saison', name: 'Pokalsieger', text: 'Den Flutlichtpokal gewonnen', wp: 5 },
    { id: 'fl.double', g: 'saison', name: 'Das Double', text: 'Meister und Pokalsieger in einer Saison', wp: 8 },
    { id: 'fl.europa', g: 'saison', name: 'Europa ruft', text: 'Im Europapokal gespielt', wp: 2 },
    { id: 'fl.europatitel', g: 'saison', name: 'Europas Krone', text: 'Einen Europapokal gewonnen', wp: 10 },
    { id: 'fl.karte1', g: 'karten', name: 'Erste Sonderkarte', text: 'Ein Spieler hat sich eine Sonderkarte erspielt', wp: 1 },
    { id: 'fl.halloween', g: 'karten', name: 'Gruselnacht', text: 'Eine Halloween-Karte am letzten Oktober-Spieltag', wp: 2 },
    { id: 'fl.sammler10', g: 'karten', name: 'Sammler', text: 'Zehn verschiedene Kartenarten', wp: 3 },
    { id: 'fl.sammler20', g: 'karten', name: 'Komplettist', text: 'Zwanzig verschiedene Kartenarten', wp: 5 },
    { id: 'fl.national', g: 'karten', name: 'Nationalspieler', text: 'Ein eigener Spieler läuft für sein Land auf', wp: 2 },
    { id: 'fl.ikone', g: 'karten', name: 'Vereinsikone', text: 'Ein Spieler mit 150 Pflichtspielen für dich', wp: 3 },
    { id: 'fl.neuzugang', g: 'kader', name: 'Erster Neuzugang', text: 'Einen Spieler gekauft', wp: 1 },
    { id: 'fl.akademie', g: 'kader', name: 'Talentjäger', text: 'Ein Talent aus einer fremden Akademie geholt', wp: 1 },
    { id: 'fl.eigengewaechs', g: 'kader', name: 'Aus der eigenen Jugend', text: 'Ein Eigengewächs debütiert im Profiteam', wp: 1 },
    { id: 'fl.verkauf', g: 'kader', name: 'Großer Verkauf', text: 'Einen Spieler für mindestens 10 Mio € verkauft', wp: 2 },
    { id: 'fl.trainer5', g: 'kader', name: 'Startrainer', text: 'Einen Fünf-Sterne-Mann ins Trainerteam geholt', wp: 2 },
    { id: 'fl.bauherr', g: 'verein', name: 'Bauherr', text: 'Stadion, Training, Scouting und Fanshop auf Stufe 8', wp: 3 },
    { id: 'fl.treue5', g: 'verein', name: 'Vereinstreue', text: 'Fünf Saisons beim selben Verein', wp: 3 },
    { id: 'fl.treue10', g: 'verein', name: 'Urgestein', text: 'Zehn Saisons beim selben Verein', wp: 5 },
    { id: 'fl.gruen', g: 'verein', name: 'Grüner Daumen', text: 'Die Pflanze auf dem Gelände steht in voller Blüte', wp: 1 }
  ];
  const ERF = new Map(LISTE.map(e => [e.id, e]));
  const stufe = wp => (wp >= 5 ? 'gold' : wp >= 2 ? 'silber' : 'bronze');
  const WERTUNG = { saison: 1, aufstieg: 3, meister: 5, pokal: 5, europa: 1, europatitel: 8 };

  // ── Gerät (localStorage, gemeinsam mit Kickdraft) ────────────────────────
  let GER = null;
  function lsLies() { try { const x = JSON.parse(localStorage.getItem(KEY) || 'null'); if (x && typeof x.konto === 'number') return x; } catch (e) { /* leer */ } return null; }
  function geraet() {
    if (!GER) GER = Object.assign({ v: 1, konto: 0, gesamt: 0, erfolge: {}, log: [], wertungen: {}, laden: {} }, lsLies() || {});
    return GER;
  }
  function geraetSpeichern() { try { localStorage.setItem(KEY, JSON.stringify(GER)); } catch (e) { /* privat/voll: bleibt im Speicher */ } }
  // Kickdraft kann im selben Gerät gebucht haben: beim Zurückkommen neu lesen
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { GER = null; aktualisiereZaehler(); } });
  const konto = () => geraet().konto;

  // ── Karriere (CLUB.ksErfolge) ────────────────────────────────────────────
  function zustand() {
    if (typeof CLUB === 'undefined' || !CLUB) return null;
    const E = CLUB.ksErfolge || (CLUB.ksErfolge = {});
    ['saisons', 'zuNull', 'wertung'].forEach(k => { if (!E[k] || typeof E[k] !== 'object') E[k] = {}; });
    if (typeof E.serie !== 'number') E.serie = 0;
    if (typeof E.titel !== 'number') E.titel = 0;
    return E;
  }
  const karriereKey = () => { let s = ''; try { s = typeof ACTIVE_SLOT_ID !== 'undefined' && ACTIVE_SLOT_ID ? ACTIVE_SLOT_ID : ''; } catch (e) { /* ohne */ } return 'fl:' + (s || (CLUB.dataClubId || CLUB.name || '')); };
  const vereinsName = () => { try { return neuName(typeof clubName === 'function' ? clubName() : CLUB.name); } catch (e) { return ''; } };

  // ── Buchen ───────────────────────────────────────────────────────────────
  function buchen(wp, art, text, saison) {
    if (!(wp > 0)) return 0;
    const G = geraet();
    G.konto += wp; G.gesamt += wp;
    const s = saison != null ? saison : (hatSpiel() ? LEAGUE.season : 0);
    G.log.push({ t: Date.now(), wp, art, text, saison: label(s), verein: vereinsName(), spiel: 'flutlicht' }); if (G.log.length > 60) G.log.splice(0, G.log.length - 60);
    geraetSpeichern();
    const E = zustand(); if (E) (E.saisons[s] = E.saisons[s] || []).push({ art, text, wp });
    aktualisiereZaehler();
    return wp;
  }
  function ausgeben(wp, text) {
    const G = geraet();
    if (!(wp >= 0) || G.konto < wp) return false;
    G.konto -= wp;
    G.log.push({ t: Date.now(), wp: -wp, art: 'laden', text, spiel: 'flutlicht' }); if (G.log.length > 60) G.log.splice(0, G.log.length - 60);
    geraetSpeichern(); aktualisiereZaehler();
    return true;
  }
  function erreiche(id, saison) {
    const e = ERF.get(id); if (!e || !hatSpiel()) return false;
    const G = geraet(); if (G.erfolge[id]) return false;
    G.erfolge[id] = { datum: new Date().toISOString().slice(0, 10), saison: label(LEAGUE.season), verein: vereinsName() };
    geraetSpeichern();
    buchen(e.wp, 'erfolg', e.name, saison);
    Q.push({ id, name: e.name, text: e.text, wp: e.wp });
    return true;
  }

  // ── Spiel (processFixtureResult) ─────────────────────────────────────────
  function eigeneZeile() { try { return findFcmGroup(LEAGUE).group.teams.find(t => t.id === 'fcm'); } catch (e) { return null; } }
  function spiel(fx, f, g, staerke) {
    const E = zustand(); if (!E || !fx || fx.type === 'friendly') return;
    const s = LEAGUE.season, sieg = f > g;
    if (sieg) erreiche('fl.sieg1');
    if (sieg && W.KSDerby && KSDerby.istDerby(fx)) erreiche('fl.derby');
    if (f - g >= 4) erreiche('fl.kantersieg');
    if (sieg && staerke && staerke.gegner - staerke.wir >= 5) erreiche('fl.favorit');
    if (sieg && fx.type === 'euro') erreiche('fl.europasieg');
    if (fx.type === 'liga') {
      E.serie = sieg ? E.serie + 1 : 0;
      if (E.serie >= 3) erreiche('fl.serie3');
      if (E.serie >= 6) erreiche('fl.serie6');
      if (g === 0) { E.zuNull[s] = (E.zuNull[s] || 0) + 1; if (E.zuNull[s] >= 8) erreiche('fl.bollwerk'); }
      Object.keys(E.zuNull).forEach(k => { if (+k < s - 1) delete E.zuNull[k]; });
      try {
        const t = eigeneZeile(), n = typeof maxMatchday === 'function' ? maxMatchday(LEAGUE) : 0;
        if (t && n && (t.played || 0) >= n && (t.l || 0) === 0) erreiche('fl.unbesiegt');
      } catch (e) { /* ohne Tabelle */ }
    }
  }

  // ── Woche: Karten, Kader, Verein ─────────────────────────────────────────
  function woche() {
    if (!hatSpiel()) return;
    try {
      const K = W.KSKarten ? KSKarten.sammlung().karten : [];
      if (K.length) erreiche('fl.karte1');
      const arten = new Set(K.map(k => k.art));
      if (arten.has('halloween')) erreiche('fl.halloween');
      if (arten.has('ikone')) erreiche('fl.ikone');
      if (arten.has('eigengewaechs')) erreiche('fl.eigengewaechs');
      if (arten.size >= 10) erreiche('fl.sammler10');
      if (arten.size >= 20) erreiche('fl.sammler20');
    } catch (e) { /* ohne Karten */ }
    try { if ((typeof SQUAD !== 'undefined' ? SQUAD : []).some(p => p && p.national && p.national.a > 0)) erreiche('fl.national'); } catch (e) { /* ohne */ }
    const H = CLUB.transferHistory || [];
    if (H.some(x => x.type === 'buy' && !x.akademie)) erreiche('fl.neuzugang');
    if (H.some(x => x.akademie)) erreiche('fl.akademie');
    if (H.some(x => x.type === 'sell' && (x.amount || 0) >= 10e6)) erreiche('fl.verkauf');
    try { const st = W.KSTrainerteam && KSTrainerteam.stab(); if (st && Object.values(st).some(p => p && p.sterne >= 5)) erreiche('fl.trainer5'); } catch (e) { /* ohne */ }
    const f = CLUB.facilities || {};
    if (['stadium', 'training', 'scouting', 'merchandising'].every(k => (f[k] || 0) >= 8)) erreiche('fl.bauherr');
    if (W.KSLaden && KSLaden.pflanzeStufe && KSLaden.pflanzeStufe() >= 4) erreiche('fl.gruen');
    try { if (CLUB.euro && CLUB.euro.fcmComp) erreiche('fl.europa'); } catch (e) { /* ohne */ }
  }

  // ── Saisonwechsel: Wertung (Daten aus kickstil_saisonabschluss.js) ───────
  function euroTitel() {
    try { const K = CLUB.euro && CLUB.euro.knockout; return !!(K && Object.values(K).some(k => k && k.winner && k.winner.isFcm)); } catch (e) { return false; }
  }
  function saisonWertung(v, euroSieg, euroDabei) {
    const E = zustand(); if (!E || !v) return null;
    const vor = v.saison, G = geraet(), k = karriereKey() + ':' + vor;
    if (E.wertung[vor] || G.wertungen[k]) return null;
    E.wertung[vor] = true; G.wertungen[k] = true; geraetSpeichern();
    const ligaName = { bundesliga: 'Erste Liga', bundesliga2: 'Zweite Liga', liga3: 'Dritte Liga', regionalliga: 'Regionalliga' };
    const ligaDativ = { bundesliga: 'Ersten Liga', bundesliga2: 'Zweiten Liga', liga3: 'Dritten Liga', regionalliga: 'Regionalliga' };
    if (!v.ab) { buchen(WERTUNG.saison, 'wertung', 'Saison ohne Abstieg', vor); erreiche('fl.gerettet', vor); }
    if (v.auf) {
      buchen(WERTUNG.aufstieg, 'wertung', 'Aufstieg in die ' + (ligaName[v.tierNach] || 'nächste Liga'), vor); erreiche('fl.aufstieg', vor);
      if (E.letzterAufstieg === vor - 1) erreiche('fl.durchmarsch', vor);
      E.letzterAufstieg = vor;
    }
    if (v.platz === 1) {
      buchen(WERTUNG.meister, 'wertung', 'Meister der ' + (ligaDativ[v.tier] || v.liga), vor); erreiche('fl.meister', vor);
      if (v.tier === 'bundesliga') erreiche('fl.meister1', vor);
      E.titel++;
    }
    if (v.pokalsieger) { buchen(WERTUNG.pokal, 'wertung', 'Flutlichtpokal gewonnen', vor); erreiche('fl.pokal', vor); E.titel++; }
    if (v.platz === 1 && v.pokalsieger) erreiche('fl.double', vor);
    if (euroDabei) { buchen(WERTUNG.europa, 'wertung', 'Europapokal gespielt', vor); erreiche('fl.europa', vor); }
    if (euroSieg) { buchen(WERTUNG.europatitel, 'wertung', 'Europapokal gewonnen', vor); erreiche('fl.europatitel', vor); E.titel++; }
    // Vereinstreue: Saisons beim selben Verein (Name als Kennung, Karrierestart setzt neu)
    const vid = CLUB.dataClubId || CLUB.name;
    if (!E.seit || E.seit.verein !== vid) E.seit = { verein: vid, saison: vor };
    const jahre = LEAGUE.season - E.seit.saison;
    if (jahre >= 5) erreiche('fl.treue5', vor); if (jahre >= 10) erreiche('fl.treue10', vor);
    const liste = E.saisons[vor] || [], summe = liste.reduce((a, x) => a + x.wp, 0);
    try { if (typeof addNews === 'function') addNews('club', 'Winpunkte der Saison ' + label(vor), `${wpText(summe)} · Kontostand ${konto()}`); } catch (e) { /* optional */ }
    E.bilanzOffen = vor;
    return { saison: vor, summe, liste };
  }

  // ── Warteschlange und Pop-up ─────────────────────────────────────────────
  const Q = [];
  let zeigt = null;
  const sichtbar = el => !!el && el.isConnected && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden' && el.offsetWidth > 0;
  function frei() {
    if (!hatSpiel()) return false;
    if (W.KSSimulieren && (() => { try { return KSSimulieren.laeuft(); } catch (e) { return false; } })()) return false;
    if (document.hidden || document.body.classList.contains('ts-offen')) return false;
    if ([...document.querySelectorAll('#app-sheet.auf, #app-blatt.auf, .exp-overlay, .ef-ov, #ks-saisonende, #pm-overlay, #onboarding-overlay, #intro-overlay')].some(sichtbar)) return false;
    const ok = /^(app-cta|app-nav|app-hinweis|toast-host|app-kopf|ef-pop|ks-tipp)$/;
    return ![...document.body.children].some(e => !ok.test(e.id) && !/^app-(sheet|blatt)$/.test(e.id) && e.offsetWidth > 200 && e.offsetHeight > 200
      && getComputedStyle(e).position === 'fixed' && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).pointerEvents !== 'none');
  }
  const medaille = (wp, aus) => `<span class="ef-med ef-${aus ? 'aus' : stufe(wp)}" aria-hidden="true">${ic(wp >= 5 ? 'trophy' : 'medal')}</span>`;
  const muenze = n => `<span class="ef-wp"><span class="ef-muenze" aria-hidden="true">W</span>${n}</span>`;
  function popup(e) {
    let el = document.getElementById('ef-pop');
    if (!el) { el = document.createElement('div'); el.id = 'ef-pop'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); document.body.appendChild(el); }
    el.innerHTML = e.mehr
      ? `${medaille(5)}<div><b>${e.mehr} Erfolge</b><small>+${wpText(e.wp)}</small></div>`
      : `${medaille(e.wp)}<div><b>Erfolg: ${esc(e.name)}</b><small>${esc(e.text)} · +${wpText(e.wp)}</small></div>`;
    el.classList.remove('weg'); void el.offsetWidth; el.classList.add('an');
    zeigt = setTimeout(() => { el.classList.remove('an'); el.classList.add('weg'); setTimeout(() => { zeigt = null; }, 380); }, 3200);
  }
  function pumpe() {
    if (zeigt || !frei()) return;
    if (Q.length > 4) { const alle = Q.splice(0); popup({ mehr: alle.length, wp: alle.reduce((a, x) => a + x.wp, 0) }); return; }
    if (Q.length) { popup(Q.shift()); return; }
    const E = zustand();
    if (E && E.bilanzOffen != null) {
      const s = E.bilanzOffen; E.bilanzOffen = null; E.bilanzGezeigt = s;
      if (!testlauf()) bilanz(s);
    }
  }

  // ── Blätter (Handy #app-blatt, sonst eigenes Fenster) ────────────────────
  function blatt(html, klick) {
    const box = document.querySelector('#app-blatt .app-blatt-box');
    if (box && getComputedStyle(document.getElementById('app-blatt')).display !== 'none') {
      box.innerHTML = '<div class="app-griff"></div><button class="app-blatt-zu" type="button" aria-label="Schließen"><i class="ti ti-x" aria-hidden="true"></i></button>' + html;
      box.onclick = ev => { if (ev.target.closest('.app-blatt-zu')) zu(); else if (klick) klick(ev, box); };
      document.getElementById('app-blatt').classList.add('auf'); document.body.classList.add('app-gesperrt');
      return box;
    }
    let ov = document.querySelector('.ef-ov'); if (ov) ov.remove();
    ov = document.createElement('div'); ov.className = 'ef-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = `<div class="ef-ov-box"><button class="app-blatt-zu" type="button" aria-label="Schließen"><i class="ti ti-x" aria-hidden="true"></i></button>${html}</div>`;
    ov.addEventListener('click', ev => { if (ev.target === ov || ev.target.closest('.app-blatt-zu')) zu(); else if (klick) klick(ev, ov.querySelector('.ef-ov-box')); });
    document.body.appendChild(ov);
    return ov.querySelector('.ef-ov-box');
  }
  function zu() {
    const b = document.getElementById('app-blatt');
    if (b && b.classList.contains('auf')) { b.classList.remove('auf'); const s = document.getElementById('app-sheet'); if (!(s && s.classList.contains('auf'))) document.body.classList.remove('app-gesperrt'); }
    const ov = document.querySelector('.ef-ov'); if (ov) ov.remove();
  }

  function uebersichtHtml() {
    const G = geraet(), n = LISTE.filter(e => G.erfolge[e.id]).length;
    const summe = LISTE.filter(e => G.erfolge[e.id]).reduce((a, e) => a + e.wp, 0), moeglich = LISTE.reduce((a, e) => a + e.wp, 0);
    return `<div class="ef-blatt"><div class="ef-kopf"><div><div class="app-sheet-titel">Erfolge</div><small>${n} von ${LISTE.length} · ${summe} von ${moeglich} Winpunkten</small></div>${muenze(G.konto)}</div>
      ${GRUPPEN.map(([g, name, icon]) => `<h3 class="ef-h3">${ic(icon)} ${name}</h3><ul class="ef-liste">${LISTE.filter(e => e.g === g).map(e => {
        const x = G.erfolge[e.id];
        return `<li class="${x ? 'ja' : 'nein'}">${medaille(e.wp, !x)}<span><b>${esc(e.name)}</b><small>${esc(e.text)}${x ? ` · ${esc(x.saison)}${x.verein ? ', ' + esc(x.verein) : ''}` : ''}</small></span>${muenze((x ? '+' : '') + e.wp)}</li>`;
      }).join('')}</ul>`).join('')}
      <p class="ld-klein">Winpunkte gibt es für Erfolge (einmal je Gerät) und jede Saison: ohne Abstieg ${WERTUNG.saison}, Aufstieg ${WERTUNG.aufstieg}, Meister ${WERTUNG.meister}, Pokalsieg ${WERTUNG.pokal}, Europapokal ${WERTUNG.europa}, Europapokalsieg ${WERTUNG.europatitel}. Nie für Geld.</p>
      <div class="app-blatt-aktionen"><button type="button" class="app-knopf haupt" data-ef="laden">${ic('building-store')}Zum Laden</button></div></div>`;
  }
  function uebersicht() { return blatt(uebersichtHtml(), ev => { if (ev.target.closest('[data-ef="laden"]')) { zu(); if (W.KSLaden) KSLaden.oeffnen(); } }); }

  function bilanzHtml(s) {
    const E = zustand(), liste = (E && E.saisons[s]) || [], summe = liste.reduce((a, x) => a + x.wp, 0);
    const icon = x => (x.art === 'erfolg' ? 'medal' : /Meister|gewonnen/.test(x.text) ? 'trophy' : /Aufstieg/.test(x.text) ? 'trending-up' : 'award');
    return `<div class="ef-blatt ef-bilanz"><p class="ef-eyebrow">Winpunkte · ${esc(label(s))}</p>
      <h2 class="ef-titel">Diese Saison: ${summe ? wpText(summe) : 'keine Winpunkte'}</h2>
      ${liste.length ? `<ul class="ef-liste">${liste.map(x => `<li><span class="ef-med ef-${x.art === 'erfolg' ? stufe(x.wp) : 'wertung'}" aria-hidden="true">${ic(icon(x))}</span><span><b>${esc(x.text)}</b><small>${x.art === 'erfolg' ? 'Erfolg' : 'Saisonwertung'}</small></span>${muenze('+' + x.wp)}</li>`).join('')}</ul>` : ''}
      <div class="ef-gesamt"><span>Kontostand</span>${muenze(konto())}</div>
      <div class="app-blatt-aktionen"><button type="button" class="app-knopf haupt" data-ef="laden">${ic('building-store')}Zum Laden</button><button type="button" class="app-knopf" data-ef="zu">Weiter</button></div></div>`;
  }
  function bilanz(s) {
    const E = zustand(); if (s == null && E) s = E.bilanzGezeigt != null ? E.bilanzGezeigt : LEAGUE.season - 1;
    return blatt(bilanzHtml(s), ev => {
      if (ev.target.closest('[data-ef="laden"]')) { zu(); if (W.KSLaden) KSLaden.oeffnen(); }
      else if (ev.target.closest('[data-ef="zu"]')) zu();
    });
  }

  // ── Zähler auf dem Gelände und Mehr-Blatt ────────────────────────────────
  function aktualisiereZaehler() { document.querySelectorAll('.ef-chip .ef-chip-n').forEach(n => { n.textContent = konto(); }); }
  function zaehler() {
    if (!hatSpiel()) return;
    const ziel = document.getElementById('app-office-kopf');
    if (!ziel || ziel.querySelector('.ef-chip')) { aktualisiereZaehler(); return; }
    ziel.insertAdjacentHTML('afterbegin', `<button type="button" class="ef-chip" aria-label="Laden, ${wpText(konto())}"><span class="ef-muenze" aria-hidden="true">W</span><span class="ef-chip-n">${konto()}</span></button>`);
    ziel.querySelector('.ef-chip').addEventListener('click', ev => { ev.stopPropagation(); if (W.KSLaden) KSLaden.oeffnen(); else uebersicht(); });
  }
  function mehrEintraege() {
    const box = document.querySelector('#app-sheet .app-sheet-box');
    if (!box || box.querySelector('.ef-eintrag')) return;
    const eintrag = (cls, icon, titel, sub) => `<button class="app-eintrag ef-eintrag ${cls}" type="button">${ic(icon)}<span class="app-eintrag-txt"><b>${titel}</b><small>${sub}</small></span><i class="ti ti-chevron-right app-pfeil" aria-hidden="true"></i></button>`;
    const vor = box.querySelector('.app-eintrag');
    const html = eintrag('ef-e-erfolge', 'medal', 'Erfolge', `${LISTE.length} Erfolge mit Winpunkten`) + eintrag('ef-e-laden', 'building-store', 'Laden', 'Maskottchen, Vitrine, Pflanze, Sponsorentreffen') + (W.KSVitrine ? eintrag('ef-e-vitrine', 'trophy', 'Pokalvitrine', 'Deine Titel') : '');
    if (vor) vor.insertAdjacentHTML('beforebegin', html); else box.insertAdjacentHTML('beforeend', html);
    const auf = fn => ev => { ev.stopPropagation(); const s = document.getElementById('app-sheet'); if (s) s.classList.remove('auf'); document.body.classList.remove('app-gesperrt'); fn(); };
    box.querySelector('.ef-e-erfolge').addEventListener('click', auf(uebersicht));
    box.querySelector('.ef-e-laden').addEventListener('click', auf(() => { if (W.KSLaden) KSLaden.oeffnen(); }));
    const v = box.querySelector('.ef-e-vitrine'); if (v) v.addEventListener('click', auf(() => KSVitrine.oeffnen()));
  }
  // PC-Knöpfe im Verein-Reiter (ohne Handy-Oberfläche)
  function pcKnoepfe() {
    const club = document.getElementById('view-club');
    if (!club || club.querySelector('.ef-pc')) return;
    const d = document.createElement('div'); d.className = 'ef-pc';
    d.innerHTML = `<button type="button" class="ksj-pc" data-ef-pc="erfolge">${ic('medal')} Erfolge</button> <button type="button" class="ksj-pc" data-ef-pc="laden">${ic('building-store')} Laden · <span class="ef-chip-n">${konto()}</span> W</button>`;
    club.insertBefore(d, club.firstChild);
    d.addEventListener('click', ev => { const b = ev.target.closest('[data-ef-pc]'); if (!b) return; if (b.dataset.efPc === 'erfolge') uebersicht(); else if (W.KSLaden) KSLaden.oeffnen(); });
  }

  // ── Einhängen ────────────────────────────────────────────────────────────
  if (typeof W.processFixtureResult === 'function') {
    const _p = W.processFixtureResult;
    W.processFixtureResult = function () {
      let fx = null, tore = null, staerke = null;
      try {
        fx = CURRENT_FIXTURE ? Object.assign({}, CURRENT_FIXTURE) : null;
        tore = { f: G.homeGoals, g: G.awayGoals };
        staerke = { wir: (TEAMS.home && TEAMS.home.str) || 0, gegner: (TEAMS.away && TEAMS.away.str) || 0 };
      } catch (e) { fx = null; }
      const r = _p.apply(this, arguments);
      try { if (fx && tore) spiel(fx, tore.f, tore.g, staerke); } catch (e) { console.warn('[Kickstil-Erfolge] Spiel', e); }
      return r;
    };
    try { processFixtureResult = W.processFixtureResult; } catch (e) { /* window reicht */ }
  }
  if (typeof W.advanceCalendarWeek === 'function') {
    const _w = W.advanceCalendarWeek;
    W.advanceCalendarWeek = function () {
      const r = _w.apply(this, arguments);
      try { woche(); } catch (e) { console.warn('[Kickstil-Erfolge] Woche', e); }
      return r;
    };
    try { advanceCalendarWeek = W.advanceCalendarWeek; } catch (e) { /* window reicht */ }
  }
  // Nach kickstil_saisonabschluss.js geladen: dessen Daten (KSSaisonende.letzte) stehen nach dem Original bereit
  if (typeof W.startNewSeason === 'function') {
    const _s = W.startNewSeason;
    W.startNewSeason = function () {
      let euroSieg = false, euroDabei = false;
      try { euroSieg = euroTitel(); euroDabei = !!(CLUB.euro && CLUB.euro.fcmComp); } catch (e) { /* ohne Europa */ }
      const r = _s.apply(this, arguments);
      const danach = () => { try { saisonWertung(W.KSSaisonende && KSSaisonende.letzte(), euroSieg, euroDabei); } catch (e) { console.warn('[Kickstil-Erfolge] Saisonwertung', e); } };
      if (r && typeof r.then === 'function') r.then(x => { danach(); return x; }); else danach();
      return r;
    };
    try { startNewSeason = W.startNewSeason; } catch (e) { /* window reicht */ }
  }
  setInterval(() => { try { pumpe(); } catch (e) { /* später */ } }, 700);
  setInterval(() => { try { mehrEintraege(); zaehler(); pcKnoepfe(); } catch (e) { /* Oberfläche noch nicht da */ } }, 1200);

  W.KSErfolge = { LISTE, GRUPPEN, WERTUNG, erreiche, buchen, ausgeben, konto, geraet, geraetSpeichern, neuLesen: () => { GER = null; return geraet(); },
    zustand, spiel, woche, saisonWertung, uebersicht, bilanz, bilanzHtml, uebersichtHtml, warteschlange: () => Q, frei, pumpe, zu, blatt, muenze, wpText };
  console.log('[Kickstil-Erfolge v1] aktiv — ' + LISTE.length + ' Erfolge mit Pop-up, Winpunkte geräteweit (Konto ' + konto() + ', gemeinsam mit Kickdraft), Saisonwertung und -bilanz');
})();
