import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import fs from 'fs'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

const certDir = path.resolve(__dirname, '.cert')
const keyPath = path.join(certDir, 'key.pem')
const certPath = path.join(certDir, 'cert.pem')

/** HTTPS для dev: если в .cert/ есть key.pem и cert.pem — включаем SSL (доступ по https://IP:5173 в сети). */
const httpsConfig =
  fs.existsSync(keyPath) && fs.existsSync(certPath)
    ? {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
      }
    : undefined

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.PROXY_TARGET || env.VITE_PROXY_TARGET || 'http://localhost:80'

  return {
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  assetsInclude: ['**/*.svg', '**/*.csv'],

  // Dev: HTTPS при наличии .cert/key.pem и .cert/cert.pem; host: true — доступ из LAN по https://192.168.x.x:5173
  server: {
    host: true,
    ...(httpsConfig && { https: httpsConfig }),
    proxy: {
      '/api': {
        target: proxyTarget,
        changeOrigin: true,
        ws: true,
      },
      '/media': {
        target: proxyTarget,
        changeOrigin: true,
        ws: true,
      },
      // MinIO (S3): запросы к /minio/ идут на хранилище, чтобы на HTTPS-странице не было Mixed Content
      '/minio': {
        target: env.VITE_MINIO_PROXY_TARGET || 'http://localhost:9000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/minio/, ''),
      },
    },
  },
  }
})
