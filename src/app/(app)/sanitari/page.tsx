'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Upload, Syringe } from 'lucide-react'
import { TaulaMedicaments } from '@/components/sanitari/TaulaMedicaments'
import { TaulaTractaments } from '@/components/sanitari/TaulaTractaments'
import { ModalNouMedicament } from '@/components/sanitari/ModalNouMedicament'
import { ModalImportarMedicaments } from '@/components/sanitari/ModalImportarMedicaments'
import { ModalAplicarTractament } from '@/components/sanitari/ModalAplicarTractament'
import { useSessio } from '@/lib/session/SessioContext'
import type { Medicament, TractamentAmbMedicament } from '@/types/sanitari'

type Vista = 'inventari' | 'tractaments'

/**
 * Pàgina del mòdul Sanitari: inventari de medicaments (amb alta
 * individual i importació CSV) i tractaments aplicats (amb aplicació
 * individual o per lot).
 *
 * @returns Pàgina amb selector de vista i les taules corresponents
 *
 * @remarks Control d'accés: lectura oberta als 3 rols (Treballador
 * només lectura, ampliació sobre docs/06_modul_sanitari.md, secció 1,
 * que reservava l'accés exclusivament a Admin/Veterinari — decisió
 * confirmada per mantenir el mateix patró aplicat a la resta de
 * mòduls). Les accions d'escriptura (nou medicament, importar CSV,
 * aplicar tractament) només per a Admin i Veterinari.
 * @remarks Multitenancy: no toca la BD directament; tota la lectura
 * passa pels endpoints /api/sanitari/*, aïllats via search_path del
 * tenant.
 */
export default function SanitariPage() {
  const { rol } = useSessio()
  const potEditar = rol === 'Admin' || rol === 'Veterinari'

  const [vista, setVista] = useState<Vista>('inventari')
  const [medicaments, setMedicaments] = useState<Medicament[]>([])
  const [tractaments, setTractaments] = useState<TractamentAmbMedicament[]>([])
  const [carregant, setCarregant] = useState(true)

  const [modalNouMedicamentObert, setModalNouMedicamentObert] = useState(false)
  const [modalImportarObert, setModalImportarObert] = useState(false)
  const [modalTractamentObert, setModalTractamentObert] = useState(false)

  const carregarMedicaments = useCallback(async () => {
    setCarregant(true)
    try {
      const res = await fetch('/api/sanitari/medicaments')
      if (res.ok) setMedicaments((await res.json()).medicaments)
    } finally {
      setCarregant(false)
    }
  }, [])

  const carregarTractaments = useCallback(async () => {
    setCarregant(true)
    try {
      const res = await fetch('/api/sanitari/tractaments')
      if (res.ok) setTractaments((await res.json()).tractaments)
    } finally {
      setCarregant(false)
    }
  }, [])

  useEffect(() => {
    if (vista === 'inventari') carregarMedicaments()
    else carregarTractaments()
  }, [vista, carregarMedicaments, carregarTractaments])

  function handleMedicamentDesat() {
    setModalNouMedicamentObert(false)
    carregarMedicaments()
  }

  function handleImportacioCompletada() {
    setModalImportarObert(false)
    carregarMedicaments()
  }

  function handleTractamentAplicat() {
    setModalTractamentObert(false)
    carregarTractaments()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-gray-900">Sanitari</h1>
        {potEditar && (
          <div className="flex gap-2">
            {vista === 'inventari' ? (
              <>
                <button
                  onClick={() => setModalImportarObert(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300
                             hover:bg-gray-50 text-gray-700 font-medium rounded-lg min-h-[44px]"
                >
                  <Upload size={18} aria-hidden="true" />
                  Carregar CSV
                </button>
                <button
                  onClick={() => setModalNouMedicamentObert(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700
                             text-white font-medium rounded-lg min-h-[44px]"
                >
                  <Plus size={18} aria-hidden="true" />
                  Nou medicament
                </button>
              </>
            ) : (
              <button
                onClick={() => setModalTractamentObert(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700
                           text-white font-medium rounded-lg min-h-[44px]"
              >
                <Syringe size={18} aria-hidden="true" />
                Aplicar tractament
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setVista('inventari')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${vista === 'inventari' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Magatzem sanitari
        </button>
        <button
          onClick={() => setVista('tractaments')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${vista === 'tractaments' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Tractaments
        </button>
      </div>

      {vista === 'inventari' ? (
        <TaulaMedicaments medicaments={medicaments} carregant={carregant} />
      ) : (
        <TaulaTractaments tractaments={tractaments} carregant={carregant} />
      )}

      {modalNouMedicamentObert && (
        <ModalNouMedicament
          onTancar={() => setModalNouMedicamentObert(false)}
          onDesat={handleMedicamentDesat}
        />
      )}

      {modalImportarObert && (
        <ModalImportarMedicaments
          onTancar={() => setModalImportarObert(false)}
          onImportacioCompletada={handleImportacioCompletada}
        />
      )}

      {modalTractamentObert && (
        <ModalAplicarTractament
          onTancar={() => setModalTractamentObert(false)}
          onAplicat={handleTractamentAplicat}
        />
      )}
    </div>
  )
}
