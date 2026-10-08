import { describe, expect, it } from 'vitest'
import { createRedirectState, DEFAULT_REDIRECT, getRedirectTarget } from './redirect.ts'

describe('getRedirectTarget', () => {
  it('returns the original path with its query', () => {
    expect(getRedirectTarget(createRedirectState('/webhooks', '?page=2&search=ate'))).toBe(
      '/webhooks?page=2&search=ate',
    )
    expect(getRedirectTarget(createRedirectState('/webhooks/3/edit', ''))).toBe('/webhooks/3/edit')
  })

  it.each([
    ['no state', null],
    ['a malformed state', { from: '/webhooks' }],
    ['a relative path', createRedirectState('webhooks', '')],
    ['a protocol-relative path', createRedirectState('//evil.example', '')],
    ['the login page', createRedirectState('/login', '')],
    ['a search without "?"', createRedirectState('/webhooks', 'page=2')],
  ])('falls back to the webhook list for %s', (_, state) => {
    expect(getRedirectTarget(state)).toBe(DEFAULT_REDIRECT)
  })
})
