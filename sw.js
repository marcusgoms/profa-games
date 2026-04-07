const CACHE_NAME = 'profa-v6';
const ASSETS = ['/', '/index.html', '/style.css', '/config.js', '/app.js'];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
    e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
    const url = new URL(e.request.url);
    // Skip API calls — let them go through normally
    if (url.hostname.includes('api.riotgames.com') || url.hostname.includes('lolesports.com') || url.hostname.includes('youtube.com') || url.hostname.includes('firebaseio.com') || url.hostname.includes('googleapis.com')) {
        return;
    }
    // Network-first: try network, fall back to cache
    e.respondWith(
        fetch(e.request).then(resp => {
            if (resp && resp.status === 200) {
                const clone = resp.clone();
                caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
            }
            return resp;
        }).catch(() => caches.match(e.request))
    );
});
