'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2, Warehouse, Layers, Grid2x2 } from 'lucide-react'
import type { UbicacioAmbJerarquia, ZonaInfraestructura, Cort, TipusZona } from '@/types/infraestructura'

const ETIQUETES_TIPUS: Record<TipusZona, string> = {
  NAU_ANIMALS: 'Nau d\'animals',
  COBERT_EMMAGATZEMATGE: 'Cobert d\'emmagatzematge',
  PASTURA: 'Pastura',
}

type ArbreInfraestructuraProps = {
  ubicacions: UbicacioAmbJerarquia[]
  /** Si false (rol Treballador), s'amaguen tots els botons de creació/edició/eliminació. */
  potEditar: boolean
  onEditarGranja: (id: number) => void
  onEliminarGranja: (ubicacio: { id: number; nom: string }) => void
  onNovaZona: (ubicacioId: number) => void
  onEditarZona: (zona: ZonaInfraestructura) => void
  onEliminarZona: (zona: ZonaInfraestructura) => void
  onNovaCort: (zonaId: number) => void
  onEditarCort: (cort: Cort) => void
  onEliminarCort: (cort: Cort) => void
}

/**
 * Arbre jeràrquic Granja → Zona → Cort, amb expansió/col·lapse i
 * accions d'edició/creació a cada nivell.
 *
 * @param props.ubicacions - Jerarquia completa ja carregada
 * @param props.onEditarGranja - Callback per obrir el modal d'edició d'una granja
 * @param props.onEliminarGranja - Callback per eliminar una granja (bloquejada si té zones)
 * @param props.onNovaZona - Callback per obrir el modal de creació de zona
 * @param props.onEditarZona - Callback per obrir el modal d'edició d'una zona
 * @param props.onEliminarZona - Callback per eliminar una zona (bloquejada si té corts)
 * @param props.onNovaCort - Callback per obrir el modal de creació de cort
 * @param props.onEditarCort - Callback per obrir el modal d'edició d'una cort
 * @param props.onEliminarCort - Callback per eliminar una cort (bloquejada si té animals)
 * @returns Arbre expansible amb icones per tipus de zona
 *
 * @remarks Eliminació afegida juliol 2026 als tres nivells —
 * bloquejada si el nivell corresponent no està buit (missatge clar
 * retornat per l'endpoint en cada cas).
 * @remarks Comptadors d'animals (juliol 2026): cada nivell mostra
 * "(N)" al costat del nom, ja calculat pel backend
 * (getJerarquiaCompleta, src/lib/db/queries/infraestructura.ts).
 * @remarks Aquest component és de només presentació — tota la lògica
 * de mutació (crides al backend) viu al hook useInfraestructura,
 * cridat des de la pàgina pare.
 */
