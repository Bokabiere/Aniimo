import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // Sous-chemin du déploiement (ex. GitHub Pages : /Aniimo/) ; '/' en local.
  base: process.env.VITE_BASE || '/',
  plugins: [
    tailwindcss(),
    react(),
  ],
})
