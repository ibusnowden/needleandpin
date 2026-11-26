import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// The game is served from https://ibra-niang.com/needleandpin/ (GitHub Pages, repo
// ibusnowden/ibraniang1.github.io, folder needleandpin/). Override with BASE=/ for local previews.
export default defineConfig({
  base: process.env.BASE ?? "/needleandpin/",
  plugins: [react()],
  worker: { format: "es" },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 2000,
    rollupOptions: { output: { manualChunks: (id) => (id.includes("node_modules/phaser") ? "phaser" : undefined) } },
  },
  test: {
    include: ["tests/sim/**/*.test.ts"],
    environment: "node",
    testTimeout: 120000,
  },
});
