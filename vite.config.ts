import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' makes the build work on GitHub Pages (or any sub-folder host).
export default defineConfig({
  plugins: [react()],
  base: './',
});
