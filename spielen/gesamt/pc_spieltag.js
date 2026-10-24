/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · SPIELTAG AM PC  ·  v3   (Nutzer 2026-10-18: „nimm das, was schon in der APK drin ist … rechts und links die
   Aufstellungen“ – „sieht noch sehr scheiße aus … dass das auch nutzbar ist“ – „jetzt müssen Wechsel funktionieren, die
   Müdigkeit muss erkennbar sein … auch unten die Ansagen fehlen, die müssen wieder rein“)
   ─────────────────────────────────────────────────────────────────────────
   NUR IN DER PC-VERSION (window.FcmPc aus pc_app/preload.js; Nutzer: „am Handy soll sich nichts ändern“) und ab 1200 px
   Fensterbreite. App und Browser bleiben unverändert; zum Testen im Browser localStorage „pcs-test“ = „an“.
   1) ANSICHT: der Ticker aus der App (#dfl-ts) auf voller Breite – Kopf, große Anzeigetafel; links Heimelf, rechts Gäste (nach
      Mannschaftsteilen, Gesicht, Stärke, Kraftbalken, live Tore/Karten/Wechsel); Mitte Druckleiste, Ticker, Spielfeld + Zahlen;
      unten die Ansagen und die Steuerung.
   2) LIVE-COACHING: Am PC wird das eigene Spiel nicht mehr beim Anpfiff fertig gerechnet, sondern in Abschnitten von 3 Minuten,
      kurz bevor der Ticker sie zeigt (MatchEngineV3 stopBei/weiterBis). Dazwischen wirken Eingriffe in der Engine:
        · Wechsel: Bankspieler, dann Feldspieler anklicken → bei der nächsten Unterbrechung (wechselAusfuehren), höchstens 5,
          kein Torwartwechsel. „Selbst coachen“ schaltet die automatischen Wechsel der eigenen Elf ab; „Co-Trainer“ lässt sie an.
        · Ansagen (je 10 Minuten, danach 5 Minuten Pause): Anfeuern (Abschlüsse +8 %), Anschreien (gelingt je nach Lage und
          Menschenführung: +18 %, sonst −10 %).
        · Ausrichtung (bleibt, Tasten 1–5): Mauern / Defensiv / Ausgewogen / Offensiv / Brechstange – Block −10 … +10 m,
          eigene Abschlüsse ×0,85 … ×1,18, gegnerische ×0,82 … ×1,18, Kraftverbrauch ×0,95 … ×1,25.
        · Leertaste = Pause/Weiter. Schließen/Neuladen der PC-App: Live-Spiel wird zu Ende gerechnet, gebucht, gespeichert.
        · Halbzeit: der Ticker hält an, damit gewechselt und angesagt werden kann.
      Gebucht wird erst nach dem Abpfiff über den normalen Weg (simulateCurrentFixture → runV3 → Engine gibt das vorgerechnete
      Spiel zurück, opt.vorgerechnet); der Ticker lädt das gebuchte Spiel an derselben Stelle (window.__tsLiveBuchen) – Nachspiel
      (Verlängerung/Elfmeter) läuft danach normal. „Sofort“ rechnet den Rest ohne weitere Eingriffe.
      Nicht live: „Simulieren bis …“, Ticker aus, Playoffs, schmales Fenster – dort wie bisher in einem Zug.
   Festgehalten in gesamt_app/pc_spezifisch.md.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const CFG = { breite: 1200, takt: 400, abschnitt: 180, halbzeit: 2700, vorrat: 3, maxWechsel: 5, ansageDauer: 600, ansagePause: 300 };
  const W = window;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const istPc = () => { if (W.FcmPc) return true; try { return localStorage.getItem('pcs-test') === 'an'; } catch (e) { return false; } };
  const mq = W.matchMedia ? W.matchMedia(`(min-width: ${CFG.breite}px)`) : null;
  const breit = () => istPc() && !!(mq && mq.matches);
  const TEIL = pos => /TW|GK/.test(pos) ? 'tw' : /IV|AV|RV|LV|LIB/.test(pos) ? 'abw' : /ST|FL|RF|LF|MS/.test(pos) ? 'ang' : 'mit';
  const TEILNAME = { tw: 'Tor', abw: 'Abwehr', mit: 'Mittelfeld', ang: 'Angriff' };
  const tief = r => { let x = r, n = 0; while (x && x._ref && n++ < 6) x = x._ref; return x || r; };
  const voll = r => r ? (r.firstName ? r.firstName + ' ' : '') + (r.name || '') : '';
  const vollX = x => (x.v ? x.v + ' ' : '') + x.n;
  const minVon = sek => Math.min(90, Math.floor(sek / 60) + 1) + "'";

  const CSS = `
  #dfl-ts.pcs-an{padding:0 24px}
  #dfl-ts.pcs-an .ts-box{max-width:1500px;display:grid;
    grid-template-columns:clamp(250px,18vw,300px) minmax(0,1fr) clamp(360px,26vw,430px) clamp(250px,18vw,300px);
    grid-template-rows:auto auto auto auto minmax(0,1fr) auto auto;
    /* Steuerpult rechts unter Feld und Zahlen statt drei Leisten unten (2026-10-24, Nutzer: „die Leisten sind nicht dafür gemacht“) */
    grid-template-areas:"kopf kopf kopf kopf" "anz anz anz anz" "links druck druck rechts" "links hinweis lage rechts" "links ticker lage rechts" "links ticker ansagen rechts" "links ticker steuer rechts"}
  #dfl-ts.pcs-an .ts-kopf{padding-top:6px;padding-bottom:6px;min-height:0}
  #dfl-ts.pcs-an .ts-kopf .ts-wappen{width:24px;height:26px}
  #dfl-ts.pcs-an .ts-kopf-txt b{font-size:14px} #dfl-ts.pcs-an .ts-kopf-txt small{font-size:11px}
  #dfl-ts.pcs-an .ts-kopf{grid-area:kopf} #dfl-ts.pcs-an .ts-anzeige{grid-area:anz;padding:6px 24px}
  #dfl-ts.pcs-an .ts-druck{grid-area:druck;border-bottom:none;padding:6px 16px 2px}
  #dfl-ts.pcs-an .ts-druck svg{height:36px}
  #dfl-ts.pcs-an .ts-hinweis{grid-area:hinweis;margin:8px 8px 0 16px}
  #dfl-ts.pcs-an .ts-ticker{grid-area:ticker;padding:10px 8px 16px 16px}
  #dfl-ts.pcs-an .ts-lagebild{grid-area:lage;display:flex;flex-direction:column;align-items:stretch;gap:12px;padding:10px 16px 6px 8px;overflow-y:auto;min-height:0}
  #dfl-ts.pcs-an .ts-live{gap:5px;font-size:13px}
  #dfl-ts.pcs-an .ts-steuer{grid-area:steuer;justify-content:stretch;padding:0 16px 14px 8px;border-top:none}
  #dfl-ts.pcs-an .ts-tempo{flex:1 1 auto}
  #dfl-ts.pcs-an .ts-bericht{inset:0;align-items:center}
  #dfl-ts.pcs-an .ts-bericht > *{width:min(560px,100%)}
  #dfl-ts.pcs-an .ts-team{font-size:19px;gap:12px}
  #dfl-ts.pcs-an .ts-team .ts-wappen-k{width:32px!important;height:37px!important}
  #dfl-ts.pcs-an .ts-team .pcs-voll{display:block;font:700 12px/1.2 var(--font-text,inherit);color:var(--text2,#5c4a36);letter-spacing:0}
  #dfl-ts.pcs-an .ts-team.g .pcs-teamtxt{text-align:right}
  #dfl-ts.pcs-an .ts-stand{font-size:34px;padding:2px 18px;min-width:120px}
  #dfl-ts.pcs-an .ts-uhr{font-size:13px;padding:2px 12px}
  #dfl-ts.pcs-an .ts-tore{font-size:13px}
  /* Mannschaften */
  .pcs-team{display:none;min-height:0;overflow-y:auto;background:var(--bg2,#fffdf9);padding:8px 10px 12px;scrollbar-width:thin}
  #dfl-ts.pcs-an .pcs-team{display:block}
  .pcs-team.links{grid-area:links;border-right:3px solid var(--ts-linie)} .pcs-team.rechts{grid-area:rechts;border-left:3px solid var(--ts-linie)}
  .pcs-tk{display:flex;align-items:center;gap:10px;padding-bottom:6px;margin-bottom:2px;border-bottom:3px solid var(--pcs-farbe)}
  .pcs-tk .ts-wappen-k{width:30px!important;height:34px!important;flex:none}
  .pcs-tk-txt{min-width:0;flex:1}
  .pcs-tk-txt b{display:block;font:800 15px/1.15 var(--font-display,inherit);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .pcs-tk-txt small{font-size:11.5px;font-weight:700;color:var(--text2,#5c4a36)}
  .pcs-teil{font-size:10px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--text3,#846d52);margin:6px 0 2px;display:flex;justify-content:space-between}
  .pcs-sp{display:grid;grid-template-columns:24px minmax(0,1fr) auto 24px;align-items:center;gap:4px 8px;padding:2px 4px;border-radius:9px;min-height:30px;border:2px solid transparent}
  .pcs-sp:nth-of-type(odd){background:color-mix(in srgb,var(--bg3,#f6ead2) 55%,transparent)}
  .pcs-sp.raus{opacity:.5}
  .pcs-klickbar .pcs-sp[data-wahl]{cursor:pointer} .pcs-klickbar .pcs-sp[data-wahl]:hover{border-color:var(--ts-linie)}
  .pcs-sp.gewaehlt{border-color:var(--ts-blau,#2c7cb5)!important;background:color-mix(in srgb,var(--ts-blau,#2c7cb5) 14%,transparent)!important}
  .pcs-sp.geplant{border-style:dashed;border-color:var(--ts-blau,#2c7cb5)}
  .pcs-gs{width:24px;height:24px;border-radius:50%;overflow:hidden;background:var(--bg3,#f6ead2);border:2px solid var(--pcs-farbe);display:grid;place-items:center}
  .pcs-gs svg{width:100%;height:100%;display:block}
  .pcs-nm{min-width:0;line-height:1.15}
  .pcs-nm b{display:block;font-size:12.5px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .pcs-nm small{font-size:10.5px;font-weight:700;color:var(--text3,#846d52)}
  .pcs-ev{display:flex;gap:3px;align-items:center;justify-content:flex-end;flex-wrap:wrap;max-width:96px}
  .pcs-e{display:inline-flex;align-items:center;gap:2px;font-size:10.5px;font-weight:800;font-variant-numeric:tabular-nums;border-radius:6px;padding:1px 4px;line-height:1.4;white-space:nowrap}
  .pcs-e.tor{background:var(--ts-gruen,#2fb36b);color:var(--ts-gruen-text,#0b1a12)}
  .pcs-e.gelb::before,.pcs-e.rot::before{content:'';width:8px;height:11px;border-radius:2px;background:var(--ts-gelb,#f2c14e)}
  .pcs-e.rot::before{background:var(--ts-rot,#e24b4a)}
  .pcs-e.aus{color:var(--ts-schlecht-fg,#a52a1e)} .pcs-e.ein{color:var(--ts-gut,#3d9a2a)}
  .pcs-ov{font-size:13px;font-weight:800;text-align:right;font-variant-numeric:tabular-nums;color:var(--text2,#5c4a36)}
  .pcs-nm small{display:flex;align-items:center;gap:6px}
  .pcs-kraft{flex:1;display:flex;align-items:center;gap:5px;font-size:10px;font-weight:800;color:var(--text3,#846d52);font-variant-numeric:tabular-nums;min-width:0}
  .pcs-kraft i{flex:1;height:5px;border-radius:5px;background:color-mix(in srgb,var(--ts-linie) 55%,transparent);overflow:hidden;display:block;max-width:90px}
  .pcs-kraft i b{display:block;height:100%;border-radius:5px;background:var(--ts-gut,#3d9a2a)}
  .pcs-kraft.mittel i b{background:var(--ts-mittel,#d29a0c)} .pcs-kraft.mittel{color:var(--ts-mittel-fg,#7a5800)}
  .pcs-kraft.leer i b{background:var(--ts-schlecht,#d0402f)} .pcs-kraft.leer{color:var(--ts-schlecht-fg,#a52a1e)}
  .pcs-leer{font-size:12px;color:var(--text3,#846d52);padding:4px}
  .pcs-wechselinfo{font-size:12px;line-height:1.4;margin:8px 0 2px;padding:8px 10px;border-radius:10px;background:var(--bg3,#f6ead2);border:2px dashed var(--ts-linie)}
  .pcs-wechselinfo button{margin-left:6px}
  /* Ansagen */
  .pcs-ansagen{grid-area:ansagen;display:none;flex-wrap:wrap;gap:6px;align-content:flex-start;margin:0 16px 8px 8px;padding:10px;background:var(--bg2,#fffdf9);border:3px solid var(--ts-rand);border-radius:14px;box-shadow:0 3px 0 var(--ts-rand)}
  #dfl-ts.pcs-an .pcs-ansagen.an{display:flex}
  .pcs-ansagen .pcs-t{flex:1 0 100%;margin:4px 0 0;font-size:10.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--text3,#846d52)}
  .pcs-ansagen .pcs-trenn,.pcs-ansagen .pct-umbruch{display:none!important}
  .pcs-ansagen .pct-auf{flex:1 0 100%;justify-content:center}
  .pcs-ansagen .pct-zurufe{flex:1 0 100%;display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
  .pcs-ansagen .pcs-knopf{padding:6px 8px;font-size:12px;justify-content:center}
  .pcs-ansagen .pcs-status{flex:1 0 100%;font-size:11.5px} .pcs-ansagen .pcs-status:empty{display:none}
  .pcs-ansagen .pcs-stufen{flex:1 0 100%;display:grid;grid-template-columns:repeat(5,1fr)}
  .pcs-ansagen .pcs-stufen .pcs-stufe{padding:6px 2px;font-size:11px}
  .pcs-ansagen [data-coach]{flex:1 1 0}
  .pcs-knopf{font:800 13px var(--font-text,inherit);color:var(--text,#2c3e50);background:var(--bg3,#f6ead2);border:3px solid var(--ts-rand);border-radius:12px;box-shadow:0 3px 0 var(--ts-rand);padding:7px 12px;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
  .pcs-knopf:active{transform:translateY(2px);box-shadow:0 1px 0 var(--ts-rand)}
  .pcs-knopf:disabled{opacity:.45;cursor:not-allowed;transform:none;box-shadow:0 3px 0 var(--ts-rand)}
  .pcs-knopf.an{background:var(--ts-blau,#2c7cb5);color:#fff} .pcs-knopf.an:disabled{opacity:1}
  .pcs-trenn{width:3px;align-self:stretch;background:var(--ts-linie);border-radius:3px;margin:0 4px}
  .pcs-status{font-size:12px;color:var(--text2,#5c4a36);min-width:0;flex:1 1 140px}
  .pcs-stufen{display:inline-flex;border:3px solid var(--ts-rand);border-radius:12px;overflow:hidden;box-shadow:0 3px 0 var(--ts-rand)}
  .pcs-stufen .pcs-stufe{border:0;border-radius:0;box-shadow:none;border-left:2px solid var(--ts-linie);padding:7px 10px}
  .pcs-stufen .pcs-stufe:first-child{border-left:0}
  .pcs-stufen .pcs-stufe:active{transform:none}
  .pcs-status b{color:var(--text,#2c3e50)}`;

  // ── Live-Coaching ──────────────────────────────────────────────────────────
  let LIVE = null, RUECKGABE = null, zuletzt = '';
  const E3 = () => W.MatchEngineV3;
  const tsUi = () => (W.DFLTextspiel && W.DFLTextspiel.ui) || null;
  const coachModus = () => { try { return localStorage.getItem('pcs-coach') === 'co' ? 'co' : 'selbst'; } catch (e) { return 'selbst'; } };
  const nichtEnde = s => !(s.z && (s.z.abpfiff || s.z.ende90 || s.z.endeVerl || s.z.art === 'ende'));
  // Nur Minuten, die die Engine schon ganz gerechnet hat (der Fahrplan hat sonst leere Minuten bis zur 90.)
  const gerechnet = () => { const g = LIVE && !LIVE.fertig ? Math.floor(LIVE.S.clock / 60) : Infinity; return s => nichtEnde(s) && (s.mi == null || s.mi < g); };

  // Vorgabe für den Anpfiff (0–4, 2 = Ausgewogen); gilt für das nächste Live-Spiel, danach wieder Ausgewogen
  let startAusr = 2;
  function vorAusrichtung(i) { if (i == null) return startAusr; if (AUSRICHTUNG[i]) startAusr = i; return startAusr; }
  function liveMoeglich() {
    const E = E3(), TS = W.DFLTextspiel;
    if (!breit() || !E || typeof E.weiterBis !== 'function' || !TS || typeof TS.tickerFuer !== 'function' || !W.EngineV3Adapter) return false;
    const fx = typeof CURRENT_FIXTURE !== 'undefined' ? CURRENT_FIXTURE : null, g = typeof G !== 'undefined' ? G : null;
    if (!fx || !g || g.running || g.ended || g.halfDone || g.min !== 0 || fx.type === 'playoff') return false;
    try { const l = W.KSSimulieren && KSSimulieren.lauf && KSSimulieren.lauf(); if (l && !l.fertig) return false; } catch (e) { /* ohne */ }
    if (EngineV3Adapter.istOffen && EngineV3Adapter.istOffen()) return false;
    return TS.tickerFuer(fx);
  }
  function recAus(res) {
    return { frames: res.frames, frameCount: res.frameCount, stride: res.stride, events: res.events, score: res.score, stats: res.stats, teams: [LIVE.H, LIVE.A] };
  }
  function liveStart() {
    if (typeof CURRENT_FIXTURE === 'undefined' || !CURRENT_FIXTURE) return false;
    try { if (typeof W.autoFillLineup === 'function') W.autoFillLineup(); } catch (e) { /* Aufstellung wie sie ist */ }
    try { if (typeof syncClubToTeams === 'function') syncClubToTeams(); } catch (e) { /* ohne */ }
    const H = EngineV3Adapter.buildOwn(), A = EngineV3Adapter.buildOpp();
    if (!H || !A || !H.players || H.players.length < 7) return false;
    const opts = { seed: (Math.random() * 1e9) | 0, record: true, homeAdv: (typeof FCM_IS_HOME !== 'undefined' && FCM_IS_HOME) ? 'H' : 'A',
      stilFaktor: (W.DFLTaktik && DFLTaktik.engineFaktoren) ? DFLTaktik.engineFaktoren() : null };
    // Ausrichtung zum Anpfiff (Seite „Vor dem Spiel“, kickstil_pc_vorspiel.js): ab Minute 0 – erst 1 s rechnen, Ausrichtung setzen, dann weiter
    const ab0 = startAusr !== 2 && AUSRICHTUNG[startAusr];
    // Anweisungen aus dem Taktikbrett (kickstil_pc_taktik_live.js) gelten ab Minute 0
    const tk = W.KSPcTaktik; if (tk && tk.startAnw) { try { opts.anw = tk.startAnw(startAusr); } catch (e) { /* ohne */ } }
    let res = E3().simulateMatch(H, A, Object.assign({}, opts, { stopBei: ab0 ? 1 : CFG.abschnitt }));
    if (!res || !res._S) return false;
    LIVE = { fx: Object.assign({}, CURRENT_FIXTURE), H, A, S: res._S, res, seed: (Math.random() * 1e9) | 0, fertig: false,
      wPlan0: (res._S.wPlan[0] || []).slice(), coach: coachModus(), wechsel: [], offen: [], wahl: null, ansage: null, ansageFrei: 0, hz: false };
    if (!LIVE.S.tor) LIVE.S.tor = [1, 1];
    if (tk && tk.start) { try { tk.start(LIVE); } catch (e) { console.warn('[Kickstil-PC-Spieltag] Taktik', e); } }
    Object.assign(LIVE, { basisTor: LIVE.S.tor.slice(), ausr: 2, block: 0, kondF: 1 });
    if (ab0) {
      const a = AUSRICHTUNG[startAusr];
      E3().blockVerschieben(LIVE.S, 0, a.block); LIVE.block = a.block;
      LIVE.S.teams[0].forEach(p => { p._kondK *= a.kond; }); LIVE.kondF = a.kond;
      LIVE.ausr = startAusr; torSetzen();
      if (tk && tk.anwRechnen) tk.anwRechnen(LIVE);
      res = E3().weiterBis(LIVE.S, CFG.abschnitt); LIVE.res = res;
    }
    startAusr = 2;
    if (LIVE.coach === 'selbst') LIVE.S.wPlan[0] = [];
    const p = W.DFLTextspiel.paketLive(LIVE.fx, recAus(res), LIVE.seed);
    if (!p) { LIVE = null; return false; }
    const ui = tsUi();
    ui.live = HAKEN;
    ui.laden(p, {});
    ui.st = ui.st.filter(gerechnet());
    zuletzt = '';
    return true;
  }
  // Eingriffe, die erst in der Engine wirken: geplante Wechsel, abgelaufene Ansagen
  function eingriffe() {
    const S = LIVE.S, E = E3();
    if (W.KSPcTaktik && KSPcTaktik.eingriffe) { try { KSPcTaktik.eingriffe(LIVE); } catch (e) { console.warn('[Kickstil-PC-Spieltag] Taktik', e); } }
    if (LIVE.ansage && S.clock >= LIVE.ansage.bis) { LIVE.ansage = null; torSetzen(); }
    LIVE.offen.splice(0).forEach(w => {
      const slot = S.teams[0].find(p => tief(p) === w.raus), bi = S.bank[0].findIndex(b => tief(b) === w.rein);
      if (slot && bi >= 0 && E.wechselAusfuehren(S, 0, slot._i, bi)) { slot._kondK *= LIVE.kondF; LIVE.wechsel.push(w); }
    });
  }
  function abschnitt() {
    if (LIVE.fertig) return;
    eingriffe();
    const S = LIVE.S, ende = (E3().CFG && E3().CFG.matchSeconds) || 5400;
    let ziel = Math.floor(S.clock / CFG.abschnitt) * CFG.abschnitt + CFG.abschnitt;
    if (!LIVE.hzWeiter && S.clock < CFG.halbzeit && ziel > CFG.halbzeit) ziel = CFG.halbzeit;      // genau bis zur Pause
    let res;
    if (ziel >= ende) { res = E3().fortsetzen(S); LIVE.fertig = true; } else res = E3().weiterBis(S, ziel);
    LIVE.res = res;
  }
  function uebernehmen(ui) {
    const p = W.DFLTextspiel.paketLive(LIVE.fx, recAus(LIVE.res), LIVE.seed);
    if (!p) return;
    const K = W.DFLTextKern, v = p.variante === 'A' ? 'A' : 'B';
    const fp = K.fahrplan(p.spiel, v), st = K.schritte(fp, v).filter(gerechnet());
    const alt = ui.st[ui.i - 1];
    let i = ui.i;
    if (alt) {
      const j = st.findIndex(s => s.mi === alt.mi && s.key === alt.key && (s.z ? (alt.z && s.z.html === alt.z.html) : !alt.z));
      if (j >= 0) i = j + 1;
    }
    ui.p = p; ui.fp = fp; ui.st = st; ui.i = Math.min(i, st.length);
    ui.druckW = K.druck(p.spiel); ui.kum = K.verlauf(p.spiel); ui.schuss = K.schuesse(p.spiel);
    ui.toreAlle = fp.plan.flatMap(x => x.zeilen).filter(z => z.art === 'tor' && z.mi != null && !z.phase);
  }
  const HAKEN = {
    vorrat(ui) {
      if (!LIVE || LIVE.fertig) return;
      // Halbzeit: die Engine rechnet erst weiter, wenn es nach der Pause weitergeht – Wechsel/Ansagen wirken ab der 46.
      if (LIVE.hz && ui.laeuft) LIVE.hzWeiter = true;
      if (!LIVE.hzWeiter && LIVE.S.clock >= CFG.halbzeit - 0.5) {
        if (ui.i < ui.st.length) return;
        LIVE.hz = true;
        ui.pause();
        ui.hinweis('<i class="ti ti-clock-pause" aria-hidden="true"></i><span><b>Halbzeit.</b></span>');   // Nutzer 2026-10-22: überflüssiger Text raus („Zeit für Wechsel, Kabinenansprache und Taktik – dann unten auf Weiter.“)
        zuletzt = '';
        return 'warten';
      }
      if (ui.st.length - ui.i > CFG.vorrat) return;
      abschnitt(); uebernehmen(ui);
    },
    bisEnde(ui) {
      if (!LIVE) return;
      while (!LIVE.fertig) abschnitt();
      uebernehmen(ui);
    },
    buchen(ui) {
      if (!LIVE) return;
      while (!LIVE.fertig) abschnitt();
      RUECKGABE = LIVE.res;
      W.__tsLiveBuchen = { pos: ui.i, seed: LIVE.seed };
      const tkNach = W.KSPcTaktik && KSPcTaktik.vorBuchen ? KSPcTaktik.vorBuchen(LIVE) : null;
      LIVE = null;
      try { _simInnen.call(W); } finally { W.__tsLiveBuchen = null; RUECKGABE = null; zuletzt = ''; }
      if (tkNach) { try { KSPcTaktik.nachBuchen(tkNach); } catch (e) { console.warn('[Kickstil-PC-Spieltag] Taktik', e); } }
    }
  };

  // Engine: beim Buchen das vorgerechnete Spiel zurückgeben (alle Hüllen laufen wie immer mit)
  if (W.MatchEngineV3 && typeof W.MatchEngineV3.simulateMatch === 'function') {
    const _e = W.MatchEngineV3.simulateMatch;
    W.MatchEngineV3.simulateMatch = function (h, a, opt) {
      if (RUECKGABE) { const r = RUECKGABE; RUECKGABE = null; opt = Object.assign({}, opt || {}, { vorgerechnet: r }); }
      return _e.call(this, h, a, opt);
    };
  }
  // Anpfiff: am PC live statt in einem Zug
  const _simInnen = W.simulateCurrentFixture;
  if (typeof _simInnen === 'function') {
    W.simulateCurrentFixture = function () {
      if (!LIVE && istPc()) {
        let ok = false;
        try { ok = liveMoeglich() && liveStart(); } catch (e) { console.warn('[Kickstil-PC-Spieltag] Live-Start', e); LIVE = null; }
        if (ok) return undefined;
      }
      return _simInnen.apply(this, arguments);
    };
    try { simulateCurrentFixture = W.simulateCurrentFixture; } catch (e) { /* window reicht */ }
  }

  // ── Ansagen und Ausrichtung ────────────────────────────────────────────────
  // Abschlussfaktoren der Engine (S.tor) werden immer aus Grundwert × Ausrichtung × Ansage neu gesetzt – so heben sich
  // Ansage und Ausrichtung nicht gegenseitig auf. Ausrichtung bleibt, bis sie geändert wird; Ansagen wirken 10 Minuten.
  const fuehrung = () => { try { const T = CLUB.ksTrainer; return T && T.werte && typeof T.werte.fuehrung === 'number' ? T.werte.fuehrung : 8; } catch (e) { return 8; } };
  const ANSAGEN = {
    anfeuern: { name: 'Anfeuern', text: 'sicher, kleiner Schub' },
    anschreien: { name: 'Anschreien', text: 'großer Schub – oder Unruhe' }
  };
  const AUSRICHTUNG = [
    { name: 'Mauern', block: -10, eigen: 0.85, geg: 0.82, kond: 0.95, text: 'Alle hinter den Ball – kaum Gegentore, kaum eigene Chancen.' },
    { name: 'Defensiv', block: -5, eigen: 0.93, geg: 0.92, kond: 1, text: 'Kompakt stehen und auf Konter lauern.' },
    { name: 'Ausgewogen', block: 0, eigen: 1, geg: 1, kond: 1, text: 'Normale Ordnung – weder Rückzug noch zusätzliches Risiko.' },
    { name: 'Offensiv', block: 5, eigen: 1.08, geg: 1.07, kond: 1.1, text: 'Mehr Leute nach vorn – hinten wird es luftiger.' },
    { name: 'Brechstange', block: 10, eigen: 1.18, geg: 1.18, kond: 1.25, text: 'Alles nach vorn – hohes Risiko, zehrt stark an der Fitness.' }
  ];
  function torSetzen() {
    const S = LIVE.S, a = AUSRICHTUNG[LIVE.ausr], f = LIVE.ansage ? LIVE.ansage.faktor : 1;
    S.tor[0] = LIVE.basisTor[0] * a.eigen * f; S.tor[1] = LIVE.basisTor[1] * a.geg;
  }
  const hinweis = html => { const ui = tsUi(); if (ui) ui.hinweis(html); };
  function ansagen(art) {
    if (!LIVE || LIVE.fertig || LIVE.ansage || LIVE.S.clock < LIVE.ansageFrei || !ANSAGEN[art]) return;
    const S = LIVE.S;
    let text = '', gut = true, faktor = 1;
    if (art === 'anfeuern') { faktor = 1.08; text = 'Die Mannschaft wird angefeuert – die Köpfe gehen hoch.'; }
    else {
      const ui = tsUi(), z = ui && ui.st[ui.i - 1] && ui.st[ui.i - 1].z, stand = z && z.stand;
      const eigen = ui && ui.p ? ui.p.spiel.eigen : 'h', rueck = stand ? stand[eigen] < stand[eigen === 'h' ? 'g' : 'h'] : false;
      gut = Math.random() < Math.max(0.25, Math.min(0.85, 0.5 + (rueck ? 0.2 : 0) + (fuehrung() - 8) * 0.02));
      if (gut) { faktor = 1.18; text = 'Die Ansage sitzt – jetzt brennt die Mannschaft.'; } else { faktor = 0.9; text = 'Das kommt schlecht an – die Spieler wirken verunsichert.'; }
    }
    LIVE.ansage = { art, gut, faktor, bis: S.clock + CFG.ansageDauer };
    LIVE.ansageFrei = LIVE.ansage.bis + CFG.ansagePause;
    torSetzen();
    hinweis(`<i class="ti ti-speakerphone" aria-hidden="true"></i><span><b>${esc(ANSAGEN[art].name)}:</b> ${esc(text)}</span>`);
    zuletzt = ''; zeichnen();
  }
  function ausrichtungSetzen(i) {
    if (!LIVE || LIVE.fertig || i === LIVE.ausr || !AUSRICHTUNG[i]) return;
    const S = LIVE.S, a = AUSRICHTUNG[i];
    E3().blockVerschieben(S, 0, a.block - LIVE.block); LIVE.block = a.block;
    const f = a.kond / LIVE.kondF; S.teams[0].forEach(p => { p._kondK *= f; }); LIVE.kondF = a.kond;
    LIVE.ausr = i; torSetzen();
    if (W.KSPcTaktik && KSPcTaktik.anwRechnen) KSPcTaktik.anwRechnen(LIVE, true);
    hinweis(`<i class="ti ti-chess-knight" aria-hidden="true"></i><span><b>${esc(a.name)}:</b> ${esc(a.text)}</span>`);
    zuletzt = ''; zeichnen();
  }
  function coachSetzen(m) {
    try { localStorage.setItem('pcs-coach', m); } catch (e) { /* ohne */ }
    if (!LIVE) return;
    LIVE.coach = m;
    const S = LIVE.S;
    S.wPlan[0] = m === 'co' ? LIVE.wPlan0.filter(x => x > S.clock).slice(0, Math.max(0, 3 - LIVE.wechsel.length)) : [];
    LIVE.wahl = null; zuletzt = ''; zeichnen();
  }

  // ── Daten aus dem Ticker ───────────────────────────────────────────────────
  function kurzNamen(spiel) {
    const nachn = {}, ini = {};
    ['h', 'g'].forEach(s => (spiel.spieler[s] || []).forEach(p => { nachn[p.n] = (nachn[p.n] || 0) + 1; const k = (p.v || '').charAt(0) + p.n; ini[k] = (ini[k] || 0) + 1; }));
    return p => (nachn[p.n] === 1 || !p.v ? p.n : ini[p.v.charAt(0) + p.n] === 1 ? `${p.v.charAt(0)}. ${p.n}` : `${p.v} ${p.n}`);
  }
  function ereignisse(ui) {
    const ev = { h: {}, g: {} }, add = (s, n, e) => { if (!s || !n) return; ((ev[s][n] = ev[s][n] || [])).push(e); };
    (ui.st || []).slice(0, ui.i || 0).forEach(x => {
      const z = x && x.z; if (!z) return;
      if (z.art === 'tor' && !z.phase) add(z.torArt === 'eigentor' ? (z.s === 'h' ? 'g' : 'h') : z.s, z.torschuetze, { a: 'tor', min: z.min });
      else if (z.art === 'gelb' || z.art === 'rot') add(z.s, z.spieler, { a: z.karte === 'yellow' ? 'gelb' : 'rot', min: z.min });
      else if (z.art === 'wechsel') { add(z.s, z.aus, { a: 'aus', min: z.min }); add(z.s, z.ein, { a: 'ein', min: z.min }); }
    });
    return ev;
  }
  function objektSuche(...listen) {
    const m = {};
    listen.forEach(liste => (liste || []).forEach(p => { if (p && p.name) { const k = voll(p); if (!m[k]) m[k] = p; } }));
    return x => m[vollX(x)] || m[x.n] || null;
  }
  function gegnerKader() {
    const l = [];
    try { if (typeof TEAMS !== 'undefined' && TEAMS.away && Array.isArray(TEAMS.away.lineupPlayers)) l.push(TEAMS.away.lineupPlayers); } catch (e) { /* ohne */ }
    try {
      const fx = typeof CURRENT_FIXTURE !== 'undefined' ? CURRENT_FIXTURE : null, id = fx && fx.opponentId;
      if (id && typeof allGroups === 'function' && typeof LEAGUE !== 'undefined') {
        const t = allGroups(LEAGUE).flatMap(g => g.group.teams).find(x => x.id === id);
        const dataId = t ? (t.dataId || String(t.id).replace(/^club_/, '')) : String(id).replace(/^club_/, '');
        if (CLUB.npcSquads && CLUB.npcSquads[dataId]) l.push(CLUB.npcSquads[dataId]);
      }
      if (id && typeof W.euroKader === 'function') { const ek = W.euroKader(); if (ek[id]) l.push(ek[id]); }
    } catch (e) { /* ohne */ }
    return l;
  }
  // Kraft aus der laufenden Engine (nur live): Spieler über den echten Spieler (_ref) finden
  function kraftVon(teamIdx, x) {
    if (!LIVE) return null;
    const k = vollX(x), p = (LIVE.S.teams[teamIdx] || []).find(q => voll(tief(q)) === k);
    LIVE.kraft = LIVE.kraft || {};
    if (p) LIVE.kraft[teamIdx + k] = Math.round((p.kond || 0) * 100);
    return LIVE.kraft[teamIdx + k] != null ? LIVE.kraft[teamIdx + k] : null;     // schon ausgewechselt (Engine voraus): letzter Wert
  }
  const GESICHT = new Map();
  function gesicht(p, vid) {
    if (!p) return '';
    const k = (p.id || p.name) + ':' + vid;
    if (!GESICHT.has(k)) {
      let h = '';
      try {
        if (W.KSVerein) h = KSVerein.gesicht(p, vid);
        else if (W.DFLIdentitaet) { const f = W.DFLSpiel && DFLSpiel.franchise(vid); h = DFLIdentitaet.gesichtSvg(p, f ? { farben: f.farben } : null); }   // Kickdraft
      } catch (e) { h = ''; }
      GESICHT.set(k, h);
    }
    return GESICHT.get(k);
  }
  function posMitSeite(x, obj) {
    const k = (obj && obj.pos) || x.pos || '';
    try { return W.KSPos && typeof KSPos.norm === 'function' ? KSPos.norm(k) : k; } catch (e) { return k; }
  }
  function zeile(x, kurz, obj, evs, vid, posText, extra) {
    extra = extra || {};
    const e = evs || [], raus = e.some(q => q.a === 'aus' || q.a === 'rot');
    const ovr = obj && (obj.ovr || obj.str) ? Math.round(obj.ovr || obj.str) : '';
    const g = gesicht(obj || { id: 'ts:' + vollX(x), firstName: x.v || '', name: x.n || kurz, pos: x.pos || '', age: 26 }, vid);
    const marken = e.map(q => q.a === 'tor' ? `<span class="pcs-e tor" title="Tor">⚽ ${esc(q.min)}</span>`
      : q.a === 'gelb' ? `<span class="pcs-e gelb" title="Gelbe Karte">${esc(q.min)}</span>`
      : q.a === 'rot' ? `<span class="pcs-e rot" title="Rote Karte">${esc(q.min)}</span>`
      : q.a === 'aus' ? `<span class="pcs-e aus" title="Ausgewechselt">▼ ${esc(q.min)}</span>`
      : `<span class="pcs-e ein" title="Eingewechselt">▲ ${esc(q.min)}</span>`).join('');
    const kr = extra.kraft;
    const kraft = kr != null && !raus ? `<span class="pcs-kraft ${kr < 60 ? 'leer' : kr < 75 ? 'mittel' : ''}" title="Fitness ${kr} %"><i><b style="width:${Math.max(4, Math.min(100, kr))}%"></b></i>${kr}</span>` : '';
    return `<div class="pcs-sp${raus ? ' raus' : ''}${extra.klasse ? ' ' + extra.klasse : ''}" data-pcs-n="${esc(vollX(x))}"${extra.wahl ? ` data-wahl="${esc(extra.wahl)}"` : ''}><span class="pcs-gs">${g}</span>
      <span class="pcs-nm"><b>${esc(kurz)}</b><small>${esc(posText || x.pos || '')}${kraft}</small></span><span class="pcs-ev">${marken}</span><span class="pcs-ov">${ovr}</span></div>`;
  }

  function teamHtml(s, ui, spiel, kn, evAlle) {
    const eigen = s === spiel.eigen, teamIdx = eigen ? 0 : 1;
    const liste = spiel.spieler[s] || [], elfIdx = spiel.elf[s] || [];
    const finde = eigen ? objektSuche(typeof SQUAD !== 'undefined' ? SQUAD : []) : objektSuche(...gegnerKader()), vid = eigen ? 'fcm' : null;
    const ev = evAlle[s] || {};
    const box = document.querySelector(`#dfl-ts .ts-team.${s}`);
    const wappen = box ? (box.querySelector('.ts-wappen-k') || {}).outerHTML || '' : '';
    const name = (spiel.teams[s] && (spiel.teams[s].name || spiel.teams[s].kurz)) || '';
    const elf = elfIdx.map(i => liste[i]).filter(Boolean);
    const objs = elf.map(finde).filter(Boolean);
    const schnitt = objs.length ? Math.round(objs.reduce((a, p) => a + (p.ovr || 0), 0) / objs.length) : null;
    const coachen = eigen && LIVE && !LIVE.fertig && LIVE.coach === 'selbst';
    const geplantRaus = new Set(LIVE ? LIVE.offen.map(w => voll(w.raus)) : []);
    const wahlKey = LIVE && LIVE.wahl ? voll(LIVE.wahl) : null;
    let h = `<div class="pcs-tk">${wappen}<div class="pcs-tk-txt"><b>${esc(name)}</b><small>${esc((eigen && LIVE && LIVE.tk && LIVE.tk.form) || spiel.formation[s] || '')}${schnitt ? ' · Stärke ' + schnitt : ''}${eigen ? ' · wir' : ''}</small></div></div>`;
    const zeileX = x => {
      const kraft = kraftVon(teamIdx, x), k = vollX(x), evs = ev[kn(x)] || [];
      const draussen = evs.some(q => q.a === 'aus' || q.a === 'rot');
      return zeile(x, kn(x), finde(x), evs, vid, posMitSeite(x, finde(x)), {
        kraft, klasse: geplantRaus.has(k) ? 'geplant' : '', wahl: coachen && LIVE.wahl && !draussen && TEIL(x.pos || '') !== 'tw' ? 'feld:' + k : '' });
    };
    ['tw', 'abw', 'mit', 'ang'].forEach(t => {
      const teil = elf.filter(x => TEIL(x.pos || '') === t);
      if (teil.length) h += `<div class="pcs-teil">${TEILNAME[t]}</div>` + teil.map(zeileX).join('');
    });
    const startNamen = new Set(elf.map(kn));
    const rein = liste.filter(x => !startNamen.has(kn(x)) && (ev[kn(x)] || []).some(q => q.a === 'ein'));
    if (rein.length) h += `<div class="pcs-teil">Eingewechselt</div>` + rein.map(zeileX).join('');
    if (eigen) {
      // Bank: live die Bank der Engine (wer noch nicht drin war), sonst der Kader
      let bank = [];
      if (LIVE) bank = (LIVE.S.bank[0] || []).map(b => tief(b)).filter(Boolean);
      else if (typeof getBenchIds === 'function' && typeof getPlayer === 'function') {
        try {
          const imSpiel = new Set(liste.map(vollX));
          bank = getBenchIds().map(getPlayer).filter(p => p && !imSpiel.has(voll(p)) && !(p.injuryWeeks > 0) && !p.injured).sort((a, b) => (b.ovr || 0) - (a.ovr || 0)).slice(0, 7);
        } catch (e) { bank = []; }
      }
      const geplantRein = new Set(LIVE ? LIVE.offen.map(w => voll(w.rein)) : []);
      const n = LIVE ? LIVE.wechsel.length + LIVE.offen.length : 0;
      if (bank.length) {
        h += `<div class="pcs-teil"><span>Bank</span>${LIVE ? `<span>Wechsel ${n}/${CFG.maxWechsel}</span>` : ''}</div>` +
          bank.map(p => zeile({ v: p.firstName || '', n: p.name, pos: p.pos }, (p.firstName ? p.firstName.charAt(0) + '. ' : '') + p.name, p, null, 'fcm', posMitSeite({ pos: p.pos }, p), {
            klasse: (wahlKey === voll(p) ? 'gewaehlt' : '') + (geplantRein.has(voll(p)) ? ' geplant' : ''),
            wahl: coachen && n < CFG.maxWechsel && !geplantRein.has(voll(p)) ? 'bank:' + voll(p) : '' })).join('');
      }
      if (LIVE && !LIVE.fertig) {
        let info;
        if (LIVE.coach === 'co') info = 'Der Co-Trainer wechselt selbst. Unten auf „Selbst coachen“ umstellen, um selbst zu wechseln.';
        else if (LIVE.wahl) info = `<b>${esc(voll(LIVE.wahl))}</b> kommt rein – jetzt den Spieler anklicken, der raus soll. <button type="button" class="pcs-knopf" data-pcs="abbrechen">Abbrechen</button>`;
        else if (LIVE.offen.length) info = LIVE.offen.map(w => `▲ <b>${esc(voll(w.rein))}</b> für ▼ <b>${esc(voll(w.raus))}</b>`).join('<br>') + '<br><small>bei der nächsten Unterbrechung</small>';
        else if (n >= CFG.maxWechsel) info = 'Alle Wechsel sind aufgebraucht.';
        else info = 'Wechseln: erst einen Spieler von der Bank anklicken, dann den, der raus soll.';   // Nutzer 2026-10-22: überflüssiger Text raus („Achte auf die Fitnessbalken.“)
        h += `<div class="pcs-wechselinfo">${info}</div>`;
      }
    }
    return h;
  }

  // ── Ansagen-Leiste ─────────────────────────────────────────────────────────
  function ansagenHtml() {
    if (!LIVE) return '';
    const S = LIVE.S, aktiv = LIVE.ansage, pause = !aktiv && S.clock < LIVE.ansageFrei, aus = LIVE.fertig;
    const knopf = art => `<button type="button" class="pcs-knopf${aktiv && aktiv.art === art ? ' an' : ''}" data-ansage="${art}"${aus || aktiv || pause ? ' disabled' : ''} title="${esc(ANSAGEN[art].text)}">${esc(ANSAGEN[art].name)}</button>`;
    const stufe = (a, i) => `<button type="button" class="pcs-knopf pcs-stufe${LIVE.ausr === i ? ' an' : ''}" data-ausr="${i}"${aus ? ' disabled' : ''} title="${esc(a.text)} (Taste ${i + 1})">${esc(a.name)}</button>`;
    let status;
    if (aus) status = 'Das Spiel ist zu Ende gerechnet.';
    else if (aktiv) status = `<i class="ti ti-eye" aria-hidden="true"></i> ${aktiv.art === 'anschreien' ? (aktiv.gut ? 'Die Spieler wirken wachgerüttelt.' : 'Die Spieler wirken irritiert.') : 'Die Spieler wirken motivierter.'}`;   // Eindruck statt Minute (Nutzer 2026-10-22)
    else if (pause) status = `Nächste Ansage ab etwa ${minVon(LIVE.ansageFrei)}.`;
    else status = '';
    const tkL = W.KSPcTaktik && KSPcTaktik.leisteHtml ? KSPcTaktik.leisteHtml(LIVE) : '';
    return `${tkL || `<span class="pcs-t">Ansagen</span>${knopf('anfeuern')}${knopf('anschreien')}<span class="pcs-status">${status}</span>`}
      <span class="pcs-trenn" aria-hidden="true"></span><span class="pcs-t">Ausrichtung</span><span class="pcs-stufen">${AUSRICHTUNG.map(stufe).join('')}</span>
      <span class="pcs-trenn" aria-hidden="true"></span>
      <button type="button" class="pcs-knopf${LIVE.coach === 'selbst' ? ' an' : ''}" data-coach="selbst"${aus ? ' disabled' : ''}>Selbst coachen</button>
      <button type="button" class="pcs-knopf${LIVE.coach === 'co' ? ' an' : ''}" data-coach="co"${aus ? ' disabled' : ''}>Co-Trainer</button>`;
  }

  // ── Aufbau ─────────────────────────────────────────────────────────────────
  function zeichnen() {
    const ts = $('dfl-ts');
    if (!ts) return;
    const an = breit() && !ts.hidden;
    ts.classList.toggle('pcs-an', an);
    if (!an) return;
    const box = ts.querySelector('.ts-box'), ui = tsUi();
    if (!box || !ui || !ui.p || !ui.p.spiel) return;
    const spiel = ui.p.spiel;
    let links = box.querySelector(':scope > .pcs-team.links'), rechts = box.querySelector(':scope > .pcs-team.rechts'), leiste = box.querySelector(':scope > .pcs-ansagen');
    if (!links) {
      links = document.createElement('aside'); links.className = 'pcs-team links'; links.setAttribute('aria-label', 'Heimmannschaft'); box.appendChild(links);
      rechts = document.createElement('aside'); rechts.className = 'pcs-team rechts'; rechts.setAttribute('aria-label', 'Gastmannschaft'); box.appendChild(rechts);
      leiste = document.createElement('div'); leiste.className = 'pcs-ansagen'; leiste.setAttribute('aria-label', 'Ansagen'); box.appendChild(leiste);
      box.addEventListener('click', klick);
      zuletzt = '';
      ['h', 'g'].forEach(s => {
        const t = box.querySelector(`.ts-team.${s} > b`);
        if (t && !t.querySelector('.pcs-voll') && spiel.teams[s] && spiel.teams[s].name) { t.classList.add('pcs-teamtxt'); t.insertAdjacentHTML('beforeend', `<span class="pcs-voll">${esc(spiel.teams[s].name)}</span>`); }
      });
    }
    const sig = (ui.i || 0) + '|' + (ui.fertig ? 1 : 0) + '|' + (spiel.seed || '') + '|' + (LIVE ? [LIVE.S.clock | 0, LIVE.offen.length, LIVE.wechsel.length, LIVE.wahl ? voll(LIVE.wahl) : '', LIVE.ansage ? LIVE.ansage.art : '', LIVE.coach, LIVE.fertig ? 1 : 0, W.KSPcTaktik && KSPcTaktik.sig ? KSPcTaktik.sig(LIVE) : ''].join(',') : '-');
    if (sig === zuletzt) return;
    zuletzt = sig;
    try {
      const kn = kurzNamen(spiel), ev = ereignisse(ui);
      links.style.setProperty('--pcs-farbe', 'var(--ch)'); rechts.style.setProperty('--pcs-farbe', 'var(--cg)');
      links.classList.toggle('pcs-klickbar', spiel.eigen === 'h'); rechts.classList.toggle('pcs-klickbar', spiel.eigen === 'g');
      const sl = links.scrollTop, sr = rechts.scrollTop;
      links.innerHTML = teamHtml('h', ui, spiel, kn, ev);
      rechts.innerHTML = teamHtml('g', ui, spiel, kn, ev);
      links.scrollTop = sl; rechts.scrollTop = sr;
      if (LIVE && W.KSPcTaktik && KSPcTaktik.nachZeichnen) KSPcTaktik.nachZeichnen(LIVE);
      leiste.classList.toggle('an', !!LIVE);
      leiste.innerHTML = ansagenHtml();
    } catch (err) { console.warn('[Kickstil-PC-Spieltag] Anzeige', err); }
  }
  function klick(ev) {
    if (W.KSPcTaktik && KSPcTaktik.klick && KSPcTaktik.klick(ev, LIVE)) { zuletzt = ''; zeichnen(); return; }
    const a = ev.target.closest('[data-ansage]'); if (a) { ansagen(a.dataset.ansage); return; }
    const c = ev.target.closest('[data-coach]'); if (c) { coachSetzen(c.dataset.coach); return; }
    const r = ev.target.closest('[data-ausr]'); if (r) { ausrichtungSetzen(+r.dataset.ausr); return; }
    if (ev.target.closest('[data-pcs="abbrechen"]')) { if (LIVE) { LIVE.wahl = null; zuletzt = ''; zeichnen(); } return; }
    const w = ev.target.closest('[data-wahl]');
    if (!w || !LIVE || LIVE.fertig) return;
    const art = w.dataset.wahl.slice(0, 4), k = w.dataset.wahl.slice(5);
    if (art === 'bank') {
      const p = (LIVE.S.bank[0] || []).map(b => tief(b)).find(q => voll(q) === k);
      LIVE.wahl = LIVE.wahl && voll(LIVE.wahl) === k ? null : p || null;
    } else if (art === 'feld' && LIVE.wahl) {
      const p = (LIVE.S.teams[0] || []).map(q => tief(q)).find(q => voll(q) === k);
      if (p && !LIVE.offen.some(x => x.raus === p) && LIVE.wechsel.length + LIVE.offen.length < CFG.maxWechsel) {
        LIVE.offen.push({ rein: LIVE.wahl, raus: p });
        LIVE.wahl = null;
      }
    }
    zuletzt = ''; zeichnen();
  }

  // Tasten im Spieltag (nur am PC, Ticker offen): Leertaste = Pause/Weiter, 1–5 = Ausrichtung
  function taste(ev) {
    const ts = $('dfl-ts'), ui = tsUi();
    if (!ts || ts.hidden || !ts.classList.contains('pcs-an') || !ui || ui.fertig || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test((ev.target && ev.target.tagName) || '')) return;
    if (W.KSPcTaktik && KSPcTaktik.taste && KSPcTaktik.taste(ev, LIVE, ui)) { zuletzt = ''; zeichnen(); return; }
    if (ev.key === ' ') { ev.preventDefault(); if (ui.laeuft) ui.pause(); else ui.weiter(); return; }
    if (LIVE && /^[1-5]$/.test(ev.key)) { ev.preventDefault(); ausrichtungSetzen(+ev.key - 1); }
  }
  // Vor dem Schließen/Neuladen der PC-App (pc_app/main.js fragt das ab): laufendes Live-Spiel zu Ende rechnen und buchen, speichern
  W.__pcVorSchliessen = async function () {
    try {
      if (LIVE) { const ui = tsUi(); LIVE.ansage = null; HAKEN.buchen(ui); }
      if (typeof saveGameState === 'function' && typeof LEAGUE !== 'undefined' && LEAGUE) await Promise.race([saveGameState(), new Promise(r => setTimeout(r, 3000))]);
    } catch (e) { console.warn('[Kickstil-PC-Spieltag] Schließen', e); }
    return true;
  };

  function start() {
    if (!istPc() || $('pcs-css')) return;
    document.addEventListener('keydown', taste);
    const st = document.createElement('style'); st.id = 'pcs-css'; st.textContent = CSS; document.head.appendChild(st);
    setInterval(zeichnen, CFG.takt);
    if (mq) { const f = () => { zuletzt = ''; zeichnen(); }; if (mq.addEventListener) mq.addEventListener('change', f); else if (mq.addListener) mq.addListener(f); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(start, 0)); else setTimeout(start, 0);

  W.KSPcSpieltag = { CFG, zeichnen, live: () => LIVE, neu: () => { zuletzt = ''; zeichnen(); }, tsUi, AUSRICHTUNG_ANZ: () => AUSRICHTUNG, ansagen, ausrichtungSetzen, coachSetzen, AUSRICHTUNG, vorAusrichtung, liveMoeglich, coachModus: () => coachModus(), gegnerKader };
  console.log('[Kickstil-PC-Spieltag v3] aktiv — nur PC-Version: Spieltag auf voller Breite, Live-Coaching mit Wechseln, Kraft und Ansagen');
})();
