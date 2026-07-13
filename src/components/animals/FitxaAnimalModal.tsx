'use client'

import { useState } from 'react'
import { Skull } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { formatDate, formatNumber } from '@/lib/format'
import { Modal } from '@/components/ui/Modal'
import { queryKeys } from '@/lib/query/queryKeys'
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
 * @returns Modal amb la fitxa de només lectura + ModalBaixa opcional
 *
 * @remarks MIGRACIÓ REACT QUERY: la fitxa es carrega amb useQuery
 * (queryKeys.animals.fitxa(animalId)) en comptes de fetch+useEffect
 * manual. ModalBaixa (migrat a useMutation) ja invalida
 * queryKeys.animals.all internament en confirmar — aquest component
 * no necessita gestionar-ho.
 * @remarks Control d'accés: la fitxa és visible per als 3 rols. El
 * botó de baixa només per a Admin i Veterinari — comprovació només
 * visual, l'endpoint torna a validar el rol.
 * @remarks Reutilitza exactament els camps documentats a
 * docs/07_modul_arxiu_historic.md per al registre de baixa.
 */
export function FitxaAnimalModal({
  animalId,
  potDonarBaixa,
  onTancar,
  onBaixaRegistrada,
}: FitxaAnimalModalProps) {
  const [modalBaixaObert, setModalBaixaObert] = useState(false)

  const { data: fitxa, isLoading } = useQuery<FitxaAnimal>({
    queryKey: queryKeys.animals.fitxa(animalId),
    queryFn: () => fetch(`/api/animals/${animalId}`).then((res) => res.json()),
  })

  function handleBaixaConfirmada() {
    setModalBaixaObert(false)
    onBaixaRegistrada()
    onTancar()
  }

  const peu =
    fitxa && potDonarBaixa && fitxa.estatActiu ? (
      <button
        onClick={() => setModalBaixaObert(true)}
        className="flex items-center gap-2 px-4 py-2.5 bg-red-50 hover:bg-red-100
                   text-red-700 font-medium rounded-lg min-h-[44px]"
      >
        <Skull size={18} aria-hidden="true" />
        Donar de baixa
      </button>
    ) : undefined

  return (
    <Modal
      titol={`Fitxa de l'animal${fitxa ? ` — ${fitxa.dib}` : ''}`}
      onTancar={onTancar}
      mida="lg"
      peu={peu}
    >
      <div className="space-y-5">
        {isLoading ? (
          <p className="text-gray-500 text-center py-10">Carregant...</p>
        ) : !fitxa ? (
          <p className="text-red-600 text-center py-10">No s&apos;ha trobat l&apos;animal.</p>
        ) : (
          <>
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

            <div className="border-t border-gray-100 pt-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Historial de medicació</h3>
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

      {modalBaixaObert && fitxa && (
        <ModalBaixa
          animalId={animalId}
          animalDib={fitxa.dib}
          onTancar={() => setModalBaixaObert(false)}
          onConfirmada={handleBaixaConfirmada}
        />
      )}
    </Modal>
  )
}
