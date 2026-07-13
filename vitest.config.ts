import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

/**
 * Configuració de Vitest per al projecte.
 *
 * @remarks entorn jsdom: necessari per als tests de components React
 * (Modal, hooks) que interactuen amb el DOM. Els tests de lògica
 * pura de backend (queries, càlculs) no el necessiten però no els
 * perjudica tenir-lo actiu igualment.
 * @remarks tsconfigPaths: permet fer servir els mateixos àlies
 * `@/...` que ja s'usen a tot el projecte Next.js, sense haver de
 * duplicar la configuració de resolució de mòduls.
 */
export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    exclude: ['node_modules', '.next', 'e2e'],
  },
})
