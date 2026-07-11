'use client'

import { useState, useEffect } from 'react'
import { X, Skull } from 'lucide-react'
import { formatDate, formatNumber } from '@/lib/format'
import { ModalBaixa } from './ModalBaixa'
import type { FitxaAnimal } from '@/types/animals-extra'

type FitxaAnimalModalProps = {
  animalId: number
  /** Si false (rol Treballador), s'amaga el botó de donar de baixa. */
  potDonarBaixa: boolean
  onTancar: () => void
  onBaixaRegistrada: () => void
}

const COLORS_SALUT: Record<string, string> = {
  Sa: 'bg-green-100 text-green-700',
  'En tractament': 'bg-amber-100 text-amber-700',
  Observació: 'bg-blue-100 text-blue-700',
  Crític: 'bg-red-100 text-red-700',
}

/**
 * Modal amb la fitxa completa d'un animal: dades bàsiques, ubicació
 * actual, historial de pesos, historial de tractaments, i botó per
 * donar-lo de baixa.
 *
 * @param props.animalId - Id de l'animal a mostrar
 * @param props.potDonarBaixa - Si false, s'amaga el botó de baixa
 * @param props.onTancar - Callback per tancar el modal
 * @param props.onBaixaRegistrada - Callback en confirmar una baixa
 * (la pàgina pare hauria de recarregar el llistat, ja que l'animal
 * deixa de ser actiu)
 * @returns Modal amb la fitxa de només lectura + ModalBaixa opcional
 *
 * @remarks Control d'accés: la fitxa en si és visible per als 3 rols
 * (docs/08_modul_llistat_actius.md). El botó de baixa només per a
 * Admin i Veterinari — comprovació només visual, l'endpoint de baixa
 * torna a validar el rol.
 * @remarks Reutilitza exactament els camps documentats a
 * docs/07_modul_arxiu_historic.md per al registre de baixa (via
 * ModalBaixa).
 */
export function FitxaAnimalModal({
  animalId,
  potDonarBaixa,
  onTancar,
  onBaixaRegistrada,
}: FitxaAnimalModalProps) {
  const [fitxa, setFitxa] = useState<FitxaAnimal | null>(null)
  const [carregant, setCarregant] = useState(true)
  const [modalBaixaObert, setModalBaixaObert] = useState(false)

  useEffect(() => {
    fetch(`/api/animals/${animalId}`)
      .then((res) => res.json())
      .then(setFitxa)
      .finally(() => setCarregant(false))
  }, [animalId])

  function handleBaixaConfirmada() {
    setModalBaixaObert(false)
    onBaixaRegistrada()
    onTancar()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            Fitxa de l&apos;animal {fitxa ? `— ${fitxa.dib}` : ''}
          </h2>
          <button
            onClick={onTancar}
            className="p-2 -mr-2 rounded-lg hover:bg-gray-100 min-h-[44px] min-w-[44px]"
            aria-label="Tancar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {carregant ? (
            <p className="text-gray-500 text-center py-10">Carregant...</p>
          ) : !fitxa ? (
            <p className="text-red-600 text-center py-10">No s&apos;ha trobat l&apos;animal.</p>
          ) : (
            <>
              {/* Dades bàsiques */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-400">DIB</p>
                  <p className="font-medium text-gray-900">{fitxa.dib}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Raça</p>
                  <p className="font-medium text-gray-900">{fitxa.nomRaca ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Sexe</p>
                  <p className="font-medium text-gray-900">{fitxa.sexe ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Data de naixement</p>
                  <p className="font-medium text-gray-900">
                    {fitxa.dataNaixement ? formatDate(fitxa.dataNaixement) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Edat</p>
                  <p className="font-medium text-gray-900">
                    {fitxa.edatDies !== null ? `${formatNumber(fitxa.edatDies)} dies` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Estat de salut</p>
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${COLORS_SALUT[fitxa.estatSalut]}`}
                  >
                    {fitxa.estatSalut}
                  </span>
                </div>
              </div>

              {/* Ubicació */}
              <div className="border-t border-gray-100 pt-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Ubicació actual</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-400">Granja</p>
                    <p className="text-gray-700">{fitxa.nomUbicacio ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Nau</p>
                    <p className="text-gray-700">{fitxa.nomZona ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Cort</p>
                    <p className="text-gray-700">{fitxa.codiCort ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Lot</p>
                    <p className="text-gray-700">{fitxa.nomLot ?? '—'}</p>
                  </div>
                </div>
              </div>

              {/* Historial de pesos */}
              <div className="border-t border-gray-100 pt-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Historial de pesos</h3>
                {fitxa.historialPes.length === 0 ? (
                  <p className="text-sm text-gray-400">Cap registre de pes.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500">
                        <th className="py-1 font-medium">Data</th>
                        <th className="py-1 font-medium text-right">Pes (kg)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fitxa.historialPes.map((p, idx) => (
                        <tr key={idx} className="border-t border-gray-50">
                          <td className="py-1 text-gray-700">{formatDate(p.data)}</td>
                          <td className="py-1 text-right text-gray-700">{formatNumber(p.pesKg)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Historial de tractaments */}
              <div className="border-t border-gray-100 pt-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">
                  Historial de medicació
                </h3>
                {fitxa.historialTractaments.length === 0 ? (
                  <p className="text-sm text-gray-400">Cap tractament registrat.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500">
                        <th className="py-1 font-medium">Medicament</th>
                        <th className="py-1 font-medium">Data inici</th>
                        <th className="py-1 font-medium">Alliberament</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fitxa.historialTractaments.map((t) => (
                        <tr key={t.id} className="border-t border-gray-50">
                          <td className="py-1 text-gray-700">{t.nomMedicament}</td>
                          <td className="py-1 text-gray-700">{formatDate(t.dataInici)}</td>
                          <td className="py-1 text-gray-700">
                            {t.dataAlliberament ? formatDate(t.dataAlliberament) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>

        {fitxa && potDonarBaixa && fitxa.estatActiu && (
          <div className="flex justify-end px-5 py-4 border-t border-gray-100">
            <button
              onClick={() => setModalBaixaObert(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-50 hover:bg-red-100
                         text-red-700 font-medium rounded-lg min-h-[44px]"
            >
              <Skull size={18} aria-hidden="true" />
              Donar de baixa
            </button>
          </div>
        )}
      </div>

      {modalBaixaObert && fitxa && (
        <ModalBaixa
          animalId={animalId}
          animalDib={fitxa.dib}
          onTancar={() => setModalBaixaObert(false)}
          onConfirmada={handleBaixaConfirmada}
        />
      )}
    </div>
  )
}
