import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  // The Python engine (uvicorn solcall.api:app) serves /api on :8000
  server: { proxy: { "/api": "http://localhost:8000" } },
})
