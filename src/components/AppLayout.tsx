import { AppBar, Button, Toolbar, Typography } from '@mui/material'
import { Outlet } from 'react-router'
import { useLogout } from '../features/auth/useLogout.ts'
import { useMe } from '../features/auth/useMe.ts'

export function AppLayout() {
  const me = useMe()
  const logout = useLogout()

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Webhooks
          </Typography>
          {me.data && <Typography sx={{ mr: 2 }}>{me.data.name}</Typography>}
          <Button color="inherit" onClick={() => logout.mutate()} disabled={logout.isPending}>
            Log out
          </Button>
        </Toolbar>
      </AppBar>
      <Outlet />
    </>
  )
}
