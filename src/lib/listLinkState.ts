import { z } from 'zod'

// Location state a list row passes to the edit page, so it can return to the same page and search.
// The login redirect carries it too, so it survives a session expiry on the edit page.
const listLinkStateSchema = z.object({ listSearch: z.string() })

export type ListLinkState = z.infer<typeof listLinkStateSchema>

// History state is untyped and survives a reload, so it is validated; anything else → null.
export function parseListLinkState(state: unknown): ListLinkState | null {
  const parsed = listLinkStateSchema.safeParse(state)
  return parsed.success ? parsed.data : null
}
