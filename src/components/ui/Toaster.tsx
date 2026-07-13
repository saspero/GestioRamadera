'use client'

import { Toaster as SonnerToaster } from 'sonner'

/**
 * Contenidor de notificacions toast, muntat una única vegada a
 * l'arrel de l'àrea protegida.
 *
 * @returns El component Toaster de Sonner, configurat amb la posició
 * i durada per defecte del projecte
 *
 * @remarks Posició top-center i mida gran (`expand`): a peu de
 * granja, sovint amb el mòbil en una mà i guants a l'altra, un toast
 * petit a la cantonada és fàcil de perdre. Es prioritza visibilitat.
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      expand
      richColors
      toastOptions={{
        duration: 4000,
        style: { fontSize: '0.95rem' },
      }}
    />
  )
}
