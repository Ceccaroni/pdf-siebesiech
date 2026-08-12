/*
 * Service-Worker für PDF-Siebesiech.
 * Zweck: die App nach dem ersten Online-Aufruf komplett offline lauffähig machen.
 *
 * DATENSCHUTZ: Zwischengespeichert wird ausschliesslich der *App-Code*
 * (same-origin Build-Assets). Nutzer-PDFs kommen über die Datei-Auswahl in den
 * Browser, lösen KEINEN Netzwerk-Request aus und landen deshalb NIE im Cache.
 */

// Beide Werte werden beim Build (vite.config.ts) ersetzt. Der Cache-Name trägt
// einen Build-Hash → jeder neue Build bekommt einen frischen Cache und ersetzt
// den alten sauber. Fallbacks nur fürs Dev / falls das Patchen ausbleibt.
const CACHE = self.__PDF_CACHE__ ?? 'pdf-siebesiech-dev'
const PRECACHE = self.__PDF_PRECACHE__ ?? ['./', './index.html']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  // Nur die eigene Herkunft bedienen — fremde Origins nie cachen.
  if (url.origin !== self.location.origin) return

  // Wichtig: `ignoreVary` beim Cache-Match. Vite lädt JS/CSS mit `crossorigin`,
  // der Server setzt dafür `Vary: Origin`. Ohne ignoreVary vergleicht caches.match
  // den Origin-Header und findet den beim install gecachten Eintrag je nach
  // Browser NICHT → offline weisse Seite. ignoreVary matcht rein nach URL.
  const MATCH = { ignoreVary: true }

  // App-Shell: jede Seiten-Navigation wird offline-fest aus dem Cache bedient.
  // Die index.html zeigt auf gehashte Assets, die ebenfalls im Cache liegen;
  // ein neuer Build bringt einen neuen Cache und ersetzt die alte Shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      caches
        .match('./index.html', MATCH)
        .then((cached) => cached || caches.match('./', MATCH))
        .then((cached) => cached || fetch(request)),
    )
    return
  }

  // Build-Assets (JS/CSS/pdf.js-Worker/Bilder): Cache zuerst, sonst Netz + ablegen.
  event.respondWith(
    caches.match(request, MATCH).then(
      (cached) =>
        cached ||
        fetch(request).then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(request, copy))
          }
          return res
        }),
    ),
  )
})
