import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

async function boot() {
  // Al abrir la interfaz en un navegador (npx vite) no existe el puente de Electron:
  // se usa una API simulada, solo en desarrollo. No entra en el build de producción.
  if (import.meta.env.DEV && !window.api) await import('./dev/mockApi.js')

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

boot()
