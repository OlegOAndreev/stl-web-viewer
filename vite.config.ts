import type { UserConfig } from 'vite'

export default {
  // For github pages
  base: "/stl-web-viewer/",
  worker: {
    format: "es",
  },
  build: {
    chunkSizeWarningLimit: 1500,
  },
} satisfies UserConfig;
