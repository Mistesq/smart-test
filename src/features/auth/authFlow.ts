import { getMe, login, revokeSession, type LoginCredentials, type User } from '../../api/auth.ts'
import { endSession, startSession } from '../../api/session.ts'

// The device token only lives inside this function: it goes from login() straight to startSession().
export async function signIn(credentials: LoginCredentials): Promise<User> {
  const deviceSessionToken = await login(credentials)
  await startSession(deviceSessionToken)
  try {
    return await getMe()
  } catch (error) {
    // The user stays signed out, so the session that was just issued must not stay open on the server.
    await signOut()
    throw error
  }
}

// Never rejects: the local session ends whether or not the server confirms the revoke.
export async function signOut(): Promise<void> {
  // Ended first, so a 401 that lands after the revoke does not rotate or report an expired session.
  endSession()
  await revokeSession().catch(() => undefined)
}
