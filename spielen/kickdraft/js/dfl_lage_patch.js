/* ═══════════════════════════════════════════════════════════════════════════
   DFL · TEAMLAGE  ·  v1   (D110, Vorschau spiel/dfl_lage_vorschau.html, freigegeben 2026-10-11 „Zu 2 ja das passt“)
   ─────────────────────────────────────────────────────────────────────────
   Nutzer 2026-10-11: „… dass nicht jeder Verein 28 Spieler haben muss. Du kannst dich auch eher kleiner aufstellen. Wie läuft es
   aktuell mit den Rebuild-, Titel-jetzt- und normalen Teams im Draft- und Trade-Verhalten?“
     · Welt (DFLHandel.lagenSetzen, DFLGenerator.kaderZiel/kaderSoll, DFLSaison): die Lage wird zum Saisonwechsel festgehalten
       (Rang der Stärke, Eigentümer mit Geduld früher im Neuaufbau); Kaderziel Titel jetzt 28 · Mittelfeld 26 · Neuaufbau 25, Draft und
       Free Agency nach Lage, Handel-Untergrenze 24. Dein Verein bleibt frei (21–28).
     · Hier die Anzeige im Spiel: Liga → Reiter „Lage“ (alle 32 mit Lage-Marke, Rang, Stärke, Alter der Elf, Kader heute → Ziel, freie
       Plätze bis 28; Filter nach Lage) und in der Trade-Zentrale unter der Lage-Zeile die Box des Partners („baut neu auf · sucht …“,
       Kader und Platz bis 28) – DFLLage.partnerHtml, gerufen aus dfl_trade_patch.js.
     · Alte Spielstände: fehlt die Lage, wird sie einmal festgehalten; war der Kaderschnitt dieser Saison schon (CLUB.dfl.vorbereitet),
       zählt Cap-Not als Abgabegrund (L.kaderschnitt).
   API: DFLLage.zeilen() · .zeigen() · .partnerHtml(L, B, rang) · .markeHtml(key) · .nachholen() · .TEXT
   Lädt nach dfl_trade_patch.js und dfl_simulieren_patch.js (Liga-Reiter daneben), vor init_bootstrap.js. CSS: css/dfl_lage.css.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const G = window.DFLGenerator, H = window.DFLHandel, D = window.DFLSpiel;
  if (!G || !H || !D || !H.lagenSetzen || !G.kaderZiel) { console.warn('[DFL-Lage] DFL-Module fehlen – Patch inaktiv'); return; }

  const hatDom = () => typeof document !== 'undefined' && !!document.body;
  const dfl = () => typeof CLUB !== 'undefined' && CLUB && CLUB.dfl && CLUB.dfl.aktiv && typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.dfl;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const de1 = x => (Math.round(x * 10) / 10).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const ico = n => `<i class="ti ti-${n}" aria-hidden="true"></i>`;
  const KADER_MAX = () => (H.CFG.kaderMax || 28);
  // Lage-Marken (Vorschau D110: Pokal, Waage, Doktorhut) und Texte für die Box am Trade-Partner
  const TEXT = {
    titel: { text: 'Titel jetzt', ic: 'trophy', satz: 'spielt um den Titel', sucht: 'sucht fertige Spieler', gibt: 'gibt Talente und Picks ab' },
    mittelfeld: { text: 'Mittelfeld', ic: 'scale', satz: 'im Mittelfeld', sucht: 'sucht Verstärkung für die Startelf', gibt: '' },
    neuaufbau: { text: 'Neuaufbau', ic: 'school', satz: 'baut neu auf', sucht: 'sucht Junge bis 23 und Picks', gibt: 'gibt Spieler ab 29 ab' }
  };
  const markeHtml = key => { const x = TEXT[key] || TEXT.mittelfeld; return `<span class="lage-marke l-${esc(key)}">${ico(x.ic)}${esc(x.text)}</span>`; };
  const posName = x => (x === 'OM' ? 'ZOM' : x);

  // ── Alte Spielstände: Lage einmal festhalten, Kaderschnitt-Marke ──────────
  function nachholen() {
    if (!dfl()) return false;
    let L = null; try { L = D.liga(); } catch (e) { return false; }
    if (!L || !Array.isArray(L.teams)) return false;
    let neu = false;
    const eigen = L.teams.find(t => t.id === D.eigeneDflId());
    if (eigen && !eigen.eigen) eigen.eigen = true;
    if (L.teams.some(t => !(t.lage && t.lage.key))) { H.lagenSetzen(L); neu = true; }
    if (CLUB.dfl.vorbereitet === LEAGUE.season && L.kaderschnitt !== L.saisonJahr) { L.kaderschnitt = L.saisonJahr; neu = true; }
    return neu;
  }

  // ── Daten der Liste ───────────────────────────────────────────────────────
  function zeilen() {
    const L = D.welt(), rang = H.raenge(L), eigen = D.eigeneDflId();
    return L.teams.map(t => {
      const lg = H.lage(L, t, rang), ich = t.id === eigen;
      return { t, id: t.id, key: lg.key, rang: lg.rang, staerke: G.teamOvr(t), alter: lg.alterElf, kader: t.roster.filter(p => !p.ir).length,
        ziel: ich ? null : G.kaderZiel(t), frei: Math.max(0, KADER_MAX() - t.roster.filter(p => !p.ir).length), ich };
    }).sort((a, b) => a.rang - b.rang);
  }
  let filter = 'alle';
  function listeHtml() {
    const z = zeilen(), n = k => z.filter(x => x.key === k).length;
    const chips = [['alle', 'Alle ' + z.length]].concat(['titel', 'mittelfeld', 'neuaufbau'].map(k => [k, TEXT[k].text + ' ' + n(k)]))
      .map(([k, t]) => `<button type="button" class="lage-chip${filter === k ? ' an' : ''}" data-lage-filter="${k}" aria-pressed="${filter === k}">${esc(t)}</button>`).join('');
    const sichtbar = z.filter(x => filter === 'alle' || x.key === filter);
    const reihe = x => {
      const sid = D.spielId(x.id), name = x.t.name;
      const kader = x.ich ? `Kader <b>${x.kader}</b> · frei (21–${KADER_MAX()})` : `Kader ${x.kader} → <b>${x.ziel}</b>`;
      return `<div class="lage-zeile${x.ich ? ' ich' : ''}" data-lage="${esc(x.key)}">
        <span class="lg-crest lage-wappen" style="${typeof crestStyle === 'function' ? crestStyle(sid) : ''}" aria-hidden="true"></span>
        <span class="lage-nm"><b>${esc(name)}${x.ich ? ' <small>(du)</small>' : ''}</b><small>#${x.rang} · Stärke ${de1(x.staerke)} · Elf ${de1(x.alter)} J.</small>
          <small class="lage-kader">${kader}${!x.ich && x.frei ? ` · <span class="lage-frei">${x.frei} frei</span>` : ''}</small></span>
        <span class="lage-r">${markeHtml(x.key)}</span></div>`;
    };
    return `<div class="lage-box">
      <div class="lage-kopf"><b>Lage der Vereine</b><small>festgehalten zum Saisonwechsel · Kader heute → Ziel</small></div>
      <div class="lage-chips" role="group" aria-label="Filter nach Lage">${chips}</div>
      <div class="lage-liste">${sichtbar.map(reihe).join('') || '<div class="lage-leer">Kein Verein in dieser Lage.</div>'}</div>
      <div class="lage-fuss">${markeHtml('titel')} Ziel 28 · ${markeHtml('mittelfeld')} 26 · ${markeHtml('neuaufbau')} 25 · „frei“ = Platz bis ${KADER_MAX()}</div>
    </div>`;
  }

  // ── Liga → Reiter „Lage“ ──────────────────────────────────────────────────
  function reiterEinbauen() {
    if (!hatDom() || !dfl() || document.getElementById('lg-sub-lage')) return;
    const leiste = document.querySelector('#view-liga .subtabs'), tab = document.getElementById('lg-sub-tabelle');
    if (!leiste || !tab) return;
    const knopf = '<button class="subtab" onclick="switchLigaSubview(\'lage\', this)">Lage</button>';
    const nach = [...leiste.querySelectorAll('.subtab')].find(b => /'spieltag'/.test(b.getAttribute('onclick') || ''))
      || [...leiste.querySelectorAll('.subtab')].find(b => /'tabelle'/.test(b.getAttribute('onclick') || ''));
    if (nach) nach.insertAdjacentHTML('afterend', knopf); else leiste.insertAdjacentHTML('beforeend', knopf);
    tab.insertAdjacentHTML('afterend', '<div class="subview" id="lg-sub-lage" style="padding-top:12px"></div>');
    document.getElementById('lg-sub-lage').addEventListener('click', ev => {
      const b = ev.target.closest('[data-lage-filter]'); if (!b) return;
      filter = b.getAttribute('data-lage-filter') || 'alle'; zeigen();
    });
  }
  function zeigen() {
    const el = hatDom() && document.getElementById('lg-sub-lage');
    if (!el || !dfl()) return;
    try { el.innerHTML = listeHtml(); } catch (e) { console.warn('[DFL-Lage] Liste', e); }
  }
  {
    const _orig = window.switchLigaSubview;
    if (typeof _orig === 'function') {
      window.switchLigaSubview = function (name) {
        const r = _orig.apply(this, arguments);
        const el = hatDom() && document.getElementById('lg-sub-lage');
        if (el) el.classList.toggle('active', name === 'lage');
        if (name === 'lage') zeigen();
        return r;
      };
    }
  }
  {
    const _orig = window.renderLeagueTab;
    if (typeof _orig === 'function') {
      window.renderLeagueTab = function () {
        const r = _orig.apply(this, arguments);
        if (window.DFLSimulieren && DFLSimulieren.aktiv && DFLSimulieren.aktiv()) return r;      // „Simulieren bis …“ zeichnet am Ende nach
        try {
          reiterEinbauen();
          const el = document.getElementById('lg-sub-lage');
          if (el && el.classList.contains('active')) zeigen();
        } catch (e) { /* nur im Spiel */ }
        return r;
      };
    }
  }

  // ── Trade-Zentrale: Box des Partners (dfl_trade_patch.js ruft sie unter der Lage-Zeile) ──────────────
  function partnerHtml(L, B, rang) {
    try {
      if (!B || B.id === D.eigeneDflId()) return '';
      rang = rang || H.raenge(L);
      const lg = H.lage(L, B, rang), x = TEXT[lg.key] || TEXT.mittelfeld;
      const ana = G.kaderAnalyse(B, { scouting: (B.anlagen && B.anlagen.scouting) || 5, saat: (L.saisonIndex || 0) * 101 });
      const luecken = Object.entries(ana).filter(([, v]) => v.art === 'Stammspieler' && v.bedarf >= 1.2).sort((a, b) => b[1].bedarf - a[1].bedarf).slice(0, 3).map(([p]) => posName(p));
      const bis = (H.CFG.wunsch && H.CFG.wunsch.alter && H.CFG.wunsch.alter[lg.key]) || 29;
      const kader = B.roster.filter(p => !p.ir).length, ziel = G.kaderZiel(B), frei = Math.max(0, KADER_MAX() - kader);
      const teile = [(luecken.length ? 'sucht ' + luecken.join(', ') + (lg.key === 'neuaufbau' ? ', Junge bis 23 und Picks' : '') : x.sucht), x.gibt, 'Wunschliste bis ' + bis + ' Jahre'].filter(Boolean);
      return `<div class="lage-partner l-${esc(lg.key)}">${ico(x.ic)}
        <span><b>${esc(B.name)} ${esc(x.satz)}</b><small>${esc(teile.join(' · '))}</small></span>
        <span class="lage-partner-kader"><b>Kader ${kader}</b><small>Ziel ${ziel} · ${frei ? 'Platz für ' + frei : 'voll (' + KADER_MAX() + ')'}</small></span></div>`;
    } catch (e) { console.warn('[DFL-Lage] Partner', e); return ''; }
  }

  // ── Laden ─────────────────────────────────────────────────────────────────
  {
    const _orig = window._afterLoad;
    if (typeof _orig === 'function') window._afterLoad = function () {
      const r = _orig.apply(this, arguments);
      try { nachholen(); } catch (e) { console.warn('[DFL-Lage] Laden', e); }
      return r;
    };
  }
  // Spielstand schon geladen (initGame lädt vor den Patches)
  try { nachholen(); } catch (e) { console.warn('[DFL-Lage] Laden', e); }

  window.DFLLage = { TEXT, zeilen, zeigen, partnerHtml, markeHtml, nachholen, listeHtml };
  console.log('%c[DFL-Lage v1] aktiv', 'color:#3fb950;font-weight:bold',
    '— D110: Lage zum Saisonwechsel, Kaderziel 28/26/25, Liga-Reiter „Lage“, Box am Trade-Partner („sucht …“, Platz bis 28)');
})();