export function ArbreInfraestructura({
  ubicacions,
  potEditar,
  onEditarGranja,
  onEliminarGranja,
  onNovaZona,
  onEditarZona,
  onEliminarZona,
  onNovaCort,
  onEditarCort,
  onEliminarCort,
}: ArbreInfraestructuraProps) {
  const [granjaExpandida, setGranjaExpandida] = useState<Set<number>>(new Set())
  const [zonaExpandida, setZonaExpandida] = useState<Set<number>>(new Set())

  function toggleGranja(id: number) {
    setGranjaExpandida((prev) => {
      const nou = new Set(prev)
      nou.has(id) ? nou.delete(id) : nou.add(id)
      return nou
    })
  }

  function toggleZona(id: number) {
    setZonaExpandida((prev) => {
      const nou = new Set(prev)
      nou.has(id) ? nou.delete(id) : nou.add(id)
      return nou
    })
  }

  if (ubicacions.length === 0) {
    return (
      <div className="text-center py-10 text-gray-500">
        Encara no hi ha cap granja donada d&apos;alta.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {ubicacions.map((ubicacio) => {
        const obertaGranja = granjaExpandida.has(ubicacio.id)
        return (
          <div key={ubicacio.id} className="bg-white rounded-lg border border-gray-200">
            {/* Nivell 1: Granja */}
            <div className="flex items-center gap-2 px-3 py-3">
              <button
                onClick={() => toggleGranja(ubicacio.id)}
                className="p-1 rounded hover:bg-gray-100 min-h-[36px] min-w-[36px]"
                aria-label={obertaGranja ? 'Col·lapsar' : 'Expandir'}
              >
                {obertaGranja ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              </button>
              <Warehouse size={18} className="text-gray-500 shrink-0" aria-hidden="true" />
              <span className="font-semibold text-gray-900 flex-1">
                {ubicacio.nom}
                <span className="font-normal text-gray-400 text-sm"> ({ubicacio.nombreAnimals})</span>
              </span>
              {potEditar && (
                <>
                  <button
                    onClick={() => onEditarGranja(ubicacio.id)}
                    className="p-2 rounded-lg hover:bg-gray-100 min-h-[36px] min-w-[36px]"
                    aria-label="Editar granja"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => onEliminarGranja({ id: ubicacio.id, nom: ubicacio.nom })}
                    className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-100 min-h-[36px] min-w-[36px]"
                    aria-label="Eliminar granja"
                  >
                    <Trash2 size={16} />
                  </button>
                  <button
                    onClick={() => onNovaZona(ubicacio.id)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-sm bg-gray-100 hover:bg-gray-200
                               text-gray-700 font-medium rounded-lg min-h-[36px]"
                  >
                    <Plus size={14} aria-hidden="true" />
                    Zona
                  </button>
                </>
              )}
            </div>

            {/* Nivell 2: Zones */}
            {obertaGranja && (
              <div className="pl-8 pb-2 space-y-1">
                {ubicacio.zones.length === 0 && (
                  <p className="text-sm text-gray-400 py-2">Cap zona donada d&apos;alta en aquesta granja.</p>
                )}
                {ubicacio.zones.map((zona) => {
                  const obertaZona = zonaExpandida.has(zona.id)
                  return (
                    <div key={zona.id} className="border-l-2 border-gray-100 pl-3">
                      <div className="flex items-center gap-2 py-2">
                        <button
                          onClick={() => toggleZona(zona.id)}
                          className="p-1 rounded hover:bg-gray-100 min-h-[36px] min-w-[36px]"
                          aria-label={obertaZona ? 'Col·lapsar' : 'Expandir'}
                        >
                          {obertaZona ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                        <Layers size={16} className="text-gray-400 shrink-0" aria-hidden="true" />
                        <span className="text-gray-800 flex-1">
                          {zona.nom}
                          <span className="text-gray-400 text-sm"> ({zona.nombreAnimals})</span>
                        </span>
                        <span className="text-xs text-gray-400">{ETIQUETES_TIPUS[zona.tipusZona]}</span>
                        {potEditar && (
                          <>
                            <button
                              onClick={() => onEditarZona(zona)}
                              className="p-2 rounded-lg hover:bg-gray-100 min-h-[36px] min-w-[36px]"
                              aria-label="Editar zona"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => onEliminarZona(zona)}
                              className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-100 min-h-[36px] min-w-[36px]"
                              aria-label="Eliminar zona"
                            >
                              <Trash2 size={14} />
                            </button>
                            {zona.tipusZona === 'NAU_ANIMALS' && (
                              <button
                                onClick={() => onNovaCort(zona.id)}
                                className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200
                                           text-gray-700 font-medium rounded-lg min-h-[32px]"
                              >
                                <Plus size={12} aria-hidden="true" />
                                Cort
                              </button>
                            )}
                          </>
                        )}
                      </div>

                      {/* Nivell 3: Corts */}
                      {obertaZona && zona.tipusZona === 'NAU_ANIMALS' && (
                        <div className="pl-8 pb-2 space-y-1">
                          {zona.corts.length === 0 && (
                            <p className="text-sm text-gray-400 py-1">Cap cort donada d&apos;alta en aquesta zona.</p>
                          )}
                          {zona.corts.map((cort) => (
                            <div
                              key={cort.id}
                              className="flex items-center gap-2 py-1.5 border-l-2 border-gray-50 pl-3"
                            >
                              <Grid2x2 size={14} className="text-gray-400 shrink-0" aria-hidden="true" />
                              <span className="text-sm text-gray-700 flex-1">
                                {cort.codiCort}
                                <span className="text-gray-400"> ({cort.nombreAnimals})</span>
                              </span>
                              {cort.capacitatMaxima != null && (
                                <span className="text-xs text-gray-400">
                                  Capacitat: {cort.capacitatMaxima}
                                </span>
                              )}
                              {potEditar && (
                                <>
                                  <button
                                    onClick={() => onEditarCort(cort)}
                                    className="p-1.5 rounded-lg hover:bg-gray-100 min-h-[32px] min-w-[32px]"
                                    aria-label="Editar cort"
                                  >
                                    <Pencil size={12} />
                                  </button>
                                  <button
                                    onClick={() => onEliminarCort(cort)}
                                    className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-100 min-h-[32px] min-w-[32px]"
                                    aria-label="Eliminar cort"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
