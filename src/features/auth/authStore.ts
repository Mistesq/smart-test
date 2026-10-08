import { useSyncExternalStore } from 'react'

// Why the user is signed out: 'initial' after a page load (A7), 'logout' right after a deliberate logout,
// 'expired' after the session could not be renewed.
export type AnonymousReason = 'initial' | 'logout' | 'expired'

export type AuthState = { status: 'authenticated' } | { status: 'anonymous'; reason: AnonymousReason }

const INITIAL_STATE: AuthState = { status: 'anonymous', reason: 'initial' }

let state: AuthState = INITIAL_STATE
const listeners = new Set<() => void>()

function setState(next: AuthState): void {
  state = next
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getAuthState(): AuthState {
  return state
}

export function useAuthState(): AuthState {
  return useSyncExternalStore(subscribe, getAuthState)
}

export function setAuthenticated(): void {
  setState({ status: 'authenticated' })
}

export function setLoggedOut(): void {
  setState({ status: 'anonymous', reason: 'logout' })
}

export function setSessionExpired(): void {
  setState({ status: 'anonymous', reason: 'expired' })
}

// Called once the login page is shown after a logout, so Back to a protected page redirects as usual again
// (the protected route renders nothing while the logout navigation is in flight).
export function acknowledgeLogout(): void {
  if (state.status === 'anonymous' && state.reason === 'logout') setState(INITIAL_STATE)
}

export function resetAuthStore(): void {
  state = INITIAL_STATE
  listeners.clear()
}
