import { describe, expect, it } from 'vitest'
import { WEBHOOKS_PATH } from '../../lib/paths.ts'
import { getListReturnTarget } from '../webhooks/listParams.ts'
import { createRedirectState, getRedirectTarget } from './redirect.ts'

describe('getRedirectTarget', () => {
  it('returns the original path with its query', () => {
    expect(getRedirectTarget(createRedirectState('/webhooks', '?page=2&search=ate'))).toEqual({
      to: '/webhooks?page=2&search=ate',
    })
    expect(getRedirectTarget(createRedirectState('/webhooks/3/edit', ''))).toEqual({ to: '/webhooks/3/edit' })
  })

  it.each([
    ['no state', null],
    ['a malformed state', { from: '/webhooks' }],
    ['a relative path', createRedirectState('webhooks', '')],
    ['a protocol-relative path', createRedirectState('//evil.example', '')],
    ['the login page', createRedirectState('/login', '')],
    ['a search without "?"', createRedirectState('/webhooks', 'page=2')],
  ])('falls back to the webhook list for %s', (_, state) => {
    expect(getRedirectTarget(state)).toEqual({ to: WEBHOOKS_PATH })
  })
})

describe('list context through the login redirect', () => {
  // The flow: /webhooks?page=3&search=ate → a row link to the edit page → session expiry → sign-in → Cancel.
  it('returns the edit page to the list it was opened from', () => {
    const linkState = { listSearch: '?page=3&search=ate' }

    const target = getRedirectTarget(createRedirectState('/webhooks/5/edit', '', linkState))

    expect(target).toEqual({ to: '/webhooks/5/edit', state: linkState })
    expect(getListReturnTarget(target.state)).toBe('/webhooks?page=3&search=ate')
  })

  it.each([
    ['no state', undefined],
    ['a string', '?page=3'],
    ['a wrong field type', { listSearch: 3 }],
  ])('keeps the edit page and returns to the plain list for %s', (_, routerState) => {
    const target = getRedirectTarget(createRedirectState('/webhooks/5/edit', '', routerState))

    expect(target).toEqual({ to: '/webhooks/5/edit' })
    expect(getListReturnTarget(target.state)).toBe(WEBHOOKS_PATH)
  })

  it('drops a tampered list context in the history state and keeps the path', () => {
    const state = { from: { pathname: '/webhooks/5/edit', search: '', listLink: { listSearch: ['?page=3'] } } }

    expect(getRedirectTarget(state)).toEqual({ to: '/webhooks/5/edit' })
  })
})
