// Copyright (c) 2025 Scott Crawford. All rights reserved.

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import os from 'os'

function getLanIP() {
  try {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family === 'IPv4' && !net.internal) {
          // Prefer private ranges
          if (/^(10\.|172\.(1[6-9]|2\d|3[0-1])\.|192\.168\.)/.test(net.address)) {
            return net.address;
          }
        }
      }
    }
  } catch {}
  return undefined;
}

const DEV_HOST = process.env.DEV_HOST || getLanIP();

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: '0.0.0.0',
    // Help mobile devices connect to the HMR websocket reliably on LAN
    hmr: DEV_HOST ? { host: DEV_HOST, protocol: 'ws', port: 3000 } : undefined,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
})
