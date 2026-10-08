import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuthState } from './authStore.ts'
import { createRedirectState } from './redirect.ts'

export function ProtectedRoute() {
  const auth = useAuthState()
  const location = useLocation()

  if (auth.status === 'authenticated') return <Outlet />

  // useLogout is already navigating to the login page, and the page is not remembered.
  if (auth.reason === 'logout') return null

  return <Navigate to="/login" replace state={createRedirectState(location.pathname, location.search)} />
}
