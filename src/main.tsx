import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { StoreProvider } from './state/store.tsx'

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
    navigator.serviceWorker
      .register('./sw.js', { scope: './' })
      .catch((err) =>
        console.error('Service-Worker-Registrierung fehlgeschlagen:', err),
      )
  })
}
