'use client'

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/queryKeys'
import type { FiltresAnimals } from '@/types/animals-extra'

export type ValorsFiltre = {
  ubicacioId: number | null
  zonaId: number | null
  lotId: number | null
}

type FiltresAnimalsProps = {
  valors: ValorsFiltre
  onChange: (valors: ValorsFiltre) => void
}

/**
 * Desplegables de filtre en cascada: Granja → Zona → Lot.
 *
 * @param props.valors - Valors actuals dels tres filtres
 * @param props.onChange - Callback cridat en canviar qualsevol filtre
 * @returns Tres desplegables independents (Lot no depèn de Granja/Zona)
 *
 * @remarks MIGRACIÓ REACT QUERY: useQuery en comptes de
 * fetch+useEffect. Amb staleTime de 30s (configuració per defecte
 * del QueryProvider), si l'usuari obre i tanca la taula d'animals
 * diverses vegades en poc temps, els catàlegs no es tornen a
 * demanar.
 * @remarks Els filtres funcionen sobre les dades ja carregades a la
 * pàgina pare — aquest component només gestiona els valors
 * seleccionats; el filtratge real es fa a TaulaAnimals.
 */
export function FiltresAnimalsSelector({ valors, onChange }: FiltresAnimalsProps) {
  const { data: filtres = { ubicacions: [], zones: [], lots: [] } } = useQuery<FiltresAnimals>({
    queryKey: queryKeys.animals.filtres,
    queryFn: () => fetch('/api/animals/filtres').then((res) => res.json()),
  })

  const zonesFiltrades = valors.ubicacioId
    ? filtres.zones.filter((z) => z.ubicacioId === valors.ubicacioId)
    : filtres.zones

  function handleUbicacioChange(value: string) {
    const nouUbicacioId = value ? Number(value) : null
    const zonaActualValida = filtres.zones.find(
      (z) => z.id === valors.zonaId && z.ubicacioId === nouUbicacioId
    )
    onChange({
      ubicacioId: nouUbicacioId,
      zonaId: zonaActualValida ? valors.zonaId : null,
      lotId: valors.lotId,
    })
  }

  return (
    <div className="flex flex-wrap gap-2">
      <select
        value={valors.ubicacioId ?? ''}
        onChange={(e) => handleUbicacioChange(e.target.value)}
        className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
      >
        <option value="">Totes les granges</option>
        {filtres.ubicacions.map((u) => (
          <option key={u.id} value={u.id}>{u.nom}</option>
        ))}
      </select>

      <select
        value={valors.zonaId ?? ''}
        onChange={(e) =>
          onChange({ ...valors, zonaId: e.target.value ? Number(e.target.value) : null })
        }
        className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
      >
        <option value="">Totes les naus</option>
        {zonesFiltrades.map((z) => (
          <option key={z.id} value={z.id}>{z.nom}</option>
        ))}
      </select>

      <select
        value={valors.lotId ?? ''}
        onChange={(e) =>
          onChange({ ...valors, lotId: e.target.value ? Number(e.target.value) : null })
        }
        className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
      >
        <option value="">Tots els lots</option>
        {filtres.lots.map((l) => (
          <option key={l.id} value={l.id}>{l.nom}</option>
        ))}
      </select>
    </div>
  )
}
