import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    include: ["src/**/*.test.tsx"],
    exclude: ["node_modules", "dist"],
    environment: "jsdom",
    globals: true,
    // Setup file for test utilities (e.g., MSW, RTL config)
    setupFiles: ["src/test/setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
