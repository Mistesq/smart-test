import { createBrowserRouter, redirect } from 'react-router'
import { AppLayout } from '../components/AppLayout.tsx'
import { NotFoundPage } from '../components/NotFoundPage.tsx'
import { LoginPage } from '../features/auth/LoginPage.tsx'
import { ProtectedRoute } from '../features/auth/ProtectedRoute.tsx'
import { WebhookEditPage } from '../features/webhooks/WebhookEditPage.tsx'
import { WebhooksPage } from '../features/webhooks/WebhooksPage.tsx'
import { LOGIN_PATH, WEBHOOK_EDIT_ROUTE, WEBHOOKS_PATH } from '../lib/paths.ts'

export const router = createBrowserRouter([
  { path: '/', loader: () => redirect(WEBHOOKS_PATH) },
  { path: LOGIN_PATH, element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: WEBHOOKS_PATH, element: <WebhooksPage /> },
          { path: WEBHOOK_EDIT_ROUTE, element: <WebhookEditPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
