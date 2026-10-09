import { describe, expect, it } from 'vitest'
import { parseWebhookId, webhookFormSchema } from './webhookFormSchema.ts'

describe('webhookFormSchema', () => {
  it('trims the values', () => {
    expect(webhookFormSchema.parse({ name: '  Order created ', url: ' https://example.com ' })).toEqual({
      name: 'Order created',
      url: 'https://example.com',
    })
  })

  it('requires a non-blank name and url', () => {
    const result = webhookFormSchema.safeParse({ name: '   ', url: '' })

    expect(result.success).toBe(false)
    expect(result.error?.flatten().fieldErrors).toEqual({ name: ['Name is required'], url: ['URL is required'] })
  })

  it('leaves the URL format to the server', () => {
    expect(webhookFormSchema.safeParse({ name: 'Order created', url: 'ftp://x' }).success).toBe(true)
  })
})

describe('parseWebhookId', () => {
  it('reads a positive integer id', () => {
    expect(parseWebhookId('1')).toBe(1)
    expect(parseWebhookId('9999')).toBe(9999)
  })

  it.each([undefined, '', 'abc', '0', '-1', '01', '1.5', '1e3', ' 1', '0x10', '99999999999999999999'])(
    'rejects %j',
    (param) => {
      expect(parseWebhookId(param)).toBeNull()
    },
  )
})
