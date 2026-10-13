import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import pkg from "./package.json" with { type: "json" };

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(process.env["VITE_APP_VERSION"] || pkg.version),
    __APP_COMMIT__: JSON.stringify((process.env["VITE_GIT_SHA"] ?? "unknown").slice(0, 7)),
    __APP_BUILD_TIME__: JSON.stringify(process.env["VITE_BUILD_TIME"] ?? "unknown"),
  },
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:3001",
      "/ws": { target: "ws://127.0.0.1:3001", ws: true },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false, // never ship source maps in production
  },
});
