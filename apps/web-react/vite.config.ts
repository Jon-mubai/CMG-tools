import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { createReadStream, existsSync } from 'fs';

const vendorDir = resolve(__dirname, '../web/vendor');

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'serve-legacy-vendor',
      configureServer(server) {
        server.middlewares.use('/vendor', (req, res, next) => {
          const file = resolve(vendorDir, (req.url || '').replace(/^\//, '').split('?')[0]);
          if (!file.startsWith(vendorDir) || !existsSync(file)) return next();
          if (file.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript');
          else if (file.endsWith('.json')) res.setHeader('Content-Type', 'application/json');
          createReadStream(file).pipe(res);
        });
      },
    },
  ],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  server: {
    port: 5174,
    fs: { allow: [resolve(__dirname, '..')] },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
  preview: { port: 5174 },
});
