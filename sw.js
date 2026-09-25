/* Seguimiento de Fertirriego – caché de la app (Service Worker)
 * - La página (index.html) se abre al instante desde el celular y se actualiza en segundo plano:
 *   una versión nueva subida a GitHub se ve a partir de la siguiente apertura.
 * - Librerías (gráficos y PDF) se guardan la primera vez y ya no se vuelven a descargar.
 * - Los datos de Google Sheets NO pasan por aquí (la app tiene su propia caché de datos).
 */
const VERSION = 'fertirriego-v1';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(['./', 'index.html'])).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Datos de Apps Script / Google: siempre directo a la red
  if (/(^|\.)google(usercontent)?\.com$/.test(url.hostname)) return;

  // Librerías con versión fija (cdnjs / jsdelivr): primero caché
  if (url.hostname === 'cdnjs.cloudflare.com' || url.hostname === 'cdn.jsdelivr.net') {
    e.respondWith(
      caches.open(VERSION).then(async c => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) c.put(req, res.clone());
        return res;
      })
    );
    return;
  }

  // La app (mismo sitio): muestra la copia guardada y la actualiza en segundo plano
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.open(VERSION).then(async c => {
        const hit = await c.match(req, { ignoreSearch: true });
        const red = fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => null);
        return hit || (await red) || new Response('Sin conexión', { status: 503 });
      })
    );
  }
});
