// @ts-check
const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "tests/frontend",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npx http-server . -a 127.0.0.1 -p 4173 --silent",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
  },
});
