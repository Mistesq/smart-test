# Coding Standards

<!--
  Stack-agnostic baseline. Adapt it before building:
  - existing repo: run `/bootstrap existing`, it rewrites this file from the code's real conventions;
  - new project: run `/bootstrap new`, or install with `--preset <name>` (see presets/ in the starter).
-->

## TypeScript

- Strict mode enabled
- No `any` types. Use proper typing or `unknown` and narrow
- Define types for props, API requests/responses and data models
- Use type inference where obvious, explicit types where helpful

## Boundaries

- Validate all external input at the boundary with Zod: request bodies, params, query strings, forms, env, third-party responses
- Keep business logic out of the transport layer: route handlers, controllers and actions parse input, call a service, return a result
- Map expected failures to the right status codes in ONE place. Never leak stack traces or internal messages

## Data

- Schema changes only through migrations. Never push schema directly to a shared database
- Unique constraints for natural keys instead of check-then-insert
- Transactions or conditional updates for anything that must be atomic
- Money as integer minor units (cents). Totals and prices are computed on the server
- Paginate lists that can grow

## Security

- Secrets come from env, never from code or commits
- Authorization check on every mutation and every protected read

## React (if used)

- Functional components and hooks. One job per component
- Handle loading, empty and error states

## File Organization

TODO: filled by `/bootstrap` from the real layout.

## Naming

- Components: PascalCase
- Functions: camelCase
- Constants: SCREAMING_SNAKE_CASE
- Types/Interfaces: PascalCase (no prefix)

## Code Quality

- No commented-out code unless specified
- No unused imports or variables
- Keep functions under 50 lines when possible
