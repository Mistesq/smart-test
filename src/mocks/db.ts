export const SESSION_TTL_MS = 30_000

export type User = {
  id: number
  email: string
  first_name: string
  last_name: string
  name: string
}

export type Webhook = {
  id: number
  name: string
  url: string
  active: boolean
  created_at: string
}

type Session = {
  fingerprint: string
  expiresAt: number
}

type DbState = {
  webhooks: Webhook[]
  session: Session | null
  // Issued, not yet consumed device tokens mapped to the fingerprint they were issued for.
  deviceTokens: Map<string, string>
}

export const USER: User = {
  id: 1,
  email: 'admin@example.com',
  first_name: 'Admin',
  last_name: 'User',
  name: 'Admin User',
}

export const USER_PASSWORD = 'password123'

const ENTITIES = ['Order', 'Payment', 'Customer', 'Subscription', 'Invoice', 'Contact', 'Message']
const ACTIONS = ['created', 'updated', 'deleted', 'archived']
const FIRST_CREATED_AT = Date.UTC(2026, 0, 1)
const DAY_MS = 24 * 60 * 60 * 1000

function createWebhooks(): Webhook[] {
  return ENTITIES.flatMap((entity) => ACTIONS.map((action) => ({ entity, action }))).map(
    ({ entity, action }, index) => ({
      id: index + 1,
      name: `${entity} ${action}`,
      url: `https://hooks.example.com/${entity.toLowerCase()}/${action}`,
      active: index % 5 !== 4,
      created_at: new Date(FIRST_CREATED_AT + index * DAY_MS).toISOString(),
    }),
  )
}

function createState(): DbState {
  return { webhooks: createWebhooks(), session: null, deviceTokens: new Map() }
}

export const db: DbState = createState()

export function resetDb(): void {
  Object.assign(db, createState())
}
