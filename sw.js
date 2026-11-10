const CACHE = 'att-v5';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/util.js',
  './js/storage.js',
  './js/state.js',
  './js/theme.js',
  './js/students.js',
  './js/profile.js',
  './js/schedule.js',
  './js/attendance.js',
  './js/charts.js',
  './js/assistant.js',
  './js/tasks.js',
  './js/excel.js',
  './js/app.js',
  './vendor/xlsx.full.min.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // network-first: всегда пробуем сеть, кэш — fallback для офлайна
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return res;
    }).catch(() => caches.match(e.request).then(hit => hit || caches.match('./index.html')))
  );
});
