'use client'

type CercadorRapidProps = {
  valor:     string
  onChange:  (valor: string) => void
  placeholder?: string
}

/**
 * Cercador en temps real per a la graella d'animals.
 * Filtra per crotal a mesura que l'usuari escriu.
 */
export function CercadorRapid({
  valor,
  onChange,
  placeholder = 'Cercar per crotal...',
}: CercadorRapidProps) {
  return (
    <input
      type="search"
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-4 py-2 text-base border border-gray-300 rounded-lg
                 focus:outline-none focus:ring-2 focus:ring-primary-500
                 bg-white"
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
    />
  )
}
