import { http, HttpResponse } from 'msw'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { installSessionHandling, setSessionExpiredHandler } from './api/session.ts'
import { App } from './app/App.tsx'
import { queryClient } from './app/queryClient.ts'
import { setSessionExpired } from './features/auth/authStore.ts'
import { worker } from './mocks/browser.ts'

installSessionHandling()
// The protected route then redirects to the login page and keeps the current location.
setSessionExpiredHandler(() => {
  queryClient.clear()
  setSessionExpired()
})

// There is no real API, so the mock worker runs in dev and production builds alike (A12).
async function enableMocking() {
  await worker.start({ onUnhandledRequest: 'bypass' })
  if (import.meta.env.DEV) {
    window.__msw = { worker, http, HttpResponse }
  }
}

const root = createRoot(document.getElementById('root')!)

enableMocking().then(
  () => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  },
  (error: unknown) => {
    console.error('Failed to start the mock API:', error)
    const message = error instanceof Error ? error.message : String(error)
    root.render(<p>Failed to start the mock API: {message}</p>)
  },
)
