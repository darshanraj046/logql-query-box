import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.loki.test.ts'],
    testTimeout: 600000,
    hookTimeout: 120000
  }
})
