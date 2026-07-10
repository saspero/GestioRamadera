'use client'

import { useState, useCallback } from 'react'
import Papa from 'papaparse'
import { filaAltaMassivaSchema, type FilaAltaMassiva } from '@/lib/validators/animals'

/**
 * Estat d'una fila individual durant la previsualització de l'alta massiva.
 */
export type FilaPrevisualitzacio = {
  fila: number
  dades: Record<string, string>
  /** `valida`: llest per importar. `duplicat_intern`: DIB repetit al mateix fitxer (bloqueja). `duplicat_bd`: ja existeix a la BD (advertència, es pot ometre). `error`: camp amb format incorrecte (editable). */
  estat: 'valida' | 'duplicat_intern' | 'duplicat_bd' | 'error'
  errors: string[]
  /** Si l'usuari ha desmarcat la fila per ometre-la de la importació. */
  omesa: boolean
}

type EstatImportacio = 'idle' | 'parsejant' | 'comprovant' | 'confirmant' | 'completat' | 'error'

/**
 * @remarks lot_nom és opcional: si una fila l'indica, s'aplica NOMÉS
 * a aquell animal, sobreescrivint el lot per defecte del pas 2
 * (docs/08_modul_llistat_actius.md, secció 4.2 — ampliació).
 */
const CAPÇALERA_ESPERADA = ['dib', 'data_naixement', 'sexe']

/**
 * Hook que orquestra tot el flux d'alta massiva d'animals:
 * parsing del CSV, validació de format per fila, detecció de
 * duplicats interns i contra la BD, i confirmació final.
 *
 * @returns Estat del flux i funcions per avançar-hi
 *
 * @remarks Control d'accés: aquest hook no fa cap comprovació de rol
 * — assumeix que només es munta dins d'una pantalla ja protegida per
 * a Admin (la pàgina d'animals ho comprova abans de mostrar el botó
 * d'alta massiva). Els endpoints (/api/animals/comprovar-duplicats,
 * /api/animals/bulk-import) tornen a validar el rol igualment.
 * @remarks Seguir el flux descrit a docs/08_modul_llistat_actius.md,
 * secció 4.3.
 */
export function useAltaMassiva() {
  const [files, setFiles] = useState<FilaPrevisualitzacio[]>([])
  const [estat, setEstat] = useState<EstatImportacio>('idle')
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [resultat, setResultat] = useState<{ nombreCreats: number } | null>(null)

  /**
   * Processa el fitxer CSV pujat per l'usuari: parseja amb PapaParse,
   * valida cada fila amb Zod, detecta duplicats interns, i després
   * consulta al backend quins DIB ja existeixen a la BD.
   *
   * @param file - Fitxer CSV seleccionat per l'usuari
   */
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

        // Validació per fila + detecció de duplicats interns
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

        // Comprovació de duplicats contra la BD (només per les files vàlides fins ara)
        setEstat('comprovant')
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

  /** Alterna si una fila concreta s'omet de la importació final. */
  const alternarOmesa = useCallback((fila: number) => {
    setFiles((prev) =>
      prev.map((f) => (f.fila === fila ? { ...f, omesa: !f.omesa } : f))
    )
  }, [])

  /**
   * Confirma la importació de totes les files vàlides i no omeses.
   *
   * @param assignacio - Raça, lot per defecte i cort de destí per al bloc
   */
  const confirmarImportacio = useCallback(
    async (assignacio: {
      racaId: number
      lotId: number | null
      lotNouNom: string | null
      cortId: number
    }) => {
      const filesAImportar = files.filter((f) => f.estat === 'valida' && !f.omesa)
      if (filesAImportar.length === 0) {
        setErrorGeneral('No hi ha cap fila vàlida per importar')
        return
      }

      setEstat('confirmant')
      setErrorGeneral(null)

      try {
        const animals: FilaAltaMassiva[] = filesAImportar.map((f) => ({
          dib: f.dades.dib.trim(),
          data_naixement: f.dades.data_naixement?.trim() || '',
          sexe: (f.dades.sexe?.trim() || '') as FilaAltaMassiva['sexe'],
          lot_nom: f.dades.lot_nom?.trim() || '',
        }))

        const res = await fetch('/api/animals/bulk-import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ animals, assignacio }),
        })

        const json = await res.json()
        if (!res.ok) {
          throw new Error(json.error ?? 'Error en la importació')
        }

        setResultat(json)
        setEstat('completat')
      } catch (err) {
        setErrorGeneral(err instanceof Error ? err.message : 'Error desconegut')
        setEstat('error')
      }
    },
    [files]
  )

  const reiniciar = useCallback(() => {
    setFiles([])
    setEstat('idle')
    setErrorGeneral(null)
    setResultat(null)
  }, [])

  return {
    files,
    estat,
    errorGeneral,
    resultat,
    processarFitxer,
    alternarOmesa,
    confirmarImportacio,
    reiniciar,
  }
}
