/* =====================================================================
   DFL: Draft-Board vorab mit Merkliste + Draft-Gerüchte (D159 b/c, Nutzer 2026-10-15)
   Nutzer: „im Draft werden dir nur 5 vorgeschlagen. Ich würde vorab schon gucken wollen, wen ich haben möchte und welche
   Position ich brauche“ · „Draft-Gerüchte ja“ (Gerüchte, dass Vereine genau deine Draft-Picks auf dem Zettel haben).
   • Draft-Jahrgänge im Scouting (D24/D111, dfl_kader_patch.js vorschauHtml ruft vorschauHtml hier): der ganze Jahrgang mit
     Gesicht, Position, Alter, Stärke/Potenzial nur über DFLScouting (Scout-Stufe, Bericht), Positions-Chips mit Seiten-Codes
     wie im Scouting (GRUPPEN), Kaderlücken je Position (DFLGenerator.kaderAnalyse wie die Kaderanalyse im Draft), Stil-Filter,
     Merkliste (Stern, Reihenfolge per Hoch/Runter), Tipp des Chefscouts (Wunschspieler der Tutorial-Mission, dfl_missionen.js).
   • Draft-Fenster: unter den Top 5 Reiter „Merkliste“ und „Alle“ (Positionsfilter) mit „Wählen“ für jeden verfügbaren Spieler.
   • Merkliste: CLUB.dfl.draftboard = { jahr, merk: [Welt-IDs], pos, reiter, geruechte: [...], slots: {} } – nach dem Draft geleert.
   • Gerüchte (C): höchstens 4 je Draft – 3 in den Wochen davor (Spieltag 22, Ende der Hauptrunde, Playoffs ab Runde 2), 1 am
     Draft-Tag –, nur zu Talenten mit Bericht oder auf der Merkliste; 60 % wahr. Wahr: der Verein greift zu, sobald er dran ist
     und das Talent noch da ist (kiHaken in npcWahl), und will es mehr (wunschBonus in wunsch: Hochtraden, Fenster D94).
     Falsch: ändert nichts. Im ersten Draft der Tutorial-Mission ist kein Gerücht über den Wunschspieler wahr.
   API: DFLDraftboard = { CFG, GRUPPEN, gruppeVon, zustand, merk, schieben, istMerk, merkIds, filtern, luecken, vorschauHtml,
     draftListeHtml, draftTabelleHtml, kiHaken, wunschBonus, geruechtVon, geruechtMachen, woche, draftTag, draftFertig }
   ===================================================================== */
