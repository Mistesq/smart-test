import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation } from 'react-router'
import { applyFormError } from '../../lib/formErrors.ts'
import { acknowledgeLogout, useAuthState } from './authStore.ts'
import { LOGIN_FIELDS, loginSchema, type LoginFormValues } from './loginSchema.ts'
import { getRedirectTarget } from './redirect.ts'
import { useLogin } from './useLogin.ts'

export function LoginPage() {
  const auth = useAuthState()
  const location = useLocation()
  const loginMutation = useLogin()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  useEffect(() => {
    acknowledgeLogout()
  }, [])

  // Covers both a successful sign-in and opening /login while already signed in.
  if (auth.status === 'authenticated') return <Navigate to={getRedirectTarget(location.state)} replace />

  const sessionExpired = auth.reason === 'expired'
  const onSubmit = handleSubmit((values) => {
    loginMutation.mutate(values, { onError: (error) => applyFormError(error, LOGIN_FIELDS, setError) })
  })
  const { ref: emailRef, ...emailField } = register('email')
  const { ref: passwordRef, ...passwordField } = register('password')

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2 }}>
      <Paper component="form" onSubmit={onSubmit} noValidate sx={{ p: 4, width: '100%', maxWidth: 400 }}>
        <Stack spacing={2}>
          <Typography variant="h5" component="h1">
            Sign in
          </Typography>
          {sessionExpired && <Alert severity="info">Your session has expired. Please sign in again.</Alert>}
          {errors.root?.serverError && <Alert severity="error">{errors.root.serverError.message}</Alert>}
          <TextField
            {...emailField}
            inputRef={emailRef}
            label="Email"
            type="email"
            autoComplete="email"
            error={Boolean(errors.email)}
            helperText={errors.email?.message}
            fullWidth
          />
          <TextField
            {...passwordField}
            inputRef={passwordRef}
            label="Password"
            type="password"
            autoComplete="current-password"
            error={Boolean(errors.password)}
            helperText={errors.password?.message}
            fullWidth
          />
          <Button type="submit" variant="contained" disabled={loginMutation.isPending}>
            Sign in
          </Button>
        </Stack>
      </Paper>
    </Box>
  )
}
