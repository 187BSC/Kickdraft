/* ═══════════════════════════════════════════════════════════════════════════
   DFL · ERFOLGE UND WINPUNKTE  ·  v1   (D122, D159 d; Nutzer 2026-10-15: „Achievements, die aufploppen, und die Benachrichtigung
   am Ende, wie viele Winpoints man gesammelt hat … der Laden sollte schon gebaut werden“)
   ─────────────────────────────────────────────────────────────────────────
   · 33 Erfolge (Spiele, Saison, Ehrungen, Kader und Markt, Verein) mit 1–10 Winpunkten; jeder zählt einmal je Gerät
     (sonst ließen sich mit neuen Karrieren Winpunkte sammeln). Tutorial-Missionen geben keine Winpunkte: Picks im Start-Draft
     und der Star der Mission zählen nicht.
   · Saisonwertung (je Karriere und Saison, beim Saisonwechsel nach den Preisen): Playoffs 1 W, Meister 5 W, je Saisonpreis eines
     eigenen Spielers oder des Managers 3 W (Vorschau „Laden und Maskottchen“, Nutzer: „Preise sind super“).
   · Winpunkte gerätweit (D122: „für alle Karrieren auf dem Gerät“): localStorage 'dfl-winpunkte' { konto, gesamt, erfolge, log,
     wertungen, laden }; nie für Geld. Je Karriere: CLUB.dflErfolge (Winpunkte je Saison, Zähler, gedraftete Spieler, Verträge).
   · Pop-up oben (Kenney-Stil, ohne Klick-Fläche), Warteschlange, nie über Fenstern, Blättern, Ticker; „Simulieren bis …“ sammelt
     sie in der Zusammenfassung (Tafel „Erfolge“). Saisonbilanz-Karte nach dem Saisonwechsel, sobald die Abschluss-Fenster zu sind.
   · Übersicht „Erfolge“ und „Laden“ im Mehr-Blatt, Zähler im Office (Gelände oben rechts → Laden).
   Haken: recordResult (eigene Ligaspiele), advanceCalendarWeek (Playoffs, Pro Bowl, Draft, Verträge, Anlagen), startNewSeason
   (Saisonwertung, Preise, Hall of Fame), addNews („Trade mit …“), renderHomeTab (Zähler).
   API: DFLErfolge = { LISTE, erreiche, buchen, ausgeben, konto, geraet, geraetSpeichern, neuLesen, zustand, spiel, woche, saisonWertung, uebersicht, bilanz,
     bilanzHtml, warteschlange, frei }
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : globalThis;
  const hatDom = typeof document !== 'undefined' && typeof document.querySelector === 'function' && typeof document.createElement === 'function';
  const KEY = 'dfl-winpunkte';
  const dfl = () => typeof CLUB !== 'undefined' && CLUB && CLUB.dfl && CLUB.dfl.aktiv && typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.dfl;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const ic = n => `<i class="ti ti-${n}" aria-hidden="true"></i>`;
  const label = s => { try { return typeof seasonYearLabel === 'function' ? seasonYearLabel(s) : String(s); } catch (e) { return String(s); } };
  const testlauf = () => typeof navigator !== 'undefined' && !!navigator.webdriver && lsRoh('dfl-erfolge-test') !== 'an';
  function lsRoh(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  const wpText = n => n + ' Winpunkt' + (Math.abs(n) === 1 ? '' : 'e');
  const startAktiv = () => !!(W.DFLStartDraft && typeof DFLStartDraft.aktiv === 'function' && DFLStartDraft.aktiv());

  // ── Erfolge ──────────────────────────────────────────────────────────────
  const GRUPPEN = [['spiele', 'Spiele', 'ball-football'], ['saison', 'Saison', 'trophy'], ['ehrungen', 'Ehrungen', 'award'],
    ['kader', 'Kader und Markt', 'users'], ['verein', 'Verein', 'building-stadium']];
  const LISTE = [
    { id: 'sieg1', g: 'spiele', name: 'Erster Sieg', text: 'Ein Pflichtspiel gewonnen', wp: 1 },
    { id: 'derby', g: 'spiele', name: 'Derbysieger', text: 'Einen Divisionsrivalen geschlagen', wp: 1 },
    { id: 'kantersieg', g: 'spiele', name: 'Kantersieg', text: 'Mit vier Toren Unterschied gewonnen', wp: 1 },
    { id: 'serie3', g: 'spiele', name: 'Lauf', text: 'Drei Ligasiege in Folge', wp: 1 },
    { id: 'serie6', g: 'spiele', name: 'Siegesserie', text: 'Sechs Ligasiege in Folge', wp: 3 },
    { id: 'bollwerk', g: 'spiele', name: 'Bollwerk', text: 'Sechs Ligaspiele einer Saison ohne Gegentor', wp: 2 },
    { id: 'unbesiegt', g: 'spiele', name: 'Unbesiegt', text: 'Hauptrunde ohne Niederlage', wp: 5 },
    { id: 'playoffs', g: 'saison', name: 'Playoffs', text: 'In die Playoffs eingezogen', wp: 2 },
    { id: 'division', g: 'saison', name: 'Divisionssieger', text: 'Die eigene Division gewonnen', wp: 2 },
    { id: 'freilos', g: 'saison', name: 'Freilos', text: 'Platz 1 der Conference', wp: 3 },
    { id: 'playoffsieg', g: 'saison', name: 'Playoff-Sieg', text: 'Ein Playoff-Spiel gewonnen', wp: 2 },
    { id: 'finale', g: 'saison', name: 'Im Finale', text: 'Das Finale erreicht', wp: 3 },
    { id: 'meister', g: 'saison', name: 'Meister', text: 'Das Finale gewonnen', wp: 5 },
    { id: 'dynastie', g: 'saison', name: 'Dynastie', text: 'Drei Titel in fünf Saisons', wp: 10 },
    { id: 'keller', g: 'saison', name: 'Aus dem Keller', text: 'Meister, nachdem du in den vier Saisons davor im letzten Drittel standest', wp: 10 },
    { id: 'probowl', g: 'ehrungen', name: 'Pro Bowler', text: 'Ein eigener Spieler im Pro Bowl', wp: 2 },
    { id: 'probowl5', g: 'ehrungen', name: 'Pro-Bowl-Fabrik', text: 'Fünf eigene Spieler in einem Pro Bowl', wp: 5 },
    { id: 'mvp', g: 'ehrungen', name: 'Spieler der Saison', text: 'Ein eigener Spieler wird Spieler der Saison', wp: 3 },
    { id: 'torjaeger', g: 'ehrungen', name: 'Torschützenkönig', text: 'Ein eigener Spieler schießt die meisten Tore', wp: 2 },
    { id: 'rookie', g: 'ehrungen', name: 'Rookie des Jahres', text: 'Ein eigener Spieler wird Rookie des Jahres', wp: 2 },
    { id: 'manager', g: 'ehrungen', name: 'Manager der Saison', text: 'Der größte Sprung über die Erwartung', wp: 3 },
    { id: 'hof', g: 'ehrungen', name: 'Hall of Famer', text: 'Ein Spieler, der für dich gespielt hat, kommt in die Hall of Fame', wp: 3 },
    { id: 'legende', g: 'ehrungen', name: 'Eigene Legende', text: 'Ein selbst gedrafteter Spieler kommt in die Hall of Fame', wp: 5 },
    { id: 'pick1', g: 'kader', name: 'Erster Pick', text: 'Einen Spieler gedraftet', wp: 1 },
    { id: 'draftglueck', g: 'kader', name: 'Draft-Glück', text: 'Ein Pick aus Runde 3 oder 4 steht in zehn Ligaspielen einer Saison in der Startelf', wp: 3 },
    { id: 'star', g: 'kader', name: 'Star gehalten', text: 'Den Vertrag eines Stars verlängert', wp: 2 },
    { id: 'trade1', g: 'kader', name: 'Erster Tausch', text: 'Einen Trade abgeschlossen', wp: 1 },
    { id: 'deadline', g: 'kader', name: 'Last-Minute-Deal', text: 'Ein Trade in der letzten Woche vor der Deadline', wp: 1 },
    { id: 'capkuenstler', g: 'kader', name: 'Cap-Künstler', text: 'In die Playoffs mit mindestens 5 Mio € freiem Cap', wp: 3 },
    { id: 'bauherr', g: 'verein', name: 'Bauherr', text: 'Stadion, Training, Scouting und Fanshop auf Stufe 8', wp: 3 },
    { id: 'treue5', g: 'verein', name: 'Vereinstreue', text: 'Fünf Saisons beim selben Verein', wp: 3 },
    { id: 'treue10', g: 'verein', name: 'Urgestein', text: 'Zehn Saisons beim selben Verein', wp: 5 },
    { id: 'gruen', g: 'verein', name: 'Grüner Daumen', text: 'Die Pflanze im Office steht in voller Blüte', wp: 1 }
  ];
  const ERF = new Map(LISTE.map(e => [e.id, e]));
  const stufe = wp => (wp >= 5 ? 'gold' : wp >= 2 ? 'silber' : 'bronze');
  // Saisonwertung (Vorschau D122 „Woher Winpunkte kommen“)
  const WERTUNG = { playoffs: 1, meister: 5, preis: 3 };
  const PREISE = { spieler: 'Spieler der Saison', tore: 'Torschützenkönig', verteidiger: 'Verteidiger der Saison', rookie: 'Rookie des Jahres', finals: 'Spieler der Finals' };

  // ── Gerät (localStorage) ─────────────────────────────────────────────────
  let GER = null;
  function lsLies() { try { const x = JSON.parse(localStorage.getItem(KEY) || 'null'); if (x && typeof x.konto === 'number') return x; } catch (e) { /* leer */ } return null; }
  // einmal je Seite lesen, danach gilt das Objekt im Speicher (jede Änderung schreibt es gleich zurück)
  function geraet() {
    if (!GER) GER = Object.assign({ v: 1, konto: 0, gesamt: 0, erfolge: {}, log: [], wertungen: {}, laden: {} }, lsLies() || {});
    return GER;
  }
  function geraetSpeichern() { try { localStorage.setItem(KEY, JSON.stringify(GER)); } catch (e) { /* privat/voll: bleibt im Speicher */ } }
  const konto = () => geraet().konto;

  // ── Karriere (CLUB.dflErfolge) ───────────────────────────────────────────
  function zustand() {
    if (typeof CLUB === 'undefined' || !CLUB) return null;
    const E = CLUB.dflErfolge || (CLUB.dflErfolge = {});
    ['saisons', 'zuNull', 'vertrag', 'starts', 'wertung', 'po'].forEach(k => { if (!E[k] || typeof E[k] !== 'object') E[k] = {}; });
    if (!Array.isArray(E.gedraftet)) E.gedraftet = [];
    if (typeof E.serie !== 'number') E.serie = 0;
    return E;
  }
  const karriereKey = () => (CLUB.dfl && (CLUB.dfl.seed || 0)) + '-' + ((CLUB.dfl && CLUB.dfl.franchiseId) || '');
  const vereinsName = () => { try { const f = W.DFLSpiel && DFLSpiel.franchise('fcm'); return (f && f.name) || CLUB.name || ''; } catch (e) { return (CLUB && CLUB.name) || ''; } };

  // ── Buchen ───────────────────────────────────────────────────────────────
  function buchen(wp, art, text, saison) {
    if (!(wp > 0)) return 0;
    const G = geraet();
    G.konto += wp; G.gesamt += wp;
    const s = saison != null ? saison : (typeof LEAGUE !== 'undefined' && LEAGUE ? LEAGUE.season : 0);
    G.log.push({ t: Date.now(), wp, art, text, saison: label(s), verein: vereinsName() }); if (G.log.length > 60) G.log.splice(0, G.log.length - 60);
    geraetSpeichern();
    const E = zustand(); if (E) (E.saisons[s] = E.saisons[s] || []).push({ art, text, wp });
    aktualisiereZaehler();
    return wp;
  }
  function ausgeben(wp, text) {
    const G = geraet();
    if (!(wp >= 0) || G.konto < wp) return false;
    G.konto -= wp;
    G.log.push({ t: Date.now(), wp: -wp, art: 'laden', text }); if (G.log.length > 60) G.log.splice(0, G.log.length - 60);
    geraetSpeichern(); aktualisiereZaehler();
    return true;
  }
  function erreiche(id) {
    const e = ERF.get(id); if (!e || !dfl()) return false;
    const G = geraet(); if (G.erfolge[id]) return false;
    G.erfolge[id] = { datum: new Date().toISOString().slice(0, 10), saison: label(LEAGUE.season), verein: vereinsName() };
    geraetSpeichern();
    buchen(e.wp, 'erfolg', e.name);
    Q.push({ id, name: e.name, text: e.text, wp: e.wp });
    return true;
  }

  // ── Hilfen zur Liga ──────────────────────────────────────────────────────
  const eigeneDfl = () => { try { return DFLSpiel.eigeneDflId(); } catch (e) { return null; } };
  const istIch = id => { if (id === 'fcm') return true; try { return !!(id && W.DFLSpiel && DFLSpiel.dflIdVon && DFLSpiel.dflIdVon(id) === DFLSpiel.dflIdVon('fcm')); } catch (e) { return false; } };
  const eigenesTeam = () => { try { return LEAGUE.tiers.bundesliga.groups[0].teams.find(t => t.id === 'fcm'); } catch (e) { return null; } };
  const division = id => { try { const f = DFLSpiel.franchise(id); return f && f.division; } catch (e) { return null; } };
  const liga = () => { try { return DFLSpiel.liga(); } catch (e) { return null; } };
  const SPIELTAGE = 26;

  // Eigenes Ligaspiel (recordResult)
  function spiel(eigen, geg, gegnerId, teams) {
    const E = zustand(); if (!E || !dfl() || startAktiv()) return;
    const s = LEAGUE.season, sieg = eigen > geg;
    if (sieg) erreiche('sieg1');
    if (sieg && gegnerId && division(gegnerId) && division(gegnerId) === division('fcm')) erreiche('derby');
    if (eigen - geg >= 4) erreiche('kantersieg');
    E.serie = sieg ? E.serie + 1 : 0;
    if (E.serie >= 3) erreiche('serie3');
    if (E.serie >= 6) erreiche('serie6');
    if (geg === 0) { E.zuNull[s] = (E.zuNull[s] || 0) + 1; if (E.zuNull[s] >= 6) erreiche('bollwerk'); }
    Object.keys(E.zuNull).forEach(k => { if (+k < s - 1) delete E.zuNull[k]; });
    const t = (teams && teams.find && teams.find(x => x.id === 'fcm')) || eigenesTeam();
    if (t && t.played >= SPIELTAGE && t.l === 0) erreiche('unbesiegt');
    // Draft-Glück: Startelf-Einsätze selbst gedrafteter Spieler aus Runde 3–4
    try {
      const elf = typeof W.getLineupIds === 'function' ? W.getLineupIds() : Object.values(CLUB.lineup || {});
      (typeof SQUAD !== 'undefined' ? SQUAD : []).forEach(q => {
        const rv = q.rookieVertrag;
        if (!rv || rv.von || !(rv.runde >= 3) || elf.indexOf(q.id) < 0 || E.gedraftet.indexOf(String(q.dflId || q.id)) < 0) return;
        const k = s + ':' + q.id; E.starts[k] = (E.starts[k] || 0) + 1;
        if (E.starts[k] >= 10) erreiche('draftglueck');
      });
      Object.keys(E.starts).forEach(k => { if (+k.split(':')[0] < s) delete E.starts[k]; });
    } catch (e) { /* Aufstellung optional */ }
  }

  // Woche (advanceCalendarWeek): Playoffs, Pro Bowl, Draft, Verträge, Anlagen
  const capFrei = () => { const K = W.DFLKader; try { return K && K.capLimit ? K.capLimit() - K.capBelegt() : 0; } catch (e) { return 0; } };
  function woche() {
    const E = zustand(); if (!E || !dfl()) return;
    const po = LEAGUE.dflPO;
    if (po && po.setzliste) {
      for (const k of Object.keys(po.setzliste)) {
        const i = (po.setzliste[k] || []).findIndex(istIch); if (i < 0) continue;
        erreiche('playoffs'); if (i < 4) erreiche('division'); if (i === 0) erreiche('freilos');
        if (!E.po[po.saison]) { E.po[po.saison] = true; if (capFrei() >= 5e6) erreiche('capkuenstler'); }
      }
      (po.spiele || []).forEach(sp => {
        if (istIch(sp.sieger)) erreiche('playoffsieg');
        if (sp.runde === 4 && (istIch(sp.heim) || istIch(sp.gast))) erreiche('finale');
      });
      if (istIch(po.finalist)) erreiche('finale');
      if (istIch(po.meister)) { erreiche('finale'); erreiche('meister'); titelErfolge(po.saison); }
      const pb = po.proBowl, eig = eigeneDfl();
      if (pb && pb.kader && eig) {
        const n = Object.values(pb.kader).reduce((a, l) => a + (l || []).filter(x => x.teamId === eig).length, 0);
        if (n >= 1) erreiche('probowl'); if (n >= 5) erreiche('probowl5');
      }
    }
    // Draft: selbst gedraftet = Rookie-Vertrag aus deinem Pick (KI-Picks tragen „von“); Start-Draft (Tutorial) zählt nicht
    const sq = typeof SQUAD !== 'undefined' ? SQUAD : [];
    sq.forEach(q => {
      const rv = q.rookieVertrag, id = String(q.dflId || q.id);
      if (!rv || rv.jahr == null || rv.von || E.gedraftet.indexOf(id) >= 0) return;
      E.gedraftet.push(id);
      const start = (LEAGUE.dflStart && rv.jahr === LEAGUE.dflStart.jahr) || (LEAGUE.dflDraft && LEAGUE.dflDraft.start) || startAktiv();
      if (!start) erreiche('pick1');
    });
    if (E.gedraftet.length > 400) E.gedraftet.splice(0, E.gedraftet.length - 400);
    // Star gehalten: Vertragsende eines Stars rückt nach hinten (Verlängerung oder Folgevertrag)
    const ersterBlick = !E.vertragGesehen;
    sq.forEach(q => {
      const F = q.vertragFolge, bis = Math.max(q.contractUntil || 0, F ? (F.start || 0) + (F.jahre || 1) - 1 : 0), alt = E.vertrag[q.id];
      if (!ersterBlick && alt != null && bis > alt && istStar(q) && !startAktiv() && !(W.DFLMissionen && DFLMissionen.istStar && safe(() => DFLMissionen.istStar(q.id)))) erreiche('star');
      E.vertrag[q.id] = bis;
    });
    Object.keys(E.vertrag).forEach(id => { if (!sq.some(q => String(q.id) === id)) delete E.vertrag[id]; });
    E.vertragGesehen = true;
    const f = CLUB.facilities || {};
    if (['stadium', 'training', 'scouting', 'merchandising'].every(k => (f[k] || 0) >= 8)) erreiche('bauherr');
    if (W.DFLLaden && DFLLaden.pflanzeStufe && DFLLaden.pflanzeStufe() >= 4) erreiche('gruen');
  }
  const safe = f => { try { return f(); } catch (e) { return false; } };
  function istStar(q) {
    try { if (typeof W.squadRoleFor === 'function') return W.squadRoleFor(q).key === 'star'; } catch (e) { /* Rückfall */ }
    return (q.ovr || 0) >= 85;
  }
  // Titel: Dynastie (3 in 5 Saisons), Aus dem Keller (vorher letztes Drittel)
  function titelErfolge(saison) {
    const E = zustand(); if (!E || E.titelGeprueft === saison) return;
    E.titelGeprueft = saison;
    const chronik = (LEAGUE.dflChronik || []).filter(c => c && c.meister != null && istIch(c.meister) && c.saison !== saison && c.saison >= saison - 4);
    if (chronik.length + 1 >= 3) erreiche('dynastie');
    try {
      const L = liga(), H = L && L.historie, eig = eigeneDfl();
      const vorher = H ? H.saisons.slice(-4) : [];
      if (vorher.some(x => x.platz && x.platz[eig] >= 22)) erreiche('keller');
    } catch (e) { /* Historie optional */ }
  }

  // Saisonwechsel: Saisonwertung, Preise, Hall of Fame, Vereinstreue
  function saisonWertung() {
    const E = zustand(); if (!E || !dfl()) return null;
    const vor = LEAGUE.season - 1, G = geraet(), k = karriereKey() + ':' + vor;
    if (E.wertung[vor] || G.wertungen[k]) return null;
    E.wertung[vor] = true; G.wertungen[k] = true; geraetSpeichern();
    const P = LEAGUE.dflPlayoffs;
    if (P && P.saison === vor) {
      const dabei = P.setzliste && Object.values(P.setzliste).some(l => (l || []).some(istIch));
      if (dabei) buchen(WERTUNG.playoffs, 'wertung', 'Playoffs erreicht', vor);
      if (istIch(P.meister)) { buchen(WERTUNG.meister, 'wertung', 'Meistertitel', vor); erreiche('meister'); titelErfolge(vor); }
    }
    try {
      const L = liga(), H = L && L.historie, eig = eigeneDfl();
      if (H && eig) {
        const n = H.saisons.length, neu = E.histN == null ? H.saisons.slice(-1) : H.saisons.slice(E.histN);
        E.histN = n;
        neu.forEach(x => {
          const pr = x.preise || {};
          Object.keys(PREISE).forEach(key => {
            if (pr[key] && pr[key].teamId === eig) {
              buchen(WERTUNG.preis, 'wertung', PREISE[key] + ': ' + pr[key].name, vor);
              if (key === 'spieler') erreiche('mvp'); if (key === 'tore') erreiche('torjaeger'); if (key === 'rookie') erreiche('rookie');
            }
          });
          if (pr.manager && pr.manager.teamId === eig) { buchen(WERTUNG.preis, 'wertung', 'Manager der Saison', vor); erreiche('manager'); }
        });
        const hof = H.hallOfFame || [], start = E.hofN == null ? hof.length : E.hofN;
        hof.slice(start).forEach(h => {
          const bei = h.teamId === eig || (h.vereine || []).indexOf(eig) >= 0 || E.gedraftet.indexOf(String(h.id)) >= 0;
          if (bei) erreiche('hof');
          if (E.gedraftet.indexOf(String(h.id)) >= 0) erreiche('legende');
        });
        E.hofN = hof.length;
      }
    } catch (e) { console.warn('[DFL-Erfolge] Preise', e); }
    const fid = CLUB.dfl.franchiseId;
    if (!E.seit || E.seit.verein !== fid) E.seit = { verein: fid, saison: vor };
    const jahre = LEAGUE.season - E.seit.saison;
    if (jahre >= 5) erreiche('treue5'); if (jahre >= 10) erreiche('treue10');
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
    if (!hatDom || !dfl()) return false;
    if (W.DFLSimulieren && safe(() => DFLSimulieren.aktiv())) return false;
    if (document.hidden || document.body.classList.contains('ts-offen') || startAktiv()) return false;
    if ([...document.querySelectorAll('#app-sheet.auf, #app-blatt.auf, .exp-overlay, .sw-briefing, .ef-ov')].some(sichtbar)) return false;
    const ok = /^(app-cta|app-nav|app-hinweis|toast-host|app-kopf|ef-pop)$/;
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
  // In der Zusammenfassung von „Simulieren bis …“: Tafel „Erfolge“
  function inSimZusammenfassung() {
    if (!hatDom || !Q.length) return false;
    const inhalt = document.getElementById('sim-inhalt');
    if (!inhalt || !document.querySelector('.sim-z-kopf') || inhalt.querySelector('.ef-sim') || !inhalt.querySelector('.sim-tafel')) return false;
    if (W.DFLSimulieren && safe(() => DFLSimulieren.laeuft())) return false;
    const liste = Q.splice(0), summe = liste.reduce((a, x) => a + x.wp, 0);
    inhalt.insertAdjacentHTML('afterbegin', `<section class="sim-tafel ef-sim"><h3 class="sim-h3">${ic('medal')} Erfolge · +${wpText(summe)}</h3>
      <ul class="ef-liste">${liste.map(x => `<li>${medaille(x.wp)}<span><b>${esc(x.name)}</b><small>${esc(x.text)}</small></span>${muenze('+' + x.wp)}</li>`).join('')}</ul></section>`);
    return true;
  }
  function pumpe() {
    if (!dfl()) return;
    if (inSimZusammenfassung()) return;
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
    const box = hatDom && document.querySelector('#app-blatt .app-blatt-box');
    if (box) {
      box.innerHTML = '<div class="app-griff"></div><button class="app-blatt-zu" type="button" aria-label="Schließen"><i class="ti ti-x" aria-hidden="true"></i></button>' + html;
      box.onclick = ev => { if (ev.target.closest('.app-blatt-zu')) zu(); else if (klick) klick(ev, box); };
      document.getElementById('app-blatt').classList.add('auf'); document.body.classList.add('app-gesperrt');
      return box;
    }
    if (!hatDom) return null;
    let ov = document.querySelector('.ef-ov'); if (ov) ov.remove();
    ov = document.createElement('div'); ov.className = 'ef-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = `<div class="ef-ov-box"><button class="app-blatt-zu" type="button" aria-label="Schließen"><i class="ti ti-x" aria-hidden="true"></i></button>${html}</div>`;
    ov.addEventListener('click', ev => { if (ev.target === ov || ev.target.closest('.app-blatt-zu')) zu(); else if (klick) klick(ev, ov.querySelector('.ef-ov-box')); });
    document.body.appendChild(ov);
    return ov.querySelector('.ef-ov-box');
  }
  function zu() {
    const b = hatDom && document.getElementById('app-blatt');
    if (b && b.classList.contains('auf')) { b.classList.remove('auf'); const s = document.getElementById('app-sheet'); if (!(s && s.classList.contains('auf'))) document.body.classList.remove('app-gesperrt'); }
    const ov = hatDom && document.querySelector('.ef-ov'); if (ov) ov.remove();
  }

  function uebersichtHtml() {
    const G = geraet(), n = LISTE.filter(e => G.erfolge[e.id]).length;
    const summe = LISTE.filter(e => G.erfolge[e.id]).reduce((a, e) => a + e.wp, 0), moeglich = LISTE.reduce((a, e) => a + e.wp, 0);
    return `<div class="ef-blatt"><div class="ef-kopf"><div><div class="app-sheet-titel">Erfolge</div><small>${n} von ${LISTE.length} · ${summe} von ${moeglich} Winpunkten</small></div>${muenze(G.konto)}</div>
      ${GRUPPEN.map(([g, name, icon]) => `<h3 class="ef-h3">${ic(icon)} ${name}</h3><ul class="ef-liste">${LISTE.filter(e => e.g === g).map(e => {
        const x = G.erfolge[e.id];
        return `<li class="${x ? 'ja' : 'nein'}">${medaille(e.wp, !x)}<span><b>${esc(e.name)}</b><small>${esc(e.text)}${x ? ` · ${esc(x.saison)}${x.verein ? ', ' + esc(x.verein) : ''}` : ''}</small></span>${muenze((x ? '+' : '') + e.wp)}</li>`;
      }).join('')}</ul>`).join('')}
      <div class="app-blatt-aktionen"><button type="button" class="app-knopf haupt" data-ef="laden">${ic('building-store')}Zum Laden</button></div></div>`;
  }
  function uebersicht() { return blatt(uebersichtHtml(), ev => { if (ev.target.closest('[data-ef="laden"]')) { zu(); if (W.DFLLaden) DFLLaden.oeffnen(); } }); }

  function bilanzHtml(s) {
    const E = zustand(), liste = (E && E.saisons[s]) || [], summe = liste.reduce((a, x) => a + x.wp, 0);
    const icon = x => (x.art === 'erfolg' ? 'medal' : /Meister/.test(x.text) ? 'trophy' : /Playoffs/.test(x.text) ? 'tournament' : 'award');
    return `<div class="ef-blatt ef-bilanz"><p class="ef-eyebrow">Saisonbilanz ${esc(label(s))}</p>
      <h2 class="ef-titel">Diese Saison: ${summe ? wpText(summe) : 'keine Winpunkte'}</h2>
      ${liste.length ? `<ul class="ef-liste">${liste.map(x => `<li><span class="ef-med ef-${x.art === 'erfolg' ? stufe(x.wp) : 'wertung'}" aria-hidden="true">${ic(icon(x))}</span><span><b>${esc(x.text)}</b><small>${x.art === 'erfolg' ? 'Erfolg' : 'Saisonwertung'}</small></span>${muenze('+' + x.wp)}</li>`).join('')}</ul>` : ''}
      <div class="ef-gesamt"><span>Kontostand</span>${muenze(konto())}</div>
      <div class="app-blatt-aktionen"><button type="button" class="app-knopf haupt" data-ef="laden">${ic('building-store')}Zum Laden</button><button type="button" class="app-knopf" data-ef="zu">Weiter</button></div></div>`;
  }
  function bilanz(s) {
    const E = zustand(); if (s == null && E) s = E.bilanzGezeigt != null ? E.bilanzGezeigt : LEAGUE.season - 1;
    return blatt(bilanzHtml(s), ev => {
      if (ev.target.closest('[data-ef="laden"]')) { zu(); if (W.DFLLaden) DFLLaden.oeffnen(); }
      else if (ev.target.closest('[data-ef="zu"]')) zu();
    });
  }

  // ── Office-Zähler und Mehr-Blatt ─────────────────────────────────────────
  function aktualisiereZaehler() {
    if (!hatDom) return;
    document.querySelectorAll('.ef-chip .ef-chip-n').forEach(n => { n.textContent = konto(); });
  }
  function zaehler() {
    if (!hatDom || !dfl()) return;
    const ziel = document.querySelector('#app-gelaende .gel-buehne') || document.getElementById('app-office-kopf') || document.getElementById('view-home');
    if (!ziel || ziel.querySelector('.ef-chip')) { aktualisiereZaehler(); return; }
    ziel.insertAdjacentHTML('afterbegin', `<button type="button" class="ef-chip" aria-label="Laden, ${wpText(konto())}"><span class="ef-muenze" aria-hidden="true">W</span><span class="ef-chip-n">${konto()}</span></button>`);
    ziel.querySelector('.ef-chip').addEventListener('click', ev => { ev.stopPropagation(); if (W.DFLLaden) DFLLaden.oeffnen(); else uebersicht(); });
  }
  function mehrEintraege() {
    const box = hatDom && document.querySelector('#app-sheet .app-sheet-box');
    if (!box || box.querySelector('.ef-eintrag')) return !!box;
    const eintrag = (cls, icon, titel, sub) => `<button class="app-eintrag ef-eintrag ${cls}" type="button">${ic(icon)}<span class="app-eintrag-txt"><b>${titel}</b><small>${sub}</small></span><i class="ti ti-chevron-right app-pfeil" aria-hidden="true"></i></button>`;
    const vor = box.querySelector('.app-eintrag');
    const html = eintrag('ef-e-erfolge', 'medal', 'Erfolge', `${LISTE.length} Erfolge mit Winpunkten`) + eintrag('ef-e-laden', 'building-store', 'Laden', 'Maskottchen, Vitrine, Pflanze, Cap +1 Mio') + (W.KSVitrine ? eintrag('ef-e-vitrine', 'trophy', 'Pokalvitrine', 'Deine Titel') : '');
    if (vor) vor.insertAdjacentHTML('beforebegin', html); else box.insertAdjacentHTML('beforeend', html);
    const auf = fn => ev => { ev.stopPropagation(); const s = document.getElementById('app-sheet'); if (s) s.classList.remove('auf'); fn(); };
    box.querySelector('.ef-e-erfolge').addEventListener('click', auf(uebersicht));
    box.querySelector('.ef-e-laden').addEventListener('click', auf(() => { if (W.DFLLaden) DFLLaden.oeffnen(); }));
    const v = box.querySelector('.ef-e-vitrine'); if (v) v.addEventListener('click', auf(() => KSVitrine.oeffnen()));
    return true;
  }

  // ── Einhängen ────────────────────────────────────────────────────────────
  {
    const _orig = W.recordResult;
    if (typeof _orig === 'function') {
      W.recordResult = function (teams, homeId, awayId, gh, ga) {
        const r = _orig.apply(this, arguments);
        if (dfl() && (homeId === 'fcm' || awayId === 'fcm')) {
          try { const heim = homeId === 'fcm'; spiel(heim ? gh : ga, heim ? ga : gh, heim ? awayId : homeId, teams); } catch (e) { console.warn('[DFL-Erfolge] Spiel', e); }
        }
        return r;
      };
      try { recordResult = W.recordResult; } catch (e) { /* window reicht */ }
    }
  }
  {
    const _orig = W.advanceCalendarWeek;
    if (typeof _orig === 'function') W.advanceCalendarWeek = function () {
      const r = _orig.apply(this, arguments);
      try { woche(); } catch (e) { console.warn('[DFL-Erfolge] Woche', e); }
      return r;
    };
  }
  {
    const _orig = W.postMatchContinue;
    if (typeof _orig === 'function') W.postMatchContinue = function () {
      const r = _orig.apply(this, arguments);
      try { woche(); } catch (e) { console.warn('[DFL-Erfolge] Spiel', e); }
      return r;
    };
  }
  {
    const _orig = W.startNewSeason;
    if (typeof _orig === 'function') W.startNewSeason = function () {
      const r = _orig.apply(this, arguments);
      try { saisonWertung(); } catch (e) { console.warn('[DFL-Erfolge] Saisonwertung', e); }
      return r;
    };
  }
  {
    const _orig = W.addNews;
    if (typeof _orig === 'function') {
      W.addNews = function (art, titel) {
        const r = _orig.apply(this, arguments);
        if (dfl() && art === 'transfer' && /Trade mit /.test(String(titel || ''))) {
          erreiche('trade1');
          try { const dl = (W.DFLHandel && DFLHandel.CFG.deadlineSpieltag) || 16; if ((LEAGUE.matchday || 0) === dl - 1) erreiche('deadline'); } catch (e) { /* optional */ }
        }
        return r;
      };
      try { addNews = W.addNews; } catch (e) { /* window reicht */ }
    }
  }
  if (hatDom) {
    const _orig = W.renderHomeTab;
    if (typeof _orig === 'function') {
      W.renderHomeTab = function () { const r = _orig.apply(this, arguments); try { zaehler(); } catch (e) { console.warn('[DFL-Erfolge] Zähler', e); } return r; };
      try { renderHomeTab = W.renderHomeTab; } catch (e) { /* window reicht */ }
    }
    setInterval(pumpe, 700);
    if (!mehrEintraege()) { let n = 0; const t = setInterval(() => { if (mehrEintraege() || ++n > 60) clearInterval(t); }, 1000); }
    setTimeout(() => { try { zaehler(); } catch (e) { /* Office noch nicht da */ } }, 1500);
  }

  W.DFLErfolge = { LISTE, GRUPPEN, WERTUNG, erreiche, buchen, ausgeben, konto, geraet, geraetSpeichern, neuLesen: () => { GER = null; return geraet(); }, zustand, spiel, woche, saisonWertung, uebersicht, bilanz, bilanzHtml,
    uebersichtHtml, warteschlange: () => Q, frei, pumpe, zu, blatt, muenze, wpText };
  console.log('[DFL-Erfolge v1] aktiv — ' + LISTE.length + ' Erfolge mit Pop-up, Winpunkte gerätweit (Konto ' + konto() + '), Saisonwertung und Saisonbilanz (D122, D159 d)');
})();
