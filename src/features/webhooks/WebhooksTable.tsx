import { Chip, Link, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material'
import { Link as RouterLink } from 'react-router'
import type { Webhook } from '../../api/webhooks.ts'
import type { ListLinkState } from './listParams.ts'

type WebhooksTableProps = {
  webhooks: Webhook[]
  // Current list search string ('' or '?…'), handed to the edit page so it can return here.
  listSearch: string
  // True while the rows belong to the previous page or search and the new ones are loading.
  stale: boolean
}

export function WebhooksTable({ webhooks, listSearch, stale }: WebhooksTableProps) {
  const linkState: ListLinkState = { listSearch }

  return (
    <TableContainer component={Paper} sx={{ opacity: stale ? 0.6 : 1, transition: 'opacity 150ms' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>URL</TableCell>
            <TableCell>Active</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {webhooks.map((webhook) => (
            <TableRow key={webhook.id} hover>
              <TableCell>
                <Link component={RouterLink} to={`/webhooks/${webhook.id}/edit`} state={linkState}>
                  {webhook.name}
                </Link>
              </TableCell>
              <TableCell sx={{ wordBreak: 'break-all' }}>{webhook.url}</TableCell>
              <TableCell>
                <Chip
                  size="small"
                  label={webhook.active ? 'Active' : 'Inactive'}
                  color={webhook.active ? 'success' : 'default'}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
