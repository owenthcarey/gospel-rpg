import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    watch: {
      // Browser evidence and the isolated compatibility build must not reset a live journey.
      ignored: [
        '**/test-results/**',
        '**/test-results-compat/**',
        '**/playwright-report/**',
        '**/.compat-dist/**',
      ],
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@babylonjs')) return 'engine';
        },
      },
    },
  },
});
