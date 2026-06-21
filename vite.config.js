/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,ts}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      // Coverage is measured on the pure-logic core (parsers, metrics,
      // legibility layer, runtime store) — the deterministic code the tests
      // actually pin. UI/3D/render layers are intentionally excluded.
      include: ['src/lib/**/*.ts'],
    },
  },
})
