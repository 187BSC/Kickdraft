/* ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
   Kickstil – Demo-Sicherheit am PC (2026-10-20, nur PC-Version, beide Spiele)
   Nutzer: „was fehlt noch, was essentiell ist für eine Demo?“ → per Rückfrage: Fehler melden + Sicherungskopie.
   · Fehlerprotokoll: Seitenfehler (error, unhandledrejection), console.error und Modul-Warnungen „[…]“ landen in einem Ringpuffer
     (50 Einträge) und – in der PC-App – im fehler.log des Datenordners (pc_app/main.js Punkt 8). Nach dem ersten echten Fehler
     einer Sitzung erscheint unten rechts ein dezenter Hinweis „Etwas ist schiefgelaufen – Problem melden“.
   · „Problem melden“ (Spielstand & Verwaltung oder Hinweis): kurzes Blatt mit Textfeld; der Bericht (Spiel, Version, Verein, Saison,
     Woche, Protokoll) wird als Datei gespeichert, im Ordner gezeigt und die Mail an CFG.mail geöffnet. Im Browser: Text kopieren + Mail.
   · Sicherungskopie: nach jedem Speichern mit neuer Woche/Saison gehen die vier Teile des Spielstands als Datei an die PC-App
     (je Spielstand die letzten 3). „Sicherungen“ in Spielstand & Verwaltung listet sie mit Saison/Woche/Zeit und lädt eine zurück.
   ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const W = window;
  const pc = () => !!W.FcmPc || (() => { try { return localStorage.getItem('pcs-test') === 'an'; } catch (e) { return false; } })();
  if (!pc()) return;
  const CFG = { mail: 'kickdraft.spiel@gmail.com', puffer: 50 };
  const SPIEL = /\/kickdraft\//.test(location.pathname) || W.DFLSpiel ? 'kickdraft' : 'flutlicht';
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const spiel = () => typeof LEAGUE !== 'undefined' && LEAGUE && typeof CLUB !== 'undefined' && CLUB;

  // ── Fehlerprotokoll ─────────────────────────────────────────────────────────────────────────────────────────────
  const log = [];
  let hinweisGezeigt = false;
  function merken(art, text, echt) {
    const z = new Date().toLocaleTimeString('de-DE') + ' ' + art + ': ' + String(text || '').slice(0, 600);
    if (log.length && log[log.length - 1].endsWith(String(text || '').slice(0, 600))) return;   // Wiederholungen nicht stapeln
    log.push(z); if (log.length > CFG.puffer) log.shift();
    if (W.FcmPc && W.FcmPc.fehler) { try { W.FcmPc.fehler.melden(SPIEL + ' · ' + z); } catch (e) { /* ohne */ } }
    if (echt && !hinweisGezeigt) { hinweisGezeigt = true; setTimeout(hinweis, 500); }
  }
  const text = a => [...a].map(x => x && x.stack ? x.stack : typeof x === 'object' ? (() => { try { return JSON.stringify(x); } catch (e) { return String(x); } })() : String(x)).join(' ');
  W.addEventListener('error', ev => { if (ev.message) merken('Fehler', ev.message + (ev.filename ? ' @ ' + ev.filename.split('/').pop() + ':' + ev.lineno : ''), true); });
  W.addEventListener('unhandledrejection', ev => merken('Promise', ev.reason && ev.reason.stack || ev.reason, true));
  const _err = console.error, _warn = console.warn;
  console.error = function () { try { merken('console.error', text(arguments), true); } catch (e) { /* weiter */ } return _err.apply(console, arguments); };
  console.warn = function () { try { const t = text(arguments); if (/^\[/.test(t)) merken('Warnung', t, false); } catch (e) { /* weiter */ } return _warn.apply(console, arguments); };

  function hinweis() {
    if ($('pcsi-hinweis')) return;
    const h = document.createElement('div'); h.id = 'pcsi-hinweis'; h.setAttribute('role', 'status');
    h.innerHTML = `<i class="ti ti-alert-triangle" aria-hidden="true"></i><span>Etwas ist schiefgelaufen.</span>
      <button type="button" data-pcsi="melden">Problem melden</button><button type="button" data-pcsi="weg" aria-label="Ausblenden"><i class="ti ti-x" aria-hidden="true"></i></button>`;
    h.addEventListener('click', ev => { const b = ev.target.closest('[data-pcsi]'); if (!b) return; h.remove(); if (b.getAttribute('data-pcsi') === 'melden') meldenBlatt(); });
    document.body.appendChild(h);
    setTimeout(() => { if (h.isConnected) h.remove(); }, 20000);
  }

  // ── Problem melden ──────────────────────────────────────────────────────────────────────────────────────────────
  function stand() {
    if (!spiel()) return 'kein Spielstand geladen';
    let liga = ''; try { liga = (document.getElementById('hc-tier') || {}).textContent || ''; } catch (e) { /* ohne */ }
    return `${SPIEL === 'kickdraft' ? 'Kickdraft' : 'Vereinskarriere'} · ${CLUB.name || '?'} · Saison ${LEAGUE.season} · Woche ${LEAGUE.week}${liga ? ' · ' + liga.trim() : ''}`;
  }
  function meldenBlatt() {
    let b = $('pcsi-blatt'); if (b) b.remove();
    b = document.createElement('div'); b.id = 'pcsi-blatt';
    b.innerHTML = `<div class="pcsi-k" role="dialog" aria-modal="true" aria-label="Problem melden">
      <button type="button" class="pcsi-zu" data-pcsi="zu" aria-label="Schließen"><i class="ti ti-x" aria-hidden="true"></i></button>
      <h3><i class="ti ti-bug" aria-hidden="true"></i> Problem melden</h3>
      <p>Was ist passiert, und was hast du kurz vorher gemacht?</p>
      <textarea id="pcsi-text" rows="5" placeholder="z. B. Nach dem Klick auf „Woche weiter“ blieb das Fenster leer …"></textarea>
      <p class="pcsi-leise">Mitgeschickt werden: ${esc(stand())}, Version ${esc((W.FcmPc && W.FcmPc.version) || 'Browser')} und ${log.length} Protokollzeilen – keine persönlichen Daten.</p>
      <div class="pcsi-knoepfe"><button type="button" class="pcsi-haupt" data-pcsi="senden">Bericht erstellen und Mail öffnen</button><button type="button" data-pcsi="zu">Abbrechen</button></div>
    </div>`;
    b.addEventListener('click', async ev => {
      if (ev.target === b) { b.remove(); return; }
      const k = ev.target.closest('[data-pcsi]'); if (!k) return;
      if (k.getAttribute('data-pcsi') === 'zu') { b.remove(); return; }
      const eigen = ($('pcsi-text') || {}).value || '';
      const bericht = ['Beschreibung:', eigen.trim() || '(keine)', '', 'Stand: ' + stand(), 'Fenster: ' + innerWidth + '×' + innerHeight + ', Ansicht ' + (document.body.classList.contains('pcu-an') ? 'PC' : 'Handy'), '', '── Seite ──'].concat(log).join('\n');
      if (W.FcmPc && W.FcmPc.fehler && W.FcmPc.fehler.bericht) {
        const datei = await W.FcmPc.fehler.bericht({ text: bericht, mail: CFG.mail, kurz: (eigen.trim() || 'Problem im Spiel') + '\n\n' + stand() });
        b.querySelector('.pcsi-k').innerHTML = `<h3><i class="ti ti-circle-check" aria-hidden="true"></i> Danke!</h3>
          <p>Der Bericht liegt hier – bitte an die Mail hängen, die sich gerade öffnet:</p><p class="pcsi-pfad">${esc(datei || 'konnte nicht gespeichert werden')}</p>
          <div class="pcsi-knoepfe"><button type="button" class="pcsi-haupt" data-pcsi="zu">Schließen</button></div>`;
      } else {
        try { await navigator.clipboard.writeText(bericht); } catch (e) { /* ohne */ }
        location.href = 'mailto:' + CFG.mail + '?subject=' + encodeURIComponent('Problem: Unter Flutlicht') + '&body=' + encodeURIComponent(bericht.slice(0, 1800));
        b.remove();
      }
    });
    document.body.appendChild(b);
    setTimeout(() => { const t = $('pcsi-text'); if (t) t.focus(); }, 50);
  }

  // ── Sicherungskopie ─────────────────────────────────────────────────────────────────────────────────────────────
  const S = () => W.FcmPc && W.FcmPc.sicherung;
  let zuletztGesichert = '';
  async function sichern() {
    if (!S() || !spiel() || typeof ACTIVE_SLOT_ID === 'undefined' || !ACTIVE_SLOT_ID) return;
    const k = ACTIVE_SLOT_ID + '|' + LEAGUE.season + '|' + LEAGUE.week;
    if (k === zuletztGesichert) return;   // saveGameState läuft auch bei jedem Klick in der Aufstellung – gesichert wird je Woche
    zuletztGesichert = k;
    const teile = {};
    for (const t of ['league', 'cup', 'club', 'market']) { const r = await W.storage.get(slotKey(ACTIVE_SLOT_ID, t)); if (r) teile[t] = r.value; }
    if (!teile.league) return;
    await S().schreiben({ spiel: SPIEL, id: ACTIVE_SLOT_ID, meta: { club: CLUB.name, saison: LEAGUE.season, woche: LEAGUE.week }, teile });
  }
  if (typeof W.saveGameState === 'function') {
    const _s = W.saveGameState;
    W.saveGameState = async function () {
      const r = await _s.apply(this, arguments);
      try { await sichern(); } catch (e) { merken('Sicherung', e && e.message, false); }
      return r;
    };
    try { saveGameState = W.saveGameState; } catch (e) { /* window reicht */ }
  }
  async function sicherungenBlatt() {
    let b = $('pcsi-blatt'); if (b) b.remove();
    b = document.createElement('div'); b.id = 'pcsi-blatt';
    const id = typeof ACTIVE_SLOT_ID !== 'undefined' ? ACTIVE_SLOT_ID : '';
    const liste = S() && id ? await S().liste(SPIEL, id) : null;
    const zeit = z => { try { const d = new Date(z); return d.toLocaleDateString('de-DE') + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };
    b.innerHTML = `<div class="pcsi-k" role="dialog" aria-modal="true" aria-label="Sicherungen">
      <button type="button" class="pcsi-zu" data-pcsi="zu" aria-label="Schließen"><i class="ti ti-x" aria-hidden="true"></i></button>
      <h3><i class="ti ti-history" aria-hidden="true"></i> Sicherungen</h3>
      <p>Die letzten Wochenstände dieses Spielstands. Ein älterer Stand ersetzt den aktuellen – was danach passiert ist, geht verloren.</p>
      ${!S() ? '<p class="pcsi-leise">Sicherungen gibt es nur in der PC-App.</p>'
        : !liste || !liste.length ? '<p class="pcsi-leise">Noch keine Sicherung – sie entsteht beim ersten Speichern nach einer neuen Woche.</p>'
        : `<div class="pcsi-liste">${liste.map((x, i) => `<div class="pcsi-z"><div><b>Saison ${esc(x.meta.saison)} · Woche ${esc(x.meta.woche)}</b><small>${esc(x.meta.club || '')} · ${zeit(x.zeit)}${i === 0 ? ' · neueste' : ''}</small></div>
          <button type="button" data-pcsi="laden" data-datei="${esc(x.datei)}">Laden</button></div>`).join('')}</div>`}
      <div class="pcsi-knoepfe"><button type="button" data-pcsi="zu">Schließen</button></div></div>`;
    b.addEventListener('click', async ev => {
      if (ev.target === b) { b.remove(); return; }
      const k = ev.target.closest('[data-pcsi]'); if (!k) return;
      const was = k.getAttribute('data-pcsi');
      if (was === 'zu') { b.remove(); return; }
      if (was === 'laden') {
        if (!confirm('Diesen Stand laden? Der aktuelle Stand wird ersetzt.')) return;
        const teile = await S().lesen(SPIEL, id, k.getAttribute('data-datei'));
        if (!teile || !teile.league) { alert('Diese Sicherung ist beschädigt.'); return; }
        for (const t of Object.keys(teile)) await W.storage.set(slotKey(id, t), teile[t]);
        const ok = await loadSlot(id);
        if (!ok) { alert('Die Sicherung konnte nicht geladen werden.'); return; }
        try { if (W.DFLSpiel && DFLSpiel.weltNeuLaden) DFLSpiel.weltNeuLaden(); } catch (e) { /* ohne */ }
        zuletztGesichert = id + '|' + LEAGUE.season + '|' + LEAGUE.week;
        b.remove();
        try { _afterLoad(); } catch (e) { location.reload(); }
      }
    });
    document.body.appendChild(b);
  }

  // ── Knöpfe in „Spielstand & Verwaltung“ ─────────────────────────────────────────────────────────────────────────
  function knoepfe() {
    const box = document.querySelector('#view-home .mgmt-actions');
    if (!box || box.querySelector('[data-pcsi-k]')) return;
    box.insertAdjacentHTML('beforeend', `<button class="mgmt-btn" type="button" data-pcsi-k="sicherungen"><i class="ti ti-history" aria-hidden="true"></i> Sicherungen</button>
      <button class="mgmt-btn" type="button" data-pcsi-k="melden"><i class="ti ti-bug" aria-hidden="true"></i> Problem melden</button>`);
    box.querySelector('[data-pcsi-k="sicherungen"]').addEventListener('click', sicherungenBlatt);
    box.querySelector('[data-pcsi-k="melden"]').addEventListener('click', meldenBlatt);
  }

  const STIL = `
#pcsi-hinweis { position: fixed; right: 18px; bottom: 18px; z-index: 9600; display: flex; align-items: center; gap: 10px; background: var(--bg2, #fffaf0);
  border: 2px solid #c0392b; border-radius: 12px; padding: 8px 10px 8px 12px; box-shadow: 0 6px 18px rgba(0,0,0,.25); font-size: 13px; color: var(--text); }
#pcsi-hinweis > .ti { color: #c0392b; font-size: 18px; }
#pcsi-hinweis button { font: 700 12.5px var(--font-titel, system-ui); border: 0; border-radius: 8px; padding: 6px 10px; cursor: pointer; background: #c0392b; color: #fff; }
#pcsi-hinweis button[data-pcsi="weg"] { background: transparent; color: var(--text3); padding: 4px; }
#pcsi-blatt { position: fixed; inset: 0; z-index: 9700; background: rgba(0,0,0,.45); display: flex; align-items: center; justify-content: center; }
.pcsi-k { position: relative; width: min(560px, 92vw); background: var(--bg2, #fffaf0); color: var(--text); border: 3px solid var(--k-rahmen, #8b5a2b); border-radius: 18px;
  padding: 18px 20px; box-shadow: 0 6px 0 #5e3b17, 0 14px 30px rgba(0,0,0,.35); }
.pcsi-k h3 { margin: 0 0 8px; font: 700 20px var(--font-titel, system-ui); display: flex; gap: 8px; align-items: center; }
.pcsi-k p { margin: 6px 0; font-size: 14px; line-height: 1.4; } .pcsi-leise { color: var(--text3); font-size: 12.5px !important; }
.pcsi-k textarea { width: 100%; box-sizing: border-box; font: inherit; font-size: 14px; padding: 10px; border-radius: 10px; border: 2px solid var(--border); background: var(--bg, #fff); color: inherit; resize: vertical; }
.pcsi-zu { position: absolute; right: 10px; top: 10px; border: 0; background: transparent; font-size: 18px; color: var(--text3); cursor: pointer; }
.pcsi-knoepfe { display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px; }
.pcsi-knoepfe button, .pcsi-z button { font: 700 13px var(--font-titel, system-ui); border: 0; border-radius: 10px; padding: 8px 14px; cursor: pointer; background: var(--bg3, #efe2c8); color: var(--text); box-shadow: 0 3px 0 #c9b28a; }
.pcsi-knoepfe .pcsi-haupt, .pcsi-z button { background: #2c7cb5; color: #fff; box-shadow: 0 3px 0 #1d5a86; }
.pcsi-liste { display: grid; gap: 8px; margin-top: 10px; }
.pcsi-z { display: flex; align-items: center; gap: 10px; background: var(--bg3, #efe2c8); border-radius: 12px; padding: 10px 12px; }
.pcsi-z > div { flex: 1; } .pcsi-z small { display: block; color: var(--text3); font-size: 12px; }
.pcsi-pfad { font: 12.5px ui-monospace, monospace; background: var(--bg3); border-radius: 8px; padding: 8px; word-break: break-all; }
`;
  function start() {
    if ($('pcsi-css')) return;
    const st = document.createElement('style'); st.id = 'pcsi-css'; st.textContent = STIL; document.head.appendChild(st);
    setInterval(knoepfe, 1000); knoepfe();
    console.log('[Kickstil-PC-Sicherheit v1] aktiv — Fehlerprotokoll, Problem melden, Sicherungskopien (nur PC, beide Spiele)');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  W.KSPcSicherheit = { CFG, log: () => log.slice(), melden: meldenBlatt, sicherungen: sicherungenBlatt, sichern };
})();
