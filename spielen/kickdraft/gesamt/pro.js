/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · PRO-ANGEBOT  ·  v1   (Nutzer 2026-10-16: „Pro-Version bewusst anbieten bei der Free-Version“)
   ─────────────────────────────────────────────────────────────────────────
   Ein Blatt „Pro“ (Plan: ../gesamt_app/monetarisierung.md, 4,99 € einmalig, beide Spiele) – angeboten, nie aufgedrängt:
     · immer: Mehr → „Pro – ohne Werbung“
     · im Ladebildschirm des Saisonabschlusses, unter der Saison-Werbung: „Ohne Werbung weiter? Pro“ (kleiner Knopf)
     · von selbst höchstens alle CFG.alleSaisons Saisons nach dem Saisonabschluss und nie öfter als alle CFG.tage Tage
     · wenn alle Spielstand-Plätze belegt sind (Pro: 3 statt 2), einmal je Sitzung
   Kauf: window.FcmApk.kaufen('pro') (Google Play Billing, android_apk Kauf.java, 2026-10-18), Antwort window.__fcmKauf; beim
   Start FcmApk.kaufPruefen() (Neuinstallation, Erstattung). Im Browser ohne Billing kein Angebot. Pro-Status app-weit über
   KSWerbung (gesamt-pro / dfl-pro). Zustand des Angebots geräteweit in localStorage „gesamt-pro-angebot“.
   API: KSPro.zeigen(anlass) · .kaufen() · .istPro() · .CFG
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const CFG = { preis: '4,99 €', alleSaisons: 3, tage: 5 };
  const KEY = 'gesamt-pro-angebot';
  const lies = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } };
  const schreib = z => { try { localStorage.setItem(KEY, JSON.stringify(z)); } catch (e) { /* ohne Merker */ } };
  const istPro = () => !!(window.KSWerbung && KSWerbung.istPro && KSWerbung.istPro());
  const toast = (t, art) => { if (typeof window.showToast === 'function') window.showToast(t, art || 'info'); else alert(t); };
  const VORTEILE = [
    ['ti-ad-off', 'Keine Pflichtwerbung', 'Kein Video nach dem Saisonabschluss und nach Spielen.'],
    ['ti-cards', 'Alle Joker ohne Video', 'Bau sofort, Wunderheilung, Transferspritze, Spiel wiederholen … mit denselben Grenzen.'],
    ['ti-device-floppy', '3 statt 2 Spielstände', 'In beiden Spielarten ein Platz mehr.'],
    ['ti-heart', 'Ein kleines Studio unterstützen', 'Vereinskarriere und Kickdraft bleiben dafür vollständig spielbar – auch gratis.']
  ];

  // Kaufen geht erst mit Play Billing in der Android-Hülle (FcmApk.kaufen). Bis dahin kein Pro-Angebot und kein Kaufknopf
  // (Nutzer 2026-10-16: „Pro-Kaufknopf ausblenden, solange Play Billing fehlt“; Datenschutzerklärung: „Käufe gibt es derzeit nicht“).
  const billing = () => !!(window.FcmApk && typeof window.FcmApk.kaufen === 'function');

  let EL = null, ZU = null;
  // zu (freiwillig): läuft, sobald das Blatt geschlossen ist (Eigenwerbung statt einer ausgefallenen Pflichtanzeige)
  const schliessen = () => { if (EL) EL.classList.remove('auf'); const f = ZU; ZU = null; if (f) { try { f(); } catch (e) { console.warn('[KSPro] danach', e); } } };
  function zeigen(anlass, zu) {
    if (istPro() || !billing()) return false;
    if (ZU) { const f = ZU; ZU = null; try { f(); } catch (e) { /* weiter */ } }
    ZU = typeof zu === 'function' ? zu : null;
    if (!EL) {
      EL = document.createElement('div'); EL.id = 'ks-pro';
      EL.addEventListener('click', ev => {
        if (ev.target.closest('[data-pro="kaufen"]')) { kaufen(); return; }
        if (ev.target.closest('[data-pro="zu"]') || ev.target.closest('.kspro-bg')) schliessen();
      });
      document.body.appendChild(EL);
    }
    const kopf = anlass === 'spielstaende' ? 'Mehr Platz für Karrieren?' : anlass === 'saison' || anlass === 'werbung' ? 'Ohne Werbung weiter?'
      : anlass === 'kein-video' ? 'Gerade kein Video verfügbar' : 'Unter Flutlicht Pro';
    const unter = anlass === 'kein-video' ? 'Morgen gibt es wieder einen Joker ohne Video – mit Pro immer.' : `Einmal ${CFG.preis} · für beide Spielarten · kein Abo`;
    EL.innerHTML = `<div class="kspro-bg"></div><div class="kspro-box" role="dialog" aria-modal="true" aria-label="Pro">
      <div class="kspro-kopf"><span class="kspro-marke">PRO</span><b>${kopf}</b><small>${unter}</small></div>
      <ul>${VORTEILE.map(([i, t, s]) => `<li><i class="ti ${i}" aria-hidden="true"></i><span><b>${t}</b><small>${s}</small></span></li>`).join('')}</ul>
      <button type="button" class="kspro-kauf" data-pro="kaufen">Pro holen · ${CFG.preis}</button>
      <button type="button" class="kspro-spaeter" data-pro="zu">${anlass === 'werbung' ? 'Weiter' : 'Vielleicht später'}</button>
      <p class="kspro-fuss">Die Gratis-Version ist das ganze Spiel. Pro spart Zeit und Werbung – es gibt nie Stärke für Geld.</p></div>`;
    const z = lies(); z.zuletzt = Date.now(); z.anzahl = (z.anzahl || 0) + 1; schreib(z);
    requestAnimationFrame(() => EL.classList.add('auf'));
    return true;
  }
  function kaufen() {
    if (window.FcmApk && typeof window.FcmApk.kaufen === 'function') {
      try { const k = EL && EL.querySelector('.kspro-kauf'); if (k) k.disabled = true; window.FcmApk.kaufen('pro'); return; } catch (e) { /* Hinweis */ }
    }
    toast('Pro kommt mit dem Start im Play Store. Danke fürs Interesse!', 'info');
  }
  // ── Antwort von Google Play (android_apk Kauf.java über MainActivity): ok · wartet · abbruch · fehler · status (pro | frei) ──
  // Freigeschaltet wird nur, was Google als gekauft meldet. „frei“ nimmt Pro nur zurück, wenn es aus einem Kauf stammte
  // (Erstattung) – nie, wenn Google gerade nicht erreichbar ist (dann kommt keine Antwort).
  const QUELLE = 'gesamt-pro-quelle';
  function proAn(an) {
    if (window.KSWerbung && KSWerbung.proSetzen) KSWerbung.proSetzen(an);
    try { if (an) localStorage.setItem(QUELLE, 'kauf'); else localStorage.removeItem(QUELLE); } catch (e) { /* ohne Merker */ }
  }
  window.__fcmKauf = function (id, status) {
    const k = EL && EL.querySelector('.kspro-kauf'); if (k) k.disabled = false;
    if (id === 'status') {
      if (status === 'pro' && !istPro()) { proAn(true); toast('Pro ist freigeschaltet. Danke!', 'ok'); }
      else if (status === 'pro') proAn(true);
      else if (status === 'frei') { let ausKauf = false; try { ausKauf = localStorage.getItem(QUELLE) === 'kauf'; } catch (e) { /* nein */ } if (ausKauf) proAn(false); }
      return;
    }
    if (status === 'ok') { proAn(true); schliessen(); toast('Pro ist freigeschaltet. Danke für deine Unterstützung!', 'ok'); }
    else if (status === 'wartet') toast('Zahlung wird noch bestätigt. Pro schaltet sich danach von selbst frei.', 'info');
    else if (status === 'fehler') toast('Der Kauf hat gerade nicht geklappt. Bitte später noch einmal versuchen.', 'warn');
  };
  // Beim Start: gekauft? (Neuinstallation, zweites Gerät, Erstattung)
  setTimeout(() => { try { if (window.FcmApk && typeof window.FcmApk.kaufPruefen === 'function') window.FcmApk.kaufPruefen(); } catch (e) { /* offline */ } }, 2500);

  // ── Von selbst nach dem Saisonabschluss (selten) ─────────────────────────
  let faellig = false;
  if (typeof window.startNewSeason === 'function') {
    const _s = window.startNewSeason;
    window.startNewSeason = function () {
      const r = _s.apply(this, arguments);
      try {
        const vor = (LEAGUE.season || 2) - 1, z = lies();
        if (!istPro() && vor % CFG.alleSaisons === 1 && Date.now() - (z.zuletzt || 0) > CFG.tage * 864e5) faellig = true;
      } catch (e) { /* ohne Angebot */ }
      return r;
    };
    try { startNewSeason = window.startNewSeason; } catch (e) { /* window reicht */ }
  }
  const frei = () => {
    try { if (window.KSErfolge && KSErfolge.frei && !KSErfolge.frei()) return false; } catch (e) { return false; }
    if (window.KSErfolge && KSErfolge.warteschlange && KSErfolge.warteschlange().length) return false;
    if (document.querySelector('.ef-bilanz, #ks-bewertung.auf, #ks-push.auf, #ks-neu.auf, .exp-gameover')) return false;
    try { const E = window.KSErfolge && KSErfolge.zustand(); if (E && E.bilanzOffen != null) return false; } catch (e) { /* weiter */ }
    return true;
  };
  setInterval(() => { try { if (faellig && frei() && !(window.KSBewertung && KSBewertung.faellig())) { faellig = false; zeigen('saison-auto'); } } catch (e) { /* später */ } }, 2000);

  // ── Knopf im Ladebildschirm des Saisonabschlusses und Eintrag im Mehr-Blatt ──
  function einbauen() {
    if (!billing()) { document.querySelectorAll('[data-pro-saison], [data-ks-pro], .ks-pro-platz').forEach(e => e.remove()); return; }
    if (istPro()) return;
    const laden = document.querySelector('#ks-saisonende .kse-laden');
    if (laden && !laden.querySelector('[data-pro-saison]')) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'kspro-klein'; b.setAttribute('data-pro-saison', '1');
      b.innerHTML = '<i class="ti ti-ad-off" aria-hidden="true"></i> Ohne Werbung weiter? <b>Pro</b>';
      laden.appendChild(b);
    }
    const box = document.querySelector('#app-sheet .app-sheet-box');
    if (box && !box.querySelector('[data-ks-pro]')) {
      const b = document.createElement('button'); b.className = 'app-eintrag'; b.setAttribute('data-ks-pro', '1');
      b.innerHTML = `<i class="ti ti-crown" aria-hidden="true"></i><span class="app-eintrag-txt"><b>Pro – ohne Werbung</b><small>Einmal ${CFG.preis} für beide Spielarten</small></span><i class="ti ti-chevron-right app-pfeil" aria-hidden="true"></i>`;
      box.insertBefore(b, box.querySelector('[data-gesamt]') || null);
    }
  }
  document.addEventListener('click', ev => {
    const s = ev.target.closest && ev.target.closest('[data-pro-saison]');
    if (s) { ev.preventDefault(); ev.stopPropagation(); zeigen('saison'); return; }
    const m = ev.target.closest && ev.target.closest('[data-ks-pro]');
    if (m) { ev.preventDefault(); ev.stopPropagation(); const sh = document.getElementById('app-sheet'); if (sh) sh.classList.remove('auf'); document.body.classList.remove('app-gesperrt'); zeigen('mehr'); }
  }, true);
  setInterval(() => { try { einbauen(); } catch (e) { /* später */ } }, 1000);

  // ── Spielstand-Plätze voll (kickstil_spielstaende.js zeigt den Hinweis über showToast) ──
  let platzAngebot = false;
  if (typeof window.showToast === 'function') {
    const _t = window.showToast;
    window.showToast = function (text) {
      const r = _t.apply(this, arguments);
      try { if (!platzAngebot && !istPro() && /Spielstand-Plätze sind belegt/.test(String(text))) { platzAngebot = true; setTimeout(() => zeigen('spielstaende'), 900); } } catch (e) { /* ohne */ }
      return r;
    };
    try { showToast = window.showToast; } catch (e) { /* window reicht */ }
  }

  if (!billing()) { const st = document.createElement('style'); st.textContent = '.st-platz.gesperrt{display:none!important}'; document.head.appendChild(st); }
  const css = document.createElement('style');
  css.textContent = `#ks-pro{position:fixed;inset:0;z-index:12400;pointer-events:none}#ks-pro.auf{pointer-events:auto}
  .kspro-bg{position:absolute;inset:0;background:rgb(6 6 5/.62);opacity:0;transition:opacity .18s}#ks-pro.auf .kspro-bg{opacity:1}
  .kspro-box{position:absolute;left:0;right:0;bottom:0;margin:0 auto;max-width:520px;background:var(--bg2,#fffaf0);color:var(--text,#2b2a26);
    border-radius:22px 22px 0 0;border:3px solid var(--k-gold,#e3a524);border-bottom:0;padding:16px 16px calc(18px + env(safe-area-inset-bottom,0px));
    transform:translateY(100%);transition:transform .24s cubic-bezier(.2,.8,.3,1);font-family:var(--font-text,system-ui)}
  #ks-pro.auf .kspro-box{transform:none}html.dark .kspro-box{background:var(--bg2,#1e2230)}
  .kspro-kopf{display:flex;flex-direction:column;align-items:center;text-align:center;gap:4px;margin-bottom:8px}
  .kspro-marke{font:800 13px/1 var(--font-titel,system-ui);letter-spacing:.12em;padding:6px 12px;border-radius:999px;color:#2a1c02;background:linear-gradient(150deg,#ffe58a,#e3a524)}
  .kspro-kopf b{font:700 22px/1.15 var(--font-titel,Fredoka,system-ui)}.kspro-kopf small{color:var(--text3,#846d52);font-size:13px}
  .kspro-box ul{list-style:none;margin:6px 0 12px;padding:0;display:grid;gap:8px}
  .kspro-box li{display:flex;gap:12px;align-items:center;padding:8px 10px;border-radius:12px;background:var(--bg3,#efe2c8)}
  .kspro-box li>i{font-size:24px;color:var(--k-gold-tief,#c9962a)}.kspro-box li span{display:flex;flex-direction:column}
  .kspro-box li small{color:var(--text3,#846d52);font-size:12px;line-height:1.3}
  .kspro-kauf,.kspro-spaeter{display:block;width:100%;border:0;border-radius:14px;padding:13px;font:700 16px/1 var(--font-titel,system-ui);cursor:pointer;margin-top:8px}
  .kspro-kauf{color:#2a1c02;background:linear-gradient(150deg,#ffe58a,#e3a524);box-shadow:0 4px 0 #a5780f}
  .kspro-spaeter{background:transparent;color:inherit;border:2px solid var(--k-rand,#d9c29a)}
  .kspro-fuss{margin:10px 2px 0;text-align:center;font-size:12px;color:var(--text3,#846d52)}
  .kspro-klein{border:0;background:transparent;color:var(--text3,#846d52);font:600 13px/1 var(--font-text,system-ui);cursor:pointer;padding:6px;margin-top:2px}
  .kspro-klein b{color:var(--k-gold-tief,#c9962a)}`;
  document.head.appendChild(css);

  window.KSPro = { CFG, zeigen, kaufen, istPro };
  console.log('[Kickstil-Pro v1] aktiv — Pro-Angebot (Mehr, Saisonabschluss, alle ' + CFG.alleSaisons + ' Saisons, volle Spielstand-Plätze)');
})();
