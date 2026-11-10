import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function renameDistHtmlPlugin(customName = 'MTOwizard.html') {
  return {
    name: 'rename-dist-html',
    enforce: 'post',
    closeBundle() {
      const distDir = path.resolve(__dirname, 'dist');
      const oldFile = path.join(distDir, 'index.html');
      const newFile = path.join(distDir, customName);
      if (fs.existsSync(oldFile)) {
        fs.renameSync(oldFile, newFile);
        console.log(`[vite] Successfully created dist/${customName}`);
      }
    },
  };
}

export default defineConfig({
  base: './',
  publicDir: false,
  plugins: [
    react(),
    viteSingleFile(),
    renameDistHtmlPlugin('MTOwizard.html'),
  ],
  define: {
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
