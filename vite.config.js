import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    host: '127.0.0.1',
    port: 5173,
    watch: {
      ignored: ['**/tools/**', '**/references/**', '**/art_pipeline/**', '**/backups/**'],
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three/examples/')) return 'vendor-three-addons';
          if (id.includes('node_modules/three/')) return 'vendor-three';
          if (id.includes('/src/fishCatalog.js') || id.includes('/src/ui/')) return 'app-ui-catalog';
        },
      },
    },
  },
});
