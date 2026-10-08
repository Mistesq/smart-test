import { createBrowserRouter, redirect } from 'react-router'
import { NotFoundPage } from '../components/NotFoundPage.tsx'
import { PlaceholderPage } from './PlaceholderPage.tsx'

export const router = createBrowserRouter([
  { path: '/', loader: () => redirect('/webhooks') },
  { path: '/login', element: <PlaceholderPage title="Sign in" /> },
  { path: '/webhooks', element: <PlaceholderPage title="Webhooks" /> },
  { path: '/webhooks/:id/edit', element: <PlaceholderPage title="Edit webhook" /> },
  { path: '*', element: <NotFoundPage /> },
])
