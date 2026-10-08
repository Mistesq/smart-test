import { describe, expect, it } from 'vitest'
import {
  acknowledgeLogout,
  getAuthState,
  setAuthenticated,
  setLoggedOut,
  setSessionExpired,
} from './authStore.ts'

describe('authStore', () => {
  it('starts anonymous after a page load', () => {
    expect(getAuthState()).toEqual({ status: 'anonymous', reason: 'initial' })
  })

  it('records why the user is signed out', () => {
    setAuthenticated()
    expect(getAuthState()).toEqual({ status: 'authenticated' })

    setSessionExpired()
    expect(getAuthState()).toEqual({ status: 'anonymous', reason: 'expired' })

    setLoggedOut()
    expect(getAuthState()).toEqual({ status: 'anonymous', reason: 'logout' })
  })

  it('turns a logout into a plain signed-out state once acknowledged', () => {
    setLoggedOut()
    acknowledgeLogout()
    expect(getAuthState()).toEqual({ status: 'anonymous', reason: 'initial' })
  })

  it('keeps any other state when a logout is acknowledged', () => {
    setSessionExpired()
    acknowledgeLogout()
    expect(getAuthState()).toEqual({ status: 'anonymous', reason: 'expired' })

    setAuthenticated()
    acknowledgeLogout()
    expect(getAuthState()).toEqual({ status: 'authenticated' })
  })
})
