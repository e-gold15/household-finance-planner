import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { PENDING_INVITE_KEY, PENDING_INV_TOKEN_KEY } from '@/lib/localAuth'

// Detect invite params in the URL, stash them, then clean the URL so the
// token is never visible in the browser bar or referrer headers after auth.
const searchParams = new URLSearchParams(window.location.search)

// v2.1 — token-based invite (?inv=<64-char-hex>)
const invToken = searchParams.get('inv')
if (invToken) {
  localStorage.setItem(PENDING_INV_TOKEN_KEY, invToken)
}

// Legacy — id-based invite (?invite=<id>)  [kept for backward compat]
const inviteId = searchParams.get('invite')
if (inviteId) {
  localStorage.setItem(PENDING_INVITE_KEY, inviteId)
}

if (invToken || inviteId) {
  window.history.replaceState({}, '', window.location.pathname)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
