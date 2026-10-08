import { issueSession, rotateSession } from './auth.ts'
import { configureHttpClient, type UnauthorizedDecision, type UnauthorizedInfo } from './httpClient.ts'

// Auth endpoints answer for themselves: a 401 there never starts a rotate, so rotate cannot trigger rotate.
const AUTH_PATH_PREFIX = '/auth/'

type SessionContext = {
  // The generation the request was sent under.
  generation: number
}

export type SessionExpiredHandler = () => void

// Bumped by every successful startSession() or rotate. A 401 for an older generation was caused by a session
// that has since been renewed, so the request is retried without another rotate.
let generation = 0
// Set when the session ends; every further 401 fails at once until the next startSession().
let expired = false
let rotating: Promise<boolean> | null = null
let sessionExpiredHandler: SessionExpiredHandler | null = null

export function setSessionExpiredHandler(handler: SessionExpiredHandler | null): void {
  sessionExpiredHandler = handler
}

// The only way to start a session: issues it with the device token from login(), then opens a new generation.
export async function startSession(deviceSessionToken: string): Promise<void> {
  await issueSession(deviceSessionToken)
  generation += 1
  expired = false
}

// Deliberate logout: every later 401 fails at once, without a rotate and without the session-expired handler.
// A rotate still in flight is dropped, so a 401 after the next startSession() cannot join its stale result.
export function endSession(): void {
  expired = true
  rotating = null
}

function expireSession(): void {
  if (expired) return
  expired = true
  sessionExpiredHandler?.()
}

// Single flight: every 401 that arrives while a rotate is running awaits the same promise.
function sharedRotate(): Promise<boolean> {
  if (rotating) return rotating

  const pending: Promise<boolean> = rotateSession()
    .then(
      () => {
        // A reset while rotating makes this result stale.
        if (rotating === pending) generation += 1
        return true
      },
      () => false,
    )
    .finally(() => {
      if (rotating === pending) rotating = null
    })
  rotating = pending
  return pending
}

async function handleUnauthorized(context: SessionContext, info: UnauthorizedInfo): Promise<UnauthorizedDecision> {
  if (info.path.startsWith(AUTH_PATH_PREFIX) || expired) return 'fail'
  if (info.isRetry) {
    expireSession()
    return 'fail'
  }
  if (context.generation < generation) return 'retry'
  if (await sharedRotate()) return 'retry'
  // A new session started while the rotate was failing: the request is retried under it instead of ending it.
  if (context.generation < generation) return 'retry'
  expireSession()
  return 'fail'
}

// Installs the session rules into the HTTP client and returns a function that removes them.
export function installSessionHandling(): () => void {
  return configureHttpClient<SessionContext>({
    getRequestContext: () => ({ generation }),
    onUnauthorized: handleUnauthorized,
  })
}

export function resetSession(): void {
  generation = 0
  expired = false
  rotating = null
  sessionExpiredHandler = null
}
