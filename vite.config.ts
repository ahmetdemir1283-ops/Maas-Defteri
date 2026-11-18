import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';

const offlinePrecachePlugin: Plugin = {
  name: 'mesai-offline-precache',
  apply: 'build',
  closeBundle() {
    const distDir = resolve(process.cwd(), 'dist');
    const assetsDir = resolve(distDir, 'assets');
    const assets = readdirSync(assetsDir, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => `./assets/${entry.name}`);
    const workerPath = resolve(distDir, 'sw.js');
    const worker = readFileSync(workerPath, 'utf8');
    writeFileSync(
      workerPath,
      worker.replace("'__MESAI_PRECACHE_ASSETS__'", JSON.stringify(assets)),
    );
  },
};

export default defineConfig({
  base: './',
  plugins: [react(), offlinePrecachePlugin],
  optimizeDeps: {
    entries: ['index.html'],
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
  },
});
