import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // GitHub Pages serves the site from https://mubaaraka.github.io/Love/,
  // so every built asset URL must start with the repository name.
  base: '/Love/',
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1000,
  },
});
