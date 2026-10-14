import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
 root: fileURLToPath(new URL('./academy-app', import.meta.url)),
 publicDir: fileURLToPath(new URL('./public', import.meta.url)),
 plugins: [react(), tailwindcss()],
 resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
 build: { outDir: fileURLToPath(new URL('./dist-academia', import.meta.url)), emptyOutDir: true },
})
