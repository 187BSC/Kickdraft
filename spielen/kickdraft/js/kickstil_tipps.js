/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · TIPPS ZUR RICHTIGEN ZEIT  ·  v1   (2026-10-24, beide Spiele – gleiche Datei in kickdraft/spiel/js, auch in der Demo)
   ─────────────────────────────────────────────────────────────────────────
   Nutzer: „die Tutorials müssen übernommen werden und sogar noch einfacher und angepasster werden – wenn man auf was klickt, wenn
   manche Werte unter einen gewissen Threshold fallen wie Fitness, was man so machen kann, und dadurch noch im späteren Spielverlauf
   Erklärungen bekommt; das müsste in die Demo übernommen werden“ (Konzept freigegeben 2026-10-24).
   · Erster Klick: ein Satz beim ersten Besuch eines Bereichs (Kader, Training, Liga, Front Office/Transfers, Verein).
   · Schwellen: müde Spieler in der Elf, schlechte Moral, Verletzte in der Elf, Konto im Minus, Vertrag eines Stammspielers läuft
     aus, Kader zu klein – jeweils mit einem Knopf, der die Lösung öffnet.
   · Später: erstes Angebot, Rückrunde (Belohnen/Bestrafen wieder frei), Winterfenster, letzte Woche vor Fensterschluss.
   · Vereinskarriere: „Erster Tag“ (4 Stationen mit Markierung) nach der Vereinswahl – Kickdraft hat seinen eigenen (dfl_tutorial.js).
   Jeder Tipp einmal je Karriere (CLUB.ksTipps.g), Schwellen-Tipps dürfen nach 8 Wochen wiederkommen; höchstens ein Tipp je Woche
   (erste Klicks ausgenommen); nie über Spiel, Ticker, Fenstern oder Blättern. Aus: Mehr → Optionen bzw. localStorage gesamt-tipps = aus.
   Tests (navigator.webdriver) ohne Tipps, außer localStorage kst-test = an.
   API: KSTipps.zeigen(id) · .ersterTag() · .an(bool) · .liste
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const W = window;
  const KD = !!W.DFLSpiel || /\/kickdraft\//.test(location.pathname);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const lies = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const testlauf = () => !!navigator.webdriver && lies('kst-test') !== 'an';
  const an = () => lies('gesamt-tipps') !== 'aus' && !testlauf();
  const da = () => typeof CLUB !== 'undefined' && CLUB && typeof LEAGUE !== 'undefined' && LEAGUE && typeof SQUAD !== 'undefined' && Array.isArray(SQUAD);
  // irgendein Treffer sichtbar (ein verstecktes .exp-overlay davor darf ein offenes dahinter nicht verdecken)
  const sichtbar = sel => [...document.querySelectorAll(sel)].some(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).display !== 'none');
  const CFG = { wiederNachWochen: 8, muede: 70, moral: 55, kaderMin: KD ? 24 : 18, takt: 1500 };

  // ── Zustand ───────────────────────────────────────────────────────────────
  function zustand() { if (!CLUB.ksTipps) CLUB.ksTipps = { g: {}, w: -1 }; if (!CLUB.ksTipps.g) CLUB.ksTipps.g = {}; return CLUB.ksTipps; }
  const wochenIndex = () => (LEAGUE.season || 1) * 60 + (LEAGUE.week || 0);
  function gesehen(id, wieder) {
    const t = zustand().g[id]; if (t == null) return false;
    return !wieder || wochenIndex() - t < CFG.wiederNachWochen;
  }

  // ── Helfer für Knöpfe ─────────────────────────────────────────────────────
  function zeige(view) {
    try { if (W.DFLAppShell && DFLAppShell.zeige && document.getElementById('app-nav')) { DFLAppShell.zeige(view); return; } } catch (e) { /* weiter */ }
    try { if (typeof switchAppView === 'function') switchAppView(view, document.getElementById('nav-' + view) || document.createElement('button')); } catch (e) { /* ohne */ }
  }
  function training() {
    zeige('squad');
    setTimeout(() => { const t = [...document.querySelectorAll('button, [role=tab]')].find(x => x.getClientRects().length && /^\s*Training\s*$/.test(x.textContent)); if (t) t.click(); }, 250);
  }
  function leichtTrainieren() {
    if (!CLUB.training) CLUB.training = {};
    CLUB.training.intensity = 'leicht';
    try { if (typeof saveGameState === 'function') saveGameState(); } catch (e) { /* Tests */ }
    training();
  }
  const eigen = () => SQUAD.filter(p => p && !p.onLoanAt);
  function elf() { try { return (getLineupIds() || []).map(getPlayer).filter(Boolean); } catch (e) { return []; } }
  const name = p => (typeof displayName === 'function' ? displayName(p) : p.name);
  const namen = l => l.length > 2 ? `${l.slice(0, 2).map(name).join(', ')} und ${l.length - 2} ${l.length - 2 === 1 ? 'weiterer' : 'weitere'}` : l.map(name).join(' und ');
  const verletzt = p => (typeof isInjured === 'function' ? isInjured(p) : (p.injuryWeeks || 0) > 0);
  const fensterInfo = () => { try { return typeof transferWindowInfo === 'function' ? transferWindowInfo(LEAGUE.week) : null; } catch (e) { return null; } };
  const halbzeitSaison = () => { const n = (LEAGUE.matchWeeks || []).length; return n && (LEAGUE.matchday || 0) >= Math.ceil(n / 2); };

  // ── Katalog ───────────────────────────────────────────────────────────────
  // art: 'klick' (erster Besuch, wenn: aktive Ansicht), 'schwelle' (darf wiederkommen), 'spaeter' (einmal)
  const TIPPS = [
    { id: 'k-kader', art: 'klick', icon: 'ti-users', titel: 'Kader', ansicht: 'squad',
      text: 'Aufstellung, Spieler und Training. Der Balken unter dem Namen ist die Kraft, die Zahl die Stärke.' },
    { id: 'k-liga', art: 'klick', icon: 'ti-trophy', titel: 'Liga', ansicht: 'liga',
      text: KD ? 'Tabelle, Spielplan und das Playoff-Bild deiner Conference.' : 'Tabelle, Spielplan und Pokal. Die farbigen Zonen zeigen Auf- und Abstieg.' },
    { id: 'k-fo', art: 'klick', icon: 'ti-briefcase', titel: 'Front Office', ansicht: KD ? 'fo' : 'transfer',
      text: KD ? 'Trades, Free Agency, Draft und Anlagen – hier baust du die Franchise.' : 'Transfers, Scouting, Verein und Finanzen – hier baust du den Verein.' },
    { id: 'k-verein', art: 'klick', icon: 'ti-building-stadium', titel: 'Verein', ansicht: 'club',
      text: 'Ausbau kostet heute Geld und bringt auf Dauer mehr Einnahmen.' },
    { id: 's-muede', art: 'schwelle', icon: 'ti-battery-2', titel: 'Müde Spieler',
      wenn: () => { const l = elf().filter(p => (p.fitness == null ? 100 : p.fitness) < CFG.muede && !verletzt(p)); return l.length >= 2 ? l : null; },
      text: l => `${namen(l)} sind müde. Müde Spieler spielen schwächer und verletzen sich leichter.`,
      knoepfe: [['Leichter trainieren', leichtTrainieren], ['Auf die Bank', () => zeige('squad')]] },
    { id: 's-moral', art: 'schwelle', icon: 'ti-mood-sad', titel: 'Stimmung im Keller',
      wenn: () => (typeof W.teamMorale === 'function' && W.teamMorale() < CFG.moral) || null,
      text: () => 'Die Moral der Elf ist schlecht. Das kostet Stärke im Spiel.',
      knoepfe: [['Belohnen', () => { training(); setTimeout(() => W.KSBelohnung && KSBelohnung.oeffnen('b'), 450); }]] },
    { id: 's-verletzt', art: 'schwelle', icon: 'ti-first-aid-kit', titel: 'Verletzt in der Elf',
      wenn: () => { const l = elf().filter(verletzt); return l.length ? l : null; },
      text: l => `${namen(l)} ${l.length > 1 ? 'stehen' : 'steht'} verletzt in der Aufstellung.`,
      knoepfe: [['Zur Aufstellung', () => zeige('squad')]] },
    { id: 's-minus', art: 'schwelle', icon: 'ti-coin-off', titel: 'Konto im Minus',
      wenn: () => (CLUB.budget || 0) < 0 || null,
      text: () => 'Das Konto ist im Minus. Verkaufe Spieler oder spare an Gehältern.',
      knoepfe: [[KD ? 'Zum Front Office' : 'Zu den Finanzen', () => zeige(KD ? 'fo' : 'club')]] },
    { id: 's-vertrag', art: 'schwelle', icon: 'ti-file-alert', titel: 'Vertrag läuft aus',
      wenn: () => { if (!halbzeitSaison()) return null; const l = elf().filter(p => p.contractUntil != null && p.contractUntil <= (LEAGUE.season || 1)); return l.length ? l : null; },
      text: l => `Der Vertrag von ${namen(l)} endet nach dieser Saison.`,
      knoepfe: [['Zu den Verträgen', () => zeige('squad')]] },
    { id: 's-kader', art: 'schwelle', icon: 'ti-users-minus', titel: 'Kader zu klein',
      wenn: () => eigen().length < CFG.kaderMin || null,
      text: () => `Nur ${eigen().length} Spieler im Kader. Verletzungen und Sperren werden dann schnell zum Problem.`,
      knoepfe: [[KD ? 'Free Agency' : 'Zum Transfermarkt', () => zeige(KD ? 'fo' : 'transfer')]] },
    { id: 'p-angebot', art: 'spaeter', icon: 'ti-mail', titel: 'Erstes Angebot', nurFL: true,
      wenn: () => (CLUB.transferBids || []).length || null,
      text: () => 'Ein Verein will einen deiner Spieler. Du findest das Angebot im Postfach: annehmen, verhandeln oder ablehnen.',
      knoepfe: [['Zum Postfach', () => zeige('home')]] },
    { id: 'p-rueckrunde', art: 'spaeter', icon: 'ti-refresh', titel: 'Rückrunde',
      wenn: () => halbzeitSaison() || null, schluessel: () => 'p-rueckrunde-' + (LEAGUE.season || 1),
      text: () => 'Neue Halbserie: Belohnen und Bestrafen sind wieder frei.',
      knoepfe: [['Zum Training', training]] },
    { id: 'p-winter', art: 'spaeter', icon: 'ti-snowflake', titel: 'Winterfenster offen', nurFL: true,
      wenn: () => { const f = fensterInfo(); return (f && f.open && f.type === 'Winter') || null; }, schluessel: () => 'p-winter-' + (LEAGUE.season || 1),
      text: () => 'Das Transferfenster ist bis zum Deadline-Day offen.',
      knoepfe: [['Zum Transfermarkt', () => zeige('transfer')]] },
    { id: 'p-deadline', art: 'spaeter', icon: 'ti-clock', titel: 'Letzte Woche', nurFL: true,
      wenn: () => { const f = fensterInfo(); const w = LEAGUE.week; return (f && f.open && (w === 8 || w === 29)) || null; }, schluessel: () => 'p-deadline-' + (LEAGUE.season || 1) + '-' + LEAGUE.week,
      text: () => 'Nächste Woche ist Deadline-Day – danach sind Käufe erst im nächsten Fenster möglich.',
      knoepfe: [['Zum Transfermarkt', () => zeige('transfer')]] }
  ].filter(t => !(t.nurFL && KD));

  // ── Anzeige ───────────────────────────────────────────────────────────────
  const CSS = `
  #kst-tipp{position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 10px);transform:translate(-50%,-140%);z-index:9000;width:min(520px,calc(100vw - 24px));
    display:grid;grid-template-columns:34px minmax(0,1fr) auto;gap:4px 10px;align-items:start;padding:12px 14px;border-radius:16px;
    background:var(--bg2,#fffdf9);color:var(--text,#2c2418);border:3px solid var(--gold,#e8b923);box-shadow:0 4px 0 var(--k-rand,#8a5a2b),0 10px 30px rgb(0 0 0 / .18);
    transition:transform .32s cubic-bezier(.2,.9,.3,1.2)}
  #kst-tipp.auf{transform:translate(-50%,0)}
  #kst-tipp > i{font-size:26px;color:var(--gold-text,#a77b00);grid-column:1;grid-row:1 / span 2}
  #kst-tipp > div:not(.kst-knoepfe){grid-column:2;grid-row:1;min-width:0}
  #kst-tipp b{display:block;font-size:15px} #kst-tipp p{margin:2px 0 0;font-size:13.5px;line-height:1.4;color:var(--text2,#5c4a36)}
  #kst-tipp .kst-zu{grid-column:3;grid-row:1;border:0;background:none;color:var(--text2,#6b5a43);font-size:18px;cursor:pointer;padding:0 2px}
  #kst-tipp .kst-knoepfe{grid-column:2 / -1;grid-row:2;display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
  #kst-tipp .kst-knoepfe button{font-size:13px;padding:6px 12px}
  #kst-tipp small.kst-schritt{display:block;margin-bottom:2px;font-size:11.5px;font-weight:800;color:var(--text3,#846d52);letter-spacing:.06em;text-transform:uppercase}
  body.pcu-an #kst-tipp{left:auto;right:24px;transform:translateY(-140%);top:auto;bottom:24px} body.pcu-an #kst-tipp.auf{transform:none}
  .kst-ziel{position:relative;z-index:8999;outline:3px solid var(--gold,#e8b923)!important;outline-offset:3px;border-radius:12px;animation:kst-puls 1.4s ease-in-out infinite}
  @keyframes kst-puls{50%{outline-offset:7px}}
  @media (prefers-reduced-motion:reduce){#kst-tipp{transition:none}.kst-ziel{animation:none}}`;
  function stil() { if (document.getElementById('kst-css')) return; const s = document.createElement('style'); s.id = 'kst-css'; s.textContent = CSS; document.head.appendChild(s); }
  let EL = null, ZIEL = null, offen = null;
  function zielWeg() { if (ZIEL) ZIEL.classList.remove('kst-ziel'); ZIEL = null; }
  // Nach dem X: diese Woche kein weiterer Tipp und ein paar Sekunden gar keiner – sonst wirkt es, als ginge das Fenster nicht weg
  let ZU = 0;
  function ruheNachZu() { ZU = Date.now(); try { if (da()) zustand().w = wochenIndex(); } catch (e) { /* ohne */ } }
  function schliessen() { if (EL) EL.classList.remove('auf'); zielWeg(); const o = offen; offen = null; if (o && o.danach) o.danach(); }
  function karte(t, opt) {
    stil(); opt = opt || {};
    if (!EL) {
      EL = document.createElement('div'); EL.id = 'kst-tipp'; EL.setAttribute('role', 'status');
      EL.addEventListener('click', ev => {
        const b = ev.target.closest('button'); if (!b) return;
        if (b.classList.contains('kst-zu')) { if (offen && offen.abbruch) offen.abbruch(); schliessen(); ruheNachZu(); return; }
        const i = +b.dataset.k, k = offen && offen.knoepfe && offen.knoepfe[i];
        const o = offen; schliessen();
        if (k) try { k[1](); } catch (e) { console.warn('[Kickstil-Tipps] Knopf', e); }
        if (o && o.weiter && b.dataset.weiter) o.weiter();
      });
      document.body.appendChild(EL);
    }
    offen = opt;
    offen.knoepfe = opt.knoepfe || t.knoepfe || [];
    const text = typeof t.text === 'function' ? t.text(opt.daten) : t.text;
    EL.innerHTML = `<i class="ti ${t.icon}" aria-hidden="true"></i><div>${opt.schritt ? `<small class="kst-schritt">${esc(opt.schritt)}</small>` : ''}<b>${esc(t.titel)}</b><p>${esc(text)}</p></div>
      <button type="button" class="kst-zu" aria-label="Schließen"><i class="ti ti-x" aria-hidden="true"></i></button>
      ${offen.knoepfe.length || opt.weiterText ? `<div class="kst-knoepfe">${offen.knoepfe.map((k, i) => `<button type="button" class="app-knopf" data-k="${i}">${esc(k[0])}</button>`).join('')}${opt.weiterText ? `<button type="button" class="app-knopf" data-weiter="1">${esc(opt.weiterText)}</button>` : ''}</div>` : ''}`;
    zielWeg();
    if (opt.ziel) { ZIEL = opt.ziel; ZIEL.classList.add('kst-ziel'); }
    requestAnimationFrame(() => EL.classList.add('auf'));
  }
  const auf = () => !!(EL && EL.classList.contains('auf'));

  // Nie über Spiel, Ticker, Fenstern, Blättern, Tour oder einem anderen Tipp
  function blockiert() {
    if (auf() || sichtbar('#ks-tipp.auf') || sichtbar('#ks-neu.auf')) return true;
    if (document.body.classList.contains('ts-offen') || document.body.classList.contains('app-gesperrt')) return true;
    const sel = ['#onboarding-overlay', '#intro-overlay', '#ks-saisonende', '.exp-overlay', '.exp-gameover', '#ks-dl', '.dfl-draft-ov', '#kstr-gruss', '#kstr-ed',
      '#pcsi-blatt', '#pkf-einst', '#pkf-suche', '#pkf-vergleich', '#pm-overlay', '#dfl-ts:not([hidden])', '#app-blatt.auf', '#app-sheet.auf', '.st-ov', '.tut-ov', '.tut-blase', '.tut-loch', '.tut-blatt', '#dfl-sim:not([hidden])', '#ks-sim:not([hidden])'];
    if (sel.some(sichtbar)) return true;
    return [...document.body.children].some(e => e !== EL && !/^app-(nav|cta|kopf)$/.test(e.id) && getComputedStyle(e).position === 'fixed' && e.offsetWidth > 300 && e.offsetHeight > 300 && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).pointerEvents !== 'none' && +getComputedStyle(e).opacity > 0.1);
  }
  function aktiveAnsicht() { const v = document.querySelector('.app-view.active, [id^="view-"].active'); return v ? v.id.replace(/^view-/, '') : null; }

  function pruefen() {
    if (!an() || !da() || !LEAGUE.season || ERSTER.laeuft || Date.now() - ZU < 6000 || blockiert()) return;
    const z = zustand();
    // erste Klicks: sofort
    const v = aktiveAnsicht();
    // Kickdraft erklärt die Bereiche schon in seiner Tour (dfl_tutorial.js) – dort keine Erklärung beim ersten Klick
    // (2026-10-24: Tipp-Karte und Tour lagen gleichzeitig offen; X schloss nur die Karte, die Tour blieb stehen)
    const k = KD ? null : TIPPS.find(t => t.art === 'klick' && t.ansicht === v && !gesehen(t.id));
    if (k) { z.g[k.id] = wochenIndex(); karte(k); return; }
    // sonst höchstens einer je Woche
    if (z.w === wochenIndex()) return;
    for (const t of TIPPS) {
      if (t.art === 'klick') continue;
      const id = t.schluessel ? t.schluessel() : t.id;
      if (gesehen(id, t.art === 'schwelle')) continue;
      let d = null; try { d = t.wenn(); } catch (e) { d = null; }
      if (!d) continue;
      z.g[id] = wochenIndex(); z.w = wochenIndex();
      karte(t, { daten: d });
      return;
    }
  }

  // ── Erster Tag (nur Vereinskarriere) ─────────────────────────────────────
  const ERSTER = { laeuft: false };
  const STATIONEN = [
    { icon: 'ti-users', titel: 'Dein Kader', text: 'Hier stellst du die Elf auf und steuerst das Training.', ziel: ['#app-nav [data-nav="squad"]', '#app-nav [data-nav="kader"]', '#nav-squad'] },
    { icon: 'ti-player-play', titel: 'Weiter spielen', text: 'Dieser Knopf bringt dich Woche für Woche zum nächsten Spiel.', ziel: ['#app-cta', '#pcu-weiter', '.cal-next', '#calendar-widget button'] },
    { icon: 'ti-mail', titel: 'Postfach', text: 'Angebote, Nachrichten und Entscheidungen landen hier.', ziel: ['.postfach-section', '#pf-filters', '.home-postfach'] },
    { icon: 'ti-briefcase', titel: 'Front Office', text: 'Transfers, Scouting, Verein und Finanzen.', ziel: ['#app-nav [data-nav="fo"]', '#nav-transfer', '.appnav-btn[data-pcu="transfer"]'] }
  ];
  // Kader und Front Office hat der Erste Tag schon gezeigt – kein zweiter Tipp beim ersten Klick
  function ersterTagFertig() { const z = zustand(); z.ersterTag = 1; ['k-kader', 'k-fo'].forEach(id => { if (z.g[id] == null) z.g[id] = wochenIndex(); }); z.w = wochenIndex(); }
  function zielFinden(l) { for (const s of l) { const e = document.querySelector(s); if (e && e.getClientRects().length) return e; } return null; }
  function ersterTag(i) {
    i = i || 0;
    const s = STATIONEN[i]; if (!s) { ERSTER.laeuft = false; ersterTagFertig(); return; }
    // Fenster dazwischen (Philosophie, Sponsor, Trainer …): später an dieser Station weitermachen
    if (blockiert()) { ERSTER.laeuft = false; zustand().ersterSchritt = i; return; }
    ERSTER.laeuft = true;
    if (i === 0) zeige('home');
    const z = zielFinden(s.ziel);
    if (z) try { z.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { /* ohne */ }
    karte(s, { ziel: z, schritt: `Erster Tag · ${i + 1} von ${STATIONEN.length}`, knoepfe: [], weiterText: i < STATIONEN.length - 1 ? 'Weiter' : 'Los geht\'s',
      weiter: () => setTimeout(() => ersterTag(i + 1), 250), abbruch: () => { ERSTER.laeuft = false; ersterTagFertig(); } });
  }
  function ersterTagPruefen() {
    if (KD || !an() || !da() || ERSTER.laeuft) return;
    if (blockiert()) { ERSTER.ruhig = 0; return; }
    const z = zustand();
    if (z.ersterTag || (LEAGUE.season || 1) > 1 || (LEAGUE.matchday || 0) > 0) { z.ersterTag = z.ersterTag || 1; return; }
    if (blockiert() || aktiveAnsicht() !== 'home') return;
    // erst wenn die Startfenster zwei Takte lang zu sind (sie öffnen nacheinander)
    ERSTER.ruhig = (ERSTER.ruhig || 0) + 1; if (ERSTER.ruhig < 3) return;
    ersterTag(z.ersterSchritt || 0);
  }

  // ── Takt ──────────────────────────────────────────────────────────────────
  function takt() { try { ersterTagPruefen(); pruefen(); } catch (e) { console.warn('[Kickstil-Tipps]', e); } }
  function start() { setInterval(takt, CFG.takt); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  W.KSTipps = { liste: TIPPS, CFG, zeigen: id => { const t = TIPPS.find(x => x.id === id); if (t) { let d = null; try { d = t.wenn ? t.wenn() : null; } catch (e) { d = null; } karte(t, { daten: d || [] }); } },
    ersterTag: () => ersterTag(0), an: v => { try { localStorage.setItem('gesamt-tipps', v ? 'an' : 'aus'); } catch (e) { /* ohne */ } }, zuruecksetzen: () => { if (da()) CLUB.ksTipps = { g: {}, w: -1 }; } };
  console.log('[Kickstil-Tipps v1] aktiv — Tipps beim ersten Klick, bei Schwellen (Fitness, Moral …) und im Saisonverlauf' + (KD ? '' : ', Erster Tag'));
})();
