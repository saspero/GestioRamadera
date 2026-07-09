'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Upload, CircleCheckBig } from 'lucide-react'
import { useAltaMassiva } from '@/hooks/useAltaMassiva'

type Catalegs = {
  races: { id: number; nomRaca: string }[]
  lots: { id: number; nomLot: string }[]
  corts: { id: number; codiCort: string; nomZona: string }[]
}

type ModalAltaMassivaProps = {
  onTancar: () => void
  onImportacioCompletada: () => void
}

const ESTAT_ESTIL: Record<string, string> = {
  valida: 'bg-white',
  duplicat_intern: 'bg-red-50',
  duplicat_bd: 'bg-amber-50',
  error: 'bg-amber-50',
}

const ESTAT_ETIQUETA: Record<string, string> = {
  valida: '',
  duplicat_intern: 'Duplicat al fitxer',
  duplicat_bd: 'Ja existeix a la BD',
  error: 'Error de format',
}

/**
 * Modal del flux complet d'alta massiva d'animals per fitxer CSV.
 *
 * Flux (docs/08_modul_llistat_actius.md, secció 4.3):
 *   1. Pujar fitxer CSV
 *   2. Previsualització amb validació i detecció de duplicats
 *   3. Assignació base (raça, lot, cort) + confirmació
 *
 * @param props.onTancar - Callback per tancar el modal sense confirmar
 * @param props.onImportacioCompletada - Callback en confirmar amb èxit,
 * perquè la pàgina pare recarregui el llistat
 * @returns Modal amb els tres passos del flux
 *
 * @remarks Control d'accés: aquest component només es munta des de la
 * pàgina d'animals quan ctx.rol === 'Admin' (comprovat al pare). Els
 * endpoints cridats (comprovar-duplicats, bulk-import) tornen a
 * validar el rol igualment — defensa en profunditat.
 * @remarks Multitenancy: no toca la BD directament; tota la lectura
 * i escriptura passa pels endpoints, que apliquen el search_path
 * del tenant de la sessió.
 */
