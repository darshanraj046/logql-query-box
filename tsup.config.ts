import { copyFileSync } from 'node:fs'
import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: { core: 'src/core/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    sourcemap: true,
    target: 'es2020'
  },
  {
    entry: { index: 'src/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    target: 'es2020',
    external: ['react', 'react-dom'],
    banner: { js: '"use client";' },
    esbuildPlugins: [
      {
        name: 'share-core',
        setup(build) {
          const shared = build.initialOptions.format === 'cjs' ? './core.cjs' : './core.js'
          build.onResolve({ filter: /^\.\.?\/core$/ }, () => ({ path: shared, external: true }))
        }
      }
    ],
    onSuccess: async () => copyFileSync('src/styles.css', 'dist/styles.css')
  }
])
