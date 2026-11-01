import { copyFileSync } from 'node:fs'
import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    sourcemap: true,
    target: 'es2020',
    external: ['react', 'react-dom'],
    banner: { js: '"use client";' },
    onSuccess: async () => copyFileSync('src/styles.css', 'dist/styles.css')
  },
  {
    entry: { core: 'src/core/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    target: 'es2020'
  }
])
