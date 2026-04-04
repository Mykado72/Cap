const CACHE_NAME = 'cap-v4.0.0';
const ASSETS = ['./', './index.html', './app.js', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(cached => cached || fetch(e.request)));
});

// ─── Push notification reçue ─────────────────────────────────────────────────
self.addEventListener('push', e => {
  let data = { title: 'Cap! 🎯', body: 'Fais le point sur tes objectifs 🎯' };
  try { if (e.data) data = { ...data, ...e.data.json() }; } catch (_) {}

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      tag: data.tag || 'cap-daily',
      renotify: true,
      vibrate: [200, 100, 200],
      data: { url: data.data?.url || './' }
    })
  );
});

// ─── Clic sur la notification → ouvrir l'app avec ?review=1 ──────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  // On ajoute ?review=1 pour déclencher le bilan automatiquement
  const base = self.registration.scope; // ex: https://mykado72.github.io/Cap/
  const target = base + '?review=1';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      // Si l'app est déjà ouverte, naviguer vers ?review=1
      for (const client of list) {
        if (client.url.startsWith(base) && 'navigate' in client) {
          return client.focus().then(() => client.navigate(target));
        }
      }
      // Sinon ouvrir une nouvelle fenêtre
      if (clients.openWindow) return clients.openWindow(target);
    })
  );
});
