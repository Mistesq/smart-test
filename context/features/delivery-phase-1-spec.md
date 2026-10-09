# Delivery Phase 1 - README & Final Checks

## Overview

Prepare the repo for handover: a README that tells readers how to run and test the app and why it is built this way, plus final quality gates.

## Requirements

- Replace the Vite template `README.md`: short description, stack with versions, requirements (Node version), `npm install`, `npm run dev`, `npm run build && npm run preview`
- Tests: `npm test`, and where the required test lives (file and test name: two parallel 401s → one rotate → successful retries)
- Test credentials: `admin@example.com` / `password123`
- Key decisions (short): one HTTP client for headers/CSRF/419/401, shared rotate + generation counter, single-flight CSRF, auth endpoints excluded from rotate, URL as the source of truth for list state (replace vs push), Zod at every boundary, MSW also in the production build, edit as a separate page
- Known limitations / unfinished: mock state resets on reload (MSW runs in the page, so re-login is needed), 404 on PUT added beyond the contract, anything not done
- "How this was built" section: developed with Claude Code; agent rules in `CLAUDE.md`, `AGENTS.md` and `context/`; specs in `context/features/`; workflow and review agent in `.claude/`. Decomposition, session and retry design, review and verification are mine
- Remove leftover scaffold files that are no longer used (ask before deleting)
- Final gates all pass: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`

## Files to Create

1. `README.md` (rewrite)
2. Delete unused scaffold assets, after confirmation

## Notes

- README is in English, short, and written for a reader who has 10 minutes
- Do not claim anything that is not implemented. Check each decision against the code before writing it
- Do not commit the spec PDF (already gitignored)

## Testing

1. Fresh clone → follow README exactly → app runs, sign in with the listed credentials works
2. `npm test` → the required rotate test is listed and passes
3. `npm run lint`, `npm run typecheck`, `npm run build` → no errors or warnings
4. `npm run preview` → app works with MSW in the production build

## References

- Vite build and preview: https://vite.dev/guide/static-deploy
