/* =====================================================================
   DFL: Tutorial-Missionen am Spielstart (D159 a, Nutzer 2026-10-15)
   Nutzer: „zum Tutorial gerne noch eine richtige Mannschaftsführung, wie der Draft läuft mit der Vorgabe Spieler x sich zu holen
   … und einen Vertrag von einem Star zu verlängern“ · „eins super aber ohne Winpunkte für dich“ · „der Wunschspieler bleibt und
   im Draft geht alles gut“.
   • Start: nach der ersten Tour (dfl_tutorial.js, Modus Lite, Saison 1 vor Spieltag 1). „Ohne Tour“ oder Modus Voll: keine Missionen;
     wer später auf Voll schaltet, sieht sie nicht mehr (auch der Schutz im Draft fällt weg).
   • Drei Aufträge mit Häkchen-Karte im Office, ein Ring mit kurzem Wort zeigt auf den nächsten Knopf:
     1. „Verlängere deinen Star“: bester eigener Spieler mit auslaufendem Vertrag (läuft keiner aus: Vertrag des besten Spielers
        endet nach dieser Saison) – Kader → Verträge → Verlängern → Unterschreiben (Folgevertrag, D92). Er sagt zu (istStar).
     2. „Hol dir deinen Wunschspieler“: der Chefscout nennt ein Talent des kommenden Drafts (Position einer Kaderlücke, Medien-Rang
        6–45, bester echter Wert), Bericht angefragt; Zwischenschritt Merkliste (DFLDraftboard). Im ersten Draft überspringt die KI
        ihn, bis du deinen ersten Pick gemacht hast (geschuetzt → DFLDraftboard.kiHaken), keine Niete (istWunsch), kein wahres
        Gerücht über ihn. Wer einen anderen nimmt, darf das – der Auftrag gilt dann als verpasst.
     3. „Stell deine Startelf auf“: Aufstellung ändern oder „Beste Elf“, vor Spieltag 1.
     Ohne Winpunkte. Seit D108 (2026-10-15) startet die Karriere am Tag der Verträge vor dem ersten Draft (dfl_startdraft.js): der
     Star wird dort gehalten (Ring auf „Halten“), der Wunschspieler gilt für den Start-Draft. Alte Spielstände ohne Start-Draft: wie
     vorher (Folgevertrag in der Saisonvorbereitung, erster Draft am Saisonende).
   Zustand: CLUB.dflTutorial.missionen = { an, star: { id, name, pos, bis, gekuerzt, status }, wunsch: { id, name, pos, jahr, art,
     status, pick, team }, elf: { hash, klick, status }, abschluss } – status null | 'ja' | 'nein'.
   API: DFLMissionen = { aktiv, zustand, nachTour, anlegen, pruefen, istStar, istWunsch, wunschId, geschuetzt, ziel, karteHtml }
   ===================================================================== */
