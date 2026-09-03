/*
 * Auto-Update für die installierte PWA.
 *
 * Problem: Der Service-Worker (public/sw.js) tauscht sich bei einem neuen Build
 * per skipWaiting()/clients.claim() selbst aus — die bereits geladene Seite läuft
 * aber mit dem ALTEN, schon geparsten Bundle weiter, bis man einmal neu lädt. Bis
 * dahin sieht man den alten Stand (was bei schweren PDFs die „weisse Seite"
 * verursachte).
 *
 * Lösung: genau EINMAL neu laden, sobald ein neuer Worker die Kontrolle übernimmt
 * — aber nur, wenn nichts Ungespeichertes offen ist (im Speicher gehaltene PDFs/
 * Anmerkungen). Ist gerade ein Dokument offen, wird der Reload aufgeschoben, bis
 * wieder nichts offen ist → kein Datenverlust.
 */

let hadController = false
let updatePending = false
let reloading = false
let safe = true

function maybeReload(): void {
  if (!updatePending || reloading || !safe) return
  reloading = true
  window.location.reload()
}

/**
 * Meldet, ob gerade gefahrlos neu geladen werden darf (= kein Dokument offen).
 * Von der App bei jeder relevanten Zustandsänderung aufrufen; ein aufgeschobener
 * Reload wird nachgeholt, sobald es wieder sicher ist.
 */
export function setSafeToReload(value: boolean): void {
  safe = value
  maybeReload()
}

/** Einmalig beim App-Start aufrufen (registriert den Update-Listener). */
export function initAutoUpdate(): void {
  if (!('serviceWorker' in navigator)) return
  // Kontrolliert schon ein SW die Seite? Bei einem Folgebesuch ist `controller`
  // bereits gesetzt → jeder controllerchange ist ein echtes Update. Beim
  // Erstbesuch (oder nach Hard-Reload) ist `controller` null; dann ist der ERSTE
  // controllerchange nur die Erst-Übernahme durch den SW — kein Reload —, erst
  // die folgenden sind Updates. Darum die Flag beim ersten Wechsel nachziehen,
  // statt sie einmalig zu latchen (sonst bliebe ein Update derselben Sitzung
  // unbemerkt).
  hadController = Boolean(navigator.serviceWorker.controller)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) {
      hadController = true
      return
    }
    updatePending = true
    maybeReload()
  })
}
