'use client'

import { useState, useCallback } from 'react'
import Papa from 'papaparse'
import { filaCsvMedicamentSchema, type FilaCsvMedicamentInput } from '@/lib/validators/sanitari'

export type FilaPrevisualitzacioMedicament = {
  fila: number
  dades: Record<string, string>
  /** `valida`: llest per importar. `duplicat_intern`: nom+lot repetit al mateix fitxer (bloqueja). `duplicat_bd`: ja existeix a la BD (s'actualitzarà l'estoc automàticament). `error`: camp amb format incorrecte (editable). */
  estat: 'valida' | 'duplicat_intern' | 'duplicat_bd' | 'error'
  errors: string[]
}

type EstatImportacio = 'idle' | 'parsejant' | 'comprovant' | 'confirmant' | 'completat' | 'error'

const CAPÇALERA_ESPERADA = [
  'nom_medicament', 'principi_actiu', 'lot', 'quantitat', 'unitat', 'preu', 'dies_supressio',
]

/**
 * Hook que orquestra tot el flux d'importació massiva de medicaments:
 * parsing del CSV, validació de format per fila, detecció de
 * duplicats interns i contra la BD, i confirmació final.
 *
 * @returns Estat del flux i funcions per avançar-hi
 *
 * @remarks Control d'accés: assumeix que només es munta dins d'una
 * pantalla ja protegida per a Admin/Veterinari. Els endpoints
 * (/api/sanitari/medicaments/comprovar-duplicats, /bulk-import)
 * tornen a validar el rol igualment.
 * @remarks Duplicats: a diferència de l'alta massiva d'animals, aquí
 * un duplicat NO bloqueja ni s'omet — s'informa a l'usuari que
 * s'actualitzarà l'estoc automàticament (docs/06_modul_sanitari.md,
 * secció 3.3, ampliat).
 */
export function useImportarMedicaments() {
  const [files, setFiles] = useState<FilaPrevisualitzacioMedicament[]>([])
  const [estat, setEstat] = useState<EstatImportacio>('idle')
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [resultat, setResultat] = useState<{ nombreCreats: number; nombreActualitzats: number } | null>(null)

  const processarFitxer = useCallback(async (file: File) => {
    setEstat('parsejant')
    setErrorGeneral(null)
    setResultat(null)

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: async (results) => {
        const capçaleraRebuda = results.meta.fields ?? []
        const capçaleraValida = CAPÇALERA_ESPERADA.every((c) => capçaleraRebuda.includes(c))

        if (!capçaleraValida) {
          setErrorGeneral(
            `Capçalera incorrecta. S'esperava com a mínim: ${CAPÇALERA_ESPERADA.join(', ')}`
          )
          setEstat('error')
          return
        }

        const combinacionsVistes = new Set<string>()
        const filesValidades: FilaPrevisualitzacioMedicament[] = results.data.map((dades, idx) => {
          const parsed = filaCsvMedicamentSchema.safeParse(dades)

          if (!parsed.success) {
            return {
              fila: idx + 1,
              dades,
              estat: 'error',
              errors: parsed.error.issues.map((i) => i.message),
            }
          }

          const clau = `${dades.nom_medicament.trim()}|||${dades.lot.trim()}`
          if (combinacionsVistes.has(clau)) {
            return {
              fila: idx + 1,
              dades,
              estat: 'duplicat_intern',
              errors: ['Combinació nom + lot repetida dins del mateix fitxer'],
            }
          }
          combinacionsVistes.add(clau)

          return { fila: idx + 1, dades, estat: 'valida', errors: [] }
        })

        setEstat('comprovant')
        const combinacionsPerComprovar = filesValidades
          .filter((f) => f.estat === 'valida')
          .map((f) => ({
            nomMedicament: f.dades.nom_medicament.trim(),
            lot: f.dades.lot.trim(),
          }))

        try {
          if (combinacionsPerComprovar.length > 0) {
            const res = await fetch('/api/sanitari/medicaments/comprovar-duplicats', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ combinacions: combinacionsPerComprovar }),
            })
            if (!res.ok) throw new Error('Error en comprovar duplicats')
            const { existents }: { existents: boolean[] } = await res.json()

            let idxComprovat = 0
            filesValidades.forEach((f) => {
              if (f.estat === 'valida') {
                if (existents[idxComprovat]) {
                  f.estat = 'duplicat_bd'
                  f.errors = ['Ja existeix — s\'actualitzarà l\'estoc sumant la quantitat']
                }
                idxComprovat++
              }
            })
          }

          setFiles(filesValidades)
          setEstat('idle')
        } catch {
          setErrorGeneral('No s\'ha pogut comprovar els duplicats amb el servidor')
          setEstat('error')
        }
      },
      error: () => {
        setErrorGeneral('No s\'ha pogut llegir el fitxer CSV')
        setEstat('error')
      },
    })
  }, [])

  const confirmarImportacio = useCallback(async () => {
    const filesAImportar = files.filter((f) => f.estat === 'valida' || f.estat === 'duplicat_bd')
    if (filesAImportar.length === 0) {
      setErrorGeneral('No hi ha cap fila vàlida per importar')
      return
    }

    setEstat('confirmant')
    setErrorGeneral(null)

    try {
      const medicaments: FilaCsvMedicamentInput[] = filesAImportar.map((f) => ({
        nom_medicament: f.dades.nom_medicament.trim(),
        principi_actiu: f.dades.principi_actiu.trim(),
        lot: f.dades.lot.trim(),
        quantitat: f.dades.quantitat.trim(),
        unitat: f.dades.unitat.trim(),
        posologia: f.dades.posologia?.trim() || '',
        preu: f.dades.preu.trim(),
        dies_supressio: f.dades.dies_supressio.trim(),
      }))

      const res = await fetch('/api/sanitari/medicaments/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medicaments }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error en la importació')

      setResultat(json)
      setEstat('completat')
    } catch (err) {
      setErrorGeneral(err instanceof Error ? err.message : 'Error desconegut')
      setEstat('error')
    }
  }, [files])

  const reiniciar = useCallback(() => {
    setFiles([])
    setEstat('idle')
    setErrorGeneral(null)
    setResultat(null)
  }, [])

  return { files, estat, errorGeneral, resultat, processarFitxer, confirmarImportacio, reiniciar }
}
