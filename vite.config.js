import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [],
  publicDir: 'public',
  build: {
    assetsInlineLimit: 0,
  },
});
