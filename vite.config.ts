import type { UserConfig } from 'vite'

export default {
  build: {
    chunkSizeWarningLimit: 1500
  },
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin'
    }
  }
} satisfies UserConfig
