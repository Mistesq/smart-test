import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Box, Button, CircularProgress, Container, Link, Paper, Stack, TextField, Typography } from '@mui/material'
import { useForm } from 'react-hook-form'
import { Link as RouterLink, useLocation, useNavigate, useParams } from 'react-router'
import { getErrorMessage, isApiError } from '../../api/errors.ts'
import type { Webhook } from '../../api/webhooks.ts'
import { applyFormError } from '../../lib/formErrors.ts'
import { getListReturnTarget } from './listParams.ts'
import { useUpdateWebhook } from './useUpdateWebhook.ts'
import { useWebhook } from './useWebhook.ts'
import { parseWebhookId, WEBHOOK_FIELDS, webhookFormSchema, type WebhookFormValues } from './webhookFormSchema.ts'

export function WebhookEditPage() {
  const { id: idParam } = useParams()
  const location = useLocation()
  const id = parseWebhookId(idParam)
  const returnTo = getListReturnTarget(location.state)

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      {/* An id that cannot exist is not found without asking the server. */}
      {id === null ? <WebhookNotFound returnTo={returnTo} /> : <WebhookEditor id={id} returnTo={returnTo} />}
    </Container>
  )
}

type ReturnProps = {
  // The list URL with its original page and search, or the plain list.
  returnTo: string
}

function WebhookNotFound({ returnTo }: ReturnProps) {
  return (
    <Stack spacing={2}>
      <Typography variant="h4" component="h1">
        Webhook not found
      </Typography>
      <Link component={RouterLink} to={returnTo}>
        Back to webhooks
      </Link>
    </Stack>
  )
}

function WebhookEditor({ id, returnTo }: ReturnProps & { id: number }) {
  const query = useWebhook(id)

  // Loaded data wins over a later refetch error, so a failed background refetch never drops the user's edits.
  if (query.data) return <WebhookForm key={query.data.id} webhook={query.data} returnTo={returnTo} />

  if (query.isPending) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress aria-label="Loading webhook" />
      </Box>
    )
  }

  if (isApiError(query.error) && query.error.status === 404) return <WebhookNotFound returnTo={returnTo} />

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

function WebhookForm({ webhook, returnTo }: ReturnProps & { webhook: Webhook }) {
  const navigate = useNavigate()
  const updateMutation = useUpdateWebhook(webhook.id)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm<WebhookFormValues>({
    resolver: zodResolver(webhookFormSchema),
    defaultValues: { name: webhook.name, url: webhook.url },
  })

  // The resolver hands over the parsed values, so the trimmed name and URL are what gets sent.
  // Save and Cancel replace the form's history entry, so Back from the list does not reopen the form.
  const onSubmit = handleSubmit((values) => {
    updateMutation.mutate(values, {
      onSuccess: () => void navigate(returnTo, { replace: true }),
      onError: (error) => applyFormError(error, WEBHOOK_FIELDS, setError),
    })
  })
  const { ref: nameRef, ...nameField } = register('name')
  const { ref: urlRef, ...urlField } = register('url')

  return (
    <Paper component="form" onSubmit={onSubmit} noValidate sx={{ p: 4 }}>
      <Stack spacing={2}>
        <Typography variant="h5" component="h1">
          Edit webhook
        </Typography>
        {errors.root?.serverError && <Alert severity="error">{errors.root.serverError.message}</Alert>}
        <TextField
          {...nameField}
          inputRef={nameRef}
          label="Name"
          error={Boolean(errors.name)}
          helperText={errors.name?.message}
          fullWidth
        />
        <TextField
          {...urlField}
          inputRef={urlRef}
          label="URL"
          type="url"
          error={Boolean(errors.url)}
          helperText={errors.url?.message}
          fullWidth
        />
        <Stack direction="row" spacing={2} sx={{ justifyContent: 'flex-end' }}>
          <Button component={RouterLink} to={returnTo} replace disabled={updateMutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={!isDirty || updateMutation.isPending}>
            Save
          </Button>
        </Stack>
      </Stack>
    </Paper>
  )
}