export function ModalAltaMassiva({ onTancar, onImportacioCompletada }: ModalAltaMassivaProps) {
  const {
    files,
    estat,
    errorGeneral,
    resultat,
    processarFitxer,
    alternarOmesa,
    confirmarImportacio,
    reiniciar,
  } = useAltaMassiva()

  const [catalegs, setCatalegs] = useState<Catalegs | null>(null)
  const [racaId, setRacaId] = useState<number | ''>('')
  const [lotMode, setLotMode] = useState<'existent' | 'nou'>('existent')
  const [lotId, setLotId] = useState<number | ''>('')
  const [lotNouNom, setLotNouNom] = useState('')
  const [cortId, setCortId] = useState<number | ''>('')
  const inputFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/animals/catalegs')
      .then((res) => res.json())
      .then(setCatalegs)
      .catch(() => setCatalegs({ races: [], lots: [], corts: [] }))
  }, [])

  const filesValides = files.filter((f) => f.estat === 'valida' && !f.omesa)
  const teFilesBloquejades = files.some((f) => f.estat === 'duplicat_intern' || f.estat === 'error')

  function handleFitxerSeleccionat(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processarFitxer(file)
  }

  function handleConfirmar() {
    if (racaId === '' || cortId === '') return
    confirmarImportacio({
      racaId: Number(racaId),
      lotId: lotMode === 'existent' && lotId !== '' ? Number(lotId) : null,
      lotNouNom: lotMode === 'nou' && lotNouNom.trim() ? lotNouNom.trim() : null,
      cortId: Number(cortId),
    })
  }

  const potConfirmar =
    filesValides.length > 0 &&
    !teFilesBloquejades &&
    racaId !== '' &&
    cortId !== '' &&
    (lotMode === 'existent' ? lotId !== '' : lotNouNom.trim().length > 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Alta massiva d&apos;animals</h2>
          <button
            onClick={onTancar}
            className="p-2 -mr-2 rounded-lg hover:bg-gray-100 min-h-[44px] min-w-[44px]"
            aria-label="Tancar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {estat === 'completat' && resultat ? (
            <div className="text-center py-8">
              <CircleCheckBig size={48} className="mx-auto text-green-600 mb-3" />
              <p className="text-lg font-semibold text-gray-900">
                {resultat.nombreCreats} animals importats correctament
              </p>
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-10">
              <Upload size={40} className="mx-auto text-gray-400 mb-3" />
              <p className="text-gray-600 mb-4">
                Puja un fitxer CSV amb les columnes: crotal_id, dib, data_naixement, sexe
              </p>
              <input
                ref={inputFileRef}
                type="file"
                accept=".csv"
                onChange={handleFitxerSeleccionat}
                className="hidden"
              />
              <button
                onClick={() => inputFileRef.current?.click()}
                className="px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white
                           font-medium rounded-lg min-h-[44px]"
              >
                Seleccionar fitxer CSV
              </button>
              {(estat === 'parsejant' || estat === 'comprovant') && (
                <p className="text-sm text-gray-500 mt-3">Processant...</p>
              )}
              {errorGeneral && (
                <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2 mt-4 inline-block">
                  {errorGeneral}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              {/* Previsualització */}
              <div>
                <h3 className="font-medium text-gray-900 mb-2">
                  Previsualització ({files.length} files)
                </h3>
                <div className="overflow-x-auto border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-50">
                      <tr className="text-left text-gray-500">
                        <th className="px-3 py-2 font-medium"></th>
                        <th className="px-3 py-2 font-medium">Crotal</th>
                        <th className="px-3 py-2 font-medium">DIB</th>
                        <th className="px-3 py-2 font-medium">Naixement</th>
                        <th className="px-3 py-2 font-medium">Sexe</th>
                        <th className="px-3 py-2 font-medium">Estat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {files.map((f) => (
                        <tr key={f.fila} className={`border-t border-gray-100 ${ESTAT_ESTIL[f.estat]}`}>
                          <td className="px-3 py-1.5">
                            {f.estat === 'duplicat_bd' && (
                              <input
                                type="checkbox"
                                checked={!f.omesa}
                                onChange={() => alternarOmesa(f.fila)}
                                aria-label={`Incloure fila ${f.fila}`}
                              />
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-gray-900">{f.dades.crotal_id}</td>
                          <td className="px-3 py-1.5 text-gray-600">{f.dades.dib || '—'}</td>
                          <td className="px-3 py-1.5 text-gray-600">{f.dades.data_naixement || '—'}</td>
                          <td className="px-3 py-1.5 text-gray-600">{f.dades.sexe || '—'}</td>
                          <td className="px-3 py-1.5 text-xs text-gray-600">
                            {ESTAT_ETIQUETA[f.estat]}
                            {f.errors.length > 0 && f.estat === 'error' && (
                              <span className="block text-red-600">{f.errors[0]}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {teFilesBloquejades && (
                  <p className="text-sm text-amber-700 mt-2">
                    Hi ha files amb errors o duplicats interns. Corregeix el fitxer i torna&apos;l a pujar.
                  </p>
                )}
              </div>

              {/* Assignació base */}
              {!teFilesBloquejades && (
                <div className="border-t border-gray-100 pt-4 space-y-3">
                  <h3 className="font-medium text-gray-900">
                    Assignació base ({filesValides.length} animals)
                  </h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Raça</label>
                    <select
                      value={racaId}
                      onChange={(e) => setRacaId(e.target.value ? Number(e.target.value) : '')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
                    >
                      <option value="">Selecciona una raça</option>
                      {catalegs?.races.map((r) => (
                        <option key={r.id} value={r.id}>{r.nomRaca}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Lot</label>
                    <div className="flex gap-2 mb-2">
                      <button
                        type="button"
                        onClick={() => setLotMode('existent')}
                        className={`px-3 py-1.5 rounded-lg text-sm ${lotMode === 'existent' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                      >
                        Lot existent
                      </button>
                      <button
                        type="button"
                        onClick={() => setLotMode('nou')}
                        className={`px-3 py-1.5 rounded-lg text-sm ${lotMode === 'nou' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                      >
                        Lot nou
                      </button>
                    </div>
                    {lotMode === 'existent' ? (
                      <select
                        value={lotId}
                        onChange={(e) => setLotId(e.target.value ? Number(e.target.value) : '')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
                      >
                        <option value="">Selecciona un lot</option>
                        {catalegs?.lots.map((l) => (
                          <option key={l.id} value={l.id}>{l.nomLot}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={lotNouNom}
                        onChange={(e) => setLotNouNom(e.target.value)}
                        placeholder="Nom del lot nou"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cort / Nau de destí</label>
                    <select
                      value={cortId}
                      onChange={(e) => setCortId(e.target.value ? Number(e.target.value) : '')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
                    >
                      <option value="">Selecciona una cort</option>
                      {catalegs?.corts.map((c) => (
                        <option key={c.id} value={c.id}>{c.nomZona} — {c.codiCort}</option>
                      ))}
                    </select>
                  </div>

                  {errorGeneral && (
                    <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">
                      {errorGeneral}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
          {estat === 'completat' ? (
            <button
              onClick={onImportacioCompletada}
              className="px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white
                         font-medium rounded-lg min-h-[44px]"
            >
              Tancar i actualitzar llistat
            </button>
          ) : (
            <>
              {files.length > 0 && (
                <button
                  onClick={reiniciar}
                  className="px-4 py-2.5 text-gray-700 hover:bg-gray-100 font-medium rounded-lg min-h-[44px]"
                >
                  Tornar a començar
                </button>
              )}
              <button
                onClick={onTancar}
                className="px-4 py-2.5 text-gray-700 hover:bg-gray-100 font-medium rounded-lg min-h-[44px]"
              >
                Cancel·lar
              </button>
              {files.length > 0 && !teFilesBloquejades && (
                <button
                  onClick={handleConfirmar}
                  disabled={!potConfirmar || estat === 'confirmant'}
                  className="px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white
                             font-medium rounded-lg min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {estat === 'confirmant' ? 'Important...' : 'Confirmar alta'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
