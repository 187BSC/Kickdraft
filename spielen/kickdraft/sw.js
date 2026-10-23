/* =====================================================================
   DFL-App: Service Worker
   Macht das Spiel installierbar und offline spielbar. Beim Installieren
   liest er index.html (alle src/href) und die Stylesheets (url(...)) und legt
   alles in den Cache – eine Dateiliste muss nicht gepflegt werden.
   Danach gilt „erst Cache, im Hintergrund auffrischen“: das Spiel startet
   sofort, eine neue Fassung ist beim nächsten Start da.
   Nur über http(s); file:// (Offline-ZIP) und die Android-App brauchen ihn nicht.
   ===================================================================== */
'use strict';
const CACHE = 'dfl-app-v56';  // erhöhen, wenn sich der Aufbau des Caches oder Bilder ändern (v10: Gelände D88, Gleis + Haltestelle; v11: Spiel als Text D77 – neue Skripte und geänderte Spielskripte auf einen Schlag; v12: Kenney statt Emoji D104 + eigene Auswahl D82 – neue Skripte, Reste-CSS, mehr Spielicons; v13: Auf einen Blick D62 · 4–7 – dfl_blick; v14: Verletzungen und Medizin D102; v15: Simulieren bis … D64 + D62 · 1–3 – dfl_simulieren; v16: Trade-Zentrale D84/D86 – neues Stylesheet css/dfl_trade.css; v17: laufende Kosten D75 – dfl_anlagen; v18: Scouting nach Positionen D78 – dfl_scouting; v19: Bilder statt Text D76 + alte Oberfläche D85 – dfl_bilder, dfl_oberflaeche; v20: Wechselwünsche und Abgaben D99 – dfl_wechsel; v21: Positionen mit Seite D95 – Generator, Welt, Positionen und Anzeige auf einen Schlag; v22: Wappen D113 – Generator, Wappendaten mit Rubik-Glyphen und league.json auf einen Schlag; v23: Drei Ebenen + Stil-Eignung D111/D112 – dfl_ebenen, Anzeige in Kader, Scouting, Draft, Free Agency, Trades; v24: Welt-Paket D110/L2/L3 – dfl_lage, dfl_lernen; v25: Paket A – Trainerteam D118, Chefscout D120, Kurze Wege D121; v26: Gelände v6 D127 – app/gelaende6 aus gelaende6_daten.js; v27: Sponsoren-Fenster D129 – dfl_sponsoren_patch; v28: game_data.js raus, Ereignisse in data/dfl_ereignisse.js; v29: Aufräumen – Gelände v5, Europa, Stärketabelle raus; v30: Erster Tag + Lite D131 – dfl_tutorial, dfl_geschichten; v31: Startbildschirm + Spielstände – dfl_start; v32: Playoff-Ticker + Spieltest-Fehler – dfl_textspiel.css u. a.; v33: Ton – dfl_ton; v34: Spieltest-Fehler 2026-10-14 – dfl_start, dfl_tutorial, dfl_sponsoren_patch, dfl_textspiel, dfl_ton; v35: D135–D137 – Neues Spiel frisch, zwei Torhüter, Lite-Stab – engine_main, dfl_start, dfl_kader_patch, dfl_app_shell, dfl_tutorial u. a.; v36: neue Vereinsnamen D139 + Neustart/Torhüter/Lite-Stab D135–D137 zusammengeführt; v37: Entlassung mit Angeboten D143 – dfl_vereinswechsel, Spruch D145; v38: Zeitung D141 (dfl_zeitung, dfl_zeitung_text, Stylesheet dfl_zeitung.css; v39: Kickdraft als Spieltitel, Vereins-IDs ohne Vorbildnamen (dfl_liga, dfl_geschichten, engine_main)) und Entlassung D143 zusammengeführt; v40: Kontaktadresse in Datenschutz und Feedback, Seite datenschutz.html; v41: Liganame Deutsche Kickdraft Liga / DKL; v42: neues Logo, App-Symbole und Schriftzug; v43: echte Klänge app/ton D151; v44: Ton wieder raus, Nutzer; v45: Spieltest-Rückmeldungen 2026-10-14; v46: Bank neben dem Feld – dfl_bank_patch; v47: Gelände ohne Seitenstraßen, Fußwege mit Minipark, neue Gelände-Bilder; v48: Torjäger und Vorlagengeber mit Spielerbildern; v49: Sponsoren-Trikot mit Wappen, Ausstatter und passendem Text; v50: Anlagen-Bilder je Stufe (app/anlagen), einheitliche Icons; v51: Hall of Fame als eigenes Fenster mit Gründungsklasse; v52: Torhüter mit Stil D156; v53: Pro Bowl mit Aufgebot und Ticker D158; v54: Tutorial-Missionen, Draft-Board mit Merkliste, Draft-Gerüchte D159 – dfl_draftboard, dfl_missionen; v55: Start am Tag der Verträge mit erstem Draft D108 – dfl_startdraft, Vorhang vor dem Hauptmenü D160; v56: Erfolge, Winpunkte und Laden mit Maskottchen D122/D159 d–e – dfl_erfolge, dfl_laden, css/dfl_laden.css, Bilder app/maskottchen)

