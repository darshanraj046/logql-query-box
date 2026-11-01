import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['test/**/*.test.{ts,tsx}'],
    exclude: ['test/**/*.loki.test.ts', 'node_modules/**'],
    setupFiles: ['test/setup.ts'],
    testTimeout: 60000
  }
})
