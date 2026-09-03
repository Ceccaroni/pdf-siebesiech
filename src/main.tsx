import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { StoreProvider } from './state/store.tsx'
import { initAutoUpdate } from './lib/appUpdate.ts'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>,
)

// Service-Worker nur im Produktions-Build registrieren → App wird nach dem
// ersten Online-Aufruf komplett offline nutzbar. Im Dev bewusst aus (stört HMR).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Zuerst den Update-Listener setzen — sonst könnte der controllerchange eines
    // sofort aktiven neuen Workers verpasst werden.
    initAutoUpdate()
    navigator.serviceWorker
      .register('./sw.js', { scope: './' })
      .catch((err) =>
        console.error('Service-Worker-Registrierung fehlgeschlagen:', err),
      )
  })
}
