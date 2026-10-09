import { createBrowserRouter, redirect } from 'react-router'
import { AppLayout } from '../components/AppLayout.tsx'
import { NotFoundPage } from '../components/NotFoundPage.tsx'
import { LoginPage } from '../features/auth/LoginPage.tsx'
import { ProtectedRoute } from '../features/auth/ProtectedRoute.tsx'
import { WebhookEditPage } from '../features/webhooks/WebhookEditPage.tsx'
import { WebhooksPage } from '../features/webhooks/WebhooksPage.tsx'

export const router = createBrowserRouter([
  { path: '/', loader: () => redirect('/webhooks') },
  { path: '/login', element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/webhooks', element: <WebhooksPage /> },
          { path: '/webhooks/:id/edit', element: <WebhookEditPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
