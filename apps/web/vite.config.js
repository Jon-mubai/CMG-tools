import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: resolve(__dirname),
  publicDir: false,
  // 第三方 min 文件无 .map，关闭开发态 sourcemap 噪音
  css: { devSourcemap: false },
  server: {
    port: 8080,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        // 后端未启动时避免刷屏；前端仍可走本地 vault
        configure: (proxy) => {
          proxy.on('error', () => {
            /* ECONNREFUSED：请先 npm run start:dev（apps/api） */
          });
        },
      },
    },
  },
  preview: {
    port: 8080,
    proxy: {
      '/api': { target: 'http://127.0.0.1:3001', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
    },
  },
});
