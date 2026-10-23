/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · TRANSFERSUCHE  ·  v1   (Nutzer 2026-10-18: „Suche wie beim Schuhkauf (ASOS) … wer was sucht, soll präzise
   filtern können (Ebene 2), sonst scrollt er von gut zu schwach (Ebene 1)“ – Vorlage Bild 5 freigegeben, mit LV/RV, LM/RM, LF/RF)
   ─────────────────────────────────────────────────────────────────────────
   Nur Flutlicht. Ersetzt die Marktliste (Front Office → Transfer → Suchen):
   · Ebene 1: Kopf (Budget, Fenster), Suchleiste, Schnellwahl (Für deine Elf · Talente · Bezahlbar · Ablösefrei · Merkliste),
     eine Liste von stark nach schwach – Markt und Ablösefreie in einem Katalog. Je Zeile Gesicht, Verein, Alter, Stärke,
     Potenzial (Schätzung wie bisher), Preis (grün = bezahlbar) und „Elf +x auf Position“.
   · Ebene 2: Suchblatt mit Positionen auf dem Mini-Feld (Seiten einzeln; Flutlichts AV/AM/FL zählen für beide Seiten),
     Alter und Preis als Regler mit zwei Griffen, Potenzial-Stufen, Sortierung; Knopf „N Spieler anzeigen“ zählt live.
   · Antippen → Spieler-Blatt mit Kaufen · Leihen · Merken (bzw. Verpflichten bei Ablösefreien).
   Die alte Liste bleibt im Code (renderMarketList), wird nur überzeichnet; Reiter „Ablösefrei“ ist jetzt die Schnellwahl.
   API: KSTransfersuche.zeichne() · .blatt() · .F (Filter)
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dn = p => (typeof displayName === 'function' ? displayName(p) : p.name);
  const gesicht = p => { try { return `<span class="dfl-portrait klein">${KSVerein.gesicht(p)}</span>`; } catch (e) { return ''; } };
  const wappen = id => { if (!id) return ''; try { return KSVerein.wappen('club_' + id, { klein: true }) || KSVerein.wappen(id, { klein: true }) || ''; } catch (e) { return ''; } };
  const geld = v => (typeof formatEuro === 'function' ? formatEuro(v) : Math.round(v) + ' €');
  const scout = () => (CLUB.facilities && CLUB.facilities.scouting) || 1;
  const offen = () => (typeof isTransferWindowOpen === 'function' ? isTransferWindowOpen() : true);
  // Stärke/Potenzial wie bisher geschätzt („56-66 (62-65)“), mit Scout-Bericht genau
  function sicht(p) {
    try { const s = window.KSScouting ? KSScouting.sicht(p) : null; if (s && s.bericht) return { o: [s.ovr, s.ovr], p: s.pot ? [s.pot.lo, s.pot.hi] : [p.truePotential, p.truePotential] }; } catch (e) { /* Schätzung */ }
    const m = /(\d+)-(\d+)\s*\((\d+)-(\d+)\)/.exec(typeof potentialDisplay === 'function' ? potentialDisplay(p, scout()) : '');
    if (m) return { o: [+m[1], +m[2]], p: [+m[3], +m[4]] };
    let pr = null; try { pr = potentialRange(p, scout()); } catch (e) { pr = null; }
    return { o: [p.ovr, p.ovr], p: pr ? [pr.lo, pr.hi] : [p.truePotential || p.ovr, p.truePotential || p.ovr] };
  }
  const mitte = r => Math.round((r[0] + r[1]) / 2);
  const span = r => r[0] === r[1] ? `${r[0]}` : `${r[0]}–${r[1]}`;
  // Positionen: Suchfeld mit Seiten (Kartei seit 2026-10-18 mit Seiten); Altbestand AV/AM/FL ohne Seite zählt für links und rechts
  const ZU = { LV: ['LV', 'AV'], RV: ['RV', 'AV'], LM: ['LM', 'AM'], RM: ['RM', 'AM'], LF: ['LF', 'FL', 'LA'], RF: ['RF', 'FL', 'RA'], ST: ['ST', 'MS'], ZOM: ['ZOM', 'OM'], ZM: ['ZM'], ZDM: ['ZDM', 'DM'], IV: ['IV'], TW: ['TW'] };
  const posVon = p => (p.positions && p.positions.length ? p.positions : [p.pos]);
  const passtPos = (p, wahl) => !wahl.length || wahl.some(k => (ZU[k] || [k]).some(z => posVon(p).indexOf(z) >= 0));
  // Wen würde er in der Elf ersetzen? Schwächster Stammspieler auf seiner Position
  const GRUPPE = { TW: 'TW', IV: 'IV', AV: 'AV', LV: 'AV', RV: 'AV', ZDM: 'ZDM', DM: 'ZDM', ZM: 'ZM', AM: 'AM', LM: 'AM', RM: 'AM', OM: 'OM', ZOM: 'OM', FL: 'FL', LF: 'FL', RF: 'FL', ST: 'ST', MS: 'ST' };
  let elfCache = null, elfZeit = 0;
  function elfJe() {
    if (elfCache && Date.now() - elfZeit < 1500) return elfCache;
    const m = {};
    // Mit Seite (kickstil_positionen.js): je Platz (LV, RF …) die wirksame Stärke des Stammspielers dort
    const P = window.KSPos;
    try { FORMATIONS[CLUB.formation].forEach(s => { const p = SQUAD.find(q => q.id === CLUB.lineup[s.id]); if (!p) return;
      const g = P ? P.platz(s) : GRUPPE[s.label] || GRUPPE[p.pos] || p.pos, o = P ? P.wirksam(p, g) : p.ovr;
      if (m[g] == null || o < m[g].o) m[g] = { o, l: P ? g : s.label }; }); } catch (e) { /* ohne Elf */ }
    elfCache = m; elfZeit = Date.now(); return m;
  }
  function plus(p) {
    const e = elfJe(), P = window.KSPos;
    if (P) {
      // bester Platz der Elf, auf dem er (Stärke − Abzug, gelernte Positionen) den Stammspieler übertrifft
      let best = null;
      Object.keys(e).forEach(k => { const a = P.abzug(p, k); if (a > CFG_GELERNT) return; const d = mitte(sicht(p).o) - a - e[k].o; if (d >= 1 && (!best || d > best.d)) best = { d, l: e[k].l }; });
      return best;
    }
    const g = GRUPPE[p.pos] || p.pos; if (!e[g]) return null; const d = mitte(sicht(p).o) - e[g].o; return d >= 1 ? { d, l: e[g].l } : null;
  }
  const CFG_GELERNT = 2;

  // ── Katalog: Markt + Ablösefreie ──────────────────────────────────────────
  function frei() { try { if (window.FreeAgents && FreeAgents.pool) return FreeAgents.pool() || []; } catch (e) { /* ohne */ } return (CLUB && CLUB.freeAgents) || []; }
  function katalog() {
    const m = ((typeof MARKET !== 'undefined' && MARKET && MARKET.players) || []).map(p => ({ p, frei: false, preis: p.value || 0 }));
    const f = frei().filter(p => p && (p.freeAgent !== false)).map(p => ({ p, frei: true, preis: 0 }));
    return m.concat(f);
  }
  const preisMax = () => Math.max(1e5, ...katalog().map(x => x.preis));
  const F = { pos: [], alter: [16, 40], pot: 0, preis: [0, null], sort: 'staerke', schnell: '', mehr: 30 };
  const preisBis = () => F.preis[1] == null ? preisMax() : F.preis[1];
  function liste(ohneSchnell) {
    const mx = preisBis(), merk = new Set((CLUB.watchlist || []).map(w => w.id));
    return katalog().filter(x => {
      const p = x.p, s = sicht(p);
      if (!passtPos(p, F.pos)) return false;
      if (p.age < F.alter[0] || p.age > F.alter[1]) return false;
      if (F.pot && s.p[1] < F.pot) return false;
      if (x.preis < F.preis[0] || x.preis > mx) return false;
      if (ohneSchnell) return true;
      if (F.schnell === 'elf' && !plus(p)) return false;
      if (F.schnell === 'talente' && !(p.age <= 21 && s.p[1] >= 70)) return false;
      if (F.schnell === 'bezahlbar' && x.preis > (CLUB.budget || 0)) return false;
      if (F.schnell === 'frei' && !x.frei) return false;
      if (F.schnell === 'merk' && !merk.has(p.id)) return false;
      return true;
    }).sort((a, b) => F.sort === 'preis' ? a.preis - b.preis : F.sort === 'alter' ? a.p.age - b.p.age
      : F.sort === 'pot' ? mitte(sicht(b.p).p) - mitte(sicht(a.p).p)
      : F.sort === 'passt' ? ((plus(b.p) || { d: -99 }).d - (plus(a.p) || { d: -99 }).d) || mitte(sicht(b.p).o) - mitte(sicht(a.p).o)
      : mitte(sicht(b.p).o) - mitte(sicht(a.p).o));
  }
  function aktiveFilter() {
    const a = [];
    if (F.pos.length) a.push(['pos', F.pos.join(', ')]);
    if (F.alter[0] > 16 || F.alter[1] < 40) a.push(['alter', F.alter[1] < 40 ? `${F.alter[0]}–${F.alter[1]} J.` : `ab ${F.alter[0]} J.`]);
    if (F.pot) a.push(['pot', `Pot. ${F.pot}+`]);
    if (F.preis[0] > 0 || (F.preis[1] != null && F.preis[1] < preisMax())) a.push(['preis', F.preis[0] > 0 ? `${geld(F.preis[0])} – ${geld(preisBis())}` : `bis ${geld(preisBis())}`]);
    return a;
  }
  const SORT = { staerke: 'Stärke', passt: 'Passt am besten', pot: 'Potenzial', preis: 'Preis', alter: 'Alter' };

  // ── Ebene 1 ──────────────────────────────────────────────────────────────
  function zeile(x) {
    const p = x.p, s = sicht(p), pl = plus(p), teuer = !x.frei && x.preis > (CLUB.budget || 0);
    const merk = (CLUB.watchlist || []).some(w => w.id === p.id);
    return `<div class="kts-z" data-kts="${esc(p.id)}" data-frei="${x.frei ? 1 : 0}">${gesicht(p)}
      <span class="kts-n"><b><span class="pos-badge-sm pos-${esc(p.pos)}">${esc(p.pos)}</span> ${esc(dn(p))}${merk ? ' <i class="ti ti-star-filled kts-merk" aria-label="gemerkt"></i>' : ''}</b>
        <small><span class="kts-w">${wappen(p._clubId)}</span>${esc(p.fromClub || 'vereinslos')} · ${p.age} J.</small>
        ${pl ? `<span class="kts-chip gut"><i class="ti ti-arrow-up-right" aria-hidden="true"></i>Elf +${pl.d} auf ${esc(pl.l)}</span>` : ''}${p.age <= 21 && s.p[1] >= 70 ? '<span class="kts-chip tal"><i class="ti ti-seedling" aria-hidden="true"></i>Talent</span>' : ''}${p.nurLeihe ? '<span class="kts-chip">nur Leihe</span>' : ''}</span>
      <span class="kts-r"><b>${span(s.o)}</b><small>Pot. ${span(s.p)}</small><em class="${x.frei ? 'frei' : teuer ? 'teuer' : ''}">${x.frei ? 'ablösefrei' : geld(x.preis)}</em></span></div>`;
  }
  function kopf() {
    let w = { open: offen() }; try { w = currentWindowInfo(); } catch (e) { /* einfach */ }
    const n = aktiveFilter().length;
    const fenster = w.open ? (w.deadline ? 'Deadline-Day' : `Fenster offen${w.weeksLeft ? ` · ${w.weeksLeft} Wo.` : ''}`) : 'Fenster zu';
    return `<div class="kts-kopf"><span><small>BUDGET</small><b>${geld(CLUB.budget || 0)}</b></span><span class="kts-fenster${w.open ? ' offen' : ''}">${fenster}</span></div>
      <button type="button" class="kts-such" data-kts-blatt="1"><i class="ti ti-search" aria-hidden="true"></i>Spieler suchen<span class="kts-fz"><i class="ti ti-adjustments-horizontal" aria-hidden="true"></i>Filter${n ? `<em>${n}</em>` : ''}</span></button>`;
  }
  function zeichne() {
    const el = document.getElementById('tr-sub-markt'); if (!el || typeof MARKET === 'undefined') return;
    const merkN = (CLUB.watchlist || []).length;
    const schnell = [['elf', 'ti-arrow-up-right', 'Für deine Elf'], ['talente', 'ti-seedling', 'Talente'], ['bezahlbar', 'ti-coin-euro', 'Bezahlbar'], ['frei', 'ti-gift', 'Ablösefrei']]
      .concat(merkN ? [['merk', 'ti-star', `Merkliste ${merkN}`]] : []);
    const a = aktiveFilter(), L = liste();
    el.innerHTML = kopf()
      + (a.length ? `<div class="kts-aktiv">${a.map(([k, t]) => `<button type="button" data-kts-weg="${k}">${esc(t)} <i class="ti ti-x" aria-hidden="true"></i></button>`).join('')}<button type="button" class="weg" data-kts-weg="alle">Alle löschen</button></div>` : '')
      + `<div class="kts-schnell">${schnell.map(([k, ic, t]) => `<button type="button" class="pos-filter-btn${F.schnell === k ? ' active' : ''}" data-kts-schnell="${k}"><i class="ti ${ic}" aria-hidden="true"></i>${esc(t)}</button>`).join('')}</div>`
      + `<div class="kts-info"><span>${L.length} Spieler</span><button type="button" data-kts-sort="1"><i class="ti ti-arrows-sort" aria-hidden="true"></i>${SORT[F.sort]}</button></div>`
      + (L.length ? L.slice(0, F.mehr).map(zeile).join('') : '<p class="kts-leer">Keine Spieler zu dieser Suche.</p>')
      + (L.length > F.mehr ? `<button type="button" class="app-knopf kts-mehr" data-kts-mehr="1">Weitere ${Math.min(30, L.length - F.mehr)} anzeigen</button>` : '');
  }

  // ── Ebene 2: Suchblatt ───────────────────────────────────────────────────
  const FELD = [['ST', 50, 11], ['LF', 17, 20], ['RF', 83, 20], ['ZOM', 50, 31], ['LM', 14, 45], ['RM', 86, 45], ['ZM', 50, 50], ['ZDM', 50, 64], ['LV', 13, 73], ['RV', 87, 73], ['IV', 50, 80], ['TW', 50, 93]];
  const stufe = v => v < 1e6 ? Math.round(v / 1e4) * 1e4 : Math.round(v / 1e5) * 1e5;
  function blattHtml() {
    const mx = preisMax(), n = liste(true).length;
    const pw = v => Math.round(Math.sqrt(Math.max(0, v) / mx) * 1000);                 // Wurzel-Skala: kleine Preise fein, große grob
    const budget = Math.min(1000, pw(CLUB.budget || 0));
    return `<div class="app-griff"></div><button class="app-blatt-zu" aria-label="Schließen"><i class="ti ti-x" aria-hidden="true"></i></button>
      <div class="kts-bt"><i class="ti ti-adjustments-horizontal" aria-hidden="true"></i>Spieler suchen</div>
      <h4 class="kts-h4">Position <b>${F.pos.length ? esc(F.pos.join(', ')) : 'alle'}</b></h4>
      <div class="kts-feld">${FELD.map(([k, x, y]) => `<button type="button" class="kts-p${F.pos.includes(k) ? ' an' : ''}" style="left:${x}%;top:${y}%" data-kts-pos="${k}">${k}</button>`).join('')}</div>
      <h4 class="kts-h4">Alter <b data-kts-zeige="alter">${F.alter[0]}–${F.alter[1]} Jahre</b></h4>
      <div class="kts-band"><input type="range" min="16" max="40" value="${F.alter[0]}" data-kts-r="a0" aria-label="Alter ab"><input type="range" min="16" max="40" value="${F.alter[1]}" data-kts-r="a1" aria-label="Alter bis"></div>
      <div class="kts-vor">${[['Talent', '≤ 21', 16, 21], ['Bestes Alter', '24–29', 24, 29], ['Erfahren', '30+', 30, 40]].map(([t, z, a, b]) => `<button type="button" class="pos-filter-btn${F.alter[0] === a && F.alter[1] === b ? ' active' : ''}" data-kts-alter="${a}-${b}">${t} <small>${z}</small></button>`).join('')}</div>
      <h4 class="kts-h4">Potenzial</h4>
      <div class="kts-seg">${[[0, 'Egal'], [65, 'Gut'], [70, 'Hoch'], [75, 'Top']].map(([v, t]) => `<button type="button" class="${F.pot === v ? 'an' : ''}" data-kts-pot="${v}">${t}${v ? `<small>${v}+</small>` : ''}</button>`).join('')}</div>
      <h4 class="kts-h4">Preis <b data-kts-zeige="preis">${geld(F.preis[0])} – ${geld(preisBis())}</b></h4>
      <div class="kts-band" style="--budget:${budget / 10}%"><span class="kts-budget"><small>dein Budget</small></span>
        <input type="range" min="0" max="1000" value="${pw(F.preis[0])}" data-kts-r="p0" aria-label="Preis ab"><input type="range" min="0" max="1000" value="${pw(preisBis())}" data-kts-r="p1" aria-label="Preis bis"></div>
      <h4 class="kts-h4">Sortieren</h4>
      <div class="kts-vor">${Object.entries(SORT).map(([k, t]) => `<button type="button" class="pos-filter-btn${F.sort === k ? ' active' : ''}" data-kts-s="${k}">${t}</button>`).join('')}</div>
      <div class="kts-fuss"><button type="button" class="zur" data-kts-zur="1">Zurücksetzen</button><button type="button" class="los" data-kts-los="1">${n} Spieler anzeigen</button></div>`;
  }
  function blatt() {
    const b = document.getElementById('app-blatt'); if (!b) return;
    const box = b.querySelector('.app-blatt-box'); box.onclick = null; delete box.dataset.spieler;
    box.classList.add('kts-blatt'); box.innerHTML = blattHtml();
    b.classList.add('auf'); document.body.classList.add('app-gesperrt');
  }
  function blattNeu() { const box = document.querySelector('#app-blatt .kts-blatt'); if (box) { const y = box.scrollTop; box.innerHTML = blattHtml(); box.scrollTop = y; } }
  function blattZu() { const b = document.getElementById('app-blatt'); if (b) b.classList.remove('auf'); document.body.classList.remove('app-gesperrt'); }
  // Regler: Wurzel-Skala zurück in Euro
  function reglerLesen(box) {
    const mx = preisMax(), v = k => +box.querySelector(`[data-kts-r="${k}"]`).value;
    let a0 = v('a0'), a1 = v('a1'); if (a0 > a1) [a0, a1] = [a1, a0];
    F.alter = [a0, a1];
    let p0 = v('p0'), p1 = v('p1'); if (p0 > p1) [p0, p1] = [p1, p0];
    const euro = s => stufe(mx * Math.pow(s / 1000, 2));
    F.preis = [p0 <= 0 ? 0 : euro(p0), p1 >= 1000 ? null : euro(p1)];
    box.querySelector('[data-kts-zeige="alter"]').textContent = `${F.alter[0]}–${F.alter[1]} Jahre`;
    box.querySelector('[data-kts-zeige="preis"]').textContent = `${geld(F.preis[0])} – ${geld(preisBis())}`;
    box.querySelector('[data-kts-los]').textContent = `${liste(true).length} Spieler anzeigen`;
  }

  // ── Spieler-Blatt mit Aktionen ───────────────────────────────────────────
  function spieler(id, istFrei) {
    const x = katalog().find(k => k.p.id === id && k.frei === istFrei); if (!x) return;
    const p = x.p;
    try { DFLAppShell.spielerBlatt(p); } catch (e) { return; }
    const box = document.querySelector('#app-blatt .app-blatt-box'); if (!box) return;
    const merk = (CLUB.watchlist || []).some(w => w.id === p.id), o = offen();
    let knoepfe = '';
    if (istFrei) knoepfe = `<button type="button" class="app-knopf primaer" data-kts-akt="frei"${o ? '' : ' disabled'}><i class="ti ti-signature" aria-hidden="true"></i>Verpflichten</button>`;
    else {
      const anz = typeof mindestAnzahlung === 'function' ? mindestAnzahlung(p.value) : p.value;
      knoepfe = `<button type="button" class="app-knopf primaer" data-kts-akt="kaufen"${p.nurLeihe || (CLUB.budget || 0) < anz || !o ? ' disabled' : ''}><i class="ti ti-shopping-cart" aria-hidden="true"></i>Kaufen · ${geld(p.value)}</button>
        <button type="button" class="app-knopf" data-kts-akt="leihe"${(CLUB.budget || 0) < (p.loanFee || 0) || !o ? ' disabled' : ''}><i class="ti ti-arrows-exchange" aria-hidden="true"></i>Leihen · ${geld(p.loanFee || 0)}</button>`;
    }
    knoepfe += `<button type="button" class="app-knopf" data-kts-akt="merk"><i class="ti ${merk ? 'ti-star-filled' : 'ti-star'}" aria-hidden="true"></i>${merk ? 'Gemerkt' : 'Merken'}</button>`;
    const leiste = document.createElement('div'); leiste.className = 'kts-aktion'; leiste.dataset.id = p.id; leiste.dataset.frei = istFrei ? '1' : '0';
    leiste.innerHTML = knoepfe + (o ? '' : '<p class="kts-hinweis">Kaufen und Leihen im Transferfenster.</p>');
    const griff = box.querySelector('.app-griff'); (box.querySelector('.fut-kopf') || griff || box.firstChild).after(leiste);
  }
  function aktion(a, id, istFrei) {
    if (a === 'merk') {
      if (!Array.isArray(CLUB.watchlist)) CLUB.watchlist = [];
      const i = CLUB.watchlist.findIndex(w => w.id === id);
      if (istFrei) {                                    // die alte Merkliste kennt nur Marktspieler
        if (i >= 0) CLUB.watchlist.splice(i, 1);
        else { const x = katalog().find(k => k.p.id === id); if (x) CLUB.watchlist.push({ id, name: dn(x.p), flag: x.p.flag, pos: x.p.pos, value: 0, frei: true }); }
        if (typeof saveGameState === 'function') { try { saveGameState(); } catch (e) { /* später */ } }
      } else if (typeof toggleWatch === 'function') toggleWatch(id);
      blattZu(); zeichne(); return;
    }
    blattZu();
    if (a === 'kaufen' && typeof buyPlayer === 'function') buyPlayer(id);
    else if (a === 'leihe' && typeof loanInPlayer === 'function') loanInPlayer(id);
    else if (a === 'frei' && typeof window.signFreeAgent === 'function') window.signFreeAgent(id);
    setTimeout(zeichne, 300);
  }

  // ── Klicks ───────────────────────────────────────────────────────────────
  document.addEventListener('click', ev => {
    const t = ev.target; if (!t.closest) return;
    const inListe = t.closest('#tr-sub-markt'), inBlatt = t.closest('#app-blatt .kts-blatt'), akt = t.closest('.kts-aktion [data-kts-akt]');
    if (akt && !akt.disabled) { const l = akt.closest('.kts-aktion'); aktion(akt.getAttribute('data-kts-akt'), l.dataset.id, l.dataset.frei === '1'); return; }
    if (inListe) {
      if (t.closest('[data-kts-blatt]')) { blatt(); return; }
      const s = t.closest('[data-kts-schnell]'); if (s) { const k = s.getAttribute('data-kts-schnell'); F.schnell = F.schnell === k ? '' : k; if (F.schnell === 'elf') F.sort = 'passt'; F.mehr = 30; zeichne(); return; }
      const w = t.closest('[data-kts-weg]'); if (w) { const k = w.getAttribute('data-kts-weg');
        if (k === 'pos' || k === 'alle') F.pos = []; if (k === 'alter' || k === 'alle') F.alter = [16, 40]; if (k === 'pot' || k === 'alle') F.pot = 0; if (k === 'preis' || k === 'alle') F.preis = [0, null];
        zeichne(); return; }
      if (t.closest('[data-kts-sort]')) { const o = Object.keys(SORT); F.sort = o[(o.indexOf(F.sort) + 1) % o.length]; zeichne(); return; }
      if (t.closest('[data-kts-mehr]')) { F.mehr += 30; zeichne(); return; }
      const z = t.closest('.kts-z'); if (z) { spieler(z.getAttribute('data-kts'), z.getAttribute('data-frei') === '1'); return; }
    }
    if (inBlatt) {
      const pb = t.closest('[data-kts-pos]'); if (pb) { const k = pb.getAttribute('data-kts-pos'); F.pos = F.pos.includes(k) ? F.pos.filter(x => x !== k) : F.pos.concat(k); blattNeu(); return; }
      const al = t.closest('[data-kts-alter]'); if (al) { const [a, b] = al.getAttribute('data-kts-alter').split('-').map(Number); F.alter = F.alter[0] === a && F.alter[1] === b ? [16, 40] : [a, b]; blattNeu(); return; }
      const po = t.closest('[data-kts-pot]'); if (po) { F.pot = +po.getAttribute('data-kts-pot'); blattNeu(); return; }
      const so = t.closest('[data-kts-s]'); if (so) { F.sort = so.getAttribute('data-kts-s'); blattNeu(); return; }
      if (t.closest('[data-kts-zur]')) { F.pos = []; F.alter = [16, 40]; F.pot = 0; F.preis = [0, null]; F.sort = 'staerke'; blattNeu(); return; }
      if (t.closest('[data-kts-los]')) { F.schnell = ''; F.mehr = 30; blattZu(); zeichne(); window.scrollTo(0, 0); return; }
    }
  });
  document.addEventListener('input', ev => { const box = ev.target.closest && ev.target.closest('#app-blatt .kts-blatt'); if (box && ev.target.matches('[data-kts-r]')) reglerLesen(box); });
  // Blatt zu → Markierung fürs Suchblatt weg (das Spieler-Blatt nutzt dieselbe Box)
  const beob = () => { const b = document.getElementById('app-blatt'); if (!b) { setTimeout(beob, 500); return; }
    new MutationObserver(() => { if (!b.classList.contains('auf')) { const box = b.querySelector('.app-blatt-box'); if (box && box.classList.contains('kts-blatt')) box.classList.remove('kts-blatt'); } }).observe(b, { attributes: true, attributeFilter: ['class'] }); };
  beob();

  // ── Einhängen: nach jeder Marktliste neu zeichnen ────────────────────────
  ['renderMarketList', 'renderTransferTab', 'renderFreeAgentList'].forEach(n => {
    const _o = window[n]; if (typeof _o !== 'function') return;
    window[n] = function () { const r = _o.apply(this, arguments); try { zeichne(); } catch (e) { console.warn('[KS-Transfersuche]', e); } return r; };
    try { if (n === 'renderMarketList') renderMarketList = window[n]; else if (n === 'renderTransferTab') renderTransferTab = window[n]; } catch (e) { /* window reicht */ }
  });

  const st = document.createElement('style');
  st.textContent = `
  #view-transfer .subtab[onclick*="'frei'"]{display:none!important}
  #view-transfer #budget-banner{display:none!important}
  .kts-kopf{display:flex;align-items:center;gap:8px;margin:2px 2px 10px}
  .kts-kopf b{font:800 20px var(--font-zahl,var(--font-text))}.kts-kopf small{display:block;font-size:11px;color:var(--text3);font-weight:800;letter-spacing:.06em}
  .kts-fenster{margin-left:auto;font-size:12px;font-weight:800;padding:5px 10px;border-radius:999px;background:var(--bg3,#efe2c8);color:var(--text2)}
  .kts-fenster.offen{background:#dff3d6;color:#2f7a2a}
  .kts-such{display:flex;align-items:center;gap:10px;width:100%;padding:11px 14px;border-radius:16px;background:var(--bg2);border:var(--k-rahmen,3px solid #8b5a2b);box-shadow:0 4px 0 var(--k-rand,#8b5a2b);font:800 15px var(--font-text,system-ui);color:var(--text2);cursor:pointer;text-align:left}
  .kts-such>.ti{font-size:22px;color:var(--k-blau-knopf,#2c7cb5)}
  .kts-fz{margin-left:auto;display:flex;align-items:center;gap:5px;padding:5px 10px;border-radius:11px;background:var(--k-blau-knopf,#2c7cb5);color:#fff;font-size:13px}
  .kts-fz .ti{color:#fff;font-size:17px}.kts-fz em{font-style:normal;background:#fff;color:var(--k-blau-knopf,#2c7cb5);border-radius:8px;padding:0 5px;font-size:11px}
  .kts-schnell{display:flex;gap:6px;margin:12px 0 4px;overflow-x:auto;scrollbar-width:none;padding-bottom:4px}.kts-schnell::-webkit-scrollbar{display:none}
  .kts-schnell .pos-filter-btn{white-space:nowrap;padding:6px 11px;font-size:13px;display:flex;align-items:center;gap:4px;flex:none}
  .kts-aktiv{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0 0}
  .kts-aktiv button{display:flex;align-items:center;gap:5px;padding:5px 10px;border-radius:999px;background:#dbe9f5;color:var(--k-blau-schatten,#1d5a86);font:800 12.5px var(--font-text,system-ui);border:2px solid var(--k-blau-knopf,#2c7cb5);cursor:pointer}
  .kts-aktiv button.weg{background:none;border-color:transparent;color:var(--text3);text-decoration:underline}
  .kts-info{display:flex;justify-content:space-between;align-items:center;font-size:11.5px;font-weight:800;letter-spacing:.08em;color:var(--text3);text-transform:uppercase;margin:10px 4px 6px}
  .kts-info button{border:0;background:none;font:800 11.5px var(--font-text,system-ui);letter-spacing:.08em;color:var(--text3);text-transform:uppercase;cursor:pointer;display:flex;align-items:center;gap:3px}
  .kts-z{display:grid;grid-template-columns:auto 1fr auto;gap:9px;align-items:center;padding:8px 10px;margin-bottom:6px;border-radius:14px;background:var(--bg2);border:2px solid var(--k-linie,#d9c29a);cursor:pointer}
  .kts-z .dfl-portrait.klein{width:36px;height:42px}
  .kts-n{min-width:0}.kts-n b{display:block;font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .kts-merk{color:#d6a419;font-size:13px}
  .kts-n small{display:flex;align-items:center;gap:4px;font-size:11.5px;color:var(--text3);font-weight:700;white-space:nowrap;overflow:hidden}
  .kts-w{width:14px;height:16px;flex:none;display:inline-block}.kts-w svg{width:100%;height:100%;display:block}
  .kts-chip{display:inline-flex;align-items:center;gap:3px;margin:3px 4px 0 0;padding:1px 7px;border-radius:8px;font-size:11px;font-weight:800;background:var(--bg3,#efe2c8);color:var(--text2)}
  .kts-chip.gut{background:#dff3d6;color:#2f7a2a}.kts-chip.tal{background:#efe3fb;color:#6b3fa0}
  .kts-r{text-align:right;white-space:nowrap}.kts-r b{display:block;font:800 18px/1 var(--font-zahl,var(--font-text))}.kts-r small{display:block;font-size:11px;color:var(--text3);font-weight:800;margin-top:2px}
  .kts-r em{display:block;font-style:normal;font-weight:800;font-size:13px;margin-top:3px;color:#2f7a2a}.kts-r em.teuer{color:#c0392b}.kts-r em.frei{color:var(--k-blau-knopf,#2c7cb5)}
  .kts-leer{color:var(--text3);font-weight:700;padding:12px 4px}.kts-mehr{width:100%;margin-top:6px}
  .kts-bt{display:flex;align-items:center;gap:8px;font:800 19px var(--font-titel,var(--font-text));margin:2px 0 4px}.kts-bt .ti{color:var(--k-blau-knopf,#2c7cb5)}
  .kts-h4{margin:14px 2px 8px;font-size:12px;letter-spacing:.08em;color:var(--text3);text-transform:uppercase;font-weight:800;display:flex;justify-content:space-between}
  .kts-h4 b{color:var(--k-blau-knopf,#2c7cb5);letter-spacing:0;text-transform:none;font-size:13px}
  .kts-feld{position:relative;height:190px;border-radius:14px;background:repeating-linear-gradient(0deg,#4fbf5b 0 24px,#45b351 24px 48px);border:var(--k-rahmen,3px solid #8b5a2b)}
  .kts-feld::after{content:'';position:absolute;left:30%;right:30%;bottom:0;height:24px;border:2px solid #ffffff99;border-bottom:0;pointer-events:none}
  .kts-feld::before{content:'';position:absolute;left:0;right:0;top:50%;border-top:2px solid #ffffff77;pointer-events:none}
  .kts-p{position:absolute;transform:translate(-50%,-50%);min-width:40px;padding:6px 6px;border-radius:10px;border:0;background:#ffffffe6;color:#2b2a26;font:800 12px var(--font-text,system-ui);text-align:center;box-shadow:0 2px 0 #0003;z-index:1;cursor:pointer}
  .kts-p.an{background:var(--k-blau-knopf,#2c7cb5);color:#fff;box-shadow:0 2px 0 var(--k-blau-schatten,#1d5a86)}
  .kts-band{position:relative;height:36px;margin:0 4px}
  .kts-band::before{content:'';position:absolute;left:0;right:0;top:15px;height:6px;border-radius:3px;background:var(--bg3,#e7d7b6)}
  .kts-band input[type=range]{position:absolute;left:0;right:0;top:6px;width:100%;margin:0;background:none;pointer-events:none;-webkit-appearance:none;appearance:none;height:24px}
  .kts-band input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;pointer-events:auto;width:26px;height:26px;border-radius:50%;background:#fff;border:3px solid var(--k-blau-knopf,#2c7cb5);box-shadow:0 2px 0 #0002;cursor:pointer}
  .kts-band input[type=range]::-moz-range-thumb{pointer-events:auto;width:22px;height:22px;border-radius:50%;background:#fff;border:3px solid var(--k-blau-knopf,#2c7cb5);cursor:pointer}
  .kts-band input[type=range]::-webkit-slider-runnable-track{background:none}
  .kts-budget{position:absolute;left:var(--budget);top:-4px;width:2px;height:40px;background:#2f7a2a;pointer-events:none}
  .kts-budget small{position:absolute;left:4px;top:-6px;font-size:10px;font-weight:800;color:#2f7a2a;white-space:nowrap}
  .kts-vor{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}.kts-vor .pos-filter-btn{padding:5px 10px;font-size:12.5px}
  .kts-seg{display:flex;border:var(--k-rahmen,3px solid #8b5a2b);border-radius:13px;overflow:hidden}
  .kts-seg button{flex:1;border:0;border-right:2px solid var(--k-linie,#d9c29a);background:none;color:var(--text);text-align:center;padding:8px 0;font:800 13px var(--font-text,system-ui);cursor:pointer}.kts-seg button:last-child{border-right:0}
  .kts-seg button small{display:block;font-size:10.5px;opacity:.7}.kts-seg button.an{background:var(--k-blau-knopf,#2c7cb5);color:#fff}
  .kts-fuss{position:sticky;bottom:0;display:flex;gap:8px;padding:12px 0 2px;background:var(--bg2)}
  .kts-fuss button{border:0;border-radius:14px;font:800 15px var(--font-text,system-ui);padding:13px;cursor:pointer}
  .kts-fuss .zur{background:none;color:var(--text2);text-decoration:underline}
  .kts-fuss .los{flex:1;background:var(--k-blau-knopf,#2c7cb5);color:#fff;box-shadow:0 4px 0 var(--k-blau-schatten,#1d5a86)}
  .kts-aktion{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 12px}.kts-aktion .app-knopf{flex:1 1 45%;min-height:46px}
  .kts-aktion .app-knopf.primaer{flex-basis:100%;background:var(--k-blau-knopf,#2c7cb5);color:#fff;border-color:var(--k-blau-schatten,#1d5a86)}
  .kts-aktion .app-knopf:disabled{opacity:.45}
  .kts-hinweis{flex-basis:100%;margin:0;font-size:12px;font-weight:700;color:var(--text3)}
  `;
  document.head.appendChild(st);
  // Markt-Reiter heißt „Suchen“
  const umbenennen = () => { const b = document.querySelector('#view-transfer .subtab[onclick*="\'markt\'"]'); if (!b) { setTimeout(umbenennen, 500); return; } b.textContent = 'Suchen'; };
  umbenennen();
  window.KSTransfersuche = { zeichne, blatt, F, liste };
  console.log('[KS-Transfersuche v1] aktiv — Markt als Suche: Liste stark → schwach, Schnellwahl, Suchblatt mit Seiten, Ablösefreie im Katalog');
})();
