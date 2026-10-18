import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import './index.css'

// After a new deploy, an app left open still points at the old file names — reload once to get the new ones.
window.addEventListener('vite:preloadError', () => {
  try { if (sessionStorage.getItem('ll-reloaded') !== '1') { sessionStorage.setItem('ll-reloaded', '1'); window.location.reload(); } } catch { window.location.reload(); }
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
