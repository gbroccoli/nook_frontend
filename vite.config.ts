import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import fs from 'fs'

function swEnvPlugin(): Plugin {
  let env: Record<string, string> = {}
  return {
    name: 'sw-env-inject',
    configResolved(config) {
      env = loadEnv(config.mode, config.root, 'VITE_')
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url !== '/firebase-messaging-sw.js') return next()
        const swPath = path.resolve(__dirname, 'public/firebase-messaging-sw.js')
        let content = fs.readFileSync(swPath, 'utf-8')
        for (const [key, value] of Object.entries(env)) {
          content = content.replaceAll(`%${key}%`, value)
        }
        res.setHeader('Content-Type', 'application/javascript')
        res.end(content)
      })
    },
    generateBundle() {
      const swPath = path.resolve(__dirname, 'public/firebase-messaging-sw.js')
      let content = fs.readFileSync(swPath, 'utf-8')
      for (const [key, value] of Object.entries(env)) {
        content = content.replaceAll(`%${key}%`, value)
      }
      this.emitFile({ type: 'asset', fileName: 'firebase-messaging-sw.js', source: content })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), swEnvPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    allowedHosts: [
        "tuna.testenvenv.ru"
    ]
  }
})
