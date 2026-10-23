/* ===== app_main.js ===== */
// ── TEAM CONFIG ──────────────────────────────────────────────
function changeFormation(newFormation) {
  const remaining = getLineupIds().map(getPlayer);
  const slots = FORMATIONS[newFormation];
  const newLineup = {};
  slots.forEach(slot => {
    // bevorzugt einen Spieler, der diese Position spielen kann (positions-Array), sonst irgendeinen
    let idx = remaining.findIndex(p => (p.positions||[p.pos]).includes(slot.group));
    if (idx === -1) idx = remaining.findIndex(p => p.pos === slot.group);
    if (idx === -1) idx = 0;
    const p = remaining.splice(idx, 1)[0];
    newLineup[slot.id] = p ? p.id : null;
  });
  CLUB.formation = newFormation;
  CLUB.lineup = newLineup;
  CLUB.selected = null;
  renderAll();
}

// ── AUSWAHL / TAUSCHEN ────────────────────────────────────────
function clickSlot(slotId) {
  if (!CLUB.selected) { CLUB.selected = {type:'slot', key:slotId}; const pid=CLUB.lineup[slotId]; if(pid) renderPlayerCard(getPlayer(pid)); renderPitch(); renderBench(); return; }
  if (CLUB.selected.type === 'slot' && CLUB.selected.key === slotId) { CLUB.selected = null; renderPitch(); renderBench(); return; }
  if (CLUB.selected.type === 'slot') {
    const a = CLUB.selected.key, b = slotId;
    const tmp = CLUB.lineup[a]; CLUB.lineup[a] = CLUB.lineup[b]; CLUB.lineup[b] = tmp;
  } else {
    // Bankspieler in Slot: nur wenn verfügbar (nicht verletzt/gesperrt)
    const cand = getPlayer(CLUB.selected.key);
    if (cand && !isAvailable(cand)) {
      alert(`${displayName(cand)} ist aktuell nicht einsatzbereit (${isInjured(cand)?'verletzt':'gesperrt'}) und kann nicht aufgestellt werden.`);
      CLUB.selected = null; renderPitch(); renderBench(); return;
    }
    CLUB.lineup[slotId] = CLUB.selected.key;
  }
  CLUB.selected = null;
  renderPitch(); renderBench(); renderRatings(); syncClubToTeams();
}

function clickBench(playerId) {
  if (!CLUB.selected) { CLUB.selected = {type:'bench', key:playerId}; renderPlayerCard(getPlayer(playerId)); renderPitch(); renderBench(); return; }
  if (CLUB.selected.type === 'bench' && CLUB.selected.key === playerId) { CLUB.selected = null; renderPitch(); renderBench(); return; }
  if (CLUB.selected.type === 'bench') {
    CLUB.selected = {type:'bench', key:playerId}; renderPlayerCard(getPlayer(playerId)); renderPitch(); renderBench(); return;
  }
  // Direkter Slot→Bank-Tausch: prüfen, ob der Bankspieler verfügbar ist
  const cand2 = getPlayer(playerId);
  if (cand2 && !isAvailable(cand2)) {
    alert(`${displayName(cand2)} ist aktuell nicht einsatzbereit (${isInjured(cand2)?'verletzt':'gesperrt'}) und kann nicht aufgestellt werden.`);
    CLUB.selected = null; renderPitch(); renderBench(); return;
  }
  CLUB.lineup[CLUB.selected.key] = playerId;
  CLUB.selected = null;
  renderPitch(); renderBench(); renderRatings(); syncClubToTeams();
}

