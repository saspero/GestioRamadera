'use client'

import { useState, useCallback } from 'react'
import Papa from 'papaparse'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { filaCsvMedicamentSchema, type FilaCsvMedicamentInput } from '@/lib/validators/sanitari'
import { queryKeys } from '@/lib/query/queryKeys'
import { toastExit, toastError } from '@/lib/toast/toastHelpers'

export type FilaPrevisualitzacioMedicament = {
  fila: number
  dades: Record<string, string>
  estat: 'valida' | 'duplicat_intern' | 'duplicat_bd' | 'error'
  errors: string[]
}

type EstatParsing = 'idle' | 'parsejant' | 'comprovant' | 'llest' | 'error'

const CAPÇALERA_ESPERADA = [
  'nom_medicament', 'principi_actiu', 'lot', 'quantitat', 'unitat', 'preu', 'dies_supressio',
]

/**
 * Hook que orquestra tot el flux d'importació massiva de medicaments:
 * parsing del CSV, validació de format per fila, detecció de
 * duplicats interns i contra la BD, i confirmació final (migrada a
 * useMutation).
 *
 * @returns Estat del flux i funcions per avançar-hi
 *
 * @remarks MIGRACIÓ REACT QUERY: mateix patró que useAltaMassiva.ts
 * (mòdul Animals) — el parsing/comprovació de duplicats es manté com
 * a estat local (flux seqüencial d'un sol ús), i només la
 * confirmació final es migra a useMutation, invalidant
 * queryKeys.sanitari.medicaments en tenir èxit.
 * @remarks Duplicats: a diferència de l'alta massiva d'animals, aquí
 * un duplicat NO bloqueja ni s'omet — s'informa a l'usuari que
 * s'actualitzarà l'estoc automàticament (docs/06_modul_sanitari.md).
 * @remarks Control d'accés: assumeix que només es munta dins d'una
 * pantalla ja protegida per a Admin/Veterinari.
 */
export function useImportarMedicaments() {
  const queryClient = useQueryClient()
  const [files, setFiles] = useState<FilaPrevisualitzacioMedicament[]>([])
  const [estatParsing, setEstatParsing] = useState<EstatParsing>('idle')
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)

  const mutacio = useMutation({
    mutationFn: async (medicaments: FilaCsvMedicamentInput[]) => {
      const res = await fetch('/api/sanitari/medicaments/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medicaments }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error en la importació')
      return json as {
        nombreCatalegsCreats: number
        nombreEntradesCreades: number
        nombreEntradesActualitzades: number
      }
    },
    onSuccess: (resultat) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sanitari.medicaments })
      queryClient.invalidateQueries({ queryKey: queryKeys.sanitari.medicamentsCataleg })
      const parts = [`${resultat.nombreEntradesCreades} entrades noves`]
      if (resultat.nombreEntradesActualitzades > 0) {
        parts.push(`${resultat.nombreEntradesActualitzades} amb estoc actualitzat`)
      }
      if (resultat.nombreCatalegsCreats > 0) {
        parts.push(`${resultat.nombreCatalegsCreats} medicaments nous al catàleg`)
      }
      toastExit(parts.join(', '))
      setErrorGeneral(null)
    },
    onError: (err) => {
      toastError(err, 'Error en la importació')
      setErrorGeneral(err instanceof Error ? err.message : 'Error desconegut')
    },
  })

  const processarFitxer = useCallback(async (file: File) => {
    setEstatParsing('parsejant')
    setErrorGeneral(null)
    mutacio.reset()

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
          setEstatParsing('error')
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

        setEstatParsing('comprovant')
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
          setEstatParsing('llest')
        } catch {
          setErrorGeneral('No s\'ha pogut comprovar els duplicats amb el servidor')
          setEstatParsing('error')
        }
      },
      error: () => {
        setErrorGeneral('No s\'ha pogut llegir el fitxer CSV')
        setEstatParsing('error')
      },
    })
  }, [mutacio])

  const confirmarImportacio = useCallback(() => {
    const filesAImportar = files.filter((f) => f.estat === 'valida' || f.estat === 'duplicat_bd')
    if (filesAImportar.length === 0) {
      setErrorGeneral('No hi ha cap fila vàlida per importar')
      return
    }

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

    mutacio.mutate(medicaments)
  }, [files, mutacio])

  const reiniciar = useCallback(() => {
    setFiles([])
    setEstatParsing('idle')
    setErrorGeneral(null)
    mutacio.reset()
  }, [mutacio])

  const estat =
    mutacio.isPending ? 'confirmant' : mutacio.isSuccess ? 'completat' : estatParsing === 'llest' ? 'idle' : estatParsing

  return {
    files,
    estat,
    errorGeneral,
    resultat: mutacio.data ?? null,
    processarFitxer,
    confirmarImportacio,
    reiniciar,
  }
}
