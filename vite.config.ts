import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  // Relative asset paths, so the build works at any GitHub Pages sub-path.
  base: "./",
  plugins: [react()],
})
