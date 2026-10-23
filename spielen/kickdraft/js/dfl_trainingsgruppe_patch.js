/* ═══════════════════════════════════════════════════════════════════════════
   DFL · TRAININGSGRUPPE  ·  v1   (D38, ersetzt die Nachwuchsabteilung)
   ─────────────────────────────────────────────────────────────────────────
   Wer nicht spielt, trainiert in der Trainingsgruppe – drei Teile wie in der NFL:
   • Development Squad (dfl_kader_patch.js, D45): 6 Plätze, ≤ 21, zählt gegen den Cap, spielt nicht.
   • Verletztenliste: ab 4 Wochen Ausfall. Zählt gegen den Cap, aber nicht gegen die 28;
     zurück frühestens nach 4 Wochen, gesund und nur mit freiem Kaderplatz. Zum Saisonstart
     kommen alle automatisch zurück (dann gilt der Kaderschnitt vor Spieltag 1).
   • Nicht im Spieltagskader: alle Gesunden außer Startelf, 7 Bankspielern (wie die Engine)
     und dem Ersatztorwart.

   Wirkung: Ohne Einsätze entwickeln sich Spieler nur mit 15 % des Tempos (playtimeFactor,
   bundle_match.js). Training ersetzt einen Teil der Spielpraxis: Development Squad 80 % (D45, vorher 55 %),
   Spieler bis 23 ohne Stammplatz 40 %, Mentor +10 %. Einzeltraining (Schwerpunkt) gilt für
   alle außerhalb des Spieltagskaders. Testlauf 2026-10-08: Stammspieler ≈ +4 OVR/Saison,
   Perspektivkader (55 %) ≈ +2,4, mit Mentor ≈ +2,9, ohne Trainingsgruppe ≈ +0,7 (KI-Welt: 4,2 / 2,8). Andockstellen: window.trainingsgruppeFaktor,
   window.einzelSchwerpunkt (bundle_match.js), TrainingSystem.renderTrainingTab.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const CFG = {
    // D45: Development Squad 80 % – schneller als die Bank (40 %), langsamer als Spielzeit (100 %).
    // Gemessen (20-Jährige, OVR nach 3 Saisons): Stamm +11, Squad +8,9 (Mentor +10), Bank +4,5
    faktor: { perspektiv: 0.80, inaktivJung: 0.40, mentor: 0.10, jungBis: 23 },
    verletztenliste: { abWochen: 4, mindestWochen: 4 },
    // Entwicklungskurve (D48): Jugendschub im eigenen Verein. Die Altersstufe ≤ 22 (Faktor 2,84) gilt bis 20 voll,
    // 21 → 2,4, 22 → 2,05; 23–25 (2,21) → 1,85, damit die Kurve nicht wieder ansteigt. Stärke-Faktor aus DFLSaison.
    alterSpiel: { 21: 0.845, 22: 0.72, 23: 0.84, 24: 0.84, 25: 0.84 },
    kader: 28,              // Spec: 28 + 6
    bank: 7,                // so viele Feldspieler nimmt die Engine auf die Bank
    mentorAb: 28,
    mentorMax: 2,
    schwerpunkte: {
      ausgewogen:  { label: 'Ausgewogen',       def: 1,   mid: 1,   att: 1,   pace: 0.5 },
      abwehr:      { label: 'Abwehr',           def: 2.2, mid: 0.8, att: 0.4, pace: 0.5 },
      spielaufbau: { label: 'Spielaufbau',      def: 0.6, mid: 2.2, att: 0.8, pace: 0.4 },
      abschluss:   { label: 'Abschluss',        def: 0.4, mid: 0.8, att: 2.2, pace: 0.6 },
      tempo:       { label: 'Tempo & Athletik', def: 0.5, mid: 0.5, att: 0.5, pace: 2.2 }
    }
  };

  const dfl = () => typeof CLUB !== 'undefined' && CLUB && CLUB.dfl && CLUB.dfl.aktiv;
  const kader = () => (typeof SQUAD !== 'undefined' ? SQUAD : []);
  const verletzt = p => (typeof isInjured === 'function' ? isInjured(p) : (p.injuryWeeks || 0) > 0);
  const gesperrt = p => (typeof isSuspended === 'function' ? isSuspended(p) : false);
  const name = p => ((p.firstName ? p.firstName + ' ' : '') + p.name).trim();
  const wochenJeSaison = () => (typeof SEASON_WEEKS === 'number' ? SEASON_WEEKS : 52);
  const wochenStand = () => (LEAGUE.season || 1) * wochenJeSaison() + (LEAGUE.week || 0);
  const gruppe = p => {
    const pos = p.pos || 'ZM';
    if (pos === 'TW') return 'TW';
    if (['IV', 'AV', 'LV', 'RV'].includes(pos)) return 'Abwehr';
    if (['ST', 'FL', 'LF', 'RF', 'LA', 'RA', 'MS', 'HS'].includes(pos)) return 'Angriff';     // D95: LF/RF
    return 'Mittelfeld';
  };
  const hauptkader = () => kader().filter(p => !p.perspektiv && !p.verletztenliste && !p.onLoanAt);

  // ── Spieltagskader: Startelf + 7 Bank (beste nach Stärke × Fitness, ohne TW) + Ersatztorwart ──
  function spieltagskader() {
    const elf = new Set(typeof getLineupIds === 'function' ? getLineupIds() : []);
    const frei = kader().filter(p => !elf.has(p.id) && !p.perspektiv && !p.verletztenliste && !verletzt(p) && !gesperrt(p));
    const fit = p => (p.fitness != null ? p.fitness : 95) / 100;
    const bank = frei.filter(p => p.pos !== 'TW').sort((a, b) => b.ovr * fit(b) - a.ovr * fit(a)).slice(0, CFG.bank);
    const ersatzTw = frei.filter(p => p.pos === 'TW').sort((a, b) => b.ovr - a.ovr)[0];
    const ids = new Set([...elf, ...bank.map(p => p.id)]);
    if (ersatzTw) ids.add(ersatzTw.id);
    return ids;
  }
  function gruppen() {
    const sk = spieltagskader();
    const rest = kader().filter(p => !p.perspektiv && !p.verletztenliste);
    return {
      perspektiv: kader().filter(p => p.perspektiv),
      verletztenliste: kader().filter(p => p.verletztenliste),
      inaktiv: rest.filter(p => !sk.has(p.id) && !verletzt(p)),
      verletzt: rest.filter(p => verletzt(p))
    };
  }

  // ── Mentor ───────────────────────────────────────────────────────────────
  function mentorTauglich(m, fuer) {
    return m && m.id !== fuer.id && !m.perspektiv && !m.verletztenliste && (m.age || 0) >= CFG.mentorAb && gruppe(m) === gruppe(fuer);
  }
  function schuetzlinge(m) { return kader().filter(p => p.tgMentor === m.id); }
  function mentorVon(p) {
    if (!p.tgMentor) return null;
    const m = kader().find(x => x.id === p.tgMentor);
    return mentorTauglich(m, p) ? m : null;
  }

  // ── Andockstellen für die Entwicklung (bundle_match.js) ──────────────────
  // Untergrenze für den Spielpraxis-Faktor: Training ersetzt einen Teil der Einsätze.
  window.trainingsgruppeFaktor = function (p) {
    if (!dfl() || !p || p.verletztenliste || verletzt(p)) return 0;
    let f = 0;
    if (p.perspektiv) f = CFG.faktor.perspektiv;
    else if ((p.age || 99) <= CFG.faktor.jungBis) f = CFG.faktor.inaktivJung;    // auch junge Bankspieler: sonst lohnte es, Talente aus dem Kader zu nehmen
    if (f && mentorVon(p)) f += CFG.faktor.mentor;
    return f;
  };
  // Entwicklungskurve (D48): je besser, desto langsamer; Jugendschub lässt mit 21/22 nach (wirkt in effectiveTickChance)
  {
    const _orig = window.traitDevFaktor;
    window.traitDevFaktor = function (p) {
      const f = typeof _orig === 'function' ? _orig.apply(this, arguments) : 1;
      if (!dfl() || !p || !window.DFLSaison || !DFLSaison.ovrFaktor) return f;
      return f * DFLSaison.ovrFaktor(p.ovr || 60) * (CFG.alterSpiel[p.age || 25] || 1);
    };
  }
  // Einzeltraining: eigener Schwerpunkt für Spieler der Trainingsgruppe
  window.einzelSchwerpunkt = function (p) {
    if (!dfl() || !p || !p.tgSchwerpunkt || !CFG.schwerpunkte[p.tgSchwerpunkt]) return null;
    if (!p.perspektiv && spieltagskader().has(p.id)) return null;   // wer spielt, folgt dem Mannschaftstraining
    return CFG.schwerpunkte[p.tgSchwerpunkt];
  };

  // ── Verletztenliste ──────────────────────────────────────────────────────
  function zurueckholbar(p) {
    const seit = p.verletztenliste ? wochenStand() - p.verletztenliste.seit : 0;
    if (seit < CFG.verletztenliste.mindestWochen) return { ok: false, grund: `frühestens in ${CFG.verletztenliste.mindestWochen - seit} Woche(n)` };
    if (verletzt(p)) return { ok: false, grund: `noch ${p.injuryWeeks} Woche(n) verletzt` };
    if (hauptkader().length >= CFG.kader) return { ok: false, grund: `Kader voll (${CFG.kader}) – erst Platz schaffen` };
    return { ok: true, grund: '' };
  }
  function nachAenderung() {
    try { if (window.DFLKader && DFLKader.capSetzen) DFLKader.capSetzen(); } catch (e) { /* nur im Spiel */ }
    try { if (window.DFLSpiel && DFLSpiel.weltGeaendert) DFLSpiel.weltGeaendert(); } catch (e) { /* nur im Spiel */ }
    if (typeof renderAll === 'function') renderAll();
    zeichne();
    if (typeof saveGameState === 'function') saveGameState();
  }
  function aufVerletztenliste(id) {
    const p = kader().find(x => x.id === id);
    if (!dfl() || !p || p.perspektiv || p.verletztenliste) return;
    if ((p.injuryWeeks || 0) < CFG.verletztenliste.abWochen) {
      alert(`Auf die Verletztenliste nur bei mindestens ${CFG.verletztenliste.abWochen} Wochen Ausfall.`);
      return;
    }
    p.verletztenliste = { seit: wochenStand() };
    if (typeof clearFromLineup === 'function') clearFromLineup(p.id);
    if (typeof addNews === 'function') addNews('squad', '🩹 Verletztenliste: ' + p.name,
      `${name(p)} (${p.injuryWeeks} Wochen verletzt) kommt auf die Verletztenliste. Sein Kaderplatz ist frei, ` +
      `sein Gehalt zählt weiter gegen den Cap. Zurück frühestens in ${CFG.verletztenliste.mindestWochen} Wochen.`);
    nachAenderung();
  }
  function vonVerletztenliste(id) {
    const p = kader().find(x => x.id === id);
    if (!dfl() || !p || !p.verletztenliste) return;
    const z = zurueckholbar(p);
    if (!z.ok) { alert(`${name(p)} kann noch nicht zurück: ${z.grund}.`); return; }
    delete p.verletztenliste;
    if (typeof addNews === 'function') addNews('squad', '💪 Zurück im Kader: ' + p.name, `${name(p)} ist wieder fit und zurück im 28er-Kader.`);
    nachAenderung();
  }

  // ── Einstellungen je Spieler ─────────────────────────────────────────────
  function schwerpunkt(id, key) {
    const p = kader().find(x => x.id === id); if (!p) return;
    if (CFG.schwerpunkte[key] && key !== 'ausgewogen') p.tgSchwerpunkt = key; else delete p.tgSchwerpunkt;
    nachAenderung();
  }
  function mentor(id, mentorId) {
    const p = kader().find(x => x.id === id); if (!p) return;
    const m = kader().find(x => x.id === mentorId);
    if (!mentorId || !m) { delete p.tgMentor; nachAenderung(); return; }
    if (!mentorTauglich(m, p)) { alert('Mentor muss mindestens 28 sein und im selben Mannschaftsteil spielen.'); return; }
    if (schuetzlinge(m).filter(x => x.id !== p.id).length >= CFG.mentorMax) { alert(`${name(m)} betreut schon ${CFG.mentorMax} Spieler.`); return; }
    p.tgMentor = m.id;
    nachAenderung();
  }

  // ── Anzeige im Reiter Training ───────────────────────────────────────────
  const prozent = f => Math.round(f * 100) + ' %';
  function potText(p) {
    const sc = (CLUB.facilities && CLUB.facilities.scouting) || 5;
    return typeof potentialDisplay === 'function' ? potentialDisplay(p, sc) : 'Pot ' + (p.truePotential || '?');
  }
  function auswahlSchwerpunkt(p) {
    return `<select class="tg-wahl" onchange="DFLTraining.schwerpunkt('${p.id}', this.value)" aria-label="Schwerpunkt für ${name(p)}">` +
      Object.entries(CFG.schwerpunkte).map(([k, s]) => `<option value="${k}"${(p.tgSchwerpunkt || 'ausgewogen') === k ? ' selected' : ''}>${s.label}</option>`).join('') + '</select>';
  }
  function auswahlMentor(p) {
    const kandidaten = kader().filter(m => mentorTauglich(m, p)).sort((a, b) => b.ovr - a.ovr);
    if (!kandidaten.length) return '<span class="tg-leise">kein Mentor im Mannschaftsteil</span>';
    return `<select class="tg-wahl" onchange="DFLTraining.mentor('${p.id}', this.value)" aria-label="Mentor für ${name(p)}"><option value="">kein Mentor</option>` +
      kandidaten.map(m => `<option value="${m.id}"${p.tgMentor === m.id ? ' selected' : ''}>${m.name} (${m.age}, ${schuetzlinge(m).length}/${CFG.mentorMax})</option>`).join('') + '</select>';
  }
  function zeile(p, rechts, mitTraining) {
    const f = window.trainingsgruppeFaktor(p);
    const info = mitTraining
      ? (f ? `<span class="tg-faktor" title="Ersatz für Spielpraxis">Training ${prozent(f)}</span>` : `<span class="tg-leise">über ${CFG.faktor.jungBis}</span>`)
      : '';
    return `<div class="tg-zeile">
      <span class="pos-badge-sm pos-${p.pos}">${p.pos}</span>
      <div class="tg-name"><b>${name(p)}</b><span>${p.age} J · OVR ${p.ovr} · ${potText(p)}</span></div>
      <div class="tg-mitte">${info}${mitTraining && f ? auswahlSchwerpunkt(p) + auswahlMentor(p) : ''}</div>
      <div class="tg-rechts">${rechts || ''}</div>
    </div>`;
  }
  function html() {
    const g = gruppen();
    const pkMax = (window.DFLSaison && DFLSaison.CFG && DFLSaison.CFG.perspektiv) || 6;
    const K = window.DFLKader;
    const pk = g.perspektiv.map(p => zeile(p, `<button class="mkt-btn" onclick="DFLKader.hochziehen('${p.id}');DFLTraining.zeichne()">Hochziehen</button>`, true)).join('')
      || `<p class="tg-leise">${document.body.classList.contains('pcu-an') ? 'Leer' : 'Leer – Spieler bis 21 kannst du unten hineinschieben.'}</p>`;   // Nutzer 2026-10-22: überflüssiger Text raus: am PC (body.pcu-an) nur „Leer“
    const inaktiv = g.inaktiv.sort((a, b) => a.age - b.age).map(p => zeile(p,
      K && K.pkTauglich && K.pkTauglich(p) && g.perspektiv.length < pkMax
        ? `<button class="mkt-btn secondary" onclick="DFLKader.inPerspektivkader('${p.id}');DFLTraining.zeichne()">→ Development Squad</button>` : '', true)).join('')
      || '<p class="tg-leise">Alle gesunden Spieler stehen im Spieltagskader.</p>';
    const vl = g.verletztenliste.map(p => {
      const z = zurueckholbar(p);
      return zeile(p, `<button class="mkt-btn" ${z.ok ? '' : 'disabled'} title="${z.grund}" onclick="DFLTraining.vonVerletztenliste('${p.id}')">Zurückholen</button>` +
        (z.ok ? '' : `<span class="tg-leise">${z.grund}</span>`), false);
    }).join('');
    const kandidaten = g.verletzt.filter(p => (p.injuryWeeks || 0) >= CFG.verletztenliste.abWochen).map(p => zeile(p,
      `<span class="tg-leise">${p.injuryWeeks} Wo. verletzt</span><button class="mkt-btn secondary" onclick="DFLTraining.aufVerletztenliste('${p.id}')">Auf die Verletztenliste</button>`, false)).join('');
    return `<section class="tg" id="dfl-trainingsgruppe">
      <h3>Trainingsgruppe</h3>
      <p class="tg-intro">Ohne Spielzeit kaum Entwicklung – Training ersetzt einen Teil: Development Squad ${prozent(CFG.faktor.perspektiv)}, bis ${CFG.faktor.jungBis} ohne Stammplatz ${prozent(CFG.faktor.inaktivJung)}, Mentor +${prozent(CFG.faktor.mentor)}.</p>
      <h4>Development Squad <span>${g.perspektiv.length}/${pkMax}</span></h4>${pk}
      <h4>Nicht im Spieltagskader <span>${g.inaktiv.length} Spieler · Spieltagskader = Startelf, 7 Bank, Ersatztorwart</span></h4>${inaktiv}
      <h4>Verletztenliste <span>${g.verletztenliste.length} · Kader ${hauptkader().length}/${CFG.kader}</span></h4>
      ${vl || '<p class="tg-leise">Niemand auf der Verletztenliste.</p>'}${kandidaten ? '<p class="tg-unter">Lange verletzt (ab ' + CFG.verletztenliste.abWochen + ' Wochen möglich):</p>' + kandidaten : ''}
    </section>`;
  }
  function zeichne() {
    if (!dfl()) return;
    const host = document.getElementById('training-content');
    if (!host) return;
    const alt = document.getElementById('dfl-trainingsgruppe');
    if (alt) alt.outerHTML = html(); else host.insertAdjacentHTML('beforeend', html());
  }

  // ── Einhängen ────────────────────────────────────────────────────────────
  if (window.TrainingSystem && typeof TrainingSystem.renderTrainingTab === 'function') {
    const _orig = TrainingSystem.renderTrainingTab;
    TrainingSystem.renderTrainingTab = function () {
      const r = _orig.apply(this, arguments);
      try { zeichne(); } catch (e) { console.warn('[DFL-Trainingsgruppe] Anzeige', e); }
      return r;
    };
  }
  // Wer auf der Verletztenliste steht, spielt nicht (auch wenn er wieder gesund ist)
  {
    const _orig = window.isAvailable;
    if (typeof _orig === 'function') window.isAvailable = function (p) {
      if (p && p.verletztenliste && dfl()) return false;
      return _orig.apply(this, arguments);
    };
    try { isAvailable = window.isAvailable; } catch (e) { /* nur im Spiel */ }
  }
  // Zum Saisonstart kommen alle von der Verletztenliste zurück (Kaderschnitt vor Spieltag 1)
  {
    const _orig = window.startNewSeason;
    if (typeof _orig === 'function') window.startNewSeason = function () {
      const r = _orig.apply(this, arguments);
      if (dfl()) kader().filter(p => p.verletztenliste).forEach(p => {
        delete p.verletztenliste;
        if (typeof addNews === 'function') addNews('squad', '💪 Zurück im Kader: ' + p.name, `${name(p)} ist zum Saisonstart wieder im 28er-Kader.`);
      });
      return r;
    };
    try { startNewSeason = window.startNewSeason; } catch (e) { /* nur im Spiel */ }
  }
  // Kaderlimit für Free Agents: Spieler auf der Verletztenliste belegen keinen Platz
  {
    let basis = window.KADER_MAX;
    Object.defineProperty(window, 'KADER_MAX', {
      configurable: true,
      get() { return basis == null ? undefined : basis + (dfl() ? kader().filter(p => p.verletztenliste).length : 0); },
      set(v) { basis = v; }
    });
  }
  // Kennzeichen „VL“ in der Kaderliste
  {
    const _orig = window.renderSquadList;
    if (typeof _orig === 'function') window.renderSquadList = function () {
      const r = _orig.apply(this, arguments);
      if (dfl()) {
        const ids = new Set(kader().filter(p => p.verletztenliste).map(p => p.id));
        if (ids.size) document.querySelectorAll('#squad-list .squad-row').forEach(row => {
          const attr = (row.getAttribute('onclick') || '') + ' ' + (row.getAttribute('ondragstart') || '');
          const treffer = [...ids].find(id => attr.indexOf("'" + id + "'") >= 0);
          if (treffer && !row.querySelector('.dfl-vl')) {
            const n = row.querySelector('.squad-name') || row;
            n.insertAdjacentHTML('beforeend', ' <span class="dfl-pk dfl-vl" title="Verletztenliste">VL</span>');
          }
        });
      }
      return r;
    };
  }

  window.DFLTraining = { CFG, spieltagskader, gruppen, mentorVon, zurueckholbar, aufVerletztenliste, vonVerletztenliste, schwerpunkt, mentor, zeichne };
  console.log('%c[DFL-Trainingsgruppe v1] aktiv', 'color:#3fb950;font-weight:bold',
    '— Development Squad, Verletztenliste, Nicht im Spieltagskader; Training ersetzt Spielpraxis (80/40 %, Mentor +10 %), Entwicklungskurve D48');
})();
