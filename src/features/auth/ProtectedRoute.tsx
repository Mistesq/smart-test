import { Navigate, Outlet, useLocation } from 'react-router'
import { LOGIN_PATH } from '../../lib/paths.ts'
import { useAuthState } from './authStore.ts'
import { createRedirectState } from './redirect.ts'

export function ProtectedRoute() {
  const auth = useAuthState()
  const location = useLocation()

  if (auth.status === 'authenticated') return <Outlet />

  // useLogout is already navigating to the login page, and the page is not remembered.
  if (auth.reason === 'logout') return null

  // The page's own state (the edit page's list context) goes along, so it is restored after signing in.
  const redirectState = createRedirectState(location.pathname, location.search, location.state)
  return <Navigate to={LOGIN_PATH} replace state={redirectState} />
}
