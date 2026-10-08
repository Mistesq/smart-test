import { useQuery } from '@tanstack/react-query'
import { getMe } from '../../api/auth.ts'

export const ME_QUERY_KEY = ['me'] as const

// Seeded at login and removed on logout or expiry, so it never needs a refetch while signed in.
export function useMe() {
  return useQuery({ queryKey: ME_QUERY_KEY, queryFn: getMe, staleTime: Infinity })
}
