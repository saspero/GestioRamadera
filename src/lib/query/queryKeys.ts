/**
 * Factory de claus de React Query, centralitzada per mòdul.
 *
 * @remarks Evita strings màgics repetits a cada component
 * (`['animals']`, `['animals', cerca]`...) i facilita la invalidació
 * coherent de queries relacionades des de qualsevol mutació. Patró
 * recomanat oficialment per TanStack Query.
 * @remarks Migració progressiva: aquest fitxer creix a mesura que
 * es migren mòduls a React Query (Animals i Lots en aquest
 * lliurament; Granja/Corts, Sanitari i Logística en el següent).
 */
export const queryKeys = {
  animals: {
    all: ['animals'] as const,
    llistat: (cerca: string) => ['animals', 'llistat', cerca] as const,
    fitxa: (id: number) => ['animals', 'fitxa', id] as const,
    filtres: ['animals', 'filtres'] as const,
    catalegs: ['animals', 'catalegs'] as const,
  },
  lots: {
    all: ['lots'] as const,
    llistat: ['lots', 'llistat'] as const,
    animals: (lotId: number) => ['lots', lotId, 'animals'] as const,
  },
}
