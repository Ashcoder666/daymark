import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthGate } from './AuthGate.tsx'
import { inDesktopApp } from './desktop'
import './mobile.css'

if (!inDesktopApp && 'serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(registration => {
      void registration.update()
    }).catch(error => console.warn('Offline app setup failed', error))
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate><App /></AuthGate>
  </StrictMode>,
)
