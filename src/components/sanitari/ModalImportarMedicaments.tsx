'use client'

import { useRef } from 'react'
import { X, Upload, CircleCheckBig } from 'lucide-react'
import { useImportarMedicaments } from '@/hooks/useImportarMedicaments'

type ModalImportarMedicamentsProps = {
  onTancar: () => void
  onImportacioCompletada: () => void
}

const ESTAT_ESTIL: Record<string, string> = {
  valida: 'bg-white',
  duplicat_intern: 'bg-red-50',
  duplicat_bd: 'bg-blue-50',
  error: 'bg-amber-50',
}

const ESTAT_ETIQUETA: Record<string, string> = {
  valida: '',
  duplicat_intern: 'Duplicat al fitxer',
  duplicat_bd: 'S\'actualitzarà l\'estoc',
  error: 'Error de format',
}

/**
 * Modal del flux d'importació massiva de medicaments per CSV.
 *
 * Flux (docs/06_modul_sanitari.md, secció 3.3, ampliat):
 *   1. Pujar fitxer CSV
 *   2. Previsualització amb validació i detecció de duplicats
 *   3. Confirmació (els duplicats actualitzen l'estoc automàticament)
 *
 * @param props.onTancar - Callback per tancar sense confirmar
 * @param props.onImportacioCompletada - Callback en confirmar amb èxit
 * @returns Modal amb els passos del flux d'importació
 *
 * @remarks A diferència de l'alta massiva d'animals, aquí NO hi ha
 * pas d'assignació base — cada fila del CSV ja porta totes les
 * dades necessàries del medicament.
 * @remarks Control d'accés: només es munta des de la pàgina de
 * Sanitari quan rol === 'Admin' || 'Veterinari'.
 */
export function ModalImportarMedicaments({
  onTancar,
  onImportacioCompletada,
}: ModalImportarMedicamentsProps) {
  const { files, estat, errorGeneral, resultat, processarFitxer, confirmarImportacio, reiniciar } =
    useImportarMedicaments()
  const inputFileRef = useRef<HTMLInputElement>(null)

  const teFilesBloquejades = files.some((f) => f.estat === 'duplicat_intern' || f.estat === 'error')
  const filesImportables = files.filter((f) => f.estat === 'valida' || f.estat === 'duplicat_bd')

  function handleFitxerSeleccionat(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processarFitxer(file)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Carregar CSV de fàrmacs</h2>
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
                {resultat.nombreCreats} medicaments nous, {resultat.nombreActualitzats} amb estoc actualitzat
              </p>
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-10">
              <Upload size={40} className="mx-auto text-gray-400 mb-3" />
              <p className="text-gray-600 mb-4">
                Puja un fitxer CSV amb les columnes: nom_medicament, principi_actiu, lot,
                quantitat, unitat, posologia, preu, dies_supressio
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
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900">
                Previsualització ({files.length} files)
              </h3>
              <div className="overflow-x-auto border border-gray-200 rounded-lg max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50">
                    <tr className="text-left text-gray-500">
                      <th className="px-3 py-2 font-medium">Medicament</th>
                      <th className="px-3 py-2 font-medium">Lot</th>
                      <th className="px-3 py-2 font-medium">Quantitat</th>
                      <th className="px-3 py-2 font-medium">Preu</th>
                      <th className="px-3 py-2 font-medium">Supressió</th>
                      <th className="px-3 py-2 font-medium">Estat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((f) => (
                      <tr key={f.fila} className={`border-t border-gray-100 ${ESTAT_ESTIL[f.estat]}`}>
                        <td className="px-3 py-1.5 text-gray-900">{f.dades.nom_medicament}</td>
                        <td className="px-3 py-1.5 text-gray-600">{f.dades.lot}</td>
                        <td className="px-3 py-1.5 text-gray-600">{f.dades.quantitat} {f.dades.unitat}</td>
                        <td className="px-3 py-1.5 text-gray-600">{f.dades.preu}</td>
                        <td className="px-3 py-1.5 text-gray-600">{f.dades.dies_supressio}</td>
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
                <p className="text-sm text-amber-700">
                  Hi ha files amb errors o duplicats interns. Corregeix el fitxer i torna&apos;l a pujar.
                </p>
              )}
              {errorGeneral && (
                <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{errorGeneral}</p>
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
              Tancar i actualitzar inventari
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
                  onClick={confirmarImportacio}
                  disabled={filesImportables.length === 0 || estat === 'confirmant'}
                  className="px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white
                             font-medium rounded-lg min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {estat === 'confirmant' ? 'Important...' : 'Confirmar càrrega'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
