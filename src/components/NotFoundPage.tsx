import { Container, Link, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router'

export function NotFoundPage() {
  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Page not found
      </Typography>
      <Link component={RouterLink} to="/webhooks">
        Back to webhooks
      </Link>
    </Container>
  )
}
