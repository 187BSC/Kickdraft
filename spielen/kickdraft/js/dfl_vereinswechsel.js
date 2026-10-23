/* ═══════════════════════════════════════════════════════════════════════════
   DFL – Entlassung: Angebote anderer Vereine oder Karriereende (D143, 2026-10-14)
   Nutzer: „Bei Entlassung kommen schwächere Vereine, 2–3 machen dir ein Angebot. Du kannst sonst auch retiren, wenn du willst.“
   - Statt Game Over (app_main.js onExpectationsGameOver): Fenster mit der Begründung, deiner Bilanz und 2–3 Angeboten von
     Vereinen, die schwächer sind als dein alter (bevorzugt im Umbruch).
   - Annehmen: Vereinswechsel in derselben Welt. Der alte Verein spielt als KI mit seinem Kader weiter, du startest beim neuen
     wie bei einem Karrierestart (Eigentümer, Kasse, Anlagen, Trainerteam des Vereins), aber in der laufenden Saison.
     Ablauf: Welt samt altem Kader speichern (LEAGUE.dflVereinswechsel), Seite mit Merker neu laden (wie D135), dort startet
     fortsetzen() die Karriere beim neuen Verein im selben Spielstand (DFLSpiel.wechselStart, IDs 'fcm' ↔ 'dfl_…' umgestellt).
   - Karriere beenden: Rückblick; der Spielstand bleibt zum Ansehen („Karriere beendet“), weiterspielen geht nicht.
   - Offene Entscheidung übersteht das Neuladen (CLUB.dfl.entlassung).
   API: DFLVereinswechsel = { entlassen, zeigen, angebote, fortsetzen, rueckblick, bilanz }
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const dfl = () => typeof CLUB !== 'undefined' && CLUB && CLUB.dfl && CLUB.dfl.aktiv;
  const D = () => window.DFLSpiel, S = () => window.DFLSaison;
  if (!window.DFLSpiel || !window.DFLSaison) { console.warn('[DFL-Vereinswechsel] DFL-Module fehlen – inaktiv'); return; }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const geld = v => typeof formatEuro === 'function' ? formatEuro(v) : Math.round(v) + ' €';
  const wappen = id => (window.DFLIdentitaet ? DFLIdentitaet.wappenSvg({ id }) : '');
  const franchise = id => window.DFL_LIGA.franchises.find(f => f.id === id) || { id, name: id };
  const MERKER = 'dfl-neues-spiel';

  // ── Bilanz der Amtszeit (Saison-Chronik, chronicle_patch.js) ─────────────
  function bilanz(grund) {
    const ch = (CLUB.chronicle || []).filter(e => e && e.season != null);
    const sum = k => ch.reduce((s, e) => s + (e[k] || 0), 0);
    const jahr = s => ((LEAGUE && LEAGUE.startYear) || 2026) + s - 1;
    let torjaeger = null;
    ch.forEach(e => { if (e.topScorer && (!torjaeger || e.topScorer.goals > torjaeger.tore)) torjaeger = { name: e.topScorer.name, tore: e.topScorer.goals, saison: e.season }; });
    return {
      franchiseId: CLUB.dfl.franchiseId, name: CLUB.name,
      von: ch.length ? jahr(ch[0].season) : jahr(LEAGUE.season), bis: ch.length ? jahr(ch[ch.length - 1].season) : jahr(LEAGUE.season),
      saisons: ch.length, s: sum('w'), u: sum('d'), n: sum('l'),
      playoffs: ch.filter(e => e.cup && e.cup !== 'verpasst' && e.cup !== 'nicht dabei').length,
      titel: ch.filter(e => /^D[FK]L-Meister$/.test(e.cup || '')).length,
      bester: ch.length ? Math.min(...ch.map(e => e.pos || 99)) : null,
      torjaeger, grund: grund || null
    };
  }
  function besteSpieler() {
    return (typeof SQUAD !== 'undefined' ? SQUAD : []).filter(q => !q.perspektiv).slice().sort((a, b) => b.ovr - a.ovr).slice(0, 3)
      .map(q => ({ name: ((q.firstName ? q.firstName + ' ' : '') + q.name).trim(), pos: q.pos, ovr: q.ovr, alter: q.age }));
  }

  // ── Angebote: 2–3 schwächere Vereine, bevorzugt im Umbruch ───────────────
  function rangliste(L) {
    return L.teams.map(t => ({ t, ovr: S().teamWerte(t).ovr })).sort((a, b) => b.ovr - a.ovr).map((x, i) => Object.assign(x, { rang: i + 1 }));
  }
  function angeboteWaehlen() {
    const L = D().welt(), alt = D().eigeneDflId(), rl = rangliste(L);
    const meins = rl.find(x => x.t.id === alt);
    let kand = rl.filter(x => x.t.id !== alt && x.ovr < meins.ovr);
    if (kand.length < 3) kand = rl.filter(x => x.t.id !== alt).slice(-4);       // schon der schwächste Verein: die schwächsten anderen
    const r = window.DFLGenerator.rngAus(((L.seed || 1) ^ ((LEAGUE.season || 1) * 7919)) >>> 0 || 1);
    // Umbruch (Zielwert unter der Stärke) und deutlich schwächere Vereine suchen eher einen neuen Trainer
    const gewicht = x => 1 + Math.max(0, x.ovr - ((x.t.ziel && x.t.ziel.wert) || x.ovr)) / 3 + Math.max(0, meins.ovr - x.ovr) / 6;
    const anzahl = Math.min(kand.length, kand.length >= 3 && r() < 0.6 ? 3 : 2), wahl = [];
    while (wahl.length < anzahl && kand.length) {
      const summe = kand.reduce((s, x) => s + gewicht(x), 0);
      let z = r() * summe, i = 0;
      while (i < kand.length - 1 && (z -= gewicht(kand[i])) > 0) i++;
      wahl.push(kand[i].t.id); kand.splice(i, 1);
    }
    return wahl;
  }
  function angebotDaten(id) {
    const L = D().liga(), rl = rangliste(L), x = rl.find(y => y.t.id === id), t = x.t, f = franchise(id);
    const ziel = t.ziel && t.ziel.wert != null ? t.ziel.wert - x.ovr : 0;
    return { id, name: f.name, stadt: f.city || '', division: t.division || f.division || '', ovr: Math.round(x.ovr), rang: x.rang, von: rl.length,
      kasse: typeof t.kasse === 'number' ? t.kasse : null, stadion: (t.anlagen && t.anlagen.stadion) || null,
      lage: ziel >= 3 ? 'Will nach oben' : ziel <= -3 ? 'Umbruch' : 'Will sich festigen' };
  }

  // ── Fenster ───────────────────────────────────────────────────────────────
  let ov = null;
  function schliessen() { if (ov) { ov.remove(); ov = null; } }
  function rahmen(html) {
    schliessen();
    ov = document.createElement('div'); ov.className = 'vw-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = `<div class="vw-box">${html}</div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', klick);
  }
  function bilanzHtml(b) {
    const zeit = b.von === b.bis ? String(b.von) : `${b.von}–${b.bis}`;
    return `<div class="vw-bilanz">
      <div class="vw-bkopf"><span class="vw-wappen klein">${wappen(b.franchiseId)}</span><span><b>${esc(b.name)}</b><small>${esc(zeit)} · ${b.saisons} ${b.saisons === 1 ? 'Saison' : 'Saisons'}</small></span></div>
      <div class="vw-zahlen">
        <span><b>${b.s}-${b.u}-${b.n}</b><small>Bilanz</small></span>
        <span><b>${b.playoffs}</b><small>Playoffs</small></span>
        <span><b>${b.titel}</b><small>${b.titel === 1 ? 'Titel' : 'Titel'}</small></span>
        <span><b>${b.bester || '–'}</b><small>Bester Platz</small></span>
      </div></div>`;
  }
  function karteHtml(a) {
    return `<div class="vw-karte">
      <div class="vw-kkopf"><span class="vw-wappen">${wappen(a.id)}</span>
        <span class="vw-ktxt"><b>${esc(a.name)}</b><small>${esc(a.lage)}${a.division ? ' · Division ' + esc(a.division) : ''}</small></span></div>
      <div class="vw-zahlen">
        <span><b>${a.ovr}</b><small>Stärke · Rang ${a.rang}</small></span>
        ${a.kasse != null ? `<span><b>${esc(geld(a.kasse))}</b><small>Kasse</small></span>` : ''}
        ${a.stadion ? `<span><b>${Math.round(a.stadion).toLocaleString('de-DE')}</b><small>Plätze</small></span>` : ''}
      </div>
      <button type="button" class="vw-knopf" data-vw="annehmen" data-id="${esc(a.id)}">Übernehmen</button>
    </div>`;
  }
  function zeigen() {
    const e = CLUB.dfl && CLUB.dfl.entlassung; if (!e) return;
    const b = bilanz(e.grund);
    rahmen(`<div class="vw-kopf"><i class="ti ti-door-exit" aria-hidden="true"></i><h2>Entlassen</h2></div>
      <p class="vw-grund">${esc(e.grund || 'Der Eigentümer hat das Vertrauen verloren.')}</p>
      ${bilanzHtml(b)}
      <h3>Angebote</h3>
      <div class="vw-liste">${e.angebote.map(id => karteHtml(angebotDaten(id))).join('')}</div>
      <button type="button" class="vw-knopf zweit" data-vw="beenden">Karriere beenden</button>`);
  }
  function rueckblick() {
    const k = CLUB.dfl && CLUB.dfl.karriereEnde; if (!k) return;
    const st = k.karriere || [], sum = key => st.reduce((s, b) => s + (b[key] || 0), 0);
    const tj = st.map(b => b.torjaeger).filter(Boolean).sort((a, b) => b.tore - a.tore)[0];
    rahmen(`<div class="vw-kopf"><i class="ti ti-trophy" aria-hidden="true"></i><h2>Karriere beendet</h2></div>
      <div class="vw-zahlen gross">
        <span><b>${sum('saisons')}</b><small>Saisons</small></span>
        <span><b>${sum('s')}-${sum('u')}-${sum('n')}</b><small>Bilanz</small></span>
        <span><b>${sum('playoffs')}</b><small>Playoffs</small></span>
        <span><b>${sum('titel')}</b><small>Titel</small></span>
      </div>
      <h3>Stationen</h3>
      ${st.map(bilanzHtml).join('')}
      ${(k.spieler || []).length ? `<h3>Deine Besten</h3><ul class="vw-spieler">${k.spieler.map(p => `<li><b>${esc(p.name)}</b><span>${esc(p.pos)} · Stärke ${p.ovr}</span></li>`).join('')}</ul>` : ''}
      ${tj ? `<p class="vw-grund">Bester Torjäger: ${esc(tj.name)}, ${tj.tore} Tore in einer Saison.</p>` : ''}
      <div class="vw-knoepfe">
        <button type="button" class="vw-knopf" data-vw="neu">Neues Spiel</button>
        <button type="button" class="vw-knopf zweit" data-vw="staende">Spielstände</button>
      </div>`);
  }
  function klick(ev) {
    const b = ev.target.closest('[data-vw]'); if (!b || b.disabled) return;
    const was = b.getAttribute('data-vw');
    if (was === 'annehmen') {
      const a = franchise(b.getAttribute('data-id'));
      if (!confirm(`${a.name} übernehmen?`)) return;
      ov.querySelectorAll('button').forEach(x => { x.disabled = true; });
      annehmen(a.id);
    } else if (was === 'beenden') {
      if (!confirm('Karriere wirklich beenden? Der Spielstand bleibt als Rückblick erhalten, weiterspielen geht nicht mehr.')) return;
      beenden();
    } else if (was === 'neu') {
      // alle Plätze belegt: erst die Spielstände (dort einen löschen), sonst gleich ein neues Spiel
      if (window.DFLStart) loadSavesIndex().then(i => { if (i.slots.length >= DFLStart.plaetze()) DFLStart.staende(); else DFLStart.neuesSpiel(); });
    }
    else if (was === 'staende') { if (window.DFLStart) DFLStart.staende(); }
  }

  // ── Entlassung (statt Game Over) ──────────────────────────────────────────
  async function entlassen(e) {
    if (!dfl()) return false;
    if (!CLUB.dfl.entlassung) CLUB.dfl.entlassung = { grund: (e && e.grund) || null, saison: LEAGUE.season, angebote: angeboteWaehlen() };
    try { if (typeof saveGameState === 'function') await saveGameState(); } catch (x) { /* Fenster kommt trotzdem */ }
    zeigen();
    return true;
  }
  {
    const _orig = window.onExpectationsGameOver;
    if (typeof _orig === 'function') {
      window.onExpectationsGameOver = function (e) {
        if (dfl()) { entlassen(e); return; }
        return _orig.apply(this, arguments);
      };
      try { onExpectationsGameOver = window.onExpectationsGameOver; } catch (x) { /* window reicht */ }
    }
  }
  const sperreSpeichern = () => { window.saveGameState = async function () { return false; }; try { saveGameState = window.saveGameState; } catch (x) { /* global */ } };
  function neuLaden() {
    const wert = JSON.stringify({ t: Date.now(), verein: null, wechsel: true });
    let ok = false;
    try { sessionStorage.setItem(MERKER, wert); ok = sessionStorage.getItem(MERKER) === wert; } catch (x) { ok = false; }
    if (!ok) { try { localStorage.setItem(MERKER, wert); } catch (x) { /* ohne Speicher bleibt nur das Neuladen */ } }
    location.reload();
  }
  async function annehmen(neu) {
    const L = D().welt(), alt = D().eigeneDflId(), tA = L.teams.find(t => t.id === alt);
    tA.eigen = false;
    tA.kasse = Math.round(CLUB.budget || 0);                       // die Kasse bleibt beim alten Verein (KI-Finanzen, D41)
    LEAGUE.dflVereinswechsel = { ziel: neu, alt, t: Date.now(), karriere: (CLUB.dfl.karriere || []).concat([bilanz(CLUB.dfl.entlassung && CLUB.dfl.entlassung.grund)]),
      cap: CLUB.dfl.cap, capVorjahr: CLUB.dfl.capVorjahr || CLUB.dfl.cap, saisonIndex: CLUB.dfl.saisonIndex || 0, start: CLUB.dfl.start || 2026,
      tutorial: CLUB.dflTutorial ? { modus: CLUB.dflTutorial.modus, gezeigt: CLUB.dflTutorial.gezeigt || {} } : null };
    CLUB.dfl.entlassung.gewaehlt = neu;
    try { if (typeof saveGameState === 'function') await saveGameState(); }
    catch (x) { alert('Speichern fehlgeschlagen – bitte erneut versuchen.'); delete LEAGUE.dflVereinswechsel; zeigen(); return; }
    sperreSpeichern();
    neuLaden();
  }
  async function beenden() {
    CLUB.dfl.karriereEnde = { saison: LEAGUE.season, karriere: (CLUB.dfl.karriere || []).concat([bilanz(CLUB.dfl.entlassung && CLUB.dfl.entlassung.grund)]), spieler: besteSpieler() };
    delete CLUB.dfl.entlassung;
    try { if (typeof saveGameState === 'function') await saveGameState(); } catch (x) { /* Rückblick trotzdem */ }
    rueckblick();
  }

  // ── Nach dem Neuladen: Karriere beim neuen Verein fortsetzen ──────────────
  function umstellen(o, map) {
    if (Array.isArray(o)) return o.map(x => umstellen(x, map));
    if (o && typeof o === 'object') { const n = {}; Object.keys(o).forEach(k => { n[Object.prototype.hasOwnProperty.call(map, k) ? map[k] : k] = umstellen(o[k], map); }); return n; }
    if (typeof o === 'string' && Object.prototype.hasOwnProperty.call(map, o)) return map[o];
    return o;
  }
  let gewechselt = false;
  async function fortsetzen() {
    let id = null, lg = null;
    try {
      const idx = await loadSavesIndex(); id = idx.activeId;
      const roh = id && await window.storage.get(slotKey(id, 'league'));
      lg = roh && JSON.parse(roh.value);
    } catch (x) { lg = null; }
    const W = lg && lg.dflVereinswechsel;
    if (!W || !lg.dflWelt) { console.warn('[DFL-Vereinswechsel] nichts vorgemerkt – Spielstand normal laden'); location.reload(); return; }
    const welt = lg.dflWelt;
    delete lg.dflVereinswechsel;
    const map = Object.create(null); map.fcm = 'dfl_' + W.alt; map['dfl_' + W.ziel] = 'fcm';
    const league = umstellen(lg, map);
    league.dflWelt = welt;
    gewechselt = true;
    window.DFL_WECHSEL = W;
    D().wechselStart({ franchiseId: W.ziel, seed: welt.seed, welt, league, wechsel: W });
    ACTIVE_SLOT_ID = id;
    const o = document.getElementById('onboarding-overlay'); if (o) o.remove();
    const f = franchise(W.ziel);
    try { await window._beginGame({ name: f.name, ovr: 75 }); }
    finally { window.DFL_WECHSEL = null; }
    CLUB.dfl.karriere = W.karriere;
    CLUB.dfl.wechselSaison = LEAGUE.season;
    if (W.tutorial) CLUB.dflTutorial = { modus: W.tutorial.modus || 'voll', tour: true, gezeigt: W.tutorial.gezeigt || {} };
    CLUB._introGesehen = true;
    try { D().weltGeaendert(); } catch (x) { /* Anzeige */ }
    const alt = franchise(W.alt);
    if (typeof addNews === 'function') addNews('season', `Neuer Job: ${f.name}`, `Nach dem Aus bei ${alt.name} übernimmst du ${f.name}. ${alt.name} plant ab jetzt ohne dich.`);
    try { if (typeof saveGameState === 'function') await saveGameState(); } catch (x) { /* nächste Woche */ }
    try { if (typeof renderAll === 'function') renderAll(); } catch (x) { /* Anzeige */ }
  }

  // Erster Tag (D131) gibt es beim Vereinswechsel nicht noch einmal: Modus und Gezeigtes kommen aus der alten Karriere
  if (window.DFLTutorial && typeof DFLTutorial.start === 'function') {
    const _start = DFLTutorial.start;
    DFLTutorial.start = function () { if (gewechselt) return true; return _start.apply(this, arguments); };
  }

  // ── Stil ──────────────────────────────────────────────────────────────────
  const css = document.createElement('style');
  css.id = 'dfl-vereinswechsel-css';
  css.textContent = `.vw-ov{position:fixed;inset:0;z-index:9990;background:var(--bg,#f4e3c1);color:var(--text,#2c3e50);overflow-y:auto;display:flex;justify-content:center;
  padding:calc(14px + env(safe-area-inset-top,0px)) 16px calc(20px + env(safe-area-inset-bottom,0px))}
.vw-box{width:100%;max-width:560px;display:flex;flex-direction:column;gap:12px}
.vw-kopf{display:flex;align-items:center;gap:10px}.vw-kopf i{font-size:30px;color:var(--k-rand,#8b5a2b)}.vw-kopf h2{margin:0;font-size:26px}
.vw-box h3{margin:6px 0 0;font-size:18px}
.vw-grund{margin:0;font-size:15px;line-height:1.45}
.vw-bilanz,.vw-karte{display:flex;flex-direction:column;gap:10px;padding:12px 14px;border-radius:16px;background:var(--bg2,#fffdf9);border:2px solid var(--k-rand,#8b5a2b)}
.vw-karte{border-width:3px;border-color:var(--k-gruen-tief,#4d8236);box-shadow:0 4px 0 var(--k-gruen-tief,#4d8236)}
.vw-bkopf,.vw-kkopf{display:flex;align-items:center;gap:12px}.vw-bkopf span:last-child,.vw-ktxt{display:flex;flex-direction:column;min-width:0}
.vw-bkopf b,.vw-ktxt b{font-size:18px}.vw-bkopf small,.vw-ktxt small{font-size:13px;color:var(--text3,#846d52)}
.vw-wappen{flex:none;width:52px;height:52px;display:grid;place-items:center}.vw-wappen svg{width:100%;height:100%}.vw-wappen.klein{width:40px;height:40px}
.vw-zahlen{display:flex;flex-wrap:wrap;gap:8px}.vw-zahlen span{flex:1 1 70px;display:flex;flex-direction:column;align-items:center;padding:6px 4px;border-radius:12px;
  background:var(--bg3,#f6ead2);border:2px solid var(--k-linie,#e3c99a)}
.vw-zahlen b{font-size:17px}.vw-zahlen small{font-size:12px;color:var(--text3,#846d52);text-align:center}.vw-zahlen.gross b{font-size:22px}
.vw-liste{display:flex;flex-direction:column;gap:12px}
.vw-knopf{font:inherit;font-weight:700;cursor:pointer;min-height:44px;padding:10px 14px;border-radius:12px;background:var(--k-gruen,#78bc61);color:var(--k-gruen-text,#10230a);
  border:2px solid var(--k-gruen-tief,#4d8236);box-shadow:0 3px 0 var(--k-gruen-tief,#4d8236)}
.vw-knopf.zweit{background:var(--bg2,#fffdf9);color:var(--text,#2c3e50);border-color:var(--k-rand,#8b5a2b);box-shadow:0 3px 0 var(--k-rand,#8b5a2b)}
.vw-knopf:disabled{opacity:.6;cursor:default}.vw-knoepfe{display:flex;gap:10px}.vw-knoepfe .vw-knopf{flex:1}
.vw-spieler{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.vw-spieler li{display:flex;justify-content:space-between;gap:10px;padding:8px 12px;border-radius:12px;background:var(--bg2,#fffdf9);border:2px solid var(--k-linie,#e3c99a)}
.vw-spieler span{color:var(--text3,#846d52);font-size:14px}
.vw-ov button:focus-visible{outline:3px solid var(--k-blau,#4aa3df);outline-offset:2px}`;
  document.head.appendChild(css);

  // ── Seitenstart: offene Entscheidung, Wechsel in Arbeit, beendete Karriere ─
  function beimLaden() {
    if (!dfl() || window.DFL_NEUES_SPIEL) return;
    if (CLUB.dfl.karriereEnde) { rueckblick(); return; }
    if (typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.dflVereinswechsel) { sperreSpeichern(); neuLaden(); return; }   // Neuladen kam nicht an
    if (CLUB.dfl.entlassung) zeigen();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(beimLaden, 0));
  else setTimeout(beimLaden, 0);

  window.DFLVereinswechsel = { entlassen, zeigen, angebote: angeboteWaehlen, fortsetzen, rueckblick, bilanz };
  console.log('[DFL-Vereinswechsel v1] aktiv — Entlassung mit 2–3 Angeboten schwächerer Vereine oder Karriereende (D143)');
})();
