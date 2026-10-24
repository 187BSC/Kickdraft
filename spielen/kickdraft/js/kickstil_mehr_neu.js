/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · MEHR NEU  ·  v1   (Nutzer 2026-10-18: „Optionen machen und mehr zusammenfassen von so Darkmode“ –
   Mehr-Blatt mit Schaltern oben und Extras als Kacheln: „das Extra-Feld ist bombe“)
   ─────────────────────────────────────────────────────────────────────────
   Gleiche Datei für beide Spiele (Quelle flutlicht_manager/js, nach kickdraft/spiel/js kopieren).
   Das Mehr-Blatt zeigt oben vier Schnellschalter (Dunkel · Ticker · Tempo · Ton bzw. Erinnerung), darunter die Extras als
   Kacheln, einen Knopf Hauptmenü/Spielstand und die Zeile „Optionen“ (Einstellungen + Spielstand, Hilfe & Rechtliches).
   Die alten Einträge bleiben unsichtbar im Blatt: jede Kachel tippt den passenden Eintrag an – so bleiben alle Wege der Module
   (Erfolge, Laden, Joker, Karten …) unverändert. Einträge, die jetzt in den Reitern stehen (Training, Zeitung, Verein,
   Nachwuchs & Scouting, Europa), erscheinen nicht mehr.
   API: KSMehr.zeichne() · .optionen()
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Kacheln: Titel, Icon, Muster für den alten Eintrag
  const KACHELN = [
    ['Mein Trainer', 'ti-user-star', /^Mein Trainer/],
    ['Erfolge', 'ti-award', /^Erfolge/],
    ['Laden', 'ti-shopping-bag', /^Laden/],
    ['Vitrine', 'ti-trophy', /^Pokalvitrine/],
    ['Karten', 'ti-cards', /^Kartensammlung/],
    ['Hall of Fame', 'ti-award', /^Hall of Fame/],
    ['Transferticker', 'ti-arrows-exchange', /^Transferticker/],
    ['Joker', 'ti-player-play', /^Joker/],
    ['Pro', 'ti-crown', /^Pro\b/]
  ];
  const UNTEN = [/^Hauptmenü/, /^Spielstand/];
  const OPTIONEN = [/^Einstellungen/];
  const HILFE = [/^Impressum/, /^Datenschutz/, /^Mitwirkende/, /^Testdaten/, /^Feedback/, /^Erinnerungen/, /^Als App/];
  const WEG = [/^Training/, /^Zeitung/, /^Verein & Stadion/, /^Nachwuchs/, /^Europa/];
  const titel = e => { const b = e.querySelector('b'); return (b ? b.textContent : e.textContent).replace(/\s+/g, ' ').trim(); };
  const unter = e => { const s = e.querySelector('small'); return s ? s.textContent.replace(/\s+/g, ' ').trim() : ''; };
  const eintraege = () => [...document.querySelectorAll('#app-sheet .app-sheet-box .app-eintrag')].filter(e => !e.closest('.ksm-neu'));
  const finde = re => eintraege().find(e => re.test(titel(e)));

  function zeichne() {
    const s = document.getElementById('app-sheet'), box = s && s.querySelector('.app-sheet-box'); if (!box) return;
    if (!s.classList.contains('ksm-an')) s.classList.add('ksm-an');
    let neu = box.querySelector('.ksm-neu');
    if (!neu) { neu = document.createElement('div'); neu.className = 'ksm-neu'; const g = box.querySelector('.app-griff'); if (g) g.after(neu); else box.prepend(neu); }
    const D = window.DFLDesign, T = window.DFLTextspiel;
    const dunkel = D && D.stilWahl ? D.stilWahl() === 'nacht' : document.documentElement.classList.contains('nacht');
    const tx = T && T.einstellung ? T.einstellung() : 'aus', tempo = T && T.tempo ? T.tempo() : 1;
    const ton = window.DFLTon ? DFLTon.an() : null;
    const schalter = [
      `<button type="button" class="${dunkel ? 'an' : ''}" data-ksm="dunkel" aria-pressed="${dunkel}"><i class="ti ti-moon" aria-hidden="true"></i>Dunkel</button>`,
      T ? `<button type="button" class="${tx !== 'aus' ? 'an' : ''}" data-ksm="ticker" aria-pressed="${tx !== 'aus'}"><i class="ti ti-message" aria-hidden="true"></i>Ticker</button>` : '',
      T && T.setzeTempo ? `<button type="button" class="${tempo > 1 ? 'an' : ''}${tx === 'aus' ? ' aus' : ''}" data-ksm="tempo" aria-pressed="${tempo > 1}"${tx === 'aus' ? ' disabled' : ''}><i class="ti ti-player-track-next" aria-hidden="true"></i>Tempo ${tempo}×</button>` : '',
      ton != null ? `<button type="button" class="${ton ? 'an' : ''}" data-ksm="ton" aria-pressed="${ton}"><i class="ti ti-volume" aria-hidden="true"></i>Ton</button>` : ''
    ].filter(Boolean);
    const erin = finde(/^Erinnerungen/);
    if (schalter.length < 4 && erin) schalter.push(`<button type="button" data-ksm-e="Erinnerungen"><i class="ti ti-bell" aria-hidden="true"></i>Erinnerung</button>`);
    const kacheln = KACHELN.map(([t, ic, re]) => { const e = finde(re); return e ? { t, ic, sub: unter(e), re } : null; }).filter(Boolean);
    const unten = UNTEN.map(re => finde(re)).filter(Boolean);
    neu.innerHTML = `<div class="ksm-schnell" style="grid-template-columns:repeat(${schalter.length},1fr)">${schalter.join('')}</div>
      <div class="ksm-kacheln">${kacheln.map((k, i) => `<button type="button" class="ksm-kachel${i === kacheln.length - 1 && kacheln.length % 2 ? ' breit' : ''}" data-ksm-e="${esc(k.re.source)}">
        <i class="ti ${k.ic}" aria-hidden="true"></i><span><b>${esc(k.t)}</b><small>${esc(k.sub)}</small></span></button>`).join('')}</div>
      ${unten.length ? `<div class="ksm-unten">${unten.map(e => `<button type="button" class="app-knopf" data-ksm-e="${esc('^' + titel(e).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))}"><i class="ti ${/Hauptmen/.test(titel(e)) ? 'ti-home' : 'ti-device-floppy'}" aria-hidden="true"></i>${esc(titel(e))}</button>`).join('')}</div>` : ''}
      <button type="button" class="ksm-zeile" data-ksm="optionen"><i class="ti ti-adjustments" aria-hidden="true"></i><span>Optionen</span><small>Darstellung, Spielstand, Hilfe</small><i class="ti ti-chevron-right" aria-hidden="true"></i></button>`;
    // alte Einträge: alles, was jetzt woanders steht, bleibt unsichtbar
    eintraege().forEach(e => { if (!e.classList.contains('ksm-alt')) e.classList.add('ksm-alt'); });
  }
  // Tipps zur richtigen Zeit (kickstil_tipps.js) an/aus – localStorage gesamt-tipps, gilt für beide Spiele
  const tippsAn = () => { try { return localStorage.getItem('gesamt-tipps') !== 'aus'; } catch (e) { return true; } };
  function optionen() {
    const sh = window.DFLAppShell; if (!sh || !sh.einstellungenBlatt) return;
    const s = document.getElementById('app-sheet'); if (s) s.classList.remove('auf');
    sh.einstellungenBlatt();
    const box = document.querySelector('#app-blatt .app-blatt-box'); if (!box) return;
    const ergaenzen = () => {
      if (box.querySelector('.ksm-hilfe')) return;
      const t = box.querySelector('.app-sheet-titel'); if (t) t.textContent = 'Optionen';
      const hilfe = HILFE.map(re => finde(re)).filter(Boolean);
      const spielstand = finde(/^Spielstand/);
      const knopfSp = spielstand ? `<button type="button" class="app-knopf ksm-hilfe" data-ksm-e="^Spielstand"><i class="ti ti-folders" aria-hidden="true"></i>Spielstände, Export, Import</button>` : '';
      const ns0 = box.querySelector('.einst-neustart');
      if (knopfSp && ns0) ns0.querySelector('h4').insertAdjacentHTML('afterend', knopfSp);
      const html = `${knopfSp && !ns0 ? `<section class="einst-gruppe ksm-hilfe" aria-label="Spielstand"><h4><i class="ti ti-device-floppy" aria-hidden="true"></i>Spielstand</h4>${knopfSp}</section>` : ''}
        ${hilfe.length ? `<section class="einst-gruppe ksm-hilfe" aria-label="Hilfe und Rechtliches"><h4><i class="ti ti-help-circle" aria-hidden="true"></i>Hilfe &amp; Rechtliches</h4>
          <div class="ksm-knoepfe">${hilfe.map(e => `<button type="button" class="app-knopf" data-ksm-e="${esc('^' + titel(e).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))}">${esc(titel(e))}</button>`).join('')}</div></section>` : ''}
        ${window.KSTipps ? `<section class="einst-gruppe ksm-hilfe" aria-label="Tipps"><h4><i class="ti ti-bulb" aria-hidden="true"></i>Tipps</h4>
          <div class="ksm-knoepfe"><button type="button" class="app-knopf${tippsAn() ? ' an' : ''}" data-ksm="tipps" aria-pressed="${tippsAn()}">${tippsAn() ? 'Tipps an' : 'Tipps aus'}</button></div></section>` : ''}`;
      const ns = box.querySelector('.einst-neustart');
      if (ns) ns.insertAdjacentHTML('beforebegin', html); else box.insertAdjacentHTML('beforeend', html);
    };
    ergaenzen();
    // einstellungenBlatt malt bei jedem Tipp neu → danach wieder ergänzen
    new MutationObserver((m, o) => { if (!document.getElementById('app-blatt').classList.contains('auf')) { o.disconnect(); return; } ergaenzen(); }).observe(box, { childList: true });
  }
  function eintragTippen(muster) {
    let re = null; try { re = new RegExp(muster); } catch (e) { return; }
    const e = finde(re); if (e) e.click();
  }
  document.addEventListener('click', ev => {
    const b = ev.target.closest && ev.target.closest('[data-ksm], [data-ksm-e]'); if (!b || b.disabled) return;
    if (!b.closest('#app-sheet') && !b.closest('#app-blatt')) return;
    ev.preventDefault(); ev.stopPropagation();
    const D = window.DFLDesign, T = window.DFLTextspiel, k = b.getAttribute('data-ksm');
    if (k === 'dunkel' && D && D.stilSetzen) D.stilSetzen(D.stilWahl && D.stilWahl() === 'nacht' ? 'tag' : 'nacht');
    else if (k === 'ticker' && T && T.setzeEinstellung) T.setzeEinstellung(T.einstellung() === 'aus' ? (localStorage.getItem('ks-ticker-zuletzt') || 'hoehepunkte') : (function () { try { localStorage.setItem('ks-ticker-zuletzt', T.einstellung()); } catch (e) { /* ohne */ } return 'aus'; })());
    else if (k === 'tempo' && T && T.setzeTempo) T.setzeTempo((T.tempo ? T.tempo() : 1) > 1 ? 1 : 4);
    else if (k === 'ton' && window.DFLTon) { DFLTon.setzen(!DFLTon.an()); if (DFLTon.an()) DFLTon.spiele('pfiff'); }
    else if (k === 'optionen') { optionen(); return; }
    else if (k === 'tipps' && window.KSTipps) { KSTipps.an(!tippsAn()); b.classList.toggle('an', tippsAn()); b.setAttribute('aria-pressed', tippsAn()); b.textContent = tippsAn() ? 'Tipps an' : 'Tipps aus'; return; }
    else if (b.hasAttribute('data-ksm-e')) { eintragTippen(b.getAttribute('data-ksm-e')); return; }
    zeichne();
  }, true);
  // Blatt geht auf → neu zeichnen (Untertitel und Schalter aktuell)
  const beob = () => {
    const s = document.getElementById('app-sheet'); if (!s) { setTimeout(beob, 400); return; }
    zeichne();
    let offen = s.classList.contains('auf');
    new MutationObserver(() => { const jetzt = s.classList.contains('auf'); if (jetzt && !offen) zeichne(); offen = jetzt; }).observe(s, { attributes: true, attributeFilter: ['class'] });
  };
  beob();

  // ── Zeitung pausiert (Nutzer 2026-10-18: „einfach raus aus dem Spiel – hat aktuell noch wenig Sinn“) ──
  // Beide Spiele: kein Eintrag, keine Office-Kachel, kein Nav-Knopf, öffnet sich nicht mehr von selbst. Der Code der Zeitung bleibt;
  // ZEITUNG = true holt alles zurück. Meldungen stehen weiter im Postfach.
  const ZEITUNG = false;
  if (!ZEITUNG) {
    const _sv = window.switchAppView;
    if (typeof _sv === 'function') {
      window.switchAppView = function (v) { if (v === 'zeitung') return; return _sv.apply(this, arguments); };
      try { switchAppView = window.switchAppView; } catch (e) { /* window reicht */ }
    }
    const shell = () => {
      const S = window.DFLAppShell; if (!S || typeof S.zeige !== 'function') { setTimeout(shell, 400); return; }
      if (S._ohneZeitung) return; const _z = S.zeige; S.zeige = function (v) { if (v === 'zeitung') return; return _z.apply(this, arguments); }; S._ohneZeitung = true;
    };
    shell();
  }
  // ── Zeitung als breite Kachel im Office (statt Eintrag unter „Mehr“) ────
  const ohneEmoji = t => String(t || '').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').replace(/\s+/g, ' ').trim();
  function zeitungKachel() {
    if (!ZEITUNG) return;
    const k = document.querySelector('#view-home .ok-kacheln'); if (!k || k.querySelector('.ksm-zeitung')) return;
    const e = finde(/^Zeitung/); if (!e) return;
    const n = (typeof CLUB !== 'undefined' && CLUB && (CLUB.news || []).find(x => x && x.title)) || null;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'ok-kachel ksm-zeitung'; b.style.setProperty('--zustand', 'var(--k-blau, #38bdf8)');
    b.innerHTML = `<span class="ok-oben"><i class="ti ti-news" aria-hidden="true"></i></span>
      <span class="ksm-schlagzeile">${esc(ohneEmoji(n ? n.title : unter(e)))}</span><span class="ok-unten">${esc(unter(e) || 'Zeitung')}</span>`;
    b.addEventListener('click', ev => { ev.stopPropagation(); const z = finde(/^Zeitung/); if (z) z.click(); });
    k.appendChild(b);
  }
  const officeBeob = () => {
    const h = document.getElementById('view-home'); if (!h) { setTimeout(officeBeob, 500); return; }
    zeitungKachel();
    new MutationObserver(() => zeitungKachel()).observe(h, { childList: true, subtree: true });
  };
  officeBeob();

  const st = document.createElement('style');
  st.textContent = `
  .ok-kachel.ksm-zeitung{grid-column:1 / -1;min-height:0}
  ${ZEITUNG ? '' : '#nav-zeitung, #mgmt-zeitung-btn, #dfl-zeitung-neu, .ksm-zeitung{display:none!important}'}
  .ksm-schlagzeile{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font:800 16px/1.25 var(--font-titel,var(--font-text,inherit))}
  #app-sheet.ksm-an .app-eintrag.ksm-alt, #app-sheet.ksm-an .app-sheet-box > .app-sheet-titel{display:none!important}
  .ksm-schnell{display:grid;gap:6px;margin:8px 0 14px}
  .ksm-schnell button{border:0;background:none;text-align:center;font:800 11.5px var(--font-text,system-ui);color:var(--text2);cursor:pointer;padding:0}
  .ksm-schnell button .ti{display:grid;place-items:center;width:56px;height:56px;margin:0 auto 5px;border-radius:18px;background:var(--bg3,#efe2c8);font-size:26px;color:var(--text2);border:var(--k-rahmen,3px solid #8b5a2b);box-shadow:0 3px 0 var(--k-rand,#8b5a2b);box-sizing:border-box}
  .ksm-schnell button.an .ti{background:var(--k-blau-knopf,#2c7cb5);color:#fff;border-color:var(--k-blau-schatten,#1d5a86);box-shadow:0 3px 0 var(--k-blau-schatten,#1d5a86)}
  .ksm-schnell button.aus{opacity:.45}
  .ksm-kacheln{display:grid;grid-template-columns:1fr 1fr;gap:9px}
  .ksm-kachel{display:flex;gap:9px;align-items:center;text-align:left;border:var(--k-rahmen,3px solid #8b5a2b);border-radius:16px;padding:11px 10px;background:var(--bg2);color:var(--text);box-shadow:0 4px 0 var(--k-rand,#8b5a2b);font:inherit;cursor:pointer;min-width:0}
  .ksm-kachel.breit{grid-column:span 2}
  .ksm-kachel>.ti{font-size:26px;color:var(--k-rand,#8b5a2b);flex:none}
  .ksm-kachel span{min-width:0}.ksm-kachel b{display:block;font-size:14px}.ksm-kachel small{display:block;font-size:11px;color:var(--text3);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ksm-unten{display:flex;gap:8px;margin-top:14px}.ksm-unten .app-knopf{min-height:44px}
  .ksm-zeile{display:flex;align-items:center;gap:8px;width:100%;margin-top:12px;padding:12px 6px;border:0;border-top:2px solid var(--k-linie,#d9c29a);background:none;color:var(--text);font:800 14.5px var(--font-text,system-ui);cursor:pointer;text-align:left}
  .ksm-zeile small{color:var(--text3);font-weight:700;font-size:12px;margin-left:4px}.ksm-zeile .ti-chevron-right{margin-left:auto}
  .ksm-knoepfe{display:grid;grid-template-columns:1fr 1fr;gap:8px}.ksm-knoepfe .app-knopf{min-height:44px;font-size:13px}
  `;
  document.head.appendChild(st);
  window.KSMehr = { zeichne, optionen };
  console.log('[KS-Mehr v1] aktiv — Mehr-Blatt: Schnellschalter, Extras als Kacheln, Optionen gebündelt');
})();
