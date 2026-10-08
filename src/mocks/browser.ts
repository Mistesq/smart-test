import type { http, HttpResponse } from 'msw'
import { setupWorker, type SetupWorker } from 'msw/browser'
import { handlers } from './handlers.ts'

declare global {
  interface Window {
    // Dev only: lets handlers be overridden from the console without imports, e.g.
    // `__msw.worker.use(__msw.http.get('*/v1/webhooks', () => __msw.HttpResponse.json({}, { status: 500 })))`.
    __msw?: {
      worker: SetupWorker
      http: typeof http
      HttpResponse: typeof HttpResponse
    }
  }
}

export const worker = setupWorker(...handlers)
