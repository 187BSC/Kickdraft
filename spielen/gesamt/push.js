/* ═══════════════════════════════════════════════════════════════════════════
   KICKSTIL · ERINNERUNGEN  ·  v2   (Nutzer 2026-10-16: „Push Nachrichten alle 2 Tage sind gut“; 17.10.: cooler, mit Emojis)
   ─────────────────────────────────────────────────────────────────────────
   Nur in der Android-App (window.FcmApk.pushPlanen, android_apk/PushEmpfaenger.java) – ohne Server, ohne Internet:
     · Jeder Start und jedes Verlassen der App plant neu: Erinnerungen nach CFG.tage (2, 5, 14 Tagen) ohne Spielen,
       jeweils am frühen Abend. Wer spielt, bekommt also keine. Android sichert ab: höchstens eine je 2 Tage,
       nie zwischen 21 und 9 Uhr.
     · Texte aus dem Spielstand (Spieltag und Gegner, Transferfenster, Talente, Verein) – Kickdraft liefert eigene
       über window.KSPushTexte (gesamt_app/kickdraft_push.js).
     · Erlaubnis: freundliche Frage im Spiel nach der ersten Saison (Flutlicht) bzw. beim dritten Start (Kickdraft),
       erst bei „Ja“ die Android-Abfrage. Umschalten unter Mehr → Erinnerungen. Zustand geräteweit (localStorage
       „gesamt-push“: gilt für beide Spiele der Gesamt-App).
   API: KSPush.planen() · .fragen() · .an() · .setzen(bool)
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const CFG = { tage: [2, 5, 14], stunde: 18, streuungMin: 50, kickdraftStarts: 3 };
  const KEY = 'gesamt-push';
  const bruecke = () => !!(window.FcmApk && typeof window.FcmApk.pushPlanen === 'function');
  const lies = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } };
  const schreib = z => { try { localStorage.setItem(KEY, JSON.stringify(z)); } catch (e) { /* ohne Merker */ } };
  const hatSpiel = () => { try { return typeof CLUB !== 'undefined' && CLUB && typeof LEAGUE !== 'undefined' && LEAGUE; } catch (e) { return false; } };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ── Texte (Flutlicht) ──────────────────────────────────────────────────────
  const neuName = n => (window.KSVereinsnamen ? KSVereinsnamen.text(String(n || '')) : String(n || ''));   // Spielnamen statt echter Namen
  function vereinsname() { try { return neuName((typeof clubName === 'function' ? clubName() : CLUB.name) || '') || 'Dein Verein'; } catch (e) { return 'Dein Verein'; } }
  // Rückmeldung 17.10. (13): „Erinnerung cooler schreiben … da dürfen auch Emojis genutzt werden“ – je Lage mehrere Varianten,
  // zufällig gezogen; drei Plätze (2, 5, 14 Tage): 1 = nächstes Spiel/Tabelle, 2 = Verein und Kader, 3 = Heimweh
  const zufallAus = a => a[Math.floor(Math.random() * a.length)];
  function lage() {
    const z = { v: vereinsname() };
    try {
      const f = typeof fcmNextFixture === 'function' ? fcmNextFixture(LEAGUE) : null;
      if (f) {
        z.md = f.matchday; z.heim = f.isHome;
        const t = findFcmGroup(LEAGUE).group.teams.find(x => x.id === f.opponentId);
        z.gegner = t ? neuName(t.name) : null;
        try { z.derby = window.KSDerby && KSDerby.nameFuer ? KSDerby.nameFuer(f.opponentId) : null; } catch (e) { /* ohne Derby */ }
      }
    } catch (e) { /* ohne Gegner */ }
    try {
      const grp = findFcmGroup(LEAGUE), teams = grp.group.teams.slice().sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
      const i = teams.findIndex(x => x.id === 'fcm');
      if (i >= 0 && teams[i].played) { z.platz = i + 1; z.n = teams.length; z.zweiter = i === 0 && teams[1] ? neuName(teams[1].name) : null; }
    } catch (e) { /* ohne Tabelle */ }
    try { z.fenster = typeof isTransferWindowOpen === 'function' && isTransferWindowOpen(); } catch (e) { /* zu */ }
    try { z.talent = (CLUB.youthProspects || []).slice().sort((a, b) => (b.truePotential || 0) - (a.truePotential || 0))[0] || null; } catch (e) { /* ohne */ }
    try { z.verletzt = (SQUAD || []).filter(p => (p.injuryWeeks || 0) > 0).length; } catch (e) { z.verletzt = 0; }
    return z;
  }
  function texteFlutlicht() {
    if (!hatSpiel()) return null;
    const z = lage(), v = z.v, out = [];
    const tag = z.md ? `${z.md}. Spieltag` : 'Das nächste Spiel';
    let eins;
    if (z.derby && z.gegner) eins = zufallAus([
      { titel: `🔥 ${z.derby} steht an!`, text: `${tag} gegen ${z.gegner}. Die ganze Stadt redet nur noch davon – und ${v} wartet auf deine Aufstellung.` },
      { titel: '🔥 Derby-Woche, Coach!', text: `${z.gegner} gegen ${v}. Wer jetzt nicht da ist, verpasst das Spiel des Jahres.` }]);
    else if (z.platz === 1 && z.zweiter) eins = zufallAus([
      { titel: `👑 ${v} steht ganz oben`, text: `Tabellenführer! Aber ${z.zweiter} sitzt dir im Nacken. ${tag} wartet.` },
      { titel: '👑 Platz 1 verteidigen', text: `Die Spitze fühlt sich gut an, oder? ${z.gegner ? z.gegner + ' will sie dir nehmen.' : 'Bleib dran.'}` }]);
    else if (z.platz && z.n && z.platz > z.n - 3) eins = zufallAus([
      { titel: '😬 Es wird eng, Coach', text: `Platz ${z.platz}. Die Kabine braucht jetzt eine klare Ansage${z.gegner ? ' – nächster Gegner: ' + z.gegner : ''}.` },
      { titel: '🆘 Abstiegskampf ruft', text: `${v} braucht Punkte. Jedes Spiel zählt jetzt doppelt.` }]);
    else if (z.gegner) eins = zufallAus([
      { titel: `⚽ ${z.gegner} wärmt sich schon auf`, text: `${tag}, ${z.heim ? 'zu Hause' : 'auswärts'}. Deine Elf schaut auf die Bank – wo bleibt der Trainer? 👀` },
      { titel: `⚽ ${v} wartet auf den Anpfiff`, text: `${tag} gegen ${z.gegner} – die Taktiktafel liegt bereit.` },
      { titel: '📣 Anpfiff in Sicht!', text: `${z.gegner} kommt${z.heim ? ' ins Stadion' : ''}. Stell deine Elf auf, bevor es der Co-Trainer tut. 😅` }]);
    else if (z.fenster) eins = zufallAus([
      { titel: '💸 Das Transferfenster ist offen', text: `Noch ist Zeit, ${v} zu verstärken. Der Markt schläft nicht.` },
      { titel: '📞 Dein Telefon klingelt', text: 'Berater, Angebote, Gerüchte – das Transferfenster wartet auf dich.' }]);
    else eins = { titel: `⚽ ${v} wartet auf dich`, text: 'Die Saison geht weiter – dein Team braucht seinen Trainer.' };
    out.push(eins);
    out.push(zufallAus([
      z.talent && { titel: '🌱 Ein Talent klopft an', text: `${(z.talent.firstName ? z.talent.firstName + ' ' : '') + z.talent.name} (${z.talent.age}) zeigt im Training, was er kann. Schau mal in die Akademie.` },
      z.verletzt && { titel: '🩺 Neues aus der Reha', text: `${z.verletzt} ${z.verletzt === 1 ? 'Spieler arbeitet' : 'Spieler arbeiten'} am Comeback. Die Ärzte haben Neuigkeiten.` },
      z.fenster && { titel: '🕵️ Der Scout hat einen Tipp', text: 'Ein Spieler passt perfekt in dein System. Willst du ihn dir ansehen?' },
      { titel: '📋 Der Vorstand fragt nach dir', text: `Wie geht es weiter bei ${v}? Die nächste Woche wartet.` },
      { titel: '🃏 Neue Karten in Sicht', text: 'Wer diese Woche glänzt, landet in der Elf der Woche. Vielleicht einer von deinen?' }].filter(Boolean)));
    out.push(zufallAus([
      { titel: `🏟️ ${v} vermisst seinen Trainer`, text: 'Die Fans singen deinen Namen – noch. Eine Saison ist schnell gespielt, komm zurück ins Flutlicht. 💡' },
      { titel: '🧤 Die Kabine ist so still', text: `Ohne dich trainiert ${v} nur Torschüsse aufs leere Tor. Zeit für ein Comeback!` },
      { titel: '📰 Gerüchteküche brodelt', text: `„Wo ist der Trainer von ${v}?“ – Der Flutlicht-Kurier will eine Antwort.` }]));
    return out;
  }
  // Trainerin statt Trainer (kickstil_trainer.js, 2026-10-16)
  const wort = t => { try { return window.KSTrainer ? KSTrainer.wort(t) : t; } catch (e) { return t; } };
  function texte() {
    return texteRoh().map(x => ({ titel: wort(x.titel), text: wort(x.text) }));
  }
  function texteRoh() {
    try { if (typeof window.KSPushTexte === 'function') { const t = window.KSPushTexte(); if (t && t.length) return t; } } catch (e) { /* weiter */ }
    return texteFlutlicht() || [
      { titel: '⚽ Dein Team wartet', text: 'Die Saison geht weiter – schau mal wieder rein.' },
      { titel: '📋 Neuigkeiten im Verein', text: 'Im Postfach warten Nachrichten auf dich.' },
      { titel: '🏟️ Lange nicht gesehen', text: 'Dein Verein vermisst seinen Trainer.' }];
  }

  // ── Planen ─────────────────────────────────────────────────────────────────
  const an = () => !!lies().an;
  function planen() {
    if (!bruecke()) return false;
    try {
      if (!an()) { window.FcmApk.pushPlanen('[]'); return true; }
      const t = texte(), liste = [];
      CFG.tage.forEach((tag, i) => {
        const d = new Date(); d.setDate(d.getDate() + tag); d.setHours(CFG.stunde, Math.floor(Math.random() * CFG.streuungMin), 0, 0);
        const x = t[Math.min(i, t.length - 1)];
        liste.push({ zeit: d.getTime(), titel: x.titel, text: x.text });
      });
      window.FcmApk.pushPlanen(JSON.stringify(liste));
      return true;
    } catch (e) { console.warn('[Kickstil-Push] planen', e); return false; }
  }
  function setzen(wert) {
    const z = lies(); z.an = !!wert; z.gefragt = true; schreib(z);
    if (wert && window.FcmApk && typeof window.FcmApk.pushAnfragen === 'function') window.FcmApk.pushAnfragen();
    planen();
  }
  window.__fcmPushAntwort = function (ok) {
    const z = lies(); z.an = !!ok; z.gefragt = true; schreib(z);
    planen();
    if (typeof window.showToast === 'function') window.showToast(ok ? 'Erinnerungen an – höchstens alle zwei Tage' : 'Erinnerungen aus (in den Android-Einstellungen änderbar)', ok ? 'success' : 'info');
  };

  // ── Freundliche Frage ──────────────────────────────────────────────────────
  let EL = null;
  function fragen() {
    if (!bruecke()) return false;
    if (!EL) {
      EL = document.createElement('div'); EL.id = 'ks-push';
      EL.addEventListener('click', ev => {
        const b = ev.target.closest('[data-push]'); if (!b) return;
        EL.classList.remove('auf');
        setzen(b.getAttribute('data-push') === 'ja');
      });
      document.body.appendChild(EL);
    }
    EL.innerHTML = `<div class="ksp-bg"></div><div class="ksp-box" role="dialog" aria-modal="true" aria-label="Erinnerungen">
      <i class="ti ti-bell-ringing" aria-hidden="true"></i><b>Erinnerungen?</b>
      <p>Wenn du ein paar Tage nicht gespielt hast, sagen wir kurz Bescheid – höchstens alle zwei Tage, nie nachts. Werbung gibt es darüber nie.</p>
      <button type="button" class="ksp-ja" data-push="ja">Ja, gern</button><button type="button" class="ksp-nein" data-push="nein">Nein danke</button></div>`;
    const z = lies(); z.gefragt = true; schreib(z);
    requestAnimationFrame(() => EL.classList.add('auf'));
    return true;
  }
  const da = sel => { const e = document.querySelector(sel); return !!(e && e.getClientRects().length); };
  function frageWennDran() {
    const z = lies();
    if (z.gefragt || !bruecke()) return;
    const dran = hatSpiel() ? (LEAGUE.season || 1) >= 2 : (z.starts || 0) >= CFG.kickdraftStarts;
    if (!dran) return;
    if (da('#ks-saisonende') || da('#onboarding-overlay') || da('#intro-overlay') || da('.exp-overlay') || da('#ks-neu.auf') || da('#pm-overlay')) return;
    if (document.body.classList.contains('ts-offen')) return;
    fragen();
  }

  // ── Einhängen ──────────────────────────────────────────────────────────────
  { const z = lies(); z.starts = (z.starts || 0) + 1; schreib(z); }
  setTimeout(planen, 5000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') planen(); });
  setInterval(() => { try { frageWennDran(); } catch (e) { /* später */ } }, 4000);

  // Mehr-Blatt: „Erinnerungen an/aus“ (nur in der App)
  function einbauen() {
    if (!bruecke()) return;
    const box = document.querySelector('#app-sheet .app-sheet-box');
    if (!box) return;
    let b = box.querySelector('[data-ks-push]');
    if (!b) {
      b = document.createElement('button'); b.className = 'app-eintrag'; b.setAttribute('data-ks-push', '1');
      box.insertBefore(b, box.querySelector('[data-gesamt]') || null);
    }
    const txt = `<i class="ti ti-bell" aria-hidden="true"></i><span class="app-eintrag-txt"><b>Erinnerungen: ${an() ? 'an' : 'aus'}</b><small>Höchstens alle zwei Tage, nie nachts</small></span>`;
    if (b.innerHTML !== txt) b.innerHTML = txt;
  }
  document.addEventListener('click', ev => {
    const b = ev.target.closest && ev.target.closest('[data-ks-push]');
    if (!b) return;
    ev.preventDefault(); ev.stopPropagation();
    setzen(!an()); einbauen();
    if (typeof window.showToast === 'function' && !an()) window.showToast('Erinnerungen aus', 'info');
  }, true);
  const los = () => { einbauen(); new MutationObserver(einbauen).observe(document.body, { childList: true, subtree: true }); };
  if (document.body) los(); else document.addEventListener('DOMContentLoaded', los);

  const css = document.createElement('style');
  css.textContent = `#ks-push{position:fixed;inset:0;z-index:12500;pointer-events:none}#ks-push.auf{pointer-events:auto}
  .ksp-bg{position:absolute;inset:0;background:rgb(6 6 5/.62);opacity:0;transition:opacity .18s}#ks-push.auf .ksp-bg{opacity:1}
  .ksp-box{position:absolute;left:16px;right:16px;top:50%;max-width:420px;margin:0 auto;transform:translateY(-40%) scale(.96);opacity:0;transition:all .22s;
    background:var(--bg2,#fffaf0);color:var(--text,#2b2a26);border-radius:20px;border:3px solid var(--k-rahmen,#8b5a2b);padding:18px 16px;text-align:center;font-family:var(--font-text,system-ui)}
  #ks-push.auf .ksp-box{transform:translateY(-50%);opacity:1}html.dark .ksp-box{background:var(--bg2,#1e2230)}
  .ksp-box>i{font-size:38px;color:var(--k-gold-tief,#c9962a)}.ksp-box b{display:block;font:700 21px/1.2 var(--font-titel,Fredoka,system-ui);margin:4px 0 6px}
  .ksp-box p{font-size:14px;line-height:1.4;color:var(--text2,#5a4a36);margin:0 0 14px}
  .ksp-box button{display:block;width:100%;border:0;border-radius:14px;padding:13px;font:700 16px/1 var(--font-titel,system-ui);cursor:pointer;margin-top:8px}
  .ksp-ja{color:#fff;background:var(--k-gruen,#25c065);box-shadow:0 4px 0 var(--k-gruen-tief,#188a46)}.ksp-nein{background:transparent;color:inherit;border:2px solid var(--k-rand,#d9c29a)!important}`;
  document.head.appendChild(css);

  window.KSPush = { CFG, planen, fragen, an, setzen, texte };
  console.log('[Kickstil-Push v1] aktiv — ' + (bruecke() ? 'App: Erinnerungen nach 2/5/14 Tagen' : 'Browser: keine Erinnerungen'));
})();
