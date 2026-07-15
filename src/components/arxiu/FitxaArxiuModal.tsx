'use client'

import { useQuery } from '@tanstack/react-query'
import { Modal } from '@/components/ui/Modal'
import { formatDate, formatNumber } from '@/lib/format'
import { queryKeys } from '@/lib/query/queryKeys'
import type { FitxaArxiu } from '@/types/arxiu'

type FitxaArxiuModalProps = {
  animalId: number
  onTancar: () => void
}

/**
 * Modal amb la fitxa completa d'un animal de l'arxiu: dades
 * bàsiques, historial complet de lots/corts, historial de pesos,
 * historial de tractaments, i dades de la baixa (venda o mort).
 *
 * @param props.animalId - Id de l'animal a mostrar
 * @param props.onTancar - Callback per tancar el modal
 * @returns Modal de només lectura (sense cap acció d'edició — un
 * animal de l'arxiu ja no es pot modificar)
 *
 * @remarks Rendiment (%) es mostra només si pesCanalKg és informat,
 * ja calculat pel backend (docs/07_modul_arxiu_historic.md, secció 3.2).
 * @remarks NO mostra cost sanitari acumulat — fora d'abast (veure
 * docs/07_modul_arxiu_historic.md, secció 5, nota).
 * @remarks Control d'accés: es munta des de la pàgina d'Arxiu, ja
 * protegida per a Admin/Veterinari. L'endpoint torna a validar el rol.
 */
export function FitxaArxiuModal({ animalId, onTancar }: FitxaArxiuModalProps) {
  const { data: fitxa, isLoading } = useQuery<FitxaArxiu>({
    queryKey: queryKeys.arxiu.fitxa(animalId),
    queryFn: () => fetch(`/api/arxiu/${animalId}`).then((res) => res.json()),
  })

  return (
    <Modal titol={`Fitxa de l'arxiu${fitxa ? ` — ${fitxa.dib}` : ''}`} onTancar={onTancar} mida="lg">
      <div className="space-y-5">
        {isLoading ? (
          <p className="text-gray-500 text-center py-10">Carregant...</p>
        ) : !fitxa ? (
          <p className="text-red-600 text-center py-10">No s&apos;ha trobat l&apos;animal a l&apos;arxiu.</p>
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
            </div>

            <div className="border-t border-gray-100 pt-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">
                Baixa — {fitxa.baixa.motiu}
              </h3>
              {fitxa.baixa.motiu === 'Venda' ? (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-400">Data de venda</p>
                    <p className="text-gray-700">{formatDate(fitxa.baixa.dataBaixa)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Comprador / Escorxador</p>
                    <p className="text-gray-700">{fitxa.baixa.compradorEscorxador ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Pes en viu</p>
                    <p className="text-gray-700">
                      {fitxa.baixa.pesViuKg !== null ? `${formatNumber(fitxa.baixa.pesViuKg)} kg` : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Pes en canal</p>
                    <p className="text-gray-700">
                      {fitxa.baixa.pesCanalKg !== null ? `${formatNumber(fitxa.baixa.pesCanalKg)} kg` : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Rendiment</p>
                    <p className="text-gray-700">
                      {fitxa.baixa.rendiment !== null ? `${formatNumber(fitxa.baixa.rendiment)}%` : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Preu / kg</p>
                    <p className="text-gray-700">
                      {fitxa.baixa.preuKg !== null ? `${formatNumber(fitxa.baixa.preuKg)} €` : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Cost de transport</p>
                    <p className="text-gray-700">
                      {fitxa.baixa.costTransport !== null ? `${formatNumber(fitxa.baixa.costTransport)} €` : '—'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-400">Data de la mort</p>
                    <p className="text-gray-700">{formatDate(fitxa.baixa.dataBaixa)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Causa de la mort</p>
                    <p className="text-gray-700">{fitxa.baixa.causaMort ?? '—'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-gray-400">Codi de recollida de cadàvers</p>
                    <p className="text-gray-700">{fitxa.baixa.codiRecollidaCadavers ?? '—'}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 pt-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Historial de lots i corts</h3>
              {fitxa.historialDistribucions.length === 0 ? (
                <p className="text-sm text-gray-400">Cap moviment registrat.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="py-1 font-medium">Lot</th>
                      <th className="py-1 font-medium">Cort</th>
                      <th className="py-1 font-medium">Des de</th>
                      <th className="py-1 font-medium">Fins a</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fitxa.historialDistribucions.map((d, idx) => (
                      <tr key={idx} className="border-t border-gray-50">
                        <td className="py-1 text-gray-700">{d.nomLot ?? '—'}</td>
                        <td className="py-1 text-gray-700">{d.codiCort ?? '—'}</td>
                        <td className="py-1 text-gray-700">{formatDate(d.dataEntrada)}</td>
                        <td className="py-1 text-gray-700">{d.dataSortida ? formatDate(d.dataSortida) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
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
    </Modal>
  )
}
