/* Website-Demo: kein Offline-Speicher. Räumt einen früher installierten Service Worker samt Cache ab und lädt offene Seiten neu. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', ev => ev.waitUntil((async () => {
  for (const k of await caches.keys()) await caches.delete(k);
  await self.registration.unregister();
  for (const c of await self.clients.matchAll({ type: 'window' })) { try { c.navigate(c.url); } catch (e) { /* ohne */ } }
})()));
