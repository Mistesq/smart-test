import { QueryClient } from '@tanstack/react-query'

// The HTTP client owns retries (CSRF refetch, session rotate), so the query layer never retries on its own.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
    mutations: { retry: false },
  },
})
