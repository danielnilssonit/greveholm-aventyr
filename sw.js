// Greveholms-äventyret: sparar spelet i webbläsaren så att det startar även utan internet
const CACHE = 'ghav-64fa4c3eb9';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png', './favicon-32.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(async c => {
    await c.addAll(CORE);
    for (const url of ['https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.4/peerjs.min.js']) { try { await c.add(new Request(url, {mode: 'cors'})); } catch (err) { /* hämtas första gången */ } }
  }).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('ghav-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// rösterna och musiken sparas när de har spelats en gång (en egen cache som finns kvar mellan versionerna), så att
// spelet pratar med de riktiga rösterna också utan nät. Rösten ber om en bit av filen (Range): den skärs ur hela filen.
const MEDIA = 'ghavmedia-1';
async function rangeOf(res, req) {
  const r = req.headers.get('range'), m = r && /bytes=(\d+)-(\d*)/.exec(r);
  if (!m) return res;
  const buf = await res.clone().arrayBuffer(), start = +m[1], end = m[2] ? Math.min(+m[2], buf.byteLength - 1) : buf.byteLength - 1;
  return new Response(buf.slice(start, end + 1), {status: 206, headers: {'Content-Type': res.headers.get('Content-Type') || 'audio/mpeg', 'Content-Range': 'bytes ' + start + '-' + end + '/' + buf.byteLength, 'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes'}});
}
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin && /\/(voices|music)\//.test(url.pathname)) {
    e.respondWith(caches.open(MEDIA).then(async c => {
      const key = new Request(url.href), hit = await c.match(key);
      if (hit) return rangeOf(hit, req);
      const res = await fetch(url.href);
      if (res.ok && res.status === 200) await c.put(key, res.clone());
      return rangeOf(res, req);
    }).catch(() => fetch(req)));
    return;
  }
  if (req.headers.has('range')) return;
  if (url.origin === self.location.origin) {
    e.respondWith(fetch(req).then(res => {
      if (res.ok && res.status === 200) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, {ignoreSearch: true}).then(hit => hit || caches.match('./index.html'))));
    return;
  }
  if (/(^|\.)cdnjs\.cloudflare\.com$|(^|\.)cdn\.jsdelivr\.net$|^fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    })));
  }
});
