'use client'

import { formatDate, formatNumber } from '@/lib/format'
import type { TractamentAmbMedicament } from '@/types/sanitari'

type TaulaTractamentsProps = {
  tractaments: TractamentAmbMedicament[]
  carregant: boolean
}

/**
 * Taula de tractaments aplicats, amb indicador de bloqueig comercial
 * actiu quan la data d'alliberament encara és futura.
 *
 * @param props.tractaments - Tractaments a mostrar
 * @param props.carregant - Indica si s'està carregant
 * @returns Taula responsive amb l'històric de tractaments
 *
 * @remarks docs/06_modul_sanitari.md, secció 4.3: mentre
 * data_alliberament sigui futura, l'animal no pot ser venut. Aquesta
 * taula mostra l'estat visualment (badge vermell) per a referència
 * ràpida.
 */
export function TaulaTractaments({ tractaments, carregant }: TaulaTractamentsProps) {
  const avui = new Date().toISOString().slice(0, 10)

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-100 bg-gray-50">
            <th className="px-4 py-2 font-medium">Animal</th>
            <th className="px-4 py-2 font-medium">Medicament</th>
            <th className="px-4 py-2 font-medium">Data inici</th>
            <th className="px-4 py-2 font-medium">Dosi</th>
            <th className="px-4 py-2 font-medium">Alliberament</th>
          </tr>
        </thead>
        <tbody>
          {carregant ? (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                Carregant...
              </td>
            </tr>
          ) : tractaments.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                Cap tractament registrat.
              </td>
            </tr>
          ) : (
            tractaments.map((t) => {
              const enSupressio = t.dataAlliberament !== null && t.dataAlliberament > avui
              return (
                <tr key={t.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-900">{t.animalDib}</td>
                  <td className="px-4 py-2.5 text-gray-700">{t.nomMedicament}</td>
                  <td className="px-4 py-2.5 text-gray-700">{formatDate(t.dataInici)}</td>
                  <td className="px-4 py-2.5 text-gray-700">
                    {t.dosiAplicada !== null ? `${formatNumber(t.dosiAplicada)} ${t.unitatDosi ?? ''}` : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    {t.dataAlliberament ? (
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${enSupressio ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}
                      >
                        {formatDate(t.dataAlliberament)}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
