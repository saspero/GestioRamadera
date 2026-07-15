/**
 * Factory de claus de React Query, centralitzada per mòdul.
 *
 * @remarks Evita strings màgics repetits a cada component i
 * facilita la invalidació coherent de queries relacionades des de
 * qualsevol mutació. Patró recomanat oficialment per TanStack Query.
 * @remarks Migració completada per mòduls: Animals, Lots (lliurament
 * 2), Granja/Corts, Sanitari, Logística (lliurament 3).
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
  infraestructura: {
    /** Jerarquia completa Granja → Zona → Cort. Una única query
     * (l'endpoint no admet filtres parcials), per això no hi ha
     * subclaus com als altres mòduls. */
    all: ['infraestructura'] as const,
  },
  sanitari: {
    medicaments: ['sanitari', 'medicaments'] as const,
    tractaments: ['sanitari', 'tractaments'] as const,
  },
  logistica: {
    estoc: ['logistica', 'estoc'] as const,
    catalegs: ['logistica', 'catalegs'] as const,
    sitges: ['logistica', 'sitges'] as const,
    magatzems: ['logistica', 'magatzems'] as const,
    tipusPinso: ['logistica', 'tipus-pinso'] as const,
  },
  arxiu: {
    /** Inclou els filtres a la clau perquè cada combinació de cerca/motiu/dates es cachegi per separat. */
    llistat: (cerca: string, motiu: string, dataDes: string, dataFins: string) =>
      ['arxiu', 'llistat', cerca, motiu, dataDes, dataFins] as const,
    fitxa: (id: number) => ['arxiu', 'fitxa', id] as const,
  },
  configuracio: {
    usuaris: ['configuracio', 'usuaris'] as const,
    races: ['configuracio', 'races'] as const,
    general: ['configuracio', 'general'] as const,
  },
}
