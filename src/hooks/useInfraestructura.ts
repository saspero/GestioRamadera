'use client'

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/queryKeys'
import type { UbicacioAmbJerarquia } from '@/types/infraestructura'

/**
 * Hook que carrega la jerarquia completa Granja → Zona → Cort.
 *
 * @returns Jerarquia carregada, estat de càrrega i error
 *
 * @remarks MIGRACIÓ REACT QUERY: aquest hook abans centralitzava
 * també les 6 mutacions (crear/actualitzar ubicació/zona/cort);
 * ara cadascuna viu al seu propi modal (ModalGranja, ModalZona,
 * ModalCort) com a useMutation pròpia que invalida
 * queryKeys.infraestructura.all — seguint el mateix patró ja
 * aplicat a Animals i Lots. Aquest hook queda reduït a la lectura.
 * @remarks Control d'accés: aquest hook no fa cap comprovació de rol.
 */
export function useInfraestructura() {
  const { data: ubicacions = [], isLoading, error } = useQuery<UbicacioAmbJerarquia[]>({
    queryKey: queryKeys.infraestructura.all,
    queryFn: () => fetch('/api/infraestructura').then((res) => res.json()).then((j) => j.ubicacions),
  })

  return {
    ubicacions,
    carregant: isLoading,
    error: error instanceof Error ? error.message : null,
  }
}
