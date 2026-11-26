import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";

// Uses a system Chromium when present (CHROMIUM_PATH, or /usr/bin/chromium); otherwise Playwright's own
// browser (`npx playwright install chromium`).
const systemChromium = process.env.CHROMIUM_PATH ?? (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);

export default defineConfig({
  testDir: "tests/ui",
  timeout: 60_000,
  use: {
    baseURL: "http://[::1]:4174/",
    viewport: { width: 1440, height: 900 },
    launchOptions: { executablePath: systemChromium, args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] },
  },
  webServer: {
    command: "BASE=/ npx vite build && BASE=/ npx vite preview --port 4174 --strictPort",
    url: "http://[::1]:4174/",
    timeout: 120_000,
    reuseExistingServer: false,
  },
});
