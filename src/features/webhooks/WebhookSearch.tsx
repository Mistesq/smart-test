import { TextField } from '@mui/material'
import { useEffect, useState } from 'react'

const SEARCH_DEBOUNCE_MS = 300

type WebhookSearchProps = {
  // The trimmed search from the URL.
  value: string
  onSearchChange: (search: string) => void
}

export function WebhookSearch({ value, onSearchChange }: WebhookSearchProps) {
  // Raw input text: the only local copy of the search, the URL stays the source of truth.
  const [text, setText] = useState(value)
  const [syncedValue, setSyncedValue] = useState(value)

  // The URL changed (back/forward, a link): show its search unless the input already means the same.
  if (value !== syncedValue) {
    setSyncedValue(value)
    if (text.trim() !== value) setText(value)
  }

  useEffect(() => {
    const term = text.trim()
    // Nothing to write when the URL already has this search; this also stops a write-back loop.
    if (term === value) return
    const timer = window.setTimeout(() => onSearchChange(term), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [text, value, onSearchChange])

  return (
    <TextField
      label="Search by name"
      type="search"
      value={text}
      onChange={(event) => setText(event.target.value)}
      fullWidth
    />
  )
}
