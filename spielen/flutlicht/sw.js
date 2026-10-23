/* Service Worker – macht das Spiel offline spielbar, sobald es einmal über http(s) geladen wurde.
   Netz zuerst (Entwicklung bleibt aktuell), bei fehlendem Netz die zuletzt geladene Fassung aus dem Speicher.
   Spielstände liegen in localStorage und sind davon unabhängig. */
const CACHE = 'fl-v23';   // eigenes Präfix: in der Gesamt-App liegt Kickdraft (dfl-app-…) auf derselben Adresse
const KERN = ['./', './index.html', './manifest.webmanifest', './icons/flutlicht_icon_192.png', './icons/flutlicht_icon_512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(KERN)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE && /^(fl|fcm)-/.test(x)).map(x => caches.delete(x)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== self.location.origin) return;   // Fremdquellen (CDN) nicht anfassen
  e.respondWith(fetch(r).then(res => {
    if (res && res.ok) { const kopie = res.clone(); caches.open(CACHE).then(c => c.put(r, kopie)); }
    return res;
  }).catch(() => caches.match(r).then(m => m || caches.match('./index.html'))));
});
