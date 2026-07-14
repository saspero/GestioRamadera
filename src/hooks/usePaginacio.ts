'use client'

import { useState, useMemo, useEffect } from 'react'

const MIDA_PAGINA_DEFECTE = 25

/**
 * Hook de paginació purament client-side: talla un array ja carregat
 * en pàgines, sense fer cap petició addicional al servidor.
 *
 * @param dades - Array complet ja carregat (per exemple, el resultat d'un useQuery)
 * @param midaPagina - Nombre de files per pàgina (per defecte 25)
 * @returns Dades de la pàgina actual + controls de navegació
 *
 * @remarks Decisió confirmada amb l'usuari: paginació NOMÉS visual,
 * no real amb LIMIT/OFFSET al backend — el servidor segueix retornant
 * el dataset complet (com fins ara) i aquest hook només en controla
 * la porció visible. És una millora d'usabilitat (evita taules de
 * centenars de files sense cap navegació) però no resol el problema
 * de fons de rendiment amb datasets molt grans — si el volum de
 * dades creix molt, caldrà migrar a paginació real al backend
 * (LIMIT/OFFSET), documentat com a limitació coneguda.
 * @remarks Si `dades` canvia de mida (per exemple, per un filtre o
 * una cerca) i la pàgina actual queda fora de rang, es reinicia
 * automàticament a la pàgina 1 per evitar mostrar una pàgina buida.
 */
export function usePaginacio<T>(dades: T[], midaPagina: number = MIDA_PAGINA_DEFECTE) {
  const [paginaActual, setPaginaActual] = useState(1)

  const totalPagines = Math.max(1, Math.ceil(dades.length / midaPagina))

  useEffect(() => {
    if (paginaActual > totalPagines) setPaginaActual(1)
  }, [totalPagines, paginaActual])

  const dadesPagina = useMemo(() => {
    const inici = (paginaActual - 1) * midaPagina
    return dades.slice(inici, inici + midaPagina)
  }, [dades, paginaActual, midaPagina])

  return {
    dadesPagina,
    paginaActual,
    totalPagines,
    totalFiles: dades.length,
    anarAPagina: setPaginaActual,
    paginaSeguent: () => setPaginaActual((p) => Math.min(p + 1, totalPagines)),
    paginaAnterior: () => setPaginaActual((p) => Math.max(p - 1, 1)),
  }
}
