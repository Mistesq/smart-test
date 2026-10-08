import { afterAll, afterEach, beforeAll } from 'vitest'
import { resetCsrfToken } from '../api/csrf.ts'
import { resetHttpClient } from '../api/httpClient.ts'
import { resetDb } from '../mocks/db.ts'
import { server } from '../mocks/node.ts'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  resetDb()
  resetCsrfToken()
  resetHttpClient()
})
afterAll(() => server.close())
