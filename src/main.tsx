import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './research.css'
import './cross-source.css'
import './host-intelligence.css'
import './research-jobs.css'
import './quality-intelligence.css'
import './pain.css'
import './pain-history.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
