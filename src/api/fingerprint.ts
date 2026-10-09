const FINGERPRINT_STORAGE_KEY = 'smart-test.fingerprint'
const FINGERPRINT_PATTERN = /^[0-9a-f]{32}$/
const FINGERPRINT_BYTES = 16

export type FingerprintStorage = Pick<Storage, 'getItem' | 'setItem'>

// Used when storage cannot keep the value (missing, blocked, full), so every call still gets the same fingerprint.
let pageFingerprint: string | null = null

// window.localStorage itself throws when site data is blocked; Node tests have no window.
function defaultStorage(): FingerprintStorage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function readStored(storage: FingerprintStorage | null): string | null {
  try {
    return storage?.getItem(FINGERPRINT_STORAGE_KEY) ?? null
  } catch {
    return null
  }
}

function store(storage: FingerprintStorage | null, fingerprint: string): void {
  try {
    storage?.setItem(FINGERPRINT_STORAGE_KEY, fingerprint)
  } catch {
    // Quota exceeded or private mode: pageFingerprint keeps the value for this page.
  }
}

function generateFingerprint(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(FINGERPRINT_BYTES))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

// 32 hex chars, created once per browser and reused for every auth request (A5). Never throws.
export function getFingerprint(storage: FingerprintStorage | null = defaultStorage()): string {
  const stored = readStored(storage)
  if (stored && FINGERPRINT_PATTERN.test(stored)) return stored

  pageFingerprint ??= generateFingerprint()
  store(storage, pageFingerprint)
  return pageFingerprint
}
