# Auth Phase 1 - Login Page, Protected Routes & Logout

## Overview

Wire the session layer into the UI: login form and flow, a protected layout that redirects to login and back, the app bar with the user and logout, and the reaction to an expired session.

## Requirements

- `src/features/auth/authStore.ts`: in-memory status `anonymous | authenticated` with a hook (`useSyncExternalStore`). Starts `anonymous` on every page load (A7)
- Login page (`/login`): react-hook-form + `zodResolver` (email format, password required). MUI TextFields, submit disabled while pending
- Login flow (`useLogin` mutation): `login` → `issueSession(token)` → `getMe()` seeded into the `['me']` query → status `authenticated` → navigate to `location.state.from` or `/webhooks`. The device token only exists inside this function
- Login errors: 422 `fieldErrors` → `setError` on `email` / `password`. Unknown fields or other errors → form-level `Alert`
- Protected layout route: `anonymous` → `<Navigate to="/login" replace state={{ from: location }} />`, keeping pathname + search. `/login` while `authenticated` → redirect to `/webhooks`
- `src/components/AppLayout.tsx`: AppBar with `me.name` (from `useMe`) and a Logout button. Logout: `revokeSession()` (errors ignored) → `queryClient.clear()` → status `anonymous` → `/login`
- Register the session-expired handler once at app start: `queryClient.clear()`, status `anonymous`. The protected route then redirects and keeps the current location. Login page shows "Your session has expired" when redirected this way

## Files to Create

1. `src/features/auth/authStore.ts`
2. `src/features/auth/LoginPage.tsx`, `loginSchema.ts`
3. `src/features/auth/useLogin.ts`, `useLogout.ts`, `useMe.ts`
4. `src/features/auth/ProtectedRoute.tsx`
5. `src/components/AppLayout.tsx`
6. Update `src/app/router.tsx` and `src/app/App.tsx`

## Notes

- Never put the device token, fingerprint or user into the URL. Only `fingerprint` goes to localStorage (already done in API phase 2)
- One 422 → field mapper, shared with the edit form later (e.g. `src/api/errors.ts` helper or `src/lib/formErrors.ts`)
- MUI 9: verify TextField props (`slotProps` vs legacy `InputProps`) with Context7
- react-router 8: verify `Navigate`, `useLocation` and location `state` typing

## Testing

1. Open `/webhooks?page=2&search=hook` signed out → redirected to `/login`
2. Wrong password → error under the password field. Empty email → client error, no request sent
3. Correct credentials (`admin@example.com` / `password123`) → back on `/webhooks?page=2&search=hook`. Network: `/csrf` once, then login → issue → `/v1/me`
4. App bar shows the user's name. Logout → `revoke` 204 → `/login`. Browser Back → redirected to login, no cached data shown
5. Reload while signed in → login page, then back to the same URL after signing in
6. `npm run typecheck`, `npm run lint`, `npm test` pass

## References

- React Router navigation: https://reactrouter.com/
- react-hook-form `setError`: https://react-hook-form.com/docs/useform/seterror
- TanStack Query `QueryClient.clear`: https://tanstack.com/query/v5/docs/reference/QueryClient
