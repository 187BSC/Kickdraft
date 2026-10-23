/* ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
   Kickstil – Streamer-Modus, Stufe 1 (2026-10-20, nur PC-Version, beide Spiele)
   Nutzer: „Twitch-Event, bei dem Zuschauer einen Adventure-Charakter haben … wie bringen wir das ein?“ → per Rückfrage:
   eigenes Talent je Zuschauer + Chat als Co-Trainer; beide Spiele gleich; normal ausgewürfelt; Twitch-Name = Spielername;
   eigener Stream-Jahrgang (30 je Saison, darüber Warteliste); Abgang → spielt in der Welt weiter. Stufe 2 (Chat-Bot mit Anmeldung) folgt.
   · Chat lesen: window.FcmPc.stream (pc_app/twitch_chat.js, anonym, nur lesend). Ohne Twitch zum Ausprobieren: Test-Chat im Stream-Blatt.
   · Befehle: !dabei [Position] [Nummer] · !training <schwerpunkt> · !karte · !bitte einsatz|vertrag · !raus · Abstimmung !1 … !9
   · Flutlicht: Talent in der Akademie (CLUB.youthProspects, zählt nicht gegen die Plätze), Kickdraft: Kandidat im nächsten Draft.
   · Chat als Co-Trainer im Live-Spiel (kickstil_pc_spieltag.js/kickstil_pc_taktik_live.js): Kabinenansprache zur Halbzeit von selbst,
     Zuruf und Ausrichtung auf Knopfdruck; der Streamer kann jede Abstimmung überstimmen.
   · Overlays im Spielfenster (Abstimmung, Talentkarte, Anfragen, Ereignisse der Zuschauer-Talente im Live-Spiel).
   Stufe 3 (Chat-Training, 2026-10-20): Zuschauer verdienen Einheiten (Dabeisein im Chat, Abstimmungen, Tipps; Deckel je Tag),
   10 Einheiten = +1 im Trainingsschwerpunkt bis zum Potenzial; Streamer-Events Trainingslager und Chat-Duell; Raid/Sub/Bits als Bonus.
   Zustand je Karriere: CLUB.ksStream { z: {login → Eintrag}, jg: {saison, n}, warte: [login], anfragen: [] };
   Geräteeinstellung: localStorage „gesamt-stream“ { kanal, befehle, abstimmen }.
   ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const W = window;
  const pc = () => !!W.FcmPc || (() => { try { return localStorage.getItem('pcs-test') === 'an'; } catch (e) { return false; } })();
  if (!pc()) return;
  const CFG = { jahrgang: 30, karteSek: 9, ereignisSek: 7, kabineSek: 30, abstimmSek: 25, trainingChance: 0.04, warteWochen: 8,
    abstand: 2500, anfragenMax: 4,
    // Chat-Training (Nutzer 2026-10-20: „so bauen“ – Zahlen wie vorgeschlagen)
    jePunkt: 10, deckel: 12, anwesendMin: 10, lagerMin: 15, lagerPauseMin: 60, duellSek: 60, duellSieg: 5, duellNiederlage: 1,
    raidMin: 5, raidPlus: 2, subPlus: 5, giftPlus: 3, giftMax: 15, bitsJe: 100, bitsMax: 10, tippPlus: 1, tippRichtig: 3, bestenSek: 20 };
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ico = n => `<i class="ti ti-${n}" aria-hidden="true"></i>`;
  const spiel = () => typeof CLUB !== 'undefined' && CLUB && typeof LEAGUE !== 'undefined' && LEAGUE;
  const KD = () => !!W.DFLSpiel;
  const speichern = () => { try { if (typeof saveGameState === 'function') saveGameState(); } catch (e) { /* später */ } };

  // ── Einstellungen (Gerät) und Zustand (Karriere) ───────────────────────────────────────────────────────────────
  function einst() {
    let e = {}; try { e = JSON.parse(localStorage.getItem('gesamt-stream') || '{}') || {}; } catch (x) { e = {}; }
    return Object.assign({ kanal: '', befehle: true, abstimmen: true, bot: true, gross: false, kamera: 'aus' }, e);
  }
  function einstSetzen(neu) { try { localStorage.setItem('gesamt-stream', JSON.stringify(Object.assign(einst(), neu))); } catch (e) { /* ohne */ } }
  function Z() {
    if (!spiel()) return null;
    const s = CLUB.ksStream || (CLUB.ksStream = { z: {}, jg: { saison: LEAGUE.season, n: 0 }, warte: [], anfragen: [] });
    if (!s.lager) s.lager = { bis: 0, start: 0 };
    if (!s.jg || s.jg.saison !== LEAGUE.season) s.jg = { saison: LEAGUE.season, n: 0 };
    return s;
  }
  const absWoche = () => (LEAGUE.season || 1) * 100 + (LEAGUE.week || 0);

  // ── Namen: Twitch-Name = Spielername, gefiltert ────────────────────────────────────────────────────────────────
  const SPERRE = ['nazi', 'hitler', 'heil', 'fick', 'fuck', 'hure', 'nigg', 'neger', 'schwuchtel', 'fotze', 'wichser', 'arsch', 'penis',
    'vagina', 'porn', 'sex', 'kanake', 'spast', 'behindert', 'nutte', 'kkk', 'isis', 'cock', 'dick', 'cunt', 'bitch', 'whore', 'rape'];
  const nameOk = n => /^[A-Za-z0-9_]{3,25}$/.test(n || '') && !SPERRE.some(w => String(n).toLowerCase().includes(w));

  // ── Chat-Bot (Stufe 2): antwortet mit Anmeldung des Streamers (pc_app/twitch_anmeldung.js) ─────────────────────────
  // Ohne Anmeldung (oder im Browser) landen die Sätze nur im Bot-Protokoll des Stream-Blatts – so lässt sich alles mit dem Test-Chat prüfen.
  let anm = { status: 'aus', login: '' };
  const botLog = [];
  // Bot „leise“ (Nutzer 2026-10-20): laut() schreibt in den Chat (Willkommen, Fortschritt gebündelt, Abstimmung, Duell, Raid, Tor,
  // Startelf, Tipp-Auflösung, Trainingslager, Wechsel, Hilfe); sag() ist eine Bestätigung und erscheint nur klein im Overlay.
  function laut(text) {
    const t = String(text || '').replace(/\s+/g, ' ').trim(); if (!t) return;
    const gesendet = einst().bot && anm.status === 'angemeldet' && W.FcmPc && W.FcmPc.stream && W.FcmPc.stream.sagen;
    if (gesendet) { try { W.FcmPc.stream.sagen(t); } catch (e) { /* weiter */ } }
    botLog.unshift({ t, gesendet: !!gesendet }); botLog.length = Math.min(botLog.length, 8);
    zeichneBotLog();
  }
  const quitt = [];
  function sag(text) {
    const t = String(text || '').replace(/\s+/g, ' ').trim(); if (!t) return;
    botLog.unshift({ t, leise: true }); botLog.length = Math.min(botLog.length, 8);
    quitt.push({ t, bis: Date.now() + 6000 }); while (quitt.length > 3) quitt.shift();
    zeichneBotLog(); zeichneQuitt();
  }
  function zeichneQuitt() {
    const box = ov().querySelector('.kstw-quitt'), jetzt = Date.now();
    while (quitt.length && quitt[0].bis < jetzt) quitt.shift();
    const html = quitt.map(q => `<div class="kstw-q">${esc(q.t)}</div>`).join('');
    if (box._sig !== html) { box._sig = html; box.innerHTML = html; }
  }
  const POS_NAME = { TW: 'Torwart', IV: 'Innenverteidiger', LV: 'Linksverteidiger', RV: 'Rechtsverteidiger', ZDM: 'Sechser', ZM: 'Mittelfeld',
    LM: 'linkes Mittelfeld', RM: 'rechtes Mittelfeld', ZOM: 'Zehner', LF: 'Linksaußen', RF: 'Rechtsaußen', ST: 'Stürmer' };

  // ── Spiel-Anbindung: Flutlicht (Akademie) ──────────────────────────────────────────────────────────────────────
  const FL = {
    POS: () => (typeof POS_LIST !== 'undefined' ? POS_LIST : ['TW', 'IV', 'LV', 'RV', 'ZDM', 'ZM', 'LM', 'RM', 'ZOM', 'LF', 'RF', 'ST']),
    erzeugen(e) {
      const lvl = (CLUB.facilities && CLUB.facilities.youth) || 1;
      const baseOvr = 46 + lvl * 3 + rndN(5), age = 15 + rndN(3);
      const pos = FL.POS().indexOf(e.pos) >= 0 ? e.pos : pickRnd(FL.POS());
      const positions = generatePositions(pos), areas = generateAreaRatings(positions, baseOvr), pm = genAttributes(pos, baseOvr);
      const p = { id: 'stream_' + e.login + '_' + LEAGUE.season, name: e.name, firstName: '', flag: '🇩🇪', country: 'Deutschland', age, pos, positions,
        def: areas.def, mid: areas.mid, att: areas.att, pace: pm.pace, mental: pm.mental, gamesPlayed: 0, seed: rndN(100), stream: e.login };
      p.ovr = computeOvrFromAreas(p);
      // „normal ausgewürfelt“ – dieselbe Verteilung wie generateYouthProspects (app_main.js)
      const roll = Math.random();
      const bonus = roll < 0.06 ? Math.round(20 + lvl * 1.8) + rndN(8) : roll < 0.30 ? Math.round(12 + lvl * 1.6) + rndN(6) : Math.round(6 + lvl * 1.2) + rndN(5);
      p.truePotential = Math.min(96, p.ovr + bonus);
      p.value = computeMarketValue(p);
      try { assignBirthday(p); } catch (x) { /* ohne */ }
      if (!CLUB.youthProspects) CLUB.youthProspects = [];
      CLUB.youthProspects.push(p);
      return p.id;
    },
    finden(e) {
      const tr = q => q && (q.stream === e.login || q.id === e.pid || q.id === 'sq_' + e.pid);
      let p = (CLUB.youthProspects || []).find(tr); if (p) return { p, wo: 'Akademie', eigen: true };
      p = (typeof SQUAD !== 'undefined' ? SQUAD : []).find(tr); if (p) return { p, wo: 'Profikader', eigen: true };
      const sq = CLUB.npcSquads || {};
      for (const k of Object.keys(sq)) { p = (sq[k] || []).find(q => q && q.stream === e.login); if (p) return { p, wo: vereinsname(k), eigen: false }; }
      return null;
    },
    entfernen(e) {
      const f = FL.finden(e); if (!f) return;
      f.p.name = typeof pickRnd === 'function' && typeof TRANSFER_SURNAMES !== 'undefined' ? pickRnd(TRANSFER_SURNAMES) : 'Neumann';
      f.p.firstName = typeof pickRnd === 'function' && typeof GERMAN_FIRST !== 'undefined' ? pickRnd(GERMAN_FIRST) : '';
      delete f.p.stream;
    },
    // Trainingsschwerpunkt: kleine Wirkung je Woche, nie über das Potenzial
    trainieren(p, sp) {
      const feld = { schuss: 'att', abschluss: 'att', passen: 'mid', technik: 'mid', abwehr: 'def', zweikampf: 'def', kopfball: 'def', tempo: 'pace', mental: 'mental', torwart: 'def' }[sp];
      if (!feld || typeof p[feld] !== 'number' || (p.ovr || 0) >= (p.truePotential || 99)) return false;
      p[feld] = Math.min(99, p[feld] + 1);
      try { p.ovr = computeOvrFromAreas(p); } catch (x) { /* ohne */ }
      return true;
    },
    darfVertrag: f => f.wo === 'Akademie' && (f.p.age || 0) >= 16,
    vertrag: f => { if (typeof W.promoteProspect === 'function') W.promoteProspect(f.p.id); }
  };
  function vereinsname(k) {
    try { const t = allGroups(LEAGUE).flatMap(g => g.group.teams).find(t => (t.dataId || String(t.id).replace(/^club_/, '')) === k); if (t) return t.name; } catch (e) { /* ohne */ }
    return 'anderer Verein';
  }
  // ── Spiel-Anbindung: Kickdraft (Kandidat im kommenden Draft) ────────────────────────────────────────────────────
  // Eigene Felder überleben Speichern und den Übergang Welt ↔ Spiel nicht – verfolgt wird über die id (bleibt über Draft, Trade,
  // Free Agency gleich; im eigenen Kader 'sq_' + id mit dflId).
  const KDA = {
    erzeugen(e) {
      const G = W.DFLGenerator, L = DFLSpiel.liga(), jg = L.draft;
      const r = G.rngAus(G.hashText('zuschauer|' + e.login + '|' + jg.jahr + '|' + Date.now()));
      const p = G.erzeugeDraftJahrgang(r, L.teams, { jahr: jg.jahr, anzahl: 1, namen: new Set() }).talente[0];
      p.id = 'zus' + jg.jahr + '_' + e.login;
      p.firstName = ''; p.name = e.name;
      const pos = (G.POS12 || []).indexOf(e.pos) >= 0 ? e.pos : '';
      if (pos && pos !== p.pos) {
        p.pos = pos; p.positions = G.positionenFuer(r, pos); G.setzeOvr(p, p.ovr);
        try { p.pace = Math.round(G.CFG.tempoBasis[G.grund(pos)] + r.normal(0, 5)); } catch (x) { /* Tempo bleibt */ }
      }
      jg.talente.push(p);
      Object.assign(jg, G.jahrgangBewerten(r, jg.talente, L.teams, { jahr: jg.jahr, reihenfolge: jg.reihenfolge, voraus: 0 }));
      try { DFLSpiel.weltGeaendert && DFLSpiel.weltGeaendert(); } catch (x) { /* ohne */ }
      return p.id;
    },
    finden(e) {
      const id = e.pid; if (!id) return null;
      const q = (typeof SQUAD !== 'undefined' ? SQUAD : []).find(x => x.dflId === id || x.id === 'sq_' + id);
      if (q) return { p: q, wo: 'Dein Kader', eigen: true };
      const L = DFLSpiel.liga(), eig = DFLSpiel.eigeneDflId();
      for (const [jg, n] of [[L.draft, 'Draft'], [L.draftNaechste, 'Draft']]) {
        const p = jg && (jg.talente || []).find(x => x.id === id); if (p) return { p, wo: n + ' ' + jg.jahr, eigen: true, draft: true };
      }
      for (const t of L.teams) {
        if (t.id === eig) continue;
        const p = (t.roster || []).concat(t.practice_squad || []).find(x => x.id === id);
        if (p) return { p, wo: ((t.city || '') + ' ' + (t.name || '')).trim(), eigen: false };
      }
      const p = (L.freie || []).find(x => x.id === id); if (p) return { p, wo: 'vereinslos', eigen: false };
      return null;
    },
    entfernen(e) {
      const f = KDA.finden(e); if (!f) return;
      const L = DFLSpiel.liga(), andere = ((L.draft && L.draft.talente) || []).filter(x => x.firstName && x.id !== f.p.id);
      const a = andere[Math.floor(Math.random() * andere.length)] || {}, b = andere[Math.floor(Math.random() * andere.length)] || {};
      f.p.firstName = a.firstName || 'Jonas'; f.p.name = b.name || 'Berger';
    },
    trainieren(p, sp) {
      const feld = { schuss: 'att', abschluss: 'att', passen: 'mid', technik: 'mid', abwehr: 'def', zweikampf: 'def', kopfball: 'def', tempo: 'pace', mental: 'mental', torwart: 'def' }[sp];
      if (!feld || typeof p[feld] !== 'number' || (p.ovr || 0) >= (p.truePotential || 99)) return false;
      p[feld] = Math.min(99, p[feld] + 1);
      try { if (feld !== 'pace' && feld !== 'mental') p.ovr = DFLGenerator.ovrAus(p); } catch (x) { /* ohne */ }
      try { if (W.spielerWerteFrisch) spielerWerteFrisch(p); } catch (x) { /* ohne */ }
      return true;
    },
    // Name zurücksetzen, falls die Historie ein Talent zum „Sohn“/„Bruder“ gemacht hat (dfl_historie.js verwandte)
    pflegen(e, f) { if (f.draft && f.p.name !== e.name) { f.p.name = e.name; f.p.firstName = ''; } },
    darfVertrag: () => false,
    vertrag() { /* Draft-Talente bekommen ihren Vertrag über den Draft */ }
  };
  const A = () => (KD() ? (W.DFLGenerator && W.DFLSpiel ? KDA : null) : FL);

  // Stream-Talente zählen nicht gegen die Akademie-Plätze (eigener Stream-Jahrgang)
  if (typeof W.generateYouthProspects === 'function') {
    const _g = W.generateYouthProspects;
    W.generateYouthProspects = function () {
      if (!spiel() || !Array.isArray(CLUB.youthProspects)) return _g.apply(this, arguments);
      const st = CLUB.youthProspects.filter(p => p && p.stream);
      CLUB.youthProspects = CLUB.youthProspects.filter(p => !(p && p.stream));
      try { return _g.apply(this, arguments); } finally { CLUB.youthProspects = CLUB.youthProspects.concat(st); }
    };
    try { generateYouthProspects = W.generateYouthProspects; } catch (e) { /* window reicht */ }
  }
  // Hochziehen kopiert die Felder einzeln – Kennzeichen und Name mitnehmen
  if (typeof W.promoteProspect === 'function') {
    const _p = W.promoteProspect;
    W.promoteProspect = function (id) {
      const vor = spiel() && (CLUB.youthProspects || []).find(p => p.id === id);
      const r = _p.apply(this, arguments);
      if (vor && vor.stream && typeof SQUAD !== 'undefined') {
        const q = SQUAD.find(x => x.id === 'sq_' + id);
        if (q) { q.stream = vor.stream; const s = Z(), e = s && s.z[vor.stream]; if (e) { nummer(e, q); laut(`@${e.login} ${e.name} ist hochgezogen – Profikader${q.number ? ', Nummer ' + q.number : ''}!`); } }
      }
      return r;
    };
    try { promoteProspect = W.promoteProspect; } catch (e) { /* window reicht */ }
  }

  // ── Befehle ───────────────────────────────────────────────────────────────────────────────────────────────────
  const zuletzt = {};
  function nachricht(d) {
    if (!d || !d.text || !spiel()) return;
    const login = String(d.login || '').toLowerCase(); if (!login) return;
    const t = String(d.text).trim();
    anwesend(login, t);
    if (t[0] !== '!') return;
    const teile = t.slice(1).split(/\s+/), c = (teile[0] || '').toLowerCase(), args = teile.slice(1);
    if (/^[1-9]$/.test(c)) { stimme(login, +c); return; }
    if (!einst().befehle) return;
    if (Date.now() - (zuletzt[login] || 0) < CFG.abstand) return;
    zuletzt[login] = Date.now();
    const name = d.name || login;
    if (c === 'dabei') dabei(login, name, args);
    else if (c === 'training') training(login, (args[0] || '').toLowerCase());
    else if (c === 'karte') karte(login);
    else if (c === 'bitte') bitte(login, (args[0] || '').toLowerCase());
    else if (c === 'raus') raus(login);
    else if (c === 'tipp') tipp(login, args.join(''));
    else if (c === 'befehle' || c === 'hilfe' || c === 'stream') laut('Befehle: !dabei [Position] [Nummer] · !training schuss|passen|technik|abwehr|tempo|kopfball|mental|torwart · !karte · !tipp 2:1 · !bitte einsatz|vertrag · !raus · abstimmen mit !1, !2 … – wer im Chat mitredet, trainiert sein Talent (Befehle zählen nicht).');
  }
  function dabei(login, name, args) {
    const s = Z(), a = A(); if (!s || !a) return;
    const e = s.z[login];
    if (e && e.art !== 'weg') { sag(`@${login} du bist schon dabei – !karte zeigt dein Talent.`); return; }
    if (e && e.art === 'weg' && absWoche() - (e.wegSeit || 0) < CFG.warteWochen) { sag(`@${login} ein neues Talent gibt es erst in ein paar Wochen.`); return; }
    if (!nameOk(name)) { sag(`@${login} dein Name ist leider nicht zugelassen.`); return; }
    const pos = (args.find(x => /^[a-zA-Z]{2,3}$/.test(x)) || '').toUpperCase();
    const nr = +(args.find(x => /^\d{1,2}$/.test(x)) || 0) || null;
    const neu = { login, name, pos, nr, training: '', seit: absWoche(), art: 'warte' };
    if (s.jg.n >= CFG.jahrgang) {
      if (s.warte.indexOf(login) < 0) s.warte.push(login);
      s.z[login] = neu; hinweis(`${esc(name)} steht auf der Warteliste (Platz ${s.warte.indexOf(login) + 1})`);
      sag(`@${login} der Stream-Jahrgang ist voll – Warteliste Platz ${s.warte.indexOf(login) + 1}.`); speichern(); return;
    }
    anlegen(neu);
  }
  function anlegen(e) {
    const s = Z(), a = A(); if (!s || !a) return false;
    try { e.pid = a.erzeugen(e); } catch (x) { console.warn('[KS-Stream] Talent', x); hinweis('Talent konnte nicht angelegt werden', true); sag(`@${e.login} das hat nicht geklappt – versuch es später noch einmal.`); return false; }
    e.art = 'aktiv'; e.seit = absWoche(); s.z[e.login] = e; s.jg.n++;
    s.warte = s.warte.filter(l => l !== e.login);
    ereignis({ tag: 'Neues Talent', text: `<b>${esc(e.name)}</b> ist dabei – ${KD() ? 'im nächsten Draft-Jahrgang' : 'in deiner Akademie'}${e.pos ? ' (' + esc(e.pos) + ')' : ''}.` });
    const f = a.finden(e);
    if (f) laut(`@${e.login} willkommen! ${e.name}: ${POS_NAME[f.p.pos] || f.p.pos}, ${f.p.age} Jahre, Stärke ${f.p.ovr} – ${KD() ? 'Kandidat im ' + f.wo : 'in der Akademie'}. Mit !training wählst du den Schwerpunkt.`);
    speichern(); zeichnePanel();
    return true;
  }
  function training(login, sp) {
    const s = Z(), e = s && s.z[login]; if (!e || e.art !== 'aktiv') return;
    const ok = ['schuss', 'abschluss', 'passen', 'technik', 'abwehr', 'zweikampf', 'kopfball', 'tempo', 'mental', 'torwart'];
    if (ok.indexOf(sp) < 0) { sag(`@${login} Training: ${ok.join(', ')}`); return; }
    e.training = sp; sag(`@${login} ${e.name} trainiert jetzt ${sp}.`); speichern();
  }
  function raus(login) {
    const s = Z(), e = s && s.z[login]; if (!e) return;
    try { const a = A(); if (a && e.art === 'aktiv') a.entfernen(e); } catch (x) { /* ohne */ }
    delete s.z[login]; s.warte = s.warte.filter(l => l !== login);
    sag(`@${login} du bist raus – dein Spieler bekommt einen neuen Namen.`); speichern(); zeichnePanel();
  }
  function bitte(login, art) {
    const s = Z(), e = s && s.z[login]; if (!e || e.art !== 'aktiv' || ['einsatz', 'vertrag'].indexOf(art) < 0) return;
    if (s.anfragen.some(a => a.login === login && absWoche() - a.w < 1)) { sag(`@${login} eine Anfrage pro Woche – der Trainer denkt noch nach.`); return; }   // eine Anfrage je Woche
    s.anfragen = s.anfragen.filter(a => a.login !== login).concat({ id: login + '_' + Date.now(), login, art, w: absWoche() }).slice(-CFG.anfragenMax);
    zeichneAnfragen(); speichern();
    sag(`@${login} deine Bitte um ${art === 'einsatz' ? 'einen Einsatz' : 'einen Vertrag'} liegt beim Trainer.`);
  }
  // Wunsch-Rückennummer, sobald der Spieler im eigenen Profikader steht (einmal, danach darf der Streamer umnummerieren)
  function nummer(e, p) {
    if (!e.nr || e.nrVergeben || !p || typeof SQUAD === 'undefined' || SQUAD.indexOf(p) < 0) return;
    if (!SQUAD.some(q => q !== p && q.number === e.nr)) p.number = e.nr;
    e.nrVergeben = true;
  }

  // ── Wochentakt: Training, Abgänge, Warteliste ─────────────────────────────────────────────────────────────────
  function woche() {
    const s = Z(), a = A(); if (!s || !a) return;
    Object.values(s.z).forEach(e => {
      if (e.art !== 'aktiv') return;
      const f = a.finden(e);
      if (!f) { e.art = 'weg'; e.wegSeit = absWoche(); laut(`@${e.login} ${e.name} hat seine Karriere beendet. Mit !dabei geht es später neu los.`); return; }
      if (a.pflegen) a.pflegen(e, f);
      nummer(e, f.p);
      if (e.wo && e.wo !== f.wo) {
        if (!f.eigen) laut(`@${e.login} Wechsel: ${e.name} spielt jetzt bei ${f.wo}.`);
        else if (f.wo === 'Dein Kader' && /^Draft/.test(e.wo)) laut(`@${e.login} gedraftet! ${e.name} gehört jetzt zum Kader${f.p.number ? ', Nummer ' + f.p.number : ''}.`);
      }
      e.wo = f.wo;
      if (e.training && Math.random() < CFG.trainingChance) a.trainieren(f.p, e.training);
    });
    while (s.warte.length && s.jg.n < CFG.jahrgang) { const e = s.z[s.warte[0]]; if (!e) { s.warte.shift(); continue; } if (!anlegen(e)) break; }
  }
  if (typeof W.advanceCalendarWeek === 'function') {
    const _w = W.advanceCalendarWeek;
    W.advanceCalendarWeek = function () { const r = _w.apply(this, arguments); if (r !== false) { try { woche(); } catch (e) { console.warn('[KS-Stream] Woche', e); } } return r; };
    try { advanceCalendarWeek = W.advanceCalendarWeek; } catch (e) { /* window reicht */ }
  }

  // ── Chat als Co-Trainer: Abstimmungen im Live-Spiel ──────────────────────────────────────────────────────────
  let V = null;
  const LIVE = () => { try { return W.KSPcSpieltag && KSPcSpieltag.live(); } catch (e) { return null; } };
  function abstimmung(art) {
    const L = LIVE(), tk = W.KSPcTaktik, sp = W.KSPcSpieltag;
    if (!L || L.fertig || !tk || (V && !V.fertig) || (D && !D.fertig) || !chatAn()) return false;
    let titel, opt, sek = CFG.abstimmSek;
    if (art === 'kabine') { titel = 'Kabinenansprache zur Halbzeit'; opt = Object.keys(tk.KABINE).map(k => ({ k, name: tk.KABINE[k].name })); sek = CFG.kabineSek; }
    else if (art === 'zuruf') { titel = 'Zuruf an die Mannschaft'; opt = Object.keys(tk.ZURUFE).map(k => ({ k, name: tk.ZURUFE[k].name })); }
    else if (art === 'ausrichtung' && sp && sp.AUSRICHTUNG) { titel = 'Ausrichtung'; opt = sp.AUSRICHTUNG.map((a, i) => ({ k: i, name: a.name })); }
    else return false;
    V = { art, titel, opt: opt.slice(0, 9), ende: Date.now() + sek * 1000, stimmen: new Map(), live: L };
    zeichneAbstimmung();
    laut(`Chat ist Co-Trainer – ${titel}: ${V.opt.map((o, i) => '!' + (i + 1) + ' ' + o.name).join(' · ')} (${sek} s)`);
    return true;
  }
  function stimme(login, i) {
    if (D && !D.fertig) { if (i === 1 || i === 2) { if (!D.stimmen.has(login)) einheitFuer(login, 1, 'normal'); D.stimmen.set(login, i - 1); } return; }
    if (!V || V.fertig || !einst().abstimmen || i < 1 || i > V.opt.length) return;
    if (!V.stimmen.has(login)) einheitFuer(login, 1, 'normal');
    V.stimmen.set(login, i - 1);
  }
  function auszaehlen() {
    const n = V.opt.map(() => 0); V.stimmen.forEach(i => n[i]++);
    return n;
  }
  function abstimmungEnde(ueberstimmt) {
    if (!V || V.fertig) return;
    V.fertig = true;
    const n = auszaehlen(), max = Math.max(...n), sum = n.reduce((a, b) => a + b, 0);
    const sieger = sum ? n.indexOf(max) : -1;
    V.ergebnis = ueberstimmt ? 'Der Streamer hat überstimmt.' : sieger < 0 ? 'Keine Stimmen – der Streamer entscheidet.' : `Der Chat hat entschieden: ${V.opt[sieger].name}`;
    if (!ueberstimmt && sieger >= 0) {
      const L = V.live, o = V.opt[sieger];
      try {
        if (V.art === 'kabine') KSPcTaktik.kabine(L, o.k);
        else if (V.art === 'zuruf') KSPcTaktik.zurufen(L, o.k);
        else if (V.art === 'ausrichtung') KSPcSpieltag.ausrichtungSetzen(o.k);
        if (KSPcSpieltag.neu) KSPcSpieltag.neu();
      } catch (e) { console.warn('[KS-Stream] Abstimmung', e); }
    }
    zeichneAbstimmung();
    laut(V.ergebnis + (sum ? ` (${sum} Stimmen)` : ''));
    setTimeout(() => { if (V && V.fertig) { V = null; zeichneAbstimmung(); } }, 5000);
  }

  // ── Chat-Training (Stufe 3) ───────────────────────────────────────────────────────────────────────────────────
  // Einheiten: „normal“ (Dabeisein, Abstimmung, Tipp) zählt gegen den Tagesdeckel und im Trainingslager doppelt; „bonus“
  // (Duell, richtiger Tipp, Raid, Sub, Geschenk-Sub, Bits) kommt obendrauf. 10 Einheiten = +1 im Schwerpunkt, nie über das Potenzial.
  const tagHeute = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
  const lagerAn = () => { const s = Z(); return !!(s && s.lager.bis > Date.now()); };
  function heute(e) {
    const t = tagHeute();
    if (!e.h || e.h.t !== t) { e.h = { t, n: 0, alle: 0, plus: 0, gift: 0, bits: 0, bitsRest: 0 }; e.streams = (e.streams || 0) + 1; }
    return e.h;
  }
  const SCHWERPUNKT = { TW: 'torwart', IV: 'abwehr', LV: 'abwehr', RV: 'abwehr', ZDM: 'abwehr', ZM: 'passen', LM: 'passen', RM: 'passen', ZOM: 'technik', LF: 'tempo', RF: 'tempo', ST: 'schuss' };
  const NAME_SP = { schuss: 'Schuss', abschluss: 'Abschluss', passen: 'Passen', technik: 'Technik', abwehr: 'Abwehr', zweikampf: 'Zweikampf', kopfball: 'Kopfball', tempo: 'Tempo', mental: 'Mental', torwart: 'Torwart' };
  let speicherTimer = null;
  const speichernBald = () => { if (!speicherTimer) speicherTimer = setTimeout(() => { speicherTimer = null; speichern(); }, 60000); };
  function einheiten(e, n, art) {
    if (!e || e.art !== 'aktiv' || n <= 0) return 0;
    const h = heute(e);
    if (art === 'normal') {
      const lager = lagerAn(), deckel = CFG.deckel * (lager ? 2 : 1);
      n = Math.max(0, Math.min(n * (lager ? 2 : 1), deckel - h.n));
      h.n += n;
    }
    if (!n) return 0;
    h.alle += n; e.einh = (e.einh || 0) + n;
    const sk = 's' + LEAGUE.season; e.saison = e.saison && e.saison.k === sk ? e.saison : { k: sk, n: 0, plus: 0 }; e.saison.n += n;
    const a = A(), f = a && a.finden(e);
    while (f && e.einh >= CFG.jePunkt) {
      const sp = e.training || SCHWERPUNKT[f.p.pos] || 'passen';
      if (!a.trainieren(f.p, sp)) { e.einh = CFG.jePunkt; e.amPot = true; break; }
      e.einh -= CFG.jePunkt; e.amPot = false; e.plus = (e.plus || 0) + 1; h.plus++; e.saison.plus++;
      fortschrittMelden(e, NAME_SP[sp] || sp, f.p.ovr);
      ereignis({ tag: 'Chat-Training', text: `<b>${esc(e.name)}</b> legt zu: ${esc(NAME_SP[sp] || sp)} +1 · Stärke ${f.p.ovr}. <small>@${esc(e.login)}</small>` });
    }
    speichernBald();
    return n;
  }
  // Fortschritte sammeln und nach 20 s in einer Zeile melden (Nutzer: der Chat soll kein Bot-Chat werden)
  let fortPuffer = [], fortTimer = null;
  function fortschrittMelden(e, sp, ovr) {
    fortPuffer.push({ login: e.login, name: e.name, sp, ovr });
    if (!fortTimer) fortTimer = setTimeout(() => {
      const l = fortPuffer; fortPuffer = []; fortTimer = null;
      if (l.length === 1) laut(`@${l[0].login} Trainingsfortschritt! ${l[0].name}: ${l[0].sp} +1 – Stärke jetzt ${l[0].ovr}.`);
      else laut(`Trainingsfortschritt: ${l.slice(0, 8).map(x => `${x.name} ${x.sp} +1 (${x.ovr})`).join(' · ')}${l.length > 8 ? ` und ${l.length - 8} weitere` : ''}`);
    }, 20000);
  }
  function einheitFuer(login, n, art) { const s = Z(), e = s && s.z[login]; return e ? einheiten(e, n, art) : 0; }
  // Dabeisein: eine ECHTE Nachricht je 10 Minuten zählt (Nutzer 2026-10-20: „wenn der Chat nur aus !schuss besteht, wäre es blöd“) –
  // keine Befehle, mindestens 3 Wörter oder 15 Zeichen, keine Wiederholung der eigenen letzten Nachricht, keine Kopie anderer (2 Min.)
  const zuletztGesagt = [];   // { k, login, zeit }
  const kern = t => String(t).toLowerCase().replace(/[^a-z0-9äöüß]+/g, ' ').trim();
  function echteNachricht(login, t) {
    if (!t || t[0] === '!') return false;
    const k = kern(t), woerter = k.split(' ').filter(w => w.length > 1).length;
    if (woerter < 3 && k.replace(/ /g, '').length < 15) return false;
    const jetzt = Date.now();
    while (zuletztGesagt.length && jetzt - zuletztGesagt[0].zeit > 120000) zuletztGesagt.shift();
    const kopie = zuletztGesagt.some(x => x.k === k && x.login !== login);
    zuletztGesagt.push({ k, login, zeit: jetzt }); if (zuletztGesagt.length > 200) zuletztGesagt.shift();
    return !kopie;
  }
  function anwesend(login, t) {
    const echt = echteNachricht(login, t);
    const s = Z(), e = s && s.z[login]; if (!e || e.art !== 'aktiv' || !echt) return;
    const k = kern(t); if (e.letzte === k) return; e.letzte = k;
    if (Date.now() - (e.da || 0) < CFG.anwesendMin * 60000) return;
    e.da = Date.now(); einheiten(e, 1, 'normal');
  }

  // Tippspiel: vor dem Anpfiff des nächsten Spiels, Heim:Gast
  const fxKey = () => { try { const fx = CURRENT_FIXTURE; return fx ? [LEAGUE.season, LEAGUE.week, fx.type || '', fx.opponent || fx.opp || fx.home || '', fx.away || ''].join('|') : ''; } catch (e) { return ''; } };
  function tipp(login, arg) {
    const s = Z(), e = s && s.z[login]; if (!s) return;
    if (!e || e.art !== 'aktiv') { sag(`@${login} tippen können Zuschauer mit Talent – erst !dabei.`); return; }
    const m = /^(\d{1,2})[:\-](\d{1,2})$/.exec(arg || '');
    if (!m) { sag(`@${login} so tippen: !tipp 2:1 (Heim:Gast)`); return; }
    const k = fxKey(), L = LIVE();
    if (!k || (L && !L.fertig) || (typeof G !== 'undefined' && G && (G.running || G.ended))) { sag(`@${login} getippt wird vor dem Anpfiff.`); return; }
    if (!s.tipp || s.tipp.k !== k) s.tipp = { k, l: {} };
    const neu = !s.tipp.l[login];
    s.tipp.l[login] = [+m[1], +m[2]];
    if (neu) einheiten(e, CFG.tippPlus, 'normal');
    sag(`@${login} Tipp ${+m[1]}:${+m[2]} notiert${neu ? ' (+1 Einheit)' : ''}.`);
  }
  if (typeof W.processFixtureResult === 'function') {
    const _pf = W.processFixtureResult;
    W.processFixtureResult = function () {
      let k = '', h = null, g = null;
      try { k = fxKey(); h = G.homeGoals; g = G.awayGoals; } catch (e) { /* ohne */ }
      const r = _pf.apply(this, arguments);
      try { tippAuswerten(k, h, g); } catch (e) { console.warn('[KS-Stream] Tipp', e); }
      return r;
    };
    try { processFixtureResult = W.processFixtureResult; } catch (e) { /* window reicht */ }
  }
  function tippAuswerten(k, h, g) {
    const s = Z(); if (!s || !s.tipp || s.tipp.k !== k || h == null) return;
    const richtig = Object.keys(s.tipp.l).filter(l => s.tipp.l[l][0] === h && s.tipp.l[l][1] === g);
    richtig.forEach(l => einheitFuer(l, CFG.tippRichtig, 'bonus'));
    const n = Object.keys(s.tipp.l).length; s.tipp = null;
    if (n) {
      laut(`Tipp-Auflösung ${h}:${g}: ${richtig.length ? 'richtig getippt – ' + richtig.map(l => '@' + l).join(', ') + ` (+${CFG.tippRichtig} Einheiten)` : `keiner von ${n} lag richtig`}.`);
      if (richtig.length) ereignis({ tag: 'Tippspiel', text: `${h}:${g} – richtig: ${richtig.map(l => '<b>@' + esc(l) + '</b>').join(', ')}` });
    }
  }

  // Trainingslager: 15 Minuten zählt jede Einheit doppelt, höchstens einmal je Stunde
  function lagerStarten() {
    const s = Z(); if (!s) return false;
    const pause = s.lager.start + CFG.lagerPauseMin * 60000 - Date.now();
    if (lagerAn() || pause > 0) { hinweis(lagerAn() ? 'Das Trainingslager läuft schon' : `Nächstes Trainingslager in ${Math.ceil(pause / 60000)} Min.`); return false; }
    s.lager = { start: Date.now(), bis: Date.now() + CFG.lagerMin * 60000 };
    laut(`Trainingslager! ${CFG.lagerMin} Minuten lang zählt jede Trainingseinheit doppelt – schreibt im Chat, stimmt ab, tippt.`);
    zeichneLager(); zeichnePanel();
    return true;
  }
  function zeichneLager() {
    const box = ov().querySelector('.kstw-lager'), s = Z();
    if (!s || !lagerAn()) { if (box._an) { box._an = false; box.innerHTML = ''; if (s && s.lager.bis && !s.lager.gemeldet) { s.lager.gemeldet = true; sag('Das Trainingslager ist vorbei – danke fürs Mitmachen!'); } } return; }
    const rest = Math.ceil((s.lager.bis - Date.now()) / 1000), n = Object.values(s.z).filter(e => e.art === 'aktiv' && e.h && e.h.t === tagHeute() && e.da > s.lager.start).length;
    box._an = true; s.lager.gemeldet = false;
    box.innerHTML = `<div class="kstw-k kstw-lagerk"><span class="kstw-tag gold">Trainingslager</span><div><b>Jede Einheit zählt doppelt</b><br><small>vom Streamer ausgerufen · ${n} Talente trainieren</small></div><div class="kstw-uhr">${Math.floor(rest / 60)}:${String(rest % 60).padStart(2, '0')}</div></div>`;
  }

  // Chat-Duell: zwei Zuschauer-Talente, der Chat stimmt ab (!1/!2), Sieger +5, Verlierer +1
  let D = null;
  const THEMEN = ['Wer gewinnt das Elfmeterschießen?', 'Wer gewinnt das Kopfballduell?', 'Wer ist schneller über 30 Meter?', 'Wer trifft öfter die Latte?', 'Wer gewinnt beim Torwandschießen?', 'Wer jongliert länger?'];
  function duellKandidaten() {
    const s = Z(), a = A(); if (!s || !a) return [];
    return Object.values(s.z).filter(e => e.art === 'aktiv').map(e => ({ e, f: a.finden(e) })).filter(x => x.f);
  }
  function duellStarten(l1, l2) {
    if ((V && !V.fertig) || (D && !D.fertig)) { hinweis('Gerade läuft schon eine Abstimmung'); return false; }
    const k = duellKandidaten(); if (k.length < 2) { hinweis('Für ein Duell braucht es zwei Zuschauer-Talente', true); return false; }
    const heuteAktiv = x => x.e.h && x.e.h.t === tagHeute();
    const zufall = arr => arr[Math.floor(Math.random() * arr.length)];
    let a = k.find(x => x.e.login === l1), b = k.find(x => x.e.login === l2 && x !== a);
    const pool = () => { const h = k.filter(heuteAktiv); return h.length >= 2 ? h : k; };
    if (!a) a = zufall(pool().filter(x => x !== b));
    if (!b) b = zufall(pool().filter(x => x !== a));
    if (!a || !b || a === b) return false;
    D = { a: a.e.login, b: b.e.login, thema: zufall(THEMEN), ende: Date.now() + CFG.duellSek * 1000, stimmen: new Map() };
    laut(`Chat-Duell! ${THEMEN.indexOf(D.thema) >= 0 ? D.thema : ''} !1 ${a.e.name} (@${a.e.login}) gegen !2 ${b.e.name} (@${b.e.login}) – ${CFG.duellSek} Sekunden.`);
    zeichneDuell();
    return true;
  }
  function duellEnde() {
    if (!D || D.fertig) return;
    D.fertig = true;
    const n = [0, 0]; D.stimmen.forEach(i => n[i]++);
    const s = Z(), ea = s.z[D.a], eb = s.z[D.b], A_ = A(), fa = ea && A_.finden(ea), fb = eb && A_.finden(eb);
    let sieg;
    if (n[0] !== n[1]) sieg = n[0] > n[1] ? 0 : 1;
    else { const oa = (fa && fa.p.ovr) || 50, ob = (fb && fb.p.ovr) || 50; sieg = Math.random() < oa / (oa + ob) ? 0 : 1; }   // Gleichstand: Zufall nach Stärke
    const w = sieg ? eb : ea, l = sieg ? ea : eb;
    einheiten(w, CFG.duellSieg, 'bonus'); einheiten(l, CFG.duellNiederlage, 'bonus');
    D.ergebnis = `${w ? w.name : '?'} gewinnt${n[0] + n[1] ? ` (${Math.max(...n)}:${Math.min(...n)} Stimmen)` : ' – der Zufall hat entschieden'}`;
    laut(`Duell entschieden: ${D.ergebnis}! +${CFG.duellSieg} Einheiten für @${w ? w.login : '?'}, +${CFG.duellNiederlage} für @${l ? l.login : '?'}.`);
    zeichneDuell();
    setTimeout(() => { if (D && D.fertig) { D = null; zeichneDuell(); } }, 6000);
  }
  function zeichneDuell() {
    const box = ov().querySelector('.kstw-duell');
    if (!D) { box.innerHTML = ''; return; }
    const s = Z(), A_ = A(), ea = s.z[D.a], eb = s.z[D.b], fa = ea && A_ && A_.finden(ea), fb = eb && A_ && A_.finden(eb);
    const n = [0, 0]; D.stimmen.forEach(i => n[i]++);
    const sum = n[0] + n[1], pa = sum ? Math.round(n[0] / sum * 100) : 50, rest = Math.max(0, Math.ceil((D.ende - Date.now()) / 1000));
    const seite = (e, f) => `<div class="kstw-ds"><b>${esc(e ? e.name : '?')}</b><small>${esc(f ? f.p.pos : '')} · Stärke ${f ? f.p.ovr : '?'} · @${esc(e ? e.login : '')}</small></div>`;
    box.innerHTML = `<div class="kstw-k"><h4><span class="kstw-tag">Chat-Duell</span>${esc(D.thema)}</h4>
      <div class="kstw-dd">${seite(ea, fa)}<div class="kstw-vs">VS</div>${seite(eb, fb)}</div>
      <div class="kstw-dbar"><span style="width:${pa}%;background:#9146ff">!1 · ${sum ? pa + ' %' : ''}</span><span style="width:${100 - pa}%;background:#2c7cb5">!2 · ${sum ? 100 - pa + ' %' : ''}</span></div>
      <div class="kstw-fuss"><span>${D.fertig ? esc(D.ergebnis) : `${sum} Stimmen · noch ${Math.floor(rest / 60)}:${String(rest % 60).padStart(2, '0')} · Sieger +${CFG.duellSieg} Einheiten, Verlierer +${CFG.duellNiederlage}`}</span></div></div>`;
  }

  // Bestenliste „Fleißigste Talente heute“ (auf Knopfdruck, 20 s)
  let bestenBis = 0;
  function bestenliste() { bestenBis = Date.now() + CFG.bestenSek * 1000; zeichneBesten(); }
  function zeichneBesten() {
    const box = ov().querySelector('.kstw-besten'), s = Z();
    if (!s || Date.now() > bestenBis) { if (box.innerHTML) box.innerHTML = ''; return; }
    const t = tagHeute(), a = A();
    const heuteL = Object.values(s.z).filter(e => e.art === 'aktiv' && e.h && e.h.t === t && e.h.alle > 0).sort((x, y) => y.h.alle - x.h.alle).slice(0, 5);
    const sk = 's' + LEAGUE.season, saison = Object.values(s.z).filter(e => e.saison && e.saison.k === sk).sort((x, y) => y.saison.n - x.saison.n)[0];
    const sig = JSON.stringify([heuteL.map(e => [e.login, e.h.alle, e.h.plus]), saison && saison.saison]);
    if (box._sig === sig && box.innerHTML) return; box._sig = sig;
    box.innerHTML = `<div class="kstw-k"><h4><span class="kstw-tag">Bestenliste</span>Fleißigste Talente heute</h4>
      ${heuteL.length ? heuteL.map((e, i) => { const f = a && a.finden(e); return `<div class="kstw-r"><span class="kstw-rn">${i + 1}</span><span><b>${esc(e.name)}</b> <small>${esc(f ? f.p.pos : '')}</small></span><span class="kstw-rp">${e.h.alle} Einh.</span><span class="kstw-rs">${e.h.plus ? '+' + e.h.plus : ''}</span></div>`; }).join('') : '<p>Heute hat noch niemand trainiert – schreibt im Chat!</p>'}
      ${saison ? `<div class="kstw-mini">Saison: ${esc(saison.name)} ${saison.saison.n} Einh. · +${saison.saison.plus} Stärke</div>` : ''}</div>`;
  }

  // Raid, Sub, Geschenk-Sub, Bits (kommen über den Twitch-Chat, auch ohne Anmeldung)
  function twitchEreignis(d) {
    if (!d || !spiel() || !einst().befehle) return;
    const s = Z(); if (!s) return;
    const login = String(d.login || '').toLowerCase(), e = s.z[login], name = d.name || login;
    if (d.typ === 'raid') {
      if ((d.anzahl || 0) < CFG.raidMin) return;
      const aktiv = Object.values(s.z).filter(x => x.art === 'aktiv');
      aktiv.forEach(x => einheiten(x, CFG.raidPlus, 'bonus'));
      ereignis({ tag: 'Raid', text: `<b>${esc(name)}</b> raidet mit ${d.anzahl} Leuten – alle Zuschauer-Talente bekommen <b>+${CFG.raidPlus} Einheiten</b>!` });
      laut(`Willkommen, Raid von ${name} mit ${d.anzahl} Leuten! Alle ${aktiv.length} Zuschauer-Talente +${CFG.raidPlus} Einheiten. Neu hier? !dabei`);
    } else if (d.typ === 'sub') {
      if (e && e.art === 'aktiv') { einheiten(e, CFG.subPlus, 'bonus'); ereignis({ tag: 'Sub', text: `Danke, <b>${esc(name)}</b>! ${esc(e.name)} bekommt <b>+${CFG.subPlus} Einheiten</b>.` }); }
      else sag(`@${login} danke für den Sub! Mit !dabei bekommst du ein eigenes Talent.`);
    } else if (d.typ === 'subgift') {
      if (!e || e.art !== 'aktiv') return;
      const h = heute(e), n = Math.min(CFG.giftPlus * (d.anzahl || 1), CFG.giftMax - h.gift);
      if (n <= 0) return;
      h.gift += n; einheiten(e, n, 'bonus');
      ereignis({ tag: 'Geschenk-Sub', text: `<b>${esc(name)}</b> verschenkt Subs – ${esc(e.name)} +${n} Einheiten.` });
    } else if (d.typ === 'bits') {
      if (!e || e.art !== 'aktiv') return;
      const h = heute(e); h.bitsRest += d.anzahl || 0;
      const n = Math.min(Math.floor(h.bitsRest / CFG.bitsJe), CFG.bitsMax - h.bits);
      h.bitsRest %= CFG.bitsJe;
      if (n <= 0) return;
      h.bits += n; einheiten(e, n, 'bonus');
      sag(`@${login} danke für die Bits! ${e.name} +${n} Einheit${n > 1 ? 'en' : ''}.`);
    }
    zeichnePanel();
  }

  // ── Overlays ────────────────────────────────────────────────────────────────────────────────────────────────
  function ov() {
    let o = $('kstw'); if (o) return o;
    o = document.createElement('div'); o.id = 'kstw';
    o.innerHTML = '<div class="kstw-kamera">Kamera</div><div class="kstw-quitt"></div><div class="kstw-lager"></div><div class="kstw-besten"></div><div class="kstw-duell"></div><div class="kstw-anfragen"></div><div class="kstw-vote"></div><div class="kstw-karten"></div><div class="kstw-ereignisse"></div><div class="kstw-live"></div>';
    document.body.appendChild(o);
    o.addEventListener('click', klickOv);
    return o;
  }
  function zeichneAbstimmung() {
    const box = ov().querySelector('.kstw-vote');
    if (!V) { box.innerHTML = ''; return; }
    const n = auszaehlen(), sum = n.reduce((a, b) => a + b, 0), max = Math.max(0, ...n), rest = Math.max(0, Math.ceil((V.ende - Date.now()) / 1000));
    box.innerHTML = `<div class="kstw-k"><h4><span class="kstw-tag">Chat ist Co-Trainer</span>${esc(V.titel)}</h4>
      ${V.opt.map((o, i) => { const pz = sum ? Math.round(n[i] / sum * 100) : 0; return `<div class="kstw-opt"><span class="kstw-nr">!${i + 1}</span><div class="kstw-bar${sum && n[i] === max ? ' top' : ''}"><i style="width:${pz}%"></i><span>${esc(o.name)}</span></div><b>${pz} %</b></div>`; }).join('')}
      <div class="kstw-fuss"><span>${V.fertig ? esc(V.ergebnis) : `${sum} Stimmen · noch 0:${String(rest).padStart(2, '0')}`}</span>${V.fertig ? '' : '<button type="button" class="kstw-knopf hell" data-kstw="ueberstimmen">Überstimmen</button>'}</div></div>`;
  }
  const karten = [];
  function karte(login) {
    const s = Z(), e = s && s.z[login], a = A(); if (!e || e.art !== 'aktiv' || !a) return;
    const f = a.finden(e); if (!f) return;
    if (karten.some(k => k.login === login)) return;
    karten.push({ login, bis: Date.now() + CFG.karteSek * 1000, html: karteHtml(e, f) });
    zeichneKarten();
  }
  function gesicht(p) {
    try {
      if (W.KSVerein && KSVerein.gesicht) return KSVerein.gesicht(p, 'fcm');
      if (W.DFLIdentitaet && DFLIdentitaet.gesichtSvg) { const f = W.DFLSpiel && DFLSpiel.franchise(DFLSpiel.eigeneDflId()); return DFLIdentitaet.gesichtSvg(p, f ? { farben: f.farben } : null); }   // Kickdraft
    } catch (e) { /* ohne Gesicht */ }
    return '';
  }
  function karteHtml(e, f) {
    const p = f.p, pot = f.eigen && W.potentialRange ? (() => { try { const r = potentialRange(p, (CLUB.facilities && CLUB.facilities.scouting) || 1); return r.lo === r.hi ? r.lo : r.lo + '–' + r.hi; } catch (x) { return '?'; } })() : '?';
    return `<div class="kstw-k kstw-karte"><h4><span class="kstw-tag">!karte</span>Talent von @${esc(e.login)}</h4>
      <div class="kstw-kk"><span class="kstw-gesicht">${gesicht(p)}</span><div><b>${esc(p.name)}</b><small>${esc(p.pos || '')}${e.nr ? ' · #' + e.nr : ''} · ${p.age || '?'} Jahre · ${esc(f.wo)}</small><small>dabei seit Saison ${Math.floor(e.seit / 100)}${p.gamesPlayed ? ' · ' + p.gamesPlayed + ' Spiele' : ''}</small></div></div>
      <div class="kstw-werte"><div><small>Stärke</small><b>${p.ovr || '?'}</b></div><div><small>Potenzial</small><b>${esc(pot)}</b></div><div><small>Training</small><b>${esc(NAME_SP[e.training] || e.training || '–')}</b></div></div>
      ${fortschrittHtml(e, f)}</div>`;
  }
  function fortschrittHtml(e, f) {
    const h = e.h && e.h.t === tagHeute() ? e.h : { n: 0 }, sp = e.training || SCHWERPUNKT[f.p.pos] || 'passen', ein = Math.min(e.einh || 0, CFG.jePunkt);
    return `<div class="kstw-fort"><div class="kstw-fz"><span>${e.amPot ? 'Am Potenzial – mehr geht gerade nicht' : 'Nächster Punkt ' + esc(NAME_SP[sp] || sp)}</span><span>${ein} / ${CFG.jePunkt} Einheiten</span></div>
      <div class="kstw-fbar"><i style="width:${ein / CFG.jePunkt * 100}%"></i></div>
      <div class="kstw-mini">heute ${h.n} von ${CFG.deckel * (lagerAn() ? 2 : 1)} Einheiten${lagerAn() ? ' · Trainingslager ×2 aktiv' : ''}${e.streams ? ' · ' + e.streams + ' Streams' : ''}${e.plus ? ` · <span class="kstw-plus">+${e.plus} durch den Chat</span>` : ''}</div></div>`;
  }
  function zeichneKarten() {
    const box = ov().querySelector('.kstw-karten'), jetzt = Date.now();
    while (karten.length && karten[0].bis < jetzt) karten.shift();
    const k = karten[0];
    box.innerHTML = k ? k.html : '';
  }
  const ereignisse = [];
  function ereignis(x) { ereignisse.push(Object.assign({ bis: Date.now() + CFG.ereignisSek * 1000 }, x)); zeichneEreignisse(); }
  function zeichneEreignisse() {
    const box = ov().querySelector('.kstw-ereignisse'), jetzt = Date.now();
    while (ereignisse.length && ereignisse[0].bis < jetzt) ereignisse.shift();
    const e = ereignisse[0];
    box.innerHTML = e ? `<div class="kstw-k kstw-ereignis${e.warn ? ' warn' : ''}"><span class="kstw-tag">${esc(e.tag)}</span><p>${e.text}</p></div>` : '';
  }
  const hinweis = (text, warn) => ereignis({ tag: 'Stream', text, warn, bis: Date.now() + 4000 });
  function zeichneAnfragen() {
    const s = Z(), box = ov().querySelector('.kstw-anfragen'); if (!s) { box.innerHTML = ''; return; }
    const a = s.anfragen[0];
    if (!a) { box.innerHTML = ''; return; }
    const e = s.z[a.login], f = e && A() && A().finden(e);
    const vertragOk = a.art === 'vertrag' && f && A().darfVertrag(f);
    box.innerHTML = `<div class="kstw-k"><h4><span class="kstw-tag">Anfrage</span>aus dem Chat${s.anfragen.length > 1 ? ` <small>+${s.anfragen.length - 1}</small>` : ''}</h4>
      <p><b>@${esc(a.login)}</b> bittet um ${a.art === 'einsatz' ? 'einen <b>Einsatz</b>' : 'einen <b>Vertrag</b>'} für <b>${esc(e ? e.name : a.login)}</b>${f ? ` (${esc(f.p.pos || '')}, ${f.p.age || '?'} J., ${esc(f.wo)})` : ''}.</p>
      <div class="kstw-ak">${vertragOk ? '<button type="button" class="kstw-knopf" data-kstw="a-vertrag">Hochziehen</button>' : '<button type="button" class="kstw-knopf" data-kstw="a-ja">Zusagen</button>'}
        <button type="button" class="kstw-knopf hell" data-kstw="a-spaeter">Später</button><button type="button" class="kstw-knopf hell" data-kstw="a-nein">Nein</button></div></div>`;
  }
  function klickOv(ev) {
    const b = ev.target.closest('[data-kstw]'); if (!b) return;
    const was = b.getAttribute('data-kstw'), s = Z();
    if (was === 'ueberstimmen') { abstimmungEnde(true); return; }
    if (was === 'zuruf' || was === 'ausrichtung') { abstimmung(was); return; }
    if (/^a-/.test(was) && s && s.anfragen[0]) {
      const a = s.anfragen.shift(), e = s.z[a.login];
      const n = e ? e.name : a.login;
      if (was === 'a-vertrag') { const f = e && A().finden(e); if (f) A().vertrag(f); ereignis({ tag: 'Anfrage', text: `Zugesagt: <b>${esc(n)}</b> bekommt einen Vertrag.` }); }
      else if (was === 'a-ja') { ereignis({ tag: 'Anfrage', text: `Zugesagt: <b>${esc(n)}</b> – ${a.art === 'einsatz' ? 'Einsatz kommt' : 'wir reden über einen Vertrag'}.` }); }
      else if (was === 'a-spaeter') { s.anfragen.push(a); sag(`@${a.login} der Trainer denkt noch über deine Bitte nach.`); }
      else if (was === 'a-nein') sag(`@${a.login} diesmal nicht – ${n} muss sich noch zeigen.`);
      zeichneAnfragen(); speichern();
    }
  }

  // ── Live-Spiel: Ereignisse der Zuschauer-Talente, Kabine von selbst, Knöpfe ──────────────────────────────────
  let liveSeen = 0, liveS = null, liveBis = 0;
  function liveTakt() {
    const L = LIVE(), box = ov().querySelector('.kstw-live');
    if (!L || L.fertig) { if (box._sig) { box._sig = ''; box.innerHTML = ''; } liveS = null; return; }
    if (liveS !== L.S) { liveS = L.S; liveSeen = 0; liveBis = 0; L._kstwKabine = false; anpfiff(L); }
    const leiste = chatAn() ? `<div class="kstw-k kstw-leiste"><span class="kstw-tag">Chat fragen</span>
      <button type="button" class="kstw-knopf" data-kstw="zuruf"${V ? ' disabled' : ''}>Zuruf</button><button type="button" class="kstw-knopf" data-kstw="ausrichtung"${V ? ' disabled' : ''}>Ausrichtung</button></div>` : '';
    if (box._sig !== leiste) { box._sig = leiste; box.innerHTML = leiste; }   // nicht jede halbe Sekunde neu – sonst gehen Klicks verloren
    if (chatAn() && L.hz && !L._kstwKabine && L.tk && !L.tk.kabineGenutzt && !V) { L._kstwKabine = true; abstimmung('kabine'); }
    // erst melden, wenn der Ticker die Szene zeigt (die Engine rechnet abschnittweise voraus)
    const uhr = document.querySelector('#dfl-ts .ts-uhr'), m = uhr && /(\d+)/.exec(uhr.textContent), tx = uhr ? uhr.textContent : '';
    const bis = m ? +m[1] * 60 : /halbzeit/i.test(tx) ? 2700 : /abpfiff|ende|schluss/i.test(tx) ? 1e9 : uhr ? liveBis : (L.S.clock || 0);
    liveBis = bis;
    const ev = L.S.ev || [];
    for (; liveSeen < ev.length && (ev[liveSeen].t || 0) < bis; liveSeen++) {
      const e = ev[liveSeen], ref = echt(e.player), login = ref && ref.stream;
      if (!login || ['goal', 'wechsel', 'yellow', 'red', 'gelbrot'].indexOf(e.type) < 0) continue;
      const min = Math.floor((e.t || 0) / 60) + 1, n = esc(ref.name), geg = !SQUAD_HAT(ref);
      const t = e.type === 'goal' ? ['TOR', `<b>${n}</b> trifft (${min}.)${geg ? ' – gegen dich' : '!'}`] : e.type === 'wechsel' ? ['Einwechslung', `<b>${n}</b> kommt rein (${min}.).`]
        : e.type === 'yellow' ? ['Gelb', `<b>${n}</b> sieht Gelb (${min}.).`] : ['Rot', `<b>${n}</b> fliegt vom Platz (${min}.).`];
      ereignis({ tag: 'Zuschauer-Talent · ' + t[0], text: t[1] + ` <small>@${esc(login)}</small>` });
      const nm = ref.name;
      if (e.type === 'goal') laut(geg ? `Ausgerechnet! ${nm} (@${login}) trifft gegen uns – ${min}. Minute.` : `TOR! ${nm} (@${login}) trifft in der ${min}. Minute!`);
    }
  }
  // Anpfiff: Zuschauer-Talente in der eigenen Startelf und – Wiedersehen – beim Gegner
  function anpfiff(L) {
    const auf = (L.S.players || []).map(echt).filter(r => r && r.stream);
    const eigen = auf.filter(SQUAD_HAT), geg = auf.filter(r => !SQUAD_HAT(r));
    if (eigen.length) laut(`Startelf: ${eigen.map(r => r.name + ' (@' + r.stream + ')').join(', ')} – viel Glück!`);
    geg.forEach(r => {
      ereignis({ tag: 'Wiedersehen', text: `<b>${esc(r.name)}</b> steht beim Gegner in der Startelf. <small>@${esc(r.stream)}</small>` });
      laut(`Wiedersehen: ${r.name} (@${r.stream}) spielt heute gegen uns!`);
    });
  }
  // Engine-Spieler → Eingabe-Datensatz → echter Spieler (wie engine_v3_adapter.js echterSpieler)
  const echt = sp => { let r = sp && sp._ref; if (r && r._ref) r = r._ref; return r || null; };
  const SQUAD_HAT = r => typeof SQUAD !== 'undefined' && SQUAD.indexOf(r) >= 0;

  // ── Stream-Blatt (Navigation links: „Stream“) ────────────────────────────────────────────────────────────────
  let status = { status: 'getrennt', text: '' }, testChat = false;
  // Abstimmungen und „Chat fragen“ nur mit Publikum: Twitch verbunden oder Test-Chat in dieser Sitzung benutzt
  // (Einstiegs-Test 2026-10-21: ohne Stream lag die Kabinen-Abstimmung über Taktikbrett und Spielbericht)
  const chatAn = () => einst().abstimmen && (status.status === 'verbunden' || testChat);
  function navKnopf() {
    const nav = document.querySelector('.app > .appnav');
    if (!nav || nav.querySelector('[data-kstw-nav]') || !nav.querySelector('.pcu-extra')) return;
    nav.insertAdjacentHTML('beforeend', `<button type="button" class="appnav-btn pcu-extra" data-kstw-nav="1">${ico('brand-twitch')}Stream<span class="kstw-punkt" aria-hidden="true"></span></button>`);
    nav.querySelector('[data-kstw-nav]').addEventListener('click', () => panel(true));
  }
  function panel(auf) {
    let p = $('kstw-panel');
    if (!p) {
      p = document.createElement('div'); p.id = 'kstw-panel'; p.className = 'exp-overlay';
      p.addEventListener('click', klickPanel); p.addEventListener('change', aenderPanel);
      document.body.appendChild(p);
    }
    p.classList.toggle('kstw-auf', !!auf);
    document.body.classList.toggle('kstw-panel-auf', !!auf);
    ansicht();
    if (auf) zeichnePanel();
  }
  function zeichnePanel() {
    const p = $('kstw-panel'); if (!p || !p.classList.contains('kstw-auf')) return;
    const e = einst(), s = Z(), a = A(), liste = s ? Object.values(s.z) : [];
    const zeilen = liste.filter(x => x.art !== 'warte').map(x => { const f = x.art === 'aktiv' && a ? a.finden(x) : null;
      return `<tr><td><b>${esc(x.name)}</b></td><td>${esc(f ? f.p.pos : x.pos || '')}</td><td>${f ? f.p.age : ''}</td><td>${f ? f.p.ovr : ''}</td><td>${esc(f ? f.wo : x.art === 'weg' ? 'nicht mehr da' : '')}</td><td>${esc(NAME_SP[x.training] || x.training || '–')}</td>
        <td>${x.h && x.h.t === tagHeute() ? x.h.alle : 0}</td><td>${Math.min(x.einh || 0, CFG.jePunkt)}/${CFG.jePunkt}</td><td>${x.plus ? '+' + x.plus : ''}</td>
        <td><button type="button" class="kstw-knopf hell klein" data-kstw-p="raus:${esc(x.login)}">Entfernen</button></td></tr>`; }).join('');
    const st = { verbunden: 'verbunden', verbinde: 'verbinde …', getrennt: 'nicht verbunden', fehler: 'Fehler' }[status.status] || status.status;
    p.innerHTML = `<div class="exp-dialog kstw-dialog" role="dialog" aria-modal="true" aria-label="Stream">
      <button type="button" class="app-blatt-zu" data-kstw-p="zu" aria-label="Schließen">${ico('x')}</button>
      <h3>${ico('brand-twitch')} Streamer-Modus</h3>
      <div class="kstw-reihe"><label>Twitch-Kanal <input type="text" id="kstw-kanal" value="${esc(e.kanal)}" placeholder="deinkanal" spellcheck="false"></label>
        ${status.status === 'verbunden' || status.status === 'verbinde' ? '<button type="button" class="kstw-knopf hell" data-kstw-p="trennen">Trennen</button>' : '<button type="button" class="kstw-knopf" data-kstw-p="verbinden">Verbinden</button>'}
        <span class="kstw-status ${esc(status.status)}">${esc(st)}${status.text ? ' – ' + esc(status.text) : ''}</span></div>
      ${W.FcmPc && W.FcmPc.stream ? '' : '<p class="kstw-leise">Twitch-Verbindung nur in der PC-App – hier geht der Test-Chat.</p>'}
      <div class="kstw-reihe"><label class="kstw-schalter"><input type="checkbox" data-kstw-e="befehle"${e.befehle ? ' checked' : ''}> Befehle (!dabei, !training, !karte, !bitte, !raus)</label>
        <label class="kstw-schalter"><input type="checkbox" data-kstw-e="abstimmen"${e.abstimmen ? ' checked' : ''}> Chat als Co-Trainer (Abstimmungen im Live-Spiel)</label></div>
      <h4>Chat-Bot <small>schreibt nur Wichtiges in den Chat (Willkommen, Fortschritt, Abstimmungen, Duell, Raid, Tore) – Bestätigungen stehen klein im Overlay</small></h4>
      <div class="kstw-reihe">${botHtml()}</div>
      <div class="kstw-reihe"><label class="kstw-schalter"><input type="checkbox" data-kstw-e="bot"${e.bot ? ' checked' : ''}> Bot antwortet im Chat</label></div>
      <div id="kstw-botlog" class="kstw-botlog"></div>
      <h4>Stream-Ansicht</h4>
      <div class="kstw-reihe"><label class="kstw-schalter"><input type="checkbox" data-kstw-e="gross"${e.gross ? ' checked' : ''}> Große Einblendungen (gut lesbar im Stream)</label>
        <label>Kamera-Ecke freihalten <select id="kstw-kamera">${[['aus', 'keine'], ['ol', 'oben links'], ['or', 'oben rechts'], ['ul', 'unten links'], ['ur', 'unten rechts']].map(([k, n]) => `<option value="${k}"${e.kamera === k ? ' selected' : ''}>${n}</option>`).join('')}</select></label></div>
      <h4>Events <small>Zuschauer trainieren ihr Talent, indem sie mitreden (echte Nachrichten, keine Befehle): ${CFG.jePunkt} Einheiten = +1, höchstens ${CFG.deckel} am Tag</small></h4>
      <div class="kstw-reihe">${eventsHtml()}</div>
      <h4>Zuschauer-Talente <small>${s ? s.jg.n : 0} / ${CFG.jahrgang} in dieser Saison${s && s.warte.length ? ` · ${s.warte.length} auf der Warteliste` : ''}</small></h4>
      ${zeilen ? `<table class="kstw-tab"><thead><tr><th>Name</th><th>Pos</th><th>Alter</th><th>Stärke</th><th>Wo</th><th>Training</th><th>Heute</th><th>Punkt</th><th>Chat</th><th></th></tr></thead><tbody>${zeilen}</tbody></table>` : '<p class="kstw-leise">Noch niemand dabei. Zuschauer schreiben <code>!dabei</code> in den Chat.</p>'}
      <h4>Befehle für den Chat</h4>
      <p class="kstw-befehle"><code>!befehle</code> Übersicht · <code>!dabei ZM 8</code> Talent mit Wunschposition und Nummer · <code>!training schuss</code> (passen, technik, abwehr, tempo, kopfball, mental, torwart) · <code>!karte</code> · <code>!bitte einsatz</code> / <code>!bitte vertrag</code> · <code>!raus</code> · im Spiel <code>!1</code> … <code>!9</code></p>
      <h4>Test-Chat</h4>
      <div class="kstw-reihe"><input type="text" id="kstw-tn" value="test_zuschauer" spellcheck="false" style="width:160px"><input type="text" id="kstw-tt" placeholder="!dabei ST 9" spellcheck="false" style="flex:1"><button type="button" class="kstw-knopf" data-kstw-p="test">Senden</button></div>
      <div class="kstw-reihe"><span class="kstw-leise">Twitch-Ereignis ausprobieren (für den Namen links):</span><button type="button" class="kstw-knopf hell klein" data-kstw-p="t-raid">Raid (25)</button><button type="button" class="kstw-knopf hell klein" data-kstw-p="t-sub">Sub</button><button type="button" class="kstw-knopf hell klein" data-kstw-p="t-gift">Geschenk-Sub</button><button type="button" class="kstw-knopf hell klein" data-kstw-p="t-bits">300 Bits</button></div>
    </div>`;
    zeichneBotLog();
  }
  function eventsHtml() {
    const s = Z(); if (!s) return '';
    const pause = s.lager.start + CFG.lagerPauseMin * 60000 - Date.now();
    const lager = lagerAn() ? `<span class="kstw-status verbunden">Trainingslager läuft noch ${Math.ceil((s.lager.bis - Date.now()) / 60000)} Min.</span>`
      : `<button type="button" class="kstw-knopf"${pause > 0 ? ' disabled' : ''} data-kstw-p="lager">Trainingslager (${CFG.lagerMin} Min., ×2)</button>${pause > 0 ? `<span class="kstw-leise">wieder in ${Math.ceil(pause / 60000)} Min.</span>` : ''}`;
    const k = duellKandidaten(), opt = '<option value="">Zufall</option>' + k.map(x => `<option value="${esc(x.e.login)}">${esc(x.e.name)} (${esc(x.f.p.pos)}, ${x.f.p.ovr})</option>`).join('');
    return `${lager}<span class="kstw-trenner"></span><select id="kstw-d1">${opt}</select><b>gegen</b><select id="kstw-d2">${opt}</select>
      <button type="button" class="kstw-knopf"${k.length < 2 ? ' disabled' : ''} data-kstw-p="duell">Chat-Duell</button><span class="kstw-trenner"></span>
      <button type="button" class="kstw-knopf hell" data-kstw-p="besten">Bestenliste einblenden</button>`;
  }
  function botHtml() {
    if (!(W.FcmPc && W.FcmPc.stream && W.FcmPc.stream.anmelden)) return '<span class="kstw-leise">Nur in der PC-App – im Browser stehen die Antworten unten im Protokoll.</span>';
    if (anm.status === 'aus') return '<span class="kstw-leise">Noch nicht eingerichtet: Die Client-ID der Twitch-App fehlt (pc_app/package.json → twitch.clientId).</span>';
    if (anm.status === 'angemeldet') return `<span class="kstw-status verbunden">angemeldet als ${esc(anm.login)}</span><button type="button" class="kstw-knopf hell" data-kstw-p="abmelden">Abmelden</button>`;
    if (anm.status === 'code') return `<span>Im Browser bei Twitch bestätigen – Code <b class="kstw-code">${esc(anm.code)}</b></span><button type="button" class="kstw-knopf hell" data-kstw-p="anmelden">Neuer Code</button>`;
    return `<button type="button" class="kstw-knopf" data-kstw-p="anmelden">Mit Twitch anmelden</button>${anm.text ? `<span class="kstw-status ${anm.status === 'fehler' ? 'fehler' : ''}">${esc(anm.text)}</span>` : ''}
      <span class="kstw-leise">Der Bot schreibt mit diesem Konto – gern ein eigenes Bot-Konto nehmen.</span>`;
  }
  function zeichneBotLog() {
    const el = $('kstw-botlog'); if (!el) return;
    el.innerHTML = botLog.length ? botLog.map(b => `<div class="${b.gesendet ? 'raus' : ''}"><i class="ti ti-${b.leise ? 'layout-bottombar' : b.gesendet ? 'send' : 'message-dots'}" aria-hidden="true" title="${b.leise ? 'nur im Overlay' : 'Chat'}"></i>${esc(b.t)}</div>`).join('') : '<div class="kstw-leise">Noch keine Antworten.</div>';
  }
  // Stream-Ansicht: Einblendungen vergrößern und eine Kamera-Ecke freihalten
  function ansicht() {
    const e = einst(), b = document.body;
    b.classList.toggle('kstw-gross', !!e.gross);
    ['ol', 'or', 'ul', 'ur'].forEach(k => b.classList.toggle('kstw-cam-' + k, e.kamera === k));
  }
  function aenderPanel(ev) {
    if (ev.target.id === 'kstw-kamera') { einstSetzen({ kamera: ev.target.value }); ansicht(); }
  }
  function klickPanel(ev) {
    if (ev.target.id === 'kstw-panel') { panel(false); return; }
    const c = ev.target.closest('[data-kstw-e]');
    if (c) { einstSetzen({ [c.getAttribute('data-kstw-e')]: c.checked }); ansicht(); return; }
    const b = ev.target.closest('[data-kstw-p]'); if (!b) return;
    const was = b.getAttribute('data-kstw-p');
    if (was === 'zu') panel(false);
    else if (was === 'verbinden') { const k = ($('kstw-kanal') || {}).value || ''; einstSetzen({ kanal: k.trim() }); if (W.FcmPc && W.FcmPc.stream) W.FcmPc.stream.verbinden(k.trim()); }
    else if (was === 'trennen') { if (W.FcmPc && W.FcmPc.stream) W.FcmPc.stream.trennen(); }
    else if (was === 'anmelden') { if (W.FcmPc && W.FcmPc.stream && W.FcmPc.stream.anmelden) W.FcmPc.stream.anmelden(); }
    else if (was === 'abmelden') { if (W.FcmPc && W.FcmPc.stream && W.FcmPc.stream.abmelden) W.FcmPc.stream.abmelden(); }
    else if (was === 'test') { testChat = true; const n = (($('kstw-tn') || {}).value || 'test_zuschauer').trim(), t = (($('kstw-tt') || {}).value || '').trim(); if (t) { delete zuletzt[n.toLowerCase()]; nachricht({ login: n, name: n, text: t }); $('kstw-tt').value = ''; setTimeout(zeichnePanel, 50); } }
    else if (/^raus:/.test(was)) { raus(was.slice(5)); }
    else if (was === 'lager') lagerStarten();
    else if (was === 'duell') { if (duellStarten(($('kstw-d1') || {}).value, ($('kstw-d2') || {}).value)) panel(false); }
    else if (was === 'besten') { bestenliste(); panel(false); }
    else if (/^t-/.test(was)) {
      const n = (($('kstw-tn') || {}).value || 'test_zuschauer').trim();
      twitchEreignis({ typ: { 't-raid': 'raid', 't-sub': 'sub', 't-gift': 'subgift', 't-bits': 'bits' }[was], login: n, name: n, anzahl: { 't-raid': 25, 't-bits': 300 }[was] || 1 });
      setTimeout(zeichnePanel, 50);
    }
  }

  // ── Start ───────────────────────────────────────────────────────────────────────────────────────────────────
  const STIL = `
#kstw { position: fixed; inset: 0; pointer-events: none; z-index: 9400; font-family: inherit; }
#kstw .kstw-k { pointer-events: auto; background: var(--bg2, #fffaf0); border: 3px solid var(--k-rahmen, #8b5a2b); border-radius: 16px; padding: 12px 14px;
  box-shadow: 0 5px 0 #5e3b17, 0 10px 26px rgba(0,0,0,.3); color: var(--text, #3b2a17); }
#kstw h4 { margin: 0 0 8px; font: 700 16px/1.15 var(--font-titel, Fredoka, system-ui); display: flex; align-items: center; gap: 8px; }
#kstw p { margin: 2px 0 8px; font-size: 13.5px; line-height: 1.35; }
.kstw-tag { font: 800 10.5px/1 system-ui; letter-spacing: .06em; text-transform: uppercase; background: #9146ff; color: #fff; border-radius: 6px; padding: 4px 7px; white-space: nowrap; }
.kstw-knopf { font: 700 12.5px var(--font-titel, system-ui); padding: 7px 12px; border-radius: 10px; border: 0; background: #2c7cb5; color: #fff; box-shadow: 0 3px 0 #1d5a86; cursor: pointer; }
.kstw-knopf.hell { background: var(--bg3, #efe2c8); color: var(--text, #3b2a17); box-shadow: 0 3px 0 #c9b28a; }
.kstw-knopf.klein { padding: 4px 8px; font-size: 11.5px; }
.kstw-knopf[disabled] { opacity: .5; cursor: default; }
#kstw .kstw-vote { position: absolute; top: 90px; left: 50%; transform: translateX(-50%); width: 460px; }
.kstw-opt { display: grid; grid-template-columns: 34px 1fr 48px; align-items: center; gap: 8px; margin: 6px 0; font-weight: 800; }
.kstw-nr { background: #9146ff; color: #fff; border-radius: 8px; text-align: center; font: 700 14px/26px var(--font-titel, system-ui); }
.kstw-bar { height: 26px; border-radius: 9px; background: var(--bg3, #efe2c8); position: relative; overflow: hidden; }
.kstw-bar i { position: absolute; left: 0; top: 0; bottom: 0; background: #b9e3a3; transition: width .3s; } .kstw-bar.top i { background: #25c065; }
.kstw-bar span { position: relative; padding-left: 10px; line-height: 26px; font-size: 13.5px; }
.kstw-fuss { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-top: 8px; font-size: 12.5px; color: var(--text3, #846d52); }
#kstw .kstw-karten { position: absolute; left: 24px; bottom: 24px; width: 350px; }
.kstw-kk { display: flex; gap: 12px; align-items: center; }
.kstw-gesicht { width: 72px; height: 72px; border-radius: 50%; overflow: hidden; background: var(--bg3, #efe2c8); flex: none; }
.kstw-gesicht svg { width: 72px; height: 72px; display: block; }
.kstw-kk b { font: 700 19px/1.1 var(--font-titel, system-ui); display: block; } .kstw-kk small { display: block; color: var(--text3, #846d52); font-size: 12.5px; }
.kstw-werte { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 10px; }
.kstw-werte > div { background: var(--bg3, #efe2c8); border-radius: 10px; padding: 6px 8px; } .kstw-werte small { font-size: 10px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; color: var(--text3, #846d52); display: block; }
.kstw-werte b { font: 700 16px var(--font-titel, system-ui); }
#kstw .kstw-ereignisse { position: absolute; left: 50%; bottom: 24px; transform: translateX(-50%); width: 480px; }
.kstw-ereignis { border-color: #9146ff !important; box-shadow: 0 5px 0 #5b2bb5, 0 10px 26px rgba(0,0,0,.3) !important; }
.kstw-ereignis.warn { border-color: #c0392b !important; box-shadow: 0 5px 0 #8e2a20, 0 10px 26px rgba(0,0,0,.3) !important; }
.kstw-ereignis p { margin: 6px 0 0 !important; }
#kstw .kstw-anfragen { position: absolute; right: 24px; top: 90px; width: 360px; }
.kstw-ak { display: flex; gap: 8px; }
#kstw .kstw-live { position: absolute; right: 24px; bottom: 24px; }
.kstw-leiste { display: flex; align-items: center; gap: 8px; padding: 8px 10px !important; }
.kstw-punkt { width: 8px; height: 8px; border-radius: 50%; background: #9aa0a6; margin-left: auto; }
body.kstw-verbunden .kstw-punkt { background: #9146ff; box-shadow: 0 0 0 3px rgba(145,70,255,.25); }
#kstw-panel { display: none; position: fixed; inset: 0; z-index: 9500; background: rgba(0,0,0,.4); align-items: center; justify-content: center; }
#kstw-panel.kstw-auf { display: flex; }
.kstw-dialog { position: relative; width: min(860px, 94vw); max-height: 90vh; overflow-y: auto; }
.kstw-dialog h3 { margin: 0 0 12px; font: 700 21px var(--font-titel, system-ui); display: flex; align-items: center; gap: 8px; }
.kstw-dialog h3 .ti { color: #9146ff; }
.kstw-dialog h4 { margin: 16px 0 6px; font: 700 15px var(--font-titel, system-ui); } .kstw-dialog h4 small { font-weight: 600; color: var(--text3); font-size: 12px; margin-left: 6px; }
.kstw-reihe { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin: 6px 0; }
.kstw-reihe input[type=text] { font: inherit; padding: 7px 10px; border-radius: 10px; border: 2px solid var(--border, #d9c29a); background: var(--bg, #fff); color: inherit; }
.kstw-reihe label { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 13px; }
.kstw-status { font-size: 12.5px; font-weight: 800; color: var(--text3); } .kstw-status.verbunden { color: #9146ff; } .kstw-status.fehler { color: #c0392b; }
.kstw-schalter { font-weight: 600 !important; }
.kstw-tab { width: 100%; border-collapse: collapse; font-size: 13px; } .kstw-tab th { text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing: .05em; color: var(--text3); padding: 6px; border-bottom: 2px solid var(--border); }
.kstw-tab td { padding: 5px 6px; border-bottom: 1px solid var(--border); }
.kstw-befehle code, .kstw-leise code { background: var(--bg3); border-radius: 5px; padding: 1px 5px; font-size: 12.5px; }
.kstw-befehle { font-size: 13px; line-height: 1.9; margin: 0; }
.kstw-tag.gold { background: #c9a227; }
#kstw .kstw-quitt { position: absolute; left: 24px; bottom: 300px; width: 340px; display: flex; flex-direction: column; gap: 6px; }
.kstw-q { background: rgba(24,24,27,.86); color: #efeff1; border-left: 4px solid #9146ff; border-radius: 8px; padding: 6px 10px; font: 600 12.5px/1.35 system-ui; box-shadow: 0 4px 12px rgba(0,0,0,.25); }
body.kstw-gross #kstw .kstw-quitt { zoom: 1.2; }
.kstw-mini { font-size: 11.5px; color: var(--text3, #846d52); margin-top: 6px; }
.kstw-plus { color: #25a05a; font-size: 13px; }
.kstw-fort { margin-top: 10px; } .kstw-fz { display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; }
.kstw-fbar { height: 12px; background: var(--bg3, #efe2c8); border-radius: 6px; overflow: hidden; margin-top: 4px; }
.kstw-fbar i { display: block; height: 100%; background: linear-gradient(90deg, #9146ff, #b48cff); transition: width .4s; }
#kstw .kstw-lager { position: absolute; left: 50%; top: 18px; transform: translateX(-50%); width: 560px; }
.kstw-lagerk { display: flex; align-items: center; gap: 12px; border-color: #c9a227 !important; box-shadow: 0 5px 0 #8a6d12, 0 10px 26px rgba(0,0,0,.3) !important; }
.kstw-lagerk small { color: var(--text3, #846d52); } .kstw-uhr { font: 700 26px var(--font-titel, system-ui); color: #8a6d12; margin-left: auto; }
#kstw .kstw-duell { position: absolute; top: 120px; left: 50%; transform: translateX(-50%); width: 520px; }
.kstw-dd { display: grid; grid-template-columns: 1fr 40px 1fr; align-items: center; text-align: center; gap: 8px; }
.kstw-ds b { font: 700 18px var(--font-titel, system-ui); display: block; } .kstw-ds small { color: var(--text3, #846d52); font-size: 12px; }
.kstw-vs { font: 800 18px var(--font-titel, system-ui); color: #9146ff; }
.kstw-dbar { display: flex; height: 22px; border-radius: 9px; overflow: hidden; margin-top: 10px; font: 800 12px system-ui; color: #fff; }
.kstw-dbar span { display: flex; align-items: center; justify-content: center; transition: width .3s; white-space: nowrap; }
#kstw .kstw-besten { position: absolute; left: 24px; top: 110px; width: 330px; }
.kstw-r { display: grid; grid-template-columns: 22px 1fr 64px 34px; gap: 6px; align-items: center; padding: 5px 0; border-bottom: 1px dashed var(--border, #d9c29a); font-size: 13.5px; }
.kstw-rn { font-weight: 800; color: #9146ff; } .kstw-rp { font-weight: 800; text-align: right; } .kstw-rs { font-size: 11.5px; color: #25a05a; font-weight: 800; text-align: right; }
.kstw-r small { color: var(--text3, #846d52); }
.kstw-trenner { width: 1px; align-self: stretch; background: var(--border, #d9c29a); margin: 0 4px; }
body.kstw-cam-ol #kstw .kstw-besten { top: 250px; }
body.kstw-gross #kstw .kstw-lager, body.kstw-gross #kstw .kstw-duell, body.kstw-gross #kstw .kstw-besten { zoom: 1.3; }
.kstw-reihe select { font: inherit; padding: 6px 8px; border-radius: 10px; border: 2px solid var(--border, #d9c29a); background: var(--bg, #fff); color: inherit; }
.kstw-code { font: 700 18px/1 ui-monospace, monospace; letter-spacing: .12em; background: #9146ff; color: #fff; border-radius: 8px; padding: 4px 8px; margin-left: 4px; }
.kstw-botlog { max-height: 120px; overflow-y: auto; font-size: 12.5px; border: 2px dashed var(--border, #d9c29a); border-radius: 10px; padding: 6px 10px; }
.kstw-botlog > div { padding: 2px 0; display: flex; gap: 6px; align-items: baseline; color: var(--text3); } .kstw-botlog > div.raus { color: var(--text); }
.kstw-botlog .ti { color: #9146ff; }
/* Stream-Ansicht: größer, Kamera-Ecke frei (≈ 360 × 210 px) */
body.kstw-gross #kstw .kstw-vote, body.kstw-gross #kstw .kstw-karten, body.kstw-gross #kstw .kstw-ereignisse, body.kstw-gross #kstw .kstw-anfragen, body.kstw-gross #kstw .kstw-live { zoom: 1.3; }
body.kstw-cam-ul #kstw .kstw-karten, body.kstw-cam-ur #kstw .kstw-live { bottom: 250px; }
body.kstw-cam-or #kstw .kstw-anfragen { top: 300px; }
body.kstw-cam-ol #kstw .kstw-karten { bottom: 24px; }
body.kstw-cam-ol.kstw-gross #kstw .kstw-vote, body.kstw-cam-or.kstw-gross #kstw .kstw-vote { top: 260px; }
#kstw .kstw-kamera { position: absolute; width: 360px; height: 210px; border: 3px dashed #9146ff; border-radius: 14px; display: none; align-items: center; justify-content: center;
  color: #9146ff; font: 800 13px system-ui; letter-spacing: .06em; text-transform: uppercase; background: rgba(145,70,255,.08); }
body.kstw-panel-auf.kstw-cam-ol #kstw .kstw-kamera { display: flex; left: 16px; top: 16px; } body.kstw-panel-auf.kstw-cam-or #kstw .kstw-kamera { display: flex; right: 16px; top: 16px; }
body.kstw-panel-auf.kstw-cam-ul #kstw .kstw-kamera { display: flex; left: 16px; bottom: 16px; } body.kstw-panel-auf.kstw-cam-ur #kstw .kstw-kamera { display: flex; right: 16px; bottom: 16px; } .kstw-leise { color: var(--text3); font-size: 13px; }
`;
  function start() {
    if ($('kstw-css')) return;
    const st = document.createElement('style'); st.id = 'kstw-css'; st.textContent = STIL; document.head.appendChild(st);
    ov();
    if (W.FcmPc && W.FcmPc.stream && W.FcmPc.stream.an) {
      W.FcmPc.stream.an(d => {
        if (d.art === 'status') { status = d; document.body.classList.toggle('kstw-verbunden', d.status === 'verbunden'); zeichnePanel(); }
        else if (d.art === 'nachricht') nachricht(d);
        else if (d.art === 'anmeldung') { anm = d; zeichnePanel(); }
        else if (d.art === 'twitch') twitchEreignis(d);
      });
      if (W.FcmPc.stream.zustand) W.FcmPc.stream.zustand().then(d => { if (d) { anm = d; zeichnePanel(); } }).catch(() => {});
    }
    ansicht();
    setInterval(() => {
      navKnopf();
      try { liveTakt(); } catch (e) { if (!start._f) { start._f = 1; console.warn('[KS-Stream] Live', e); } }
      if (V) { if (!V.fertig && Date.now() >= V.ende) abstimmungEnde(false); else if (!V.fertig) zeichneAbstimmung(); }
      if (D && !D.fertig) { if (Date.now() >= D.ende) duellEnde(); else zeichneDuell(); }
      zeichneKarten(); zeichneEreignisse(); zeichneAnfragen(); zeichneLager(); zeichneBesten(); zeichneQuitt();
    }, 500);
    console.log('[Kickstil-Stream v3] aktiv — Streamer-Modus: Twitch-Chat, Zuschauer-Talente, Chat-Training, Co-Trainer, Chat-Bot, Events (nur PC)');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  W.KSStream = { CFG, nachricht, abstimmung, zustand: Z, einst, panel, woche, botLog: () => botLog.slice(),
    twitchEreignis, lagerStarten, duellStarten, bestenliste, einheitFuer, testChat: () => { testChat = true; } };
})();