// ── DRAG & DROP zum Tauschen (Startelf ↔ Startelf, Bank ↔ Startelf) ─────────
// Quelle wird beim Ziehen gemerkt; beim Ablegen auf ein Ziel wird getauscht.
let SQUAD_DRAG = null;
function squadDragStart(ev, type, key) {
  SQUAD_DRAG = { type, key };
  CLUB.selected = null;                       // Klick-Auswahl zurücksetzen
  try { ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', key); } catch (e) {}
  if (ev.currentTarget && ev.currentTarget.classList) ev.currentTarget.classList.add('dragging');
}
function squadDragOver(ev) {
  ev.preventDefault();
  try { ev.dataTransfer.dropEffect = 'move'; } catch (e) {}
  const row = ev.currentTarget;
  if (row && row.classList) row.classList.add('drag-over');
}
function squadDragEnd(ev) {
  document.querySelectorAll('.squad-row.dragging, .squad-row.drag-over')
    .forEach(el => el.classList.remove('dragging', 'drag-over'));
  SQUAD_DRAG = null;
}
function squadDrop(ev, toType, toKey) {
  ev.preventDefault();
  const from = SQUAD_DRAG;
  document.querySelectorAll('.squad-row.drag-over').forEach(el => el.classList.remove('drag-over'));
  if (!from) return;
  if (from.type === toType && from.key === toKey) return;   // auf sich selbst
  performSwap(from.type, from.key, toType, toKey);
  SQUAD_DRAG = null;
}

// Führt den Tausch aus, je nach Kombination von Slot/Bank.
function performSwap(fromType, fromKey, toType, toKey) {
  // Hilfsfunktionen
  const availCheck = (pid) => {
    const p = getPlayer(pid);
    if (p && !isAvailable(p)) {
      alert(`${displayName(p)} ist aktuell nicht einsatzbereit (${isInjured(p)?'verletzt':'gesperrt'}) und kann nicht in die Startelf.`);
      return false;
    }
    return true;
  };

  if (fromType === 'slot' && toType === 'slot') {
    // zwei Startelf-Plätze tauschen
    const a = CLUB.lineup[fromKey], b = CLUB.lineup[toKey];
    CLUB.lineup[fromKey] = b; CLUB.lineup[toKey] = a;
  } else if (fromType === 'bench' && toType === 'slot') {
    // Bankspieler in die Startelf (ersetzt den dortigen Spieler → dieser auf die Bank)
    if (!availCheck(fromKey)) return;
    CLUB.lineup[toKey] = fromKey;
  } else if (fromType === 'slot' && toType === 'bench') {
    // Startelf-Spieler raus, Bankspieler (Ziel) rein
    if (!availCheck(toKey)) return;
    CLUB.lineup[fromKey] = toKey;
  } else {
    // bench ↔ bench: nichts an der Startelf zu tun (Reihenfolge der Bank ist kosmetisch)
    return;
  }
  CLUB.selected = null;
  renderPitch(); renderBench(); renderRatings(); syncClubToTeams();
  if (typeof saveGameState === 'function') saveGameState();
}

// Radar-/Spider-Chart der 5 Kernwerte (DEF/MID/ATT/Tempo/Mentalität).
function playerRadarSVG(p) {
  const axes = [['DEF', p.def], ['MID', p.mid], ['ATT', p.att], ['TEM', p.pace], ['MEN', p.mental]];
  const cx = 90, cy = 90, R = 60, N = axes.length;
  const ang = i => (-Math.PI / 2) + i * 2 * Math.PI / N;
  const pt = (i, rr) => [ (cx + Math.cos(ang(i)) * rr).toFixed(1), (cy + Math.sin(ang(i)) * rr).toFixed(1) ];
  const clamp = v => Math.max(6, Math.min(99, v || 0));
  let grid = '';
  [0.25, 0.5, 0.75, 1].forEach(f => {
    grid += `<polygon points="${axes.map((a, i) => pt(i, R * f).join(',')).join(' ')}" fill="none" stroke="#26313f" stroke-width="1"/>`;
  });
  const spokes = axes.map((a, i) => { const [x, y] = pt(i, R); return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#26313f" stroke-width="1"/>`; }).join('');
  const vpts = axes.map((a, i) => pt(i, R * clamp(a[1]) / 100).join(',')).join(' ');
  const dots = axes.map((a, i) => { const [x, y] = pt(i, R * clamp(a[1]) / 100); return `<circle cx="${x}" cy="${y}" r="2.4" fill="#25c065"/>`; }).join('');
  const labels = axes.map((a, i) => { const [x, y] = pt(i, R + 13); return `<text x="${x}" y="${(+y + 3).toFixed(1)}" text-anchor="middle" font-size="9" font-weight="700" fill="#8ea2b8">${a[0]}</text>`; }).join('');
  const vals = axes.map((a, i) => { const [x, y] = pt(i, R * clamp(a[1]) / 100); return `<text x="${x}" y="${(+y - 5).toFixed(1)}" text-anchor="middle" font-size="8.5" font-weight="800" fill="#eef4fb">${a[1]}</text>`; }).join('');
  return `<svg viewBox="0 0 180 180" class="pcard-radar" role="img" aria-label="Werte-Radar">${grid}${spokes}` +
    `<polygon points="${vpts}" fill="rgba(37,192,101,.22)" stroke="#25c065" stroke-width="1.7" stroke-linejoin="round"/>${dots}${vals}${labels}</svg>`;
}
function renderPlayerCard(p) {
  const el = document.getElementById('playercard-sec'); if(!el || !p) return;
  el.style.display = 'block';
  const scoutLvl = CLUB.facilities ? CLUB.facilities.scouting : 1;
  const r = potentialRange(p, scoutLvl);
  const potTxt = (r.exact || r.lo===r.hi) ? r.lo : r.lo+'-'+r.hi;
  const yearsAtClub = LEAGUE ? Math.max(0, LEAGUE.season - (p.joinedSeason||LEAGUE.season)) : 0;
  const season = LEAGUE ? LEAGUE.season : 1;
  const st = (p.stats && p.stats.season === season) ? p.stats : { goals:0, assists:0, apps:0, yellow:0, red:0 };
  // Status-Banner bei Verletzung oder Sperre
  let statusBanner = '';
  if (isInjured(p)) statusBanner = `<div class="pcard-status injured"><i class="ti ti-bandage"></i> Verletzt: ${p.injuryType||'Verletzung'} — fällt noch ${p.injuryWeeks} Woche${p.injuryWeeks>1?'n':''} aus</div>`;
  else if (isSuspended(p)) statusBanner = `<div class="pcard-status suspended"><i class="ti ti-ban"></i> Gesperrt für ${p.suspendedGames} Spiel${p.suspendedGames>1?'e':''}</div>`;
  // Unzufriedenheit (zusätzlich möglich)
  if (p.onStrike) statusBanner += `<div class="pcard-status striking">✊ Streik — nicht aufstellbar. Verkaufen oder Situation lösen.</div>`;
  else if (p.wantsOut) statusBanner += `<div class="pcard-status wantsout">${p.wantsOut==='loan'?'🔁 Leihwunsch — will Spielpraxis.':'✈️ Wechselwunsch — will den Verein verlassen.'} Marktwert gedrückt.</div>`;
  // Hinweis auf drohende Gelbsperre
  const yellowWarn = (!isSuspended(p) && (p.yellowAccum||0) >= 4) ? ` <span style="color:var(--gold,#d29922)">(${p.yellowAccum}/5 — Sperre droht!)</span>` : (p.yellowAccum ? ` (${p.yellowAccum}/5)` : '');
  el.innerHTML = `
    <div class="pcard-name">${p.number?`<span class="pcard-num">${p.number}</span> `:''}${p.flag?p.flag+' ':''}${fullName(p)}${isCaptain(p)?' <span class="pcard-cap" title="Mannschaftskapitän">©</span>':''}</div>
    <div class="pcard-sub">${p.age} Jahre · ${positionsDisplay(p)} · ${p.country||'Deutschland'}</div>
    ${statusBanner}
    <div class="pcard-big"><span class="pcard-ovr">${ovrBase(p)}</span>${seasonGainBadge(p)}<span class="pcard-pot">Potenzial ${potTxt}</span></div>
    ${playerRadarSVG(p)}
    <div class="pcard-statrow">
      <div class="pcard-stat"><div class="v">${st.apps}</div><div class="l">Spiele</div></div>
      <div class="pcard-stat"><div class="v">${st.goals}</div><div class="l">Tore</div></div>
      <div class="pcard-stat"><div class="v">${st.assists}</div><div class="l">Vorlagen</div></div>
      <div class="pcard-stat"><div class="v">${st.yellow}/${st.red}</div><div class="l">🟨/🟥</div></div>
    </div>
    <div class="pcard-row"><span>Geburtstag</span><b>${birthdayLabel(p, LEAGUE)}</b></div>
    <div class="pcard-row"><span>Tempo</span><b>${p.pace}</b></div>
    <div class="pcard-row"><span>Mentalität</span><b>${p.mental}</b></div>
    <div class="pcard-row"><span>Gelbe (Saison)</span><b>${st.yellow}${yellowWarn}</b></div>
    <div class="pcard-row"><span>Im Verein seit</span><b>${yearsAtClub===0?'dieser Saison':yearsAtClub+' Saison(s)'}</b></div>
    ${p.contractUntil!=null && SQUAD.some(x=>x.id===p.id) ? `<div class="pcard-row"><span>Vertrag bis</span><b>${seasonEndYear(p.contractUntil)}</b></div>` : ''}
    <div class="pcard-row"><span>Marktwert</span><b>${formatEuro(computeMarketValue(p))}</b></div>
    ${careerHistoryHtml(p)}
    ${SQUAD.some(x=>x.id===p.id) ? `
    <div class="pcard-row"><span>Trikotnummer</span><b>${p.number||'–'}</b></div>
    <div class="pcard-actions">
      <button class="pcard-act" onclick="changeNumber('${p.id}')">Nummer ändern</button>
      <button class="pcard-act ${isCaptain(p)?'active':''}" onclick="toggleCaptain('${p.id}')">${isCaptain(p)?'Kapitän ©':'Zum Kapitän'}</button>
    </div>` : ''}`;
}
// Karriereverlauf: Saison-für-Saison-Statistik (aus statsHistory + laufender Saison).
// OVR pro Saison wird am Saisonende in statsHistory mitgeschrieben (baut sich über die
// Saisons auf; bei Bestandsspielern anfangs nur die aktuelle Saison).
function careerHistoryHtml(p) {
  if (!p) return '';
  const hist = Array.isArray(p.statsHistory) ? p.statsHistory.slice() : [];
  const cur = p.stats || null;
  const rows = hist.slice();
  if (cur) rows.push(Object.assign({}, cur, { ovr: p.ovr, _current: true }));
  // Nur Zeilen mit echten Daten (oder die laufende Saison) zeigen
  const shown = rows.filter(r => r._current || (r.apps || r.goals || r.assists || r.yellow || r.red));
  if (!shown.length) return '';
  const seasonLbl = (s) => (typeof seasonEndYear === 'function' && s != null) ? seasonEndYear(s) : ('Saison ' + (s != null ? s : '?'));
  const body = shown.map(r => `<tr${r._current ? ' class="ch-cur"' : ''}>
      <td>${seasonLbl(r.season)}${r._current ? ' <span class="ch-now">läuft</span>' : ''}</td>
      <td>${r.apps || 0}</td><td>${r.goals || 0}</td><td>${r.assists || 0}</td>
      <td>${(r.yellow || 0)}/${(r.red || 0)}</td><td>${r.ovr != null ? r.ovr : '–'}</td></tr>`).join('');
  const tot = shown.reduce((a, r) => ({ apps: a.apps + (r.apps || 0), goals: a.goals + (r.goals || 0), assists: a.assists + (r.assists || 0) }), { apps: 0, goals: 0, assists: 0 });
  const totRow = shown.length > 1
    ? `<tfoot><tr><td>Gesamt</td><td>${tot.apps}</td><td>${tot.goals}</td><td>${tot.assists}</td><td>—</td><td>—</td></tr></tfoot>` : '';
  return `<div class="pcard-career">
    <div class="pcard-career-head"><i class="ti ti-history"></i> Karriereverlauf</div>
    <table class="ch-table"><thead><tr><th>Saison</th><th title="Spiele">Sp</th><th>Tore</th><th title="Vorlagen">Vorl</th><th title="Gelb/Rot">K</th><th>OVR</th></tr></thead>
      <tbody>${body}</tbody>${totRow}</table></div>`;
}
// Ändert die Trikotnummer eines eigenen Spielers per Eingabe.
function changeNumber(playerId) {
  const p = SQUAD.find(x=>x.id===playerId); if(!p) return;
  const input = prompt(`Neue Trikotnummer für ${displayName(p)} (1–99):`, p.number||'');
  if (input === null) return;
  const res = setShirtNumber(playerId, input);
  if (!res.ok) { alert(res.reason); return; }
  renderPlayerCard(p); renderBench(); renderPitch(); saveGameState();
}
// Setzt/entfernt den Kapitän.
function toggleCaptain(playerId) {
  setCaptain(playerId);
  const p = SQUAD.find(x=>x.id===playerId);
  renderPlayerCard(p); renderRatings(); syncClubToTeams(); saveGameState();
}

// ── RENDERING: AUFSTELLUNG ─────────────────────────────────────
function renderFormationOptions() {
  const sel = document.getElementById('formation-select');
  if (!sel) return;
  sel.innerHTML = Object.keys(FORMATIONS).map(f => `<option value="${f}" ${f===CLUB.formation?'selected':''}>${f}</option>`).join('');
}

function renderPitch() {
  const pitch = document.getElementById('pitch');
  if (!pitch) return;
  pitch.querySelectorAll('.p-slot').forEach(el => el.remove());
  FORMATIONS[CLUB.formation].forEach(slot => {
    const pid = CLUB.lineup[slot.id];
    const p = pid ? getPlayer(pid) : null;
    const isSel = CLUB.selected && CLUB.selected.type === 'slot' && CLUB.selected.key === slot.id;
    // Positionskürzel des Slots (neues System, via Taktik-System falls vorhanden)
    const posLabel = window.KSPos ? KSPos.platz(slot) : (window.TacticsSystem ? TacticsSystem.slotToPos(slot) : slot.label);   // mit Seite (kickstil_positionen.js)
    const div = document.createElement('div');
    div.className = 'p-slot';
    div.style.left = slot.x + '%'; div.style.top = slot.y + '%';
    // Token zeigt das Positionskürzel; Name darunter; OVR ohne Potenzial-Klammern
    div.innerHTML = `<div class="p-token ${p?'':'empty'} ${isSel?'selected':''}">${posLabel}</div>`+
                     `<div class="p-name">${p?displayName(p):posLabel}${p&&isCaptain(p)?' <span class="cap-badge">©</span>':''}</div>`+(p?`<div class="p-ovr">${ovrBase(p)}${gainPill((p.ovr||0)-ovrBase(p), true)}</div>`:'');
    div.onclick = () => clickSlot(slot.id);
    pitch.appendChild(div);
  });
}

function renderBench() {
  // Neue strukturierte Kaderliste rechts (ersetzt das alte bench-grid)
  renderSquadList();
}

// Strukturierte Kaderliste: Startelf nach Position (mit Positions-Überschrift),
// danach "Auswechselspieler 1-7". Spieler ohne eigenes Positions-Label.
// Grünes Saison-Verbesserungs-Badge: +X, wenn der Spieler seit Saisonbeginn
// im OVR gestiegen ist (Snapshot aus dem Trainingssystem).
// Saison-Basis (eingefroren zu Saisonbeginn per snapshotSquad). Wird als Haupt-
// OVR angezeigt; die laufende Entwicklung erscheint separat als +N/−N-Pille und
// die Basis übernimmt den neuen Wert erst am Saisonende (Snapshot-Reset).
// Der Spieler ist gemäß Modell A aber SOFORT effektiv so stark wie p.ovr.
function ovrBase(p) {
  if (!p) return 0;
  const snap = (CLUB.training && CLUB.training.seasonSnapshot) ? CLUB.training.seasonSnapshot[p.id] : null;
  return (snap && typeof snap.ovr === 'number') ? snap.ovr : (p.ovr || 0);
}
// Potenzial-nur-Anzeige für die Kaderliste (ohne Wiederholung der aktuellen OVR —
// die steckt schon in "Basis ±Entwicklung"). Respektiert die Scouting-Unschärfe.
function potentialOnly(p, scoutLevel) {
  if (!p || typeof potentialRange !== 'function') return '';
  const r = potentialRange(p, scoutLevel);
  const val = (r.exact || r.lo === r.hi) ? `${r.lo}` : `${r.lo}-${r.hi}`;
  return `Pot ${val}`;
}
// Entwicklungs-Pille +N/−N aus einem OVR-Delta. `compact` für enge Kontexte (Pitch).
function gainPill(d, compact) {
  if (!d) return '';
  const up = d > 0;
  const cls = 'season-gain' + (up ? '' : ' season-loss') + (compact ? ' season-gain-sm' : '');
  const sign = up ? '+' : '−';
  return ` <span class="${cls}" title="Entwicklung diese Saison: ${sign}${Math.abs(d)} (wird am Saisonende in die Basis übernommen)">${sign}${Math.abs(d)}</span>`;
}
function seasonGainBadge(p) {
  if (!p) return '';
  const snap = (CLUB.training && CLUB.training.seasonSnapshot) ? CLUB.training.seasonSnapshot[p.id] : null;
  if (!snap || typeof snap.ovr !== 'number') return '';
  return gainPill((p.ovr || 0) - snap.ovr);
}

// Kaderrollen-Badge (Star/Stamm/Rotation/Ergänzung/Talent) aus squadRoleFor.
function squadRoleBadge(p) {
  if (!p || typeof window.squadRoleFor !== 'function') return '';
  const r = window.squadRoleFor(p);
  const txt = { star: 'Star', stamm: 'Stamm', rotation: 'Rotation', ergaenzung: 'Ergänzung', talent: 'Talent' }[r.key] || r.label;
  return `<span class="role-badge role-${r.key}">${txt}</span>`;
}
// Drei Zustands-Punkte pro Spieler: Moral · Form (Ø letzte 5 Noten) · Fitness.
function playerDots(p) {
  if (!p) return '';
  if (window.ensureFitness) window.ensureFitness(p);
  const mor = (typeof p.morale === 'number') ? p.morale : 70;
  const morC = mor >= 70 ? '#25c065' : mor >= 50 ? '#f2c14e' : '#ff4d4d';
  const fit = (typeof p.fitness === 'number') ? p.fitness : 95;
  const fitC = window.fitnessColor ? window.fitnessColor(fit) : (fit >= 80 ? '#25c065' : fit >= 55 ? '#f2c14e' : '#ff4d4d');
  let formC = '#3a4552', formTxt = 'kein Spiel';
  try {
    const list = (p.matchRatings && p.matchRatings.list) ? p.matchRatings.list : [];
    if (list.length) {
      const recent = list.slice(-5);
      const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
      formTxt = avg.toFixed(1); formC = avg >= 7 ? '#25c065' : avg >= 5.5 ? '#f2c14e' : '#ff4d4d';
    }
  } catch (e) {}
  const fitLbl = window.fitnessLabel ? window.fitnessLabel(fit) : '';
  // FITNESS ALS LEISTE statt als Punkt: Ein farbiger Punkt sagt nur „gelb" —
  // man sieht nicht, ob jemand bei 78 oder bei 58 steht. Die Leiste zeigt den
  // Stand auf einen Blick, und ab 62 erscheint ein Pausen-Hinweis.
  const pause = fit < 62;
  const fitBar =
    `<span class="fitbar" title="Fitness ${Math.round(fit)} · ${fitLbl}${pause ? ' — braucht eine Pause' : ''}">` +
      `<span class="fitbar-fill" style="width:${Math.round(fit)}%;background:${fitC}"></span>` +
      `<span class="fitbar-mark"></span>` +
    `</span>` + (pause ? `<span class="fitbar-warn" title="Fitness unter 62 — Einsatz erhöht das Verletzungsrisiko">Pause</span>` : '');
  return `<span class="squad-dots">` +
    `<span class="pdot" style="background:${morC}" title="Moral ${Math.round(mor)}"></span>` +
    `<span class="pdot" style="background:${formC}" title="Form (Ø letzte 5): ${formTxt}"></span>` +
    fitBar + `</span>`;
}
function renderSquadList() {
  const host = document.getElementById('squad-list');
  if (!host) { // Fallback: altes Grid, falls vorhanden
    const grid = document.getElementById('bench-grid');
    if (grid) renderBenchLegacy(grid);
    return;
  }
  const scout = CLUB.facilities ? CLUB.facilities.scouting : 1;
  const slots = FORMATIONS[CLUB.formation];

  // — STARTELF —
  let h = `<div class="squad-section-title">Startelf</div>`;
  slots.forEach(slot => {
    const pid = CLUB.lineup[slot.id];
    const p = pid ? getPlayer(pid) : null;
    const posLabel = window.KSPos ? KSPos.platz(slot) : window.TacticsSystem ? TacticsSystem.slotToPos(slot) : slot.label;
    const sel = CLUB.selected && CLUB.selected.type === 'slot' && CLUB.selected.key === slot.id;
    if (p) {
      const inj = isInjured(p), susp = isSuspended(p);
      let badge = '';
      if (inj) badge = `<span class="bc-status injured"><i class="ti ti-bandage"></i> ${p.injuryWeeks} Wo.</span>`;
      else if (susp) badge = `<span class="bc-status suspended"><i class="ti ti-ban"></i> ${p.suspendedGames} Sp.</span>`;
      // eigene Spieler-Position (nicht nur Slot): bevorzugt p.pos
      const ownPos = positionsDisplay(p);
      h += `<div class="squad-row ${sel?'selected':''} ${inj||susp?'unavailable':''}" draggable="true"
              ondragstart="squadDragStart(event,'slot','${slot.id}')" ondragover="squadDragOver(event)"
              ondrop="squadDrop(event,'slot','${slot.id}')" ondragend="squadDragEnd(event)"
              onclick="clickSlot('${slot.id}')">
        <span class="squad-pos">${posLabel}</span>
        <span class="squad-name">${p.flag?p.flag+' ':''}${displayName(p)}${isCaptain(p)?' <span class="cap-badge">©</span>':''}
          <span class="squad-ppos">${ownPos}</span>${squadRoleBadge(p)}${badge}</span>
        ${playerDots(p)}<span class="squad-ovr">${ovrBase(p)}${seasonGainBadge(p)} <span class="squad-pot">${potentialOnly(p, scout)}</span></span></div>`;
    } else {
      h += `<div class="squad-row empty ${sel?'selected':''}" ondragover="squadDragOver(event)"
              ondrop="squadDrop(event,'slot','${slot.id}')" onclick="clickSlot('${slot.id}')">
        <span class="squad-pos">${posLabel}</span>
        <span class="squad-name" style="color:var(--gold)"><i class="ti ti-alert-triangle"></i> frei — Spieler wählen</span>
        <span class="squad-ovr"></span></div>`;
    }
  });

  // — AUSWECHSELSPIELER 1-7 —
  const benchIds = getBenchIds();
  h += `<div class="squad-section-title" style="margin-top:14px">Auswechselspieler</div>`;
  benchIds.forEach((id, i) => {
    const p = getPlayer(id);
    const sel = CLUB.selected && CLUB.selected.type === 'bench' && CLUB.selected.key === id;
    const inj = isInjured(p), susp = isSuspended(p);
    let badge = '';
    if (inj) badge = `<span class="bc-status injured"><i class="ti ti-bandage"></i> ${p.injuryWeeks} Wo.</span>`;
    else if (susp) badge = `<span class="bc-status suspended"><i class="ti ti-ban"></i> ${p.suspendedGames} Sp.</span>`;
    h += `<div class="squad-row ${sel?'selected':''} ${inj||susp?'unavailable':''}" draggable="true"
            ondragstart="squadDragStart(event,'bench','${id}')" ondragover="squadDragOver(event)"
            ondrop="squadDrop(event,'bench','${id}')" ondragend="squadDragEnd(event)"
            onclick="clickBench('${id}')">
      <span class="squad-pos sub">${positionsDisplay(p)}</span>
      <span class="squad-name">${p.flag?p.flag+' ':''}${displayName(p)}${isCaptain(p)?' <span class="cap-badge">©</span>':''}${squadRoleBadge(p)}${badge}</span>
      ${playerDots(p)}<span class="squad-ovr">${ovrBase(p)}${seasonGainBadge(p)} <span class="squad-pot">${potentialOnly(p, scout)}</span></span></div>`;
  });

  host.innerHTML = h;
}

// Alte Bench-Darstellung (Fallback, falls altes Grid noch genutzt wird)
function renderBenchLegacy(grid) {
  const scout = CLUB.facilities ? CLUB.facilities.scouting : 1;
  grid.innerHTML = getBenchIds().map(id => {
    const p = getPlayer(id);
    const sel = CLUB.selected && CLUB.selected.type === 'bench' && CLUB.selected.key === id;
    const unavailable = isInjured(p) || isSuspended(p);
    return `<div class="bench-card ${sel?'selected':''} ${unavailable?'unavailable':''}" onclick="clickBench('${id}')">`+
           `<div class="bc-name">${p.flag?p.flag+' ':''}${displayName(p)}</div>`+
           `<div class="bc-meta"><span class="pos-badge pos-${p.pos}">${positionsDisplay(p)}</span><span>${potentialDisplay(p, scout)} · ${p.age}J</span></div></div>`;
  }).join('');
}

// ── TEAM-RATINGS AUS KADER + TAKTIK ────────────────────────────
function renderRatings() {
  const r = computeTeamRatings();
  const set = (id,val) => { const el=document.getElementById(id); if(el) el.textContent=val; };
  set('ovr-overall', r.overall); set('rate-attack', r.attack); set('rate-defense', r.defense); set('rate-mental', r.mental);
  const fill = (id,val) => { const el=document.getElementById(id); if(el) el.style.width=val+'%'; };
  fill('rate-attack-fill', r.attack); fill('rate-defense-fill', r.defense); fill('rate-mental-fill', r.mental);
  renderTacticSummary();
}

function renderTacticSummary() {
  const el = document.getElementById('tactic-summary');
  if (!el) return;
  el.innerHTML = `Formation: <b style="color:var(--text)">${CLUB.formation}</b>`;
}

function renderMentalityButtons() {
  const el = document.getElementById('t-mentality-btns');
  if (!el) return;
  el.innerHTML = MENTALITY_OPTS.map(o => `<button class="tactic-btn ${CLUB.tactics.mentality===o.v?'active':''}" onclick="setMentality(${o.v})">${o.l}</button>`).join('');
}
function setMentality(v) {
  CLUB.tactics.mentality = v;
  const lbl = document.getElementById('t-mentality-label');
  if (lbl) lbl.textContent = mentalityLabel(v);
  renderMentalityButtons(); renderRatings(); syncClubToTeams();
}
function renderPassStyleButtons() {
  const el = document.getElementById('t-passstyle-btns');
  if (!el) return;
  el.innerHTML = PASSSTYLE_OPTS.map(o => `<button class="tactic-btn ${CLUB.tactics.passstyle===o.v?'active':''}" onclick="setPassStyle('${o.v}')">${o.l}</button>`).join('');
}
function setPassStyle(v) {
  CLUB.tactics.passstyle = v;
  renderPassStyleButtons(); renderRatings(); syncClubToTeams();
}
function updateTactic(key, val) {
  val = parseInt(val, 10);
  CLUB.tactics[key] = val;
  const lbl = document.getElementById('t-'+key+'-label');
  if (lbl) lbl.textContent = val + '%';
  renderRatings(); syncClubToTeams();
}

function renderAll() { if(typeof ensureCaptain==='function') ensureCaptain(); renderFormationOptions(); renderPitch(); renderBench(); renderRatings(); syncClubToTeams(); }

// ── VERBINDUNG ZUR MATCH-ENGINE ────────────────────────────────
function syncClubToTeams() {
  const r = computeTeamRatings();
  TEAMS.home.str = r.overall; TEAMS.home.attack = r.attack; TEAMS.home.defense = r.defense; TEAMS.home.mental = r.mental;
  rebuildHomePlayerNames();
  const nameLbl = document.getElementById('home-team-label');
  if (nameLbl) nameLbl.textContent = clubName();
  const momLblH = document.getElementById('mom-label-home');
  if (momLblH) momLblH.textContent = clubShort() + ' dominiert';
  const chLblH = document.getElementById('chance-label-home');
  if (chLblH) chLblH.textContent = clubShort();
  const lbl = document.getElementById('home-str-label');
  if (lbl) lbl.textContent = `Stärke: ${r.overall} · ${CLUB.formation} · ${FCM_IS_HOME?'Heim':'Auswärts'}`;
  if (typeof saveGameState === 'function') saveGameState();
}
function switchAppView(view, btn) {
  document.querySelectorAll('.appnav-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  ['home','squad','club','liga','europa','transfer','scout','match'].forEach(v =>
    document.getElementById('view-'+v).classList.toggle('active', v === view));
  if (view === 'home') renderHomeTab();
  if (view === 'club') renderClubTab();
  if (view === 'liga') renderLeagueTab();
  if (view === 'europa' && typeof renderEuropaTab === 'function') renderEuropaTab();
  if (view === 'transfer') renderTransferTab();
  if (view === 'scout') renderScoutTab();
  if (view === 'match' && !CURRENT_FIXTURE && G.min === 0 && !G.running) ensureFixtureLoaded();
}
function switchSubview(name, btn) {
  document.querySelectorAll('#view-squad .subtab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('sub-lineup').classList.toggle('active', name === 'lineup');
  document.getElementById('sub-tactics').classList.toggle('active', name === 'tactics');
  const dep = document.getElementById('sub-depth');
  if (dep) dep.classList.toggle('active', name === 'depth');
  const sl = document.getElementById('sub-squadlist');
  if (sl) sl.classList.toggle('active', name === 'squadlist');
  if (name === 'depth' && typeof renderDepthChart === 'function') renderDepthChart();
  if (name === 'squadlist' && typeof renderSquadOverview === 'function') renderSquadOverview();
}
// Kaderliste: flache Gesamtübersicht, sortier- und filterbar (Position & OVR/Alter/Wert/Name).
const SQ_GROUP = { TW:'Tor', IV:'Abwehr', AV:'Abwehr', LV:'Abwehr', RV:'Abwehr',
  DM:'Mittelfeld', ZM:'Mittelfeld', AM:'Mittelfeld', ZOM:'Mittelfeld', OM:'Mittelfeld', LM:'Mittelfeld', RM:'Mittelfeld',
  ST:'Angriff', MS:'Angriff', HS:'Angriff', LA:'Angriff', RA:'Angriff' };
function renderSquadOverview() {
  const host = document.getElementById('sub-squadlist');
  if (!host || typeof SQUAD === 'undefined') return;
  const scout = CLUB.facilities ? CLUB.facilities.scouting : 1;
  const posFilter = window.SQ_POSFILTER || 'ALL';
  const sortKey = window.SQ_SORT || 'ovr';
  let list = SQUAD.filter(p => !p.onLoanAt);
  if (posFilter !== 'ALL') list = list.filter(p => (SQ_GROUP[p.pos] || 'Mittelfeld') === posFilter);
  const sorters = {
    ovr:  (a, b) => b.ovr - a.ovr,
    age:  (a, b) => a.age - b.age,
    value:(a, b) => (b.value || 0) - (a.value || 0),
    name: (a, b) => displayName(a).localeCompare(displayName(b)),
    pos:  (a, b) => (SQ_GROUP[a.pos] || '').localeCompare(SQ_GROUP[b.pos] || '') || b.ovr - a.ovr
  };
  list = list.slice().sort(sorters[sortKey] || sorters.ovr);
  const groups = ['ALL', 'Tor', 'Abwehr', 'Mittelfeld', 'Angriff'];
  const posRow = `<div class="pos-filter-row">` + groups.map(g =>
    `<button class="pos-filter-btn ${posFilter === g ? 'active' : ''}" onclick="setSqPos('${g}')">${g === 'ALL' ? 'Alle' : g}</button>`).join('') + `</div>`;
  const sorts = [['ovr', 'OVR'], ['age', 'Alter'], ['value', 'Wert'], ['pos', 'Position'], ['name', 'Name']];
  const sortRow = `<div class="pos-filter-row sq-sortrow"><span class="sq-sortlbl">Sortieren:</span>` + sorts.map(s =>
    `<button class="pos-filter-btn ${sortKey === s[0] ? 'active' : ''}" onclick="setSqSort('${s[0]}')">${s[1]}</button>`).join('') + (typeof infoBtn === 'function' ? infoBtn('kader') : '') + `</div>`;
  const rows = list.map(p => {
    const inj = isInjured(p), susp = isSuspended(p);
    return `<div class="sqo-row ${inj || susp ? 'unavailable' : ''}" onclick="showSquadPlayerCard('${p.id}')">
      <span class="pos-badge-sm pos-${p.pos}">${positionsDisplay(p)}</span>
      <span class="sqo-name">${p.flag ? p.flag + ' ' : ''}${displayName(p)}${isCaptain(p) ? ' <span class="cap-badge">©</span>' : ''}${squadRoleBadge(p)}</span>
      <span class="sqo-age">${p.age} J</span>
      ${playerDots(p)}
      <span class="sqo-val">${formatEuro(p.value || 0)}</span>
      <span class="squad-ovr">${ovrBase(p)}${seasonGainBadge(p)} <span class="squad-pot">${potentialOnly(p, scout)}</span></span>
    </div>`;
  }).join('');
  host.innerHTML = posRow + sortRow + `<div class="sqo-count">${list.length} Spieler</div><div class="sqo-list">${rows || '<div style="color:var(--text3);font-size:12px;padding:12px">Keine Spieler in dieser Gruppe.</div>'}</div>`;
}
function setSqPos(g) { window.SQ_POSFILTER = g; renderSquadOverview(); }
function setSqSort(k) { window.SQ_SORT = k; renderSquadOverview(); }
function showSquadPlayerCard(id) {
  const p = (typeof getPlayer === 'function') ? getPlayer(id) : null;
  if (p && typeof renderPlayerCard === 'function') renderPlayerCard(p);
}
// Tiefenkader: Spieler nach Positionsgruppe, sortiert nach Stärke (Nr. 1 + Ersatz).
function renderDepthChart() {
  const host = document.getElementById('sub-depth');
  if (!host || typeof SQUAD === 'undefined') return;
  const CATS = ['Tor', 'Abwehr', 'Mittelfeld', 'Angriff'];
  const MAP = { TW:'Tor', IV:'Abwehr', AV:'Abwehr', LV:'Abwehr', RV:'Abwehr',
    DM:'Mittelfeld', ZM:'Mittelfeld', AM:'Mittelfeld', ZOM:'Mittelfeld', OM:'Mittelfeld', LM:'Mittelfeld', RM:'Mittelfeld',
    ST:'Angriff', MS:'Angriff', HS:'Angriff', LA:'Angriff', RA:'Angriff' };
  const own = SQUAD.filter(p => !p.onLoanAt);
  let h = '<div class="depth-wrap">';
  CATS.forEach(cat => {
    const players = own.filter(p => (MAP[p.pos] || 'Mittelfeld') === cat).sort((a, b) => b.ovr - a.ovr);
    h += `<div class="depth-cat"><div class="depth-cat-head">${cat}<span class="depth-count">${players.length}</span></div>`;
    if (!players.length) { h += `<div class="depth-empty">— keine Spieler —</div></div>`; return; }
    players.forEach((p, i) => {
      const rank = i === 0 ? '<span class="depth-rank starter">Nr.1</span>' : `<span class="depth-rank">${i + 1}.</span>`;
      const inj = isInjured(p) ? ' <i class="ti ti-bandage"></i>' : (isSuspended(p) ? ' <i class="ti ti-ban"></i>' : '');
      h += `<div class="depth-row ${i === 0 ? 'is-starter' : ''}" onclick="renderPlayerCard(getPlayer('${p.id}'))">
        ${rank}
        <span class="depth-name">${p.flag ? p.flag + ' ' : ''}${displayName(p)}<span class="depth-pos">${positionsDisplay(p)}${inj}</span></span>
        ${playerDots(p)}
        <span class="depth-ovr">${ovrBase(p)}${gainPill((p.ovr||0)-ovrBase(p))}</span></div>`;
    });
    h += `</div>`;
  });
  host.innerHTML = h + '</div>';
}
function switchLigaSubview(name, btn) {
  document.querySelectorAll('#view-liga .subtab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  ['tabelle','spielplan','torjaeger','statistik','pokal','pyramide'].forEach(n => {
    const el = document.getElementById('lg-sub-'+n); if (el) el.classList.toggle('active', n === name);
  });
  if (name === 'statistik' && typeof renderStatHub === 'function') renderStatHub();
}

// ═══════════════════════════════════════════════════════════════
// LIGA-PYRAMIDE: Bundesliga → 2. Bundesliga → 3. Liga → 5x Regionalliga
// + DFB-POKAL (zufällige Regionalliga-Lose, Sieger → Europa League)
// ═══════════════════════════════════════════════════════════════
function setOpponent(team) {
  TEAMS.away.name = team.name; TEAMS.away.shortTag = shortTagOf(team.name);
  TEAMS.away.str = team.ovr; TEAMS.away.attack = team.ovr; TEAMS.away.defense = team.ovr; TEAMS.away.mental = team.ovr;
  TEAMS.away.redCards = 0; TEAMS.away.players = 10;
  G.momentum = FCM_IS_HOME ? 53 : 49;
  const lbl=document.getElementById('away-team-label'); if(lbl) lbl.textContent = team.name;
  const strLbl=document.getElementById('away-str-label'); if(strLbl) strLbl.textContent = `Stärke: ${team.ovr} · ${FCM_IS_HOME?'Gast':'Heim'}`;
  const momLblA=document.getElementById('mom-label-away'); if(momLblA) momLblA.textContent = TEAMS.away.shortTag+' dominiert';
  const chLbl=document.getElementById('chance-label-away'); if(chLbl) chLbl.textContent = TEAMS.away.shortTag;
}

function resetMatchState() {
  clearInterval(G.interval);
  Object.assign(G, {
    min:0, homeGoals:0, awayGoals:0, momentum:52, riskLevel:0, shots:[0,0], poss:[50,50], fouls:[0,0], corners:[0,0],
    passAtt:[0,0], passComp:[0,0], passAcc:[78,78], duelsWon:[0,0], duelQuote:[50,50],
    cards:[], interval:null, running:false, halfDone:false, ended:false, paused:false,
    decisions:[], goalLog:[], momentumLog:[], chanceRates:[0,0], chanceCounts:[0,0], upsets:0, playerStatus:{},
    scorers:[]  // Torschützen-Liste für das Post-Match-Modal — wird bei jedem Spielstart geleert
  });
  TEAMS.home.redCards=0; TEAMS.home.players=10; TEAMS.away.redCards=0; TEAMS.away.players=10;
  const feed=document.getElementById('feed');
  if(feed) feed.innerHTML = '<div id="feed-empty" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:200px;color:var(--text3);font-size:12px;gap:6px"><i class="ti ti-ball-football" style="font-size:28px" aria-hidden="true"></i><span>Bereit zum Anpfiff</span></div>';
  const ms=document.getElementById('media-section'); if(ms) ms.style.display='none';
  const tb=document.getElementById('time-badge'); if(tb){ tb.textContent="00'"; tb.className='time-badge'; }
  const sc=document.getElementById('score'); if(sc) sc.textContent='0 : 0';
  const btn=document.getElementById('ko-btn');
  if(btn){ btn.disabled=false; btn.className='ko-btn'; btn.innerHTML='<i class="ti ti-player-play" aria-hidden="true"></i> Anpfiff'; btn.onclick = handleKO; }
  updateUI();
}

function goToFixture(spec) {
  let team;
  if (spec.type === 'liga') team = findFcmGroup(LEAGUE).group.teams.find(t=>t.id===spec.opponentId);
  else if (spec.type === 'pokal') team = CUP.teamLookup[spec.opponentId];
  else if (spec.type === 'friendly') team = friendlyOpponentTeam(LEAGUE, spec.opponentId);
  // Schutz: kein gültiger Gegner gefunden oder versehentlich der eigene Verein →
  // kein kaputtes Spiel (z.B. „FCM gegen FCM") starten.
  if (!team || spec.opponentId === 'fcm' || team.id === 'fcm') {
    console.warn('goToFixture: ungültiger Gegner', spec);
    showNoMatchThisWeek();
    return;
  }
  CURRENT_FIXTURE = spec; FCM_IS_HOME = spec.isHome;
  resetMatchState();
  setOpponent(team);
  syncClubToTeams();
  document.querySelectorAll('.appnav-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('nav-match').classList.add('active');
  document.getElementById('view-squad').classList.remove('active');
  document.getElementById('view-liga').classList.remove('active');
  document.getElementById('view-match').classList.add('active');
  let kickoffMsg;
  if (spec.type === 'pokal') kickoffMsg = `🏆 DFB-Pokal, ${spec.roundName}: ${spec.isHome?clubShort()+' vs '+team.name:team.name+' vs '+clubShort()}!`;
  else if (spec.type === 'friendly') kickoffMsg = `🤝 Testspiel (Vorbereitung): ${spec.isHome?clubShort()+' vs '+team.name:team.name+' vs '+clubShort()}`;
  else kickoffMsg = `📅 Spieltag ${spec.matchday}: ${spec.isHome?clubShort()+' vs '+team.name:team.name+' vs '+clubShort()}`;
  addEv('info', -1, kickoffMsg);
}

function ensureFixtureLoaded() {
  if (!LEAGUE) return;
  // Vorbereitung: Testspiel dieser Woche hat Vorrang (nur im Juli relevant).
  const friendly = fcmFriendlyThisWeek(LEAGUE);
  if (friendly) { goToFixture({ type:'friendly', opponentId:friendly.opponentId, isHome:friendly.isHome, week:friendly.week }); return; }
  // In einer Doppelbelastungswoche zuerst das (noch offene) LIGASPIEL, danach das
  // POKALSPIEL. Beide sind an feste Wochen gebunden; das Pokalspiel nur in seiner
  // Runden-Woche (cupDueThisWeek), damit die Liga nie mehr übersprungen wird.
  const ligaUnplayed = !seasonFullyComplete(LEAGUE) && Array.isArray(LEAGUE.matchWeeks) && LEAGUE.matchWeeks[LEAGUE.matchday] === LEAGUE.week;
  if (ligaUnplayed) {
    const ligaFix = fcmNextFixture(LEAGUE);
    if (ligaFix) { goToFixture({ type:'liga', opponentId:ligaFix.opponentId, isHome:ligaFix.isHome, matchday:ligaFix.matchday }); return; }
  }
  if (cupDueThisWeek()) {
    const cupFix = fcmCupFixture(CUP);
    if (cupFix) { goToFixture({ type:'pokal', opponentId:cupFix.opponentId, isHome:cupFix.isHome, roundName:cupFix.roundName }); return; }
  }
  // Kein (Liga-/Pokal-)Spiel diese Woche für FCM.
  showNoMatchThisWeek();
}
// Zeigt im Spieltag-Tab einen Hinweis, dass diese Woche kein Spiel ansteht.
function showNoMatchThisWeek() {
  CURRENT_FIXTURE = null;
  const feed = document.getElementById('feed');
  if (feed) {
    const lbl = calendarLabel(LEAGUE.week, LEAGUE.startYear);
    // Nutzer 2026-10-22: überflüssiger Text raus („Nutze „Woche weiter", um zum nächsten Spieltag zu gelangen.“)
    feed.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:200px;color:var(--text3);font-size:12px;gap:8px;text-align:center;padding:0 20px">
      <i class="ti ti-calendar-off" style="font-size:32px" aria-hidden="true"></i>
      <span style="font-size:13px;color:var(--text2)">Diese Woche (${lbl}) steht kein Spiel an.</span>
    </div>`;
  }
  const ko = document.getElementById('ko-btn');
  if (ko) { ko.disabled = true; ko.className = 'ko-btn'; ko.innerHTML = '<i class="ti ti-calendar-off" aria-hidden="true"></i> Kein Spiel diese Woche'; }
}

// ── KALENDER-STEUERUNG: eine Woche weiter ──────────────────────
// Kern-Logik einer Kalenderwoche (Zinsen, Events, Markt). Gibt true zurück,
// wenn die Woche regulär weiterlief, false wenn das Saisonende erreicht wurde.
function advanceCalendarWeek() {
  const before = transferWindowInfo(LEAGUE.week).open;
  const res = advanceWeek(LEAGUE);
  if (res.seasonEnd) return false;
  cupNachholen();   // Pokalrunden ohne den eigenen Verein in ihrer Woche
  EXP.hookWeekTick();   // Erwartungs-System: am Monatsende Game-Over prüfen
  // Finanzanlagen: Zinsen gutschreiben und Aktienkurse bewegen
  const interest = applyWeeklySavingsInterest();
  if (interest > 0) addNews('club', 'Zinsen gutgeschrieben', `Dein Tagesgeld hat ${formatEuro(interest)} Zinsen gebracht. Guthaben: ${formatEuro(CLUB.savings)}.`);
  advanceStockPrices();
  // Gehälter werden NICHT mehr wöchentlich abgebucht. Stattdessen reservieren Verträge
  // dauerhaft Gehaltskapazität (CLUB.wageBudget = wageCap - laufende Gehälter); siehe Kauf/Verkauf.
  // Events verarbeiten
  (res.events||[]).forEach(ev => {
    if (ev.type==='birthday') addNews('club', `🎂 Geburtstag: ${ev.name}`, `${ev.name} wird heute ${ev.age} Jahre alt.`);
    if (ev.type==='window_open') addNews('transfer', `Transferfenster offen (${ev.windowType})`, `Das ${ev.windowType}-Transferfenster ist geöffnet.`);   // Nutzer 2026-10-22: überflüssiger Text raus („Käufe und Verkäufe sind jetzt möglich.“)
    if (ev.type==='deadline_day') addNews('transfer', '⏰ Deadline Day!', `Letzte Chance im ${ev.windowType}-Fenster — heute gibt es besonders viele Last-Minute-Angebote!`);
    if (ev.type==='recovered') addNews('club', `Wieder fit: ${ev.name}`, '');   // Nutzer 2026-10-22: überflüssiger Text raus (Text wiederholte die Überschrift)
  });
  // Markt wöchentlich wechseln solange Fenster offen
  const win = transferWindowInfo(LEAGUE.week);
  if (win.open) { refreshMarketForWeek(); const bid = maybeGenerateTransferBid(); if (bid && !bid.newsShown) addNews('transfer', `Angebot für ${bid.playerName}`, `${bid.club} bietet ${formatEuro(bid.amount)} für ${bid.playerName}. Entscheide im Transfermarkt.`); }
  // Angebote für eigene Spieler verfallen nach 3 Wochen (2026-10-21, Einstiegs-Test: dieselben Angebote standen von KW 2 bis KW 10 im Postfach)
  if (Array.isArray(CLUB.transferBids) && CLUB.transferBids.length) {
    const alt = CLUB.transferBids.filter(b => b.week != null && LEAGUE.week - b.week >= 3);
    if (alt.length) {
      CLUB.transferBids = CLUB.transferBids.filter(b => alt.indexOf(b) < 0);
      addNews('transfer', alt.length === 1 ? `Angebot für ${alt[0].playerName} zurückgezogen` : `${alt.length} Angebote zurückgezogen`,
        alt.map(b => `${b.club} (${b.playerName}, ${formatEuro(b.amount)})`).join(' · ') + ' – ohne Antwort nach drei Wochen.');
    }
  }
  // Fenster gerade geschlossen?
  if (before && !win.open) { clearTransferBids(); addNews('transfer', 'Transferfenster geschlossen', ''); }   // Nutzer 2026-10-22: überflüssiger Text raus (Text wiederholte die Überschrift)
  // Kontostand-Verlauf für die Finanz-Sparkline mitschreiben (letzte ~2 Saisons).
  if (!Array.isArray(CLUB._budgetHistory)) CLUB._budgetHistory = [];
  CLUB._budgetHistory.push({ w: LEAGUE.week, s: LEAGUE.season, b: Math.round(CLUB.budget) });
  if (CLUB._budgetHistory.length > 80) CLUB._budgetHistory.shift();
  saveGameState();
  renderHomeTab(); renderTransferTab(); renderScoutTab();
  // Nutzer 2026-10-22: überflüssiger Text raus: keine Postfach-Meldung „Spieltag – Diese Woche steht ein Spiel an“ mehr (Haupt-Button und Office-Kachel sagen es schon)
  return true;
}

function nextWeek() {
  if (!LEAGUE) return;
  // Steht diese Woche ein Testspiel an? Erst spielen lassen.
  const friendly = fcmFriendlyThisWeek(LEAGUE);
  // Hinweis nur, wenn er neu ist: Wer schon im Spieltag steht, braucht ihn nicht (Einstiegs-Test 2026-10-21)
  const schonDa = () => { const v = document.getElementById('view-match'); return !!(v && v.classList.contains('active')); };
  if (friendly) {
    if (!schonDa()) alert('Erst noch das Testspiel dieser Woche – es geht weiter im Spieltag.');
    switchAppView('match', document.getElementById('nav-match'));
    return;
  }
  // Wenn diese Woche noch ein Liga- ODER Pokalspiel offen ist, erst spielen lassen.
  // (Doppelbelastungswoche: beide müssen gespielt werden, bevor die Woche weitergeht.)
  const ligaUnplayed = !seasonFullyComplete(LEAGUE) && Array.isArray(LEAGUE.matchWeeks)
    && LEAGUE.matchWeeks[LEAGUE.matchday] === LEAGUE.week && !!fcmNextFixture(LEAGUE);
  if (ligaUnplayed || cupDueThisWeek()) {
    if (!schonDa()) alert('Erst noch das Spiel dieser Woche – es geht weiter im Spieltag.');
    switchAppView('match', document.getElementById('nav-match')); return;
  }
  // Saison für den eigenen Verein vorbei? Dann Saison abschließen statt Woche weiter.
  if (fcmSeasonOver()) {
    finishSeasonFlow();
    return;
  }
  const ok = advanceCalendarWeek();
  if (!ok) {
    // Kalenderende erreicht, aber Saison evtl. noch nicht komplett — sauber abschließen
    finishSeasonFlow();
  }
}

// Hat der eigene Verein seine Saison beendet? Liga durchgespielt UND kein Pflicht-
// spiel (Pokal ODER Europa) mehr offen — auch wenn deren Finale erst in einer
// späteren Woche ansteht (sonst würde es wegfallen).
function fcmSeasonOver() {
  if (fcmInCup()) return false;                                                   // Pokal noch offen (Finale kommt)
  if (typeof window.fcmInEuro === 'function' && window.fcmInEuro()) return false; // Europa noch offen
  if (seasonFullyComplete(LEAGUE)) return true;
  const ligaFix = fcmNextFixture(LEAGUE);          // null = keine Ligaspiele mehr für FCM
  return !ligaFix;
}

// Schließt die Saison ab (Auf-/Abstieg, neuer Pokal) und meldet das Ergebnis.
function finishSeasonFlow() {
  // Falls der eigene Verein fertig ist, aber andere Ligen noch Spieltage offen haben:
  // den Rest der Saison simulieren, damit die Abschlusstabellen vollständig sind.
  trySimulateRestOfLeagueSeason();
  if (CUP && !CUP.winnerId && !CUP.teamsRemaining.includes('fcm')) autoResolveCupRemaining(CUP);   // Sicherheitsnetz: Pokal vor dem Abschluss fertig
  const result = startNewSeason();
  showSeasonEndSummary(result);
  renderHomeTab(); renderLeagueTab(); renderClubTab(); renderTransferTab(); renderScoutTab();
  // Erwartungs-System: neue Saison → erst Philosophie wählen, danach automatisch Sponsorenwahl
  if (typeof openPhilosophyChoiceDialog === 'function') openPhilosophyChoiceDialog();
  else if (typeof openSponsorChoiceDialog === 'function') openSponsorChoiceDialog();
}

function processFixtureResult() {
  if (!CURRENT_FIXTURE) return;
  const fcmResult = { gh: G.homeGoals, ga: G.awayGoals };
  const oppName = TEAMS.away.name;
  const wasHome = FCM_IS_HOME;
  const scoreStr = `${G.homeGoals}:${G.awayGoals}`;
  const outcome = G.homeGoals > G.awayGoals ? 'Sieg' : G.homeGoals < G.awayGoals ? 'Niederlage' : 'Unentschieden';
  // Spielzeit für die Startelf erhöhen (macht das Potenzial dieser Spieler über die Zeit klarer)
  const season = LEAGUE ? LEAGUE.season : 1;
  getLineupIds().map(getPlayer).forEach(p => { if(p) { p.gamesPlayed = (p.gamesPlayed||0) + 1; addPlayerApp(p, season); } });
  const isFriendly = CURRENT_FIXTURE.type === 'friendly';
  // ── Karten → Sperren (nur Pflichtspiele) ──
  if (!isFriendly) {
    const newSusp = applyCardSuspensions(G.cards || []);
    newSusp.forEach(s => addNews('match', `Sperre: ${s.name}`, `${s.name} ist nach ${s.reason} für ${s.games} Spiel${s.games>1?'e':''} gesperrt.`));
    // Sperren der NICHT eingesetzten gesperrten Spieler um 1 reduzieren (sie haben das Spiel abgesessen)
    const freed = decrementSuspensions();
    freed.forEach(name => addNews('club', `Sperre abgelaufen: ${name}`, ''));   // Nutzer 2026-10-22: überflüssiger Text raus (Text wiederholte die Überschrift)
    // ── Verletzungsrisiko im Spiel ── (eine kleine Chance pro Pflichtspiel, einen Startelf-Spieler zu treffen)
    {
      const candidates = getLineupIds().map(getPlayer).filter(p => p && !isInjured(p));
      if (candidates.length) {
        const victim = candidates[Math.floor(Math.random()*candidates.length)];
        // Grundrisiko 18 %, danach gedämpft durch Lazarett-Stand, Fitness und
        // Charaktereigenschaften des Getroffenen.
        if (Math.random() < 0.18 * verletzungsRisikoFaktor(victim)) {
          const inj = injurePlayer(victim);
          if (inj && inj.schwer) {
            addNews('match', `Schwere Verletzung: ${inj.name}`,
              `Bittere Nachricht: ${inj.name} hat sich eine ${inj.type} zugezogen und fällt rund ${inj.weeks} Wochen aus. ` +
              `Das ist ${inj.weeks >= 20 ? 'die halbe Saison' : 'ein gutes Vierteljahr'} — für den Kader eine Zäsur.`);
          } else if (inj) {
            addNews('match', `Verletzung: ${inj.name}`, `${inj.name} hat sich eine ${inj.type} zugezogen und fällt rund ${inj.weeks} Woche${inj.weeks>1?'n':''} aus.`);
          }
        }
      }
    }
  }
  // ── Erwartungs-System: Match-Auswertung (Boni + Zufriedenheit) ──
  // Engine stellt FCM IMMER als G.homeGoals dar (FCM_IS_HOME ist nur Label/Momentum).
  // Testspiele zählen NICHT für die Vorstands-/Fan-Erwartungen (reine Vorbereitung).
  if (!isFriendly) {
    EXP.hookMatchResult({
      goalsFor:     G.homeGoals,
      goalsAgainst: G.awayGoals,
      wasHome:      wasHome,
      redCardsOwn:  (TEAMS.home && TEAMS.home.redCards) || 0,
      lineupIds:    getLineupIds(),
      tactics:      CLUB.tactics
    });
  }
  // Scouting läuft jetzt pro echter Kalenderwoche (advanceCalendarWeek), nicht
  // mehr pro Spiel — siehe scouting_patch.js.
  // Stadioneinnahmen bei Heimspiel (abhängig von Erfolg, Preis und Gegner)
  let gateIncome = null, merchIncome = 0;
  if (wasHome) {
    gateIncome = matchAttendanceIncome(TEAMS.away.str);
    merchIncome = merchIncomePerMatch();
    // Zuschauereinnahmen sind im Saisonbudget bereits eingeplant (Dauerkarten +
    // Spieltag in fixIncome). Gutgeschrieben wird deshalb nur die ABWEICHUNG
    // vom geplanten Schnitt — volles Haus bringt weiterhin Geld, ein leeres
    // kostet welches, aber die Grundeinnahme zählt nicht zweimal.
    // Vorher landete der volle Betrag zusätzlich auf dem Budget: ein
    // Regionalligist beendete die Saison mit 1,7 Mio statt der geplanten 120k.
    // Merchandising steckt inzwischen ebenfalls im Plan (fixIncome.merch) und
    // zählt hier deshalb genauso nur noch als Abweichung vom Erwartungswert.
    const bd = CLUB._budgetBreakdown && CLUB._budgetBreakdown.income;
    const geplantGate = bd ? ((bd.seasonTickets || 0) + (bd.matchday || 0)) / 17 : 0;
    const geplantMerch = (typeof merchIncomePerMatch === 'function') ? merchIncomePerMatch() : 0;
    CLUB.budget += (gateIncome.total - geplantGate) + (merchIncome - geplantMerch);
    // Zuschauer für den Statistik-Hub (Zuschauerschnitt) mitschreiben — nur Pflichtspiele
    if (!isFriendly && gateIncome && gateIncome.attendance) {
      if (!Array.isArray(CLUB._attendanceLog)) CLUB._attendanceLog = [];
      // t/f/p für die Zuschauerplanung des Vorstands (bundle_economy.js fixIncome): Liga, Auslastung, Preisstufen
      let _t = null; try { _t = findFcmGroup(LEAGUE).tierKey; } catch (e) { _t = null; }
      CLUB._attendanceLog.push({ s: LEAGUE ? LEAGUE.season : 1, a: Math.round(gateIncome.attendance), t: _t, f: Math.round((gateIncome.fill || 0) * 1000) / 1000,
        p: (CLUB.ticketLevel || 0) + '|' + (CLUB.seasonTicketLevel || 0) });
      if (CLUB._attendanceLog.length > 60) CLUB._attendanceLog.shift();
    }
  }
  if (isFriendly) {
    // Testspiel: Ergebnis im Plan abhaken, KEIN Tabellen-/Pokaleinfluss.
    const f = (LEAGUE.friendlies||[]).find(x => x.opponentId === CURRENT_FIXTURE.opponentId && x.week === CURRENT_FIXTURE.week && !x.played);
    if (f) { f.played = true; f.gh = G.homeGoals; f.ga = G.awayGoals; }
    let incomeNote = '';
    if (wasHome && gateIncome) {
      const cap = stadiumCapacityForLevel(CLUB.facilities.stadium);
      incomeNote = ` ${gateIncome.attendance.toLocaleString('de-DE')} von ${cap.toLocaleString('de-DE')} Zuschauern (${Math.round(gateIncome.fill*100)}% Auslastung) — Tickets ${formatEuro(gateIncome.total)}, Merchandise ${formatEuro(merchIncome)}.`;
    }
    addNews('match', `Testspiel: ${clubShort()} ${scoreStr} ${oppName}`, `In der Saisonvorbereitung gab es ${wasHome?'gegen':'bei'} ${oppName} ein ${scoreStr}. Ein gutes Formtraining vor dem Ligastart.${incomeNote}`);
  } else if (CURRENT_FIXTURE.type === 'liga') {
    advanceMatchday(LEAGUE, fcmResult);
    let incomeNote = '';
    if (wasHome && gateIncome) {
      const cap = stadiumCapacityForLevel(CLUB.facilities.stadium);
      incomeNote = ` ${gateIncome.attendance.toLocaleString('de-DE')} von ${cap.toLocaleString('de-DE')} Zuschauern (${Math.round(gateIncome.fill*100)}% Auslastung) — Tickets ${formatEuro(gateIncome.total)}, Merchandise ${formatEuro(merchIncome)}.`;
    }
    addNews('match', `${outcome}: ${clubShort()} ${scoreStr} ${oppName}`, `Im Ligaspiel ${wasHome?'gegen':'bei'} ${oppName} gab es ein ${scoreStr}.${incomeNote}`);
  } else if (CURRENT_FIXTURE.type === 'pokal') {
    const roundName = CURRENT_FIXTURE.roundName;
    resolveCupRound(CUP, fcmResult);
    if (CUP.winnerId === 'fcm') {
      FCM_ACHIEVEMENTS.europaLeagueSeasons.push(LEAGUE.season);
      addNews('cup', '🏆 DFB-POKALSIEGER!', `${clubName()} gewinnt den DFB-Pokal und qualifiziert sich für die Europa League!`);
    } else if (CUP.fcmEliminatedRound === roundName) {
      addNews('cup', `Pokal-Aus im ${roundName}`, `${clubShort()} verliert ${scoreStr} ${wasHome?'gegen':'bei'} ${oppName} und scheidet aus dem DFB-Pokal aus.`);
    } else {
      addNews('cup', `Pokal: Weiter im ${roundName}`, `${clubShort()} gewinnt ${scoreStr} ${wasHome?'gegen':'bei'} ${oppName} und zieht in die nächste Runde ein.`);
    }
    // 2026-10-21 (Einstiegs-Test): nach dem eigenen Aus NICHT mehr sofort alle Runden ausspielen – sonst stand der Pokalsieger
    // schon im August fest. Die übrigen Runden laufen in ihren Kalenderwochen (cupNachholen in advanceCalendarWeek).
  }
  CURRENT_FIXTURE = null;
  saveGameState();
  renderLeagueTab();
}

function startNewSeason() {
  const tierBefore = findFcmGroup(LEAGUE).tierKey;
  // TV-Gelder berechnen, SOLANGE die Abschlusstabelle/Punkte der alten Saison noch stehen
  const tv = computeFcmTvMoney(LEAGUE);
  // Saison-Erfolge für Sponsor-Boni erfassen (Tabelle + Pokal stehen hier noch).
  const _cupSemi = (typeof CUP !== 'undefined' && CUP) &&
    (CUP.winnerId === 'fcm' || CUP.fcmEliminatedRound === 'Halbfinale' || CUP.fcmEliminatedRound === 'Finale');
  CLUB._seasonAchievements = { rank: tv.rank || 99, top3: (tv.rank || 99) <= 3, cupSemi: !!_cupSemi, promotion: false };
  const result = runEndOfSeason(LEAGUE);
  const tierAfter = findFcmGroup(LEAGUE).tierKey;
  // TV-Geld melden. WICHTIG: NICHT direkt aufs Budget buchen — das BudgetSystem
  // (bundle_economy.js) setzt unmittelbar danach `CLUB.budget = transfer` und
  // würde die Gutschrift verwerfen. Die Medienerlöse stecken bereits in der
  // Fixbilanz des Vorstandsbudgets (fixIncome.tv). Vorher stand hier ein
  // `CLUB.budget += tv.amount` samt Meldung „wurde gutgeschrieben" — gemessen
  // kam davon nichts an (Budget 168.000 → 0 trotz 300.000 gemeldeter TV-Gelder).
  if (tv.amount > 0) {
    addNews('club', `📺 TV-Gelder: ${formatEuro(tv.amount)}`, `Für die abgelaufene Saison in der ${tierLabelOf(tv.tierKey)} (${tv.rank}. Platz, ${tv.pts} Punkte) erhält ${clubShort()} ${formatEuro(tv.amount)} aus den Medienrechten. Der Betrag fließt in das Saisonbudget ein, das der Vorstand gleich festlegt.`);
  }
  CUP = buildCup(LEAGUE);
  applyEndOfSeasonClubEffects(tierBefore, tierAfter);
  const tierOrder = ['regionalliga','liga3','bundesliga2','bundesliga'];
  let seasonMsg = `Saison ${seasonYearLabel(LEAGUE.season)} beginnt. `;
  if (tierOrder.indexOf(tierAfter) > tierOrder.indexOf(tierBefore)) seasonMsg += `Nach dem Aufstieg spielt ${clubShort()} jetzt in der ${tierLabelOf(tierAfter)}!`;
  else if (tierOrder.indexOf(tierAfter) < tierOrder.indexOf(tierBefore)) seasonMsg += `Nach dem Abstieg geht es in der ${tierLabelOf(tierAfter)} weiter.`;
  else seasonMsg += `${clubShort()} bleibt in der ${tierLabelOf(tierAfter)}.`;
  addNews('season', `Neue Saison ${seasonYearLabel(LEAGUE.season)}`, seasonMsg);
  saveGameState();
  renderLeagueTab();
  // TV-Info an die Saisonende-Zusammenfassung anhängen
  result.tvMoney = tv;
  return result;
}

// ── RENDERING: LIGA & POKAL ─────────────────────────────────────
function renderLeagueTab() {
  if (!LEAGUE) return;
  renderSeasonBanner();
  renderLgTabelle();
  renderLgSpielplan();
  renderLgTorjaeger();
  renderStatHub();
  renderLgPokal();
  renderLgPyramide();
}
function renderSeasonBanner() {
  const el = document.getElementById('season-banner'); if(!el) return;
  const fg = findFcmGroup(LEAGUE);
  const ligaDone = seasonFullyComplete(LEAGUE);
  const fcmLigaDone = !fcmNextFixture(LEAGUE);
  const cupPending = CUP && fcmCupFixture(CUP);
  // Rückmeldung 18.10.: Liga nur einmal nennen, kein „Zum Pokalspiel“ hier (verwirrt – der Haupt-Button führt hin)
  const ligaName = tierLabelOf(fg.tierKey) === fg.group.name ? fg.group.name : `${tierLabelOf(fg.tierKey)} · ${fg.group.name}`;
  let html = `<div>Saison <b style="color:var(--text)">${seasonYearLabel(LEAGUE.season)}</b> · ${ligaName} · Spieltag ${LEAGUE.matchday}/${maxMatchday(LEAGUE)}</div>`;
  if (cupPending) {
    // nichts: das Pokalspiel startet über den Haupt-Button
  } else if (!fcmLigaDone) {
    // „Zum nächsten Ligaspiel“ entfernt (Nutzer 2026-10-22: ging nicht und gehört nicht in die Liga-Ansicht)
  } else if (!ligaDone) {
    html += `<button class="secondary" onclick="trySimulateRestOfLeagueSeason(); renderLeagueTab();">Restliche Liga-Spieltage simulieren</button>`;
  } else {
    html += `<button onclick="const r=startNewSeason(); showSeasonEndSummary(r);">Saison abschließen &amp; neue Saison starten</button>`;
  }
  el.innerHTML = html;
}
function showSeasonEndSummary(result) {
  let tvLine = '';
  if (result.tvMoney && result.tvMoney.amount > 0) {
    const t = result.tvMoney;
    tvLine = `\n\n📺 TV-Gelder: ${formatEuro(t.amount)} (${tierLabelOf(t.tierKey)}, ${t.rank}. Platz, ${t.pts} Pkt)`;
  }
  alert('Saisonende!\n\n' + result.log.join('\n') + (result.fcmWasChampion ? `\n\n🏆 ${clubName()} ist aufgestiegen!` : '') + tvLine);
}
// Form der letzten 5 Spiele als farbige S/U/N-Punkte.
function teamFormDots(t) {
  const f = Array.isArray(t.form) ? t.form : [];
  if (!f.length) return '<span class="form-none">–</span>';
  const map = { W: ['S', 'w'], D: ['U', 'd'], L: ['N', 'l'] };
  return '<span class="form-dots">' + f.map(r => { const m = map[r] || ['?', 'd']; return `<span class="form-dot f-${m[1]}">${m[0]}</span>`; }).join('') + '</span>';
}
// Mini-Vereinsprofil (Klick auf eine Tabellenzeile).
function showTeamProfile(teamId) {
  if (!LEAGUE) return;
  let group = null;
  try {
    const groups = (typeof allGroups === 'function') ? allGroups(LEAGUE) : [{ group: findFcmGroup(LEAGUE).group }];
    for (const g of groups) { const gg = g.group || g; if (gg.teams && gg.teams.some(t => t.id === teamId)) { group = gg; break; } }
  } catch (e) {}
  if (!group) { const fg = findFcmGroup(LEAGUE); if (!fg) return; group = fg.group; }
  const fg = { group: group, group_name: group.name };
  const tbl = computeTable(group.teams);
  const idx = tbl.findIndex(t => t.id === teamId); if (idx < 0) return;
  const t = tbl[idx], pos = idx + 1;
  const ovr = t.ovr != null ? t.ovr : Math.round(((t.def || 60) + (t.mid || 60) + (t.att || 60)) / 3);
  const initials = t.name.replace(/[0-9.]/g, ' ').split(/[\s\-]+/).filter(Boolean).slice(0, 3).map(w => w[0]).join('').toUpperCase();
  let ov = document.getElementById('team-profile-ov');
  if (!ov) { ov = document.createElement('div'); ov.id = 'team-profile-ov'; ov.className = 'tp-overlay'; ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); }); document.body.appendChild(ov); }
  ov.innerHTML = `<div class="tp-card">
    <div class="tp-head"><div class="tp-crest" style="${typeof crestStyle === 'function' ? crestStyle(t.id) : ''}">${initials}</div>
      <div class="tp-headmain"><div class="tp-name">${t.name}${t.id === 'fcm' ? ' <span style="color:var(--accent)">(du)</span>' : ''}</div>
      <div class="tp-sub">${pos}. Platz · ${fg.group.name}</div></div>
      <button class="tp-x" onclick="document.getElementById('team-profile-ov').remove()">✕</button></div>
    <div class="tp-stats">
      <div class="tp-stat"><div class="v">${ovr}</div><div class="l">Stärke</div></div>
      <div class="tp-stat"><div class="v">${t.pts}</div><div class="l">Punkte</div></div>
      <div class="tp-stat"><div class="v">${t.w}·${t.d}·${t.l}</div><div class="l">S·U·N</div></div>
      <div class="tp-stat"><div class="v">${t.gf}:${t.ga}</div><div class="l">Tore</div></div>
    </div>
    <div class="tp-formrow"><span class="tp-form-lbl">Form</span>${teamFormDots(t)}</div>
  </div>`;
}
function renderLgTabelle() {
  const el = document.getElementById('lg-sub-tabelle'); if(!el) return;
  const fg = findFcmGroup(LEAGUE);
  const tbl = computeTable(fg.group.teams);
  el.innerHTML = `<div class="lg-header" style="margin-bottom:8px"><h3 style="font-size:13px;font-weight:700">${fg.group.name}</h3><span style="font-size:10px;color:var(--text2)">${tierLabelOf(fg.tierKey)}</span></div>` +
    `<table class="lg-table"><thead><tr><th>#</th><th>Team</th><th class="num">Sp</th><th class="num">S</th><th class="num">U</th><th class="num">N</th><th class="num">Tore</th><th class="num">Diff</th><th class="num">Pkt</th><th>Form</th></tr></thead><tbody>` +
    tbl.map((t,i) => `<tr class="lg-clickrow ${t.id==='fcm'?'fcm-row':''}" onclick="showTeamProfile('${t.id}')"><td class="lg-pos">${i+1}</td><td>${t.name}</td><td class="num">${t.played}</td><td class="num">${t.w}</td><td class="num">${t.d}</td><td class="num">${t.l}</td><td class="num">${t.gf}:${t.ga}</td><td class="num">${t.gd>0?'+':''}${t.gd}</td><td class="num">${t.pts}</td><td>${teamFormDots(t)}</td></tr>`).join('') +
    `</tbody></table>`;
}
function renderLgTorjaeger() {
  const el = document.getElementById('lg-sub-torjaeger'); if(!el) return;
  const fg = findFcmGroup(LEAGUE);
  const scorers = buildTopScorers(LEAGUE, 20);
  if (!scorers.length) {
    el.innerHTML = `<div style="font-size:12px;color:var(--text3);text-align:center;padding:20px 0">Noch keine Tore in dieser Saison.</div>`;
    return;
  }
  el.innerHTML = `<div class="lg-header" style="margin-bottom:8px"><h3 style="font-size:13px;font-weight:700">Torjäger</h3><span style="font-size:10px;color:var(--text2)">${fg.group.name}</span></div>` +
    `<table class="lg-table"><thead><tr><th>#</th><th>Spieler</th><th>Verein</th><th class="num">Tore</th><th class="num">Vorl.</th></tr></thead><tbody>` +
    scorers.map((s,i) => `<tr class="${s.own?'fcm-row':''}"><td class="lg-pos">${i+1}</td><td>${s.name}</td><td style="font-size:10px;color:var(--text2)">${s.teamName}</td><td class="num"><b>${s.goals}</b></td><td class="num">${s.assists}</td></tr>`).join('') +
    `</tbody></table>`;
}
// Saison-Statistik-Hub: Spieler des Monats · Zuschauerschnitt · Form-Tabelle · Torjäger Top 3
function renderStatHub() {
  const el = document.getElementById('lg-sub-statistik'); if (!el || !LEAGUE) return;
  const season = LEAGUE.season;
  const fg = findFcmGroup(LEAGUE);
  const rc = (typeof window.ratingColor === 'function') ? window.ratingColor : () => 'var(--accent)';

  // Spieler des Monats: beste Ø-Note der letzten 4 Spiele (min. 2 Einsätze)
  let motm = null;
  (typeof SQUAD !== 'undefined' ? SQUAD : []).filter(p => !p.onLoanAt).forEach(p => {
    const mr = p.matchRatings;
    if (!mr || mr.season !== season || !Array.isArray(mr.list) || mr.list.length < 2) return;
    const last = mr.list.slice(-4);
    const avg = Math.round(last.reduce((a, c) => a + c, 0) / last.length * 10) / 10;
    if (!motm || avg > motm.avg) motm = { name: displayName(p), flag: p.flag, avg, games: last.length };
  });

  // Zuschauerschnitt (aktuelle Saison)
  const attArr = (Array.isArray(CLUB._attendanceLog) ? CLUB._attendanceLog : []).filter(x => x.s === season).map(x => x.a);
  const avgAtt = attArr.length ? Math.round(attArr.reduce((a, c) => a + c, 0) / attArr.length) : 0;
  const cap = (typeof stadiumCapacityForLevel === 'function' && CLUB.facilities) ? stadiumCapacityForLevel(CLUB.facilities.stadium) : 0;
  const fill = (cap && avgAtt) ? Math.round(avgAtt / cap * 100) : 0;

  // Form-Leader (Top 3 der Liga, letzte 5 Spiele)
  const fpts = t => (Array.isArray(t.form) ? t.form : []).slice(-5).reduce((a, r) => a + (r === 'W' ? 3 : r === 'D' ? 1 : 0), 0);
  const formTeams = fg.group.teams.slice().map(t => ({ t, pts: fpts(t) }))
    .filter(x => Array.isArray(x.t.form) && x.t.form.length).sort((a, b) => b.pts - a.pts).slice(0, 3);

  // Torjäger Top 3
  const scorers = (typeof buildTopScorers === 'function') ? buildTopScorers(LEAGUE, 3) : [];

  const card = (icon, title, body) => `<div class="stat-card"><div class="stat-card-head">${icon} ${title}</div>${body}</div>`;
  const motmBody = motm
    ? `<div class="stat-motm"><div class="stat-motm-note" style="color:${rc(motm.avg)}">${motm.avg.toFixed(1).replace('.', ',')}</div>
        <div><div class="stat-motm-name">${motm.flag ? motm.flag + ' ' : ''}${motm.name}</div><div class="stat-sub">Ø-Note der letzten ${motm.games} Spiele</div></div></div>`
    : `<div class="stat-empty">Noch zu wenige Spiele bewertet.</div>`;
  const attBody = avgAtt
    ? `<div class="stat-big">${avgAtt.toLocaleString('de-DE')}</div><div class="stat-sub">Ø Zuschauer${cap ? ` · ${fill}% von ${cap.toLocaleString('de-DE')}` : ''}</div>`
    : `<div class="stat-empty">Noch kein Heimspiel gespielt.</div>`;
  const formBody = formTeams.length
    ? `<div class="stat-list">${formTeams.map((x, i) => `<div class="stat-row ${x.t.id === 'fcm' ? 'fcm-row' : ''}"><span class="stat-rank">${i + 1}</span><span class="stat-name">${x.t.name}</span>${typeof teamFormDots === 'function' ? teamFormDots(x.t) : ''}</div>`).join('')}</div>`
    : `<div class="stat-empty">Noch keine Formdaten.</div>`;
  const scorerBody = scorers.length
    ? `<div class="stat-list">${scorers.map((s, i) => `<div class="stat-row ${s.own ? 'fcm-row' : ''}"><span class="stat-rank">${i + 1}</span><span class="stat-name">${s.name}</span><b class="stat-goals">${s.goals}</b></div>`).join('')}</div>`
    : `<div class="stat-empty">Noch keine Tore.</div>`;

  el.innerHTML = `<div class="stat-hub">
    ${card('<i class="ti ti-star"></i>', 'Spieler des Monats', motmBody)}
    ${card('<i class="ti ti-users"></i>', 'Zuschauerschnitt', attBody)}
    ${card('<i class="ti ti-flame"></i>', 'Form-Tabelle', formBody)}
    ${card('<i class="ti ti-ball-football"></i>', 'Torjäger Top 3', scorerBody)}
  </div>`;
}
function renderLgSpielplan() {
  const el = document.getElementById('lg-sub-spielplan'); if(!el) return;
  const fg = findFcmGroup(LEAGUE);
  const fixturesForGroup = LEAGUE.fixtures[fg.key];
  // ── Vorbereitung: Testspiele ──
  let friendlyHtml = '';
  const friendlies = LEAGUE.friendlies || [];
  if (friendlies.length) {
    const fRows = friendlies.map(f => {
      const opp = friendlyOpponentTeam(LEAGUE, f.opponentId);
      const oppName = opp ? opp.name : f.opponentName;
      const isNext = !f.played && f.week === LEAGUE.week;
      const matchup = f.isHome ? clubShort()+' vs '+oppName : oppName+' vs '+clubShort();
      let right;
      if (f.played) right = `<div class="fixture-res">${f.gh}:${f.ga}</div>`;
      else if (isNext) right = `<button class="fixture-btn" onclick="ensureFixtureLoaded()">Spielen</button>`;
      else right = `<div class="fixture-res" style="color:var(--text3)">geplant</div>`;
      return `<div class="fixture-row ${isNext?'next':''} ${f.played?'played':''}">
        <div class="fixture-md">${calendarMonthOfWeek(f.week)}</div>
        <div class="fixture-opp">${matchup} <span style="color:var(--text3);font-size:9px">(${f.isHome?'Heim':'Auswärts'} · Testspiel)</span></div>
        ${right}
      </div>`;
    }).join('');
    friendlyHtml = `<div style="margin-bottom:14px">
      <div class="news-header" style="margin-bottom:8px">🤝 Vorbereitung (Testspiele)</div>
      <div class="fixture-list">${fRows}</div>
    </div>`;
  }
  const rows = fixturesForGroup.map((md, idx) => {
    const pair = md.find(([h,a]) => h==='fcm'||a==='fcm');
    const isHome = pair[0]==='fcm';
    const oppId = isHome ? pair[1] : pair[0];
    const opp = fg.group.teams.find(t=>t.id===oppId);
    const played = idx < LEAGUE.matchday;
    const isNext = idx === LEAGUE.matchday;
    let resTxt = '–';
    return { idx, opp, isHome, played, isNext };
  });
  const ligaHtml = `<div class="fixture-list">` + rows.map(r => `
    <div class="fixture-row ${r.isNext?'next':''} ${r.played?'played':''}">
      <div class="fixture-md">${r.idx+1}.</div>
      <div class="fixture-opp">${r.isHome?clubShort()+' vs '+r.opp.name : r.opp.name+' vs '+clubShort()} <span style="color:var(--text3);font-size:9px">(${r.isHome?'Heim':'Auswärts'})</span></div>
      ${r.isNext ? `<button class="fixture-btn" onclick="ensureFixtureLoaded()">Spielen</button>` : r.played ? `<div class="fixture-res">gespielt</div>` : ''}
    </div>`).join('') + `</div>`;
  const ligaHeader = friendlies.length ? `<div class="news-header" style="margin-bottom:8px">🏆 Liga-Spielplan</div>` : '';
  el.innerHTML = friendlyHtml + ligaHeader + ligaHtml;
}
function renderLgPokal() {
  const el = document.getElementById('lg-sub-pokal'); if(!el) return;
  if (!CUP) { el.innerHTML = '<div class="cup-status">Kein Pokal-Wettbewerb aktiv.</div>'; return; }
  let html = '';
  if (FCM_ACHIEVEMENTS.europaLeagueSeasons.includes(LEAGUE.season-1) || CUP.winnerId==='fcm') {
    html += `<div class="achv-banner">🏆 ${clubName()} hat den DFB-Pokal gewonnen und qualifiziert sich für die Europa League!</div>`;
  }
  // Fehler 2026-10-18: fcmDrawn gilt nur für ausgeloste Regionalligisten – „nicht ausgelost“ nur, wenn der Verein gar nicht im Pokal ist
  if (!CUP.teamLookup.fcm) {
    html += `<div class="cup-status">${clubName()} wurde diese Saison <b>nicht für den DFB-Pokal ausgelost</b>. ${CUP.winnerId ? 'Pokalsieger: <b>'+CUP.teamLookup[CUP.winnerId].name+'</b>' : 'Der Wettbewerb läuft ohne '+clubShort()+'.'}</div>`;
  } else if (!CUP.winnerId && !CUP.teamsRemaining.includes('fcm')) {
    html += `<div class="cup-status">Ausgeschieden ${CUP.fcmEliminatedRound ? (/Hauptrunde/.test(CUP.fcmEliminatedRound) ? 'in der ' : 'im ') + CUP.fcmEliminatedRound : ''}</div>`;
  } else if (CUP.winnerId && CUP.winnerId !== 'fcm') {
    html += `<div class="cup-status">${clubShort()} ist ${CUP.fcmEliminatedRound ? (/Hauptrunde/.test(CUP.fcmEliminatedRound) ? 'in der ' : 'im ')+CUP.fcmEliminatedRound+' ' : ''}ausgeschieden. Pokalsieger: <b>${CUP.teamLookup[CUP.winnerId].name}</b></div>`;
  } else if (CUP.winnerId === 'fcm') {
    html += `<div class="cup-status">${clubName()} hat den Pokal gewonnen! 🏆</div>`;
  } else {
    const fix = fcmCupFixture(CUP);
    html += `<div class="cup-status"><b>${ROUND_NAMES[CUP.roundIndex]}</b>${fix?` · gegen <b>${fix.opponent.name}</b> (${fix.isHome?'Heim':'Auswärts'})`:''}</div>`;
  }
  if (CUP.log.length) html += `<div class="sb-title">Bisherige Ergebnisse</div><div class="cup-log">${CUP.log.map(l=>`<div>${l}</div>`).join('')}</div>`;
  el.innerHTML = html;
}
function renderLgPyramide() {
  const el = document.getElementById('lg-sub-pyramide'); if(!el) return;
  let html = '';
  [['bundesliga','🥇'],['bundesliga2','🥈'],['liga3','🥉'],['regionalliga','🏅']].forEach(([tierKey, icon]) => {
    const tier = LEAGUE.tiers[tierKey];
    html += `<div class="pyr-tier"><div class="pyr-tier-title">${icon} ${tierLabelOf(tierKey)}</div><div class="pyr-groups">` +
      tier.groups.map(g => `<div class="pyr-group ${g.teams.some(t=>t.id==='fcm')?'has-fcm':''}">${g.name} (${g.teams.length})</div>`).join('') +
      `</div></div>`;
  });
  el.innerHTML = html;
}

// ═══════════════════════════════════════════════════════════════
// TRANSFERMARKT: Marktwert-Modell (angelehnt an Transfermarkt.de-Logik:
// Alter, Position, Spielstärke), Marktpool, Kauf/Verkauf/Leihe
// ═══════════════════════════════════════════════════════════════
// Was muss SOFORT auf dem Konto sein, damit ein Kauf überhaupt denkbar ist?
// Der Kauf-Button prüfte früher gegen die VOLLE Ablöse — damit war die
// Ratenzahlung genau dann gesperrt, wenn man sie braucht: bei 100.000 € Budget
// waren 25 von 40 Marktspielern ausgegraut, darunter einer für 200.000 €, dessen
// erste Rate nur 66.667 € betragen hätte. Die Vereinsverhandlung erlaubt bis zu
// 3 Raten, also reicht ein Drittel als Einstiegshürde. Ob es am Ende wirklich
// reicht, prüft executeBuy exakt (1. Rate + Handgeld).
function mindestAnzahlung(wert) { return Math.ceil((wert || 0) / 3); }

function buyPlayer(marketId, years) {
  if (!isTransferWindowOpen()) { alert('Das Transferfenster ist geschlossen. Käufe und Verkäufe sind nur im Sommer (Wochen 1–9) und im Winter (Januar) möglich.'); return; }
  const idx = MARKET.players.findIndex(p=>p.id===marketId); if(idx===-1) return;
  const p = MARKET.players[idx];
  // Ohne Jahresangabe zuerst den Vertragsdialog öffnen
  if (years == null) { openContractDialog('buy', p); return; }
  years = Math.max(1, Math.min(MAX_CONTRACT_YEARS, years|0));
  const fee = transferFeeForYears(p.value, years);
  const wage = minWageDemand(p);
  if (CLUB.budget < fee) { alert('Nicht genug Transferbudget! Benötigt: ' + formatEuro(fee) + ', verfügbar: ' + formatEuro(CLUB.budget)); return; }
  if ((CLUB.wageBudget || 0) < wage) { alert('Nicht genug freies Gehaltsbudget! Dieser Spieler fordert ' + formatEuro(wage) + '/Woche, noch frei: ' + formatEuro(CLUB.wageBudget || 0) + '/Woche.'); return; }
  CLUB.budget -= fee;
  CLUB.wageBudget = Math.max(0, (CLUB.wageBudget || 0) - wage);
  MARKET.players.splice(idx,1);
  SQUAD.push({ id:'sq_'+p.id, name:p.name, firstName:p.firstName, flag:p.flag, country:p.country, joinedSeason:LEAGUE.season, acquiredSeason:LEAGUE.season, pos:p.pos, positions:p.positions, age:p.age, ovr:p.ovr, truePotential:p.truePotential, def:p.def, mid:p.mid, att:p.att, pace:p.pace, mental:p.mental, gamesPlayed:0, seed:p.seed, value:p.value, wage, contractUntil: LEAGUE.season + years, birthWeek:p.birthWeek, birthMonth:p.birthMonth, birthDay:p.birthDay });
  assignBirthday(SQUAD[SQUAD.length-1]); assignShirtNumbers();
  CLUB.transferHistory.unshift({ type:'buy', name:p.name, amount:fee, season:LEAGUE.season });
  EXP.hookTransfer(SQUAD[SQUAD.length-1], 'buy');   // Erwartungs-System: Philosophie-Regeln prüfen
  addNews('transfer', `Neuzugang: ${p.flag?p.flag+' ':''}${p.name}`, `${clubShort()} verpflichtet ${p.name} (${p.age}, ${p.pos}, OVR ${p.ovr}) für ${formatEuro(fee)} — Vertrag bis ${seasonEndYear(LEAGUE.season + years)}, Gehalt ${formatEuro(wage)}/Woche. Freies Gehaltsbudget: ${formatEuro(CLUB.wageBudget)}/Woche.`);
  renderAll(); renderTransferTab(); saveGameState();
}
// ── VERTRAGSDIALOG (Kauf & Verlängerung) ───────────────────────
function openContractDialog(mode, player) {
  const isBuy = mode === 'buy';
  const base = player.value || computeMarketValue(player);
  const wage = minWageDemand(player);
  const ov = document.createElement('div');
  ov.className = 'contract-overlay';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px';
  let rows = '';
  for (let y=1; y<=MAX_CONTRACT_YEARS; y++) {
    const fee = transferFeeForYears(base, y);
    const untilSeason = LEAGUE.season + y;
    const afford = isBuy ? CLUB.budget >= fee : true;
    rows += `<button class="contract-year-btn" ${afford?'':'disabled'} onclick="confirmContract('${mode}','${player.id}',${y})"
        style="display:flex;justify-content:space-between;align-items:center;width:100%;padding:10px 12px;margin-bottom:6px;border-radius:8px;border:1px solid var(--border,#30363d);background:${afford?'var(--bg3,#21262d)':'var(--bg2,#161b22)'};color:var(--text,#e6edf3);cursor:${afford?'pointer':'not-allowed'};opacity:${afford?1:.5}">
        <span><b>${y} ${y===1?'Jahr':'Jahre'}</b> · bis ${seasonEndYear(untilSeason)}</span>
        <span style="text-align:right">${isBuy?`<b>${formatEuro(fee)}</b> Ablöse<br>`:''}<span style="font-size:11px;color:var(--text2,#8b949e)">${formatEuro(wage)}/Woche</span></span>
      </button>`;
  }
  ov.innerHTML = `<div style="background:var(--bg2,#161b22);border:1px solid var(--border,#30363d);border-radius:12px;max-width:420px;width:100%;padding:20px">
      <div style="font-size:15px;font-weight:700;margin-bottom:4px">${isBuy?'Verpflichten':'Vertrag verlängern'}: ${player.flag?player.flag+' ':''}${displayName(player)}</div>
      <div style="font-size:12px;color:var(--text2,#8b949e);margin-bottom:14px">${player.age} J · ${player.pos} · OVR ${player.ovr}${player.wage?` · aktuell ${formatEuro(player.wage)}/Woche`:''} · gefordert <b style="color:var(--text,#e6edf3)">${formatEuro(wage)}/Woche</b></div>
      <div style="font-size:11px;color:var(--text3,#6e7681);margin-bottom:10px">Längere Verträge ${isBuy?'kosten mehr Ablöse, ':''}binden den Spieler länger. Das Gehalt läuft wöchentlich.</div>
      ${rows}
      <button onclick="this.closest('.contract-overlay').remove()" style="width:100%;padding:9px;margin-top:6px;border-radius:8px;border:none;background:var(--bg4,#30363d);color:var(--text2,#8b949e);cursor:pointer;font-size:12px">Abbrechen</button>
    </div>`;
  document.body.appendChild(ov);
}
function confirmContract(mode, playerId, years) {
  const ov = document.querySelector('.contract-overlay'); if (ov) ov.remove();
  if (mode === 'buy') buyPlayer(playerId, years);
  else renewContract(playerId, years);
}
function renewContract(squadId, years) {
  const p = SQUAD.find(x=>x.id===squadId); if(!p) return;
  if (years == null) { openContractDialog('renew', p); return; }
  years = Math.max(1, Math.min(MAX_CONTRACT_YEARS, years|0));
  const oldWage = p.wage || 0;
  const newWage = minWageDemand(p);
  const wageDelta = newWage - oldWage;
  if (wageDelta > 0 && (CLUB.wageBudget || 0) < wageDelta) { alert('Nicht genug freies Gehaltsbudget für die Verlängerung! Gehaltserhöhung: +' + formatEuro(wageDelta) + '/Woche, frei: ' + formatEuro(CLUB.wageBudget || 0) + '/Woche.'); return; }
  CLUB.wageBudget = Math.max(0, Math.min(CLUB.wageCap || 0, (CLUB.wageBudget || 0) - wageDelta));
  p.wage = newWage;
  p.contractUntil = LEAGUE.season + years;
  delete p.expiring;
  addNews('club', `Vertrag verlängert: ${p.name}`, `${p.name} bleibt bis ${seasonEndYear(p.contractUntil)} — Gehalt ${formatEuro(p.wage)}/Woche.`);
  renderAll(); renderClubTab(); renderScoutTab(); renderTransferTab(); saveGameState();
}
function releaseExpiringPlayer(squadId) {
  const idx = SQUAD.findIndex(x=>x.id===squadId); if(idx===-1) return;
  const p = SQUAD[idx];
  clearFromLineup(squadId);
  CLUB.wageBudget = Math.min(CLUB.wageCap || 0, (CLUB.wageBudget || 0) + (p.wage || 0)); // Kapazität freigeben
  SQUAD.splice(idx,1);
  addNews('transfer', `Abgang (ablösefrei): ${p.name}`, `Der Vertrag mit ${p.name} wurde nicht verlängert. ${p.name} verlässt ${clubShort()} ablösefrei. Freies Gehaltsbudget: ${formatEuro(CLUB.wageBudget)}/Woche.`);
  renderAll(); renderClubTab(); renderScoutTab(); renderTransferTab(); saveGameState();
}
function loanInPlayer(marketId) {
  if (!isTransferWindowOpen()) { alert('Das Transferfenster ist geschlossen. Käufe und Verkäufe sind nur im Sommer (Wochen 1–9) und im Winter (Januar) möglich.'); return; }
  const idx = MARKET.players.findIndex(p=>p.id===marketId); if(idx===-1) return;
  const p = MARKET.players[idx];
  if (CLUB.budget < p.loanFee) { alert('Nicht genug Transferbudget für die Leihgebühr! Benötigt: ' + formatEuro(p.loanFee)); return; }
  const loanWage = weeklyWageFor(p);
  if ((CLUB.wageBudget || 0) < loanWage) { alert('Nicht genug freies Gehaltsbudget für diesen Leihspieler! Benötigt: ' + formatEuro(loanWage) + '/Woche, frei: ' + formatEuro(CLUB.wageBudget || 0) + '/Woche.'); return; }
  CLUB.budget -= p.loanFee;
  CLUB.wageBudget = Math.max(0, (CLUB.wageBudget || 0) - loanWage);
  MARKET.players.splice(idx,1);
  const buyOption = roundMarketValue(p.value * (0.85 + Math.random()*0.3)); // fixierter Kaufpreis am Saisonende
  SQUAD.push({ id:'sq_'+p.id, name:p.name, firstName:p.firstName, flag:p.flag, country:p.country, joinedSeason:LEAGUE.season, acquiredSeason:LEAGUE.season, pos:p.pos, positions:p.positions, age:p.age, ovr:p.ovr, truePotential:p.truePotential, def:p.def, mid:p.mid, att:p.att, pace:p.pace, mental:p.mental, gamesPlayed:0, seed:p.seed, value:p.value, wage:loanWage, contractUntil:LEAGUE.season, onLoanFrom:p.fromClub, buyOption, birthWeek:p.birthWeek, birthMonth:p.birthMonth, birthDay:p.birthDay });
  assignBirthday(SQUAD[SQUAD.length-1]); assignShirtNumbers();
  CLUB.transferHistory.unshift({ type:'loan_in', name:p.name, amount:p.loanFee, season:LEAGUE.season });
  addNews('transfer', `Leihe: ${p.flag?p.flag+' ':''}${p.name}`, `${clubShort()} leiht ${p.name} von ${p.fromClub} (Leihgebühr ${formatEuro(p.loanFee)}). Kaufoption: ${formatEuro(buyOption)}. Freies Gehaltsbudget: ${formatEuro(CLUB.wageBudget)}/Woche.`);
  renderAll(); renderTransferTab(); saveGameState();
}
// Kaufoption eines Leihspielers ziehen (nur bei offenem Fenster)
function signLoanOption(squadId) {
  if (!isTransferWindowOpen()) { alert('Das Transferfenster ist geschlossen.'); return; }
  const p = SQUAD.find(x=>x.id===squadId); if(!p || !p.onLoanFrom || !p.buyOption) return;
  if (CLUB.budget < p.buyOption) { alert('Nicht genug Budget für die Kaufoption! Benötigt: '+formatEuro(p.buyOption)); return; }
  CLUB.budget -= p.buyOption;
  CLUB.transferHistory.unshift({ type:'buy', name:p.name, amount:p.buyOption, season:LEAGUE.season });
  addNews('transfer', `Kaufoption gezogen: ${p.name}`, `${clubShort()} verpflichtet ${p.name} fest für ${formatEuro(p.buyOption)}.`);
  const oldLoanWage = p.wage || 0;
  delete p.onLoanFrom; delete p.buyOption; p.joinedSeason = LEAGUE.season; p.acquiredSeason = LEAGUE.season; p.contractUntil = LEAGUE.season + 3;
  const newWage = minWageDemand(p);
  // Gehaltskapazität um die Differenz anpassen (das Leihgehalt war bereits reserviert)
  CLUB.wageBudget = Math.max(0, Math.min(CLUB.wageCap || 0, (CLUB.wageBudget || 0) - (newWage - oldLoanWage)));
  p.wage = newWage;
  renderAll(); renderTransferTab(); saveGameState();
}
// ── SCHNELLVERKAUF ─────────────────────────────────────────────────────────
// Wer sofort verkauft, verzichtet auf Verhandlung und Bieterwettbewerb — und
// zahlt dafür: 10–30 % unter Marktwert. Damit lohnt es sich, den Spieler
// stattdessen anzubieten (90 %) oder auf ein Gebot zu warten (100–140 %).
// Spanne von außen verstellbar: TransfermarktBalance.schnellverkauf
function quickSellRange() {
  const c = (typeof window !== 'undefined' && window.TransfermarktBalance &&
             window.TransfermarktBalance.schnellverkauf) || null;
  const min = (c && c.min != null) ? c.min : 0.70;
  const max = (c && c.max != null) ? c.max : 0.90;
  return { min: Math.min(min, max), max: Math.max(min, max) };
}
function quickSellFactor() {
  const r = quickSellRange();
  return r.min + Math.random() * (r.max - r.min);
}
function sellPlayer(squadId) {
  if (!isTransferWindowOpen()) { alert('Das Transferfenster ist geschlossen. Käufe und Verkäufe sind nur im Sommer (Wochen 1–9) und im Winter (Januar) möglich.'); return; }
  if (SQUAD.length <= 12) { alert('Der Kader ist zu klein, um noch jemanden abzugeben (mindestens 12 Spieler nötig).'); return; }
  const idx = SQUAD.findIndex(p=>p.id===squadId); if(idx===-1) return;
  const p = SQUAD[idx];
  // Verkaufssperre: in dieser Saison verpflichtete Spieler nicht sofort abgeben
  if (typeof window.canSellPlayer === 'function' && !window.canSellPlayer(p)) {
    const nm = (typeof displayName === 'function') ? displayName(p) : p.name;
    const msg = `${nm} wurde erst in dieser Saison verpflichtet und kann frühestens in der nächsten Saison wieder verkauft werden.`;
    if (typeof showToast === 'function') showToast(msg, 'warn'); else alert(msg);
    return;
  }
  // Preis und Rückfrage VOR den Nebenwirkungen — hookTransfer verändert bereits
  // die Vorstands-/Fanwerte, das darf ein Abbruch nicht ausgelöst haben.
  const mv = computeMarketValue(p);
  const fee = roundMarketValue(mv * quickSellFactor());
  const nm = (typeof displayName === 'function') ? displayName(p) : p.name;
  const abzug = Math.max(0, Math.round((1 - fee / Math.max(1, mv)) * 100));
  const frage = `Schnellverkauf: ${nm} für ${formatEuro(fee)} — ${abzug} % unter Marktwert (${formatEuro(mv)}).\n\n` +
    `Er geht sofort, ohne Verhandlung. Über „Anbieten" bekommst du rund 90 % des Marktwerts, ` +
    `und ein Gebot eines anderen Vereins liegt meist darüber.`;
  if (typeof confirm === 'function' && !confirm(frage)) return;
  EXP.hookTransfer(p, 'sell');   // Erwartungs-System: Philosophie-Regeln prüfen (Urgestein-Verkauf etc.)
  clearFromLineup(squadId);
  CLUB.wageBudget = Math.min(CLUB.wageCap || 0, (CLUB.wageBudget || 0) + (p.wage || 0)); // Kapazität freigeben
  SQUAD.splice(idx,1);
  CLUB.budget += fee;
  CLUB.transferHistory.unshift({ type:'sell', name:p.name, amount:fee, season:LEAGUE.season });
  addNews('transfer', `Abgang (Schnellverkauf): ${p.name}`, `${clubShort()} gibt ${p.name} (${p.age}, ${p.pos}) kurzfristig für ${formatEuro(fee)} ab — ${abzug} % unter dem Marktwert von ${formatEuro(mv)}. Freies Gehaltsbudget: ${formatEuro(CLUB.wageBudget)}/Woche.`);
  renderAll(); renderTransferTab(); saveGameState();
}
function loanOutPlayer(squadId) {
  if (!isTransferWindowOpen()) { alert('Das Transferfenster ist geschlossen. Käufe und Verkäufe sind nur im Sommer (Wochen 1–9) und im Winter (Januar) möglich.'); return; }
  if (SQUAD.filter(p=>!p.onLoanAt).length <= 12) { alert('Der Kader ist zu klein, um noch jemanden zu verleihen (mindestens 12 verfügbare Spieler nötig).'); return; }
  const p = SQUAD.find(x=>x.id===squadId); if(!p) return;
  const fee = Math.max(1000, roundMarketValue(computeMarketValue(p) * 0.08));
  clearFromLineup(squadId);
  CLUB.wageBudget = Math.min(CLUB.wageCap || 0, (CLUB.wageBudget || 0) + (p.wage || 0)); // Gehalt während Leihe frei
  const dest = pickLoanDestination(p);
  p.onLoanAt = dest.name;
  p.loanClubStrength = dest.strength;   // für die Leih-Entwicklung (Note nach Niveau)
  CLUB.budget += fee;
  CLUB.transferHistory.unshift({ type:'loan_out', name:p.name, amount:fee, season:LEAGUE.season });
  renderAll(); renderTransferTab(); saveGameState();
}

// Wählt einen echten Verein als Leihstation, dessen Stärke knapp unter dem Spieler
// liegt (dort wird er Stammspieler). Fällt auf Fantasie-Namen zurück, falls keine
// passende Vereinsliste verfügbar ist.
function pickLoanDestination(p) {
  const ovr = p.ovr || 60;
  // Zielniveau: etwas unter dem Spieler, damit er dort regelmäßig spielt
  const target = ovr - 4;
  const clubs = (typeof window !== 'undefined' && window.EMBEDDED_CLUBS) || [];
  if (clubs.length) {
    const own = (CLUB && CLUB.name) || '';
    const scored = clubs
      .filter(c => c.name !== own)
      .map(c => ({ name: c.name, strength: (c.def + c.mid + c.att) / 3 }))
      // nur Vereine, bei denen der Spieler nicht klar zu schwach ist (max 6 über ihm)
      .filter(c => c.strength <= ovr + 6)
      .map(c => ({ ...c, dist: Math.abs(c.strength - target) }))
      .sort((a, b) => a.dist - b.dist);
    if (scored.length) {
      // aus den 6 passendsten zufällig wählen (etwas Abwechslung)
      const pool = scored.slice(0, 6);
      const pick = pool[Math.floor(Math.random() * pool.length)];
      return { name: pick.name, strength: Math.round(pick.strength) };
    }
  }
  // Fallback: alter Fantasie-Name, Stärke grob am Spieler
  const name = pickRnd(['FC Lindenau','SV Rheinfeld','TuS Hohenfels','VfL Steinbach','SC Marienburg','Borussia Falkenau']);
  return { name, strength: Math.max(45, ovr - 5) };
}
function switchTransferSubview(name, btn) {
  document.querySelectorAll('#view-transfer .subtab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  ['markt','frei','kader','historie'].forEach(n => document.getElementById('tr-sub-'+n).classList.toggle('active', n===name));
}
function renderTransferTab() {
  if (!LEAGUE || !MARKET) return;
  const win = currentWindowInfo();
  const bb = document.getElementById('budget-banner');
  if (bb) {
    let winHtml;
    if (win.open) {
      winHtml = `<div class="window-banner window-open">${win.deadline ? '<i class="ti ti-clock"></i> DEADLINE DAY — letzte Chance im '+win.type+'-Fenster!' : '<i class="ti ti-coin"></i> '+win.type+'-Transferfenster offen'+(win.weeksLeft>0?' · noch '+win.weeksLeft+(win.weeksLeft===1?' Woche':' Wochen'):' · letzte Woche')}</div>`;
    } else {
      winHtml = `<div class="window-banner window-closed"><i class="ti ti-lock"></i> Transferfenster geschlossen. Käufe/Verkäufe nur im Sommer (KW1-6) und Winter (Januar). Gescoutete Talente kannst du beim nächsten Fenster holen.</div>`;
    }
    bb.innerHTML = `<div>Transferbudget: <span class="budget-amount">${formatEuro(CLUB.budget)}</span></div>${winHtml}`;
  }
  renderTransferBids();
  renderMarketList();
  renderMySquadList();
  renderTransferHistory();
}
function renderTransferBids() {
  const el = document.getElementById('tr-bids'); if(!el) return;
  const bids = CLUB.transferBids || [];
  if (!bids.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="news-header" style="margin:4px 0 8px"><i class="ti ti-mail"></i> Angebote für deine Spieler</div>` + bids.map(b => {
    const p = getPlayer(b.playerId);
    const mv = p ? computeMarketValue(p) : 0;
    return `<div class="bid-row"><div class="bid-info"><b>${b.club}</b> bietet <b>${formatEuro(b.amount)}</b> für ${b.playerName}${mv?` <span style="color:var(--text3)">(MW ${formatEuro(mv)})</span>`:''}</div>
      <button class="mkt-btn" onclick="onAcceptBid('${b.id}')">Annehmen</button>
      <button class="mkt-btn" onclick="openSellNegotiation('${b.id}')">Verhandeln</button>
      <button class="mkt-btn secondary" onclick="declineTransferBid('${b.id}'); renderTransferTab();">Ablehnen</button></div>`;
  }).join('');
}
function onAcceptBid(bidId) {
  const res = acceptTransferBid(bidId);
  if (res) { addNews('transfer', `Verkauft: ${res.name}`, `${res.name} wechselt für ${formatEuro(res.amount)} zu ${res.club}.`); renderAll(); renderTransferTab(); saveGameState(); }
}
function setTrFilter(pos, btn) {
  TR_FILTER = pos;
  document.querySelectorAll('.pos-filter-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderMarketList();
}
function setTrAge(a) { window.TR_AGE = a; renderMarketList(); }
function toggleTrAfford() { window.TR_AFFORD = !window.TR_AFFORD; renderMarketList(); }
function toggleWatch(id) {
  if (!Array.isArray(CLUB.watchlist)) CLUB.watchlist = [];
  const i = CLUB.watchlist.findIndex(w => w.id === id);
  if (i >= 0) CLUB.watchlist.splice(i, 1);
  else {
    const p = (MARKET && MARKET.players.find(x => x.id === id)) || getPlayer(id);
    if (p) CLUB.watchlist.push({ id: p.id, name: displayName(p), flag: p.flag, pos: p.pos, value: p.value });
  }
  renderMarketList();
  if (typeof saveGameState === 'function') saveGameState();
}
function renderMarketList() {
  const el = document.getElementById('tr-sub-markt'); if(!el) return;
  const scoutLvl = CLUB.facilities.scouting || 1;
  const reach = scoutingReach(scoutLvl);
  if (!Array.isArray(CLUB.watchlist)) CLUB.watchlist = [];
  const scoutNote = `<div style="font-size:10px;color:var(--text2);margin-bottom:10px;padding:8px 11px;background:var(--bg3);border-radius:7px;border-left:3px solid var(--blue)"><i class="ti ti-binoculars"></i> Scouting ${scoutLvl}/10 · bis Stärke ${reach.maxOvr} · Pot. bis ${reach.maxPot} · ${reach.intlPct} % international ${typeof infoBtn === 'function' ? infoBtn('markt-scouting') : ''}</div>`;
  const posRow = `<div class="pos-filter-row">` + ['ALL',...POS_LIST].map(p =>
    `<button class="pos-filter-btn ${TR_FILTER===p?'active':''}" onclick="setTrFilter('${p}', this)">${p==='ALL'?'Alle':p}</button>`).join('') + (typeof infoBtn === 'function' ? infoBtn('markt') : '') + `</div>`;
  const age = window.TR_AGE || 'ALL';
  const ageRow = `<div class="pos-filter-row tr-filter2">` +
    [['ALL','Jedes Alter'],['U21','U21'],['U24','U24'],['U28','U28'],['O28','28+']].map(a =>
      `<button class="pos-filter-btn ${age===a[0]?'active':''}" onclick="setTrAge('${a[0]}')">${a[1]}</button>`).join('') +
    `<button class="pos-filter-btn afford-chip ${window.TR_AFFORD?'active':''}" onclick="toggleTrAfford()">💰 leistbar</button></div>`;
  const ageTest = (p) => age==='ALL' ? true : age==='U21' ? p.age<=21 : age==='U24' ? p.age<=24 : age==='U28' ? p.age<=28 : age==='O28' ? p.age>=28 : true;
  const list = MARKET.players.filter(p =>
      (TR_FILTER==='ALL' || (p.positions||[p.pos]).includes(TR_FILTER)) &&
      ageTest(p) && (!window.TR_AFFORD || p.value <= CLUB.budget)
    ).sort((a,b)=>b.value-a.value);
  const rows = list.map(p => {
    const watched = CLUB.watchlist.some(w => w.id===p.id);
    const afford = CLUB.budget >= p.value;
    const inCmp = Array.isArray(window.COMPARE) && window.COMPARE.some(c => c.id===p.id);
    return `
    <div class="market-row">
      <div style="flex:1">
        <span class="pos-badge-sm pos-${p.pos}">${positionsDisplay(p)}</span><span class="market-name">${p.flag?p.flag+' ':''}${displayName(p)}</span>
        <span class="afford-dot ${afford?'ok':'no'}" title="${afford?'im Budget':'über Budget'}"></span>${(window.npcTransferInfo && window.npcTransferInfo(p).unsettled) ? '<span class="mkt-willing" title="Wechselwillig — abgabebereit und günstiger zu holen">wechselwillig</span>' : ''}
        <div class="market-meta">${p.age} J · <b style="color:var(--text2)">${potentialDisplay(p, scoutLvl)}</b> · DEF ${p.def} · MID ${p.mid} · ATT ${p.att} · ${p.auslandsklub ? (p.auslandsklub.flagge || '🌍') + ' ' : ''}${p.fromClub}${p.auslandsklub ? ' <span style="color:var(--gold,#f2c14e)">Auslandstransfer</span>' : ''}${p.nurLeihe ? ' <span style="color:#58a6ff">nur Leihe' + (p.optionVerweigert ? ', keine Kaufoption' : '') + '</span>' : ''}</div>
      </div>
      <div class="market-value">${formatEuro(p.value)}<div style="font-size:9px;color:var(--text3);font-weight:400">Gehalt ~${formatEuro(minWageDemand(p))}/Wo · Leihe ${formatEuro(p.loanFee)}</div></div>
      <div class="market-btns">
        <button class="mkt-btn watch-btn ${watched?'on':''}" title="Merken" onclick="toggleWatch('${p.id}')">${watched?'★':'☆'}</button>
        <button class="mkt-btn cmp-btn ${inCmp?'on':''}" title="Vergleichen" onclick="toggleCompare('${p.id}')">⚖</button>
        <button class="mkt-btn" ${(p.nurLeihe||CLUB.budget<mindestAnzahlung(p.value)||!isTransferWindowOpen())?'disabled':''} title="${p.nurLeihe?'Steht nicht zum Verkauf — nur Leihe möglich':''}" onclick="buyPlayer('${p.id}')">Kaufen</button>
        <button class="mkt-btn secondary" ${(CLUB.budget<p.loanFee||!isTransferWindowOpen())?'disabled':''} onclick="loanInPlayer('${p.id}')">Ausleihen</button>
      </div>
    </div>`;
  }).join('');
  let watchHtml = '';
  if (CLUB.watchlist.length) {
    watchHtml = `<div class="watchlist-box"><div class="news-header" style="margin:0 0 8px">⭐ Merkliste (${CLUB.watchlist.length})</div>` +
      CLUB.watchlist.map(w => {
        const live = MARKET.players.find(p => p.id===w.id);
        const val = live ? live.value : w.value;
        const afford = CLUB.budget >= mindestAnzahlung(val);
        return `<div class="watch-row">
          <span class="afford-dot ${afford?'ok':'no'}"></span>
          <span class="watch-name">${w.flag?w.flag+' ':''}${w.name} <span class="watch-pos">${w.pos}</span></span>
          <span class="watch-val">${formatEuro(val)}</span>
          ${live ? `<button class="mkt-btn" ${(!afford||!isTransferWindowOpen())?'disabled':''} onclick="buyPlayer('${w.id}')">Kaufen</button>` : `<span class="watch-gone">nicht am Markt</span>`}
          <button class="mkt-btn secondary watch-x" onclick="toggleWatch('${w.id}')">✕</button>
        </div>`;
      }).join('') + `</div>`;
  }
  el.innerHTML = scoutNote + watchHtml + posRow + ageRow + `<div class="market-list">${rows || '<div style="color:var(--text3);font-size:11px">Keine Spieler in dieser Kategorie.</div>'}</div>`;
  renderCompareBar();
}
// ── Spielervergleich (bis 3 Spieler nebeneinander mit Radar) ──────────────
function toggleCompare(id) {
  if (!Array.isArray(window.COMPARE)) window.COMPARE = [];
  const i = window.COMPARE.findIndex(c => c.id === id);
  if (i >= 0) window.COMPARE.splice(i, 1);
  else {
    if (window.COMPARE.length >= 3) { alert('Maximal 3 Spieler gleichzeitig vergleichen.'); return; }
    const p = (typeof MARKET !== 'undefined' && MARKET.players.find(x => x.id === id)) || getPlayer(id);
    if (p) window.COMPARE.push({ id: p.id, name: displayName(p), flag: p.flag, pos: p.pos, age: p.age, ovr: p.ovr, base: ovrBase(p), def: p.def, mid: p.mid, att: p.att, pace: p.pace, mental: p.mental, value: (p.value != null ? p.value : (typeof computeMarketValue === 'function' ? computeMarketValue(p) : 0)), wage: (typeof minWageDemand === 'function' ? minWageDemand(p) : (p.wage || 0)) });
  }
  renderMarketList();
}
function clearCompare() { window.COMPARE = []; renderMarketList(); }
function renderCompareBar() {
  const arr = window.COMPARE || [];
  let bar = document.getElementById('compare-bar');
  if (!arr.length) { if (bar) bar.remove(); return; }
  const host = document.getElementById('view-transfer') || document.body;
  if (!bar) { bar = document.createElement('div'); bar.id = 'compare-bar'; bar.className = 'compare-bar'; host.appendChild(bar); }
  bar.innerHTML = `<span class="cb-label">⚖ Vergleich:</span>` +
    arr.map(c => `<span class="cb-chip">${c.flag ? c.flag + ' ' : ''}${c.name} <b onclick="toggleCompare('${c.id}')">✕</b></span>`).join('') +
    `<button class="cb-go" ${arr.length < 2 ? 'disabled' : ''} onclick="showCompare()">Vergleichen (${arr.length})</button>` +
    `<button class="cb-clear" onclick="clearCompare()">Leeren</button>`;
}
function showCompare() {
  const arr = window.COMPARE || [];
  if (arr.length < 2) return;
  let ov = document.getElementById('compare-ov');
  if (!ov) { ov = document.createElement('div'); ov.id = 'compare-ov'; ov.className = 'tp-overlay'; ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); }); document.body.appendChild(ov); }
  const ini = (nm) => (nm.replace(/[0-9.]/g, ' ').split(/[\s\-]+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('') || '?').toUpperCase();
  const col = (c) => `<div class="cmp-col">
    <div class="cmp-crest">${ini(c.name)}</div>
    <div class="cmp-name">${c.flag ? c.flag + ' ' : ''}${c.name}</div>
    <div class="cmp-sub">${c.age} J · ${c.pos} · OVR <b>${c.base != null ? c.base : c.ovr}</b>${gainPill((c.ovr || 0) - (c.base != null ? c.base : c.ovr))}</div>
    ${playerRadarSVG(c)}
    <div class="cmp-rows">
      <div class="cmp-r"><span>Marktwert</span><b>${formatEuro(c.value)}</b></div>
      <div class="cmp-r"><span>Gehalt</span><b>${formatEuro(c.wage || 0)}/Wo</b></div>
    </div></div>`;
  ov.innerHTML = `<div class="cmp-card"><div class="cmp-head"><b>Spielervergleich</b><button class="tp-x" onclick="document.getElementById('compare-ov').remove()">✕</button></div><div class="cmp-cols">${arr.map(col).join('')}</div></div>`;
}
function renderMySquadList() {
  const el = document.getElementById('tr-sub-kader'); if(!el) return;
  const scoutLvl = CLUB.facilities.scouting || 1;
  const rows = SQUAD.map(p => {
    const val = computeMarketValue(p);
    if (p.onLoanAt) {
      return `<div class="market-row">
        <div style="flex:1"><span class="pos-badge-sm pos-${p.pos}">${positionsDisplay(p)}</span><span class="market-name">${p.flag?p.flag+' ':''}${displayName(p)}</span><span class="loan-tag">verliehen an ${p.onLoanAt}</span>
        <div class="market-meta">${p.age} J · ${potentialDisplay(p, scoutLvl)} · Marktwert ${formatEuro(val)}</div></div>
        <div class="market-btns"><button class="mkt-btn secondary" ${!isTransferWindowOpen()?'disabled':''} onclick="recallLoanedPlayer('${p.id}')">Zurückholen</button></div>
      </div>`;
    }
    return `<div class="market-row">
      <div style="flex:1"><span class="pos-badge-sm pos-${p.pos}">${positionsDisplay(p)}</span><span class="market-name">${p.flag?p.flag+' ':''}${displayName(p)}</span>${p.onLoanFrom?`<span class="loan-tag">Leihe von ${p.onLoanFrom}</span>`:''}${p.fromYouth?`<span class="loan-tag" style="background:#1a3a1a;color:#3fb950;border-color:#3fb950">Eigengewächs</span>`:''}
      <div class="market-meta">${p.age} J · <b style="color:var(--text2)">${potentialDisplay(p, scoutLvl)}</b> · DEF ${p.def} · MID ${p.mid} · ATT ${p.att}</div></div>
      <div class="market-value">${formatEuro(val)}</div>
      <div class="market-btns">
        ${p.onLoanFrom ? (p.buyOption?`<button class="mkt-btn" ${(!isTransferWindowOpen()||CLUB.budget<p.buyOption)?'disabled':''} onclick="signLoanOption('${p.id}')">Kaufoption ${formatEuro(p.buyOption)}</button>`:'<span style="font-size:9px;color:var(--text3)">nicht im Besitz</span>') : `<button class="mkt-btn" ${!isTransferWindowOpen()?'disabled':''} onclick="offerPlayerForSale('${p.id}')" title="Auf den Markt stellen — rund 90 % des Marktwerts, ein Interessent meldet sich">Anbieten</button><button class="mkt-btn danger" ${!isTransferWindowOpen()?'disabled':''} onclick="sellPlayer('${p.id}')" title="Sofort abgeben — 10–30 % unter Marktwert">Schnellverkauf</button><button class="mkt-btn secondary" ${!isTransferWindowOpen()?'disabled':''} onclick="loanOutPlayer('${p.id}')">Verleihen</button>`}
      </div>
    </div>`;
  }).join('');
  el.innerHTML = `<div class="market-list">${rows}</div>`;
}
function renderTransferHistory() {
  const el = document.getElementById('tr-sub-historie'); if(!el) return;
  if (!CLUB.transferHistory.length) { el.innerHTML = '<div style="color:var(--text3);font-size:11px">Noch keine Transfers getätigt.</div>'; return; }
  const labels = { buy:'Gekauft', sell:'Verkauft', loan_in:'Ausgeliehen (Leihgebühr)', loan_out:'Verliehen (Leihgebühr erhalten)' };
  el.innerHTML = CLUB.transferHistory.map(t =>
    `<div class="thist-row"><span class="tmin">${seasonYearLabel(t.season)}</span> — ${labels[t.type]||t.type}: <b>${t.name}</b> für ${formatEuro(t.amount)}</div>`
  ).join('');
}



// ═══════════════════════════════════════════════════════════════
// NEWS-FEED & HOME-ÜBERSICHT
// ═══════════════════════════════════════════════════════════════
function renderNewsFeed() {
  const el = document.getElementById('news-feed'); if(!el) return;
  // Nutzer 2026-10-22: überflüssiger Text raus: leerer Zustand nur noch „Noch keine Nachrichten.“, leere Texte ohne leere Zeile
  if (!CLUB.news || !CLUB.news.length) { el.innerHTML = '<div class="news-empty">Noch keine Nachrichten.</div>'; return; }
  el.innerHTML = CLUB.news.map(n =>
    `<div class="news-item cat-${n.category}"><div class="news-icon">${NEWS_ICONS[n.category]||'<i class="ti ti-news"></i>'}</div><div class="news-body"><div class="news-title">${n.title}</div>${n.text ? `<div class="news-text">${n.text}</div>` : ''}<div class="news-meta">${seasonYearLabel(n.season)}${n.matchday?' · Spieltag '+n.matchday:''}</div></div></div>`
  ).join('');
}
// Aufgaben-Widget: offene Punkte als klickbare Chips (Aufstellung, Verletzte,
// Gesperrte, auslaufende Verträge). Nutzt vorhandene Daten.
function renderTasksWidget() {
  const host = document.getElementById('tasks-chips');
  if (!host || !LEAGUE) return;
  const season = LEAGUE.season;
  const own = SQUAD.filter(p => !p.onLoanAt);
  const injured = own.filter(p => isInjured(p)).length;
  const suspended = own.filter(p => isSuspended(p)).length;
  const expiring = own.filter(p => p.contractUntil != null && p.contractUntil <= season).length;
  const slots = FORMATIONS[CLUB.formation] || [];
  const emptySlots = slots.filter(s => !CLUB.lineup[s.id]).length;
  const toSquad = "switchAppView('squad',document.getElementById('nav-squad'))";
  const chip = (icon, txt, cls, onclick) => `<button class="task-chip ${cls}" onclick="${onclick}">${icon} ${txt}</button>`;
  const chips = [];
  if (emptySlots) chips.push(chip('<i class="ti ti-target"></i>', `Aufstellung unvollständig (${emptySlots})`, 'warn', toSquad));
  if (injured) chips.push(chip('<i class="ti ti-bandage"></i>', `${injured} verletzt`, '', toSquad));
  if (suspended) chips.push(chip('<i class="ti ti-ban"></i>', `${suspended} gesperrt`, 'warn', toSquad));
  if (expiring) chips.push(chip('<i class="ti ti-file-text"></i>', `${expiring} Vertrag${expiring > 1 ? 'e laufen' : ' läuft'} aus`, 'warn', toSquad));
  host.innerHTML = chips.length ? chips.join('') : `<span class="task-ok"><i class="ti ti-check"></i> Alles im Griff — keine offenen Aufgaben</span>`;
}
// ── Postfach: gebündelter Posteingang (Angebote, Warnungen, Nachrichten) ──
function buildPostfachItems() {
  const items = [];
  if (!LEAGUE) return items;
  // 1) Transferangebote für eigene Spieler = offene Entscheidungen
  (CLUB.transferBids || []).forEach(b => {
    const p = getPlayer(b.playerId);
    const mv = p ? computeMarketValue(p) : 0;
    items.push({ cat: 'offer', icon: '<i class="ti ti-inbox"></i>', title: `Transferangebot für ${b.playerName}`,
      text: `${b.club} bietet ${formatEuro(b.amount)}${mv ? ` · Marktwert ${formatEuro(mv)}` : ''}`,
      actions: `<button class="pf-btn ok" onclick="onAcceptBid('${b.id}'); renderHomeTab();">Annehmen</button>` +
               `<button class="pf-btn" onclick="openSellNegotiation('${b.id}')">Verhandeln</button>` +
               `<button class="pf-btn no" onclick="declineTransferBid('${b.id}'); if(typeof saveGameState==='function')saveGameState(); renderHomeTab();">Ablehnen</button>`,
      prio: 5 });
  });
  // 2) Warnungen aus Kaderstatus
  const season = LEAGUE.season;
  const own = SQUAD.filter(p => !p.onLoanAt);
  const injured = own.filter(p => isInjured(p)).length;
  const suspended = own.filter(p => isSuspended(p)).length;
  const expiring = own.filter(p => p.contractUntil != null && p.contractUntil <= season).length;
  const slots = FORMATIONS[CLUB.formation] || [];
  const emptySlots = slots.filter(s => !CLUB.lineup[s.id]).length;
  const toSquad = "switchAppView('squad',document.getElementById('nav-squad'))";
  const toClub = "switchAppView('club',document.getElementById('nav-club'))";
  const warnBtn = (txt, onclick) => `<button class="pf-btn" onclick="${onclick}">${txt}</button>`;
  if (emptySlots) items.push({ cat: 'warn', icon: '<i class="ti ti-target"></i>', title: 'Aufstellung unvollständig', text: `${emptySlots} ${emptySlots === 1 ? 'Position' : 'Positionen'} frei`, actions: warnBtn('Zum Kader', toSquad), prio: 4 });
  if (suspended) items.push({ cat: 'warn', icon: '<i class="ti ti-ban"></i>', title: `${suspended} Spieler gesperrt`, text: '', actions: warnBtn('Zum Kader', toSquad), prio: 3 });
  if (injured) items.push({ cat: 'warn', icon: '<i class="ti ti-bandage"></i>', title: `${injured} Spieler verletzt`, text: '', actions: warnBtn('Zum Kader', toSquad), prio: 2 });   // Nutzer 2026-10-22: überflüssiger Text raus (Unterzeilen bei gesperrt/verletzt)
  if (expiring) items.push({ cat: 'warn', icon: '<i class="ti ti-file-text"></i>', title: `${expiring} ${expiring === 1 ? 'Vertrag läuft' : 'Verträge laufen'} aus`, text: '', actions: warnBtn('Zu Verträgen', toClub), prio: 3 });
  // Unzufriedene: Streik (höchste Prio) und Wechsel-/Leihwünsche
  const toTransfer = "switchAppView('transfer',document.getElementById('nav-transfer'))";
  own.filter(p => p.onStrike).forEach(p => items.push({ cat: 'warn', icon: '<i class="ti ti-hand-stop"></i>', title: `Streik: ${displayName(p)}`, text: 'Verweigert Einsätze — verkaufen oder aussitzen. Kabinenstimmung leidet.', actions: warnBtn('Zum Transfer', toTransfer), prio: 6 }));
  own.filter(p => p.wantsOut && !p.onStrike).forEach(p => items.push({ cat: 'warn', icon: p.wantsOut === 'loan' ? '<i class="ti ti-refresh"></i>' : '<i class="ti ti-plane"></i>', title: `${p.wantsOut === 'loan' ? 'Leihwunsch' : 'Wechselwunsch'}: ${displayName(p)}`, text: p.wantsOut === 'loan' ? 'Will Spielpraxis sammeln. Marktwert sinkt.' : 'Will den Verein verlassen. Marktwert sinkt.', actions: warnBtn('Zum Kader', toSquad), prio: 3 }));
  // 3) Vereinsnachrichten (inkl. Vorstand)
  (CLUB.news || []).slice(0, 15).forEach(n => {
    items.push({ cat: 'news', icon: (typeof NEWS_ICONS !== 'undefined' && NEWS_ICONS[n.category]) || '<i class="ti ti-news"></i>',
      title: n.title, text: n.text,
      meta: `${seasonYearLabel(n.season)}${n.matchday ? ' · Spieltag ' + n.matchday : ''}`,
      prio: 0, ts: n.ts || 0 });
  });
  return items;
}
// Führende Emojis aus News-Titeln entfernen (das Kategorie-Icon links ersetzt sie).
function stripLeadEmoji(s) {
  return (typeof s === 'string') ? s.replace(/^(?:\p{Extended_Pictographic}|️|‍|\s)+/u, '').trim() : s;
}
function setMailFilter(f) { window.MAIL_FILTER = f; renderPostfach(); }
function renderPostfach() {
  const el = document.getElementById('postfach-list');
  if (!el) return;
  const items = buildPostfachItems();
  const filter = window.MAIL_FILTER || 'all';
  const counts = {
    all: items.length,
    offer: items.filter(i => i.cat === 'offer').length,
    warn: items.filter(i => i.cat === 'warn').length,
    news: items.filter(i => i.cat === 'news').length
  };
  // Filter-Chips
  const fl = document.getElementById('pf-filters');
  if (fl) {
    const defs = [['all', 'Alle'], ['offer', '<i class="ti ti-inbox"></i> Angebote'], ['warn', '<i class="ti ti-alert-triangle"></i> Wichtig'], ['news', '<i class="ti ti-news"></i> News']];
    fl.innerHTML = defs.map(d => {
      const c = counts[d[0]];
      return `<button class="pf-chip ${filter === d[0] ? 'active' : ''}" onclick="setMailFilter('${d[0]}')">${d[1]}${c ? ` <span class="pf-cnt">${c}</span>` : ''}</button>`;
    }).join('');
  }
  // Unread-Badge (offene Entscheidungen + Warnungen)
  const badge = document.getElementById('pf-unread');
  const urgent = counts.offer + counts.warn;
  if (badge) { badge.textContent = urgent ? urgent : ''; badge.style.display = urgent ? '' : 'none'; }
  // Sortierung: Angebote & Warnungen zuerst (nach prio), dann News (nach Aktualität)
  const shown = items.filter(i => filter === 'all' || i.cat === filter)
    .sort((a, b) => (b.prio - a.prio) || ((b.ts || 0) - (a.ts || 0)));
  if (!shown.length) {
    el.innerHTML = `<div class="pf-empty">✓ Posteingang leer — keine ${filter === 'offer' ? 'Angebote' : filter === 'warn' ? 'Warnungen' : filter === 'news' ? 'Nachrichten' : 'Einträge'}.</div>`;
    return;
  }
  // Nutzer 2026-10-22: überflüssiger Text raus: Einträge ohne Text bekommen keine leere Textzeile
  el.innerHTML = shown.map(i =>
    `<div class="pf-item pf-${i.cat}">
       <div class="pf-ico">${i.icon}</div>
       <div class="pf-body">
         <div class="pf-title">${stripLeadEmoji(i.title)}</div>
         ${i.text ? `<div class="pf-text">${i.text}</div>` : ''}
         ${i.meta ? `<div class="pf-meta">${i.meta}</div>` : ''}
       </div>
       ${i.actions ? `<div class="pf-actions">${i.actions}</div>` : ''}
     </div>`
  ).join('');
}
function renderHomeTab() {
  if (!LEAGUE) return;
  const fg = findFcmGroup(LEAGUE);
  const nameEl = document.getElementById('hc-club-name'); if (nameEl) nameEl.textContent = clubName();
  const badgeEl = document.getElementById('hc-badge'); if (badgeEl) badgeEl.textContent = clubShort();
  { const tl = tierLabelOf(fg.tierKey); document.getElementById('hc-tier').innerHTML = (window.flagHTML ? window.flagHTML('Deutschland') + ' ' : '') + tl + (fg.group.name && fg.group.name !== tl ? ' · ' + fg.group.name : ''); }   // Kickstil: Gruppe nur, wenn sie anders heißt (sonst „Dritte Liga · Dritte Liga“)
  const friendlyFix = fcmFriendlyThisWeek(LEAGUE);
  const cupFix = CUP ? fcmCupFixture(CUP) : null;
  const ligaFix = fcmNextFixture(LEAGUE);
  // Hero-Spielkarte (Heim vs. Auswärts). Gegnername + Wettbewerb + Ort ermitteln.
  let oppName = '—', compTxt = '', venueTxt = '', oppId = null;
  if (friendlyFix) {
    const opp = friendlyOpponentTeam(LEAGUE, friendlyFix.opponentId);
    oppName = opp ? opp.name : friendlyFix.opponentName;
    oppId = friendlyFix.opponentId;
    compTxt = 'Testspiel'; venueTxt = friendlyFix.isHome ? 'Heim' : 'Auswärts';
  } else if (cupFix) {
    oppName = cupFix.opponent.name;
    oppId = cupFix.opponent && cupFix.opponent.id;
    compTxt = 'DFB-Pokal · ' + cupFix.roundName; venueTxt = cupFix.isHome ? 'Heim' : 'Auswärts';
  } else if (ligaFix) {
    const opp = fg.group.teams.find(t => t.id === ligaFix.opponentId);
    oppName = opp.name;
    oppId = ligaFix.opponentId;
    compTxt = 'Liga · ST ' + ligaFix.matchday; venueTxt = ligaFix.isHome ? 'Heim' : 'Auswärts';
  } else {
    oppName = 'Saison beendet'; compTxt = 'Saison'; venueTxt = '';
  }
  const teamInitials = (nm) => {
    if (!nm) return '?';
    const w = nm.replace(/[0-9.]/g, ' ').split(/[\s\-]+/).filter(Boolean);
    const s = w.slice(0, 3).map(x => x[0]).join('');
    return s.toUpperCase().slice(0, 3) || '?';
  };
  const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setTxt('hm-home-crest', teamInitials(clubName()));
  setTxt('hm-home-name', clubName());
  setTxt('hm-away-crest', teamInitials(oppName));
  setTxt('hm-away-name', oppName);
  // Away-Crest in Gegnerfarbe (Heim-Crest bleibt grün = du)
  const awayCrestEl = document.getElementById('hm-away-crest');
  if (awayCrestEl) {
    if (oppId && typeof crestStyle === 'function') awayCrestEl.setAttribute('style', crestStyle(oppId));
    else awayCrestEl.removeAttribute('style');
  }
  setTxt('hm-comp', compTxt);
  setTxt('hm-venue', venueTxt);
  // Countdown zum nächsten Spiel (wochenbasiert)
  let cd = '';
  if (oppName !== 'Saison beendet') {
    const dueNow = (typeof matchdayDueThisWeek === 'function' && matchdayDueThisWeek(LEAGUE) !== -1) || !!friendlyFix;
    if (dueNow) cd = 'diese Woche';
    else if (ligaFix && Array.isArray(LEAGUE.matchWeeks) && LEAGUE.matchWeeks[LEAGUE.matchday] != null) {
      const wks = LEAGUE.matchWeeks[LEAGUE.matchday] - LEAGUE.week;
      cd = wks <= 0 ? 'diese Woche' : `in ${wks} Woche${wks > 1 ? 'n' : ''}`;
    }
  }
  setTxt('hm-countdown', cd);
  const tbl = computeTable(fg.group.teams);
  const pos = tbl.findIndex(t=>t.id==='fcm')+1;
  const fcm = tbl.find(t=>t.id==='fcm');
  document.getElementById('hc-position').textContent = pos + '. Platz';
  document.getElementById('hc-position-sub').textContent = `${fcm.pts} Pkt · ${fcm.played} Spiele · ${fcm.gf}:${fcm.ga} Tore`;
  const hcBudget = document.getElementById('hc-budget');
  if (hcBudget) hcBudget.innerHTML =
    `<span>${formatEuro(CLUB.budget)}</span>` +
    `<br><span style="font-size:10px;color:var(--gold,#d29922)">Gehalt frei: ${formatEuro(CLUB.wageBudget || 0)}/Wo</span>`;
  document.getElementById('hc-squad-size').textContent = SQUAD.filter(p=>!p.onLoanAt).length + ' Spieler';
  renderTasksWidget();
  renderCalendarWidget();
  renderExpectationsSummary();
  renderPostfach();
  // Import-Listener einmalig registrieren (idempotent via Flag)
  const fi = document.getElementById('ingame-import-file');
  if (fi && !fi._listenerAdded) { fi.addEventListener('change', handleInGameImportFile); fi._listenerAdded = true; }
}
function renderCalendarWidget() {
  const el = document.getElementById('calendar-widget'); if(!el || !LEAGUE) return;
  const week = LEAGUE.week;
  const lbl = calendarLabel(week, LEAGUE.startYear);
  const win = transferWindowInfo(week);

  // Status der aktuellen Woche
  const dueNow = matchdayDueThisWeek(LEAGUE) !== -1;
  const friendlyNow = friendlyDueThisWeek(LEAGUE);
  const cupNow = CUP ? fcmCupFixture(CUP) : null;
  let statusNow;
  if (dueNow) statusNow = '<span class="cal-tag cal-match"><i class="ti ti-ball-football"></i> Spieltag</span>';
  else if (cupNow) statusNow = '<span class="cal-tag cal-match"><i class="ti ti-trophy"></i> Pokal</span>';
  else if (friendlyNow) statusNow = '<span class="cal-tag cal-match"><i class="ti ti-friends"></i> Testspiel</span>';
  else if (isBreakWeek(week)) statusNow = '<span class="cal-tag cal-break"><i class="ti ti-bed"></i> Spielfrei</span>';
  else statusNow = '<span class="cal-tag"><i class="ti ti-barbell"></i> Trainingswoche</span>';
  let winTag = '';
  if (win.open) winTag = `<span class="cal-tag cal-window">${win.deadline?'<i class="ti ti-clock"></i> Deadline Day':'<i class="ti ti-coin"></i> '+win.type+'-Fenster'+(win.weeksLeft>0?' ('+win.weeksLeft+' Wo.)':'')}</span>`;

  // Vorschau der nächsten Wochen (einheitlich: Liga + Pokal + Test + Pausen)
  const fg = findFcmGroup(LEAGUE);
  const rows = buildScheduleRows(week, 9);

  el.innerHTML = `
    <div class="cal-head">
      <div><div class="cal-week">${lbl}</div><div class="cal-status">${statusNow} ${winTag}</div></div>
      <button class="cal-next" onclick="nextWeek()">Woche weiter →</button>
    </div>
    <div class="cal-schedule">
      ${rows}
    </div>`;
}

// Baut die Zeilen für die kommenden N Wochen als einheitlichen Terminplan.
function buildScheduleRows(fromWeek, count) {
  const fg = findFcmGroup(LEAGUE);
  const out = [];
  for (let w = fromWeek; w <= Math.min(SEASON_WEEKS, fromWeek + count); w++) {
    const isNow = (w === LEAGUE.week);
    const monthLbl = calendarMonthOfWeek(w);
    const mdIdx = LEAGUE.matchWeeks ? LEAGUE.matchWeeks.indexOf(w) : -1;
    const friendly = (LEAGUE.friendlies || []).find(f => f.week === w && !f.played);
    const win = transferWindowInfo(w);

    let icon = '<i class="ti ti-barbell"></i>', label = 'Training', sub = '', cls = '';
    if (mdIdx !== -1) {
      icon = '<i class="ti ti-ball-football"></i>'; cls = 'sched-match';
      // Gegner des Liga-Spieltags ermitteln (aus dem Spielplan)
      const opp = ligaOpponentForWeek(w, mdIdx, fg);
      label = `Spieltag ${mdIdx + 1}`;
      sub = opp ? `${opp.isHome ? 'gegen' : 'bei'} ${opp.name}` : '';
    } else if (friendly) {
      icon = '<i class="ti ti-friends"></i>'; cls = 'sched-friendly';
      const opp = friendlyOpponentTeam(LEAGUE, friendly.opponentId);
      label = 'Testspiel';
      sub = opp ? `${friendly.isHome ? 'gegen' : 'bei'} ${opp.name}` : '';
    } else if (isBreakWeek(w)) {
      icon = '<i class="ti ti-bed"></i>'; label = 'Spielfrei'; cls = 'sched-break';
    }

    // Pokal an seiner FESTEN Woche: fällt er mit einem Liga-/Testspiel zusammen →
    // Badge an die Zeile (Doppelbelastung); sonst eigene Pokalzeile (z.B. Finale).
    let cupBadge = '';
    const cupWk = (CUP && typeof fcmInCup === 'function' && fcmInCup()) ? cupWeekFor(CUP.roundIndex) : -1;
    if (w === cupWk) {
      if (mdIdx !== -1 || friendly) {
        cupBadge = ` <span class="sched-cup-badge"><i class="ti ti-trophy"></i> ${ROUND_NAMES[CUP.roundIndex] || 'Pokal'}</span>`;
      } else {
        icon = '<i class="ti ti-trophy"></i>'; label = 'Pokal'; cls = 'sched-cup';
        sub = ROUND_NAMES[CUP.roundIndex] || 'Pokal';
      }
    }

    const winBadge = win.open ? `<span class="sched-win">${win.deadline ? '<i class="ti ti-clock"></i>' : '<i class="ti ti-coin"></i>'}</span>` : '';

    out.push(`<div class="sched-row ${cls} ${isNow ? 'sched-now' : ''}">
      <span class="sched-wk">${monthLbl.slice(0,3)} · KW${w}</span>
      <span class="sched-ico">${icon}</span>
      <span class="sched-lbl">${label}${cupBadge}${sub ? ` <span class="sched-sub">${sub}</span>` : ''}</span>
      ${winBadge}
    </div>`);
  }
  return out.join('');
}

// Ermittelt den Liga-Gegner für eine bestimmte Spieltag-Woche.
function ligaOpponentForWeek(week, mdIdx, fg) {
  try {
    const fixtures = LEAGUE.fixtures[fg.key];
    if (!fixtures || !fixtures[mdIdx]) return null;
    const pairing = fixtures[mdIdx].find(p => p.home === 'fcm' || p.away === 'fcm');
    if (!pairing) return null;
    const isHome = pairing.home === 'fcm';
    const oppId = isHome ? pairing.away : pairing.home;
    const opp = fg.group.teams.find(t => t.id === oppId);
    return opp ? { name: opp.name, isHome } : null;
  } catch (e) { return null; }
}

// ═══════════════════════════════════════════════════════════════
// VEREINSHUB: Jugendakademie, Trainingsgelände, Stadionausbau
// ═══════════════════════════════════════════════════════════════
function upgradeFacility(key) {
  const def = FACILITY_DEFS[key];
  const cur = CLUB.facilities[key];
  if (cur >= def.maxLevel) return;
  // Läuft bereits ein Ausbau dieser Anlage?
  if (CLUB.facilityBuilds && CLUB.facilityBuilds[key]) {
    alert('An dieser Anlage wird bereits gebaut! Noch ' + CLUB.facilityBuilds[key].weeksLeft + ' Woche(n).');
    return;
  }
  const cost = def.cost[cur];
  if (CLUB.budget < cost) { alert('Nicht genug Budget! Ausbau kostet ' + formatEuro(cost) + ', verfügbar: ' + formatEuro(CLUB.budget)); return; }
  CLUB.budget -= cost;
  // Bauzeit: steigt mit der Zielstufe. Frühe Stufen wenige Wochen, späte fast ein Jahr.
  const weeks = facilityBuildWeeks(key, cur + 1);
  if (!CLUB.facilityBuilds) CLUB.facilityBuilds = {};
  CLUB.facilityBuilds[key] = { targetLevel: cur + 1, weeksLeft: weeks, totalWeeks: weeks, cost };
  addNews('club', def.name + ': Ausbau gestartet', `Der Verein investiert ${formatEuro(cost)} in den Ausbau auf Stufe ${cur + 1} (${def.levelDesc[cur]}). Die Bauarbeiten dauern ca. ${weeks} Wochen.`);
  renderClubTab(); renderScoutTab(); saveGameState();
}

// Bauzeit in Wochen je nach Anlage und Zielstufe (realistisch: höher = länger).
function facilityBuildWeeks(key, targetLevel) {
  // Grundzeit pro Anlage + Zuschlag pro Stufe (quadratisch steigend)
  const base = { stadium: 6, youth: 4, training: 4, scouting: 3 }[key] || 4;
  const perLevel = Math.round(Math.pow(targetLevel, 1.7) * 1.1);
  return Math.min(46, base + perLevel);   // Deckel bei ~46 Wochen (knapp ein Jahr)
}

// Pro Woche aufrufen: laufende Bauten voranbringen, fertige aktivieren.
function tickFacilityBuilds() {
  if (!CLUB.facilityBuilds) return;
  Object.keys(CLUB.facilityBuilds).forEach(key => {
    const b = CLUB.facilityBuilds[key];
    if (!b) return;
    b.weeksLeft--;
    if (b.weeksLeft <= 0) {
      CLUB.facilities[key] = b.targetLevel;
      const def = FACILITY_DEFS[key];
      if (key === 'stadium') { CLUB.stadiumCapacity = stadiumCapacityForLevel(CLUB.facilities[key]); if (CLUB.sponsors && !CLUB.sponsors.stadium) refreshSponsorOffers(); }
      if (key === 'scouting') refreshMarketForScouting();
      const newLvl = CLUB.facilities[key];
      const tierUp = Math.floor((newLvl - 1) / 3) > Math.floor((newLvl - 2) / 3);
      addNews('club', def.name + ' fertiggestellt!', `Der Ausbau auf Stufe ${newLvl} (${def.levelDesc[newLvl - 1]}) ist abgeschlossen.${tierUp ? ' Die Anlage wurde sichtbar modernisiert!' : ''}`);
      delete CLUB.facilityBuilds[key];
      if (typeof renderClubTab === 'function') renderClubTab();
      if (typeof renderScoutTab === 'function') renderScoutTab();
    }
  });
  saveGameState();
}
// Visueller Ausbaugrad: alle 3 Stufen ein moderneres Bild (Tier 0-3)
// Erzeugt das HTML für eine einzelne Ausbau-Karte (Stadion/Training/Jugend/Scouting).
// Bei der Jugendakademie wird zusätzlich die aktuelle Talent-Liste eingehängt.
function renderFacilityCard(key) {
  const def = FACILITY_DEFS[key];
  if (!def) return '';
  const cur = CLUB.facilities[key];
  const maxed = cur >= def.maxLevel;
  const cost = maxed ? null : def.cost[cur];
  let extraStat = '';
  if (key === 'stadium') {
    extraStat = `<div class="fc-stat"><span>Kapazität</span><b>${stadiumCapacityForLevel(cur).toLocaleString('de-DE')}</b></div><div class="fc-stat"><span>Einnahmen/Heimspiel</span><b>${formatEuro(matchAttendanceIncome().total)}</b></div><div class="fc-stat"><span>Bannerplätze</span><b>${bannerSlotsForStadium(cur)}</b></div>`;
  } else if (key === 'youth') {
    const cap = youthCapacityForLevel(cur);
    const used = (CLUB.youthProspects && CLUB.youthProspects.length) || 0;
    extraStat = `<div class="fc-stat"><span>Talent-Niveau</span><b>OVR ~${50 + cur*4}</b></div><div class="fc-stat"><span>Nachwuchsplätze</span><b>${used}/${cap} belegt</b></div>`;
  } else if (key === 'training') {
    extraStat = `<div class="fc-stat"><span>Entwicklungs-Bonus</span><b>+${cur*5}%</b></div>`;
  } else if (key === 'scouting') {
    const reach = scoutingReach(cur);
    extraStat = `<div class="fc-stat"><span>Max. Spielerstärke</span><b>OVR ${reach.maxOvr}</b></div><div class="fc-stat"><span>Top-Potenzial</span><b>bis ${reach.maxPot}</b></div><div class="fc-stat"><span>Internationale Spieler</span><b>${reach.intlPct}%</b></div>`;
  } else if (key === 'merchandising') {
    const weekly = (typeof merchandisingIncome === 'function') ? merchandisingIncome() : 0;
    const perMatch = (typeof merchIncomePerMatch === 'function') ? merchIncomePerMatch() : 0;
    extraStat = `<div class="fc-stat"><span>Einnahmen/Woche</span><b style="color:var(--green,#3fb950)">+${formatEuro(weekly)}</b></div><div class="fc-stat"><span>Extra pro Heimspiel</span><b>+${formatEuro(perMatch)}</b></div>`;
  }
  let prospects = '';
  if (key === 'youth') {
    const cap = youthCapacityForLevel(cur);
    const list = (CLUB.youthProspects && CLUB.youthProspects.length) ? CLUB.youthProspects : [];
    const rows = list.map(p => {
      const canPromote = (p.age||0) >= 16;
      const promoteBtn = canPromote
        ? `<button class="mkt-btn" onclick="promoteProspect('${p.id}')">Hochziehen</button>`
        : `<button class="mkt-btn secondary" disabled title="Erst ab 16 Jahren">Ab 16</button>`;
      return `<div class="prospect-row">
        <span class="pos-badge-sm pos-${p.pos}">${positionsDisplay(p)}</span>
        <span class="market-name" style="flex:1">${p.flag?p.flag+' ':''}${displayName(p)}</span>
        <span style="color:var(--text2)">${p.age}J · ${potentialDisplay(p, CLUB.facilities.scouting||1)}</span>
        <span style="display:flex;gap:4px">${promoteBtn}<button class="mkt-btn danger" onclick="releaseProspect('${p.id}')" title="Talent entlassen">✕</button></span>
      </div>`;
    }).join('');
    const header = `<div class="hc-label" style="margin-bottom:6px;display:flex;justify-content:space-between"><span>Aktuelle Talente</span><span style="color:var(--text3)">${list.length}/${cap} Plätze</span></div>`;
    const body = list.length
      ? rows
      : '<div style="font-size:10px;color:var(--text3)">Neue Talente kommen am Saisonende aus der Akademie.</div>';
    const hint = (list.length >= cap)
      ? '<div style="font-size:10px;color:var(--gold,#d29922);margin-top:6px">Akademie voll</div>'
      : '';
    prospects = `<div class="youth-prospects">${header}${body}${hint}</div>`;
  }
  return `<div class="facility-card">
      <div class="fc-img-wrap">${facilityImage(key, cur)}<span class="fc-tier-tag">${['Basis','Ausgebaut','Modern','Weltklasse'][facilityTier(cur)]}</span></div>
      <div class="fc-head"><div class="fc-icon ${def.iconClass}">${def.icon}</div><div style="flex:1"><div class="fc-name">${def.name}</div><div class="fc-level">Stufe ${cur}/${def.maxLevel} · ${def.levelDesc[cur-1]}</div></div></div>
      ${levelBar(cur, def.maxLevel)}
      <div class="fc-desc">${def.desc}</div>
      ${extraStat}
      ${(() => {
        const build = CLUB.facilityBuilds && CLUB.facilityBuilds[key];
        if (build) {
          const done = build.totalWeeks - build.weeksLeft;
          const pct = Math.round((done / build.totalWeeks) * 100);
          return `<div class="fc-building">
            <div style="font-size:10px;color:var(--gold,#d29922);font-weight:700;margin-bottom:4px">🏗️ Ausbau auf Stufe ${build.targetLevel} läuft — noch ${build.weeksLeft} Woche(n)</div>
            <div style="background:var(--bg3,#21262d);border-radius:6px;height:8px;overflow:hidden">
              <div style="width:${pct}%;height:100%;background:var(--gold,#d29922)"></div>
            </div></div>`;
        }
        return maxed
          ? '<div class="fc-maxed">✓ Maximal ausgebaut</div>'
          : `${facilityRoi(key, cur, def)}<button class="fc-upgrade" ${CLUB.budget < cost ? 'disabled' : ''} onclick="upgradeFacility('${key}')">Ausbauen — ${formatEuro(cost)}</button>`;
      })()}
      ${prospects}
    </div>`;
}
function renderContractsSection() {
  const own = SQUAD.filter(p => !p.onLoanFrom);
  const wages = totalWeeklyWages(SQUAD);
  // sortiert: auslaufende zuerst, dann nach Vertragsende
  const sorted = [...own].sort((a,b) => (b.expiring?1:0)-(a.expiring?1:0) || (a.contractUntil||99)-(b.contractUntil||99));
  const rows = sorted.map(p => {
    const exp = p.expiring;
    const until = p.contractUntil != null ? `${seasonEndYear(p.contractUntil)}` : '—';
    const yearsLeft = p.contractUntil != null ? Math.max(0, p.contractUntil - LEAGUE.season) : 0;
    const statusCol = exp ? '#f85149' : (yearsLeft<=1 ? '#d29922' : 'var(--text2,#8b949e)');
    const btns = exp
      ? `<button class="mkt-btn" onclick="renewContract('${p.id}')">Verlängern</button><button class="mkt-btn danger" onclick="releaseExpiringPlayer('${p.id}')">Gehen lassen</button>`
      : `<button class="mkt-btn secondary" onclick="renewContract('${p.id}')">Verlängern</button>`;
    return `<div class="prospect-row" style="${exp?'background:rgba(248,81,73,.08);border-radius:6px;':''}">
        <span class="pos-badge-sm pos-${p.pos}">${positionsDisplay(p)}</span>
        <span class="market-name" style="flex:1">${p.flag?p.flag+' ':''}${displayName(p)} <span style="color:var(--text3);font-size:9px">OVR ${p.ovr}</span></span>
        <span style="color:${statusCol};font-size:10px;text-align:right;min-width:96px">${exp?'⚠ ausgelaufen':until}<br><span style="color:var(--text3)">${formatEuro(p.wage||0)}/Wo</span></span>
        <span style="display:flex;gap:4px">${btns}</span>
      </div>`;
  }).join('');
  return `<div class="facility-card" style="margin-top:4px">
      <div class="fc-head"><div class="fc-icon" style="background:#1f6feb33">📄</div><div style="flex:1"><div class="fc-name">Spielerverträge</div><div class="fc-level">Gehaltssumme ${formatEuro(wages)}/Woche · max. ${MAX_CONTRACT_YEARS} Jahre Laufzeit</div></div></div>
      <div class="youth-prospects">${rows || '<div style="font-size:10px;color:var(--text3)">Keine Spieler.</div>'}</div>
    </div>`;
}
// ROI-Hinweis für die nächste Ausbaustufe einer Anlage (was sie bringt).
function facilityRoi(key, cur, def) {
  const nextDesc = (def && def.levelDesc && def.levelDesc[cur]) ? def.levelDesc[cur] : null;
  let benefit = '';
  if (key === 'stadium') {
    try {
      const add = stadiumCapacityForLevel(cur + 1) - stadiumCapacityForLevel(cur);
      if (add > 0) benefit = '+' + add.toLocaleString('de-DE') + ' Plätze → mehr Ticketeinnahmen je Heimspiel';
    } catch (e) {}
  } else if (key === 'training') benefit = 'Schnellere Entwicklung & bessere Fitness-Erholung';
  else if (key === 'scouting') benefit = 'Stärkere & internationalere Talente auf dem Markt';
  else if (key === 'youth') benefit = 'Bessere Nachwuchstalente aus der Akademie';
  else if (key === 'merchandising') benefit = 'Höhere Fanshop-Einnahmen';
  const parts = [];
  if (nextDesc) parts.push('Stufe ' + (cur + 1) + ': ' + nextDesc);
  if (benefit) parts.push(benefit);
  if (!parts.length) return '';
  return `<div class="fc-roi"><span class="fc-roi-ico"><i class="ti ti-trending-up"></i></span>${parts.join(' · ')}</div>`;
}
function renderClubTab() {
  if (!LEAGUE) return;
  const banner = document.getElementById('club-banner');
  if (banner) banner.innerHTML = `<div>Vereinsfinanzen: <span class="budget-amount">${formatEuro(CLUB.budget)}</span></div><div style="font-size:11px;color:var(--text2)">🏟️ ${stadiumName()} · ${stadiumCapacityForLevel(CLUB.facilities.stadium).toLocaleString('de-DE')} Plätze · Tickets ~${formatEuro(matchAttendanceIncome().total)} + Merch ~${formatEuro(merchIncomePerMatch())}/Heimspiel · 📢 ${formatEuro(bannerIncomePerSeason())}/Saison</div>`;
  const el = document.getElementById('club-facilities'); if(!el) return;
  // Verein-Tab zeigt nur noch Trainingsgelände und Stadion.
  // Jugendakademie, Scouting und Verträge sind in den Tab „Nachwuchs & Scouting" gewandert.
  el.innerHTML = renderDualBudgetWidget() + ['training','stadium','merchandising'].map(key => renderFacilityCard(key)).join('');
  renderFinancePanel();
  renderExpectationsPanel();
  renderSponsors();
  renderInvestPanel();
  renderDangerZone();
}

// ── SPIELSTAND-VERWALTUNG (In-Game) ──────────────────────────
function renderSavePanel() {
  let el = document.getElementById('club-save-panel');
  if (!el) {
    const host = document.getElementById('club-danger-zone');
    if (!host || !host.parentNode) return;
    el = document.createElement('div');
    el.id = 'club-save-panel';
    host.parentNode.insertBefore(el, host);
  }
  // Gespeichert-Zeitstempel aus dem aktiven Slot holen (async, daher Platzhalter zuerst)
  el.style.cssText = 'margin-top:22px;padding:16px;border:1px solid var(--border,#30363d);border-radius:10px;background:var(--bg2,#161b22)';
  // Nutzer 2026-10-22: überflüssiger Text raus („Exportiere deinen Spielstand als JSON-Datei …“ – die Knöpfe sagen es)
  el.innerHTML = `
    <div style="font-weight:700;color:var(--text,#e6edf3);margin-bottom:4px;font-size:13px">💾 Spielstand</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
      <button onclick="inGameExport()" style="flex:1;min-width:120px;padding:9px 14px;border-radius:7px;background:var(--accent,#238636);color:#fff;font-size:12px;font-weight:600;border:none;cursor:pointer">
        ⬇️ Als JSON exportieren
      </button>
      <button onclick="inGameImport()" style="flex:1;min-width:120px;padding:9px 14px;border-radius:7px;background:var(--bg3,#21262d);color:var(--text,#e6edf3);font-size:12px;font-weight:600;border:1px solid var(--border,#30363d);cursor:pointer">
        ⬆️ JSON importieren
      </button>
    </div>
    <input type="file" id="ingame-import-file" accept="application/json,.json" style="display:none">
    <div id="save-panel-status" style="margin-top:10px;font-size:10px;color:var(--text3,#6e7681)"></div>`;

  const fi = document.getElementById('ingame-import-file');
  if (fi) fi.addEventListener('change', handleInGameImportFile);
}

async function inGameExport() {
  if (!ACTIVE_SLOT_ID) { alert('Kein aktiver Spielstand gefunden.'); return; }
  const status = document.getElementById('save-panel-status');
  if (status) status.textContent = 'Exportiere…';
  try {
    await exportSlotToFile(ACTIVE_SLOT_ID);
    if (status) status.textContent = '✅ Datei wurde heruntergeladen.';
    setTimeout(() => { if (status) status.textContent = ''; }, 4000);
  } catch(e) {
    if (status) status.textContent = '❌ Export fehlgeschlagen.';
  }
}

function inGameImport() {
  const fi = document.getElementById('ingame-import-file');
  if (fi) fi.click();
}

async function handleInGameImportFile(ev) {
  const file = ev.target.files && ev.target.files[0];
  if (!file) return;
  const status = document.getElementById('save-panel-status');
  if (!confirm(`Spielstand aus „${file.name}" importieren und sofort laden? Der aktuelle Stand wird dabei gespeichert und bleibt als separater Eintrag erhalten.`)) {
    ev.target.value = '';
    return;
  }
  try {
    if (status) status.textContent = 'Lese Datei…';
    const text = await file.text();
    const obj = JSON.parse(text);
    if (!obj || !obj.league || !obj.cup) { alert('Diese Datei ist kein gültiger Spielstand.'); ev.target.value = ''; return; }
    if (status) status.textContent = 'Importiere Spielstand…';
    // Aktuellen Stand sichern, damit er nicht verloren geht
    await saveGameState();
    const newId = await importSaveObject(obj, obj.name);
    if (!newId) { alert('Import fehlgeschlagen.'); ev.target.value = ''; return; }
    // Importierten Slot direkt laden
    const ok = await loadSlot(newId);
    if (!ok) { alert('Spielstand wurde importiert, konnte aber nicht geladen werden. Bitte über das Hauptmenü laden.'); ev.target.value = ''; return; }
    if (status) status.textContent = '✅ Spielstand importiert und geladen!';
    // UI vollständig neu aufbauen
    if (typeof _afterLoad === 'function') _afterLoad();
    else { renderAll(); renderHomeTab(); renderClubTab(); renderLeagueTab(); renderTransferTab(); renderScoutTab(); }
    ev.target.value = '';
    setTimeout(() => { if (status) status.textContent = ''; }, 4000);
  } catch(e) {
    alert('Die Datei konnte nicht gelesen werden. Ist es eine gültige JSON-Spielstand-Datei?');
    if (status) status.textContent = '❌ Import fehlgeschlagen.';
    ev.target.value = '';
  }
}

// ── NEU STARTEN ──────────────────────────────────────────────
function renderDangerZone() {
  let el = document.getElementById('club-danger-zone');
  if (!el) {
    // Falls kein fester Container existiert, an den Facilities-Bereich anhängen
    const host = document.getElementById('club-facilities');
    if (!host || !host.parentNode) return;
    el = document.createElement('div');
    el.id = 'club-danger-zone';
    host.parentNode.appendChild(el);
  }
  el.style.cssText = 'margin-top:22px;padding:16px;border:1px solid var(--red,#c0392b);border-radius:10px;background:rgba(192,57,43,0.06)';
  el.innerHTML = `
    <div style="font-weight:700;color:var(--red,#c0392b);margin-bottom:4px">Spiel neu starten</div>
    <div style="font-size:11px;color:var(--text2);margin-bottom:11px">Löscht den Spielstand unwiderruflich.</div>
    <button class="fc-upgrade" style="width:auto;padding:9px 16px;background:var(--red,#c0392b);border-color:var(--red,#c0392b)" onclick="restartGame()">Spiel neu starten</button>`;
}

async function restartGame() {
  if (!confirm('Wirklich neu starten? Der gesamte aktuelle Spielstand (Verein, Kader, Tabellen, Finanzen) wird dauerhaft gelöscht.')) return;
  if (!confirm('Letzte Bestätigung: Dieser Schritt kann NICHT rückgängig gemacht werden. Fortfahren?')) return;
  await resetGameStorage();
  // In-Memory-Zustand neutralisieren, damit kein alter Kader durchblitzt
  LEAGUE = null; CUP = null; MARKET = null;
  ACTIVE_SLOT_ID = null;
  await showOnboarding();
}

function renderSponsors() {
  const el = document.getElementById('sponsor-grid'); if(!el) return;
  if (!CLUB.sponsorOffers) refreshSponsorOffers();
  const cards = [
    // Nutzer 2026-10-22: überflüssiger Text raus (Trikot/Ärmel: „Logo auf der Trikotbrust.“ / „Logo auf dem Trikotärmel.“)
    { type:'shirt', icon:'<i class="ti ti-shirt"></i>', label:'Trikotsponsor', desc:'' },
    { type:'sleeve', icon:'<i class="ti ti-shirt-sport"></i>', label:'Ärmelsponsor', desc:'' },
    { type:'stadium', icon:'<i class="ti ti-building-stadium"></i>', label:'Stadionname (Naming Rights)', desc:'Verkauft den Namen deines Stadions. Fester Jahresbetrag plus Erfolgsboni.' }
  ];
  const bonusLine = (b) => {
    if (!b) return '';
    const parts = [];
    if (b.promotion) parts.push(`Aufstieg +${formatEuro(b.promotion)}`);
    if (b.top3) parts.push(`Top-3 +${formatEuro(b.top3)}`);
    if (b.cup) parts.push(`Pokal-HF +${formatEuro(b.cup)}`);
    return parts.length ? `<div class="sp-bonus"><i class="ti ti-target"></i> ${parts.join(' · ')}</div>` : '';
  };
  el.innerHTML = cards.map(c => {
    const active = CLUB.sponsors[c.type];
    let inner;
    if (active) {
      inner = `<div class="sp-active">
        <div class="sp-active-name">${active.name}${active.profileLabel?` <span class="sp-profile">${active.profileLabel}</span>`:''}</div>
        <div class="sp-active-detail">${formatEuro(active.perYear)} pro Saison · ${active.duration}-Jahres-Vertrag</div>
        <span class="sp-active-badge">Noch ${active.yearsLeft} Saison${active.yearsLeft===1?'':'s'} aktiv</span>
        ${bonusLine(active.bonuses)}
        ${c.type==='stadium'?`<div class="sp-active-detail" style="margin-top:6px">Stadion: <b style="color:var(--text)">${stadiumName()}</b></div>`:''}
      </div>`;   // Satz „Ein neuer Vertrag ist möglich, sobald dieser ausläuft.“ raus (Nutzer 2026-10-22: sinnloser Text)
    } else if (c.type === 'stadium' && !stadiumSponsorUnlocked()) {
      const lvl = CLUB.facilities.stadium || 1;
      inner = `<div class="sp-locked-note" style="padding:10px 0">🔒 Namensrechte werden ab Stadion-Stufe ${STADIUM_SPONSOR_MIN_LEVEL} freigeschaltet (aktuell Stufe ${lvl}). Größere Stadien erzielen außerdem höhere Sponsorensummen.</div>`;
    } else {
      const offers = CLUB.sponsorOffers[c.type] || [];
      inner = offers.map(o => `<div class="sp-offer">
        <div class="sp-offer-info">
          <div class="sp-offer-name">${o.name}${o.profileLabel?` <span class="sp-profile">${o.profileLabel}</span>`:''}</div>
          <div class="sp-offer-terms">${formatEuro(o.perYear)}/Saison · ${o.duration} Jahre</div>
          ${bonusLine(o.bonuses)}
        </div>
        <button class="sp-sign-btn" onclick="signSponsor('${c.type}','${o.id}')">Unterschreiben</button>
      </div>`).join('');
    }
    return `<div class="sponsor-card">
      <div class="sp-head"><div class="sp-icon">${c.icon}</div><div><div class="fc-name">${c.label}</div></div></div>
      ${c.desc ? `<div class="fc-desc">${c.desc}</div>` : ''}
      ${inner}
    </div>`;
  }).join('');
}

// ── FINANZEN: TICKETPREISE, DAUERKARTEN, BANNER ────────────────
const PRICE_LEVEL_LABELS = ['Günstig −−', 'Günstig −', 'Standard', 'Teuer +', 'Premium ++'];

function setTicketLevel(delta) {
  CLUB.ticketLevel = Math.max(-2, Math.min(2, (CLUB.ticketLevel||0) + delta));
  renderFinancePanel(); syncClubToTeams(); saveGameState();
}
function setSeasonTicketLevel(delta) {
  CLUB.seasonTicketLevel = Math.max(-2, Math.min(2, (CLUB.seasonTicketLevel||0) + delta));
  renderFinancePanel(); saveGameState();
}
function setBannerSlots(delta) {
  const max = bannerSlotsForStadium(CLUB.facilities.stadium);
  const cur = bannerSlotsSold();
  CLUB.bannerSlotsSold = Math.max(0, Math.min(max, cur + delta));
  renderFinancePanel(); saveGameState();
}

// ── DUAL-BUDGET-WIDGET & UMSCHICHT-FUNKTIONEN ─────────────────────
// wageBudget = freie Gehaltskapazität (wageCap - laufende Gehälter).
// Umrechnung Transfer → Gehaltsraum: 52€ Transferbudget = 1€/Woche (÷52 Saison-Wochen).
const WAGE_CONV = 52;
function renderDualBudgetWidget() {
  if (!LEAGUE) return '';
  const wages = totalWeeklyWages(SQUAD);
  const wageCap = CLUB.wageCap || 0;
  const wageFree = CLUB.wageBudget || 0;
  const wageOverrun = wageFree < 0;
  const usedPct = wageCap > 0 ? Math.min(100, Math.round((wages / wageCap) * 100)) : 0;
  const barColor = usedPct > 90 ? 'var(--red,#f85149)' : usedPct > 70 ? 'var(--gold,#d29922)' : 'var(--green,#3fb950)';
  const maxShiftWeekly = Math.max(0, Math.floor((CLUB.budget || 0) / WAGE_CONV));
  if (CLUB._wageShiftSlider == null) CLUB._wageShiftSlider = 0;
  CLUB._wageShiftSlider = Math.min(CLUB._wageShiftSlider, maxShiftWeekly);
  const sliderCost = (CLUB._wageShiftSlider || 0) * WAGE_CONV;
  const shiftSection = maxShiftWeekly > 0 ? `
    <div style="padding:10px 12px;background:var(--bg3,#21262d);border-radius:8px;border:1px solid var(--border,#30363d)">
      <div style="font-size:10px;color:var(--text2,#8b949e);margin-bottom:6px">🔀 Transferbudget → Gehaltsraum <span style="color:var(--text3)">(÷52 Wochen: 52€ = 1€/Woche)</span></div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
        <input type="range" id="wage-shift-slider" min="0" max="${maxShiftWeekly}" step="1" value="${CLUB._wageShiftSlider}"
          oninput="CLUB._wageShiftSlider=+this.value;
            document.getElementById('wss-weekly').textContent=(this.value>0?'+'+formatEuro(+this.value)+'/Wo':'0€/Wo');
            document.getElementById('wss-cost').textContent=(this.value>0?formatEuro(this.value*${WAGE_CONV})+' Transferbudget':'—')"
          style="flex:1;accent-color:var(--gold,#d29922)">
        <div style="text-align:right;min-width:120px">
          <div id="wss-weekly" style="font-size:12px;font-weight:700;color:var(--gold)">${CLUB._wageShiftSlider > 0 ? '+'+formatEuro(CLUB._wageShiftSlider)+'/Wo' : '0€/Wo'}</div>
          <div id="wss-cost" style="font-size:10px;color:var(--text3)">${CLUB._wageShiftSlider > 0 ? formatEuro(sliderCost)+' Transferbudget' : '—'}</div>
        </div>
      </div>
      <button onclick="shiftTransferToWage(CLUB._wageShiftSlider||0)"
        style="width:100%;padding:7px;border-radius:6px;background:var(--gold,#d29922);color:#000;border:none;cursor:${maxShiftWeekly>0?'pointer':'not-allowed'};font-size:12px;font-weight:700">
        → Gehaltsraum freikaufen
      </button>
    </div>` : '';
  return `
  <div style="display:flex;flex-direction:column;gap:10px;padding:14px;background:var(--bg2,#161b22);border:1px solid var(--border,#30363d);border-radius:10px;margin-bottom:14px">
    <div style="font-size:13px;font-weight:700;color:var(--text,#e6edf3)">💰 Finanzen</div>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <div style="flex:1;min-width:160px;padding:10px 12px;background:var(--bg3,#21262d);border-radius:8px;border:1px solid ${CLUB.budget>=0?'var(--border,#30363d)':'var(--red,#f85149)'}">
        <div style="font-size:10px;color:var(--text2,#8b949e);margin-bottom:3px">Transferbudget</div>
        <div style="font-size:19px;font-weight:700;color:${CLUB.budget>=0?'var(--green,#3fb950)':'var(--red,#f85149)'}">${formatEuro(CLUB.budget)}</div>
        <div style="font-size:9px;color:var(--text3,#6e7681);margin-top:2px">Ablösen · Infrastruktur · Aktien · Sponsoren</div>
      </div>
      <div style="flex:1;min-width:160px;padding:10px 12px;background:var(--bg3,#21262d);border-radius:8px;border:1px solid ${wageOverrun?'var(--red,#f85149)':'var(--border,#30363d)'}">
        <div style="font-size:10px;color:var(--text2,#8b949e);margin-bottom:3px">Freies Gehaltsbudget</div>
        <div style="font-size:19px;font-weight:700;color:${wageOverrun?'var(--red,#f85149)':'var(--gold,#d29922)'}">${formatEuro(wageFree)}<span style="font-size:11px;font-weight:400;color:var(--text3)">/Wo</span></div>
        <div style="font-size:9px;color:var(--text3,#6e7681);margin-top:4px">Laufend: ${formatEuro(wages)}/Wo · Limit: ${formatEuro(wageCap)}/Wo</div>
        <div style="margin-top:6px;height:4px;background:var(--bg4,#30363d);border-radius:2px">
          <div style="height:4px;border-radius:2px;background:${barColor};width:${usedPct}%;transition:width .3s"></div>
        </div>
        <div style="font-size:9px;color:var(--text3);margin-top:3px">${usedPct}% ausgelastet</div>
      </div>
    </div>
    ${shiftSection}
    <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text3,#6e7681)">
      <span>Wochenlohn Kader: <b style="color:var(--text2)">${formatEuro(wages)}</b></span>
      <span>Freie Kapazität: <b style="color:${wageFree>0?'var(--gold)':'var(--red)'}">${formatEuro(wageFree)}/Wo</b></span>
    </div>
  </div>`;
}
function shiftTransferToWage(weeklyWage) {
  weeklyWage = Math.floor(+weeklyWage);
  if (!weeklyWage || weeklyWage <= 0) return;
  const cost = weeklyWage * WAGE_CONV;
  if ((CLUB.budget || 0) < cost) { alert('Nicht genug Transferbudget. Benötigt: ' + formatEuro(cost)); return; }
  CLUB.budget -= cost;
  CLUB.wageCap = (CLUB.wageCap || 0) + weeklyWage;
  CLUB.wageBudget = Math.max(0, CLUB.wageCap - totalWeeklyWages(SQUAD));
  CLUB._wageShiftSlider = 0;
  addNews('club', '🔀 Gehaltsraum freigekauft', `${formatEuro(cost)} aus dem Transferbudget → +${formatEuro(weeklyWage)}/Woche Gehaltskapazität (neues Limit: ${formatEuro(CLUB.wageCap)}/Woche).`);
  renderClubTab(); renderHomeTab(); saveGameState();
}
function renderFinancePanel() {
  const grid = document.getElementById('sponsor-grid');
  if (!grid) return;
  let panel = document.getElementById('finance-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'finance-panel';
    panel.style.cssText = 'display:flex;flex-direction:column;gap:14px;margin-bottom:18px';
    grid.parentNode.insertBefore(panel, grid);
  }
  const ticketIdx = ticketLevelIndex(CLUB.ticketLevel);
  const seasonIdx = ticketLevelIndex(CLUB.seasonTicketLevel);
  const fill = stadiumFillRate();
  const cap = stadiumCapacityForLevel(CLUB.facilities.stadium);
  const expectedAtt = Math.round(cap * fill);
  const bannerMax = bannerSlotsForStadium(CLUB.facilities.stadium);
  const bannerSold = bannerSlotsSold();
  const bannerPer = bannerValuePerSlot();

  const stepBtn = (fn, d, dis, txt) => `<button class="fc-upgrade" style="width:auto;padding:6px 12px;min-width:36px;${dis?'opacity:.4;cursor:not-allowed':''}" ${dis?'disabled':''} onclick="${fn}(${d})">${txt}</button>`;

  // Nutzer 2026-10-22: überflüssiger Text raus (Merchandise-Unterzeile „Fanartikel rund ums Heimspiel“)
  panel.innerHTML = `
    <div class="facility-card">
      <div class="fc-head"><div class="fc-icon stadium">🎟️</div><div style="flex:1"><div class="fc-name">Ticketpreise</div><div class="fc-level">Tageskarten & Dauerkarten</div></div></div>
      <div class="fc-desc">Mehr pro Zuschauer, etwas weniger Nachfrage.</div>

      <div class="fc-stat" style="align-items:center"><span>Tageskarte</span>
        <div style="display:flex;align-items:center;gap:8px">
          ${stepBtn('setTicketLevel', -1, CLUB.ticketLevel<=-2, '−')}
          <b style="min-width:84px;text-align:center">${currentTicketPrice()} € <span style="font-weight:400;color:var(--text2);font-size:10px">(${PRICE_LEVEL_LABELS[ticketIdx]})</span></b>
          ${stepBtn('setTicketLevel', 1, CLUB.ticketLevel>=2, '+')}
        </div>
      </div>

      <div class="fc-stat" style="align-items:center"><span>Dauerkarte (Saison)</span>
        <div style="display:flex;align-items:center;gap:8px">
          ${stepBtn('setSeasonTicketLevel', -1, CLUB.seasonTicketLevel<=-2, '−')}
          <b style="min-width:84px;text-align:center">${currentSeasonTicketPrice()} € <span style="font-weight:400;color:var(--text2);font-size:10px">(${PRICE_LEVEL_LABELS[seasonIdx]})</span></b>
          ${stepBtn('setSeasonTicketLevel', 1, CLUB.seasonTicketLevel>=2, '+')}
        </div>
      </div>

      <div class="fc-stat"><span>Erwartete Auslastung</span><b>${Math.round(fill*100)}% · ~${expectedAtt.toLocaleString('de-DE')} Zuschauer</b></div>
      <div class="fc-stat"><span>Geschätzte Einnahmen/Heimspiel</span><b>${formatEuro(matchAttendanceIncome().total)}</b></div>
    </div>

    <div class="facility-card">
      <div class="fc-head"><div class="fc-icon stadium">📢</div><div style="flex:1"><div class="fc-name">Bannerwerbung</div><div class="fc-level">${bannerMax} Plätze verfügbar (Stadion Stufe ${CLUB.facilities.stadium})</div></div></div>
      <div class="fc-desc">Auszahlung am Saisonende.</div>
      <div class="fc-stat" style="align-items:center"><span>Verkaufte Plätze</span>
        <div style="display:flex;align-items:center;gap:8px">
          ${stepBtn('setBannerSlots', -1, bannerSold<=0, '−')}
          <b style="min-width:70px;text-align:center">${bannerSold} / ${bannerMax}</b>
          ${stepBtn('setBannerSlots', 1, bannerSold>=bannerMax, '+')}
        </div>
      </div>
      <div class="fc-stat"><span>Wert pro Banner</span><b>${formatEuro(bannerPer)}/Saison</b></div>
      <div class="fc-stat"><span>Bannereinnahmen gesamt</span><b>${formatEuro(bannerIncomePerSeason())}/Saison</b></div>
    </div>

    <div class="facility-card">
      <div class="fc-head"><div class="fc-icon stadium">🧣</div><div style="flex:1"><div class="fc-name">Merchandise</div></div></div>
      <div class="fc-stat"><span>Fanbase</span><b>${fanbaseSize().toLocaleString('de-DE')} Fans</b></div>
      <div class="fc-stat"><span>Umsatz pro Fan</span><b>${MERCH_PER_FAN.toFixed(2).replace('.',',')} €/Heimspiel</b></div>
      <div class="fc-stat"><span>Einnahmen/Heimspiel</span><b>${formatEuro(merchIncomePerMatch())}</b></div>
    </div>`;
}

// ── FINANZANLAGEN: UI-HANDLER ─────────────────────────────────
// Casino (Roulette, Blackjack, Slots) am 2026-10-15 entfernt (Nutzer: „Casino raus“ – Glücksspiel verhindert die
// Store-Freigabe). Geblieben: Tagesgeld und Aktien/ETFs.

function parseStake(inputId) {
  const el = document.getElementById(inputId);
  let v = el ? parseInt((el.value||'').replace(/\D/g,''),10) : NaN;
  return isNaN(v) ? 0 : v;
}

function doDeposit() {
  const amt = parseStake('savings-input');
  if (!depositSavings(amt)) { alert('Betrag ungültig oder nicht genug Budget.'); return; }
  renderInvestPanel(); renderHomeTab(); saveGameState();
}
function doWithdraw() {
  const amt = parseStake('savings-input');
  if (!withdrawSavings(amt)) { alert('Betrag ungültig oder nicht genug Tagesgeld.'); return; }
  renderInvestPanel(); renderHomeTab(); saveGameState();
}

function doBuyStock(id) {
  const shares = parseStake('stock-shares-'+id);
  const r = buyStock(id, shares);
  if (!r) { alert('Kauf nicht möglich (Anteile/Budget prüfen).'); return; }
  renderInvestPanel(); saveGameState();
}
function doSellStock(id) {
  const shares = parseStake('stock-shares-'+id);
  const r = sellStock(id, shares);
  if (r === false) { alert('Verkauf nicht möglich.'); return; }
  renderInvestPanel(); saveGameState();
}

function sparkline(history, up) {
  if (!history || history.length < 2) return '';
  const w = 90, h = 28, n = history.length;
  const min = Math.min(...history), max = Math.max(...history);
  const range = max - min || 1;
  const pts = history.map((v,i) => `${(i/(n-1)*w).toFixed(1)},${(h - (v-min)/range*h).toFixed(1)}`).join(' ');
  const col = up ? 'var(--green,#3fb950)' : 'var(--red,#da3633)';
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block"><polyline points="${pts}" fill="none" stroke="${col}" stroke-width="1.5"/></svg>`;
}

function renderInvestPanel() {
  const grid = document.getElementById('sponsor-grid');
  if (!grid) return;
  ensureMarketStocks();
  let panel = document.getElementById('invest-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'invest-panel';
    panel.style.cssText = 'display:flex;flex-direction:column;gap:14px;margin-top:18px';
    grid.parentNode.insertBefore(panel, grid.nextSibling);
  }

  const savingsCard = `
    <div class="facility-card">
      <div class="fc-head"><div class="fc-icon stadium">🏦</div><div style="flex:1"><div class="fc-name">Tagesgeld</div><div class="fc-level">Sicher · ${savingsAnnualRatePct().toFixed(1).replace('.',',')}% pro Saison</div></div></div>
      <div class="fc-desc">Wöchentliche Zinsen, jederzeit verfügbar.</div>
      <div class="fc-stat"><span>Tagesgeld-Guthaben</span><b>${formatEuro(CLUB.savings||0)}</b></div>
      <div class="fc-stat"><span>Verfügbares Budget</span><b>${formatEuro(CLUB.budget)}</b></div>
      <div style="display:flex;gap:8px;margin-top:8px;align-items:center">
        <input id="savings-input" type="text" inputmode="numeric" placeholder="Betrag €" style="flex:1;background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:8px;font-size:12px">
        <button class="fc-upgrade" style="width:auto;padding:8px 14px" onclick="doDeposit()">Einzahlen</button>
        <button class="fc-upgrade" style="width:auto;padding:8px 14px" onclick="doWithdraw()">Abheben</button>
      </div>
    </div>`;

  const stocks = ensureMarketStocks();
  const stockRows = stocks.map(s => {
    const chg = stockWeekChangePct(s);
    const up = chg >= 0;
    const shares = portfolioShares(s.id);
    const holdVal = shares * s.price;
    return `<div style="border:1px solid var(--border);border-radius:8px;padding:10px;margin-top:8px">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="flex:1">
          <div class="fc-name" style="font-size:13px">${s.name} <span style="color:var(--text3);font-weight:400">${s.ticker}</span></div>
          <div style="font-size:11px;color:var(--text2)">${s.price.toFixed(2).replace('.',',')} € · <span style="color:${up?'var(--green,#3fb950)':'var(--red,#da3633)'}">${up?'▲':'▼'} ${Math.abs(chg).toFixed(1).replace('.',',')}%</span></div>
        </div>
        ${sparkline(s.history, up)}
      </div>
      ${shares>0?`<div style="font-size:11px;color:var(--text2);margin-top:6px">Im Depot: ${shares} Anteile · Wert ${formatEuro(holdVal)}</div>`:''}
      <div style="display:flex;gap:8px;margin-top:8px;align-items:center">
        <input id="stock-shares-${s.id}" type="text" inputmode="numeric" placeholder="Anteile" style="flex:1;background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px;font-size:11px">
        <button class="mkt-btn" onclick="doBuyStock('${s.id}')">Kaufen</button>
        <button class="mkt-btn" ${shares<=0?'disabled':''} onclick="doSellStock('${s.id}')">Verkaufen</button>
      </div>
    </div>`;
  }).join('');
  // Nutzer 2026-10-22: überflüssiger Text raus („Kurse schwanken jede Woche.“)
  const portfolioCard = `
    <div class="facility-card">
      <div class="fc-head"><div class="fc-icon scouting">📈</div><div style="flex:1"><div class="fc-name">Aktien & ETFs</div><div class="fc-level">Depotwert: ${formatEuro(portfolioValue())}</div></div></div>
      ${stockRows}
    </div>`;

  panel.innerHTML = savingsCard + portfolioCard;
}

// ── NACHWUCHS: Talente generieren & hochziehen ─────────────────
// Füllt die Nachwuchsakademie bis zur Kapazität auf (ersetzt vorhandene Talente NICHT).
// Wird beim Spielstart (leere Akademie → volle Kapazität) und am Saisonende aufgerufen.
// Talente sind 15-17 Jahre alt; Potenzial/Stärke streuen, ein Supertalent ist möglich, aber nicht garantiert.
function generateYouthProspects() {
  const lvl = CLUB.facilities.youth || 1;
  if (!CLUB.youthProspects) CLUB.youthProspects = [];
  const capacity = youthCapacityForLevel(lvl);
  const openSlots = capacity - CLUB.youthProspects.length;
  if (openSlots <= 0) return 0; // Akademie voll → kein Neuzugang
  let added = 0;
  for (let i=0;i<openSlots;i++) {
    const baseOvr = 46 + lvl*3 + rndN(5);
    const age = 15 + rndN(3); // 15, 16 oder 17
    const pos = pickRnd(POS_LIST);
    const positions = generatePositions(pos);
    const areas = generateAreaRatings(positions, baseOvr);
    const paceMental = genAttributes(pos, baseOvr);
    const player = { id:'youth_'+LEAGUE.season+'_'+Date.now()+'_'+i, name: pickRnd(TRANSFER_SURNAMES), firstName: pickRnd(GERMAN_FIRST), flag:'🇩🇪', country:'Deutschland', age, pos, positions, def:areas.def, mid:areas.mid, att:areas.att, pace:paceMental.pace, mental:paceMental.mental, gamesPlayed:0, seed:rndN(100) };
    player.ovr = computeOvrFromAreas(player);
    // Potenzial streut breit: meist solide, manchmal ein Supertalent (kleine Chance auf sehr hohen Wert).
    const roll = Math.random();
    let potBonus;
    if (roll < 0.06) {
      potBonus = Math.round(20 + lvl*1.8) + rndN(8);   // ~6% Supertalent: großer Sprung nach oben
    } else if (roll < 0.30) {
      potBonus = Math.round(12 + lvl*1.6) + rndN(6);   // gutes Talent
    } else {
      potBonus = Math.round(6 + lvl*1.2) + rndN(5);    // solides Talent
    }
    player.truePotential = Math.min(96, player.ovr + potBonus);
    player.value = computeMarketValue(player);
    assignBirthday(player);
    CLUB.youthProspects.push(player);
    added++;
  }
  return added;
}
function promoteProspect(id) {
  if (!CLUB.youthProspects) return;
  const idx = CLUB.youthProspects.findIndex(p=>p.id===id); if(idx===-1) return;
  const p = CLUB.youthProspects[idx];
  // Erst ab 16 Jahren darf ein Talent in den Profikader hochgezogen werden.
  if ((p.age||0) < 16) {
    alert(`${displayName(p)} ist erst ${p.age} Jahre alt. Nachwuchsspieler dürfen frühestens mit 16 Jahren hochgezogen werden.`);
    return;
  }
  const youthWage = weeklyWageFor(p);
  if ((CLUB.wageBudget || 0) < youthWage) { alert(`Nicht genug freies Gehaltsbudget für ${displayName(p)}! Benötigt: ${formatEuro(youthWage)}/Wo, frei: ${formatEuro(CLUB.wageBudget||0)}/Wo.`); return; }
  CLUB.wageBudget = Math.max(0, (CLUB.wageBudget || 0) - youthWage);
  SQUAD.push({ id:'sq_'+p.id, name:p.name, firstName:p.firstName, flag:p.flag, country:p.country, joinedSeason:LEAGUE.season, acquiredSeason:LEAGUE.season, pos:p.pos, positions:p.positions, age:p.age, ovr:p.ovr, truePotential:p.truePotential, def:p.def, mid:p.mid, att:p.att, pace:p.pace, mental:p.mental, gamesPlayed:0, seed:p.seed, value:p.value, wage:youthWage, contractUntil:LEAGUE.season+3, fromYouth:true, birthWeek:p.birthWeek, birthMonth:p.birthMonth, birthDay:p.birthDay });
  assignBirthday(SQUAD[SQUAD.length-1]); assignShirtNumbers();
  CLUB.youthProspects.splice(idx,1);
  addNews('club', 'Eigengewächs befördert', `${p.name} (${p.age}, ${p.pos}) hat es aus der Jugendakademie in den Profikader geschafft!`);
  renderAll(); renderClubTab(); renderScoutTab(); saveGameState();
}
// Entlässt ein Nachwuchstalent (macht einen Platz in der Akademie frei).
function releaseProspect(id) {
  if (!CLUB.youthProspects) return;
  const idx = CLUB.youthProspects.findIndex(p=>p.id===id); if(idx===-1) return;
  const p = CLUB.youthProspects[idx];
  if (!confirm(`${displayName(p)} (${p.age} J) wirklich aus der Nachwuchsabteilung entlassen? Der Platz wird frei für ein neues Talent am Saisonende.`)) return;
  CLUB.youthProspects.splice(idx,1);
  addNews('club', 'Talent verlassen die Akademie', `${displayName(p)} wurde aus der Nachwuchsabteilung verabschiedet.`);
  renderScoutTab(); renderClubTab(); saveGameState();
}

// ═══════════════════════════════════════════════════════════════
// SPONSOREN: Trikot & Stadionname (ligaabhängig, mit Laufzeit)
// ═══════════════════════════════════════════════════════════════
function signSponsor(type, offerId) {
  if (!CLUB.sponsorOffers || !CLUB.sponsorOffers[type]) return;
  const offer = CLUB.sponsorOffers[type].find(o=>o.id===offerId); if(!offer) return;
  CLUB.sponsors[type] = { name:offer.name, perYear:offer.perYear, yearsLeft:offer.duration, duration:offer.duration, signedSeason:LEAGUE.season, profile:offer.profile, profileLabel:offer.profileLabel, bonuses:offer.bonuses };
  // Erste Jahresrate sofort
  CLUB.budget += offer.perYear;
  CLUB.sponsors[type].yearsLeft--;
  CLUB.sponsorOffers[type] = null;
  const label = (typeof sponsorLabel==='function') ? sponsorLabel(type) : (type==='shirt'?'Trikotsponsor':type==='sleeve'?'Ärmelsponsor':'Stadionnamensrechte');
  const extra = type==='stadium' ? ` Das Stadion heißt jetzt „${offer.name}-Arena".` : '';
  addNews('club', `${label}: ${offer.name}`, `${clubShort()} unterschreibt einen ${offer.duration}-Jahres-Vertrag mit ${offer.name} (${formatEuro(offer.perYear)}/Jahr). Erste Rate von ${formatEuro(offer.perYear)} ist eingegangen.${extra}`);
  renderClubTab(); renderHomeTab(); saveGameState();
}
// (startScoutMission jetzt in js/scouting_patch.js — dort auch mit Positions-/
// Potenzial-Filter und länderabhängiger Dauer/Erfolgschance)
// pro absolviertem Spiel aufrufen: Fortschritt + ggf. Talent finden
function signScoutedPlayer(id) {
  if (!CLUB.scoutedPlayers) return;
  if (!isTransferWindowOpen()) { alert('Das Transferfenster ist geschlossen. Gescoutete Talente kannst du erst beim nächsten offenen Fenster verpflichten.'); return; }
  const idx = CLUB.scoutedPlayers.findIndex(p=>p.id===id); if(idx===-1) return;
  const p = CLUB.scoutedPlayers[idx];
  if (CLUB.budget < p.price) { alert('Nicht genug Budget! Benötigt: '+formatEuro(p.price)); return; }
  const scoutWage = minWageDemand(p);
  if ((CLUB.wageBudget || 0) < scoutWage) { alert('Nicht genug freies Gehaltsbudget! Dieses Talent fordert ' + formatEuro(scoutWage) + '/Woche, frei: ' + formatEuro(CLUB.wageBudget || 0) + '/Woche.'); return; }
  CLUB.budget -= p.price;
  CLUB.wageBudget = Math.max(0, (CLUB.wageBudget || 0) - scoutWage);
  CLUB.scoutedPlayers.splice(idx,1);
  SQUAD.push({ id:'sq_'+p.id, name:p.name, firstName:p.firstName, flag:p.flag, country:p.country, joinedSeason:LEAGUE.season, acquiredSeason:LEAGUE.season, pos:p.pos, positions:p.positions, age:p.age, ovr:p.ovr, truePotential:p.truePotential, def:p.def, mid:p.mid, att:p.att, pace:p.pace, mental:p.mental, gamesPlayed:0, seed:p.seed, value:computeMarketValue(p), wage:scoutWage, contractUntil:LEAGUE.season+3, birthWeek:p.birthWeek, birthMonth:p.birthMonth, birthDay:p.birthDay });
  assignBirthday(SQUAD[SQUAD.length-1]); assignShirtNumbers();
  CLUB.transferHistory.unshift({ type:'buy', name:p.name, amount:p.price, season:LEAGUE.season });
  addNews('transfer', `Verpflichtung: ${p.flag} ${p.name}`, `Das gescoutete Talent ${p.name} (${p.age}, ${positionsDisplay(p)}) wurde für ${formatEuro(p.price)} verpflichtet. Freies Gehaltsbudget: ${formatEuro(CLUB.wageBudget)}/Woche.`);
  renderAll(); renderScoutTab(); saveGameState();
}
// (renderScoutTab jetzt in js/scouting_patch.js — neue UI mit Ziel-Auswahl,
// Positions-/Potenzial-Filter und Länder-Übersicht)

// ── GAME STATE ───────────────────────────────────────────────
function updateChanceRates() {
  const mins = Math.max(1, G.min);
  const rh = (G.chanceCounts[0] / mins * 10).toFixed(1);
  const ra = (G.chanceCounts[1] / mins * 10).toFixed(1);
  document.getElementById('chance-rate-h').textContent = rh + '/10min';
  document.getElementById('chance-rate-a').textContent = ra + '/10min';
}

// ── RISIKO-LEVEL & TRAINER-EINGRIFFE ──────────────────────────
function renderRiskBadge() {
  const el = document.getElementById('risk-badge'); if(!el) return;
  const info = getRiskInfo(G.riskLevel);
  el.textContent = 'Risiko: ' + info.text;
  el.style.color = info.color;
  el.style.borderColor = info.color;
}
function renderDecisionLog() {
  const el = document.getElementById('decision-log'); if(!el) return;
  if(!G.decisions.length) { el.innerHTML = 'Noch keine Entscheidung nötig.'; return; }
  el.innerHTML = [...G.decisions].reverse().map(d => {
    const shift = d.momentumAfter - d.momentumBefore;
    return `<div class="dec-row"><span class="dmin">${d.min}'</span> ${DECISION_LABELS[d.type]||d.type}<div class="dshift">Momentum ${d.momentumBefore}% → ${d.momentumAfter}% (${shift>0?'+':''}${shift})</div></div>`;
  }).join('');
}

// ── UI UPDATES ───────────────────────────────────────────────
function updateUI() {
  const m = G.momentum;
  document.getElementById('mom-fill-home').style.width = m + '%';
  document.getElementById('mom-fill-away').style.width = (100-m) + '%';
  document.getElementById('mom-pct-l').textContent = Math.round(m) + '%';
  document.getElementById('mom-pct-r').textContent = Math.round(100-m) + '%';
  document.getElementById('mom-trend').textContent = getMomLabel(m);
  document.getElementById('mom-trend').style.color = getMomColor(m);
  renderRiskBadge();
  renderDecisionLog();

  const tot = (a,b) => Math.max(1,a+b);
  const pct = (a,b) => Math.round(a/tot(a,b)*100);

  document.getElementById('sh').textContent = G.shots[0];
  document.getElementById('sa').textContent = G.shots[1];
  document.getElementById('sbl-sh').style.width = pct(G.shots[0],G.shots[1])+'%';
  document.getElementById('sbr-sh').style.width = pct(G.shots[1],G.shots[0])+'%';
  document.getElementById('ph').textContent = G.poss[0];
  document.getElementById('pa').textContent = G.poss[1];
  document.getElementById('sbl-ph').style.width = G.poss[0]+'%';
  document.getElementById('sbr-ph').style.width = G.poss[1]+'%';
  document.getElementById('pgh').textContent = G.passAcc[0]+'%';
  document.getElementById('pga').textContent = G.passAcc[1]+'%';
  document.getElementById('sbl-pgh').style.width = pct(G.passAcc[0],G.passAcc[1])+'%';
  document.getElementById('sbr-pgh').style.width = pct(G.passAcc[1],G.passAcc[0])+'%';
  document.getElementById('zkh').textContent = G.duelQuote[0]+'%';
  document.getElementById('zka').textContent = G.duelQuote[1]+'%';
  document.getElementById('sbl-zkh').style.width = G.duelQuote[0]+'%';
  document.getElementById('sbr-zkh').style.width = G.duelQuote[1]+'%';
  document.getElementById('fh').textContent = G.fouls[0];
  document.getElementById('fa').textContent = G.fouls[1];
  document.getElementById('sbl-fh').style.width = pct(G.fouls[0],G.fouls[1])+'%';
  document.getElementById('sbr-fh').style.width = pct(G.fouls[1],G.fouls[0])+'%';
  updateCornerStat(pct);
  updateChanceRates();
  updateCards();
}

// Ecken-Statistik: nutzt vorhandene Elemente (ch/ca) oder fügt eine Zeile ein
function updateCornerStat(pct) {
  const eckh = document.getElementById('eckh'), ecka = document.getElementById('ecka');
  if (!eckh || !ecka) return;
  eckh.textContent = G.corners[0];
  ecka.textContent = G.corners[1];
  const l = document.getElementById('sbl-eckh'), r = document.getElementById('sbr-eckh');
  if (l) l.style.width = pct(G.corners[0], G.corners[1]) + '%';
  if (r) r.style.width = pct(G.corners[1], G.corners[0]) + '%';
}

function updateScore() {
  document.getElementById('score').textContent = G.homeGoals + ' : ' + G.awayGoals;
}

function updateCards() {
  const el = document.getElementById('cards-el');
  if(!G.cards.length) { el.textContent = 'Keine Karten'; return; }
  el.innerHTML = G.cards.map(c =>
    `<div class="card-row">${c.type==='yellow'?'🟨':'🟥'} <span style="color:var(--text)">${c.player}</span> <span style="color:var(--text3)">${c.team==='home'?clubShort():TEAMS.away.shortTag} ${c.min}'</span></div>`
  ).join('');
}

// ── ADD EVENT ────────────────────────────────────────────────
// minute (optional, aus Kickdraft): Minute des Ereignisses — die räumliche Engine wertet erst
// nach dem Spiel, G.min stünde dann bei jedem Eintrag auf 90.
function addEv(type, team, text, icon, minute) {
  const feed = document.getElementById('feed');
  document.getElementById('feed-empty').style.display = 'none';
  const el = document.createElement('div');
  el.className = 'ev';
  const icons = {goal:'<i class="ti ti-ball-football"></i>',yellow:'<i class="ti ti-square-filled" style="color:#f2c14e"></i>',red:'<i class="ti ti-square-filled" style="color:#e24b4a"></i>',chance:'<i class="ti ti-flame"></i>',info:'<i class="ti ti-info-circle"></i>',sub:'<i class="ti ti-refresh"></i>',save:'<i class="ti ti-hand-stop"></i>',foul:'<i class="ti ti-alert-triangle"></i>',corner:'<i class="ti ti-flag"></i>'};
  const classes = {goal:'i-goal',yellow:'i-yellow',red:'i-red',chance:'i-chance',info:'i-info',sub:'i-sub',save:'i-save',foul:'i-info',corner:'i-info'};
  const badge = team===0?`<span class="hbadge">${clubShort()}</span>`:team===1?`<span class="abadge">${TEAMS.away.shortTag}</span>`:'';
  const min = (minute != null && minute !== '') ? String(minute) : String(G.min);
  el.innerHTML = `<div class="ev-icon ${classes[type]||'i-info'}">${icon||icons[type]||'<i class="ti ti-info-circle"></i>'}</div><div class="ev-body"><div class="ev-min">${/^\d+(\+\d+)?$/.test(min) ? min + "'" : min}</div><div class="ev-text">${badge}${typeof stripLeadEmoji==='function'?stripLeadEmoji(text):text}</div></div>`;
  feed.insertBefore(el, feed.firstChild);
}

// ── MINUTE PROCESSOR ─────────────────────────────────────────
function processMinute() {
  G.min++;
  const badge = document.getElementById('time-badge');
  badge.textContent = G.min + "'";

  // Log momentum every 5 minutes
  if(G.min % 5 === 0) G.momentumLog.push({min:G.min, value:Math.round(G.momentum)});

  simulatePassesAndDuels();
  driftMomentum();
  const {homeChance, awayChance, homeConv, awayConv} = momentumToProbs();

  // ── SHOT ATTEMPTS ────────────────────────────────────────
  let hadAction = false;
  if(Math.random() < homeChance) {
    G.chanceCounts[0]++;
    G.shots[0]++;
    hadAction = true;
    if(Math.random() < homeConv) {
      scoreGoal(0);
    } else if(Math.random() < 0.4) {
      const txt = homeChanceText();
      addEv('chance', 0, txt);
      G.momentum = Math.min(95, G.momentum + 4);
    } else {
      addEv('save', 1, awayPlayers[0] + ' hält! Schuss von ' + clubShort() + ' abgewehrt.');
      G.momentum = Math.max(5, G.momentum - 3);
    }
  }
  if(Math.random() < awayChance) {
    G.chanceCounts[1]++;
    G.shots[1]++;
    hadAction = true;
    if(Math.random() < awayConv) {
      scoreGoal(1);
    } else if(Math.random() < 0.4) {
      const txt = awayChanceText();
      addEv('chance', 1, txt);
      G.momentum = Math.max(5, G.momentum - 4);
    } else {
      addEv('save', 0, homePlayers[0] + ' pariert! Starke Reaktion gegen den Schuss von ' + TEAMS.away.shortTag + '.');
      G.momentum = Math.min(95, G.momentum + 3);
    }
  }

  // ── FOULS ───────────────────────────────────────────────
  // Höheres Risiko = mehr Zweikämpfe/Fouls insgesamt; bei Vollrisiko foult FCM selbst öfter
  // (aggressives Pressing, Spieler außer Position) — bei sehr defensivem Spiel seltener.
  const foulChance = 0.12 + Math.abs(G.riskLevel||0) * 0.015;
  if(!hadAction && Math.random() < foulChance) {
    const fcmFoulProb = Math.max(0.2, Math.min(0.8, 0.5 + (G.riskLevel||0) * 0.07));
    const t = Math.random() < fcmFoulProb ? 0 : 1;
    G.fouls[t]++;
    if(Math.random() < 0.25) {
      const objIdx = Math.floor(Math.random()*10)+1;
      const playerObj = t===0 ? homePlayerObjAt(objIdx) : null;
      const pl = t===0 ? (playerObj ? playerObj.name : homePlayers[objIdx]) : awayPlayers[objIdx];
      const redChance = 0.12 + (t===0 ? Math.max(0,G.riskLevel||0)*0.03 : 0);
      const season = LEAGUE ? LEAGUE.season : 1;
      if(Math.random() < redChance && G.min > 30) {
        addEv('red', t, pl + ' sieht die Rote Karte! Grobes Foul — ' + (t===0?clubShort():TEAMS.away.shortTag) + ' in Unterzahl!');
        G.cards.push({type:'red', player:pl, playerId: playerObj?playerObj.id:null, team:t===0?'home':'away', min:G.min});
        TEAMS[t===0?'home':'away'].redCards++;
        if (t===0 && playerObj) addPlayerRed(playerObj, season);
        triggerDecision('red', t, pl);
        return;
      } else {
        addEv('yellow', t, pl + ' sieht Gelb. Freistoß für ' + (t===0?TEAMS.away.shortTag:clubShort()) + '.');
        G.cards.push({type:'yellow', player:pl, playerId: playerObj?playerObj.id:null, team:t===0?'home':'away', min:G.min});
        if (t===0 && playerObj) addPlayerYellow(playerObj, season);
      }
    }
  }

  // ── CORNER ──────────────────────────────────────────────
  // Rate ~0,085/Min → über 90 Min im Schnitt ~7-8 Ecken gesamt (Zielbereich 6-9).
  // Verteilung nach Momentum: das drückende Team erspielt mehr Ecken.
  if(Math.random() < 0.085) {
    const t = Math.random() < G.momentum/100 ? 0 : 1;
    G.corners[t]++;
    addEv('corner', t, 'Ecke für ' + (t===0?clubShort():TEAMS.away.shortTag) + ' (' + G.corners[0] + ':' + G.corners[1] + ').');
  }

  // ── HALFTIME ────────────────────────────────────────────
  if(G.min === 45 && !G.halfDone) { triggerHalftime(); return; }
  if(G.min >= 90) { triggerFulltime(); return; }

  // ── LATE PRESSURE DECISION ──────────────────────────────
  // Feuert in engen Spielen: Rückstand, Gleichstand ODER knappe 1-Tor-Führung
  // (dann „Führung verwalten?"). Governance (Cap/Abstand/Aus) siehe match_moments_patch.
  if(G.min === 75 && Math.abs(G.homeGoals - G.awayGoals) <= 1) {
    triggerDecision('pressure', -1, null);
    return;
  }

  updateUI();
}

// ── GOAL ─────────────────────────────────────────────────────
function scoreGoal(team) {
  const wasUpset = (team===0 && G.momentum < 40) || (team===1 && G.momentum > 60);
  if(wasUpset) G.upsets++;
  G.goalLog.push({min:G.min, team, momentum:Math.round(G.momentum), upset:wasUpset});

  if(team===0) {
    G.homeGoals++;
    // Echten Torschützen + Vorlagengeber wählen (positionsgewichtet: Stürmer/Offensive treffen öfter).
    const scorerObj = pickScorer(homeLineupPlayers);
    let assistObj = pickAssist(homeLineupPlayers, scorerObj);
    const scorer = scorerObj ? scorerObj.name : (homePlayers[Math.floor(Math.random()*10)+1]||'—');
    const assist = assistObj ? assistObj.name : (homePlayers[Math.floor(Math.random()*10)+1]||'—');
    // Statistik der eigenen Spieler hochzählen
    const season = LEAGUE ? LEAGUE.season : 1;
    if (scorerObj) addPlayerGoal(scorerObj, season);
    if (assistObj && assistObj !== scorerObj) addPlayerAssist(assistObj, season);
    G.scorers = G.scorers || [];
    // assistId mitschreiben, damit die Note die Vorlage kennt — sie hing bisher
    // allein am Anpfiff-Snapshot.
    G.scorers.push({ id: scorerObj?scorerObj.id:null, name: scorer, min: G.min,
                     assistId: (assistObj && assistObj !== scorerObj) ? assistObj.id : null });
    addEv('goal', 0, `TOOOOR! ${scorer} trifft${wasUpset?' gegen den Spielverlauf':' zum verdienten'}! Vorlage: ${assist}.`);
    G.momentum = Math.min(90, G.momentum + 12);
    if(G.homeGoals === G.awayGoals && G.awayGoals > 0 && G.min > 40) {
      setTimeout(() => { updateScore(); triggerDecision('equalizer', 0, scorer); }, 400);
      return;
    }
  } else {
    G.awayGoals++;
    const scorer = awayPlayers[Math.floor(Math.random()*10)+1];
    addEv('goal', 1, `Gegentor! ${scorer} trifft für ${TEAMS.away.name}${wasUpset?' — völlig gegen den Spielverlauf!':'.'}!`);
    G.momentum = Math.max(10, G.momentum - 12);
    if(G.homeGoals <= G.awayGoals && G.min > 60) {
      setTimeout(() => { updateScore(); triggerDecision('pressure_goal', 1, scorer); }, 400);
      return;
    }
  }
  updateScore();
  updateUI();
}
// Wählt einen Torschützen aus der Startelf, gewichtet nach Position (ST am häufigsten, TW nie).
function pickScorer(lineup) {
  if (!lineup || !lineup.length) return null;
  const weights = { ST:10, OM:6, ZOM:6, LF:7, RF:7, FL:7, LM:4, RM:4, AM:4, ZM:4, ZDM:2.5, AV:2, LV:2, RV:2, IV:1.2, TW:0 };
  const pool = lineup.filter(p => p && p.pos !== 'TW');
  if (!pool.length) return null;
  let total = 0; const cumulative = pool.map(p => { total += (weights[p.pos]||3); return total; });
  const r = Math.random() * total;
  for (let i=0;i<pool.length;i++) if (r <= cumulative[i]) return pool[i];
  return pool[pool.length-1];
}
// Wählt einen Vorlagengeber (nicht den Torschützen), gewichtet Richtung offensiver/kreativer Positionen.
function pickAssist(lineup, scorer) {
  if (!lineup || !lineup.length) return null;
  const weights = { OM:8, ZOM:8, LM:7, RM:7, AM:7, LF:7, RF:7, FL:7, ZM:6, ZDM:4, AV:5, LV:5, RV:5, ST:4, IV:1.5, TW:0.3 };
  const pool = lineup.filter(p => p && p !== scorer);
  if (!pool.length) return null;
  // 20% der Tore ohne Vorlage (Sololauf, Standard, Eigentor-Glück)
  if (Math.random() < 0.20) return null;
  let total = 0; const cumulative = pool.map(p => { total += (weights[p.pos]||3); return total; });
  const r = Math.random() * total;
  for (let i=0;i<pool.length;i++) if (r <= cumulative[i]) return pool[i];
  return pool[pool.length-1];
}

// ── DECISIONS ────────────────────────────────────────────────
function triggerDecision(type, team, player) {
  clearInterval(G.interval);
  G.paused = true;
  document.getElementById('ko-btn').disabled = true;
  const ov = document.getElementById('d-overlay');
  ov.style.display = 'flex';
  const m = Math.round(G.momentum);

  let badge='', badgeClass='', title='', desc='', opts=[], momPreview='';

  if(type==='red') {
    const side = team===0?clubShort():TEAMS.away.shortTag;
    badge = '🟥 Rote Karte — Unterzahl!'; badgeClass = 'db-red';
    title = 'Trainer-Entscheidung: ' + (team===0?'Wir':'Gegner') + ' in Unterzahl';
    desc = `${player} ist vom Platz. ${team===0?clubShort()+' spielt jetzt mit 10 Mann.':TEAMS.away.name+' hat einen Mann weniger — wie nutzen wir das aus?'} Momentum: ${m}%.`;
    momPreview = `Aktuelles Momentum: ${m}% für ${clubShort()} — ${getMomLabel(m)}`;
    if(team===0) {
      opts = [
        {label:'5-4-0 Defensivblock', riskClass:'risk-low', detail:'Sehr defensiv · Konter werden deutlich seltener, eigene Chancen aber auch', effect:()=>{ G.momentum=Math.max(10,G.momentum-12); G.riskLevel=-2; addEv('info',-1,clubShort()+' stellt auf kompakten 5-4-0 Block um — Sicherheit geht vor.'); G.decisions.push({min:G.min,type:'red_defensive',momentumBefore:m,momentumAfter:Math.round(G.momentum)}); }},
        {label:'Formation beibehalten (4-2-3)', riskClass:'risk-mid', detail:'Struktur halten · ausgewogenes Risiko', effect:()=>{ G.momentum=Math.max(10,G.momentum-5); G.riskLevel=-1; addEv('info',-1,clubShort()+' versucht Formation zu halten — Disziplin ist jetzt entscheidend.'); G.decisions.push({min:G.min,type:'red_hold',momentumBefore:m,momentumAfter:Math.round(G.momentum)}); }},
        {label:'Alles riskieren — Angriff!', riskClass:'risk-high', detail:'Volles Risiko trotz Unterzahl · viel anfälliger für Konter, mehr Kartenrisiko', effect:()=>{ G.momentum=Math.min(90,G.momentum+8); G.riskLevel=2; addEv('info',-1,clubShort()+' drückt trotz Unterzahl — riskante Entscheidung!'); TEAMS.away.attack+=8; G.decisions.push({min:G.min,type:'red_attack',momentumBefore:m,momentumAfter:Math.round(G.momentum)}); }}
      ];
    } else {
      opts = [
        {label:'Hohe Pressing — Überzahl nutzen', riskClass:'risk-mid', detail:'Überzahl aktiv nutzen · setzt den Gegner unter Druck, leicht konteranfällig', effect:()=>{ G.momentum=Math.min(90,G.momentum+15); G.riskLevel=1; addEv('info',-1,clubShort()+' erhöht den Druck — Überzahl wird aktiv genutzt!'); G.decisions.push({min:G.min,type:'opp_red_press',momentumBefore:m,momentumAfter:Math.round(G.momentum)}); }},
        {label:'Kontrolliertes Spiel weiterlaufen lassen', riskClass:'risk-low', detail:'Überzahl kontrolliert verwalten · sicherer, aber weniger Tempo', effect:()=>{ G.momentum=Math.min(90,G.momentum+8); G.riskLevel=0; addEv('info',-1,clubShort()+' verwaltet die Überzahl kontrolliert.'); G.decisions.push({min:G.min,type:'opp_red_control',momentumBefore:m,momentumAfter:Math.round(G.momentum)}); }}
      ];
    }
  } else if(type==='equalizer') {
    badge = '⚖️ Ausgleichstreffer!'; badgeClass = 'db-tactical';
    title = 'Wie reagieren wir auf den Ausgleich?';
    desc = `${player} hat zum ${G.homeGoals}:${G.awayGoals} ausgeglichen! Noch ${90-G.min} Minuten zu spielen — wie geht's weiter?`;
    momPreview = `Momentum: ${m}% ${clubShort()} · ${getMomLabel(m)}`;
    opts = [
      {label:'Auf den Sieg drängen', riskClass:'risk-high', detail:'Auf Sieg drängen · mehr eigene Chancen, aber deutlich konter- und kartenanfälliger', effect:()=>{ G.momentum=Math.min(92,G.momentum+10); G.riskLevel=2; addEv('info',-1,clubShort()+' will jetzt den Siegtreffer — volles Risiko!'); G.decisions.push({min:G.min,type:'equalizer_push',momentumBefore:m,momentumAfter:Math.round(G.momentum)}); }},
      {label:'Geordnet weiterspielen', riskClass:'risk-mid', detail:'Geordnet weiterspielen · ausgewogenes Risiko', effect:()=>{ G.momentum=Math.min(85,G.momentum+3); G.riskLevel=0; addEv('info',-1,clubShort()+' spielt nach dem Ausgleich geordnet weiter.'); G.decisions.push({min:G.min,type:'equalizer_balanced',momentumBefore:m,momentumAfter:Math.round(G.momentum)}); }},
      {label:'Punkt sichern, kein Risiko', riskClass:'risk-low', detail:'Punkt sichern · weniger Konterrisiko, aber kaum eigene Chancen', effect:()=>{ G.momentum=Math.max(15,G.momentum-4); G.riskLevel=-2; addEv('info',-1,clubShort()+' stellt sich auf Punktsicherung ein.'); G.decisions.push({min:G.min,type:'equalizer_secure',momentumBefore:m,momentumAfter:Math.round(G.momentum)}); }}
    ];
  } else if(type==='pressure' || type==='pressure_goal') {
    const diff = G.homeGoals - G.awayGoals;
    badge = '⚡ Trainer-Entscheidung gefragt!'; badgeClass = 'db-pressure';
    title = diff < 0 ? 'Rückstand — Reaktion?' : diff===0 ? 'Unentschieden — alles geben?' : 'Führung — verwalten?';
    desc = `${G.min}. Minute · Stand ${G.homeGoals}:${G.awayGoals} · Momentum: ${m}% ${clubShort()} · ${90-G.min} Minuten noch.`;
    momPreview = `Momentum: ${m}% ${clubShort()} · ${getMomLabel(m)}`;
    opts = [
      {label:'Offensivwechsel — frisches Tempo', riskClass:'risk-mid', detail:`Offensiv · mehr Druck von ${clubShort()}, dafür hinten anfälliger`, effect:()=>{ G.momentum=Math.min(90,G.momentum+10); G.riskLevel=1; TEAMS.home.attack+=4; TEAMS.home.defense-=4; addEv('sub',0,'Einwechslung: Roth für Gruber — frisches Tempo vorne!'); G.decisions.push({min:G.min,type:'sub_offensive',momentumBefore:m,momentumAfter:Math.round(G.momentum)}); }},
      {label:'Defensiv stabilisieren', riskClass:'risk-low', detail:`Defensiv stabilisieren · weniger Konterrisiko, aber seltener eigene Chancen`, effect:()=>{ G.momentum=Math.max(10,G.momentum-6); G.riskLevel=-1; TEAMS.home.defense+=5; addEv('sub',0,'Einwechslung: Stark für Braun — Abwehr verstärkt.'); G.decisions.push({min:G.min,type:'sub_defensive',momentumBefore:m,momentumAfter:Math.round(G.momentum)}); }},
      {label:'Taktik ändern: hohes Pressing', riskClass:'risk-high', detail:`Hochpressing · alles oder nichts, sehr hohes Gegentor- und Kartenrisiko`, effect:()=>{ G.momentum=Math.min(92,G.momentum+18); G.riskLevel=2; TEAMS.home.attack+=8; addEv('info',-1,clubShort()+' schaltet auf Hochdruck — Pressing auf allen Positionen!'); G.decisions.push({min:G.min,type:'pressing',momentumBefore:m,momentumAfter:Math.round(G.momentum)}); }}
    ];
  }

  document.getElementById('d-badge').innerHTML = badge;
  document.getElementById('d-badge').className = 'd-badge ' + badgeClass;
  document.getElementById('d-title').textContent = title;
  document.getElementById('d-desc').textContent = desc;
  document.getElementById('d-mom-preview').textContent = momPreview;
  const optEl = document.getElementById('d-options');
  optEl.innerHTML = '';
  opts.forEach(o => {
    const b = document.createElement('button');
    b.className = 'd-opt';
    b.innerHTML = `<div class="d-opt-title">${o.label}</div><div class="d-opt-detail ${o.riskClass}">${o.detail}</div>`;
    b.onclick = () => { o.effect(); closeDecision(); };
    optEl.appendChild(b);
  });
}

function closeDecision() {
  document.getElementById('d-overlay').style.display = 'none';
  G.paused = false;
  document.getElementById('ko-btn').disabled = false;
  updateUI();
  G.interval = setInterval(processMinute, 800);
}

// ── HALFTIME / FULLTIME ──────────────────────────────────────
function triggerHalftime() {
  clearInterval(G.interval);
  G.running = false; G.halfDone = true;
  document.getElementById('time-badge').textContent = 'HZ';
  document.getElementById('time-badge').className = 'time-badge ht';
  addEv('info', -1, `Halbzeitpfiff. Stand: ${G.homeGoals}:${G.awayGoals} · Momentum: ${Math.round(G.momentum)}% ${clubShort()} · Passquote ${G.passAcc[0]}:${G.passAcc[1]} · Zweikämpfe ${G.duelQuote[0]}:${G.duelQuote[1]}`);
  const btn = document.getElementById('ko-btn');
  btn.className = 'ko-btn ht'; btn.disabled = false;
  btn.innerHTML = '<i class="ti ti-player-play" aria-hidden="true"></i> 2. Halbzeit';
  updateUI();
}

function triggerFulltime() {
  clearInterval(G.interval);
  G.running = false; G.ended = true;
  document.getElementById('time-badge').textContent = 'FT';
  document.getElementById('time-badge').className = 'time-badge ft';
  const res = G.homeGoals>G.awayGoals?`Sieg für ${clubShort()}!`:G.homeGoals===G.awayGoals?'Unentschieden.':`Niederlage für ${clubShort()}.`;
  addEv('info', -1, `Abpfiff! ${res} Endstand: ${G.homeGoals}:${G.awayGoals}`);
  updateUI();
  setTimeout(buildMedia, 600);
  // Ergebnis verbuchen (Tabelle/Pokal, Einnahmen) und Spiel abschließen
  processFixtureResult();
  // Logische Uhr: Knopf zum Weiterkommen einblenden
  setupPostMatchButton();
}

// Blendet nach Spielende den Weiter-Knopf ein.
// Wunsch: EINE Aktion = Woche weiter + zurück zum Hub. Ist die Saison für den
// eigenen Verein vorbei, schließt der Knopf stattdessen die Saison ab.
function setupPostMatchButton() {
  const btn = document.getElementById('ko-btn');
  if (!btn) return;
  btn.disabled = false;
  btn.className = 'ko-btn';
  if (fcmSeasonOver()) {
    btn.innerHTML = '<i class="ti ti-trophy" aria-hidden="true"></i> Saison abschließen → Hub';
  } else {
    btn.innerHTML = '<i class="ti ti-arrow-right" aria-hidden="true"></i> Nächste Woche → Hub';
  }
  btn.onclick = () => { postMatchContinue(); };
}

// Schaltet nach einem Spiel die Woche weiter (bzw. schließt die Saison ab)
// und bringt den Spieler zurück auf den Hub (Übersicht).
function postMatchContinue() {
  const btn = document.getElementById('ko-btn');
  if (btn) { btn.disabled = true; btn.onclick = null; }
  if (fcmSeasonOver()) {
    finishSeasonFlow();
  } else {
    const ok = advanceCalendarWeek();
    if (!ok) finishSeasonFlow();
  }
  // Match-Status für das nächste Spiel zurücksetzen und zum Hub wechseln
  resetMatchState();
  switchAppView('home', document.getElementById('nav-home'));
}

// ── MEDIA GENERATOR ──────────────────────────────────────────
function buildMedia() {
  document.getElementById('media-section').style.display = 'block';
  const res = G.homeGoals>G.awayGoals?'Sieg':'Unentschieden'; 
  const score = G.homeGoals+':'+G.awayGoals;
  const avgMom = Math.round(G.momentumLog.reduce((a,b)=>a+b.value,0)/Math.max(1,G.momentumLog.length));
  const lastDec = G.decisions[G.decisions.length-1];
  const upsets = G.upsets;
  const shots = G.shots;

  // Twitter posts
  const cs = clubShort(), cn = clubName();
  const tweets = [];
  if(G.homeGoals > G.awayGoals) {
    tweets.push({author:`@${cs}_Ultras 🔵`, text:`SIEEEEEG! ${score}! Heute hat die Mannschaft alles gegeben! 💙🔥 #${cs} #Aufstieg`, meta:'847 Likes · 203 Retweets'});
  } else if(G.homeGoals < G.awayGoals) {
    tweets.push({author:`@${cs}_Fan`, text:`Enttäuschend heute. So ein Auftritt darf einfach nicht ${score} enden. Die Chancen waren da.`, meta:'134 Likes'});
  } else {
    tweets.push({author:`@${cs}_Ultras 🔵`, text:`Punkt geholt. Bei dem Druck den ${TEAMS.away.shortTag} hatte ist das okay. Weiter! 💙 #${cs}`, meta:'312 Likes'});
  }
  if(upsets > 0) tweets.push({author:'@Fussball_Analyst', text:`Interessant: ${upsets} Tor(e) heute gegen das Spielmomentum. Fußball bleibt unberechenbar. ${cs} hatte ${shots[0]} Schüsse (${TEAMS.away.shortTag}: ${shots[1]}).`, meta:'289 Likes · 67 Retweets'});
  tweets.push({author:'@Statistik_Stadion', text:`Zahlen zum Spiel: Passquote ${cs} ${G.passAcc[0]}% vs. ${TEAMS.away.shortTag} ${G.passAcc[1]}% · Zweikampfquote ${G.duelQuote[0]}:${G.duelQuote[1]} · Ecken ${G.corners[0]}:${G.corners[1]}. ${G.passAcc[0]>G.passAcc[1] && G.duelQuote[0]>G.duelQuote[1] ? cs+' klar überlegen in den Basics — verdienter Auftritt.' : 'Knappe Werte, am Ende entschieden Kleinigkeiten.'}`, meta:'156 Likes'});
  if(lastDec) {
    const decTexts = {
      red_defensive: `Die Umstellung auf den Defensivblock nach der Roten Karte? Richtige Entscheidung. Hat dem Gegner den Zug genommen — das Ergebnis stand. 📊`,
      red_attack: `Mutig nach der Roten Karte trotzdem offensiv geblieben — hat das am Ende geholfen?`,
      red_hold: `Formation gehalten trotz Unterzahl — kaum Kontrolle verloren. Respekt für die Disziplin.`,
      sub_offensive: `Der Offensivwechsel hat gewirkt — man merkte danach sofort mehr Zug zum Tor.`,
      sub_defensive: `Die defensive Einwechslung hat die Struktur stabilisiert — sichere Entscheidung.`,
      pressing:`Hohes Pressing in der Schlussphase — riskant, aber druckvoll. ${G.homeGoals>G.awayGoals?'Hat sich bezahlt gemacht.':'Hat nicht gereicht.'}`
    };
    tweets.push({author:'@TaktikTalk_DE', text: decTexts[lastDec.type]||`Taktische Umstellung in Min. ${lastDec.min} — sie hat das Spielbild spürbar verändert.`, meta:'412 Likes · 89 Retweets'});
  }
  tweets.push({author:'@'+TEAMS.away.shortTag+'_Fan', text:`Heute war mehr drin. Ihre ${shots[0]} Schüsse gegen unsere ${shots[1]}... Statistik lügt nicht. Nächste Woche besser! 🔴`, meta:'88 Likes'});

  // Kicker
  const kickerNote = G.homeGoals>G.awayGoals?'verdient':'gegen den Spielverlauf';
  const kickerMom = avgMom>55?'weitgehend dominant':'über lange Strecken unter Druck';
  const kickerDec = lastDec ? `Die taktische Anpassung in Minute ${lastDec.min} ${lastDec.momentumAfter>lastDec.momentumBefore?'zeigte Wirkung und verschob das Kräfteverhältnis spürbar':'veränderte das Spielbild zunächst kaum'}.` : '';
  const kickerText = `<div style="font-size:13px;font-weight:600;margin-bottom:6px">${cs} ${score} ${TEAMS.away.name} — Spielbericht</div><div style="font-size:11px;line-height:1.6;color:var(--text2)">${cn} gewann ${kickerNote} mit ${score}. Die Mannschaft war ${kickerMom}. ${shots[0]} Schüsse standen ${shots[1]} Gegner-Schüssen gegenüber, bei einer Passquote von ${G.passAcc[0]}% (${TEAMS.away.shortTag}: ${G.passAcc[1]}%) und einer Zweikampfquote von ${G.duelQuote[0]}% (${TEAMS.away.shortTag}: ${G.duelQuote[1]}%). ${kickerDec} ${upsets>0?`Bemerkenswert: ${upsets} Treffer fielen gegen das laufende Spielmomentum — ein Zeichen für die Widerstandsfähigkeit beider Teams.`:''}</div>`;

  // Lokalblatt
  const city = cn.replace(/^(FC|SV|TSV|VfL|VfB|SC|SpVgg|SSV|TuS|FSV|BSC)\s+/i,'');
  const localRes = G.homeGoals>G.awayGoals?`Ein Jubeltag in ${city}! Mit ${score} setzte sich unser ${cs} gegen ${TEAMS.away.name} durch.`:G.homeGoals===G.awayGoals?`Punkt im Heimspiel — ${cs} und ${TEAMS.away.name} trennten sich ${score}.`:`Bitter! ${cs} verliert daheim ${score} gegen ${TEAMS.away.name}.`;
  const localDec = lastDec?`Trainer-Entscheidung in Minute ${lastDec.min}: Die taktische Umstellung ${lastDec.momentumAfter>lastDec.momentumBefore?'verschob das Kräfteverhältnis spürbar. Eine mutige Entscheidung, die sich auszahlte.':'veränderte das Spielbild kaum. Ob eine andere Wahl mehr gebracht hätte, bleibt offen.'}`:'';
  const localText = `<div style="font-size:13px;font-weight:600;margin-bottom:6px">${city}er Tageblatt</div><div style="font-size:11px;line-height:1.6;color:var(--text2)">${localRes} ${localDec} Die Fans durften sich über ${G.homeGoals} Heimtore freuen${G.upsets>0?' — darunter ein Treffer völlig gegen den Spielverlauf':''}.Weiter geht es nächste Woche auswärts.</div>`;

  document.getElementById('media-twitter').innerHTML = tweets.map(t=>`<div class="media-post"><div class="media-author">${t.author}</div><div class="media-text">${t.text}</div><div class="media-meta">${t.meta||''}</div></div>`).join('');
  document.getElementById('media-kicker').innerHTML = `<div class="media-post">${kickerText}</div>`;
  document.getElementById('media-local').innerHTML = `<div class="media-post">${localText}</div>`;
}

function switchMedia(tab, btn) {
  document.querySelectorAll('.media-tab').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.media-feed').forEach(f=>f.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('media-'+tab).classList.add('active');
}

// ── KICKOFF ──────────────────────────────────────────────────
function handleKO() {
  const btn = document.getElementById('ko-btn');
  if(!G.running && !G.halfDone && G.min===0) {
    // Prüfen, ob ein nicht verfügbarer Spieler (verletzt/gesperrt) in der Startelf steht
    const unavailable = getLineupIds().map(getPlayer).filter(p => p && !isAvailable(p));
    if (unavailable.length) {
      const names = unavailable.map(p => `${displayName(p)} (${isInjured(p)?'verletzt':'gesperrt'})`).join(', ');
      alert(`Folgende aufgestellte Spieler sind nicht einsatzbereit: ${names}.\n\nBitte stelle verfügbare Spieler auf, bevor du anpfeifst.`);
      return;
    }
    syncClubToTeams();
    G.running = true;
    btn.disabled = true;
    btn.innerHTML = '<i class="ti ti-player-pause" aria-hidden="true"></i> Läuft...';
    addEv('info',-1,`⚽ Anpfiff! ${clubName()} vs. ` + TEAMS.away.name + '.');
    G.interval = setInterval(processMinute, 800);
  } else if(G.halfDone && !G.ended) {
    G.halfDone = false; G.running = true;
    btn.className = 'ko-btn'; btn.disabled = true;
    btn.innerHTML = '<i class="ti ti-player-pause" aria-hidden="true"></i> Läuft...';
    addEv('info',-1,'⚽ Anpfiff zur 2. Halbzeit!');
    G.interval = setInterval(processMinute, 800);
  }
}

// ── ONBOARDING ────────────────────────────────────────────────
const ONBOARDING_LEAGUES = {
  'Bundesliga': [
    {name:'FC Bayern München',ovr:88},{name:'Borussia Dortmund',ovr:83},{name:'RB Leipzig',ovr:82},
    {name:'VfB Stuttgart',ovr:82},{name:'TSG 1899 Hoffenheim',ovr:81},{name:'Bayer 04 Leverkusen',ovr:82},
    {name:'SC Freiburg',ovr:77},{name:'Eintracht Frankfurt',ovr:78},{name:'FC Augsburg',ovr:76},
    {name:'1. FSV Mainz 05',ovr:77},{name:'1. FC Union Berlin',ovr:75},{name:'Borussia Mönchengladbach',ovr:76},
    {name:'Hamburger SV',ovr:73},{name:'1. FC Köln',ovr:74},{name:'SV Werder Bremen',ovr:72},
    {name:'FC Schalke 04',ovr:71},{name:'SV Elversberg',ovr:70},{name:'SC Paderborn 07',ovr:66}
  ],
  '2. Bundesliga': [
    {name:'VfL Wolfsburg',ovr:76},{name:'1. FC Heidenheim',ovr:72},{name:'FC St. Pauli',ovr:71},
    {name:'Hannover 96',ovr:70},{name:'Hertha BSC',ovr:69},{name:'SV Darmstadt 98',ovr:69},
    {name:'1. FC Nürnberg',ovr:68},{name:'VfL Bochum 1848',ovr:68},{name:'Karlsruher SC',ovr:68},
    {name:'Holstein Kiel',ovr:67},{name:'1. FC Kaiserslautern',ovr:67},{name:'Dynamo Dresden',ovr:66},
    {name:'Arminia Bielefeld',ovr:66},{name:'1. FC Magdeburg',ovr:65},{name:'SpVgg Greuther Fürth',ovr:64},
    {name:'Eintracht Braunschweig',ovr:64},{name:'VfL Osnabrück',ovr:63},{name:'FC Energie Cottbus',ovr:62}
  ],
  '3. Liga': [
    {name:'Fortuna Düsseldorf',ovr:63},{name:'SC Preußen Münster',ovr:62},{name:'Jahn Regensburg',ovr:61},
    {name:'1. FC Saarbrücken',ovr:61},{name:'Rot-Weiss Essen',ovr:60},{name:'Hansa Rostock',ovr:59},
    {name:'MSV Duisburg',ovr:59},{name:'SV Waldhof Mannheim',ovr:58},{name:'SV Wehen Wiesbaden',ovr:58},
    {name:'Alemannia Aachen',ovr:58},{name:'FC Ingolstadt 04',ovr:58},{name:'FC Viktoria Köln',ovr:57},
    {name:'TSG 1899 Hoffenheim II',ovr:57},{name:'VfB Stuttgart II',ovr:56},{name:'SC Verl',ovr:54},
    {name:'SV Meppen',ovr:54},{name:'Würzburger Kickers',ovr:54},{name:'SC Fortuna Köln',ovr:54},
    {name:'TSV Havelse',ovr:53},{name:'SG Sonnenhof Großaspach',ovr:53}
  ],
  'Regionalliga Nord': [
    {name:'VfB Lübeck',ovr:64},{name:'TSV Havelse',ovr:62},{name:'SV Meppen',ovr:63},
    {name:'Hannover 96 II',ovr:61},{name:'Werder Bremen II',ovr:60},{name:'Hamburg SV II',ovr:59},
    {name:'FC St. Pauli II',ovr:58},{name:'Holstein Kiel II',ovr:57},{name:'Altona 93',ovr:55},
    {name:'FC Eintracht Norderstedt',ovr:54},{name:'HSC Hannover',ovr:53},{name:'SV Drochtersen/Assel',ovr:53},
    {name:'TuS Dassendorf',ovr:52},{name:'SC Weiche Flensburg',ovr:51},{name:'Heider SV',ovr:51},
    {name:'FSV Schöningen',ovr:50},{name:'Phönix Lübeck',ovr:50},
    {name:'Eintracht Braunschweig II',ovr:52}
  ],
  'Regionalliga Nordost': [
    {name:'1. FC Lokomotive Leipzig',ovr:67},{name:'FC Carl Zeiss Jena',ovr:65},{name:'FC Rot-Weiß Erfurt',ovr:64},
    {name:'Hallescher FC',ovr:63},{name:'BFC Dynamo',ovr:61},{name:'VSG Altglienicke',ovr:59},
    {name:'Greifswalder FC',ovr:58},{name:'Hertha BSC II',ovr:57},{name:'SV Babelsberg 03',ovr:56},
    {name:'1. FC Magdeburg II',ovr:55},{name:'FC Energie Cottbus II',ovr:54},{name:'Chemie Leipzig',ovr:53},
    {name:'BFC Preussen',ovr:53},{name:'FC Eilenburg',ovr:51},{name:'FSV Luckenwalde',ovr:51},
    {name:'ZFC Meuselwitz',ovr:50},{name:'Hertha 03 Zehlendorf',ovr:50},
    {name:'SV Tasmania Berlin',ovr:52}
  ],
  'Regionalliga West': [
    {name:'Rot-Weiss Essen',ovr:66},{name:'Borussia Dortmund II',ovr:65},{name:'Wuppertaler SV',ovr:63},
    {name:'SC Fortuna Köln',ovr:62},{name:'FC Schalke 04 II',ovr:60},{name:'1. FC Köln II',ovr:59},
    {name:'SC Preußen Münster II',ovr:59},{name:'SV Rödinghausen',ovr:57},{name:'Fortuna Düsseldorf II',ovr:58},
    {name:'VfL Bochum II',ovr:56},{name:'Bonner SC',ovr:55},{name:'SC Wiedenbrück',ovr:54},
    {name:'FC Gütersloh',ovr:53},{name:'Sportfreunde Siegen',ovr:53},{name:'SV Lippstadt 08',ovr:52},
    {name:'SSVg Velbert',ovr:51},{name:'TuS Haltern',ovr:50},
    {name:'1. FC Bocholt',ovr:52}
  ],
  'Regionalliga Südwest': [
    {name:'SGV Freiberg',ovr:66},{name:'SV Sandhausen',ovr:65},{name:'SG Sonnenhof Großaspach',ovr:64},
    {name:'TSV Steinbach Haiger',ovr:63},{name:'FSV Frankfurt',ovr:62},{name:'Stuttgarter Kickers',ovr:61},
    {name:'FC Homburg',ovr:60},{name:'KSV Hessen Kassel',ovr:58},{name:'1. FC Saarbrücken II',ovr:57},
    {name:'FC Astoria Walldorf',ovr:55},{name:'VfR Wormatia Worms',ovr:56},{name:'SV Waldhof Mannheim II',ovr:54},
    {name:'FV Illertissen',ovr:53},{name:'TSG Balingen',ovr:51},{name:'FC Bayern Alzenau',ovr:51},
    {name:'TSV Schott Mainz',ovr:50},{name:'Bahlinger SC',ovr:50},
    {name:'Kickers Offenbach',ovr:54}
  ],
  'Regionalliga Bayern': [
    {name:'Würzburger Kickers',ovr:66},{name:'FC Bayern München II',ovr:65},{name:'SpVgg Unterhaching',ovr:64},
    {name:'Wacker Burghausen',ovr:62},{name:'1. FC Nürnberg II',ovr:62},{name:'FC Augsburg II',ovr:58},
    {name:'SpVgg Greuther Fürth II',ovr:57},{name:'TSV 1860 München II',ovr:59},{name:'FC Ingolstadt 04 II',ovr:56},
    {name:'VfB Eichstätt',ovr:54},{name:'FC Memmingen',ovr:53},{name:'Viktoria Aschaffenburg',ovr:52},
    {name:'SpVgg Hankofen-Hailing',ovr:51},{name:'ASV Cham',ovr:51},{name:'SV Schalding-Heining',ovr:50},
    {name:'FC Pipinsried',ovr:50},{name:'SV Wacker Burghausen',ovr:59},
    {name:'TSV Aubstadt',ovr:52}
  ]
};

// Baut aus GAME_DATA die Liga->Vereinsliste fürs Onboarding (oder null wenn keine Daten).
function onboardingLeaguesFromData() {
  if (!GAME_DATA) return null;
  const v = validateGameData(GAME_DATA);
  if (!v.ok) return null;
  const out = {};
  // Reihenfolge der Ligen festlegen
  ['Bundesliga','2. Bundesliga','3. Liga','Regionalliga Nord','Regionalliga Nordost','Regionalliga West','Regionalliga Südwest','Regionalliga Bayern'].forEach(l=>{ out[l]=[]; });
  v.clubs.forEach(c=>{
    if (!out[c.league]) out[c.league]=[];
    out[c.league].push({ name:c.name, ovr: Math.round((c.def+c.mid+c.att)/3), id:c.id });
  });
  // Flutlicht (Nutzer 2026-10-15): gestartet wird in Erster bis Dritter Liga, die Regionalliga ist nur Unterbau
  Object.keys(out).forEach(l=>{ if (/^Regionalliga/.test(l)) delete out[l]; });
  // leere Ligen entfernen, Vereine nach Stärke sortieren
  Object.keys(out).forEach(l=>{ if(!out[l].length) delete out[l]; else out[l].sort((a,b)=>b.ovr-a.ovr); });
  return Object.keys(out).length ? out : null;
}

async function showOnboarding() {
  const dataLeagues = onboardingLeaguesFromData();
  const SRC = dataLeagues || ONBOARDING_LEAGUES;
  const leagues = Object.keys(SRC);
  let selectedLeague = leagues.includes('3. Liga') ? '3. Liga' : leagues.includes('Regionalliga Nordost') ? 'Regionalliga Nordost' : leagues[0];
  let view = 'saves'; // 'saves' = Spielstand-Verwaltung, 'newclub' = Vereinswahl
  let savesIdx = await loadSavesIndex();
  // Gibt es überhaupt Spielstände? Wenn nicht, direkt zur Vereinswahl.
  if (!savesIdx.slots || savesIdx.slots.length === 0) view = 'newclub';

  const overlay = document.createElement('div');
  overlay.id = 'onboarding-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:var(--bg1,#0d1117);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto;';

  function fmtDate(ts) {
    if (!ts) return '';
    try { const d = new Date(ts); return d.toLocaleDateString('de-DE') + ' ' + d.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}); } catch(e) { return ''; }
  }

  function renderSaves() {
    const slots = [...(savesIdx.slots||[])].sort((a,b)=>(b.savedAt||0)-(a.savedAt||0));
    const rows = slots.length ? slots.map(s => `
      <div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--bg2,#161b22);border:1px solid var(--border,#30363d);border-radius:8px;margin-bottom:8px">
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;color:var(--text,#e6edf3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${String(s.name||'Spielstand').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}</div>
          <div style="font-size:10px;color:var(--text3,#6e7681)">${String(s.club||'—').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))} · Saison ${s.season||1} · ${fmtDate(s.savedAt)}</div>
        </div>
        <button onclick="window._obLoad('${s.id}')" style="padding:6px 12px;border-radius:6px;background:var(--accent,#388bfd);color:#fff;font-size:11px;font-weight:600;border:none;cursor:pointer">Laden</button>
        <button onclick="window._obExport('${s.id}')" title="Als JSON-Datei exportieren" style="padding:6px 9px;border-radius:6px;background:var(--bg4,#21262d);color:var(--text,#e6edf3);font-size:11px;border:1px solid var(--border,#30363d);cursor:pointer"><i class="ti ti-download" aria-hidden="true"></i></button>
        <button onclick="window._obRename('${s.id}')" title="Umbenennen" style="padding:6px 9px;border-radius:6px;background:var(--bg4,#21262d);color:var(--text,#e6edf3);font-size:11px;border:1px solid var(--border,#30363d);cursor:pointer"><i class="ti ti-edit" aria-hidden="true"></i></button>
        <button onclick="window._obDelete('${s.id}')" title="Löschen" style="padding:6px 9px;border-radius:6px;background:var(--bg4,#21262d);color:var(--red,#f85149);font-size:11px;border:1px solid var(--border,#30363d);cursor:pointer"><i class="ti ti-trash" aria-hidden="true"></i></button>
      </div>`).join('') : '<div style="font-size:12px;color:var(--text3,#6e7681);text-align:center;padding:20px 0">Noch keine Spielstände vorhanden.</div>';

    overlay.innerHTML = `
      <div style="max-width:540px;width:100%">
        <div style="text-align:center;margin-bottom:24px">
          <img src="icons/flutlicht_schriftzug.png" alt="Unter Flutlicht – Vereinskarriere" style="width:min(300px,78vw);height:auto;display:block;margin:0 auto 10px">
          <div style="font-size:20px;font-weight:700;color:var(--text,#e6edf3)">Spielstände</div>
          <div style="font-size:12px;color:var(--text2,#8b949e);margin-top:4px">Lade einen Spielstand, starte ein neues Spiel oder importiere eine Datei</div>
        </div>
        <div style="margin-bottom:16px">${rows}</div>
        <div style="display:flex;gap:8px">
          <button onclick="window._obNew()" style="flex:1;padding:10px 16px;border-radius:8px;background:var(--accent,#388bfd);color:#fff;font-size:13px;font-weight:600;border:none;cursor:pointer"><i class="ti ti-plus" aria-hidden="true"></i> Neues Spiel</button>
          <button onclick="window._obImport()" style="flex:1;padding:10px 16px;border-radius:8px;background:var(--bg2,#161b22);color:var(--text,#e6edf3);font-size:13px;font-weight:600;border:1px solid var(--border,#30363d);cursor:pointer"><i class="ti ti-upload" aria-hidden="true"></i> Spielstand importieren</button>
        </div>
        <input type="file" id="ob-import-file" accept="application/json,.json" style="display:none">
      </div>`;
    const fileInput = document.getElementById('ob-import-file');
    if (fileInput) fileInput.addEventListener('change', handleImportFile);
  }

  function renderNewClub() {
    const teams = SRC[selectedLeague] || [];
    const backBtn = (savesIdx.slots && savesIdx.slots.length)
      ? `<button onclick="window._obBack()" style="position:absolute;left:0;top:0;padding:6px 10px;border-radius:6px;background:var(--bg2,#161b22);color:var(--text2,#8b949e);font-size:11px;border:1px solid var(--border,#30363d);cursor:pointer"><i class="ti ti-arrow-left" aria-hidden="true"></i> Zurück</button>` : '';
    overlay.innerHTML = `
      <div style="max-width:500px;width:100%">
        <div style="text-align:center;margin-bottom:24px;position:relative">
          ${backBtn}
          <img src="icons/flutlicht_schriftzug.png" alt="Unter Flutlicht – Vereinskarriere" style="width:min(300px,78vw);height:auto;display:block;margin:0 auto 10px">
          <div style="font-size:20px;font-weight:700;color:var(--text,#e6edf3)">Welchen Verein übernimmst du?</div>
          <div style="font-size:12px;color:var(--text2,#8b949e);margin-top:4px">Wähle eine Liga und einen Verein — oder gib einen eigenen Namen ein</div>
        </div>
        <div style="margin-bottom:16px">
          <div style="font-size:11px;font-weight:600;color:var(--text2,#8b949e);margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">Liga</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${leagues.map(l=>`<button onclick="window._obLeague('${l}')" style="padding:6px 12px;border-radius:6px;border:1px solid ${l===selectedLeague?'var(--accent,#388bfd)':'var(--border,#30363d)'};background:${l===selectedLeague?'rgba(56,139,253,.15)':'var(--bg2,#161b22)'};color:${l===selectedLeague?'var(--accent,#388bfd)':'var(--text,#e6edf3)'};font-size:11px;cursor:pointer">${l.replace('Regionalliga ','')}</button>`).join('')}
          </div>
        </div>
        <div style="margin-bottom:16px">
          <div style="font-size:11px;font-weight:600;color:var(--text2,#8b949e);margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">Verein wählen</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;max-height:240px;overflow-y:auto;padding-right:2px">
            ${teams.map(t=>`<button onclick="window._obTeam('${t.name.replace(/'/g,"\\'")}',${t.ovr},'${t.id||''}')" style="padding:8px 10px;border-radius:6px;border:1px solid var(--border,#30363d);background:var(--bg2,#161b22);color:var(--text,#e6edf3);font-size:11px;cursor:pointer;text-align:left;display:flex;justify-content:space-between;align-items:center"><span>${t.name}</span><span style="color:var(--text3,#6e7681);font-size:10px;margin-left:6px;flex-shrink:0">${t.ovr}</span></button>`).join('')}
          </div>
        </div>
        <div>
          <div style="font-size:11px;font-weight:600;color:var(--text2,#8b949e);margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">Oder eigener Name</div>
          <div style="display:flex;gap:8px">
            <input id="ob-name" placeholder="z.B. FC Beispielstadt" style="flex:1;padding:8px 10px;border-radius:6px;border:1px solid var(--border,#30363d);background:var(--bg2,#161b22);color:var(--text,#e6edf3);font-size:12px;outline:none">
            <button onclick="window._obCustom()" style="padding:8px 16px;border-radius:6px;background:var(--accent,#388bfd);color:#fff;font-size:12px;font-weight:600;border:none;cursor:pointer">Start</button>
          </div>
          <div style="font-size:10px;color:var(--text3,#6e7681);margin-top:4px">Startet mit einer zur gewählten Liga passenden Stärke</div>
        </div>
      </div>`;
  }

  function render() { if (view === 'saves') renderSaves(); else renderNewClub(); }

  // Passende Standard-Stärke für einen selbst benannten Verein je Liga
  function customOvrForLeague(name) {
    if (name === 'Bundesliga') return 74;
    if (name === '2. Bundesliga') return 67;
    if (name === '3. Liga') return 58;
    return 60; // Regionalliga
  }

  async function handleImportFile(ev) {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const obj = JSON.parse(text);
      if (!obj || !obj.league || !obj.cup) { alert('Diese Datei ist kein gültiger Spielstand.'); return; }
      const newId = await importSaveObject(obj, obj.name);
      if (!newId) { alert('Import fehlgeschlagen.'); return; }
      savesIdx = await loadSavesIndex();
      view = 'saves';
      render();
    } catch(e) {
      alert('Die Datei konnte nicht gelesen werden. Ist es eine gültige JSON-Spielstand-Datei?');
    }
  }

  // ── Event-Handler ──
  window._obLeague = l => { selectedLeague = l; render(); };
  window._obTeam   = (name, ovr, dataClubId) => { document.body.removeChild(overlay); _beginNewGame({name, ovr, leagueName: selectedLeague, dataClubId: dataClubId || null}); };
  window._obCustom = () => {
    const name = (document.getElementById('ob-name').value||'').trim();
    if (!name) { alert('Bitte einen Vereinsnamen eingeben.'); return; }
    document.body.removeChild(overlay);
    _beginNewGame({name, ovr:customOvrForLeague(selectedLeague), leagueName: selectedLeague});
  };
  window._obNew = () => { view = 'newclub'; render(); };
  window._obBack = () => { view = 'saves'; render(); };
  window._obLoad = async (id) => {
    const ok = await loadSlot(id);
    if (!ok) { alert('Dieser Spielstand konnte nicht geladen werden.'); return; }
    document.body.removeChild(overlay);
    _afterLoad();
  };
  window._obDelete = async (id) => {
    const slot = (savesIdx.slots||[]).find(s=>s.id===id);
    if (!confirm(`Spielstand „${slot?slot.name:''}" wirklich dauerhaft löschen?`)) return;
    await deleteSlot(id);
    savesIdx = await loadSavesIndex();
    if (!savesIdx.slots.length) view = 'newclub';
    render();
  };
  window._obRename = async (id) => {
    const slot = (savesIdx.slots||[]).find(s=>s.id===id);
    const newName = prompt('Neuer Name für den Spielstand:', slot ? slot.name : '');
    if (newName && newName.trim()) {
      await renameSlot(id, newName.trim());
      savesIdx = await loadSavesIndex();
      render();
    }
  };
  window._obExport = async (id) => { await exportSlotToFile(id); };
  window._obImport = () => { const fi = document.getElementById('ob-import-file'); if (fi) fi.click(); };

  document.body.appendChild(overlay);
  render();
}

// Die Vereinswahl erscheint, während die späten Skripte noch laden. Ein früher Klick lief am
// TeamStrengthPatch (Stadion/Anlagen/Budget echter Vereine, wartet auf DOMContentLoaded) und am
// Karriere-Reset vorbei – Start mit allen Anlagen auf Stufe 1 und 6.000 Plätzen (gefunden 2026-10-16).
// Deshalb erst starten, wenn die Seite geladen ist und alle DOMContentLoaded-Haken gelaufen sind.
function _seiteBereit() {
  if (document.readyState !== 'loading') return Promise.resolve();
  return new Promise(res => document.addEventListener('DOMContentLoaded', () => setTimeout(res, 0), { once: true }));
}

// Startet ein neues Spiel: legt einen frischen, benannten Slot an und initialisiert den Zustand.
async function _beginNewGame(chosenTeam) {
  await _seiteBereit();
  await createNewSlot(chosenTeam.name || 'Neuer Spielstand');
  await startNewGameState(chosenTeam);
  _afterLoad();
}

// Exportiert einen Slot als JSON-Datei (lädt ihn kurz, serialisiert, triggert Download).
async function exportSlotToFile(id) {
  try {
    const l  = await window.storage.get(slotKey(id,'league'));
    const c  = await window.storage.get(slotKey(id,'cup'));
    const cl = await window.storage.get(slotKey(id,'club'));
    const mk = await window.storage.get(slotKey(id,'market'));
    if (!l || !c) { alert('Dieser Spielstand ist unvollständig und kann nicht exportiert werden.'); return; }
    const clubObj = cl ? JSON.parse(cl.value) : null;
    const name = (clubObj && clubObj.club && clubObj.club.name) ? clubObj.club.name : 'Spielstand';
    const obj = {
      fcmSave: true, version: 1, exportedAt: new Date().toISOString(), name,
      league: JSON.parse(l.value), cup: JSON.parse(c.value),
      club: clubObj, market: mk ? JSON.parse(mk.value) : null
    };
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = name.replace(/[^a-zA-Z0-9äöüÄÖÜ_-]+/g,'_');
    a.href = url;
    a.download = `Spielstand_${safeName}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(url), 1000);
  } catch(e) { alert('Export fehlgeschlagen.'); console.warn(e); }
}

async function _beginGame(chosenTeam) {
  await _seiteBereit();
  await startNewGameState(chosenTeam);
  _afterLoad();
}

// Erkennt den alten Platzhalter-Vereinsnamen aus früheren Versionen und korrigiert ihn
// einmalig (Name in CLUB und beim eigenen Verein 'fcm' in der Liga). Kein Neustart nötig.
function maybeFixLegacyClubName() {
  const legacy = (!CLUB.name || CLUB.name === 'FC Musterhausen' || CLUB.name === '—' || CLUB.shortName === 'FCM');
  if (!legacy) return;
  let name = null;
  try {
    name = window.prompt('Dieser Spielstand nutzt noch einen Platzhalter-Vereinsnamen. Wie soll dein Verein heißen?', '');
  } catch(e) { name = null; }
  if (name) name = name.trim();
  if (!name) name = 'Mein Verein'; // Fallback, falls leer/abgebrochen
  CLUB.name = name;
  CLUB.shortName = makeShortName(name);
  TEAMS.home.name = name;
  // Auch den eigenen Verein (fcm) in der gespeicherten Pyramide umbenennen
  if (LEAGUE) {
    for (const { group } of allGroups(LEAGUE)) {
      const own = group.teams.find(t => t.id === 'fcm');
      if (own) { own.name = name; break; }
    }
  }
  if (typeof saveGameState === 'function') saveGameState();
}
function _afterLoad() {
  // Alte Spielstände: wenn noch der frühere Platzhalter „FC Musterhausen" (oder ein leerer
  // Name) gespeichert ist, einmalig einen echten Vereinsnamen erfragen und überall setzen.
  maybeFixLegacyClubName();
  SQUAD.forEach(p => {
    if (p.def!=null && p.mid!=null && p.att!=null) {
      let guard = 0;
      while (computeOvrFromAreas(p) < p.ovr && guard < 30) {
        const areas = [['def',p.def],['mid',p.mid],['att',p.att]].sort((a,b)=>b[1]-a[1]);
        p[areas[0][0]] = clamp2(p[areas[0][0]] + 1, 20, 99);
        guard++;
      }
      while (computeOvrFromAreas(p) > p.ovr && guard < 60) {
        const areas = [['def',p.def],['mid',p.mid],['att',p.att]].sort((a,b)=>a[1]-b[1]);
        p[areas[2][0]] = clamp2(p[areas[2][0]] - 1, 20, 99);
        guard++;
      }
      p.ovr = computeOvrFromAreas(p);
    }
    // Verträge sicherstellen (Altstände / Startkader ohne Vertragsfelder)
    ensureContract(p, (LEAGUE && LEAGUE.season) || 1);
  });
  renderAll();
  renderLeagueTab();
  renderHomeTab();
  renderClubTab();
  // Erwartungs-System: falls noch eine Auswahl für die laufende Saison aussteht,
  // zuerst Philosophie, dann Sponsor anbieten (frisches Spiel oder geladener Stand).
  if (typeof EXP !== 'undefined') {
    const e = EXP.state();
    if (!e.philosophyId && e.pendingPhilosophyOffers && e.pendingPhilosophyOffers.length
        && typeof openPhilosophyChoiceDialog === 'function') {
      openPhilosophyChoiceDialog();
    } else if (!e.sponsorClauseId && e.pendingSponsorOffers && e.pendingSponsorOffers.length
        && typeof openSponsorChoiceDialog === 'function') {
      openSponsorChoiceDialog();
    }
  }
}

// ── DATEN LADEN (clubs.json + players.json) ──────────────────────
// Quelle 1: eingebettet im HTML als window.EMBEDDED_CLUBS / window.EMBEDDED_PLAYERS
// Quelle 2: externe Dateien clubs.json + players.json neben der HTML (per fetch)
// Schlägt beides fehl, läuft das Spiel mit den eingebauten Standard-Daten.
async function loadGameData() {
  // 1) Eingebettete Daten?
  if (typeof window !== 'undefined' && (window.EMBEDDED_CLUBS || window.EMBEDDED_PLAYERS)) {
    GAME_DATA = { clubs: window.EMBEDDED_CLUBS || [], players: window.EMBEDDED_PLAYERS || [] };
    reportDataStatus();
    return;
  }
  // 2) Externe JSON-Dateien?
  try {
    const [cRes, pRes] = await Promise.all([
      fetch('clubs.json').catch(()=>null),
      fetch('players.json').catch(()=>null)
    ]);
    if (cRes && cRes.ok) {
      const clubs = await cRes.json();
      let players = [];
      if (pRes && pRes.ok) players = await pRes.json();
      GAME_DATA = { clubs, players };
      reportDataStatus();
      return;
    }
  } catch(e) { /* keine externen Daten – kein Problem */ }
  GAME_DATA = null; // Standard-Daten verwenden
}
function reportDataStatus() {
  if (!GAME_DATA) return;
  const v = validateGameData(GAME_DATA);
  const nClubs = v.clubs.length;
  const nPlayers = Object.values(v.playersByClub||{}).reduce((s,a)=>s+a.length,0);
  console.log(`📦 Spieldaten geladen: ${nClubs} Vereine, ${nPlayers} Spieler.`);
  if (v.errors.length) console.warn('⚠️ Daten-Hinweise:\n - ' + v.errors.join('\n - '));
}

// ── INIT ─────────────────────────────────────────────────────
(async function initGame() {
  await loadGameData();
  const loaded = await loadGameState();
  if (!loaded) {
    await showOnboarding();
  } else {
    _afterLoad();
  }
})();


// ═══ ERWARTUNGS-SYSTEM · UI-FUNKTIONEN ═══
/* ═══════════════════════════════════════════════════════════════════════════
   ERWARTUNGS-SYSTEM · UI-SCHICHT  (Schritt 2)
   ───────────────────────────────────────────────────────────────────────────
   - CSS im Stil des bestehenden Spiels (nutzt die :root-Variablen)
   - renderExpectationsPanel()  → großes Panel im Verein-Tab
   - renderExpectationsSummary() → kompakte Karte im Home-Tab
   - openSponsorChoiceDialog()  → Overlay zur Sponsorenauswahl bei Saisonbeginn
   - onExpectationsGameOver()   → Game-Over-Overlay (vom Engine-Hook gerufen)
   Alle Funktionen sind defensiv (null-checks), damit nichts bricht wenn ein
   Container fehlt oder EXP noch nicht initialisiert ist.
   ═══════════════════════════════════════════════════════════════════════════ */


/* ── Farb-Helfer: Wert 0-100 → Ampelfarbe ── */
function expSatColor(v) {
  if (v >= 60) return 'var(--accent)';
  if (v >= 35) return 'var(--gold)';
  return 'var(--red)';
}
function expSatWord(v) {
  if (v >= 80) return 'begeistert';
  if (v >= 60) return 'zufrieden';
  if (v >= 40) return 'neutral';
  if (v >= 20) return 'unzufrieden';
  return 'kritisch';
}

/* ── Ein Zufriedenheits-Balken (HTML) ── */
function expMeterHtml(label, val, withWord) {
  const col = expSatColor(val);
  return `<div class="exp-meter">
    <div class="exp-meter-head">
      <span class="exp-meter-label">${label}</span>
      <span class="exp-meter-val" style="color:${col}">${val}%${withWord?` · ${expSatWord(val)}`:''}</span>
    </div>
    <div class="exp-bar"><div class="exp-bar-fill" style="width:${val}%;background:${col}"></div></div>
  </div>`;
}

/* ═══════════════════════════════════════════════════════════════════════
   GROSSES PANEL (Verein-Tab)
   ═══════════════════════════════════════════════════════════════════════ */
function renderExpectationsPanel() {
  const el = document.getElementById('exp-panel'); if (!el || typeof EXP === 'undefined') return;
  const e = EXP.state();
  const phil = EXP.philosophy();
  const sp = EXP.sponsor();
  const t = e.tracking;

  // — Zufriedenheits-Sektion mit Fan-Fraktionen —
  const ultras = e.fanFactions.ultras, event = e.fanFactions.eventFans;
  const satSection = `<div class="exp-section">
    <div class="exp-section-title"><i class="ti ti-mood-smile"></i> Zufriedenheit</div>
    ${expMeterHtml('Vorstand', e.boardSatisfaction, true)}
    ${expMeterHtml('Fans (gesamt)', e.fanSatisfaction, true)}
    <div class="exp-sub-factions">
      <div class="exp-faction">
        <div class="exp-faction-head"><span>🪧 Traditions-Ultras</span><span style="color:${expSatColor(ultras)}">${ultras}%</span></div>
        <div class="exp-faction-bar"><div class="exp-faction-fill" style="width:${ultras}%;background:${expSatColor(ultras)}"></div></div>
      </div>
      <div class="exp-faction">
        <div class="exp-faction-head"><span>🎉 Event-Fans</span><span style="color:${expSatColor(event)}">${event}%</span></div>
        <div class="exp-faction-bar"><div class="exp-faction-fill" style="width:${event}%;background:${expSatColor(event)}"></div></div>
      </div>
    </div>
    ${e.boardSatisfaction < EXP.CFG.boardGameOverThreshold + 10
      ? `<div style="margin-top:10px;font-size:10px;color:var(--red);font-weight:600">⚠️ Achtung: Fällt der Vorstand unter ${EXP.CFG.boardGameOverThreshold}%, droht am Monatsende die Entlassung.</div>` : ''}
  </div>`;

  // — Philosophie-Sektion —
  let philSection = '';
  if (phil) {
    const g = e.seasonGoals || {};
    // Live-Fortschritt der Zusatzziele
    const prog = [];
    if (g.minGoalsFor != null) prog.push(`⚽ Tore: ${t.goalsFor}/${g.minGoalsFor}`);
    if (g.maxGoalsAgainst != null) prog.push(`🛡️ Gegentore: ${t.goalsAgainst}/${g.maxGoalsAgainst} max`);
    if (g.wantOvrGain != null && g.wantOvrGain > 0) prog.push(`📈 Kader-OVR steigern (+${g.wantOvrGain})`);
    if (g.wantYounger != null) prog.push(`🌱 Kader verjüngen (−${g.wantYounger} J)`);
    const progHtml = prog.length ? `<div class="exp-goal-progress">${prog.map(p=>`<span class="exp-goal-chip">${p}</span>`).join('')}</div>` : '';
    philSection = `<div class="exp-section">
      <div class="exp-section-title"><i class="ti ti-building-bank"></i> Vorstands-Philosophie</div>
      <div class="exp-phil-name">${phil.label}</div>
      <div class="exp-phil-flavor">${phil.flavor}</div>
      <div class="exp-goal-box">🎯 <b>Saisonziel:</b> ${g.note || '—'}${g.extraNote ? '<br><span style="color:var(--text2);font-size:10px">'+g.extraNote+'</span>' : ''}</div>
      ${progHtml}
      <div class="exp-goal-consequence">⚠️ Verfehlst du die Ziele, sinkt die Vorstands-Zufriedenheit. Fällt sie unter ${EXP.CFG.boardGameOverThreshold}%, wirst du entlassen (Spielende).</div>
      ${renderExpTrackingChips(phil, g, t)}
    </div>`;
  } else if (e.pendingPhilosophyOffers && e.pendingPhilosophyOffers.length) {
    philSection = `<div class="exp-section">
      <div class="exp-section-title"><i class="ti ti-building-bank"></i> Vorstands-Philosophie</div>
      <div class="exp-sponsor-none">📋 Du hast noch keine Philosophie für diese Saison gewählt.</div>
      <button class="fc-upgrade" onclick="openPhilosophyChoiceDialog()">Jetzt Philosophie wählen (${e.pendingPhilosophyOffers.length} Optionen)</button>
    </div>`;
  }

  // — Sponsor-Sektion —
  let spSection = `<div class="exp-section">
    <div class="exp-section-title"><i class="ti ti-businessplan"></i> Aktiver Hauptsponsor</div>`;
  if (sp) {
    spSection += `<div class="exp-sponsor-active">
      <div class="exp-sponsor-name">${sp.label}</div>
      <div class="exp-sponsor-flavor">${sp.flavor}</div>
    </div>`;
  } else if (e.pendingSponsorOffers && e.pendingSponsorOffers.length) {
    spSection += `<div class="exp-sponsor-none">📋 Du hast noch keinen Sponsor für diese Saison gewählt.</div>
      <button class="fc-upgrade" onclick="openSponsorChoiceDialog()">Jetzt Sponsor wählen (${e.pendingSponsorOffers.length} Angebote)</button>`;
  } else {
    spSection += `<div class="exp-sponsor-flavor">Kein Sponsor aktiv.</div>`;
  }
  spSection += `</div>`;

  el.innerHTML = satSection + philSection + spSection;
}

/* — Tracking-Chips je nach Philosophie — */
function renderExpTrackingChips(phil, g, t) {
  const chips = [];
  // U21-Starts (relevant bei Jugendwahn / Nachwuchs)
  if (g.minU21Starts != null) {
    const ok = t.u21Starts >= g.minU21Starts;
    chips.push(`<div class="exp-chip ${ok?'good':'warn'}"><div class="exp-chip-label">U21 in Startelf</div><div class="exp-chip-val">${t.u21Starts} / ${g.minU21Starts}</div></div>`);
  } else {
    chips.push(`<div class="exp-chip"><div class="exp-chip-label">U21-Starts</div><div class="exp-chip-val">${t.u21Starts}</div></div>`);
  }
  // Star-Transfer (Kaufrausch)
  if (g.requireStarSigning) {
    chips.push(`<div class="exp-chip ${t.starSigned?'good':'warn'}"><div class="exp-chip-label">Star verpflichtet</div><div class="exp-chip-val">${t.starSigned?'✓ Ja':'✗ Nein'}</div></div>`);
  }
  // Mindestkontostand (Sparfuchs)
  if (g.minBalance != null) {
    const ok = CLUB.budget >= g.minBalance;
    chips.push(`<div class="exp-chip ${ok?'good':'warn'}"><div class="exp-chip-label">Konto-Ziel</div><div class="exp-chip-val">${formatEuro(g.minBalance)}</div></div>`);
  }
  // Rote Karten (immer interessant; warnt ab Fairplay-Limit des Wettanbieters)
  const redWarn = t.redCards > 6;
  chips.push(`<div class="exp-chip ${redWarn?'warn':''}"><div class="exp-chip-label">Rote Karten</div><div class="exp-chip-val">${t.redCards}</div></div>`);
  // Verstöße
  if (t.illegalTransfers > 0) {
    chips.push(`<div class="exp-chip warn"><div class="exp-chip-label">Regelverstöße</div><div class="exp-chip-val">${t.illegalTransfers}</div></div>`);
  }
  // Weiße Westen
  chips.push(`<div class="exp-chip"><div class="exp-chip-label">Spiele o. Gegentor</div><div class="exp-chip-val">${t.cleanSheets}</div></div>`);

  return `<div class="exp-track-grid">${chips.join('')}</div>`;
}

/* ═══════════════════════════════════════════════════════════════════════
   KOMPAKTKARTE (Home-Tab)
   ═══════════════════════════════════════════════════════════════════════ */
function renderExpectationsSummary() {
  const el = document.getElementById('exp-home-card'); if (!el || typeof EXP === 'undefined') return;
  const e = EXP.state();
  const phil = EXP.philosophy();
  el.innerHTML = `<div class="exp-home-card">
    <div class="exp-home-row">
      <div class="exp-home-rowhead"><span class="exp-home-label">🏛️ Vorstand</span><span class="exp-home-val" style="color:${expSatColor(e.boardSatisfaction)}">${e.boardSatisfaction}%</span></div>
      <div class="exp-bar"><div class="exp-bar-fill" style="width:${e.boardSatisfaction}%;background:${expSatColor(e.boardSatisfaction)}"></div></div>
    </div>
    <div class="exp-home-row">
      <div class="exp-home-rowhead"><span class="exp-home-label">👥 Fans</span><span class="exp-home-val" style="color:${expSatColor(e.fanSatisfaction)}">${e.fanSatisfaction}%</span></div>
      <div class="exp-bar"><div class="exp-bar-fill" style="width:${e.fanSatisfaction}%;background:${expSatColor(e.fanSatisfaction)}"></div></div>
    </div>
    ${phil ? `<div class="exp-home-phil">Vorgabe: <b style="color:var(--gold)">${phil.label}</b></div>` : ''}
  </div>`;
}

/* ═══════════════════════════════════════════════════════════════════════
   SPONSOREN-AUSWAHL-OVERLAY
   ═══════════════════════════════════════════════════════════════════════ */
// ── PHILOSOPHIE-AUSWAHL (Saisonbeginn, vor der Sponsorenwahl) ──────
function openPhilosophyChoiceDialog() {
  if (typeof EXP === 'undefined') return;
  const e = EXP.state();
  if (!e.pendingPhilosophyOffers || !e.pendingPhilosophyOffers.length) return;
  if (document.querySelector('.exp-overlay')) return;

  // computeGoals erwartet ein OBJEKT { pos, total } und rechnet mit prev.pos.
  // Hier stand früher nur die nackte Platzziffer — damit war prev.pos undefined
  // und im Dialog stand „Tabellenplatz ≤ NaN", ausgerechnet auf dem allerersten
  // Bildschirm einer neuen Karriere.
  const prevPos = (() => {
    try {
      const fg = findFcmGroup(LEAGUE);
      const tbl = computeTable(fg.group.teams);
      const me = tbl.findIndex(t => t.id === 'fcm') + 1;
      return { pos: me || Math.ceil(tbl.length / 2), total: tbl.length || 16 };
    } catch (_) { return { pos: 8, total: 16 }; }
  })();
  const offersHtml = e.pendingPhilosophyOffers.map(id => {
    const phil = EXP.PHILOSOPHIES[id];
    let goalNote = '';
    try { goalNote = phil.computeGoals(prevPos).note; } catch(_) {}
    return `<div class="exp-offer">
      <div class="exp-offer-name">${phil.label}</div>
      <div class="exp-offer-flavor">${phil.flavor}</div>
      <div class="exp-offer-terms">
        ${goalNote ? `<span class="exp-offer-term">Saisonziel: <b>${goalNote}</b></span>` : ''}
      </div>
      <button class="exp-offer-btn" onclick="choosePhilosophyFromDialog('${id}')">Diesen Weg einschlagen</button>
    </div>`;
  }).join('');

  const ov = document.createElement('div');
  ov.className = 'exp-overlay';
  ov.innerHTML = `<div class="exp-dialog">
    <div class="exp-dialog-title"><i class="ti ti-building-bank"></i> Vereins-Philosophie ${LEAGUE ? '· Saison '+LEAGUE.season : ''}</div>
    <div class="exp-dialog-sub">Der Vorstand legt die Ausrichtung für die kommende Saison fest. Jede Philosophie setzt ein eigenes Saisonziel und beeinflusst, woran Vorstand und Fans deine Arbeit messen. Nach deiner Wahl folgt die Sponsorenwahl.</div>
    <div class="exp-offer-grid">${offersHtml}</div>
  </div>`;
  document.body.appendChild(ov);
}

function choosePhilosophyFromDialog(id) {
  if (typeof EXP === 'undefined') return;
  EXP.choosePhilosophy(id);
  const ov = document.querySelector('.exp-overlay'); if (ov) ov.remove();
  if (typeof saveGameState === 'function') saveGameState();
  if (typeof renderClubTab === 'function') renderClubTab();
  if (typeof renderHomeTab === 'function') renderHomeTab();
  // Direkt im Anschluss die Sponsorenwahl öffnen (Flow: Philosophie → Sponsor)
  setTimeout(() => { if (typeof openSponsorChoiceDialog === 'function') openSponsorChoiceDialog(); }, 250);
}

function openSponsorChoiceDialog() {
  if (typeof EXP === 'undefined') return;
  const e = EXP.state();
  if (!e.pendingSponsorOffers || !e.pendingSponsorOffers.length) return;
  // Doppelte Overlays vermeiden
  if (document.querySelector('.exp-overlay')) return;

  const tierFac = ({ bundesliga:40, bundesliga2:12, liga3:3, regionalliga:1 })[tierKeyOf()] || 1;
  const offersHtml = e.pendingSponsorOffers.map(id => {
    const sp = EXP.SPONSOR_CLAUSES[id];
    const weeklyBase = Math.round(sp.base * tierFac);
    return `<div class="exp-offer">
      <div class="exp-offer-name">${sp.label}</div>
      <div class="exp-offer-flavor">${sp.flavor}</div>
      <div class="exp-offer-terms">
        <span class="exp-offer-term">Basisgehalt: <b>${formatEuro(weeklyBase)}</b>/Woche</span>
      </div>
      <button class="exp-offer-btn" onclick="chooseSponsorFromDialog('${id}')">Diesen Sponsor wählen</button>
    </div>`;
  }).join('');

  const ov = document.createElement('div');
  ov.className = 'exp-overlay';
  ov.innerHTML = `<div class="exp-dialog">
    <div class="exp-dialog-title"><i class="ti ti-businessplan"></i> Sponsorenwahl ${LEAGUE ? '· Saison '+LEAGUE.season : ''}</div>
    <div class="exp-dialog-sub">Wähle deinen Hauptsponsor für die kommende Saison. Jeder zahlt ein wöchentliches Basisgehalt und knüpft eine eigene Bonus- oder Strafklausel daran. Die Wahl gilt für die gesamte Saison.</div>
    <div class="exp-offer-grid">${offersHtml}</div>
  </div>`;
  document.body.appendChild(ov);
}

function chooseSponsorFromDialog(id) {
  if (typeof EXP === 'undefined') return;
  EXP.chooseSponsor(id);
  const ov = document.querySelector('.exp-overlay'); if (ov) ov.remove();
  const sp = EXP.SPONSOR_CLAUSES[id];
  addNews('club', `🤝 Sponsor unterschrieben: ${sp.label}`, `${sp.flavor}`);
  if (typeof saveGameState === 'function') saveGameState();
  if (typeof renderClubTab === 'function') renderClubTab();
  if (typeof renderHomeTab === 'function') renderHomeTab();
}

/* ═══════════════════════════════════════════════════════════════════════
   GAME-OVER-OVERLAY  (vom Engine-Hook EXP._gameOver aufgerufen)
   ═══════════════════════════════════════════════════════════════════════ */
function onExpectationsGameOver(e) {
  if (document.querySelector('.exp-gameover')) return;
  const ov = document.createElement('div');
  ov.className = 'exp-gameover';
  ov.innerHTML = `<div class="exp-gameover-box">
    <div class="exp-gameover-icon"><i class="ti ti-door-exit"></i></div>
    <div class="exp-gameover-title">ENTLASSEN</div>
    <div class="exp-gameover-text">
      Die Vorstands-Zufriedenheit ist auf <b style="color:var(--red)">${e.boardSatisfaction}%</b> gefallen.<br>
      Der Verein hat sich von dir getrennt. Deine Amtszeit bei ${typeof clubName==='function'?clubName():'dem Verein'} ist beendet.
    </div>
    <button class="exp-gameover-btn" onclick="expRestartAfterGameOver()">Neues Spiel starten</button>
  </div>`;
  document.body.appendChild(ov);
}

async function expRestartAfterGameOver() {
  const ov = document.querySelector('.exp-gameover'); if (ov) ov.remove();
  // Direkt an die echte Reset-Logik des Spiels delegieren (ohne Rückfrage,
  // da die Entlassung bereits feststeht).
  if (typeof resetGameStorage === 'function') {
    await resetGameStorage();
    LEAGUE = null; CUP = null; MARKET = null;
    ACTIVE_SLOT_ID = null;
    if (typeof showOnboarding === 'function') { await showOnboarding(); return; }
  }
  location.reload();
}