(function () {
  'use strict';
  const G = window.DFLGenerator, D = window.DFLSpiel;
  if (!G || !D) { console.warn('[DFL-Missionen] DFL-Module fehlen – inaktiv'); return; }
  const dfl = () => typeof CLUB !== 'undefined' && CLUB && CLUB.dfl && CLUB.dfl.aktiv && typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.dfl;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const voll = p => ((p.firstName ? p.firstName + ' ' : '') + (p.name || '')).trim();
  const ico = n => `<i class="ti ti-${n}" aria-hidden="true"></i>`;
  const speichern = () => { try { if (typeof saveGameState === 'function') saveGameState(); } catch (e) { /* Tests */ } };
  const toast = (t, art) => { try { if (typeof showToast === 'function') showToast(t, art || 'info'); } catch (e) { /* ohne Toast */ } };
  const posName = pos => (pos === 'OM' ? 'ZOM' : pos);
  const jahrVon = s => (typeof seasonEndYear === 'function' ? seasonEndYear(s) : s);
  const DB = () => window.DFLDraftboard || null;
  const TITEL = { star: 'Verlängere deinen Star', wunsch: 'Hol dir deinen Wunschspieler', elf: 'Stell deine Startelf auf' };
  const REIHE = ['star', 'wunsch', 'elf'];

  function zustand() {
    if (!dfl() || !CLUB.dflTutorial) return null;
    return CLUB.dflTutorial.missionen || null;
  }
  // Aktiv nur im Modus Lite mit eingeschalteten Missionen (Voll / ohne Tour: keine)
  const aktiv = () => { const m = zustand(); return !!(m && m.an && CLUB.dflTutorial.modus === 'lite'); };
  const offen = k => { const m = zustand(); return !!(m && m[k] && !m[k].status); };

  // ── Anlegen ──────────────────────────────────────────────────────────────
  const imKader = id => (typeof SQUAD !== 'undefined' ? SQUAD.find(p => p.id === id) : null) || null;
  function starWaehlen() {
    // D108: Start am Tag der Verträge – der Star ist der Beste der Auslaufenden, verlängert wird dort (dfl_startdraft.js)
    const SD = window.DFLStartDraft;
    if (SD && SD.phase && SD.phase() === 'vertragstag') {
      const best = SD.auslauf().filter(q => !q.perspektiv && !q.onLoanFrom).sort((a, b) => (b.ovr || 0) - (a.ovr || 0))[0];
      if (best) return { id: best.id, name: voll(best), pos: best.pos, bis: LEAGUE.season - 1, start: true, gekuerzt: false, status: null };
    }
    const SW = window.DFLSaisonwechsel;
    const frei = p => !p.perspektiv && !p.onLoanFrom && !p.onLoanAt && !p.vertragFolge && !(SW && SW.verlaengerbarGrund && SW.verlaengerbarGrund(p.id));
    const alle = SQUAD.filter(p => !p.perspektiv && !p.onLoanFrom && !p.onLoanAt).sort((a, b) => (b.ovr || 0) - (a.ovr || 0));
    let p = alle.find(q => q.contractUntil === LEAGUE.season && frei(q)), gekuerzt = false;
    if (!p && alle.length) {
      // Keiner läuft aus: der Vertrag des besten Spielers endet nach dieser Saison (Gehalt dieser Saison bleibt)
      p = alle[0]; gekuerzt = true;
      p.contractUntil = LEAGUE.season; p.dflVertragBis = LEAGUE.season;
      if (p.contract && p.contract.years_remaining != null) p.contract.years_remaining = 1;
    }
    return p ? { id: p.id, name: voll(p), pos: p.pos, bis: p.contractUntil, gekuerzt, status: null } : null;
  }
  const WERT = t => 0.45 * (t.ovr || 0) + 0.55 * (t.truePotential || t.ovr || 0);
  function wunschWaehlen() {
    const L = D.liga(); if (!L || !L.draft || !L.draft.talente || !L.draft.talente.length) return null;
    const B = DB(), lk = B ? B.luecken() : {}, RANG = { Stammspieler: 3, Backup: 2, Talent: 1 };
    const gruppen = Object.entries(lk).sort((a, b) => (RANG[b[1].art] - RANG[a[1].art]) || (b[1].bedarf - a[1].bedarf)).map(([g, v]) => ({ g, art: v.art }));
    const imBand = t => t.medien && t.medien.rang >= 6 && t.medien.rang <= 45 && !t.niete;
    let t = null, art = null;
    for (const x of gruppen.slice(0, 3)) {
      const k = L.draft.talente.filter(q => imBand(q) && B && B.gruppeVon(q.pos) === x.g).sort((a, b) => WERT(b) - WERT(a));
      if (k.length) { t = k[0]; art = x.art; break; }
    }
    if (!t) t = L.draft.talente.filter(imBand).sort((a, b) => WERT(b) - WERT(a))[0] || null;
    if (!t) return null;
    try { if (window.DFLScouting && DFLScouting.scouten) DFLScouting.scouten(t.id, { still: true }); } catch (e) { /* Bericht kommt später */ }
    return { id: String(t.id), name: voll(t), pos: t.pos, jahr: L.draft.jahr, art: art || 'Talent', status: null };
  }
  const lineupHash = () => JSON.stringify([CLUB.formation || '', Object.entries(CLUB.lineup || {}).sort((a, b) => (a[0] < b[0] ? -1 : 1))]);
  function anlegen() {
    if (!dfl() || !CLUB.dflTutorial) return null;
    const m = { an: true, s: LEAGUE.season, w: LEAGUE.week, star: starWaehlen(), wunsch: wunschWaehlen(), elf: { hash: lineupHash(), klick: false, status: null }, abschluss: false };
    if (!m.star) m.star = { status: 'nein', name: '' };
    if (!m.wunsch) m.wunsch = { status: 'nein', name: '' };
    CLUB.dflTutorial.missionen = m;
    return m;
  }
  // Nach der Tour: einmal je Karriere, Lite, erste Saison vor Spieltag 1
  function nachTour() {
    const z = dfl() && CLUB.dflTutorial;
    if (!z || z.missionen || z.modus !== 'lite' || (CLUB.dfl.saisonIndex || 0) > 0 || (LEAGUE.matchday || 0) > 0) return false;
    anlegen(); speichern();
    setTimeout(intro, 300);
    return true;
  }

  // ── Prüfen (Häkchen) ─────────────────────────────────────────────────────
  function setze(k, status, extra) {
    const m = zustand(); if (!m || !m[k] || m[k].status) return;
    Object.assign(m[k], extra || {}, { status });
    if (status === 'ja') toast(`Auftrag erledigt: ${TITEL[k]}`, 'success');
    speichern();
    karteZeichnen();
  }
  function pruefen() {
    const m = zustand(); if (!m || !aktiv()) return m;
    // 1) Star
    if (offen('star') && m.star.start) {
      const e = window.DFLStartDraft && DFLStartDraft.ergebnisVon ? DFLStartDraft.ergebnisVon(m.star.id) : null, p = imKader(m.star.id);
      if (e === 'halten' && p) setze('star', 'ja', { bis: p.contractUntil });
      else if (e === 'gehen' || (!p && !(window.DFLStartDraft && DFLStartDraft.istAuslauf(m.star.id)))) setze('star', 'nein');
    } else if (offen('star')) {
      const p = imKader(m.star.id);
      if (!p) setze('star', 'nein');
      else if (p.vertragFolge || (p.contractUntil || 0) > m.star.bis) setze('star', 'ja');
      else if (LEAGUE.season > m.star.bis) setze('star', 'nein');
    }
    // 2) Wunschspieler
    if (offen('wunsch')) {
      const L = D.liga(), d = LEAGUE.dflDraft, w = m.wunsch;
      if (d && d.jahr === w.jahr) {
        const p = (d.picks || []).find(x => String(x.id) === w.id);
        if (p) setze('wunsch', p.team === 'fcm' ? 'ja' : 'nein', { pick: p.pick, team: p.team });
        else if (d.fertig) setze('wunsch', 'nein');
      } else if (L && L.draft && L.draft.jahr > w.jahr) setze('wunsch', 'nein');
    }
    // 3) Startelf
    if (offen('elf')) {
      const n = Object.values(CLUB.lineup || {}).filter(Boolean).length;
      if (n >= 11 && (m.elf.klick || lineupHash() !== m.elf.hash)) setze('elf', 'ja');
      else if ((LEAGUE.matchday || 0) >= 1) setze('elf', 'nein');
    }
    return m;
  }
  const istStar = p => !!(p && aktiv() && offen('star') && zustand().star.id === p.id);
  const istWunsch = (id, jahr) => { const m = zustand(); return !!(aktiv() && offen('wunsch') && m.wunsch.id === String(id) && (jahr == null || jahr === m.wunsch.jahr)); };
  const wunschId = () => (aktiv() && offen('wunsch') ? zustand().wunsch.id : null);
  // Erster Draft: geschützt, bis du deinen ersten Pick gemacht hast
  function geschuetzt(d) {
    const m = zustand();
    if (!d || !aktiv() || !offen('wunsch') || d.jahr !== m.wunsch.jahr) return null;
    if ((d.picks || []).some(p => p.team === 'fcm')) return null;
    return m.wunsch.id;
  }

  // ── Wohin zeigt der Ring? ────────────────────────────────────────────────
  const hatDom = typeof document !== 'undefined' && !!document.querySelector;
  function dran(el) {
    if (!el || !el.isConnected || el.offsetParent === null) return 0;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return 0;
    if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) return 1;          // da, aber nicht im Bild
    const hit = document.elementFromPoint(Math.min(window.innerWidth - 1, Math.max(0, r.left + r.width / 2)), Math.min(window.innerHeight - 1, Math.max(0, r.top + r.height / 2)));
    return hit && (hit === el || el.contains(hit)) ? 2 : 0;
  }
  // Kette vom tiefsten Schritt zum ersten: das erste Element, das sichtbar ist (oder ins Bild gerollt werden kann)
  function kette(L) {
    for (const [sel, text] of L) {
      const el = document.querySelector(sel), s = dran(el);
      if (s) return { el, text, sel, bild: s === 2 };
    }
    return null;
  }
  function ziel() {
    if (!hatDom || !aktiv()) return null;
    const m = zustand(), d = LEAGUE.dflDraft, K = window.DFLKader;
    const nav = n => `#app-nav [data-nav="${n}"]`;
    // Der erste Draft läuft
    if (offen('wunsch') && d && !d.fertig && d.jahr === m.wunsch.jahr) {
      const id = m.wunsch.id;
      if (!document.getElementById('dfl-draft-ov')) return kette([['#app-cta', 'Zum Draft']]);
      if (K && K.amZug && K.amZug(d) === 'fcm' && geschuetzt(d)) {
        const merk = DB() && DB().istMerk(id);
        // Ein Verein will deinen Pick unbedingt (D94): erst ablehnen, sonst ist der Wunschspieler weg
        return kette([['#dfl-fenster [onclick*="fenster(\'ab\')"]', 'Ablehnen'], [`#dfl-draft-ov [data-db="waehle:${id}"]`, 'Wählen'], [`#dfl-draft-ov [onclick*="draftWahl('${id}')"]`, 'Wählen'],
          [`#dfl-draft-ov [data-db="reiter:${merk ? 'merk' : 'alle'}"]`, merk ? 'Merkliste' : 'Alle']]);
      }
      if (geschuetzt(d)) return kette([['#dfl-draft-ov [onclick*="draftWeiter(\'bisIch\')"]', 'Bis zu deinem Pick']]);
      return null;
    }
    if (offen('star') && m.star.start) {
      // D108: am Tag der Verträge – erst „Halten“ beim Star, dann „Zum Draft“
      const SD = window.DFLStartDraft, z = SD && SD.zustand();
      if (!document.querySelector('.vt-ov')) return kette([['#app-cta', 'Tag der Verträge']]);
      if (z && z.wahl[m.star.id] === 'halten') return kette([['.vt-ov [data-vt="los"]:not([disabled])', 'Zum Draft'], ['.vt-ov [data-vt="empfehlung"]', 'Stab entscheidet']]);
      return kette([[`.vt-ov [data-vt="halten:${m.star.id}"]`, 'Halten']]);
    }
    if (offen('star')) {
      const id = m.star.id;
      return kette([['[data-v="ja"]', 'Unterschreiben'], ['#app-blatt.auf [data-a="sw-verl"]', 'Verlängern'],
        [`#view-squad [onclick*="vertragBlatt('${id}')"]`, 'Verlängern'], ['#view-squad .ksk-chips [data-filter="vertraege"]', 'Verträge'], ['#view-squad .ksk-tabs .subtab[data-k="spieler"]', 'Spieler'],
        ['#view-squad .subtab[onclick*="\'vertraege\'"]', 'Verträge'], [nav('kader'), 'Kader']]);   // 2026-10-18: Verträge sind ein Filter unter „Spieler“ (kickstil_kader_neu.js)
    }
    if (offen('wunsch') && !(DB() && DB().istMerk(m.wunsch.id)) && !(d && !d.fertig)) {
      return kette([[`#dfl-draftboard [data-db="merk:${m.wunsch.id}"]`, 'Merken'], ['#view-fo .fo-kachel[data-go="draft"]', 'Scouting'],
        ['#view-fo .fo-kachel[data-go="scout"]', 'Scouting'], [nav('fo'), 'Front Office']]);
    }
    if (offen('elf')) {
      return kette([['#sub-lineup .beste-elf', 'Beste Elf'], ['#view-squad .subtab[onclick*="\'lineup\'"]', 'Aufstellung'], [nav('kader'), 'Kader']]);
    }
    return null;
  }
  let ring = null, gerollt = '';
  function ringZeichnen() {
    try {
      if (!hatDom) return;
      pruefen();
      const laeuft = window.DFLSimulieren && DFLSimulieren.laeuft && DFLSimulieren.laeuft();
      const z = !laeuft ? ziel() : null;
      if (z && !z.bild && gerollt !== z.sel) { gerollt = z.sel; if (z.el.scrollIntoView) z.el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
      if (!z || !z.bild) { if (ring) ring.style.display = 'none'; return; }
      if (!ring) { ring = document.createElement('div'); ring.id = 'ms-ring'; ring.className = 'ms-ring'; ring.setAttribute('aria-hidden', 'true'); ring.innerHTML = '<span class="ms-tipp"></span>'; document.body.appendChild(ring); }
      const r = z.el.getBoundingClientRect();
      Object.assign(ring.style, { display: 'block', left: (r.left - 5) + 'px', top: (r.top - 5) + 'px', width: (r.width + 10) + 'px', height: (r.height + 10) + 'px' });
      const t = ring.querySelector('.ms-tipp');
      t.textContent = z.text;
      t.classList.toggle('unten', r.top < 60);
    } catch (e) { console.warn('[DFL-Missionen] Ring', e); }
  }

  // ── Oberfläche: Einstieg, Karte ──────────────────────────────────────────
  function scoutKopf() {
    let p = null;
    try { p = window.DFLChefscout && DFLChefscout.person(); } catch (e) { p = null; }
    const name = p ? voll(p) : 'Dein Chefscout';
    let bild = '';
    try { bild = p && window.DFLIdentitaet ? DFLIdentitaet.gesichtSvg({ seed: p.seed, dflSeed: p.seed, firstName: p.firstName, name: p.name, id: p.id }, null) : ''; } catch (e) { bild = ''; }
    return `<div class="tut-wer"><span class="ms-bild">${bild || esc(name.split(/\s+/).map(w => w[0]).slice(0, 2).join(''))}</span><span><b>${esc(name)}</b><small>Chefscout</small></span></div>`;
  }
  function wunschKarte() {
    const m = zustand(), w = m && m.wunsch, L = D.liga();
    const t = w && w.id && L && L.draft ? L.draft.talente.find(x => String(x.id) === w.id) : null;
    if (!t) return '';
    let svg = '';
    try { svg = window.DFLIdentitaet ? DFLIdentitaet.gesichtSvg(t, null) : ''; } catch (e) { svg = ''; }
    const S = window.DFLScouting, pot = S && S.potText ? S.potText(t) : (() => { const r = typeof potentialRange === 'function' ? potentialRange(t) : null; return r ? r.lo + '–' + r.hi : '?'; })();
    return `<div class="ms-wunsch"><span class="ms-bild gross">${svg}</span><span><b>${esc(voll(t))}</b>
      <small><span class="pos-badge-sm pos-${esc(posName(t.pos))}">${esc(posName(t.pos))}</span> ${t.age} J. · ${esc(t.college || '')}</small>
      <small>Potenzial ${esc(pot)} · Medien #${t.medien ? t.medien.rang : '?'}</small></span></div>`;
  }
  function intro() {
    const m = zustand(); if (!m || !aktiv() || !hatDom || document.querySelector('.ms-intro')) return;
    const w = m.wunsch, artText = { Stammspieler: 'ein Stammspieler', Backup: 'ein Backup', Talent: 'ein Talent' }[w.art] || 'ein Talent';
    const satz = w.id ? `${w.name} ist mein Mann für den Draft ${w.jahr}. Auf ${posName(w.pos)} fehlt uns ${artText}.` : '';
    const ov = document.createElement('div');
    ov.className = 'tut-ov ms-intro'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = `<div class="tut-blatt">
      ${scoutKopf()}
      <h2 class="tut-titel">Deine ersten Aufträge</h2>
      <ol class="ms-liste">${REIHE.map((k, i) => `<li class="ms-auftrag"><span class="ms-nr">${i + 1}</span><span><b>${TITEL[k]}</b><small>${esc(unterText(k))}</small></span></li>`).join('')}</ol>
      ${satz ? `<p class="ms-satz">„${esc(satz)}“</p>${wunschKarte()}` : ''}
      <div class="tut-knoepfe"><span></span><button type="button" class="tut-knopf" data-ms="los">Los geht's</button></div></div>`;
    document.body.appendChild(ov);
    ov.querySelector('[data-ms="los"]').onclick = () => { ov.remove(); m.introGesehen = true; speichern(); karteZeichnen(); };
  }
  function unterText(k) {
    const m = zustand(), x = m && m[k]; if (!x) return '';
    if (k === 'star') return x.status === 'ja' ? (x.start ? `${x.name}: neuer Vertrag bis ${jahrVon(x.bis)}` : `${x.name}: Folgevertrag unterschrieben`)
      : x.status === 'nein' ? (x.name ? `${x.name} ist nicht mehr da` : 'Kein Star im Kader')
      : x.start ? `${x.name} (${posName(x.pos)}) · Vertrag endet am Tag der Verträge` : `${x.name} (${posName(x.pos)}) · Vertrag endet ${jahrVon(x.bis)}`;
    if (k === 'wunsch') {
      if (x.status === 'ja') return `${x.name} kommt mit Pick #${x.pick}`;
      if (x.status === 'nein') { const f = x.team && x.team !== 'fcm' ? (D.franchise(D.dflIdVon(x.team)) || {}).name : null; return x.name ? `${x.name}${f ? ` ging an ${f} (#${x.pick})` : ' ist nicht gekommen'}` : 'Kein Talent im Draft'; }
      return `${x.name} (${posName(x.pos)}) · Draft ${x.jahr}${DB() && DB().istMerk(x.id) ? ' · auf deiner Merkliste' : ''}`;
    }
    return x.status === 'ja' ? 'Die Startelf steht' : x.status === 'nein' ? 'Der Trainer hat aufgestellt' : 'Vor Spieltag 1';
  }
  function karteHtml() {
    const m = zustand(); if (!m || !aktiv() || m.abschluss) return '';
    const n = REIHE.filter(k => m[k] && m[k].status === 'ja').length, fertig = REIHE.every(k => m[k] && m[k].status);
    const jetzt = REIHE.find(k => m[k] && !m[k].status);
    // Nur noch der Draft offen (läuft bis zum Saisonende): eine Zeile statt der ganzen Karte
    const kompakt = !fertig && REIHE.filter(k => m[k] && !m[k].status).length === 1 && jetzt === 'wunsch';
    return `<section id="ms-karte" class="ms-karte${kompakt ? ' kompakt' : ''}" aria-label="Aufträge"><div class="ms-kopf"><b>${fertig ? 'Aufträge abgeschlossen' : 'Deine ersten Aufträge'}</b><small>${n} von 3</small></div>
      <ol class="ms-liste">${REIHE.filter(k => !kompakt || k === jetzt).map(k => { const s = m[k] ? m[k].status : 'nein';
        return `<li class="ms-auftrag ${s === 'ja' ? 'fertig' : s === 'nein' ? 'verpasst' : k === jetzt ? 'jetzt' : ''}">${ico(s === 'ja' ? 'circle-check-filled' : s === 'nein' ? 'circle-x' : 'circle')}<span><b>${TITEL[k]}</b><small>${esc(unterText(k))}</small></span></li>`; }).join('')}</ol>
      ${fertig ? `<div class="ms-fuss"><button type="button" class="tut-knopf" data-ms="fertig">Fertig</button></div>` : ''}</section>`;
  }
  function karteZeichnen() {
    if (!hatDom) return;
    const alt = document.getElementById('ms-karte'); if (alt) alt.remove();
    const html = karteHtml(); if (!html) return;
    const kopf = document.querySelector('#app-office-kopf .ok-kacheln');
    if (kopf) kopf.insertAdjacentHTML('beforebegin', html);
    else { const v = document.getElementById('view-home'); if (v) v.insertAdjacentHTML('afterbegin', html); }
    const k = document.getElementById('ms-karte'); if (!k) return;
    const f = k.querySelector('[data-ms="fertig"]');
    if (f) f.onclick = () => { const m = zustand(); if (m) m.abschluss = true; speichern(); karteZeichnen(); if (ring) ring.style.display = 'none'; };
  }

  // ── Einhängen ────────────────────────────────────────────────────────────
  if (hatDom) {
    {
      const _orig = window.renderHomeTab;
      if (typeof _orig === 'function') {
        window.renderHomeTab = function () { const r = _orig.apply(this, arguments); try { pruefen(); karteZeichnen(); } catch (e) { console.warn('[DFL-Missionen] Karte', e); } return r; };
        try { renderHomeTab = window.renderHomeTab; } catch (e) { /* window reicht */ }
      }
    }
    // „Beste Elf“ zählt auch, wenn die Elf schon so stand
    document.addEventListener('click', ev => {
      const b = ev.target && ev.target.closest && ev.target.closest('.beste-elf');
      if (b && aktiv() && offen('elf')) { zustand().elf.klick = true; setTimeout(pruefen, 50); }
    }, true);
    setInterval(ringZeichnen, 600);
  }
  if (hatDom && document.head && document.createElement) {
    const css = document.createElement('style');
    css.id = 'dfl-missionen-css';
    css.textContent = `.ms-karte{margin:10px 12px;padding:10px 12px;border:2px solid var(--k-rand,#8b5a2b);border-radius:16px;background:var(--bg2,#fffdf9);color:var(--text,#2c3e50);box-shadow:0 3px 0 var(--k-rand,#8b5a2b)}
.ms-kopf{display:flex;justify-content:space-between;align-items:baseline;gap:8px}.ms-kopf small{color:var(--text3,#846d52)}
.ms-liste{list-style:none;margin:6px 0 0;padding:0;display:flex;flex-direction:column;gap:6px}
.ms-auftrag{display:flex;align-items:flex-start;gap:8px;padding:4px 2px}
.ms-auftrag > .ti{font-size:22px;color:var(--text3,#846d52);flex:none}
.ms-auftrag b{display:block;font-size:14px}.ms-auftrag small{display:block;font-size:12px;color:var(--text3,#846d52)}
.ms-auftrag.jetzt{background:var(--bg3,#f6ead2);border-radius:10px}
.ms-auftrag.jetzt > .ti{color:var(--k-gold,#e0a526)}
.ms-auftrag.fertig > .ti{color:var(--k-gruen,#78bc61)}
.ms-auftrag.fertig b{text-decoration:line-through;text-decoration-thickness:2px}
.ms-auftrag.verpasst{opacity:.65}
.ms-nr{flex:none;width:24px;height:24px;border-radius:50%;background:var(--k-gold,#e0a526);color:#3b2a1d;display:grid;place-items:center;font-weight:700;font-size:13px}
.ms-satz{margin:0;font-size:15px;line-height:1.45}
.ms-bild{flex:none;width:40px;height:40px;border-radius:50%;overflow:hidden;background:var(--bg3,#f6ead2);border:2px solid var(--k-rand,#8b5a2b);display:grid;place-items:center;font-weight:700}
.ms-bild svg{width:100%;height:100%;display:block}.ms-bild.gross{width:56px;height:56px}
.ms-wunsch{display:flex;gap:12px;align-items:center;padding:8px;border:2px solid var(--k-blau,#4aa3df);border-radius:14px}
.ms-wunsch b{display:block}.ms-wunsch small{display:flex;align-items:center;gap:4px;font-size:12px;color:var(--text3,#846d52)}
.ms-fuss{display:flex;justify-content:flex-end;margin-top:8px}
.ms-ring{position:fixed;z-index:9650;pointer-events:none;border-radius:14px;outline:3px solid var(--k-gold,#e0a526);box-shadow:0 0 0 6px color-mix(in oklab,var(--k-gold,#e0a526) 35%,transparent);animation:ms-puls 1.4s ease-in-out infinite}
.ms-tipp{position:absolute;left:50%;bottom:100%;transform:translate(-50%,-8px);white-space:nowrap;font-size:12px;font-weight:700;padding:3px 10px;border-radius:999px;background:var(--k-gold,#e0a526);color:#3b2a1d}
.ms-tipp.unten{bottom:auto;top:100%;transform:translate(-50%,8px)}
@keyframes ms-puls{50%{box-shadow:0 0 0 10px color-mix(in oklab,var(--k-gold,#e0a526) 10%,transparent)}}
@media (prefers-reduced-motion:reduce){.ms-ring{animation:none}}`;
    document.head.appendChild(css);
  }

  window.DFLMissionen = { aktiv, zustand, nachTour, anlegen, pruefen, istStar, istWunsch, wunschId, geschuetzt, ziel, karteHtml, TITEL };
  console.log('[DFL-Missionen v1] aktiv — Tutorial-Missionen am Spielstart: Star verlängern, Wunschspieler draften, Startelf (D159 a, ohne Winpunkte)');
})();
