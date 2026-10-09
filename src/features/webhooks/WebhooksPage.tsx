import { Alert, Box, Button, CircularProgress, Container, Pagination, Stack, Typography } from '@mui/material'
import { useCallback } from 'react'
import { Navigate, useSearchParams } from 'react-router'
import { getErrorMessage } from '../../api/errors.ts'
import { buildListSearchParams, DEFAULT_PAGE, parseListParams, toListSearch, type ListParams } from './listParams.ts'
import { useWebhooks } from './useWebhooks.ts'
import { WebhookSearch } from './WebhookSearch.tsx'
import { WebhooksTable } from './WebhooksTable.tsx'

export function WebhooksPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const params = parseListParams(searchParams)

  // Typing replaces the history entry and starts from the first page (A8).
  const handleSearchChange = useCallback(
    (search: string) => setSearchParams(buildListSearchParams({ page: DEFAULT_PAGE, search }), { replace: true }),
    [setSearchParams],
  )
  // A page change pushes a new history entry, so back/forward walk through pages.
  const handlePageChange = (page: number) => setSearchParams(buildListSearchParams({ ...params, page }))

  return (
    <Container sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Typography variant="h4" component="h1">
          Webhooks
        </Typography>
        <WebhookSearch value={params.search} onSearchChange={handleSearchChange} />
        <WebhooksResult params={params} onPageChange={handlePageChange} />
      </Stack>
    </Container>
  )
}

type WebhooksResultProps = {
  params: ListParams
  onPageChange: (page: number) => void
}

function LoadingState() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
      <CircularProgress aria-label="Loading webhooks" />
    </Box>
  )
}

function WebhooksResult({ params, onPageChange }: WebhooksResultProps) {
  const query = useWebhooks(params)

  if (query.isPending) return <LoadingState />

  if (query.isError) {
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={() => query.refetch()} disabled={query.isFetching}>
            Retry
          </Button>
        }
      >
        {getErrorMessage(query.error)}
      </Alert>
    )
  }

  const { data, paging } = query.data
  const lastPage = paging.pages.last
  // A page beyond the last one (an old link, or rows removed since) is replaced with the last page (A9).
  // Placeholder data belongs to the previous params, so the check waits for the real response.
  if (!query.isPlaceholderData && params.page > lastPage) {
    return <Navigate to={{ search: toListSearch({ ...params, page: lastPage }) }} replace />
  }

  // An empty placeholder is the previous search's result; the empty message would name the new search too early.
  if (data.length === 0 && query.isPlaceholderData) return <LoadingState />

  if (data.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
        {params.search ? `No webhooks found for "${params.search}".` : 'No webhooks found.'}
      </Typography>
    )
  }

  return (
    <Stack spacing={2} sx={{ alignItems: 'center' }}>
      <WebhooksTable webhooks={data} listSearch={toListSearch(params)} stale={query.isPlaceholderData} />
      <Pagination count={lastPage} page={params.page} onChange={(_, page) => onPageChange(page)} color="primary" />
    </Stack>
  )
}
