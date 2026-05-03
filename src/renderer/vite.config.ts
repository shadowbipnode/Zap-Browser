// src/renderer/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  base: './',
  build: {
    outDir: path.join(__dirname, '../../dist'),
    emptyOutDir: true,
  },
  server: { port: 3000 },
})
