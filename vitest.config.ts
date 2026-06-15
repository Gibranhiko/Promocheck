import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "path"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/test/**",
        "src/main.tsx",
        "src/vite-env.d.ts",
        "src/services/firebase/**",
        "src/**/*.d.ts",
        "src/app/router.tsx",
        "src/app/App.tsx",
        "src/app/index.ts",
        "src/shared/constants/**",
        "src/features/*/index.ts",
        "src/services/offline/index.ts",
        "src/pages/index.ts",
        "src/types/**",
      ],
    },
  },
})