async function dateiliste() {
  const basis = self.registration.scope;
  const html = await (await fetch('index.html', { cache: 'no-cache' })).text();
  const eigen = u => u && !/^(https?:|data:|blob:|#|javascript:)/.test(u);
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1]).filter(eigen);
  const extra = [];
  for (const u of refs.filter(u => /\.css(\?|$)/.test(u))) {
    try {
      const css = await (await fetch(u, { cache: 'no-cache' })).text();
      const von = new URL(u, basis);
      for (const m of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) if (eigen(m[1])) extra.push(new URL(m[1], von).href);
    } catch (e) { /* fehlt eine Datei, lädt der Laufzeit-Cache sie später */ }
  }
  // Vereinsgelände: die Bilder (Gelände, Masken, Fahrzeuge) stehen in gelaende_daten.js (Liste „dateien“), nicht in index.html
  for (const u of refs.filter(u => /gelaende6_daten\.js$/.test(u))) {
    try {
      const js = await (await fetch(u, { cache: 'no-cache' })).text();
      for (const m of js.matchAll(/"(app\/gelaende6\/[a-z0-9-]+\.(?:png|webp))"/g)) extra.push(new URL(m[1], basis).href);
    } catch (e) { /* lädt der Laufzeit-Cache später */ }
  }
  // Kulisse (Himmel, Jahreszeiten, Startbild): die Bilder stehen als Pfade in dfl_kulisse.js
  for (const u of refs.filter(u => /dfl_kulisse\.js$/.test(u))) {
    try {
      const js = await (await fetch(u, { cache: 'no-cache' })).text();
      for (const m of js.matchAll(/'(app\/kulisse\/[A-Za-z0-9_-]+\.png)'/g)) extra.push(new URL(m[1], basis).href);
    } catch (e) { /* lädt der Laufzeit-Cache später */ }
  }
  return [...new Set(['./', 'index.html', 'manifest.json', ...refs, ...extra].map(u => new URL(u, basis).href))];
}

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    const alle = await dateiliste();
    let fehlt = 0;
    await Promise.all(alle.map(u => c.add(new Request(u, { cache: 'no-cache' })).catch(() => { fehlt++; })));
    console.log('[DFL-App SW] ' + (alle.length - fehlt) + ' Dateien offline' + (fehlt ? ', ' + fehlt + ' fehlen' : ''));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE && /^dfl-/.test(k)) await caches.delete(k);   // Gesamt-App: nur eigene
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const navi = r.mode === 'navigate';
    // Seiten ohne ?…/#… ablegen (index.html?ui=handy = index.html), jede unter ihrer eigenen Adresse
    const schluessel = navi ? r.url.split('#')[0].split('?')[0] : r;
    const alt = await c.match(schluessel);
    const neu = fetch(r).then(res => { if (res.ok && res.type === 'basic') c.put(schluessel, res.clone()); return res; }).catch(() => null);
    if (alt) { e.waitUntil(neu); return alt; }
    const frisch = await neu;
    if (frisch) return frisch;
    return (navi && await c.match(new URL('index.html', self.registration.scope).href)) || Response.error();
  })());
});
