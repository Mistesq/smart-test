import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { LOGIN_PATH } from '../../lib/paths.ts'
import { signOut } from './authFlow.ts'
import { setLoggedOut } from './authStore.ts'

export function useLogout() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  return useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      // Pushed, so Back returns to the protected page, which then redirects to the login page again.
      void navigate(LOGIN_PATH)
      queryClient.clear()
      setLoggedOut()
    },
  })
}
