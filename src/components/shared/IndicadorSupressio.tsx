type IndicadorSupressioProps = {
  /**
   * Dies restants de bloqueig comercial. Si no es coneix (per exemple
   * al llistat general, que només sap si l'animal està en supressió
   * o no, sense el detall), es mostra la icona sense xifra en comptes
   * d'inventar un valor.
   */
  diesRestants?: number
}

/**
 * Indicador visual de bloqueig comercial per període de supressió.
 * Mostra un badge vermell amb els dies restants si es coneixen,
 * o només la icona d'alerta si no.
 */
export function IndicadorSupressio({ diesRestants }: IndicadorSupressioProps) {
  if (diesRestants !== undefined && diesRestants <= 0) return null

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5
                     bg-red-100 text-red-700 text-xs font-medium rounded-full">
      🔒{diesRestants !== undefined ? ` ${diesRestants}d supressió` : ' Supressió'}
    </span>
  )
}
