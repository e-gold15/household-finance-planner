import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { PENDING_INVITE_KEY } from '@/lib/localAuth'

// Detect ?invite=ID in the URL, stash it in localStorage, then clean the URL
// so the token isn't visible or shareable in the browser bar after sign-in.
const searchParams = new URLSearchParams(window.location.search)
const inviteId = searchParams.get('invite')
if (inviteId) {
  localStorage.setItem(PENDING_INVITE_KEY, inviteId)
  // Replace history entry to strip the query param from the URL
  const cleanUrl = window.location.pathname
  window.history.replaceState({}, '', cleanUrl)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
