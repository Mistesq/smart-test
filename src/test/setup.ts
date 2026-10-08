import { afterAll, afterEach, beforeAll } from 'vitest'
import { resetDb } from '../mocks/db.ts'
import { server } from '../mocks/node.ts'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  resetDb()
})
afterAll(() => server.close())
