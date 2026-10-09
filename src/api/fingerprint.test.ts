import { describe, expect, it } from 'vitest'
import { type FingerprintStorage, getFingerprint } from './fingerprint.ts'

function createStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial))
  const storage: FingerprintStorage = {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value)
    },
  }
  return { storage, items }
}

describe('getFingerprint', () => {
  it('creates 32 hex chars and returns the same value on the second call', () => {
    const { storage, items } = createStorage()

    const first = getFingerprint(storage)

    expect(first).toMatch(/^[0-9a-f]{32}$/)
    expect(getFingerprint(storage)).toBe(first)
    expect([...items.values()]).toEqual([first])
  })

  it('reuses a fingerprint already saved in storage', () => {
    const saved = 'abcdef0123456789abcdef0123456789'
    const { storage } = createStorage({ 'smart-test.fingerprint': saved })

    expect(getFingerprint(storage)).toBe(saved)
  })

  it('replaces a malformed saved value', () => {
    const { storage, items } = createStorage({ 'smart-test.fingerprint': 'not-a-fingerprint' })

    const fingerprint = getFingerprint(storage)

    expect(fingerprint).toMatch(/^[0-9a-f]{32}$/)
    expect(items.get('smart-test.fingerprint')).toBe(fingerprint)
  })

  it('keeps one fingerprint for the page when storage throws on read and write', () => {
    const storage: FingerprintStorage = {
      getItem: () => {
        throw new DOMException('Blocked', 'SecurityError')
      },
      setItem: () => {
        throw new DOMException('Blocked', 'SecurityError')
      },
    }

    const first = getFingerprint(storage)

    expect(first).toMatch(/^[0-9a-f]{32}$/)
    expect(getFingerprint(storage)).toBe(first)
  })

  it('keeps one fingerprint for the page when storage cannot save it', () => {
    const storage: FingerprintStorage = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException('Full', 'QuotaExceededError')
      },
    }

    const first = getFingerprint(storage)

    expect(first).toMatch(/^[0-9a-f]{32}$/)
    expect(getFingerprint(storage)).toBe(first)
  })

  it('works without an explicit storage when localStorage is unavailable', () => {
    expect(getFingerprint()).toBe(getFingerprint())
  })
})
