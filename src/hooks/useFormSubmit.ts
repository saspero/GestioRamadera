'use client'

import { useState, useCallback } from 'react'
import { toastExit, toastError } from '@/lib/toast/toastHelpers'

type OpcionsFormSubmit = {
  /** Missatge de toast d'èxit. Si s'omet, no es mostra cap toast d'èxit. */
  missatgeExit?: string
  /** Missatge d'error per defecte si l'error capturat no és una instància d'Error. */
  missatgeErrorPerDefecte?: string
  /** Callback cridat després d'un enviament amb èxit (per exemple, tancar el modal o refrescar una llista). */
  onExit?: () => void
}

/**
 * Hook que centralitza el patró d'enviament d'un formulari: estat
 * `enviant`, captura d'errors amb toast automàtic, i toast d'èxit
 * opcional.
 *
 * @param opcions - Missatges i callback d'èxit
 * @returns `enviant` (booleà) i `enviar(fn)`, que executa `fn` i
 * gestiona tot el cicle de vida de l'enviament
 *
 * @remarks Substitueix el patró repetit a cada modal existent:
 * ```ts
 * const [enviant, setEnviant] = useState(false)
 * const [errorMsg, setErrorMsg] = useState<string | null>(null)
 * async function handleSubmit() {
 *   setEnviant(true)
 *   setErrorMsg(null)
 *   try { ... } catch (err) { setErrorMsg(...) } finally { setEnviant(false) }
 * }
 * ```
 * Amb aquest hook, el component només ha de cridar
 * `enviar(() => fetch(...))` — la gestió d'estat i els toasts
 * d'èxit/error són automàtics, sense necessitat de `errorMsg` propi
 * ni de renderitzar-lo manualment al JSX.
 * @remarks Els modals EXISTENTS no es migren en aquest lliurament
 * (veure nota equivalent a src/components/ui/Modal.tsx) — aquest
 * hook està disponible per als propers lliuraments de migració.
 */
export function useFormSubmit(opcions: OpcionsFormSubmit = {}) {
  const [enviant, setEnviant] = useState(false)

  const enviar = useCallback(
    async (fn: () => Promise<void>) => {
      setEnviant(true)
      try {
        await fn()
        if (opcions.missatgeExit) toastExit(opcions.missatgeExit)
        opcions.onExit?.()
      } catch (error) {
        toastError(error, opcions.missatgeErrorPerDefecte)
      } finally {
        setEnviant(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [opcions.missatgeExit, opcions.missatgeErrorPerDefecte, opcions.onExit]
  )

  return { enviant, enviar }
}
