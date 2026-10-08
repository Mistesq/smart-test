import { describe, expect, it } from 'vitest'
import { buildListSearchParams, parseListParams, toListSearch } from './listParams.ts'

const parse = (search: string) => parseListParams(new URLSearchParams(search))

describe('parseListParams', () => {
  it('reads page and search from the URL', () => {
    expect(parse('?page=2&search=ate')).toEqual({ page: 2, search: 'ate' })
  })

  it('defaults to page 1 and an empty search when they are missing', () => {
    expect(parse('')).toEqual({ page: 1, search: '' })
  })

  it.each(['abc', '0', '-3', '2.5', '', 'Infinity', '99999999999999999999'])('falls back to page 1 for page=%s', (page) => {
    expect(parse(`?page=${page}`).page).toBe(1)
  })

  it('keeps a page beyond the last one (the page clamps it once the total is known)', () => {
    expect(parse('?page=99').page).toBe(99)
  })

  it('trims the search', () => {
    expect(parse('?search=%20%20order%20')).toEqual({ page: 1, search: 'order' })
    expect(parse('?search=%20%20')).toEqual({ page: 1, search: '' })
  })
})

describe('buildListSearchParams', () => {
  it('writes page and search', () => {
    expect(buildListSearchParams({ page: 2, search: 'ate' }).toString()).toBe('page=2&search=ate')
  })

  it('omits the defaults', () => {
    expect(buildListSearchParams({ page: 1, search: '' }).toString()).toBe('')
    expect(buildListSearchParams({ page: 1, search: 'order' }).toString()).toBe('search=order')
    expect(buildListSearchParams({ page: 3, search: '' }).toString()).toBe('page=3')
  })

  it('trims the search and omits a blank one', () => {
    expect(buildListSearchParams({ page: 1, search: ' order ' }).toString()).toBe('search=order')
    expect(buildListSearchParams({ page: 1, search: '   ' }).toString()).toBe('')
  })

  it('round-trips through parseListParams', () => {
    const params = { page: 3, search: 'payment created' }
    expect(parseListParams(buildListSearchParams(params))).toEqual(params)
  })
})

describe('toListSearch', () => {
  it('returns a location search string', () => {
    expect(toListSearch({ page: 2, search: 'ate' })).toBe('?page=2&search=ate')
    expect(toListSearch({ page: 1, search: '' })).toBe('')
  })
})
