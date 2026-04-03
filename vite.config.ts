import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  base: process.env.VITE_BASE ?? '/pv-tool/',
  plugins: [svelte()],
  build: {
    chunkSizeWarningLimit: 550,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('pixi.js')) return 'pixi';
          if (id.includes('jieba-wasm')) return 'jieba';
          if (id.includes('gsap')) return 'gsap';
          if (id.includes('jszip')) return 'jszip';
          return 'vendor';
        },
      },
    },
  },
  server: {
    allowedHosts: true,
  },
  optimizeDeps: {
    exclude: ['jieba-wasm'],
  },
});
