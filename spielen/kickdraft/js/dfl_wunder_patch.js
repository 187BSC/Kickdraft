/* ═══════════════════════════════════════════════════════════════════════════
   DFL · WUNDERHEILUNG  ·  v1   (Rückmeldung 17.10. (6), Nutzer: „wenn ein Spieler sich mehr als 10 Wochen verletzt, bitte eine
   Einblendung, was er hat, und mit dem Verweis auf die chinesische traditionelle Wunderheilung für 1x Werbung“)
   ─────────────────────────────────────────────────────────────────────────
   Verletzt sich ein eigener Spieler für mehr als 10 Wochen (DFLMedizin.verletze), erscheint – sobald kein anderes Fenster offen
   ist – eine Diagnose-Karte: Gesicht, Verletzung, Ausfall, verpasste Spiele. Angebot: Traditionelle Chinesische Medizin
   (Akupunktur, Kräuter, ein Spezialist) für ein Video. Wirkung: sofort wieder verfügbar, Rückstand nur halb so groß wie nach
   der vollen Pause, kein bleibender Rest. Einmal je Saison; ohne Video-Anbieter ein 5-Sekunden-Platzhalter wie beim Werbe-Bonus.
   Video: KSWerbung.video (Gesamt-App, Pro ohne Video) → FcmWerbung('belohnung') → Platzhalter.
   Zustand: CLUB.dfl.wunder = { saison, genutzt, warte: [spielerId] }. Tests (Playwright) sehen die Karte nur mit
   localStorage „dw-test“ = an. API: DFLWunder.anbieten(p) · .heilen(p) · .zeige() · .CFG
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const S = window.DFLSaison, D = window.DFLSpiel, I = window.DFLIdentitaet;
  if (!S || !D) { console.warn('[DFL-Wunder] DFL-Module fehlen – Patch inaktiv'); return; }
  const CFG = { abWochen: 11, rehaFaktor: 0.5, platzhalterSekunden: 5 };
  const dfl = () => typeof CLUB !== 'undefined' && CLUB && CLUB.dfl && CLUB.dfl.aktiv && typeof LEAGUE !== 'undefined' && LEAGUE && LEAGUE.dfl;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const wo = n => n === 1 ? '1 Woche' : n + ' Wochen';
  const voll = p => ((p.firstName ? p.firstName + ' ' : '') + p.name).trim();

  function zustand() {
    let z = CLUB.dfl.wunder;
    if (!z || z.saison !== LEAGUE.season) z = CLUB.dfl.wunder = { saison: LEAGUE.season, genutzt: false, warte: (z && z.warte) || [] };
    return z;
  }
  // Von DFLMedizin.verletze nach jeder eigenen Verletzung gerufen
  function anbieten(p, v) {
    if (!dfl() || !p || !v || v.wochen < CFG.abWochen) return;
    const z = zustand();
    if (z.genutzt || z.warte.indexOf(p.id) >= 0) return;
    z.warte.push(p.id);
    planen();
  }
  function heilen(p) {
    const w = p.injuryTotal || p.injuryWeeks || 0;
    const R = Math.ceil(S.rehaStartWert(w) * CFG.rehaFaktor);
    p.injuryWeeks = 0; delete p.injuryTotal; delete p.injuryFrisch; delete p.injuryType;
    if (R > 0) { p.reha = R; p.rehaStart = Math.max(R, p.rehaStart || 0); } else { delete p.reha; delete p.rehaStart; }
    if (typeof p.fitness === 'number') p.fitness = Math.max(p.fitness, 70);
    const z = zustand(); z.genutzt = true; z.warte = [];
    try { D.weltGeaendert && D.weltGeaendert(); } catch (e) { /* Welt optional */ }
    if (typeof addNews === 'function') addNews('squad', 'Wunderheilung', `${voll(p)} ist nach Akupunktur und Kräuterkur sofort wieder dabei – mit einem Rückstand von −${R}, den er im Training aufholt.`);
    if (typeof saveGameState === 'function') saveGameState();
    ['renderSquadOverview', 'renderHomeTab'].forEach(f => { try { if (typeof window[f] === 'function') window[f](); } catch (e) { /* Ansicht optional */ } });
    return R;
  }
  // Video: Gesamt-App (KSWerbung, Pro ohne Video) → Android-Brücke → Platzhalter
  function video(fertig) {
    if (window.KSWerbung && typeof KSWerbung.video === 'function') return KSWerbung.video('wunderheilung', fertig);
    if (typeof window.FcmWerbung === 'function') return window.FcmWerbung('belohnung', ok => fertig(!!ok));
    const ov = document.createElement('div');
    ov.className = 'dwu-video';
    let rest = CFG.platzhalterSekunden;
    ov.innerHTML = `<div><b>Werbung</b><small>Platzhalter – hier läuft später ein Video</small><span>${rest}</span></div>`;
    document.body.appendChild(ov);
    const t = setInterval(() => { rest--; const s = ov.querySelector('span'); if (s) s.textContent = rest; if (rest <= 0) { clearInterval(t); ov.remove(); fertig(true); } }, 1000);
  }

  const offenesFenster = () => [...document.querySelectorAll('body > *')].some(el => {
    if (el.id === 'dwu-ov') return false;
    const cs = getComputedStyle(el);
    // sichtbar und bedienbar (das Mehr-Blatt liegt versteckt mit pointer-events: none bereit)
    return cs.position === 'fixed' && cs.display !== 'none' && cs.visibility !== 'hidden' && cs.pointerEvents !== 'none' && +cs.opacity > 0.05 && +cs.zIndex >= 50 && el.getClientRects().length && el.offsetHeight > 150;
  });
  function zeige() {
    if (!dfl() || document.getElementById('dwu-ov') || offenesFenster()) return false;
    try { if (navigator.webdriver && localStorage.getItem('dw-test') !== 'an') return false; } catch (e) { /* ohne Speicher */ }
    if (window.DFLSimulieren && DFLSimulieren.laeuft && DFLSimulieren.laeuft()) return false;
    const z = zustand();
    while (z.warte.length) {
      const p = (typeof SQUAD !== 'undefined' ? SQUAD : []).find(q => q.id === z.warte[0]);
      if (!p || !(p.injuryWeeks >= CFG.abWochen - 1) || z.genutzt) { z.warte.shift(); continue; }
      karte(p); return true;
    }
    return false;
  }
  function karte(p) {
    const w = p.injuryWeeks, R = S.rehaStartWert(p.injuryTotal || w), halb = Math.ceil(R * CFG.rehaFaktor);
    const F = D.franchise('fcm') || {}, gesicht = I ? I.gesichtSvg(p, { id: 'fcm', farben: F.farben }) : '';
    const ov = document.createElement('div');
    ov.id = 'dwu-ov';
    ov.innerHTML = `<div class="dwu-box" role="dialog" aria-modal="true" aria-label="Diagnose">
      <div class="dwu-kopf"><span class="dwu-gesicht">${gesicht}</span><div><small>Diagnose der medizinischen Abteilung</small>
        <b>${esc(voll(p))}</b><span class="dwu-typ">${esc(p.injuryType || 'Schwere Verletzung')}</span></div></div>
      <div class="dwu-fakten"><div><b>${wo(w)}</b><small>Ausfall</small></div><div><b>−${R}</b><small>Rückstand danach</small></div></div>
      <div class="dwu-tcm"><b>Traditionelle chinesische Wunderheilung</b>
        <p>Ein Spezialist für Traditionelle Chinesische Medizin hat von dem Fall gehört: Akupunktur, Kräuterkur, viel Ruhe. Er verspricht, dass ${esc(p.name)} sofort wieder spielen kann – mit einem Rückstand von nur −${halb}.</p></div>
      <div class="dwu-knoepfe"><button type="button" class="dwu-nein">Lieber normale Reha</button>
        <button type="button" class="dwu-ja"><i class="ti ti-player-play" aria-hidden="true"></i>1 Video ansehen</button></div>
      <small class="dwu-hinweis">Einmal je Saison.</small></div>`;
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('auf'));
    const zu = () => { const z = zustand(); z.warte = z.warte.filter(id => id !== p.id); ov.remove(); setTimeout(zeige, 400); };
    ov.querySelector('.dwu-nein').addEventListener('click', zu);
    ov.querySelector('.dwu-ja').addEventListener('click', () => {
      ov.querySelector('.dwu-ja').disabled = true;
      video(ok => {
        if (!ok) { ov.querySelector('.dwu-ja').disabled = false; return; }
        const r = heilen(p);
        ov.querySelector('.dwu-box').innerHTML = `<div class="dwu-geheilt"><b>Geheilt!</b><p>${esc(voll(p))} ist wieder verfügbar. Rückstand −${r}, im Training holt er ihn auf.</p>
          <button type="button" class="dwu-ja">Super</button></div>`;
        ov.querySelector('.dwu-ja').addEventListener('click', () => ov.remove());
      });
    });
  }
  let takt = null;
  function planen() {
    if (takt) return;
    let n = 0;
    takt = setInterval(() => {
      n++;
      const z = dfl() ? zustand() : null;
      if (!z || !z.warte.length || z.genutzt || n > 200) { clearInterval(takt); takt = null; return; }
      try { if (zeige()) { clearInterval(takt); takt = null; } } catch (e) { clearInterval(takt); takt = null; }
    }, 1500);
  }
  // Spielstand geladen mit wartender Diagnose
  setTimeout(() => { try { if (dfl() && CLUB.dfl.wunder && CLUB.dfl.wunder.warte && CLUB.dfl.wunder.warte.length) planen(); } catch (e) { /* ohne Spiel */ } }, 3000);

  const CSS = `
  #dwu-ov{position:fixed;inset:0;z-index:9800;display:grid;place-items:center;padding:16px;background:rgb(8 10 18/.75);opacity:0;transition:opacity .25s}
  #dwu-ov.auf{opacity:1}
  .dwu-box{width:min(380px,100%);background:var(--bg2,#191918);color:var(--text,#eeeeec);border-radius:20px;padding:16px;display:grid;gap:12px;border:3px solid #c8463a;box-shadow:0 8px 0 rgb(0 0 0/.3)}
  .dwu-kopf{display:flex;gap:12px;align-items:center}
  .dwu-gesicht{flex:none;width:72px;height:72px;border-radius:50%;overflow:hidden;background:var(--bg3,#222);border:3px solid #c8463a}
  .dwu-gesicht svg{width:100%;height:150%;margin-top:-6%}
  .dwu-kopf small{display:block;font-size:12px;opacity:.7}.dwu-kopf b{display:block;font:700 19px/1.2 var(--font-display,system-ui)}
  .dwu-typ{display:inline-block;margin-top:4px;padding:3px 9px;border-radius:999px;background:#c8463a;color:#fff;font-size:12.5px;font-weight:700}
  .dwu-fakten{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .dwu-fakten div{background:var(--bg3,#222);border-radius:12px;padding:8px;text-align:center}.dwu-fakten b{display:block;font:800 22px var(--font-zahl,system-ui)}.dwu-fakten small{font-size:12px;opacity:.75}
  .dwu-tcm{border-radius:14px;padding:12px;background:linear-gradient(135deg,#8b1d1d,#4a0d0d);color:#ffe9b0;border:2px solid #e3a524}
  .dwu-tcm b{font:700 16px var(--font-display,system-ui)}.dwu-tcm p{margin:6px 0 0;font-size:14px;line-height:1.4;color:#fff3d6}
  .dwu-knoepfe{display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap}
  .dwu-knoepfe button,.dwu-geheilt button{font:700 15px var(--font-display,system-ui);padding:10px 14px;border-radius:12px;border:0;cursor:pointer}
  .dwu-nein{background:var(--bg3,#333);color:var(--text,#eee)}
  .dwu-ja{background:#e3a524;color:#2b1d05;box-shadow:0 4px 0 #a07a1c;display:inline-flex;gap:6px;align-items:center}
  .dwu-hinweis{opacity:.6;text-align:center}
  .dwu-geheilt{display:grid;gap:10px;text-align:center}.dwu-geheilt b{font:800 26px var(--font-display,system-ui);color:#7dffa8}.dwu-geheilt p{margin:0}
  .dwu-video{position:fixed;inset:0;z-index:9500;display:grid;place-items:center;background:#000;color:#fff;text-align:center}
  .dwu-video div{display:grid;gap:6px}.dwu-video span{font:800 40px var(--font-zahl,system-ui)}
  @media (prefers-reduced-motion:reduce){#dwu-ov{transition:none}}`;
  if (typeof document !== 'undefined' && document.head) { const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); }

  window.DFLWunder = { CFG, anbieten, heilen, zeige };
  console.log('[DFL-Wunder v1] aktiv — Diagnose ab 11 Wochen Ausfall, Wunderheilung für ein Video (einmal je Saison)');
})();
