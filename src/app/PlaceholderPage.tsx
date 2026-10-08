import { Container, Typography } from '@mui/material'

type PlaceholderPageProps = {
  title: string
}

// Temporary route content until the feature pages land.
export function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" component="h1">
        {title}
      </Typography>
    </Container>
  )
}
