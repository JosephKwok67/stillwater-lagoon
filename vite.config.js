import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5173,
    watch: {
      ignored: ['**/tools/**', '**/references/**', '**/art_pipeline/**', '**/backups/**'],
    },
  },
});
