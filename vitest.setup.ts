import '@testing-library/jest-dom/vitest'

/**
 * Configuració global executada abans de cada fitxer de test.
 *
 * @remarks Importa els matchers addicionals de jest-dom
 * (toBeInTheDocument, toHaveTextContent, etc.), usats als tests de
 * components amb Testing Library.
 * @remarks Variables d'entorn necessàries perquè els mòduls que
 * importen src/lib/db/client.ts (JWT_SECRET, DATABASE_URL) no
 * llencin un error en temps de mòdul durant els tests que no els
 * fan servir realment — els tests de queries reals fan servir mocks,
 * no una connexió de BD de veritat.
 */
process.env.JWT_SECRET ??= 'test-secret-nomes-per-a-tests-min-32-caracters'
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
