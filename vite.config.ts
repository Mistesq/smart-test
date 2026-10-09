import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Vendor chunks hold only modules loaded at startup ('$initial'), so MSW, which main.tsx imports
// dynamically, stays in the mocks chunk instead of being pulled into the startup vendor chunk.
const VENDOR_CHUNK_GROUPS = [
  { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/, priority: 30 },
  { name: 'mui', test: /node_modules[\\/](@mui|@emotion)[\\/]/, priority: 20 },
  { name: 'vendor', test: /node_modules[\\/]/, priority: 10 },
].map((group) => ({ ...group, tags: ['$initial' as const] }))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: { groups: VENDOR_CHUNK_GROUPS },
      },
    },
  },
})
