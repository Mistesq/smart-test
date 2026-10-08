import { useMutation, useQueryClient } from '@tanstack/react-query'
import { signIn } from './authFlow.ts'
import { setAuthenticated } from './authStore.ts'
import { ME_QUERY_KEY } from './useMe.ts'

// On success the login page sees the authenticated status and redirects to the page the user came from.
export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: signIn,
    // The variables hold the password: drop the mutation as soon as the login page no longer observes it.
    gcTime: 0,
    onSuccess: (user) => {
      queryClient.setQueryData(ME_QUERY_KEY, user)
      setAuthenticated()
    },
  })
}
