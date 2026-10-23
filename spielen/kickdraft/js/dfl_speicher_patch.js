/* ═══════════════════════════════════════════════════════════════════════════
   DFL-SPEICHER-PATCH  ·  v1   (Prüfung 2026-10-09: Spielstand ging bei vollem Speicher still verloren)
   ─────────────────────────────────────────────────────────────────────────
   Baut auf dfl_speicher.js (Schreibfehler erkennen, packen) auf:
     · Speichern ganz oder gar nicht: vorher werden die gespeicherten Teile des aktiven Spielstands und der Index
       gemerkt; scheitert ein Teil, wird alles zurückgeschrieben – kein Spielstand mit neuer Vereins- und alter
       Liga-Hälfte, kein neuer Spielstand ohne Liga in der Liste.
     · Speichern läuft nacheinander: viele Stellen rufen saveGameState() ohne await auf; zwei Läufe konnten sich
       überholen. Kommen mehrere Aufrufe, während einer läuft, speichert ein einziger weiterer Lauf den neuesten Stand.
     · Hinweis oben, solange nicht gespeichert werden kann: „Spielstände“ (alte löschen) oder „Als Datei“ sichern.
     · Spielstände-Seite: Speicherbalken, Größe je Spielstand, „gepackt“, unvollständige Stände markiert.
   Hängt sich an: saveGameState (außen um den Wrapper aus dfl_liga_patch.js), #onboarding-overlay (Spielstände).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const SP = window.DFLSpeicher;
  if (!SP || typeof window.saveGameState !== 'function' || typeof slotKey !== 'function') { console.warn('[DFL-Speicher-Patch] Grundlagen fehlen – inaktiv'); return; }

  const TEILE = ['league', 'cup', 'club', 'market'];
  const INDEX = typeof SAVES_INDEX_KEY !== 'undefined' ? SAVES_INDEX_KEY : 'fcm-saves-index';
  const mb = n => (n / 1e6).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' MB';
  const aktiveId = () => (typeof ACTIVE_SLOT_ID !== 'undefined' ? ACTIVE_SLOT_ID : null);
  const STAND = { ok: null, fehler: null, versuche: 0 };

  // ── Speichern ganz oder gar nicht ────────────────────────────────────────
  const _orig = window.saveGameState;
  async function sicherSpeichern() {
    const id0 = aktiveId(), alt = {};
    const idxAlt = await SP.roh.get(INDEX);
    if (id0) for (const t of TEILE) alt[t] = await SP.roh.get(slotKey(id0, t));
    SP.fehlerStart();
    await _orig.call(this);
    const fehler = SP.fehler();
    STAND.versuche++;
    if (!fehler.length) { STAND.ok = Date.now(); STAND.fehler = null; hinweisWeg(); return true; }
    // Rückbau: der Stand vor diesem Speichern bleibt vollständig
    const id = aktiveId();
    for (const t of TEILE) {
      const a = id && id === id0 ? alt[t] : null;
      try {
        if (a && a.value != null) await SP.roh.set(slotKey(id, t), a.value);
        else if (id && SP.roh.delete) await SP.roh.delete(slotKey(id, t));
      } catch (e) { /* weiter mit den anderen Teilen */ }
    }
    try {
      if (idxAlt && idxAlt.value != null) await SP.roh.set(INDEX, idxAlt.value);
      else if (SP.roh.delete) await SP.roh.delete(INDEX);
    } catch (e) { /* Index bleibt, wie er ist */ }
    STAND.fehler = { zeit: Date.now(), teile: fehler.map(f => f.k) };
    console.warn('[DFL-Speicher] nicht gespeichert, alter Stand bleibt:', fehler.map(f => f.k).join(', '));
    hinweis();
    return false;
  }
  let laeuft = null, wartet = null;
  function starte() {
    wartet = null;
    laeuft = sicherSpeichern().catch(e => { console.warn('[DFL-Speicher] Speichern', e); return false; }).finally(() => { laeuft = null; });
    return laeuft;
  }
  window.saveGameState = function () {
    if (wartet) return wartet;                    // ein weiterer Lauf ist schon eingeplant und nimmt den neuesten Stand mit
    if (!laeuft) return starte();
    wartet = laeuft.then(starte, starte);
    return wartet;
  };
  try { saveGameState = window.saveGameState; } catch (e) { /* global überschrieben reicht */ }

  // ── Hinweis, solange nicht gespeichert werden kann ───────────────────────
  function alsDatei() {
    try {
      const name = (typeof CLUB !== 'undefined' && CLUB && CLUB.name) || 'Spielstand';
      const obj = { fcmSave: true, version: 1, exportedAt: new Date().toISOString(), name,
        league: LEAGUE, cup: typeof CUP !== 'undefined' ? CUP : null,
        club: { club: CLUB, achievements: typeof FCM_ACHIEVEMENTS !== 'undefined' ? FCM_ACHIEVEMENTS : null, squad: typeof SQUAD !== 'undefined' ? SQUAD : [] },
        market: typeof MARKET !== 'undefined' ? MARKET : null };
      const url = URL.createObjectURL(new Blob([JSON.stringify(obj)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url; a.download = `Spielstand_${name.replace(/[^a-zA-Z0-9äöüÄÖÜ_-]+/g, '_')}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (e) { console.warn('[DFL-Speicher] Datei', e); }
  }
  function hinweis() {
    if (typeof document === 'undefined' || !document.body) return;
    let el = document.getElementById('dfl-speicher-hinweis');
    if (!el) {
      el = document.createElement('div');
      el.id = 'dfl-speicher-hinweis'; el.setAttribute('role', 'alert');
      document.body.appendChild(el);
      el.addEventListener('click', ev => {
        const b = ev.target.closest('[data-sp]'); if (!b) return;
        if (b.dataset.sp === 'verwalten') { if (window.DFLStart) DFLStart.staende(); else if (typeof showOnboarding === 'function') showOnboarding(); }
        else if (b.dataset.sp === 'datei') alsDatei();
        else if (b.dataset.sp === 'zu') el.hidden = true;
      });
    }
    const z = SP.zustand();
    el.innerHTML = `<i class="ti ti-alert-triangle" aria-hidden="true"></i>
      <span><b>Nicht gespeichert:</b> Der Speicher ist voll${z.messbar ? ` (${mb(z.belegt)})` : ''}. Der letzte Stand bleibt erhalten.</span>
      <span class="dsh-knoepfe"><button type="button" data-sp="verwalten">Spielstände</button><button type="button" data-sp="datei">Als Datei</button>
      <button type="button" data-sp="zu" aria-label="Hinweis schließen">✕</button></span>`;
    el.hidden = false;
  }
  function hinweisWeg() { const el = document.getElementById('dfl-speicher-hinweis'); if (el) el.hidden = true; }

  // ── Spielstände-Seite: Speicherbalken, Größe, unvollständige Stände ──────
  function spielstaendeErgaenzen(ov) {
    const knoepfe = [...ov.querySelectorAll('button[onclick^="window._obLoad("]')];
    if (!knoepfe.length || ov.querySelector('.dsp-balken')) return;
    const z = SP.zustand();
    knoepfe.forEach(b => {
      const m = /_obLoad\('([^']+)'\)/.exec(b.getAttribute('onclick') || ''), s = m && z.slots[m[1]];
      const zeile = b.parentElement, info = zeile && zeile.querySelector('div > div:nth-child(2)');
      if (!s || !info) return;
      info.insertAdjacentHTML('beforeend', ` · ${mb(s.groesse)}${s.gepackt ? ' · gepackt' : ''}`);
      if (!s.vollstaendig) {
        info.insertAdjacentHTML('beforeend', ' · <b class="dsp-kaputt">unvollständig</b>');
        b.disabled = true; b.title = 'Dieser Spielstand ist unvollständig und lässt sich nicht laden.';
      }
    });
    if (!z.messbar) return;
    const anteil = Math.min(1, z.belegt / z.platz);
    const stufe = anteil > 0.8 ? 'voll' : anteil > 0.5 ? 'knapp' : 'gut';
    const liste = knoepfe[0].closest('div[style*="margin-bottom:16px"]') || knoepfe[0].parentElement.parentElement;
    liste.insertAdjacentHTML('beforebegin', `<div class="dsp-balken ${stufe}" role="img" aria-label="Speicher ${Math.round(anteil * 100)} Prozent belegt">
      <div class="dsp-kopf"><span><i class="ti ti-database" aria-hidden="true"></i> Speicher</span><b>${mb(z.belegt)} von ≈ ${mb(z.platz)}</b></div>
      <div class="dsp-spur"><div style="width:${Math.max(2, anteil * 100).toFixed(1)}%"></div></div>
      ${stufe !== 'gut' ? '<div class="dsp-tipp">Alte Spielstände löschen oder als Datei sichern – volle Speicher packt das Spiel selbst.</div>' : ''}
    </div>`);
  }
  if (typeof MutationObserver === 'function' && typeof document !== 'undefined') {
    new MutationObserver(() => {
      const ov = document.getElementById('onboarding-overlay');
      if (ov) spielstaendeErgaenzen(ov);
    }).observe(document.body, { childList: true, subtree: true });
  }

  // ── Aussehen (Kenney-Tokens, Tag und Nacht) ──────────────────────────────
  const css = document.createElement('style');
  css.textContent = `
    #dfl-speicher-hinweis { position: fixed; left: 8px; right: 8px; top: calc(env(safe-area-inset-top, 0px) + 8px); z-index: 10050;
      display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; padding: 10px 12px; border-radius: 14px;
      background: var(--bg2, #fffdf9); color: var(--text, #2c3e50); border: 3px solid var(--app-schlecht, #d0402f);
      box-shadow: 0 4px 0 var(--k-rand, #8b5a2b); font-size: 13px; line-height: 1.35; }
    #dfl-speicher-hinweis[hidden] { display: none; }
    #dfl-speicher-hinweis > i { color: var(--app-schlecht, #d0402f); font-size: 20px; }
    #dfl-speicher-hinweis > span { flex: 1 1 200px; min-width: 0; }
    #dfl-speicher-hinweis .dsh-knoepfe { display: flex; gap: 6px; flex: 0 0 auto; }
    #dfl-speicher-hinweis button { font: inherit; font-weight: 700; padding: 6px 10px; border-radius: 10px; cursor: pointer;
      border: 2px solid var(--k-rand, #8b5a2b); background: var(--bg3, #f6ead2); color: var(--text, #2c3e50); min-height: 36px; }
    #dfl-speicher-hinweis button[data-sp="verwalten"] { background: var(--k-blau-knopf, #2c7cb5); color: #fff; border-color: var(--k-blau-schatten, #1d5a85); }
    .dsp-balken { margin-bottom: 12px; padding: 10px 12px; border-radius: 10px; background: var(--bg2, #161b22); border: 1px solid var(--border, #30363d); }
    .dsp-kopf { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; color: var(--text2, #8b949e); margin-bottom: 6px; }
    .dsp-kopf b { color: var(--text, #e6edf3); font-variant-numeric: tabular-nums; }
    .dsp-spur { height: 10px; border-radius: 5px; background: var(--bg4, #21262d); overflow: hidden; }
    .dsp-spur > div { height: 100%; background: var(--app-gut, #3d9a2a); }
    .dsp-balken.knapp .dsp-spur > div { background: var(--app-mittel, #d29a0c); }
    .dsp-balken.voll .dsp-spur > div { background: var(--app-schlecht, #d0402f); }
    .dsp-tipp { font-size: 11px; color: var(--text2, #8b949e); margin-top: 6px; }
    .dsp-kaputt { color: var(--app-schlecht, #d0402f); }
    #onboarding-overlay button[disabled] { opacity: .45; cursor: not-allowed; }
  `;
  document.head.appendChild(css);

  window.DFLSpeicherPatch = { STAND, alsDatei, hinweis, hinweisWeg, spielstaendeErgaenzen };
  console.log('[DFL-Speicher-Patch v1] aktiv — Speichern ganz oder gar nicht, nacheinander, Hinweis bei vollem Speicher, Speicherbalken bei den Spielständen');
})();
