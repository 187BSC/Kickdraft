/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · KADER NEU  ·  v1   (Nutzer 2026-10-18: „Training in den Kader … 95 % des Hauptspiels in den vier Reitern“,
   Vorlage C/Bild 1+2 freigegeben: „das kann rein“, „Training … wunderbar“)
   ─────────────────────────────────────────────────────────────────────────
   Gleiche Datei für beide Spiele (Quelle flutlicht_manager/js, nach kickdraft/spiel/js kopieren).
   Kader-Reiter: Aufstellung · Spieler · Training (vorher Aufstellung · Liste · Taktik · Tiefe · Verträge, Training unter „Mehr“).
   · Aufstellung: Gegner-Karte (Wappen, Platz, Form, Stärke „Du : Kürzel“), Probleme der Startelf (verletzt/gesperrt rot,
     müde gelb) mit „Tauschen“ (bester freier Spieler für den Platz), Knöpfe Formation · Stil (öffnet den Spielstil als Blatt) ·
     Beste Elf; Feld und Bank wie bisher.
   · Spieler: eine Liste mit Filtern Alle · Verträge · Verletzt und Sortierung (Stärke, Position, Alter, Vertrag); „Tiefe“ entfällt.
   · Training: die bisherige Trainingsansicht zieht in den Kader; oben eine Zeile mit der Einstellung (antippen → Blatt),
     Talente mit Balken Stärke → Potenzial, Gruppen Wächst · Am Zenit · Baut ab (2026-10-22: „Am Zenit“ statt „Am Ziel“, Nutzer). Die Regler bleiben die alten (unsichtbar),
     das Blatt tippt sie an – Sperren (Intensiv) und Kickdrafts Trainingsgruppe/Development Squad/Mentor bleiben unverändert.
   · Rote Zahl an „Kader“ (Probleme in der Elf + auslaufende Verträge) und „Front Office“/„Transfer“ (offene Angebote).
   Alte Aufrufe (switchSubview('vertraege'|'squadlist'|'depth'|'tactics'), Ansicht 'training') werden umgeleitet.
   API: KSKader.zeige(teil, filter) · .stilBlatt() · .trainingBlatt() · .tauschen(pid) · .zahlen()
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const KD = !!window.DFLSpiel && !window.KSVerein;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dn = p => (typeof displayName === 'function' ? displayName(p) : p.name);
  const kdFarben = () => { try { const f = DFLSpiel.franchise('fcm'); return f ? { farben: f.farben } : null; } catch (e) { return null; } };
  const kdTeam = id => { try { return DFLSpiel.franchise(id) || DFLSpiel.franchise(String(id).replace(/^club_/, '')); } catch (e) { return null; } };
  function gesicht(p) {
    try { return `<span class="dfl-portrait klein">${KD ? DFLIdentitaet.gesichtSvg(p, kdFarben()) : KSVerein.gesicht(p, 'fcm')}</span>`; } catch (e) { return ''; }
  }
  function wappen(id) {
    try { if (KD) { const F = kdTeam(id); return F ? DFLIdentitaet.wappenSvg(F, { klein: true }) : ''; } return KSVerein.wappen(id, { klein: true }); } catch (e) { return ''; }
  }
  function kuerzel(id, name) {
    try { if (KD) { const F = kdTeam(id) || {}; return F.kuerzel || F.kurz || F.abk || String(name || '').slice(0, 3).toUpperCase(); } return KSVerein.daten(id).kuerzel; } catch (e) { return String(name || '').slice(0, 3).toUpperCase(); }
  }
  const verletzt = p => (typeof isInjured === 'function' ? isInjured(p) : (p.injuryWeeks || 0) > 0);
  const gesperrt = p => (typeof isSuspended === 'function' ? isSuspended(p) : false);
  const ds = p => KD && !!p.perspektiv;
  const eigen = () => SQUAD.filter(p => !p.onLoanAt);
  const basis = p => (window.KSSaisonPlus ? KSSaisonPlus.basis(p) : typeof ovrBase === 'function' ? ovrBase(p) : p.ovr);
  const MUEDE = 70;   // Fitness unter 70 % = müde (Vorschlag an den Nutzer, 2026-10-18)
  function jahr(p) {
    let b = LEAGUE.startYear || 2026;
    if (KD) { try { b = DFLSpiel.liga().saisonJahr - LEAGUE.season + 1; } catch (e) { /* Standard */ } }
    return b + (p.contractUntil || 0);
  }
  const laeuftAus = p => p.contractUntil != null && p.contractUntil <= LEAGUE.season && !p.vertragFolge && !p.onLoanAt;
  function potR(p) {
    try { const sc = (CLUB.facilities && CLUB.facilities.scouting) || 1, r = potentialRange(p, sc); return { lo: r.lo, hi: r.hi }; }
    catch (e) { return { lo: p.truePotential || p.ovr, hi: p.truePotential || p.ovr }; }
  }
  const slots = () => { try { return FORMATIONS[CLUB.formation] || []; } catch (e) { return []; } };
  const elf = () => slots().map(s => ({ s, p: (CLUB.lineup && CLUB.lineup[s.id]) ? SQUAD.find(q => q.id === CLUB.lineup[s.id]) : null })).filter(x => x.p);
  const probleme = () => elf().filter(x => verletzt(x.p) || gesperrt(x.p) || (x.p.fitness != null && x.p.fitness < MUEDE));
  const plusTxt = d => d > 0 ? `<b class="ksk-plus">+${d}</b>` : d < 0 ? `<b class="ksk-minus">${d}</b>` : '';
  const geld = v => (typeof formatEuro === 'function' ? formatEuro(v) : Math.round(v) + ' €');
  function capJahr(p) { let h = 0; try { h = DFLKader.capHitJahr(p); } catch (e) { h = (p.wage || 0) * 52; } return geld(h); }

  // ── Zahlen für die roten Marken ───────────────────────────────────────────
  function angebote() { try { return buildPostfachItems().filter(i => i.cat === 'offer').length; } catch (e) { return (CLUB.transferBids || []).length; } }
  function zahlen() { const pr = probleme().length, v = eigen().filter(laeuftAus).length; return { aufstellung: pr, vertraege: v, kader: pr + v, fo: angebote() }; }
  function marken() {
    const z = zahlen();
    document.querySelectorAll('#app-nav .app-nav-btn').forEach(b => {
      const n = b.getAttribute('data-nav'), wert = n === 'kader' ? z.kader : (n === 'transfer' || n === 'fo') ? z.fo : 0;
      let m = b.querySelector('.ksk-marke');
      if (!wert) { if (m) m.remove(); return; }
      if (!m) { m = document.createElement('span'); m.className = 'ksk-marke'; b.appendChild(m); }
      if (m.textContent !== String(wert)) m.textContent = wert > 9 ? '9+' : String(wert);
    });
    document.querySelectorAll('#view-squad .ksk-tabs .subtab').forEach(b => {
      const k = b.getAttribute('data-k'), an = (k === 'aufstellung' && z.aufstellung) || (k === 'spieler' && z.vertraege);
      b.classList.toggle('ksk-punkt', !!an);
    });
  }

  // ── Reiter ───────────────────────────────────────────────────────────────
  let teil = 'aufstellung', filter = 'alle', sortierung = 'staerke';
  function reiterLeiste() {
    const t = document.querySelector('#view-squad .subtabs'); if (!t || t.classList.contains('ksk-tabs')) return t;
    t.classList.add('ksk-tabs');
    // sichtbar: drei Reiter; unsichtbar: die alten Namen, damit alte Aufrufe (unterReiter, Missionen) weiter ankommen
    t.innerHTML = `<button class="subtab active" data-k="aufstellung" onclick="KSKader.zeige('lineup')">Aufstellung</button>
      <button class="subtab" data-k="spieler" onclick="KSKader.zeige('spieler')">Spieler</button>
      <button class="subtab" data-k="training" onclick="KSKader.zeige('training')">Training</button>
      <button class="subtab ksk-alt" onclick="KSKader.zeige('spieler', 'vertraege')" tabindex="-1" aria-hidden="true">Verträge</button>
      <button class="subtab ksk-alt" onclick="KSKader.zeige('spieler', 'alle', 'squadlist')" tabindex="-1" aria-hidden="true">Liste</button>
      <button class="subtab ksk-alt" onclick="KSKader.zeige('spieler', 'alle', 'depth')" tabindex="-1" aria-hidden="true">Tiefe</button>
      <button class="subtab ksk-alt" onclick="KSKader.stilBlatt('tactics')" tabindex="-1" aria-hidden="true">Taktik</button>`;
    return t;
  }
  function eigeneAnsicht(id) {
    let v = document.getElementById(id);
    if (!v) {
      v = document.createElement('div'); v.id = id; v.className = 'subview';
      const anker = document.getElementById('sub-lineup'); anker.parentNode.insertBefore(v, anker.nextSibling);
    }
    return v;
  }
  function aktiv(k) {
    document.querySelectorAll('#view-squad .ksk-tabs .subtab').forEach(b => b.classList.toggle('active', b.getAttribute('data-k') === k));
    ['sub-lineup', 'sub-squadlist', 'sub-tactics', 'sub-depth', 'sub-vertraege', 'ksk-spieler', 'ksk-training'].forEach(id => {
      const e = document.getElementById(id); if (e && e.closest('#view-squad')) e.classList.toggle('active', (id === 'sub-lineup' && k === 'aufstellung') || (id === 'ksk-spieler' && k === 'spieler') || (id === 'ksk-training' && k === 'training'));
    });
  }
  function zeige(t, f, alt) {
    reiterLeiste();
    if (t === 'lineup' || t === 'aufstellung') {
      teil = 'aufstellung';
      if (_switch) _switch.call(window, 'lineup', document.createElement('button'));
      aktiv('aufstellung'); aufstellungZeichnen();
    } else if (t === 'spieler') {
      teil = 'spieler'; if (f) filter = f; if (alt === 'depth') sortierung = 'position';
      spielerZeichnen(); aktiv('spieler');
    } else if (t === 'training') {
      teil = 'training'; trainingZeigen(); aktiv('training');
    }
    marken();
  }

  // ── Aufstellung ──────────────────────────────────────────────────────────
  function gegner() {
    let sp = null;
    try {
      if (!KD && window.DFLAppShell && DFLAppShell.spielDieseWoche) { const s = DFLAppShell.spielDieseWoche(); if (s && s.id) sp = { id: s.id, heim: s.heim !== false, art: s.art }; }
      if (KD) {
        const po = window.DFLPlayoffs && DFLPlayoffs.faellig && DFLPlayoffs.faellig();
        const test = typeof fcmFriendlyThisWeek === 'function' && fcmFriendlyThisWeek(LEAGUE);
        const liga = typeof seasonFullyComplete === 'function' && !seasonFullyComplete(LEAGUE) && Array.isArray(LEAGUE.matchWeeks)
          && LEAGUE.matchWeeks[LEAGUE.matchday] === LEAGUE.week && fcmNextFixture(LEAGUE);
        if (po) sp = { id: po.heim === 'fcm' ? po.gast : po.heim, heim: po.heim === 'fcm', art: 'playoff' };
        else if (test) sp = { id: test.opponentId, heim: true, art: 'test' };
        else if (liga) sp = { id: liga.opponentId, heim: liga.isHome, art: 'liga' };
      }
    } catch (e) { sp = null; }
    return sp;
  }
  function gegnerHtml() {
    const sp = gegner(); let kopf = '';
    if (sp) {
      let t = null, platz = 0;
      try {
        const teams = findFcmGroup(LEAGUE).group.teams.slice().sort((a, b) => (b.pts - a.pts) || ((b.gf - b.ga) - (a.gf - a.ga)) || (b.gf - a.gf));
        t = teams.find(x => x.id === sp.id) || null; platz = t ? teams.indexOf(t) + 1 : 0;
      } catch (e) { t = null; }
      let name = t ? t.name : '';
      if (!name) { try { name = KD ? (kdTeam(sp.id) || {}).name : KSVerein.daten(sp.id).name; } catch (e) { name = ''; } }
      const form = t ? (t.form || []).slice(-5) : [];
      const e = elf(), du = e.length ? Math.round(e.reduce((s, x) => s + x.p.ovr, 0) / e.length) : 0, geg = t && t.ovr ? Math.round(t.ovr) : null;
      const art = sp.art === 'pokal' ? 'Pokal' : sp.art === 'euro' ? 'Europapokal' : sp.art === 'test' ? 'Testspiel' : sp.art === 'playoff' ? 'Playoffs' : (sp.heim ? 'Heim' : 'Auswärts');
      kopf = `<div class="ksk-gegner"><span class="ksk-gw">${wappen(sp.id)}</span>
        <span class="ksk-gn"><b>${esc(name)}</b><small>${art}${platz && sp.art === 'liga' || platz && !sp.art ? ` · ${platz}. Platz` : ''}${form.length ? ` <span class="ksk-form">${form.map(r => `<i class="f-${esc(r)}">${r === 'W' ? 'S' : r === 'L' ? 'N' : 'U'}</i>`).join('')}</span>` : ''}</small></span>
        ${geg ? `<span class="ksk-vs"><span><b>${du}</b><small>Du</small></span><i>:</i><span><b>${geg}</b><small>${esc(kuerzel(sp.id, name))}</small></span></span>` : ''}</div>`;
    }
    const pr = probleme().slice(0, 3).map(({ s, p }) => {
      const rot = verletzt(p) || gesperrt(p);
      const txt = verletzt(p) ? `verletzt${p.injuryWeeks ? ` · ${p.injuryWeeks} Wo.` : ''}` : gesperrt(p) ? 'gesperrt' : `müde · ${Math.round(p.fitness)} %`;
      return `<div class="ksk-problem${rot ? '' : ' gelb'}"><i class="ti ${verletzt(p) ? 'ti-first-aid-kit' : gesperrt(p) ? 'ti-cards' : 'ti-battery-2'}" aria-hidden="true"></i>${gesicht(p)}
        <span class="ksk-pt"><b>${esc(dn(p))}</b> ${txt}</span><button type="button" class="ksk-tausch" data-tausch="${esc(p.id)}">Tauschen</button></div>`;
    }).join('');
    if (!kopf && !pr) return '';
    return `<div class="ksk-karte ksk-gegnerkarte">${kopf}${pr}</div>`;
  }
  function stilKnopf() {
    if (!window.DFLTaktik) return '';
    const z = (DFLTaktik.eigenerStil && DFLTaktik.eigenerStil()) || CLUB.ksTaktik || {}, S = DFLTaktik.STILE || {}, s = S[z.stil];
    if (!s) return '';
    let pa = null; try { pa = DFLTaktik.passung(z.stil); } catch (e) { pa = null; }
    const pz = pa == null ? '' : `<span class="ksk-pz ${pa >= 0 ? 'gut' : 'schlecht'}">${pa > 0 ? '+' : ''}${String(Math.round(pa * 10) / 10).replace('.', ',')} %</span>`;
    return `<button type="button" class="ksk-stil" data-stilblatt="1"><span class="ksk-stil-icon" style="background:${esc(s.farbe)}"><i class="ti ${esc(s.ic)}" aria-hidden="true"></i></span>
      <span class="ksk-stil-txt"><small>STIL</small>${esc(s.kurz || s.name)}</span>${pz}</button>`;
  }
  function aufstellungZeichnen() {
    const lu = document.getElementById('sub-lineup'); if (!lu) return;
    lu.querySelectorAll(':scope > .ksk-gegnerkarte').forEach(x => x.remove());
    const g = gegnerHtml(); if (g) lu.insertAdjacentHTML('afterbegin', g);
    const fr = lu.querySelector('.formation-row');
    if (fr) {
      fr.classList.add('ksk-reihe');
      fr.querySelectorAll('.ksk-stil').forEach(x => x.remove());
      const st = stilKnopf();
      const be = fr.querySelector('.beste-elf') || [...fr.querySelectorAll('button')].find(x => /Beste Elf/.test(x.textContent));
      if (st) { if (be) be.insertAdjacentHTML('beforebegin', st); else fr.insertAdjacentHTML('beforeend', st); }
      if (be) { be.classList.add('ksk-elf'); be.setAttribute('aria-label', 'Beste Elf'); be.setAttribute('title', 'Beste Elf'); fr.appendChild(be); }
    }
    // Verletzte/Gesperrte/Müde auf dem Feld markieren
    const els = document.querySelectorAll('#pitch .p-slot');
    slots().forEach((s, i) => {
      const p = CLUB.lineup && CLUB.lineup[s.id] ? SQUAD.find(q => q.id === CLUB.lineup[s.id]) : null, el = els[i]; if (!el) return;
      el.classList.toggle('ksk-rot', !!p && (verletzt(p) || gesperrt(p)));
      el.classList.toggle('ksk-gelb', !!p && !verletzt(p) && !gesperrt(p) && p.fitness != null && p.fitness < MUEDE);
    });
  }
  // „Tauschen“: bester freier Spieler (nicht verletzt/gesperrt, nicht in der Elf) für genau diesen Platz
  function passt(p, slot) {
    const pos = p.positions && p.positions.length ? p.positions : [p.pos];
    return [slot.pos, slot.label, slot.group].filter(Boolean).some(z => pos.indexOf(z) >= 0);
  }
  function tauschen(pid) {
    const s = slots().find(x => CLUB.lineup[x.id] === pid); if (!s) return;
    const drin = new Set(Object.values(CLUB.lineup || {}));
    const frei = eigen().filter(p => !drin.has(p.id) && !verletzt(p) && !gesperrt(p) && !ds(p));
    // Stärke auf genau diesem Platz: Positionsabzug mit Seite (Kickdraft DFLPosition, Flutlicht KSPos)
    const P = window.DFLPosition || window.KSPos;
    const stark = p => (P && P.abzug ? p.ovr - P.abzug(p, s) : p.ovr * (passt(p, s) ? 1 : 0.85));
    const wert = p => stark(p) * ((p.fitness == null ? 100 : p.fitness) >= MUEDE ? 1 : 0.95);
    const best = frei.sort((a, b) => wert(b) - wert(a))[0];
    if (!best) { if (typeof showToast === 'function') showToast('Kein freier Spieler für diesen Platz.', 'warn'); return; }
    CLUB.lineup[s.id] = best.id; CLUB.selected = null;
    try { if (typeof renderPitch === 'function') renderPitch(); if (typeof renderBench === 'function') renderBench(); } catch (e) { /* neu zeichnen */ }
    if (typeof saveGameState === 'function') { try { saveGameState(); } catch (e) { /* später */ } }
    if (typeof showToast === 'function') showToast(`${dn(best)} spielt für ${dn(getPlayer(pid) || { name: '' })}.`, 'info');
    aufstellungZeichnen(); marken();
  }

  // ── Spielstil als Blatt ──────────────────────────────────────────────────
  let stilHeimat = null;
  function stilBlatt() {
    const tac = document.getElementById('sub-tactics'), blatt = document.getElementById('app-blatt'); if (!tac || !blatt) return;
    const box = blatt.querySelector('.app-blatt-box');
    if (!stilHeimat) stilHeimat = { parent: tac.parentNode, next: tac.nextSibling };
    box.innerHTML = '<div class="app-griff"></div><button class="app-blatt-zu" aria-label="Schließen"><i class="ti ti-x" aria-hidden="true"></i></button>';
    box.onclick = null; delete box.dataset.spieler;
    box.appendChild(tac); tac.classList.add('active', 'ksk-im-blatt');
    try { if (window.DFLTaktik && DFLTaktik.zeichne) DFLTaktik.zeichne(); } catch (e) { /* ohne */ }
    blatt.classList.add('auf'); document.body.classList.add('app-gesperrt');
  }
  function stilZurueck() {
    const tac = document.getElementById('sub-tactics'); if (!tac || !stilHeimat || !tac.classList.contains('ksk-im-blatt')) return;
    tac.classList.remove('active', 'ksk-im-blatt');
    stilHeimat.parent.insertBefore(tac, stilHeimat.next && stilHeimat.next.parentNode === stilHeimat.parent ? stilHeimat.next : null);
    if (teil === 'aufstellung') aufstellungZeichnen();
  }

  // ── Spieler ──────────────────────────────────────────────────────────────
  const RANG = { TW: 0, IV: 1, LV: 1, RV: 1, AV: 1, LIB: 1, ZDM: 2, DM: 2, ZM: 2, LM: 2, RM: 2, AM: 2, OM: 2, ZOM: 2, FL: 3, LF: 3, RF: 3, LA: 3, RA: 3, HS: 3, ST: 3, MS: 3 };
  const GRUPPE = ['Tor', 'Abwehr', 'Mittelfeld', 'Angriff'];
  function zeile(p, rechts) {
    const d = p.ovr - basis(p), aus = laeuftAus(p);
    const vertrag = p.vertragFolge ? 'verlängert' : aus ? 'läuft aus' : 'bis ' + jahr(p);
    return `<div class="ksk-zeile" data-pid="${esc(p.id)}">${gesicht(p)}<span class="ksk-n"><b><span class="pos-badge-sm pos-${esc(p.pos)}">${esc(p.pos)}</span> ${esc(dn(p))}${verletzt(p) ? ' <i class="ti ti-first-aid-kit ksk-rot-ic" aria-label="verletzt"></i>' : ''}${ds(p) ? ' <span class="ksk-ds">DS</span>' : ''}</b>
      <small>${p.age} J.<span class="ksk-v${aus ? ' aus' : ''}">${vertrag}</span></small></span>${rechts || `<span class="ksk-o">${basis(p)}${plusTxt(d)}</span>`}</div>`;
  }
  function spielerZeichnen() {
    const v = eigeneAnsicht('ksk-spieler');
    const alle = eigen(), aus = alle.filter(laeuftAus), vl = alle.filter(verletzt);
    const chip = (k, txt, extra) => `<button type="button" class="pos-filter-btn${filter === k ? ' active' : ''}" data-filter="${k}">${txt}${extra || ''}</button>`;
    const SORT = { staerke: 'Stärke', position: 'Position', alter: 'Alter', vertrag: 'Vertrag' };
    let h = `<div class="ksk-chips">${chip('alle', 'Alle ' + alle.length)}${chip('vertraege', 'Verträge', aus.length ? `<em>${aus.length}</em>` : '')}${chip('verletzt', 'Verletzt ' + vl.length)}
      <button type="button" class="ksk-sort" data-sort="1"><i class="ti ti-arrows-sort" aria-hidden="true"></i>${SORT[sortierung]}</button></div>`;
    const sortiert = l => l.slice().sort((a, b) => sortierung === 'position' ? ((RANG[a.pos] ?? 2) - (RANG[b.pos] ?? 2)) || (b.ovr - a.ovr)
      : sortierung === 'alter' ? a.age - b.age || b.ovr - a.ovr : sortierung === 'vertrag' ? (a.contractUntil || 0) - (b.contractUntil || 0) || b.ovr - a.ovr : b.ovr - a.ovr);
    if (filter === 'vertraege') {
      const knopf = p => KD && window.DFLSaisonwechsel && DFLSaisonwechsel.vertragBlatt
        ? `<button type="button" class="ksk-verl" onclick="DFLSaisonwechsel.vertragBlatt('${esc(p.id)}')">Verlängern</button>`
        : `<button type="button" class="ksk-verl" onclick="renewContract('${esc(p.id)}')">Verlängern</button>`;
      if (aus.length) h += `<div class="ksk-ab"><span>Läuft aus</span><span>${aus.length}</span></div>` + sortiert(aus).map(p => zeile(p, knopf(p))).join('');
      h += `<div class="ksk-ab"><span>Weitere</span><span>${KD ? 'Cap' : 'Gehalt'}</span></div>`
        + alle.filter(p => !laeuftAus(p)).sort((a, b) => (a.contractUntil || 0) - (b.contractUntil || 0) || b.ovr - a.ovr)
          .map(p => zeile(p, `<span class="ksk-geld">${KD ? capJahr(p) : geld(p.wage || 0)} <small>/ ${KD ? 'Jahr' : 'Woche'}</small></span>`)).join('');
    } else {
      const liste = sortiert(filter === 'verletzt' ? vl : alle);
      if (!liste.length) h += `<p class="ksk-leer">${filter === 'verletzt' ? 'Niemand verletzt.' : 'Keine Spieler.'}</p>`;
      if (sortierung === 'position') { let g = -1; liste.forEach(p => { const gi = RANG[p.pos] ?? 2; if (gi !== g) { g = gi; h += `<div class="ksk-ab"><span>${GRUPPE[gi]}</span></div>`; } h += zeile(p); }); }
      else h += liste.map(p => zeile(p)).join('');
    }
    v.innerHTML = h;
  }

  // ── Training ─────────────────────────────────────────────────────────────
  function trainingWrap() { return document.querySelector('#ksk-training .training-wrap') || document.querySelector('#view-training .training-wrap'); }
  function trainingZeigen() {
    const v = eigeneAnsicht('ksk-training'), w = trainingWrap();
    if (w && w.parentNode !== v) v.appendChild(w);
    try { if (window.TrainingSystem && TrainingSystem.renderTrainingTab) TrainingSystem.renderTrainingTab(); else trainingKopf(); } catch (e) { console.warn('[KS-Kader] Training', e); }
    if (!document.querySelector('#training-content > .ksk-tr-neu')) trainingKopf();
  }
  const I_NAME = { leicht: 'Leicht', normal: 'Normal', intensiv: 'Intensiv' }, F_NAME = { ausgewogen: 'Ausgewogen', defensiv: 'Defensive', offensiv: 'Offensive', defensive: 'Defensive', offensive: 'Offensive', fitness: 'Fitness' };
  const fokusKey = f => String(f || 'ausgewogen').replace(/e$/, '').replace(/^ausgewog$/, 'ausgewogen');
  function alteRegler() {
    const c = document.getElementById('training-content'); if (!c) return { int: [], fok: [] };
    const knoepfe = [...c.querySelectorAll('button')];
    const int = ['Leicht', 'Normal', 'Intensiv'].map(n => knoepfe.find(b => b.textContent.indexOf(n) >= 0 && !b.closest('.ksk-tr-neu'))).filter(Boolean);
    const fok = ['Ausgewogen', 'Defensive', 'Offensive', 'Fitness'].map(n => knoepfe.find(b => b.textContent.trim() === n && !b.closest('.ksk-tr-neu') && !b.closest('.ktr-gruppe, .tg-zeile, [class*="trainingsgruppe"]'))).filter(Boolean);
    return { int, fok };
  }
  function trainingKopf() {
    const c = document.getElementById('training-content'); if (!c) return;
    // alte Steuerung und alte Entwicklungsliste ausblenden (bleiben für das Blatt im DOM)
    const k = c.firstElementChild;
    if (k && !k.classList.contains('ksk-tr-neu')) {
      if (KD) c.querySelectorAll('.ktr-steuerung, .ktr-liste').forEach(x => x.classList.add('ksk-weg'));
      else [...c.children].slice(0, 2).forEach(x => x.classList.add('ksk-weg'));
    }
    c.querySelectorAll(':scope > .ksk-tr-neu').forEach(x => x.remove());
    const T = CLUB.training || {}, gel = (CLUB.facilities || {}).training || 1;
    const alle = eigen(), d = p => p.ovr - basis(p);
    const summe = alle.reduce((s, p) => s + Math.max(0, d(p)), 0);
    const tal = alle.filter(p => p.age <= 21).sort((a, b) => potR(b).hi - potR(a).hi).slice(0, 5);
    const zeileT = p => {
      const r = potR(p), lo = Math.max(r.lo, p.ovr);
      return `<div class="ksk-zeile ksk-tal" data-pid="${esc(p.id)}">${gesicht(p)}<span class="ksk-n"><b><span class="pos-badge-sm pos-${esc(p.pos)}">${esc(p.pos)}</span> ${esc(dn(p))} <small>${p.age} J. · ${p.ovr} → ${r.lo === r.hi ? r.lo : r.lo + '–' + r.hi}</small><span class="ksk-tal-d">${plusTxt(d(p)) || '<small>±0</small>'}</span></b>
        <span class="ksk-pb"><s style="left:${lo}%;width:${Math.max(1, r.hi - lo)}%"></s><i style="width:${p.ovr}%"></i></span></span></div>`;
    };
    const waechst = alle.filter(p => d(p) > 0 || (p.age <= 24 && potR(p).hi - p.ovr >= 3)), baut = alle.filter(p => !waechst.includes(p) && (d(p) < 0 || p.age >= 31));
    const ziel = alle.filter(p => !waechst.includes(p) && !baut.includes(p));
    const gruppe = (ic, kl, txt, l) => l.length ? `<details class="ksk-gruppe"><summary><span class="${kl}"><i class="ti ${ic}" aria-hidden="true"></i> ${txt}</span>
      <span class="ksk-gesichter">${l.slice(0, 4).map(gesicht).join('')}</span><small>${l.length}</small></summary>
      ${l.slice().sort((a, b) => d(b) - d(a) || b.ovr - a.ovr).map(p => zeile(p)).join('')}</details>` : '';
    c.insertAdjacentHTML('afterbegin', `<div class="ksk-tr-neu">
      <button type="button" class="ksk-karte ksk-einst" data-trblatt="1"><i class="ti ti-barbell" aria-hidden="true"></i>
        <span><b>${I_NAME[T.intensity] || 'Normal'} · ${F_NAME[T.focus] || 'Ausgewogen'}</b><small>Gelände Stufe ${gel}</small></span>
        <span class="ksk-woche">+${summe}<small>seit Saisonstart</small></span><i class="ti ti-chevron-right ksk-pfeil" aria-hidden="true"></i></button>
      ${tal.length ? `<div class="ksk-ab"><span>Talente</span><span>Stärke → Potenzial</span></div>${tal.map(zeileT).join('')}` : ''}
      <div class="ksk-ab"><span>Ganzer Kader</span></div>
      ${gruppe('ti-trending-up', 'ksk-gruen', 'Wächst', waechst)}${gruppe('ti-mountain', '', 'Am Zenit', ziel)}${gruppe('ti-trending-down', 'ksk-rotx', 'Baut ab', baut)}
    </div>`);
  }
  function trainingBlatt() {
    const blatt = document.getElementById('app-blatt'); if (!blatt) return;
    const box = blatt.querySelector('.app-blatt-box');
    const malen = () => {
      const T = CLUB.training || {}, r = alteRegler();
      const zu = b => !b || b.disabled || /🔒|gesperrt/.test(b.textContent) || b.classList.contains('zu');
      const F = { leicht: '×0,57 · Fitness +5', normal: '×1,00 · Fitness ±0', intensiv: '×1,57 · Fitness −5' };   // Fitness je Woche (fitness_patch.js)
      box.innerHTML = `<div class="app-griff"></div><button class="app-blatt-zu" aria-label="Schließen"><i class="ti ti-x" aria-hidden="true"></i></button>
        <div class="ksk-bt"><i class="ti ti-barbell" aria-hidden="true"></i>Training</div>
        <h4 class="ksk-h4">Intensität</h4>
        <div class="ksk-seg">${['leicht', 'normal', 'intensiv'].map((k, i) => `<button type="button" data-int="${i}" class="${(T.intensity || 'normal') === k ? 'an' : ''}${zu(r.int[i]) && (T.intensity || 'normal') !== k ? ' zu' : ''}">${zu(r.int[i]) && (T.intensity || 'normal') !== k ? '<i class="ti ti-lock" aria-hidden="true"></i> ' : ''}${I_NAME[k]}<small>${F[k]}</small></button>`).join('')}</div>
        <h4 class="ksk-h4">Schwerpunkt</h4>
        <div class="ksk-raster">${[['ausgewogen', 'ti-scale'], ['defensiv', 'ti-shield'], ['offensiv', 'ti-target'], ['fitness', 'ti-run']].map(([k, ic], i) => `<button type="button" data-fok="${i}" class="${fokusKey(T.focus) === k ? 'an' : ''}"><i class="ti ${ic}" aria-hidden="true"></i>${F_NAME[k]}</button>`).join('')}</div>
        <button type="button" class="app-knopf ksk-fertig app-blatt-zu-knopf">Fertig</button>`;
    };
    box.onclick = ev => {
      const b = ev.target.closest('button'); if (!b) return;
      if (b.classList.contains('app-blatt-zu-knopf')) { blatt.classList.remove('auf'); document.body.classList.remove('app-gesperrt'); return; }
      const r = alteRegler();
      if (b.dataset.int != null && r.int[+b.dataset.int]) r.int[+b.dataset.int].click();
      else if (b.dataset.fok != null && r.fok[+b.dataset.fok]) r.fok[+b.dataset.fok].click();
      else return;
      setTimeout(() => { trainingKopf(); malen(); }, 30);
    };
    delete box.dataset.spieler;
    malen();
    blatt.classList.add('auf'); document.body.classList.add('app-gesperrt');
  }

  // ── Klicks in den neuen Ansichten ────────────────────────────────────────
  document.addEventListener('click', ev => {
    const t = ev.target;
    if (!t.closest || !t.closest('#view-squad, #app-blatt')) return;
    const tausch = t.closest('[data-tausch]'); if (tausch) { tauschen(tausch.getAttribute('data-tausch')); return; }
    if (t.closest('[data-stilblatt]')) { stilBlatt(); return; }
    if (t.closest('[data-trblatt]')) { trainingBlatt(); return; }
    const f = t.closest('#ksk-spieler [data-filter]'); if (f) { filter = f.getAttribute('data-filter'); spielerZeichnen(); return; }
    if (t.closest('#ksk-spieler [data-sort]')) { const o = ['staerke', 'position', 'alter', 'vertrag']; sortierung = o[(o.indexOf(sortierung) + 1) % o.length]; spielerZeichnen(); return; }
    if (t.closest('button, summary, a')) return;
    const z = t.closest('#ksk-spieler .ksk-zeile, #ksk-training .ksk-zeile');
    if (z && window.DFLAppShell && DFLAppShell.spielerBlatt) { const p = typeof getPlayer === 'function' ? getPlayer(z.getAttribute('data-pid')) : null; if (p) DFLAppShell.spielerBlatt(p); }
  });
  // Blatt zu → Spielstil zurück an seinen Platz
  const blattBeob = () => {
    const b = document.getElementById('app-blatt'); if (!b) { setTimeout(blattBeob, 500); return; }
    let offen = b.classList.contains('auf');
    new MutationObserver(() => { const jetzt = b.classList.contains('auf'); if (offen && !jetzt) { stilZurueck(); if (teil === 'training' && document.getElementById('ksk-training')) trainingKopf(); } offen = jetzt; }).observe(b, { attributes: true, attributeFilter: ['class'] });
  };
  blattBeob();

  // ── Alte Wege umleiten ───────────────────────────────────────────────────
  const _switch = window.switchSubview;
  if (typeof _switch === 'function') {
    window.switchSubview = function (name, btn) {
      if (name === 'vertraege') return zeige('spieler', 'vertraege');
      if (name === 'squadlist') return zeige('spieler', 'alle');
      if (name === 'depth') return zeige('spieler', 'alle', 'depth');
      if (name === 'tactics') return stilBlatt();
      const r = _switch.apply(this, arguments);
      if (name === 'lineup') { aktiv('aufstellung'); teil = 'aufstellung'; aufstellungZeichnen(); }
      return r;
    };
    try { switchSubview = window.switchSubview; } catch (e) { /* window reicht */ }
  }
  const _view = window.switchAppView;
  if (typeof _view === 'function') {
    window.switchAppView = function (view, btn) {
      if (view === 'training') { const r = _view.call(this, 'squad', document.getElementById('nav-squad') || document.createElement('button')); zeige('training'); window.scrollTo(0, 0); return r; }
      const r = _view.apply(this, arguments);
      if (view === 'squad') { reiterLeiste(); setTimeout(() => zeige(teil === 'training' ? 'training' : teil === 'spieler' ? 'spieler' : 'lineup'), 0); }
      return r;
    };
    try { switchAppView = window.switchAppView; } catch (e) { /* window reicht */ }
  }
  // Training neu gezeichnet (Regler, Wochentakt) → neue Kopfzeile wieder davor
  if (window.TrainingSystem && typeof TrainingSystem.renderTrainingTab === 'function') {
    const _tr = TrainingSystem.renderTrainingTab;
    TrainingSystem.renderTrainingTab = function () { const r = _tr.apply(this, arguments); try { if (document.getElementById('ksk-training') && document.querySelector('#ksk-training #training-content')) trainingKopf(); } catch (e) { /* optional */ } return r; };
  }
  // Feld neu gezeichnet → Gegner-Karte und Markierungen nachziehen
  ['renderPitch', 'renderBench'].forEach(n => {
    const _o = window[n]; if (typeof _o !== 'function') return;
    window[n] = function () { const r = _o.apply(this, arguments); try { if (teil === 'aufstellung' && document.getElementById('sub-lineup') && document.getElementById('sub-lineup').classList.contains('active')) aufstellungZeichnen(); } catch (e) { /* optional */ } return r; };
    try { if (n === 'renderPitch') renderPitch = window[n]; else renderBench = window[n]; } catch (e) { /* window reicht */ }
  });
  setInterval(() => { try { if (typeof LEAGUE !== 'undefined' && LEAGUE && typeof SQUAD !== 'undefined') marken(); } catch (e) { /* später */ } }, 1500);

  const st = document.createElement('style');
  st.textContent = `
  #view-squad .ksk-tabs{display:flex!important;flex-wrap:nowrap!important}#view-squad .ksk-tabs .subtab{flex:1 1 0!important;max-width:none!important;position:relative;justify-content:center;text-align:center}
  #view-squad .ksk-tabs .subtab.ksk-alt{display:none!important}
  #view-squad .ksk-tabs .subtab.ksk-punkt::after{content:'';position:absolute;top:6px;right:8px;width:8px;height:8px;border-radius:50%;background:#d0503f}
  #app-nav .app-nav-btn{position:relative}
  .ksk-marke{position:absolute;top:3px;left:calc(50% + 6px);min-width:18px;height:18px;border-radius:9px;background:#d0503f;color:#fff;font:800 11px/18px var(--font-text,system-ui);text-align:center;padding:0 4px;border:2px solid var(--bg2,#fff);pointer-events:none}
  .ksk-karte{display:block;width:100%;text-align:left;background:var(--bg2);color:var(--text);border:var(--k-rahmen,3px solid #8b5a2b);border-radius:16px;box-shadow:0 4px 0 var(--k-rand,#8b5a2b);padding:10px 12px;margin:0 0 12px;font:inherit;box-sizing:border-box;max-width:100%;overflow:hidden}
  #sub-lineup.subview{grid-template-columns:minmax(0,1fr)}
  .ksk-gegner{display:flex;align-items:center;gap:10px;min-width:0}
  .ksk-gw{width:38px;height:42px;flex:none}.ksk-gw svg{width:100%;height:100%;display:block}
  .ksk-gn{min-width:0;flex:1}.ksk-gn b{display:block;font:800 16px/1.15 var(--font-titel,var(--font-text));white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ksk-gn small{color:var(--text3);font-size:12px;font-weight:700}
  .ksk-form{display:inline-flex;gap:2px;vertical-align:1px}.ksk-form i{font-style:normal;width:15px;height:15px;border-radius:4px;display:inline-grid;place-items:center;font-size:9.5px;color:#fff;font-weight:800;background:#c9a227}
  .ksk-form .f-W{background:#3fae5a}.ksk-form .f-L{background:#d0503f}
  .ksk-vs{margin-left:auto;display:flex;align-items:flex-start;gap:5px;text-align:center;flex:none}.ksk-vs b{display:block;font:800 21px/1 var(--font-zahl,var(--font-text))}
  .ksk-vs i{font-style:normal;font-weight:800;font-size:18px;color:var(--text3)}.ksk-vs small{display:block;font-size:10.5px;color:var(--text3);font-weight:800;margin-top:3px}
  .ksk-problem{display:flex;align-items:center;gap:8px;margin-top:8px;padding:6px 8px;border-radius:12px;background:#fde4de;border:2px solid #eba597;font-size:13px;color:#5b2a20;min-width:0}
  .ksk-problem>.ti{font-size:18px;color:#c0392b;flex:none}.ksk-problem.gelb{background:#fdf1cf;border-color:#e3c56f;color:#5a4610}.ksk-problem.gelb>.ti{color:#b7860b}
  .ksk-problem .dfl-portrait.klein{width:26px;height:30px;flex:none}
  .ksk-pt{min-width:0;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600}
  .ksk-tausch{margin-left:auto;flex:none;background:var(--k-blau-knopf,#2c7cb5);color:#fff;border:0;border-radius:10px;padding:6px 11px;font:800 12.5px var(--font-text,system-ui);box-shadow:0 3px 0 var(--k-blau-schatten,#1d5a86);cursor:pointer}
  #sub-lineup .formation-row.ksk-reihe{display:flex;gap:8px;flex-wrap:nowrap;align-items:stretch}
  #sub-lineup .ksk-reihe > *{min-width:0}
  #sub-lineup .ksk-reihe .auswahl-formation{flex:0 0 112px!important;width:112px!important;max-width:112px!important;padding-left:8px!important;padding-right:8px!important;gap:6px!important}
  #sub-lineup .ksk-reihe .auswahl-formation .ti-chevron-down{display:none!important}
  .ksk-stil{flex:1 1 auto;display:flex;align-items:center;gap:6px;min-height:50px;padding:5px 9px;border-radius:14px;background:var(--bg2);border:var(--k-rahmen,3px solid #8b5a2b);box-shadow:0 4px 0 var(--k-rand,#8b5a2b);font:800 14px var(--font-text,system-ui);color:var(--text);cursor:pointer;white-space:nowrap;overflow:hidden}
  .ksk-stil-icon{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;flex:none}.ksk-stil-icon .ti{color:#fff;font-size:18px}
  .ksk-stil-txt{min-width:0;overflow:hidden;text-overflow:ellipsis;text-align:left}.ksk-stil-txt small{display:block;font-size:9.5px;letter-spacing:.08em;color:var(--text3)}
  .ksk-pz{margin-left:auto;font-size:14px}.ksk-pz.gut{color:#2f8a3d}.ksk-pz.schlecht{color:#c0392b}
  #sub-lineup .ksk-reihe .ksk-elf{flex:0 0 46px!important;width:46px;padding:0!important;justify-content:center;font-size:0!important}
  #sub-lineup .ksk-reihe .ksk-elf .ti{font-size:22px}
  #pitch .p-slot.ksk-rot{filter:drop-shadow(0 0 4px #e74c3c) drop-shadow(0 0 2px #e74c3c)}
  #pitch .p-slot.ksk-gelb{filter:drop-shadow(0 0 4px #f1c40f)}
  .ksk-chips{display:flex;gap:6px;flex-wrap:nowrap;margin:2px 0 8px;align-items:center}
  .ksk-chips .pos-filter-btn{padding:6px 12px;font-size:13px;white-space:nowrap}
  .ksk-chips em{font-style:normal;background:#d0503f;color:#fff;border-radius:8px;padding:0 5px;margin-left:4px;font-size:11px}
  .ksk-sort{margin-left:auto;border:0;background:none;font:800 12px var(--font-text,system-ui);color:var(--text3);display:flex;align-items:center;gap:3px;white-space:nowrap;cursor:pointer;padding:6px 2px}
  .ksk-zeile{display:grid;grid-template-columns:auto 1fr auto;gap:9px;align-items:center;padding:7px 10px;margin-bottom:6px;border-radius:14px;background:var(--bg2);border:2px solid var(--k-linie,#d9c29a);cursor:pointer}
  .ksk-zeile .dfl-portrait.klein{width:34px;height:40px}
  .ksk-n{min-width:0}.ksk-n b{font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block}
  .ksk-n small{font-size:11.5px;color:var(--text3);font-weight:700}
  .ksk-v{display:inline-block;font-size:10.5px;font-weight:800;border-radius:7px;padding:1px 6px;background:var(--bg3,#efe2c8);color:var(--text3);margin-left:5px}
  .ksk-v.aus{background:#fde4de;color:#c0392b}.ksk-rot-ic{color:#c0392b}
  .ksk-ds{font-size:10px;font-weight:800;padding:0 5px;border-radius:6px;background:#efe3fb;color:#6b3fa0;vertical-align:2px}
  .ksk-o{text-align:right;font:800 21px/1 var(--font-zahl,var(--font-text))}
  .ksk-plus{color:#2f8a3d;font-size:12px;margin-left:3px}.ksk-minus{color:#c0392b;font-size:12px;margin-left:3px}
  .ksk-geld{font:800 15px var(--font-zahl,var(--font-text));white-space:nowrap}.ksk-geld small{font-size:12px;color:var(--text3)}
  .ksk-verl{border:0;border-radius:10px;padding:7px 11px;background:var(--k-blau-knopf,#2c7cb5);color:#fff;font:800 12.5px var(--font-text,system-ui);box-shadow:0 3px 0 var(--k-blau-schatten,#1d5a86);cursor:pointer}
  .ksk-ab{display:flex;justify-content:space-between;align-items:center;font-weight:800;font-size:11.5px;letter-spacing:.08em;color:var(--text3);margin:12px 4px 6px;text-transform:uppercase}
  .ksk-leer{color:var(--text3);font-weight:700;padding:10px 4px}
  #training-content .ksk-weg{display:none!important}
  .ksk-einst{display:flex;align-items:center;gap:10px;cursor:pointer}.ksk-einst>.ti-barbell{font-size:24px;color:var(--k-blau-knopf,#2c7cb5)}
  .ksk-einst>span:nth-of-type(1){min-width:0;flex:1}.ksk-einst b{font-size:15.5px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ksk-einst small{font-size:12px;color:var(--text3);font-weight:700}
  .ksk-woche{margin-left:auto;text-align:right;white-space:nowrap;flex:none;color:#2f8a3d;font:800 18px var(--font-zahl,var(--font-text))}.ksk-woche small{display:block;font-size:10.5px}
  .ksk-pfeil{color:var(--text3);font-size:20px}
  .ksk-tal{grid-template-columns:auto 1fr}.ksk-tal-d{float:right}
  .ksk-pb{position:relative;display:block;height:9px;border-radius:5px;background:var(--bg3,#efe2c8);margin-top:5px;overflow:hidden}
  .ksk-pb i{position:absolute;left:0;top:0;bottom:0;border-radius:5px;background:var(--app-gut,#3fae5a)}
  .ksk-pb s{position:absolute;top:0;bottom:0;background:repeating-linear-gradient(45deg,#9fd08d 0 4px,#d3ebc9 4px 8px)}
  .ksk-gruppe{margin-bottom:6px;border-radius:14px;background:var(--bg2);border:2px solid var(--k-linie,#d9c29a);padding:0 10px}
  .ksk-gruppe>summary{display:flex;align-items:center;gap:8px;padding:10px 2px;font-weight:800;font-size:14.5px;list-style:none;cursor:pointer}
  .ksk-gruppe>summary::-webkit-details-marker{display:none}
  .ksk-gruppe>summary small{color:var(--text3);font-weight:800}
  .ksk-gruppe>summary::after{content:'';width:8px;height:8px;border:solid currentColor;border-width:0 2px 2px 0;transform:rotate(45deg);opacity:.5;margin-left:4px}
  .ksk-gruppe[open]>summary::after{transform:rotate(-135deg)}.ksk-gruppe[open]{padding-bottom:6px}
  .ksk-gruppe .ksk-zeile{background:var(--bg3,#f7ecd6)}
  .ksk-gesichter{display:flex;margin-left:auto;margin-right:2px}.ksk-gesichter .dfl-portrait.klein{width:24px;height:28px;margin-left:-6px;border:2px solid var(--bg2)}
  .ksk-gruen{color:#2f8a3d}.ksk-rotx{color:#c0392b}
  .ksk-bt{display:flex;align-items:center;gap:8px;font:800 19px var(--font-titel,var(--font-text));margin:4px 0 2px}.ksk-bt .ti{color:var(--k-blau-knopf,#2c7cb5)}
  .ksk-h4{margin:14px 2px 7px;font-size:12px;letter-spacing:.08em;color:var(--text3);text-transform:uppercase;font-weight:800}
  .ksk-seg{display:flex;border:var(--k-rahmen,3px solid #8b5a2b);border-radius:14px;overflow:hidden}
  .ksk-seg button{flex:1;border:0;border-right:2px solid var(--k-linie,#d9c29a);background:none;color:var(--text);text-align:center;padding:10px 0;font:800 14px var(--font-text,system-ui);cursor:pointer}.ksk-seg button:last-child{border-right:0}
  .ksk-seg button small{display:block;font-size:11px;font-weight:700;opacity:.75}
  .ksk-seg button.an{background:var(--k-blau-knopf,#2c7cb5);color:#fff}.ksk-seg button.zu{opacity:.45}
  .ksk-raster{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .ksk-raster button{border:var(--k-rahmen,3px solid #8b5a2b);border-radius:14px;padding:10px;text-align:center;font:800 14px var(--font-text,system-ui);box-shadow:0 3px 0 var(--k-rand,#8b5a2b);background:var(--bg2);color:var(--text);cursor:pointer}
  .ksk-raster button .ti{display:block;font-size:22px;margin-bottom:2px;color:var(--k-blau-knopf,#2c7cb5)}
  .ksk-raster button.an{background:var(--k-blau-knopf,#2c7cb5);color:#fff;box-shadow:0 3px 0 var(--k-blau-schatten,#1d5a86)}.ksk-raster button.an .ti{color:#fff}
  .ksk-fertig{margin-top:16px;width:100%;background:var(--k-blau-knopf,#2c7cb5)!important;color:#fff!important;border:0!important;box-shadow:0 4px 0 var(--k-blau-schatten,#1d5a86)!important}
  #app-blatt #sub-tactics.ksk-im-blatt{display:block;padding:0}
  `;
  document.head.appendChild(st);
  window.KSKader = { zeige, stilBlatt, trainingBlatt, tauschen, zahlen, marken };
  console.log('[KS-Kader v1] aktiv — Kader: Aufstellung · Spieler · Training, Gegner-Karte, Tauschen, Spielstil als Blatt, rote Marken');
})();
