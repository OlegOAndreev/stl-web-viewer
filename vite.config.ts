import type { UserConfig } from 'vite'

export default {
  // For github pages
  base: '/stl-web-viewer/',
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      input: {
        app: './index.html',
        'coi-serviceworker': './node_modules/coi-serviceworker/coi-serviceworker.min.js',
      },
      output: {
        entryFileNames: assetInfo => {
          return assetInfo.name === 'coi-serviceworker'
            ? 'coi-serviceworker.min.js'
            : 'assets/js/[name]-[hash].js'
        }
      },
    }
  },
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin'
    }
  }
} satisfies UserConfig
