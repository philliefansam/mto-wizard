import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

const pcUsername = process.env.USERNAME || process.env.USER || '';

export default defineConfig({
  base: './',
  publicDir: false,
  plugins: [
    react(),
    viteSingleFile(),
  ],
  define: {
    '__PC_USERNAME__': JSON.stringify(pcUsername),
    'process.env': {},
    'global': 'window',
  },
  resolve: {
    alias: {
      stream: 'stream-browserify',
      events: 'events',
      buffer: 'buffer',
      process: 'process/browser',
    },
  },
  build: {
    target: 'esnext',
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 100000000,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