(function () {
  'use strict';
  const G = window.DFLGenerator, D = window.DFLSpiel;
  if (!G || !D) { console.warn('[DFL-Draftboard] DFL-Module fehlen – inaktiv'); return; }
  const CFG = {
    liste: 40,                                   // Zeilen je Seite („Mehr zeigen“ lädt die nächsten)
    geruechte: { max: 4, wahr: 0.6, bonus: 6, spieltagA: 22, spieltagB: 26, merkAnteil: 0.6 }
  };
  // Positions-Gruppen wie die Chips im Scouting (dfl_scouting_patch.js GRUPPEN, D95: Seiten-Codes)
  const GRUPPEN = [['TW', ['TW']], ['IV', ['IV']], ['LV/RV', ['LV', 'RV', 'AV']], ['ZDM', ['ZDM']], ['ZM', ['ZM']], ['LM/RM', ['LM', 'RM']],
    ['ZOM', ['OM', 'ZOM']], ['LF/RF', ['LF', 'RF', 'FL']], ['ST', ['ST']]];
  const weltPos = pos => (G.dflPos ? G.dflPos(pos) : pos);
  const gruppeVon = pos => { const p = weltPos(pos), x = GRUPPEN.find(g => g[1].indexOf(p) >= 0); return x ? x[0] : null; };
  const dfl = () => typeof CLUB !== 'undefined' && CLUB && CLUB.dfl && CLUB.dfl.aktiv && typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.dfl;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const voll = p => ((p.firstName ? p.firstName + ' ' : '') + (p.name || '')).trim();
  const ico = n => `<i class="ti ti-${n}" aria-hidden="true"></i>`;
  const speichern = () => { try { if (typeof saveGameState === 'function') saveGameState(); } catch (e) { /* Tests */ } };
  const liga = () => { try { return D.liga(); } catch (e) { return null; } };
  const franchise = id => (D.franchise ? D.franchise(id) : null) || {};
  const M = () => window.DFLMissionen || null;
  const posName = pos => (pos === 'OM' ? 'ZOM' : pos);
  const posBadge = pos => `<span class="pos-badge-sm pos-${esc(posName(pos))}">${esc(posName(pos))}</span>`;

  // ── Zustand ──────────────────────────────────────────────────────────────
  function zustand() {
    if (!dfl()) return null;
    const L = liga(), jahr = L && L.draft ? L.draft.jahr : null;
    let z = CLUB.dfl.draftboard;
    if (!z || typeof z !== 'object') z = CLUB.dfl.draftboard = { jahr, merk: [], geruechte: [], slots: {}, pos: null, reiter: null };
    if (!Array.isArray(z.merk)) z.merk = [];
    if (!Array.isArray(z.geruechte)) z.geruechte = [];
    if (!z.slots || typeof z.slots !== 'object') z.slots = {};
    // Neuer Jahrgang (nach dem Draft): Merkliste und Gerüchte gehören zum alten
    if (jahr && z.jahr !== jahr) { z.jahr = jahr; z.merk = []; z.geruechte = []; z.slots = {}; z.reiter = null; }
    return z;
  }
  const talente = () => { const L = liga(); return L && L.draft && Array.isArray(L.draft.talente) ? L.draft.talente : []; };
  const talent = id => talente().find(t => String(t.id) === String(id)) || null;
  const merkIds = () => { const z = zustand(); return z ? z.merk.slice() : []; };
  const istMerk = id => merkIds().indexOf(String(id)) >= 0;
  function merk(id) {
    const z = zustand(); if (!z) return false;
    id = String(id);
    const i = z.merk.indexOf(id);
    if (i >= 0) { z.merk.splice(i, 1); return false; }
    if (!talent(id)) return false;
    z.merk.push(id);
    return true;
  }
  function schieben(id, richtung) {
    const z = zustand(); if (!z) return;
    const i = z.merk.indexOf(String(id)), j = i + (richtung < 0 ? -1 : 1);
    if (i < 0 || j < 0 || j >= z.merk.length) return;
    [z.merk[i], z.merk[j]] = [z.merk[j], z.merk[i]];
  }
  // Talente einer Positions-Gruppe (null = alle), nach Medien-Rang
  function filtern(liste, gruppe) {
    return liste.filter(t => !gruppe || gruppeVon(t.pos) === gruppe).sort((a, b) => ((a.medien && a.medien.rang) || 999) - ((b.medien && b.medien.rang) || 999));
  }

  // ── Kaderlücken je Gruppe (Kaderanalyse deines Scoutings, wie im Draft-Dialog) ──
  const ART_RANG = { Stammspieler: 3, Backup: 2, Talent: 1 };
  function luecken() {
    const aus = {};
    try {
      const eigen = D.eigenSync(); if (!eigen) return aus;
      const sc = (CLUB.facilities && CLUB.facilities.scouting) || 5;
      const a = G.kaderAnalyse(eigen, { scouting: sc, saat: (CLUB.dfl.saisonIndex || 0) * 101 });
      Object.entries(a).filter(([, v]) => v && v.art).forEach(([pos, v]) => {
        const g = gruppeVon(pos); if (!g) return;
        const x = aus[g] = aus[g] || { art: v.art, bedarf: 0 };
        x.bedarf += v.bedarf || 0;
        if ((ART_RANG[v.art] || 0) > (ART_RANG[x.art] || 0)) x.art = v.art;
      });
    } catch (e) { console.warn('[DFL-Draftboard] Kaderlücken', e); }
    return aus;
  }
  const lueckeKl = art => art === 'Stammspieler' ? 'stamm' : art === 'Backup' ? 'backup' : 'talent';

  // ── Anzeige ──────────────────────────────────────────────────────────────
  const S = () => window.DFLScouting || null;
  function werte(t) {
    const sc = S();
    if (sc && sc.staerkeText) return { o: sc.staerkeText(t), p: sc.potText(t) };
    const K = window.DFLKader, s = K && K.schaetzung ? K.schaetzung(t, 0) : null;
    return s ? { o: s.ovr[0] + '–' + s.ovr[1], p: s.pot[0] + '–' + s.pot[1] } : { o: '?', p: '?' };
  }
  function gesicht(t) {
    let svg = '';
    try { svg = window.DFLIdentitaet ? DFLIdentitaet.gesichtSvg(t, null) : ''; } catch (e) { svg = ''; }
    return `<span class="db-gesicht" aria-hidden="true">${svg}</span>`;
  }
  function geruechtMarke(t) {
    const z = zustand(); if (!z) return '';
    const g = z.geruechte.find(x => x.id === String(t.id));
    if (!g) return '';
    const f = franchise(g.team);
    return `<span class="db-geruecht" title="Gerücht: ${esc(f.name || g.team)}">${ico('ear')}${esc(f.kurz || '')}</span>`;
  }
  // Eine Zeile. opt: { merkModus, waehlen (Draft, du bist dran), weg (schon gezogen: Text), tipp }
  function zeile(t, opt) {
    opt = opt || {};
    const id = String(t.id), an = istMerk(id), w = opt.weg ? null : werte(t), m = t.medien || {};
    const E = window.DFLEbenen && DFLEbenen.zeichenHtml ? window.DFLEbenen : null;
    const v = m.vorher, trend = v && v !== m.rang ? (v > m.rang ? `<span class="dfl-auf">▲${v - m.rang}</span>` : `<span class="dfl-ab">▼${m.rang - v}</span>`) : '';
    const ordnung = opt.merkModus && !opt.weg ? `<span class="db-ordnung"><button type="button" class="db-mini" data-db="hoch:${esc(id)}" aria-label="${esc(voll(t))} nach oben">${ico('chevron-up')}</button><button type="button" class="db-mini" data-db="runter:${esc(id)}" aria-label="${esc(voll(t))} nach unten">${ico('chevron-down')}</button></span>` : '';
    const wahl = opt.waehlen && !opt.weg ? `<button type="button" class="dfl-draft-btn db-waehlen" data-db="waehle:${esc(id)}">Wählen</button>` : '';
    const stern = opt.ohneStern ? '<span aria-hidden="true"></span>' : `<button type="button" class="db-stern${an ? ' an' : ''}" data-db="merk:${esc(id)}" aria-pressed="${an}" aria-label="${esc(voll(t))} ${an ? 'von der Merkliste nehmen' : 'auf die Merkliste'}">${ico(an ? 'star-filled' : 'star')}</button>`;
    return `<div class="db-zeile${an ? ' gemerkt' : ''}${opt.weg ? ' weg' : ''}${opt.tipp ? ' tipp' : ''}" data-db-id="${esc(id)}">
      ${stern}${gesicht(t)}
      <span class="db-name" data-sc="blatt:${esc(id)}" role="button" tabindex="0" aria-label="${esc(voll(t))}: Talent-Blatt öffnen"><b>${esc(voll(t))}${E ? E.zeichenHtml(t, { klein: true }) : ''}</b>
        <small>${posBadge(t.pos)} ${t.age} J. · #${m.rang || '?'} ${trend}${geruechtMarke(t)}${opt.weg ? ` · ${esc(opt.weg)}` : ''}</small></span>
      ${opt.weg ? '<span></span>' : `<span class="db-werte"><span><em>Stä</em>${esc(w.o)}</span><span><em>Pot</em>${esc(w.p)}</span></span>`}${ordnung}${wahl}</div>`;
  }
  function chipsHtml(gruppe, lk, zaehlen) {
    return `<div class="sc-chips-reihe db-pos" role="group" aria-label="Positionen">
      <button type="button" class="sc-chip" data-db="pos:alle" aria-pressed="${!gruppe}">Alle${zaehlen ? ` <b>${zaehlen('')}</b>` : ''}</button>
      ${GRUPPEN.map(([g]) => { const l = lk[g]; return `<button type="button" class="sc-chip${l ? ' db-luecke ' + lueckeKl(l.art) : ''}" data-db="pos:${esc(g)}" aria-pressed="${gruppe === g}"${l ? ` title="Lücke: ${esc(l.art)}"` : ''}>${l ? '<i class="db-punkt" aria-hidden="true"></i>' : ''}${esc(g)}${zaehlen ? ` <b>${zaehlen(g)}</b>` : ''}</button>`; }).join('')}</div>`;
  }
  function lueckenZeile(lk) {
    const top = Object.entries(lk).sort((a, b) => (ART_RANG[b[1].art] - ART_RANG[a[1].art]) || (b[1].bedarf - a[1].bedarf)).slice(0, 4);
    if (!top.length) return '';
    return `<div class="db-luecken">${ico('puzzle')}<span>Lücken:</span>${top.map(([g, v]) => `<button type="button" class="db-lk ${lueckeKl(v.art)}" data-db="pos:${esc(g)}"><b>${esc(g)}</b> ${esc(v.art)}</button>`).join('')}</div>`;
  }
  let ui = { mehr: CFG.liste, mehrDraft: CFG.liste };
  // Draft-Jahrgänge im Scouting (ersetzt die Tabelle aus dfl_kader_patch.js vorschauHtml)
  function vorschauHtml(jgs, j, voraus) {
    const z = zustand(); if (!z || !j) return '';
    const L = liga(), kommend = j === L.draft;
    const tabs = jgs.map(x => `<button class="subtab ${x === j ? 'active' : ''}" onclick="DFLKader.vorschau(${x.jahr})">Draft ${x.jahr} ${x === L.draft ? '(kommend)' : '(übernächster)'}</button>`).join('');
    const E = window.DFLEbenen && DFLEbenen.zeichenHtml ? window.DFLEbenen : null;
    const lk = kommend ? luecken() : {};
    const alle = j.talente.slice();
    const stilAn = E && E.filter && E.filter('draft');
    const stilN = E ? alle.filter(t => E.passtZuMir(t)).length : 0;
    const basis = alle.filter(t => !stilAn || E.passtZuMir(t));
    const zaehlen = g => basis.filter(t => !g || gruppeVon(t.pos) === g).length;
    const liste = filtern(basis, z.pos);
    const sicht = liste.slice(0, ui.mehr);
    const sc = (CLUB.facilities && CLUB.facilities.scouting) || 5;
    const legende = `Rang und Note: Medien · Stärke und Potenzial: dein Scouting (Stufe ${sc})${voraus ? ' · ein Jahr vorher unschärfer' : ' · Prognose: Mock-Draft'}. Stern: Merkliste für den Draft. Ein Tipp auf ein Talent: College, Text der Medien, Note, Mock-Draft.`;
    if (typeof window.infoKarteSetzen === 'function') window.infoKarteSetzen('draft-jahrgang', 'Draft-Jahrgänge', legende);
    // Merkliste (nur kommender Draft)
    let merkBlock = '';
    if (kommend) {
      const ms = z.merk.map(talent).filter(Boolean);
      // Nutzer 2026-10-22: überflüssiger Text raus: „Stern antippen, um ein Talent zu merken“ nur am Handy, am PC (body.pcu-an) leer
      const merkTipp = document.body.classList.contains('pcu-an') ? '' : 'Stern antippen, um ein Talent zu merken';
      merkBlock = `<div class="db-merk"><div class="db-titel">${ico('star-filled')}<b>Merkliste</b><small>${ms.length ? ms.length + (ms.length === 1 ? ' Talent' : ' Talente') : merkTipp}</small></div>
        ${ms.map((t, i) => `<div class="db-merk-zeile"><span class="db-nr">${i + 1}</span>${zeile(t, { merkModus: true })}</div>`).join('')}</div>`;
    }
    // Tipp des Chefscouts (Wunschspieler der Mission)
    let tipp = '';
    const wId = kommend && M() && M().wunschId ? M().wunschId() : null, wt = wId && talent(wId);
    if (wt) {
      const cs = window.DFLChefscout && DFLChefscout.person ? DFLChefscout.person() : null;
      tipp = `<div class="db-tippbox"><div class="db-titel">${ico('user-search')}<b>Tipp des Chefscouts</b>${cs ? `<small>${esc(voll(cs))}</small>` : ''}</div>${zeile(wt, { tipp: true })}</div>`;
    }
    return `<div class="dfl-vorschau db-board"><div class="news-header"><i class="ti ti-school" aria-hidden="true"></i> Draft-Jahrgänge${typeof window.infoBtn === 'function' ? window.infoBtn('draft-jahrgang') : ''}</div>
      <div class="subtabs">${tabs}</div>
      ${tipp}${merkBlock}
      ${kommend ? lueckenZeile(lk) : ''}
      ${chipsHtml(z.pos, lk, zaehlen)}
      ${E ? `<div class="dfl-draft-filter">${E.filterChipHtml('draft', stilN)}</div>` : ''}
      <div class="db-liste">${sicht.map(t => zeile(t, { ohneStern: !kommend })).join('') || '<div class="dfl-draft-sub">Niemand auf dieser Position.</div>'}</div>
      ${liste.length > sicht.length ? `<button type="button" class="app-knopf db-mehr" data-db="mehr">Mehr zeigen · ${liste.length - sicht.length} weitere</button>` : ''}
      <div class="dfl-draft-sub db-fuss">${sicht.length} von ${liste.length}</div></div>`;
  }
  // Draft-Fenster: Reiter Merkliste / Alle (ersetzt die Tabelle unter dem Board in dfl_kader_patch.js draftHtml)
  function draftListeHtml(d, ich) {
    const z = zustand(); if (!z || !d) return '';
    const K = window.DFLKader;
    const verf = K && K.verfuegbar ? K.verfuegbar() : talente().slice();
    const frei = new Set(verf.map(t => String(t.id)));
    const merkFrei = z.merk.filter(id => frei.has(id)).length;
    const reiter = z.reiter === 'merk' || z.reiter === 'alle' ? z.reiter : (merkFrei ? 'merk' : 'alle');
    let inhalt;
    if (reiter === 'merk') {
      const zeilen = z.merk.map(id => {
        if (frei.has(id)) return zeile(talent(id), { merkModus: true, waehlen: ich });
        const p = (d.picks || []).find(x => String(x.id) === id);
        if (!p) return '';
        const kurz = p.team === 'fcm' ? 'bei dir' : (franchise(D.dflIdVon(p.team)).kurz || p.team);
        const L = liga(), w = L ? [].concat(...L.teams.map(x => x.roster || [])).find(x => String(x.id) === id) : null;
        const t = w ? Object.assign({}, w, { medien: { rang: p.medien } }) : { id, firstName: '', name: p.name, pos: p.pos, age: p.age, medien: { rang: p.medien } };
        return zeile(t, { merkModus: true, weg: `weg an #${p.pick} ${kurz}`, ohneStern: true });
      }).filter(Boolean);
      // Nutzer 2026-10-22: überflüssiger Text raus: am PC (body.pcu-an) nur „Deine Merkliste ist leer.“, am Handy unverändert
      inhalt = zeilen.length ? zeilen.join('') : `<div class="dfl-draft-sub">Deine Merkliste ist leer.${document.body.classList.contains('pcu-an') ? '' : ' Unter „Alle“ den Stern antippen.'}</div>`;
    } else {
      const lk = luecken();
      const E = window.DFLEbenen && DFLEbenen.zeichenHtml ? window.DFLEbenen : null;
      const stilAn = E && E.filter && E.filter('draftboard');
      const stilN = E ? verf.filter(t => E.passtZuMir(t)).length : 0;
      const basis = verf.filter(t => !stilAn || E.passtZuMir(t));
      const liste = filtern(basis, z.pos), sicht = liste.slice(0, ui.mehrDraft);
      // Tipp des Chefscouts (Wunschspieler der Mission) steht oben, solange er da ist
      const wId = M() && M().wunschId ? M().wunschId() : null, wt = wId && frei.has(wId) ? talent(wId) : null;
      const tipp = wt ? `<div class="db-tippbox"><div class="db-titel">${ico('user-search')}<b>Tipp des Chefscouts</b></div>${zeile(wt, { tipp: true, waehlen: ich })}</div>` : '';
      inhalt = `${tipp}${lueckenZeile(lk)}${chipsHtml(z.pos, lk, g => basis.filter(t => !g || gruppeVon(t.pos) === g).length)}
        ${E ? `<div class="dfl-draft-filter">${E.filterChipHtml('draftboard', stilN)}</div>` : ''}
        ${sicht.map(t => zeile(t, { waehlen: ich })).join('') || '<div class="dfl-draft-sub">Niemand auf dieser Position.</div>'}
        ${liste.length > sicht.length ? `<button type="button" class="app-knopf db-mehr" data-db="mehrDraft">Mehr zeigen · ${liste.length - sicht.length} weitere</button>` : ''}`;
    }
    return `<div class="db-draft"><div class="db-seg" role="tablist" aria-label="Talente">
        <button type="button" role="tab" aria-selected="${reiter === 'merk'}" class="${reiter === 'merk' ? 'an' : ''}" data-db="reiter:merk">${ico('star-filled')}Merkliste <b>${merkFrei}</b></button>
        <button type="button" role="tab" aria-selected="${reiter === 'alle'}" class="${reiter === 'alle' ? 'an' : ''}" data-db="reiter:alle">${ico('list')}Alle <b>${verf.length}</b></button></div>
      <div class="db-liste">${inhalt}</div></div>`;
  }

  // Draft am PC (Nutzer 2026-10-24, Entwurf A): einfache Tabelle mit Stern, Reiter Alle / Merkliste / Nur meine Lücken,
  // Spaltenköpfe sortieren. dfl_kader_patch.js draftPcHtml setzt sie rechts neben die nächsten 20 Picks.
  const NOTE_WERT = n => { const m = /^([A-F])([+-]?)/.exec(n || ''); return m ? (6 - 'ABCDEF'.indexOf(m[1])) * 3 + (m[2] === '+' ? 1 : m[2] === '-' ? -1 : 0) : 0; };
  function mitte(t, art) {
    const K = window.DFLKader, s = K && K.schaetzung ? K.schaetzung(t, 0) : null;
    return s ? (s[art][0] + s[art][1]) / 2 : 0;
  }
  const SORT = {
    rang: t => (t.medien && t.medien.rang) || 999, name: t => voll(t), pos: t => GRUPPEN.findIndex(g => g[0] === gruppeVon(t.pos)),
    alter: t => t.age, staerke: t => -mitte(t, 'ovr'), pot: t => -mitte(t, 'pot'), note: t => -NOTE_WERT(t.medien && t.medien.note)
  };
  function draftTabelleHtml(d, ich) {
    const z = zustand(); if (!z || !d) return '';
    const K = window.DFLKader;
    const verf = K && K.verfuegbar ? K.verfuegbar() : talente().slice();
    const frei = new Set(verf.map(t => String(t.id)));
    const merkFrei = z.merk.filter(id => frei.has(id)).length;
    // Am PC immer erst „Alle“ (am Handy springt der Draft auf die Merkliste, sobald sie etwas hat – hier würde der Stern sonst den Reiter wechseln)
    const reiter = ['alle', 'merk', 'luecken'].indexOf(z.reiter) >= 0 ? z.reiter : 'alle';
    const E = window.DFLEbenen && DFLEbenen.zeichenHtml ? window.DFLEbenen : null;
    const stilAn = E && E.filter && E.filter('draftboard');
    const stilN = E ? verf.filter(t => E.passtZuMir(t)).length : 0;
    const basis = verf.filter(t => !stilAn || E.passtZuMir(t));
    // „Nur meine Lücken“: Positionen, auf denen dir ein Stammspieler oder Backup fehlt (reine Talent-Plätze zählen nicht)
    const lk = Object.fromEntries(Object.entries(luecken()).filter(([, v]) => v.art === 'Stammspieler' || v.art === 'Backup')), lkTop = Object.entries(lk).sort((a, b) => (ART_RANG[b[1].art] - ART_RANG[a[1].art]) || (b[1].bedarf - a[1].bedarf));
    const nLuecken = basis.filter(t => lk[gruppeVon(t.pos)]).length;
    const wId = M() && M().wunschId ? M().wunschId() : null;
    const sort = ui.sortDraft || { feld: 'rang', ab: false };
    const sortiert = liste => {
      const f = SORT[sort.feld] || SORT.rang;
      return liste.slice().sort((a, b) => { const x = f(a), y = f(b), r = typeof x === 'string' ? x.localeCompare(y, 'de') : x - y; return (sort.ab ? -r : r) || SORT.rang(a) - SORT.rang(b); });
    };
    const zelle = (t, opt) => {
      opt = opt || {};
      const id = String(t.id), an = istMerk(id), m = t.medien || {}, w = opt.weg ? null : werte(t);
      const v = m.vorher, trend = v && v !== m.rang ? (v > m.rang ? `<span class="dfl-auf">▲${v - m.rang}</span>` : `<span class="dfl-ab">▼${m.rang - v}</span>`) : '';
      const stern = opt.weg ? '' : `<button type="button" class="db-stern${an ? ' an' : ''}" data-db="merk:${esc(id)}" aria-pressed="${an}" aria-label="${esc(voll(t))} ${an ? 'von der Merkliste nehmen' : 'auf die Merkliste'}">${ico(an ? 'star-filled' : 'star')}</button>`;
      const ordnung = opt.nr ? `<span class="db-ordnung"><button type="button" class="db-mini" data-db="hoch:${esc(id)}" aria-label="${esc(voll(t))} nach oben">${ico('chevron-up')}</button><button type="button" class="db-mini" data-db="runter:${esc(id)}" aria-label="${esc(voll(t))} nach unten">${ico('chevron-down')}</button></span>` : '';
      const note = m.note ? `<span class="dfl-note ${/^A/.test(m.note) ? 'a' : /^B/.test(m.note) ? 'b' : 'c'}">${esc(m.note)}</span>` : '';
      return `<tr class="${an ? 'gemerkt' : ''}${opt.weg ? ' weg' : ''}${opt.tipp ? ' tipp' : ''}" data-db-id="${esc(id)}">
        <td class="dpc-st">${opt.nr ? `<span class="db-nr">${opt.nr}</span>` : ''}${stern}</td>
        <td class="num">#${m.rang || '?'} ${trend}</td>
        <td><span class="dpc-name" data-sc="blatt:${esc(id)}" role="button" tabindex="0" aria-label="${esc(voll(t))}: Talent-Blatt öffnen"><b>${esc(voll(t))}</b>${E ? E.zeichenHtml(t, { klein: true }) : ''}${opt.tipp ? `<span class="dpc-tipp">${ico('user-search')}Tipp des Chefscouts</span>` : ''}${geruechtMarke(t)}</span>${opt.weg ? `<small class="dpc-weg">${esc(opt.weg)}</small>` : ''}</td>
        <td>${posBadge(t.pos)}</td><td class="num">${t.age}</td>
        <td class="num"><b>${w ? esc(w.o) : ''}</b></td><td class="num">${w ? esc(w.p) : ''}</td><td>${note}</td>
        <td class="dpc-akt">${ordnung}${ich && !opt.weg ? `<button type="button" class="dfl-draft-btn db-waehlen" data-db="waehle:${esc(id)}">Wählen</button>` : ''}</td></tr>`;
    };
    let zeilen, leer;
    if (reiter === 'merk') {
      zeilen = z.merk.map((id, i) => {
        if (frei.has(id)) return zelle(talent(id), { nr: i + 1 });
        const p = (d.picks || []).find(x => String(x.id) === id);
        if (!p) return '';
        const kurz = p.team === 'fcm' ? 'bei dir' : (franchise(D.dflIdVon(p.team)).kurz || p.team);
        return zelle({ id, firstName: '', name: p.name, pos: p.pos, age: p.age, medien: { rang: p.medien } }, { weg: `weg an #${p.pick} ${kurz}` });
      }).filter(Boolean);
      leer = 'Deine Merkliste ist leer.';
    } else {
      const liste = sortiert(reiter === 'luecken' ? basis.filter(t => lk[gruppeVon(t.pos)]) : basis);
      const tipp = wId && frei.has(wId) ? liste.find(t => String(t.id) === wId) : null;
      zeilen = (tipp ? [zelle(tipp, { tipp: true })] : []).concat(liste.filter(t => t !== tipp).map(t => zelle(t)));
      leer = reiter === 'luecken' ? 'Keine Lücken in deinem Kader.' : 'Kein Talent passt klar zu deinem Stil.';
    }
    const kopf = (feld, text, kl) => reiter === 'merk' ? `<th class="${kl || ''}">${text}</th>`
      : `<th class="${kl || ''} dpc-sort${sort.feld === feld ? ' an' : ''}" data-db="sort:${feld}" role="button" tabindex="0">${text}${sort.feld === feld ? ico(sort.ab ? 'chevron-up' : 'chevron-down') : ''}</th>`;
    const reiterKnopf = (r, icon, text, n) => `<button type="button" role="tab" aria-selected="${reiter === r}" class="${reiter === r ? 'an' : ''}" data-db="reiter:${r}">${ico(icon)}${text} <b>${n}</b></button>`;
    return `<div class="dpc-spalte dpc-talente"><div class="dpc-kt">Talente
        ${E ? `<span class="dpc-stil">${E.filterChipHtml('draftboard', stilN)}</span>` : ''}
        <span class="dpc-reiter" role="tablist" aria-label="Talente">${reiterKnopf('alle', 'list', 'Alle', basis.length)}${reiterKnopf('merk', 'star-filled', 'Merkliste', merkFrei)}${reiterKnopf('luecken', 'puzzle', 'Nur meine Lücken', nLuecken)}</span></div>
      ${reiter === 'luecken' && lkTop.length ? `<div class="dpc-luecken">${ico('puzzle')}${lkTop.map(([g, v]) => `<span class="db-lk ${lueckeKl(v.art)}"><b>${esc(g)}</b> ${esc(v.art)}</span>`).join('')}</div>` : ''}
      <div class="dpc-scroll" data-scroll="talente-${reiter}-${sort.feld}-${sort.ab ? 1 : 0}"><table class="dpc-tab"><thead><tr><th class="dpc-st"></th>${kopf('rang', 'Rang', 'num')}${kopf('name', 'Name')}${kopf('pos', 'Pos')}${kopf('alter', 'Alter', 'num')}${kopf('staerke', 'Stärke', 'num')}${kopf('pot', 'Pot.', 'num')}${kopf('note', 'Note')}<th></th></tr></thead>
        <tbody>${zeilen.join('') || `<tr><td colspan="9" class="dfl-draft-sub dpc-leer">${leer}</td></tr>`}</tbody></table></div></div>`;
  }

  // ── Gerüchte ─────────────────────────────────────────────────────────────
  const rng = key => G.rngAus((((CLUB.dfl.seed || 1) * 977) ^ G.hashText('geruecht|' + key)) >>> 0);
  // Erste Picks je Verein (Welt-IDs, 1-basiert): am Draft-Tag die echten Slots, vorher die erwartete Reihenfolge
  function erstePicks() {
    const L = liga(), d = LEAGUE.dflDraft, aus = new Map();
    if (d && !d.fertig && d.slots && L.draft && d.jahr === L.draft.jahr) {
      d.slots.forEach((s, i) => { if (i < d.nr) return; const id = D.dflIdVon(s.besitzer); if (!aus.has(id)) aus.set(id, i + 1); });
      return aus;
    }
    const rf = (L.draft && L.draft.reihenfolge) || [];
    const n = rf.length || 32;
    (L.picks || []).filter(x => L.draft && x.jahr === L.draft.jahr && rf.indexOf(x.von) >= 0).forEach(x => {
      const nr = (x.runde - 1) * n + rf.indexOf(x.von) + 1;
      if (!aus.has(x.besitzer) || aus.get(x.besitzer) > nr) aus.set(x.besitzer, nr);
    });
    if (!aus.size) rf.forEach((id, i) => aus.set(id, i + 1));
    return aus;
  }
  function teamFuer(t, r) {
    const eig = D.eigeneDflId(), picks = [...erstePicks().entries()].filter(([id]) => id !== eig);
    if (!picks.length) return null;
    const m = t.medien || {}, prog = (m.prognose && m.prognose.pick) || m.rang || 16;
    const meiner = erstePicks().get(eig) || 999;
    let kand = picks.filter(([, nr]) => nr >= prog - 10 && nr <= prog + 2);
    const vorMir = kand.filter(([, nr]) => nr < meiner);
    if (vorMir.length) kand = vorMir;
    if (!kand.length) kand = picks.filter(([, nr]) => nr <= prog + 6);
    if (!kand.length) kand = picks;
    const [id, nr] = kand[Math.floor(r() * kand.length)];
    return { id, nr };
  }
  const SAETZE = [
    (stadt, n) => `Gerücht: ${stadt} hat ${n} ganz oben auf dem Zettel`,
    (stadt, n) => `Gerücht: ${stadt} lädt ${n} zum Probetraining`,
    (stadt, n) => `Gerücht: ${stadt} will ${n} unbedingt`
  ];
  // slot: 'a' | 'b' | 'c' (Wochen davor) | 'd' (Draft-Tag) – jeder Schlitz feuert höchstens einmal je Draft
  function geruechtMachen(slot) {
    const z = zustand(), L = liga();
    if (!z || !L || !L.draft || !talente().length) return null;
    if (z.slots[slot]) return null;
    z.slots[slot] = true;
    if (z.geruechte.length >= CFG.geruechte.max) return null;
    const sc = S(), genannt = new Set(z.geruechte.map(g => g.id));
    const gesehen = t => !genannt.has(String(t.id)) && (istMerk(t.id) || !!(sc && sc.hatBericht && sc.hatBericht(t.id)));
    const d = LEAGUE.dflDraft, weg = new Set(d && d.picks ? d.picks.map(p => String(p.id)) : []);
    const kand = talente().filter(t => gesehen(t) && !weg.has(String(t.id))).sort((a, b) => ((a.medien && a.medien.rang) || 999) - ((b.medien && b.medien.rang) || 999));
    if (!kand.length) return null;
    const r = rng(z.jahr + '|' + slot);
    const ausMerk = kand.filter(t => istMerk(t.id));
    const pool = (ausMerk.length && r() < CFG.geruechte.merkAnteil ? ausMerk : kand).slice(0, 12);
    const t = pool[Math.floor(r() * pool.length)];
    const team = teamFuer(t, r); if (!team) return null;
    let wahr = r() < CFG.geruechte.wahr;
    if (M() && M().istWunsch && M().istWunsch(t.id, z.jahr)) wahr = false;        // erster Draft: der Wunschspieler bleibt
    const f = franchise(team.id), stadt = f.city || f.name || team.id;
    const titel = SAETZE[Math.floor(r() * SAETZE.length)](stadt, t.name);
    const m = t.medien || {};
    const text = `${voll(t)} (${posName(t.pos)}, ${t.age} J., ${t.college || 'College'}) soll bei den ${f.name || stadt} weit oben stehen. ` +
      `${f.name || stadt} ${slot === 'd' ? 'wählt' : 'wählen voraussichtlich'} an #${team.nr}` + (m.rang ? `, die Medien sehen ihn auf Rang ${m.rang}.` : '.');
    const g = { id: String(t.id), team: team.id, wahr, slot, s: LEAGUE.season, w: LEAGUE.week, titel, grund: istMerk(t.id) ? 'merk' : 'bericht' };
    z.geruechte.push(g);
    if (typeof addNews === 'function') addNews('transfer', titel, text);
    speichern();
    return g;
  }
  // Wochentakt: Schlitze a–c in den Wochen vor dem Draft (nur solange der Draft noch nicht läuft)
  function woche() {
    try {
      if (!dfl() || !zustand() || (LEAGUE.dflDraft && !LEAGUE.dflDraft.fertig)) return;
      const md = LEAGUE.matchday || 0, po = LEAGUE.dflPO;
      if (po && (po.runde || 0) >= 2) geruechtMachen('c');
      else if (md >= CFG.geruechte.spieltagB) geruechtMachen('b');
      else if (md >= CFG.geruechte.spieltagA) geruechtMachen('a');
    } catch (e) { console.warn('[DFL-Draftboard] Gerüchte', e); }
  }
  function draftTag() {
    try { const d = dfl() && LEAGUE.dflDraft; if (d && !d.fertig && d.nr === 0) geruechtMachen('d'); } catch (e) { console.warn('[DFL-Draftboard] Gerücht am Draft-Tag', e); }
  }
  const geruechtVon = (teamId, talentId) => { const z = zustand(); return z ? z.geruechte.find(g => g.wahr && g.team === teamId && g.id === String(talentId)) || null : null; };
  function wunschBonus(teamId, talentId, d) {
    const z = zustand(); if (!z || (d && d.jahr !== z.jahr)) return 0;
    if (M() && M().geschuetzt && M().geschuetzt(d) === String(talentId)) return 0;
    return geruechtVon(teamId, talentId) ? CFG.geruechte.bonus : 0;
  }
  // npcWahl (dfl_kader_patch.js): verf ohne geschützten Wunschspieler; wahres Gerücht → der Verein greift zu
  function kiHaken(d, besitzer, verf) {
    const z = zustand(); if (!z || !d) return null;
    let liste = verf;
    const w = M() && M().geschuetzt ? M().geschuetzt(d) : null;
    if (w) liste = verf.filter(t => String(t.id) !== w);
    let zwang = null;
    if (d.jahr === z.jahr) {
      const tid = D.dflIdVon(besitzer);
      const g = z.geruechte.find(x => x.wahr && x.team === tid && liste.some(t => String(t.id) === x.id));
      if (g) zwang = liste.find(t => String(t.id) === g.id) || null;
    }
    return { verf: liste, zwang };
  }
  // Nach dem Draft: Rückblick auf die Gerüchte (eine Meldung), Merkliste leeren
  function draftFertig(d) {
    const z = zustand(); if (!z) return;
    if (z.jahr === d.jahr && z.geruechte.length && !z.rueckblick) {
      const teile = z.geruechte.map(g => {
        const p = (d.picks || []).find(x => String(x.id) === g.id), f = franchise(g.team);
        if (!p) return null;
        const bei = p.team === 'fcm' ? 'zu dir' : `zu den ${(franchise(D.dflIdVon(p.team)).name) || p.team}`;
        return D.dflIdVon(p.team) === g.team ? `${p.name} ging an #${p.pick} wirklich zu den ${f.name || g.team}` : `${p.name} ging an #${p.pick} ${bei}, nicht zu den ${f.name || g.team}`;
      }).filter(Boolean);
      if (teile.length && typeof addNews === 'function') addNews('transfer', `Die Draft-Gerüchte ${d.jahr} im Rückblick`, teile.join(' · ') + '.');
      z.rueckblick = true;
    }
    z.merk = []; z.reiter = null;
  }

  // ── Klicks ───────────────────────────────────────────────────────────────
  function neuZeichnen() {
    const d = LEAGUE.dflDraft, K = window.DFLKader;
    if (document.getElementById('dfl-draft-ov') && d && !d.fertig && K && K.zeichne) K.zeichne();
    const box = document.getElementById('dfl-draftboard');
    if (box && box.isConnected && K && K.vorschauHtml) { try { box.innerHTML = K.vorschauHtml(); } catch (e) { console.warn('[DFL-Draftboard] Anzeige', e); } }
  }
  function aktion(a) {
    const z = zustand(); if (!z) return;
    const [was, wert] = [a.split(':')[0], a.slice(a.indexOf(':') + 1)];
    if (was === 'merk') {
      const an = merk(wert);
      if (typeof showToast === 'function') { const t = talent(wert) || {}; showToast(`${voll(t)} ${an ? 'steht auf deiner Merkliste' : 'ist von der Merkliste'}`, 'info'); }
      speichern();
    } else if (was === 'hoch' || was === 'runter') { schieben(wert, was === 'hoch' ? -1 : 1); speichern(); }
    else if (was === 'pos') { z.pos = wert === 'alle' ? null : wert; ui.mehr = CFG.liste; ui.mehrDraft = CFG.liste; }
    else if (was === 'reiter') z.reiter = wert;
    else if (was === 'sort') { const a = ui.sortDraft || { feld: 'rang', ab: false }; ui.sortDraft = { feld: wert, ab: a.feld === wert ? !a.ab : false }; }
    else if (was === 'mehr') ui.mehr += CFG.liste;
    else if (was === 'mehrDraft') ui.mehrDraft += CFG.liste;
    else if (was === 'waehle') { if (window.DFLKader) DFLKader.draftWahl(wert); return; }
    neuZeichnen();
  }
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('click', ev => {
      const b = ev.target && ev.target.closest && ev.target.closest('[data-db]');
      if (!b || !dfl()) return;
      ev.preventDefault(); ev.stopPropagation();
      aktion(b.getAttribute('data-db'));
    });
  }

  // ── Einhängen ────────────────────────────────────────────────────────────
  {
    const _orig = window.advanceCalendarWeek;
    if (typeof _orig === 'function') {
      window.advanceCalendarWeek = function () { const r = _orig.apply(this, arguments); woche(); return r; };
      try { advanceCalendarWeek = window.advanceCalendarWeek; } catch (e) { /* window reicht */ }
    }
  }
  {
    const _orig = window.startNewSeason;
    if (typeof _orig === 'function') {
      window.startNewSeason = function () { const r = _orig.apply(this, arguments); draftTag(); return r; };
      try { startNewSeason = window.startNewSeason; } catch (e) { /* window reicht */ }
    }
  }

  if (typeof document !== 'undefined' && document.head && document.createElement) {
    const css = document.createElement('style');
    css.id = 'dfl-draftboard-css';
    css.textContent = `.db-board .db-liste,.db-draft .db-liste{display:flex;flex-direction:column;gap:6px;margin:6px 0}
.db-zeile{display:grid;grid-template-columns:34px 38px minmax(0,1fr) auto auto auto;align-items:center;gap:6px;padding:6px 8px;border:2px solid var(--k-linie,#e3c99a);border-radius:12px;background:var(--bg2,#fffdf9);color:var(--text,#2c3e50)}
.db-zeile.gemerkt{border-color:var(--k-gold,#e0a526)}
.db-zeile.tipp{border-color:var(--k-blau,#4aa3df)}
.db-zeile.weg{opacity:.55}
.db-zeile .db-name{min-width:0;cursor:pointer}
.db-zeile .db-name b{display:block;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.db-zeile .db-name small{display:flex;flex-wrap:wrap;align-items:center;gap:4px;font-size:12px;color:var(--text3,#846d52)}
.db-gesicht{width:36px;height:36px;border-radius:50%;overflow:hidden;background:var(--bg3,#f6ead2);display:block}
.db-gesicht svg{width:100%;height:100%;display:block}
.db-werte{display:flex;flex-direction:column;align-items:flex-end;font-size:12px;font-variant-numeric:tabular-nums;line-height:1.3}
.db-werte em{font-style:normal;color:var(--text3,#846d52);margin-right:4px}
.db-stern,.db-mini{font:inherit;cursor:pointer;background:transparent;border:0;color:var(--text3,#846d52);display:grid;place-items:center;border-radius:10px}
.db-stern{width:34px;height:34px;font-size:22px}
.db-stern.an{color:var(--k-gold,#e0a526)}
.db-mini{width:28px;height:22px;font-size:16px;border:2px solid var(--k-linie,#e3c99a);background:var(--bg3,#f6ead2)}
.db-ordnung{display:flex;flex-direction:column;gap:2px}
.db-stern:focus-visible,.db-mini:focus-visible,.db-seg button:focus-visible,.db-lk:focus-visible{outline:3px solid var(--k-blau,#4aa3df);outline-offset:2px}
.db-titel{display:flex;align-items:center;gap:6px;margin:10px 0 4px}.db-titel small{color:var(--text3,#846d52);font-size:12px}
.db-titel .ti{color:var(--k-gold,#e0a526)}
.db-merk-zeile{display:grid;grid-template-columns:20px minmax(0,1fr);align-items:center;gap:4px;margin-bottom:6px}
.db-nr{font-weight:700;color:var(--text3,#846d52);text-align:right}
.db-luecken{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:8px 0 4px;font-size:13px}
.db-lk{font:inherit;font-size:12px;cursor:pointer;border-radius:999px;padding:2px 8px;border:2px solid var(--k-linie,#e3c99a);background:var(--bg2,#fffdf9);color:var(--text,#2c3e50)}
.db-lk.stamm,.sc-chip.db-luecke.stamm .db-punkt{border-color:var(--k-rot,#e74c3c)}
.db-lk.backup,.sc-chip.db-luecke.backup .db-punkt{border-color:var(--k-gold,#e0a526)}
.db-lk.talent,.sc-chip.db-luecke.talent .db-punkt{border-color:var(--k-blau,#4aa3df)}
.db-punkt{display:inline-block;width:8px;height:8px;border-radius:50%;border:4px solid var(--k-gold,#e0a526);margin-right:4px;vertical-align:middle}
.db-geruecht{display:inline-flex;align-items:center;gap:2px;font-size:11px;padding:0 6px;border-radius:999px;background:var(--bg3,#f6ead2);color:var(--text2,#5c4a36)}
.db-seg{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:10px 0 4px}
.db-seg button{font:inherit;font-weight:600;cursor:pointer;padding:8px;border-radius:12px;border:2px solid var(--k-rand,#8b5a2b);background:var(--bg2,#fffdf9);color:var(--text,#2c3e50);display:flex;align-items:center;justify-content:center;gap:6px}
.db-seg button.an{background:var(--k-gruen,#78bc61);color:var(--k-gruen-text,#10230a);border-color:var(--k-gruen-tief,#4d8236)}
.db-mehr{width:100%;justify-content:center;margin:4px 0}
.db-fuss{text-align:center}
.db-tippbox{margin-top:8px}.db-tippbox .db-titel .ti{color:var(--k-blau,#4aa3df)}
.db-waehlen{white-space:nowrap}
@media (max-width:420px){.db-zeile{grid-template-columns:30px 32px minmax(0,1fr) auto auto auto;gap:4px;padding:6px}.db-gesicht{width:32px;height:32px}.db-stern{width:30px}}`;
    document.head.appendChild(css);
  }

  window.DFLDraftboard = { CFG, GRUPPEN, gruppeVon, zustand, merk, schieben, istMerk, merkIds, filtern, luecken, vorschauHtml, draftListeHtml, draftTabelleHtml,
    kiHaken, wunschBonus, geruechtVon, geruechtMachen, woche, draftTag, draftFertig };
  console.log('[DFL-Draftboard v1] aktiv — Draft-Jahrgang mit Positionsfilter, Kaderlücken und Merkliste, Merkliste/Alle im Draft, Draft-Gerüchte (D159 b/c)');
})();
