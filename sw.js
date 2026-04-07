const CACHE_NAME = 'profa-v7';
const STATIC_ASSETS = ['/', '/index.html', '/style.css', '/config.js', '/app.js', '/stats-worker.js', '/manifest.json'];
const PROFILE_CACHE = 'profa-profiles-v1';
const DDRAGON_CACHE = 'profa-ddragon-v1';

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME && k !== PROFILE_CACHE && k !== DDRAGON_CACHE).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', e => {
    const url = new URL(e.request.url);

    // Skip API calls — let them go through normally
    if (url.hostname.includes('api.riotgames.com') || url.hostname.includes('lolesports.com') || url.hostname.includes('youtube.com') || url.hostname.includes('firebaseio.com') || url.hostname.includes('googleapis.com')) {
        return;
    }

    // DDragon assets — cache-first (they rarely change per version)
    if (url.hostname.includes('ddragon.leagueoflegends.com')) {
        e.respondWith(
            caches.open(DDRAGON_CACHE).then(c =>
                c.match(e.request).then(cached => {
                    if (cached) return cached;
                    return fetch(e.request).then(resp => {
                        if (resp && resp.status === 200) c.put(e.request, resp.clone());
                        return resp;
                    }).catch(() => cached);
                })
            )
        );
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

// Listen for messages from the app
self.addEventListener('message', e => {
    if (e.data?.type === 'CACHE_PROFILE') {
        // Cache player profile data for offline viewing
        caches.open(PROFILE_CACHE).then(c => {
            const resp = new Response(JSON.stringify(e.data.profile), { headers: { 'Content-Type': 'application/json' } });
            c.put(`/profile/${e.data.idx}`, resp);
        });
    }
    if (e.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
