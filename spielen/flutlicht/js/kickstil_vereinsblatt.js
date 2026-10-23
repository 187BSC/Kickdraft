/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · VEREINSBLATT  ·  v1   (Nutzer 2026-10-15: „Scouting aus Kickdraft übernehmen, nur dass man gezielt auf die
   Vereine klicken und dort Spieler scouten kann“) – MUSTER zur Abnahme
   ─────────────────────────────────────────────────────────────────────────
   Ein Tipp auf einen Verein (Tabelle, Liga) öffnet statt der kleinen Profilkarte ein Blatt von unten:
     · Kopf: großes Wappen (neuer Name), Liga und Platz, Stärke, Punkte, S·U·N, Tore, Form
     · Reiter „Kader“: alle Spieler nach Mannschaftsteil, mit Gesicht, Alter, Position
     · Reiter „Akademie“: die Talente des Vereins (kickstil_akademien.js, Schritt B) – im Transferfenster kaufbar
     · Sicht wie im Kickdraft-Scouting: ohne Bericht nur die Stufe (Bronze < 70, Silber 70er, Gold 80er, Elite 90+),
       Potenzial „?“; mit Bericht die genaue Stärke und eine Potenzial-Spanne (Breite nach Scoutingstufe und Alter)
     · Knopf „Verein scouten“: ein Scout fährt hin, nach CFG.dauerWochen liegt ein Bericht über Kader UND Akademie vor
       (Meldung im Postfach). Ein Bericht gilt CFG.berichtGiltWochen.
   Zustand: CLUB.vereinsScout = { auftraege: {dataId: {bis, teamId, name}}, berichte: {spielerKey: {w}} }
   Kader: CLUB.npcSquads (falls angelegt) sonst AI_SQUADS (Kartei). Regionalliga/erzeugte Vereine: noch ohne Kader
   (kommt mit der lebenden Welt, Schritt A). Akademie: aus Vereinsstärke und Saison abgeleitet (fest je Verein und Saison).
   Kosten je Auftrag nach Liga (CFG.kosten, mit dem Nutzer abgestimmt 2026-10-15): Erste 150.000 €, Zweite 75.000 €, Dritte 25.000 €.
   API: KSVereinsblatt.oeffnen(teamId) · .scouten(dataId) · .zustand()
   Lädt nach kickstil_verein.js und kickstil_vereinsnamen.js, vor init_bootstrap.js.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  // Kosten je Auftrag nach Liga des Vereins (Nutzer 2026-10-15: „gute Zahlen, das passt“ – 25.000 € Dritte bis 150.000 € Erste)
  const CFG = { dauerWochen: 2, berichtGiltWochen: 52, kosten: { bundesliga: 150000, bundesliga2: 75000, liga3: 25000, regionalliga: 10000, europa: 150000 } };
  const kostenFuer = tierKey => (CFG.kosten && CFG.kosten[tierKey]) || 25000;
  const euro = v => typeof formatEuro === 'function' ? formatEuro(v) : Math.round(v).toLocaleString('de-DE') + ' €';
  const STUFEN = [{ ab: 90, key: 'elite', name: 'Elite', spanne: '90+' }, { ab: 80, key: 'gold', name: 'Gold', spanne: '80–89' },
    { ab: 70, key: 'silber', name: 'Silber', spanne: '70–79' }, { ab: 0, key: 'bronze', name: 'Bronze', spanne: 'unter 70' }];
  const stufe = o => STUFEN.find(s => (o || 0) >= s.ab) || STUFEN[3];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const neuName = n => (window.KSVereinsnamen ? KSVereinsnamen.text(String(n || '')) : String(n || ''));
  const hatSpiel = () => typeof CLUB !== 'undefined' && CLUB && typeof LEAGUE !== 'undefined' && LEAGUE;
  function hash(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const absWoche = () => (LEAGUE.season || 1) * 100 + (LEAGUE.week || 1);
  const scoutStufe = () => (CLUB.facilities && CLUB.facilities.scouting) || 1;

  function zustand() {
    if (!CLUB.vereinsScout) CLUB.vereinsScout = { auftraege: {}, berichte: {} };
    return CLUB.vereinsScout;
  }

  // ── Verein und Kader ─────────────────────────────────────────────────────
  function teamInfo(teamId) {
    if (!hatSpiel() || typeof allGroups !== 'function') return null;
    for (const g of allGroups(LEAGUE)) {
      const t = g.group.teams.find(x => x.id === teamId);
      if (t) {
        const dataId = t.dataId || (t.id === 'fcm' ? CLUB.dataClubId : String(t.id).replace(/^club_/, ''));
        return { t, group: g.group, tierKey: g.tierKey, dataId };
      }
    }
    return euroInfo(teamId);
  }
  // Europapokal-Gegner (2026-10-15): Kader aus euro_kader.js, Zeile aus der Ligaphase; Akademie seit 2026-10-16 (kickstil_akademien.js)
  const COMP = { cl: 'Champions Cup', el: 'Europacup', co: 'Kontinentalcup' };
  function euroInfo(teamId) {
    const c = (window.EURO_CLUBS || []).find(x => x.id === teamId);
    if (!c) return null;
    let zeile = null, comp = null;
    try {
      const st = CLUB.euro, EC = window.EuroCompetitions;
      ['cl', 'el', 'co'].forEach(k => {
        if (zeile || !st || !st.leaguePhase || !st.leaguePhase[k] || !EC) return;
        const tbl = EC.leaguePhaseTable(k), i = tbl.findIndex(x => x.id === teamId);
        if (i >= 0) { zeile = Object.assign({ platz: i + 1 }, tbl[i]); comp = k; }
      });
    } catch (e) { zeile = null; }
    const live = (CLUB.euroClubs || []).find(x => x.id === teamId) || c;
    return { t: Object.assign({}, c, live, { id: teamId }), group: null, tierKey: 'europa', dataId: teamId, euro: true, zeile, comp };
  }
  function teilVon(pos) {
    if (pos === 'TW') return 'Tor';
    const a = typeof POS_INFO !== 'undefined' && POS_INFO[pos] ? POS_INFO[pos].area : 'MID';
    return a === 'DEF' ? 'Abwehr' : a === 'ATT' ? 'Angriff' : 'Mittelfeld';
  }
  function ausKartei(roh, dataId) {
    const roheP = Array.isArray(roh.positions) && roh.positions.length ? roh.positions : (roh.pos ? [roh.pos] : []);   // Euro-Kader: nur pos
    const positions = roheP.map(x => (x === 'OM' ? 'ZOM' : x)).filter(x => typeof POS_LIST === 'undefined' || POS_LIST.includes(x) || ['AV', 'AM', 'FL'].includes(x));
    const pos = positions[0] || 'ZM';
    const p = { pos, positions: positions.length ? positions : [pos], def: +roh.def || 50, mid: +roh.mid || 50, att: +roh.att || 50 };
    const ovr = typeof computeOvrFromAreas === 'function' ? computeOvrFromAreas(p) : Math.round((p.def + p.mid + p.att) / 3);
    const key = dataId + ':' + (roh.firstName || '') + ' ' + roh.name;
    return Object.assign(p, { key, id: 'vb_' + hash(key), name: roh.name, firstName: roh.firstName || '', flag: roh.flag || '',
      age: +roh.age || 25, ovr, truePotential: Math.max(ovr, +roh.truePotential || ovr), seed: hash(key) % 997, gamesPlayed: 30 });
  }
  function kader(info) {
    const quelle = info.euro ? (typeof window.euroKader === 'function' ? window.euroKader()[info.dataId] : null)
      : (CLUB.npcSquads && CLUB.npcSquads[info.dataId]) || (window.AI_SQUADS || {})[info.dataId];
    return Array.isArray(quelle) && quelle.length ? quelle.map(r => ausKartei(r, info.dataId)) : null;
  }
  // Akademie: fest je Verein und Saison; Stufe aus der Vereinsstärke (bessere Vereine, bessere Akademien)
  const VN = ['Luca', 'Finn', 'Noah', 'Elias', 'Jonas', 'Leon', 'Ben', 'Paul', 'Emil', 'Anton', 'Mats', 'Jannis', 'Malik', 'Yusuf', 'Milan', 'Theo', 'Levin', 'Kerem', 'Joel', 'Tiago'];
  const NN = ['Brandt', 'Seidel', 'Arslan', 'Kuhn', 'Pohl', 'Jansen', 'Engel', 'Haas', 'Busch', 'Krause', 'Ritter', 'Yilmaz', 'Lorenz', 'Winkler', 'Sommer', 'Graf', 'Ziegler', 'Petrović', 'Mendes', 'Nowak'];
  const POS_AK = ['TW', 'IV', 'IV', 'LV', 'RV', 'ZM', 'ZM', 'ZOM', 'LF', 'RF', 'ST', 'ST'];
  function akademie(info, teamOvr) {
    // Schritt B: echte Akademie des Vereins (kickstil_akademien.js) – sonst die abgeleitete Vorschau
    const echt = window.KSAkademien && KSAkademien.fuer(info.dataId);
    if (echt) return { stufe: echt.stufe, talente: echt.talente.slice(), echt: true };
    const r = rng(hash('akademie|' + info.dataId + '|' + (LEAGUE.season || 1)));
    const st = Math.max(1, Math.min(10, Math.round((teamOvr - 52) / 4.5)));
    const n = 3 + Math.floor(r() * 4);
    const out = [];
    for (let i = 0; i < n; i++) {
      const age = 16 + Math.floor(r() * 3), pos = POS_AK[Math.floor(r() * POS_AK.length)];
      const ovr = Math.round(38 + st * 1.6 + r() * 8 + (age - 16) * 3);
      const pot = Math.min(94, ovr + 14 + Math.round(r() * 14) + st);
      const key = 'ak:' + info.dataId + ':' + (LEAGUE.season || 1) + ':' + i;
      out.push({ key, id: 'vb_' + hash(key), firstName: VN[Math.floor(r() * VN.length)], name: NN[Math.floor(r() * NN.length)], flag: '🇩🇪',
        age, pos, positions: [pos], ovr, truePotential: pot, seed: hash(key) % 997, gamesPlayed: 0, def: ovr, mid: ovr, att: ovr });
    }
    return { stufe: st, talente: out };
  }

  // ── Sicht (wie Kickdraft: Stufe ohne Bericht, genau mit Bericht) ─────────
  function bericht(p) {
    if (window.KSScouting && KSScouting.hatBericht(p)) return true;     // Bericht der Scouting-Abteilung gilt auch hier
    const b = zustand().berichte[p.key];
    return !!(b && absWoche() - b.w <= CFG.berichtGiltWochen + 50);   // +50: Saisonwechsel springt um 100 statt um 52
  }
  function sicht(p) {
    if (!bericht(p)) return { b: false, st: stufe(p.ovr) };
    let pot = null;
    try { pot = typeof potentialRange === 'function' ? potentialRange(p, scoutStufe()) : null; } catch (e) { pot = null; }
    return { b: true, st: stufe(p.ovr), ovr: p.ovr, pot };
  }
  const potText = s => s.b && s.pot ? (s.pot.lo === s.pot.hi ? String(s.pot.lo) : s.pot.lo + '–' + s.pot.hi) : '?';
  const staerkeHtml = s => s.b ? `<span class="vb-zahl">${s.ovr}</span>` : `<span class="vb-stufe ${s.st.key}" title="${s.st.name} (${s.st.spanne}) – genau erst mit Scout-Bericht">${s.st.name}</span>`;

  // ── Blatt ────────────────────────────────────────────────────────────────
  let EL = null, REITER = 'kader', OFFEN = null;
  function element() {
    if (EL) return EL;
    EL = document.createElement('div');
    EL.id = 'vb-blatt';
    EL.innerHTML = '<div class="vb-bg"></div><div class="vb-box" role="dialog" aria-modal="true"></div>';
    EL.addEventListener('click', ev => {
      if (ev.target.closest('.vb-bg') || ev.target.closest('.vb-zu')) { zu(); return; }
      const r = ev.target.closest('[data-vb-reiter]'); if (r) { REITER = r.getAttribute('data-vb-reiter'); zeichnen(); return; }
      const s = ev.target.closest('[data-vb-scouten]'); if (s) { scouten(s.getAttribute('data-vb-scouten')); return; }
      const k = ev.target.closest('[data-vb-kaufen]');
      if (k && window.KSAkademien) { const [d, key] = k.getAttribute('data-vb-kaufen').split('|'); KSAkademien.kaufen(d, key); zeichnen(); return; }
    });
    document.body.appendChild(EL);
    return EL;
  }
  function zu() { if (EL) EL.classList.remove('auf'); OFFEN = null; document.body.classList.remove('vb-gesperrt'); }
  function gesicht(p, teamId) { try { return window.KSVerein ? KSVerein.gesicht(p, teamId) : ''; } catch (e) { return ''; } }
  function wappen(teamId) { try { return window.KSVerein ? KSVerein.wappen(teamId, { groesse: 96 }) : ''; } catch (e) { return ''; } }

  function zeile(p, teamId) {
    const s = sicht(p);
    return `<div class="vb-sp">
      <span class="vb-gesicht">${gesicht(p, teamId)}</span>
      <span class="vb-sp-txt"><b>${esc((p.firstName ? p.firstName.charAt(0) + '. ' : '') + p.name)}</b>
        <small>${esc(p.flag || '')} ${p.age} J · ${esc(p.positions.join('/'))}</small></span>
      <span class="vb-werte">${staerkeHtml(s)}<small>Pot. ${esc(potText(s))}</small></span>
    </div>`;
  }

  function zeichnen() {
    if (!OFFEN) return;
    const info = teamInfo(OFFEN); if (!info) { zu(); return; }
    const t = info.t, z = zustand();
    let platz = 0, tt = { pts: '–', w: '–', d: '–', l: '–', gf: '–', ga: '–' };
    if (info.group) {
      const tbl = typeof computeTable === 'function' ? computeTable(info.group.teams) : info.group.teams;
      platz = tbl.findIndex(x => x.id === t.id) + 1; tt = tbl[platz - 1] || t;
    } else if (info.zeile) { platz = info.zeile.platz; tt = info.zeile; }
    const ovr = t.ovr != null ? t.ovr : Math.round(((t.def || 60) + (t.mid || 60) + (t.att || 60)) / 3);
    const name = t.id === 'fcm' ? CLUB.name : t.name;
    const sp = kader(info), ak = akademie(info, ovr);
    const auftrag = z.auftraege[info.dataId];
    const alle = (sp || []).concat(ak.talente);
    const mitBericht = alle.filter(bericht).length;
    let scoutBox;
    if (t.id === 'fcm') scoutBox = '';
    else if (auftrag) scoutBox = `<div class="vb-scout laeuft"><i class="ti ti-telescope" aria-hidden="true"></i><span><b>Scout ist vor Ort</b><small>Bericht über Kader und Akademie in ${Math.max(1, auftrag.bis - absWoche())} Woche(n)</small></span>${window.KSJoker ? `<button type="button" class="vb-knopf leise" data-joker-scout="${esc(info.dataId)}"><i class="ti ti-player-play" aria-hidden="true"></i> Sofort</button>` : ''}</div>`;
    else if (mitBericht) scoutBox = `<div class="vb-scout fertig"><i class="ti ti-file-check" aria-hidden="true"></i><span><b>Scout-Bericht liegt vor</b><small>${mitBericht} von ${alle.length} Spielern genau eingeschätzt</small></span>
        <button type="button" class="vb-knopf leise" data-vb-scouten="${esc(info.dataId)}">Erneut scouten · ${esc(euro(kostenFuer(info.tierKey)))}</button></div>`;
    else scoutBox = `<div class="vb-scout"><i class="ti ti-telescope" aria-hidden="true"></i><span><b>Noch kein Bericht</b><small>Ohne Scout siehst du nur die Stufe der Spieler.</small></span>
        <button type="button" class="vb-knopf" data-vb-scouten="${esc(info.dataId)}">Verein scouten · ${CFG.dauerWochen} Wo. · ${esc(euro(kostenFuer(info.tierKey)))}</button></div>`;

    let liste = '';
    if (REITER === 'kader') {
      if (!sp) liste = `<p class="vb-leer">${info.tierKey === 'regionalliga' ? 'Regionalliga-Kader sind noch nicht einsehbar – kommt mit der lebenden Welt.' : 'Kein Kader hinterlegt.'}</p>`;
      else {
        const teile = ['Tor', 'Abwehr', 'Mittelfeld', 'Angriff'];
        liste = teile.map(teil => {
          const ps = sp.filter(p => teilVon(p.pos) === teil).sort((a, b) => (sicht(b).b ? b.ovr : stufe(b.ovr).ab) - (sicht(a).b ? a.ovr : stufe(a.ovr).ab) || a.age - b.age);
          return ps.length ? `<div class="vb-teil">${teil} <small>${ps.length}</small></div>` + ps.map(p => zeile(p, t.id)).join('') : '';
        }).join('');
      }
    } else if (REITER === 'transfers' && window.KSMarkt) {
      liste = window.KSMarkt.vereinHtml(info.dataId);       // Kasse, Sportdirektor, Zu-/Abgänge (kickstil_ki_markt.js)
    } else {
      const kaufbar = ak.echt && t.id !== 'fcm';
      const knopf = p => {
        if (!kaufbar) return '';
        const g = KSAkademien.grund(p), pi = KSAkademien.preisInfo(p), pr = pi.preis;
        const euro = typeof formatEuro === 'function' ? formatEuro(pr) : pr + ' €';
        return `<div class="vb-ak-fuss">${pi.hinweis && bericht(p) ? `<small class="vb-ak-grund">${esc(pi.hinweis)}</small>` : ''}${g ? `<small class="vb-ak-grund">${esc(g)}</small>` : ''}<button type="button" class="vb-knopf${g ? ' leise' : ''}" data-vb-kaufen="${esc(info.dataId + '|' + p.key)}">Holen · ${esc(euro)}</button></div>`;
      };
      const frei = kaufbar ? Math.max(0, (typeof youthCapacityForLevel === 'function' ? youthCapacityForLevel((CLUB.facilities && CLUB.facilities.youth) || 1) : 3) - (CLUB.youthProspects || []).length) : 0;
      liste = `<div class="vb-ak-kopf"><span>Akademie Stufe <b>${ak.stufe}</b></span><small>${ak.talente.length} Talente${kaufbar ? ` · deine Akademie: ${frei} ${frei === 1 ? 'Platz' : 'Plätze'} frei` : ''}</small></div>` +
        (ak.talente.length ? ak.talente.sort((a, b) => b.age - a.age || b.truePotential - a.truePotential).map(p => zeile(p, t.id) + knopf(p)).join('') : '<p class="vb-leer">Gerade keine Talente.</p>');
    }

    element().querySelector('.vb-box').innerHTML = `
      <div class="vb-griff"></div>
      <div class="vb-kopf"><span class="vb-wappen">${wappen(t.id)}</span>
        <span class="vb-kopf-txt"><b>${esc(neuName(name))}${t.id === 'fcm' ? ' <em>(du)</em>' : ''}</b>
        <small>${info.euro ? esc((t.flag || '') + ' ' + (t.country || '')) + (info.comp ? ' · ' + COMP[info.comp] + (platz ? ' · ' + platz + '. Platz' : '') : '') : esc(neuName(info.group.name).replace(/^Bundesliga$/, 'Erste Liga')) + ' · ' + platz + '. Platz'}</small></span>
        <button type="button" class="vb-zu" aria-label="Schließen"><i class="ti ti-x" aria-hidden="true"></i></button></div>
      <div class="vb-kacheln">
        <div><b>${ovr}</b><small>Stärke</small></div><div><b>${tt.pts}</b><small>Punkte</small></div>
        <div><b>${tt.w}·${tt.d}·${tt.l}</b><small>S·U·N</small></div><div><b>${tt.gf}:${tt.ga}</b><small>Tore</small></div>
      </div>
      ${info.euro && !info.zeile ? '' : `<div class="vb-form"><span>Form</span>${typeof teamFormDots === 'function' ? teamFormDots(tt) : ''}</div>`}
      ${scoutBox}
      <div class="vb-reiter"><button type="button" data-vb-reiter="kader" class="${REITER === 'kader' ? 'an' : ''}">Kader${sp ? ' · ' + sp.length : ''}</button>
        <button type="button" data-vb-reiter="akademie" class="${REITER === 'akademie' ? 'an' : ''}">Akademie · ${ak.talente.length}</button>${window.KSMarkt && t.id !== 'fcm' ? `
        <button type="button" data-vb-reiter="transfers" class="${REITER === 'transfers' ? 'an' : ''}">Transfers</button>` : ''}</div>
      <div class="vb-liste">${liste}</div>`;
  }

  function oeffnen(teamId) {
    const info = teamInfo(teamId);
    if (!info) return false;
    OFFEN = teamId; REITER = 'kader';
    zeichnen();
    const el = element();
    requestAnimationFrame(() => el.classList.add('auf'));
    document.body.classList.add('vb-gesperrt');
    return true;
  }

  // ── Scout schicken und Berichte ──────────────────────────────────────────
  function scouten(dataId) {
    if (!hatSpiel()) return;
    let teamId = null, name = dataId, tierKey = 'liga3';
    for (const g of allGroups(LEAGUE)) { const t = g.group.teams.find(x => (x.dataId || String(x.id).replace(/^club_/, '')) === dataId); if (t) { teamId = t.id; name = t.name; tierKey = g.tierKey; break; } }
    if (!teamId) { const c = (window.EURO_CLUBS || []).find(x => x.id === dataId); if (c) { teamId = c.id; name = c.name; tierKey = 'europa'; } }
    const kosten = kostenFuer(tierKey);
    if ((CLUB.budget || 0) < kosten) {
      const t = `Für den Scout-Auftrag fehlt das Geld: ${euro(kosten)} nötig, ${euro(CLUB.budget || 0)} verfügbar.`;
      if (typeof window.showToast === 'function') window.showToast(t, 'warn'); else alert(t);
      return;
    }
    CLUB.budget -= kosten;
    zustand().auftraege[dataId] = { bis: absWoche() + CFG.dauerWochen, teamId, name, kosten };
    if (typeof addNews === 'function') addNews('club', '🔭 Scout unterwegs', `Ein Scout beobachtet ${neuName(name)} – Bericht über Kader und Akademie in ${CFG.dauerWochen} Wochen. Kosten: ${euro(kosten)}.`);
    try { if (typeof saveGameState === 'function') saveGameState(); } catch (e) { /* später */ }
    zeichnen();
  }
  function wochePruefen() {
    if (!hatSpiel() || !CLUB.vereinsScout) return;
    const z = zustand(), jetzt = absWoche();
    Object.keys(z.auftraege).forEach(dataId => {
      const a = z.auftraege[dataId];
      if (jetzt < a.bis && Math.floor(a.bis / 100) === Math.floor(jetzt / 100)) return;   // Saisonwechsel: sofort fertig
      const info = a.teamId ? teamInfo(a.teamId) : null;
      if (info) {
        const ovr = info.t.ovr != null ? info.t.ovr : 60;
        (kader(info) || []).concat(akademie(info, ovr).talente).forEach(p => { z.berichte[p.key] = { w: jetzt }; });
      }
      delete z.auftraege[dataId];
      // Nutzer 2026-10-22: überflüssiger Text raus: „Tippe in der Tabelle auf den Verein.“ nur noch am Handy, am PC (body.pcu-an) weg
      const tippeHinweis = document.body && document.body.classList.contains('pcu-an') ? '' : ' Tippe in der Tabelle auf den Verein.';
      if (typeof addNews === 'function') addNews('club', '📋 Scout-Bericht: ' + neuName(a.name), `Der Bericht über ${neuName(a.name)} ist da: genaue Stärke und Potenzial aller Spieler und Talente.${tippeHinweis}`);
    });
    if (OFFEN) zeichnen();
  }
  if (typeof window.advanceCalendarWeek === 'function') {
    const _orig = window.advanceCalendarWeek;
    window.advanceCalendarWeek = function () { const r = _orig.apply(this, arguments); try { wochePruefen(); } catch (e) { console.warn('[Vereinsblatt] Woche', e); } return r; };
    try { advanceCalendarWeek = window.advanceCalendarWeek; } catch (e) { /* window reicht */ }
  }

  if (typeof window.showEuroTeamProfile === 'function') {
    const _euro = window.showEuroTeamProfile;
    window.showEuroTeamProfile = function (teamId) { if (!oeffnen(teamId)) return _euro.apply(this, arguments); };
  }

  // ── Profilkarte ersetzen ─────────────────────────────────────────────────
  if (typeof window.showTeamProfile === 'function') {
    const _orig = window.showTeamProfile;
    window.showTeamProfile = function (teamId) { if (!oeffnen(teamId)) return _orig.apply(this, arguments); };
    try { showTeamProfile = window.showTeamProfile; } catch (e) { /* window reicht */ }
  }

  // ── Aussehen (Kenney Tag/Nacht über die Tokens des Spiels) ───────────────
  const css = document.createElement('style');
  css.textContent = `
#vb-blatt{position:fixed;inset:0;z-index:9600;pointer-events:none}
#vb-blatt.auf{pointer-events:auto}
.vb-bg{position:absolute;inset:0;background:rgb(6 6 5/.62);opacity:0;transition:opacity .18s}
#vb-blatt.auf .vb-bg{opacity:1}
.vb-box{position:absolute;left:0;right:0;bottom:0;margin:0 auto;max-width:600px;max-height:88vh;overflow-y:auto;overscroll-behavior:contain;
  background:var(--bg2,#fffaf0);color:var(--text,#2b2a26);border-radius:22px 22px 0 0;border:3px solid var(--k-rahmen,#8b5a2b);border-bottom:0;
  padding:4px 14px calc(18px + env(safe-area-inset-bottom,0px));transform:translateY(100%);transition:transform .24s cubic-bezier(.2,.8,.3,1);
  font-family:var(--font-text,system-ui,sans-serif)}
#vb-blatt.auf .vb-box{transform:none}
body.vb-gesperrt{overflow:hidden}
.vb-griff{width:40px;height:4px;border-radius:3px;background:var(--bg4,#c9b48f);margin:6px auto 10px}
.vb-kopf{display:flex;align-items:center;gap:12px}
.vb-wappen svg{width:72px;height:78px;display:block}
.vb-kopf-txt{flex:1;min-width:0;display:flex;flex-direction:column}
.vb-kopf-txt b{font:700 21px/1.15 var(--font-titel,Fredoka,system-ui)}.vb-kopf-txt em{font-style:normal;color:var(--accent,#25c065);font-size:14px}
.vb-kopf-txt small{color:var(--text3,#846d52);margin-top:3px}
.vb-zu{border:0;background:var(--bg3,#efe2c8);color:inherit;width:38px;height:38px;border-radius:12px;font-size:20px;cursor:pointer;align-self:flex-start}
.vb-kacheln{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0 8px}
.vb-kacheln div{background:var(--bg3,#efe2c8);border-radius:12px;padding:8px 4px;text-align:center}
.vb-kacheln b{display:block;font:800 17px/1.1 var(--font-zahl,system-ui)}.vb-kacheln small{font-size:11px;color:var(--text3,#846d52)}
.vb-form{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text3,#846d52);margin:0 2px 10px}
.vb-scout{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 12px;border-radius:14px;border:2px solid var(--k-rand,#d9c29a);margin-bottom:10px}
.vb-scout>i{font-size:24px;color:var(--k-blau,#2c7cb5)}.vb-scout>span{flex:1;min-width:170px;display:flex;flex-direction:column}
.vb-scout small{color:var(--text3,#846d52);font-size:12px}.vb-scout.laeuft>i{color:var(--k-gold,#c9a227)}.vb-scout.fertig>i{color:var(--k-gruen,#25c065)}
.vb-knopf{font:700 14px/1 var(--font-titel,Fredoka,system-ui);border:0;border-radius:12px;padding:11px 14px;cursor:pointer;color:#fff;
  background:var(--k-gruen,#25c065);box-shadow:0 4px 0 var(--k-gruen-tief,#188a46)}
.vb-knopf:active{transform:translateY(3px);box-shadow:0 1px 0 var(--k-gruen-tief,#188a46)}
.vb-knopf.leise{background:var(--bg3,#efe2c8);color:var(--text,#2b2a26);box-shadow:0 3px 0 var(--k-rand,#d9c29a)}
.vb-knopf:disabled{opacity:.55;cursor:default;transform:none}
.vb-reiter{display:flex;gap:6px;margin:4px 0 8px}
.vb-reiter button{flex:1;font:700 14px/1 var(--font-titel,Fredoka,system-ui);padding:10px;border-radius:12px;border:2px solid var(--k-rand,#d9c29a);background:none;color:inherit;cursor:pointer}
.vb-reiter button.an{background:var(--k-blau,#2c7cb5);border-color:var(--k-blau-tief,#1d5a86);color:#fff}
.vb-teil{font:800 11px/1 var(--font-text,system-ui);letter-spacing:.1em;text-transform:uppercase;color:var(--text3,#846d52);margin:12px 4px 6px}
.vb-teil small{opacity:.7}
.vb-sp{display:flex;align-items:center;gap:10px;padding:7px 6px;border-radius:12px}
.vb-sp:nth-child(odd){background:color-mix(in srgb,var(--bg3,#efe2c8) 55%,transparent)}
.vb-gesicht{width:40px;height:40px;flex:none;border-radius:50%;overflow:hidden;background:var(--bg3,#efe2c8)}
.vb-gesicht svg{width:40px;height:40px;display:block}
.vb-sp-txt{flex:1;min-width:0;display:flex;flex-direction:column}.vb-sp-txt b{font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vb-sp-txt small,.vb-werte small{font-size:11.5px;color:var(--text3,#846d52)}
.vb-werte{display:flex;flex-direction:column;align-items:flex-end;gap:3px;min-width:74px}
.vb-zahl{font:800 18px/1 var(--font-zahl,system-ui)}
.vb-stufe{display:inline-block;font:800 11px/1 var(--font-zahl,system-ui);padding:4px 7px;border-radius:6px;border:1.5px solid rgb(0 0 0/.2)}
.vb-stufe.bronze{background:#e3b48a;color:#2b1608}.vb-stufe.silber{background:#d7dde5;color:#18202c}
.vb-stufe.gold{background:#f0cd57;color:#2a1c02}.vb-stufe.elite{background:#dcebf7;color:#1f5f8f;border-color:#b7950b}
.vb-ak-kopf{display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap;margin:10px 4px 6px}
.vb-ak-kopf small{color:var(--text3,#846d52);font-size:12px}
.vb-ak-fuss{display:flex;justify-content:flex-end;align-items:center;gap:8px;margin:-2px 6px 8px}.vb-ak-fuss .vb-knopf{padding:7px 10px;font-size:12px}
.vb-ak-grund{font-size:11px;color:var(--text3,#846d52)}
.vb-leer{color:var(--text3,#846d52);text-align:center;padding:18px 8px}
html.dark .vb-box{background:var(--bg2,#1e2230)}`;
  document.head.appendChild(css);

  // Scout-Express (Joker): laufenden Auftrag sofort abschließen
  function sofort(dataId) {
    if (!hatSpiel()) return false;
    const a = zustand().auftraege[dataId];
    if (!a) return false;
    a.bis = absWoche();
    wochePruefen();
    return true;
  }
  window.KSVereinsblatt = { oeffnen, scouten, sofort, auftraege: () => (hatSpiel() ? zustand().auftraege : {}), zustand: () => (hatSpiel() ? zustand() : null), CFG };
  console.log('[Kickstil-Vereinsblatt v1] aktiv — Verein antippen: Kader, Akademie, Verein scouten (Muster)');
})();
