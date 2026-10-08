@AGENTS.md

# {{PROJECT_NAME}}

{{ONE_LINE_DESCRIPTION}}

## Context Files

Read the following to get the full context of the project:

- @context/project-overview.md
- @context/coding-standards.md
- @context/ai-interaction.md
- @context/current-feature.md

## Commands

<!-- /bootstrap rewrites this list from the real package.json scripts. -->

- **Dev server**: `npm run dev`
- **Build**: `npm run build`
- **Lint**: `npm run lint`
- **Typecheck**: `npm run typecheck` (or `npx tsc --noEmit`)
- **Test (once)**: `npm test`
- **Test (watch)**: `npm run test:watch`

<!--
  DELETE THIS BLOCK IF THE PROJECT HAS NO DATABASE / MCP DB ACCESS.
  Keep it (and adjust the provider name) when the AI can reach the DB
  through an MCP server. Concrete project/branch IDs are secrets and
  live in CLAUDE.local.md (gitignored; copy CLAUDE.local.md.example).
-->

## Database Access Rules (via MCP)

Concrete project/branch identifiers are machine/account-specific and live in
`CLAUDE.local.md` (gitignored). The rules below reference branches by role;
resolve the actual IDs from that file.

- Default every query/operation to the **development** branch. Always pass the
  development branch id explicitly. Never rely on the default branch, since the
  default is production.
- **NEVER** touch the **production** branch (no reads, writes, schema changes,
  or migrations) unless I explicitly name "production" in my request.
- Never run destructive SQL (`DROP`, `DELETE`, `TRUNCATE`, unconfirmed
  `UPDATE`/`INSERT`) or any branch/project deletion without asking me first,
  even on development.
- When you run a DB operation, state which branch you used.
