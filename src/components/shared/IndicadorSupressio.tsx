type IndicadorSupressioProps = {
  diesRestants: number
}

/**
 * Indicador visual de bloqueig comercial per període de supressió.
 * Mostra un badge vermell amb els dies restants.
 */
export function IndicadorSupressio({ diesRestants }: IndicadorSupressioProps) {
  if (diesRestants <= 0) return null

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5
                     bg-red-100 text-red-700 text-xs font-medium rounded-full">
      🔒 {diesRestants}d supressió
    </span>
  )
}
