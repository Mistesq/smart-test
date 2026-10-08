import { setupWorker, type SetupWorker } from 'msw/browser'
import { handlers } from './handlers.ts'

declare global {
  interface Window {
    // Dev only: lets handlers be overridden from the console, e.g. `__msw.use(...)`.
    __msw?: SetupWorker
  }
}

export const worker = setupWorker(...handlers)
