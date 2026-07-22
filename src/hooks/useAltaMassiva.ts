'use client'

import { useState, useCallback } from 'react'
import Papa from 'papaparse'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { filaAltaMassivaSchema, type FilaAltaMassiva } from '@/lib/validators/animals'
import { queryKeys } from '@/lib/query/queryKeys'
import { toastExit, toastError } from '@/lib/toast/toastHelpers'

/**
 * Estat d'una fila individual durant la previsualització de l'alta massiva.
 */
export type FilaPrevisualitzacio = {
  fila: number
  dades: Record<string, string>
  estat: 'valida' | 'duplicat_intern' | 'duplicat_bd' | 'error'
  errors: string[]
  omesa: boolean
}

type EstatParsing = 'idle' | 'parsejant' | 'comprovant' | 'llest' | 'error'

const CAPÇALERA_ESPERADA = ['dib', 'data_naixement', 'sexe']

type Assignacio = {
  racaId?: number
  lotId: number | null
  lotNouNom: string | null
  cortId: number
}

/**
 * Hook que orquestra tot el flux d'alta massiva d'animals: parsing
 * del CSV, validació de format per fila, detecció de duplicats
 * interns i contra la BD (fetch directe, no és una query cachejable),
 * i confirmació final (migrada a useMutation).
 *
 * @returns Estat del flux i funcions per avançar-hi
 *
 * @remarks MIGRACIÓ REACT QUERY: el pas de parsing/comprovació de
 * duplicats es manté com a estat local (és un flux seqüencial
 * d'un sol ús, no una dada cachejable). Només `confirmarImportacio`
 * es migra a `useMutation`, ja que és l'escriptura real que ha
 * d'invalidar el llistat d'animals (queryKeys.animals.all) perquè
 * TaulaAnimals es refresqui automàticament sense necessitat que la
 * pàgina pare cridi `carregarAnimals()` manualment.
 * @remarks Toasts: `onExit`/`onError` de la mutació ja mostren
 * toastExit()/toastError() — `errorGeneral` es manté igualment per
 * mostrar el mateix missatge també dins del modal (decisió
 * confirmada: reforç visual a més del toast, per si desapareix massa
 * ràpid).
 * @remarks Control d'accés: aquest hook no fa cap comprovació de rol.
 */
export function useAltaMassiva() {
  const queryClient = useQueryClient()
  const [files, setFiles] = useState<FilaPrevisualitzacio[]>([])
  const [estatParsing, setEstatParsing] = useState<EstatParsing>('idle')
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)

  const mutacio = useMutation({
    mutationFn: async (params: { animals: FilaAltaMassiva[]; assignacio: Assignacio }) => {
      const res = await fetch('/api/animals/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error en la importació')
      return json as { nombreCreats: number }
    },
    onSuccess: (resultat) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.animals.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.lots.all })
      toastExit(`${resultat.nombreCreats} animals importats correctament`)
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

        const dibsVistos = new Set<string>()
        const filesValidades: FilaPrevisualitzacio[] = results.data.map((dades, idx) => {
          const parsed = filaAltaMassivaSchema.safeParse(dades)
          const dib = dades.dib?.trim()

          if (!parsed.success) {
            return {
              fila: idx + 1,
              dades,
              estat: 'error',
              errors: parsed.error.issues.map((i) => i.message),
              omesa: false,
            }
          }

          if (dib && dibsVistos.has(dib)) {
            return {
              fila: idx + 1,
              dades,
              estat: 'duplicat_intern',
              errors: ['DIB repetit dins del mateix fitxer'],
              omesa: false,
            }
          }
          if (dib) dibsVistos.add(dib)

          return { fila: idx + 1, dades, estat: 'valida', errors: [], omesa: false }
        })

        setEstatParsing('comprovant')
        const dibsPerComprovar = filesValidades
          .filter((f) => f.estat === 'valida')
          .map((f) => f.dades.dib.trim())

        try {
          if (dibsPerComprovar.length > 0) {
            const res = await fetch('/api/animals/comprovar-duplicats', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ dibs: dibsPerComprovar }),
            })
            if (!res.ok) throw new Error('Error en comprovar duplicats')
            const { existents }: { existents: string[] } = await res.json()
            const existentsSet = new Set(existents)

            filesValidades.forEach((f) => {
              if (f.estat === 'valida' && existentsSet.has(f.dades.dib.trim())) {
                f.estat = 'duplicat_bd'
                f.errors = ['Aquest DIB ja existeix a la base de dades']
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

  const alternarOmesa = useCallback((fila: number) => {
    setFiles((prev) => prev.map((f) => (f.fila === fila ? { ...f, omesa: !f.omesa } : f)))
  }, [])

  const confirmarImportacio = useCallback(
    (assignacio: Assignacio) => {
      const filesAImportar = files.filter((f) => f.estat === 'valida' && !f.omesa)
      if (filesAImportar.length === 0) {
        setErrorGeneral('No hi ha cap fila vàlida per importar')
        return
      }

      const animals: FilaAltaMassiva[] = filesAImportar.map((f) => ({
        dib: f.dades.dib.trim(),
        data_naixement: f.dades.data_naixement?.trim() || '',
        sexe: (f.dades.sexe?.trim() || '') as FilaAltaMassiva['sexe'],
        lot_nom: f.dades.lot_nom?.trim() || '',
      }))

      mutacio.mutate({ animals, assignacio })
    },
    [files, mutacio]
  )

  const reiniciar = useCallback(() => {
    setFiles([])
    setEstatParsing('idle')
    setErrorGeneral(null)
    mutacio.reset()
  }, [mutacio])

  /**
   * Genera i descarrega una plantilla CSV buida (només capçalera +
   * una fila d'exemple a esborrar), perquè l'usuari sàpiga exactament
   * quines columnes calen abans de preparar el seu fitxer real.
   *
   * @remarks Nou (juliol 2026). La descripció de quins camps són
   * obligatoris/opcionals es dona com a text a la interfície (sota
   * el botó de descàrrega), no dins del CSV — un CSV no admet
   * comentaris de manera fiable i una fila "de text explicatiu" es
   * podria arribar a importar per error si l'usuari s'oblida
   * d'esborrar-la.
   */
  const descarregarPlantilla = useCallback(() => {
    const contingut = [
      CAPÇALERA_ESPERADA.concat('lot_nom').join(','),
      '123456789,2026-01-15,Mascle,Exemple - esborra aquesta fila',
    ].join('\n')

    const blob = new Blob([contingut], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const enllac = document.createElement('a')
    enllac.href = url
    enllac.download = 'plantilla_alta_massiva_animals.csv'
    enllac.click()
    URL.revokeObjectURL(url)
  }, [])

  // Combina l'estat de parsing local amb l'estat de la mutació, per
  // exposar la mateixa interfície `estat` que ja consumia el modal.
  const estat =
    mutacio.isPending ? 'confirmant' : mutacio.isSuccess ? 'completat' : estatParsing === 'llest' ? 'idle' : estatParsing

  return {
    files,
    estat,
    errorGeneral,
    resultat: mutacio.data ?? null,
    processarFitxer,
    alternarOmesa,
    confirmarImportacio,
    descarregarPlantilla,
    reiniciar,
  }
}
